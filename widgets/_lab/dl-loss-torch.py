"""The torch side of `_lab/dl-loss-measure.mjs` (slot 54 `loss-functions`).

The measure script wrote the three losses out as arithmetic because torch was
not on this machine; it was installed on 2026-09-11 (CPU wheel, torch 2.14)
so that every number the widget prints and, above all, every ERROR STRING it
prints is one torch has actually printed. Run: python widgets/_lab/dl-loss-torch.py
"""
import torch
import torch.nn as nn

print("torch", torch.__version__)

def show(name, fn):
    try:
        v = fn()
        print(f"{name}: {v.item():.6f}" if torch.is_tensor(v) else f"{name}: {v}")
    except Exception as e:  # noqa: BLE001 — the message IS the measurement
        print(f"{name}: {type(e).__name__}: {e}")

# ---- the notebook's three examples (05-4 cells 33, 36, 39) ----------------
y_pred = torch.tensor([2.5, 0.0, 2.1], dtype=torch.float32)
y_true = torch.tensor([3.0, -0.5, 2.0], dtype=torch.float32)
show("MSE cell 33", lambda: nn.MSELoss()(y_pred, y_true))

z3 = torch.tensor([[5.0, 0.5, 0.1]], dtype=torch.float32)
show("CE cell 36, label 0", lambda: nn.CrossEntropyLoss()(z3, torch.tensor([0])))
show("CE label 1", lambda: nn.CrossEntropyLoss()(z3, torch.tensor([1])))
show("CE label 2", lambda: nn.CrossEntropyLoss()(z3, torch.tensor([2])))
print("softmax cell 36:", torch.softmax(z3, dim=1))

z5 = torch.tensor([[0.2, -1.0, 0.5, 2.0, -0.3]], dtype=torch.float32)
y5 = torch.tensor([[0, 1, 1, 0, 0]], dtype=torch.float32)
show("BCE cell 39", lambda: nn.BCEWithLogitsLoss()(z5, y5))
print("sigmoid cell 39:", torch.sigmoid(z5), "sum", torch.sigmoid(z5).sum().item())
print("BCE per-class terms:", nn.BCEWithLogitsLoss(reduction="none")(z5, y5))

# ---- the drag ---------------------------------------------------------------
show("CE, score A dragged to 1.0", lambda: nn.CrossEntropyLoss()(torch.tensor([[1.0, 0.5, 0.1]]), torch.tensor([0])))
show("BCE, score D dragged to -2.0", lambda: nn.BCEWithLogitsLoss()(torch.tensor([[0.2, -1.0, 0.5, -2.0, -0.3]]), y5))
show("MSE, y_pred[0] dragged to -1.0", lambda: nn.MSELoss()(torch.tensor([-1.0, 0.0, 2.1]), y_true))

# ---- the case that fails: the target's dtype ---------------------------------
show("CE with a float32 index [0.]", lambda: nn.CrossEntropyLoss()(z3, torch.tensor([0.], dtype=torch.float32)))
show("BCE with a long 0/1 row", lambda: nn.BCEWithLogitsLoss()(z5, torch.tensor([[0, 1, 1, 0, 0]], dtype=torch.long)))
show("MSE with a long target", lambda: nn.MSELoss()(y_pred, torch.tensor([3, 0, 2], dtype=torch.long)))

# ---- each loss handed the OTHER loss's target --------------------------------
show("BCE with CE's class index [0] (shape [1] vs [1, 3])", lambda: nn.BCEWithLogitsLoss()(z3, torch.tensor([0])))
show("BCE with CE's index as float [0.]", lambda: nn.BCEWithLogitsLoss()(z3, torch.tensor([0.])))
show("CE with BCE's 0/1 row as float32 (runs: class probabilities)", lambda: nn.CrossEntropyLoss()(z5, y5))
show("BCE with a one-hot [1, 0, 0] (runs)", lambda: nn.BCEWithLogitsLoss()(z3, torch.tensor([[1.0, 0.0, 0.0]])))
