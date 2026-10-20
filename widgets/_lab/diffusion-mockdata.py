"""Widget 107 diffusion: the data for _lab/diffusion-mock.html.

    python -I diffusion-mockdata.py <frontiers-data dir> [cuda]

Needs the models from `diffusion-measure.py train uncond|cond` in
<frontiers-data>/models-107. Writes _lab/diffusion-mock-data.json (untracked).
Every image is stored as the notebook displays one: clamp(x, -1, 1) * 0.5 + 0.5,
as uint8, base64. The forward process needs no model and is computed in the
page from a seeded epsilon, so only the clean digits are stored for it.

forward     train_set[0..5] (c107 uses train_set[0])
training    12 iterations of c96's loop (x0, t, eps from seed 7), with eps-hat
            and the MSE under each of the nine checkpoints; the batch losses;
            8 samples (500 steps, c113) from each checkpoint
generation  16 samples at c113's 500 steps, seed 42: x_t, eps-hat and x0-hat
            every 10th step, then the result
conditional c129's 75 steps, 4 rows x 10 labels; each row starts from one
            x_T and one stream of z, so a row differs only in the label;
            x_t and x0-hat every 3rd step, then the result
"""
import base64, gzip, json, os, sys
import numpy as np, torch, torch.nn.functional as F
from diffusers import UNet2DModel, DDPMScheduler

DATA = sys.argv[1]; DEV = sys.argv[2] if len(sys.argv) > 2 else "cpu"
CKPT = os.path.join(DATA, "models-107")
TAGS = ["b0", "b5", "b20", "b50", "b100", "b200", "e1", "e2", "e3"]

def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f:
        d = f.read()
    if d[3] == 3:
        n, r, c = np.frombuffer(d[4:16], ">i4"); return np.frombuffer(d[16:], np.uint8).reshape(n, r, c)
    return np.frombuffer(d[8:], np.uint8)

def unet(cond):
    return UNet2DModel(sample_size=28, in_channels=11 if cond else 1, out_channels=1, layers_per_block=2,
                       block_out_channels=(64, 64), down_block_types=("DownBlock2D",) * 2,
                       up_block_types=("UpBlock2D",) * 2)
def load(kind, tag):
    m = unet(kind == "cond")
    m.load_state_dict(torch.load(os.path.join(CKPT, f"{kind}-{tag}.pt"), map_location="cpu", weights_only=True))
    return m.to(DEV).eval()
def b64(x):   # tensor in model units -> display bytes
    u8 = ((x.detach().float().cpu().clamp(-1, 1) * 0.5 + 0.5) * 255).round().to(torch.uint8).numpy()
    return base64.b64encode(u8.tobytes()).decode()
def ymap(y):
    return F.one_hot(y, 10).float()[:, :, None, None].expand(-1, -1, 28, 28).to(DEV)

Xtr = idx("train-images-idx3-ubyte.gz"); Ytr = idx("train-labels-idx1-ubyte.gz")
X = torch.tensor(Xtr, dtype=torch.float32)[:, None] / 255 * 2 - 1
out = {}

# forward: the clean digits only
out["forward"] = {"labels": Ytr[:6].tolist(), "x0": base64.b64encode(Xtr[:6].tobytes()).decode()}

# training: c96's loop, one iteration at a time
sched = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear")
g = torch.Generator().manual_seed(7)
n_it = 12
ii = torch.randint(0, len(X), (n_it,), generator=g)
tt = torch.randint(0, 1000, (n_it,), generator=g)
eps = torch.randn(n_it, 1, 28, 28, generator=g)
x0 = X[ii]
xt = sched.add_noise(x0, eps, tt)
tr = {"label": Ytr[ii.numpy()].tolist(), "t": tt.tolist(), "x0": b64(x0), "eps": b64(eps), "xt": b64(xt),
      "tags": TAGS, "eps_hat": [], "mse": [], "samples": []}
log = json.load(open(os.path.join(CKPT, "uncond-log.json")))
tr["batch_loss"] = log["batch_loss"]
tr["tag_batch"] = [0, 5, 20, 50, 100, 200, 235, 470, 705]

@torch.no_grad()
def run(m, n, steps, seed, y=None, every=1):
    s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear"); s.set_timesteps(steps)
    gg = torch.Generator().manual_seed(seed)
    x = torch.randn(n, 1, 28, 28, generator=gg).to(DEV)
    ym = ymap(y) if y is not None else None
    fr = {"t": [], "xt": [], "eps_hat": [], "x0_hat": []}
    for i, t in enumerate(s.timesteps):
        e = m(torch.cat([x, ym], 1) if ym is not None else x, t).sample
        o = s.step(e, t, x, generator=gg)
        # the last step (t = 0) is stored too: its x0-hat IS the result (ᾱ before it is 1, so the step returns x0-hat
        # and adds no noise), which lets the page's row run to the end instead of jumping to the result (his round 3)
        if i % every == 0 or i == len(s.timesteps) - 1:
            fr["t"].append(int(t)); fr["xt"].append(x.clone()); fr["eps_hat"].append(e.clone()); fr["x0_hat"].append(o.pred_original_sample.clone())
        x = o.prev_sample
    assert torch.equal(x, fr["x0_hat"][-1]), "the last step's output is its x0-hat"
    return fr

with torch.no_grad():
    for tag in TAGS:
        m = load("uncond", tag)
        e = m(xt.to(DEV), tt.to(DEV)).sample.cpu()
        tr["eps_hat"].append(b64(e))
        tr["mse"].append([round(v, 4) for v in ((e - eps) ** 2).mean((1, 2, 3)).tolist()])
        tr["samples"].append(b64(run(m, 8, 500, 42, every=10 ** 9)["x0_hat"][-1]))
        print("ckpt", tag, flush=True)
out["training"] = tr

# generation: c113
fr = run(load("uncond", "e3"), 16, 500, 42, every=10)
out["generation"] = {"steps": 500, "t": fr["t"],
                     "xt": [b64(v) for v in fr["xt"]], "eps_hat": [b64(v) for v in fr["eps_hat"]],
                     "x0_hat": [b64(v) for v in fr["x0_hat"]]}
print("generation", len(fr["t"]), flush=True)

# conditional: c129, rows share x_T and z. A batch-of-one run per label from
# the row's seed draws the same x_T and the same z at every step, so a row
# differs only in the label.
mc = load("cond", "e5")
cond = {"steps": 75, "t": None, "xt": [], "x0_hat": [], "eps_hat": []}   # eps_hat added 2026-10-20 for the subtraction row
for r in range(4):
    for d in range(10):
        fr = run(mc, 1, 75, 200 + r, y=torch.tensor([d]), every=3)
        cond["t"] = fr["t"]
        cond["xt"].append([b64(v) for v in fr["xt"]])
        cond["x0_hat"].append([b64(v) for v in fr["x0_hat"]])
        cond["eps_hat"].append([b64(v) for v in fr["eps_hat"]])
print("conditional", len(cond["t"]), flush=True)
out["conditional"] = cond

json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "diffusion-mock-data.json"), "w"))
print("written")
