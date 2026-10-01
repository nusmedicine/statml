"""Slot 85, round 1 of the rebuild, 2026-10-01. Kenneth: "the color fade in? i
thought the weights would be there then change with training? would blue-red
be more contrastive?"

Two readings of one run, measured before mocking:
  WEIGHTS  W_t itself, signed, on the blue-red value ramp (--c-value-low/high),
           one scale a matrix kind (the 99th percentile of |W_0|).
  CHANGE   W_t - W_0, signed, on the same ramp.
For each way (Wrong drug, 1,024 notes, seed 0, the arc's rates): the share of
weights whose colour on the WEIGHTS reading moves by more than a tenth of the
ramp's half-range between step 0 and step 400 -- how much of the training a
reader can see without the change drawn.

Writes `_lab/adapting-colour-measure.json` (each way's matrices at steps 0, 200
and 400, 4 decimals) for `_lab/adapting-colour-mock.html`.
"""
import importlib.util, json, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("tab", here / "adapting-table.py")
# adapting-table.py runs its build at import; take what it defines without its main block
src = (here / "adapting-table.py").read_text(encoding="utf-8").split('if "--check" in sys.argv:')[0]
G = {"__file__": str(here / "adapting-table.py"), "__name__": "tab"}; exec(compile(src, "adapting-table.py", "exec"), G)
A, CT, MATS, TRAINS = G["A"], G["CT"], G["MATS"], G["TRAINS"]
T0 = time.time()

def run(way, task="match"):
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
    ids, m = A.batchify(X); y = torch.tensor(Y); snaps = {0: G["matrices"](mdl)}
    mdl.train()
    for s in range(1, 401):
        idx = torch.randint(len(X), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if s in (200, 400): snaps[s] = G["matrices"](mdl)
    return snaps

out = {}
for way in ("scratch", "transfer", "full", "lora"):
    sn = run(way)
    W0, W1 = sn[0], sn[400]
    seen, tot = 0, 0
    for k in MATS:
        sc = torch.quantile(W0[k].abs().flatten().float(), 0.99).item() if W0[k].numel() > 200 else W0[k].abs().max().item()
        moved = ((W1[k] - W0[k]).abs() / sc > 0.1)
        seen += moved.sum().item(); tot += moved.numel()
    print(f"{way:8s}: on the WEIGHTS reading, {seen / tot:.1%} of all weights move a tenth of the ramp or more ({time.time()-T0:.0f}s)", flush=True)
    out[way] = {str(s): {k: [[round(v, 4) for v in r] for r in M[k].tolist()] for k in MATS} for s, M in sn.items()}
    out[way]["seen"] = round(seen / tot, 4)
(here / "adapting-colour-measure.json").write_text(json.dumps(out), encoding="utf-8")
print("done")
