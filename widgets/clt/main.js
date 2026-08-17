/* ============================================================================
   Central Limit Theorem — the reference widget.

   It exists to prove the scaffold, so it deliberately exercises every part of
   it: all four parameter types, a shared-axis two-panel figure, two overlays,
   discrete and continuous populations, a multi-phase animation, stat tiles, and
   a table view.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - It starts EMPTY. There is no finished histogram to spoil the answer; the
     student builds it. A finished figure is still publishable, but only by
     asking for one explicitly through the `shown` parameter, which keeps it in
     the URL and therefore shareable.

   - The animation shows the *mechanism*, not just the result. One sample is
     drawn as n individual observations, those observations visibly collapse to
     their mean, and that single number falls into its slot in the panel below.
     The step students miss when shown a finished histogram is that every bar is
     a pile of averages, each one summarising n observations that no longer
     appear anywhere on screen.

   - "Draw one" is the important affordance, not "Play". An instructor clicks it
     four or five times while talking, and the mechanism lands before any
     aggregate appears. Play then runs continuously to the end, slow at first and
     accelerating as the individual samples stop being the point.

   - The lower panel shows a countable thing while the count is small: one dot
     per sample mean, crossfading to bars once dots stop being countable. A
     single arrival must never be a two-pixel bar.

   - The smoothed density of the means so far is overlaid as it accumulates, so
     the shape argument is something students watch happen rather than something
     they are shown at the end. Both it and the normal curve fade in once there
     are enough means to justify a claim about shape — a smooth density over six
     dots would be a lie told with a spline.

   - Two panels share one x-axis in "Population scale" view, so the means
     visibly concentrate inside the population's spread. Concentration is the
     lesson students miss when the sampling distribution is auto-scaled.

   - Heavy-tailed is included precisely because convergence is visibly slow. A
     demo where every population snaps to normal at n = 5 teaches the wrong
     lesson.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, mean, sd, histogram, normalPdf, fmt,
  makePlot, samplePdf, niceTicks, spanningRule,
} from "../core/index.js";

/* Bins scale with the number of samples: 40 fixed bins scatters twenty dots
   across forty columns during the dot phase, and makes the finished histogram
   ragged enough to undercut the shape claim. Derived from `reps` rather than
   from the running count, so the binning never changes mid-animation. */
const binsFor = (reps) => Math.max(12, Math.min(44, Math.round(1.4 * Math.sqrt(reps))));

/* The lower panel plots COUNTS, and changes representation with the count:
   a dot plot while individual means are still countable, a histogram once they
   are not. DOT_CEIL is the count-axis ceiling held during the dot phase, chosen
   so stacked dots very nearly touch — which is what makes a single arrival
   visible instead of two pixels tall.

   This is why the axis is counts rather than density: a density axis fixed to
   the finished picture makes the first arrivals invisible, and one rescaled per
   frame hides the convergence that is the entire point. */
const DOT_FROM = 30;
const DOT_TO = 50;
const DOT_CEIL = 14;
const DOT_R = 6; // paired with DOT_CEIL: ceiling x 2r ~ panel height, so stacks touch

/* The smoothed density earns its place much earlier than the normal curve.
   Watching it wobble and settle IS the lesson, so it has to be visible while a
   student is still clicking "Draw one" one sample at a time — that it is
   obviously unstable at six means is instructive, not a defect. The normal
   overlay is a claim about shape and waits until there is something to claim
   about. */
const SMOOTH_FROM = 4;
const SMOOTH_TO = 10;

/* Pacing is CHOSEN, not automatic.

   An animation that speeds up on its own takes the pacing decision away from
   the person who knows how fast the room is following — which is the segmenting
   principle's whole complaint about continuous presentation. So Play runs at a
   speed the user sets and keeps going until it reaches the sample count.

   Past a certain speed there is nothing left to see in the per-sample steps, so
   the choreography switches off and the arrivals alone are shown. That is a
   property of the chosen speed, declared here, rather than something the
   animation decides about itself mid-run. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every step shown", ms: 1400, choreo: true },
  medium: { label: "Medium", detail: "every step shown", ms: 550, choreo: true },
  fast: { label: "Fast", detail: "samples only, no steps", ms: 110, choreo: false },
  fastest: { label: "Fastest", detail: "fills in at once", ms: 0, choreo: false },
};

// "Draw one" always runs the full choreography at this speed, whatever Play is
// set to. Its entire job is to show the mechanism; a fast single step is useless.
const STEP_MS = 1400;

// The "fastest" tier streams the remainder over this long — slow enough that the
// density visibly settles rather than snapping to its answer.
const STREAM_MS = 3200;

const PHASE_FRAC = { draw: 0.42, collapse: 0.27, drop: 0.31 };
const FLASH_MS = 420;

// Per-sample observations retained for the reveal. Beyond this the animation is
// too fast for individual points to read anyway, and keeping reps x n doubles
// for reps = 2000, n = 100 would mean a 1.6 MB allocation on every slider tick.
const KEEP_SAMPLES = 72;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const mix = (v, from, to) => clamp01((v - from) / (to - from));

function binOf(v, hist) {
  if (v < hist.lo || v > hist.hi) return -1;
  const n = hist.counts.length;
  const i = Math.min(n - 1, Math.floor((v - hist.lo) / hist.width));
  return i >= 0 ? i : -1;
}

// Fine enough that a peak of 50 gives a ceiling of 60 rather than 100 — a
// coarse 1/2/5 ladder wastes half the panel at the worst moment.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeil(v) {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  for (const s of NICE_STEPS) if (n <= s + 1e-9) return s * mag;
  return 10 * mag;
}

/**
 * The count-axis ceiling. Held at DOT_CEIL through the dot phase so the axis
 * does not move while individual means are arriving, then ratcheted upward in
 * nice steps — never downward, so it cannot jitter frame to frame.
 */
function requiredYMax(total, maxCount, state, params) {
  const barMix = mix(total, DOT_FROM, DOT_TO);
  const peak = params.theory
    ? total * state.hist.width * normalPdf(state.pop.mean, state.pop.mean, state.se) * barMix
    : 0;
  return Math.max(barMix < 1 ? DOT_CEIL : 1, niceCeil(Math.max(maxCount, peak) * 1.12));
}

/**
 * Stop advancing. The landing flash is a cue for motion, so it is cleared here:
 * once the animation halts no further frames arrive to fade it, and a frozen
 * half-faded highlight reads as a marked bar rather than a recent arrival.
 */
function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  anim.flashBin = -1;
  anim.flashAge = FLASH_MS;
  return false;
}

/** Sample standard deviation of the means committed so far. */
function runningSd(anim) {
  if (anim.shown < 2) return NaN;
  const v = Math.max(0, (anim.sumsq - (anim.sum * anim.sum) / anim.shown) / (anim.shown - 1));
  return Math.sqrt(v);
}

/**
 * Gaussian kernel density of the means so far, in the same expected-count units
 * as the bars and the normal overlay.
 *
 * Built by convolving the BINNED counts rather than the raw means, so the cost
 * is bins x grid (~10k) instead of samples x grid (~600k) and it stays cheap at
 * sixty frames a second. The bandwidth follows Silverman, floored at three
 * quarters of a bin so it cannot go spiky enough to imply structure that the
 * binning has already smoothed away.
 */
function kdeCurve(anim, state) {
  const { hist, domain } = state;
  const sdHat = runningSd(anim);
  const h = Math.max(
    0.75 * hist.width,
    0.9 * (sdHat || hist.width) * Math.pow(Math.max(anim.shown, 1), -0.2)
  );

  const pts = [];
  const steps = 200;
  for (let g = 0; g <= steps; g += 1) {
    const x = domain[0] + ((domain[1] - domain[0]) * g) / steps;
    let f = 0;
    for (let i = 0; i < anim.counts.length; i += 1) {
      const c = anim.counts[i];
      if (!c) continue;
      f += c * normalPdf(x, hist.lo + (i + 0.5) * hist.width, h);
    }
    pts.push([x, f * hist.width]);
  }
  return pts;
}

const distOptions = ["exponential", "bimodal", "uniform", "pareto", "bernoulli", "normal"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

defineWidget({
  slug: "clt",
  title: "Central Limit Theorem",
  subtitle:
    "Each sample of size n has a mean. Collect enough of those means and they " +
    "pile up into a normal distribution with standard deviation σ/√n — whatever " +
    "shape the population has.",
  height: 430,

  /* Parameter order is the reading order of the setup block, so it runs from
     "what am I sampling from" to "how do I want to look at it". Data parameters
     first, then presentation.

     `display: true` marks a parameter that changes only how the state is drawn.
     Those keep the student's work; the others start over, because they make the
     samples genuinely different samples. */
  params: {
    dist: { type: "select", label: "Population", options: distOptions, default: "exponential" },
    n: { type: "int", label: "Sample size n", min: 1, max: 100, default: 5 },
    reps: {
      type: "int", label: "Samples to draw", min: 1, max: 2000, step: 1, default: 400,
      // Extending the plan does not invalidate what is already drawn: the first
      // k means are the same k means whatever the target is.
      display: true,
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    // A slider, because speed is a magnitude and left-to-right means something.
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({
        value, label: s.label, detail: s.detail,
      })),
      default: "medium",
      display: true,
    },
    // Segmented, because these are two alternative readings rather than more or
    // less of one thing — and both should be visible without opening anything.
    view: {
      type: "segmented",
      label: "Lower panel scale",
      options: [
        { value: "fixed", label: "Population", detail: "shared axis with the panel above" },
        { value: "zoom", label: "Zoom on μ", detail: "μ ± 4 SE" },
      ],
      default: "fixed",
      display: true,
    },
    smooth: { type: "bool", label: "Smoothed density", default: true, display: true },
    theory: { type: "bool", label: "Normal σ/√n", default: true, display: true },

    // Authoring escape hatch, deliberately not a visible control. The figure is
    // spoiler-free by default; a chapter or notebook that genuinely wants a
    // finished histogram asks for one with ?shown=400, which stays in the URL
    // and therefore stays shareable.
    shown: { type: "int", label: "Pre-filled samples", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "Sample means collected", mark: "bar" },
    { token: "smoothed", label: "Smoothed density of those means", mark: "line" },
    { token: "theory", label: "Normal(μ, σ/√n), expected count", mark: "line" },
    { token: "highlight", label: "One sample of n observations", mark: "dot" },
  ],

  /* --- data ------------------------------------------------------------- *
   * Every sample mean is computed up front. The animation is a progressive
   * reveal of this array, which is why Play always lands exactly on the same
   * picture the seed promises rather than somewhere near it.                */

  compute({ params, rng }) {
    const pop = POPULATIONS[params.dist];
    const means = new Array(params.reps);
    const samples = [];

    for (let r = 0; r < params.reps; r += 1) {
      let total = 0;
      const keep = r < KEEP_SAMPLES ? new Array(params.n) : null;
      for (let i = 0; i < params.n; i += 1) {
        const x = pop.sample(rng);
        if (keep) keep[i] = x;
        total += x;
      }
      means[r] = total / params.n;
      if (keep) samples.push(keep);
    }

    const se = pop.sd / Math.sqrt(params.n);
    const domain =
      params.view === "zoom" ? [pop.mean - 4 * se, pop.mean + 4 * se] : pop.domain;

    const bins = binsFor(params.reps);

    return {
      pop, means, samples, se, domain, bins,
      hist: histogram(means, domain, bins),
      observedSd: sd(means),
      observedMean: mean(means),
    };
  },

  /* --- animation -------------------------------------------------------- *
   * One logical unit is one sample: draw n observations, collapse them to their
   * mean, drop that mean into its slot. "Draw one" performs exactly one; Play
   * performs them all, accelerating, then streams the tail.                 */

  animation: {
    init({ params, state, fromScratch }) {
      const anim = {
        shown: 0,          // samples folded into the picture
        counts: new Array(state.bins).fill(0),
        maxCount: 0,
        yMax: DOT_CEIL,    // ratcheted upward only, so the axis never jitters
        sum: 0,
        sumsq: 0,
        phase: "draw",     // 'draw' | 'collapse' | 'drop'
        phaseT: 0,         // 0..1 within the current phase; 0 means idle
        streamFrom: -1,
        streamT: 0,
        sinceCommit: 0,
        flashBin: -1,
        flashAge: FLASH_MS,
        done: false,
      };

      // Authored starting state, e.g. ?shown=400 for a finished figure. Skipped
      // on Replay: someone pressing it wants to watch the thing get built.
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.reps);
      for (let i = 0; i < pre; i += 1) commit(anim, state, params);
      if (anim.shown >= params.reps) anim.done = true;

      // Nothing just landed, so don't open on a stale landing flash.
      anim.flashBin = -1;
      anim.flashAge = FLASH_MS;

      return anim;
    },

    /**
     * Re-derive everything binning-dependent from the one thing that is really
     * invariant: how many samples the student has drawn. Called when a display
     * parameter changes the shape of the picture without changing the data, so
     * that rescaling an axis or extending the plan keeps their work.
     */
    rebuild(anim, { params, state }) {
      const drawn = Math.min(anim.shown, params.reps);
      anim.counts = new Array(state.bins).fill(0);
      anim.maxCount = 0;
      anim.yMax = DOT_CEIL;
      anim.sum = 0;
      anim.sumsq = 0;
      anim.shown = 0;
      for (let i = 0; i < drawn; i += 1) commit(anim, state, params);
      anim.flashBin = -1;
      anim.flashAge = FLASH_MS;
      anim.done = anim.shown >= params.reps;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.flashAge += dt;

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const hasDetail = anim.shown < state.samples.length;
      // "Draw one" always choreographs. Play choreographs only at the speeds
      // where there is something left to see in it.
      const choreo = hasDetail && (stepping || speed.choreo);

      if (choreo) {
        const budget = (stepping ? STEP_MS : speed.ms) * PHASE_FRAC[anim.phase];
        anim.phaseT += dt / Math.max(1, budget);
        if (anim.phaseT < 1) return true;

        if (anim.phase === "draw") {
          anim.phase = "collapse";
          anim.phaseT = 0.001; // stay non-zero: phaseT === 0 means idle
          return true;
        }
        if (anim.phase === "collapse") {
          anim.phase = "drop";
          anim.phaseT = 0.001;
          return true;
        }

        // The drop landed: fold this sample in and go idle.
        commit(anim, state, params);
        anim.phase = "draw";
        anim.phaseT = 0;
        if (anim.shown >= params.reps) return halt(anim, { finished: true });
        if (stepping) return halt(anim); // one sample per click
        return true;
      }

      /* Uncoreographed arrivals. Samples still land one at a time and each one
         still flashes its slot — the student sees the samples being taken, just
         not the arithmetic behind each one. */
      if (speed.ms > 0) {
        anim.sinceCommit = (anim.sinceCommit ?? 0) + dt;
        while (anim.sinceCommit >= speed.ms && anim.shown < params.reps) {
          anim.sinceCommit -= speed.ms;
          commit(anim, state, params);
        }
      } else {
        // "Fastest": fill the remainder over a fixed span rather than per-sample,
        // so the wait does not scale with the sample count.
        if (anim.streamFrom < 0) anim.streamFrom = anim.shown;
        anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
        const target = Math.min(
          params.reps,
          anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.reps - anim.streamFrom))
        );
        while (anim.shown < target) commit(anim, state, params);
      }

      if (anim.shown >= params.reps) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { pop, domain, hist, se } = state;
    const total = anim.shown;
    const inFlight = anim.phaseT > 0 && anim.shown < params.reps;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    const top = { x: ML, y: 26, w: plotW, h: 84 };
    const lowerY = top.y + top.h + 66;
    const bottom = { x: ML, y: lowerY, w: plotW, h: Math.max(90, h - lowerY - 40) };

    /* -- upper panel: the population ------------------------------------ */
    const popYMax = pop.masses
      ? Math.max(...pop.masses.map((m) => m[1])) * 1.35
      : Math.max(...samplePdf(pop.pdf, pop.domain, 200).map((p) => p[1])) * 1.18;

    const pa = makePlot({ ctx, colors, rect: top, xDomain: pop.domain, yDomain: [0, popYMax] });

    /* -- one μ rule for the whole figure -------------------------------- *
     * Both plotting windows are centred on μ by construction (populations
     * declare a half-width, not a domain), so μ occupies the same pixel column
     * in both panels and a single rule can carry it. Drawn first, so marks and
     * captions sit over it.                                                  */
    spanningRule(ctx, colors, {
      x: pa.sx(pop.mean),
      y0: top.y,
      y1: bottom.y + bottom.h,
      label: "μ",
    });

    pa.caption(
      inFlight
        ? `Population — ${pop.label} · drawing sample ${total + 1}, n = ${params.n}`
        : `Population — ${pop.label}`
    );

    if (pop.masses) {
      pa.spikes(pop.masses, { fill: colors.ink3, opacity: 0.6, width: 16 });
    } else {
      const curve = samplePdf(pop.pdf, pop.domain, 300);
      pa.area(curve, { fill: colors.ink3, opacity: 0.14 });
      pa.curve(curve, { stroke: colors.ink3, width: 2 });
    }

    // In zoom view the lower panel magnifies a window around μ. Marking that
    // window here turns a bare scale change into a statement, and the band
    // visibly narrows as n grows, which is σ/√n shown twice over.
    if (params.view === "zoom") {
      pa.band(pop.mean - 4 * se, pop.mean + 4 * se, {
        fill: colors.empirical,
        opacity: 0.09,
        label: "shown below",
      });
    }

    pa.axisX({ label: pop.masses ? "outcome" : "x" });

    // Between steps, the sample just drawn stays on screen as a rug, so the
    // student can still see what produced the most recent dot.
    if (!inFlight && total > 0 && total - 1 < state.samples.length) {
      pa.rug(state.samples[total - 1], { stroke: colors.highlight, height: 10, opacity: 0.9 });
    }

    /* -- lower panel: the sampling distribution -------------------------- */
    const barMix = mix(total, DOT_FROM, DOT_TO);
    const smoothMix = mix(total, SMOOTH_FROM, SMOOTH_TO);
    const yMax = anim.yMax;

    const pb = makePlot({ ctx, colors, rect: bottom, xDomain: domain, yDomain: [0, yMax] });

    pb.caption(
      total === 0
        ? `Sampling distribution of the mean — nothing drawn yet`
        : anim.done
          ? `Sampling distribution of the mean — n = ${params.n}, ${total} sample${total === 1 ? "" : "s"}`
          : `Sampling distribution of the mean — ${total} of ${params.reps} samples`
    );

    const ticks = niceTicks(0, yMax, yMax <= 6 ? yMax : 4);
    pb.grid(ticks);

    if (barMix > 0) {
      pb.bars(anim.counts, { lo: hist.lo, width: hist.width, fill: colors.empirical, opacity: barMix });
    }
    if (barMix < 1) {
      pb.dotColumns(anim.counts, {
        lo: hist.lo, width: hist.width, fill: colors.empirical,
        opacity: 1 - barMix, maxR: DOT_R,
      });
    }

    // The slot that just received a mean flashes, so the eye follows the landing.
    if (anim.flashBin >= 0 && anim.flashAge < FLASH_MS) {
      const one = new Array(state.bins).fill(0);
      one[anim.flashBin] = anim.counts[anim.flashBin];
      const fade = 1 - anim.flashAge / FLASH_MS;
      if (barMix > 0) {
        pb.bars(one, { lo: hist.lo, width: hist.width, fill: colors.highlight, opacity: fade * barMix });
      }
      if (barMix < 1) {
        pb.dotColumns(one, {
          lo: hist.lo, width: hist.width, fill: colors.highlight,
          opacity: fade * (1 - barMix), maxR: DOT_R,
        });
      }
    }

    // The shape of what we have so far, updating as it accumulates.
    if (params.smooth && smoothMix > 0 && total > 1) {
      pb.curve(kdeCurve(anim, state), {
        stroke: colors.smoothed,
        width: 2,
        opacity: smoothMix,
      });
    }

    // The normal claim is a claim about many means, so it waits for many.
    if (params.theory && barMix > 0) {
      const scale = total * hist.width;
      pb.curve(samplePdf((x) => normalPdf(x, pop.mean, se) * scale, domain, 300), {
        stroke: colors.theory,
        width: 2,
        opacity: barMix,
      });
    }

    pb.axisY({ ticks, label: "count" });
    pb.axisX({
      label:
        params.view === "fixed"
          ? "sample mean  (same scale as the population above)"
          : "sample mean  (zoomed to μ ± 4 SE)",
    });

    /* -- the sample in flight, across both panels ------------------------ */
    if (inFlight) drawSampleInFlight({ ctx, colors, pa, pb, state, anim });
  },

  /* --- readout ---------------------------------------------------------- *
   * Ordered as two prediction/observation pairs reading left to right:
   *
   *   population μ, σ  ->  observed mean of the means   (should land on μ)
   *   predicted σ/√n   ->  observed SD of the means     (should land on it)
   *
   * Adjacency is the argument. Both observations track the partial data, so a
   * student watches them converge on their predictions as the picture fills in
   * rather than being shown the agreement as a finished fact.               */

  readout({ params, state, anim }) {
    const { pop, se } = state;
    const shown = anim.shown;
    const of = `of ${shown} mean${shown === 1 ? "" : "s"}`;

    return [
      { label: "Population μ, σ", value: `${fmt(pop.mean)}, ${fmt(pop.sd)}`, note: pop.label },
      { label: "Observed mean", value: fmt(shown ? anim.sum / shown : NaN, 3), note: of },
      { label: "Predicted SE", value: fmt(se, 3), note: `σ/√${params.n}` },
      { label: "Observed SD", value: fmt(runningSd(anim), 3), note: of },
    ];
  },
});

/* --- helpers ------------------------------------------------------------ */

function commit(anim, state, params) {
  const m = state.means[anim.shown];
  const bin = binOf(m, state.hist);
  if (bin >= 0) {
    anim.counts[bin] += 1;
    anim.maxCount = Math.max(anim.maxCount, anim.counts[bin]);
    anim.flashBin = bin;
    anim.flashAge = 0;
  }
  // Means outside the plotted window still count toward the statistics; they are
  // simply not drawn, exactly as the static histogram treats them.
  anim.sum += m;
  anim.sumsq += m * m;
  anim.shown += 1;
  anim.yMax = Math.max(anim.yMax, requiredYMax(anim.shown, anim.maxCount, state, params));
}

/**
 * The three-phase choreography, drawn in absolute canvas pixels because it
 * crosses from the population panel into the panel below.
 *
 *   draw     — n observations appear at their sampled positions, staggered
 *   collapse — they slide together to their mean, which is labelled x̄
 *   drop     — the single mean falls into the slot it is about to occupy
 */
function drawSampleInFlight({ ctx, colors, pa, pb, state, anim }) {
  const sample = state.samples[anim.shown];
  if (!sample) return;

  const m = state.means[anim.shown];
  const dotY = pa.bottom - 13;
  const t = clamp01(anim.phaseT);

  ctx.save();

  if (anim.phase === "draw") {
    // Stagger the appearance so a sample reads as n separate draws.
    for (let i = 0; i < sample.length; i += 1) {
      const at = sample.length > 1 ? (i / sample.length) * 0.85 : 0;
      const grow = clamp01((t - at) / 0.15);
      if (grow <= 0) continue;
      dot(ctx, colors, pa.sx(sample[i]), dotY, 4.5 * grow);
    }
  } else if (anim.phase === "collapse") {
    const e = easeOut(t);
    for (let i = 0; i < sample.length; i += 1) {
      dot(ctx, colors, pa.sx(sample[i]) + (pa.sx(m) - pa.sx(sample[i])) * e, dotY, 4.5);
    }
    if (e > 0.55) label(ctx, colors, `x̄ = ${fmt(m, 2)}`, pa.sx(m), dotY - 12, (e - 0.55) / 0.45);
  } else {
    const bin = binOf(m, state.hist);
    const geom = {
      x0: pa.sx(m),
      x1: pb.sx(m),
      y0: dotY,
      // A mean outside the plotted window still lands, it just lands on the floor.
      y1: bin >= 0 ? pb.sy(anim.counts[bin] + 0.5) : pb.bottom,
    };
    const at = dropPoint(t, geom);

    // Trail along the actual path, not a straight line to the marker.
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = 0; k <= 20; k += 1) {
      const [px, py] = dropPoint((t * k) / 20, geom);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The label has named the collapsed value by the time the fall starts, so it
    // clears out early rather than travelling down through the panel caption.
    label(ctx, colors, `x̄ = ${fmt(m, 2)}`, at[0], at[1] - 12, 1 - t / 0.3);
    dot(ctx, colors, at[0], at[1], 5);
  }

  ctx.restore();
}

/**
 * Split timing: the sideways move eases OUT over the first 60% while the fall
 * eases IN across the whole drop. The result arcs over and accelerates
 * downward, so it reads as falling into place rather than sliding.
 *
 * Sideways motion only exists in "Zoom to the mean", where the two panels have
 * different x-scales. In shared-axis view x0 === x1 and this degenerates to a
 * pure accelerating fall — which is exactly what a drop should be. Candidates
 * for this curve are mocked up side by side in widgets/_lab/drop-paths.html.
 */
function dropPoint(t, { x0, x1, y0, y1 }) {
  return [
    x0 + (x1 - x0) * easeOut(clamp01(t / 0.6)),
    y0 + (y1 - y0) * easeIn(clamp01(t)),
  ];
}

/** A highlight marker with a 2px surface ring so it stays legible on the curve. */
function dot(ctx, colors, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fillStyle = colors.highlight;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
}

function label(ctx, colors, text, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.fillStyle = colors.ink1;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  // A surface-coloured halo keeps the label readable over the density curve.
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}
