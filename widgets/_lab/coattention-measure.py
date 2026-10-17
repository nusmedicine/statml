"""10-2c: cross-attention against co-attention, with and without the residual connection.

His questions 2026-10-17: add a co-attention template; show co-attention in
the example instead of cross-attention; include the residual connection in the
template and the example. Measured through the notebook's own pipeline on the
v6b CSVs (generator seed 2030): the 80/20 stratified split (random_state 42),
expression standardized on the training rows, DataLoader(batch 256,
shuffle=True) built before seeding, then SEED set, the model built, Adam 1e-3,
10 epochs, CrossEntropyLoss. Five seeds.

Co-attention needs BOTH modalities as sequences: with one expression token,
each mutation token attending to it gets weight 1 and learns nothing (the
template's own note). So the expression side becomes one token per gene, built
like the mutation tokens: a learned vector per gene times the gene's
standardized value.

  arms
    cross          10-2c as written: GeneEncoder query (one token), mutation tokens
    cross_res      the same, h = attended + query (the residual connection)
    co             gene tokens and mutation tokens attend to each other; each
                   side's attended outputs averaged over its tokens; concatenated
    co_res         the same, each side's tokens added back before averaging
    co_res_ln      the same, then LayerNorm (a transformer block's Add & Norm)

Reported: test AUC per seed; for the co arms, the mean attention each gene
receives from the mutation tokens the patient carries (do the eight
informative genes and the flip gene rank first?) and the mean attention each
carried mutation receives from the gene tokens (do the five drivers?).

  python -I widgets/_lab/coattention-measure.py <bg-2030 dir>
writes widgets/_lab/coattention-measure.json (untracked).
"""
import json, os, random, sys
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from torch.utils.data import TensorDataset, DataLoader

D = sys.argv[1]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coattention-measure.json")
torch.set_num_threads(8)
truth = json.load(open(os.path.join(D, "synthetic_truth.json")))
INFO = [g - 1 for g in truth["info_genes"]]; FLIPG = truth["flip_gene"] - 1
DRV = [m - 1 for m in truth["driver_muts"]]; FLIPM = truth["flip_mut"] - 1

E = np.genfromtxt(os.path.join(D, "synthetic_expression.csv"), delimiter=",", skip_header=1)
M = np.loadtxt(os.path.join(D, "synthetic_mutations.csv"), delimiter=",", skiprows=1)
y = np.loadtxt(os.path.join(D, "synthetic_labels.csv"), skiprows=1).astype(int)
Etr, Ete, Mtr, Mte, ytr, yte = train_test_split(E, M, y, test_size=0.2, random_state=42, stratify=y)
sc = StandardScaler(); Etr = sc.fit_transform(Etr); Ete = sc.transform(Ete)
T = lambda a, dt=torch.float32: torch.tensor(a, dtype=dt)
train_loader = DataLoader(TensorDataset(T(Etr), T(Mtr), T(ytr, torch.long)), batch_size=256, shuffle=True)
XAt, XBt = T(Ete), T(Mte)
G, NM, DIM = E.shape[1], M.shape[1], 64


class GeneEncoder(nn.Module):   # 10-2b cell 20
    def __init__(self, in_dim, embed_dim=128, hidden=256, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class TokenEncoder(nn.Module):   # 10-2c's MutTokenEncoder; for genes the value is the standardized expression
    def __init__(self, n, embed_dim=64):
        super().__init__(); self.embed = nn.Embedding(n, embed_dim)
    def forward(self, x): return x.unsqueeze(-1) * self.embed.weight


class Cross(nn.Module):
    def __init__(self, residual):
        super().__init__(); self.residual = residual
        self.encA, self.encB = GeneEncoder(G, DIM), TokenEncoder(NM, DIM)
        self.attn = nn.MultiheadAttention(DIM, 1, batch_first=True)
        self.head = nn.Sequential(nn.Linear(DIM, 128), nn.ReLU(), nn.Linear(128, 2))
    def forward(self, xA, xB):
        Q = self.encA(xA).unsqueeze(1); K = self.encB(xB)
        out, w = self.attn(Q, K, K); self.w_AB = w.squeeze(1)
        h = out.squeeze(1) + (Q.squeeze(1) if self.residual else 0)
        return self.head(h)


class Co(nn.Module):
    def __init__(self, residual, norm):
        super().__init__(); self.residual, self.norm = residual, norm
        self.encA, self.encB = TokenEncoder(G, DIM), TokenEncoder(NM, DIM)
        self.attn_AB = nn.MultiheadAttention(DIM, 1, batch_first=True)   # genes attend to mutations
        self.attn_BA = nn.MultiheadAttention(DIM, 1, batch_first=True)   # mutations attend to genes
        self.ln_A, self.ln_B = nn.LayerNorm(DIM), nn.LayerNorm(DIM)
        self.head = nn.Sequential(nn.Linear(2 * DIM, 128), nn.ReLU(), nn.Linear(128, 2))
    def forward(self, xA, xB):
        A, B = self.encA(xA), self.encB(xB)                  # (B, 100, D), (B, 50, D)
        oA, wAB = self.attn_AB(A, B, B); oB, wBA = self.attn_BA(B, A, A)
        self.w_AB, self.w_BA = wAB, wBA                       # (B, 100, 50), (B, 50, 100)
        if self.residual: oA, oB = oA + A, oB + B
        if self.norm: oA, oB = self.ln_A(oA), self.ln_B(oB)
        return self.head(torch.cat([oA.mean(1), oB.mean(1)], 1))


ARMS = {"cross": lambda: Cross(False), "cross_res": lambda: Cross(True), "co": lambda: Co(False, False),
        "co_res": lambda: Co(True, False), "co_res_ln": lambda: Co(True, True)}
res = {"truth": {"info_genes": truth["info_genes"], "flip_gene": truth["flip_gene"], "drivers": truth["driver_muts"], "flip_mut": truth["flip_mut"]}, "arms": {}}
carried = Mte.astype(bool)
for name, make in ARMS.items():
    runs = []
    for seed in (42, 1, 2, 3, 4):
        random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
        model = make(); opt = torch.optim.Adam(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
        for ep in range(10):
            model.train()
            for xa, xb, yb in train_loader:
                loss = crit(model(xa, xb), yb); opt.zero_grad(); loss.backward(); opt.step()
        model.eval()
        with torch.no_grad(): p = model(XAt, XBt).softmax(1)[:, 1].numpy()
        r = {"seed": seed, "auc": round(float(roc_auc_score(yte, p)), 4)}
        with torch.no_grad():
            if name.startswith("co"):
                wBA = model.w_BA.numpy(); wAB = model.w_AB.numpy()
                # each gene's weight from the mutations the patient carries (non-carried tokens are zero vectors)
                gene_w = (wBA * carried[:, :, None]).sum((0, 1)) / carried.sum()
                order = np.argsort(-gene_w)
                r["info_gene_ranks"] = sorted(int(np.where(order == g)[0][0]) + 1 for g in INFO)
                r["flip_gene_rank"] = int(np.where(order == FLIPG)[0][0]) + 1
                # each carried mutation's weight from the gene tokens, averaged over genes, among carriers
                mut_w = (wAB.mean(1) * carried).sum(0) / carried.sum(0)
            else:
                mut_w = (model.w_AB.numpy() * carried).sum(0) / carried.sum(0)
            om = np.argsort(-mut_w)
            r["driver_ranks"] = sorted(int(np.where(om == d)[0][0]) + 1 for d in DRV)
            r["flip_mut_rank"] = int(np.where(om == FLIPM)[0][0]) + 1
        runs.append(r)
        print(name, r, flush=True)
    res["arms"][name] = {"runs": runs, "auc_mean": round(float(np.mean([r["auc"] for r in runs])), 4)}
    print(name, "mean AUC", res["arms"][name]["auc_mean"], flush=True)
json.dump(res, open(OUT, "w"), indent=1)
print("wrote", OUT)
