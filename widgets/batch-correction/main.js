/* ============================================================================
   Correcting a Batch Effect — widget 41. DRAFT.

   Page 2 of PHM5003 HTD `05 / 05`, cells 7–22. Page 1 (`batch-effect`) shows
   what a batch effect does to the data; this one shows what happens when you
   try to take it out. Both read `../batch-effect/model.js`.

   The full design record is in `docs/catalogue.md` § Slot 3.

   ---------------------------------------------------------------------------
   THE CLAIM: correcting the DATA and modelling the BATCH are different acts,
   and on a confounded design they fail in opposite directions.

   A PCA has nowhere to put a covariate, so looking at the data requires the
   matrix be transformed. A per-gene test must NOT have the matrix transformed,
   or the interval it reports is too narrow — the comparison that follows has no
   idea a correction happened. Measured at strong confounding, batch shift 2:

       method            batch sep in the picture   estimate   95% interval
       None                      10.58               2.23      [ 1.44, 3.02]
       Ground truth               1.76               0.83      [ 0.18, 1.48]
       Remove from data           0.00               0.42      [-0.24, 1.08]
       Batch as covariate        10.58               0.83      [-0.08, 1.74]

   THE METHOD WITH THE BEST PICTURE GIVES THE WORST ANSWER. `remove` drives the
   batch separation to exactly zero and reports 0.42 for an effect of 0.80,
   narrowly. `covariate` leaves the picture untouched at 10.58 — it never edits
   the matrix — and reports 0.83 with an interval so wide there is no power left
   to act on it. Neither of those is visible without both halves of the figure.

   ---------------------------------------------------------------------------
   `covariate` SHOWS THE UNCORRECTED PICTURE, and that is the fix rather than a
   gap. Including a covariate changes the MODEL, not the data. The first version
   of this figure residualised each gene on the fitted batch term purely so the
   scatter would have something to draw, which is a model-based method dressed
   as a data transformation — the conflation that split this slot into two
   pages. `model.js` now returns the matrix unchanged for it and
   `estimateWithSE` fits `y ~ condition + batch` on the raw gene, so the
   estimate is identical (Frisch–Waugh–Lovell) and the picture is honest.

   ---------------------------------------------------------------------------
   ONE PANEL, COLOURED BY CONDITION (Kenneth). Page 1 needs two because the
   question there is which split the data falls along. Here the question is
   whether the biology came back, so the panel is coloured by the thing you are
   trying to recover, and the width goes to the formula card and the intervals.

   THE ESTIMATE STRIP IS A FOREST PLOT: all four at once, because the comparison
   IS the teaching and it cannot be made one click at a time. Domain fixed at
   -1 to 6 — measured, interval ends run -0.702 to 5.488 over every state at
   seeds 1..200 step 37.

   NO DRIVE BUTTONS (4.5). The one motion is the ease between methods, on core's
   ease-request door: the claim is that a correction moves the same forty
   samples, and a jump only asserts that.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  simulate, CORRECTIONS, estimateWithSE, nullWithSE, projectAll,
  design, separation, TRUE_EFFECT, AFFECTED, GENES, SAMPLES,
} from "../batch-effect/model.js";

/* Measured, not guessed: the forest's tick row lands at 386 with the panel at
   168 and a 76px gap, so 384 clipped every state by 2px. */
const FIG_H = 392;
const EASE_MS = 600;

/* The forest plot's row labels, matching the picker word for word so a reader
   comparing a row to a button does not have to translate. Declared at module
   scope: `draw` runs while this module is still evaluating, so a const arrow
   further down would be in its temporal dead zone. */
const SHORT = {
  none: "None",
  known: "Ground truth",
  remove: "Remove from data",
  covariate: "Batch as covariate",
};

/* The formula card's reserved height. Natural height runs 124px to 147px across
   the reachable card states at the narrowest column the side layout reaches, a
   23px jog under the figure as the method changes (3.4d). 147px is 13.36em
   against this card's 11px type; 13.8em covers it with the usual few percent
   for a font substitution. Page 1's card is shorter because its method row is
   not there — a reserve is measured per widget, never carried over. */
const CARD_EM = "13.8em";

/* Page 1's ladder, unchanged, because the two pages are one argument. */
const OVERLAPS = [
  { value: "0", amount: 0, label: "balanced",
    detail: "10 healthy and 10 diseased in each batch — the notebook's design" },
  { value: "0.25", amount: 0.25, label: "slight", detail: "12 and 8, against 8 and 12" },
  { value: "0.5", amount: 0.5, label: "half", detail: "15 and 5, against 5 and 15" },
  { value: "0.75", amount: 0.75, label: "strong", detail: "17 and 3, against 3 and 17" },
  { value: "1", amount: 1, label: "complete",
    detail: "one batch entirely healthy, the other entirely diseased — batch and condition are now the same variable" },
];

const SHIFTS = [
  { value: "0", amount: 0, label: "none", detail: "no batch effect at all — nothing to correct" },
  { value: "0.5", amount: 0.5, label: "0.5", detail: "smaller than the disease effect" },
  { value: "1", amount: 1, label: "1.0", detail: "about the crossover: the batch takes PC1 from the condition" },
  { value: "2", amount: 2, label: "2.0", detail: "the notebook's setting — 2.5x the disease effect" },
  { value: "4", amount: 4, label: "4.0", detail: "the batch dominates completely" },
];

const overlapOf = (k) => OVERLAPS.find((o) => o.value === k)?.amount ?? 0;
const shiftOf = (k) => SHIFTS.find((s) => s.value === k)?.amount ?? 2;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/* ---- the formula card ---------------------------------------------------
   The notebook's own model, cell 10, and the key row is not decoration: this
   is a regression PER GENE with the expression as the RESPONSE and the
   condition as the predictor, which is the opposite direction from "predict
   disease from genes". The lesson swaps its own letters four cells later —
   cells 14 and 19 write `Y = X beta + W gamma + eps` with Y the expression
   matrix and X the design.

   The difference between the last two options is visible in the notation and
   nowhere else: `remove` estimates gamma with beta LEFT OUT of the model,
   `covariate` fits both and reports beta-hat without touching X. */
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
    note: "γ itself, which only a simulation can hand you",
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
    note: "X is not touched: β and γ are estimated together from the raw data",
  },
};

/* EVERY OPTION ON THIS PAGE NEEDS THE BATCH LABELS, and the lesson's remaining
   three are there because real batches are often unrecorded — run date,
   technician, reagent lot, plate position. Prose rather than controls (Kenneth):
   ComBat's empirical-Bayes step has nothing to do on this stage, measured in
   round 1, because the shift is identical for every gene and both batches have
   the same spread. Showing it needs a different stage, which is a different
   lesson. RUV gets a sentence for its own reason. */
const UNKNOWN_BATCH = `<p class="w-math-note" style="margin:0;font-size:var(--fs-xs)">`
  + `Every method above needs to know which batch a sample came from. The lesson `
  + `runs three that relax that: <b>ComBat</b> still needs the labels, <b>SVA</b> `
  + `needs none and estimates the unwanted variation from the data itself, and `
  + `<b>RUV</b> needs control genes carrying no biology — cell 21 picks genes `
  + `26–50, which are exactly the genes with no disease effect.</p>`;

/* Every symbol, in words. X is the MEASUREMENT and Y is the condition. */
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
let noteHost = null;

/**
 * The unknown-batch note, BELOW the figure rather than in the card.
 *
 * In the card it added 89px at the narrow column and took the natural height
 * from 128 to 217 — a block of static prose pushing the figure down every time
 * anyone looked at it. It is a footnote: nothing about it changes with a
 * parameter, and nobody consults it while reading the formula. Written once,
 * on first render.
 */
function renderNote() {
  if (noteHost) return;
  /* At the END of the stage, not straight after the figure: `nextSibling`
     there is the legend, and a footnote wedged between a figure and the legend
     that labels it separates the two. */
  const figure = document.querySelector("#widget .w-figure");
  const stage = figure && figure.parentNode;
  if (!stage) return;
  noteHost = document.createElement("div");
  noteHost.className = "w-math";
  noteHost.innerHTML = UNKNOWN_BATCH;
  stage.appendChild(noteHost);
}

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
    + row("The method", stepBody, stepNote);
}

defineWidget({
  slug: "batch-correction",
  title: "Correcting a Batch Effect",
  subtitle:
    "Taking the batch out of the data and putting it in the model are different "
    + "acts. On a confounded design the one that makes the picture look best is "
    + "the one that gets the answer wrong.",
  layout: "side",
  status: "draft",
  height: FIG_H,

  params: {
    data: { type: "section", label: "The study" },

    overlap: {
      type: "choice",
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

    /* Display, not data: all four are computed together and the picker chooses
       which to show, which is also what lets the change ease rather than jump.
       Opens on `none` — the reader builds the answer (2.1). */
    correct: {
      type: "segmented",
      style: "grid",
      label: "Method",
      /* Four options, so the grid is a plain 2 x 2 and nothing spans. The
         lesson's own sequence: do nothing, look at the truth, take the batch
         out of the data, or put it in the model. */
      options: [
        { value: "none", label: "None",
          detail: "the batch shift is still in the data" },
        { value: "known", label: "Ground truth",
          detail: "the same samples without the batch shift — page 1's toggle, and something only a simulation can show you" },
        { value: "remove", label: "Remove from data",
          detail: "estimate each batch's own mean and subtract it — ComBat with mod = NULL, which is what the lesson runs" },
        { value: "covariate", label: "Batch as covariate",
          detail: "leave the data alone and estimate the condition effect from y ~ condition + batch" },
      ],
      default: "none",
      display: true,
    },
  },

  legend: [
    { token: "group-a", label: "Healthy", mark: "dot" },
    { token: "group-b", label: "Disease", mark: "dot" },
    { token: "reference", label: "The true effect, 0.80", mark: "dash" },
  ],

  compute: ({ params }) => {
    const sim = simulate({
      seed: params.seed,
      overlap: overlapOf(params.overlap),
      batchShift: shiftOf(params.shift),
    });
    const { points, share } = projectAll(sim);

    /* Both tiles through the SAME fit. Taking the null-gene number off the
       matrix instead reported 1.49 for `covariate` — the raw difference, on a
       matrix that method never edits — where its own model says 0.09. */
    const nulls = {};
    const est = {};
    for (const key of Object.keys(CORRECTIONS)) {
      nulls[key] = nullWithSE(sim, key);
      est[key] = estimateWithSE(sim, key);
    }

    /* ONE FRAME FOR EVERY METHOD. Fitted per method the cloud would refill the
       panel each time and the collapse — 20.4 units wide down to 6.7 at the
       notebook's own settings — would be invisible (2.5). */
    const flat = Object.values(points).flat();
    const frame = {
      x: padded(flat.map((q) => q[0])),
      y: padded(flat.map((q) => q[1])),
    };

    return { sim, points, share, frame, est, nulls, design: design(sim) };
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

    rebuild: (anim, { params, state }) => {
      if (params.correct === anim.key) return;
      anim.from = blend(anim, state);
      anim.key = params.correct;
      anim.t = 0;
      anim.easing = true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    drawFigure(ctx, colors, w, h, params, state, anim);
  },

  readout: ({ params, state }) => {
    const r = state.est[params.correct];
    /* The fit itself says whether the effect exists: `ols` returns null on a
       singular design and the estimate comes back NaN. */
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
        value: blank ? "—" : zeroed(state.nulls[params.correct].beta),
        note: `${GENES - AFFECTED} of ${GENES} genes; the honest answer is 0`,
      },
      {
        label: "Separation by batch",
        value: fmt(separation(
          state.points[params.correct].map((p) => p[0]),
          state.sim.batch.map((b) => b === 1),
        ), 2),
        note: "in the picture, along PC1 — zero is not the same as correct",
      },
    ];
  },

  table: ({ state }) => ({
    columns: ["Method", "Estimated effect", "95% interval", "Separation by batch"],
    rows: Object.keys(CORRECTIONS).map((k) => {
      const r = state.est[k];
      const sep = fmt(separation(
        state.points[k].map((p) => p[0]),
        state.sim.batch.map((b) => b === 1),
      ), 3);
      if (!Number.isFinite(r.beta)) return [SHORT[k], "not estimable", "—", sep];
      return [SHORT[k], zeroed(r.beta, 3), `${zeroed(r.lo, 3)} to ${zeroed(r.hi, 3)}`, sep];
    }),
  }),
});

/* --- helpers -------------------------------------------------------------- *
 * Every one is a `function` declaration: `draw` runs synchronously while this
 * module is still evaluating, so a const arrow down here is in its temporal
 * dead zone and throws on every render. Three widgets have shipped that bug. */

function drawFigure(ctx, colors, w, h, params, state, anim) {
  renderCard(params, state.sim.shift);
  renderNote();
  const pts = blend(anim, state);
  const { frame, share } = state;

  const top = 26;
  const tableW = 168;
  const gap = 24;
  const axisPad = 34;
  const rightPad = 14;
  const panelX = tableW + gap + axisPad;
  const panelW = w - panelX - rightPad;
  const panelH = 168;

  /* --- the design, as a 2 x 2 ----------------------------------------- *
   * The counts and the correlation only. Page 1 says what they MEAN, at
   * length; repeating that here would teach the same thing twice and cost the
   * height the intervals need. */
  drawDesign(ctx, colors, 0, top, state.design);

  const plot = makePlot({
    ctx,
    colors,
    rect: { x: panelX, y: top, w: panelW, h: panelH },
    xDomain: frame.x,
    yDomain: frame.y,
  });
  plot.grid(ticksOf(frame.y));
  plot.axisY({ ticks: ticksOf(frame.y), format: axisFmt });
  plot.axisX({
    ticks: ticksOf(frame.x),
    format: axisFmt,
    label: `PC1 of the uncorrected data · ${(share[0] * 100).toFixed(0)}% of its variance`,
  });
  plot.caption("Samples, coloured by condition");
  /* `covariate` never edits the matrix, so its panel is the uncorrected one.
     Said on the figure, because a reader who has just pressed a button will
     otherwise read an unchanged picture as a bug. */
  if (params.correct === "covariate") plot.note("the data is unchanged");

  ctx.save();
  for (let j = 0; j < pts.length; j += 1) {
    ctx.fillStyle = state.sim.disease[j] ? colors.groupB : colors.groupA;
    ctx.beginPath();
    ctx.arc(plot.sx(pts[j][0]), plot.sy(pts[j][1]), 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawForest(ctx, colors, 0, top + panelH + 76, w, state, params);
}

/** The points as they are right now: the eased blend. */
function blend(anim, state) {
  const target = state.points[anim?.key ?? "none"];
  if (!anim || anim.t >= 1 || !anim.from) return target;
  const k = easeInOut(anim.t);
  return target.map((p, j) => [
    lerp(anim.from[j][0], p[0], k),
    lerp(anim.from[j][1], p[1], k),
  ]);
}

/* A correction that removes exactly as much as it should lands on -1e-16, and
   `fmt` renders that as "-0.00". Zero has no sign. */
function zeroed(v, d = 2) {
  return fmt(Math.abs(v) < 5 * 10 ** -(d + 1) ? 0 : v, d);
}

function padded(vals) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const m = (hi - lo) * 0.08 || 1;
  return [lo - m, hi + m];
}

function axisFmt(v) {
  return Math.abs(v) < 0.5 ? "0" : v.toFixed(0);
}

function ticksOf([lo, hi]) {
  return [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
}

/** The phi coefficient — the correlation between two binary variables, which
    is exactly what the confounding dial moves. Page 1 explains it. */
function phiOf(cells) {
  const [[a, b], [c, d]] = cells;
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den ? (a * d - b * c) / den : NaN;
}

function drawDesign(ctx, colors, x, y, d) {
  const cw = 52;
  const rh = 22;
  const gx = x + 50;
  const gy = y + 20;

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("The design", x, y - 6);

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Healthy", gx + cw * 0.5, gy - 9);
  ctx.fillText("Disease", gx + cw * 1.5, gy - 9);
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
      ctx.fillStyle = v === 0 ? colors.extreme : colors.ink1;
      ctx.font = `${v === 0 ? "600 " : ""}${colors.fsSm} ${colors.font}`;
      ctx.fillText(String(v), gx + cw * (c + 0.5), gy + rh * (r + 0.5));
    }
  }

  const phi = phiOf(d.cells);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Batch and condition correlate", x, gy + rh * 2 + 12);
  ctx.font = `${colors.fsFig} ${colors.font}`;
  ctx.fillStyle = Math.abs(phi) >= 1 ? colors.extreme : colors.ink1;
  ctx.fillText(phi.toFixed(2), x, gy + rh * 2 + 26);
  ctx.restore();
}

/**
 * Every method's estimate WITH its 95% interval, as a forest plot.
 *
 * All four at once rather than the chosen one, because the comparison IS the
 * teaching and it cannot be made one click at a time. `remove` takes the batch
 * out of the DATA and the comparison that follows has no idea a correction
 * happened, so it stays NARROW while the estimate walks to zero. `covariate`
 * spends the same information inside the model, so it WIDENS instead.
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

  /* Zero and the truth, drawn before the marks so no interval hides them. An
     interval crossing zero means this study cannot tell you the gene responds
     at all. */
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
