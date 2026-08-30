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

import { defineWidget, fmt } from "../core/index.js";
import {
  DOM, SETS, ACTS, K_LADDER, EPOCHS, score, trainAll, deadUnits,
} from "./model.js";

/* ---- geometry ------------------------------------------------------------ */

const PAD_X = 12;
const TOP = 20;
const GAP = 16;
const CAP_H = 44;   // the caption row, clear of the loss strip's own label
const LOSS_H = 66;
const BOTTOM = 8;

const panelSide = (w) => Math.max(150, Math.min(300, (w - 2 * PAD_X - GAP) / 2));
const stageHeight = (w) => TOP + panelSide(w) + CAP_H + LOSS_H + BOTTOM;

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

/* The decision boundary: the wash is the network's CONFIDENCE (the sigmoid),
   which an SVM's decision value could not honestly give; the contour is the
   boundary itself, at P = 0.5, so it can be pointed at. */
function drawBoundary(ctx, colors, x0, y0, side, data, net, actKey) {
  const { f } = ACTS[actKey];
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
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(x0, y0, side, side);
  ctx.restore();
}

/* One edge per weight: THICKNESS IS |w| scaled to the largest weight in this
   network, never to a constant — the picture is a comparison inside one net,
   and a fixed scale would make a well-trained small network look empty beside
   a wide one. Colour is the sign. */
function drawNetwork(ctx, colors, x0, y0, side, net, fires, actKey) {
  const k = net.W2.length;
  const xIn = x0 + 30;
  const xHid = x0 + side / 2;
  const xOut = x0 + side - 30;
  const top = y0 + 20;
  const usable = side - 34;
  const yOf = (i, n) => top + usable * ((i + 1) / (n + 1));
  const dead = deadUnits(fires, actKey);

  const all = [...net.W1.flat(), ...net.W2];
  const max = Math.max(...all.map(Math.abs), 1e-6);

  const edge = (ax, ay, bx, by, w, faded) => {
    const t = Math.abs(w) / max;
    ctx.save();
    ctx.lineWidth = 0.4 + 3.4 * t;
    ctx.globalAlpha = faded ? 0.16 : 0.25 + 0.6 * t;
    ctx.strokeStyle = faded ? colors.unknown : (w >= 0 ? colors.event : colors.nonevent);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  };

  for (let j = 0; j < k; j += 1) {
    const hy = yOf(j, k);
    for (let i = 0; i < 2; i += 1) edge(xIn, yOf(i, 2), xHid, hy, net.W1[j][i], dead[j]);
    edge(xHid, hy, xOut, yOf(0, 1), net.W2[j], dead[j]);
  }

  const node = (x, y, r, text, ring) => {
    ctx.save();
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = ring ?? colors.ink3;
    ctx.lineWidth = ring ? 1.8 : 1;
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

  const rNode = Math.max(5, Math.min(10, usable / (k * 2.6)));
  node(xIn, yOf(0, 2), 11, "x₁");
  node(xIn, yOf(1, 2), 11, "x₂");
  for (let j = 0; j < k; j += 1) {
    node(xHid, yOf(j, k), rNode, "", dead[j] ? colors.unknown : null);
  }
  node(xOut, yOf(0, 1), 12, "P");

  label(ctx, colors, "inputs", xIn, y0 + 12, { align: "center" });
  label(ctx, colors, `${k} hidden ${k === 1 ? "unit" : "units"} · ${ACTS[actKey].label}`,
    xHid, y0 + 12, { align: "center" });
  label(ctx, colors, "output", xOut, y0 + 12, { align: "center" });
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

/* ========================================================================== */

defineWidget({
  slug: "mlp",
  title: "Neural Network",
  status: "draft",
  subtitle:
    "We can classify by bending a boundary until it fits. A neural network "
    + "builds that boundary from hidden units, one straight piece each, and "
    + "training is what bends them into place.",
  layout: "side",

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
    },

    shown: { type: "int", min: 0, max: EPOCHS, default: 0, hidden: true },
  },

  legend: ({ params }) => [
    { token: "event", label: "One class, and a weight that pushes toward it", mark: "dot" },
    { token: "nonevent", label: "The other class, and a weight that pushes toward it", mark: "dot" },
    ...(params.activation === "relu"
      ? [{ token: "unknown", label: "A dead unit — it fires on no sample", mark: "dot" }]
      : []),
    { token: "highlight", label: "Training loss", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const data = SETS[params.dataset].make(rng);
    const k = Number(params.hidden);
    const run = trainAll(data, k, params.activation, rng);
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
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const ep = Math.min(anim?.epoch ?? 0, EPOCHS);
    const net = state.frames[ep];
    const fires = state.live[ep];
    const side = panelSide(w);
    const xNet = PAD_X;
    const xBnd = PAD_X + side + GAP;

    drawNetwork(ctx, colors, xNet, TOP, side, net, fires, params.activation);
    drawBoundary(ctx, colors, xBnd, TOP, side, state.data, net, params.activation);

    /* the dead-unit caption — the mechanism behind the hidden-units ladder,
       and nothing else on screen would tell the reader it happened */
    const deadN = deadUnits(fires, params.activation).filter(Boolean).length;
    const capY = TOP + side + 16;
    if (deadN > 0) {
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
