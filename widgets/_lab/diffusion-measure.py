"""Widget 107 diffusion: measurements on 10-3b cells 95-129, before any mock.

    python -I diffusion-measure.py <frontiers-data dir> schedule

schedule  the signal left at each t under 10-3b's DDPMScheduler(1000,
          "linear"): sqrt(abar_t), the correlation of x_t with x0 over MNIST
          test digits in [-1, 1] (c99's scaling), and how well a classifier
          TRAINED ON x_t (given t) can still name the digit at each t. The
          last is the instrument for "is the digit still in there": a clean
          classifier fed noise measures its own brittleness, not the signal.

The schedule is diffusers' "linear": betas = linspace(1e-4, 0.02, 1000),
alphas_cumprod = cumprod(1 - betas); the notebook's t runs 0..999 (c109's
randint(0, 1000)), so t = 0 already carries one step of noise.
"""
import gzip, json, os, sys
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

DATA = sys.argv[1]
STAGE = sys.argv[2]
# train and measure take a device last ("cuda"); the CPU is the default. The
# unconditional model was trained on the CPU, the conditional on the GPU.
DEV = sys.argv[4] if len(sys.argv) > 4 else "cpu"
torch.manual_seed(42); np.random.seed(42)

def idx(name):
    with gzip.open(os.path.join(DATA, "mnist", name), "rb") as f:
        data = f.read()
    if data[2] == 8 and data[3] == 3:
        n, r, c = np.frombuffer(data[4:16], ">i4")
        return np.frombuffer(data[16:], np.uint8).reshape(n, r, c)
    n = np.frombuffer(data[4:8], ">i4")[0]
    return np.frombuffer(data[8:], np.uint8)

T = 1000
betas = torch.linspace(1e-4, 0.02, T, dtype=torch.float64)
abar = torch.cumprod(1 - betas, 0)

if STAGE == "schedule":
    Xtr = torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255 * 2 - 1
    Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
    Xte = torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255 * 2 - 1
    Yte = torch.tensor(idx("t10k-labels-idx1-ubyte.gz"), dtype=torch.long)
    sa = abar.sqrt().float(); sn = (1 - abar).sqrt().float()

    def noisy(x, t):
        e = torch.randn_like(x)
        return sa[t].view(-1, 1, 1) * x + sn[t].view(-1, 1, 1) * e

    # Correlation of x_t with x0, per image, averaged.
    grid = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 999]
    x0 = Xte[:2000]
    corr = {}
    for t in grid:
        xt = noisy(x0, torch.full((len(x0),), t))
        a = x0.flatten(1) - x0.flatten(1).mean(1, keepdim=True)
        b = xt.flatten(1) - xt.flatten(1).mean(1, keepdim=True)
        corr[t] = round(((a * b).sum(1) / (a.norm(dim=1) * b.norm(dim=1))).mean().item(), 3)

    # A classifier trained on x_t with t as an input: accuracy per t.
    class Net(nn.Module):
        def __init__(s):
            super().__init__()
            s.c1 = nn.Conv2d(2, 32, 3, padding=1); s.c2 = nn.Conv2d(32, 64, 3, padding=1)
            s.f1 = nn.Linear(64 * 7 * 7, 128); s.f2 = nn.Linear(128, 10)
        def forward(s, x, t):
            tm = (t.float() / T).view(-1, 1, 1, 1).expand(-1, 1, 28, 28)
            h = torch.cat([x.unsqueeze(1), tm], 1)
            h = F.max_pool2d(F.relu(s.c1(h)), 2); h = F.max_pool2d(F.relu(s.c2(h)), 2)
            return s.f2(F.relu(s.f1(h.flatten(1))))
    net = Net(); opt = torch.optim.Adam(net.parameters(), 1e-3)
    for ep in range(3):
        perm = torch.randperm(len(Xtr))
        for i in range(0, len(Xtr), 256):
            j = perm[i:i + 256]; t = torch.randint(0, T, (len(j),))
            loss = F.cross_entropy(net(noisy(Xtr[j], t), t), Ytr[j])
            opt.zero_grad(); loss.backward(); opt.step()
        print("epoch", ep + 1, flush=True)
    net.eval(); acc = {}
    with torch.no_grad():
        for t in grid:
            tt = torch.full((len(Xte),), t)
            acc[t] = round((net(noisy(Xte, tt), tt).argmax(1) == Yte).float().mean().item(), 3)

    out = {
        "t": grid,
        "sqrt_abar": [round(sa[t].item(), 4) for t in grid],
        "sqrt_1m_abar": [round(sn[t].item(), 4) for t in grid],
        "corr_xt_x0": [corr[t] for t in grid],
        "acc_noise_aware_clf": [acc[t] for t in grid],
        "t_where_sqrt_abar_below": {str(v): int((sa < v).nonzero()[0].item()) for v in (0.5, 0.2, 0.1, 0.05, 0.01)},
        "sqrt_abar_at_999": sa[999].item(),
    }
    print(json.dumps(out, indent=1))
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "diffusion-schedule.json"), "w"), indent=1)

# ---------------------------------------------------------------------------
# train <uncond|cond>: 10-3b's two models as the notebook builds them (c101-109
# unconditional, 3 epochs; c119-125 conditional with the one-hot label map, 5
# epochs), seed 42, AdamW lr 1e-3, batch 256, DDPMScheduler(1000, "linear").
# torchvision is not installed, so the shuffle is torch.randperm under the same
# seed rather than DataLoader's; the model and every hyperparameter are the
# notebook's. Checkpoints at 0, 5, 20, 50, 100, 200 batches and each epoch's
# end, for a Train press that replays training (as 104 and 106).
CKPT = os.path.join(DATA, "models-107")

def unet(cond):
    from diffusers import UNet2DModel
    if cond:   # c121 as written: layers_per_block left at its default (2)
        return UNet2DModel(sample_size=28, in_channels=11, out_channels=1,
                           block_out_channels=(64, 64),
                           down_block_types=("DownBlock2D", "DownBlock2D"),
                           up_block_types=("UpBlock2D", "UpBlock2D"))
    return UNet2DModel(sample_size=28, in_channels=1, out_channels=1, layers_per_block=2,
                       block_out_channels=(64, 64),
                       down_block_types=("DownBlock2D", "DownBlock2D"),
                       up_block_types=("UpBlock2D", "UpBlock2D"))

def one_hot_map(y, H=28, W=28):
    return F.one_hot(y, 10).float()[:, :, None, None].expand(-1, -1, H, W)

if STAGE == "train":
    import time
    from diffusers import DDPMScheduler
    kind = sys.argv[3]; cond = kind == "cond"
    os.makedirs(CKPT, exist_ok=True)
    Xtr = (torch.tensor(idx("train-images-idx3-ubyte.gz"), dtype=torch.float32) / 255 * 2 - 1).unsqueeze(1)
    Ytr = torch.tensor(idx("train-labels-idx1-ubyte.gz"), dtype=torch.long)
    torch.manual_seed(42); np.random.seed(42)
    model = unet(cond).to(DEV)
    Xtr, Ytr = Xtr.to(DEV), Ytr.to(DEV)
    sched = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear")
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
    epochs = 5 if cond else 3
    marks = {0, 5, 20, 50, 100, 200}
    nb = (len(Xtr) + 255) // 256
    log = {"batch_loss": [], "epoch_loss": [], "checkpoints": []}
    def save(tag):
        torch.save(model.state_dict(), os.path.join(CKPT, f"{kind}-{tag}.pt"))
        log["checkpoints"].append(tag)
    step = 0; save("b0"); t0 = time.time()
    for ep in range(epochs):
        model.train(); perm = torch.randperm(len(Xtr)); s = 0.0
        for i in range(0, len(Xtr), 256):
            j = perm[i:i + 256]; x = Xtr[j]
            noise = torch.randn_like(x)
            t = torch.randint(0, 1000, (len(j),)).long().to(DEV)
            xt = sched.add_noise(x, noise, t)
            if cond:
                xt = torch.cat([xt, one_hot_map(Ytr[j])], 1)
            loss = F.mse_loss(model(xt, t).sample, noise)
            opt.zero_grad(); loss.backward(); opt.step()
            s += loss.item(); step += 1
            log["batch_loss"].append(round(loss.item(), 5))
            if step in marks: save(f"b{step}")
            if step % 50 == 0:
                print(f"{kind} ep {ep+1} batch {step} loss {loss.item():.4f} {time.time()-t0:.0f}s", flush=True)
        log["epoch_loss"].append(round(s / nb, 5))
        print(f"{kind} Epoch {ep+1}/{epochs} | Train loss {s/nb:.4f}", flush=True)
        save(f"e{ep+1}")
    json.dump(log, open(os.path.join(CKPT, f"{kind}-log.json"), "w"))

# ---------------------------------------------------------------------------
# measure: the trained models' claims, read by 106's clean MNIST classifier
# (models-106/clf.pt, trained on [0, 1] pixels; fed (x + 1) / 2 clamped).
#   uncond  when x0-hat (the scheduler's pred_original_sample) commits to the
#           digit it ends as; x0-hat clipping by t (diffusers clips x0-hat to
#           [-1, 1] and steps from it, where the notebook's pseudocode steps
#           from eps); quality and digit spread by inference steps; samples
#           from each training checkpoint; the eps loss by t.
#   cond    c129's 75 steps: does the label set the digit; one x_T under ten
#           labels; when the label's effect appears.
if STAGE == "measure":
    import time
    from diffusers import DDPMScheduler
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    class Classifier(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                nn.Flatten(1), nn.Linear(64 * 49, 128), nn.ReLU(), nn.Linear(128, 10))
        def forward(self, x):
            return self.net(x)
    clf = Classifier()
    clf.load_state_dict(torch.load(os.path.join(DATA, "models-106", "clf.pt"), weights_only=True)); clf.eval()
    def probs(x):
        with torch.no_grad():
            return F.softmax(clf(((x.cpu() + 1) / 2).clamp(0, 1)), 1)
    def quality(x):
        p = probs(x); top, arg = p.max(1)
        return {"share_top_ge_0.9": round((top >= 0.9).float().mean().item(), 3),
                "median_top": round(top.median().item(), 3),
                "digits_at_0.9": np.bincount(arg[top >= 0.9].numpy(), minlength=10).tolist()}

    def load(kind, tag="e3"):
        m = unet(kind == "cond")
        m.load_state_dict(torch.load(os.path.join(CKPT, f"{kind}-{tag}.pt"), weights_only=True, map_location="cpu"))
        return m.to(DEV).eval()

    @torch.no_grad()
    def sample(model, n, steps, seed, y=None, trace=False):
        s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear")
        s.set_timesteps(steps)
        g = torch.Generator().manual_seed(seed)
        # the generator stays on the CPU so a seed gives the same x_T and z on
        # either device; diffusers draws z on the generator's device and moves it
        x = torch.randn(n, 1, 28, 28, generator=g).to(DEV)
        ymap = one_hot_map(y).to(DEV) if y is not None else None
        rec = []
        for t in s.timesteps:
            xin = torch.cat([x, ymap], 1) if ymap is not None else x
            eps = model(xin, t).sample
            a = s.alphas_cumprod[t].to(DEV)
            raw = (x - (1 - a).sqrt() * eps) / a.sqrt()
            out = s.step(eps, t, x, generator=g)
            if trace:
                rec.append({"t": int(t), "x0hat": out.pred_original_sample.clone(),
                            "clipped": ((raw.abs() > 1).float().mean().item())})
            x = out.prev_sample
        return x, rec

    which = sys.argv[3]
    res = {}
    if which == "uncond":
        m = load("uncond", "e3"); t0 = time.time()
        # 1. commitment: 64 samples, 500 steps (c113), x0-hat read at every step
        x, rec = sample(m, 64, 500, 42, trace=True)
        final = probs(x).argmax(1)
        agree, clip = {}, {}
        commit = torch.full((64,), 999)
        cls = []
        for r in rec:
            c = probs(r["x0hat"]).argmax(1); cls.append(c)
            agree[r["t"]] = round((c == final).float().mean().item(), 3)
            clip[r["t"]] = round(r["clipped"], 4)
        # commit t = the largest t from which x0-hat's class equals the final class at every later step
        for i in range(64):
            ct = 0
            for r, c in zip(reversed(rec), reversed(cls)):   # small t first
                if c[i].item() != final[i].item():
                    break
                ct = r["t"]
            commit[i] = ct
        pick = lambda d: {k: d[k] for k in sorted(d) if k % 100 < 2 or k > 990}
        res["x0hat_class_agrees_with_final_by_t"] = pick(agree)
        res["x0hat_share_clipped_by_t"] = pick(clip)
        res["commit_t_quartiles"] = [int(v) for v in np.percentile(commit.numpy(), [25, 50, 75])]
        res["final_quality_500"] = quality(x)
        print("commit done", time.time() - t0, flush=True)
        # 2. inference steps
        res["by_steps"] = {}
        for steps in (1000, 500, 75, 20, 10):
            x, _ = sample(m, 128, steps, 7)
            res["by_steps"][steps] = quality(x); print("steps", steps, time.time() - t0, flush=True)
        # 3. checkpoints
        res["by_checkpoint"] = {}
        for tag in ("b0", "b5", "b20", "b50", "b100", "b200", "e1", "e2", "e3"):
            x, _ = sample(load("uncond", tag), 32, 500, 42)
            res["by_checkpoint"][tag] = quality(x)
        print("ckpt done", time.time() - t0, flush=True)
        # 4. eps loss by t on test digits
        Xte = (torch.tensor(idx("t10k-images-idx3-ubyte.gz"), dtype=torch.float32) / 255 * 2 - 1).unsqueeze(1)[:1000].to(DEV)
        s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear")
        loss = {}
        with torch.no_grad():
            for t in (0, 10, 50, 100, 200, 400, 600, 800, 999):
                n = torch.randn_like(Xte); tt = torch.full((len(Xte),), t, device=DEV)
                loss[t] = round(F.mse_loss(m(s.add_noise(Xte, n, tt), tt).sample, n).item(), 4)
        res["eps_mse_by_t"] = loss
        res["train_log_epoch_loss"] = json.load(open(os.path.join(CKPT, "uncond-log.json")))["epoch_loss"]
    if which == "cond":
        m = load("cond", "e5"); t0 = time.time()
        y = torch.arange(10).repeat_interleave(30)
        x, _ = sample(m, 300, 75, 42, y=y)
        p = probs(x); arg = p.argmax(1)
        res["label_read_back"] = round((arg == y).float().mean().item(), 3)
        res["label_read_back_per_digit"] = [round((arg[y == d] == d).float().mean().item(), 2) for d in range(10)]
        res["quality_75"] = quality(x)
        # one x_T, ten labels: same noise for every label
        g = torch.Generator().manual_seed(3)
        xs = []
        for d in range(10):
            xx, _ = sample(m, 8, 75, 100 + 0, y=torch.full((8,), d))
            xs.append(xx)
        same_noise = torch.stack(xs)                    # (10 labels, 8 noises, ...)
        f = same_noise.flatten(2)
        def corr(a, b):
            a = a - a.mean(); b = b - b.mean(); return (a @ b / (a.norm() * b.norm())).item()
        across_labels_same_noise = np.mean([corr(f[i, k], f[j, k]) for k in range(8) for i in range(10) for j in range(i + 1, 10)])
        same_label_diff_noise = np.mean([corr(f[d, k], f[d, l]) for d in range(10) for k in range(8) for l in range(k + 1, 8)])
        res["pixel_corr_same_xT_diff_label"] = round(float(across_labels_same_noise), 3)
        res["pixel_corr_same_label_diff_xT"] = round(float(same_label_diff_noise), 3)
        res["same_xT_label_read_back"] = round(float(np.mean([(probs(same_noise[d]).argmax(1) == d).float().mean().item() for d in range(10)])), 3)
        res["train_log_epoch_loss"] = json.load(open(os.path.join(CKPT, "cond-log.json")))["epoch_loss"]
        res["by_checkpoint_read_back"] = {}
        for tag in ("b0", "b20", "b100", "e1", "e3", "e5"):
            xx, _ = sample(load("cond", tag), 100, 75, 42, y=torch.arange(10).repeat_interleave(10))
            res["by_checkpoint_read_back"][tag] = round((probs(xx).argmax(1) == torch.arange(10).repeat_interleave(10)).float().mean().item(), 3)
        print("cond done", time.time() - t0, flush=True)
    print(json.dumps(res, indent=1))
    json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), f"diffusion-measure-{which}.json"), "w"), indent=1)
