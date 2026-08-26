"""Reference table for the t-SNE engine, from scikit-learn itself.

NOT DEPLOYED and not run by `npm run check`. This is the check the catalogue
records as owed: the engine's internal checks (gradient against a central
difference, bisection against its target perplexity) catch implementation bugs
but cannot catch a wrong READING of the algorithm. Only the library can.

It writes tsne-sklearn-ref.json, which tsne-verify.mjs then compares the JS
engine against. Two things are compared and they are different in kind:

  * P, the high-dimensional affinities. This is a deterministic function of the
    data and the perplexity — no seed, no descent — so it must agree to
    floating-point noise. sklearn exposes it via _joint_probabilities.
  * the embedding. This CANNOT be compared coordinate for coordinate: sklearn
    seeds its own RNG differently, and t-SNE has no unique answer anyway. What
    must agree is what the picture is FOR — which neighbours survive, and how
    well the true groups separate.

Run with the Python installed under %LOCALAPPDATA%\\Programs\\Python\\Python312.
"""
import json
import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.manifold import TSNE
from sklearn.manifold._t_sne import _joint_probabilities, _kl_divergence
import sklearn


def stage(groups, per, seed, sigma=1.1):
    """The generated stage the widget uses: `groups` clusters on a sphere."""
    rng = np.random.RandomState(seed)
    centres = np.array([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
                       dtype=float) / np.sqrt(3) * 3
    pts, gs = [], []
    for g in range(groups):
        for _ in range(per):
            pts.append(centres[g] + rng.normal(size=3) * sigma)
            gs.append(g)
    return np.array(pts), np.array(gs)


def knn_keep(hi, lo, k=3):
    """Fraction of each point's k nearest neighbours that survive the mapping."""
    n = len(hi)
    Dh, Dl = squareform(pdist(hi)), squareform(pdist(lo))
    np.fill_diagonal(Dh, np.inf)
    np.fill_diagonal(Dl, np.inf)
    keep = 0.0
    for i in range(n):
        a = set(np.argsort(Dh[i])[:k])
        b = np.argsort(Dl[i])[:k]
        keep += sum(1 for j in b if j in a) / k
    return keep / n


def silhouette(Y, gs):
    n = len(Y)
    D = squareform(pdist(Y))
    tot = 0.0
    for i in range(n):
        same = D[i][(gs == gs[i]) & (np.arange(n) != i)]
        others = [D[i][gs == g].mean() for g in set(gs) if g != gs[i]]
        a = same.mean() if len(same) else 0.0
        b = min(others)
        tot += (b - a) / max(a, b)
    return tot / n


out = {"sklearn": sklearn.__version__, "numpy": np.__version__, "cases": []}

# --- P, which must agree exactly: it has no seed and no descent in it --------
for groups, per, perp, seed in [(2, 4, 2, 1), (3, 4, 3, 1), (4, 12, 5, 77),
                                (4, 12, 12, 77), (4, 6, 7, 5)]:
    pts, gs = stage(groups, per, seed)
    D = squareform(pdist(pts, "sqeuclidean")).astype(np.float64)
    P = _joint_probabilities(D, perp, verbose=0)          # condensed, upper tri
    full = squareform(P)
    case = {
        "groups": groups, "per": per, "perplexity": perp, "seed": seed,
        "n": len(pts),
        "points": [[round(float(v), 12) for v in p] for p in pts],
        "P": [[float(v) for v in row] for row in full],
        "P_sum": float(full.sum()),
    }
    # --- the KL sklearn computes for a fixed embedding, so the objective can
    #     be compared without comparing two different descents ---------------
    rs = np.random.RandomState(0)
    Y = rs.normal(size=(len(pts), 2))
    kl, grad = _kl_divergence(Y.ravel(), P, 1, len(pts), 2)
    case["probe_Y"] = [[float(v) for v in p] for p in Y]
    case["probe_kl"] = float(kl)
    case["probe_grad"] = [float(v) for v in grad]
    out["cases"].append(case)

# --- the embedding, compared on what it is FOR rather than coordinate-wise ---
emb = []
for groups, per, perp, seed in [(4, 12, 2, 77), (4, 12, 5, 77), (4, 12, 12, 77),
                                (3, 4, 3, 1)]:
    pts, gs = stage(groups, per, seed)
    runs = []
    for rand in range(5):
        t = TSNE(n_components=2, perplexity=perp, init="random",
                 learning_rate=200.0, max_iter=1000, method="exact",
                 random_state=rand)
        Y = t.fit_transform(pts)
        runs.append({"kl": float(t.kl_divergence_),
                     "knn3": round(float(knn_keep(pts, Y)), 4),
                     "sil": round(float(silhouette(Y, gs)), 4)})
    emb.append({"groups": groups, "per": per, "perplexity": perp, "seed": seed,
                "n": len(pts), "runs": runs})
out["embeddings"] = emb

with open(__file__.replace("tsne-sklearn-ref.py", "tsne-sklearn-ref.json"), "w") as f:
    json.dump(out, f, indent=1)
print("wrote tsne-sklearn-ref.json:", len(out["cases"]), "P cases,",
      len(emb), "embedding cases, sklearn", sklearn.__version__)
