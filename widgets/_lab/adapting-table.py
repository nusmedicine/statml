"""Generates `widgets/adapting/table.js`, everything widget 85 draws, computed
ahead in torch because the widget trains nothing in the browser (as 65 and 75
ship theirs). Run it again after any change to the grammar, the base model or
the training here, then `node widgets/_lab/adapting-verify.mjs`.

THE BASE is widget 84's, rebuilt exactly as `transformer-weights.py` builds
it (masked-token pretraining, 3,000 steps, seed 0). The pretraining run below
repeats that run with checkpoints and is asserted to end bit for bit on the
same weights, so page 1's last checkpoint is 84's model.

  pretrain   thirteen checkpoints (0 ... 3,000 steps): masked-token accuracy
             on 2,000 held-out notes, and the five most likely tokens at the
             lesson's [MASK] (08-1 cell 4: "treated with [MASK] for chest
             pain"). The page steps through seven of them and draws the
             accuracy line through every one passed.
  masked     three unlabelled notes from the corpus with the tokens the
             lesson's rule hides (15% of the real tokens, 08-1 cell 4), the
             first three whose draw hid one or two tokens and that fit a line.
  adapt      the picks of 2026-10-01 (catalogue § Slot 85): two tasks x four
             sizes x four ways (transfer, LoRA r 8 alpha 32 on Q and V, full,
             scratch), one run each (seed 0), 400 steps of batch 16, Adam at
             the arc's rates (5e-3, 1e-3, 3e-4, 3e-4), the [CLS] row's final
             vector into a Linear(48 -> 2) head; held-out accuracy on 1,000
             notes at step 0 and every 10 steps.
  notes      four of each task's labelled training notes, two of each label,
             the first that fit a line (60 characters), in the order the set holds them.

Run:  python widgets/_lab/adapting-table.py            (about 4 min)
      python widgets/_lab/adapting-table.py --check    rerun one entry and compare
"""
import importlib.util, json, sys, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A, AM = CT.A, CT.AM
T0 = time.time()
def log(*a): print(*a, flush=True)

STRATS = ("transfer", "full", "lora", "scratch")
LR = CT.LRS["arc"]
SIZES = (16, 64, 256, 1024)
TASKS = ("outcome", "match")
CHECKS = (0, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000)
EVERY, STEPS = 10, 400

def top5(mdl):
    ids, m = A.batchify([["treated", "with", "[MASK]", "for", "chest", "pain"]])
    with torch.no_grad():
        h, _ = mdl.encode(ids, m); p = mdl.mlm(h)[0, 3].softmax(-1)
    t = p.topk(5)
    return [[A.VOCAB[i], round(v, 4)] for v, i in zip(t.values.tolist(), t.indices.tolist())]

def pretrain():
    mdl = AM.build(48, 4, 2, 0)
    g = torch.Generator().manual_seed(0)
    opt = torch.optim.Adam(mdl.parameters(), lr=1e-3); mdl.train(); rows = []
    def snap(s):
        mdl.eval(); rows.append({"step": s, "mlm": round(CT.mlm_acc(mdl), 4), "top": top5(mdl)}); mdl.train()
    snap(0)
    for s in range(1, 3001):
        idx = torch.randint(len(CT.corpus), (64,), generator=g)
        ids, m = A.batchify([CT.corpus[i] for i in idx]); x, y = A.mask_tokens(ids, m, g)
        h, _ = mdl.encode(x, m)
        loss = F.cross_entropy(mdl.mlm(h).reshape(-1, A.V), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()
        if s in CHECKS: snap(s)
    mdl.eval()
    return mdl, rows

def masked_notes():
    g = torch.Generator().manual_seed(85); out = []
    for t in CT.corpus:
        if len(" ".join(t)) > 44: continue
        ids, m = A.batchify([t]); x, _ = A.mask_tokens(ids, m, g)
        hid = [i - 1 for i in range(1, len(t) + 1) if x[0, i] == A.MASK]
        if 1 <= len(hid) <= 2: out.append({"tokens": t, "hidden": hid})
        if len(out) == 3: break
    return out

def run(base, strat, X, Y, test, seed=0):
    torch.manual_seed(seed)
    mdl = A.TinyBERT(A.V)
    if strat != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = strat in ("full", "scratch")
    if strat == "lora": CT.lora_wrap(mdl, 8, 32)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=LR[strat])
    g = torch.Generator().manual_seed(seed)
    ids, m = A.batchify(X); y = torch.tensor(Y)
    curve = []
    mdl.eval(); curve.append(round(CT.score(mdl, *test), 4)); mdl.train()
    for s in range(1, STEPS + 1):
        idx = torch.randint(len(X), (min(16, len(X)),), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if s % EVERY == 0:
            mdl.eval(); curve.append(round(CT.score(mdl, *test), 4)); mdl.train()
    return curve, sum(p.numel() for p in params)

def test_set(task):
    Xt, Yt = A.make_task(999, 1000, task); ids, m = A.batchify(Xt)
    return (ids, m, torch.tensor(Yt)), sum(Yt) / len(Yt)

def notes(task):
    X, Y = A.make_task(100, 16, task); order = []
    for x, y in zip(X, Y):
        if len(" ".join(x)) <= 60 and sum(1 for o in order if o[1] == y) < 2: order.append([" ".join(x), y])
    return order[:4]

base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, CT.corpus, 3000, 0); base.eval()

if "--check" in sys.argv:
    js = (here.parent / "adapting" / "table.js").read_text(encoding="utf-8")
    T = json.loads(js[js.index("{"):js.rindex("}") + 1])
    test, _ = test_set("match"); X, Y = A.make_task(100, 256, "match")
    curve, _ = run(base, "lora", X, Y, test)
    worst = max(abs(a - b) for a, b in zip(curve, T["adapt"]["match"]["256"]["lora"]))
    log(f"rerun match / 256 / lora: worst difference from the table {worst:.4f}")
    sys.exit(0 if worst < 1e-3 else 1)

mdl, pre = pretrain()
same = all(torch.equal(a, b) for a, b in zip(mdl.state_dict().values(), base.state_dict().values()))
assert same, "the checkpointed run did not end on 84's base"
log(f"pretraining: {len(pre)} checkpoints, ends on 84's base; lesson example {pre[-1]['top'][:2]}  ({time.time()-T0:.0f}s)")

T = {"pretrain": pre, "masked": masked_notes(), "rates": LR, "every": EVERY, "steps": STEPS,
     "trains": {}, "base": {}, "notes": {}, "adapt": {}}
for task in TASKS:
    test, rate = test_set(task); T["base"][task] = round(rate, 4); T["notes"][task] = notes(task); T["adapt"][task] = {}
    for n in SIZES:
        X, Y = A.make_task(100, n, task); T["adapt"][task][str(n)] = {}
        for s in STRATS:
            curve, k = run(base, s, X, Y, test); T["adapt"][task][str(n)][s] = curve; T["trains"][s] = k
        log(f"  {task} n {n}: " + "  ".join(f"{s} {T['adapt'][task][str(n)][s][-1]:.0%}" for s in STRATS) + f"  ({time.time()-T0:.0f}s)")

out = here.parent / "adapting" / "table.js"
out.write_text("/* GENERATED by widgets/_lab/adapting-table.py; do not edit. Everything widget 85 draws, from torch. */\n"
               f"export const TABLE = {json.dumps(T, separators=(',', ':'))};\n", encoding="utf-8", newline="\n")
log(f"wrote {out} ({out.stat().st_size:,} bytes)  ({time.time()-T0:.0f}s)")
