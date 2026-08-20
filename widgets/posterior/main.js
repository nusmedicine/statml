/* ============================================================================
   Bayesian estimation — widget 9, and the one widget 8 was built to set up.

   Hosted by the same lesson, `03 / 02-02 — Inferential Statistics: Inferring
   Parameters`, which states both forms two headings apart:

       MLE     P(Data | Parameters)      widget 8
       Bayes   P(Parameters | Data)      this one

   MISCONCEPTION TARGETED: that the likelihood curve already tells you how
   probable each parameter value is. It does not. It is P(data | theta) read as
   a function of theta, and nothing holds its area at 1. To get P(theta | data)
   you need a prior, and you have to NORMALISE. Reversing the two conditionals
   is one of the commonest errors in applied statistics.

   THE DISTINCTION IS AN AREA, AND EVERY PANEL PRINTS ITS OWN. Widget 8 made
   probability-vs-likelihood concrete by printing what each direction totals —
   the spikes over the data add to exactly 1.000, the curve over the parameter
   does not. That is the whole argument here:

       likelihood   area = 5e-13        whatever the data made it
       prior        area = 1            a distribution over the parameter
       posterior    area = 1            after dividing by P(counts)

   THE NOTE SAID "not 1" AND THAT WAS WRONG ON THE FIRST PRESS. In an earlier
   one-parameter Poisson build, the likelihood after a SINGLE count integrates
   to exactly 1 over mu — it is a Gamma(k+1, 1) density wearing mu's clothes —
   so the widget printed `area = 0.999 - not 1` the moment anyone pressed the
   button once. Caught by capturing every string the canvas paints and reading
   them, which no screenshot was ever going to show. The wording is `not fixed
   at 1`, which is true at every count.

   THE ANIMATION IS THE MIRROR OF WIDGET 8, and that is deliberate:

       widget 8   the data is fixed, drawn once      the PARAMETER sweeps
       widget 9   the parameter axes are fixed       the DATA arrives

   So one press adds one observation, and every curve on screen updates. The
   prior is visibly overwhelmed — and, on one of the two parameters, visibly is
   NOT, which is the more interesting half.

   BOTH PARAMETERS, WHICH IS WHERE THE TWO APPROACHES ACTUALLY DIVERGE.

   Widget 8 cannot estimate mu without deciding something about size: its mu tab
   assumes Poisson, and its size tab then fixes mu at what the first tab found.
   That is what maximum likelihood makes you do — a nuisance parameter has to be
   pinned somewhere before the other one can be profiled.

   Bayes does not. Put a prior on both, compute the joint posterior over the
   whole (size, mu) plane, and ADD IT UP ALONG THE AXIS YOU DO NOT CARE ABOUT.
   The uncertainty about size is then carried into the uncertainty about mu
   rather than assumed away. So:

       mu tab      the marginal posterior for mu, size integrated out
       size tab    the marginal posterior for size, mu integrated out
       Both        the joint posterior the two marginals are the edges of
       MCMC        how you would get the same answer without a grid

   And the marginals still factor, which is what lets each of the first two tabs
   keep the three-panel prior x likelihood = posterior figure exactly:

       posterior(mu)  ∝  prior(mu)  x  ∫ L(size, mu) prior(size) dsize

   The integral is the middle panel: the likelihood with size averaged over your
   prior for it. It is a real P(counts | mu) — that is what "given mu" means
   when mu is half the parameter — and it is also, exactly, the joint posterior
   added up along the size axis, which is what the Both tab shows.

   THE PAYOFF IS THAT THE TWO PARAMETERS BEHAVE DIFFERENTLY, and the widget can
   say so with numbers rather than with a caption. Measured on the defaults:
   from n = 0 to n = 12 the marginal posterior for mu narrows from SD 2.90 to
   1.52 while its centre is dragged 7.08 -> 8.57, so the prior has largely been
   overwhelmed. Over the same twelve counts the size posterior's SD goes 1.00 ->
   1.12: it does not narrow at all, and its centre moves 1.50 -> 2.55 only
   because the prior was badly placed to begin with. Twelve counts say a great
   deal about a mean and almost nothing about a dispersion. Widget 8 reported
   the same asymmetry as a wider interval; here it is a prior that is still
   doing the work, which is the sharper version of the same fact.

   MCMC IS A TAB, AND IT IS AN HONEST ANSWER TO "WHAT IS THE BACKEND?".

   Nothing in the first three tabs is sampled. The posterior is exact: multiply
   three arrays, add them up, divide. That is why P(counts) can be printed as a
   number rather than estimated — it IS the sum. `brms` runs four chains of two
   thousand iterations because Stan is general, not because this problem is
   hard, and the integral it approximates is the one the grid does with a `for`
   loop.

   The tab therefore does not present MCMC as the way to do this. It runs a
   Metropolis walk over the SAME posterior the other tabs computed exactly, so
   the cloud of draws can be watched filling in a contour that is already on
   screen and already known to be right. What that buys is the point: a grid
   costs 6,400 evaluations for two parameters and 80^k for k of them, and
   somewhere around four parameters it stops being possible. The sampler does
   not care.

   It samples on the LOG scale, with the Jacobian in the acceptance ratio, and
   that is not an implementation detail here: `brms` fits `count ~ 1` with a log
   link and the notebook recovers mu as exp(b_Intercept). Sampling log mu is
   what Stan is already doing.

   `size` RUNS BACKWARDS AND THE WIDGET SAYS SO. var = mu + mu^2/size, so a
   LARGER size means LESS spread and size -> infinity is Poisson. Same warning
   as widget 8, on the same parameter, in the same words.

   THE TRUE PARAMETERS ARE FIXED AT THE LESSON'S OWN 2.5 AND 10, AND ARE NOT
   CONTROLS. Widget 8 offers them because moving `trueSize` there changes the
   CONCLUSION — bring it down and the same search reports Poisson being wrong by
   four orders of magnitude. Nothing like that is available here: a different
   truth is the same figure at a different scale, which is a control that fails
   3.5. It would also break the axes, because the prior sliders are in the
   parameters' own units and a window that moved under them would let a prior
   slide off the panel.
   ========================================================================= */

import {
  defineWidget, makePlot, niceTicks, spanningRule, fmt, sci, sup,
  lgamma, nbLogPmf, nbDraw,
} from "../core/index.js";

/* The lesson's own call, verbatim: rnbinom(1000, size = 2.5, mu = 10). */
const TRUE_SIZE = 2.5;
const TRUE_MU = 10;

/* --- the parameter grid --------------------------------------------------- *
 * 80 x 80 = 6,400 cells, evaluated at their midpoints, so a sum times the cell
 * area IS the area and normalising is one line of arithmetic.
 *
 * The size window is widget 8's, so its contour and this one share a frame. The
 * mu window is NOT: widget 8 uses +/-40% of the true mean, which is as wide as
 * a likelihood needs and far too narrow to hold a prior. [0, 2 x mu] gives a
 * vague prior somewhere to live and still leaves the n = 12 posterior occupying
 * a third of the axis.
 *
 * 80 and not widget 8's 41, because nothing here is per-candidate: one press is
 * one OBSERVATION, so the grid is free to be fine enough that the contour is
 * smooth and a credible interval is not visibly quantised.                     */
const G = 80;
const SIZE_LO = 0.5, SIZE_HI = 10;
const MU_LO = 0, MU_HI = 20;
const dS = (SIZE_HI - SIZE_LO) / G;
const dM = (MU_HI - MU_LO) / G;
const SIZES = Float64Array.from({ length: G }, (_, i) => SIZE_LO + (i + 0.5) * dS);
const MUS = Float64Array.from({ length: G }, (_, j) => MU_LO + (j + 0.5) * dM);

/* Highest-density regions, as fractions of the posterior's mass: the smallest
   set of the plane holding this much probability. Widget 8's contour bands were
   NOT this — they were drops in log-likelihood, a ladder with no units. Same
   picture; the bands now mean something you can say out loud. */
const HPD = [0.5, 0.8, 0.95];
const HPD_ALPHA = [0.62, 0.40, 0.22];
const CRED = 0.95;

/* --- the sampler ---------------------------------------------------------- *
 * Random-walk steps on log size and log mu. TUNED BY MEASUREMENT, not guessed:
 * averaged over twelve independent chains of 600 draws, (0.42, 0.20) accepts
 * 53% and (0.80, 0.40) accepts 28%, which sits in the band around 0.234 that is
 * optimal for random-walk Metropolis in low dimension. Every one of the pairs
 * tried recovered the grid's exact mu of 8.57 to within 0.09, so this is a
 * choice about MIXING and about how often a reader gets to see a rejection —
 * not about whether the answer comes out right. The rate is in the readout. */
const DRAWS = 600;
const JUMP_SIZE = 0.8;
const JUMP_MU = 0.4;
const BRMS_DRAWS = 6000; // 4 chains x (2000 - 500 warmup), the notebook's call

const STEP_MS = 360;
const PLAY_MS = 150;
const DRAW_STEP_MS = 260;
const DRAW_PLAY_MS = 26;

const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** A number that might be 32 and might be 4e-13. */
const areaText = (v) => (v >= 0.01 && v < 1e4 ? fmt(v, v >= 10 ? 1 : 3) : sci(v));

/* --- panel geometry ------------------------------------------------------- *
 * Two shapes. The marginal tabs stack the counts over the three curves of
 * Bayes' rule, in the order the catalogue's spine sets out: the likelihood
 * first, because it is the object widget 8 hands over and because it is what
 * the data strip above it MEANS; then the prior, as the new ingredient,
 * directly above the posterior it produces — which is also the pair that
 * matters at the end, since "how far did it move" is a comparison between
 * neighbours. The plane tabs stack the counts over one surface.               */
const PAD_L = 62;
const PAD_R = 18;
const A_Y = 34, A_H = 46;   // the counts, arriving
const B_Y = 142, B_H = 106; // P(counts | theta)
const C_Y = 300, C_H = 116; // P(theta)          -- the prior
const D_Y = 474, D_H = 116; // P(theta | counts) -- the posterior
const S_Y = 142, S_H = 306; // the (size, mu) plane

const isPlane = (view) => view === "both" || view === "mcmc";
/* Core hands the height function the VALUES object, not { params } — widget 8's
   signature, and the only one it has. A panel that can be swapped out has to
   give its pixels back, or a tab trades a chart for the same amount of blank
   canvas. */
const canvasHeight = ({ view }) =>
  (isPlane(view) ? S_Y + S_H : D_Y + D_H) + 46;

/** The x and = of the lesson's own figure, in the margin on a caption's
    baseline. The lesson draws prior x likelihood ∝ posterior side by side on
    three separate axes; stacking them on one axis is the same statement with
    the columns lined up, and the two glyphs are what say so.

    ∝ WAS TRIED FIRST, BECAUSE IT IS THE EXACT RELATION AND THE LESSON'S OWN
    FIGURE USES IT, AND IT DOES NOT RENDER. Measured in the shipping font: at
    the LARGEST size token the glyph is 3.9px tall and 10.4 wide, against 9.6
    for the x directly above it. On screen it reads as a stray hyphen, and
    growing it to match optically would take a ~49px literal that no token
    supplies. So: an equals sign, whose missing division is stated at the other
    end of the very same line — the gutter glyph and the panel's note sit on one
    baseline, and that note reads `area = 1 — after ÷ P(counts) = ...`. Nobody
    is multiplying a curve at 1e-13 by a curve at 0.13 by eye; these are
    signposts for the structure, and the arithmetic is in the note. */
function gutter(ctx, colors, glyph, y) {
  ctx.save();
  // --fs-fig, not --fs-lg: these two glyphs are the figure's spine and want to
  // be read as structure rather than found.
  ctx.font = `${colors.fsFig} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(glyph, PAD_L - 20, y);
  ctx.restore();
}

/** Mean, SD, peak and central 95% of a density sampled on a regular grid. The
    interval is interpolated inside the cell it crosses, so the numbers move
    smoothly under a slider instead of stepping by a whole grid cell. */
function summarise(dens, grid, d) {
  let mean = 0;
  let peak = 0;
  for (let q = 0; q < G; q += 1) {
    mean += grid[q] * dens[q] * d;
    if (dens[q] > peak) peak = dens[q];
  }
  let varr = 0;
  for (let q = 0; q < G; q += 1) varr += (grid[q] - mean) ** 2 * dens[q] * d;
  const cross = (target) => {
    let cum = 0;
    for (let q = 0; q < G; q += 1) {
      const cell = dens[q] * d;
      if (cum + cell >= target) {
        const within = cell > 0 ? (target - cum) / cell : 0.5;
        return grid[q] + (within - 0.5) * d;
      }
      cum += cell;
    }
    return grid[G - 1];
  };
  const tail = (1 - CRED) / 2;
  return { mean, sd: Math.sqrt(varr), peak, lo: cross(tail), hi: cross(1 - tail) };
}

/** Density thresholds enclosing each HPD fraction, from a histogram of the cell
    values rather than a sort: O(cells) per state, and a threshold only has to
    be good to the width of a shading band. */
function hpdLevels(joint, cellArea) {
  let hi = 0;
  for (let q = 0; q < joint.length; q += 1) if (joint[q] > hi) hi = joint[q];
  if (!(hi > 0)) return HPD.map(() => 0);
  const BINS = 512;
  const mass = new Float64Array(BINS + 1);
  for (let q = 0; q < joint.length; q += 1) {
    mass[Math.min(BINS, Math.floor((joint[q] / hi) * BINS))] += joint[q] * cellArea;
  }
  const out = new Array(HPD.length).fill(0);
  let cum = 0;
  let k = 0;
  for (let b = BINS; b >= 0 && k < HPD.length; b -= 1) {
    cum += mass[b];
    while (k < HPD.length && cum >= HPD[k]) { out[k] = (b / BINS) * hi; k += 1; }
  }
  return out;
}

defineWidget({
  slug: "posterior",
  title: "Bayesian Estimation",
  subtitle:
    "Maximum likelihood found the parameters that make your counts most probable. " +
    "It cannot say how probable a parameter is: nothing holds the likelihood's " +
    "area at 1, so there is no probability to read off it. Multiply it by what " +
    "you believed beforehand, divide by the total, and the curve that comes out " +
    "does have an area of 1. Then add counts one at a time and watch one prior " +
    "get overwhelmed while the other does not.",
  layout: "side",
  height: canvasHeight,

  params: {
    /* 1 to 60. One count is worth seeing on its own — it barely moves either
       posterior, which is the honest picture of what one observation is worth.
       Sixty is where the mean is pinned and the dispersion still is not. */
    n: {
      type: "int", label: "Counts to collect", min: 1, max: 60, default: 12,
      detail: "one press observes one of them",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 56 },

    /* THE PRIORS, AND ALL THREE ARE DISPLAY PARAMETERS.

       Changing your prior does not change a single count you observed, so a
       prior change that discarded the observations would punish exactly the
       comparison the sliders exist to enable (3.2). Move any of them
       mid-animation and every posterior re-forms around the same data — which
       is the experiment a student actually wants to run: does my prior change
       the answer? On these two parameters it has two different answers.

       The mu prior's centre is deliberately OFF the truth. A prior sitting on
       the right answer demonstrates nothing; one at 7 against a true 10 is
       dragged visibly across the panel by twelve counts. */
    priorMu: {
      type: "float", label: "Before the data: mu is about", min: 2, max: 16, step: 0.5,
      default: 7,
      display: true,
      detail: "what you believed the mean was, before a single count",
    },
    priorSd: {
      type: "float", label: "…give or take", min: 0.5, max: 6, step: 0.5,
      default: 3,
      display: true,
      format: (v) => `± ${v.toFixed(1)}`,
      /* THE LESSON'S OWN mu PRIOR IS NOT THIS OBJECT, and the difference is
         worth one line rather than papering over. brms fits `count ~ 1` with a
         log link and the notebook recovers mu as exp(b_Intercept), so its
         `normal(0, 10)` on the Intercept is a prior on LOG mu — which puts mu
         anywhere from e^-20 to e^20. Enormously vaguer than this slider
         reaches, and on a different scale. Its OTHER prior, `exponential(1)` on
         the shape, IS on the parameter itself, which is why the size slider
         below reproduces the notebook exactly and this one cannot. */
      detail: "how sure you were · the lesson's brms prior for mu sits on log(mu), so its normal(0, 10) is vastly wider than this",
    },
    /* THE LESSON'S PRIOR ON size, REPRODUCIBLE EXACTLY. `prior(exponential(1),
       class = shape)` is an exponential with mean 1, on the parameter itself,
       so the default here IS the notebook's. That it sits well below the true
       2.5 is not a flaw to tune away: it is why the size tab shows a prior that
       is still doing work at n = 12, which is the widget's second lesson. */
    priorSize: {
      type: "float", label: "…and size is about", min: 0.5, max: 6, step: 0.5,
      default: 1,
      display: true,
      detail: "an exponential prior with this mean — the notebook's own exponential(1) · larger size = LESS spread",
    },

    /* FOUR READINGS OF ONE PROBLEM, so a segmented control and not a gate: all
       four are worth seeing at rest (3.3), and a gate would take the whole
       drive row with it. Named for the notebook's own two parameters, so these
       tabs and `optim(c(size, mu), ...)` line up exactly as widget 8's do. */
    view: {
      type: "segmented",
      label: "Looking at",
      options: [
        { value: "mu", label: "mu", detail: "the mean, with the dispersion integrated out rather than assumed" },
        { value: "size", label: "size", detail: "the dispersion, with the mean integrated out — larger size means LESS spread" },
        { value: "both", label: "Both", detail: "the joint posterior over the plane, which the other two tabs are the edges of" },
        { value: "mcmc", label: "MCMC", detail: "what brms does instead of a grid, over the same posterior — and why it has to" },
      ],
      default: "mu",
      display: true,
    },

    shown: { type: "int", label: "Counts already in", min: 0, max: 600, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "Your counts, and what they make likely", mark: "dot" },
    { token: "prior", label: "What you believed before", mark: "line" },
    { token: "posterior", label: "What you believe now", mark: "line" },
    { token: "reference", label: "The truth", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const { n, priorMu, priorSd, priorSize } = params;

    /* ARRIVAL ORDER, NOT SORTED. Widget 8 sorts its counts because they are one
       fixed batch the reader only ever sees all at once; here the order IS the
       animation, so nothing may reorder them. Drawn before anything else
       touches the rng, so changing a prior — which recomputes — cannot change a
       single count.

       SEED 56 IS AUTHORED. Its marginal posterior for mu walks 7.08 -> 6.54 ->
       7.88 -> ... -> 8.57 at twelve counts and 9.62 at sixty: dragged toward
       the truth without ever overshooting it, and still visibly short of 10 at
       the default n, which is the twelve-counts-of-sampling-error lesson
       widgets 2 to 4 established. */
    const counts = [];
    for (let i = 0; i < n; i += 1) counts.push(nbDraw(rng, TRUE_SIZE, TRUE_MU));

    /* The count axis ratchets in steps of 8 to hold the data and then stays put
       for the whole animation (2.5). Widget 8's rule and widget 8's numbers, so
       the two data strips are the same object. */
    let kMax = 0;
    for (const k of counts) if (k > kMax) kMax = k;
    const countHi = Math.max(32, Math.ceil((kMax + 3) / 8) * 8);
    let maxMult = 1;
    const tally = new Map();
    for (const k of counts) {
      const c = (tally.get(k) ?? 0) + 1;
      tally.set(k, c);
      if (c > maxMult) maxMult = c;
    }

    /* --- the two priors, each normalised to area 1 on its own axis --------- */
    const priorS = new Float64Array(G);
    const priorM = new Float64Array(G);
    let ws = 0;
    let wm = 0;
    for (let i = 0; i < G; i += 1) { priorS[i] = Math.exp(-SIZES[i] / priorSize); ws += priorS[i]; }
    for (let j = 0; j < G; j += 1) { priorM[j] = Math.exp(-0.5 * ((MUS[j] - priorMu) / priorSd) ** 2); wm += priorM[j]; }
    for (let i = 0; i < G; i += 1) priorS[i] /= ws * dS;
    for (let j = 0; j < G; j += 1) priorM[j] /= wm * dM;
    const lPriorS = Float64Array.from(priorS, Math.log);
    const lPriorM = Float64Array.from(priorM, Math.log);

    /* --- the log-likelihood over the plane, factorised ---------------------
       Naively this is 6,400 nbLogPmf calls per count — 1.2 million lgamma
       evaluations at n = 60, far too slow for a slider that recomputes on every
       drag frame. But the negative binomial's log-pmf separates:

         ll(r, mu) = SUM lgamma(k+r) - m lgamma(r) - SUM lgamma(k+1)
                     + m r (log r - log(r+mu)) + (SUM k)(log mu - log(r+mu))

       and the only per-observation term touching the grid is SUM lgamma(k + r),
       which depends on r ALONE. So one count costs 80 lgamma calls, not 6,400,
       and each cell is then six arithmetic operations on quantities cached
       below. That is what makes the prior sliders live rather than laggy.

       Widget 8 does NOT do this and should not: 41 candidates at n = 60 is
       2,460 evaluations, and a second copy of the formula to keep in step would
       cost more than it saves. */
    const logS = Float64Array.from(SIZES, Math.log);
    const lgS = Float64Array.from(SIZES, lgamma);
    const logM = Float64Array.from(MUS, Math.log);
    const logSum = new Float64Array(G * G);
    for (let i = 0; i < G; i += 1) {
      for (let j = 0; j < G; j += 1) logSum[i * G + j] = Math.log(SIZES[i] + MUS[j]);
    }

    /* One state per number of counts observed, so the animation reveals states
       that already exist rather than computing anything per frame (1.4). */
    const joint = new Float64Array((n + 1) * G * G);
    const margM = new Float64Array((n + 1) * G);
    const margS = new Float64Array((n + 1) * G);
    const likM = new Float64Array((n + 1) * G);
    const likS = new Float64Array((n + 1) * G);
    const steps = [];

    const A = new Float64Array(G); // SUM lgamma(k_t + r_i), accumulated
    let cGam = 0;                  // SUM lgamma(k_t + 1)
    let sumK = 0;
    const cellArea = dS * dM;
    let topM = 0;
    let topS = 0;
    const ll = new Float64Array(G * G);

    for (let m = 0; m <= n; m += 1) {
      if (m > 0) {
        const k = counts[m - 1];
        for (let i = 0; i < G; i += 1) A[i] += lgamma(k + SIZES[i]);
        cGam += lgamma(k + 1);
        sumK += k;
      }

      const base = m * G * G;
      let lpMax = -Infinity;
      let llMax = -Infinity;
      for (let i = 0; i < G; i += 1) {
        const ai = A[i] - m * lgS[i] - cGam;
        const mri = m * SIZES[i];
        for (let j = 0; j < G; j += 1) {
          const ls = logSum[i * G + j];
          const v = ai + mri * (logS[i] - ls) + sumK * (logM[j] - ls);
          ll[i * G + j] = v;
          if (v > llMax) llMax = v;
          const lp = v + lPriorS[i] + lPriorM[j];
          if (lp > lpMax) lpMax = lp;
        }
      }

      /* prior x likelihood, normalised over the plane. The max shift is what
         keeps this exact where the likelihood is already past 1e-60. */
      let W = 0;
      for (let i = 0; i < G; i += 1) {
        for (let j = 0; j < G; j += 1) W += Math.exp(ll[i * G + j] + lPriorS[i] + lPriorM[j] - lpMax);
      }
      /* P(counts) — the lesson's P(X), the integral it calls the hard part, and
         the entire argument for a grid rather than four chains of two thousand
         iterations. */
      const evidence = Math.exp(lpMax + Math.log(W * cellArea));

      for (let i = 0; i < G; i += 1) {
        for (let j = 0; j < G; j += 1) {
          const v = Math.exp(ll[i * G + j] + lPriorS[i] + lPriorM[j] - lpMax) / (W * cellArea);
          joint[base + i * G + j] = v;
          margM[m * G + j] += v * dS;
          margS[m * G + i] += v * dM;
        }
      }

      /* The two middle panels: the likelihood with the OTHER parameter averaged
         over its prior. That is what makes each marginal tab's three panels an
         exact identity rather than an illustration — see the header. */
      let lmMax = 0;
      let lsMax = 0;
      for (let j = 0; j < G; j += 1) {
        let acc = 0;
        for (let i = 0; i < G; i += 1) acc += Math.exp(ll[i * G + j] - llMax) * priorS[i] * dS;
        likM[m * G + j] = acc;
        if (acc > lmMax) lmMax = acc;
      }
      for (let i = 0; i < G; i += 1) {
        let acc = 0;
        for (let j = 0; j < G; j += 1) acc += Math.exp(ll[i * G + j] - llMax) * priorM[j] * dM;
        likS[m * G + i] = acc;
        if (acc > lsMax) lsMax = acc;
      }
      /* Rescaled by a power of ten taken off the LOG so nothing underflows, with
         the exponent factored into the caption — widget 8's device, and the
         exponent it factors out is the thing worth watching collapse. */
      const expoM = Math.floor((llMax + Math.log(lmMax)) / Math.LN10);
      const expoS = Math.floor((llMax + Math.log(lsMax)) / Math.LN10);
      const scaleM = Math.exp(llMax - expoM * Math.LN10);
      const scaleS = Math.exp(llMax - expoS * Math.LN10);
      let areaM = 0;
      let areaS = 0;
      for (let j = 0; j < G; j += 1) { likM[m * G + j] *= scaleM; areaM += likM[m * G + j] * dM; }
      for (let i = 0; i < G; i += 1) { likS[m * G + i] *= scaleS; areaS += likS[m * G + i] * dS; }

      const sm = summarise(margM.subarray(m * G, m * G + G), MUS, dM);
      const ss = summarise(margS.subarray(m * G, m * G + G), SIZES, dS);
      if (sm.peak > topM) topM = sm.peak;
      if (ss.peak > topS) topS = ss.peak;

      steps.push({
        evidence, mu: sm, size: ss, expoM, expoS,
        areaM: areaM * 10 ** expoM,
        areaS: areaS * 10 ** expoS,
        yTopM: Math.ceil(lmMax * scaleM * 1.1 * 2) / 2,
        yTopS: Math.ceil(lsMax * scaleS * 1.1 * 2) / 2,
        hpd: hpdLevels(joint.subarray(base, base + G * G), cellArea),
      });
    }

    /* ONE FRAME FOR EACH PAIR OF BELIEF PANELS, over every state either will
       show, so the prior and the posterior are directly comparable in height and
       the frame never moves under a reader (2.5). At zero counts the two panels
       are then the same picture, which is the correct and slightly startling
       statement that with no data the posterior IS the prior. */
    let priorPeakM = 0;
    let priorPeakS = 0;
    for (let j = 0; j < G; j += 1) if (priorM[j] > priorPeakM) priorPeakM = priorM[j];
    for (let i = 0; i < G; i += 1) if (priorS[i] > priorPeakS) priorPeakS = priorS[i];

    /* --- the sampler, over the finished dataset --------------------------- *
     * Random-walk Metropolis on (log size, log mu). The log scale is not a
     * convenience: it keeps both parameters positive without rejections at a
     * boundary, and it is what Stan is doing behind `brms`, which fits the
     * intercept on the log scale and exponentiates. Sampling a transformed
     * variable puts a JACOBIAN in the target — d(size)/d(log size) = size — so
     * the density being walked is p(size, mu) x size x mu. Leaving it out is the
     * classic error and would pull the whole cloud toward the origin.
     *
     * Started at the notebook's own `initial_values <- c(size = 1, mu =
     * mean(data))`, so the first thing a reader sees is a walk-in from a
     * declared starting guess — which is what a warmup is, and why brms throws
     * its first 500 draws away. */
    const logPost = (r, mu) => {
      if (!(r > 0) || !(mu > 0)) return -Infinity;
      let s = 0;
      for (const k of counts) s += nbLogPmf(k, r, mu);
      return s - r / priorSize - 0.5 * ((mu - priorMu) / priorSd) ** 2;
    };
    const sampleMean = n ? counts.reduce((a, b) => a + b, 0) / n : TRUE_MU;
    const chain = [];
    let cr = 1;
    let cm = Math.max(0.5, sampleMean);
    let cl = logPost(cr, cm) + Math.log(cr) + Math.log(cm);
    let accepted = 0;
    for (let t = 0; t < DRAWS; t += 1) {
      const pr = Math.exp(Math.log(cr) + rng.normal(0, JUMP_SIZE));
      const pm = Math.exp(Math.log(cm) + rng.normal(0, JUMP_MU));
      const pl = logPost(pr, pm) + Math.log(pr) + Math.log(pm);
      const take = Math.log(rng.next()) < pl - cl;
      if (take) { cr = pr; cm = pm; cl = pl; accepted += 1; }
      chain.push({ size: cr, mu: cm, propSize: pr, propMu: pm, take, rate: accepted / (t + 1) });
    }

    return {
      n, counts, countHi, maxMult,
      priorS, priorM, joint, margM, margS, likM, likS, steps, chain,
      beliefTopM: Math.max(topM, priorPeakM) * 1.1,
      beliefTopS: Math.max(topS, priorPeakS) * 1.1,
    };
  },

  animation: {
    /* "Step", NOT "Add a count", AND THAT IS A REAL COST OF THE FOURTH TAB.
       Three tabs advance the DATA by one observation and the fourth advances
       the SAMPLER by one draw, so no single noun is honest on all four —
       exactly the position widget 8 was in with its sweeps and its climb, and
       it reached the same answer. The noun goes into `stepTitle`, which is what
       3.4c says a one-word face has to do. */
    stepLabel: "Step",
    stepTitle: "Observe one more count — or, on the MCMC tab, take one more draw",
    runLabel: "Play",
    runTitle: "Keep going to the end of the sample, or of the chain",

    init({ params, fromScratch }) {
      /* TWO CURSORS, AND ONLY TWO. The mu, size and Both tabs are three views of
         the SAME accumulating data, so they share one — switching tabs must not
         cost the counts you collected. The sampler counts something else
         entirely, so it gets its own. */
      const anim = { obs: 0, draws: 0, flying: false, flyT: 1, done: false };
      const pre = fromScratch ? 0 : Math.max(0, params.shown | 0);
      if (pre > 0) {
        if (params.view === "mcmc") anim.draws = Math.min(pre, DRAWS);
        else anim.obs = Math.min(pre, params.n);
        anim.hasAdvanced = true;
      }
      anim.done = params.view === "mcmc" ? anim.draws >= DRAWS : anim.obs >= params.n;
      return anim;
    },

    /* Switching tab re-derives the run button's whole story from the cursor that
       is now live. Without it, entering the sampler with the counts finished
       showed "Replay" over a chain that had not started. */
    rebuild(anim, { params }) {
      const live = params.view === "mcmc" ? anim.draws : anim.obs;
      const last = params.view === "mcmc" ? DRAWS : params.n;
      anim.done = live >= last;
      anim.hasAdvanced = live > 0;
      anim.flying = false;
      anim.flyT = 1;
    },

    advance(anim, { dt, params }) {
      if (anim.done) return false;
      const mcmc = params.view === "mcmc";
      const dur = anim.mode === "step"
        ? (mcmc ? DRAW_STEP_MS : STEP_MS)
        : (mcmc ? DRAW_PLAY_MS : PLAY_MS);
      const last = mcmc ? DRAWS : params.n;
      const at = () => (mcmc ? anim.draws : anim.obs);

      if (anim.flying) {
        anim.flyT = clamp01(anim.flyT + dt / dur);
        if (anim.flyT < 1) return true;
        // It has landed, so it counts: everything below moves on by one.
        anim.flying = false;
        if (mcmc) anim.draws += 1; else anim.obs += 1;
        anim.hasAdvanced = true;
        if (at() >= last) { anim.done = true; return false; }
        if (anim.mode === "step") return false;
      }

      if (at() >= last) { anim.done = true; return false; }
      anim.flying = true;
      anim.flyT = 0;
      return true;
    },
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    const { counts, countHi, steps, n } = state;
    const plotW = w - PAD_L - PAD_R;
    const plane = isPlane(params.view);
    // The sampler always fits the finished dataset, exactly as brms would.
    const m = params.view === "mcmc" ? n : anim.obs;
    const S = steps[m];

    /* ---- the counts, one at a time ------------------------------------- */
    const pA = makePlot({
      ctx, colors, rect: { x: PAD_L, y: A_Y, w: plotW, h: A_H },
      xDomain: [-0.5, countHi + 0.5], yDomain: [0, Math.max(3, state.maxMult)],
    });
    pA.caption(params.view === "mcmc"
      ? `All ${n} counts — the sampler fits the finished dataset, as brms would`
      : m === 0 && !anim.flying
        ? "Nothing observed yet — press “Step”"
        : `Your counts — ${m} of ${n} observed`);

    const settled = new Array(countHi + 1).fill(0);
    for (let i = 0; i < m; i += 1) settled[counts[i]] += 1;
    pA.dotColumns(settled, { lo: -0.5, width: 1, fill: colors.empirical, maxR: 3.6 });

    /* The arrival, accelerating downward into its own column (4.3). The level it
       lands on is read off the same `settled` tally the dots are drawn from, so
       the falling dot and the dot it becomes cannot disagree (5.8). */
    if (!plane && anim.flying && m < n) {
      const k = counts[m];
      const y0 = pA.y + 2;
      const y1 = pA.sy(settled[k] + 0.5);
      const t = anim.flyT * anim.flyT;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pA.sx(k), y0 + (y1 - y0) * t, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = colors.empirical;
      ctx.fill();
      ctx.restore();
    }
    pA.axisX({ label: "count — one observation each, drawn once and never redrawn" });

    if (plane) drawPlane(ctx, colors, plotW, params, state, anim, m, S);
    else drawMarginal(ctx, colors, plotW, params, state, anim, m, S);
  },

  readout: ({ params, state, anim }) => {
    const view = params.view;
    const m = view === "mcmc" ? state.n : anim.obs;
    const S = state.steps[m];

    if (view === "mcmc") {
      const t = anim.draws;
      if (t === 0) {
        return [
          { label: "Draws", value: "0", note: `press Step — brms would take ${BRMS_DRAWS.toLocaleString("en")}` },
          { label: "The grid already knows", value: fmt(S.mu.mean, 2), note: "mu, exactly · the chain has to go and find it" },
        ];
      }
      /* The sample's own answer against the exact one. This is the only place in
         the collection where an approximation is checked against a truth that is
         on the same screen and known to be right. */
      let sum = 0;
      for (let q = 0; q < t; q += 1) sum += state.chain[q].mu;
      return [
        {
          label: "mu, from the draws",
          value: fmt(sum / t, 2),
          note: `${t} draw${t === 1 ? "" : "s"} · the grid says ${fmt(S.mu.mean, 2)}`,
        },
        {
          label: "Proposals accepted",
          value: `${Math.round(state.chain[t - 1].rate * 100)}%`,
          note: "a rejected one is not discarded — the chain records where it already was",
        },
      ];
    }

    if (view === "both") {
      return [
        { label: "mu", value: fmt(S.mu.mean, 2), note: `true ${fmt(TRUE_MU, 1)} · 95% within ${fmt(S.mu.lo, 1)} – ${fmt(S.mu.hi, 1)}` },
        { label: "size", value: fmt(S.size.mean, 2), note: `true ${fmt(TRUE_SIZE, 1)} · 95% within ${fmt(S.size.lo, 1)} – ${fmt(S.size.hi, 1)}` },
      ];
    }

    const size = view === "size";
    const P = size ? S.size : S.mu;
    const truth = size ? TRUE_SIZE : TRUE_MU;
    const started = size ? params.priorSize : params.priorMu;

    return [
      {
        label: "Best estimate",
        value: fmt(P.mean, 2),
        note: m === 0
          ? "your prior on its own — you have not looked yet"
          : `you started at ${fmt(started, 1)} · ${m} count${m === 1 ? "" : "s"} moved it here · the truth is ${fmt(truth, 1)}`,
      },
      {
        /* THE NUMBER WIDGET 8 COULD NOT PRODUCE. Its interval was a range of
           parameter values the data did not rule out; this one is a statement
           about where the parameter is, with a probability attached, and it is
           legitimate only because the curve it is measured on has an area of 1. */
        label: "95% credible interval",
        value: `${fmt(P.lo, 1)} – ${fmt(P.hi, 1)}`,
        note: m === 0
          ? "95% of your prior — no counts have narrowed it"
          : `95% of the posterior's probability is in here · width ${fmt(P.hi - P.lo, 1)}`,
      },
    ];
  },
});

/* ============================================================================
   The two figure shapes.
   ========================================================================= */

/** A marginal tab: likelihood x prior = posterior, all on one parameter axis. */
function drawMarginal(ctx, colors, plotW, params, state, anim, m, S) {
  const size = params.view === "size";
  const grid = size ? SIZES : MUS;
  const truth = size ? TRUE_SIZE : TRUE_MU;
  const name = size ? "size" : "mu";
  const xDomain = size ? [SIZE_LO, SIZE_HI] : [MU_LO, MU_HI];

  const lik = (size ? state.likS : state.likM).subarray(m * G, m * G + G);
  const post = (size ? state.margS : state.margM).subarray(m * G, m * G + G);
  const prior = size ? state.priorS : state.priorM;
  const yTop = size ? S.yTopS : S.yTopM;
  const expo = size ? S.expoS : S.expoM;
  const area = size ? S.areaS : S.areaM;
  const beliefTop = size ? state.beliefTopS : state.beliefTopM;
  const P = size ? S.size : S.mu;

  const pB = makePlot({ ctx, colors, rect: { x: PAD_L, y: B_Y, w: plotW, h: B_H }, xDomain, yDomain: [0, yTop] });
  const pC = makePlot({ ctx, colors, rect: { x: PAD_L, y: C_Y, w: plotW, h: C_H }, xDomain, yDomain: [0, beliefTop] });
  const pD = makePlot({ ctx, colors, rect: { x: PAD_L, y: D_Y, w: plotW, h: D_H }, xDomain, yDomain: [0, beliefTop] });

  /* The truth, once, down all three parameter panels — one rule rather than
     three lines, because it is one value and the panels are one axis. Drawn
     first so every mark sits over it. */
  spanningRule(ctx, colors, { x: pD.sx(truth), y0: B_Y, y1: D_Y + D_H, label: `true ${name}` });

  const curveOf = (arr) => {
    const pts = [];
    for (let q = 0; q < G; q += 1) pts.push([grid[q], arr[q]]);
    return pts;
  };

  /* ---- the likelihood ------------------------------------------------- */
  pB.caption(m === 0
    ? `P(nothing yet | ${name}) — flat, because you have not looked`
    : `P(your ${m} count${m === 1 ? "" : "s"} | ${name}), the other parameter averaged out   × 10${sup(expo)}`);
  const bTicks = niceTicks(0, yTop, 4);
  pB.grid(bTicks);
  pB.axisY({ ticks: bTicks });
  const likPts = curveOf(lik);
  pB.area(likPts, { fill: colors.empirical, opacity: 0.1 });
  pB.curve(likPts, { stroke: colors.empirical, width: 2 });
  pB.axisX({ ticks: [] });
  /* NOT "not 1". In an earlier one-parameter build this area really was 1 after
     a single count, by a coincidence of the Poisson likelihood, and the claim
     has to survive the first press. What separates it from the two panels below
     is that nothing holds it there. */
  pB.note(`area = ${areaText(area)} — not fixed at 1`);

  /* ---- the prior ------------------------------------------------------- */
  gutter(ctx, colors, "×", C_Y - 8);
  pC.caption(size
    ? `Your prior — size averages ${fmt(params.priorSize, 1)}, so you expected a lot of extra spread`
    : `Your prior — mu is about ${fmt(params.priorMu, 1)}, give or take ${fmt(params.priorSd, 1)}`);
  const priorPts = curveOf(prior);
  pC.area(priorPts, { fill: colors.prior, opacity: 0.12 });
  pC.curve(priorPts, { stroke: colors.prior, width: 2 });
  pC.axisX({ ticks: [] });
  pC.note("area = 1");

  /* ---- the posterior --------------------------------------------------- */
  gutter(ctx, colors, "=", D_Y - 8);
  pD.caption(m === 0
    ? `P(${name} | no counts) — still exactly your prior, which is the point`
    : `P(${name} | your ${m} count${m === 1 ? "" : "s"}) — the answer is this whole curve`);
  const postPts = curveOf(post);
  pD.area(postPts, { fill: colors.posterior, opacity: 0.1 });
  // 95% of the area, drawn as 95% of the area. Nothing else says it as plainly.
  pD.area(postPts.filter(([x]) => x >= P.lo && x <= P.hi), { fill: colors.posterior, opacity: 0.24 });
  pD.curve(postPts, { stroke: colors.posterior, width: 2.5 });
  pD.axisX({
    label: size
      ? "size — larger means LESS spread, and Poisson is off the right"
      : "mu — the mean these counts came from",
  });
  /* The three notes read down the figure as one column, all opening on the same
     word: whatever the data made it, 1, 1. This one also carries the lesson's
     P(X) — the integral it calls the hard part, and the one this widget does by
     adding 6,400 numbers up. */
  pD.note(m === 0 ? "area = 1" : `area = 1 — after ÷ P(counts) = ${sci(S.evidence)}`);
}

/** A plane tab: the joint posterior, and optionally a walk over it. */
function drawPlane(ctx, colors, plotW, params, state, anim, m, S) {
  const mcmc = params.view === "mcmc";
  const pS = makePlot({
    ctx, colors, rect: { x: PAD_L, y: S_Y, w: plotW, h: S_H },
    xDomain: [SIZE_LO, SIZE_HI], yDomain: [MU_LO, MU_HI],
  });

  /* Caption and note share this line, so both are kept short enough to sit at
     opposite ends of it — measured, after the first pair overran by 20px and
     printed through each other. */
  pS.caption(mcmc
    ? "A chain wandering over that same posterior, faded"
    : m === 0
      ? "P(size, mu | no counts) — your two priors, multiplied"
      : `P(size, mu | your ${m} count${m === 1 ? "" : "s"})`);

  /* THE HPD BANDS, WHICH ARE THE WHOLE DIFFERENCE FROM WIDGET 8'S CONTOUR. That
     one shaded by drops in log-likelihood — a ladder with no units. These are
     the smallest regions holding 50%, 80% and 95% of the probability, which is
     a sentence you can say out loud. Cells tile on WHOLE PIXELS: overlapping
     them a fraction to close the seams double-composites the alpha along every
     seam and prints a grid over the surface, which reads as texture in the
     data. */
  const base = m * G * G;
  const px = (i) => Math.round(pS.x + (i * pS.w) / G);
  const py = (j) => Math.round(pS.y + pS.h - (j * pS.h) / G);
  ctx.save();
  ctx.fillStyle = colors.posterior;
  for (let i = 0; i < G; i += 1) {
    for (let j = 0; j < G; j += 1) {
      const v = state.joint[base + i * G + j];
      let band = -1;
      for (let b = 0; b < HPD.length; b += 1) if (v >= S.hpd[b]) { band = b; break; }
      if (band < 0) continue;
      ctx.globalAlpha = HPD_ALPHA[band] * (mcmc ? 0.4 : 1);
      ctx.fillRect(px(i), py(j + 1), px(i + 1) - px(i), py(j) - py(j + 1));
    }
  }
  ctx.restore();

  pS.axisY({ ticks: niceTicks(MU_LO, MU_HI, 4), label: "mu" });
  /* THE SAME PLANE THE NOTEBOOK CONTOURS, AND THE SAME WAY UP. Its contour cell
     is `aes(x = size, y = mu)`, and widget 8's surface follows it, so a student
     comparing all three figures never has to re-orient. */
  pS.axisX({ label: "size — larger means LESS spread, and Poisson is off the right" });

  // The truth, which we can mark only because the population is seeded.
  pS.dot(TRUE_SIZE, TRUE_MU, { fill: colors.reference, r: 5 });
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("truth", pS.sx(TRUE_SIZE) + 10, pS.sy(TRUE_MU));
  ctx.restore();

  if (!mcmc) {
    pS.note("50%, 80%, 95% · the whole plane, 1");
    return;
  }

  /* ---- the chain -------------------------------------------------------- */
  const t = anim.draws;
  if (t === 0) {
    pS.note("nothing drawn yet — the shading is the exact answer");
    return;
  }

  /* Every draw so far, as a light cloud. This is the object brms hands back:
     not a curve, a pile of numbers you then take the mean of. */
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.globalAlpha = 0.45;
  for (let q = 0; q < t; q += 1) {
    const c = state.chain[q];
    ctx.beginPath();
    ctx.arc(pS.sx(c.size), pS.sy(c.mu), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* The last few moves as a path, so the WALK is visible and not only its
     residue — a cloud alone looks like independent sampling, which is the one
     thing a Markov chain is not.

     THE WHOLE CHAIN IS --c-empirical: its cloud, its path and its current
     position are all the same object, and that object is simulated data. It was
     briefly drawn on --c-highlight, which shares a palette slot with
     --c-posterior — so the chain and the exact posterior underneath it were the
     same colour, in the one panel whose entire point is the difference between
     them. */
  const tail = [];
  for (let q = Math.max(0, t - 24); q < t; q += 1) tail.push([state.chain[q].size, state.chain[q].mu]);
  if (tail.length > 1) pS.curve(tail, { stroke: colors.empirical, width: 1.5 });

  /* The proposal in flight: where it wants to go, and whether it gets there. A
     rejected one is drawn as a hollow mark left behind, because "the chain did
     not move" is otherwise indistinguishable from "nothing happened". */
  const cur = state.chain[t - 1];
  if (anim.flying && t < DRAWS) {
    /* --c-extreme for a rejection, which is the role's own meaning read
       literally: the proposal fell past the line the acceptance rule draws. */
    const nxt = state.chain[t];
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = nxt.take ? colors.highlight : colors.extreme;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pS.sx(cur.size), pS.sy(cur.mu));
    ctx.lineTo(pS.sx(nxt.propSize), pS.sy(nxt.propMu));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pS.sx(nxt.propSize), pS.sy(nxt.propMu), 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  pS.dot(cur.size, cur.mu, { fill: colors.empirical, r: 5 });

  pS.note(anim.flying && t < DRAWS
    ? (state.chain[t].take
      ? "accepted — the chain moves there"
      : "rejected — it stays, and records where it already was")
    : `${t} draw${t === 1 ? "" : "s"} · brms would take ${BRMS_DRAWS.toLocaleString("en")}`);
}
