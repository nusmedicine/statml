/* ============================================================================
   Confidence intervals — widget 4 of the statistics arc.

     increments → means → one sample → AN INTERVAL → a null by shuffling → many nulls

   ONE GROUP, and it is the same statistic widget 3 bootstrapped: a mean. Widget 3
   builds the distribution an interval is cut from, so the only new idea here is
   the cut. An earlier draft made this a two-group difference, per HANDOVER §2,
   which also recorded the cost — "a student meets a new statistic AND a new
   concept together" — and named the fix if it bit. It bit: teaching t against z
   on a difference drags in Welch versus pooled degrees of freedom, which is noise
   beside the point. The difference now arrives in widget 5, which needs two
   groups anyway. Each step of the arc changes one thing.

   TWO MISCONCEPTIONS, and the second is why three methods are here.

   1. That there is a 95% chance the truth lies in THIS interval. A realised
      interval either contains it or does not; the 95% describes the PROCEDURE
      across many studies. Greenland et al. 2016 record it persisting among
      researchers, not only students.

   2. That the normal multiplier is fine for a mean at any n, because the CLT
      says means go normal. It is not, and t is the price of having estimated σ
      from the same small sample.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - ONE VERB, THREE READINGS. Every press runs one study. `method` and `view`
     are BOTH display parameters, so all three intervals are computed for every
     study and switching only changes which is drawn. Flip z → t and the SAME
     hundred studies are re-cut by a different rule: coverage moves, particular
     rows turn red, the truth does not move, and nothing was re-randomised. There
     is no "maybe it was a different sample" escape hatch, which is exactly what
     makes the comparison an argument rather than an anecdote.

   - THE LOWER PANEL IS ALWAYS "THE DISTRIBUTION THE INTERVAL IS CUT FROM", and
     the three methods differ only in where that distribution came from: resampled
     from your data, or assumed to be normal, or assumed to be t. That single
     parallel IS the bridge from resampling to analytical — the formula is not a
     new idea, it is a shape you assumed instead of one you built. At a normal
     population and moderate n the bootstrap and t pictures nearly coincide, which
     is the reason the shortcut is worth learning.

   - t IS DRAWN OVER z, NOT DESCRIBED. With method = t the normal curve stays on
     screen, recessive, so the fatter tails are visible as the reason the interval
     is wider. Coverage is the consequence; the tails are the mechanism, and a
     student shown only the consequence files t as an arbitrary table lookup.

   - THE POPULATION CONTROL CARRIES A SECOND LESSON FOR FREE. Two things break a
     z interval at small n: σ was estimated (t prices this exactly), and the
     sampling distribution is not normal yet (t does nothing for this). Normal at
     n = 5: z ≈ 88%, t ≈ 95%. Exponential at n = 5: NEITHER reaches 95%. That
     inoculates against the misconception this very lesson would otherwise
     create — that t makes small samples safe.

   - THE WINDOW IS CENTRED ON THE TRUTH, NEVER ON THE ESTIMATE. Widget 3 earned
     this: centring on the estimate puts the interval in the middle every time and
     hides the one thing the method cannot do.

   - THE READOUT PAIRS NOMINAL WITH REALISED and shows the partial count, so 95%
     is watched arriving rather than asserted. Early on it is visibly noisy, which
     is itself the point that the guarantee is about the long run.

   PERCENTILES COME FROM A SORTED ARRAY THIS WIDGET KEEPS, as decided.
   `createPile` holds binned counts and running sums, not values, so a quantile
   off it is interpolated within a bin — and an interval read off an approximation
   is a bad thing to teach percentiles with.

   PLOTTED IN DENSITY, NOT COUNTS, which is a deliberate exception to the rule in
   the skill. That rule was earned by the ACCUMULATING pile in widgets 1, 2 and 5,
   where a per-frame rescale hides the convergence that is the point. Nothing
   accumulates in this panel: it is one study's distribution, fully revealed, and
   density is the only axis on which a resampled histogram and an assumed curve
   can be compared at all.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, fmt,
  normalPdf, studentTPdf, tCritical, Z_CRITICAL_95,
  makePlot, niceTicks,
  binsFor,
} from "../core/index.js";

const CONF = 0.95;
const TAIL = (1 - CONF) / 2;

const METHODS = {
  boot: {
    label: "Bootstrap",
    detail: "percentiles of resampled means — assumes nothing about the shape",
  },
  z: {
    label: "Normal (z)",
    detail: "x̄ ± 1.96·s/√n — treats the estimated s as if it were σ",
  },
  t: {
    label: "t",
    detail: "x̄ ± t·s/√n — pays for having estimated σ from the same data",
  },
};

const VIEWS = { one: { label: "This study" }, all: { label: "All studies" } };

const SPEEDS = {
  slow: { label: "Slow", detail: "every study shown", ms: 1400 },
  medium: { label: "Medium", detail: "every study shown", ms: 600 },
  fast: { label: "Fast", detail: "intervals only", ms: 80 },
};

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const distOptions = ["normal", "exponential", "bimodal", "uniform", "pareto", "counts", "proportion"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** Sample mean and the n−1 sample SD, in one place so the two never disagree. */
function summarise(x) {
  const n = x.length;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += x[i];
  const m = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += (x[i] - m) * (x[i] - m);
  return { mean: m, sd: Math.sqrt(ss / Math.max(1, n - 1)) };
}

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
    "Every study gives one interval, and that one either contains the true mean " +
    "or it does not. The 95% is not about your interval — it is how often the " +
    "procedure that made it succeeds. Build the intervals three ways and watch " +
    "how often each actually works.",
  height: 560,

  params: {
    dist: { type: "select", label: "Population", options: distOptions, default: "normal" },

    /* Down to 3, because the whole t lesson lives at small n and is invisible
       above about 30. The default is 5: z undercovers by about seven points
       there, which is large enough to see in a hundred studies. */
    n: { type: "int", label: "Sample size n", min: 3, max: 40, default: 5 },

    /* THE CONTROL THIS WIDGET IS REALLY ABOUT, and it is a DISPLAY parameter.
       All three intervals are computed for every study, so switching re-cuts the
       same studies rather than running new ones. Same data, same truth, different
       rule, different hit rate — with nothing re-randomised to blame it on. */
    method: {
      type: "segmented",
      label: "Interval from",
      options: Object.entries(METHODS).map(([value, m]) => ({ value, label: m.label, detail: m.detail })),
      default: "boot",
      display: true,
    },

    reps: { type: "int", label: "Resamples per study", min: 50, max: 1000, step: 50, default: 400 },

    // The first k studies are the same k studies, so raising this keeps the work.
    studies: { type: "int", label: "Studies to run", min: 1, max: 200, step: 1, default: 100, display: true },

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
    { token: "empirical", label: "Interval that contains the true mean", mark: "line" },
    { token: "extreme", label: "Interval that misses it", mark: "line" },
    { token: "theory", label: "The distribution it was cut from", mark: "line" },
    { token: "reference", label: "The true mean", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const pop = POPULATIONS[params.dist];
    const mu = pop.mean;
    const df = params.n - 1;
    const tCrit = tCritical(df, CONF);
    const se = (s) => s / Math.sqrt(params.n);

    const studies = [];
    for (let k = 0; k < params.studies; k += 1) {
      const x = Array.from({ length: params.n }, () => pop.sample(rng));
      const { mean: xbar, sd: s } = summarise(x);

      // Bootstrap: resample the sample with replacement, recompute the mean.
      const means = new Array(params.reps);
      for (let r = 0; r < params.reps; r += 1) {
        const idx = rng.resample(params.n);
        let sum = 0;
        for (let i = 0; i < params.n; i += 1) sum += x[idx[i]];
        means[r] = sum / params.n;
      }
      const sorted = [...means].sort((p, q) => p - q);

      const half = { z: Z_CRITICAL_95 * se(s), t: tCrit * se(s) };
      const iv = {
        boot: [quantile(sorted, TAIL), quantile(sorted, 1 - TAIL)],
        z: [xbar - half.z, xbar + half.z],
        t: [xbar - half.t, xbar + half.t],
      };

      studies.push({
        x, xbar, s, means,
        iv,
        covers: {
          boot: iv.boot[0] <= mu && mu <= iv.boot[1],
          z: iv.z[0] <= mu && mu <= iv.z[1],
          t: iv.t[0] <= mu && mu <= iv.t[1],
        },
      });
    }

    /* ONE window for every study, every method and both views, centred on the
       TRUTH. Sized to the widest method so switching method never rescales the
       axis — if it did, a narrower z interval would look the same size as a t
       one and the mechanism would be invisible. */
    let reach = 0;
    for (const st of studies) {
      for (const key of ["boot", "z", "t"]) {
        reach = Math.max(reach, Math.abs(st.iv[key][0] - mu), Math.abs(st.iv[key][1] - mu));
      }
    }
    reach = reach > 0 ? reach * 1.1 : pop.sd;
    const domain = [mu - reach, mu + reach];

    const bins = binsFor(params.reps);
    const width = (domain[1] - domain[0]) / bins;

    return { pop, mu, df, tCrit, studies, domain, bins, width };
  },

  animation: {
    stepLabel: "Run a study",
    runLabel: "Play",

    init: ({ params, state, fromScratch }) => ({
      done: fromScratch ? 0 : Math.min(params.shown, state.studies.length),
      t: 0,
      running: false,
    }),

    advance: (anim, { dt, params, state }) => {
      if (anim.done >= state.studies.length) return false;
      anim.t += dt / SPEEDS[params.speed].ms;
      if (anim.t < 1) {
        anim.running = true;
        return true;
      }
      anim.t = 0;
      anim.done += 1;
      anim.running = false;
      return anim.done < state.studies.length && anim.mode === "run";
    },

    /* Nothing derived lives in `anim` — a count and a clock, both of which
       survive a method, view or binning change untouched. Declared rather than
       omitted so that is a statement instead of an oversight. */
    rebuild: (anim, { state }) => {
      anim.done = Math.min(anim.done, state.studies.length);
    },
  },

  draw: (args) => (args.params.view === "all" ? drawLadder(args) : drawOne(args)),

  readout: ({ params, state, anim }) => {
    const shown = anim ? anim.done : 0;
    const m = params.method;
    const done = state.studies.slice(0, shown);
    const hits = done.filter((s) => s.covers[m]).length;
    const current = shown > 0 ? done[done.length - 1] : null;

    const meanWidth = done.length
      ? done.reduce((acc, s) => acc + (s.iv[m][1] - s.iv[m][0]), 0) / done.length
      : null;

    const multiplier =
      m === "z" ? `× ${fmt(Z_CRITICAL_95, 2)} on s/√n`
      : m === "t" ? `× ${fmt(state.tCrit, 2)} on s/√n, ${state.df} df`
      : "percentiles — no multiplier";

    return [
      {
        label: "This interval",
        value: current ? `${fmt(current.iv[m][0], 2)} to ${fmt(current.iv[m][1], 2)}` : "—",
        note: current ? (current.covers[m] ? "contains the true mean" : "MISSES the true mean") : "run a study",
      },
      {
        /* Width is the MECHANISM and coverage is the consequence. Shown together
           because a student given only the coverage files t as a table lookup. */
        label: "Typical width",
        value: meanWidth === null ? "—" : fmt(meanWidth, 2),
        note: multiplier,
      },
      { label: "Nominal", value: "95%", note: "what the procedure promises" },
      {
        label: "Realised so far",
        value: shown ? `${fmt((100 * hits) / shown, 1)}%` : "—",
        note: shown ? `${hits} of ${shown} contained it` : "no studies yet",
      },
    ];
  },

  summary: ({ params, state, anim }) => {
    const shown = anim ? anim.done : 0;
    if (!shown) return "No studies run yet. The figure is empty.";
    const done = state.studies.slice(0, shown);
    const hits = done.filter((s) => s.covers[params.method]).length;
    return (
      `${shown} studies, intervals built by ${METHODS[params.method].label}. ` +
      `${hits} contain the true mean of ${fmt(state.mu, 2)} and ${shown - hits} miss it.`
    );
  },
});

/* --- view 1: this study, and the distribution its interval is cut from --- */

function drawOne({ ctx, colors, w, h, params, state, anim }) {
  const shown = anim ? anim.done : 0;
  const live = anim && anim.running && shown < state.studies.length;
  const subject = live ? state.studies[shown] : shown > 0 ? state.studies[shown - 1] : null;

  const padL = 54;
  const padR = 16;
  // A caption draws ABOVE its rect and an axis label BELOW it: both insets are
  // carrying text, not whitespace.
  const topInset = 30;
  const topH = Math.round(h * 0.26);
  const gap = 66;

  const obsPlot = makePlot({
    ctx, colors,
    rect: { x: padL, y: topInset, w: w - padL - padR, h: topH },
    xDomain: state.pop.domain,
    yDomain: [0, 1],
  });
  obsPlot.axisX({ ticks: niceTicks(state.pop.domain[0], state.pop.domain[1], 6), label: "observation value" });
  obsPlot.caption(
    subject ? `Study ${live ? shown + 1 : shown} — one sample of ${params.n}` : "Your sample — nothing run yet"
  );

  if (subject) {
    const reveal = live ? clamp01(easeOut(anim.t * 2)) : 1;
    for (let i = 0; i < subject.x.length; i += 1) {
      if (i / subject.x.length > reveal) continue;
      obsPlot.dot(subject.x[i], 0.5, { fill: colors.groupA, r: 4 });
    }
    // Offset one row down, always — see vline's note on why not on proximity.
    obsPlot.vline(subject.xbar, {
      stroke: colors.empirical, label: "x̄ (your estimate)", width: 2,
      labelDy: parseFloat(colors.fsXs) + 3,
    });
  }
  obsPlot.vline(state.mu, { stroke: colors.reference, label: "true mean", width: 2, align: "right" });

  /* Lower panel: THE DISTRIBUTION THE INTERVAL IS CUT FROM. Which one depends
     entirely on the method, and that is the bridge — resampled from your data,
     or a shape you assumed. */
  const botY = topInset + topH + gap;
  const botH = h - botY - 34;
  const m = params.method;
  const se = subject ? subject.s / Math.sqrt(params.n) : 1;

  // Density, not counts — see the header for why the counts rule does not apply.
  const density = new Array(state.bins).fill(0);
  let peak = 1;
  if (subject && m === "boot") {
    const upTo = live ? Math.floor(subject.means.length * clamp01(anim.t)) : subject.means.length;
    for (let i = 0; i < upTo; i += 1) {
      const k = Math.floor((subject.means[i] - state.domain[0]) / state.width);
      if (k >= 0 && k < state.bins) density[k] += 1;
    }
    const denom = Math.max(1, upTo) * state.width;
    for (let k = 0; k < state.bins; k += 1) density[k] /= denom;
    peak = Math.max(1e-9, ...density);
  } else if (subject) {
    peak = (m === "t" ? studentTPdf(0, state.df) : normalPdf(0, 0, 1)) / se;
  }

  const distPlot = makePlot({
    ctx, colors,
    rect: { x: padL, y: botY, w: w - padL - padR, h: botH },
    xDomain: state.domain,
    yDomain: [0, peak * 1.2],
  });
  distPlot.grid(niceTicks(0, peak * 1.2, 4));
  distPlot.axisY({ ticks: niceTicks(0, peak * 1.2, 4), label: "density" });
  distPlot.axisX({ ticks: niceTicks(state.domain[0], state.domain[1], 6), label: "sample mean" });
  distPlot.caption(
    subject
      ? m === "boot"
        ? "Resampling your one sample — the middle 95% IS the interval"
        : `Assumed shape for x̄ — ${METHODS[m].label}, centred on x̄, width s/√n`
      : "The distribution the interval is cut from — run a study first"
  );

  if (subject) {
    const [lo, hi] = subject.iv[m];
    const ok = subject.covers[m];
    distPlot.band(lo, hi, { fill: ok ? colors.empirical : colors.extreme, opacity: 0.14 });

    if (m === "boot") {
      distPlot.bars(density, { lo: state.domain[0], width: state.width, fill: colors.empirical, opacity: 0.85 });
    } else {
      const pts = (fn) => {
        const out = [];
        for (let i = 0; i <= 240; i += 1) {
          const xv = state.domain[0] + ((state.domain[1] - state.domain[0]) * i) / 240;
          out.push([xv, fn((xv - subject.xbar) / se) / se]);
        }
        return out;
      };
      /* With t selected, the normal stays on screen recessive. The fatter tails
         are the MECHANISM behind the wider interval, and describing them in a
         caption is not the same as letting a student see them. */
      if (m === "t") {
        distPlot.curve(pts((u) => normalPdf(u, 0, 1)), { stroke: colors.theory, width: 1.5, opacity: 0.3, dash: [4, 3] });
      }
      distPlot.curve(pts(m === "t" ? (u) => studentTPdf(u, state.df) : (u) => normalPdf(u, 0, 1)), {
        stroke: colors.theory, width: 2,
      });
    }

    for (const edge of [lo, hi]) {
      distPlot.vline(edge, { stroke: ok ? colors.empirical : colors.extreme, width: 2 });
    }
  }

  distPlot.vline(state.mu, { stroke: colors.reference, label: "true mean", width: 2, align: "right" });
}

/* --- view 2: every study, as a ladder ----------------------------------- */

function drawLadder({ ctx, colors, w, h, params, state, anim }) {
  const shown = anim ? anim.done : 0;
  const m = params.method;

  const padL = 54;
  const padR = 16;
  const top = 24;
  const total = state.studies.length;

  const plot = makePlot({
    ctx, colors,
    rect: { x: padL, y: top, w: w - padL - padR, h: h - top - 34 },
    xDomain: state.domain,
    yDomain: [total + 0.5, 0.5], // inverted, so study 1 is at the top and it reads as a list
  });
  plot.axisX({ ticks: niceTicks(state.domain[0], state.domain[1], 6), label: "sample mean" });
  plot.caption(
    shown
      ? `${shown} studies, ${METHODS[m].label} intervals — red ones miss`
      : "Every study adds one interval — none yet"
  );

  const rowH = plot.h / Math.max(total, 1);
  const dotR = Math.max(1.2, Math.min(3, rowH * 0.3));
  const lineW = Math.max(1, Math.min(2.5, rowH * 0.34));

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < shown; i += 1) {
    const st = state.studies[i];
    const [lo, hi] = st.iv[m];
    const ok = st.covers[m];
    const y = plot.sy(i + 1);
    const ink = ok ? colors.empirical : colors.extreme;

    ctx.strokeStyle = ink;
    ctx.globalAlpha = ok ? 0.55 : 1;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(plot.sx(lo), y);
    ctx.lineTo(plot.sx(hi), y);
    ctx.stroke();

    // The estimate itself, so a miss is visibly not always a wild x̄.
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(plot.sx(st.xbar), y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* The truth spans every row and is drawn last. It is the only thing here that
     does not move: the intervals scatter around it, never the reverse, which is
     the asymmetry the misconception gets backwards. */
  plot.vline(state.mu, { stroke: colors.reference, label: "true mean", width: 2 });
}
