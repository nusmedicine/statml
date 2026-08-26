"""Write kmeans-ref.json — sklearn's own labels, inertia, silhouette and ARI
for the fixtures `kmeans-verify.mjs` wrote, so the JS engine is checked against
the library rather than against itself.

Unlike `umap-ref.py` this does NOT rebuild the stage in numpy: it reads the
points and the initial centroids the JS wrote, so both sides run Lloyd from
byte-identical input and the comparison is exact rather than "comparable in
kind". Run it with the venv described in HANDOVER's *Working on Windows*:

    node   widgets/_lab/kmeans-verify.mjs --fixtures
    "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/venv/Scripts/python.exe" \
        "D:/.../widgets/_lab/kmeans-ref.py"
    node   widgets/_lab/kmeans-verify.mjs

NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
"""
import json
import os

import numpy as np
import sklearn
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "kmeans-fixtures.json")) as fh:
    fixtures = json.load(fh)

out = []
for c in fixtures:
    X = np.array(c["X"], float)
    C0 = np.array(c["C0"], float)
    # tol=0 so it stops only at a fixed point. sklearn's default tol=1e-4 stops
    # on a small centre shift, which is a WEAKER rule than cell 52's "until
    # assignments no longer change" and would let the two engines disagree for
    # a reason that is not a bug in either.
    km = KMeans(n_clusters=c["K"], init=C0, n_init=1, algorithm="lloyd",
                max_iter=300, tol=0.0)
    labels = km.fit_predict(X)
    out.append({
        "name": c["name"],
        "labels": [int(v) for v in labels],
        "centres": km.cluster_centers_.tolist(),
        "inertia": float(km.inertia_),
        "iters": int(km.n_iter_),
        "silhouette": float(silhouette_score(X, labels)),
        "ari": float(adjusted_rand_score(np.array(c["y"]), labels)),
    })
    print(f"{c['name']}  inertia {km.inertia_:.6f}  iters {km.n_iter_}")

# What the notebook's own call actually runs. sklearn's `n_init` default became
# "auto" in 1.4, which resolves to 1 for k-means++ and 10 for random init — so
# the lesson's KMeans(n_clusters=2, random_state=42) gets ONE start, and the
# limitations column's "sensitive to initial centroid placement" is live in the
# lesson's own code rather than defended against by the library.
probe = KMeans(n_clusters=2, random_state=42).fit(np.array(fixtures[0]["X"], float))
n_init = getattr(probe, "_n_init", "unknown")

with open(os.path.join(HERE, "kmeans-ref.json"), "w") as fh:
    json.dump({"sklearn": sklearn.__version__, "n_init_default": n_init, "cases": out}, fh)
print(f"\nwrote kmeans-ref.json — sklearn {sklearn.__version__}, n_init resolves to {n_init}")
