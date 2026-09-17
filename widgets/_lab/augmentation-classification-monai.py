"""What MONAI 1.6.0 does when a classification sample (a class index, not a
mask) goes through cell 19's augment lines with keys=["image", "label"], and
with keys=["image"]. Run 2026-09-17 for slot 62's classification option:

    python widgets/_lab/augmentation-classification-monai.py > widgets/_lab/augmentation-classification-monai.txt

Found: with the label in keys, both flips, RandRotate90d and RandAffined raise
for every label type tried, and RandAdjustContrastd returns the label as a
float; with keys=["image"] every line leaves the label unchanged."""
import numpy as np
import torch
import monai
from monai.transforms import RandFlipd, RandRotate90d, RandAffined, RandAdjustContrastd

print("monai", monai.__version__, "torch", torch.__version__)
torch.manual_seed(0)
image = torch.rand(1, 8, 8)

labels = {
    "int 2": 2,
    "np.int64 2": np.int64(2),
    "tensor(2)": torch.tensor(2),
    "tensor([2])": torch.tensor([2]),
    "multi-hot [0,1,0,0]": torch.tensor([0.0, 1.0, 0.0, 0.0]),
}

def lines(keys):
    return {
        "RandFlipd axis 0": RandFlipd(keys=keys, prob=1.0, spatial_axis=0),
        "RandFlipd axis 1": RandFlipd(keys=keys, prob=1.0, spatial_axis=1),
        "RandRotate90d": RandRotate90d(keys=keys, prob=1.0, max_k=3),
        "RandAffined": RandAffined(keys=keys, prob=1.0, rotate_range=np.deg2rad(10.0),
                                   translate_range=(8, 8), scale_range=(0.1, 0.1),
                                   padding_mode="zeros",
                                   mode=("bilinear", "nearest") if len(keys) == 2 else "bilinear"),
        "RandAdjustContrastd": RandAdjustContrastd(keys=keys, prob=1.0, gamma=(0.7, 1.5)),
    }

for keys in (["image", "label"], ["image"]):
    print(f"\n==== keys={keys} ====")
    for lname, label in labels.items():
        for tname, t in lines(keys).items():
            t.set_random_state(seed=3)
            try:
                out = t({"image": image.clone(), "label": label})
                lab = out["label"]
                shown = lab.tolist() if hasattr(lab, "tolist") else lab
                print(f"  {lname:22s} {tname:20s} OK   label -> {shown!r} ({type(lab).__name__})")
            except Exception as e:
                msg = str(e).strip().splitlines()
                print(f"  {lname:22s} {tname:20s} RAISES {type(e).__name__}: {msg[-1][:150] if msg else ''}")
