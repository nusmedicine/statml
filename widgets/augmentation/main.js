/* ============================================================================
   Widget 62 · Image augmentation — cell 19's random transforms, one at a time
   on a blood smear and its mask, then all of them in order, epoch by epoch.

   PHM5005 06-3 Load/Transform: cell 15 (the Fixed / Augment table, the
   syntax block, Composition, the Dataset classes), cell 19 (the pipeline and
   its values), cells 27–29 (image, mask, overlay); 06-2 cell 1 §3 (the
   preprocessing figure). `engine.js` is MONAI 1.6.0 as measured, `model.js`
   the smear, the draws, the listing and the geometry; this file the strings,
   the colours and the animation.

   DECISIONS, so they are not re-argued (`_lab/augmentation-mock.html`,
   Kenneth's picks 2026-09-15, catalogue slot 62):

    1. TWO PAGES under Topic, Transforms · Pipeline, in cell 15's order: each
       transform with its syntax, then Composition and Loading.

    2. THE CALL IS THE RAIL (pick: "the call as code"): each transform's own
       line with its arguments as slots (core's `expr`), cell 19's values as the
       defaults, so a slot away from its default shows what differs from the
       code the students run.

    3. THE FIGURE IS HIS PAIR FIGURE TURNED A QUARTER (pick B): Original ·
       Augmented across, image over mask, the mask's outline on the augmented
       image. MONAI returns the same square with zeros where a warp uncovers
       it, not his figure's tilted frame, and the widget draws what MONAI
       returns — the departure to declare.

    4. [C, H, W] (pick: he adds reader="PILReader", reverse_indexing=False to
       cell 19's LoadImaged): spatial_axis=0 flips top to bottom, a quarter turn
       is counter-clockwise, translate and scale are (height, width). Every
       direction measured through a non-square file on MONAI.

    5. A DRAW APPLIES THE CALL TO THE ORIGINAL ONCE, and twelve draws pile up
       under the figure (flip and rotate a grid of samples, affine each
       argument's range, contrast the γ curves, noise the difference × 20). A
       draw that does not fire carries no arguments and adds no dot: MONAI
       returns the sample unchanged. (The mock drew all twelve affine draws as
       applied so the ranges filled; that drew arguments for samples MONAI
       leaves alone, so the prob slot is how a reader fills the range.)

    6. THE CASES THAT FAIL (picks): keys=["image"] leaves the mask in place and
       prints its Dice against the moved cell; a White blood cell control,
       Off-centre · Centred, because that Dice is 0.00 off-centre and 0.99
       centred; mode "bilinear" for the label opens three magnified windows on
       the mask's edge; the Pipeline page's Split runs val_test_transforms.

    7. THE PIPELINE PAGE IS THE LISTING BESIDE ONE SAMPLE (pick C): a press
       runs the next line, the label reads Next epoch after AsDiscreted, and
       from the second epoch the lines before the first random one are served
       from CacheDataset's cache.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import * as M from "./model.js";

/* --- primitives ------------------------------------------------------------ */

const easeOut = (t) => 1 - (1 - t) ** 3;
const signed = (v, d) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d));
const DEG = Math.PI / 180;

function txt(ctx, colors, s, x, y, o = {}) {
  const { color = colors.ink2, align = "left", size = colors.fsSm, baseline = "alphabetic", mono = false, weight = "" } = o;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? colors.mono : colors.font}`.trim();
  ctx.fillText(s, x, y);
  ctx.restore();
}
const caption = (ctx, colors, s, x, y) => txt(ctx, colors, s, x, y, { color: colors.ink2, weight: "600" });
const note = (ctx, colors, s, x, y, tone, o = {}) => txt(ctx, colors, s, x, y, { color: tone ?? colors.ink3, size: colors.fsXs, ...o });
const code = (ctx, colors, s, x, y, tone) => txt(ctx, colors, s, x, y, { color: tone ?? colors.ink2, size: colors.fsXs, mono: true });

function frame(ctx, x, y, w, h, stroke, width = 1) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
function dot(ctx, x, y, color, r = 3) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/* AN IMAGE ON THE CANVAS. The engine's 512 × 512 arrays are averaged down to
   the panel's DEVICE pixels here, in JavaScript, and drawn 1 : 1: the
   browser's own downscaling of a large bitmap is not guaranteed to give the
   same pixels twice, and the fingerprint hashes pixels. Kept per image and
   size, so a frame redraws a bitmap and computes nothing. A mask is drawn in
   the ground truth's colour with its value as the opacity, so a bilinear
   mask's fractions show as partial colour. */
const bitmaps = new WeakMap();
function bitmapOf(im, px, tint) {
  let per = bitmaps.get(im);
  if (!per) {
    per = new Map();
    bitmaps.set(im, per);
  }
  const key = `${px}:${tint ?? ""}`;
  if (per.has(key)) return per.get(key);
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const g = c.getContext("2d");
  const id = g.createImageData(px, px);
  const acc = new Float32Array(px * px * 3);
  const cnt = new Float32Array(px * px);
  const n = im.w * im.h;
  for (let y = 0; y < im.h; y += 1) {
    const ty = Math.min(px - 1, Math.floor((y * px) / im.h));
    for (let x = 0; x < im.w; x += 1) {
      const t = ty * px + Math.min(px - 1, Math.floor((x * px) / im.w));
      const i = y * im.w + x;
      cnt[t] += 1;
      acc[3 * t] += im.d[i];
      if (im.c === 3) {
        acc[3 * t + 1] += im.d[n + i];
        acc[3 * t + 2] += im.d[2 * n + i];
      }
    }
  }
  const rgb = tint ? [1, 3, 5].map((k) => parseInt(tint.slice(k, k + 2), 16)) : null;
  for (let t = 0; t < px * px; t += 1) {
    const k = cnt[t] || 1;
    const o = 4 * t;
    if (rgb) {
      id.data[o] = rgb[0];
      id.data[o + 1] = rgb[1];
      id.data[o + 2] = rgb[2];
      id.data[o + 3] = Math.round(255 * Math.max(0, Math.min(1, acc[3 * t] / k)));
    } else {
      for (let ch = 0; ch < 3; ch += 1) {
        const v = acc[3 * t + (im.c === 3 ? ch : 0)] / k;
        id.data[o + ch] = Math.max(0, Math.min(255, Math.round(255 * v)));
      }
      id.data[o + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
  per.set(key, c);
  return c;
}
function paintImage(ctx, im, x, y, size, tint = null) {
  const px = Math.max(1, Math.round(size * (globalThis.devicePixelRatio || 1)));
  ctx.drawImage(bitmapOf(im, px, tint), x, y, size, size);
}

/* An outline in the file's coordinates, scaled to a panel, under a halo in the
   surface colour: the picture under it is data of every shade. Faint lines
   take no halo, which would stack into a band. */
function outline(ctx, colors, pts, x, y, size, { color, width = 1.5, dash = null, alpha = 1 }) {
  const s = size / M.N;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i) ctx.lineTo(x + (px + 0.5) * s, y + (py + 0.5) * s);
    else ctx.moveTo(x + (px + 0.5) * s, y + (py + 0.5) * s);
  });
  ctx.closePath();
  if (dash) ctx.setLineDash(dash);
  if (alpha >= 1) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = width + 2;
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}
function imagePanel(ctx, colors, im, x, y, size, lines = [], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  paintImage(ctx, im, x, y, size);
  ctx.restore();
  lines.forEach((l) => outline(ctx, colors, l.pts, x, y, size, { ...l, alpha: (l.alpha ?? 1) * alpha }));
  frame(ctx, x, y, size, size, colors.grid);
}
function maskPanel(ctx, colors, m, x, y, size, alpha = 1) {
  ctx.save();
  if (alpha >= 1) {
    ctx.fillStyle = colors.surface;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = alpha;
  paintImage(ctx, m, x, y, size, colors.reference);
  ctx.restore();
  frame(ctx, x, y, size, size, colors.grid);
}

/* ============================ the Transforms page ========================= */

const QUARTERS = { 1: "a quarter turn", 2: "a half turn", 3: "three quarter turns" };
const probOf = (params, kind) => params[`${kind}_prob`];

/** The draw's arguments as one line, in the call's own order and units. */
function drawText(kind, d, params) {
  if (!d.fired) return `not applied: prob = ${probOf(params, kind)}`;
  if (kind === "flip") return `applied: spatial_axis=${d.op.axis} flips the image ${d.op.axis === 0 ? "top to bottom" : "left to right"}`;
  if (kind === "rotate") return `applied: k = ${d.op.k}, ${QUARTERS[d.op.k]} counter-clockwise`;
  if (kind === "affine") {
    const { rotate, translate, scale } = d.op;
    return `applied: rotate ${signed(rotate / DEG, 1)}°, translate (${signed(translate[0], 1)}, ${signed(translate[1], 1)}) px, `
      + `scale (${scale[0].toFixed(2)}, ${scale[1].toFixed(2)})`;
  }
  if (kind === "contrast") return `applied: γ = ${d.gamma.toFixed(2)}`;
  return `applied: σ = ${d.sigma.toFixed(4)}, a standard deviation of ${(255 * d.sigma).toFixed(1)} grey levels of 255`;
}
function shortText(kind, d) {
  if (!d.fired) return "not applied";
  if (kind === "flip") return "flipped";
  if (kind === "rotate") return `k = ${d.op.k}`;
  if (kind === "contrast") return `γ ${d.gamma.toFixed(2)}`;
  if (kind === "noise") return `σ ${d.sigma.toFixed(4)}`;
  return "applied";
}

/* the mask's outline for a sample: where the mask IS, which under keys=["image"] is where it was */
const maskLine = (smp) => M.outlineOf(smp.wbc, smp.stale === null ? smp.ops : []);

function paintAugmented(ctx, colors, L, state, params, i, alpha) {
  const smp = state.sample(i, params.cell);
  const lines = [];
  if (state.kind === "affine" && state.withLabel) {
    for (let j = 0; j < i; j += 1) {
      if (state.draws[j].fired) lines.push({ pts: M.outlineOf(smp.wbc, M.fileOpsOf(state.draws[j])), color: colors.empirical, width: 1, alpha: 0.5 });
    }
  }
  if (smp.stale !== null) {
    lines.push({ pts: M.outlineOf(smp.wbc, []), color: colors.reference, width: 2 });
    lines.push({ pts: M.outlineOf(smp.wbc, smp.ops), color: colors.highlight, width: 1.3, dash: [4, 3] });
  } else {
    lines.push({ pts: maskLine(smp), color: colors.reference });
  }
  imagePanel(ctx, colors, smp.image, L.x1, L.imgY, L.s, lines, alpha);
  maskPanel(ctx, colors, smp.mask, L.x1, L.maskY, L.s, alpha);
  return smp;
}

function drawGrid(ctx, colors, w, params, state, n) {
  const B = M.bandLayout(w, params);
  const kind = state.kind;
  for (let i = 0; i < M.DRAWS; i += 1) {
    const { x, y } = B.at(i);
    if (i >= n) {
      frame(ctx, x, y, B.ts, B.ts, colors.grid);
      continue;
    }
    const smp = state.sample(i, params.cell);
    imagePanel(ctx, colors, smp.image, x, y, B.ts, [{ pts: maskLine(smp), color: colors.reference, width: 1.2 }]);
    const d = state.draws[i];
    note(ctx, colors, d.fired ? shortText(kind, d) : "—", x + B.ts / 2, y + B.ts + 13, d.fired ? colors.ink1 : colors.ink3, { align: "center" });
  }
  if (!n) return;
  const shown = state.draws.slice(0, n);
  const fired = shown.filter((d) => d.fired);
  if (kind === "flip") {
    note(ctx, colors, `applied in ${fired.length} of ${n} draws; prob = ${probOf(params, kind)}`, M.PAD, B.tallyY, colors.ink1);
    return;
  }
  const c = [1, 2, 3].map((k) => fired.filter((d) => d.op.k === k).length);
  note(ctx, colors, `k = 1: ${c[0]} · k = 2: ${c[1]} · k = 3: ${c[2]} · not applied: ${n - fired.length}; each k is a quarter turn counter-clockwise`,
    M.PAD, B.tallyY, colors.ink1);
}

function drawRanges(ctx, colors, w, params, state, n) {
  const B = M.bandLayout(w, params);
  const shown = state.draws.slice(0, n);
  const lastFired = shown.map((d, i) => (d.fired ? i : -1)).filter((i) => i >= 0).pop();
  const pointTone = (i) => (i === lastFired ? colors.highlight : colors.empirical);
  const r = Number(params.rotate_range);
  note(ctx, colors, "rotate, degrees", M.PAD, B.lineY + 4, colors.ink2);
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(B.lineX, B.lineY);
  ctx.lineTo(B.lineX + B.lineW, B.lineY);
  ctx.stroke();
  ctx.restore();
  note(ctx, colors, signed(-r, 0), B.lineX, B.lineY + 16, colors.ink3);
  note(ctx, colors, "0", B.lineX + B.lineW / 2, B.lineY + 16, colors.ink3, { align: "center" });
  note(ctx, colors, String(r), B.lineX + B.lineW, B.lineY + 16, colors.ink3, { align: "right" });
  const along = (v, range) => (range > 0 ? (v + range) / (2 * range) : 0.5);
  shown.forEach((d, i) => { if (d.fired) dot(ctx, B.lineX + along(d.op.rotate / DEG, r) * B.lineW, B.lineY, pointTone(i), i === lastFired ? 4 : 3); });

  const box = (bx, label, rows, cols, center, valOf, ticks, rowTicks) => {
    note(ctx, colors, label, bx, B.boxY - 8, colors.ink2);
    note(ctx, colors, rowTicks[0], bx + B.bs + 5, B.boxY + 8, colors.ink3);
    note(ctx, colors, rowTicks[1], bx + B.bs + 5, B.boxY + B.bs, colors.ink3);
    frame(ctx, bx, B.boxY, B.bs, B.bs, colors.axis);
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(bx + B.bs / 2, B.boxY);
    ctx.lineTo(bx + B.bs / 2, B.boxY + B.bs);
    ctx.moveTo(bx, B.boxY + B.bs / 2);
    ctx.lineTo(bx + B.bs, B.boxY + B.bs / 2);
    ctx.stroke();
    ctx.restore();
    note(ctx, colors, "width", bx + B.bs / 2, B.boxY + B.bs + 14, colors.ink3, { align: "center" });
    note(ctx, colors, "height", bx - 6, B.boxY + B.bs / 2 + 3, colors.ink3, { align: "right" });
    note(ctx, colors, ticks[0], bx, B.boxY + B.bs + 14, colors.ink3);
    note(ctx, colors, ticks[1], bx + B.bs, B.boxY + B.bs + 14, colors.ink3, { align: "right" });
    shown.forEach((d, i) => {
      if (!d.fired) return;
      const [vh, vw] = valOf(d);
      dot(ctx, bx + along(vw - center, cols) * B.bs, B.boxY + along(vh - center, rows) * B.bs, pointTone(i), i === lastFired ? 4 : 3);
    });
  };
  const th = Number(params.translate_h);
  const tw = Number(params.translate_w);
  const sh = Number(params.scale_h);
  const sw = Number(params.scale_w);
  box(B.boxX[0], "translate, px", th, tw, 0, (d) => d.op.translate, [signed(-tw, 0), String(tw)], [signed(-th, 0), String(th)]);
  box(B.boxX[1], "scale", sh, sw, 1, (d) => d.op.scale, [(1 - sw).toFixed(1), (1 + sw).toFixed(1)], [(1 - sh).toFixed(1), (1 + sh).toFixed(1)]);
  if (n) {
    const fired = shown.filter((d) => d.fired).length;
    note(ctx, colors, `applied in ${fired} of ${n} draws; a dot is one applied draw's argument, on the range it is drawn from`, M.PAD, B.tallyY, colors.ink1);
  }
  if (B.mag) drawMagnifier(ctx, colors, w, B, state, params, n);
}

function drawMagnifier(ctx, colors, w, B, state, params, n) {
  const { top, size, gap } = B.mag;
  caption(ctx, colors, "The mask's edge, 20 × 20 pixels", M.PAD, top + 4);
  const last = n > 0 ? state.sample(n - 1, params.cell) : null;
  if (!last || !state.draws[n - 1].fired) {
    note(ctx, colors, n ? "the last draw was not applied, so the mask was not resampled" : "a draw with mode \"bilinear\" resamples the mask here",
      M.PAD, top + 24, colors.ink3);
    return;
  }
  const edge = M.maskEdge(last);
  const cell = size / M.MAG_CELLS;
  const windows = [
    [last.nearest, "nearest", "only 0 and 1"],
    [last.mask, "bilinear", `${edge.between} values between 0 and 1`],
    [edge.disc, "bilinear, then AsDiscreted", `${edge.differ} pixels differ from nearest`],
  ];
  windows.forEach(([m, label, sub], k) => {
    const x = M.PAD + k * (size + gap);
    const y = top + 14;
    ctx.save();
    ctx.fillStyle = colors.surface;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = colors.reference;
    for (let j = 0; j < M.MAG_CELLS; j += 1) {
      for (let i = 0; i < M.MAG_CELLS; i += 1) {
        const v = m.d[(edge.wy + j) * M.N + edge.wx + i];
        if (v <= 0) continue;
        ctx.globalAlpha = Math.min(1, v);
        ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
      }
    }
    ctx.restore();
    frame(ctx, x, y, size, size, colors.axis);
    code(ctx, colors, label, x, y + size + 14, colors.ink1);
    note(ctx, colors, sub, x, y + size + 29, colors.ink3);
  });
  note(ctx, colors, `of the white blood cell's ${edge.area.toLocaleString("en-US")} pixels; Dice after AsDiscreted against nearest ${edge.dice.toFixed(4)}`,
    M.PAD, top + 14 + size + 48, colors.ink1);
}

function drawCurve(ctx, colors, w, params, state, n) {
  const B = M.bandLayout(w, params);
  const [lo, hi] = M.gammaRange(params);
  const x0 = M.PAD + 26;
  const y0 = B.top + 8;
  const S = B.size;
  const X = (v) => x0 + v * S;
  const Y = (v) => y0 + S - v * S;
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  for (let i = 0; i <= 40; i += 1) {
    const v = i / 40;
    if (i) ctx.lineTo(X(v), Y(v ** lo));
    else ctx.moveTo(X(v), Y(v ** lo));
  }
  for (let i = 40; i >= 0; i -= 1) ctx.lineTo(X(i / 40), Y((i / 40) ** hi));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  frame(ctx, x0, y0, S, S, colors.axis);
  const curve = (g, color, width, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 60; i += 1) {
      const v = i / 60;
      if (i) ctx.lineTo(X(v), Y(v ** g));
      else ctx.moveTo(X(v), Y(v ** g));
    }
    ctx.stroke();
    ctx.restore();
  };
  curve(1, colors.reference, 1);
  const shown = state.draws.slice(0, n);
  const fired = shown.filter((d) => d.fired);
  fired.slice(0, -1).forEach((d) => curve(d.gamma, colors.empirical, 1, 0.7));
  if (fired.length) curve(fired[fired.length - 1].gamma, colors.highlight, 2);
  note(ctx, colors, "0", x0, y0 + S + 13, colors.ink3, { align: "center" });
  note(ctx, colors, "1", x0 + S, y0 + S + 13, colors.ink3, { align: "center" });
  note(ctx, colors, "value before", x0 + S / 2, y0 + S + 26, colors.ink3, { align: "center" });
  ctx.save();
  ctx.translate(M.PAD + 8, y0 + S / 2);
  ctx.rotate(-Math.PI / 2);
  note(ctx, colors, "value after", 0, 0, colors.ink3, { align: "center" });
  ctx.restore();
  const tx = x0 + S + 28;
  note(ctx, colors, `the band: γ from ${lo} to ${hi}`, tx, y0 + 14, colors.ink2);
  note(ctx, colors, "the diagonal: γ = 1, no change", tx, y0 + 30, colors.ink2);
  if (n) note(ctx, colors, `applied in ${fired.length} of ${n} draws; a curve is one applied draw`, tx, y0 + 54, colors.ink1);
}

function drawNoise(ctx, colors, w, params, state, n) {
  const B = M.bandLayout(w, params);
  const S = B.size;
  const y0 = B.top + 8;
  const shown = state.draws.slice(0, n);
  const lastFired = shown.map((d, i) => (d.fired ? i : -1)).filter((i) => i >= 0).pop();
  if (lastFired === undefined) {
    frame(ctx, M.PAD, y0, S, S, colors.grid);
  } else {
    const smp = state.sample(lastFired, params.cell);
    imagePanel(ctx, colors, smp.diff, M.PAD, y0, S);
  }
  note(ctx, colors, "after − before, × 20", M.PAD, y0 + S + 14, colors.ink1);
  note(ctx, colors, "mid-grey is no change", M.PAD, y0 + S + 28, colors.ink3);
  const std = Number(params.std);
  const lx = M.PAD + S + 30;
  const lw = w - M.PAD - lx;
  const ly = y0 + 40;
  note(ctx, colors, "σ of each applied draw", lx, y0 + 14, colors.ink2);
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + lw, ly);
  ctx.stroke();
  ctx.restore();
  note(ctx, colors, "0", lx, ly + 16, colors.ink3);
  note(ctx, colors, String(std), lx + lw, ly + 16, colors.ink3, { align: "right" });
  shown.forEach((d, i) => { if (d.fired) dot(ctx, lx + (d.sigma / std) * lw, ly, i === lastFired ? colors.highlight : colors.empirical, i === lastFired ? 4 : 3); });
  if (n) {
    const fired = shown.filter((d) => d.fired).length;
    note(ctx, colors, `applied in ${fired} of ${n} draws; σ is drawn from 0 to std`, lx, ly + 44, colors.ink1);
    note(ctx, colors, `std = ${std} is ${(255 * std).toFixed(1)} grey levels of 255`, lx, ly + 60, colors.ink3);
  }
}

function drawTransforms(ctx, colors, w, params, state, anim) {
  const L = M.figureLayout(w);
  const n = Math.min(anim?.n ?? 0, M.DRAWS);
  const t = anim?.t ?? 0;
  const kind = state.kind;
  const sm = M.smear(params.cell);
  caption(ctx, colors, `${M.CLASS[kind]} on one training image and its mask`, M.PAD, 20);
  note(ctx, colors, "Original", L.x0, L.imgY - 8, colors.ink2, { weight: "600" });
  note(ctx, colors, n ? `Augmented, draw ${n} of ${M.DRAWS}` : "Augmented", L.x1, L.imgY - 8, colors.ink2, { weight: "600" });
  imagePanel(ctx, colors, sm.image, L.x0, L.imgY, L.s, [{ pts: M.outlineOf(sm.wbc, []), color: colors.reference }]);
  note(ctx, colors, "mask", L.x0, L.maskY - 6, colors.ink3);
  note(ctx, colors, "mask", L.x1, L.maskY - 6, colors.ink3);
  maskPanel(ctx, colors, sm.mask, L.x0, L.maskY, L.s);

  if (n) {
    paintAugmented(ctx, colors, L, state, params, n - 1, 1);
  } else {
    frame(ctx, L.x1, L.imgY, L.s, L.s, colors.grid);
    frame(ctx, L.x1, L.maskY, L.s, L.s, colors.grid);
    note(ctx, colors, "Press Draw to apply the call", L.x1 + L.s / 2, L.imgY + L.s / 2, colors.ink3, { align: "center" });
  }
  if (t > 0 && n < M.DRAWS) paintAugmented(ctx, colors, L, state, params, n, easeOut(t));

  if (n) {
    const d = state.draws[n - 1];
    const smp = state.sample(n - 1, params.cell);
    note(ctx, colors, drawText(kind, d, params), M.PAD, L.line1, d.fired ? colors.ink1 : colors.ink3);
    if (smp.stale !== null) {
      note(ctx, colors, `keys=["image"]: the mask stayed in place; Dice of the mask against the white blood cell ${smp.stale.toFixed(2)}`,
        M.PAD, L.line2, colors.ink1);
    } else if (d.fired && kind === "affine" && state.labelMode === "bilinear") {
      const edge = M.maskEdge(smp);
      frame(ctx, L.x1 + (edge.wx / M.N) * L.s, L.maskY + (edge.wy / M.N) * L.s, (M.MAG_CELLS / M.N) * L.s + 2, (M.MAG_CELLS / M.N) * L.s + 2, colors.highlight);
      note(ctx, colors, `mode "bilinear" for the label: ${edge.between} mask values between 0 and 1; the box is the window below`,
        M.PAD, L.line2, colors.ink1);
    }
  }

  if (kind === "flip" || kind === "rotate") drawGrid(ctx, colors, w, params, state, n);
  else if (kind === "affine") drawRanges(ctx, colors, w, params, state, n);
  else if (kind === "contrast") drawCurve(ctx, colors, w, params, state, n);
  else drawNoise(ctx, colors, w, params, state, n);
}

/* ============================== the Pipeline page ========================= */

function lineText(state, epoch, i, st) {
  const l = M.LINES[i];
  if (st.status === "absent") return "not in this list";
  if (st.status === "cached") return "from the cache";
  if (st.status !== "done") return "";
  if (!l.random) {
    if (i === M.LAST) return state.train ? "run every epoch" : "run, then cached";
    return "run, then cached";
  }
  const ep = state.epochs[epoch];
  if (!M.firedIn(i, ep)) return "not applied";
  if (l.random === "rot90") return `k = ${ep.k}`;
  if (l.random === "contrast") return `γ ${ep.gamma.toFixed(2)}`;
  if (l.random === "noise") return `σ ${ep.sigma.toFixed(4)}`;
  if (l.random === "affine") return "applied";
  return "flipped";
}

function detailOf(state, cur) {
  if (!cur) return "The image as saved, before the first line runs.";
  if (!state.train && cur.epoch > 0) return "Every line of this list is cached: the sample is epoch 1's.";
  const l = M.LINES[cur.line];
  const ep = state.epochs[cur.epoch];
  if (l.random === "affine" && ep.affine) {
    const { rotate, translate, scale } = ep.affine;
    return `drew rotate ${signed(rotate / DEG, 1)}°, translate (${signed(translate[0], 1)}, ${signed(translate[1], 1)}) px, `
      + `scale (${scale[0].toFixed(2)}, ${scale[1].toFixed(2)})`;
  }
  if (cur.epoch > 0 && cur.line === M.FIRST_RANDOM) return `epoch ${cur.epoch + 1} starts from the cached output of SpatialPadd`;
  return "";
}

function drawPipeline(ctx, colors, w, params, state, anim) {
  const P = M.pipelineLayout(w);
  const s = Math.min(anim?.n ?? 0, state.total);
  const t = anim?.t ?? 0;
  const cur = s > 0 ? state.steps[s - 1] : null;
  const epoch = cur ? cur.epoch : 0;
  const list = state.train ? "train_transforms" : "val_test_transforms";
  caption(ctx, colors, cur ? `${list}, epoch ${epoch + 1} of ${M.EPOCHS}` : `${list}, before the first epoch`, M.PAD, 20);

  const listW = P.sx - M.PAD - 14;
  const statusX = M.PAD + 150;
  M.LINES.forEach((l, i) => {
    const y = P.top + i * P.row;
    const st = M.lineStatus(state, s, i);
    if (st.current) {
      ctx.save();
      ctx.fillStyle = colors.surface2;
      ctx.fillRect(M.PAD, y, listW, P.row);
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(M.PAD, y, 3, P.row);
      ctx.restore();
    }
    const live = st.status === "done";
    code(ctx, colors, l.cls, M.PAD + 10, y + 14, live ? colors.ink1 : colors.ink3);
    if (st.status === "absent") {
      ctx.save();
      ctx.font = `${colors.fsXs} ${colors.mono}`;
      const tw = ctx.measureText(l.cls).width;
      ctx.strokeStyle = colors.ink3;
      ctx.beginPath();
      ctx.moveTo(M.PAD + 10, y + 10);
      ctx.lineTo(M.PAD + 10 + tw, y + 10);
      ctx.stroke();
      ctx.restore();
    }
    const text = lineText(state, epoch, i, st);
    const fired = live && l.random && M.firedIn(i, state.epochs[epoch]);
    if (text) note(ctx, colors, text, statusX, y + 14, fired ? colors.ink1 : colors.ink3, { weight: fired ? "600" : "" });
  });

  const lines = state.linesOf(epoch);
  const at = cur ? lines[cur.line] : { image: M.smear("off").raw, ops: [] };
  const wbc = M.PLACEMENTS.off;
  imagePanel(ctx, colors, at.image, P.sx, P.top, P.s, [{ pts: M.outlineOf(wbc, at.ops), color: colors.reference }]);
  if (t > 0 && s < state.total) {
    const nx = state.steps[s];
    const nxt = state.linesOf(nx.epoch)[nx.line];
    imagePanel(ctx, colors, nxt.image, P.sx, P.top, P.s, [{ pts: M.outlineOf(wbc, nxt.ops), color: colors.reference }], easeOut(t));
  }
  note(ctx, colors, cur ? "the sample after the line just run," : "the image as saved", P.sx, P.top + P.s + 14, colors.ink3);
  if (cur) note(ctx, colors, "the mask's outline on it", P.sx, P.top + P.s + 28, colors.ink3);

  if (cur) code(ctx, colors, M.LINES[cur.line].call, M.PAD, P.detailY, colors.ink2);
  const detail = detailOf(state, cur);
  if (detail) note(ctx, colors, detail, M.PAD, P.detailY + 16, colors.ink1);

  note(ctx, colors, "The same image, epoch by epoch", M.PAD, P.stripY, colors.ink2, { weight: "600" });
  const complete = (e) => state.steps.findIndex((st) => st.epoch === e && st.line === M.LAST) < s;
  for (let e = 0; e < M.EPOCHS; e += 1) {
    const x = M.PAD + e * (P.ts + P.stripGap);
    const y = P.stripY + 10;
    if (complete(e)) {
      const fin = state.linesOf(e)[M.LAST];
      imagePanel(ctx, colors, fin.image, x, y, P.ts, [{ pts: M.outlineOf(wbc, fin.ops), color: colors.reference, width: 1 }]);
    } else {
      frame(ctx, x, y, P.ts, P.ts, colors.grid);
    }
    note(ctx, colors, String(e + 1), x + P.ts / 2, y + P.ts + 13, colors.ink3, { align: "center" });
  }
}

/* ================================ the widget =============================== */

const ON = (topic) => ({ param: "topic", equals: topic });
const IS = (kind) => ({ all: [ON("transforms"), { param: "transform", equals: kind }] });
const opts = (vals, show = (v) => v) => vals.map((v) => ({ value: v, label: show(v) }));
const slot = (options, def, label = "") => ({ type: "select", label, hidden: true, options, default: def });
const phaseOf = (state, n) => (state.page === "pipeline" ? M.pipelinePhase(state, n) : "draw");
const totalOf = (state) => (state.page === "pipeline" ? state.total : M.DRAWS);

const STEP_LABELS = { draw: "Draw", line: "Next line", epoch: "Next epoch" };
const STEP_TITLES = {
  draw: "Apply the call to the original image once more",
  line: "Run the sample through the next line of the list",
  epoch: "Start the next epoch from the same image",
};

defineWidget({
  slug: "augmentation",
  status: "draft",
  title: "Deep Learning - Image Augmentation",
  subtitle:
    "Data augmentation applies random transforms to each training image every time it is loaded, so every "
    + "epoch trains on a different version of the same image. A spatial transform must move the image and its "
    + "mask together; an intensity transform changes the image alone. Validation and test images receive the "
    + "fixed transforms only.",
  layout: "side",
  height: ({ w, ...values }) => M.pageHeight(w, values),

  params: {
    topic: {
      type: "segmented",
      label: "Topic",
      options: [{ value: "transforms", label: "Transforms" }, { value: "pipeline", label: "Pipeline" }],
      default: "transforms",
    },

    /* --- Transforms ------------------------------------------------------ */
    tSec: { type: "section", label: "The transform", when: ON("transforms") },
    transform: {
      type: "segmented",
      label: "Transform",
      detail: "one random transform, applied to the image by itself",
      options: [
        { value: "flip", label: "Flip" },
        { value: "rotate", label: "Rotate" },
        { value: "affine", label: "Affine" },
        { value: "contrast", label: "Contrast" },
        { value: "noise", label: "Noise" },
      ],
      default: "flip",
      when: ON("transforms"),
    },

    /* THE ARGUMENTS, each a slot in its transform's call below; cell 19's
       values are the defaults */
    keys: slot([{ value: "image,label", label: '["image", "label"]' }, { value: "image", label: '["image"]' }], "image,label"),
    flip_prob: slot(opts(M.PROBS), "0.5"),
    spatial_axis: slot(opts(["0", "1"]), "0"),
    rotate_prob: slot(opts(M.PROBS), "0.5"),
    max_k: slot(opts(["1", "2", "3"]), "3"),
    affine_prob: slot(opts(M.PROBS), "0.25"),
    rotate_range: slot(opts(["0", "5", "10", "20", "45"], (v) => `${v}.0`), "10"),
    translate_h: slot(opts(["0", "8", "32", "64"]), "8", "height"),
    translate_w: slot(opts(["0", "8", "32", "64"]), "8", "width"),
    scale_h: slot(opts(["0", "0.1", "0.2", "0.3"]), "0.1", "height"),
    scale_w: slot(opts(["0", "0.1", "0.2", "0.3"]), "0.1", "width"),
    mode: slot([{ value: "nearest", label: '"nearest"' }, { value: "bilinear", label: '"bilinear"' }], "nearest", "label"),
    contrast_prob: slot(opts(M.PROBS), "0.3"),
    gamma_low: slot(opts(["0.3", "0.5", "0.7", "1"]), "0.7", "low"),
    gamma_high: slot(opts(["1", "1.5", "2", "3"]), "1.5", "high"),
    noise_prob: slot(opts(M.PROBS), "0.15"),
    std: slot(opts(["0.01", "0.05", "0.1"]), "0.01"),

    callSec: { type: "section", label: "The call", when: ON("transforms") },
    flipA: { type: "expr", open: "RandFlipd(keys=", close: ",", slots: ["keys"], when: IS("flip") },
    flipB: { type: "expr", open: "prob=", close: ",", slots: ["flip_prob"], when: IS("flip") },
    flipC: {
      type: "expr", open: "spatial_axis=", close: ")", slots: ["spatial_axis"], when: IS("flip"),
      detail: "Mirrors the image, and the mask when \"label\" is in keys: axis 0 top to bottom, axis 1 left to right.",
    },
    rotA: { type: "expr", open: "RandRotate90d(keys=", close: ",", slots: ["keys"], when: IS("rotate") },
    rotB: { type: "expr", open: "prob=", close: ",", slots: ["rotate_prob"], when: IS("rotate") },
    rotC: {
      type: "expr", open: "max_k=", close: ")", slots: ["max_k"], when: IS("rotate"),
      detail: "Turns the image, and the mask when \"label\" is in keys, by k quarter turns counter-clockwise, k drawn from 1 to max_k.",
    },
    affA: { type: "expr", open: "RandAffined(keys=", close: ",", slots: ["keys"], when: IS("affine") },
    affB: { type: "expr", open: "prob=", close: ",", slots: ["affine_prob"], when: IS("affine") },
    affC: { type: "expr", open: "rotate_range=np.deg2rad(", close: "),", slots: ["rotate_range"], when: IS("affine") },
    affD: { type: "expr", open: "translate_range=(", close: "),", slots: ["translate_h", "translate_w"], when: IS("affine") },
    affE: { type: "expr", open: "scale_range=(", close: "),", slots: ["scale_h", "scale_w"], when: IS("affine") },
    affF: {
      type: "expr", open: "mode=(\"bilinear\", ", close: "), padding_mode=\"zeros\")", slots: ["mode"], when: IS("affine"),
      detail: "Rotates by an angle drawn within ± rotate_range, shifts each axis by a draw within ± translate_range "
        + "pixels, and scales each axis by 1 plus a draw within ± scale_range; a scale above 1 makes the content "
        + "smaller. Zeros fill what the image no longer covers.",
    },
    conA: { type: "expr", open: "RandAdjustContrastd(keys=[\"image\"], prob=", close: ",", slots: ["contrast_prob"], when: IS("contrast") },
    conB: {
      type: "expr", open: "gamma=(", close: "))", slots: ["gamma_low", "gamma_high"], when: IS("contrast"),
      detail: "Rescales the image to 0–1, raises it to a power γ drawn between the two numbers, and scales it back.",
    },
    noiseA: { type: "expr", open: "RandGaussianNoised(keys=[\"image\"], prob=", close: ",", slots: ["noise_prob"], when: IS("noise") },
    noiseB: {
      type: "expr", open: "mean=0.0, std=", close: ")", slots: ["std"], when: IS("noise"),
      detail: "Adds Gaussian noise with a standard deviation drawn between 0 and std to every value of the image.",
    },

    imgSec: { type: "section", label: "The image", when: ON("transforms") },
    cell: {
      type: "segmented",
      label: "White blood cell",
      detail: "where the white blood cell, the object the mask marks, is in the image",
      options: [{ value: "off", label: "Off-centre" }, { value: "centred", label: "Centred" }],
      default: "off",
      display: true,
      when: ON("transforms"),
    },

    /* --- Pipeline -------------------------------------------------------- */
    pSec: { type: "section", label: "The list", when: ON("pipeline") },
    split: {
      type: "segmented",
      label: "Split",
      detail: "which list of transforms the image goes through: train_transforms or val_test_transforms",
      options: [{ value: "training", label: "Training" }, { value: "validation", label: "Validation/Test" }],
      default: "training",
      when: ON("pipeline"),
    },

    /* SEED 106, chosen from the first 200 by what the page opens on
       (2026-09-15): Flip's first draw is applied and five of twelve are,
       Rotate draws every k, Affine applies five of twelve, and the first
       epoch fires three of the six random lines, the affine among them — a
       typical share. Seed 1 opened Flip on a draw that was not applied. */
    seed: { type: "int", label: "Seed", detail: "the random draws: one seed gives the same draws every time", min: 1, max: 200, default: 106 },

    /* Authoring escape hatch, first render only: draws, or presses on the list. */
    shown: { type: "int", min: 0, max: 61, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.topic === "pipeline") {
      return [
        { token: "reference", label: "The mask's outline, on the sample", mark: "line" },
        { token: "highlight", label: "The line just run", mark: "bar" },
      ];
    }
    const kind = params.transform;
    const out = [{ token: "reference", label: "The mask's outline, on the image; the mask", mark: "line" }];
    if (M.isSpatial(kind) && !M.labelIn(params)) out.push({ token: "highlight", label: "Where the white blood cell is after the draw", mark: "dash" });
    if (kind === "affine" && M.labelIn(params)) out.push({ token: "empirical", label: "The mask's outline after earlier draws", mark: "line" });
    if (kind === "affine" || kind === "contrast" || kind === "noise") {
      /* the contrast band draws a draw as its curve, the other two as a dot */
      const mark = kind === "contrast" ? "line" : "dot";
      out.push({ token: "empirical", label: "An earlier applied draw", mark });
      out.push({ token: "highlight", label: "The last applied draw", mark });
    }
    return out;
  },

  compute: ({ params, rng }) => (params.topic === "pipeline" ? M.computePipeline(params, rng) : M.computeTransforms(params, rng)),

  animation: {
    stepLabel: { anim: "phase", labels: STEP_LABELS, default: "Draw" },
    stepTitle: { anim: "phase", labels: STEP_TITLES, default: STEP_TITLES.draw },
    runLabel: "Play",
    runTitle: "Keep going to the twelfth draw, or the last epoch",

    init: ({ params, state, fromScratch }) => {
      const total = totalOf(state);
      const n = fromScratch ? 0 : Math.max(0, Math.min(total, Number(params.shown) || 0));
      return { n, t: 0, phase: phaseOf(state, n), done: n >= total };
    },

    advance: (anim, { dt, state }) => {
      const total = totalOf(state);
      if (anim.n >= total) {
        anim.t = 0;
        anim.done = true;
        return false;
      }
      anim.t += dt / (state.page === "pipeline" ? M.LINE_MS : M.DRAW_MS);
      if (anim.t < 1) return true;
      anim.t = 0;
      anim.n += 1;
      anim.phase = phaseOf(state, anim.n);
      anim.done = anim.n >= total;
      return anim.mode !== "step" && !anim.done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    if (state.page === "pipeline") drawPipeline(ctx, colors, w, params, state, anim);
    else drawTransforms(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (state.page === "pipeline") {
      const s = Math.min(anim?.n ?? 0, state.total);
      const cur = s > 0 ? state.steps[s - 1] : null;
      if (!cur) {
        return [
          { label: "Epoch", value: "—", note: `the same image, sampled again in each of ${M.EPOCHS} epochs` },
          { label: "Line", value: "—", note: `${M.LINES.length} lines in train_transforms, the random ones in the middle` },
          { label: "Random lines applied", value: "—", note: "of the six, in this epoch" },
        ];
      }
      const ep = state.epochs[cur.epoch];
      const st = M.lineStatus(state, s, cur.line);
      let fired = 0;
      for (let i = M.FIRST_RANDOM; i <= cur.line; i += 1) if (M.LINES[i].random && M.firedIn(i, ep)) fired += 1;
      return [
        { label: "Epoch", value: `${cur.epoch + 1} of ${M.EPOCHS}`, note: "the same image, sampled again each epoch" },
        { label: "Line", value: `${cur.line + 1} of ${M.LINES.length}`, note: `${M.LINES[cur.line].cls}${st.status === "cached" ? ", from the cache" : ""}` },
        state.train
          ? { label: "Random lines applied", value: `${fired} of 6`, note: "in this epoch, up to the line just run" }
          : { label: "Random lines applied", value: "none", note: "val_test_transforms has no random line" },
      ];
    }
    const kind = state.kind;
    const n = Math.min(anim?.n ?? 0, M.DRAWS);
    const shown = state.draws.slice(0, n);
    const fired = shown.filter((d) => d.fired).length;
    const last = n ? state.draws[n - 1] : null;
    const tiles = [
      { label: "Draws", value: `${n} of ${M.DRAWS}`, note: "each draw applies the call to the original image" },
      { label: "Applied", value: n ? `${fired} of ${n}` : "—", note: `prob = ${probOf(params, kind)}: the chance that a draw transforms the image` },
      { label: "Last draw", value: last ? shortText(kind, last) : "—", note: last ? drawText(kind, last, params) : "no draw yet" },
    ];
    if (M.isSpatial(kind) && !M.labelIn(params)) {
      const smp = last && last.fired ? state.sample(n - 1, params.cell) : null;
      tiles.push({
        label: "Mask against the cell",
        value: smp ? smp.stale.toFixed(2) : "—",
        note: "Dice of the mask left in place against the white blood cell after the last applied draw",
      });
    }
    return tiles;
  },
});
