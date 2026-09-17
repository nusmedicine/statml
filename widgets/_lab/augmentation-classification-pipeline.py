"""Cell 19's pipeline for a classification sample, on MONAI 1.6.0: every line
with keys=["image"], no AsDiscreted, and a class index as the label. Run
2026-09-17 for slot 62's Pipeline page under Classification:

    python widgets/_lab/augmentation-classification-pipeline.py > widgets/_lab/augmentation-classification-pipeline.txt

Asks: does it run; where CacheDataset's cache ends; what the label is after
every fetch and in a batch; whether the validation list gives the same sample
every fetch; and what cell 19 as written does with a class label."""
import os
import tempfile

import numpy as np
import torch
from PIL import Image

import monai
from monai.data import CacheDataset, DataLoader
from monai.transforms import (
    Compose, LoadImaged, EnsureChannelFirstd, EnsureTyped, ScaleIntensityd, SpatialPadd,
    RandFlipd, RandRotate90d, RandAffined, RandAdjustContrastd, RandGaussianNoised,
    AsDiscreted, MapTransform,
)

print("monai", monai.__version__, "torch", torch.__version__)
tmp = tempfile.mkdtemp()
rng = np.random.default_rng(0)
paths = []
for i in range(2):
    p = os.path.join(tmp, f"image{i + 1}.png")
    Image.fromarray(rng.integers(0, 256, (64, 64, 3), dtype=np.uint8), mode="RGB").save(p)
    paths.append(p)

calls = {"before": 0, "after": 0}


class Count(MapTransform):
    def __init__(self, slot):
        super().__init__(["image"])
        self.slot = slot

    def __call__(self, d):
        calls[self.slot] += 1
        return dict(d)


READER = dict(reader="PILReader", reverse_indexing=False)
fixed = [
    LoadImaged(keys=["image"], **READER),
    EnsureChannelFirstd(keys=["image"]),
    EnsureTyped(keys=["image"]),
    ScaleIntensityd(keys=["image"]),
    SpatialPadd(keys=["image"], spatial_size=(64, 64)),
]
random_lines = [
    RandFlipd(keys=["image"], prob=0.5, spatial_axis=0),
    RandFlipd(keys=["image"], prob=0.5, spatial_axis=1),
    RandRotate90d(keys=["image"], prob=0.5, max_k=3),
    RandAffined(keys=["image"], prob=0.25, rotate_range=np.deg2rad(10.0), translate_range=(8, 8),
                scale_range=(0.1, 0.1), padding_mode="zeros", mode="bilinear"),
    RandAdjustContrastd(keys=["image"], prob=0.3, gamma=(0.7, 1.5)),
    RandGaussianNoised(keys=["image"], prob=0.15, mean=0.0, std=0.01),
]

# 1. the training list, one sample, five fetches
train = Compose(fixed + [Count("before")] + random_lines + [Count("after")])
train.set_random_state(seed=5)
ds = CacheDataset([{"image": paths[0], "label": 6}], transform=train, cache_rate=1.0, progress=False, num_workers=0)
labels = []
images = []
for _ in range(5):
    s = ds[0]
    labels.append((s["label"], type(s["label"]).__name__))
    images.append(s["image"].clone())
distinct = len({tuple(im.flatten()[:64].tolist()) for im in images})
print(f"training: runs; image {tuple(images[0].shape)}; the transform before RandFlipd ran {calls['before']} time(s) "
      f"and the one after RandGaussianNoised {calls['after']} time(s) over 5 fetches")
print(f"training: label after each fetch {labels}")
print(f"training: {distinct} distinct samples in 5 fetches")

# 2. a batch of two
ds2 = CacheDataset([{"image": paths[0], "label": 6}, {"image": paths[1], "label": 1}], transform=Compose(fixed + random_lines),
                   cache_rate=1.0, progress=False, num_workers=0)
batch = next(iter(DataLoader(ds2, batch_size=2, shuffle=False)))
print(f"batch: image {tuple(batch['image'].shape)}; label {batch['label'].tolist()} dtype {batch['label'].dtype}")

# 3. the validation list: the fixed lines only
val = CacheDataset([{"image": paths[0], "label": 6}], transform=Compose(fixed), cache_rate=1.0, progress=False, num_workers=0)
same = all(torch.equal(val[0]["image"], val[0]["image"]) for _ in range(5))
print(f"validation: every fetch the same sample: {same}; label {val[0]['label']!r}")

# 4. cell 19 as written, given a class label
cell19 = Compose([
    LoadImaged(keys=["image", "label"], **READER),
    EnsureChannelFirstd(keys=["image", "label"]),
    EnsureTyped(keys=["image", "label"]),
    ScaleIntensityd(keys=["image"]),
    SpatialPadd(keys=["image", "label"], spatial_size=(64, 64)),
    RandFlipd(keys=["image", "label"], prob=0.5, spatial_axis=0),
    AsDiscreted(keys=["label"], threshold=0.5),
])
try:
    cell19({"image": paths[0], "label": 6})
    print("cell 19 as written with a class label: runs")
except Exception as e:
    msg = str(e).strip().splitlines()
    print(f"cell 19 as written with a class label: raises {type(e).__name__}: {msg[-1][:160] if msg else ''}")
