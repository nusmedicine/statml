/* ============================================================================
   Normalization and Transformation — widget 39. DRAFT.

   Hosts at PHM5003 `05 - Introduction to High Throughput Data / 03 -
   Normalization and Transformation`. The misconception it exists to dislodge:
   that "normalising" makes data normal — that scaling and transforming are one
   operation with one purpose.

   ---------------------------------------------------------------------------
   THE LESSON HANDS OVER ITS OWN FIGURE. Every method in `05 / 03` is judged in
   the same two-panel picture — a boxplot per sample, and a mean-versus-variance
   scatter over genes — and the notebook writes the verdict underneath each one
   as two bullets, "Effect on: Distribution" and "Effect on: Mean-Variance
   Relationship". So the widget is those two panels and the tiles are the
   notebook's own claims, turned into numbers.

   THE RAIL IS THE ARGUMENT. Two controls applied in order — Normalize, then
   Transform — rather than one picker of ten methods. The reader can compose
   them (quantile, THEN log) and watch that neither does the other's job. The
   widget's own opening stage, seed 1:

                       scale    skew     rho
       None   + none    0.481   3.030   0.955
       Median + none    0.000   2.990   0.953  <- normalize moved SCALE only
       None   + log     0.549  -0.061   0.529  <- transform moved skew and rho
       Median + log     0.000  -0.078   0.543

   No single control moves all three. That is principle 2.7 — adjacency is the
   argument — spent on the control block rather than on the figure.

   AND THE THREE SCALINGS ALL READ 0.481, exactly. None, min-max and z-score
   agree to six decimal places because the scale tile is a ratio of two
   differences and therefore survives any affine map. That equality IS the
   lesson, and it only exists because the tile's denominator was fixed: see
   `sampleSpread` in model.js for the version that got it wrong and how the
   canvas text sweep caught it.

   ---------------------------------------------------------------------------
   WHY MIN-MAX AND Z-SCORE DRAW A PICTURE THAT DOES NOT MOVE, and why that is
   the point rather than a bug. Both are ONE affine map applied to every value
   in the table, so the shape cannot move: measured, the pooled skew is
   unchanged to 7e-14, which is float noise. The AXIS LABELS carry the other
   half — 0 to 806 before, 0 to 1 after — and they only do so because panel 1's
   axis holds every value rather than the middle 90%. It was fitted to p5..p95
   at first and min-max's axis then topped out at 0.41, so the one method that
   states its own output range in its name never showed it (Kenneth, 2026-09-02:
   "why doesn't the y-axis scale change"). Fitting per state also rescaled the
   SKEW away, which is why raw and log(1+y) drew near-identical pictures while
   the tiles read 3.03 against -0.06. Tukey whiskers and a full-range axis put
   both back: the box is 6% of the panel on raw and 19% after the log.

   Median normalisation is the exception that proves what "affine" is doing
   here: it is affine PER SAMPLE and is not one map over the table, so it does
   move the pooled skew, 2.978 -> 3.014. Small, real, and the reason nothing on
   screen says "affine" — it says "scaling".

   ---------------------------------------------------------------------------
   THE STAGE IS GAMMA AND THE TECHNICAL VARIATION IS A CONTROL. Both settled on
   measurement; the full record and the losing candidates are in
   `docs/catalogue.md` § Slot 1, and `model.js` carries the stage table. The
   short version:

     - The notebook's `simulate_data` draws every sample from the SAME mean
       vector, so its ten samples are already on one scale and every normaliser
       has nothing to correct. `spread` gives sample j a multiplier. Turning it
       to none IS the notebook's stage, which is why it is a control and not
       a constant: the reader can see the methods stop separating.
     - Counts cannot carry quantile normalisation's one claim. 1000 genes hold
       only ~198 distinct integer values, ties dominate, and the medians still
       span 1.5 after normalising — visible in a boxplot, and not fixable by
       scaling up (`nbDraw` caps at 4000). Gamma is the negative binomial's own
       mixing distribution, so the stage is the same model without the Poisson
       counting step, and quantile lands exactly.

   ---------------------------------------------------------------------------
   NO DRIVE BUTTONS, principle 4.5, and `linear-regularization` is the
   precedent — the other widget in the collection whose whole argument is in its
   controls. There is no accumulation here and no sequence to reveal: the two
   pickers ARE the motion, and every state they reach is one `compute()` away.
   The quantile procedure — rank, average across samples at each rank, assign
   back — is the one thing here that would repay an animation, and it is
   deliberately left for a later round rather than bolted on to a figure whose
   design has just been agreed.

   The widget opens at None + None: raw intensities, unequal samples, a fan in
   the second panel. That is the problem the lesson is about, not its answer
   (2.1).
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  simulate, apply, summarise, boxStats, median, TRANSFORM,
} from "./model.js";

/* The notebook's own dimensions. 1000 genes x 10 samples costs 6.2 ms through
   the whole pipeline — simulate, quantile-normalise, summarise — which is a
   slider that feels immediate, so neither is a control (3.5). */
const GENES = 1000;
const SAMPLES = 10;

/* A magnitude, so a `choice` slider with tick labels rather than a dropdown
   (3.3): left-to-right carries "how unequal are the samples", and the leftmost
   position is the notebook's own stage.

   IT IS "TECHNICAL VARIATION", NOT "DEPTH DIFFERENCE" — Kenneth, 2026-09-02:
   depth is not taught in this lesson. The lesson's own first cell names the
   problem in exactly these words: "Technical Variability: Increased technical
   variations due to multiple steps in high-throughput technologies". Sequencing
   depth is one instance of it and injected sample amount is another; the widget
   should not pick one and make the reader translate. Widget copy is
   lesson-independent (2.10), and this is the lesson's vocabulary anyway. */
const SPREADS = [
  { value: "0", amount: 0, label: "none",
    detail: "every sample measured identically — the notebook's own stage, where no normalizer has anything to correct" },
  { value: "0.25", amount: 0.25, label: "±25%", detail: "a mild systematic difference between samples" },
  { value: "0.5", amount: 0.5, label: "±50%", detail: "one sample's values run about 2.3× another's" },
  { value: "0.75", amount: 0.75, label: "±75%", detail: "one sample's values run about 3.1× another's" },
  { value: "1", amount: 1, label: "±100%", detail: "one sample's values run about 4× another's" },
];
const spreadOf = (key) => SPREADS.find((s) => s.value === key)?.amount ?? 0.5;

/* Box-Cox's ladder. lambda = 1 is kept deliberately even though it looks like a
   wasted position: at lambda = 1 the transform is (y - 1), an affine map, so
   every tile lands back on the untransformed row — the self-checking end of the
   slider.

   THE OTHER END APPROACHES log(y), NOT log(1+y), and this comment said the
   wrong one until `_lab/norm-verify.mjs` caught it. The stage runs down to
   2.35e-6 and 0.33% of its values sit below 1, which is enough for the "+1" to
   separate the three outright: log(y) skew -0.665, Box-Cox at 0.02 -0.446,
   log(1+y) -0.061. So dragging lambda toward zero does NOT converge on the
   log(1+y) button; it walks past it toward a different transform, and that gap
   is the "+1" doing visible work at the small end of the data.

   THE IDENTITY HOLDS ONLY WHERE EVERY VALUE IS STRICTLY POSITIVE, which is the
   same precondition the figure already prints. Measured over 3 spreads x 3
   seeds by `_lab/norm-verify.mjs`:

       none      1e-15   median  1e-15   quantile  1e-15     <- exact
       min-max   4.5e-5                  1 value dropped     <- the global min
       z-score   5.9e-1                  6827 dropped        <- half the table

   So it is a self-check on three of the five paths and a demonstration of the
   precondition on the other two. Both are worth having and neither is a bug. */
const LAMBDAS = [0.02, 0.1, 0.25, 0.5, 0.75, 1];

/* SHORT NAMES FOR THE FIGURE, full ones for the rail. A dropdown option has to
   say what it does — "Min–max → [0, 1]" earns its arrow there — but the figure's
   own line competes for width with a 51-character loss note beneath it, and
   "Z-score → mean 0, sd 1, then Box–Cox λ = 0.5" is 44 characters of which 14
   restate the option's own name. Same quantity, two registers.

   UP HERE, NOT BESIDE `pipelineLabel` AT THE BOTTOM OF THE FILE. It was a const
   declared after `defineWidget`, and `draw` runs synchronously inside that call
   — so every render threw `Cannot access 'SHORT' before initialization` and
   aborted after panel 2. The helpers next to it are `function` declarations,
   which hoist; a const does not. Module constants belong above the call that
   can reach them. */
const SHORT = { median: "Median", minmax: "Min–max", zscore: "Z-score", quantile: "Quantile" };

/* ---- the formula card ---------------------------------------------------
   Kenneth, 2026-09-02: put the formula on the figure to remind students. It
   goes ABOVE the figure in the figure column, which is where `lm-interaction`
   and `lm-diagnostics` put theirs — and, unlike the rail, that is inside the
   exported PNG.

   BOTH ROWS ALWAYS, greyed when the step is None, so the card holds a constant
   height and the figure below never jogs as a control moves (3.4d). And the
   Box-Cox row prints the lambda the slider is ACTUALLY on, because Box-Cox at
   0.02 and at 1 are two different pictures and a card showing a generic symbol
   would not say which one is on screen.

   Every formula is the notebook's own, from `05 / 03`. Each carries a `plain`
   twin for browsers that parse MathML without laying it out — `mathmlRenders`
   is the probe, and it is core's since 2026-09-02. */
const MATHML = mathmlRenders();

const PRIME = "<mo>&#x2032;</mo>";
const FORMULA = {
  /* Two "none"s, because the two rows are not saying the same thing. The card
     first shared one string and the Transform row then read "the samples are
     left as they are", which is the OTHER step's claim — normalisation is about
     the samples, transformation is about the shape. */
  none: {
    math: null,
    plain: "the samples are left as they are",
  },
  noneTransform: {
    math: null,
    plain: "the shape is left as it is",
  },
  median: {
    math: `<math><mrow><msup><mi>x</mi>${PRIME}</msup><mo>=</mo>`
      + "<mfrac><mi>x</mi><mrow><mi>median</mi><mo>(</mo><mi>x</mi><mo>)</mo></mrow></mfrac></mrow></math>",
    plain: "x′ = x / median(x), per sample",
  },
  minmax: {
    math: `<math><mrow><msup><mi>x</mi>${PRIME}</msup><mo>=</mo>`
      + "<mfrac><mrow><mi>x</mi><mo>&#x2212;</mo><mi>min</mi><mo>(</mo><mi>x</mi><mo>)</mo></mrow>"
      + "<mrow><mi>max</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>&#x2212;</mo>"
      + "<mi>min</mi><mo>(</mo><mi>x</mi><mo>)</mo></mrow></mfrac></mrow></math>",
    plain: "x′ = (x − min(x)) / (max(x) − min(x))",
  },
  zscore: {
    math: "<math><mrow><mi>Z</mi><mo>=</mo>"
      + "<mfrac><mrow><mi>x</mi><mo>&#x2212;</mo><mi>&#x3BC;</mi></mrow><mi>&#x3C3;</mi></mfrac></mrow></math>",
    plain: "Z = (x − μ) / σ",
  },
  /* THE ONE ROW WITH NO FORMULA, and it is not an omission. Quantile
     normalisation is a procedure over the whole table, which is why the
     notebook writes it as three numbered steps (cell 16) and why the widget
     has an act for it rather than an equation. */
  quantile: {
    math: null,
    plain: "rank within each sample · average across samples at each rank · assign each value its rank's average",
  },
  log1p: {
    math: `<math><mrow><msup><mi>y</mi>${PRIME}</msup><mo>=</mo>`
      + "<mi>log</mi><mo>(</mo><mi>y</mi><mo>+</mo><mn>1</mn><mo>)</mo></mrow></math>",
    plain: "y′ = log(y + 1)",
  },
};

const boxcoxFormula = (lam) => ({
  math: `<math><mrow><msup><mi>y</mi>${PRIME}</msup><mo>=</mo>`
    + `<mfrac><mrow><msup><mi>y</mi><mn>${lam}</mn></msup><mo>&#x2212;</mo><mn>1</mn></mrow>`
    + `<mn>${lam}</mn></mfrac></mrow></math>`,
  plain: `y′ = (y^${lam} − 1) / ${lam}`,
});

let cardHost = null;
let cardKey = null;

function renderCard(params) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    /* A FLOOR, MEASURED, NOT GUESSED. Without it the card ran 60px to 83px
       across the 45 states and the whole figure jogged 23px as a dropdown moved
       — which is the fault "both rows always" was chosen to avoid (3.4d).
       The tall case is quantile, whose row is prose rather than a formula and
       wraps to two lines; the short case is any two one-line formulas.

       83px is the worst case at the NARROWEST column the side layout reaches
       (535px), and the reserve has to cover that because it is one number for
       every width — so a wide frame carries some slack inside the card, exactly
       as `.w-math-eq`'s own reserve does. 7.8em against this card's 11px type
       is 85.8px, about 3% over, which is roughly what a font substitution on
       another platform costs. */
    cardHost.style.minHeight = "7.8em";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const key = `${params.normalize}|${params.transform}|${params.lambda}`;
  if (key === cardKey) return;
  cardKey = key;

  const pick = (which, step) => {
    if (which === "boxcox") return boxcoxFormula(params.lambda);
    if (which === "none") return FORMULA[step === 2 ? "noneTransform" : "none"];
    return FORMULA[which];
  };
  const row = (label, which, step) => {
    const f = pick(which, step);
    const off = which === "none";
    const body = !off && MATHML && f.math
      ? f.math
      : `<span style="font-size:var(--fs-xs)">${f.plain}</span>`;
    return `<div class="w-math-eq" style="min-height:0;padding-left:6.2em;text-indent:-6.2em">`
      + `<span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>`
      + `<span style="color:${off ? "var(--ink-3)" : "var(--ink-1)"}">${body}</span></div>`;
  };
  cardHost.innerHTML = row("1 · Normalize", params.normalize, 1)
    + row("2 · Transform", params.transform, 2);
}

/* Which panel each tile belongs to, so the readout reads left to right in the
   same order the figure does (3.1). */
const PANEL_GAP = 26;

/* ---- the quantile walkthrough ------------------------------------------- *
 * Its own stage, deliberately tiny: 1000 genes x 10 samples is not a countable
 * thing (2.3), and the whole point of this act is that the reader can follow six
 * values through three steps and check the answer by eye. Same generator, same
 * seed, same technical variation as the main figure, so it is the same story at
 * a size you can count.
 *
 * THE PHASES ARE THE NOTEBOOK'S OWN THREE STEPS (cell 16), plus the table they
 * start from:
 *
 *   0  the table            raw, and the samples visibly differ
 *   1  rank within a sample each column sorted on its own
 *   2  average at each rank the reference distribution, one value per rank
 *   3  assign back          each value takes its rank's average, in place
 *
 * The move from 0 to 1 and from 2 to 3 are the same motion in reverse — cells
 * travelling between their gene row and their rank row — which is exactly the
 * mechanism, so it is eased rather than cut (4.3). */
const ACT_GENES = 6;
const ACT_SAMPLES = 4;
const ACT_H = 234;
const FIG_H = 416;
const PHASE_MS = 900;
const PHASES = [
  { caption: "The table", note: "six genes, four samples — the samples read at different levels" },
  { caption: "1 · Rank the values within each sample", note: "each column sorted on its own; the ranks line up, the genes no longer do" },
  { caption: "2 · Average across samples, at each rank", note: "one value per rank — the reference distribution" },
  /* "in a different order" is the half that matters and it nearly got dropped.
     A separate payoff line said it, sat under the grid, and was redundant with
     this note — so it is folded in rather than repeated. Without it a reader can
     leave thinking the samples were made identical; they were not, only their
     DISTRIBUTIONS were. */
  { caption: "3 · Give each value its rank's average", note: "back in place: every sample now holds the same six values, in a different order" },
];

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

defineWidget({
  slug: "normalization",
  title: "Normalization and Transformation",
  subtitle:
    "Normalization puts the samples on one scale. Transformation changes the "
    + "shape of the distribution. They are two different operations applied in "
    + "order, and neither one does the other's job.",
  layout: "side",
  status: "draft",
  /* A FUNCTION, because the walkthrough is a stage the reader may not have
     entered — and a panel that can be hidden has to give its pixels back, or
     the gate saves nothing anyone can see (3.4b). */
  height: ({ act }) => (act ? FIG_H + ACT_H : FIG_H),

  params: {
    /* --- THE DATA ------------------------------------------------------- */
    data: { type: "section", label: "The data" },

    spread: {
      type: "choice",
      label: "Technical variation between samples",
      options: SPREADS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "0.5",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* --- 1 · NORMALIZE --------------------------------------------------- *
     * A `select` rather than a `segmented`: five options whose names run to
     * nine characters, in a rail 250-300px wide, would give each segment about
     * 50px and "Quantile" does not fit. 3.3's own escape clause — the list is
     * too long for the shape that would show every option at rest. */
    norm: { type: "section", label: "1 · Normalize", detail: "put the samples on one scale" },

    normalize: {
      type: "select",
      label: "Method",
      options: [
        { value: "none", label: "None" },
        { value: "median", label: "Median, per sample" },
        { value: "minmax", label: "Min–max → [0, 1]" },
        { value: "zscore", label: "Z-score → mean 0, sd 1" },
        { value: "quantile", label: "Quantile" },
      ],
      default: "none",
    },

    /* --- 2 · TRANSFORM --------------------------------------------------- *
     * Three short options, so this one CAN show all three at rest, and it
     * should: the whole widget is about there being a second operation, and
     * a dropdown that has to be opened hides that a second choice exists. */
    tran: { type: "section", label: "2 · Transform", detail: "change the shape of the distribution" },

    /* The labels come from the model rather than being typed again here. The
       button said "log(1+y)" and the figure's own caption said "log(1 + y)" —
       two names for one thing, which is 3.7's rule broken inside a single
       widget. The canvas text sweep is what found it. */
    transform: {
      type: "segmented",
      label: "Method",
      options: [
        { value: "none", label: "None" },
        { value: "log1p", label: TRANSFORM.log1p.label },
        { value: "boxcox", label: "Box–Cox" },
      ],
      default: "none",
    },

    /* --- THE QUANTILE ACT, behind a gate ---------------------------------- *
     * A whole stage the reader has not entered (3.4b), so it hides behind one
     * button and gives its pixels back when shut — the widget's height is a
     * function of this parameter.
     *
     * IT NEEDS ITS OWN DATA and that is the whole reason it is a separate act.
     * Quantile normalisation is the one method here with no formula — the
     * notebook writes it as three numbered steps (cell 16) — and the only step
     * a reader cannot picture. But 1000 genes x 10 samples is not a countable
     * thing (2.3), so the act runs on SIX genes and FOUR samples, drawn from
     * the same generator at the same seed and the same technical variation, so
     * it is the same story at a size you can check by eye.
     *
     * It does NOT set `normalize`. A gate that also wrote another parameter
     * would be a two-parameter transaction, and the reader can pick Quantile in
     * the rail whenever they want to see it on the real table. */
    act: {
      type: "gate",
      label: "Show how quantile normalization works",
      labelOff: "Hide the walkthrough",
      detail: "six genes, four samples — the same data at a size you can count",
      default: false,
      display: true,
    },

    /* An authored head start for the walkthrough, first render only, so a
       lesson can link straight to the finished picture: `?act=1&shown=3`. */
    shown: { type: "int", min: 0, max: 3, default: 0, hidden: true },

    /* Gated on Box-Cox, declaratively (`when`), so core rebuilds the block only
       when `transform` moves rather than on every value change. */
    lambda: {
      type: "choice",
      label: "λ",
      options: LAMBDAS.map((v) => ({ value: String(v), label: String(v) })),
      default: "0.5",
      detail: "λ → 0 is the log; λ = 1 is a rescaling, so it lands back on the raw numbers. Needs y > 0",
      when: { param: "transform", equals: "boxcox" },
    },
  },

  legend: [
    { token: "empirical", label: "One sample's values", mark: "bar" },
    { token: "reference", label: "The median of all samples", mark: "line" },
  ],

  /* Pure and seeded: same params, same table, every time. Runs on parameter
     change only — there is no animation to run it per frame. */
  compute: ({ params }) => {
    const raw = simulate({
      seed: params.seed,
      genes: GENES,
      samples: SAMPLES,
      spread: spreadOf(params.spread),
      stage: "gamma",
    }).cols;

    const cols = apply(raw, {
      normalize: params.normalize,
      transform: params.transform,
      lambda: Number(params.lambda),
    });

    /* The five-number summary per sample, and the grand median every sample is
       judged against — `--c-reference`, the fixed benchmark the moving things
       are compared to. Computed here rather than in draw() so the panel and
       the tile cannot disagree about what the median is (5.8). */
    const kept = cols.map((c) => c.filter(Number.isFinite));
    // NOT `kept.map(boxStats)` — map passes (el, i, arr), and a bare reference
    // hands the index to the second parameter.
    const boxes = kept.map((c) => boxStats(c));
    const grand = median(boxes.map((b) => b.med));

    /* THE FULL RANGE, not the whisker range, because this is the number that
       carries the lesson: min-max reads exactly 0 – 1 and z-score does not.
       The panel's AXIS is p5–p95 so the boxes stay readable; the note says
       where all the values actually are, and says which it is. */
    const flat = kept.flat();
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);

    /* BOX-COX IS UNDEFINED AT OR BELOW ZERO, so after z-score it silently
       deletes about half the table. The notebook does this too — cell 25 ends
       `na.omit()` — and says nothing. Counting it here is what lets the figure
       print only what the visible data supports (2.11). */
    const dropped = cols.length * cols[0].length - flat.length;

    /* The walkthrough's own six-by-four table, from the same generator at the
       same seed and technical variation. Computed always rather than only when
       the gate is open: 24 gamma draws is unmeasurable, and a state that only
       exists sometimes is a state that gets forgotten. */
    const small = simulate({
      seed: params.seed,
      genes: ACT_GENES,
      samples: ACT_SAMPLES,
      spread: spreadOf(params.spread),
      stage: "gamma",
    }).cols.map((c) => c.map((v) => Math.round(v)));

    /* rank[s][g] is where gene g sits in sample s once that sample is sorted;
       ref[r] is the mean of every sample's r-th smallest. `after` is the answer,
       and it is derived here so the animation only ever REVEALS it (invariant
       2) rather than recomputing it per frame. */
    const rank = small.map((c) => {
      const ord = c.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
      const r = new Array(ACT_GENES);
      ord.forEach(([, gi], k) => { r[gi] = k; });
      return r;
    });
    const sorted = small.map((c) => c.slice().sort((a, b) => a - b));
    const ref = Array.from({ length: ACT_GENES }, (_, r) =>
      sorted.reduce((s, c) => s + c[r], 0) / ACT_SAMPLES);
    const after = small.map((c, s) => c.map((_, g) => ref[rank[s][g]]));

    return { cols, boxes, grand, lo, hi, dropped, total: cols.length * cols[0].length,
      act: { small, rank, sorted, ref, after },
      ...summarise(cols) };
  },

  /* THE WALKTHROUGH IS THE ONLY MOVING THING IN THE WIDGET. The two panels are
     one `compute()` away from any state the rail can reach, which is why the
     figure itself declines drive buttons (4.5) — but a three-step procedure is
     a sequence, and a sequence is what an animation is for.

     A DATA CHANGE RESETS IT, and that is the invariant working rather than a
     wart. Changing `normalize` does not alter the walkthrough's own table, so
     the reset looks gratuitous — but preserving the phase across a parameter
     change would mean the same URL showed different pictures depending on what
     the reader had clicked first, which is exactly what invariant 1 forbids.
     `?act=1&shown=3` is how a lesson links to the finished picture. */
  animation: {
    stepLabel: "Next step",
    stepTitle: "Carry out the next step of quantile normalization",
    runLabel: "Play",
    runTitle: "Run all three steps of quantile normalization",

    /* An authored head start lands on the phase COMPLETED, `t = 1`, because a
       reader following a link wants the finished step and not its first
       frame — the same reason `shown` exists at all (2.1 in reverse: the
       author may publish an answer, the reader must build one). */
    init: ({ params, fromScratch }) => {
      const phase = fromScratch ? 0 : Math.min(params.shown, PHASES.length - 1);
      return { phase, t: phase > 0 ? 1 : 0, done: phase >= PHASES.length - 1 };
    },

    /* THE LAST PHASE HAS TO RUN, and the obvious guard stopped it before it
       started. `if (phase >= last) return false` at the top fires the moment
       phase becomes 3 — with t still 0 — so the assign-back motion never
       played and the settled figure showed phase 2's picture under phase 3's
       caption. The terminal condition is the last phase COMPLETED, not
       reached. */
    advance: (anim, { dt }) => {
      if (anim.done) return false;
      anim.t += dt / PHASE_MS;
      if (anim.t < 1) return true;
      if (anim.phase >= PHASES.length - 1) { anim.t = 1; anim.done = true; return false; }
      anim.t = 0;
      anim.phase += 1;
      /* One press of Step is one step of the procedure — the reader is meant to
         read the caption before the next one starts. Play keeps going. */
      return anim.mode !== "step";
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    /* The card is DOM, not canvas, so it is updated from here rather than
       painted — the same door `lm-interaction` uses. It early-returns on an
       unchanged key, so this costs nothing on a repaint that did not move a
       control. */
    renderCard(params);

    const { boxes, grand, pts } = state;

    /* Two panels side by side, reading left to right in the rail's own order:
       the left panel is what step 1 moves, the right is what step 2 moves.
       The left gets the larger share because it holds ten boxes across; the
       right is a cloud and reads at any width. */
    const top = 26;
    /* The panels keep FIG_H whatever the gate does; the walkthrough is added
       below, so opening it does not squash the figure it is explaining. */
    const bottom = FIG_H - 50;   // two lines of figure copy live below the panels
    const leftW = Math.round((w - PANEL_GAP) * 0.54);
    const padL = 46;
    const padR = 8;

    /* --- panel 1 · the distribution, per sample -------------------------- *
     * THE AXIS HOLDS EVERY VALUE, not the middle 90%. That is what lets
     * min-max's axis read 0 to 1 — the one method that states its own output
     * range in its name — and it is also what makes the skew visible: fitting
     * each state to its own interquantile span rescaled the skew away, so raw
     * and log(1+y) drew the same picture while the tiles read 3.03 and -0.06.
     * Kenneth, 2026-09-02: "why doesn't the y-axis scale change". It did; it
     * just never showed the number the method promises. */
    const lo = state.lo;
    const hi = state.hi;
    const padY = (hi - lo) * 0.04 || 1;

    const p1 = makePlot({
      ctx,
      colors,
      rect: { x: padL, y: top, w: leftW - padL - padR, h: bottom - top },
      xDomain: [0, SAMPLES],
      yDomain: [lo - padY, hi + padY],
    });

    p1.grid(p1.yDomain.length ? niceFour(lo - padY, hi + padY) : []);
    p1.axisY({ ticks: niceFour(lo - padY, hi + padY), format: axisFmt(hi - lo) });
    /* NO AXIS LABEL. It said "sample", and MEASURED it painted at y=388
       x=[201..239] while the pipeline line below painted at y=398 x=[46..223] —
       ten pixels apart and overlapping by 22, so the two printed through each
       other. The caption already says "per sample", so the shorter fix is to
       delete the label rather than to find it a new home. */
    p1.axisX({ ticks: [] });
    p1.caption("Distribution, per sample");
    /* THE RANGE, PRINTED. Min-max and z-score change the numbers and nothing
       else, so without this the panel is pixel-identical before and after and
       the control reads as broken. It is the range of ALL the values, not of
       the whiskers the axis is fitted to — which is what makes min-max read
       exactly 0 – 1 and is the whole reason the note is here. */
    const rf = axisFmt(state.hi - state.lo);
    p1.note(`values ${rf(state.lo)} – ${rf(state.hi)}`);

    /* The benchmark first, so the boxes sit over it.

       1.5px rather than the hairline `spanningRule` defaults to. `--c-reference`
       resolves to the same grey as `--ink-3`, which is deliberately recessive —
       and this is the mark the reader compares ten medians against, so it is
       the one line in the panel that has to survive a projector (prd §3). Same
       call spanningRule's own comment records for widget 7. */
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1.5;
    const gy = Math.round(p1.sy(grand));
    ctx.beginPath();
    ctx.moveTo(p1.x, gy);
    ctx.lineTo(p1.x + p1.w, gy);
    ctx.stroke();
    ctx.restore();

    const band = p1.w / SAMPLES;
    const half = Math.min(band * 0.34, 15);
    ctx.save();
    ctx.lineWidth = 1;
    boxes.forEach((b, i) => {
      const cx = Math.round(p1.x + band * (i + 0.5)) + 0.5;

      /* Outliers first, under the box: everything past 1.5 x IQR, drawn faint
         because there can be 683 of them on raw data and 55 after the log —
         a count that is itself a reading of the skew. */
      ctx.fillStyle = colors.empirical;
      ctx.globalAlpha = 0.3;
      for (const v of b.out) {
        ctx.beginPath();
        ctx.arc(cx, p1.sy(v), 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = colors.empirical;
      const yl = p1.sy(b.lo);
      const yh = p1.sy(b.hi);
      ctx.beginPath();
      ctx.moveTo(cx, yl);
      ctx.lineTo(cx, yh);
      ctx.moveTo(cx - half * 0.45, yl);
      ctx.lineTo(cx + half * 0.45, yl);
      ctx.moveTo(cx - half * 0.45, yh);
      ctx.lineTo(cx + half * 0.45, yh);
      ctx.stroke();

      const y3 = p1.sy(b.q3);
      const boxH = Math.max(1, p1.sy(b.q1) - y3);
      ctx.fillStyle = colors.surface2;
      ctx.fillRect(cx - half, y3, half * 2, boxH);
      ctx.strokeRect(cx - half, y3, half * 2, boxH);

      /* The median is the mark the scale tile measures, so it is the heaviest
         thing in the box and it is what the reader compares to the rule. On raw
         data the box is 6% of the panel, so this line and the rule behind it
         are most of what panel 1 has to say. */
      ctx.save();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - half, Math.round(p1.sy(b.med)) + 0.5);
      ctx.lineTo(cx + half, Math.round(p1.sy(b.med)) + 0.5);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();

    /* --- panel 2 · variance against mean, per gene ---------------------- */
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y1 = Math.max(...ys);

    const p2 = makePlot({
      ctx,
      colors,
      rect: {
        x: leftW + PANEL_GAP + padL,
        y: top,
        w: w - (leftW + PANEL_GAP + padL) - padR,
        h: bottom - top,
      },
      xDomain: [x0 - (x1 - x0) * 0.04, x1 + (x1 - x0) * 0.04],
      yDomain: [0, y1 * 1.06 || 1],
    });

    p2.grid(niceFour(0, y1 * 1.06));
    p2.axisY({ ticks: niceFour(0, y1 * 1.06), format: axisFmt(y1) });
    p2.axisX({ label: "mean, per gene", format: axisFmt(x1 - x0) });
    p2.caption("Variance against mean");

    ctx.save();
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.38;
    for (const [m, v] of pts) {
      ctx.beginPath();
      ctx.arc(p2.sx(m), p2.sy(v), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* TWO LINES UNDER BOTH PANELS, and the second one is why they are down here
       rather than in a panel's note.

       The first names the pipeline the rail just built — the figure has two
       captions and neither can say what was DONE to the data, and the exported
       PNG has no rail beside it.

       The second is the loss. It began as panel 2's note and MEASURED, at the
       narrowest canvas (535px, where panel 2 gets about 200), it printed
       through the caption, the note above it and a tick label — six collisions
       across four states. It is 51 characters and no panel is that wide; the
       full canvas is. Drawn in `--c-highlight` rather than muted, because when
       two thirds of the table has just been deleted that IS the one thing to
       look at (2.11: the figure prints only what the visible data supports). */
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colors.ink3;
    ctx.fillText(pipelineLabel(params), padL, FIG_H - 18);
    if (state.dropped > 0) {
      ctx.fillStyle = colors.highlight;
      ctx.fillText(
        `${state.dropped.toLocaleString("en")} of ${state.total.toLocaleString("en")} values dropped — Box–Cox needs y > 0`,
        padL, FIG_H - 2,
      );
    }
    ctx.restore();

    if (params.act) drawAct(ctx, colors, w, FIG_H, state.act, anim);
  },

  readout: ({ state }) => [
    {
      label: "Samples on one scale",
      value: fmt(state.spread.relative, 3),
      note: "median range ÷ pooled IQR",
    },
    {
      label: "Skew",
      value: fmt(state.skew, 2),
      note: "0 is symmetric",
    },
    {
      /* `state.pts.length`, not GENES: Box-Cox after z-score deletes genes, and
         a tile that says "over 1000 genes" while the panel holds 604 is exactly
         the kind of number that survives review because nobody recomputes it. */
      label: "Variance vs mean",
      value: fmt(state.rho, 2),
      note: `Spearman ρ over ${state.pts.length.toLocaleString("en")} genes`,
    },
  ],

  /* The boxplot's own five numbers plus the outlier count, which is the one
     thing on the canvas a reader cannot count for themselves. */
  table: ({ state }) => ({
    columns: ["Sample", "Low whisker", "25%", "Median", "75%", "High whisker", "Outliers"],
    rows: state.boxes.map((b, i) => [
      `Sample ${i + 1}`,
      fmt(b.lo, 2), fmt(b.q1, 2), fmt(b.med, 2), fmt(b.q3, 2), fmt(b.hi, 2),
      String(b.out.length),
    ]),
  }),
});

/* --- the quantile walkthrough, drawn ------------------------------------- *
 * One grid of numbers, and the cells TRAVEL between their gene row and their
 * rank row. That motion is the mechanism: quantile normalisation is the claim
 * that a value's rank is the only thing about it that survives, and watching a
 * cell leave gene 3 for rank 1 and come back holding a different number is that
 * claim happening rather than being asserted (4.3).
 *
 * Two eased moves, and they are each other's reverse:
 *   phase 0 -> 1   gene row  -> rank row   (sorting)
 *   phase 2 -> 3   rank row  -> gene row   (assigning back)
 * Phase 1 -> 2 moves nothing; the reference column fades in beside the grid. */
function drawAct(ctx, colors, w, y0, act, anim) {
  const { small, rank, sorted, ref, after } = act;
  const phase = anim?.phase ?? 0;
  const t = anim?.t ?? 0;
  const ph = PHASES[phase];

  const cw = Math.min(62, Math.max(40, (w - 210) / (ACT_SAMPLES + 1)));
  const rh = 22;
  const gridX = 74;
  /* 62, not 44. The column headers sit at gridY - 12, and at 44 that put them
     on y0 + 32 — ABOVE the note at y0 + 36, so the two printed through each
     other at every phase. Measured, not eyeballed: the note's box ran 441-452
     and the headers' 442-454. */
  const gridY = y0 + 62;
  const refX = gridX + cw * ACT_SAMPLES + 26;

  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink1;
  ctx.fillText(ph.caption, gridX - 40, y0 + 22);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText(ph.note, gridX - 40, y0 + 36);

  /* How far each cell is between its two rows, and which number it shows. */
  const moving = phase === 1 ? easeInOut(t) : phase >= 2 ? 1 : 0;
  const back = phase === 3 ? easeInOut(t) : 0;

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /* column and row headers */
  for (let s = 0; s < ACT_SAMPLES; s += 1) {
    ctx.fillStyle = colors.ink3;
    ctx.fillText(`S${s + 1}`, gridX + cw * (s + 0.5), gridY - 12);
  }
  for (let r = 0; r < ACT_GENES; r += 1) {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    /* The row axis IS the thing that changes: genes while the table is in its
       own order, ranks once it is sorted. Crossfaded so the swap is visible. */
    const g = 1 - moving + back;
    ctx.globalAlpha = Math.max(0, g);
    ctx.fillText(`gene ${r + 1}`, gridX - 8, gridY + rh * (r + 0.5));
    ctx.globalAlpha = Math.max(0, 1 - g);
    ctx.fillText(`rank ${r + 1}`, gridX - 8, gridY + rh * (r + 0.5));
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
  }

  /* the grid lines */
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let s = 0; s <= ACT_SAMPLES; s += 1) {
    const x = Math.round(gridX + cw * s) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, gridY); ctx.lineTo(x, gridY + rh * ACT_GENES); ctx.stroke();
  }
  for (let r = 0; r <= ACT_GENES; r += 1) {
    const yy = Math.round(gridY + rh * r) + 0.5;
    ctx.beginPath(); ctx.moveTo(gridX, yy); ctx.lineTo(gridX + cw * ACT_SAMPLES, yy); ctx.stroke();
  }

  /* the cells, each between its gene row and its rank row */
  for (let s = 0; s < ACT_SAMPLES; s += 1) {
    for (let g = 0; g < ACT_GENES; g += 1) {
      const r = rank[s][g];
      const row = g + (r - g) * (moving - back);
      const cx = gridX + cw * (s + 0.5);
      const cy = gridY + rh * (row + 0.5);
      /* The value only changes at the last moment of phase 3, when the cell
         arrives home carrying the reference value rather than its own. */
      const shown = back > 0.5 ? after[s][g] : small[s][g];
      ctx.fillStyle = back > 0.5 ? colors.highlight : colors.ink1;
      ctx.fillText(fmt(shown, back > 0.5 ? 1 : 0), cx, cy);
    }
  }

  /* the reference column, from phase 2 */
  if (phase >= 2) {
    const fade = phase === 2 ? Math.min(1, t * 2) : 1;
    ctx.globalAlpha = fade;
    ctx.fillStyle = colors.ink3;
    ctx.fillText("mean", refX + cw * 0.5, gridY - 12);
    ctx.strokeStyle = colors.grid;
    for (let r = 0; r <= ACT_GENES; r += 1) {
      const yy = Math.round(gridY + rh * r) + 0.5;
      ctx.beginPath(); ctx.moveTo(refX, yy); ctx.lineTo(refX + cw, yy); ctx.stroke();
    }
    for (const x of [refX, refX + cw]) {
      const xx = Math.round(x) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, gridY); ctx.lineTo(xx, gridY + rh * ACT_GENES); ctx.stroke();
    }
    ctx.fillStyle = colors.highlight;
    for (let r = 0; r < ACT_GENES; r += 1) {
      ctx.fillText(fmt(ref[r], 1), refX + cw * 0.5, gridY + rh * (r + 0.5));
    }
    /* an arrow from the grid to the mean, so the direction of the average is
       not something the reader has to infer from adjacency alone */
    ctx.strokeStyle = colors.ink3;
    const ay = gridY + rh * ACT_GENES * 0.5;
    ctx.beginPath();
    ctx.moveTo(gridX + cw * ACT_SAMPLES + 6, ay);
    ctx.lineTo(refX - 6, ay);
    ctx.moveTo(refX - 11, ay - 4);
    ctx.lineTo(refX - 6, ay);
    ctx.lineTo(refX - 11, ay + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/* --- small local helpers -------------------------------------------------- */

/** Four ticks spanning the panel, so both panels tick at the same density. */
function niceFour(lo, hi) {
  const out = [];
  for (let i = 0; i <= 4; i += 1) out.push(lo + ((hi - lo) * i) / 4);
  return out;
}

/**
 * Tick formatting driven by the SPAN rather than by the value.
 *
 * The y axis here runs from ~468 (raw intensities) to ~1 (min-max) to ~0.001
 * (a variance after z-score), and a single format string is wrong at two of the
 * three. Choosing on the span means the labels stay three or four significant
 * figures wide whatever the method did to the numbers — which matters because
 * those labels are carrying half the lesson.
 */
function axisFmt(span) {
  const s = Math.abs(span);
  if (s >= 100) return (v) => v.toFixed(0);
  if (s >= 10) return (v) => v.toFixed(1);
  if (s >= 1) return (v) => v.toFixed(2);
  if (s >= 0.01) return (v) => v.toFixed(3);
  return (v) => v.toExponential(1);
}

/** "Raw intensities" / "Quantile, then log(1 + y)" — the pipeline, in the rail's
    own words. `λ` is spelled out because Box-Cox at 0.02 and at 1 are two
    different pictures and the caption has to say which one is on screen. */
function pipelineLabel(params) {
  const n = params.normalize === "none" ? null : SHORT[params.normalize];
  const t = params.transform === "none"
    ? null
    : params.transform === "boxcox"
      ? `Box–Cox λ = ${params.lambda}`
      : TRANSFORM[params.transform].label;
  if (!n && !t) return "Raw intensities";
  if (n && t) return `${n}, then ${t}`;
  return n ?? t;
}
