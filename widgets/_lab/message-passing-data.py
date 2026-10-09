"""Data for slot 95, message-passing: writes _lab/message-passing-mock-data.json.

Run:  python widgets/_lab/message-passing-data.py
Needs RDKit; reads _lab/graph-fingat-training.csv and the trained-GAT tables
_lab/message-passing-trained*.json (run message-passing-trained.py first).

The molecules carry 09-2 cell 11's five features, the ones widget 94 shows as x
[n, 5] (atomic number, aromatic, hybridization, hydrogens, charge), so 95 starts
from the table the reader has just seen. Caffeine is written as 94 writes it
(the same string, so the same atom numbers and the same drawing). The acids are
the pair message-passing-measure.py finds tied under max pooling after two of
the lesson's GCN layers (M5, M6); both rows of the lesson's file, both inactive.
It also writes the widget's own widgets/message-passing/data.js.
"""
import csv, json, os

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

RDLogger.DisableLog("rdApp.*")
HERE = os.path.dirname(os.path.abspath(__file__))

labels = {}
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        labels[r["SMILES"]] = int(r["Activity"])

def molecule(name, smi, xy=None):
    m = Chem.MolFromSmiles(smi)
    if xy is None:
        AllChem.Compute2DCoords(m)
        conf = m.GetConformer()
        xy = [[round(conf.GetAtomPosition(i).x, 3), round(-conf.GetAtomPosition(i).y, 3)] for i in range(m.GetNumAtoms())]
    return {
        "name": name, "smiles": smi, "y": labels.get(smi),
        "atoms": [{"el": a.GetSymbol(),
                   "x": [a.GetAtomicNum(), int(a.GetIsAromatic()), int(a.GetHybridization()),
                         a.GetTotalNumHs(), a.GetFormalCharge()],
                   "xy": xy[a.GetIdx()]} for a in m.GetAtoms()],
        "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in m.GetBonds()],
    }

# caffeine with 94's drawing, read from its data.js so the two widgets agree
src = open(os.path.join(HERE, "..", "graph-representation", "data.js"), encoding="utf-8").read()
mols94 = json.loads(src[src.index("["):src.index("];") + 1])
caf94 = next(m for m in mols94 if m["name"] == "caffeine")
caf = molecule("caffeine", caf94["smiles"], [a["xy"] for a in caf94["atoms"]])
assert [a["x"] for a in caf["atoms"]] == [a["x"] for a in caf94["atoms"]]

def diacid_xy(smi):
    """One straight zig-zag for both acids, so the extra CH2 is the only difference
    drawn (RDKit bends the shorter chain). Carbons left to right; each end
    carbon's =O above it and its OH outward."""
    m = Chem.MolFromSmiles(smi)
    carbons = [a.GetIdx() for a in m.GetAtoms() if a.GetSymbol() == "C"]
    xy = {}
    for k, c in enumerate(carbons):
        xy[c] = [k * 0.866, 0.25 if k % 2 else -0.25]
    for end, out in ((carbons[0], -1), (carbons[-1], 1)):
        for nb in m.GetAtomWithIdx(end).GetNeighbors():
            if nb.GetSymbol() != "O":
                continue
            dbl = m.GetBondBetweenAtoms(end, nb.GetIdx()).GetBondTypeAsDouble() == 2
            x0, y0 = xy[end]
            xy[nb.GetIdx()] = [x0, y0 + (-1 if y0 < 0 else 1)] if dbl else [x0 + out * 0.866, y0 + (0.5 if y0 < 0 else -0.5)]
    return [xy[i] for i in range(m.GetNumAtoms())]

SUB, AZE = "O=C(O)CCCCCCC(=O)O", "O=C(O)CCCCCCCC(=O)O"
out = {
    "caffeine": caf,
    "acids": [molecule("suberic acid", SUB, diacid_xy(SUB)), molecule("azelaic acid", AZE, diacid_xy(AZE))],
    "trained": {},
}
for fn in sorted(os.listdir(HERE)):
    if fn.startswith("message-passing-trained") and fn.endswith(".json"):
        seed = fn[len("message-passing-trained"):-5].lstrip("-") or "42"
        t = json.load(open(os.path.join(HERE, fn), encoding="utf-8"))
        out["trained"][seed] = {
            "test_auc_last": t["epochs"][-1]["test_auc"],
            "file": t["trained"]["file"], "file_untrained": t["untrained"]["file"],
            "caffeine": t["trained"]["caffeine"], "caffeine_untrained": t["untrained"]["caffeine"],
        }
# Each of the five columns' mean and SD over every atom in the file. The Layers
# step standardises with these, as a scaler fitted on the training data would:
# standardising over the molecule's own atoms instead removes the part the atoms
# share, which is the part smoothing grows, and the curve then barely moves for
# four layers (tried on the mock first).
import statistics as st
rows_x = []
for s in labels:
    m = Chem.MolFromSmiles(s)
    if m is None:
        continue
    rows_x += [[a.GetAtomicNum(), int(a.GetIsAromatic()), int(a.GetHybridization()),
                a.GetTotalNumHs(), a.GetFormalCharge()] for a in m.GetAtoms()]
cols = list(zip(*rows_x))
out["x_mean"] = [round(st.fmean(c), 4) for c in cols]
out["x_sd"] = [round(st.pstdev(c), 4) for c in cols]
out["measure"] = json.load(open(os.path.join(HERE, "message-passing-measure.json"), encoding="utf-8"))
for k in list(out["measure"]):
    if k.startswith("M3_"):
        del out["measure"][k]           # the per-seed alpha tables are summarised in the mock
with open(os.path.join(HERE, "message-passing-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f, separators=(",", ":"))
print("wrote message-passing-mock-data.json;", "trained seeds:", sorted(out["trained"]))

# ------------------------------------------------------------------ the widget's data.js
# The file's mean smoothing curve, under the layer the widget runs on caffeine:
# the five columns standardised with the file's statistics, GCN (self-loops,
# symmetric normalisation) + ELU, glorot weights 5 -> 16 -> 16 ..., one W a
# layer. Every molecule of three atoms or more; a salt's pieces never mix, which
# is part of why the mean stays high. Numpy's seeds, not the widget's: the
# curve is a reference, and three seeds are averaged so no single draw stands
# for the file.
import numpy as np

MU, SD = np.array(out["x_mean"]), np.array(out["x_sd"])
SD[SD == 0] = 1

def spread(H):
    Hn = H / (np.linalg.norm(H, axis=1, keepdims=True) + 1e-12)
    C = Hn @ Hn.T
    return float((1 - C)[np.triu_indices(len(H), 1)].mean())

def curve(m, rng, K=8):
    n = m.GetNumAtoms()
    A = np.eye(n)
    for b in m.GetBonds():
        A[b.GetBeginAtomIdx(), b.GetEndAtomIdx()] = A[b.GetEndAtomIdx(), b.GetBeginAtomIdx()] = 1
    d = A.sum(1); P = A / np.sqrt(np.outer(d, d))
    H = (np.array([[a.GetAtomicNum(), int(a.GetIsAromatic()), int(a.GetHybridization()),
                    a.GetTotalNumHs(), a.GetFormalCharge()] for a in m.GetAtoms()], float) - MU) / SD
    out_ = [spread(H)]
    for _ in range(K):
        b = np.sqrt(6 / (H.shape[1] + 16))
        H = P @ (H @ rng.uniform(-b, b, (H.shape[1], 16)))
        H = np.where(H > 0, H, np.expm1(np.minimum(H, 0)))
        out_.append(spread(H))
    return out_

file_mols = [Chem.MolFromSmiles(s) for s in labels]
file_mols = [m for m in file_mols if m is not None and m.GetNumAtoms() >= 3]
curves = [[curve(m, rng) for m in file_mols] for rng in (np.random.default_rng(s) for s in (0, 1, 2))]
file_curve = [round(float(v), 3) for v in np.mean([np.mean(c, 0) for c in curves], 0)]

def alpha_table(run, key):
    """layer 1's alpha into each caffeine atom, the mean of its four heads, as {from, alpha}"""
    return [{"from": a["from"], "alpha": [round(sum(h) / len(h), 3) for h in a["alpha"]]}
            for a in out["trained"][run][key]["layer1"]]

ALPHA = {"untrained": alpha_table("42", "caffeine_untrained"), "trained": alpha_table("42", "caffeine")}
trained = out["trained"]["42"]
# how many caffeine atoms every training run gives the same top input in layer 1
runs = sorted(out["trained"])
tops = [[(lambda t: t["from"][t["alpha"].index(max(t["alpha"]))])(a) for a in alpha_table(r, "caffeine")] for r in runs]
agree = sum(len({t[i] for t in tops}) == 1 for i in range(len(tops[0])))
widget = {
    "CAFFEINE": {k: caf[k] for k in ("name", "smiles", "y", "atoms", "bonds")},
    "ACIDS": [{k: a[k] for k in ("name", "smiles", "y", "atoms", "bonds")} for a in out["acids"]],
    "X_MEAN": out["x_mean"], "X_SD": out["x_sd"],
    "FILE_SPREAD": file_curve, "FILE_N": len(file_mols),
    "ALPHA": ALPHA,
    "GAT_RUN": {"epochs": len(json.load(open(os.path.join(HERE, "message-passing-trained.json"), encoding="utf-8"))["epochs"]),
                "auc": trained["test_auc_last"], "runs": len(runs), "agree": agree},
}
dst = os.path.join(HERE, "..", "message-passing", "data.js")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w", encoding="utf-8", newline="\n") as f:
    f.write("/* GENERATED by widgets/_lab/message-passing-data.py with RDKit — do not edit.\n"
            "   Caffeine as widget 94 writes and draws it, and suberic and azelaic acid on one zig-zag,\n"
            "   each atom with 09-2 cell 11's five features (atomic number, aromatic, hybridization,\n"
            "   hydrogens, charge). X_MEAN and X_SD: the five columns over every atom in the lesson's file.\n"
            "   FILE_SPREAD: the file's mean cosine distance between atoms after 0-8 layers of the widget's\n"
            "   layer (three numpy seeds). ALPHA: layer 1 of 09-2 cell 64's GATNet, the mean of its four heads,\n"
            "   into each caffeine atom: at initialisation and after training on the lesson's file\n"
            "   (_lab/message-passing-trained.py, run 42). */\n")
    for k, v in widget.items():
        f.write(f"export const {k} = {json.dumps(v, separators=(',', ':'))};\n")
print("wrote", os.path.relpath(dst, HERE), "· file curve", file_curve)
