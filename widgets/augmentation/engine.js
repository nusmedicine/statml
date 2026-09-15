/* ============================================================================
   Widget 62 · the transforms, as MONAI 1.6.0 computes them.

   Lifted from `_lab/augmentation-measure.mjs`, where every function was held
   to MONAI's own arrays (`_lab/augmentation-monai.py` → `augmentation-monai.json`):
   Flip and Rotate90 exactly, Affine within 2.1e-6 bilinear and exactly
   nearest, RandAffined's drawn matrices, AsDiscrete at ≥ 0.5, and every
   direction through a non-square file in both reader orders.
   `_lab/augmentation-verify.mjs` re-runs those comparisons on THIS file.

   AN IMAGE IS { w, h, c, d } with d[ch·h·w + y·w + x]: the file's orientation,
   x to the right and y down. MONAI's spatial axes are the ARRAY's, and which
   file axis is axis 0 depends on how the file was loaded — so every MONAI
   argument passes through `fileOp` once, and the pixels and the outline read
   the same restatement (5.8).
   ========================================================================= */

/* THE WIDGET'S ORDER. Kenneth's pick of 2026-09-15: cell 19's LoadImaged
   gains `reader="PILReader", reverse_indexing=False`, so the arrays are
   [C, H, W] — axis 0 is y. Cell 19 as written loads x-first ("xy"), which
   the verify still checks, because that is the notebook students ran before. */
export const ORDER = "yx";

export const make = (w, h, c = 1) => ({ w, h, c, d: new Float32Array(w * h * c) });
const copy = (im) => ({ ...im, d: im.d.slice() });

/** A mirror in the file: axis 0 reverses x (left–right), axis 1 reverses y (top–bottom). */
function mirror(im, axis) {
  const { w, h, c } = im;
  const out = make(w, h, c);
  for (let ch = 0; ch < c; ch += 1) {
    const o = ch * w * h;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        out.d[o + y * w + x] = im.d[o + (axis === 0 ? y : h - 1 - y) * w + (axis === 0 ? w - 1 - x : x)];
      }
    }
  }
  return out;
}

/** `quarters` clockwise quarter turns in the file: (x, y) goes to (h − 1 − y, x) each time. */
function turn(im, quarters) {
  let cur = im;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i += 1) {
    const { w, h, c } = cur;
    const out = make(h, w, c);
    for (let ch = 0; ch < c; ch += 1) {
      const o = ch * w * h;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) out.d[o + x * h + (h - 1 - y)] = cur.d[o + y * w + x];
      }
    }
    cur = out;
  }
  return cur;
}

/** torch's `nearbyint`, which grid_sample's nearest mode uses: halves go to the even neighbour. */
function roundHalfEven(v) {
  const f = Math.floor(v);
  const r = v - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * MONAI `Affine` with zeros padding, in the file's axes. The grid is R · T · S
 * applied to the output's centred coordinates and gives the INPUT location each
 * output pixel reads — so a scale above 1 shrinks the content and a translation
 * moves it the other way (both measured on MONAI).
 */
function warp(im, { rotate = 0, translate = [0, 0], scale = [1, 1] }, mode) {
  const { w, h, c } = im;
  const out = make(w, h, c);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const cs = Math.cos(rotate);
  const sn = Math.sin(rotate);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const px = scale[0] * (x - cx) + translate[0];
      const py = scale[1] * (y - cy) + translate[1];
      const vx = cs * px - sn * py + cx;
      const vy = sn * px + cs * py + cy;
      for (let ch = 0; ch < c; ch += 1) {
        const o = ch * w * h;
        if (mode === "nearest") {
          const ix = roundHalfEven(vx);
          const iy = roundHalfEven(vy);
          out.d[o + y * w + x] = ix >= 0 && ix < w && iy >= 0 && iy < h ? im.d[o + iy * w + ix] : 0;
        } else {
          const x0 = Math.floor(vx);
          const y0 = Math.floor(vy);
          const fx = vx - x0;
          const fy = vy - y0;
          const g = (xx, yy) => (xx >= 0 && xx < w && yy >= 0 && yy < h ? im.d[o + yy * w + xx] : 0);
          out.d[o + y * w + x] =
            (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) +
            (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
        }
      }
    }
  }
  return out;
}

/**
 * ONE MONAI SPATIAL CALL RESTATED IN THE FILE'S AXES, for a reader order.
 * `op` is { kind: "flip", axis } | { kind: "rot90", k } | { kind: "affine",
 * rotate, translate, scale } with MONAI's arguments in MONAI's axis order.
 * Under "yx" (the widget) axis 0 is y, a quarter turn is counter-clockwise, a
 * positive rotate turns the content clockwise, and translate and scale are
 * (height, width): all four measured through a 28 × 36 file on MONAI.
 */
export function fileOp(op, order = ORDER) {
  const yx = order === "yx";
  if (op.kind === "flip") return { kind: "mirror", axis: yx ? 1 - op.axis : op.axis };
  if (op.kind === "rot90") return { kind: "turn", quarters: yx ? (4 - (op.k % 4)) % 4 : op.k % 4 };
  const { rotate = 0, translate = [0, 0], scale = [1, 1] } = op;
  return yx
    ? { kind: "warp", rotate: -rotate, translate: [translate[1], translate[0]], scale: [scale[1], scale[0]] }
    : { kind: "warp", rotate, translate, scale };
}

/** A file-orientation operation on an image; `mode` matters for a warp only. */
export function applyOp(im, f, mode = "bilinear") {
  if (f.kind === "mirror") return mirror(im, f.axis);
  if (f.kind === "turn") return turn(im, f.quarters);
  return warp(im, f, mode);
}

/**
 * Where a point of the input lands under a file-orientation operation, on an
 * input of w × h — the inverse of the grid the pixels read, so an outline drawn
 * through it sits on the resampled mask to within a pixel.
 */
export function mapPoint([x, y], f, w, h) {
  if (f.kind === "mirror") return f.axis === 0 ? [w - 1 - x, y] : [x, h - 1 - y];
  if (f.kind === "turn") {
    let px = x;
    let py = y;
    let hh = h;
    let ww = w;
    for (let i = 0; i < f.quarters; i += 1) {
      [px, py] = [hh - 1 - py, px];
      [ww, hh] = [hh, ww];
    }
    return [px, py];
  }
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const vx = x - cx;
  const vy = y - cy;
  const cs = Math.cos(f.rotate);
  const sn = Math.sin(f.rotate);
  const ux = cs * vx + sn * vy;
  const uy = -sn * vx + cs * vy;
  return [(ux - f.translate[0]) / f.scale[0] + cx, (uy - f.translate[1]) / f.scale[1] + cy];
}

/** MONAI `AdjustContrast`: ((x − min) / (range + 1e-7)) ** γ · range + min, min and max over the whole image. */
export function contrast(im, gamma) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of im.d) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo;
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] = ((im.d[i] - lo) / (range + 1e-7)) ** gamma * range + lo;
  return out;
}

/** MONAI `GaussianNoise` at a given σ; RandGaussianNoised draws σ itself from U(0, std). */
export function noise(im, sigma, rng) {
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] += rng.normal(0, sigma);
  return out;
}

/** MONAI `AsDiscrete(threshold)`: 1 where the value is at least the threshold. */
export function discrete(im, threshold = 0.5) {
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] = im.d[i] >= threshold ? 1 : 0;
  return out;
}

/** MONAI `ScaleIntensity()`: min–max over the whole image to [0, 1]. */
export function scaleIntensity(im) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of im.d) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] = (im.d[i] - lo) / (hi - lo);
  return out;
}

/** Dice between two masks, each read as foreground at ≥ 0.5. */
export function dice(a, b) {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.d.length; i += 1) {
    const u = a.d[i] >= 0.5;
    const v = b.d[i] >= 0.5;
    if (u) sa += 1;
    if (v) sb += 1;
    if (u && v) inter += 1;
  }
  return sa + sb === 0 ? 1 : (2 * inter) / (sa + sb);
}
