"""Slot 106 round 2: the 2-D models at ten checkpoints, for a Train press.

Retrains vae-measure.py's 2-D AE, VAE and CVAE with the same seed and loop
(so the last checkpoint is the model measured), and at 0, 5, 20, 50, 100, 200
batches and epochs 1, 2, 5, 10 records, for the first 2,000 test images:
mu and logvar (the encoder's q(z|x)); the reconstruction term and the KL term
of the loss (KL split into its mean part 1/2 mu^2 and its spread part
1/2 (sigma^2 - 1 - ln sigma^2)); and the decoder's weights as float16, so
the mock can decode any point at any checkpoint.

  python -I widgets/_lab/vae-checkpoints.py "<...>/_scratch/frontiers-data" [ae vae cvae]
writes widgets/_lab/vae-checkpoints.json (untracked).
"""
import base64, importlib.util, json, os, sys, time
import numpy as np
import torch, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("vm", os.path.join(HERE, "vae-measure.py"))
ARGS = sys.argv[:]
sys.argv = [sys.argv[0], sys.argv[1], "none"]
vm = importlib.util.module_from_spec(spec); spec.loader.exec_module(vm)
OUT = os.path.join(HERE, "vae-checkpoints.json")
f16 = lambda t: base64.b64encode(t.detach().numpy().astype("<f2").tobytes()).decode()

N = 2000
xs, ys = vm.Xte[:N], vm.Yte[:N]
txt = vm.txt_encoder()
C = txt(torch.arange(10)).detach()
STEPS = [0, 5, 20, 50, 100, 200]
EPOCHS = [1, 2, 5, 10]


def snapshot(kind, m, label):
    with torch.no_grad():
        mu, lv = m.encoder(xs, txt(ys)) if kind == "cvae" else m.encoder(xs)
        g = torch.Generator().manual_seed(7)
        z = mu if kind == "ae" else mu + torch.exp(0.5 * lv) * torch.randn(mu.shape, generator=g)
        xh = m.decoder(z, txt(ys)) if kind == "cvae" else m.decoder(z)
        recon = F.mse_loss(xh, xs, reduction="sum").item() / N
        s2 = lv.exp()
        kl_mu = (0.5 * mu.pow(2)).sum(1); kl_sd = (0.5 * (s2 - 1 - lv)).sum(1)
        lin, d1, d2 = m.decoder.expand[0], m.decoder.deconv[0], m.decoder.deconv[2]
        if kind == "cvae":
            wz, b = lin.weight[:, :2], C @ lin.weight[:, 2:].T + lin.bias
        else:
            wz, b = lin.weight, lin.bias[None]
        return {"label": label,
                "mu": [round(v, 2) for v in mu.flatten().tolist()],
                "lv": [round(v, 2) for v in lv.flatten().tolist()] if kind != "ae" else None,
                "recon": round(recon, 2),
                "kl": round(float((kl_mu + kl_sd).mean()), 3) if kind != "ae" else None,
                "kl_mu": round(float(kl_mu.mean()), 3) if kind != "ae" else None,
                "kl_sd": round(float(kl_sd.mean()), 3) if kind != "ae" else None,
                "norm_med": round(float(mu.norm(dim=1).median()), 2),
                "dec": {"wz": f16(wz), "b": f16(b), "d1w": f16(d1.weight), "d1b": f16(d1.bias), "d2w": f16(d2.weight), "d2b": f16(d2.bias)}}


def run(kind):
    vm.seed_all(42)
    if kind == "cvae":
        vm.txt_encoder()   # vae-measure.py builds it after seeding, which draws its init from the same RNG
    m = vm.ConditionalConvVAE(latent_dim=2) if kind == "cvae" else vm.ConvVAE(latent_dim=2)
    opt = torch.optim.Adam(m.parameters(), 1e-3)
    m.eval(); out = [snapshot(kind, m, "untrained")]; m.train()
    step = 0
    for ep in range(10):
        for b in torch.randperm(len(vm.Xtr)).split(256):
            if kind == "cvae" and len(b) < 256:
                continue
            xb = vm.Xtr[b]
            if kind == "cvae":
                x_hat, mu, lv, _ = m(xb, txt(vm.Ytr[b]))
            else:
                x_hat, mu, lv, _ = m(xb, deterministic=(kind == "ae"))
            loss, _, _ = vm.vae_loss(x_hat, xb, mu, lv, kl_on=(kind != "ae"))
            opt.zero_grad(); loss.backward(); opt.step()
            step += 1
            if step in STEPS[1:]:
                m.eval(); out.append(snapshot(kind, m, f"{step} batches")); m.train()
        if ep + 1 in EPOCHS:
            m.eval(); out.append(snapshot(kind, m, f"epoch {ep + 1}")); m.train()
    # the last checkpoint must be the model vae-measure.py saved
    ref = vm.load(kind, 2)
    same = all(torch.equal(a, b) for a, b in zip(m.state_dict().values(), ref.state_dict().values()))
    print(kind, "matches the measured model:", same, [(c["label"], c["recon"], c["kl"], c["norm_med"]) for c in out], flush=True)
    return out


t0 = time.time()
KINDS = ARGS[2:] if len(ARGS) > 2 else ["ae", "vae", "cvae"]
res = json.load(open(OUT)) if os.path.exists(OUT) and len(KINDS) < 3 else {}
res.update({k: run(k) for k in KINDS})
res["digits"] = ys.tolist()
json.dump(res, open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB", f"{time.time() - t0:.0f}s")
