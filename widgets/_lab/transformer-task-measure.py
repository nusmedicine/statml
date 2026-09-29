"""Slot 84's Encoder PREDICTION phase, measured before it is drawn (his pick,
2026-09-30: "for encoder, we dont have generation, but can we have prediction?"
-> "a task from the vectors"). The encoder is the shipped base model (masked-token
pretraining, seed 0, 3,000 steps -- retrained here exactly as
`transformer-weights.py` trains it, and checked against `weights.js`); a head is
trained on its FROZEN vectors, so Prediction reads the same encoder the Training
phase shows. Two tasks the grammar can label, both named in the lesson's encoder
examples (classification, named entity recognition):

  K1 A TAG ON EVERY TOKEN: other · drug · finding · negated finding. A drug is a
     drug word; a finding is a symptom asserted ("presented with fever", "treated
     with aspirin for chest pain", the "discharge" of "yellow discharge from
     wound"); a negated finding is a symptom denied ("no fever reported"). The
     head reads each row alone. Read at three places -- the token + position
     vector, after block 1, after block 2 -- because "chest" is one table row
     whether it is asserted or denied, and "discharge" one row in both senses:
     the tag of those tokens has to come from the context.
  K2 ONE CLASS FOR THE NOTE (08-2's clinical_outcome): an abnormal finding is
     asserted, or not, from the [CLS] row and from the mean of the rows.

Each head: Linear(48 -> classes), Adam, trained on 3,000 notes, scored on 1,000
held out. The widget's sentence, "treated with aspirin for chest pain",
unmasked, is read at the end.

Run:  python widgets/_lab/transformer-task-measure.py      (about 3 min)
"""
import base64, importlib.util, json, random, re
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("tm", here / "transformer-measure.py")
TM = importlib.util.module_from_spec(spec); spec.loader.exec_module(TM)
A, AM = TM.A, TM.AM
log = lambda *a: print(*a, flush=True)

# ---------------------------------------------------------------- the encoder, as shipped
corpus = A.make_corpus(0, 20000)
base = AM.build(48, 4, 2, 0); AM.pretrain_log(base, corpus, 3000, 0); base.eval()
src = (here.parent / "transformer" / "weights.js").read_text(encoding="utf-8")
b64 = re.search(r'"base":\s*\{"spec":.*?"b64":\s*"([^"]+)"', src, re.S).group(1)
shipped = np.frombuffer(base64.b64decode(b64), dtype=np.float32)
tok = base.tok.weight.detach().numpy().astype(np.float32).reshape(-1)
log(f"retrained base against weights.js: token table largest difference {np.abs(shipped[:tok.size] - tok).max():.1e}")

# ---------------------------------------------------------------- K1 labels
TAGS = ["other", "drug", "finding", "negated"]
def tagged_note(rng):
    n = rng.choice([1, 2, 3]); toks, tags, facts = [], [], {"asserted": [], "negated": []}
    for i in range(n):
        k = rng.choice(["present", "treat", "neg", "dhome", "dwound", "course"])
        t, f = A.clause(rng, k)
        if toks: toks.append("."); tags.append(0)
        sym = set(w for s in A.SYMS for w in s.split())
        for w in t:
            if w in A.DRUGS: tags.append(1)
            elif w in sym: tags.append(3 if k == "neg" else 2)
            elif w == "discharge" and k == "dwound": tags.append(2)
            else: tags.append(0)
        toks += t; facts["asserted"] += f["asserted"]; facts["negated"] += f["negated"]
    return toks, tags, facts

def vectors(notes, where):
    """each note's rows at `where` (0 = token + position, 1, 2 = after that block), [CLS] and [SEP] kept"""
    ids, m = A.batchify(notes)
    with torch.no_grad():
        _, hs = base.encode(ids, m)
    return hs[where], m

def fit(X, Y, classes, steps=1500, seed=0):
    torch.manual_seed(seed); head = torch.nn.Linear(X.shape[1], classes)
    opt = torch.optim.Adam(head.parameters(), 1e-2)
    for _ in range(steps):
        loss = F.cross_entropy(head(X), Y); opt.zero_grad(); loss.backward(); opt.step()
    return head

rng = random.Random(101); train = [tagged_note(rng) for _ in range(3000)]
rng = random.Random(202); test = [tagged_note(rng) for _ in range(1000)]
log("\n== K1  A TAG ON EVERY TOKEN (other, drug, finding, negated) ==")
heads = {}
for where in (0, 1, 2):
    def rows(data):
        h, m = vectors([d[0] for d in data], where)
        X, Y, W = [], [], []
        for i, (toks, tags, _) in enumerate(data):
            for j, (w, t) in enumerate(zip(toks, tags)):
                X.append(h[i, j + 1]); Y.append(t); W.append(w)
        return torch.stack(X), torch.tensor(Y), W
    Xtr, Ytr, _ = rows(train); Xte, Yte, Wte = rows(test)
    head = fit(Xtr, Ytr, 4); heads[where] = head
    with torch.no_grad(): P = head(Xte).argmax(-1)
    acc = (P == Yte).float().mean().item()
    per = {TAGS[c]: (P[Yte == c] == c).float().mean().item() for c in range(4)}
    sym = torch.tensor([w in {"chest", "pain", "fever", "infection", "breathlessness", "nausea"} for w in Wte])
    dis = torch.tensor([w == "discharge" for w in Wte])
    name = "token + position" if where == 0 else f"after block {where}"
    log(f"  {name:17s}: all {acc:.1%}   " + "  ".join(f"{k} {v:.1%}" for k, v in per.items())
        + f"   symptom words {(P[sym] == Yte[sym]).float().mean().item():.1%}   'discharge' {(P[dis] == Yte[dis]).float().mean().item():.1%}")

# ---------------------------------------------------------------- K2
log("\n== K2  ONE CLASS FOR THE NOTE (an abnormal finding asserted) ==")
ytr = torch.tensor([int(len(d[2]["asserted"]) > 0) for d in train]); yte = torch.tensor([int(len(d[2]["asserted"]) > 0) for d in test])
log(f"  base rate: {yte.float().mean().item():.1%} of held-out notes assert a finding")
for pool in ("cls", "mean"):
    for where in (0, 2):
        def z(data):
            h, m = vectors([d[0] for d in data], where)
            if pool == "cls": return h[:, 0]
            mm = m[..., None].float(); return (h * mm).sum(1) / mm.sum(1)
        head = fit(z(train), ytr, 2)
        with torch.no_grad(): acc = (head(z(test)).argmax(-1) == yte).float().mean().item()
        log(f"  {pool:4s} at {'token + position' if where == 0 else 'block 2':16s}: {acc:.1%}")

# ---------------------------------------------------------------- the widget's sentence
log("\n== THE WIDGET'S SENTENCE, unmasked, the block-2 tag head ==")
S = "treated with aspirin for chest pain".split()
h, _ = vectors([S], 2)
with torch.no_grad(): P = heads[2](h[0, :len(S) + 2]).softmax(-1)
for j, w in enumerate(["[CLS]"] + S + ["[SEP]"]):
    log(f"  {w:10s} " + "  ".join(f"{TAGS[c]} {P[j, c].item():.3f}" for c in range(4)))
for sent in ("no chest pain on exam", "patient presented with chest pain", "yellow discharge from wound", "planned discharge home today"):
    toks = sent.split(); h, _ = vectors([toks], 2)
    with torch.no_grad(): P = heads[2](h[0, 1:len(toks) + 1]).softmax(-1)
    log(f"  {sent:35s} " + " ".join(f"{w}:{TAGS[P[j].argmax()]}({P[j].max():.2f})" for j, w in enumerate(toks)))

# ---------------------------------------------------------------- K3 (his ask, 2026-09-30: "show embedding that we can use to predict the entire sentence")
log("\n== K3  THE SENTENCE'S EMBEDDING -> NEGATIVE / POSITIVE (08-2's clinical_outcome), by pooling ==")
def pooled(data, where, pool):
    h, m = vectors([d[0] for d in data], where)
    if pool == "cls": return h[:, 0]
    mm = m[..., None].float()
    if pool == "mean": return (h * mm).sum(1) / mm.sum(1)
    return h.masked_fill(mm == 0, float("-inf")).max(1).values
K3 = {}
for pool in ("cls", "mean", "max"):
    row = []
    for where in (0, 1, 2):
        head = fit(pooled(train, where, pool), ytr, 2); K3[(pool, where)] = head
        with torch.no_grad(): row.append((head(pooled(test, where, pool)).argmax(-1) == yte).float().mean().item())
    log(f"  {pool:4s}: token + position {row[0]:.1%}   after block 1 {row[1]:.1%}   after block 2 {row[2]:.1%}")
# the hard notes: every finding denied, or no finding at all, against one asserted among denials
for sent in ("treated with aspirin for chest pain", "no chest pain on exam", "patient recovered well", "no fever reported . patient presented with nausea",
             "no chest pain on exam . no fever reported", "planned discharge home today", "yellow discharge from wound"):
    toks = sent.split()
    out = []
    for pool in ("cls", "mean"):
        z = pooled([(toks, None, None)], 2, pool)
        with torch.no_grad(): p = K3[(pool, 2)](z).softmax(-1)[0, 1].item()
        out.append(f"{pool} {p:.3f}")
    log(f"  P(positive)  {sent:48s} " + "   ".join(out))
# what [CLS] reads: its block-1 and block-2 weights on the lesson's sentence (mean of heads)
ids, m = A.batchify([S])
with torch.no_grad():
    h = base.embed(ids)
    for bi, b in enumerate(base.blocks):
        b.att(h, m == 0); a = b.att.last[0].mean(0)[0, :len(S) + 2]
        log(f"  [CLS]'s weights, block {bi + 1}: " + " ".join(f"{w}:{v:.2f}" for w, v in zip(["[CLS]"] + S + ["[SEP]"], a.tolist())))
        h = b(h, m == 0)
