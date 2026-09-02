/* ============================================================================
   Batch Effects — widget 40. DRAFT.

   Hosts at PHM5003 `05 - Introduction to High Throughput Data / 05 - Batch
   Effect Correction`, cells 3–6. The misconception: that a batch effect is
   noise you subtract. Here it is a systematic shift larger than the biology,
   sitting on the first principal component.

   The full design record is in `docs/catalogue.md` § Slot 3.

   ---------------------------------------------------------------------------
   NO CORRECTION ON THIS PAGE, AND NO MODEL (Kenneth, 2026-09-02). Correcting
   the data and modelling the batch are different acts — they prescribe
   OPPOSITE things on the same matrix — and mixing them cost this widget five
   rounds. The tell was in the code: `covariate` does not change the data, that
   is its defining property, so to draw it on a scatter it had to be given a
   transformation it does not have. The corrections, the formula card and the
   forest plot of intervals move to a second page; the engine keeps all of it.

   So this page asks one question: what does a batch effect DO to the data? The
   answer is a toggle between what the instrument gave you and what it would
   have given you on one run.

   ---------------------------------------------------------------------------
   THE STAGE IS THE LESSON'S OWN, plus one control it does not have. Cell 3
   builds 50 genes x 40 samples, an effect of 0.8 on genes 1-25 of the diseased
   samples, and a +2 shift on samples 21-40. Condition alternates while batch
   splits at sample 20, so every batch holds 10 healthy and 10 diseased — the
   design is balanced, and the lesson never says so.

   BALANCED IS NOT "NO BATCH EFFECT", and the control used to say it was. Two
   dials do two jobs: the batch shift decides whether an artefact exists at
   all, the confounding decides whether it can be told apart from the biology.
   At `balanced` with the notebook's shift, separation along PC1 is still
   7.80 sd by batch. The slider read "Overlap … none" and cost a reader a
   session.

   ---------------------------------------------------------------------------
   ONE SHARED FRAME, and it is measured rather than preferred. The notebook
   refits `prcomp` per figure and lets ggplot rescale the axes, so its two
   pictures both look full and the collapse between them is invisible unless
   you read the ticks: the cloud is 20.4 units wide observed and 6.7 without
   the batch, a 3x difference the lesson's own figures cannot show.

   The stronger argument is the motion. On one frame EVERY SAMPLE MOVES EXACTLY
   67.0 px — one displacement value for all forty, because the batch shift is a
   rigid translation. The motion IS the shift. Refitting the frame per state
   scatters that from 0 to 133 px, since the panel zooms while the points move,
   and it stops reading as one thing.

   The basis is fixed for the same reason a level up (round 3): refitting the
   PCA rotates the axes, so the points would move for reasons about the basis
   rather than the data. Both departures are stated on screen — the axis is
   labelled "PC1 of the observed data".

   Legibility was the worry and it does not hold: in the ground-truth panel the
   healthy and diseased centres are 30.9 px apart with a group sd of 10.1 px, a
   3.1 sd gap inside a 227 px panel.

   ---------------------------------------------------------------------------
   THE SAME POINTS, COLOURED TWICE — the lesson's own figure, and the palette is
   shared on purpose. Blue is Batch 1 on the left and Healthy on the right, so
   the two panels CONVERGE as the confounding rises and at `complete` they are
   the same picture, which is what "batch and condition are one variable" looks
   like.

   THE DESIGN READS ITSELF OUT, above the panels. Four counts are not something
   a student can be expected to translate, so the block also carries the phi
   coefficient — the correlation between two binary variables, which is exactly
   what the dial moves: 0.00 / 0.20 / 0.50 / 0.70 / 1.00 across the ladder, and
   1.00 is the design no measurement can untangle.

   NO DRIVE BUTTONS (4.5). The one motion is the ease between the two states,
   on core's ease-request door.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import {
  simulate, withoutBatch, projectOnto, design, separation, SAMPLES,
} from "./model.js";

const FIG_H = 344;
const EASE_MS = 600;

/* The design ladder. A magnitude — how far batch and condition line up — with
   the notebook's own balanced design at the left end. The right end is the
   only setting where no method could separate them, and it is kept because
   that boundary is the argument's conclusion (2.6). */
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
  { value: "0", amount: 0, label: "none", detail: "no batch effect at all — the two states are the same data" },
  { value: "0.5", amount: 0.5, label: "0.5", detail: "smaller than the disease effect; the condition still owns PC1" },
  { value: "1", amount: 1, label: "1.0", detail: "about the crossover: the batch takes PC1 from the condition" },
  { value: "2", amount: 2, label: "2.0", detail: "the notebook's setting — 2.5x the disease effect" },
  { value: "4", amount: 4, label: "4.0", detail: "the batch dominates completely" },
];

/* The two panels: same points, same axes, one split each. Declared at module
   scope rather than beside the loop that draws them — a const is in its
   temporal dead zone until its own line runs, and this collection has thrown
   that way three times. */
const PANELS = [
  { title: "Coloured by batch", of: (sim, j) => sim.batch[j] === 1 },
  { title: "Coloured by condition", of: (sim, j) => sim.disease[j] },
];

const overlapOf = (k) => OVERLAPS.find((o) => o.value === k)?.amount ?? 0;
const shiftOf = (k) => SHIFTS.find((s) => s.value === k)?.amount ?? 2;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

defineWidget({
  slug: "batch-effect",
  title: "Batch Effects",
  subtitle:
    "Samples processed in different batches carry a systematic difference that "
    + "has nothing to do with the biology. It can outweigh the effect the study "
    + "is looking for, and it lands on the first principal component.",
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
         this one says whether it can be told apart from the biology. */
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

    show: { type: "section", label: "The data" },

    /* Display, not data: both states are computed together and the toggle
       chooses which to show, which is also what lets the change ease rather
       than jump. Opens on `observed` — the data you actually have is the
       question, and ground truth is the reveal (2.1). */
    view: {
      type: "segmented",
      label: "Show",
      options: [
        { value: "observed", label: "Observed",
          detail: "what the instrument gave you, with the batch shift in it" },
        { value: "truth", label: "Ground truth",
          detail: "the same samples without the batch shift — a thing only a simulation can hand you" },
      ],
      default: "observed",
      display: true,
    },
  },

  /* One swatch, two meanings, and that is the design rather than a compromise:
     the panels share a palette so they converge as the confounding rises. Each
     label names both, left panel first. */
  legend: [
    { token: "group-a", label: "Batch 1, left · Healthy, right", mark: "dot" },
    { token: "group-b", label: "Batch 2, left · Disease, right", mark: "dot" },
  ],

  compute: ({ params }) => {
    const sim = simulate({
      seed: params.seed,
      overlap: overlapOf(params.overlap),
      batchShift: shiftOf(params.shift),
    });

    /* Both states on ONE basis, the observed data's, so the toggle moves the
       points and never the axes. */
    const { points, share } = projectOnto(sim, {
      observed: sim.X,
      truth: withoutBatch(sim),
    });

    /* ONE FRAME FOR BOTH STATES. Fitted per state the two clouds would each
       fill the panel and the 3x collapse would be invisible — which is exactly
       what the notebook's two separately scaled figures do. */
    const flat = [...points.truth, ...points.observed];
    const frame = { x: padded(flat.map((q) => q[0])), y: padded(flat.map((q) => q[1])) };

    /* How alike the two panels are IS the confounding: a sample carries the
       same colour in both only when its batch and its condition agree. 20 of
       40 at a balanced design, 40 of 40 when they are one variable. */
    const sameColour = sim.disease.filter((v, j) => (sim.batch[j] === 1) === v).length;

    return { sim, points, share, frame, sameColour, design: design(sim) };
  },

  animation: {
    stepLabel: null,
    runLabel: null,

    init: ({ params, state }) => ({
      key: params.view,
      t: 1,
      from: state.points[params.view],
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
      if (params.view === anim.key) return;
      anim.from = blend(anim, state);
      anim.key = params.view;
      anim.t = 0;
      anim.easing = true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const pts = blend(anim, state);
    const { share, frame } = state;

    /* --- the design, above the panels, reading itself out --------------- *
     * Confounding is a property of the design rather than of the data, and a
     * reader seeing only the scatter cannot tell an unbalanced design from a
     * large batch effect. Four counts, the correlation they imply, and what
     * that costs — beside the consequence (2.7). */
    drawDesign(ctx, colors, 0, 22, w, state.design);

    const top = 128;
    const panelH = 168;
    const axisPad = 40;                     // the left panel's y-axis labels
    const gap = 26;
    /* The right panel's last tick label is CENTRED on its right edge, so
       without this it overhangs the canvas by half its width. */
    const rightPad = 14;
    const panelW = (w - axisPad - gap - rightPad) / 2;

    PANELS.forEach((panel, i) => {
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
         narrow column — no overlap, so a collision sweep passed, and they
         still read as a single run-on string. The axis is shared, so the label
         is drawn once below both. */
      plot.axisX({ ticks: ticksOf(frame.x), format: axisFmt });
      plot.caption(panel.title);
      if (i === 1) plot.note(`${state.sameColour} of ${SAMPLES} match the left`);

      ctx.save();
      for (let j = 0; j < pts.length; j += 1) {
        ctx.fillStyle = panel.of(state.sim, j) ? colors.groupB : colors.groupA;
        ctx.beginPath();
        ctx.arc(plot.sx(pts[j][0]), plot.sy(pts[j][1]), 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    /* The state is named on the figure as well as in the rail: a screenshot of
       this widget has to say which of the two it is.

       TOP RIGHT OF THE FIGURE, opposite "The design", and it took two goes.
       Above the left panel it landed on that panel's caption; above the right
       panel it crowded the panel's own note. Here it sits on the header line
       with nothing else in its half. */
    ctx.save();
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.fillStyle = params.view === "truth" ? colors.highlight : colors.ink2;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(params.view === "truth" ? "Ground truth" : "Observed", w, 16);
    ctx.restore();

    /* The axis both panels share, named once and centred across the pair. It
       says "of the observed data" because the basis is fixed there, which is a
       departure from the notebook and has to be visible.

       PAINTED LAST, DELIBERATELY. A text sweep proves `draw` finished by
       looking for the last string it paints, so the bottom-most label is the
       one to end on. Adding the state label after this silently moved the
       terminator and 50 states came back as "did not finish". */
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `PC1 of the observed data · ${(share[0] * 100).toFixed(0)}% of its variance`,
      axisPad + (2 * panelW + gap) / 2, top + panelH + 28,
    );
    ctx.restore();
  },

  readout: ({ params, state }) => {
    const xs = blendedX(state, params.view);
    const byBatch = state.sim.batch.map((b) => b === 1);
    return [
      {
        label: "Separation by batch",
        value: fmt(separation(xs, byBatch), 2),
        note: "group means along PC1, in pooled sd",
      },
      {
        label: "Separation by condition",
        value: fmt(separation(xs, state.sim.disease), 2),
        note: "the comparison the study is for",
      },
      {
        label: "PC1's share of the variance",
        value: `${(state.share[0] * 100).toFixed(0)}%`,
        note: "of the observed data, whose axes both panels use",
      },
    ];
  },

  /* Both states, because the copied table is what a reader pastes into notes
     and the comparison is the whole content. */
  table: ({ state }) => ({
    columns: ["", "Separation by batch", "Separation by condition"],
    rows: [["observed", "Observed"], ["truth", "Ground truth"]].map(([key, label]) => {
      const xs = state.points[key].map((p) => p[0]);
      return [
        label,
        fmt(separation(xs, state.sim.batch.map((b) => b === 1)), 3),
        fmt(separation(xs, state.sim.disease), 3),
      ];
    }),
  }),
});

/* --- helpers -------------------------------------------------------------- *
 * Every one of these is a `function` declaration, and that is deliberate:
 * `draw` runs synchronously while this module is still evaluating, so a const
 * arrow down here is in its temporal dead zone and throws on every render.
 * Three widgets in this collection have shipped that bug. */

/** The points as they are right now: the eased blend between where they were
    and where the chosen state puts them. */
function blend(anim, state) {
  const target = state.points[anim?.key ?? "observed"];
  if (!anim || anim.t >= 1 || !anim.from) return target;
  const k = easeInOut(anim.t);
  return target.map((p, j) => [
    lerp(anim.from[j][0], p[0], k),
    lerp(anim.from[j][1], p[1], k),
  ]);
}

/** PC1 of the state the readout is describing — the settled positions, not the
    eased ones, so a tile never prints a number from halfway through a move. */
function blendedX(state, view) {
  return state.points[view].map((p) => p[0]);
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

/**
 * The phi coefficient: the Pearson correlation between two binary variables,
 * which is exactly what "how far batch and condition line up" means. Measured
 * across the ladder it runs 0.00 / 0.20 / 0.50 / 0.70 / 1.00, and 1.00 is the
 * design where no model can separate them.
 */
function phiOf(cells) {
  const [[a, b], [c, d]] = cells;
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den ? (a * d - b * c) / den : NaN;
}

/**
 * What the four counts MEAN, rather than a restatement of them — the table is
 * right beside it. Computed from the cells rather than written per option, so
 * a new rung on the ladder cannot arrive without a reading.
 */
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
