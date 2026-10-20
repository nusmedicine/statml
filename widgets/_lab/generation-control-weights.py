"""Generates `widgets/generation-control/weights.js`, the two models widget 109
reads, and `_lab/generation-control-reference.json`, torch's float64 next-token
probabilities on the contexts `generation-control-verify.mjs` holds the JS
forward to.

  causal  widget 84's decoder, READ from `widgets/transformer/weights.js` (not
          retrained), so the Sampling page runs the same model 84's Decoder page
          does: the language arc's tiny transformer (D 48, 4 heads, FFN 96, two
          post-LN blocks) trained by next-token prediction on one-clause notes.
  cond    the same size, trained the same way on one-clause notes of two kinds
          only, a treatment clause or a negated finding, with a condition token
          after [BOS]: [BOS] [TREAT] treated with ... [EOS], [BOS] [NEG] no ...
          [EOS]. The loss is on the note's tokens only, never on the condition
          token: trained to predict it, the model wrote [TREAT] or [NEG] itself
          after a bare [BOS] (0.41 each; 82% of notes with no prefix did), since
          80% of training notes have one there (measured 2026-10-20).
          In 20% of training notes the condition token is left out, so the
          same model also gives the distribution with no prefix. The Conditioning
          page. Slot 109's picks (2026-10-20, `_lab/gen109-mock.html`): 3A the two
          kinds, 4A the dropped prefix shown.

Both models' vocabularies name ids 1 and 2 [BOS] and [EOS]; `cond` adds [TREAT]
and [NEG] at the end. Stored as float32 in base64, one string a model, its
tensors in SPEC's order, torch's layout (weight[out][in]), as 84's file is.

Also measured here, printed and written to `_lab/generation-control-measure.json`
(untracked): for the causal model, what the decoding rules produce from [BOS]
on a temperature and a k ladder (distinct notes, the share the grammar can
produce, the share that run to the length cap); for the cond model, the first
token's distribution under each prefix and the share of notes that start the
conditioned way. The draws are inverse-CDF on one uniform a token, the tokens
ordered by the model's probability, exactly as the widget draws.

Run:  python widgets/_lab/generation-control-weights.py      (about 1 min, CPU)
A GENERATED FILE: regenerate after any change to the grammar or the training,
then run `node widgets/_lab/generation-control-verify.mjs`.
"""
import base64, importlib.util, itertools, json, random, re
from pathlib import Path
import numpy as np
import torch, torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("arc", here / "language-arc-measure.py")
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
torch.set_num_threads(8)

LPOS = 16          # positions kept; the longest context the widget feeds is 13 ([BOS], prefix, 11 tokens)
MAXTOK = 11        # generated tokens before the widget stops a note that has not written [EOS]

# ---------------------------------------------------------------- 84's causal model, read
src = (here.parent / "transformer" / "weights.js").read_text(encoding="utf-8")
MODELS84 = json.loads(re.search(r"export const MODELS = (\{.*?\});\n", src, re.S).group(1))
VOCABS84 = json.loads(re.search(r"export const VOCABS = (\{.*?\});\n", src, re.S).group(1))
CAUSAL_VOCAB = VOCABS84["causal"]
assert len(CAUSAL_VOCAB) == A.V and CAUSAL_VOCAB[1] == "[BOS]" and CAUSAL_VOCAB[2] == "[EOS]"

def tensors_of(m):
    """(name, tensor) in 84's clinical() order, the pos table cut to LPOS rows"""
    t = [("tok", m.tok.weight), ("pos", m.pos.weight[:LPOS])]
    for i, b in enumerate(m.blocks):
        pre = f"b{i}"
        t += [(f"{pre}.att.{k}", getattr(b.att, k).weight) for k in "qkvo"] + [(f"{pre}.att.{k}b", getattr(b.att, k).bias) for k in "qkvo"]
        t += [(f"{pre}.n1", b.n1.weight), (f"{pre}.n1b", b.n1.bias), (f"{pre}.n2", b.n2.weight), (f"{pre}.n2b", b.n2.bias),
              (f"{pre}.ff1", b.ff[0].weight), (f"{pre}.ff1b", b.ff[0].bias), (f"{pre}.ff2", b.ff[2].weight), (f"{pre}.ff2b", b.ff[2].bias)]
    return t + [("mlm", m.mlm.weight), ("mlmb", m.mlm.bias)]

def load(m, packed):
    spec_, b64 = packed["spec"], packed["b64"]
    flat = np.frombuffer(base64.b64decode(b64), dtype=np.float32)
    names = dict(tensors_of(m)); o = 0
    with torch.no_grad():
        for name, shape in spec_:
            n = int(np.prod(shape)); v = torch.from_numpy(flat[o:o + n].copy()).reshape(shape); o += n
            names[name].copy_(v)
    assert o == flat.size

causal = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
load(causal, MODELS84["causal"]); causal.eval()

# ---------------------------------------------------------------- the conditioned model, trained
COND = {"treat": "[TREAT]", "neg": "[NEG]"}
COND_VOCAB = CAUSAL_VOCAB + list(COND.values())
CV = len(COND_VOCAB)
CID = {w: i for i, w in enumerate(COND_VOCAB)}
BOS, EOS, PAD = 1, 2, 0
DROP = 0.2

def cond_ids(kind, toks, drop):
    return [BOS] + ([] if drop else [CID[COND[kind]]]) + [CID[w] for w in toks] + [EOS]

torch.manual_seed(0)
cond = A.TinyBERT(CV, D=48, H=4, Fh=96, N=2)
opt = torch.optim.Adam(cond.parameters(), 1e-3)
rng = random.Random(0); cond.train()
for step in range(3000):
    seqs = []
    for _ in range(64):
        k = rng.choice(list(COND)); t, _ = A.clause(rng, k)
        seqs.append(cond_ids(k, t, rng.random() < DROP))
    L = max(map(len, seqs))
    ids = torch.tensor([s + [PAD] * (L - len(s)) for s in seqs]); m = (ids != PAD).long()
    h, _ = cond.encode(ids, m, causal=True)
    logits = cond.mlm(h[:, :-1]); y = ids[:, 1:].clone(); y[m[:, 1:] == 0] = -100
    y[(y == CID["[TREAT]"]) | (y == CID["[NEG]"])] = -100   # the condition is given, never predicted: no loss on it
    loss = F.cross_entropy(logits.reshape(-1, CV), y.reshape(-1), ignore_index=-100)
    opt.zero_grad(); loss.backward(); opt.step()
cond.eval()
print(f"cond model trained, last batch loss {loss.item():.3f}")

# ---------------------------------------------------------------- the grammar's one-clause notes
def grammar_notes():
    S, out = A.SYMS, set()
    for v in ("presented", "was"):
        for a in S:
            out.add(f"patient {v} with {a}")
            for b in S:
                if b != a: out.add(f"patient {v} with {a} and {b}")
    for v in ("treated", "managed"):
        for s, ds in A.SYM_DRUG.items():
            for d in ds: out.add(f"{v} with {d} for {s}")
    for s in S:
        out.add(f"no {s} on exam"); out.add(f"no {s} reported")
    for a, b, c in itertools.product(("planned", "ready"), ("home", "to rehab"), ("today", "tomorrow")):
        out.add(f"{a} discharge {b} {c}")
    for a, b in itertools.product(("yellow", "purulent", "clear"), ("wound", "ear", "eye")):
        out.add(f"{a} discharge from {b}")
    out |= {"patient recovered well", "patient deteriorated overnight"}
    return out
GRAMMAR = grammar_notes()
print(f"the grammar's one-clause notes: {len(GRAMMAR)}")

# ---------------------------------------------------------------- sampling, as the widget samples
@torch.no_grad()
def probs(model, ids):
    t = torch.tensor([ids]); m = torch.ones_like(t)
    h, _ = model.encode(t, m, causal=True)
    return model.mlm(h[0, -1]).softmax(-1).double().numpy()

def rule_dist(p, rule, T=1.0, k=3):
    if rule == "greedy":
        q = np.zeros_like(p); q[int(np.argmax(p))] = 1; return q
    if rule == "temperature":
        z = np.log(np.clip(p, 1e-300, None)) / T; z -= z.max(); q = np.exp(z); return q / q.sum()
    order = np.argsort(-p, kind="stable"); q = np.zeros_like(p); q[order[:k]] = p[order[:k]]; return q / q.sum()

def draw(p, q, u):
    """the token whose interval holds u, the intervals in the model's order (largest p first)"""
    order = np.argsort(-p, kind="stable"); c = 0.0
    for i in order:
        c += q[i]
        if u < c: return int(i)
    return int(order[np.flatnonzero(q[order] > 0)[-1]])

def generate(model, vocab, start, us, rule="temperature", T=1.0, k=3):
    ids, out = list(start), []
    for j in range(MAXTOK):
        p = probs(model, ids); t = draw(p, rule_dist(p, rule, T, k), us[j])
        if t == EOS: return out, True
        out.append(vocab[t]); ids.append(t)
    return out, False

meas = {"grammarNotes": len(GRAMMAR)}
N = 1000
U = np.random.default_rng(0).random((N, MAXTOK))
ARMS = [("greedy", {}), *[("temperature", {"T": T}) for T in (0.5, 0.7, 1.0, 1.3, 1.6, 2.0)], *[("topk", {"k": k}) for k in (1, 2, 3, 4, 5, 10)]]
print(f"\nSAMPLING from [BOS], {N} notes an arm, one uniform a token (common across arms)")
meas["sampling"] = []
for rule, kw in ARMS:
    notes = [generate(causal, CAUSAL_VOCAB, [BOS], U[i], rule, **kw) for i in range(N)]
    txt = [" ".join(n) for n, _ in notes]
    row = {"rule": rule, **kw, "distinct": len(set(txt)), "inGrammar": sum(t in GRAMMAR for t in txt) / N,
           "capped": sum(not e for _, e in notes) / N, "special": sum(any(w.startswith("[") for w in n) for n, _ in notes) / N}
    meas["sampling"].append(row)
    print(f"  {rule:11s} {str(kw):12s} distinct {row['distinct']:3d}  in the grammar {row['inGrammar']:.3f}  capped {row['capped']:.3f}  with a special token {row['special']:.3f}")

print("\nCONDITIONING, the first token after each prefix")
meas["first"] = {}
for name, start in (("treat", [BOS, CID["[TREAT]"]]), ("neg", [BOS, CID["[NEG]"]]), ("none", [BOS])):
    p = probs(cond, start); top = np.argsort(-p)[:5]
    meas["first"][name] = [[COND_VOCAB[i], round(float(p[i]), 4)] for i in top]
    print(f"  {name:6s} " + ", ".join(f"{COND_VOCAB[i]} {p[i]:.3f}" for i in top))
def kind_of(note):
    return "treat" if note[:1] in (["treated"], ["managed"]) else "neg" if note[:1] == ["no"] else "other"
meas["cond"] = {}
for name, start in (("treat", [BOS, CID["[TREAT]"]]), ("neg", [BOS, CID["[NEG]"]]), ("none", [BOS])):
    notes = [generate(cond, COND_VOCAB, start, U[i]) for i in range(N)]
    kinds = [kind_of(n) for n, _ in notes]; txt = [" ".join(n) for n, _ in notes]
    row = {k: kinds.count(k) / N for k in ("treat", "neg", "other")}
    row["inGrammar"] = sum(t in GRAMMAR for t in txt) / N
    meas["cond"][name] = row
    print(f"  {name:6s} starts treat {row['treat']:.3f}  neg {row['neg']:.3f}  other {row['other']:.3f}  in the grammar {row['inGrammar']:.3f}")

(here / "generation-control-measure.json").write_text(json.dumps(meas, indent=1), encoding="utf-8", newline="\n")

# ---------------------------------------------------------------- export
def pack(m):
    t = tensors_of(m)
    arrs = [x.detach().float().numpy().astype(np.float32).reshape(-1) for _, x in t]
    return {"spec": [[n, list(x.shape)] for n, x in t], "b64": base64.b64encode(np.concatenate(arrs).tobytes()).decode("ascii")}
packed = {"causal": pack(causal), "cond": pack(cond)}
assert packed["causal"]["b64"] == MODELS84["causal"]["b64"], "84's causal model did not round-trip"

out = here.parent / "generation-control" / "weights.js"
out.parent.mkdir(exist_ok=True)
out.write_text(
    "/* GENERATED by widgets/_lab/generation-control-weights.py — do not edit by hand.\n"
    "   Two trained models, float32 in base64, each tensor in SPEC's order in torch's layout (weight[out][in]):\n"
    "   causal, widget 84's decoder, read from its weights file; cond, the same size trained with a condition\n"
    "   token after [BOS] ([TREAT] or [NEG]), left out of 20% of training notes. */\n"
    f"export const VOCABS = {json.dumps({'causal': CAUSAL_VOCAB, 'cond': COND_VOCAB})};\n"
    "/* every one-clause note the training grammar can produce; a generated note outside it is marked */\n"
    f"export const GRAMMAR = {json.dumps(sorted(GRAMMAR))};\n"
    f"export const MODELS = {json.dumps(packed)};\n", encoding="utf-8", newline="\n")
print(f"\nwrote {out} ({out.stat().st_size / 1e3:.0f} kB)")

# ---------------------------------------------------------------- the reference: torch, float64
for m in (causal, cond): m.double()
rng = np.random.default_rng(1)
ref = {"causal": [], "cond": []}
ctxs = [[BOS]] + [[BOS] + [A.ID[w] for w in s.split()] for s in ("patient", "patient was with", "treated with aspirin for", "no fever", "ready discharge to")]
for i in range(6):                                   # contexts reached by sampling
    ids, _ = list([BOS]), None
    note, _ = generate(causal.float(), CAUSAL_VOCAB, [BOS], rng.random(MAXTOK)); causal.double()
    ctxs.append([BOS] + [A.ID[w] for w in note])
for c in ctxs: ref["causal"].append({"ids": c, "p": probs(causal, c).tolist()})
for c in ([BOS], [BOS, CID["[TREAT]"]], [BOS, CID["[NEG]"]], [BOS, CID["[TREAT]"]] + [CID[w] for w in "treated with".split()],
          [BOS, CID["[NEG]"], CID["no"], CID["fever"]], [BOS] + [CID[w] for w in "managed with paracetamol for".split()]):
    ref["cond"].append({"ids": c, "p": probs(cond, c).tolist()})
(here / "generation-control-reference.json").write_text(json.dumps(ref), encoding="utf-8", newline="\n")
print("wrote generation-control-reference.json")
