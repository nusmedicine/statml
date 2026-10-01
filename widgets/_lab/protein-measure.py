"""Planning measurement for slot 86, an encoder built and trained from scratch on
proteins (PHM5005 08-3 cells 7-47), 2026-10-02. The lesson's data: hemagglutinin
(HA) of influenza A, host 0 animal / 1 human (BV-BRC), downloaded on his leave
from 08-3 cell 10's link; NOT in the repository (16 MB).

  D  the data: size, balance, lengths, exact duplicates and duplicates that cross
     the lesson's own split (80 / 10 / 10, stratified, random_state 42).
  B  baselines with no attention: amino-acid composition (20 counts / length)
     and 3-mer composition into a logistic regression; nearest neighbour by
     identity of the first 100 residues. If these already score near 100%, the
     host is read from composition, 84's bag-of-words trap.
  T  the lesson's TransformerModel (cell 28: d 128, 2 heads, FFN 256, 1 layer,
     learned positions, mask-aware MEAN pooling), trained from scratch, a few
     epochs, Adam 1e-3; then the same with [CLS] pooling and with max.

Run:  python widgets/_lab/protein-measure.py <influenza_ha.csv> [D B T]
"""
import sys, time, random, math
from collections import Counter
import csv
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

T0 = time.time()
def log(*a): print(*a, flush=True)
path = sys.argv[1]; parts = sys.argv[2:] or ["D", "B", "T"]
class Frame:
    """the few DataFrame operations the measurement needs, on plain lists (pandas is not installed here)"""
    def __init__(self, rows): self.rows = rows
    def __len__(self): return len(self.rows)
    def __getitem__(self, k): return Col([r[k] for r in self.rows])
class Col(list):
    @property
    def values(self): return np.array(self)
    def mean(self): return float(np.mean(list(self)))
    def nunique(self): return len(set(self))
    def isin(self, s): return Col([v in s for v in self])
with open(path, newline="") as fh:
    rows = [{"seq": r["seq"], "label": int(r["label"])} for r in csv.DictReader(fh)]
df = Frame(rows)
tr_rows, vt_rows = train_test_split(rows, test_size=0.2, random_state=42, stratify=[r["label"] for r in rows])
va_rows, te_rows = train_test_split(vt_rows, test_size=0.5, random_state=42, stratify=[r["label"] for r in vt_rows])
train_df, val_df, test_df = Frame(tr_rows), Frame(va_rows), Frame(te_rows)
AA = "ACDEFGHIKLMNPQRSTVWY"

if "D" in parts:
    L = np.array([len(s) for s in df["seq"]])
    log(f"== D  {len(df):,} sequences; human {df['label'].mean():.1%}; length median {int(np.median(L))}, "
        f"5-95% {int(np.quantile(L, .05))}-{int(np.quantile(L, .95))}, max {L.max()}")
    nonstd = np.array([sum(ch not in AA for ch in s.upper()) for s in df["seq"]])
    log(f"   sequences with a non-standard letter: {(nonstd > 0).mean():.1%}")
    uniq = df["seq"].nunique(); top = Counter(df["seq"]).most_common(1)[0][1]
    log(f"   distinct sequences {uniq:,} ({uniq / len(df):.1%}); the most repeated appears {top:,} times")
    labs = {}
    for r in rows: labs.setdefault(r["seq"], set()).add(r["label"])
    log(f"   sequences labelled BOTH human and animal: {sum(len(v) > 1 for v in labs.values()):,}")
    tr = set(train_df["seq"]); leak = test_df["seq"].isin(tr).mean()
    log(f"   test sequences identical to a training sequence (the lesson's split): {leak:.1%}")

def comp(seqs, k=1):
    if k == 1:
        return np.array([[s.count(a) / max(1, len(s)) for a in AA] for s in seqs])
    vocab = {}
    rows = []
    for s in seqs:
        c = Counter(s[i:i + k] for i in range(len(s) - k + 1)); rows.append(c)
        for key in c: vocab.setdefault(key, len(vocab))
    X = np.zeros((len(seqs), len(vocab)), dtype=np.float32)
    for r, c in enumerate(rows):
        n = max(1, sum(c.values()))
        for key, v in c.items(): X[r, vocab[key]] = v / n
    return X

if "B" in parts:
    log("\n== B  baselines with no attention (train on the lesson's train split, score its test split)")
    ytr, yte = train_df["label"].values, test_df["label"].values
    X1 = comp(list(train_df["seq"]) + list(test_df["seq"]), 1)
    lr = LogisticRegression(max_iter=3000).fit(X1[:len(ytr)], ytr)
    log(f"   amino-acid composition (20 numbers) + logistic regression: {lr.score(X1[len(ytr):], yte):.1%}  ({time.time()-T0:.0f}s)")
    X3 = comp(list(train_df["seq"]) + list(test_df["seq"]), 3)
    lr3 = LogisticRegression(max_iter=2000, C=1.0).fit(X3[:len(ytr)], ytr)
    log(f"   3-mer composition ({X3.shape[1]:,} numbers) + logistic regression: {lr3.score(X3[len(ytr):], yte):.1%}  ({time.time()-T0:.0f}s)")
    # the same, test restricted to sequences NOT seen in training
    novel = ~test_df["seq"].isin(set(train_df["seq"])).values
    log(f"   ... on the {novel.sum():,} test sequences not identical to a training one: composition {lr.score(X1[len(ytr):][novel], yte[novel]):.1%}, 3-mer {lr3.score(X3[len(ytr):][novel], yte[novel]):.1%}")

if "T" in parts:
    log("\n== T  the lesson's TransformerModel from scratch (cell 28), CPU")
    torch.set_num_threads(8)
    vocab = {"*": 0, **{a: i + 1 for i, a in enumerate(AA)}, "X": 21, "[CLS]": 22}
    MAXL = max(len(s) for s in df["seq"])
    def enc(s, cls=False):
        ids = [vocab.get(ch, 21) for ch in s.upper()][:MAXL]
        if cls: ids = [22] + ids
        return ids
    def batch(seqs, cls=False):
        ids = [enc(s, cls) for s in seqs]; L = max(map(len, ids))
        X = torch.zeros(len(ids), L, dtype=torch.long); M = torch.zeros(len(ids), L, dtype=torch.long)
        for i, r in enumerate(ids): X[i, :len(r)] = torch.tensor(r); M[i, :len(r)] = 1
        return X, M
    class Model(nn.Module):
        def __init__(self, pool, d=128, h=2, ff=256, n=1):
            super().__init__(); self.pool = pool
            self.tok = nn.Embedding(len(vocab), d, padding_idx=0); self.pos = nn.Embedding(MAXL + 1, d)
            self.enc = nn.TransformerEncoder(nn.TransformerEncoderLayer(d, h, ff, 0.1, batch_first=True), n)
            self.cls = nn.Linear(d, 2)
        def forward(self, X, M):
            x = self.tok(X) + self.pos(torch.arange(X.shape[1])[None])
            H = self.enc(x, src_key_padding_mask=(M == 0))
            if self.pool == "cls": z = H[:, 0]
            elif self.pool == "max": z = H.masked_fill((M == 0)[..., None], -1e9).max(1).values
            else: m = M[..., None].float(); z = (H * m).sum(1) / m.sum(1).clamp(min=1)
            return self.cls(z)
    def train(pool, epochs=2, n_train=None, bs=32, seed=0):
        torch.manual_seed(seed); random.seed(seed)
        mdl = Model(pool); opt = torch.optim.Adam(mdl.parameters(), lr=1e-3)
        tr = list(zip(train_df["seq"], train_df["label"]))
        if n_train: tr = tr[:n_train]
        te_s, te_y = list(test_df["seq"]), torch.tensor(test_df["label"].values)
        for ep in range(epochs):
            random.shuffle(tr); mdl.train()
            for i in range(0, len(tr), bs):
                S, Y = zip(*tr[i:i + bs]); X, M = batch(S, pool == "cls")
                loss = F.cross_entropy(mdl(X, M), torch.tensor(Y)); opt.zero_grad(); loss.backward(); opt.step()
            mdl.eval(); correct = 0
            with torch.no_grad():
                for i in range(0, len(te_s), 128):
                    X, M = batch(te_s[i:i + 128], pool == "cls"); correct += (mdl(X, M).argmax(-1) == te_y[i:i + 128]).sum().item()
            log(f"   pool {pool:4s} n {len(tr):,} epoch {ep + 1}: test {correct / len(te_s):.1%}  ({time.time()-T0:.0f}s)")
    n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 4000
    for pool in ("mean", "cls", "max"): train(pool, epochs=2, n_train=n)
