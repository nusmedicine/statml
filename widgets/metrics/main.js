/* ============================================================================
   Widget 35 · Scoring the Predictions — what each evaluation metric is made
   of, for a numeric and a categorical outcome. Hosts at PHM5005 04-2.

   Two misconceptions, one per tab:
   - numeric: that RMSE, MAE and R² are interchangeable summaries. One outlier
     moves RMSE +38% and MAE +16% (round-0 sweep, sigma 3, magnitude 18), and
     R² is not an error at all but a comparison against predicting the mean.
   - categorical: that accuracy says how good a classifier is. Every metric is
     a different ratio of the SAME four confusion-matrix cells, and under
     imbalance accuracy rises while recall collapses — at separation 1.5,
     prevalence 0.5 -> 0.05 reads accuracy 0.77 -> 0.95, recall 0.77 -> 0.14.

   NO ROC ANYWHERE, by decision (2026-08-30): widget 34 owns the threshold
   story. This widget never draws a curve and never moves a cutoff by hand.

   The central interaction is the `metric` pick lighting that metric's ANATOMY
   on the one figure: squares (area = squared error) for RMSE, bars for MAE,
   the mean-model comparison for R², and lit matrix cells for the four
   classification metrics. The one motion is the R² ease on core's
   ease-request door: the model's predictions slide to the mean line, errors
   growing on the way — every other pick is an instant overlay.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import {
  NUM_LO, NUM_HI, NUM_N, CAT_N,
  numericCohort, numericMetrics, categoricalCohort, categoricalMetrics,
} from "./model.js";

/* --- layout ---------------------------------------------------------------
   The numeric plot must be SQUARE: both axes are % body fat on one domain,
   and a square drawn for a squared error is only honest if a unit of x and a
   unit of y are the same number of pixels. */
const NOTE_H = 30;
const PAD_T = 10, PAD_B = 44, PAD_L = 46, PAD_R = 16;

const numSide = (w) => Math.max(260, Math.min(410, w - PAD_L - PAD_R - 8));
const NUM_TICKS = [0, 10, 20, 30, 40];

/* categorical: the matrix, then one formula line under it */
const CELL_H = 108;
const CAT_H = NOTE_H + 24 + 2 * CELL_H + 58;

const f2 = (x) => x.toFixed(2);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");

/* --- compute ------------------------------------------------------------- */

function computeAll({ params, rng }) {
  if (params.target === "numeric") {
    const cohort = numericCohort(rng, { sigma: params.noise, outliers: params.outliers });
    const m = numericMetrics(cohort.actual, cohort.pred);
    /* the same cohort before its outliers — same seed, same stream — so the
       outlier tile reports the pull of exactly the misses the reader added */
    const m0 = numericMetrics(cohort.actual, cohort.predBase);
    return { cohort, m, m0 };
  }
  const cells = categoricalCohort(rng, { prev: params.prev, d: params.sep });
  return { cells, cm: categoricalMetrics(cells) };
}

/* --- numeric drawing ------------------------------------------------------ */

function caption(ctx, colors, lines, w) {
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i < lines.length; i += 1) {
    const [text, style] = Array.isArray(lines[i]) ? lines[i] : [lines[i], null];
    ctx.fillStyle = style ?? colors.ink3;
    const fits = (t) => ctx.measureText(t).width < w - 8;
    const alts = Array.isArray(text) ? text : [text];
    ctx.fillText(alts.find(fits) ?? alts[alts.length - 1], 2, 9 + i * 14);
  }
  ctx.restore();
}

/* One error square, grown TOWARD the diagonal: for a 45° line the horizontal
   distance to it equals the residual, so the far edge exactly touches the
   line — over-prediction grows right, under-prediction left, and no square
   leaves the frame. */
function errorSquare(ctx, plot, a, p, fill, alpha) {
  const px = plot.sx(a);
  const py = plot.sy(p);
  const dy = plot.sy(a);
  const side = Math.abs(py - dy);
  if (side < 0.5) return;
  const left = px - (py < dy ? 0 : side);
  const top = Math.min(py, dy);
  ctx.save();
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;
  ctx.fillRect(left, top, side, side);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = fill;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, side, side);
  ctx.restore();
}

function drawNumeric({ ctx, colors, w, params, state, anim }) {
  const { actual, pred, flagged } = state.cohort;
  const { m } = state;
  const t = anim?.t ?? (params.metric === "r2" ? 1 : 0);
  const side = numSide(w);
  const rect = { x: PAD_L + (w - PAD_L - PAD_R - side) / 2, y: NOTE_H + PAD_T, w: side, h: side };
  const plot = makePlot({
    ctx, colors, rect,
    xDomain: [NUM_LO, NUM_HI], yDomain: [NUM_LO, NUM_HI],
  });

  const say = {
    none: "each segment is one patient's error: predicted − actual",
    rmse: "each square's area is one squared error; RMSE = √(their mean)",
    mae: "each bar's length is one absolute error; MAE = their mean",
    r2: `R² = 1 − SSE / SST = 1 − ${m.sse.toFixed(0)} / ${m.sst.toFixed(0)} = ${f3(m.r2)}`,
  };
  caption(ctx, colors, [
    [`Simulated cohort · ${NUM_N} patients · predicted vs actual body fat (%)`],
    [say[params.metric], params.metric === "none" ? colors.ink3 : colors.ink2],
  ], w);

  plot.grid(NUM_TICKS);
  plot.axisX({ ticks: NUM_TICKS, format: String, label: "actual body fat %" });
  plot.axisY({ ticks: NUM_TICKS, format: String, label: "predicted %" });

  /* perfect prediction: y = x */
  plot.curve([[NUM_LO, NUM_LO], [NUM_HI, NUM_HI]], { stroke: colors.reference, dash: [6, 4] });

  const showSquares = params.metric === "rmse" || (params.metric === "r2" && t < 1);

  /* R²'s comparison model: the same patients, predictions sliding from the
     model's to the mean — errors growing on the way. Drawn first so the
     model's own marks stay readable on top. */
  if (t > 0.001) {
    const yb = m.ybar;
    ctx.save();
    ctx.strokeStyle = colors.theory;
    ctx.globalAlpha = t;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rect.x, plot.sy(yb));
    ctx.lineTo(rect.x + rect.w, plot.sy(yb));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.theory;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`ȳ = ${f2(yb)}`, rect.x + 4, plot.sy(yb) - 3);
    ctx.restore();
    for (let i = 0; i < actual.length; i += 1) {
      const pe = pred[i] + (yb - pred[i]) * t;
      errorSquare(ctx, plot, actual[i], pe, colors.theory, 0.10);
      plot.dot(actual[i], pe, { fill: colors.theory, r: 2.4 });
    }
  }

  for (let i = 0; i < actual.length; i += 1) {
    const px = plot.sx(actual[i]);
    const py = plot.sy(pred[i]);
    const dy = plot.sy(actual[i]);
    if (params.metric === "none") {
      ctx.save();
      ctx.strokeStyle = colors.ink3;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, dy);
      ctx.stroke();
      ctx.restore();
    }
    if (params.metric === "rmse" || params.metric === "r2") {
      errorSquare(ctx, plot, actual[i], pred[i], colors.empirical, 0.14);
    }
    if (params.metric === "mae") {
      ctx.save();
      ctx.strokeStyle = colors.empirical;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, dy);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < actual.length; i += 1) {
    const out = flagged.includes(i);
    plot.dot(actual[i], pred[i], {
      fill: out ? colors.highlight : colors.empirical,
      r: out ? 4.6 : 3.2,
    });
  }
  void showSquares;
}

/* --- categorical drawing --------------------------------------------------
   sklearn orientation, settled at widget 34 round 3: rows = true class,
   negatives first, spanning axis titles, each row washed in its class hue with
   wash strength = the cell's share of its row. */

const CMETRICS = {
  acc: { name: "accuracy", lit: { TN: "num", TP: "num", FP: "den", FN: "den" } },
  prec: { name: "precision", lit: { TP: "num", FP: "den" } },
  rec: { name: "recall", lit: { TP: "num", FN: "den" } },
  f1: { name: "F1", lit: { TP: "num", FP: "den", FN: "den" } },
};

function formulaLine(key, cells, cm) {
  const { tp, fp, tn, fn } = cells;
  switch (key) {
    case "acc":
      return `accuracy = (TP + TN) / everyone = ${tp + tn} / ${cm.n} = ${f3(cm.acc)}`;
    case "prec":
      return `precision = TP / (TP + FP) = ${tp} / ${tp + fp} = ${f3(cm.prec)}`;
    case "rec":
      return `recall = TP / (TP + FN) = ${tp} / ${tp + fn} = ${f3(cm.rec)}`;
    case "f1":
      return `F1 = 2 · prec · rec / (prec + rec) = 2 · ${f3(cm.prec)} · ${f3(cm.rec)} / ${f3(cm.prec + cm.rec)} = ${f3(cm.f1)}`;
    default:
      return "the four cells count every patient once — each metric below is a ratio of them";
  }
}

function drawCategorical({ ctx, colors, w, params, state }) {
  const { cells, cm } = state;
  const { tp, fp, tn, fn } = cells;

  caption(ctx, colors, [
    [[
      `Simulated screening cohort · ${CAT_N} patients · prevalence ${Math.round(params.prev * 100)}% · the model predicts disease when its probability passes 0.5`,
      `Simulated screening cohort · ${CAT_N} patients · prevalence ${Math.round(params.prev * 100)}%`,
    ]],
  ], w);

  const cw = Math.max(96, Math.min(180, (w - 140) / 2));
  const x0 = (w - 2 * cw) / 2 + 14;
  const y0 = NOTE_H + 24;
  const grid = [[tn, fp], [fn, tp]];
  const names = [["TN", "FP"], ["FN", "TP"]];
  const rowHue = [colors.nonevent, colors.event];
  const rowTotal = [tn + fp, fn + tp];
  const lit = CMETRICS[params.cmetric]?.lit ?? null;

  ctx.save();
  ctx.textAlign = "center";
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      const cx = x0 + c * cw;
      const cy = y0 + r * CELL_H;
      const share = rowTotal[r] ? grid[r][c] / rowTotal[r] : 0;
      ctx.fillStyle = rowHue[r];
      ctx.globalAlpha = 0.08 + 0.42 * share;
      ctx.fillRect(cx, cy, cw, CELL_H);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cw, CELL_H);

      ctx.fillStyle = colors.ink1;
      ctx.font = `600 ${colors.fsFig} ${colors.font}`;
      ctx.textBaseline = "middle";
      ctx.fillText(String(grid[r][c]), cx + cw / 2, cy + CELL_H / 2 - 6);
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillStyle = colors.ink3;
      ctx.fillText(
        `${names[r][c]} · ${(100 * share).toFixed(0)}% of row`,
        cx + cw / 2, cy + CELL_H / 2 + 14,
      );

      const role = lit?.[names[r][c]];
      if (role === "num") {
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx + 2.5, cy + 2.5, cw - 5, CELL_H - 5);
      } else if (role === "den") {
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(cx + 2.5, cy + 2.5, cw - 5, CELL_H - 5);
        ctx.setLineDash([]);
      }
    }
  }

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("predicted: no disease", x0 + cw / 2, y0 - 7);
  ctx.fillText("predicted: disease", x0 + cw + cw / 2, y0 - 7);
  for (const [r, label] of [[0, "true: no disease"], [1, "true: disease"]]) {
    ctx.save();
    ctx.translate(x0 - 10, y0 + r * CELL_H + CELL_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  /* the picked metric, assembled from the cells it just lit */
  const line = formulaLine(params.cmetric, cells, cm);
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = params.cmetric === "none" ? colors.ink3 : colors.ink1;
  ctx.fillText(line, w / 2, y0 + 2 * CELL_H + 30);
  if (lit) {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.fillText("solid ring: numerator · dashed: the rest of the denominator", w / 2, y0 + 2 * CELL_H + 48);
  }
  ctx.restore();
}

/* --- the widget ----------------------------------------------------------- */

defineWidget({
  slug: "metrics",
  title: "Scoring the Predictions",
  subtitle:
    "We can score a model by comparing its predictions with the actual "
    + "outcomes. A numeric outcome is scored by the size of the errors; a "
    + "categorical outcome by counting the four kinds of correct and "
    + "incorrect prediction in a confusion matrix.",
  layout: "side",
  status: "draft",

  height: ({ target, w }) =>
    (target === "categorical" ? CAT_H : NOTE_H + PAD_T + numSide(w) + PAD_B),

  params: {
    target: {
      type: "segmented",
      label: "Outcome",
      options: [
        { value: "numeric", label: "Numeric", detail: "predicting a measurement — % body fat" },
        { value: "categorical", label: "Categorical", detail: "predicting a class — disease or not" },
      ],
      default: "numeric",
    },

    data: { type: "section", label: "The data" },

    noise: {
      type: "float",
      label: "Model error σ",
      detail: "SD of the prediction errors, % body fat",
      min: 1, max: 8, step: 0.5, default: 3,
      when: { param: "target", equals: "numeric" },
    },
    outliers: {
      type: "int",
      label: "Outliers",
      detail: "patients the model badly mispredicts",
      min: 0, max: 3, default: 0,
      when: { param: "target", equals: "numeric" },
    },

    prev: {
      type: "float",
      label: "Prevalence",
      detail: "share of the cohort with the disease",
      min: 0.05, max: 0.5, step: 0.05, default: 0.3,
      when: { param: "target", equals: "categorical" },
    },
    sep: {
      type: "float",
      label: "Separation",
      detail: "how far apart the model scores the two groups",
      min: 1, max: 2.5, step: 0.25, default: 1.5,
      when: { param: "target", equals: "categorical" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    pick: { type: "section", label: "The metric" },

    metric: {
      type: "segmented",
      label: "Metric",
      options: [
        { value: "none", label: "None", detail: "the errors alone" },
        { value: "rmse", label: "RMSE", detail: "root mean SQUARED error — each error drawn as a square" },
        { value: "mae", label: "MAE", detail: "mean absolute error — each error drawn as a bar" },
        { value: "r2", label: "R²", detail: "the model's squares against the mean model's" },
      ],
      default: "none",
      display: true,
      when: { param: "target", equals: "numeric" },
    },
    /* GROUPED ROWS, and the captions are the lesson: accuracy is the only
       metric read off everyone, and the other three all read the positive
       class — which is exactly why accuracy alone survives imbalance and
       they do not. (Five segments in one row also truncate in the rail;
       the grouping is what makes them fit, widget 9's door.) */
    cmetric: {
      type: "segmented",
      label: "Metric",
      options: [
        { value: "none", label: "None", detail: "the counts alone" },
        { value: "acc", label: "Accuracy", detail: "correct on everyone", group: "read off everyone" },
        { value: "prec", label: "Precision", detail: "of predicted disease, how many real", group: "about the disease class" },
        { value: "rec", label: "Recall", detail: "of true disease, how many found", group: "about the disease class" },
        { value: "f1", label: "F1", detail: "harmonic mean of precision and recall", group: "about the disease class" },
      ],
      default: "none",
      display: true,
      when: { param: "target", equals: "categorical" },
    },
  },

  legend: ({ params }) =>
    (params.target === "numeric"
      ? [
        { token: "empirical", label: "Model prediction (one patient)", mark: "dot" },
        { token: "reference", label: "Perfect prediction (y = x)", mark: "line" },
        ...(params.outliers > 0
          ? [{ token: "highlight", label: "Outlier", mark: "dot" }] : []),
        ...(params.metric === "r2"
          ? [{ token: "theory", label: "Mean model (predict ȳ for everyone)", mark: "line" }] : []),
      ]
      : [
        { token: "event", label: "True disease row", mark: "bar" },
        { token: "nonevent", label: "True no-disease row", mark: "bar" },
        ...(params.cmetric !== "none"
          ? [{ token: "highlight", label: "Cells the metric reads", mark: "line" }] : []),
      ]),

  compute: computeAll,

  /* No Step and no Play — the one motion is the R² ease on core's
     ease-request door: picking R² slides the model's predictions to the mean
     line, the error squares growing on the way. */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => {
      const t = params.target === "numeric" && params.metric === "r2" ? 1 : 0;
      return { t, target: t };
    },
    advance: (anim, { dt }) => {
      const dir = Math.sign(anim.target - anim.t);
      if (dir === 0) return false;
      anim.t = Math.max(0, Math.min(1, anim.t + (dir * dt) / 600));
      if ((dir > 0 && anim.t >= anim.target) || (dir < 0 && anim.t <= anim.target)) {
        anim.t = anim.target;
        return false;
      }
      return true;
    },
    rebuild: (anim, { params }) => {
      const target = params.target === "numeric" && params.metric === "r2" ? 1 : 0;
      if (target !== anim.target) {
        anim.target = target;
        anim.easing = true;
      }
    },
  },

  draw(args) {
    if (args.params.target === "numeric") drawNumeric(args);
    else drawCategorical(args);
  },

  readout: ({ params, state }) => {
    if (params.target === "numeric") {
      const { m, m0 } = state;
      const tiles = [
        { label: "RMSE", value: `${f2(m.rmse)} %`, note: "typical error, large misses weighted up" },
        { label: "MAE", value: `${f2(m.mae)} %`, note: "typical error, every miss weighted alike" },
        {
          label: "R²",
          value: f3(m.r2),
          note: "share of the spread explained; 0 = the mean model",
        },
      ];
      if (params.outliers > 0) {
        const pull = (a, b) => `${b >= a ? "+" : "−"}${Math.abs((100 * (b - a)) / a).toFixed(0)}%`;
        tiles.push({
          label: "Outlier pull",
          value: `${pull(m0.rmse, m.rmse)} RMSE`,
          note: `MAE ${pull(m0.mae, m.mae)} — squaring hands the big miss the sum`,
        });
      }
      return tiles;
    }
    const { cm } = state;
    return [
      { label: "Accuracy", value: f3(cm.acc), note: "correct on everyone" },
      { label: "Precision", value: f3(cm.prec), note: "of predicted disease, how many real" },
      { label: "Recall", value: f3(cm.rec), note: "of true disease, how many found" },
      { label: "F1", value: f3(cm.f1), note: "harmonic mean of precision and recall" },
      {
        label: "All-negative baseline",
        value: f3(cm.base),
        note: "say “no disease” for everyone — accuracy has to beat this",
      },
    ];
  },
});
