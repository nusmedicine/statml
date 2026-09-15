"""The notebook's own UNet2D (PHM5005 06-3 cell 33, verbatim) instantiated in
torch, so `_lab/unet-verify.mjs` can hold widget 65's parameter counts and
stage shapes against the reference rather than against its own arithmetic.

    python widgets/_lab/unet-torch.py > widgets/_lab/unet-torch.txt

Prints, for base_ch 4 / 8 / 16 (in_channels 3, num_classes 1): the parameter
count, then every stage's output shape on a (10, 3, 64, 64) input in the
walk order the widget draws (enc1, pool1, ..., bottleneck, up4, cat4, dec4,
..., head). 64 rather than the lesson's 512 so the trace is quick; the
shapes at 512 are the same arithmetic at 8x the side.
"""
import torch
import torch.nn as nn


class DoubleConv(nn.Module):
    """(Conv3x3 -> BN -> ReLU) x 2"""
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )
    def forward(self, x):
        return self.conv(x)


class UNet2D(nn.Module):
    def __init__(self, in_channels=3, num_classes=1, base_ch=16):
        super().__init__()
        self.enc1 = DoubleConv(in_channels,       base_ch)
        self.pool1 = nn.MaxPool2d(2)
        self.enc2 = DoubleConv(base_ch,           base_ch*2)
        self.pool2 = nn.MaxPool2d(2)
        self.enc3 = DoubleConv(base_ch*2,         base_ch*4)
        self.pool3 = nn.MaxPool2d(2)
        self.enc4 = DoubleConv(base_ch*4,         base_ch*8)
        self.pool4 = nn.MaxPool2d(2)
        self.bottleneck = DoubleConv(base_ch*8,   base_ch*16)
        self.up4  = nn.ConvTranspose2d(base_ch*16, base_ch*8,  kernel_size=2, stride=2)
        self.dec4 = DoubleConv(base_ch*16,         base_ch*8)
        self.up3  = nn.ConvTranspose2d(base_ch*8,  base_ch*4,  kernel_size=2, stride=2)
        self.dec3 = DoubleConv(base_ch*8,          base_ch*4)
        self.up2  = nn.ConvTranspose2d(base_ch*4,  base_ch*2,  kernel_size=2, stride=2)
        self.dec2 = DoubleConv(base_ch*4,          base_ch*2)
        self.up1  = nn.ConvTranspose2d(base_ch*2,  base_ch,    kernel_size=2, stride=2)
        self.dec1 = DoubleConv(base_ch*2,          base_ch)
        self.head = nn.Conv2d(base_ch, num_classes, kernel_size=1)

    def forward(self, x):
        shapes = []
        x1 = self.enc1(x); shapes.append(("enc1", x1.shape))
        p = self.pool1(x1); shapes.append(("pool1", p.shape))
        x2 = self.enc2(p); shapes.append(("enc2", x2.shape))
        p = self.pool2(x2); shapes.append(("pool2", p.shape))
        x3 = self.enc3(p); shapes.append(("enc3", x3.shape))
        p = self.pool3(x3); shapes.append(("pool3", p.shape))
        x4 = self.enc4(p); shapes.append(("enc4", x4.shape))
        p = self.pool4(x4); shapes.append(("pool4", p.shape))
        xb = self.bottleneck(p); shapes.append(("bottleneck", xb.shape))
        u4 = self.up4(xb); shapes.append(("up4", u4.shape))
        c = torch.cat([u4, x4], dim=1); shapes.append(("cat4", c.shape))
        d4 = self.dec4(c); shapes.append(("dec4", d4.shape))
        u3 = self.up3(d4); shapes.append(("up3", u3.shape))
        c = torch.cat([u3, x3], dim=1); shapes.append(("cat3", c.shape))
        d3 = self.dec3(c); shapes.append(("dec3", d3.shape))
        u2 = self.up2(d3); shapes.append(("up2", u2.shape))
        c = torch.cat([u2, x2], dim=1); shapes.append(("cat2", c.shape))
        d2 = self.dec2(c); shapes.append(("dec2", d2.shape))
        u1 = self.up1(d2); shapes.append(("up1", u1.shape))
        c = torch.cat([u1, x1], dim=1); shapes.append(("cat1", c.shape))
        d1 = self.dec1(c); shapes.append(("dec1", d1.shape))
        out = self.head(d1); shapes.append(("head", out.shape))
        return out, shapes


print(f"torch {torch.__version__}")
for base in (4, 8, 16):
    model = UNet2D(in_channels=3, num_classes=1, base_ch=base).eval()
    n = sum(p.numel() for p in model.parameters())
    print(f"base {base} params {n}")
    with torch.no_grad():
        _, shapes = model(torch.zeros(10, 3, 64, 64))
    for name, s in shapes:
        print(f"base {base} {name} {list(s)}")
