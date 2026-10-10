"""Slot 98 gnn-explainer: measure before the mock.

Run:  python widgets/_lab/gnn-explainer-measure.py train <seed>   (~minutes; writes gnn-explainer-gat-<seed>.pt)
      python widgets/_lab/gnn-explainer-measure.py explain        (reads every .pt; writes gnn-explainer-measure.json)
Needs torch, RDKit, scikit-learn; reads _lab/graph-fingat-training.csv (untracked).
Every output is untracked.

09-2 cells 84-92 run PyG's GNNExplainer (epochs 300, lr 0.01, node_mask_type
'attributes', edge_mask_type 'object', graph-level multiclass on raw logits) on
the lesson's trained GAT (cell 64) and test_set[3] under cell 28's seed-42
scaffold split, then collapse the masks the lesson's way (cell 90): an atom's
score is the mean |mask| over ALL its features, a bond's the max of its two
directions, each min-max scaled to 0-1 within the molecule.

torch_geometric is not installed, so both GATConv and GNNExplainer are written
out. GATConv is 95's (message-passing-trained.py). GNNExplainer was checked
against PyG master on 2026-10-10: default_coeffs edge_size 0.005 (sum),
edge_ent 1.0, node_feat_size 1.0 (mean), node_feat_ent 0.1, EPS 1e-15; node mask
init randn * 0.1, edge mask randn * gain('relu') * sqrt(2 / (2N)); Adam; the
hard masks are grad != 0 after the first step; post-processing is sigmoid then
zero outside the hard mask. The edge mask scales each layer's MESSAGE after
attention (MessagePassing.explain_message), self-loops fixed at 1, so the
softmax is not renormalised over the surviving edges.
"""
import glob, json, os, random, sys, time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from rdkit import Chem

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util
_spec = importlib.util.spec_from_file_location("ssm", os.path.join(HERE, "scaffold-split-measure.py"))
ssm = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(ssm)
MOLS, OK, Y, SMI = ssm.MOLS, ssm.OK, ssm.Y, ssm.SMI
torch.set_num_threads(8)

# cell 32 (sorted vocabulary: the lesson's list(set()) changes order between sessions)
ATOM_VOCAB = sorted({a.GetSymbol() for m, ok in zip(MOLS, OK) if ok for a in m.GetAtoms()})
HYB = [Chem.HybridizationType.SP, Chem.HybridizationType.SP2, Chem.HybridizationType.SP3,
       Chem.HybridizationType.SP3D, Chem.HybridizationType.SP3D2]
CHI = [Chem.ChiralType.CHI_UNSPECIFIED, Chem.ChiralType.CHI_TETRAHEDRAL_CW,
       Chem.ChiralType.CHI_TETRAHEDRAL_CCW]
BT = [Chem.BondType.SINGLE, Chem.BondType.DOUBLE, Chem.BondType.TRIPLE, Chem.BondType.AROMATIC]
FEAT_NAMES = ["atomic number", "degree", "hydrogens", "formal charge", "aromatic", "in ring"] + \
    [f"is {s}" for s in ATOM_VOCAB] + ["SP", "SP2", "SP3", "SP3D", "SP3D2"] + ["chiral none", "chiral CW", "chiral CCW"]

def graph(m):
    X = []
    for a in m.GetAtoms():
        v = [a.GetAtomicNum(), a.GetDegree(), a.GetTotalNumHs(), a.GetFormalCharge(),
             float(a.GetIsAromatic()), float(a.IsInRing())]
        v += [float(a.GetSymbol() == s) for s in ATOM_VOCAB]
        v += [float(a.GetHybridization() == h) for h in HYB]
        v += [float(a.GetChiralTag() == c) for c in CHI]
        X.append(v)
    src, dst, ea = [], [], []
    for b in m.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        f = [float(b.GetBondType() == t) for t in BT] + \
            [float(b.GetIsConjugated()), float(b.GetIsAromatic()), float(b.IsInRing())]
        src += [i, j]; dst += [j, i]; ea += [f, f]
    return (torch.tensor(X, dtype=torch.float), torch.tensor([src, dst], dtype=torch.long).reshape(2, -1),
            torch.tensor(ea, dtype=torch.float).reshape(-1, 7))

G = {int(i): graph(MOLS[i]) for i in np.where(OK)[0]}
F_IN = next(iter(G.values()))[0].shape[1]

def collate(ids):
    xs, eis, eas, bs, off = [], [], [], [], 0
    for g, i in enumerate(ids):
        x, ei, ea = G[int(i)]
        xs.append(x); eis.append(ei + off); eas.append(ea)
        bs.append(torch.full((len(x),), g, dtype=torch.long)); off += len(x)
    return torch.cat(xs), torch.cat(eis, 1), torch.cat(eas), torch.cat(bs), torch.tensor(Y[list(ids)]), len(ids)

def glorot_(t):
    b = (6 / (t.shape[-2] + t.shape[-1])) ** 0.5
    with torch.no_grad():
        t.uniform_(-b, b)
    return t

class GATConv(nn.Module):
    """95's write-out of PyG's GATConv, plus the explain hook: `edge_mask` (one value
    per directed edge, already sigmoided) scales each message; self-loops take 1."""
    def __init__(self, fin, fout, heads, edge_dim, concat, dropout):
        super().__init__()
        self.h, self.o, self.concat, self.p = heads, fout, concat, dropout
        self.W = nn.Parameter(glorot_(torch.empty(fin, heads * fout)))
        self.a_src = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.a_dst = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.We = nn.Parameter(glorot_(torch.empty(edge_dim, heads * fout)))
        self.a_e = nn.Parameter(glorot_(torch.empty(heads, fout)))
        self.bias = nn.Parameter(torch.zeros(heads * fout if concat else fout))
        self.edge_mask = None
        self.last_alpha = None

    def forward(self, x, ei, ea):
        n = x.shape[0]
        src, dst = ei
        fill = torch.zeros(n, ea.shape[1]).index_add_(0, dst, ea)
        cnt = torch.zeros(n).index_add_(0, dst, torch.ones(len(dst))).clamp(min=1)
        loops = torch.arange(n)
        src2, dst2 = torch.cat([src, loops]), torch.cat([dst, loops])
        ea2 = torch.cat([ea, fill / cnt[:, None]])
        Wx = (x @ self.W).view(n, self.h, self.o)
        e = (Wx[src2] * self.a_src).sum(-1) + (Wx[dst2] * self.a_dst).sum(-1) \
            + ((ea2 @ self.We).view(-1, self.h, self.o) * self.a_e).sum(-1)
        e = F.leaky_relu(e, 0.2)
        emax = torch.full((n, self.h), -1e30).scatter_reduce(0, dst2[:, None].expand(-1, self.h), e, "amax")
        ex = (e - emax[dst2]).exp()
        den = torch.zeros(n, self.h).index_add_(0, dst2, ex)
        alpha = ex / den[dst2]
        self.last_alpha = (alpha.detach(), src2, dst2)
        alpha = F.dropout(alpha, self.p, self.training)
        msg = alpha[:, :, None] * Wx[src2]
        if self.edge_mask is not None:
            msg = msg * torch.cat([self.edge_mask, torch.ones(n)])[:, None, None]
        out = torch.zeros(n, self.h, self.o).index_add_(0, dst2, msg)
        out = out.reshape(n, -1) if self.concat else out.mean(1)
        return out + self.bias

class GATNet(nn.Module):  # cell 64
    def __init__(self, hidden=256, heads1=4, dropout=0.1):
        super().__init__()
        self.gat1 = GATConv(F_IN, hidden, heads1, 7, True, dropout)
        self.gat2 = GATConv(hidden * heads1, hidden, 1, 7, False, dropout)
        self.head = nn.Sequential(nn.Linear(hidden, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, 2))
        self.bn1, self.bn2 = nn.BatchNorm1d(hidden * heads1), nn.BatchNorm1d(hidden)
        self.act, self.drop = nn.ELU(), nn.Dropout(dropout)

    def set_edge_mask(self, m):
        self.gat1.edge_mask = m; self.gat2.edge_mask = m

    def forward(self, x, ei, ea, batch, B, pooled=False):
        x = self.drop(self.bn1(self.act(self.gat1(x, ei, ea))))
        x = self.drop(self.bn2(self.act(self.gat2(x, ei, ea))))
        g = torch.full((B, x.shape[1]), -1e30).scatter_reduce(0, batch[:, None].expand(-1, x.shape[1]), x, "amax")
        if pooled:
            return self.head(g), x
        return self.head(g)

def macro_f1(y, pred):
    out = []
    for c in (0, 1):
        tp = int(((pred == c) & (y == c)).sum()); fp = int(((pred == c) & (y != c)).sum()); fn = int(((pred != c) & (y == c)).sum())
        out.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return sum(out) / 2

def split():
    tr, va, te = ssm.scaffold_split(42)
    return tr[OK[tr]], va[OK[va]], te[OK[te]]   # MoleculeDataset drops the unparsed row, order kept


def train(seed):
    """Cells 67-79: AdamW 1e-3, wd 1e-4, class-weighted CE, batch 64, ReduceLROnPlateau
    (patience 3, factor 0.5), 100 epochs, checkpoint on val macro F1 (+1e-4), patience 50."""
    t0 = time.time()
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    tr, va, te = split()
    N1 = int(Y[tr].sum()); N0 = len(tr) - N1
    crit = nn.CrossEntropyLoss(weight=torch.tensor([len(tr) / (2 * N0), len(tr) / (2 * N1)], dtype=torch.float))
    model = GATNet()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", patience=3, factor=0.5)
    vb = collate(va)
    best, best_state, best_ep, bad, curve = -1e9, None, 0, 0, []
    for ep in range(100):
        model.train()
        order = np.random.permutation(tr)
        for k in range(0, len(order), 64):
            x, ei, ea, b, y, B = collate(order[k:k + 64])
            loss = crit(model(x, ei, ea, b, B), y)
            opt.zero_grad(); loss.backward(); opt.step()
        model.eval()
        with torch.no_grad():
            out = model(*vb[:4], vb[5])
            vl = float(crit(out, vb[4])); vf = macro_f1(vb[4].numpy(), out.argmax(1).numpy())
        sched.step(vl)
        curve.append([round(vl, 4), round(vf, 3)])
        if vf > best + 1e-4:
            best, best_ep, bad = vf, ep + 1, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= 50:
                break
        print(seed, ep + 1, round(vl, 4), round(vf, 3), round(time.time() - t0), "s", flush=True)
    model.load_state_dict(best_state); model.eval()
    with torch.no_grad():
        x, ei, ea, b, y, B = collate(te)
        out = model(x, ei, ea, b, B)
    p = out.softmax(1)[:, 1].numpy(); pred = out.argmax(1).numpy(); yt = y.numpy()
    info = {"seed": seed, "best_val_f1": round(best, 3), "best_epoch": best_ep, "epochs_run": ep + 1,
            "test_macro_f1": round(macro_f1(yt, pred), 3), "test_actives": int(yt.sum()),
            "actives_found": int(((pred == 1) & (yt == 1)).sum()), "predicted_active": int(pred.sum()),
            "test": [{"pos": k, "row": int(r), "y": int(yt[k]), "p_active": round(float(p[k]), 4)} for k, r in enumerate(te)],
            "val_curve": curve, "seconds": round(time.time() - t0)}
    torch.save({"state": best_state, "info": info}, os.path.join(HERE, f"gnn-explainer-gat-{seed}.pt"))
    print({k: v for k, v in info.items() if k not in ("test", "val_curve")})


# ---------------------------------------------------------------- GNNExplainer

COEF = dict(edge_size=0.005, edge_ent=1.0, node_feat_size=1.0, node_feat_ent=0.1, EPS=1e-15)

def logits(model, x, ei, ea, emask=None):
    model.set_edge_mask(emask)
    out = model(x, ei, ea, torch.zeros(len(x), dtype=torch.long), 1)
    model.set_edge_mask(None)
    return out[0]

def gnn_explainer(model, x, ei, ea, target, seed, epochs=300, lr=0.01, trace_every=0):
    torch.manual_seed(seed)
    N, Fdim = x.shape; E = ei.shape[1]
    node_mask = nn.Parameter(torch.randn(N, Fdim) * 0.1)
    std = nn.init.calculate_gain("relu") * (2.0 / (2 * N)) ** 0.5
    edge_mask = nn.Parameter(torch.randn(E) * std)
    opt = torch.optim.Adam([node_mask, edge_mask], lr=lr)
    hard_n = hard_e = None
    trace = []
    for i in range(epochs):
        opt.zero_grad()
        h = x * node_mask.sigmoid()
        y_hat = logits(model, h, ei, ea, edge_mask.sigmoid())
        loss = F.cross_entropy(y_hat[None], torch.tensor([target]))
        pred_loss = float(loss)
        if hard_e is not None:
            m = edge_mask[hard_e].sigmoid()
            loss = loss + COEF["edge_size"] * m.sum()
            ent = -m * torch.log(m + COEF["EPS"]) - (1 - m) * torch.log(1 - m + COEF["EPS"])
            loss = loss + COEF["edge_ent"] * ent.mean()
        if hard_n is not None:
            m = node_mask[hard_n].sigmoid()
            loss = loss + COEF["node_feat_size"] * m.mean()
            ent = -m * torch.log(m + COEF["EPS"]) - (1 - m) * torch.log(1 - m + COEF["EPS"])
            loss = loss + COEF["node_feat_ent"] * ent.mean()
        loss.backward()
        opt.step()
        if i == 0:
            hard_n = node_mask.grad != 0.0
            hard_e = edge_mask.grad != 0.0
        if trace_every and (i % trace_every == 0 or i == epochs - 1):
            nmt = node_mask.detach().sigmoid() * hard_n
            with torch.no_grad():
                p_now = float(logits(model, x * node_mask.sigmoid(), ei, ea, edge_mask.sigmoid()).softmax(0)[target])
            trace.append({"epoch": i + 1, "pred_loss": round(pred_loss, 4), "loss": round(float(loss), 4), "p": round(p_now, 4),
                          "edge": [round(float(v), 3) for v in edge_mask.detach().sigmoid()],
                          "node": [round(float(v), 4) for v in nmt.mean(1)]})
    nm = node_mask.detach().sigmoid(); nm[~hard_n] = 0.0
    em = edge_mask.detach().sigmoid(); em[~hard_e] = 0.0
    return nm, em, hard_n, hard_e, trace

def collapse(ei, em):
    """Cell 90's collapse_edge_importance, before its min-max step."""
    imp = {}
    for (u, v), w in zip(ei.T.tolist(), em.tolist()):
        a, b = (u, v) if u < v else (v, u)
        imp[(a, b)] = max(w, imp.get((a, b), 0.0))
    return imp

def minmax(v):
    v = np.asarray(v, dtype=float)
    return (v - v.min()) / (v.max() - v.min() + 1e-8)

def spearman(a, b):
    ra = np.argsort(np.argsort(a)); rb = np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1])

def topk(v, k):
    return set(np.argsort(-np.asarray(v))[:k].tolist())


def explain():
    t0 = time.time()
    tr, va, te = split()
    paths = sorted(glob.glob(os.path.join(HERE, "gnn-explainer-gat-*.pt")))
    models = {}
    for p in paths:
        ck = torch.load(p, weights_only=False)
        m = GATNet(); m.load_state_dict(ck["state"]); m.eval()
        for prm in m.parameters():
            prm.requires_grad_(False)
        models[ck["info"]["seed"]] = (m, ck["info"])
    OUT = {"split": {"train": len(tr), "val": len(va), "test": len(te)}, "models": {}}
    for s, (m, info) in models.items():
        OUT["models"][s] = {k: v for k, v in info.items() if k not in ("test", "val_curve")}
        OUT["models"][s]["test_predictions"] = info["test"]

    row = int(te[3])
    mol = MOLS[row]
    frags = Chem.GetMolFrags(mol)
    x, ei, ea = G[row]
    bonds = [(b.GetBeginAtomIdx(), b.GetEndAtomIdx()) for b in mol.GetBonds()]
    bkey = [tuple(sorted(b)) for b in bonds]
    nonzero = (x != 0).sum(1).numpy()
    OUT["molecule"] = {"row": row, "smiles": SMI[row], "y": int(Y[row]), "atoms": len(x), "bonds": len(bonds),
                       "fragments": [list(f) for f in frags],
                       "symbols": [a.GetSymbol() for a in mol.GetAtoms()],
                       "charges": [a.GetFormalCharge() for a in mol.GetAtoms()],
                       "nonzero_features": nonzero.tolist(), "bond_list": bkey}
    big = max(frags, key=len)
    salt_atoms = [i for f in frags if f is not big for i in f]

    RUNS = 20
    OUT["runs"] = {}
    for s, (m, info) in models.items():
        with torch.no_grad():
            z = logits(m, x, ei, ea)
        pr = z.softmax(0)
        target = int(z.argmax())
        res = {"logits": [round(float(v), 4) for v in z], "p": [round(float(v), 4) for v in pr], "pred": target, "runs": []}
        for r in range(RUNS):
            nm, em, hn, he, trace = gnn_explainer(m, x, ei, ea, target, seed=r, trace_every=10 if r == 0 else 0)
            node_raw = nm.abs().mean(1).numpy()
            node_raw_nonzero_only = (nm.abs().sum(1) / hn.sum(1).clamp(min=1)).numpy()
            col = collapse(ei, em)
            edge_raw = np.array([col[k] for k in bkey])
            with torch.no_grad():
                p_soft = float(logits(m, x * nm, ei, ea, em).softmax(0)[target])
            run = {"seed": r, "node_raw": node_raw.round(4).tolist(), "node_raw_nonzero_only": node_raw_nonzero_only.round(4).tolist(),
                   "edge_raw": edge_raw.round(4).tolist(),
                   "node_imp": minmax(node_raw).round(4).tolist(), "edge_imp": minmax(edge_raw).round(4).tolist(),
                   "hard_node_entries": int(hn.sum()), "hard_edges": int(he.sum()), "p_with_soft_masks": round(p_soft, 4),
                   "feature_mask_mean_over_atoms": [round(float(v), 4) for v in (nm.sum(0) / hn.sum(0).clamp(min=1))]}
            if trace:
                run["trace"] = trace
            res["runs"].append(run)
        # gradient saliency and bond occlusion: the other two families of 09-1 cell 26
        xg = x.clone().requires_grad_(True)
        ms = torch.ones(ei.shape[1], requires_grad=True)
        zz = logits(m, xg, ei, ea, ms)
        zz[target].backward()
        res["saliency_node"] = (xg.grad.abs().sum(1)).numpy().round(5).tolist()
        res["saliency_edge"] = [round(max(abs(float(ms.grad[d])) for d in range(ei.shape[1]) if tuple(sorted(ei[:, d].tolist())) == k), 5) for k in bkey]
        occl = []
        with torch.no_grad():
            for k in bkey:
                mm = torch.ones(ei.shape[1])
                for d in range(ei.shape[1]):
                    if tuple(sorted(ei[:, d].tolist())) == k:
                        mm[d] = 0.0
                occl.append(float(pr[target]) - float(logits(m, x, ei, ea, mm).softmax(0)[target]))
        res["occlusion_edge"] = np.round(occl, 5).tolist()
        # atom occlusion: zero an atom's features (its messages still flow)
        aocc = []
        with torch.no_grad():
            for i in range(len(x)):
                xx = x.clone(); xx[i] = 0
                aocc.append(float(pr[target]) - float(logits(m, xx, ei, ea).softmax(0)[target]))
        res["occlusion_atom_zeroed"] = np.round(aocc, 5).tolist()
        OUT["runs"][s] = res
        print("explained model", s, round(time.time() - t0), "s", flush=True)

    # ---- the claims, on the lesson's model (42) and across models
    S = {}
    for s, res in OUT["runs"].items():
        runs = res["runs"]
        E = np.array([r["edge_imp"] for r in runs]); Nn = np.array([r["node_imp"] for r in runs])
        Er = np.array([r["edge_raw"] for r in runs]); Nr = np.array([r["node_raw"] for r in runs])
        pairs = [(a, b) for a in range(len(runs)) for b in range(a + 1, len(runs))]
        k = 5
        top_edges = [topk(e, k) for e in E]
        sc = {}
        sc["pred"] = res["pred"]; sc["p_pred"] = res["p"][res["pred"]]
        sc["edge_spearman_between_runs"] = {"median": round(float(np.median([spearman(E[a], E[b]) for a, b in pairs])), 3),
                                            "min": round(float(np.min([spearman(E[a], E[b]) for a, b in pairs])), 3)}
        sc["node_spearman_between_runs"] = {"median": round(float(np.median([spearman(Nn[a], Nn[b]) for a, b in pairs])), 3),
                                            "min": round(float(np.min([spearman(Nn[a], Nn[b]) for a, b in pairs])), 3)}
        sc["top5_bond_overlap_between_runs"] = {"median": float(np.median([len(top_edges[a] & top_edges[b]) for a, b in pairs])),
                                                "min": int(np.min([len(top_edges[a] & top_edges[b]) for a, b in pairs]))}
        cnt = np.zeros(len(bkey))
        for t in top_edges:
            for j in t:
                cnt[j] += 1
        sc["bonds_ever_in_top5"] = int((cnt > 0).sum()); sc["bonds_in_top5_every_run"] = int((cnt == len(runs)).sum())
        sc["edge_raw_range_per_run"] = {"median_min": round(float(np.median(Er.min(1))), 4), "median_max": round(float(np.median(Er.max(1))), 4),
                                        "median_sd": round(float(np.median(Er.std(1))), 4)}
        sc["node_raw_range_per_run"] = {"median_min": round(float(np.median(Nr.min(1))), 4), "median_max": round(float(np.median(Nr.max(1))), 4)}
        sc["edge_raw_share_over_0.5"] = round(float((Er > 0.5).mean()), 3)
        sc["edge_raw_share_between_0.1_and_0.9"] = round(float(((Er > 0.1) & (Er < 0.9)).mean()), 3)
        sc["p_with_soft_masks"] = {"median": float(np.median([r["p_with_soft_masks"] for r in runs]))}
        nmean = Nn.mean(0)
        sc["salt_atoms"] = [{"atom": i, "symbol": OUT["molecule"]["symbols"][i], "mean_node_imp": round(float(nmean[i]), 3),
                             "rank_of": int((nmean > nmean[i]).sum()) + 1} for i in salt_atoms]
        sc["node_imp_vs_nonzero_features_spearman"] = round(spearman(nmean, nonzero), 3)
        nz_only = np.array([r["node_raw_nonzero_only"] for r in runs]).mean(0)
        sc["node_imp_nonzero_only_vs_nonzero_features_spearman"] = round(spearman(nz_only, nonzero), 3)
        emean = E.mean(0)
        sc["edge_vs_occlusion_spearman"] = round(spearman(emean, res["occlusion_edge"]), 3)
        sc["edge_vs_saliency_spearman"] = round(spearman(emean, res["saliency_edge"]), 3)
        sc["node_vs_saliency_spearman"] = round(spearman(nmean, res["saliency_node"]), 3)
        sc["occlusion_edge_range"] = [round(float(min(res["occlusion_edge"])), 4), round(float(max(res["occlusion_edge"])), 4)]
        # fidelity: delete the k bonds ranked highest by run 0 vs k random bonds
        m = models[int(s)][0]
        rng = np.random.default_rng(0)
        fid = {}
        with torch.no_grad():
            p0 = res["p"][res["pred"]]
            def drop(sel):
                mm = torch.ones(ei.shape[1])
                for d in range(ei.shape[1]):
                    if tuple(sorted(ei[:, d].tolist())) in sel:
                        mm[d] = 0.0
                return float(logits(m, x, ei, ea, mm).softmax(0)[res["pred"]])
            for kk in (1, 3, 5, 10):
                tops = [drop({bkey[j] for j in topk(E[r], kk)}) for r in range(len(runs))]
                rand = [drop({bkey[j] for j in rng.choice(len(bkey), kk, replace=False)}) for _ in range(200)]
                fid[kk] = {"p_after_top_median": round(float(np.median(tops)), 4),
                           "p_after_random_median": round(float(np.median(rand)), 4),
                           "p_after_random_5_95": [round(float(np.percentile(rand, 5)), 4), round(float(np.percentile(rand, 95)), 4)],
                           "share_random_lower_than_top": round(float(np.mean(np.array(rand) < np.median(tops))), 3)}
            # sufficiency: keep only the top k bonds
            for kk in (5, 10):
                keep = topk(E[0], kk)
                fid[f"keep_only_top{kk}"] = round(drop({bkey[j] for j in range(len(bkey)) if j not in keep}), 4)
            fid["no_bonds"] = round(drop(set(bkey)), 4)
        sc["fidelity"] = fid
        # Each run as the subgraph it keeps (bond mask > 0.5): does that set alone keep the
        # prediction, against random sets of its size? and do two runs keep the same set?
        kept_sets, sub = [], []
        bl = sorted(set(bkey))
        with torch.no_grad():
            for r in runs:
                kept = {bkey[j] for j, v in enumerate(r["edge_raw"]) if v > 0.5}
                kept_sets.append(kept)
                p_only = drop(set(bkey) - kept)
                ps = [drop(set(bkey) - {bl[j] for j in rng.choice(len(bl), len(kept), replace=False)}) for _ in range(100)]
                sub.append({"run": r["seed"], "kept": len(kept), "p_only_kept": round(p_only, 4),
                            "p_random_same_size_median": round(float(np.median(ps)), 4),
                            "share_random_at_or_above": round(float(np.mean(np.array(ps) >= p_only)), 3)})
        J = [len(a & b) / len(a | b) for i, a in enumerate(kept_sets) for b in kept_sets[i + 1:]]
        every = set.intersection(*kept_sets)
        sc["subgraphs"] = {"per_run": sub, "jaccard_median": round(float(np.median(J)), 3),
                           "jaccard_range": [round(min(J), 3), round(max(J), 3)],
                           "kept_in_every_run": sorted([list(k) for k in every]),
                           "kept_in_any_run": len(set.union(*kept_sets)),
                           "kept_count_per_bond": [sum(k in s_ for s_ in kept_sets) for k in bkey]}
        S[s] = sc
    seeds = sorted(OUT["runs"].keys())
    if len(seeds) > 1:
        cross = []
        for a in range(len(seeds)):
            for b in range(a + 1, len(seeds)):
                Ea = np.array([r["edge_imp"] for r in OUT["runs"][seeds[a]]["runs"]]).mean(0)
                Eb = np.array([r["edge_imp"] for r in OUT["runs"][seeds[b]]["runs"]]).mean(0)
                cross.append({"models": [seeds[a], seeds[b]], "edge_spearman_of_run_means": round(spearman(Ea, Eb), 3),
                              "top5_overlap": len(topk(Ea, 5) & topk(Eb, 5))})
        S["across_models"] = cross
    OUT["summary"] = S
    with open(os.path.join(HERE, "gnn-explainer-measure.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(OUT, f, indent=1)
    print(json.dumps(S, indent=1))
    print("wrote", round(time.time() - t0), "s")


if __name__ == "__main__":
    if sys.argv[1] == "train":
        train(int(sys.argv[2]))
    else:
        explain()
