"""Slot 85, round 4 planning, 2026-10-01. Kenneth: "let's review the training
examples.. maybe some examples of inputs and the labels"; picked E2, held-out
notes with each way's prediction. Before mocking: what do a few held-out notes'
predictions do over training?

Four held-out notes a task, NOT chosen by outcome: the first two of each label
in the held-out set (make_task(999, 1000, task)) that fit a line (60
characters). For each way, P(label 1) for each note at steps 0, 50 ... 400 of
the widget's own runs (seed 0, 1,024 notes, the arc's rates).

Writes `_lab/adapting-examples-measure.json` for the mock.
"""
import json
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
src = (here / "adapting-table.py").read_text(encoding="utf-8").split('if "--check" in sys.argv:')[0]
G = {"__file__": str(here / "adapting-table.py"), "__name__": "tab"}; exec(compile(src, "adapting-table.py", "exec"), G)
A, CT = G["A"], G["CT"]

def pick(task):
    X, Y = A.make_task(999, 1000, task); got = []
    for x, y in zip(X, Y):
        if len(" ".join(x)) <= 60 and sum(1 for g in got if g[1] == y) < 2: got.append([" ".join(x), y])
        if len(got) == 4: break
    return got

def run(way, task, notes):
    X, Y = A.make_task(100, 1024, task)
    torch.manual_seed(0); mdl = A.TinyBERT(A.V)
    if way != "scratch": mdl.load_state_dict(G["base"].state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = way in ("full", "scratch")
    if way == "lora": CT.lora_wrap(mdl, 8, 32)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=G["LR"][way]); g = torch.Generator().manual_seed(0)
    ids, m = A.batchify(X); y = torch.tensor(Y)
    nid, nm = A.batchify([n.split() for n, _ in notes])
    def probs():
        mdl.eval()
        with torch.no_grad(): p = mdl.classify(nid, nm, "cls").softmax(-1)[:, 1].tolist()
        mdl.train(); return [round(v, 3) for v in p]
    out = [probs()]; mdl.train()
    for s in range(1, 401):
        idx = torch.randint(len(X), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if s % 50 == 0: out.append(probs())
    return out

R = {}
for task in ("outcome", "match"):
    notes = pick(task); R[task] = {"notes": notes, "ways": {}}
    print(f"\n{task}:")
    for n, y in notes: print(f"   [{y}] {n}")
    for way in ("scratch", "transfer", "full", "lora"):
        P = run(way, task, notes); R[task]["ways"][way] = P
        right = lambda row: "".join("R" if (p > 0.5) == (y == 1) else "-" for p, (_, y) in zip(row, notes))
        print(f"   {way:8s} right/wrong at 0,50..400: " + " ".join(right(r) for r in P) + "   final P(1): " + " ".join(f"{p:.2f}" for p in P[-1]))
(here / "adapting-examples-measure.json").write_text(json.dumps(R), encoding="utf-8")
