"""Slot 105 mock data: two constructed examples in which early and late fusion differ, and 10-2b's CLIP.

His 2026-10-17 pick: 10-2b moves to the v6 dataset; the widget teaches on a
small constructed example where each contrast is clear. Both examples have the
lesson's two modalities, an expression value and a mutation status, and the
lesson's model shapes at a small size (an encoder per modality, a head, a gate):

  EARLY   one gene g and one mutation m in 1,000 patients; the gene raises the
          risk in mutated patients and lowers it in the rest (risk =
          2.5 g (2m - 1)). Concatenation sees g and m together and can learn
          the flip; late fusion adds a verdict from g to a verdict from m and
          cannot (each verdict alone carries almost nothing).
  LATE    a gene and five driver mutations, both modalities informative
          (risk = 1.2 g + mutation effects of +-1); each modality's verdict from a model on that modality
          alone, then their blend at any alpha (his pick: alpha as the
          student's control; why not 10-2b's joint training is at the LATE block). A gate per patient was measured and not taken
          (catalogue: alpha weights logits whose size already carries each
          modality's confidence, so it is not a trust dial).
  JOINT   10-2b cells 48-70 retrained (seed 42): image and digit-token
          encoders, InfoNCE, top-5 retrieval per token, the notebook's UMAP.

  python -I widgets/_lab/fusion-toy.py "<...>/_scratch/frontiers-data" [sections=early,late]
writes widgets/_lab/fusion-mock-data.json (untracked).
"""
import gzip, json, os, random, sys
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.metrics import roc_auc_score

DATA = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fusion-mock-data.json")
torch.set_num_threads(8)


def seed_all(s): random.seed(s); np.random.seed(s); torch.manual_seed(s)


class Enc(nn.Module):
    def __init__(self, d_in, d=4, hidden=16):
        super().__init__(); self.net = nn.Sequential(nn.Linear(d_in, hidden), nn.ReLU(), nn.Linear(hidden, d), nn.ReLU())
    def forward(self, x): return self.net(x)


class Concat(nn.Module):
    def __init__(self, dA, dB):
        super().__init__(); self.eA, self.eB = Enc(dA), Enc(dB); self.head = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, 2))
    def forward(self, a, b): return self.head(torch.cat([self.eA(a), self.eB(b)], 1)), None


class Weighted(nn.Module):
    def __init__(self, dA, dB):
        super().__init__(); self.eA, self.eB = Enc(dA), Enc(dB); self.hA, self.hB = nn.Linear(4, 2), nn.Linear(4, 2); self.alpha = nn.Parameter(torch.tensor(0.5))
    def forward(self, a, b):
        al = torch.clamp(self.alpha, 0, 1); return al * self.hA(self.eA(a)) + (1 - al) * self.hB(self.eB(b)), al.expand(a.shape[0])


class Gated(nn.Module):
    def __init__(self, dA, dB):
        super().__init__(); self.eA, self.eB = Enc(dA), Enc(dB); self.hA, self.hB = nn.Linear(4, 2), nn.Linear(4, 2)
        self.gate = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, 1), nn.Sigmoid())
    def forward(self, a, b):
        zA, zB = self.eA(a), self.eB(b); al = self.gate(torch.cat([zA, zB], 1)).squeeze(1)
        return al[:, None] * self.hA(zA) + (1 - al[:, None]) * self.hB(zB), al


def fit(cls, A, B, y, epochs=300, wd=1e-2):
    seed_all(42); m = cls(A.shape[1], B.shape[1]); opt = torch.optim.Adam(m.parameters(), lr=1e-2, weight_decay=wd)
    for _ in range(epochs):
        loss = F.cross_entropy(m(A, B)[0], y); opt.zero_grad(); loss.backward(); opt.step()
    m.eval(); return m


def prob(m, A, B):
    with torch.no_grad(): lo, al = m(A, B)
    return lo.softmax(1)[:, 1].numpy(), (al.numpy() if al is not None else None)


res = {}
PREV = json.load(open(OUT)) if os.path.exists(OUT) else {}
rng = np.random.default_rng(105)
T = lambda a: torch.tensor(a, dtype=torch.float32)

# ---------------------------------------------------------------- EARLY
# 400 patients and no weight decay overfit: concatenation's curves had a bump and a
# plateau, weighted averaging's a wiggle that read as signal. 1,000 patients and
# weight decay 1e-2 give smooth curves (concat 0.772 -> 0.887, weighted 0.427 -> 0.500).
n = 1000
g = rng.normal(size=n); m = (rng.uniform(size=n) < 0.5).astype(float)
y = (rng.uniform(size=n) < 1 / (1 + np.exp(-2.5 * g * (2 * m - 1)))).astype(int)
tr = np.arange(n) < 750
A, B, Y = T(g[:, None]), T(m[:, None]), torch.tensor(y)
grid = np.linspace(-3, 3, 61)
early = {"g": np.round(g, 3).tolist(), "m": m.astype(int).tolist(), "y": y.tolist(), "train": tr.astype(int).tolist(), "grid": grid.tolist(), "models": {}}
for name, cls in (("concat", Concat), ("weighted", Weighted), ("gated", Gated)):
    mod = fit(cls, A[tr], B[tr], Y[tr])
    p, _ = prob(mod, A[~tr], B[~tr])
    curves = {str(mm): np.round(prob(mod, T(grid[:, None]), T(np.full((61, 1), mm)))[0], 4).tolist() for mm in (0, 1)}
    early["models"][name] = {"auc": float(roc_auc_score(y[~tr], p)), "curves": curves}
    print("early", name, round(early["models"][name]["auc"], 3), flush=True)
res["early"] = early

# ---------------------------------------------------------------- LATE
# his pick 2026-10-17: alpha as the student's control. Both modalities informative
# (risk = 1.2 g + five driver mutations of effect +-1). Each modality's verdict is a log-odds from a model
# trained on that modality alone, so the two are on one scale; the fused verdict is
# alpha * expression + (1 - alpha) * mutation. NOT 10-2b's joint training: there the
# heads and alpha train together, a head can rescale its logits for any alpha in
# (0, 1), and the first run of this page gave expression log-odds from -18 to +11,
# AUC 0.75 at alpha 0 and a flat 0.85 from 0.05 to 0.45 -- a slider that does
# nothing over half its range. "Learned alpha" here is the one that minimizes the
# training log-loss with both verdicts held fixed.
# A single binary mutation gave a verdict with two values, and the test AUC (a
# ranking) then stayed at 0.862 from alpha 0.05 to 0.30; five driver mutations
# (32 verdict values) make the curve move smoothly. 1,000 patients, 750 to train.
#
# STEP 2, the gate (his call 2026-10-17, "mock the gate as step 2 on Late"). The
# expression modality is five genes (their mean, scaled, is the signature) and in
# 30% of patients the assay failed: every gene reads near background (-2 in
# standardized units, plus noise 0.3). The expression model is fitted on the
# training patients whose assay worked (a model built on good samples, then
# applied to every patient), so it calls the failed ones low risk with
# confidence (log-odds about -4.6, whatever the outcome). Fitted on every
# training patient instead, its slope flattened (measured verdicts -0.3 to +1,
# failed -0.6) and the gate's AUC matched one alpha (0.76 against 0.75). Blank rows were tried first and the gate barely
# moved (alpha 0.44 against 0.49): a blank row's verdict is already near 0, so its
# weight hardly matters to the loss. The gate is a small network on both
# modalities' inputs (5 genes + 5 mutations -> 16 -> 1, sigmoid), trained on the
# training patients with both verdicts held fixed, so step 2 changes only alpha;
# weight decay 1e-2 (without it alpha spread over 0 to 1 for measured patients).
from sklearn.linear_model import LogisticRegression
rng = np.random.default_rng(105); n, K, NG = 1000, 5, 5
tr = np.arange(n) < 750; te = ~tr
G2 = rng.normal(size=(n, NG)); m2 = (rng.uniform(size=(n, K)) < 0.3).astype(float)
sig = G2.mean(1) * np.sqrt(NG)
y2 = (rng.uniform(size=n) < 1 / (1 + np.exp(-(1.5 * sig + (m2 - 0.3) @ np.array([1., 1, -1, 1, -1]))))).astype(int)
failed = rng.uniform(size=n) < 0.3
X2 = np.where(failed[:, None], -2.0 + 0.3 * rng.normal(size=G2.shape), G2)
lrA = LogisticRegression().fit(X2[tr & ~failed], y2[tr & ~failed]); lrB = LogisticRegression().fit(m2[tr], y2[tr])
dA = lrA.decision_function(X2); dB = lrB.decision_function(m2)
alphas = np.round(np.linspace(0, 1, 21), 2)
auc = [float(roc_auc_score(y2[te], (al * dA + (1 - al) * dB)[te])) for al in alphas]
fine = np.linspace(0, 1, 101)
nll = [float(np.mean(np.logaddexp(0, -(2 * y2[tr] - 1) * (al * dA + (1 - al) * dB)[tr]))) for al in fine]
seed_all(42)
gate = nn.Sequential(nn.Linear(NG + K, 16), nn.ReLU(), nn.Linear(16, 1), nn.Sigmoid())
gin = T(np.hstack([X2, m2])); tA, tB, Yf = T(dA), T(dB), T(y2)
opt = torch.optim.Adam(gate.parameters(), lr=1e-2, weight_decay=1e-2)
for _ in range(600):
    al_ = gate(gin[tr]).squeeze(1)
    loss = F.binary_cross_entropy_with_logits(al_ * tA[tr] + (1 - al_) * tB[tr], Yf[tr]); opt.zero_grad(); loss.backward(); opt.step()
with torch.no_grad(): ag = gate(gin).squeeze(1).numpy()
fg = ag * dA + (1 - ag) * dB
res["late"] = {"y": y2.tolist(), "train": tr.astype(int).tolist(), "failed": failed.astype(int).tolist(),
               "logodds_expr": np.round(dA, 3).tolist(), "logodds_mut": np.round(dB, 3).tolist(),
               "alphas": alphas.tolist(), "auc_by_alpha": [round(v, 4) for v in auc], "alpha_learned": float(fine[int(np.argmin(nll))]),
               "alpha_gate": np.round(ag, 3).tolist(), "auc_gate": float(roc_auc_score(y2[te], fg[te]))}
L = res["late"]
print("late: AUC expr", auc[-1], "mut", auc[0], "best fixed", max(auc), "at", alphas[int(np.argmax(auc))], "| learned alpha", L["alpha_learned"],
      "| gate AUC", L["auc_gate"], "| gate alpha measured", ag[~failed].mean(), "failed", ag[failed].mean(), "| expr verdict on failed", dA[failed].mean(), flush=True)
json.dump(res, open(OUT, "w"), separators=(",", ":"))

# ---------------------------------------------------------------- JOINT (10-2b cells 48-70)
if len(sys.argv) > 2 and sys.argv[2].startswith("sections=") and "joint" not in sys.argv[2]:
    res["joint"] = PREV["joint"]; json.dump(res, open(OUT, "w"), separators=(",", ":")); print("joint kept from", OUT); sys.exit()
def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f: b = f.read()
    if "images" in name:
        nn_, rr, cc = np.frombuffer(b, ">i4", 3, 4); return np.frombuffer(b, np.uint8, offset=16).reshape(nn_, 1, rr, cc)
    return np.frombuffer(b, np.uint8, offset=8)
Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)
src = open(os.path.join(HERE, "fusion-measure.py"), encoding="utf-8").read()
exec(src[src.index("class ImageEncoder"):src.index("seed_all(42)\nmodel = JointEmbeddingModel")])
seed_all(42)
model = JointEmbeddingModel(ImageEncoder(64), TextEncoder(10, 64), 64, 64, 64); opt = torch.optim.Adam(model.parameters(), lr=1e-3)
with torch.no_grad(): Zt0 = model(Xte[:10], torch.arange(10))[1]; Zi0 = model(Xte[:2000], Yte[:2000])[0]
for ep in range(10):
    model.train()
    for b in torch.randperm(len(Ytr)).split(256):
        zi, zt = model(Xtr[b], Ytr[b]); loss = closs(zi, zt); opt.zero_grad(); loss.backward(); opt.step()
model.eval()
with torch.no_grad(): Zi = torch.cat([model(Xte[i:i + 1000], Yte[i:i + 1000])[0] for i in range(0, 2000, 1000)]); Zt = model(Xte[:10], torch.arange(10))[1]
S = (Zi @ Zt.T).numpy(); S0 = (Zi0 @ Zt0.T).numpy(); yl = Yte[:2000].numpy()
top = {str(d): [int(i) for i in np.argsort(-S[:, d])[:5]] for d in range(10)}
sim_idx = [int(i) for d in range(10) for i in np.where(yl == d)[0][:20]]
import umap
red = umap.UMAP(n_neighbors=25, min_dist=0.1, metric="cosine", random_state=42)
Ui = red.fit_transform(Zi.numpy()); Ut = red.transform(Zt.numpy())
u8 = lambda x: np.clip(np.round(x.squeeze().numpy() * 255), 0, 255).astype(int).flatten().tolist()
res["joint"] = {"labels": yl.tolist(), "top5": top, "top5_sim": {d: [round(float(S[i, int(d)]), 3) for i in v] for d, v in top.items()},
                "top5_img": {d: [u8(Xte[i]) for i in v] for d, v in top.items()}, "top1_acc": float((S.argmax(1) == yl).mean()),
                "top1_acc_untrained": float((S0.argmax(1) == yl).mean()),
                "umap_img": np.round(Ui[:1000], 2).tolist(), "umap_txt": np.round(Ut, 2).tolist(),
                # the token x image similarity for 20 test images of each digit, sorted by digit, before and after
                "sim_idx": sim_idx, "sim": np.round(S[sim_idx], 3).tolist(), "sim_untrained": np.round(S0[sim_idx], 3).tolist()}
print("joint top-1", res["joint"]["top1_acc"], "untrained", res["joint"]["top1_acc_untrained"], flush=True)
json.dump(res, open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT)
