/* ============================================================================
   Widget 49 · Processing Layers — which inputs each output reads, and whether
   the weights are shared across positions.

   PHM5005 05-3 cells 1-28, five pages in cell 1's own order: Linear,
   Convolutional, Recurrent, Attention, Graph. `model.js` carries the
   arithmetic; this file draws it and nothing else.

   THE MISCONCEPTION IS THAT THE LAYERS DIFFER IN THEIR ARITHMETIC. They do
   not: every one of them is weighted sums. What differs is which inputs an
   output is allowed to see and whether one set of weights serves every
   position. So the device on every page is the same — STEP COMPUTES ONE
   OUTPUT ELEMENT AND LIGHTS WHAT THAT ELEMENT READ — and what changes from
   page to page is the shape of what lights up.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE GEOMETRY OF RECORD. `_lab/processing-layers-mock.html`
       drew all seven picks to scale at the 550px stage and Kenneth took the
       recommendation on every one (2026-09-10). Every band width, cell size,
       gap and label offset below is the mock's; the constants at the top are
       the ones `widgets/tensors/main.js` uses, so a cell means the same thing
       on both widgets.

    2. THE DRAWING IS NOT SHARED WITH `tensors`. `txt`, `arrow`, `band`,
       `cell`, `grid` and `shaded` are the same idiom written again here,
       deliberately: drawing is geometry and belongs to the file that lays out
       the stage. What IS shared is `core/torch.js` — the print, the output-size
       rules and the initialiser bounds — because those are one formula each
       (5.8).

    3. NOTHING IS TRAINED, AND THE CAPTION ON EVERY PAGE SAYS SO. The weights
       are one draw from the bound PyTorch's own `reset_parameters` uses, so an
       untrained figure carries the magnitudes a real layer prints.

    4. THE STAGE HEIGHT IS A FUNCTION OF THE PARAMETERS (`bayesian`'s
       precedent, `tensors` decision 20). Every band is as tall as its content
       and the caption block is as tall as the lines it wraps to, so a page
       with three bands and a page with two do not both pay for three.
       `pageHeight` and `draw` ask the same geometry functions (5.8).

    5. STRIDE IS FIXED AT 2 AND IS NOT A CONTROL (Kenneth's pick, mock §3).
       The reason is in `model.js`.

    6. `pos` IS A DATA PARAMETER AND THE WALK RESTARTS AT IT. Clicking a
       feature-map cell is the fast way to reach a position; it cannot be a
       display parameter, because the animation may not write to a parameter
       (invariant 1) and `pos` and Step would then both name "the position
       being computed". A click re-inits the walk with that position last, so
       the URL and the screen agree at the moment of the click.

    7. `seed` IS OFFERED ON THE ATTENTION PAGE AT THE RANDOM PROJECTION ALONE.
       That is the only place where changing the draw is the argument — the
       measured finding is that no seed in twenty makes attention select
       anything at initialisation. At the identity projection Q = K = V = X and
       nothing is drawn, so the control would be a question the reader has to
       rule out before the figure gets attention (3.4b).

    8. WHERE THE RESULT IS PRINTED, AND WHERE IT IS NOT. Linear prints `y` and
       Graph prints its output, both under the drawing, through `torchPrint`.
       The other three do not: a convolution's result is a [1, 2, 8, 8] and a
       recurrence's a [2, 5, 6], each several stage-heights of text, and
       attention's 3 x 3 weight grid already carries all nine values as
       numbers, so a print beside it would be the same nine twice.

    9. THE HOVER IS AN INSPECTOR AND LIVES IN THE READOUT, as it does on
       `tensors` (its decision 4): `draw` runs immediately before `readout` in
       core's paint, so the cell resolved during the draw is still current one
       line later. Nothing lives only on hover — the graph's shaded strips and
       the convolution's image are the two figures whose cells carry no digits,
       and both have their values in a readout tile of their own.

   10. THE BAND EXPRESSION IS `--c-highlight`, MONO, RIGHT-ALIGNED, which is
       what `tensors` does and what the mock drew in `--ink-3`. The sibling
       won: ink-3 is under the 4.5:1 floor (tensors round 21), and a reader
       moving between the two widgets should meet one convention.
   ========================================================================= */

import {
  defineWidget, readTokens, mathmlRenders,
  shapeText, sizeText, num, torchFloatFormat, torchPrint, outSize, transposedOutSize,
} from "../core/index.js";
import * as M from "./model.js";

/* A canvas of this module's own, for the measurements `height` and `regions`
   need and core hands neither: `measureText` reads the font and ignores the
   transform, so this gives the same character width the figure is laid out
   with. Created once, on first use, and never painted. */
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  return measureCanvas;
}

/* --- geometry, all of it the mock's ---------------------------------------- */

const PAD = 14;           // widgets/tensors/main.js:469
const OP_W = 26;          // the @, +, ∗ and = between two operands
const CW = 46;            // a signed two-decimal float cell: five mono characters
const CH = 26;
const IW = 30;            // a shaded feature cell, no digits
const PIX = 14;           // an image pixel
const HLW = 2.5;          // the --c-highlight frame
const NODE_R = 16;

const BAND_HEAD = 26;     // a band's name, its expression and the hairline under
const BAND_GAP = 20;      // between two bands
const LBL = 16;           // the `x  [2, 4]` line above a grid
const CAP_GAP = 16;       // between the last band and the caption block
const CAPTION_H = 17;
const PRINT_LH = 16;
const PRINT_DROP = 12;

const WASH = 0.16;        // a cell's fill
const LIT_A = 0.50;       // the lit face, `tensors`' litFace

/* --- one step, two phases (tensors' round 10) ------------------------------- *
 * Slow and Medium stage a step: the inputs the element reads LIGHT, then the
 * element LANDS — two changes one after the other are two the eye can follow
 * (Heer & Robertson 2007). Fast declares that it does not choreograph, so
 * elements appear in place. */
const SPLIT = 150 / 450;
const c01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - (1 - t) ** 3;

/* --- primitives ------------------------------------------------------------ */

function txt(ctx, colors, s, x, y, o = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "", fit = 0,
  } = o;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const scale = [colors.fsLg, colors.fsMd, colors.fsSm, colors.fsXs];
  let sized = size;
  ctx.font = `${weight} ${sized} ${mono ? colors.mono : colors.font}`.trim();
  if (fit) {
    let i = Math.max(0, scale.indexOf(size));
    while (ctx.measureText(s).width > fit && i < scale.length - 1) {
      i += 1;
      sized = scale[i];
      ctx.font = `${weight} ${sized} ${mono ? colors.mono : colors.font}`.trim();
    }
  }
  ctx.fillText(s, x, y);
}

function arrow(ctx, x0, y0, x1, y1, color, width = 1.5, dash = [], head = 9) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** A colour at an alpha, as a fill string. Tokens resolve to hex. */
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};

/** The lit face every page shares: the highlight wash with a bold digit, so a
    lit cell differs from a plain one in lightness and weight, not hue alone. */
const litFace = (colors, a = 1) => ({
  fill: wash(colors.highlight, WASH + (LIT_A - WASH) * a), lit: true, bold: true,
});

/** A band's header: its name left, the expression it performs right, a
    hairline under, and the top of its content returned. */
function band(ctx, colors, y, w, name, expr) {
  txt(ctx, colors, name, PAD, y + 11, { color: colors.ink1, weight: "600" });
  if (expr) {
    txt(ctx, colors, expr, w - PAD, y + 11,
      { color: colors.highlight, align: "right", mono: true });
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 17.5);
  ctx.lineTo(w - PAD, y + 17.5);
  ctx.stroke();
  return y + BAND_HEAD;
}

function cell(ctx, colors, x, y, cw, ch, text, o = {}) {
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, cw, ch);
  if (!o.empty) {
    ctx.fillStyle = o.fill ?? wash(o.hue ?? colors.groupA, WASH);
    ctx.fillRect(x, y, cw, ch);
  }
  ctx.strokeStyle = o.lit ? colors.highlight : colors.axis;
  ctx.lineWidth = o.lit ? HLW : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
  if (text != null && text !== "") {
    txt(ctx, colors, text, x + cw / 2, y + ch / 2 + 0.5, {
      color: colors.ink1, align: "center", baseline: "middle", mono: true,
      size: o.size ?? colors.fsSm, weight: o.lit || o.bold ? "600" : "", fit: cw - 6,
    });
  }
}

/** A grid of value cells; `at(r, c)` gives `{ text, hue, lit, fill, empty }`. */
function grid(ctx, colors, x, y, rows, cols, cw, ch, at) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const s = at(r, c) ?? {};
      cell(ctx, colors, x + c * cw, y + r * ch, cw, ch, s.text, s);
    }
  }
}

/** A frame over a grid — the red window of Kenneth's figures. */
function frame(ctx, x, y, w, h, color, lw = HLW, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.strokeRect(x - lw / 2, y - lw / 2, w + lw, h + lw);
  ctx.setLineDash([]);
}

function op(ctx, colors, x, y, h, s) {
  txt(ctx, colors, s, x + OP_W / 2, y + h / 2 + 1,
    { color: colors.ink1, align: "center", baseline: "middle", size: colors.fsLg });
}

/** `x  [2, 4]` above a grid, in the mono font. */
function label(ctx, colors, x, y, name, shape, color) {
  txt(ctx, colors, shape ? `${name}  ${shapeText(shape)}` : name, x, y,
    { color: color ?? colors.ink1, mono: true });
}

/** Shading against a centre: below is --c-value-low, above --c-value-high. */
const signedFill = (colors, v, centre, span) => {
  const t = Math.max(-1, Math.min(1, span > 0 ? (v - centre) / span : 0));
  return t >= 0
    ? wash(colors.valueHigh, 0.05 + 0.8 * t)
    : wash(colors.valueLow, 0.05 + 0.8 * -t);
};
const plainFill = (hue, v) => wash(hue, 0.05 + 0.8 * Math.max(0, Math.min(1, v)));

/** A shaded grid with no text — an image, as `imshow` draws it. */
function shaded(ctx, colors, x, y, rows, cols, p, fillAt) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = colors.surface;
      ctx.fillRect(x + c * p, y + r * p, p, p);
      const f = fillAt(r, c);
      if (f) {
        ctx.fillStyle = f;
        ctx.fillRect(x + c * p, y + r * p, p, p);
      }
    }
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * p + 0.25);
    ctx.lineTo(x + cols * p, y + r * p + 0.25);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(x + c * p + 0.25, y);
    ctx.lineTo(x + c * p + 0.25, y + rows * p);
    ctx.stroke();
  }
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cols * p - 1, rows * p - 1);
}

/**
 * A tensor as torch prints it, under the drawing that holds the same values.
 *
 * Painted SEGMENT BY SEGMENT rather than line by line, because a half-built
 * result must print half a result: a value the walk has not reached is drawn
 * as nothing at all, in a slot whose width was measured over EVERY value, so
 * the block never shifts under the reader as it fills. Printing an unreached
 * value as 0.0000 would be the figure claiming a number it has not computed.
 */
function printBlock(ctx, colors, x, y, shape, valueAt, placed) {
  const fmt = torchFloatFormat(valuesOf(shape, valueAt));
  const p = torchPrint(shape, (idx) => fmt(valueAt(idx)));
  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  const cw = ctx.measureText("0000000000").width / 10;
  ctx.restore();
  p.lines.forEach((segs, li) => {
    let col = 0;
    for (const seg of segs) {
      const sx = x + col * cw;
      col += seg.s.length;
      if (!seg.s.trim()) continue;
      if (seg.idx && placed && !placed(seg.idx)) continue;
      txt(ctx, colors, seg.s, sx, y + li * PRINT_LH,
        { color: colors.ink2, mono: true, baseline: "top" });
    }
  });
}

/** Every value of a rank-2 shape, for the format the whole tensor prints in. */
const valuesOf = ([rows, cols], at) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => at([r, c]))).flat();

/** One line at a time, wrapped to the width it is given. */
function wrapLines(ctx, colors, text, maxW) {
  ctx.font = `${colors.fsSm} ${colors.font}`;
  const out = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/* --- the hover inspector ---------------------------------------------------- *
 * Each draw pushes the grids it laid out; the pointer resolves against them
 * after the paint, and the readout reads the answer one line later. */
let spots = [];
let hovered = null;
const spotGrid = (x, y, rows, cols, cw, ch, at) => spots.push({ x, y, rows, cols, cw, ch, at });

function hitSpots(pointer) {
  if (!pointer) return null;
  for (let i = spots.length - 1; i >= 0; i -= 1) {
    const s = spots[i];
    const c = Math.floor((pointer.x - s.x) / s.cw);
    const r = Math.floor((pointer.y - s.y) / s.ch);
    if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) continue;
    const t = s.at(r, c);
    if (t) return t;
  }
  return null;
}

/* --- where the walk stands -------------------------------------------------- *
 * One function, because the drawing and the readout must agree about it (5.8).
 * `idx` is the element in flight, or the last one landed; `done` is how many
 * are fully drawn; `light` and `land` are the two phases of the one in flight. */
function walkAt(anim, state, params) {
  const moving = Boolean(anim) && anim.beat > 0 && anim.n < state.units;
  const n = anim?.n ?? 0;
  if (!M.choreographs(params.speed)) {
    return { idx: moving ? n : n - 1, done: n, moving, light: 1, land: 1 };
  }
  const beat = anim?.beat ?? 0;
  return {
    idx: moving ? n : n - 1,
    done: n,
    moving,
    light: moving ? c01(beat / SPLIT) : 1,
    land: moving ? easeOut(c01((beat - SPLIT) / (1 - SPLIT))) : 1,
  };
}

/** How a result cell at ordinal `k` is drawn: solid, arriving, or absent. */
const arrival = (walk, k) => {
  if (k < walk.done) return 1;
  if (walk.moving && k === walk.idx) return walk.land;
  return 0;
};

/* ============================ 1 · Linear =================================== */

function linearGeom(ctx, colors, w, params) {
  const out = Number(params.out);
  const rows1 = Math.max(M.LIN_BATCH, out);
  const h1 = LBL + rows1 * CH;
  const h2 = LBL + M.LIN_BATCH * CH + PRINT_DROP + M.printRows([M.LIN_BATCH, out]) * PRINT_LH;
  const y1 = 0;
  const y2 = BAND_HEAD + h1 + BAND_GAP;
  const capY = y2 + BAND_HEAD + h2 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return { out, h1, h2, y1, y2, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
}

function drawLinear(ctx, colors, w, params, state, anim) {
  const g = linearGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { out } = g;
  const lit = walk.idx >= 0 ? { i: Math.floor(walk.idx / out), j: walk.idx % out } : null;
  const face = (on) => (on ? litFace(colors, walk.light) : {});

  let y = band(ctx, colors, g.y1, w, "Operands", "x @ W.T + b");
  label(ctx, colors, PAD, y + 11, "x", [M.LIN_BATCH, M.LIN_IN]);
  grid(ctx, colors, PAD, y + LBL, M.LIN_BATCH, M.LIN_IN, CW, CH, (r, c) =>
    ({ text: M.n2(state.X[r][c]), hue: colors.groupA, ...face(lit && r === lit.i) }));
  spotGrid(PAD, y + LBL, M.LIN_BATCH, M.LIN_IN, CW, CH,
    (r, c) => `x[${r}, ${c}] = ${num(state.X[r][c])}`);
  op(ctx, colors, PAD + 4 * CW, y + LBL, M.LIN_BATCH * CH, "@");

  const wx = PAD + 4 * CW + OP_W;
  label(ctx, colors, wx, y + 11, "W", [out, M.LIN_IN]);
  grid(ctx, colors, wx, y + LBL, out, M.LIN_IN, CW, CH, (r, c) =>
    ({ text: M.n2(state.W[r][c]), hue: colors.groupB, ...face(lit && r === lit.j) }));
  spotGrid(wx, y + LBL, out, M.LIN_IN, CW, CH,
    (r, c) => `W[${r}, ${c}] = ${num(state.W[r][c])}`);
  op(ctx, colors, wx + 4 * CW, y + LBL, out * CH, "+");

  const bx = wx + 4 * CW + OP_W;
  label(ctx, colors, bx, y + 11, "b", [out]);
  grid(ctx, colors, bx, y + LBL, out, 1, CW, CH, (r) =>
    ({ text: M.n2(state.b[r]), hue: colors.groupB, ...face(lit && r === lit.j) }));
  spotGrid(bx, y + LBL, out, 1, CW, CH, (r) => `b[${r}] = ${num(state.b[r])}`);

  y = band(ctx, colors, g.y2, w, "Result", "y = x @ W.T + b");
  label(ctx, colors, PAD, y + 11, "y", [M.LIN_BATCH, out]);
  grid(ctx, colors, PAD, y + LBL, M.LIN_BATCH, out, CW, CH, (r, c) => {
    const a = arrival(walk, r * out + c);
    if (a === 0) return { empty: true };
    const on = lit && r === lit.i && c === lit.j;
    return on
      ? { text: M.n2(state.Y[r][c]), ...litFace(colors, a) }
      : { text: M.n2(state.Y[r][c]), fill: wash(colors.empirical, WASH) };
  });
  spotGrid(PAD, y + LBL, M.LIN_BATCH, out, CW, CH, (r, c) =>
    (r * out + c < walk.done ? `y[${r}, ${c}] = ${num(state.Y[r][c])}` : null));
  if (walk.done > 0) {
    printBlock(ctx, colors, PAD, y + LBL + M.LIN_BATCH * CH + PRINT_DROP,
      [M.LIN_BATCH, out], ([r, c]) => state.Y[r][c], ([r, c]) => r * out + c < walk.done);
  }
  return g;
}

/* ========================= 2 · Convolutional =============================== */

/* Band 2 holds a k x k window, a k x k kernel and the sum cell, and at k = 5
   the 46px cell runs 34px past the 550 stage. The window's cells hold `0.00`
   and `1.00`, four characters, so they are the ones that give first. */
const winCell = (k) => (k === 5 ? 36 : 40);
const kerCell = (k) => (k === 5 ? 44 : CW);
const scatterCell = (k) => (k === 5 ? 42 : CW);
const MAP_GAP = 18;

function convGeom(ctx, colors, w, params) {
  const k = Number(params.k);
  const p = Number(params.pad);
  const transposed = params.conv === "transposed";
  const n = outSize(M.IMG_N, k, M.STRIDE, p);
  const zN = transposedOutSize(n, k, M.STRIDE, p, M.OUT_PAD);
  const padN = M.IMG_N + 2 * p;
  /* THE DIFFERENCE'S OWN LINE SITS UNDER THE GRIDS, NOT BESIDE THEM. Beside,
     `largest |z − img| = 1.42` starts at x 402 with z where the maps leave it
     and runs 10px past the 550 stage; the mock had room for it there because
     its reveal panel drew z alone at the left margin. One line of band, and
     only while the reveal is on. */
  const noteH = transposed && params.trueimage === "1" ? PRINT_LH + 6 : 0;
  const h1 = transposed
    ? LBL + Math.max(2 * n * PIX + 10, zN * PIX) + noteH
    : LBL + Math.max(padN * PIX, 2 * n * PIX + MAP_GAP);
  const h2 = LBL + k * CH + 22;
  const y1 = 0;
  const y2 = BAND_HEAD + h1 + BAND_GAP;
  const capY = y2 + BAND_HEAD + h2 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  /* where the clickable feature-map cells sit, for `regions` and for `draw` */
  const mapX = transposed ? PAD : PAD + padN * PIX + 40;
  const mapY = y1 + BAND_HEAD + LBL;
  const mapStep = transposed ? n * PIX + 10 : n * PIX + MAP_GAP;
  return {
    k, p, n, zN, padN, transposed, h1, h2, y1, y2, capY, caps,
    mapX, mapY, mapStep, height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawConv(ctx, colors, w, params, state, anim) {
  const g = convGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { k, p, n, zN, padN, transposed } = g;
  const pr = walk.idx >= 0 ? Math.floor(walk.idx / n) : -1;
  const pc = walk.idx >= 0 ? walk.idx % n : -1;
  const spans = state.maps.map((m, f) =>
    Math.max(...m.flat().map((v) => Math.abs(v - state.biases[f]))) || 1);

  if (!transposed) {
    let y = band(ctx, colors, g.y1, w, "Input and feature maps", "conv2d(x)");
    label(ctx, colors, PAD, y + 11, p > 0 ? "Padded input" : "Input", [padN, padN]);
    shaded(ctx, colors, PAD, y + LBL, padN, padN, PIX, (r, c) => {
      const ri = r - p, ci = c - p;
      const inside = ri >= 0 && ri < M.IMG_N && ci >= 0 && ci < M.IMG_N;
      return inside ? plainFill(colors.groupA, M.IMG[ri][ci]) : null;
    });
    spotGrid(PAD, y + LBL, padN, padN, PIX, PIX, (r, c) => {
      const ri = r - p, ci = c - p;
      return ri >= 0 && ri < M.IMG_N && ci >= 0 && ci < M.IMG_N
        ? `img[${ri}, ${ci}] = ${M.IMG[ri][ci].toFixed(2)}`
        : "a padded zero, outside the image";
    });
    if (p > 0) {
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(PAD + 0.5, y + LBL + 0.5, padN * PIX - 1, padN * PIX - 1);
      ctx.setLineDash([]);
      ctx.strokeStyle = colors.axis;
      ctx.strokeRect(PAD + p * PIX + 0.5, y + LBL + p * PIX + 0.5,
        M.IMG_N * PIX - 1, M.IMG_N * PIX - 1);
    }
    if (pr >= 0) {
      frame(ctx, PAD + pc * M.STRIDE * PIX, y + LBL + pr * M.STRIDE * PIX,
        k * PIX, k * PIX, colors.highlight);
    }
    arrow(ctx, PAD + padN * PIX + 8, y + LBL + padN * PIX / 2,
      PAD + padN * PIX + 34, y + LBL + padN * PIX / 2, colors.ink3, 2);

    /* the shape rides on each filter's own label: one `Feature maps [2, 8, 8]`
       line above them sat on exactly the baseline `filter 1` uses */
    for (let f = 0; f < 2; f += 1) {
      const my = g.mapY + f * g.mapStep;
      label(ctx, colors, g.mapX, my - 5, `filter ${f + 1}`, [n, n], colors.ink2);
      shaded(ctx, colors, g.mapX, my, n, n, PIX, (r, c) => {
        const a = arrival(walk, r * n + c);
        return a === 0 ? null : signedFill(colors, state.maps[f][r][c], state.biases[f], spans[f]);
      });
      spotGrid(g.mapX, my, n, n, PIX, PIX, (r, c) =>
        (r * n + c < walk.done
          ? `y[0, ${f}, ${r}, ${c}] = ${num(state.maps[f][r][c])}`
          : `y[0, ${f}, ${r}, ${c}], not computed yet`));
      if (f === 0 && pr >= 0) frame(ctx, g.mapX + pc * PIX, my + pr * PIX, PIX, PIX, colors.highlight);
    }

    y = band(ctx, colors, g.y2, w, "One output value",
      pr >= 0 ? `y[0, 0, ${pr}, ${pc}]` : "y[0, 0, · , · ]");
    const win = pr >= 0 ? state.window(pr, pc) : null;
    const wcw = winCell(k);
    const kcw = kerCell(k);
    label(ctx, colors, PAD, y + 11, "Window", [k, k]);
    grid(ctx, colors, PAD, y + LBL, k, k, wcw, CH, (r, c) =>
      (win ? { text: win[r][c].toFixed(2), ...litFace(colors, walk.light) } : { empty: true }));
    if (win) frame(ctx, PAD, y + LBL, k * wcw, k * CH, colors.highlight);
    op(ctx, colors, PAD + k * wcw, y + LBL, k * CH, "∗");
    const kx = PAD + k * wcw + OP_W;
    label(ctx, colors, kx, y + 11, "Kernel", [k, k]);
    grid(ctx, colors, kx, y + LBL, k, k, kcw, CH, (r, c) =>
      ({ text: M.n2(state.kernels[0][r][c]), hue: colors.groupB }));
    spotGrid(kx, y + LBL, k, k, kcw, CH,
      (r, c) => `kernel 1 [${r}, ${c}] = ${num(state.kernels[0][r][c])}`);
    op(ctx, colors, kx + k * kcw, y + LBL, k * CH, "=");
    const sx = kx + k * kcw + OP_W;
    label(ctx, colors, sx, y + 11, "Sum");
    cell(ctx, colors, sx, y + LBL + Math.floor(k / 2) * CH, CW, CH,
      pr >= 0 ? M.n2(state.maps[0][pr][pc]) : "",
      pr >= 0 ? litFace(colors, arrival(walk, walk.idx)) : { empty: true });
    if (pr >= 0) txt(ctx, colors, productLine(ctx, colors, state, pr, pc, w), PAD, y + LBL + k * CH + 16,
      { color: colors.ink2, mono: true });
    return g;
  }

  /* --- transposed ---------------------------------------------------------- */
  /* z holds the positions that have LANDED: the one in flight joins it when
     its step completes, so the picture and the count in the readout agree. */
  const z = M.reconstruct(state, walk.done);
  const diff = M.difference(z);
  const reveal = params.trueimage === "1";
  let y = band(ctx, colors, g.y1, w, "Feature maps and reconstruction",
    reveal ? "z − img" : "convTranspose2d(y)");
  label(ctx, colors, PAD, y + 11, "y", [1, 2, n, n]);
  for (let f = 0; f < 2; f += 1) {
    const my = g.mapY + f * g.mapStep;
    shaded(ctx, colors, PAD, my, n, n, PIX, (r, c) =>
      signedFill(colors, state.maps[f][r][c], state.biases[f], spans[f]));
    spotGrid(PAD, my, n, n, PIX, PIX,
      (r, c) => `y[0, ${f}, ${r}, ${c}] = ${num(state.maps[f][r][c])}`);
    if (f === 0 && pr >= 0) frame(ctx, PAD + pc * PIX, my + pr * PIX, PIX, PIX, colors.highlight);
  }
  const ay = g.mapY + (2 * n * PIX + 10) / 2;
  arrow(ctx, PAD + n * PIX + 8, ay, PAD + n * PIX + 34, ay, colors.ink3, 2);
  const zx = PAD + n * PIX + 40;
  label(ctx, colors, zx, y + 11, reveal ? "z − img" : "z", [zN, zN]);
  const zc = M.mean(z.flat());
  const zs = Math.max(...z.flat().map((v) => Math.abs(v - zc))) || 1;
  shaded(ctx, colors, zx, y + LBL, zN, zN, PIX, (r, c) => (reveal
    ? signedFill(colors, diff.d[r][c], 0, diff.max)
    : signedFill(colors, z[r][c], zc, zs)));
  spotGrid(zx, y + LBL, zN, zN, PIX, PIX, (r, c) => (reveal
    ? `z − img at [${r}, ${c}] = ${num(diff.d[r][c])}`
    : `z[${r}, ${c}] = ${num(z[r][c])}`));
  if (reveal) {
    frame(ctx, zx + diff.mc * PIX, y + LBL + diff.mr * PIX, PIX, PIX, colors.highlight);
    txt(ctx, colors,
      `largest |z − img| = ${num(diff.max)}, at row ${diff.mr}, column ${diff.mc}`,
      PAD, y + LBL + Math.max(2 * n * PIX + 10, zN * PIX) + PRINT_LH,
      { color: colors.ink2, mono: true });
  } else {
    frame(ctx, zx + M.SQ_FROM * PIX, y + LBL + M.SQ_FROM * PIX,
      (M.SQ_TO - M.SQ_FROM) * PIX, (M.SQ_TO - M.SQ_FROM) * PIX, colors.ink3, 1.5, [4, 3]);
  }

  y = band(ctx, colors, g.y2, w, "One input value",
    pr >= 0 ? `y[0, 0, ${pr}, ${pc}]` : "y[0, 0, · , · ]");
  const tcw = scatterCell(k);
  label(ctx, colors, PAD, y + 11, "Value");
  cell(ctx, colors, PAD, y + LBL + Math.floor(k / 2) * CH, CW, CH,
    pr >= 0 ? M.n2(state.maps[0][pr][pc]) : "",
    pr >= 0 ? litFace(colors, walk.light) : { empty: true });
  op(ctx, colors, PAD + CW, y + LBL, k * CH, "×");
  const kx = PAD + CW + OP_W;
  label(ctx, colors, kx, y + 11, "Kernel", [k, k]);
  grid(ctx, colors, kx, y + LBL, k, k, tcw, CH, (r, c) =>
    ({ text: M.n2(state.tw[0][r][c]), hue: colors.groupB }));
  spotGrid(kx, y + LBL, k, k, tcw, CH,
    (r, c) => `kernel 1 [${r}, ${c}] = ${num(state.tw[0][r][c])}`);
  op(ctx, colors, kx + k * tcw, y + LBL, k * CH, "→");
  const px = kx + k * tcw + OP_W;
  const at = pr >= 0 ? patchAt(state, pr, pc) : null;
  /* The patch's place written as an index, not a sentence: at k = 5 the band
     starts at x 322 and "into z at rows 11–15, columns 11–15" ran 3px past the
     550 stage. The readout's Patch tile spells the rows and columns out. */
  label(ctx, colors, px, y + 11, at ? `into z[${at.rows}, ${at.cols}]` : "into z");
  grid(ctx, colors, px, y + LBL, k, k, tcw, CH, (r, c) =>
    (pr >= 0
      ? { text: M.n2(state.maps[0][pr][pc] * state.tw[0][r][c]), fill: wash(colors.empirical, WASH) }
      : { empty: true }));
  if (pr >= 0) frame(ctx, px, y + LBL, k * tcw, k * CH, colors.highlight);
  return g;
}

/** Where the patch an input cell scatters into lands in z. */
function patchAt(state, r, c) {
  const { k, p, zN } = state;
  const lo = (i) => Math.max(0, i * M.STRIDE - p);
  const hi = (i) => Math.min(zN - 1, i * M.STRIDE - p + k - 1);
  return { rows: `${lo(r)}–${hi(r)}`, cols: `${lo(c)}–${hi(c)}` };
}

/** The kernel values the window's ones pick out, summed, with the bias. */
function productLine(ctx, colors, state, r, c, w) {
  const win = state.window(r, c);
  const terms = [];
  for (let u = 0; u < state.k; u += 1) {
    for (let v = 0; v < state.k; v += 1) if (win[u][v] !== 0) terms.push(state.kernels[0][u][v]);
  }
  const b = state.biases[0];
  /* signs as a sum is written, not as `+ -0.33`: the first term carries its
     own sign and every later one becomes a + or a − with a bare magnitude */
  const signed = (v, first) => (first
    ? M.n2(v).trim()
    : `${v < 0 ? "− " : "+ "}${Math.abs(v).toFixed(2)}`);
  const body = terms.length ? terms.map((v, i) => signed(v, i === 0)).join(" ") : "0";
  const tail = `${signed(b, false)} = ${M.n2(state.maps[0][r][c]).trim()}`;
  const full = `${body} ${tail}`;
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  if (ctx.measureText(full).width <= w - 2 * PAD) return full;
  return `${terms.length} of the ${state.k * state.k} kernel values ${tail}`;
}

/* ============================ 3 · Recurrent ================================ */

const RNN_GUT = 62;                 // the row labels, left of the first cell
const RNN_PITCH = CW + OP_W;        // 72 between two time steps
const RNN_ROW_GAP = 26;

const rnnRows = (bidirectional) => (bidirectional
  ? [
    { key: "fwd", label: "Forward", tall: M.RNN_HID, dir: "right" },
    { key: "x", label: "Input", tall: M.RNN_IN },
    { key: "rev", label: "Reverse", tall: M.RNN_HID, dir: "left" },
    { key: "y", label: "Output", tall: 2 * M.RNN_HID },
  ]
  : [
    { key: "fwd", label: "Forward", tall: M.RNN_HID, dir: "right" },
    { key: "x", label: "Input", tall: M.RNN_IN },
    { key: "y", label: "Output", tall: M.RNN_HID },
  ]);

function rnnGeom(ctx, colors, w, params) {
  const rows = rnnRows(params.direction === "bidirectional");
  const bodyH = rows.reduce((a, r) => a + r.tall * CH, 0) + (rows.length - 1) * RNN_ROW_GAP;
  const capY = BAND_HEAD + bodyH + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return { rows, bodyH, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
}

function drawRnn(ctx, colors, w, params, state, anim) {
  const g = rnnGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const bi = params.direction === "bidirectional";
  const s = Number(params.sample);
  const step = walk.idx >= 0 ? M.rnnStepAt(walk.idx + 1, bi) : null;
  const fwd = state.fwd[s];
  const rev = state.rev[s];
  const y0 = state.y[s];

  /* how many time steps of each row are drawn, from the ordinal alone */
  const fwdDone = bi ? Math.min(walk.done, M.SEQ) : walk.done;
  const revDone = bi ? Math.max(0, Math.min(walk.done - M.SEQ, M.SEQ)) : 0;
  const outDone = bi ? (walk.done > 2 * M.SEQ ? M.SEQ : 0) : walk.done;
  /* How much of one cell is drawn: solid where its step is past, arriving
     where its step is in flight, absent before it. The reverse pass fills
     from the far end, which is the whole of what "from the far end" means. */
  const shownAt = (key, t) => {
    if (key === "x") return 1;
    if (key === "fwd" || (key === "y" && !bi)) {
      return t < fwdDone ? 1
        : (t === fwdDone && walk.moving && step?.dir === 0 ? walk.land : 0);
    }
    if (key === "rev") {
      return t >= M.SEQ - revDone ? 1
        : (t === M.SEQ - revDone - 1 && walk.moving && step?.dir === 1 ? walk.land : 0);
    }
    return outDone > 0 ? 1 : (walk.moving && step?.dir === 2 ? walk.land : 0);
  };

  let y = band(ctx, colors, 0, w, "Time steps", "h_t = f(x_t, h_{t−1})");
  for (const row of g.rows) {
    const cy = y;
    txt(ctx, colors, row.label, PAD, cy + (row.tall * CH) / 2 + 4,
      { color: colors.ink1, weight: "600" });
    for (let t = 0; t < M.SEQ; t += 1) {
      const x = PAD + RNN_GUT + t * RNN_PITCH;
      const vals = row.key === "x" ? state.X[s][t]
        : row.key === "fwd" ? fwd[t]
          : row.key === "rev" ? rev[t] : y0[t];
      const shown = shownAt(row.key, t);
      /* what the step READS: x_t, and the hidden state one step back — lit
         through the step and left lit once it settles, so a figure at rest
         still says which inputs the last element came from */
      const reads = step != null && (
        (row.key === "x" && t === step.t)
        || (row.key === "fwd" && step.dir === 0 && t === step.t - 1)
        || (row.key === "rev" && step.dir === 1 && t === step.t + 1));
      const lands = step != null
        && ((row.key === "fwd" && step.dir === 0 && t === step.t)
          || (row.key === "rev" && step.dir === 1 && t === step.t)
          || (row.key === "y" && (step.dir === 2 || (!bi && step.dir === 0 && t === step.t))));
      for (let k = 0; k < row.tall; k += 1) {
        const v = vals[k];
        const face = reads ? litFace(colors, walk.light)
          : lands ? litFace(colors, walk.land)
            : { hue: row.key === "x" ? colors.groupA : colors.empirical };
        cell(ctx, colors, x, cy + k * CH, CW, CH,
          shown > 0 ? M.n2(v) : "", shown > 0 ? face : { empty: true });
      }
      spotGrid(x, cy, row.tall, 1, CW, CH, (k) =>
        (shown > 0 ? `${rnnName(row.key, bi)}[${t}, ${k}] = ${num(vals[k])}` : null));
      if (row.dir && t < M.SEQ - 1) {
        const ax = x + CW;
        const ayy = cy + (row.tall * CH) / 2;
        if (row.dir === "right") arrow(ctx, ax + 4, ayy, ax + OP_W - 4, ayy, colors.ink3);
        else arrow(ctx, ax + OP_W - 4, ayy, ax + 4, ayy, colors.ink3);
      }
      if (row.key === "x") {
        txt(ctx, colors, `t${t + 1}`, x + CW / 2, cy - 4,
          { color: colors.ink2, align: "center", size: colors.fsXs, mono: true });
      }
    }
    y += row.tall * CH + RNN_ROW_GAP;
  }
  return g;
}

const rnnName = (key, bi) =>
  (key === "x" ? "x" : key === "y" ? "y" : key === "rev" ? "h←" : bi ? "h→" : "h");

/* ============================ 4 · Attention ================================ */

const ATT_GAP_QK = 34;
const ATT_GAP_SC = 24;
const ATT_LAB = 54;
const ATT_DOT = 22;

function attnGeom(ctx, colors, w, params) {
  const h1 = LBL + 3 * CH + ATT_GAP_QK + 3 * CH + ATT_GAP_SC + 3 * CH;
  const h2 = LBL + 3 * (CH + 8) + 4 + 16 + 4 + CH + 8;
  const y1 = 0;
  const y2 = BAND_HEAD + h1 + BAND_GAP;
  const capY = y2 + BAND_HEAD + h2 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return { h1, h2, y1, y2, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
}

function drawAttn(ctx, colors, w, params, state, anim) {
  const g = attnGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const gw = 4 * CW;
  const sw = 3 * CW;
  const q = walk.idx >= 0 ? walk.idx : -1;
  const heat = (v) => wash(colors.empirical, 0.06 + 1.6 * v);

  let y = band(ctx, colors, g.y1, w, "Scores and weights", "softmax(QKᵀ / √d_k)");
  label(ctx, colors, PAD, y + 11, "X", [3, 4]);
  grid(ctx, colors, PAD, y + LBL, 3, 4, CW, CH, (r, c) =>
    ({ text: M.n2(M.ATT_X[r][c]), hue: colors.groupA, ...(r === q ? litFace(colors, walk.light) : {}) }));
  spotGrid(PAD, y + LBL, 3, 4, CW, CH, (r, c) => `X[${r}, ${c}] = ${num(M.ATT_X[r][c])}`);
  for (let r = 0; r < 3; r += 1) {
    txt(ctx, colors, M.TOKENS[r], PAD + gw + 6, y + LBL + r * CH + CH / 2 + 4,
      { color: colors.ink2, size: colors.fsXs });
  }

  const qy = y + LBL + 3 * CH + ATT_GAP_QK;
  arrow(ctx, PAD + gw / 2, y + LBL + 3 * CH + 2, PAD + gw / 2, qy - 18, colors.ink3);
  arrow(ctx, PAD + gw / 2, y + LBL + 3 * CH + 2, PAD + gw + OP_W + gw / 2, qy - 18, colors.ink3);
  label(ctx, colors, PAD, qy - 5, "Q", [3, 4]);
  grid(ctx, colors, PAD, qy, 3, 4, CW, CH, (r, c) =>
    ({ text: M.n2(state.Q[r][c]), hue: colors.groupB, ...(r === q ? litFace(colors, walk.light) : {}) }));
  spotGrid(PAD, qy, 3, 4, CW, CH, (r, c) => `Q[${r}, ${c}] = ${num(state.Q[r][c])}`);
  const kx = PAD + gw + OP_W;
  label(ctx, colors, kx, qy - 5, "K", [3, 4]);
  /* a query reads EVERY key, which is the claim the page is making, so all
     three rows of K light at once */
  grid(ctx, colors, kx, qy, 3, 4, CW, CH, (r, c) =>
    ({ text: M.n2(state.K[r][c]), hue: colors.groupB, ...(q >= 0 ? litFace(colors, walk.light) : {}) }));
  spotGrid(kx, qy, 3, 4, CW, CH, (r, c) => `K[${r}, ${c}] = ${num(state.K[r][c])}`);

  const sy = qy + 3 * CH + ATT_GAP_SC;
  const smax = Math.max(...state.scores.flat().map(Math.abs)) || 1;
  label(ctx, colors, PAD, sy - 5, "scores", [3, 3]);
  grid(ctx, colors, PAD, sy, 3, 3, CW, CH, (r, c) => {
    const a = arrival(walk, r);
    return a === 0
      ? { empty: true }
      : { text: M.n2(state.scores[r][c]), fill: signedFill(colors, state.scores[r][c], 0, smax) };
  });
  spotGrid(PAD, sy, 3, 3, CW, CH,
    (r, c) => (r < walk.done ? `scores[${r}, ${c}] = ${num(state.scores[r][c])}` : null));
  arrow(ctx, PAD + sw + 12, sy + 3 * CH / 2, PAD + sw + 48, sy + 3 * CH / 2, colors.ink3);
  txt(ctx, colors, "softmax", PAD + sw + 30, sy + 3 * CH / 2 - 8,
    { color: colors.ink2, align: "center", size: colors.fsXs });
  const wx = PAD + sw + 60;
  label(ctx, colors, wx, sy - 5, "weights", [3, 3]);
  grid(ctx, colors, wx, sy, 3, 3, CW, CH, (r, c) => {
    const a = arrival(walk, r);
    return a === 0 ? { empty: true } : { text: M.n3(state.W[r][c]), fill: heat(state.W[r][c]) };
  });
  spotGrid(wx, sy, 3, 3, CW, CH,
    (r, c) => (r < walk.done ? `weights[${r}, ${c}] = ${M.n3(state.W[r][c])}` : null));
  for (let r = 0; r < 3; r += 1) {
    txt(ctx, colors, M.TOKENS[r], wx + sw + 6, sy + r * CH + CH / 2 + 4,
      { color: colors.ink2, size: colors.fsXs });
  }

  y = band(ctx, colors, g.y2, w, q >= 0 ? `One query: ${M.TOKENS[q]}` : "One query",
    "Attention(Q, K, V) = softmax(QKᵀ / √d_k) V");
  const vx = PAD + CW + 8 + ATT_LAB + ATT_DOT;
  for (let j = 0; j < 3; j += 1) {
    const ry = y + LBL + j * (CH + 8);
    if (q >= 0) {
      cell(ctx, colors, PAD, ry, CW, CH, M.n3(state.W[q][j]), { fill: heat(state.W[q][j]) });
      txt(ctx, colors, `${M.TOKENS[q]}–${M.TOKENS[j]}`, PAD + CW + 8, ry + CH / 2 + 4,
        { color: colors.ink2 });
      txt(ctx, colors, "·", vx - ATT_DOT / 2, ry + CH / 2 + 4,
        { color: colors.ink1, align: "center", size: colors.fsLg });
    } else {
      cell(ctx, colors, PAD, ry, CW, CH, "", { empty: true });
    }
    grid(ctx, colors, vx, ry, 1, 4, CW, CH, (r, c) =>
      ({ text: M.n2(state.V[j][c]), hue: colors.groupB }));
    spotGrid(vx, ry, 1, 4, CW, CH, (r, c) => `V[${j}, ${c}] = ${num(state.V[j][c])}`);
  }
  const sumY = y + LBL + 3 * (CH + 8) + 4;
  arrow(ctx, vx + 2 * CW, sumY, vx + 2 * CW, sumY + 16, colors.ink3);
  txt(ctx, colors, "Sum", vx + 2 * CW + 10, sumY + 12, { color: colors.ink2 });
  grid(ctx, colors, vx, sumY + 20, 1, 4, CW, CH, (r, c) => (q >= 0
    ? { text: M.n2(state.out[q][c]), ...litFace(colors, arrival(walk, q)) }
    : { empty: true }));
  if (q >= 0) {
    spotGrid(vx, sumY + 20, 1, 4, CW, CH, (r, c) => `output[${q}, ${c}] = ${num(state.out[q][c])}`);
    txt(ctx, colors, `output for ${M.TOKENS[q]}`, vx + 4 * CW + 8, sumY + 20 + CH / 2 + 4,
      { color: colors.ink2, size: colors.fsXs });
  }
  return g;
}

/* ============================== 5 · Graph ================================== */

const G_PITCH = 3 * IW + 20;          // one node's strip, and the gap to the next
const G_STAGE = LBL + IW + 10 + 2 * NODE_R + 8;
const G_EXTRA = 34;                   // the self-loop and its coefficient
const G_GAP = 22;

function graphGeom(ctx, colors, w, params) {
  const printH = PRINT_DROP + M.printRows([M.NODES, M.GRAPH_IN]) * PRINT_LH;
  const y1 = 0;
  const y2 = BAND_HEAD + G_STAGE + G_GAP;
  const y3 = y2 + BAND_HEAD + G_STAGE + G_EXTRA + G_GAP;
  const capY = y3 + BAND_HEAD + G_STAGE + printH + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return { y1, y2, y3, printH, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
}

function drawGraph(ctx, colors, w, params, state, anim) {
  const g = graphGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const node = walk.idx >= 0 ? walk.idx : -1;
  const nodeX = (i) => PAD + i * G_PITCH + (3 * IW) / 2;
  const spanX = Math.max(...state.X.flat().map(Math.abs)) || 1;
  const spanA = Math.max(...state.agg.flat().map(Math.abs)) || 1;
  const spanO = Math.max(...state.out.flat().map(Math.abs)) || 1;

  /** One band: four shaded strips over four nodes on a chain of arcs. */
  const stage = (y, header, expr, valueAt, span, hue, name, lit, read) => {
    const cy = band(ctx, colors, y, w, header, expr);
    for (let i = 0; i < M.NODES; i += 1) {
      const x = PAD + i * G_PITCH;
      const vals = valueAt(i);
      shaded(ctx, colors, x, cy + LBL, 1, M.GRAPH_IN, IW,
        (r, c) => (vals ? signedFill(colors, vals[c], 0, span) : null));
      spotGrid(x, cy + LBL, 1, M.GRAPH_IN, IW, IW,
        (r, c) => (vals ? `${name}[${i}, ${c}] = ${num(vals[c])}` : null));
      if (read && read.includes(i)) {
        frame(ctx, x, cy + LBL, M.GRAPH_IN * IW, IW, colors.highlight, HLW);
      }
    }
    const ny = cy + LBL + IW + 10 + NODE_R;
    ctx.strokeStyle = colors.ink2;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < M.NODES - 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(nodeX(i) + NODE_R, ny);
      ctx.quadraticCurveTo((nodeX(i) + nodeX(i + 1)) / 2, ny - 22, nodeX(i + 1) - NODE_R, ny);
      ctx.stroke();
    }
    for (let i = 0; i < M.NODES; i += 1) {
      ctx.beginPath();
      ctx.arc(nodeX(i), ny, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = wash(hue, 0.75);
      ctx.fill();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.stroke();
      txt(ctx, colors, String(i), nodeX(i), ny + 4,
        { color: colors.surface, align: "center", weight: "600" });
    }
    if (lit >= 0) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(nodeX(lit), ny, NODE_R + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const j of M.neighbours(lit)) {
        if (j === lit) continue;
        const from = nodeX(j), to = nodeX(lit);
        const dir = Math.sign(to - from);
        arrow(ctx, from + dir * (NODE_R + 6), ny + 2, to - dir * (NODE_R + 7), ny + 2,
          colors.highlight, 2, [], 8);
        if (state.coef) {
          txt(ctx, colors, M.n3(state.coef[lit][j]), (from + to) / 2, ny + 22,
            { color: colors.highlight, align: "center", mono: true, size: colors.fsXs });
        }
      }
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nodeX(lit), ny + NODE_R + 8, 9, Math.PI * 0.85, Math.PI * 0.15, false);
      ctx.stroke();
      if (state.coef) {
        txt(ctx, colors, M.n3(state.coef[lit][lit]), nodeX(lit), ny + NODE_R + 30,
          { color: colors.highlight, align: "center", mono: true, size: colors.fsXs });
      }
    }
    return cy;
  };

  const reads = node >= 0 ? M.neighbours(node) : null;
  stage(g.y1, "Input", `X  ${shapeText([M.NODES, M.GRAPH_IN])}`,
    (i) => state.X[i], spanX, colors.groupA, "X", -1, reads);
  stage(g.y2, "Aggregate", "over N(i) ∪ {i}",
    (i) => (arrival(walk, i) > 0 ? state.agg[i] : null), spanA, colors.groupA, "aggregate", node, null);
  const oy = stage(g.y3, "Output", "W · aggregate",
    (i) => (arrival(walk, i) > 0 ? state.out[i] : null), spanO, colors.empirical, "h'", -1, null);
  if (walk.done > 0) {
    printBlock(ctx, colors, PAD, oy + G_STAGE + PRINT_DROP,
      [M.NODES, M.GRAPH_IN], ([r, c]) => state.out[r][c], ([r]) => r < walk.done);
  }
  return g;
}

/* ============================== the captions =============================== */

/* The one caption every page carries, and it is the whole of what the widget
   claims about its numbers. */
const WEIGHTS_CAPTION =
  "The weights are untrained values drawn from the initializer PyTorch uses. "
  + "Training changes the values, not which inputs an output reads.";

function pageCaption(params) {
  switch (params.block) {
    case "convolutional":
      if (params.conv !== "transposed") {
        return "One kernel slides over every position, so every value in a map comes from the same weights.";
      }
      return params.trueimage === "1"
        ? "The difference reaches the full range of the input, so z restores the size and not the values."
        : "Each input value scatters into a patch of z, and overlapping patches add.";
    case "recurrent":
      return params.direction === "bidirectional"
        ? "The recurrence is drawn closed, and each y_t is the forward hidden state and the reverse hidden state placed end to end."
        : "The recurrence is drawn closed: these values stand in for whichever of RNN, LSTM and GRU is named.";
    case "attention":
      return params.projection === "identity"
        ? "“The” attends most to itself; “cat” and “sat” weight each other above “The”."
        : "Before training the three attention weights are nearly equal.";
    case "graph":
      return params.aggregate === "max"
        ? "Max takes the largest value at each feature, so no coefficient is applied."
        : "Node 0 has one neighbour, so it weights itself 0.500; an interior node weights itself 0.333.";
    default:
      return "Every output reads every input, and each output unit has its own row of weights.";
  }
}

/** Both captions, wrapped to the stage — the same lines `height` reserves. */
function captionLines(ctx, colors, w, params) {
  return [
    ...wrapLines(ctx, colors, pageCaption(params), w - 2 * PAD),
    ...wrapLines(ctx, colors, WEIGHTS_CAPTION, w - 2 * PAD),
  ];
}

/* ============================ the formula card ============================= */

/* MathML where the engine lays it out, plain text where it does not — widget
   14's rule, and `gradients`' shape for the rows: the label sits in a gutter
   and the body starts under itself when it wraps. */
const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const msup = (b, s) => `<msup>${b}${s}</msup>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const sqrt = (a) => `<msqrt>${a}</msqrt>`;
const row = (...xs) => xs.join("");

const eq = (mathml, plain) => (MATHML ? mml(mathml) : plain);

const CARD = {
  linear: eq(row(mi("y"), mo("="), mi("W"), mi("x"), mo("+"), mi("b")), "y = Wx + b"),
  linearTorch: eq(
    row(mi("y"), mo("="), mi("x"), mo("@"), msup(mi("W"), mi("T")), mo("+"), mi("b")),
    "y = x @ W.T + b"),
  convSum: eq(
    row(msub(mi("Y"), mi("p")), mo("="), mo("∑"), mo("("), msub(mi("X"), mi("patch")),
      mo("⊙"), mi("W"), mo(")")),
    "Y[p] = ∑ (X_patch(p) ⊙ W)"),
  recur: eq(
    row(msub(mi("h"), mi("t")), mo("="), mi("f"), mo("("), msub(mi("x"), mi("t")), mo(","),
      msub(mi("h"), row(mi("t"), mo("−"), mn("1"))), mo(")")),
    "h_t = f(x_t, h_{t−1})"),
  recurBi: eq(
    row(msup(msub(mi("h"), mi("t")), mi("bi")), mo("="), mo("["),
      msup(msub(mi("h"), mi("t")), mo("→")), mo(";"),
      msup(msub(mi("h"), mi("t")), mo("←")), mo("]")),
    "h_t^bi = [h_t^→ ; h_t^←]"),
  attention: eq(
    row(mi("Attention"), mo("("), mi("Q"), mo(","), mi("K"), mo(","), mi("V"), mo(")"), mo("="),
      mi("softmax"), mo("("), frac(row(mi("Q"), msup(mi("K"), mi("T"))), sqrt(msub(mi("d"), mi("k")))),
      mo(")"), mi("V")),
    "Attention(Q, K, V) = softmax(QKᵀ / √d_k) V"),
  graph: eq(
    row(msup(msub(mi("h"), mi("i")), mo("′")), mo("="), mi("σ"), mo("("), mi("W"), mo("·"),
      mi("Aggregate"), mo("("), mo("{"), msub(mi("h"), mi("j")), mo(":"), mi("j"), mo("∈"),
      mi("N"), mo("("), mi("i"), mo(")"), mo("}"), mo("∪"), mo("{"), msub(mi("h"), mi("i")),
      mo("}"), mo(")"), mo(")")),
    "h_i' = σ(W · Aggregate({h_j : j ∈ N(i)} ∪ {h_i}))"),
};

/** The card's rows and its note, for the page on screen. */
function cardFor(params) {
  const k = Number(params.k);
  const p = Number(params.pad);
  const n = outSize(M.IMG_N, k, M.STRIDE, p);
  switch (params.block) {
    case "convolutional":
      return params.conv === "transposed"
        ? {
          rows: [["out", `(${n} − 1) × ${M.STRIDE} − 2 × ${p} + ${k} + ${M.OUT_PAD} = `
            + `${transposedOutSize(n, k, M.STRIDE, p, M.OUT_PAD)}`]],
          note: "out = (in − 1) × stride − 2 × padding + kernel_size + output_padding. "
            + "output_padding is 1, which is what makes z the size of the image again.",
        }
        : {
          rows: [["Y[p]", CARD.convSum],
            ["out", `⌊(${M.IMG_N} + 2 × ${p} − ${k}) / ${M.STRIDE}⌋ + 1 = ${n}`]],
          note: `out = ⌊(in + 2 × padding − kernel_size) / stride⌋ + 1, so each of the two `
            + `feature maps is ${n} × ${n}.`,
        };
    case "recurrent":
      return {
        rows: params.direction === "bidirectional"
          ? [["h_t", CARD.recur], ["h_t bi", CARD.recurBi]]
          : [["h_t", CARD.recur]],
        note: "f is the recurrent update: RNN, LSTM and GRU differ inside it and not in what it reads.",
      };
    case "attention":
      return { rows: [["out", CARD.attention]], note: `d_k is ${M.D_K}, the embedding dimension.` };
    case "graph":
      return {
        rows: [["h_i′", CARD.graph]],
        /* THE NOTE FOLLOWS THE AGGREGATE. Naming GCNConv's 1/√(d̂ᵢ d̂ⱼ) while
           the figure is taking a mean or a maximum would be the card and the
           picture disagreeing about what the layer just did. */
        note: "GCNConv applies no activation, so σ is the identity. "
          + (params.aggregate === "max"
            ? "Max takes the largest value at each feature, over the neighbours and the node itself."
            : params.aggregate === "mean"
              ? "Mean weights the neighbours and the node itself equally."
              : "Its own aggregate weights each pair by 1/√(d̂ᵢ d̂ⱼ), with self-loops added."),
      };
    default:
      return {
        rows: [["y", CARD.linear], ["torch", CARD.linearTorch]],
        note: `PyTorch stores W as [out_features, in_features] — here [${params.out}, ${M.LIN_IN}], `
          + "one row per output unit — and computes x @ W.T.",
      };
  }
}

const GUTTER = "3.6em";
let cardHost = null;
let cardKey = null;

function renderCard(params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const key = [params.block, params.conv, params.k, params.pad, params.direction,
    params.out, params.aggregate].join(":");
  if (key === cardKey) return;
  cardKey = key;
  const { rows, note } = cardFor(params);
  cardHost.innerHTML = rows
    .map(([name, body]) =>
      `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">${name}</span>${body}</div>`)
    .join("") + `<p class="w-math-note">${note}</p>`;
}

/* ============================== the widget ================================= */

/* What the last `init` was handed, so a Replay can be told from a click: a
   Replay comes back with the same state object and the same `pos`. */
let seen = null;

/** The stage height for any page, from the parameters alone. */
function pageHeight(w, params) {
  const ctx = measureCtx();
  const colors = readTokens();
  switch (params.block) {
    case "convolutional": return convGeom(ctx, colors, w, params).height;
    case "recurrent": return rnnGeom(ctx, colors, w, params).height;
    case "attention": return attnGeom(ctx, colors, w, params).height;
    case "graph": return graphGeom(ctx, colors, w, params).height;
    default: return linearGeom(ctx, colors, w, params).height;
  }
}

const BLOCKS = [
  { value: "linear", label: "Linear" },
  { value: "convolutional", label: "Convolutional" },
  { value: "recurrent", label: "Recurrent" },
  { value: "attention", label: "Attention" },
  { value: "graph", label: "Graph", span: true },
];

const ON = (block) => ({ param: "block", equals: block });

const STEP_LABELS = {
  linear: "Next output",
  convolutional: "Next position",
  recurrent: "Next time step",
  attention: "Next query",
  graph: "Next node",
};
const STEP_TITLES = {
  linear: "Compute the next output value, lighting the row of x and the row of W it reads",
  convolutional: "Compute the next output position, lighting the window of the input it reads",
  recurrent: "Take the next time step, lighting the input at that step and the hidden state before it",
  attention: "Compute the next query's weights and the output they build from the values",
  graph: "Update the next node, lighting its neighbours and its own features",
};
const RUN_TITLES = {
  linear: "Compute every remaining output value",
  convolutional: "Compute every remaining output position",
  recurrent: "Take every remaining time step",
  attention: "Compute the remaining queries",
  graph: "Update the remaining nodes",
};

defineWidget({
  slug: "processing-layers",
  title: "Processing Layers",
  status: "draft",
  subtitle:
    "A layer takes an input tensor, applies a transformation with or without "
    + "learnable parameters, and produces an output tensor. Layers differ in "
    + "which inputs each output reads and in whether the weights are shared "
    + "across positions.",
  layout: "side",
  /* Every band is as tall as its content, so the stage is as tall as its
     bands and its wrapped captions — a function of the parameters and the
     width (decision 4). */
  height: ({ w, ...values }) => pageHeight(w, values),

  /* Hovering any cell prints its index and value. An inspector, not a control:
     nothing is written, and with no pointer the figure is exactly as before. */
  pointer: true,

  params: {
    /* FIVE OPTIONS IN TWO COLUMNS, Graph on the free row. A row of five gives
       each button 60px at the real 300px rail, where Convolutional, Recurrent
       and Attention all truncate; the grid gives each 149px against a widest
       label of 86px (mock §1, Kenneth's pick). */
    block: {
      type: "segmented",
      label: "Layer",
      style: "grid",
      detail: "the five processing layers, each with its own rule for which inputs an output reads",
      options: BLOCKS,
      default: "linear",
    },

    out: {
      type: "choice",
      label: "Output features",
      detail: "a projection can compress or expand: 4 features in, this many out",
      options: [
        { value: "2", label: "2", detail: "four features compressed into two" },
        { value: "3", label: "3", detail: "four features into three" },
        { value: "5", label: "5", detail: "four features expanded into five" },
      ],
      default: "3",
      when: ON("linear"),
    },

    conv: {
      type: "segmented",
      label: "Convolution",
      detail: "standard reads the image into feature maps; transposed reads the maps back to the image size",
      options: [
        { value: "standard", label: "Standard", detail: "a window gathers a patch of the input into one output value" },
        { value: "transposed", label: "Transposed", detail: "one input value scatters into a patch of the output" },
      ],
      default: "standard",
      when: ON("convolutional"),
    },
    k: {
      type: "choice",
      label: "Kernel size",
      detail: "the width of the square window the filter reads",
      options: [
        { value: "3", label: "3", detail: "a 3 × 3 window, nine weights" },
        { value: "5", label: "5", detail: "a 5 × 5 window, twenty-five weights" },
      ],
      default: "3",
      when: ON("convolutional"),
    },
    pad: {
      type: "choice",
      label: "Padding",
      detail: "zeros added around the input before the window slides",
      options: [
        { value: "0", label: "0", detail: "no zeros, so the window stays inside the image" },
        { value: "1", label: "1", detail: "one ring of zeros, so the window can start at the corner" },
      ],
      default: "1",
      when: ON("convolutional"),
    },

    direction: {
      type: "segmented",
      label: "Direction",
      detail: "which way the sequence is read",
      options: [
        { value: "unidirectional", label: "Unidirectional", detail: "left to right, so a step sees only what came before it" },
        { value: "bidirectional", label: "Bidirectional", detail: "two passes, one each way, concatenated at every step" },
      ],
      default: "bidirectional",
      when: ON("recurrent"),
    },
    /* A READING OF AN ALREADY-COMPUTED [2, 5, 4], so it is display: switching
       sequences keeps the time steps the reader has taken (3.2). */
    sample: {
      type: "choice",
      label: "Sequence",
      detail: "which of the two sequences in the batch is drawn",
      options: [
        { value: "0", label: "0", detail: "the first sequence of the batch" },
        { value: "1", label: "1", detail: "the second sequence of the batch" },
      ],
      default: "0",
      display: true,
      when: ON("recurrent"),
    },

    projection: {
      type: "segmented",
      label: "Projection",
      detail: "how the tokens are turned into queries, keys and values",
      options: [
        { value: "random", label: "Random", detail: "the untrained in-projection a new layer starts with" },
        { value: "identity", label: "Identity", detail: "Q, K and V are the embeddings themselves, so a score is one embedding against another" },
      ],
      default: "random",
      when: ON("attention"),
    },
    /* THE ONE PAGE WHERE CHANGING THE DRAW IS THE ARGUMENT, and only at the
       random projection: at identity Q = K = V = X and nothing is drawn, so a
       seed there would be a question with no answer on screen (3.4b). */
    seed: {
      type: "choice",
      label: "Seed",
      detail: "which untrained in-projection is drawn",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
      ],
      default: "1",
      when: { all: [ON("attention"), { param: "projection", equals: "random" }] },
    },

    aggregate: {
      type: "segmented",
      label: "Aggregate",
      detail: "how a node combines its neighbours' features with its own",
      options: M.AGGREGATES,
      default: "normalized-sum",
      when: ON("graph"),
    },

    /* The settled reveal, after the drive row (3.4j): the same 16 × 16
       footprint redrawn as z − img. Display, so the reveal keeps the walk. */
    trueimage: {
      type: "segmented",
      label: "True image",
      detail: "redraws the reconstruction as its difference from the input image",
      options: [
        { value: "0", label: "Off", detail: "the reconstruction on its own range" },
        { value: "1", label: "On", detail: "z − img, so what the reconstruction did not recover is visible" },
      ],
      default: "0",
      display: true,
      afterDrive: true,
      when: { all: [ON("convolutional"), { param: "conv", equals: "transposed" }] },
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: M.SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* THE OUTPUT POSITION THE ARITHMETIC BAND COMPUTES, set by clicking a
       feature-map cell. Data, so a click restarts the walk there and the URL
       reproduces what is on screen (decision 6). */
    pos: { type: "int", min: 0, max: 400, default: 0, hidden: true },
    /* Authoring escape hatch, first render only: output values, positions,
       time steps, queries or nodes, whichever the page counts. */
    shown: { type: "int", min: 0, max: 400, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const second = {
      linear: "W and b, one row of weights per output unit",
      convolutional: "The kernel, the same weights at every position",
      recurrent: null,
      attention: "Q, K and V, the three projections of the tokens",
      graph: null,
    }[params.block];
    const ramp = params.block === "convolutional" || params.block === "graph";
    return [
      { token: "group-a", label: params.block === "graph" ? "The node features read in" : "The input tensor" },
      ...(second ? [{ token: "group-b", label: second }] : []),
      { token: "empirical", label: "The output the layer produces" },
      { token: "highlight", label: "The element being computed, and the inputs it reads" },
      /* the signed ramp, named as two ends rather than one — a token name in a
         legend line would be reader-facing copy naming a stylesheet (2.9) */
      ...(ramp
        ? [
          { token: "value-high", label: "A shaded cell above the middle of its range" },
          { token: "value-low", label: "A shaded cell below the middle of its range" },
        ]
        : []),
    ];
  },

  compute: ({ params, rng }) => {
    switch (params.block) {
      case "convolutional": {
        const state = M.conv(rng, Number(params.k), Number(params.pad));
        return { ...state, units: state.n * state.n };
      }
      case "recurrent": {
        const state = M.recurrent(rng);
        return { ...state, units: params.direction === "bidirectional" ? 2 * M.SEQ + 1 : M.SEQ };
      }
      case "attention":
        return M.attention(rng, params.projection);
      case "graph":
        return M.graph(rng, params.aggregate);
      default:
        return M.linear(rng, Number(params.out));
    }
  },

  animation: {
    /* Each page advances a different noun, so the label takes the map form
       (3.4c). None is a near-synonym of any lead in the arc. */
    stepLabel: { param: "block", labels: STEP_LABELS, default: "Next output" },
    stepTitle: { param: "block", labels: STEP_TITLES, default: STEP_TITLES.linear },
    runLabel: "Play",
    runTitle: { param: "block", labels: RUN_TITLES, default: RUN_TITLES.linear },

    init: ({ params, state, fromScratch }) => {
      /* A REPLAY IS THE ONE RE-INIT `pos` DOES NOT ANSWER, and core cannot say
         which one it is: `fromScratch` is true for Replay AND for every
         re-init after the first, because that is what keeps `shown`
         spoiler-free. What separates them is the STATE OBJECT — a data change
         computes a new one, a Replay hands back the same — so a Replay is the
         same state and the same `pos`, and it builds from empty. Every other
         re-init with `pos` set is a click on a feature-map cell (or a URL
         carrying one), and there the walk restarts with that position last so
         the URL and the screen agree (decision 6). */
      const replay = seen !== null && seen.state === state && seen.pos === params.pos;
      seen = { state, pos: params.pos };
      const usePos = !replay && params.block === "convolutional" && params.pos > 0;
      const n = usePos ? Math.min(params.pos + 1, state.units)
        : fromScratch ? 0
          : Math.min(Math.max(0, params.shown ?? 0), state.units);
      return { n, beat: 0, clock: M.unitMs(params.speed), done: n >= state.units };
    },

    advance: (anim, { dt, params, state }) => {
      if (anim.n >= state.units) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.unitMs(params.speed);
      if (anim.beat < 1) return true;
      anim.beat = 0;
      anim.n += 1;
      if (anim.n >= state.units) anim.done = true;
      return anim.mode !== "step" && !anim.done;
    },

    /* A beat in flight is cleared whenever the beat LENGTH changes: a fraction
       of one clock read against another leaves an element stopped between two
       phases. Switching the reveal or the sequence changes no clock, so a step
       in flight keeps running while the picture changes under it. */
    rebuild: (anim, { params, state }) => {
      anim.n = Math.min(anim.n, state.units);
      const ms = M.unitMs(params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
    },
  },

  /* --- the figure as a control (3.6) --------------------------------------- *
   * Every feature-map cell is a target for `pos`, and the walk restarts there.
   * Built from the same geometry `draw` uses, lazily at click and hover time,
   * never inside `draw` (5.8). Core hands `regions` no colours and no canvas,
   * deliberately — a target that moved with the theme would drift from the
   * picture — so the tokens are read again here and the measurement is taken
   * on a canvas of this module's own; both are pure functions of the
   * stylesheet and neither can disagree with what `draw` used. */
  regions: ({ w, params, state }) => {
    if (!state || params.block !== "convolutional") return [];
    const g = convGeom(measureCtx(), readTokens(), w, params);
    const out = [];
    for (let f = 0; f < 2; f += 1) {
      for (let r = 0; r < g.n; r += 1) {
        for (let c = 0; c < g.n; c += 1) {
          out.push({
            x: g.mapX + c * PIX,
            y: g.mapY + f * g.mapStep + r * PIX,
            w: PIX,
            h: PIX,
            set: { pos: r * g.n + c },
            label: `position ${r}, ${c}`,
          });
        }
      }
    }
    return out;
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    spots = [];
    renderCard(params);
    const g = params.block === "convolutional" ? drawConv(ctx, colors, w, params, state, anim)
      : params.block === "recurrent" ? drawRnn(ctx, colors, w, params, state, anim)
        : params.block === "attention" ? drawAttn(ctx, colors, w, params, state, anim)
          : params.block === "graph" ? drawGraph(ctx, colors, w, params, state, anim)
            : drawLinear(ctx, colors, w, params, state, anim);
    g.caps.forEach((line, i) => {
      txt(ctx, colors, line, PAD, g.capY + 12 + i * CAPTION_H, { color: colors.ink2 });
    });
    hovered = hitSpots(pointer);
  },

  readout({ params, state, anim }) {
    const walk = walkAt(anim, state, params);
    const cellTile = (rest, note) => ({
      label: "Cell",
      value: hovered ?? rest,
      note: hovered ? "under the pointer" : note,
    });

    if (params.block === "convolutional") {
      const n = state.n;
      const at = walk.idx >= 0 ? { r: Math.floor(walk.idx / n), c: walk.idx % n } : null;
      const transposed = params.conv === "transposed";
      const cov = at ? state.covers(at.r, at.c) : null;
      const patch = at && transposed ? patchAt(state, at.r, at.c) : null;
      return [
        {
          label: "Input",
          value: transposed ? sizeText([1, 2, n, n]) : sizeText([1, 1, M.IMG_N, M.IMG_N]),
          note: transposed ? "two feature maps" : "one grayscale channel",
        },
        {
          label: "Output",
          value: transposed ? sizeText([1, 1, state.zN, state.zN]) : sizeText([1, 2, n, n]),
          note: `${walk.done} of ${state.units} positions taken`,
        },
        {
          label: "This position",
          value: at ? num(state.maps[0][at.r][at.c]) : "—",
          note: at
            ? (transposed
              ? `scattered into a ${state.k} × ${state.k} patch of z`
              : ones(state, at.r, at.c) === 0
                ? "every value in the window is 0, so the output is the bias"
                : `${ones(state, at.r, at.c)} of the ${state.k * state.k} window values are 1, so that many kernel weights and the bias are summed`)
            : "no position has been taken yet",
        },
        {
          label: transposed ? "Patch" : "Window",
          value: at ? (transposed ? `rows ${patch.rows}` : `rows ${cov.rows[0]}–${cov.rows[1]}`) : "—",
          note: at
            ? (transposed ? `columns ${patch.cols} of z` : `columns ${cov.cols[0]}–${cov.cols[1]} of the image`)
            : `a ${state.k} × ${state.k} square`,
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "recurrent") {
      const bi = params.direction === "bidirectional";
      const s = Number(params.sample);
      const step = walk.idx >= 0 ? M.rnnStepAt(walk.idx + 1, bi) : null;
      const h = step && step.dir < 2 ? (step.dir === 0 ? state.fwd[s] : state.rev[s])[step.t] : null;
      return [
        { label: "Input", value: sizeText([M.RNN_BATCH, M.SEQ, M.RNN_IN]), note: "2 sequences, 5 steps, 4 features" },
        {
          label: "Output",
          value: sizeText([M.RNN_BATCH, M.SEQ, bi ? 2 * M.RNN_HID : M.RNN_HID]),
          note: `${walk.done} of ${state.units} steps taken`,
        },
        {
          label: "This step",
          value: step ? (step.dir === 2 ? "concatenate" : `t${step.t + 1} ${step.dir === 0 ? "forward" : "reverse"}`) : "—",
          note: h
            ? `h = ${h.map(num).join(", ")}, from x at this step and h at the step ${step.dir === 0 ? "before" : "after"} it`
            : step ? "every y_t is its forward and reverse halves end to end"
              : "no time step has been taken yet",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "attention") {
      const q = walk.idx >= 0 ? walk.idx : -1;
      return [
        { label: "Input", value: sizeText([1, 3, M.D_K]), note: "one sequence of 3 tokens, 4 features each" },
        { label: "Weights", value: sizeText([1, 3, 3]), note: `${walk.done} of ${state.units} queries taken` },
        { label: "Output", value: sizeText([1, 3, M.D_K]), note: "one contextualized vector per token" },
        {
          label: "This query",
          value: q >= 0 ? M.TOKENS[q] : "—",
          note: q >= 0
            ? `${state.W[q].map(M.n3).join(", ")} on ${M.TOKENS.join(", ")}; they sum to 1`
            : "no query has been taken yet",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "graph") {
      const i = walk.idx >= 0 ? walk.idx : -1;
      const nb = i >= 0 ? M.neighbours(i).filter((j) => j !== i) : [];
      return [
        { label: "Nodes", value: sizeText([M.NODES, M.GRAPH_IN]), note: "4 nodes, 3 features each" },
        { label: "Edges", value: sizeText([2, M.EDGE_INDEX[0].length]), note: "the chain 0–1–2–3, both directions" },
        { label: "Output", value: sizeText([M.NODES, M.GRAPH_IN]), note: `${walk.done} of ${state.units} nodes updated` },
        {
          label: "This node",
          value: i >= 0 ? state.out[i].map(num).join(", ") : "—",
          note: i >= 0
            ? (state.coef
              ? `neighbours ${nb.join(", ")}; coefficients ${nb.map((j) => M.n3(state.coef[i][j])).join(", ")} and ${M.n3(state.coef[i][i])} on itself`
              : `neighbours ${nb.join(", ")}; the largest value at each feature`)
            : "no node has been updated yet",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    const out = Number(params.out);
    const at = walk.idx >= 0 ? { i: Math.floor(walk.idx / out), j: walk.idx % out } : null;
    const terms = at ? state.terms(at.i, at.j) : null;
    return [
      { label: "Input", value: sizeText([M.LIN_BATCH, M.LIN_IN]), note: "a batch of 2, four features each" },
      {
        label: "Output",
        value: sizeText([M.LIN_BATCH, out]),
        note: `${walk.done} of ${state.units} values computed`,
      },
      {
        label: "This output",
        value: at ? num(state.Y[at.i][at.j]) : "—",
        /* the four products as VALUES, not as pairs: `0.02×-0.10 + -0.13×-0.35`
           puts a plus in front of a minus twice in one line */
        note: terms
          ? `the four products ${terms.map((t) => M.n2(t.product).trim()).join(", ")}, and the bias ${M.n2(state.b[at.j]).trim()}`
          : "no output value has been computed yet",
      },
      cellTile("—", "a cell's index and value"),
    ];
  },
});

/** How many of a kernel's weights the window's ones pick out at (r, c). */
function ones(state, r, c) {
  return state.window(r, c).flat().filter((v) => v !== 0).length;
}
