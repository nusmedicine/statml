"""Slot 104, round 2: the four 10-1b models during training, for an animated Train.

Retrains each model exactly as representation-measure.py does (same seed, same
batches, same masks and augmentations, so the last checkpoint equals the saved
model; asserted below) and records, at each checkpoint:
  the page's loss on 2,000 test digits (a fixed mask / fixed views), for the curve
  the ten example digits' outputs (reconstruction, code, prediction)
  the 2,000 map digits' embeddings, for an aligned UMAP across checkpoints
  Sparse and Autoencoder: the codes of 50 test digits (5 of each), for a unit grid
  Contrastive: the view-similarity matrix of the ten examples' fixed views
and the training loss of every batch. Views are drawn with their parameters
recorded (shift, angle, scale), from the notebook's augmentation.

  python -I widgets/_lab/representation-checkpoints.py "<...>/_scratch/frontiers-data"
writes <data>/models-104/checkpoints-<model>.pt (large) and nothing in the repo.
"""
import json, math, os, sys, time
import numpy as np, torch, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "representation-measure.py"), encoding="utf-8").read()
exec(src.split("# ---- scoring")[0])          # data, models, augment, masks, train steps
CK = os.path.join(sys.argv[1], "models-104")
STEPS = [0, 5, 20, 50, 100, 200, 469, 938, 2345, 4690]   # batches done; 469 a batch is one epoch

yte = Yte.numpy()
picks = [int(np.where(yte == d)[0][0]) for d in range(10)]
grid_idx = [int(i) for d in range(10) for i in np.where(yte == d)[0][1:6]]   # 5 per digit, after the pick
keep = np.random.default_rng(0).permutation(10000)[:2000]                  # the maps' 2,000 (as representation-umap.py)
probe = np.random.default_rng(1).permutation(10000)[:2000]                 # the loss curve's 2,000


def augment_params(x, g):
    """augment() with its draws recorded: RandomCrop(28, padding=4) then RandomAffine(15, (0.1, 0.1), (0.9, 1.1))."""
    B = x.size(0)
    eye = torch.zeros(B, 2, 3); eye[:, 0, 0] = 1; eye[:, 1, 1] = 1
    crop = torch.randint(-4, 5, (B, 2), generator=g)
    th = eye.clone(); th[:, :, 2] = crop.float() * 2 / 28
    x1 = F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), mode="nearest", align_corners=False)
    ang = torch.rand(B, generator=g) * 30 - 15
    sc = 0.9 + torch.rand(B, generator=g) * 0.2
    tr = torch.round((torch.rand(B, 2, generator=g) * 2 - 1) * 0.1 * 28)
    a = ang * math.pi / 180
    c, s = torch.cos(a) / sc, torch.sin(a) / sc
    th2 = torch.stack([torch.stack([c, s], 1), torch.stack([-s, c], 1)], 1)
    th2 = torch.cat([th2, -(th2 @ (tr * 2 / 28).unsqueeze(2))], 2)
    x2 = F.grid_sample(x1, F.affine_grid(th2, x.shape, align_corners=False), mode="nearest", align_corners=False)
    # grid_sample's theta maps output to input, so the image moves by -crop then by +tr (in pixels, x right, y down)
    params = [{"crop": [-int(crop[i, 0]), -int(crop[i, 1])], "angle": round(float(ang[i]), 1), "scale": round(float(sc[i]), 2),
               "translate": [int(tr[i, 0]), int(tr[i, 1])]} for i in range(B)]
    return x2, params


g = torch.Generator().manual_seed(2026)
V1, P1 = augment_params(Xte[picks], g)
V2, P2 = augment_params(Xte[picks], g)
gp = torch.Generator().manual_seed(4)
PV1, _ = augment_params(Xte[probe], gp)
PV2, _ = augment_params(Xte[probe], gp)
torch.manual_seed(70); _, PMASK = random_mask(Xte[probe], 0.5)
torch.manual_seed(7); XM, MASK = random_mask(Xte[picks], 0.5)

MODELS = [("ae", lambda: AutoEncoderConv(1, 64, 16), ae_step, "recon"),
          ("sparse_ae", lambda: AutoEncoderConv(1, 64, 16, sparse=True), sparse_step, "recon"),
          ("masked_b", lambda: MaskedPredictorB(1, 64, 64), masked_step, "masked"),
          ("simclr", lambda: Encoder(1, 64, 128, 64), simclr_step, "contrast")]


@torch.no_grad()
def snapshot(model, kind):
    model.eval(); out = {}
    if kind == "recon":
        xh, z = model(Xte[picks]); out["xhat"] = xh.numpy(); out["z"] = z.numpy()
        out["grid"] = model(Xte[grid_idx])[1].numpy()
        xb = Xte[probe]; out["loss"] = F.mse_loss(model(xb)[0], xb).item()
        out["emb"] = torch.cat([model(Xte[keep[i:i + 500]])[1] for i in range(0, 2000, 500)]).numpy()
    elif kind == "masked":
        out["xhat"] = model(XM)[0].numpy()
        xb = Xte[probe]; xh = model(xb * (1 - PMASK))[0]
        out["loss"] = (((xh - xb) ** 2) * PMASK).sum().item() / PMASK.sum().item()
        out["emb"] = torch.cat([model(Xte[keep[i:i + 500]])[1] for i in range(0, 2000, 500)]).numpy()
    else:
        p1 = F.normalize(model(V1)[1], dim=1); p2 = F.normalize(model(V2)[1], dim=1)
        out["sim"] = (p1 @ p2.T).numpy()
        ls = []
        for i in range(0, 2000 - 127, 128):
            a = model(PV1[i:i + 128])[1]; b = model(PV2[i:i + 128])[1]
            ls.append(info_nce_loss(a, b, tau=0.2).item())
        out["loss"] = float(np.mean(ls))
        out["emb"] = torch.cat([model(Xte[keep[i:i + 500]])[0] for i in range(0, 2000, 500)]).numpy()
    model.train()
    return out


for name, make, step, kind in MODELS:
    path = os.path.join(CK, f"checkpoints-{name}.pt")
    if os.path.exists(path): print("have", path); continue
    seed_all(42); model = make(); opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    snaps = {0: snapshot(model, kind)}; batch_loss = []; done = 0; t0 = time.time()
    for ep in range(10):
        model.train()
        for b in batches(len(Xtr)):
            loss = step(model, b)
            opt.zero_grad(); loss.backward(); opt.step()
            batch_loss.append(loss.item()); done += 1
            if done in STEPS: snaps[done] = snapshot(model, kind)
        print(name, "epoch", ep + 1, round(time.time() - t0), "s", flush=True)
    ref = make(); ref.load_state_dict(torch.load(os.path.join(CK, name + ".pt")))
    same = all(torch.equal(a, b) for a, b in zip(model.state_dict().values(), ref.state_dict().values()))
    print(name, "last checkpoint equals the saved model:", same, flush=True)
    torch.save({"steps": STEPS, "snaps": snaps, "batch_loss": batch_loss, "same": same,
                "views": {"p1": P1, "p2": P2, "v1": V1.numpy(), "v2": V2.numpy()},
                "mask": MASK.numpy(), "grid_idx": grid_idx, "grid_labels": yte[grid_idx].tolist()}, path)
print("done")
