"""Slot 84's Decoder against 10-3's convention (his question, 2026-09-30: "for decoder, we
still use CLS? I thought BOS, EOS?"). 10-3 cells 50-68 generate from <bos> alone until the
model writes <eos>. The shipped causal model was pretrained on the arc's notes (one to three
clauses) with [CLS] ... [SEP] around each: its greedy run from the lesson's prompt writes three
clauses before [SEP], so the page stops it at the first "." -- a rule of ours, not the model's.

Measured here: the same model, the same training (size, steps, seed), on ONE-CLAUSE notes, so
each training sequence is <start> clause <end> and the end token follows a clause. Does greedy
from the lesson's prompt, and from <start> alone, stop at <end> by itself? And what the page's
numbers become: the probabilities of each true next token along the lesson's sentence.

Run:  python widgets/_lab/transformer-eos-measure.py      (about 1 min)
"""
import importlib.util, random
from pathlib import Path
import torch

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("tm", here / "transformer-measure.py")
TM = importlib.util.module_from_spec(spec); spec.loader.exec_module(TM)
A = TM.A
log = lambda *a: print(*a, flush=True)

rng = random.Random(0); corpus = [A.note(rng, 1)[0] for _ in range(20000)]
torch.manual_seed(0); causal = A.TinyBERT(A.V, D=48, H=4, Fh=96, N=2)
A.pretrain(causal, corpus, 3000, torch.Generator().manual_seed(0), causal=True); causal.eval()

def greedy(prompt, cap=16):
    cur = ["[CLS]"] + prompt.split()
    while len(cur) < cap:
        x = torch.tensor([[A.ID[w] for w in cur]])
        with torch.no_grad(): h, _ = causal.encode(x, torch.ones_like(x), causal=True); p = causal.mlm(h[0, -1]).softmax(-1)
        nxt = A.VOCAB[int(p.argmax())]; cur.append(nxt)
        if nxt == "[SEP]": break
    return cur
log("one-clause pretraining; [CLS] is the start token, [SEP] the end token")
for pr in ("treated with aspirin for", "treated with", "", "no", "yellow", "patient"):
    log(f"  from {pr or '(the start token alone)':28s} -> " + " ".join(greedy(pr)[1:]))
S = ["[CLS]"] + "treated with aspirin for chest pain".split() + ["[SEP]"]
x = torch.tensor([[A.ID[w] for w in S]])
with torch.no_grad(): h, _ = causal.encode(x, torch.ones_like(x), causal=True); P = causal.mlm(h[0]).softmax(-1)
log("  the lesson's sentence, each true next token's probability: " + "  ".join(f"{S[i]}->{S[i + 1]} {P[i, A.ID[S[i + 1]]].item():.3f}" for i in range(len(S) - 1)))
# the grammar still generated: 300 samples from the start token, how many are one well-formed clause
g = torch.Generator().manual_seed(1); ok = 0; kinds = set()
for _ in range(300):
    cur = ["[CLS]"]
    while len(cur) < 16:
        x = torch.tensor([[A.ID[w] for w in cur]])
        with torch.no_grad(): h, _ = causal.encode(x, torch.ones_like(x), causal=True); p = causal.mlm(h[0, -1]).softmax(-1)
        nxt = A.VOCAB[int(torch.multinomial(p, 1, generator=g))]; cur.append(nxt)
        if nxt == "[SEP]": break
    body = cur[1:-1] if cur[-1] == "[SEP]" else None
    if body and "." not in body: ok += 1
log(f"  300 sampled from the start token: {ok} end at the end token with one clause")
