/* Neural Network — PHM5005 04-3 § Neural Networks (MLP). Arc A's last slot.
 *
 * A 2 → k → 1 network trained by full-batch gradient descent on the SVM
 * widget's own three generators, so kernels and hidden units answer one
 * visible problem and the arc reads as a single argument. Two panels side by
 * side, both live: the NETWORK, every edge a fitted weight (thickness |w|,
 * colour its sign), and the DECISION BOUNDARY as the class wash with a
 * contour at P = 0.5. A loss strip runs under both. Play trains.
 *
 * compute() trains ONCE and keeps the whole trajectory; the animation
 * reveals epochs already computed, so Play lands exactly on the picture the
 * seed promises (1.4). Nothing is trained per frame.
 *
 * MEASURED (_lab/mlp-design.py, _lab/mlp-mock.html), and the table is why
 * several things here are the way they are. Over 20 inits per cell, and
 * identically under every optimiser tried, the share of runs reaching ≤ 6
 * errors of 180:
 *
 *              k=1    k=2    k=3     k=4     k=8
 *   rings      0/20   0/20   10/20   19/20   20/20
 *   crescents  0/20   0/20    3/20    6/20   17/20
 *
 * Two facts, and NO SURFACE MAY CLAIM "k ≥ 3 works": capacity (one and two
 * units can never close a ring — they draw a line and a wedge) and
 * optimisation (k 3 usually gets stuck; width buys reliability because spare
 * units give gradient descent more ways down). The mechanism is visible in
 * the diagram: a DEAD unit, firing on no sample, drawn in --c-unknown. At
 * the default the ring is closed by three live units and a corpse.
 *
 * The optimiser was chosen on WATCHABILITY alone, since reliability did not
 * separate the candidates: momentum 0.9 at lr 0.05 spreads rings k = 4 over
 * 77 → 32 → 1 → 0 errors at epochs 20/60/150/300, where lr 0.2 is over
 * before epoch 60.
 */

import { defineWidget, fmt, makeRng } from "../core/index.js";
import {
  DOM, SETS, ACTS, K_LADDER, EPOCHS, score, trainAll, deadUnits, unitLine,
} from "./model.js";

/* ---- geometry ------------------------------------------------------------ */

const PAD_X = 12;
const TOP = 20;
const GAP = 16;
const CAP_H = 44;   // the caption row, clear of the loss strip's own label
const LOSS_H = 66;
const BOTTOM = 8;

const INSET = 78;   // the activation inset, in a RESERVED band at the panel's
                    // HEAD — nearest the rail, where the activation is chosen.
                    // It cannot sit under the hidden column: placed there it
                    // landed on the fourth node, and at k = 8 that column runs
                    // the panel's full height with no gap at all.
const HIT_R = 18;   // how close the pointer must come to a hidden unit

const panelSide = (w) => Math.max(150, Math.min(300, (w - 2 * PAD_X - GAP) / 2));
const stageHeight = (w) => TOP + panelSide(w) + CAP_H + LOSS_H + BOTTOM;

/* Where every node sits. ONE function, because the hit test and the drawing
   must agree about it — two copies is how a target comes to sit six columns
   from the thing it selects (5.8). */
function netLayout(x0, y0, side, k) {
  const top = y0 + INSET + 26;
  const usable = side - INSET - 34;
  const yOf = (i, n) => top + usable * ((i + 1) / (n + 1));
  return {
    xIn: x0 + 30,
    xHid: x0 + side / 2,
    xOut: x0 + side - 30,
    yOf,
    labelY: y0 + INSET + 18,
    hidden: Array.from({ length: k }, (_, j) => ({ x: x0 + side / 2, y: yOf(j, k) })),
    insetX: x0 + 6,
    insetY: y0 + 4,
  };
}

/** Which hidden unit the pointer is over, or null. */
function unitAt(pointer, x0, y0, side, k) {
  if (!pointer) return null;
  const L = netLayout(x0, y0, side, k);
  for (let j = 0; j < k; j += 1) {
    if (Math.hypot(pointer.x - L.hidden[j].x, pointer.y - L.hidden[j].y) < HIT_R) return j;
  }
  return null;
}

const f2 = (v) => fmt(v, 2);
const f3 = (v) => fmt(v, 3);

/* ---- drawing ------------------------------------------------------------- */

function label(ctx, colors, s, x, y, { color, align = "left", font } = {}) {
  ctx.save();
  ctx.fillStyle = color ?? colors.ink3;
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* One hidden unit's line, w·x + b = 0 — where it switches on, and under ReLU
   exactly the crease it contributes to the boundary. Clipped by the panel. */
function drawUnitLine(ctx, colors, x0, y0, side, net, j, strong) {
  const { a, b, c } = unitLine(net, j);
  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return;
  const X = (v) => x0 + ((v - DOM[0]) / (DOM[1] - DOM[0])) * side;
  const Y = (v) => y0 + side - ((v - DOM[0]) / (DOM[1] - DOM[0])) * side;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, side, side);
  ctx.clip();
  ctx.strokeStyle = strong ? colors.highlight : colors.ink3;
  ctx.lineWidth = strong ? 2.2 : 1;
  ctx.setLineDash(strong ? [6, 4] : [3, 4]);
  ctx.globalAlpha = strong ? 1 : 0.7;
  ctx.beginPath();
  if (Math.abs(b) > Math.abs(a)) {
    ctx.moveTo(X(DOM[0]), Y(-(a * DOM[0] + c) / b));
    ctx.lineTo(X(DOM[1]), Y(-(a * DOM[1] + c) / b));
  } else {
    ctx.moveTo(X(-(b * DOM[0] + c) / a), Y(DOM[0]));
    ctx.lineTo(X(-(b * DOM[1] + c) / a), Y(DOM[1]));
  }
  ctx.stroke();
  ctx.restore();
}

/* The decision boundary: the wash is the network's CONFIDENCE (the sigmoid),
   which an SVM's decision value could not honestly give; the contour is the
   boundary itself, at P = 0.5, so it can be pointed at. */
function drawBoundary(ctx, colors, x0, y0, side, data, net, actKey, opts) {
  const { f } = ACTS[actKey];
  const { hoverUnit = null, showLines = false, pointer = null, dead = [] } = opts ?? {};
  const X = (v) => x0 + ((v - DOM[0]) / (DOM[1] - DOM[0])) * side;
  const Y = (v) => y0 + side - ((v - DOM[0]) / (DOM[1] - DOM[0])) * side;

  const G = 46;
  const cell = side / G;
  for (let i = 0; i < G; i += 1) {
    const xv = DOM[0] + ((i + 0.5) / G) * (DOM[1] - DOM[0]);
    for (let j = 0; j < G; j += 1) {
      const yv = DOM[0] + ((j + 0.5) / G) * (DOM[1] - DOM[0]);
      const pr = 1 / (1 + Math.exp(-score(net, f, xv, yv)));
      ctx.save();
      ctx.fillStyle = pr > 0.5 ? colors.event : colors.nonevent;
      ctx.globalAlpha = 0.05 + 0.34 * Math.abs(pr - 0.5) * 2;
      ctx.fillRect(x0 + i * cell, y0 + side - (j + 1) * cell, cell + 0.6, cell + 0.6);
      ctx.restore();
    }
  }

  /* the unit lines: all of them on the toggle — the route a lecture screen
     has, since it has no pointer — and the hovered one over the top */
  if (showLines) {
    for (let j = 0; j < net.W2.length; j += 1) {
      if (!dead[j] && j !== hoverUnit) drawUnitLine(ctx, colors, x0, y0, side, net, j, false);
    }
  }

  /* the contour, by marching the sign change along each grid row and column —
     one segment per crossing, which is enough at this resolution and needs no
     marching-squares table */
  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const S = 88;
  const at = (i, j) => score(net, f,
    DOM[0] + (i / S) * (DOM[1] - DOM[0]), DOM[0] + (j / S) * (DOM[1] - DOM[0]));
  for (let i = 0; i <= S; i += 1) {
    for (let j = 0; j < S; j += 1) {
      const a = at(i, j);
      const b = at(i, j + 1);
      if ((a > 0) !== (b > 0)) {
        const t = a / (a - b);
        const yv = DOM[0] + ((j + t) / S) * (DOM[1] - DOM[0]);
        const xv = DOM[0] + (i / S) * (DOM[1] - DOM[0]);
        ctx.moveTo(X(xv) - 1.1, Y(yv));
        ctx.lineTo(X(xv) + 1.1, Y(yv));
      }
      const c = at(j, i);
      const d = at(j + 1, i);
      if ((c > 0) !== (d > 0)) {
        const t = c / (c - d);
        const xv = DOM[0] + ((j + t) / S) * (DOM[1] - DOM[0]);
        const yv = DOM[0] + (i / S) * (DOM[1] - DOM[0]);
        ctx.moveTo(X(xv), Y(yv) - 1.1);
        ctx.lineTo(X(xv), Y(yv) + 1.1);
      }
    }
  }
  ctx.stroke();
  ctx.restore();

  for (const s of data) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(X(s.x[0]), Y(s.x[1]), 2.7, 0, Math.PI * 2);
    ctx.fillStyle = s.y > 0 ? colors.event : colors.nonevent;
    if (hoverUnit !== null) ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.restore();
  }

  if (hoverUnit !== null && !dead[hoverUnit]) {
    drawUnitLine(ctx, colors, x0, y0, side, net, hoverUnit, true);
  }

  /* the pointer's own reading: the wash is a probability, and this says so */
  if (pointer && pointer.x >= x0 && pointer.x <= x0 + side
      && pointer.y >= y0 && pointer.y <= y0 + side) {
    const xv = DOM[0] + ((pointer.x - x0) / side) * (DOM[1] - DOM[0]);
    const yv = DOM[0] + ((y0 + side - pointer.y) / side) * (DOM[1] - DOM[0]);
    const pr = 1 / (1 + Math.exp(-score(net, f, xv, yv)));
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pointer.x - 8, pointer.y);
    ctx.lineTo(pointer.x + 8, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 8);
    ctx.lineTo(pointer.x, pointer.y + 8);
    ctx.stroke();
    const txt = `P = ${f3(pr)}`;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    const tw = ctx.measureText(txt).width + 10;
    const bx = Math.min(pointer.x + 10, x0 + side - tw - 2);
    const by = Math.max(y0 + 14, pointer.y - 10);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(bx, by - 11, tw, 15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.ink1;
    ctx.fillText(txt, bx + 5, by);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(x0, y0, side, side);
  ctx.restore();
}

/* THE ACTIVATION, SHOWN RATHER THAN NAMED: "Identity | ReLU | tanh" is three
   words and no picture, and the shape is the whole idea — a diagonal, a
   hinge, an S. The rug under it is the z values the hidden units ACTUALLY
   receive on this data at this epoch, so it spreads as training runs and a
   unit whose inputs slide entirely into ReLU's flat half is a dead unit being
   born. That is the animation: it rides Play and needs no state of its own.
   (A crossfade between activations was designed and dropped — changing the
   activation is a data change, which resets training, so there is no figure
   standing still for a crossfade to happen on.) */
function drawActivationInset(ctx, colors, x, y, size, actKey, zs) {
  const { f } = ACTS[actKey];
  const Z = 2.4;
  const X = (z) => x + ((z + Z) / (2 * Z)) * size;
  const Y = (v) => y + size / 2 - (v / Z) * (size / 2);

  ctx.save();
  ctx.fillStyle = colors.surface;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(x, y, size, size);
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x, Y(0));
  ctx.lineTo(x + size, Y(0));
  ctx.moveTo(X(0), y);
  ctx.lineTo(X(0), y + size);
  ctx.stroke();
  ctx.restore();

  if (zs && zs.length) {
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (const z of zs) {
      const zx = X(Math.max(-Z, Math.min(Z, z)));
      ctx.moveTo(zx, y + size - 1);
      ctx.lineTo(zx, y + size - 6);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 80; i += 1) {
    const z = -Z + (i / 80) * 2 * Z;
    const v = Math.max(-Z, Math.min(Z, f(z)));
    if (i === 0) ctx.moveTo(X(z), Y(v));
    else ctx.lineTo(X(z), Y(v));
  }
  ctx.stroke();
  ctx.restore();

  label(ctx, colors, ACTS[actKey].label, x + 4, y + 11, { color: colors.ink2 });

  /* the axes named, because "a curve" is not self-explanatory: what goes in
     is a unit's weighted sum, what comes out is what it passes on */
  label(ctx, colors, "output ↑", x + size + 10, y + 14, { color: colors.ink2 });
  label(ctx, colors, "against input →", x + size + 10, y + 28, { color: colors.ink2 });
  if (zs && zs.length) {
    label(ctx, colors, "the ticks are the inputs", x + size + 10, y + 48);
    label(ctx, colors, "these units actually receive", x + size + 10, y + 61);
  }
}

/* One edge per weight: THICKNESS IS |w| scaled to the largest weight in this
   network, never to a constant — the picture is a comparison inside one net,
   and a fixed scale would make a well-trained small network look empty beside
   a wide one. Colour is the sign. */
function drawNetwork(ctx, colors, x0, y0, side, net, fires, actKey, opts) {
  const k = net.W2.length;
  const { hoverUnit = null, zs = null } = opts ?? {};
  const L = netLayout(x0, y0, side, k);
  const dead = deadUnits(fires, actKey);
  const max = Math.max(...[...net.W1.flat(), ...net.W2].map(Math.abs), 1e-6);

  const edge = (ax, ay, bx, by, w, j) => {
    const t = Math.abs(w) / max;
    const muted = hoverUnit !== null && hoverUnit !== j;
    ctx.save();
    ctx.lineWidth = 0.4 + 3.4 * t;
    ctx.globalAlpha = dead[j] ? 0.16 : (muted ? 0.12 : 0.25 + 0.6 * t);
    ctx.strokeStyle = dead[j] ? colors.unknown : (w >= 0 ? colors.event : colors.nonevent);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  };

  for (let j = 0; j < k; j += 1) {
    const hy = L.yOf(j, k);
    for (let i = 0; i < 2; i += 1) edge(L.xIn, L.yOf(i, 2), L.xHid, hy, net.W1[j][i], j);
    edge(L.xHid, hy, L.xOut, L.yOf(0, 1), net.W2[j], j);
  }

  const node = (x, y, r, text, ring) => {
    ctx.save();
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = ring ?? colors.ink3;
    ctx.lineWidth = ring ? 2 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (text) {
      ctx.fillStyle = colors.ink2;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  };

  const usable = side - INSET - 34;
  const rNode = Math.max(5, Math.min(10, usable / (k * 2.6)));
  node(L.xIn, L.yOf(0, 2), 11, "x₁");
  node(L.xIn, L.yOf(1, 2), 11, "x₂");
  for (let j = 0; j < k; j += 1) {
    node(L.xHid, L.yOf(j, k), hoverUnit === j ? rNode + 2 : rNode, "",
      hoverUnit === j ? colors.highlight : (dead[j] ? colors.unknown : null));
  }
  node(L.xOut, L.yOf(0, 1), 12, "P");

  label(ctx, colors, "inputs", L.xIn, L.labelY, { align: "center" });
  label(ctx, colors, `${k} hidden ${k === 1 ? "unit" : "units"}`, L.xHid, L.labelY,
    { align: "center" });
  label(ctx, colors, "output", L.xOut, L.labelY, { align: "center" });

  drawActivationInset(ctx, colors, L.insetX, L.insetY, INSET, actKey, zs);
}

function drawLoss(ctx, colors, x0, y0, w, h, losses, upto) {
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(x0, y0, w, h);
  ctx.restore();
  const max = Math.max(...losses, 1e-9);
  const LX = (ep) => x0 + (ep / EPOCHS) * w;
  const LY = (l) => y0 + h - (l / max) * (h - 8) - 4;
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let ep = 0; ep <= upto; ep += 1) {
    const x = LX(ep);
    const y = LY(losses[ep]);
    if (ep === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  label(ctx, colors, "training loss", x0 + 4, y0 - 4);
  label(ctx, colors, `epoch ${upto} of ${EPOCHS}`, x0 + w, y0 - 4, { align: "right" });
}

/* ---- the reroll, a MOMENTARY pill (widget 34/35's arrangement) ------------
   Pressing it advances `init` and releases itself, both through the exported
   setParam, so the lasting record in the URL is the starting weights alone.
   `init` is a SEPARATE seed from `seed`: the data must hold still while the
   starting weights change, or the reader cannot tell which of the two moved
   the boundary. */
let widgetApi = null;
const INIT_MAX = 200;

function rerollInit() {
  if (!widgetApi || !widgetApi.params.reroll) return;
  const next = (Number(widgetApi.params.init) % INIT_MAX) + 1;
  widgetApi.setParam("init", next);
  widgetApi.setParam("reroll", false);
}

/* ========================================================================== */

widgetApi = defineWidget({
  slug: "mlp",
  title: "Neural Network",
  status: "draft",
  subtitle:
    "We can classify by bending a boundary until it fits. A neural network "
    + "builds that boundary from hidden units, one straight piece each, and "
    + "training is what bends them into place.",
  layout: "side",
  /* the hover inspector. Core's rule comes with it: an inspector must stay
     ADDITIVE, because a lecture screen has no pointer — so everything hover
     reveals has a second route (the unit lines have their own toggle, and
     every number it prints is in the readout or the caption). */
  pointer: true,

  height: ({ w }) => stageHeight(w),

  params: {
    dataset: {
      type: "segmented",
      label: "Data",
      options: [
        { value: "blobs", label: "Two blobs", detail: "a straight line already separates these" },
        { value: "rings", label: "Rings", detail: "one class surrounds the other" },
        { value: "moons", label: "Crescents", detail: "two interleaving arcs" },
      ],
      default: "rings",
    },

    net: { type: "section", label: "The network" },

    hidden: {
      type: "choice",
      label: "Hidden units",
      detail: "each one contributes a straight piece the boundary is bent from",
      options: K_LADDER.map((k) => ({ value: String(k), label: String(k) })),
      default: "4",
    },
    activation: {
      type: "segmented",
      label: "Activation",
      options: [
        { value: "identity", label: "Identity", detail: "no bend — the layers collapse to one line" },
        { value: "relu", label: "ReLU", detail: "the notebook's default" },
        { value: "tanh", label: "tanh", detail: "the smooth cousin" },
      ],
      default: "relu",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* The starting weights, kept apart from `seed` so the data holds still
       while they change. Hidden because the VALUE means nothing to a reader —
       what matters is trying another, which the pill below does. */
    init: { type: "int", min: 1, max: INIT_MAX, default: 1, hidden: true },
    reroll: {
      type: "bool",
      style: "pill",
      label: "New starting weights",
      detail: "the same data, a different random start — training begins again",
      default: false,
      display: true,
    },

    /* The pointer route to one unit's line exists too, but a projector has no
       pointer: this is the route that does not need one (core's rule). */
    lines: {
      type: "bool",
      label: "Show each unit's line",
      detail: "where each hidden unit switches on — the pieces the boundary is bent from",
      default: false,
      display: true,
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "Slow" },
        { value: "medium", label: "Medium" },
        { value: "fast", label: "Fast" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: EPOCHS, default: 0, hidden: true },
  },

  legend: ({ params }) => [
    { token: "event", label: "One class, and a weight that pushes toward it", mark: "dot" },
    { token: "nonevent", label: "The other class, and a weight that pushes toward it", mark: "dot" },
    ...(params.activation === "relu"
      ? [{ token: "unknown", label: "A dead unit — it fires on no sample", mark: "dot" }]
      : []),
    ...(params.lines
      ? [{ token: "reference", label: "Where a hidden unit switches on", mark: "line" }]
      : []),
    { token: "highlight", label: "Training loss", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const data = SETS[params.dataset].make(rng);
    const k = Number(params.hidden);
    /* the starting weights ride their OWN seeded stream, so rerolling them
       leaves every sample exactly where it was */
    const run = trainAll(data, k, params.activation, makeRng(Number(params.init)));
    return { data, k, ...run };
  },

  animation: {
    stepLabel: "Next epoch",
    stepTitle: "Take one gradient-descent step and redraw the boundary",
    runLabel: "Train",
    runTitle: "Run gradient descent, bending the boundary as the loss falls",

    init: ({ params, fromScratch }) => ({
      epoch: fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), EPOCHS),
      done: false,
    }),

    advance: (anim, { dt, params }) => {
      const perSec = { slow: 60, medium: 200, fast: 600 }[params.speed] ?? 200;
      const target = anim.mode === "step"
        ? Math.min(EPOCHS, anim.epoch + 1)
        : EPOCHS;
      const rate = anim.mode === "step" ? 999 : (perSec * dt) / 1000;
      anim.epoch = Math.min(target, anim.epoch + Math.max(1, Math.round(rate)));
      if (anim.epoch >= EPOCHS) {
        anim.epoch = EPOCHS;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* display changes land here; the pill is the only one that does anything */
    rebuild: (anim, { params }) => {
      if (params.reroll) rerollInit();
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const ep = Math.min(anim?.epoch ?? 0, EPOCHS);
    const net = state.frames[ep];
    const fires = state.live[ep];
    const side = panelSide(w);
    const xNet = PAD_X;
    const xBnd = PAD_X + side + GAP;
    const dead = deadUnits(fires, params.activation);
    const hoverUnit = unitAt(pointer, xNet, TOP, side, state.k);

    /* the z values the hidden units actually receive at THIS epoch — the rug
       under the activation inset, so it spreads as the weights grow */
    const zs = [];
    for (const p of state.data) {
      for (let j = 0; j < state.k; j += 1) {
        zs.push(net.W1[j][0] * p.x[0] + net.W1[j][1] * p.x[1] + net.b1[j]);
      }
    }

    drawNetwork(ctx, colors, xNet, TOP, side, net, fires, params.activation,
      { hoverUnit, zs });
    drawBoundary(ctx, colors, xBnd, TOP, side, state.data, net, params.activation,
      { hoverUnit, showLines: Boolean(params.lines), pointer, dead });

    /* the dead-unit caption — the mechanism behind the hidden-units ladder,
       and nothing else on screen would tell the reader it happened */
    const deadN = dead.filter(Boolean).length;
    const capY = TOP + side + 16;
    if (hoverUnit !== null) {
      const wj = net.W1[hoverUnit];
      const detail = `w = (${f2(wj[0])}, ${f2(wj[1])}), bias ${f2(net.b1[hoverUnit])}`;
      label(ctx, colors,
        dead[hoverUnit]
          ? `Unit ${hoverUnit + 1} is dead — it fires on no sample. ${detail}`
          : `Unit ${hoverUnit + 1} fires on ${fires[hoverUnit]} of ${state.data.length}. ${detail}`,
        xNet, capY, { color: colors.ink2 });
    } else if (deadN > 0) {
      label(ctx, colors,
        deadN === 1
          ? "One unit is dead: it fires on no sample, so it adds nothing"
          : `${deadN} units are dead: they fire on no sample, so they add nothing`,
        xNet, capY, { color: colors.ink2 });
    } else if (params.activation === "identity") {
      label(ctx, colors, "Identity: every layer is linear, so the whole network is one line",
        xNet, capY, { color: colors.ink2 });
    }
    label(ctx, colors, `${state.errors[ep]} of ${state.data.length} misclassified`,
      xBnd + side, capY, { align: "right", color: colors.ink2 });

    drawLoss(ctx, colors, PAD_X, TOP + side + CAP_H, w - 2 * PAD_X, LOSS_H, state.losses, ep);
  },

  readout: ({ params, state, anim }) => {
    const ep = Math.min(anim?.epoch ?? 0, EPOCHS);
    const deadN = deadUnits(state.live[ep], params.activation).filter(Boolean).length;
    return [
      {
        label: "Epoch",
        value: String(ep),
        note: ep === 0 ? "before training — the weights are random" : `of ${EPOCHS}`,
      },
      {
        label: "Training loss",
        value: f3(state.losses[ep]),
        note: "cross-entropy, averaged over the sample",
      },
      {
        label: "Misclassified",
        value: `${state.errors[ep]} of ${state.data.length}`,
        note: "on the data the network was trained on",
      },
      /* only under ReLU, where a silent unit is a real thing (see deadUnits) */
      ...(params.activation === "relu"
        ? [{
          label: "Live units",
          value: `${state.k - deadN} of ${state.k}`,
          note: deadN ? "the rest fire on no sample" : "every unit fires on some sample",
        }]
        : []),
    ];
  },
});
