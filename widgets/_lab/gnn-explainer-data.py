"""Slot 98: generate widgets/gnn-explainer/data.js.

Run:  python widgets/_lab/gnn-explainer-data.py   (~1 min)
Needs torch, RDKit, scikit-learn, the untracked _lab/graph-fingat-training.csv and
_lab/gnn-explainer-gat-42.pt (from `gnn-explainer-measure.py train 42`), and
_lab/gnn-explainer-measure.json (from `… explain`), which it checks itself against.

The lesson's trained GAT and GNNExplainer as gnn-explainer-measure.py writes them
out, 20 runs (torch seeds 0-19) on test_set[3], ceftriaxone disodium. Per run:
the edge mask on each directed edge every 10 epochs (epochs 1, 11, ..., 291, 300),
p(active) of the masked graph and the loss at each of those epochs, the final
feature mask M_x (zero outside the hard mask, as PyG returns it), and p(active)
with only the run's kept bonds (mask > 0.5) against 100 random sets of that size.
Numbers are stored as integers to keep the file small: masks and p in
thousandths. Derived numbers only; the one molecule drawn is the lesson's.
"""
import importlib.util, json, os, sys, warnings

import numpy as np
import torch
from rdkit import Chem
from rdkit.Chem import rdDepictor

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "gnn-explainer", "data.js")
sp = importlib.util.spec_from_file_location("gm", os.path.join(HERE, "gnn-explainer-measure.py"))
gm = importlib.util.module_from_spec(sp); sp.loader.exec_module(gm)
MEAS = json.load(open(os.path.join(HERE, "gnn-explainer-measure.json"), encoding="utf-8"))

ck = torch.load(os.path.join(HERE, "gnn-explainer-gat-42.pt"), weights_only=False)
model = gm.GATNet(); model.load_state_dict(ck["state"]); model.eval()
for p in model.parameters():
    p.requires_grad_(False)
tr, va, te = gm.split()
row = int(te[3])
assert row == MEAS["molecule"]["row"] == 76
x, ei, ea = gm.G[row]
mol = gm.MOLS[row]
with torch.no_grad():
    p_full = gm.logits(model, x, ei, ea).softmax(0)
target = int(p_full.argmax())
assert target == 1

# ---- the drawing: CoordGen, then turned onto the drug's long axis, bond length 1
rdDepictor.SetPreferCoordGen(True)
m2 = Chem.Mol(mol); rdDepictor.Compute2DCoords(m2)
conf = m2.GetConformer()
XY = np.array([[conf.GetAtomPosition(i).x, -conf.GetAtomPosition(i).y] for i in range(m2.GetNumAtoms())])
frags = Chem.GetMolFrags(mol)
drug = max(frags, key=len)
D = XY[list(drug)] - XY[list(drug)].mean(0)
w_, v_ = np.linalg.eigh(D.T @ D)
ax = v_[:, -1]
R = np.array([[ax[0], ax[1]], [-ax[1], ax[0]]])
XY = (XY - XY[list(drug)].mean(0)) @ R.T
bl = np.mean([np.linalg.norm(XY[b.GetBeginAtomIdx()] - XY[b.GetEndAtomIdx()]) for b in mol.GetBonds()])
XY = XY / bl
atoms = [[a.GetSymbol(), a.GetFormalCharge(), round(float(XY[i, 0]), 3), round(float(XY[i, 1]), 3), int(i in drug)]
         for i, a in enumerate(mol.GetAtoms())]
bonds = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType()).split(".")[-1]] for b in mol.GetBonds()]
bkey = [tuple(sorted(b[:2])) for b in bonds]
assert [tuple(b) for b in MEAS["molecule"]["bond_list"]] == bkey
# directed edges in graph()'s order: bond b is edges 2b (begin -> end) and 2b + 1
assert all(ei[0, 2 * b] == bonds[b][0] and ei[1, 2 * b] == bonds[b][1] for b in range(len(bonds)))

k1000 = lambda v: int(round(1000 * float(v)))
NFEAT = x.shape[1]
RUNS = []
for r in range(20):
    nm, em, hn, he, trace = gm.gnn_explainer(model, x, ei, ea, target, seed=r, trace_every=10, trace_mx=True)
    # PyG reports 0 for an edge whose gradient was 0 on the first step (its hard mask,
    # 0-11 of 78 edges a run here); every traced frame shows what PyG would report then
    hard = he.numpy()
    for t in trace:
        t["edge"] = [v if h else 0.0 for v, h in zip(t["edge"], hard)]
    assert np.allclose(np.array(trace[-1]["edge"]), em.numpy(), atol=1e-3)
    hard_idx = [int(q) for q in np.flatnonzero(hn.numpy().reshape(-1))]
    assert np.allclose(np.array(trace[-1]["mx"]), nm.numpy(), atol=1e-3)
    kept = [b for b in range(len(bonds)) if max(float(em[2 * b]), float(em[2 * b + 1])) > 0.5]
    def p_with(keep):
        mm = torch.zeros(ei.shape[1])
        for b in keep:
            mm[2 * b] = mm[2 * b + 1] = 1.0
        with torch.no_grad():
            return float(gm.logits(model, x, ei, ea, mm).softmax(0)[target])
    rng = np.random.default_rng(r)
    rand = [p_with(rng.choice(len(bonds), len(kept), replace=False).tolist()) for _ in range(100)]
    RUNS.append({
        "edges": [[k1000(v) for v in t["edge"]] for t in trace],
        "p": [k1000(t["p"]) for t in trace],
        "loss": [k1000(t["loss"]) for t in trace],
        "pred": [k1000(t["pred_loss"]) for t in trace],
        # M_x every traced epoch, only the entries inside the hard mask (the rest are 0 throughout):
        # mxi the flat indices (atom * 39 + feature), mxt one row of values per traced epoch
        "mxi": hard_idx,
        "mxt": [[k1000(t["mx"][q // NFEAT][q % NFEAT]) for q in hard_idx] for t in trace],
        "kept": kept,
        "pKept": k1000(p_with(kept)),
        "pRand": sorted(k1000(v) for v in rand),
    })
    # the run must be the one the measurement scored
    meas = MEAS["runs"]["42"]["runs"][r]
    col = gm.collapse(ei, em)
    assert np.allclose([col[k] for k in bkey], meas["edge_raw"], atol=2e-4), r
    print("run", r, "kept", len(kept), "p", RUNS[-1]["pKept"], flush=True)
EPOCHS = [t["epoch"] for t in trace]

res = MEAS["runs"]["42"]
INFO = {
    "row": row, "pFull": k1000(p_full[1]),
    "testF1": MEAS["models"]["42"]["test_macro_f1"], "testActives": MEAS["models"]["42"]["test_actives"],
    "activesFound": MEAS["models"]["42"]["actives_found"],
    "split": [MEAS["split"]["train"], MEAS["split"]["val"], MEAS["split"]["test"]],
    "waterZeroed": round(abs(res["occlusion_atom_zeroed"][MEAS["molecule"]["fragments"][1][0]]), 3),
    "bondDeletedMax": round(max(abs(v) for v in res["occlusion_edge"]), 3),
    "noBonds": k1000(MEAS["summary"]["42"]["fidelity"]["no_bonds"]),
}
# the hover's names for cell 32's columns, in words (copy audit 2026-10-10: "is C" and "chiral none" were our shorthand)
FEATURES = ["atomic number", "degree", "hydrogens", "formal charge", "aromatic", "in ring"] + \
    [f"element {s}" for s in gm.ATOM_VOCAB] + [f"hybridisation {h}" for h in ("SP", "SP2", "SP3", "SP3D", "SP3D2")] + \
    ["chirality unspecified", "chirality clockwise", "chirality counter-clockwise"]
assert len(FEATURES) == x.shape[1]

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("/* GENERATED by widgets/_lab/gnn-explainer-data.py — do not edit.\n"
            "   Ceftriaxone disodium (row 76 of the lesson's file, test_set[3] under its seed-42\n"
            "   scaffold split) and GNNExplainer on the lesson's trained GAT, 20 runs from random\n"
            "   starts (torch seeds 0-19). Masks and probabilities in thousandths. EDGES: per run,\n"
            "   per traced epoch, the mask on each directed edge (bond b is edges 2b and 2b + 1).\n"
            "   MXI / MXT: per run, M_x every traced epoch, only the entries inside PyG's hard mask\n"
            "   (index atom * 39 + feature); every other entry is 0. XNZ: the molecule's non-zero\n"
            "   features, the same indexing (what the grid shows before any mask). */\n")
    f.write(f"export const MOL = {json.dumps({'atoms': atoms, 'bonds': bonds}, separators=(',', ':'))};\n")
    f.write(f"export const FEATURES = {json.dumps(FEATURES, ensure_ascii=False)};\n")
    # the molecule's non-zero features (atom * 39 + feature): the grid before any mask
    f.write(f"export const XNZ = {json.dumps([int(q) for q in np.flatnonzero(x.numpy().reshape(-1) != 0)], separators=(',', ':'))};\n")
    f.write(f"export const EPOCHS = {json.dumps(EPOCHS)};\n")
    f.write(f"export const INFO = {json.dumps(INFO)};\n")
    f.write("export const RUNS = [\n")
    for r in RUNS:
        f.write(json.dumps(r, separators=(",", ":")) + ",\n")
    f.write("];\n")
print("wrote", os.path.getsize(OUT) // 1024, "KB")
