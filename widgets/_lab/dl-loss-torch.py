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

# ---- §6 binary two ways: one output + BCE against two outputs + CE -----------
# Kenneth, 2026-09-11: "how best to explain that a binary class can be modeled
# as 1 label or 2 labels". softmax([zA, zB])[B] = sigmoid(zB - zA), so a
# two-output CrossEntropyLoss model IS a one-output BCEWithLogitsLoss model
# whose score is the difference; cell 29's MLP ends in Linear(hidden, 2) with
# CrossEntropyLoss, which is the two-output form.
print("\n-- §6 binary two ways --")
zA, zB = 0.5, 2.0
two = torch.tensor([[zA, zB]])
one = torch.tensor([zB - zA])
print("softmax([zA, zB]) =", torch.softmax(two, dim=1), " sigmoid(zB - zA) =", torch.sigmoid(one).item())
show("CE two outputs, label B (1)", lambda: nn.CrossEntropyLoss()(two, torch.tensor([1])))
show("BCE one output zB - zA, y = 1", lambda: nn.BCEWithLogitsLoss()(one, torch.tensor([1.0])))
show("CE two outputs, label A (0)", lambda: nn.CrossEntropyLoss()(two, torch.tensor([0])))
show("BCE one output zB - zA, y = 0", lambda: nn.BCEWithLogitsLoss()(one, torch.tensor([0.0])))
print("the drag: zB moved with zA held at 0.5, label B")
for zb in [-2.0, -1.0, 0.0, 0.5, 1.0, 2.0, 3.0, 4.0]:
    ce = nn.CrossEntropyLoss()(torch.tensor([[zA, zb]]), torch.tensor([1])).item()
    bce = nn.BCEWithLogitsLoss()(torch.tensor([zb - zA]), torch.tensor([1.0])).item()
    print(f"  zB {zb:5.1f}  z = zB - zA {zb - zA:5.1f}  p_B {torch.sigmoid(torch.tensor(zb - zA)).item():.4f}  CE {ce:.6f}  BCE {bce:.6f}  diff {abs(ce - bce):.1e}")
print("the redundancy: both scores shifted by +3 give the same probability")
print("  softmax([3.5, 5.0]) =", torch.softmax(torch.tensor([[zA + 3, zB + 3]]), dim=1))
print("cell 36's three-class row read as two classes A, B: p_A = sigmoid(zA - zB) =",
      torch.sigmoid(torch.tensor(5.0 - 0.5)).item(), " CE([5.0, 0.5], label 0) =",
      nn.CrossEntropyLoss()(torch.tensor([[5.0, 0.5]]), torch.tensor([0])).item())
print("prediction rule: argmax over [zA, zB] is B iff zB > zA iff sigmoid(zB - zA) > 0.5")
# the one-output shapes of his figures: [batch] scores against [batch] targets
show("BCE one output, shape [1]: score 2.0, y 1", lambda: nn.BCEWithLogitsLoss()(torch.tensor([2.0]), torch.tensor([1.0])))
show("MSE one target, shape [1]: 2.5 against 3.0", lambda: nn.MSELoss()(torch.tensor([2.5]), torch.tensor([3.0])))
