"""Generates `widgets/transformer/weights.js`, the three trained models widget
84 reads, and `_lab/transformer-reference.json`, what torch computes from them
on every input the widget draws, which `transformer-verify.mjs` holds the JS
forward to.

The models, trained exactly as `transformer-measure.py` trains them:
  base    the language arc's tiny BERT (D 48, 4 heads of 12, FFN 96, 2 post-LN
          blocks), masked-token pretraining, 3,000 steps, seed 0 -- the SAME
          instance widget 83 reads block 1 of. Encoder and Pre-training pages.
  causal  the same size, next-token pretraining on ONE-CLAUSE notes, 3,000
          steps, seed 0, so its end token follows a clause and greedy
          generation stops there by itself, as 10-3 generates until <eos>
          (his question, 2026-09-30, `transformer-eos-measure.py`: from the
          lesson's prompt "chest pain" then the end token; 300 of 300 samples
          end at it). Ids 1 and 2 are its start and end tokens and its own
          vocabulary names them [BOS] and [EOS] (VOCABS.causal); the encoder's
          names the same ids [CLS] and [SEP]. The Decoder page.
  dna     a tiny encoder-decoder (D 48, 4 heads, 2 + 2 blocks), DNA -> protein
          (3-8 codons, stops excluded), 3,000 steps, seed 0. Decoder page's
          cross-attention.
  tag     a head on the FROZEN base: Linear(48 -> 4) over its final vectors,
          a tag for every token (other, drug, finding, negated finding),
          trained on 3,000 tagged notes (seed 101), Adam 1e-2, 1,500 steps,
          seed 0 -- exactly as `transformer-task-measure.py` K1 trains it,
          which scored 99.5% on 1,000 held-out notes. The Encoder page's
          Prediction phase, Task Tokens (his pick, 2026-09-30).
  cls     a head on the same frozen base's final [CLS] row: Linear(48 -> 2),
          negative / positive (08-2's clinical_outcome: an abnormal finding
          asserted), the same 3,000 notes and training -- as
          `transformer-task-measure.py` K3, 98.0% held out (79.0% from the
          [CLS] row before attention, the share of positive notes). Task
          Sentence (his pick, 2026-09-30).
Each is stored as float32 in base64 (widget 75's form), one string a model,
its tensors in the order `SPEC` lists them, torch's layout (weight[out][in]).

Run:  python widgets/_lab/transformer-weights.py      (about 2 min)
A GENERATED FILE: regenerate after any change to the grammar, the models or
the training, then run `node widgets/_lab/transformer-verify.mjs`.
"""
import base64, importlib.util, json, random
from pathlib import Path
import numpy as np
import torch

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("tm", here / "transformer-measure.py")
TM = importlib.util.module_from_spec(spec); spec.loader.exec_module(TM)
A, AM = TM.A, TM.AM

LPOS = 16          # positions kept for the clinical models (the longest context is 10)
LSRC, LTGT = 24, 9 # the DNA model's source (8 codons) and target (8 + [BOS]) positions

# ---------------------------------------------------------------- train
corpus = A.make_corpus(0, 20000)
base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, corpus, 3000, 0)
rng1 = random.Random(0); corpus1 = [A.note(rng1, 1)[0] for _ in range(20000)]
torch.manual_seed(0); causal = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
A.pretrain(causal, corpus1, 3000, torch.Generator().manual_seed(0), causal=True)
CAUSAL_VOCAB = ["[BOS]" if w == "[CLS]" else "[EOS]" if w == "[SEP]" else w for w in A.VOCAB]
dna = TM.seq2seq("DNA -> protein", TM.dna_stage(20000, 0), TM.dna_stage(300, 1), 5, 3 + len(TM.AAS),
                 lambda s, t: [[3 * r, 3 * r + 1, 3 * r + 2] for r in range(len(t))])
for m in (base, causal, dna): m.eval()

# the tag head, on the frozen base's final vectors (transformer-task-measure.py K1)
TAGS = ["other", "drug", "finding", "negated"]
def tagged_note(rng):
    n = rng.choice([1, 2, 3]); toks, tags, asserted = [], [], []
    sym = set(w for s in A.SYMS for w in s.split())
    for i in range(n):
        k = rng.choice(["present", "treat", "neg", "dhome", "dwound", "course"])
        t, f = A.clause(rng, k)
        asserted += f["asserted"]
        if toks: toks.append("."); tags.append(0)
        for w in t:
            if w in A.DRUGS: tags.append(1)
            elif w in sym: tags.append(3 if k == "neg" else 2)
            elif w == "discharge" and k == "dwound": tags.append(2)
            else: tags.append(0)
        toks += t
    return toks, tags, int(len(asserted) > 0)
rng = random.Random(101); tagged = [tagged_note(rng) for _ in range(3000)]
with torch.no_grad():
    ids, msk = A.batchify([t for t, _, _ in tagged]); hfin, _ = base.encode(ids, msk)
X = torch.stack([hfin[i, j + 1] for i, (t, _, _) in enumerate(tagged) for j in range(len(t))])
Y = torch.tensor([g for _, tg, _ in tagged for g in tg])
torch.manual_seed(0); tag = torch.nn.Linear(48, len(TAGS)); opt = torch.optim.Adam(tag.parameters(), 1e-2)
for _ in range(1500):
    loss = torch.nn.functional.cross_entropy(tag(X), Y); opt.zero_grad(); loss.backward(); opt.step()
tag.eval()
# the sentence head, on the same notes' final [CLS] rows (transformer-task-measure.py K3)
CLASSES = ["negative", "positive"]
torch.manual_seed(0); cls = torch.nn.Linear(48, 2); opt = torch.optim.Adam(cls.parameters(), 1e-2)
Xc, Yc = hfin[:, 0].detach(), torch.tensor([y for _, _, y in tagged])
for _ in range(1500):
    loss = torch.nn.functional.cross_entropy(cls(Xc), Yc); opt.zero_grad(); loss.backward(); opt.step()
cls.eval()

# ---------------------------------------------------------------- export
def att(pre, m):
    return [(f"{pre}.{k}", getattr(m, k).weight) for k in "qkvo"] + [(f"{pre}.{k}b", getattr(m, k).bias) for k in "qkvo"]
def enc_block(pre, b):
    return (att(f"{pre}.att", b.att) + [(f"{pre}.n1", b.n1.weight), (f"{pre}.n1b", b.n1.bias), (f"{pre}.n2", b.n2.weight), (f"{pre}.n2b", b.n2.bias),
            (f"{pre}.ff1", b.ff[0].weight), (f"{pre}.ff1b", b.ff[0].bias), (f"{pre}.ff2", b.ff[2].weight), (f"{pre}.ff2b", b.ff[2].bias)])
def clinical(m):
    t = [("tok", m.tok.weight), ("pos", m.pos.weight[:LPOS])]
    for i, b in enumerate(m.blocks): t += enc_block(f"b{i}", b)
    return t + [("mlm", m.mlm.weight), ("mlmb", m.mlm.bias)]
def encdec(m):
    t = [("stok", m.stok.weight), ("spos", m.spos.weight[:LSRC]), ("ttok", m.ttok.weight), ("tpos", m.tpos.weight[:LTGT])]
    for i, b in enumerate(m.enc): t += enc_block(f"e{i}", b)
    for i, b in enumerate(m.dec):
        t += att(f"d{i}.self", b.self_att) + att(f"d{i}.cross", b.cross)
        t += [(f"d{i}.n{k}", getattr(b, f"n{k}").weight) for k in (1, 2, 3)] + [(f"d{i}.n{k}b", getattr(b, f"n{k}").bias) for k in (1, 2, 3)]
        t += [(f"d{i}.ff1", b.ff[0].weight), (f"d{i}.ff1b", b.ff[0].bias), (f"d{i}.ff2", b.ff[2].weight), (f"d{i}.ff2b", b.ff[2].bias)]
    return t + [("out", m.out.weight), ("outb", m.out.bias)]

def pack(tensors):
    arrs = [t.detach().float().numpy().astype(np.float32).reshape(-1) for _, t in tensors]
    spec = [[n, list(t.shape)] for n, t in tensors]
    return spec, base64.b64encode(np.concatenate(arrs).tobytes()).decode("ascii")

MODELS = {"base": clinical(base), "causal": clinical(causal), "dna": encdec(dna), "tag": [("tag", tag.weight), ("tagb", tag.bias)], "cls": [("cls", cls.weight), ("clsb", cls.bias)]}
packed = {k: pack(v) for k, v in MODELS.items()}
# the widget computes in float64 from the float32 weights; so does torch below, in float64
for m in (base, causal, dna, tag, cls): m.double()

# ---------------------------------------------------------------- the widget's inputs
PAIR = ["planned discharge home today", "yellow discharge from wound"]
PROMPTS = ["treated with aspirin for", "treated with", "no", "yellow", "patient"]
CLAUSE = "treated with aspirin for chest pain"
TREATS = [f"{v} with {d} for {s}" for v in ("treated", "managed") for s, ds in A.SYM_DRUG.items() for d in ds]
DNA_SEEDS = [5, 11, 23]
ids_of = lambda toks: torch.tensor([[A.ID[w] for w in toks]])
L2 = lambda t: t.tolist()

ref = {"encoder": [], "pretrain": {}, "generate": [], "dna": [], "tags": []}
with torch.no_grad():
    for s in PAIR:
        toks = ["[CLS]"] + s.split() + ["[SEP]"]; ids = ids_of(toks); m = torch.ones_like(ids)
        st = TM.stages(base, ids, m)
        alphas = []; h = base.embed(ids)
        for b in base.blocks: b.att(h, m == 0); alphas.append(L2(b.att.last[0])); h = b(h, m == 0)
        ref["encoder"].append({"tokens": toks, "stages": [L2(x[0]) for _, x in st], "alpha": alphas})
    # pre-training: the lesson's clause in full, and every treat clause's argmax
    def mlm_at(toks, j):
        x = ids_of(["[CLS]"] + toks + ["[SEP]"]); x[0, 1 + j] = A.MASK
        h, _ = base.encode(x, torch.ones_like(x)); return base.mlm(h[0, 1 + j]).softmax(-1)
    def causal_at(toks, j):
        x = ids_of(["[CLS]"] + toks[:j]); h, _ = causal.encode(x, torch.ones_like(x), causal=True)
        return causal.mlm(h[0, -1]).softmax(-1)
    cl = CLAUSE.split()
    ref["pretrain"]["clause"] = cl
    ref["pretrain"]["mlm"] = [L2(mlm_at(cl, j)) for j in range(len(cl))]
    ref["pretrain"]["causal"] = [L2(causal_at(cl, j)) for j in range(len(cl))]
    ref["pretrain"]["treats"] = [{"clause": c, "mlm": [int(mlm_at(c.split(), j).argmax()) for j in range(len(c.split()))],
                                  "causal": [int(causal_at(c.split(), j).argmax()) for j in range(len(c.split()))]} for c in TREATS]
    # generation, greedy, fed back, until the model writes its end token; in the decoder's own names
    cid = {w: i for i, w in enumerate(CAUSAL_VOCAB)}
    for p in PROMPTS:
        cur = ["[BOS]"] + p.split(); steps = []
        while len(cur) < LPOS:
            x = torch.tensor([[cid[w] for w in cur]]); h, _ = causal.encode(x, torch.ones_like(x), causal=True)
            pr = causal.mlm(h[0, -1]).softmax(-1); nxt = CAUSAL_VOCAB[int(pr.argmax())]
            al = []; hh = causal.embed(x)
            for b in causal.blocks: b.att(hh, None, causal=True); al.append(L2(b.att.last[0])); hh = b(hh, None, causal=True)
            steps.append({"context": list(cur), "probs": L2(pr), "alpha": al}); cur.append(nxt)
            if nxt == "[EOS]": break
        ref["generate"].append({"prompt": p, "tokens": cur, "steps": steps})
    # the tag head on sentences read whole: the lesson's, and one that denies a finding
    for s_ in (CLAUSE, "no chest pain on exam"):
        toks = ["[CLS]"] + s_.split() + ["[SEP]"]; x = ids_of(toks); h, _ = base.encode(x, torch.ones_like(x))
        ref["tags"].append({"tokens": toks, "probs": L2(tag(h[0]).softmax(-1)), "sentence": L2(cls(h[0, 0]).softmax(-1))})
    # DNA -> protein
    for sd in DNA_SEEDS:
        rng = random.Random(sd); cod = [rng.choice(TM.SENSE) for _ in range(6)]
        src = [" ACGT".index(ch) for c in cod for ch in c]; tgt = [3 + TM.AAS.index(TM.CODE[c]) for c in cod]
        S = torch.tensor([src]); Ti = torch.tensor([[1] + tgt])
        logits = dna(S, S == 0, Ti, torch.zeros_like(Ti, dtype=torch.bool))
        ref["dna"].append({"seed": sd, "dna": "".join(cod), "protein": [TM.CODE[c] for c in cod],
                           "cross": [L2(b.cross.last[0]) for b in dna.dec], "self": [L2(b.self_att.last[0]) for b in dna.dec],
                           "argmax": L2(logits[0].argmax(-1))})

VOCABS = {"clinical": A.VOCAB, "causal": CAUSAL_VOCAB, "dnaSrc": ["[PAD]", "A", "C", "G", "T"], "dnaTgt": ["[PAD]", "[BOS]", "[EOS]"] + TM.AAS, "tags": TAGS, "classes": CLASSES}
W = {k: {"spec": s, "b64": b} for k, (s, b) in packed.items()}
src = ("/* GENERATED by widgets/_lab/transformer-weights.py — do not edit by hand.\n"
       "   Three trained models, float32 in base64, each tensor in SPEC's order in torch's layout (weight[out][in]):\n"
       "   base, the language arc's tiny BERT (widget 83's model, masked-token pretraining); causal, the same size\n"
       "   trained on next-token prediction; dna, a tiny encoder-decoder trained on DNA -> protein; tag, a head on base's frozen final vectors, a tag for every token; cls, a head on its [CLS] row, negative / positive. */\n"
       f"export const VOCABS = {json.dumps(VOCABS)};\n"
       f"export const MODELS = {json.dumps(W, separators=(',', ':'))};\n")
(here.parent / "transformer").mkdir(exist_ok=True)
(here.parent / "transformer" / "weights.js").write_text(src, encoding="utf-8", newline="\n")
(here / "transformer-reference.json").write_text(json.dumps({"prompts": PROMPTS, "pair": PAIR, "dnaSeeds": DNA_SEEDS, **ref}), encoding="utf-8", newline="\n")
print(f"wrote widgets/transformer/weights.js ({len(src):,} bytes) and _lab/transformer-reference.json")
for g in ref["generate"]: print("  ", " ".join(g["tokens"][1:]))
for d in ref["dna"]: print("  ", d["dna"], "".join(d["protein"]), [TM.AAS[i - 3] if i >= 3 else i for i in d["argmax"]])
for t in ref["tags"]: print("  ", f"P(positive) {t['sentence'][1]:.3f} ", " ".join(f"{w}:{TAGS[max(range(4), key=lambda c: p[c])]}({max(p):.3f})" for w, p in zip(t["tokens"], t["probs"])))
