"""Write umap-ref.json — umap-learn's own rho, sigma, mu and (a, b), so
`umap-verify.mjs` can check the JS engine against the library rather than
against itself.

The pattern is `tsne-sklearn-ref.py`'s, which is what proved widget 21's
engine. Run it with the venv described in HANDOVER's *Working on Windows*:

    cd "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch"
    ./venv/Scripts/python.exe "D:/.../widgets/_lab/umap-ref.py"

NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
"""
import json, os, warnings
import numpy as np
warnings.filterwarnings("ignore")
from sklearn.neighbors import NearestNeighbors
from umap.umap_ import fuzzy_simplicial_set, smooth_knn_dist, find_ab_params
import umap

HERE = os.path.dirname(os.path.abspath(__file__))
R, SIGMA, PER = 2.0, 0.62, 12
CENTRES = np.array([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], float)
CENTRES = CENTRES / np.linalg.norm(CENTRES, axis=1, keepdims=True) * R


def stage(seed, per=PER, g=4):
    """The same stage widget 21 uses, and the one every catalogue number for
    UMAP was measured on: `g` centres on a sphere of radius 2, `per` samples
    scattered by 0.62 around each."""
    rng = np.random.default_rng(seed)
    X = np.vstack([CENTRES[i] + rng.normal(0, SIGMA, (per, 3)) for i in range(g)])
    return X, np.repeat(np.arange(g), per)


cases = []
for seed, k, per, g in [(1, 15, 12, 4), (2, 5, 12, 4), (3, 3, 12, 4), (4, 30, 12, 4), (5, 3, 2, 4)]:
    X, y = stage(seed, per, g)
    nn = NearestNeighbors(n_neighbors=k).fit(X)
    d, i = nn.kneighbors(X)
    sig, rho = smooth_knn_dist(d, float(k), local_connectivity=1.0)
    graph, _, _ = fuzzy_simplicial_set(
        X, k, np.random.RandomState(42), "euclidean", knn_indices=i, knn_dists=d)
    cases.append({
        "seed": seed, "k": k, "per": per, "groups": g,
        "X": X.tolist(), "labels": y.tolist(),
        "rho": rho.tolist(), "sigma": sig.tolist(),
        "mu": np.asarray(graph.todense()).tolist(),
    })

ab = [{"spread": 1.0, "min_dist": md,
       "a": float(find_ab_params(1.0, md)[0]), "b": float(find_ab_params(1.0, md)[1])}
      for md in [0.0, 0.01, 0.05, 0.1, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 0.9, 0.99]]

out = {
    "umap_learn": umap.__version__,
    "numpy": np.__version__,
    "note": "rho/sigma from smooth_knn_dist, mu from fuzzy_simplicial_set "
            "(set_op_mix_ratio 1, local_connectivity 1); a/b from find_ab_params.",
    "ab": ab,
    "cases": cases,
}
path = os.path.join(HERE, "umap-ref.json")
with open(path, "w") as f:
    json.dump(out, f)
print(f"wrote {path}  ({os.path.getsize(path)/1e6:.1f} MB)")
print(f"umap-learn {umap.__version__}, numpy {np.__version__}, {len(cases)} cases, {len(ab)} a/b rows")
