"""Slot 104 mock data: what each 10-1b model sees, outputs and embeds, for a few test digits.

Reads the checkpoints representation-measure.py saved (the masked model is
`masked_bottleneck`, the layers 10-1b's fixed MaskedPredictor has) and the maps
representation-umap.py wrote, and writes representation-mock-data.json
(untracked) for representation-mock.html.

  python -I widgets/_lab/representation-mockdata.py "<...>/_scratch/frontiers-data"
"""
import json, os, sys
import numpy as np, torch, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "representation-measure.py"), encoding="utf-8").read()
exec(src.split("# ---- training")[0])  # data, models, augment, random_mask
CKPT = os.path.join(sys.argv[1], "models-104")

makes = {"ae": lambda: AutoEncoderConv(1, 64, 16), "sparse_ae": lambda: AutoEncoderConv(1, 64, 16, sparse=True),
         "masked_bottleneck": lambda: MaskedBottleneck(1, 64, 64), "simclr": lambda: Encoder(1, 64, 128, 64)}


def pair(name):
    seed_all(42); u = makes[name]().eval()
    t = makes[name](); t.load_state_dict(torch.load(os.path.join(CKPT, name + ".pt"))); t.eval()
    return u, t


img = lambda x: np.round(x.squeeze().numpy() * 255).astype(int).flatten().tolist()
yte = Yte.numpy()
# one clear test image per digit, the first of each
picks = [int(np.where(yte == d)[0][0]) for d in range(10)]
out = {"picks": picks, "labels": [int(yte[i]) for i in picks], "x": [img(Xte[i]) for i in picks]}

with torch.no_grad():
    X = Xte[picks]
    for name in ("ae", "sparse_ae"):
        u, t = pair(name)
        out[name] = {"untrained": {"xhat": [img(v) for v in u(X)[0]], "z": np.round(u(X)[1].numpy(), 3).tolist()},
                     "trained": {"xhat": [img(v) for v in t(X)[0]], "z": np.round(t(X)[1].numpy(), 3).tolist()}}
    u, t = pair("masked_bottleneck")
    torch.manual_seed(7); xm, m = random_mask(X, 0.5)
    out["masked"] = {"mask": [img(v) for v in m], "x_masked": [img(v) for v in xm],
                     "untrained": {"xhat": [img(v) for v in u(xm)[0]]}, "trained": {"xhat": [img(v) for v in t(xm)[0]]}}
    u, t = pair("simclr")
    torch.manual_seed(11); v1 = augment(X); v2 = augment(X)
    sims = {}
    for k, m_ in (("untrained", u), ("trained", t)):
        p1 = F.normalize(m_(v1)[1], dim=1); p2 = F.normalize(m_(v2)[1], dim=1)
        sims[k] = np.round((p1 @ p2.T).numpy(), 3).tolist()  # 10 x 10: view 1 of digit i against view 2 of digit j
    out["simclr"] = {"v1": [img(v) for v in v1], "v2": [img(v) for v in v2], "sim": sims, "tau": 0.2}

meas = json.load(open(os.path.join(HERE, "representation-measure.json")))
umap_ = json.load(open(os.path.join(HERE, "representation-umap.json")))
out["metrics"] = meas["rows"]
out["map_labels"] = umap_["keep_labels"]
out["maps"] = {m["embedding"]: {"xy": [[round(a, 2), round(b, 2)] for a, b in m["xy"]],
                                "umap_knn5": m["umap_knn5"], "silhouette": m["silhouette"]} for m in umap_["maps"]}
json.dump(out, open(os.path.join(HERE, "representation-mock-data.json"), "w"), separators=(",", ":"))
print("wrote", os.path.getsize(os.path.join(HERE, "representation-mock-data.json")), "bytes; maps:", list(out["maps"]))
