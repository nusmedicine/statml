/* ============================================================================
   Widget 65 · model.js — the arithmetic and the geometry of both pages, with
   no colour, no string a reader sees and no pixel painted (5.8): `main.js`
   draws from what this returns, and `_lab/unet-verify.mjs` measures it.

   THE U-NET PAGE computes the stage list of PHM5005 06-3 cell 33's `UNet2D`
   in walk order — enc1 · pool1 · … · bottleneck · up_l · cat_l · dec_l · head
   — each with its shape, and the parameter count cell 33's modules add up to
   (held against torch in `_lab/unet-torch.txt`). Round 2 (Kenneth,
   2026-09-15) adds a TRAINED network for the operation band: `engine.js`'s
   depth-2, base-4 U-Net on 16 × 16 images, trained once and cached, whose
   maps the band draws for the block the reader chose.

   THE DICE PAGE computes a disc at one of three sizes, a prediction of a
   chosen shape moved by the reader's drag, and the numbers cell 38 names.
   ========================================================================= */

import { makeRng } from "../core/index.js";
import * as E from "./engine.js";

export const PAD = 14;

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
  const enc = [];
  for (let i = 1; i <= depth; i += 1) {
    const C = base * 2 ** (i - 1);
    st.push({ kind: "enc", name: `enc${i}`, level: i, C, H, op: "DoubleConv" });
    enc.push({ C, H });
    H = Math.max(1, H >> 1);
    st.push({ kind: "pool", name: `pool${i}`, level: i, C, H, op: "MaxPool2d(2)" });
  }
  st.push({ kind: "bottleneck", name: "bottleneck", level: depth + 1, C: base * 2 ** depth, H, op: "DoubleConv" });
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
export const stageNames = (depth) => stagesFor(Number(depth), 4, 16).map((s) => s.name);

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
  n += dc(cin, base * 2 ** depth);
  for (let i = depth; i >= 1; i -= 1) {
    const c = base * 2 ** (i - 1);
    n += 4 * 2 * c * c + c;
    n += dc(2 * c, c);
  }
  n += base * NUM_CLASSES + NUM_CLASSES;
  return n;
}

/* --- the trained network ------------------------------------------------------- *
 * One network for every setting of the rail: the band shows what an operation
 * DOES, and a depth-2, base-4 U-Net on a 16 × 16 image is the size whose
 * numbers can be printed and which trains in about a second
 * (`_lab/unet-measure.mjs`: 200 images, 5 epochs, held-out Dice 0.76–0.80 over
 * three seeds; 120 images failed on two of three). Trained on first request
 * and cached: it depends on nothing the reader sets, so the cache is the pure
 * function's memo, not state.                                                  */
export const TRAIN = { depth: 2, base: 4, S: 16, n: 200, nTest: 60, epochs: 5, batch: 8, seed: 1, testSeed: 9000 };
let trained = null;
export function trainedNet() {
  if (trained) return trained;
  const rng = makeRng(TRAIN.seed);
  const data = E.makeData(TRAIN.S, TRAIN.n, rng);
  const test = E.makeData(TRAIN.S, TRAIN.nTest, makeRng(TRAIN.testSeed));
  const net = E.makeUNet(TRAIN.depth, TRAIN.base, TRAIN.S, rng);
  const t0 = performance.now();
  const { losses } = E.train(net, data, { epochs: TRAIN.epochs, batch: TRAIN.batch, rng });
  const ms = performance.now() - t0;
  const dice = E.evaluateDice(net, test);
  /* the image the band is about: the first held-out image with one blob of
     a middling size, so a window at its edge shows the object and the field */
  const HW = TRAIN.S * TRAIN.S;
  let index = 0;
  for (let i = 0; i < test.n; i += 1) {
    let area = 0;
    for (let k = 0; k < HW; k += 1) area += test.t[i * HW + k];
    if (area >= 24 && area <= 50) { index = i; break; }
  }
  const img = test.x.slice(index * HW, (index + 1) * HW);
  const truth = test.t.slice(index * HW, (index + 1) * HW);
  const rec = E.forward(net, img, 1);
  const unit = edgeUnit(truth, TRAIN.S);
  trained = { net, losses, ms, dice, index, img, truth, rec, unit, params: E.parameterCount(net) };
  return trained;
}
/** the object pixel furthest right along the row through the object's centre:
    a position on the edge, inside the border so a 3 × 3 window fits */
export function edgeUnit(mask, S) {
  let sy = 0;
  let n = 0;
  for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) if (mask[y * S + x]) { sy += y; n += 1; }
  const r = Math.min(S - 2, Math.max(1, Math.round(sy / Math.max(1, n))));
  let c = 1;
  for (let x = 0; x < S; x += 1) if (mask[r * S + x]) c = x;
  return { r, c: Math.min(S - 2, Math.max(1, c)) };
}
/** the trained network's block that a drawn block's operation is shown on: the
    same kind, at the trained network's nearest level */
export function trainedStage(name) {
  const m = name.match(/^([a-z]+)(\d+)$/);
  if (!m) return name;
  return `${m[1]}${Math.min(Number(m[2]), TRAIN.depth)}`;
}
/** a position on a map of side H, scaled from the image's */
export const unitAt = (v, H) => Math.min(H - 1, Math.max(0, Math.floor(v * H / TRAIN.S)));

export const readU = (p) => ({ depth: Number(p.depth), base: Number(p.base), input: Number(p.input) });
export function computeU(params) {
  const { depth, base, input } = readU(params);
  const stages = stagesFor(depth, base, input);
  return {
    page: "unet", depth, base, input, stages,
    params: paramCount(depth, base), total: stages.length, trained: trainedNet(),
  };
}

/* --- the U's geometry ------------------------------------------------------- *
 * Kenneth's figure's rule — a slab's height follows H × W and its width C —
 * laid out as his figure's staircase (round 2, "the diagram does not show a
 * u-shape"): each encoder level starts one step further right, each decoder
 * level ends one step further left, the bottleneck sits at the bottom
 * between them, and the skips shorten toward it.                              */
export const LEVEL_H = 150;
export const ROW_GAP = 26;
export const BOTTLE_W = 84;
export const SLAB_MIN = 6;
export const ROW_MIN = 10;
export const U_TOP = 64;
export const CAPTION_Y = 24;
export const NOTE_Y = 40;
export const SHAPE_Y = 56;
export const stepOf = (w) => Math.max(36, Math.min(60, 36 + (w - 550) * 0.11));

export function uLayout(w, state) {
  const { depth, base, input, stages } = state;
  const step = stepOf(w);
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
  for (const s of stages) {
    const row = rows[s.level - 1];
    const sw = slabW(s.C);
    const encX = PAD + 40 + (s.level - 1) * step;
    const decRight = w - PAD - 40 - (s.level - 1) * step;
    let x = null;
    if (s.kind === "enc") x = encX;
    else if (s.kind === "bottleneck") x = w / 2 - sw / 2;
    else if (s.kind === "dec") x = decRight - sw;
    else if (s.kind === "cat") x = decRight - slabW(s.C / 2) - 8 - sw;
    else if (s.kind === "up") x = decRight - slabW(s.C) - 8 - slabW(s.C);   // the right half of its concatenation
    else if (s.kind === "head") x = w - PAD - 22;
    if (x != null) boxes[s.name] = { x, y: row.y, w: sw, h: row.h };
    if (s.kind === "pool") {
      const from = rows[s.level - 1];
      boxes[s.name] = { x: encX + slabW(base * 2 ** (s.level - 1)) / 2 + 6, y: from.y + from.h + 2, w: 44, h: ROW_GAP - 4, arrow: true };
    }
  }
  const height = y - ROW_GAP + 34;
  return { rows, boxes, slabW, height };
}

/* --- the operation band's geometry ------------------------------------------ */

export const BAND_GAP = 18;
export const BAND_H = 300;
export const MAP_S = 34;
export const CW = 30;             // a printed value's cell: "−0.50" at 9px mono
export const BAND_CAP = 16;
export const BAND_NOTE = 32;
export const BAND_NET = 46;
export const HEAD_Y = 64;
export const BODY_Y = 72;
export const SHOWN = 4;
export const GRID_ROWS = 2;       // input channels whose window and slice are printed
export const HEAD_MAP = 56;
/** the height one band needs, by kind and channels: the verify holds each
    under BAND_H so the stage does not jog when the block changes */
export function bandHeight(kind, cin, cout) {
  const column = (C) => BODY_Y + Math.min(SHOWN, C) * (MAP_S + 4) + (C > SHOWN ? 12 : 0);
  if (kind === "conv") return Math.max(column(cin), column(cout), BODY_Y + Math.min(GRID_ROWS, cin) * (3 * CW + 10) + 14) + 8;
  if (kind === "head") return Math.max(column(cin), BODY_Y + cin * CW, BODY_Y + HEAD_MAP) + 8;
  if (kind === "cat") return column(cin) + 8;
  return Math.max(column(cin), column(cout)) + 8;
}

export const uHeight = (w, params) => uLayout(w, { ...readU(params), stages: stagesFor(...Object.values(readU(params))) }).height;
export const unetHeight = (w, params) => uHeight(w, params) + BAND_GAP + BAND_H;

/* --- Dice ------------------------------------------------------------------- */

export const G = 64;
export const SIZES = {
  small: { r: 3.75, share: "1 %" },
  medium: { r: 8.1, share: "5 %" },
  large: { r: 16.2, share: "20 %" },
};
export const SIZE_KEYS = Object.keys(SIZES);
export const CENTRE = [30.5, 33.5];
export const SHIFT_MAX = 40;

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
/** the prediction's shape; its position is the reader's drag */
export const SHAPES = [
  { key: "same", make: (m) => m.slice() },
  { key: "dilate", make: (m) => morph(m, true) },
  { key: "erode", make: (m) => morph(m, false) },
  { key: "random", make: (m, rng) => randomSame(m, rng) },
  { key: "empty", make: () => new Uint8Array(G * G) },
];
export const SHAPE_KEYS = SHAPES.map((p) => p.key);

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

export const readDice = (p) => ({ size: p.size, shape: p.shape, dx: Number(p.dx), dy: Number(p.dy), seed: Number(p.seed) });
export function computeDice(params) {
  const { size, shape, dx, dy, seed } = readDice(params);
  const truth = disc(CENTRE[0], CENTRE[1], SIZES[size].r);
  const P = SHAPES.find((p) => p.key === shape) ?? SHAPES[0];
  const shaped = P.make(truth, makeRng(seed));
  const prediction = shift(shaped, dx, dy);
  return { page: "dice", size, shape, dx, dy, truth, prediction, m: metrics(truth, prediction), total: 3 };
}

/* --- Dice's geometry --------------------------------------------------------- */

export const PANEL = 190;
export const TILE_W = 110;
export const TILE_H = 46;
export const TILE_GAP = 10;
export const LINE = 16;
export function diceLayout(w) {
  const panel = { x: PAD, y: 52, w: PANEL, h: PANEL };
  const tx = PAD + PANEL + 20;
  const tiles = [0, 1, 2].map((k) => ({ x: tx, y: 52 + k * (TILE_H + TILE_GAP), w: TILE_W, h: TILE_H }));
  const numbers = { x: tx + TILE_W + 14, y: 64, valueX: tx + TILE_W + 14 + 112 };
  return { panel, tiles, numbers, height: 52 + PANEL + 44 };
}
export const diceHeight = (w) => diceLayout(w).height;
export const panelHit = (L, x, y) => x >= L.panel.x && x <= L.panel.x + L.panel.w && y >= L.panel.y && y <= L.panel.y + L.panel.h;

/* --- both pages --------------------------------------------------------------- */

export const isDice = (params) => params.topic === "dice";
export const pageHeight = (w, params) => (isDice(params) ? diceHeight(w) : unetHeight(w, params));
export const STEP_MS = 500;
