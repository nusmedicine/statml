/* ============================================================================
   Widget 50 · Support Layers — the arithmetic of the five layers that condition
   a tensor rather than extract features from it.

   PHM5005 05-3 cells 29-60. Every operand here is the notebook's own: cell 32's
   `X = [[0, 1, 5], [4, 2, 0]]` through `nn.Embedding(6, dim)`, cell 36's
   `img[5:11, 5:11] = 1` in a 16 x 16 through `MaxPool2d(k, k)` and
   `AvgPool2d(k, k)`, cell 43's `randn(4, 3) * 5 + 10` through `BatchNorm1d(3)`
   and cell 47's `randn(2, 5, 4) * 3 + 7` through `LayerNorm(4)`, cells 50, 54
   and 56's inputs through ReLU, GELU, SiLU, sigmoid and softmax, and cell 59's
   `randn(2, 5)` through `Dropout(p)`.

   WHERE THE RANDOMNESS COMES FROM, and why it is not one stream. Core seeds
   `compute`'s rng from the `seed` parameter, and `seed` belongs to the Dropout
   page alone: it is the one page where a new draw is the argument. Every other
   page's operands are FIXED draws, produced here by `makeRng` at a stated seed,
   because an embedding table that moved when the reader changed a dropout mask
   would be a widget whose figure depends on a control it does not show. So the
   rule the collection holds — no `Math.random`, every value reproducible from
   the URL — is kept, and each page names the seed it stands on.

   `main.js` draws these and nothing else; `_lab/support-layers-verify.mjs`
   asserts the arithmetic in node, with no browser and no clock.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { outSize, torchPrint } from "../core/torch.js";

/* --- small helpers --------------------------------------------------------- */

export const mat = (rows, cols, f) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => f(r, c)));

const normalMat = (rng, rows, cols) => mat(rows, cols, () => rng.normal());

export const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
export const sd = (v) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
export const sum = (v) => v.reduce((a, b) => a + b, 0);

export const softmax = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = sum(e);
  return e.map((x) => x / s);
};

/* --- how a value is written ------------------------------------------------ *
 * A signed two-decimal float is five characters, and five characters at
 * --fs-sm mono measure 45.8px, which is why the value cell is 46 wide. The
 * leading space on a positive keeps a column aligned about the minus sign. */
export const n2 = (v) => (v < 0 ? "" : " ") + v.toFixed(2);
export const n3 = (v) => v.toFixed(3);
export const n4 = (v) => v.toFixed(4);

/* --- how far one Play beat is ---------------------------------------------- *
 * Slow and Medium stage a step in two phases: the values the step reads LIGHT,
 * then the result LANDS. Fast declares that it does not choreograph. A
 * property of the chosen speed, not something the animation decides mid-run. */
export const SPEEDS = [
  { value: "slow", label: "Slow", detail: "1.5 seconds a step, the inputs lit before the result lands" },
  { value: "medium", label: "Medium", detail: "0.75 seconds a step, the inputs lit before the result lands" },
  { value: "fast", label: "Fast", detail: "0.28 seconds a step, results appearing in place" },
];
export const unitMs = (speed) => (speed === "slow" ? 1500 : speed === "fast" ? 280 : 750);
export const choreographs = (speed) => speed !== "fast";

/* --- the print, and the height it needs ------------------------------------ *
 * `height` is a function of the parameters and has no state to read, so the
 * line count of a print it reserves room for is taken from the SHAPE with a
 * widest-case value in every slot. One function, two readers (5.8). */
const widestPrint = (shape) => torchPrint(shape, () => "-0.0000");
export const printRows = (shape) => widestPrint(shape).lines.length;

/* --- the stage's scale (main.js decision 2) --------------------------------- *
 * One number per page, 0 at the 550 stage the mock drew and 1 at the 770 one a
 * wide viewport gives; every length that carries a value or an image pixel is
 * interpolated on it, and nothing that carries text is. It lives here because
 * it is arithmetic with a second reader: the verify script measures the bands
 * in node, and `main.js` cannot be imported there because it calls
 * `defineWidget` at module scope. */

export const PAD = 14;
export const GAP = 22;           // between two grids that are not operands
export const CW = 46;            // a signed two-decimal float cell
const CH = 26;
const IW = 30;                   // an integer cell
const OP_W = 26;                 // the arrow or dot between two operands
const PIX = 13;                  // a pooling image pixel (mock section 3)
const ARROW_GAP = 40;            // the column an arrow between two grids sits in

export const HUG = 6;            // a dashed frame's clearance around its grid
export const FRAME_LBL = 15;     // the `dim 0 = i` line inside a frame
export const IDXW = 20;          // the embedding table's row-index gutter
export const LAYER_CELL = 44;    // the layer-normalization cell (mock section 4)
export const CURVE = { w: 150, h: 130 };   // the activation curve panel
export const ACT_GUT = 60;       // the row-name gutter on the Hidden rows
export const DROP_GUT = 110;     // the row-name gutter on the Dropout rows
export const NORM_STAT = 96;     // the column that holds `μ 7.00  σ 2.34`

const W_BASE = 550;
const W_WIDE = 770;
const BASE = { cw: CW, ch: CH, iw: IW, op: OP_W, pix: PIX, arrow: ARROW_GAP };
const WIDE = { cw: 60, ch: 34, iw: 40, op: 34, pix: 19, arrow: 54 };

export function sizesAt(t) {
  const s = { t };
  for (const key of Object.keys(BASE)) s[key] = Math.round(BASE[key] + (WIDE[key] - BASE[key]) * t);
  return s;
}

/* A cell keeps its 550 proportions as it grows, so the 44px layer cell stays
   in the ratio the mock fixed against the 46px float cell. */
export const scaledCell = (base, s) => Math.round((base * s.cw) / CW);

/**
 * The largest geometry whose widest band is inside the stage — MEASURED, from
 * the same function `main.js` lays the band out with, rather than asserted from
 * a table of widths that would drift the first time a band changed. Floored at
 * the 550 geometry, which is where a digit stops being readable.
 */
const SIZE_STEP = 1 / 48;
export function fitSizes(w, widest) {
  const avail = w - 2 * PAD;
  for (let t = Math.max(0, Math.min(1, (w - W_BASE) / (W_WIDE - W_BASE))); t > 0; t -= SIZE_STEP) {
    const s = sizesAt(t);
    if (widest(s) <= avail) return s;
  }
  return sizesAt(0);
}

/* --- the widest band on each page ------------------------------------------ *
 * THE FIT IS ARITHMETIC AND HAS TWO READERS (5.8). `main.js` hands one of these
 * to `fitSizes` so the scale is chosen by measuring the band it will draw, and
 * `_lab/support-layers-verify.mjs` reads the same functions in node to assert
 * that every page fits at the 550 and 770 stages. A width computed twice is a
 * width that can differ. */

export const bandWidth = {
  embedding: (dim, z, stacked) => {
    const frame = dim * z.cw + 2 * HUG;
    return Math.max(
      3 * z.iw + z.arrow + IDXW + dim * z.cw,
      stacked ? frame : 2 * frame + GAP);
  },
  pooling: (k, z) => {
    const n = 16 / k;
    return Math.max(
      16 * z.pix + z.arrow + 2 * n * z.pix + GAP,
      k * z.cw + z.op + z.cw + GAP + z.op + z.cw);
  },
  batchNorm: (z) => 2 * 3 * z.cw + z.arrow,
  layerNorm: (z) => 2 * 4 * scaledCell(LAYER_CELL, z) + NORM_STAT + GAP,
  hidden: (z) => CURVE.w + GAP + ACT_GUT + 5 * z.cw,
  probability: (z) => z.cw + z.op + z.cw,
  distribution: (z) => 6 * z.cw,
  dropout: (z, annW) => DROP_GUT + 5 * z.cw + annW,
};

/** DECISION 5: at dim = 8 the two result frames do not fit side by side at any
    stage the side layout reaches, so they stack. Measured against the stage
    rather than written as a dimension. */
export const embedStacked = (w, dim) =>
  2 * (dim * CW + 2 * HUG) + GAP > w - 2 * PAD;

/* ======================= 1 · Embedding (cells 29-33) ======================= */

/** Cell 31's vocabulary: six amino acids, so an id is a residue. */
export const VOCAB = ["A", "C", "D", "E", "F", "G"];
/** Cell 32's `X`: two sequences of three residues, as integer ids. */
export const TOKENS = [[0, 1, 5], [4, 2, 0]];
export const EMB_ROWS = TOKENS.length;
export const EMB_COLS = TOKENS[0].length;
/* `nn.Embedding` initialises its table from N(0, 1). The seed is fixed here
   rather than taken from `seed`: the table is the layer, and a layer that
   changed when a dropout mask was redrawn would be a figure moving under a
   control that is not on the page. */
export const EMB_SEED = 3;

export function embedding(dim) {
  const table = normalMat(makeRng(EMB_SEED), VOCAB.length, dim);
  const out = TOKENS.map((row) => row.map((id) => table[id]));
  return {
    kind: "embedding", dim, table, out,
    units: EMB_ROWS * EMB_COLS,
    /** The token an ordinal of the walk stands for. */
    tokenAt: (k) => ({ i: Math.floor(k / EMB_COLS), j: k % EMB_COLS }),
  };
}

/* ========================= 2 · Pooling (cells 34-39) ======================= */

export const IMG_N = 16;
export const SQ_FROM = 5;
export const SQ_TO = 11;
/** Cell 36's `img[5:11, 5:11] = 1.0` — a 6 x 6 bright square in a 16 x 16. */
export const IMG = mat(IMG_N, IMG_N, (r, c) =>
  (r >= SQ_FROM && r < SQ_TO && c >= SQ_FROM && c < SQ_TO ? 1 : 0));

/* THE STRIDE EQUALS THE WINDOW AND IS NOT A CONTROL. At `k = 2, s = 4` the
   windows skip input rows 2 and 3 of every 4, and the output is an asymmetric
   0.25 / 0.50 / 0.50 / 1.00 that reads as a defect unless the figure also draws
   the rows nobody looked at. Both notebook cells use stride = window. */
export function pooling(k) {
  const s = k;
  const n = outSize(IMG_N, k, s);
  const window = (r, c) => mat(k, k, (u, v) => IMG[r * s + u][c * s + v]);
  const max = mat(n, n, (r, c) => Math.max(...window(r, c).flat()));
  const avg = mat(n, n, (r, c) => mean(window(r, c).flat()));
  return {
    kind: "pooling", k, s, n, max, avg, window,
    units: n * n,
    /** How many of the window's values are 1, which is what decides both. */
    ones: (r, c) => window(r, c).flat().filter((v) => v === 1).length,
  };
}

/* ===================== 3 · Normalization (cells 40-47) ===================== */

/* PyTorch's BatchNorm1d in training mode and LayerNorm both divide by N rather
   than N − 1, and both add eps inside the square root. Using the sample
   variance instead would print values that do not match the lesson's output. */
export const EPS = 1e-5;
export const BATCH_SEED = 2;
export const LAYER_SEED = 5;
export const BATCH_N = 4;
export const BATCH_F = 3;
export const SEQ_SAMPLES = 2;
export const SEQ_LEN = 5;
export const SEQ_F = 4;

const stat = (v) => {
  const m = mean(v);
  return { m, s: Math.sqrt(mean(v.map((x) => (x - m) ** 2)) + EPS) };
};

/** Cell 43's `X_batch = randn(4, 3) * 5 + 10` through `BatchNorm1d(3)`. */
function batchNorm(gamma, beta) {
  const X = normalMat(makeRng(BATCH_SEED), BATCH_N, BATCH_F).map((r) => r.map((v) => v * 5 + 10));
  const groups = Array.from({ length: BATCH_F }, (_, c) => stat(X.map((r) => r[c])));
  const hat = X.map((r) => r.map((v, c) => (v - groups[c].m) / groups[c].s));
  const Y = hat.map((r) => r.map((v) => gamma * v + beta));
  return { X, groups, hat, Y };
}

/** Cell 47's `X_seq = randn(2, 5, 4) * 3 + 7` through `LayerNorm(4)`. */
function layerNorm(gamma, beta) {
  const rng = makeRng(LAYER_SEED);
  const X = Array.from({ length: SEQ_SAMPLES }, () =>
    normalMat(rng, SEQ_LEN, SEQ_F).map((r) => r.map((v) => v * 3 + 7)));
  const groups = X.map((sample) => sample.map((row) => stat(row)));
  const hat = X.map((sample, i) => sample.map((row, r) =>
    row.map((v) => (v - groups[i][r].m) / groups[i][r].s)));
  const Y = hat.map((sample) => sample.map((row) => row.map((v) => gamma * v + beta)));
  return { X, groups, hat, Y };
}

/**
 * One state for both readings. The group is the unit of the walk: a column of
 * the batch, or a row of one sample. `groupAt` turns an ordinal into the group
 * it names, so the drawing and the readout ask one function (5.8).
 */
export function normalization(which, gamma, beta) {
  if (which === "layer") {
    const m = layerNorm(gamma, beta);
    return {
      kind: "normalization", which, gamma, beta, ...m,
      units: SEQ_SAMPLES * SEQ_LEN,
      groupAt: (k) => ({ sample: Math.floor(k / SEQ_LEN), row: k % SEQ_LEN }),
      values: (g) => m.X[g.sample][g.row],
      after: (g) => m.Y[g.sample][g.row],
      statOf: (g) => m.groups[g.sample][g.row],
    };
  }
  const m = batchNorm(gamma, beta);
  return {
    kind: "normalization", which, gamma, beta, ...m,
    units: BATCH_F,
    groupAt: (k) => ({ col: k }),
    values: (g) => m.X.map((r) => r[g.col]),
    after: (g) => m.Y.map((r) => r[g.col]),
    statOf: (g) => m.groups[g.col],
  };
}

/* ====================== 4 · Activation (cells 48-56) ======================= */

/* Abramowitz and Stegun 7.1.26, accurate to 1.5e-7, which is well inside the
   two decimals a cell prints. `nn.GELU()` with its default approximation set to
   "none" is exactly x · Φ(x), so this is the form drawn. */
const erf = (x) => {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
};
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const ACTS = [
  { key: "relu", label: "ReLU", f: (x) => Math.max(0, x) },
  { key: "gelu", label: "GELU", f: (x) => x * 0.5 * (1 + erf(x / Math.SQRT2)) },
  { key: "silu", label: "SiLU", f: (x) => x * sigmoid(x) },
];
export const actByKey = (key) => ACTS.find((a) => a.key === key) ?? ACTS[0];

export const HIDDEN_IN = [-2, -1, 0, 1, 2];          // cell 50
export const PROB_IN = [-2, 0, 1, 2, 3];             // cell 54
export const DIST_IN = [                              // cell 56
  [2, 1, 0.1, -1, -2],
  [0, 0, 0, 0, 0],
  [1.5, 2.5, 0.5, -1, -0.5],
];

export function activation(use) {
  if (use === "probability") {
    const out = PROB_IN.map(sigmoid);
    return { kind: "activation", use, out, units: PROB_IN.length };
  }
  if (use === "distribution") {
    const out = DIST_IN.map(softmax);
    return {
      kind: "activation", use, out, units: DIST_IN.length,
      rowSum: (r) => sum(out[r]),
    };
  }
  const out = ACTS.map((a) => HIDDEN_IN.map(a.f));
  return { kind: "activation", use, out, units: HIDDEN_IN.length };
}

/* ======================== 5 · Dropout (cells 57-60) ======================== */

export const DROP_ROWS = 2;
export const DROP_COLS = 5;
export const DROP_SEED = 1;
/** Cell 59's `x = torch.randn(2, 5)`, fixed so the mask is the only thing the
    reader changes. */
export const XD = normalMat(makeRng(DROP_SEED), DROP_ROWS, DROP_COLS);
export const DROP_IN_SUM = sum(XD.flat());

/** One draw of the mask, and the output the survivors' scaling produces. */
export function dropDraw(seed, p) {
  const rng = makeRng(seed);
  const mask = XD.map((r) => r.map(() => (rng.next() >= p ? 1 : 0)));
  const y = XD.map((r, i) => r.map((v, j) => (mask[i][j] ? v / (1 - p) : 0)));
  return { mask, y, sum: sum(y.flat()), kept: mask.flat().filter(Boolean).length };
}

/**
 * THE RUNNING MEAN IS A PURE FUNCTION OF THE PARAMETERS (invariant 1). It is
 * the mean output sum over draws 1 to `seed`, so `?seed=10` reproduces the
 * number exactly and nothing accumulates outside `values`. It has to be here
 * because one draw argues the opposite of the page's claim: at p = 0.8 the
 * standard deviation of the sum is about twice the input sum, and about one
 * draw in six drops every cell.
 */
export function dropout(seed, p, mode) {
  const draw = dropDraw(seed, p);
  const training = mode !== "evaluation";
  let acc = 0;
  for (let s = 1; s <= seed; s += 1) acc += dropDraw(s, p).sum;
  return {
    kind: "dropout", p, mode, training, seed,
    mask: training ? draw.mask : XD.map((r) => r.map(() => 1)),
    y: training ? draw.y : XD.map((r) => r.slice()),
    outSum: training ? draw.sum : DROP_IN_SUM,
    kept: training ? draw.kept : DROP_ROWS * DROP_COLS,
    meanSum: acc / seed,
    scale: 1 / (1 - p),
    units: DROP_ROWS * DROP_COLS,
  };
}
