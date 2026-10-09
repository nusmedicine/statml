"""Slot 95: does a TRAINED GAT's attention move away from uniform?

Run:  python widgets/_lab/message-passing-trained.py [seed]   (42, the lesson's, by default)
Needs torch, RDKit, numpy; reads _lab/graph-fingat-training.csv (untracked) and
writes _lab/message-passing-trained.json (untracked).

message-passing-measure.py found an untrained GAT's alpha within a few hundredths
of 1/(neighbours + 1) on every caffeine atom, with the seeds agreeing on the top
neighbour at chance. Before the widget shows alpha at all, this trains 09-2 cell
64's GATNet (hidden 256, heads 4 then 1, edge_dim 7, ELU, BatchNorm, dropout 0.1,
max pooling) with cells 45-51's set-up (AdamW 1e-3, weight decay 1e-4, class-
weighted cross-entropy, batch 64) and reads alpha again. GATConv is written out
from PyG's definition, as in the measure script; torch_geometric is not installed.
"""
import csv, json, os, random, sys

import numpy as np
import torch
import torch.nn as nn
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
HERE = os.path.dirname(os.path.abspath(__file__))
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 42
torch.manual_seed(SEED); random.seed(SEED); np.random.seed(SEED)
torch.set_num_threads(8)

rows = []
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rows.append((r["SMILES"], int(r["Activity"])))
mols = [(Chem.MolFromSmiles(s), y, s) for s, y in rows]
mols = [(m, y, s) for m, y, s in mols if m is not None and m.GetNumAtoms() > 0]

ATOM_VOCAB = sorted({a.GetSymbol() for m, _, _ in mols for a in m.GetAtoms()})
HYB = [Chem.HybridizationType.SP, Chem.HybridizationType.SP2, Chem.HybridizationType.SP3,
       Chem.HybridizationType.SP3D, Chem.HybridizationType.SP3D2]
CHI = [Chem.ChiralType.CHI_UNSPECIFIED, Chem.ChiralType.CHI_TETRAHEDRAL_CW,
       Chem.ChiralType.CHI_TETRAHEDRAL_CCW]
BT = [Chem.BondType.SINGLE, Chem.BondType.DOUBLE, Chem.BondType.TRIPLE, Chem.BondType.AROMATIC]

def graph(m):
    X = []
    for a in m.GetAtoms():
        v = [a.GetAtomicNum(), a.GetDegree(), a.GetTotalNumHs(), a.GetFormalCharge(),
             float(a.GetIsAromatic()), float(a.IsInRing())]
        v += [float(a.GetSymbol() == s) for s in ATOM_VOCAB]
        v += [float(a.GetHybridization() == h) for h in HYB]
        v += [float(a.GetChiralTag() == c) for c in CHI]
        X.append(v)
    src, dst, ea = [], [], []
    for b in m.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        f = [float(b.GetBondType() == t) for t in BT] + \
            [float(b.GetIsConjugated()), float(b.GetIsAromatic()), float(b.IsInRing())]
        src += [i, j]; dst += [j, i]; ea += [f, f]
    return (torch.tensor(X, dtype=torch.float), torch.tensor([src, dst], dtype=torch.long).reshape(2, -1),
            torch.tensor(ea, dtype=torch.float).reshape(-1, 7))

data = [(*graph(m), y) for m, y, _ in mols]
F_IN = data[0][0].shape[1]

def collate(items):
    xs, eis, eas, ys, bs, off = [], [], [], [], [], 0
    for g, (x, ei, ea, y) in enumerate(items):
        xs.append(x); eis.append(ei + off); eas.append(ea); ys.append(y)
        bs.append(torch.full((len(x),), g, dtype=torch.long)); off += len(x)
    return torch.cat(xs), torch.cat(eis, 1), torch.cat(eas), torch.tensor(ys), torch.cat(bs), len(items)

def glorot_(t):
    b = (6 / (t.shape[-2] + t.shape[-1])) ** 0.5
    with torch.no_grad():
        t.uniform_(-b, b)
    return t

class GATConv(nn.Module):
    def __init__(self, fin, fout, heads, edge_dim, concat, dropout):
        super().__init__()
        self.h, self.o, self.concat, self.p = heads, fout, concat, dropout
        self.W = nn.Parameter(glorot_(torch.empty(fin, heads * fout)))
        self.a_src = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.a_dst = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.We = nn.Parameter(glorot_(torch.empty(edge_dim, heads * fout)))
        self.a_e = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.bias = nn.Parameter(torch.zeros(heads * fout if concat else fout))
        self.last_alpha = None

    def forward(self, x, ei, ea):
        n = x.shape[0]
        src, dst = ei
        # self-loops, edge_attr filled with the mean of the node's incoming edges
        fill = torch.zeros(n, ea.shape[1]).index_add_(0, dst, ea)
        cnt = torch.zeros(n).index_add_(0, dst, torch.ones(len(dst))).clamp(min=1)
        loops = torch.arange(n)
        src2, dst2 = torch.cat([src, loops]), torch.cat([dst, loops])
        ea2 = torch.cat([ea, fill / cnt[:, None]])
        Wx = (x @ self.W).view(n, self.h, self.o)
        e = (Wx[src2] * self.a_src).sum(-1) + (Wx[dst2] * self.a_dst).sum(-1) \
            + ((ea2 @ self.We).view(-1, self.h, self.o) * self.a_e).sum(-1)
        e = nn.functional.leaky_relu(e, 0.2)
        emax = torch.full((n, self.h), -1e30).scatter_reduce(0, dst2[:, None].expand(-1, self.h), e, "amax")
        ex = (e - emax[dst2]).exp()
        den = torch.zeros(n, self.h).index_add_(0, dst2, ex)
        alpha = ex / den[dst2]
        self.last_alpha = (alpha.detach(), src2, dst2)
        alpha = nn.functional.dropout(alpha, self.p, self.training)
        out = torch.zeros(n, self.h, self.o).index_add_(0, dst2, alpha[:, :, None] * Wx[src2])
        out = out.reshape(n, -1) if self.concat else out.mean(1)
        return out + self.bias

class GATNet(nn.Module):
    def __init__(self, hidden=256, heads1=4, dropout=0.1):
        super().__init__()
        self.gat1 = GATConv(F_IN, hidden, heads1, 7, True, dropout)
        self.gat2 = GATConv(hidden * heads1, hidden, 1, 7, False, dropout)
        self.head = nn.Sequential(nn.Linear(hidden, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, 2))
        self.bn1, self.bn2 = nn.BatchNorm1d(hidden * heads1), nn.BatchNorm1d(hidden)
        self.act, self.drop = nn.ELU(), nn.Dropout(dropout)

    def forward(self, x, ei, ea, batch, B):
        x = self.drop(self.bn1(self.act(self.gat1(x, ei, ea))))
        x = self.drop(self.bn2(self.act(self.gat2(x, ei, ea))))
        g = torch.full((B, x.shape[1]), -1e30).scatter_reduce(0, batch[:, None].expand(-1, x.shape[1]), x, "amax")
        return self.head(g)

def alpha_stats(model, items):
    """Per atom: max alpha over its inputs minus 1/inputs; mean over atoms, per layer."""
    model.eval()
    out = {}
    with torch.no_grad():
        x, ei, ea, y, b, B = collate(items)
        model(x, ei, ea, b, B)
        for name, conv in (("layer1", model.gat1), ("layer2", model.gat2)):
            a, s2, d2 = conv.last_alpha
            n = x.shape[0]
            amax = torch.zeros(n, a.shape[1]).scatter_reduce(0, d2[:, None].expand(-1, a.shape[1]), a, "amax")
            m = torch.zeros(n).index_add_(0, d2, torch.ones(len(d2)))
            excess = (amax - 1 / m[:, None])
            out[name] = {"mean_max_alpha_minus_uniform": round(float(excess.mean()), 3),
                         "share_of_atom_heads_with_max_alpha_over_2x_uniform":
                             round(float((amax > 2 / m[:, None]).float().mean()), 3)}
    return out

def caffeine_alpha(model):
    caf = Chem.MolFromSmiles("Cn1c(=O)c2c(ncn2C)n(C)c1=O")
    x, ei, ea = graph(caf)
    model.eval()
    with torch.no_grad():
        model(x, ei, ea, torch.zeros(len(x), dtype=torch.long), 1)
    res = {}
    for name, conv in (("layer1", model.gat1), ("layer2", model.gat2)):
        a, s2, d2 = conv.last_alpha
        res[name] = []
        for i in range(len(x)):
            k = (d2 == i).nonzero().flatten()
            res[name].append({"atom": i, "from": s2[k].tolist(),
                              "alpha": [[round(float(v), 3) for v in a[kk]] for kk in k]})
    return res

random.shuffle(data)
n_test = len(data) // 5
test, train = data[:n_test], data[n_test:]
N1 = sum(d[3] for d in train); N0 = len(train) - N1
w = torch.tensor([len(train) / (2 * N0), len(train) / (2 * N1)])
model = GATNet()
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
crit = nn.CrossEntropyLoss(weight=w)

OUT = {"untrained": {"file": alpha_stats(model, data), "caffeine": caffeine_alpha(model)}, "epochs": []}
EPOCHS = 30
for ep in range(EPOCHS):
    model.train()
    random.shuffle(train)
    tot = 0
    for k in range(0, len(train), 64):
        x, ei, ea, y, b, B = collate(train[k:k + 64])
        loss = crit(model(x, ei, ea, b, B), y)
        opt.zero_grad(); loss.backward(); opt.step()
        tot += float(loss.detach()) * B
    model.eval()
    with torch.no_grad():
        x, ei, ea, y, b, B = collate(test)
        p = model(x, ei, ea, b, B).softmax(1)[:, 1].numpy()
    yt = y.numpy()
    order = np.argsort(-p); ranks = np.empty(len(p)); ranks[order] = np.arange(len(p))
    pos = ranks[yt == 1]; npos, nneg = len(pos), len(yt) - len(pos)
    auc = 1 - (pos.sum() - npos * (npos - 1) / 2) / (npos * nneg)
    stats = alpha_stats(model, data)
    OUT["epochs"].append({"epoch": ep + 1, "train_loss": round(tot / len(train), 4), "test_auc": round(float(auc), 3), **stats})
    print(OUT["epochs"][-1], flush=True)

OUT["trained"] = {"file": alpha_stats(model, data), "caffeine": caffeine_alpha(model)}
with open(os.path.join(HERE, f"message-passing-trained{'' if SEED == 42 else '-' + str(SEED)}.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(OUT, f, indent=1)
print("wrote", SEED)
