"""Slot 105: does 10-2b's learned gate (cell 36, unchanged) learn a per-patient weight, and on what data?

His question 2026-10-17: is the gating code correct, why does it not work, and
would a different dataset show it. Each dataset below is read the way 10-2b
reads its CSVs (80/20 stratified split, random_state 42, expression
standardized on the training rows; a blank expression row is filled with 0,
the training mean, after scaling) and trained with the notebook's settings
(Adam 1e-3, 10 epochs, batch 256, the lesson's encoders and dropout).

For each: test AUC of expression alone, mutations alone, concatenation,
weighted averaging and the gate over five seeds, overall and within the
degraded and intact test patients; and for seed 42 the gate's alpha in each
group and the size of its pre-sigmoid input. Plus one diagnostic arm, the
gate trained AFTER the two single-modality models, with them frozen
("frozen experts"), which is the usual way to make a gate mean trust.

  python -I widgets/_lab/fusion-gate-measure.py <datasets_root>
<datasets_root>/<name>/ each hold the three CSVs and synthetic_truth.json
(fusion-generator.py); writes widgets/_lab/fusion-gate-measure.json.
"""
import json, os, random, sys
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

ROOT = sys.argv[1]; NAMES = [a for a in sys.argv[2:] if "=" not in a]
EPOCHS = int(dict(a.split("=") for a in sys.argv[2:] if "=" in a).get("epochs", 10))   # 10 is the notebook's
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fusion-gate-measure.json")
torch.set_num_threads(min(16, os.cpu_count()))


def seed_all(s): random.seed(s); np.random.seed(s); torch.manual_seed(s)


class GeneEncoder(nn.Module):
    def __init__(self, in_dim, embed_dim=128, hidden=256, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class MutEncoder(nn.Module):
    def __init__(self, in_dim, embed_dim=64, hidden=128, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class Single(nn.Module):
    def __init__(self, enc, dim, which): super().__init__(); self.enc, self.head, self.which = enc, nn.Linear(dim, 2), which
    def forward(self, xA, xB): return self.head(self.enc(xA if self.which == "A" else xB))


class ConcatFusion(nn.Module):   # cell 20
    def __init__(self, encA, encB, dimA, dimB, head_hidden=128):
        super().__init__(); self.encoderA, self.encoderB = encA, encB
        self.fusion_head = nn.Sequential(nn.Linear(dimA + dimB, head_hidden), nn.ReLU(), nn.Linear(head_hidden, 2))
    def forward(self, xA, xB): return self.fusion_head(torch.cat([self.encoderA(xA), self.encoderB(xB)], 1))


class Weighted(nn.Module):   # cell 30
    def __init__(self, encA, encB, dimA, dimB):
        super().__init__(); self.encA, self.encB = encA, encB; self.hA, self.hB = nn.Linear(dimA, 2), nn.Linear(dimB, 2)
        self.alpha = nn.Parameter(torch.tensor(0.5))
    def forward(self, xA, xB):
        a = torch.clamp(self.alpha, 0.0, 1.0); return a * self.hA(self.encA(xA)) + (1 - a) * self.hB(self.encB(xB))


class LateFusionGated(nn.Module):   # cell 36, unchanged
    def __init__(self, encA, encB, dimA, dimB, hidden=64):
        super().__init__(); self.encoderA, self.encoderB = encA, encB
        self.headA, self.headB = nn.Linear(dimA, 2), nn.Linear(dimB, 2)
        self.gate = nn.Sequential(nn.Linear(dimA + dimB, hidden), nn.ReLU(), nn.Linear(hidden, 1), nn.Sigmoid())
    def parts(self, xA, xB):
        zA, zB = self.encoderA(xA), self.encoderB(xB); lA, lB = self.headA(zA), self.headB(zB)
        h = torch.cat([zA, zB], 1); pre = self.gate[:3](h); a = torch.sigmoid(pre)
        return a * lA + (1 - a) * lB, a, pre
    def forward(self, xA, xB): return self.parts(xA, xB)[0]


class FrozenExperts(nn.Module):   # diagnostic: two trained single-modality models, frozen; only the gate trains
    def __init__(self, mA, mB, dimA, dimB, hidden=64):
        super().__init__(); self.mA, self.mB = mA, mB
        for p in list(mA.parameters()) + list(mB.parameters()): p.requires_grad_(False)
        self.gate = nn.Sequential(nn.Linear(dimA + dimB, hidden), nn.ReLU(), nn.Linear(hidden, 1), nn.Sigmoid())
    def parts(self, xA, xB):
        zA, zB = self.mA.enc(xA), self.mB.enc(xB); a = self.gate(torch.cat([zA, zB], 1))
        return a * self.mA.head(zA) + (1 - a) * self.mB.head(zB), a
    def forward(self, xA, xB): return self.parts(xA, xB)[0]


def load(name):
    d = os.path.join(ROOT, name)
    E = np.genfromtxt(os.path.join(d, "synthetic_expression.csv"), delimiter=",", skip_header=1)
    M = np.loadtxt(os.path.join(d, "synthetic_mutations.csv"), delimiter=",", skiprows=1)
    y = np.loadtxt(os.path.join(d, "synthetic_labels.csv"), skiprows=1).astype(int)
    tf = os.path.join(d, "synthetic_truth.json")
    deg = np.array(json.load(open(tf))["degraded"]) if os.path.exists(tf) else np.zeros(len(y), int)
    Etr, Ete, Mtr, Mte, ytr, yte, dtr, dte = train_test_split(E, M, y, deg, test_size=0.2, random_state=42, stratify=y)
    sc = StandardScaler().fit(Etr); Etr = np.nan_to_num(sc.transform(Etr)); Ete = np.nan_to_num(sc.transform(Ete))
    T = lambda a, dt=torch.float32: torch.tensor(a, dtype=dt)
    return dict(XA=T(Etr), XB=T(Mtr), Y=T(ytr, torch.long), XAt=T(Ete), XBt=T(Mte), yte=yte, dte=dte.astype(bool))


def fit(model, D, epochs=None, params=None):
    epochs = epochs or EPOCHS
    opt = torch.optim.Adam(params if params is not None else model.parameters(), lr=1e-3); n = len(D["Y"])
    for _ in range(epochs):
        model.train()
        for b in torch.randperm(n).split(256):
            loss = F.cross_entropy(model(D["XA"][b], D["XB"][b]), D["Y"][b]); opt.zero_grad(); loss.backward(); opt.step()
    model.eval(); return model


def scores(model, D):
    with torch.no_grad(): p = model(D["XAt"], D["XBt"]).softmax(1)[:, 1].numpy()
    y, dg = D["yte"], D["dte"]
    sub = lambda m: float(roc_auc_score(y[m], p[m])) if m.any() and len(set(y[m])) > 1 else None
    return {"auc": float(roc_auc_score(y, p)), "auc_degraded": sub(dg), "auc_intact": sub(~dg)}


def build(kind, D, seed):
    seed_all(seed); dA, dB = D["XA"].shape[1], D["XB"].shape[1]
    A, B = GeneEncoder(dA), MutEncoder(dB)
    if kind == "frozen":
        mA = fit(Single(A, 128, "A"), D); mB = fit(Single(B, 64, "B"), D)
        m = FrozenExperts(mA, mB, 128, 64); return fit(m, D, params=m.gate.parameters())
    return fit({"expression": lambda: Single(A, 128, "A"), "mutations": lambda: Single(B, 64, "B"), "concat": lambda: ConcatFusion(A, B, 128, 64),
                "weighted": lambda: Weighted(A, B, 128, 64), "gated": lambda: LateFusionGated(A, B, 128, 64)}[kind](), D)


res = json.load(open(OUT)) if os.path.exists(OUT) else {}
SEEDS = [42, 1, 2, 3, 4]
for name in NAMES:
    D = load(name); r = {"n_test": int(len(D["yte"])), "n_test_degraded": int(D["dte"].sum()), "models": {}}
    for kind in ("expression", "mutations", "concat", "weighted", "gated", "frozen"):
        runs = [scores(build(kind, D, s), D) for s in SEEDS]
        agg = {k: (round(float(np.mean([x[k] for x in runs])), 3) if runs[0][k] is not None else None) for k in runs[0]}
        agg["auc_sd"] = round(float(np.std([x["auc"] for x in runs])), 3); r["models"][kind] = agg
        print(name, kind, agg, flush=True)
    for kind in ("gated", "frozen"):
        m = build(kind, D, 42)
        with torch.no_grad(): out = m.parts(D["XAt"], D["XBt"])
        a = out[1].squeeze(1).numpy(); dg = D["dte"]
        g = {"alpha_degraded": round(float(a[dg].mean()), 3) if dg.any() else None, "alpha_intact": round(float(a[~dg].mean()), 3),
             "alpha_q05_q95": [round(float(v), 3) for v in np.quantile(a, [0.05, 0.95])]}
        if kind == "gated":
            pre = out[2].squeeze(1).numpy(); g["pre_sigmoid_abs_median"] = round(float(np.median(np.abs(pre))), 2)
        r[f"{kind}_seed42"] = g; print(name, kind, "alpha", g, flush=True)
    w = build("weighted", D, 42); r["weighted_alpha_seed42"] = round(float(torch.clamp(w.alpha, 0, 1)), 3)
    r["epochs"] = EPOCHS; res[name if EPOCHS == 10 else f"{name}@{EPOCHS}"] = r
    json.dump(res, open(OUT, "w"), indent=1)
print("wrote", OUT)
