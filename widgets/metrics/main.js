/* ============================================================================
   Widget 35 · Scoring the Predictions — what each evaluation metric is made
   of, for a numeric and a categorical outcome. Hosts at PHM5005 04-2.

   Round 2 (Kenneth, 2026-08-30) reshaped the categorical half onto widget
   34's presentation: one simulated cohort scored by the trained model's
   probability, overlaid score histograms with a draggable decision threshold,
   and the ROC curve FOLDED IN as a third concept — so one notebook link can
   land on any of 04-2's stations: ?concept=numeric · threshold · roc, the
   notebook's own split into threshold-dependent and threshold-independent
   metrics. Formulas moved off the canvas into a MathML card (widget 15's
   pattern), each wearing the live numbers of the state on screen.

   Two misconceptions, one per outcome type:
   - numeric: that RMSE, MAE and R² are interchangeable summaries. One outlier
     moves RMSE +38% and MAE +16% (round-0 sweep, sigma 3, magnitude 18), and
     R² is not an error at all but a comparison against predicting the mean.
   - categorical: that accuracy says how good a classifier is. Every
     threshold-dependent metric is a different ratio of the SAME four cells,
     and under imbalance accuracy rises while recall collapses — at
     separation 1.5, prevalence 0.5 -> 0.05 reads accuracy 0.77 -> 0.95,
     recall 0.77 -> 0.14. AUC is the one number the threshold cannot move.

   Widget 34 `roc-auc` keeps the threshold STORY (the trace, Youden, the
   find-optimal scan); here the curve opens finished, because this widget's
   concept is what the metrics ARE, not how the curve is built.
   ========================================================================= */

import { defineWidget, makePlot, histogram } from "../core/index.js";
import {
  NUM_LO, NUM_HI, NUM_N, CAT_N,
  numericCohort, numericMetrics, categoricalPatients, cellsAt,
  categoricalMetrics, rocOf,
} from "./model.js";

/* --- layout ---------------------------------------------------------------
   The numeric plot must be SQUARE: both axes are % body fat on one domain,
   and a square drawn for a squared error is only honest if a unit of x and a
   unit of y are the same number of pixels. */
const NOTE_H = 30;
const PAD_T = 10, PAD_B = 44, PAD_L = 46, PAD_R = 16;

const numSide = (w) => Math.max(260, Math.min(410, w - PAD_L - PAD_R - 8));
const NUM_TICKS = [0, 10, 20, 30, 40];

const HIST_BINS = 36;
const CELL_H = 96;
const ROC_SIDE = 300;

/* strip + matrix (concept "threshold"), strip + square (concept "roc");
   the square drops under the strip below 640px, widget 34's breakpoint */
function catLayout(w, concept) {
  if (concept === "threshold") {
    const strip = { x: 46, y: 64, w: w - 66, h: 132 };
    /* 64 below the strip, not 48: the strip's own axis label needs its row
       before the matrix's spanning "predicted:" titles begin */
    return { strip, matrixY: strip.y + strip.h + 64 };
  }
  if (w < 640) {
    const side = Math.min(ROC_SIDE, w - 130);
    const strip = { x: 46, y: 64, w: w - 66, h: 132 };
    return { strip, roc: { x: (w - side) / 2 + 10, y: strip.y + strip.h + 44, side } };
  }
  const side = ROC_SIDE;
  return {
    strip: { x: 46, y: 64, w: w - side - 126, h: 228 },
    roc: { x: w - side - 46, y: 48, side },
  };
}

function catHeight(w, concept) {
  const L = catLayout(w, concept);
  if (concept === "threshold") return L.matrixY + 2 * CELL_H + 46;
  return Math.max(L.strip.y + L.strip.h, L.roc.y + L.roc.side) + 44;
}

const f2 = (x) => x.toFixed(2);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");

/* --- compute ------------------------------------------------------------- */

function computeAll({ params, rng }) {
  if (params.concept === "numeric") {
    const cohort = numericCohort(rng, { sigma: params.noise, outliers: params.outliers });
    const m = numericMetrics(cohort.actual, cohort.pred);
    /* the same cohort before its outliers — same seed, same stream — so the
       outlier tile reports the pull of exactly the misses the reader added */
    const m0 = numericMetrics(cohort.actual, cohort.predBase);
    return { cohort, m, m0 };
  }
  const patients = categoricalPatients(rng, { prev: params.prev, d: params.sep });
  const probsOf = (want) => patients.filter((p) => p.disease === want).map((p) => p.prob);
  const cells = cellsAt(patients, params.threshold);
  return {
    patients,
    cells,
    cm: categoricalMetrics(cells),
    histPos: histogram(probsOf(true), [0, 1], HIST_BINS),
    histNeg: histogram(probsOf(false), [0, 1], HIST_BINS),
    roc: rocOf(patients),
  };
}

/* --- the formula card, in the DOM (widget 15's pattern) --------------------
   MathML where the engine sets it, the plain string otherwise. One <math>
   per term so the card can wrap at the seams; rebuilt only when its content
   key moves, because draw() runs per frame. */

function mathmlRenders() {
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;visibility:hidden;font-size:16px";
  box.innerHTML = "<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math><math><mn>1</mn></math>";
  document.body.appendChild(box);
  const [frac, plain] = [...box.querySelectorAll("math")].map((m) => m.getBoundingClientRect().height);
  box.remove();
  return frac > plain * 1.3;
}
const MATHML = mathmlRenders();

const mi = (t) => `<mi mathvariant="normal">${t}</mi>`;
const mn = (t) => `<mn>${t}</mn>`;
const mo = (t) => `<mo>${t}</mo>`;
const frac = (a, b) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`;
const root = (a) => `<msqrt><mrow>${a}</mrow></msqrt>`;
const sq = (inner) => `<msup><mrow>${inner}</mrow><mn>2</mn></msup>`;
const M = (inner) => `<math><mrow>${inner}</mrow></math>`;
const EQ = `<math><mrow><mo form="infix">=</mo></mrow></math>`;

const ERR = `${mi("predicted")}<mo>−</mo><mi mathvariant="normal">actual</mi>`;

function numericFormula(metric, m) {
  switch (metric) {
    case "rmse":
      return {
        html: `${M(mi("RMSE") + mo("="))} ${M(root(frac(`<mo>Σ</mo>${sq(`<mo>(</mo>${ERR}<mo>)</mo>`)}`, mi("n"))))} ${EQ} ${M(mn(f2(m.rmse)) + mi("%"))}`,
        plain: `RMSE = √( Σ(predicted − actual)² / n ) = ${f2(m.rmse)} %`,
      };
    case "mae":
      return {
        html: `${M(mi("MAE") + mo("="))} ${M(frac(`<mo>Σ</mo><mo>|</mo>${ERR}<mo>|</mo>`, mi("n")))} ${EQ} ${M(mn(f2(m.mae)) + mi("%"))}`,
        plain: `MAE = Σ|predicted − actual| / n = ${f2(m.mae)} %`,
      };
    case "r2":
      return {
        html: `${M(`<msup>${mi("R")}<mn>2</mn></msup>` + mo("=") + mn("1") + `<mo form="infix">−</mo>` + frac(mi("SSE"), mi("SST")))} ${M(mo("=") + mn("1") + `<mo form="infix">−</mo>` + frac(mn(m.sse.toFixed(0)), mn(m.sst.toFixed(0))))} ${EQ} ${M(mn(f3(m.r2)))}`,
        plain: `R² = 1 − SSE/SST = 1 − ${m.sse.toFixed(0)}/${m.sst.toFixed(0)} = ${f3(m.r2)}`,
      };
    default:
      return {
        html: M(mi("error") + mo("=") + ERR),
        plain: "error = predicted − actual",
      };
  }
}

function cellFormula(cmetric, cells, cm) {
  const { tp, fp, tn, fn } = cells;
  const cell = (t) => mi(t);
  switch (cmetric) {
    case "acc":
      return {
        html: `${M(mi("Accuracy") + mo("="))} ${M(frac(`${cell("TP")}<mo>+</mo>${cell("TN")}`, mi("n")))} ${EQ} ${M(frac(mn(tp + tn), mn(cm.n)))} ${EQ} ${M(mn(f3(cm.acc)))}`,
        plain: `Accuracy = (TP + TN) / n = ${tp + tn} / ${cm.n} = ${f3(cm.acc)}`,
      };
    case "prec":
      return {
        html: `${M(mi("Precision") + mo("="))} ${M(frac(cell("TP"), `${cell("TP")}<mo>+</mo>${cell("FP")}`))} ${EQ} ${M(frac(mn(tp), mn(tp + fp)))} ${EQ} ${M(mn(f3(cm.prec)))}`,
        plain: `Precision = TP / (TP + FP) = ${tp} / ${tp + fp} = ${f3(cm.prec)}`,
      };
    case "rec":
      return {
        html: `${M(mi("Recall") + mo("="))} ${M(frac(cell("TP"), `${cell("TP")}<mo>+</mo>${cell("FN")}`))} ${EQ} ${M(frac(mn(tp), mn(tp + fn)))} ${EQ} ${M(mn(f3(cm.rec)))}`,
        plain: `Recall = TP / (TP + FN) = ${tp} / ${tp + fn} = ${f3(cm.rec)}`,
      };
    case "f1":
      return {
        html: `${M(`<msub>${mi("F")}<mn>1</mn></msub>` + mo("="))} ${M(frac(`<mn>2</mn><mo>·</mo>${mi("Precision")}<mo>·</mo>${mi("Recall")}`, `${mi("Precision")}<mo>+</mo>${mi("Recall")}`))} ${EQ} ${M(frac(`<mn>2</mn><mo>·</mo>${mn(f3(cm.prec))}<mo>·</mo>${mn(f3(cm.rec))}`, mn(f3(cm.prec + cm.rec))))} ${EQ} ${M(mn(f3(cm.f1)))}`,
        plain: `F1 = 2·Precision·Recall / (Precision + Recall) = ${f3(cm.f1)}`,
      };
    default:
      return {
        html: `${M(mi("n") + mo("=") + `${cell("TP")}<mo>+</mo>${cell("FP")}<mo>+</mo>${cell("FN")}<mo>+</mo>${cell("TN")}`)} ${EQ} ${M(mn(cm.n))}`,
        plain: `n = TP + FP + FN + TN = ${cm.n}`,
      };
  }
}

function rocFormula(cells, roc) {
  const { tp, fp, tn, fn } = cells;
  const tpr = tp + fn ? tp / (tp + fn) : NaN;
  const fpr = fp + tn ? fp / (fp + tn) : NaN;
  return {
    html: `${M(mi("TPR") + mo("=") + frac(mi("TP"), `${mi("TP")}<mo>+</mo>${mi("FN")}`) + mo("=") + mn(f3(tpr)))}  ${M(mi("FPR") + mo("=") + frac(mi("FP"), `${mi("FP")}<mo>+</mo>${mi("TN")}`) + mo("=") + mn(f3(fpr)))}  ${M(mi("AUC") + mo("=") + mn(f3(roc.auc)))}`,
    plain: `TPR = TP/(TP+FN) = ${f3(tpr)} · FPR = FP/(FP+TN) = ${f3(fpr)} · AUC = ${f3(roc.auc)}`,
  };
}

let cardHost = null;
let cardKey = null;

function renderCard(params, state) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const eq = params.concept === "numeric"
    ? numericFormula(params.metric, state.m)
    : params.concept === "threshold"
      ? cellFormula(params.cmetric, state.cells, state.cm)
      : rocFormula(state.cells, state.roc);
  const key = eq.plain;
  if (key === cardKey) return;
  cardKey = key;
  if (MATHML) cardHost.innerHTML = eq.html;
  else cardHost.textContent = eq.plain;
}

/* --- shared caption ------------------------------------------------------- */

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

/* --- numeric drawing ------------------------------------------------------ */

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
    rmse: "each square's area is one squared error — the biggest miss owns the sum",
    mae: "each bar's length is one absolute error — every miss weighted alike",
    r2: "the model's squares (SSE) against the mean model's (SST)",
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
}

/* --- categorical drawing --------------------------------------------------
   Widget 34's presentation, reused deliberately so the two widgets read as
   siblings: overlaid score histograms in COUNTS (per-class densities would
   hide the prevalence dial), the threshold line with "predicted −/+" said
   once at its feet, and the matrix in sklearn orientation with row wash. */

const CMETRICS = {
  acc: { lit: { TN: "num", TP: "num", FP: "den", FN: "den" } },
  prec: { lit: { TP: "num", FP: "den" } },
  rec: { lit: { TP: "num", FN: "den" } },
  f1: { lit: { TP: "num", FP: "den", FN: "den" } },
};

function cohortLine(params) {
  return [
    `Simulated screening cohort · ${CAT_N} patients · prevalence ${Math.round(params.prev * 100)}% · scores are the trained model's probability of disease`,
    `Simulated screening cohort · ${CAT_N} patients · prevalence ${Math.round(params.prev * 100)}%`,
  ];
}

function drawStrip(ctx, colors, L, params, state) {
  const { x, y, w, h } = L;
  const yMax = Math.max(...state.histPos.counts, ...state.histNeg.counts, 1);
  const hp = makePlot({
    ctx, colors,
    rect: { x, y, w, h },
    xDomain: [0, 1],
    yDomain: [0, yMax * 1.05],
  });
  hp.bars(state.histNeg.counts, { lo: 0, width: 1 / HIST_BINS, fill: colors.nonevent, opacity: 0.62 });
  hp.bars(state.histPos.counts, { lo: 0, width: 1 / HIST_BINS, fill: colors.event, opacity: 0.62 });
  hp.axisX({
    ticks: [0, 0.25, 0.5, 0.75, 1],
    format: (v) => v.toFixed(2),
    label: "predicted probability of disease",
  });

  const tx = x + Math.max(0, Math.min(1, params.threshold)) * w;
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(tx, y - 4);
  ctx.lineTo(tx, y + h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.highlight;
  ctx.textAlign = "center";
  ctx.fillText(
    `threshold ${f2(params.threshold)}`,
    Math.max(x + 40, Math.min(x + w - 40, tx)), y - 10,
  );
  /* which side is which, said once at the line's feet (widget 34 round 3) */
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.strokeText("predicted −", tx - 6, y + h - 6);
  ctx.fillText("predicted −", tx - 6, y + h - 6);
  ctx.textAlign = "left";
  ctx.strokeText("predicted +", tx + 6, y + h - 6);
  ctx.fillText("predicted +", tx + 6, y + h - 6);
  ctx.restore();
}

function drawMatrix(ctx, colors, { x0, y0, cw }, cells, lit) {
  const { tp, fp, tn, fn } = cells;
  const grid = [[tn, fp], [fn, tp]];
  const names = [["TN", "FP"], ["FN", "TP"]];
  const rowHue = [colors.nonevent, colors.event];
  const rowTotal = [tn + fp, fn + tp];

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
  if (lit) {
    ctx.fillText(
      "solid ring: numerator · dashed: the rest of the denominator",
      x0 + cw, y0 + 2 * CELL_H + 18,
    );
  }
  ctx.restore();
}

function drawThreshold({ ctx, colors, w, params, state }) {
  const L = catLayout(w, "threshold");
  caption(ctx, colors, [[cohortLine(params)]], w);
  drawStrip(ctx, colors, L.strip, params, state);
  const cw = Math.max(96, Math.min(180, (w - 140) / 2));
  drawMatrix(ctx, colors, { x0: (w - 2 * cw) / 2 + 14, y0: L.matrixY, cw },
    state.cells, CMETRICS[params.cmetric]?.lit ?? null);
}

function drawRocSquare(ctx, colors, { x, y, side }, state) {
  const plot = makePlot({
    ctx, colors,
    rect: { x, y, w: side, h: side },
    xDomain: [0, 1],
    yDomain: [0, 1],
  });
  plot.grid([0.25, 0.5, 0.75]);
  plot.axisX({ ticks: [0, 0.5, 1], format: (v) => v.toFixed(1), label: "false positive rate" });
  plot.axisY({ ticks: [0, 0.5, 1], format: (v) => v.toFixed(1), label: "true positive rate" });
  plot.curve([[0, 0], [1, 1]], { stroke: colors.reference, dash: [6, 4] });
  plot.curve(state.roc.pts.map((p) => [p.fpr, p.tpr]), { stroke: colors.empirical, width: 2 });

  const { tp, fp, tn, fn } = state.cells;
  const tpr = tp + fn ? tp / (tp + fn) : 0;
  const fpr = fp + tn ? fp / (fp + tn) : 0;
  plot.dot(fpr, tpr, { fill: colors.highlight, r: 4.5 });

  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.surface;
  const lab = `AUC ${f3(state.roc.auc)}`;
  ctx.strokeText(lab, x + side - 8, y + side - 14);
  ctx.fillStyle = colors.ink1;
  ctx.fillText(lab, x + side - 8, y + side - 14);
  ctx.restore();
}

function drawRoc({ ctx, colors, w, params, state }) {
  const L = catLayout(w, "roc");
  caption(ctx, colors, [
    [cohortLine(params)],
    ["drag the threshold: the dot moves ALONG the curve — the curve and AUC hold still", colors.ink2],
  ], w);
  drawStrip(ctx, colors, L.strip, params, state);
  drawRocSquare(ctx, colors, L.roc, state);
}

/* --- the widget ----------------------------------------------------------- */

defineWidget({
  slug: "metrics",
  title: "Scoring the Predictions",
  subtitle:
    "We can score a model by comparing its predictions with the actual "
    + "outcomes. A numeric outcome is scored by the size of the errors; a "
    + "categorical outcome by the confusion matrix at one chosen threshold, "
    + "or across every threshold at once with the ROC curve.",
  layout: "side",
  status: "draft",

  height: ({ concept, w }) =>
    (concept === "numeric" ? NOTE_H + PAD_T + numSide(w) + PAD_B : catHeight(w, concept)),

  params: {
    /* One widget, three stations of 04-2, so a notebook link can land on
       any of them: ?concept=numeric · threshold · roc. The grouped rows are
       the notebook's own taxonomy — a categorical outcome is scored at one
       threshold (the confusion matrix) or across all of them (ROC). */
    concept: {
      type: "segmented",
      label: "Outcome · metric family",
      options: [
        { value: "numeric", label: "Numeric", detail: "predicting a measurement — % body fat" },
        {
          value: "threshold", label: "Confusion matrix",
          detail: "threshold-dependent: the four cells at one chosen cutoff",
          group: "categorical — disease or not",
        },
        {
          value: "roc", label: "ROC curve",
          detail: "threshold-independent: the trade-off across every cutoff",
          group: "categorical — disease or not",
        },
      ],
      default: "numeric",
    },

    data: { type: "section", label: "The data" },

    noise: {
      type: "float",
      label: "Model error σ",
      detail: "SD of the prediction errors, % body fat",
      min: 1, max: 8, step: 0.5, default: 3,
      when: { param: "concept", equals: "numeric" },
    },
    outliers: {
      type: "int",
      label: "Outliers",
      detail: "patients the model badly mispredicts",
      min: 0, max: 3, default: 0,
      when: { param: "concept", equals: "numeric" },
    },

    prev: {
      type: "float",
      label: "Prevalence",
      detail: "share of the cohort with the disease",
      min: 0.05, max: 0.5, step: 0.05, default: 0.3,
      when: { param: "concept", oneOf: ["threshold", "roc"] },
    },
    sep: {
      type: "float",
      label: "Separation",
      detail: "how far apart the model scores the two groups",
      min: 1, max: 2.5, step: 0.25, default: 1.5,
      when: { param: "concept", oneOf: ["threshold", "roc"] },
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
      when: { param: "concept", equals: "numeric" },
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
      when: { param: "concept", equals: "threshold" },
    },

    /* Dragged on the strip, never a rail slider — widget 34's decision,
       kept: the threshold is a property of the figure. In the URL, so a
       state is shareable; hidden from the rail. */
    threshold: {
      type: "float",
      label: "Decision threshold",
      min: 0.01, max: 0.99, step: 0.01, default: 0.5,
      display: true,
      hidden: true,
    },
  },

  legend: ({ params }) =>
    (params.concept === "numeric"
      ? [
        { token: "empirical", label: "Model prediction (one patient)", mark: "dot" },
        { token: "reference", label: "Perfect prediction (y = x)", mark: "line" },
        ...(params.outliers > 0
          ? [{ token: "highlight", label: "Outlier", mark: "dot" }] : []),
        ...(params.metric === "r2"
          ? [{ token: "theory", label: "Mean model (predict ȳ for everyone)", mark: "line" }] : []),
      ]
      : [
        { token: "event", label: "Disease present — model scores", mark: "bar" },
        { token: "nonevent", label: "Disease absent — model scores", mark: "bar" },
        { token: "highlight", label: "Decision threshold (drag it)", mark: "line" },
        ...(params.concept === "roc"
          ? [
            { token: "empirical", label: "ROC curve", mark: "line" },
            { token: "reference", label: "Chance — no discrimination", mark: "line" },
          ] : []),
      ]),

  compute: computeAll,

  /* No Step and no Play — the one motion is the R² ease on core's
     ease-request door: picking R² slides the model's predictions to the mean
     line, the error squares growing on the way. */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => {
      const t = params.concept === "numeric" && params.metric === "r2" ? 1 : 0;
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
      const target = params.concept === "numeric" && params.metric === "r2" ? 1 : 0;
      if (target !== anim.target) {
        anim.target = target;
        anim.easing = true;
      }
    },
  },

  drag: {
    params: ["threshold"],
    cursor: "ew-resize",
    /* the strip only (widget 34's rule: a click-and-slip on the ROC square
       must not nudge the threshold), and only on the two concepts that
       draw a strip at all */
    hit: ({ x, y, w, params }) => {
      if (params.concept === "numeric") return false;
      const L = catLayout(w, params.concept);
      return x >= L.strip.x && x <= L.strip.x + L.strip.w
        && y >= L.strip.y - 16 && y <= L.strip.y + L.strip.h + 30;
    },
    value: ({ dx, start, w, params }) => {
      const L = catLayout(w, params.concept);
      const t = start.threshold + dx / L.strip.w;
      return { threshold: Math.max(0.01, Math.min(0.99, Math.round(t * 100) / 100)) };
    },
  },

  draw(args) {
    renderCard(args.params, args.state);
    if (args.params.concept === "numeric") drawNumeric(args);
    else if (args.params.concept === "threshold") drawThreshold(args);
    else drawRoc(args);
  },

  readout: ({ params, state }) => {
    if (params.concept === "numeric") {
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
    const at = `at threshold ${f2(params.threshold)}`;
    if (params.concept === "roc") {
      return [
        {
          label: "AUC",
          value: f3(state.roc.auc),
          note: "area under the curve — the one number the threshold cannot move",
        },
        { label: "Accuracy", value: f3(cm.acc), note: at },
        { label: "Recall (TPR)", value: f3(cm.rec), note: at },
        { label: "Precision", value: f3(cm.prec), note: at },
      ];
    }
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
