/* ============================================================================
   Widget 54 · Loss functions — what a loss takes in, what it does inside, and
   the one number it returns.

   PHM5005 05-4 cells 30-40: cell 30's table of losses by task, then MSELoss
   (cells 31-33), CrossEntropyLoss (34-36) and BCEWithLogitsLoss (37-39). One
   page per ROW of cell 30's table, each opening on that cell's own example.

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

/** `parse` for a tensor field. */
export const parseVec = (text, n, range) => wire(fit(unwire(text), n, range));
/** `show` for the same field: the row as a person writes it. */
export const showVec = (text) => unwire(text).join(", ");
/** `check` for the same field, shown under it while it is typed in. */
export const hintFor = (text, n, noun) =>
  (unwire(text).length === n ? null : `${WORDS[n]} numbers, one per ${noun}`);
const WORDS = { 3: "three", 5: "five" };

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
  if (task === "single-label") {
    return singleLabel(
      fit(unwire(params.scores ?? CE_SCORES), 3, RANGE["single-label"]),
      Number(params.label ?? CE_LABEL),
      params.singleDtype ?? "long"
    );
  }
  if (task === "multi-label") {
    return multiLabel(
      fit(unwire(params.logits ?? BCE_SCORES), 5, RANGE["multi-label"]),
      LETTERS.map((k) => (params[k] ? 1 : 0)),
      params.multiDtype ?? "float32"
    );
  }
  return regression(
    fit(unwire(params.pred ?? MSE_PRED), 3, RANGE.regression),
    fit(unwire(params.target ?? MSE_TRUE), 3, RANGE.regression)
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

/** The whole tensor after that drag, as the canonical text the field stores. */
export function dragVec(text, col, dy, n, range) {
  const vals = fit(unwire(text), n, range);
  if (col < 0 || col >= n) return wire(vals);
  vals[col] = dragTo(vals[col], dy, range);
  return wire(vals);
}

/* ============================ what the reader reads ========================
 * Every string the figure, the rail and the readout show, in one place: the
 * verify script sweeps them for the register 5.9 asks for, and `main.js` has
 * no copy of its own to drift from them.
 */
export const TASKS = [
  {
    value: "regression",
    label: "Regression",
    detail: "no function applied · y_true is float32, the same shape as y_pred",
  },
  {
    value: "single-label",
    label: "Single-label",
    detail: "softmax over the row · y_true is one class index, long",
  },
  {
    value: "multi-label",
    label: "Multi-label",
    detail: "sigmoid per class · y_true is 0 or 1 per class, float32",
  },
];

export const HEAD = {
  regression: "Regression · MSELoss",
  "single-label": "Single-label · CrossEntropyLoss",
  "multi-label": "Multi-label · BCEWithLogitsLoss",
};
export const HEAD_EXPR = {
  regression: "loss = mean((y_pred − y_true)²)",
  "single-label": "loss = −log p[label]",
  "multi-label": "loss = mean(−log p[y])",
};
export const FN_LABEL = {
  regression: "",
  "single-label": "softmax over the row",
  "multi-label": "sigmoid per class",
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
  labelDetail: "the index of the true class: 0 is A, 1 is B, 2 is C",
  boolsDetail: "the classes the target marks present",
  predDetail: "the predictions, one per output",
  targetDetail: "one target per output, in the units of the prediction",
  scoresDetail: "the scores, one per class",
  logitsDetail: "the logits, one per class",

  /* the caption block: two rows a page, each waiting for the step that makes
     it true (2.4), the row reserved so the block is the same height empty */
  captions: {
    regression: [
      { row: 0, at: 1, line: "Each prediction is compared with its own target, on the same axis." },
      { row: 1, at: 4, line: "The loss is the mean of the three squared gaps." },
    ],
    "single-label": [
      { row: 0, at: 1, line: "The three scores become one distribution over the classes, and it sums to 1." },
      { row: 1, at: 3, line: "The loss is the negative log of the probability given to the true class." },
    ],
    "multi-label": [
      { row: 0, at: 1, line: "Each class has its own probability; no rule holds the five to 1." },
      { row: 1, at: 5, line: "The loss is the mean of the five per-class terms." },
    ],
  },
  errorCaption: {
    "single-label": "The target is float32, and CrossEntropyLoss reads the class index as long.",
    "multi-label": "The target is long, and BCEWithLogitsLoss reads a 0 or a 1 per class as float32.",
  },

  lossNote: {
    regression: "mean of the three squared gaps",
    "single-label": "−log of the probability given to the true class",
    "multi-label": "mean of the five per-class terms",
  },
  raisedNote: "the call raised a RuntimeError",
  dtypeRule: {
    regression: "y_true must be float32, the same shape as y_pred",
    "single-label": "the class index must be long",
    "multi-label": "the 0 or 1 per class must be float32",
  },

  cardNote: {
    regression: "N is the number of outputs, and every gap is measured in the units of the target.",
    "single-label": "The sum inside runs over the classes: the scores become one distribution, and the loss reads the true class's probability.",
    "multi-label": "Each class carries its own term, and a score wrong by the same amount costs the same whether its target is 0 or 1.",
  },

  /* cell 40's other losses are a sentence, not a page: each needs a data shape
     of its own and none has a worked example to draw */
  cardExtra: "Losses can also be summed with weights, so one model trains on more than one objective at a time.",

  curveTitle: "−log p",
  curveX: { "single-label": "p at the true class", "multi-label": "p at the true label" },
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
  "single-label": "the three sum to 1",
  "multi-label": "each class has its own probability; nothing holds them to 1",
};

/** The shape and dtype line under a row — the anchor of the whole widget. */
export const targetDtypeText = (state) => {
  if (state.kind === "regression") return `${shapeText([1, state.n])}, float32`;
  if (state.kind === "single-label") return `${shapeText([1])}, ${state.bad ? "float32" : "long"}`;
  return `${shapeText([1, state.n])}, ${state.bad ? "long" : "float32"}`;
};
export const scoresDtypeText = (state) => `${shapeText([1, state.n])}, float32`;
