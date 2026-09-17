"""Does the widget's wording (axis 0 flips top to bottom, k = 1 turns
counter-clockwise, a positive rotate turns clockwise, translate (height,
width)) hold for what cell 27 PLOTS, under both reader orders? The plot is
permute(1, 2, 0), so its rows are tensor dim 1 whichever file axis that is.
Run 2026-09-17, when Kenneth asked why the reader argument was needed:

    python widgets/_lab/augmentation-reader-plots.py > widgets/_lab/augmentation-reader-plots.txt

Found: yes under both orders; the argument only decides whether the plot equals
the saved file."""
import os, tempfile
import numpy as np
import torch
from PIL import Image
from monai.transforms import LoadImage, EnsureChannelFirst, Flip, Rotate90, Affine

tmp = tempfile.mkdtemp()
H, W = 28, 36
file = np.zeros((H, W), np.uint8)
file[3:9, 4:20] = 255      # a bar near the top-left of the saved image
file[3:25, 4:7] = 180      # a stem down its left side: an asymmetric shape
path = os.path.join(tmp, "t.png")
Image.fromarray(file, mode="L").save(path)

def plotted(t):            # cell 27: img.permute(1, 2, 0), one channel
    return t.permute(1, 2, 0)[..., 0].numpy()

def centroid(a):
    ys, xs = np.nonzero(a > 60)
    return ys.mean(), xs.mean()

for reverse in (True, False):
    img = EnsureChannelFirst()(LoadImage(image_only=True, reader="PILReader", reverse_indexing=reverse)(path))
    shown = plotted(img)
    same_as_file = shown.shape == file.shape and np.array_equal(shown > 60, file > 60)
    flip = plotted(Flip(spatial_axis=0)(img))
    rot = plotted(Rotate90(k=1)(img))
    print(f"reverse_indexing={reverse}: tensor {tuple(img.shape)}, plot equals the saved file: {same_as_file}")
    print(f"  Flip(spatial_axis=0) plots as a top-to-bottom flip of the plot: {np.array_equal(flip, np.flipud(shown))}")
    print(f"  Rotate90(k=1) plots as a counter-clockwise quarter turn of the plot: {np.array_equal(rot, np.rot90(shown, 1))}")
    # a positive affine rotate and a translate along the first spatial axis, read off the plot
    a = Affine(rotate_params=np.deg2rad(20.0), padding_mode="zeros", image_only=True)(img.float())
    y0, x0 = centroid(shown)
    y1, x1 = centroid(plotted(a))
    cy, cx = (shown.shape[0] - 1) / 2, (shown.shape[1] - 1) / 2
    ang0 = np.degrees(np.arctan2(-(y0 - cy), x0 - cx))
    ang1 = np.degrees(np.arctan2(-(y1 - cy), x1 - cx))
    print(f"  Affine rotate +20° moves the shape's centroid {ang1 - ang0:+.1f}° on the plot (negative is clockwise)")
    t = Affine(translate_params=(4.0, 0.0), padding_mode="zeros", image_only=True)(img.float())
    y2, x2 = centroid(plotted(t))
    print(f"  Affine translate (4, 0) moves the centroid ({y2 - y0:+.1f} rows, {x2 - x0:+.1f} columns) on the plot")
