"""Slot 106 `vae`: does a random latent point decode to a digit, AE against VAE?

10-3b trains a ConvVAE (cells 6-19, latent_dim 16) and a CVAE conditioned on
the frozen CLIP text encoder (cells 20-40), both seed 42, Adam 1e-3, 10
epochs, batch 256, loss = summed MSE + KL, divided by the batch. Cell 1 only
recalls the autoencoder; this trains it as 10-3b's ConvVAE with the KL term
removed and z = mu, so the KL is the one difference between the two.

Each model is trained at a 2-D latent (the widget's clickable map) and at the
notebook's 16. "Decodes to a digit" is measured two ways, because a CNN is
confident on blends: (1) a small MNIST classifier of ours, its top probability
at several thresholds; (2) the L2 distance from each decode to its nearest
training image, against the same distance for reconstructions of test images.

Data and checkpoints live outside the repo (Dropbox):
  python -I widgets/_lab/vae-measure.py "<...>/_scratch/frontiers-data" train <kind> <latent>
      kind = ae | vae | cvae | clf   (clf ignores latent)
  python -I widgets/_lab/vae-measure.py "<...>/_scratch/frontiers-data" score
writes widgets/_lab/vae-measure.json (untracked). The CVAE needs
clip-106/clip_mnist_align.pt (his GitHub file, keys img_encoder/txt_encoder).
"""
import gzip, json, os, random, sys, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

DATA = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vae-measure.json")
CKPT = os.path.join(DATA, "models-106")
os.makedirs(CKPT, exist_ok=True)
torch.set_num_threads(min(16, os.cpu_count()))


def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f:
        b = f.read()
    if "images" in name:
        n, r, c = np.frombuffer(b, ">i4", 3, 4)
        return np.frombuffer(b, np.uint8, offset=16).reshape(n, 1, r, c)
    return np.frombuffer(b, np.uint8, offset=8)


Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255.0
Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255.0
Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)


def seed_all(s=42):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


# ---- 10-3b's models, verbatim ------------------------------------------------
class EncoderConvVAE(nn.Module):  # cell 6
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=128, latent_dim=16):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, latent_ch, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.to_embed = nn.Sequential(nn.Flatten(1), nn.Linear(latent_ch * 49, embed_dim), nn.ReLU())
        self.fc_mu = nn.Linear(embed_dim, latent_dim)
        self.fc_logvar = nn.Linear(embed_dim, latent_dim)

    def forward(self, x):
        h = self.to_embed(self.conv(x))
        return self.fc_mu(h), self.fc_logvar(h)


class DecoderConvVAE(nn.Module):  # cell 6
    def __init__(self, out_ch=1, latent_ch=64, latent_dim=16):
        super().__init__()
        self.expand = nn.Sequential(nn.Linear(latent_dim, latent_ch * 49), nn.Unflatten(1, (latent_ch, 7, 7)))
        self.deconv = nn.Sequential(
            nn.ConvTranspose2d(latent_ch, 32, 4, 2, 1), nn.ReLU(),
            nn.ConvTranspose2d(32, out_ch, 4, 2, 1), nn.Sigmoid())

    def forward(self, z):
        return self.deconv(self.expand(z))


class ConvVAE(nn.Module):  # cell 6
    def __init__(self, latent_dim=16):
        super().__init__()
        self.encoder = EncoderConvVAE(latent_dim=latent_dim)
        self.decoder = DecoderConvVAE(latent_dim=latent_dim)
        self.latent_dim = latent_dim

    def reparameterize(self, mu, logvar):
        return mu + torch.exp(0.5 * logvar) * torch.randn_like(logvar)

    def forward(self, x, deterministic=False):
        mu, logvar = self.encoder(x)
        z = mu if deterministic else self.reparameterize(mu, logvar)
        return self.decoder(z), mu, logvar, z


class CondEncoderConvVAE(nn.Module):  # cell 31
    def __init__(self, in_ch=1, latent_ch=64, enc_embed_dim=128, latent_dim=16, cond_dim=64):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, latent_ch, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.flatten = nn.Flatten(1)
        self.to_embed = nn.Sequential(nn.Linear(latent_ch * 49 + cond_dim, enc_embed_dim), nn.ReLU())
        self.fc_mu = nn.Linear(enc_embed_dim, latent_dim)
        self.fc_logvar = nn.Linear(enc_embed_dim, latent_dim)

    def forward(self, x, c):
        h = self.to_embed(torch.cat([self.flatten(self.conv(x)), c], 1))
        return self.fc_mu(h), self.fc_logvar(h)


class CondDecoderConvVAE(nn.Module):  # cell 31
    def __init__(self, out_ch=1, latent_ch=64, latent_dim=16, cond_dim=64):
        super().__init__()
        self.expand = nn.Sequential(nn.Linear(latent_dim + cond_dim, latent_ch * 49), nn.ReLU(),
                                    nn.Unflatten(1, (latent_ch, 7, 7)))
        self.deconv = nn.Sequential(
            nn.ConvTranspose2d(latent_ch, 32, 4, 2, 1), nn.ReLU(),
            nn.ConvTranspose2d(32, out_ch, 4, 2, 1), nn.Sigmoid())

    def forward(self, z, c):
        return self.deconv(self.expand(torch.cat([z, c], 1)))


class ConditionalConvVAE(nn.Module):  # cell 31
    def __init__(self, latent_dim=16, cond_dim=64):
        super().__init__()
        self.encoder = CondEncoderConvVAE(latent_dim=latent_dim, cond_dim=cond_dim)
        self.decoder = CondDecoderConvVAE(latent_dim=latent_dim, cond_dim=cond_dim)
        self.latent_dim = latent_dim

    def forward(self, x, c):
        mu, logvar = self.encoder(x, c)
        z = mu + torch.exp(0.5 * logvar) * torch.randn_like(logvar)
        return self.decoder(z, c), mu, logvar, z


class TextEncoder(nn.Module):  # cell 28
    def __init__(self, vocab_size=10, embed_dim=64):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, embed_dim)
        self.fc = nn.Linear(embed_dim, embed_dim)

    def forward(self, ids):
        return F.normalize(self.fc(self.emb(ids)), dim=1)


def vae_loss(x_hat, x, mu, logvar, kl_on=True):  # cell 12
    recon = F.mse_loss(x_hat, x, reduction="sum")
    kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    B = x.size(0)
    return ((recon + kl) if kl_on else recon) / B, recon / B, kl / B


class Classifier(nn.Module):  # ours: the instrument, not the notebook's
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Flatten(1), nn.Linear(64 * 49, 128), nn.ReLU(), nn.Linear(128, 10))

    def forward(self, x):
        return self.net(x)


def txt_encoder():
    t = TextEncoder()
    t.load_state_dict(torch.load(os.path.join(DATA, "clip-106", "clip_mnist_align.pt"),
                                 map_location="cpu", weights_only=True)["txt_encoder"])
    t.eval()
    for p in t.parameters():
        p.requires_grad = False
    return t


def train(kind, latent):
    seed_all(42)
    t0 = time.time()
    if kind == "clf":
        m = Classifier(); opt = torch.optim.Adam(m.parameters(), 1e-3)
        for ep in range(3):
            m.train()
            for b in torch.randperm(len(Xtr)).split(256):
                loss = F.cross_entropy(m(Xtr[b]), Ytr[b])
                opt.zero_grad(); loss.backward(); opt.step()
            m.eval()
            with torch.no_grad():
                acc = (m(Xte).argmax(1) == Yte).float().mean().item()
            print(f"clf epoch {ep+1} test acc {acc:.4f}", flush=True)
        torch.save(m.state_dict(), os.path.join(CKPT, "clf.pt"))
        return
    txt = txt_encoder() if kind == "cvae" else None
    m = ConditionalConvVAE(latent_dim=latent) if kind == "cvae" else ConvVAE(latent_dim=latent)
    opt = torch.optim.Adam(m.parameters(), 1e-3)
    log = []
    drop_last = kind == "cvae"  # cell 25
    for ep in range(10):
        m.train(); s = n = 0
        for b in torch.randperm(len(Xtr)).split(256):
            if drop_last and len(b) < 256:
                continue
            xb = Xtr[b]
            if kind == "cvae":
                x_hat, mu, logvar, _ = m(xb, txt(Ytr[b]))
            else:
                x_hat, mu, logvar, _ = m(xb, deterministic=(kind == "ae"))
            loss, recon, kl = vae_loss(x_hat, xb, mu, logvar, kl_on=(kind != "ae"))
            opt.zero_grad(); loss.backward(); opt.step()
            s += loss.item(); n += 1
        log.append(s / n)
        print(f"{kind}{latent} epoch {ep+1} train loss {s/n:.3f} ({time.time()-t0:.0f}s)", flush=True)
    torch.save({"state": m.state_dict(), "loss": log}, os.path.join(CKPT, f"{kind}{latent}.pt"))


# ---- scoring -----------------------------------------------------------------
def load(kind, latent):
    m = ConditionalConvVAE(latent_dim=latent) if kind == "cvae" else ConvVAE(latent_dim=latent)
    m.load_state_dict(torch.load(os.path.join(CKPT, f"{kind}{latent}.pt"), weights_only=True)["state"])
    return m.eval()


THRESH = [0.5, 0.7, 0.9, 0.99]


def read(clf, imgs):
    with torch.no_grad():
        p = F.softmax(clf(imgs), 1)
    top, arg = p.max(1)
    return {"share": {str(t): round((top >= t).float().mean().item(), 4) for t in THRESH},
            "digits_at_0.9": np.bincount(arg[top >= 0.9].numpy(), minlength=10).tolist(),
            "median_top": round(top.median().item(), 4)}


TRAIN_REF = Xtr[:10000].flatten(1)


def nearest(imgs):
    d = torch.cdist(imgs.flatten(1), TRAIN_REF)
    return d.min(1).values


def q(v):
    v = v.numpy() if torch.is_tensor(v) else v
    return {k: round(float(np.percentile(v, p)), 3) for k, p in (("p10", 10), ("p50", 50), ("p90", 90))}


def slant(imgs):
    # second-moment slant of each image: mu11 / mu02 (x drift per row)
    x = imgs[:, 0]; H, W = x.shape[1:]
    yy, xx = torch.meshgrid(torch.arange(H, dtype=torch.float32), torch.arange(W, dtype=torch.float32), indexing="ij")
    m = x.sum((1, 2)) + 1e-8
    cx = (x * xx).sum((1, 2)) / m; cy = (x * yy).sum((1, 2)) / m
    mu11 = (x * (xx - cx[:, None, None]) * (yy - cy[:, None, None])).sum((1, 2)) / m
    mu02 = (x * (yy - cy[:, None, None]) ** 2).sum((1, 2)) / m
    return mu11 / mu02


def score():
    clf = Classifier(); clf.load_state_dict(torch.load(os.path.join(CKPT, "clf.pt"), weights_only=True)); clf.eval()
    txt = txt_encoder()
    out = {"instrument": {"test_images": read(clf, Xte), "test_nearest_train_L2": q(nearest(Xte[:2000]))}}
    with torch.no_grad():
        out["instrument"]["clf_test_acc"] = round((clf(Xte).argmax(1) == Yte).float().mean().item(), 4)
    for latent in (2, 16):
        for kind in ("ae", "vae", "cvae"):
            path = os.path.join(CKPT, f"{kind}{latent}.pt")
            if not os.path.exists(path):
                continue
            m = load(kind, latent); r = {"train_loss": [round(v, 3) for v in torch.load(path, weights_only=True)["loss"]]}
            torch.manual_seed(106)
            with torch.no_grad():
                xs = Xte[:2000]
                if kind == "cvae":
                    c = txt(Yte[:2000]); mu, _ = m.encoder(xs, c); rec = m.decoder(mu, c)
                else:
                    mu, _ = m.encoder(xs); rec = m.decoder(mu)
                r["codes"] = {"mean": [round(v, 3) for v in mu.mean(0).tolist()[:4]],
                              "sd": [round(v, 3) for v in mu.std(0).tolist()[:4]],
                              "norm": q(mu.norm(dim=1)),
                              "prior_norm": q(torch.randn(2000, latent).norm(dim=1))}
                r["reconstructions"] = read(clf, rec)
                r["recon_nearest_train_L2"] = q(nearest(rec))
                z = torch.randn(1000, latent)
                if kind == "cvae":
                    per = {}
                    for d in range(10):
                        img = m.decoder(z[:100], txt(torch.full((100,), d)))
                        with torch.no_grad():
                            p = F.softmax(clf(img), 1)
                        per[d] = {"read_as_c": round((p.argmax(1) == d).float().mean().item(), 3),
                                  "read_as_c_at_0.9": round(((p.argmax(1) == d) & (p.max(1).values >= 0.9)).float().mean().item(), 3)}
                    r["conditional"] = per
                    # does z carry style across labels? slant of 50 z's x 10 labels
                    zs = z[:50]
                    S = torch.stack([slant(m.decoder(zs, txt(torch.full((50,), d)))) for d in range(10)], 1)  # 50 x 10
                    S = S - S.mean(0, keepdim=True)  # remove each digit's own mean slant
                    total = S.var().item(); within_z = S.var(1).mean().item()
                    r["style_slant_share_explained_by_z"] = round(1 - within_z / total, 3)
                    gen = torch.cat([m.decoder(z[i*100:(i+1)*100], txt(torch.full((100,), i))) for i in range(10)])
                else:
                    gen = m.decoder(z)
                r["prior_draws"] = read(clf, gen)
                r["prior_nearest_train_L2"] = q(nearest(gen))
                if latent == 2:
                    g = torch.linspace(-3, 3, 21)
                    zz = torch.stack(torch.meshgrid(g, g, indexing="xy"), -1).reshape(-1, 2)
                    if kind == "cvae":
                        r["grid_read_as_c_label5"] = read(clf, m.decoder(zz, txt(torch.full((len(zz),), 5))))
                    else:
                        r["grid"] = read(clf, m.decoder(zz))
                    lo, hi = mu.min(0).values, mu.max(0).values
                    r["codes"]["range"] = [[round(lo[i].item(), 2), round(hi[i].item(), 2)] for i in range(2)]
            out[f"{kind}{latent}"] = r
            print(kind, latent, json.dumps(r["prior_draws"]["share"]), flush=True)
    json.dump(out, open(OUT, "w"), indent=1)
    print("wrote", OUT)


if __name__ == "__main__":
    if sys.argv[2] == "train":
        train(sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 0)
    else:
        score()
