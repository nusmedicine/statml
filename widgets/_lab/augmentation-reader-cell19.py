"""Kenneth's revised cell 19 and his show_image_label tensor steps, run on
MONAI 1.6.0 with a NON-SQUARE RGB JPG and its mask, so a swapped axis shows in
the shape. Checks: shapes after each pipeline, whether the plotted arrays
equal the files, whether image and mask stay aligned, and the batch path.
Run 2026-09-17 on the cell he sent:

    python widgets/_lab/augmentation-reader-cell19.py > widgets/_lab/augmentation-reader-cell19.txt

Found: train_transforms (with the arguments) loads [C, H, W] and plots equal
the files; val_test_transforms as first sent loaded width first (told him, and
he added the arguments there too); show_image_label's shapes are right."""
import os, tempfile
import numpy as np
import torch
from PIL import Image
from monai.data import CacheDataset, decollate_batch
from torch.utils.data import DataLoader
from monai.transforms import (
    Compose, LoadImaged, EnsureChannelFirstd, EnsureTyped,
    ScaleIntensityd, SpatialPadd, RandFlipd, RandRotate90d,
    RandAffined, RandAdjustContrastd, RandGaussianNoised, AsDiscreted,
)

tmp = tempfile.mkdtemp()
H, W = 40, 60                                   # rows, columns of the saved files
img = np.full((H, W, 3), 230, np.uint8)
mask = np.zeros((H, W), np.uint8)
img[5:15, 8:30] = (200, 40, 40); mask[5:15, 8:30] = 255     # a bar near the top-left
img[5:35, 8:12] = (200, 40, 40); mask[5:35, 8:12] = 255     # and a stem down its left side
paths = []
for i in range(4):
    ip, mp = os.path.join(tmp, f"image{i}.jpg"), os.path.join(tmp, f"mask{i}.png")
    Image.fromarray(img).save(ip, quality=95)
    Image.fromarray(mask).save(mp)             # PNG, so the 0/1 check is not about JPG artefacts
    paths.append({"image": ip, "label": mp})
file_img = np.asarray(Image.open(paths[0]["image"]))
file_mask = np.asarray(Image.open(paths[0]["label"])) > 127

roi_size = (64, 64)                             # square, as in the notebook, small for speed

# --- his cell 19, verbatim except roi_size ---------------------------------------
train_transforms = Compose([
    LoadImaged(keys=["image", "label"],            # Fixed
               reader="PILReader",
               reverse_indexing=False),
    EnsureChannelFirstd(keys=["image", "label"]),  # Fixed
    EnsureTyped(keys=["image", "label"]),          # Fixed

    ScaleIntensityd(keys=["image"]),                               # Fixed
    SpatialPadd(keys=["image", "label"], spatial_size=roi_size),   # Fixed
    RandFlipd(keys=["image", "label"], prob=0.5, spatial_axis=0),  # Augmentation
    RandFlipd(keys=["image", "label"], prob=0.5, spatial_axis=1),  # Augmentation
    RandRotate90d(keys=["image", "label"], prob=0.5, max_k=3),     # Augmentation
    RandAffined(keys=["image", "label"], prob=0.25,                # Augmentation
                rotate_range=np.deg2rad(10.0),
                translate_range=(8, 8),
                scale_range=(0.1, 0.1),
                padding_mode="zeros",
                mode=("bilinear","nearest")),
    RandAdjustContrastd(keys=["image"], prob=0.3, gamma=(0.7,1.5)),    # Augmentation
    RandGaussianNoised(keys=["image"], prob=0.15, mean=0.0, std=0.01), # Augmentation
    AsDiscreted(keys=["label"], threshold=0.5),                        # Fixed (label)
])

val_test_transforms = Compose([
    LoadImaged(keys=["image", "label"]),                                # Fixed
    EnsureChannelFirstd(keys=["image", "label"]),                       # Fixed
    EnsureTyped(keys=["image", "label"]),                               # Fixed
    ScaleIntensityd(keys=["image"]),                                    # Fixed
    SpatialPadd(keys=["image", "label"], spatial_size=roi_size),        # Fixed
    AsDiscreted(keys=["label"], threshold=0.5),                         # Fixed (label)
])

# --- the same val list with the two arguments added --------------------------------
val_fixed = Compose([LoadImaged(keys=["image", "label"], reader="PILReader", reverse_indexing=False)]
                    + list(val_test_transforms.transforms[1:]))

def plotted(sample):                    # his show_image_label, the tensor steps only
    img = sample["image"].clamp(0, 1)
    mask = sample["label"]
    return img.permute(1, 2, 0).cpu().numpy(), mask.squeeze(0).cpu().numpy()

def loaded_only(t, p):                  # the load and channel lines alone, before any padding
    return Compose(list(t.transforms[:3]))(p)

for name, t in (("train_transforms", train_transforms), ("val_test_transforms as written", val_test_transforms),
                ("val_test_transforms with the arguments", val_fixed)):
    s = loaded_only(t, paths[0])
    img_hwc, mask_hw = plotted({"image": s["image"] / 255.0, "label": s["label"]})
    same = img_hwc.shape[:2] == (H, W) and np.array_equal((img_hwc * 255).round().astype(np.uint8), file_img)
    print(f"{name}: loaded image {tuple(s['image'].shape)}, label {tuple(s['label'].shape)};"
          f" plotted {img_hwc.shape} / {mask_hw.shape}; plot equals the saved JPG: {same};"
          f" mask plot equals the saved mask: {mask_hw.shape == file_mask.shape and np.array_equal(mask_hw > 127, file_mask)}")

# --- the whole train list: shapes, and image/mask alignment after random transforms ---
train_transforms.set_random_state(seed=0)
ds = CacheDataset(paths, transform=train_transforms, cache_rate=1.0, progress=False, num_workers=0)
worst = 1.0
for _ in range(40):
    s = ds[0]
    img_hwc, mask_hw = plotted(s)
    red = (img_hwc[..., 0] - img_hwc[..., 1]) > 0.3          # the red shape, from the image
    m = mask_hw > 0.5
    dice = 2 * (red & m).sum() / max(1, red.sum() + m.sum())
    worst = min(worst, dice)
print(f"train_transforms: image {tuple(s['image'].shape)}, label {tuple(s['label'].shape)}, label values {sorted(set(s['label'].unique().tolist()))};"
      f" image and mask overlap over 40 random samples, lowest Dice {worst:.3f}")

# --- a batch, decollated, as the notebook plots it -------------------------------------
batch = next(iter(DataLoader(ds, batch_size=4)))
items = decollate_batch(batch)
img_hwc, mask_hw = plotted(items[1])
print(f"batch: image {tuple(batch['image'].shape)}, label {tuple(batch['label'].shape)};"
      f" decollated item image {tuple(items[1]['image'].shape)}; plotted {img_hwc.shape} and {mask_hw.shape}")
