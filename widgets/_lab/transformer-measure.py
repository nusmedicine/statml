"""Planning measurement for slot 84 `transformer` (PHM5005 08-1 cells 2-4:
Transformer Architecture, Transformer Tasks, Pre-training), asked for on
2026-09-26 after 83 `attention` shipped. Imports the arc's grammar and tiny
BERT (`language-arc-measure.py`) and 83's training (`attention-measure.py`),
so the base model here is the SAME instance widget 83 ships (seed 0, 3,000
steps).

The arc already measured (language-arc-measure.py B1, B2): MLM fills
"treated with [MASK] for <symptom>" with a right drug 100% against the
causal model's 17%; "discharge" (home / wound) is one table row, separated
after block 1. The claims still to test, one per thing 84 would draw:

  E  THE ENCODER BLOCK, sublayer by sublayer (08-1 cell 2 §1).
     E1 where a token's context arrives: a linear probe at x~, after the
        attention sublayer (Add & Norm 1), after the FFN sublayer (Add &
        Norm 2), and the same in block 2 -- for the sense of "discharge"
        and for whether a symptom is NEGATED ("no fever reported") or
        asserted, at matched positions so position cannot carry it.
     E2 does the token stay itself: at each stage, is the nearest row of
        the token table still the token's own (the residual's claim).
     E3 "the FFN provides the NONLINEARITY needed for negation": the same
        model pretrained with no FFN (attention and Add & Norm only), its
        MLM accuracy, drug slot and negation probe.
     E4 "lower layers local, higher layers semantic": each head's mean
        attention distance and share on its own clause, block 1 against 2.
  D  THE DECODER (08-1 cell 2 §2, cell 3).
     D1 the causal model (same size, next-token pretraining): generation
        from [CLS] and from the lesson's prompt, fed back token by token
        (his figure's loop); how many sampled notes are grammatical.
     D2 CROSS-ATTENTION on two sequence-to-sequence stages, a tiny
        encoder-decoder each: (a) DNA -> protein, cell 4's biological
        example, where each amino acid should read its own codon; (b)
        English -> Malay clinical phrases, his figure's "Good morning ->
        Selamat pagi" direction, where the word order changes ("chest pain"
        -> "sakit dada", "yellow discharge" -> "lelehan kuning"). Accuracy
        and how much of each output's cross-attention lands on its source.
  P  PRE-TRAINING, the three objectives on cell 4's own examples.
     P1 token by token along "treated with <drug> for <symptom>": what MLM
        recovers with that one token masked, against what the causal model
        predicts from the left alone.

Run:  python widgets/_lab/transformer-measure.py [E D P]   (about 4 min)
      ... --export   writes transformer-mock-data.json for `transformer-mock.html`

---------------------------------------------------------------------------
FINDINGS, 2026-09-26, torch 2.14 CPU. The base is widget 83's model (MLM
80.4% on held-out notes).

E1 CONTEXT ARRIVES AT THE ATTENTION SUBLAYER. A linear probe on one token's
   vector, positions matched so position cannot carry the label:
                                 sense of "discharge"   symptom negated
     x~ (token + position)          47%  (cos 0.998)        46%
     block 1 attention + A&N       100%  (cos 0.842)       100%
     block 1 FFN + A&N             100%  (cos 0.790)       100%
     block 2 attention + A&N       100%  (cos 0.590)       100%
     block 2 FFN + A&N             100%  (cos 0.685)       100%
   The two "discharge" rows start as one table row and part at the first
   attention sublayer; the FFN moves them a little further.
E2 THE TOKEN STAYS ITSELF through block 1: the nearest row of the token
   table is the token's own for 100% of symptom tokens at every block-1
   stage, 58% after block 2; for "discharge" 100% until block 1's FFN, 38%
   after it, 0% after block 2. The residual carries the token; the FFN and
   the second block move it away from its table row.
E3 08-1 CELL 2's "THE FFN PROVIDES THE NONLINEARITY NEEDED FOR ... NEGATION"
   DOES NOT HOLD ON THIS STAGE. A model with NO FFN (27,996 parameters,
   attention and Add & Norm only, same training): MLM 79.6% against 80.4%,
   drug slot 100% both, negation and sense 100% linearly readable after its
   first attention sublayer. Zeroing block 1's or block 2's FFN in the
   trained base at read time: MLM 79.1% / 79.5%, drug slot 100%. Softmax
   attention and LayerNorm are nonlinear themselves; the toy grammar asks
   little of the FFN. No copy may say what the FFN does; it can say what it
   IS (the same small network on each token's row, alone).
E4 "LOWER LAYERS LOCAL, HIGHER LAYERS SEMANTIC" DOES NOT SHOW IN TWO BLOCKS:
   mean attention distance 2.0-3.3 in block 1, 2.5-3.5 in block 2; share on
   the own clause 0.66-0.82 in both. A claim about deep models, not one this
   toy can draw.
D1 THE CAUSAL MODEL (same size, next-token pretraining, 3,000 steps, loss
   0.88): 299 of 300 notes sampled at temperature 1 parse as the grammar;
   greedy from "treated with aspirin for" -> "chest pain" (0.998), then
   repeats "patient deteriorated overnight" (greedy's loop). Changing tokens
   5 onward leaves rows 0-4 EXACTLY unchanged (0.0), row 5 moves 4.07.
D2 CROSS-ATTENTION, two tiny encoder-decoders (D 48, 4 heads, 2 + 2 blocks,
   3,000 steps), both 100% exact on 300 held-out pairs:
   - DNA -> protein (08-1 cell 4's biological example, 3-8 codons): each
     amino acid's cross-attention puts 0.95 of its weight (mean of heads,
     decoder block 2; 0.94-0.97 per head, argmax on the codon 100%) on its
     own three nucleotides. Block 1: 0.84, one head 0.57.
   - English -> Malay clinical phrases (his figure's direction; 158 of 300
     change word order, "chest pain" -> "sakit dada"): 0.36-0.44 on the
     aligned word. It translates perfectly and its weights look diffuse, so
     it cannot carry "the decoder reads the source here".
P1 EACH OBJECTIVE READS ITS OWN DIRECTION, token by token along "treated
   with <drug> for <symptom>" (600 clauses): MLM with that token masked
   100% at every position; causal from the left 0% (the first word: nothing
   to its left), 100%, 17% (the drug), 100%, 100%, 100%. The drug is the one
   token whose answer lies to its right. At the lesson's own [MASK] the MLM
   model puts 0.61 on aspirin and 0.39 on nitrate (the two chest-pain drugs);
   the causal model after "treated with" spreads 0.08-0.15 over all ten.
"""
import importlib.util, math, random, sys, time
from pathlib import Path
import torch, torch.nn as nn, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("am", here / "attention-measure.py")
AM = importlib.util.module_from_spec(spec); spec.loader.exec_module(AM)
A = AM.A
torch.set_num_threads(8)
T0 = time.time()
log = A.log

# ---------------------------------------------------------------- helpers
def stages(mdl, ids, m):
    """Every stage a token passes through, in order, with names."""
    pm = m == 0
    h = mdl.embed(ids); out = [("x~ (token + position)", h)]
    for bi, b in enumerate(mdl.blocks, 1):
        a = b.att(h, pm)
        h1 = b.n1(h + a); out.append((f"block {bi} after attention + Add & Norm", h1))
        h = b.n2(h1 + b.ff(h1)); out.append((f"block {bi} after FFN + Add & Norm", h))
    return out

def probe(X, y, seed=0, steps=400):
    """A linear probe trained on half, scored on the other half."""
    g = torch.Generator().manual_seed(seed)
    idx = torch.randperm(len(y), generator=g); X, y = X[idx], y[idx]
    n = len(y) // 2
    mu, sd = X[:n].mean(0), X[:n].std(0) + 1e-6
    Xs = (X - mu) / sd
    torch.manual_seed(seed); p = nn.Linear(X.shape[1], 2); opt = torch.optim.Adam(p.parameters(), 1e-2)
    with torch.enable_grad():
        for _ in range(steps):
            l = F.cross_entropy(p(Xs[:n]), y[:n]); opt.zero_grad(); l.backward(); opt.step()
    return (p(Xs[n:]).argmax(-1) == y[n:]).float().mean().item()

def sense_rows(n=600, seed=9):
    rng = random.Random(seed); rows, y = [], []
    for _ in range(n):
        k = rng.choice(["dhome", "dwound"])
        kinds = [rng.choice(["present", "treat", "neg", "course"]), k] if rng.random() < 0.5 else [k]
        t, f = A.note(rng, len(kinds), kinds); rows.append(t); y.append(k == "dwound")
    ids, m = A.batchify(rows)
    pos = (ids == A.ID["discharge"]).float().argmax(1)
    return ids, m, pos, torch.tensor(y).long()

def negation_rows(n=4000, seed=11):
    """A symptom's first word, negated ('no fever reported') or asserted
    ('patient presented with fever'), balanced WITHIN each position so the
    position cannot carry the label."""
    rng = random.Random(seed); by = {}
    for _ in range(n):
        k = rng.choice(["neg", "present"]); pre = rng.choice([[], ["course"], ["treat"], ["dhome"], ["dwound"], ["course", "dhome"]])
        kinds = pre + [k]
        t, f = A.note(rng, len(kinds), kinds)
        s = (f["negated"] or f["asserted"])
        # the LAST clause is the one we built; find its symptom's first word from the end
        last = t[len(t) - t[::-1].index(".") :] if "." in t else t
        off = len(t) - len(last)
        sw = [i for i, w in enumerate(last) if w in {x.split()[0] for x in A.SYMS}]
        p = 1 + off + sw[0]  # +1 for [CLS]
        by.setdefault((p, k == "neg"), []).append((t, p))
    rows, pos, y = [], [], []
    for (p, neg), lst in by.items():
        other = by.get((p, not neg), [])
        kkeep = min(len(lst), len(other))
        for t, pp in lst[:kkeep]:
            rows.append(t); pos.append(pp); y.append(neg)
    ids, m = A.batchify(rows)
    return ids, m, torch.tensor(pos), torch.tensor(y).long()

def at(h, pos): return h[torch.arange(len(pos)), pos]

# ================================================================ E encoder
class NoFF(nn.Module):
    def forward(self, x): return torch.zeros_like(x)

def part_E(base, corpus, corpus_test):
    log("\n== E  THE ENCODER BLOCK, sublayer by sublayer (the base = widget 83's model) ==")
    sids, sm, spos, sy = sense_rows()
    nids, nm, npos, ny = negation_rows()
    log(f"  sense rows {len(sy)} ({int(sy.sum())} wound);  negation rows {len(ny)} ({int(ny.sum())} negated), "
        f"positions {sorted(set(npos.tolist()))}")
    tab = F.normalize(base.tok.weight, dim=1)
    def report(mdl, name):
        with torch.no_grad():
            S = stages(mdl, sids, sm); N = stages(mdl, nids, nm)
        log(f"  {name}")
        for (lab, hs), (_, hn) in zip(S, N):
            vs, vn = at(hs, spos), at(hn, npos)
            cos = F.cosine_similarity(vs[sy == 0].mean(0), vs[sy == 1].mean(0), dim=0).item()
            # E2: nearest table row is the token's own
            own = (F.normalize(vn, dim=1) @ tab.T).argmax(1) == nids[torch.arange(len(npos)), npos]
            owns = (F.normalize(vs, dim=1) @ tab.T).argmax(1) == A.ID["discharge"]
            log(f"    {lab:40s} sense probe {probe(vs, sy):4.0%} (cos {cos:.3f})   negation probe {probe(vn, ny):4.0%}"
                f"   nearest table row is its own token {own.float().mean():4.0%} / {owns.float().mean():4.0%}")
    report(base, "the base, 4 heads of 12, FFN 96, 2 blocks:")
    # E3 no FFN
    torch.manual_seed(0); nf = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
    for b in nf.blocks: b.ff = NoFF()
    AM.pretrain_log(nf, corpus, 3000, 0)
    g = torch.Generator().manual_seed(3)
    ab = A.mlm_accuracy(base, corpus_test, torch.Generator().manual_seed(3))
    an = A.mlm_accuracy(nf, corpus_test, g)
    log(f"  E3 MLM accuracy on held-out notes: base {ab:.1%}, no FFN {an:.1%};  drug slot base "
        f"{AM.drug_slot(base):.0%}, no FFN {AM.drug_slot(nf):.0%};  parameters base "
        f"{sum(p.numel() for p in base.parameters()):,}, no FFN {sum(p.numel() for p in nf.parameters()):,}")
    report(nf, "no FFN (attention and Add & Norm only), same training:")
    # a wider model with no FFN, to match parameters roughly
    # E3b zero the trained base's FFNs at read time (keeps the residual)
    saved = [b.ff for b in base.blocks]
    for i in range(2):
        b = base.blocks[i]; b.ff = NoFF()
        log(f"  E3b base with block {i+1}'s FFN zeroed at read time: MLM {A.mlm_accuracy(base, corpus_test, torch.Generator().manual_seed(3)):.1%},"
            f" drug slot {AM.drug_slot(base):.0%}")
        b.ff = saved[i]
    # E4 attention distance per block and head
    notes = corpus_test[:500]; ids, m = A.batchify(notes)
    with torch.no_grad(): _, _ = base.encode(ids, m)
    log("  E4 each head's mean |i - j| (weighted by alpha) and share on its own clause, 500 notes:")
    L_ = ids.shape[1]
    ii = torch.arange(L_)[:, None].float(); jj = torch.arange(L_)[None, :].float()
    dist = (ii - jj).abs()
    # clause id per position: count of '.' before it
    dot = (ids == A.ID["."]).long(); cid = dot.cumsum(1) - dot
    same = (cid[:, :, None] == cid[:, None, :]).float()
    real = (m[:, :, None] * m[:, None, :]).float()
    with torch.no_grad():
        for bi, b in enumerate(base.blocks, 1):
            h = base.embed(ids) if bi == 1 else None
        # re-run to collect each block's last attention
        hs = base.embed(ids); pm = m == 0; alphas = []
        for b in base.blocks:
            b.att(hs, pm); alphas.append(b.att.last.clone()); hs = b(hs, pm)
    for bi, a in enumerate(alphas, 1):
        row = []
        for hh in range(a.shape[1]):
            w = a[:, hh] * m[:, :, None]
            d = (w * dist).sum() / w.sum(); c = (w * same).sum() / w.sum()
            row.append(f"h{hh+1} {d:.2f} / {c:.2f}")
        log(f"    block {bi}: " + "   ".join(row))

# ================================================================ D decoder
def grammar_clauses():
    C = set()
    for p in ("presented", "was"):
        for a in A.SYMS:
            C.add(" ".join(["patient", p, "with", a]))
            for b in A.SYMS:
                if b != a: C.add(" ".join(["patient", p, "with", a, "and", b]))
    for s, ds in A.SYM_DRUG.items():
        for v in ("treated", "managed"):
            for d in ds: C.add(f"{v} with {d} for {s}")
    for s in A.SYMS:
        C.add(f"no {s} reported"); C.add(f"no {s} on exam")
    for p in ("planned", "ready"):
        for w in ("home", "to rehab"):
            for t in ("today", "tomorrow"): C.add(f"{p} discharge {w} {t}")
    for c in ("yellow", "purulent", "clear"):
        for w in ("wound", "ear", "eye"): C.add(f"{c} discharge from {w}")
    C.add("patient recovered well"); C.add("patient deteriorated overnight")
    return C

def generate(mdl, prompt, g=None, temp=1.0, maxlen=A.L):
    ids = [A.CLS] + [A.ID[w] for w in prompt]
    with torch.no_grad():
        while len(ids) < maxlen:
            x = torch.tensor([ids]); m = torch.ones_like(x)
            h, _ = mdl.encode(x, m, causal=True)
            lg = mdl.mlm(h[0, -1]); lg[A.PAD] = lg[A.MASK] = lg[A.CLS] = -1e9
            nxt = int(lg.argmax()) if g is None else int(torch.multinomial((lg / temp).softmax(-1), 1, generator=g))
            ids.append(nxt)
            if nxt == A.SEP: break
    return [A.VOCAB[i] for i in ids[1:]]

def part_D1(corpus, corpus_test):
    log("\n== D1  THE CAUSAL MODEL (decoder-only): generation fed back token by token ==")
    torch.manual_seed(0); cm = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
    g = torch.Generator().manual_seed(0)
    t = time.time(); loss = A.pretrain(cm, corpus, 3000, g, causal=True)
    log(f"  pretrained 3000 steps next-token in {time.time()-t:.0f}s, last loss {loss:.3f}")
    for p in ([], ["treated", "with", "aspirin", "for"], ["treated", "with"], ["no"], ["yellow"], ["patient"]):
        log(f"    greedy from [CLS] {' '.join(p):28s} -> {' '.join(generate(cm, p))}")
    C = grammar_clauses(); gg = torch.Generator().manual_seed(1)
    ok = 0; n = 300; ex = []
    for i in range(n):
        out = generate(cm, [], gg)
        body = out[:-1] if out and out[-1] == "[SEP]" else None
        good = body is not None and all(" ".join(c.split()) in C for c in " ".join(body).split(" . "))
        ok += good
        if i < 6: ex.append((good, " ".join(out)))
    log(f"  D1 sampled notes (temperature 1) that parse as the grammar: {ok}/{n}")
    for good, s in ex: log(f"      {'ok ' if good else 'BAD'} {s}")
    # the causal mask: row t is unchanged by any token after t
    x = torch.tensor([[A.CLS] + [A.ID[w] for w in "treated with aspirin for chest pain".split()] + [A.SEP]])
    x2 = x.clone(); x2[0, 5:] = torch.tensor([A.ID[w] for w in "fever".split()] * 3)
    with torch.no_grad():
        h1, _ = cm.encode(x, torch.ones_like(x), causal=True); h2, _ = cm.encode(x2, torch.ones_like(x2), causal=True)
    log(f"  D1 rows 0-4 when tokens 5+ change: largest difference {(h1[0,:5]-h2[0,:5]).abs().max():.1e}; row 5 {(h1[0,5]-h2[0,5]).abs().max():.2f}")
    return cm

# --- a tiny encoder-decoder
class CrossMHA(nn.Module):
    def __init__(self, D, H):
        super().__init__(); self.H, self.dk = H, D // H
        self.q, self.k, self.v, self.o = (nn.Linear(D, D) for _ in range(4)); self.last = None
    def forward(self, x, mem, mem_pad):
        B_, Lq, D = x.shape; Lk = mem.shape[1]
        q = self.q(x).view(B_, Lq, self.H, self.dk).transpose(1, 2)
        k = self.k(mem).view(B_, Lk, self.H, self.dk).transpose(1, 2)
        v = self.v(mem).view(B_, Lk, self.H, self.dk).transpose(1, 2)
        s = (q @ k.transpose(-1, -2)) / math.sqrt(self.dk)
        s = s.masked_fill(mem_pad[:, None, None, :], float("-inf"))
        a = s.softmax(-1); self.last = a
        return self.o((a @ v).transpose(1, 2).reshape(B_, Lq, D))

class DecBlock(nn.Module):
    def __init__(self, D, H, Fh):
        super().__init__()
        self.self_att = A.MHA(D, H); self.cross = CrossMHA(D, H)
        self.n1, self.n2, self.n3 = nn.LayerNorm(D), nn.LayerNorm(D), nn.LayerNorm(D)
        self.ff = nn.Sequential(nn.Linear(D, Fh), nn.ReLU(), nn.Linear(Fh, D))
    def forward(self, y, ypad, mem, mpad):
        y = self.n1(y + self.self_att(y, ypad, causal=True))
        y = self.n2(y + self.cross(y, mem, mpad))
        return self.n3(y + self.ff(y))

class EncDec(nn.Module):
    def __init__(self, Vs, Vt, D=48, H=4, Fh=96, Ne=2, Nd=2, Lmax=64):
        super().__init__()
        self.stok, self.spos = nn.Embedding(Vs, D), nn.Embedding(Lmax, D)
        self.ttok, self.tpos = nn.Embedding(Vt, D), nn.Embedding(Lmax, D)
        self.enc = nn.ModuleList(A.Block(D, H, Fh, p=0.0) for _ in range(Ne))
        self.dec = nn.ModuleList(DecBlock(D, H, Fh) for _ in range(Nd))
        self.out = nn.Linear(D, Vt)
    def memory(self, src, spad):
        h = self.stok(src) + self.spos(torch.arange(src.shape[1])[None])
        for b in self.enc: h = b(h, spad)
        return h
    def forward(self, src, spad, tin, tpad):
        mem = self.memory(src, spad)
        y = self.ttok(tin) + self.tpos(torch.arange(tin.shape[1])[None])
        for b in self.dec: y = b(y, tpad, mem, spad)
        return self.out(y)

def seq2seq(name, pairs, test, Vs, Vt, align, steps=3000, Nd=2):
    """pairs: (src ids, tgt ids) lists; tgt excludes BOS/EOS; align(src, tgt) ->
    for each target position, the source positions it comes from."""
    PADs, PADt, BOS, EOS = 0, 0, 1, 2
    def batch(ps):
        Ls = max(len(s) for s, _ in ps); Lt = max(len(t) for _, t in ps) + 1
        S = torch.tensor([s + [PADs] * (Ls - len(s)) for s, _ in ps])
        Ti = torch.tensor([[BOS] + t + [PADt] * (Lt - 1 - len(t)) for _, t in ps])
        To = torch.tensor([t + [EOS] + [-100] * (Lt - 1 - len(t)) for _, t in ps])
        return S, S == PADs, Ti, Ti == PADt, To
    torch.manual_seed(0); mdl = EncDec(Vs, Vt, Nd=Nd); g = random.Random(0)
    opt = torch.optim.Adam(mdl.parameters(), 1e-3); t0 = time.time()
    for s in range(steps):
        S, sp, Ti, tp, To = batch(g.sample(pairs, 64))
        tp[:, 0] = False
        loss = F.cross_entropy(mdl(S, sp, Ti, tp).reshape(-1, Vt), To.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()
    mdl.eval()
    # greedy decoding, fed back
    exact = 0; tok_ok = tok_n = 0
    with torch.no_grad():
        for src, tgt in test:
            S = torch.tensor([src]); sp = S == PADs; mem = mdl.memory(S, sp); y = [BOS]
            while len(y) < len(tgt) + 6:
                Ti = torch.tensor([y]); yy = mdl.ttok(Ti) + mdl.tpos(torch.arange(len(y))[None])
                for b in mdl.dec: yy = b(yy, torch.zeros_like(Ti, dtype=torch.bool), mem, sp)
                nxt = int(mdl.out(yy[0, -1]).argmax()); y.append(nxt)
                if nxt == EOS: break
            pred = y[1:-1] if y[-1] == EOS else y[1:]
            exact += pred == tgt
            tok_ok += sum(a == b for a, b in zip(pred, tgt)); tok_n += len(tgt)
        # cross-attention alignment, teacher-forced
        S, sp, Ti, tp, To = batch(test)
        tp[:, 0] = False
        mdl(S, sp, Ti, tp)
    log(f"  {name}: {sum(p.numel() for p in mdl.parameters()):,} parameters, {steps} steps in {time.time()-t0:.0f}s, "
        f"last loss {loss.item():.3f};  greedy on {len(test)} held out: exact {exact/len(test):.0%}, tokens {tok_ok/tok_n:.0%}")
    for bi, b in enumerate(mdl.dec, 1):
        a = b.cross.last  # [B, H, Lt, Ls]
        row = []
        for hh in range(a.shape[1]):
            on = tot = 0.0; top = n = 0
            for i, (src, tgt) in enumerate(test):
                for r, srcs in enumerate(align(src, tgt)):
                    w = a[i, hh, r, :len(src)]
                    on += w[srcs].sum().item(); tot += 1
                    top += int(int(w.argmax()) in srcs); n += 1
            row.append(f"h{hh+1} {on/tot:.2f} (argmax {top/n:.0%})")
        # all heads averaged
        on = tot = 0.0
        for i, (src, tgt) in enumerate(test):
            for r, srcs in enumerate(align(src, tgt)):
                on += a[i, :, r, :len(src)][:, srcs].sum(-1).mean().item(); tot += 1
        log(f"    decoder block {bi} cross-attention on the aligned source: " + "   ".join(row) + f"   mean of heads {on/tot:.2f}")
    return mdl

CODE = {}
_b = "TCAG"; _aa = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
for i, a in enumerate(_b):
    for j, b in enumerate(_b):
        for k, c in enumerate(_b): CODE[a + b + c] = _aa[16 * i + 4 * j + k]
SENSE = [c for c, a in CODE.items() if a != "*"]
AAS = sorted(set(CODE.values()) - {"*"})

def dna_stage(n, seed):
    rng = random.Random(seed); sv = {c: i + 1 for i, c in enumerate("ACGT")}; tv = {a: i + 3 for i, a in enumerate(AAS)}
    out = []
    for _ in range(n):
        cod = [rng.choice(SENSE) for _ in range(rng.randint(3, 8))]
        out.append(([sv[ch] for c in cod for ch in c], [tv[CODE[c]] for c in cod]))
    return out

# English -> Malay, clause by clause, with word alignments (checked against a
# dictionary, to be confirmed by Kenneth before any of it goes on a page)
MS_SYM = {"chest pain": (["sakit", "dada"], [1, 0]), "fever": (["demam"], [0]), "infection": (["jangkitan"], [0]),
          "breathlessness": (["sesak", "nafas"], [0, 0]), "nausea": (["loya"], [0])}
MS_COL = {"yellow": "kuning", "purulent": "bernanah", "clear": "jernih"}
MS_SITE = {"wound": "luka", "ear": "telinga", "eye": "mata"}
MS_DRUG = {d: d for d in A.DRUGS}; MS_DRUG["antibiotics"] = "antibiotik"; MS_DRUG["oxygen"] = "oksigen"

def en_ms_clause(rng):
    """(english words, malay words, alignment: for each malay word the english
    word indices it translates)."""
    k = rng.choice(["present", "treat", "neg", "dwound"])
    if k == "present":
        a, b = rng.sample(A.SYMS, 2); en = ["patient", "presented", "with"] + a.split(); ms = ["pesakit", "datang", "dengan"]
        al = [[0], [1], [2]]; base = 3
        mw, ma = MS_SYM[a]; ms += mw; al += [[base + x] for x in ma]
        if rng.random() < 0.5:
            i = len(en); en += ["and"] + b.split(); ms += ["dan"]; al += [[i]]
            mw, ma = MS_SYM[b]; ms += mw; al += [[i + 1 + x] for x in ma]
    elif k == "treat":
        s = rng.choice(A.SYMS); d = rng.choice(A.SYM_DRUG[s]); v = rng.choice(["treated", "managed"])
        en = [v, "with", d, "for"] + s.split(); ms = ["dirawat" if v == "treated" else "diurus", "dengan", MS_DRUG[d], "untuk"]
        al = [[0], [1], [2], [3]]; mw, ma = MS_SYM[s]; ms += mw; al += [[4 + x] for x in ma]
    elif k == "neg":
        s = rng.choice(A.SYMS); tail = rng.choice([["reported"], ["on", "exam"]])
        en = ["no"] + s.split() + tail; ms = ["tiada"]; al = [[0]]
        mw, ma = MS_SYM[s]; ms += mw; al += [[1 + x] for x in ma]
        j = 1 + len(s.split())
        if tail == ["reported"]: ms += ["dilaporkan"]; al += [[j]]
        else: ms += ["semasa", "pemeriksaan"]; al += [[j], [j + 1]]
    else:
        c = rng.choice(list(MS_COL)); w = rng.choice(list(MS_SITE))
        en = [c, "discharge", "from", w]; ms = ["lelehan", MS_COL[c], "dari", MS_SITE[w]]; al = [[1], [0], [2], [3]]
    return en, ms, al

def en_ms_stage(n, seed):
    rng = random.Random(seed); rows = []
    for _ in range(n):
        en, ms, al = [], [], []
        for c in range(rng.choice([1, 2])):
            e, mm, a = en_ms_clause(rng)
            if en: al.append([len(en)]); en.append("."); ms.append(".")
            al += [[len(en) + x for x in xs] for xs in a]; en += e; ms += mm
        rows.append((en, ms, al))
    return rows

def part_D2():
    log("\n== D2  CROSS-ATTENTION: two tiny encoder-decoders (D 48, 4 heads, 2 + 2 blocks) ==")
    tr, te = dna_stage(20000, 0), dna_stage(300, 1)
    seq2seq("DNA -> protein (3 to 8 codons, stops excluded)", tr, te, 5, 3 + len(AAS),
            lambda s, t: [[3 * r, 3 * r + 1, 3 * r + 2] for r in range(len(t))])
    rows = en_ms_stage(20000, 0); test = en_ms_stage(300, 1)
    EV = ["[PAD]"] + sorted({w for e, _, _ in rows + test for w in e}); MV = ["[PAD]", "[BOS]", "[EOS]"] + sorted({w for _, m, _ in rows + test for w in m})
    ei = {w: i for i, w in enumerate(EV)}; mi = {w: i for i, w in enumerate(MV)}
    enc = lambda rs: [([ei[w] for w in e], [mi[w] for w in m]) for e, m, _ in rs]
    AL = {tuple(ei[w] for w in e): a for e, _, a in test}
    mdl = seq2seq(f"English -> Malay ({len(EV)-1} and {len(MV)-3} words, 1-2 clauses)", enc(rows), enc(test), len(EV), len(MV),
                  lambda s, t: AL[tuple(s)])
    for e, m, a in test[:4]:
        log(f"      {' '.join(e)}  ->  {' '.join(m)}")
    # how many alignments cross (word order changes) in the test set
    cross = sum(any(a[i][0] > a[i + 1][0] for i in range(len(a) - 1)) for _, _, a in test)
    log(f"    {cross}/{len(test)} held-out pairs change word order somewhere")

# ================================================================ P pretraining
def part_P(base, cm):
    log("\n== P  PRE-TRAINING: each token of 'treated with <drug> for <symptom>', 600 clauses ==")
    rng = random.Random(7); rows = [A.clause(rng, "treat")[0] for _ in range(600)]
    rows = [r for r in rows if len(r) == 6] or rows  # chest pain clauses keep 2 symptom words
    rng = random.Random(7); rows = [A.clause(rng, "treat")[0] for _ in range(600)]
    ids, m = A.batchify(rows)
    names = ["treated|managed", "with", "<drug>", "for", "<symptom 1st>", "<symptom 2nd>"]
    with torch.no_grad():
        h2, _ = cm.encode(ids, m, causal=True); pc = cm.mlm(h2).argmax(-1)
        for j in range(6):
            pos = 1 + j
            keep = torch.tensor([len(r) > j for r in rows])
            x = ids.clone(); x[:, pos] = A.MASK
            h, _ = base.encode(x, m); pm = base.mlm(h)[:, pos].argmax(-1)
            def score(pred):
                good = n = 0
                for i, r in enumerate(rows):
                    if len(r) <= j: continue
                    n += 1; w = A.VOCAB[pred[i]]
                    if j == 2: good += w in A.SYM_DRUG[" ".join(r[4:])]
                    elif j == 0: good += w in ("treated", "managed")
                    else: good += w == r[j]
                return good / max(n, 1), n
            a, n = score(pm); b, _ = score(pc[:, pos - 1])
            log(f"    {names[j]:15s} n {n:3d}   MLM (this token masked, both sides seen) {a:4.0%}   causal (left only) {b:4.0%}")

# ================================================================ export
def export(base, cm):
    """The numbers `transformer-mock.html` draws, to transformer-mock-data.json."""
    import json
    r3 = lambda t: [[round(float(x), 3) for x in row] for row in t]
    def enc_stages(sent):
        toks = ["[CLS]"] + sent.split() + ["[SEP]"]
        ids = torch.tensor([[A.ID[w] for w in toks]]); m = torch.ones_like(ids)
        with torch.no_grad():
            S = stages(base, ids, m)
            # the FFN's own output for block 1, per token, to show it is row-wise
            b = base.blocks[0]; h1 = b.n1(S[0][1] + b.att(S[0][1], m == 0))
            ffn = b.ff(h1)
            base.encode(ids, m); a1 = base.blocks[0].att.last[0]
        return {"tokens": toks, "stages": [{"name": n, "H": r3(h[0])} for n, h in S], "ffn1": r3(ffn[0]),
                "alpha1": [r3(a1[h]) for h in range(a1.shape[0])]}
    out = {"note": "slot 84 mock data (transformer-measure.py --export): the base = widget 83's model; the causal model; the DNA -> protein encoder-decoder",
           "encoder": [enc_stages(s) for s in ("planned discharge home today", "yellow discharge from wound",
                                              "treated with aspirin for chest pain", "no fever reported")]}
    # the causal model: its block-1 weights on the lesson's sentence, and generation fed back
    toks = ["[CLS]"] + "treated with aspirin for chest pain".split() + ["[SEP]"]
    ids = torch.tensor([[A.ID[w] for w in toks]]); m = torch.ones_like(ids)
    with torch.no_grad():
        cm.encode(ids, m, causal=True); ca = cm.blocks[0].att.last[0]
    steps = []; cur = [A.CLS] + [A.ID[w] for w in "treated with aspirin for".split()]
    with torch.no_grad():
        while len(cur) < 16:
            x = torch.tensor([cur]); h, _ = cm.encode(x, torch.ones_like(x), causal=True)
            p = cm.mlm(h[0, -1]).softmax(-1); top = p.topk(6)
            steps.append({"context": [A.VOCAB[i] for i in cur], "top": [[A.VOCAB[int(i)], round(float(v), 4)] for v, i in zip(top.values, top.indices)]})
            nxt = int(top.indices[0]); cur.append(nxt)
            if nxt == A.SEP: break
    # pretraining: MLM at [MASK] against causal after "treated with"
    mt = ["[CLS]"] + "treated with [MASK] for chest pain".split() + ["[SEP]"]
    x = torch.tensor([[A.ID[w] for w in mt]])
    with torch.no_grad():
        h, _ = base.encode(x, torch.ones_like(x)); pm = base.mlm(h[0, 3]).softmax(-1)
        x2 = torch.tensor([[A.ID[w] for w in ["[CLS]", "treated", "with"]]])
        h2, _ = cm.encode(x2, torch.ones_like(x2), causal=True); pc = cm.mlm(h2[0, -1]).softmax(-1)
        x3 = torch.tensor([[A.ID[w] for w in ["[CLS]", "treated", "with", "aspirin", "for"]]])
        h3, _ = cm.encode(x3, torch.ones_like(x3), causal=True); ps = cm.mlm(h3[0, -1]).softmax(-1)
    tk = lambda p: [[A.VOCAB[int(i)], round(float(v), 4)] for v, i in zip(p.topk(8).values, p.topk(8).indices)]
    out["decoder"] = {"tokens": toks, "alpha1": [r3(ca[h]) for h in range(ca.shape[0])], "generate": steps}
    out["pretrain"] = {"mlm_mask": tk(pm), "causal_after_with": tk(pc), "causal_after_for": tk(ps), "drugs_for_chest_pain": A.SYM_DRUG["chest pain"]}
    # cross-attention, DNA -> protein
    tr, te = dna_stage(20000, 0), dna_stage(300, 1)
    mdl = seq2seq("DNA -> protein (export)", tr, te, 5, 3 + len(AAS), lambda s, t: [[3 * r, 3 * r + 1, 3 * r + 2] for r in range(len(t))])
    rng = random.Random(5); cod = [rng.choice(SENSE) for _ in range(6)]
    src = [" ACGT".index(ch) for c in cod for ch in c]; tgt = [3 + AAS.index(CODE[c]) for c in cod]
    S = torch.tensor([src]); Ti = torch.tensor([[1] + tgt])
    with torch.no_grad(): mdl(S, S == 0, Ti, torch.zeros_like(Ti, dtype=torch.bool))
    out["cross"] = {"dna": "".join(cod), "codons": cod, "protein": [CODE[c] for c in cod],
                    "blocks": [[r3(b.cross.last[0, h]) for h in range(b.cross.last.shape[1])] for b in mdl.dec]}
    (here / "transformer-mock-data.json").write_text(json.dumps(out), encoding="utf-8", newline="\n")
    log("  wrote transformer-mock-data.json")

if __name__ == "__main__":
    if "--export" in sys.argv:
        corpus = A.make_corpus(0, 20000)
        base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, corpus, 3000, 0)
        torch.manual_seed(0); cm = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
        A.pretrain(cm, corpus, 3000, torch.Generator().manual_seed(0), causal=True)
        export(base, cm); sys.exit()
    parts = [a for a in sys.argv[1:] if a in ("E", "D", "P")] or ["E", "D", "P"]
    corpus = A.make_corpus(0, 20000); corpus_test = A.make_corpus(1, 2000)
    base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, corpus, 3000, 0)
    log(f"base pretrained (widget 83's model): MLM {A.mlm_accuracy(base, corpus_test, torch.Generator().manual_seed(3)):.1%}")
    if "E" in parts: part_E(base, corpus, corpus_test)
    cm = part_D1(corpus, corpus_test) if ("D" in parts or "P" in parts) else None
    if "D" in parts: part_D2()
    if "P" in parts: part_P(base, cm)
    log(f"\ntotal {time.time() - T0:.0f}s")
