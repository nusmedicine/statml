"""Planning measurement for slot 87, EXPLAINABILITY (PHM5005 08-1 cell 20, 08-2
cells 66-76, 08-3 cells 79-89), 2026-10-04. Picked 2026-10-02 as ONE widget,
"Deep Learning - Language: Explainability", pages Attention . Integrated
gradients . Occlusion, explaining 85's OWN adapted models as the lessons do
(08-2's LIG on the clinical transfer model, 08-3's occlusion on the adapted
ESM-2). Every claim a page would make is measured here first.

The models are 85's, rebuilt by executing `adapting-table.py` up to its main
block: the same base, data, seeds and 400 steps, so each final model is the
one 85's last snapshot shows (checked: its held-out accuracy against the
table's last curve point).

  I  INTEGRATED GRADIENTS as 08-2 cell 72 runs it: LayerIntegratedGradients
     on the token embedding, baseline input_ids 0 = [PAD] at every position
     (captum's default), positions kept, target = the predicted class's
     logit. Completeness |sum(attr) - (f(x) - f(baseline))| at 5 . 20 . 50 .
     300 steps; how often a token pushes AGAINST the prediction (negative,
     at least 10% of the largest |attr|), which the lesson's clip shows as 0.
  W  WHICH TOKENS carry the attribution, by kind (drug, symptom, "with",
     "no", [CLS]/[SEP], "."), per task and way: on Drug error, the share on
     the treatment clause's drug and symptom.
  T  ATTENTION against attribution: the [CLS] row of each block, mean of the
     heads (what an attention heatmap shows), against |IG|: Spearman and
     top-1 agreement over the words; the share of attention on [CLS], [SEP]
     and ".".
  O  OCCLUSION as 08-3 cell 85 runs it: a window k, stride k // 2, replaced
     by [PAD] with the attention mask left at 1, |f(x) - f(x_occ)| on the
     target logit, each position the mean over the windows covering it.
     Proteins at k 4 . 8 . 12 (the lesson's "try 4, 8, 12") and notes at
     k 1; against |IG|; the baseline [PAD] against [MASK] and [UNK].

Run:  python widgets/_lab/explainability-measure.py <influenza_ha.csv> [notes] [proteins]
Writes `_lab/explainability-measure.json`.
"""
import json, math, sys, time
from pathlib import Path
import torch

here = Path(__file__).parent
argv = sys.argv[1:]
parts = [a for a in argv if a in ("notes", "baseline", "words", "proteins", "export", "inner")] or ["notes", "baseline", "proteins"]
csv_path = next(a for a in argv if a.endswith(".csv"))
sys.argv = [sys.argv[0], csv_path]

# ---- 85's machinery, up to its main block; run() keeps its model
src = (here / "adapting-table.py").read_text(encoding="utf-8")
src = src[: src.index('if "--check" in sys.argv:')]
src = src.replace('    if way == "lora": out["lora"] = lora\n    return out',
                  '    if way == "lora": out["lora"] = lora\n    out["mdl"] = mdl\n    return out')
G = {"__file__": str(here / "adapting-table.py"), "__name__": "adapting_table"}
exec(compile(src, "adapting-table.py", "exec"), G)
A, log, T0 = G["A"], G["log"], time.time()
js = (here.parent / "adapting" / "table.js").read_text(encoding="utf-8")
TABLE = json.loads(js[js.index("{"):js.rindex("}") + 1])
torch.set_num_threads(8)
OUT = {}
PAD, CLS, SEP, MASK, UNK = 0, 1, 2, 3, 4

def fwd(mdl, ids, m, x=None):
    return mdl.classify(ids, m, "cls", x=x)

def ig(mdl, ids, m, target, steps, base_ids=None):
    """one row (ids [1, L]); returns attr [L], delta. The baseline is captum's default, input_ids 0 = [PAD] at
    every position, [CLS] and [SEP] included, unless base_ids is given"""
    P = torch.arange(ids.shape[1])[None]
    posx = mdl.pos(P).detach()
    tokx = mdl.tok(ids).detach(); tokb = mdl.tok(torch.zeros_like(ids) if base_ids is None else base_ids).detach()
    tot = torch.zeros_like(tokx)
    for c in range(0, steps, 100):
        al = torch.arange(c + 1, min(steps, c + 100) + 1, dtype=torch.float32)[:, None, None] / steps
        e = (tokb + al * (tokx - tokb)).requires_grad_(True)
        n = e.shape[0]
        out = fwd(mdl, ids.expand(n, -1), m.expand(n, -1), x=e + posx)[:, target].sum()
        gr, = torch.autograd.grad(out, e); tot += gr.sum(0, keepdim=True)
    attr = ((tokx - tokb) * tot / steps).sum(-1)[0]
    with torch.no_grad():
        fx = fwd(mdl, ids, m)[0, target]; fb = fwd(mdl, ids, m, x=tokb + posx)[0, target]
    return attr.detach(), (attr.sum() - (fx - fb)).item()

def occlusion(mdl, ids, m, target, k, base=PAD, inner=False):
    """inner: the windows cover the residues or words only, [CLS] and [SEP] left in place (captum's Occlusion, as
    08-3 cell 85 calls it, slides over every position, the first window covering [CLS])"""
    L = int(m.sum()); stride = max(1, k // 2)
    starts = list(range(1, L - 1 - k + 1, stride)) if inner else list(range(0, L - k + 1, stride))
    if not starts: starts = [0]
    X = ids.repeat(len(starts), 1)
    for i, s in enumerate(starts): X[i, s:s + k] = base
    with torch.no_grad():
        f0 = fwd(mdl, ids, m)[0, target]
        fo = torch.cat([fwd(mdl, X[i:i + 64], m.expand(len(X[i:i + 64]), -1))[:, target] for i in range(0, len(X), 64)])
    d = (f0 - fo)
    tot = torch.zeros(ids.shape[1]); cnt = torch.zeros(ids.shape[1])
    for s, v in zip(starts, d): tot[s:s + k] += v; cnt[s:s + k] += 1
    return torch.where(cnt > 0, tot / cnt.clamp(min=1), torch.zeros(1)), d   # signed; the lesson takes abs

def attention_cls(mdl, ids, m):
    with torch.no_grad(): fwd(mdl, ids, m)
    return [b.att.last[0, :, 0, :].mean(0) for b in mdl.blocks]   # the [CLS] row, mean of heads, per block

def rank(v):
    r = torch.empty_like(v); r[v.argsort()] = torch.arange(len(v), dtype=v.dtype); return r
def spearman(a, b):
    ra, rb = rank(a.float()), rank(b.float()); ra -= ra.mean(); rb -= rb.mean()
    return (ra @ rb / (ra.norm() * rb.norm() + 1e-12)).item()
def med(v):
    v = sorted(v); return v[len(v) // 2] if v else float("nan")
def q(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(p * len(v)))] if v else float("nan")

SYMW = set(w for s in A.SYMS for w in s.split()); DRUGS = set(A.DRUGS)
def kind(w):
    if w in DRUGS: return "drug"
    if w in SYMW: return "symptom"
    if w in ("with", "no", ".", "[CLS]", "[SEP]"): return w
    return "other"

def train(task, model, key, way, D):
    r = G["run"](way, model, D); mdl = r.pop("mdl"); mdl.eval()
    acc = G["score"](model, mdl, *D["test"])
    want = TABLE["runs"][task][way]["curve"][-1]
    log(f"  {task} {way:8s}: held-out {acc:.1%} (85's table {want:.1%}){'' if abs(acc - want) < 2e-3 else '  <-- DIFFERS'}  ({time.time()-T0:.0f}s)")
    return mdl, acc

def explain_rows(task, way, mdl, rows, words, steps_list, ks, bases=(PAD,)):
    """rows: list of (ids [1,L], m [1,L], y); words: list of token strings per row (or None)"""
    R = {"delta": {s: [] for s in steps_list}, "against": 0, "against_rows": [], "n": 0, "correct": 0,
         "att_sp": [[], []], "att_top1": [0, 0], "att_special": [[], []], "occ_sp": {k: [] for k in ks},
         "occ_base_sp": {b: [] for b in bases[1:]}, "kinds": {}, "kinds_att": {}, "pair_share": [], "ig_vs_diff": []}
    for i, (ids, m, y) in enumerate(rows):
        L = int(m.sum()); ids, m = ids[:, :L], m[:, :L]
        with torch.no_grad(): lg = fwd(mdl, ids, m)[0]
        pred = int(lg.argmax()); R["n"] += 1; R["correct"] += pred == y
        attr = None
        for s in steps_list:
            a, d = ig(mdl, ids, m, pred, s); R["delta"][s].append(abs(d))
            if s == 50: attr = a
        mx = attr.abs().max().item()
        neg = [(j, attr[j].item()) for j in range(L) if attr[j] < -0.1 * mx]
        if neg:
            R["against"] += 1
            if words and len(R["against_rows"]) < 6:
                R["against_rows"].append({"pred": pred, "y": y, "toks": [[w, round(attr[j].item(), 3)] for j, w in enumerate(words[i])]})
        # attention
        att = attention_cls(mdl, ids, m)
        inner = slice(1, L - 1)   # the words, without [CLS] and [SEP]
        for b in range(len(att)):
            R["att_sp"][b].append(spearman(att[b][inner], attr[inner].abs()))
            R["att_top1"][b] += int(att[b][inner].argmax() == attr[inner].abs().argmax())
            sp = att[b][0] + att[b][L - 1]
            if words: sp = sp + sum(att[b][j] for j, w in enumerate(words[i]) if w == ".")
            R["att_special"][b].append(sp.item())
        # occlusion
        for k in ks:
            o, _ = occlusion(mdl, ids, m, pred, k)
            R["occ_sp"][k].append(spearman(o.abs()[:L][inner], attr[inner].abs()))
        for b in bases[1:]:
            o0, _ = occlusion(mdl, ids, m, pred, ks[0], PAD); ob, _ = occlusion(mdl, ids, m, pred, ks[0], b)
            R["occ_base_sp"][b].append(spearman(o0.abs()[:L][inner], ob.abs()[:L][inner]))
        # the logit of the predicted class against the decision (the difference of the two logits)
        if len(steps_list):
            ad, _ = ig_diff(mdl, ids, m, pred)
            R["ig_vs_diff"].append(spearman(attr[inner], ad[inner]))
        if words:
            w = words[i]; tot = attr.abs().sum().item() + 1e-12
            top = w[int(attr.abs().argmax())]; R["kinds"][kind(top)] = R["kinds"].get(kind(top), 0) + 1
            topa = w[int(att[-1].argmax())]; R["kinds_att"][kind(topa)] = R["kinds_att"].get(kind(topa), 0) + 1
            if task == "drug-error":
                # the treatment clause: "treated|managed with <drug> for <symptom words>"
                j = next(j for j, x in enumerate(w) if x in ("treated", "managed"))
                e = j + 4; sym = []
                while e < len(w) and w[e] in SYMW: sym.append(e); e += 1
                R["pair_share"].append((attr[j + 2].abs().item() + sum(attr[s].abs().item() for s in sym)) / tot)
    return R

def ig_diff(mdl, ids, m, pred, steps=50):
    """IG of logit[pred] - logit[other]"""
    P = torch.arange(ids.shape[1])[None]; posx = mdl.pos(P).detach()
    tokx = mdl.tok(ids).detach(); tokb = mdl.tok(torch.zeros_like(ids)).detach()
    al = torch.arange(1, steps + 1, dtype=torch.float32)[:, None, None] / steps
    e = (tokb + al * (tokx - tokb)).requires_grad_(True)
    out = fwd(mdl, ids.expand(steps, -1), m.expand(steps, -1), x=e + posx)
    out = (out[:, pred] - out[:, 1 - pred]).sum()
    gr, = torch.autograd.grad(out, e)
    return ((tokx - tokb) * gr.sum(0, keepdim=True) / steps).sum(-1)[0].detach(), None

def summarise(task, way, acc, R):
    s = {"acc": round(acc, 4), "n": R["n"], "correct": R["correct"],
         "delta_median": {st: round(med(v), 4) for st, v in R["delta"].items()},
         "delta_p90": {st: round(q(v, 0.9), 4) for st, v in R["delta"].items()},
         "against": R["against"], "against_rows": R["against_rows"],
         "att_spearman_median": [round(med(v), 3) for v in R["att_sp"]],
         "att_top1": [round(t / R["n"], 3) for t in R["att_top1"]],
         "att_special_median": [round(med(v), 3) for v in R["att_special"]],
         "occ_spearman_median": {k: round(med(v), 3) for k, v in R["occ_sp"].items()},
         "occ_base_spearman_median": {b: round(med(v), 3) for b, v in R["occ_base_sp"].items()},
         "ig_vs_diff_median": round(med(R["ig_vs_diff"]), 3),
         "top_kind_ig": R["kinds"], "top_kind_att": R["kinds_att"]}
    if R["pair_share"]: s["pair_share_median"] = round(med(R["pair_share"]), 3)
    log(f"   {task} {way}: n {R['n']} right {R['correct']}; delta median {s['delta_median']}; against {R['against']}/{R['n']}; "
        f"att~|IG| spearman {s['att_spearman_median']} top1 {s['att_top1']} special-share {s['att_special_median']}; "
        f"occ~|IG| {s['occ_spearman_median']} baseline {s['occ_base_spearman_median']}; ig(pred) vs ig(diff) {s['ig_vs_diff_median']}")
    if R["kinds"]: log(f"     top token by IG {R['kinds']}  by last-block attention {R['kinds_att']}" + (f"  drug+symptom share {s['pair_share_median']}" if R["pair_share"] else ""))
    for r in R["against_rows"][:2]:
        log("     e.g. pred", r["pred"], "y", r["y"], " ".join(f"{w}:{a:+.2f}" for w, a in r["toks"]))
    return s

if "notes" in parts:
    log("\n== NOTES ==")
    for task in ("outcome", "drug-error"):
        model, key = G["TASKS"][task]; D = G["notes_data"](key)
        tids, tm, ty = D["test"]
        Xt, _ = G["make"](999, 1000, key)
        rows = [(tids[i:i + 1], tm[i:i + 1], int(ty[i])) for i in range(200)]
        words = [["[CLS]"] + Xt[i] + ["[SEP]"] for i in range(200)]
        OUT[task] = {}
        for way in G["WAYS"]:
            mdl, acc = train(task, model, key, way, D)
            R = explain_rows(task, way, mdl, rows, words, (5, 20, 50, 300), (1, 2), (PAD, MASK, UNK))
            OUT[task][way] = summarise(task, way, acc, R)
        (here / "explainability-measure.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")

# B  THE BASELINE: the lesson's all-[PAD] baseline replaces [CLS] too, and the classifier reads the [CLS] row, so
#    [CLS] itself takes the largest attribution in most notes (measured above). Against a baseline that keeps
#    [CLS] and [SEP] and replaces only the words, by [PAD] or by [MASK].
if "baseline" in parts:
    log("\n== B  BASELINES ==")
    OUT = json.loads((here / "explainability-measure.json").read_text(encoding="utf-8"))
    for task in ("outcome", "drug-error"):
        model, key = G["TASKS"][task]; D = G["notes_data"](key)
        tids, tm, ty = D["test"]; Xt, _ = G["make"](999, 1000, key)
        for way in G["WAYS"]:
            mdl, acc = train(task, model, key, way, D); res = {}
            for bname in ("all-pad", "keep-special-pad", "keep-special-mask"):
                kinds, share, deltas, sp = {}, [], [], []
                for i in range(200):
                    L = int(tm[i].sum()); ids, m = tids[i:i + 1, :L], tm[i:i + 1, :L]; w = ["[CLS]"] + Xt[i] + ["[SEP]"]
                    with torch.no_grad(): pred = int(fwd(mdl, ids, m)[0].argmax())
                    b = None
                    if bname != "all-pad":
                        b = torch.full_like(ids, PAD if bname.endswith("pad") else MASK); b[0, 0] = CLS; b[0, L - 1] = SEP
                    a, d = ig(mdl, ids, m, pred, 50, b); deltas.append(abs(d))
                    a0, _ = ig(mdl, ids, m, pred, 50)
                    sp.append(spearman(a[1:L - 1], a0[1:L - 1]))
                    top = w[int(a[1:L - 1].abs().argmax()) + 1]; kinds[kind(top)] = kinds.get(kind(top), 0) + 1
                    if task == "drug-error":
                        j = next(j for j, x in enumerate(w) if x in ("treated", "managed")); e = j + 4; sym = []
                        while e < len(w) and w[e] in SYMW: sym.append(e); e += 1
                        share.append((a[j + 2].abs().item() + sum(a[s].abs().item() for s in sym)) / (a[1:L - 1].abs().sum().item() + 1e-12))
                res[bname] = {"top_word_kind": kinds, "delta_median": round(med(deltas), 4), "words_spearman_vs_allpad": round(med(sp), 3)}
                if share: res[bname]["pair_share_median"] = round(med(share), 3)
                log(f"   {task} {way} {bname:18s}: top WORD {kinds}  delta {med(deltas):.4f}  words vs all-pad {med(sp):.2f}" + (f"  drug+symptom share {med(share):.2f}" if share else ""))
            OUT[task][way]["baselines"] = res
    (here / "explainability-measure.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")

# WORDS  the "other" kind above, opened: the top word by |IG| (baseline keeping [CLS] and [SEP]), as strings, and
#        the top word by the last block's [CLS] attention, for the full model and transfer
if "words" in parts:
    log("\n== WORDS ==")
    for task in ("outcome", "drug-error"):
        model, key = G["TASKS"][task]; D = G["notes_data"](key)
        tids, tm, ty = D["test"]; Xt, _ = G["make"](999, 1000, key)
        for way in ("transfer", "full"):
            mdl, acc = train(task, model, key, way, D); ig_top, att_top = {}, {}
            for i in range(200):
                L = int(tm[i].sum()); ids, m = tids[i:i + 1, :L], tm[i:i + 1, :L]; w = ["[CLS]"] + Xt[i] + ["[SEP]"]
                with torch.no_grad(): pred = int(fwd(mdl, ids, m)[0].argmax())
                b = torch.full_like(ids, PAD); b[0, 0] = CLS; b[0, L - 1] = SEP
                a, _ = ig(mdl, ids, m, pred, 50, b); t = w[int(a[1:L - 1].abs().argmax()) + 1]; ig_top[t] = ig_top.get(t, 0) + 1
                at = attention_cls(mdl, ids, m)[-1]; t = w[int(at[1:L - 1].argmax()) + 1]; att_top[t] = att_top.get(t, 0) + 1
            top = lambda d: sorted(d.items(), key=lambda kv: -kv[1])[:8]
            log(f"   {task} {way}: IG top word {top(ig_top)}\n      attention top word {top(att_top)}")
            OUT.setdefault("words", {})[f"{task}/{way}"] = {"ig": top(ig_top), "attention": top(att_top)}

if "proteins" in parts:
    log("\n== PROTEINS ==")
    G["BASE"]["proteins"] = G["proteins_build"](); G["BASE"]["proteins"].load_state_dict(torch.load(here / "protein-base.pt")); G["BASE"]["proteins"].eval()
    G["EVERY"] = 10 ** 9   # the curve's every-10-step accuracy is 85's table's business; it uses no randomness, so skipping it leaves the model unchanged
    D = G["proteins_data"](); tids, tm, ty = D["test"]
    rows = [(tids[i:i + 1], tm[i:i + 1], int(ty[i])) for i in range(30)]
    OUT = json.loads((here / "explainability-measure.json").read_text(encoding="utf-8")) if (here / "explainability-measure.json").exists() else {}
    OUT["influenza-host"] = {}
    for way in G["WAYS"]:
        mdl, acc = train("influenza-host", "proteins", None, way, D)
        R = explain_rows("influenza-host", way, mdl, rows, None, (20, 50), (4, 8, 12), (PAD, MASK, UNK))
        OUT["influenza-host"][way] = summarise("influenza-host", way, acc, R)
        # where the occlusion peaks fall (k 4), and how concentrated the profile is
        tops, conc = [], []
        for ids, m, y in rows[:30]:
            L = int(m.sum()); ids_, m_ = ids[:, :L], m[:, :L]
            with torch.no_grad(): pred = int(fwd(mdl, ids_, m_)[0].argmax())
            o, d = occlusion(mdl, ids_, m_, pred, 4); a = o.abs()[:L]
            tops.append(sorted(a.argsort(descending=True)[:5].tolist()))
            srt = a.sort(descending=True).values; conc.append((srt[:20].sum() / (srt.sum() + 1e-12)).item())
        OUT["influenza-host"][way]["occ_top5_positions"] = tops[:10]
        OUT["influenza-host"][way]["occ_top20_share_median"] = round(med(conc), 3)
        log(f"     occlusion k4 top-5 positions (first 6 proteins) {tops[:6]}; share of |attr| in the top 20 positions {med(conc):.2f}")
    (here / "explainability-measure.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")
# INNER  occlusion on the proteins with [CLS] and [SEP] left in place: where the top positions fall, against |IG|
if "inner" in parts:
    log("\n== INNER (proteins) ==")
    G["EVERY"] = 10 ** 9
    G["BASE"]["proteins"] = G["proteins_build"](); G["BASE"]["proteins"].load_state_dict(torch.load(here / "protein-base.pt")); G["BASE"]["proteins"].eval()
    D = G["proteins_data"](); tids, tm, ty = D["test"]; res = {}
    for way in ("transfer", "full"):
        mdl, acc = train("influenza-host", "proteins", None, way, D); sp, tops, first = {4: [], 8: [], 12: []}, [], []
        for i in range(20):
            L = int(tm[i].sum()); ids, m = tids[i:i + 1, :L], tm[i:i + 1, :L]
            with torch.no_grad(): pred = int(fwd(mdl, ids, m)[0].argmax())
            a, _ = ig(mdl, ids, m, pred, 50)
            for k in sp:
                o, _ = occlusion(mdl, ids, m, pred, k, PAD, True); sp[k].append(spearman(o[1:L - 1].abs(), a[1:L - 1].abs()))
                if k == 4:
                    tops.append(sorted(o[1:L - 1].abs().argsort(descending=True)[:5].add(1).tolist()))
                    o0, _ = occlusion(mdl, ids, m, pred, 4); first.append((o0[:4].abs().max() / (o0[4:L].abs().max() + 1e-12)).item())
        res[way] = {"spearman_vs_ig": {k: round(med(v), 3) for k, v in sp.items()}, "top5": tops[:8], "cls_window_over_rest_median": round(med(first), 2)}
        log(f"   {way}: inner occlusion vs |IG| {res[way]['spearman_vs_ig']}; top-5 positions {tops[:6]}; the [CLS] window's |attr| over the rest's largest (all windows) {med(first):.1f}x")
    OUT = json.loads((here / "explainability-measure.json").read_text(encoding="utf-8")); OUT["inner"] = res
    (here / "explainability-measure.json").write_text(json.dumps(OUT, indent=1), encoding="utf-8")

# EXPORT  what the mock draws: 85's four held-out examples a task, under every way, every method and setting
if "export" in parts:
    log("\n== EXPORT ==")
    MOCK = {}
    r3 = lambda t: [round(v, 4) for v in t.tolist()]
    def path(mdl, ids, m, target, n=21):
        P = torch.arange(ids.shape[1])[None]; posx = mdl.pos(P); tokx = mdl.tok(ids); tokb = mdl.tok(torch.zeros_like(ids))
        al = torch.linspace(0, 1, n)[:, None, None]
        with torch.no_grad(): return r3(fwd(mdl, ids.expand(n, -1), m.expand(n, -1), x=tokb + al * (tokx - tokb) + posx)[:, target])
    def one(mdl, ids, m, words, steps_list, ks, prot=False):
        L = int(m.sum()); ids, m = ids[:, :L], m[:, :L]
        with torch.no_grad(): lg = fwd(mdl, ids, m)[0]
        pred = int(lg.argmax()); e = {"logits": r3(lg), "pred": pred, "ig": {}, "occ": {}}
        if words: e["tokens"] = words
        for s in steps_list:
            a, d = ig(mdl, ids, m, pred, s); e["ig"][str(s)] = {"attr": r3(a), "delta": round(d, 4)}
        b = torch.full_like(ids, PAD); b[0, 0] = CLS; b[0, L - 1] = SEP
        a, d = ig(mdl, ids, m, pred, 50, b); e["ig"]["50-keep"] = {"attr": r3(a), "delta": round(d, 4)}
        e["path"] = path(mdl, ids, m, pred)
        with torch.no_grad(): fwd(mdl, ids, m)
        e["att"] = [[r3(b.att.last[0, h, 0, :]) for h in range(b.att.last.shape[1])] for b in mdl.blocks]   # [block][head] the [CLS] row
        for k in ks:
            o, _ = occlusion(mdl, ids, m, pred, k); e["occ"][str(k)] = r3(o[:L])
        if prot:
            o, _ = occlusion(mdl, ids, m, pred, 4, MASK); e["occ"]["4-mask"] = r3(o[:L])
            for k in ks:
                o, _ = occlusion(mdl, ids, m, pred, k, PAD, True); e["occ"][f"{k}-inner"] = r3(o[:L])
        return e
    if True:   # the notes, always
        for task in ("outcome", "drug-error"):
            model, key = G["TASKS"][task]; D = G["notes_data"](key); eid, em = D["ex"]
            MOCK[task] = {"examples": D["examples"], "ways": {}}
            for way in G["WAYS"]:
                mdl, acc = train(task, model, key, way, D)
                MOCK[task]["ways"][way] = {"acc": round(acc, 4), "rows": [one(mdl, eid[i:i + 1], em[i:i + 1], ["[CLS]"] + D["examples"][i][0].split() + ["[SEP]"], (5, 20, 50, 300), (1, 2)) for i in range(4)]}
    if "proteins-export" in argv:
        G["EVERY"] = 10 ** 9
        G["BASE"]["proteins"] = G["proteins_build"](); G["BASE"]["proteins"].load_state_dict(torch.load(here / "protein-base.pt")); G["BASE"]["proteins"].eval()
        D = G["proteins_data"](); eid, em = D["ex"]
        MOCK["influenza-host"] = {"examples": [[s, y] for s, y in D["examples"]], "ways": {}}
        for way in G["WAYS"]:
            mdl, acc = train("influenza-host", "proteins", None, way, D)
            MOCK["influenza-host"]["ways"][way] = {"acc": round(acc, 4), "rows": [one(mdl, eid[i:i + 1], em[i:i + 1], None, (20, 50), (4, 8, 12), True) for i in range(4)]}
    (here / "explainability-mock-data.json").write_text(json.dumps(MOCK, separators=(",", ":")), encoding="utf-8")
    log(f"  wrote explainability-mock-data.json ({(here / 'explainability-mock-data.json').stat().st_size:,} bytes)")

log(f"done ({time.time()-T0:.0f}s)")
