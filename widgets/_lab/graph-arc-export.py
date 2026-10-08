"""Molecules and arrays for _lab/graph-arc-mock.html.

Run after graph-arc-measure.py:  python widgets/_lab/graph-arc-export.py
Writes _lab/graph-arc-mock-data.json (untracked, as the measure JSON).
RDKit draws nothing here: it supplies 2-D coordinates, atoms, bonds, the
Murcko scaffold's atoms and one split's nearest-neighbour similarities.
"""
import csv, json, os, re
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdFingerprintGenerator, DataStructs, rdDepictor
from rdkit.Chem.Scaffolds import MurckoScaffold
from sklearn.model_selection import GroupShuffleSplit, StratifiedShuffleSplit

RDLogger.DisableLog("rdApp.*")
rdDepictor.SetPreferCoordGen(True)
HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN = re.compile(r"(\[[^\]]+]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\(|\)|\.|=|#|-|\+|\\|/|:|~|@|\?|>|\*|\$|%[0-9]{2}|[0-9])")
ATOMISH = re.compile(r"^(\[.*]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\*)$")


def mol_json(smi, template=None):
    m = Chem.MolFromSmiles(smi)
    if template is not None:
        rdDepictor.GenerateDepictionMatching2DStructure(m, template)
    else:
        rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    xy = np.array([[conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y] for i in range(m.GetNumAtoms())])
    toks, pos, atom_char = TOKEN.findall(smi), 0, []
    for t in toks:
        if ATOMISH.match(t):
            atom_char.append([pos, len(t)])
        pos += len(t)
    return m, {
        "smiles": smi,
        "atoms": [{"el": a.GetSymbol(), "ar": a.GetIsAromatic(), "h": a.GetTotalNumHs(),
                   "deg": a.GetDegree(), "ring": a.IsInRing(), "charge": a.GetFormalCharge(),
                   "hyb": str(a.GetHybridization()), "x": round(xy[i, 0], 3), "y": round(-xy[i, 1], 3)}
                  for i, a in enumerate(m.GetAtoms())],
        "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in m.GetBonds()],
        "atom_char": atom_char if len(atom_char) == m.GetNumAtoms() else None,
    }


def wl(m, iters=2):
    """1-WL classes after `iters` rounds, numbered in order of first sight."""
    col = [(a.GetSymbol(), a.GetDegree(), a.GetTotalNumHs(), a.GetIsAromatic(), a.IsInRing()) for a in m.GetAtoms()]
    nb = [[n.GetIdx() for n in a.GetNeighbors()] for a in m.GetAtoms()]
    for _ in range(iters):
        col = [(col[v], tuple(sorted(col[u] for u in nb[v]))) for v in range(len(col))]
    return col


OUT = {"measure": json.load(open(os.path.join(HERE, "graph-arc-measure.json"), encoding="utf-8"))}

_, OUT["caffeine"] = mol_json("Cn1cnc2n(C)c(=O)n(C)c(=O)c12")

# 95 Readout: the lesson's own max-pool pair, and the all-alike pair.
pairs = {}
for name, (a, b) in {"acids": ("O=C(O)CCCCCCC(=O)O", "O=C(O)CCCCCCCC(=O)O"),
                     "rings": ("C1CC1", "C1CCCCC1")}.items():
    ma, ja = mol_json(a)
    mb, jb = mol_json(b)
    ca, cb = wl(ma), wl(mb)
    keys = []
    for c in ca + cb:
        if c not in keys:
            keys.append(c)
    ja["wl"] = [keys.index(c) for c in ca]
    jb["wl"] = [keys.index(c) for c in cb]
    pairs[name] = [ja, jb]
OUT["readout_pairs"] = pairs

# 97 Scaffold: one quinolone family, three molecules from the lesson's file.
# Ciprofloxacin and gatifloxacin share a Murcko scaffold; norfloxacin differs
# only in its N1 group (ethyl, not a cyclopropyl ring) and so has another.
family = {
    "ciprofloxacin": "O=C(O)c1cn(C2CC2)c2cc(N3CCNCC3)c(F)cc2c1=O",
    "gatifloxacin": "COc1c(N2CCNC(C)C2)c(F)cc2c(=O)c(C(=O)O)cn(C3CC3)c12",
    "norfloxacin": "CCn1cc(C(=O)O)c(=O)c2cc(F)c(N3CCNCC3)cc21",
}
lesson = {r["SMILES"]: int(r["Activity"]) for r in csv.DictReader(open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig"))}
core = Chem.MolFromSmarts("O=C(O)c1cn(*)c2cc(N3CCNCC3)c(F)cc2c1=O")
ref, _ = mol_json(family["ciprofloxacin"])
fam = {}
for name, smi in family.items():
    m, j = mol_json(smi)
    if name != "ciprofloxacin":
        try:
            rdDepictor.GenerateDepictionMatching2DStructure(m, ref, refPatt=core)
            conf = m.GetConformer()
            for i, a in enumerate(j["atoms"]):
                p = conf.GetAtomPosition(i)
                a["x"], a["y"] = round(p.x, 3), round(-p.y, 3)
        except Exception as e:
            print("alignment failed:", name, e)
    sc = MurckoScaffold.GetScaffoldForMol(m)
    j["scaffold"] = Chem.MolToSmiles(sc)
    j["scaffold_atoms"] = list(m.GetSubstructMatch(sc))
    j["activity"] = lesson.get(smi)
    fam[name] = j
OUT["scaffold_family"] = fam

# 97 Split: one seed's nearest-training-neighbour similarity, per test molecule.
rows = [(r["SMILES"], int(r["Activity"])) for r in csv.DictReader(open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig"))]
mols, ys, scafs = [], [], []
for s, y in rows:
    m = Chem.MolFromSmiles(s)
    if m is None:
        continue
    mols.append(m); ys.append(y)
    scafs.append(Chem.MolToSmiles(MurckoScaffold.GetScaffoldForMol(m)))
ys, scafs = np.array(ys), np.array(scafs)
gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
fps = [gen.GetFingerprint(m) for m in mols]
split = {}
for name, sp in (("random", StratifiedShuffleSplit(1, test_size=0.2, random_state=0).split(ys, ys)),
                 ("scaffold", GroupShuffleSplit(1, test_size=0.2, random_state=0).split(ys, ys, scafs))):
    tr, te = next(sp)
    trf = [fps[j] for j in tr]
    sims, nn_y = [], []
    for j in te:
        s = np.array(DataStructs.BulkTanimotoSimilarity(fps[j], trf))
        sims.append(round(float(s.max()), 3)); nn_y.append(int(ys[tr][s.argmax()]))
    split[name] = {"train_n": len(tr), "test_n": len(te), "sim": sims,
                   "y": ys[te].tolist(), "nn_y": nn_y}
OUT["split_seed0"] = split

with open(os.path.join(HERE, "graph-arc-mock-data.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(OUT, f, separators=(",", ":"))
print({k: (v["scaffold"], v["activity"]) for k, v in fam.items()})
print({k: (v["train_n"], v["test_n"], sum(v["y"])) for k, v in split.items()})
print("acids wl:", pairs["acids"][0]["wl"], pairs["acids"][1]["wl"])
print("rings wl:", pairs["rings"][0]["wl"], pairs["rings"][1]["wl"])
print(os.path.getsize(os.path.join(HERE, "graph-arc-mock-data.json")), "bytes")
