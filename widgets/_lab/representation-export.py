"""Slot 104: write widgets/representation/data.js from the trained checkpoints.

Run representation-measure.py and representation-umap.py first (they train the
four 10-1b models and lay out the maps); this reads their checkpoints and JSON.

  python -I widgets/_lab/representation-export.py "<...>/_scratch/frontiers-data"

Run representation-checkpoints.py too: the strips, the loss curves and the
contrastive matrices are read from its ten checkpoints (0, 5, 20, 50, 100, 200
batches; epochs 1, 2, 5, 10), the last of which equals the saved model.

Everything the widget draws is computed here, nothing in the browser:
  LABELS   the digits of the 2,000 test images drawn on every map
  MAPS     per page, untrained and trained: the notebook's UMAP of those 2,000,
           x and y scaled together into 0..65535 (Uint16, base64)
  KNN      per page, untrained and trained: 5-NN accuracy of the full embedding
           (10,000 test digits against 10,000 training digits, cosine)
  PICKS    the first test image of each digit 0..9, and Masked's hidden pixels
  CHECK    per page, at each checkpoint: the ten picks' outputs (one base64
           string of 10 x 784 bytes a checkpoint), the autoencoder's codes,
           Contrastive's view-similarity matrix; the training loss per 10
           batches; Contrastive's two views of each pick and their parameters
  TEST     per page, untrained and trained, the page's loss over the test set
"""
import base64, json, os, sys
import numpy as np, torch, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "representation-measure.py"), encoding="utf-8").read()
exec(src.split("# ---- training")[0])
CKPT = os.path.join(sys.argv[1], "models-104")
OUT = os.path.join(HERE, "..", "representation", "data.js")

PAGES = {"autoencoder": ("ae", lambda: AutoEncoderConv(1, 64, 16), "z_vec"),
         "masked": ("masked_b", lambda: MaskedPredictorB(1, 64, 64), "z_vec"),
         "contrastive": ("simclr", lambda: Encoder(1, 64, 128, 64), "z (embed_fc)")}


def pair(make, name):
    seed_all(42); u = make().eval()
    t = make(); t.load_state_dict(torch.load(os.path.join(CKPT, name + ".pt"))); t.eval()
    return {"untrained": u, "trained": t}


b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
u8 = lambda x: np.clip(np.round(x.squeeze().numpy() * 255), 0, 255).astype(np.uint8)

meas = json.load(open(os.path.join(HERE, "representation-measure.json")))["rows"]
umap_ = json.load(open(os.path.join(HERE, "representation-umap.json")))
maps = {m["embedding"]: np.array(m["xy"]) for m in umap_["maps"]}
yte = Yte.numpy()
picks = [int(np.where(yte == d)[0][0]) for d in range(10)]
X = Xte[picks]

out = {"LABELS": "".join(str(d) for d in umap_["keep_labels"]), "MAPS": {}, "KNN": {}, "PICKS": {"x": [b64(u8(v)) for v in X]},
       "TEST": {}, "N_MAP": len(umap_["keep_labels"])}

for page, (name, make, emb) in PAGES.items():
    M = pair(make, name)
    out["MAPS"][page] = {}
    for w in ("untrained", "trained"):
        P = maps[f"{name} {w}"]
        c = (P.max(0) + P.min(0)) / 2; span = (P.max(0) - P.min(0)).max()
        q = np.round(((P - c) / span + 0.5) * 65535).astype(np.uint16)
        out["MAPS"][page][w] = b64(q.flatten())
    out["KNN"][page] = {w: next(r["knn5"] for r in meas if r["model"] == name and r["embedding"].startswith(emb)
                                and ("untrained" in r["embedding"]) == (w == "untrained")) for w in ("untrained", "trained")}
    pk, ts = {}, {}
    with torch.no_grad():
        if page in ("autoencoder", "sparse"):
            for w, m in M.items():
                xh, z = m(X)
                pk[w] = {"xhat": [b64(u8(v)) for v in xh], "z": np.round(z.numpy(), 3).tolist()}
                se, zero, n = 0.0, 0.0, 0
                for i in range(0, 10000, 500):
                    xb = Xte[i:i + 500]; xh_, z_ = m(xb)
                    se += F.mse_loss(xh_, xb, reduction="sum").item(); zero += (z_.abs() < 1e-6).float().sum().item(); n += len(xb)
                ts[w] = {"mse": se / (n * 784), "zero": zero / (n * z.shape[1])}
        elif page == "masked":
            torch.manual_seed(7); xm, mask = random_mask(X, 0.5)
            pk["mask"] = [b64(np.packbits(v.squeeze().numpy().astype(np.uint8).flatten())) for v in mask]
            for w, m in M.items():
                pk[w] = {"xhat": [b64(u8(v)) for v in m(xm)[0]]}
                torch.manual_seed(70); se, nm = 0.0, 0.0
                for i in range(0, 10000, 500):
                    xb = Xte[i:i + 500]; xm_, mk = random_mask(xb, 0.5); xh_ = m(xm_)[0]
                    se += ((xh_ - xb) ** 2 * mk).sum().item(); nm += mk.sum().item()
                ts[w] = {"mse": se / nm}
        else:
            torch.manual_seed(11); v1 = augment(X); v2 = augment(X)
            pk["v1"] = [b64(u8(v)) for v in v1]; pk["v2"] = [b64(u8(v)) for v in v2]
            out["SIM"] = {}
            for w, m in M.items():
                p1 = F.normalize(m(v1)[1], dim=1); p2 = F.normalize(m(v2)[1], dim=1)
                out["SIM"][w] = np.round((p1 @ p2.T).numpy(), 3).tolist()
                # over the test set, in batches of 128 as the notebook trains
                torch.manual_seed(110); dg, off, nd, no = 0.0, 0.0, 0, 0
                for i in range(0, 10000 - 127, 128):
                    xb = Xte[i:i + 128]
                    a = F.normalize(m(augment(xb))[1], dim=1); b = F.normalize(m(augment(xb))[1], dim=1)
                    S = a @ b.T; d = S.diagonal()
                    dg += d.sum().item(); nd += len(d); off += (S.sum() - d.sum()).item(); no += S.numel() - len(d)
                ts[w] = {"matched": dg / nd, "others": off / no}
    out["PICKS"][page] = pk
    out["TEST"][page] = {w: {k: round(v, 5) for k, v in d.items()} for w, d in ts.items()}
    print(page, out["KNN"][page], out["TEST"][page], flush=True)

js = ("/* GENERATED by widgets/_lab/representation-export.py from the 10-1b models trained by\n"
      "   _lab/representation-measure.py (seed 42, the notebook's settings). Do not edit by hand. */\n")
# ---- the checkpoints
CK = {page: torch.load(os.path.join(CKPT, f"checkpoints-{PAGES[page][0]}.pt"), weights_only=False) for page in PAGES}
out["CHECK"] = {"steps": CK["autoencoder"]["steps"], "per_epoch": 469}
for page, C in CK.items():
    assert C["same"], f"{page}: the last checkpoint is not the saved model"
    S = [C["snaps"][s] for s in C["steps"]]
    bl = np.array(C["batch_loss"]); bl = bl[: len(bl) // 10 * 10].reshape(-1, 10).mean(1)
    pg = {"curve": [round(float(v), 5) for v in bl], "test": [round(s["loss"], 5) for s in S]}
    if "xhat" in S[0]:
        pg["xhat"] = [b64(np.clip(np.round(s["xhat"].reshape(10, 784) * 255), 0, 255).astype(np.uint8)) for s in S]
    if "z" in S[0]: pg["z"] = [np.round(s["z"], 3).tolist() for s in S]
    if "sim" in S[0]:
        pg["sim"] = [np.round(s["sim"], 3).tolist() for s in S]
        V = C["views"]
        pg["views"] = {"p1": V["p1"], "p2": V["p2"],
                       "v1": b64(np.clip(np.round(V["v1"].reshape(10, 784) * 255), 0, 255).astype(np.uint8)),
                       "v2": b64(np.clip(np.round(V["v2"].reshape(10, 784) * 255), 0, 255).astype(np.uint8))}
    out["CHECK"][page] = pg
out["PICKS"] = {"x": out["PICKS"]["x"], "mask": out["PICKS"]["masked"]["mask"]}

for k in ("N_MAP", "LABELS", "KNN", "TEST", "MAPS", "PICKS", "CHECK"):
    js += f"export const {k} = {json.dumps(out[k], separators=(',', ':'))};\n"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8", newline="\n").write(js)
print("wrote", os.path.normpath(OUT), len(js), "bytes")
