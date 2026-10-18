"""Slot 106 mock data, from the checkpoints `vae-measure.py train` wrote.

For each 2-D model (ae2, vae2, cvae2): the test codes mu of 2,000 test images
with their digits, and the decoder's weights, so the mock decodes any clicked
point exactly (a 2-D decoder is ~40k numbers; the CVAE's ~240k with its
Linear over [z || c]). A reference decode is stored to check the JS against.
For each 16-D model: 16 draws from N(0, I) decoded, as cell 19 (and cell 40
per label for the CVAE), with our classifier's reading for the notes.

  python -I widgets/_lab/vae-mockdata.py "<...>/_scratch/frontiers-data"
writes widgets/_lab/vae-mock-data.json (untracked).
"""
import importlib.util, json, os, sys
import torch, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("vm", os.path.join(HERE, "vae-measure.py"))
sys.argv = [sys.argv[0], sys.argv[1], "none"]
vm = importlib.util.module_from_spec(spec); spec.loader.exec_module(vm)


def r(t, n=5):
    return [float(f"{v:.{n}g}") for v in t.flatten().tolist()]


def u8(imgs):
    return [[int(round(v * 255)) for v in im.flatten().tolist()] for im in imgs]


clf = vm.Classifier(); clf.load_state_dict(torch.load(os.path.join(vm.CKPT, "clf.pt"), weights_only=True)); clf.eval()
txt = vm.txt_encoder()
C = txt(torch.arange(10))
out = {"c": [r(C[d]) for d in range(10)]}
N = 2000
with torch.no_grad():
    for kind in ("ae", "vae", "cvae"):
        m = vm.load(kind, 2)
        xs, ys = vm.Xte[:N], vm.Yte[:N]
        if kind == "cvae":
            mu, _ = m.encoder(xs, txt(ys))
        else:
            mu, _ = m.encoder(xs)
        dec = m.decoder
        lin = dec.expand[0]; d1 = dec.deconv[0]; d2 = dec.deconv[2]
        zref = torch.tensor([[0.5, -0.3]])
        ref = dec(zref, C[3:4]) if kind == "cvae" else dec(zref)
        out[kind + "2"] = {
            "codes": [round(v, 2) for v in mu.flatten().tolist()], "digits": ys.tolist(),
            "W": {"lin_w": r(lin.weight), "lin_b": r(lin.bias), "lin_in": lin.in_features,
                  "relu_after_lin": kind == "cvae",
                  "d1_w": r(d1.weight), "d1_b": r(d1.bias), "d2_w": r(d2.weight), "d2_b": r(d2.bias)},
            "ref": {"z": [0.5, -0.3], "label": 3 if kind == "cvae" else None, "img": r(ref, 4)},
        }
        m16 = vm.load(kind, 16)
        torch.manual_seed(106)
        z = torch.randn(16, 16)
        sets = [m16.decoder(z, C[d:d + 1].expand(16, -1)) for d in range(10)] if kind == "cvae" else [m16.decoder(z)]
        grids = []
        for g in sets:
            p = F.softmax(clf(g), 1); top, arg = p.max(1)
            grids.append({"imgs": u8(g), "read": arg.tolist(), "p": [round(v, 3) for v in top.tolist()],
                          "nearestL2": [round(v, 2) for v in vm.nearest(g).tolist()]})
        out[kind + "16"] = grids if kind == "cvae" else grids[0]
        print(kind, "16-D reads", [g["read"] for g in grids][:2])
json.dump(out, open(os.path.join(HERE, "vae-mock-data.json"), "w"), separators=(",", ":"))
print("wrote", os.path.getsize(os.path.join(HERE, "vae-mock-data.json")) // 1024, "KB")
