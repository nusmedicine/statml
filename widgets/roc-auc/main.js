/* ============================================================================
   Widget 34 · roc-auc — Scoring a Classifier

   The stage is Kenneth's pick from _lab/roc-mock.html (2026-08-29): candidate
   B, the linked pair. Left, one dot per patient on the score axis with the
   decision threshold cutting the strip into the four confusion-matrix
   quadrants; right, the ROC square, where the threshold's (FPR, TPR) is a
   dot ON the curve. The curve itself is never given away: the reader traces
   it, one patient per step — up for a death, right for a survivor — which is
   also what AUC means (a random positive outranking a random negative).

   Two tabs. "Threshold" is the notebook's own held-out test set (04-2's
   heart-failure model, 60 patients — model.js carries the provenance);
   "What moves the curve" is a simulated cohort with the separation and
   balance dials of the D3 app this widget grew from. The threshold is a
   DRAGGED line, not a rail slider (Kenneth's pick 4); Youden's optimum is
   an overlay toggle (pick 3).
   ========================================================================= */

import { defineWidget, makePlot, histogram, fmt } from "../core/index.js";
import { REAL, rocWalk, aucOf, youdenOf, metricsAt, simulate } from "./model.js";

/* Everything draw() touches lives ABOVE defineWidget: core paints during the
   defineWidget call itself, and a binding below it is still in its temporal
   dead zone on the first frame — the trap that has now struck three widgets. */

const HIST_BINS = 36; // the simulated tab's per-class score histograms

/* One source of geometry for draw() AND drag.value(): the same-geometry-twice
   rule. Wide frames put the strip beside the ROC square; under 640px the
   strip goes on top and the square below (the height function pays for it). */
function layout(w, h) {
  if (w < 640) {
    const stripH = 168;
    const side = Math.min(320, w - 130, h - stripH - 150);
    return {
      strip: { x: 46, y: 30, w: w - 66, h: stripH },
      roc: { x: 64, y: stripH + 104, side },
    };
  }
  const side = Math.min(h - 116, 300);
  return {
    strip: { x: 46, y: 34, w: w - side - 126, h: h - 118 },
    roc: { x: w - side - 16, y: 34, side },
  };
}

/* The sweep's own threshold mid-trace: between patient i and i+1 it lerps
   from the score just passed toward the next, starting at 1 before anyone. */
function sweepThresholdAt(walk, pos) {
  const i = Math.floor(pos);
  const f = pos - i;
  const from = i === 0 ? 1 : walk[i].th;
  const to = i + 1 < walk.length ? walk[i + 1].th : walk[i].th;
  return from + (to - from) * f;
}

/* The traced part of the staircase, with the segment in flight drawn
   partially. Consecutive walk points differ in one coordinate, so a straight
   lerp stays on the staircase. */
function tracePath(walk, pos) {
  const k = Math.floor(pos);
  const pts = [];
  for (let i = 0; i <= k && i < walk.length; i += 1) pts.push([walk[i].fpr, walk[i].tpr]);
  const f = pos - k;
  if (f > 0 && k + 1 < walk.length) {
    const a = walk[k];
    const b = walk[k + 1];
    pts.push([a.fpr + (b.fpr - a.fpr) * f, a.tpr + (b.tpr - a.tpr) * f]);
  }
  return pts;
}

const traced = (anim, state) => Boolean(anim) && anim.pos >= state.walk.length - 1;
const midTrace = (anim, state) => Boolean(anim) && anim.pos > 0 && !traced(anim, state);

/* --- the strip: one dot per patient, or the two class histograms ---------- */

function drawStrip(plot, { colors, params, state, anim }) {
  const { x, y, w, h } = plot;
  const ctx = plot.ctx;
  const real = params.concept === "threshold";

  plot.axisX({
    ticks: [0, 0.25, 0.5, 0.75, 1],
    label: real ? "predicted probability of death" : "classifier score",
  });

  if (real) {
    /* Two beeswarm rows — deaths above, survivors below — each stacking
       upward from its own baseline, the midline splitting them. */
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("died", x + 4, y + 12);
    ctx.fillText("survived", x + 4, y + h * 0.5 + 12);
    ctx.restore();

    const bins = 46;
    const bw = w / bins;
    const r = Math.max(3.2, Math.min(4.6, bw * 0.62));
    const pitch = r * 2 + 1.6;
    const stacks = {};
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < state.scores.length; i += 1) {
      const died = state.labels[i] === 1;
      const b = Math.min(bins - 1, Math.floor(state.scores[i] * bins));
      const key = `${died}:${b}`;
      const s = (stacks[key] = (stacks[key] ?? 0) + 1);
      const base = died ? y + h * 0.5 - 10 : y + h - 8;
      ctx.beginPath();
      ctx.arc(x + (b + 0.5) * bw, base - (s - 1) * pitch, r, 0, Math.PI * 2);
      ctx.fillStyle = died ? colors.event : colors.nonevent;
      ctx.fill();
    }
    ctx.restore();
  } else {
    /* Counts, not densities: the class-balance dial has to be VISIBLE here,
       and per-class density normalisation would hide exactly that. */
    const yMax = Math.max(...state.histPos.counts, ...state.histNeg.counts, 1);
    const hp = makePlot({
      ctx, colors,
      rect: { x, y, w, h },
      xDomain: [0, 1],
      yDomain: [0, yMax * 1.06],
    });
    hp.bars(state.histNeg.counts, {
      lo: 0, width: 1 / HIST_BINS, fill: colors.nonevent, opacity: 0.62,
    });
    hp.bars(state.histPos.counts, {
      lo: 0, width: 1 / HIST_BINS, fill: colors.event, opacity: 0.62,
    });
  }

  /* The threshold line — the reader's while idle, the sweep's mid-trace. */
  const sweeping = midTrace(anim, state);
  const th = sweeping ? sweepThresholdAt(state.walk, anim.pos) : params.threshold;
  const tx = x + Math.max(0, Math.min(1, th)) * w;
  const ctx2 = plot.ctx;
  ctx2.save();
  ctx2.strokeStyle = colors.highlight;
  ctx2.lineWidth = 2;
  ctx2.setLineDash([5, 4]);
  ctx2.beginPath();
  ctx2.moveTo(tx, y - 4);
  ctx2.lineTo(tx, y + h);
  ctx2.stroke();
  ctx2.setLineDash([]);
  ctx2.fillStyle = colors.highlight;
  ctx2.font = `${colors.fsXs} ${colors.font}`;
  ctx2.textAlign = "center";
  ctx2.textBaseline = "alphabetic";
  ctx2.fillText(
    sweeping ? "sweeping" : `threshold ${fmt(params.threshold, 2)}`,
    Math.max(x + 34, Math.min(x + w - 34, tx)), y - 10
  );

  /* The quadrant counts ARE the confusion matrix; on the real tab their
     geometry is the strip's own rows. Hidden while the sweep owns the line —
     they describe the reader's threshold, which is parked mid-trace. */
  if (real && !sweeping) {
    const m = metricsAt(state.scores, state.labels, params.threshold);
    ctx2.font = `${colors.fsXs} ${colors.font}`;
    ctx2.fillStyle = colors.ink2;
    ctx2.textAlign = "right";
    ctx2.fillText(`FN ${m.fn}`, tx - 8, y + 26);
    ctx2.fillText(`TN ${m.tn}`, tx - 8, y + h * 0.5 + 26);
    ctx2.textAlign = "left";
    ctx2.fillText(`TP ${m.tp}`, tx + 8, y + 26);
    ctx2.fillText(`FP ${m.fp}`, tx + 8, y + h * 0.5 + 26);
  }
  ctx2.restore();
}

/* --- the ROC square ------------------------------------------------------- */

function drawRoc(plot, { colors, params, state, anim }) {
  const done = traced(anim, state);

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

  if (done) {
    plot.note(`AUC ${fmt(state.auc, 3)}`);
    const m = metricsAt(state.scores, state.labels, params.threshold);
    plot.dot(m.fpr, m.tpr, { fill: colors.highlight, r: 6 });

    if (params.youden && state.youden) {
      const ctx = plot.ctx;
      const px = plot.sx(state.youden.fpr);
      const py = plot.sy(state.youden.tpr);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.strokeStyle = colors.theory;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = colors.theory;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = state.youden.fpr < 0.55 ? "left" : "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        `Youden ${fmt(state.youden.th, 2)}`,
        px + (state.youden.fpr < 0.55 ? 11 : -11), py - 4
      );
      ctx.restore();
    }
  }
}

/* ========================================================================= */

defineWidget({
  slug: "roc-auc",
  title: "Scoring a Classifier",
  subtitle:
    "A classifier gives each patient a score, and a decision threshold turns "
    + "scores into predictions. Sweeping the threshold across every patient "
    + "traces the ROC curve; the area under it scores the classifier with no "
    + "threshold at all. Drag the dashed line to move the threshold.",
  layout: "side",
  status: "draft",
  height: ({ w }) => (w && w < 640 ? 620 : 440),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        {
          value: "threshold", label: "Threshold",
          detail: "the notebook's heart-failure model on its 60 held-out patients",
        },
        {
          value: "moves", label: "What moves the curve",
          detail: "a simulated cohort — dial the separation and the class balance",
        },
      ],
      default: "threshold",
    },

    data: {
      type: "section",
      label: "The data",
      when: { param: "concept", equals: "moves" },
    },
    sep: {
      type: "float",
      label: "Separation",
      detail: "how far apart the two classes' scores sit",
      min: 0.2, max: 3, step: 0.1, default: 1.3,
      when: { param: "concept", equals: "moves" },
    },
    balance: {
      type: "float",
      label: "Class balance",
      detail: "the share of patients in the positive class",
      min: 0.1, max: 0.9, step: 0.05, default: 0.5,
      when: { param: "concept", equals: "moves" },
    },
    n: {
      type: "int",
      label: "Sample size n",
      detail: "fewer patients, chunkier staircase",
      min: 60, max: 600, step: 20, default: 200,
      when: { param: "concept", equals: "moves" },
    },
    seed: {
      type: "int",
      label: "Draw",
      detail: "another simulated cohort",
      min: 1, max: 200, default: 1,
      when: { param: "concept", equals: "moves" },
    },

    /* The threshold has no rail control (Kenneth's pick 4): the dashed line
       on the strip is dragged, through core's drag channel, and the subtitle
       says so. Still a parameter — the URL must reproduce the figure. */
    threshold: {
      type: "float",
      label: "Decision threshold",
      min: 0.01, max: 0.99, step: 0.01, default: 0.5,
      display: true,
      hidden: true,
    },

    /* THE WITHHELD ANSWER goes below the drive row (widget 10's rule):
       Youden is where the curve says to stand, and the reader should sweep
       the threshold themselves before being handed the optimum. */
    youden: {
      type: "bool",
      label: "Youden's J optimum",
      detail: "the threshold farthest above the chance line — argmax(TPR − FPR)",
      default: false,
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },
  },

  legend: ({ params }) => [
    params.concept === "threshold"
      ? { token: "event", label: "Died", mark: "dot" }
      : { token: "event", label: "Positive class" },
    params.concept === "threshold"
      ? { token: "nonevent", label: "Survived", mark: "dot" }
      : { token: "nonevent", label: "Negative class" },
    { token: "empirical", label: "ROC curve, traced by the sweep", mark: "line" },
    { token: "reference", label: "Chance — a classifier with no information", mark: "line" },
    { token: "highlight", label: "Decision threshold — drag it", mark: "line" },
    ...(params.youden
      ? [{ token: "theory", label: "Youden's J optimum", mark: "dot" }]
      : []),
  ],

  compute: ({ params, rng }) => {
    const data = params.concept === "moves"
      ? simulate(rng, { n: params.n, balance: params.balance, sep: params.sep })
      : { scores: REAL.probs, labels: REAL.labels };
    const walk = rocWalk(data.scores, data.labels);
    const nPos = data.labels.reduce((a, l) => a + l, 0);
    return {
      scores: data.scores,
      labels: data.labels,
      walk,
      auc: aucOf(walk),
      youden: youdenOf(walk),
      nPos,
      nNeg: data.labels.length - nPos,
      histPos: params.concept === "moves"
        ? histogram(data.scores.filter((s, i) => data.labels[i] === 1), [0, 1], HIST_BINS)
        : null,
      histNeg: params.concept === "moves"
        ? histogram(data.scores.filter((s, i) => data.labels[i] === 0), [0, 1], HIST_BINS)
        : null,
    };
  },

  animation: {
    stepLabel: "Next patient",
    stepTitle: "Move the sweep past one more patient — the curve steps up "
      + "for a positive, right for a negative",
    runLabel: "Trace",
    runTitle: "Sweep the threshold from 1 to 0, tracing the whole curve",

    init: ({ params, state, fromScratch }) => {
      const total = state.walk.length - 1;
      const pos = fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), total);
      return { pos, done: pos >= total };
    },

    advance: (anim, { dt, params, state }) => {
      const total = state.walk.length - 1;
      if (anim.pos >= total) { anim.done = true; return false; }
      const target = anim.mode === "step"
        ? Math.min(total, Math.floor(anim.pos + 1e-9) + 1)
        : total;
      const rate = anim.mode === "step" ? 1 / 260 : total / 4500;
      anim.pos = Math.min(target, anim.pos + dt * rate);
      if (anim.pos >= total) { anim.pos = total; anim.done = true; return false; }
      return anim.pos < target;
    },

    rebuild: (anim, { state }) => {
      const total = state.walk.length - 1;
      anim.pos = Math.min(anim.pos, total);
      anim.done = anim.pos >= total;
    },
  },

  drag: {
    params: ["threshold"],
    cursor: "ew-resize",
    value: ({ dx, start, w, h }) => {
      const L = layout(w, h);
      const t = start.threshold + dx / L.strip.w;
      return { threshold: Math.max(0.01, Math.min(0.99, Math.round(t * 100) / 100)) };
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const L = layout(w, h);

    const strip = makePlot({
      ctx, colors,
      rect: L.strip,
      xDomain: [0, 1],
      yDomain: [0, 1],
    });
    strip.caption(params.concept === "threshold" ? "The held-out test set" : "A simulated cohort");
    strip.note(`${state.scores.length} patients · ${state.nPos} ${params.concept === "threshold" ? "died" : "positive"}`);
    drawStrip(strip, { colors, params, state, anim });

    const roc = makePlot({
      ctx, colors,
      rect: { x: L.roc.x, y: L.roc.y, w: L.roc.side, h: L.roc.side },
      xDomain: [0, 1],
      yDomain: [0, 1],
    });
    roc.caption("The ROC curve");
    drawRoc(roc, { colors, params, state, anim });
  },

  readout: ({ params, state, anim }) => {
    const done = traced(anim, state);
    const m = metricsAt(state.scores, state.labels, params.threshold);
    const eventW = params.concept === "threshold" ? "deaths" : "positives";
    const tiles = [
      {
        label: "AUC",
        value: done ? fmt(state.auc, 3) : "—",
        note: done
          ? "area under the curve — the one number no threshold moves"
          : "trace the curve first",
      },
      {
        label: "Accuracy",
        value: fmt(m.accuracy, 2),
        note: `${m.tp + m.tn} of ${state.scores.length} calls correct`,
      },
      {
        label: "Sensitivity",
        value: fmt(m.sensitivity, 2),
        note: `${m.tp} of ${state.nPos} ${eventW} found`,
      },
      {
        label: "Specificity",
        value: fmt(m.specificity, 2),
        note: `${m.tn} of ${state.nNeg} negatives cleared`,
      },
      {
        label: params.concept === "threshold" ? "Missed deaths" : "Missed positives",
        value: String(m.fn),
        note: `of ${state.nPos} — called negative at this threshold`,
      },
    ];
    if (params.youden && done && state.youden) {
      tiles.push({
        label: "Youden threshold",
        value: fmt(state.youden.th, 2),
        note: "maximises TPR − FPR — the point farthest above chance",
      });
    }
    return tiles;
  },
});
