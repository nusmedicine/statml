/* ============================================================================
   Assertions on widget 62's engine, claims, draws, geometry and copy.

       node widgets/_lab/augmentation-verify.mjs

   Imports `widgets/augmentation/engine.js` and `model.js` — the shipping code,
   not the measure script's copy (5.8).

   §1 THE ENGINE AGAINST MONAI 1.6.0: `_lab/augmentation-monai.py` ran MONAI's
   own transforms and dumped `augmentation-monai.json`. Ten Affine arrays
   (bilinear and nearest, zeros padding), four RandAffined draws read through
   their applied matrix, AsDiscrete's threshold, and every direction through a
   non-square file in both reader orders — "xy" as cell 19 is written and "yx"
   as the widget follows it.

   §2 THE CLAIMS THE FIGURE PRINTS, on the widget's own smear: the mask left out
   of keys scores under 0.2 off-centre and at least 0.98 centred under every
   flip and turn; a drawn scale above 1 makes the cell smaller; the outline the
   figure draws covers the mask the engine resamples (5.8: one restatement of
   MONAI's axes serves both).

   §3 THE DRAWS AND THE LIST: a seed gives the same draws; a draw that does not
   fire carries no arguments; prob 0 fires none and prob 1 fires all; every
   argument lies in its range; the default seed opens on the reading its
   comment names; the step list, CacheDataset's boundary and the step labels'
   phases.

   §4 THE GEOMETRY at 550 and 770 for every page: panels, bands and windows
   inside the canvas and above the page's height.

   §5 THE COPY: every string literal in main.js against the struck words.
   Timings are RECORDED and gate nothing.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../augmentation/engine.js";
import * as M from "../augmentation/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const PIN = JSON.parse(readFileSync(join(here, "augmentation-monai.json"), "utf8"));
let checks = 0;
let failed = 0;
function assert(cond, msg) {
  checks += 1;
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${msg}`);
  }
}
const section = (s) => console.log(`\n${s}`);

/* the widget's default arguments: cell 19's values, as main.js declares them */
const BASE = {
  topic: "transforms", transform: "flip", keys: "image,label", cell: "off",
  flip_prob: "0.5", spatial_axis: "0", rotate_prob: "0.5", max_k: "3", affine_prob: "0.25", rotate_range: "10",
  translate_h: "8", translate_w: "8", scale_h: "0.1", scale_w: "0.1", mode: "nearest",
  /* contrast and noise open stronger than cell 19 (Kenneth's round-one pick) */
  contrast_prob: "1", gamma_low: "0.5", gamma_high: "2", noise_prob: "1", std: "0.1", split: "training",
};

/* §1 ---------------------------------------------------------------------- */
section("§1 the engine against MONAI 1.6.0");
{
  const S = PIN.affine_arrays.size;
  const inp = E.make(S, S);
  PIN.affine_arrays.in.forEach((col, x) => col.forEach((v, y) => { inp.d[y * S + x] = v; }));
  const maxDiffXY = (im, arr) => {
    let m = 0;
    arr.forEach((col, x) => col.forEach((v, y) => { m = Math.max(m, Math.abs(im.d[y * S + x] - v)); }));
    return m;
  };
  for (const cs of PIN.affine_arrays.cases) {
    const op = { kind: "affine", rotate: cs.params.rotate_params ?? 0, translate: cs.params.translate_params ?? [0, 0], scale: cs.params.scale_params ?? [1, 1] };
    const m = maxDiffXY(E.applyOp(inp, E.fileOp(op, "xy"), cs.mode), cs.out);
    assert(cs.mode === "nearest" ? m < 1e-6 : m < 1e-5, `Affine ${cs.mode} ${JSON.stringify(cs.params)}: max |engine − MONAI| ${m}`);
  }
  const disc = E.make(S, S);
  PIN.randaffined.disc.forEach((col, x) => col.forEach((v, y) => { disc.d[y * S + x] = v; }));
  for (const cs of PIN.randaffined.cases) {
    const f = E.fileOp({ kind: "affine", rotate: cs.rotate[0], translate: cs.translate, scale: cs.scale }, "xy");
    const mi = maxDiffXY(E.applyOp(inp, f, "bilinear"), cs.image);
    const ml = maxDiffXY(E.applyOp(disc, f, "nearest"), cs.label);
    assert(mi < 1e-5 && ml < 1e-6, `RandAffined draw through its applied matrix: image ${mi}, label ${ml}`);
  }
  const thr = E.discrete({ w: 5, h: 1, c: 1, d: Float32Array.from([0.49, 0.5, 0.51, 1, 255]) }, 0.5);
  assert(Array.from(thr.d).join() === PIN.threshold.join(), `AsDiscrete(0.5): [${Array.from(thr.d)}] against MONAI [${PIN.threshold}]`);

  const TF = PIN.through_file;
  const pic = E.make(TF.width, TF.height);
  TF.file.forEach((row, y) => row.forEach((v, x) => { pic.d[y * TF.width + x] = v; }));
  const maxDiffRows = (im, rows) => {
    if (rows.length !== im.h || rows[0].length !== im.w) return Infinity;
    let m = 0;
    rows.forEach((row, y) => row.forEach((v, x) => { m = Math.max(m, Math.abs(im.d[y * im.w + x] - v)); }));
    return m;
  };
  const P = { kind: "affine", rotate: 0.3, translate: [3, -2], scale: [1.1, 0.9] };
  for (const order of ["xy", "yx"]) {
    const a = TF.orders[order].arrays;
    const run = (op, mode) => E.applyOp(pic, E.fileOp(op, order), mode);
    const d = [
      maxDiffRows(run({ kind: "flip", axis: 0 }), a.flip0),
      maxDiffRows(run({ kind: "flip", axis: 1 }), a.flip1),
      maxDiffRows(run({ kind: "rot90", k: 1 }), a.rot1),
      maxDiffRows(run(P, "bilinear"), a.affine),
      maxDiffRows(run(P, "nearest"), a.affine_nearest),
    ];
    assert(d[0] < 1e-6 && d[1] < 1e-6 && d[2] < 1e-6 && d[3] < 1e-5 && d[4] < 1e-6,
      `through a ${TF.height} × ${TF.width} file in order ${order}: ${d.map((v) => v.toExponential(1)).join(", ")}`);
  }
  assert(TF.orders.yx.flip0 === "top-bottom" && TF.orders.yx.rot1 === "counter-clockwise" && TF.orders.yx.rotate_turn === "clockwise",
    `the directions main.js prints for [C, H, W] are MONAI's: axis 0 ${TF.orders.yx.flip0}, k = 1 ${TF.orders.yx.rot1}, +rotate ${TF.orders.yx.rotate_turn}`);
  assert(E.ORDER === "yx", "the widget follows [C, H, W]");
}

/* §2 ---------------------------------------------------------------------- */
section("§2 the claims on the widget's smear");
{
  const t0 = performance.now();
  const off = M.smear("off");
  const ms = performance.now() - t0;
  const centred = M.smear("centred");
  const area = (m) => m.d.reduce((s, v) => s + (v >= 0.5 ? 1 : 0), 0);
  assert(area(off.mask) === 15380 && area(centred.mask) === 15373, `the white cell is ${area(off.mask)} px off-centre and ${area(centred.mask)} centred (measured 15,380 and 15,373)`);
  assert(M.smear("off") === off, "the smear is built once per placement");
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of off.image.d) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert(Math.abs(lo) < 1e-6 && Math.abs(hi - 1) < 1e-6, `the image after ScaleIntensityd spans [${lo}, ${hi}]`);

  const ops = [{ kind: "flip", axis: 0 }, { kind: "flip", axis: 1 }, { kind: "rot90", k: 1 }, { kind: "rot90", k: 2 }, { kind: "rot90", k: 3 }];
  for (const op of ops) {
    const f = E.fileOp(op);
    const dOff = E.dice(off.mask, E.applyOp(off.mask, f, "nearest"));
    const dCen = E.dice(centred.mask, E.applyOp(centred.mask, f, "nearest"));
    assert(dOff < 0.2, `mask left out of keys, off-centre, ${JSON.stringify(op)}: Dice ${dOff.toFixed(3)} < 0.2`);
    assert(dCen >= 0.98, `mask left out of keys, centred, ${JSON.stringify(op)}: Dice ${dCen.toFixed(3)} ≥ 0.98`);
  }
  const shrunk = area(E.applyOp(off.mask, E.fileOp({ kind: "affine", scale: [1.1, 1.1] }), "nearest"));
  assert(shrunk < area(off.mask) * 0.85, `a drawn scale of 1.1 makes the white cell ${shrunk} px against ${area(off.mask)}`);

  /* the outline the figure draws covers the mask the engine resamples */
  const inside = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const cases = [
    { kind: "flip", axis: 0 }, { kind: "flip", axis: 1 }, { kind: "rot90", k: 1 }, { kind: "rot90", k: 3 },
    { kind: "affine", rotate: 0.17, translate: [-6.5, 7.2], scale: [1.08, 0.95] },
    { kind: "affine", rotate: -0.12, translate: [8, -8], scale: [0.9, 1.1] },
  ];
  for (const op of cases) {
    const f = E.fileOp(op);
    const moved = E.applyOp(off.mask, f, "nearest");
    const pts = M.outlineOf(off.wbc, [f]);
    let both = 0;
    let a = 0;
    let b = 0;
    for (let y = 0; y < M.N; y += 1) {
      for (let x = 0; x < M.N; x += 1) {
        const u = moved.d[y * M.N + x] >= 0.5;
        const v = inside(pts, x, y);
        a += u;
        b += v;
        both += u && v;
      }
    }
    const d = (2 * both) / (a + b);
    assert(d > 0.99, `the outline covers the resampled mask under ${JSON.stringify(op)}: Dice ${d.toFixed(4)}`);
  }
  console.log(`  the smear in ${ms.toFixed(0)} ms (recorded, not gated)`);
}

/* §3 ---------------------------------------------------------------------- */
section("§3 the draws and the list");
{
  for (const kind of M.KINDS) {
    const p = { ...BASE, transform: kind };
    const a = M.computeTransforms(p, makeRng(7)).draws;
    const b = M.computeTransforms(p, makeRng(7)).draws;
    assert(JSON.stringify(a) === JSON.stringify(b), `${kind}: one seed gives the same draws`);
    assert(a.every((d) => d.fired || Object.keys(d).length === 1), `${kind}: a draw that does not fire carries no arguments`);
    const none = M.computeTransforms({ ...p, [`${kind}_prob`]: "0" }, makeRng(7)).draws;
    const all = M.computeTransforms({ ...p, [`${kind}_prob`]: "1" }, makeRng(7)).draws;
    assert(none.every((d) => !d.fired) && all.every((d) => d.fired), `${kind}: prob 0 fires none of ${M.DRAWS}, prob 1 fires all`);
  }
  {
    const p = { ...BASE, transform: "affine", affine_prob: "1", rotate_range: "20", translate_h: "32", translate_w: "8", scale_h: "0.3", scale_w: "0.1" };
    const ok = M.computeTransforms(p, makeRng(3)).draws.every(({ op }) => Math.abs(op.rotate) <= 20 * Math.PI / 180
      && Math.abs(op.translate[0]) <= 32 && Math.abs(op.translate[1]) <= 8
      && Math.abs(op.scale[0] - 1) <= 0.3 && Math.abs(op.scale[1] - 1) <= 0.1);
    assert(ok, "affine: every draw inside its ranges, in (height, width) order");
    const g = M.computeTransforms({ ...BASE, transform: "contrast", contrast_prob: "1", gamma_low: "3", gamma_high: "1" }, makeRng(3)).draws;
    assert(g.every((d) => d.gamma >= 1 && d.gamma <= 3), "contrast: a reversed pair is read as (min, max), as MONAI reads it");
    const s = M.computeTransforms({ ...BASE, transform: "noise", noise_prob: "1", std: "0.05" }, makeRng(3)).draws;
    assert(s.every((d) => d.sigma >= 0 && d.sigma <= 0.05), "noise: σ drawn from 0 to std");
  }
  {
    /* the default seed opens on the reading main.js's comment names */
    const flip = M.computeTransforms({ ...BASE }, makeRng(106)).draws;
    const rot = M.computeTransforms({ ...BASE, transform: "rotate" }, makeRng(106)).draws;
    const aff = M.computeTransforms({ ...BASE, transform: "affine" }, makeRng(106)).draws;
    const pipe = M.computePipeline({ ...BASE, topic: "pipeline" }, makeRng(106));
    const e0 = M.LINES.map((l, i) => (l.random && M.firedIn(i, pipe.epochs[0]) ? l.random : null)).filter(Boolean);
    assert(flip[0].fired && flip.filter((d) => d.fired).length === 5, "seed 106: Flip's first draw is applied, five of twelve are");
    assert(new Set(rot.filter((d) => d.fired).map((d) => d.op.k)).size === 3, "seed 106: Rotate draws every k");
    assert(aff.filter((d) => d.fired).length === 5, "seed 106: Affine applies five of twelve");
    assert(e0.join(" ") === "flip0 rot90 affine", `seed 106: the first epoch fires ${e0.join(", ")}`);
    const src = readFileSync(join(here, "..", "augmentation", "main.js"), "utf8");
    assert(/default: 106 \}/.test(src), "main.js declares seed 106 as the default");
  }
  {
    const train = M.computePipeline({ ...BASE, topic: "pipeline" }, makeRng(5));
    const val = M.computePipeline({ ...BASE, topic: "pipeline", split: "validation" }, makeRng(5));
    assert(train.total === 12 + (M.EPOCHS - 1) * 7, `training: ${train.total} presses — twelve lines, then seven an epoch`);
    assert(val.total === 6 + (M.EPOCHS - 1), `validation: ${val.total} presses — six fixed lines, then the cached sample an epoch`);
    const phases = Array.from({ length: train.total }, (_, n) => M.pipelinePhase(train, n));
    assert(phases.filter((p) => p === "epoch").length === M.EPOCHS - 1 && phases[12] === "epoch", "Next epoch is offered at exactly the seven epoch boundaries");
    const s = 12 + 3; // epoch 2, three lines past SpatialPadd
    const st = M.LINES.map((_, i) => M.lineStatus(train, s, i).status);
    assert(st.slice(0, M.FIRST_RANDOM).every((v) => v === "cached"), "from epoch 2 the lines before the first random one are served from the cache");
    assert(M.lineStatus(train, s, M.LAST).status === "pending", "AsDiscreted, after the random lines, runs again in epoch 2");
    assert(M.LINES.every((l, i) => !l.random || M.lineStatus(val, 3, i).status === "absent"), "the validation list has no random line");
    const e = val.linesOf(0)[M.LAST];
    assert(e.image === M.smear("off").image && e.ops.length === 0, "a validation sample is the scaled image, untouched");
    for (let k = 0; k < M.EPOCHS; k += 1) {
      const fin = train.linesOf(k)[M.LAST];
      const ep = train.epochs[k];
      const spatial = [ep.flip0, ep.flip1, ep.k > 0, Boolean(ep.affine)].filter(Boolean).length;
      assert(fin.ops.length === spatial && fin.mask.d.every((v) => v === 0 || v === 1), `training epoch ${k + 1}: ${spatial} spatial lines applied, the mask 0/1 after AsDiscreted`);
    }
  }
}

/* §3b --------------------------------------------------------------------- */
section("§3b the tween: its ends, and its pace");
{
  const off = M.smear("off");
  const maxDiff = (a, b) => {
    if (a.w !== b.w || a.h !== b.h) return Infinity;
    let m = 0;
    for (let i = 0; i < a.d.length; i += 1) m = Math.max(m, Math.abs(a.d[i] - b.d[i]));
    return m;
  };
  const ops = [
    { kind: "flip", axis: 0 }, { kind: "flip", axis: 1 },
    { kind: "rot90", k: 1 }, { kind: "rot90", k: 2 }, { kind: "rot90", k: 3 },
    { kind: "affine", rotate: 0.15, translate: [-6, 5], scale: [1.08, 0.93] },
  ];
  for (const op of ops) {
    const f = E.fileOp(op);
    const start = M.tweenWarp(f, 0);
    assert(start.rotate === 0 && start.translate.every((v) => v === 0) && start.scale.every((v) => v === 1),
      `${JSON.stringify(op)}: the motion starts at no change`);
    /* the last frame, as a warp through the engine, is the engine's own result */
    const end = E.applyOp(off.mask, M.tweenWarp(f, 1), "bilinear");
    const exact = E.applyOp(off.mask, f, "bilinear");
    assert(maxDiff(end, exact) < 1e-6, `${JSON.stringify(op)}: the motion ends on the engine's result (max ${maxDiff(end, exact).toExponential(1)})`);
    /* the outline in motion ends where the finished outline is */
    const a = M.outlineOf(off.wbc, [M.tweenWarp(f, 1)]);
    const b = M.outlineOf(off.wbc, [f]);
    const far = a.reduce((m, p, i) => Math.max(m, Math.hypot(p[0] - b[i][0], p[1] - b[i][1])), 0);
    assert(far < 1e-6, `${JSON.stringify(op)}: the outline in motion ends on the finished outline (${far.toExponential(1)} px)`);
  }
  {
    /* a quarter turn in motion turns counter-clockwise, as k does under [C, H, W]:
       halfway, the white cell's centre has turned +45° on screen */
    const f = E.fileOp({ kind: "rot90", k: 1 });
    const c = (M.N - 1) / 2;
    const [x, y] = E.mapPoint([off.wbc.x - 0.5, off.wbc.y - 0.5], M.tweenWarp(f, 0.5), M.N, M.N);
    const before = Math.atan2(off.wbc.y - 0.5 - c, off.wbc.x - 0.5 - c);
    const after = Math.atan2(y - c, x - c);
    const turned = ((((before - after) * 180) / Math.PI) + 360) % 360;
    assert(Math.abs(turned - 45) < 1e-6, `k = 1 halfway: the cell's centre turned ${turned.toFixed(3)}° counter-clockwise on screen`);
  }
  {
    /* the frame renderer at the image's own size and no change reproduces the image */
    const bytes = M.renderWarp(off.image, M.N, { rotate: 0, translate: [0, 0], scale: [1, 1] });
    let m = 0;
    for (let i = 0; i < M.N * M.N; i += 1) {
      for (let ch = 0; ch < 3; ch += 1) m = Math.max(m, Math.abs(bytes[4 * i + ch] - 255 * off.image.d[ch * M.N * M.N + i]));
    }
    assert(m <= 0.5, `renderWarp at no change reproduces the image to ${m.toFixed(2)} of 255`);
    const mid = M.renderWarp(off.image, 64, M.tweenWarp(E.fileOp({ kind: "flip", axis: 0 }), 0.5));
    assert(mid.every((v) => v === 0), "a mirror halfway draws nothing: the image has no height");
  }
  {
    const t = M.computeTransforms({ ...BASE, transform: "affine" }, makeRng(106));
    assert(t.draws.every((d, i) => M.durationAt(t, i) === M.FADE_MS + (d.fired ? M.TWEEN_MS : 0)),
      "every draw fades back to the original first, and an applied one then moves for TWEEN_MS");
    const p = M.computePipeline({ ...BASE, topic: "pipeline" }, makeRng(106));
    const startsEpoch = (i) => i > 0 && p.steps[i].epoch > p.steps[i - 1].epoch;
    assert(p.steps.every((st, i) => M.durationAt(p, i)
      === ((startsEpoch(i) ? M.FADE_MS : 0) + (M.stepChange(p, st).kind === "none" ? 0 : M.TWEEN_MS) || M.QUIET_MS)),
      "a training epoch's first press fades to the cached sample; a line that changes the sample moves for TWEEN_MS; any other holds QUIET_MS");
    const v = M.computePipeline({ ...BASE, topic: "pipeline", split: "validation" }, makeRng(106));
    assert(v.steps.every((st, i) => M.stepChange(v, st).kind === "none" && M.durationAt(v, i) === M.QUIET_MS),
      "no press of the validation list fades or moves the sample");
    /* the parts of a press, in order */
    const parts = [0, 0.05, 0.12, 0.2, 0.5, 0.999].map((f) => M.pressAt(t, 0, f));
    const fade = M.FADE_MS / M.durationAt(t, 0);
    assert(parts[0].part === "out" && parts[0].a === 1 && M.pressAt(t, 0, fade * 0.75).part === "in" && M.pressAt(t, 0, fade).part === "move",
      `a draw's press: out, then in, then the motion from ${(100 * fade).toFixed(0)} % of it`);
    const e0 = M.pressAt(t, 0, fade).e;
    const e1 = M.pressAt(t, 0, 1 - 1e-9).e;
    assert(!t.draws[0].fired || (e0 < 1e-6 && e1 > 1 - 1e-6), "the motion runs from no change to the drawn value");
    assert(parts.every((q) => (q.part === "move" ? q.e >= 0 && q.e <= 1 : q.a >= 0 && q.a <= 1)), "every opacity and fraction lies in [0, 1]");

    /* the validation list is val_test_transforms as cell 19 writes it, and no epoch changes its sample */
    const vNames = v.list.map((i) => M.LINES[i].cls).join(",");
    assert(vNames === "LoadImaged,EnsureChannelFirstd,EnsureTyped,ScaleIntensityd,SpatialPadd,AsDiscreted",
      `val_test_transforms lists its own six lines: ${vNames}`);
    assert(p.list.length === M.LINES.length, "train_transforms lists all twelve lines");
    const scaled = M.smear("off").image;
    assert(Array.from({ length: M.EPOCHS }, (_, e) => v.linesOf(e)[M.LAST]).every((fin) => fin.image === scaled && fin.ops.length === 0),
      "every validation epoch's sample is the scaled image, untouched");
    const before = M.beforeStep(p, { epoch: 1, line: M.FIRST_RANDOM });
    assert(before === p.linesOf(1)[M.FIRST_RANDOM - 1], "an epoch's first random line starts from the cached output of the line before it");
    /* the list in motion is the epoch the sample is in */
    const boundary = p.steps.findIndex((st) => st.epoch === 1);
    const moving = M.listAt(p, boundary, true);
    const settled = M.listAt(p, boundary, false);
    assert(moving.epoch === 1 && moving.running === M.FIRST_RANDOM && moving.status.slice(0, M.FIRST_RANDOM).every((v) => v === "cached"),
      "a press that starts epoch 2 shows epoch 2's list, its first random line running");
    assert(settled.epoch === 0 && settled.done === M.LAST && settled.running === -1, "at rest before that press, the list is epoch 1's, AsDiscreted just run");
    const vEnd = M.listAt(v, v.total, false);
    assert(vEnd.done === -1 && vEnd.status.every((st, i) => (M.LINES[i].random ? st === "absent" : st === "cached")),
      "the validation list's last epoch: every line cached or absent, none lit as just run");
  }
}

/* §4 ---------------------------------------------------------------------- */
section("§4 the geometry");
{
  const pages = [
    { ...BASE },
    { ...BASE, transform: "rotate" },
    { ...BASE, transform: "affine" },
    { ...BASE, transform: "affine", mode: "bilinear" },
    { ...BASE, transform: "affine", mode: "bilinear", keys: "image" },
    { ...BASE, transform: "contrast" },
    { ...BASE, transform: "noise" },
    { ...BASE, topic: "pipeline" },
  ];
  for (const w of [550, 770]) {
    for (const p of pages) {
      const h = M.pageHeight(w, p);
      const tag = `${w} px, ${p.topic === "pipeline" ? "pipeline" : `${p.transform}${p.mode === "bilinear" ? " bilinear" : ""}${p.keys === "image" ? " keys image" : ""}`}`;
      if (p.topic === "pipeline") {
        const P = M.pipelineLayout(w);
        assert(P.sx + P.s <= w - M.PAD + 0.5 && P.sx > M.PAD + 150 + 60, `${tag}: the sample beside the list, inside the canvas`);
        assert(M.PAD + M.EPOCHS * P.ts + (M.EPOCHS - 1) * P.stripGap <= w - M.PAD + 0.5 && P.stripGap >= 4, `${tag}: the epochs strip fits`);
        assert(P.stripY + 12 + P.ts + 13 <= h, `${tag}: the strip's labels above the height ${h}`);
        continue;
      }
      const L = M.figureLayout(w);
      assert(L.x1 + L.s <= w - M.PAD, `${tag}: the two columns inside the canvas`);
      const B = M.bandLayout(w, p);
      if (B.kind === "grid") {
        const last = B.at(M.DRAWS - 1);
        assert(last.x + B.ts <= w - M.PAD + 0.5 && B.tallyY <= h, `${tag}: the grid and its tally fit`);
      }
      if (B.kind === "ranges") {
        assert(B.boxX[1] + B.bs + 30 <= w - M.PAD && B.tallyY <= h, `${tag}: both boxes and the tally fit`);
        if (B.mag) assert(M.PAD + 3 * B.mag.size + 2 * B.mag.gap <= w - M.PAD + 0.5 && B.mag.top + 14 + B.mag.size + 48 <= h, `${tag}: the three windows fit`);
        assert((p.mode === "bilinear" && p.keys !== "image") === Boolean(B.mag), `${tag}: the windows show exactly when the label is resampled bilinear`);
      }
      if (B.kind === "curve") assert(M.PAD + 26 + B.size + 28 + 200 <= w && B.top + 8 + B.size + 26 <= h, `${tag}: the curve and its notes fit`);
      if (B.kind === "noise") assert(M.PAD + B.size + 30 + 120 <= w && B.top + 8 + B.size + 28 <= h, `${tag}: the difference panel and the σ line fit`);
    }
  }
}

/* §5 ---------------------------------------------------------------------- */
section("§5 the copy");
{
  const src = readFileSync(join(here, "..", "augmentation", "main.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  const struck = [
    /\bnever\b/i, /\bsits?\b/i, /\bsitting\b/i, /\bfalls?\b/i, /\blies?\b/i, /\bwalks?\b/i, /\bcard\b/i, /\brung\b/i,
    /\bwell\b/i, /\bplain\b/i, /\btrench\b/i, /\bframe\b/i, /\bchose\b/i, /\bwants?\b/i,
    /\barrives?\b/i, /\bfollows?\b/i, /\bagree\b/i, /\bpresses\b/i, /\bstages?\b/i, /\bcrosses\b/i, /\bjoins\b/i, /\bskips\b/i,
    /\bwaits?\b/i, /\breach(es)?\b/i, /\bstands?\b/i, /\bsay\b/i, /\bsees?\b/i, /\blooks?\b/i, /\bnotebook\b/i, /\bcell 19\b/i,
  ];
  for (const s of strings) {
    if (s.length < 12 || /^[\w-]+$/.test(s)) continue;
    if (/^<|var\(--/.test(s)) continue;
    for (const re of struck) assert(!re.test(s), `struck word ${re} in "${s.slice(0, 60)}"`);
  }
  console.log(`  ${strings.length} string literals read`);
}

console.log(`\n${checks} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
