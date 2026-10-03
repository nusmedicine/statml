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

THE PROTEINS (2026-10-03, his picks; catalogue § Slot 85, HA HOST MEASURED AND
MOCKED): a third task, Influenza host, on its own model — 85's shape with 600
positions and 25 tokens, pretrained by hiding residues (`protein-base.pt`, from
`protein-adapt-measure.py` part P) — at the notes' protocol, 1,024 labelled
proteins. So the shapes, the counts, W_Q and the starting weights live per
MODEL (`models.notes`, `models.proteins`, with `used`, the positions a sequence
reaches), and `model` names each task's. The task keys are the link values.

Run:  python widgets/_lab/adapting-table.py <influenza_ha.csv>   (about 13 min; the lesson's
      CSV, not in the repository)
      python widgets/_lab/adapting-table.py --check    rerun drug-error / LoRA and compare
"""
import base64, csv, importlib.util, json, sys, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A, AM = CT.A, CT.AM
T0 = time.time()
def log(*a): print(*a, flush=True)

WAYS = ("scratch", "transfer", "full", "lora")
# THE TASKS (2026-10-03, his picks: one Task control, Outcome · Drug error · Influenza host): the link values are the
# buttons' words; the two clinical tasks keep the grammar's own names, `outcome` and `match`, inside make_task
TASKS = {"outcome": ("notes", "outcome"), "drug-error": ("notes", "match"), "influenza-host": ("proteins", None)}
LR = CT.LRS["arc"]
N, STEPS, EVERY, SNAP, LSNAP = 1024, 400, 10, 50, 25
R_, ALPHA = 8, 32
MATS = (["head.weight"]
        + [f"blocks.{b}.{m}.weight" for b in (1, 0) for m in ("att.q", "att.k", "att.v", "att.o", "ff.0", "ff.2")]
        + ["tok.weight", "pos.weight"])
TRAINS = {"scratch": MATS, "full": MATS, "transfer": ["head.weight"],
          "lora": ["head.weight"] + [f"blocks.{b}.att.{m}.weight" for b in (1, 0) for m in ("q", "v")]}

# ------------------------------------------------------------------ the notes: 84's base and the grammar
BASE = {"notes": AM.build(48, 4, 2, 0)}
AM.pretrain_log(BASE["notes"], CT.corpus, 3000, 0); BASE["notes"].eval()
def notes_build():
    torch.manual_seed(0); return A.TinyBERT(A.V)
def notes_data(task):
    X, Y = A.make_task(100, N, task); ids, m = A.batchify(X)
    Xt, Yt = A.make_task(999, 1000, task); tids, tm = A.batchify(Xt)
    ex = []
    for x, y in zip(Xt, Yt):
        if len(" ".join(x)) <= 60 and sum(1 for g in ex if g[1] == y) < 2: ex.append([" ".join(x), y])
        if len(ex) == 4: break
    eid, em = A.batchify([n.split() for n, _ in ex])
    return {"train": (ids, m, torch.tensor(Y)), "test": (tids, tm, torch.tensor(Yt)), "ex": (eid, em), "examples": ex,
            "rate": sum(Yt) / len(Yt), "used": int(max(m.sum(1).max(), tm.sum(1).max()))}

# ------------------------------------------------------------------ the proteins: HA host (08-3's data)
# THE PROTEIN MODEL (catalogue § Slot 85, 2026-10-02/03): 85's shape with 600 learned positions, pretrained by
# hiding residues on the lesson's 22,813 training proteins by `protein-adapt-measure.py` part P (`protein-base.pt`,
# regenerated, not committed); the lesson's split (80/10/10, stratified, random_state 42); 1,024 labelled training
# proteins and 1,000 test ones, as `adapting-ha-measure.py` ran them for the mock.
AA = "ACDEFGHIKLMNPQRSTVWY"
PV, LMAX = 25, 600
def protein_ids(seqs):
    ids = [[1] + [AA.index(ch) + 5 if ch in AA else 4 for ch in s][:LMAX - 2] + [2] for s in seqs]   # [CLS] 1, [SEP] 2, [UNK] 4
    L = max(map(len, ids)); X = torch.zeros(len(ids), L, dtype=torch.long); M = torch.zeros(len(ids), L, dtype=torch.long)
    for i, r in enumerate(ids): X[i, :len(r)] = torch.tensor(r); M[i, :len(r)] = 1
    return X, M
def proteins_build():
    torch.manual_seed(0); return A.TinyBERT(PV, D=48, H=4, Fh=96, N=2, Lmax=LMAX)
def proteins_data():
    from sklearn.model_selection import train_test_split
    with open(sys.argv[1], newline="") as fh:
        rows = [(r["seq"].upper(), int(r["label"])) for r in csv.DictReader(fh)]
    tr, vt = train_test_split(rows, test_size=0.2, random_state=42, stratify=[r[1] for r in rows])
    _, te = train_test_split(vt, test_size=0.5, random_state=42, stratify=[r[1] for r in vt])
    test = te[:1000]; ex = []
    for s, y in test:
        if sum(1 for e in ex if e[1] == y) < 2: ex.append([s, y])
        if len(ex) == 4: break
    ex.sort(key=lambda e: -e[1])
    X, Y = zip(*tr[:N]); ids, m = protein_ids(X); tids, tm = protein_ids([s for s, _ in test])
    return {"train": (ids, m, torch.tensor(Y)), "test": (tids, tm, torch.tensor([y for _, y in test])), "ex": protein_ids([s for s, _ in ex]),
            "examples": ex, "rate": sum(y for _, y in test) / len(test), "used": min(LMAX, max(len(s) for s, _ in rows) + 2)}

BUILD = {"notes": notes_build, "proteins": proteins_build}
def score(model, mdl, ids, m, y):
    """the notes in one batch, as 85's first table scored them; the proteins in batches of 100 (577 positions each)"""
    if model == "notes": return CT.score(mdl, ids, m, y)
    with torch.no_grad():
        return sum((mdl.classify(ids[i:i + 100], m[i:i + 100], "cls").argmax(-1) == y[i:i + 100]).sum().item() for i in range(0, len(y), 100)) / len(y)

def matrices(mdl):
    """every matrix as the forward uses it: LoRA's W + s B A"""
    out = {n: p.detach().clone() for n, p in mdl.named_parameters() if n in MATS}
    for i, b in enumerate(mdl.blocks):
        for nm in ("q", "v"):
            lin = getattr(b.att, nm)
            if isinstance(lin, CT.LoRALinear): out[f"blocks.{i}.att.{nm}.weight"] = (lin.W + lin.s * lin.B @ lin.A).detach().clone()
    return out

def run(way, model, D):
    ids, m, y = D["train"]
    mdl = BUILD[model]()
    if way != "scratch": mdl.load_state_dict(BASE[model].state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = way in ("full", "scratch")
    if way == "lora": CT.lora_wrap(mdl, R_, ALPHA)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=LR[way]); g = torch.Generator().manual_seed(0)
    W0 = matrices(mdl); curve, snaps, lora, pred = [], [], [], []
    eid, em = D["ex"]
    def predict():
        mdl.eval()
        with torch.no_grad(): p = mdl.classify(eid, em, "cls").softmax(-1)[:, 1].tolist()
        mdl.train(); pred.append([round(v, 4) for v in p])
    def acc():
        mdl.eval(); a = round(score(model, mdl, *D["test"]), 4); mdl.train(); return a
    def factors(s):
        lin = mdl.blocks[0].att.q
        lora.append({"step": s, "A": [[round(v, 5) for v in r] for r in lin.A.detach().tolist()],
                     "B": [[round(v, 5) for v in r] for r in lin.B.detach().tolist()]})
    mdl.train(); curve.append(acc()); predict()
    if way == "lora": factors(0)
    for s in range(1, STEPS + 1):
        idx = torch.randint(len(y), (16,), generator=g)
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
    scale = fin.max().item()   # the largest change: nothing is clamped, and the blink's "5% of the largest change" is exact
    raw = bytearray()
    for sn in snaps:
        for k in TRAINS[way]:
            raw += signed_bytes(sn[k] / scale)
    if way == "scratch": START[model]["scratch"] = W0
    if way == "transfer": START[model]["base"] = W0
    out = {"curve": curve, "pred": pred, "scale": round(scale, 6), "maps": base64.b64encode(bytes(raw)).decode("ascii"), "mats": TRAINS[way],
           "rel": {k: round((snaps[-1][k].norm() / W0[k].norm()).item(), 4) for k in TRAINS[way]}}
    if way == "lora": out["lora"] = lora
    return out

START = {"notes": {}, "proteins": {}}
def signed_bytes(x):
    """values in [-1, 1] as signed bytes (x 127), two's complement in a byte"""
    q = x.clamp(-1, 1).mul(127).round().to(torch.int16).flatten()
    return bytes(((q + 256) % 256).to(torch.uint8).tolist())

if "--check" in sys.argv:
    js = (here.parent / "adapting" / "table.js").read_text(encoding="utf-8")
    T = json.loads(js[js.index("{"):js.rindex("}") + 1])
    r = run("lora", "notes", notes_data("match"))
    worst = max(abs(a - b) for a, b in zip(r["curve"], T["runs"]["drug-error"]["lora"]["curve"]))
    same = r["maps"] == T["runs"]["drug-error"]["lora"]["maps"]
    log(f"rerun drug-error / lora: curve worst difference {worst:.4f}; maps identical: {same}")
    sys.exit(0 if worst < 1e-3 and same else 1)

BASE["proteins"] = proteins_build(); BASE["proteins"].load_state_dict(torch.load(here / "protein-base.pt")); BASE["proteins"].eval()
head = 48 * 2 + 2
T = {"n": N, "steps": STEPS, "every": EVERY, "snap": SNAP, "lsnap": LSNAP, "r": R_, "alpha": ALPHA, "rates": LR,
     "model": {t: mdl for t, (mdl, _) in TASKS.items()}, "models": {}, "base": {}, "examples": {}, "runs": {}, "mats": list(MATS)}
for model, base in BASE.items():
    backbone = CT.backbone_count(base)
    T["models"][model] = {"shapes": {k: list(v.shape) for k, v in base.named_parameters() if k in MATS},
                          "wq": [[round(v, 5) for v in r] for r in base.blocks[0].att.q.weight.detach().tolist()],
                          "trains": {"scratch": backbone + head, "full": backbone + head, "transfer": head, "lora": 2 * 2 * 2 * 48 * R_ + head, "backbone": backbone}}
PROT = None
for task, (model, key) in TASKS.items():
    D = notes_data(key) if model == "notes" else (PROT := proteins_data())
    T["base"][task] = round(D["rate"], 4); T["examples"][task] = D["examples"]; T["runs"][task] = {}
    T["models"][model]["used"] = max(T["models"][model].get("used", 0), D["used"])
    for way in WAYS:
        r = run(way, model, D); T["runs"][task][way] = r
        log(f"  {task} {way:8s}: {r['curve'][-1]:.1%}, scale {r['scale']:.4f}, maps {len(r['maps']):,} chars  ({time.time()-T0:.0f}s)")

for model in BASE:
    M = T["models"][model]; M["w0"], M["w0scale"] = {}, {}
    for start in ("base", "scratch"):
        W0 = START[model][start]; raw = bytearray(); M["w0scale"][start] = {}
        for k in MATS:
            sc = torch.quantile(W0[k].abs().flatten().float(), 0.99).item() if W0[k].numel() > 1000 else W0[k].abs().max().item()
            M["w0scale"][start][k] = round(sc, 6); raw += signed_bytes(W0[k] / sc)
        M["w0"][start] = base64.b64encode(bytes(raw)).decode("ascii")
out = here.parent / "adapting" / "table.js"
out.write_text("/* GENERATED by widgets/_lab/adapting-table.py; do not edit. Everything widget 85 draws, from torch. */\n"
               f"export const TABLE = {json.dumps(T, separators=(',', ':'))};\n", encoding="utf-8", newline="\n")
log(f"wrote {out} ({out.stat().st_size:,} bytes)  ({time.time()-T0:.0f}s)")
