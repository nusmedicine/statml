/* ============================================================================
   Widget 62 · the smear, the draws, the listing's lines and the geometry.

   No DOM here: `_lab/augmentation-verify.mjs` imports this file and
   `engine.js`, the shipping code, and asserts what the figure prints.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import * as E from "./engine.js";

export const N = 512;
export const PAD = 14;
export const DRAWS = 12;
export const EPOCHS = 8;
const DEG = Math.PI / 180;

/* ================================ the smear =================================
   A stained blood film at 512 × 512, the size of a KRD-WBC image: red cells
   with central pallor, one white cell with a three-lobed nucleus and granules;
   the mask is the white cell, as KRD-WBC's masks mark the white blood cell.
   Channel values are data, like widget 65's image. Fixed by its own seed: the
   draws change, the smear does not. `raw` is the smear as loaded; `image` is it
   after ScaleIntensityd, which cell 19 runs before any random line. Built once
   per placement on first request (about 100 ms), which is a cache of a pure
   function of constants and nothing more. */

/* THE CELL'S PLACE (Kenneth's pick on the mock, 2026-09-15): the mask left out
   of `keys` scores Dice 0.00 under a flip off-centre and 0.99 centred, because a
   centred round mask maps onto itself — so the place is a control. Off-centre is
   his pair figure's arrangement and the default. Radius 70 is 5.9 % of the
   image. */
/* keyed by the words the White blood cell control shows, since they are its URL values (5.9) */
export const PLACEMENTS = {
  "off-centre": { x: 184, y: 312, r: 70 },
  centred: { x: 255.5, y: 255.5, r: 70 },
};

const BG = [0.95, 0.91, 0.92];
const RBC_RIM = [0.87, 0.56, 0.61];
const RBC_PALLOR = [0.94, 0.79, 0.81];
const CYTO = [0.80, 0.72, 0.86];
const GRANULE = [0.64, 0.50, 0.73];
const NUCLEUS = [0.33, 0.17, 0.47];

const cover = (d, r) => Math.max(0, Math.min(1, r - d + 0.5));
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};

const smears = new Map();

export function smear(place) {
  const key = PLACEMENTS[place] ? place : "off-centre";
  if (smears.has(key)) return smears.get(key);
  const wbc = PLACEMENTS[key];
  const rng = makeRng(5005);
  const rbcs = [];
  for (let tries = 0; tries < 4000 && rbcs.length < 15; tries += 1) {
    const r = 34 + 6 * rng.next();
    const x = -24 + (N + 48) * rng.next();
    const y = -24 + (N + 48) * rng.next();
    if (Math.hypot(x - wbc.x, y - wbc.y) < wbc.r + r - 6) continue;
    if (rbcs.some((b) => Math.hypot(x - b.x, y - b.y) < (r + b.r) * 0.92)) continue;
    rbcs.push({ x, y, r });
  }
  const lobes = [[-26, -8, 21], [4, -28, 19], [24, 6, 20]].map(([dx, dy, r]) => ({ x: wbc.x + dx, y: wbc.y + dy, r }));
  const bridges = [[0, 1, 8], [1, 2, 7]];
  const granules = [];
  for (let tries = 0; tries < 3000 && granules.length < 46; tries += 1) {
    const ang = 2 * Math.PI * rng.next();
    const rad = (wbc.r - 6) * Math.sqrt(rng.next());
    const x = wbc.x + rad * Math.cos(ang);
    const y = wbc.y + rad * Math.sin(ang);
    if (lobes.some((l) => Math.hypot(x - l.x, y - l.y) < l.r + 4)) continue;
    granules.push({ x, y, r: 2.2 });
  }
  const raw = E.make(N, N, 3);
  const mask = E.make(N, N, 1);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      let col = BG.slice();
      for (const b of rbcs) {
        const d = Math.hypot(px - b.x, py - b.y);
        const a = cover(d, b.r);
        if (a <= 0) continue;
        const t = Math.max(0, Math.min(1, (d / b.r - 0.35) / 0.5));
        col = col.map((v, i) => v + (RBC_PALLOR[i] + (RBC_RIM[i] - RBC_PALLOR[i]) * t - v) * a);
      }
      const dw = Math.hypot(px - wbc.x, py - wbc.y);
      const aw = cover(dw, wbc.r);
      if (aw > 0) {
        col = col.map((v, i) => v + (CYTO[i] - v) * aw);
        for (const g of granules) {
          const ag = cover(Math.hypot(px - g.x, py - g.y), g.r);
          if (ag > 0) col = col.map((v, i) => v + (GRANULE[i] - v) * ag);
        }
        let an = 0;
        for (const l of lobes) an = Math.max(an, cover(Math.hypot(px - l.x, py - l.y), l.r));
        for (const [i, j, hw] of bridges) {
          an = Math.max(an, cover(segDist(px, py, lobes[i].x, lobes[i].y, lobes[j].x, lobes[j].y), hw));
        }
        if (an > 0) col = col.map((v, i) => v + (NUCLEUS[i] - v) * an);
      }
      for (let ch = 0; ch < 3; ch += 1) raw.d[ch * N * N + y * N + x] = col[ch];
      mask.d[y * N + x] = dw <= wbc.r ? 1 : 0;
    }
  }
  const out = { raw, image: E.scaleIntensity(raw), mask, wbc };
  smears.set(key, out);
  return out;
}

/** The white cell's outline carried through file-orientation operations, as points in the output. */
export function outlineOf(wbc, ops) {
  return Array.from({ length: 160 }, (_, i) => {
    const a = (2 * Math.PI * i) / 160;
    let p = [wbc.x - 0.5 + wbc.r * Math.cos(a), wbc.y - 0.5 + wbc.r * Math.sin(a)];
    let w = N;
    let h = N;
    for (const f of ops) {
      p = E.mapPoint(p, f, w, h);
      if (f.kind === "turn" && f.quarters % 2) [w, h] = [h, w];
    }
    return p;
  });
}

/* ============================ the Transforms page ===========================
   Five of cell 15's Augment rows, one at a time, each with its own arguments
   and cell 19's values as the defaults. */

export const KINDS = ["flip", "rotate", "affine", "contrast", "noise"];
export const CLASS = {
  flip: "RandFlipd",
  rotate: "RandRotate90d",
  affine: "RandAffined",
  contrast: "RandAdjustContrastd",
  noise: "RandGaussianNoised",
};
const SPATIAL = new Set(["flip", "rotate", "affine"]);
export const isSpatial = (kind) => SPATIAL.has(kind);
export const PROBS = ["0", "0.15", "0.25", "0.3", "0.5", "0.75", "1"];
export const labelIn = (params) => params.keys !== "image";

/* THE TASK (Kenneth's picks, 2026-09-17, `_lab/augmentation-classification-mock.html`).
   Under Classification the label is a class, not a picture: MONAI 1.6.0 raises on
   every spatial line when a class label is in `keys`, and `keys=["image"]` leaves
   it unchanged (`_lab/augmentation-classification-monai.py`). So the figure
   draws the class in the mask's place and no outline. The draws are the same
   under both tasks: `computeTransforms` does not read Task, and `computePipeline`
   reads it only for which lines the list holds. */
export const isClassification = (params) => params.task === "classification";
/* The smear's class: BloodMNIST's label map (`medmnist.INFO`, the dataset 06-2
   cell 3 lists for white blood cell types) puts neutrophil at 6, and the white
   cell's three-lobed nucleus is a neutrophil's. Written as 06-2 cell 14 titles a
   sample: the index, then the name. */
export const LABEL = { value: 6, name: "neutrophil" };
/* White blood cell is hidden under Classification, and a hidden value does not
   change a figure, so that page draws the off-centre cell whatever it holds. */
export const placeOf = (params) => (isClassification(params) ? "off-centre" : params.cell);
export const gammaRange = (params) => {
  const a = Number(params.gamma_low);
  const b = Number(params.gamma_high);
  return [Math.min(a, b), Math.max(a, b)];
};

/**
 * The twelve draws of one transform, from the seeded rng. A draw that does not
 * fire carries no arguments: MONAI returns the sample unchanged, and there is
 * nothing about it to draw. A noise draw carries its own seed, so its field is
 * built when it is shown and is the same field every time.
 */
function drawsFor(params, rng) {
  const kind = params.transform;
  const prob = Number(params[`${kind}_prob`]);
  return Array.from({ length: DRAWS }, () => {
    const fired = rng.next() < prob;
    if (!fired) return { fired };
    if (kind === "flip") return { fired, op: { kind: "flip", axis: Number(params.spatial_axis) } };
    if (kind === "rotate") return { fired, op: { kind: "rot90", k: 1 + Math.floor(rng.next() * Number(params.max_k)) } };
    if (kind === "affine") {
      const r = Number(params.rotate_range) * DEG;
      const th = Number(params.translate_height);
      const tw = Number(params.translate_width);
      const sh = Number(params.scale_height);
      const sw = Number(params.scale_width);
      return {
        fired,
        op: {
          kind: "affine",
          rotate: rng.uniform(-r, r),
          translate: [rng.uniform(-th, th), rng.uniform(-tw, tw)],
          scale: [1 + rng.uniform(-sh, sh), 1 + rng.uniform(-sw, sw)],
        },
      };
    }
    if (kind === "contrast") {
      const [lo, hi] = gammaRange(params);
      return { fired, gamma: rng.uniform(lo, hi) };
    }
    return { fired, sigma: rng.uniform(0, Number(params.std)), fieldSeed: 1 + Math.floor(rng.next() * 2147483646) };
  });
}

/** A draw's spatial operation in the file's axes, for an outline that needs no pixels. */
export const fileOpsOf = (draw) => (draw.fired && draw.op ? [E.fileOp(draw.op)] : []);

export function computeTransforms(params, rng) {
  const kind = params.transform;
  const draws = drawsFor(params, rng);
  const withLabel = labelIn(params);
  const labelMode = kind === "affine" ? params.mode : "nearest";
  const memo = new Map();
  return {
    page: "transforms",
    kind,
    draws,
    withLabel,
    labelMode,
    /* the sample MONAI returns for draw i, on one placement: built on first
       request (1–19 ms at 512) and kept for the life of this state */
    sample(i, place) {
      const key = `${i}:${place}`;
      if (memo.has(key)) return memo.get(key);
      const sm = smear(place);
      const d = draws[i];
      const out = { image: sm.image, mask: sm.mask, ops: [], stale: null, wbc: sm.wbc };
      if (d.fired && SPATIAL.has(kind)) {
        const f = E.fileOp(d.op);
        out.image = E.applyOp(sm.image, f, "bilinear");
        const moved = E.applyOp(sm.mask, f, "nearest");
        out.ops = [f];
        if (withLabel) {
          out.mask = labelMode === "bilinear" ? E.applyOp(sm.mask, f, "bilinear") : moved;
          out.nearest = moved;
        } else {
          /* THE CASE THAT FAILS: the mask stays where it was, and the Dice is
             of that mask against where the white cell now is */
          out.stale = E.dice(sm.mask, moved);
        }
      } else if (d.fired && kind === "contrast") {
        out.image = E.contrast(sm.image, d.gamma);
      } else if (d.fired && kind === "noise") {
        out.image = E.noise(sm.image, d.sigma, makeRng(d.fieldSeed));
        out.diff = E.make(N, N, 3);
        for (let j = 0; j < out.diff.d.length; j += 1) out.diff.d[j] = 0.5 + 20 * (out.image.d[j] - sm.image.d[j]);
      }
      memo.set(key, out);
      return out;
    },
  };
}

/* The bilinear mask against nearest, and what AsDiscreted(0.5) does to it;
   kept on the sample, since the figure and its line both read it every frame. */
export function maskEdge(sample) {
  if (sample.edge) return sample.edge;
  let between = 0;
  for (const v of sample.mask.d) if (v > 1e-6 && v < 1 - 1e-6) between += 1;
  const disc = E.discrete(sample.mask, 0.5);
  let differ = 0;
  for (let i = 0; i < disc.d.length; i += 1) if (disc.d[i] !== sample.nearest.d[i]) differ += 1;
  let area = 0;
  for (const v of sample.nearest.d) if (v >= 0.5) area += 1;
  /* the window: 20 × 20 on the outline's right-most point, inside the image */
  const pts = outlineOf(sample.wbc, sample.ops);
  const right = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
  const wx = Math.max(0, Math.min(N - MAG_CELLS, Math.round(right[0]) - MAG_CELLS / 2));
  const wy = Math.max(0, Math.min(N - MAG_CELLS, Math.round(right[1]) - MAG_CELLS / 2));
  sample.edge = { between, differ, area, disc, wx, wy, dice: E.dice(disc, sample.nearest) };
  return sample.edge;
}

/* =============================== the Pipeline page ==========================
   Cell 19's `train_transforms`, one sample through every line, and
   `val_test_transforms`, the fixed lines alone. CacheDataset keeps the output
   of every line before the first random one, so from the second epoch the
   training list starts at the first RandFlipd; the validation list has no
   random line, so every epoch after the first is the cached sample (both
   boundaries measured on MONAI). */

export const LINES = [
  { cls: "LoadImaged", call: 'LoadImaged(keys=["image", "label"], reader="PILReader", reverse_indexing=False)' },
  { cls: "EnsureChannelFirstd", call: 'EnsureChannelFirstd(keys=["image", "label"])' },
  { cls: "EnsureTyped", call: 'EnsureTyped(keys=["image", "label"])' },
  { cls: "ScaleIntensityd", call: 'ScaleIntensityd(keys=["image"])' },
  { cls: "SpatialPadd", call: 'SpatialPadd(keys=["image", "label"], spatial_size=roi_size)' },
  { cls: "RandFlipd", random: "flip0", call: 'RandFlipd(keys=["image", "label"], prob=0.5, spatial_axis=0)' },
  { cls: "RandFlipd", random: "flip1", call: 'RandFlipd(keys=["image", "label"], prob=0.5, spatial_axis=1)' },
  { cls: "RandRotate90d", random: "rot90", call: 'RandRotate90d(keys=["image", "label"], prob=0.5, max_k=3)' },
  { cls: "RandAffined", random: "affine", call: 'RandAffined(keys=["image", "label"], prob=0.25, …)' },
  { cls: "RandAdjustContrastd", random: "contrast", call: 'RandAdjustContrastd(keys=["image"], prob=0.3, gamma=(0.7, 1.5))' },
  { cls: "RandGaussianNoised", random: "noise", call: 'RandGaussianNoised(keys=["image"], prob=0.15, mean=0.0, std=0.01)' },
  { cls: "AsDiscreted", call: 'AsDiscreted(keys=["label"], threshold=0.5)' },
];
export const FIRST_RANDOM = LINES.findIndex((l) => l.random);
export const LAST = LINES.length - 1;

/* THE LIST UNDER EACH TASK (Kenneth's picks, 2026-09-17, `_lab/augmentation-task-mock.html`).
   Under Classification the list is cell 19 with the label taken out of every
   `keys` and no AsDiscreted: eleven lines in training, five in validation. Run
   on MONAI 1.6.0 (`_lab/augmentation-classification-pipeline.py`): it runs,
   CacheDataset caches the same lines, and the label stays an int. LINES stays
   the one master list, so an index names one transform under both tasks; a
   state's `list` holds the indices it shows and `last` the one that ends an
   epoch. The images are the same under both tasks, since the label takes no draw. */
export const callOf = (i, classify) =>
  (classify ? LINES[i].call.replace("keys=[\"image\", \"label\"]", "keys=[\"image\"]") : LINES[i].call);

/** One epoch's draws at cell 19's arguments. */
function drawEpoch(rng) {
  const flip0 = rng.next() < 0.5;
  const flip1 = rng.next() < 0.5;
  const k = rng.next() < 0.5 ? 1 + Math.floor(rng.next() * 3) : 0;
  const affine = rng.next() < 0.25
    ? {
        kind: "affine",
        rotate: rng.uniform(-10 * DEG, 10 * DEG),
        translate: [rng.uniform(-8, 8), rng.uniform(-8, 8)],
        scale: [1 + rng.uniform(-0.1, 0.1), 1 + rng.uniform(-0.1, 0.1)],
      }
    : null;
  const gamma = rng.next() < 0.3 ? rng.uniform(0.7, 1.5) : null;
  const noiseOn = rng.next() < 0.15;
  const sigma = noiseOn ? rng.uniform(0, 0.01) : null;
  const fieldSeed = 1 + Math.floor(rng.next() * 2147483646);
  return { flip0, flip1, k, affine, gamma, sigma, fieldSeed };
}

/** Whether a random line fired in an epoch, from that epoch's draws. */
export function firedIn(line, ep) {
  const r = LINES[line].random;
  if (r === "flip0") return ep.flip0;
  if (r === "flip1") return ep.flip1;
  if (r === "rot90") return ep.k > 0;
  if (r === "affine") return Boolean(ep.affine);
  if (r === "contrast") return ep.gamma !== null;
  if (r === "noise") return ep.sigma !== null;
  return false;
}

/** The step list: each entry is the line a press completes, in the epoch it completes it. */
function stepsFor(list, train) {
  const steps = [];
  for (let e = 0; e < EPOCHS; e += 1) {
    if (e === 0) {
      list.forEach((i) => steps.push({ epoch: 0, line: i }));
    } else if (train) {
      list.filter((i) => i >= FIRST_RANDOM).forEach((i) => steps.push({ epoch: e, line: i }));
    } else {
      steps.push({ epoch: e, line: list[list.length - 1] });
    }
  }
  return steps;
}

export function computePipeline(params, rng) {
  const train = params.split !== "validation";
  const classify = isClassification(params);
  /* drawn for both lists, so a seed names the same epochs whichever is shown */
  const epochs = Array.from({ length: EPOCHS }, () => drawEpoch(rng));
  /* THE LINES OF THE LIST SHOWN, as indices into LINES (round two, Kenneth:
     "i thought we do not do any augmentations on validation/test data?"):
     val_test_transforms is cell 19's six fixed lines and nothing else; the
     draft drew the training list with the random lines struck through, which
     read as a list with augmentations switched off. Under Classification
     AsDiscreted is not in either list. */
  const list = LINES.map((l, i) => i).filter((i) => (train || !LINES[i].random) && !(classify && LINES[i].cls === "AsDiscreted"));
  const steps = stepsFor(list, train);
  const memo = new Map();
  return {
    page: "pipeline",
    train,
    classify,
    list,
    last: list[list.length - 1],
    epochs,
    steps,
    total: steps.length,
    /* every line's output in epoch e, built on first request (about 50 ms) */
    linesOf(e) {
      if (memo.has(e)) return memo.get(e);
      const sm = smear("off-centre");
      const ep = epochs[e];
      const out = [];
      let image = sm.raw;
      let mask = sm.mask;
      const ops = [];
      const spatial = (op) => {
        const f = E.fileOp(op);
        image = E.applyOp(image, f, "bilinear");
        mask = E.applyOp(mask, f, "nearest");
        ops.push(f);
      };
      LINES.forEach((l, i) => {
        if (l.cls === "ScaleIntensityd") image = sm.image;
        if (train && l.random && firedIn(i, ep)) {
          if (l.random === "flip0") spatial({ kind: "flip", axis: 0 });
          if (l.random === "flip1") spatial({ kind: "flip", axis: 1 });
          if (l.random === "rot90") spatial({ kind: "rot90", k: ep.k });
          if (l.random === "affine") spatial(ep.affine);
          if (l.random === "contrast") image = E.contrast(image, ep.gamma);
          if (l.random === "noise") image = E.noise(image, ep.sigma, makeRng(ep.fieldSeed));
        }
        if (l.cls === "AsDiscreted") mask = E.discrete(mask, 0.5);
        out.push({ image, mask, ops: ops.slice() });
      });
      memo.set(e, out);
      return out;
    },
  };
}

/** The sample a press starts from: the output of the line before, or the image as saved. */
export function beforeStep(state, step) {
  if (step.line > 0) return state.linesOf(step.epoch)[step.line - 1];
  const sm = smear("off-centre");
  return { image: sm.raw, mask: sm.mask, ops: [] };
}

/** What a press's line does in its epoch: a spatial operation in the file's axes, a γ, noise, or nothing. */
export function stepChange(state, step) {
  const l = LINES[step.line];
  if (!state.train || !l.random || !firedIn(step.line, state.epochs[step.epoch])) return { kind: "none" };
  const ep = state.epochs[step.epoch];
  if (l.random === "flip0") return { kind: "spatial", f: E.fileOp({ kind: "flip", axis: 0 }), zeros: false };
  if (l.random === "flip1") return { kind: "spatial", f: E.fileOp({ kind: "flip", axis: 1 }), zeros: false };
  if (l.random === "rot90") return { kind: "spatial", f: E.fileOp({ kind: "rot90", k: ep.k }), zeros: false };
  if (l.random === "affine") return { kind: "spatial", f: E.fileOp(ep.affine), zeros: true };
  if (l.random === "contrast") return { kind: "contrast", gamma: ep.gamma };
  return { kind: "noise" };
}

/**
 * Line i of the list after s presses: "absent" (not in the validation list),
 * "pending", "done" (run in this epoch) or "cached" (served by CacheDataset);
 * `current` marks the line the last press ran.
 */
export function lineStatus(state, s, i) {
  if (!state.list.includes(i)) return { status: "absent", current: false };
  const cur = s > 0 ? state.steps[s - 1] : null;
  if (!cur) return { status: "pending", current: false };
  if (cur.epoch > 0 && (i < FIRST_RANDOM || !state.train)) return { status: "cached", current: false };
  if (i <= cur.line) return { status: "done", current: i === cur.line };
  return { status: "pending", current: false };
}

/**
 * The list as drawn after s presses, with press s+1 in motion when `moving`:
 * the epoch shown, each line's status, the line just run and the line running.
 * A press that starts an epoch shows THAT epoch — its lines before the first
 * random one cached, the rest pending — so the list and the moving sample are
 * the same epoch.
 */
export function listAt(state, s, moving) {
  const next = moving && s < state.total ? state.steps[s] : null;
  const cur = s > 0 ? state.steps[s - 1] : null;
  if (next && (!cur || next.epoch !== cur.epoch)) {
    const e = next.epoch;
    const status = LINES.map((l, i) => {
      if (!state.list.includes(i)) return "absent";
      return e > 0 && (i < FIRST_RANDOM || !state.train) ? "cached" : "pending";
    });
    return { epoch: e, status, done: -1, running: next.line };
  }
  return {
    epoch: cur ? cur.epoch : 0,
    status: LINES.map((_, i) => lineStatus(state, s, i).status),
    done: cur && lineStatus(state, s, cur.line).current ? cur.line : -1,
    running: next ? next.line : -1,
  };
}

/** What a press is about to do on the Pipeline page after n presses: the next line, or the next epoch. */
export function pipelinePhase(state, n) {
  if (n >= state.total || n === 0) return "line";
  return state.steps[n].epoch > state.steps[n - 1].epoch ? "epoch" : "line";
}

/* ================================= the tween ================================
   Kenneth, round one (2026-09-15): "can add tweening animation?". A draw, or a
   line of the list, is shown IN MOTION: the transform from nothing to its drawn
   value, applied to the image it starts from. A mirror squashes to a line and
   opens mirrored; a quarter turn rotates counter-clockwise, as MONAI's k does
   under [C, H, W]; an affine's angle, shift and scale ease in together; contrast
   moves γ from 1; noise raises σ from 0. Every spatial frame is a warp — the
   engine's own grid with interpolated arguments — sampled at the panel's device
   pixels (3–5 ms a frame), and the engine's exact result replaces it when the
   motion ends; the verify holds each tween's last frame to that result. The
   frames between are a depiction of the motion: MONAI computes no in-between. */

export const TWEEN_MS = 800;
export const QUIET_MS = 300;

/* THE FADE BEFORE THE MOTION (Kenneth, round two: "a new image comes in
   abruptly. do you think a fade would help or it may confuse students"). A draw
   applies the call to the ORIGINAL, so the panel goes back to the original
   before it moves — and an epoch goes back to the cached sample. The last result
   fades OUT to the empty panel and the starting image fades IN: never a blend of
   the two, which would put two cells in one picture and read as a mix of images
   (MixUp, which is an augmentation of its own), and never the last transform
   played backwards, which would read as transforms that stack. */
export const FADE_MS = 300;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** A spatial file-orientation operation at fraction e of the way from nothing, as a warp. */
export function tweenWarp(f, e) {
  if (f.kind === "warp") {
    return {
      kind: "warp",
      rotate: e * f.rotate,
      translate: [e * f.translate[0], e * f.translate[1]],
      scale: [1 + e * (f.scale[0] - 1), 1 + e * (f.scale[1] - 1)],
    };
  }
  if (f.kind === "turn") {
    /* a positive warp rotate turns the content counter-clockwise (measured), and
       `quarters` counts clockwise, so k counter-clockwise quarters is 4 − quarters */
    return { kind: "warp", rotate: (e * ((4 - f.quarters) % 4) * Math.PI) / 2, translate: [0, 0], scale: [1, 1] };
  }
  /* a mirror is a squash through zero along its axis: the input read at a
     factor 1 / (1 − 2e), which is −1 at the end and has no finite value halfway */
  const s = 1 - 2 * e;
  const k = Math.abs(s) < 1e-3 ? Infinity : 1 / s;
  return { kind: "warp", rotate: 0, translate: [0, 0], scale: f.axis === 0 ? [k, 1] : [1, k] };
}

/**
 * An image through a warp, sampled at px × px points: the panel's device
 * pixels. RGBA bytes. `tint` draws a one-channel image as opacity in that
 * [r, g, b]; outside the input is zeros (opaque black) when `zeros`, else
 * transparent. Bilinear, with zeros past the edge, as the engine's warp.
 */
export function renderWarp(src, px, wp, { zeros = false, tint = null } = {}) {
  const out = new Uint8ClampedArray(px * px * 4);
  const { w, h, c } = src;
  const n = w * h;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const cs = Math.cos(wp.rotate);
  const sn = Math.sin(wp.rotate);
  const stepX = w / px;
  const stepY = h / px;
  for (let v = 0; v < px; v += 1) {
    const oy = (v + 0.5) * stepY - 0.5;
    for (let u = 0; u < px; u += 1) {
      const ox = (u + 0.5) * stepX - 0.5;
      const qx = wp.scale[0] * (ox - cx) + wp.translate[0];
      const qy = wp.scale[1] * (oy - cy) + wp.translate[1];
      const x = cs * qx - sn * qy + cx;
      const y = sn * qx + cs * qy + cy;
      const o = 4 * (v * px + u);
      if (!(x > -1 && x < w && y > -1 && y < h)) {
        if (zeros && !tint) out[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const at = (ch, xx, yy) => (xx >= 0 && xx < w && yy >= 0 && yy < h ? src.d[ch * n + yy * w + xx] : 0);
      const sample = (ch) => (at(ch, x0, y0) * (1 - fx) + at(ch, x0 + 1, y0) * fx) * (1 - fy)
        + (at(ch, x0, y0 + 1) * (1 - fx) + at(ch, x0 + 1, y0 + 1) * fx) * fy;
      if (tint) {
        out[o] = tint[0];
        out[o + 1] = tint[1];
        out[o + 2] = tint[2];
        out[o + 3] = 255 * sample(0);
      } else {
        for (let ch = 0; ch < 3; ch += 1) out[o + ch] = 255 * sample(c === 3 ? ch : 0);
        out[o + 3] = 255;
      }
    }
  }
  return out;
}

/** Whether press n changes the picture in motion: an applied draw, or a random line that fired. */
function movesAt(state, n) {
  if (state.page === "pipeline") {
    const st = state.steps[n];
    return Boolean(st && state.train && LINES[st.line].random && firedIn(st.line, state.epochs[st.epoch]));
  }
  return Boolean(state.draws[n]?.fired);
}

/** Whether press n first returns the panel to the image it starts from: every draw, and a training epoch's first press. */
function fadesAt(state, n) {
  if (state.page === "pipeline") return state.train && n > 0 && n < state.total && state.steps[n].epoch > state.steps[n - 1].epoch;
  return n < DRAWS;
}

/** How long press n takes: the fade, then the motion; a press with neither holds for QUIET_MS. */
export function durationAt(state, n) {
  return (fadesAt(state, n) ? FADE_MS : 0) + (movesAt(state, n) ? TWEEN_MS : 0) || QUIET_MS;
}

/**
 * Where press n is at fraction t of its duration: fading OUT what was shown
 * (opacity a), fading IN the image it starts from (opacity a), or MOVING at
 * eased fraction e.
 */
export function pressAt(state, n, t) {
  const fade = fadesAt(state, n) ? FADE_MS / durationAt(state, n) : 0;
  if (t < fade / 2) return { part: "out", a: 1 - t / (fade / 2) };
  if (t < fade) return { part: "in", a: (t - fade / 2) / (fade / 2) };
  /* a motion eases in and out; a line that does not move — the scaling, a
     random line that did not fire — reaches its output at an even pace */
  const r = fade < 1 ? (t - fade) / (1 - fade) : 1;
  return { part: "move", e: movesAt(state, n) ? easeInOut(r) : r };
}

/* ================================= geometry =================================
   Every coordinate the figure uses, so the verify reads the same numbers. */

const COL_GAP = 12;
export const THUMB_COLS = 6;
const THUMB_GAP = 6;
const RANGES_H = 200;
const CURVE = 176;
export const MAG_CELLS = 20;
const MAG = 164;

/* EVERY SIZE THE PAGE'S HEIGHT READS IS CAPPED AT ITS VALUE AT 535 PX, the
   side layout's width under a scrollbar, so a scrollbar cannot change the
   height it answers to. Measured 2026-09-16 when the shooter could not settle
   the Noise page: at a 900 × 1200 frame, 255 px panels made the document 1,211
   tall, its scrollbar narrowed the canvas to 535 and the panels to 247, the
   document fell to 1,200, the scrollbar went, and the page flipped between the
   two every 200 ms. */
/* Under Classification the second row is the class label, LABEL_ROW tall, at the
   mask's place (his pick B): the rows line up with Segmentation's, and the page is
   207 px shorter. */
export const LABEL_ROW = 40;

export function figureLayout(w, params = {}) {
  const s = Math.min(247, Math.floor((w - 2 * PAD - COL_GAP) / 2));
  const imgY = 54;
  const maskY = imgY + s + 24;
  const line1 = maskY + (isClassification(params) ? LABEL_ROW : s) + 20;
  return { s, x0: PAD, x1: PAD + s + COL_GAP, imgY, maskY, line1, line2: line1 + 16, bandY: line1 + 38 };
}

export const thumbSize = (w) => Math.min(79, Math.floor((w - 2 * PAD - (THUMB_COLS - 1) * THUMB_GAP) / THUMB_COLS));

export function bandLayout(w, params) {
  const L = figureLayout(w, params);
  const kind = params.transform;
  const top = L.bandY;
  if (kind === "flip" || kind === "rotate") {
    const ts = thumbSize(w);
    const at = (i) => ({ x: PAD + (i % THUMB_COLS) * (ts + THUMB_GAP), y: top + 12 + Math.floor(i / THUMB_COLS) * (ts + 20) });
    return { kind: "grid", top, ts, at, tallyY: top + 12 + 2 * (ts + 20) + 10, height: 2 * (ts + 20) + 34 };
  }
  if (kind === "affine") {
    /* the magnifier is the mask's edge, so there is none under Classification */
    const mag = params.mode === "bilinear" && params.keys !== "image" && !isClassification(params);
    const magTop = top + RANGES_H + 16;
    const lineX = PAD + 96;
    const bs = 84;
    return {
      kind: "ranges",
      top,
      lineX,
      lineW: w - PAD - lineX,
      lineY: top + 26,
      boxY: top + 80,
      bs,
      boxX: [lineX, lineX + bs + 150],
      tallyY: top + 190,
      mag: mag ? { top: magTop, size: MAG, gap: Math.floor((w - 2 * PAD - 3 * MAG) / 2) } : null,
      height: RANGES_H + (mag ? MAG + 70 : 0),
    };
  }
  if (kind === "contrast") return { kind: "curve", top, size: CURVE, height: CURVE + 44 };
  return { kind: "noise", top, size: MAG, height: MAG + 44 };
}

/* THE SAMPLE DICT ABOVE THE LIST (his pick, 2026-09-17): the list and the sample
   start DICT_H lower, and the list area keeps twelve rows under both tasks, since
   at eleven the call under the list reached the row of the note under the sample. */
const DICT_H = 20;

export function pipelineLayout(w) {
  const row = 21;
  const s = 222;
  const top = 36 + DICT_H;
  const listBottom = top + LINES.length * row;
  const detailY = listBottom + 20;
  const stripY = detailY + 48;
  const thumb = Math.floor((w - 2 * PAD - (EPOCHS - 1) * 8) / EPOCHS);
  const ts = Math.min(56, thumb);
  return { row, s, top, dictY: top - 8, sx: w - PAD - s, detailY, stripY, ts, stripGap: (w - 2 * PAD - EPOCHS * ts) / (EPOCHS - 1), height: stripY + 12 + ts + 24 };
}

export function pageHeight(w, params) {
  if (params.topic === "pipeline") return pipelineLayout(w).height;
  return figureLayout(w, params).bandY + bandLayout(w, params).height + 10;
}
