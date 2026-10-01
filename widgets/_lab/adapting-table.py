"""Generates `widgets/adapting/table.js`, everything widget 85 draws, computed
ahead in torch because the widget trains nothing in the browser (as 65 and 75
ship theirs). Run it again after any change to the grammar, 84's base or the
training here, then `node widgets/_lab/adapting-verify.mjs`.

THE REPLAN OF 2026-10-01 (catalogue § Slot 85, REPLANNED): four pages, a way
each — from scratch, transfer, full fine-tuning, LoRA — each animating the
CHANGE in every weight since training began, with LoRA's W + (alpha/r) A B^T
drawn in detail. Measured first (`_lab/adapting-weights-measure.py`): full
fine-tuning moves a matrix by about a tenth of its size, invisible on a picture
of W and plain on a picture of |W_t - W_0|; on the Wrong drug task the pattern
of change turns during training (cosine with the final change 0.45 at step
100), so the page plays REAL snapshots rather than fading the final one in.

THE BASE is widget 84's, rebuilt exactly as `transformer-weights.py` builds it.
Every run: 1,024 labelled notes (his pick: the size is fixed), seed 0, 400
steps of batch 16, Adam at the arc's rates, the [CLS] row's final vector into a
Linear(48 -> 2) head, held-out accuracy on 1,000 notes at step 0 and every 10.

  curve     41 accuracies a run.
  maps      W_t - W_0, SIGNED, for every matrix the way trains (the forward's
            own matrix: for LoRA, W + (alpha/r) B A), at steps 50, 100 ... 400,
            each value divided by the run's SCALE (the LARGEST final |change|
            over every trained weight: one scale a page; round 2 made it the
            largest so nothing is clamped and the page's blink threshold, 10% of
            the largest change, is exact), stored as a signed byte (x 127), row by row
            in torch's [out][in] layout, snapshot by snapshot, the matrices in
            the run's `mats` order; base64. Matrices the way leaves frozen are
            not stored: the generator asserts they did not move.
  w0        THE STARTING WEIGHTS (round 1, 2026-10-01: his "i thought the
            weights would be there then change with training"; picked: Show
            Weights · Change, Weights first): every matrix of the pretrained
            base and of from scratch's random start, each as a signed byte on
            its own scale (the 99th percentile of its |W_0|, in `w0scale`).
            The page draws W_t = W_0 + the change. The head starts the same
            on every way (one seed), so both starts carry it.
  lora      block 1's W_Q (84's, frozen: `wq`) and the LoRA factors on it
            every 25 steps, in peft's names: A is r x 48 (random at the
            start), B is 48 x r (ZERO at the start, so the update is zero and
            W' = W). The lesson writes W' = W + A B^T with A, B 48 x r: its A
            is peft's B and its B^T is peft's A, so the page uses the lesson's
            names.
  examples  ROUND 4 (his "maybe some examples of inputs and the labels";
            picked E2): four HELD-OUT notes a task, not chosen by outcome — the
            first two of each label in the held-out set that fit a line (60
            characters) — and each run's P(label 1) on them at step 0 and every
            50 steps (`pred`, 9 x 4). Evaluation only, so the training is
            unchanged.

Run:  python widgets/_lab/adapting-table.py            (about 1 min)
      python widgets/_lab/adapting-table.py --check    rerun one entry and compare
"""
import base64, importlib.util, json, sys, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A, AM = CT.A, CT.AM
T0 = time.time()
def log(*a): print(*a, flush=True)

WAYS = ("scratch", "transfer", "full", "lora")
TASKS = ("outcome", "match")
LR = CT.LRS["arc"]
N, STEPS, EVERY, SNAP, LSNAP = 1024, 400, 10, 50, 25
R_, ALPHA = 8, 32
MATS = (["head.weight"]
        + [f"blocks.{b}.{m}.weight" for b in (1, 0) for m in ("att.q", "att.k", "att.v", "att.o", "ff.0", "ff.2")]
        + ["tok.weight", "pos.weight"])
TRAINS = {"scratch": MATS, "full": MATS, "transfer": ["head.weight"],
          "lora": ["head.weight"] + [f"blocks.{b}.att.{m}.weight" for b in (1, 0) for m in ("q", "v")]}

base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, CT.corpus, 3000, 0); base.eval()

def matrices(mdl):
    """every matrix as the forward uses it: LoRA's W + s B A"""
    out = {n: p.detach().clone() for n, p in mdl.named_parameters() if n in MATS}
    for i, b in enumerate(mdl.blocks):
        for nm in ("q", "v"):
            lin = getattr(b.att, nm)
            if isinstance(lin, CT.LoRALinear): out[f"blocks.{i}.att.{nm}.weight"] = (lin.W + lin.s * lin.B @ lin.A).detach().clone()
    return out

def test_set(task):
    Xt, Yt = A.make_task(999, 1000, task); ids, m = A.batchify(Xt)
    return (ids, m, torch.tensor(Yt)), sum(Yt) / len(Yt)

def run(way, task, test, ex):
    X, Y = A.make_task(100, N, task)
    torch.manual_seed(0)
    mdl = A.TinyBERT(A.V)
    if way != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = way in ("full", "scratch")
    if way == "lora": CT.lora_wrap(mdl, R_, ALPHA)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=LR[way]); g = torch.Generator().manual_seed(0)
    ids, m = A.batchify(X); y = torch.tensor(Y)
    W0 = matrices(mdl); curve, snaps, lora, pred = [], [], [], []
    eid, em = A.batchify([n.split() for n, _ in ex])
    def predict():
        mdl.eval()
        with torch.no_grad(): p = mdl.classify(eid, em, "cls").softmax(-1)[:, 1].tolist()
        mdl.train(); pred.append([round(v, 4) for v in p])
    def acc():
        mdl.eval(); a = round(CT.score(mdl, *test), 4); mdl.train(); return a
    def factors(s):
        lin = mdl.blocks[0].att.q
        lora.append({"step": s, "A": [[round(v, 5) for v in r] for r in lin.A.detach().tolist()],
                     "B": [[round(v, 5) for v in r] for r in lin.B.detach().tolist()]})
    mdl.train(); curve.append(acc()); predict()
    if way == "lora": factors(0)
    for s in range(1, STEPS + 1):
        idx = torch.randint(len(X), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if s % EVERY == 0: curve.append(acc())
        if s % SNAP == 0:
            predict(); Wt = matrices(mdl); snaps.append({k: (Wt[k] - W0[k]) for k in MATS})
        if way == "lora" and s % LSNAP == 0: factors(s)
    # frozen means untouched: assert it, so the page's "frozen" is a fact
    for k in MATS:
        if k not in TRAINS[way]: assert snaps[-1][k].abs().max().item() == 0, f"{way}: {k} moved"
    fin = torch.cat([snaps[-1][k].abs().flatten() for k in TRAINS[way]])
    scale = fin.max().item()   # the largest change: nothing is clamped, and the blink's "10% of the largest change" is exact
    raw = bytearray()
    for sn in snaps:
        for k in TRAINS[way]:
            raw += signed_bytes(sn[k] / scale)
    if way == "scratch": START["scratch"] = W0
    out = {"curve": curve, "pred": pred, "scale": round(scale, 6), "maps": base64.b64encode(bytes(raw)).decode("ascii"), "mats": TRAINS[way],
           "rel": {k: round((snaps[-1][k].norm() / W0[k].norm()).item(), 4) for k in TRAINS[way]}}
    if way == "transfer": START["base"] = W0
    if way == "lora": out["lora"] = lora
    return out

START = {}
def signed_bytes(x):
    """values in [-1, 1] as signed bytes (x 127), two's complement in a byte"""
    q = x.clamp(-1, 1).mul(127).round().to(torch.int16).flatten()
    return bytes(((q + 256) % 256).to(torch.uint8).tolist())

def examples(task):
    X, Y = A.make_task(999, 1000, task); got = []
    for x, y in zip(X, Y):
        if len(" ".join(x)) <= 60 and sum(1 for g in got if g[1] == y) < 2: got.append([" ".join(x), y])
        if len(got) == 4: break
    return got

if "--check" in sys.argv:
    js = (here.parent / "adapting" / "table.js").read_text(encoding="utf-8")
    T = json.loads(js[js.index("{"):js.rindex("}") + 1])
    test, _ = test_set("match"); r = run("lora", "match", test, T["examples"]["match"])
    worst = max(abs(a - b) for a, b in zip(r["curve"], T["runs"]["match"]["lora"]["curve"]))
    same = r["maps"] == T["runs"]["match"]["lora"]["maps"]
    log(f"rerun match / lora: curve worst difference {worst:.4f}; maps identical: {same}")
    sys.exit(0 if worst < 1e-3 and same else 1)

head = 48 * 2 + 2
backbone = sum(p.numel() for n, p in base.named_parameters() if not n.startswith(("mlm", "head")))
T = {"n": N, "steps": STEPS, "every": EVERY, "snap": SNAP, "lsnap": LSNAP, "r": R_, "alpha": ALPHA, "rates": LR,
     "shapes": {k: list(v.shape) for k, v in base.named_parameters() if k in MATS},
     "wq": [[round(v, 5) for v in r] for r in base.blocks[0].att.q.weight.detach().tolist()],
     "trains": {"scratch": backbone + head, "full": backbone + head, "transfer": head, "lora": 2 * 2 * 2 * 48 * R_ + head, "backbone": backbone},
     "base": {}, "examples": {}, "runs": {}}
for task in TASKS:
    test, rate = test_set(task); T["base"][task] = round(rate, 4); T["examples"][task] = examples(task); T["runs"][task] = {}
    for way in WAYS:
        r = run(way, task, test, T["examples"][task]); T["runs"][task][way] = r
        log(f"  {task} {way:8s}: {r['curve'][-1]:.0%}, scale {r['scale']:.4f}, maps {len(r['maps']):,} chars  ({time.time()-T0:.0f}s)")

T["w0"], T["w0scale"] = {}, {}
for start in ("base", "scratch"):
    W0 = START[start]; raw = bytearray(); T["w0scale"][start] = {}
    for k in MATS:
        sc = torch.quantile(W0[k].abs().flatten().float(), 0.99).item() if W0[k].numel() > 1000 else W0[k].abs().max().item()
        T["w0scale"][start][k] = round(sc, 6); raw += signed_bytes(W0[k] / sc)
    T["w0"][start] = base64.b64encode(bytes(raw)).decode("ascii")
T["mats"] = list(MATS)
out = here.parent / "adapting" / "table.js"
out.write_text("/* GENERATED by widgets/_lab/adapting-table.py; do not edit. Everything widget 85 draws, from torch. */\n"
               f"export const TABLE = {json.dumps(T, separators=(',', ':'))};\n", encoding="utf-8", newline="\n")
log(f"wrote {out} ({out.stat().st_size:,} bytes)  ({time.time()-T0:.0f}s)")
