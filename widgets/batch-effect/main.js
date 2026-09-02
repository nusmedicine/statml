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

   ---------------------------------------------------------------------------
   THREE OUTCOMES, NOT TWO, and the third is what the notebook names and does
   not use: cell 11 calls `mod = model.matrix(~ condition)` "optional but
   recommended" and cell 12 passes `mod = NULL`. Estimated effect, truth 0.80,
   mean of 5 seeds:

       overlap   none    batch mean   keep condition
        0.00     0.825      0.825          0.825
        0.25     1.240      0.813          0.847
        0.50     1.808      0.620          0.826
        0.75     2.219      0.443          0.868
        1.00     2.771      0.000      not estimable

   No correction reports the batch as biology. The naive correction removes the
   biology in proportion to the confounding. Keeping condition in the model
   holds the estimate wherever it can be held at all.

   THE GENES WITH NO EFFECT are the clinical half of that: uncorrected at full
   confounding they report a difference of 2.000, which is the batch shift
   exactly.

   ---------------------------------------------------------------------------
   ONE PANEL, ONE SPLIT AT A TIME. The reader colours by condition or by batch,
   and the legend follows. Both at once — hue for one, fill or shape for the
   other — put two questions on one mark; "do the samples separate by batch?" is
   a question you ask on its own, and the lesson's own figure asks it that way,
   drawing the same points twice.

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
  simulate, correct, CORRECTIONS, estimatedEffect, nullEffect,
  projectAll, design, TRUE_EFFECT, AFFECTED, GENES, SAMPLES,
} from "./model.js";

const FIG_H = 452;
const EASE_MS = 600;
/* The estimate strip's fixed upper end — see `drawStrip`. */
const STRIP_MAX = 5;
/* The formula card's reserved height. Natural height runs 65px to 87px across
   the 20 states at the narrowest column the side layout reaches (535px), a 22px
   jog under the figure as a control moves (3.4d). 87px is 7.91em against this
   card's 11px type; 8.2em covers it with the usual few percent for a font
   substitution. */
const CARD_EM = "8.2em";

/* The design ladder. A magnitude — how far batch and condition line up — with
   the notebook's own balanced design at the left end. The right end is the
   only setting where the estimate does not exist, and it is kept because that
   boundary is the argument's conclusion (2.6). */
const OVERLAPS = [
  { value: "0", amount: 0, label: "none",
    detail: "10 healthy and 10 diseased in each batch — a balanced design" },
  { value: "0.25", amount: 0.25, label: "some", detail: "12 and 8, against 8 and 12" },
  { value: "0.5", amount: 0.5, label: "half", detail: "15 and 5, against 5 and 15" },
  { value: "0.75", amount: 0.75, label: "most", detail: "17 and 3, against 3 and 17" },
  { value: "1", amount: 1, label: "total",
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
   both and reports beta-hat. */
const MATHML = mathmlRenders();
const SUB = (v, sub) => `<msub><mi>${v}</mi><mi>${sub}</mi></msub>`;
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
      label: "Overlap between batch and condition",
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

    /* One split coloured at a time, chosen. Colouring both at once — hue for
       the condition, fill for the batch — put two questions on one mark and
       neither was quick to read; "do the samples separate by batch?" is a
       question you ask on its own. Display-only. */
    colourBy: {
      type: "segmented",
      label: "Colour the samples by",
      options: [
        { value: "condition", label: "Condition", detail: "healthy against disease — the comparison the study is for" },
        { value: "batch", label: "Batch", detail: "which run each sample was processed in" },
      ],
      default: "batch",
      display: true,
    },

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

  /* The legend names what the colours ARE right now. A generic pair — "group
     one", "group two" — would survive both settings and tell the reader
     nothing, so it goes through the function door instead. */
  legend: ({ params }) => (params.colourBy === "batch"
    ? [
      { token: "group-a", label: "Batch 1", mark: "dot" },
      { token: "group-b", label: "Batch 2", mark: "dot" },
      { token: "reference", label: "The true effect, 0.80", mark: "line" },
    ]
    : [
      { token: "group-a", label: "Healthy", mark: "dot" },
      { token: "group-b", label: "Disease", mark: "dot" },
      { token: "reference", label: "The true effect, 0.80", mark: "line" },
    ]),

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
    const effect = {};
    const nulls = {};
    for (const key of Object.keys(CORRECTIONS)) {
      const X = correct(sim, key);
      effect[key] = estimatedEffect(X, sim.disease);
      nulls[key] = nullEffect(X, sim.disease);
    }
    return { sim, points, share, design: d, effect, nulls };
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
    const { design: d, share } = state;
    /* Declared here, not beside the loop that draws the points: `plot.note`
       reads it earlier, and a const is in its temporal dead zone until its own
       line runs. Second time in this collection — see `SHORT` in
       widgets/normalization/main.js. */
    const byBatch = params.colourBy === "batch";

    const top = 26;
    const scatterBottom = h - 108;
    const tableW = 186;
    const gap = 24;

    /* --- the design, as a 2 x 2 ----------------------------------------- *
     * Confounding is a property of the design rather than of the data, and a
     * reader seeing only the scatter cannot tell an unbalanced design from a
     * large batch effect. Four numbers, beside the consequence (2.7). */
    drawDesign(ctx, colors, 0, top, tableW, d);

    /* --- the scatter ---------------------------------------------------- */
    const sx = tableW + gap;
    const plot = makePlot({
      ctx,
      colors,
      rect: { x: sx + 40, y: top, w: w - sx - 48, h: scatterBottom - top },
      xDomain: padded(pts.map((p) => p[0])),
      yDomain: padded(pts.map((p) => p[1])),
    });
    plot.grid(ticksOf(plot.yDomain));
    plot.axisY({ ticks: ticksOf(plot.yDomain), format: (v) => v.toFixed(0) });
    plot.axisX({
      ticks: ticksOf(plot.xDomain),
      format: (v) => v.toFixed(0),
      label: `PC1 of the uncorrected data · ${(share[0] * 100).toFixed(0)}% of its variance`,
    });
    plot.caption("Samples");
    plot.note(byBatch ? "coloured by batch" : "coloured by condition");

    /* One split, one encoding. The reader picks which. */
    ctx.save();
    for (let j = 0; j < pts.length; j += 1) {
      const second = byBatch ? state.sim.batch[j] === 1 : state.sim.disease[j];
      ctx.fillStyle = second ? colors.groupB : colors.groupA;
      ctx.beginPath();
      ctx.arc(plot.sx(pts[j][0]), plot.sy(pts[j][1]), 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* --- the estimate strip --------------------------------------------- *
     * The tiles carry the numbers; this carries the distance from the truth,
     * which a tile cannot. All three corrections at once: at the opening state
     * they coincide, and they only separate as the reader turns up the
     * overlap. */
    drawStrip(ctx, colors, 0, h - 78, w, state, params);
  },

  /* ONLY `preserve` GOES BLANK on a confounded design, and getting that wrong
     cost the widget its best numbers. Fitting condition alongside batch needs
     the two to be separable, and at total overlap they are not. The other two
     are perfectly well defined and they ARE the lesson: uncorrected you would
     report 2.81 as the disease effect, and the naive correction returns 0.000
     having deleted it. Blanking those said the widget could not answer, when
     what it has to say is that both answers are wrong. */
  readout: ({ state, params }) => {
    const blank = params.correct === "covariate" && !state.design.estimable;
    return [
      {
        label: "Estimated disease effect",
        value: blank ? "—" : zeroed(state.effect[params.correct]),
        note: blank
          ? "not estimable: batch and condition are the same variable"
          : `the truth is ${TRUE_EFFECT.toFixed(2)}`,
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
    columns: ["Correction", "Estimated effect", "Genes with no effect"],
    rows: Object.keys(CORRECTIONS).map((k) => [
      CORRECTIONS[k].label,
      k === "covariate" && !state.design.estimable ? "not estimable" : zeroed(state.effect[k], 3),
      k === "covariate" && !state.design.estimable ? "not estimable" : zeroed(state.nulls[k], 3),
    ]),
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

function drawStrip(ctx, colors, x, y, w, state, params) {
  const pad = 46;
  const x0 = x + pad;
  const x1 = x + w - 12;
  /* A FIXED DOMAIN. It was `max(...vals) * 1.05`, which rescaled the axis on
     every state — and then 0.79 at a balanced design and 2.23 at a confounded
     one sat at the same place on screen, which is exactly the fault 2.5
     records. Measured over every reachable state at five seeds, the estimate
     runs -0.000 to 4.826 (overlap 1, batch shift 4, uncorrected), so 5 covers
     it with the truth at a sixth of the way along. */
  const SX = (v) => x0 + (v / STRIP_MAX) * (x1 - x0);

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Estimated disease effect", x, y - 4);

  const axis = y + 40;
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
  for (let i = 0; i <= 5; i += 1) ctx.fillText(String(i), SX(i), axis + 5);

  /* the truth, which is the thing every mark is judged against */
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(SX(TRUE_EFFECT), y + 8);
  ctx.lineTo(SX(TRUE_EFFECT), axis);
  ctx.stroke();

  const chosen = params.correct;
  for (const key of Object.keys(CORRECTIONS)) {
    if (key === "covariate" && !state.design.estimable) continue;
    const v = state.effect[key];
    const on = key === chosen;
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.fillStyle = on ? colors.highlight : colors.ink3;
    ctx.beginPath();
    ctx.arc(SX(v), axis - 8, on ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillText(zeroed(v), SX(v), axis - 16);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
