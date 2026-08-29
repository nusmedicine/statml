/* ============================================================================
   Widget 34 · roc-auc — Scoring a Classifier

   One simulated cohort: overlaid score histograms with a draggable decision
   threshold, the confusion matrix at that threshold, and the ROC square. The
   curve opens untraced; the sweep traces it one patient at a time, and the
   find-optimal button scans it for Youden's J and moves the threshold there.
   Every design round and its reversals: docs/catalogue.md § Widget 34.
   ========================================================================= */

import { defineWidget, makePlot, histogram, fmt } from "../core/index.js";
import { rocWalk, aucOf, youdenOf, metricsAt, simulate } from "./model.js";

/* Everything draw() touches lives ABOVE defineWidget: core paints during the
   defineWidget call itself, and a binding below it is still in its temporal
   dead zone on the first frame — the trap that has now struck three widgets. */

const HIST_BINS = 36;
const SCAN_MS = 1400; // the find-optimal probe's sweep along the curve
const TRACE_MS = { slow: 9000, medium: 4500, fast: 2200 }; // Play speed, whole sweep

/* When the find-optimal scan lands, the threshold moves to the optimum and
   the button releases itself — both through the exported setParam, the door
   that syncs the rail. Deferred a beat so the landing is seen before the
   line moves; the youden guard disarms a stale timer after Reset. */
let widgetApi = null;
function applyOptimum(th) {
  setTimeout(() => {
    if (!widgetApi || !widgetApi.params.youden) return;
    widgetApi.setParam("threshold", th);
    widgetApi.setParam("youden", false);
  }, 350);
}

/* One source of geometry for draw() AND drag.value(): the same-geometry-twice
   rule. Wide frames put the strip and the matrix in a left column beside the
   ROC square; under 640px the three stack and the height function pays. */
function layout(w, h) {
  if (w < 640) {
    const stripH = 150;
    const matrixY = stripH + 114;
    const side = Math.min(300, w - 130);
    return {
      strip: { x: 46, y: 30, w: w - 66, h: stripH },
      matrix: { x: 46, y: matrixY, w: Math.min(320, w - 86), h: 150 },
      roc: { x: 64, y: matrixY + 206, side },
    };
  }
  const side = Math.min(h - 116, 310);
  const stripH = h - 316;
  return {
    strip: { x: 46, y: 34, w: w - side - 126, h: stripH },
    matrix: { x: 46, y: stripH + 118, w: 320, h: 150 },
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

/* A point part-way along the walk, for the trace frontier and the scan probe.
   Consecutive walk points differ in one coordinate, so the lerp stays on the
   staircase. */
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

const traced = (anim, state) => Boolean(anim) && anim.pos >= state.walk.length - 1;
const midTrace = (anim, state) => Boolean(anim) && anim.pos > 0 && !traced(anim, state);
/* The found-state is ANIM state, not a parameter: the ring and the arrow
   persist after the button has released itself, and a data change sweeps
   them away with the rest of the animation. */
const optimumFound = (anim, state) => Boolean(anim?.scan?.done) && traced(anim, state);

/* --- the strip: the two classes' score histograms, overlaid ---------------- *
 * Counts on one shared y-scale, not per-class densities: the class-balance
 * dial has to be visible here, and per-class normalisation would hide it.   */
function drawStrip(plot, { colors, params, state, anim }, effTh) {
  const { x, y, w, h } = plot;
  const ctx = plot.ctx;

  plot.axisX({ ticks: [0, 0.25, 0.5, 0.75, 1], label: "classifier score" });

  const yMax = Math.max(...state.histPos.counts, ...state.histNeg.counts, 1);
  const hp = makePlot({
    ctx, colors,
    rect: { x, y: y + 8, w, h: h - 8 },
    xDomain: [0, 1],
    yDomain: [0, yMax * 1.05],
  });
  hp.bars(state.histNeg.counts, {
    lo: 0, width: 1 / HIST_BINS, fill: colors.nonevent, opacity: 0.62,
  });
  hp.bars(state.histPos.counts, {
    lo: 0, width: 1 / HIST_BINS, fill: colors.event, opacity: 0.62,
  });

  /* The threshold line — the reader's while idle, the sweep's mid-trace. */
  const sweeping = midTrace(anim, state);
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
    Math.max(x + 40, Math.min(x + w - 40, tx)), y - 10
  );
  /* Which side is which, said once at the line's feet — with the histograms
     overlaid there is no quadrant geometry left to say it. */
  ctx.strokeStyle = colors.surface; // halo — the labels sit over the bars
  ctx.lineWidth = 3;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.strokeText("predicted −", tx - 6, y + h - 6);
  ctx.fillText("predicted −", tx - 6, y + h - 6);
  ctx.textAlign = "left";
  ctx.strokeText("predicted +", tx + 6, y + h - 6);
  ctx.fillText("predicted +", tx + 6, y + h - 6);

  /* Where the threshold stood when Find was pressed, and the move it made.
     Anim state: a data change clears it, and rebuild clears it on a manual
     drag away. Skipped when the move is too small to draw. */
  const f = anim?.found;
  if (f && anim.scan?.done && !sweeping && Math.abs(f.applied - f.from) > 0.02) {
    const ay = y + 20;
    const x0 = x + f.from * w;
    const x1 = x + f.applied * w;
    const dir = Math.sign(x1 - x0);
    ctx.strokeStyle = colors.theory;
    ctx.fillStyle = colors.theory;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, ay - 5);
    ctx.lineTo(x0, ay + 5); // the tick where it stood
    ctx.moveTo(x0, ay);
    ctx.lineTo(x1 - dir * 8, ay);
    ctx.stroke();
    ctx.beginPath(); // the head
    ctx.moveTo(x1, ay);
    ctx.lineTo(x1 - dir * 9, ay - 5);
    ctx.lineTo(x1 - dir * 9, ay + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = dir > 0 ? "right" : "left";
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(`from ${fmt(f.from, 2)}`, x0 - dir * 6, ay + 4);
    ctx.fillText(`from ${fmt(f.from, 2)}`, x0 - dir * 6, ay + 4);
  }
  ctx.restore();
}

/* --- the confusion matrix -------------------------------------------------- *
 * sklearn's orientation (rows = true class, negatives first), the table the
 * notebook prints. Each row wears its class's histogram hue, wash strength =
 * the cell's share of its row, so TN and TP darken as specificity and
 * sensitivity rise.                                                          */
function drawMatrix(ctx, colors, rect, m, th) {
  const { x, y, w, h } = rect;
  const labelW = 64;
  const headH = 32;
  const cw = (w - labelW) / 2;
  const ch = (h - headH) / 2;
  const rowN = [m.tn + m.fp, m.fn + m.tp];
  const cells = [
    { row: 0, col: 0, key: "TN", n: m.tn, hue: colors.nonevent },
    { row: 0, col: 1, key: "FP", n: m.fp, hue: colors.nonevent },
    { row: 1, col: 0, key: "FN", n: m.fn, hue: colors.event },
    { row: 1, col: 1, key: "TP", n: m.tp, hue: colors.event },
  ];

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`The confusion matrix · threshold ${fmt(th, 2)}`, x, y - 10);

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("predicted", x + labelW + cw, y + 10);
  ctx.fillStyle = colors.ink2;
  ctx.fillText("negative", x + labelW + cw * 0.5, y + headH - 6);
  ctx.fillText("positive", x + labelW + cw * 1.5, y + headH - 6);

  ctx.save();
  ctx.translate(x + 10, y + headH + ch);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("true", 0, 0);
  ctx.restore();
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "right";
  ctx.fillText("negative", x + labelW - 8, y + headH + ch * 0.5 + 4);
  ctx.fillText("positive", x + labelW - 8, y + headH + ch * 1.5 + 4);

  for (const c of cells) {
    const cx = x + labelW + c.col * cw;
    const cy = y + headH + c.row * ch;
    const share = rowN[c.row] ? c.n / rowN[c.row] : 0;
    ctx.globalAlpha = 0.07 + 0.45 * share;
    ctx.fillStyle = c.hue;
    ctx.fillRect(cx + 1, cy + 1, cw - 2, ch - 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(c.key, cx + 6, cy + 4);

    ctx.fillStyle = colors.ink1;
    ctx.font = `600 ${colors.fsMd} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(c.n), cx + cw * 0.5, cy + ch * 0.42);
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillText(
      `${Math.round(share * 100)}% of ${c.row === 0 ? "negatives" : "positives"}`,
      cx + cw * 0.5, cy + ch * 0.78
    );
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
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

  if (!done) return;

  plot.note(`AUC ${fmt(state.auc, 3)}`);
  const m = metricsAt(state.scores, state.labels, params.threshold);
  plot.dot(m.fpr, m.tpr, { fill: colors.highlight, r: 6 });

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
    const ctx = plot.ctx;
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
    ctx.fillText(`Youden ${fmt(yd.th, 2)}`, px + (yd.fpr < 0.55 ? 11 : -11), py - 4);
    ctx.restore();
  }
}

/* The probe's vertical: from the chance line straight up to the curve. */
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

/* ========================================================================= */

widgetApi = defineWidget({
  slug: "roc-auc",
  title: "Scoring a Classifier",
  subtitle:
    "A classifier gives each patient a score, and a decision threshold turns "
    + "scores into predictions. Sweeping the threshold across every patient "
    + "traces the ROC curve, and the area under it summarises performance "
    + "across all thresholds.",
  layout: "side",
  height: ({ w }) => (w && w < 640 ? 810 : 470),

  params: {
    data: { type: "section", label: "The data" },
    sep: {
      type: "float",
      label: "Separation",
      detail: "how far apart the two classes' scores sit",
      min: 0.2, max: 3, step: 0.1, default: 1.3,
    },
    balance: {
      type: "float",
      label: "Class balance",
      detail: "the share of patients in the positive class",
      min: 0.1, max: 0.9, step: 0.05, default: 0.5,
    },
    n: {
      type: "int",
      label: "Sample size n",
      min: 60, max: 600, step: 20, default: 200,
    },
    seed: {
      type: "int",
      label: "Draw",
      detail: "another simulated cohort",
      min: 1, max: 200, default: 1,
    },

    /* No rail control: the dashed line on the strip is dragged, through
       core's drag channel. Still a parameter — the URL must reproduce the
       figure. */
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
    },

    /* The withheld answer, below the drive row (widget 10's rule). The pill
       is MOMENTARY: the scan's landing writes the threshold and releases the
       pill through the exported setParam, so the lasting record is the
       threshold parameter alone. A pill is a <button data-param> the
       fingerprint's setParam cannot toggle — drive its states by URL. */
    youden: {
      type: "bool",
      style: "pill",
      label: "Find the optimal threshold",
      detail: "moves the threshold to the point maximising TPR − FPR (Youden's J)",
      default: false,
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },
  },

  /* Static, the theory entry included: the optimum's marks are anim state a
     legend function of the parameters could not track. */
  legend: [
    { token: "event", label: "Positive class" },
    { token: "nonevent", label: "Negative class" },
    { token: "empirical", label: "ROC curve", mark: "line" },
    { token: "reference", label: "Random baseline", mark: "line" },
    { token: "highlight", label: "Decision threshold", mark: "line" },
    { token: "theory", label: "Youden's J optimum", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const { scores, labels } = simulate(rng, {
      n: params.n, balance: params.balance, sep: params.sep,
    });
    const walk = rocWalk(scores, labels);
    const nPos = labels.reduce((a, l) => a + l, 0);
    return {
      scores,
      labels,
      walk,
      auc: aucOf(walk),
      youden: youdenOf(walk),
      nPos,
      nNeg: labels.length - nPos,
      histPos: histogram(scores.filter((s, i) => labels[i] === 1), [0, 1], HIST_BINS),
      histNeg: histogram(scores.filter((s, i) => labels[i] === 0), [0, 1], HIST_BINS),
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
      /* A URL arriving with youden=1 (a link copied mid-search) opens
         finished-and-found without moving the threshold — a URL shows what
         it says. Replay starts the trace over. */
      const pos = fromScratch ? 0
        : params.youden ? total
          : Math.min(Math.max(0, params.shown ?? 0), total);
      const done = pos >= total;
      return {
        pos,
        done,
        youdenOn: Boolean(params.youden),
        scan: params.youden && done ? { t: 1, done: true } : null,
        found: null,
      };
    },

    advance: (anim, { dt, params, state }) => {
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
      /* The trace has landed; if the search is pending the scan plays in the
         same breath, and its landing is what moves the threshold. */
      if (params.youden && anim.scan && !anim.scan.done) {
        anim.scan.t = Math.min(1, anim.scan.t + dt / SCAN_MS);
        if (anim.scan.t < 1) return true;
        anim.scan.done = true;
        if (state.youden) {
          const applied = Math.max(0.01, Math.min(0.99,
            Math.round(state.youden.th * 100) / 100));
          anim.found = { from: params.threshold, th: state.youden.th, applied };
          applyOptimum(applied);
        }
      }
      return false;
    },

    /* Display changes land here. Pressing the pill completes the curve
       (finding an optimum on a partial curve would be a lie) and requests
       ease frames for the scan. The pill's own release and the threshold
       write pass through afterwards and must not restart anything — that is
       the youdenOn latch. */
    rebuild: (anim, { params, state }) => {
      const total = state.walk.length - 1;
      anim.pos = Math.min(anim.pos, total);
      if (params.youden && !anim.youdenOn) {
        anim.pos = total;
        anim.done = true;
        anim.scan = { t: 0 };
        anim.found = null;
        anim.easing = true;
      }
      anim.youdenOn = Boolean(params.youden);
      /* The reader dragged away from a found optimum: the arrow no longer
         describes the line, so it goes; the ring stays — it marks a property
         of the curve, not of the reader's threshold. */
      if (anim.found && Math.abs(params.threshold - anim.found.applied) > 1e-9) {
        anim.found = null;
      }
    },
  },

  drag: {
    params: ["threshold"],
    cursor: "ew-resize",
    /* The strip only: with the whole canvas draggable, a click-and-slip on
       the ROC square nudged the threshold unnoticed (~0.02 per 8 px).
       Margins take in the label above and the axis row below. */
    hit: ({ x, y, w, h }) => {
      const L = layout(w, h);
      return x >= L.strip.x && x <= L.strip.x + L.strip.w
        && y >= L.strip.y - 16 && y <= L.strip.y + L.strip.h + 30;
    },
    value: ({ dx, start, w, h }) => {
      const L = layout(w, h);
      const t = start.threshold + dx / L.strip.w;
      return { threshold: Math.max(0.01, Math.min(0.99, Math.round(t * 100) / 100)) };
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const L = layout(w, h);

    /* One effective threshold everywhere (round 3): while the sweep is
       tracing, the line, the matrix and the tiles all follow IT — the
       matrix churning through every threshold is the point of the sweep. */
    const effTh = midTrace(anim, state)
      ? sweepThresholdAt(state.walk, anim.pos)
      : params.threshold;

    const strip = makePlot({
      ctx, colors,
      rect: L.strip,
      xDomain: [0, 1],
      yDomain: [0, 1],
    });
    strip.caption("A simulated cohort");
    /* inside, or it shares the caption line with the threshold label and the
       two collide whenever the threshold sits right of ~0.55 */
    strip.note(`${state.scores.length} patients · ${state.nPos} positive`, { inside: true });
    drawStrip(strip, { colors, params, state, anim }, effTh);

    drawMatrix(ctx, colors, L.matrix,
      metricsAt(state.scores, state.labels, effTh), effTh);

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
    const effTh = midTrace(anim, state)
      ? sweepThresholdAt(state.walk, anim.pos)
      : params.threshold;
    const m = metricsAt(state.scores, state.labels, effTh);
    const tiles = [
      {
        label: "AUC",
        value: done ? fmt(state.auc, 3) : "—",
        note: done ? "area under the ROC curve" : "trace the curve first",
      },
      {
        label: "Accuracy",
        value: fmt(m.accuracy, 2),
        note: `${m.tp + m.tn} of ${state.scores.length} correct`,
      },
      {
        label: "Sensitivity",
        value: fmt(m.sensitivity, 2),
        note: `${m.tp} of ${state.nPos} positives`,
      },
      {
        label: "Specificity",
        value: fmt(m.specificity, 2),
        note: `${m.tn} of ${state.nNeg} negatives`,
      },
    ];
    if (optimumFound(anim, state) && state.youden) {
      tiles.push({
        label: "Youden threshold",
        value: fmt(state.youden.th, 2),
        note: "maximises TPR − FPR",
      });
    }
    return tiles;
  },
});
