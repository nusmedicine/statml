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
     That single comparison is the entire justification for the method, and it is
     available only because the population is reproducible.

   - AND THE OVERLAY IS HONEST ABOUT WHEN IT FAILS. The bootstrap does not sample
     from the population; it samples from YOUR SAMPLE, substituting the empirical
     distribution for the real one. So everything it can tell you is a property
     of the sample you happened to get:

       centre  it sits on x̄, not μ, and cannot tell you the gap between them
       spread  for a mean it is essentially s/√n, so it is wrong exactly to the
               degree s is a poor estimate of σ
       shape   it inherits the sample's skew, which is noisier still at small n

     It is asymptotically right and small-sample honest-but-noisy. That is why
     the readout shows s beside σ at all: it is the *cause* of the two standard
     errors agreeing or not, and without it the widget can only assert that the
     bootstrap sometimes works. Drag n down and watch s pull away from σ and the
     SEs pull apart with it.

   - THE WINDOW IS CENTRED ON THE TRUE VALUE, not on the estimate. Centring on
     the estimate is the obvious choice and it would put the pile in the middle
     every time, hiding the first point above. Change the seed and the whole pile
     slides while its width stays put.

   - DUPLICATES ARE THE MECHANISM, not a detail of it. A resample is drawn as
     copies stacking directly above the observations they were taken from, so an
     observation used three times is three visible dots and an observation never
     used visibly dims. Sampling with replacement is the one step a student
     cannot reconstruct from a formula, which is why `rng.resample` returns
     indices rather than values.

   - THE MOTION IS `clt`'s MOTION. pick → collapse → drop, deliberately, so a
     student recognises the shape and has only to notice what changed: the draws
     now come from the SAMPLE above rather than from the POPULATION above.

   ONE STATISTIC, DELIBERATELY. An earlier build carried a `stat` control that
   switched between a mean and a difference between two groups, so the widget-3
   to widget-4 change of statistic would happen somewhere a student could see it.
   Cut: two groups meant two rows, two collapses and a gap to read as the
   statistic, and the mechanism being taught here — sampling with replacement —
   got harder to narrate rather than easier. Widget 4 opens on a difference and
   carries that transition alone. A widget teaches one idea.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, histogram, normalPdf, sd, fmt,
  makePlot, samplePdf, niceTicks, spanningRule,
  createPile, binsFor,
} from "../core/index.js";

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

// "Resample your sample" always runs the full choreography at this speed,
// whatever Play is set to. Its whole job is to show the mechanism; a fast single
// step is useless.
const STEP_MS = 1600;
const STREAM_MS = 3200;
const PHASE_FRAC = { pick: 0.46, collapse: 0.24, drop: 0.30 };

/* Stage one: the single sample, falling out of the population. Slower than a
   resample because it happens exactly once and everything after it depends on
   it. The observations appear at their sampled values in the population panel,
   hold, then fall together into the sample row. */
const LEAD_MS = 2200;
const LEAD_APPEAR = 0.46; // reveal is spread over this much of the stage
const LEAD_FALL = 0.58; //   ...and the fall starts here, after a beat

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

const distOptions = ["exponential", "bimodal", "uniform", "pareto", "counts", "proportion", "bernoulli", "normal"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** Mean of the values at `idx`, or of all of them when `idx` is omitted. */
function meanAt(values, idx = null) {
  const k = idx ? idx.length : values.length;
  let s = 0;
  for (let i = 0; i < k; i += 1) s += idx ? values[idx[i]] : values[i];
  return s / k;
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
  /* Controls beside the figure. Measured in _lab/side-layout.html against the
     real widget: 1184 -> 930 px; still 30 over, but 254 better. The canvas gets WIDER doing this
     (694 -> ~770), so the figure gains room rather than losing it. */
  layout: "side",
  title: "Bootstrap Sampling",
  subtitle:
    "In practice you get one sample, never a population. Draw a new sample of " +
    "the same size from the one you have — with replacement, so some " +
    "observations appear twice and others not at all — and the spread of the " +
    "resampled means stands in for a sampling distribution you can never " +
    "observe. It stands in only as well as your one sample represents the " +
    "population, which is what the numbers below are for.",
  height: 540,

  /* Reading order of the setup block: what am I sampling from, how much of it,
     with which draw — then how do I want to look at it.

     `display: true` marks a parameter that changes only how state is drawn.
     Those keep the student's work; the others make the data genuinely different
     data and start over. */
  params: {
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
    const n = params.n;

    /* 1 — THE sample. This, and nothing else, is what a real analyst holds. */
    const sample = new Array(n);
    for (let i = 0; i < n; i += 1) sample[i] = pop.sample(rng);

    const observed = meanAt(sample);
    const sampleSd = sd(sample);

    /* 2 — the true sampling distribution: repeat the whole study TRUTH_REPS
       times, from the population. Simulated rather than assumed normal, because
       at n = 8 from a heavy tail it is visibly skewed and drawing a normal there
       would misrepresent the very thing the bootstrap is being checked against.
       No arrays allocated in the loop — this runs on every parameter change. */
    const truth = new Array(TRUTH_REPS);
    for (let r = 0; r < TRUTH_REPS; r += 1) {
      let a = 0;
      for (let i = 0; i < n; i += 1) a += pop.sample(rng);
      truth[r] = a / n;
    }

    /* 3 — the bootstrap resamples. Every value used here is a copy of one in
       `sample`; nothing new is drawn from the population past this point, which
       is the whole claim of the method. */
    const stats = new Array(params.reps);
    const picks = [];
    for (let r = 0; r < params.reps; r += 1) {
      const idx = rng.resample(n);
      stats[r] = meanAt(sample, idx);
      if (r < KEEP) picks.push(idx);
    }

    /* Fix the frame, not the data: the tallest stack any choreographed resample
       will produce, so the sample panel's scale is settled before the animation
       starts and cannot move under a half-built picture. */
    let maxPick = 1;
    for (const idx of picks) {
      for (const c of countsFrom(idx, n)) if (c > maxPick) maxPick = c;
    }

    const se = pop.sd / Math.sqrt(n);

    /* Centred on μ, not on the estimate. The pile sitting visibly off-centre is
       the lesson — a window centred on the estimate would put it in the middle
       every time and hide the one thing the bootstrap cannot do. Widened only
       when an unlucky sample would otherwise push it off the panel. Both this
       window and the population's are μ-centred, so μ occupies the same pixel
       column in every panel and one rule can carry it all the way down. */
    const hw = Math.max(4.5 * se, Math.abs(observed - pop.mean) + 3.6 * se);
    const domain = [pop.mean - hw, pop.mean + hw];
    const bins = binsFor(params.reps);

    return {
      pop, sample, picks, stats, observed, sampleSd, se, domain, bins, maxPick,
      hist: histogram(stats, domain, bins),
      truthDensity: densityCurve(truth, domain),
    };
  },

  /* --- animation -------------------------------------------------------- *
   * One logical unit is one resample: pick n observations with replacement,
   * collapse the copies to their mean, drop that number into the pile.       */

  animation: {
    /* TWO STAGES, two buttons, and the asymmetry between them IS the widget.
       You may press the first one exactly once — afterwards it greys out and
       only Reset brings it back, because in real life you cannot go back to the
       population for more data. You may press the second as often as you like,
       because resampling costs nothing but arithmetic. A student who has felt
       that difference in the buttons does not confuse the two loops. */
    leadLabel: "Sample",
    leadTitle: "Draw your one sample from the population — in real life you only ever get to do this once",
    /* WITHOUT THIS, TWO DEAD BUTTONS AND NO REASON. The lead greying out once
       used is the teaching; the other two greying out BEFORE it is used is not,
       and a reader cannot tell a control that is waiting from one that is
       broken. Three of the five lead-gated widgets said so and two did not. */
    leadHint: "Resample and Play wake up once you have drawn your sample.",
    stepLabel: "Resample",
    stepTitle: "Resample your own sample, with replacement — the population is out of reach now",
    runLabel: "Play",

    init({ params, state, fromScratch, leadDone }) {
      const anim = {
        pile: makeBootPile(state),
        /* Replay keeps a dealt sample: core passes `leadDone` back in, true
           when the reader replayed a finished animation that had already run
           the lead. Only Reset goes back to before it. */
        leadDone: Boolean(leadDone), //  core reads this: nothing else is available until it is true
        leadT: 0, //         0..1 progress of the one draw from the population
        phase: "pick", //    'pick' | 'collapse' | 'drop'
        phaseT: 0, //        0..1 within the current phase; 0 means idle
        sinceCommit: 0,
        streamFrom: -1,
        streamT: 0,
        done: false,
      };

      // Authored starting state, e.g. ?shown=400. Skipped on Replay: someone
      // pressing it wants to watch the thing get built. A figure that arrives
      // with resamples already in it necessarily has its sample already drawn.
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.reps);
      if (pre > 0) {
        anim.leadDone = true;
        anim.leadT = 1;
      }
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
      /* Stage one. Runs to completion and stops; there is nothing to repeat,
         which is the entire point of it being a separate action. */
      if (anim.mode === "lead") {
        if (anim.leadDone) return false;
        anim.leadT = Math.min(1, anim.leadT + dt / LEAD_MS);
        if (anim.leadT < 1) return true;
        anim.leadDone = true;
        return false;
      }

      // Core disables the other buttons until the sample exists, so this is a
      // guard against a programmatic play(), not something a click can reach.
      if (!anim.leadDone) return false;

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
    const { pop, sample, domain, hist } = state;
    const pile = anim.pile;
    const total = pile.shown;
    const inFlight = anim.phaseT > 0 && total < params.reps;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    const top = { x: ML, y: 26, w: plotW, h: 56 };
    const mid = { x: ML, y: top.y + top.h + 54, w: plotW, h: 92 };
    const bottomY = mid.y + mid.h + 56;
    const bottom = { x: ML, y: bottomY, w: plotW, h: Math.max(110, h - bottomY - 40) };

    /* -- upper panel: the population ------------------------------------ */
    const popYMax = pop.masses
      ? Math.max(...pop.masses.map((m) => m[1])) * 1.35
      : Math.max(...samplePdf(pop.pdf, pop.domain, 200).map((p) => p[1])) * 1.18;

    const pa = makePlot({ ctx, colors, rect: top, xDomain: pop.domain, yDomain: [0, popYMax] });

    /* -- one μ rule for the whole figure -------------------------------- *
     * Every window here is μ-centred by construction — populations declare a
     * half-width, not a domain, and the pile's window is built the same way — so
     * μ occupies the same pixel column in all three panels and ONE rule carries
     * it from top to bottom. Drawn first, so marks sit over it. */
    spanningRule(ctx, colors, {
      x: pa.sx(pop.mean),
      y0: top.y,
      y1: bottom.y + bottom.h,
      label: "μ",
    });

    pa.caption(
      anim.leadDone
        ? `Population — ${pop.label} · you never see this, and you cannot go back to it`
        : `Population — ${pop.label} · you never see this`
    );

    if (pop.masses) {
      pa.spikes(pop.masses, { fill: colors.ink3, opacity: 0.55, width: 14 });
    } else {
      const curve = samplePdf(pop.pdf, pop.domain, 300);
      pa.area(curve, { fill: colors.ink3, opacity: 0.12 });
      pa.curve(curve, { stroke: colors.ink3, width: 2 });
    }

    // The pile below magnifies a window around μ. Marking it turns a bare scale
    // change into a statement.
    pa.band(domain[0], domain[1], { fill: colors.empirical, opacity: 0.06, label: "shown below" });

    pa.axisX({ label: pop.masses ? "outcome" : "x" });

    /* -- middle panel: the one sample you actually have ------------------- */
    const ms = makePlot({
      ctx, colors, rect: mid, xDomain: pop.domain, yDomain: [0, state.maxPick + 1],
    });
    const revealed = anim.leadDone ? revealedCounts({ params, state, anim, inFlight }) : null;

    /* Three things this caption has to be honest about, in order of the run:
       the sample does not exist yet; it exists and is all you will ever get;
       and past KEEP resamples there are no retained pick indices, so there are
       no copies to show and it must not claim otherwise. That last case is also
       the settled figure a lesson publishes with ?shown=400, which makes it the
       right moment to say the thing the whole widget is arguing. */
    ms.caption(
      !anim.leadDone
        ? "Your sample — nothing drawn yet · in real life you get exactly one"
        : revealed
          ? inFlight
            ? "Your sample — resampling it with replacement"
            : "Your sample — the copies that produced the last resample"
          /* "uses" rather than "is built from": at the 900px frame the
             fingerprint harness records in, the side layout gives a 550px
             canvas and the longer form ran 36px off the end of it. caption()
             has no width to fall back to the way note() does. */
          : `Your sample — n = ${params.n}, drawn once · ` +
            "every resample uses these values and no others"
    );

    if (anim.leadDone) {
      drawSampleRow(ctx, ms, {
        colors,
        values: sample,
        counts: revealed ? revealed.counts : null,
        // Mid-collapse the copies are travelling, so they are drawn by the
        // choreography instead; only the parents stay put here.
        stacks: !revealed || anim.phase === "pick" || !inFlight,
        fade: inFlight ? 1 : 0.55,
      });

      /* Where your estimate actually comes from. In a settled figure this is the
         only mark tying the sample to the pile below: the pile is centred HERE,
         on the mean of these values, and not on the μ rule running past it. */
      ms.vline(state.observed, { stroke: colors.empirical, label: "x̄", align: "right" });
    }

    ms.axisX({ label: "observation value" });

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

    pile.draw(pb, f, { colors, smooth: params.smooth });

    /* The claim being checked is about the SHAPE of the bootstrap distribution,
       so it waits until there is a shape — the same threshold the histogram
       crossfade uses. A reference curve over six dots is a lie told with a
       spline, and this particular curve is the widget's whole argument.

       `--c-theory`, not `--c-reference`, and the two roles divide cleanly:
       reference carries a true PARAMETER (the μ rule) and theory carries the
       CURVE the pile is being checked against. That is the job `clt`'s normal
       overlay does in the same colour, so a student who learned "orange is what
       the pile should look like" in widget 2 meets the same convention here. It
       is also the payoff of this widget, and reference is `--ink-3` — the
       quietest ink in the system, and the first mark to vanish on a projector. */
    if (params.truth && f.barMix > 0) {
      const scale = total * hist.width;
      pb.curve(state.truthDensity.map(([x, d]) => [x, d * scale]), {
        stroke: colors.theory,
        width: 2,
        opacity: f.barMix,
      });
    }

    pb.axisY({ ticks, label: "count" });
    pb.axisX({ label: "resampled mean" });

    /* -- whichever stage is moving, across panel boundaries --------------- */
    if (!anim.leadDone && anim.leadT > 0) drawLeadInFlight({ ctx, colors, pa, ms, state, anim });
    if (inFlight && revealed) drawResampleInFlight({ ctx, colors, ms, pb, state, anim, revealed });
  },

  /* --- readout ---------------------------------------------------------- *
   * Two tile-pairs carrying three comparisons, because the middle one is the
   * answer to "when does the bootstrap fail":
   *
   *   μ, σ   vs  x̄, s      read DOWN the columns. x̄ vs μ is how far off your
   *                        estimate is; s vs σ is how representative your one
   *                        sample was, and it is the CAUSE of the pair below
   *   true SE vs bootstrap SE   agree exactly as well as s agrees with σ
   *
   * Packed two numbers to a tile rather than six tiles across, and not for
   * space: the readout grid fits five columns, so six tiles orphan the last one
   * onto its own row away from its partner — and adjacency IS the argument.
   * `clt` already reads this way with its "Population μ, σ" tile, so the arc
   * stays consistent.
   *
   * The truth comes first and your sample second, so the widget cannot be read
   * as "resampling recovers the answer". It recovers the uncertainty. Drag n
   * down and watch s pull away from σ and the two SEs pull apart with it.     */

  readout({ params, state, anim }) {
    const { pop, observed, sampleSd, se } = state;
    const pile = anim.pile;

    return [
      {
        label: "Population μ, σ",
        value: `${fmt(pop.mean)}, ${fmt(pop.sd)}`,
        note: "you never see these",
      },
      {
        label: "Your sample x̄, s",
        /* Blank until the sample has actually been drawn. `compute` knows these
           numbers from the first frame, and printing them would hand over the
           answer before the student has pressed anything — the readout is as
           capable of spoiling a figure as the figure is. */
        value: anim.leadDone ? `${fmt(observed)}, ${fmt(sampleSd)}` : "—",
        note: anim.leadDone ? "all you ever have" : "not drawn yet",
      },
      { label: "True SE", value: fmt(se, 3), note: "σ/√n" },
      {
        label: "Bootstrap SE",
        value: fmt(pile.sd, 3),
        note: `of ${pile.shown} resample${pile.shown === 1 ? "" : "s"}`,
      },
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
 * Which observations the resample in view has picked so far, and the mean it is
 * heading for.
 *
 * During `pick` the draws are revealed in order, so the count is partial. Once
 * picking is over the whole resample is present. Between steps this reports the
 * PREVIOUS resample, so the copies that produced the most recent dot stay on
 * screen to be counted at leisure.
 */
function revealedCounts({ params, state, anim, inFlight }) {
  const at = inFlight ? anim.pile.shown : anim.pile.shown - 1;
  const idx = state.picks[at];
  if (!idx) return null;

  const n = params.n;
  const done = inFlight && anim.phase === "pick"
    ? Math.floor(clamp01(anim.phaseT) * n)
    : n;

  return {
    counts: countsFrom(idx, n, done),
    mean: meanAt(state.sample, idx),
    partial: done < n,
  };
}

/**
 * The sample: the observations you were dealt along the baseline, and the copies
 * taken from them stacked directly above.
 *
 * An observation never picked dims to recessive ink rather than disappearing —
 * "this one contributed nothing to that resample" is as much a part of sampling
 * with replacement as the duplicates are.
 */
function drawSampleRow(ctx, plot, { colors, values, counts, stacks, fade }) {
  const { sx, sy } = plot;

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
 * Stage one: the single sample falling out of the population.
 *
 * Observations appear at their sampled values inside the POPULATION panel,
 * hold for a beat, then fall together into the sample row below. Drawn in
 * highlight while in flight and handed over to `drawSampleRow` in the empirical
 * colour once they land — "the thing to look at right now" becoming "what we
 * observed", which is exactly what has happened to them.
 *
 * Structurally this is the same fall as a resample's drop, and deliberately so.
 * What a student has to notice is only WHERE each stage draws from: this one
 * reaches into the panel above, and the next one never does again.
 */
function drawLeadInFlight({ ctx, colors, pa, ms, state, anim }) {
  const t = clamp01(anim.leadT);
  const popY = pa.bottom - 13;
  const rowY = ms.sy(0.5);
  // Both panels are plotted on the population's domain, so x never moves: this
  // is a pure vertical fall, and easeIn is what makes it read as falling.
  const fall = easeIn(clamp01((t - LEAD_FALL) / (1 - LEAD_FALL)));

  for (let i = 0; i < state.sample.length; i += 1) {
    // Stagger the appearance so a sample reads as n separate draws.
    const at = (i / state.sample.length) * LEAD_APPEAR;
    const grow = clamp01((t - at) / 0.1);
    if (grow <= 0) continue;
    pin(
      ctx, colors,
      pa.sx(state.sample[i]),
      popY + (rowY - popY) * fall,
      4.5 * grow,
      colors.highlight,
      1
    );
  }
}

/**
 * The three-phase choreography, drawn in absolute canvas pixels because it
 * crosses from the sample panel into the panel below.
 *
 *   pick     — copies appear above the observations they were taken from
 *   collapse — the copies slide together to their mean, labelled x̄*
 *   drop     — the single number falls into the slot it is about to occupy
 *
 * Deliberately the same shape as `clt`'s draw/collapse/drop. What differs is
 * where the copies come from, and that is the only thing a student should have
 * to notice.
 */
function drawResampleInFlight({ ctx, colors, ms, pb, state, anim, revealed }) {
  const t = clamp01(anim.phaseT);
  const dotY = ms.sy(1.5);

  ctx.save();

  if (anim.phase === "collapse") {
    // Every copy slides from its parent observation to the resampled mean. The
    // copies are the resample; the parents stay where they are.
    const e = easeOut(t);
    const target = ms.sx(revealed.mean);
    for (let i = 0; i < state.sample.length; i += 1) {
      const from = ms.sx(state.sample[i]);
      for (let k = 1; k <= revealed.counts[i]; k += 1) {
        pin(ctx, colors, from + (target - from) * e, ms.sy(k + 0.5), 4.5, colors.highlight, 1);
      }
    }
    if (e > 0.55) {
      label(ctx, colors, `x̄* = ${fmt(revealed.mean, 2)}`, target, dotY - 12, (e - 0.55) / 0.45);
    }
    ctx.restore();
    return;
  }

  if (anim.phase === "drop") {
    const value = state.stats[anim.pile.shown];
    const bin = anim.pile.binOf(value);
    const geom = {
      x0: ms.sx(value),
      y0: dotY,
      x1: pb.sx(value),
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
    label(ctx, colors, `x̄* = ${fmt(value, 2)}`, at[0], at[1] - 12, 1 - t / 0.3);
    pin(ctx, colors, at[0], at[1], 5, colors.highlight, 1);
  }

  ctx.restore();
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
 * two thousand simulated means on every parameter change. Binning spans the
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
