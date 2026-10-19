"""Widget 107 diffusion, review round 1: the data for _lab/diffusion-mock2.html.

    python -I diffusion-mock2data.py <frontiers-data dir> [cuda]

His three questions on the draft (2026-10-20): is a value of N(0, 1) shown
anywhere; does Conditional show Forward and Training too; can generation show
the noise being subtracted. Writes _lab/diffusion-mock2-data.json (untracked):

cond_training  the conditional model's eleven checkpoints (0, 5, 20, 50, 100,
               200 batches, epochs 1-5): eps-hat and its error on the same 12
               iterations as the Training page (each with its own label), the
               batch losses, one sample a label at c129's 75 steps from one
               shared x_T (seed 300), and how many of the ten read back as
               their label (106's classifier)
step           one denoising step written as c96's pseudocode writes it, for
               each of the 16 Generation samples at t = 998, 498 and 98 of
               c113's 500-step run (seed 42, so the x_t are the stored ones):
               x_t, eps-hat, the mean (x_t - k eps-hat) / sqrt(alpha_t) with
               k = (1 - alpha_t) / sqrt(1 - abar_t), sigma_t z, and x_{t-1} =
               mean + sigma_t z, with k, sqrt(alpha_t) and sigma_t
"""
import base64, gzip, json, os, sys
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from diffusers import UNet2DModel, DDPMScheduler

DATA = sys.argv[1]; DEV = sys.argv[2] if len(sys.argv) > 2 else "cpu"
CKPT = os.path.join(DATA, "models-107")
CTAGS = ["b0", "b5", "b20", "b50", "b100", "b200", "e1", "e2", "e3", "e4", "e5"]

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
def b64(x):
    u8 = ((x.detach().float().cpu().clamp(-1, 1) * 0.5 + 0.5) * 255).round().to(torch.uint8).numpy()
    return base64.b64encode(u8.tobytes()).decode()
def ymap(y):
    return F.one_hot(y, 10).float()[:, :, None, None].expand(-1, -1, 28, 28).to(DEV)

class Classifier(nn.Module):
    def __init__(s):
        super().__init__()
        s.net = nn.Sequential(nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2), nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                              nn.Flatten(1), nn.Linear(64 * 49, 128), nn.ReLU(), nn.Linear(128, 10))
    def forward(s, x): return s.net(x)
clf = Classifier(); clf.load_state_dict(torch.load(os.path.join(DATA, "models-106", "clf.pt"), weights_only=True)); clf.eval()

Xtr = idx("train-images-idx3-ubyte.gz"); Ytr = idx("train-labels-idx1-ubyte.gz")
X = torch.tensor(Xtr, dtype=torch.float32)[:, None] / 255 * 2 - 1
out = {}

# --- the conditional model's training, on the Training page's 12 iterations (same seed 7 draws)
sched = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear")
g = torch.Generator().manual_seed(7)
ii = torch.randint(0, len(X), (12,), generator=g); tt = torch.randint(0, 1000, (12,), generator=g)
eps = torch.randn(12, 1, 28, 28, generator=g)
xt = sched.add_noise(X[ii], eps, tt); yy = torch.tensor(Ytr[ii.numpy()], dtype=torch.long)
log = json.load(open(os.path.join(CKPT, "cond-log.json")))
ct = {"tags": CTAGS, "tag_batch": [0, 5, 20, 50, 100, 200, 235, 470, 705, 940, 1175],
      "batch_loss": [float(f"{v:.3g}") for v in log["batch_loss"]], "eps_hat": [], "mse": [], "samples": [], "read_back": []}

@torch.no_grad()
def sample_labels(m, seed, steps=75):
    """one x_T and one z stream for every label: a batch-of-one run per label from one seed"""
    res = []
    for d in range(10):
        s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear"); s.set_timesteps(steps)
        gg = torch.Generator().manual_seed(seed)
        x = torch.randn(1, 1, 28, 28, generator=gg).to(DEV); ym = ymap(torch.tensor([d]))
        for t in s.timesteps:
            x = s.step(m(torch.cat([x, ym], 1), t).sample, t, x, generator=gg).prev_sample
        res.append(x)
    return torch.cat(res)

with torch.no_grad():
    for tag in CTAGS:
        m = load("cond", tag)
        e = m(torch.cat([xt, ymap(yy).cpu()], 1).to(DEV), tt.to(DEV)).sample.cpu()
        ct["eps_hat"].append(b64(e)); ct["mse"].append([round(v, 4) for v in ((e - eps) ** 2).mean((1, 2, 3)).tolist()])
        sm = sample_labels(m, 300)
        ct["samples"].append(b64(sm))
        read = F.softmax(clf(((sm.cpu() + 1) / 2).clamp(0, 1)), 1).argmax(1)
        ct["read_back"].append(read.tolist())
        print("cond ckpt", tag, read.tolist(), flush=True)
out["cond_training"] = ct

# --- one step as c96's pseudocode writes it, on the Generation page's run (seed 42, 16 samples, 500 steps)
m = load("uncond", "e3")
s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear"); s.set_timesteps(500)
gg = torch.Generator().manual_seed(42)
x = torch.randn(16, 1, 28, 28, generator=gg).to(DEV)
zg = torch.Generator().manual_seed(4242)
steps = {}
with torch.no_grad():
    for i, t in enumerate(s.timesteps):
        e = m(x, t).sample
        if int(t) in (998, 498, 98):
            prev = int(s.timesteps[i + 1])
            ab, abp = s.alphas_cumprod[t].item(), s.alphas_cumprod[prev].item()
            alpha = ab / abp                                         # one stored step spans two schedule steps
            k = (1 - alpha) / (1 - ab) ** 0.5
            sigma = ((1 - abp) / (1 - ab) * (1 - alpha)) ** 0.5
            mean = (x - k * e) / alpha ** 0.5
            z = torch.randn(16, 1, 28, 28, generator=zg).to(DEV)
            steps[int(t)] = {"prev": prev, "k": round(k, 5), "sqrt_alpha": round(alpha ** 0.5, 5), "sigma": round(sigma, 5),
                             "xt": b64(x), "eps_hat": b64(e), "k_eps": b64(k * e), "mean": b64(mean), "sigma_z": b64(sigma * z), "next": b64(mean + sigma * z),
                             "change_rms": round(((mean + sigma * z - x) ** 2).mean().sqrt().item(), 4)}
            print("step", int(t), steps[int(t)]["k"], steps[int(t)]["sigma"], steps[int(t)]["change_rms"], flush=True)
        x = s.step(e, t, x, generator=gg).prev_sample
out["step"] = steps

# --- how much of epsilon the display clamps (|eps| > 1)
out["eps_clamped_share"] = round(float((torch.randn(1_000_000).abs() > 1).float().mean()), 3)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "diffusion-mock2-data.json"), "w"))
print("written")
