/* ============================================================================
   Batch Effects — widget 40.

   PHM5003 HTD `05 / 05`. The misconception: that a batch effect is noise you
   subtract. Design record in `docs/catalogue.md` § Slot 3.

   ---------------------------------------------------------------------------
   ONE WIDGET WITH A GATE, not two pages. Ground truth is permanently the left
   panel, so the gate-shut figure is the gate-open figure minus the estimates:
   the correction stage adds to the same picture rather than replacing it
   (3.4b). Two pages also declared `overlap`, `shift` and `seed` twice.

   ---------------------------------------------------------------------------
   THE SIMULATION: 50 genes x 40 samples, a disease effect on genes 1-25 of the
   diseased samples, and a shift applied to samples 21-40. Condition alternates
   while batch splits at sample 20, so at `balanced` every batch holds 10
   healthy and 10 diseased.

   The confounding dial was labelled "Overlap", whose `none` setting reads as
   "no batch effect". It is a different quantity: the batch effect dial decides
   whether an artefact exists, the confounding dial decides whether it can be
   distinguished from the condition. At `balanced` with a shift of 2, PC1 still
   separates the batches by 7.80 pooled sd.

   ---------------------------------------------------------------------------
   FOUR METHODS, FIVE SETTINGS. Estimated disease effect, truth 0.80, mean of 5
   seeds; `_lab/batch-methods.mjs` prints this from the same engine:

       confounding    none   ComBat    ComBat     SVA     RUV
                            mod=NULL  mod=~cond
        balanced      0.825   0.819     0.825    0.825   0.794
        half          1.808   0.633     1.131    1.808   0.838
        strong        2.219   0.495     1.599    2.219   0.941
        complete      2.771   0.122     2.771    2.771   2.803

   `mod` is a sub-control rather than a second method: two picker entries both
   labelled ComBat is a poor picker, the copy table lists every method anyway,
   and four entries tile a 2 x 2. `mod = NULL` removes the disease effect along
   with the batch; `mod = ~condition` retains the disease effect and the
   confounded part of the batch with it. They diverge only from half
   confounding on — 0.01 and 0.14 apart at balanced and slight.

   SVA DOES NOT CHANGE THE ESTIMATE at any setting. Its surrogate variable is
   built from the residuals after the condition is removed, so it is orthogonal
   to the condition by construction. What it changes is the standard error:
   0.450 to 0.316 at a balanced design, and 0.315 against the true batch
   covariate's 0.446 at strong confounding — a narrower interval around a
   biased estimate. Hence the intervals are drawn and not only the points.

   ITS PANEL IS THE OBSERVED DATA, and the three panel notes differ because the
   three methods stand in three different relations to the picture: ComBat's
   panel is the matrix that then gets tested, RUV's is a picture while its W
   goes in the model, and SVA has no corrected matrix at all.

   That last one read as SVA FAILING — an unchanged scatter under a heading
   saying SVA, beside a visibly clean ground truth, at the very setting where
   the surrogate variable correlates 0.99 with the batch. The fix is not a
   corrected panel: `limma::removeBatchEffect(y, covariates = sv)` was built
   here and collapses the within-condition scatter 18x, reducing each condition
   group to a column about 0.06 wide: a separation by condition of 57.5,
   against ground truth's 3.2.
   model.js's `sva` entry carries that finding and the three controls that
   locate it. The fix is the note, which now sends the reader to the interval —
   the only quantity SVA alters, its point estimate being identical to None's.

   RUV holds because its factor comes from reference genes carrying the batch
   and not the condition: correlation with the batch 0.982 at every setting,
   where SVA's falls 0.991 / 0.856 / 0.701 / 0.000. It holds only as far as the
   references are right — 0.79-1.01 with housekeeping genes, 0.46-0.59 with a
   random set. Both sets recover the batch (0.982 against 0.977); the random
   set's factor also correlates 0.172 with the condition against housekeeping's
   0.019, so its correction removes disease effect with the batch.

   RUV also separates the panel from the estimate: its W both cleans the data
   for the scatter and enters the model for the fit. At strong confounding the
   cleaned picture separates the conditions by 1.23 while the fit using the same
   W returns 0.94 against a truth of 0.80.

   ---------------------------------------------------------------------------
   THE DISEASE EFFECT IS A DIAL because legibility of the corrected panel tracks
   the ratio batchShift/effect rather than either alone: effect 1.5 with shift 2
   puts the condition groups 41.8px apart in a 227px panel, and effect 3.0 with
   shift 4 puts them 42.0px apart. A ratio of 5 is 13px; a ratio of 2 is 30px.

   The true effect is therefore a parameter, and had been written literally as
   0.80 in three places — the legend, the readout's note and the forest's dashed
   rule. All three read `state.truth`.

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
const OPEN_H = 486;
const CARD_EM = "13.8em";

const METHOD_KEYS = Object.keys(METHODS);

/* How far batch and condition line up. The right end is the only setting where
   nothing can separate them, kept as the failing case (2.6). */
const OVERLAPS = [
  { value: "0", amount: 0, label: "balanced",
    detail: "10 healthy and 10 diseased in each batch" },
  { value: "0.25", amount: 0.25, label: "slight", detail: "12 and 8, against 8 and 12" },
  { value: "0.5", amount: 0.5, label: "half", detail: "15 and 5, against 5 and 15" },
  { value: "0.75", amount: 0.75, label: "strong", detail: "17 and 3, against 3 and 17" },
  { value: "1", amount: 1, label: "complete",
    detail: "one batch entirely healthy, the other entirely diseased — batch and condition are now the same variable" },
];

/* Measured against a disease effect of 0.8: the batch takes PC1 from the
   condition near a shift of 1.0 — separations of 3.53 against 0.97 there, and
   1.43 against 2.16 at 0.5. */
const SHIFTS = [
  { value: "0", amount: 0, label: "none", detail: "no batch effect" },
  { value: "0.5", amount: 0.5, label: "0.5", detail: "smaller than the disease effect" },
  { value: "1", amount: 1, label: "1.0", detail: "the batch and the disease effect contribute about equally to PC1" },
  { value: "2", amount: 2, label: "2.0", detail: "2.5x the default disease effect" },
  { value: "4", amount: 4, label: "4.0", detail: "the batch accounts for most of the variance" },
];

/* Module scope, not beside the loops that read them: `draw` runs while this
   file is still evaluating, and a const in its temporal dead zone has thrown
   three times in this collection. */
const METHOD_DETAIL = {
  none: "the batch effect is still in the data",
  combat: "empirical Bayes estimate of each batch's shift per gene, subtracted from the data",
  sva: "surrogate variables estimated from the residuals; the batch labels are not used",
  ruv: "unwanted variation estimated from reference genes assumed to be unaffected by the condition",
};

/* Legibility of the corrected panel tracks the ratio batchShift/effect, not
   either dial alone: effect 1.5 with shift 2 puts the condition groups 41.8px
   apart in a 227px panel, and effect 3.0 with shift 4 puts them 42.0px apart.
   A ratio of 5 is 13px; a ratio of 2 is 30px. */
const EFFECTS = [
  { value: "0", amount: 0, label: "none",
    detail: "no disease effect; any estimate away from zero is error" },
  { value: "0.8", amount: 0.8, label: "0.8", detail: "small against a batch effect of 2.0 or more" },
  { value: "1.5", amount: 1.5, label: "1.5", detail: "comparable to a batch effect of 1.0 or 2.0" },
  { value: "2", amount: 2, label: "2.0", detail: "half the largest batch effect" },
  { value: "3", amount: 3, label: "3.0", detail: "larger than every batch effect except 4.0" },
];

const overlapOf = (k) => OVERLAPS.find((o) => o.value === k)?.amount ?? 0;
const effectOf = (k) => EFFECTS.find((e) => e.value === k)?.amount ?? TRUE_EFFECT;
const shiftOf = (k) => SHIFTS.find((s) => s.value === k)?.amount ?? 2;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/* ---- the formula card, shown only once the gate is open ------------------
   The key row exists because this is a regression per gene with the expression
   as the RESPONSE and the condition as the predictor — the opposite direction
   from "predict disease from genes", which readers assume. The SVA and RUV
   formulations write `Y = X beta + W gamma + eps`, swapping both letters. */
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
    /* The note follows the sub-control: one calculation, two standardisings.
       A card reading "condition left out" while the rail says `mod = ~condition`
       would contradict its own settings. */
    noteFor: (mod) => (mod === "null"
      ? "γ̂ shrunk toward the batch mean; the condition is left out of the standardising"
      : "γ̂ shrunk toward the batch mean; the condition is kept in the standardising"),
  },
  sva: {
    math: `<math><mrow>${SUB2("X")}<mo>=</mo>${SUB("&#x3B1;", "i")}<mo>+</mo>`
      + `${SUB("&#x3B2;", "i")}${SUB("Y", "j")}<mo>+</mo>${SUB("&#x3BB;", "i")}`
      + `${SUB("W", "j")}<mo>+</mo>${SUB2("&#x3B5;")}</mrow></math>`,
    plain: "X(i,j) = a(i) + b(i)·Y(j) + l(i)·W(j) + e(i,j)",
    note: "W comes from the residuals, not the batch labels; it enters the model, and X is left as measured",
  },
  ruv: {
    math: `<math><mrow>${SUB2("X")}<mo>=</mo>${SUB("&#x3B1;", "i")}<mo>+</mo>`
      + `${SUB("&#x3B2;", "i")}${SUB("Y", "j")}<mo>+</mo>${SUB("&#x3BB;", "i")}`
      + `${SUB("W", "j")}<mo>+</mo>${SUB2("&#x3B5;")}</mrow></math>`,
    plain: "X(i,j) = a(i) + b(i)·Y(j) + l(i)·W(j) + e(i,j)",
    note: "W from the reference genes; in the model for the estimate, out of X for the panel — visualisation, not testing",
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
    "Samples processed in different batches differ systematically for "
    + "non-biological reasons. Batch correction estimates that variation, from "
    + "the data or from reference genes, and removes it.",
  layout: "side",

  /* Core calls this with the VALUES object spread, plus `w` — not `{ params }`.
     The gate gives its pixels back when it is shut (3.4b): the forest is 150px
     that mean nothing until a method is chosen. */
  height: ({ correcting }) => (correcting ? OPEN_H : SHUT_H),

  params: {
    data: { type: "section", label: "The study" },

    /* Signal, then artefact, then design. The two magnitudes are adjacent
       because their ratio governs the corrected panel's legibility; the design
       follows because it decides whether the two can be separated at all. */
    effect: {
      type: "choice",
      label: "Size of the disease effect",
      options: EFFECTS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "0.8",
    },

    shift: {
      type: "choice",
      label: "Size of the batch effect",
      options: SHIFTS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "2",
    },

    overlap: {
      type: "choice",
      /* NOT "overlap": `none` under a label naming batch and condition reads as
         "no batch effect", and it is a different dial. */
      label: "Batch–condition confounding",
      options: OVERLAPS.map(({ value, label, detail }) => ({ value, label, detail })),
      default: "0",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* With both panels coloured by condition there is no way to ask whether the
       samples separate by BATCH, which is the diagnostic. Both panels follow
       one toggle, so they are always asked the same question. */
    colourBy: {
      type: "segmented",
      label: "Colour the samples by",
      options: [
        { value: "condition", label: "Condition",
          detail: "healthy against disease — the comparison the study is for" },
        { value: "batch", label: "Batch",
          detail: "which run each sample was processed in" },
      ],
      default: "condition",
      display: true,
    },

    /* THE SECOND STAGE (3.4b). Shut, the widget asks what a batch effect does;
       open, what happens when you try to take it out. Ground truth stays on the
       left either way, so the gate adds rather than replaces. */
    correcting: {
      type: "gate",
      label: "Correct the batch effect",
      labelOff: "Hide the correction",
      detail: "ComBat, SVA and RUV, and what each one estimates",
      default: false,
      display: true,
    },

    method: {
      type: "segmented",
      style: "grid",
      label: "Method",
      /* Four entries tile a plain 2 x 2, so nothing spans. It was five with the
         two ComBats, and `None` had to span to make three fit. */
      options: METHOD_KEYS.map((k) => ({
        value: k, label: METHODS[k].label, detail: METHOD_DETAIL[k],
      })),
      default: "none",
      display: true,
      when: { param: "correcting" },
    },

    /* A sub-control rather than a second picker entry: two rows both labelled
       ComBat is a poor picker, and the copy table lists every method anyway.
       The default is the recommended setting. */
    mod: {
      type: "segmented",
      label: "ComBat model",
      options: [
        { value: "condition", label: "mod = ~condition",
          detail: "the condition is kept in the model, so standardising does not remove it — the recommended setting" },
        { value: "null", label: "mod = NULL",
          detail: "the condition is left out, so on a confounded design it is removed along with the batch" },
      ],
      default: "condition",
      display: true,
      when: { all: [{ param: "correcting" }, { param: "method", equals: "combat" }] },
    },

    /* RUV's assumption as a control. Measured at overlap 0.5, truth 0.80:
       housekeeping 0.838, random 0.467. */
    controls: {
      type: "segmented",
      label: "Reference genes",
      options: Object.keys(CONTROL_SETS).map((k) => ({
        value: k, label: CONTROL_SETS[k].label, detail: CONTROL_SETS[k].detail,
      })),
      default: "housekeeping",
      display: true,
      when: { all: [{ param: "correcting" }, { param: "method", equals: "ruv" }] },
    },
  },

  /* THE TRUTH IS A PARAMETER NOW, so every place that names it reads the same
     one: this label, the readout's note, and the forest's dashed rule. It was
     the literal 0.80 in all three, which is exactly how a figure comes to
     disagree with its own axis. */
  legend: ({ params }) => {
    /* The legend names what the colours ARE right now. A generic pair would
       survive both settings and say nothing. */
    const dots = params.colourBy === "batch"
      ? [
        { token: "group-a", label: "Batch 1", mark: "dot" },
        { token: "group-b", label: "Batch 2", mark: "dot" },
      ]
      : [
        { token: "group-a", label: "Healthy", mark: "dot" },
        { token: "group-b", label: "Disease", mark: "dot" },
      ];
    if (!params.correcting) return dots;
    return [...dots,
      { token: "reference", label: `The true effect, ${effectOf(params.effect).toFixed(2)}`, mark: "dash" }];
  },

  compute: ({ params }) => {
    const truth = effectOf(params.effect);
    const sim = simulate({
      seed: params.seed,
      overlap: overlapOf(params.overlap),
      batchShift: shiftOf(params.shift),
      effect: truth,
    });
    const opts = { controls: params.controls, mod: params.mod };

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

    return { sim, points, share, frame, est, nulls, found, truth, design: design(sim) };
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
       method. */
    const panels = [
      { pts: state.points.truth, title: "Ground truth", note: "no batch effect" },
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
      /* NO HORIZONTAL GRIDLINES, and a VERTICAL RULE ON BOTH PANELS. The two
         went together: `axisY` draws tick labels and no line — only `axisX`
         carries a rule — so two panels sharing one y domain, one row of
         gridlines and no vertical edge ran together as a single wide graph
         with a gap down the middle.

         The gridlines went because nothing here reads a value off them. The y
         axis is PC2 and every quantity the figure reports — both separations,
         the forest, the readouts — is measured along PC1. They spanned both
         panels at identical heights, which is what joined the two into one
         figure. The other 17 widgets that call `grid` mostly plot a count or a
         density against y, where a reader does read a value off the line.

         The rule closes each panel into an L with its own baseline, and carries
         no tick marks because `axisX` carries none either. The LABELS stay on
         the left panel alone: the domain is shared and frame.y is computed once
         across both, so a second column of identical numbers would imply two
         scales where there is one. Drawn here rather than added to `axisY` in
         core, which every other widget calls and none of them asked for. */
      const ruleX = Math.round(plot.x) + 0.5;
      ctx.save();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ruleX, plot.y);
      ctx.lineTo(ruleX, plot.bottom);
      ctx.stroke();
      ctx.restore();
      if (i === 0) plot.axisY({ ticks: ticksOf(frame.y), format: axisFmt });
      plot.axisX({ ticks: ticksOf(frame.x), format: axisFmt });
      plot.caption(panel.title);
      if (panel.note) plot.note(panel.note);

      const byBatch = params.colourBy === "batch";
      ctx.save();
      for (let j = 0; j < panel.pts.length; j += 1) {
        const second = byBatch ? state.sim.batch[j] === 1 : state.sim.disease[j];
        ctx.fillStyle = second ? colors.groupB : colors.groupA;
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
          : `95% interval ${zeroed(r.lo)} to ${zeroed(r.hi)}, against a truth of ${state.truth.toFixed(2)}`,
      },
      {
        label: "Genes with no effect",
        value: blank ? "—" : zeroed(state.nulls[params.method].beta),
        note: `${GENES - AFFECTED} of ${GENES} genes; the true value is 0`,
      },
      Number.isFinite(found)
        ? {
          label: "Correlation with the batch",
          value: fmt(found, 2),
          note: "|correlation| between the estimated variable and the batch label",
        }
        : {
          label: "Separation by batch",
          value: fmt(separation(shownXs, byBatch), 2),
          note: "in the corrected data, along PC1, in pooled sd",
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
 * THREE NOTES, because the three corrections stand in three different relations
 * to the picture, and the formula card cannot say so — it gives SVA and RUV the
 * identical equation.
 *
 *   ComBat  the panel IS the matrix that is then tested  -> "after correction"
 *   RUV     W out of the data, and also in the model     -> "W removed for
 *                                                            visualisation"
 *
 * RUV's note names the operation because "for looking only" did not say what
 * "it" was. W is a single direction estimated from the 25 reference genes and
 * subtracted from all 50. The reference genes supply the estimate and are not
 * themselves the target of the subtraction, and that 25-in / 50-out asymmetry
 * is the method. The caveat the note used to carry now sits in the card note,
 * which has room for "visualisation, not testing".
 *   SVA     no corrected matrix exists at all            -> says so, and points
 *
 * SVA's note used to read "the data is unchanged", which is true and still read
 * as the method FAILING: an unchanged picture under a heading that says SVA,
 * beside a ground truth that is visibly clean. It now says where SVA does show
 * up. Its row on the forest sits exactly on None's — the point estimate cannot
 * move, W being orthogonal to the condition — so the interval is the only thing
 * that carries it, and the note sends the reader there rather than leaving them
 * to conclude nothing happened. model.js records why no corrected panel is on
 * offer, with the numbers.
 */
function panelNote(params) {
  if (!params.correcting || params.method === "none") return "with the batch effect";
  if (params.method === "sva") return "changes the model, not the data";
  if (params.method === "ruv") return "W removed for visualisation";
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

/* A correction that removes exactly as much as it should lands on -1e-16, which
   `fmt` renders as "-0.00". */
function zeroed(v, d = 2) {
  return fmt(Math.abs(v) < 5 * 10 ** -(d + 1) ? 0 : v, d);
}

function padded(vals) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const m = (hi - lo) * 0.08 || 1;
  return [lo - m, hi + m];
}

/* A tick at -1e-9 renders as "-0" through toFixed. */
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
    return "Each batch holds the same mix of healthy and diseased samples, so any "
      + "difference between the batches is the batch effect.";
  }
  if (phi >= 1) {
    return `Batch 1 is entirely ${lean[0]} and batch 2 entirely ${lean[1]}. Batch `
      + "and condition are completely confounded, and no method can separate them.";
  }
  if (phi < 0.5) {
    return `Batch 1 leans ${lean[0]} and batch 2 leans ${lean[1]}. Most of a `
      + "difference between the batches is the batch effect, but not all of it.";
  }
  return `Batch 1 is mostly ${lean[0]} and batch 2 mostly ${lean[1]}. A difference `
    + "between the batches is part batch effect and part disease effect, and the data "
    + "cannot say which.";
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
      /* An empty cell is what makes the correlation 1.00, so it is marked
         rather than left to be counted. */
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
  ctx.fillText("Batch–condition correlation", tx, y - 12);

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

     -2 to 8 does not cover every state, deliberately. Measured over 6,125
     states — every confounding, batch shift, disease effect, method, mod
     setting and reference set at seeds 1..200 step 29 — the interval ends reach
     -12.62 and 15.87, both at complete confounding with the batch at 4 and the
     effect at 3, where RUV's factor is collinear with the condition. A domain
     wide enough for that leaves the readable range a few pixels across, so the
     ends are clipped with a caret, as a forest plot does. The domain was -1 to
     6 before the effect became a parameter: 15.1% of states needed a caret
     there against 7.2% here, and widening further gains little (7.0% at
     -2 to 10). */
  const LO = -2;
  const HI = 8;
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
  ctx.moveTo(SX(state.truth), y + 8);
  ctx.lineTo(SX(state.truth), axis);
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
  /* every second unit: eleven labels on a ten-unit axis crowd at the narrow
     column, and the axis is read for position rather than for values. */
  for (let v = LO; v <= HI; v += 2) ctx.fillText(String(v), SX(v), axis + 5);
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

  const key = `${params.method}|${params.mod}|${shift}`;
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
  const stepNote = step.noteFor ? step.noteFor(params.mod) : (step.note || "");

  cardHost.innerHTML =
    row("The model", MATHML ? MODEL.math : `<span style="font-size:var(--fs-xs)">${MODEL.plain}</span>`,
      `i = 1…${GENES} genes, j = 1…${SAMPLES} samples`)
    + KEY
    + row("The method", stepBody, stepNote);
}
