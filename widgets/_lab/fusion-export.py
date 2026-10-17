"""Widget 105 `fusion`: the data the widget draws, with training checkpoints, as widgets/fusion/data.js.

The three examples are `_lab/fusion-toy.py`'s (his picks 2026-10-17, catalogue
§ 105 MOCKED and § 105 LATE STEP 2), retrained here with the SAME seeds and
settings so the final numbers match the toy's, and with checkpoints recorded
for the widget's Train presses:

  EARLY   concatenation against each modality alone (his call 2026-10-17:
          weighted averaging is late fusion and confused the Early page), 300
          full-batch epochs: P(outcome) against g for each mutation status at 8
          checkpoints. "Alone" is the same encoder and a head on one input.
  LATE    the two fixed verdicts (logistic regressions, the expression one fitted
          on the patients whose assay worked) and the gate, 600 full-batch
          epochs: each test patient's alpha at 8 checkpoints.
  JOINT   10-2b cells 48-70 (seed 42, 10 epochs, batch 256): the token x image
          similarity for 20 test images of each digit at 8 checkpoints, image ->
          token top-1 over 2,000 test images at each, and the top 5 images per
          token after training.

The toy's final numbers are asserted, so a drift between the two scripts stops
the export rather than shipping a widget that disagrees with the catalogue.

  python -I widgets/_lab/fusion-export.py "<...>/_scratch/frontiers-data"
"""
import base64, gzip, json, os, random, sys
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression

DATA = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "fusion", "data.js")
torch.set_num_threads(8)
T = lambda a: torch.tensor(a, dtype=torch.float32)
r3 = lambda a: np.round(np.asarray(a, dtype=float), 3).tolist()
src = open(os.path.join(HERE, "fusion-toy.py"), encoding="utf-8").read()
exec(src[src.index("def seed_all"):src.index("def fit")])          # seed_all, Enc, Concat, Weighted, Gated
out = {}

# ---------------------------------------------------------------- EARLY (fusion-toy.py's EARLY block)
rng = np.random.default_rng(105)
n = 1000
g = rng.normal(size=n); m = (rng.uniform(size=n) < 0.5).astype(float)
y = (rng.uniform(size=n) < 1 / (1 + np.exp(-2.5 * g * (2 * m - 1)))).astype(int)
tr = np.arange(n) < 750
A, B, Y = T(g[:, None]), T(m[:, None]), torch.tensor(y)
grid = np.linspace(-2.5, 2.5, 51)
CK_E = [0, 5, 10, 20, 40, 80, 150, 300]
early = {"g": r3(g), "m": m.astype(int).tolist(), "y": y.tolist(), "train": tr.astype(int).tolist(), "grid": r3(grid), "checkpoints": CK_E, "models": {}}
class Alone(nn.Module):   # one modality: its encoder and a head, the other input ignored
    def __init__(self, which):
        super().__init__(); self.which = which; self.enc = Enc(1); self.head = nn.Linear(4, 2)
    def forward(self, a, b): return self.head(self.enc(a if self.which == "A" else b)), None
for name, make in (("expr", lambda: Alone("A")), ("mut", lambda: Alone("B")), ("concat", lambda: Concat(1, 1))):
    seed_all(42); mod = make(); opt = torch.optim.Adam(mod.parameters(), lr=1e-2, weight_decay=1e-2)
    curves = []
    def snap():
        mod.eval()
        with torch.no_grad():
            curves.append([r3(mod(T(grid[:, None]), T(np.full((len(grid), 1), mm)))[0].softmax(1)[:, 1].numpy()) for mm in (0, 1)])
        mod.train()
    snap()
    for ep in range(1, 301):
        loss = F.cross_entropy(mod(A[tr], B[tr])[0], Y[tr]); opt.zero_grad(); loss.backward(); opt.step()
        if ep in CK_E: snap()
    mod.eval()
    with torch.no_grad(): p = mod(A[~tr], B[~tr])[0].softmax(1)[:, 1].numpy()
    auc = float(roc_auc_score(y[~tr], p))
    early["models"][name] = {"auc": round(auc, 4), "curves": curves}
    print("early", name, round(auc, 3), flush=True)
assert abs(early["models"]["concat"]["auc"] - 0.887) < 0.002, "EARLY drifted from fusion-toy.py"
out["EARLY"] = early

# ---------------------------------------------------------------- LATE (fusion-toy.py's LATE block)
rng = np.random.default_rng(105); n, K, NG = 1000, 5, 5
tr = np.arange(n) < 750; te = ~tr
G2 = rng.normal(size=(n, NG)); m2 = (rng.uniform(size=(n, K)) < 0.3).astype(float)
sig = G2.mean(1) * np.sqrt(NG)
y2 = (rng.uniform(size=n) < 1 / (1 + np.exp(-(1.5 * sig + (m2 - 0.3) @ np.array([1., 1, -1, 1, -1]))))).astype(int)
failed = rng.uniform(size=n) < 0.3
X2 = np.where(failed[:, None], -2.0 + 0.3 * rng.normal(size=G2.shape), G2)
lrA = LogisticRegression().fit(X2[tr & ~failed], y2[tr & ~failed]); lrB = LogisticRegression().fit(m2[tr], y2[tr])
dA = lrA.decision_function(X2); dB = lrB.decision_function(m2)
fine = np.linspace(0, 1, 101)
nll = [float(np.mean(np.logaddexp(0, -(2 * y2[tr] - 1) * (al * dA + (1 - al) * dB)[tr]))) for al in fine]
seed_all(42)
gate = nn.Sequential(nn.Linear(NG + K, 16), nn.ReLU(), nn.Linear(16, 1), nn.Sigmoid())
gin = T(np.hstack([X2, m2])); tA, tB, Yf = T(dA), T(dB), T(y2)
opt = torch.optim.Adam(gate.parameters(), lr=1e-2, weight_decay=1e-2)
CK_L = [0, 10, 25, 50, 100, 200, 400, 600]
alph = []
def snap_g():
    with torch.no_grad(): alph.append(r3(gate(gin[te]).squeeze(1).numpy()))
snap_g()
for ep in range(1, 601):
    al_ = gate(gin[tr]).squeeze(1)
    loss = F.binary_cross_entropy_with_logits(al_ * tA[tr] + (1 - al_) * tB[tr], Yf[tr]); opt.zero_grad(); loss.backward(); opt.step()
    if ep in CK_L: snap_g()
# one alpha for every patient, learned the same way (his call 2026-10-17: Late's Learned alpha
# opens untrained at 0.5 and Train learns it): alpha clamped to [0, 1] as in the weighted-averaging
# template, Adam 1e-2, 600 full-batch epochs, the two verdicts fixed
a_one = torch.nn.Parameter(torch.tensor(0.5)); opt1 = torch.optim.Adam([a_one], lr=1e-2)
traj = [0.5]
for ep in range(1, 601):
    a_ = torch.clamp(a_one, 0, 1)
    loss = F.binary_cross_entropy_with_logits(a_ * tA[tr] + (1 - a_) * tB[tr], Yf[tr]); opt1.zero_grad(); loss.backward(); opt1.step()
    if ep in CK_L: traj.append(round(float(torch.clamp(a_one, 0, 1)), 4))
print("learned alpha by checkpoint", traj, "| grid argmin", float(fine[int(np.argmin(nll))]), flush=True)
assert abs(traj[-1] - float(fine[int(np.argmin(nll))])) < 0.011, "the learned alpha did not reach the grid's minimum"
ag = np.array(alph[-1])
auc_gate = float(roc_auc_score(y2[te], ag * dA[te] + (1 - ag) * dB[te]))
print("late gate AUC", round(auc_gate, 3), "alpha failed", ag[failed[te]].mean().round(3), "worked", ag[~failed[te]].mean().round(3), flush=True)
assert abs(auc_gate - 0.818) < 0.002, "LATE drifted from fusion-toy.py"
out["LATE"] = {"y": y2[te].tolist(), "failed": failed[te].astype(int).tolist(), "expr": r3(dA[te]), "mut": r3(dB[te]),
               "alpha_learned": traj[-1], "alpha_traj": traj, "checkpoints": CK_L, "gate": alph, "n_train": int(tr.sum())}

# ---------------------------------------------------------------- JOINT (10-2b cells 48-70, as fusion-toy.py trains it)
def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f: b = f.read()
    if "images" in name:
        nn_, rr, cc = np.frombuffer(b, ">i4", 3, 4); return np.frombuffer(b, np.uint8, offset=16).reshape(nn_, 1, rr, cc)
    return np.frombuffer(b, np.uint8, offset=8)
Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255; Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)
msrc = open(os.path.join(HERE, "fusion-measure.py"), encoding="utf-8").read()
exec(msrc[msrc.index("class ImageEncoder"):msrc.index("seed_all(42)\nmodel = JointEmbeddingModel")])
yl = Yte[:2000].numpy()
sim_idx = [int(i) for d in range(10) for i in np.where(yl == d)[0][:20]]
seed_all(42)
model = JointEmbeddingModel(ImageEncoder(64), TextEncoder(10, 64), 64, 64, 64); opt = torch.optim.Adam(model.parameters(), lr=1e-3)
with torch.no_grad(): _ = model(Xte[:10], torch.arange(10)); _ = model(Xte[:2000], Yte[:2000])   # the toy's two untrained passes (no randomness; kept for order)
PER_EPOCH = int(np.ceil(len(Ytr) / 256))
CK_J = [0, 10, 50, 100, PER_EPOCH, 2 * PER_EPOCH, 5 * PER_EPOCH, 10 * PER_EPOCH]
sims, top1s = [], []
def snap_j():
    model.eval()
    with torch.no_grad():
        Zi = torch.cat([model(Xte[i:i + 1000], Yte[i:i + 1000])[0] for i in range(0, 2000, 1000)]); Zt = model(Xte[:10], torch.arange(10))[1]
    S = (Zi @ Zt.T).numpy()
    sims.append(r3(S[sim_idx])); top1s.append(round(float((S.argmax(1) == yl).mean()), 4))
    model.train()
    return S
snap_j(); step = 0
for ep in range(10):
    model.train()
    for b in torch.randperm(len(Ytr)).split(256):
        zi, zt = model(Xtr[b], Ytr[b]); loss = closs(zi, zt); opt.zero_grad(); loss.backward(); opt.step(); step += 1
        if step in CK_J: S = snap_j()
print("joint top-1 by checkpoint", top1s, flush=True)
assert abs(top1s[-1] - 0.9885) < 0.002, "JOINT drifted from fusion-toy.py"
top = [[int(i) for i in np.argsort(-S[:, d])[:5]] for d in range(10)]
u8 = lambda i: base64.b64encode(np.clip(np.round(Xte[i].squeeze().numpy() * 255), 0, 255).astype(np.uint8).tobytes()).decode()
out["JOINT"] = {"labels": yl[sim_idx].tolist(), "checkpoints": CK_J, "per_epoch": PER_EPOCH, "sim": sims, "top1": top1s, "n_test": 2000,
                "top5": [[{"img": u8(i), "label": int(yl[i]), "sim": round(float(S[i, d]), 3)} for i in top[d]] for d in range(10)]}

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Widget 105 `fusion`: generated by widgets/_lab/fusion-export.py. Do not edit by hand. */\n")
    for k, v in out.items(): f.write(f"export const {k} = {json.dumps(v, separators=(',', ':'))};\n")
print("wrote", OUT, os.path.getsize(OUT), "bytes")
