"""Slot 105 `fusion`: what each fusion strategy in 10-2b learns, on the lesson's own data.

Part 1, the synthetic patients (his CSVs: 1,000 expression genes, 50 binary
mutations, a binary label; the lesson's split: 80/20 stratified,
random_state 42, expression standardized on the training rows). Trained with
the notebook's settings (Adam 1e-3, 10 epochs, batch 256, CrossEntropyLoss) and
the lesson's encoders (GeneEncoder 1000 -> 256 -> 128, MutEncoder 50 -> 128 ->
64, dropout 0.1):
  expression alone, mutations alone, concatenation (10-2b cell 20),
  weighted averaging of logits (cell 30's template), learned gating (cell 36),
over five seeds (the test set is 400 patients). Then what drives the label,
by logistic regressions on each block, both, and both with the
expression x mutation products of the strongest features; and the gate's
alpha per test patient.

Part 2, the joint embedding (cells 48-70): image and digit-token encoders,
projection to 64, InfoNCE at tau 0.1, batch 256, 10 epochs, seed 42; scored by
text -> image retrieval (share of the top 5 images that show the query digit),
image -> text top-1 (each test image's nearest of the ten token embeddings),
and the training loss against its floor (mean ln k over the batch's copies).

  python -I widgets/_lab/fusion-measure.py "<...>/_scratch/frontiers-data"
writes widgets/_lab/fusion-measure.json (untracked).
"""
import gzip, json, math, os, random, sys, time
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score
from sklearn.linear_model import LogisticRegression

DATA = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fusion-measure.json")
torch.set_num_threads(min(16, os.cpu_count()))
res = {}


def seed_all(s):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


# ============================================================ part 1: the synthetic patients
syn = os.path.join(DATA, "synthetic")
E = np.loadtxt(os.path.join(syn, "synthetic_expression.csv"), delimiter=",", skiprows=1)
M = np.loadtxt(os.path.join(syn, "synthetic_mutations.csv"), delimiter=",", skiprows=1)
y = np.loadtxt(os.path.join(syn, "synthetic_labels.csv"), skiprows=1).astype(int)
Etr, Ete, Mtr, Mte, ytr, yte = train_test_split(E, M, y, test_size=0.2, random_state=42, stratify=y)
sc = StandardScaler().fit(Etr); Etr = sc.transform(Etr); Ete = sc.transform(Ete)
T = lambda a, dt=torch.float32: torch.tensor(a, dtype=dt)
XA, XB, YT = T(Etr), T(Mtr), T(ytr, torch.long)
XAt, XBt = T(Ete), T(Mte)
res["data"] = {"n": int(len(y)), "genes": int(E.shape[1]), "mutations": int(M.shape[1]), "pos_share": float(y.mean()),
               "train": int(len(ytr)), "test": int(len(yte)), "mut_rate": float(M.mean())}


class GeneEncoder(nn.Module):
    def __init__(self, in_dim, embed_dim=128, hidden=256, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class MutEncoder(nn.Module):
    def __init__(self, in_dim, embed_dim=64, hidden=128, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class Single(nn.Module):   # one modality, its encoder and a linear head
    def __init__(self, enc, dim, which):
        super().__init__(); self.enc, self.head, self.which = enc, nn.Linear(dim, 2), which
    def forward(self, xA, xB): return self.head(self.enc(xA if self.which == "A" else xB))


class ConcatFusion(nn.Module):   # cell 20
    def __init__(self, encA, encB, dimA, dimB, head_hidden=128):
        super().__init__(); self.encoderA, self.encoderB = encA, encB
        self.fusion_head = nn.Sequential(nn.Linear(dimA + dimB, head_hidden), nn.ReLU(), nn.Linear(head_hidden, 2))
    def forward(self, xA, xB): return self.fusion_head(torch.cat([self.encoderA(xA), self.encoderB(xB)], 1))


class Weighted(nn.Module):   # cell 30's template, each model an encoder and a head
    def __init__(self, encA, encB, dimA, dimB):
        super().__init__(); self.encA, self.encB = encA, encB; self.hA, self.hB = nn.Linear(dimA, 2), nn.Linear(dimB, 2)
        self.alpha = nn.Parameter(torch.tensor(0.5))
    def forward(self, xA, xB):
        a = torch.clamp(self.alpha, 0.0, 1.0)
        return a * self.hA(self.encA(xA)) + (1 - a) * self.hB(self.encB(xB))


class LateFusionGated(nn.Module):   # cell 36
    def __init__(self, encA, encB, dimA, dimB, hidden=64):
        super().__init__(); self.encoderA, self.encoderB = encA, encB
        self.headA, self.headB = nn.Linear(dimA, 2), nn.Linear(dimB, 2)
        self.gate = nn.Sequential(nn.Linear(dimA + dimB, hidden), nn.ReLU(), nn.Linear(hidden, 1), nn.Sigmoid())
    def parts(self, xA, xB):
        zA, zB = self.encoderA(xA), self.encoderB(xB)
        lA, lB = self.headA(zA), self.headB(zB)
        a = self.gate(torch.cat([zA, zB], 1))
        return a * lA + (1 - a) * lB, a, lA, lB
    def forward(self, xA, xB): return self.parts(xA, xB)[0]


def make(kind):
    A, B = GeneEncoder(XA.shape[1], 128), MutEncoder(XB.shape[1], 64)
    return {"expression": lambda: Single(A, 128, "A"), "mutations": lambda: Single(B, 64, "B"),
            "concat": lambda: ConcatFusion(A, B, 128, 64), "weighted": lambda: Weighted(A, B, 128, 64),
            "gated": lambda: LateFusionGated(A, B, 128, 64)}[kind]()


def train(kind, seed, epochs=10):
    seed_all(seed); model = make(kind); opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    n = len(YT)
    for ep in range(epochs):
        model.train()
        for b in torch.randperm(n).split(256):
            loss = F.cross_entropy(model(XA[b], XB[b]), YT[b]); opt.zero_grad(); loss.backward(); opt.step()
    model.eval()
    with torch.no_grad(): out = model(XAt, XBt)
    p = out.softmax(1)[:, 1].numpy()
    return model, {"acc": float(accuracy_score(yte, out.argmax(1).numpy())), "auc": float(roc_auc_score(yte, p))}


SEEDS = [42, 1, 2, 3, 4]
res["models"] = {}
for kind in ("expression", "mutations", "concat", "weighted", "gated"):
    runs = [train(kind, s)[1] for s in SEEDS]
    res["models"][kind] = {"seed42": runs[0], "acc_mean": float(np.mean([r["acc"] for r in runs])), "acc_sd": float(np.std([r["acc"] for r in runs])),
                           "auc_mean": float(np.mean([r["auc"] for r in runs])), "auc_sd": float(np.std([r["auc"] for r in runs]))}
    print(kind, res["models"][kind], flush=True)

# the gate, seed 42, per test patient
gm, _ = train("gated", 42)
with torch.no_grad(): fused, a, lA, lB = gm.parts(XAt, XBt)
a = a.squeeze(1).numpy(); cA = (lA.argmax(1).numpy() == yte); cB = (lB.argmax(1).numpy() == yte)
nmut = Mte.sum(1)
res["gate"] = {"mean": float(a.mean()), "sd": float(a.std()), "min": float(a.min()), "max": float(a.max()),
               "q": [float(v) for v in np.quantile(a, [0.05, 0.25, 0.5, 0.75, 0.95])],
               "acc_headA": float(cA.mean()), "acc_headB": float(cB.mean()),
               "alpha_when_A_right_B_wrong": float(a[cA & ~cB].mean()) if (cA & ~cB).any() else None,
               "alpha_when_B_right_A_wrong": float(a[cB & ~cA].mean()) if (cB & ~cA).any() else None,
               "n_A_right_B_wrong": int((cA & ~cB).sum()), "n_B_right_A_wrong": int((cB & ~cA).sum()),
               "corr_alpha_nmut": float(np.corrcoef(a, nmut)[0, 1])}
w, _ = train("weighted", 42)
res["weighted_alpha"] = float(torch.clamp(w.alpha, 0, 1).item())
print("gate", res["gate"], "weighted alpha", res["weighted_alpha"], flush=True)

# what drives the label: logistic regressions (C=1, standardized blocks)
def lr(Xa, Xb):
    m = LogisticRegression(max_iter=5000, C=1.0).fit(Xa, ytr); p = m.predict_proba(Xb)[:, 1]
    return {"acc": float(accuracy_score(yte, p > 0.5)), "auc": float(roc_auc_score(yte, p))}
ms = StandardScaler().fit(Mtr); Mtr_s, Mte_s = ms.transform(Mtr), ms.transform(Mte)
r = lambda X, v: np.abs([np.corrcoef(X[:, j], v)[0, 1] if X[:, j].std() > 0 else 0 for j in range(X.shape[1])])
topE = np.argsort(-r(Etr, ytr))[:20]; topM = np.argsort(-r(Mtr, ytr))[:10]
prod = lambda Ex, Mx: np.stack([Ex[:, g] * Mx[:, m] for g in topE for m in range(Mx.shape[1])], 1)
res["logistic"] = {"expression": lr(Etr, Ete), "mutations": lr(Mtr_s, Mte_s), "both": lr(np.hstack([Etr, Mtr_s]), np.hstack([Ete, Mte_s])),
                   "both_plus_products": lr(np.hstack([Etr, Mtr_s, prod(Etr, Mtr)]), np.hstack([Ete, Mte_s, prod(Ete, Mte)]))}
res["marginal"] = {"top_expr_r": [float(v) for v in np.sort(r(Etr, ytr))[::-1][:8]], "top_mut_r": [float(v) for v in np.sort(r(Mtr, ytr))[::-1][:8]],
                   "top_expr_genes": [int(g) + 1 for g in topE[:8]], "top_mut_genes": [int(m) + 1 for m in topM[:8]]}
print("logistic", res["logistic"], "\nmarginal", res["marginal"], flush=True)
json.dump(res, open(OUT, "w"), indent=1)

# ============================================================ part 2: the joint embedding
def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f: b = f.read()
    if "images" in name:
        n, rr, cc = np.frombuffer(b, ">i4", 3, 4); return np.frombuffer(b, np.uint8, offset=16).reshape(n, 1, rr, cc)
    return np.frombuffer(b, np.uint8, offset=8)
Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)


class ImageEncoder(nn.Module):   # cell 52 (10-2b)
    def __init__(self, embed_dim=64):
        super().__init__()
        self.conv = nn.Sequential(nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2), nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.to_embed = nn.Sequential(nn.Flatten(start_dim=1), nn.Linear(64 * 7 * 7, embed_dim))
    def forward(self, x): return self.to_embed(self.conv(x))


class TextEncoder(nn.Module):
    def __init__(self, vocab_size=10, embed_dim=64):
        super().__init__(); self.emb = nn.Embedding(vocab_size, embed_dim); self.fc = nn.Linear(embed_dim, embed_dim)
    def forward(self, t): return self.fc(self.emb(t))


class JointEmbeddingModel(nn.Module):
    def __init__(self, a, b, dimA, dimB, embed_dim):
        super().__init__(); self.encoderA, self.encoderB = a, b; self.projA, self.projB = nn.Linear(dimA, embed_dim), nn.Linear(dimB, embed_dim)
    def forward(self, xa, xb): return F.normalize(self.projA(self.encoderA(xa)), dim=1), F.normalize(self.projB(self.encoderB(xb)), dim=1)


def closs(zi, zt, tau=0.1):
    lg = (zi @ zt.T) / tau; lb = torch.arange(zi.size(0))
    return 0.5 * (F.cross_entropy(lg, lb) + F.cross_entropy(lg.T, lb))


seed_all(42)
model = JointEmbeddingModel(ImageEncoder(64), TextEncoder(10, 64), 64, 64, 64); opt = torch.optim.Adam(model.parameters(), lr=1e-3)
log, floor = [], []
for ep in range(10):
    model.train(); s = 0; nb = 0; t0 = time.time()
    for b in torch.randperm(len(Ytr)).split(256):
        zi, zt = model(Xtr[b], Ytr[b]); loss = closs(zi, zt); opt.zero_grad(); loss.backward(); opt.step(); s += loss.item(); nb += 1
        if ep == 0: k = torch.bincount(Ytr[b], minlength=10).float(); floor.append(torch.log(k[Ytr[b]]).mean().item())
    log.append(round(s / nb, 4)); print("clip epoch", ep + 1, log[-1], round(time.time() - t0), "s", flush=True)
model.eval()
with torch.no_grad():
    Zi = torch.cat([model(Xte[i:i + 1000], Yte[i:i + 1000])[0] for i in range(0, 10000, 1000)])
    Zt10 = model(Xte[:10], torch.arange(10))[1]
S10 = Zi @ Zt10.T
top1 = (S10.argmax(1) == Yte).float().mean().item()
prec5 = float(np.mean([(Yte[torch.topk(S10[:, d], 5).indices] == d).float().mean().item() for d in range(10)]))
prec100 = float(np.mean([(Yte[torch.topk(S10[:, d], 100).indices] == d).float().mean().item() for d in range(10)]))
res["clip"] = {"train_loss_by_epoch": log, "loss_floor_mean_ln_k": float(np.mean(floor)), "image_to_text_top1": top1,
               "text_to_image_precision_at_5": prec5, "text_to_image_precision_at_100": prec100}
print("clip", res["clip"], flush=True)
json.dump(res, open(OUT, "w"), indent=1)
print("wrote", OUT)
