/* ============================================================================
   Central Limit Theorem — widget 2 of the statistics arc.

     increments → MEANS → one sample → an interval → a null by shuffling → many nulls

   Answers: what happens if I average? Means go normal with spread σ/√n, whatever
   the population looks like. Raises the question widget 3 exists to answer — this
   figure draws hundreds of samples from a population whose μ and σ are printed on
   screen, and nobody has ever been in that position.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - It starts EMPTY. There is no finished histogram to spoil the answer; the
     student builds it. A finished figure is publishable, but only by asking for
     one through `?shown=`, which keeps it in the URL and therefore shareable.

   - The animation shows the *mechanism*. One sample is drawn as n individual
     observations, those observations visibly collapse to their mean, and that
     single number falls into the pile below. The step students miss when shown a
     finished histogram is that every bar is a pile of averages, each summarising
     n observations that no longer appear anywhere on screen.

   - "Draw one" is the important affordance, not "Play". An instructor clicks it
     four or five times while talking, and the mechanism lands before any
     aggregate appears.

   - The pile itself — dots becoming bars, the ratcheted axis, the smoothed
     density, the landing flash — is `core/accumulator.js`, shared with every
     other widget in the arc. What lives here is the choreography and the theory
     overlay, which is the part that is genuinely about the CLT.

   - Two panels share one x-axis in "Population" view, so the means visibly
     concentrate inside the population's spread.

   - Heavy-tailed is included precisely because convergence is visibly slow. A
     demo where every population snaps to normal at n = 5 teaches the wrong lesson.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, histogram, normalPdf, fmt,
  makePlot, samplePdf, niceTicks, spanningRule,
  createPile, barMixFor, binsFor, DOT_R, FLASH_MS,
} from "../core/index.js";

/* Pacing is CHOSEN, not automatic. An animation that speeds up on its own takes
   the pacing decision away from the person who can see how fast the room is
   following. Past a certain speed there is nothing left to see in the per-sample
   steps, so the choreography switches off — but that is a declared property of
   the chosen speed, not something the animation decides mid-run. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every step shown", ms: 1400, choreo: true },
  medium: { label: "Medium", detail: "every step shown", ms: 550, choreo: true },
  fast: { label: "Fast", detail: "samples only, no steps", ms: 110, choreo: false },
  fastest: { label: "Fastest", detail: "fills in at once", ms: 0, choreo: false },
};

// "Draw one" always runs the full choreography at this speed, whatever Play is
// set to. Its entire job is to show the mechanism; a fast single step is useless.
const STEP_MS = 1400;
const STREAM_MS = 3200;
const PHASE_FRAC = { draw: 0.42, collapse: 0.27, drop: 0.31 };

// Per-sample observations retained for the reveal. Beyond this the animation is
// too fast for individual points to read anyway, and keeping reps x n doubles for
// reps = 2000, n = 100 would mean a 1.6 MB allocation on every slider tick.
const KEEP_SAMPLES = 72;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

const distOptions = ["exponential", "bimodal", "uniform", "pareto", "bernoulli", "normal"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** Expected count per bin at the peak of the normal claim, for axis headroom. */
function theoryPeak(total, state) {
  return total * state.hist.width * normalPdf(state.pop.mean, state.pop.mean, state.se);
}

function makeClPile(params, state) {
  return createPile({
    bins: state.bins,
    lo: state.hist.lo,
    width: state.hist.width,
    // Leave room for the normal overlay, but only once it is actually drawn.
    headroomFor: (total) =>
      params.theory ? theoryPeak(total, state) * barMixFor(total) : 0,
  });
}

defineWidget({
  slug: "clt",
  title: "Central Limit Theorem",
  subtitle:
    "Each sample of size n has a mean. Collect enough of those means and they " +
    "pile up into a normal distribution with standard deviation σ/√n — whatever " +
    "shape the population has.",
  height: 430,

  /* Parameter order is the reading order of the setup block: what am I sampling
     from, then how do I want to look at it.

     `display: true` marks a parameter that changes only how the state is drawn.
     Those keep the student's work; the others start over, because they make the
     samples genuinely different samples. */
  params: {
    dist: { type: "select", label: "Population", options: distOptions, default: "exponential" },
    n: { type: "int", label: "Sample size n", min: 1, max: 100, default: 5 },
    reps: {
      type: "int", label: "Samples to draw", min: 1, max: 2000, step: 1, default: 400,
      // Extending the plan does not invalidate what is drawn: the first k means
      // are the same k means whatever the target is.
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
    // spoiler-free by default; a chapter or notebook that wants a finished
    // histogram asks for one with ?shown=400, which stays shareable.
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
   * reveal of this array, which is why Play always lands exactly on the picture
   * the seed promises rather than somewhere near it.                        */

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
    const domain = params.view === "zoom" ? [pop.mean - 4 * se, pop.mean + 4 * se] : pop.domain;
    const bins = binsFor(params.reps);

    return {
      pop, means, samples, se, domain, bins,
      hist: histogram(means, domain, bins),
      firstSample: samples.length ? samples[0] : [],
    };
  },

  /* --- animation -------------------------------------------------------- *
   * One logical unit is one sample: draw n observations, collapse them to their
   * mean, drop that mean into the pile. "Draw one" performs exactly one; Play
   * performs them all at the chosen speed.                                  */

  animation: {
    init({ params, state, fromScratch }) {
      const anim = {
        pile: makeClPile(params, state),
        phase: "draw", // 'draw' | 'collapse' | 'drop'
        phaseT: 0, //     0..1 within the current phase; 0 means idle
        sinceCommit: 0,
        streamFrom: -1,
        streamT: 0,
        done: false,
      };

      // Authored starting state, e.g. ?shown=400. Skipped on Replay: someone
      // pressing it wants to watch the thing get built.
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.reps);
      for (let i = 0; i < pre; i += 1) anim.pile.push(state.means[i]);
      anim.pile.clearFlash();
      if (anim.pile.shown >= params.reps) anim.done = true;

      return anim;
    },

    /** Re-derive after a display change that alters the binning. */
    rebuild(anim, { params, state }) {
      const drawn = Math.min(anim.pile.shown, params.reps);
      anim.pile = makeClPile(params, state);
      anim.pile.rebuild(state.means.slice(0, drawn));
      anim.done = anim.pile.shown >= params.reps;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const hasDetail = anim.pile.shown < state.samples.length;
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
        anim.pile.push(state.means[anim.pile.shown]);
        anim.phase = "draw";
        anim.phaseT = 0;
        if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
        if (stepping) return halt(anim); // one sample per click
        return true;
      }

      /* Uncoreographed arrivals. Samples still land one at a time and each still
         flashes its slot — the student sees the samples being taken, just not the
         arithmetic behind each one. */
      if (speed.ms > 0) {
        anim.sinceCommit += dt;
        while (anim.sinceCommit >= speed.ms && anim.pile.shown < params.reps) {
          anim.sinceCommit -= speed.ms;
          anim.pile.push(state.means[anim.pile.shown]);
        }
      } else {
        // "Fastest": fill the remainder over a fixed span, so the wait does not
        // scale with the sample count.
        if (anim.streamFrom < 0) anim.streamFrom = anim.pile.shown;
        anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
        const target = Math.min(
          params.reps,
          anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.reps - anim.streamFrom))
        );
        while (anim.pile.shown < target) anim.pile.push(state.means[anim.pile.shown]);
      }

      if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { pop, domain, hist, se } = state;
    const pile = anim.pile;
    const total = pile.shown;
    const inFlight = anim.phaseT > 0 && total < params.reps;

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
     * Both windows are centred on μ by construction (populations declare a
     * half-width, not a domain), so μ occupies the same pixel column in both
     * panels and a single rule can carry it. Drawn first, so marks sit over it. */
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

    // In zoom view the lower panel magnifies a window around μ. Marking it turns
    // a bare scale change into a statement, and the band visibly narrows as n
    // grows, which is σ/√n shown twice over.
    if (params.view === "zoom") {
      pa.band(pop.mean - 4 * se, pop.mean + 4 * se, {
        fill: colors.empirical,
        opacity: 0.09,
        label: "shown below",
      });
    }

    pa.axisX({ label: pop.masses ? "outcome" : "x" });

    // Between steps the sample just drawn stays on screen as a rug, so the
    // student can still see what produced the most recent dot.
    if (!inFlight && total > 0 && total - 1 < state.samples.length) {
      pa.rug(state.samples[total - 1], { stroke: colors.highlight, height: 10, opacity: 0.9 });
    }

    /* -- lower panel: the pile ------------------------------------------- */
    const f = pile.frame();
    const pb = makePlot({ ctx, colors, rect: bottom, xDomain: domain, yDomain: [0, f.yMax] });

    pb.caption(
      total === 0
        ? "Sampling distribution of the mean — nothing drawn yet"
        : anim.done
          ? `Sampling distribution of the mean — n = ${params.n}, ${total} sample${total === 1 ? "" : "s"}`
          : `Sampling distribution of the mean — ${total} of ${params.reps} samples`
    );

    const ticks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    pb.grid(ticks);

    pile.draw(pb, f, { colors, smooth: params.smooth });

    // The normal claim is a claim about many means, so it waits for many.
    if (params.theory && f.barMix > 0) {
      const scale = total * hist.width;
      pb.curve(samplePdf((x) => normalPdf(x, pop.mean, se) * scale, domain, 300), {
        stroke: colors.theory,
        width: 2,
        opacity: f.barMix,
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
   * Two prediction/observation pairs reading left to right. Adjacency is the
   * argument. Both observations track the partial data, so a student watches them
   * converge rather than being shown the agreement as a finished fact.       */

  readout({ params, state, anim }) {
    const { pop, se } = state;
    const pile = anim.pile;
    const of = `of ${pile.shown} mean${pile.shown === 1 ? "" : "s"}`;

    return [
      { label: "Population μ, σ", value: `${fmt(pop.mean)}, ${fmt(pop.sd)}`, note: pop.label },
      { label: "Observed mean", value: fmt(pile.mean, 3), note: of },
      { label: "Predicted SE", value: fmt(se, 3), note: `σ/√${params.n}` },
      { label: "Observed SD", value: fmt(pile.sd, 3), note: of },
    ];
  },
});

/* --- helpers ------------------------------------------------------------ */

/**
 * Stop advancing, clearing the landing flash: once the animation halts no
 * further frames arrive to fade it, and a frozen half-faded highlight reads as a
 * marked bar rather than a recent arrival.
 */
function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  anim.pile.clearFlash();
  return false;
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
  const pile = anim.pile;
  const sample = state.samples[pile.shown];
  if (!sample) return;

  const m = state.means[pile.shown];
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
    const bin = pile.binOf(m);
    const geom = {
      x0: pa.sx(m),
      x1: pb.sx(m),
      y0: dotY,
      // A mean outside the plotted window still lands, it just lands on the floor.
      y1: bin >= 0 ? pb.sy(pile.counts[bin] + 0.5) : pb.bottom,
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
 * eases IN across the whole drop, so the path arcs over and accelerates downward
 * — it reads as falling into place rather than sliding.
 *
 * Sideways motion only exists in "Zoom on μ", where the two panels have different
 * x-scales. In shared-axis view x0 === x1 and this degenerates to a pure
 * accelerating fall, which is exactly what a drop should be. Candidates for this
 * curve are mocked up side by side in widgets/_lab/drop-paths.html.
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
  // A surface halo keeps the label readable over the density curve.
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}
