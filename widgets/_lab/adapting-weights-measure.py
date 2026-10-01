"""Slot 85 REPLAN measurement, 2026-10-01. Kenneth: "we covered pretraining in
the previous widget ... focus on training from scratch and adapting to show
the changes ... separately, perhaps animated ... the weights. LoRA will be
shown in detail."

What a page that ANIMATES THE WEIGHTS can honestly show, on 84's base, [CLS]
pooling, the arc's rates, seed 0:

  W1  per matrix, how far training moves it: ||W_t - W_0|| / ||W_0|| every 50
      steps, for scratch, transfer, full and LoRA (LoRA: the effective
      W + (alpha/r) B A). Is a change visible at all on a picture of W?
  W2  where full fine-tuning's change goes (which matrices move most), and
      whether its change to a 48 x 48 projection is close to low rank
      (the share of ||dW||^2 in the top 8 singular values), the premise of
      LoRA.
  W3  LoRA in detail: B starts at zero, so dW = 0 at step 0; how dW grows;
      its rank (8 by construction); A and B's sizes.
  W4  the [CLS] vectors of held-out notes: how far each way moves them
      (transfer 0 by construction).

Writes `_lab/adapting-weights-measure.json` (snapshots for the mock).
Run:  python widgets/_lab/adapting-weights-measure.py    (about 1 min)
"""
import importlib.util, json, time
from pathlib import Path
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A, AM = CT.A, CT.AM
T0 = time.time()
def log(*a): print(*a, flush=True)
LR = CT.LRS["arc"]

base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, CT.corpus, 3000, 0); base.eval()

def eff(mdl):
    """every matrix as the forward uses it: LoRA's W + s B A"""
    out = {}
    for n, p in mdl.named_parameters():
        if n.startswith("mlm") or ".A" in n or ".B" in n or n.endswith(".b"): continue
        if n.endswith(".W"): continue
        out[n] = p.detach().clone()
    for i, b in enumerate(mdl.blocks):
        for nm in ("q", "v"):
            lin = getattr(b.att, nm)
            if isinstance(lin, CT.LoRALinear):
                out[f"blocks.{i}.att.{nm}.weight"] = (lin.W + lin.s * lin.B @ lin.A).detach().clone()
                out[f"blocks.{i}.att.{nm}.bias"] = lin.b.detach().clone()
    return out

def train(strat, task, n, every=50):
    test, rate = CT.score, None
    Xt, Yt = A.make_task(999, 1000, task); ids_t, m_t = A.batchify(Xt); tst = (ids_t, m_t, torch.tensor(Yt))
    X, Y = A.make_task(100, n, task)
    torch.manual_seed(0)
    mdl = A.TinyBERT(A.V)
    if strat != "scratch": mdl.load_state_dict(base.state_dict())
    mdl.head.reset_parameters()
    for p in mdl.parameters(): p.requires_grad = strat in ("full", "scratch")
    if strat == "lora": CT.lora_wrap(mdl, 8, 32)
    for p in mdl.mlm.parameters(): p.requires_grad = False
    for p in mdl.head.parameters(): p.requires_grad = True
    params = [p for p in mdl.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=LR[strat]); g = torch.Generator().manual_seed(0)
    ids, m = A.batchify(X); y = torch.tensor(Y)
    W0 = eff(mdl); snaps = []; hist = []
    mdl.eval(); Z0 = CT.cls_vec(mdl, Xt[:300]) if strat != "scratch" else None; mdl.train()
    lora0 = None
    def snap(s):
        Wt = eff(mdl)
        rel = {k: round(((Wt[k] - W0[k]).norm() / W0[k].norm().clamp(min=1e-9)).item(), 5) for k in W0 if Wt[k].dim() == 2}
        mx = {k: round((Wt[k] - W0[k]).abs().max().item(), 5) for k in W0 if Wt[k].dim() == 2}
        mdl.eval(); acc = CT.score(mdl, *tst); mdl.train()
        snaps.append({"step": s, "acc": round(acc, 4), "rel": rel, "max": mx})
        hist.append({k: (Wt[k] - W0[k]) for k in W0 if Wt[k].dim() == 2})
    lora_snaps = []
    if strat == "lora":
        lin = mdl.blocks[0].att.q; lora_snaps.append({"step": 0, "A": lin.A.detach().tolist(), "B": lin.B.detach().tolist()})
    mdl.train(); snap(0)
    for s in range(1, 401):
        idx = torch.randint(len(X), (16,), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], "cls"), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if s % every == 0: snap(s)
        if strat == "lora" and s % 25 == 0:
            lin = mdl.blocks[0].att.q; lora_snaps.append({"step": s, "A": [[round(v, 5) for v in r] for r in lin.A.detach().tolist()], "B": [[round(v, 5) for v in r] for r in lin.B.detach().tolist()]})
    mdl.eval()
    W1 = eff(mdl)
    out = {"snaps": snaps}
    # W5: does the PATTERN of change keep its shape? cosine of dW_t with the final dW, per matrix
    fin = hist[-1]
    out["cos"] = {str(snaps[i]["step"]): round(sum(F.cosine_similarity(hist[i][k].flatten(), fin[k].flatten(), dim=0).item()
                  for k in fin if fin[k].norm() > 0) / max(1, sum(1 for k in fin if fin[k].norm() > 0)), 4) for i in (2, 4, 6)}
    # every 2-D matrix's final change, for the mock's weight map
    out["dW"] = {k: [[round(v, 5) for v in row] for row in fin[k].tolist()] for k in fin}
    if Z0 is not None:
        Z1 = CT.cls_vec(mdl, Xt[:300]); out["cls_move"] = round(((Z1 - Z0).norm(dim=1).mean() / Z0.norm(dim=1).mean()).item(), 4)
    # full: is dW of a projection near low rank?
    for k in ("blocks.0.att.q.weight", "blocks.0.att.v.weight", "blocks.1.att.q.weight", "blocks.1.att.v.weight"):
        d = W1[k] - W0[k]
        if d.norm() > 0:
            sv = torch.linalg.svdvals(d); out.setdefault("top8", {})[k] = round((sv[:8] ** 2).sum().item() / (sv ** 2).sum().item(), 4)
    # matrices for the mock: block 1's Q (W0, dW), the head
    out["mats"] = {"q1_W0": W0["blocks.0.att.q.weight"].tolist(), "q1_dW": (W1["blocks.0.att.q.weight"] - W0["blocks.0.att.q.weight"]).tolist(),
                   "head_W0": W0["head.weight"].tolist(), "head_dW": (W1["head.weight"] - W0["head.weight"]).tolist()}
    if strat == "lora":
        out["lora_snaps"] = lora_snaps
        lin = mdl.blocks[0].att.q
        out["lora"] = {"A": lin.A.detach().tolist(), "B": lin.B.detach().tolist(), "s": lin.s,
                       "dW_norm": round((lin.s * lin.B @ lin.A).norm().item(), 4), "W_norm": round(lin.W.norm().item(), 4)}
    return out

R = {}
for task, n in (("match", 1024), ("outcome", 256)):
    for strat in ("scratch", "transfer", "full", "lora"):
        r = train(strat, task, n); R[f"{task}/{n}/{strat}"] = r
        last = r["snaps"][-1]
        top = sorted(last["rel"].items(), key=lambda kv: -kv[1])[:5]
        log(f"{task} {n} {strat:8s} acc {last['acc']:.0%}  cls moves {r.get('cls_move', '-')}  "
            f"largest relative change: " + ", ".join(f"{k.replace('.weight','')} {v:.3f}" for k, v in top)
            + (f"  | dW top-8 share {r['top8']}" if "top8" in r else "") + f"  | cos(dW_t, dW_400) {r['cos']}  ({time.time()-T0:.0f}s)")
        rel = last["rel"]
        groups = {"embeddings": [k for k in rel if k.startswith(("tok", "pos"))], "attention": [k for k in rel if ".att." in k],
                  "feed forward": [k for k in rel if ".ff." in k], "head": ["head.weight"]}
        log("      by part: " + "  ".join(f"{g} {sum(rel[k] for k in ks)/len(ks):.4f}" for g, ks in groups.items()))
(here / "adapting-weights-measure.json").write_text(json.dumps(R), encoding="utf-8")
log(f"done ({time.time()-T0:.0f}s)")
