"""TEST ONLY (Kenneth, 2026-09-15: "don't implement anything yet, test and see").

Would a lookup table of trained U-Nets, one per rail setting, be visible and
shippable? Trains the notebook's UNet2D shape (DoubleConv with BatchNorm, max
pool, ConvTranspose2d(2, 2), cat, 1 x 1 head, BCE + soft Dice) at four
settings on synthetic three-channel blob images, and exports exactly what the
operation panel would draw:

  - four output-channel maps of every stage, as thumbnails of side min(H, 16)
    (area-averaged, uint8, one scale a map), and the same at side min(H, 64)
    for the lab page to compare legibility;
  - the numbers at one position: every input channel's 3 x 3 window and the
    kernel slice into output channel 0 (so the sum is exact), BatchNorm's
    running statistics, the pool window, the transposed patch, the head.

Writes widgets/_lab/unet-lookup-test/<setting>.json and prints raw and gzip
sizes, the time and the held-out Dice. CPU (the installed torch has no CUDA).

    python widgets/_lab/unet-lookup-test.py
"""
import gzip, json, math, os, time
import torch, torch.nn as nn, torch.nn.functional as F

OUT = os.path.join(os.path.dirname(__file__), "unet-lookup-test")
os.makedirs(OUT, exist_ok=True)
torch.manual_seed(1)


class DoubleConv(nn.Module):
    def __init__(self, i, o):
        super().__init__()
        self.c1 = nn.Conv2d(i, o, 3, padding=1, bias=False); self.n1 = nn.BatchNorm2d(o)
        self.c2 = nn.Conv2d(o, o, 3, padding=1, bias=False); self.n2 = nn.BatchNorm2d(o)
    def forward(self, x, rec=None, name=None):
        z1 = self.c1(x); a1 = F.relu(self.n1(z1)); out = F.relu(self.n2(self.c2(a1)))
        if rec is not None: rec[name] = dict(x=x, z1=z1, out=out, block=self)
        return out


class UNet(nn.Module):
    def __init__(self, depth, base, cin=3):
        super().__init__()
        self.depth = depth
        self.enc = nn.ModuleList(); self.ups = nn.ModuleList(); self.decs = nn.ModuleList()
        c = cin
        for l in range(depth):
            self.enc.append(DoubleConv(c, base * 2 ** l)); c = base * 2 ** l
        self.bott = DoubleConv(c, base * 2 ** depth)
        for l in reversed(range(depth)):
            self.ups.append(nn.ConvTranspose2d(base * 2 ** (l + 1), base * 2 ** l, 2, 2))
            self.decs.append(DoubleConv(base * 2 ** (l + 1), base * 2 ** l))
        self.head = nn.Conv2d(base, 1, 1)
    def forward(self, x, rec=None):
        skips = []
        for l, e in enumerate(self.enc, 1):
            x = e(x, rec, f"enc{l}"); skips.append(x)
            p = F.max_pool2d(x, 2)
            if rec is not None: rec[f"pool{l}"] = dict(x=x, out=p)
            x = p
        x = self.bott(x, rec, "bottleneck")
        for i, (u, d) in enumerate(zip(self.ups, self.decs)):
            l = self.depth - i
            up = u(x)
            cat = torch.cat([up, skips.pop()], 1)
            if rec is not None:
                rec[f"up{l}"] = dict(x=x, out=up, layer=u)
                rec[f"cat{l}"] = dict(out=cat)
            x = d(cat, rec, f"dec{l}")
        z = self.head(x)
        if rec is not None: rec["head"] = dict(x=x, out=z)
        return z


def blobs(n, S, gen):
    """three-channel images: 1-3 coloured blobs on a dark field, the mask their union"""
    yy, xx = torch.meshgrid(torch.arange(S) + 0.5, torch.arange(S) + 0.5, indexing="ij")
    img = torch.zeros(n, 3, S, S); msk = torch.zeros(n, 1, S, S)
    for i in range(n):
        best = torch.full((S, S), 1e9)
        colour = torch.zeros(3, S, S)
        for _ in range(int(torch.randint(1, 4, (1,), generator=gen))):
            r = (0.09 + 0.08 * torch.rand(1, generator=gen).item()) * S
            cx = r + 1 + torch.rand(1, generator=gen).item() * (S - 2 * r - 2)
            cy = r + 1 + torch.rand(1, generator=gen).item() * (S - 2 * r - 2)
            d = torch.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) - r
            col = torch.rand(3, generator=gen) * 0.6 + 0.4
            soft = torch.sigmoid(-d / (0.04 * S))
            colour = torch.maximum(colour, col[:, None, None] * soft)
            best = torch.minimum(best, d)
        msk[i, 0] = (best <= 0).float()
        img[i] = colour + 0.15 * torch.randn(3, S, S, generator=gen)
    return img, msk


def dice_bce(z, t):
    p = torch.sigmoid(z)
    inter = (p * t).sum((1, 2, 3)); union = p.sum((1, 2, 3)) + t.sum((1, 2, 3))
    return F.binary_cross_entropy_with_logits(z, t) + (1 - (2 * inter + 1e-5) / (union + 1e-5)).mean()


def thumb(m, side):
    """a 2-D map area-averaged to side x side, quantised to uint8 hex with its range"""
    H = m.shape[-1]
    s = min(H, side)
    t = F.adaptive_avg_pool2d(m[None, None], s)[0, 0] if H > s else m
    lo, hi = float(t.min()), float(t.max())
    q = ((t - lo) / (hi - lo + 1e-12) * 255).round().to(torch.uint8).flatten().tolist()
    return dict(side=s, lo=round(lo, 3), hi=round(hi, 3), hex="".join(f"{v:02x}" for v in q))


r3 = lambda v: round(float(v), 3)


def export(model, img, msk, depth, base, S):
    rec = {}
    model.eval()
    with torch.no_grad():
        z = model(img[None], rec)
    pr, pc = S // 2, S // 2
    stages, stages64 = {}, {}
    for name, v in rec.items():
        out = v["out"][0]
        H = out.shape[-1]
        k = min(8 if name.startswith("cat") else 4, out.shape[0])
        stages[name] = dict(C=int(out.shape[0]), H=H, maps=[thumb(out[c], 16) for c in range(k)])
        stages64[name] = dict(C=int(out.shape[0]), H=H, maps=[thumb(out[c], 64) for c in range(min(k, 4))])
        r = min(H - 2, max(1, pr * H // S)); c = min(H - 2, max(1, pc * H // S))
        if "block" in v:
            b, x = v["block"], v["x"][0]
            W = b.c1.weight[0]
            stages[name]["at"] = dict(
                r=r, c=c,
                windows=[[r3(t) for t in x[ch, r - 1:r + 2, c - 1:c + 2].flatten()] for ch in range(x.shape[0])],
                slices=[[r3(t) for t in W[ch].flatten()] for ch in range(x.shape[0])],
                z=r3(v["z1"][0, 0, r, c]), mean=r3(b.n1.running_mean[0]), var=r3(b.n1.running_var[0]),
                gamma=r3(b.n1.weight[0]), beta=r3(b.n1.bias[0]))
        elif name.startswith("pool"):
            x = v["x"][0, 0]; h = H
            stages[name]["at"] = dict(r=r, c=c, window=[r3(t) for t in x[2 * r:2 * r + 2, 2 * c:2 * c + 2].flatten()])
        elif name.startswith("up"):
            x = v["x"][0]; u = v["layer"]; h = x.shape[-1]
            ur, uc = min(h - 1, r // 2), min(h - 1, c // 2)
            stages[name]["at"] = dict(r=ur, c=uc, cells=[r3(t) for t in x[:, ur, uc]],
                                      kernel=[[r3(t) for t in u.weight[ch, 0].flatten()] for ch in range(x.shape[0])],
                                      bias=r3(u.bias[0]))
        elif name == "head":
            x = v["x"][0]
            stages[name]["at"] = dict(r=pr, c=pc, pixel=[r3(t) for t in x[:, pr, pc]],
                                      weights=[r3(t) for t in model.head.weight[0, :, 0, 0]], bias=r3(model.head.bias[0]))
    sig = torch.sigmoid(z[0, 0])
    data = dict(depth=depth, base=base, input=S,
                image=[thumb(img[ch], 16) for ch in range(3)],
                sigmoid=thumb(sig, 16), mask=thumb((sig > 0.5).float(), 16), truth=thumb(msk[0], 16),
                stages=stages)
    return data, dict(depth=depth, base=base, input=S, image=[thumb(img[ch], 64) for ch in range(3)],
                      truth=thumb(msk[0], 64), mask=thumb((sig > 0.5).float(), 64), stages=stages64)


SETTINGS = [(2, 4, 16), (2, 4, 64), (4, 16, 128), (4, 16, 512)]
summary = []
for depth, base, S in SETTINGS:
    gen = torch.Generator().manual_seed(7)
    x, t = blobs(200, S, gen)
    xv, tv = blobs(20, S, torch.Generator().manual_seed(9000))
    model = UNet(depth, base)
    opt = torch.optim.Adam(model.parameters(), 1e-3)
    t0 = time.perf_counter()
    model.train()
    for ep in range(5):
        perm = torch.randperm(200, generator=gen)
        for s in range(0, 200, 8):
            idx = perm[s:s + 8]
            opt.zero_grad(); loss = dice_bce(model(x[idx]), t[idx]); loss.backward(); opt.step()
    secs = time.perf_counter() - t0
    model.eval()
    with torch.no_grad():
        p = (torch.sigmoid(model(xv)) > 0.5).float()
        inter = (p * tv).sum((1, 2, 3)); dice = float(((2 * inter) / (p.sum((1, 2, 3)) + tv.sum((1, 2, 3)) + 1e-9)).mean())
    data, data64 = export(model, xv[0], tv[0], depth, base, S)
    tag = f"d{depth}-b{base}-i{S}"
    raw = json.dumps(data, separators=(",", ":")).encode()
    with open(os.path.join(OUT, f"{tag}.json"), "wb") as f: f.write(raw)
    with open(os.path.join(OUT, f"{tag}-64.json"), "wb") as f: f.write(json.dumps(data64, separators=(",", ":")).encode())
    gz = len(gzip.compress(raw, 9))
    at = sum(len(json.dumps(v.get("at", {}))) for v in data["stages"].values())
    maps = len(raw) - at
    line = f"depth {depth} base {base} input {S}: trained {secs:.0f} s, held-out Dice {dice:.2f}; file {len(raw)/1024:.0f} KB raw, {gz/1024:.0f} KB gzip (numbers at the position {at/1024:.0f} KB, maps {maps/1024:.0f} KB)"
    print(line, flush=True)
    summary.append(dict(depth=depth, base=base, input=S, secs=round(secs, 1), dice=round(dice, 3), raw=len(raw), gzip=gz, at=at))
with open(os.path.join(OUT, "summary.json"), "w") as f: json.dump(summary, f, indent=1)
