"""Writes _lab/graph-molecules-mock-data.json for _lab/graph-molecules-mock.html:
six molecules from the lesson's file (_lab/graph-fingat-training.csv, the
file 09-2 cell 20 loads), with their Activity, where the lesson's scaffold
split puts each (cell 28 reproduced: GroupShuffleSplit 0.2 then 0.5,
random_state 42, on every row), and a 2-D drawing of each.

Run:  python -I widgets/_lab/graph-molecules-mock-data.py   (RDKit 2026.03.6, scikit-learn 1.9.0)
"""
import csv, json, os
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import rdDepictor
from rdkit.Chem.Scaffolds import MurckoScaffold
from sklearn.model_selection import GroupShuffleSplit

RDLogger.DisableLog("rdApp.*")
rdDepictor.SetPreferCoordGen(True)
HERE = os.path.dirname(os.path.abspath(__file__))

rows = []
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    r = csv.reader(f); next(r)
    for row in r:
        rows.append((row[0], int(row[1])))

def scaffold(s):
    m = Chem.MolFromSmiles(s)
    return "" if m is None else Chem.MolToSmiles(MurckoScaffold.GetScaffoldForMol(m))

scaf = np.array([scaffold(s) for s, _ in rows]); y = np.array([v for _, v in rows])
tr, vt = next(GroupShuffleSplit(test_size=0.2, random_state=42).split(y, groups=scaf))
vr, ts = next(GroupShuffleSplit(test_size=0.5, random_state=42).split(vt, groups=scaf[vt]))
split = {}
for k, ix in (("train", tr), ("val", vt[vr]), ("test", vt[ts])):
    for i in ix:
        split[int(i)] = k

# file row (1-based, header = row 1) -> name; small enough for the page's tables
PICK = [("nitrofurazone", 56), ("chloroxine", 121), ("bronopol", 59), ("aspirin", 1407), ("caffeine", 438), ("acetazolamide", 1999)]
out = {"counts": {k: int(len(ix)) for k, ix in (("train", tr), ("val", vt[vr]), ("test", vt[ts]))},
       "active": int(y.sum()), "n": len(rows), "molecules": []}
for name, row in PICK:
    i = row - 2
    smi, act = rows[i]
    m = Chem.MolFromSmiles(smi)
    rdDepictor.Compute2DCoords(m)
    c = m.GetConformer()
    out["molecules"].append({
        "name": name, "row": row, "smiles": smi, "y": act, "split": split[i], "scaffold": scaf[i],
        "atoms": [{"el": a.GetSymbol(), "charge": a.GetFormalCharge(),
                   "xy": [round(c.GetAtomPosition(a.GetIdx()).x, 3), round(-c.GetAtomPosition(a.GetIdx()).y, 3)]} for a in m.GetAtoms()],
        "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in m.GetBonds()],
    })
    print(f"{name:14s} y={act} {split[i]:5s} atoms {m.GetNumAtoms():2d} bonds {m.GetNumBonds():2d}  {smi}")
with open(os.path.join(HERE, "graph-molecules-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f, separators=(",", ":"))
print(out["counts"], "active", out["active"], "of", out["n"])
