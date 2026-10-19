import os, sys, torch, numpy as np
from PIL import Image
from diffusers import UNet2DModel, DDPMScheduler
import torch.nn.functional as F
D = sys.argv[1]; OUT = sys.argv[2]; dev = "cuda"
def unet(cond):
    kw = dict(sample_size=28, in_channels=11 if cond else 1, out_channels=1, layers_per_block=2,
              block_out_channels=(64, 64), down_block_types=("DownBlock2D",) * 2, up_block_types=("UpBlock2D",) * 2)
    return UNet2DModel(**kw)
def load(kind, tag):
    m = unet(kind == "cond"); m.load_state_dict(torch.load(f"{D}/models-107/{kind}-{tag}.pt", map_location="cpu", weights_only=True)); return m.to(dev).eval()
def tile(imgs, nrow):
    imgs = ((imgs.clamp(-1, 1) + 1) / 2 * 255).byte().cpu().numpy()[:, 0]
    n = len(imgs); rows = (n + nrow - 1) // nrow
    canvas = np.full((rows * 30, nrow * 30), 128, np.uint8)
    for i, im in enumerate(imgs):
        r, c = divmod(i, nrow); canvas[r*30+1:r*30+29, c*30+1:c*30+29] = im
    return Image.fromarray(canvas).resize((nrow * 90, rows * 90), Image.NEAREST)
@torch.no_grad()
def run(m, n, steps, seed, y=None, keep=()):
    s = DDPMScheduler(num_train_timesteps=1000, beta_schedule="linear"); s.set_timesteps(steps)
    g = torch.Generator().manual_seed(seed); x = torch.randn(n, 1, 28, 28, generator=g).to(dev)
    ym = F.one_hot(y, 10).float()[:, :, None, None].expand(-1, -1, 28, 28).to(dev) if y is not None else None
    xs, x0s = [], []
    for t in s.timesteps:
        out = s.step(m(torch.cat([x, ym], 1) if ym is not None else x, t).sample, t, x, generator=g)
        if int(t) in keep: xs.append(x.clone()); x0s.append(out.pred_original_sample.clone())
        x = out.prev_sample
    return x, xs, x0s
m = load("uncond", "e3")
x, _, _ = run(m, 32, 500, 7); tile(x, 8).save(f"{OUT}/uncond-500.png")
keep = (998, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50, 0)
x, xs, x0s = run(m, 4, 500, 42, keep=keep)
tile(torch.cat([torch.stack([a[i] for a in xs] + [torch.stack([b[i] for b in x0s])][0:0]) for i in range(4)] +
               [torch.stack([b[i] for b in x0s]) for i in range(4)]), len(keep)).save(f"{OUT}/traj.png")
mc = load("cond", "e5")
x, _, _ = run(mc, 40, 75, 42, y=torch.arange(10).repeat(4)); tile(x, 10).save(f"{OUT}/cond-75.png")
x, _, _ = run(mc, 10, 75, 100, y=torch.arange(10)); tile(x, 10).save(f"{OUT}/cond-same-xT.png")
print("ok")
