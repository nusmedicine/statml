"""Planning measurement for the LANGUAGE ARC (PHM5005 08-1 Overview, 08-2
Clinical, 08-3 Biological), asked for on 2026-09-25: attention, the
transformer, clinical text through BERT to adaptation and Layer Integrated
Gradients, and protein sequences through a transformer built and a pretrained
one adapted to occlusion.

transformers, peft and captum are not installed on this machine, so every
model here is plain torch at toy scale: a tiny BERT (post-LN
nn.TransformerEncoderLayer, learned positions, as 08-3 cell 28 builds it)
pretrained by masked-token prediction on a synthetic clinical grammar, then
adapted four ways. LoRA and integrated gradients are written out by hand
(both are a few lines). The claims to test before any slot is proposed:

  A  ATTENTION. (1) alpha is not symmetric: q_i.k_j is not q_j.k_i. (2) the
     1/sqrt(d_k): without it, at d_k = 64, how peaked is softmax at init.
     (3) the padding mask: does the SAME sentence give the same logits
     padded to 12 and to 40, with and without src_key_padding_mask.
  B  PRETRAINING. (1) MLM against causal LM at the lesson's own example,
     "treated with [MASK] for chest pain": the drug is set by the symptom to
     its RIGHT, so a causal model at that position sees only the left.
     (2) contextual embeddings: "discharge" (home) and "discharge" (from a
     wound) are one row of the embedding table; after the encoder, how far
     apart, and does a linear probe separate them.
  C  ADAPTATION, the stage that has to lose in every direction (slot 63
     died on this for images): scratch, transfer (frozen), full fine-tuning,
     LoRA, at n = 16 . 64 . 256 . 1024, a FIXED number of steps (63's
     confound), three seeds; and forgetting, MLM accuracy after adapting.
  D  INTEGRATED GRADIENTS on the fine-tuned model: completeness at 5, 50
     and 300 steps; how often the lesson's clip (keep positive values)
     removes a negation word that pushed AGAINST the predicted class.
  E  PROTEINS. Two charged sites d residues apart, each flagged by a short
     motif; class = the charges are complementary. A 1D CNN with a global
     max and a LINEAR head (75's shape) against the same with an MLP head
     and against the lesson's one-layer TransformerModel, at d = 4 . 16 . 64.

Run:  python widgets/_lab/language-arc-measure.py [A B C D E]   (about 4 min)
      ... C --match     the drug-symptom mismatch target alone
      ... E --and       the co-occurrence label;  E --long  XOR at 6,000 steps

---------------------------------------------------------------------------
FINDINGS, 2026-09-25, torch 2.14 CPU. The grammar: 58 tokens, 20,000 notes
of one to three clauses (presented with, treated with <drug> for <symptom>,
no <symptom>, discharge home, discharge from a wound, recovered well or
deteriorated). The tiny BERT: D 48, 4 heads, FFN 96, 2 post-LN blocks,
46,716 parameters, pretrained 3,000 steps in 25 s, MLM 80% on held-out.

A1 alpha is not symmetric: at init the largest |alpha_ij - alpha_ji| in
   head 0 is 0.394.
A2 1/sqrt(d_k), ten keys, unit-variance q and k: the mean top weight is
   0.49 . 0.73 . 0.86 unscaled at d_k 4 . 16 . 64 (5% . 30% . 60% of rows
   above 0.9), and 0.31 . 0.32 . 0.32 scaled. The scale keeps the softmax's
   peakedness the same at every width; without it wide heads start one-hot.
A3 the padding mask: the same sentence padded to 12 and to 40 gives
   IDENTICAL logits with src_key_padding_mask (0.0) and logits 0.074 apart
   without it, where the real tokens put 78% of their weight on 32 PADs.
B1 the lesson's own MLM example HOLDS EXACTLY. "treated with [MASK] for
   <symptom>": a right drug for the symptom 100% from the MLM model, 17%
   from the causal model at that position (chance 20%), because the drug
   is set by the symptom to its RIGHT. "treated with <drug> for ___": the
   symptom 100% from both. Each objective reads its own direction.
B2 contextual embeddings HOLD: "discharge" home and "discharge" from a
   wound are ONE table row (cos of the sense means 0.996, a linear probe
   50%, position the only difference); after block 1 cos 0.786 and the
   probe 100%; after block 2 cos 0.688.
C  adaptation, 400 fixed steps of batch 16, test 1,000, three seeds, at
   n = 16 . 64 . 256 . 1024. Trainable: transfer 98 (the head), LoRA r 4
   on Q and V 1,634, full and scratch 46,716.
   - a target the pretrained features CARRY (outcome: an asserted finding,
     08-2's clinical_outcome): transfer 93 99 99 99, LoRA 92 97 100 100,
     full 88 96 99 100, scratch 87 95 100 100. Transfer wins at n = 16
     by 5 points and everything meets by 256. (The discharge-sense target
     is too easy: 96-100% for all four at every n.)
   - a target they DO NOT carry (match: a drug given for a symptom it does
     not treat; pretraining held only matched pairs, and a bag of words
     cannot pair them): transfer 50 51 55 51 at EVERY n, LoRA 50 58 71 76,
     full 51 59 81 86, scratch 51 54 79 84. Full wins with data, and
     pretraining is worth 2 points over scratch here.
   - so each of transfer and full wins somewhere, which is what slot 63's
     image stage could not show. LoRA sits between them. Scratch never wins
     outright. The gaps are modest and are to be tuned at the mock.
   - forgetting, MLM accuracy after adapting (80% before): full 76 72 67 65
     on outcome, LoRA 72 66 62 61 with the adapter on; transfer 80
     unchanged by construction. LoRA's W is untouched, so REMOVING the
     adapter returns 80% exactly; the lesson merges it (merge_and_unload).
   - [CLS] against the mean under transfer: an MLM-only backbone's [CLS]
     is not a trained summary (08-3 cell 4's own caveat): sense 91 95 97 96
     against 100, outcome 91 91 95 95 against 93 99 99 99.
   - LoRA rank on outcome: r 1 (482 trainable) 97% at n = 64, r 2 97%,
     r 8 (3,170) 95%; 100% at n = 1024 for all. Rank is not accuracy here.
D  integrated gradients from the [PAD] baseline at the word embeddings,
   a right Riemann sum, on a fully fine-tuned outcome model (120/120):
   completeness |sum(attr) - (f(x) - f(PAD))| median 0.81 . 0.067 . 0.011
   at 5 . 50 . 300 steps (captum's default is 50, Gauss-Legendre, which
   converges faster than this sum). In 52 of 120 two-clause notes holding
   "no", "no" pushed AGAINST the predicted class, and 08-2 cell 72's clip
   at zero prints it as no contribution.
E  proteins, 120 residues, two charged sites flagged by GWP- and YCW-,
   d apart. XOR (complementary charges): CNN + linear and CNN + MLP 100% at
   d = 4, 50% at d = 16 and 64; the one-layer transformer 48-51% at every
   d, at 1,500 AND 6,000 steps. AND (site 1 positive and site 2 negative):
   CNN + linear 100% at d = 4 and 64, CNN + MLP 99-100%, the transformer
   70% and 65%. So 08-3 cell 1's table (CNN: long-distance relations No,
   transformer Yes) does NOT hold on this stage: a global max carries the
   co-occurrence of two distant motifs into a linear head at any distance,
   and a transformer trained from scratch on 2,000 sequences is the harder
   model to train. What a CNN's global max cannot see is the PAIR's
   arrangement; XOR needs the two sites in one window. Parity is hard for
   everything in this budget, so E is not yet a stage for a widget.
"""
import math, random, sys, time
import torch, torch.nn as nn, torch.nn.functional as F

torch.set_num_threads(8)
T0 = time.time()
def log(*a):
    print(*a, flush=True)

# ---------------------------------------------------------------- the grammar
SYM_DRUG = {  # a symptom and the drugs that treat it
    "chest pain": ["aspirin", "nitrate"],
    "fever": ["paracetamol", "ibuprofen"],
    "infection": ["antibiotics", "cefazolin"],
    "breathlessness": ["salbutamol", "oxygen"],
    "nausea": ["ondansetron", "metoclopramide"],
}
SYMS = list(SYM_DRUG)
DRUGS = sorted({d for v in SYM_DRUG.values() for d in v})
WORDS = ("patient was admitted presented with and treated managed for no "
         "on exam reported planned ready discharge home to rehab today "
         "tomorrow yellow purulent clear from wound ear eye recovered well "
         "deteriorated overnight required ventilation stable remained . "
         "chest pain fever infection breathlessness nausea").split()
SPECIAL = ["[PAD]", "[CLS]", "[SEP]", "[MASK]", "[UNK]"]
VOCAB = SPECIAL + sorted(set(WORDS + DRUGS))
ID = {w: i for i, w in enumerate(VOCAB)}
PAD, CLS, SEP, MASK = 0, 1, 2, 3
V = len(VOCAB)
L = 32

def sym_words(s): return s.split()

def clause(rng, kind=None):
    """One clause. Returns (tokens, facts) where facts records what the
    clause asserts: findings (asserted, negated), the discharge sense."""
    k = kind or rng.choice(["present", "treat", "neg", "dhome", "dwound", "course"])
    f = {"asserted": [], "negated": [], "sense": None, "drug_pos": None}
    if k == "present":
        a, b = rng.sample(SYMS, 2)
        t = ["patient", rng.choice(["presented", "was"]), "with"] + sym_words(a)
        if rng.random() < 0.5: t += ["and"] + sym_words(b); f["asserted"] += [a, b]
        else: f["asserted"] += [a]
    elif k == "treat":
        s = rng.choice(SYMS); d = rng.choice(SYM_DRUG[s])
        t = [rng.choice(["treated", "managed"]), "with", d, "for"] + sym_words(s)
        f["drug_pos"] = 2; f["asserted"] += [s]
    elif k == "neg":
        s = rng.choice(SYMS)
        t = ["no"] + sym_words(s) + [rng.choice(["on", "reported"])]
        if t[-1] == "on": t += ["exam"]
        f["negated"] += [s]
    elif k == "dhome":
        t = [rng.choice(["planned", "ready"]), "discharge", rng.choice(["home", "to"])]
        if t[-1] == "to": t += ["rehab"]
        t += [rng.choice(["today", "tomorrow"])]
        f["sense"] = "home"
    elif k == "dwound":
        t = [rng.choice(["yellow", "purulent", "clear"]), "discharge", "from",
             rng.choice(["wound", "ear", "eye"])]
        f["sense"] = "wound"; f["asserted"] += ["discharge"]
    else:  # course
        if rng.random() < 0.5:
            t = ["patient", "recovered", "well"];
        else:
            t = ["patient", "deteriorated", "overnight"]; f["asserted"] += ["deteriorated"]
    return t, f

def note(rng, n=None, kinds=None):
    n = n or rng.choice([1, 2, 3])
    toks, facts = [], {"asserted": [], "negated": [], "senses": []}
    for i in range(n):
        t, f = clause(rng, kinds[i] if kinds else None)
        if toks: toks.append(".")
        toks += t
        facts["asserted"] += f["asserted"]; facts["negated"] += f["negated"]
        if f["sense"]: facts["senses"].append(f["sense"])
    return toks, facts

def encode(toks, Lpad=L):
    ids = [CLS] + [ID[w] for w in toks] + [SEP]
    ids = ids[:Lpad]
    m = [1] * len(ids) + [0] * (Lpad - len(ids))
    return ids + [PAD] * (Lpad - len(ids)), m

def batchify(seqs, Lpad=L):
    ids, ms = zip(*[encode(s, Lpad) for s in seqs])
    return torch.tensor(ids), torch.tensor(ms)

# ---------------------------------------------------------------- the model
class LoRALinear(nn.Module):
    """W' = W + (alpha/r) B A, W frozen (08-1 cell 15's A B^T, with peft's
    alpha/r scaling that the lesson's formula leaves out)."""
    def __init__(self, W, b, r, alpha):
        super().__init__()
        self.W = nn.Parameter(W.detach().clone(), requires_grad=False)
        self.b = nn.Parameter(b.detach().clone(), requires_grad=False)
        d_out, d_in = W.shape
        self.A = nn.Parameter(torch.randn(r, d_in) / math.sqrt(d_in))
        self.B = nn.Parameter(torch.zeros(d_out, r))
        self.s = alpha / r
    def forward(self, x):
        return F.linear(x, self.W + self.s * self.B @ self.A, self.b)

class MHA(nn.Module):
    """Multi-head self-attention written out, so LoRA can sit on Q and V and
    the weights can be read."""
    def __init__(self, D, H):
        super().__init__()
        self.D, self.H, self.dk = D, H, D // H
        self.q, self.k, self.v, self.o = (nn.Linear(D, D) for _ in range(4))
        self.last = None
    def forward(self, x, pad_mask=None, causal=False, scale=True):
        B_, L_, D = x.shape
        sh = lambda t: t.view(B_, L_, self.H, self.dk).transpose(1, 2)
        q, k, v = sh(self.q(x)), sh(self.k(x)), sh(self.v(x))
        s = q @ k.transpose(-1, -2)
        if scale: s = s / math.sqrt(self.dk)
        if pad_mask is not None:
            s = s.masked_fill(pad_mask[:, None, None, :], float("-inf"))
        if causal:
            cm = torch.triu(torch.ones(L_, L_, dtype=torch.bool), 1)
            s = s.masked_fill(cm, float("-inf"))
        a = s.softmax(-1)
        self.last = a
        z = (a @ v).transpose(1, 2).reshape(B_, L_, D)
        return self.o(z)

class Block(nn.Module):  # post-LN, as nn.TransformerEncoderLayer's default
    def __init__(self, D, H, Fh, p=0.1):
        super().__init__()
        self.att = MHA(D, H); self.n1 = nn.LayerNorm(D); self.n2 = nn.LayerNorm(D)
        self.ff = nn.Sequential(nn.Linear(D, Fh), nn.ReLU(), nn.Linear(Fh, D))
        self.dp = nn.Dropout(p)
    def forward(self, x, pad_mask=None, causal=False):
        x = self.n1(x + self.dp(self.att(x, pad_mask, causal)))
        return self.n2(x + self.dp(self.ff(x)))

class TinyBERT(nn.Module):
    def __init__(self, V, D=48, H=4, Fh=96, N=2, Lmax=64, classes=2):
        super().__init__()
        self.tok = nn.Embedding(V, D, padding_idx=PAD)
        self.pos = nn.Embedding(Lmax, D)
        self.blocks = nn.ModuleList(Block(D, H, Fh) for _ in range(N))
        self.mlm = nn.Linear(D, V)
        self.head = nn.Linear(D, classes)
    def embed(self, ids):
        P = torch.arange(ids.shape[1])[None]
        return self.tok(ids) + self.pos(P)
    def encode(self, ids, m, causal=False, x=None, use_mask=True):
        h = self.embed(ids) if x is None else x
        pm = (m == 0) if use_mask else None
        hs = [h]
        for b in self.blocks:
            h = b(h, pm, causal); hs.append(h)
        return h, hs
    def classify(self, ids, m, pool="mean", x=None):
        h, _ = self.encode(ids, m, x=x)
        if pool == "cls": z = h[:, 0]
        else:
            mm = m[..., None].float(); z = (h * mm).sum(1) / mm.sum(1).clamp(min=1)
        return self.head(z)

def mask_tokens(ids, m, g, rate=0.15):
    """08-1 cell 4: replace 15% with [MASK] (the lesson's version; BERT's own
    80/10/10 split is noted, not used)."""
    cand = (m == 1) & (ids != CLS) & (ids != SEP)
    r = torch.rand(ids.shape, generator=g)
    sel = cand & (r < rate)
    x = ids.clone(); x[sel] = MASK
    y = torch.full_like(ids, -100); y[sel] = ids[sel]
    return x, y

def pretrain(model, corpus, steps, g, causal=False, lr=1e-3, bs=64):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    for s in range(steps):
        idx = torch.randint(len(corpus), (bs,), generator=g)
        ids, m = batchify([corpus[i] for i in idx])
        if causal:  # predict token t+1 from positions <= t
            h, _ = model.encode(ids, m, causal=True)
            logits = model.mlm(h[:, :-1]); y = ids[:, 1:].clone(); y[m[:, 1:] == 0] = -100
        else:
            x, y = mask_tokens(ids, m, g)
            h, _ = model.encode(x, m)
            logits = model.mlm(h)
        loss = F.cross_entropy(logits.reshape(-1, V), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()
    model.eval()
    return loss.item()

def mlm_accuracy(model, corpus, g, n=2000):
    ids, m = batchify(corpus[:n]); x, y = mask_tokens(ids, m, g)
    with torch.no_grad():
        h, _ = model.encode(x, m); p = model.mlm(h).argmax(-1)
    sel = y != -100
    return (p[sel] == y[sel]).float().mean().item()

# ================================================================ A attention
def part_A():
    log("\n== A  ATTENTION ==")
    g = torch.Generator().manual_seed(0)
    # A2 the scale, at init-like unit-variance q and k
    for dk in (4, 16, 64):
        q = torch.randn(5000, 1, dk, generator=g); k = torch.randn(5000, 10, dk, generator=g)
        s = (q * k).sum(-1)
        raw = s.softmax(-1).max(-1).values.mean().item()
        sc = (s / math.sqrt(dk)).softmax(-1).max(-1).values.mean().item()
        # share of rows where the top weight exceeds 0.9
        raw9 = (s.softmax(-1).max(-1).values > 0.9).float().mean().item()
        log(f"  A2 d_k={dk:3d}: 10 keys, mean top weight  unscaled {raw:.3f}"
            f" ({raw9:.0%} of rows >0.9)   scaled {sc:.3f}   (uniform 0.100)")
    # A1 asymmetry, and A3 the padding mask, on a fresh tiny model
    torch.manual_seed(1)
    mdl = TinyBERT(V).eval()
    sent = "treated with aspirin for chest pain".split()
    ids12, m12 = batchify([sent], 12); ids40, m40 = batchify([sent], 40)
    with torch.no_grad():
        mdl.encode(ids12, m12)
        a = mdl.blocks[0].att.last[0, 0, :8, :8]
        asym = (a - a.T).abs().max().item()
        z12 = mdl.classify(ids12, m12); z40 = mdl.classify(ids40, m40)
        z12n = mdl.classify(ids12, m12, x=None) if False else None
        # without the mask: attention over PAD, mean over real tokens only
        def nomask(ids, m):
            h, _ = mdl.encode(ids, m, use_mask=False)
            mm = m[..., None].float(); return mdl.head((h * mm).sum(1) / mm.sum(1))
        u12, u40 = nomask(ids12, m12), nomask(ids40, m40)
        # how much weight real tokens put on PAD with no mask
        mdl.encode(ids40, m40, use_mask=False)
        onpad = mdl.blocks[0].att.last[0, :, :8, 8:].sum(-1).mean().item()
    log(f"  A1 at init, head 0: largest |alpha_ij - alpha_ji| = {asym:.3f}")
    log(f"  A3 same sentence padded to 12 and 40: logit change with the mask "
        f"{(z12 - z40).abs().max().item():.2e}, without {(u12 - u40).abs().max().item():.3f};"
        f" with no mask the real tokens put {onpad:.0%} of their weight on 32 PADs")

# ============================================================== B pretraining
def make_corpus(seed, n):
    rng = random.Random(seed)
    return [note(rng)[0] for _ in range(n)]

def part_B(corpus, test):
    log("\n== B  PRETRAINING ==")
    out = {}
    for causal in (False, True):
        torch.manual_seed(0); g = torch.Generator().manual_seed(0)
        mdl = TinyBERT(V)
        t = time.time(); loss = pretrain(mdl, corpus, 3000, g, causal=causal)
        out[causal] = mdl
        log(f"  {'causal' if causal else 'MLM   '} pretrained 3000 steps in {time.time()-t:.0f}s, last loss {loss:.3f}")
    # B1: the drug slot in "treated with ___ for <symptom>"
    rng = random.Random(7); rows = []
    for _ in range(600):
        t, f = clause(rng, "treat"); rows.append(t)
    ids, m = batchify(rows)
    pos = 1 + 2  # [CLS] treated with DRUG
    with torch.no_grad():
        x = ids.clone(); x[:, pos] = MASK
        h, _ = out[False].encode(x, m); p = out[False].mlm(h)[:, pos].argmax(-1)
        mlm_acc = (p == ids[:, pos]).float().mean().item()
        # right drug for the symptom (either of its two) is the fair score
        def ok(pred):
            good = 0
            for i, r in enumerate(rows):
                s = " ".join(r[4:]); good += VOCAB[pred[i]] in SYM_DRUG[s]
            return good / len(rows)
        mlm_ok = ok(p)
        h2, _ = out[True].encode(ids, m, causal=True)
        pc = out[True].mlm(h2)[:, pos - 1].argmax(-1)   # predicts position pos
        causal_ok = ok(pc)
        # the lesson's decoder example: "treated with aspirin for" -> symptom
        ps = out[True].mlm(h2)[:, pos + 1].argmax(-1)   # predicts first symptom word
        first = [ID[r[4]] for r in rows]
        causal_sym = (ps == torch.tensor(first)).float().mean().item()
        x2 = ids.clone(); x2[:, pos + 2] = MASK
        h3, _ = out[False].encode(x2, m); pm = out[False].mlm(h3)[:, pos + 2].argmax(-1)
        mlm_sym = (pm == torch.tensor(first)).float().mean().item()
    log(f"  B1 'treated with [MASK] for <symptom>': a right drug  MLM {mlm_ok:.0%}  causal {causal_ok:.0%}"
        f"  (chance {2/len(DRUGS):.0%})")
    log(f"     'treated with <drug> for ___': the symptom  causal {causal_sym:.0%}  MLM {mlm_sym:.0%}  (chance {1/len(SYMS):.0%})")
    # B2: contextual embeddings of "discharge"
    rng = random.Random(9); rows, sense = [], []
    for _ in range(400):
        k = rng.choice(["dhome", "dwound"])
        kinds = [rng.choice(["present", "treat", "neg", "course"]), k] if rng.random() < 0.5 else [k]
        t, f = note(rng, len(kinds), kinds); rows.append(t); sense.append(k == "dwound")
    ids, m = batchify(rows); y = torch.tensor(sense).long()
    dpos = (ids == ID["discharge"]).float().argmax(1)
    mdl = out[False]
    with torch.no_grad():
        _, hs = mdl.encode(ids, m)
        for li, h in enumerate(hs):
            v = h[torch.arange(len(rows)), dpos]
            v0 = mdl.tok.weight[ID["discharge"]]
            vt = v - v.mean(0)
            a, b = F.normalize(vt[y == 0].mean(0), dim=0), F.normalize(vt[y == 1].mean(0), dim=0)
            # a linear probe, trained on half, scored on the other half
            probe = nn.Linear(v.shape[1], 2); opt = torch.optim.Adam(probe.parameters(), 1e-2)
            with torch.enable_grad():
                for _ in range(300):
                    l = F.cross_entropy(probe(v[:200]), y[:200]); opt.zero_grad(); l.backward(); opt.step()
            acc = (probe(v[200:]).argmax(-1) == y[200:]).float().mean().item()
            cos = F.cosine_similarity(v[y == 0].mean(0), v[y == 1].mean(0), dim=0).item()
            name = "token + position" if li == 0 else f"after block {li}"
            log(f"  B2 'discharge' {name:17s}: cos(home mean, wound mean) {cos:.3f}   probe on held-out {acc:.0%}")
    log(f"     (the table row alone is ONE vector for both senses; layer 0 differs only by position)")
    return out[False]

# ============================================================== C adaptation
def outcome_label(facts):
    """08-2's clinical_outcome: 1 when an abnormal finding is asserted."""
    return int(len(facts["asserted"]) > 0)

def make_task(seed, n, task):
    rng = random.Random(seed); X, Y = [], []
    while len(X) < n:
        if task == "outcome":
            t, f = note(rng); X.append(t); Y.append(outcome_label(f))
        elif task == "match":
            # a drug given for a symptom it does not treat (1) or one it does
            # (0); the pretraining corpus holds only matched pairs, and a bag
            # of words cannot pair a drug with its symptom
            s = rng.choice(SYMS); bad = rng.random() < 0.5
            d = rng.choice([x for x in DRUGS if x not in SYM_DRUG[s]] if bad else SYM_DRUG[s])
            t = [rng.choice(["treated", "managed"]), "with", d, "for"] + sym_words(s)
            other = note(rng, rng.choice([0, 1, 2]) or 1)[0] if rng.random() < 0.7 else []
            t = (other + ["."] + t) if other and rng.random() < 0.5 else (t + ["."] + other if other else t)
            X.append(t); Y.append(int(bad))
        else:  # sense of discharge, the word in every row
            k = rng.choice(["dhome", "dwound"])
            kinds = [rng.choice(["present", "treat", "neg", "course"]), k]
            rng.shuffle(kinds)
            t, f = note(rng, 2, kinds); X.append(t); Y.append(int(k == "dwound"))
    return X, Y

def adapt(base, strategy, X, Y, steps, seed, r=4, pool="mean"):
    torch.manual_seed(seed)
    if strategy == "scratch":
        mdl = TinyBERT(V)
    else:
        mdl = TinyBERT(V); mdl.load_state_dict(base.state_dict())
        mdl.head.reset_parameters()
    params = list(mdl.parameters()); lr = 1e-3
    if strategy == "transfer":
        for p in mdl.parameters(): p.requires_grad = False
        for p in mdl.head.parameters(): p.requires_grad = True
        params = list(mdl.head.parameters()); lr = 5e-3
    elif strategy == "full":
        lr = 1e-4 * 3
    elif strategy == "lora":
        for p in mdl.parameters(): p.requires_grad = False
        for b in mdl.blocks:
            b.att.q = LoRALinear(b.att.q.weight, b.att.q.bias, r, 2 * r)
            b.att.v = LoRALinear(b.att.v.weight, b.att.v.bias, r, 2 * r)
        for p in mdl.head.parameters(): p.requires_grad = True
        params = [p for p in mdl.parameters() if p.requires_grad]; lr = 1e-3
    ntrain = sum(p.numel() for p in params)
    opt = torch.optim.Adam(params, lr=lr)
    g = torch.Generator().manual_seed(seed)
    ids, m = batchify(X); y = torch.tensor(Y)
    mdl.train()
    for s in range(steps):
        idx = torch.randint(len(X), (min(16, len(X)),), generator=g)
        loss = F.cross_entropy(mdl.classify(ids[idx], m[idx], pool), y[idx])
        opt.zero_grad(); loss.backward(); opt.step()
    mdl.eval()
    return mdl, ntrain

def score(mdl, X, Y, pool="mean"):
    ids, m = batchify(X)
    with torch.no_grad():
        return (mdl.classify(ids, m, pool).argmax(-1) == torch.tensor(Y)).float().mean().item()

def part_C(base, corpus_test):
    log("\n== C  ADAPTATION  (fixed 400 steps of batch 16; test 1,000; 3 seeds) ==")
    total = sum(p.numel() for p in TinyBERT(V).parameters())
    log(f"  the tiny BERT: {total:,} parameters")
    g = torch.Generator().manual_seed(3)
    base_mlm = mlm_accuracy(base, corpus_test, g)
    log(f"  pretrained MLM accuracy on held-out notes: {base_mlm:.0%}")
    results = {}
    for task in TASKS:
        Xt, Yt = make_task(999, 1000, task)
        log(f"  task '{task}' (positives {sum(Yt)/len(Yt):.0%} of test)")
        for strat in ("scratch", "transfer", "full", "lora"):
            row, fg, ntr = [], [], 0
            for n in (16, 64, 256, 1024):
                accs, forg = [], []
                for seed in range(3):
                    X, Y = make_task(100 + seed, n, task)
                    mdl, ntr = adapt(base, strat, X, Y, 400, seed)
                    accs.append(score(mdl, Xt, Yt))
                    if strat != "scratch":
                        forg.append(mlm_accuracy(mdl, corpus_test, torch.Generator().manual_seed(3)))
                row.append(sum(accs) / 3); fg.append(sum(forg) / 3 if forg else float("nan"))
                results[(task, strat, n)] = accs
            log(f"    {strat:8s} trains {ntr:6,}: acc " + "  ".join(f"{a:.0%}" for a in row)
                + "   MLM after " + "  ".join("  -" if f != f else f"{f:.0%}" for f in fg)
                + f"   ({time.time()-T0:.0f}s)")
    if TASKS != ("sense", "outcome"): return results
    # transfer with the [CLS] state of an MLM-only backbone (no NSP), not the mean
    for task in ("sense", "outcome"):
        Xt, Yt = make_task(999, 1000, task); row = []
        for n in (16, 64, 256, 1024):
            accs = []
            for seed in range(3):
                X, Y = make_task(100 + seed, n, task)
                mdl, _ = adapt(base, "transfer", X, Y, 400, seed, pool="cls")
                accs.append(score(mdl, Xt, Yt, pool="cls"))
            row.append(sum(accs) / 3)
        log(f"    transfer, [CLS] not mean, task {task}: " + "  ".join(f"{a:.0%}" for a in row))
    # LoRA rank
    Xt, Yt = make_task(999, 1000, "outcome")
    for r in (1, 2, 8):
        row = []
        for n in (64, 1024):
            accs = []
            for seed in range(3):
                X, Y = make_task(100 + seed, n, "outcome")
                mdl, ntr = adapt(base, "lora", X, Y, 400, seed, r=r)
                accs.append(score(mdl, Xt, Yt))
            row.append(sum(accs) / 3)
        log(f"    LoRA r={r}: trains {ntr:,}, outcome acc at n=64 {row[0]:.0%}, n=1024 {row[1]:.0%}")
    return results

# ============================================================== D integrated gradients
def part_D(base):
    log("\n== D  INTEGRATED GRADIENTS (on a fully fine-tuned outcome model) ==")
    X, Y = make_task(500, 1024, "outcome")
    mdl, _ = adapt(base, "full", X, Y, 800, 0)
    rng = random.Random(11); rows = []
    for _ in range(300):
        kinds = rng.sample(["present", "neg", "dhome", "dwound", "course", "treat"], 2)
        if "neg" not in kinds: kinds[0] = "neg"
        t, f = note(rng, 2, kinds); rows.append((t, outcome_label(f)))
    def ig(ids, m, target, steps):
        x = mdl.embed(ids).detach()
        base_ids = torch.full_like(ids, PAD); xb = mdl.embed(base_ids).detach()
        # LayerIntegratedGradients on the word embeddings: the baseline is
        # input_ids of 0 = [PAD] at every position; positions still added
        tokx = mdl.tok(ids).detach(); tokb = mdl.tok(base_ids).detach(); posx = x - tokx
        tot = torch.zeros_like(tokx)
        for k in range(1, steps + 1):  # right Riemann sum
            a = k / steps
            e = (tokb + a * (tokx - tokb)).requires_grad_(True)
            out = mdl.classify(ids, m, x=e + posx)[0, target]
            gr, = torch.autograd.grad(out, e); tot += gr
        attr = ((tokx - tokb) * tot / steps).sum(-1)[0]
        with torch.no_grad():
            fx = mdl.classify(ids, m, x=tokx + posx)[0, target]
            fb = mdl.classify(ids, m, x=tokb + posx)[0, target]
        return attr, (attr.sum() - (fx - fb)).item()
    deltas = {5: [], 50: [], 300: []}; hidden = neg_rows = 0; correct = 0
    for t, yv in rows[:120]:
        ids, m = batchify([t]); ids, m = ids[:, : len(t) + 2], m[:, : len(t) + 2]
        with torch.no_grad(): pred = mdl.classify(ids, m).argmax(-1).item()
        correct += pred == yv
        for st in deltas:
            attr, d = ig(ids, m, pred, st); deltas[st].append(abs(d))
        no_at = [i + 1 for i, w in enumerate(t) if w == "no"]
        if no_at:
            neg_rows += 1
            if any(attr[i] < 0 for i in no_at):
                hidden += 1
                if hidden <= 3:
                    toks = ["[CLS]"] + t + ["[SEP]"]
                    log(f"  e.g. predicted {pred}: " + " ".join(f"{w}:{a:+.2f}" for w, a in zip(toks, attr.tolist())))
    log(f"  the model: {correct}/120 of these notes right")
    for st, v in deltas.items():
        v = sorted(v); log(f"  completeness |sum(attr) - (f(x) - f(PAD))| at {st:3d} steps: median {v[len(v)//2]:.4f}, worst {v[-1]:.4f}")
    log(f"  'no' pushed AGAINST the predicted class in {hidden}/{neg_rows} notes: the lesson's clip at 0 shows it as zero")

# ============================================================== E proteins
AA = "ACDEFGHIKLMNPQRSTVWY"
POS_AA, NEG_AA = "KR", "DE"
def protein(rng, d, Lp=120):
    s = [rng.choice(AA) for _ in range(Lp)]
    i = rng.randrange(4, Lp - d - 8)
    j = i + d
    c1 = rng.random() < 0.5; c2 = rng.random() < 0.5
    s[i - 3:i] = list("GWP"); s[i] = rng.choice(POS_AA if c1 else NEG_AA)
    s[j - 3:j] = list("YCW"); s[j] = rng.choice(POS_AA if c2 else NEG_AA)
    lab = int(c1 and not c2) if LABEL == "and" else int(c1 != c2)
    return "".join(s), lab

class CNN(nn.Module):
    def __init__(self, mlp=False, E=16, C=32, k=8):
        super().__init__()
        self.e = nn.Embedding(21, E, padding_idx=0)
        self.c1 = nn.Conv1d(E, C, k, padding=k // 2, bias=False)
        self.c2 = nn.Conv1d(C, C, 5, padding=2, bias=False)
        self.h = nn.Sequential(nn.Linear(C, 32), nn.ReLU(), nn.Linear(32, 2)) if mlp else nn.Linear(C, 2)
    def forward(self, ids, m):
        x = self.e(ids).transpose(1, 2)
        x = F.max_pool1d(F.relu(self.c1(x)), 2)
        x = F.relu(self.c2(x)).amax(-1)
        return self.h(x)

class ProtTransformer(nn.Module):  # 08-3 cell 28, smaller
    def __init__(self, D=32, H=2, Fh=64, Lmax=130):
        super().__init__()
        self.tok = nn.Embedding(21, D, padding_idx=0); self.pos = nn.Embedding(Lmax, D)
        self.enc = nn.TransformerEncoder(nn.TransformerEncoderLayer(D, H, Fh, 0.1, batch_first=True), 1)
        self.cls = nn.Linear(D, 2)
    def forward(self, ids, m):
        x = self.tok(ids) + self.pos(torch.arange(ids.shape[1])[None])
        h = self.enc(x, src_key_padding_mask=(m == 0))
        mm = m[..., None].float(); return self.cls((h * mm).sum(1) / mm.sum(1))

LABEL, E_STEPS, E_DS = "xor", 1500, (4, 16, 64)
def part_E():
    log("\n== E  PROTEINS (two flagged charged sites d apart; class = complementary) ==")
    aid = {a: i + 1 for i, a in enumerate(AA)}
    def data(seed, n, d):
        rng = random.Random(seed); S, Y = zip(*[protein(rng, d) for _ in range(n)])
        ids = torch.tensor([[aid[c] for c in s] for s in S]); return ids, torch.ones_like(ids), torch.tensor(Y)
    log(f"  label {LABEL}, {E_STEPS} steps")
    for d in E_DS:
        tr = data(1, 2000, d); te = data(2, 1000, d); line = []
        for name, mk in (("CNN+linear", lambda: CNN(False)), ("CNN+MLP", lambda: CNN(True)),
                         ("transformer", lambda: ProtTransformer())):
            accs = []
            for seed in range(2):
                torch.manual_seed(seed); net = mk(); opt = torch.optim.Adam(net.parameters(), 1e-3)
                g = torch.Generator().manual_seed(seed); net.train()
                for s in range(E_STEPS):
                    idx = torch.randint(2000, (32,), generator=g)
                    loss = F.cross_entropy(net(tr[0][idx], tr[1][idx]), tr[2][idx])
                    opt.zero_grad(); loss.backward(); opt.step()
                net.eval()
                with torch.no_grad(): accs.append((net(te[0], te[1]).argmax(-1) == te[2]).float().mean().item())
            line.append(f"{name} {sum(accs)/2:.0%}")
        log(f"  d = {d:3d}: " + "   ".join(line) + f"   ({time.time()-T0:.0f}s)")

TASKS = ("sense", "outcome")
if __name__ == "__main__":
    if "--match" in sys.argv: sys.argv.remove("--match"); TASKS = ("match",)
    if "--and" in sys.argv: sys.argv.remove("--and"); LABEL, E_DS = "and", (4, 64)
    if "--long" in sys.argv: sys.argv.remove("--long"); E_STEPS, E_DS = 6000, (4, 16)
    parts = sys.argv[1:] or ["A", "B", "C", "D", "E"]
    corpus = make_corpus(0, 20000); corpus_test = make_corpus(1, 2000)
    log(f"vocabulary {V} tokens; corpus 20,000 notes, e.g. {' '.join(corpus[0])!r}")
    if "A" in parts: part_A()
    base = None
    if any(p in parts for p in "BCD"): base = part_B(corpus, corpus_test)
    if "C" in parts: part_C(base, corpus_test)
    if "D" in parts: part_D(base)
    if "E" in parts: part_E()
    log(f"\ntotal {time.time()-T0:.0f}s")
