"""10-2c: cross-attention the other way round, the mutations asking and the genes as the parts.

His question 2026-10-17 ("how do we biologically choose which is the summary
and parts?"): the v6b data put their one context effect on the mutation side
(gene 8's effect flips with mutation 27), so a mutation query over gene tokens
may match the data better than 10-2c's expression query over mutation tokens.
Same pipeline as `coattention-measure.py` (whose loading, encoders and seeds
this file reuses): the query is 10-2b's MutEncoder (50 mutations -> one 64-dim
vector), the keys and values are 100 gene tokens (a learned vector per gene
times its standardized value).

Reported per seed: test AUC; the rank of each informative gene and of the flip
gene by mean attention over the test patients; and the context test, the mean
weight on gene 8 in carriers of mutation 27 against non-carriers.

  python -I widgets/_lab/reverse-attention-measure.py <bg-2030 dir>
writes widgets/_lab/reverse-attention-measure.json (untracked).
"""
import json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "coattention-measure.py"), encoding="utf-8").read()
exec(src[src.index("import json"):src.index("ARMS = {")])   # data, loader, truth, GeneEncoder, TokenEncoder, Cross, Co
OUT = os.path.join(HERE, "reverse-attention-measure.json")


class MutEncoder(nn.Module):   # 10-2b cell 20
    def __init__(self, in_dim, embed_dim=64, hidden=128, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class Reverse(nn.Module):
    def __init__(self, residual):
        super().__init__(); self.residual = residual
        self.encB, self.encA = MutEncoder(NM, DIM), TokenEncoder(G, DIM)
        self.attn = nn.MultiheadAttention(DIM, 1, batch_first=True)
        self.head = nn.Sequential(nn.Linear(DIM, 128), nn.ReLU(), nn.Linear(128, 2))
    def forward(self, xA, xB):
        Q = self.encB(xB).unsqueeze(1); K = self.encA(xA)          # (B, 1, D), (B, 100, D)
        out, w = self.attn(Q, K, K); self.w = w.squeeze(1)         # (B, 100)
        h = out.squeeze(1) + (Q.squeeze(1) if self.residual else 0)
        return self.head(h)


carrier27 = Mte[:, FLIPM].astype(bool)
res = {"truth": {"info_genes": truth["info_genes"], "flip_gene": truth["flip_gene"], "flip_mut": truth["flip_mut"]}, "arms": {}}
for name, make in (("reverse", lambda: Reverse(False)), ("reverse_res", lambda: Reverse(True))):
    runs = []
    for seed in (42, 1, 2, 3, 4):
        random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
        model = make(); opt = torch.optim.Adam(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
        for ep in range(10):
            model.train()
            for xa, xb, yb in train_loader:
                loss = crit(model(xa, xb), yb); opt.zero_grad(); loss.backward(); opt.step()
        model.eval()
        with torch.no_grad(): p = model(XAt, XBt).softmax(1)[:, 1].numpy(); w = model.w.numpy()
        gw = w.mean(0); order = np.argsort(-gw)
        r = {"seed": seed, "auc": round(float(roc_auc_score(yte, p)), 4),
             "info_gene_ranks": sorted(int(np.where(order == g)[0][0]) + 1 for g in INFO),
             "flip_gene_rank": int(np.where(order == FLIPG)[0][0]) + 1,
             "gene8_weight_carriers27": round(float(w[carrier27, FLIPG].mean()), 4),
             "gene8_weight_noncarriers27": round(float(w[~carrier27, FLIPG].mean()), 4),
             "uniform": round(1 / G, 4)}
        runs.append(r); print(name, r, flush=True)
    res["arms"][name] = {"runs": runs, "auc_mean": round(float(np.mean([r["auc"] for r in runs])), 4)}
    print(name, "mean AUC", res["arms"][name]["auc_mean"], flush=True)
json.dump(res, open(OUT, "w"), indent=1)
print("wrote", OUT)
