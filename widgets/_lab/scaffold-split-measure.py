"""Slot 97 scaffold-split: measure before the mock.

Run:  python widgets/_lab/scaffold-split-measure.py base          (~1 min)
      python widgets/_lab/scaffold-split-measure.py gcn <seed>    (one seed, both splits)
Needs RDKit, scikit-learn, torch; reads _lab/graph-fingat-training.csv (untracked)
and writes _lab/scaffold-split-measure.json / scaffold-split-gcn-<seed>.json
(untracked).

The arc measure (graph-arc-measure.py) compared a random 80/20 split with a
scaffold 80/20 split on a random forest. The lesson does neither: 09-2 cell 18
names a LABEL split and a SCAFFOLD split, cell 28 splits in two stages into
train / val / test (80 / 10 / 10 by scaffold group), cell 30 plots each part's
label proportions, and cells 42-57 train a GCN and score it by macro F1. This
measures the lesson's version: both splits in the lesson's three parts, scored
by the forest AND by cell 42's GCN trained with cells 45-53's set-up, so the
widget can say which model it shows and know the claim holds for the lesson's.
"""
import csv, json, os, random, sys, time

import numpy as np
from rdkit import Chem, DataStructs, RDLogger
from rdkit.Chem import AllChem, rdFingerprintGenerator
from rdkit.Chem.Scaffolds import MurckoScaffold
from sklearn.model_selection import GroupShuffleSplit, train_test_split

RDLogger.DisableLog("rdApp.*")
HERE = os.path.dirname(os.path.abspath(__file__))
SEEDS = list(range(42, 52))  # 42 is cell 28's SEED; the mock (1b92a36) used 0-9 and 42

rows = []
with open(os.path.join(HERE, "graph-fingat-training.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rows.append((r["SMILES"], int(r["Activity"])))

# The lesson keeps every row in df (cell 24 returns "" for an unparsed SMILES)
# and drops the unparsed one later, in MoleculeDataset. Split on all 2,335 rows
# exactly as cell 28 does; score on the parsed ones.
SMI = [s for s, _ in rows]
Y = np.array([y for _, y in rows])
MOLS = [Chem.MolFromSmiles(s) for s in SMI]
OK = np.array([m is not None and m.GetNumAtoms() > 0 for m in MOLS])

def get_scaffold(m):  # cell 24
    if m is None:
        return ""
    sc = MurckoScaffold.GetScaffoldForMol(m)
    return Chem.MolToSmiles(sc) if sc is not None else ""

SCAF = np.array([get_scaffold(m) for m in MOLS])

def label_split(seed):
    """Cell 18's label split, in cell 28's two stages: stratified on Activity."""
    idx = np.arange(len(Y))
    tr, vt = train_test_split(idx, test_size=0.2, stratify=Y, random_state=seed)
    va, te = train_test_split(vt, test_size=0.5, stratify=Y[vt], random_state=seed)
    return tr, va, te

def scaffold_split(seed):
    """Cell 28, verbatim in effect."""
    tr, vt = next(GroupShuffleSplit(test_size=0.2, random_state=seed).split(SMI, groups=SCAF))
    v_rel, t_rel = next(GroupShuffleSplit(test_size=0.5, random_state=seed).split(vt, groups=SCAF[vt]))
    return tr, vt[v_rel], vt[t_rel]

SPLITS = {"label": label_split, "scaffold": scaffold_split}


def base():
    t0 = time.time()
    OUT = {}
    from collections import Counter
    sc = Counter(SCAF[OK])
    sizes = sorted(sc.values(), reverse=True)
    OUT["file"] = {"rows": len(rows), "parsed": int(OK.sum()), "active": int(Y.sum()),
                   "scaffolds": len(sc), "singletons": sum(1 for v in sizes if v == 1),
                   "in_groups_2plus": sum(v for v in sizes if v >= 2),
                   "largest": [[k, v] for k, v in sc.most_common(8)],
                   "size_hist": {str(k): v for k, v in sorted(Counter(sizes).items())}}

    # How actives sit among scaffolds: is an active usually alone in its group?
    act_groups = Counter(SCAF[OK & (Y == 1)])
    OUT["actives_by_scaffold"] = {
        "actives": int((OK & (Y == 1)).sum()),
        "scaffolds_holding_an_active": len(act_groups),
        "actives_sharing_scaffold_with_another_active": sum(v for v in act_groups.values() if v >= 2),
        "actives_whose_scaffold_holds_an_inactive": int(sum(
            1 for i in np.where(OK & (Y == 1))[0] if ((SCAF == SCAF[i]) & (Y == 0) & OK).any())),
        "top": [[k, v, sc[k]] for k, v in act_groups.most_common(10)],
    }

    # The figure's molecules (cell 18): are they in the file?
    probes = {"3-methylindole": "Cc1c[nH]c2ccccc12", "2-methylindole": "Cc1cc2ccccc2[nH]1",
              "5-bromoindole": "Brc1ccc2[nH]ccc2c1", "indole": "c1ccc2[nH]ccc2c1",
              "ciprofloxacin": "O=C(O)c1cn(C2CC2)c2cc(N3CCNCC3)c(F)cc2c1=O",
              "norfloxacin": "CCn1cc(C(=O)O)c(=O)c2cc(F)c(N3CCNCC3)cc21"}
    canon = {}
    for i in np.where(OK)[0]:
        # salts: match on the largest fragment too
        frags = Chem.GetMolFrags(MOLS[i], asMols=True)
        big = max(frags, key=lambda f: f.GetNumAtoms())
        canon.setdefault(Chem.MolToSmiles(big), []).append(int(i))
    OUT["probes"] = {}
    for name, s in probes.items():
        c = Chem.MolToSmiles(Chem.MolFromSmiles(s))
        hit = canon.get(c, [])
        OUT["probes"][name] = [{"row": i, "smiles": SMI[i], "y": int(Y[i]), "scaffold": SCAF[i]} for i in hit]
    ind = Chem.MolToSmiles(Chem.MolFromSmiles("c1ccc2[nH]ccc2c1"))
    OUT["indole_group"] = [{"row": int(i), "smiles": SMI[i], "y": int(Y[i])} for i in np.where(SCAF == ind)[0]]

    # Fingerprints for nearest-neighbour similarity and the forest
    gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
    FP = [gen.GetFingerprint(m) if ok else None for m, ok in zip(MOLS, OK)]
    X = np.zeros((len(MOLS), 2048), dtype=np.uint8)
    for i, fp in enumerate(FP):
        if fp is not None:
            DataStructs.ConvertToNumpyArray(fp, X[i])

    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import roc_auc_score, f1_score

    def nn(tr, te):
        trfp = [FP[i] for i in tr if OK[i]]
        trs = [i for i in tr if OK[i]]
        sim, who = [], []
        for i in te:
            if not OK[i]:
                continue
            s = np.array(DataStructs.BulkTanimotoSimilarity(FP[i], trfp))
            k = int(s.argmax())
            sim.append(float(s[k])); who.append(trs[k])
        return np.array(sim), np.array(who)

    per = {k: [] for k in SPLITS}
    for seed in SEEDS:
        for name, fn in SPLITS.items():
            tr, va, te = fn(seed)
            parts = {"train": tr, "val": va, "test": te}
            r = {"seed": seed}
            for p, ix in parts.items():
                ix_ok = ix[OK[ix]]
                r[p] = {"n": int(len(ix)), "actives": int(Y[ix].sum()),
                        "active_share": round(float(Y[ix].mean()), 4), "scaffolds": len(set(SCAF[ix]))}
            trs = set(SCAF[tr])
            te_ok = te[OK[te]]
            r["test_scaffold_in_train"] = round(float(np.mean([SCAF[i] in trs for i in te_ok])), 4)
            act = te_ok[Y[te_ok] == 1]
            r["test_actives_scaffold_in_train"] = int(sum(SCAF[i] in trs for i in act))
            sim, who = nn(tr, te)
            r["nn_sim_median"] = round(float(np.median(sim)), 3)
            r["nn_sim_over_0.7"] = round(float((sim > 0.7).mean()), 4)
            ya = Y[te_ok]
            r["actives_nn_active"] = round(float((Y[who][ya == 1] == 1).mean()), 3) if (ya == 1).any() else None
            r["nn_sim_hist"] = np.histogram(sim, bins=20, range=(0, 1))[0].tolist()
            r["nn_sim_hist_actives"] = np.histogram(sim[ya == 1], bins=20, range=(0, 1))[0].tolist()
            tr_ok = tr[OK[tr]]
            rf = RandomForestClassifier(n_estimators=500, class_weight="balanced", n_jobs=-1, random_state=seed)
            rf.fit(X[tr_ok], Y[tr_ok])
            p = rf.predict_proba(X[te_ok])[:, 1]
            r["rf_auc"] = round(float(roc_auc_score(ya, p)), 3)
            r["rf_macro_f1"] = round(float(f1_score(ya, (p >= 0.5).astype(int), average="macro")), 3)
            r["rf_actives_found"] = int(((p >= 0.5) & (ya == 1)).sum())
            per[name].append(r)
        print("seed", seed, round(time.time() - t0), "s", flush=True)
    OUT["per_seed"] = per

    def summ(key, name):
        v = [r[key] for r in per[name] if r[key] is not None]
        return {"mean": round(float(np.mean(v)), 3), "min": round(float(np.min(v)), 3), "max": round(float(np.max(v)), 3)}
    OUT["summary"] = {name: {k: summ(k, name) for k in
                             ("test_scaffold_in_train", "nn_sim_median", "nn_sim_over_0.7", "actives_nn_active", "rf_auc", "rf_macro_f1")}
                      for name in SPLITS}
    for name in SPLITS:
        OUT["summary"][name]["test_n"] = {"min": min(r["test"]["n"] for r in per[name]), "max": max(r["test"]["n"] for r in per[name])}
        OUT["summary"][name]["test_actives"] = {"min": min(r["test"]["actives"] for r in per[name]), "max": max(r["test"]["actives"] for r in per[name])}
    with open(os.path.join(HERE, "scaffold-split-measure.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(OUT, f, indent=1)
    print("wrote base", round(time.time() - t0), "s")


def gcn(seed):
    """Cell 42's GCNNet with cells 45-57's set-up; GCNConv written out from PyG."""
    import torch
    import torch.nn as nn
    torch.set_num_threads(4)
    ATOM_VOCAB = sorted({a.GetSymbol() for m, ok in zip(MOLS, OK) if ok for a in m.GetAtoms()})
    HYB = [Chem.HybridizationType.SP, Chem.HybridizationType.SP2, Chem.HybridizationType.SP3,
           Chem.HybridizationType.SP3D, Chem.HybridizationType.SP3D2]
    CHI = [Chem.ChiralType.CHI_UNSPECIFIED, Chem.ChiralType.CHI_TETRAHEDRAL_CW,
           Chem.ChiralType.CHI_TETRAHEDRAL_CCW]

    def graph(m):
        X = []
        for a in m.GetAtoms():
            v = [a.GetAtomicNum(), a.GetDegree(), a.GetTotalNumHs(), a.GetFormalCharge(),
                 float(a.GetIsAromatic()), float(a.IsInRing())]
            v += [float(a.GetSymbol() == s) for s in ATOM_VOCAB]
            v += [float(a.GetHybridization() == h) for h in HYB]
            v += [float(a.GetChiralTag() == c) for c in CHI]
            X.append(v)
        src, dst = [], []
        for b in m.GetBonds():
            i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
            src += [i, j]; dst += [j, i]
        return torch.tensor(X, dtype=torch.float), torch.tensor([src, dst], dtype=torch.long).reshape(2, -1)

    G = {i: graph(MOLS[i]) for i in np.where(OK)[0]}
    F_IN = next(iter(G.values()))[0].shape[1]

    def collate(ids):
        xs, eis, bs, off = [], [], [], 0
        for g, i in enumerate(ids):
            x, ei = G[i]
            xs.append(x); eis.append(ei + off); bs.append(torch.full((len(x),), g, dtype=torch.long)); off += len(x)
        return torch.cat(xs), torch.cat(eis, 1), torch.cat(bs), torch.tensor(Y[ids]), len(ids)

    class GCNConv(nn.Module):
        def __init__(self, fin, fout):
            super().__init__()
            self.lin = nn.Linear(fin, fout, bias=False)
            nn.init.xavier_uniform_(self.lin.weight)
            self.bias = nn.Parameter(torch.zeros(fout))

        def forward(self, x, ei):
            n = x.shape[0]
            loops = torch.arange(n)
            src, dst = torch.cat([ei[0], loops]), torch.cat([ei[1], loops])
            deg = torch.zeros(n).index_add_(0, dst, torch.ones(len(dst)))
            w = deg[src].rsqrt() * deg[dst].rsqrt()
            h = self.lin(x)
            return torch.zeros_like(h).index_add_(0, dst, w[:, None] * h[src]) + self.bias

    class GCNNet(nn.Module):
        def __init__(self, hidden=256, dropout=0.1):
            super().__init__()
            self.conv1, self.conv2 = GCNConv(F_IN, hidden), GCNConv(hidden, hidden)
            self.head = nn.Sequential(nn.Linear(hidden, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, 2))
            self.bn1, self.bn2 = nn.BatchNorm1d(hidden), nn.BatchNorm1d(hidden)
            self.act, self.drop = nn.ELU(), nn.Dropout(dropout)

        def forward(self, x, ei, b, B):
            x = self.drop(self.act(self.bn1(self.conv1(x, ei))))
            x = self.drop(self.act(self.bn2(self.conv2(x, ei))))
            g = torch.full((B, x.shape[1]), -1e30).scatter_reduce(0, b[:, None].expand(-1, x.shape[1]), x, "amax")
            return self.head(g)

    def macro_f1(y, pred):
        out = []
        for c in (0, 1):
            tp = int(((pred == c) & (y == c)).sum()); fp = int(((pred == c) & (y != c)).sum()); fn = int(((pred != c) & (y == c)).sum())
            out.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
        return sum(out) / 2

    def auc(y, p):
        order = np.argsort(-p); ranks = np.empty(len(p)); ranks[order] = np.arange(len(p))
        pos = ranks[y == 1]; npos, nneg = len(pos), len(y) - len(pos)
        return float(1 - (pos.sum() - npos * (npos - 1) / 2) / (npos * nneg)) if npos and nneg else None

    res = {"seed": seed}
    for name, fn in SPLITS.items():
        t0 = time.time()
        random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
        tr, va, te = (ix[OK[ix]] for ix in fn(seed))
        N1 = int(Y[tr].sum()); N0 = len(tr) - N1
        w = torch.tensor([len(tr) / (2 * N0), len(tr) / (2 * N1)], dtype=torch.float)
        model = GCNNet()
        opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", patience=3, factor=0.5)
        crit = nn.CrossEntropyLoss(weight=w)
        best, best_state, best_ep, bad = -1e9, None, 0, 0
        vx = collate(va)
        for ep in range(100):
            model.train()
            order = np.random.permutation(tr)
            for k in range(0, len(order), 64):
                x, ei, b, y, B = collate(order[k:k + 64])
                loss = crit(model(x, ei, b, B), y)
                opt.zero_grad(); loss.backward(); opt.step()
            model.eval()
            with torch.no_grad():
                out = model(vx[0], vx[1], vx[2], vx[4])
                vl = float(crit(out, vx[3])); vf = macro_f1(vx[3].numpy(), out.argmax(1).numpy())
            sched.step(vl)
            if vf > best + 1e-4:
                best, best_ep, bad = vf, ep + 1, 0
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
            else:
                bad += 1
                if bad >= 50:
                    break
        model.load_state_dict(best_state); model.eval()
        with torch.no_grad():
            x, ei, b, y, B = collate(te)
            out = model(x, ei, b, B)
        yt = y.numpy(); p = out.softmax(1)[:, 1].numpy(); pred = out.argmax(1).numpy()
        res[name] = {"test_macro_f1": round(macro_f1(yt, pred), 3), "test_auc": None if auc(yt, p) is None else round(auc(yt, p), 3),
                     "test_actives": int(yt.sum()), "actives_found": int(((pred == 1) & (yt == 1)).sum()),
                     "predicted_active": int(pred.sum()), "best_val_f1": round(best, 3), "best_epoch": best_ep,
                     "epochs_run": ep + 1, "seconds": round(time.time() - t0)}
        print(seed, name, res[name], flush=True)
    with open(os.path.join(HERE, f"scaffold-split-gcn-{seed}.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(res, f, indent=1)


if __name__ == "__main__":
    if sys.argv[1] == "base":
        base()
    else:
        gcn(int(sys.argv[2]))
