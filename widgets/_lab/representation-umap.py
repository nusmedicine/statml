"""Slot 104: the UMAP each 10-1 section ends on, untrained against trained.

Loads the checkpoints representation-measure.py saved and runs the notebook's
UMAP (n_neighbors=15, min_dist=0.1, cosine, random_state=42) on the 10,000
test embeddings. Scores each 2-D map by 5-NN accuracy within the map (5-fold)
and the silhouette by digit, and keeps 2,000 points of each map for a mock.

  python -I widgets/_lab/representation-umap.py "<...>/_scratch/frontiers-data"
writes widgets/_lab/representation-umap.json (untracked).
"""
import json, os, sys
import numpy as np, torch, torch.nn.functional as F
import umap
from sklearn.model_selection import cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import silhouette_score

src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "representation-measure.py"), encoding="utf-8").read()
exec(src.split("# ---- training")[0])  # data, models, augment
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "representation-umap.json")
CKPT = os.path.join(sys.argv[1], "models-104")

makes = {"ae": lambda: AutoEncoderConv(1, 64, 16), "sparse_ae": lambda: AutoEncoderConv(1, 64, 16, sparse=True),
         "masked": lambda: MaskedPredictor(1, 64, 64), "masked_bottleneck": lambda: MaskedBottleneck(1, 64, 64), "masked_b": lambda: MaskedPredictorB(1, 64, 64),
         "simclr": lambda: Encoder(1, 64, 128, 64)}
take = {"simclr": lambda m, x: m(x)[0]}
keep = np.random.default_rng(0).permutation(10000)[:2000]
yte = Yte.numpy()
res = {"keep_labels": yte[keep].tolist(), "maps": []}


@torch.no_grad()
def emb(fn):
    return torch.cat([fn(Xte[i:i + 500]) for i in range(0, 10000, 500)]).numpy()


def add(label, Z):
    U = umap.UMAP(n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42).fit_transform(Z)
    knn = cross_val_score(KNeighborsClassifier(5), U, yte, cv=5).mean()
    sil = silhouette_score(U, yte, sample_size=5000, random_state=0)
    r = {"embedding": label, "umap_knn5": round(float(knn), 4), "silhouette": round(float(sil), 4)}
    print(r, flush=True)
    r["xy"] = np.round(U[keep], 3).tolist()
    res["maps"].append(r)
    json.dump(res, open(OUT, "w"))


add("raw pixels", Xte.flatten(1).numpy())
for name, make in makes.items():
    f = take.get(name, lambda m, x: m(x)[1])
    seed_all(42); m0 = make().eval()
    add(name + " untrained", emb(lambda x: f(m0, x)))
    m = make(); m.load_state_dict(torch.load(os.path.join(CKPT, name + ".pt"))); m.eval()
    add(name + " trained", emb(lambda x: f(m, x)))
print("wrote", OUT)
