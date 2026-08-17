/* ============================================================================
   Bootstrap — widget 3 of the statistics arc.

     increments → means → ONE SAMPLE → an interval → a null by shuffling → many nulls

   Answers the objection widget 2 earns against itself. `clt` draws hundreds of
   samples from a population whose μ and σ are printed on screen, and nobody has
   ever been in that position. Here you have ONE sample. You resample it with
   replacement, and the spread of the resampled statistic stands in for the
   sampling distribution you cannot have.

   MISCONCEPTIONS TARGETED
     - that knowing an estimate's uncertainty requires repeated samples from the
       population — which is exactly what widget 2 quietly assumed
     - that resampling "manufactures data". Every value in a resample is a copy
       of one you already had, which is why the choreography takes the copies
       from named observations rather than letting them appear from nowhere.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - THE PAYOFF IS THE OVERLAY. Populations here are seeded, so this widget can
     put the TRUE sampling distribution — obtainable only by going back to the
     population two thousand times, which no one can do — behind the bootstrap
     distribution, which you can actually compute from the one sample you have.
     They come out nearly the same width. That single comparison is the entire
     justification for the method, and it is available only because the
     population is reproducible.

   - THE BOOTSTRAP IS CENTRED ON YOUR ESTIMATE, NOT ON THE TRUTH. The two curves
     agree in WIDTH and generally disagree in POSITION, and that is not a defect
     to hide. The bootstrap tells you how far your estimate could have fallen
     from the one you got; it cannot tell you how far it fell from the truth.
     Hence the plotting window is centred on the true value rather than on the
     estimate: a window centred on the estimate would put the pile in the middle
     every time and hide exactly this. Change the seed and the whole pile slides
     while its width stays put.

   - DUPLICATES ARE THE MECHANISM, not a detail of it. A resample is drawn as
     copies stacking directly above the observations they were taken from, so an
     observation used three times is three visible dots and an observation never
     used visibly dims. Sampling with replacement is the one step a student
     cannot reconstruct from a formula, which is why `rng.resample` returns
     indices rather than values.

   - THE MOTION IS `clt`'s MOTION. pick → collapse → drop, deliberately, so a
     student recognises the shape and has only to notice what changed: the draws
     now come from the SAMPLE above rather than from the POPULATION above.

   - THE STATISTIC SWITCHES INSIDE THIS WIDGET. Widgets 2–3 study a mean; widgets
     4–6 study a difference between two groups, because effect size is the thing
     with clinical meaning. Making that a control here, rather than a silent
     change between two widgets, is the point: same machinery, new statistic.
     Both land in the same lesson (Estimation — Quantifying Uncertainty), so the
     transition has to happen somewhere a student can see it.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, histogram, normalPdf, sd, fmt,
  makePlot, samplePdf, niceTicks, spanningRule,
  createPile, binsFor, FLASH_MS,
} from "../core/index.js";

/* The true effect in difference mode, in population SDs. At the default n = 12
   that is about 1.8 standard errors: visibly non-zero, and not so large that the
   bootstrap spread beside it looks like a rounding error. Fixed rather than
   exposed as a control — whether an effect could have been chance is widget 5's
   question, and this widget is about how precisely it is pinned down. */
const EFFECT_SD = 0.75;

/* The true sampling distribution, by brute force. A fixed count, so the
   reference curve does not shift when `reps` does. */
const TRUTH_REPS = 2000;

/* Resamples whose pick indices are retained for the choreography. Past this the
   animation is too fast for individual copies to read anyway, and keeping
   reps x n indices would mean a large allocation on every slider tick. */
const KEEP = 60;

/* Pacing is CHOSEN, not automatic — an animation that speeds up on its own takes
   the pacing decision away from the person who can see how fast the room is
   following. Past a certain speed there is nothing left to see in the per-draw
   steps, so the choreography switches off; but that is a declared property of
   the chosen speed, not something the animation decides mid-run. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every draw shown", ms: 1500, choreo: true },
  medium: { label: "Medium", detail: "every draw shown", ms: 600, choreo: true },
  fast: { label: "Fast", detail: "resamples only, no draws", ms: 120, choreo: false },
  fastest: { label: "Fastest", detail: "fills in at once", ms: 0, choreo: false },
};

// "Resample once" always runs the full choreography at this speed, whatever Play
// is set to. Its whole job is to show the mechanism; a fast single step is useless.
const STEP_MS = 1600;
const STREAM_MS = 3200;
const PHASE_FRAC = { pick: 0.46, collapse: 0.24, drop: 0.30 };

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

const distOptions = ["exponential", "bimodal", "uniform", "pareto", "bernoulli", "normal"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/* --- the statistic ------------------------------------------------------- *
 * One function, used by the observed sample, by every bootstrap resample and by
 * the truth simulation. Three call sites agreeing on what is being estimated is
 * exactly the situation principle 5.7 exists for.                            */

/** Mean of the values at `idx`, or of all of them when `idx` is omitted. */
function meanAt(values, idx = null) {
  const k = idx ? idx.length : values.length;
  let s = 0;
  for (let i = 0; i < k; i += 1) s += idx ? values[idx[i]] : values[i];
  return s / k;
}

/** The statistic: a mean, or the difference between two group means. */
function statOf(groupMeans) {
  return groupMeans.length > 1 ? groupMeans[1] - groupMeans[0] : groupMeans[0];
}

/** Times each of `len` observations appears in the first `m` draws of `idx`. */
function countsFrom(idx, len, m = idx.length) {
  const c = new Array(len).fill(0);
  for (let k = 0; k < m; k += 1) c[idx[k]] += 1;
  return c;
}

function makeBootPile(state) {
  return createPile({ bins: state.bins, lo: state.hist.lo, width: state.hist.width });
}

defineWidget({
  slug: "bootstrap",
  title: "Uncertainty from one sample",
  subtitle:
    "In practice you get one sample, never a population. Draw a new sample of " +
    "the same size from the one you have — with replacement, so some " +
    "observations appear twice and others not at all — and the spread of the " +
    "resampled statistic stands in for a sampling distribution you can never " +
    "observe.",
  height: 560,

  /* Reading order of the setup block: what am I estimating, from what, from how
     much of it — then how do I want to look at it.

     `display: true` marks a parameter that changes only how state is drawn.
     Those keep the student's work; the others make the data genuinely different
     data and start over. `stat` is a data parameter precisely because it changes
     what is being estimated. */
  params: {
    stat: {
      type: "segmented",
      label: "Statistic",
      options: [
        { value: "mean", label: "A mean", detail: "one group" },
        { value: "diff", label: "A difference", detail: "between two groups" },
      ],
      default: "mean",
    },
    dist: { type: "select", label: "Population", options: distOptions, default: "exponential" },
    // n = 12 keeps the copies countable, which is the whole reason the resample
    // is drawn observation by observation. Drag it down to 3 and the bootstrap
    // visibly stops working; that case is one drag away on purpose.
    n: { type: "int", label: "Sample size n", min: 3, max: 60, default: 12 },
    reps: {
      type: "int", label: "Resamples to draw", min: 1, max: 2000, step: 1, default: 400,
      // Extending the plan does not invalidate what is drawn: the first k
      // resamples are the same k resamples whatever the target is.
      display: true,
    },
    /* Seed 3, not 1, and the reason is worth keeping so nobody tidies it back.
       The bootstrap SE tracks the OBSERVED sample's spread, s/√n, not σ/√n — so
       how well it matches the truth depends on how representative your one
       sample happened to be. At n = 12 from an exponential that is genuinely
       noisy: across seeds, s lands anywhere from 0.6σ to 2.0σ, and seed 1 draws
       a 5.9 among twelve values and comes out 56% too wide.

       An authored default should show the method working before it shows it
       straining. Seed 3 does both at once: the bootstrap SE lands within 2% of
       the truth, AND the estimate sits 1.3 SE away from μ — so the two lessons
       arrive together, that the spread is recoverable and the centre is not.
       Every noisier seed is one tick away, which is where principle 2.6 wants
       the case that fails: included, not opened on. */
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 3 },
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
    },
    truth: { type: "bool", label: "True sampling distribution", default: true, display: true },
    smooth: { type: "bool", label: "Smoothed density", default: true, display: true },

    // Authoring escape hatch, deliberately not a visible control. The figure is
    // spoiler-free by default; a lesson that wants a finished picture asks for
    // one with ?shown=400, which stays in the URL and therefore shareable.
    shown: { type: "int", label: "Pre-filled resamples", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "Bootstrap distribution — computed from your one sample", mark: "bar" },
    { token: "smoothed", label: "Smoothed density of those", mark: "line" },
    { token: "theory", label: "True sampling distribution — unavailable in practice", mark: "line" },
    { token: "highlight", label: "One resample, drawn with replacement", mark: "dot" },
  ],

  /* --- data ------------------------------------------------------------- *
   * Order in this function is load-bearing, because it is one seeded stream:
   * the observed sample is drawn FIRST so that changing how many resamples you
   * plan to take cannot change the data you were dealt.                      */

  compute({ params, rng }) {
    const pop = POPULATIONS[params.dist];
    const two = params.stat === "diff";
    const delta = two ? EFFECT_SD * pop.sd : 0;
    const n = params.n;

    /* 1 — THE sample. This, and nothing else, is what a real analyst holds. */
    const groups = [{ label: "A", shift: 0, values: drawSample(pop, n, 0, rng) }];
    if (two) groups.push({ label: "B", shift: delta, values: drawSample(pop, n, delta, rng) });

    const observed = statOf(groups.map((g) => meanAt(g.values)));

    /* 2 — the true sampling distribution: repeat the whole study TRUTH_REPS
       times, from the population. Simulated rather than assumed normal, because
       at n = 8 from a heavy tail it is visibly skewed and drawing a normal there
       would misrepresent the very thing the bootstrap is being checked against.
       No arrays allocated in the loop — this runs on every parameter change. */
    const truth = new Array(TRUTH_REPS);
    for (let r = 0; r < TRUTH_REPS; r += 1) {
      let a = 0;
      for (let i = 0; i < n; i += 1) a += pop.sample(rng);
      let s = a / n;
      if (two) {
        let b = 0;
        for (let i = 0; i < n; i += 1) b += pop.sample(rng) + delta;
        s = b / n - s;
      }
      truth[r] = s;
    }

    /* 3 — the bootstrap resamples. Every value used here is a copy of one in
       `groups`; nothing new is drawn from the population past this point, which
       is the whole claim of the method. */
    const stats = new Array(params.reps);
    const picks = [];
    for (let r = 0; r < params.reps; r += 1) {
      const per = groups.map(() => rng.resample(n));
      stats[r] = statOf(per.map((idx, g) => meanAt(groups[g].values, idx)));
      if (r < KEEP) picks.push(per);
    }

    /* Fix the frame, not the data: the tallest stack any choreographed resample
       will produce, so the sample panel's scale is settled before the animation
       starts and cannot move under a half-built picture. */
    let maxPick = 1;
    for (const per of picks) {
      for (const idx of per) {
        for (const c of countsFrom(idx, n)) if (c > maxPick) maxPick = c;
      }
    }

    const se = two ? (pop.sd * Math.SQRT2) / Math.sqrt(n) : pop.sd / Math.sqrt(n);
    const trueVal = two ? delta : pop.mean;

    /* Centred on the TRUE value, not on the estimate. The pile sitting visibly
       off-centre is the lesson — a window centred on the estimate would put it
       in the middle every time and hide the one thing the bootstrap cannot do.
       Widened only when an unlucky sample would otherwise push it off the panel. */
    const hw = Math.max(4.5 * se, Math.abs(observed - trueVal) + 3.6 * se);
    const domain = [trueVal - hw, trueVal + hw];
    const bins = binsFor(params.reps);

    return {
      pop, two, delta, groups, picks, stats, observed, trueVal, se, domain, bins, maxPick,
      // Both populations have to fit when there are two of them, so this window
      // is NOT μ-centred in difference mode — see the spanning rule in draw().
      dataDomain: two ? [pop.domain[0], pop.domain[1] + delta] : pop.domain,
      hist: histogram(stats, domain, bins),
      truthDensity: densityCurve(truth, domain),
    };
  },

  /* --- animation -------------------------------------------------------- *
   * One logical unit is one resample: pick n observations with replacement,
   * collapse the copies to the statistic, drop that number into the pile.    */

  animation: {
    stepLabel: "Resample once",
    runLabel: "Play",

    init({ params, state, fromScratch }) {
      const anim = {
        pile: makeBootPile(state),
        phase: "pick", // 'pick' | 'collapse' | 'drop'
        phaseT: 0, //     0..1 within the current phase; 0 means idle
        sinceCommit: 0,
        streamFrom: -1,
        streamT: 0,
        done: false,
      };

      // Authored starting state, e.g. ?shown=400. Skipped on Replay: someone
      // pressing it wants to watch the thing get built.
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.reps);
      for (let i = 0; i < pre; i += 1) anim.pile.push(state.stats[i]);
      anim.pile.clearFlash();
      if (anim.pile.shown >= params.reps) anim.done = true;

      return anim;
    },

    /** Re-derive after a display change that alters the binning. */
    rebuild(anim, { params, state }) {
      const drawn = Math.min(anim.pile.shown, params.reps);
      anim.pile = makeBootPile(state);
      anim.pile.rebuild(state.stats.slice(0, drawn));
      anim.done = anim.pile.shown >= params.reps;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const hasDetail = anim.pile.shown < state.picks.length;
      // "Resample once" always choreographs. Play choreographs only at the
      // speeds where there is something left to see in it.
      const choreo = hasDetail && (stepping || speed.choreo);

      if (choreo) {
        const budget = (stepping ? STEP_MS : speed.ms) * PHASE_FRAC[anim.phase];
        anim.phaseT += dt / Math.max(1, budget);
        if (anim.phaseT < 1) return true;

        if (anim.phase === "pick") {
          anim.phase = "collapse";
          anim.phaseT = 0.001; // stay non-zero: phaseT === 0 means idle
          return true;
        }
        if (anim.phase === "collapse") {
          anim.phase = "drop";
          anim.phaseT = 0.001;
          return true;
        }

        // The drop landed: fold this resample in and go idle.
        anim.pile.push(state.stats[anim.pile.shown]);
        anim.phase = "pick";
        anim.phaseT = 0;
        if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
        if (stepping) return halt(anim); // one resample per click
        return true;
      }

      /* Uncoreographed arrivals. Resamples still land one at a time and each
         still flashes its slot — the student sees them being taken, just not the
         arithmetic behind each one. */
      if (speed.ms > 0) {
        anim.sinceCommit += dt;
        while (anim.sinceCommit >= speed.ms && anim.pile.shown < params.reps) {
          anim.sinceCommit -= speed.ms;
          anim.pile.push(state.stats[anim.pile.shown]);
        }
      } else {
        // "Fastest": fill the remainder over a fixed span, so the wait does not
        // scale with the resample count.
        if (anim.streamFrom < 0) anim.streamFrom = anim.pile.shown;
        anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
        const target = Math.min(
          params.reps,
          anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.reps - anim.streamFrom))
        );
        while (anim.pile.shown < target) anim.pile.push(state.stats[anim.pile.shown]);
      }

      if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- *
   * Three panels, top to bottom, which is the order of the argument:
   *   the population   you do not have this
   *   your one sample  you have exactly this
   *   the pile         what you can build from it                           */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { pop, two, groups, dataDomain, domain, hist, trueVal } = state;
    const pile = anim.pile;
    const total = pile.shown;
    const inFlight = anim.phaseT > 0 && total < params.reps;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    const top = { x: ML, y: 26, w: plotW, h: 56 };
    // Two groups genuinely need two rows, so the panel grows rather than
    // squeezing them into the one-group height.
    const midH = two ? 132 : 92;
    const mid = { x: ML, y: top.y + top.h + 54, w: plotW, h: midH };
    const bottomY = mid.y + mid.h + 56;
    const bottom = { x: ML, y: bottomY, w: plotW, h: Math.max(110, h - bottomY - 40) };

    /* -- upper panel: the population ------------------------------------ */
    const popYMax = pop.masses
      ? Math.max(...pop.masses.map((m) => m[1])) * 1.35
      : Math.max(...samplePdf(pop.pdf, pop.domain, 200).map((p) => p[1])) * 1.18;

    const pa = makePlot({ ctx, colors, rect: top, xDomain: dataDomain, yDomain: [0, popYMax] });
    const ms = makePlot({ ctx, colors, rect: mid, xDomain: dataDomain, yDomain: [0, 1] });

    /* -- reference rules ------------------------------------------------- *
     * In mean mode every window is μ-centred by construction — populations
     * declare a half-width, not a domain — so μ occupies the same pixel column
     * in the population panel and in the pile below, and ONE rule carries it all
     * the way down. In difference mode nothing means the same thing in both
     * scales: the upper panels are in data units and the pile is in difference
     * units, so the truth is marked twice, locally and honestly. */
    if (!two) {
      spanningRule(ctx, colors, { x: pa.sx(pop.mean), y0: top.y, y1: bottom.y + bottom.h, label: "μ" });
    }

    pa.caption(`Population — ${pop.label}${two ? ", two groups" : ""} · you never see this`);

    for (const g of groups) {
      if (pop.masses) {
        pa.spikes(pop.masses.map(([v, p]) => [v + g.shift, p]), {
          fill: colors.ink3, opacity: 0.55, width: 14,
        });
      } else {
        const curve = samplePdf((x) => pop.pdf(x - g.shift), dataDomain, 300);
        pa.area(curve, { fill: colors.ink3, opacity: 0.12 });
        pa.curve(curve, { stroke: colors.ink3, width: 2 });
      }
      if (two) {
        pa.vline(pop.mean + g.shift, { stroke: colors.reference, label: `μ${g.label}`, align: "right" });
      }
    }

    // The pile below magnifies a window around μ. Marking it turns a bare scale
    // change into a statement. Only meaningful in mean mode, where the two
    // panels are measuring the same quantity.
    if (!two) {
      pa.band(domain[0], domain[1], { fill: colors.empirical, opacity: 0.06, label: "shown below" });
    }

    pa.axisX({ label: pop.masses ? "outcome" : "x" });

    /* -- middle panel: the one sample you actually have ------------------- */
    const rows = sampleRows(mid, two);
    const revealed = revealedCounts({ params, state, anim, inFlight });

    /* Only the first KEEP resamples retain their pick indices, so past that
       there are no copies to show and the caption must not claim otherwise.
       That is also the settled figure a lesson publishes with ?shown=400, and
       it is the right moment to say the thing the whole widget is arguing:
       nothing new was ever drawn. */
    ms.caption(
      revealed
        ? inFlight
          ? "Your sample — resampling it with replacement"
          : "Your sample — the copies that produced the last resample"
        : `Your sample — n = ${params.n}${two ? " per group" : ""}, drawn once · ` +
          "every resample is built from these values and no others"
    );

    for (let g = 0; g < groups.length; g += 1) {
      const rp = makePlot({
        ctx, colors, rect: rows[g], xDomain: dataDomain, yDomain: [0, state.maxPick + 1],
      });
      drawSampleRow(ctx, rp, {
        colors,
        values: groups[g].values,
        counts: revealed ? revealed.counts[g] : null,
        label: two ? groups[g].label : "",
        // Mid-collapse the copies are travelling, so they are drawn by the
        // choreography instead; only the parents stay put here.
        stacks: !revealed || anim.phase === "pick" || !inFlight,
        fade: inFlight ? 1 : 0.55,
      });

      /* Where your estimate actually comes from. In a settled figure this is the
         only mark tying the sample to the pile below: the pile is centred HERE,
         on the mean of these values, and not on the μ rule running past it. */
      rp.vline(meanAt(groups[g].values), {
        stroke: colors.empirical,
        label: two ? `x̄${groups[g].label}` : "x̄",
        align: "right",
      });
    }

    ms.axisX({ label: two ? "observation value (group A above, B below)" : "observation value" });

    /* -- lower panel: the bootstrap distribution -------------------------- */
    const f = pile.frame();
    const pb = makePlot({ ctx, colors, rect: bottom, xDomain: domain, yDomain: [0, f.yMax] });

    pb.caption(
      total === 0
        ? "Bootstrap distribution — nothing resampled yet"
        : anim.done
          ? `Bootstrap distribution — ${total} resample${total === 1 ? "" : "s"}`
          : `Bootstrap distribution — ${total} of ${params.reps} resamples`
    );

    const ticks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    pb.grid(ticks);

    if (two) {
      pb.vline(trueVal, { stroke: colors.reference, label: "true effect", align: "right" });
    }

    pile.draw(pb, f, { colors, smooth: params.smooth });

    /* The claim being checked is about the SHAPE of the bootstrap distribution,
       so it waits until there is a shape — the same threshold the histogram
       crossfade uses. A reference curve over six dots is a lie told with a
       spline, and this particular curve is the widget's whole argument. */
    if (params.truth && f.barMix > 0) {
      const scale = total * hist.width;
      /* `--c-theory`, not `--c-reference`, and the two roles divide cleanly:
         reference carries a true PARAMETER (the μ rule, the true-effect line) and
         theory carries the CURVE the pile is being checked against. That is the
         job `clt`'s normal overlay does in the same colour, so a student who
         learned "orange is what the pile should look like" in widget 2 meets the
         same convention here. It is also the payoff of this widget, and
         reference is `--ink-3` — the quietest ink in the system, which is the
         wrong weight for the one comparison the figure exists to make. */
      pb.curve(state.truthDensity.map(([x, d]) => [x, d * scale]), {
        stroke: colors.theory,
        width: 2,
        opacity: f.barMix,
      });
    }

    pb.axisY({ ticks, label: "count" });
    pb.axisX({ label: two ? "resampled difference in means" : "resampled mean" });

    /* -- the resample in flight, across the sample and pile panels -------- */
    if (inFlight && revealed) {
      drawResampleInFlight({ ctx, colors, rows, pb, state, anim, revealed, dataDomain });
    }
  },

  /* --- readout ---------------------------------------------------------- *
   * Two pairs, reading left to right, and they say opposite things on purpose.
   *
   *   estimate  vs  truth        these DISAGREE, by an amount you cannot know
   *   bootstrap SE vs true SE    these AGREE, which is why the method works
   *
   * Putting the disagreement first stops the widget from reading as "resampling
   * recovers the answer". It recovers the uncertainty, not the answer.        */

  readout({ params, state, anim }) {
    const { two, observed, trueVal, se } = state;
    const pile = anim.pile;
    const of = `of ${pile.shown} resample${pile.shown === 1 ? "" : "s"}`;

    return [
      {
        label: "Your estimate",
        value: fmt(observed, 3),
        note: two ? "x̄B − x̄A, from one study" : "x̄, from one sample",
      },
      { label: "True value", value: fmt(trueVal, 3), note: "you never see this" },
      { label: "Bootstrap SE", value: fmt(pile.sd, 3), note: of },
      { label: "True SE", value: fmt(se, 3), note: two ? "σ√(2/n)" : "σ/√n" },
    ];
  },
});

/* --- helpers ------------------------------------------------------------ */

function drawSample(pop, n, shift, rng) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) out[i] = pop.sample(rng) + shift;
  return out;
}

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

/** One row per group, stacked inside the sample panel with a gap between. */
function sampleRows(mid, two) {
  if (!two) return [mid];
  const gap = 16;
  const rh = (mid.h - gap) / 2;
  return [
    { ...mid, h: rh },
    { ...mid, y: mid.y + rh + gap, h: rh },
  ];
}

/**
 * Which observations the resample in view has picked so far, and the statistic
 * it is heading for.
 *
 * During `pick` the draws are revealed in order — group A's n draws, then group
 * B's — so the count is partial. Once picking is over the whole resample is
 * present. Between steps this reports the PREVIOUS resample, so the copies that
 * produced the most recent dot stay on screen to be counted at leisure.
 */
function revealedCounts({ params, state, anim, inFlight }) {
  const idx = inFlight ? anim.pile.shown : anim.pile.shown - 1;
  const per = state.picks[idx];
  if (!per) return null;

  const n = params.n;
  const drawsPerGroup = n;
  const totalDraws = drawsPerGroup * per.length;
  const done = inFlight && anim.phase === "pick"
    ? Math.floor(clamp01(anim.phaseT) * totalDraws)
    : totalDraws;

  const counts = per.map((ids, g) =>
    countsFrom(ids, n, Math.max(0, Math.min(drawsPerGroup, done - g * drawsPerGroup)))
  );
  const means = per.map((ids, g) => meanAt(state.groups[g].values, ids));

  return { per, counts, means, stat: state.stats[idx], partial: done < totalDraws };
}

/**
 * One group's row: the observations you were dealt along the baseline, and the
 * copies taken from them stacked directly above.
 *
 * An observation never picked dims to recessive ink rather than disappearing —
 * "this one contributed nothing to that resample" is as much a part of sampling
 * with replacement as the duplicates are.
 */
function drawSampleRow(ctx, plot, { colors, values, counts, label, stacks, fade }) {
  const { sx, sy } = plot;

  if (label) {
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, plot.x - 8, sy(0.5));
    ctx.restore();
  }

  for (let i = 0; i < values.length; i += 1) {
    const used = counts ? counts[i] > 0 : true;
    pin(ctx, colors, sx(values[i]), sy(0.5), 4.5, used ? colors.empirical : colors.ink3, used ? 1 : 0.45);
  }

  if (!counts || !stacks) return;
  ctx.save();
  ctx.globalAlpha = fade;
  for (let i = 0; i < values.length; i += 1) {
    for (let k = 1; k <= counts[i]; k += 1) {
      pin(ctx, colors, sx(values[i]), sy(k + 0.5), 4.5, colors.highlight, 1);
    }
  }
  ctx.restore();
}

/**
 * The three-phase choreography, drawn in absolute canvas pixels because it
 * crosses from the sample panel into the panel below.
 *
 *   pick     — copies appear above the observations they were taken from
 *   collapse — the copies slide together to their mean; with two groups the two
 *              means then span a gap, and that gap is the statistic
 *   drop     — the single number falls into the slot it is about to occupy
 *
 * Deliberately the same shape as `clt`'s draw/collapse/drop. What differs is
 * where the copies come from, and that is the only thing a student should have
 * to notice.
 */
function drawResampleInFlight({ ctx, colors, rows, pb, state, anim, revealed, dataDomain }) {
  const { two, groups, maxPick } = state;
  const t = clamp01(anim.phaseT);

  const scaleFor = (g) =>
    makePlot({ ctx, colors, rect: rows[g], xDomain: dataDomain, yDomain: [0, maxPick + 1] });

  ctx.save();

  if (anim.phase === "collapse") {
    // Every copy slides from its parent observation to the group's resampled
    // mean. The copies are the resample; the parents stay where they are.
    const e = easeOut(t);
    for (let g = 0; g < groups.length; g += 1) {
      const rp = scaleFor(g);
      const target = rp.sx(revealed.means[g]);
      for (let i = 0; i < groups[g].values.length; i += 1) {
        const from = rp.sx(groups[g].values[i]);
        for (let k = 1; k <= revealed.counts[g][i]; k += 1) {
          pin(ctx, colors, from + (target - from) * e, rp.sy(k + 0.5), 4.5, colors.highlight, 1);
        }
      }
    }
    if (e > 0.55) {
      const alpha = (e - 0.55) / 0.45;
      const origin = statOrigin({ ctx, colors, rows, state, revealed, dataDomain });
      if (two) drawGap({ ctx, colors, rows, state, revealed, dataDomain, alpha });
      label(ctx, colors, statLabel(two, revealed.stat), origin[0], origin[1] - 12, alpha);
    }
    ctx.restore();
    return;
  }

  if (anim.phase === "drop") {
    const bin = anim.pile.binOf(revealed.stat);
    const [x0, y0] = statOrigin({ ctx, colors, rows, state, revealed, dataDomain });
    const geom = {
      x0,
      y0,
      x1: pb.sx(revealed.stat),
      // A statistic outside the plotted window still lands, it just lands on the
      // floor — the same treatment a histogram gives it.
      y1: bin >= 0 ? pb.sy(anim.pile.counts[bin] + 0.5) : pb.bottom,
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

    // The label has already named the value by the time the fall starts, so it
    // clears out early rather than travelling down through the panel caption.
    label(ctx, colors, statLabel(two, revealed.stat), at[0], at[1] - 12, 1 - t / 0.3);
    pin(ctx, colors, at[0], at[1], 5, colors.highlight, 1);
  }

  ctx.restore();
}

/**
 * Where the statistic sits once the copies have collapsed, in canvas pixels.
 *
 * One group: the resampled mean, on its row. Two groups: the middle of the gap
 * between the two group means, which is where the difference is written and
 * therefore where it should start falling from. Shared by the collapse label and
 * by the drop, so the number cannot appear in one place and leave from another.
 */
function statOrigin({ ctx, colors, rows, state, revealed, dataDomain }) {
  const plot = (g) =>
    makePlot({ ctx, colors, rect: rows[g], xDomain: dataDomain, yDomain: [0, state.maxPick + 1] });

  if (!state.two) {
    const rp = plot(0);
    return [rp.sx(revealed.means[0]), rp.sy(1.5)];
  }
  const a = plot(0);
  const b = plot(1);
  return [
    (a.sx(revealed.means[0]) + b.sx(revealed.means[1])) / 2,
    (rows[0].y + rows[0].h + rows[1].y) / 2,
  ];
}

/** The span between two group means — the difference, drawn as a distance. */
function drawGap({ ctx, colors, rows, state, revealed, dataDomain, alpha }) {
  const plot = (g) =>
    makePlot({ ctx, colors, rect: rows[g], xDomain: dataDomain, yDomain: [0, state.maxPick + 1] });
  const xa = plot(0).sx(revealed.means[0]);
  const xb = plot(1).sx(revealed.means[1]);
  const y = (rows[0].y + rows[0].h + rows[1].y) / 2;

  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(xa, y);
  ctx.lineTo(xb, y);
  ctx.stroke();
  // Ticks at each end, so the line reads as a measured distance rather than a
  // connector between two dots.
  for (const x of [xa, xb]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function statLabel(two, v) {
  return two ? `x̄B − x̄A = ${fmt(v, 2)}` : `x̄* = ${fmt(v, 2)}`;
}

/**
 * Split timing: the sideways move eases OUT over the first 60% while the fall
 * eases IN across the whole drop, so the path arcs over and accelerates downward
 * — it reads as falling into place rather than sliding. Candidates for this
 * curve are mocked up side by side in widgets/_lab/drop-paths.html.
 */
function dropPoint(t, { x0, x1, y0, y1 }) {
  return [
    x0 + (x1 - x0) * easeOut(clamp01(t / 0.6)),
    y0 + (y1 - y0) * easeIn(clamp01(t)),
  ];
}

/** A marker with a 2px surface ring so it stays legible where marks overlap. */
function pin(ctx, colors, x, y, r, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.restore();
}

function label(ctx, colors, text, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.fillStyle = colors.ink1;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  // A surface halo keeps the label readable over the marks behind it.
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Smoothed density of `values`, evaluated across `domain`, integrating to 1.
 *
 * Binned first and then convolved, the same trick the pile uses: the cost is
 * bins x grid rather than values x grid, which matters because this runs over
 * two thousand simulated statistics on every parameter change. Binning spans the
 * values' own range rather than the plotted window, so a tail falling outside
 * the panel still contributes to the density inside it.
 */
function densityCurve(values, domain, bins = 140, steps = 240) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!(hi > lo)) return [];

  const width = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / width))] += 1;

  const h = Math.max(width, 0.9 * (sd(values) || width) * Math.pow(values.length, -0.2));
  const pts = [];
  for (let g = 0; g <= steps; g += 1) {
    const x = domain[0] + ((domain[1] - domain[0]) * g) / steps;
    let f = 0;
    for (let i = 0; i < bins; i += 1) {
      const c = counts[i];
      if (c) f += c * normalPdf(x, lo + (i + 0.5) * width, h);
    }
    pts.push([x, f / values.length]);
  }
  return pts;
}
