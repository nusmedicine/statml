/* ============================================================================
   Widget 54 · Loss functions — what a loss takes in, what it does inside, and
   the one number it returns.

   PHM5005 05-4 cells 30-40: cell 30's table of losses by task, then MSELoss
   (cells 31-33), CrossEntropyLoss (34-36) and BCEWithLogitsLoss (37-39). One
   page per ROW of cell 30's table, each opening on that cell's own example,
   and a fourth for the two-class case both ways — softmax over two scores
   against the sigmoid of their difference, which is the same number
   (`_lab/dl-loss-torch.py` §6). Each page draws one output or several, on a
   control of its own.

   NOTHING HERE IS RANDOM. Every number is the notebook's own arithmetic on the
   notebook's own tensors, so the widget takes no seed and `compute` ignores the
   rng it is handed. `_lab/dl-loss-measure.mjs` prints every one of them and
   `_lab/loss-functions-verify.mjs` asserts them against this file.

   THE CONFUSION THE WIDGET EXISTS FOR (Kenneth, 2026-09-11: "students often get
   confused when to use CrossEntropyLoss and BCEWithLogitsLoss") is made
   structural rather than captioned: softmax over the ROW, where the classes
   compete for one unit of probability and the target is one class index stored
   as long, against sigmoid PER CLASS, where each class carries its own yes/no
   and the target is a 0 or a 1 per class stored as float32. The two pages print
   1.0000 and 2.7476 in the same column of the same figure.

   `main.js` draws these and nothing else. The GEOMETRY lives here too — the
   mock `_lab/loss-functions-mock.html` is the geometry of record and `layout()`
   is its arithmetic — because `height` and `draw` ask the same function (5.8)
   and the verify script has to measure the same stage the widget draws.
   ========================================================================= */

import { shapeText } from "../core/torch.js";

/* --- arithmetic ------------------------------------------------------------ */

export const sum = (v) => v.reduce((a, b) => a + b, 0);
export const mean = (v) => sum(v) / v.length;
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export function softmax(v) {
  const m = Math.max(...v);
  const e = v.map((z) => Math.exp(z - m));
  const s = sum(e);
  return e.map((z) => z / s);
}

export const n1 = (v) => v.toFixed(1);
export const n2 = (v) => v.toFixed(2);
/* Four decimals and no more. `loss.item()` prints a float32, and the measure
   script §5 checks that float32 and float64 agree on all three numbers to four
   places and not to six. */
export const n4 = (v) => v.toFixed(4);

/* --- the three losses ------------------------------------------------------ *
 * Written as the notebook writes them, one batch of one sample. The stable form
 * of the BCE term (torch's own, max(z,0) − z·y + log(1 + e^−|z|)) agrees with
 * the textbook one to 1.3e−15 over cell 39's row; the textbook form is what the
 * figure draws, because the figure shows the probability first and takes its
 * log second, which is the step the reader is being shown. */
export const mseTerms = (pred, target) => pred.map((p, i) => (p - target[i]) ** 2);
export const gapsOf = (pred, target) => pred.map((p, i) => p - target[i]);
export const bceTerms = (scores, y) =>
  scores.map((z, c) => -Math.log(y[c] ? sigmoid(z) : 1 - sigmoid(z)));
export const bceStable = (scores, y) =>
  scores.map((z, c) => Math.max(z, 0) - z * y[c] + Math.log(1 + Math.exp(-Math.abs(z))));

/* --- the notebook's own examples ------------------------------------------- */

export const LETTERS = ["A", "B", "C", "D", "E"];

/* cell 33 */
export const MSE_PRED = "2.5,0,2.1";
export const MSE_TRUE = "3,-0.5,2";
/* cell 36 */
export const CE_SCORES = "5,0.5,0.1";
export const CE_LABEL = "0";
/* cell 39 */
export const BCE_SCORES = "0.2,-1,0.5,2,-0.3";
export const BCE_Y = [false, true, true, false, false];
/* the Binary page's pair, `_lab/dl-loss-torch.py` §6: softmax([0.5, 2.0]) is
   [0.1824, 0.8176] and sigmoid(2.0 − 0.5) is the same 0.8176, so both forms
   print 0.2014 at label B and 1.7014 at label A. */
export const BIN_SCORES = "0.5,2";
export const BIN_LABEL = "1";

/* --- how many columns a page draws ----------------------------------------- *
 * The count is the number of COLUMNS, and it changes no row — so no page
 * resizes when it moves (the second mock, §1: the one-output Regression stage
 * comes out at 494, the same as the three-output one).
 *
 * ONLY REGRESSION CARRIES ONE (Kenneth, 2026-09-11, structure B): a
 * single-label page is the notebook's three classes and a multi-label page its
 * five, and the two `Classes` controls said in a control what the two faces
 * already say — one class of three is true, any of five can be. The Binary page
 * is the one place the two-class case appears, both ways. */
export const OUTPUT_COUNTS = ["1", "3"];
export const COUNT_DEFAULT = { outputs: "3" };
export const countOf = (params, key) => Number(params[key] ?? COUNT_DEFAULT[key]);

/** How many columns each fixed page draws, for the fields and their hints. */
export const PAGE_N = { "single-label": 3, "multi-label": 5, binary: 2 };
/** The head row over each page's cells. An output is NOT a class (3.7), so
    Regression numbers its columns where the other three letter theirs. */
export const OUTPUT_HEADS = ["1", "2", "3"];
export const headsFor = (kind) => LETTERS.slice(0, PAGE_N[kind]);
/** The class indices the Single-label target can take, fixed at three. */
export const LABEL_OPTIONS = ["0", "1", "2"];

/* THE BAR AXIS IS FIXED, NOT FITTED (2.5). Fitted to the values on screen,
   dragging class A from 5.0 to 1.0 leaves A's own bar at 55px and takes
   untouched B from 7px to 34px — the drag moves every bar except the one under
   the cursor (the mock, §2c). Each range is one the measure script names: the
   score for class 0 is interesting over −2 to 6, a BCE term spans 0.018 to 4.02
   over −4 to 4, and y_pred[0] from −1 to 6 spans a loss of 0.087 to 5.42. */
export const RANGE = {
  regression: [-1, 6],
  "single-label": [-2, 6],
  "multi-label": [-4, 4],
  /* the Binary page's two axes. Both span EIGHT units, so 11px is one unit in
     either column and a score of 1.5 is the same length of bar in both; only
     the zero line differs, which is the one thing the side-by-side reading has
     to be taken carefully. */
  binary: [-2, 6],
  binaryDiff: [-4, 4],
};

/* --- the tensors on the wire ----------------------------------------------- *
 * A tensor is a `text` parameter carrying the row as typed, canonicalised so
 * `?scores=5, 0.5, 0.1` and `?scores=5,0.5,0.1` are one state. Per page rather
 * than shared, because one parameter has one default and class A is 5.0 on the
 * Single-label page and 0.2 on the Multi-label one (the mock, §1c). */

/** The stored form: numbers, comma separated, no spaces, trailing zeros gone. */
export const wire = (list) => list.map((v) => String(Math.round(v * 10) / 10)).join(",");
/** The typed form back to numbers, keeping whatever count was typed. */
export const unwire = (text) =>
  String(text).split(",").map((s) => Number(s.trim())).filter((v) => Number.isFinite(v));

/** The count the field takes, and the axis it is drawn on, applied to what was
    typed. A short row is padded with zeros and a long one truncated, so the
    figure is always drawable; `hintFor` says so under the field before the
    value commits. Clamped to the fixed axis for the same reason: a score of 100
    on a band that runs to 6 is a bar with no top. */
export function fit(list, n, range) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(snap(list[i] ?? 0, range));
  return out;
}
/** One value rounded to a tenth and held inside the axis. */
export const snap = (v, range) =>
  Math.min(range[1], Math.max(range[0], Math.round(v * 10) / 10));

/** The row the FIGURE draws, as canonical text: the first `n` values of what
    was typed, padded and held inside the axis. */
export const parseVec = (text, n, range) => wire(fit(unwire(text), n, range));

/** `parse` for a tensor field: the row AS TYPED, canonicalised and held inside
    the axis, keeping whatever count was entered. The count control decides how
    many of them the figure reads, so a row typed at three outputs is still
    there when the reader switches back to three. */
export const MAX_ROW = 8;
export const parseRow = (text, range) =>
  wire(unwire(text).slice(0, MAX_ROW).map((v) => snap(v, range)));

/** `show` for the same field: the row as a person writes it. */
export const showVec = (text) => unwire(text).join(", ");
/** `show` narrowed to the count the page draws, so the field reads what the
    figure reads. */
export const showRow = (text, n, range) => showVec(parseVec(text, n, range));

/** WHAT THE FIGURE IS DRAWING, for the tensor fields' own `show`. A field is
    handed its stored value and nothing else, so the count it narrows to is
    stashed here by `computeFor` — the one door every page's state comes
    through. */
export const FIELD_N = { pred: 3, target: 3, scores: 3, logits: 5, binaryScores: 2 };

/** `check` for the same field, shown under it while it is typed in. */
export const hintFor = (text, n, noun) =>
  (unwire(text).length === n
    ? null
    : n === 1 ? `one number, for the one ${noun}` : `${WORDS[n]} numbers, one per ${noun}`);
const WORDS = { 1: "one", 2: "two", 3: "three", 5: "five" };

/* --- how far one Play beat is ---------------------------------------------- *
 * The collection's three paces, and the same wording every widget uses (3.7).
 * A row of the loss's computation is one beat. */
export const SPEEDS = [
  { value: "slow", label: "Slow", detail: "1.2 seconds a step" },
  { value: "medium", label: "Medium", detail: "0.7 seconds a step" },
  { value: "fast", label: "Fast", detail: "0.3 seconds a step" },
];
export const unitMs = (speed) => (speed === "slow" ? 1200 : speed === "fast" ? 300 : 700);

/* --- torch's own messages --------------------------------------------------- *
 * BOTH STRINGS ARE TORCH 2.14'S OWN, printed by `_lab/dl-loss-torch.py` on
 * 2026-09-11 and kept in `_lab/dl-loss-torch.txt`, which the verify script
 * reads them against. They were first quoted from memory, and both of those
 * were wrong — a widget prints no torch message torch has not printed.
 *
 *   CrossEntropyLoss(scores [1, 3], target tensor([0.]) float32)
 *   BCEWithLogitsLoss(scores [1, 5], target [[0, 1, 1, 0, 0]] long)
 */
export const torchDtypeError = {
  "single-label": "RuntimeError: expected target dtype to be Long or Byte, but got Float",
  "multi-label": "RuntimeError: result type Float can't be cast to the desired output type Long",
};

/* ============================== the three states ========================== */

/**
 * One door for the state, so `height`, `regions`, `draw` and the verify script
 * cannot each measure a different figure (5.8). Pure: no rng reaches it.
 */
export function computeFor(params) {
  const task = params.task ?? "regression";
  if (task === "binary") {
    FIELD_N.binaryScores = 2;
    return binary(
      fit(unwire(params.binaryScores ?? BIN_SCORES), 2, RANGE.binary),
      Number(params.binaryLabel ?? BIN_LABEL)
    );
  }
  if (task === "single-label") {
    const n = PAGE_N["single-label"];
    FIELD_N.scores = n;
    return singleLabel(
      fit(unwire(params.scores ?? CE_SCORES), n, RANGE["single-label"]),
      Math.min(Number(params.label ?? CE_LABEL), n - 1),
      params.singleDtype ?? "long"
    );
  }
  if (task === "multi-label") {
    const n = PAGE_N["multi-label"];
    FIELD_N.logits = n;
    return multiLabel(
      fit(unwire(params.logits ?? BCE_SCORES), n, RANGE["multi-label"]),
      LETTERS.slice(0, n).map((k) => (params[k] ? 1 : 0)),
      params.multiDtype ?? "float32"
    );
  }
  const n = countOf(params, "outputs");
  FIELD_N.pred = n;
  FIELD_N.target = n;
  return regression(
    fit(unwire(params.pred ?? MSE_PRED), n, RANGE.regression),
    fit(unwire(params.target ?? MSE_TRUE), n, RANGE.regression)
  );
}

export function regression(pred, target) {
  const gaps = gapsOf(pred, target);
  const sq = mseTerms(pred, target);
  return {
    kind: "regression",
    n: pred.length,
    scores: pred,
    target,
    gaps,
    sq,
    loss: mean(sq),
    units: 4,
    sumCol: false,
    bad: false,
    range: RANGE.regression,
  };
}

export function singleLabel(scores, label, dtype) {
  const p = softmax(scores);
  return {
    kind: "single-label",
    n: scores.length,
    scores,
    label,
    p,
    rowSum: sum(p),
    loss: -Math.log(p[label]),
    units: 3,
    sumCol: true,
    /* 2.6: the target's dtype is a control, and one of its arms raises */
    bad: dtype === "float32",
    dtype,
    range: RANGE["single-label"],
  };
}

/**
 * THE BINARY PAGE, both forms of one model. The two-output form is the
 * notebook's own workflow shape (cell 29's `Linear(hidden, 2)` with
 * CrossEntropyLoss); the one-output form reads the same model through the
 * single score z_B − z_A, and softmax over two scores IS the sigmoid of their
 * difference, so the two losses are one number.
 */
export function binary(scores, label) {
  const p = softmax(scores);
  const z = scores[1] - scores[0];
  const sig = sigmoid(z);
  const pOne = label === 1 ? sig : 1 - sig;
  return {
    kind: "binary",
    n: 2,
    scores,
    label,
    z,
    p,
    sig,
    rowSum: sum(p),
    pOne,
    loss: -Math.log(p[label]),
    lossOne: -Math.log(pOne),
    units: 3,
    sumCol: true,
    bad: false,
    range: RANGE.binary,
    rangeOne: RANGE.binaryDiff,
  };
}

export function multiLabel(scores, y, dtype) {
  const p = scores.map(sigmoid);
  const pTrue = p.map((v, c) => (y[c] ? v : 1 - v));
  const terms = pTrue.map((v) => -Math.log(v));
  return {
    kind: "multi-label",
    n: scores.length,
    scores,
    y,
    p,
    rowSum: sum(p),
    pTrue,
    terms,
    loss: mean(terms),
    units: 5,
    /* THE ROW SUM IS THE WHOLE CONTRAST, and the page is five classes, so it is
       always there: 2.7476 under the same head that prints 1.0000 one face
       away. It was conditional while a `Classes` control could narrow the page
       to one, where the sum repeated its own cell. */
    sumCol: true,
    bad: dtype === "long",
    dtype,
    range: RANGE["multi-label"],
  };
}

/* ====================== the walk lands one row a step ======================
 * Composition's decision 14, which the deep-learning pages share: a row is
 * LANDED once its step has run, PREVIEW while it is the next step, and ABSENT
 * until then. A previewed row draws its frame — empty cells, empty chips, its
 * name in `--ink-3` — and no values, so the walk lands values into frames that
 * are already there and nothing below moves. That is what lets a drag on a
 * finished figure keep it finished (4.4).
 *
 * `preview: false` marks a piece with no pale form: the reference tick on a
 * bar, the gap bracket, the loss line, the point on the curve. A name for a
 * number that does not exist yet is the answer drawn early (2.1).
 */
export function stageOf(done, unit, preview = true) {
  if (done >= unit) return "landed";
  if (preview && done + 1 === unit) return "preview";
  return "absent";
}

/**
 * WHICH STEP OWNS WHICH PIECE OF THE FIGURE. One entry per thing the page draws
 * that is not the scores row, so the verify script can assert that every step
 * lands something and that nothing is drawn more than one step ahead.
 */
export function pageUnits(state) {
  if (state.kind === "regression") {
    return [
      { id: "target", unit: 1 },
      { id: "target ticks", unit: 1, preview: false },
      { id: "gap", unit: 2 },
      { id: "gap bracket", unit: 2, preview: false },
      { id: "gap squared", unit: 3 },
      /* the three points are the squared gaps, so they land with the row that
         squares them rather than with the mean that follows */
      { id: "curve points", unit: 3, preview: false },
      { id: "loss", unit: 4, preview: false },
    ];
  }
  if (state.kind === "single-label") {
    return [
      { id: "p", unit: 1 },
      { id: "row sum", unit: 1 },
      { id: "target", unit: 2 },
      { id: "true class lit", unit: 2, preview: false },
      { id: "loss", unit: 3, preview: false },
      { id: "curve point", unit: 3, preview: false },
    ];
  }
  /* THE BINARY PAGE LANDS THE SAME ROW IN BOTH COLUMNS AT EACH STEP: the two
     probability rows together, the two targets together, then the two loss
     lines and the one point they share. */
  if (state.kind === "binary") {
    return [
      { id: "p", unit: 1 },
      { id: "row sum", unit: 1 },
      { id: "target", unit: 2 },
      { id: "loss", unit: 3, preview: false },
      { id: "curve point", unit: 3, preview: false },
    ];
  }
  return [
    { id: "p", unit: 1 },
    { id: "row sum", unit: 1 },
    { id: "target", unit: 2 },
    { id: "p at the true label", unit: 3 },
    { id: "-log p", unit: 4 },
    { id: "loss", unit: 5, preview: false },
    { id: "curve points", unit: 5, preview: false },
  ];
}

/* ============================== the geometry ==============================
 * The mock is the geometry of record (`_lab/loss-functions-mock.html`,
 * 2026-09-11, every section drawn to scale at the real 550 stage). Every
 * constant below is its own, on the geometry the deep-learning widgets share.
 */
export const PAD = 14;          // the stage's own inset
export const GAP = 22;          // between the rows column and the curve
export const LINE = 16;         // one printed line
export const ROW_LBL = 18;      // a row's name line
export const CH = 26;           // one value cell, tall
export const BAR_H = 88;        // the bar band of the scores row
export const EDGE = 26;         // the arrow between two rows, with the function on it
export const BAND_H = 26;       // the stage header and the hairline under it
export const CURVE_W = 200;
/* the Binary page's own panel: the curve sits BELOW two 250px columns rather
   than beside one 300px one, so it takes the width the two columns leave */
export const CURVE_WIDE = 320;
export const CURVE_H = 150;
export const PITCH_CAP = 88;    // a column is never wider than this
export const CAP_GAP = 12;
export const CAPTION_ROWS = 2;  // two caption lines under every figure
/* the −log p panel: p from 0 to 1, loss clipped at 5, which keeps 4.5184 and
   4.9184 — the loss with the label at class 1 or 2 — on the curve */
export const YMAX = 5;
/* the parabola: gap from −3 to 3, gap² to 9 */
export const GAP_LO = -3;
export const GAP_HI = 3;
export const SQ_MAX = 9;

/**
 * Every y the page draws at, and the columns it draws in, from the width and
 * the state alone. `height` and `draw` both call it (5.8), and so does the
 * hit-test that resolves a pointer to a bar.
 */
export function layout(w, state) {
  if (state.kind === "binary") return binaryLayout(w, state);
  const usable = w - 2 * PAD;
  const leftW = usable - CURVE_W - GAP;
  const n = state.n;
  const cols = n + (state.sumCol ? 1 : 0);
  const pitch = Math.min(PITCH_CAP, Math.floor(leftW / cols));
  const x = PAD;
  const top = BAND_H;

  /* the scores row, drawn at every walk position: its name, the bars under the
     class letters, and the shape and dtype line under them */
  let y = top;
  const nameY = y;
  y += ROW_LBL;
  const barY = y;                 // the class letters sit at barY + 12
  const barTop = y + ROW_LBL;
  y += ROW_LBL + BAR_H;
  const dtypeY = y;
  y += LINE + 10;

  const [lo, hi] = state.range;
  const unitPx = BAR_H / (hi - lo);
  const colX = (i) => x + i * pitch + pitch / 2;
  const py = (v) => barTop + BAR_H - ((v - lo) / (hi - lo)) * BAR_H;

  /* the function applied inside the loss, on an arrow down from the first
     column: `softmax over the row`, `sigmoid per class`, or nothing at all */
  const edgeY = y;
  y += EDGE;

  const rows = [];
  const row = (id, unit, kind, label, opts = {}) => {
    const r = { id, unit, kind, label, nameY: y, cellY: y + ROW_LBL };
    y += ROW_LBL + CH;
    if (opts.dtype) { r.dtypeY = y; y += LINE; }
    y += opts.after ?? 12;
    rows.push(r);
    return r;
  };

  let secondEdgeY = null;
  if (state.kind === "regression") {
    row("target", 1, "cells", "Target", { dtype: true });
    secondEdgeY = y;
    y += EDGE;
    row("gap", 2, "cells", "gap", { after: 10 });
    row("gap squared", 3, "cells", "gap²");
  } else if (state.kind === "single-label") {
    row("p", 1, "cells", "p");
    row("target", 2, "chips", "Target", { dtype: true });
  } else {
    row("p", 1, "cells", "p");
    row("target", 2, "chips", "Target", { dtype: true });
    row("p at the true label", 3, "cells", "p at the true label", { after: 10 });
    row("-log p", 4, "cells", "−log p");
  }

  /* the answer, which lands last. Torch's message takes two lines in the rows
     column where the number takes one, and only the Single-label page has to
     reserve them: on Multi-label the loss line is the last thing above the
     caption block, which the second line runs into rather than through. */
  const lossY = y;
  const errorRows = 2;
  y += state.bad && state.kind === "single-label" ? LINE * errorRows + 6 : LINE + 10;

  const rowsH = y - top;
  const capY = top + Math.max(rowsH, CURVE_H) + CAP_GAP;
  return {
    x, leftW, pitch, cols, n, top, nameY, barY, barTop, dtypeY, edgeY, secondEdgeY,
    rows, lossY, rowsH, capY, unitPx, colX, py,
    barW: Math.max(16, Math.round(pitch * 0.56)),
    curveX: PAD + leftW + GAP,
    curveY: top,
    curveW: CURVE_W,
    height: capY + CAPTION_ROWS * LINE + PAD,
  };
}

/**
 * THE BINARY PAGE IS THE SAME FLOW IN TWO COLUMNS, and the two columns run the
 * same rows at the same y — which is the whole argument: the two loss lines
 * sit on one line 272px apart, against 350px with a figure between them when
 * the same two forms are stacked (the second mock, §2). So the vertical flow is
 * measured once and each column carries only its own x, its own column count
 * and its own axis.
 */
function binaryLayout(w, state) {
  const usable = w - 2 * PAD;
  const colW = Math.floor((usable - GAP) / 2);
  const top = BAND_H;

  let y = top;
  const nameY = y;
  y += ROW_LBL;
  const barY = y;
  const barTop = y + ROW_LBL;
  y += ROW_LBL + BAR_H;
  const dtypeY = y;
  y += LINE + 10;
  const edgeY = y;
  y += EDGE;

  const rows = [];
  const row = (id, unit, kind, label, opts = {}) => {
    const r = { id, unit, kind, label, nameY: y, cellY: y + ROW_LBL };
    y += ROW_LBL + CH;
    if (opts.dtype) { r.dtypeY = y; y += LINE; }
    y += opts.after ?? 12;
    rows.push(r);
  };
  row("p", 1, "cells", "p");
  row("target", 2, "chips", "Target", { dtype: true });

  const lossY = y;
  y += LINE + 10;
  const rowsH = y - top;
  const curveY = top + rowsH + GAP;
  const capY = curveY + CURVE_H + CAP_GAP;

  /** One column's own geometry, in the shape `barColAt` and the drawing read. */
  const side = (x, n, sumCol, range) => {
    const cols = n + (sumCol ? 1 : 0);
    const pitch = Math.min(PITCH_CAP, Math.floor(colW / cols));
    const [lo, hi] = range;
    return {
      x, n, cols, pitch, sumCol, barY, barTop,
      barW: Math.max(16, Math.round(pitch * 0.56)),
      colX: (i) => x + i * pitch + pitch / 2,
      py: (v) => barTop + BAR_H - ((v - lo) / (hi - lo)) * BAR_H,
    };
  };

  return {
    x: PAD, leftW: colW, colW, n: state.n, top,
    nameY, barY, barTop, dtypeY, edgeY, secondEdgeY: null,
    rows, lossY, rowsH, capY,
    left: side(PAD, 2, true, state.range),
    right: side(PAD + colW + GAP, 1, false, state.rangeOne),
    ruleX: PAD + colW + GAP / 2,
    curveX: PAD + Math.round((usable - CURVE_WIDE) / 2),
    curveY,
    curveW: CURVE_WIDE,
    height: capY + CAPTION_ROWS * LINE + PAD,
  };
}

/** The stage height for a page, from the parameters and the width alone. */
export const pageHeight = (w, params) => layout(w, computeFor(params)).height;

/* --- the drag --------------------------------------------------------------- *
 * The bar's top is the handle. A gesture is resolved against the value the
 * parameter held when it began, so a slow drag cannot accumulate rounding
 * drift, and the axis is the FIXED one, so a pixel means the same score
 * wherever the bar started. */

/** Which column a point falls in, or −1. The drawing, the hit-test and the
    hover reading all ask this one function (5.8). */
export function barColAt(x, y, g) {
  if (y < g.barTop - 6 || y > g.barTop + BAR_H + 6) return -1;
  for (let i = 0; i < g.n; i += 1) {
    if (Math.abs(x - g.colX(i)) <= g.pitch / 2) return i;
  }
  return -1;
}

/** The value a drag of `dy` puts on a bar that began at `start`. */
export const dragTo = (start, dy, range) =>
  snap(start + -dy / (BAR_H / (range[1] - range[0])), range);

/** The whole tensor after that drag, as the canonical text the field stores.
    A row longer than the count the page draws keeps its tail: the count decides
    how many columns are drawn, and a drag on one of them is no reason to throw
    away what was typed for the others. */
export function dragVec(text, col, dy, n, range) {
  const vals = fit(unwire(text), Math.max(n, unwire(text).length), range);
  if (col < 0 || col >= n) return wire(vals);
  vals[col] = dragTo(vals[col], dy, range);
  return wire(vals);
}

/* ============================ what the reader reads ========================
 * Every string the figure, the rail and the readout show, in one place: the
 * verify script sweeps them for the register 5.9 asks for, and `main.js` has
 * no copy of its own to drift from them.
 */
/* THE FOUR FACES DIVIDE THE WAY THE LOSSES DO (3.4g). One row of four
   truncates — 62.0px for text against Single-label's 64.4px at the pressed
   weight, measured in the second mock's §3 — and the two-column grid that
   fixes the width pairs Regression with Single-label, which is not how the
   four divide. The option groups say the division in the shape.

   THE THREE CLASSIFICATION FACES CARRY A SECOND LINE, and they run commonest
   first (`_lab/loss-rail-mock.html` §1 D and A1, Kenneth's picks 2026-09-11 —
   his own wording, "(1) single-label >2 classes, (2) multi-label >2 classes,
   (3) binary", in his own prevalence order). The count does not fit ON the
   face: at 300px a row of three leaves 86.9px and `Single-label, >2 classes`
   measures 38.9px over it, so two of the three would ship an ellipsis. The
   qualifier is 49.6px at `--fs-xs` on its own line and clears the column.

   AND EVERY DETAIL COUNTS. Each classification line opens with how many
   classes there are and how many of them the target marks — the half a face
   cannot say in any spelling — and all four wrap to the same number of lines,
   so the Task field is one height on every face and the rail does not jog as
   the reader clicks across it (3.4k, reached by the copy). */
export const TASKS = [
  {
    value: "regression",
    label: "Regression",
    group: "Regression",
    detail: "no function applied · y_true is float32, the same shape as y_pred",
  },
  {
    value: "binary",
    label: "Binary",
    qual: "2 classes",
    group: "Classification",
    detail: "one class of two is true, as two outputs or as one"
      + " · softmax over two scores, or sigmoid over their difference",
  },
  {
    value: "single-label",
    label: "Single-label",
    qual: ">2 classes",
    group: "Classification",
    detail: "one class of three is true · softmax over the row"
      + " · y_true is one class index, long",
  },
  {
    value: "multi-label",
    label: "Multi-label",
    qual: ">2 classes",
    group: "Classification",
    detail: "any of five classes can be true · sigmoid per class"
      + " · y_true is 0 or 1 per class, float32",
  },
];

export const HEAD = {
  regression: "Regression · MSELoss",
  "single-label": "Single-label · CrossEntropyLoss",
  "multi-label": "Multi-label · BCEWithLogitsLoss",
  binary: "Binary · two outputs or one",
};
export const HEAD_EXPR = {
  regression: "loss = mean((y_pred − y_true)²)",
  "single-label": "loss = −log p[label]",
  "multi-label": "loss = mean(−log p[y])",
};
/** The Binary page's loss expression NAMES THE TRUE CLASS, and moves when the
    target chip does: at class A both forms return −log p_A. A fixed `−log p_B`
    is false on half the states the page can reach. */
export const binaryExpr = (label) => `loss = −log p_${LETTERS[label]}`;
export const FN_LABEL = {
  regression: "",
  "single-label": "softmax over the row",
  "multi-label": "sigmoid per class",
};
/** The two functions the Binary page applies, one per column. */
export const BIN_FN = { two: "softmax over the row", one: "sigmoid" };
/** The Binary page's four shape and dtype lines, two per column. */
export const BIN_SHAPE = {
  scoresTwo: `${shapeText([1, 2])}, float32`,
  scoresOne: `${shapeText([1])}, float32`,
  targetTwo: `${shapeText([1])}, long`,
  targetOne: `${shapeText([1])}, float32`,
};

export const STRINGS = {
  subtitle:
    "A loss function measures the difference between predictions and targets as a "
    + "single number, which training minimizes. Regression compares each prediction "
    + "with its target; classification first converts the scores to probabilities, "
    + "by softmax across the classes or by a sigmoid for each class.",

  stepLabel: "Next row",
  stepTitle: "Compute the next row of the loss",
  runLabel: "Play",
  runTitle: "Land every remaining row",

  taskLabel: "Task",
  speedLabel: "Play speed",
  dtypeLabel: "Target dtype",
  dtypeDetail: "what the target tensor holds when the loss reads it",
  labelDetail: "the index of the true class, counting from A at 0",
  boolsDetail: "the classes the target marks present",
  predDetail: "the predictions, one per output",
  targetDetail: "one target per output, in the units of the prediction",
  scoresDetail: "the scores, one per class",
  logitsDetail: "the logits, one per class",

  outputsLabel: "Outputs",
  outputsDetail: "one output, or several: the shape of y_pred and y_true",

  binaryScoresDetail: "two scores, A and B",
  binaryLabelDetail: "the index of the true class: 0 is A, 1 is B",
  binaryTwoRow: "CrossEntropyLoss · two outputs",
  binaryOneRow: "BCEWithLogitsLoss · one output",
  binaryDiffName: "z_B − z_A",
  binaryTwoTile: "Loss, two outputs",
  binaryOneTile: "Loss, one output",
  binaryTwoNote: "CrossEntropyLoss over the two scores",
  binaryOneNote: "BCEWithLogitsLoss over the difference between them",
  binaryDiffNote: "the score for B minus the score for A",
  binaryDerivedNote: "this score is the difference between the two scores beside it",
  binaryTargetValue: "long · float32",
  binaryTargetNote: "the target as a 0 or a 1: 0 is A, 1 is B",
  binaryPTwoNote: "this class's probability in the row",
  binaryPOneCellNote: "the probability the sigmoid gives the true class",

  /* the caption block: two rows a page, each waiting for the step that makes
     it true (2.4), the row reserved so the block is the same height empty */
  captions: {
    regression: [
      { row: 0, at: 1, line: "Each prediction is compared with its own target, on the same axis." },
      { row: 1, at: 4, line: "The loss is the mean of the squared gaps." },
    ],
    "single-label": [
      { row: 0, at: 1, line: "The scores become one distribution over the classes, and it sums to 1." },
      { row: 1, at: 3, line: "The loss is the negative log of the probability given to the true class." },
    ],
    "multi-label": [
      { row: 0, at: 1, line: "Each class has its own probability; no rule holds them to 1." },
      { row: 1, at: 5, line: "The loss is the mean of the per-class terms." },
    ],
    binary: [
      { row: 0, at: 1, line: "Softmax over two scores is the sigmoid of their difference: p_B = σ(z_B − z_A)." },
      { row: 1, at: 3, line: "The two forms give the same loss, and dragging the score for B moves both." },
    ],
  },
  errorCaption: {
    "single-label": "The target is float32, and CrossEntropyLoss reads the class index as long.",
    "multi-label": "The target is long, and BCEWithLogitsLoss reads a 0 or a 1 per class as float32.",
  },

  lossNote: {
    regression: "mean of the squared gaps",
    "single-label": "−log of the probability given to the true class",
    "multi-label": "mean of the per-class terms",
  },
  raisedNote: "the call raised a RuntimeError",
  dtypeRule: {
    regression: "y_true must be float32, the same shape as y_pred",
    "single-label": "the class index must be long",
    "multi-label": "the 0 or 1 per class must be float32",
    binary: "the class index must be long, or the 0 or 1 float32",
  },

  cardNote: {
    regression: "N is the number of outputs, and every gap is measured in the units of the target.",
    "single-label": "The sum inside runs over the classes: the scores become one distribution, and the loss reads the true class's probability.",
    "multi-label": "Each class carries its own term, and a score wrong by the same amount costs the same whether its target is 0 or 1.",
    binary: "The two-output form has one redundant degree of freedom: adding the same amount to both scores leaves the probability unchanged.",
  },

  /* cell 40's other losses are a sentence, not a page: each needs a data shape
     of its own and none has a worked example to draw */
  cardExtra: "Losses can also be summed with weights, so one model trains on more than one objective at a time.",

  curveTitle: "−log p",
  curveX: {
    "single-label": "p at the true class",
    "multi-label": "p at the true label",
    binary: "p at the true class",
  },
  curveY: "loss",
  parabolaTitle: "gap²",
  parabolaX: "gap = y_pred − y_true",
  /* the panel's own tick labels, with a minus sign rather than a hyphen */
  gapLo: "−3",
  gapHi: "3",

  rowSumHead: "row sum",
  pTrueNote: "the softmax's probability for the target class",
  outputRow: "y_pred",
};

/** The mono name a row's cell carries in the readout: the tensor's own name
    where the row is a tensor, and the short form of the loss line's own
    notation where it is a reading (`p[y]` for the probability at the true
    label, as the header prints `mean(−log p[y])`). A row label is prose and
    reads wrong with an index after it. */
export const hoverName = (id) => ({
  target: "y_true", gap: "gap", "gap squared": "gap²", p: "p",
  "p at the true label": "p[y]", "-log p": "−log p",
}[id] ?? id);

/** The row-sum column's note, which is the whole contrast in one tile. */
export const SUM_NOTE = {
  "single-label": "the probabilities sum to 1",
  "multi-label": "each class has its own probability; nothing holds them to 1",
  binary: "the two probabilities sum to 1",
};

/** The shape and dtype line under a row — the anchor of the whole widget.
    A row of ONE is `[1]` and not `[1, 1]`: that is the shape of the left
    column of Kenneth's own MSE and BCE figures. */
const rowShape = (n) => shapeText(n === 1 ? [1] : [1, n]);
export const targetDtypeText = (state) => {
  if (state.kind === "regression") return `${rowShape(state.n)}, float32`;
  if (state.kind === "single-label") return `${shapeText([1])}, ${state.bad ? "float32" : "long"}`;
  /* the Binary page carries a dtype line per column, so the readout names both */
  if (state.kind === "binary") return STRINGS.binaryTargetValue;
  return `${rowShape(state.n)}, ${state.bad ? "long" : "float32"}`;
};
export const scoresDtypeText = (state) => `${rowShape(state.n)}, float32`;
