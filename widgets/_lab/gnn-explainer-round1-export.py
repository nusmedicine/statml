"""Slot 98 round 1: the mock's data — start 1's feature mask M_x every 10 epochs.

Run:  python widgets/_lab/gnn-explainer-round1-export.py   (after `gnn-explainer-measure.py train 42`)
Writes _lab/gnn-explainer-round1-mock-data.json (untracked). The rest of the mock reads
widgets/gnn-explainer/data.js.
"""
import importlib.util, json, os, warnings

import torch

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("gm", os.path.join(HERE, "gnn-explainer-measure.py"))
gm = importlib.util.module_from_spec(sp); sp.loader.exec_module(gm)
ck = torch.load(os.path.join(HERE, "gnn-explainer-gat-42.pt"), weights_only=False)
model = gm.GATNet(); model.load_state_dict(ck["state"]); model.eval()
for p in model.parameters():
    p.requires_grad_(False)
tr, va, te = gm.split()
x, ei, ea = gm.G[int(te[3])]
nm, em, hn, he, trace = gm.gnn_explainer(model, x, ei, ea, 1, seed=0, trace_every=10, trace_mx=True)
out = {"epochs": [t["epoch"] for t in trace], "mx": [[[int(round(1000 * v)) for v in row] for row in t["mx"]] for t in trace]}
with open(os.path.join(HERE, "gnn-explainer-round1-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f, separators=(",", ":"))
print("frames", len(out["mx"]))
