/* ============================================================================
   Widget 65 · U-Net and Dice — the encoder–decoder with skips, drawn to scale
   from its shapes; and what overlap measures that pixel accuracy does not.

   PHM5005 06-3: Architecture - Basic (cells 30–37, `UNet2D`), Training /
   Evaluation (cells 38, 50–56: `DiceMetric`, `show_prediction`) and the split
   (cell 6's bins). `model.js` holds the arithmetic and the geometry; this file
   the colours, the strings and the animation.

   DECISIONS, so they are not re-argued (`_lab/unet-mock.html`, Kenneth's
   picks 2026-09-15):

    1. TWO PAGES, U-Net · Dice, under the arc's Topic control (his pick of
       2026-09-13: slot 66 is this widget's second page). Each page's controls
       show only on it (`when`), as widget 51's do.

    2. THE WIDGET TRAINS NOTHING. The planning measurement found the skip
       bought convergence speed and not the boundary, and 30 epochs cost 5–7 s;
       so the U is drawn from its shapes and Dice is counted on a mask the
       reader chose. Everything is arithmetic, and the one seeded draw is the
       Dice page's random prediction and its shuffle.

    3. THE U IS TO SCALE, his figure's own rule: a slab's height follows H × W
       and its width follows C, the encoder's slabs step in down the left in
       `--c-group-a` and the decoder's step out up the right in `--c-group-b`,
       the concatenation is the two halves side by side under a `--c-dim-b`
       bracket with the transposed convolution's output as its right half, the
       skips are dotted across, and the arrows that change height and width
       are `--c-dim-a`. Step adds one stage in walk order and prints its
       shape; the formula card is the shape lines of the stages reached.

    4. A 1 × 1 BOTTLENECK IS THE CASE THAT FAILS (2.6): depth 4 on a 16 × 16
       input. It is drawn at floor height and named in `--c-extreme`.

    5. THE PREDICTION IS BOTH A LIST AND A DRAG (his pick): a named list of
       measured failures — Empty · Shifted 1 px · Off the object · Dilated 1 px
       · Eroded 1 px · Same area at random — moved by a drag of the prediction
       panel that writes `dx` and `dy` in one transaction. No threshold
       control: on a symmetric map 0.5 cannot lose.

    6. THE COUNT IS THREE PRESSES, one tile each — |A|, |B|, |A ∩ B| — and the
       four numbers print only when the third is counted (2.4).

    7. THE SPLIT IS A BAND on the Dice page (his pick), behind a Split control
       Random · Stratified with Seed moving the shuffle; a bin the split left
       empty is lit in `--c-extreme`.
   ========================================================================= */

import { defineWidget, shapeText, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

/* --- primitives ------------------------------------------------------------ */

const fmt = (n) => n.toLocaleString("en-US");
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const easeOut = (t) => 1 - (1 - t) ** 3;
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};

function txt(ctx, colors, s, x, y, o = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "",
  } = o;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? colors.mono : colors.font}`.trim();
  ctx.fillText(s, x, y);
  ctx.restore();
}
const caption = (ctx, colors, s, x, y) => txt(ctx, colors, s, x, y, { color: colors.ink2, weight: "600" });
const note = (ctx, colors, s, x, y, tone, o = {}) =>
  txt(ctx, colors, s, x, y, { color: tone ?? colors.ink3, size: colors.fsXs, ...o });

function frame(ctx, x, y, w, h, stroke, width = 1) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, color, o = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = o.width ?? 1;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 6 * Math.cos(a - 0.4), y1 - 6 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 6 * Math.cos(a + 0.4), y1 - 6 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* --- what the presses have revealed ---------------------------------------- */
function revealOf(anim) {
  const n = anim?.n ?? 0;
  const t = anim?.t ?? 0;
  return { n, alphaOf: (k) => (k < n ? 1 : k === n && t > 0 ? easeOut(t) : 0), current: t > 0 ? n : n - 1 };
}

/* ============================== the U ===================================== */

const U_CAPTION = "U-Net: the encoder down, the decoder up, and the skips across";
const U_NOTE = "A block's height follows its map's height and width, and its width the channels. Each press adds one stage and prints its shape.";
const BOTTLENECK_1 = "a 1 × 1 map: no height or width is left to pool";

function drawU(ctx, colors, w, state, reveal) {
  const { depth, stages } = state;
  const L = M.uLayout(w, state);
  caption(ctx, colors, U_CAPTION, M.PAD, M.CAPTION_Y);
  note(ctx, colors, U_NOTE, M.PAD, M.NOTE_Y);
  const encTone = colors.groupA;
  const decTone = colors.groupB;

  stages.forEach((s, i) => {
    const a = reveal.alphaOf(i);
    if (a <= 0) return;
    const on = i === reveal.current;
    const tone = (base) => (on ? colors.highlight : base);
    ctx.save();
    ctx.globalAlpha = a;
    const row = L.rows[s.level - 1];

    if (s.kind === "pool") {
      const from = L.boxes[`enc${s.level}`];
      const below = L.rows[s.level];
      const x = from.x + from.w / 2 + 14;
      arrow(ctx, x, from.y + from.h + 3, x, below.y - 3, tone(colors.dims[0]), { width: on ? 2 : 1.2 });
      note(ctx, colors, s.name, x + 6, (from.y + from.h + below.y) / 2 + 4, tone(colors.ink3), { mono: true });
    } else if (s.kind === "up") {
      const b = L.boxes[s.name];
      const below = L.rows[s.level];
      ctx.fillStyle = wash(decTone, on ? 0.55 : 0.35);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      frame(ctx, b.x, b.y, b.w, b.h, tone(decTone), on ? 2 : 1);
      const x = b.x + b.w / 2;
      arrow(ctx, x, below.y - 3, x, b.y + b.h + 3, tone(colors.dims[0]), { width: on ? 2 : 1.2 });
      note(ctx, colors, s.name, x + 6, below.y - 8, tone(colors.ink3), { mono: true });
    } else {
      const b = L.boxes[s.name];
      const base = s.kind === "enc" || s.kind === "bottleneck" ? encTone : s.kind === "head" ? colors.empirical : decTone;
      if (s.kind === "cat") {
        ctx.fillStyle = wash(encTone, 0.35);
        ctx.fillRect(b.x, b.y, b.w / 2, b.h);
        ctx.fillStyle = wash(decTone, 0.35);
        ctx.fillRect(b.x + b.w / 2, b.y, b.w / 2, b.h);
      } else {
        ctx.fillStyle = wash(base, on ? 0.55 : 0.35);
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      frame(ctx, b.x, b.y, b.w, b.h, tone(base), on ? 2 : 1);
      if (s.kind === "cat") {
        ctx.strokeStyle = tone(colors.dims[1]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x, b.y - 8); ctx.lineTo(b.x + b.w, b.y - 8); ctx.lineTo(b.x + b.w, b.y - 4);
        ctx.stroke();
        const e = L.boxes[`enc${s.level}`];
        arrow(ctx, e.x + e.w + 4, e.y + e.h / 2, b.x - 3, b.y + b.h / 2, tone(colors.ink3), { dash: [2, 3] });
      }
      if (s.kind === "enc") note(ctx, colors, s.name, b.x - 6, b.y + b.h / 2 + 4, tone(colors.ink2), { align: "right", mono: true });
      if (s.kind === "dec") {
        const c = L.boxes[`cat${s.level}`];
        arrow(ctx, c.x + c.w + 1, c.y + c.h / 2, b.x - 1, b.y + b.h / 2, tone(colors.dims[1]));
        note(ctx, colors, s.name, b.x + b.w / 2, b.y + b.h + 12, tone(colors.ink2), { mono: true, align: "center" });
      }
      if (s.kind === "bottleneck") note(ctx, colors, s.name, b.x + b.w / 2, b.y + b.h + 14, tone(colors.ink2), { align: "center", mono: true });
      if (s.kind === "head") {
        const d = L.boxes.dec1;
        arrow(ctx, d.x + d.w + 1, d.y + 8, b.x - 1, b.y + 8, tone(colors.dims[1]));
        note(ctx, colors, s.name, b.x + b.w / 2, b.y - 6, tone(colors.ink2), { mono: true, align: "center" });
      }
      if (on) {
        const line = `${s.name}: ${shapeText(M.shapeOf(s))}`;
        const anchor = s.kind === "enc" ? b.x + b.w + 8 : s.kind === "head" || s.kind === "dec" ? b.x + b.w - 40 : b.x + b.w / 2;
        const align = s.kind === "enc" ? "left" : s.kind === "head" || s.kind === "dec" ? "right" : "center";
        note(ctx, colors, line, Math.max(M.PAD + 60, Math.min(w - M.PAD - 60, anchor)), b.y - 12, colors.highlight, { align, mono: true });
        if (s.H === 1) note(ctx, colors, BOTTLENECK_1, w / 2, b.y + b.h + 28, colors.extreme, { align: "center" });
      }
    }
    ctx.restore();
  });
  /* the case that fails stays named once its row is on screen */
  const bIdx = stages.findIndex((s) => s.kind === "bottleneck");
  const bottle = stages[bIdx];
  if (bottle.H === 1 && reveal.alphaOf(bIdx) >= 1 && reveal.current !== bIdx) {
    const b = L.boxes.bottleneck;
    note(ctx, colors, BOTTLENECK_1, w / 2, b.y + b.h + 28, colors.extreme, { align: "center" });
  }
}

/* ============================== Dice ====================================== */

const PRED_LABELS = {
  empty: "Empty",
  shift: "Shifted 1 px",
  off: "Off the object",
  dilate: "Dilated 1 px",
  erode: "Eroded 1 px",
  random: "Same area at random",
};
const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" };
const BIN_NAMES = ["normal", "small", "medium", "large"];
const BIN_LABELS = ["normal", "small < 1 %", "medium 1–5 %", "large > 5 %"];
const DICE_NOTE = "Left to right: the image, the ground truth on it, the prediction on it. Then the overlap, counted.";
const BAND_CAPTION = "Which cases a 60-case test set draws from 600";
const BAND_NOTE = "Mask fraction on a log axis with the bins' cut-offs; below, the test set, one dot a case";

function paintPanel(ctx, colors, p, truth, pred, which) {
  const c = p.w / M.G;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  /* the image: the object a little brighter than its field */
  for (let j = 0; j < M.G; j += 1) {
    for (let i = 0; i < M.G; i += 1) {
      ctx.fillStyle = wash(colors.ink1, truth[j * M.G + i] ? 0.22 : 0.06);
      ctx.fillRect(p.x + i * c, p.y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  const overlay = which === "truth" ? truth : which === "pred" ? pred : null;
  if (overlay) {
    ctx.fillStyle = wash(which === "truth" ? colors.reference : colors.empirical, 0.6);
    for (let j = 0; j < M.G; j += 1) {
      for (let i = 0; i < M.G; i += 1) {
        if (overlay[j * M.G + i]) ctx.fillRect(p.x + i * c, p.y + j * c, Math.ceil(c), Math.ceil(c));
      }
    }
  }
  ctx.restore();
  frame(ctx, p.x, p.y, p.w, p.h, which === "pred" ? colors.empirical : colors.axis);
}

function drawDice(ctx, colors, w, state, reveal) {
  const L = M.diceLayout(w);
  const { truth, prediction, m } = state;
  caption(ctx, colors, `Dice on a ${SIZE_LABELS[state.size].toLowerCase()} object (${M.SIZES[state.size].share} of the image), the prediction ${PRED_LABELS[state.pred].toLowerCase()}`, M.PAD, M.CAPTION_Y);
  note(ctx, colors, DICE_NOTE, M.PAD, M.NOTE_Y);
  [["Image", "image"], ["Ground truth", "truth"], ["Prediction", "pred"]].forEach(([label, which], k) => {
    const p = L.panels[k];
    paintPanel(ctx, colors, p, truth, prediction, which);
    note(ctx, colors, label, p.x, p.y + p.h + 14, colors.ink2);
  });
  /* the drag's numbers are the rail's two sliders; under the panel they met
     its label */

  /* the count: three tiles, one a press */
  const tiles = [
    ["|A|  truth", m.A, colors.reference],
    ["|B|  prediction", m.B, colors.empirical],
    ["|A ∩ B|  both", m.AB, colors.highlight],
  ];
  tiles.forEach(([label, v, tone], k) => {
    const t = L.tiles[k];
    const a = reveal.alphaOf(k);
    if (a <= 0) { frame(ctx, t.x, t.y, t.w, t.h, colors.grid); return; }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = wash(tone, 0.12);
    ctx.fillRect(t.x, t.y, t.w, t.h);
    frame(ctx, t.x, t.y, t.w, t.h, tone);
    note(ctx, colors, label, t.x + 8, t.y + 16, colors.ink2);
    txt(ctx, colors, `${v} px`, t.x + 8, t.y + 38, { mono: true, color: colors.ink1, weight: "600" });
    ctx.restore();
  });
  const done = reveal.n >= 3;
  const lines = [
    ["accuracy", done ? pct(m.acc) : "—"],
    ["Dice", done ? m.dice.toFixed(3) : "—"],
    ["IoU", done ? m.iou.toFixed(3) : "—"],
    ["precision · recall", done ? `${m.prec.toFixed(2)} · ${m.rec.toFixed(2)}` : "—"],
  ];
  lines.forEach(([label, v], k) => {
    note(ctx, colors, label, L.numbers.x, L.numbers.y + k * M.LINE, colors.ink2);
    txt(ctx, colors, v, L.numbers.x + 96, L.numbers.y + k * M.LINE, { mono: true, color: colors.ink1, size: colors.fsXs, weight: "600" });
  });

  /* the split band */
  const B = L.band;
  caption(ctx, colors, BAND_CAPTION, M.PAD, B.captionY);
  note(ctx, colors, BAND_NOTE, M.PAD, B.noteY);
  const { bins, normals } = state.hist;
  const mx = Math.max(...bins, normals);
  const bw = (B.histX1 - B.histX0) / M.HIST_BINS;
  ctx.save();
  ctx.fillStyle = wash(colors.ink2, 0.5);
  bins.forEach((v, k) => ctx.fillRect(B.histX0 + k * bw, B.histBase - B.histH * v / mx, bw - 1, B.histH * v / mx));
  ctx.fillRect(M.PAD + 10, B.histBase - B.histH * normals / mx, 30, B.histH * normals / mx);
  ctx.restore();
  note(ctx, colors, "normal", M.PAD + 25, B.histBase + 12, colors.ink3, { align: "center" });
  const lx = (f) => B.histX0 + (B.histX1 - B.histX0) * M.logPos(f);
  M.CUTS.forEach((f) => {
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(lx(f) + 0.5, B.histBase - B.histH - 6); ctx.lineTo(lx(f) + 0.5, B.histBase); ctx.stroke();
    ctx.restore();
    note(ctx, colors, `${Math.round(100 * f)} %`, lx(f) + 3, B.histBase - B.histH - 8, colors.reference);
  });
  note(ctx, colors, "0.1 %", lx(M.HIST_LO), B.histBase + 12, colors.ink3, { mono: true });
  note(ctx, colors, "30 %", lx(M.HIST_HI), B.histBase + 12, colors.ink3, { mono: true, align: "right" });

  const tones = [colors.ink3, colors.clusters[0], colors.clusters[1], colors.clusters[3]];
  note(ctx, colors, state.split === "strat" ? "stratified by bin" : "random 80/10/10", M.PAD, B.dotsY + 4, colors.ink2);
  const sorted = [...state.test].sort((a, b) => a.bin - b.bin);
  sorted.forEach((k, i) => {
    ctx.save();
    ctx.fillStyle = tones[k.bin];
    ctx.beginPath();
    ctx.arc(B.dotsX0 + i * B.dotStep + 3, B.dotsY, 2.6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  });
  const counts = BIN_LABELS.map((n, b) => `${n} ${state.counts[b]}`).join(" · ");
  note(ctx, colors, counts, B.dotsX0, B.countsY, state.empty >= 0 ? colors.extreme : colors.ink3);
  if (state.empty >= 0) {
    note(ctx, colors, `no ${BIN_NAMES[state.empty]} case in the test set`, B.histX1, B.dotsY + 4, colors.extreme, { align: "right", weight: "600" });
  }
}

/* ============================= the formula card ============================ */

const MATHML = mathmlRenders();
let cardHost = null;
let cardKey = null;
const DICE_EQ = [
  {
    math: "<math><mrow><mi>Dice</mi><mo>=</mo><mfrac><mrow><mn>2</mn><mo>|</mo><mi>A</mi><mo>∩</mo><mi>B</mi><mo>|</mo></mrow>"
      + "<mrow><mo>|</mo><mi>A</mi><mo>|</mo><mo>+</mo><mo>|</mo><mi>B</mi><mo>|</mo></mrow></mfrac></mrow></math>",
    text: "Dice = 2 |A ∩ B| / (|A| + |B|)",
  },
  {
    math: "<math><mrow><mi>IoU</mi><mo>=</mo><mfrac><mrow><mo>|</mo><mi>A</mi><mo>∩</mo><mi>B</mi><mo>|</mo></mrow>"
      + "<mrow><mo>|</mo><mi>A</mi><mo>∪</mo><mi>B</mi><mo>|</mo></mrow></mfrac></mrow></math>",
    text: "IoU = |A ∩ B| / |A ∪ B|",
  },
  {
    math: "<math><mrow><mi>accuracy</mi><mo>=</mo><mfrac><mrow><mo>|</mo><mi>A</mi><mo>∩</mo><mi>B</mi><mo>|</mo><mo>+</mo><mi>neither</mi></mrow>"
      + "<mrow><mi>all</mi><mo> </mo><mi>pixels</mi></mrow></mfrac></mrow></math>",
    text: "accuracy = (|A ∩ B| + neither) / all pixels",
  },
];
const DICE_CARD_NOTE = "A is the set of pixels in the ground truth, B the set in the prediction. Dice and IoU count only "
  + "the object's pixels, so an empty prediction scores 0 whatever the object's size; accuracy counts the "
  + "background too, so on a small object it stays near 1.";
const U_CARD_NOTE = "One line a stage, in the order the network runs: [batch, channels, height, width]. "
  + "A convolution keeps height and width and sets the channels; max-pool halves height and width; the "
  + "transposed convolution doubles them; the concatenation adds the encoder's channels to the decoder's.";

function renderCard(params, state, reveal) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const dice = M.isDice(params);
  const key = dice ? "dice" : `unet:${state.depth}:${state.base}:${state.input}:${reveal.n}`;
  if (key === cardKey) return;
  cardKey = key;
  const eqStyle = "min-height:0;margin:0;display:inline-block;padding-right:2.4em";
  if (dice) {
    cardHost.innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:baseline;row-gap:4px">`
      + DICE_EQ.map((eq) => `<div class="w-math-eq" style="${eqStyle}">${MATHML ? eq.math : eq.text}</div>`).join("")
      + `</div><p class="w-math-note">${DICE_CARD_NOTE}</p>`;
    return;
  }
  /* plain rows, not `.w-math-eq`: that class reserves a gutter and an indent
     for an equation, and here each row is a name and a shape in mono */
  const reached = state.stages.slice(0, reveal.n);
  const rowStyle = "display:inline-block;width:19em;white-space:nowrap;font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--ink-1)";
  const rows = reached.length
    ? reached.map((s) => `<div style="${rowStyle}"><span style="display:inline-block;width:6.5em;color:var(--ink-3)">${s.name}</span>${shapeText(M.shapeOf(s))}</div>`).join("")
    : `<div style="font-size:var(--fs-xs);color:var(--ink-3)">no stage reached yet</div>`;
  cardHost.innerHTML = `<div style="display:flex;flex-wrap:wrap;row-gap:2px;column-gap:1em">${rows}</div>`
    + `<p class="w-math-note">${U_CARD_NOTE}</p>`;
}

/* ============================== the widget ================================= */

const ON = (topic) => ({ param: "topic", equals: topic });

/* the label names what THIS press does (4.4b); once the last press is made
   the button is disabled and keeps the last name, on either page */
const STEP_LABELS = {
  stage: "Next stage",
  a: "Count the truth",
  b: "Count the prediction",
  ab: "Count the overlap",
};
const STEP_TITLES = {
  stage: "Add the next stage of the network and print the shape it outputs",
  a: "Count the pixels of the ground truth, |A|",
  b: "Count the pixels of the prediction, |B|",
  ab: "Count the pixels in both, |A ∩ B|, and print the four numbers",
};
const phaseOf = (n, state) => (state.page === "dice" ? ["a", "b", "ab"][Math.min(2, n)] : "stage");

defineWidget({
  slug: "unet",
  status: "draft",
  title: "Deep Learning - U-Net and Dice",
  subtitle:
    "A U-Net halves the image and doubles the channels at each level of its encoder, then reverses "
    + "both up its decoder, where each level concatenates the encoder's features of the same size "
    + "before a convolution. Dice scores a predicted mask by its overlap with the truth, which pixel "
    + "accuracy does not: a prediction that misses a small object entirely is still right at nearly "
    + "every pixel.",
  layout: "side",
  height: ({ w, ...values }) => M.pageHeight(w, values),

  params: {
    topic: {
      type: "segmented",
      label: "Topic",
      options: [{ value: "unet", label: "U-Net" }, { value: "dice", label: "Dice" }],
      default: "unet",
    },

    /* --- U-Net ----------------------------------------------------------- */
    netSec: { type: "section", label: "The network", when: ON("unet") },
    depth: {
      type: "choice",
      label: "Depth",
      detail: "how many times the encoder halves the image before the bottleneck",
      options: M.DEPTHS.map((v) => ({ value: v, label: v })),
      default: "4",
      when: ON("unet"),
    },
    base: {
      type: "choice",
      label: "Base channels",
      detail: "the channels of the first block; each level doubles them",
      options: M.BASES.map((v) => ({ value: v, label: v })),
      default: "16",
      when: ON("unet"),
    },
    input: {
      type: "choice",
      label: "Input",
      detail: "the side of the input image, in pixels",
      options: M.INPUTS.map((v) => ({ value: v, label: v })),
      default: "512",
      when: ON("unet"),
    },

    /* --- Dice ------------------------------------------------------------ */
    objSec: { type: "section", label: "The object", when: ON("dice") },
    size: {
      type: "segmented",
      label: "Object",
      detail: "the share of the image the ground truth covers: about 1 %, 5 % or 20 %",
      options: M.SIZE_KEYS.map((v) => ({ value: v, label: SIZE_LABELS[v] })),
      default: "small",
      when: ON("dice"),
    },
    predSec: { type: "section", label: "The prediction", when: ON("dice") },
    pred: {
      type: "select",
      label: "Prediction",
      detail: "what the model predicted, relative to the ground truth",
      options: M.PRED_KEYS.map((v) => ({ value: v, label: PRED_LABELS[v] })),
      default: "off",
      when: ON("dice"),
    },
    dx: {
      type: "int",
      label: "Moved across",
      detail: "pixels the prediction is moved to the right; drag the prediction panel to set both",
      min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 0,
      when: ON("dice"),
    },
    dy: {
      type: "int",
      label: "Moved down",
      detail: "pixels the prediction is moved down",
      min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 0,
      when: ON("dice"),
    },
    splitSec: { type: "section", label: "The split", when: ON("dice") },
    split: {
      type: "segmented",
      label: "Split",
      detail: "how the 60-case test set is drawn from the 600 cases",
      options: [{ value: "random", label: "Random" }, { value: "strat", label: "Stratified" }],
      default: "random",
      when: ON("dice"),
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1, when: ON("dice") },

    /* Authoring escape hatch, first render only: stages reached, or tiles counted. */
    shown: { type: "int", min: 0, max: 22, default: 0, hidden: true },
  },

  legend: ({ params }) => (M.isDice(params)
    ? [
      { token: "reference", label: "The ground truth, A", mark: "bar" },
      { token: "empirical", label: "The prediction, B", mark: "bar" },
      { token: "highlight", label: "The pixels in both, A ∩ B" },
      { token: "cluster-a", label: "A small case in the test set" },
      { token: "cluster-b", label: "A medium case" },
      { token: "cluster-d", label: "A large case" },
      { token: "extreme", label: "A bin the split left empty" },
    ]
    : [
      { token: "group-a", label: "The encoder's features, and the bottleneck", mark: "bar" },
      { token: "group-b", label: "The decoder's features", mark: "bar" },
      { token: "dim-a", label: "Height and width change here: max-pool down, transposed convolution up", mark: "line" },
      { token: "dim-b", label: "Channels change here: a convolution, and the concatenation's bracket", mark: "line" },
      { token: "empirical", label: "The head: one logit a pixel", mark: "bar" },
      { token: "highlight", label: "The stage just added, and its shape" },
      { token: "extreme", label: "A bottleneck with nothing left to pool" },
    ]),

  compute: ({ params, rng }) => (M.isDice(params) ? M.computeDice(params, rng) : M.computeU(params)),

  drag: {
    params: ["dx", "dy"],
    cursor: "grab",
    hit: ({ x, y, w, params }) => M.isDice(params) && M.panelCell(M.diceLayout(w), x, y) != null,
    value: ({ dx, dy, start, w }) => {
      const cell = M.diceLayout(w).panel / M.G;
      const clamp = (v) => Math.max(-M.SHIFT_MAX, Math.min(M.SHIFT_MAX, Math.round(v)));
      return { dx: clamp(start.dx + dx / cell), dy: clamp(start.dy + dy / cell) };
    },
  },

  animation: {
    stepLabel: { anim: "phase", labels: STEP_LABELS, default: "Next stage" },
    stepTitle: { anim: "phase", labels: STEP_TITLES, default: STEP_TITLES.stage },
    runLabel: "Play",
    runTitle: "Run the remaining presses in order",

    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.max(0, Math.min(state.total, Number(params.shown) || 0));
      return { n, t: 0, phase: phaseOf(n, state), done: n >= state.total };
    },

    advance: (anim, { dt, state }) => {
      if (anim.n >= state.total) {
        anim.t = 0;
        anim.done = true;
        return false;
      }
      anim.t += dt / M.STEP_MS;
      if (anim.t < 1) return true;
      anim.t = 0;
      anim.n += 1;
      anim.phase = phaseOf(anim.n, state);
      anim.done = anim.n >= state.total;
      return anim.mode !== "step" && !anim.done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    /* `anim.n` presses are complete and the one at index `anim.n` is in flight
       at `anim.t`: drawn at its progress, and listed on the card when it lands */
    const reveal = revealOf(anim);
    renderCard(params, state, { n: anim?.n ?? 0 });
    if (state.page === "dice") drawDice(ctx, colors, w, state, reveal);
    else drawU(ctx, colors, w, state, reveal);
  },

  readout({ params, state, anim }) {
    const n = anim?.n ?? 0;
    if (state.page === "dice") {
      const done = n >= 3;
      const { m } = state;
      return [
        { label: "Accuracy", value: done ? pct(m.acc) : "—", note: `right pixels over all ${M.G * M.G}` },
        { label: "Dice · IoU", value: done ? `${m.dice.toFixed(3)} · ${m.iou.toFixed(3)}` : "—", note: "overlap over the mean size · overlap over the union" },
        { label: "Precision · recall", value: done ? `${m.prec.toFixed(2)} · ${m.rec.toFixed(2)}` : "—", note: "of the predicted pixels, in the truth · of the truth's pixels, predicted" },
        {
          label: "Test set by bin",
          value: state.counts.join(" · "),
          note: state.empty >= 0 ? `normal · small · medium · large; no ${BIN_NAMES[state.empty]} case was drawn` : "normal · small · medium · large; every bin is in the test set",
        },
      ];
    }
    const last = n > 0 ? state.stages[n - 1] : null;
    const bottle = state.stages.find((s) => s.kind === "bottleneck");
    return [
      { label: "Stages reached", value: `${n} of ${state.total}`, note: last ? `${last.name}: ${last.op}` : "the input, not yet through a block" },
      { label: "Bottleneck", value: shapeText(M.shapeOf(bottle)), note: bottle.H === 1 ? "a 1 × 1 map; a deeper network could pool no further" : `${bottle.H} × ${bottle.H}, ${bottle.C} channels` },
      { label: "Parameters", value: fmt(state.params), note: "the DoubleConv blocks, the transposed convolutions and the head, at this depth and base" },
    ];
  },
});
