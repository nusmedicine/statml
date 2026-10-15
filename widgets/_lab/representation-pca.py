"""Slot 104, round 3: the embedding's PCA at each checkpoint, for a map that moves during Train.

PCA of the 2,000 map digits' embeddings at each of the ten checkpoints
(representation-checkpoints.py). PCA's axes have no fixed sign or order, and
the network changes between checkpoints, so each checkpoint's two components
are rotated (and reflected if needed) onto the previous checkpoint's points by
orthogonal Procrustes, and scaled to the same spread; the points then move
only as far as the embedding moved. Records the silhouette by digit and the
share of variance the two components hold, and writes
widgets/_lab/representation-pca.json (untracked) for the round-3 mock.

  python -I widgets/_lab/representation-pca.py "<...>/_scratch/frontiers-data"
"""
import json, os, sys
import numpy as np, torch
from sklearn.metrics import silhouette_score

HERE = os.path.dirname(os.path.abspath(__file__))
CK = os.path.join(sys.argv[1], "models-104")
labels = json.load(open(os.path.join(HERE, "representation-umap.json")))["keep_labels"]
out = {"labels": labels}
for name in ("ae", "masked_b", "simclr"):
    C = torch.load(os.path.join(CK, f"checkpoints-{name}.pt"), weights_only=False)
    frames, sil, var, prev = [], [], [], None
    for s in C["steps"]:
        E = C["snaps"][s]["emb"].astype(np.float64)
        if name == "simclr":  # the notebook's UMAP uses cosine: compare directions, as it does
            E = E / np.linalg.norm(E, axis=1, keepdims=True)
        E = E - E.mean(0)
        U, Sv, Vt = np.linalg.svd(E, full_matrices=False)
        P = E @ Vt[:2].T
        var.append(float((Sv[:2] ** 2).sum() / (Sv ** 2).sum()))
        P = P / np.sqrt((P ** 2).sum(1).mean())          # the same spread at every checkpoint
        if prev is not None:                              # rotate/reflect onto the previous checkpoint
            u, _, vt = np.linalg.svd(P.T @ prev)
            P = P @ (u @ vt)
        prev = P
        frames.append(np.round(P, 3).tolist())
        sil.append(round(float(silhouette_score(P, labels)), 3))
    move = [round(float(np.sqrt(((np.array(frames[i + 1]) - np.array(frames[i])) ** 2).sum(1)).mean()), 3) for i in range(len(frames) - 1)]
    out[name] = {"steps": C["steps"], "frames": frames, "silhouette": sil, "var2": [round(v, 3) for v in var], "mean_move": move}
    print(name, "silhouette", sil, "\n  variance in 2 PCs", [round(v, 2) for v in var], "\n  mean move between checkpoints", move, flush=True)
json.dump(out, open(os.path.join(HERE, "representation-pca.json"), "w"), separators=(",", ":"))
