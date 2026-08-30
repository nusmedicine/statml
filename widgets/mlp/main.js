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

/* ---- the stage: widget 16's generators, shapes unchanged ---------------- */

const N_PER_CLASS = 90;
const DOM = [-2.6, 2.6];

const SETS = {
  blobs: {
    label: "Two blobs",
    make(rng) {
      const out = [];
      for (const y of [-1, 1]) {
        const cx = y * 0.95;
        const cy = y * 0.8;
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          out.push({ x: [rng.normal(cx, 0.42), rng.normal(cy, 0.42)], y });
        }
      }
      return out;
    },
  },
  rings: {
    label: "Rings",
    make(rng) {
      const out = [];
      for (const [y, r] of [[-1, 0.75], [1, 1.72]]) {
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          const t = rng.uniform(0, Math.PI * 2);
          out.push({
            x: [r * Math.cos(t) + rng.normal(0, 0.12), r * Math.sin(t) + rng.normal(0, 0.12)],
            y,
          });
        }
      }
      return out;
    },
  },
  moons: {
    label: "Crescents",
    /* the upper arc is +1, widget 16's own arrangement */
    make(rng) {
      const out = [];
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x: [1.25 * (Math.cos(t) - 0.5) + rng.normal(0, 0.11),
            1.25 * (Math.sin(t) - 0.25) + rng.normal(0, 0.11)],
          y: 1,
        });
      }
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x: [1.25 * (0.5 - Math.cos(t)) + rng.normal(0, 0.11),
            1.25 * (0.25 - Math.sin(t)) + rng.normal(0, 0.11)],
          y: -1,
        });
      }
      return out;
    },
  },
};

/* ---- the engine ---------------------------------------------------------- */

const ACTS = {
  identity: { label: "Identity", f: (z) => z, df: () => 1 },
  relu: { label: "ReLU", f: (z) => Math.max(0, z), df: (z) => (z > 0 ? 1 : 0) },
  tanh: { label: "tanh", f: Math.tanh, df: (z) => 1 - Math.tanh(z) ** 2 },
};

const K_LADDER = [1, 2, 3, 4, 8];
const EPOCHS = 600;
const LR = 0.05;
const MOMENTUM = 0.9;

function initNet(k, rng) {
  const r1 = 1 / Math.sqrt(2);
  const r2 = 1 / Math.sqrt(k);
  const W1 = [];
  const b1 = [];
  const W2 = [];
  for (let j = 0; j < k; j += 1) {
    W1.push([rng.uniform(-r1, r1), rng.uniform(-r1, r1)]);
    b1.push(rng.uniform(-r1, r1));
    W2.push(rng.uniform(-r2, r2));
  }
  return { W1, b1, W2, b2: rng.uniform(-r2, r2) };
}

const cloneNet = (p) => ({
  W1: p.W1.map((w) => w.slice()), b1: p.b1.slice(), W2: p.W2.slice(), b2: p.b2,
});

/** The network's score at one point: positive predicts the +1 class. */
function score(p, f, x0, x1) {
  let z = p.b2;
  for (let j = 0; j < p.W2.length; j += 1) {
    z += p.W2[j] * f(p.W1[j][0] * x0 + p.W1[j][1] * x1 + p.b1[j]);
  }
  return z;
}

/**
 * Train, keeping every epoch's weights. The trajectory is the animation's
 * data — nothing is trained per frame (1.4).
 */
function trainAll(data, k, actKey, rng) {
  const { f, df } = ACTS[actKey];
  const p = initNet(k, rng);
  const v = {
    W1: p.W1.map(() => [0, 0]), b1: p.b1.map(() => 0), W2: p.W2.map(() => 0), b2: 0,
  };
  const n = data.length;
  const frames = [cloneNet(p)];
  const losses = [];
  const errors = [];
  const live = [];

  const measure = (net) => {
    let wrong = 0;
    const fires = new Array(k).fill(0);
    for (const s of data) {
      if ((score(net, f, s.x[0], s.x[1]) > 0) !== (s.y > 0)) wrong += 1;
      for (let j = 0; j < k; j += 1) {
        if (net.W1[j][0] * s.x[0] + net.W1[j][1] * s.x[1] + net.b1[j] > 0) fires[j] += 1;
      }
    }
    return { wrong, fires };
  };
  let m = measure(p);
  errors.push(m.wrong);
  live.push(m.fires);

  for (let ep = 1; ep <= EPOCHS; ep += 1) {
    const gW1 = p.W1.map(() => [0, 0]);
    const gb1 = p.b1.map(() => 0);
    const gW2 = p.W2.map(() => 0);
    let gb2 = 0;
    let loss = 0;
    for (const s of data) {
      const y = s.y > 0 ? 1 : 0;
      const z1 = [];
      const h = [];
      let z2 = p.b2;
      for (let j = 0; j < k; j += 1) {
        const z = p.W1[j][0] * s.x[0] + p.W1[j][1] * s.x[1] + p.b1[j];
        z1.push(z);
        const hv = f(z);
        h.push(hv);
        z2 += p.W2[j] * hv;
      }
      const out = 1 / (1 + Math.exp(-z2));
      loss += -(y * Math.log(out + 1e-12) + (1 - y) * Math.log(1 - out + 1e-12));
      const d2 = (out - y) / n;
      gb2 += d2;
      for (let j = 0; j < k; j += 1) {
        gW2[j] += d2 * h[j];
        const d1 = d2 * p.W2[j] * df(z1[j]);
        gW1[j][0] += d1 * s.x[0];
        gW1[j][1] += d1 * s.x[1];
        gb1[j] += d1;
      }
    }
    losses.push(loss / n);
    for (let j = 0; j < k; j += 1) {
      v.W1[j][0] = MOMENTUM * v.W1[j][0] - LR * gW1[j][0];
      v.W1[j][1] = MOMENTUM * v.W1[j][1] - LR * gW1[j][1];
      v.b1[j] = MOMENTUM * v.b1[j] - LR * gb1[j];
      v.W2[j] = MOMENTUM * v.W2[j] - LR * gW2[j];
      p.W1[j][0] += v.W1[j][0];
      p.W1[j][1] += v.W1[j][1];
      p.b1[j] += v.b1[j];
      p.W2[j] += v.W2[j];
    }
    v.b2 = MOMENTUM * v.b2 - LR * gb2;
    p.b2 += v.b2;

    frames.push(cloneNet(p));
    m = measure(p);
    errors.push(m.wrong);
    live.push(m.fires);
  }
  /* the loss at the final weights, so every epoch index has one */
  losses.push(losses[losses.length - 1]);
  return { frames, losses, errors, live };
}

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

/* DEADNESS IS A ReLU PHENOMENON AND NOTHING ELSE. A ReLU unit whose input is
   negative on every sample outputs zero on every sample, so it contributes
   nothing and its gradient is zero — it cannot recover. An identity or tanh
   unit is never silent: tanh(z) and z are non-zero for z < 0, so the same
   count would be a fact about a sign rather than about contribution. The
   sweep caught this claiming "7 of 8 live" under Identity, which was false.
   `deadUnits` is therefore the ONE place the rule lives (5.8). */
const deadUnits = (fires, actKey) =>
  (actKey === "relu" ? fires.map((c) => c === 0) : fires.map(() => false));

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
