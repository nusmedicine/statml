"""Measurements for slot 95, message-passing, under the lesson's own layers.

Run:  python widgets/_lab/message-passing-measure.py
Needs RDKit and numpy; reads _lab/graph-fingat-training.csv (untracked) and
writes _lab/message-passing-measure.json (untracked).

graph-arc-measure.py answered 95's questions with stand-ins: two 1-WL colour
rounds for "what can a 2-layer GCN separate", and propagation with a fresh
random W per layer for oversmoothing. This file re-asks each question of the
layers 09-2 actually builds (cells 42 and 64), implemented from PyG's
definitions because torch_geometric is not installed here:

  GCNConv   out = D^-1/2 (A + I) D^-1/2 X W + b, glorot W, zero b
  GATConv   self-loops added (edge_attr filled with the mean of the node's
            incoming edges), e_ij = LeakyReLU_0.2(a_src.W x_j + a_dst.W x_i
            + a_edge.W_e e_ij), alpha = softmax over j in N(i) + {i},
            heads concatenated or averaged, glorot everywhere, zero b

and the lesson's block around them: BatchNorm (identity at initialisation, in
eval mode), ELU, dropout off. Atom features are cell 32's, chirality included,
with the vocabulary sorted (finding 3).
"""
import csv, json, os
from collections import Counter

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

RDLogger.DisableLog("rdApp.*")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = {}

rows = []
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rows.append((r["SMILES"], int(r["Activity"])))
mols = [Chem.MolFromSmiles(s) for s, _ in rows]
ok = [i for i, m in enumerate(mols) if m is not None and m.GetNumAtoms() > 0]

# ------------------------------------------------------------ cell 32's features
ATOM_VOCAB = sorted({a.GetSymbol() for i in ok for a in mols[i].GetAtoms()})
HYB = [Chem.HybridizationType.SP, Chem.HybridizationType.SP2, Chem.HybridizationType.SP3,
       Chem.HybridizationType.SP3D, Chem.HybridizationType.SP3D2]
CHI = [Chem.ChiralType.CHI_UNSPECIFIED, Chem.ChiralType.CHI_TETRAHEDRAL_CW,
       Chem.ChiralType.CHI_TETRAHEDRAL_CCW]
BT = [Chem.BondType.SINGLE, Chem.BondType.DOUBLE, Chem.BondType.TRIPLE, Chem.BondType.AROMATIC]

def atom_x(m):
    X = []
    for a in m.GetAtoms():
        v = [a.GetAtomicNum(), a.GetDegree(), a.GetTotalNumHs(), a.GetFormalCharge(),
             float(a.GetIsAromatic()), float(a.IsInRing())]
        v += [float(a.GetSymbol() == s) for s in ATOM_VOCAB]
        v += [float(a.GetHybridization() == h) for h in HYB]
        v += [float(a.GetChiralTag() == c) for c in CHI]
        X.append(v)
    return np.array(X, dtype=np.float64)

def edges(m):
    """edge_index both ways, and cell 32's bond features for each direction."""
    src, dst, ea = [], [], []
    for b in m.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        f = [float(b.GetBondType() == t) for t in BT] + \
            [float(b.GetIsConjugated()), float(b.GetIsAromatic()), float(b.IsInRing())]
        src += [i, j]; dst += [j, i]; ea += [f, f]
    return np.array(src, int), np.array(dst, int), np.array(ea, dtype=np.float64).reshape(-1, 7)

F_IN = len(atom_x(Chem.MolFromSmiles("C"))[0])
OUT["features"] = {"atom": F_IN, "bond": 7, "vocab": ATOM_VOCAB}

# ------------------------------------------------------------ the layers
def glorot(rng, *shape):
    fan = shape[-2] + shape[-1]
    b = np.sqrt(6 / fan)
    return rng.uniform(-b, b, shape)

def elu(z):
    return np.where(z > 0, z, np.expm1(np.minimum(z, 0)))

def gcn_P(n, src, dst):
    A = np.zeros((n, n))
    A[dst, src] = 1
    A += np.eye(n)
    d = A.sum(1)
    return A / np.sqrt(np.outer(d, d))

class GCN:
    def __init__(self, rng, fin, fout):
        self.W = glorot(rng, fin, fout)
    def __call__(self, X, P):
        return P @ (X @ self.W)

class GAT:
    def __init__(self, rng, fin, fout, heads, edge_dim, concat):
        self.h, self.o, self.concat = heads, fout, concat
        self.W = glorot(rng, fin, heads * fout)
        self.a_src = glorot(rng, heads, fout)
        self.a_dst = glorot(rng, heads, fout)
        self.edge = edge_dim is not None
        if self.edge:
            self.We = glorot(rng, edge_dim, heads * fout)
            self.a_e = glorot(rng, heads, fout)

    def alpha(self, X, src, dst, ea):
        """alpha[k, h] for each edge k (self-loops appended), and the full edge list."""
        n = len(X)
        # self-loops, edge_attr filled with the mean of each node's incoming edges
        loops = np.arange(n)
        if self.edge:
            fill = np.zeros((n, ea.shape[1])); cnt = np.zeros(n)
            np.add.at(fill, dst, ea); np.add.at(cnt, dst, 1)
            fill = fill / np.maximum(cnt, 1)[:, None]
            ea2 = np.vstack([ea, fill])
        s2, d2 = np.concatenate([src, loops]), np.concatenate([dst, loops])
        Wx = (X @ self.W).reshape(n, self.h, self.o)
        e = (Wx[s2] * self.a_src).sum(-1) + (Wx[d2] * self.a_dst).sum(-1)
        if self.edge:
            We = (ea2 @ self.We).reshape(-1, self.h, self.o)
            e = e + (We * self.a_e).sum(-1)
        e = np.where(e > 0, e, 0.2 * e)
        a = np.zeros_like(e)
        for i in range(n):                        # softmax over the edges into i
            k = d2 == i
            z = e[k] - e[k].max(0)
            a[k] = np.exp(z) / np.exp(z).sum(0)
        return a, s2, d2, Wx

    def __call__(self, X, src, dst, ea):
        a, s2, d2, Wx = self.alpha(X, src, dst, ea)
        n = len(X)
        out = np.zeros((n, self.h, self.o))
        np.add.at(out, d2, a[:, :, None] * Wx[s2])
        return out.reshape(n, -1) if self.concat else out.mean(1)

def gcn_net(rng, hidden=256):
    c1, c2 = GCN(rng, F_IN, hidden), GCN(rng, hidden, hidden)
    def run(m, layers=2):
        X = atom_x(m); s, d, _ = edges(m); P = gcn_P(len(X), s, d)
        H = elu(c1(X, P))
        if layers > 1: H = elu(c2(H, P))
        return H
    return run

def gat_net(rng, hidden=256, heads1=4, edge=True):
    g1 = GAT(rng, F_IN, hidden, heads1, 7 if edge else None, True)
    g2 = GAT(rng, hidden * heads1, hidden, 1, 7 if edge else None, False)
    def run(m):
        X = atom_x(m); s, d, ea = edges(m)
        return elu(g2(elu(g1(X, s, d, ea)), s, d, ea))
    return run

def spread(H):
    Hn = H / (np.linalg.norm(H, axis=1, keepdims=True) + 1e-12)
    C = Hn @ Hn.T
    return float((1 - C)[np.triu_indices(len(H), 1)].mean())

CAF = Chem.MolFromSmiles("Cn1c(=O)c2c(ncn2C)n(C)c1=O")

# ------------------------------------------------------------ M1 the chain
# His figure: three nodes in a line, degree 1-2-1, with self-loops 2-3-2.
P = gcn_P(3, np.array([0, 1, 1, 2]), np.array([1, 0, 2, 1]))
OUT["M1_chain_gcn_weights_into_node1"] = [round(float(v), 4) for v in P[1]]
OUT["M1_chain_gcn_weights_into_node0"] = [round(float(v), 4) for v in P[0]]

# ------------------------------------------------------------ M2 GCN on caffeine
s, d, ea = edges(CAF)
Pc = gcn_P(CAF.GetNumAtoms(), s, d)
deg = [a.GetDegree() for a in CAF.GetAtoms()]
OUT["M2_caffeine"] = {
    "atoms": [a.GetSymbol() for a in CAF.GetAtoms()],
    "degree": deg,
    "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in CAF.GetBonds()],
    # GCN's weight on a bond depends on the two degrees only; bonds of different
    # type between atoms of the same degrees get the same weight:
    "gcn_weight_by_bond": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType()),
                            round(float(Pc[b.GetEndAtomIdx(), b.GetBeginAtomIdx()]), 4)] for b in CAF.GetBonds()],
}

# ------------------------------------------------------------ M3 untrained GAT's alpha
# For each atom of caffeine: alpha over its neighbours and itself, layer 1, head 0,
# across 20 seeds; how far from uniform, and does the ranking hold between seeds?
def alpha_table(seed, edge):
    rng = np.random.default_rng(seed)
    g = GAT(rng, F_IN, 256, 4, 7 if edge else None, True)
    a, s2, d2, _ = g.alpha(atom_x(CAF), s, d, ea)
    return a[:, 0], s2, d2

res = {}
for edge in (True, False):
    max_over_uniform, top_agree, tabs = [], [], []
    for seed in range(20):
        a, s2, d2 = alpha_table(seed, edge)
        tabs.append(a)
    tabs = np.array(tabs)                          # seeds × edges
    n = CAF.GetNumAtoms()
    per_atom = []
    for i in range(n):
        k = np.nonzero(d2 == i)[0]
        m = len(k)
        A = tabs[:, k]                             # seeds × (neighbours + self)
        tops = A.argmax(1)
        per_atom.append({
            "atom": i, "inputs": m,
            "alpha_seed0": [round(float(v), 3) for v in A[0]],
            "from": [int(v) for v in s2[k]],
            "max_alpha_mean_over_seeds": round(float(A.max(1).mean()), 3),
            "uniform": round(1 / m, 3),
            "share_of_seeds_agreeing_on_top": round(float(Counter(tops).most_common(1)[0][1] / len(tops)), 2),
        })
    res["with_edge_attr" if edge else "without_edge_attr"] = per_atom
OUT["M3_gat_alpha_untrained_caffeine"] = res

# ------------------------------------------------------------ M4 oversmoothing, the lesson's block
def smooth(m, K=12, seed=0, kind="gcn"):
    rng = np.random.default_rng(seed)
    X = atom_x(m); s_, d_, ea_ = edges(m); P_ = gcn_P(len(X), s_, d_)
    H = X
    out = [spread(H)]
    fin = F_IN
    for _ in range(K):
        if kind == "gcn":
            H = elu(GCN(rng, fin, 256)(H, P_))
        elif kind == "prop":
            H = P_ @ H
        fin = H.shape[1]
        out.append(spread(H))
    return out

OUT["M4_caffeine_spread"] = {
    "gcn_elu_seed0_to_seed4": [[round(v, 3) for v in smooth(CAF, seed=k)] for k in range(5)],
    "propagation_only": [round(v, 3) for v in smooth(CAF, kind="prop")],
}
sample = [i for i in ok if mols[i].GetNumAtoms() > 2][::7]
curves = np.array([smooth(mols[i], seed=0) for i in sample])
OUT["M4_file_spread_gcn_elu"] = {"molecules": len(sample),
                                 "mean": [round(float(v), 3) for v in curves.mean(0)],
                                 "p10": [round(float(v), 3) for v in np.percentile(curves, 10, 0)],
                                 "p90": [round(float(v), 3) for v in np.percentile(curves, 90, 0)]}

# Cosine distance on cell 32's raw features starts near 0.08: the atomic number
# (6-8 here, up to 83 in the file) dwarfs the 0/1 columns, so every atom's vector
# points the same way before any layer (a notebook finding). M4b standardises
# each column over the file first, as a scaler would, and asks the same question.
# (A share-of-unshared-norm measure was tried and dropped: GCN's symmetric
# normalisation converges to vectors PARALLEL but scaled by sqrt(degree + 1), so
# a norm-based measure plateaus while the directions keep converging.)
COLS = np.vstack([atom_x(mols[i]) for i in ok])
MU, SD = COLS.mean(0), COLS.std(0) + 1e-9

def smooth_std(m, K=8, seed=0, kind="gcn"):
    rng = np.random.default_rng(seed)
    X = (atom_x(m) - MU) / SD; s_, d_, _ = edges(m); P_ = gcn_P(len(X), s_, d_)
    H = X; out = [spread(H)]; fin = H.shape[1]
    for _ in range(K):
        H = elu(GCN(rng, fin, 256)(H, P_)) if kind == "gcn" else P_ @ H
        fin = H.shape[1]; out.append(spread(H))
    return [round(v, 3) for v in out]

OUT["M4b_caffeine_spread_standardised"] = {
    "gcn_elu_seeds_0_1_2": [smooth_std(CAF, seed=k) for k in range(3)],
    "propagation_only": smooth_std(CAF, kind="prop"),
}
for name, keep in (("single_piece", lambda i: "." not in rows[i][0]), ("salts", lambda i: "." in rows[i][0])):
    idx = [i for i in ok if mols[i].GetNumAtoms() > 2 and keep(i)][::7]
    c = np.array([smooth_std(mols[i]) for i in idx])
    OUT[f"M4b_file_{name}_gcn_elu_standardised"] = {
        "molecules": len(idx), "mean": [round(float(v), 3) for v in c.mean(0)],
        "p10": [round(float(v), 3) for v in np.percentile(c, 10, 0)],
        "p90": [round(float(v), 3) for v in np.percentile(c, 90, 0)]}

# ------------------------------------------------------------ M5 pooling, the real layers
def pooled_collisions(net, tol=1e-9):
    keys = {"sum": {}, "mean": {}, "max": {}}
    for i in ok:
        H = net(mols[i])
        for name, v in (("sum", H.sum(0)), ("mean", H.mean(0)), ("max", H.max(0))):
            k = tuple(np.round(v / tol ** 0.5, 0).astype(np.int64)[:32])   # coarse key, checked below
            keys[name].setdefault(k, []).append((i, v))
    out = {}
    for name, groups in keys.items():
        pairs = []
        for g in groups.values():
            for a in range(len(g)):
                for b in range(a + 1, len(g)):
                    (ia, va), (ib, vb) = g[a], g[b]
                    if np.max(np.abs(va - vb)) < 1e-6 and \
                       Chem.MolToSmiles(mols[ia]) != Chem.MolToSmiles(mols[ib]):
                        pairs.append([rows[ia][0], rows[ia][1], rows[ib][0], rows[ib][1]])
        out[name] = {"pairs": len(pairs), "examples": pairs[:8]}
    return out

OUT["M5_pooling_gcn_seed0"] = pooled_collisions(gcn_net(np.random.default_rng(0)))
OUT["M5_pooling_gcn_seed1"] = pooled_collisions(gcn_net(np.random.default_rng(1)))
OUT["M5_pooling_gat_edge_seed0"] = pooled_collisions(gat_net(np.random.default_rng(0)))

# ------------------------------------------------------------ M6 the acids, atom by atom
SUB, AZE = "O=C(O)CCCCCCC(=O)O", "O=C(O)CCCCCCCC(=O)O"
def classes(smi, net):
    m = Chem.MolFromSmiles(smi)
    H = net(m)
    reps, cls = [], []
    for h in H:
        for c, r in enumerate(reps):
            if np.max(np.abs(h - r)) < 1e-9:
                cls.append(c); break
        else:
            reps.append(h); cls.append(len(reps) - 1)
    return m, H, cls

net = gcn_net(np.random.default_rng(0))
acid = {}
allreps = []
for name, smi in (("suberic", SUB), ("azelaic", AZE)):
    m, H, _ = classes(smi, net)
    # classes shared across the two molecules
    cl = []
    for h in H:
        for c, r in enumerate(allreps):
            if np.max(np.abs(h - r)) < 1e-9:
                cl.append(c); break
        else:
            allreps.append(h); cl.append(len(allreps) - 1)
    AllChem.Compute2DCoords(m)
    xy = m.GetConformer().GetPositions()[:, :2]
    acid[name] = {
        "smiles": smi,
        "label": next(y for s_, y in rows if s_ == smi),
        "atoms": [a.GetSymbol() for a in m.GetAtoms()],
        "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), str(b.GetBondType())] for b in m.GetBonds()],
        "class_after_2_layers": cl,
        "xy": [[round(float(x), 3), round(float(y), 3)] for x, y in xy],
        "max": H.max(0), "mean": H.mean(0), "sum": H.sum(0),
    }
for k in ("max", "mean", "sum"):
    OUT[f"M6_acids_{k}_maxabsdiff"] = float(np.max(np.abs(acid["suberic"][k] - acid["azelaic"][k])))
for a in acid.values():
    for k in ("max", "mean", "sum"):
        del a[k]
OUT["M6_acids"] = acid
OUT["M6_acids_class_count"] = len(allreps)

with open(os.path.join(HERE, "message-passing-measure.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(OUT, f, indent=1)
print("wrote message-passing-measure.json")
