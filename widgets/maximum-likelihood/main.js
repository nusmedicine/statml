/* ============================================================================
   Maximum likelihood — widget 8, and the first of the inference arc.

     what makes the data most likely -> what the data make likely -> and if the
     data is a mixture, where the labels are missing

   Hosted by `03 / 02-02 — Inferential Statistics: Inferring Parameters`, which
   supplies the model: a negative binomial, the distribution RNA-seq counts
   actually take.

   MISCONCEPTION TARGETED: that the likelihood is a probability distribution
   over the PARAMETER — that a taller curve at theta means theta is more
   probable. It is P(data | theta) read as a function of theta for fixed data.
   The stronger form, "the MLE is the most probable parameter value", is the
   BAYESIAN statement, and dissolving that reversal is what the #8/#9 pair is
   for. docs/catalogue.md grades the evidence, and grades it `reported`.

   THE DISTINCTION IS TWO NUMBERS, NOT A CAPTION. Probability and likelihood are
   the same formula read in two directions, and both directions are on screen,
   so the cheapest honest way to separate them is to print what each one totals:

       panel A   parameter fixed, DATA varies    -> "all spikes add to 1.000"
       panel C   data fixed, PARAMETER varies    -> "these add to 8.4e-17, not 1"

   Panel A's total is EXACT, and that is the whole reason this widget is built on
   counts rather than on a normal. On a discrete model it is a sum of genuine
   probabilities and prints 1.000; on a normal it is the area under a density,
   which is one more abstraction handed to someone already unsure which object is
   a distribution. Mocked both ways in _lab/likelihood.html before choosing.

   THE LEAD ACTION IS THE PROBABILITY DIRECTION. `Draw the counts` shows the
   distribution they come from, drops them out of it, and then takes it away for
   good — the one time the arrow runs parameter -> data. Every press after it
   runs data -> parameter. Same lead-button grammar as widgets 3 and 5, where the
   button greying out permanently IS the teaching; here it carries a different
   idea with the same affordance. Reset brings it back, because a lecture gets a
   second pass.

   PANEL A IS ONE POINT OF PANEL C, and the widget is built so that reading is
   forced rather than suggested: one press moves the candidate in panel A AND
   drops exactly one dot into panel C, and panel B prints the product that dot's
   height IS.

   TWO SWEEPS, ONE AFTER THE OTHER — AND STAGE ONE ASSUMES POISSON.

       one   assume no extra dispersion. Sweep the MEAN.
       two   fix that mean. Sweep the DISPERSION.

   Two 1-D sweeps rather than one 2-D one, and the difference is not cosmetic.
   A SURFACE VERSION WAS BUILT AND CUT: it swept one mean-column at a time, so
   each press evaluated one mean and ALL the dispersions, and the mean's curve
   grew a dot per press while the dispersion's was complete after the first one.
   A reader watching that concludes the two parameters behave differently, which
   is an artefact of the sweep order. Two sequential sweeps animate identically —
   41 presses each, one dot each — so the asymmetry cannot arise.

   STAGE ONE ASSUMES POISSON, which is what makes stage two inevitable rather
   than optional. Poisson is the negative binomial at dispersion zero, so the
   assumption sits exactly on the LEFT END of stage two's axis: stage two starts
   where stage one assumed and sweeps rightward from it. And because the counts
   are genuinely overdispersed, the best Poisson VISIBLY FAILS to cover them —
   the model is too narrow for the data, on screen, before anything is said.

   That carries a lesson worth more than the fiction it replaces. The widget used
   to hold the dispersion at its true value and call it "known", which is
   something nobody can say about real data. Now: MAXIMUM LIKELIHOOD GIVES YOU
   THE BEST PARAMETER FOR THE MODEL YOU ASSUMED, AND IF THE MODEL IS WRONG THE
   BEST PARAMETER IS STILL WRONG. Stage two is the fix, and it is worth a factor
   of 2.2 MILLION in likelihood at n = 12 — measured, and in the readout.

   AND THE MEAN DOES NOT MOVE. Measured over dispersions from 0 to 2, a range of
   the whole panel: the best mean is 9.122 every single time, because for a fixed
   dispersion the negative binomial's MLE for the mean IS the sample mean
   whatever that dispersion is. So stage two can say outright that re-sweeping
   the mean would change nothing. That is the fact the cut surface showed as a
   vertical crest, delivered as a sequence instead of a shape.

   `size` AND `mu`, BECAUSE THAT IS WHAT THE NOTEBOOK AND `dnbinom` TAKE. An
   earlier build used edgeR's dispersion instead — phi = 1/size, so phi = 0 is
   Poisson and larger means MORE spread, which points the intuitive way. It was
   changed back: the lesson writes rnbinom(size = 2.5, mu = 10) and optim over
   c(size, mu), and a student who read "dispersion" here and `size` there would
   have had to invert it in their head every time. Matching the lesson wins.

   THE DIRECTION WARNING IS THEREFORE THE WIDGET'S JOB. var = mu + mu^2/size, so
   a LARGER size means LESS spread and size -> infinity is Poisson. The notebook
   does not say this anywhere; the size slider's detail line does.

   OTHER THINGS WORTH KNOWING:

   - STAGE ONE'S ANSWER IS CHECKABLE, which is why it can carry the widget alone.
     With the spread fixed, the MLE for the mean is EXACTLY the sample mean —
     d/dmu of the NB log-likelihood gives -n*r*mu + r*sum(k) = 0, so mu = sum(k)/n
     outright, whatever r is. So the widget is seen reproducing an estimator the
     reader already trusts. The peak lands on the nearest GRID point rather than
     on the mean itself, which is honest about what a grid search returns.

   - THE ESTIMATE IS NOT THE TRUTH, and the readout says so rather than leaving a
     reader to conclude the method is broken. The sample mean is 9.17 against a
     true 10: that is twelve counts' worth of sampling error, which widgets 2 to 4
     spent three widgets establishing.

   - NO SPEED CONTROL, deliberately. Widgets 3 and 5 offer one because they have a
     per-item choreography worth switching off at pace. Here a press produces one
     candidate and one dot; a speed control would only change how fast a dot
     appears, which is not an idea (principle 3.5).

   - THE COUNT AXIS RATCHETS TO THE DATA in steps of 8, and stays put for the
     whole animation. Measured across every reachable (n, seed): the largest count
     seen is 58, and 4% of states exceed 32, so a pinned 32-wide axis would drop
     an observation off the panel in one state in twenty-five. 2.5 forbids
     rescaling per FRAME; choosing a frame that holds the data is what it asks.
   ========================================================================= */

import {
  defineWidget, makePlot, niceTicks, fmt, sci, sup, nbLogPmf, nbPmf, nbDraw,
} from "../core/index.js";

/* --- the model, at the lesson's own numbers, in edgeR's parameterisation - *
 * The lesson says size = 2.5; edgeR says dispersion, and dispersion = 1/size.  */
/* THE NOTEBOOK'S OWN CALL, VERBATIM: rnbinom(1000, size = 2.5, mu = 10), and
   dnbinom(x, size, mu) for the likelihood. This widget uses `size` and `mu` and
   nothing else, so a student can move between the two without translating.

   `size` RUNS BACKWARDS AND THE WIDGET SAYS SO. var = mu + mu^2/size, so a
   LARGER size means LESS spread and size -> infinity is Poisson. An earlier
   build used edgeR's dispersion instead (phi = 1/size, phi = 0 is Poisson),
   which points the right way but is not what the notebook or `dnbinom` take —
   and a student who read "dispersion" here and `size` there would have had to
   invert it in their head. Matching the lesson wins; the direction warning is
   the widget's job, and the notebook does not carry one. */
const TRUE_MU_DEF = 10;
const TRUE_SIZE_DEF = 2.5;

/* --- the candidate grid -------------------------------------------------- *
 * Centred on TRUE_MU, never on the estimate — widget 3's rule — and no wider
 * than it has to be, because PANEL A'S FRAME IS SET BY THE WORST CANDIDATE IN
 * THE RANGE. A candidate at a low mean is a tall narrow spike over empty space,
 * so it needs the height, and every other candidate then lives under it. At
 * [2, 18] the best candidate used 28% of the panel and the rest was white space.
 * At [4, 16] it uses 47%, and the likelihood curve still falls to 4% of its peak
 * at the right-hand end and 0.02% at the left. Measured, not guessed.          */
/* The candidate window follows the TRUE mean and is centred on it — widget 3's
   rule — at a fixed +/-40%, which reproduces [6, 14] at the default mean of 10.
   Measured there: the best candidate uses 47% of panel A's height and the
   likelihood curve still falls to 0.01% of its peak at both ends. */
const GRID = 41;
const muWindow = (trueMu) => [0.6 * trueMu, 1.4 * trueMu];
const muAt = (trueMu, g) => {
  const [lo, hi] = muWindow(trueMu);
  return lo + ((hi - lo) * (g + 0.5)) / GRID;
};

/* Dispersion candidates run to 2.5 while the TRUE dispersion stops at 1,
   because the estimate is biased upwards at small n — at a true 0.4 and n = 12
   it lands on 0.76 — and a candidate range that cannot reach the answer would
   report the edge of the panel as the peak. Zero is included exactly: it is
   Poisson, which is what the mean tab assumes. */
/* The notebook's contour grid is seq(0, 10) for size. Zero is degenerate, so
   this starts at 0.5. Measured on it: the peak sits 17% across and the curve is
   still at 4% of its maximum at the right-hand end, so the shape reads. */
const SIZE_LO = 0.5;
const SIZE_HI = 10;
const sizeAt = (g) => SIZE_LO + ((SIZE_HI - SIZE_LO) * (g + 0.5)) / GRID;

/* TWO DIFFERENT STARTING POINTS, AND CONFLATING THEM WAS A MISTAKE.

   `optim` is handed initial_values <- c(size = 1, mu = mean(data)) — a SOLVER
   detail, a place to begin iterating from. The climb tab starts there too.

   IT IS NOT, HOWEVER, WHAT optim THEN DOES, and an earlier version of this
   comment claimed it was. `optim(method = "BFGS")` is quasi-Newton: it takes the
   gradient (numerically, since the notebook supplies no `gr=`), corrects the
   direction with an approximation to the inverse Hessian, and line-searches along
   it — so EVERY iteration moves BOTH parameters at once, diagonally. Measured on
   this data from the same start: BFGS-style steps run at 21deg, 111deg, 21deg,
   110deg and take six iterations; the climb here runs straight up, straight
   across, and is done in two. Both land in the same place — (2.14, 8.66) against
   (2.15, 8.67) — so the ANSWER is the same and only the PATH differs.

   Coordinate ascent is kept anyway, and not because it is easier: each of its
   moves is exactly one of the other two tabs run once, which is the whole reason
   the third tab reads as a synthesis rather than as a new idea. A diagonal
   gradient path would be truer to `optim` and would teach nothing the other tabs
   have not already set up.

   The mu tab needs something else: a MODELLING assumption to sweep under. Using
   size = 1 there was mimicking the wrong thing, and it broke the figure — at
   size = 1 the data is assumed so overdispersed that the mean's likelihood
   interval ran off both ends of the panel and the readout reported a span equal
   to the whole window. Poisson is the assumption an analyst actually makes
   before thinking about overdispersion, it gives a sharp unclipped peak, and it
   is what makes the size tab's "this cost you a factor of 30,000" mean
   anything. */
const CLIMB_START_SIZE = 1;       // optim's initial_values, verbatim
const ASSUMED_SIZE = Infinity;    // the mu tab: Poisson, i.e. no overdispersion

/* Contour bands for the `both` tab, as drops in log-likelihood from the peak.
   Stepped rather than a smooth ramp so the contour is countable — mocked both
   ways in _lab/two-then-both.html and the smooth one read as a blur. */
const BANDS = [0.5, 1, 2, 3, 5, 10, 20];
const BAND_ALPHA = [0.80, 0.64, 0.50, 0.38, 0.27, 0.18, 0.10, 0.045];
const CLIMB_MOVES = 5;

const LEAD_MS = 2600;
const STEP_MS = 420;
const PLAY_MS = 95;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t * t * (3 - 2 * t);

/* --- the negative binomial ------------------------------------------------ *
 * `nbLogPmf` / `nbPmf` / `nbDraw` moved to core/stats.js when widget 9 became
 * their second consumer. dnbinom(x, size, mu, log = TRUE), argument order and
 * all, with the Poisson limit taken explicitly at size = Infinity.            */

/** log P(counts | size, mu). One definition, summed — 41 candidates at n = 60 is
    2,460 evaluations, so there is nothing here worth factorising and a second
    copy of the formula to keep in step. (Widget 9 evaluates 6,400 cells at
    every count and DOES factorise; the two are far enough apart that neither
    wants the other's version.) */
function sumLogLik(counts, size, mu) {
  let ll = 0;
  for (const k of counts) ll += nbLogPmf(k, size, mu);
  return ll;
}

/* --- display helpers ----------------------------------------------------- *
 * `sci` and `sup` moved to core when widget 9 became their second consumer.
 * The exponent IS the teaching in both — it is what a probability distribution
 * over a parameter could not do — so both widgets should print it identically. */

/** A ratio, written so it can be read aloud. Comma-grouped while that is
    shorter than the exponent, then a bare power of ten — "x 10^25" is one number
    to take in, where "8.4 x 10^25" is two. */
function ratio(v) {
  if (!(v > 1) || !Number.isFinite(v)) return "—";
  if (v < 1e6) return `× ${Math.round(v).toLocaleString("en")}`;
  return `× 10${sup(Math.round(Math.log10(v)))}`;
}

/* --- panel geometry ------------------------------------------------------ */
const PAD_L = 62; // the rotated y-axis label needs it; 48 clipped "probability"
const PAD_R = 18;
const A_Y = 34, A_H = 150; //  the candidate, over the count axis
const D_Y = 188, D_H = 32; //  the data strip, sharing panel A's x-axis
const B_Y = 284, B_H = 58; //  the n factors, on one scale
const C_H = 178;        // a curve
const C_H_SURF = 232;   // the contour, which needs a readable aspect

/* Panel B carries no axis label of its own: a CENTRED label under it and the
   LEFT-ALIGNED caption of the panel below read as one collided line even when
   their boxes do not actually overlap. It says "smallest count first" in its
   caption instead, where there is room. */
const cTop = (factors) => (factors ? 380 : 288);

/* A panel that can be hidden has to give its pixels back, or a toggle trades a
   chart for the same amount of blank canvas. */
const canvasHeight = ({ factors, estimate }) =>
  cTop(factors) + (estimate === "both" ? C_H_SURF : C_H) + 46;

/** The 1/8-likelihood interval over a grid of log-likelihoods, in the
    parameter's own units: every candidate within log(8) of the maximum. THE
    QUANTITY THAT ACTUALLY IMPROVES WITH n, which is why it is on screen. */
const LOG8 = Math.log(8);
function likelihoodInterval(ll, at) {
  let max = -Infinity;
  for (const v of ll) if (v > max) max = v;
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < ll.length; i += 1) {
    if (ll[i] >= max - LOG8) { if (lo < 0) lo = i; hi = i; }
  }
  return lo < 0 ? null : [at(lo), at(hi)];
}

/** The last index each tab sweeps to: forty candidates, or the climb's moves. */
const lastIndex = (tab) => (tab === "both" ? CLIMB_MOVES : GRID - 1);

function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  return false;
}

defineWidget({
  slug: "maximum-likelihood",
  title: "Maximum Likelihood",
  subtitle:
    "Which parameter value makes what you actually saw most probable? Draw your " +
    "counts once, then try a candidate: every count gets a height under it, and " +
    "the heights multiply to one number. Do that for every candidate and the " +
    "peak is the estimate.",
  layout: "side",
  height: canvasHeight,

  params: {
    /* THE POPULATION, AND THE SIZE SLIDER IS THE BEST CONTROL HERE. Measured at
       n = 12: set it near 20 and the counts are barely overdispersed, the size
       tab finds a large size and reports that Poisson would have done nearly as
       well. Bring it down to the notebook's 2.5 and the same search reports
       Poisson being wrong by four orders of magnitude. That answers a question a
       student actually asks: how would I know I needed the negative binomial
       rather than a Poisson?

       LARGER SIZE MEANS LESS SPREAD, which is the one thing about this
       parameterisation that catches people, so the detail line says it. */
    trueMu: { type: "int", label: "True mean", min: 5, max: 20, default: TRUE_MU_DEF },
    trueSize: {
      type: "float", label: "True size", min: 1, max: 20, step: 0.5,
      default: TRUE_SIZE_DEF,
      detail: "larger size = LESS spread",
    },

    /* 4 to 60. Below 4 the curve barely has a peak; above 60 the likelihood is
       already past 10^-80 and heading for the smallest number a double holds. */
    n: {
      type: "int", label: "Counts in the sample", min: 4, max: 60, default: 12,
      detail: "few enough to see each one's factor",
    },

    /* SEED 46 IS AUTHORED, AND THE PREVIOUS DEFAULT WAS A LIABILITY.

       Seed 12 shipped first, chosen for a nice-looking sample at n = 12. Its
       sample mean then goes 9.17 -> 9.50 -> 8.22 as n goes 12 -> 30 -> 60, so
       the first person to slide the sample size UP watched the estimate get
       WORSE and concluded maximum likelihood was broken. Measured afterwards:
       seed 12 at n = 60 is off by 1.78, which is the unluckiest 3.8% of seeds.
       Nothing was wrong — over 400 seeds the mean absolute error falls 2.63 ->
       1.64 -> 1.02 -> 0.71 against a theoretical 2.82 -> 1.63 -> 1.03 -> 0.73,
       and the sampler's own mean over 400,000 draws is 10.02 — but a default
       that makes the method look broken is a bad default.

       Seed 46 goes 8.67 -> 9.53 -> 10.33: visibly short of the true 10 at
       n = 12, so the estimate-is-not-the-truth lesson still lands, and closing
       in as n grows. Its dispersion estimate is 0.46 against a true 0.40, and
       assuming Poisson still costs a factor of 10,000. Largest count 20, so the
       count axis stays at its narrowest.

       THE SEED IS NOT THE REAL FIX, though, and must not be relied on: for any
       single sample the estimate CAN get worse with more data, and a student who
       moves the seed will find one that does. What improves reliably is the
       PRECISION, so the readout leads with the likelihood interval — which falls
       3.32 -> 2.15 -> 1.17 even on the unlucky seed 12. */
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 46 },

    /* THE Likelihood / Log TOGGLE WAS CUT. It offered a second axis convention
       to explain — and the log is what `optim` maximises, which is a fact for
       whoever is teaching rather than for a biology MSc meeting likelihood for
       the first time. The raw axis needs no defending: its exponent is factored
       out into the label, so the plotted numbers are 0-2 whatever n is. */

    factors: {
      type: "bool", label: "Each count's factor", default: true, display: true,
    },

    /* WHICH PARAMETER AM I ESTIMATING — the control the widget was missing, and
       the reason it read as confusing. A negative binomial HAS two parameters,
       and a widget that estimates one while quietly holding the other invites
       exactly the question "so are we recovering the mean, or both?".

       Named for the notebook's own two parameters, so the tabs and
       `optim(c(size, mu), ...)` line up. Three tabs and not a gate, because
       these are three readings of one problem and all three are worth seeing at
       rest (3.3). Each keeps its own cursor, so switching tabs never destroys
       the sweep you were in the middle of.

       `mu` sweeps assuming POISSON — no overdispersion — rather than holding the
       true size and calling it "known", which is a fiction nobody can say about
       real data. It costs nothing: the best mu is the sample mean at every size,
       which is what the size tab then reports. And because these counts really
       are overdispersed, the best Poisson VISIBLY fails to cover them, which is
       what makes the size tab inevitable rather than optional. */
    estimate: {
      type: "segmented",
      label: "Estimating",
      options: [
        { value: "mean", label: "mu", detail: "sweep the mean, assuming Poisson — no overdispersion at all" },
        { value: "disp", label: "size", detail: "sweep the size, with mu fixed at what the first tab found" },
        { value: "both", label: "Both", detail: "a search that climbs the contour one parameter at a time" },
      ],
      default: "mean",
      display: true,
    },

    shown: { type: "int", label: "Pre-tried candidates", min: 0, max: GRID, default: 0, hidden: true },
  },

  /* HALVED. These were 12-20 words each — the longest text in the widget and the
     least read. A legend names a mark; it is not where an idea gets explained. */
  legend: [
    { token: "theory", label: "The candidate — a whole distribution, not a number", mark: "bar" },
    { token: "empirical", label: "Your counts, and what each is worth under that candidate", mark: "dot" },
    { token: "highlight", label: "The candidate on screen now", mark: "line" },
    { token: "reference", label: "The truth, seen once while you draw", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const { n, trueMu, trueSize } = params;
    const counts = [];
    for (let i = 0; i < n; i += 1) counts.push(nbDraw(rng, trueSize, trueMu));
    counts.sort((a, b) => a - b);

    /* Where in the data strip each observation lands: its count, and how many
       earlier observations already share it. The lead animation and the settled
       dot columns both read this, so the two cannot disagree. */
    const slots = [];
    const mult = new Map();
    for (const k of counts) {
      const level = mult.get(k) ?? 0;
      mult.set(k, level + 1);
      slots.push({ k, level });
    }
    const maxMult = Math.max(1, ...mult.values());

    /* The count axis ratchets in steps of 8 to hold the data, and then stays put
       for the whole animation. At the far corner of the parameter box — mean 20,
       dispersion 1 — it has to reach past 200, which looks extreme because IT IS
       extreme: that is genuinely what heavily overdispersed counts do, and it is
       why RNA-seq needs this distribution at all. The default reaches 32. */
    const kMax = Math.max(32, Math.ceil((counts[n - 1] + 3) / 8) * 8);
    const sampleMean = counts.reduce((a, b) => a + b, 0) / n;

    const mus = new Array(GRID);
    const sizes = new Array(GRID);
    for (let g = 0; g < GRID; g += 1) {
      mus[g] = muAt(trueMu, g);
      sizes[g] = sizeAt(g);
    }

    /* TAB ONE: the mean, assuming Poisson. */
    const llMu = mus.map((m) => sumLogLik(counts, ASSUMED_SIZE, m));
    let bestMu = 0;
    for (let g = 1; g < GRID; g += 1) if (llMu[g] > llMu[bestMu]) bestMu = g;

    /* TAB TWO: the dispersion, with the mean fixed at tab one's answer. Fixing
       it costs nothing, and that is the point — the best mean is the sample mean
       at EVERY dispersion, so re-sweeping would return the same candidate. */
    const llSize = sizes.map((sz) => sumLogLik(counts, sz, mus[bestMu]));
    /* The POISSON limit exactly — size -> infinity — not the largest candidate.
       The readout calls this "better than Poisson", so it has to be Poisson, and
       Poisson is off the end of an axis that stops at 10. */
    const llPoisson = sumLogLik(counts, Infinity, mus[bestMu]);
    let bestSize = 0;
    for (let g = 1; g < GRID; g += 1) if (llSize[g] > llSize[bestSize]) bestSize = g;

    /* TAB THREE: the whole surface, and a search that CLIMBS it.
       Coordinate ascent — maximise over one parameter, then the other, and
       repeat. Each move is exactly one of the two sweeps above, so the third tab
       is literally the first two alternating. It converges in TWO moves here and
       the next two visibly do nothing, which is the vertical-crest fact acted
       out: whatever you assume about the dispersion, the best mean is the same.
       Started from the leftmost candidate at dispersion zero — a deliberately
       poor guess, so the first move is a long one. */
    /* THE SURFACE, INDEXED THE WAY THE NOTEBOOK PLOTS IT: size across, mu up.
       Its contour cell is `aes(x = size, y = mu)`, and a student who has seen
       that figure should recognise this one rather than have to re-orient. */
    const surf = new Float64Array(GRID * GRID); // [mu index][size index]
    let surfMax = -Infinity;
    for (let j = 0; j < GRID; j += 1) {
      for (let i = 0; i < GRID; i += 1) {
        const v = sumLogLik(counts, sizes[i], mus[j]);
        surf[j * GRID + i] = v;
        if (v > surfMax) surfMax = v;
      }
    }
    /* COORDINATE ASCENT, and each move is exactly one of the other two tabs run
       once. It starts at the notebook's own size guess of 1 and a deliberately
       poor mu — the notebook starts mu at mean(data), which is already the
       answer, so its first move would do nothing and there would be nothing to
       watch. It is NOT what `optim` does after that: BFGS moves both parameters
       at once along a curvature-corrected gradient. Same optimum, different
       path — see the header. */
    const at = (i, j) => surf[j * GRID + i];
    const startI = Math.max(0, Math.min(GRID - 1,
      Math.round(((CLIMB_START_SIZE - SIZE_LO) / (SIZE_HI - SIZE_LO)) * GRID - 0.5)));
    const climb = [{ i: startI, j: 0, ll: at(startI, 0), moved: true, axis: null }];
    for (let m = 0; m < CLIMB_MOVES; m += 1) {
      const prev = climb[climb.length - 1];
      let i = prev.i;
      let j = prev.j;
      if (m % 2 === 0) {
        for (let q = 0; q < GRID; q += 1) if (at(i, q) > at(i, j)) j = q;
      } else {
        for (let q = 0; q < GRID; q += 1) if (at(q, j) > at(i, j)) i = q;
      }
      climb.push({
        i, j, ll: at(i, j), axis: m % 2 === 0 ? "mu" : "size",
        moved: i !== prev.i || j !== prev.j,
      });
    }

    /* One frame per tab, each from every candidate that tab will visit — never
       from the data, never per frame. An axis that moved as the candidate swept
       would hide the collapse that is the entire mechanism. */
    const frameOf = (ll) => {
      let max = -Infinity;
      let min = Infinity;
      for (const v of ll) { if (v > max) max = v; if (v < min) min = v; }
      /* The exponent comes off the LOG-likelihood, not off exp() of it: at
         n = 200 the likelihood itself is past 1e-308 and exp() returns 0, which
         would make the axis label -Infinity and every plotted value NaN. Scaling
         in log space cannot underflow at any n this widget offers. */
      const expo = Math.floor(max / Math.LN10);
      const shift = expo * Math.LN10;
      const scaled = ll.map((v) => Math.exp(v - shift));
      return {
        ll, lik: ll.map((v) => Math.exp(v)), scaled, max, min, expo,
        yTop: Math.ceil(Math.exp(max - shift) * 1.1 * 2) / 2,
      };
    };
    const muInterval = likelihoodInterval(llMu, (i) => mus[i]);
    const sizeInterval = likelihoodInterval(llSize, (i) => sizes[i]);

    /* Panel A's frames, taken over every candidate ANY tab shows, so the model
       panel does not rescale when a tab is pressed. */
    let peak = 0;
    let fac = 0;
    const seen = [
      ...mus.map((m) => [ASSUMED_SIZE, m]),
      ...sizes.map((sz) => [sz, mus[bestMu]]),
      ...climb.map((c) => [sizes[c.i], mus[c.j]]),
    ];
    for (const [sz, m] of seen) {
      for (let k = 0; k <= kMax; k += 1) peak = Math.max(peak, nbPmf(k, sz, m));
      for (const k of counts) fac = Math.max(fac, nbPmf(k, sz, m));
    }

    return {
      n, trueMu, trueSize, counts, slots, maxMult, kMax, sampleMean,
      mus, sizes, bestMu, bestSize, surf, surfMax, climb,
      muFrame: frameOf(llMu), sizeFrame: frameOf(llSize), llPoisson,
      muInterval, sizeInterval,
      peak, fac,
    };
  },

  animation: {
    /* TWO ACTIONS, AND THE ASYMMETRY IS THE ARGUMENT. The lead runs the model
       forwards — parameter to data — exactly once, and then the distribution it
       came from is gone. Step runs it backwards, as often as you like.

       THE LABELS WERE "Draw" AND "Try one" AND THAT WAS REPORTED AS BROKEN. Not
       the words themselves: with the lead unpressed, core disables step and run,
       so the first thing a reader met was two dead buttons, a blank figure and no
       way to tell a gate from a bug. The lead now says what it draws and
       `leadHint` says what is waiting on it. */
    leadLabel: "Draw the counts",
    leadTitle: "Draw your counts out of the distribution they come from — the only time you will ever see it",
    leadHint: "Step and Play wake up once you have counts to score.",
    stepLabel: "Step",
    stepTitle: "Try the next candidate, or take the next move of the climb",
    runLabel: "Play",
    runTitle: "Run the rest of it",

    init({ params, fromScratch, leadDone }) {
      /* ONE CURSOR PER TAB. The tabs are display-only, so switching must not
         throw away the sweep you were in the middle of — and the three index
         different things, so they cannot be the same number. */
      const anim = {
        /* Replay keeps a dealt sample: core passes `leadDone` back in, true
           when the reader replayed a finished animation that had already run
           the lead. Only Reset goes back to before it. */
        leadDone: Boolean(leadDone),
        leadT: leadDone ? 1 : 0,
        cursor: { mean: -1, disp: -1, both: -1 },
        flyT: 1, //  0..1 arrival of the current candidate's score
        done: false,
      };
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), GRID);
      if (pre > 0) {
        anim.leadDone = true;
        anim.leadT = 1;
        // Applies to whichever tab the link opens on.
        anim.cursor[params.estimate] = pre - 1;
        anim.done = pre - 1 >= lastIndex(params.estimate);
      }
      return anim;
    },

    /* Switching tab re-derives the run button's whole story from the cursor that
       is now live. The mean sweep being finished says nothing about the climb:
       without this, entering a fresh tab showed "Replay" over an empty panel.
       (It then showed "Resume" for the same reason, until core retired that
       label outright — a Step should not offer to continue a run.) */
    rebuild(anim, { params }) {
      const live = anim.cursor[params.estimate];
      anim.done = live >= lastIndex(params.estimate);
      anim.flyT = 1;
    },

    advance(anim, { dt, params }) {
      /* The one draw from the population, which then stops. There is nothing to
         repeat, which is the whole point of it being a separate action. */
      if (anim.mode === "lead") {
        if (anim.leadDone) return false;
        anim.leadT = Math.min(1, anim.leadT + dt / LEAD_MS);
        if (anim.leadT < 1) return true;
        anim.leadDone = true;
        return false;
      }
      if (!anim.leadDone || anim.done) return false;

      const tab = params.estimate;
      const last = lastIndex(tab);
      // The climb has five moves against the sweeps' forty-one, so a single pace
      // would either race through it or crawl through them.
      const dur = anim.mode === "step" || tab === "both" ? STEP_MS : PLAY_MS;

      if (anim.flyT < 1) {
        anim.flyT = clamp01(anim.flyT + dt / dur);
        if (anim.flyT < 1) return true;
        if (anim.cursor[tab] >= last) return halt(anim, { finished: true });
        if (anim.mode === "step") return halt(anim);
      }

      if (anim.cursor[tab] >= last) return halt(anim, { finished: true });
      anim.cursor[tab] += 1;
      anim.flyT = 0;
      return true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const { counts, slots, kMax, n } = state;
    const xDomain = [-0.5, kMax + 0.5];
    const plotW = w - PAD_L - PAD_R;

    /* HOW FAR THE SWEEP HAS GOT, and which candidate is on screen. They are the
       same until the sweep finishes, and then they are not: the grid ends on
       mu = 15.9, which is the WORST candidate of the 41, and leaving it in the
       figure's headline panel means a completed search displays a model that
       fits nothing. Once there is nothing left to try, the candidate on screen
       is the answer. */
    const tab = params.estimate;
    const both = tab === "both";
    const swept = anim.cursor[tab];

    /* WHICH CANDIDATE IS ON SCREEN. Until a sweep finishes these are the same;
       afterwards they are not, because the mean grid ends on its worst candidate
       and leaving that in the figure's headline panel means a completed search
       displays a model that fits nothing. Once there is nothing left to try, the
       candidate on screen is the answer. The climb is exempt: its last position
       IS its answer. */
    const F = both ? null : (tab === "disp" ? state.sizeFrame : state.muFrame);
    const cand = both ? null : (tab === "disp" ? state.sizes : state.mus);
    let bestI = 0;
    if (!both) for (let i = 1; i <= swept; i += 1) if (F.ll[i] > F.ll[bestI]) bestI = i;
    const g = both ? swept : (anim.done && swept >= 0 ? bestI : swept);
    const live = g >= 0;

    /* The candidate DISTRIBUTION, whichever parameter is moving. */
    const spot = both && live ? state.climb[g] : null;
    const mu = !live ? null
      : both ? state.mus[spot.j]
      : tab === "disp" ? state.mus[state.bestMu]
      : state.mus[g];
    const size = !live ? ASSUMED_SIZE
      : both ? state.sizes[spot.i]
      : tab === "disp" ? state.sizes[g]
      : ASSUMED_SIZE;

    /* ---- panel A: one candidate, over the count axis ------------------- */
    const yMaxA = state.peak * 1.08;
    const pA = makePlot({
      ctx, colors,
      rect: { x: PAD_L, y: A_Y, w: plotW, h: A_H },
      xDomain, yDomain: [0, yMaxA],
    });
    const aTicks = niceTicks(0, yMaxA, 4);
    pA.grid(aTicks);
    pA.axisY({ ticks: aTicks, format: (t) => t.toFixed(2), label: "probability" });
    pA.caption(
      !anim.leadDone
        ? (anim.leadT > 0 ? "The distribution your counts come from" : `Press “Draw the counts” to begin`)
        : !live
          ? "No candidate tried yet — press Step"
          : both
            ? `The climb is at size ${fmt(size, 2)}, mu ${fmt(mu, 2)}`
            : tab === "disp"
              ? `mu fixed at ${fmt(mu, 2)}. If size were ${fmt(size, 2)}, how often would each count turn up?`
              : `If mu were ${fmt(mu, 1)} and the counts were Poisson, how often would each turn up?`
    );

    /* THE TRUE DISTRIBUTION, DURING THE LEAD AND NEVER AGAIN. Fades in, drops
       the counts out of itself, fades out. That is the arrow running forwards;
       everything after this runs backwards. */
    if (!anim.leadDone && anim.leadT > 0) {
      const t = anim.leadT;
      const alpha = t < 0.12 ? t / 0.12 : t > 0.82 ? clamp01((1 - t) / 0.18) : 1;
      const pts = [];
      for (let k = 0; k <= kMax; k += 1) pts.push([k, nbPmf(k, state.trueSize, state.trueMu)]);
      pA.curve(pts, { stroke: colors.reference, width: 2, dash: [5, 4], opacity: alpha });
    }

    if (live) {
      const spikes = [];
      for (let k = 0; k <= kMax; k += 1) spikes.push([k, nbPmf(k, size, mu)]);
      pA.spikes(spikes, { fill: colors.theory, opacity: 0.32, width: Math.max(3, Math.min(13, plotW / (kMax + 1) - 4)) });

      /* ONE STEM PER OBSERVATION: the factor it contributes. A stem and not a
         dot on the curve, because a length from the baseline is what gets read
         as a magnitude, and this figure is entirely about magnitudes that
         collapse. Duplicates land on one stem — which is what the data strip
         below exists to undo. */
      for (const k of counts) pA.curve([[k, 0], [k, nbPmf(k, size, mu)]], { stroke: colors.empirical, width: 2 });
      for (const k of counts) pA.dot(k, nbPmf(k, size, mu), { fill: colors.empirical, r: 3.2 });

      /* THE OTHER HALF OF THE DISTINCTION. These heights are a distribution over
         the DATA and they add to 1 exactly — printed, because the panel below
         prints what its own heights add to and it is not 1. */
      let total = 0;
      for (let k = 0; k <= 600; k += 1) total += nbPmf(k, size, mu);
      pA.note(`all spikes add to ${total.toFixed(3)}`, { inside: true });
    }

    /* ---- the data, in its own strip under the model, sharing its x-axis.
       Inside panel A the duplicates land on one stem and stop being countable,
       which is exactly what principle 2.3 forbids while n is small. ---- */
    const pD = makePlot({
      ctx, colors,
      rect: { x: PAD_L, y: D_Y, w: plotW, h: D_H },
      xDomain, yDomain: [0, Math.max(3, state.maxMult)],
    });

    // How far each observation has fallen out of the true distribution.
    const fallOf = (i) => {
      if (anim.leadDone) return 1;
      if (anim.leadT <= 0) return 0;
      const start = 0.14 + 0.52 * (n > 1 ? i / (n - 1) : 0);
      return clamp01((anim.leadT - start) / 0.26);
    };

    const settled = new Array(kMax + 1).fill(0);
    const flying = [];
    for (let i = 0; i < n; i += 1) {
      const f = fallOf(i);
      if (f >= 1) settled[slots[i].k] += 1;
      else if (f > 0) flying.push({ i, f });
    }
    pD.dotColumns(settled, { lo: -0.5, width: 1, fill: colors.empirical, maxR: 3.6 });
    for (const { i, f } of flying) {
      const { k, level } = slots[i];
      const y0 = pA.sy(nbPmf(k, state.trueSize, state.trueMu));
      const y1 = pD.sy(level + 0.5);
      const px = pD.sx(k);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, y0 + (y1 - y0) * easeInOut(f), 3.6, 0, Math.PI * 2);
      ctx.fillStyle = colors.empirical;
      ctx.fill();
      ctx.restore();
    }
    pD.axisX({
      label: anim.leadDone
        ? `count — your ${n} observations, drawn once and never redrawn`
        : `count — ${n} observations`,
    });

    /* ---- panel B: the n factors, on one scale -------------------------- */
    if (params.factors) {
      const pB = makePlot({
        ctx, colors,
        rect: { x: PAD_L, y: B_Y, w: plotW, h: B_H },
        xDomain: [0, n], yDomain: [0, state.fac * 1.06],
      });
      /* NAME THE PAIR. "Multiply these together" was asked, reasonably, "multiply
         WHAT — both mu and size?". Every factor is P(count | size, mu) and always
         uses BOTH parameters; the tabs differ only in which one is moving. Saying
         the pair here removes the question. */
      pB.caption(live
        ? `Its ${n} factors at ${both || tab === "disp" ? `size ${fmt(size, 2)}, ` : "Poisson, "}mu ${fmt(mu, 2)} — multiply these together`
        : `One factor per count`);
      pB.axisX({ ticks: [] });
      if (live) {
        pB.bars(counts.map((k) => nbPmf(k, size, mu)), { lo: 0, width: 1, fill: colors.empirical });
        // Adjacency is the argument (2.7): this product IS the height of the dot
        // the panel below is about to receive.
        pB.note(`product = ${sci(Math.exp(both ? spot.ll : F.ll[g]))}`, { tone: colors.empirical });
      }
    }

    /* ---- panel C ------------------------------------------------------- */
    const cY = cTop(params.factors);
    const [muLo, muHi] = muWindow(state.trueMu);

    if (both) {
      /* THE SURFACE, AND A SEARCH THAT CLIMBS IT. Drawn whole rather than filled
         in, because a raster sweep is the arrangement this widget already tried
         and cut: each press evaluated one mean and ALL the dispersions, so one
         marginal grew a dot at a time while the other was finished after the
         first press. Every established treatment draws the surface first and
         animates a PATH over it, and that is what this does. */
      const pS = makePlot({
        ctx, colors,
        rect: { x: PAD_L, y: cY, w: plotW, h: C_H_SURF },
        xDomain: [SIZE_LO, SIZE_HI], yDomain: [muLo, muHi],
      });
      pS.caption(`log P(the ${n} counts | size, mu) — darker is more likely`);

      /* Cells tile on WHOLE PIXELS. Overlapping them a fraction to close the
         seams double-composites the alpha along every seam and prints a grid
         over the surface, which reads as texture in the data. */
      const px = (i) => Math.round(pS.x + (i * pS.w) / GRID);
      const py = (j) => Math.round(pS.y + pS.h - (j * pS.h) / GRID);
      ctx.save();
      ctx.fillStyle = colors.empirical;
      for (let j = 0; j < GRID; j += 1) {
        for (let i = 0; i < GRID; i += 1) {
          const drop = state.surfMax - state.surf[j * GRID + i];
          let band = BANDS.length;
          for (let b = 0; b < BANDS.length; b += 1) if (drop <= BANDS[b]) { band = b; break; }
          const a = BAND_ALPHA[band];
          if (!a) continue;
          ctx.globalAlpha = a;
          ctx.fillRect(px(i), py(j + 1), px(i + 1) - px(i), py(j) - py(j + 1));
        }
      }
      ctx.restore();
      pS.axisY({ ticks: niceTicks(muLo, muHi, 4), label: "mu" });
      /* THE SAME SURFACE THE NOTEBOOK CONTOURS, UPSIDE DOWN. It plots
         `neg_loglik` and hunts the MINIMUM; this plots the log-likelihood and
         hunts the maximum. Identical function, opposite sign, and a reader
         comparing the two figures needs to be told once. */
      pS.axisX({ label: `size — larger means LESS spread` });

      /* The truth, which we can mark only because the population is seeded —
         widget 3's move. The climb lands somewhere else, and the gap is the
         point rather than an embarrassment. */
      pS.dot(state.trueSize, state.trueMu, { fill: colors.reference, r: 5 });
      ctx.save();
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillStyle = colors.ink2;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("truth", pS.sx(state.trueSize) + 10, pS.sy(state.trueMu));
      ctx.restore();

      if (live) {
        /* ONE PRESS HERE IS A WHOLE SWEEP, AND IT SAYS SO RATHER THAN SHOWING IT.

           The mu and size tabs spend one press per candidate: 41 presses, 41
           dots. This tab spends one press per MOVE, and a move maximises over an
           entire axis — 41 evaluations behind a single click. Five presses
           therefore do 41x the work of five presses next door while looking like
           less, and that was read, reasonably, as "why is the sweep only a few
           steps?".

           IT WAS BRIEFLY ANIMATED AS THE SWEEP IT IS — a scan running the length
           of the axis, a marker trailing it with the best so far — and that was
           reverted for being jarring: a marker shooting off across the panel and
           snapping back, five times, reads as a glitch rather than as a search.
           The note carries it instead. Naming the 41 costs nothing and the
           motion cost legibility.

           Every move is a right angle, because each maximises over ONE
           parameter — which is exactly one of the other two tabs, run once. */
        const pts = state.climb.slice(0, g + 1).map((c) => [state.sizes[c.i], state.mus[c.j]]);
        if (pts.length > 1) pS.curve(pts, { stroke: colors.highlight, width: 2 });
        for (const [x, y] of pts) pS.dot(x, y, { fill: colors.highlight, r: 3.5 });
        pS.dot(state.sizes[spot.i], state.mus[spot.j], { fill: colors.highlight, r: 6 });
        if (g > 0) {
          pS.note(spot.moved
            ? `move ${g} of ${CLIMB_MOVES}: swept all ${GRID} ${spot.axis} candidates`
            : `move ${g}: swept all ${GRID} ${spot.axis} candidates — it did not move`);
        }
      }
    } else {
      const pC = makePlot({
        ctx, colors,
        rect: { x: PAD_L, y: cY, w: plotW, h: C_H },
        xDomain: tab === "disp" ? [SIZE_LO, SIZE_HI] : [muLo, muHi],
        yDomain: [0, F.yTop],
      });
      const what = tab === "disp" ? "size" : "mu";
      pC.caption(`P(the ${n} counts | ${what}) — taller is better   × 10${sup(F.expo)}`);
      const ct = niceTicks(pC.yDomain[0], pC.yDomain[1], 4);
      pC.grid(ct);
      pC.axisY({ ticks: ct });
      pC.axisX({
        label: tab === "disp"
          ? `every candidate size — larger means less spread, and Poisson is off the right`
          : `every candidate mu — your counts never change`,
      });
      pC.vline(tab === "disp" ? state.trueSize : state.trueMu, {
        stroke: colors.reference,
        label: tab === "disp" ? "true size" : "true mu",
        align: "right",
      });

      const yOf = (i) => F.scaled[i];
      if (swept >= 0) {
        /* Joined only as far as the sweep has got. A line running on past it
           would be a claim about a candidate nobody has tried. */
        const pts = [];
        for (let i = 0; i <= swept; i += 1) pts.push([cand[i], yOf(i)]);
        if (pts.length > 1) pC.curve(pts, { stroke: colors.empirical, width: 2, opacity: 0.55 });
        for (let i = 0; i <= swept; i += 1) pC.dot(cand[i], yOf(i), { fill: colors.empirical, r: 3 });
        pC.dot(cand[bestI], yOf(bestI), { fill: colors.empirical, r: 5.5 });

        pC.vline(cand[g], {
          stroke: colors.highlight, width: 2, labelDy: 14, align: "left",
          label: anim.done ? "the estimate" : "this candidate",
        });
        const r = anim.done ? 5.5 : 3 + 4 * (1 - easeOut(anim.flyT));
        pC.dot(cand[g], yOf(g), { fill: colors.highlight, r: Math.max(3, r) });

        /* WHAT IS BEING HELD STILL. A two-parameter model swept one parameter
           at a time raises "so what is the other one doing?", and the answer was
           only in the tab's detail line, which nobody reads. It goes in the slot
           freed by cutting "these add to 8.9e-110 — not 1", which was the weak
           half of the probability-vs-likelihood point: two near-identical huge
           negative exponents asking to be compared by eye. The strong half —
           `all spikes add to 1.000` on the top panel — is exact and already
           there. */
        pC.note(tab === "disp"
          ? `mu is held fixed at ${fmt(state.mus[state.bestMu], 2)} — only size is moving`
          : `size is held fixed — only mu is moving`);
      }
    }
  },

  readout: ({ params, state, anim }) => {
    /* VARIANT C: a number to point at, and a range to point at.
       This readout used to carry four tiles per tab, three of them in scientific
       notation — P(data) at 1e-110, its log, and the sum of the scores — and it
       was read, correctly, as "technical". A biology MSc needs one chain and
       nothing else: guess a parameter, score it, the best score wins, and it is
       not exactly the truth. Every cut number is still on the canvas as a small
       grey note, which is the right weight for a secondary idea.
       Mocked in _lab/plain-language.html against the state that prompted it. */
    const tab = params.estimate;
    const both = tab === "both";
    const g = anim.cursor[tab];
    const live = g >= 0;

    if (!anim.leadDone) {
      return [
        { label: "Your counts", value: "—", note: "not drawn yet" },
        { label: "True mean", value: fmt(state.trueMu, 1), note: `size ${fmt(state.trueSize, 1)}` },
      ];
    }

    if (both) {
      const spot = live ? state.climb[g] : null;
      return [
        { label: "size", value: live ? fmt(state.sizes[spot.i], 2) : "—", note: `true ${fmt(state.trueSize, 1)}` },
        { label: "mu", value: live ? fmt(state.mus[spot.j], 2) : "—", note: `true ${fmt(state.trueMu, 1)}` },
      ];
    }

    const F = tab === "disp" ? state.sizeFrame : state.muFrame;
    const cand = tab === "disp" ? state.sizes : state.mus;
    let best = 0;
    for (let i = 1; i <= g; i += 1) if (F.ll[i] > F.ll[best]) best = i;

    if (tab === "disp") {
      /* THE POISSON RATIO WAS CUT. It answered "why a negative binomial rather
         than a Poisson?", which this lesson does not ask — the negative binomial
         is simply the example. A plausible range says something about the METHOD
         instead, and says it by comparison with the tab next door: at n = 60 the
         mean is pinned to a factor of 1.2 and the size only to 2.6. Some
         parameters are much harder to estimate than others. */
      const iv = anim.done ? state.sizeInterval : null;
      return [
        {
          label: "Best size",
          value: live ? fmt(cand[best], 2) : "—",
          note: `the true size is ${fmt(state.trueSize, 1)} · smaller size means more spread`,
        },
        {
          label: "Plausible range",
          value: iv ? `${fmt(iv[0], 1)} – ${fmt(iv[1], 1)}` : "—",
          note: iv ? "much looser than the mean's — size is the hard one to pin down"
            : `after all ${GRID} candidates`,
        },
      ];
    }

    const iv = anim.done ? state.muInterval : null;
    return [
      {
        label: "Best mean",
        value: live ? fmt(cand[best], 2) : "—",
        note: live
          ? `your ${state.n} counts point here · the true mean is ${fmt(state.trueMu, 1)}`
          : `nothing tried yet — press Step`,
      },
      {
        /* THE THING THAT ACTUALLY IMPROVES WITH MORE COUNTS. Reported the other
           way round — as a point estimate free to wander — this widget was read
           as showing maximum likelihood getting WORSE with more data. */
        label: "Plausible range",
        value: iv ? `${fmt(iv[0], 1)} – ${fmt(iv[1], 1)}` : "—",
        note: iv ? "more counts narrow this — the estimate itself can still be unlucky"
          : `after all ${GRID} candidates`,
      },
    ];
  },
});
