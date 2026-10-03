"""Slot 85's HA host label, measured for its mock, 2026-10-03 (his picks: HA host at
1,024 labelled proteins, 85's own protocol; no Pooling control). One run a way on
seed 0, as 85's table does for the notes, on the protein base of
`protein-adapt-measure.py` (part P; `protein-base.pt`, regenerated, not committed):

  curve     held-out accuracy on 1,000 of the lesson's test proteins every 10 steps
  pred      P(human) on four held-out proteins (the first two of each label in the
            test split, not chosen by outcome) at step 0 and every 50
  emb       the embedding row the map would draw: tok (25 x 48) and pos (600 x 48)
            at step 0 and step 400, as signed bytes on each matrix's own 99th
            percentile of |W_0| (the map's Weights reading)
  blinks    for every trained matrix, how many weights moved more than 5% of the
            run's largest change in each 50 steps (the map's blink), so the mock
            can say whether the long position tile lights up
  used      the positions a protein reaches (the longest test protein + [CLS] + [SEP])

Data: the lesson's CSV (NOT in the repository). Writes `adapting-ha-measure.json`.
Run:  python widgets/_lab/adapting-ha-measure.py <influenza_ha.csv>
"""
import base64, csv, importlib.util, json, sys, time
from pathlib import Path
import torch, torch.nn.functional as F
from sklearn.model_selection import train_test_split

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A = CT.A
torch.set_num_threads(8)
T0 = time.time()
def log(*a): print(*a, flush=True)

with open(sys.argv[1], newline="") as fh:
    rows = [(r["seq"].upper(), int(r["label"])) for r in csv.DictReader(fh)]
tr, vt = train_test_split(rows, test_size=0.2, random_state=42, stratify=[r[1] for r in rows])
va, te = train_test_split(vt, test_size=0.5, random_state=42, stratify=[r[1] for r in vt])
AA = "ACDEFGHIKLMNPQRSTVWY"
PAD, CLS, SEP, UNK = 0, 1, 2, 4
ID = {a: i + 5 for i, a in enumerate(AA)}
V, LMAX = 25, 600
def batch(seqs):
    ids = [[CLS] + [ID.get(ch, UNK) for ch in s][:LMAX - 2] + [SEP] for s in seqs]
    L = max(map(len, ids)); X = torch.zeros(len(ids), L, dtype=torch.long); M = torch.zeros(len(ids), L, dtype=torch.long)
    for i, r in enumerate(ids): X[i, :len(r)] = torch.tensor(r); M[i, :len(r)] = 1
    return X, M
def build(seed=0):
    torch.manual_seed(seed); return A.TinyBERT(V, D=48, H=4, Fh=96, N=2, Lmax=LMAX)

N, STEPS, EVERY, SNAP = 1024, 400, 10, 50
MATS = (["head.weight"] + [f"blocks.{b}.{m}.weight" for b in (1, 0) for m in ("att.q", "att.k", "att.v", "att.o", "ff.0", "ff.2")]
        + ["tok.weight", "pos.weight"])
TRAINS = {"scratch": MATS, "full": MATS, "transfer": ["head.weight"],
          "lora": ["head.weight"] + [f"blocks.{b}.att.{m}.weight" for b in (1, 0) for m in ("q", "v")]}
base = build(0); base.load_state_dict(torch.load(here / "protein-base.pt")); base.eval()
test = te[:1000]; Xt, Mt = batch([s for s, _ in test]); yt = torch.tensor([y for _, y in test])
ex = []
for s, y in test:
    if sum(1 for e in ex if e[1] == y) < 2: ex.append((s, y))
    if len(ex) == 4: break
ex.sort(key=lambda e: -e[1])
Xe, Me = batch([s for s, _ in ex])

def matrices(mdl):
    out = {n: p.detach().clone() for n, p in mdl.named_parameters() if n in MATS}
    for i, b in enumerate(mdl.blocks):
        for nm in ("q", "v"):
            lin = getattr(b.att, nm)
            if isinstance(lin, CT.LoRALinear): out[f"blocks.{i}.att.{nm}.weight"] = (lin.W + lin.s * lin.B @ lin.A).detach().clone()
    return out
def sb(x):
    q = x.clamp(-1, 1).mul(127).round().to(torch.int16).flatten()
    return base64.b64encode(bytes(((q + 256) % 256).to(torch.uint8).tolist())).decode("ascii")

OUT = {"n": N, "base": round(yt.float().mean().item(), 4), "used": max(len(s) for s, _ in test) + 2,
       "examples": [[s, y, len(s)] for s, y in ex], "runs": {}}
for way in ("scratch", "transfer", "full", "lora"):
    X, Y = zip(*tr[:N]); Xb, Mb = batch(X); y = torch.tensor(Y)
    mdl = build(0)
    if way != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = way in ("full", "scratch")
    if way == "lora": CT.lora_wrap(mdl, 8, 32)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    opt = torch.optim.Adam([p for p in mdl.parameters() if p.requires_grad], lr=CT.LRS["arc"][way]); g = torch.Generator().manual_seed(0)
    W0 = matrices(mdl); curve, pred, snaps = [], [], []
    def acc():
        mdl.eval(); a = 0
        with torch.no_grad():
            for i in range(0, len(test), 100): a += (mdl.classify(Xt[i:i + 100], Mt[i:i + 100], "cls").argmax(-1) == yt[i:i + 100]).sum().item()
        mdl.train(); return round(a / len(test), 4)
    def predict():
        mdl.eval()
        with torch.no_grad(): p = mdl.classify(Xe, Me, "cls").softmax(-1)[:, 1].tolist()
        mdl.train(); pred.append([round(v, 4) for v in p])
    mdl.train(); curve.append(acc()); predict()
    for s in range(1, STEPS + 1):
        idx = torch.randint(len(X), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(Xb[idx], Mb[idx], "cls"), y[idx]); opt.zero_grad(); loss.backward(); opt.step()
        if s % EVERY == 0: curve.append(acc())
        if s % SNAP == 0: predict(); Wt = matrices(mdl); snaps.append({k: Wt[k] - W0[k] for k in TRAINS[way]})
    scale = max(snaps[-1][k].abs().max().item() for k in TRAINS[way])
    blinks = {k: [int(((snaps[i][k] - (snaps[i - 1][k] if i else 0)).abs() > 0.05 * scale).sum()) for i in range(len(snaps))] for k in TRAINS[way]}
    Wf = matrices(mdl)
    emb = {}
    for k in ("tok.weight", "pos.weight"):
        sc = W0[k].abs().flatten().quantile(0.99).item()
        emb[k] = {"shape": list(W0[k].shape), "scale": round(sc, 6), "w0": sb(W0[k] / sc), "w400": sb(Wf[k] / sc)}
    OUT["runs"][way] = {"curve": curve, "pred": pred, "scale": round(scale, 6), "blinks": blinks, "emb": emb}
    log(f"  {way:8s}: {curve[-1]:.1%}  pred {pred[-1]}  pos blinks {blinks.get('pos.weight', '-')}  ({time.time()-T0:.0f}s)")

(here / "adapting-ha-measure.json").write_text(json.dumps(OUT), encoding="utf-8")
log(f"done; base rate {OUT['base']}, positions used {OUT['used']}  ({time.time()-T0:.0f}s)")
