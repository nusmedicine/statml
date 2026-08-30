"""Design measurements for widget 37 `mlp` (PHM5005 04-3 s.Neural Networks).

Kenneth's picks (2026-08-30): the SVM widget's stage (Two blobs / Rings /
Crescents, widget 16's own generator shapes) and two acts - training bends
the boundary (Play = epochs) and the k x activation dials with the
identity-collapse lesson.

Measured here, before anything is drawn:

  1. Does a 2 -> k -> 1 network trained by seeded full-batch gradient
     descent tell the stories at all, and at which k?  Target: blobs solved
     at k 1; rings/crescents FAIL at small k and close at some k the dial
     can reach; identity activation stays linear at ANY k.
  2. Which optimiser and learning rate give a watchable Play - monotone-ish
     loss, visible morphing, convergence inside a few hundred epochs?
     Plain GD vs GD+momentum(0.9), both deterministic and trivial in JS.
  3. Seed sensitivity: how often does the default story get stuck (dead
     relu units, local minima)?  The default seed gets AUDITIONED, not
     fixed (the lm-diagnostics precedent).

The engine here is the SPECIFICATION for the widget's JS engine: same
architecture, same init scheme, same update rule.  At build time the JS
engine is pinned to this file on identical arrays via JSON, to the digit.

Run with the venv described in HANDOVER's *Working on Windows*:

    "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/venv/Scripts/python.exe" \
        widgets/_lab/mlp-design.py
"""

import numpy as np

N_PER_CLASS = 90   # widget 16's own count


def make_data(kind, rng):
    """Widget 16's three generators, shapes copied from its make() functions."""
    X, y = [], []
    if kind == "blobs":
        for cls in (-1, 1):
            cx, cy = cls * 0.95, cls * 0.8
            for _ in range(N_PER_CLASS):
                X.append([rng.normal(cx, 0.42), rng.normal(cy, 0.42)])
                y.append(cls)
    elif kind == "rings":
        for cls, r in ((-1, 0.75), (1, 1.72)):
            for _ in range(N_PER_CLASS):
                t = rng.uniform(0, 2 * np.pi)
                X.append([r * np.cos(t) + rng.normal(0, 0.12),
                          r * np.sin(t) + rng.normal(0, 0.12)])
                y.append(cls)
    else:  # moons - the upper arc is +1 (widget 16's flip lesson)
        for _ in range(N_PER_CLASS):
            t = rng.uniform(0, np.pi)
            X.append([1.25 * (np.cos(t) - 0.5) + rng.normal(0, 0.11),
                      1.25 * (np.sin(t) - 0.25) + rng.normal(0, 0.11)])
            y.append(1)
        for _ in range(N_PER_CLASS):
            t = rng.uniform(0, np.pi)
            X.append([1.25 * (0.5 - np.cos(t)) + rng.normal(0, 0.11),
                      1.25 * (0.25 - np.sin(t)) + rng.normal(0, 0.11)])
            y.append(-1)
    return np.array(X), (np.array(y) > 0).astype(float)


ACT = {
    "relu": (lambda z: np.maximum(0, z), lambda z: (z > 0).astype(float)),
    "tanh": (np.tanh, lambda z: 1 - np.tanh(z) ** 2),
    "identity": (lambda z: z, lambda z: np.ones_like(z)),
}


def init_net(k, rng):
    """Uniform(-r, r) with r = 1/sqrt(fan_in) - trivially reproducible with
    the widget's makeRng.uniform."""
    r1, r2 = 1 / np.sqrt(2), 1 / np.sqrt(k)
    return {
        "W1": rng.uniform(-r1, r1, (k, 2)), "b1": rng.uniform(-r1, r1, k),
        "W2": rng.uniform(-r2, r2, k), "b2": rng.uniform(-r2, r2),
    }


def train(X, y, k, act, lr, epochs, rng, momentum=0.0):
    f, df = ACT[act]
    p = init_net(k, rng)
    v = {key: np.zeros_like(val) for key, val in p.items()}
    n = len(X)
    losses = []
    for _ in range(epochs):
        z1 = X @ p["W1"].T + p["b1"]          # n x k
        h = f(z1)
        z2 = h @ p["W2"] + p["b2"]            # n
        out = 1 / (1 + np.exp(-z2))
        eps = 1e-12
        losses.append(-np.mean(y * np.log(out + eps) + (1 - y) * np.log(1 - out + eps)))
        d2 = (out - y) / n                    # dL/dz2
        g = {
            "W2": d2 @ h, "b2": d2.sum(),
            "W1": ((np.outer(d2, p["W2"]) * df(z1)).T @ X),
            "b1": (np.outer(d2, p["W2"]) * df(z1)).sum(axis=0),
        }
        for key in p:
            v[key] = momentum * v[key] - lr * g[key]
            p[key] = p[key] + v[key]
    z2 = f(X @ p["W1"].T + p["b1"]) @ p["W2"] + p["b2"]
    errors = int(((z2 > 0) != (y > 0.5)).sum())
    return errors, losses


# ---------------------------------------------------------------------------
# 1 - which k closes which shape (relu, momentum GD), and identity's collapse
# ---------------------------------------------------------------------------

LR, EPOCHS, MOM = 0.5, 400, 0.9

print(f"[1] errors of 180 after {EPOCHS} epochs (lr {LR}, momentum {MOM}), relu, seed 1")
data_rng = np.random.default_rng(1)
DATA = {kind: make_data(kind, np.random.default_rng(10 + i)) for i, kind in enumerate(["blobs", "rings", "moons"])}
for kind in ["blobs", "rings", "moons"]:
    X, y = DATA[kind]
    row = []
    for k in (1, 2, 3, 4, 8):
        e, _ = train(X, y, k, "relu", LR, EPOCHS, np.random.default_rng(1), MOM)
        row.append(f"k={k}:{e}")
    print(f"  {kind:8s} " + "  ".join(row))

print("\n[1b] identity stays linear at ANY k (the collapse) - rings")
X, y = DATA["rings"]
for k in (1, 8):
    e, _ = train(X, y, k, "identity", LR, EPOCHS, np.random.default_rng(1), MOM)
    print(f"  identity k={k}: {e} errors (chance is ~90; a line cannot close a ring)")
e, _ = train(X, y, 8, "tanh", LR, EPOCHS, np.random.default_rng(1), MOM)
print(f"  tanh k=8: {e} errors (the smooth cousin)")

# ---------------------------------------------------------------------------
# 2 - the optimiser and the watchability of Play
# ---------------------------------------------------------------------------

print("\n[2] rings, k=4 relu - epochs to reach within 2 errors of the final count")
for mom, lr in ((0.0, 0.5), (0.0, 2.0), (0.9, 0.2), (0.9, 0.5)):
    e, losses = train(X, y, 4, "relu", lr, 1200, np.random.default_rng(1), mom)
    # find settle point by re-running and probing error at checkpoints
    marks = {}
    for ep in (50, 100, 200, 400, 800, 1200):
        em, _ = train(X, y, 4, "relu", lr, ep, np.random.default_rng(1), mom)
        marks[ep] = em
    print(f"  momentum {mom} lr {lr}: final {e}; errors at epochs " +
          " ".join(f"{ep}:{em}" for ep, em in marks.items()) +
          f"; loss monotone: {all(b <= a + 1e-9 for a, b in zip(losses, losses[1:]))}")

# ---------------------------------------------------------------------------
# 3 - seed sensitivity at the chosen setting
# ---------------------------------------------------------------------------

print("\n[3] rings k=4 relu, chosen setting over 40 init seeds - stuck fraction")
fails = []
for s in range(1, 41):
    e, _ = train(X, y, 4, "relu", 0.5, EPOCHS, np.random.default_rng(s), MOM)
    fails.append(e)
good = sum(1 for e in fails if e <= 6)
print(f"  <=6 errors on {good}/40 seeds; worst {max(fails)}; "
      f"first 10: {fails[:10]}")
print("\n[3b] moons k=4 relu over 40 seeds")
Xm, ym = DATA["moons"]
fails = [train(Xm, ym, 4, "relu", 0.5, EPOCHS, np.random.default_rng(s), MOM)[0] for s in range(1, 41)]
print(f"  <=6 errors on {sum(1 for e in fails if e <= 6)}/40; worst {max(fails)}; first 10: {fails[:10]}")

# ---------------------------------------------------------------------------
# 4 - THE RELIABILITY TABLE, and it is the design's real finding.
#
#     A single seed is not a measurement: the mock's first rings k=3 panel
#     reached 0 errors and a different data/init pair reached 24.  Swept over
#     20 inits per cell, the ladder is the SAME under every optimiser tried
#     (momentum 0.9 at lr 0.05/0.1/0.2 and plain GD at 0.5), so the shape is
#     a property of the problem rather than of the step rule:
#
#                   k=1     k=2     k=3      k=4      k=8
#       rings      0/20    0/20   ~10/20   19/20    20/20
#       crescents  0/20    0/20    ~3/20   ~6/20    17/20
#
#     Two facts, both worth teaching and neither a defect to tune away:
#       CAPACITY      k 1 and 2 can NEVER close a ring or thread two arcs.
#       OPTIMISATION  k 3 sometimes can and usually does not; width buys
#                     reliability, not just capacity.  Spare units give
#                     gradient descent more ways down.
#     So the Seed dial is a teaching control here, and the widget must not
#     claim "k >= 3 works" anywhere on screen.
#
#     Optimiser choice is then decided by WATCHABILITY alone - how much of
#     the motion Play gets to show.  Errors on rings k=4 at epochs
#     20/60/150/300:
#       momentum 0.9 lr 0.05   77 -> 32 -> 1 -> 0     <- the pick: gradual
#       momentum 0.9 lr 0.2    45 ->  0               <- over before it starts
#       plain GD   lr 0.5      42 -> 32 -> 0
# ---------------------------------------------------------------------------

print("\n[4] the reliability table: <=6 errors, out of 20 inits per cell")
for mom, lr, name in ((0.9, 0.05, "momentum 0.9 lr 0.05 (the pick)"), (0.0, 0.5, "plain GD lr 0.5")):
    print(f"  {name}")
    for kind in ("rings", "moons"):
        X4, y4 = DATA[kind]
        row = []
        for k in (1, 2, 3, 4, 8):
            good = sum(1 for s in range(1, 21)
                       if train(X4, y4, k, "relu", lr, 600, np.random.default_rng(s), mom)[0] <= 6)
            row.append(f"k={k}:{good:2d}/20")
        print(f"    {kind:10s} " + "  ".join(row))
X4, y4 = DATA["rings"]
marks = [train(X4, y4, 4, "relu", 0.05, ep, np.random.default_rng(1), 0.9)[0]
         for ep in (20, 60, 150, 300, 600)]
print(f"  watchability, rings k=4 at the pick: errors @20/60/150/300/600 epochs = {marks}")
