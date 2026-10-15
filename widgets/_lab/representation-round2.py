"""Slot 104, round 2: the checkpoints as mock data, and an aligned UMAP across them.

Reads <data>/models-104/checkpoints-*.pt (representation-checkpoints.py) and
writes widgets/_lab/representation-round2-data.json (untracked) for
representation-round2-mock.html.

The map across training: one UMAP per checkpoint would place the clusters
anywhere each time, so a point could not be followed. umap-learn's
AlignedUMAP lays out all ten checkpoints together, each pulled toward the
same point's place in its neighbours (the notebook's settings otherwise:
15 neighbours, min_dist 0.1, cosine, random_state 42).

  python -I widgets/_lab/representation-round2.py "<...>/_scratch/frontiers-data"
"""
import json, os, sys, time
import numpy as np, torch
from umap import AlignedUMAP
from sklearn.metrics import silhouette_score

HERE = os.path.dirname(os.path.abspath(__file__))
CK = os.path.join(sys.argv[1], "models-104")
labels = json.load(open(os.path.join(HERE, "representation-umap.json")))["keep_labels"]
u8 = lambda a: np.clip(np.round(np.asarray(a).squeeze() * 255), 0, 255).astype(int).flatten().tolist()
out = {"labels": labels}

for name in ("ae", "sparse_ae", "masked_b", "simclr"):
    C = torch.load(os.path.join(CK, f"checkpoints-{name}.pt"), weights_only=False)
    steps = C["steps"]; S = [C["snaps"][s] for s in steps]
    page = {"steps": steps, "loss": [round(s["loss"], 5) for s in S], "same_as_saved": bool(C["same"])}
    bl = np.array(C["batch_loss"]); page["batch_loss"] = [round(float(v), 5) for v in bl.reshape(-1, 10).mean(1)] if len(bl) % 10 == 0 else [round(float(v), 5) for v in bl[: len(bl) // 10 * 10].reshape(-1, 10).mean(1)]
    if "xhat" in S[0]: page["xhat"] = [[u8(s["xhat"][d]) for d in range(10)] for s in S]
    if "z" in S[0]:
        page["z"] = [np.round(s["z"], 3).tolist() for s in S]
        page["grid"] = [np.round(s["grid"], 3).tolist() for s in S]
        page["grid_labels"] = C["grid_labels"]
        page["zero"] = [float((np.abs(s["grid"]) < 1e-6).mean()) for s in S]
    if "sim" in S[0]:
        page["sim"] = [np.round(s["sim"], 3).tolist() for s in S]
        page["views"] = {"p1": C["views"]["p1"], "p2": C["views"]["p2"],
                         "v1": [u8(v) for v in C["views"]["v1"]], "v2": [u8(v) for v in C["views"]["v2"]]}
    if name == "masked_b": page["mask"] = [u8(m) for m in C["mask"]]
    t0 = time.time()
    embs = [s["emb"] for s in S]
    rel = [{i: i for i in range(len(labels))} for _ in range(len(embs) - 1)]
    al = AlignedUMAP(n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42).fit(embs, relations=rel)
    page["map"] = [np.round(e, 2).tolist() for e in al.embeddings_]
    page["silhouette"] = [round(float(silhouette_score(e, labels)), 3) for e in al.embeddings_]
    print(name, "aligned UMAP", round(time.time() - t0), "s; silhouette by checkpoint", page["silhouette"], "; loss", page["loss"], flush=True)
    out[name] = page
json.dump(out, open(os.path.join(HERE, "representation-round2-data.json"), "w"), separators=(",", ":"))
print("wrote", os.path.getsize(os.path.join(HERE, "representation-round2-data.json")), "bytes")
