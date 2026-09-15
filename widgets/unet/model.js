/* ============================================================================
   Widget 65 · model.js — the arithmetic and the geometry of both pages, with
   no colour, no string a reader sees and no pixel painted (5.8): `main.js`
   draws from what this returns, and `_lab/unet-verify.mjs` measures it.

   THE U-NET PAGE computes the stage list of PHM5005 06-3 cell 33's `UNet2D`
   in walk order — enc1 · pool1 · … · bottleneck · up_l · cat_l · dec_l · head
   — each with its shape, and the parameter count cell 33's modules add up to
   (held against torch in `_lab/unet-torch.txt`). The network is chosen by
   Depth and Base channels on a 16 × 16 colour image, and the operation band
   draws that same network's trained maps and numbers, read from `table.js`.

   THE DICE PAGE computes a disc at one of three sizes, a prediction of a
   chosen shape moved by the reader's drag, and the numbers cell 38 names.
   ========================================================================= */

import { TABLE, SPEC as TABLE_SPEC } from "./table.js";

export const PAD = 14;

/* --- the U ---------------------------------------------------------------- */

export const BATCH = 10;          // cell 37's trace input: a batch of 10
export const IN_CH = 3;           // three channels, the lesson's images
export const NUM_CLASSES = 1;     // binary: one logit a pixel

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
export const chw = (C, H) => `${C} × ${H} × ${H}`;
export const stageNames = (depth) => stagesFor(Number(depth), 4, 16).map((s) => s.name);
/** a position on a map of side H, scaled from the image's */
export const unitAt = (v, H) => Math.min(H - 1, Math.max(0, Math.floor((v * H) / TABLE_SPEC.S)));

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

/* --- the trained networks ------------------------------------------------------ *
 * ONE NETWORK ON THE PAGE (Kenneth, 2026-09-15: "go with depth 3 base 4 input 16,
 * train on 3 channels", then "give some choices so students can see what happens
 * if we change the architecture", then Depth 2 · 3 · 4 and Base channels 4 · 8).
 * The diagram, the level table and the operation panel are the same network at
 * every choice: a U-Net on a 16 × 16 colour image.
 *
 * THE SIX NETWORKS ARE TRAINED AHEAD, by `engine.js` at its own seed, in
 * `_lab/unet-table.mjs`, and read from `table.js` (38 KB gzip). Trained in the
 * page, base 8 froze it for 4.5–10 s on first pick, and core's compute is
 * synchronous; `_lab/unet-verify.mjs` retrains two settings and holds the table
 * to them. A thumbnail is a map quantised to 0–255 with its range; `mapOf`
 * turns one back into values the band draws.                                      */
export const DEPTHS = ["2", "3", "4"];
export const BASES = ["4", "8"];
export const INPUT = TABLE_SPEC.S;
export const TABLE_N = TABLE_SPEC.n;
export const TABLE_EPOCHS = TABLE_SPEC.epochs;
export const tableKey = (depth, base) => `d${depth}b${base}`;
export function mapOf(q) {
  const n = q.n;
  const out = new Float64Array(n * n);
  for (let i = 0; i < n * n; i += 1) out[i] = q.lo + ((q.hi - q.lo) * parseInt(q.hex.substr(2 * i, 2), 16)) / 255;
  return out;
}

export const readU = (p) => ({ depth: Number(p.depth), base: Number(p.base), input: INPUT });
export function computeU(params) {
  const { depth, base, input } = readU(params);
  const stages = stagesFor(depth, base, input);
  const trained = TABLE[tableKey(depth, base)];
  return { page: "unet", depth, base, input, stages, params: paramCount(depth, base), total: stages.length, trained };
}

/* --- the U's geometry ------------------------------------------------------- *
 * Kenneth's figure's own construction (round 3, 2026-09-15: "the connectors
 * seem to float"). Two slabs a level on the way down — the pooled input and
 * the DoubleConv output, a conv arrow between — so the pool arrow drops
 * straight from one slab onto the next level's input slab directly under it.
 * The bottleneck row is the last pooled map and the bottleneck; the up arrow
 * rises from the bottleneck's right end into the up half of the deepest
 * concatenation, and each shallower up arrow from the decoder slab below. So
 * every arrow starts and ends on a slab.
 *
 * A slab's height follows H × W and its width C. The channel scale `cw` is the
 * largest that fits the width, and THE BOTTLENECK IS CENTRED (round 3, "can the
 * bottleneck be centred?"): the bottleneck row's conv arrow is lengthened until
 * the bottleneck's centre is the U's midpoint. The decoder is placed from the
 * bottleneck, so only that one arrow can move, and it does.                      */
export const LEVEL_H = 150;
export const ROW_GAP = 30;
export const SLAB_MIN = 5;
export const ROW_MIN = 10;
export const ARROW = 22;          // a conv arrow, and the gap it spans
export const U_TOP = 80;          // under the highlighted shape line, clear of a concatenation's bracket
export const CAPTION_Y = 24;
export const NOTE_Y = 40;
export const SHAPE_Y = 56;
export const LEFT_LABEL = 46;     // "enc1" left of the first slab
export const RIGHT_LABEL = 84;    // "dec1 · head" right of the head
export const HEAD_W = 5;

function uBuild(state, x0, cw, bottomArrow, headArrow = ARROW) {
  const { depth, base, input } = state;
  const C = (l) => base * 2 ** (l - 1);
  const H = (l) => Math.max(1, input >> (l - 1));
  const w = (c) => Math.max(SLAB_MIN, c * cw);
  const b = {};
  b.input = { x: x0, level: 1, w: w(IN_CH) };
  b.enc1 = { x: x0 + w(IN_CH) + ARROW, level: 1, w: w(C(1)) };
  for (let l = 1; l <= depth; l += 1) {
    const e = b[`enc${l}`];
    b[`pool${l}`] = { x: e.x, level: l + 1, w: e.w };
    if (l < depth) b[`enc${l + 1}`] = { x: e.x + e.w + ARROW, level: l + 1, w: w(C(l + 1)) };
  }
  const pd = b[`pool${depth}`];
  b.bottleneck = { x: pd.x + pd.w + bottomArrow, level: depth + 1, w: w(C(depth + 1)) };
  let below = b.bottleneck;
  for (let l = depth; l >= 1; l -= 1) {
    const half = w(C(l));
    const upX = below.x + below.w - half;
    b[`up${l}`] = { x: upX, level: l, w: half };
    b[`cat${l}`] = { x: upX - half, level: l, w: 2 * half };
    b[`dec${l}`] = { x: upX + half + ARROW, level: l, w: half };
    below = b[`dec${l}`];
  }
  b.head = { x: b.dec1.x + b.dec1.w + headArrow, level: 1, w: HEAD_W };
  return { b, right: b.head.x + b.head.w };
}

export function uLayout(w, state) {
  const { depth, input } = state;
  const x0 = PAD + LEFT_LABEL;
  const room = w - x0 - PAD - RIGHT_LABEL;
  let cw = 6;
  let built = null;
  for (let i = 0; i < 80; i += 1) {
    /* the bottleneck row's arrow that centres the bottleneck */
    const trial = uBuild(state, x0, cw, ARROW);
    const bn = trial.b.bottleneck;
    const centre = bn.x + bn.w / 2;
    const extra = (trial.right - centre) - (centre - x0);
    /* the right side longer: lengthen the bottleneck row's arrow; the left side
       longer (wide slabs, where the three-channel input outgrows the head): lengthen
       the head's arrow */
    built = extra > 0 ? uBuild(state, x0, cw, ARROW + extra) : extra < 0 ? uBuild(state, x0, cw, ARROW, ARROW - extra) : trial;
    if (built.right - x0 <= room) break;
    cw *= 0.93;
  }
  const rows = [];
  let y = U_TOP;
  for (let l = 1; l <= depth + 1; l += 1) {
    const H = Math.max(1, input >> (l - 1));
    const h = Math.max(ROW_MIN, LEVEL_H * H / input);
    rows.push({ y, h, H });
    y += h + ROW_GAP;
  }
  const boxes = {};
  for (const [k, v] of Object.entries(built.b)) {
    const row = rows[v.level - 1];
    boxes[k] = { x: v.x, y: row.y, w: v.w, h: row.h, level: v.level };
  }
  return { rows, boxes, x0, right: built.right, cw, height: y - ROW_GAP + 34 };
}

/* --- the operation band's geometry ------------------------------------------ */

export const BAND_GAP = 18;
export const BAND_H = 314;
export const MAP_S = 34;
export const CW = 30;             // a printed value's cell: "−0.50" at 9px mono
export const BAND_CAP = 16;
export const BAND_NOTE = 32;
export const BAND_NET = 46;
export const CH_Y = 62;          // the channel counts, on their own row (round 7)
export const HEAD_Y = 78;
export const BODY_Y = 86;
export const SHOWN = 4;
export const GRID_ROWS = 2;       // input channels whose window and slice are printed
export const HEAD_MAP = 56;
/** the height one band needs, by kind and channels: the verify holds each
    under BAND_H so the stage does not jog when the block changes */
/** the head band's pixel and weight cells: one column, two past five channels */
export const headCols = (cin) => (cin > 5 ? 2 : 1);
export function bandHeight(kind, cin, cout) {
  const column = (C) => BODY_Y + Math.min(SHOWN, C) * (MAP_S + 4) + (C > SHOWN ? 12 : 0);
  if (kind === "conv") return Math.max(column(cin), column(cout), BODY_Y + Math.min(GRID_ROWS, cin) * (3 * CW + 10) + 14) + 8;
  if (kind === "head") return Math.max(column(cin), BODY_Y + Math.ceil(cin / headCols(cin)) * CW, BODY_Y + HEAD_MAP) + 8;
  if (kind === "cat") return column(cin) + 8;
  return Math.max(column(cin), column(cout)) + 8;
}

export const uHeight = (w, params) => uLayout(w, readU(params)).height;
export const unetHeight = (w, params) => uHeight(w, params) + BAND_GAP + BAND_H;

/* --- Dice ------------------------------------------------------------------- */

export const G = 64;
/* medium and large only (Kenneth, round 4: "small is too small"): a 1 % disc
   is about eleven pixels across on the panel */
export const SIZES = {
  medium: { share: 0.05, label: "5 %" },
  large: { share: 0.20, label: "20 %" },
};
export const SIZE_KEYS = Object.keys(SIZES);
export const CENTRE = [30.5, 33.5];
export const SHIFT_MAX = 40;

/* THE SHAPES (round 5, Kenneth: "a rectangle, triangle or something else").
   Each is drawn at a given AREA about the centre, so a disc, a 2 : 1 rectangle
   and an equilateral triangle of one size cover the same number of pixels, and
   a different shape is not also a different size. The prediction's size is its
   own control — half, the same or twice the truth's area — which is what the
   1 px dilate and erode tried to show, at a size that is visible. */
export const SHAPES = ["disc", "rect", "tri"];
export const PRED_SHAPES = [...SHAPES, "none"];
export const PRED_SIZES = { half: 0.5, same: 1, double: 2 };
export const PRED_SIZE_KEYS = Object.keys(PRED_SIZES);

/** is the point (px, py), measured from the shape's centre, inside it */
export function insideShape(shape, area, px, py) {
  if (shape === "disc") return Math.hypot(px, py) <= Math.sqrt(area / Math.PI);
  if (shape === "rect") {
    /* whole columns and rows, half-open, so it covers the area it is drawn at:
       a pixel-centre test on the real width rounded both sides up, 13 % over */
    const cols = Math.max(1, Math.round(Math.sqrt(2 * area)));
    const rows = Math.max(1, Math.round(area / cols));
    return px >= -cols / 2 && px < cols / 2 && py >= -rows / 2 && py < rows / 2;
  }
  /* an equilateral triangle, apex up, its centroid at the centre */
  const s = Math.sqrt((4 * area) / Math.sqrt(3));
  const height = (Math.sqrt(3) / 2) * s;
  const apex = (-2 * height) / 3;
  if (py < apex || py > height / 3) return false;
  return Math.abs(px) <= ((py - apex) / height) * (s / 2);
}
/** a shape's mask on the G × G grid, its centre moved by (dx, dy) pixels */
export function shapeMask(shape, area, dx = 0, dy = 0) {
  const m = new Uint8Array(G * G);
  if (shape === "none") return m;
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      if (insideShape(shape, area, x + 0.5 - CENTRE[0] - dx, y + 0.5 - CENTRE[1] - dy)) m[y * G + x] = 1;
    }
  }
  return m;
}

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

export const readDice = (p) => ({
  size: p.size, truthShape: p.truth, predShape: p.pred, predSize: p.psize,
  dx: Number(p.dx), dy: Number(p.dy),
});
export function computeDice(params) {
  const { size, truthShape, predShape, predSize, dx, dy } = readDice(params);
  const area = SIZES[size].share * G * G;
  const truth = shapeMask(truthShape, area);
  const prediction = shapeMask(predShape, area * (PRED_SIZES[predSize] ?? 1), dx, dy);
  return {
    page: "dice", size, truthShape, predShape, predSize, dx, dy,
    truth, prediction, m: metrics(truth, prediction), total: 0,
  };
}

/* --- Dice's geometry --------------------------------------------------------- */

export const PANEL = 190;
export const TILE_W = 110;
export const TILE_H = 46;
export const TILE_GAP = 8;
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
