"""Slot 104, round 3: the notebook's UMAP of the embedding at each checkpoint, laid out independently.

For a row of small maps during Train: one UMAP per checkpoint (15 neighbours,
min_dist 0.1, cosine, random_state 42, as 10-1b), no alignment between them, so
each is read on its own. Writes widgets/_lab/representation-umap-steps.json
(untracked).

  python -I widgets/_lab/representation-umap-steps.py "<...>/_scratch/frontiers-data"
"""
import json, os, sys, time
import numpy as np, torch, umap
from sklearn.metrics import silhouette_score

HERE = os.path.dirname(os.path.abspath(__file__))
CK = os.path.join(sys.argv[1], "models-104")
labels = json.load(open(os.path.join(HERE, "representation-umap.json")))["keep_labels"]
out = {"labels": labels}
for name in ("ae", "masked_b", "simclr"):
    C = torch.load(os.path.join(CK, f"checkpoints-{name}.pt"), weights_only=False)
    frames, sil = [], []
    t0 = time.time()
    for s in C["steps"]:
        U = umap.UMAP(n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42).fit_transform(C["snaps"][s]["emb"])
        frames.append(np.round(U, 2).tolist()); sil.append(round(float(silhouette_score(U, labels)), 3))
    out[name] = {"steps": C["steps"], "frames": frames, "silhouette": sil}
    print(name, round(time.time() - t0), "s; silhouette by checkpoint", sil, flush=True)
json.dump(out, open(os.path.join(HERE, "representation-umap-steps.json"), "w"), separators=(",", ":"))
