"""Slot 85's protein Data choice, measured before any design, 2026-10-02. His pick:
85 gains Data: Clinical notes · HA proteins, the same four ways on a small protein
encoder pretrained by hiding residues (a stand-in for 08-3's ESM-2). The risk: the
lesson's model from scratch already reaches 98.7% on 4,000 labelled proteins
(`protein-measure.py`), so the four ways may differ only with few labels.

  P  PRETRAINING: 85's shape (D 48, 4 heads, FFN 96, 2 post-LN blocks, learned
     positions for 600) by masked-residue prediction (15%, 08-1 cell 4's rule) on
     the lesson's TRAINING split's sequences, labels unused; held-out masked
     accuracy at checkpoints.
  A  ADAPTATION, 85's protocol: scratch, transfer, full, LoRA (r 8, alpha 32 on Q
     and V), the [CLS] row into Linear(48 -> 2) (ESM-2's head reads <cls>), at
     n = 16 . 64 . 256 . 1024 labelled proteins (the first n of the lesson's train
     split), 400 steps of batch 16, Adam at the arc's rates; accuracy on 1,000 of
     the lesson's test proteins; one seed first. Transfer also with MEAN pooling.

Data: the lesson's CSV (downloaded on his leave; NOT in the repository).
Run:  python widgets/_lab/protein-adapt-measure.py <influenza_ha.csv> [P A S Q] [--steps 3000]
Writes `_lab/protein-adapt-measure.json`.
"""
import csv, importlib.util, json, math, random, sys, time
from pathlib import Path
import torch, torch.nn as nn, torch.nn.functional as F
from sklearn.model_selection import train_test_split

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("ct", here / "clinical-text-measure.py")
CT = importlib.util.module_from_spec(spec); spec.loader.exec_module(CT)
A = CT.A
torch.set_num_threads(8)
T0 = time.time()
def log(*a): print(*a, flush=True)

path = sys.argv[1]
parts = [p for p in sys.argv[2:] if p in ("P", "A", "S", "Q")] or ["P", "A"]
STEPS = int(sys.argv[sys.argv.index("--steps") + 1]) if "--steps" in sys.argv else 3000
with open(path, newline="") as fh:
    rows = [(r["seq"].upper(), int(r["label"])) for r in csv.DictReader(fh)]
tr, vt = train_test_split(rows, test_size=0.2, random_state=42, stratify=[r[1] for r in rows])
va, te = train_test_split(vt, test_size=0.5, random_state=42, stratify=[r[1] for r in vt])

AA = "ACDEFGHIKLMNPQRSTVWY"
PAD, CLS, SEP, MASK, UNK = 0, 1, 2, 3, 4                  # A.mask_tokens reads CLS, SEP and MASK as these ids
VOC = ["[PAD]", "[CLS]", "[SEP]", "[MASK]", "[UNK]"] + list(AA)
ID = {a: i + 5 for i, a in enumerate(AA)}
V, LMAX = len(VOC), 600

def batch(seqs):
    ids = [[CLS] + [ID.get(ch, UNK) for ch in s][:LMAX - 2] + [SEP] for s in seqs]
    L = max(map(len, ids)); X = torch.zeros(len(ids), L, dtype=torch.long); M = torch.zeros(len(ids), L, dtype=torch.long)
    for i, r in enumerate(ids): X[i, :len(r)] = torch.tensor(r); M[i, :len(r)] = 1
    return X, M

def build(seed=0):
    torch.manual_seed(seed); return A.TinyBERT(V, D=48, H=4, Fh=96, N=2, Lmax=LMAX)

def mlm_acc(mdl, seqs, g):
    X, M = batch(seqs); x, y = A.mask_tokens(X, M, g)
    with torch.no_grad(): h, _ = mdl.encode(x, M); p = mdl.mlm(h).argmax(-1)
    sel = y != -100
    return (p[sel] == y[sel]).float().mean().item()

OUT = {}
corpus = [s for s, _ in tr]
held = [s for s, _ in va[:200]]
if "P" in parts:
    log(f"== P  masked-residue pretraining on {len(corpus):,} unlabelled training proteins, {STEPS} steps of 32")
    mdl = build(0); g = torch.Generator().manual_seed(0)
    opt = torch.optim.Adam(mdl.parameters(), lr=1e-3); mdl.train(); curve = []
    for s in range(1, STEPS + 1):
        idx = torch.randint(len(corpus), (32,), generator=g)
        X, M = batch([corpus[i] for i in idx]); x, y = A.mask_tokens(X, M, g)
        h, _ = mdl.encode(x, M)
        loss = F.cross_entropy(mdl.mlm(h).reshape(-1, V), y.reshape(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()
        if s in (1, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000) or s == STEPS:
            mdl.eval(); a = mlm_acc(mdl, held, torch.Generator().manual_seed(3)); mdl.train()
            curve.append([s, round(a, 4)]); log(f"   step {s:5d}: held-out masked-residue accuracy {a:.1%}  ({time.time()-T0:.0f}s)")
    mdl.eval(); torch.save(mdl.state_dict(), here / "protein-base.pt")
    OUT["pretrain"] = curve
    log(f"   chance for 20 amino acids: 5%; the most common residue's share: {max(sum(s.count(a) for s in corpus) for a in AA) / sum(map(len, corpus)):.1%}")

def logits(mdl, X, M, pool):
    """the head on [CLS], the mean or the max over the real tokens. TinyBERT.classify knows only "cls" and
    reads anything else as mean, so max went through as a second mean on the first pooling run (2026-10-02)"""
    if pool != "max": return mdl.classify(X, M, pool)
    h, _ = mdl.encode(X, M)
    return mdl.head(h.masked_fill((M == 0)[..., None], float("-inf")).max(1).values)

if "A" in parts or "S" in parts or "Q" in parts:
    base = build(0); base.load_state_dict(torch.load(here / "protein-base.pt")); base.eval()
    test = te[:1000]; Xt, Mt = batch([s for s, _ in test]); yt = torch.tensor([y for _, y in test])
    def adapt(way, n, pool="cls", seed=0):
        """seed 0 trains on the first n of the train split, as part A did; seed k on the k-th block of n after it"""
        X, Y = zip(*tr[seed * n:(seed + 1) * n]); Xb, Mb = batch(X); y = torch.tensor(Y)
        torch.manual_seed(seed); mdl = build(seed)
        if way != "scratch": mdl.load_state_dict(base.state_dict())
        mdl.head.reset_parameters()
        for p in mdl.parameters(): p.requires_grad = way in ("full", "scratch")
        if way == "lora": CT.lora_wrap(mdl, 8, 32)
        for p in mdl.mlm.parameters(): p.requires_grad = False
        for p in mdl.head.parameters(): p.requires_grad = True
        params = [p for p in mdl.parameters() if p.requires_grad]
        opt = torch.optim.Adam(params, lr=CT.LRS["arc"][way]); g = torch.Generator().manual_seed(seed)
        mdl.train()
        for s in range(400):
            idx = torch.randint(len(X), (min(16, len(X)),), generator=g)
            loss = F.cross_entropy(logits(mdl, Xb[idx], Mb[idx], pool), y[idx]); opt.zero_grad(); loss.backward(); opt.step()
        mdl.eval(); acc = 0
        with torch.no_grad():
            for i in range(0, len(test), 100): acc += (logits(mdl, Xt[i:i + 100], Mt[i:i + 100], pool).argmax(-1) == yt[i:i + 100]).sum().item()
        return acc / len(test)

if "A" in parts:
    log(f"\n== A  adaptation on [CLS], 400 steps of 16; test 1,000 (human {yt.float().mean():.0%})")
    OUT["adapt"] = {}
    for way in ("transfer", "lora", "full", "scratch"):
        row = [round(adapt(way, n), 4) for n in (16, 64, 256, 1024)]; OUT["adapt"][way] = row
        log(f"   {way:8s}: " + "  ".join(f"{a:.1%}" for a in row) + f"   ({time.time()-T0:.0f}s)")
    row = [round(adapt("transfer", n, "mean"), 4) for n in (16, 64, 256, 1024)]; OUT["adapt"]["transfer_mean"] = row
    log(f"   transfer, mean pooling: " + "  ".join(f"{a:.1%}" for a in row) + f"   ({time.time()-T0:.0f}s)")

import statistics as st
ms = lambda v: f"{st.mean(v):.1%} ± {st.stdev(v):.1%}"
if "S" in parts:
    # S (2026-10-02, his "run both"): the 16- and 64-label gaps over three seeds, each seed its own labelled
    # proteins. Q: the pooling choice (mean · max · [CLS]) for from scratch and transfer at 16 and 1,024.
    log("\n== S  three seeds (each its own labelled proteins); test 1,000")
    OUT["seeds"] = {}
    for n in (16, 64):
        for way in ("transfer", "lora", "full", "scratch"):
            v = [adapt(way, n, "cls", sd) for sd in range(3)]; OUT["seeds"][f"{way}/{n}"] = [round(x, 4) for x in v]
            log(f"   n {n:4d} {way:8s} [CLS]: {ms(v)}   {[round(x, 3) for x in v]}   ({time.time()-T0:.0f}s)")
if "Q" in parts:
    log("\n== Q  pooling, three seeds; test 1,000")
    OUT["pooling"] = {}
    for way in ("scratch", "transfer"):
        for n in (16, 1024):
            for pool in ("mean", "max", "cls"):
                v = [adapt(way, n, pool, sd) for sd in range(3)]; OUT["pooling"][f"{way}/{n}/{pool}"] = [round(x, 4) for x in v]
                log(f"   pooling {way:8s} n {n:4d} {pool:4s}: {ms(v)}   ({time.time()-T0:.0f}s)")

prev = here / "protein-adapt-measure.json"
old = json.loads(prev.read_text()) if prev.exists() else {}
old.update(OUT); prev.write_text(json.dumps(old, indent=1), encoding="utf-8")
log(f"done ({time.time()-T0:.0f}s)")
