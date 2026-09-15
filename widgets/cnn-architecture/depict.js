/* ============================================================================
   Widget 61 · depict.js — THE MOTIF, and it is meant to be imported.

   Kenneth, 2026-09-14: *"we want to see how to build something that the same
   motif can be used for other lessons later in PHM5005"*, and then, on the
   depiction mock: *"we'll test it here first, when mature, will move to core
   for deep learning widgets"*. So this file is the one drawing of a network
   this collection has, written in the widget that needed it first.

   WHAT IS EXPECTED TO IMPORT IT, and what each would pass in:

     · a U-Net (slot 65) — the encoder's columns run out, the decoder's columns
       run back, and a skip is an EDGE from an encoder column to the decoder
       column it concatenates into. `galleryLayout` already stacks a column and
       `fanIn` already draws a line between two thumbnails, so a skip is the
       line this file draws, taken across instead of along.
     · a backbone with a replaced head (slot 63) — one stage list with a run of
       them flagged frozen, and a bracket over that run. The split is a property
       of the stages, not a second figure.
     · a sequence model — `shape` is [T, C], the thumbnail is a strip rather
       than a square, and the column's stack is the time axis.

   IT MOVES TO `widgets/core/` ON THE THIRD IMPORTER, which is this repo's own
   trigger (5.8) and not a day sooner: a change under `widgets/core/` is the one
   kind that can reach a widget nobody is looking at, so it costs a full
   fingerprint suite, and this module is going to move while 63, 64 and 65 are
   being drawn. Widget 55 imported widget 48's relief from the widget that wrote
   it, for exactly this reason.

   WHAT IT DELIBERATELY DOES NOT HOLD: colours, fonts, captions, or any string a
   reader sees. 5.8 says one drawing lives in one place; 5.9 says every
   reader-facing string is the widget's, because the same picture says a
   different thing in each lesson. Everything here is arithmetic over rectangles.

   AND IT DOES NOT COMPUTE THE MAPS. `model.js` runs the kernels and hands the
   results in as data, for two reasons. The maps are seeded arithmetic and
   `compute()` is where seeded arithmetic belongs (1.4, non-negotiable 6); and
   the three widgets above each bring their OWN engine — a U-Net's decoder, a
   frozen backbone's real activations — so a motif that owned one engine could
   not be the motif. `stagesOf` takes the network and the maps and returns what
   a drawing needs; nothing below ever looks at a pixel value.
   ========================================================================= */

/* --- the frame ------------------------------------------------------------ *
 * The stage is 550px wide where the mock was drawn and reviewed and where the
 * fingerprint frame lands, and 770px where the side layout is widest. `t` runs
 * 0 to 1 between them and the lengths that carry a picture are interpolated on
 * it; text does not scale, because the faces come from the tokens.            */

export const PAD = 14;
export const STAGE_REF = 550;
export const STAGE_WIDE = 770;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const growth = (w) => clamp01((w - STAGE_REF) / (STAGE_WIDE - STAGE_REF));
const lerp = (a, b, w) => a + (b - a) * growth(w);

/** How many channels of a layer are drawn; the rest are printed as a count. */
export const SHOWN = 4;

/**
 * How many values a head column draws when the head is one long vector.
 *
 * FLATTEN IS A STRIP AND GLOBAL AVERAGE POOLING IS FOUR CELLS (Kenneth's pick
 * A, `_lab/cnn-round5-mock.html` §3): the two heads differ in that one hands
 * the linear layer a list and the other hands it one value a channel, and four
 * cells under both said the opposite. 49 is one channel of the smallest last
 * feature map any control reaches (7 × 7), so the strip is a whole channel
 * there and the first 49 of one channel everywhere else; at the column height
 * the gallery already uses it is about 4.7px a cell, above `CELL_MIN`, so every
 * drawn value can still be its own target.
 */
export const STRIP = 49;

/* ==========================================================================
   WHAT A NETWORK IS, FOR A DRAWING.

   `net` is `model.js`'s: a list of tensor stages and a list of the operations
   between them. `maps` is what `model.js` computed: `stages[i]` is an array of
   `SHOWN` maps for stage i (the input carries one), `head` is the vector the
   head produces and `scores` is what the linear layer produces.
   ====================================================================== */

/**
 * One entry a column of the figure: the tensor stages, then the head, then the
 * linear layer. `op` is what `receptiveField` walks back through; a stage that
 * changes no shape carries none.
 */
export function stagesOf(net, maps, names = {}) {
  const out = net.stages.map((s, i) => ({
    index: i,
    name: s.name,
    kind: s.kind,                       // input | conv | pool
    shape: [s.C, s.H, s.H],
    C: s.C,
    H: s.H,
    changed: s.changed,
    /** whether this stage's drawn kernels read every input channel at once,
        which is a different arithmetic line and so a different detail band */
    multi: Boolean(s.multi),
    shown: i === 0 ? 1 : SHOWN,
    maps: maps.stages[i] ?? null,
    op: i === 0 ? null : net.layers[i - 1],
    spatial: true,
    /** which channel of the stage before it a drawn channel is computed from */
    reads: i === 0 ? null : (c) => c,
  }));
  /* HOW MANY CELLS THE HEAD COLUMN DRAWS IS THE ENGINE'S ANSWER, not a constant
     here: the drawing asks how many values it was handed. A head that averages
     a channel hands over one a channel and the column is four cells; a head
     that unrolls the feature map hands over a list and the column is a strip.
     Keeping it a property of the data is what lets the U-Net and the backbone
     widgets bring their own heads without a flag here. */
  const headShown = Math.min(maps.head?.length ?? SHOWN, net.headIn);
  out.push({
    index: out.length,
    name: names.head ?? "head",
    kind: "head",
    shape: [net.headIn],
    C: net.headIn,
    H: 1,
    changed: "C",
    shown: headShown,
    /** drawn as one narrow column of cells rather than as SHOWN squares */
    strip: headShown > SHOWN,
    maps: null,
    values: maps.head,
    op: null,
    spatial: false,
    reads: (c) => c,
  });
  out.push({
    index: out.length,
    name: names.linear ?? "linear",
    kind: "linear",
    shape: [net.classes],
    C: net.classes,
    H: 1,
    changed: "C",
    shown: net.classes,
    maps: null,
    values: maps.scores,
    op: null,
    spatial: false,
    reads: null,
  });
  return out;
}

/** The chain, one entry a consecutive pair. A skip would be `kind: "concat"`. */
export const edgesOf = (stages) =>
  stages.slice(1).map((s, i) => ({ from: stages[i].name, to: s.name, kind: "straight" }));

/** The last stage that carries a feature map, which is what "the last" means. */
export const lastSpatial = (stages) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) if (stages[i].spatial) return i;
  return 0;
};

/* ==========================================================================
   THE GALLERY (the mock's §1 A, Kenneth's pick 2026-09-14): one column a
   stage, `SHOWN` channels of each, the pooling columns visibly half the one
   before them because the thumbnail follows H.
   ====================================================================== */

const IN_THUMB = [70, 86];        // the input image, at 550 and at 770
const MAP_THUMB = [56, 68];       // a feature map at the input's own H
const HEAD_CELL = 12;
/* A head column's cell is 12px and its name is three times that, so the column
   is given the name's room instead of the cell's: at 12px the last two columns
   sat 23px apart and "GAP" and "Linear" overlapped on the row above them. */
const HEAD_BOX = 44;
/* the room a strip leaves above and below itself inside the column block, so a
   49-cell column does not run into the shape printed under it */
const STRIP_INSET = 10;
const VGAP = 8;
const GAL_TOP = 58;               // the first thumbnail's top: caption, then note
const GAL_LABELS = 92;            // two alternating blocks of two lines, then the foot:
                                  // 78 put the foot note 6px under the last label row and
                                  // they met in the browser (2026-09-14); 92 leaves 20
const COL_H_MAX = 300;
const NAME_W = [42, 0];           // reserved beside a column for its kernel's name
const NAME_MIN = 24;              // under this the reservation is too narrow to draw into
const GAP_MIN = 10;

/** A thumbnail smaller than this a cell is one target, not one target a cell. */
export const CELL_MIN = 2;

/**
 * Every rectangle of the gallery, for one width and one stage list.
 *
 * `cols[i]` carries `x`, the box `w` it was given (thumbnail plus whatever the
 * kernel's name reserves), the thumbnail `size` and `cellPx`, the `thumbs`
 * themselves, and the two label baselines — which ALTERNATE between a high
 * block and a low one, because a shape like `[128, 7, 7]` is wider than the
 * 14px column it belongs to and two of them on one baseline collide. The
 * verify measures that at the harness's own font metrics.
 */
export function galleryLayout(w, stages) {
  const inT = lerp(IN_THUMB[0], IN_THUMB[1], w);
  const mapT = lerp(MAP_THUMB[0], MAP_THUMB[1], w);
  const H1 = stages[0].H;
  const sizeOf = (s, i) => {
    if (!s.spatial) return HEAD_CELL;
    return i === 0 ? inT : mapT * (s.H / H1);
  };
  const counts = stages.map((s) => s.shown);
  const sizes = stages.map(sizeOf);

  /* the tallest column decides the block, and nothing is taller than the first
     feature map's four thumbnails. A STRIP TAKES THE BLOCK RATHER THAN SETTING
     IT: 49 cells at 12px would be 588px of column, so the strip is fitted into
     the height the rest of the figure already has and its cell follows. */
  const colH = Math.min(COL_H_MAX, Math.max(
    ...stages.filter((s) => !s.strip)
      .map((s) => s.shown * sizeOf(s, s.index) + (s.shown - 1) * (s.spatial ? VGAP : 4))
  ));
  const stripH = colH - 2 * STRIP_INSET;

  /* the kernel's name is reserved beside every feature-map column, and gives
     the reservation back rather than letting the columns touch */
  let nameW = lerp(NAME_W[0], NAME_W[1], 0);
  let gap = 0;
  const boxW = (nw) => stages.map((s, i) =>
    (s.spatial ? sizes[i] + (i > 0 ? nw : 0) : Math.max(sizes[i], HEAD_BOX)));
  for (let guard = 0; guard < 40; guard += 1) {
    const total = boxW(nameW).reduce((a, v) => a + v, 0);
    gap = (w - 2 * PAD - total) / Math.max(1, stages.length - 1);
    if (gap >= GAP_MIN || nameW <= 0) break;
    nameW = Math.max(0, nameW - 3);
  }
  const widths = boxW(nameW);

  let x = PAD;
  const cols = stages.map((s, i) => {
    const size = sizes[i];
    const count = counts[i];
    /* a strip's cells touch and divide the block; every other column's are
       square with a gap between them */
    const cellH = s.strip ? stripH / count : size;
    const pitch = s.strip ? cellH : size + (s.spatial ? VGAP : 4);
    const blockH = s.strip ? stripH : count * size + (count - 1) * (s.spatial ? VGAP : 4);
    const y0 = GAL_TOP + (colH - blockH) / 2;
    const col = {
      index: i,
      kind: s.kind,
      name: s.name,
      spatial: s.spatial,
      x,
      w: widths[i],
      size,
      n: s.spatial ? s.H : 1,
      cellPx: s.spatial ? size / s.H : size,
      count,
      nameX: x + size + 4,
      nameW,
      strip: Boolean(s.strip),
      /** the drawn cells: `size` is the width and `h` the height, and they
          differ only on a strip */
      thumbs: Array.from({ length: count }, (_, c) => ({
        channel: c, x, y: y0 + c * pitch, size, h: cellH,
      })),
      /** the baseline block the column's printed lines use */
      labelRow: i % 2,
    };
    x += widths[i] + gap;
    return col;
  });

  const labelTop = GAL_TOP + colH;
  return {
    cols,
    gap,
    nameW,
    /** whether the reservation is wide enough to print an operator name in */
    showNames: nameW >= NAME_MIN,
    colH,
    top: GAL_TOP,
    midY: GAL_TOP + colH / 2,
    /** the three printed lines of a column, by its own row block */
    lineY: (row, k) => labelTop + 18 + row * 28 + k * 14,
    footY: GAL_TOP + colH + GAL_LABELS - 12,
    height: GAL_TOP + colH + GAL_LABELS,
    right: x - gap,
  };
}

/**
 * The lines into one drawn channel from the channels it is computed from: one
 * a drawn channel of the column before it, the one it actually reads lit. A
 * convolution reads every input channel and four of them are drawn, which is
 * why the faint lines are there at all; pooling reads one, so it draws one.
 */
export function fanIn(lay, col, channel) {
  if (col < 1) return [];
  const a = lay.cols[col - 1];
  const b = lay.cols[col];
  const t = b.thumbs[Math.min(channel, b.thumbs.length - 1)];
  if (!t) return [];
  const to = [t.x, t.y + (t.h ?? t.size) / 2];
  /* What a column reads (Kenneth's question, 2026-09-14: "no lines connecting
     pool2 to GAP and to Linear?"): a pool cell reads one map and a GAP cell
     reads one whole map, so those are one line each, channel to channel; a
     convolution reads every input channel, so every line is drawn and the
     matching channel lit; a Linear score reads every GAP value, so every line
     is lit. */
  const oneToOne = b.kind === "pool" || b.kind === "head" || a.thumbs.length === 1;
  const dense = b.kind === "linear";
  return a.thumbs
    .map((s) => ({
      from: [s.x + s.size, s.y + (s.h ?? s.size) / 2],
      to,
      lit: dense || s.channel === Math.min(channel, a.thumbs.length - 1),
    }))
    .filter((l) => !oneToOne || l.lit);
}

/** The rectangle one cell of a drawn thumbnail occupies. */
export function cellRect(lay, col, channel, row, column) {
  const t = lay.cols[col].thumbs[channel];
  const c = lay.cols[col].cellPx;
  return { x: t.x + column * c, y: t.y + row * c, w: c, h: c };
}

/** The whole of a [lo, hi] × [lo, hi] window on a thumbnail, clipped or not. */
const spanRect = (t, c, n, rows, cols, clip) => {
  const r0 = clip ? Math.max(0, rows[0]) : rows[0];
  const r1 = clip ? Math.min(n - 1, rows[1]) : rows[1];
  const c0 = clip ? Math.max(0, cols[0]) : cols[0];
  const c1 = clip ? Math.min(n - 1, cols[1]) : cols[1];
  return { x: t.x + c0 * c, y: t.y + r0 * c, w: (c1 - c0 + 1) * c, h: (r1 - r0 + 1) * c };
};
export const fullRect = (lay, col, channel, rows, cols) =>
  spanRect(lay.cols[col].thumbs[channel], lay.cols[col].cellPx, lay.cols[col].n, rows, cols, false);
export const clipRect = (lay, col, channel, rows, cols) =>
  spanRect(lay.cols[col].thumbs[channel], lay.cols[col].cellPx, lay.cols[col].n, rows, cols, true);
/** Whether a window is longer than the map it is drawn on, on either axis. */
export const isWide = (lay, col, rows, cols) => {
  const n = lay.cols[col].n;
  return rows[1] - rows[0] + 1 > n || cols[1] - cols[0] + 1 > n;
};
/** Which of the two the lines into the next column start from. */
export const windowRect = (lay, col, channel, rows, cols) =>
  (isWide(lay, col, rows, cols) ? fullRect : clipRect)(lay, col, channel, rows, cols);
/** The marked cell, with a floor so a sub-pixel cell is still something to draw to. */
export function unitRect(lay, col, channel, row, column) {
  const r = cellRect(lay, col, channel, row, column);
  const s = Math.max(3, r.w);
  return { x: r.x, y: r.y, w: s, h: s };
}

/* ==========================================================================
   THE RECEPTIVE FIELD: the nested windows back to the input.

   `r_out = r_in + (k − 1)·jump` run forward and `lo → lo·s − p`,
   `hi → hi·s − p + k − 1` run backward are two derivations of one quantity.
   The figure PRINTS the first and DRAWS the second, so they are asserted equal
   at every stage of every network; this is the backward one, moved here from
   `model.js` because it is what the drawing walks.
   ====================================================================== */

function spansBack(stages, stage, idx) {
  const spans = new Array(stage + 1);
  let lo = idx;
  let hi = idx;
  spans[stage] = [lo, hi];
  for (let i = stage; i >= 1; i -= 1) {
    const op = stages[i].op;
    if (!op) { spans[i - 1] = [lo, hi]; continue; }
    lo = lo * op.s - op.p;
    hi = hi * op.s - op.p + op.k - 1;
    spans[i - 1] = [lo, hi];
  }
  return spans;
}

/**
 * The window one unit of `stage` reads, at every stage from the input up to it,
 * UNCLIPPED — so a window wider than the image is a pair of numbers rather than
 * a special case. A square kernel over a square map is separable, so the rows
 * and the columns are two runs of the same recursion.
 */
export function receptiveField(stages, stage, row, col) {
  if (stage < 1) return { rows: [[row, row]], cols: [[col, col]], r: 1 };
  const rows = spansBack(stages, stage, row);
  const cols = spansBack(stages, stage, col);
  return { rows, cols, r: cols[0][1] - cols[0][0] + 1 };
}

/**
 * The four corner-to-corner lines between two consecutive windows: the frustum
 * the host figure draws from the visual field to one cortical cell. One entry a
 * pair of columns, drawn on the thumbnails themselves.
 */
export function coneOf(lay, stages, stage, channel, row, col) {
  if (stage < 1) return [];
  const { rows, cols } = receptiveField(stages, stage, row, col);
  const out = [];
  for (let i = 0; i < stage; i += 1) {
    const chFrom = i === 0 ? 0 : Math.min(channel, lay.cols[i].thumbs.length - 1);
    const from = windowRect(lay, i, chFrom, rows[i], cols[i]);
    const to = i + 1 === stage
      ? unitRect(lay, i + 1, channel, row, col)
      : windowRect(lay, i + 1, Math.min(channel, lay.cols[i + 1].thumbs.length - 1),
        rows[i + 1], cols[i + 1]);
    out.push({ stage: i + 1, from, to, wide: isWide(lay, i, rows[i], cols[i]) });
  }
  return out;
}

/** The four segments one entry draws. */
export const coneLines = ({ from, to }) => [
  [from.x, from.y, to.x, to.y],
  [from.x + from.w, from.y, to.x + to.w, to.y],
  [from.x, from.y + from.h, to.x, to.y + to.h],
  [from.x + from.w, from.y + from.h, to.x + to.w, to.y + to.h],
];

/* ==========================================================================
   THE DETAIL BAND (the mock's §2 A, Kenneth's pick): the chosen layer's
   operation on this image's own pixels, in the order widget 49's convolutional
   page uses — the map, the window, the kernel, the sum, the map it lands in.

   THE MOCK'S TWO LABEL COLLISIONS ARE FIXED BY THE BASELINES, not by nudging
   an x. `Input [28, 28]` against `Window [3, 3]` collided because both sat on
   one baseline 80px apart, and `conv1 [28, 28]` collided with the sum's index
   for the same reason. Here a MAP's lines sit BELOW its map and a CELL BLOCK's
   line sits above its cells, so the two can never meet however long either
   gets; the verify measures both at the harness's metrics anyway.
   ====================================================================== */

const MAP_S = [66, 82];
const GAP_X = 14;
const OP_W = 22;
const MAX_OP_W = 40;
const LBL = 15;
const CAP_Y = 22;
const SUB_Y = 36;
const TOP_Y = 44;
const LINE_H = 14;
/** the value cells, by kernel size: a 5 × 5 window at the 3 × 3 cell is 200px */
const CELL_W = { 2: 44, 3: 40, 5: 30 };
const CELL_H = { 2: 24, 3: 22, 5: 16 };
/* The kernel's cell is narrower than the window's, but not by a fixed 6px: at
   k = 5 that left 20px for a blur weight printed as 0.11, which is 24px wide
   and ran into the cell beside it. */
const KERN_W = { 3: 34, 5: 26 };

/* THE CROSS-CHANNEL SHAPE (the round-6 mock's §1 measurement). Four windows as
   a 2 × 2 of 3 × 3 grids, four slices as a 2 × 2 beside them, the sum, the
   output map — and no separate input thumbnail, because the four windows ARE
   the four input maps. The value cell is the one the band already draws at
   k = 5, since three values a row have to fit twice over: the mock measured
   four windows and four slices side by side in ONE row at 686px against a
   550px stage, and the four pairs stacked as four rows at 349px of width but
   399px of height, which band 2 would then reserve for every column.

   THE BLOCKS ARE ALWAYS 3 × 3, at either kernel size. At k = 5 the slices are
   the 3 × 3 ones padded with zeros, and twenty value cells across a row does
   not fit any width this stage has: 11 window columns and 10 kernel columns
   need about 22px each where a printed weight is 30px wide. So the band draws
   the 3 × 3 centre, which is the whole of the arithmetic, and says so. */
const MULTI_CW = 30;
const MULTI_CH = 16;
const MULTI_KW = 26;
const MULTI_K = 3;
const MULTI_ACROSS = 2;
const MULTI_LBL = 14;             // the block's own name, above its values
const BLK_GAP = 6;

/**
 * Every rectangle of the detail band, for one width and one stage. `kind` says
 * which of the four shapes it is; the caller draws the glyphs and every string.
 */
export function detailLayout(w, stages, index) {
  const s = stages[index];
  const mapS = lerp(MAP_S[0], MAP_S[1], w);
  const prev = stages[index - 1];
  const base = {
    kind: s.kind, capY: CAP_Y, subY: SUB_Y, top: TOP_Y, mapS,
    labelY: TOP_Y + 11, cellTop: TOP_Y + LBL,
  };

  if (s.kind === "conv" && s.multi) {
    const k = MULTI_K;
    const cw = MULTI_CW;
    const ch = MULTI_CH;
    const kw = MULTI_KW;
    const across = MULTI_ACROSS;
    const rows = Math.ceil(SHOWN / across);
    const winW = across * k * cw + (across - 1) * BLK_GAP;
    const kerW = across * k * kw + (across - 1) * BLK_GAP;
    const cells = winW + OP_W + kerW + OP_W + cw + 4;
    const room = w - 2 * PAD - cells - GAP_X;
    const size = Math.max(40, Math.min(mapS, room));
    let x = PAD;
    const blockAt = (base0, pitch, i) =>
      ({ x: base0 + (i % across) * (k * pitch + BLK_GAP), row: Math.floor(i / across) });
    /* A HEADER ROW OVER EACH BLOCK — "pool1, the four channels read" over the
       windows and "Nucleus, one slice per channel" over the slices. Without it
       the per-block channel names (H edge, V edge, …) read as conv1's kernels
       standing where conv2's should be (Kenneth, round 7, 2026-09-15). */
    const top0 = base.cellTop + MULTI_LBL;
    const rowTop = (r) => top0 + r * (k * ch + MULTI_LBL);
    const winX = x;
    const wins = Array.from({ length: SHOWN }, (_, i) => {
      const b = blockAt(winX, cw, i);
      return { x: b.x, y: rowTop(b.row) + MULTI_LBL, labelY: rowTop(b.row) + 10, k, cw, ch };
    });
    x += winW;
    const blockH = rows * (k * ch + MULTI_LBL);
    const opA = { x, y: top0, w: OP_W, h: blockH };
    x += OP_W;
    const kerX = x;
    const slices = Array.from({ length: SHOWN }, (_, i) => {
      const b = blockAt(kerX, kw, i);
      return { x: b.x, y: rowTop(b.row) + MULTI_LBL, labelY: rowTop(b.row) + 10, k, cw: kw, ch };
    });
    x += kerW;
    const opB = { x, y: top0, w: OP_W, h: blockH };
    x += OP_W;
    const sum = { x, y: top0 + blockH / 2 - ch / 2, w: cw + 4, h: ch };
    x += sum.w + GAP_X;
    const outMap = { x, y: top0, size, n: s.H };
    const cellsBottom = top0 + blockH;
    const heads = { y: base.cellTop + 10, winsX: winX, slicesX: kerX };
    const mapLabel = [top0 + size + 13, top0 + size + 26];
    const productsY = Math.max(cellsBottom, mapLabel[1]) + 16;
    return {
      ...base,
      mapS: size, multi: true, across, wins, slices, opA, opB, sum, outMap, mapLabel, heads,
      productsY, noteY: productsY + LINE_H,
      right: outMap.x + size,
      height: productsY + LINE_H + 12,
    };
  }

  if (s.kind === "conv" || s.kind === "pool") {
    const k = s.op.k;
    const cw = CELL_W[k];
    const ch = CELL_H[k];
    const opW = s.kind === "pool" ? MAX_OP_W : OP_W;
    /* THE CELLS ARE FIXED AND THE MAPS TAKE WHAT IS LEFT. A 5 × 5 window, a
       5 × 5 kernel and two 66px maps is 532px, which fits the 550px stage and
       overruns the 535px one the fingerprint frame draws at by eleven pixels.
       The value cells cannot shrink — a blur weight prints as 0.11 — so the two
       maps carry the difference. */
    const cells = k * cw + opW + (s.kind === "conv" ? k * KERN_W[k] + OP_W : 0) + cw + 4;
    const room = (w - 2 * PAD - cells - 2 * GAP_X) / 2;
    const size = Math.max(40, Math.min(mapS, room));
    let x = PAD;
    const inMap = { x, y: base.cellTop, size, n: prev.H };
    x += size + GAP_X;
    const win = { x, y: base.cellTop, k, cw, ch, w: k * cw, h: k * ch };
    x += k * cw;
    const opA = { x, y: base.cellTop, w: opW, h: k * ch };
    x += opW;
    const kernel = s.kind === "conv"
      ? { x, y: base.cellTop, k, cw: KERN_W[k], ch, w: k * KERN_W[k], h: k * ch }
      : null;
    if (kernel) x += kernel.w;
    const opB = kernel ? { x, y: base.cellTop, w: OP_W, h: k * ch } : null;
    if (opB) x += OP_W;
    const sum = { x, y: base.cellTop + Math.floor(k / 2) * ch, w: cw + 4, h: ch };
    x += sum.w + GAP_X;
    const outMap = { x, y: base.cellTop, size, n: s.H };
    const cellsBottom = base.cellTop + k * ch;
    const mapLabel = [base.cellTop + mapS + 13, base.cellTop + mapS + 26];
    const productsY = Math.max(cellsBottom, mapLabel[1]) + 16;
    return {
      ...base, mapS: size, inMap, win, opA, kernel, opB, sum, outMap, mapLabel,
      productsY, noteY: productsY + LINE_H,
      right: outMap.x + size,
      height: productsY + LINE_H + 12,
    };
  }

  if (s.kind === "head") {
    let x = PAD;
    const inMap = { x, y: base.cellTop, size: mapS, n: prev.H };
    x += mapS + GAP_X;
    const opA = { x, y: base.cellTop, w: MAX_OP_W, h: mapS };
    x += MAX_OP_W;
    const cw = CELL_W[3];
    const ch = CELL_H[3];
    /* A HEAD THAT UNROLLS THE MAP DRAWS ITS FOUR CELLS AS A SQUARE, because
       what they are is a 2 × 2 corner of one feature map; a head that averages
       a channel draws them stacked, because what they are is one value a
       channel. The shape of the block is the argument. */
    const across = s.strip ? 2 : 1;
    const rows = Math.ceil(SHOWN / across);
    const cells = Array.from({ length: SHOWN }, (_, i) => ({
      x: x + (i % across) * (cw + 8),
      y: base.cellTop + Math.floor(i / across) * ch,
      w: cw + 4,
      h: ch,
    }));
    const mapLabel = [base.cellTop + mapS + 13, base.cellTop + mapS + 26];
    const productsY = Math.max(base.cellTop + rows * ch, mapLabel[1]) + 16;
    return {
      ...base, inMap, opA, cells, across, mapLabel, productsY, noteY: productsY + LINE_H,
      right: x + (across - 1) * (cw + 8) + cw + 4,
      height: productsY + LINE_H + 12,
    };
  }

  /* linear: the head's vector, then the scores as a row of bars off a zero
     rule. A COLUMN of nine bars was the first shape and it made this the
     tallest of the four kinds by 60px, which the band would then have had to
     reserve for every pick (see `detailHeight`); a row is the same nine numbers
     in the height the other three already use. */
  const cw = CELL_W[3];
  const ch = CELL_H[3];
  const vec = Array.from({ length: SHOWN }, (_, i) =>
    ({ x: PAD, y: base.cellTop + i * ch, w: cw + 4, h: ch }));
  const barX = PAD + cw + 4 + GAP_X + MAX_OP_W + GAP_X;
  const half = 40;
  const zeroY = base.cellTop + half;
  const room = w - PAD - barX;
  const barW = Math.min(26, (room - (s.C - 1) * 8) / s.C);
  const barGap = (room - s.C * barW) / Math.max(1, s.C - 1);
  const bars = Array.from({ length: s.C }, (_, i) =>
    ({ x: barX + i * (barW + barGap), w: barW }));
  const bottom = Math.max(base.cellTop + SHOWN * ch, zeroY + half);
  return {
    ...base,
    vec,
    opA: { x: PAD + cw + 4 + GAP_X, y: base.cellTop, w: MAX_OP_W, h: SHOWN * ch },
    bars, barW, barGap, barX, zeroY, half,
    productsY: bottom + 16,
    noteY: bottom + 16 + LINE_H,
    right: barX + room,
    height: bottom + 16 + LINE_H + 12,
  };
}
