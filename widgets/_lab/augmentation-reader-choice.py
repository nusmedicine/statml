"""LoadImaged with reverse_indexing=False and no reader named: which reader
reads a JPG, a PNG and a TIFF, what each is constructed with, and what shape
comes back. Run 2026-09-17 on Kenneth's "do i need to specify
reader="PILReader"?":

    python widgets/_lab/augmentation-reader-choice.py > widgets/_lab/augmentation-reader-choice.txt

Found: the flag alone reaches PILReader for .jpg and .png (rows first); a .tif
finds no reader with only Pillow installed unless reader="PILReader" is named.
ITK is not installed here; ITKReader's docstring makes False its width-first
default, the opposite meaning."""
import inspect, os, tempfile
import numpy as np
from PIL import Image
import monai
from monai.data import image_reader as R
from monai.transforms import LoadImaged

print("monai", monai.__version__)
try:
    import itk  # noqa
    print("itk installed:", itk.Version.GetITKVersion())
except Exception as e:
    print("itk not installed:", type(e).__name__)

print("PILReader suffixes:", inspect.getsource(R.PILReader.verify_suffix).split("suffixes")[1][:80].strip())

tmp = tempfile.mkdtemp()
H, W = 28, 36
arr = np.zeros((H, W, 3), np.uint8); arr[2:6, 3:30] = 255
paths = {}
for ext in ("jpg", "png", "tif"):
    p = os.path.join(tmp, f"t.{ext}")
    Image.fromarray(arr).save(p)
    paths[ext] = p

used = []
for cls in (R.PILReader, R.ITKReader, R.NibabelReader):
    orig = cls.read
    def rec(self, *a, _orig=orig, _name=cls.__name__, **k):
        used.append(f"{_name}(reverse_indexing={getattr(self, 'reverse_indexing', '—')})")
        return _orig(self, *a, **k)
    cls.read = rec

for label, kwargs in (("default", {}), ("reverse_indexing=False only", {"reverse_indexing": False}),
                      ("reader='PILReader', reverse_indexing=False", {"reader": "PILReader", "reverse_indexing": False})):
    print(f"\n{label}:")
    loader = LoadImaged(keys=["image"], image_only=True, **kwargs)
    print("  readers registered:", [f"{type(r).__name__}(reverse_indexing={getattr(r, 'reverse_indexing', '—')})" for r in loader._loader.readers])
    for ext, p in paths.items():
        used.clear()
        try:
            out = loader({"image": p})["image"]
            print(f"  .{ext}: read by {used[-1] if used else '?'} -> shape {tuple(out.shape)}"
                  f"  ({'rows first' if out.shape[0] == H else 'width first'})")
        except Exception as e:
            print(f"  .{ext}: raises {type(e).__name__}: {str(e).strip().splitlines()[-1][:120]}")
