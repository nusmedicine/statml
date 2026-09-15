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

const signed = (v, d) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d));
const hexRgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const devicePx = (size) => Math.max(1, Math.round(size * (globalThis.devicePixelRatio || 1)));
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

/* AN IMAGE ON THE CANVAS. The engine's 512 × 512 arrays are brought to the
   panel's DEVICE pixels here, in JavaScript, and drawn 1 : 1: the browser's own
   downscaling of a large bitmap is not guaranteed to give the same pixels
   twice, and the fingerprint hashes pixels. Kept per image and size, so a frame
   redraws a bitmap and computes nothing.

   AN IMAGE IS SAMPLED, A MASK AVERAGED (round one, 2026-09-15, "i can't really
   see the contrast and noise"): averaging 512 pixels into a 255 px panel's 319
   cancels about 40 % of pixel noise before it reaches the screen, so an image
   shows the pixel under each device pixel — real values at their own
   amplitude. A mask has no noise, and averaging it only smooths its edge; it is
   drawn in the ground truth's colour with its value as the opacity, so a
   bilinear mask's fractions show as partial colour. */
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
  if (!tint && im.c === 3) {
    const n3 = im.w * im.h;
    for (let v = 0; v < px; v += 1) {
      const y = Math.min(im.h - 1, Math.floor(((v + 0.5) * im.h) / px));
      for (let u = 0; u < px; u += 1) {
        const i = y * im.w + Math.min(im.w - 1, Math.floor(((u + 0.5) * im.w) / px));
        const o = 4 * (v * px + u);
        for (let ch = 0; ch < 3; ch += 1) id.data[o + ch] = Math.max(0, Math.min(255, Math.round(255 * im.d[ch * n3 + i])));
        id.data[o + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    c.bytes = id.data;
    per.set(key, c);
    return c;
  }
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
  /* the bytes too: a contrast in motion reshapes them each frame */
  c.bytes = id.data;
  per.set(key, c);
  return c;
}
function paintImage(ctx, im, x, y, size, tint = null) {
  ctx.drawImage(bitmapOf(im, devicePx(size), tint), x, y, size, size);
}

/* A FRAME OF MOTION: RGBA bytes at a panel's device pixels, put on one canvas
   kept per size and drawn 1 : 1. drawImage copies at the call, so the image
   and its mask can share the canvas in turn. */
const scratch = new Map();
function blit(ctx, bytes, x, y, size) {
  const px = devicePx(size);
  let c = scratch.get(px);
  if (!c) {
    c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    scratch.set(px, c);
  }
  c.getContext("2d").putImageData(new ImageData(bytes, px, px), 0, 0);
  ctx.drawImage(c, x, y, size, size);
}

/* γ in motion on an image already scaled to 0–1: each byte through v^γ, which
   is AdjustContrast on a 0–1 image. Applied to the panel's averaged bytes, so a
   frame costs a table; the exact result replaces it when the motion ends. */
function gammaBytes(im, size, gamma) {
  const src = bitmapOf(im, devicePx(size)).bytes;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) lut[v] = Math.round(255 * (v / 255) ** gamma);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = lut[src[i]];
    out[i + 1] = lut[src[i + 1]];
    out[i + 2] = lut[src[i + 2]];
    out[i + 3] = 255;
  }
  return out;
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
/** A panel: its pixels from `paint` at opacity a, the outlines over them, a frame at full strength. */
function panel(ctx, colors, x, y, size, paint, lines = [], a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  paint();
  ctx.restore();
  lines.forEach((l) => outline(ctx, colors, l.pts, x, y, size, { ...l, alpha: (l.alpha ?? 1) * a }));
  frame(ctx, x, y, size, size, colors.grid);
}
const imagePanel = (ctx, colors, im, x, y, size, lines = [], a = 1) =>
  panel(ctx, colors, x, y, size, () => paintImage(ctx, im, x, y, size), lines, a);
/** A mask panel: the surface, then the mask at opacity a in the ground truth's colour, from bytes or the image. */
function maskPanel(ctx, colors, m, x, y, size, bytes = null, a = 1) {
  ctx.save();
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, size, size);
  ctx.restore();
  panel(ctx, colors, x, y, size, () => {
    if (bytes) blit(ctx, bytes, x, y, size);
    else paintImage(ctx, m, x, y, size, colors.reference);
  }, [], a);
}

/* ============================ the Transforms page ========================= */

const probOf = (params, kind) => params[`${kind}_prob`];

/** The draw's arguments as one line, in the call's own order and units. */
function drawText(kind, d, params) {
  if (!d.fired) return `not applied: prob = ${probOf(params, kind)}`;
  if (kind === "flip") return `applied: spatial_axis=${d.op.axis} flips the image ${d.op.axis === 0 ? "top to bottom" : "left to right"}`;
  if (kind === "rotate") return `applied: k = ${d.op.k}, a ${90 * d.op.k}° rotation counter-clockwise`;
  if (kind === "affine") {
    const { rotate, translate, scale } = d.op;
    return `applied: rotate ${signed(rotate / DEG, 1)}°, translate (${signed(translate[0], 1)}, ${signed(translate[1], 1)}) px, `
      + `scale (${scale[0].toFixed(2)}, ${scale[1].toFixed(2)})`;
  }
  if (kind === "contrast") return `applied: γ = ${d.gamma.toFixed(2)}`;
  return `applied: σ = ${d.sigma.toFixed(4)}, ${(255 * d.sigma).toFixed(1)} of 255 grey levels`;
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

/* the faint outlines of the affine draws before draw i, where their masks are */
function earlierLines(colors, state, wbc, i) {
  const lines = [];
  if (state.kind !== "affine" || !state.withLabel) return lines;
  for (let j = 0; j < i; j += 1) {
    if (state.draws[j].fired) lines.push({ pts: M.outlineOf(wbc, M.fileOpsOf(state.draws[j])), color: colors.empirical, width: 1, alpha: 0.5 });
  }
  return lines;
}

/* the outlines on an augmented image: the mask where it is, and under
   keys=["image"] also where the white cell went — `ops` carries the cell */
function cellLines(colors, wbc, ops, withLabel) {
  if (withLabel) return [{ pts: M.outlineOf(wbc, ops), color: colors.reference }];
  return [
    { pts: M.outlineOf(wbc, []), color: colors.reference, width: 2 },
    { pts: M.outlineOf(wbc, ops), color: colors.highlight, width: 1.3, dash: [4, 3] },
  ];
}

/** Draw i, finished: the engine's exact result, at opacity a while it fades out. */
function paintAugmented(ctx, colors, L, state, params, i, a = 1) {
  const smp = state.sample(i, params.cell);
  const spatial = M.isSpatial(state.kind);
  const lines = [...earlierLines(colors, state, smp.wbc, i), ...cellLines(colors, smp.wbc, smp.ops, !spatial || state.withLabel)];
  imagePanel(ctx, colors, smp.image, L.x1, L.imgY, L.s, lines, a);
  maskPanel(ctx, colors, smp.mask, L.x1, L.maskY, L.s, null, a);
}

/** The original in the Augmented column at opacity a: the image a draw starts from, fading in. */
function paintStart(ctx, colors, L, sm, a) {
  imagePanel(ctx, colors, sm.image, L.x1, L.imgY, L.s, cellLines(colors, sm.wbc, [], true), a);
  maskPanel(ctx, colors, sm.mask, L.x1, L.maskY, L.s, null, a);
}

/**
 * Draw i IN MOTION at eased fraction e, from the original: a spatial draw as
 * its warp at e, the mask moving with the image when "label" is in keys;
 * contrast as γ at 1 + e(γ − 1); noise as the noise at e of its σ, which is a
 * blend of the original and the noisy sample. A draw that does not fire shows
 * the original, which is what MONAI returns.
 */
function paintTween(ctx, colors, L, state, params, i, e) {
  const sm = M.smear(params.cell);
  const d = state.draws[i];
  const kind = state.kind;
  const { x1, imgY, maskY, s } = L;
  const early = earlierLines(colors, state, sm.wbc, i);
  if (d.fired && M.isSpatial(kind)) {
    const wp = M.tweenWarp(M.fileOpsOf(d)[0], e);
    const px = devicePx(s);
    panel(ctx, colors, x1, imgY, s, () => blit(ctx, M.renderWarp(sm.image, px, wp, { zeros: kind === "affine" }), x1, imgY, s),
      [...early, ...cellLines(colors, sm.wbc, [wp], state.withLabel)]);
    maskPanel(ctx, colors, sm.mask, x1, maskY, s, state.withLabel ? M.renderWarp(sm.mask, px, wp, { tint: hexRgb(colors.reference) }) : null);
    return;
  }
  const lines = cellLines(colors, sm.wbc, [], true);
  if (d.fired && kind === "contrast") {
    panel(ctx, colors, x1, imgY, s, () => blit(ctx, gammaBytes(sm.image, s, 1 + e * (d.gamma - 1)), x1, imgY, s), lines);
  } else if (d.fired && kind === "noise") {
    const noisy = state.sample(i, params.cell).image;
    panel(ctx, colors, x1, imgY, s, () => {
      paintImage(ctx, sm.image, x1, imgY, s);
      ctx.save();
      ctx.globalAlpha = e;
      paintImage(ctx, noisy, x1, imgY, s);
      ctx.restore();
    }, lines);
  } else {
    imagePanel(ctx, colors, sm.image, x1, imgY, s, [...early, ...lines]);
  }
  maskPanel(ctx, colors, sm.mask, x1, maskY, s);
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
  note(ctx, colors, `k = 1: ${c[0]} · k = 2: ${c[1]} · k = 3: ${c[2]} · not applied: ${n - fired.length}; each k is a 90° rotation counter-clockwise`,
    M.PAD, B.tallyY, colors.ink1);
}

/* The draws a band shows: the finished ones, and the one in motion at eased
   fraction e. The newest applied draw is lit — the one in motion while there
   is one, so its dot or curve travels from "no change" to its value. */
function bandDraws(state, n, flight) {
  const shown = state.draws.slice(0, n).map((d, i) => ({ d, i, e: 1 }));
  if (flight && state.draws[flight.i].fired) shown.push({ d: state.draws[flight.i], i: flight.i, e: flight.e });
  const lit = shown.filter((s) => s.d.fired).map((s) => s.i).pop();
  return { shown, lit };
}

function drawRanges(ctx, colors, w, params, state, n, flight) {
  const B = M.bandLayout(w, params);
  const { shown, lit } = bandDraws(state, n, flight);
  const pointTone = (i) => (i === lit ? colors.highlight : colors.empirical);
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
  shown.forEach(({ d, i, e }) => {
    if (d.fired) dot(ctx, B.lineX + along((e * d.op.rotate) / DEG, r) * B.lineW, B.lineY, pointTone(i), i === lit ? 4 : 3);
  });

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
    shown.forEach(({ d, i, e }) => {
      if (!d.fired) return;
      const [vh, vw] = valOf(d).map((v) => center + e * (v - center));
      dot(ctx, bx + along(vw - center, cols) * B.bs, B.boxY + along(vh - center, rows) * B.bs, pointTone(i), i === lit ? 4 : 3);
    });
  };
  const th = Number(params.translate_height);
  const tw = Number(params.translate_width);
  const sh = Number(params.scale_height);
  const sw = Number(params.scale_width);
  box(B.boxX[0], "translate, px", th, tw, 0, (d) => d.op.translate, [signed(-tw, 0), String(tw)], [signed(-th, 0), String(th)]);
  box(B.boxX[1], "scale", sh, sw, 1, (d) => d.op.scale, [(1 - sw).toFixed(1), (1 + sw).toFixed(1)], [(1 - sh).toFixed(1), (1 + sh).toFixed(1)]);
  if (n) {
    const fired = state.draws.slice(0, n).filter((d) => d.fired).length;
    note(ctx, colors, `applied in ${fired} of ${n} draws; each dot is one applied draw's value within its range`, M.PAD, B.tallyY, colors.ink1);
  }
  if (B.mag) drawMagnifier(ctx, colors, w, B, state, params, n);
}

function drawMagnifier(ctx, colors, w, B, state, params, n) {
  const { top, size, gap } = B.mag;
  caption(ctx, colors, "The mask's edge, 20 × 20 pixels", M.PAD, top + 4);
  const last = n > 0 ? state.sample(n - 1, params.cell) : null;
  if (!last || !state.draws[n - 1].fired) {
    note(ctx, colors, n ? "the last draw was not applied, so the mask was not resampled" : "no applied draw yet",
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
  note(ctx, colors, `the white blood cell covers ${edge.area.toLocaleString("en-US")} pixels; Dice between AsDiscreted and nearest: ${edge.dice.toFixed(4)}`,
    M.PAD, top + 14 + size + 48, colors.ink1);
}

function drawCurve(ctx, colors, w, params, state, n, flight) {
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
  const { shown, lit } = bandDraws(state, n, flight);
  shown.forEach(({ d, i, e }) => {
    if (!d.fired) return;
    const g = 1 + e * (d.gamma - 1);
    if (i === lit) curve(g, colors.highlight, 2);
    else curve(g, colors.empirical, 1, 0.7);
  });
  const fired = state.draws.slice(0, n).filter((d) => d.fired);
  note(ctx, colors, "0", x0, y0 + S + 13, colors.ink3, { align: "center" });
  note(ctx, colors, "1", x0 + S, y0 + S + 13, colors.ink3, { align: "center" });
  note(ctx, colors, "input intensity", x0 + S / 2, y0 + S + 26, colors.ink3, { align: "center" });
  ctx.save();
  ctx.translate(M.PAD + 8, y0 + S / 2);
  ctx.rotate(-Math.PI / 2);
  note(ctx, colors, "output intensity", 0, 0, colors.ink3, { align: "center" });
  ctx.restore();
  const tx = x0 + S + 28;
  note(ctx, colors, `shaded: γ from ${lo} to ${hi}`, tx, y0 + 14, colors.ink2);
  note(ctx, colors, "the diagonal: γ = 1, no change", tx, y0 + 30, colors.ink2);
  if (n) note(ctx, colors, `applied in ${fired.length} of ${n} draws; each curve is one applied draw`, tx, y0 + 54, colors.ink1);
}

function drawNoise(ctx, colors, w, params, state, n, flight) {
  const B = M.bandLayout(w, params);
  const S = B.size;
  const y0 = B.top + 8;
  const { shown, lit } = bandDraws(state, n, flight);
  if (lit === undefined) {
    frame(ctx, M.PAD, y0, S, S, colors.grid);
  } else {
    /* the difference of the lit draw at its fraction: after − before scales
       with σ, so each value moves from 0.5, no change, by e of the way */
    const { e } = shown.find((s) => s.i === lit);
    const src = bitmapOf(state.sample(lit, params.cell).diff, devicePx(S)).bytes;
    const bytes = new Uint8ClampedArray(src.length);
    for (let k = 0; k < src.length; k += 4) {
      for (let ch = 0; ch < 3; ch += 1) bytes[k + ch] = 127.5 + e * (src[k + ch] - 127.5);
      bytes[k + 3] = 255;
    }
    panel(ctx, colors, M.PAD, y0, S, () => blit(ctx, bytes, M.PAD, y0, S));
  }
  note(ctx, colors, "augmented − original, × 20", M.PAD, y0 + S + 14, colors.ink1);
  note(ctx, colors, "grey: no change", M.PAD, y0 + S + 28, colors.ink3);
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
  shown.forEach(({ d, i, e }) => {
    if (d.fired) dot(ctx, lx + ((e * d.sigma) / std) * lw, ly, i === lit ? colors.highlight : colors.empirical, i === lit ? 4 : 3);
  });
  if (n) {
    const fired = state.draws.slice(0, n).filter((d) => d.fired).length;
    note(ctx, colors, `applied in ${fired} of ${n} draws; σ is drawn from 0 to std`, lx, ly + 44, colors.ink1);
    note(ctx, colors, `std = ${std} is ${(255 * std).toFixed(1)} of 255 grey levels`, lx, ly + 60, colors.ink3);
  }
}

function drawTransforms(ctx, colors, w, params, state, anim) {
  const L = M.figureLayout(w);
  const n = Math.min(anim?.n ?? 0, M.DRAWS);
  const t = anim?.t ?? 0;
  const kind = state.kind;
  const sm = M.smear(params.cell);
  const drawing = t > 0 && n < M.DRAWS ? n + 1 : n;
  caption(ctx, colors, `${M.CLASS[kind]} on one training image and its mask`, M.PAD, 20);
  note(ctx, colors, "Original", L.x0, L.imgY - 8, colors.ink2, { weight: "600" });
  note(ctx, colors, drawing ? `Augmented, draw ${drawing} of ${M.DRAWS}` : "Augmented", L.x1, L.imgY - 8, colors.ink2, { weight: "600" });
  imagePanel(ctx, colors, sm.image, L.x0, L.imgY, L.s, [{ pts: M.outlineOf(sm.wbc, []), color: colors.reference }]);
  note(ctx, colors, "mask", L.x0, L.maskY - 6, colors.ink3);
  note(ctx, colors, "mask", L.x1, L.maskY - 6, colors.ink3);
  maskPanel(ctx, colors, sm.mask, L.x0, L.maskY, L.s);

  /* A PRESS: the last result fades out, the original fades in, then the draw
     moves from it — every draw starts from the original */
  const press = t > 0 && n < M.DRAWS ? M.pressAt(state, n, t) : null;
  const flight = press?.part === "move" ? { i: n, e: press.e } : null;
  if (press?.part === "out") {
    if (n) paintAugmented(ctx, colors, L, state, params, n - 1, press.a);
    else {
      frame(ctx, L.x1, L.imgY, L.s, L.s, colors.grid);
      frame(ctx, L.x1, L.maskY, L.s, L.s, colors.grid);
    }
  } else if (press?.part === "in") {
    paintStart(ctx, colors, L, sm, press.a);
  } else if (flight) {
    paintTween(ctx, colors, L, state, params, flight.i, flight.e);
  } else if (n) {
    paintAugmented(ctx, colors, L, state, params, n - 1);
  } else {
    frame(ctx, L.x1, L.imgY, L.s, L.s, colors.grid);
    frame(ctx, L.x1, L.maskY, L.s, L.s, colors.grid);
    note(ctx, colors, "Press Draw to apply the transform", L.x1 + L.s / 2, L.imgY + L.s / 2, colors.ink3, { align: "center" });
  }

  if (press) {
    const d = state.draws[n];
    note(ctx, colors, drawText(kind, d, params), M.PAD, L.line1, d.fired ? colors.ink1 : colors.ink3);
  } else if (n) {
    const d = state.draws[n - 1];
    const smp = state.sample(n - 1, params.cell);
    note(ctx, colors, drawText(kind, d, params), M.PAD, L.line1, d.fired ? colors.ink1 : colors.ink3);
    if (smp.stale !== null) {
      note(ctx, colors, `keys=["image"]: the mask is not transformed; Dice between the mask and the white blood cell: ${smp.stale.toFixed(2)}`,
        M.PAD, L.line2, colors.ink1);
    } else if (d.fired && kind === "affine" && state.labelMode === "bilinear") {
      const edge = M.maskEdge(smp);
      frame(ctx, L.x1 + (edge.wx / M.N) * L.s, L.maskY + (edge.wy / M.N) * L.s, (M.MAG_CELLS / M.N) * L.s + 2, (M.MAG_CELLS / M.N) * L.s + 2, colors.highlight);
      /* two lines: one runs past a 535 px canvas */
      note(ctx, colors, `mode "bilinear" for the label: ${edge.between} mask values between 0 and 1;`, M.PAD, L.line2, colors.ink1);
      note(ctx, colors, "the square marks the pixels magnified below", M.PAD, L.line2 + 15, colors.ink1);
    }
  }

  if (kind === "flip" || kind === "rotate") drawGrid(ctx, colors, w, params, state, n);
  else if (kind === "affine") drawRanges(ctx, colors, w, params, state, n, flight);
  else if (kind === "contrast") drawCurve(ctx, colors, w, params, state, n, flight);
  else drawNoise(ctx, colors, w, params, state, n, flight);
}

/* ============================== the Pipeline page ========================= */

function lineText(state, epoch, i, st) {
  const l = M.LINES[i];
  if (st.status === "cached") return "from the cache";
  if (st.status !== "done") return "";
  if (!l.random) {
    if (i === M.LAST) return state.train ? "applied every epoch" : "applied, then cached";
    return "applied, then cached";
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
  if (!cur) return "The image file, before any transform is applied.";
  if (!state.train && cur.epoch > 0) return "Every transform in this pipeline is cached: the sample is the same as in epoch 1.";
  const l = M.LINES[cur.line];
  const ep = state.epochs[cur.epoch];
  if (l.random === "affine" && ep.affine) {
    const { rotate, translate, scale } = ep.affine;
    return `drawn: rotate ${signed(rotate / DEG, 1)}°, translate (${signed(translate[0], 1)}, ${signed(translate[1], 1)}) px, `
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
  const moving = t > 0 && s < state.total;
  const view = M.listAt(state, s, moving);
  const epoch = view.epoch;
  const list = state.train ? "train_transforms" : "val_test_transforms";
  caption(ctx, colors, cur || moving ? `${list}, epoch ${epoch + 1} of ${M.EPOCHS}` : `${list}, before the first epoch`, M.PAD, 20);

  const listW = P.sx - M.PAD - 14;
  const statusX = M.PAD + 150;
  /* the lines of the list chosen: every line of train_transforms, or the six of val_test_transforms */
  state.list.forEach((i, row) => {
    const l = M.LINES[i];
    const y = P.top + row * P.row;
    const st = { status: view.status[i], current: i === view.done };
    /* the line whose motion is on the sample now */
    if (i === view.running) {
      ctx.save();
      ctx.strokeStyle = colors.highlight;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(M.PAD + 0.5, y + 0.5, listW - 1, P.row - 1);
      ctx.restore();
    }
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
    const text = lineText(state, epoch, i, st);
    const fired = live && l.random && M.firedIn(i, state.epochs[epoch]);
    if (text) note(ctx, colors, text, statusX, y + 14, fired ? colors.ink1 : colors.ink3, { weight: fired ? "600" : "" });
  });
  if (!state.train) {
    const y = P.top + state.list.length * P.row + 20;
    note(ctx, colors, "This pipeline has no random transform,", M.PAD + 10, y, colors.ink2);
    note(ctx, colors, "so the sample is the same in every epoch.", M.PAD + 10, y + 15, colors.ink2);
  }

  const wbc = M.PLACEMENTS["off-centre"];
  const line = (ops) => [{ pts: M.outlineOf(wbc, ops), color: colors.reference }];
  const press = moving ? M.pressAt(state, s, t) : null;
  if (press?.part === "out") {
    /* a training epoch's first press: the last epoch's sample fades out ... */
    const prev = state.steps[s - 1];
    const shown = state.linesOf(prev.epoch)[prev.line];
    imagePanel(ctx, colors, shown.image, P.sx, P.top, P.s, line(shown.ops), press.a);
  } else if (press?.part === "in") {
    /* ... and the cached sample the new epoch starts from fades in */
    const start = M.beforeStep(state, state.steps[s]);
    imagePanel(ctx, colors, start.image, P.sx, P.top, P.s, line(start.ops), press.a);
  } else if (press) {
    /* THE LINE IN MOTION, from the sample it starts with: a fired spatial line
       as its warp, contrast as γ from 1, and any other line — noise, the
       scaling, a line that did not fire — as a blend to its output */
    const nx = state.steps[s];
    const { e } = press;
    const before = M.beforeStep(state, nx);
    const after = state.linesOf(nx.epoch)[nx.line];
    const change = M.stepChange(state, nx);
    if (change.kind === "spatial") {
      const wp = M.tweenWarp(change.f, e);
      const bytes = M.renderWarp(before.image, devicePx(P.s), wp, { zeros: change.zeros });
      panel(ctx, colors, P.sx, P.top, P.s, () => blit(ctx, bytes, P.sx, P.top, P.s), line([...before.ops, wp]));
    } else if (change.kind === "contrast") {
      panel(ctx, colors, P.sx, P.top, P.s, () => blit(ctx, gammaBytes(before.image, P.s, 1 + e * (change.gamma - 1)), P.sx, P.top, P.s), line(before.ops));
    } else {
      panel(ctx, colors, P.sx, P.top, P.s, () => {
        paintImage(ctx, before.image, P.sx, P.top, P.s);
        ctx.save();
        ctx.globalAlpha = e;
        paintImage(ctx, after.image, P.sx, P.top, P.s);
        ctx.restore();
      }, line(after.ops));
    }
  } else {
    const at = cur ? state.linesOf(epoch)[cur.line] : { image: M.smear("off-centre").raw, ops: [] };
    imagePanel(ctx, colors, at.image, P.sx, P.top, P.s, line(at.ops));
  }
  note(ctx, colors, cur ? "the sample after the last transform," : "the image file", P.sx, P.top + P.s + 14, colors.ink3);
  if (cur) note(ctx, colors, "with the mask's outline", P.sx, P.top + P.s + 28, colors.ink3);

  /* the call of the line on the sample: the one running, else the one just run */
  const named = moving ? state.steps[s] : cur;
  if (named) code(ctx, colors, M.LINES[named.line].call, M.PAD, P.detailY, colors.ink2);
  const detail = detailOf(state, named);
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

const STEP_LABELS = { draw: "Draw", line: "Next transform", epoch: "Next epoch" };
const STEP_TITLES = {
  draw: "Apply the transform to the original image with a new draw",
  line: "Apply the next transform in the pipeline to the sample",
  epoch: "Start the next epoch from the same image",
};

defineWidget({
  slug: "augmentation",
  status: "shipped",
  title: "Deep Learning - Image Augmentation",
  /* Kenneth's pick A of the copy audit, 2026-09-16 */
  subtitle:
    "Data augmentation applies new random transforms to each training image in every epoch. A spatial "
    + "transform is applied to the image and its mask together. Only the fixed transforms are applied to "
    + "validation and test images.",
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
      detail: "one augment transform, applied to the original image on its own",
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
    translate_height: slot(opts(["0", "8", "32", "64"]), "8", "height"),
    translate_width: slot(opts(["0", "8", "32", "64"]), "8", "width"),
    scale_height: slot(opts(["0", "0.1", "0.2", "0.3"]), "0.1", "height"),
    scale_width: slot(opts(["0", "0.1", "0.2", "0.3"]), "0.1", "width"),
    mode: slot([{ value: "nearest", label: '"nearest"' }, { value: "bilinear", label: '"bilinear"' }], "nearest", "label"),
    /* CONTRAST AND NOISE OPEN STRONGER THAN CELL 19 (Kenneth, round one: "i
       can't really see the contrast and noise..maybe the defaults were too
       light?"; his pick 2026-09-15). Measured on the smear: cell 19's std 0.01
       gives a σ averaging 1.2 grey levels and moves no pixel by more than 10,
       and a γ from (0.7, 1.5) moves the red cells 11 levels on average; with
       prob 0.3 and 0.15 most draws are not applied at all. These pages open
       on prob 1, gamma (0.5, 2.0) — 21 levels — and std 0.1, MONAI's own
       default, 12.5 levels; cell 19's values stay in every list. */
    contrast_prob: slot(opts(M.PROBS), "1"),
    gamma_low: slot(opts(["0.3", "0.5", "0.7", "1"]), "0.5", "low"),
    gamma_high: slot(opts(["1", "1.5", "2", "3"]), "2", "high"),
    noise_prob: slot(opts(M.PROBS), "1"),
    std: slot(opts(["0.01", "0.05", "0.1"]), "0.1"),

    callSec: { type: "section", label: "The call", when: ON("transforms") },
    flipA: { type: "expr", open: "RandFlipd(keys=", close: ",", slots: ["keys"], when: IS("flip") },
    flipB: { type: "expr", open: "prob=", close: ",", slots: ["flip_prob"], when: IS("flip") },
    flipC: {
      type: "expr", open: "spatial_axis=", close: ")", slots: ["spatial_axis"], when: IS("flip"),
      detail: "Flips the image, and the mask when \"label\" is in keys: spatial_axis 0 flips top to bottom, 1 left to right.",
    },
    rotA: { type: "expr", open: "RandRotate90d(keys=", close: ",", slots: ["keys"], when: IS("rotate") },
    rotB: { type: "expr", open: "prob=", close: ",", slots: ["rotate_prob"], when: IS("rotate") },
    rotC: {
      type: "expr", open: "max_k=", close: ")", slots: ["max_k"], when: IS("rotate"),
      detail: "Rotates the image, and the mask when \"label\" is in keys, by k × 90° counter-clockwise, with k drawn from 1 to max_k.",
    },
    affA: { type: "expr", open: "RandAffined(keys=", close: ",", slots: ["keys"], when: IS("affine") },
    affB: { type: "expr", open: "prob=", close: ",", slots: ["affine_prob"], when: IS("affine") },
    affC: { type: "expr", open: "rotate_range=np.deg2rad(", close: "),", slots: ["rotate_range"], when: IS("affine") },
    affD: { type: "expr", open: "translate_range=(", close: "),", slots: ["translate_height", "translate_width"], when: IS("affine") },
    affE: { type: "expr", open: "scale_range=(", close: "),", slots: ["scale_height", "scale_width"], when: IS("affine") },
    affF: {
      type: "expr", open: "mode=(\"bilinear\", ", close: "), padding_mode=\"zeros\")", slots: ["mode"], when: IS("affine"),
      detail: "Rotates by an angle drawn from ± rotate_range, translates each axis by a value drawn from ± "
        + "translate_range pixels and scales each axis by 1 plus a value drawn from ± scale_range; a scale above 1 "
        + "shrinks the image. Pixels outside the transformed image are set to 0.",
    },
    conA: { type: "expr", open: "RandAdjustContrastd(keys=[\"image\"], prob=", close: ",", slots: ["contrast_prob"], when: IS("contrast") },
    conB: {
      type: "expr", open: "gamma=(", close: "))", slots: ["gamma_low", "gamma_high"], when: IS("contrast"),
      detail: "Rescales intensities to 0–1, raises them to the power γ, drawn between the two values of gamma, and rescales them back.",
    },
    noiseA: { type: "expr", open: "RandGaussianNoised(keys=[\"image\"], prob=", close: ",", slots: ["noise_prob"], when: IS("noise") },
    noiseB: {
      type: "expr", open: "mean=0.0, std=", close: ")", slots: ["std"], when: IS("noise"),
      detail: "Adds Gaussian noise with a standard deviation drawn between 0 and std to every pixel of the image.",
    },

    imgSec: { type: "section", label: "The image", when: ON("transforms") },
    cell: {
      type: "segmented",
      label: "White blood cell",
      detail: "the position of the white blood cell, the object in the mask",
      options: [{ value: "off-centre", label: "Off-centre" }, { value: "centred", label: "Centred" }],
      default: "off-centre",
      display: true,
      when: ON("transforms"),
    },

    /* --- Pipeline -------------------------------------------------------- */
    pSec: { type: "section", label: "The split", when: ON("pipeline") },
    split: {
      type: "segmented",
      label: "Split",
      detail: "the pipeline applied to the image: train_transforms or val_test_transforms",
      options: [{ value: "training", label: "Training" }, { value: "validation", label: "Validation/Test" }],
      default: "training",
      when: ON("pipeline"),
    },

    /* SEED 106, chosen from the first 200 by what the page opens on
       (2026-09-15): Flip's first draw is applied and five of twelve are,
       Rotate draws every k, Affine applies five of twelve, and the first
       epoch fires three of the six random lines, the affine among them — a
       typical share. Seed 1 opened Flip on a draw that was not applied. */
    seed: { type: "int", label: "Seed", detail: "fixes the random draws, so a seed repeats them", min: 1, max: 200, default: 106 },

    /* Authoring escape hatch, first render only: draws, or presses on the list. */
    shown: { type: "int", min: 0, max: 61, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.topic === "pipeline") {
      return [
        { token: "reference", label: "The mask's outline, on the sample", mark: "line" },
        { token: "highlight", label: "The transform just applied", mark: "bar" },
      ];
    }
    const kind = params.transform;
    const out = [{ token: "reference", label: "The mask, and its outline on the image", mark: "line" }];
    if (M.isSpatial(kind) && !M.labelIn(params)) out.push({ token: "highlight", label: "The white blood cell after the draw", mark: "dash" });
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
    runTitle: "Continue to the twelfth draw, or to the last epoch",

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
      /* a press that changes the picture moves for longer than one that does not */
      anim.t += dt / M.durationAt(state, anim.n);
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
      const listName = state.train ? "train_transforms" : "val_test_transforms";
      const epochNote = state.train
        ? "the same image, with new random draws each epoch"
        : "the same image and the same sample each epoch";
      const randomTile = (value, note) => (state.train
        ? { label: "Random transforms applied", value, note }
        : { label: "Random transforms", value: "none", note: "val_test_transforms has no random transform" });
      if (!cur) {
        return [
          { label: "Epoch", value: "—", note: epochNote },
          { label: "Transform", value: "—", note: `${state.list.length} transforms in ${listName}` },
          randomTile("—", "of the six, in this epoch"),
        ];
      }
      const ep = state.epochs[cur.epoch];
      const st = M.lineStatus(state, s, cur.line);
      let fired = 0;
      for (let i = M.FIRST_RANDOM; i <= cur.line; i += 1) if (M.LINES[i].random && M.firedIn(i, ep)) fired += 1;
      return [
        { label: "Epoch", value: `${cur.epoch + 1} of ${M.EPOCHS}`, note: epochNote },
        {
          label: "Transform",
          value: `${state.list.indexOf(cur.line) + 1} of ${state.list.length}`,
          note: `${M.LINES[cur.line].cls}${st.status === "cached" ? ", from the cache" : ""}`,
        },
        randomTile(`${fired} of 6`, "in this epoch, up to the transform just applied"),
      ];
    }
    const kind = state.kind;
    const n = Math.min(anim?.n ?? 0, M.DRAWS);
    const shown = state.draws.slice(0, n);
    const fired = shown.filter((d) => d.fired).length;
    const last = n ? state.draws[n - 1] : null;
    const tiles = [
      { label: "Draws", value: `${n} of ${M.DRAWS}`, note: "each draw applies the transform to the original image" },
      { label: "Applied", value: n ? `${fired} of ${n}` : "—", note: `prob = ${probOf(params, kind)}: the probability that a draw is applied` },
      { label: "Last draw", value: last ? shortText(kind, last) : "—", note: last ? drawText(kind, last, params) : "no draw yet" },
    ];
    if (M.isSpatial(kind) && !M.labelIn(params)) {
      const smp = last && last.fired ? state.sample(n - 1, params.cell) : null;
      tiles.push({
        label: "Dice of the mask",
        value: smp ? smp.stale.toFixed(2) : "—",
        note: "between the untransformed mask and the white blood cell, after the last applied draw",
      });
    }
    return tiles;
  },
});
