/* ============================================================================
   Widget 34 · roc-auc — Scoring a Classifier

   ROUND 2 (Kenneth, 2026-08-29): ONE page — round 1's two tabs duplicated the
   stage, so the real-test-set tab was cut and the simulated cohort with its
   dials is the whole widget (the all-simulated precedent is lm-diagnostics;
   the notebook's own 60-patient numbers survive in model.js and the measure
   script). Kept: the sweep that traces the ROC curve, and the dragged
   threshold line. Added: the confusion matrix as its own panel, counts
   moving as you scrub the threshold; and Youden as a FIND-OPTIMAL button —
   a probe scans along the finished curve measuring the vertical distance to
   the chance line, and lands on the longest one.

   The stage is still round 0's candidate B: score distributions left with
   the threshold cutting them into the four quadrants, ROC square right,
   the threshold's (FPR, TPR) a dot ON the curve. The curve is never given
   away — the reader traces it, one patient per step, up for a positive and
   right for a negative.
   ========================================================================= */

import { defineWidget, makePlot, histogram, fmt } from "../core/index.js";
import { rocWalk, aucOf, youdenOf, metricsAt, simulate } from "./model.js";

/* Everything draw() touches lives ABOVE defineWidget: core paints during the
   defineWidget call itself, and a binding below it is still in its temporal
   dead zone on the first frame — the trap that has now struck three widgets. */

const HIST_BINS = 36;
const SCAN_MS = 1400; // the find-optimal probe's sweep along the curve
const TRACE_MS = { slow: 9000, medium: 4500, fast: 2200 }; // Play speed, whole sweep

/* The widget's own handle on itself, for the one write the reader's press
   asks for: when the find-optimal scan lands, the threshold MOVES to the
   optimum (round 4 — the button is an action, not a toggle). The write goes
   through the exported setParam — the door that syncs the rail first — and
   the button releases itself in the same breath, so a later press runs the
   search again. Deferred a beat so the landing is seen before the line moves;
   the youden guard makes a stale timer harmless after Reset. */
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

/* --- the strip: the two classes' score histograms, OVERLAID ---------------- *
 * One panel, both classes semi-transparent (round 3 — the two-row split made
 * the overlap invisible, and the overlap IS the problem the threshold cannot
 * solve). Counts on one shared y-scale, deliberately not per-class
 * densities: the class-balance dial has to be VISIBLE here, and per-class
 * normalisation would hide exactly that. The four quadrant counts moved to
 * the matrix panel below, which is now their one home.                       */
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

  /* The search's receipt: where the threshold stood when Find was pressed,
     and the move it made. Anim state, so a data change clears it; a manual
     drag away clears it in rebuild. Skipped when the move is too small to
     draw honestly. */
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
 * Round 3, after the two-row strip went: the notebook's own orientation
 * (sklearn's print order — rows are the TRUE class, negatives first;
 * columns the PREDICTED class), because that is the table students see in
 * 04-2's output and the folded-quadrant rationale died with the split strip.
 *
 * The rendering follows the standard advice for reading these tables:
 * spanning axis titles rather than four cryptic corner labels; each row
 * washed in its class's own hue (the same hue its histogram wears above,
 * which is the link between the panels); wash STRENGTH is the cell's share
 * of its row, so the table is a row-normalised heatmap — the TN and TP
 * cells darken exactly as specificity and sensitivity rise — with the raw
 * count large and its row-share small beneath it.                            */
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
    + "traces the ROC curve; the area under it scores the classifier with no "
    + "threshold at all. Drag the dashed line to move the threshold.",
  layout: "side",
  status: "draft",
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
      detail: "fewer patients, chunkier staircase",
      min: 60, max: 600, step: 20, default: 200,
    },
    seed: {
      type: "int",
      label: "Draw",
      detail: "another simulated cohort",
      min: 1, max: 200, default: 1,
    },

    /* The threshold has no rail control (round 0, pick 4): the dashed line
       on the strip is dragged, through core's drag channel, and the subtitle
       says so. Still a parameter — the URL must reproduce the figure. */
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

    /* THE WITHHELD ANSWER goes below the drive row (widget 10's rule).
       Round 4 made the pill MOMENTARY: pressing it completes the curve if
       needed, sends the probe scanning for the longest distance above the
       chance line, and when the scan lands the threshold MOVES to the
       optimum and the pill releases itself — both writes through the
       exported setParam, the door that syncs the rail. The lasting record
       is the threshold parameter; the ring and the change-arrow are anim
       state that the next data change clears. A pill is a
       <button data-param> the fingerprint's setParam cannot toggle — drive
       its states by URL. */
    youden: {
      type: "bool",
      style: "pill",
      label: "Find the optimal threshold",
      detail: "scans the curve for the longest distance above the chance line — Youden's J — and moves the threshold there",
      default: false,
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },
  },

  /* Static, the theory entry included: the optimum's marks are anim state a
     legend function of the parameters could not track, and the CLT precedent
     lists an overlay whether or not it is currently on screen. */
  legend: [
    { token: "event", label: "Positive class" },
    { token: "nonevent", label: "Negative class" },
    { token: "empirical", label: "ROC curve, traced by the sweep", mark: "line" },
    { token: "reference", label: "Chance — a classifier with no information", mark: "line" },
    { token: "highlight", label: "Decision threshold — drag it", mark: "line" },
    { token: "theory", label: "Youden's J optimum — the farthest point above chance", mark: "line" },
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
        note: `${m.tp} of ${state.nPos} positives found`,
      },
      {
        label: "Specificity",
        value: fmt(m.specificity, 2),
        note: `${m.tn} of ${state.nNeg} negatives cleared`,
      },
    ];
    if (optimumFound(anim, state) && state.youden) {
      tiles.push({
        label: "Youden threshold",
        value: fmt(state.youden.th, 2),
        note: "maximises TPR − FPR — the point farthest above chance",
      });
    }
    return tiles;
  },
});
