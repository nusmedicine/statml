/* ============================================================================
   Widget 49 · Processing Layers — the arithmetic of the five layers.

   PHM5005 05-3 cells 1-28. Every operand here is the notebook's own: cell 5's
   `Linear(4, 3)` on `randn(2, 4)`, cell 8's 16 x 16 square through cell 9's
   `Conv2d(1, 2, 3, stride=2, padding=1)` and cell 14's `ConvTranspose2d`,
   cell 19's `[2, 5, 4]` through a bidirectional recurrence with 3 hidden
   features, cell 22's three token embeddings through
   `MultiheadAttention(4, 1)`, and cell 27's four nodes on the chain 0-1-2-3
   through `GCNConv(3, 3)`.

   NOTHING IS TRAINED. Every learnable value is one draw from U(-bound, bound)
   with the bound PyTorch's own `reset_parameters` uses — `core/torch.js`'s
   `initBound` — off the seeded `rng` that `compute` is handed, never
   `Math.random` (invariant 6). So an untrained figure has the magnitudes a
   real `nn.Linear(4, 3)` prints rather than ones invented for the picture.

   `main.js` draws these and nothing else; `_lab/processing-layers-verify.mjs`
   asserts the arithmetic in node, with no browser and no clock.
   ========================================================================= */

import {
  initBound, uniform, outSize, transposedOutSize, torchPrint,
} from "../core/torch.js";

/* --- small matrix helpers -------------------------------------------------- */

export const mat = (rows, cols, f) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => f(r, c)));

const normalMat = (rng, rows, cols) => mat(rows, cols, () => rng.normal());
const uniformMat = (rng, rows, cols, b) => mat(rows, cols, () => uniform(rng, b));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/** `A @ B.T` — the form PyTorch computes a Linear in, and the one every
    projection here takes: B's rows are the output units. */
const matmulT = (A, B) => A.map((row) => B.map((w) => dot(w, row)));

export const softmax = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

export const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

/* --- how a value is written ------------------------------------------------ *
 * A signed two-decimal float is five characters, and five characters at
 * --fs-sm mono measure 45.8px — which is why the value cell is 46 wide (the
 * mock's §2, Kenneth's pick). The leading space on a positive keeps a column
 * of signed values aligned about the minus sign, as his own figures do. */
export const n2 = (v) => (v < 0 ? "" : " ") + v.toFixed(2);
export const n3 = (v) => v.toFixed(3);

/* --- how far one Play beat is ---------------------------------------------- *
 * Slow and Medium choreograph a step in two phases — the inputs the element
 * reads LIGHT, then the element LANDS. Fast declares that it does not: results
 * appear in place. A declared property of the chosen speed, never something
 * the animation decides mid-run. */
export const SPEEDS = [
  { value: "slow", label: "Slow", detail: "1.5 seconds an element, the inputs lit before the element lands" },
  { value: "medium", label: "Medium", detail: "0.75 seconds an element, the inputs lit before the element lands" },
  { value: "fast", label: "Fast", detail: "0.28 seconds an element, elements appearing in place" },
];
export const unitMs = (speed) => (speed === "slow" ? 1500 : speed === "fast" ? 280 : 750);
export const choreographs = (speed) => speed !== "fast";

/* --- the print, and the height it needs ------------------------------------ *
 * `height` is a function of the parameters and has no state to read, so the
 * line count of a print it must reserve room for is taken from the SHAPE with
 * a widest-case value in every slot: a four-decimal float is six characters,
 * seven with a sign, and at these shapes torch's 80-column rule wraps neither.
 * One function, two readers (5.8) — the drawing uses the real values. */
export const printRows = (shape) => widestPrint(shape).lines.length;

/* --- the stage's scale (main.js's decision 11) ------------------------------ *
 * One number per page, 0 at the 550 stage the mock drew and 1 at the 770 one
 * the side layout gives a wide viewport; every length that carries a value or
 * an image pixel is interpolated on it, and nothing that carries text is.
 *
 * IT LIVES HERE RATHER THAN IN `main.js` BECAUSE IT IS ARITHMETIC AND HAS A
 * SECOND READER (decision 15): `_lab/processing-layers-verify.mjs` asserts in
 * node that the Recurrent page's two bands stand on the same five columns, and
 * `main.js` cannot be imported there — it calls `defineWidget` at module scope.
 * `main.js` still lays every stage out and draws it. */

export const PAD = 14;           // widgets/tensors/main.js:469
const OP_W = 26;                 // the @, +, ∗ and = between two operands
export const CW = 46;            // a signed two-decimal float cell: five mono characters
const CH = 26;
const IW = 30;                   // a shaded feature cell, no digits
const PIX = 14;                  // an image pixel
const NODE_R = 16;
const ARROW_GAP = 40;            // the column an arrow between two grids sits in
const MAP_GAP = 18;              // between two feature maps, and their own labels

const W_BASE = 550;
const W_WIDE = 770;
const BASE = { cw: CW, ch: CH, iw: IW, pix: PIX, op: OP_W, nodeR: NODE_R, arrow: ARROW_GAP, mapGap: MAP_GAP };
const WIDE = { cw: 60, ch: 34, iw: 40, pix: 20, op: 34, nodeR: 22, arrow: 54, mapGap: 24 };

export function sizesAt(t) {
  const s = { t };
  for (const key of Object.keys(BASE)) s[key] = Math.round(BASE[key] + (WIDE[key] - BASE[key]) * t);
  return s;
}

/* A cell keeps its 550 proportions as it grows, so the four-character window
   cell and the five-character kernel cell stay in the ratio the mock fixed. */
export const scaledCell = (base, s) => Math.round((base * s.cw) / CW);

/**
 * The largest geometry whose widest band is inside the stage — MEASURED, from
 * the same function `draw` lays the band out with, rather than asserted from a
 * table of widths that would drift the first time a band changed. Floored at
 * the 550 geometry: below 550 the figure overruns exactly as it did before,
 * and shrinking the value cell further is where digits stop being readable.
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

/* ============================ 1 · Linear (cells 3-5) ======================= */

export const LIN_BATCH = 2;
export const LIN_IN = 4;

/** `nn.Linear(4, out)` on `torch.randn(2, 4)`: `y = x @ W.T + b`. */
export function linear(rng, out) {
  const X = normalMat(rng, LIN_BATCH, LIN_IN);
  const bound = initBound.linear(LIN_IN);            // kaiming_uniform_(a=√5) -> 1/√4
  const W = uniformMat(rng, out, LIN_IN, bound);
  const b = Array.from({ length: out }, () => uniform(rng, bound));
  const Y = X.map((row) => W.map((w, j) => dot(w, row) + b[j]));
  return {
    kind: "linear", out, X, W, b, Y, bound,
    units: LIN_BATCH * out,
    /* the four products the readout prints for y[i, j] */
    terms: (i, j) => X[i].map((x, k) => ({ x, w: W[j][k], product: x * W[j][k] })),
  };
}

/* ==================== 2 · Convolutional (cells 6-16) ======================= */

export const IMG_N = 16;
export const SQ_FROM = 5;
export const SQ_TO = 11;
/** Cell 8's `img[5:11, 5:11] = 1.0` — a 6 x 6 bright square in a 16 x 16 field. */
export const IMG = mat(IMG_N, IMG_N, (r, c) =>
  (r >= SQ_FROM && r < SQ_TO && c >= SQ_FROM && c < SQ_TO ? 1 : 0));

/* STRIDE IS FIXED AT 2 AND IS NOT A CONTROL (Kenneth's pick, mock §3). Drawn,
   stride 1 makes the feature map as large as the image: band 1 goes to 544 of
   550 and the stage to 710, and shrinking the map to fit puts a 7px pixel
   beside a 14px one, where the two grids stop reading as the same scale. */
export const STRIDE = 2;
/* `output_padding = 1` is cell 14's, and at stride 2 it is what makes the
   reconstruction exactly 16 x 16 for all four kernel/padding combinations:
   (8−1)·2−2+3+1, (7−1)·2−0+3+1, (7−1)·2−2+5+1 and (6−1)·2−0+5+1 are all 16. */
export const OUT_PAD = 1;

/** The value of the zero-padded input at a padded index, or 0 outside it. */
const padded = (r, c, p) => {
  const ri = r - p, ci = c - p;
  return ri >= 0 && ri < IMG_N && ci >= 0 && ci < IMG_N ? IMG[ri][ci] : 0;
};

/**
 * Cell 9's `Conv2d(1, 2, k, stride=2, padding=p)` and cell 14's
 * `ConvTranspose2d(2, 1, k, stride=2, padding=p, output_padding=1)` on what it
 * produced — one state, because the transposed half reads the standard half's
 * feature maps and the page switches between the two readings of one figure.
 */
export function conv(rng, k, p) {
  const cb = initBound.conv(1, k);                   // fan_in = 1 · k · k
  const kernels = [uniformMat(rng, k, k, cb), uniformMat(rng, k, k, cb)];
  const biases = [uniform(rng, cb), uniform(rng, cb)];
  const n = outSize(IMG_N, k, STRIDE, p);
  const maps = kernels.map((ker, f) => mat(n, n, (r, c) => {
    let acc = biases[f];
    for (let u = 0; u < k; u += 1) {
      for (let v = 0; v < k; v += 1) acc += padded(r * STRIDE + u, c * STRIDE + v, p) * ker[u][v];
    }
    return acc;
  }));

  const tb = initBound.conv(2, k);                   // fan_in = 2 · k · k
  const tw = [uniformMat(rng, k, k, tb), uniformMat(rng, k, k, tb)];
  const tbias = uniform(rng, tb);
  const zN = transposedOutSize(n, k, STRIDE, p, OUT_PAD);

  return {
    kind: "conv", k, p, n, zN, kernels, biases, maps, tw, tbias, cb, tb,
    /** The k x k patch of the padded input under the window at output (r, c). */
    window: (r, c) => mat(k, k, (u, v) => padded(r * STRIDE + u, c * STRIDE + v, p)),
    /** Which rows and columns of the unpadded image that window covers. */
    covers: (r, c) => {
      const lo = (i) => Math.max(0, i * STRIDE - p);
      const hi = (i) => Math.min(IMG_N - 1, i * STRIDE + k - 1 - p);
      return { rows: [lo(r), hi(r)], cols: [lo(c), hi(c)] };
    },
  };
}

/**
 * One output value written out: the kernel weights filter `f`'s window picks
 * out at (r, c), and the bias. The window holds 0 and 1 only, so a product is
 * the weight itself — but it is returned as a product anyway, because the band
 * draws `window ∗ kernel` and the assertion checks the multiplication (5.8).
 *
 * ADDED FOR BOTH FILTERS (round 1 of Kenneth's review): `f` was 0 everywhere
 * and the second kernel was never on screen.
 */
export const convTerms = (state, f, r, c) => {
  const win = state.window(r, c);
  const terms = [];
  for (let u = 0; u < state.k; u += 1) {
    for (let v = 0; v < state.k; v += 1) {
      if (win[u][v] !== 0) {
        terms.push({ x: win[u][v], w: state.kernels[f][u][v], product: win[u][v] * state.kernels[f][u][v] });
      }
    }
  }
  return { terms, bias: state.biases[f], value: state.maps[f][r][c] };
};

/**
 * What ONE input position adds to the patch of z it scatters into: both maps'
 * values through their own kernel, added. `ConvTranspose2d(2, 1, k)` holds a
 * `[2, 1, k, k]` weight — one kernel per INPUT map — so a patch cell is two
 * contributions, not one.
 */
export const patchTerms = (state, r, c, u, v) => {
  const terms = state.maps.map((m, ic) => ({
    map: ic, value: m[r][c], w: state.tw[ic][u][v], product: m[r][c] * state.tw[ic][u][v],
  }));
  return { terms, value: terms.reduce((s, t) => s + t.product, 0) };
};

/**
 * The reconstruction after the first `count` input positions have scattered,
 * in row order over the n x n map — both channels at each position, which is
 * what one step of the transposed page is. `count = n · n` is the whole of z.
 */
export function reconstruct(state, count) {
  const { k, p, n, zN, maps, tw, tbias } = state;
  const z = mat(zN, zN, () => tbias);
  const total = Math.min(count, n * n);
  for (let s = 0; s < total; s += 1) {
    const m = Math.floor(s / n), q = s % n;
    for (let ic = 0; ic < maps.length; ic += 1) {
      const val = maps[ic][m][q];
      for (let u = 0; u < k; u += 1) {
        for (let v = 0; v < k; v += 1) {
          const i = m * STRIDE - p + u, j = q * STRIDE - p + v;
          if (i >= 0 && i < zN && j >= 0 && j < zN) z[i][j] += val * tw[ic][u][v];
        }
      }
    }
  }
  return z;
}

/** `z − img`, and the position of the largest departure. */
export function difference(z) {
  const d = z.map((row, i) => row.map((v, j) => v - (IMG[i]?.[j] ?? 0)));
  let mr = 0, mc = 0;
  d.forEach((row, i) => row.forEach((v, j) => {
    if (Math.abs(v) > Math.abs(d[mr][mc])) { mr = i; mc = j; }
  }));
  return { d, mr, mc, max: Math.abs(d[mr][mc]) };
}

/* ====================== 3 · Recurrent (cells 17-19) ======================== */

export const RNN_BATCH = 2;
export const SEQ = 5;
export const RNN_IN = 4;
export const RNN_HID = 3;

/**
 * Cell 19's `[2, 5, 4]` through a recurrence with 3 hidden features, forward
 * and reverse. `f` is drawn CLOSED — the page shows what goes in and what
 * comes out, not the gates — so `tanh(W_x x_t + W_h h_{t−1} + b)` at the LSTM
 * initialiser's bound stands in for whichever of RNN, LSTM and GRU is named.
 * Both samples are computed, so `sample` can be a display parameter (3.2).
 */
export function recurrent(rng) {
  const X = Array.from({ length: RNN_BATCH }, () => normalMat(rng, SEQ, RNN_IN));
  const bound = initBound.recurrent(RNN_HID);        // 1/√hidden, on every weight
  const Wx = [uniformMat(rng, RNN_HID, RNN_IN, bound), uniformMat(rng, RNN_HID, RNN_IN, bound)];
  const Wh = [uniformMat(rng, RNN_HID, RNN_HID, bound), uniformMat(rng, RNN_HID, RNN_HID, bound)];
  const b = [
    Array.from({ length: RNN_HID }, () => uniform(rng, bound)),
    Array.from({ length: RNN_HID }, () => uniform(rng, bound)),
  ];
  const run = (seq, dir) => {
    const steps = dir === 0 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    let h = new Array(RNN_HID).fill(0);
    const out = new Array(SEQ);
    for (const t of steps) {
      h = Wx[dir].map((w, j) => Math.tanh(dot(w, seq[t]) + dot(Wh[dir][j], h) + b[dir][j]));
      out[t] = h;
    }
    return out;
  };
  const fwd = X.map((s) => run(s, 0));
  const rev = X.map((s) => run(s, 1));
  const y = fwd.map((f, s) => f.map((h, t) => [...h, ...rev[s][t]]));
  return { kind: "recurrent", X, Wx, Wh, b, fwd, rev, y, bound };
}

/** Which time step, and which direction, step `i` of the walk is (1-based). */
export const rnnStepAt = (i, bidirectional) => {
  if (!bidirectional) return { dir: 0, t: i - 1 };
  if (i <= SEQ) return { dir: 0, t: i - 1 };
  if (i <= 2 * SEQ) return { dir: 1, t: 2 * SEQ - i };
  return { dir: 2, t: null };                        // the concatenation
};

/* --- the page's two bands stand on one set of columns (decision 15) --------- *
 * Kenneth picked option B of `_lab/processing-layers-rnn.html`: his own
 * `figs/dl-layer-rnn-bi.png` as a diagram band ABOVE the value rows, with the
 * diagram's five columns on the value columns' own centres, so h³ in the
 * diagram is directly over the three numbers of h³ below. That alignment is
 * the reason he picked it, so it is arithmetic here rather than two
 * coincidences in the drawing, and the verify script asserts it in node. */

const RNN_GUT = 62;              // the row labels, left of the first cell — text, so fixed
const D_BOX_W = 40;              // an h box in the diagram
const D_BOX_H = 20;
const D_CIRC_R = 10;             // an x circle
const D_GAP = 24;                // between two diagram rows: the arrow between them
const D_TOP = 12;                // above the Forward row
const D_ELBOW = 14;              // the reverse pass's return line, under the chain
const D_OUT_GAP = 57;            // the arrow from the last hidden state into the Output box
const D_OUT_MIN = 16;            // …and the shortest that arrow is ever drawn
const D_OUT_W = 72;              // the Output box
const D_NOTE_DROP = 16;          // the band's own caption line, under the drawing
const D_NOTE_TAIL = 8;

/* The diagram band binds the page, not the value rows: the rows end at the
   last cell and the diagram carries the arrow into the Output box and the box
   past that — 522 of the 522 available at 550, which is why the arrow into the
   box is the length that gives if anything has to. */
const rnnWidest = (z) => RNN_GUT + (SEQ - 1) * (z.cw + z.op) + z.cw / 2
  + scaledCell(D_BOX_W, z) / 2 + scaledCell(D_OUT_GAP, z) + scaledCell(D_OUT_W, z);

/**
 * Where everything on the Recurrent page sits horizontally, and how tall the
 * diagram band is — pure arithmetic, at any stage width. `valueCentres` and
 * `diagramCentres` are computed by the two bands' own paths and must agree;
 * the band's caption line is measured in `main.js`, which has a canvas.
 */
export function rnnStage(w, bidirectional) {
  const s = fitSizes(w, rnnWidest);
  const pitch = s.cw + s.op;                         // one time step and the arrow after it
  const x0 = PAD + RNN_GUT;
  const valueLeft = Array.from({ length: SEQ }, (_, t) => x0 + t * pitch);
  const valueCentres = valueLeft.map((x) => x + s.cw / 2);
  const diagramCentres = Array.from({ length: SEQ }, (_, t) => x0 + t * pitch + s.cw / 2);
  const box = {
    w: scaledCell(D_BOX_W, s), h: scaledCell(D_BOX_H, s), r: scaledCell(D_CIRC_R, s),
  };
  const gap = scaledCell(D_GAP, s);
  const fwdTop = scaledCell(D_TOP, s);
  const xTop = fwdTop + box.h + gap;
  const revTop = xTop + 2 * box.r + gap;
  /* on unidirectional the diagram loses its Reverse row where the value rows
     lose theirs, and the Output box shortens with it */
  const bottom = bidirectional ? revTop + box.h : xTop + 2 * box.r;
  const lowest = bidirectional ? bottom + scaledCell(D_ELBOW, s) : bottom;
  /* THE ARROW INTO THE OUTPUT BOX IS THE LENGTH THAT GIVES. `fitSizes` is
     floored at the 550 geometry, and a stage narrower than 550 is ordinary —
     the page is tall enough to carry a scrollbar, which takes 15px of a 900
     viewport — so below 550 the band would run past the margin at the one
     place a reader would read as clipped. The arrow shortens instead: the
     pitch is what the diagram and the values share, and it is the last thing
     to touch. At 550 and above the fit already leaves the arrow its full
     length, so this clamp bites nowhere else. */
  const outW = scaledCell(D_OUT_W, s);
  const upTo = diagramCentres[SEQ - 1] + box.w / 2;
  const outX = upTo + Math.max(D_OUT_MIN,
    Math.min(scaledCell(D_OUT_GAP, s), w - PAD - outW - upTo));
  return {
    s,
    pitch,
    valueLeft,
    valueCentres,
    diagramCentres,
    box,
    fwdTop,
    xTop,
    revTop,
    bottom,
    lowest,
    outX,
    outW,
    right: outX + outW,
    noteY: lowest + D_NOTE_DROP,
    bandH: lowest + D_NOTE_DROP + D_NOTE_TAIL,
  };
}

/* ======================= 4 · Attention (cells 20-23) ======================= */

/** Cell 22's embeddings for "The", "cat", "sat". */
export const ATT_X = [
  [0.9, 0.1, 0.1, 0.1],
  [0.0, 0.2, 0.9, 0.0],
  [0.0, 0.0, 0.8, 0.1],
];
export const TOKENS = ["The", "cat", "sat"];
export const D_K = 4;

/**
 * THE COLUMNS OF EVERY VALUE GRID ON THE PAGE ARE THE EMBEDDING DIMENSIONS
 * (main.js decision 19). X, Q, K, V, the three product rows and the output row
 * all carry `embed_dim` columns and the same four of them, so the headers over
 * them are ONE list — the dimension indices — asked for by each of the four
 * header rows rather than counted to four in the drawing. Kenneth's round-3
 * question was what the columns of `w · v` mean, and the answer has to be the
 * same string over every grid or it is four answers.
 */
export const EMBED_HEADS = Array.from({ length: D_K }, (_, c) => String(c));

/**
 * `MultiheadAttention(embed_dim=4, num_heads=1)` on those three tokens. The
 * in-projection is one `[12, 4]` xavier draw, torch's own layout, split into
 * W_q, W_k and W_v; its bias is zero, which is torch's default.
 *
 * The figure stops at `softmax(QKᵀ / √d_k) V`, which is the formula card's
 * line and what band 2 sums. `out_proj` is the layer's next step and is not
 * drawn, so it is not drawn from the rng either — a weight nothing multiplies
 * would be a number with no reader.
 */
export function attention(rng, projection) {
  const bound = initBound.xavier(D_K, 3 * D_K);      // √(6/16) = 0.6124
  const inProj = uniformMat(rng, 3 * D_K, D_K, bound);
  const eye = mat(D_K, D_K, (r, c) => (r === c ? 1 : 0));
  const identity = projection === "identity";
  const [Wq, Wk, Wv] = identity
    ? [eye, eye, eye]
    : [inProj.slice(0, 4), inProj.slice(4, 8), inProj.slice(8, 12)];
  const Q = matmulT(ATT_X, Wq);
  const K = matmulT(ATT_X, Wk);
  const V = matmulT(ATT_X, Wv);
  const scale = Math.sqrt(D_K);
  const scores = Q.map((q) => K.map((k) => dot(q, k) / scale));
  const W = scores.map(softmax);
  const out = W.map((w) => V[0].map((_, c) => w.reduce((s, wi, j) => s + wi * V[j][c], 0)));
  return { kind: "attention", identity, Q, K, V, scores, W, out, bound, units: TOKENS.length };
}

/**
 * Where one score comes from: `q_i · k_j / √d_k`, as its four products, their
 * sum, and the division. The band writes this out under the scores grid and
 * the readout names the result, so the two read one function (5.8).
 */
export const attTerms = (state, i, j) => {
  const terms = state.Q[i].map((q, c) => ({ q, k: state.K[j][c], product: q * state.K[j][c] }));
  const dot = terms.reduce((s, t) => s + t.product, 0);
  return { terms, dot, scale: Math.sqrt(D_K), score: dot / Math.sqrt(D_K) };
};

/**
 * WHAT THE SUM MEANS (main.js decision 16): one query's three value rows each
 * scaled by its own weight, and the column-wise total of the three, which is
 * the output row. The weights sum to 1, so the total is a weighted average of
 * the three rows and lies between them.
 *
 * One function, two readers (5.8): band 2 draws these rows and the total, and
 * `_lab/processing-layers-verify.mjs` adds the rows up and checks they are the
 * output the rest of the page already prints.
 */
export const attProducts = (state, i) => {
  const rows = state.W[i].map((w, j) => ({ j, w, row: state.V[j].map((v) => w * v) }));
  const total = state.V[0].map((_, c) => rows.reduce((s, r) => s + r.row[c], 0));
  return { rows, total };
};

/** The plain mean of the three value rows — what a near-uniform weighting lands
    on, which is the Random page's caption and is asserted at every seed. */
export const attValueMean = (state) => state.V[0].map((_, c) => mean(state.V.map((r) => r[c])));

/* --- which query each step of the walk computes (main.js decision 22) -------- *
 * THE ORDER IS THE TOKENS' OWN AND ALWAYS HAS BEEN: Step is "Next query" and it
 * goes The, cat, sat, so the scores and weights grids fill row by row from the
 * top. The round-4 draft ROTATED the walk to whichever token had been clicked,
 * so that clicking cat gave cat, sat, The. Kenneth read the click as the
 * selector he had asked for rather than as a new starting point — "oh so it
 * plays thru all the queries? I thought I would get a selector?" — so the pick
 * became a display control, band 2 is pinned to it, and the walk went back to
 * the one order whose rule is on the screen.
 *
 * `order[k]` is the token step `k` computes, and `ordinal[t]` is the step token
 * `t` is computed at, which is what the grids and band 2 ask: is this row drawn
 * yet. Both are the identity, and the two names stay because the drawing asks
 * for them by name in both directions — and because a walk that stops being the
 * token order has one place to say so rather than two.
 *
 * It is arithmetic with a second reader, so it lives here (decision 15's
 * reasoning): `_lab/processing-layers-verify.mjs` reads the order back in node,
 * where `main.js` cannot be imported.
 */
export function attnWalk() {
  const order = TOKENS.map((_, i) => i);
  const ordinal = TOKENS.map((_, t) => order.indexOf(t));
  return { order, ordinal };
}

/* --- the Attention page's columns, and the rows a query is picked from ------- *
 * BAND 2 BINDS THE PAGE (main.js decision 16): a weight cell, the key token,
 * the four values, the operator column and the four products is nine cells and
 * one operator wide. The constants below are the ones that decide a COLUMN, so
 * they sit with the fit rather than with the drawing, and `attnStage` computes
 * the three query rows' rectangles from them — once, for the drawing and for
 * the region map alike (5.8). Nothing in a picture says whether a target sits
 * where the row is drawn, so the verify script reads the rectangles back. */
export const ATT_TOK = 30;       // the query token, in a gutter left of a labelled grid
export const ATT_SOFT = 60;      // the softmax arrow between scores and weights
/* BAND 2'S ROW LABEL IS THE KEY TOKEN ALONE (main.js decision 16). The pair
   `cat–The` took 54, and the row carries its product row as well: label, values
   and products measured 538 against the 522 available at the 550 stage. */
export const ATT_ROWLAB = 30;
export const ATT_DOT = 22;       // the · between the weight and the value row
/* X'S BOTTOM EDGE TO Q AND K, and what has to fit in it (main.js decision 20):
   the elbows' stem, the rail, the drop, and inside the drop the `Q [3, 4]` line
   and the column-header row. It was 34 while the connectors were diagonals with
   nothing but a label under them. */
export const ATT_GAP_QK = 48;
export const ATT_GAP_SC = 34;    // the grid's name, and the key tokens over its columns

export const attnWidest = (z) => Math.max(
  8 * z.cw + z.op,
  2 * ATT_TOK + 6 * z.cw + ATT_SOFT,
  9 * z.cw + z.op + 8 + ATT_ROWLAB + ATT_DOT);

/**
 * Where every column of the Attention page sits, and the rectangle of each
 * token's row in the three places a query can be picked from: its row of X in
 * band 1, and its row label in the gutter of the scores grid and of the weights
 * grid. `xTop` is X's own grid top, which `main.js` owns because the band
 * header and the name line above it are shared by all five pages.
 *
 * `main.js` lays band 1 out from what this returns, so a target cannot drift
 * from the row it names, and `regions` builds one target per row from `rows`.
 */
export function attnStage(w, xTop) {
  const s = fitSizes(w, attnWidest);
  const gw = 4 * s.cw;                     // a four-dimension value grid
  const sw = 3 * s.cw;                     // a 3 x 3 scores or weights grid
  const xBot = xTop + 3 * s.ch;
  const qy = xBot + ATT_GAP_QK;            // Q and K, under the elbows
  const kx = PAD + gw + s.op;
  const sy = qy + 3 * s.ch + ATT_GAP_SC;   // the scores and weights grids
  const sx = PAD + ATT_TOK;
  const wx = sx + sw + ATT_SOFT + ATT_TOK;
  const rows = [];
  for (let i = 0; i < TOKENS.length; i += 1) {
    const query = TOKENS[i];
    rows.push({ kind: "x", i, query, x: PAD, y: xTop + i * s.ch, w: gw, h: s.ch });
    rows.push({ kind: "scores", i, query, x: sx - ATT_TOK, y: sy + i * s.ch, w: ATT_TOK, h: s.ch });
    rows.push({ kind: "weights", i, query, x: wx - ATT_TOK, y: sy + i * s.ch, w: ATT_TOK, h: s.ch });
  }
  return { s, gw, sw, xTop, xBot, qy, kx, sy, sx, wx, rows };
}

/* ========================= 5 · Graph (cells 24-28) ========================= */

export const NODES = 4;
export const GRAPH_IN = 3;
/** Cell 27's `edge_index` for the undirected chain 0-1-2-3: six directed edges. */
export const EDGE_INDEX = [[0, 1, 1, 2, 2, 3], [1, 0, 2, 1, 3, 2]];
/** The adjacency GCNConv works on, self-loops added: d̂ = 2, 3, 3, 2. */
export const ADJ = mat(NODES, NODES, (i, j) => (i === j || Math.abs(i - j) === 1 ? 1 : 0));
export const DEG = ADJ.map((row) => row.reduce((a, b) => a + b, 0));
export const neighbours = (i) => ADJ[i].map((a, j) => (a ? j : -1)).filter((j) => j >= 0);

export const AGGREGATES = [
  { value: "normalized-sum", label: "Normalized sum", detail: "each neighbour weighted by 1/√(d̂ᵢ d̂ⱼ), the GCNConv aggregate" },
  { value: "mean", label: "Mean", detail: "the average over the neighbours and the node itself" },
  { value: "max", label: "Max", detail: "the largest value at each feature, over the neighbours and the node itself" },
];

/**
 * Cell 27's `GCNConv(3, 3)` on four nodes of three features. The coefficients
 * are worth printing and DO NOT sum to one: with self-loops an endpoint
 * weights itself 0.500 and an interior node 0.333, with 0.408 between them, so
 * the row sums are 0.908 at the ends and 1.075 inside. Max applies no
 * coefficients, so it has none to print.
 */
export function graph(rng, aggregate) {
  const X = normalMat(rng, NODES, GRAPH_IN);
  const bound = initBound.xavier(GRAPH_IN, GRAPH_IN);   // glorot on [3, 3] -> 1
  const W = uniformMat(rng, GRAPH_IN, GRAPH_IN, bound);
  const coef = aggregate === "max" ? null : mat(NODES, NODES, (i, j) => {
    if (!ADJ[i][j]) return 0;
    return aggregate === "mean" ? 1 / DEG[i] : 1 / Math.sqrt(DEG[i] * DEG[j]);
  });
  const agg = mat(NODES, GRAPH_IN, (i, f) => (coef
    ? coef[i].reduce((s, c, j) => s + c * X[j][f], 0)
    : Math.max(...neighbours(i).map((j) => X[j][f]))));
  const out = agg.map((a) => W.map((w) => dot(w, a)));
  return { kind: "graph", aggregate, X, W, coef, agg, out, bound, units: NODES };
}

/**
 * Node `i`'s aggregate at feature `f`, written out — every neighbour it reads,
 * the coefficient applied to it and the node feature it multiplies, or the
 * values Max chooses between. Added at round 1 of Kenneth's review: the strips
 * are shaded and carry no digits, so without this the path from the printed X
 * to the printed output is not on screen anywhere.
 */
/* --- which node is which row of the tensor (main.js decision 17) ------------ *
 * The strips carry no digits and the print carries no picture, so the two are
 * joined by a KEY rather than by position: ONE string per node, worn by its
 * strip, its circle and its row of the print. That is `tensors`' own idiom (its
 * decision 10, "the drawing and the print are hit-tested as one"), and it is
 * what lets a pointer anywhere light the other two.
 *
 * It is arithmetic and it has a second reader, so it lives here rather than in
 * `main.js`: `_lab/processing-layers-verify.mjs` reads the keys back in node,
 * where no pixel and no pointer exists, and `main.js` cannot be imported there.
 */

export const nodeKey = (i) => `node ${i}`;

/** The widest gutter label, for the measurement the gutter's width is taken from. */
export const NODE_GUTTER = nodeKey(NODES - 1);

/**
 * WHICH BANDS PRINT A NODE-ROWED TENSOR, in the order they are drawn and under
 * the name their strips and their readout tile already use. Every entry is a
 * `[4, 3]`: one row per node, so it takes the node gutter and one row of the
 * hit plan per node.
 *
 * THE AGGREGATE BAND JOINED THEM AT ROUND 4 (main.js decision 18) and `W` left
 * them. `W` printed under Aggregate from round 1, where Kenneth read it as the
 * thing the step changes; it is the layer's one weight matrix, its rows are
 * features rather than nodes, and it is applied in the Output band, so it
 * prints there and carries neither gutter nor key.
 */
export const NODE_PRINTS = ["X", "aggregate", "h'"];

/**
 * Which printed LINE each leading index of a rank-2 print sits on, and how many
 * characters wide the block is. At `[4, 3]` it is one row a line — but that is
 * torch's bracket rule rather than a coincidence to rely on, so both are read
 * off the segments, with the widest-case value `printRows` uses.
 */
const widestPrint = (shape) => torchPrint(shape, () => "-0.0000");

export function printRowLines(shape) {
  const at = new Map();
  widestPrint(shape).lines.forEach((segs, li) => {
    for (const seg of segs) if (seg.idx && !at.has(seg.idx[0])) at.set(seg.idx[0], li);
  });
  return Array.from({ length: shape[0] }, (_, r) => at.get(r) ?? 0);
}

export const printCols = (shape) => widestPrint(shape).cols;

/**
 * Every surface node `i` can be pointed at, each under `nodeKey(i)`: its strip
 * and its circle in every band, and its row of the print where a band prints
 * one. Handed each band's own arithmetic rather than computing it, so the
 * drawing and the hit plan cannot disagree (5.8).
 *
 * A band is `{ stripLeft, stripY, stripW, stripH, nodeCX, nodeY, nodeR }` and,
 * where it prints node rows, `print: { x, y, w, lineH, lines }`.
 */
export function graphTargets(bands) {
  const out = [];
  bands.forEach((b, band) => {
    for (let i = 0; i < NODES; i += 1) {
      const key = nodeKey(i);
      out.push({
        kind: "strip", band, node: i, key,
        x: b.stripLeft[i], y: b.stripY, w: b.stripW, h: b.stripH,
      });
      out.push({
        kind: "circle", band, node: i, key,
        x: b.nodeCX[i] - b.nodeR, y: b.nodeY - b.nodeR, w: 2 * b.nodeR, h: 2 * b.nodeR,
      });
      if (b.print) {
        out.push({
          kind: "print", band, node: i, key,
          x: b.print.x, y: b.print.y + b.print.lines[i] * b.print.lineH,
          w: b.print.w, h: b.print.lineH,
        });
      }
    }
  });
  return out;
}

/** The surface under the pointer, or null — half-open bounds, last match wins,
    which is what `core/canvas.js`'s own `hitTest` does. */
export function graphHit(targets, pointer) {
  if (!pointer) return null;
  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const t = targets[i];
    if (pointer.x >= t.x && pointer.x < t.x + t.w
      && pointer.y >= t.y && pointer.y < t.y + t.h) return t;
  }
  return null;
}

export const aggTerms = (state, i, f) => {
  const nb = neighbours(i);
  if (!state.coef) {
    return { kind: "max", terms: nb.map((j) => ({ j, x: state.X[j][f] })), value: state.agg[i][f] };
  }
  return {
    kind: "sum",
    terms: nb.map((j) => ({
      j, coef: state.coef[i][j], x: state.X[j][f], product: state.coef[i][j] * state.X[j][f],
    })),
    value: state.agg[i][f],
  };
};
