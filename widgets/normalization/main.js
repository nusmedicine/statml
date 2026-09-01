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
   unchanged to 7e-14, which is float noise. The axis labels are what carry the
   other half — they read 0-468 before and 0-1 after — which is why the y axis
   FITS the data rather than staying fixed, and why the panel prints its own
   span. A fixed axis was drawn in the mock and makes the scaled data an
   unreadable sliver; a fit axis with no printed range makes the control look
   broken.

   Median normalisation is the exception that proves what "affine" is doing
   here: it is affine PER SAMPLE and is not one map over the table, so it does
   move the pooled skew, 2.978 -> 3.014. Small, real, and the reason nothing on
   screen says "affine" — it says "scaling".

   ---------------------------------------------------------------------------
   THE STAGE IS GAMMA AND THE DEPTH SPREAD IS A CONTROL. Both settled on
   measurement; the full record and the losing candidates are in
   `docs/catalogue.md` § Slot 1, and `model.js` carries the stage table. The
   short version:

     - The notebook's `simulate_data` draws every sample from the SAME mean
       vector, so its ten samples are already on one scale and every normaliser
       has nothing to correct. `spread` gives sample j a depth factor. Turning
       it to none IS the notebook's stage, which is why it is a control and not
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

import { defineWidget, makePlot, fmt } from "../core/index.js";
import {
  simulate, apply, summarise, quantiles, median, NORMALIZE, TRANSFORM,
} from "./model.js";

/* The notebook's own dimensions. 1000 genes x 10 samples costs 6.2 ms through
   the whole pipeline — simulate, quantile-normalise, summarise — which is a
   slider that feels immediate, so neither is a control (3.5). */
const GENES = 1000;
const SAMPLES = 10;

/* The depth ladder. A magnitude, so a `choice` slider with tick labels rather
   than a dropdown (3.3): left-to-right carries "how unequal are the samples",
   and the leftmost position is the notebook's own stage. */
const SPREADS = [
  { value: "0", amount: 0, label: "none",
    detail: "every sample the same depth — the notebook's own stage, where no normalizer has anything to correct" },
  { value: "0.25", amount: 0.25, label: "±25%", detail: "a mild depth difference between samples" },
  { value: "0.5", amount: 0.5, label: "±50%", detail: "the deepest sample yields about 2.3× the shallowest" },
  { value: "0.75", amount: 0.75, label: "±75%", detail: "the deepest sample yields about 3.1× the shallowest" },
  { value: "1", amount: 1, label: "±100%", detail: "the deepest sample yields about 4× the shallowest" },
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

/* Which panel each tile belongs to, so the readout reads left to right in the
   same order the figure does (3.1). */
const PANEL_GAP = 26;

defineWidget({
  slug: "normalization",
  title: "Normalization and Transformation",
  subtitle:
    "Normalization puts the samples on one scale. Transformation changes the "
    + "shape of the distribution. They are two different operations applied in "
    + "order, and neither one does the other's job.",
  layout: "side",
  status: "draft",
  height: 400,

  params: {
    /* --- THE DATA ------------------------------------------------------- */
    data: { type: "section", label: "The data" },

    spread: {
      type: "choice",
      label: "Depth difference between samples",
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
    // NOT `kept.map(quantiles)` — map passes (el, i, arr), so the index lands
    // in the `qs` argument and quantiles tries to map over 0.
    const boxes = kept.map((c) => quantiles(c));
    const grand = median(boxes.map((b) => b[2]));

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

    return { cols, boxes, grand, lo, hi, dropped, total: cols.length * cols[0].length,
      ...summarise(cols) };
  },

  draw: ({ ctx, colors, w, h, params, state }) => {
    const { boxes, grand, pts } = state;

    /* Two panels side by side, reading left to right in the rail's own order:
       the left panel is what step 1 moves, the right is what step 2 moves.
       The left gets the larger share because it holds ten boxes across; the
       right is a cloud and reads at any width. */
    const top = 26;
    const bottom = h - 34;
    const leftW = Math.round((w - PANEL_GAP) * 0.54);
    const padL = 46;
    const padR = 8;

    /* --- panel 1 · the distribution, per sample ------------------------- */
    const lo = Math.min(...boxes.map((b) => b[0]));
    const hi = Math.max(...boxes.map((b) => b[4]));
    const padY = (hi - lo) * 0.06 || 1;

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
    ctx.strokeStyle = colors.empirical;
    ctx.fillStyle = colors.surface2;
    ctx.lineWidth = 1;
    boxes.forEach(([p5, q1, med, q3, p95], i) => {
      const cx = Math.round(p1.x + band * (i + 0.5)) + 0.5;
      const yl = p1.sy(p5);
      const yh = p1.sy(p95);
      ctx.beginPath();
      ctx.moveTo(cx, yl);
      ctx.lineTo(cx, yh);
      ctx.moveTo(cx - half * 0.45, yl);
      ctx.lineTo(cx + half * 0.45, yl);
      ctx.moveTo(cx - half * 0.45, yh);
      ctx.lineTo(cx + half * 0.45, yh);
      ctx.stroke();

      const y3 = p1.sy(q3);
      const boxH = Math.max(1, p1.sy(q1) - y3);
      ctx.fillRect(cx - half, y3, half * 2, boxH);
      ctx.strokeRect(cx - half, y3, half * 2, boxH);

      /* The median is the mark the scale tile measures, so it is the heaviest
         thing in the box and it is what the reader compares to the rule. */
      ctx.save();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - half, Math.round(p1.sy(med)) + 0.5);
      ctx.lineTo(cx + half, Math.round(p1.sy(med)) + 0.5);
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
    /* Said out loud, because the notebook's own Box-Cox cell ends `na.omit()`
       and never mentions it. A figure drawn from half the table with nothing
       saying so is the defect 2.11 exists to prevent. */
    if (state.dropped > 0) {
      p2.note(`${state.dropped.toLocaleString("en")} of ${state.total.toLocaleString("en")} values dropped — Box–Cox needs y > 0`);
    }

    ctx.save();
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.38;
    for (const [m, v] of pts) {
      ctx.beginPath();
      ctx.arc(p2.sx(m), p2.sy(v), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* One line under both panels, naming what is on screen. It is the pipeline
       the rail just built, in the rail's own words, because the figure has two
       captions and neither can say what was DONE to the data. */
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(pipelineLabel(params), padL, h - 2);
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
         a tile that says "over 1000 genes" while the panel holds 604 is exactly
         the kind of number that survives review because nobody recomputes it. */
      label: "Variance vs mean",
      value: fmt(state.rho, 2),
      note: `Spearman ρ over ${state.pts.length.toLocaleString("en")} genes`,
    },
  ],

  table: ({ state }) => ({
    columns: ["Sample", "5%", "25%", "Median", "75%", "95%"],
    rows: state.boxes.map((b, i) => [
      `Sample ${i + 1}`, ...b.map((v) => fmt(v, 2)),
    ]),
  }),
});

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

/** "Raw intensities" / "Quantile, then log(1+y)" — the pipeline, in the rail's
    own words. `λ` is spelled out because Box-Cox at 0.02 and at 1 are two
    different pictures and the caption has to say which one is on screen. */
function pipelineLabel(params) {
  const n = params.normalize === "none" ? null : NORMALIZE[params.normalize].label;
  const t = params.transform === "none"
    ? null
    : params.transform === "boxcox"
      ? `Box–Cox λ = ${params.lambda}`
      : TRANSFORM[params.transform].label;
  if (!n && !t) return "Raw intensities";
  if (n && t) return `${n}, then ${t}`;
  return n ?? t;
}
