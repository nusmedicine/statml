/* ============================================================================
   Missing data — widget 25. DRAFT: first buildable version for Kenneth to
   drive; the layout has NOT had its mock-up round yet.

   The plan, both hosts and every measured number are in docs/catalogue.md
   § NEXT · Missing data. The claim on screen:

     MCAR — holes follow nothing.       Check flat, observed mean fair.
     MAR  — holes follow AGE.           Check sloped: you can SEE it.
     MNAR — holes follow the value.     Check flat — looks exactly like MCAR —
                                        and the observed mean is biased anyway.

   The truth view (True values) is the widget's superpower: reality never
   grants it, which is the same move as bootstrap's population and
   permutation-test's true effect.

   THE FIGURE, top to bottom: the clinic scatter (age against weight, one dot
   per weighed patient, a tick on the baseline for a patient seen but not
   weighed), a marginal pile of observed weights on the right, and the CHECK
   panel below — % not weighed per age band, the one diagnostic reality
   permits. Scatter and check share the age axis, so a hole's position and the
   band it thickens line up by construction.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

const N = 120;                 // cohort size — from the measurement sweep
const W_LO = 46, W_HI = 112;   // fixed weight window; holds every seeded cohort
const BIN_W = 4;               // kg per bin in the marginal pile
const CHECK_BINS = 4;          // 4 beats 6 on the check panel's noise floor

/* Pacing is chosen, not automatic (4.1): per-patient milliseconds. Past
   "fast" there is nothing left to watch per patient, so it shows arrivals
   only in the sense that they simply appear quickly. */
const SPEEDS = {
  slow: { ms: 300 },
  medium: { ms: 100 },
  fast: { ms: 26 },
};

const meanOf = M.mean;

/* One layout function read by height and draw, so the two cannot drift. */
const PAD_L = 48, PAD_R = 12, PILE_W = 84, GAP = 14, TOP = 16;
const SCATTER_H = 248, CHECK_H = 66, CHECK_GAP = 30, BOT = 34;
function layout(w) {
  const scatterW = Math.max(120, w - PAD_L - GAP - PILE_W - PAD_R);
  const scatter = { x: PAD_L, y: TOP, w: scatterW, h: SCATTER_H };
  const pile = { x: PAD_L + scatterW + GAP, y: TOP, w: PILE_W, h: SCATTER_H };
  const check = { x: PAD_L, y: TOP + SCATTER_H + CHECK_GAP, w: scatterW, h: CHECK_H };
  return { scatter, pile, check, height: check.y + check.h + BOT };
}

defineWidget({
  slug: "missing-data",
  title: "Missing Data",
  subtitle:
    "Each patient's age is known; the weight can go missing. The mechanism " +
    "sets where the holes fall: at random, following age, or following the " +
    "weight itself. The check panel shows which of those a study can detect.",
  status: "draft",
  layout: "side",
  height: ({ w }) => layout(w).height,

  legend: [
    { token: "empirical", label: "Weighed — the weight on record", mark: "dot" },
    { token: "unknown", label: "Seen but not weighed — age known, weight missing", mark: "dot" },
    { token: "reference", label: "Where the missing weights really are (True values)", mark: "dot" },
  ],

  params: {
    mechanism: {
      type: "segmented",
      label: "Why weights go missing",
      options: [
        { value: "mcar", label: "MCAR", detail: "the scale was broken now and then — holes follow nothing" },
        { value: "mar", label: "MAR", detail: "younger patients skip check-ups — holes follow age, which is observed" },
        { value: "mnar", label: "MNAR", detail: "patients heavier than their age predicts avoid the scale — holes follow the missing value itself" },
      ],
      default: "mcar",
    },
    rate: {
      type: "choice",
      label: "Share not weighed",
      options: [
        { value: "0.1", label: "10%" },
        { value: "0.2", label: "20%" },
        { value: "0.3", label: "30%" },
        { value: "0.4", label: "40%" },
        { value: "0.5", label: "50%" },
      ],
      default: "0.3",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

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
    /* The reveal, below the drive row (3.4j): the answer only means something
       after holes exist, and 3.4j's rule keeps it out of the setup block. */
    truth: {
      type: "bool",
      label: "True values",
      detail: "the missing weights, the true mean, and the true pile — what reality never shows",
      default: false,
      display: true,
      afterDrive: true,
    },
    shown: { type: "int", min: 0, max: N, default: 0, hidden: true },
  },

  compute: ({ params, rng }) => {
    const pts = M.applyMissing(M.cohort(N, rng), params.mechanism, Number(params.rate), rng);
    const all = pts.map((p) => p.w);
    return { pts, trueMean: meanOf(all), trueSd: M.sd(all) };
  },

  animation: {
    stepLabel: "Next patient",
    stepTitle: "See the next patient: a weight on record, or a hole",
    runLabel: "Play",
    runTitle: "Run the rest of the clinic",

    init: ({ params, fromScratch }) => ({
      idx: fromScratch ? 0 : Math.min(params.shown, N),
      t: 0,
      done: (fromScratch ? 0 : Math.min(params.shown, N)) >= N,
    }),

    advance(anim, { dt, params }) {
      if (anim.idx >= N) { anim.done = true; return false; }
      if (anim.mode === "step") {
        anim.idx += 1;
        anim.done = anim.idx >= N;
        return false;
      }
      anim.t += dt;
      const ms = SPEEDS[params.speed]?.ms ?? 100;
      while (anim.t >= ms && anim.idx < N) { anim.t -= ms; anim.idx += 1; }
      anim.done = anim.idx >= N;
      return !anim.done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const idx = anim?.idx ?? 0;
    const seen = state.pts.slice(0, idx);
    const weighed = seen.filter((p) => !p.miss);
    const missing = seen.filter((p) => p.miss);
    const truth = params.truth && idx > 0;

    /* --- the clinic scatter ---------------------------------------------- */
    const sc = makePlot({
      ctx, colors, rect: L.scatter,
      xDomain: [M.AGE_LO - 2, M.AGE_HI + 2], yDomain: [W_LO, W_HI],
    });
    sc.grid([60, 80, 100]);
    sc.axisY({ ticks: [60, 80, 100], label: "Weight, kg" });
    sc.caption(`${idx} of ${N} patients seen`);

    /* A patient seen but not weighed: their age is a fact, so they sit on the
       baseline as a tick — present, unmeasured. */
    if (missing.length) sc.rug(missing.map((p) => p.age), { stroke: colors.unknown, height: 9 });

    for (const p of weighed) sc.dot(p.age, p.w, { fill: colors.empirical, r: 3.4 });

    if (truth) {
      /* Hollow marks where the missing weights really are. */
      ctx.save();
      ctx.strokeStyle = colors.reference;
      ctx.lineWidth = 1.6;
      for (const p of missing) {
        ctx.beginPath();
        ctx.arc(sc.sx(p.age), sc.sy(p.w), 3.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* THE OBSERVED TREND: w ~ age fitted to the weighed only — the best guess
       the visible data supports. Under truth the TRUE trend joins it, and the
       hollow marks pass verdict on the pair (2.7 — adjacency is the
       argument): under MCAR and MAR the hidden weights straddle the observed
       trend (mean residual −0.1 kg — a prediction built from what you see
       would have been right for what you do not, which is what MAR leaves to
       an imputer), and under MNAR they sit +10.0 ± 1.1 kg above it, on
       400/400 measured cohorts — no function of the observed data could have
       found them. */
    const lineLabel = (text, stroke, atY) => {
      ctx.save();
      ctx.fillStyle = stroke;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(text, L.scatter.x + L.scatter.w - 3, atY - 2);
      ctx.fillText(text, L.scatter.x + L.scatter.w - 3, atY - 2);
      ctx.restore();
    };
    const fit = weighed.length >= 10 ? M.fitLine(weighed) : null;
    if (fit) {
      const at = (a) => fit.intercept + fit.slope * a;
      sc.curve([[M.AGE_LO, at(M.AGE_LO)], [M.AGE_HI, at(M.AGE_HI)]],
        { stroke: colors.empirical, width: 1.7, dash: [6, 4] });
      lineLabel("observed trend", colors.empirical, sc.sy(at(M.AGE_HI)));
    }
    if (truth) {
      const mid = (M.AGE_LO + M.AGE_HI) / 2;
      const tr = (a) => M.W_BASE + M.W_SLOPE * (a - mid);
      sc.curve([[M.AGE_LO, tr(M.AGE_LO)], [M.AGE_HI, tr(M.AGE_HI)]],
        { stroke: colors.reference, width: 1.6 });
      lineLabel("true trend", colors.reference, sc.sy(tr(M.AGE_HI)) + 16);
    }

    /* --- the marginal pile of weights ------------------------------------ */
    const bins = Math.round((W_HI - W_LO) / BIN_W);
    const countUp = (arr) => {
      const c = new Array(bins).fill(0);
      for (const p of arr) {
        const b = Math.min(bins - 1, Math.max(0, Math.floor((p.w - W_LO) / BIN_W)));
        c[b] += 1;
      }
      return c;
    };
    const obsC = countUp(weighed);
    const allC = countUp(seen);
    const maxC = Math.max(6, ...allC);
    ctx.save();
    ctx.fillStyle = colors.empirical;
    for (let b = 0; b < bins; b += 1) {
      if (!obsC[b]) continue;
      const y0 = sc.sy(W_LO + (b + 1) * BIN_W);
      const y1 = sc.sy(W_LO + b * BIN_W);
      ctx.fillRect(L.pile.x, y0 + 1, (L.pile.w * obsC[b]) / maxC, y1 - y0 - 2);
    }
    if (truth) {
      /* The pile every patient would have made — the tail that went missing
         under MNAR is exactly the part the outline has and the fill lacks. */
      ctx.strokeStyle = colors.reference;
      ctx.lineWidth = 1.4;
      for (let b = 0; b < bins; b += 1) {
        if (!allC[b]) continue;
        const y0 = sc.sy(W_LO + (b + 1) * BIN_W);
        const y1 = sc.sy(W_LO + b * BIN_W);
        ctx.strokeRect(L.pile.x + 0.5, y0 + 1, (L.pile.w * allC[b]) / maxC, y1 - y0 - 2);
      }
    }
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("weights", L.pile.x, L.scatter.y - 4);
    ctx.restore();

    /* --- the check panel: the one diagnostic reality permits --------------
       A COMPOSITION per age band, not a rate: blue weighed under grey
       not-weighed, the same two meanings the scatter's dots and ticks carry,
       so nothing has to be inverted in the head — the grey IS the holes'
       share. (Round 1 drew a % - not - weighed profile and Kenneth read it as
       "the age distribution is bad"; round 0 drew bars and they read as a
       histogram of age.) It is also the shape of VIM::aggr, the plot the
       PHM5003 lesson itself uses.

       THE VERDICT is printed only for the finished cohort and only from the
       visible data — a caption keyed off the mechanism parameter would tell
       the student what a study cannot know. Thresholds and misfire rates are
       measured in the model. */
    const ck = makePlot({
      ctx, colors, rect: L.check,
      xDomain: [M.AGE_LO - 2, M.AGE_HI + 2], yDomain: [0, 100],
    });
    ck.caption("Weighed and not, by age band");
    ck.axisX({ ticks: [20, 35, 50, 65, 80], label: "Age, years" });

    if (seen.length) {
      const overall = (100 * missing.length) / seen.length;
      const bands = M.checkPanel(seen, CHECK_BINS).filter((b) => b.n > 0);
      ctx.save();
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      for (const b of bands) {
        const missPct = (100 * b.missing) / b.n;
        const x0 = ck.sx(b.lo) + 4;
        const bw = ck.sx(b.hi) - ck.sx(b.lo) - 8;
        const split = ck.sy(100 - missPct);
        ctx.fillStyle = colors.empirical;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x0, split + 1, bw, ck.sy(0) - split - 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.unknown;
        ctx.fillRect(x0, ck.sy(100), bw, split - ck.sy(100) - 1);
        /* Label the grey — the missing share is the quantity — inside it when
           it is tall enough to hold a line, on the blue otherwise. */
        const greyH = split - ck.sy(100);
        ctx.fillStyle = colors.surface;
        ctx.textBaseline = "middle";
        if (greyH >= 14) {
          ctx.fillText(`${Math.round(missPct)}%`, x0 + bw / 2, ck.sy(100) + greyH / 2);
        } else {
          ctx.fillText(`${Math.round(missPct)}%`, x0 + bw / 2, split + 9);
        }
      }
      /* The boundary every band would share if the mechanism left no trace. */
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const oy = ck.sy(100 - overall);
      ctx.beginPath();
      ctx.moveTo(L.check.x, oy);
      ctx.lineTo(L.check.x + L.check.w, oy);
      ctx.stroke();
      ctx.restore();

      if (idx >= N) {
        const verdict = M.checkVerdict(seen, Number(params.rate)) === "sloped"
          ? "the missing share follows age"
          : "no pattern in age — MCAR and MNAR both look like this";
        ck.note(verdict);
      }
    }
  },

  readout({ params, state, anim }) {
    const idx = anim?.idx ?? 0;
    const seen = state.pts.slice(0, idx);
    const weighed = seen.filter((p) => !p.miss);
    const obsMean = weighed.length ? meanOf(weighed.map((p) => p.w)) : null;
    const truth = params.truth && idx > 0;
    return [
      {
        label: "Weighed",
        value: idx ? `${weighed.length} of ${idx}` : "—",
        note: idx ? `${idx - weighed.length} missing` : `${N} patients to see`,
      },
      {
        label: "Observed mean",
        value: obsMean === null ? "—" : `${obsMean.toFixed(1)} kg`,
        note: "computed from the weighed only",
      },
      {
        label: "True mean",
        value: truth ? `${state.trueMean.toFixed(1)} kg` : "—",
        note: truth ? "all patients, weighed or not" : "the widget knows it; a study never does",
      },
    ];
  },

  summary({ params, state, anim }) {
    const idx = anim?.idx ?? 0;
    const seen = state.pts.slice(0, idx);
    const weighed = seen.filter((p) => !p.miss);
    return `Missing data mechanism ${params.mechanism.toUpperCase()}: ${idx} of ${N} `
      + `patients seen, ${weighed.length} weighed. Scatter of weight against age with `
      + `missing patients on the baseline, observed weight distribution, and % not `
      + `weighed per age band.`;
  },
});
