"""Slot 85's open question, measured 2026-10-04 (his "run the scratch gap measurement"):
on Drug error, from scratch scores 58% where full fine-tuning scores 84% (the table,
400 steps, [CLS]). Is that missing knowledge, or [CLS] being slow to train from random
weights? The arc's part C, with MEAN pooling, had from scratch at 84%.

Drug error as the widget draws it (the generator's PLAUSIBLE pairs left out), 1,024
labelled notes, batch 16, the arc's rates, test 1,000 notes; three seeds, each its
own labelled notes (make_drug_error(100 + seed)):

  scratch on [CLS] at 400 · 1,600 · 4,000 steps
  scratch on the MEAN at 400 · 1,600 steps
  full fine-tuning on [CLS] at 400 · 1,600 steps (the reference)

Run:  python widgets/_lab/adapting-scratch-gap.py     (a few minutes)
Writes `_lab/adapting-scratch-gap.json`.
"""
import importlib.util, json, random, statistics as st, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A, AM = CT.A, CT.AM
T0 = time.time()
def log(*a): print(*a, flush=True)

PLAUSIBLE = {("fever", "aspirin"), ("chest pain", "oxygen"), ("chest pain", "ibuprofen"), ("chest pain", "paracetamol"),
             ("breathlessness", "nitrate"), ("fever", "antibiotics"), ("fever", "cefazolin")}   # as adapting-table.py
def make_drug_error(seed, n):
    rng = random.Random(seed); X, Y = [], []
    while len(X) < n:
        s = rng.choice(A.SYMS); bad = rng.random() < 0.5
        d = rng.choice([x for x in A.DRUGS if x not in A.SYM_DRUG[s] and (s, x) not in PLAUSIBLE] if bad else A.SYM_DRUG[s])
        t = [rng.choice(["treated", "managed"]), "with", d, "for"] + A.sym_words(s)
        other = A.note(rng, rng.choice([0, 1, 2]) or 1)[0] if rng.random() < 0.7 else []
        t = (other + ["."] + t) if other and rng.random() < 0.5 else (t + ["."] + other if other else t)
        X.append(t); Y.append(int(bad))
    return X, Y

base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, CT.corpus, 3000, 0); base.eval()
Xt, Yt = make_drug_error(999, 1000); tids, tm = A.batchify(Xt); ty = torch.tensor(Yt)

def run(way, steps, pool, seed):
    X, Y = make_drug_error(100 + seed, 1024); ids, m = A.batchify(X); y = torch.tensor(Y)
    torch.manual_seed(seed); mdl = A.TinyBERT(A.V)
    if way != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.mlm.parameters(): p.requires_grad = False
    opt = torch.optim.Adam([p for p in mdl.parameters() if p.requires_grad], lr=CT.LRS["arc"][way]); g = torch.Generator().manual_seed(seed)
    mdl.train()
    for s in range(steps):
        idx = torch.randint(len(y), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], pool), y[idx]); opt.zero_grad(); loss.backward(); opt.step()
    mdl.eval()
    with torch.no_grad(): return (mdl.classify(tids, tm, pool).argmax(-1) == ty).float().mean().item()

OUT = {}
for way, steps, pool in [("scratch", 400, "cls"), ("scratch", 1600, "cls"), ("scratch", 4000, "cls"),
                         ("scratch", 400, "mean"), ("scratch", 1600, "mean"), ("full", 400, "cls"), ("full", 1600, "cls")]:
    v = [run(way, steps, pool, sd) for sd in range(3)]
    OUT[f"{way}/{steps}/{pool}"] = [round(x, 4) for x in v]
    log(f"  {way:7s} {steps:5d} steps {pool:4s}: {st.mean(v):.1%} ± {st.stdev(v):.1%}  {[round(x, 3) for x in v]}  ({time.time()-T0:.0f}s)")
(here / "adapting-scratch-gap.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")
log(f"done ({time.time()-T0:.0f}s)")
