"""MONAI's own transforms run on small arrays, so slot 62 `augmentation` prints
what MONAI does rather than what its docstrings were read to say. PHM5005 06-3
cell 19 is the pipeline; the arguments below are its arguments unless a check
needs a larger one to make a direction unambiguous.

    python widgets/_lab/augmentation-monai.py

Writes `widgets/_lab/augmentation-monai.txt` (the findings, one line each) and
`widgets/_lab/augmentation-monai.json` (the arrays: `_lab/augmentation-measure.mjs`
reimplements every transform and must reproduce them). Needs torch, MONAI and
Pillow: `pip install --no-deps monai` is the notebook's own line (cell 17), and
Pillow is what `LoadImaged` reads a PNG or JPG with.

ARRAYS ARE MONAI'S ORDER, [C, X, Y]. MONAI loads a 2D image x-first (the
reader check below is the proof), so "file orientation" in the findings means
the picture as the file draws it: x to the right, y down. A direction on screen
is only ever stated in that orientation.
"""

import io
import json
import os
import sys
import tempfile

import numpy as np
import torch
from PIL import Image

import monai
from monai.data import CacheDataset
from monai.transforms import (
    Affine,
    AsDiscrete,
    AdjustContrast,
    Compose,
    EnsureChannelFirstd,
    Flip,
    LoadImaged,
    MapTransform,
    RandAffined,
    RandFlipd,
    RandGaussianNoised,
    RandRotate90d,
    Rotate90,
    ScaleIntensity,
)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_TXT = os.path.join(HERE, "augmentation-monai.txt")
OUT_JSON = os.path.join(HERE, "augmentation-monai.json")

lines = []
data = {"monai": monai.__version__, "torch": torch.__version__}


def say(s):
    lines.append(s)


def np_(t):
    return np.asarray(torch.as_tensor(t).detach().cpu().numpy(), dtype=np.float64)


def r7(a):
    return np.round(np.asarray(a, dtype=np.float64), 7).tolist()


def centroid_xy(img):
    """Intensity-weighted centroid of a [1, X, Y] array, as (x, y)."""
    a = np_(img)[0]
    s = a.sum()
    xs = np.arange(a.shape[0])[:, None]
    ys = np.arange(a.shape[1])[None, :]
    return float((a * xs).sum() / s), float((a * ys).sum() / s)


say(f"MONAI {monai.__version__}, torch {torch.__version__}, numpy {np.__version__}")

# ---------------------------------------------------------------------------
# 1. The reader: which order does LoadImaged + EnsureChannelFirstd return?
# ---------------------------------------------------------------------------
tmp = tempfile.mkdtemp()
H, W = 3, 5
grey = (np.arange(H * W).reshape(H, W) * 10 + 5).astype(np.uint8)  # grey[y, x]
rgb = np.zeros((H, W, 3), np.uint8)
rgb[..., 0] = grey
Image.fromarray(grey, mode="L").save(os.path.join(tmp, "g.png"))
Image.fromarray(rgb, mode="RGB").save(os.path.join(tmp, "c.png"))
d = LoadImaged(keys=["g", "c"])({"g": os.path.join(tmp, "g.png"), "c": os.path.join(tmp, "c.png")})
d = EnsureChannelFirstd(keys=["g", "c"])(d)
g = np_(d["g"])
c = np_(d["c"])
xfirst = all(g[0, x, y] == grey[y, x] for x in range(W) for y in range(H))
say(f"reader: a {H}-row x {W}-column PNG loads as grey {tuple(g.shape)}, RGB {tuple(c.shape)}; "
    f"value[0, x, y] == file[y, x] for every pixel: {xfirst}")
try:
    chosen = [type(r).__name__ for r in LoadImaged(keys="g")._loader.readers
              if r.verify_suffix(os.path.join(tmp, "g.png"))]
    say(f"reader: readers that accept .png, in registration order: {chosen} (the last is tried first)")
except Exception as exc:  # a private attribute; the finding above does not depend on it
    say(f"reader: could not list the readers ({type(exc).__name__})")
# What cell 27's permute(1, 2, 0) then draws: rows = x, columns = y.
drawn = np.transpose(c, (1, 2, 0))[..., 0]
say(f"reader: cell 27's permute(1,2,0) gives an array of shape {drawn.shape} for a file of "
    f"{H} rows x {W} columns, so matplotlib draws it transposed: {bool(np.array_equal(drawn, grey.T))}")
data["reader"] = {"file_rows": H, "file_cols": W, "grey_shape": list(g.shape),
                  "rgb_shape": list(c.shape), "x_first": bool(xfirst)}

# ---------------------------------------------------------------------------
# 2. Flip and Rotate90 on an x-first array with distinct values.
# ---------------------------------------------------------------------------
X, Y = 4, 3
a = torch.arange(X * Y, dtype=torch.float32).reshape(1, X, Y)  # value = x * Y + y
f0 = np_(Flip(spatial_axis=0)(a))
f1 = np_(Flip(spatial_axis=1)(a))
an = np_(a)
f0_reverses_x = bool(np.array_equal(f0[0], an[0, ::-1, :]))
f1_reverses_y = bool(np.array_equal(f1[0], an[0, :, ::-1]))
say(f"flip: spatial_axis=0 reverses x (a left-right mirror in file orientation): {f0_reverses_x}; "
    f"spatial_axis=1 reverses y (top-bottom): {f1_reverses_y}")


def where(arr, value):
    idx = np.argwhere(arr[0] == value)[0]
    return int(idx[0]), int(idx[1])  # (x, y)


r1 = np_(Rotate90(k=1, spatial_axes=(0, 1))(a))
corners = {"top-left": (0, 0), "top-right": (X - 1, 0), "bottom-left": (0, Y - 1), "bottom-right": (X - 1, Y - 1)}
moved = {}
for name, (x0, y0) in corners.items():
    v = an[0, x0, y0]
    x1, y1 = where(r1, v)
    nx, ny = r1.shape[1], r1.shape[2]
    label = ("top" if y1 == 0 else "bottom" if y1 == ny - 1 else "?") + "-" + \
            ("left" if x1 == 0 else "right" if x1 == nx - 1 else "?")
    moved[name] = label
cw = moved["top-left"] == "top-right"
ccw = moved["top-left"] == "bottom-left"
say(f"rot90: k=1 sends the file's corners {moved}; that is a quarter turn "
    f"{'clockwise' if cw else 'counter-clockwise' if ccw else '(neither)'} in file orientation")
data["flip_rot90"] = {"flip0_reverses_x": f0_reverses_x, "flip1_reverses_y": f1_reverses_y,
                      "rot90_k1_corners": moved,
                      "rot90_k1_turn": "clockwise" if cw else "counter-clockwise" if ccw else "neither"}

# RandRotate90d(max_k=3): which k does it draw, and how often?
kc = {1: 0, 2: 0, 3: 0}
rr = RandRotate90d(keys=["image"], prob=1.0, max_k=3)
rr.set_random_state(seed=7)
for _ in range(3000):
    out = np_(rr({"image": a})["image"])
    for k in (1, 2, 3):
        ref = np_(torch.rot90(a, k, dims=(1, 2)))
        if out.shape == ref.shape and np.array_equal(out, ref):
            kc[k] += 1
            break
say(f"rot90: RandRotate90d(prob=1, max_k=3) over 3000 draws gave k=1,2,3 counts {kc}")
data["rot90_k_counts"] = kc

# ---------------------------------------------------------------------------
# 3. The affine's directions: a 3 x 3 blob right of centre on a 33 x 33 image.
# ---------------------------------------------------------------------------
N = 33
ctr = (N - 1) / 2  # 16
blob = torch.zeros(1, N, N)
bx, by = 24, 16
blob[0, bx - 1:bx + 2, by - 1:by + 2] = 1.0
cx0, cy0 = centroid_xy(blob)


def aff(img, mode="bilinear", **kw):
    """MONAI's deterministic Affine with cell 19's padding; its other defaults as shipped."""
    return Affine(padding_mode="zeros", mode=mode, image_only=True, **kw)(img)


rot = centroid_xy(aff(blob, rotate_params=0.5))
tra = centroid_xy(aff(blob, translate_params=(4.0, 0.0)))
sca = centroid_xy(aff(blob, scale_params=(2.0, 1.0)))
turn = "counter-clockwise" if rot[1] < cy0 else "clockwise"
say(f"affine: the blob starts at (x, y) = ({cx0:.2f}, {cy0:.2f}), centre {ctr}")
say(f"affine: rotate_params=+0.5 rad moves it to ({rot[0]:.2f}, {rot[1]:.2f}), a turn {turn} "
    f"in file orientation (expected radius {bx - ctr:.0f}, angle {np.degrees(np.arctan2(rot[1] - ctr, rot[0] - ctr)):.1f} deg)")
say(f"affine: translate_params=(+4, 0) moves it to x = {tra[0]:.2f}: the content moves "
    f"{'-4' if tra[0] < cx0 else '+4'} px in x")
say(f"affine: scale_params=(2, 1) moves it to x = {sca[0]:.2f} (offset {cx0 - ctr:.0f} -> {sca[0] - ctr:.2f}): "
    f"a factor of 2 makes the content {'half as wide (smaller)' if abs(sca[0] - ctr) < abs(cx0 - ctr) else 'twice as wide (larger)'}")
data["affine_directions"] = {
    "start": [cx0, cy0], "centre": ctr,
    "rotate_0.5": list(rot), "rotate_turn": turn,
    "translate_4_0": list(tra), "scale_2_1": list(sca),
}

# ---------------------------------------------------------------------------
# 4. Affine arrays for the engine to reproduce: bilinear and nearest, zeros.
# ---------------------------------------------------------------------------
S = 32
xs = np.arange(S)[:, None]
ys = np.arange(S)[None, :]
pattern = ((xs * 7 + ys * 13) % 17) / 16.0
pattern[20:27, 5:11] = 1.0  # an off-centre block, x 20..26, y 5..10
pattern = torch.tensor(pattern[None], dtype=torch.float32)
cases = []
for params in (
    {"rotate_params": 0.2},
    {"translate_params": (3.0, -2.0)},
    {"scale_params": (1.1, 0.9)},
    {"rotate_params": 0.2, "translate_params": (3.0, -2.0), "scale_params": (1.1, 0.9)},
    {"rotate_params": -0.17, "translate_params": (-5.5, 7.25), "scale_params": (0.92, 1.08)},
):
    for mode in ("bilinear", "nearest"):
        out = aff(pattern, mode=mode, **params)
        cases.append({"params": {k: (list(v) if isinstance(v, tuple) else v) for k, v in params.items()},
                      "mode": mode, "out": r7(np_(out)[0])})
data["affine_arrays"] = {"size": S, "in": r7(np_(pattern)[0]), "cases": cases}
say(f"affine: {len(cases)} arrays dumped ({S} x {S}, zeros padding) for the engine to reproduce")

# ---------------------------------------------------------------------------
# 5. RandAffined with cell 19's arguments, prob forced to 1: drawn parameters
#    and outputs, image bilinear and label nearest through one call.
# ---------------------------------------------------------------------------
disc = ((xs - 20.0) ** 2 + (ys - 11.0) ** 2 <= 36.0).astype(np.float32)  # off-centre disc
rand_cases = []
ra = RandAffined(keys=["image", "label"], prob=1.0,
                 rotate_range=np.deg2rad(10.0), translate_range=(8, 8), scale_range=(0.1, 0.1),
                 padding_mode="zeros", mode=("bilinear", "nearest"))
ra.set_random_state(seed=62)
# READ THE MATRIX, NOT THE PARAMETERS. RandAffined builds its grid from one draw
# (RandAffineGrid.__call__ randomizes by default), then calls RandAffine per key
# with randomize=True, which draws the parameters AGAIN and does not use them
# because the grid is passed in. After the call, `rotate_params` & co. hold the
# last unused draw; `get_transformation_matrix()` holds the matrix applied.
# First measured 2026-09-15: parameters read back reproduced nothing (max 1.0).
for _ in range(4):
    outd = ra({"image": pattern.clone(), "label": torch.tensor(disc[None])})
    mat = np_(ra.rand_affine.rand_affine_grid.get_transformation_matrix())
    lin = mat[:2, :2]
    theta = float(np.arctan2(lin[1, 0], lin[0, 0]))
    sx = float(np.hypot(lin[0, 0], lin[1, 0]))
    sy = float(np.hypot(lin[0, 1], lin[1, 1]))
    c_, s_ = np.cos(theta), np.sin(theta)
    t = np.array([[c_, s_], [-s_, c_]]) @ mat[:2, 2]  # R^-1 applied to the translation column
    rand_cases.append({
        "matrix": r7(mat),
        "rotate": [theta], "translate": [float(t[0]), float(t[1])], "scale": [sx, sy],
        "image": r7(np_(outd["image"])[0]),
        "label": r7(np_(outd["label"])[0]),
    })
labels_binary = all(set(np.unique(np.asarray(rc["label"]))) <= {0.0, 1.0} for rc in rand_cases)
say("randaffined: drawn (rotate deg, translate px, scale) = " + "; ".join(
    f"({np.degrees(rc['rotate'][0]):+.2f}, ({rc['translate'][0]:+.2f}, {rc['translate'][1]:+.2f}), "
    f"({rc['scale'][0]:.3f}, {rc['scale'][1]:.3f}))" for rc in rand_cases))
say(f"randaffined: the label stays 0/1 under mode=('bilinear','nearest'): {labels_binary}")
data["randaffined"] = {"disc": r7(disc), "cases": rand_cases}

# Draw ranges over many samples: are the three draws uniform on cell 19's ranges?
rot_d, tr_d, sc_d = [], [], []
probe = {"image": torch.zeros(1, 8, 8), "label": torch.zeros(1, 8, 8)}
ra.set_random_state(seed=1)
for _ in range(4000):
    ra(probe)
    mat = np_(ra.rand_affine.rand_affine_grid.get_transformation_matrix())
    theta = float(np.arctan2(mat[1, 0], mat[0, 0]))
    c_, s_ = np.cos(theta), np.sin(theta)
    rot_d.append(theta)
    tr_d.extend((np.array([[c_, s_], [-s_, c_]]) @ mat[:2, 2]).tolist())
    sc_d.extend([float(np.hypot(mat[0, 0], mat[1, 0])), float(np.hypot(mat[0, 1], mat[1, 1]))])
say(f"randaffined: 4000 applied matrices, rotate deg in [{np.degrees(min(rot_d)):.2f}, {np.degrees(max(rot_d)):.2f}] "
    f"(sd {np.degrees(np.std(rot_d)):.2f}, uniform sd {10 / np.sqrt(3):.2f}); translate in "
    f"[{min(tr_d):.2f}, {max(tr_d):.2f}]; scale in [{min(sc_d):.3f}, {max(sc_d):.3f}], two scale values a draw; "
    f"corr(scale x, scale y) {np.corrcoef(sc_d[0::2], sc_d[1::2])[0, 1]:+.3f}")

# ---------------------------------------------------------------------------
# 6. Contrast, noise, the threshold, ScaleIntensity.
# ---------------------------------------------------------------------------
v = torch.tensor([[[0.10, 0.35, 0.60, 0.85, 0.95]]])
for gamma in (0.7, 1.5):
    got = np_(AdjustContrast(gamma=gamma)(v))[0, 0]
    vn = np_(v)[0, 0]
    lo, rng = vn.min(), vn.max() - vn.min()
    want = ((vn - lo) / (rng + 1e-7)) ** gamma * rng + lo
    say(f"contrast: gamma {gamma}: {np.round(vn, 3).tolist()} -> {np.round(got, 4).tolist()}; "
        f"max |MONAI - ((x-min)/range)^g*range+min| = {np.abs(got - want).max():.2e}")

rgn = RandGaussianNoised(keys=["image"], prob=1.0, mean=0.0, std=0.01)
rgn.set_random_state(seed=3)
sds = []
zero = {"image": torch.zeros(1, 64, 64)}
for _ in range(2000):
    sds.append(float(np_(rgn(dict(zero))["image"]).std()))
sds = np.array(sds)
say(f"noise: RandGaussianNoised(std=0.01), 2000 draws on zeros: per-draw sd min {sds.min():.4f}, "
    f"mean {sds.mean():.4f}, max {sds.max():.4f} (U(0, 0.01) has mean 0.005); "
    f"quartiles {np.round(np.quantile(sds, [0.25, 0.5, 0.75]), 4).tolist()}")
data["noise_sd"] = {"min": float(sds.min()), "mean": float(sds.mean()), "max": float(sds.max())}

thr = np_(AsDiscrete(threshold=0.5)(torch.tensor([[0.49, 0.5, 0.51, 1.0, 255.0]])))
say(f"threshold: AsDiscrete(threshold=0.5) on [0.49, 0.5, 0.51, 1, 255] -> {thr[0].tolist()}")
si = np_(ScaleIntensity()(torch.tensor([[[2.0, 4.0, 6.0]]])))
say(f"scale: ScaleIntensity on [2, 4, 6] -> {si[0, 0].tolist()}")
data["threshold"] = thr[0].tolist()

# ---------------------------------------------------------------------------
# 7. CacheDataset: which transforms run once, and which every fetch?
# ---------------------------------------------------------------------------
calls = {"before": 0, "after": 0}


class Count(MapTransform):
    def __init__(self, keys, slot):
        super().__init__(keys)
        self.slot = slot

    def __call__(self, d):
        calls[self.slot] += 1
        return dict(d)


pipe = Compose([Count(["image"], "before"),
                RandFlipd(keys=["image"], prob=0.5, spatial_axis=0),
                Count(["image"], "after")])
ds = CacheDataset([{"image": np.zeros((1, 4, 4), np.float32)}], transform=pipe,
                  cache_rate=1.0, progress=False, num_workers=0)
for _ in range(5):
    ds[0]
say(f"cache: after caching one sample and 5 fetches, the transform before RandFlipd ran "
    f"{calls['before']} time(s) and the one after it {calls['after']} time(s)")
data["cache"] = dict(calls)

# ---------------------------------------------------------------------------
# 8. A binary disc saved as JPG and read back unscaled: what AsDiscreted(0.5)
#    does to it. The mechanism only; the KRD-WBC masks themselves are unread.
# ---------------------------------------------------------------------------
M = 64
yy, xx = np.mgrid[0:M, 0:M]
mask = (((xx - 30) ** 2 + (yy - 34) ** 2) <= 16 ** 2).astype(np.uint8) * 255
true_area = int((mask > 0).sum())
jpg = {}
for q in (75, 95):
    buf = io.BytesIO()
    Image.fromarray(mask, mode="L").save(buf, format="JPEG", quality=q)
    path = os.path.join(tmp, f"m{q}.jpg")
    with open(path, "wb") as fh:
        fh.write(buf.getvalue())
    lab = EnsureChannelFirstd(keys=["label"])(LoadImaged(keys=["label"])({"label": path}))["label"]
    arr = np_(lab)[0]
    between = int(((arr > 0) & (arr < 255)).sum())
    fg = int(np_(AsDiscrete(threshold=0.5)(lab)).sum())
    fg127 = int((arr >= 127.5).sum())
    jpg[q] = {"between": between, "after_threshold_0.5": fg, "after_threshold_127.5": fg127,
              "true": true_area, "max_background": float(arr[mask.T == 0].max())}
    say(f"jpg mask (quality {q}): {between} pixels strictly between 0 and 255; AsDiscrete(0.5) "
        f"marks {fg} foreground against {true_area} true ({100 * (fg - true_area) / true_area:+.1f}%); "
        f"a threshold of 127.5 marks {fg127}; the largest background value is {jpg[q]['max_background']:.0f}")
data["jpg_mask"] = jpg

# ---------------------------------------------------------------------------
# 9. THROUGH A FILE, BOTH READER ORDERS. Kenneth's pick 2026-09-15: he adds
#    reader="PILReader", reverse_indexing=False to cell 19's LoadImaged, so the
#    widget follows [C, H, W]. Every direction is re-measured through a
#    NON-SQUARE picture (an axis swap cannot hide in it), each result read back
#    into the file's orientation (x right, y down) for the engine to reproduce.
# ---------------------------------------------------------------------------
FH, FW = 28, 36
yy, xx = np.mgrid[0:FH, 0:FW]
pic = ((xx * 5 + yy * 11) % 13) / 12.0 * 0.5
pic[4:10, 22:31] = 1.0  # a bright block, up and right of centre
Image.fromarray((pic * 255).round().astype(np.uint8), mode="L").save(os.path.join(tmp, "pic.png"))
file_px = np.asarray(Image.open(os.path.join(tmp, "pic.png")), dtype=np.float64) / 255.0


def block_stats(a):
    """Centroid (x, y) and spread (sd x, sd y) of the values above 0.9, in file orientation."""
    ys_, xs_ = np.nonzero(a > 0.9)
    return float(xs_.mean()), float(ys_.mean()), float(xs_.std()), float(ys_.std())


orders = {}
for key, label, kw in (("xy", "x-first (cell 19 as written)", {}),
                       ("yx", "[C, H, W] (reader=PILReader, reverse_indexing=False)",
                        {"reader": "PILReader", "reverse_indexing": False})):
    loaded = EnsureChannelFirstd(keys=["image"])(LoadImaged(keys=["image"], **kw)({"image": os.path.join(tmp, "pic.png")}))["image"]
    arr = torch.as_tensor(np_(loaded) / 255.0, dtype=torch.float32)
    to_file = (lambda t: np_(t)[0].T) if key == "xy" else (lambda t: np_(t)[0])
    assert np.allclose(to_file(arr), file_px, atol=1e-6), f"{key}: reading back does not give the file"
    ops = {
        "flip0": Flip(spatial_axis=0)(arr),
        "flip1": Flip(spatial_axis=1)(arr),
        "rot1": Rotate90(k=1, spatial_axes=(0, 1))(arr),
        "affine": Affine(rotate_params=0.3, translate_params=(3.0, -2.0), scale_params=(1.1, 0.9),
                         padding_mode="zeros", mode="bilinear", image_only=True)(arr),
        "affine_nearest": Affine(rotate_params=0.3, translate_params=(3.0, -2.0), scale_params=(1.1, 0.9),
                                 padding_mode="zeros", mode="nearest", image_only=True)(arr),
    }
    files = {k: to_file(v) for k, v in ops.items()}
    cx0, cy0, sx0, sy0 = block_stats(file_px)
    fx, fy, _, _ = block_stats(files["flip0"])
    flip0_is = "left-right" if abs(fx - (FW - 1 - cx0)) < 0.01 and abs(fy - cy0) < 0.01 else \
               "top-bottom" if abs(fy - (FH - 1 - cy0)) < 0.01 and abs(fx - cx0) < 0.01 else "?"
    rx, ry, _, _ = block_stats(files["rot1"])
    cw = (FH - 1 - cy0, cx0)   # (x, y) -> (H-1-y, x)
    ccw = (cy0, FW - 1 - cx0)  # (x, y) -> (y, W-1-x)
    rot_is = "clockwise" if np.hypot(rx - cw[0], ry - cw[1]) < 0.01 else \
             "counter-clockwise" if np.hypot(rx - ccw[0], ry - ccw[1]) < 0.01 else "?"
    turn = centroid_turn = None
    a_rot = to_file(Affine(rotate_params=0.3, padding_mode="zeros", mode="nearest", image_only=True)(arr))
    ax, ay, _, _ = block_stats(a_rot)
    ccx, ccy = (FW - 1) / 2, (FH - 1) / 2
    d_ang = np.degrees(np.arctan2(ay - ccy, ax - ccx) - np.arctan2(cy0 - ccy, cx0 - ccx))
    turn = "counter-clockwise" if d_ang < 0 else "clockwise"  # y points down on screen
    t_only = to_file(Affine(translate_params=(3.0, 0.0), padding_mode="zeros", mode="nearest", image_only=True)(arr))
    tx_, ty_, _, _ = block_stats(t_only)
    s_only = to_file(Affine(scale_params=(1.5, 1.0), padding_mode="zeros", mode="nearest", image_only=True)(arr))
    _, _, ssx, ssy = block_stats(s_only)
    say(f"order {key} = {label}: spatial_axis=0 flips {flip0_is}; Rotate90 k=1 turns {rot_is}; "
        f"affine rotate +0.3 turns {turn} ({d_ang:+.1f} deg); translate (+3, 0) moves the content "
        f"x {tx_ - cx0:+.1f}, y {ty_ - cy0:+.1f}; scale (1.5, 1) changes the block's spread "
        f"x {sx0:.2f} -> {ssx:.2f}, y {sy0:.2f} -> {ssy:.2f}")
    orders[key] = {
        "label": label, "flip0": flip0_is, "rot1": rot_is, "rotate_turn": turn,
        "translate_3_0": [tx_ - cx0, ty_ - cy0],
        "arrays": {k: r7(v) for k, v in files.items()},
    }
data["through_file"] = {"height": FH, "width": FW, "file": r7(file_px), "orders": orders}

with open(OUT_TXT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(lines) + "\n")
with open(OUT_JSON, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(data, fh, separators=(",", ":"))
sys.stdout.reconfigure(encoding="utf-8")
print("\n".join(lines))
print(f"\nwrote {os.path.relpath(OUT_TXT)} and {os.path.relpath(OUT_JSON)} "
      f"({os.path.getsize(OUT_JSON) // 1024} KB)")
