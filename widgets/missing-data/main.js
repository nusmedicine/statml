/* ============================================================================
   Missing data — widget 25, SHIPPED 2026-08-27 after seven review rounds in
   one day. The plan, both hosts, the round history and every measured number
   are in docs/catalogue.md § Widget 25. The claim on screen:

     MCAR — holes follow nothing.       Check flat, observed mean fair.
     MAR  — holes follow AGE.           Check sloped: you can SEE it.
     MNAR — holes follow the value.     Check flat — looks exactly like MCAR —
                                        and the observed mean is biased anyway.

   The truth view (True values) is the widget's superpower: reality never
   grants it, which is the same move as bootstrap's population and
   permutation-test's true effect.

   THE FIGURE, top to bottom: the clinic scatter (age against weight, one dot
   per weighed patient, a tick on the baseline for a patient seen but not
   weighed), a marginal pile of observed weights on the right — the mean rules
   live there, so the mean tiles have marks to match — and the CHECK panel
   below: a weighed/not-weighed composition per age band, the one diagnostic
   reality permits, with its verdict computed from the visible data only.
   Scatter and check share the age axis, so a missing patient's tick and the
   band it thickens line up by construction.

   Drive it with no browser: node widgets/_lab/missing-drive.mjs (130
   assertions — contract, engine, beats, NaN sweeps, the draw strings).
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

const N = 120;                 // cohort size — from the measurement sweep
const W_LO = 46, W_HI = 112;   // fixed weight window; holds every seeded cohort
const BIN_W = 4;               // kg per bin in the marginal pile
const CHECK_BINS = 4;          // 4 beats 6 on the check panel's noise floor

/* Pacing is chosen, not automatic (4.1): per-patient milliseconds, and
   whether the arrival is CHOREOGRAPHED — the arriving patient drawn in the
   highlight colour with a collapsing ring, taking its final colour as it
   lands. At fast there is nothing left to see per patient, so the
   choreography is off as a declared property of the speed, never a decision
   the animation takes mid-run. */
const SPEEDS = {
  slow: { ms: 340, chor: true },
  medium: { ms: 110, chor: true },
  fast: { ms: 26, chor: false },
};
/* A step is one patient WATCHED — a fixed beat, independent of Play speed,
   long enough to follow at the front of a room. */
const STEP_MS = 340;

const meanOf = M.mean;

/* One layout function read by height and draw, so the two cannot drift. */
/* BOT holds the x-axis label AND a reserved line for the check's verdict —
   reserved whether or not a verdict is printed, so finishing the clinic does
   not move the figure (3.4k). */
const PAD_L = 48, PAD_R = 12, PILE_W = 84, GAP = 14, TOP = 16;
const SCATTER_H = 248, CHECK_H = 66, CHECK_GAP = 30, BOT = 52;
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
    "Weight is missing for some patients; age is recorded for all. " +
    "Missingness can be completely at random (MCAR), depend on age (MAR), or " +
    "depend on the unrecorded weight itself (MNAR), and each biases the " +
    "observed data differently.",
  status: "shipped",
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
        { value: "mcar", label: "MCAR", detail: "the scale was broken now and then: missing completely at random" },
        { value: "mar", label: "MAR", detail: "younger patients skip check-ups: missingness is associated with age, which is observed" },
        { value: "mnar", label: "MNAR", detail: "patients heavier than their age predicts avoid the scale: missingness is associated with the unrecorded weight itself" },
      ],
      default: "mcar",
    },
    rate: {
      type: "choice",
      label: "Percentage missing",
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

    /* The reveal, as the clustering pair has it: a segmented Off/On directly
       after Seed — the arc's one pattern for showing what a study never sees
       (kmeans and dbscan's "True groups"). It was first built as a checkbox
       below the drive row per 3.4j; Kenneth moved it here for consistency. */
    truth: {
      type: "segmented",
      label: "True values",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ],
      default: "off",
      display: true,
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
      /* The beat: which patient is ARRIVING and how far through (0..1). Set
         only while a unit is genuinely in flight and cleared the moment it
         completes, so nothing half-faded can outlive its motion — a frozen
         highlight reads as a marked point, not a recent arrival. A user
         pause may freeze mid-beat; that is a paused state, and Resume
         finishes it. */
      beatI: null,
      beatP: 1,
      done: (fromScratch ? 0 : Math.min(params.shown, N)) >= N,
    }),

    advance(anim, { dt, params }) {
      /* One step = one patient's whole beat, spanning frames: return true
         while the unit is in flight, false when it lands (the unit is the
         patient, not the frame). */
      if (anim.mode === "step") {
        if (anim.beatI === null) {
          if (anim.idx >= N) { anim.done = true; return false; }
          anim.beatI = anim.idx;
          anim.beatP = 0;
          anim.idx += 1;
        }
        anim.beatP += dt / STEP_MS;
        if (anim.beatP >= 1) {
          anim.beatI = null;
          anim.beatP = 1;
          anim.done = anim.idx >= N;
          return false;
        }
        return true;
      }

      const sp = SPEEDS[params.speed] ?? SPEEDS.medium;
      anim.t += dt;
      while (anim.t >= sp.ms && anim.idx < N) { anim.t -= sp.ms; anim.idx += 1; }
      if (anim.idx >= N) {
        anim.beatI = null;
        anim.beatP = 1;
        anim.done = true;
        return false;
      }
      if (sp.chor && anim.idx > 0) {
        anim.beatI = anim.idx - 1;
        anim.beatP = Math.min(1, anim.t / sp.ms);
      } else {
        anim.beatI = null;
        anim.beatP = 1;
      }
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const idx = anim?.idx ?? 0;
    const seen = state.pts.slice(0, idx);
    const weighed = seen.filter((p) => !p.miss);
    const missing = seen.filter((p) => p.miss);
    const truth = params.truth === "on" && idx > 0;

    /* --- the clinic scatter ---------------------------------------------- */
    const sc = makePlot({
      ctx, colors, rect: L.scatter,
      xDomain: [M.AGE_LO - 2, M.AGE_HI + 2], yDomain: [W_LO, W_HI],
    });
    sc.grid([60, 80, 100]);
    sc.axisY({ ticks: [60, 80, 100], label: "Weight, kg" });
    sc.caption(`${idx} of ${N} patients seen`);

    /* A patient seen but not weighed: their age is a fact, so they sit on the
       baseline as a tick — present, unmeasured. The ticks carry MAR's whole
       visual story, so they are wider and taller than core's rug: a 1.5px
       tick disappears at a lecture screen.

       THE ARRIVAL: the patient in flight is drawn in the highlight colour
       with a collapsing ring and takes its final colour as it lands (the
       arc's own arrival rule). `beatI` is null whenever no unit is in
       flight, so nothing half-faded survives its motion. */
    const beatI = anim?.beatI ?? null;
    const beatP = anim?.beatP ?? 1;
    const easeOut = (t) => 1 - (1 - t) ** 2;
    const tick = (age, col, hgt, wdt) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = wdt;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sc.sx(age), L.scatter.y + L.scatter.h);
      ctx.lineTo(sc.sx(age), L.scatter.y + L.scatter.h - hgt);
      ctx.stroke();
      ctx.restore();
    };
    for (let i = 0; i < idx; i += 1) {
      const p = state.pts[i];
      const arriving = i === beatI && beatP < 1;
      const e = arriving ? easeOut(beatP) : 1;
      if (p.miss) {
        tick(p.age, arriving ? colors.highlight : colors.unknown, 4 + 7 * e, 2.5);
      } else {
        sc.dot(p.age, p.w, {
          fill: arriving ? colors.highlight : colors.empirical,
          r: 1.6 + 2.2 * e,
        });
      }
      if (arriving) {
        ctx.save();
        ctx.strokeStyle = colors.highlight;
        ctx.globalAlpha = 1 - beatP;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const cy = p.miss ? L.scatter.y + L.scatter.h - 6 : sc.sy(p.w);
        ctx.arc(sc.sx(p.age), cy, 5 + 10 * (1 - e), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (truth) {
      /* Hollow marks where the missing weights really are. Sized and stroked
         to match the filled dots at distance — a 1.6px ring at 3.4px radius
         is a smudge from the back row. */
      ctx.save();
      ctx.strokeStyle = colors.reference;
      ctx.lineWidth = 1.8;
      for (const p of missing) {
        ctx.beginPath();
        ctx.arc(sc.sx(p.age), sc.sy(p.w), 3.8, 0, Math.PI * 2);
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
        { stroke: colors.empirical, width: 2, dash: [6, 4] });
      lineLabel("observed trend", colors.empirical, sc.sy(at(M.AGE_HI)));
    }
    if (truth) {
      const mid = (M.AGE_LO + M.AGE_HI) / 2;
      const tr = (a) => M.W_BASE + M.W_SLOPE * (a - mid);
      sc.curve([[M.AGE_LO, tr(M.AGE_LO)], [M.AGE_HI, tr(M.AGE_HI)]],
        { stroke: colors.reference, width: 2 });
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
    /* The MEANS live on the pile, so the two mean tiles have a mark to match:
       the observed mean as a dashed empirical rule across the column, the true
       mean as a solid reference rule under True values. The scatter's lines
       are the TRENDS; means belong to the marginal distribution. */
    const pileRule = (v, stroke, dash) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(L.pile.x, sc.sy(v));
      ctx.lineTo(L.pile.x + L.pile.w, sc.sy(v));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (weighed.length >= 5) pileRule(meanOf(weighed.map((p) => p.w)), colors.empirical, [4, 3]);
    if (truth) pileRule(state.trueMean, colors.reference, null);
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
    ck.caption("Percentage missing, by age band");
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

      /* The verdict gets its own reserved line under the axis rather than the
         caption's right end — note() dropped inside the panel and printed
         through the columns. Only the finished cohort is judged. */
      if (idx >= N) {
        const verdict = M.checkVerdict(seen, Number(params.rate)) === "sloped"
          ? "the percentage missing is associated with age"
          : "no pattern in age: MCAR and MNAR both look like this";
        ctx.save();
        ctx.fillStyle = colors.ink2;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(verdict, L.check.x, L.check.y + L.check.h + 36);
        ctx.restore();
      }
    }
  },

  readout({ params, state, anim }) {
    const idx = anim?.idx ?? 0;
    const seen = state.pts.slice(0, idx);
    const weighed = seen.filter((p) => !p.miss);
    const obsMean = weighed.length ? meanOf(weighed.map((p) => p.w)) : null;
    const truth = params.truth === "on" && idx > 0;
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
        note: truth ? "all patients, weighed or not" : "never observable in a real study",
      },
      /* The trend's own number, so both figure readings have a tile: the mean
         tiles match the pile rules, this one matches the trend lines.

         THE NOTE DELIBERATELY MAKES NO ARITHMETIC CLAIM. The first version
         said "the mean's bias is the percentage missing times this", and on
         screen that was wrong twice: the sign is minus (the mean FALLS
         because the high weights are missing), and under MAR it is false
         outright — there the mean's bias comes from age composition, not from
         any residual gap, and this tile correctly reads ~0 ± noise. A note
         must be true in every tab it can appear in. */
      (() => {
        const hidden = seen.filter((p) => p.miss);
        const fit = weighed.length >= 10 ? M.fitLine(weighed) : null;
        const gap = truth && fit && hidden.length
          ? meanOf(hidden.map((p) => p.w - (fit.intercept + fit.slope * p.age)))
          : null;
        return {
          label: "Missing vs trend",
          value: gap === null ? "—" : `${gap >= 0 ? "+" : ""}${gap.toFixed(1)} kg`,
          note: "average gap between a missing weight and the trend's prediction",
        };
      })(),
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
