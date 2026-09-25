"""Planning measurement for slot 83 `attention` (PHM5005 08-1 cell 1), asked
for on 2026-09-25 after the language arc's picks (his four widgets, the
notebooks' order, a synthetic stage pretrained offline). Imports the grammar
and the tiny BERT from `language-arc-measure.py`.

Widget 49 already steps ONE head through [3, 4] at initialisation, where the
weights are flat. So 83 is worth a slot only if TRAINED weights show
something 49 cannot. The claims to test:

  W1 WHAT EACH TRAINED HEAD LOOKS AT. Per layer and head, over 500 held-out
     notes: the share of each query's weight on itself, the previous token,
     the next, [CLS], [SEP], '.', its own clause and the other clauses; the
     mean largest weight; how often the query's own token is the largest
     (his figure `dl-language-attention-weight.png` draws the diagonal as
     the largest in every row); |alpha_ij - alpha_ji|.
  W2 CONTENT, on the lesson's own example. (a) "treated with [MASK] for
     <symptom>": the [MASK] query's weight on the symptom's words, per head,
     against the share they would get from a uniform row. (b) "discharge"'s
     query: weight on its own clause's cue words (home, rehab, today ... /
     yellow, from, wound ...).
  W3 HEADS. Is one head responsible for the drug? MLM accuracy on held-out
     notes and on the drug slot with each head zeroed in turn. Are heads
     redundant (correlation between their weight maps)? Does multi-head beat
     one head of the same width (08-1 cell 1: "richer than any single head")?
  W4 THE SCALE, trained: MLM pretrained with and without 1/sqrt(d_k), at
     d_k 12 (4 heads of 48) and d_k 64 (one head of 64): the loss along
     training and the weights' peakedness after.
  W5 ONE LAYER OR TWO: does a one-block model fill the drug slot, so the
     page can show a model whose every weight is read off the input?

Run:  python widgets/_lab/attention-measure.py      (about 8 min)
      ... --one      the one-block model's heads and ablation (1 min)
      ... --export   the base model's block 1 on four sentences, written to
                     attention-mock-data.json for `attention-mock.html`

---------------------------------------------------------------------------
FINDINGS, 2026-09-25, torch 2.14 CPU, two seeds per variant.

W1 TRAINED HEADS SPECIALISE, AND BY POSITION AS MUCH AS BY CONTENT. The
   base (4 heads of 12, 2 blocks), block 1: head 1 puts 0.55 of a query's
   weight on the NEXT token, head 3 0.64 on the PREVIOUS one, heads 2 and 4
   spread over their own clause (0.55, 0.52). The one-block model grows the
   same pair (next 0.59, previous 0.51). Heads are not copies: the
   correlation between two heads' weight maps is 0.01-0.27. 08-1 cell 1's
   "one head may focus on short-range dependencies, another on semantic
   similarity" HOLDS on this stage.
   HIS FIGURE'S DIAGONAL DOES NOT: `dl-language-attention-weight.png` draws
   each token's own key as its largest weight; trained, the own token is the
   largest in 1-13% of rows (self weight 0.03-0.13). The mean top weight is
   0.42-0.81, so trained rows are peaked but not on themselves.
   Asymmetry, trained: mean |a_ij - a_ji| 0.07-0.12 per cell.
W2 CONTENT, on the lesson's own sentence. "treated with aspirin for chest
   pain": the "aspirin" row puts 0.79 of head 4's weight on "chest pain"
   (0.05, 0.20, 0.03 in the others). With [MASK] for the drug: 0.84 in
   head 4, 0.83 in head 2. Over 300 treat clauses, block 1: 0.07 0.50 0.02
   0.67 against 0.09 for a uniform row; block 2's head 2 puts 0.96 there.
   "discharge"'s row puts 0.95 . 0.61 . 0.91 . 0.58 on its own clause's
   cue words (home, rehab ... / yellow, from, wound ...) against 0.28.
W3 A HEAD'S WEIGHTS ARE NOT HOW MUCH THE MODEL NEEDS IT. Base: zeroing any
   one block-1 head leaves the drug slot at 100%; zeroing block 2's head 2
   (the 0.96 head) drops it to 72%. But in the one-block model the head
   with 0.00 on the symptom (head 1, the next-token head) costs the most
   when zeroed, 100% -> 46%, and the 0.61 head 74%. No copy may say "this
   head finds the drug". (Zeroing also moves the representation, which is
   part of why; mean-ablation is the fairer test and is not run.)
   Multi-head against one head of the same width: 2 blocks, MLM 80% against
   78%, the drug slot 100% both; 1 block, 79% against 75%, drug slot 100%
   against 100%/76% over two seeds. Several heads help a little, and most
   where there is one block.
W4 THE SCALE, TRAINED. At d_k 12 it makes no difference (loss 0.372 with,
   0.383 without, at 3,000 steps). At d_k 64 (one head of 64): block 1's
   mean top weight 0.98 without it against 0.70 with it (rows one-hot), and
   training is slower: loss 1.745 . 1.115 . 0.744 . 0.483 against 1.222 .
   0.639 . 0.499 . 0.389 at 250 . 500 . 1,000 . 3,000 steps; the drug slot
   reaches 100% either way. On the trained base, dropping the division at
   READ time turns the mean top weight 0.65-0.68 into 0.91-0.92.
W5 ONE BLOCK IS ENOUGH for the drug slot (100%, MLM 79%), so a page can
   read every weight straight off x~. Block 1 of the two-block base is also
   read off x~ and is the model 84 continues, so 83 uses it.
"""
import importlib.util, math, random, sys, time
from pathlib import Path
import torch, torch.nn.functional as F

spec = importlib.util.spec_from_file_location("arc", Path(__file__).with_name("language-arc-measure.py"))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
torch.set_num_threads(8)
T0 = time.time()
log = A.log

# --- MHA with a scale switch and a per-head keep mask (for the ablation)
def mha_forward(self, x, pad_mask=None, causal=False, scale=True):
    B_, L_, D = x.shape
    sh = lambda t: t.view(B_, L_, self.H, self.dk).transpose(1, 2)
    q, k, v = sh(self.q(x)), sh(self.k(x)), sh(self.v(x))
    s = q @ k.transpose(-1, -2)
    if getattr(self, "scale_on", True): s = s / math.sqrt(self.dk)
    if pad_mask is not None: s = s.masked_fill(pad_mask[:, None, None, :], float("-inf"))
    if causal:
        s = s.masked_fill(torch.triu(torch.ones(L_, L_, dtype=torch.bool), 1), float("-inf"))
    a = s.softmax(-1); self.last = a
    z = a @ v
    keep = getattr(self, "keep", None)
    if keep is not None: z = z * keep[None, :, None, None]
    return self.o(z.transpose(1, 2).reshape(B_, L_, D))
A.MHA.forward = mha_forward

def pretrain_log(mdl, corpus, steps, seed, checkpoints=(250, 500, 1000, 3000), bs=64, lr=1e-3):
    g = torch.Generator().manual_seed(seed)
    opt = torch.optim.Adam(mdl.parameters(), lr=lr); mdl.train(); out = {}; run = []
    for s in range(1, steps + 1):
        idx = torch.randint(len(corpus), (bs,), generator=g)
        ids, m = A.batchify([corpus[i] for i in idx]); x, y = A.mask_tokens(ids, m, g)
        h, _ = mdl.encode(x, m)
        loss = F.cross_entropy(mdl.mlm(h).reshape(-1, A.V), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step(); run.append(loss.item())
        if s in checkpoints: out[s] = sum(run[-50:]) / len(run[-50:])
    mdl.eval(); return out

def drug_slot(mdl, n=600):
    rng = random.Random(7); rows = [A.clause(rng, "treat")[0] for _ in range(n)]
    ids, m = A.batchify(rows); pos = 3
    x = ids.clone(); x[:, pos] = A.MASK
    with torch.no_grad():
        h, _ = mdl.encode(x, m); p = mdl.mlm(h)[:, pos].argmax(-1)
    return sum(A.VOCAB[p[i]] in A.SYM_DRUG[" ".join(r[4:])] for i, r in enumerate(rows)) / n

def build(D=48, H=4, N=2, seed=0):
    torch.manual_seed(seed); return A.TinyBERT(A.V, D=D, H=H, Fh=2 * D, N=N)

# ================================================================ W1
def w1(mdl, notes):
    log("\n== W1  WHAT EACH TRAINED HEAD LOOKS AT (500 held-out notes, no tokens masked) ==")
    ids, m = A.batchify(notes)
    with torch.no_grad(): mdl.encode(ids, m)
    for li, b in enumerate(mdl.blocks):
        a = b.att.last  # [B, H, L, L]
        H = a.shape[1]
        for h in range(H):
            cats = {k: 0.0 for k in ("self", "prev", "next", "[CLS]", "[SEP]", ".", "own clause", "other clause")}
            nrow = 0; top = 0.0; selfmax = 0; asym = 0.0; npair = 0
            for bi, t in enumerate(notes):
                n = len(t) + 2
                toks = ["[CLS]"] + t + ["[SEP]"]
                clause_id = []; c = 0
                for w in toks:
                    clause_id.append(c)
                    if w == ".": c += 1
                A_ = a[bi, h, :n, :n]
                for i in range(1, n - 1):
                    row = A_[i]; nrow += 1
                    cats["self"] += row[i].item(); cats["prev"] += row[i - 1].item(); cats["next"] += row[i + 1].item()
                    cats["[CLS]"] += row[0].item(); cats["[SEP]"] += row[n - 1].item()
                    cats["."] += sum(row[j].item() for j in range(n) if toks[j] == ".")
                    own = sum(row[j].item() for j in range(1, n - 1) if clause_id[j] == clause_id[i] and toks[j] != ".")
                    cats["own clause"] += own
                    cats["other clause"] += sum(row[j].item() for j in range(1, n - 1) if clause_id[j] != clause_id[i] and toks[j] != ".")
                    top += row.max().item(); selfmax += int(row.argmax().item() == i)
                asym += (A_ - A_.T).abs().sum().item(); npair += n * n
            desc = "  ".join(f"{k} {v / nrow:.2f}" for k, v in cats.items())
            log(f"  block {li + 1} head {h + 1}: {desc}")
            log(f"               mean top weight {top / nrow:.2f}; own token the largest in {selfmax / nrow:.0%} of rows; mean |a_ij - a_ji| {asym / npair:.3f}")
        # redundancy: correlation between heads' maps over real cells
        flat = []
        for h in range(H):
            v = torch.cat([a[bi, h, :len(t) + 2, :len(t) + 2].reshape(-1) for bi, t in enumerate(notes)]); flat.append(v)
        C = torch.corrcoef(torch.stack(flat))
        log(f"  block {li + 1}: correlation between heads' weights " + " ".join(f"{C[i, j]:.2f}" for i in range(H) for j in range(i + 1, H)))

# ================================================================ W2
def w2(mdl):
    log("\n== W2  CONTENT ==")
    rng = random.Random(21); rows = []
    for _ in range(300):
        t, _ = A.clause(rng, "treat")
        other = A.note(rng, 1)[0]
        rows.append((other + ["."] + t, len(other) + 1) if rng.random() < 0.5 else (t + ["."] + other, 0))
    for li in range(len(mdl.blocks)):
        per = torch.zeros(mdl.blocks[li].att.H); uni = 0.0
        for t, off in rows:
            ids, m = A.batchify([t]); pos = 1 + off + 2  # [CLS] + offset + treated with
            x = ids.clone(); x[0, pos] = A.MASK
            with torch.no_grad(): mdl.encode(x, m)
            a = mdl.blocks[li].att.last[0, :, pos]
            toks = ["[CLS]"] + t + ["[SEP]"]; n = len(toks)
            sym = []; jj = pos + 2          # treated with DRUG for SYM...
            while toks[jj] not in (".", "[SEP]"): sym.append(jj); jj += 1
            per += a[:, sym].sum(-1); uni += len(sym) / n
        per /= len(rows); uni /= len(rows)
        log(f"  block {li + 1}: the [MASK] drug query's weight on the symptom's words, per head: "
            + " ".join(f"{v:.2f}" for v in per.tolist()) + f"   (a uniform row gives {uni:.2f})")
    cue_home = {"planned", "ready", "home", "to", "rehab", "today", "tomorrow"}
    cue_wound = {"yellow", "purulent", "clear", "from", "wound", "ear", "eye"}
    rng = random.Random(23); res = {li: torch.zeros(mdl.blocks[li].att.H) for li in range(len(mdl.blocks))}; unis = 0.0; cnt = 0
    for _ in range(300):
        k = rng.choice(["dhome", "dwound"])
        kinds = [rng.choice(["present", "treat", "neg", "course"]), k]; rng.shuffle(kinds)
        t, _ = A.note(rng, 2, kinds); toks = ["[CLS]"] + t + ["[SEP]"]
        ids, m = A.batchify([t]); d = toks.index("discharge")
        c = 0; cid = []
        for w in toks: cid.append(c); c += w == "."
        cues = [j for j, w in enumerate(toks) if cid[j] == cid[d] and w in (cue_home | cue_wound) and j != d]
        with torch.no_grad(): mdl.encode(ids, m)
        for li in res: res[li] += mdl.blocks[li].att.last[0, :, d, cues].sum(-1)
        unis += len(cues) / len(toks); cnt += 1
    for li in res:
        log(f"  block {li + 1}: 'discharge' query's weight on its clause's cue words, per head: "
            + " ".join(f"{v / cnt:.2f}" for v in res[li].tolist()) + f"   (uniform {unis / cnt:.2f})")

# ================================================================ W3
def w3(mdl, corpus_test):
    log("\n== W3  HEADS: each zeroed in turn ==")
    g = lambda: torch.Generator().manual_seed(3)
    log(f"  all heads: MLM {A.mlm_accuracy(mdl, corpus_test, g()):.0%}, drug slot {drug_slot(mdl):.0%}")
    for li, b in enumerate(mdl.blocks):
        for h in range(b.att.H):
            keep = torch.ones(b.att.H); keep[h] = 0; b.att.keep = keep
            log(f"  block {li + 1} head {h + 1} zeroed: MLM {A.mlm_accuracy(mdl, corpus_test, g()):.0%}, drug slot {drug_slot(mdl):.0%}")
            b.att.keep = None
        b.att.keep = torch.zeros(b.att.H)
        log(f"  block {li + 1} ALL heads zeroed: MLM {A.mlm_accuracy(mdl, corpus_test, g()):.0%}, drug slot {drug_slot(mdl):.0%}")
        b.att.keep = None

def variants(corpus, corpus_test):
    log("\n== W3/W4/W5  VARIANTS, 3,000 steps each, loss (mean of 50) at 250 . 500 . 1000 . 3000 ==")
    out = {}
    for name, D, H, N, sc in [("4 heads of 12, 2 blocks (the base)", 48, 4, 2, True),
                              ("1 head of 48, 2 blocks", 48, 1, 2, True),
                              ("4 heads of 12, 1 block", 48, 4, 1, True),
                              ("1 head of 48, 1 block", 48, 1, 1, True),
                              ("4 heads of 12, 2 blocks, NO 1/sqrt(d_k)", 48, 4, 2, False),
                              ("1 head of 64, 2 blocks", 64, 1, 2, True),
                              ("1 head of 64, 2 blocks, NO 1/sqrt(d_k)", 64, 1, 2, False)]:
        accs = []; losses = []; tops = []
        for seed in (0, 1):
            mdl = build(D, H, N, seed)
            for b in mdl.blocks: b.att.scale_on = sc
            ck = pretrain_log(mdl, corpus, 3000, seed); losses.append(ck)
            accs.append((A.mlm_accuracy(mdl, corpus_test, torch.Generator().manual_seed(3)), drug_slot(mdl)))
            ids, m = A.batchify(corpus_test[:300])
            with torch.no_grad(): mdl.encode(ids, m)
            a = mdl.blocks[0].att.last; real = m.bool()
            tops.append(a.max(-1).values.permute(0, 2, 1)[real].mean().item())
            if seed == 0 and name.startswith("4 heads of 12, 2 blocks (the"): out["base"] = mdl
            if seed == 0 and name == "4 heads of 12, 1 block": out["one"] = mdl
        ls = "  ".join(f"{sum(l[k] for l in losses) / 2:.3f}" for k in (250, 500, 1000, 3000))
        log(f"  {name:40s} loss {ls}   MLM {sum(a for a, _ in accs) / 2:.0%}  drug slot "
            + "/".join(f"{d:.0%}" for _, d in accs) + f"   block-1 top weight {sum(tops) / 2:.2f}   ({time.time() - T0:.0f}s)")
    return out

def one_block_only(corpus, corpus_test):
    mdl = build(48, 4, 1, 0); pretrain_log(mdl, corpus, 3000, 0)
    w1(mdl, corpus_test[:500]); w2(mdl); w3(mdl, corpus_test)

def export(corpus):
    """The base model's block 1 on four sentences, for the mock."""
    import json
    mdl = build(48, 4, 2, 0); pretrain_log(mdl, corpus, 3000, 0)
    b = mdl.blocks[0].att
    sents = ["treated with aspirin for chest pain", "treated with [MASK] for chest pain",
             "patient presented with fever . yellow discharge from wound",
             "no nausea reported . planned discharge home today"]
    out = {"note": "slot 83 mock data: the base tiny BERT (D 48, 4 heads of 12, 2 blocks, MLM 3,000 steps, seed 0), block 1",
           "sentences": []}
    r2 = lambda t: [[round(x, 4) for x in row] for row in t.tolist()]
    for s_ in sents:
        toks = s_.split(); ids, m = A.batchify([[w for w in toks]] if "[MASK]" not in toks else [[("aspirin" if w == "[MASK]" else w) for w in toks]])
        L = len(toks) + 2; ids, m = ids[:, :L], m[:, :L]
        if "[MASK]" in toks: ids[0, 1 + toks.index("[MASK]")] = A.MASK
        with torch.no_grad():
            x = mdl.embed(ids); xn = x  # block 1's input is x~ itself
            B_, L_, D = x.shape
            sh = lambda t: t.view(1, L_, b.H, b.dk).transpose(1, 2)
            q, k, v = sh(b.q(x)), sh(b.k(x)), sh(b.v(x))
            sc = q @ k.transpose(-1, -2)
            a = (sc / math.sqrt(b.dk)).softmax(-1); au = sc.softmax(-1); z = a @ v
            # the same sentence padded to 16 with NO mask
            idsP, mP = A.batchify([toks if "[MASK]" not in toks else [("aspirin" if w == "[MASK]" else w) for w in toks]], 16)
            if "[MASK]" in toks: idsP[0, 1 + toks.index("[MASK]")] = A.MASK
            xP = mdl.embed(idsP); qP, kP = [t.view(1, 16, b.H, b.dk).transpose(1, 2) for t in (b.q(xP), b.k(xP))]
            aP = ((qP @ kP.transpose(-1, -2)) / math.sqrt(b.dk)).softmax(-1)
        out["sentences"].append({"tokens": ["[CLS]"] + toks + ["[SEP]"],
            "heads": [{"alpha": r2(a[0, h]), "alpha_unscaled": r2(au[0, h]), "v": r2(v[0, h]), "z": r2(z[0, h]),
                       "alpha_pad16_nomask": r2(aP[0, h, :L])} for h in range(b.H)]})
        if s_.startswith("treated"):
            tk = ["[CLS]"] + toks + ["[SEP]"]; qi = 3; sym = [5, 6]
            log(f"  '{s_}': row '{tk[qi]}' weight on 'chest pain' per head: " + " ".join(f"{a[0, h, qi, sym].sum():.2f}" for h in range(b.H))
                + f"; top weight unscaled vs scaled, mean over rows: {au[0].max(-1).values.mean():.2f} vs {a[0].max(-1).values.mean():.2f}")
    Path(__file__).with_name("attention-mock-data.json").write_text(json.dumps(out))
    log("  wrote attention-mock-data.json")

if __name__ == "__main__":
    if "--export" in sys.argv:
        export(A.make_corpus(0, 20000)); sys.exit()
    if "--one" in sys.argv:
        one_block_only(A.make_corpus(0, 20000), A.make_corpus(1, 2000)); sys.exit()
    corpus = A.make_corpus(0, 20000); corpus_test = A.make_corpus(1, 2000)
    mods = variants(corpus, corpus_test)
    w1(mods["base"], corpus_test[:500])
    w2(mods["base"]); w2(mods["one"])
    w3(mods["base"], corpus_test)
    log(f"\ntotal {time.time() - T0:.0f}s")
