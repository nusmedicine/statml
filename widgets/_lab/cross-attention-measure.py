"""10-2b cell 5: does the cross-attention template, run, work and teach something on bg-2030?

His question 2026-10-17: should 10-2b turn its cross-attention template (markdown
only) into a worked example beside concatenation (cells 19-28) and the gate
(29-44). Read the way 10-2b reads its CSVs (80/20 stratified split,
random_state 42, expression standardized on the training rows) and trained with
the notebook's settings (Adam 1e-3, 10 epochs, batch 256, the lesson's
GeneEncoder with dropout 0.1), five seeds.

The model is cell 5's CrossAttentionFusionModel unchanged in shape: the query
is GeneEncoder(x_gene).unsqueeze(1), (B, 1, D); keys = values = a sequence of 50
mutation tokens, (B, 50, D); nn.MultiheadAttention(batch_first=True); the head
on the attended vector. Two token constructions:
  idstatus  token_j = id_embedding[j] + status_embedding[x_j]   (every mutation
            is a token whether carried or not; the transformer's position +
            token embedding, which the students met in 08)
  scaled    token_j = x_j * id_embedding[j]   (a mutation not carried is the
            zero token, so every absent mutation looks the same)
and one head variant the template does not have, "residual": the head reads
attended + query, as a transformer block's residual does, because in the
template the expression reaches the head ONLY through the attention weights.

Then for the chosen model, per seed, what the attention weights show against
synthetic_truth.json, and a query-shuffle ablation (each test patient's
query swapped for another's) to measure how much the expression is used.

  python -I widgets/_lab/cross-attention-measure.py <dataset_dir>
writes widgets/_lab/cross-attention-measure.json.
"""
import json, os, random, sys, time
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

DIR = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cross-attention-measure.json")
torch.set_num_threads(min(16, os.cpu_count()))
SEEDS = [42, 1, 2, 3, 4]
D_EMB = 64


def seed_all(s): random.seed(s); np.random.seed(s); torch.manual_seed(s)


class GeneEncoder(nn.Module):   # cell 20, unchanged
    def __init__(self, in_dim, embed_dim=128, hidden=256, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class MutEncoder(nn.Module):   # cell 20, unchanged
    def __init__(self, in_dim, embed_dim=64, hidden=128, dropout=0.1):
        super().__init__(); self.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, embed_dim), nn.ReLU())
    def forward(self, x): return self.net(x)


class MutTokenEncoder(nn.Module):   # the proposed encoderB: one token per mutation
    def __init__(self, num_muts, embed_dim=64, kind="idstatus"):
        super().__init__(); self.kind = kind
        self.mut_id = nn.Embedding(num_muts, embed_dim)       # which mutation
        self.status = nn.Embedding(2, embed_dim)              # carried or not
        self.register_buffer("ids", torch.arange(num_muts))
    def forward(self, x):                                     # x: (B, 50) of 0/1
        idv = self.mut_id(self.ids).unsqueeze(0)              # (1, 50, D)
        if self.kind == "scaled": return x.unsqueeze(-1) * idv
        return idv + self.status(x.long())                    # (B, 50, D)


class CrossAttentionFusionModel(nn.Module):   # cell 5's template; residual is the one addition
    def __init__(self, encoderA, encoderB, embed_dim, head_dim=128, num_heads=1, num_classes=2, residual=False):
        super().__init__(); self.encoderA, self.encoderB, self.residual = encoderA, encoderB, residual
        self.cross_attn = nn.MultiheadAttention(embed_dim=embed_dim, num_heads=num_heads, batch_first=True)
        self.fusion_head = nn.Sequential(nn.Linear(embed_dim, head_dim), nn.ReLU(), nn.Linear(head_dim, num_classes))
    def parts(self, xA, xB, q_perm=None):
        Q = self.encoderA(xA).unsqueeze(1)
        if q_perm is not None: Q = Q[q_perm]
        K = self.encoderB(xB); V = K
        out, w = self.cross_attn(Q, K, V)                     # (B,1,D), (B,1,50) averaged over heads
        h = out.squeeze(1) + (Q.squeeze(1) if self.residual else 0)
        return self.fusion_head(h), w.squeeze(1)
    def forward(self, xA, xB): return self.parts(xA, xB)[0]


class Single(nn.Module):
    def __init__(self, enc, dim, which): super().__init__(); self.enc, self.head, self.which = enc, nn.Linear(dim, 2), which
    def forward(self, xA, xB): return self.head(self.enc(xA if self.which == "A" else xB))


class ConcatFusion(nn.Module):   # cell 20
    def __init__(self, encA, encB, dimA, dimB, head_hidden=128):
        super().__init__(); self.encoderA, self.encoderB = encA, encB
        self.fusion_head = nn.Sequential(nn.Linear(dimA + dimB, head_hidden), nn.ReLU(), nn.Linear(head_hidden, 2))
    def forward(self, xA, xB): return self.fusion_head(torch.cat([self.encoderA(xA), self.encoderB(xB)], 1))


E = np.genfromtxt(os.path.join(DIR, "synthetic_expression.csv"), delimiter=",", skip_header=1)
M = np.loadtxt(os.path.join(DIR, "synthetic_mutations.csv"), delimiter=",", skiprows=1)
y = np.loadtxt(os.path.join(DIR, "synthetic_labels.csv"), skiprows=1).astype(int)
truth = json.load(open(os.path.join(DIR, "synthetic_truth.json")))
deg = np.array(truth["degraded"])
Etr, Ete, Mtr, Mte, ytr, yte, dtr, dte = train_test_split(E, M, y, deg, test_size=0.2, random_state=42, stratify=y)
sc = StandardScaler().fit(Etr); Etr, Ete_s = sc.transform(Etr), sc.transform(Ete)
T = lambda a, dt=torch.float32: torch.tensor(a, dtype=dt)
DS = dict(XA=T(Etr), XB=T(Mtr), Y=T(ytr, torch.long), XAt=T(Ete_s), XBt=T(Mte))
dte = dte.astype(bool)
DRIVERS = [m - 1 for m in truth["driver_muts"]]; FLIP_M = truth["flip_mut"] - 1; FLIP_G = truth["flip_gene"] - 1
NM = M.shape[1]


def fit(model, epochs):
    opt = torch.optim.Adam(model.parameters(), lr=1e-3); n = len(DS["Y"])
    for _ in range(epochs):
        model.train()
        for b in torch.randperm(n).split(256):
            loss = F.cross_entropy(model(DS["XA"][b], DS["XB"][b]), DS["Y"][b]); opt.zero_grad(); loss.backward(); opt.step()
    model.eval(); return model


def auc_of(logits, mask=None):
    p = logits.softmax(1)[:, 1].numpy(); yy = yte
    if mask is not None: p, yy = p[mask], yy[mask]
    return float(roc_auc_score(yy, p))


def build(kind, seed, epochs, tok="idstatus", heads=1, residual=False, train=True):
    seed_all(seed); dA = DS["XA"].shape[1]
    if kind == "xattn":
        m = CrossAttentionFusionModel(GeneEncoder(dA, embed_dim=D_EMB), MutTokenEncoder(NM, D_EMB, tok), D_EMB, num_heads=heads, residual=residual)
    elif kind == "expression": m = Single(GeneEncoder(dA), 128, "A")
    elif kind == "mutations": m = Single(MutEncoder(NM), 64, "B")
    else: m = ConcatFusion(GeneEncoder(dA), MutEncoder(NM), 128, 64)
    return fit(m, epochs) if train else m.eval()


r3 = lambda v: round(float(v), 3)
res = {"dataset": os.path.basename(os.path.normpath(DIR)), "n_test": int(len(yte)), "n_test_degraded": int(dte.sum()),
       "drivers": truth["driver_muts"], "driver_b": truth["driver_b"], "flip_mut": truth["flip_mut"], "flip_gene": truth["flip_gene"],
       "carrier_rate_test": [r3(v) for v in Mte.mean(0)], "embed_dim": D_EMB, "seeds": SEEDS, "auc": {}}

# ---------------------------------------------------------------- AUC table
ARMS = [("expression", {}), ("mutations", {}), ("concat", {}),
        ("xattn idstatus", dict(tok="idstatus")), ("xattn scaled", dict(tok="scaled")),
        ("xattn idstatus 4 heads", dict(tok="idstatus", heads=4)),
        ("xattn idstatus residual", dict(tok="idstatus", residual=True)), ("xattn scaled residual", dict(tok="scaled", residual=True))]
for ep in (10, 30):
    for name, kw in ARMS:
        t0 = time.time(); kind = name.split()[0]; a, ad, ai, sh = [], [], [], []
        for s in SEEDS:
            m = build(kind, s, ep, **kw)
            with torch.no_grad():
                if kind == "xattn":
                    lg = m.parts(DS["XAt"], DS["XBt"])[0]
                    g = torch.Generator().manual_seed(s); perm = torch.randperm(len(yte), generator=g)
                    sh.append(auc_of(m.parts(DS["XAt"], DS["XBt"], q_perm=perm)[0]))
                else: lg = m(DS["XAt"], DS["XBt"])
            a.append(auc_of(lg)); ad.append(auc_of(lg, dte)); ai.append(auc_of(lg, ~dte))
        row = {"auc": r3(np.mean(a)), "auc_sd": r3(np.std(a)), "auc_min": r3(min(a)), "auc_max": r3(max(a)),
               "auc_degraded": r3(np.mean(ad)), "auc_intact": r3(np.mean(ai)), "per_seed": [r3(v) for v in a]}
        if sh: row["auc_query_shuffled"] = r3(np.mean(sh))
        res["auc"][f"{name}@{ep}"] = row
        print(f"{name}@{ep}", row, f"{time.time() - t0:.1f}s", flush=True)

# ---------------------------------------------------------------- what the attention shows
def attention_report(ep, tok, residual):
    out = {"per_seed": []}
    carriers = Mte.astype(bool)
    g8 = Ete_s[:, FLIP_G]
    for s in SEEDS + ["init"]:
        m = build("xattn", 42 if s == "init" else s, ep, tok=tok, residual=residual, train=(s != "init"))
        with torch.no_grad(): _, w = m.parts(DS["XAt"], DS["XBt"])
        w = w.numpy()                                          # (n_test, 50)
        mean = w.mean(0)
        car = np.array([w[carriers[:, j], j].mean() if carriers[:, j].any() else np.nan for j in range(NM)])
        non = np.array([w[~carriers[:, j], j].mean() for j in range(NM)])
        md, mi = w[dte].mean(0), w[~dte].mean(0)
        rank = np.argsort(-mean)
        top6 = [int(j) + 1 for j in rank[:6]]
        # share of attention on the tokens a patient carries, against the share of tokens carried
        on_carried = (w * carriers).sum(1); frac_carried = carriers.mean(1)
        ent = -(w * np.log(w + 1e-12)).sum(1)
        # does attention to the flip mutation follow the flip gene? within intact patients, by carrier status
        a27 = w[:, FLIP_M]
        c27 = carriers[:, FLIP_M]
        corr = lambda u, v: r3(np.corrcoef(u, v)[0, 1]) if len(u) > 2 and np.std(u) > 0 else None
        # how much attention varies between patients: SD across patients of each mutation's weight, averaged
        rec = {"seed": s, "mean": [round(float(v), 4) for v in mean], "carrier": [round(float(v), 4) for v in car], "noncarrier": [round(float(v), 4) for v in non],
               "degraded": [round(float(v), 4) for v in md], "intact": [round(float(v), 4) for v in mi],
               "top6": top6, "drivers_in_top6": len(set(top6) & set(res["drivers"])), "flip_in_top6": res["flip_mut"] in top6,
               "rank_of": {str(j + 1): int(np.where(rank == j)[0][0]) + 1 for j in DRIVERS + [FLIP_M]},
               "mass_drivers": r3(mean[DRIVERS].sum()), "mass_flip": r3(mean[FLIP_M]), "mass_uniform_6": r3(6 / NM),
               "corr_mean_vs_carrier_rate": corr(mean, Mte.mean(0)),
               "share_on_carried": r3(on_carried.mean()), "share_tokens_carried": r3(frac_carried.mean()),
               "entropy_mean": r3(ent.mean()), "entropy_uniform": r3(np.log(NM)),
               "entropy_degraded": r3(ent[dte].mean()), "entropy_intact": r3(ent[~dte].mean()),
               "between_patient_sd": r3(w.std(0).mean()),
               "corr_a27_gene8_intact_carrier": corr(a27[~dte & c27], g8[~dte & c27]),
               "corr_a27_gene8_intact_noncarrier": corr(a27[~dte & ~c27], g8[~dte & ~c27]),
               "a27_degraded": r3(a27[dte].mean()), "a27_intact": r3(a27[~dte].mean()),
               "a27_intact_carrier": r3(a27[~dte & c27].mean()), "a27_intact_noncarrier": r3(a27[~dte & ~c27].mean())}
        # how much the degraded patients' attention differs from the intact patients': total variation distance
        crank = np.argsort(-np.nan_to_num(car, nan=-1.0))   # rank among patients who CARRY each mutation, which removes the carrier rate
        rec["carrier_rank_of"] = {str(j + 1): int(np.where(crank == j)[0][0]) + 1 for j in DRIVERS + [FLIP_M]}
        rec["drivers_in_carrier_top10"] = int(sum(rec["carrier_rank_of"][str(j + 1)] <= 10 for j in DRIVERS))
        oth = [j for j in range(NM) if j not in DRIVERS and j != FLIP_M]
        rec["carrier_other_median"] = round(float(np.nanmedian(car[oth])), 4); rec["noncarrier_median"] = round(float(np.median(non)), 4)
        rec["tv_degraded_vs_intact"] = r3(0.5 * np.abs(md - mi).sum())
        # within degraded patients, how similar every patient's attention is (their queries are junk)
        rec["between_patient_sd_degraded"] = r3(w[dte].std(0).mean()); rec["between_patient_sd_intact"] = r3(w[~dte].std(0).mean())
        # one example-friendly number per driver: carrier vs non-carrier attention
        out["per_seed"].append(rec)
        print(ep, tok, residual, s, {k: rec[k] for k in ("top6", "drivers_in_top6", "flip_in_top6", "mass_drivers", "mass_flip", "corr_mean_vs_carrier_rate",
                                                          "share_on_carried", "share_tokens_carried", "entropy_mean", "tv_degraded_vs_intact",
                                                          "corr_a27_gene8_intact_carrier", "corr_a27_gene8_intact_noncarrier", "carrier_rank_of", "carrier_other_median", "noncarrier_median")}, flush=True)
    return out


res["attention"] = {}
for ep, tok, residual in [(10, "idstatus", False), (30, "idstatus", False), (10, "scaled", False), (10, "idstatus", True), (10, "scaled", True)]:
    res["attention"][f"{tok}{' residual' if residual else ''}@{ep}"] = attention_report(ep, tok, residual)
    json.dump(res, open(OUT, "w", encoding="utf-8", newline="\n"), indent=1)
print("wrote", OUT)
