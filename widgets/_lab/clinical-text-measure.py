"""Planning measurement for slot 85, PRE-TRAINING AND ADAPTING (PHM5005 08-1
cells 4-19, 08-2 cells 3-65), 2026-10-01. Kenneth's note at 84's ship: 85
should SHOW a head being trained on labelled data, since 84 shows only the
trained heads' results.

Everything runs on WIDGET 84's OWN BASE -- the arc's tiny BERT, masked-token
pretraining, 3,000 steps, seed 0, built exactly as `transformer-weights.py`
builds it -- so a student meets the same model on both widgets. Pooling is
the [CLS] row throughout: 08-1 cells 12-13, 08-2's
AutoModelForSequenceClassification and 84's Sentence task all read it. The
language arc's own part C measured with MEAN pooling, so its numbers are not
this widget's; this script is.

  P  PRETRAINING as a process: held-out MLM accuracy and the lesson's own
     example ("treated with [MASK] for chest pain") at checkpoints over the
     3,000 steps. The final checkpoint must equal 84's base exactly.
  C  ADAPTATION on [CLS]: scratch, transfer, full, LoRA (r 8, alpha 32 as
     08-2 cell 57), at n = 16 . 64 . 256 . 1024 labelled notes, 400 steps of
     batch 16, three seeds, two targets (outcome: an abnormal finding
     asserted, 08-2's clinical_outcome; match: a drug given for a symptom it
     does not treat). Two learning-rate sets: the lesson's (transfer 5e-3,
     full 1e-4, LoRA 5e-4) and the arc's (5e-3, 3e-4, 1e-3).
  F  FORGETTING: MLM accuracy after adapting; LoRA merged against removed.
  M  WHAT MOVES: how far the [CLS] vectors of 300 test notes move under each
     strategy, and a linear probe on the frozen [CLS] vectors with ample data
     (transfer's ceiling) against the fine-tuned ones.

Run:  python widgets/_lab/clinical-text-measure.py [P C F M]
Writes `_lab/clinical-text-measure.json` for the mock.
"""
import copy, importlib.util, json, math, sys, time
from pathlib import Path
import torch, torch.nn as nn, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("am", here / "attention-measure.py")
AM = importlib.util.module_from_spec(spec); spec.loader.exec_module(AM)
A = AM.A
torch.set_num_threads(8)
T0 = time.time()
def log(*a): print(*a, flush=True)
OUT = {}

corpus = A.make_corpus(0, 20000)
corpus_test = A.make_corpus(1, 2000)

def mlm_acc(mdl):
    return A.mlm_accuracy(mdl, corpus_test, torch.Generator().manual_seed(3))

def lesson_example(mdl):
    """08-1 cell 4: "treated with [MASK] for chest pain" -> aspirin."""
    toks = ["treated", "with", "[MASK]", "for", "chest", "pain"]
    ids, m = A.batchify([toks])
    ids[0, 3] = A.MASK  # [CLS] at 0, so "[MASK]" sits at 3
    with torch.no_grad():
        h, _ = mdl.encode(ids, m); p = mdl.mlm(h)[0, 3].softmax(-1)
    top = p.topk(3)
    return {A.VOCAB[i]: round(v, 3) for v, i in zip(top.values.tolist(), top.indices.tolist())}

# ---------------------------------------------------------------- P
def part_P():
    log("\n== P  PRETRAINING, checkpoints over 3,000 steps (84's base) ==")
    mdl = AM.build(48, 4, 2, 0)
    g = torch.Generator().manual_seed(0)
    opt = torch.optim.Adam(mdl.parameters(), lr=1e-3); mdl.train(); run = []; rows = []
    checks = {0, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000}
    def snap(s):
        mdl.eval()
        r = {"step": s, "mlm": round(mlm_acc(mdl), 3), "drug": round(AM.drug_slot(mdl), 3),
             "example": lesson_example(mdl),
             "loss": round(sum(run[-50:]) / max(1, len(run[-50:])), 3) if run else None}
        mdl.train(); rows.append(r)
        log(f"  step {s:5d}  MLM {r['mlm']:.0%}  right drug {r['drug']:.0%}  loss {r['loss']}  {r['example']}")
    snap(0)
    for s in range(1, 3001):
        idx = torch.randint(len(corpus), (64,), generator=g)
        ids, m = A.batchify([corpus[i] for i in idx]); x, y = A.mask_tokens(ids, m, g)
        h, _ = mdl.encode(x, m)
        loss = F.cross_entropy(mdl.mlm(h).reshape(-1, A.V), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step(); run.append(loss.item())
        if s in checks: snap(s)
    mdl.eval()
    # one masked note, what the objective's targets are
    OUT["pretrain"] = rows
    return mdl

# ---------------------------------------------------------------- C
class LoRALinear(nn.Module):
    """W' = W + (alpha/r) B A, W frozen: peft's form (08-2 cell 57: r 8, alpha 32)."""
    def __init__(self, lin, r, alpha):
        super().__init__()
        self.W = nn.Parameter(lin.weight.detach().clone(), requires_grad=False)
        self.b = nn.Parameter(lin.bias.detach().clone(), requires_grad=False)
        d_out, d_in = self.W.shape
        self.A = nn.Parameter(torch.empty(r, d_in)); nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))
        self.B = nn.Parameter(torch.zeros(d_out, r))
        self.s = alpha / r; self.on = True
    def forward(self, x):
        W = self.W + self.s * self.B @ self.A if self.on else self.W
        return F.linear(x, W, self.b)

def lora_wrap(mdl, r, alpha):
    for b in mdl.blocks:
        b.att.q = LoRALinear(b.att.q, r, alpha); b.att.v = LoRALinear(b.att.v, r, alpha)

def set_lora(mdl, on):
    for b in mdl.blocks:
        for lin in (b.att.q, b.att.v):
            if isinstance(lin, LoRALinear): lin.on = on

def cls_vec(mdl, X):
    ids, m = A.batchify(X)
    with torch.no_grad(): h, _ = mdl.encode(ids, m)
    return h[:, 0]

def score(mdl, ids, m, y):
    with torch.no_grad(): return (mdl.classify(ids, m, "cls").argmax(-1) == y).float().mean().item()

LRS = {"lesson": {"transfer": 5e-3, "full": 1e-4, "lora": 5e-4, "scratch": 1e-4},
       "arc": {"transfer": 5e-3, "full": 3e-4, "lora": 1e-3, "scratch": 3e-4}}

def backbone_count(mdl):
    return sum(p.numel() for n, p in mdl.named_parameters() if not n.startswith(("mlm", "head")))

def adapt(base, strat, X, Y, seed, lr, test=None, steps=400, every=25):
    torch.manual_seed(seed)
    mdl = A.TinyBERT(A.V)
    if strat != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = strat in ("full", "scratch")
    if strat == "lora": lora_wrap(mdl, 8, 32)
    for p in mdl.mlm.parameters(): p.requires_grad = False   # a classification model has no MLM head
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    ntrain = sum(p.numel() for p in params)
    opt = torch.optim.Adam(params, lr=lr)
    g = torch.Generator().manual_seed(seed)
    ids, m = A.batchify(X); y = torch.tensor(Y); curve = []
    mdl.train()
    for s in range(1, steps + 1):
        idx = torch.randint(len(X), (min(16, len(X)),), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if test is not None and s % every == 0:
            mdl.eval(); curve.append(round(score(mdl, *test), 3)); mdl.train()
    mdl.eval()
    return mdl, ntrain, curve

def part_C(base):
    log("\n== C  ADAPTATION on [CLS]  (400 steps of batch 16; test 1,000; 3 seeds) ==")
    log(f"  backbone (embeddings + 2 blocks): {backbone_count(base):,}; MLM head "
        f"{sum(p.numel() for p in base.mlm.parameters()):,}; class head 48 x 2 + 2 = 98")
    OUT["adapt"] = {}
    for lrname, lrs in LRS.items():
        for task in ("outcome", "match"):
            Xt, Yt = A.make_task(999, 1000, task); ids_t, m_t = A.batchify(Xt); test = (ids_t, m_t, torch.tensor(Yt))
            log(f"  [{lrname} rates] target '{task}' (positives {sum(Yt)/len(Yt):.0%} of test)")
            for strat in ("transfer", "lora", "full", "scratch"):
                row, curves, ntr = [], {}, 0
                for n in (16, 64, 256, 1024):
                    accs, cs = [], []
                    for seed in range(3):
                        X, Y = A.make_task(100 + seed, n, task)
                        mdl, ntr, c = adapt(base, strat, X, Y, seed, lrs[strat], test)
                        accs.append(c[-1]); cs.append(c)
                    row.append(round(sum(accs) / 3, 3))
                    curves[n] = [round(sum(c[i] for c in cs) / 3, 3) for i in range(len(cs[0]))]
                OUT["adapt"][f"{lrname}/{task}/{strat}"] = {"trains": ntr, "acc": row, "curves": curves}
                log(f"    {strat:8s} trains {ntr:6,}: " + "  ".join(f"{a:.0%}" for a in row)
                    + f"   ({time.time()-T0:.0f}s)")

# ---------------------------------------------------------------- F
def part_F(base):
    log("\n== F  FORGETTING: MLM accuracy after adapting on 'outcome' (lesson rates, seed 0) ==")
    log(f"  base MLM {mlm_acc(base):.0%}")
    OUT["forget"] = {}
    for n in (64, 1024):
        X, Y = A.make_task(100, n, "outcome")
        r = {}
        for strat in ("transfer", "full", "lora"):
            mdl, _, _ = adapt(base, strat, X, Y, 0, LRS["lesson"][strat])
            r[strat] = round(mlm_acc(mdl), 3)
            if strat == "lora":
                set_lora(mdl, False); r["lora removed"] = round(mlm_acc(mdl), 3)
        OUT["forget"][n] = r
        log(f"  n = {n}: " + "  ".join(f"{k} {v:.0%}" for k, v in r.items()))

# ---------------------------------------------------------------- M
def probe(Z, y, Zt, yt, steps=1500):
    torch.manual_seed(0); lin = nn.Linear(Z.shape[1], 2); opt = torch.optim.Adam(lin.parameters(), lr=1e-2)
    for _ in range(steps):
        loss = F.cross_entropy(lin(Z), y); opt.zero_grad(); loss.backward(); opt.step()
    with torch.no_grad(): return (lin(Zt).argmax(-1) == yt).float().mean().item()

def part_M(base):
    log("\n== M  WHAT MOVES: the [CLS] vectors of 300 test notes, n = 1024, lesson rates, seed 0 ==")
    OUT["moves"] = {}
    for task in ("outcome", "match"):
        Xp, Yp = A.make_task(500, 4000, task); Xt, Yt = A.make_task(999, 300, task)
        Z0 = cls_vec(base, Xt)
        ceil = probe(cls_vec(base, Xp), torch.tensor(Yp), Z0, torch.tensor(Yt))
        log(f"  '{task}': a linear probe on the FROZEN [CLS] (4,000 labelled notes) scores {ceil:.0%}")
        X, Y = A.make_task(100, 1024, task); r = {"probe_frozen": round(ceil, 3)}
        for strat in ("transfer", "lora", "full"):
            mdl, _, _ = adapt(base, strat, X, Y, 0, LRS["lesson"][strat])
            Z1 = cls_vec(mdl, Xt)
            d = (Z1 - Z0).norm(dim=1).mean().item() / Z0.norm(dim=1).mean().item()
            pr = probe(cls_vec(mdl, Xp), torch.tensor(Yp), Z1, torch.tensor(Yt))
            r[strat] = {"move": round(d, 3), "probe": round(pr, 3)}
            log(f"    {strat:8s} [CLS] moves {d:.1%} of its length; a probe on its [CLS] {pr:.0%}")
        OUT["moves"][task] = r

# ---------------------------------------------------------------- U
def unseen_task(seed, n, held):
    """U: a note naming a drug, label 1 when it is a chest-pain drug. The
    symptom is NOT written, so the drug is the only evidence. The labelled
    notes name the first drug of each pair (aspirin, paracetamol, ...), the
    test notes the second (nitrate, ibuprofen, ...): words the labels never
    show. Pretraining saw both drugs in the same contexts."""
    import random
    rng = random.Random(seed); X, Y = [], []
    first = {s: d[0] for s, d in A.SYM_DRUG.items()}; second = {s: d[1] for s, d in A.SYM_DRUG.items()}
    pick = second if held else first
    while len(X) < n:
        y = int(rng.random() < 0.5)
        s = "chest pain" if y else rng.choice([x for x in A.SYMS if x != "chest pain"])
        t = [rng.choice(["treated", "managed"]), "with", pick[s]]
        if rng.random() < 0.7:
            o = A.note(rng, 1)[0]
            t = (o + ["."] + t) if rng.random() < 0.5 else (t + ["."] + o)
        X.append(t); Y.append(y)
    return X, Y

def part_U(base):
    log("\n== U  A DRUG THE LABELS NEVER NAME (train on aspirin..., test on nitrate...; 3 seeds) ==")
    Xt, Yt = unseen_task(999, 1000, True); ids_t, m_t = A.batchify(Xt); test = (ids_t, m_t, torch.tensor(Yt))
    Xs, Ys = unseen_task(998, 1000, False); ids_s, m_s = A.batchify(Xs); seen = (ids_s, m_s, torch.tensor(Ys))
    log(f"  positives {sum(Yt)/len(Yt):.0%} of test")
    OUT["unseen"] = {}
    for lrname, lrs in LRS.items():
        for strat in ("transfer", "lora", "full", "scratch"):
            row, rs, curves = [], [], {}
            for n in (16, 64, 256, 1024):
                accs, cs, ss = [], [], []
                for seed in range(3):
                    X, Y = unseen_task(100 + seed, n, False)
                    mdl, ntr, c = adapt(base, strat, X, Y, seed, lrs[strat], test)
                    accs.append(c[-1]); cs.append(c); ss.append(score(mdl, *seen))
                row.append(round(sum(accs) / 3, 3)); rs.append(round(sum(ss) / 3, 3))
                curves[n] = [round(sum(c[i] for c in cs) / 3, 3) for i in range(len(cs[0]))]
            OUT["adapt"][f"{lrname}/unseen/{strat}"] = {"trains": ntr, "acc": row, "seen": rs, "curves": curves}
            log(f"    [{lrname}] {strat:8s}: unseen drugs " + "  ".join(f"{a:.0%}" for a in row)
                + "   | the labelled drugs " + "  ".join(f"{a:.0%}" for a in rs) + f"   ({time.time()-T0:.0f}s)")

if __name__ == "__main__":
    parts = sys.argv[1:] or ["P", "C", "F", "M"]
    if parts == ["U"]:
        prev = json.loads((here / "clinical-text-measure.json").read_text(encoding="utf-8")); OUT.update(prev)
    base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, corpus, 3000, 0); base.eval()
    log(f"84's base rebuilt: MLM {mlm_acc(base):.0%}, lesson example {lesson_example(base)}  ({time.time()-T0:.0f}s)")
    if "P" in parts:
        p = part_P()
        same = all(torch.equal(a, b) for a, b in zip(p.state_dict().values(), base.state_dict().values()))
        log(f"  the checkpointed run's last state equals 84's base: {same}")
    if "C" in parts: part_C(base)
    if "F" in parts: part_F(base)
    if "M" in parts: part_M(base)
    if "U" in parts: part_U(base)
    (here / "clinical-text-measure.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")
    log(f"done ({time.time()-T0:.0f}s)")
