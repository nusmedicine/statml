"""Train the reference engine from the widget's OWN data and initial weights,
and compare the trajectories.

The widget and _lab/mlp-design.py cannot share a random stream, so a shared
seed would prove nothing. mlp-verify.mjs dumps the arrays the widget actually
produced; this reads them, applies the same update rule in numpy, and reports
the largest disagreement in the final weights, the loss and the error count.

    node widgets/_lab/mlp-verify.mjs > widgets/_lab/mlp-verify.json
    "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/venv/Scripts/python.exe" \
        widgets/_lab/mlp-verify.py
"""

import json
import numpy as np

ACT = {
    "relu": (lambda z: np.maximum(0, z), lambda z: (z > 0).astype(float)),
    "tanh": (np.tanh, lambda z: 1 - np.tanh(z) ** 2),
    "identity": (lambda z: z, lambda z: np.ones_like(z)),
}

with open("widgets/_lab/mlp-verify.json", encoding="utf-8") as fh:
    dump = json.load(fh)

EPOCHS, LR, MOM = dump["epochs"], dump["lr"], dump["momentum"]
print(f"reference vs shipping engine — {EPOCHS} epochs, lr {LR}, momentum {MOM}")
worst_all = 0.0

for c in dump["cases"]:
    X = np.array(c["X"])
    y = np.array(c["y"], dtype=float)
    n = len(X)
    f, df = ACT[c["act"]]
    p = {
        "W1": np.array(c["init"]["W1"]), "b1": np.array(c["init"]["b1"]),
        "W2": np.array(c["init"]["W2"]), "b2": float(c["init"]["b2"]),
    }
    v = {k: np.zeros_like(val) for k, val in p.items()}
    losses = []
    for _ in range(EPOCHS):
        z1 = X @ p["W1"].T + p["b1"]
        h = f(z1)
        z2 = h @ p["W2"] + p["b2"]
        out = 1 / (1 + np.exp(-z2))
        losses.append(-np.mean(y * np.log(out + 1e-12) + (1 - y) * np.log(1 - out + 1e-12)))
        d2 = (out - y) / n
        g = {
            "W2": d2 @ h, "b2": d2.sum(),
            "W1": (np.outer(d2, p["W2"]) * df(z1)).T @ X,
            "b1": (np.outer(d2, p["W2"]) * df(z1)).sum(axis=0),
        }
        for k in p:
            v[k] = MOM * v[k] - LR * g[k]
            p[k] = p[k] + v[k]

    fin = c["final"]
    dW1 = np.abs(p["W1"] - np.array(fin["W1"])).max()
    db1 = np.abs(p["b1"] - np.array(fin["b1"])).max()
    dW2 = np.abs(p["W2"] - np.array(fin["W2"])).max()
    db2 = abs(p["b2"] - float(fin["b2"]))
    worst = max(dW1, db1, dW2, db2)
    worst_all = max(worst_all, worst)

    z2 = f(X @ p["W1"].T + p["b1"]) @ p["W2"] + p["b2"]
    errors = int(((z2 > 0) != (y > 0.5)).sum())
    dloss = abs(losses[-1] - c["lossEnd"])

    tag = f'{c["set"]} k={c["k"]} {c["act"]}'
    ok = "OK " if worst < 1e-9 and errors == c["errors"] and dloss < 1e-9 else "FAIL"
    print(f"  {ok} {tag:24s} worst |dw| {worst:.2e}  |dloss| {dloss:.2e}  "
          f"errors {errors} vs {c['errors']}")

print(f"\nworst disagreement across every weight and case: {worst_all:.3e}")
