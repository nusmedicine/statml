/* Planning measurement for slot 62 `augmentation` (PHM5005 06-3 cells 15, 19
 * and 27–29; 06-2 cell 1 §3). Kenneth's brief, 2026-09-15: "students have a
 * hard time visualizing these transformations". His picks: two pages,
 * Transforms · Pipeline, on a generated blood smear; the cases that fail are
 * the mask left out of `keys`, bilinear on the mask, and the Validation/Test
 * split; the engine is held to MONAI itself.
 *
 *   E   the engine against MONAI 1.6.0: `_lab/augmentation-monai.py` ran
 *       MONAI's own Flip, Rotate90, Affine (bilinear and nearest, zeros
 *       padding) and RandAffined with cell 19's arguments and dumped the
 *       arrays to `augmentation-monai.json`; every one must be reproduced
 *   M1  the probabilities cell 19's chain implies, drawn through the engine
 *   M2  the smear, and what the mask left out of `keys` costs under each
 *       spatial transform — off-centre (the design) and centred
 *   M3  how far each transform moves the picture at the lesson's values
 *   M4  bilinear against nearest on the mask at 512, before and after
 *       `AsDiscreted(threshold=0.5)`
 *   M5  contrast: what γ 0.7 and 1.5 do to each part of the smear
 *   M6  noise: σ ≤ 0.01 in grey levels, and the σ at which it shows
 *   M7  the cost of a 512 × 512 sample and of one epoch's listing
 *
 *     node widgets/_lab/augmentation-measure.mjs [--sheet out.ppm]
 *
 * FINDINGS, 2026-09-15 (node 24.18; MONAI 1.6.0 on torch 2.14 CPU for the pin).
 *
 *   E - the engine IS MONAI for everything cell 19 does. Flip (axis 0 mirrors
 *   x), Rotate90 (k = 1 clockwise in file orientation), ten deterministic
 *   Affine arrays (bilinear within 2.1e-6, nearest exact), four RandAffined
 *   draws with cell 19's arguments (image within 1.2e-6, label exact), and
 *   AsDiscrete at >= 0.5. One trap found on the way, in MONAI and not the
 *   engine: RandAffined draws its parameters twice per key, so the
 *   `rotate_params` & co. readable after a call are a draw that was NOT
 *   applied; the first comparison failed by 1.0 on all four. The applied matrix
 *   is `rand_affine_grid.get_transformation_matrix()`, which the pin now reads.
 *
 *   M1 - cell 19's chain reaches all eight orientations of the square:
 *   identity, the half turn and each axis mirror at 1 in 6, the two quarter
 *   turns and two diagonal mirrors at 1 in 12. No random line fires on 5.58%
 *   of samples, no spatial line on 9.37%, and 7.40% equal the input.
 *
 *   M2 - THE CASE THAT FAILS DEPENDS ON WHERE THE CELL IS. The smear's white
 *   cell (radius 70, 5.9% of the image) off-centre at (184, 312): the mask
 *   left out of `keys` scores Dice 0.000 under an axis-0 flip, 0.104 axis 1,
 *   0.026 / 0.000 / 0.026 for k = 1 / 2 / 3, and 0.86-0.90 for the affine at
 *   any of cell 19's extremes; over the chain with its probabilities the mean
 *   is 0.224 and 77.5% of samples fall under 0.5. The SAME cell centred: every
 *   flip and turn 0.99 (a centred round mask maps onto itself), the affine
 *   0.88-0.996, the chain's mean 0.977 and no sample under 0.5. The mistake is
 *   silent on a centred round object and ruinous on an off-centre one.
 *
 *   M3 - at cell 19's values the most visible thing RandAffined does is the
 *   zero padding, not the move: 10 deg leaves 7.3% of the image zero, a
 *   (1.1, 1.1) scale 17.2% (a border), the (8, 8) shift 3.1%, all three
 *   18.4%; the white cell's centre moves 8-16 px, 4-8 CSS px on a 256 px
 *   panel. Scale (1.1, 1.1) shrinks the mask to 82.7% of its area (1/1.21).
 *
 *   M4 - bilinear on the mask at 512 is a one-pixel ring: 560-563 values
 *   strictly between 0 and 1 (3.6-3.7% of the cell's area), and after
 *   AsDiscreted(0.5) 28-45 pixels differ from nearest (Dice 0.9985-0.9991).
 *   It is visible in a magnifier and nowhere else.
 *
 *   M5 - on the ScaleIntensity'd smear, γ 0.7 lifts the red cells 183 -> 201
 *   and the cytoplasm 189 -> 206 grey levels; γ 1.5 drops them to 159 and
 *   164; the nucleus moves 29 -> 43 / 15 and the background 246 -> 249 / 242.
 *
 *   M6 - noise: σ 0.005 (the median draw) is 1.3 grey levels, cell 19's
 *   largest σ 0.01 is 2.6; it starts to show near 0.03 (7.7) and is plain at
 *   0.05 (12.8). At cell 19's value there is nothing to see.
 *
 *   M7 - one affine sample (image bilinear + mask nearest) at 512 is 11 ms, a
 *   listing with every line firing and every intermediate kept 52-54 ms, so 24
 *   epochs of listings is 1.3 s: too slow for compute() on every change at
 *   full size. A reading built per epoch on first request (widget 60's
 *   pattern), or thumbnails at 256, is the budget.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIN = JSON.parse(fs.readFileSync(path.join(HERE, "augmentation-monai.json"), "utf8"));

let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) fails += 1;
};
const line = (msg) => console.log(`     ${msg}`);
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;

/* ---------------------------------------------------------------------------
 * The engine. An image is { w, h, c, d } with d[ch·h·w + y·w + x]: the file's
 * orientation, x to the right and y down. MONAI's spatial axis 0 is x and 1 is
 * y, because MONAI loads a 2D image x-first (the pin's reader check).
 * ------------------------------------------------------------------------- */

const make = (w, h, c = 1) => ({ w, h, c, d: new Float32Array(w * h * c) });
const copy = (im) => ({ ...im, d: im.d.slice() });

/** MONAI `Flip(spatial_axis)`: axis 0 reverses x, axis 1 reverses y. */
function flip(im, axis) {
  const { w, h, c } = im;
  const out = make(w, h, c);
  for (let ch = 0; ch < c; ch += 1) {
    const o = ch * w * h;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const sx = axis === 0 ? w - 1 - x : x;
        const sy = axis === 0 ? y : h - 1 - y;
        out.d[o + y * w + x] = im.d[o + sy * w + sx];
      }
    }
  }
  return out;
}

/** MONAI `Rotate90(k, spatial_axes=(0, 1))`: each k is a clockwise quarter turn in file orientation. */
function rot90(im, k) {
  let cur = im;
  for (let i = 0; i < ((k % 4) + 4) % 4; i += 1) {
    const { w, h, c } = cur;
    const out = make(h, w, c); // (x, y) goes to (h − 1 − y, x)
    for (let ch = 0; ch < c; ch += 1) {
      const oi = ch * w * h;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) out.d[oi + x * h + (h - 1 - y)] = cur.d[oi + y * w + x];
      }
    }
    cur = out;
  }
  return cur;
}

/** torch's `nearbyint`: halves go to the even neighbour. */
function roundHalfEven(v) {
  const f = Math.floor(v);
  const r = v - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * MONAI `Affine` with zeros padding. The grid is R · T · S applied to the
 * output's centred coordinates and gives the INPUT location each output pixel
 * reads, so a scale above 1 shrinks the content and a translation moves it the
 * other way — both measured on MONAI in the pin.
 */
function affine(im, { rotate = 0, translate = [0, 0], scale = [1, 1] }, mode = "bilinear") {
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

/** MONAI `AdjustContrast`: ((x − min) / (range + 1e-7)) ** γ · range + min, over the whole image. */
function contrast(im, gamma) {
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

/** MONAI `GaussianNoise` at a given σ (RandGaussianNoised draws σ itself from U(0, std)). */
function noise(im, sigma, rng) {
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] += rng.normal(0, sigma);
  return out;
}

/** MONAI `AsDiscrete(threshold)`: 1 where the value is at least the threshold. */
function discrete(im, t = 0.5) {
  const out = copy(im);
  for (let i = 0; i < out.d.length; i += 1) out.d[i] = im.d[i] >= t ? 1 : 0;
  return out;
}

/** 06-3 cell 19's random lines, one sample's draws. */
const LESSON = {
  flip0: 0.5, flip1: 0.5, rot90: 0.5, maxK: 3,
  affine: 0.25, rotate: (10 * Math.PI) / 180, translate: 8, scale: 0.1,
  contrast: 0.3, gamma: [0.7, 1.5],
  noise: 0.15, std: 0.01,
};

function drawSample(rng, L = LESSON) {
  return {
    flip0: rng.next() < L.flip0,
    flip1: rng.next() < L.flip1,
    rot90: rng.next() < L.rot90 ? 1 + Math.floor(rng.next() * L.maxK) : 0,
    affine: rng.next() < L.affine
      ? {
          rotate: rng.uniform(-L.rotate, L.rotate),
          translate: [rng.uniform(-L.translate, L.translate), rng.uniform(-L.translate, L.translate)],
          scale: [1 + rng.uniform(-L.scale, L.scale), 1 + rng.uniform(-L.scale, L.scale)],
        }
      : null,
    gamma: rng.next() < L.contrast ? rng.uniform(L.gamma[0], L.gamma[1]) : null,
    sigma: rng.next() < L.noise ? rng.uniform(0, L.std) : null,
  };
}

/** The spatial lines of one sample on the mask, nearest (cell 19's label mode). */
function spatial(im, s, mode) {
  let cur = im;
  if (s.flip0) cur = flip(cur, 0);
  if (s.flip1) cur = flip(cur, 1);
  if (s.rot90) cur = rot90(cur, s.rot90);
  if (s.affine) cur = affine(cur, s.affine, mode);
  return cur;
}

/* ---------------------------------------------------------------------------
 * E · the engine against MONAI
 * ------------------------------------------------------------------------- */

console.log(`\nE · the engine against MONAI ${PIN.monai} (torch ${PIN.torch})`);
{
  const X = 4;
  const Y = 3;
  const a = make(X, Y);
  for (let x = 0; x < X; x += 1) for (let y = 0; y < Y; y += 1) a.d[y * X + x] = x * Y + y;
  const f0 = flip(a, 0);
  const f1 = flip(a, 1);
  ok(f0.d[0] === a.d[X - 1] && PIN.flip_rot90.flip0_reverses_x, "flip: spatial_axis=0 mirrors x, as MONAI's pin");
  ok(f1.d[0] === a.d[(Y - 1) * X] && PIN.flip_rot90.flip1_reverses_y, "flip: spatial_axis=1 mirrors y, as MONAI's pin");
  const r = rot90(a, 1);
  // the file's top-left value must be at the rotated image's top-right
  ok(r.d[r.w - 1] === a.d[0] && PIN.flip_rot90.rot90_k1_turn === "clockwise",
    "rot90: k=1 sends top-left to top-right (clockwise), as MONAI's pin");

  const S = PIN.affine_arrays.size;
  const inp = make(S, S);
  PIN.affine_arrays.in.forEach((col, x) => col.forEach((v, y) => { inp.d[y * S + x] = v; }));
  const diff = (im, arr) => {
    let m = 0;
    arr.forEach((col, x) => col.forEach((v, y) => { m = Math.max(m, Math.abs(im.d[y * S + x] - v)); }));
    return m;
  };
  const toParams = (p) => ({
    rotate: p.rotate_params ?? 0,
    translate: p.translate_params ?? [0, 0],
    scale: p.scale_params ?? [1, 1],
  });
  for (const cs of PIN.affine_arrays.cases) {
    const m = diff(affine(inp, toParams(cs.params), cs.mode), cs.out);
    ok(m < 1e-5, `affine ${cs.mode.padEnd(8)} ${JSON.stringify(cs.params)}: max |engine − MONAI| ${m.toExponential(2)}`);
  }
  const disc = make(S, S);
  PIN.randaffined.disc.forEach((col, x) => col.forEach((v, y) => { disc.d[y * S + x] = v; }));
  for (const cs of PIN.randaffined.cases) {
    const p = { rotate: cs.rotate[0], translate: cs.translate, scale: cs.scale };
    const mi = diff(affine(inp, p, "bilinear"), cs.image);
    const ml = diff(affine(disc, p, "nearest"), cs.label);
    ok(mi < 1e-5 && ml === 0,
      `RandAffined draw (${((cs.rotate[0] * 180) / Math.PI).toFixed(2)}°, [${cs.translate.map((v) => v.toFixed(2))}], ` +
      `[${cs.scale.map((v) => v.toFixed(3))}]): image ${mi.toExponential(2)}, label ${ml}`);
  }
  const thr = discrete({ w: 5, h: 1, c: 1, d: Float32Array.from([0.49, 0.5, 0.51, 1, 255]) }, 0.5);
  ok(Array.from(thr.d).join() === PIN.threshold.join(), `threshold: AsDiscrete(0.5) gives [${Array.from(thr.d)}], as MONAI's pin`);
}

/* ---------------------------------------------------------------------------
 * M1 · probabilities
 * ------------------------------------------------------------------------- */

console.log("\nM1 · the probabilities in cell 19's chain (200,000 samples through the engine)");
{
  const T = 200000;
  const rng = makeRng(62);
  const probe = make(3, 3);
  probe.d.forEach((_, i) => { probe.d[i] = i; });
  const names = new Map();
  const label = (im) => Array.from(im.d).join("");
  names.set(label(probe), "identity");
  names.set(label(rot90(probe, 1)), "quarter turn clockwise");
  names.set(label(rot90(probe, 2)), "half turn");
  names.set(label(rot90(probe, 3)), "quarter turn counter-clockwise");
  names.set(label(flip(probe, 0)), "mirror left-right (axis 0)");
  names.set(label(flip(probe, 1)), "mirror top-bottom (axis 1)");
  names.set(label(rot90(flip(probe, 0), 1)), "mirror on a diagonal");
  names.set(label(rot90(flip(probe, 1), 1)), "mirror on the other diagonal");
  const tally = new Map();
  let none = 0;
  let spatialNone = 0;
  let identical = 0;
  for (let t = 0; t < T; t += 1) {
    const s = drawSample(rng);
    const key = label(spatial(probe, { ...s, affine: null }));
    tally.set(key, (tally.get(key) || 0) + 1);
    const fired = s.flip0 || s.flip1 || s.rot90 || s.affine;
    if (!fired && s.gamma === null && s.sigma === null) none += 1;
    if (!fired) spatialNone += 1;
    if (names.get(key) === "identity" && !s.affine && s.gamma === null && s.sigma === null) identical += 1;
  }
  ok(tally.size === 8, `all eight orientations of the square occur: ${tally.size}`);
  for (const [k, n] of [...tally].sort((p, q) => q[1] - p[1])) line(`${names.get(k).padEnd(32)} ${pct(n / T)}  (1 in ${(T / n).toFixed(1)})`);
  const exact = 0.5 * 0.5 * 0.5 * 0.75 * 0.7 * 0.85;
  ok(Math.abs(none / T - exact) < 0.003, `no random line fires: ${pct(none / T, 2)} (exact ${pct(exact, 2)})`);
  line(`no spatial line fires: ${pct(spatialNone / T, 2)} (exact ${pct(0.125 * 0.75, 2)}); the sample equals the input: ${pct(identical / T, 2)}`);
}

/* ---------------------------------------------------------------------------
 * The smear. 512 × 512, three channels in [0, 1], as `ScaleIntensityd` leaves
 * a stained blood film: red cells with central pallor, one white cell with a
 * three-lobed nucleus and granules. The mask is the white cell, as KRD-WBC's
 * masks mark the white blood cell. Channel values are data, like widget 65's
 * image colours. Fixed by its own seed: the draws vary, the smear does not.
 * ------------------------------------------------------------------------- */

const N = 512;
const BG = [0.95, 0.91, 0.92];
const RBC_RIM = [0.87, 0.56, 0.61];
const RBC_PALLOR = [0.94, 0.79, 0.81];
const CYTO = [0.80, 0.72, 0.86];
const GRANULE = [0.64, 0.50, 0.73];
const NUCLEUS = [0.33, 0.17, 0.47];

const cover = (d, r) => Math.max(0, Math.min(1, r - d + 0.5));
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};

function smear(wbc) {
  const rng = makeRng(5005);
  const rbcs = [];
  for (let tries = 0; tries < 4000 && rbcs.length < 15; tries += 1) {
    const r = 34 + 6 * rng.next();
    const x = -24 + (N + 48) * rng.next();
    const y = -24 + (N + 48) * rng.next();
    if (Math.hypot(x - wbc.x, y - wbc.y) < wbc.r + r - 6) continue;
    if (rbcs.some((b) => Math.hypot(x - b.x, y - b.y) < (r + b.r) * 0.92)) continue;
    rbcs.push({ x, y, r });
  }
  const lobes = [[-26, -8, 21], [4, -28, 19], [24, 6, 20]].map(([dx, dy, r]) => ({ x: wbc.x + dx, y: wbc.y + dy, r }));
  const bridges = [[0, 1, 8], [1, 2, 7]];
  const granules = [];
  for (let tries = 0; tries < 3000 && granules.length < 46; tries += 1) {
    const ang = 2 * Math.PI * rng.next();
    const rad = (wbc.r - 6) * Math.sqrt(rng.next());
    const x = wbc.x + rad * Math.cos(ang);
    const y = wbc.y + rad * Math.sin(ang);
    if (lobes.some((l) => Math.hypot(x - l.x, y - l.y) < l.r + 4)) continue;
    granules.push({ x, y, r: 2.2 });
  }
  const image = make(N, N, 3);
  const mask = make(N, N, 1);
  const parts = new Int8Array(N * N); // 0 background, 1 red cell, 2 cytoplasm, 3 nucleus
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      let col = BG.slice();
      let part = 0;
      for (const b of rbcs) {
        const d = Math.hypot(px - b.x, py - b.y);
        const a = cover(d, b.r);
        if (a <= 0) continue;
        const t = Math.max(0, Math.min(1, (d / b.r - 0.35) / 0.5));
        const rbc = RBC_PALLOR.map((v, i) => v + (RBC_RIM[i] - v) * t);
        col = col.map((v, i) => v + (rbc[i] - v) * a);
        if (a >= 0.5) part = 1;
      }
      const dw = Math.hypot(px - wbc.x, py - wbc.y);
      const aw = cover(dw, wbc.r);
      if (aw > 0) {
        col = col.map((v, i) => v + (CYTO[i] - v) * aw);
        for (const g of granules) {
          const ag = cover(Math.hypot(px - g.x, py - g.y), g.r);
          if (ag > 0) col = col.map((v, i) => v + (GRANULE[i] - v) * ag);
        }
        let an = 0;
        for (const l of lobes) an = Math.max(an, cover(Math.hypot(px - l.x, py - l.y), l.r));
        for (const [i, j, hw] of bridges) {
          an = Math.max(an, cover(segDist(px, py, lobes[i].x, lobes[i].y, lobes[j].x, lobes[j].y), hw));
        }
        if (an > 0) col = col.map((v, i) => v + (NUCLEUS[i] - v) * an);
        if (aw >= 0.5) part = an >= 0.5 ? 3 : 2;
      }
      for (let ch = 0; ch < 3; ch += 1) image.d[ch * N * N + y * N + x] = col[ch];
      mask.d[y * N + x] = dw <= wbc.r ? 1 : 0;
      parts[y * N + x] = part;
    }
  }
  return { image: scaleIntensity(image), mask, parts, rbcs, lobes, granules: granules.length };
}

/** MONAI `ScaleIntensity()`: min-max over the whole image to [0, 1] — cell 19's fixed line before any random one. */
function scaleIntensity(im) {
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

const dice = (a, b) => {
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
};
const centroid = (m) => {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < m.h; y += 1) for (let x = 0; x < m.w; x += 1) if (m.d[y * m.w + x] >= 0.5) { sx += x; sy += y; n += 1; }
  return [sx / n, sy / n, n];
};

/* ---------------------------------------------------------------------------
 * M2 · the smear, and the mask left out of `keys`
 * ------------------------------------------------------------------------- */

console.log("\nM2 · the smear, and what leaving the mask out of `keys` costs (Dice of the stale mask against the moved cell)");
const OFF = { x: 184, y: 312, r: 70 };
const CENTRE = { x: 255.5, y: 255.5, r: 70 };
let SM = null;
for (const [name, wbc] of [["off-centre (the design)", OFF], ["centred", CENTRE]]) {
  const t0 = performance.now();
  const s = smear(wbc);
  const ms = performance.now() - t0;
  if (!SM) SM = s;
  const [cx, cy, area] = centroid(s.mask);
  line(`${name}: white cell at (${cx.toFixed(1)}, ${cy.toFixed(1)}), ${area} px = ${pct(area / (N * N))} of the image; ` +
    `${s.rbcs.length} red cells, ${s.granules} granules; generated in ${ms.toFixed(0)} ms`);
  const cases = [
    ["RandFlipd axis 0", flip(s.mask, 0)],
    ["RandFlipd axis 1", flip(s.mask, 1)],
    ["RandRotate90d k=1", rot90(s.mask, 1)],
    ["RandRotate90d k=2", rot90(s.mask, 2)],
    ["RandRotate90d k=3", rot90(s.mask, 3)],
    ["RandAffined 10°", affine(s.mask, { rotate: LESSON.rotate }, "nearest")],
    ["RandAffined shift (8, 8)", affine(s.mask, { translate: [8, 8] }, "nearest")],
    ["RandAffined scale (1.1, 1.1)", affine(s.mask, { scale: [1.1, 1.1] }, "nearest")],
    ["RandAffined scale (0.9, 0.9)", affine(s.mask, { scale: [0.9, 0.9] }, "nearest")],
    ["RandAffined all three at once", affine(s.mask, { rotate: LESSON.rotate, translate: [8, 8], scale: [1.1, 1.1] }, "nearest")],
  ];
  for (const [label, moved] of cases) line(`  ${label.padEnd(30)} Dice ${dice(s.mask, moved).toFixed(3)}`);
  const rng = makeRng(7);
  let sum = 0;
  let below = 0;
  const T = 400;
  for (let t = 0; t < T; t += 1) {
    const d = dice(s.mask, spatial(s.mask, drawSample(rng), "nearest"));
    sum += d;
    if (d < 0.5) below += 1;
  }
  line(`  cell 19's spatial lines with their probabilities, ${T} samples: mean Dice ${(sum / T).toFixed(3)}, ${pct(below / T)} below 0.5`);
  if (name.startsWith("off")) {
    ok(dice(s.mask, flip(s.mask, 0)) < 0.2, "off-centre: a flip on axis 0 alone leaves the stale mask under 0.2 Dice");
  }
}

/* ---------------------------------------------------------------------------
 * M3 · how far each transform moves the picture at the lesson's values
 * ------------------------------------------------------------------------- */

console.log("\nM3 · the affine at cell 19's extremes, on the 512 px image (panel scale 0.5 CSS px a pixel)");
{
  const ones = make(N, N, 1);
  ones.d.fill(1);
  const zeros = (p) => {
    const o = affine(ones, p, "bilinear");
    let z = 0;
    for (const v of o.d) if (v < 0.5) z += 1;
    return z / (N * N);
  };
  const [cx0, cy0] = centroid(SM.mask);
  const shift = (p) => {
    const [cx, cy] = centroid(affine(SM.mask, p, "nearest"));
    return Math.hypot(cx - cx0, cy - cy0);
  };
  for (const [label, p] of [
    ["rotate 10°", { rotate: LESSON.rotate }],
    ["shift (8, 8) px", { translate: [8, 8] }],
    ["scale (1.1, 1.1): content 0.91 as wide", { scale: [1.1, 1.1] }],
    ["scale (0.9, 0.9): content 1.11 as wide", { scale: [0.9, 0.9] }],
    ["scale (1.1, 0.9): the stretch", { scale: [1.1, 0.9] }],
    ["all at 10°, (8, 8), (1.1, 1.1)", { rotate: LESSON.rotate, translate: [8, 8], scale: [1.1, 1.1] }],
  ]) {
    const s = shift(p);
    line(`${label.padEnd(40)} zeros ${pct(zeros(p)).padStart(6)} of the image; the white cell's centre moves ${s.toFixed(1)} px (${(s / 2).toFixed(1)} CSS px)`);
  }
  const [, , a0] = centroid(SM.mask);
  const [, , a1] = centroid(affine(SM.mask, { scale: [1.1, 1.1] }, "nearest"));
  line(`scale (1.1, 1.1) makes the mask ${a1} px against ${a0} (${pct(a1 / a0 - 1)}); 1/1.1² = ${pct(1 / 1.21 - 1)}`);
  ok(a1 < a0, "a drawn scale above 1 makes the white cell smaller");
}

/* ---------------------------------------------------------------------------
 * M4 · bilinear against nearest on the mask
 * ------------------------------------------------------------------------- */

console.log("\nM4 · the mask resampled bilinear against nearest at 512, before and after AsDiscreted(0.5)");
{
  const [, , area] = centroid(SM.mask);
  for (const p of [
    { rotate: (7 * Math.PI) / 180, translate: [3, -5], scale: [0.95, 1.06] },
    { rotate: LESSON.rotate, translate: [8, 8], scale: [1.1, 0.9] },
  ]) {
    const bil = affine(SM.mask, p, "bilinear");
    const near = affine(SM.mask, p, "nearest");
    let between = 0;
    for (const v of bil.d) if (v > 1e-6 && v < 1 - 1e-6) between += 1;
    const disc = discrete(bil, 0.5);
    let differ = 0;
    for (let i = 0; i < disc.d.length; i += 1) if (disc.d[i] !== near.d[i]) differ += 1;
    line(`${JSON.stringify({ deg: +((p.rotate * 180) / Math.PI).toFixed(1), t: p.translate, s: p.scale })}: ` +
      `${between} mask pixels strictly between 0 and 1 (${pct(between / area)} of the cell's area, a ring about one pixel wide); ` +
      `after AsDiscreted(0.5) ${differ} pixels differ from nearest, Dice ${dice(disc, near).toFixed(4)}`);
  }
}

/* ---------------------------------------------------------------------------
 * M5 · contrast
 * ------------------------------------------------------------------------- */

console.log("\nM5 · RandAdjustContrastd at γ 0.7 and 1.5: mean grey level (luminance, 0–255) of each part of the smear");
{
  const lum = (im, i) => 0.299 * im.d[i] + 0.587 * im.d[N * N + i] + 0.114 * im.d[2 * N * N + i];
  const means = (im) => {
    const s = [0, 0, 0, 0];
    const n = [0, 0, 0, 0];
    for (let i = 0; i < N * N; i += 1) { s[SM.parts[i]] += lum(im, i); n[SM.parts[i]] += 1; }
    return s.map((v, k) => (255 * v) / n[k]);
  };
  const names = ["background", "red cell", "cytoplasm", "nucleus"];
  for (const g of [0.7, 1, 1.5]) {
    const m = means(g === 1 ? SM.image : contrast(SM.image, g));
    line(`γ ${g.toFixed(1)}: ${names.map((nm, k) => `${nm} ${m[k].toFixed(0)}`).join(", ")}; cytoplasm − nucleus ${(m[2] - m[3]).toFixed(0)}`);
  }
}

/* ---------------------------------------------------------------------------
 * M6 · noise
 * ------------------------------------------------------------------------- */

console.log("\nM6 · RandGaussianNoised: the noise's standard deviation in grey levels (of 255)");
{
  for (const sigma of [0.005, 0.01, 0.03, 0.05, 0.1]) {
    const rng = makeRng(11);
    const o = noise(SM.image, sigma, rng);
    let ss = 0;
    for (let i = 0; i < o.d.length; i += 1) ss += (o.d[i] - SM.image.d[i]) ** 2;
    const rms = 255 * Math.sqrt(ss / o.d.length);
    line(`σ ${sigma.toFixed(3)}${sigma === 0.005 ? " (the median draw of U(0, 0.01))" : sigma === 0.01 ? " (cell 19's largest)" : ""}: ${rms.toFixed(1)} grey levels`);
  }
}

/* ---------------------------------------------------------------------------
 * M7 · cost
 * ------------------------------------------------------------------------- */

console.log("\nM7 · cost in node (median of 7): one 512 × 512 sample, and one listing with every intermediate kept");
{
  const med = (fn) => {
    const ts = [];
    for (let i = 0; i < 7; i += 1) { const t = performance.now(); fn(); ts.push(performance.now() - t); }
    return ts.sort((p, q) => p - q)[3];
  };
  const P = { rotate: 0.12, translate: [3, -5], scale: [0.95, 1.06] };
  line(`flip, image + mask:            ${med(() => { flip(SM.image, 0); flip(SM.mask, 0); }).toFixed(1)} ms`);
  line(`rot90 k=1, image + mask:       ${med(() => { rot90(SM.image, 1); rot90(SM.mask, 1); }).toFixed(1)} ms`);
  line(`affine, image bilinear + mask nearest: ${med(() => { affine(SM.image, P, "bilinear"); affine(SM.mask, P, "nearest"); }).toFixed(1)} ms`);
  line(`contrast, image:               ${med(() => contrast(SM.image, 1.2)).toFixed(1)} ms`);
  const rng = makeRng(3);
  line(`noise, image:                  ${med(() => noise(SM.image, 0.01, rng)).toFixed(1)} ms`);
  const listing = () => {
    const s = { flip0: true, flip1: true, rot90: 2, affine: P, gamma: 1.2, sigma: 0.008 };
    let im = SM.image;
    let m = SM.mask;
    const kept = [];
    im = flip(im, 0); m = flip(m, 0); kept.push([im, m]);
    im = flip(im, 1); m = flip(m, 1); kept.push([im, m]);
    im = rot90(im, s.rot90); m = rot90(m, s.rot90); kept.push([im, m]);
    im = affine(im, s.affine, "bilinear"); m = affine(m, s.affine, "nearest"); kept.push([im, m]);
    im = contrast(im, s.gamma); kept.push([im, m]);
    im = noise(im, s.sigma, rng); kept.push([im, m]);
    m = discrete(m, 0.5); kept.push([im, m]);
    return kept;
  };
  const tl = med(listing);
  line(`one listing, every line firing: ${tl.toFixed(1)} ms; 24 epochs ${((24 * tl) / 1000).toFixed(2)} s`);
}

/* ---------------------------------------------------------------------------
 * --sheet <file.ppm>: a contact sheet for judging the smear by eye (screenshots
 * for judgement, 5.4). Eight panels at half size, the mask's edge in green:
 * the smear · its mask · RandFlipd axis 0 · RandRotate90d k=1 · RandAffined at
 * 10°, (8, 8), (1.1, 0.9) · contrast γ 1.5 · noise σ 0.05 · the flip with the
 * mask left out of keys. Not a figure of record; the mock is.
 * ------------------------------------------------------------------------- */

const sheetAt = process.argv.indexOf("--sheet");
if (sheetAt > 0) {
  const P = N / 2;
  const cols = 4;
  const rows = 2;
  const gap = 8;
  const W = cols * P + (cols + 1) * gap;
  const H = rows * P + (rows + 1) * gap;
  const px = new Uint8Array(W * H * 3).fill(255);
  const edge = (m, x, y) => {
    if (m.d[y * N + x] < 0.5) return false;
    return (x > 0 && m.d[y * N + x - 1] < 0.5) || (x < N - 1 && m.d[y * N + x + 1] < 0.5) ||
      (y > 0 && m.d[(y - 1) * N + x] < 0.5) || (y < N - 1 && m.d[(y + 1) * N + x] < 0.5);
  };
  const panel = (k, im, m) => {
    const ox = gap + (k % cols) * (P + gap);
    const oy = gap + Math.floor(k / cols) * (P + gap);
    for (let y = 0; y < P; y += 1) {
      for (let x = 0; x < P; x += 1) {
        const o = ((oy + y) * W + ox + x) * 3;
        let lit = false;
        for (let ch = 0; ch < 3; ch += 1) {
          let s = 0;
          for (let dy = 0; dy < 2; dy += 1) {
            for (let dx = 0; dx < 2; dx += 1) {
              const i = (y * 2 + dy) * N + x * 2 + dx;
              s += im.c === 3 ? im.d[ch * N * N + i] : im.d[i];
              if (m && ch === 0 && edge(m, x * 2 + dx, y * 2 + dy)) lit = true;
            }
          }
          px[o + ch] = Math.max(0, Math.min(255, Math.round((255 * s) / 4)));
        }
        if (lit) { px[o] = 20; px[o + 1] = 200; px[o + 2] = 60; }
      }
    }
  };
  const aff = { rotate: LESSON.rotate, translate: [8, 8], scale: [1.1, 0.9] };
  panel(0, SM.image, SM.mask);
  panel(1, SM.mask, null);
  panel(2, flip(SM.image, 0), flip(SM.mask, 0));
  panel(3, rot90(SM.image, 1), rot90(SM.mask, 1));
  panel(4, affine(SM.image, aff, "bilinear"), affine(SM.mask, aff, "nearest"));
  panel(5, contrast(SM.image, 1.5), SM.mask);
  panel(6, noise(SM.image, 0.05, makeRng(4)), SM.mask);
  panel(7, flip(SM.image, 0), SM.mask);
  const file = process.argv[sheetAt + 1];
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), Buffer.from(px)]));
  console.log(`wrote ${file} (${W} × ${H})`);
}

console.log(`\n${fails === 0 ? "all checks pass" : `${fails} FAILED`}`);
process.exitCode = fails === 0 ? 0 : 1;
