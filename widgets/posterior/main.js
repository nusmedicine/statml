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

   AND REFUSING TO ASSUME HAS A PRICE, WHICH THE mu TAB PRINTS. Its interval
   reads `width 6.0 · assume no extra spread and it claims only 3.2`, both
   computed live off the same counts and the same prior. The second is what
   widget 8's mu tab does — it assumes Poisson, and says so — and it is the
   comparison that matters, because it is far larger than the one a reader
   expects. Pinning the dispersion at its ESTIMATE costs 4% of the width;
   assuming it away entirely costs 47%.

   THE SEARCH STRATEGY IS NOT WHAT COSTS YOU; THE MODEL ASSUMPTION IS. The
   natural guess is that widget 8's one-parameter-then-the-other is a greedy
   shortcut that lands somewhere worse. It does not: the best mu is the sample
   mean at EVERY size — 8.66 at 0.5, at 2.5, at 10, at a million — because the
   `r` terms cancel out of d/dmu, and the posterior correlation between the two
   parameters here is 0.024. That reframes the Both tab. It is not the proper
   way against the shortcut; it is the tab that tells you WHETHER the shortcut
   was safe, because a crest running straight up is what makes it so, and a
   reader can see that rather than be told it.

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

   AND "WHY GUESS, WHEN THE ANSWER IS ALREADY ON SCREEN?" IS THE RIGHT QUESTION.
   The honest reply is that on THIS problem you should just use the grid. The
   contour is drawn so the sampler can be watched agreeing with an answer that is
   already known to be right, which is the only way to earn trust in it for the
   problems where no such answer exists — and the readout runs that check
   continuously, printing the chain's mu beside the grid's. Two different "true"
   things share the panel and they are not the same kind of thing: the faded
   contour is the exact POSTERIOR, computable here and not at ten parameters; the
   `truth` dot is the real PARAMETERS, visible only because the population is
   seeded and never available with real data.

   `size` RUNS BACKWARDS AND THE WIDGET SAYS SO. var = mu + mu^2/size, so a
   LARGER size means LESS spread and size -> infinity is Poisson. Same warning
   as widget 8, on the same parameter, in the same words.

   THE TRUE PARAMETERS ARE CONTROLS, AND AN EARLIER BUILD CUT THEM ON A BAD
   ARGUMENT. The reasoning was that a different truth is the same figure at a
   different scale, and that the axes would break — the prior sliders are in the
   parameters' own units, so a window that moved under them would let a prior
   slide off the panel. The second half was true and the conclusion was wrong:
   THE WINDOW DOES NOT HAVE TO FOLLOW THE TRUTH. Widget 8 centres its window on
   the truth because a likelihood sweep has nothing else on that axis; here a
   prior lives there too, so the windows are fixed — mu on [0, 20], size on
   [0.5, 10] — and the truth moves inside them.

   With that, the sliders carry the one thing this widget was not doing that
   widget 8 does: SET A TRUTH, COLLECT COUNTS, WATCH THE POSTERIOR FIND IT. And
   the failures are as instructive as the successes — at a true mean of 15
   against a prior centred on 7, twelve counts get you to 11.1, which is the
   honest answer and the reason the prior sliders are next to them.

   THE CONTROL BLOCK IS TWO LABELLED GROUPS, and that is not decoration. Four
   numbers describe a population the widget is pretending not to know; three
   describe a belief about it. Seven sliders in one list read as one list, and
   the question that produced this divider — "why did maximum likelihood not
   need this extra parameter?" — is exactly what an undivided list invites. The
   prior's labels name their distributions for the same reason: `mu — a Normal
   centred at`, `size — an Exponential with mean`. A prior IS a distribution and
   each one costs its own parameters, which is the trade against maximum
   likelihood, taught in a label rather than a paragraph.
   ========================================================================= */

import {
  defineWidget, makePlot, niceTicks, spanningRule, fmt, sci, sup,
  lgamma, nbLogPmf, nbDraw,
} from "../core/index.js";

/* The lesson's own call, verbatim: rnbinom(1000, size = 2.5, mu = 10). Defaults
   now, not constants — the two sliders that set them are the widget's own
   validation: choose a truth, collect counts, watch the posterior find it. */
const TRUE_SIZE_DEF = 2.5;
const TRUE_MU_DEF = 10;

/* The two rows of the tab strip. The method is the grouping. */
const GRID_ROW = "exact — one grid, added up";
const SAMPLED_ROW = "approximate — sampled, never enumerated";

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

const LEAD_MS = 1500;
const STEP_MS = 360;
const PLAY_MS = 150;
const DRAW_STEP_MS = 260;
const DRAW_PLAY_MS = 26;

const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** A number that might be 32 and might be 4e-13. */
const areaText = (v) => (v >= 0.01 && v < 1e4 ? fmt(v, v >= 10 ? 1 : 3) : sci(v));

/** The power of ten a likelihood panel factors out, from the log of its peak.
 *
 * THE EPSILON IS NOT COSMETIC, AND THE CASE IT FIXES WAS THE DEFAULT OPENING
 * FRAME. At zero counts the likelihood is flat and its peak is the prior's own
 * integral, which is 1 — except that adding 80 cells lands on
 * 0.9999999999999999 for some priors and 1.0000000000000002 for others.
 * Math.log of the first is -1.1e-16, floor() takes that to -1, and the panel
 * redraws its y-axis in tenths. The m = 0 caption deliberately does not print
 * the factor, so nothing on screen said so: the default prior's axis read
 * 0 - 11 with a flat curve at 10 and `area = 20.0` underneath, while one notch
 * of the size slider read 0 - 1.5. One ulp, in the first frame a reader sees.
 *
 * A tolerance rather than a rounding, because the intent is only ever to reject
 * a value a hair BELOW an exact power of ten; anything genuinely between two
 * powers is already far from the boundary. */
const expoOf = (logV) => Math.floor(logV / Math.LN10 + 1e-9);

/** How much extra spread an Exponential prior with this mean is expecting.
 *
 * var = mu + mu^2/size, so a LARGER size means LESS extra spread — which made
 * this clause fixed text a bug rather than a shortcut. It read "a lot of extra
 * spread" at every setting of a slider that runs to 6, so from about 2 upwards
 * the caption said the opposite of the axis label two panels below it. */
const spreadExpected = (v) => (v < 1.5 ? "a lot of" : v <= 3.5 ? "some" : "little");

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
const S_Y = 142;            // the (size, mu) plane
const S_H = 250;            // on Both
const M_H = 250;            // on the sampler
/* THE MARGINALS GO ON THE PLANE'S EDGES, NOT SIDE BY SIDE. Each one then lines
   up with its own axis — mu is the plane's y, so mu's marginal is vertical on
   the right; size is the x, so size's is horizontal below — which makes "a
   marginal is the plane added up along the other axis" a thing you can see
   rather than a thing you are told. _lab/two-then-both.html had already found
   the alternative wanting: two upright curves side by side make the
   worse-determined parameter look better determined, because the eye compares
   their peaks and the peaks are not comparable. */
const MARG_W = 84;          // mu's marginal, vertical, right of the plane
const MARG_H = 56;          // size's marginal, horizontal, below it
const R_Y = 566;            // the ratio strip, on the sampler only

const isPlane = (view) => view === "both" || view === "mcmc";
/* Core hands the height function the VALUES object, not { params } — widget 8's
   signature, and the only one it has. A panel that can be swapped out has to
   give its pixels back, or a tab trades a chart for the same amount of blank
   canvas. */
const canvasHeight = ({ view }) =>
  view === "mcmc" ? R_Y + 104
    : view === "both" ? S_Y + S_H + MARG_H + 8 + 46
      : D_Y + D_H + 46;

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
    "It cannot say how probable a parameter is — nothing holds the likelihood's " +
    "area at 1. Multiply it by what you believed beforehand, divide by the total, " +
    "and the curve that comes out does. Then add counts one at a time and watch " +
    "one prior get overwhelmed while the other does not.",
  layout: "side",
  height: canvasHeight,

  params: {
    /* THE POPULATION, AND THE PRIOR, ARE TWO DIFFERENT KINDS OF THING. Seven
       numbers in one list read as one list; the divider is what makes the
       difference structural rather than something a reader has to be told. */
    truth: { type: "section", label: "The population" },

    /* THE TRUE PARAMETERS ARE CONTROLS AGAIN, and the reason they can be is that
       the AXES NO LONGER FOLLOW THEM. Widget 8 centres its window on the truth,
       which is right for a likelihood sweep with nothing else on the axis; here
       a prior lives on that axis too, and a window that moved under it would let
       the prior slide off the panel. So the windows are fixed — mu on [0, 20],
       size on [0.5, 10] — and the truth moves inside them, which is what these
       two sliders are for: set a truth, collect counts, watch the posterior
       close on it. That is the whole validation, and it is the thing maximum
       likelihood does in widget 8 that this widget should also be seen doing. */
    trueMu: { type: "int", label: "True mean", min: 4, max: 16, default: TRUE_MU_DEF },
    trueSize: {
      type: "float", label: "True size", min: 1, max: 6, step: 0.5, default: TRUE_SIZE_DEF,
      detail: "larger size = LESS spread · the notebook uses size 2.5, mu 10",
    },

    /* 1 to 60. One count is worth seeing on its own — it barely moves either
       posterior, which is the honest picture of what one observation is worth.
       Sixty is where the mean is pinned and the dispersion still is not. */
    n: { type: "int", label: "Counts to collect", min: 1, max: 60, default: 12 },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 56 },

    /* A PRIOR IS A DISTRIBUTION, AND EACH ONE COSTS ITS OWN PARAMETERS. That is
       the trade against maximum likelihood, and the labels are where it is
       taught: mu gets a Normal, which takes two numbers, and size gets an
       Exponential, which takes one. Naming the distributions turned out to do
       the job three lines of prose had been doing badly — the question this
       answers was "why does MLE not need this extra parameter?", and the answer
       is that these are not model parameters at all.

       ALL THREE ARE DISPLAY PARAMETERS. Changing a prior does not change a
       single count you observed, so discarding the observations would punish
       exactly the comparison the sliders exist to enable (3.2). */
    prior: { type: "section", label: "Your prior" },

    priorMu: {
      /* Deliberately OFF the truth by default. A prior sitting on the right
         answer demonstrates nothing; one at 7 against a true 10 is dragged
         visibly across the panel by twelve counts. */
      type: "float", label: "mu — a Normal centred at", min: 2, max: 16, step: 0.5,
      default: 7, display: true,
    },
    priorSd: {
      type: "float", label: "…give or take", min: 0.5, max: 6, step: 0.5,
      default: 3, display: true,
      format: (v) => `± ${v.toFixed(1)}`,
      /* The lesson's own mu prior is NOT this object and the difference is worth
         one line: brms fits `count ~ 1` with a log link and the notebook recovers
         mu as exp(b_Intercept), so its normal(0, 10) is a prior on LOG mu. */
      detail: "brms puts its normal(0, 10) on log(mu), so the lesson's is far wider",
    },
    priorSize: {
      type: "float", label: "size — an Exponential with mean", min: 0.5, max: 6, step: 0.5,
      default: 1, display: true,
      /* `prior(exponential(1), class = shape)` is on the parameter itself, so
         this default IS the notebook's. That it sits below the true 2.5 is not a
         flaw to tune away: it is why the size tab shows a prior still doing work
         at n = 12. */
      detail: "the notebook's own exponential(1)",
    },

    /* FOUR READINGS, IN TWO ROWS, BECAUSE THREE OF THEM ARE THE SAME KIND OF
       THING AND ONE IS NOT. The grid tabs and the sampler differ in method
       before they differ in content, and a reader needs that before choosing
       rather than after. Saying it in the SHAPE beats a caption that changes as
       you click — which is what this was, and it was asked about. */
    inference: { type: "section", label: "The inference" },
    view: {
      type: "segmented",
      /* Empty on purpose: the heading above says it, and the two row captions
         say what distinguishes the rows. A "Looking at" here would be a third
         line of chrome between a heading and the buttons it introduces. */
      label: "",
      options: [
        /* NO per-tab `detail`. The row captions say what separates the rows,
           and each figure's own caption says what that tab shows — panel B on
           the mu tab already reads "the other parameter averaged out". A third
           grey line under the buttons was the block's texture, not its
           meaning. */
        { value: "mu", label: "mu", group: GRID_ROW },
        { value: "size", label: "size", group: GRID_ROW },
        { value: "both", label: "Both", group: GRID_ROW },
        { value: "mcmc", label: "MCMC", group: SAMPLED_ROW },
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
    const { n, trueMu, trueSize, priorMu, priorSd, priorSize } = params;

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
    for (let i = 0; i < n; i += 1) counts.push(nbDraw(rng, trueSize, trueMu));

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
    const poisLl = new Float64Array(G);

    for (let m = 0; m <= n; m += 1) {
      if (m > 0) {
        const k = counts[m - 1];
        for (let i = 0; i < G; i += 1) A[i] += lgamma(k + SIZES[i]);
        // size = Infinity is the Poisson limit, taken exactly by core's pmf.
        for (let j = 0; j < G; j += 1) poisLl[j] += nbLogPmf(k, Infinity, MUS[j]);
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
      const expoM = expoOf(llMax + Math.log(lmMax));
      const expoS = expoOf(llMax + Math.log(lsMax));
      const scaleM = Math.exp(llMax - expoM * Math.LN10);
      const scaleS = Math.exp(llMax - expoS * Math.LN10);
      let areaM = 0;
      let areaS = 0;
      for (let j = 0; j < G; j += 1) { likM[m * G + j] *= scaleM; areaM += likM[m * G + j] * dM; }
      for (let i = 0; i < G; i += 1) { likS[m * G + i] *= scaleS; areaS += likS[m * G + i] * dS; }

      /* WHAT ASSUMING IT AWAY WOULD HAVE COST, measured rather than asserted.
         Widget 8's mu tab does not integrate the dispersion out — it assumes
         Poisson, which is size = infinity, and says so. That is the honest
         comparison for this widget's headline number, and it is a big one:
         pinning size at its ESTIMATE costs 4% of the interval's width, while
         assuming no overdispersion at all costs 47%. The search strategy is not
         what costs you; the model assumption is. */
      let poisMax = -Infinity;
      const poisLp = new Float64Array(G);
      for (let j = 0; j < G; j += 1) {
        poisLp[j] = poisLl[j] + lPriorM[j];
        if (poisLp[j] > poisMax) poisMax = poisLp[j];
      }
      let poisW = 0;
      for (let j = 0; j < G; j += 1) poisW += Math.exp(poisLp[j] - poisMax);
      const poisDens = new Float64Array(G);
      for (let j = 0; j < G; j += 1) poisDens[j] = Math.exp(poisLp[j] - poisMax) / (poisW * dM);
      const poisStat = summarise(poisDens, MUS, dM);

      const sm = summarise(margM.subarray(m * G, m * G + G), MUS, dM);
      const ss = summarise(margS.subarray(m * G, m * G + G), SIZES, dS);
      if (sm.peak > topM) topM = sm.peak;
      if (ss.peak > topS) topS = ss.peak;

      steps.push({
        evidence, mu: sm, size: ss, expoM, expoS,
        /* THE HEIGHT OF THE MOST PROBABLE POINT ON THE PLANE, which is what the
           sampler's two bars are drawn against. `lpMax` is the max over the
           grid of exactly the quantity `logPost` returns below — likelihood
           times both priors, with the same normalising constants — so the bars
           and this share a scale without either being rescaled to the other. */
        peak: Math.exp(lpMax),
        poisWidth: poisStat.hi - poisStat.lo,
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
    /* THE PRIORS ARE NORMALISED HERE TOO, and that is not fussiness: the ratio
       panel prints exp() of these numbers beside a P(counts) taken off the
       grid, where the priors ARE normalised. The constants cancel out of every
       acceptance ratio, so the chain is identical either way — but two numbers
       on one screen that are on different scales is a figure that lies. */
    const zS = Math.log(ws * dS);
    const zM = Math.log(wm * dM);
    const logPost = (r, mu) => {
      if (!(r > 0) || !(mu > 0)) return -Infinity;
      let s = 0;
      for (const k of counts) s += nbLogPmf(k, r, mu);
      return s - r / priorSize - zS - 0.5 * ((mu - priorMu) / priorSd) ** 2 - zM;
    };
    const sampleMean = n ? counts.reduce((a, b) => a + b, 0) / n : trueMu;
    const chain = [];
    let cr = 1;
    let cm = Math.max(0.5, sampleMean);
    /* THE START IS A POINT TO DRAW, NOT ONLY A SEED FOR THE LOOP. The tab has
       to show the chain standing on the notebook's declared `initial_values`
       BEFORE the first proposal, or the first press of "Propose a move" is the
       one press that produces nothing: no dot, no dashed line, and a strip
       still reading "nothing proposed yet" for the whole flight. */
    const start = { size: cr, mu: cm, fromRaw: logPost(cr, cm), rate: null };
    let cl = logPost(cr, cm) + Math.log(cr) + Math.log(cm);
    let accepted = 0;
    for (let t = 0; t < DRAWS; t += 1) {
      const pr = Math.exp(Math.log(cr) + rng.normal(0, JUMP_SIZE));
      const pm = Math.exp(Math.log(cm) + rng.normal(0, JUMP_MU));
      const pl = logPost(pr, pm) + Math.log(pr) + Math.log(pm);
      const u = rng.next();
      const take = Math.log(u) < pl - cl;
      /* The BARS show prior x likelihood with no Jacobian, because that is the
         object the cancellation is about — P(theta | counts) x P(counts). The
         WALK carries the Jacobian, because it is sampling log size and log mu.
         Two different quantities, and conflating them would either bias the
         cloud or mislabel the bars. */
      const fromRaw = logPost(cr, cm);
      const toRaw = logPost(pr, pm);
      if (take) { cr = pr; cm = pm; cl = pl; accepted += 1; }
      chain.push({
        size: cr, mu: cm, propSize: pr, propMu: pm, take, u,
        fromRaw, toRaw, ratio: Math.exp(toRaw - fromRaw), rate: accepted / (t + 1),
      });
    }

    return {
      n, counts, countHi, maxMult, trueMu, trueSize,
      priorS, priorM, joint, margM, margS, likM, likS, steps, chain, start,
      beliefTopM: Math.max(topM, priorPeakM) * 1.1,
      beliefTopS: Math.max(topS, priorPeakS) * 1.1,
    };
  },

  animation: {
    /* THE LEAD DEALS THE WHOLE SAMPLE, AND THE SAME WORDS WIDGET 8 USES.
       3.4c says the same class of action should read the same across the arc,
       and this IS widget 8's action on widget 8's data: twelve counts out of the
       lesson's population, once, and that is all you get. Its prohibition is on
       a lead reading like a STEP, and nothing here steps by drawing.

       IT DOES NOT SHOW THE POPULATION, WHICH WIDGET 8 DOES. That needs the
       150px distribution panel widget 8 has and this widget does not — and a
       panel that exists for one animation and is empty for the rest of the
       session is a bad trade. Widget 8 has already shown the arrow running
       parameter -> data on exactly this population; here the lead's job is
       narrower and worth its own button anyway: it establishes that the sample
       is FIXED, by dealing every count at once and leaving the ones you have not
       reached yet on screen as hollow rings. */
    leadLabel: "Draw the counts",
    leadTitle: "Deal your whole sample at once — you never get another one",
    leadHint: "Step and Play wake up once you have counts to work through.",

    /* THE FOURTH TAB DRIVES A DIFFERENT NOUN, so the label follows the tab.
       Three tabs advance the DATA by one observation and the sampler advances
       by one DRAW; those are not the same kind of thing, and one label for both
       is what forced widget 8 into the bland "Step". Core resolves the map and
       reserves the button against every label in it. */
    stepLabel: {
      param: "view",
      labels: { mcmc: "Propose a move" },
      default: "Add a count",
    },
    stepTitle: {
      param: "view",
      labels: { mcmc: "Propose one move, and see whether the chain takes it" },
      default: "Observe one more of the counts you already drew",
    },
    runLabel: "Play",
    runTitle: "Keep going to the end of the sample, or of the chain",

    init({ params, fromScratch, leadDone }) {
      /* TWO CURSORS, AND ONLY TWO. The mu, size and Both tabs are three views of
         the SAME accumulating data, so they share one — switching tabs must not
         cost the counts you collected. The sampler counts something else
         entirely, so it gets its own. */
      const anim = {
        /* Replay keeps a dealt sample: core passes `leadDone` back in, true
           when the reader replayed a finished animation that had already run
           the lead. Only Reset goes back to before it. */
        leadDone: Boolean(leadDone), leadT: leadDone ? 1 : 0,
        obs: 0, draws: 0, flying: false, flyT: 1, done: false,
      };
      const pre = fromScratch ? 0 : Math.max(0, params.shown | 0);
      if (pre > 0) {
        anim.leadDone = true;
        anim.leadT = 1;
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
      /* The one deal of the sample, which then stops. There is nothing to
         repeat, which is the whole point of it being a separate action. */
      if (anim.mode === "lead") {
        if (anim.leadDone) return false;
        anim.leadT = Math.min(1, anim.leadT + dt / LEAD_MS);
        if (anim.leadT < 1) return true;
        anim.leadDone = true;
        return false;
      }
      if (!anim.leadDone || anim.done) return false;
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
    /* The sampler always fits the finished dataset, exactly as brms would — but
       only once there IS one. Before the lead it would otherwise open on the
       full posterior, which is the answer, given away (2.1). */
    const m = params.view === "mcmc" ? (anim.leadDone ? n : 0) : anim.obs;
    const S = steps[m];

    /* ---- the counts, one at a time ------------------------------------- */
    const pA = makePlot({
      ctx, colors, rect: { x: PAD_L, y: A_Y, w: plotW, h: A_H },
      xDomain: [-0.5, countHi + 0.5], yDomain: [0, Math.max(3, state.maxMult)],
    });
    pA.caption(!anim.leadDone
      ? (anim.leadT > 0 ? "Dealing your sample…" : "Press “Draw the counts” to begin")
      : params.view === "mcmc"
        ? `All ${n} counts — the sampler fits the finished dataset, as brms would`
        : m === 0 && !anim.flying
          ? `${n} counts dealt, none observed yet — press “Add a count”`
          : `Your counts — ${m} of ${n} observed, ${n - m} still to come`);

    /* SOLID FOR OBSERVED, HOLLOW FOR STILL TO COME. The sample is fixed from the
       moment the lead runs, and the pending rings are what says so — you can
       count what is left, which is what tells a reader the answer is still
       moving. Rings rather than faint fills: mocked all three ways in
       _lab/mcmc-panel.html and at n = 60 a low-opacity pending dot is
       indistinguishable from a solid one in the same column, while a ring stays
       countable. A separate waiting row also worked and cost 36px more. */
    drawCounts(ctx, pA, counts, n, m, anim, colors);
    pA.axisX({ label: "count — dealt once, and never redrawn" });

    if (plane) drawPlane(ctx, colors, plotW, params, state, anim, m, S);
    else drawMarginal(ctx, colors, plotW, params, state, anim, m, S);
  },

  readout: ({ params, state, anim }) => {
    const view = params.view;
    const m = view === "mcmc" ? (anim.leadDone ? state.n : 0) : anim.obs;
    const S = state.steps[m];

    if (view === "mcmc") {
      const t = anim.draws;
      /* THE SAME TWO TILES THE Both TAB SHOWS, so the sampler is answering the
         same question in the same slots and the comparison is a glance rather
         than an act of memory. Each carries the grid's exact value beside it —
         the only place in the collection where an approximation is checked
         against a truth that is on the same screen and known to be right.
         The acceptance rate moved to the ratio strip, where it belongs: it is a
         property of the proposals, not one of the answers. */
      if (t === 0) {
        return [
          { label: "mu", value: "—", note: `the grid says ${fmt(S.mu.mean, 2)} · press Step and watch the chain find it` },
          { label: "size", value: "—", note: `the grid says ${fmt(S.size.mean, 2)} · brms would take ${BRMS_DRAWS.toLocaleString("en")} draws` },
        ];
      }
      let sumMu = 0;
      let sumSz = 0;
      for (let q = 0; q < t; q += 1) { sumMu += state.chain[q].mu; sumSz += state.chain[q].size; }
      return [
        {
          label: "mu, from the draws",
          value: fmt(sumMu / t, 2),
          note: `${t} draw${t === 1 ? "" : "s"} · the grid says ${fmt(S.mu.mean, 2)} · true ${fmt(state.trueMu, 1)}`,
        },
        {
          label: "size, from the draws",
          value: fmt(sumSz / t, 2),
          note: `the grid says ${fmt(S.size.mean, 2)} · true ${fmt(state.trueSize, 1)}`,
        },
      ];
    }

    if (view === "both") {
      return [
        { label: "mu", value: fmt(S.mu.mean, 2), note: `true ${fmt(state.trueMu, 1)} · 95% within ${fmt(S.mu.lo, 1)} – ${fmt(S.mu.hi, 1)}` },
        { label: "size", value: fmt(S.size.mean, 2), note: `true ${fmt(state.trueSize, 1)} · 95% within ${fmt(S.size.lo, 1)} – ${fmt(S.size.hi, 1)}` },
      ];
    }

    const size = view === "size";
    const P = size ? S.size : S.mu;
    const truth = size ? state.trueSize : state.trueMu;
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
           legitimate only because the curve it is measured on has an area of 1.

           On the mu tab it also carries what REFUSING TO ASSUME is worth, which
           is the whole reason this widget integrates the dispersion out instead
           of pinning it: assume no overdispersion and the same counts and the
           same prior report an interval about half as wide, and wrong. */
        label: "95% credible interval",
        value: `${fmt(P.lo, 1)} – ${fmt(P.hi, 1)}`,
        note: m === 0
          ? "95% of your prior — no counts have narrowed it"
          : size
            ? `95% of the posterior's probability is in here · width ${fmt(P.hi - P.lo, 1)}`
            : `width ${fmt(P.hi - P.lo, 1)} · assume no extra spread and it claims only ${fmt(S.poisWidth, 1)}`,
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
  const truth = size ? state.trueSize : state.trueMu;
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
    ? `Your prior — size averages ${fmt(params.priorSize, 1)}, so you expected ${spreadExpected(params.priorSize)} extra spread`
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
  const planeH = mcmc ? M_H : S_H;
  const planeW = plotW - MARG_W - 8;
  const pS = makePlot({
    ctx, colors, rect: { x: PAD_L, y: S_Y, w: planeW, h: planeH },
    xDomain: [SIZE_LO, SIZE_HI], yDomain: [MU_LO, MU_HI],
  });

  /* Caption and note share this line, so both are kept short enough to sit at
     opposite ends of it — measured, after the first pair overran by 20px and
     printed through each other. */
  pS.caption(mcmc
    ? "A chain wandering over the same posterior"
    : m === 0
      ? "P(size, mu | no counts) — your two priors"
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
  pS.axisX({ ticks: [] });

  // The truth, which we can mark only because the population is seeded.
  pS.dot(state.trueSize, state.trueMu, { fill: colors.reference, r: 5 });
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("truth", pS.sx(state.trueSize) + 10, pS.sy(state.trueMu));
  ctx.restore();

  /* --- the edges: what each tab beside this one shows ------------------- */
  const base0 = m * G * G;
  const margins = (draws) => {
    const mu = [], size = [];
    for (let j = 0; j < G; j += 1) mu.push([MUS[j], state.margM[m * G + j]]);
    for (let i = 0; i < G; i += 1) size.push([SIZES[i], state.margS[m * G + i]]);
    return { mu, size, draws };
  };
  drawEdges(ctx, colors, pS, planeW, planeH, margins(mcmc ? anim.draws : 0), state);

  if (!mcmc) {
    pS.note("50%, 80%, 95% · all of it, 1");
    return;
  }

  /* ---- the chain -------------------------------------------------------- */
  /* THE ANSWER TO "WHY GUESS, WHEN THE ANSWER IS ALREADY ON SCREEN?" — which is
     the sharpest question this widget gets asked, and the right one. You should
     use the grid on this problem. The shading is here so the sampler can be
     watched agreeing with an answer you already have, which is the only way to
     earn trust in it for the problems where you cannot compute one. */
  const t = anim.draws;
  /* AT ZERO DRAWS THE CHAIN IS STILL SOMEWHERE, and its first proposal has to
     animate like every other one. This used to return early — before the dot,
     before the dashed proposal, before the bars — so pressing "Propose a move"
     the very first time left the panel reading "nothing proposed yet" for the
     whole 260ms flight. The one action the tab exists for, invisible exactly
     once, on the press everybody makes. */
  const cur = t === 0 ? state.start : state.chain[t - 1];

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
  pS.note(t === 0
    ? "the exact answer, to aim at"
    : `${t} draw${t === 1 ? "" : "s"} · brms takes ${BRMS_DRAWS.toLocaleString("en")}`);

  /* While a proposal is in flight the strip shows the decision being made; at
     rest it shows the one just made. Showing the NEXT proposal at rest — which
     is what an off-by-one here did — puts a verdict on screen for a move nobody
     has proposed yet. At t = 0 there is no move just made, so at rest the strip
     stays empty and only the flight fills it. */
  const live = anim.flying && t < DRAWS ? state.chain[t] : t > 0 ? state.chain[t - 1] : null;
  /* No rate until a decision has landed: 0/0 proposals accepted is not 0%. */
  ratioStrip(ctx, colors, plotW, live, S, cur, t > 0 ? state.chain[t - 1].rate : null);
}

/* ============================================================================
   THE RATIO, WHICH IS WHY MCMC EXISTS.

   The commonest thing to believe about MCMC is that it goes and computes the
   normalising constant. It does the opposite: P(counts) is the same number on
   the top and the bottom of

       posterior(new)     prior(new) x L(new) / P(counts)
       --------------  =  -------------------------------
       posterior(old)     prior(old) x L(old) / P(counts)

   so it cancels, and the chain never needs it. That is the whole reason the
   method is possible on a model where the integral is not.

   Drawn as two bars from one left edge, both against the height of the most
   probable point on the plane. Chosen in _lab/mcmc-panel.html against a plain
   note and against a version that also carried a histogram of the draws; the
   histogram was cut because at forty draws it reads as the sampler failing
   rather than as the sampler working slowly, and the tab has to survive the
   first hundred presses.

   THE CURRENT POINT USED TO BE PINNED AT FULL WIDTH, and that was wrong in the
   way a chart is wrong when one of its marks never moves. The proposal's length
   was then the acceptance probability read straight off the axis, which is a
   real property and the reason it was built that way — but the top bar encoded
   nothing, its printed value swung across two orders of magnitude underneath a
   length that never changed, and the panel quietly said the chain's position
   was a constant in the one tab whose subject is a chain moving.

   SCALING BOTH TO THE PEAK COSTS NOTHING THE DECISION NEEDS. Accept iff
   ratio > u, and ratio = proposed/current, so

       proposed/current > u   <=>   len(proposed) > len(current) x u

   which is the dart moved from wFull x u to len(current) x u and nothing else.
   The geometry is identical; the top bar now says how far up the posterior the
   chain has climbed, and the walk-in from the notebook's starting guess is
   visible instead of implied.

   AND THE SLIVERS DO NOT MATERIALISE, WHICH IS WHY THIS IS SAFE. Measured over
   the full 600 draws at the defaults, the current point's height as a fraction
   of the peak: median 0.53, quartiles 0.22 and 0.72, with 6% of draws under
   0.05 and 11% under 0.10. So the top bar is a legible length about nine times
   in ten, and the times it is not are the chain genuinely out in a tail — which
   is a thing worth seeing, not an artefact to scale away.

   CAP WENT WITH IT. A better proposal used to run past the current bar and be
   clipped at 1.15x. Against the peak no bar can pass full width, so there is
   nothing to clip: a better proposal is simply a longer bar.

   BOTH BARS TAKE ONE COLOUR. They were briefly coloured by outcome, which made
   accept and reject instant and quietly said they were two different
   quantities. They are one quantity at two points, which is the only reason
   comparing them means anything. The outcome is carried by where u lands and by
   the verdict line.

   MOST PROPOSALS ARE HOPELESS, AND THE PANEL HAS TO SURVIVE THAT. Measured over
   600 draws at these jump sizes: 436 are rejected, and 58% of those score under
   2% of the current point's height — a bar two pixels long. That is not a
   defect to scale away; it is the reason the method is cheap, since rejecting a
   bad proposal costs one ratio and no integral. What WAS a defect is that
   `toFixed(2)` printed every one of them as `ratio 0.00`, which reads as a
   broken figure rather than as a hopeless proposal. Below 0.01 the ratio is
   printed in scientific notation instead, so a sliver says how much of a sliver
   it is.
   ========================================================================= */
function ratioStrip(ctx, colors, plotW, d, S, cur, rate) {
  const x0 = PAD_L;
  // The 1.15x of headroom CAP used to reserve is bar now, not blank canvas.
  const wFull = Math.min(520, plotW - 110);
  const valX = x0 + wFull + 12;
  const rowH = 15, gap = 9;

  /* Both bars share ONE divisor, so their ratio is exact however they are
     clipped. Normally that divisor is the grid's peak; a chain point can sit a
     hair above it, since the grid is 6,400 midpoints and the continuous maximum
     is not one of them, and taking the max keeps the longer bar inside the
     strip without either bar being rescaled relative to the other. */
  const here = Math.exp((d ?? cur).fromRaw);
  const there = d ? Math.exp(d.toRaw) : 0;
  const unit = wFull / Math.max(S.peak, here, there);

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textBaseline = "alphabetic";
  /* These two are hand-drawn rather than a caption/note pair, so core's fallback
     does not reach them and this line does the same job by hand: at the 550px
     canvas the harness records, the long heading and the rate overlapped by
     33px. The clause that goes is restated verbatim two lines below, in "so the
     chain never computes it". */
  const headLong = "Should it move? Compare the two lengths — nothing else is needed";
  const headShort = "Should it move? Compare the two lengths";
  const rateText = rate === null ? "" : `${Math.round(rate * 100)}% accepted so far`;
  let rateW = 0;
  if (rateText) {
    ctx.font = `${colors.fsXs} ${colors.font}`;      // the rate's own size
    rateW = ctx.measureText(rateText).width;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  }
  ctx.fillText(
    ctx.measureText(headLong).width + rateW + 14 <= plotW ? headLong : headShort,
    x0, R_Y - 8);
  if (rate !== null) {
    // A property of the proposals, so it lives with them rather than in a
    // readout tile that is supposed to hold an answer.
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText(rateText, x0 + plotW, R_Y - 8);
  }
  ctx.restore();

  const row = (i, label, len, value) => {
    const ry = R_Y + i * (rowH + gap);
    /* THE TRACK IS THE AXIS THE BARS ARE NOW ON, not decoration. With the
       current point pinned at full width there was nothing to measure against
       and none was needed; now that both bars move, a bar at half length is
       only readable if its full length is visible behind it. */
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(x0, ry, wFull, rowH);
    ctx.restore();
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x0 - 8, ry + rowH / 2);
    ctx.textAlign = "left";
    ctx.fillStyle = colors.ink2;
    ctx.fillText(value, valX, ry + rowH / 2);
    ctx.restore();
    if (len !== null) {
      ctx.save();
      ctx.fillStyle = colors.empirical;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0, ry, Math.max(2, len), rowH);
      ctx.restore();
    }
    return ry;
  };

  /* Before the first proposal the chain is still SOMEWHERE, and now that the
     plane draws the dot it stands on, the strip shows how high that is. Only
     the second row is empty — which is exactly what "nothing proposed yet"
     means, and is the shape the reader sees filled in one press later. */
  if (!d) {
    row(0, "here now", here * unit, sci(here));
    const ry0 = row(1, "proposed", null, "—");
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    /* Two lines, in the same slot the proposed state uses for its verdict and
       its P(counts) note — so nothing below moves, and the 104-character
       original stops running 60px off a 550px canvas. */
    ctx.fillText("nothing proposed yet — the shading above is the exact answer,", x0, ry0 + rowH + 22);
    ctx.fillText("so the chain can be watched agreeing with something already known to be right",
      x0, ry0 + rowH + 38);
    ctx.restore();
    return;
  }

  row(0, "here now", here * unit, sci(here));
  const ry = row(1, "proposed", there * unit, sci(there));

  /* u, the dart — drawn only when there is something for it to decide. A better
     proposal is taken outright, so a tick there is a dart with nothing to hit.

     THROWN ALONG THE CURRENT BAR, not along the strip: accept iff
     proposed/current > u, which is len(proposed) > len(current) x u. Under the
     old full-width scaling those were the same place.

     Against the DRAWN length, so the dart stays inside the bar it is measuring
     when that bar is at its 2px floor. In the ~2% of draws where the chain is
     far enough into a tail for that to happen the whole strip is a few pixels
     wide and it is the printed ratio, not the bars, that carries the number. */
  if (d.ratio < 1) {
    const ux = x0 + Math.max(2, here * unit) * d.u;
    ctx.save();
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.round(ux) + 0.5, ry - 4);
    ctx.lineTo(Math.round(ux) + 0.5, ry + rowH + 4);
    ctx.stroke();
    ctx.fillStyle = colors.ink1;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`u = ${d.u.toFixed(2)}`, ux, ry + rowH + 6);
    ctx.restore();
  }

  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const ratioText = d.ratio >= 0.01 ? d.ratio.toFixed(2) : sci(d.ratio);
  ctx.fillStyle = d.take ? colors.ink2 : colors.extreme;
  ctx.fillText(
    d.ratio >= 1 ? "the proposal is better · taken without even needing u"
      : d.take ? `ratio ${ratioText} · u landed inside → move anyway`
        : `ratio ${ratioText} · u landed outside → stay, and record here again`,
    x0, ry + rowH + 22);
  ctx.fillStyle = colors.ink3;
  ctx.fillText(
    `both would be divided by P(counts) = ${sci(S.evidence)} — so the chain never computes it`,
    x0, ry + rowH + 38);
  ctx.restore();
}

/**
 * The plane's two edges: mu's marginal standing on the right, size's lying
 * underneath, each aligned with the axis it belongs to.
 *
 * On the Both tab these are the exact curves — literally the bottom panel of
 * the mu tab and of the size tab, which is what makes that tab's claim to be
 * "the joint the other two are the edges of" checkable rather than asserted.
 * On the sampler they get a histogram of the draws underneath, which is the
 * notebook's own output: `post_samples %>% ggplot(aes(x=mu)) + geom_histogram()`.
 * Lumpy at forty draws, close by six hundred — and that gap is exactly why brms
 * takes six thousand.
 */
function drawEdges(ctx, colors, pS, planeW, planeH, edge, state) {
  const { mu, size, draws } = edge;
  let muTop = 0;
  let szTop = 0;
  for (const [, v] of mu) if (v > muTop) muTop = v;
  for (const [, v] of size) if (v > szTop) szTop = v;

  /* Histogram of the draws, density-normalised so it sits on the exact curve's
     own scale rather than beside it. */
  const BW_MU = (MU_HI - MU_LO) / 40;
  const BW_SZ = (SIZE_HI - SIZE_LO) / 40;
  const hMu = new Array(40).fill(0);
  const hSz = new Array(40).fill(0);
  if (draws > 0) {
    for (let q = 0; q < draws; q += 1) {
      const c = state.chain[q];
      const a = Math.floor((c.mu - MU_LO) / BW_MU);
      const b = Math.floor((c.size - SIZE_LO) / BW_SZ);
      if (a >= 0 && a < 40) hMu[a] += 1;
      if (b >= 0 && b < 40) hSz[b] += 1;
    }
    for (let q = 0; q < 40; q += 1) {
      hMu[q] /= draws * BW_MU;
      hSz[q] /= draws * BW_SZ;
      if (hMu[q] > muTop) muTop = hMu[q];
      if (hSz[q] > szTop) szTop = hSz[q];
    }
  }

  /* mu, standing up on the right. The value axis runs left-to-right and mu runs
     bottom-to-top, so this is drawn by hand rather than through makePlot — a
     rotated plot would need a rotated context and every label would come out
     sideways. */
  const mx = PAD_L + planeW + 8;
  const syMu = (v) => pS.sy(v);
  const sxMu = (d) => mx + (d / (muTop * 1.08 || 1)) * MARG_W;
  if (draws > 0) {
    ctx.save();
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.4;
    for (let q = 0; q < 40; q += 1) {
      if (!hMu[q]) continue;
      const y1 = syMu(MU_LO + q * BW_MU);
      const y0 = syMu(MU_LO + (q + 1) * BW_MU);
      ctx.fillRect(mx, y0, sxMu(hMu[q]) - mx, Math.max(1, y1 - y0 - 1));
    }
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = colors.posterior;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  mu.forEach(([v, d], i) => (i ? ctx.lineTo(sxMu(d), syMu(v)) : ctx.moveTo(sxMu(d), syMu(v))));
  ctx.stroke();
  ctx.restore();

  /* size, lying flat underneath, sharing the plane's x-axis exactly. */
  const sy0 = S_Y + planeH + 8 + MARG_H;
  const syS = (d) => sy0 - (d / (szTop * 1.08 || 1)) * MARG_H;
  if (draws > 0) {
    ctx.save();
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.4;
    for (let q = 0; q < 40; q += 1) {
      if (!hSz[q]) continue;
      const x0 = pS.sx(SIZE_LO + q * BW_SZ);
      const x1 = pS.sx(SIZE_LO + (q + 1) * BW_SZ);
      ctx.fillRect(x0, syS(hSz[q]), Math.max(1, x1 - x0 - 1), sy0 - syS(hSz[q]));
    }
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = colors.posterior;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  size.forEach(([v, d], i) => (i ? ctx.lineTo(pS.sx(v), syS(d)) : ctx.moveTo(pS.sx(v), syS(d))));
  ctx.stroke();
  ctx.restore();

  // The axis the plane gave up, now under the edge that shares it.
  const pB = makePlot({
    ctx, colors, rect: { x: PAD_L, y: sy0 - MARG_H, w: planeW, h: MARG_H },
    xDomain: [SIZE_LO, SIZE_HI], yDomain: [0, 1],
  });
  /* THE SAME PLANE THE NOTEBOOK CONTOURS, AND THE SAME WAY UP. Its contour cell
     is `aes(x = size, y = mu)`, and widget 8's surface follows it, so a student
     comparing all three figures never has to re-orient. */
  pB.axisX({ label: "size — larger means LESS spread, and Poisson is off the right" });

  /* Short, and in the margins, because the plane's own caption and note already
     own the line above it and the tick row owns the line below. */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // Just the parameter's name: the left margin is 54px and "size, drawn" needs
  // 55 of them, and the bars already say whether these are draws.
  ctx.fillText("mu", mx, S_Y - 8);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("size", PAD_L - 8, sy0 - MARG_H / 2);
  ctx.restore();
}

/** One dot per observation: solid once observed, a ring while still to come. */
function drawCounts(ctx, p, counts, n, m, anim, colors) {
  if (!anim.leadDone && anim.leadT <= 0) return;
  /* THE DOT FITS ITS ROW, WHICH MATTERS ONLY AT THE TOP OF THE n SLIDER. The
     strip is 46px whatever n is, so its rows get shorter as the tallest column
     grows: at n = 60 seven rows are 6.6px apart and a fixed 3.6px radius drew
     columns that touched, turning countable dots into solid bars — in the one
     figure whose hollow rings exist to be counted. At the default n the pitch is
     15px and this leaves the radius exactly where it was. */
  const pitch = p.sy(0) - p.sy(1);
  const r = Math.max(1.4, Math.min(3.6, pitch / 2 - 0.5));
  const seen = new Array(Math.ceil(p.xDomain[1]) + 2).fill(0);
  for (let i = 0; i < n; i += 1) {
    const k = counts[i];
    const level = seen[k];
    seen[k] += 1;
    /* During the deal the counts cascade in, so the sample arriving all at once
       still reads as twelve things rather than one event. */
    if (!anim.leadDone) {
      const start = 0.05 + 0.7 * (n > 1 ? i / (n - 1) : 0);
      if (anim.leadT < start) continue;
    }
    const cx = p.sx(k);
    const cy = p.sy(level + 0.5);
    /* The one being counted right now fills in and settles — the only motion a
       press produces, since nothing arrives from anywhere: the count was already
       on screen, waiting. */
    const filling = anim.leadDone && anim.flying && i === m;
    const t = filling ? anim.flyT : 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, filling ? r + 3 * (1 - t) : r, 0, Math.PI * 2);
    if (i < m || filling) {
      ctx.globalAlpha = filling ? Math.max(0.25, t) : 1;
      ctx.fillStyle = colors.empirical;
      ctx.fill();
    } else {
      ctx.strokeStyle = colors.empirical;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }
}
