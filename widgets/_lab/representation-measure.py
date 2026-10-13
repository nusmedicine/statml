"""Slot 104 `representation`: how well does each 10-1 embedding separate digits?

10-1 trains four models on MNIST and shows each embedding only as a UMAP.
This trains the same four with the notebook's settings (seed 42, Adam 1e-3,
10 epochs, batch 128) and scores each embedding of the 10,000 test images by
a 5-nearest-neighbour vote and a linear probe, both fitted on the embeddings
of 10,000 training images. The controls are raw pixels and an UNTRAINED copy
of each network: a conv net at its random initialisation already separates
digits well, so a score means little until the untrained copy is beside it.

The masked predictor's `z_vec` (cell 55) is never in the loss: the decoder
reads the feature map h, so `to_embed` keeps its random weights. It is scored
as the notebook uses it, and h (2x2 average-pooled) beside it.

SimCLR's augmentation (cell 74: RandomCrop(28, padding=4), then
RandomAffine(15 deg, translate 0.1, scale 0.9-1.1)) is reimplemented with
grid_sample, nearest, since torchvision is not installed; the integer
translations torchvision draws are drawn the same way.

Data and checkpoints live outside the repo (Dropbox):
  python -I widgets/_lab/representation-measure.py "<...>/_scratch/frontiers-data"
writes widgets/_lab/representation-measure.json (untracked).
"""
import gzip, json, math, os, random, sys, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler

DATA = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "representation-measure.json")
CKPT = os.path.join(DATA, "models-104")
os.makedirs(CKPT, exist_ok=True)
torch.set_num_threads(min(16, os.cpu_count()))
DEVICE = torch.device("cpu")


def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f:
        b = f.read()
    if "images" in name:
        n, r, c = np.frombuffer(b, ">i4", 3, 4)
        return np.frombuffer(b, np.uint8, offset=16).reshape(n, 1, r, c)
    return np.frombuffer(b, np.uint8, offset=8)


Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255.0  # ToTensor
Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255.0
Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)


def seed_all(s=42):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def batches(n, bs=128, shuffle=True):
    order = torch.randperm(n) if shuffle else torch.arange(n)
    for i in range(0, n, bs):
        yield order[i:i + bs]


# ---- the notebook's models, verbatim ----------------------------------------
class EncoderConv(nn.Module):  # cell 10 (sparse=False) and cell 32 (sparse=True)
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=128, sparse=False):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, latent_ch // 2, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(latent_ch // 2, latent_ch, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.flatten = nn.Flatten(start_dim=1)
        lin = nn.Linear(latent_ch * 7 * 7, embed_dim)
        self.to_embed = nn.Sequential(lin, nn.ReLU()) if sparse else lin

    def forward(self, x):
        z_map = self.conv(x)
        return z_map, self.to_embed(self.flatten(z_map))


class DecoderConv(nn.Module):
    def __init__(self, out_ch=1, latent_ch=64):
        super().__init__()
        self.deconv = nn.Sequential(
            nn.ConvTranspose2d(latent_ch, latent_ch // 2, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(latent_ch // 2, out_ch, 4, stride=2, padding=1), nn.Sigmoid())

    def forward(self, z_map):
        return self.deconv(z_map)


class AutoEncoderConv(nn.Module):
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=128, sparse=False):
        super().__init__()
        self.encoder = EncoderConv(in_ch, latent_ch, embed_dim, sparse)
        self.expand = nn.Linear(embed_dim, latent_ch * 7 * 7)
        self.unflatten = nn.Unflatten(1, (latent_ch, 7, 7))
        self.decoder = DecoderConv(in_ch, latent_ch)

    def forward(self, x):
        _, z_vec = self.encoder(x)
        return self.decoder(self.unflatten(self.expand(z_vec))), z_vec


class MaskedPredictor(nn.Module):  # cell 55
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=64):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(in_ch, latent_ch // 2, 3, padding=1), nn.ReLU(),
            nn.Conv2d(latent_ch // 2, latent_ch, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(latent_ch, latent_ch, 3, padding=1), nn.ReLU())
        self.flatten = nn.Flatten(start_dim=1)
        self.to_embed = nn.Linear(latent_ch * 14 * 14, embed_dim)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(latent_ch, latent_ch // 2, 2, stride=2), nn.ReLU(),
            nn.Conv2d(latent_ch // 2, 1, 3, padding=1), nn.Sigmoid())

    def forward(self, x_masked):
        h = self.encoder(x_masked)
        return self.decoder(h), self.to_embed(self.flatten(h))


class Encoder(nn.Module):  # cell 78, SimCLR
    def __init__(self, in_ch=1, feat_ch=64, embed_dim=128, proj_dim=64):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv2d(in_ch, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, feat_ch, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(feat_ch, feat_ch, 3, padding=1), nn.ReLU())
        self.flatten = nn.Flatten(1)
        self.embed_fc = nn.Linear(feat_ch * 14 * 14, embed_dim)
        self.proj_head = nn.Sequential(nn.Linear(embed_dim, embed_dim), nn.ReLU(), nn.Linear(embed_dim, proj_dim))

    def forward(self, x):
        z = self.embed_fc(self.flatten(self.backbone(x)))
        return z, self.proj_head(z)


class MaskedBottleneck(MaskedPredictor):
    """Not in the notebook: the fix, decoding from z_vec so to_embed is trained."""
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=64):
        super().__init__(in_ch, latent_ch, embed_dim)
        self.expand = nn.Linear(embed_dim, latent_ch * 14 * 14)
        self.unflatten = nn.Unflatten(1, (latent_ch, 14, 14))

    def forward(self, x_masked):
        z_vec = self.to_embed(self.flatten(self.encoder(x_masked)))
        return self.decoder(self.unflatten(self.expand(z_vec))), z_vec


class MaskedPredictorB(nn.Module):
    """10-1b cell 55 verbatim (2026-10-13): conv -> to_embed -> expand -> deconv."""
    def __init__(self, in_ch=1, latent_ch=64, embed_dim=64):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, latent_ch // 2, kernel_size=3, padding=1), nn.ReLU(),
            nn.Conv2d(latent_ch // 2, latent_ch, kernel_size=3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(latent_ch, latent_ch, kernel_size=3, padding=1), nn.ReLU())
        self.to_embed = nn.Sequential(nn.Flatten(start_dim=1), nn.Linear(latent_ch * 14 * 14, embed_dim))
        self.expand = nn.Sequential(nn.Linear(embed_dim, latent_ch * 14 * 14),
                                    nn.Unflatten(dim=1, unflattened_size=(latent_ch, 14, 14)))
        self.deconv = nn.Sequential(
            nn.ConvTranspose2d(latent_ch, latent_ch // 2, kernel_size=2, stride=2), nn.ReLU(),
            nn.Conv2d(latent_ch // 2, 1, kernel_size=3, padding=1), nn.Sigmoid())

    def forward(self, x_masked):
        z_vec = self.to_embed(self.conv(x_masked))
        return self.deconv(self.expand(z_vec)), z_vec


def random_mask(x, mask_ratio=0.3):  # cell 61
    mask = (torch.rand_like(x) < mask_ratio).float()
    return x * (1 - mask), mask


def info_nce_loss(p1, p2, tau=0.1):  # cell 84
    p1 = F.normalize(p1, dim=1); p2 = F.normalize(p2, dim=1)
    sim = torch.mm(p1, p2.t()) / tau
    labels = torch.arange(sim.size(0))
    return 0.5 * (F.cross_entropy(sim, labels) + F.cross_entropy(sim.t(), labels))


def augment(x):
    """RandomCrop(28, padding=4) then RandomAffine(15, (0.1, 0.1), (0.9, 1.1)), nearest."""
    B = x.size(0)
    eye = torch.zeros(B, 2, 3); eye[:, 0, 0] = 1; eye[:, 1, 1] = 1
    # crop with padding 4 = an integer shift in [-4, 4] filled with zeros
    t = torch.randint(-4, 5, (B, 2)).float() * 2 / 28
    th = eye.clone(); th[:, :, 2] = t
    x = F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), mode="nearest", align_corners=False)
    ang = (torch.rand(B) * 30 - 15) * math.pi / 180
    sc = 0.9 + torch.rand(B) * 0.2
    tr = torch.round((torch.rand(B, 2) * 2 - 1) * 0.1 * 28) * 2 / 28
    c, s = torch.cos(ang) / sc, torch.sin(ang) / sc
    th = torch.stack([torch.stack([c, s], 1), torch.stack([-s, c], 1)], 1)  # (B, 2, 2) inverse map
    off = -(th @ tr.unsqueeze(2))
    th = torch.cat([th, off], 2)
    return F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), mode="nearest", align_corners=False)


# ---- training, cached as checkpoints --------------------------------------
def train(name, make, step, epochs=10):
    path = os.path.join(CKPT, name + ".pt")
    seed_all(42)
    model = make()
    if os.path.exists(path):
        model.load_state_dict(torch.load(path))
        return model, json.load(open(path + ".json"))
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    log = []
    for ep in range(epochs):
        model.train(); s = 0.0; n = 0; t0 = time.time()
        for b in batches(len(Xtr)):
            loss = step(model, b)
            opt.zero_grad(); loss.backward(); opt.step()
            s += loss.item(); n += 1
        log.append({"epoch": ep + 1, "train_loss": s / n, "sec": round(time.time() - t0, 1)})
        print(name, log[-1], flush=True)
    torch.save(model.state_dict(), path)
    json.dump(log, open(path + ".json", "w"))
    return model, log


def ae_step(model, b):
    xb = Xtr[b]; xhat, _ = model(xb)
    return F.mse_loss(xhat, xb)


def sparse_step(model, b):
    xb = Xtr[b]; xhat, z = model(xb)
    return F.mse_loss(xhat, xb) + 1e-3 * z.abs().mean()


def masked_step(model, b):
    xb = Xtr[b]; xm, m = random_mask(xb, 0.5)
    xhat, _ = model(xm)
    return F.mse_loss(xhat * m, xb * m)


def simclr_step(model, b):
    xb = Xtr[b]
    _, p1 = model(augment(xb)); _, p2 = model(augment(xb))
    return info_nce_loss(p1, p2, tau=0.2)


# ---- scoring ---------------------------------------------------------------
gen = torch.Generator().manual_seed(0)
probe_idx = torch.randperm(len(Xtr), generator=gen)[:10000]


@torch.no_grad()
def embed(fn, X):
    return torch.cat([fn(X[i:i + 500]) for i in range(0, len(X), 500)]).numpy()


def score(fn):
    Ztr, Zte = embed(fn, Xtr[probe_idx]), embed(fn, Xte)
    ytr, yte = Ytr[probe_idx].numpy(), Yte.numpy()
    knn = KNeighborsClassifier(5, metric="cosine").fit(Ztr, ytr).score(Zte, yte)
    sc = StandardScaler().fit(Ztr)
    lin = LogisticRegression(max_iter=3000).fit(sc.transform(Ztr), ytr).score(sc.transform(Zte), yte)
    return {"dim": int(Ztr.shape[1]), "knn5": round(knn, 4), "linear": round(lin, 4)}


@torch.no_grad()
def recon_mse(model, masked=False):
    seed_all(7); s = 0.0; n = 0
    for i in range(0, len(Xte), 128):
        xb = Xte[i:i + 128]
        if masked:
            xm, m = random_mask(xb, 0.5); xhat, _ = model(xm); s += F.mse_loss(xhat * m, xb * m).item()
        else:
            xhat, _ = model(xb); s += F.mse_loss(xhat, xb).item()
        n += 1
    return round(s / n, 5)


res = {"note": "kNN (k=5, cosine) and logistic regression on standardized embeddings, fitted on 10,000 training images (seed 0), scored on the 10,000 test images",
       "rows": []}


def row(label, model_name, fn, **extra):
    r = {"embedding": label, "model": model_name, **score(fn), **extra}
    print(r, flush=True); res["rows"].append(r)
    json.dump(res, open(OUT, "w"), indent=1)


row("raw pixels", "none", lambda x: x.flatten(1))

for name, make, step, masked in [
        ("ae", lambda: AutoEncoderConv(1, 64, 16), ae_step, False),
        ("sparse_ae", lambda: AutoEncoderConv(1, 64, 16, sparse=True), sparse_step, False),
        ("masked", lambda: MaskedPredictor(1, 64, 64), masked_step, True),
        ("simclr", lambda: Encoder(1, 64, 128, 64), simclr_step, None),
        ("masked_bottleneck", lambda: MaskedBottleneck(1, 64, 64), masked_step, True),
        ("masked_b", lambda: MaskedPredictorB(1, 64, 64), masked_step, True)]:
    seed_all(42); untrained = make().eval()
    model, log = train(name, make, step)
    model.eval()
    extra = {"final_train_loss": round(log[-1]["train_loss"], 5), "sec_per_epoch": log[-1]["sec"]}
    if masked is not None:
        extra["test_recon_mse"] = recon_mse(model, masked)
    if name in ("ae", "sparse_ae"):
        z = embed(lambda x: model(x)[1], Xte)
        extra["frac_zero"] = round(float((np.abs(z) < 1e-6).mean()), 4)
        extra["mean_abs"] = round(float(np.abs(z).mean()), 4)
    if name == "simclr":
        row("z (embed_fc), untrained", name, lambda x: untrained(x)[0])
        row("z (embed_fc), trained", name, lambda x: model(x)[0], **extra)
        row("p (projection), trained", name, lambda x: model(x)[1])
    elif name == "masked":
        extra["to_embed_max_change"] = float((model.to_embed.weight - untrained.to_embed.weight).abs().max())
        row("z_vec, untrained", name, lambda x: untrained(x)[1])
        row("z_vec, trained (to_embed never in the loss)", name, lambda x: model(x)[1], **extra)
        pool = lambda m: (lambda x: F.avg_pool2d(m.encoder(x), 2).flatten(1))
        row("h 2x2-pooled, untrained", name, pool(untrained))
        row("h 2x2-pooled, trained", name, pool(model))
    else:
        row("z_vec, untrained", name, lambda x: untrained(x)[1])
        row("z_vec, trained", name, lambda x: model(x)[1], **extra)

print("wrote", OUT)
