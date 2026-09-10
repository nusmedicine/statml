/* ============================================================================
   Widget 50 · Support Layers — what an embedding, a pooling window, a
   normalization, an activation and a dropout mask do to the values that pass
   through them.

   PHM5005 05-3 cells 29-60, five pages in cell 1's own order. `model.js`
   carries the arithmetic; this file draws it and nothing else.

   THE MISCONCEPTION IS THAT THESE ARE MINOR PLUMBING. Each one is a stated
   operation on a stated group of numbers, and the group is what a reader has
   to see: an embedding reads ONE ROW of a table, pooling reads ONE WINDOW,
   batch normalization reads ONE COLUMN across the batch where layer
   normalization reads ONE ROW inside a sample, an activation reads ONE
   ELEMENT, and dropout decides ONE CELL. So the device on every page is the
   same — STEP TAKES ONE GROUP AND LIGHTS WHAT THAT GROUP READ — and what
   changes from page to page is the shape of the group.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE GEOMETRY OF RECORD. `_lab/support-layers-mock.html` drew
       all seven sections to scale at the 550px stage and Kenneth took the
       recommendation on every one (2026-09-10). Every band width, cell size,
       gap and label offset below is the mock's; the constants are the ones
       `widgets/tensors/main.js` and `widgets/processing-layers/main.js` share,
       so a cell means the same thing on all three widgets.

    2. THE DRAWING IS NOT SHARED WITH THE SIBLING. `txt`, `arrow`, `band`,
       `cell`, `grid`, `frame` and `shaded` are the same idiom written again
       here, deliberately: drawing is geometry and belongs to the file that
       lays out the stage. What IS shared is `core/torch.js` — the print and
       the output-size rule — because those are one formula each (5.8).

    3. THE STAGE HEIGHT IS A FUNCTION OF THE PARAMETERS, as the sibling's is.
       Sigmoid is a 190px page and Layer normalization a 470px one, and a
       single height would make the short page pay for the tall one.
       `pageHeight` and `draw` ask the same geometry functions (5.8).

    4. EVERY BAND GROWS WITH THE STAGE. One scale `t` runs 0 at 550 to 1 at
       770 and `model.js`'s `fitSizes` steps it DOWN until the page's widest
       band is inside `w − 2 · PAD`, so the fit is measured rather than
       asserted. TEXT DOES NOT SCALE: sizes come from the tokens.

    5. AT `dim = 8` THE TWO RESULT FRAMES STACK. Side by side they are
       2 × (8 × 46 + 12) + 22 = 782 against the 522 the 550 stage has, and the
       cell that would fit two frames is 29px, where a signed two-decimal float
       stops fitting. The frames stack instead, which costs height on the one
       setting that needs it and nothing on the other two. The rule is measured
       against the stage rather than written as `dim === 8`.

    6. THE STRIDE IS NOT A CONTROL, and the control's own `detail` says the
       stride equals the window. `model.js` records the measurement that
       dropped `k = 2, s = 4`.

    7. `gamma` AND `beta` ARE DATA, AND THE READOUT PAIRS THE GROUP BEFORE AND
       AFTER (2.7). With γ = 1 and β = 0 the group leaves with mean 0 and sd 1;
       move either and the pair says what the two learnable numbers bought.
       They are one `row` under one caption (3.4i), because a scale and a shift
       are one idea and two sliders labelled in full would read as two.

    8. `fn` IS A DISPLAY PARAMETER AND ONLY EXISTS ON Hidden. It chooses which
       curve the reference panel draws; all three output rows are drawn
       whatever it says, so it changes no number and must not discard the walk
       (invariant 3). On Sigmoid and Softmax there is one function and
       no curve panel, so the control would be a question with no answer on
       screen (3.4b) and `when` removes it.

    9. THE THIRD DROPOUT TILE IS A PURE FUNCTION OF THE PARAMETERS. It is the
       mean output sum over draws 1 to `seed`, computed in `compute`, so
       `?seed=10` reproduces it and nothing accumulates outside `values`
       (invariant 1). It has to be there: at p = 0.8 one draw's sum has a
       standard deviation about twice the input sum (1.97x, measured) and about
       one draw in ten drops every cell (0.8^10 = 0.107), so a single press
       argues against the scaling the page is about.

   10. A DROPPED CELL AND AN UNREACHED CELL ARE BOTH DRAWN EMPTY, and the walk
       is legible from the input row instead. Giving the dropped cell a mark of
       its own would put a third state on a row whose whole claim is that a
       dropped value is gone; the input row lights as far as the walk has got,
       the readout counts the elements taken, and the printed `y` carries the
       0.0000 that torch actually holds where a cell was dropped.

   11. THE HOVER IS AN INSPECTOR AND LIVES IN THE READOUT, as it does on
       `tensors` and the sibling: `draw` runs immediately before `readout` in
       core's paint, so the cell resolved during the draw is still current one
       line later. Nothing lives only on hover.

   12. THE BAND EXPRESSION IS `--c-highlight`, MONO, RIGHT-ALIGNED, which is
       what both siblings do, and the mock drew in `--ink-3`. A reader moving
       between the three widgets should meet one convention.
   ========================================================================= */

import {
  defineWidget, readTokens, mathmlRenders,
  shapeText, sizeText, num, torchFloatFormat, torchPrint,
} from "../core/index.js";
import * as M from "./model.js";

/* A canvas of this module's own, for the measurements `height` needs and core
   hands none: `measureText` reads the font and ignores the transform, so this
   gives the same character width the figure is laid out with. */
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  return measureCanvas;
}

const {
  PAD, GAP, CW, HUG, FRAME_LBL, IDXW, LAYER_CELL, CURVE, ACT_GUT, DROP_GUT,
  NORM_STAT, fitSizes, scaledCell,
} = M;

const HLW = 2.5;          // the --c-highlight frame

const BAND_HEAD = 26;     // a band's name, its expression and the hairline under
const BAND_GAP = 20;      // between two bands
const LBL = 16;           // the `x  [2, 4]` line above a grid
const CAP_GAP = 16;       // between the last band and the caption block
const CAPTION_H = 17;
const PRINT_LH = 16;
const PRINT_DROP = 12;

const WASH = 0.16;        // a cell's fill
const LIT_A = 0.50;       // the lit face

/* --- one step, two phases -------------------------------------------------- *
 * Slow and Medium stage a step: the values the group reads LIGHT, then the
 * result LANDS. Two changes one after the other are two the eye can follow.
 * Fast declares that it does not choreograph. */
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
      /* the collection's value ladder, on the SHORT side of the cell */
      size: o.size ?? (ch >= 28 ? colors.fsLg : ch >= 22 ? colors.fsMd : colors.fsSm),
      weight: o.lit || o.bold ? "600" : "", fit: cw - 6,
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

/** A dashed frame with its `dim 0 = i` label along the top. */
function dimFrame(ctx, colors, x, y, w, h, text) {
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.setLineDash([]);
  txt(ctx, colors, text, x + 6, y + 11, { color: colors.ink3, mono: true, size: colors.fsXs });
}

function op(ctx, colors, x, y, h, glyph, ow) {
  txt(ctx, colors, glyph, x + ow / 2, y + h / 2 + 1,
    { color: colors.ink1, align: "center", baseline: "middle", size: colors.fsLg });
}

/** `x  [2, 4]` above a grid, in the mono font. */
function label(ctx, colors, x, y, name, shape, color) {
  txt(ctx, colors, shape ? `${name}  ${shapeText(shape)}` : name, x, y,
    { color: color ?? colors.ink1, mono: true });
}

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

/** The mono font's width per character at --fs-sm. A print is laid out by
    COLUMN, so every offset inside one is a multiple of this single number. */
function monoCW(ctx, colors) {
  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  const cw = ctx.measureText("0000000000").width / 10;
  ctx.restore();
  return cw;
}

/** Every value of a shape, for the format the whole tensor prints in. */
function valuesOf(shape, at) {
  const out = [];
  const rec = (idx) => {
    if (idx.length === shape.length) { out.push(at(idx)); return; }
    for (let i = 0; i < shape[idx.length]; i += 1) rec([...idx, i]);
  };
  rec([]);
  return out;
}

/**
 * A tensor as torch prints it, under the drawing that holds the same values.
 *
 * Painted SEGMENT BY SEGMENT rather than line by line, because a half-built
 * result must print half a result: a value the walk has not reached is drawn
 * as nothing at all, in a slot whose width was measured over EVERY value, so
 * the block does not shift under the reader as it fills.
 */
function printBlock(ctx, colors, x, y, shape, valueAt, placed) {
  const fmt = torchFloatFormat(valuesOf(shape, valueAt));
  const p = torchPrint(shape, (idx) => fmt(valueAt(idx)));
  const cw = monoCW(ctx, colors);
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
 * `idx` is the group in flight, or the last one taken; `done` is how many are
 * fully drawn; `light` and `land` are the two phases of the one in flight. */
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

/** How a result at ordinal `k` is drawn: solid, arriving, or absent. */
const arrival = (walk, k) => {
  if (k < walk.done) return 1;
  if (walk.moving && k === walk.idx) return walk.land;
  return 0;
};

/* =========================== 1 · Embedding ================================= */

const EMB_ROWS_IN_FRAME = 3;   // one frame holds one sequence of three residues

function embedGeom(ctx, colors, w, params) {
  const dim = Number(params.dim);
  const stacked = M.embedStacked(w, dim);
  const s = fitSizes(w, (z) => M.bandWidth.embedding(dim, z, stacked));
  const frameH = FRAME_LBL + EMB_ROWS_IN_FRAME * s.ch + 2 * HUG;
  const h1 = LBL + Math.max(M.EMB_ROWS * s.ch + 16, M.VOCAB.length * s.ch);
  const framesH = stacked ? 2 * frameH + GAP : frameH;
  const shape = [M.EMB_ROWS, M.EMB_COLS, dim];
  const h2 = LBL + framesH + PRINT_DROP + M.printRows(shape) * PRINT_LH;
  const y1 = 0;
  const y2 = BAND_HEAD + h1 + BAND_GAP;
  const capY = y2 + BAND_HEAD + h2 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return {
    s, dim, stacked, frameH, framesH, h1, h2, y1, y2, capY, caps, shape,
    tabX: PAD + 3 * s.iw + s.arrow,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawEmbed(ctx, colors, w, params, state, anim) {
  const g = embedGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { s, dim } = g;
  const at = walk.idx >= 0 ? state.tokenAt(walk.idx) : null;
  const litId = at ? M.TOKENS[at.i][at.j] : null;
  const face = (on) => (on ? litFace(colors, walk.light) : {});

  let y = band(ctx, colors, g.y1, w, "Tokens and the table", "h = table[id]");
  label(ctx, colors, PAD, y + 11, "X", [M.EMB_ROWS, M.EMB_COLS]);
  grid(ctx, colors, PAD, y + LBL, M.EMB_ROWS, M.EMB_COLS, s.iw, s.ch, (r, c) =>
    ({ text: String(M.TOKENS[r][c]), hue: colors.groupA, ...face(at && at.i === r && at.j === c) }));
  /* the residue each id stands for, in the corner of its own cell */
  for (let r = 0; r < M.EMB_ROWS; r += 1) {
    for (let c = 0; c < M.EMB_COLS; c += 1) {
      txt(ctx, colors, M.VOCAB[M.TOKENS[r][c]], PAD + c * s.iw + s.iw - 3, y + LBL + r * s.ch + 10,
        { color: colors.ink3, align: "right", size: colors.fsXs, mono: true });
    }
  }
  spotGrid(PAD, y + LBL, M.EMB_ROWS, M.EMB_COLS, s.iw, s.ch, (r, c) =>
    `X[${r}, ${c}] = ${M.TOKENS[r][c]}, residue ${M.VOCAB[M.TOKENS[r][c]]}`);
  arrow(ctx, PAD + 3 * s.iw + 8, y + LBL + s.ch, g.tabX - 6, y + LBL + s.ch, colors.ink3, 2);

  label(ctx, colors, g.tabX, y + 11, "table", [M.VOCAB.length, dim]);
  for (let r = 0; r < M.VOCAB.length; r += 1) {
    txt(ctx, colors, `${r} ${M.VOCAB[r]}`, g.tabX + IDXW - 4, y + LBL + r * s.ch + s.ch / 2 + 0.5,
      { color: colors.ink3, align: "right", baseline: "middle", mono: true, size: colors.fsXs });
  }
  grid(ctx, colors, g.tabX + IDXW, y + LBL, M.VOCAB.length, dim, s.cw, s.ch, (r, c) =>
    ({ text: M.n2(state.table[r][c]), hue: colors.groupB, ...face(r === litId) }));
  spotGrid(g.tabX + IDXW, y + LBL, M.VOCAB.length, dim, s.cw, s.ch, (r, c) =>
    `table[${r}, ${c}] = ${num(state.table[r][c])}, residue ${M.VOCAB[r]}`);

  y = band(ctx, colors, g.y2, w, "Result", `${shapeText([M.EMB_ROWS, M.EMB_COLS])} → ${shapeText(g.shape)}`);
  label(ctx, colors, PAD, y + 11, "h", g.shape);
  const frameW = dim * s.cw + 2 * HUG;
  for (let i = 0; i < M.EMB_ROWS; i += 1) {
    const fx = g.stacked ? PAD : PAD + i * (frameW + GAP);
    const fy = g.stacked ? y + LBL + i * (g.frameH + GAP) : y + LBL;
    dimFrame(ctx, colors, fx, fy, frameW, g.frameH, `dim 0 = ${i}`);
    const gx = fx + HUG;
    const gy = fy + FRAME_LBL + HUG;
    grid(ctx, colors, gx, gy, M.EMB_COLS, dim, s.cw, s.ch, (r, c) => {
      const a = arrival(walk, i * M.EMB_COLS + r);
      if (a === 0) return { empty: true };
      const on = at && at.i === i && at.j === r;
      return on
        ? { text: M.n2(state.out[i][r][c]), ...litFace(colors, a) }
        : { text: M.n2(state.out[i][r][c]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(gx, gy, M.EMB_COLS, dim, s.cw, s.ch, (r, c) =>
      (i * M.EMB_COLS + r < walk.done
        ? `h[${i}, ${r}, ${c}] = ${num(state.out[i][r][c])}`
        : `h[${i}, ${r}, ${c}], not computed yet`));
  }
  if (walk.done > 0) {
    printBlock(ctx, colors, PAD, y + LBL + g.framesH + PRINT_DROP, g.shape,
      ([i, j, k]) => state.out[i][j][k], ([i, j]) => i * M.EMB_COLS + j < walk.done);
  }
  return g;
}

/* ============================= 2 · Pooling ================================= */

const POOL_ARITH = 22;    // the line under band 2 that says where the two came from

function poolGeom(ctx, colors, w, params) {
  const k = Number(params.k);
  const n = M.IMG_N / k;
  const s = fitSizes(w, (z) => M.bandWidth.pooling(k, z));
  const h1 = LBL + M.IMG_N * s.pix;
  const h2 = LBL + k * s.ch + POOL_ARITH;
  const y1 = 0;
  const y2 = BAND_HEAD + h1 + BAND_GAP;
  const capY = y2 + BAND_HEAD + h2 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return {
    s, k, n, h1, h2, y1, y2, capY, caps,
    mapX: PAD + M.IMG_N * s.pix + s.arrow,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawPool(ctx, colors, w, params, state, anim) {
  const g = poolGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { s, k, n } = g;
  const pr = walk.idx >= 0 ? Math.floor(walk.idx / n) : -1;
  const pc = walk.idx >= 0 ? walk.idx % n : -1;

  let y = band(ctx, colors, g.y1, w, "Image and the two summaries",
    `MaxPool2d(${k}, ${k})  ·  AvgPool2d(${k}, ${k})`);
  label(ctx, colors, PAD, y + 11, "x", [1, 1, M.IMG_N, M.IMG_N]);
  shaded(ctx, colors, PAD, y + LBL, M.IMG_N, M.IMG_N, s.pix,
    (r, c) => plainFill(colors.groupA, M.IMG[r][c]));
  spotGrid(PAD, y + LBL, M.IMG_N, M.IMG_N, s.pix, s.pix, (r, c) =>
    `x[0, 0, ${r}, ${c}] = ${M.IMG[r][c].toFixed(2)}`);
  if (pr >= 0) {
    frame(ctx, PAD + pc * k * s.pix, y + LBL + pr * k * s.pix,
      k * s.pix, k * s.pix, colors.highlight);
  }
  arrow(ctx, PAD + M.IMG_N * s.pix + 8, y + LBL + M.IMG_N * s.pix / 2,
    g.mapX - 6, y + LBL + M.IMG_N * s.pix / 2, colors.ink3, 2);

  for (const [i, kind, name] of [[0, "max", "max"], [1, "avg", "mean"]]) {
    const gx = g.mapX + i * (n * s.pix + GAP);
    txt(ctx, colors, name, gx, y + 11, { color: colors.ink3, size: colors.fsXs });
    shaded(ctx, colors, gx, y + LBL, n, n, s.pix, (r, c) =>
      (arrival(walk, r * n + c) === 0 ? null : plainFill(colors.empirical, state[kind][r][c])));
    spotGrid(gx, y + LBL, n, n, s.pix, s.pix, (r, c) =>
      (r * n + c < walk.done
        ? `${name} y[0, 0, ${r}, ${c}] = ${num(state[kind][r][c])}`
        : `${name} y[0, 0, ${r}, ${c}], not computed yet`));
    /* BOTH cells are framed: one window fills one cell of each summary, which
       is what makes the two comparable at every position. */
    if (pr >= 0) frame(ctx, gx + pc * s.pix, y + LBL + pr * s.pix, s.pix, s.pix, colors.highlight);
  }

  y = band(ctx, colors, g.y2, w, "One window",
    pr >= 0 ? `y[${pr}, ${pc}]` : "y[· , · ]");
  const win = pr >= 0 ? state.window(pr, pc) : null;
  label(ctx, colors, PAD, y + 11, "window", [k, k]);
  grid(ctx, colors, PAD, y + LBL, k, k, s.cw, s.ch, (r, c) =>
    (win ? { text: win[r][c].toFixed(2), ...litFace(colors, walk.light) } : { empty: true }));
  if (win) frame(ctx, PAD, y + LBL, k * s.cw, k * s.ch, colors.highlight);
  op(ctx, colors, PAD + k * s.cw, y + LBL, k * s.ch, "→", s.op);
  const mx = PAD + k * s.cw + s.op;
  const mid = y + LBL + Math.floor(k / 2) * s.ch;
  txt(ctx, colors, "max", mx, y + 11, { color: colors.ink3, size: colors.fsXs });
  cell(ctx, colors, mx, mid, s.cw, s.ch, pr >= 0 ? state.max[pr][pc].toFixed(2) : "",
    pr >= 0 ? litFace(colors, arrival(walk, walk.idx)) : { empty: true });
  const ax = mx + s.cw + GAP + s.op;
  op(ctx, colors, mx + s.cw + GAP, y + LBL, k * s.ch, "·", s.op);
  txt(ctx, colors, "mean", ax, y + 11, { color: colors.ink3, size: colors.fsXs });
  cell(ctx, colors, ax, mid, s.cw, s.ch, pr >= 0 ? state.avg[pr][pc].toFixed(2) : "",
    pr >= 0 ? litFace(colors, arrival(walk, walk.idx)) : { empty: true });
  if (pr >= 0) {
    const ones = state.ones(pr, pc);
    txt(ctx, colors,
      `${ones} of the ${k * k} window values are 1, so max is ${state.max[pr][pc].toFixed(2)} `
      + `and mean is ${state.avg[pr][pc].toFixed(4)}`,
      PAD, y + LBL + k * s.ch + 16, { color: colors.ink2, mono: true });
  }
  return g;
}

/* ========================== 3 · Normalization ============================== */

const BATCH_STATS = 46;   // the stub arrows and the two lines of μ and σ under a column
const SAMPLE_GAP = 18;    // between the two samples of the sequence batch

function normGeom(ctx, colors, w, params) {
  const layer = params.norm === "layer";
  if (layer) {
    const s = fitSizes(w, (z) => M.bandWidth.layerNorm(z));
    const lcw = scaledCell(LAYER_CELL, s);
    const blockH = LBL + M.SEQ_LEN * s.ch + SAMPLE_GAP;
    const h1 = M.SEQ_SAMPLES * blockH;
    const capY = BAND_HEAD + h1 + CAP_GAP;
    const caps = captionLines(ctx, colors, w, params);
    return {
      s, layer, lcw, blockH, h1, y1: 0, capY, caps,
      outX: PAD + M.SEQ_F * lcw + NORM_STAT + GAP,
      height: capY + caps.length * CAPTION_H + PAD,
    };
  }
  const s = fitSizes(w, (z) => M.bandWidth.batchNorm(z));
  const h1 = LBL + M.BATCH_N * s.ch + BATCH_STATS;
  const capY = BAND_HEAD + h1 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return {
    s, layer, h1, y1: 0, capY, caps,
    outX: PAD + M.BATCH_F * s.cw + s.arrow,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawNorm(ctx, colors, w, params, state, anim) {
  const g = normGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { s } = g;
  const at = walk.idx >= 0 ? state.groupAt(walk.idx) : null;
  const face = (on) => (on ? litFace(colors, walk.light) : {});

  if (!g.layer) {
    const y = band(ctx, colors, g.y1, w, "Batch normalization", "μ, σ down each column");
    label(ctx, colors, PAD, y + 11, "X_batch", [M.BATCH_N, M.BATCH_F]);
    grid(ctx, colors, PAD, y + LBL, M.BATCH_N, M.BATCH_F, s.cw, s.ch, (r, c) =>
      ({ text: M.n2(state.X[r][c]), hue: colors.groupA, ...face(at && at.col === c) }));
    spotGrid(PAD, y + LBL, M.BATCH_N, M.BATCH_F, s.cw, s.ch, (r, c) =>
      `X_batch[${r}, ${c}] = ${num(state.X[r][c])}`);
    const base = y + LBL + M.BATCH_N * s.ch;
    for (let c = 0; c < M.BATCH_F; c += 1) {
      if (arrival(walk, c) === 0) continue;
      const x = PAD + c * s.cw + s.cw / 2;
      arrow(ctx, x, base + 2, x, base + 14, colors.highlight, 1.6, [], 7);
      txt(ctx, colors, `μ ${state.groups[c].m.toFixed(2)}`, x, base + 26,
        { color: colors.highlight, align: "center", mono: true, size: colors.fsXs });
      txt(ctx, colors, `σ ${state.groups[c].s.toFixed(2)}`, x, base + 40,
        { color: colors.highlight, align: "center", mono: true, size: colors.fsXs });
    }
    const gw = M.BATCH_F * s.cw;
    arrow(ctx, PAD + gw + 10, y + LBL + 2 * s.ch, g.outX - 10, y + LBL + 2 * s.ch, colors.ink3, 2);
    label(ctx, colors, g.outX, y + 11, "y", [M.BATCH_N, M.BATCH_F]);
    grid(ctx, colors, g.outX, y + LBL, M.BATCH_N, M.BATCH_F, s.cw, s.ch, (r, c) => {
      const a = arrival(walk, c);
      if (a === 0) return { empty: true };
      return at && at.col === c
        ? { text: M.n2(state.Y[r][c]), ...litFace(colors, a) }
        : { text: M.n2(state.Y[r][c]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(g.outX, y + LBL, M.BATCH_N, M.BATCH_F, s.cw, s.ch, (r, c) =>
      (c < walk.done ? `y[${r}, ${c}] = ${num(state.Y[r][c])}` : `y[${r}, ${c}], not computed yet`));
    return g;
  }

  const y = band(ctx, colors, g.y1, w, "Layer normalization", "μ, σ across each row");
  const gw = M.SEQ_F * g.lcw;
  for (let i = 0; i < M.SEQ_SAMPLES; i += 1) {
    const by = y + i * g.blockH;
    txt(ctx, colors, `sample ${i}`, PAD, by + 11,
      { color: colors.ink3, mono: true, size: colors.fsXs });
    label(ctx, colors, PAD + 70, by + 11, "X_seq", [M.SEQ_LEN, M.SEQ_F]);
    grid(ctx, colors, PAD, by + LBL, M.SEQ_LEN, M.SEQ_F, g.lcw, s.ch, (r, c) =>
      ({ text: M.n2(state.X[i][r][c]), hue: colors.groupA,
        ...face(at && at.sample === i && at.row === r) }));
    spotGrid(PAD, by + LBL, M.SEQ_LEN, M.SEQ_F, g.lcw, s.ch, (r, c) =>
      `X_seq[${i}, ${r}, ${c}] = ${num(state.X[i][r][c])}`);
    for (let r = 0; r < M.SEQ_LEN; r += 1) {
      if (arrival(walk, i * M.SEQ_LEN + r) === 0) continue;
      const ry = by + LBL + r * s.ch + s.ch / 2;
      arrow(ctx, PAD + gw + 3, ry, PAD + gw + 22, ry, colors.highlight, 1.6, [], 7);
      const st = state.groups[i][r];
      txt(ctx, colors, `μ ${st.m.toFixed(2)}  σ ${st.s.toFixed(2)}`, PAD + gw + 28, ry + 0.5,
        { color: colors.highlight, baseline: "middle", mono: true, size: colors.fsXs });
    }
    label(ctx, colors, g.outX, by + 11, "y", [M.SEQ_LEN, M.SEQ_F]);
    grid(ctx, colors, g.outX, by + LBL, M.SEQ_LEN, M.SEQ_F, g.lcw, s.ch, (r, c) => {
      const a = arrival(walk, i * M.SEQ_LEN + r);
      if (a === 0) return { empty: true };
      return at && at.sample === i && at.row === r
        ? { text: M.n2(state.Y[i][r][c]), ...litFace(colors, a) }
        : { text: M.n2(state.Y[i][r][c]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(g.outX, by + LBL, M.SEQ_LEN, M.SEQ_F, g.lcw, s.ch, (r, c) =>
      (i * M.SEQ_LEN + r < walk.done
        ? `y[${i}, ${r}, ${c}] = ${num(state.Y[i][r][c])}`
        : `y[${i}, ${r}, ${c}], not computed yet`));
  }
  return g;
}

/* =========================== 4 · Activation ================================ */

const ACT_ROW_GAP = 10;
const DIST_GAP = 20;

function actGeom(ctx, colors, w, params) {
  const use = params.use;
  if (use === "sigmoid") {
    const s = fitSizes(w, (z) => M.bandWidth.sigmoid(z));
    const h1 = LBL + M.PROB_IN.length * s.ch;
    const capY = BAND_HEAD + h1 + CAP_GAP;
    const caps = captionLines(ctx, colors, w, params);
    return { s, use, h1, y1: 0, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
  }
  if (use === "softmax") {
    const s = fitSizes(w, (z) => M.bandWidth.softmax(z));
    const h1 = LBL + M.DIST_IN.length * s.ch + DIST_GAP + LBL + M.DIST_IN.length * s.ch;
    const capY = BAND_HEAD + h1 + CAP_GAP;
    const caps = captionLines(ctx, colors, w, params);
    return { s, use, h1, y1: 0, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
  }
  const s = fitSizes(w, (z) => M.bandWidth.hidden(z));
  const rowsH = (M.ACTS.length + 1) * (s.ch + ACT_ROW_GAP);
  const h1 = LBL + Math.max(CURVE.h, rowsH);
  const capY = BAND_HEAD + h1 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return {
    s, use, h1, rowsH, y1: 0, capY, caps,
    rowX: PAD + CURVE.w + GAP + ACT_GUT,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

/** The chosen function over −3 to 3, with the five inputs marked on it. */
function curvePanel(ctx, colors, x, y, fn, name, litIdx) {
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, CURVE.w, CURVE.h);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CURVE.w - 1, CURVE.h - 1);
  const lo = -3, hi = 3, ylo = -1, yhi = 3;
  const px = (v) => x + 8 + ((v - lo) / (hi - lo)) * (CURVE.w - 16);
  const py = (v) => y + CURVE.h - 8 - ((v - ylo) / (yhi - ylo)) * (CURVE.h - 16);
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(px(lo), py(0));
  ctx.lineTo(px(hi), py(0));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px(0), py(ylo));
  ctx.lineTo(px(0), py(yhi));
  ctx.stroke();
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 120; i += 1) {
    const v = lo + (i / 120) * (hi - lo);
    if (i === 0) ctx.moveTo(px(v), py(fn(v)));
    else ctx.lineTo(px(v), py(fn(v)));
  }
  ctx.stroke();
  M.HIDDEN_IN.forEach((v, i) => {
    ctx.fillStyle = i === litIdx ? colors.highlight : colors.ink3;
    ctx.beginPath();
    ctx.arc(px(v), py(fn(v)), i === litIdx ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();
  });
  txt(ctx, colors, name, x + 8, y + 14, { color: colors.ink2, mono: true, size: colors.fsXs });
}

function drawAct(ctx, colors, w, params, state, anim) {
  const g = actGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { s } = g;
  const face = (on) => (on ? litFace(colors, walk.light) : {});

  if (g.use === "sigmoid") {
    const y = band(ctx, colors, g.y1, w, "Sigmoid", "p = sigmoid(score)");
    label(ctx, colors, PAD, y + 11, "score", [M.PROB_IN.length, 1]);
    grid(ctx, colors, PAD, y + LBL, M.PROB_IN.length, 1, s.cw, s.ch, (r) =>
      ({ text: M.n2(M.PROB_IN[r]), hue: colors.groupA, ...face(walk.idx === r) }));
    spotGrid(PAD, y + LBL, M.PROB_IN.length, 1, s.cw, s.ch, (r) =>
      `score[${r}, 0] = ${num(M.PROB_IN[r])}`);
    op(ctx, colors, PAD + s.cw, y + LBL, M.PROB_IN.length * s.ch, "→", s.op);
    const ox = PAD + s.cw + s.op;
    label(ctx, colors, ox, y + 11, "p", [M.PROB_IN.length, 1]);
    grid(ctx, colors, ox, y + LBL, M.PROB_IN.length, 1, s.cw, s.ch, (r) => {
      const a = arrival(walk, r);
      if (a === 0) return { empty: true };
      return walk.idx === r
        ? { text: M.n3(state.out[r]), ...litFace(colors, a) }
        : { text: M.n3(state.out[r]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(ox, y + LBL, M.PROB_IN.length, 1, s.cw, s.ch, (r) =>
      (r < walk.done ? `p[${r}, 0] = ${num(state.out[r])}` : `p[${r}, 0], not computed yet`));
    return g;
  }

  if (g.use === "softmax") {
    const cols = M.DIST_IN[0].length;
    let y = band(ctx, colors, g.y1, w, "Softmax", "softmax(x, dim=1)");
    label(ctx, colors, PAD, y + 11, "x", [M.DIST_IN.length, cols]);
    grid(ctx, colors, PAD, y + LBL, M.DIST_IN.length, cols, s.cw, s.ch, (r, c) =>
      ({ text: M.n2(M.DIST_IN[r][c]), hue: colors.groupA, ...face(walk.idx === r) }));
    spotGrid(PAD, y + LBL, M.DIST_IN.length, cols, s.cw, s.ch, (r, c) =>
      `x[${r}, ${c}] = ${num(M.DIST_IN[r][c])}`);
    y += LBL + M.DIST_IN.length * s.ch + DIST_GAP;
    label(ctx, colors, PAD, y + 11, "p", [M.DIST_IN.length, cols]);
    txt(ctx, colors, "row sum", PAD + cols * s.cw + s.cw / 2, y + 11,
      { color: colors.ink3, align: "center", size: colors.fsXs });
    grid(ctx, colors, PAD, y + LBL, M.DIST_IN.length, cols, s.cw, s.ch, (r, c) => {
      const a = arrival(walk, r);
      if (a === 0) return { empty: true };
      return walk.idx === r
        ? { text: M.n3(state.out[r][c]), ...litFace(colors, a) }
        : { text: M.n3(state.out[r][c]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(PAD, y + LBL, M.DIST_IN.length, cols, s.cw, s.ch, (r, c) =>
      (r < walk.done ? `p[${r}, ${c}] = ${num(state.out[r][c])}` : `p[${r}, ${c}], not computed yet`));
    /* the sum column sits OUTSIDE the tensor, with no fill, because it is a
       reading of the row rather than a sixth probability */
    grid(ctx, colors, PAD + cols * s.cw, y + LBL, M.DIST_IN.length, 1, s.cw, s.ch, (r) =>
      (arrival(walk, r) === 0
        ? { empty: true }
        : { text: M.n4(state.rowSum(r)), fill: "rgba(0,0,0,0)" }));
    return g;
  }

  const y = band(ctx, colors, g.y1, w, "Hidden", "y = f(x), element by element");
  const chosen = M.actByKey(params.fn);
  curvePanel(ctx, colors, PAD, y + LBL, chosen.f, chosen.label, walk.idx);
  const rows = [
    { name: "x", vals: M.HIDDEN_IN, hue: colors.groupA, input: true },
    ...M.ACTS.map((a, i) => ({ name: a.label, vals: state.out[i], hue: colors.empirical })),
  ];
  rows.forEach((row, i) => {
    const ry = y + LBL + i * (s.ch + ACT_ROW_GAP);
    txt(ctx, colors, row.name, g.rowX - 8, ry + s.ch / 2 + 0.5,
      { color: row.name === chosen.label ? colors.highlight : colors.ink2,
        align: "right", baseline: "middle", mono: true,
        weight: row.name === chosen.label ? "600" : "" });
    grid(ctx, colors, g.rowX, ry, 1, M.HIDDEN_IN.length, s.cw, s.ch, (_, c) => {
      if (row.input) {
        return { text: M.n2(row.vals[c]), hue: row.hue, ...face(walk.idx === c) };
      }
      const a = arrival(walk, c);
      if (a === 0) return { empty: true };
      return walk.idx === c
        ? { text: M.n2(row.vals[c]), ...litFace(colors, a) }
        : { text: M.n2(row.vals[c]), fill: wash(colors.empirical, WASH) };
    });
    spotGrid(g.rowX, ry, 1, M.HIDDEN_IN.length, s.cw, s.ch, (_, c) =>
      (row.input
        ? `x[0, ${c}] = ${num(row.vals[c])}`
        : c < walk.done
          ? `${row.name}(x)[0, ${c}] = ${num(row.vals[c])}`
          : `${row.name}(x)[0, ${c}], not computed yet`));
  });
  return g;
}

/* ============================= 5 · Dropout ================================= *
 * DECISION 13: THE SCALING IS ITS OWN ROW. `_lab/figs/dl-layer-dropout.png`
 * draws four rows — the input, the Dropout box, a "random dropout" row with the
 * dropped cells empty, and a "scale remaining activations" row — and folding
 * the last two into one output row hides the half the page is about. So
 * Training is x → Dropout(p) → m ⊙ x → y, and ONE Next cell lands the masked
 * cell on the step's LIGHTING phase and the scaled cell under it on its
 * LANDING phase, which is the sibling's lit-then-glide read down the column
 * instead of across it. Evaluation has no mask, so there is nothing to draw
 * between x and y and it keeps its two rows.
 *
 * DECISION 14: THE MASKED ROW CARRIES THE INPUT'S OWN COLOUR. Its numbers ARE
 * x's numbers with holes in them, and the arrow below is where they change, so
 * `--c-empirical` starts at the row the scaling produces.
 */

const DROP_ARROW = 26;    // x → the Dropout box
const DROP_BOX = 24;      // the Dropout box
const DROP_ARROW2 = 30;   // the box → the masked row
const DROP_ARROW3 = 30;   // the masked row → the output row

/** The two annotations that sit at the arrows, in the column right of the rows. */
function dropAnns(params) {
  const p = Number(params.p);
  return params.mode !== "evaluation"
    ? [`kept with probability ${(1 - p).toFixed(1)}`, `× ${(1 / (1 - p)).toFixed(2)}`]
    : ["nothing is dropped", "y = x, value for value"];
}

function dropAnnW(ctx, colors, params) {
  ctx.font = `${colors.fsXs} ${colors.font}`;
  return 12 + Math.ceil(Math.max(...dropAnns(params).map((s) => ctx.measureText(s).width)));
}

function dropGeom(ctx, colors, w, params) {
  const annW = dropAnnW(ctx, colors, params);
  const s = fitSizes(w, (z) => M.bandWidth.dropout(z, annW));
  const shape = [M.DROP_ROWS, M.DROP_COLS];
  const training = params.mode !== "evaluation";
  /* A PRINT IS HEADED BY ITS OWN NAME, as the sibling's are, so the block under
     the band cannot be read as the print of the grid it sits below (Kenneth,
     round 1). The heading costs LBL. */
  const printH = PRINT_DROP + LBL + M.printRows(shape) * PRINT_LH;
  const rowH = M.DROP_ROWS * s.ch;
  const h1 = LBL + rowH + DROP_ARROW + DROP_BOX + DROP_ARROW2
    + (training ? rowH + DROP_ARROW3 : 0) + rowH + 2 * printH;
  const capY = BAND_HEAD + h1 + CAP_GAP;
  const caps = captionLines(ctx, colors, w, params);
  return {
    s, annW, shape, training, printH, h1, y1: 0, capY, caps,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawDrop(ctx, colors, w, params, state, anim) {
  const g = dropGeom(ctx, colors, w, params);
  const walk = walkAt(anim, state, params);
  const { s } = g;
  const p = Number(params.p);
  const training = state.training;
  const rowW = M.DROP_COLS * s.cw;
  const gx = PAD + DROP_GUT;
  const rowH = M.DROP_ROWS * s.ch;
  const [annDrop, annScale] = dropAnns(params);
  const at = walk.idx >= 0 ? { r: Math.floor(walk.idx / M.DROP_COLS), c: walk.idx % M.DROP_COLS } : null;
  const ord = (r, c) => r * M.DROP_COLS + c;

  /** DECISION 13: the masked cell lands on the phase the step lights on. */
  const maskArrival = (k) =>
    (k < walk.done ? 1 : walk.moving && k === walk.idx ? walk.light : 0);

  /**
   * One cell of the masked row or the output row. DECISION 10: a dropped cell
   * and one the walk has not reached are both empty. The cell IN FLIGHT keeps
   * its highlight frame either way, in both rows, because the frame says where
   * the step is and a dropped cell has to be somewhere while it is drawn.
   */
  const dropCell = (r, c, a, value, hue) => {
    const flight = Boolean(at) && at.r === r && at.c === c;
    if (a <= 0 || !state.mask[r][c]) return flight ? { empty: true, lit: true } : { empty: true };
    return flight
      ? { text: M.n2(value), ...litFace(colors, a) }
      : { text: M.n2(value), fill: wash(hue, WASH) };
  };

  const rowName = (name, cy) =>
    txt(ctx, colors, `${name}  ${shapeText(g.shape)}`, gx - 8, cy + s.ch,
      { color: colors.ink2, align: "right", baseline: "middle", mono: true });

  /** A down arrow in its own slot, with the note that says what it does. */
  const step = (cy, slot, note, color) => {
    arrow(ctx, gx + rowW / 2, cy + 6, gx + rowW / 2, cy + slot - 6, colors.ink3, 2);
    if (note) {
      txt(ctx, colors, note, gx + rowW + 12, cy + slot / 2 + 0.5,
        { color: color ?? colors.ink3, baseline: "middle", size: colors.fsXs });
    }
  };

  const y = band(ctx, colors, g.y1, w, training ? "Training" : "Evaluation",
    training ? `y = (m ⊙ x) / (1 − ${p})` : "y = x");
  rowName("x", y + LBL);
  grid(ctx, colors, gx, y + LBL, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
    ({ text: M.n2(M.XD[r][c]), hue: colors.groupA,
      ...(at && at.r === r && at.c === c ? litFace(colors, walk.light) : {}) }));
  spotGrid(gx, y + LBL, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
    `x[${r}, ${c}] = ${num(M.XD[r][c])}`);

  let cy = y + LBL + rowH;
  step(cy, DROP_ARROW);
  cy += DROP_ARROW;
  ctx.fillStyle = wash(colors.groupB, 0.2);
  ctx.fillRect(gx, cy, rowW, DROP_BOX);
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(gx + 0.5, cy + 0.5, rowW - 1, DROP_BOX - 1);
  txt(ctx, colors, training ? `Dropout(p = ${p})` : `Dropout(p = ${p}), eval`,
    gx + rowW / 2, cy + DROP_BOX / 2 + 0.5,
    { color: colors.ink1, align: "center", baseline: "middle", mono: true });
  cy += DROP_BOX;
  step(cy, DROP_ARROW2, annDrop);
  cy += DROP_ARROW2;

  /* THE MASK'S OWN ROW (decision 13): a survivor still carries the value it
     came in with, so this row is the input with holes in it. */
  if (training) {
    rowName("m ⊙ x", cy);
    const my = cy;
    grid(ctx, colors, gx, my, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
      dropCell(r, c, maskArrival(ord(r, c)), M.XD[r][c], colors.groupA));
    spotGrid(gx, my, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
      (maskArrival(ord(r, c)) > 0
        ? (state.mask[r][c]
          ? `(m ⊙ x)[${r}, ${c}] = ${num(M.XD[r][c])}, kept`
          : `(m ⊙ x)[${r}, ${c}] = 0, dropped`)
        : `(m ⊙ x)[${r}, ${c}], not computed yet`));
    cy += rowH;
    step(cy, DROP_ARROW3, annScale, colors.highlight);
    cy += DROP_ARROW3;
  }

  rowName("y", cy);
  const oy = cy;
  grid(ctx, colors, gx, oy, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
    dropCell(r, c, arrival(walk, ord(r, c)), state.y[r][c], colors.empirical));
  spotGrid(gx, oy, M.DROP_ROWS, M.DROP_COLS, s.cw, s.ch, (r, c) =>
    (ord(r, c) < walk.done
      ? `y[${r}, ${c}] = ${num(state.y[r][c])}${state.mask[r][c] ? "" : ", dropped"}`
      : `y[${r}, ${c}], not computed yet`));
  if (!training) {
    txt(ctx, colors, annScale, gx + rowW + 12, oy + s.ch,
      { color: colors.ink3, baseline: "middle", size: colors.fsXs });
  }
  cy += rowH;

  /* THE PRINTS ARE WHERE THE ZEROS ARE. A dropped cell is drawn empty, and the
     tensor torch holds carries 0.0000 there, so the print is the one place a
     reader sees what the layer actually passed on. Each is headed by its own
     name, because at the first render y's grid is empty and an unheaded print
     under it reads as y's (Kenneth, round 1). */
  let py = cy + PRINT_DROP;
  label(ctx, colors, PAD, py + 11, "x", g.shape, colors.ink2);
  printBlock(ctx, colors, PAD, py + LBL, g.shape, ([r, c]) => M.XD[r][c]);
  py += LBL + M.printRows(g.shape) * PRINT_LH + PRINT_DROP;
  label(ctx, colors, PAD, py + 11, "y", g.shape, colors.ink2);
  if (walk.done > 0) {
    printBlock(ctx, colors, PAD, py + LBL, g.shape, ([r, c]) => state.y[r][c],
      ([r, c]) => ord(r, c) < walk.done);
  }
  return g;
}

/* ============================== the captions =============================== */

function pageCaptions(params) {
  switch (params.block) {
    case "pooling":
      return [
        "The stride equals the window, so the windows tile the image and no input value is read twice.",
        "Pooling has no parameters. Max keeps the window's largest value and average keeps the mean of its "
        + "values, so the two differ most at the edge of the bright square.",
      ];
    case "normalization":
      return params.norm === "layer"
        ? [
          "Each row is standardized on the mean and standard deviation of its own four features, "
          + "so the other sample changes nothing.",
          "γ and β are learned, and they let the layer restore any scale and shift the next layer needs.",
        ]
        : [
          "Each column is standardized on the mean and standard deviation of the four samples in the batch, "
          + "so a sample's value depends on the samples it was batched with.",
          "γ and β are learned, and they let the layer restore any scale and shift the next layer needs.",
        ];
    case "activation":
      if (params.use === "sigmoid") {
        return [
          "The sigmoid turns one score into the probability of one outcome: a score of 2 is 0.881, "
          + "and each row is a case on its own.",
          "BCEWithLogitsLoss applies the sigmoid itself, so a model trained with it ends at the score.",
        ];
      }
      if (params.use === "softmax") {
        return [
          "The softmax turns a row of scores into a distribution over the five classes: row 1 is five "
          + "zeros, so every probability is 0.2 and the row sums to 1.0000.",
          "CrossEntropyLoss applies the softmax itself, so a model trained with it ends at the scores.",
        ];
      }
      return [
        "At x = −2 the three give 0.00, −0.05 and −0.24, so only ReLU sets a negative input to exactly zero.",
        "Each function is applied element by element, so the shape of the tensor is unchanged.",
      ];
    case "dropout":
      return params.mode === "evaluation"
        ? [
          "At evaluation the layer applies no mask and no scaling, so the output carries the input's own numbers.",
          "The scaling during training is what lets the values pass through unchanged here and still have the "
          + "same expected sum.",
        ]
        : [
          `The survivors are scaled by 1 / (1 − ${params.p}) = ${(1 / (1 - Number(params.p))).toFixed(2)}, `
          + "so the output sum matches the input sum on average.",
          "One draw can sit far from that average: at p = 0.8 the spread of the output sum is about twice the "
          + "input sum, and about one draw in ten loses every cell.",
        ];
    default:
      return [
        "The table holds one row per residue, drawn from N(0, 1) and trained with the rest of the model.",
        `The input is integer ids, and the lookup adds a dimension: ${shapeText([M.EMB_ROWS, M.EMB_COLS])} `
        + `becomes ${shapeText([M.EMB_ROWS, M.EMB_COLS, Number(params.dim)])}.`,
      ];
  }
}

function captionLines(ctx, colors, w, params) {
  return pageCaptions(params).flatMap((line) => wrapLines(ctx, colors, line, w - 2 * PAD));
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
const row = (...xs) => xs.join("");

const eq = (mathml, plain) => (MATHML ? mml(mathml) : plain);

const CARD = {
  embed: eq(
    row(msub(mi("h"), mi("i")), mo("="), mi("Embedding"), mo("("), msub(mi("id"), mi("i")), mo(")"),
      mo("∈"), msup(mi("ℝ"), mi("d"))),
    "h_i = Embedding(id_i) ∈ ℝ^d"),
  hat: eq(
    row(mi("x̂"), mo("="), frac(row(mi("x"), mo("−"), mi("μ")), mi("σ"))),
    "x̂ = (x − μ) / σ"),
  affine: eq(
    row(mi("y"), mo("="), mi("γ"), mi("x̂"), mo("+"), mi("β")),
    "y = γx̂ + β"),
  relu: eq(row(mi("y"), mo("="), mi("max"), mo("("), mn("0"), mo(","), mi("x"), mo(")")),
    "y = max(0, x)"),
  gelu: eq(row(mi("y"), mo("="), mi("x"), mo("·"), mi("Φ"), mo("("), mi("x"), mo(")")),
    "y = x · Φ(x)"),
  silu: eq(row(mi("y"), mo("="), mi("x"), mo("·"), mi("σ"), mo("("), mi("x"), mo(")")),
    "y = x · σ(x)"),
  sigmoid: eq(
    row(mi("p"), mo("="), frac(mn("1"), row(mn("1"), mo("+"), msup(mi("e"), row(mo("−"), mi("x")))))),
    "p = 1 / (1 + e^−x)"),
  softmax: eq(
    row(msub(mi("p"), mi("j")), mo("="), frac(msup(mi("e"), msub(mi("x"), mi("j"))),
      row(mo("∑"), msup(mi("e"), msub(mi("x"), mi("k")))))),
    "p_j = e^(x_j) / ∑ e^(x_k)"),
  dropTrain: eq(
    row(mi("y"), mo("="), frac(row(mo("("), mi("m"), mo("⊙"), mi("x"), mo(")")),
      row(mn("1"), mo("−"), mi("p")))),
    "y = (m ⊙ x) / (1 − p)"),
  dropEval: eq(row(mi("y"), mo("="), mi("x")), "y = x"),
};

/** The card's rows and its note, for the page on screen. */
function cardFor(params) {
  switch (params.block) {
    case "pooling": {
      const k = Number(params.k);
      const n = M.IMG_N / k;
      return {
        rows: [["out", `⌊(${M.IMG_N} − ${k}) / ${k}⌋ + 1 = ${n}`]],
        note: "out = ⌊(in − kernel_size) / stride⌋ + 1. The stride equals the window here, so the "
          + `windows tile the image and each summary is ${n} × ${n}.`,
      };
    }
    case "normalization":
      return {
        rows: [["x̂", CARD.hat], ["y", CARD.affine]],
        note: params.norm === "layer"
          ? "μ and σ are taken across the four features of one row of one sample, so every row has its own pair. "
            + "eps of 1e-5 is added inside the square root."
          : "μ and σ are taken down one feature across the four samples of the batch, so every column has its "
            + "own pair. eps of 1e-5 is added inside the square root.",
      };
    case "activation": {
      if (params.use === "sigmoid") {
        return {
          rows: [["p", CARD.sigmoid]],
          note: "The sigmoid maps any score to a probability between 0 and 1, one case at a time. "
            + "BCEWithLogitsLoss applies it inside the loss.",
        };
      }
      if (params.use === "softmax") {
        return {
          rows: [["p_j", CARD.softmax]],
          note: "The softmax is taken along dim=1, so each row becomes a distribution over the five classes "
            + "and sums to 1. CrossEntropyLoss applies it inside the loss.",
        };
      }
      const chosen = M.actByKey(params.fn);
      return {
        rows: [[chosen.label, CARD[chosen.key]]],
        note: chosen.key === "relu"
          ? "ReLU sets every negative input to zero, so a unit whose input stays negative passes nothing on."
          : chosen.key === "gelu"
            ? "Φ is the standard normal cumulative distribution, so GELU scales an input by how far it sits "
              + "above the middle of that distribution."
            : "σ is the sigmoid, so SiLU scales an input by a number between 0 and 1 that rises with it.",
      };
    }
    case "dropout":
      return {
        rows: params.mode === "evaluation" ? [["y", CARD.dropEval]] : [["y", CARD.dropTrain]],
        note: params.mode === "evaluation"
          ? "At evaluation the mask is gone and the values pass through unchanged, which is what "
            + "model.eval() switches on."
          : `m is 1 where a cell survives and 0 where it is dropped, and the division by 1 − p = `
            + `${(1 - Number(params.p)).toFixed(1)} scales the survivors up.`,
      };
    default:
      return {
        rows: [["h_i", CARD.embed]],
        note: `The table is [${M.VOCAB.length}, ${params.dim}], one row per residue, and the lookup copies `
          + "that row out whole. The rows are learned with the rest of the model.",
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
  const key = [params.block, params.dim, params.k, params.norm, params.use, params.fn,
    params.mode, params.p].join(":");
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

/** The stage height for any page, from the parameters alone. */
function pageHeight(w, params) {
  const ctx = measureCtx();
  const colors = readTokens();
  switch (params.block) {
    case "pooling": return poolGeom(ctx, colors, w, params).height;
    case "normalization": return normGeom(ctx, colors, w, params).height;
    case "activation": return actGeom(ctx, colors, w, params).height;
    case "dropout": return dropGeom(ctx, colors, w, params).height;
    default: return embedGeom(ctx, colors, w, params).height;
  }
}

/* THE THREE HEADS ARE CELL 1'S OWN CATEGORY COLUMN, and they carry the one
   thing the five names do not say: Embedding and Pooling change the shape of
   the data, Normalization and Activation change its values, and Dropout is
   there for training alone (mock section 1, Kenneth's pick). */
const REPRESENTATION = "Representation & Aggregation";
const CONDITIONING = "Normalization & Activation";
const REGULARIZATION = "Regularization";

const BLOCKS = [
  { value: "embedding", label: "Embedding", group: REPRESENTATION },
  { value: "pooling", label: "Pooling", group: REPRESENTATION },
  { value: "normalization", label: "Normalization", group: CONDITIONING },
  { value: "activation", label: "Activation", group: CONDITIONING },
  { value: "dropout", label: "Dropout", group: REGULARIZATION, span: true },
];

const ON = (block) => ({ param: "block", equals: block });

const STEP_LABELS = {
  embedding: "Next token",
  pooling: "Next window",
  normalization: "Next group",
  /* keyed on the use, through core's nested label (his pick, the copy round):
     the readout counts values, scores and rows, and the button says the same */
  activation: { param: "use", labels: { hidden: "Next value", sigmoid: "Next score", softmax: "Next row" }, default: "Next value" },
  dropout: "Next cell",
};
const STEP_TITLES = {
  embedding: "Copy out the next token's row of the table",
  pooling: "Summarize the next window with both its maximum and its mean",
  normalization: "Standardize the next group on its own mean and standard deviation",
  activation: "Apply the function to the next input and land its output",
  dropout: "Take the next cell through the layer",
};
const RUN_TITLES = {
  embedding: "Look up the remaining tokens",
  pooling: "Summarize the remaining windows",
  normalization: "Standardize the remaining groups",
  activation: "Apply the function to the remaining inputs",
  dropout: "Take the remaining cells through the layer",
};

defineWidget({
  slug: "support-layers",
  title: "Deep Learning - Support Layers",
  status: "shipped",
  subtitle:
    "These layers condition the values passing through a network rather than "
    + "extract features from them. Embedding and pooling change the shape of a "
    + "tensor; normalization, activation and dropout change its values.",
  layout: "side",
  /* Every band is as tall as its content, so the stage is as tall as its bands
     and its wrapped captions — a function of the parameters and the width
     (decision 3). */
  height: ({ w, ...values }) => pageHeight(w, values),

  /* Hovering any cell prints its index and value. An inspector, not a control:
     nothing is written, and with no pointer the figure is exactly as before. */
  pointer: true,

  params: {
    block: {
      type: "segmented",
      label: "Layer",
      style: "grid",
      groupHeads: true,
      detail: "each option is a layer that reshapes or rescales what passes through it",
      options: BLOCKS,
      default: "embedding",
    },

    dim: {
      type: "choice",
      label: "Embedding dimension",
      detail: "how many numbers stand for one residue",
      options: [
        { value: "2", label: "2", detail: "two numbers a residue, so the table is [6, 2]" },
        { value: "4", label: "4", detail: "four numbers a residue, so the table is [6, 4]" },
        { value: "8", label: "8", detail: "eight numbers a residue, and the two sequences stack" },
      ],
      default: "4",
      when: ON("embedding"),
    },

    k: {
      type: "choice",
      label: "Window",
      detail: "the width of the square window, and the stride equals it",
      options: [
        { value: "2", label: "2", detail: "a 2 × 2 window, so 16 becomes 8" },
        { value: "4", label: "4", detail: "a 4 × 4 window, so 16 becomes 4" },
      ],
      default: "2",
      when: ON("pooling"),
    },

    norm: {
      type: "segmented",
      label: "Group",
      detail: "which group the mean and standard deviation are taken over",
      options: [
        { value: "batch", label: "Batch", detail: "down one feature, across the samples of the batch" },
        { value: "layer", label: "Layer", detail: "across the features of one sample, one row at a time" },
      ],
      default: "batch",
      when: ON("normalization"),
    },
    /* ONE IDEA, TWO NUMBERS, ONE LINE (3.4i). A scale and a shift are the pair
       that lets the layer undo its own normalization, and the caption carries
       the noun so each field can carry the quantity. */
    gamma: {
      type: "float",
      label: "γ",
      min: 0,
      max: 3,
      step: 0.5,
      default: 1,
      row: { key: "affine", label: "Scale and shift", detail: "the two learned numbers applied after the standardization" },
      when: ON("normalization"),
    },
    beta: {
      type: "float",
      label: "β",
      min: -3,
      max: 3,
      step: 0.5,
      default: 0,
      row: { key: "affine" },
      when: ON("normalization"),
    },

    /* THE NOTEBOOK'S OWN THREE HEADINGS, and the values a link carries, so the
       word in the URL is the word on the band header (Kenneth, round 1: the
       page called "Probability" left him asking which function it was). The
       detail says the job AND the loss, because the loss is where the last two
       functions actually live. */
    use: {
      type: "segmented",
      label: "Use",
      style: "grid",
      detail: "the same function is used for a hidden value, a probability, or a distribution",
      options: [
        { value: "hidden", label: "Hidden", detail: "a hidden value, where the function makes the network nonlinear" },
        { value: "sigmoid", label: "Sigmoid", detail: "one score to the probability of one outcome, and BCEWithLogitsLoss applies it inside the loss" },
        { value: "softmax", label: "Softmax", detail: "a row of scores to a distribution over the classes, and CrossEntropyLoss applies it inside the loss", span: true },
      ],
      default: "hidden",
      when: ON("activation"),
    },
    /* DISPLAY, AND Hidden ONLY (decision 8): all three output rows are drawn
       whatever this says, so it changes no number and must keep the walk. */
    fn: {
      type: "segmented",
      label: "Curve",
      detail: "which function the panel draws",
      options: M.ACTS.map((a) => ({ value: a.key, label: a.label })),
      default: "relu",
      display: true,
      when: { all: [ON("activation"), { param: "use", equals: "hidden" }] },
    },

    mode: {
      type: "segmented",
      label: "Mode",
      detail: "training drops cells and scales what is left, evaluation passes the input through",
      options: [
        { value: "training", label: "Training", detail: "a fresh mask on every forward pass" },
        { value: "evaluation", label: "Evaluation", detail: "no mask at all, which is what model.eval() switches on" },
      ],
      default: "training",
      when: ON("dropout"),
    },
    p: {
      type: "choice",
      label: "Drop probability",
      detail: "the chance each cell is set to zero",
      options: [
        { value: "0.2", label: "0.2", detail: "one cell in five, and the survivors are scaled by 1.25" },
        { value: "0.5", label: "0.5", detail: "half the cells, and the survivors are scaled by 2.00" },
        { value: "0.8", label: "0.8", detail: "four cells in five, and the survivors are scaled by 5.00" },
      ],
      default: "0.5",
      when: ON("dropout"),
    },
    /* THE ONE PAGE WHERE CHANGING THE DRAW IS THE ARGUMENT. Elsewhere a seed
       would be a question the reader has to rule out before the figure gets
       attention (3.4b), and every other page's operands are fixed draws that
       `model.js` names its seeds for. */
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "a new draw of the mask on the same input",
      when: ON("dropout"),
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: M.SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: tokens, windows, groups,
       inputs or cells, whichever the page counts. */
    shown: { type: "int", min: 0, max: 400, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const first = {
      embedding: "The token ids",
      pooling: "The input image",
      normalization: "The input tensor",
      activation: "The input tensor",
      /* group-a carries two rows at training, because m ⊙ x holds the input's
         own values (decision 14), and the legend names both */
      dropout: params.mode === "training"
        ? "The input tensor, and what the mask leaves of it"
        : "The input tensor",
    }[params.block];
    const second = {
      embedding: "The embedding table, one row per residue",
      pooling: null,
      /* γ and β live in the rail and the card; the figure draws nothing in the
         second-operand colour, so the legend lists none (a legend names only
         what the graph carries) */
      normalization: null,
      activation: null,
      /* the mask is drawn in Training alone; at Evaluation nothing is dropped,
         so a mask entry would name a colour the figure does not carry */
      dropout: params.mode === "training" ? "The dropout mask" : null,
    }[params.block];
    /* THE HIGHLIGHT NAMES THE PAGE'S OWN GROUP, because "the group being
       computed" is the one wording that is true everywhere and specific
       nowhere: a token, a window, a group, an input and a cell are five
       different things and the legend has to say which one is lit. */
    const lit = {
      embedding: "The token being looked up, and the values it reads",
      pooling: "The window being summarized, and the values it reads",
      normalization: "The group being standardized, and the values it reads",
      activation: "The input being transformed, and the values it reads",
      dropout: "The cell being drawn, and the values it reads",
    }[params.block];
    return [
      { token: "group-a", label: first },
      ...(second ? [{ token: "group-b", label: second }] : []),
      { token: "empirical", label: "The output tensor" },
      { token: "highlight", label: lit },
    ];
  },

  compute: ({ params, rng }) => {
    switch (params.block) {
      case "pooling":
        return M.pooling(Number(params.k));
      case "normalization":
        return M.normalization(params.norm, Number(params.gamma), Number(params.beta));
      case "activation":
        return M.activation(params.use);
      /* THE ONE PAGE `seed` REACHES. `model.js` draws the mask from the same
         seed core builds its rng from, and it needs the seed itself rather
         than the stream, because the third readout tile is the mean over
         draws 1 to `seed` and each of those is its own draw (decision 9). */
      case "dropout":
        return M.dropout(Number(params.seed), Number(params.p), params.mode);
      default:
        return M.embedding(Number(params.dim));
    }
  },

  animation: {
    /* Each page advances a different noun, so the label takes the map form
       (3.4c). None is a near-synonym of any lead in the arc. */
    stepLabel: { param: "block", labels: STEP_LABELS, default: "Next token" },
    stepTitle: { param: "block", labels: STEP_TITLES, default: STEP_TITLES.embedding },
    runLabel: "Play",
    runTitle: { param: "block", labels: RUN_TITLES, default: RUN_TITLES.embedding },

    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.units);
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
       of one clock read against another leaves a step stopped between its two
       phases. Switching the curve changes no clock, so a step in flight keeps
       running while the panel redraws under it, which is what makes `fn` safe
       as a display parameter (decision 8). */
    rebuild: (anim, { params, state }) => {
      anim.n = Math.min(anim.n, state.units);
      const ms = M.unitMs(params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    spots = [];
    renderCard(params);
    const g = params.block === "pooling" ? drawPool(ctx, colors, w, params, state, anim)
      : params.block === "normalization" ? drawNorm(ctx, colors, w, params, state, anim)
        : params.block === "activation" ? drawAct(ctx, colors, w, params, state, anim)
          : params.block === "dropout" ? drawDrop(ctx, colors, w, params, state, anim)
            : drawEmbed(ctx, colors, w, params, state, anim);
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

    if (params.block === "pooling") {
      const n = state.n;
      const at = walk.idx >= 0 ? { r: Math.floor(walk.idx / n), c: walk.idx % n } : null;
      return [
        { label: "Input", value: sizeText([1, 1, M.IMG_N, M.IMG_N]), note: "one grayscale channel" },
        {
          label: "Output",
          value: sizeText([1, 1, n, n]),
          note: `${walk.done} of ${state.units} windows taken, and each gives one max and one mean`,
        },
        {
          label: "This window",
          value: at ? `${state.max[at.r][at.c].toFixed(4)}, ${state.avg[at.r][at.c].toFixed(4)}` : "—",
          note: at
            ? `max and mean of the ${state.k} × ${state.k} window at rows `
              + `${at.r * state.k}–${at.r * state.k + state.k - 1}, columns `
              + `${at.c * state.k}–${at.c * state.k + state.k - 1}`
            : "no window has been taken yet",
        },
        {
          label: "Parameters",
          value: "0",
          note: "pooling has nothing to learn, which is what separates it from a strided convolution",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "normalization") {
      const layer = params.norm === "layer";
      const at = walk.idx >= 0 ? state.groupAt(walk.idx) : null;
      const before = at ? state.values(at) : null;
      const after = at ? state.after(at) : null;
      const shape = layer ? [M.SEQ_SAMPLES, M.SEQ_LEN, M.SEQ_F] : [M.BATCH_N, M.BATCH_F];
      return [
        {
          label: "Input",
          value: sizeText(shape),
          note: layer ? "2 samples, 5 positions, 4 features" : "4 samples, 3 features",
        },
        {
          label: "Output",
          value: sizeText(shape),
          note: `${walk.done} of ${state.units} groups standardized`,
        },
        {
          label: "Before",
          value: before ? `${M.mean(before).toFixed(2)}, ${M.sd(before).toFixed(2)}` : "—",
          note: at
            ? (layer ? `mean and sd of row ${at.row} of sample ${at.sample}` : `mean and sd of column ${at.col}`)
            : "no group has been standardized yet",
        },
        {
          label: "After",
          value: after ? `${M.mean(after).toFixed(2)}, ${M.sd(after).toFixed(2)}` : "—",
          note: after
            ? `the same group after γ = ${params.gamma} and β = ${params.beta}`
            : "the mean and sd the same group leaves with",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "activation") {
      if (params.use === "sigmoid") {
        const at = walk.idx >= 0 ? walk.idx : -1;
        return [
          { label: "Input", value: sizeText([M.PROB_IN.length, 1]), note: "5 cases, one score each" },
          {
            label: "Output",
            value: sizeText([M.PROB_IN.length, 1]),
            note: `${walk.done} of ${state.units} scores taken`,
          },
          {
            label: "This score",
            value: at >= 0 ? `${M.PROB_IN[at].toFixed(2)} → ${state.out[at].toFixed(3)}` : "—",
            note: at >= 0
              ? "a score above 0 is a probability above 0.5"
              : "no score has been taken yet",
          },
          {
            label: "Parameters",
            value: "0",
            note: "an activation has nothing to learn, and the shape of the tensor is unchanged",
          },
          cellTile("—", "a cell's index and value"),
        ];
      }
      if (params.use === "softmax") {
        const at = walk.idx >= 0 ? walk.idx : -1;
        return [
          { label: "Input", value: sizeText([M.DIST_IN.length, M.DIST_IN[0].length]), note: "3 cases, 5 classes each" },
          {
            label: "Output",
            value: sizeText([M.DIST_IN.length, M.DIST_IN[0].length]),
            note: `${walk.done} of ${state.units} rows taken`,
          },
          {
            label: "This row",
            value: at >= 0 ? state.out[at].map((v) => v.toFixed(3)).join(", ") : "—",
            note: at >= 0
              ? `the five probabilities sum to ${state.rowSum(at).toFixed(4)}`
              : "no row has been taken yet",
          },
          {
            label: "Parameters",
            value: "0",
            note: "an activation has nothing to learn, and the shape of the tensor is unchanged",
          },
          cellTile("—", "a cell's index and value"),
        ];
      }
      const at = walk.idx >= 0 ? walk.idx : -1;
      return [
        { label: "Input", value: sizeText([1, M.HIDDEN_IN.length]), note: "one row of 5 values" },
        {
          label: "Output",
          value: sizeText([1, M.HIDDEN_IN.length]),
          note: `${walk.done} of ${state.units} values taken, through all three functions`,
        },
        {
          label: "This value",
          value: at >= 0 ? M.HIDDEN_IN[at].toFixed(2) : "—",
          note: at >= 0
            ? `ReLU ${state.out[0][at].toFixed(2)}, GELU ${state.out[1][at].toFixed(2)}, `
              + `SiLU ${state.out[2][at].toFixed(2)}`
            : "no value has been taken yet",
        },
        {
          label: "Parameters",
          value: "0",
          note: "an activation has nothing to learn, and the shape of the tensor is unchanged",
        },
        cellTile("—", "a cell's index and value"),
      ];
    }

    if (params.block === "dropout") {
      const training = params.mode !== "evaluation";
      return [
        {
          label: "Input",
          value: sizeText([M.DROP_ROWS, M.DROP_COLS]),
          note: "2 samples, 5 features",
        },
        {
          label: "Output",
          value: sizeText([M.DROP_ROWS, M.DROP_COLS]),
          note: `${walk.done} of ${state.units} cells taken`,
        },
        { label: "Input sum", value: M.DROP_IN_SUM.toFixed(3), note: "the sum of all 10 values" },
        {
          label: "Output sum",
          value: state.outSum.toFixed(3),
          /* A DRAW THAT KEEPS NOTHING NEEDS ITS OWN LINE: "0 of the 10 cells
             survived this draw, and each was scaled by 5.00" names a scaling
             that was applied to no value at all. At p = 0.8 it is about one
             draw in ten, so it is a state a reader meets. */
          note: training
            ? (state.kept === 0
              ? "no cell survived this draw, so the output sum is 0.000"
              : `${state.kept} of the 10 cells survived this draw, and each was scaled by ${state.scale.toFixed(2)}`)
            : "every value passes through, so the two sums agree exactly",
        },
        training
          ? {
            label: "Mean output sum",
            value: state.meanSum.toFixed(3),
            /* DECISION 9: over the seeds, not over the presses, so the number
               is reproducible from the URL. */
            note: `over draws 1 to ${params.seed}, against an input sum of ${M.DROP_IN_SUM.toFixed(3)}`,
          }
          : {
            label: "Difference",
            value: (state.outSum - M.DROP_IN_SUM).toFixed(3),
            note: "the output is the input, value for value",
          },
        cellTile("—", "a cell's index and value"),
      ];
    }

    const dim = Number(params.dim);
    const at = walk.idx >= 0 ? state.tokenAt(walk.idx) : null;
    const id = at ? M.TOKENS[at.i][at.j] : null;
    return [
      { label: "Input", value: sizeText([M.EMB_ROWS, M.EMB_COLS]), note: "2 sequences of 3 residues, as integer ids" },
      {
        label: "Output",
        value: sizeText([M.EMB_ROWS, M.EMB_COLS, dim]),
        note: `${walk.done} of ${state.units} tokens looked up`,
      },
      {
        label: "This token",
        value: at ? `${id}, residue ${M.VOCAB[id]}` : "—",
        note: at
          ? `row ${id} of the table: ${state.table[id].map((v) => v.toFixed(2)).join(", ")}`
          : "no token has been looked up yet",
      },
      {
        label: "Parameters",
        value: String(M.VOCAB.length * dim),
        note: `a [${M.VOCAB.length}, ${dim}] table, learned with the rest of the model`,
      },
      cellTile("—", "a cell's index and value"),
    ];
  },
});
