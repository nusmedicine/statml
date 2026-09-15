/* ============================================================================
   Widget 64 · model.js — the task, the training, the readings of the trained
   model, and the arithmetic of the stage. `engine.js` is the network; this
   file is what one widget reads off it and where every rectangle of the
   figure is; `main.js` holds the colours, the strings and the animation.

    THE TASK IS KENNETH'S PICK, TUNED BY MEASUREMENT (2026-09-15). Widget 61's
   cell with a nucleus against its membrane alone — a ghost — with the ghost's
   interior at 0.08, darker than the 0.24 field, so the ghost class has
   evidence of its own (without it the class is defined by an absence and its
   heatmap is off the ghost; `_lab/gradcam-measure.mjs`). Every image carries a
   3 × 3 "L" orientation marker in the bottom-left corner, which the model
   reads as nothing. THE PLANTED SHORTCUT IS GONE (his call the same evening,
   after two rounds of it): the widget shows that Grad-CAM finds the object
   and is not distracted by the marker, and nothing else.

   THE HELD-OUT IMAGES ARE THE SAME UNDER EVERY MODEL. The Test image control
   names one of eight, and the point of a control that retrains (the watermark
   rate, the seed) is to read the SAME image under a different model; so the
   test sets are drawn from a fixed seed of their own, the way widget 60 draws
   its noise once, unconditionally. The training set and the initial weights
   come from the rng core hands `compute`, so the seed control retrains.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import * as E from "./engine.js";

/* --- the task ----------------------------------------------------------- */

export const S = 16;
export const CHANS = [8, 12, 16];
export const EPOCHS = 20;
export const N_TRAIN = 200;
/** held-out images of each kind, clean and watermarked, that the accuracies are scored on */
export const N_TEST = 60;
/** the ones the Test image control reaches; class 0 and 1 alternate */
export const TEST_SHOWN = 8;
export const TEST_SEED = 6000;
export const TASK = "holen";
export const CLASS_NAMES = ["Cell", "Ghost"];
export const LAYERS = ["conv1", "conv2", "conv3"];
export const LAYER_DEFAULT = "conv2";

export const trainKey = (p) => `${p.seed}`;
export const layerIndex = (name) => Math.max(0, LAYERS.indexOf(name));

/* --- training ------------------------------------------------------------ */

export function trainModel(params, rng) {
  const opts = { marker: true };
  const train = E.makeSet(TASK, N_TRAIN, S, rng, opts);
  const clean = E.makeSet(TASK, N_TEST, S, makeRng(TEST_SEED), opts);
  const net = E.makeNet(S, CHANS, 2, rng);
  const t0 = performance.now();
  const { w, losses } = E.train(net, train, { epochs: EPOCHS, rng });
  const ms = performance.now() - t0;
  return {
    net, w, train, clean, losses, ms,
    acc: { train: E.evaluate(net, w, train), clean: E.evaluate(net, w, clean) },
  };
}

/* --- readings ------------------------------------------------------------ */

/**
 * One image through the trained model, everything the figure needs kept: the
 * activations of every stage for the gallery, the score, and the four steps of
 * Grad-CAM at every layer for BOTH classes, with the heat's share on the cell
 * and in the watermark's corner.
 */
export function readImage(model, set, i) {
  const { net, w } = model;
  const off = i * S * S;
  E.forward(net, w, set.x, off);
  const pred = E.argmax(w);
  const read = {
    set, i, off, pred, cls: set.y[i], cued: Boolean(set.cued[i]),
    prob: w.prob.slice(), logits: w.logits.slice(), g: w.g.slice(),
    img: set.x.slice(off, off + S * S),
    acts: w.bl.map((b) => b.a.slice()),
    pools: w.bl.map((b) => b.p.slice()),
    cams: [],
  };
  for (let b = 0; b < CHANS.length; b += 1) {
    const row = [];
    for (let c = 0; c < 2; c += 1) {
      const g = E.gradcam(net, w, set.x, off, c, b);
      row.push({ ...g, share: E.heatShare(g.up, S, set.masks[i]), marker: markerShare(g.up) });
    }
    read.cams.push(row);
  }
  /* gradcam ran its own forward passes; leave `w` holding this image's */
  E.forward(net, w, set.x, off);
  return read;
}

/** the share of the heat inside the marker's corner */
export function markerShare(up) {
  let total = 0;
  let inBox = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      total += up[y * S + x];
      if (x < E.MARKER_BOX && y >= S - E.MARKER_BOX) inBox += up[y * S + x];
    }
  }
  return total > 0 ? inBox / total : 0;
}
export const MARKER_AREA = (E.MARKER_BOX * E.MARKER_BOX) / (S * S);

/** one held-out image of each class, for the rail's preview of the two classes;
    the same fixed draw the Test image control reaches, so image 1 and 2 */
let examples = null;
export function exampleImage(k) {
  if (!examples) examples = E.makeSet(TASK, 2, S, makeRng(TEST_SEED), { marker: true });
  return examples.x.slice(k * S * S, (k + 1) * S * S);
}

export const readings = (model) =>
  Array.from({ length: TEST_SHOWN }, (_, i) => readImage(model, model.clean, i));

/** what a reading's parts are, for the figure */
export const readOf = (state, params) => {
  const idx = Math.max(0, Math.min(TEST_SHOWN - 1, Number(params.image) - 1));
  return state.readings[idx];
};
export const classOf = (read, params) => (params.cls === "other" ? 1 - read.pred : read.pred);

/* --- the diagram ---------------------------------------------------------- *
 * Kenneth's Grad-CAM figure (06-2 cell 130) as he draws it, his pick B on
 * 2026-09-15 — revised from A the same evening, "it aligns with the notebook
 * diagram". Forward along the top: the image, the network, the chosen
 * layer's maps, the head, the score. Backward along the bottom, right to
 * left: the score's gradient on each map, the averages, the weighted sum,
 * ReLU, the heatmap on the image under the image it came from. Every x and y
 * is here so `_lab/gradcam-verify.mjs` measures the shipping fit (5.8).      */

export const PAD = 14;
export const IMG = 104;               // the image, and the heatmap under it
export const THUMB = 36;              // one map of the chosen layer
export const VG = 5;
export const SHOWN = 4;               // maps of the chosen layer the stack draws
export const STACK_H = SHOWN * THUMB + (SHOWN - 1) * VG;
export const BIG = 48;                // the weighted sum, and it after ReLU
export const CELL = 12;               // one value of the head
export const BOX_W = 44;              // the CNN box
export const BOX_H = 28;
export const ARROW = 22;
export const ALPHA_W = 44;
const TOP_Y = 64;                     // 56 put the stack's "Aᵏ" label on the note line
const ROW_GAP = 40;                   // 34 put the stack's caption on the gradient label
const LINES = 46;                     // three printed lines under the bottom row

/**
 * THE BOTTOM ROW SETS THE COLUMN. Right to left it needs the gradient stack,
 * the α column, two arrows and two maps, and a third arrow into the heatmap
 * that sits under the image; so the feature-map stack goes where the gradient
 * stack has to be, and the CNN box is centred in the run between the image
 * and the stack. Nothing scales with the width: the diagram is pinned left and
 * a wider stage is margin.
 */
export function diagramLayout(w) {
  const rowH = Math.max(IMG, STACK_H);
  const topMid = TOP_Y + rowH / 2;
  const botTop = TOP_Y + rowH + ROW_GAP;
  const botMid = botTop + rowH / 2;
  const stackX = PAD + IMG + ARROW + BIG + ARROW + BIG + ARROW + ALPHA_W + 8;
  /* forward, left to right */
  const img = { x: PAD, y: topMid - IMG / 2 };
  const box = { x: Math.round((PAD + IMG + stackX) / 2 - BOX_W / 2), y: topMid - BOX_H / 2 };
  const stack = { x: stackX, y: topMid - STACK_H / 2 };
  const head = { x: stackX + THUMB + ARROW, y: topMid - CELL / 2 };
  const headW = SHOWN * (CELL + 1);
  const score = { x: head.x + headW + ARROW, y: topMid };
  /* backward, right to left */
  const grads = { x: stackX, y: botMid - STACK_H / 2 };
  const alpha = { x: stackX - 8 - ALPHA_W, y: botMid - STACK_H / 2 };
  const sum = { x: alpha.x - ARROW - BIG, y: botMid - BIG / 2 };
  const relu = { x: sum.x - ARROW - BIG, y: botMid - BIG / 2 };
  const heat = { x: PAD, y: botMid - IMG / 2 };
  return {
    w, topMid, botMid, botTop, rowH,
    img, box, stack, head, headW, score, grads, alpha, sum, relu, heat,
    /** where the score's gradient comes down: to the right of the score */
    drop: { x: score.x + 8, y0: topMid + 10, y1: botMid },
    /** the printed lines under the bottom row */
    lineY: (k) => botTop + rowH + 14 + 14 * k,
    height: botTop + rowH + LINES,
  };
}

/** the stage's height does not depend on the width: the diagram is pinned left */
export const STAGE_H = diagramLayout(550).height;

/* --- pacing --------------------------------------------------------------- */

/** how many presses the method takes: forward, gradients, average, sum, ReLU */
export const STEPS = 5;
export const PHASES = ["forward", "grads", "avg", "sum", "relu", "done"];
/** one press draws in over this long; Play runs the five at this pace */
export const STEP_MS = 700;

export const maxOf = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
