/* ============================================================================
   Batch Effects — widget 40. DRAFT.

   Hosts at PHM5003 `05 - Introduction to High Throughput Data / 05 - Batch
   Effect Correction`. The misconception: that a batch effect is noise you
   subtract. The danger is confounding, and correcting a confounded design
   removes the biology along with the batch.

   The full design record is in `docs/catalogue.md` § Slot 3.

   ---------------------------------------------------------------------------
   THE STAGE IS THE LESSON'S OWN, plus one control it does not have. Cell 3
   builds 50 genes x 40 samples, an effect of 0.8 on genes 1-25 of the diseased
   samples, and a +2 shift on samples 21-40. Condition alternates while batch
   splits at sample 20, so every batch holds 10 healthy and 10 diseased — the
   design is balanced, which is why the correction works, and the lesson never
   says so. `overlap` is that assumption made into a dial.

   BALANCED IS NOT "NO BATCH EFFECT", and the control used to say it was. Two
   dials do two jobs: the batch shift decides whether an artefact exists at
   all, the confounding decides whether it can be told apart from the biology.
   At `balanced` with the notebook's shift, separation along PC1 is still
   7.80 sd by batch. The slider read "Overlap ... none" and cost a reader a
   session.

   ---------------------------------------------------------------------------
   THE POINT ESTIMATE IS NOT THE STORY. Per gene, truth 0.80, 5 seeds:

       confounding  none              remove            covariate
        balanced    0.83 [-0.06,1.71] 0.83 [ 0.21,1.44] 0.83 [ 0.20,1.45]
        half        1.81 [ 0.98,2.63] 0.62 [-0.01,1.25] 0.83 [ 0.10,1.55]
        strong      2.22 [ 1.46,2.98] 0.44 [-0.19,1.08] 0.87 [-0.01,1.74]
        complete    2.77 [ 2.14,3.40] 0.00 [-0.63,0.63]      not estimable

   Three failures and they are different shapes. `none` reports the batch as
   biology, NARROWLY. `remove` takes the batch out of the DATA and the
   comparison that follows has no idea a correction happened, so it stays just
   as narrow while the estimate walks to zero — confidently wrong. `covariate`
   spends the same information inside the model, so it WIDENS instead: the
   right answer, and by `strong` no power left to act on it.

   That is why the widget draws intervals rather than points. On points alone
   `remove` and `covariate` look like near neighbours, and the only honest
   thing to say about the covariate — that confounding costs you the study
   rather than the estimate — cannot be said at all.

   `remove` is `ComBat(mod = NULL)`, which is what cell 12 runs; `covariate` is
   the `mod = model.matrix(~ condition)` cell 11 calls "optional but
   recommended".

   THE GENES WITH NO EFFECT are the clinical half of that: uncorrected at full
   confounding they report a difference of 2.000, which is the batch shift
   exactly.

   ---------------------------------------------------------------------------
   THE SAME POINTS, COLOURED TWICE — the lesson's own figure. One panel with a
   toggle put the pay-off behind a control the reader had no reason to press:
   correcting while coloured by batch shows the batch merging, which is the
   setup and not the conclusion.

   THE PALETTE IS SHARED between the panels on purpose. Blue is Batch 1 on the
   left and Healthy on the right, so the two panels CONVERGE as the confounding
   rises, and at `complete` they are the same picture — which is what "batch
   and condition are one variable" looks like. The count under the right panel
   says it in numbers: 20 of 40 samples carry the same colour in both at a
   balanced design, 40 of 40 at complete.

   THE PROJECTION IS FIXED, and that follows from the ease rather than from
   taste; `projectAll` in model.js has the measurements. Refitting the PCA per
   correction rotates the axes, so the points would move for reasons that are
   about the basis rather than the data.

   ---------------------------------------------------------------------------
   NO DRIVE BUTTONS (4.5). The one motion is the ease between corrections, on
   core's ease-request door: the claim is that the correction moves the same
   forty samples, and a jump only asserts that.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  simulate, correct, CORRECTIONS, nullEffect, estimateWithSE,
  projectAll, design, TRUE_EFFECT, AFFECTED, GENES, SAMPLES,
} from "./model.js";

const FIG_H = 428;
const EASE_MS = 600;
/* The forest plot's row labels. Declared at module scope, not beside the loop
   that paints them: a const is in its temporal dead zone until its own line
   runs, and this collection has thrown that way twice. They match the picker's
   labels word for word, because a reader comparing a row to a button should
   not have to translate. */
const SHORT = {
  none: "None",
  known: "Subtract known",
  remove: "Remove from data",
  covariate: "Batch as covariate",
};
/* The formula card's reserved height. Natural height runs 105px to 128px across
   the 20 reachable card states at the narrowest column the side layout reaches
   (534px), a 23px jog under the figure as the correction changes (3.4d). 128px
   is 11.64em against this card's 11px type; 12em covers it with the usual few
   percent for a font substitution. It grew from 8.2em when the symbol key
   arrived — a reserve is measured, not carried forward. */
const CARD_EM = "12em";

/* The design ladder. A magnitude — how far batch and condition line up — with
   the notebook's own balanced design at the left end. The right end is the
   only setting where the estimate does not exist, and it is kept because that
   boundary is the argument's conclusion (2.6). */
const OVERLAPS = [
  { value: "0", amount: 0, label: "balanced",
    detail: "10 healthy and 10 diseased in each batch — the notebook's design" },
  { value: "0.25", amount: 0.25, label: "slight", detail: "12 and 8, against 8 and 12" },
  { value: "0.5", amount: 0.5, label: "half", detail: "15 and 5, against 5 and 15" },
  { value: "0.75", amount: 0.75, label: "strong", detail: "17 and 3, against 3 and 17" },
  { value: "1", amount: 1, label: "complete",
    detail: "one batch entirely healthy, the other entirely diseased — batch and condition are now the same variable" },
];
const overlapOf = (k) => OVERLAPS.find((o) => o.value === k)?.amount ?? 0;

/* The batch shift, against a disease effect of 0.8. The crossover where the
   batch takes PC1 from the condition is measured near 1.0, not the notebook's
   2 — separations of 3.53 against 0.97 there, and 1.43 against 2.16 at 0.5. */
const SHIFTS = [
  { value: "0", amount: 0, label: "none", detail: "no batch effect at all" },
  { value: "0.5", amount: 0.5, label: "0.5", detail: "smaller than the disease effect; the condition still owns PC1" },
  { value: "1", amount: 1, label: "1.0", detail: "about the crossover: the batch takes PC1 from the condition" },
  { value: "2", amount: 2, label: "2.0", detail: "the notebook's setting — 2.5x the disease effect" },
  { value: "4", amount: 4, label: "4.0", detail: "the batch dominates completely" },
];
const shiftOf = (k) => SHIFTS.find((s) => s.value === k)?.amount ?? 2;

/* ---- the formula card ---------------------------------------------------
   The notebook's own model, cell 10:

       X_ij = alpha_i + beta_i Y_j + gamma_ij + epsilon_ij

   i indexes GENES and j SAMPLES, which is where the simulation's size lives
   and the reason the card states both ranges: 50 genes and 40 samples are the
   lesson's own dimensions, and every correction below is applied per gene.

   The four options are four things to do with that one model, so the card
   shows it once and then says what the chosen correction does to it. The
   difference between the last two is visible in the notation and nowhere else:
   `remove` estimates gamma with beta LEFT OUT of the model, `covariate` fits
   both and reports beta-hat.

   THE KEY ROW IS NOT DECORATION. Two readers in a row have read X as a
   predictor, and both were right to: this is a regression PER GENE with the
   expression as the RESPONSE and the condition as the predictor, which is the
   opposite direction from "predict disease from genes". Worse, the lesson
   swaps its own letters four cells later — cells 14 and 19 write
   `Y = X beta + W gamma + eps` with Y the expression matrix and X the design.
   So the card says what each symbol is, in words, where the formula is. */
const MATHML = mathmlRenders();
const SUB = (v, sub) => `<msub><mi>${v}</mi>`
  + (sub.length > 1 ? `<mrow>${[...sub].map((c) => `<mi>${c}</mi>`).join("")}</mrow>` : `<mi>${sub}</mi>`)
  + `</msub>`;
const SUB2 = (v) => `<msub><mi>${v}</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub>`;
const HAT = (v) => `<mover accent="true"><mi>${v}</mi><mo>&#x5E;</mo></mover>`;

const MODEL = {
  math: `<math><mrow>${SUB2("X")}<mo>=</mo>${SUB("&#x3B1;", "i")}<mo>+</mo>`
    + `${SUB("&#x3B2;", "i")}${SUB("Y", "j")}<mo>+</mo>${SUB2("&#x3B3;")}`
    + `<mo>+</mo>${SUB2("&#x3B5;")}</mrow></math>`,
  plain: "X(i,j) = a(i) + b(i)·Y(j) + g(i,j) + e(i,j)",
};

const STEP = {
  none: {
    math: null,
    plain: "nothing is removed; the batch term is still in every measurement",
  },
  known: {
    math: `<math><mrow><msup>${SUB2("X")}<mo>&#x2032;</mo></msup><mo>=</mo>`
      + `${SUB2("X")}<mo>&#x2212;</mo><mi>&#x3B3;</mi></mrow></math>`,
    plain: "X'(i,j) = X(i,j) − g",
    note: "γ itself, which the lesson knows because it simulated the data",
  },
  remove: {
    math: `<math><mrow><msup>${SUB2("X")}<mo>&#x2032;</mo></msup><mo>=</mo>`
      + `${SUB2("X")}<mo>&#x2212;</mo><msub>${HAT("&#x3B3;")}<mi>k</mi></msub></mrow></math>`,
    plain: "X'(i,j) = X(i,j) − ĝ(k)",
    note: "γ̂ estimated as batch k's own mean, per gene, with β left out of the model",
  },
  covariate: {
    math: `<math><mrow><mtext>report&#xA0;</mtext>${SUB(HAT("&#x3B2;"), "i")}`
      + `<mtext>&#xA0;from the model above</mtext></mrow></math>`,
    plain: "report b̂(i) from the model above",
    note: "the data is left alone; β and γ are estimated together",
  },
};

/* Every symbol, in words. X is the MEASUREMENT and Y is the condition, which
   is cell 10's convention and the opposite of the "predict disease from genes"
   reading a student arrives with. */
const KEY_ROWS = [
  ["X", "ij", "gene i's expression in sample j — the response"],
  ["Y", "j", "sample j's condition — the predictor"],
  ["&#x3B1;", "i", "gene i's mean"],
  ["&#x3B2;", "i", "the disease effect on gene i"],
  ["&#x3B3;", "ij", "the batch effect"],
  ["&#x3B5;", "ij", "noise"],
];

let cardHost = null;
let cardKey = null;

function renderCard(params, shift) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    cardHost.style.minHeight = CARD_EM;
    figure.parentNode.insertBefore(cardHost, figure);
  }
  /* Only the oracle's row shows the shift, so only it keys on one — otherwise
     every tick of the slider rewrites the card's MathML mid-drag. */
  const key = params.correct === "known" ? `known|${shift}` : params.correct;
  if (key === cardKey) return;
  cardKey = key;

  const row = (label, body, note) =>
    `<div class="w-math-eq" style="min-height:0;padding-left:6.4em;text-indent:-6.4em">`
    + `<span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>`
    + `<span>${body}</span>`
    + (note ? `<span style="color:var(--ink-3);font-size:var(--fs-xs)">&nbsp;&nbsp;${note}</span>` : "")
    + `</div>`;

  /* One line, symbols set the way the formula sets them so the eye can match
     them, words in the note ink so the row reads as a reference rather than a
     third equation. */
  const KEY = `<div class="w-math-eq" style="min-height:0;padding-left:6.4em;text-indent:-6.4em">`
    + `<span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">where</span>`
    + KEY_ROWS.map(([v, sub, what]) => (MATHML
      ? `<math><mrow>${SUB(v, sub)}</mrow></math>`
      : `<span style="font-size:var(--fs-xs)">${v}(${sub})</span>`)
      + `<span style="color:var(--ink-3);font-size:var(--fs-xs)">&nbsp;${what}</span>`)
      .join(`<span style="color:var(--ink-4);font-size:var(--fs-xs)">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)
    + `</div>`;

  const step = STEP[params.correct];
  const stepBody = MATHML && step.math
    ? step.math
    : `<span style="font-size:var(--fs-xs);color:var(--ink-3)">${step.plain}</span>`;
  const stepNote = params.correct === "known"
    ? `γ = ${shift.toFixed(1)} — ${step.note}`
    : step.note;

  cardHost.innerHTML =
    row("The model", MATHML ? MODEL.math : `<span style="font-size:var(--fs-xs)">${MODEL.plain}</span>`,
      `i = 1…${GENES} genes, j = 1…${SAMPLES} samples`)
    + KEY
    + row("The correction", stepBody, stepNote);
}

const lerp = (a, b, t) => a + (b - a) * t;

/* A correction that removes exactly as much as it should lands on -1e-16, and
   `fmt` renders that as "-0.00". Zero has no sign. */
const zeroed = (v, d = 2) => fmt(Math.abs(v) < 5 * 10 ** -(d + 1) ? 0 : v, d);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

defineWidget({
  slug: "batch-effect",
  title: "Batch Effects",
  subtitle:
    "Samples processed in different batches carry a systematic difference that "
    + "has nothing to do with the biology. Correcting it works when the batches "
    + "are balanced, and removes the biology when they are not.",
  layout: "side",
  status: "draft",
  height: FIG_H,

  params: {
    data: { type: "section", label: "The study" },

    overlap: {
      type: "choice",
      /* NOT "overlap", which cost a reader a session. `none` under a label
         naming batch and condition reads as "no batch effect", and it is a
         different dial: the batch shift below says whether an artefact exists,
         this one says whether it can be told apart from the biology. At
         `balanced`, batch separation along PC1 is still 7.80 sd. */
      label: "Batch–condition confounding",
      options: OVERLAPS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "0",
    },

    shift: {
      type: "choice",
      label: "Size of the batch effect",
      options: SHIFTS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "2",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    corr: { type: "section", label: "Correction" },

    /* Display, not data: all three corrections are computed together and the
       picker chooses which to show, which is also what lets the change ease
       rather than jump. */
    correct: {
      type: "segmented",
      style: "grid",
      label: "Method",
      /* Four options, so the grid is a plain 2 x 2 and nothing spans. They are
         the lesson's own sequence: do nothing, subtract the shift you were
         handed, estimate it from the data, or put the batch in the model. */
      options: [
        { value: "none", label: "None",
          detail: "the batch shift is still in the data" },
        { value: "known", label: "Subtract known",
          detail: "subtract the true shift — which the lesson can do because it simulated the data, and nobody can do in a real study" },
        { value: "remove", label: "Remove from data",
          detail: "estimate each batch's own mean and subtract it — ComBat with mod = NULL, which is what the lesson runs" },
        { value: "covariate", label: "Batch as covariate",
          detail: "leave the data alone and estimate the condition effect from y ~ condition + batch" },
      ],
      default: "none",
      display: true,
    },
  },

  /* One swatch, two meanings, and that is the design rather than a compromise:
     the panels share a palette so that they converge as the confounding rises.
     Each label names both, left panel first. */
  legend: [
    { token: "group-a", label: "Batch 1, left · Healthy, right", mark: "dot" },
    { token: "group-b", label: "Batch 2, left · Disease, right", mark: "dot" },
    { token: "reference", label: "The true effect, 0.80", mark: "dash" },
  ],

  compute: ({ params }) => {
    const sim = simulate({
      seed: params.seed,
      overlap: overlapOf(params.overlap),
      batchShift: shiftOf(params.shift),
    });
    const { points, share } = projectAll(sim);
    const d = design(sim);

    /* Every correction's estimate, computed here so the strip can show all
       three at once. At the opening state they coincide on the truth and only
       separate once the reader creates the confounding themselves (2.1). */
    const nulls = {};
    const est = {};
    for (const key of Object.keys(CORRECTIONS)) {
      /* ONE estimator, not two. `estimatedEffect` computed the same number a
         different way and both were on screen; they agreed to 6e-9, which is
         exactly how two copies of a formula start out. `estimateWithSE` is the
         one that also carries the interval, so it is the one that stays. */
      nulls[key] = nullEffect(correct(sim, key), sim.disease);
      est[key] = estimateWithSE(sim, key);
    }

    /* ONE FRAME FOR EVERY CORRECTION, and it is the fix for the defect the
       scatter shipped with: the domain came from the CURRENT correction's
       points, so the cloud refilled the panel after every correction and the
       collapse — 20.4 units wide down to 6.7 at the notebook's own settings —
       was invisible. Same fault as the strip's, one panel over (2.5). */
    const flat = Object.values(points).flat();
    const frame = {
      x: padded(flat.map((q) => q[0])),
      y: padded(flat.map((q) => q[1])),
    };

    /* How alike the two panels are IS the confounding: a sample carries the
       same colour in both only when its batch and its condition agree. 20 of
       40 at a balanced design, 40 of 40 when batch and condition are one
       variable and the panels become the same picture. */
    const sameColour = sim.disease.filter((v, j) => (sim.batch[j] === 1) === v).length;

    return { sim, points, share, design: d, nulls, est, frame, sameColour };
  },

  animation: {
    stepLabel: null,
    runLabel: null,

    init: ({ params, state }) => ({
      key: params.correct,
      t: 1,
      from: state.points[params.correct],
    }),

    advance: (anim, { dt }) => {
      if (anim.t >= 1) return false;
      anim.t = Math.min(1, anim.t + dt / EASE_MS);
      return anim.t < 1;
    },

    /* `rebuild` runs for every display change, so the guard matters: without
       it, any other display parameter would restart the ease from wherever the
       points had got to. `from` freezes the CURRENT blended positions, so a
       reader who switches mid-ease sees the points continue rather than snap. */
    rebuild: (anim, { params, state }) => {
      if (params.correct === anim.key) return;
      anim.from = blend(anim, state);
      anim.key = params.correct;
      anim.t = 0;
      anim.easing = true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    renderCard(params, state.sim.shift);
    const pts = blend(anim, state);
    const { design: d, share, frame } = state;

    const top = 26;
    const panelH = 196;
    const panelBottom = top + panelH;
    const rowY = panelBottom + 78;          // below the shared x-axis label
    const axisPad = 40;                     // the left panel's y-axis labels
    const gap = 26;
    /* The right panel's last tick label is CENTRED on its right edge, so
       without this it overhangs the canvas by half its width. */
    const rightPad = 14;
    const panelW = (w - axisPad - gap - rightPad) / 2;

    /* --- the same points, coloured twice -------------------------------- *
     * The lesson's own figure. One panel at a time put the pay-off behind a
     * control the reader had no reason to touch: press a correction while
     * coloured by batch and you watch the batch merge, which is the setup and
     * not the conclusion.
     *
     * THE PALETTE IS SHARED ON PURPOSE. Blue is Batch 1 on the left and
     * Healthy on the right, so as the confounding rises the two panels
     * converge, and at `complete` they are the SAME PICTURE — which is what
     * "batch and condition are one variable" looks like. Two palettes would
     * have hidden that. */
    const panels = [
      { key: "batch", title: "Coloured by batch", of: (j) => state.sim.batch[j] === 1 },
      { key: "condition", title: "Coloured by condition", of: (j) => state.sim.disease[j] },
    ];

    panels.forEach((panel, i) => {
      const plot = makePlot({
        ctx,
        colors,
        rect: { x: axisPad + i * (panelW + gap), y: top, w: panelW, h: panelH },
        xDomain: frame.x,
        yDomain: frame.y,
      });
      plot.grid(ticksOf(frame.y));
      if (i === 0) plot.axisY({ ticks: ticksOf(frame.y), format: axisFmt });
      /* No per-panel axis LABEL. One under each left them 23px apart at the
         narrow column — no overlap, so the collision sweep passed, and they
         still read as a single run-on string. The axis is shared, so the label
         is drawn once below both. */
      plot.axisX({ ticks: ticksOf(frame.x), format: axisFmt });
      plot.caption(panel.title);
      if (i === 1) plot.note(`${state.sameColour} of ${SAMPLES} match the left`);

      ctx.save();
      for (let j = 0; j < pts.length; j += 1) {
        ctx.fillStyle = panel.of(j) ? colors.groupB : colors.groupA;
        ctx.beginPath();
        ctx.arc(plot.sx(pts[j][0]), plot.sy(pts[j][1]), 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    /* The axis both panels share, named once and centred across the pair. */
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `PC1 of the uncorrected data · ${(share[0] * 100).toFixed(0)}% of its variance`,
      axisPad + (2 * panelW + gap) / 2, panelBottom + 36,
    );
    ctx.restore();

    /* --- the design, as a 2 x 2 ----------------------------------------- *
     * Confounding is a property of the design rather than of the data, and a
     * reader seeing only the scatter cannot tell an unbalanced design from a
     * large batch effect. Four numbers, beside the consequence (2.7). */
    const tableW = 168;
    drawDesign(ctx, colors, 0, rowY, tableW, d);

    /* --- every estimate with its interval -------------------------------- */
    drawForest(ctx, colors, tableW + 24, rowY, w - tableW - 24, state, params);
  },

  /* ONLY `preserve` GOES BLANK on a confounded design, and getting that wrong
     cost the widget its best numbers. Fitting condition alongside batch needs
     the two to be separable, and at total overlap they are not. The other two
     are perfectly well defined and they ARE the lesson: uncorrected you would
     report 2.81 as the disease effect, and the naive correction returns 0.000
     having deleted it. Blanking those said the widget could not answer, when
     what it has to say is that both answers are wrong. */
  readout: ({ state, params }) => {
    const r = state.est[params.correct];
    /* The fit itself says whether the effect exists, rather than a rule about
       which correction it was: `ols` returns null on a singular design and the
       estimate comes back NaN. */
    const blank = !Number.isFinite(r.beta);
    return [
      {
        label: "Estimated disease effect",
        value: blank ? "—" : zeroed(r.beta),
        note: blank
          ? "not estimable: batch and condition are the same variable"
          : `95% interval ${zeroed(r.lo)} to ${zeroed(r.hi)}, against a truth of ${TRUE_EFFECT.toFixed(2)}`,
      },
      {
        label: "Genes with no effect",
        value: blank ? "—" : zeroed(state.nulls[params.correct]),
        note: `${GENES - AFFECTED} of ${GENES} genes; the honest answer is 0`,
      },
      {
        label: "Smallest design cell",
        value: String(state.design.smallest),
        note: state.design.estimable
          ? "every batch holds both conditions"
          : "a batch with only one condition in it",
      },
    ];
  },

  table: ({ state }) => ({
    columns: ["Correction", "Estimated effect", "95% interval", "Genes with no effect"],
    rows: Object.keys(CORRECTIONS).map((k) => {
      const r = state.est[k];
      if (!Number.isFinite(r.beta)) return [CORRECTIONS[k].label, "not estimable", "—", "—"];
      return [
        CORRECTIONS[k].label,
        zeroed(r.beta, 3),
        `${zeroed(r.lo, 3)} to ${zeroed(r.hi, 3)}`,
        zeroed(state.nulls[k], 3),
      ];
    }),
  }),
});

/* --- helpers -------------------------------------------------------------- */

/** The points as they are right now: the eased blend between where they were
    and where the chosen correction puts them. */
function blend(anim, state) {
  const target = state.points[anim?.key ?? "none"];
  if (!anim || anim.t >= 1 || !anim.from) return target;
  const k = easeInOut(anim.t);
  return target.map((p, j) => [
    lerp(anim.from[j][0], p[0], k),
    lerp(anim.from[j][1], p[1], k),
  ]);
}

function padded(vals) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const m = (hi - lo) * 0.08 || 1;
  return [lo - m, hi + m];
}

/* A tick at -1e-9 renders as "-0" through toFixed. Zero has no sign — the same
   rule `zeroed` enforces on the estimates.

   A `function`, not a `const` arrow, and that is the whole point: helpers below
   `defineWidget` are read by `draw`, which runs synchronously while the file is
   still evaluating. A const is in its temporal dead zone until its own line
   runs. THIRD time in this collection — `SHORT` in normalization, `byBatch`
   here, then this. Every helper below the widget is a declaration, so the
   shape cannot recur. */
function axisFmt(v) {
  return Math.abs(v) < 0.5 ? "0" : v.toFixed(0);
}

function ticksOf([lo, hi]) {
  return [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
}

function drawDesign(ctx, colors, x, y, w, d) {
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("The design", x, y - 8);

  const cw = 62;
  const rh = 26;
  const gx = x + 58;
  const gy = y + 22;

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Healthy", gx + cw * 0.5, gy - 10);
  ctx.fillText("Disease", gx + cw * 1.5, gy - 10);
  ctx.textAlign = "right";
  ctx.fillText("Batch 1", gx - 8, gy + rh * 0.5);
  ctx.fillText("Batch 2", gx - 8, gy + rh * 1.5);

  ctx.textAlign = "center";
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      const v = d.cells[r][c];
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + cw * c + 0.5, gy + rh * r + 0.5, cw, rh);
      /* The empty cell is the cause and the tiles are the consequence, so it is
         marked rather than left to be counted. */
      ctx.fillStyle = v === 0 ? colors.extreme : colors.ink1;
      ctx.font = v === 0 ? `600 ${colors.fsSm} ${colors.font}` : `${colors.fsSm} ${colors.font}`;
      ctx.fillText(String(v), gx + cw * (c + 0.5), gy + rh * (r + 0.5));
    }
  }

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = d.estimable ? colors.ink3 : colors.extreme;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    d.estimable ? "every batch holds both conditions" : "a batch with only one condition",
    x, gy + rh * 2 + 10,
  );
  ctx.restore();
}

/**
 * Every correction's estimate WITH its 95% interval, as a forest plot.
 *
 * It shows all four at once rather than the chosen one, because the comparison
 * IS the teaching and it cannot be made one click at a time. Measured at strong
 * confounding, batch shift 2:
 *
 *     none        [ 1.44, 3.02]   narrow, and nowhere near 0.80
 *     remove      [-0.24, 1.08]   just as narrow, and wrong the other way
 *     covariate   [-0.08, 1.74]   covers the truth, and crosses zero
 *
 * `remove` takes the batch out of the DATA and the t-test that follows has no
 * idea a correction happened, so it stays confident while the estimate moves.
 * `covariate` spends the same information inside the model, so it widens
 * instead. A point estimate makes those two look like near neighbours.
 */
function drawForest(ctx, colors, x, y, w, state, params) {
  const LAB = 104;
  const x0 = x + LAB;
  const x1 = x + w - 14;
  /* A FIXED DOMAIN, for the reason 2.5 records: an axis refitted per state puts
     0.79 at a balanced design and 2.23 at a confounded one in the same place.
     Measured over every state at seeds 1..200 step 37 the interval ends run
     -0.702 to 5.488, so -1 to 6 covers them. */
  const LO = -1;
  const HI = 6;
  const SX = (v) => x0 + ((v - LO) / (HI - LO)) * (x1 - x0);

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Estimated disease effect, per gene", x, y - 8);

  const rowH = 19;
  const rows = Object.keys(CORRECTIONS);
  const firstRow = y + 20;
  const axis = firstRow + rows.length * rowH + 2;

  /* Zero and the truth, both drawn before the marks so no interval hides them.
     Zero is what an interval crossing it means: this study cannot tell you the
     gene responds at all. */
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(SX(0)) + 0.5, y + 8);
  ctx.lineTo(Math.round(SX(0)) + 0.5, axis);
  ctx.stroke();

  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(SX(TRUE_EFFECT), y + 8);
  ctx.lineTo(SX(TRUE_EFFECT), axis);
  ctx.stroke();
  ctx.setLineDash([]);

  rows.forEach((key, i) => {
    const cy = firstRow + i * rowH + rowH / 2;
    const on = key === params.correct;
    const r = state.est[key];

    ctx.font = `${on ? "600 " : ""}${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = on ? colors.ink1 : colors.ink2;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(SHORT[key], x + LAB - 10, cy);

    if (!Number.isFinite(r.beta)) {
      ctx.textAlign = "left";
      ctx.fillStyle = colors.extreme;
      ctx.fillText("not estimable — batch and condition are one variable", x0 + 2, cy);
      return;
    }

    /* 0.4 on the unchosen rows put them below reading at a projection, and the
       whole reason all four are drawn is that they be compared. */
    ctx.globalAlpha = on ? 1 : 0.72;
    ctx.strokeStyle = on ? colors.highlight : colors.ink2;
    ctx.lineWidth = on ? 2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(SX(r.lo), cy);
    ctx.lineTo(SX(r.hi), cy);
    ctx.stroke();
    ctx.fillStyle = on ? colors.highlight : colors.ink2;
    ctx.beginPath();
    ctx.arc(SX(r.beta), cy, on ? 4 : 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.fillStyle = on ? colors.ink1 : colors.ink2;
    ctx.fillText(zeroed(r.beta), SX(r.hi) + 7, cy);
    ctx.globalAlpha = 1;
  });

  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, axis + 0.5);
  ctx.lineTo(x1, axis + 0.5);
  ctx.stroke();

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let v = LO; v <= HI; v += 1) ctx.fillText(String(v), SX(v), axis + 5);
  ctx.restore();
}
