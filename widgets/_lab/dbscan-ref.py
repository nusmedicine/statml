"""Write dbscan-ref.json — sklearn's own labels, core-sample indices,
silhouette (both readings) and ARI for the fixtures `dbscan-verify.mjs` wrote.

Like `kmeans-ref.py` and unlike `umap-ref.py`, this does NOT rebuild the stage
in numpy: it reads the points the JS wrote, so both sides run on byte-identical
input. DBSCAN has no initialisation and no seed, so with the same points and
the same two parameters the two engines must agree point for point.

    node   widgets/_lab/dbscan-verify.mjs --fixtures
    "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/venv/Scripts/python.exe" \
        "D:/.../widgets/_lab/dbscan-ref.py"
    node   widgets/_lab/dbscan-verify.mjs

TWO SILHOUETTES ARE RECORDED ON PURPOSE. `sil_with` is what cell 67 prints —
the raw labels, `-1` included, so every noise point is pooled into one
"cluster". `sil_only` drops the noise first. The gap between them is § THE
NOISE TRAP in the plan.

NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
"""
import json
import os

import numpy as np
import sklearn
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score, adjusted_rand_score

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "dbscan-fixtures.json")) as fh:
    fixtures = json.load(fh)

out = []
for c in fixtures:
    X = np.array(c["X"], float)
    y = np.array(c["y"], int)
    # algorithm="brute" so the neighbour query is the same exhaustive one the
    # JS runs. The tree algorithms return identical neighbourhoods, but the
    # point of this file is to remove every difference that is not the
    # algorithm, not to argue that a difference would not have mattered.
    db = DBSCAN(eps=c["eps"], min_samples=c["minPts"], algorithm="brute")
    labels = db.fit_predict(X)

    def sil(mask):
        sub = labels[mask]
        if len(set(sub.tolist())) < 2:
            return None
        return float(silhouette_score(X[mask], sub))

    allm = np.ones(len(X), bool)
    keep = labels != -1

    out.append({
        "name": c["name"],
        "labels": labels.tolist(),
        "core": sorted(db.core_sample_indices_.tolist()),
        "n_clusters": int(len(set(labels.tolist()) - {-1})),
        "n_noise": int((labels == -1).sum()),
        "sil_with": sil(allm),
        "sil_only": sil(keep),
        "ari": float(adjusted_rand_score(y, labels)),
    })
    print(f"{c['name']}  k={out[-1]['n_clusters']}  noise={out[-1]['n_noise']}")

with open(os.path.join(HERE, "dbscan-ref.json"), "w") as fh:
    json.dump({"sklearn": sklearn.__version__, "numpy": np.__version__,
               "cases": out}, fh)
print(f"\nwrote dbscan-ref.json — {len(out)} cases, sklearn {sklearn.__version__}")
