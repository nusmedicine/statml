/* ============================================================================
   Normalization and Transformation — widget 39. DRAFT.

   Hosts at PHM5003 `05 - Introduction to High Throughput Data / 03 -
   Normalization and Transformation`. The misconception it exists to dislodge:
   that "normalising" makes data normal — that scaling and transforming are one
   operation with one purpose.

   The full design record is in `docs/catalogue.md` § Slot 1.

   ---------------------------------------------------------------------------
   TWO PANELS, FROM THE LESSON. `05 / 03` judges every method in the same
   figure — a boxplot per sample and a mean-versus-variance scatter over genes —
   and states the verdict as two bullets, "Effect on: Distribution" and "Effect
   on: Mean-Variance Relationship". The readout tiles are those two claims plus
   the one the boxplot panel can be read for directly.

   TWO CONTROLS APPLIED IN ORDER, not one picker of ten methods, so the reader
   can compose them and see that neither does the other's job. On the opening
   stage, seed 1:

                       scale    skew     rho
       None   + none    0.481   3.030   0.955
       Median + none    0.000   2.990   0.953   normalize moves scale only
       None   + log     0.549  -0.061   0.529   transform moves skew and rho
       Median + log     0.000  -0.078   0.543

   None, min-max and z-score all read 0.481 to six decimals, because the scale
   tile is a ratio of two differences and survives any affine map.

   ---------------------------------------------------------------------------
   MIN-MAX AND Z-SCORE LEAVE THE PICTURE UNCHANGED. Each is one affine map over
   the whole table, so the pooled skew cannot move — measured, it holds to
   7e-14. The axis labels carry the difference (0 to 806 before, 0 to 1 after),
   which works only because panel 1's axis holds every value: fitted to p5..p95
   it topped out at 0.41 under min-max, and fitting each state to its own
   interquantile span also rescaled the skew away, so raw and log(1+y) drew the
   same picture while the tiles read 3.03 and -0.06.

   Median normalisation is affine per sample but is not one map over the table,
   so it does move the pooled skew, 2.978 -> 3.014. On-screen copy says
   "scaling" rather than "affine" for that reason.

   ---------------------------------------------------------------------------
   THE STAGE IS GAMMA, and the technical variation is a control:

     - `simulate_data` draws every sample from the same mean vector, so the
       notebook's own ten samples are already on one scale and no normaliser has
       anything to correct. `spread` gives sample j a multiplier; setting it to
       none reproduces the notebook's stage.
     - Counts cannot show quantile normalisation working. 1000 genes hold only
       ~198 distinct integer values, so ties leave the sample medians spanning
       1.5, and raising the count scale does not help (`nbDraw` caps at 4000).
       Gamma is the negative binomial's mixing distribution — the same model
       without the Poisson step — and quantile lands exactly.

   ---------------------------------------------------------------------------
   NO DRIVE BUTTONS (4.5). The two panels are one `compute()` away from any
   state the rail can reach.

   The walkthrough does move, and still has no buttons. Core fixes the drive row
   at the foot of the rail (3.4e), which would have put Step and Play three
   sections from the sub-stage they drive; `afterDrive` cannot move them because
   Reset travels with the drive row. So the walk is a `step` parameter beside
   the gate that opens it, eased through core's ease-request door — the
   `logistic-regression` pattern, and for the same reason: a transition between
   two readings of one table. It also puts the walk in the URL.

   The widget opens at None + None (2.1).
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

/* A magnitude, so a `choice` slider (3.3), with the notebook's own stage at the
   left end.

   "Technical variation", not "depth difference": sequencing depth is one
   instance of it and injected sample amount is another, and the lesson's first
   cell names the general case — "Technical Variability: Increased technical
   variations due to multiple steps in high-throughput technologies". */
const SPREADS = [
  { value: "0", amount: 0, label: "none",
    detail: "every sample measured identically — the notebook's own stage, where no normalizer has anything to correct" },
  { value: "0.25", amount: 0.25, label: "±25%", detail: "a mild systematic difference between samples" },
  { value: "0.5", amount: 0.5, label: "±50%", detail: "one sample's values run about 2.3× another's" },
  { value: "0.75", amount: 0.75, label: "±75%", detail: "one sample's values run about 3.1× another's" },
  { value: "1", amount: 1, label: "±100%", detail: "one sample's values run about 4× another's" },
];
const spreadOf = (key) => SPREADS.find((s) => s.value === key)?.amount ?? 0.5;

/* Box-Cox's ladder, keeping both ends deliberately.

   At lambda = 1 the transform is (y - 1), an affine map, so every tile lands
   back on the untransformed row. That identity holds only where every value is
   strictly positive — the precondition the figure prints. Measured over 3
   spreads x 3 seeds by `_lab/norm-verify.mjs`:

       none / median / quantile   1e-15, 0 dropped
       min-max                    4.5e-5, 1 dropped   (the global minimum)
       z-score                    5.9e-1, 6827 dropped

   The other end approaches log(y), not log(1+y). The stage runs down to 2.35e-6
   with 0.33% of its values below 1, which separates the three: log(y) skew
   -0.665, Box-Cox at 0.02 -0.446, log(1+y) -0.061. */
const LAMBDAS = [0.02, 0.1, 0.25, 0.5, 0.75, 1];

/* Short names for the figure's own line, which competes for width with the
   51-character loss note beneath it.

   Declared above `defineWidget`, not beside `pipelineLabel` at the foot of the
   file: `draw` runs synchronously inside that call, so a const declared after it
   is still in its temporal dead zone and every render threw. Function
   declarations hoist; a const does not. */
const SHORT = { median: "Median", minmax: "Min–max", zscore: "Z-score", quantile: "Quantile" };

/* ---- the formula card ---------------------------------------------------
   Above the figure in the figure column, where `lm-interaction` and
   `lm-diagnostics` put theirs, so it is inside the exported PNG.

   Both rows always, greyed when the step is None, so the card holds a constant
   height and the figure below does not jog as a control moves (3.4d). The
   Box-Cox row prints the lambda in force: at 0.02 and at 1 it is two different
   transforms.

   Formulas are the notebook's own, from `05 / 03`. Each carries a `plain` twin
   for browsers that parse MathML without laying it out; `mathmlRenders` is the
   probe. */
const MATHML = mathmlRenders();

const PRIME = "<mo>&#x2032;</mo>";
const FORMULA = {
  /* Two "none"s: normalisation is about the samples, transformation about the
     shape, and one shared string had the Transform row stating the other
     step's claim. */
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
  /* No closed form: quantile normalisation is a procedure over the whole
     table, which is why the notebook gives it as three numbered steps (cell 16)
     and why the widget walks it rather than printing an equation. */
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
    /* A measured floor. Without it the card ran 60px to 83px across the 45
       states and the figure below jogged 23px as a control moved (3.4d). The
       tall case is quantile, whose row is prose and wraps to two lines.

       83px is the worst case at the narrowest column the side layout reaches
       (535px); the reserve is one number for every width, so it has to cover
       that and a wide frame carries slack. 7.8em against this card's 11px type
       is 85.8px, ~3% over, roughly the cost of a font substitution. */
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

const PANEL_GAP = 26;

/* ---- the quantile walkthrough ------------------------------------------- *
 * Six genes and four samples, from the same generator at the same seed and
 * technical variation as the main figure. 1000 x 10 is not a countable thing
 * (2.3); at this size the reader can follow six values through and check the
 * result.
 *
 * The phases are the notebook's three steps (cell 16), plus the table they
 * start from:
 *
 *   0  the table             raw
 *   1  rank within a sample  each column sorted on its own
 *   2  average at each rank  the reference distribution
 *   3  assign back           each value takes its rank's average, in place
 *
 * 0 -> 1 and 2 -> 3 are the same motion reversed: cells moving between their
 * gene row and their rank row. Eased rather than cut, because that movement is
 * the mechanism (4.3). */
const ACT_GENES = 6;
const ACT_SAMPLES = 4;
const ACT_H = 234;
const FIG_H = 416;
const PHASE_MS = 900;
const PHASES = [
  { caption: "The table", note: "six genes, four samples — the samples read at different levels" },
  { caption: "1 · Rank the values within each sample", note: "each column sorted on its own; the ranks line up, the genes no longer do" },
  { caption: "2 · Average across samples, at each rank", note: "one value per rank — the reference distribution" },
  /* "in a different order" matters: the samples were not made identical, only
     their distributions were. It was a separate line under the grid, redundant
     with this note, so it is folded in. */
  { caption: "3 · Give each value its rank's average", note: "back in place: every sample now holds the same six values, in a different order" },
];

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* `when` hides the gate but `act` keeps its value, so the walkthrough can be
   open with the method no longer Quantile. One predicate for the height and the
   draw, so the two cannot disagree about whether the stage is there. */
const actOn = (params) => Boolean(params.act) && params.normalize === "quantile";

defineWidget({
  slug: "normalization",
  title: "Normalization and Transformation",
  /* The lesson's own two problems, then the two fixes — 2.10's concept first,
     mechanism second. The clause it replaced said the two were different
     operations, which the rail's shape already says. */
  subtitle:
    "High-throughput measurements carry technical variation between samples, "
    + "and their variance grows with their size. Normalization corrects the "
    + "first, transformation the second.",
  layout: "side",
  status: "draft",
  /* A function: a stage that can be hidden has to give its pixels back (3.4b). */
  height: ({ act, normalize }) => (actOn({ act, normalize }) ? FIG_H + ACT_H : FIG_H),

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
     * Two columns, not one row: a row divides the rail by the option count and
     * gives each of five 45px, where "Min-max" needs 61. Two columns give 111px
     * at the same 250px rail. "None" spans a row, so the four methods form a
     * 2x2 under it. Measured in `_lab/norm-picker.html`. */
    norm: { type: "section", label: "1 · Normalize", detail: "put the samples on one scale" },

    normalize: {
      type: "segmented",
      style: "grid",
      label: "Method",
      options: [
        { value: "none", label: "None", span: true,
          detail: "the samples are left as they are" },
        { value: "median", label: "Median", detail: "divide each sample by its own median" },
        { value: "minmax", label: "Min–max", detail: "rescale the whole table to [0, 1]" },
        { value: "zscore", label: "Z-score", detail: "rescale the whole table to mean 0, sd 1" },
        { value: "quantile", label: "Quantile", detail: "give every sample the same distribution" },
      ],
      default: "none",
    },

    /* --- THE QUANTILE WALKTHROUGH ----------------------------------------- *
     * Quantile is the one method with no closed form, so the walkthrough belongs
     * to that option: it appears only when Quantile is chosen and sits directly
     * under the control that chose it (2.7). Behind a gate, because it is a
     * stage the reader has not entered (3.4b). */
    act: {
      type: "gate",
      label: "Show how quantile normalization works",
      labelOff: "Hide the walkthrough",
      detail: "six genes, four samples — the same data at a size you can count",
      default: false,
      display: true,
      when: { param: "normalize", equals: "quantile" },
    },

    /* A parameter rather than Step and Play — see the header. It keeps the
     * control beside the stage it drives and puts the walk in the URL:
     * `?normalize=quantile&act=1&step=3`. */
    step: {
      type: "choice",
      label: "Step",
      options: [
        { value: "0", label: "table", detail: PHASES[0].note },
        { value: "1", label: "rank", detail: PHASES[1].note },
        { value: "2", label: "average", detail: PHASES[2].note },
        { value: "3", label: "assign", detail: PHASES[3].note },
      ],
      default: "0",
      display: true,
      when: { all: [{ param: "normalize", equals: "quantile" }, { param: "act" }] },
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
    { token: "reference", label: "Median of all samples", mark: "line" },
    { token: "reference", label: "Mean of all samples", mark: "dash" },
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
    /* The pooled mean: a boxplot cannot show it and z-score is defined by it.
       Z-score does centre the mean, exactly, but the boxes sit at -0.337
       because a box draws the median, and on a table with skew 3.03 the median
       is a third of a standard deviation below the mean. Drawing both shows
       that gap, which closes to -0.008 after log(1+y). */
    const flatKept = kept.flat();
    const pooledMean = flatKept.reduce((s, v) => s + v, 0) / flatKept.length;
    // NOT `kept.map(boxStats)` — map passes (el, i, arr), and a bare reference
    // hands the index to the second parameter.
    const boxes = kept.map((c) => boxStats(c));
    const grand = median(boxes.map((b) => b.med));

    /* The full range, not the whisker range: min-max then reads exactly
       0 – 1, which is the number the note exists to show. */
    const flat = kept.flat();
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);

    /* Box-Cox is undefined at or below zero, so after z-score it deletes about
       two thirds of the table. The notebook does the same — cell 25 ends
       `na.omit()` — without saying so. Counted here so the figure can print it
       (2.11). */
    const dropped = cols.length * cols[0].length - flat.length;

    /* The walkthrough's six-by-four table, from the same generator at the same
       seed and technical variation. Computed unconditionally; 24 gamma draws is
       unmeasurable. */
    const small = simulate({
      seed: params.seed,
      genes: ACT_GENES,
      samples: ACT_SAMPLES,
      spread: spreadOf(params.spread),
      stage: "gamma",
    }).cols.map((c) => c.map((v) => Math.round(v)));

    /* rank[s][g] is where gene g sits once sample s is sorted; ref[r] is the
       mean of every sample's r-th smallest; `after` is the result. Derived here
       so the animation only reveals it (invariant 2). */
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

    return { cols, boxes, grand, pooledMean, lo, hi, dropped, total: cols.length * cols[0].length,
      act: { small, rank, sorted, ref, after },
      ...summarise(cols) };
  },

  /* The walkthrough is the only moving thing here, and its one motion is the
     ease between two settings of `step`. An explicit null declines each drive
     button rather than taking the default (4.5). */
  animation: {
    stepLabel: null,
    runLabel: null,

    init: ({ params }) => {
      const p = Number(params.step);
      return { p, target: p };
    },

    /* `p` is a continuous phase in [0, 3]. An earlier version counted whole
       phases and needed a special case for the last one, which is how phase 3's
       motion came to never play. */
    advance: (anim, { dt }) => {
      const dir = Math.sign(anim.target - anim.p);
      if (dir === 0) return false;
      anim.p += (dir * dt) / PHASE_MS;
      if ((dir > 0 && anim.p >= anim.target) || (dir < 0 && anim.p <= anim.target)) {
        anim.p = anim.target;
        return false;
      }
      return true;
    },

    rebuild: (anim, { params }) => {
      const target = Number(params.step);
      if (target !== anim.target) {
        anim.target = target;
        anim.easing = true;          // a request for frames; core consumes it
      }
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    /* The card is DOM, not canvas, so it is updated rather than painted — the
       `lm-interaction` pattern. It early-returns on an unchanged key. */
    renderCard(params);

    const { boxes, grand, pts } = state;

    /* Two panels side by side, reading left to right in the rail's own order:
       the left panel is what step 1 moves, the right is what step 2 moves.
       The left gets the larger share because it holds ten boxes across; the
       right is a cloud and reads at any width. */
    /* The walkthrough sits above the panels, under the formula card: it shows
       how the method works, so it belongs with the explanation rather than
       under the result. The panels keep FIG_H whatever the gate does. */
    const showAct = actOn(params);
    if (showAct) drawAct(ctx, colors, w, 0, state.act, anim);
    const figTop = showAct ? ACT_H : 0;

    const top = figTop + 26;
    const bottom = figTop + FIG_H - 50;   // two lines of copy live below the panels
    const leftW = Math.round((w - PANEL_GAP) * 0.54);
    const padL = 46;
    const padR = 8;

    /* --- panel 1 · the distribution, per sample -------------------------- *
     * The axis holds every value, not the middle 90%. Fitted to p5..p95 it
     * topped out at 0.41 under min-max, and fitting each state to its own
     * interquantile span rescaled the skew away, so raw and log(1+y) drew the
     * same picture while the tiles read 3.03 and -0.06. */
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
    /* No axis label. It said "sample" and painted at y=388 x=[201..239] while
       the pipeline line below painted at y=398 x=[46..223] — 22px of overlap.
       The caption already says "per sample". */
    p1.axisX({ ticks: [] });
    p1.caption("Distribution, per sample");
    /* Min-max and z-score change the numbers and nothing else, so without this
       the panel is pixel-identical before and after and the control reads as
       broken. */
    const rf = axisFmt(state.hi - state.lo);
    p1.note(`values ${rf(state.lo)} – ${rf(state.hi)}`);

    /* The reference rules first, so the boxes sit over them.

       1.5px rather than the hairline `spanningRule` defaults to: `--c-reference`
       resolves to the same grey as `--ink-3`, and this is the mark ten medians
       are compared against, so it has to survive a projector (prd §3). */
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1.5;
    const gy = Math.round(p1.sy(grand));
    ctx.beginPath();
    ctx.moveTo(p1.x, gy);
    ctx.lineTo(p1.x + p1.w, gy);
    ctx.stroke();

    /* The mean, dashed. Both marks are references, so both take
       `--c-reference` and the dash distinguishes them — the same option
       `spanningRule` takes. Without it, "Z-score → mean 0, sd 1" is a claim
       with nothing on screen to check against. */
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    const my = Math.round(p1.sy(state.pooledMean)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, my);
    ctx.lineTo(p1.x + p1.w, my);
    ctx.stroke();
    ctx.restore();

    const band = p1.w / SAMPLES;
    const half = Math.min(band * 0.34, 15);
    ctx.save();
    ctx.lineWidth = 1;
    boxes.forEach((b, i) => {
      const cx = Math.round(p1.x + band * (i + 0.5)) + 0.5;

      /* Outliers first, under the box: everything past 1.5 x IQR. Faint
         because there are 683 on raw data against 55 after the log. */
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

      /* The median is what the scale tile measures and what the rule behind it
         is compared against, so it is the heaviest mark in the box. On raw data
         the box is 6% of the panel. */
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

    /* Two lines under both panels. The first names the pipeline, because the
       two captions cannot say what was done to the data and the exported PNG
       has no rail beside it.

       The second is the count of dropped values. It was panel 2's note and, at
       the narrowest canvas (535px, where panel 2 gets about 200), its 51
       characters printed through the caption, the note above it and a tick
       label — six collisions across four states. Only the full canvas is wide
       enough. `--c-highlight` rather than muted, because a figure drawn from a
       third of the table is the thing to look at (2.11). */
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colors.ink3;
    ctx.fillText(pipelineLabel(params), padL, figTop + FIG_H - 18);
    if (state.dropped > 0) {
      ctx.fillStyle = colors.highlight;
      ctx.fillText(
        `${state.dropped.toLocaleString("en")} of ${state.total.toLocaleString("en")} values dropped — Box–Cox needs y > 0`,
        padL, figTop + FIG_H - 2,
      );
    }
    ctx.restore();
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
         the tile must not say 1000 while the panel holds 604. */
      label: "Variance vs mean",
      value: fmt(state.rho, 2),
      note: `Spearman ρ over ${state.pts.length.toLocaleString("en")} genes`,
    },
  ],

  /* The boxplot's five numbers plus the outlier count, which is the one thing
     on the canvas a reader cannot count. */
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
  const { small, rank, ref, after } = act;
  /* One continuous number carries the whole walk: 0 the table, 1 sorted, 2 the
     reference column, 3 assigned back. Everything below is read off it. */
  const p = anim?.p ?? 0;
  const ph = PHASES[Math.max(0, Math.min(PHASES.length - 1, Math.round(p)))];

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

  /* `toRank` is how far each cell has travelled from its gene row toward its
     rank row: up over [0,1], held over [1,2], back over [2,3]. `refFade` is the
     reference column arriving over [1,2]. `assigned` is whether the cells are
     carrying the reference value yet — flipped at the midpoint of the last
     move, so the number changes while the cell is travelling rather than on
     arrival, which is what makes the swap visible. */
  const toRank = clamp01(p) - easeInOut(clamp01(p - 2)) * clamp01(p);
  const refFade = clamp01(p - 1);
  const assigned = p > 2.5;

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
    const g = 1 - toRank;
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
      const row = g + (r - g) * toRank;
      const cx = gridX + cw * (s + 0.5);
      const cy = gridY + rh * (row + 0.5);
      const shown = assigned ? after[s][g] : small[s][g];
      ctx.fillStyle = assigned ? colors.highlight : colors.ink1;
      ctx.fillText(fmt(shown, assigned ? 1 : 0), cx, cy);
    }
  }

  /* the reference column, arriving over [1, 2] */
  if (refFade > 0) {
    ctx.globalAlpha = refFade;
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
