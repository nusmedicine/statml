/* ============================================================================
   Batch Effects — widget 40. DRAFT.

   PHM5003 HTD `05 / 05`, cells 3–22, in one page with a gate. The
   misconception: that a batch effect is noise you subtract.

   The full design record is in `docs/catalogue.md` § Slot 3.

   ---------------------------------------------------------------------------
   ONE WIDGET, NOT TWO, and the reason is the ground-truth panel. It was split
   into `batch-effect` and `batch-correction` for a day; with ground truth
   PERMANENTLY on the left, page 1's figure IS page 2's figure minus the
   estimates, so the correction stage serves the same picture rather than
   replacing it — which is what 3.4b's gate is for. The split also declared
   `overlap`, `shift` and `seed` twice, so a reader set the study up once to see
   the effect and again to see what correcting it costs.

   ---------------------------------------------------------------------------
   THE STAGE IS THE LESSON'S OWN, plus one control it does not have. Cell 3
   builds 50 genes x 40 samples, an effect of 0.8 on genes 1-25 of the diseased
   samples, and a +2 shift on samples 21-40. Condition alternates while batch
   splits at sample 20, so every batch holds 10 healthy and 10 diseased — the
   design is balanced, and the lesson never says so.

   BALANCED IS NOT "NO BATCH EFFECT", and the control used to say it was. Two
   dials do two jobs: the batch shift decides whether an artefact exists at
   all, the confounding decides whether it can be told apart from the biology.

   ---------------------------------------------------------------------------
   FIVE METHODS, FOUR DIFFERENT FAILURES. Estimated disease effect, truth 0.80,
   mean of 5 seeds — `_lab/batch-methods.mjs` prints it from this same engine:

       confounding    none   ComBat   ComBat+mod    SVA     RUV
        balanced      0.825   0.819      0.825     0.825   0.794
        half          1.808   0.633      1.131     1.808   0.838
        strong        2.219   0.495      1.599     2.219   0.941
        complete      2.771   0.122      2.771     2.771   2.803

   ComBat with `mod = NULL`, which is what cell 12 runs, deletes the biology.
   ComBat with `mod = ~condition` protects the biology and the confounded part
   of the batch with it. They fail in OPPOSITE directions.

   SVA NEVER MOVES THE ESTIMATE, at any setting. Its surrogate variable is built
   from the residuals after the condition is removed, so it is orthogonal to the
   condition by construction. What it moves is the standard error — 0.450 to
   0.316 at a balanced design, real power, and 0.315 against the true batch
   covariate's 0.446 at strong confounding: a TIGHTER interval around a wrong
   answer. That is why the intervals are on screen and not just the points.

   RUV holds, because its factor comes from control genes that carry the batch
   and nothing else — correlation with the true batch 0.982 at every setting,
   where SVA's falls 0.991 / 0.856 / 0.701 / 0.000. And it holds only as far as
   the controls are right: 0.838 for the lesson's genes 26-50, -0.003 for genes
   that all carry the effect, 0.467 for 25 at random. The control set is a
   parameter, so the assumption is the thing a reader can break.

   ---------------------------------------------------------------------------
   THE PANEL AND THE ESTIMATE ARE DIFFERENT QUESTIONS, and RUV is where that
   stops being an abstraction. Its W cleans the data for cell 22's PCA and goes
   into the model for cell 19's fit. At strong confounding the cleaned picture
   separates the conditions by 1.23 while the fit that used the same W returns
   0.94 against a truth of 0.80. Same W; only where you put it differs.

   NO DRIVE BUTTONS (4.5). The one motion is the ease between states.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  simulate, METHODS, CONTROL_SETS, applyMethod, withoutBatch, projectOnto,
  estimateWithSE, nullWithSE, design, separation, alignment, estimatedVariable,
  TRUE_EFFECT, AFFECTED, GENES, SAMPLES,
} from "./model.js";

const EASE_MS = 600;
/* Both measured rather than guessed. Shut, the figure ends with the shared axis
   label at 327. Open, the forest's five rows put its tick row at 497, and 486
   clipped every open state — the same 2px-and-you-do-not-see-it defect the
   sweep has now caught three times. */
const SHUT_H = 336;
const OPEN_H = 504;
const CARD_EM = "13.8em";

const METHOD_KEYS = Object.keys(METHODS);

/* The design ladder. A magnitude — how far batch and condition line up — with
   the notebook's own balanced design at the left end. The right end is the only
   setting where nothing can separate them, kept because that boundary is the
   argument's conclusion (2.6). */
const OVERLAPS = [
  { value: "0", amount: 0, label: "balanced",
    detail: "10 healthy and 10 diseased in each batch — the notebook's design" },
  { value: "0.25", amount: 0.25, label: "slight", detail: "12 and 8, against 8 and 12" },
  { value: "0.5", amount: 0.5, label: "half", detail: "15 and 5, against 5 and 15" },
  { value: "0.75", amount: 0.75, label: "strong", detail: "17 and 3, against 3 and 17" },
  { value: "1", amount: 1, label: "complete",
    detail: "one batch entirely healthy, the other entirely diseased — batch and condition are now the same variable" },
];

/* The batch shift, against a disease effect of 0.8. The crossover where the
   batch takes PC1 from the condition is measured near 1.0, not the notebook's
   2 — separations of 3.53 against 0.97 there, and 1.43 against 2.16 at 0.5. */
const SHIFTS = [
  { value: "0", amount: 0, label: "none", detail: "no batch effect at all — nothing to correct" },
  { value: "0.5", amount: 0.5, label: "0.5", detail: "smaller than the disease effect" },
  { value: "1", amount: 1, label: "1.0", detail: "about the crossover: the batch takes PC1 from the condition" },
  { value: "2", amount: 2, label: "2.0", detail: "the notebook's setting — 2.5x the disease effect" },
  { value: "4", amount: 4, label: "4.0", detail: "the batch dominates completely" },
];

/* What each method's row in the forest is called, and what its panel is. Module
   scope, not beside the loops that read them: `draw` runs while this file is
   still evaluating, and a const in its temporal dead zone has thrown three
   times in this collection. */
const METHOD_DETAIL = {
  none: "the batch shift is still in the data",
  combat: "ComBat(dat, batch, mod = NULL) — what cell 12 runs",
  combatMod: "ComBat with mod = ~condition — cell 11's “optional but recommended”",
  sva: "estimate a stand-in for the batch from the data, without ever being told it",
  ruv: "estimate it from control genes assumed to carry no biology",
};

const overlapOf = (k) => OVERLAPS.find((o) => o.value === k)?.amount ?? 0;
const shiftOf = (k) => SHIFTS.find((s) => s.value === k)?.amount ?? 2;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/* ---- the formula card, shown only once the gate is open ------------------
   Cell 10's model, and the key row is not decoration: this is a regression PER
   GENE with the expression as the RESPONSE and the condition as the predictor,
   the opposite direction from "predict disease from genes". The lesson swaps
   its own letters four cells later — cells 14 and 19 write
   `Y = X beta + W gamma + eps` with Y the expression matrix and X the design. */
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
  none: { math: null, plain: "nothing is removed; the batch term is still in every measurement" },
  combat: {
    math: `<math><mrow><msup>${SUB2("X")}<mo>&#x2032;</mo></msup><mo>=</mo>`
      + `${SUB2("X")}<mo>&#x2212;</mo><msub>${HAT("&#x3B3;")}<mi>k</mi></msub></mrow></math>`,
    plain: "X'(i,j) = X(i,j) − g-hat(k)",
    note: "γ̂ shrunk toward the batch's own average, with β left out of the model",
  },
  combatMod: {
    math: `<math><mrow><msup>${SUB2("X")}<mo>&#x2032;</mo></msup><mo>=</mo>`
      + `${SUB2("X")}<mo>&#x2212;</mo><msub>${HAT("&#x3B3;")}<mi>k</mi></msub></mrow></math>`,
    plain: "X'(i,j) = X(i,j) − g-hat(k)",
    note: "the same, with β kept in the model so the condition survives the standardising",
  },
  sva: {
    math: `<math><mrow>${SUB2("X")}<mo>=</mo>${SUB("&#x3B1;", "i")}<mo>+</mo>`
      + `${SUB("&#x3B2;", "i")}${SUB("Y", "j")}<mo>+</mo>${SUB("&#x3BB;", "i")}`
      + `${SUB("W", "j")}<mo>+</mo>${SUB2("&#x3B5;")}</mrow></math>`,
    plain: "X(i,j) = a(i) + b(i)·Y(j) + l(i)·W(j) + e(i,j)",
    note: "W estimated from the residuals, never from the batch label — X is not touched",
  },
  ruv: {
    math: `<math><mrow>${SUB2("X")}<mo>=</mo>${SUB("&#x3B1;", "i")}<mo>+</mo>`
      + `${SUB("&#x3B2;", "i")}${SUB("Y", "j")}<mo>+</mo>${SUB("&#x3BB;", "i")}`
      + `${SUB("W", "j")}<mo>+</mo>${SUB2("&#x3B5;")}</mrow></math>`,
    plain: "X(i,j) = a(i) + b(i)·Y(j) + l(i)·W(j) + e(i,j)",
    note: "W estimated from the control genes; it cleans the picture and goes in the model",
  },
};

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

defineWidget({
  slug: "batch-effect",
  title: "Batch Effects",
  subtitle:
    "Samples processed in different batches carry a systematic difference that "
    + "has nothing to do with the biology. Correcting it is not subtraction: on a "
    + "confounded design every method fails, and they fail differently.",
  layout: "side",
  status: "draft",
  /* Core calls this with the VALUES object spread, plus `w` — not `{ params }`.
     The gate gives its pixels back when it is shut (3.4b): the forest is 150px
     that mean nothing until a method is chosen. */
  height: ({ correcting }) => (correcting ? OPEN_H : SHUT_H),

  params: {
    data: { type: "section", label: "The study" },

    overlap: {
      type: "choice",
      /* NOT "overlap": `none` under a label naming batch and condition reads as
         "no batch effect", and it is a different dial. */
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

    /* THE SECOND STAGE (3.4b). Shut, the widget asks what a batch effect does;
       open, what happens when you try to take it out. Ground truth stays on the
       left either way, so the gate adds rather than replaces. */
    correcting: {
      type: "gate",
      label: "Try to correct it",
      labelOff: "Hide the corrections",
      detail: "the lesson's five methods, and what each one costs",
      default: false,
      display: true,
    },

    method: {
      type: "segmented",
      style: "grid",
      label: "Method",
      options: METHOD_KEYS.map((k) => ({
        value: k, label: METHODS[k].label, detail: METHOD_DETAIL[k],
        ...(k === "none" ? { span: true } : {}),
      })),
      default: "none",
      display: true,
      when: { param: "correcting" },
    },

    /* RUV's assumption, made into a control. Measured at overlap 0.5, truth
       0.80: 0.838 / -0.003 / 0.467. */
    controls: {
      type: "segmented",
      label: "Control genes",
      options: Object.keys(CONTROL_SETS).map((k) => ({
        value: k, label: CONTROL_SETS[k].label, detail: CONTROL_SETS[k].detail,
      })),
      default: "nulls",
      display: true,
      when: { all: [{ param: "correcting" }, { param: "method", equals: "ruv" }] },
    },
  },

  legend: ({ params }) => (params.correcting
    ? [
      { token: "group-a", label: "Healthy", mark: "dot" },
      { token: "group-b", label: "Disease", mark: "dot" },
      { token: "reference", label: "The true effect, 0.80", mark: "dash" },
    ]
    : [
      { token: "group-a", label: "Healthy", mark: "dot" },
      { token: "group-b", label: "Disease", mark: "dot" },
    ]),

  compute: ({ params }) => {
    const sim = simulate({
      seed: params.seed,
      overlap: overlapOf(params.overlap),
      batchShift: shiftOf(params.shift),
    });
    const opts = { controls: params.controls };

    /* Ground truth, the observed data, and what every method leaves behind —
       all on ONE basis, the observed data's, so a change moves the points and
       never the axes. */
    const mats = { truth: withoutBatch(sim), observed: sim.X };
    for (const k of METHOD_KEYS) mats[k] = applyMethod(sim, k, opts);
    const { points, share } = projectOnto(sim, mats);

    const est = {};
    const nulls = {};
    for (const k of METHOD_KEYS) {
      est[k] = estimateWithSE(sim, k, opts);
      nulls[k] = nullWithSE(sim, k, opts);
    }

    /* ONE FRAME for every state, so the collapse is visible rather than
       rescaled away (2.5). */
    const flat = Object.values(points).flat();
    const frame = {
      x: padded(flat.map((q) => q[0])),
      y: padded(flat.map((q) => q[1])),
    };

    /* What SVA and RUV actually found, against the batch nobody told them. */
    const isB2 = sim.batch.map((b) => b === 1);
    const found = {};
    for (const k of ["sva", "ruv"]) {
      const v = estimatedVariable(sim, k, opts);
      found[k] = v ? alignment(v, isB2) : NaN;
    }

    return { sim, points, share, frame, est, nulls, found, design: design(sim) };
  },

  animation: {
    stepLabel: null,
    runLabel: null,

    init: ({ params, state }) => ({
      key: shownKey(params),
      t: 1,
      from: state.points[shownKey(params)],
    }),

    advance: (anim, { dt }) => {
      if (anim.t >= 1) return false;
      anim.t = Math.min(1, anim.t + dt / EASE_MS);
      return anim.t < 1;
    },

    /* `rebuild` runs for every display change, so the guard matters: without it
       any other display parameter would restart the ease from wherever the
       points had got to. */
    rebuild: (anim, { params, state }) => {
      const key = shownKey(params);
      if (key === anim.key) return;
      anim.from = blend(anim, state);
      anim.key = key;
      anim.t = 0;
      anim.easing = true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    renderCard(params, state.sim.shift);
    const pts = blend(anim, state);
    const { frame, share } = state;

    const top = 26;
    const panelH = 168;
    const axisPad = 40;
    const gap = 26;
    /* The right panel's last tick label is CENTRED on its right edge, so
       without this it overhangs the canvas by half its width. */
    const rightPad = 14;
    const panelW = (w - axisPad - gap - rightPad) / 2;
    const panelTop = 118;

    drawDesign(ctx, colors, 0, top, w, state.design);

    /* GROUND TRUTH IS ALWAYS ON THE LEFT. It is the signal the study is trying
       to recover, and every other panel is judged against it — a benchmark
       nobody can compute from real data, which is why it is a panel and not a
       method (Kenneth, 2026-09-02). */
    const panels = [
      { pts: state.points.truth, title: "Ground truth", note: "no batch shift at all" },
      { pts, title: panelTitle(params), note: panelNote(params) },
    ];

    panels.forEach((panel, i) => {
      const plot = makePlot({
        ctx,
        colors,
        rect: { x: axisPad + i * (panelW + gap), y: panelTop, w: panelW, h: panelH },
        xDomain: frame.x,
        yDomain: frame.y,
      });
      plot.grid(ticksOf(frame.y));
      if (i === 0) plot.axisY({ ticks: ticksOf(frame.y), format: axisFmt });
      plot.axisX({ ticks: ticksOf(frame.x), format: axisFmt });
      plot.caption(panel.title);
      if (panel.note) plot.note(panel.note);

      ctx.save();
      for (let j = 0; j < panel.pts.length; j += 1) {
        ctx.fillStyle = state.sim.disease[j] ? colors.groupB : colors.groupA;
        ctx.beginPath();
        ctx.arc(plot.sx(panel.pts[j][0]), plot.sy(panel.pts[j][1]), 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (params.correcting) drawForest(ctx, colors, 0, panelTop + panelH + 76, w, state, params);

    /* PAINTED LAST, DELIBERATELY. A text sweep proves `draw` finished by looking
       for the last string it paints, so the bottom-most label is the one to end
       on. Adding anything after this silently moves the terminator, and 50
       states once came back as "did not finish" because of it. */
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `PC1 of the observed data · ${(share[0] * 100).toFixed(0)}% of its variance`,
      axisPad + (2 * panelW + gap) / 2, panelTop + panelH + 28,
    );
    ctx.restore();
  },

  readout: ({ params, state }) => {
    const shownXs = state.points[shownKey(params)].map((p) => p[0]);
    const byBatch = state.sim.batch.map((b) => b === 1);

    if (!params.correcting) {
      return [
        {
          label: "Separation by batch",
          value: fmt(separation(shownXs, byBatch), 2),
          note: "group means along PC1, in pooled sd",
        },
        {
          label: "Separation by condition",
          value: fmt(separation(shownXs, state.sim.disease), 2),
          note: `ground truth reaches ${fmt(separation(
            state.points.truth.map((p) => p[0]), state.sim.disease), 2)}`,
        },
        {
          label: "PC1's share of the variance",
          value: `${(state.share[0] * 100).toFixed(0)}%`,
          note: "of the observed data, whose axes every panel uses",
        },
      ];
    }

    const r = state.est[params.method];
    /* The fit itself says whether the effect exists: a singular design returns
       null from the solve and the estimate comes back NaN. */
    const blank = !Number.isFinite(r.beta);
    const found = state.found[params.method];
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
        value: blank ? "—" : zeroed(state.nulls[params.method].beta),
        note: `${GENES - AFFECTED} of ${GENES} genes; the honest answer is 0`,
      },
      Number.isFinite(found)
        ? {
          label: "What it found, against the batch",
          value: fmt(found, 2),
          note: "|correlation| with the batch label it was never given",
        }
        : {
          label: "Separation by batch",
          value: fmt(separation(shownXs, byBatch), 2),
          note: "in the picture, along PC1 — zero is not the same as correct",
        },
    ];
  },

  table: ({ state }) => ({
    columns: ["Method", "Estimated effect", "95% interval", "Genes with no effect"],
    rows: METHOD_KEYS.map((k) => {
      const r = state.est[k];
      if (!Number.isFinite(r.beta)) return [METHODS[k].label, "not estimable", "—", "—"];
      return [
        METHODS[k].label,
        zeroed(r.beta, 3),
        `${zeroed(r.lo, 3)} to ${zeroed(r.hi, 3)}`,
        zeroed(state.nulls[k].beta, 3),
      ];
    }),
  }),
});

/* --- helpers -------------------------------------------------------------- *
 * Every one is a `function` declaration: `draw` runs synchronously while this
 * module is still evaluating, so a const arrow here is in its temporal dead
 * zone and throws on every render. Three widgets have shipped that bug. */

/** Which of the computed point sets the right panel is showing. */
function shownKey(params) {
  return params.correcting ? params.method : "observed";
}

function panelTitle(params) {
  if (!params.correcting) return "Observed";
  return params.method === "none" ? "Observed" : METHODS[params.method].label;
}

/**
 * SVA never edits the matrix, so its panel is the observed one — said on the
 * figure, because a reader who has just pressed a button will otherwise read an
 * unchanged picture as a bug.
 */
function panelNote(params) {
  if (!params.correcting) return "with the batch shift in it";
  if (params.method === "sva") return "the data is unchanged";
  if (params.method === "none") return "with the batch shift in it";
  return "after correction";
}

function blend(anim, state) {
  const target = state.points[anim?.key ?? "observed"];
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

/* A tick at -1e-9 renders as "-0" through toFixed. Zero has no sign. */
function axisFmt(v) {
  return Math.abs(v) < 0.5 ? "0" : v.toFixed(0);
}

function ticksOf([lo, hi]) {
  return [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
}

/** The phi coefficient — the correlation between two binary variables, which is
    exactly what the confounding dial moves: 0.00 / 0.20 / 0.50 / 0.70 / 1.00. */
function phiOf(cells) {
  const [[a, b], [c, d]] = cells;
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den ? (a * d - b * c) / den : NaN;
}

/** What the four counts MEAN, computed from them rather than written per rung. */
function describe(cells) {
  const [[b1h, b1d]] = cells;
  const lean = b1h >= b1d ? ["healthy", "diseased"] : ["diseased", "healthy"];
  const phi = Math.abs(phiOf(cells));
  if (phi === 0) {
    return "Each batch holds the same mix of healthy and diseased samples. A "
      + "difference between the batches cannot come from the biology, so whatever "
      + "you see between them is the batch.";
  }
  if (phi >= 1) {
    return `Batch 1 is entirely ${lean[0]} and batch 2 entirely ${lean[1]}. Batch `
      + "and condition are one variable, and nothing you can measure separates them.";
  }
  if (phi < 0.5) {
    return `Batch 1 leans ${lean[0]} and batch 2 leans ${lean[1]}. Most of a `
      + "difference between the batches is still the batch, but no longer all of it.";
  }
  return `Batch 1 is mostly ${lean[0]} and batch 2 mostly ${lean[1]}. A difference `
    + "between the batches is now part batch and part biology, and the data does not "
    + "say which part is which.";
}

/** Greedy wrap against the ctx's current font. */
function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The design block: the 2 x 2, the correlation it implies, and the reading. */
function drawDesign(ctx, colors, x, y, w, d) {
  const cw = 58;
  const rh = 22;
  const gx = x + 52;
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
      /* The empty cell is the cause and the correlation is the consequence, so
         it is marked rather than left to be counted. */
      ctx.fillStyle = v === 0 ? colors.extreme : colors.ink1;
      ctx.font = `${v === 0 ? "600 " : ""}${colors.fsSm} ${colors.font}`;
      ctx.fillText(String(v), gx + cw * (c + 0.5), gy + rh * (r + 0.5));
    }
  }

  const tx = gx + cw * 2 + 22;
  const tw = Math.max(120, x + w - tx);
  const phi = phiOf(d.cells);

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Batch and condition correlate", tx, y - 12);

  ctx.font = `${colors.fsFig} ${colors.font}`;
  ctx.fillStyle = Math.abs(phi) >= 1 ? colors.extreme : colors.ink1;
  ctx.fillText(phi.toFixed(2), tx, y + 2);

  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  wrapText(ctx, describe(d.cells), tw).forEach((line, i) => {
    ctx.fillText(line, tx, y + 26 + i * 14);
  });
  ctx.restore();
}

/**
 * Every method's estimate WITH its 95% interval, as a forest plot.
 *
 * All five at once rather than the chosen one, because the comparison IS the
 * teaching and cannot be made one click at a time. SVA in particular reads as
 * inert on a point estimate — its row sits exactly on None's — and only the
 * interval shows what it did.
 */
function drawForest(ctx, colors, x, y, w, state, params) {
  const LAB = 104;
  /* A COLUMN FOR THE VALUES, on the right, the way a published forest plot sets
     one. Putting each number beside its own interval end works until an
     interval fills the axis: then there is no room on the right, the fallback
     puts it on the left, and it lands on the row's name. A fixed column cannot
     collide and cannot run off. */
  const VAL = 46;
  const x0 = x + LAB;
  const x1 = x + w - VAL;
  /* A FIXED DOMAIN, for the reason 2.5 records: an axis refitted per state puts
     0.79 at a balanced design and 2.23 at a confounded one in the same place.

     -1 TO 6 DOES NOT COVER EVERYTHING, and that is deliberate. Measured over
     every state at seeds 1..200 step 17 the interval ends reach -9.16 and
     13.96, both in the same corner: complete confounding at batch shift 4,
     where RUV's W is collinear with the condition and the fit comes apart. A
     domain wide enough for that would squeeze the whole readable range into a
     sliver. So the ends are CLIPPED and marked with a caret, which is what a
     forest plot does. */
  const LO = -1;
  const HI = 6;
  const clamp = (v) => Math.min(HI, Math.max(LO, v));
  const SX = (v) => x0 + ((clamp(v) - LO) / (HI - LO)) * (x1 - x0);

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Estimated disease effect, per gene", x, y - 8);

  const rowH = 19;
  const firstRow = y + 20;
  const axis = firstRow + METHOD_KEYS.length * rowH + 2;

  /* Zero and the truth, before the marks so no interval hides them. An interval
     crossing zero means this study cannot tell you the gene responds at all. */
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

  METHOD_KEYS.forEach((key, i) => {
    const cy = firstRow + i * rowH + rowH / 2;
    const on = key === params.method;
    const r = state.est[key];

    ctx.font = `${on ? "600 " : ""}${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = on ? colors.ink1 : colors.ink2;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(METHODS[key].label, x + LAB - 10, cy);

    if (!Number.isFinite(r.beta)) {
      ctx.textAlign = "left";
      ctx.fillStyle = colors.extreme;
      ctx.fillText("not estimable — batch and condition are one variable", x0 + 2, cy);
      ctx.textAlign = "right";
      ctx.fillText("—", x + w - 4, cy);
      return;
    }

    /* 0.4 on the unchosen rows put them below reading at a projection, and the
       whole reason all five are drawn is that they be compared. */
    ctx.globalAlpha = on ? 1 : 0.72;
    ctx.strokeStyle = on ? colors.highlight : colors.ink2;
    ctx.lineWidth = on ? 2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(SX(r.lo), cy);
    ctx.lineTo(SX(r.hi), cy);
    ctx.stroke();
    if (r.lo < LO) caret(ctx, SX(LO), cy, -1);
    if (r.hi > HI) caret(ctx, SX(HI), cy, 1);

    ctx.fillStyle = on ? colors.highlight : colors.ink2;
    ctx.beginPath();
    ctx.arc(SX(r.beta), cy, on ? 4 : 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = on ? colors.ink1 : colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(zeroed(r.beta), x + w - 4, cy);
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

/** A clipped interval end, drawn the way a forest plot draws one. */
function caret(ctx, x, y, dir) {
  ctx.beginPath();
  ctx.moveTo(x - dir * 5, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x - dir * 5, y + 4);
  ctx.stroke();
}

/** The formula card, present only while the gate is open. */
function renderCard(params, shift) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;

  if (!params.correcting) {
    if (cardHost) {
      cardHost.remove();
      cardHost = null;
      cardKey = null;
    }
    return;
  }

  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    cardHost.style.minHeight = CARD_EM;
    figure.parentNode.insertBefore(cardHost, figure);
    cardKey = null;
  }

  const key = `${params.method}|${shift}`;
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

  const step = STEP[params.method];
  const stepBody = MATHML && step.math
    ? step.math
    : `<span style="font-size:var(--fs-xs);color:var(--ink-3)">${step.plain}</span>`;

  cardHost.innerHTML =
    row("The model", MATHML ? MODEL.math : `<span style="font-size:var(--fs-xs)">${MODEL.plain}</span>`,
      `i = 1…${GENES} genes, j = 1…${SAMPLES} samples`)
    + KEY
    + row("The method", stepBody, step.note || "");
}
