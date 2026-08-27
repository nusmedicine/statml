/* ============================================================================
   Power and error rates — widget 7, and the first past the agreed six.

   In LESSON order it sits between widgets 5 and 6 (PHM5003 03/04-02, "Decision
   Making", which follows 04-01 Significance and precedes the multiple-testing
   material). In BUILD order it is seventh, and the arc number says so rather
   than renumbering a shipped widget for the sake of gallery order.

   WHY IT EXISTS AT ALL: it replaces the `decision` Shiny app that 03/04-02
   currently links to (kennethban.shinyapps.io/decision). That app cold-starts
   for tens of seconds on the free tier and can sleep entirely mid-lecture.

   AND THE APP IS WRONG, which is the better reason. Its `plot_decision`
   computes the critical value as

       FP <- pnorm(qnorm(1-threshold), mean = 0, sd = sd, lower.tail = FALSE)

   `qnorm(1-threshold)` is the STANDARD normal quantile, so the critical value
   is pinned at 1.645 whatever `sd` is. Verified against the deployed app: at
   its defaults (d = 4, sd = 1.5, alpha = 0.05) it prints FP = 0.136 and
   FN = 0.058, exactly what that expression yields. The false positive rate it
   shows is therefore wrong for every sd except 1:

       sd    1     1.5     2      3
       app   .050  .136   .205   .292
       truth .050  .050   .050   .050

   The lesson prose inherits the error and states that larger variance makes the
   type I error rate rise, and the true negative rate fall. Neither happens.

   MISCONCEPTION TARGETED, and it is the one that bug teaches: that the two
   error rates are symmetric consequences of the same thing — that a noisier or
   smaller study is wrong more often in both directions. It is not.

       ALPHA IS CHOSEN. It is fixed by construction, whatever n and sigma do.
       BETA IS INHERITED. It is where every bit of the noise actually lands.

   TWO AXES, AND THE HISTORY IS THE DESIGN.

   Built first on the RAW difference of means, and it was confusing for a reason
   worth recording, because it recurs in any figure carrying a threshold: THE
   AXIS HELD TWO DIFFERENT KINDS OF QUANTITY. The control said alpha = 0.05 and
   the line it drew sat at 0.67 SD, with nothing on screen connecting them —
   0.05 is an AREA, 0.67 is a POSITION.

   Rebuilt on the TEST STATISTIC, which fixes that outright: the line sits at
   1.645 for alpha = 0.05 in every state, and the readout prints both numbers so
   the correspondence is stated rather than left to be guessed.

   AND THAT REBUILD INTRODUCED A WORSE PROBLEM, caught in review. Standardising
   DIVIDES THE SPREAD OUT: both curves become N(mu, 1), so n has nowhere left to
   act but position, and lambda = d*sqrt(n/2) is the only thing either data
   control touches. Changing the sample size then looks exactly like changing the
   effect size — and the sliding curve was labelled "the true effect", so it read
   as the effect having changed. For a widget whose entire job is showing what
   each control does, collapsing two of the three controls into one motion is a
   worse trade than the conflation it was meant to cure.

   SO BOTH ARE OFFERED, AND RAW IS THE DEFAULT:

       raw  effect moves the alternative's CENTRE
            n NARROWS both curves, centres fixed at 0 and d
            alpha moves the line
            -> three controls, three distinguishable motions

       z    effect and n both move the alternative, jointly, as d*sqrt(n/2)
            alpha moves the line, and NOTHING else moves the line
            -> the picture in which "only lambda matters" is visible: a small
               effect with a big study and a big effect with a small study are
               the SAME test

   They are one test drawn twice, and that is asserted by construction rather
   than by comment: the studies are stored ONCE as raw differences and `viewOf`
   derives z as difference/se, which is all standardising is. Verified — power,
   separation and the observed rate are identical on both axes at every n.
   Flipping the toggle is therefore a picture of the standardisation 03/04-01
   teaches, not a second simulation.

   BOTH WINDOWS ARE FIXED, for opposite reasons. See WINDOWS below. The raw one
   also has to size its BINS to the standard error, because a pinned window plus
   a pinned bin count collapses the pile to five bars at n = 100.

   THE AREAS ARE THE SUBJECT, AND AREAS ARE A BAD ENCODING.

   Two shaded regions can change a great deal and look identical — area sits at
   the bottom of the perceptual ranking, well below position and length. So
   every area on the curves is repeated as a LENGTH ON A COMMON SCALE in the two
   proportion bars below, which is where a change is actually seen. The Shiny
   app hits the same wall and bolts a bar chart underneath for the same reason.

   RED MEANS "CALLED SIGNIFICANT" IN BOTH BARS, and that is the sharpest thing
   here. The red fraction of bar one is alpha; the red fraction of bar two is
   power. Same decision, same colour, two different worlds — so the pair reads
   as "how often do I call this significant when there is nothing, versus when
   there is something", which is what alpha and power ARE. Colouring by
   correctness instead would flip the meaning of red between the bars and
   destroy that reading.

   THE SIMULATION IS DEMOTED TO PROOF. The planning calculation is deterministic
   — pick alpha, d and n and the two rates follow — so there is nothing to
   DISCOVER by running studies, only to confirm. It keeps the bottom third and
   starts empty, so it is a second stage you press into rather than the subject.
   What it still buys is the one thing arithmetic cannot assert: that these
   areas are genuinely long-run rates.

   OTHER THINGS WORTH KNOWING:

   - ALPHA IS A DISPLAY PARAMETER. It changes the decision, not the data, so you
     can run a thousand studies and then slide the threshold and watch the SAME
     studies get reclassified in place — measured, 51 -> 254 significant with
     the count untouched. A data parameter would clear the pile at exactly the
     moment the comparison became available (principle 3.2).

   - NOTHING IS FAKED. A study is n observations per group drawn from a real
     population and a real difference of means, divided by the standard error.

   - THE TEST IS A Z-TEST ON KNOWN SIGMA, and here that is not the fiction it
     was in widget 3. The Neyman-Pearson PLANNING phase assumes a sigma — that
     is what a power calculation is — so using it is what makes the central
     claim provable on screen rather than approximate.

   - ONE-SIDED, matching the app being replaced. Two lines and four tails make
     the picture busy for no gain: the asymmetry the widget exists to teach is
     identical either way. The caption says which it is.
   ========================================================================= */

import {
  defineWidget, EFFECT_SD, fmt,
  normalPdf, makePlot, niceTicks, spanningRule,
  createPile, binsFor, barMixFor,
} from "../core/index.js";

/* Effects are in SD units, so fixing the population SD at 1 makes the effect
   and Cohen's d one and the same number. */
const SIGMA = 1;

/* A THOUSAND, AND THE NUMBER WAS MEASURED RATHER THAN CHOSEN.

   At 400 the standard error of an observed 5% rate is 1.1 points, so a sweep
   across n = 3, 12, 30, 100 with the null true produced 6.0%, 5.8%, 4.0%, 3.3%.
   Every one is statistically consistent with exactly 0.05 — and read left to
   right they look exactly like a rate FALLING with sample size, which is the
   precise opposite of what this widget exists to say. */
const REPS = 1000;

/* TWO COORDINATE SYSTEMS FOR ONE TEST, and BOTH WINDOWS ARE FIXED.

   Fixed is the whole point in each case, for opposite reasons:

     raw  the curves NARROW as n grows while their centres stay at 0 and d. A
          window fitted to the standard error would rescale in step and hold the
          curves at a constant apparent width — hiding the one thing this axis
          exists to show.
     z    standardising divides the spread out, so both curves are N(mu, 1) and
          only the alternative's POSITION can move. A fitted window would put
          the line at a new pixel on every change.

   Raw bounds are computed, not guessed: across every effect (0 to 1.3 SD), every
   n (3 to 100) and every alpha, the curves and critical values need lo <= -2.94
   and hi >= 4.24. At n = 100 a curve is 14% of the panel wide, which is narrow —
   and being able to SEE that against n = 3 is the reason the window is pinned. */
const WINDOWS = {
  raw: { lo: -3.0, hi: 4.3, label: "difference between the two group means (SD units)" },
  z: { lo: -4.2, hi: 7.4, label: "test statistic — standard errors from zero" },
};

/* The two figure heights, named so `height` and `draw` cannot disagree about
   which one is in force — principle 5.8.

   `compact` is 400 rather than the ~326 the panels strictly need, and the extra
   goes to the curves panel. It was originally sized to fill a ~460px control
   rail; gating seed and speed behind the Simulate button cut the rail to 333, so
   the figure now sets the split's height rather than absorbing slack. 400 is
   kept anyway, deliberately: the whole widget still fits one screen at 838px
   (788 once the draft bar goes), and a taller curves panel is what survives the
   back row, which is the governing surface (prd §3). */
const PANELS = { full: 590, compact: 400 };

const SPEEDS = {
  slow: { label: "Slow", detail: "each study drawn and dropped", ms: 900, choreo: true },
  medium: { label: "Medium", detail: "each study drawn and dropped", ms: 340, choreo: true },
  /* 8 ms rather than 22: at REPS = 1000 the slower figure made Play a
     twenty-two second wait, longer than any lecture will give it. */
  fast: { label: "Fast", detail: "arrivals only, no flight", ms: 8, choreo: false },
};

/* THE SAME NAMED LEVELS AS WIDGET 5, and sharing `EFFECT_SD` is not tidiness —
   two widgets in one arc must not disagree about what "Small" means. A student
   who met Small as 0.4 SD in the permutation test meets the same 0.4 SD here.

   The sample sizes are computed, not guessed: n = 2((z_alpha + z_0.8)/d)^2 at
   alpha = 0.05 one-sided, the calculation `pwr.t.test` does in the lesson. They
   sit in the detail line so the control TEACHES SAMPLE SIZE FOR FREE — the same
   move widget 5 makes with its detection rates. */
const EFFECTS = {
  none: {
    label: "None", sd: EFFECT_SD.none,
    detail: "no difference at all — every significant study is a false positive",
  },
  small: {
    label: "Small", sd: EFFECT_SD.small,
    detail: "0.4 SD — needs about 78 per group for 80% power",
  },
  moderate: {
    label: "Moderate", sd: EFFECT_SD.moderate,
    detail: "0.9 SD — needs about 16 per group",
  },
  large: {
    label: "Large", sd: EFFECT_SD.large,
    detail: "1.3 SD — needs about 8 per group",
  },
};

/* One-sided standard-normal quantiles, written out rather than inverted at
   runtime. The levels are a fixed list, so a table is exact where an inverse
   normal would be an approximation, and it keeps a root-finder out of core for
   five numbers. 0.001 / 0.05 / 0.25 are the three the lesson compares as
   "stringent / baseline / lax"; 0.01 and 0.10 are what people reach for between.

   ALL FIVE CARRY A `detail`, AND TWO OF THEM DID NOT UNTIL THE LINE BECAME
   VISIBLE. `detail` used to render into a `title` tooltip, so an empty one cost
   nothing; now that it is a line under the row, an empty one collapses it and
   the whole control block jumps a line taller and shorter as you click along
   the ladder. A ladder with two rungs missing is also just worse copy.

   IN THIS COORDINATE SYSTEM THE `z` IS THE LINE'S POSITION OUTRIGHT — no
   standard error multiplies it — which is the whole reason the axis changed. */
const ALPHAS = {
  "0.001": { label: "0.001", a: 0.001, z: 3.090232306167813, detail: "stringent" },
  "0.01": { label: "0.01", a: 0.01, z: 2.326347874040841, detail: "stricter than the convention" },
  "0.05": { label: "0.05", a: 0.05, z: 1.644853626951472, detail: "the convention, and only a convention" },
  "0.10": { label: "0.10", a: 0.10, z: 1.281551565544600, detail: "laxer than the convention" },
  "0.25": { label: "0.25", a: 0.25, z: 0.674489750196082, detail: "lax" },
};

const clamp01 = (t) => Math.max(0, Math.min(1, t));
/* A study falls into the pile, so it accelerates downward — principle 4.3. */
const easeIn = (t) => t * t;

/**
 * Standard normal CDF, Abramowitz & Stegun 7.1.26. |error| < 1.5e-7, four
 * orders of magnitude finer than anything this widget prints.
 *
 * Local rather than in core deliberately: there is exactly one consumer, and
 * the rule this project works to is that the SECOND consumer tells you where a
 * seam belongs. Move it when something else needs it.
 */
function normalCdf(z) {
  const s = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}

/**
 * Power: the share of the alternative that clears the line.
 *
 * When lambda = 0 this returns alpha exactly, and that identity is worth
 * leaving visible rather than special-casing — with nothing to find, "power" is
 * just the test firing at the rate you set it to.
 */
const powerOf = (state, params) => 1 - normalCdf(ALPHAS[params.alpha].z - state.lambda);

/**
 * EVERYTHING THE TWO AXES DISAGREE ABOUT, in one place — principle 5.8. The
 * curves, the pile's binning, the critical line, the flying dot and the axis
 * label all read from this, so the two coordinate systems cannot drift apart.
 *
 * The studies themselves are stored once, as raw differences. z is that divided
 * by the standard error, which is all standardising IS, and deriving it here
 * rather than storing a second copy is what guarantees the toggle shows the
 * same studies rather than a second simulation of them.
 */
function viewOf(state, params) {
  const z = params.axis === "z";
  const win = WINDOWS[z ? "z" : "raw"];
  const sd = z ? 1 : state.se;

  /* BINS FOLLOW THE SPREAD, because the WINDOW is pinned.

     On the standardised axis the pile is always one SE wide inside an 11.6-wide
     window, so the arc's shared `binsFor(total)` is already right — 44 bins puts
     about 23 across the visible mass at every setting.

     On the raw axis the pile narrows with n inside a window that deliberately
     does not, so a fixed bin COUNT makes the resolution collapse exactly where
     the lesson is: measured, 44 bins gives 29 bins of visible mass at n = 3 but
     only 5 at n = 100, which is a bar chart rather than a distribution. Sizing
     the bins to the standard error instead holds roughly 22 across the visible
     mass at every n, so the pile still reads as a shape while genuinely
     shrinking against the fixed axis. Capped so a bar never goes sub-pixel. */
  const bins = z
    ? binsFor(REPS)
    : Math.max(binsFor(REPS), Math.min(240, Math.round((22 * (win.hi - win.lo)) / (6 * sd))));

  return {
    lo: win.lo,
    hi: win.hi,
    axisLabel: win.label,
    bins,
    width: (win.hi - win.lo) / bins,
    sd,
    altMu: z ? state.lambda : state.d,
    crit: ALPHAS[params.alpha].z * (z ? 1 : state.se),
    valueAt: (i) => (z ? state.diffs[i] / state.se : state.diffs[i]),
    isZ: z,
  };
}

/** Expected count per bin at the peak of the alternative, for axis headroom. */
function theoryPeak(total, state, params) {
  const v = viewOf(state, params);
  return total * v.width * normalPdf(v.altMu, v.altMu, v.sd);
}

function makePile(state, params) {
  const v = viewOf(state, params);
  return createPile({
    bins: v.bins,
    lo: v.lo,
    width: v.width,
    // Room for the overlay, but only once it is actually drawn. Same shape as
    // widget 2's, the only other pile in the arc carrying a curve.
    headroomFor: (total) => (params.theory ? theoryPeak(total, state, params) * barMixFor(total) : 0),
  });
}

/**
 * Fold study `i` into the pile, keeping the past-the-line count in step.
 * Counted PER BIN as values arrive rather than derived from bin centres at
 * paint time — the same rule widget 5 records, and for the same reason:
 * quantising the boundary bin would let a student count a different number of
 * red marks than the readout reports.
 */
function push(anim, state, params, i) {
  const v = viewOf(state, params);
  const value = v.valueAt(i);
  const bin = anim.pile.push(value);
  if (value >= v.crit) {
    anim.hits += 1;
    if (bin >= 0) anim.tail[bin] += 1;
  }
}

function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  anim.fly = null;
  anim.pile.clearFlash();
  return false;
}

defineWidget({
  slug: "power-and-error",
  status: "shipped",
  /* "Decision Making" aligns with the lesson's own topic name (03/04-02). The
     slug stays `power-and-error` until the course ends — the URL has been given
     to students. */
  title: "Decision Making",
  subtitle:
    "A hypothesis test is a decision with four possible outcomes: true and " +
    "false positives, true and false negatives. The significance threshold " +
    "fixes the false positive rate; power depends on the effect size and the " +
    "sample size.",
  /* Controls beside the figure, so the thing you change and the 2x2 it changes
     are on screen together. Measured before: the control block sat 848px above
     the table, which meant scrolling back past the whole figure to move a
     slider. Opt-in, so no other widget's canvas moves. */
  layout: "side",

  /* HEIGHT FOLLOWS THE STUDIES TOGGLE. A panel that can be hidden has to give
     its pixels back, or the toggle only trades a chart for the same amount of
     blank canvas and the page is exactly as tall as it was. */
  height: ({ studies }) => (studies ? PANELS.full : PANELS.compact),

  params: {
    effect: {
      type: "choice",
      label: "True effect",
      options: Object.entries(EFFECTS).map(([value, e]) => ({ value, label: e.label, detail: e.detail })),
      default: "moderate",
    },

    /* 3 to 100 per group. Effect and n act ONLY together, as lambda =
       d*sqrt(n/2), which is why the readout names lambda outright:

         lambda     n=3    n=12   n=30   n=100
         None       0.00   0.00   0.00   0.00    <- pinned, and that IS the thesis
         Small      0.49   0.98   1.55   2.83
         Moderate   1.10   2.20   3.49   6.36
         Large      1.59   3.18   5.03   9.19    <- off-panel past n = 65

       The ceiling is 100 rather than 60 so Small can reach the conventional 80%
       (n = 78): "even a small effect is findable, it just costs 78 per arm" is
       a better lesson than a curve that never gets there. */
    n: { type: "int", label: "Samples per group", min: 3, max: 100, default: 12 },

    /* DISPLAY, not data, and this is the widget's best control. Alpha changes
       the decision rule, never the observations — so a student can build a
       thousand studies and then slide the threshold, and the same dots get
       reclassified in place. Marking it `data` would clear the pile at exactly
       the moment the comparison became worth making. */
    alpha: {
      type: "choice",
      label: "Threshold α",
      options: Object.entries(ALPHAS).map(([value, x]) => ({ value, label: x.label, detail: x.detail })),
      default: "0.05",
      display: true,
    },

    /* TWO READINGS OF ONE TEST, and a segmented control because both are worth
       seeing at rest (principle 3.3) — this is not a magnitude.

       RAW IS THE DEFAULT, and the reason is that this widget's job is showing
       what each control does. On the raw axis the three controls have three
       distinguishable motions: effect moves the alternative's centre, n narrows
       BOTH curves, alpha moves the line. Standardising divides the spread out,
       so on the z axis both curves are N(mu, 1) and n has nowhere to act but
       position — which makes changing the sample size look exactly like
       changing the effect size. That was caught in review and it is a worse
       confusion than the one the z axis was introduced to fix.

       z earns its place as the second reading rather than the first: it is
       where "only lambda matters" becomes visible — a small effect with a big
       study and a big effect with a small study are the SAME test — and it is a
       picture of the standardisation 03/04-01 teaches. Flip between them and
       the overlap, the power and the 2x2 are identical, which is the point. */
    axis: {
      type: "segmented",
      label: "Read the axis as",
      options: [
        { value: "raw", label: "Difference", detail: "raw units — n narrows both curves" },
        { value: "z", label: "Test statistic", detail: "standardised — n slides the alternative" },
      ],
      default: "raw",
      display: true,
    },


    /* THE SIMULATION, OFF BY DEFAULT — the last step of demoting it to proof.
       The planning calculation is deterministic: pick alpha, d and n and the two
       rates follow, so the curves and the 2x2 are the whole answer and running a
       thousand studies only CONFIRMS it.

       HIDDEN AS A FIELD, and driven by the Simulate button in the drive row
       instead (see `animation.gate`). Entering the simulation is an ACTION, and
       a checkbox in the setup rail said the opposite — it sat among the things
       you configure before doing anything, next to two more controls (seed and
       speed) that meant nothing until it was ticked. It is still a real
       parameter, so `?studies=1` reproduces the stage in a shared link.

       Display-only, so leaving the simulation does not throw away studies
       already run — press Simulate again and they are still there. */
    studies: {
      type: "gate",
      label: "Simulate to check",
      labelOff: "Hide simulation",
      detail: "run studies and see whether those really are the long-run rates",
      default: false,
      display: true,
    },
    seed: {
      type: "int", label: "Seed", min: 1, max: 200, default: 1,
      when: { param: "studies" },
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
      when: { param: "studies" },
    },

    /* The prediction, drawn over the pile it predicts. Off is a real teaching
       move rather than a tidy-up — hide it and ask the room where the studies
       should pile up before showing them. Same control, default and name as
       widget 2's, because it is the same idea a second time. */
    theory: {
      type: "bool", label: "Expected shape", default: true, display: true,
      /* Gated with the rest: it draws the expected curve OVER THE PILE and does
         nothing else, so with the simulation shut it was a control with no
         referent on screen. Caught in review, not by me. */
      when: { param: "studies" },
    },

    /* BOTH GATED ON `studies`. A seed with nothing random on screen and a play
       speed with nothing playing are controls that carry no idea at rest, which
       is what principle 3.5 rules out — and in a one-column rail they were 121px
       of the height that made the widget need scrolling in the first place. */
    shown: { type: "int", label: "Pre-run studies", min: 0, max: REPS, default: 0, hidden: true },
  },

  legend: [
    { token: "group-a", label: "If there were no effect — the curve the test is built from, and it never moves", mark: "line" },
    { token: "group-b", label: "The world you set — d√(n/2) standard errors along", mark: "line" },
    { token: "extreme", label: "Called significant — a false positive on the left, a real detection on the right", mark: "bar" },
    { token: "empirical", label: "A study that came out under the line", mark: "bar" },
  ],

  compute: ({ params, rng }) => {
    const d = EFFECTS[params.effect].sd * SIGMA;
    const n = params.n;
    /* Standard error of a DIFFERENCE of two means, which is what a study
       reports and what the statistic is measured in. */
    const se = SIGMA * Math.sqrt(2 / n);
    /* THE ONE NUMBER effect AND n JOINTLY PRODUCE. Everything the alternative
       does on screen is this and nothing else. */
    const lambda = d / se;

    /* A real study: n observations per group and a real difference of means.
       Stored RAW, once — the test statistic is this divided by `se`, derived in
       `viewOf`, so switching axes cannot silently become a different
       simulation. Drawing the difference straight from N(d, se) would be one
       line and give the same picture, but then "what is one dot" has no honest
       answer. */
    const diffs = new Float64Array(REPS);
    for (let s = 0; s < REPS; s += 1) {
      let sa = 0;
      let sb = 0;
      for (let i = 0; i < n; i += 1) {
        sa += rng.normal(0, SIGMA);
        sb += rng.normal(d, SIGMA);
      }
      diffs[s] = sb / n - sa / n;
    }

    return { d, n, se, lambda, diffs };
  },

  animation: {
    stepLabel: "New study",
    stepTitle: "Run one more study and see which side of the line it lands on",
    runLabel: "Play",

    /* `hits`, not `done` as a counter. Core reads a truthy `anim.done` as
       "finished" and answers the next click with Replay, so a widget that
       counts in it replays instead of advancing — widget 4 shipped with exactly
       that bug and the trap list still carries it. */
    init: ({ params, state, fromScratch }) => {
      const anim = {
        pile: makePile(state, params),
        tail: new Array(viewOf(state, params).bins).fill(0),
        hits: 0,
        fly: null,
        t: 0,
        done: false,
      };
      const pre = fromScratch ? 0 : Math.min(params.shown, REPS);
      for (let i = 0; i < pre; i += 1) push(anim, state, params, i);
      anim.pile.clearFlash();
      anim.done = anim.pile.shown >= REPS;
      return anim;
    },

    advance: (anim, { dt, params, state }) => {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const stepping = anim.mode === "step";
      // A step always shows the flight; only Play gives it up, and only at the
      // speed that declares it does.
      const choreo = stepping || speed.choreo;

      /* A study can be in flight when the uncoreographed path takes over —
         press "Run a study" and then Play at Fast. That path never advances
         `fly.t`, so the dot would hang in mid-air for the rest of the run. Same
         reason the landing flash is cleared on halt: a frozen transient stops
         reading as motion and starts reading as a state. */
      if (!choreo) anim.fly = null;

      if (choreo) {
        if (anim.pile.shown >= REPS) return halt(anim, { finished: true });
        if (!anim.fly) anim.fly = { i: anim.pile.shown, t: 0 };

        anim.fly.t += dt / Math.max(1, stepping ? SPEEDS.medium.ms : speed.ms);
        if (anim.fly.t < 1) return true;

        push(anim, state, params, anim.fly.i);
        anim.fly = null;
        if (anim.pile.shown >= REPS) return halt(anim, { finished: true });
        if (stepping) return halt(anim);
        return true;
      }

      anim.t += dt;
      while (anim.t >= speed.ms && anim.pile.shown < REPS) {
        anim.t -= speed.ms;
        push(anim, state, params, anim.pile.shown);
      }
      if (anim.pile.shown >= REPS) return halt(anim, { finished: true });
      return true;
    },

    /* Called when a display parameter changes. For alpha that is the whole
       trick: the studies are untouched, so the invariant is HOW MANY have been
       run, and everything downstream of the threshold is replayed from that. */
    rebuild: (anim, { params, state }) => {
      const drawn = Math.min(anim.pile.shown, REPS);
      anim.pile = makePile(state, params);
      anim.tail = new Array(viewOf(state, params).bins).fill(0);
      anim.hits = 0;
      for (let i = 0; i < drawn; i += 1) push(anim, state, params, i);
      anim.pile.clearFlash();
      anim.fly = null;
      anim.done = anim.pile.shown >= REPS;
    },
  },

  /* --- drawing ---------------------------------------------------------- *
   *   curves   the two distributions and the decision rule
   *   bars     the same areas as LENGTHS, which is where change is seen
   *   studies  the ones you actually ran, same axis, starting empty          */

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const padL = 58;
    const padR = 18;
    const W = w - padL - padR;

    const { lambda } = state;
    const alpha = ALPHAS[params.alpha];
    const power = powerOf(state, params);
    const v = viewOf(state, params);
    const zc = v.crit;
    const Z_LO = v.lo;
    const Z_HI = v.hi;

    const showPile = params.studies;

    const topY = 30;
    const gridHeight = 92;
    /* With the pile hidden the curves take the space it gave up, rather than
       the figure simply ending sooner — see PANELS. */
    const topH = showPile ? 128 : h - gridHeight - 4 - topY - 46;
    /* The 2x2 sits at the FOOT, under the studies when they are shown, because
       it summarises both halves: the row you are in is what the curves show, the
       column you land in is what the pile counts. Between them it would have
       separated the two panels that share an axis. */
    const gridH = gridHeight;
    const gridY = h - gridH - 4;
    const pileY = topY + topH + 46;
    const pileH = showPile ? Math.max(80, gridY - pileY - 52) : 0;

    const xDomain = [Z_LO, Z_HI];
    const ticks = niceTicks(Z_LO, Z_HI, 7);

    /* --- the two distributions ------------------------------------------- */

    const peak = normalPdf(0, 0, v.sd);
    const pt = makePlot({
      ctx, colors,
      rect: { x: padL, y: topY, w: W, h: topH },
      xDomain, yDomain: [0, peak * 1.2],
    });

    pt.axisX({ ticks, label: "" });

    const dens = (mu) => {
      const out = [];
      for (let i = 0; i <= 260; i += 1) {
        const x = Z_LO + ((Z_HI - Z_LO) * i) / 260;
        out.push([x, normalPdf(x, mu, v.sd)]);
      }
      return out;
    };
    // A partial curve, so a shaded region stops exactly on the line.
    const densFrom = (mu, from, to) => {
      const out = [[from, 0]];
      for (let i = 0; i <= 180; i += 1) {
        const x = from + ((to - from) * i) / 180;
        out.push([x, normalPdf(x, mu, v.sd)]);
      }
      out.push([to, 0]);
      return out;
    };

    /* The two shaded areas ARE the two error rates, and they are the regions
       the Shiny app shades — those were right, only its arithmetic was not.

       alpha: the null's tail PAST the line. Red, because `--c-extreme` means
              "past a threshold" everywhere else in the arc.
       beta:  the alternative's mass SHORT of the line. It keeps its own curve's
              colour rather than borrowing red, because a miss is not an extreme
              — it is the opposite failure and must not read as the same one. */
    pt.area(densFrom(0, zc, Z_HI), { fill: colors.extreme, opacity: 0.42 });
    if (lambda > 0) pt.area(densFrom(v.altMu, Z_LO, zc), { fill: colors.groupB, opacity: 0.13 });

    pt.curve(dens(0), { stroke: colors.groupA, width: 2 });
    if (lambda > 0) pt.curve(dens(v.altMu), { stroke: colors.groupB, width: 2 });

    /* Past the right edge the alternative is unmissable rather than broken, and
       says so — the treatment widget 6 gives a bar taller than its panel.
       Silent clipping reads as a bug; a labelled arrow reads as a fact. */
    if (v.altMu > Z_HI) {
      ctx.save();
      ctx.font = `600 ${colors.fsXs} ${colors.font}`;
      ctx.fillStyle = colors.groupB;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`the alternative — off the panel, at ${v.altMu.toFixed(1)} →`, pt.x + pt.w - 6, pt.sy(peak * 0.62));
      ctx.restore();
    }

    /* --- the four outcomes, named and measured ---------------------------- *
     * Drawn last in reading order but computed here. See drawOutcomeGrid.    */

    drawOutcomeGrid(ctx, colors, {
      x: padL, y: gridY, w: W, h: gridH, alpha: alpha.a, power, lambda,
    });

    /* --- the studies you ran ---------------------------------------------- */

    const pile = anim ? anim.pile : null;
    const f = pile ? pile.frame() : { yMax: 14, barMix: 0, smoothMix: 0, total: 0 };
    const shown = pile ? pile.shown : 0;

    const pp = makePlot({
      ctx, colors,
      rect: { x: padL, y: pileY, w: W, h: Math.max(1, pileH) },
      xDomain, yDomain: [0, f.yMax],
    });

    if (showPile) {
      pp.grid(niceTicks(0, f.yMax, 4));
      pp.axisY({ ticks: niceTicks(0, f.yMax, 4), label: "studies" });
      pp.axisX({ ticks, label: v.axisLabel });
      // The reject region, washed in behind everything so the line has a side.
      pp.band(zc, Z_HI, { fill: colors.extreme, opacity: 0.04 });
    } else {
      /* With the pile hidden the top panel is the only one on this axis, so it
         has to carry the axis label the pile was carrying. */
      pt.axisX({ ticks, label: v.axisLabel });
    }

    if (showPile && pile && shown > 0) {
      pile.draw(pp, f, { colors, smooth: false });
      /* The past-the-line bins overdrawn, so the counted marks sit on top of
         the ordinary ones — the technique the pile uses for its landing flash,
         and what widget 5 does for its tail. */
      const opts = { lo: pile.lo, width: pile.width, fill: colors.extreme };
      if (f.barMix > 0) pp.bars(anim.tail, { ...opts, opacity: f.barMix });
      if (f.barMix < 1) pp.dotColumns(anim.tail, { ...opts, opacity: 1 - f.barMix, maxR: 6 });

      /* The alternative again, over the pile it predicts, in expected-count
         units. Without it nothing on screen says WHICH curve the histogram came
         from — the first person to read the finished widget asked exactly that,
         and the flying dot answers it only while something is moving, which a
         published `?shown=` figure never is.

         Gated on `barMix`, so it waits for roughly thirty studies: principle
         2.4, a theoretical claim has a threshold, and scaled to five studies it
         peaks below one count and is a squiggle rather than a prediction. */
      if (params.theory && f.barMix > 0) {
        const pts = [];
        for (let i = 0; i <= 240; i += 1) {
          const x = Z_LO + ((Z_HI - Z_LO) * i) / 240;
          pts.push([x, shown * pile.width * normalPdf(x, v.altMu, v.sd)]);
        }
        /* Whichever curve is ACTUALLY DRAWN above. At effect = None the two
           coincide, the top panel draws one curve and draws it blue, and an
           amber overlay here would be the only amber on screen — implying a
           second distribution in the one case whose whole point is that there
           is only one. */
        pp.curve(pts, { stroke: lambda > 0 ? colors.groupB : colors.groupA, width: 2, opacity: f.barMix });
      }
    }

    /* --- the decision, as one line through every panel -------------------- */

    /* THE HEAVIEST MARK IN THE FIGURE, deliberately. It is the decision itself,
       it is the only thing the panels share, and at `--c-reference` width 1 it
       was a grey hairline that disappeared at arm's length — the exact failure
       prd §3 names. Red rather than grey because everything past it is red: the
       line and the region it creates are one idea.

       It carries its own VALUE as well as its name, which the raw-difference
       version could not do honestly: here the number is fixed by alpha alone,
       so printing both closes the gap that made the old axis confusing. */
    /* TWO SEGMENTS, NOT ONE, and the gap is the point. The rule may only cross
       panels that share the z axis — the curves and the pile. The rate bars in
       between are a 0-100% scale, so a vertical line at z = 1.64 lands at an
       arbitrary place in them and silently implies the three panels share one
       axis. Caught on screen: the bar split sat at 71% while the rule crossed
       at 50%, two unrelated positions reading as one coordinate. */
    const rule = (y0, y1, label) => spanningRule(ctx, colors, {
      x: pt.sx(zc), y0, y1, label,
      stroke: colors.extreme,
      width: 2,
      dash: [6, 4],
    });
    /* Starting at topY + 2 rather than above the panel: `caption` occupies the
       strip immediately above it, and the rule's label was landing in the same
       row. Inside the panel the label clears the curves, whose peak sits about
       a fifth of the way down. */
    rule(topY + 2, topY + topH, `α = ${alpha.label} → ${v.isZ ? "z = " : ""}${zc.toFixed(2)}`);
    if (showPile) rule(pileY, pileY + pileH);

    /* DRAWN AFTER THE RULE, for the same reason the captions are: the halo
       below only protects text that is painted last, and the dashed rule was
       cutting straight through "the true effect" whenever the threshold sat
       left of the alternative's peak — which is most states.

       Labels sit ON their curve rather than above it: above the peak put the
       alternative's label straight into the rule's, and at high n the two peaks
       converge anyway, so crowding is worst exactly where the figure is
       busiest. The halo is the one `caption` uses. */
    ctx.save();
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.surface;
    const tag = (text, mu, fill) => {
      const px = pt.sx(mu);
      const py = pt.sy(peak * 0.62);
      ctx.strokeText(text, px, py);
      ctx.fillStyle = fill;
      ctx.fillText(text, px, py);
    };
    tag("no effect", 0, colors.groupA);
    /* "the true effect" is only honest on the RAW axis, where that curve really
       does sit at d and stays there. On the standardised axis it sits at
       d*sqrt(n/2), so calling it the effect is exactly what made changing n look
       like changing the effect. */
    if (lambda > 0 && v.altMu <= Z_HI) {
      tag(v.isZ ? "the alternative" : "the true effect", v.altMu, colors.groupB);
    }
    ctx.restore();

    /* CAPTIONS LAST, and the order is load-bearing. `caption()` draws a surface
       halo precisely so a figure-spanning rule can pass behind it — which does
       nothing if the rule is painted after. Widget 3 has always ordered it this
       way; this is the second widget to need it. */
    pt.caption(
      lambda === 0
        ? `No effect, so there is only ONE curve — and ${alpha.label} of it still lands past the line`
        : v.isZ
          ? `Standardised: both curves are one SE wide, so n can only SLIDE the alternative — to ${lambda.toFixed(2)}`
          : `Raw units: the centres stay at 0 and ${state.d.toFixed(1)} SD, and n NARROWS both curves — SE is now ${state.se.toFixed(3)}`
    );
    if (showPile) {
      pp.caption(
        shown === 0
          ? "Run studies to check those really are the long-run rates — none yet"
          : lambda === 0
            ? `${fmt(shown, 0)} studies, and there is nothing to find in any of them`
            : `${fmt(shown, 0)} studies, all of them from a world where the effect is real`
      );
    }

    /* --- the study in flight ---------------------------------------------- *
     * It appears ON the curve it was drawn from and falls through the line into
     * the pile. That fall IS the decision: the dot does not choose a side, its
     * value already did.                                                      */
    if (showPile && anim?.fly) {
      const value = v.valueAt(anim.fly.i);
      const t = easeIn(clamp01(anim.fly.t));
      const x = Math.max(pt.x, Math.min(pt.x + pt.w, pt.sx(value)));
      const y0 = pt.sy(normalPdf(value, v.altMu, v.sd));
      const bin = anim.pile.binOf(value);
      const y1 = bin >= 0 ? pp.sy(anim.pile.counts[bin] + 1) : pp.bottom;

      ctx.save();
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.arc(x, y0 + (y1 - y0) * t, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  /* Prediction beside observation — principle 2.7. The first two tiles are the
     argument sitting next to each other: one never moves when you change n, and
     the other is nothing but the consequence of n. */
  readout: ({ params, state, anim }) => {
    const shown = anim ? anim.pile.shown : 0;
    const hits = anim ? anim.hits : 0;
    const alpha = ALPHAS[params.alpha];
    const power = powerOf(state, params);
    const real = state.lambda > 0;
    const view = viewOf(state, params);

    return [
      /* THE NOTE MUST BE HONEST ON BOTH AXES, and they say different things.
         On the standardised axis the line genuinely never moves. On the raw
         axis it does — the critical DIFFERENCE shrinks as n grows, which is
         exactly why bigger studies detect smaller effects. What is fixed on
         both is alpha itself, and saying "no sample size moves it" while the
         line visibly slid would be the kind of caption this project has already
         shipped twice and had to fix. */
      {
        label: "False positive rate α",
        value: alpha.label,
        note: view.isZ
          ? `the line sits at z = ${alpha.z.toFixed(2)} — nothing but α moves it`
          : `α is fixed; the difference needed to clear it is ${view.crit.toFixed(2)} and shrinks with n`,
      },
      {
        label: real ? "Power to detect it" : "Nothing to detect",
        value: real ? power.toFixed(2) : "—",
        note: real
          ? `so ${Math.round(100 * (1 - power))}% of real effects are missed`
          : `with no effect, "power" is just α firing at ${alpha.label}`,
      },
      {
        label: "Separation",
        value: `${state.lambda.toFixed(2)} SE`,
        note: `effect × √(n/2), with n = ${state.n} per group`,
      },
      {
        label: "Studies run",
        value: shown ? fmt(shown, 0) : "—",
        note: shown
          ? `${((100 * hits) / shown).toFixed(1)}% called significant · ${(100 * power).toFixed(1)}% predicted`
          : `of ${REPS} simulated studies`,
      },
    ];
  },

  summary: ({ params, state, anim }) => {
    const shown = anim ? anim.pile.shown : 0;
    const alpha = ALPHAS[params.alpha];
    const view = viewOf(state, params);
    const base =
      (view.isZ
        ? `Standardised axis: both curves are one standard error wide and the alternative sits ${state.lambda.toFixed(2)} along. `
        : `Raw difference axis: both curves are ${state.se.toFixed(3)} wide and centred on 0 and ${state.d.toFixed(1)} SD. `) +
      `Effect ${state.d.toFixed(1)} SD at n = ${state.n} per group. ` +
      `Threshold α = ${alpha.label} puts the line at ${view.crit.toFixed(2)}, ` +
      `for a false positive rate of ${alpha.label} and power of ${powerOf(state, params).toFixed(3)}.`;
    if (!shown) return `${base} No studies run yet.`;
    return `${base} Of ${shown} simulated studies, ${anim.hits} were called significant, a rate of ${(anim.hits / shown).toFixed(3)}.`;
  },
});

/* --- the four outcomes, as the 2x2 every student already knows ------------ *
 *
 * ROWS ARE THE TRUTH, COLUMNS ARE YOUR DECISION, and that orientation is the
 * whole reason the table teaches anything: you get to pick your column, you
 * never get to pick your row, and you are never told which row you are in.
 *
 * The four numbers are CONDITIONAL rates, so each ROW sums to 1. They are not
 * joint probabilities and the table deliberately shows no "total" — a joint
 * table needs a prior on how often H0 is true, which is a different and much
 * harder lesson (the false-positive report probability), and quietly implying
 * one here would be the very error this arc spends widget 6 undoing.
 *
 * EVERY CELL IS THE SAME WIDTH and each is filled to its own rate, so all four
 * fills share one scale and ANY cell can be compared against ANY other — across
 * rows as well as along them. That is the encoding areas cannot provide: two
 * shaded regions under a curve can change a great deal and look identical,
 * which is why the shaded areas above are restated here as lengths.
 *
 * Colour follows the DECISION, not the correctness — red is "called
 * significant" in both rows, matching the pile and the curves. So the red
 * column reads top-to-bottom as "alpha, then power", which is what those two
 * numbers actually are.                                                       */
function drawOutcomeGrid(ctx, colors, { x, y, w, h, alpha, power, lambda }) {
  const labelW = 104;
  const gap = 10;
  const cellW = (w - labelW - gap) / 2;
  const headH = 15;
  const rowH = (h - headH - 6) / 2;

  const cells = [
    // [row, col, name, rate, significant?]
    [0, 0, "True negative", 1 - alpha, false],
    [0, 1, "False positive", alpha, true],
    [1, 0, "False negative", 1 - power, false],
    [1, 1, "True positive", power, true],
  ];

  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "alphabetic";

  // Column headings: the decision you make.
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("you call it NOT significant", x + labelW + cellW / 2, y + 10);
  ctx.fillText("you call it SIGNIFICANT", x + labelW + gap + cellW * 1.5, y + 10);

  for (const [r, c, name, rate, sig] of cells) {
    const cx = x + labelW + c * (cellW + gap);
    const cy = y + headH + 6 + r * rowH;
    const ch = rowH - 6;

    // The fill IS the number. Same track width in all four, so one scale.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = colors.ink3;
    ctx.fillRect(cx, cy, cellW, ch);
    ctx.globalAlpha = sig ? 0.9 : 0.45;
    ctx.fillStyle = sig ? colors.extreme : colors.empirical;
    ctx.fillRect(cx, cy, cellW * rate, ch);
    ctx.globalAlpha = 1;

    /* Text over its own fill needs the halo `caption` uses, because a label sits
       on the filled part at high rates and the empty track at low ones. */
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.surface;
    ctx.textAlign = "left";
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.strokeText(name, cx + 8, cy + ch / 2 + 1);
    ctx.fillStyle = colors.ink2;
    ctx.fillText(name, cx + 8, cy + ch / 2 + 1);

    ctx.textAlign = "right";
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    const pct = `${(rate * 100).toFixed(1)}%`;
    ctx.strokeText(pct, cx + cellW - 8, cy + ch / 2 + 1);
    ctx.fillStyle = colors.ink1;
    ctx.fillText(pct, cx + cellW - 8, cy + ch / 2 + 1);
  }

  // Row labels: the truth, which you never actually get to see.
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = colors.groupA;
  ctx.fillText("no effect", x, y + headH + 6 + rowH / 2);
  ctx.fillStyle = lambda > 0 ? colors.groupB : colors.ink3;
  ctx.fillText("real effect", x, y + headH + 6 + rowH * 1.5);

  /* With effect = None the second row is a world you have declared does not
     exist. It still has honest arithmetic — power collapses to alpha — so it is
     drawn rather than blanked, and said in words rather than left to be
     misread as a claim about a real effect. */
  if (lambda === 0) {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.fillText("(you set none)", x, y + headH + 6 + rowH * 1.5 + 12);
  }
  ctx.restore();
}
