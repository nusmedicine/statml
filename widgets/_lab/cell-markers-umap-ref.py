"""Write cell-markers-umap-ref.json: umap-learn 0.5.12 on slot 81's stage.

`cell-markers-umap-verify.mjs` writes the stage's 20 PCs to
`cell-markers-umap-pcs.json` (so both sides read the same numbers), and this
runs the library on them: the fuzzy graph's weights, and the layout at both
of the library's starts (spectral, its default, and pca, the JS start) and
two epoch counts, with the same three measures the JS side computes.

    python widgets/_lab/cell-markers-umap-ref.py

NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
"""
import json, os, time, warnings
import numpy as np
warnings.filterwarnings("ignore")
import umap
from umap.umap_ import fuzzy_simplicial_set
from sklearn.neighbors import NearestNeighbors

HERE = os.path.dirname(os.path.abspath(__file__))
src = json.load(open(os.path.join(HERE, "cell-markers-umap-pcs.json")))
out = {"version": umap.__version__, "cases": []}


def measures(Y, types, z):
    n = len(Y)
    nn = NearestNeighbors(n_neighbors=6).fit(Y)
    _, idx = nn.kneighbors(Y)
    purity = float(np.mean([np.mean(types[idx[i, 1:]] == types[i]) for i in range(n)]))
    hep = np.where(types == 0)[0]
    r = max(abs(np.corrcoef(z[hep], Y[hep, 0])[0, 1]), abs(np.corrcoef(z[hep], Y[hep, 1])[0, 1]))
    return purity, float(r)


for case in src["cases"]:
    P = np.array(case["pcs"], dtype=np.float64)
    types = np.array(case["types"])
    z = np.array([v if v is not None else np.nan for v in case["z"]], dtype=np.float64)
    G, _, _ = fuzzy_simplicial_set(P, n_neighbors=15, random_state=np.random.RandomState(0), metric="euclidean")
    G = G.tocoo()
    rec = {"n": len(P), "graph": [[int(i), int(j), float(v)] for i, j, v in zip(G.row, G.col, G.data)], "layouts": []}
    for init in ["spectral", "pca"]:
        for epochs in [200, 500]:
            t = time.time()
            Y = umap.UMAP(n_neighbors=15, min_dist=0.1, n_epochs=epochs, init=init, random_state=1).fit_transform(P)
            ms = (time.time() - t) * 1000
            purity, r = measures(Y, types, z)
            rec["layouts"].append({"init": init, "epochs": epochs, "purity": purity, "hepR": r, "ms": ms})
            print(f"  n {len(P)}  {init:8s} {epochs} epochs: 5-NN type purity {purity:.2f}, hepatocyte |r| {r:.2f}, {ms:.0f} ms")
    out["cases"].append(rec)

json.dump(out, open(os.path.join(HERE, "cell-markers-umap-ref.json"), "w"))
print("wrote cell-markers-umap-ref.json")
