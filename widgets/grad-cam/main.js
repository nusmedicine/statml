/* ============================================================================
   Widget 64 · Grad-CAM — where a class score's gradient lands on the image,
   and what that does and does not say about the model.

   PHM5005 06-2 cells 122–139 (the three approaches, the four steps, which
   layer, the caveats) and 06-1 cell 4's question: does the model rely on
   meaningful features or spurious ones — background noise, watermarks?
   `engine.js` trains the network, `model.js` reads it and lays the figure
   out, and this file carries the colours, the strings and the animation.

   THE MISCONCEPTION IS THAT THE HEATMAP SHOWS WHERE THE DISEASE IS. It shows
   which positions of one layer's feature maps raised one class's score for one
   model: a model that learned a watermark lights the watermark. So the stage
   trains the model here, with the watermark's rate as a control, and pairs
   the heatmap with the number that says whether the model is right — accuracy
   on CLEAN images. The planning measurement found the trap the pairing
   avoids: a bright mark lights the fine layer's heatmap WHETHER OR NOT the
   model uses it, because the CAM is weighted by the activations; so a hot
   corner on a watermarked image is never shown without that number.

   DECISIONS, so they are not re-argued (`_lab/gradcam-mock.html`, Kenneth's
   picks 2026-09-15):

    1. THE TASK IS WIDGET 61's CELL AGAINST ITS MEMBRANE ALONE, his pick over
       the DISC / RING pair the catalogue planned, tuned by measurement:
       `model.js`'s header has the numbers and `_lab/gradcam-measure.mjs` the
       eleven variants that did not hold.

    2. THE FIGURE IS HIS DIAGRAM, AS THE NOTEBOOK DRAWS IT (his pick B, revised
       from A the same evening: "it aligns with the notebook diagram").
       Forward along the top — the image, the network, the chosen layer's
       maps, the head, the score — and backward along the bottom, right to
       left: the score's gradient on each map, the averages, the weighted sum,
       ReLU, the heatmap on the image under the image it came from. The gallery
       of widget 61 was drawn as A and is in the mock; it is not here, so this
       widget imports nothing from `depict.js`.

    3. ONE STEP OF FIVE PRESSES, NO GATE. The widget's noun is a step of the
       method and the button names the one it is about to draw, keyed on the
       animation's own counter (4.4b, widget 60's device): Forward pass ·
       Gradients · Average · Weighted sum · ReLU, upsample. Play runs the five
       and stops. The stage opens on the image and the empty diagram (2.1).

    4. THERE IS NO PLANTED SHORTCUT (his call, 2026-09-15, after two rounds of
       one). Every image carries a small orientation marker the model reads as
       nothing; the widget shows Grad-CAM finding the object and not the
       marker. The seed is the one DATA control and retrains in 0.8 s; the
       layer, the class and the test image are DISPLAY and keep the presses.

    6. THE SIGNED SCALE IS ONE SCALE. A gradient map is drawn low-to-high on
       `--c-value-low` → `--c-value-high`; the weighted sum is the same
       scale; ReLU keeps its positive half; and the heatmap on the image is
       that half, so red means the same thing everywhere it appears — raises
       the class score — and the ReLU is visibly the step that drops the blue.

    7. THE GEOMETRY LIVES IN `model.js` (5.8), so `_lab/gradcam-verify.mjs`
       measures the shipping fit and nothing here computes a rectangle.
   ========================================================================= */

import { defineWidget, shapeText, mathmlRenders, readTokens } from "../core/index.js";
import * as M from "./model.js";

/* --- primitives ------------------------------------------------------------ */

const pct = (v) => `${Math.round(100 * v)}%`;
const sgn = (v, d = 3) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : `+${v.toFixed(d)}`);
const easeOut = (t) => 1 - (1 - t) ** 3;

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
const caption = (ctx, colors, s, x, y) =>
  txt(ctx, colors, s, x, y, { color: colors.ink2, weight: "600" });
const note = (ctx, colors, s, x, y, tone, o = {}) =>
  txt(ctx, colors, s, x, y, { color: tone ?? colors.ink3, size: colors.fsXs, ...o });
const label = (ctx, colors, s, x, y, tone) =>
  txt(ctx, colors, s, x, y, { align: "center", mono: true, size: colors.fsXs, color: tone ?? colors.ink2 });

const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

function frame(ctx, x, y, w, h, stroke, width = 1) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
/** a map on the grey ramp, nearest-neighbour, scaled by `max` */
function drawMap(ctx, colors, x, y, size, n, arr, o = {}) {
  const hi = o.max ?? 1;
  const c = size / n;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, size, size);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      ctx.fillStyle = mix(colors.surface2, colors.ink1, arr[j * n + i] / hi);
      ctx.fillRect(x + i * c, y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
  frame(ctx, x, y, size, size, o.frame ?? colors.axis, o.width ?? 1);
}
/** a signed map on one scale: low → surface → high, `hi` the largest magnitude */
function drawSigned(ctx, colors, x, y, size, n, arr, hi, o = {}) {
  const c = size / n;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, size, size);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const v = arr[j * n + i] / (hi || 1);
      ctx.fillStyle = v >= 0
        ? mix(colors.surface2, colors.valueHigh, v)
        : mix(colors.surface2, colors.valueLow, -v);
      ctx.fillRect(x + i * c, y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
  frame(ctx, x, y, size, size, o.frame ?? colors.axis, o.width ?? 1);
}
/** the heatmap on the image: the lesson's own overlay, cold to hot, at half strength */
function drawHeat(ctx, colors, x, y, size, n, img, up, alpha = 1) {
  drawMap(ctx, colors, x, y, size, n, img, { max: Math.max(1, M.maxOf(img)), frame: colors.groupA });
  if (!up || alpha <= 0) return;
  const c = size / n;
  ctx.save();
  ctx.globalAlpha = 0.55 * alpha;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      ctx.fillStyle = mix(colors.valueLow, colors.valueHigh, up[j * n + i]);
      ctx.fillRect(x + i * c, y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 6 * Math.cos(a - 0.4), y1 - 6 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 6 * Math.cos(a + 0.4), y1 - 6 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* --- what the presses have revealed ---------------------------------------- *
 * `n` complete presses and the one in flight at `t`. A step is shown once its
 * press has begun, at the alpha of its progress; everything before it is
 * finished.                                                                    */
function revealOf(anim) {
  const n = anim?.n ?? 0;
  const t = anim?.t ?? 0;
  return {
    n,
    alphaOf: (k) => (k <= n ? 1 : k === n + 1 && t > 0 ? easeOut(t) : 0),
    current: t > 0 ? n + 1 : n,
  };
}

/* --- the diagram -------------------------------------------------------------- */

const CAPTION = (cls, layer, shape) => `Grad-CAM for “${cls}” at ${layer} ${shapeText(shape)}`;
const NOTE = "Forward along the top: the image, the network, the chosen layer's maps, the head, the score. Backward along the bottom.";

function drawDiagram(ctx, colors, w, state, read, params, reveal) {
  const block = M.layerIndex(params.layer);
  const cls = M.classOf(read, params);
  const cam = read.cams[block][cls];
  const b = state.model.net.blocks[block];
  const H = b.H;
  const L = M.diagramLayout(w);
  const at = (k) => reveal.alphaOf(k);
  const tone = (k) => (reveal.current === k ? colors.highlight : colors.ink2);
  const edge = (k) => (reveal.current === k ? colors.highlight : colors.axis);
  const a1 = at(1);

  caption(ctx, colors, CAPTION(M.CLASS_NAMES[cls], M.LAYERS[block], [b.C, H, H]), M.PAD, 24);
  note(ctx, colors, NOTE, M.PAD, 40);

  /* --- forward, left to right ------------------------------------------------ */
  drawMap(ctx, colors, L.img.x, L.img.y, M.IMG, M.S, read.img,
    { max: Math.max(1, M.maxOf(read.img)), frame: colors.groupA });
  note(ctx, colors, "the image", L.img.x, L.img.y + M.IMG + 14);
  arrow(ctx, L.img.x + M.IMG + 4, L.topMid, L.box.x - 4, L.topMid, colors.ink3);
  frame(ctx, L.box.x, L.box.y, M.BOX_W, M.BOX_H, colors.axis);
  txt(ctx, colors, "CNN", L.box.x + M.BOX_W / 2, L.topMid, { align: "center", baseline: "middle", weight: "600", size: colors.fsXs, color: colors.ink2 });
  arrow(ctx, L.box.x + M.BOX_W + 4, L.topMid, L.stack.x - 4, L.topMid, colors.ink3);

  const hiAct = Math.max(...Array.from({ length: M.SHOWN }, (_, c) => M.maxOf(cam.acts.slice(c * H * H, (c + 1) * H * H))));
  for (let c = 0; c < M.SHOWN; c += 1) {
    const y = L.stack.y + c * (M.THUMB + M.VG);
    if (a1 > 0) {
      ctx.save();
      ctx.globalAlpha = a1;
      drawMap(ctx, colors, L.stack.x, y, M.THUMB, H, cam.acts.slice(c * H * H, (c + 1) * H * H),
        { max: hiAct, frame: colors.empirical });
      ctx.restore();
    }
    if (a1 < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - a1;
      frame(ctx, L.stack.x, y, M.THUMB, M.THUMB, colors.grid);
      ctx.restore();
    }
  }
  label(ctx, colors, "Aᵏ", L.stack.x + M.THUMB / 2, L.stack.y - 8, colors.highlight);
  note(ctx, colors, `${M.LAYERS[block]}, 4 of ${b.C}`, L.stack.x - 12, L.stack.y + M.STACK_H + 14, colors.ink2, { mono: true });

  arrow(ctx, L.stack.x + M.THUMB + 4, L.topMid, L.head.x - 4, L.topMid, colors.ink3);
  note(ctx, colors, "GAP · Linear", L.head.x, L.head.y - 8, colors.ink2);
  const hiG = M.maxOf(read.g);
  for (let k = 0; k < M.SHOWN; k += 1) {
    const x = L.head.x + k * (M.CELL + 1);
    if (a1 > 0) {
      ctx.save();
      ctx.globalAlpha = a1;
      ctx.fillStyle = wash(colors.groupB, 0.2 + 0.7 * Math.abs(read.g[k]) / hiG);
      ctx.fillRect(x, L.head.y, M.CELL, M.CELL);
      ctx.restore();
    }
    frame(ctx, x, L.head.y, M.CELL, M.CELL, a1 > 0 ? colors.groupB : colors.grid);
  }
  arrow(ctx, L.head.x + L.headW + 4, L.topMid, L.score.x - 4, L.topMid, colors.ink3);
  /* the score, then the two classes under it — beside it they ran 10px past
     the right margin at 550 (the verify's §4) */
  txt(ctx, colors, "yᶜ", L.score.x, L.topMid - 8, { mono: true, color: colors.ink1, weight: "600" });
  if (a1 > 0) {
    ctx.save();
    ctx.globalAlpha = a1;
    for (let k = 0; k < 2; k += 1) {
      note(ctx, colors, `${M.CLASS_NAMES[k]} ${read.prob[k].toFixed(2)}`, L.score.x, L.topMid + 8 + 14 * k,
        k === read.pred ? colors.ink1 : colors.ink3, { weight: k === read.pred ? "600" : "" });
    }
    ctx.restore();
  }

  /* --- backward, right to left ---------------------------------------------- */
  const a2 = at(2);
  if (a2 > 0) {
    ctx.save();
    ctx.globalAlpha = a2;
    ctx.strokeStyle = tone(2);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L.drop.x, L.drop.y0); ctx.lineTo(L.drop.x, L.drop.y1); ctx.stroke();
    arrow(ctx, L.drop.x, L.botMid, L.grads.x + M.THUMB + 6, L.botMid, tone(2));
    const hiGrad = Math.max(...Array.from({ length: M.SHOWN }, (_, c) => M.maxOf(cam.grads.slice(c * H * H, (c + 1) * H * H))));
    for (let c = 0; c < M.SHOWN; c += 1) {
      const y = L.grads.y + c * (M.THUMB + M.VG);
      drawSigned(ctx, colors, L.grads.x, y, M.THUMB, H, cam.grads.slice(c * H * H, (c + 1) * H * H), hiGrad, { frame: edge(2) });
    }
    label(ctx, colors, "∂yᶜ/∂Aᵏ", L.grads.x + M.THUMB / 2, L.grads.y - 8, tone(2));
    ctx.restore();
  }
  const a3 = at(3);
  if (a3 > 0) {
    ctx.save();
    ctx.globalAlpha = a3;
    for (let c = 0; c < M.SHOWN; c += 1) {
      const y = L.grads.y + c * (M.THUMB + M.VG);
      txt(ctx, colors, sgn(cam.alpha[c]), L.alpha.x + M.ALPHA_W, y + M.THUMB / 2 + 1, {
        align: "right", baseline: "middle", mono: true, size: colors.fsXs,
        color: reveal.current === 3 ? colors.highlight : colors.ink1,
      });
    }
    label(ctx, colors, "αₖ", L.alpha.x + M.ALPHA_W / 2, L.grads.y - 8, tone(3));
    ctx.restore();
  }
  const a4 = at(4);
  if (a4 > 0) {
    ctx.save();
    ctx.globalAlpha = a4;
    arrow(ctx, L.alpha.x - 4, L.botMid, L.sum.x + M.BIG + 4, L.botMid, tone(4));
    drawSigned(ctx, colors, L.sum.x, L.sum.y, M.BIG, H, cam.sum, M.maxOf(cam.sum), { frame: edge(4) });
    label(ctx, colors, "Σ αₖ Aᵏ", L.sum.x + M.BIG / 2, L.sum.y - 8, tone(4));
    ctx.restore();
  }
  const a5 = at(5);
  if (a5 > 0) {
    ctx.save();
    ctx.globalAlpha = a5;
    arrow(ctx, L.sum.x - 4, L.botMid, L.relu.x + M.BIG + 4, L.botMid, tone(5));
    drawSigned(ctx, colors, L.relu.x, L.relu.y, M.BIG, H, cam.cam, 1, { frame: edge(5) });
    label(ctx, colors, "ReLU", L.relu.x + M.BIG / 2, L.relu.y - 8, tone(5));
    arrow(ctx, L.relu.x - 4, L.botMid, L.heat.x + M.IMG + 4, L.botMid, tone(5));
    ctx.restore();
  }
  drawHeat(ctx, colors, L.heat.x, L.heat.y, M.IMG, M.S, read.img, cam.up, a5);

  /* the printed lines under the bottom row: two under the heatmap, two under
     the gradient stack, on the baselines `model.js` reserves (the verify
     measures that neither pair reaches the other) */
  if (a3 > 0) {
    ctx.save();
    ctx.globalAlpha = a3;
    note(ctx, colors, `αₖ: the mean over ${H * H} cells`, L.alpha.x, L.lineY(0), tone(3));
    ctx.restore();
  }
  if (a4 > 0) {
    ctx.save();
    ctx.globalAlpha = a4;
    note(ctx, colors, `the sum is over all ${b.C} maps`, L.alpha.x, L.lineY(1), tone(4));
    ctx.restore();
  }
  if (a5 > 0) {
    ctx.save();
    ctx.globalAlpha = a5;
    note(ctx, colors, `the heatmap: ${H} × ${H}, drawn × ${M.S / H}`, L.heat.x, L.lineY(0), tone(5));
    note(ctx, colors, `${pct(cam.share.object)} on the cell · ${pct(cam.marker)} on the marker`, L.heat.x, L.lineY(1), colors.ink2);
    ctx.restore();
  } else {
    note(ctx, colors, "the heatmap, after ReLU", L.heat.x, L.lineY(0));
  }
}

/* --- the rail's preview of the two classes ------------------------------ */
function paintExample(ctx, k, size) {
  const colors = readTokens();
  const img = M.exampleImage(k);
  const c = size / M.S;
  for (let j = 0; j < M.S; j += 1) {
    for (let i = 0; i < M.S; i += 1) {
      ctx.fillStyle = mix(colors.surface2, colors.ink1, img[j * M.S + i]);
      ctx.fillRect(i * c, j * c, Math.ceil(c), Math.ceil(c));
    }
  }
}

/* --- the formula card ----------------------------------------------------------- */

let cardDone = false;
const GUTTER = "3.2em";
const MATHML = mathmlRenders();
/* the two equations of 06-2 cell 130, as MathML where it renders (widgets 40
   and 51's door) and as the same line in text where it does not */
const EQ = [
  {
    math: "<math style=\"font-size:1.1em\"><mrow><msubsup><mi>α</mi><mi>k</mi><mi>c</mi></msubsup><mo>=</mo>"
      + "<mfrac><mn>1</mn><mi>Z</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><munder><mo>∑</mo><mi>j</mi></munder>"
      + "<mfrac><mrow><mo>∂</mo><msup><mi>y</mi><mi>c</mi></msup></mrow>"
      + "<mrow><mo>∂</mo><msubsup><mi>A</mi><mrow><mi>i</mi><mi>j</mi></mrow><mi>k</mi></msubsup></mrow></mfrac></mrow></math>",
    text: "αₖᶜ = (1 / Z) Σᵢ Σⱼ ∂yᶜ / ∂Aᵏᵢⱼ",
  },
  {
    math: "<math style=\"font-size:1.1em\"><mrow><msup><mi>L</mi><mi>c</mi></msup><mo>=</mo><mi>ReLU</mi><mo>(</mo>"
      + "<munder><mo>∑</mo><mi>k</mi></munder><msubsup><mi>α</mi><mi>k</mi><mi>c</mi></msubsup>"
      + "<msup><mi>A</mi><mi>k</mi></msup><mo>)</mo></mrow></math>",
    text: "Lᶜ = ReLU( Σₖ αₖᶜ Aᵏ )",
  },
];
function renderCard() {
  if (cardDone) return;
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  const host = document.createElement("div");
  host.className = "w-math";
  figure.parentNode.insertBefore(host, figure);
  const cardNote = "yᶜ is the score for class c before softmax, Aᵏ the k-th feature map of the chosen "
    + "layer, and Z its number of cells. αₖᶜ is the weight of map k for class c; ReLU keeps "
    + "the positions that raise the score. The map is upsampled to the image by nearest neighbour.";
  /* ONE ROW, INLINE SIZE. `.w-math-eq` reserves 6.93em for a sum that wraps
     and `.w-math math` scales to 1.45em; two display-size equations stacked
     took 265px and pushed the figure down (Kenneth, 2026-09-15). The two
     short equations share one line at the card's own text size. */
  const eqStyle = "min-height:0;margin:0;display:inline-block;padding-right:2.4em";
  host.innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:baseline;row-gap:4px">`
    + EQ.map((eq) => `<div class="w-math-eq" style="${eqStyle}">${MATHML ? eq.math : eq.text}</div>`).join("")
    + `</div><p class="w-math-note">${cardNote}</p>`;
  cardDone = true;
}

/* ============================== the widget ================================= */

const STEP_LABELS = {
  forward: "Forward pass",
  grads: "Gradients",
  avg: "Average",
  sum: "Weighted sum",
  relu: "ReLU, upsample",
};
const STEP_TITLES = {
  forward: "Run the image through the trained network: the chosen layer's feature maps, the head, the score",
  grads: "Differentiate the class score with respect to each feature map of the chosen layer",
  avg: "Average each gradient map over its cells: one weight a map",
  sum: "Add the feature maps, each weighted by its average gradient",
  relu: "Keep the positive part and draw it on the image",
};

defineWidget({
  slug: "grad-cam",
  status: "shipped",
  title: "Deep Learning - Grad-CAM",
  subtitle:
    "Grad-CAM weights each feature map of one layer by the average gradient of a class "
    + "score on it, adds them and keeps the positive part. The heatmap is a property of "
    + "the model, the layer and the class: a deeper layer gives a coarser map, and the "
    + "other class a different heatmap.",
  layout: "side",
  height: M.STAGE_H,

  params: {
    modelSec: { type: "section", label: "The model" },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    /* the two classes, before the first press (Kenneth, 2026-09-15); the
       figures are held-out images 1 and 2, the ones the Test image control
       opens on */
    classes: {
      type: "preview",
      size: 48,
      items: M.CLASS_NAMES.map((caption) => ({ caption })),
      note: "the two classes the network is trained to tell apart; the L is an orientation marker on every image",
      paint: (ctx, k, size) => paintExample(ctx, k, size),
    },

    heatSec: { type: "section", label: "The heatmap" },
    layer: {
      type: "segmented",
      label: "Layer",
      detail: "the convolutional layer whose feature maps the heatmap is computed from",
      options: M.LAYERS.map((name) => ({ value: name, label: name })),
      default: M.LAYER_DEFAULT,
      display: true,
    },
    cls: {
      type: "segmented",
      label: "Class",
      detail: "the class c whose score yᶜ is differentiated",
      options: [
        { value: "pred", label: "Predicted" },
        { value: "other", label: "The other" },
      ],
      default: "pred",
      display: true,
    },
    image: {
      type: "choice",
      label: "Test image",
      detail: "which of the held-out images the figure is about",
      options: Array.from({ length: M.TEST_SHOWN }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}` })),
      default: "1",
      display: true,
    },
    /* Authoring escape hatch, first render only: how many presses are run. */
    shown: { type: "int", min: 0, max: M.STEPS, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "A feature map the network computed, drawn light to dark", mark: "hollow" },
    { token: "value-high", label: "Raises the class score: a positive gradient, and the heat on the image" },
    { token: "value-low", label: "Lowers the class score: a negative gradient, set to zero by ReLU" },
    { token: "group-a", label: "The image" },
    { token: "group-b", label: "The head: one value a channel" },
    { token: "highlight", label: "The step being drawn" },
  ],

  compute: ({ params, rng }) => {
    const model = M.trainModel(params, rng);
    return { model, readings: M.readings(model), key: M.trainKey(params) };
  },

  animation: {
    stepLabel: { anim: "phase", labels: STEP_LABELS, default: "Forward pass" },
    stepTitle: { anim: "phase", labels: STEP_TITLES, default: STEP_TITLES.forward },
    runLabel: "Play",
    runTitle: "Run the remaining steps of the method in order",

    init: ({ params, fromScratch }) => {
      const n = fromScratch ? 0 : Math.max(0, Math.min(M.STEPS, Number(params.shown) || 0));
      return { n, t: 0, phase: M.PHASES[n], done: n >= M.STEPS };
    },

    advance: (anim, { dt }) => {
      if (anim.n >= M.STEPS) {
        anim.t = 0;
        anim.done = true;
        return false;
      }
      anim.t += dt / M.STEP_MS;
      if (anim.t < 1) return true;
      anim.t = 0;
      anim.n += 1;
      anim.phase = M.PHASES[anim.n];
      anim.done = anim.n >= M.STEPS;
      return anim.mode !== "step" && !anim.done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard();
    drawDiagram(ctx, colors, w, state, M.readOf(state, params), params, revealOf(anim));
  },

  readout({ params, state, anim }) {
    const read = M.readOf(state, params);
    const reveal = revealOf(anim);
    const block = M.layerIndex(params.layer);
    const cls = M.classOf(read, params);
    const cam = read.cams[block][cls];
    const acc = state.model.acc;
    const forward = reveal.n >= 1;
    const done = reveal.n >= M.STEPS;
    return [
      {
        label: "Predicted class",
        value: forward ? `${M.CLASS_NAMES[read.pred]} ${read.prob[read.pred].toFixed(2)}` : "—",
        note: forward
          ? `this image is a ${M.CLASS_NAMES[read.cls].toLowerCase()}`
          : "the forward pass has not run",
      },
      {
        label: "Accuracy on held-out images",
        value: pct(acc.clean),
        note: `${M.N_TEST} held-out images of each class, none in the training set`,
      },
      {
        label: "Heat on the cell · on the marker",
        value: done ? `${pct(cam.share.object)} · ${pct(cam.marker)}` : "—",
        note: done
          ? `the cell is ${pct(cam.share.objectArea)} of the image, the marker's corner ${pct(M.MARKER_AREA)}`
          : "the heatmap has not been drawn",
      },
    ];
  },
});
