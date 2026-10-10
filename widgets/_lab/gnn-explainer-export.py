"""Slot 98: the mock's data, from gnn-explainer-measure.json and RDKit's drawing of the molecule.

Run:  python widgets/_lab/gnn-explainer-export.py   (after gnn-explainer-measure.py explain)
Writes _lab/gnn-explainer-mock-data.json (untracked).
"""
import json, os

from rdkit import Chem
from rdkit.Chem import rdDepictor

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "gnn-explainer-measure.json"), encoding="utf-8"))
M = D["molecule"]

mol = Chem.MolFromSmiles(M["smiles"])
rdDepictor.SetPreferCoordGen(True)
rdDepictor.Compute2DCoords(mol)
conf = mol.GetConformer()
atoms = [{"el": a.GetSymbol(), "charge": a.GetFormalCharge(), "x": round(conf.GetAtomPosition(i).x, 3),
          "y": round(-conf.GetAtomPosition(i).y, 3)} for i, a in enumerate(mol.GetAtoms())]
bonds = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType()).split(".")[-1]] for b in mol.GetBonds()]
assert [tuple(sorted(b[:2])) for b in bonds] == [tuple(b) for b in M["bond_list"]], "bond order differs from the measure"

out = {"molecule": {**M, "atoms": atoms, "bonds": bonds}, "split": D["split"], "models": {}, "summary": D["summary"]}
for s, info in D["models"].items():
    out["models"][s] = {k: v for k, v in info.items() if k != "test_predictions"}
for s, res in D["runs"].items():
    keep = {k: res[k] for k in ("logits", "p", "pred", "saliency_node", "saliency_edge", "occlusion_edge", "occlusion_atom_zeroed")}
    keep["runs"] = [{k: r[k] for k in ("seed", "node_raw", "edge_raw", "node_imp", "edge_imp", "p_with_soft_masks", "trace") if k in r}
                    for r in res["runs"]]
    out["models"][s]["explained"] = keep
with open(os.path.join(HERE, "gnn-explainer-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f)
print("wrote", os.path.getsize(os.path.join(HERE, "gnn-explainer-mock-data.json")) // 1024, "KB")
