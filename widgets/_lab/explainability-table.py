"""Generates `widgets/explainability/table.js`, everything widget 87 draws, computed
ahead in torch: the widget runs no model and takes no gradient in the browser (as
85's table). Run it again after any change to 85's models (`adapting-table.py`),
the grammar or the HA split, then `node widgets/_lab/explainability-verify.mjs`.

THE MODELS are 85's, rebuilt by `explainability-measure.py` (which executes
`adapting-table.py` up to its main block): each one's held-out accuracy is checked
against 85's own table here, so the widget explains exactly the model 85 trained.
THE EXAMPLES are 85's four held-out rows a task (his pick 2026-10-04: one note
followed across both widgets).

For every task (3), way (4) and example (4), with the target the predicted
class's logit, as 08-2 cell 72 and 08-3 cell 85 run it:

  logits    the two logits; the prediction is their larger.
  att       ATTENTION, each block's four heads. Notes: the whole L x L matrix of
            each head (L <= 14), rounded. Proteins (L up to 577): each head's
            [CLS] row as unsigned bytes on the row's own largest weight, and the
            matrix pooled into bins of 8 positions (a bin's rows averaged, its
            columns summed, so a pooled row still sums to 1), as bytes on the
            pooled matrix's own largest.
  ig        INTEGRATED GRADIENTS at 5 . 20 . 50 . 300 steps: the lesson's Layer
            Integrated Gradients on the token embedding, baseline input ids 0 =
            [PAD] at every position ([CLS] and [SEP] included, captum's default;
            picked with a caption), positions kept, right Riemann sum. `attr` the
            final attributions, `fx` f(input), `fb` f(baseline), `delta` sum(attr)
            - (fx - fb). `part` the running sum after each of min(steps, 50)
            checkpoints, so the widget can grow the bars a step at a time: rounded
            for the notes; signed bytes on `pscale` for the proteins.
  path      the target logit at 51 points from alpha 0 (baseline) to 1 (input).
  occ       OCCLUSION, the windows over words or residues ONLY (his pick: never
            [CLS] or [SEP], captioned), stride k // 2 (08-3 cell 85), replaced by
            [MASK] with the attention mask left at 1 (2026-10-05, his: the updated
            08-3 occludes with <mask>; both our models were pretrained with [MASK],
            id 3, so the occluding token is one they have seen; the notes too, one
            rule on the page; [PAD] and [MASK] maps correlated 0.66 on proteins): `d` the target logit's drop
            f(x) - f(x occluded) for each window, in order from position 1. The
            widget averages the windows covering a position, as captum does.
            Notes k 1 . 2, proteins k 4 . 8 . 12.

Run:  python widgets/_lab/explainability-table.py <influenza_ha.csv>   (about 10 min;
      the lesson's CSV, not in the repository)
"""
import base64, importlib.util, json, math, sys, time
from pathlib import Path
import torch

here = Path(__file__).parent
csv_path = next(a for a in sys.argv[1:] if a.endswith(".csv"))
sys.argv = [sys.argv[0], csv_path, "lib"]
spec = importlib.util.spec_from_file_location("xm", here / "explainability-measure.py")
X = importlib.util.module_from_spec(spec); spec.loader.exec_module(X)
G, fwd, occlusion, log = X.G, X.fwd, X.occlusion, X.log
T0 = time.time()

STEPS = (5, 20, 50, 300)
WINDOWS = {"notes": (1, 2), "proteins": (4, 8, 12)}
CHECKS, BIN = 50, 8
r4 = lambda t: [round(v, 4) for v in t.tolist()]
def u8(x, scale):
    q = (x / max(scale, 1e-12)).clamp(0, 1).mul(255).round().to(torch.uint8).flatten()
    return base64.b64encode(bytes(q.tolist())).decode("ascii")
def i8(x, scale):
    q = (x / max(scale, 1e-12)).clamp(-1, 1).mul(127).round().to(torch.int16).flatten()
    return base64.b64encode(bytes(((q + 256) % 256).to(torch.uint8).tolist())).decode("ascii")

def ig_steps(mdl, ids, m, target, steps):
    """the lesson's LIG, step by step: returns attr [L], delta, fx, fb, and the running sums at the checkpoints"""
    L = ids.shape[1]; P = torch.arange(L)[None]
    posx = mdl.pos(P).detach(); tokx = mdl.tok(ids).detach(); tokb = mdl.tok(torch.zeros_like(ids)).detach()
    parts = []
    for c in range(0, steps, 100):
        al = torch.arange(c + 1, min(steps, c + 100) + 1, dtype=torch.float32)[:, None, None] / steps
        e = (tokb + al * (tokx - tokb)).requires_grad_(True); n = e.shape[0]
        out = fwd(mdl, ids.expand(n, -1), m.expand(n, -1), x=e + posx)[:, target].sum()
        gr, = torch.autograd.grad(out, e)
        parts.append(((tokx - tokb) * gr / steps).sum(-1).detach())
    cum = torch.cat(parts).cumsum(0)
    attr = cum[-1]
    with torch.no_grad():
        fx = fwd(mdl, ids, m)[0, target].item(); fb = fwd(mdl, ids, m, x=tokb + posx)[0, target].item()
    C = min(steps, CHECKS)
    idx = [round(steps * (j + 1) / C) - 1 for j in range(C)]
    return attr, attr.sum().item() - (fx - fb), fx, fb, cum[idx]

def path(mdl, ids, m, target, n=51):
    P = torch.arange(ids.shape[1])[None]; posx = mdl.pos(P); tokx = mdl.tok(ids); tokb = mdl.tok(torch.zeros_like(ids))
    al = torch.linspace(0, 1, n)[:, None, None]
    with torch.no_grad(): return r4(fwd(mdl, ids.expand(n, -1), m.expand(n, -1), x=tokb + al * (tokx - tokb) + posx)[:, target])

def pooled(A):
    """an L x L attention matrix pooled into bins of BIN positions: a bin's rows averaged, its columns summed"""
    L = A.shape[0]; nb = math.ceil(L / BIN); Z = torch.zeros(nb * BIN, nb * BIN); Z[:L, :L] = A
    cols = Z.view(nb * BIN, nb, BIN).sum(-1)                      # [rows, nb]
    cnt = torch.tensor([min(BIN, L - i * BIN) for i in range(nb)], dtype=torch.float32)
    return cols.view(nb, BIN, nb).sum(1) / cnt[:, None]

def one(model, mdl, ids, m):
    L = int(m.sum()); ids, m = ids[:, :L], m[:, :L]; prot = model == "proteins"
    with torch.no_grad(): lg = fwd(mdl, ids, m)[0]
    pred = int(lg.argmax()); e = {"logits": r4(lg), "pred": pred, "ig": {}, "occ": {}}
    for s in STEPS:
        a, d, fx, fb, part = ig_steps(mdl, ids, m, pred, s)
        g = {"attr": r4(a), "delta": round(d, 5), "fx": round(fx, 4), "fb": round(fb, 4)}
        if prot:
            sc = part.abs().max().item(); g["pscale"] = round(sc, 6); g["part"] = i8(part, sc)
        else: g["part"] = [r4(p) for p in part]
        e["ig"][str(s)] = g
    e["path"] = path(mdl, ids, m, pred)
    with torch.no_grad(): fwd(mdl, ids, m)
    if prot:
        rows, mats, mscale = [], [], []
        for b in mdl.blocks:
            for h in range(b.att.last.shape[1]):
                A = b.att.last[0, h]; row = A[0]; rows.append(u8(row, row.max().item()))
                Pm = pooled(A); mscale.append(round(Pm.max().item(), 6)); mats.append(u8(Pm, Pm.max().item()))
        e["att"] = {"cls": rows, "clsScale": [round(b.att.last[0, h, 0].max().item(), 6) for b in mdl.blocks for h in range(b.att.last.shape[1])],
                    "pooled": mats, "pooledScale": mscale, "bins": math.ceil(L / BIN)}
    else:
        e["att"] = [[r4(b.att.last[0, h].flatten()) for h in range(b.att.last.shape[1])] for b in mdl.blocks]
    for k in WINDOWS[model]:
        _, d = occlusion(mdl, ids, m, pred, k, X.MASK, True)
        e["occ"][str(k)] = r4(d)
    with torch.no_grad(): e["occ"]["f0"] = round(fwd(mdl, ids, m)[0, pred].item(), 4)
    return e

T = {"steps": list(STEPS), "checks": CHECKS, "bin": BIN, "windows": {k: list(v) for k, v in WINDOWS.items()}, "occBase": "[MASK]",
     "model": {}, "examples": {}, "acc": {}, "rows": {}}
for task, (model, key) in G["TASKS"].items():
    if model == "proteins":
        G["EVERY"] = 10 ** 9   # 85's curve is its own table's business; skipping it leaves the model unchanged (no randomness)
        G["BASE"]["proteins"] = G["proteins_build"](); G["BASE"]["proteins"].load_state_dict(torch.load(here / "protein-base.pt")); G["BASE"]["proteins"].eval()
        D = G["proteins_data"]()
    else: D = G["notes_data"](key)
    eid, em = D["ex"]
    T["model"][task] = model; T["examples"][task] = [[s, y] for s, y in D["examples"]]; T["acc"][task] = {}; T["rows"][task] = {}
    for way in G["WAYS"]:
        mdl, acc = X.train(task, model, key, way, D)
        T["acc"][task][way] = round(acc, 4)
        T["rows"][task][way] = [one(model, mdl, eid[i:i + 1], em[i:i + 1]) for i in range(4)]
        log(f"    explained 4 rows  ({time.time()-T0:.0f}s)")

out = here.parent / "explainability" / "table.js"
out.parent.mkdir(exist_ok=True)
out.write_text("/* GENERATED by widgets/_lab/explainability-table.py; do not edit. Everything widget 87 draws, from torch. */\n"
               f"export const TABLE = {json.dumps(T, separators=(',', ':'))};\n", encoding="utf-8", newline="\n")
log(f"wrote {out} ({out.stat().st_size:,} bytes)  ({time.time()-T0:.0f}s)")
