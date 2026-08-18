/* ============================================================================
   Confidence intervals — widget 4 of the statistics arc.

     increments → means → one sample → AN INTERVAL → a null by shuffling → many nulls

   Widgets 1–3 build the sampling distribution. This one is about READING it:
   widget 3 already computes the distribution an interval is cut from, so the
   only new idea here is what you do with it.

   MISCONCEPTION TARGETED — documented, not inferred. That there is a 95% chance
   the true value lies in THIS interval. A realised interval either contains the
   truth or it does not; the 95% describes the PROCEDURE across many studies.
   Greenland et al. 2016 enumerate it and record it persisting among researchers.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - ONE VERB, TWO READINGS. Every press runs one study: sample two groups,
     bootstrap the difference, cut the 2.5th and 97.5th percentiles. The `view`
     control then chooses how the SAME studies are drawn — this one in detail, or
     all of them as a ladder. That makes view a display parameter, so a student
     can build a hundred studies and only then flip to see coverage without
     losing a single one. Invariant 3 is not a constraint here, it is the design:
     the two pictures are the same evidence, and being able to move between them
     without rebuilding is what lets the second correct the first.

   - THE LADDER IS THE ARGUMENT, THE SINGLE INTERVAL IS ITS SETUP. One interval
     looks like an answer — a range, around your estimate, that feels like where
     the truth is. A hundred of them, with about five missing and a vertical rule
     showing which, says the thing the first picture cannot: the 95% was never a
     property of your interval. It is the hit rate of the machine that made it.

   - A MISSING INTERVAL IS `--c-extreme`, NOT A NEW COLOUR. "Past a threshold" is
     exactly what a miss is, and widget 5 already uses that red for the shuffles
     a p-value counts. Same red, same meaning: this one is on the wrong side of a
     line that matters.

   - THE TRUTH IS DRAWN, AND IT IS THE ONLY THING THAT DOES NOT MOVE. A vertical
     `--c-reference` rule at the true difference, spanning the whole ladder. The
     intervals scatter around it; it never scatters around them. That is the
     asymmetry the misconception gets backwards.

   - THE WINDOW IS CENTRED ON THE TRUTH, NEVER ON THE ESTIMATE. Centring on the
     estimate is the obvious choice, puts the interval in the middle every time,
     and hides the one thing the method cannot do. Widget 3 earned this rule.

   - THE READOUT PAIRS NOMINAL WITH REALISED, and shows the partial count so a
     student watches 95% arrive rather than being told it. Early on the realised
     figure is visibly noisy — 3 of 4 is 75% — which is itself the lesson that
     the guarantee is asymptotic.

   PERCENTILES COME FROM A SORTED ARRAY THIS WIDGET KEEPS, not from the pile.
   `createPile` holds binned counts and running sums, not values, so a quantile
   read off it would be interpolated within a bin — and an interval read off an
   approximation is a bad thing to teach percentiles with. The pile stays what it
   is good at, which is being the drawing. If widget 6 ever needs quantiles too,
   that is the moment to reconsider, not before.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, EFFECT_SD, fmt,
  makePlot, niceTicks,
  binsFor,
} from "../core/index.js";

/* Detail lines are this widget's own. The multiples are shared with widget 5
   (core/stats.js) because the two must describe the same experiment, but what is
   worth saying about an effect differs: widget 5's details carry detection
   rates, because a p-value is about detection. An interval is about width, so
   these say what the interval has to do. */
const EFFECTS = {
  none: { label: "None", detail: "the true difference is exactly zero", sd: EFFECT_SD.none },
  small: { label: "Small", detail: "0.4 SD — narrow intervals will miss it", sd: EFFECT_SD.small },
  moderate: { label: "Moderate", detail: "0.9 SD", sd: EFFECT_SD.moderate },
  large: { label: "Large", detail: "1.3 SD", sd: EFFECT_SD.large },
};

/* Every tier still shows the interval being cut. What the fastest one drops is
   the per-resample choreography, not the information — the lesson recorded in
   widget 5, where a speed that quietly stopped updating a panel froze half the
   figure with nothing on screen saying why. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every resample shown", ms: 1500, choreo: true },
  medium: { label: "Medium", detail: "every resample shown", ms: 700, choreo: true },
  fast: { label: "Fast", detail: "intervals only", ms: 90, choreo: false },
};

const VIEWS = {
  one: { label: "This study" },
  all: { label: "All studies" },
};

const CONF = 0.95;
const TAIL = (1 - CONF) / 2;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const distOptions = ["normal", "exponential", "bimodal", "uniform", "pareto"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** The statistic, in one place. Both the study and every resample use it, so
    the halves of the figure cannot come to disagree about what a difference is. */
const diffOf = (a, b) => {
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) sa += a[i];
  for (let i = 0; i < b.length; i += 1) sb += b[i];
  return sb / b.length - sa / a.length;
};

/** Percentile of an ASCENDING array, interpolated between neighbours. */
function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

defineWidget({
  slug: "confidence-interval",
  title: "Confidence Intervals",
  status: "draft",
  subtitle:
    "Every study gives one interval, and that one either contains the true " +
    "difference or it does not. The 95% is not about your interval — it is how " +
    "often the procedure that made it succeeds. Run studies until you can see " +
    "the difference between those two statements.",
  height: 560,

  params: {
    dist: { type: "select", label: "Population", options: distOptions, default: "normal" },
    n: { type: "int", label: "Group size n", min: 4, max: 40, default: 12 },

    effect: {
      type: "choice",
      label: "True effect",
      options: Object.entries(EFFECTS).map(([value, e]) => ({ value, label: e.label, detail: e.detail })),
      default: "moderate",
    },

    /* Resamples PER STUDY. Data, not display: change it and every interval is
       cut from a different distribution, so the studies really are different. */
    reps: { type: "int", label: "Resamples per study", min: 50, max: 1000, step: 50, default: 400 },

    /* The first k studies are the same k studies whatever the target, so raising
       this must not throw away what is on screen. */
    studies: { type: "int", label: "Studies to run", min: 1, max: 200, step: 1, default: 100, display: true },

    /* THE VIEW IS A DISPLAY PARAMETER, and that is the whole design. Both views
       draw the SAME studies, so flipping between them keeps every one a student
       has collected. Build a hundred here, then look at them there. */
    view: {
      type: "segmented",
      label: "Show",
      options: Object.entries(VIEWS).map(([value, v]) => ({ value, label: v.label })),
      default: "one",
      display: true,
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
    },

    shown: { type: "int", label: "Pre-filled studies", min: 0, max: 200, default: 0, hidden: true },
  },

  legend: [
    { token: "group-a", label: "Group A", mark: "dot" },
    { token: "group-b", label: "Group B", mark: "dot" },
    { token: "reference", label: "The true difference", mark: "line" },
    { token: "extreme", label: "Interval that misses it", mark: "line" },
  ],

  /* Pure and seeded. EVERY study is computed here, including its whole bootstrap
     distribution and its interval — the animation only reveals them, which is
     what makes the picture land exactly where the seed promises. */
  compute: ({ params, rng }) => {
    const pop = POPULATIONS[params.dist];
    const trueDiff = EFFECTS[params.effect].sd * pop.sd;

    const studies = [];
    for (let s = 0; s < params.studies; s += 1) {
      const a = Array.from({ length: params.n }, () => pop.sample(rng));
      const b = Array.from({ length: params.n }, () => pop.sample(rng) + trueDiff);
      const obs = diffOf(a, b);

      /* The bootstrap of a difference resamples EACH GROUP separately, with
         replacement and at its own size. Pooling the two would destroy the
         grouping this widget is estimating. */
      const diffs = new Array(params.reps);
      for (let r = 0; r < params.reps; r += 1) {
        const ia = rng.resample(params.n);
        const ib = rng.resample(params.n);
        let sa = 0;
        let sb = 0;
        for (let i = 0; i < params.n; i += 1) {
          sa += a[ia[i]];
          sb += b[ib[i]];
        }
        diffs[r] = sb / params.n - sa / params.n;
      }

      // The sorted array IS the interval's source of record — see the header.
      const sorted = [...diffs].sort((x, y) => x - y);
      const lo = quantile(sorted, TAIL);
      const hi = quantile(sorted, 1 - TAIL);

      studies.push({ a, b, obs, diffs, lo, hi, covers: lo <= trueDiff && trueDiff <= hi });
    }

    /* One window for every study and both views, centred on the TRUTH. Widget 3
       earned this: centring on the estimate puts the interval in the middle every
       time and hides the only thing the method cannot do. Wide enough that a
       missing interval still lands inside the frame rather than being clipped
       into invisibility, which would hide exactly the studies that matter. */
    let reach = 0;
    for (const st of studies) {
      reach = Math.max(reach, Math.abs(st.lo - trueDiff), Math.abs(st.hi - trueDiff));
    }
    reach = reach > 0 ? reach * 1.12 : pop.sd;
    const domain = [trueDiff - reach, trueDiff + reach];

    const bins = binsFor(params.reps);
    const width = (domain[1] - domain[0]) / bins;

    return { pop, trueDiff, studies, domain, bins, width };
  },

  animation: {
    stepLabel: "Run a study",
    runLabel: "Play",

    init: ({ params, state, fromScratch }) => ({
      // How many studies are FINISHED. The one in flight is at index `done`.
      done: fromScratch ? 0 : Math.min(params.shown, state.studies.length),
      t: 0,
      running: false,
      done_: false,
    }),

    advance: (anim, { dt, params, state }) => {
      if (anim.done >= state.studies.length) {
        anim.done_ = true;
        return false;
      }
      const speed = SPEEDS[params.speed];
      anim.t += dt / speed.ms;

      if (anim.t < 1) {
        anim.running = true;
        return true;
      }

      anim.t = 0;
      anim.done += 1;
      anim.running = false;
      if (anim.done >= state.studies.length) {
        anim.done_ = true;
        return false;
      }
      return anim.mode === "run";
    },

    /* A display change must not discard the student's work. Nothing derived
       lives in `anim` — it holds a count and a clock, both of which survive a
       binning or view change untouched — so there is nothing to rebuild. The
       hook is declared anyway to say that deliberately rather than by omission. */
    rebuild: (anim, { state }) => {
      anim.done = Math.min(anim.done, state.studies.length);
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const shown = anim ? anim.done : 0;
    const inFlight = anim && anim.running && shown < state.studies.length;

    if (params.view === "all") drawLadder({ ctx, colors, w, h, params, state, shown, inFlight, anim });
    else drawOne({ ctx, colors, w, h, params, state, shown, inFlight, anim });
  },

  readout: ({ state, anim }) => {
    const shown = anim ? anim.done : 0;
    const done = state.studies.slice(0, shown);
    const hits = done.filter((s) => s.covers).length;
    const current = shown > 0 ? done[done.length - 1] : null;

    return [
      {
        label: "This interval",
        value: current ? `${fmt(current.lo, 2)} to ${fmt(current.hi, 2)}` : "—",
        note: current ? (current.covers ? "contains the truth" : "MISSES the truth") : "run a study",
      },
      {
        label: "True difference",
        value: fmt(state.trueDiff, 2),
        note: "you never see this",
      },
      {
        label: "Nominal",
        value: "95%",
        note: "what the procedure promises",
      },
      {
        /* The honest pair. Shows the partial count so the 95% is watched
           arriving rather than asserted — and early on it is visibly noisy,
           which is itself the point that the guarantee is about the long run. */
        label: "Realised so far",
        value: shown ? `${fmt((100 * hits) / shown, 1)}%` : "—",
        note: shown ? `${hits} of ${shown} contained it` : "no studies yet",
      },
    ];
  },

  summary: ({ state, anim }) => {
    const shown = anim ? anim.done : 0;
    if (!shown) return "No studies run yet. The figure is empty.";
    const done = state.studies.slice(0, shown);
    const miss = done.filter((s) => !s.covers).length;
    return (
      `${shown} studies run. ${shown - miss} intervals contain the true difference of ` +
      `${fmt(state.trueDiff, 2)} and ${miss} miss it.`
    );
  },
});

/* --- view 1: this study ------------------------------------------------- */

function drawOne({ ctx, colors, w, h, params, state, shown, inFlight, anim }) {
  const study = shown > 0 ? state.studies[shown - 1] : null;
  const live = inFlight ? state.studies[shown] : null;
  const subject = live ?? study;

  const padL = 54;
  const padR = 16;
  /* A caption is drawn ABOVE its plot rect and an axis label BELOW it, so the
     top inset and the inter-panel gap are both carrying text, not whitespace.
     At 8 and 46 the study caption was clipped off the top of the canvas and
     "observation value" landed on top of the lower panel's caption. */
  const topInset = 30;
  const topH = Math.round(h * 0.32);
  const gap = 66;

  const obsPlot = makePlot({
    ctx, colors,
    rect: { x: padL, y: topInset, w: w - padL - padR, h: topH },
    xDomain: state.pop.domain,
    yDomain: [0, 1],
  });

  obsPlot.axisX({ ticks: niceTicks(state.pop.domain[0], state.pop.domain[1], 6), label: "observation value" });
  obsPlot.caption(
    subject
      ? `Study ${live ? shown + 1 : shown} — two groups of ${params.n}`
      : "Your study — nothing run yet"
  );

  if (subject) {
    // Two rows of observations, A above B, so the shift between them is vertical
    // distance the eye can measure rather than two overlapping clouds.
    const rowA = 0.66;
    const rowB = 0.3;
    const reveal = live ? clamp01(easeOut(anim.t * 2)) : 1;

    for (const [vals, row, tok] of [[subject.a, rowA, colors.groupA], [subject.b, rowB, colors.groupB]]) {
      for (let i = 0; i < vals.length; i += 1) {
        if (i / vals.length > reveal) continue;
        obsPlot.dot(vals[i], row, { fill: tok, r: 3.6 });
      }
    }

    ctx.save();
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.groupA;
    ctx.textAlign = "right";
    ctx.fillText("A", obsPlot.x - 8, obsPlot.sy(rowA) + 4);
    ctx.fillStyle = colors.groupB;
    ctx.fillText("B", obsPlot.x - 8, obsPlot.sy(rowB) + 4);
    ctx.restore();
  }

  /* Lower panel: the bootstrap distribution this study's interval is cut from,
     drawn on the SAME difference scale as the ladder in the other view so the
     two readings are comparable without rescaling anything. */
  const botY = topInset + topH + gap;
  const botH = h - botY - 34;

  const counts = new Array(state.bins).fill(0);
  let peak = 1;
  if (subject) {
    const upTo = live ? Math.floor(subject.diffs.length * clamp01(anim.t)) : subject.diffs.length;
    for (let i = 0; i < upTo; i += 1) {
      const k = Math.floor((subject.diffs[i] - state.domain[0]) / state.width);
      if (k >= 0 && k < state.bins) counts[k] += 1;
    }
    peak = Math.max(1, ...counts);
  }

  const distPlot = makePlot({
    ctx, colors,
    rect: { x: padL, y: botY, w: w - padL - padR, h: botH },
    xDomain: state.domain,
    yDomain: [0, peak * 1.15],
  });

  distPlot.grid(niceTicks(0, peak * 1.15, 4));
  distPlot.axisY({ ticks: niceTicks(0, peak * 1.15, 4), label: "count" });
  distPlot.axisX({ ticks: niceTicks(state.domain[0], state.domain[1], 6), label: "difference in means (B − A)" });
  distPlot.caption(
    subject
      ? `Resampling this one study — the middle ${Math.round(CONF * 100)}% is the interval`
      : "Its bootstrap distribution — run the study first"
  );

  if (subject) {
    // The interval as a band, so the cut is an area of the distribution rather
    // than two unexplained ticks.
    distPlot.band(subject.lo, subject.hi, {
      fill: subject.covers ? colors.empirical : colors.extreme,
      opacity: 0.14,
    });
    distPlot.bars(counts, { lo: state.domain[0], width: state.width, fill: colors.empirical, opacity: 0.85 });

    for (const edge of [subject.lo, subject.hi]) {
      distPlot.vline(edge, { stroke: subject.covers ? colors.empirical : colors.extreme, width: 2 });
    }
  }

  // The truth, last, so nothing is drawn over it.
  distPlot.vline(state.trueDiff, { stroke: colors.reference, label: "true difference", width: 2 });
}

/* --- view 2: all studies, as a ladder ----------------------------------- */

function drawLadder({ ctx, colors, w, h, params, state, shown, inFlight, anim }) {
  const padL = 54;
  const padR = 16;
  const top = 24;
  const botPad = 34;

  const total = state.studies.length;
  const plot = makePlot({
    ctx, colors,
    rect: { x: padL, y: top, w: w - padL - padR, h: h - top - botPad },
    xDomain: state.domain,
    yDomain: [total + 0.5, 0.5], // inverted: study 1 at the top, so it reads as a list
  });

  plot.axisX({
    ticks: niceTicks(state.domain[0], state.domain[1], 6),
    label: "difference in means (B − A)",
  });
  plot.caption(
    shown
      ? `${shown} studies — each line is one interval, red ones miss`
      : `Every study you run adds one interval — none yet`
  );

  const rowH = plot.h / Math.max(total, 1);
  const dotR = Math.max(1.2, Math.min(3, rowH * 0.3));
  const lineW = Math.max(1, Math.min(2.5, rowH * 0.34));

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < shown; i += 1) {
    const st = state.studies[i];
    const y = plot.sy(i + 1);
    const ink = st.covers ? colors.empirical : colors.extreme;

    ctx.strokeStyle = ink;
    ctx.globalAlpha = st.covers ? 0.55 : 1;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(plot.sx(st.lo), y);
    ctx.lineTo(plot.sx(st.hi), y);
    ctx.stroke();

    // The point estimate, so a student can see the interval is built around it
    // and that a miss is not always a wild estimate.
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(plot.sx(st.obs), y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* The truth spans every row, drawn last. It is the only thing on this figure
     that does not move — the intervals scatter around it, never the reverse,
     which is the asymmetry the misconception gets backwards. */
  plot.vline(state.trueDiff, { stroke: colors.reference, label: "true difference", width: 2 });
}
