"""The torch side of _lab/dl-optim-measure.mjs --check: the same two surfaces,
the same start, lr 0.1, every optimizer at torch's defaults (AdamW's
weight_decay 0.01), positions printed at the same steps in the same format.
`node widgets/_lab/dl-optim-measure.mjs --check` must print identical lines
to 1e-6, or the widget's update rules are not torch's.

Run: python widgets/_lab/dl-optim-torch.py
"""
import math
import torch

torch.set_default_dtype(torch.float64)


def wells(p):
    x, y = p[0], p[1]
    v = 0.01 * (x * x + y * y)
    v = v - 1.2 * torch.exp(-((x - 1.6) ** 2 / 0.9 + (y - 0.0) ** 2 / 0.9))
    v = v - 0.7 * torch.exp(-((x + 1.6) ** 2 / 0.7 + (y - 0.4) ** 2 / 0.7))
    return v


def camel3(p):
    x, y = p[0], p[1]
    return 2 * x * x - 1.05 * x ** 4 + x ** 6 / 6 + x * y + y * y


SURFACES = [("wells", wells, (3.5, 2.5)), ("camel3", camel3, (-1.5, 1.5))]
AT = {1, 2, 5, 10, 20, 40}
LR = 0.1


def make(kind, params):
    if kind == "sgd":
        return torch.optim.SGD(params, lr=LR)
    if kind == "momentum":
        return torch.optim.SGD(params, lr=LR, momentum=0.9)
    if kind == "rmsprop":
        return torch.optim.RMSprop(params, lr=LR)
    if kind == "adam":
        return torch.optim.Adam(params, lr=LR)
    if kind == "adamw":
        return torch.optim.AdamW(params, lr=LR)
    raise ValueError(kind)


for name, f, start in SURFACES:
    for kind in ["sgd", "momentum", "rmsprop", "adam", "adamw"]:
        p = torch.tensor(start, requires_grad=True)
        opt = make(kind, [p])
        for t in range(1, 41):
            opt.zero_grad()
            loss = f(p)
            loss.backward()
            opt.step()
            if t in AT:
                print(f"{name} {kind} {t} {p[0].item():.6f} {p[1].item():.6f}")
