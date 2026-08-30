/* Neural Network — PHM5005 04-3 § Neural Networks (MLP). Arc A's last slot.
 *
 * A 2 → k → 1 network trained by full-batch gradient descent, on the same
 * three generators the SVM widget uses. Two panels, both live: the network,
 * every edge a fitted weight (thickness |w|, colour its sign), and the
 * decision boundary as a class wash with a contour at P = 0.5. A loss strip
 * runs under both. Play trains.
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
 * Two facts, and no surface may claim "k ≥ 3 works": capacity (one and two
 * units cannot close a ring — they produce a line and a wedge) and
 * optimisation (k 3 usually converges to a local minimum; extra units make
 * the optimisation more reliable, not only the model more expressive). The
 * mechanism is visible in the diagram as a dead unit — one that activates on
 * no sample — drawn in --c-unknown. At the default, three of the four units
 * are live.
 *
 * The optimiser was chosen on how much of the training stays visible, since
 * reliability did not separate the candidates: momentum 0.9 at lr 0.05
 * spreads rings k = 4 over 77 → 32 → 1 → 0 errors at epochs 20/60/150/300,
 * where lr 0.2 has converged before epoch 60.
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

const INSET = 92;   // the activation inset, in a RESERVED band at the panel's
                    // HEAD — nearest the rail, where the activation is chosen.
                    // It cannot sit under the hidden column: placed there it
                    // landed on the fourth node, and at k = 8 that column runs
                    // the panel's full height with no gap at all.
const HIT_R = 18;   // how close the pointer must come to a hidden unit
const BAND_GAP = 16;   // air and a hairline between the band and the network

/* One training step, choreographed, at Slow speed only. The beats are shares
   of BEAT_MS: a sample travels forward, its prediction is compared with the
   label, the error travels back, and the weights move.

   THE WIDGET TRAINS FULL-BATCH, so the sample shown is one of the whole set
   and the weights move once all of them have been through. The caption says
   exactly that — the animation illustrates the trip every sample makes, and
   must not imply the weights move per sample. */
const BEAT_MS = 2000;
const BEATS = { forward: 0.34, compare: 0.52, backward: 0.84, update: 1 };

/* Only the boundary has to be square — it plots x1 against x2, and a
   distance needs equal units per pixel — so the network takes whatever is
   left. Equal halves capped at 300 left dead canvas at every wide frame. */
const boundSide = (w) => {
  const avail = w - 2 * PAD_X - GAP;
  return Math.max(180, Math.min(340, avail * 0.46));
};
const netWidth = (w) => w - 2 * PAD_X - GAP - boundSide(w);
const stageHeight = (w) => TOP + boundSide(w) + CAP_H + LOSS_H + BOTTOM;

/* Where every node sits: one function, because the hit test and the drawing
   have to agree about it (5.8). */
function netLayout(x0, y0, w, h, k) {
  const top = y0 + INSET + BAND_GAP + 26;
  const usable = h - INSET - BAND_GAP - 34;
  const yOf = (i, n) => top + usable * ((i + 1) / (n + 1));
  return {
    xIn: x0 + 34,
    xHid: x0 + w / 2,
    xOut: x0 + w - 34,
    yOf,
    labelY: y0 + INSET + BAND_GAP + 18,
    dividerY: y0 + INSET + BAND_GAP / 2,
    hidden: Array.from({ length: k }, (_, j) => ({ x: x0 + w / 2, y: yOf(j, k) })),
  };
}

function unitAt(pointer, x0, y0, w, h, k) {
  if (!pointer) return null;
  const L = netLayout(x0, y0, w, h, k);
  for (let j = 0; j < k; j += 1) {
    if (Math.hypot(pointer.x - L.hidden[j].x, pointer.y - L.hidden[j].y) < HIT_R) return j;
  }
  return null;
}

const f2 = (v) => fmt(v, 2);
const f3 = (v) => fmt(v, 3);
/* weight steps run from ~1e-5 early to ~1e-2 later, so a fixed number of
   decimals prints 0.0000 for the first ones */
const fSig = (v) => (v === 0 ? "0" : Number(v.toPrecision(2)).toString());

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

/* The decision boundary. The wash is the predicted probability, which an
   SVM's decision value could not give; the contour is the boundary itself,
   at P = 0.5. */
function drawBoundary(ctx, colors, x0, y0, side, data, net, actKey, opts) {
  const { f } = ACTS[actKey];
  const { hoverUnit = null, showLines = false, pointer = null, dead = [], mark = null } = opts ?? {};
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

  if (mark) {
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(mark.x[0]), Y(mark.x[1]), 6.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* the reading under the pointer: what makes the wash a quantity */
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

/* One hidden unit, magnified, in the band at the panel's head, with its
   parts on the network's own columns so it sits above the units it stands
   for. The inputs are written generically, x1 … xn, because a unit's
   arithmetic does not depend on there being two of them.

   The rug under the curve is the pre-activations the units receive at this
   epoch; it spreads as the weights grow, and a unit whose inputs move
   entirely into ReLU's flat region is a dead one. A crossfade between
   activations was dropped: changing the activation is a data change, which
   resets training, so no figure stands still for it. */
function drawNeuron(ctx, colors, x0, y0, w, k, actKey, zs) {
  const L = netLayout(x0, y0, w, 0, k);
  /* The sum and the output sit on the network's columns, so the magnified
     unit stands above the units it explains. The INPUTS do not: aligning
     them to the input column left a long empty run before the arrows, and
     nothing is learned from an x1 lining up with an x1. */
  const inX = L.xHid - Math.max(70, Math.min(110, (L.xHid - x0) * 0.5));
  const mid = y0 + 22 + 33;
  const box = Math.max(30, Math.min(66, L.xOut - L.xHid - 46));
  const boxX = L.xHid + 22;
  const boxTop = mid - box / 2;

  label(ctx, colors, "Inside one hidden unit", x0 + 4, y0 + 11, { color: colors.ink2 });

  const arrow = (ax, ay, bx, by) => {
    ctx.save();
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const a = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 5 * Math.cos(a - 0.4), by - 5 * Math.sin(a - 0.4));
    ctx.lineTo(bx - 5 * Math.cos(a + 0.4), by - 5 * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fillStyle = colors.ink3;
    ctx.fill();
    ctx.restore();
  };

  /* only the outer arrows carry a weight label: they converge on the sum,
     so a label on each would sit a few pixels from its neighbour */
  const rows = [
    { t: "x₁", w: "w₁", dy: -22 },
    { t: "x₂", w: "", dy: -8 },
    { t: "⋮", w: "", dy: 7 },
    { t: "xₙ", w: "wₙ", dy: 22 },
  ];
  for (const r of rows) {
    label(ctx, colors, r.t, inX - 6, mid + r.dy + 4, { align: "right", color: colors.ink2 });
    if (r.t === "⋮") continue;
    arrow(inX, mid + r.dy, L.xHid - 11, mid + r.dy * 0.3);
    if (r.w) {
      label(ctx, colors, r.w, (inX + L.xHid) / 2, mid + r.dy * 0.78 - 4, { align: "center" });
    }
  }

  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(L.xHid, mid, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.ink2;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Σ", L.xHid, mid);
  ctx.restore();
  label(ctx, colors, "+ b", L.xHid, mid + 24, { align: "center" });
  arrow(L.xHid + 11, mid, boxX - 3, mid);

  const { f } = ACTS[actKey];
  const Z = 2.4;
  const X = (z) => boxX + ((z + Z) / (2 * Z)) * box;
  const Y = (v) => boxTop + box / 2 - (v / Z) * (box / 2);
  ctx.save();
  ctx.fillStyle = colors.surface;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(boxX, boxTop, box, box);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(boxX, boxTop, box, box);
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(boxX, Y(0));
  ctx.lineTo(boxX + box, Y(0));
  ctx.moveTo(X(0), boxTop);
  ctx.lineTo(X(0), boxTop + box);
  ctx.stroke();
  ctx.restore();

  if (zs && zs.length) {
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (const z of zs) {
      const zx = X(Math.max(-Z, Math.min(Z, z)));
      ctx.moveTo(zx, boxTop + box - 1);
      ctx.lineTo(zx, boxTop + box - 6);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 70; i += 1) {
    const z = -Z + (i / 70) * 2 * Z;
    const v = Math.max(-Z, Math.min(Z, f(z)));
    if (i === 0) ctx.moveTo(X(z), Y(v));
    else ctx.lineTo(X(z), Y(v));
  }
  ctx.stroke();
  ctx.restore();
  label(ctx, colors, ACTS[actKey].label, boxX + box / 2, boxTop + box + 12,
    { align: "center", color: colors.ink2 });

  arrow(boxX + box + 3, mid, L.xOut - 14, mid);
  label(ctx, colors, "out", L.xOut, mid + 4, { align: "center", color: colors.ink2 });
}

/* One edge per weight. Thickness is |w| scaled to the largest weight in
   this network rather than to a constant: the comparison is within one
   network, and a fixed scale would make a well-trained narrow network look
   empty beside a wide one. Colour is the sign. */
function drawNetwork(ctx, colors, x0, y0, w, h, net, fires, actKey, opts) {
  const k = net.W2.length;
  const { hoverUnit = null, zs = null, update = null } = opts ?? {};
  const L = netLayout(x0, y0, w, h, k);
  const dead = deadUnits(fires, actKey);
  const max = Math.max(...[...net.W1.flat(), ...net.W2].map(Math.abs), 1e-6);

  const edge = (ax, ay, bx, by, w, j, delta) => {
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
    /* the change this epoch made, from consecutive stored weight vectors */
    if (update && update.max > 1e-12) {
      const g = Math.abs(delta) / update.max;
      if (g > 0.04) {
        ctx.save();
        ctx.lineWidth = 1 + 4 * g;
        ctx.globalAlpha = 0.15 + 0.55 * g;
        ctx.strokeStyle = colors.highlight;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -update.phase;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  for (let j = 0; j < k; j += 1) {
    const hy = L.yOf(j, k);
    for (let i = 0; i < 2; i += 1) {
      edge(L.xIn, L.yOf(i, 2), L.xHid, hy, net.W1[j][i], j, update?.dW1[j][i] ?? 0);
    }
    edge(L.xHid, hy, L.xOut, L.yOf(0, 1), net.W2[j], j, update?.dW2[j] ?? 0);
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

  const usable = h - INSET - BAND_GAP - 34;
  const rNode = Math.max(5, Math.min(10, usable / (k * 2.6)));
  node(L.xIn, L.yOf(0, 2), 11, "x₁");
  node(L.xIn, L.yOf(1, 2), 11, "x₂");
  for (let j = 0; j < k; j += 1) {
    node(L.xHid, L.yOf(j, k), hoverUnit === j ? rNode + 2 : rNode, "",
      hoverUnit === j ? colors.highlight : (dead[j] ? colors.unknown : null));
  }
  node(L.xOut, L.yOf(0, 1), 12, "P");

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 4, L.dividerY);
  ctx.lineTo(x0 + w - 4, L.dividerY);
  ctx.stroke();
  ctx.restore();

  label(ctx, colors, "inputs", L.xIn, L.labelY, { align: "center" });
  label(ctx, colors, `${k} hidden ${k === 1 ? "unit" : "units"}`, L.xHid, L.labelY,
    { align: "center" });
  label(ctx, colors, "output", L.xOut, L.labelY, { align: "center" });

  drawNeuron(ctx, colors, x0, y0, w, k, actKey, zs);
}

/* One training step, drawn. Everything here comes from the stored
   trajectory and the sample's own forward pass — nothing extra is computed
   or stored to animate it. */
function drawStep(ctx, colors, x0, y0, w, h, net, actKey, sample, beat, fires) {
  const k = net.W2.length;
  const L = netLayout(x0, y0, w, h, k);
  const { f } = ACTS[actKey];

  const z1 = [];
  const hv = [];
  let z2 = net.b2;
  for (let j = 0; j < k; j += 1) {
    const z = net.W1[j][0] * sample.x[0] + net.W1[j][1] * sample.x[1] + net.b1[j];
    z1.push(z);
    const a = f(z);
    hv.push(a);
    z2 += net.W2[j] * a;
  }
  const out = 1 / (1 + Math.exp(-z2));
  const target = sample.y > 0 ? 1 : 0;
  const err = out - target;

  const travel = (ax, ay, bx, by, t, colour, r) => {
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    ctx.save();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const cls = sample.y > 0 ? colors.event : colors.nonevent;

  if (beat < BEATS.forward) {
    const p = beat / BEATS.forward;
    if (p < 0.5) {
      const t = p / 0.5;
      for (let j = 0; j < k; j += 1) {
        for (let i = 0; i < 2; i += 1) {
          travel(L.xIn, L.yOf(i, 2), L.xHid, L.yOf(j, k), t, cls, 3);
        }
      }
    } else {
      const t = (p - 0.5) / 0.5;
      for (let j = 0; j < k; j += 1) {
        const mag = Math.min(1, Math.abs(hv[j]) / 2);
        travel(L.xHid, L.yOf(j, k), L.xOut, L.yOf(0, 1), t, cls, 2 + 3 * mag);
      }
    }
  } else if (beat < BEATS.backward) {
    ctx.save();
    ctx.fillStyle = colors.ink1;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.fillText(f2(out), L.xOut, L.yOf(0, 1) - 18);
    ctx.restore();

    if (beat >= BEATS.compare) {
      const q = (beat - BEATS.compare) / (BEATS.backward - BEATS.compare);

      /* The backward pass stops at the hidden units. Backpropagation
         produces a gradient for every parameter; the inputs are data and
         have none, so an arrow reaching them would promise an update that
         never happens. Right angles rather than an arc: a curve running
         right to left reads as another forward sweep. */
      const railY = y0 + INSET + BAND_GAP + 30;
      const endY = L.yOf(0, k) - 15;
      const pts = [
        [L.xOut, L.yOf(0, 1) - 14],
        [L.xOut, railY],
        [L.xHid, railY],
        [L.xHid, endY],
      ];
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i += 1) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        segs.push(d);
        total += d;
      }
      const drawn = Math.min(1, q / 0.7) * total;
      ctx.save();
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      let used = 0;
      let head = pts[0];
      for (let i = 0; i < segs.length; i += 1) {
        const remaining = drawn - used;
        if (remaining <= 0) break;
        const t = Math.min(1, remaining / segs[i]);
        head = [
          pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
          pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
        ];
        ctx.lineTo(head[0], head[1]);
        used += segs[i];
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      if (drawn >= total - 0.5) {
        ctx.moveTo(L.xHid, endY + 4);
        ctx.lineTo(L.xHid - 5, endY - 5);
        ctx.lineTo(L.xHid + 5, endY - 5);
      } else {
        ctx.arc(head[0], head[1], 3.4, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      /* a dead unit is never ringed: it receives zero gradient, which is
         why it cannot recover */
      if (q > 0.7) {
        ctx.save();
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 2.2;
        for (let j = 0; j < k; j += 1) {
          if (fires[j] === 0 && actKey === "relu") continue;
          ctx.beginPath();
          ctx.arc(L.xHid, L.yOf(j, k), 11, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  return { out, target, err };
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
  ctx.save();
  ctx.fillStyle = colors.highlight;
  ctx.beginPath();
  ctx.arc(LX(upto), LY(losses[upto]), 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  label(ctx, colors, "training loss", x0 + 4, y0 - 4);
  label(ctx, colors, `epoch ${upto} of ${EPOCHS}`, x0 + w, y0 - 4, { align: "right" });
}

/* ---- the reroll, a momentary pill (widgets 34 and 35) --------------------
   Pressing it advances `init` and releases itself, both through the exported
   setParam, so the URL records only the starting weights. `init` is separate
   from `seed` because the samples must hold still while the starting weights
   change, or a moved boundary has two possible causes. */
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
  /* The hover inspector, which must stay additive: a lecture screen has no
     pointer, so everything hover reveals has a second route — the unit lines
     have their own control, and its numbers are in the readout or caption. */
  pointer: true,

  height: ({ w }) => stageHeight(w),

  params: {
    data: { type: "section", label: "The data" },

    dataset: {
      type: "segmented",
      label: "Shape",
      options: [
        { value: "blobs", label: "Two blobs", detail: "a straight line already separates these" },
        { value: "rings", label: "Rings", detail: "one class surrounds the other" },
        { value: "moons", label: "Crescents", detail: "two interleaving arcs" },
      ],
      default: "rings",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

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
    /* a segmented Off/On named for what it shows (3.4j amended). Hover
       reaches one unit's line as well, but a projector has no pointer, so
       this is the route that needs none — core's rule that an inspector
       must stay additive. */
    lines: {
      type: "segmented",
      label: "Each unit's line",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On", detail: "where each hidden unit switches on" },
      ],
      default: "off",
      display: true,
    },

    train: { type: "section", label: "Training" },

    /* The starting weights, on their own seeded stream so the samples hold
       still while they change. Hidden because the value itself carries no
       meaning; the pill below is the way to try another. */
    init: { type: "int", min: 1, max: INIT_MAX, default: 1, hidden: true },
    reroll: {
      type: "bool",
      style: "action",
      label: "Initialize weights",
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
    { token: "event", label: "One class, and weights toward it", mark: "dot" },
    { token: "nonevent", label: "The other class, and weights toward it", mark: "dot" },
    ...(params.activation === "relu"
      ? [{ token: "unknown", label: "A dead unit — fires on no sample", mark: "dot" }]
      : []),
    ...(params.lines === "on"
      ? [{ token: "reference", label: "Where a unit switches on", mark: "line" }]
      : []),
    { token: "highlight", label: "Training loss", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const data = SETS[params.dataset].make(rng);
    const k = Number(params.hidden);
    /* the starting weights use their own seeded stream, so rerolling them
       leaves every sample where it was */
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
      beat: 0,
      sample: 0,
    }),

    advance: (anim, { dt, params, state }) => {
      /* Slow is the choreographed pace: one training step per BEAT_MS.
         Medium and Fast just count epochs. Which pace choreographs is
         declared, not decided mid-run (4.1). */
      if (params.speed === "slow") {
        if (anim.epoch >= EPOCHS) {
          anim.done = true;
          return false;
        }
        anim.beat += dt / BEAT_MS;
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.epoch += 1;
        /* striding, so consecutive steps are not neighbours in the
           generated order */
        anim.sample = (anim.sample + 37) % state.data.length;
        if (anim.epoch >= EPOCHS) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }

      anim.beat = 0;
      const perSec = { medium: 200, fast: 600 }[params.speed] ?? 200;
      const target = anim.mode === "step" ? Math.min(EPOCHS, anim.epoch + 1) : EPOCHS;
      const rate = anim.mode === "step" ? 999 : (perSec * dt) / 1000;
      anim.epoch = Math.min(target, anim.epoch + Math.max(1, Math.round(rate)));
      if (anim.epoch >= EPOCHS) {
        anim.epoch = EPOCHS;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    rebuild: (anim, { params }) => {
      if (params.reroll) rerollInit();
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const ep = Math.min(anim?.epoch ?? 0, EPOCHS);
    const net = state.frames[ep];
    const fires = state.live[ep];
    const bSide = boundSide(w);
    const nWidth = netWidth(w);
    const xNet = PAD_X;
    const xBnd = PAD_X + nWidth + GAP;
    const dead = deadUnits(fires, params.activation);
    const hoverUnit = unitAt(pointer, xNet, TOP, nWidth, bSide, state.k);

    const zs = [];
    for (const pt of state.data) {
      for (let j = 0; j < state.k; j += 1) {
        zs.push(net.W1[j][0] * pt.x[0] + net.W1[j][1] * pt.x[1] + net.b1[j]);
      }
    }

    /* shown while a step is being choreographed and just after it */
    const beat = anim?.beat ?? 0;
    const choreo = params.speed === "slow" && (anim?.mode === "step" || anim?.mode === "run");
    const stepping = choreo && beat > 0;
    const wantsUpdate = ep > 0 && (!stepping || beat >= BEATS.backward)
      && (anim?.mode === "step" || params.speed === "slow");
    let update = null;
    if (wantsUpdate) {
      const prev = state.frames[ep - 1];
      const dW1 = net.W1.map((row, j) => row.map((v, i) => v - prev.W1[j][i]));
      const dW2 = net.W2.map((v, j) => v - prev.W2[j]);
      const mx = Math.max(...dW1.flat().map(Math.abs), ...dW2.map(Math.abs));
      update = { dW1, dW2, max: mx, phase: 0 };
    }

    const shown = stepping ? state.data[anim.sample % state.data.length] : null;

    drawNetwork(ctx, colors, xNet, TOP, nWidth, bSide, net, fires, params.activation,
      { hoverUnit, zs, update });
    drawBoundary(ctx, colors, xBnd, TOP, bSide, state.data, net, params.activation,
      { hoverUnit, showLines: params.lines === "on", pointer, dead, mark: shown });

    let pass = null;
    if (stepping) {
      pass = drawStep(ctx, colors, xNet, TOP, nWidth, bSide, net, params.activation,
        shown, beat, fires);
    }

    const deadN = dead.filter(Boolean).length;
    const capY = TOP + bSide + 16;
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
      xBnd + bSide, capY, { align: "right", color: colors.ink2 });

    if (stepping && pass) {
      const n = state.data.length;
      const said = beat < BEATS.forward
        ? `Forward: one of the ${n} samples goes through the network`
        : beat < BEATS.compare
          ? `Predicted ${f2(pass.out)}, actual ${pass.target} — the gap is the error`
          : beat < BEATS.backward
            ? "Backward: the error returns to the hidden units, each learning its share"
            : `Every sample makes this trip; the weights then move once — largest step ${fSig(update?.max ?? 0)}`;
      label(ctx, colors, said, xNet, capY + 15, { color: colors.highlight });
    } else if (update) {
      label(ctx, colors,
        `Backpropagation: the error is sent back and every weight moves against it — largest step ${fSig(update.max)}`,
        xNet, capY + 15, { color: colors.highlight });
    }

    drawLoss(ctx, colors, PAD_X, TOP + bSide + CAP_H, w - 2 * PAD_X, LOSS_H, state.losses, ep);
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
