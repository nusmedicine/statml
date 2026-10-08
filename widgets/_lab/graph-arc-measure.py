"""Measurements for the graph arc (PHM5005 09): slots 94, 95 and 97.

Run:  python widgets/_lab/graph-arc-measure.py
Needs RDKit (pip install rdkit; 2026.03.6 when written) and scikit-learn.
Reads the lesson's molecule file, _lab/graph-fingat-training.csv (untracked;
the URL 09-2 cell 20 loads), and writes _lab/graph-arc-measure.json.

94  is SMILES lossless, and how far apart in the string are bonded atoms?
95  how many hops does a 2-layer GCN see; does depth make atoms alike; which
    molecules can mean or max pooling not tell apart?
97  how many scaffolds; what the lesson's split gives; how much a random split
    flatters a model against a scaffold split.
"""
import csv, json, os, re, random, statistics as st
from collections import Counter, defaultdict

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import rdFingerprintGenerator, DataStructs
from rdkit.Chem.Scaffolds import MurckoScaffold

RDLogger.DisableLog("rdApp.*")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = {}

rows = []
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rows.append((r["SMILES"], int(r["Activity"])))
mols = [Chem.MolFromSmiles(s) for s, _ in rows]
ok = [i for i, m in enumerate(mols) if m is not None and m.GetNumAtoms() > 0]
labels = np.array([rows[i][1] for i in ok])
OUT["data"] = {
    "rows": len(rows), "parsed": len(ok),
    "active": int(labels.sum()), "inactive": int((1 - labels).sum()),
    "multi_fragment": sum("." in rows[i][0] for i in ok),
    "atoms_median": st.median(mols[i].GetNumAtoms() for i in ok),
    "atoms_max": max(mols[i].GetNumAtoms() for i in ok),
}

# ---------------------------------------------------------------- 94
TOKEN = re.compile(r"(\[[^\]]+]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\(|\)|\.|=|#|-|\+|\\|/|:|~|@|\?|>|\*|\$|%[0-9]{2}|[0-9])")
ATOMISH = re.compile(r"^(\[.*]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\*)$")

def atom_tokens(smi):
    """Atom tokens in string order; RDKit numbers atoms in that same order."""
    toks = TOKEN.findall(smi)
    assert "".join(toks) == smi, smi
    pos, out = 0, []
    for t in toks:
        if ATOMISH.match(t):
            out.append((pos, t))
        pos += len(t)
    return out

def bond_gaps(smi, mol):
    toks = atom_tokens(smi)
    assert len(toks) == mol.GetNumAtoms(), smi
    gaps = []
    for b in mol.GetBonds():
        i, j = sorted((b.GetBeginAtomIdx(), b.GetEndAtomIdx()))
        gaps.append(j - i)          # 1 = consecutive atoms in the string
    return gaps

caffeine = "Cn1cnc2n(C)c(=O)n(C)c(=O)c12"
cm = Chem.MolFromSmiles(caffeine)
cg = bond_gaps(caffeine, cm)
canon = Chem.MolToSmiles(cm)
rand = {Chem.MolToSmiles(cm, doRandom=True) for _ in range(5000)}
OUT["94_caffeine"] = {
    "smiles": caffeine, "canonical": canon,
    "atoms": cm.GetNumAtoms(), "bonds": cm.GetNumBonds(),
    "atom_tokens": [t for _, t in atom_tokens(caffeine)],
    "bonds_list": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in cm.GetBonds()],
    "gaps": cg,
    "nonconsecutive_bonds": sum(g > 1 for g in cg),
    "max_gap": max(cg),
    "distinct_random_smiles_of_5000": len(rand),
    "random_examples": sorted(rand)[:4],
    "every_random_parses_to_same": all(Chem.MolToSmiles(Chem.MolFromSmiles(s)) == canon for s in rand),
}

all_gaps, roundtrip_ok = [], 0
for i in ok:
    s, m = rows[i][0], mols[i]
    try:
        all_gaps += bond_gaps(s, m)
    except AssertionError:
        pass
    c = Chem.MolToSmiles(m)
    roundtrip_ok += Chem.MolToSmiles(Chem.MolFromSmiles(c)) == c
g = np.array(all_gaps)
OUT["94_dataset"] = {
    "bonds": len(g),
    "share_consecutive": round(float((g == 1).mean()), 3),
    "share_gap_over_5": round(float((g > 5).mean()), 3),
    "median_gap_of_nonconsecutive": float(np.median(g[g > 1])),
    "max_gap": int(g.max()),
    "canonical_roundtrip_identical": roundtrip_ok,
}

# ---------------------------------------------------------------- 95
def adjacency(m):
    n = m.GetNumAtoms()
    A = np.zeros((n, n))
    for b in m.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        A[i, j] = A[j, i] = 1
    return A

def gcn_norm(A):
    At = A + np.eye(len(A))
    d = At.sum(1)
    return At / np.sqrt(np.outer(d, d))

def hops(A):
    n = len(A)
    D = np.full((n, n), np.inf)
    for s in range(n):
        D[s, s] = 0
        frontier, k = [s], 0
        while frontier:
            k += 1
            nxt = []
            for u in frontier:
                for v in np.nonzero(A[u])[0]:
                    if D[s, v] == np.inf:
                        D[s, v] = k
                        nxt.append(v)
            frontier = nxt
    return D

ATOM_VOCAB = sorted({a.GetSymbol() for i in ok for a in mols[i].GetAtoms()})
HYB = [Chem.HybridizationType.SP, Chem.HybridizationType.SP2, Chem.HybridizationType.SP3,
       Chem.HybridizationType.SP3D, Chem.HybridizationType.SP3D2]

def features(m):
    """09-2 cell 32's atom features, with the vocabulary sorted."""
    X = []
    for a in m.GetAtoms():
        v = [a.GetAtomicNum(), a.GetDegree(), a.GetTotalNumHs(), a.GetFormalCharge(),
             float(a.GetIsAromatic()), float(a.IsInRing())]
        v += [float(a.GetSymbol() == s) for s in ATOM_VOCAB]
        v += [float(a.GetHybridization() == h) for h in HYB]
        X.append(v)
    return np.array(X)

def spread(H):
    """Mean pairwise cosine distance between atoms' vectors."""
    Hn = H / (np.linalg.norm(H, axis=1, keepdims=True) + 1e-12)
    C = Hn @ Hn.T
    n = len(H)
    return float((1 - C)[np.triu_indices(n, 1)].mean())

D = hops(adjacency(cm))
OUT["95_caffeine"] = {
    "diameter": int(D[np.isfinite(D)].max()),
    "share_of_pairs_within_2_hops": round(float((D[np.triu_indices(len(D), 1)] <= 2).mean()), 3),
    "atoms_seen_after_k_layers_by_atom0": [int((D[0] <= k).sum()) for k in range(6)],
}

# Reach over the dataset (largest fragment only, so the diameter is finite).
diam, within2 = [], []
for i in ok:
    frags = Chem.GetMolFrags(mols[i], asMols=True)
    m = max(frags, key=lambda x: x.GetNumAtoms())
    if m.GetNumAtoms() < 2:
        continue
    Dm = hops(adjacency(m))
    diam.append(int(Dm.max()))
    within2.append(float((Dm[np.triu_indices(len(Dm), 1)] <= 2).mean()))
OUT["95_reach"] = {
    "diameter_median": st.median(diam), "diameter_p90": float(np.percentile(diam, 90)),
    "diameter_max": max(diam),
    "mean_share_of_atom_pairs_within_2_hops": round(st.mean(within2), 3),
}

# Oversmoothing: propagation alone, and with random weights + ReLU.
def smooth_curve(m, K=12, weights=False, seed=0):
    rng = np.random.default_rng(seed)
    P = gcn_norm(adjacency(m))
    H = features(m)
    H = (H - H.mean(0)) / (H.std(0) + 1e-9)        # standardise columns
    out = [spread(H)]
    for _ in range(K):
        H = P @ H
        if weights:
            W = rng.normal(0, np.sqrt(2 / H.shape[1]), (H.shape[1], 32))
            H = np.maximum(H @ W, 0)
        out.append(spread(H))
    return [round(x, 4) for x in out]

OUT["95_oversmoothing_caffeine"] = {
    "propagation_only": smooth_curve(cm),
    "random_W_relu_seed0": smooth_curve(cm, weights=True),
}
curves = np.array([smooth_curve(mols[i]) for i in ok if mols[i].GetNumAtoms() > 2])
OUT["95_oversmoothing_dataset_mean"] = [round(float(x), 4) for x in curves.mean(0)]

# Pooling: two 1-WL refinements stand in for any 2-layer GCN on these features
# (a GCN cannot separate atoms that 1-WL does not). Graphs whose colour
# MULTISET matches are inseparable whatever the pooling; matching colour
# PROPORTIONS defeats mean; matching colour SET defeats max.
def wl_colours(m, iters=2):
    col = [tuple(r) for r in features(m).tolist()]
    nbrs = [[n.GetIdx() for n in a.GetNeighbors()] for a in m.GetAtoms()]
    for _ in range(iters):
        col = [(col[v], tuple(sorted(col[u] for u in nbrs[v]))) for v in range(len(col))]
    return col

sigs = {}
for i in ok:
    c = Counter(wl_colours(mols[i]))
    n = sum(c.values())
    g = np.gcd.reduce(list(c.values()))
    sigs[i] = {
        "multiset": frozenset(c.items()),
        "proportion": frozenset((k, v // g) for k, v in c.items()),
        "set": frozenset(c),
    }

def collisions(key):
    groups = defaultdict(list)
    for i in ok:
        groups[sigs[i][key]].append(i)
    pairs = mixed = 0
    examples = []
    for idx in groups.values():
        if len(idx) < 2:
            continue
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                pairs += 1
                ya, yb = rows[idx[a]][1], rows[idx[b]][1]
                if ya != yb:
                    mixed += 1
                if len(examples) < 6 and Chem.MolToSmiles(mols[idx[a]]) != Chem.MolToSmiles(mols[idx[b]]):
                    examples.append([rows[idx[a]][0], ya, rows[idx[b]][0], yb])
    return {"pairs": pairs, "pairs_with_different_labels": mixed, "examples": examples}

sum_c, mean_c, max_c = collisions("multiset"), collisions("proportion"), collisions("set")
OUT["95_pooling_dataset"] = {
    "sum_inseparable": sum_c,
    "mean_inseparable": mean_c,
    "max_inseparable": max_c,
}

# The textbook pair: every atom alike, so mean and max are one atom's vector.
pairs = [("C1CC1", "C1CCCCC1"), ("c1ccccc1", "c1ccc2ccccc2c1"), ("CC", "CCCC")]
OUT["95_pooling_pairs"] = []
for a, b in pairs:
    ma, mb = Chem.MolFromSmiles(a), Chem.MolFromSmiles(b)
    sa, sb = Counter(wl_colours(ma)), Counter(wl_colours(mb))
    ga, gb = np.gcd.reduce(list(sa.values())), np.gcd.reduce(list(sb.values()))
    OUT["95_pooling_pairs"].append({
        "a": a, "b": b,
        "mean_same": {k: v // ga for k, v in sa.items()} == {k: v // gb for k, v in sb.items()},
        "max_same": set(sa) == set(sb),
        "sum_same": sa == sb,
    })

# ---------------------------------------------------------------- 97
def scaffold(m):
    try:
        return Chem.MolToSmiles(MurckoScaffold.GetScaffoldForMol(m))
    except Exception:
        return ""

scaf = {i: scaffold(mols[i]) for i in ok}
sc = Counter(scaf.values())
OUT["97_scaffolds"] = {
    "unique": len(sc),
    "acyclic_empty_scaffold": sc.get("", 0),
    "singletons": sum(1 for v in sc.values() if v == 1),
    "largest_groups": sc.most_common(6),
    "molecules_in_groups_of_2plus": sum(v for v in sc.values() if v > 1),
}

from sklearn.model_selection import GroupShuffleSplit, StratifiedShuffleSplit
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, f1_score

# The lesson's split, reproduced (cell 28; the lesson keeps unparsed rows in
# df, so split on all rows and drop unparsed afterwards, as its Dataset does).
all_y = np.array([y for _, y in rows])
all_scaf = np.array([scaffold(m) if m is not None else "" for m in mols])
tv = GroupShuffleSplit(test_size=0.2, random_state=42)
tr_idx, vt_idx = next(tv.split(all_y, groups=all_scaf))
v_rel, t_rel = next(GroupShuffleSplit(test_size=0.5, random_state=42).split(vt_idx, groups=all_scaf[vt_idx]))
va_idx, te_idx = vt_idx[v_rel], vt_idx[t_rel]
OUT["97_lesson_split"] = {
    k: {"n": len(ix), "active_share": round(float(all_y[ix].mean()), 3),
        "scaffolds": len(set(all_scaf[ix]))}
    for k, ix in (("train", tr_idx), ("val", va_idx), ("test", te_idx))
}
# Where the acyclic molecules (empty scaffold, one group) landed.
OUT["97_lesson_split"]["empty_scaffold_in"] = [k for k, ix in (("train", tr_idx), ("val", va_idx), ("test", te_idx)) if "" in set(all_scaf[ix])]

gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
fps = {i: gen.GetFingerprint(mols[i]) for i in ok}
Xfp = np.array([np.array(list(fps[i]), dtype=np.uint8) for i in ok])
groups = np.array([scaf[i] for i in ok])
okarr = np.array(ok)

def nn_sim(train, test):
    tr = [fps[okarr[j]] for j in train]
    return [max(DataStructs.BulkTanimotoSimilarity(fps[okarr[j]], tr)) for j in test]

def one_nn_scores(train, test):
    tr = [fps[okarr[j]] for j in train]
    s = []
    for j in test:
        sims = np.array(DataStructs.BulkTanimotoSimilarity(fps[okarr[j]], tr))
        s.append(labels[train][sims.argmax()] * sims.max() + (1 - labels[train][sims.argmax()]) * (1 - sims.max()))
    return np.array(s)

res = defaultdict(lambda: defaultdict(list))
for seed in range(10):
    splits = {
        "random": next(StratifiedShuffleSplit(1, test_size=0.2, random_state=seed).split(Xfp, labels)),
        "scaffold": next(GroupShuffleSplit(1, test_size=0.2, random_state=seed).split(Xfp, labels, groups)),
    }
    for name, (tr, te) in splits.items():
        if labels[te].min() == labels[te].max():
            continue
        sims = nn_sim(tr, te)
        res[name]["nn_sim_median"].append(float(np.median(sims)))
        res[name]["share_test_with_neighbour_over_0.7"].append(float(np.mean(np.array(sims) > 0.7)))
        res[name]["test_n"].append(len(te))
        rf = RandomForestClassifier(500, class_weight="balanced", random_state=seed, n_jobs=-1).fit(Xfp[tr], labels[tr])
        p = rf.predict_proba(Xfp[te])[:, 1]
        res[name]["rf_auc"].append(roc_auc_score(labels[te], p))
        res[name]["rf_macro_f1"].append(f1_score(labels[te], (p > 0.5).astype(int), average="macro"))
        s1 = one_nn_scores(tr, te)
        res[name]["1nn_auc"].append(roc_auc_score(labels[te], s1))
        # The actives: how close is each to the training set, and is its
        # nearest training molecule active too?
        act = [j for j in te if labels[j] == 1]
        trl = [fps[okarr[j]] for j in tr]
        nn_act, nn_s = [], []
        for j in act:
            s = np.array(DataStructs.BulkTanimotoSimilarity(fps[okarr[j]], trl))
            nn_act.append(labels[tr][s.argmax()])
            nn_s.append(s.max())
        res[name]["test_actives"].append(len(act))
        res[name]["actives_nn_sim_median"].append(float(np.median(nn_s)))
        res[name]["actives_whose_nn_is_active"].append(float(np.mean(nn_act)))
        res[name]["rf_recall_actives"].append(float(np.mean(p[labels[te] == 1] > 0.5)))

OUT["97_random_vs_scaffold_10_seeds"] = {
    name: {k: {"mean": round(st.mean(v), 3), "min": round(min(v), 3), "max": round(max(v), 3)}
           for k, v in d.items()}
    for name, d in res.items()
}

with open(os.path.join(HERE, "graph-arc-measure.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(OUT, f, indent=1, default=str)
print(json.dumps(OUT, indent=1, default=str)[:12000])
