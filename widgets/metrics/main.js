/* ============================================================================
   Widget 35 · Scoring the Predictions — what each evaluation metric is made
   of, for a numeric and a categorical outcome. Hosts at PHM5005 04-2.

   Round 3 (Kenneth, 2026-08-30): the selection is TWO-LEVEL — Outcome
   (Numeric · Categorical) first, and a categorical outcome then picks its
   metric family (Confusion matrix · ROC curve, the notebook's
   threshold-dependent / threshold-independent split); core's `when` grew an
   `all` form for the fields that exist on one view of one outcome. The
   categorical controls follow widget 34 (Separation, Class balance, Sample
   size n); the matrix view gained a POSITIVE-CLASS pick — choosing the
   target class RENAMES the cells rather than recounting them, sklearn's own
   per-class reading — plus classification_report's macro and weighted
   averages when a per-class metric is picked. The ROC view carries widget
   34's whole act: the trace (Next patient / Trace), the strip-dragged
   threshold, and the momentary find-optimal pill whose scan lands by MOVING
   the threshold to Youden's J.

   Two misconceptions, one per outcome type:
   - numeric: that RMSE, MAE and R² are interchangeable summaries. One outlier
     moves RMSE +38% and MAE +16% (round-0 sweep, sigma 3, magnitude 18), and
     R² is not an error at all but a comparison against predicting the mean.
   - categorical: that accuracy says how good a classifier is. Every
     threshold-dependent metric is a different ratio of the SAME four cells,
     and under imbalance accuracy rises while recall collapses; AUC is the
     one number the threshold cannot move.
   ========================================================================= */

import { defineWidget, makePlot, histogram, fmt } from "../core/index.js";
import {
  NUM_LO, NUM_HI, NUM_N,
  numericCohort, numericMetrics, categoricalPatients, cellsAt,
  categoricalMetrics, classCells, reportAverages, rocWalk, aucOf, youdenOf,
} from "./model.js";

/* Everything draw() touches lives ABOVE defineWidget: core paints during the
   defineWidget call itself, and a binding below it is still in its temporal
   dead zone on the first frame — the trap that has struck three widgets. */

const NOTE_H = 30;
const PAD_T = 10, PAD_B = 44, PAD_L = 46, PAD_R = 16;

const numSide = (w) => Math.max(260, Math.min(410, w - PAD_L - PAD_R - 8));
const NUM_TICKS = [0, 10, 20, 30, 40];

const HIST_BINS = 36;
const CELL_H = 96;
const ROC_SIDE = 300;
const SCAN_MS = 1400; // the find-optimal probe's sweep along the curve
const TRACE_MS = { slow: 9000, medium: 4500, fast: 2200 }; // Play speed

/* When the find-optimal scan lands, the threshold moves to the optimum and
   the pill releases itself — both through the exported setParam (widget 34's
   arrangement). Deferred a beat so the landing is seen before the line
   moves; the youden guard disarms a stale timer after Reset. */
let widgetApi = null;
function applyOptimum(th) {
  setTimeout(() => {
    if (!widgetApi || !widgetApi.params.youden) return;
    widgetApi.setParam("threshold", th);
    widgetApi.setParam("youden", false);
  }, 350);
}

/* THE TRACE IS A ONE-WAY DOOR, and the door is a PARAMETER (Kenneth, round
   4): once the reader has watched the curve built, every later data change —
   sample size, balance, separation, seed, positive class — shows its new
   curve INSTANTLY, so the dials explore what bends a ROC curve rather than
   re-running the reveal. `traced=1` is written through the exported setParam
   when the trace first lands, which keeps invariant 1: the URL says whether
   the figure is revealed, a shared link opens the way it looked, and Reset —
   which returns every parameter to its default — is what closes the door. */
function markTraced() {
  setTimeout(() => {
    if (!widgetApi) return;
    const p = widgetApi.params;
    if (p.traced || p.outcome !== "categorical" || p.view !== "roc") return;
    widgetApi.setParam("traced", true);
  }, 0);
}

/* One source of geometry for draw() AND drag.value(). */
function catLayout(w, view) {
  if (view === "matrix") {
    const strip = { x: 46, y: 34, w: w - 66, h: 132 };
    /* 64 below the strip: the strip's own axis label needs its row before
       the matrix's spanning "predicted:" titles begin */
    return { strip, matrixY: strip.y + strip.h + 64 };
  }
  if (w < 640) {
    const side = Math.min(ROC_SIDE, w - 130);
    const strip = { x: 46, y: 34, w: w - 66, h: 132 };
    return { strip, roc: { x: (w - side) / 2 + 10, y: strip.y + strip.h + 56, side } };
  }
  return {
    strip: { x: 46, y: 34, w: w - ROC_SIDE - 126, h: 228 },
    roc: { x: w - ROC_SIDE - 46, y: 30, side: ROC_SIDE },
  };
}

function catHeight(w, view) {
  const L = catLayout(w, view);
  if (view === "matrix") return L.matrixY + 2 * CELL_H + 46;
  return Math.max(L.strip.y + L.strip.h, L.roc.y + L.roc.side) + 48;
}

const f2 = (x) => x.toFixed(2);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");

/* --- the trace walk, widget 34's helpers ---------------------------------- */

function sweepThresholdAt(walk, pos) {
  const i = Math.floor(pos);
  const f = pos - i;
  const from = i === 0 ? 1 : walk[i].th;
  const to = i + 1 < walk.length ? walk[i + 1].th : walk[i].th;
  return from + (to - from) * f;
}

function walkPointAt(walk, pos) {
  const k = Math.floor(pos);
  const f = pos - k;
  const a = walk[Math.min(k, walk.length - 1)];
  if (f <= 0 || k + 1 >= walk.length) return { fpr: a.fpr, tpr: a.tpr };
  const b = walk[k + 1];
  return { fpr: a.fpr + (b.fpr - a.fpr) * f, tpr: a.tpr + (b.tpr - a.tpr) * f };
}

function tracePath(walk, pos) {
  const k = Math.floor(pos);
  const pts = [];
  for (let i = 0; i <= k && i < walk.length; i += 1) pts.push([walk[i].fpr, walk[i].tpr]);
  if (pos - k > 0 && k + 1 < walk.length) {
    const p = walkPointAt(walk, pos);
    pts.push([p.fpr, p.tpr]);
  }
  return pts;
}

const isRoc = (anim) => anim?.kind === "roc";
const traced = (anim, state) => isRoc(anim) && anim.pos >= state.walk.length - 1;
const midTrace = (anim, state) => isRoc(anim) && anim.pos > 0 && !traced(anim, state);
const optimumFound = (anim, state) => Boolean(anim?.scan?.done) && traced(anim, state);

/* The sweep's threshold lives on the WALK's score scale, which is 1 − prob
   when "no disease" is the positive class; the strip's axis is always the
   probability of disease, so the sweep position maps back through the flip. */
const effThreshold = (params, state, anim) => {
  if (!midTrace(anim, state)) return params.threshold;
  const s = sweepThresholdAt(state.walk, anim.pos);
  return state.posIsDisease ? s : 1 - s;
};

/* --- the formula card, in the DOM (widget 15's pattern) --------------------
   MathML where the engine sets it, the plain string otherwise. One <math>
   per term so the card can wrap at the seams; rebuilt only when its content
   key moves, because draw() runs per frame. */

function mathmlRenders() {
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;visibility:hidden;font-size:16px";
  box.innerHTML = "<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math><math><mn>1</mn></math>";
  document.body.appendChild(box);
  const [fr, plain] = [...box.querySelectorAll("math")].map((m) => m.getBoundingClientRect().height);
  box.remove();
  return fr > plain * 1.3;
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
        html: `${M(mi("RMSE") + mo("="))} ${M(root(frac(`<mo>Σ</mo>${sq(`<mo>(</mo>${ERR}<mo>)</mo>`)}`, mi("n"))))} ${EQ} ${M(mn(f2(m.rmse)))}`,
        plain: `RMSE = √( Σ(predicted − actual)² / n ) = ${f2(m.rmse)}`,
      };
    case "mae":
      return {
        html: `${M(mi("MAE") + mo("="))} ${M(frac(`<mo>Σ</mo><mo>|</mo>${ERR}<mo>|</mo>`, mi("n")))} ${EQ} ${M(mn(f2(m.mae)))}`,
        plain: `MAE = Σ|predicted − actual| / n = ${f2(m.mae)}`,
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

/* TP here means "true positive FOR THE CHOSEN CLASS" — the matrix's cell
   names are relabelled by the same choice, so the formula and the lit cells
   always agree. */
function cellFormula(cmetric, cells, cm) {
  const { tp, fp, fn } = cells;
  switch (cmetric) {
    case "acc":
      return {
        html: `${M(mi("Accuracy") + mo("="))} ${M(frac(`${mi("TP")}<mo>+</mo>${mi("TN")}`, mi("n")))} ${EQ} ${M(frac(mn(tp + cells.tn), mn(cm.n)))} ${EQ} ${M(mn(f3(cm.acc)))}`,
        plain: `Accuracy = (TP + TN) / n = ${tp + cells.tn} / ${cm.n} = ${f3(cm.acc)}`,
      };
    case "prec":
      return {
        html: `${M(mi("Precision") + mo("="))} ${M(frac(mi("TP"), `${mi("TP")}<mo>+</mo>${mi("FP")}`))} ${EQ} ${M(frac(mn(tp), mn(tp + fp)))} ${EQ} ${M(mn(f3(cm.prec)))}`,
        plain: `Precision = TP / (TP + FP) = ${tp} / ${tp + fp} = ${f3(cm.prec)}`,
      };
    case "rec":
      return {
        html: `${M(mi("Recall") + mo("="))} ${M(frac(mi("TP"), `${mi("TP")}<mo>+</mo>${mi("FN")}`))} ${EQ} ${M(frac(mn(tp), mn(tp + fn)))} ${EQ} ${M(mn(f3(cm.rec)))}`,
        plain: `Recall = TP / (TP + FN) = ${tp} / ${tp + fn} = ${f3(cm.rec)}`,
      };
    case "f1":
      return {
        html: `${M(`<msub>${mi("F")}<mn>1</mn></msub>` + mo("="))} ${M(frac(`<mn>2</mn><mo>·</mo>${mi("Precision")}<mo>·</mo>${mi("Recall")}`, `${mi("Precision")}<mo>+</mo>${mi("Recall")}`))} ${EQ} ${M(frac(`<mn>2</mn><mo>·</mo>${mn(f3(cm.prec))}<mo>·</mo>${mn(f3(cm.rec))}`, mn(f3(cm.prec + cm.rec))))} ${EQ} ${M(mn(f3(cm.f1)))}`,
        plain: `F1 = 2·Precision·Recall / (Precision + Recall) = ${f3(cm.f1)}`,
      };
    default:
      return {
        html: `${M(mi("n") + mo("=") + `${mi("TP")}<mo>+</mo>${mi("FP")}<mo>+</mo>${mi("FN")}<mo>+</mo>${mi("TN")}`)} ${EQ} ${M(mn(cm.n))}`,
        plain: `n = TP + FP + FN + TN = ${cm.n}`,
      };
  }
}

function rocFormula(cells, auc, done) {
  const { tp, fp, tn, fn } = cells;
  const tpr = tp + fn ? tp / (tp + fn) : NaN;
  const fpr = fp + tn ? fp / (fp + tn) : NaN;
  const aucStr = done ? f3(auc) : "—";
  return {
    html: `${M(mi("TPR") + mo("=") + frac(mi("TP"), `${mi("TP")}<mo>+</mo>${mi("FN")}`) + mo("=") + mn(f3(tpr)))}  ${M(mi("FPR") + mo("=") + frac(mi("FP"), `${mi("FP")}<mo>+</mo>${mi("TN")}`) + mo("=") + mn(f3(fpr)))}  ${M(mi("AUC") + mo("=") + (done ? mn(aucStr) : mi(aucStr)))}`,
    plain: `TPR = TP/(TP+FN) = ${f3(tpr)} · FPR = FP/(FP+TN) = ${f3(fpr)} · AUC = ${aucStr}`,
  };
}

let cardHost = null;
let cardKey = null;

function renderCard(params, state, anim) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  let eq;
  if (params.outcome === "numeric") {
    eq = numericFormula(params.metric, state.m);
  } else {
    const effTh = effThreshold(params, state, anim);
    const cells = cellsAt(state.patients, effTh);
    if (params.view === "matrix") {
      const c2 = classCells(cells, params.positive);
      eq = cellFormula(params.cmetric, c2, categoricalMetrics(c2));
    } else {
      eq = rocFormula(classCells(cells, params.positive), state.auc, traced(anim, state));
    }
  }
  if (eq.plain === cardKey) return;
  cardKey = eq.plain;
  if (MATHML) cardHost.innerHTML = eq.html;
  else cardHost.textContent = eq.plain;
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
    rmse: "each square's area is one squared error; large errors dominate the sum",
    mae: "each bar's length is one absolute error; all errors count equally",
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

/* --- categorical: the strip (widget 34's, with a flip) --------------------- *
 * Counts on one shared y-scale, not per-class densities: the class-balance
 * dial has to be visible here. `flip` renames the line's feet when the
 * positive class is "no disease" — predicted + is then LEFT of the line.    */
function drawStrip(ctx, colors, L, { state, effTh, sweeping, flip, found }) {
  const { x, y, w, h } = L;
  const plot = makePlot({ ctx, colors, rect: L, xDomain: [0, 1], yDomain: [0, 1] });
  plot.caption("A simulated screening cohort");
  plot.note(`${state.patients.length} patients · ${state.nPos} with disease`, { inside: true });
  plot.axisX({
    ticks: [0, 0.25, 0.5, 0.75, 1],
    format: (v) => v.toFixed(2),
    label: "predicted probability of disease",
  });

  const yMax = Math.max(...state.histPos.counts, ...state.histNeg.counts, 1);
  const hp = makePlot({
    ctx, colors,
    rect: { x, y: y + 8, w, h: h - 8 },
    xDomain: [0, 1],
    yDomain: [0, yMax * 1.05],
  });
  hp.bars(state.histNeg.counts, { lo: 0, width: 1 / HIST_BINS, fill: colors.nonevent, opacity: 0.62 });
  hp.bars(state.histPos.counts, { lo: 0, width: 1 / HIST_BINS, fill: colors.event, opacity: 0.62 });

  const tx = x + Math.max(0, Math.min(1, effTh)) * w;
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(tx, y - 4);
  ctx.lineTo(tx, y + h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colors.highlight;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    `${sweeping ? "sweeping" : "threshold"} ${fmt(effTh, 2)}`,
    Math.max(x + 40, Math.min(x + w - 40, tx)), y - 10,
  );
  /* which side is which, said once at the line's feet (widget 34 round 3) */
  const left = flip ? "predicted +" : "predicted −";
  const right = flip ? "predicted −" : "predicted +";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.strokeText(left, tx - 6, y + h - 6);
  ctx.fillText(left, tx - 6, y + h - 6);
  ctx.textAlign = "left";
  ctx.strokeText(right, tx + 6, y + h - 6);
  ctx.fillText(right, tx + 6, y + h - 6);

  /* where the threshold stood when Find was pressed, and the move it made */
  if (found && !sweeping && Math.abs(found.applied - found.from) > 0.02) {
    const ay = y + 20;
    const x0 = x + found.from * w;
    const x1 = x + found.applied * w;
    const dir = Math.sign(x1 - x0);
    ctx.strokeStyle = colors.theory;
    ctx.fillStyle = colors.theory;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, ay - 5);
    ctx.lineTo(x0, ay + 5);
    ctx.moveTo(x0, ay);
    ctx.lineTo(x1 - dir * 8, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, ay);
    ctx.lineTo(x1 - dir * 9, ay - 5);
    ctx.lineTo(x1 - dir * 9, ay + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = dir > 0 ? "right" : "left";
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(`from ${fmt(found.from, 2)}`, x0 - dir * 6, ay + 4);
    ctx.fillText(`from ${fmt(found.from, 2)}`, x0 - dir * 6, ay + 4);
  }
  ctx.restore();
}

/* --- the confusion matrix -------------------------------------------------- *
 * sklearn orientation (rows = true class, negatives first), row wash = the
 * cell's share of its row. The CELL NAMES follow the chosen positive class:
 * calling "no disease" positive renames TN to TP and swaps which mistakes
 * are false positives — nothing is recounted, which is the lesson.          */
function drawMatrix(ctx, colors, { x0, y0, cw }, cells, positive, lit) {
  const { tp, fp, tn, fn } = cells;
  const grid = [[tn, fp], [fn, tp]];
  const names = positive === "disease"
    ? [["TN", "FP"], ["FN", "TP"]]
    : [["TP", "FN"], ["FP", "TN"]];
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

const CMETRICS = {
  acc: { lit: { TN: "num", TP: "num", FP: "den", FN: "den" } },
  prec: { lit: { TP: "num", FP: "den" } },
  rec: { lit: { TP: "num", FN: "den" } },
  f1: { lit: { TP: "num", FP: "den", FN: "den" } },
};

function drawMatrixView({ ctx, colors, w, params, state }) {
  const L = catLayout(w, "matrix");
  drawStrip(ctx, colors, L.strip, {
    state,
    effTh: params.threshold,
    sweeping: false,
    flip: params.positive === "healthy",
    found: null,
  });
  const cw = Math.max(96, Math.min(180, (w - 140) / 2));
  drawMatrix(ctx, colors, { x0: (w - 2 * cw) / 2 + 14, y0: L.matrixY, cw },
    cellsAt(state.patients, params.threshold), params.positive,
    CMETRICS[params.cmetric]?.lit ?? null);
}

/* --- the ROC square (widget 34's act) -------------------------------------- */

function drawRocSquare(ctx, colors, { x, y, side }, params, state, anim) {
  const plot = makePlot({
    ctx, colors,
    rect: { x, y, w: side, h: side },
    xDomain: [0, 1],
    yDomain: [0, 1],
  });
  plot.caption("The ROC curve");
  plot.grid([0.25, 0.5, 0.75]);
  plot.axisX({ ticks: [0, 0.5, 1], label: "false positive rate" });
  plot.axisY({ ticks: [0, 0.5, 1], label: "true positive rate" });
  plot.curve([[0, 0], [1, 1]], { stroke: colors.reference, width: 1.5, dash: [5, 4] });

  const pts = tracePath(state.walk, anim?.pos ?? 0);
  if (pts.length > 1) plot.curve(pts, { stroke: colors.empirical, width: 2.5 });

  if (midTrace(anim, state) && pts.length) {
    const [fx, fy] = pts[pts.length - 1];
    plot.dot(fx, fy, { fill: colors.highlight, r: 5 });
  }

  if (!traced(anim, state)) return;

  plot.note(`AUC ${f3(state.auc)}`);
  /* the axes are the POSITIVE class's rates, so the dot reads through the
     same per-class remap the matrix view uses */
  const c2 = classCells(cellsAt(state.patients, params.threshold),
    state.posIsDisease ? "disease" : "healthy");
  const tpr = c2.tp + c2.fn ? c2.tp / (c2.tp + c2.fn) : 0;
  const fpr = c2.fp + c2.tn ? c2.fp / (c2.fp + c2.tn) : 0;
  plot.dot(fpr, tpr, { fill: colors.highlight, r: 6 });

  /* THE FIND-OPTIMAL SCAN: a probe walks the finished curve, and the
     vertical segment it carries — down to the chance line — is Youden's J
     made visible. The longest segment is where it lands. */
  const scanning = anim?.scan && !anim.scan.done;
  if (scanning) {
    const p = walkPointAt(state.walk, anim.scan.t * (state.walk.length - 1));
    segment(plot, colors, p, { dashed: true });
    plot.dot(p.fpr, p.tpr, { fill: colors.theory, r: 4.5 });
  }

  if (optimumFound(anim, state) && state.youden) {
    const yd = state.youden;
    segment(plot, colors, yd, { dashed: false });
    const px = plot.sx(yd.fpr);
    const py = plot.sy(yd.tpr);
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = colors.theory;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = yd.fpr < 0.55 ? "left" : "right";
    ctx.textBaseline = "bottom";
    /* printed on the strip's own scale — the threshold the landing writes */
    const ydProb = state.posIsDisease ? yd.th : 1 - yd.th;
    ctx.fillText(`Youden ${fmt(ydProb, 2)}`, px + (yd.fpr < 0.55 ? 11 : -11), py - 4);
    ctx.restore();
  }
}

function segment(plot, colors, p, { dashed }) {
  const ctx = plot.ctx;
  ctx.save();
  ctx.strokeStyle = colors.theory;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(plot.sx(p.fpr), plot.sy(p.fpr));
  ctx.lineTo(plot.sx(p.fpr), plot.sy(p.tpr));
  ctx.stroke();
  ctx.restore();
}

function drawRocView({ ctx, colors, w, params, state, anim }) {
  const L = catLayout(w, "roc");
  drawStrip(ctx, colors, L.strip, {
    state,
    effTh: effThreshold(params, state, anim),
    sweeping: midTrace(anim, state),
    flip: !state.posIsDisease,
    found: anim?.scan?.done ? anim.found : null,
  });
  drawRocSquare(ctx, colors, L.roc, params, state, anim);
}

/* ========================================================================= */

widgetApi = defineWidget({
  slug: "metrics",
  title: "Scoring the Predictions",
  subtitle:
    "We can score a model by comparing its predictions with the actual "
    + "outcomes. A numeric outcome is scored by the size of the errors; a "
    + "categorical outcome by the confusion matrix at one chosen threshold, "
    + "or across every threshold at once with the ROC curve.",
  layout: "side",

  height: ({ outcome, view, w }) =>
    (outcome === "numeric" ? NOTE_H + PAD_T + numSide(w) + PAD_B : catHeight(w, view)),

  params: {
    /* TWO-LEVEL, Kenneth's round 3: outcome first, and a categorical outcome
       then picks its metric family — the notebook's threshold-dependent /
       threshold-independent split, carried by the details. */
    outcome: {
      type: "segmented",
      label: "Outcome",
      options: [
        { value: "numeric", label: "Numeric", detail: "predicting a measurement — % body fat" },
        { value: "categorical", label: "Categorical", detail: "predicting a class — disease or not" },
      ],
      default: "numeric",
    },
    view: {
      type: "segmented",
      label: "Metric family",
      options: [
        {
          value: "matrix", label: "Confusion matrix",
          detail: "threshold-dependent: the four cells at one chosen cutoff",
        },
        {
          value: "roc", label: "ROC curve",
          detail: "threshold-independent: the trade-off across every cutoff",
        },
      ],
      default: "matrix",
      when: { param: "outcome", equals: "categorical" },
    },

    data: { type: "section", label: "The data" },

    noise: {
      type: "float",
      label: "Model error σ",
      detail: "SD of the prediction errors, % body fat",
      min: 1, max: 8, step: 0.5, default: 3,
      when: { param: "outcome", equals: "numeric" },
    },
    outliers: {
      type: "int",
      label: "Outliers",
      detail: "patients the model badly mispredicts",
      min: 0, max: 3, default: 0,
      when: { param: "outcome", equals: "numeric" },
    },

    /* the categorical dials wear widget 34's names and ranges, so the two
       widgets read as siblings */
    sep: {
      type: "float",
      label: "Separation",
      detail: "how far apart the model scores the two groups",
      min: 0.2, max: 3, step: 0.1, default: 1.5,
      when: { param: "outcome", equals: "categorical" },
    },
    prev: {
      type: "float",
      label: "Class balance",
      detail: "the share of the cohort with the disease (prevalence)",
      min: 0.05, max: 0.95, step: 0.05, default: 0.3,
      when: { param: "outcome", equals: "categorical" },
    },
    n: {
      type: "int",
      label: "Sample size n",
      min: 60, max: 600, step: 20, default: 200,
      when: { param: "outcome", equals: "categorical" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    pick: { type: "section", label: "The metric" },

    metric: {
      type: "segmented",
      label: "Metric",
      options: [
        { value: "none", label: "None", detail: "the errors alone" },
        { value: "rmse", label: "RMSE", detail: "root mean squared error — each error drawn as a square" },
        { value: "mae", label: "MAE", detail: "mean absolute error — each error drawn as a bar" },
        { value: "r2", label: "R²", detail: "the model's squares against the mean model's" },
      ],
      default: "none",
      display: true,
      when: { param: "outcome", equals: "numeric" },
    },
    /* Which class the report row is about, wearing its histogram's hue.
       On the matrix view choosing it renames the cells and re-reads every
       per-class metric — sklearn's per-class rows, one at a time. On the ROC
       view it re-scores the walk (score 1 − p, labels flipped): the curve
       point-reflects and AUC does not move, which is its own lesson —
       relabelling the classes changes no discrimination. */
    positive: {
      type: "segmented",
      label: "Positive class",
      options: [
        { value: "disease", label: "Disease", token: "event", detail: "disease counts as positive" },
        { value: "healthy", label: "No disease", token: "nonevent", detail: "no disease counts as positive" },
      ],
      default: "disease",
      display: true,
      when: { param: "outcome", equals: "categorical" },
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
        { value: "prec", label: "Precision", detail: "of predicted positives, how many real", group: "about the positive class" },
        { value: "rec", label: "Recall", detail: "of true positives, how many found", group: "about the positive class" },
        { value: "f1", label: "F1", detail: "harmonic mean of precision and recall", group: "about the positive class" },
      ],
      default: "none",
      display: true,
      when: { all: [{ param: "outcome", equals: "categorical" }, { param: "view", equals: "matrix" }] },
    },

    /* Dragged on the strip, never a rail slider — widget 34's decision. In
       the URL, so a state is shareable; hidden from the rail. */
    threshold: {
      type: "float",
      label: "Decision threshold",
      min: 0.01, max: 0.99, step: 0.01, default: 0.5,
      display: true,
      hidden: true,
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "Slow" },
        { value: "medium", label: "Medium" },
        { value: "fast", label: "Fast" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
      when: { all: [{ param: "outcome", equals: "categorical" }, { param: "view", equals: "roc" }] },
    },

    /* The withheld answer, below the drive row (widget 10's rule). MOMENTARY,
       widget 34's arrangement: the scan's landing writes the threshold and
       releases the pill through the exported setParam, so the lasting record
       is the threshold parameter alone. */
    youden: {
      type: "bool",
      style: "pill",
      label: "Find the optimal threshold",
      detail: "moves the threshold to the point maximising TPR − FPR (Youden's J)",
      default: false,
      display: true,
      afterDrive: true,
      when: { all: [{ param: "outcome", equals: "categorical" }, { param: "view", equals: "roc" }] },
    },

    /* The one-way door: written true (through the exported setParam) when
       the trace first lands, so later data changes redraw the finished curve
       instantly and the dials explore what bends it. Reset closes it. */
    traced: { type: "bool", default: false, display: true, hidden: true },

    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },
  },

  legend: ({ params }) =>
    (params.outcome === "numeric"
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
        ...(params.view === "roc"
          ? [
            { token: "empirical", label: "ROC curve", mark: "line" },
            { token: "reference", label: "Random baseline", mark: "line" },
            { token: "theory", label: "Youden's J optimum", mark: "line" },
          ] : []),
      ]),

  compute: ({ params, rng }) => {
    if (params.outcome === "numeric") {
      const cohort = numericCohort(rng, { sigma: params.noise, outliers: params.outliers });
      const m = numericMetrics(cohort.actual, cohort.pred);
      /* the same cohort before its outliers — same seed, same stream — so
         the outlier tile reports the pull of exactly the misses added */
      const m0 = numericMetrics(cohort.actual, cohort.predBase);
      return { cohort, m, m0 };
    }
    const patients = categoricalPatients(rng, { n: params.n, prev: params.prev, d: params.sep });
    /* the walk is scored FOR the chosen positive class: score 1 − p and
       flipped labels when "no disease" is positive, so the curve's axes are
       always that class's TPR and FPR */
    const posIsDisease = params.positive === "disease";
    const scored = posIsDisease
      ? patients
      : patients.map((p) => ({ prob: 1 - p.prob, disease: !p.disease }));
    const walk = rocWalk(scored);
    const probsOf = (want) => patients.filter((p) => p.disease === want).map((p) => p.prob);
    return {
      patients,
      posIsDisease,
      walk,
      auc: aucOf(walk),
      youden: youdenOf(walk),
      nPos: patients.filter((p) => p.disease).length,
      histPos: histogram(probsOf(true), [0, 1], HIST_BINS),
      histNeg: histogram(probsOf(false), [0, 1], HIST_BINS),
    };
  },

  animation: {
    stepLabel: "Next patient",
    stepTitle: "Move the sweep past one more patient — the curve steps up "
      + "for a positive, right for a negative",
    runLabel: "Trace",
    runTitle: "Sweep the threshold from 1 to 0, tracing the whole curve",

    init: ({ params, state, fromScratch }) => {
      if (params.outcome === "categorical" && params.view === "roc") {
        const total = state.walk.length - 1;
        /* traced=1 (the one-way door) and youden=1 open finished on ANY
           init, data changes included — that is what lets the dials explore
           a finished curve; a shown= head start applies to the first render
           only, like every other widget's */
        let pos;
        if (params.traced || params.youden) pos = total;
        else if (!fromScratch) pos = Math.min(Math.max(0, params.shown ?? 0), total);
        else pos = 0;
        const done = pos >= total;
        if (done) markTraced(); // no-op once traced=1 is in the URL
        return {
          kind: "roc",
          pos,
          done,
          youdenOn: Boolean(params.youden),
          scan: params.youden && done ? { t: 1, done: true } : null,
          found: null,
        };
      }
      /* the numeric R² ease; inert hides Step and Trace on the two views
         with nothing to drive (core's inert door) */
      const t = params.outcome === "numeric" && params.metric === "r2" ? 1 : 0;
      return { kind: "plain", inert: true, t, target: t };
    },

    advance: (anim, { dt, params, state }) => {
      if (anim.kind === "plain") {
        const dir = Math.sign(anim.target - anim.t);
        if (dir === 0) return false;
        anim.t = Math.max(0, Math.min(1, anim.t + (dir * dt) / 600));
        if ((dir > 0 && anim.t >= anim.target) || (dir < 0 && anim.t <= anim.target)) {
          anim.t = anim.target;
          return false;
        }
        return true;
      }

      /* REPLAY THROUGH THE KEPT CURVE: with traced=1 a fresh init opens
         finished, so a run or step arriving on a finished figure is the
         reader asking to watch the build again — the trace restarts and the
         door stays open. The scan's frames arrive as mode "ease" and are
         not this. */
      if ((anim.mode === "run" || anim.mode === "step") && anim.done === true) {
        anim.pos = 0;
        anim.done = false;
        anim.scan = null;
        anim.found = null;
      }

      const total = state.walk.length - 1;
      if (anim.pos < total) {
        const target = anim.mode === "step"
          ? Math.min(total, Math.floor(anim.pos + 1e-9) + 1)
          : total;
        const rate = anim.mode === "step"
          ? 1 / 260
          : total / (TRACE_MS[params.speed] ?? TRACE_MS.medium);
        anim.pos = Math.min(target, anim.pos + dt * rate);
        if (anim.pos < target) return true;
        if (anim.pos < total) return false; // a step landed short of the end
      }
      anim.done = true;
      if (!anim.tracedMark) {
        anim.tracedMark = true;
        markTraced(); // the one-way door opens the first time the trace lands
      }
      /* the trace has landed; a pending search scans in the same breath,
         and its landing is what moves the threshold */
      if (params.youden && anim.scan && !anim.scan.done) {
        anim.scan.t = Math.min(1, anim.scan.t + dt / SCAN_MS);
        if (anim.scan.t < 1) return true;
        anim.scan.done = true;
        if (state.youden) {
          /* the walk's threshold is on the positive class's score scale;
             what lands in the URL is the strip's probability-of-disease */
          const thProb = state.posIsDisease ? state.youden.th : 1 - state.youden.th;
          const applied = Math.max(0.01, Math.min(0.99, Math.round(thProb * 100) / 100));
          anim.found = { from: params.threshold, th: thProb, applied };
          applyOptimum(applied);
        }
      }
      return false;
    },

    /* Display changes land here. Pressing the pill completes the curve
       (finding an optimum on a partial curve would be a lie) and requests
       ease frames for the scan; the pill's own release and the threshold
       write pass through afterwards and must not restart anything — the
       youdenOn latch (widget 34). */
    rebuild: (anim, { params, state }) => {
      if (anim.kind === "plain") {
        const target = params.outcome === "numeric" && params.metric === "r2" ? 1 : 0;
        if (target !== anim.target) {
          anim.target = target;
          anim.easing = true;
        }
        return;
      }
      const total = state.walk.length - 1;
      anim.pos = Math.min(anim.pos, total);
      if (params.youden && !anim.youdenOn) {
        anim.pos = total;
        anim.done = true;
        anim.scan = { t: 0 };
        anim.found = null;
        anim.easing = true;
        markTraced(); // completing the curve for the search reveals it too
      }
      anim.youdenOn = Boolean(params.youden);
      /* dragged away from a found optimum: the arrow no longer describes
         the line, so it goes; the ring stays — it marks a property of the
         curve, not of the reader's threshold */
      if (anim.found && Math.abs(params.threshold - anim.found.applied) > 1e-9) {
        anim.found = null;
      }
    },
  },

  drag: {
    params: ["threshold"],
    cursor: "ew-resize",
    /* the strip only (widget 34's rule: a click-and-slip on the ROC square
       must not nudge the threshold), and only where a strip is drawn */
    hit: ({ x, y, w, params }) => {
      if (params.outcome !== "categorical") return false;
      const L = catLayout(w, params.view);
      return x >= L.strip.x && x <= L.strip.x + L.strip.w
        && y >= L.strip.y - 16 && y <= L.strip.y + L.strip.h + 30;
    },
    value: ({ dx, start, w, params }) => {
      const L = catLayout(w, params.view);
      const t = start.threshold + dx / L.strip.w;
      return { threshold: Math.max(0.01, Math.min(0.99, Math.round(t * 100) / 100)) };
    },
  },

  draw(args) {
    renderCard(args.params, args.state, args.anim);
    if (args.params.outcome === "numeric") drawNumeric(args);
    else if (args.params.view === "matrix") drawMatrixView(args);
    else drawRocView(args);
  },

  readout: ({ params, state, anim }) => {
    if (params.outcome === "numeric") {
      const { m, m0 } = state;
      const tiles = [
        /* plain floats, the notebook's own print(); the unit leads the note
           — "2.59 %" read as a RELATIVE error of 2.59%, which it is not */
        { label: "RMSE", value: f2(m.rmse), note: "% body fat; penalises large errors more" },
        { label: "MAE", value: f2(m.mae), note: "% body fat; all errors count equally" },
        { label: "R²", value: f3(m.r2), note: "share of the spread explained; 0 = the mean model" },
      ];
      if (params.outliers > 0) {
        const pull = (a, b) => `${b >= a ? "+" : "−"}${Math.abs((100 * (b - a)) / a).toFixed(0)}%`;
        tiles.push({
          label: "Outlier pull",
          value: `${pull(m0.rmse, m.rmse)} RMSE`,
          note: `MAE ${pull(m0.mae, m.mae)} — squaring amplifies the outlier`,
        });
      }
      return tiles;
    }

    if (params.view === "roc") {
      const done = traced(anim, state);
      const effTh = effThreshold(params, state, anim);
      const c2 = classCells(cellsAt(state.patients, effTh), params.positive);
      const cm = categoricalMetrics(c2);
      const posName = params.positive === "disease" ? "disease" : "no disease";
      const negName = params.positive === "disease" ? "no disease" : "disease";
      const nPosCls = c2.tp + c2.fn;
      const nNegCls = c2.tn + c2.fp;
      const tiles = [
        {
          label: "AUC",
          value: done ? f3(state.auc) : "—",
          note: done ? "area under the ROC curve" : "trace the curve first",
        },
        { label: "Accuracy", value: f2(cm.acc), note: `${c2.tp + c2.tn} of ${state.patients.length} correct` },
        {
          label: "Sensitivity",
          value: f2(Number.isFinite(cm.rec) ? cm.rec : 0),
          note: `${c2.tp} of ${nPosCls} true “${posName}” found`,
        },
        {
          label: "Specificity",
          value: f2(nNegCls ? c2.tn / nNegCls : 0),
          note: `${c2.tn} of ${nNegCls} true “${negName}” correct`,
        },
      ];
      if (optimumFound(anim, state) && state.youden) {
        tiles.push({
          label: "Youden threshold",
          value: fmt(state.posIsDisease ? state.youden.th : 1 - state.youden.th, 2),
          note: "maximises TPR − FPR",
        });
      }
      return tiles;
    }

    const cells = cellsAt(state.patients, params.threshold);
    const c2 = classCells(cells, params.positive);
    const cm = categoricalMetrics(c2);
    const posName = params.positive === "disease" ? "disease" : "no disease";
    const negName = params.positive === "disease" ? "no disease" : "disease";
    const tiles = [
      { label: "Accuracy", value: f3(cm.acc), note: "correct on everyone" },
      { label: "Precision", value: f3(cm.prec), note: `of predicted “${posName}”, how many real` },
      { label: "Recall", value: f3(cm.rec), note: `of true “${posName}”, how many found` },
      { label: "F1", value: f3(cm.f1), note: "harmonic mean of precision and recall" },
      {
        label: "All-negative baseline",
        value: f3(cm.base),
        note: `say “${negName}” for everyone — accuracy has to beat this`,
      },
    ];
    /* classification_report's two summary rows, only when a per-class
       metric is picked, and on their OWN row (round 4): an average over
       both classes is a different kind of number from the per-class tiles
       beside it */
    const avKey = { prec: "prec", rec: "rec", f1: "f1" }[params.cmetric];
    if (avKey) {
      const av = reportAverages(cells)[avKey];
      tiles.push(
        { break: true },
        { label: "Macro avg", value: f3(av.macro), note: "both classes weighted equally" },
        { label: "Weighted avg", value: f3(av.weighted), note: "weighted by class size — can mask the minority" },
      );
    }
    return tiles;
  },
});
