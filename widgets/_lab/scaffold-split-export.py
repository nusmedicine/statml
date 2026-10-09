"""Slot 97: write the mock's data, scaffold-split-mock-data.json (untracked).

Run after scaffold-split-measure.py base (and its gcn seeds):
    python widgets/_lab/scaffold-split-export.py

The examples follow 09-2 cell 18's figure: two related molecules, a bracket,
their scaffold. The figure's 3-methylindole is in the lesson's file (row 682);
its 5-bromoindole and indole are not, so tryptamine (row 1192) stands in from
the same scaffold group. The quinolones are the arm the figure does not have:
ciprofloxacin (row 61) and norfloxacin (row 35), one family, two scaffolds.
Each pair is drawn on its scaffold's coordinates so a shared core looks shared.

Only derived data leaves this script for the grid: a group index, a label and
split assignments per molecule, no SMILES — the file's terms are unsettled
(the FinGAT repository has no licence; the molecules trace to Stokes et al.,
Cell 2020).
"""
import csv, glob, json, os

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdDepictor
from rdkit.Chem.Scaffolds import MurckoScaffold

RDLogger.DisableLog("rdApp.*")
rdDepictor.SetPreferCoordGen(True)
HERE = os.path.dirname(os.path.abspath(__file__))

import importlib.util
spec = importlib.util.spec_from_file_location("m", os.path.join(HERE, "scaffold-split-measure.py"))
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)

measure = json.load(open(os.path.join(HERE, "scaffold-split-measure.json"), encoding="utf-8"))
gcn = {}
for p in sorted(glob.glob(os.path.join(HERE, "scaffold-split-gcn-*.json"))):
    g = json.load(open(p, encoding="utf-8")); gcn[g["seed"]] = g


def draw(mol, template=None):
    m = Chem.Mol(mol)
    if template is not None:
        AllChem.GenerateDepictionMatching2DStructure(m, template)
    else:
        rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    sc = MurckoScaffold.GetScaffoldForMol(m)
    keep = set(m.GetSubstructMatch(sc))
    atoms = [{"el": a.GetSymbol(), "x": round(conf.GetAtomPosition(i).x, 3), "y": round(-conf.GetAtomPosition(i).y, 3),
              "scaffold": i in keep} for i, a in enumerate(m.GetAtoms())]
    bonds = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType()).split(".")[-1]] for b in m.GetBonds()]
    return {"atoms": atoms, "bonds": bonds, "scaffold": Chem.MolToSmiles(sc)}


def example(rows, names):
    out = []
    mols = [M.MOLS[r] for r in rows]
    for r, nm, mol in zip(rows, names, mols):
        sc = MurckoScaffold.GetScaffoldForMol(mol)
        rdDepictor.Compute2DCoords(sc)
        d = draw(mol, sc)
        d.update({"row": r, "name": nm, "y": int(M.Y[r]), "scaffold_mol": draw(sc)})
        out.append(d)
    return out

EX = {"indoles": example([682, 1192], ["3-methylindole", "tryptamine"]),
      "quinolones": example([61, 35], ["ciprofloxacin", "norfloxacin"])}

# Groups, largest first; the grid's order is group by group.
ok = np.where(M.OK)[0]
from collections import defaultdict
by = defaultdict(list)
for i in ok:
    by[M.SCAF[i]].append(int(i))
groups = sorted(by.items(), key=lambda kv: (-len(kv[1]), kv[0]))
order = [i for _, ix in groups for i in ix]
pos = {i: k for k, i in enumerate(order)}
G = [{"size": len(ix), "actives": int(M.Y[ix].sum()), "acyclic": s == ""} for s, ix in groups]
gidx = {s: k for k, (s, _) in enumerate(groups)}
for name, ex in EX.items():
    for e in ex:
        e["group"] = gidx[M.SCAF[e["row"]]]

splits = {}
for name, fn in M.SPLITS.items():
    splits[name] = {}
    for seed in M.SEEDS:
        tr, va, te = fn(seed)
        a = ["0"] * len(order)
        for code, ix in (("0", tr), ("1", va), ("2", te)):
            for i in ix:
                if i in pos:
                    a[pos[i]] = code
        splits[name][str(seed)] = "".join(a)

OUT = {"examples": EX, "groups": G, "labels": "".join(str(int(M.Y[i])) for i in order), "splits": splits,
       "measure": {"file": measure["file"], "actives_by_scaffold": measure["actives_by_scaffold"],
                   "summary": measure["summary"],
                   "per_seed": {k: [{kk: r[kk] for kk in r if not kk.startswith("nn_sim_hist")} | {"nn_sim_hist": r["nn_sim_hist"]}
                                    for r in v] for k, v in measure["per_seed"].items()}},
       "gcn": gcn}
with open(os.path.join(HERE, "scaffold-split-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(OUT, f)
print("groups", len(G), "molecules", len(order), "gcn seeds", sorted(gcn))
