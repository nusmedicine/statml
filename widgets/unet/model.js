/* ============================================================================
   Widget 65 · model.js — the arithmetic and the geometry of both pages, with
   no colour, no string a reader sees and no pixel painted (5.8): `main.js`
   draws from what this returns, and `_lab/unet-verify.mjs` measures it.

   THE U-NET PAGE computes the stage list of PHM5005 06-3 cell 33's `UNet2D`
   in the order the reader walks it — enc1 · pool1 · … · bottleneck · up4 ·
   concat · dec4 · … · head — each with its shape, and the parameter count
   cell 33's modules add up to (held against torch in `_lab/unet-torch.txt`).
   THE DICE PAGE computes a disc at cell 6's own size bins, a prediction from
   the reader's list moved by the reader's drag, and the four numbers cell 38
   names; and cell 6's split — 600 cases binned by mask fraction, a 60-case
   test set drawn at random or stratified.
   ========================================================================= */

import { makeRng } from "../core/index.js";

export const PAD = 14;
export const STAGE_REF = 550;

/* --- the U ---------------------------------------------------------------- */

export const BATCH = 10;          // cell 37's trace input: a batch of 10
export const IN_CH = 3;           // three channels, the lesson's images
export const NUM_CLASSES = 1;     // binary: one logit a pixel
export const DEPTHS = ["2", "3", "4"];
export const BASES = ["4", "8", "16"];
export const INPUTS = ["16", "64", "128", "512"];

/**
 * The stages in walk order. `kind` is what the drawing does with it; `level`
 * is the row (1 at the input's size, depth + 1 the bottleneck); `C` and `H`
 * are the OUTPUT's channels and side.
 */
export function stagesFor(depth, base, input) {
  const st = [];
  let H = input;
  let C = IN_CH;
  const enc = [];
  for (let i = 1; i <= depth; i += 1) {
    C = base * 2 ** (i - 1);
    st.push({ kind: "enc", name: `enc${i}`, level: i, C, H, op: "DoubleConv" });
    enc.push({ C, H });
    H = Math.max(1, H >> 1);
    st.push({ kind: "pool", name: `pool${i}`, level: i, C, H, op: "MaxPool2d(2)" });
  }
  C = base * 2 ** depth;
  st.push({ kind: "bottleneck", name: "bottleneck", level: depth + 1, C, H, op: "DoubleConv" });
  for (let i = depth; i >= 1; i -= 1) {
    const e = enc[i - 1];
    st.push({ kind: "up", name: `up${i}`, level: i, C: e.C, H: e.H, op: "ConvTranspose2d(2, 2)" });
    st.push({ kind: "cat", name: `cat${i}`, level: i, C: 2 * e.C, H: e.H, op: "torch.cat(dim=1)" });
    st.push({ kind: "dec", name: `dec${i}`, level: i, C: e.C, H: e.H, op: "DoubleConv" });
  }
  st.push({ kind: "head", name: "head", level: 1, C: NUM_CLASSES, H: input, op: "Conv2d(1 × 1)" });
  return st;
}
export const shapeOf = (s) => [BATCH, s.C, s.H, s.H];

/** cell 33's parameters: DoubleConv is two bias-free 3 × 3 convs with a
    BatchNorm each; the transposed convolution and the head carry a bias */
export function paramCount(depth, base) {
  const dc = (i, o) => 9 * i * o + 2 * o + 9 * o * o + 2 * o;
  let n = 0;
  let cin = IN_CH;
  for (let i = 1; i <= depth; i += 1) {
    const c = base * 2 ** (i - 1);
    n += dc(cin, c);
    cin = c;
  }
  const cb = base * 2 ** depth;
  n += dc(cin, cb);
  for (let i = depth; i >= 1; i -= 1) {
    const c = base * 2 ** (i - 1);
    const above = c * 2;
    n += 4 * above * c + c;        // ConvTranspose2d(above → c, 2, 2)
    n += dc(2 * c, c);             // DoubleConv on the concatenation
  }
  n += base * NUM_CLASSES + NUM_CLASSES;
  return n;
}

export const readU = (p) => ({
  depth: Number(p.depth),
  base: Number(p.base),
  input: Number(p.input),
});
export function computeU(params) {
  const { depth, base, input } = readU(params);
  const stages = stagesFor(depth, base, input);
  return { page: "unet", depth, base, input, stages, params: paramCount(depth, base), total: stages.length };
}

/* --- the U's geometry ------------------------------------------------------- *
 * Kenneth's figure's rule: a slab's height follows H × W and its width follows
 * C. The bottleneck is `BOTTLE_W` wide and enc1 `LEVEL_H` tall, and every
 * other slab is in proportion, with floors so a 1 × 1 map and a 4-channel
 * slab stay visible. The rows are the levels; the encoder's slabs step in
 * down the left and the decoder's step out up the right, so the picture is a
 * U at any depth.                                                              */
export const LEVEL_H = 150;
export const ROW_GAP = 26;
export const BOTTLE_W = 84;
export const SLAB_MIN = 6;
export const ROW_MIN = 10;
export const U_TOP = 62;          // under the caption and its note
export const CAPTION_Y = 24;
export const NOTE_Y = 40;

export function uLayout(w, state) {
  const { depth, base, input, stages } = state;
  const cw = BOTTLE_W / (base * 2 ** depth);
  const levelH = (H) => Math.max(ROW_MIN, LEVEL_H * H / input);
  const rows = [];
  let y = U_TOP;
  for (let l = 1; l <= depth + 1; l += 1) {
    const H = Math.max(1, input >> (l - 1));
    rows.push({ y, h: levelH(H), H });
    y += levelH(H) + ROW_GAP;
  }
  const slabW = (C) => Math.max(SLAB_MIN, C * cw);
  const boxes = {};
  const cx = w / 2;
  for (const s of stages) {
    const row = rows[s.level - 1];
    const sw = slabW(s.C);
    const decX = w - PAD - 52 - (depth - s.level) * 12 - slabW(s.C);
    let x = null;
    if (s.kind === "enc") x = PAD + 44 + (depth - s.level) * 12;
    else if (s.kind === "bottleneck") x = cx - sw / 2;
    else if (s.kind === "dec") x = decX;
    else if (s.kind === "cat") x = decX - 8 - sw;
    else if (s.kind === "up") x = decX - 8 - slabW(2 * s.C) + slabW(s.C);
    else if (s.kind === "head") x = w - PAD - 24;
    if (x != null) boxes[s.name] = { x, y: row.y, w: sw, h: row.h };
  }
  return { rows, boxes, slabW, height: y - ROW_GAP + 34 };
}
export const uHeight = (w, params) => uLayout(w, computeU(params)).height;

/* --- Dice ------------------------------------------------------------------- */

export const G = 64;                       // the mask's side, cell 6's fractions read on it
/** a disc's radius so that its area is the bin's fraction of the image */
export const SIZES = {
  small: { r: 3.75, share: "1 %" },
  medium: { r: 8.1, share: "5 %" },
  large: { r: 16.2, share: "20 %" },
};
export const SIZE_KEYS = Object.keys(SIZES);
export const CENTRE = [30.5, 33.5];
/** "off the object": moved by its own diameter and one pixel, so no pixel
    overlaps at any size; the large object's copy runs off the image's edge
    and the count says so */
export const offPx = (size) => Math.ceil(2 * SIZES[size].r) + 1;
export const SHIFT_MAX = 24;

export const disc = (cx, cy, r) => {
  const m = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) m[y * G + x] = 1;
    }
  }
  return m;
};
export const shift = (m, dx, dy) => {
  const o = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sx < G && sy >= 0 && sy < G) o[y * G + x] = m[sy * G + sx];
    }
  }
  return o;
};
/** dilate (grow) or erode by one pixel, an 8-neighbourhood */
export const morph = (m, grow) => {
  const o = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      let any = false;
      let all = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          const v = xx >= 0 && xx < G && yy >= 0 && yy < G ? m[yy * G + xx] : 0;
          if (v) any = true; else all = false;
        }
      }
      o[y * G + x] = grow ? (any ? 1 : 0) : (all ? 1 : 0);
    }
  }
  return o;
};
export const randomSame = (m, rng) => {
  const n = m.reduce((a, v) => a + v, 0);
  const o = new Uint8Array(G * G);
  const idx = Array.from({ length: G * G }, (_, i) => i);
  rng.shuffle(idx);
  for (let i = 0; i < n; i += 1) o[idx[i]] = 1;
  return o;
};
/** the reader's list; each is a failure the planning measurement named */
export const PREDS = [
  { key: "empty", make: () => new Uint8Array(G * G) },
  { key: "shift", make: (m) => shift(m, 1, 0) },
  { key: "off", make: (m, rng, size) => shift(m, offPx(size), 0) },
  { key: "dilate", make: (m) => morph(m, true) },
  { key: "erode", make: (m) => morph(m, false) },
  { key: "random", make: (m, rng) => randomSame(m, rng) },
];
export const PRED_KEYS = PREDS.map((p) => p.key);

export function metrics(a, b) {
  let A = 0;
  let B = 0;
  let AB = 0;
  let neither = 0;
  for (let i = 0; i < G * G; i += 1) {
    A += a[i];
    B += b[i];
    AB += a[i] & b[i];
    if (!a[i] && !b[i]) neither += 1;
  }
  return {
    A, B, AB, neither,
    acc: (AB + neither) / (G * G),
    dice: A + B ? (2 * AB) / (A + B) : 0,
    iou: A + B - AB ? AB / (A + B - AB) : 0,
    prec: B ? AB / B : 0,
    rec: A ? AB / A : 0,
  };
}

/* --- the split -------------------------------------------------------------- */

export const N_CASES = 600;
export const N_TEST = 60;
export const BINS = 4;                     // normal · small · medium · large
export const CUTS = [0.01, 0.05];
export const binOf = (f) => (f === 0 ? 0 : f < CUTS[0] ? 1 : f < CUTS[1] ? 2 : 3);
/** 600 cases: 15 % normal, the rest log-normal about 3 %, clipped to 0.1–30 %.
    The spread puts about 20 cases under 1 % — the planning measurement's
    83 · 20 · 403 · 94 — so a random 60-case test set is empty of them about
    one shuffle in eight. */
export const LOG_SD = 0.62;
export function makeCases(rng) {
  const cases = [];
  for (let i = 0; i < N_CASES; i += 1) {
    if (rng.next() < 0.15) { cases.push({ f: 0, bin: 0 }); continue; }
    const f = Math.max(0.001, Math.min(0.30, Math.exp(Math.log(0.03) + LOG_SD * rng.normal())));
    cases.push({ f, bin: binOf(f) });
  }
  return cases;
}
export function randomTest(cases, rng) {
  const idx = cases.map((_, i) => i);
  rng.shuffle(idx);
  return idx.slice(0, N_TEST).map((i) => cases[i]);
}
export function stratifiedTest(cases, rng) {
  const out = [];
  for (let b = 0; b < BINS; b += 1) {
    const of = cases.filter((c) => c.bin === b);
    const idx = of.map((_, i) => i);
    rng.shuffle(idx);
    const n = Math.round(of.length * (N_TEST / N_CASES));
    for (let i = 0; i < n; i += 1) out.push(of[idx[i]]);
  }
  return out;
}
export const binCounts = (t) => {
  const c = new Array(BINS).fill(0);
  for (const k of t) c[k.bin] += 1;
  return c;
};
/** the histogram of the non-normal fractions on a log axis, `HIST_BINS` wide */
export const HIST_BINS = 30;
export const HIST_LO = 0.001;
export const HIST_HI = 0.3;
export const logPos = (f) => (Math.log10(f) - Math.log10(HIST_LO)) / (Math.log10(HIST_HI) - Math.log10(HIST_LO));
export function histogram(cases) {
  const bins = new Array(HIST_BINS).fill(0);
  let normals = 0;
  for (const c of cases) {
    if (c.bin === 0) { normals += 1; continue; }
    bins[Math.min(HIST_BINS - 1, Math.floor(HIST_BINS * logPos(c.f)))] += 1;
  }
  return { bins, normals };
}

export const readDice = (p) => ({
  size: p.size,
  pred: p.pred,
  dx: Number(p.dx),
  dy: Number(p.dy),
  split: p.split,
  seed: Number(p.seed),
});
export function computeDice(params, rng) {
  const { size, pred, dx, dy, split, seed } = readDice(params);
  const truth = disc(CENTRE[0], CENTRE[1], SIZES[size].r);
  const P = PREDS.find((p) => p.key === pred) ?? PREDS[0];
  const prediction = shift(P.make(truth, rng, size), dx, dy);
  const m = metrics(truth, prediction);
  /* the split, on its own generator so the prediction's draw and the
     shuffle are each a function of the seed alone */
  const cases = makeCases(makeRng(seed * 7919 + 1));
  const test = split === "strat" ? stratifiedTest(cases, makeRng(seed * 7919 + 2)) : randomTest(cases, makeRng(seed * 7919 + 2));
  const counts = binCounts(test);
  return {
    page: "dice", size, pred, dx, dy, split, truth, prediction, m,
    cases, test, counts, empty: counts.indexOf(0), hist: histogram(cases), total: 3,
  };
}

/* --- Dice's geometry --------------------------------------------------------- */

export const PANEL_MAX = 150;
export const PANEL_GAP_MIN = 24;
export const TILE_W = 100;
export const TILE_H = 46;
export const TILE_GAP = 12;
export const LINE = 14;
export const BAND_H = 184;

export function diceLayout(w) {
  const usable = w - 2 * PAD;
  const panel = Math.min(PANEL_MAX, Math.floor((usable - 2 * PANEL_GAP_MIN) / 3));
  const gap = (usable - 3 * panel) / 2;
  const panels = [0, 1, 2].map((k) => ({ x: PAD + k * (panel + gap), y: 52, w: panel, h: panel }));
  const tilesY = 52 + panel + 30;
  const tiles = [0, 1, 2].map((k) => ({ x: PAD + k * (TILE_W + TILE_GAP), y: tilesY, w: TILE_W, h: TILE_H }));
  const numbers = { x: PAD + 3 * (TILE_W + TILE_GAP) + 8, y: tilesY + 12 };
  /* the formulas are the card's, so the band follows the tiles directly; its
     caption and note take two lines, and the cut-off labels above the
     histogram clear the note */
  const bandY = tilesY + TILE_H + 24;
  const band = {
    y: bandY,
    captionY: bandY + 14,
    noteY: bandY + 30,
    histX0: PAD + 60,
    histX1: w - PAD,
    histBase: bandY + 118,
    histH: 60,
    dotsY: bandY + 148,
    dotsX0: PAD + 118,
    dotStep: Math.min(6.4, (w - PAD - (PAD + 118)) / N_TEST),
    countsY: bandY + 166,
  };
  return { panel, panels, tiles, numbers, band, height: bandY + BAND_H };
}
export const diceHeight = (w) => diceLayout(w).height;

/** the pixel of the prediction panel a point is over, or null */
export function panelCell(L, x, y) {
  const p = L.panels[2];
  if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return null;
  const c = p.w / G;
  return [Math.floor((x - p.x) / c), Math.floor((y - p.y) / c)];
}

/* --- both pages --------------------------------------------------------------- */

export const isDice = (params) => params.topic === "dice";
export const pageHeight = (w, params) => (isDice(params) ? diceHeight(w) : uHeight(w, params));
export const STEP_MS = 500;
