/* imputation — slot 89, "Proteomics: Imputation". DRAFT 2026-10-07.
 *
 * Planned in the catalogue's § The proteomics and metabolomics arc and
 * § Slot 89: measured in `_lab/proteomics-arc-measure.mjs`, mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/imputation-mock.html`; every call
 * the recommendation. The ones that shape this file:
 *   1. two pages, Missing · Imputing (01-3 cells 24–30, then 41–42);
 *   2. one matrix on both pages, proteins by measured mean × 11 cancer and 11
 *      healthy, a hole in --c-unknown: the holes collect at the bottom, which
 *      is the detection limit drawn by the data before any curve; the Imputing
 *      page fills the same holes in --c-highlight, each cell's shade its level;
 *   3. Missing: beside the matrix each protein's share missing against its
 *      measured mean, under it 01-3 cell 24's bars (proteins measured per
 *      sample); Imputing: a histogram of measured and imputed values, and one
 *      protein's 22 values under the matrix;
 *   4. Measure (Missing) and Impute (Imputing), a sample a beat; a Method
 *      change after Impute switches the filled values at once;
 *   5. the forest computed ahead (forest-table.js), the rest live;
 *   6. True values Off · On, off by default;
 *   7. an Example protein control (absent in healthy · measured in two
 *      samples · scattered holes), and a click on a matrix row;
 *   8. the readout for the method on screen, the truth-only part under True
 *      values; the forest in the lesson's orientation only.
 */
import { defineWidget } from "../core/index.js";
import * as E from "./engine.js";
import { FOREST, FOREST_SEEDS, TYPICAL_SEED } from "./forest-table.js";

const { NA, N } = E;
const isNa = Number.isNaN;
const H_MISSING = 610, H_IMPUTING = 530;
const COL_MS = 140;                    // one sample a beat: 22 samples in about three seconds
const LO = 17, HI = 31;                // the log2 axis every panel shares
const METHODS = [
  { value: "measured", label: "Measured only", detail: "no value filled; a protein is tested where both groups hold 2 values or more" },
  { value: "min", label: "Minimum", detail: "each sample's lowest measured value" },
  { value: "lowdraw", label: "Low draw", detail: "a random draw around each sample's 1% quantile, spread by the median protein SD" },
  { value: "knn", label: "kNN", detail: "the mean of the 10 proteins whose measured values are nearest, in that sample" },
  { value: "forest", label: "Random forest", detail: "for each sample, a regression forest on the other samples' values, repeated until the filled values settle (missForest)" },
];
const EXAMPLES = [
  { value: "absent", label: "Absent in healthy", group: "Example proteins" },
  { value: "few", label: "Measured in two samples", group: "Example proteins" },
  { value: "scattered", label: "Scattered holes", group: "Example proteins" },
];
const ROW_OPTIONS = Array.from({ length: E.PROTEINS }, (_, i) => ({ value: `r${i + 1}`, label: `Row ${i + 1}`, group: "Rows of the matrix, most abundant first" }));
const n0 = (v) => v.toLocaleString("en-US");
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;
const sg = (x, d = 1) => (Number.isFinite(x) ? `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}` : "–");
const pFmt = (p) => (p < 0.001 ? p.toExponential(1).replace("e-", "e−") : p.toFixed(3));

/* ------------------------------------------------------------ geometry */
/* The matrix widens with the canvas (550 in the harness, 770 at its widest) and
   the right-hand panel starts after it. Set by `fitTo(w)` at the top of every
   draw and region build, so both read one geometry. */
const M = { x0: 92, w: 200, y0: 44, h: 380, gap: 6, px: 338 };
function fitTo(w) { M.w = Math.round(Math.min(280, Math.max(190, 0.36 * w))); M.px = M.x0 + M.w + 46; }
const colX = (j) => M.x0 + j * ((M.w - M.gap) / N) + (j >= NA ? M.gap : 0);
const colW = () => (M.w - M.gap) / N;
const rowY = (i, P) => M.y0 + (i * M.h) / P;
const RIGHT = 16;
const missingLayout = (w) => ({ share: { x0: M.px + 30, x1: w - RIGHT, top: 64, base: 270 }, key: { y: 318 }, counts: { top: 478, base: 580 } });
const imputingLayout = (w) => ({ hist: { x0: M.px + 30, x1: w - RIGHT, top: 76, base: 330 }, strip: { x0: M.x0, x1: w - RIGHT, y: 466 } });

/* ------------------------------------------------------------ the press clock */
/* `anim.done` is never set: core's Replay re-inits the whole anim, which would
   empty the other page's matrix, so a press after the end starts this page's
   press over by itself (advance, below). */
function settle(anim, page) {
  const k = page === "missing" ? anim.mk : anim.ik;
  const verb = page === "missing" ? "m" : "i";
  anim.labelAt = k === 0 ? `${verb}0` : k >= N ? `${verb}done` : `${verb}run`;
}
/* Core's fastForward steps `advance` with dt 400; a frame never exceeds 64 ms
   (MAX_FRAME_MS), so a larger dt is a fast-forward. A press while one runs is a
   fast-forward followed by a fresh tick, and that tick must not start the press
   over — `swallow` eats it. Under reduced motion every press is a fast-forward
   from rest, so only one that began mid-run sets it. */
const FF_DT = 64;
function advanceBody(anim, dt, params) {
  const key = params.page === "missing" ? "mk" : "ik";
  if (anim.swallow) { anim.swallow = false; settle(anim, params.page); return false; }
  const ff = dt > FF_DT;
  if (ff && !anim.inFF) { anim.inFF = true; anim.ffMid = anim.moving; }
  if (!anim.moving && anim[key] >= N) anim[key] = 0;   // a press after the end starts over
  anim[key] = Math.min(N, anim[key] + dt / COL_MS);
  const more = anim[key] < N;
  if (!more && ff) { anim.inFF = false; anim.swallow = anim.ffMid; }
  settle(anim, params.page);
  return more;
}

/* ------------------------------------------------------------ drawing helpers */
function txt(ctx, colors, s, x, y, { size = "fsSm", colour = colors.ink2, align = "left", weight = "", mono = false } = {}) {
  ctx.font = `${weight ? weight + " " : ""}${colors[size] ?? size} ${mono ? colors.mono : colors.font}`;
  ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}
function rule(ctx, x1, y1, x2, y2, colour, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
/* a value's shade: the role's colour over the surface, deeper as the level rises */
const level = (v) => 0.45 + 0.55 * Math.max(0, Math.min(1, (v - LO) / (HI - LO)));
function cell(ctx, x, y, w, h, colour, alpha) { ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); }

/* the matrix: rows `order` (protein ids), the first `upTo` samples measured;
   F the filled rows (in `order`) or null, `fillKey` naming them for the cache.
   13,200 cells cost about 60 ms as rectangles, too slow for a frame, so each
   reading of the matrix — holes, or filled by one method — is painted once into
   an offscreen canvas per state, width, pixel ratio and theme, and a frame copies
   its columns: the press reveals a column at a time from one image or the other. */
const MATRIX_CACHE = new WeakMap();
function matrixImage(ctx, colors, sim, order, F, fillKey, owner) {
  const dpr = ctx.getTransform().a || 1;
  const key = [fillKey, order.length, M.w, dpr, colors.empirical, colors.highlight, colors.unknown, colors.surface2].join("|");
  let byKey = MATRIX_CACHE.get(owner);
  if (!byKey) { byKey = new Map(); MATRIX_CACHE.set(owner, byKey); }
  if (byKey.has(key)) return byKey.get(key);
  const P = order.length, cw = colW(), rh = M.h / P;
  const oc = document.createElement("canvas");
  oc.width = Math.ceil(M.w * dpr); oc.height = Math.ceil(M.h * dpr);
  const o = oc.getContext("2d");
  o.scale(dpr, dpr);
  for (let j = 0; j < N; j += 1) {
    const x = colX(j) - M.x0;
    cell(o, x, 0, cw - 0.6, M.h, colors.surface2, 1);
    order.forEach((p, i) => {
      const v = sim.obs[p][j], y = (i * M.h) / P;
      if (!isNa(v)) cell(o, x, y, cw - 0.6, rh + 0.35, colors.empirical, level(v));
      else if (F) cell(o, x, y, cw - 0.6, rh + 0.35, colors.highlight, level(F[i][j]));
      else cell(o, x, y, cw - 0.6, rh + 0.35, colors.unknown, 0.6);
    });
  }
  byKey.set(key, oc);
  return oc;
}
function drawMatrix(ctx, colors, sim, order, { upTo, F = null, fillKey = "", fillTo = 0, mark = -1, heading, owner }) {
  const P = order.length, cw = colW(), rh = M.h / P;
  txt(ctx, colors, heading, 12, 16, { colour: colors.ink1, weight: "600" });
  txt(ctx, colors, "cancer", colX(0) + (NA * cw) / 2, M.y0 - 7, { size: "fsXs", colour: colors.groupA, weight: "600", align: "center" });
  txt(ctx, colors, "healthy", colX(NA) + (NA * cw) / 2, M.y0 - 7, { size: "fsXs", colour: colors.groupB, weight: "600", align: "center" });
  txt(ctx, colors, "most", M.x0 - 8, M.y0 + 9, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "abundant", M.x0 - 8, M.y0 + 21, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "least", M.x0 - 8, M.y0 + M.h - 12, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "abundant", M.x0 - 8, M.y0 + M.h, { size: "fsXs", colour: colors.ink3, align: "right" });
  const holes = matrixImage(ctx, colors, sim, order, null, "holes", owner);
  const filled = F && fillTo > 0 ? matrixImage(ctx, colors, sim, order, F, fillKey, owner) : null;
  const sc = holes.width / M.w;
  ctx.save();
  for (let j = 0; j < N; j += 1) {
    const x = colX(j);
    if (j >= upTo) { cell(ctx, x, M.y0, cw - 0.6, M.h, colors.surface2, 1); continue; }
    const img = filled && j < fillTo ? filled : holes;
    const sx = (x - M.x0) * sc, sw = Math.max(1, (cw - 0.6) * sc);
    ctx.globalAlpha = 1;
    ctx.drawImage(img, sx, 0, sw, img.height, x, M.y0, cw - 0.6, M.h);
  }
  ctx.restore();
  if (mark >= 0) {
    const y = rowY(mark, P) + rh / 2;
    rule(ctx, M.x0 - 7, y, M.x0 - 1, y, colors.ink1, 2.5);
    rule(ctx, M.x0 + M.w + 1, y, M.x0 + M.w + 7, y, colors.ink1, 2.5);
  }
}

/* ------------------------------------------------------------ the Missing page */
function drawMissing(ctx, colors, w, params, state, anim) {
  fitTo(w);
  const L = missingLayout(w);
  const mk = anim ? anim.mk : (Number(params.shown) > 0 ? N : 0);
  const { sim, fullOrder } = state;
  const P = fullOrder.length;
  drawMatrix(ctx, colors, sim, fullOrder, { owner: state, upTo: Math.floor(mk), heading: `${n0(P)} proteins × ${N} samples` });

  // each protein's share missing against its measured mean; drawn once every sample is in
  const S = L.share, sx = (v) => S.x0 + ((v - 18) / (30 - 18)) * (S.x1 - S.x0), sy = (s) => S.base - s * (S.base - S.top);
  txt(ctx, colors, "Share missing, per protein", M.px, 16, { colour: colors.ink1, weight: "600" });
  txt(ctx, colors, "against its measured mean", M.px, 32, { size: "fsXs", colour: colors.ink3 });
  rule(ctx, S.x0, S.top, S.x0, S.base, colors.axis); rule(ctx, S.x0, S.base, S.x1, S.base, colors.axis);
  for (const s of [0, 0.5, 1]) { rule(ctx, S.x0 - 4, sy(s), S.x0, sy(s), colors.axis); txt(ctx, colors, pct(s, 0), S.x0 - 6, sy(s) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  for (const v of [18, 21, 24, 27, 30]) { rule(ctx, sx(v), S.base, sx(v), S.base + 4, colors.axis); txt(ctx, colors, String(v), sx(v), S.base + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  txt(ctx, colors, "log2 abundance", (S.x0 + S.x1) / 2, S.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  if (mk >= N) {
    ctx.save(); ctx.globalAlpha = 0.6;
    state.share.forEach(({ m, s }) => { ctx.fillStyle = colors.empirical; ctx.beginPath(); ctx.arc(sx(m), sy(s), 2, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }
  if (params.truth === "on") {
    ctx.save(); ctx.strokeStyle = colors.theory; ctx.lineWidth = 2; ctx.beginPath();
    for (let v = 18; v <= 30.001; v += 0.1) { const x = sx(v), y = sy(E.pMissing(v)); if (v === 18) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
  // the key: what a cell of the matrix means
  const K = L.key.y;
  cell(ctx, M.px, K - 9, 14, 10, colors.unknown, 0.6); ctx.globalAlpha = 1;
  txt(ctx, colors, "missing", M.px + 20, K, { size: "fsXs", colour: colors.ink2 });
  for (let i = 0; i < 6; i += 1) cell(ctx, M.px + i * 15, K + 9, 14, 10, colors.empirical, level(LO + (i / 5) * (HI - LO)));
  ctx.globalAlpha = 1;
  txt(ctx, colors, "measured: low → high", M.px + 96, K + 18, { size: "fsXs", colour: colors.ink2 });

  // 01-3 cell 24: proteins measured per sample, the missing stacked above
  const C = L.counts, cy = (n) => C.base - (n / P) * (C.base - C.top), cw = colW();
  txt(ctx, colors, "Proteins measured per sample", 12, C.top - 30, { colour: colors.ink1, weight: "600" });
  for (const n of [0, P]) { rule(ctx, M.x0 - 4, cy(n), M.x0, cy(n), colors.axis); txt(ctx, colors, n0(n), M.x0 - 6, cy(n) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  for (let j = 0; j < Math.min(N, Math.ceil(mk)); j += 1) {
    const grow = Math.min(1, mk - j), n = state.measuredIn[j], x = colX(j);
    const top = C.base - grow * (C.base - cy(n));
    cell(ctx, x + 0.5, top - grow * (cy(n) - cy(P)), cw - 1.5, grow * (cy(n) - cy(P)), colors.unknown, 0.35);
    cell(ctx, x + 0.5, top, cw - 1.5, C.base - top, j < NA ? colors.groupA : colors.groupB, 1);
  }
  ctx.globalAlpha = 1;
  rule(ctx, M.x0, C.base, M.x0 + M.w, C.base, colors.axis);
  if (mk >= N) {
    for (const [a, b] of [[0, NA], [NA, N]]) {
      const ns = state.measuredIn.slice(a, b);
      txt(ctx, colors, `${Math.round(E.mean(ns))} ± ${Math.round(Math.sqrt(E.variance(ns)))}`, colX(a) + (NA * cw) / 2, C.top - 8, { size: "fsXs", mono: true, colour: colors.ink1, align: "center" });
    }
  }
}

/* ------------------------------------------------------------ the Imputing page */
function bins(values, nb) { const c = new Array(nb).fill(0); for (const v of values) { const k = Math.floor(((v - LO) / (HI - LO)) * nb); if (k >= 0 && k < nb) c[k] += 1; } return c; }
const NB = 42;

function drawImputing(ctx, colors, w, params, state, anim) {
  fitTo(w);
  const L = imputingLayout(w);
  const ik = anim ? anim.ik : (Number(params.shown) > 0 ? N : 0);
  const fillTo = Math.floor(ik);
  const { sim, order, rows } = state;
  const m = params.method, F = m === "measured" ? null : state.filled[m];
  const truth = params.truth === "on";
  const mk = resolveMarked(params, state);
  drawMatrix(ctx, colors, sim, order.map((p) => p), {
    owner: state, upTo: N, F: F && order.map((p) => F[state.rowOf[p]]), fillKey: m, fillTo, mark: mk.row,
    heading: `${n0(order.length)} proteins × ${N} samples`,
  });

  // where the values sit: measured (an outline), imputed so far (bars), the truth behind the holes (dashed)
  const H = L.hist, bw = (H.x1 - H.x0) / NB, sx = (v) => H.x0 + ((v - LO) / (HI - LO)) * (H.x1 - H.x0);
  txt(ctx, colors, "Measured and imputed values", M.px, 16, { colour: colors.ink1, weight: "600" });
  const yMax = state.histMax, sh = (c) => (Math.min(c, yMax) / yMax) * (H.base - H.top);
  if (F && fillTo > 0) {
    const vals = [];
    rows.forEach((p, i) => { for (let j = 0; j < fillTo; j += 1) if (isNa(sim.obs[p][j])) vals.push(F[i][j]); });
    bins(vals, NB).forEach((c, k) => {
      if (!c) return;
      ctx.fillStyle = colors.highlight; ctx.fillRect(H.x0 + k * bw + 0.5, H.base - sh(c), bw - 1, sh(c));
      if (c > yMax) txt(ctx, colors, n0(c), H.x0 + (k + 0.5) * bw, H.top - 4, { size: "fsXs", mono: true, colour: colors.highlight, align: "center" });
    });
  }
  const step = (counts, colour, dash) => {
    ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 1.6; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(H.x0, H.base);
    counts.forEach((c, k) => { ctx.lineTo(H.x0 + k * bw, H.base - sh(c)); ctx.lineTo(H.x0 + (k + 1) * bw, H.base - sh(c)); });
    ctx.lineTo(H.x1, H.base); ctx.stroke(); ctx.restore();
  };
  step(state.measuredBins, colors.empirical);
  if (truth) step(state.truthBins, colors.reference, [4, 3]);
  rule(ctx, H.x0, H.base, H.x1, H.base, colors.axis); rule(ctx, H.x0, H.top, H.x0, H.base, colors.axis);
  const ticks = yMax > 1500 ? [0, 1000, 2000] : yMax > 600 ? [0, 500, 1000] : [0, 200, 400];
  for (const t of ticks) if (t <= yMax) { const y = H.base - sh(t); rule(ctx, H.x0 - 4, y, H.x0, y, colors.axis); txt(ctx, colors, n0(t), H.x0 - 6, y + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  for (const v of [18, 21, 24, 27, 30]) { rule(ctx, sx(v), H.base, sx(v), H.base + 4, colors.axis); txt(ctx, colors, String(v), sx(v), H.base + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  txt(ctx, colors, "log2 abundance", (H.x0 + H.x1) / 2, H.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  txt(ctx, colors, "values", M.px, H.top - 12, { size: "fsXs", colour: colors.ink3 });

  // the marked protein: its 22 values on the same log2 axis
  const S = L.strip, qx = (v) => S.x0 + ((v - LO) / (HI - LO)) * (S.x1 - S.x0);
  txt(ctx, colors, mk.title, 12, S.y - 26, { colour: colors.ink1, weight: "600" });
  if (mk.row < 0) { txt(ctx, colors, mk.missing, S.x0, S.y, { size: "fsXs", colour: colors.ink2 }); return; }
  const p = mk.id, i = mk.i, obs = sim.obs[p];
  [[0, NA, colors.groupA, "cancer"], [NA, N, colors.groupB, "healthy"]].forEach(([a, b, colour, g], k) => {
    const y = S.y + k * 22;
    rule(ctx, S.x0, y, S.x1, y, colors.grid);
    txt(ctx, colors, g, S.x0 - 8, y + 4, { size: "fsXs", colour, weight: "600", align: "right" });
    for (let j = a; j < b; j += 1) {
      if (truth && isNa(obs[j])) rule(ctx, qx(sim.truth[p][j]), y - 7, qx(sim.truth[p][j]), y + 7, colors.reference, 1.4, [2, 2]);
      if (!isNa(obs[j])) dot(ctx, qx(obs[j]), y, 3.6, colour);
      else if (F && j < fillTo) dot(ctx, qx(F[i][j]), y, 3.6, colors.surface1, colors.highlight, 2);
    }
  });
  for (const v of [18, 21, 24, 27, 30]) txt(ctx, colors, String(v), qx(v), S.y + 40, { size: "fsXs", colour: colors.ink3, align: "center" });
}

/* the protein under the matrix: an example (by id) or a row (by rank in the drawn order) */
function resolveMarked(params, state) {
  const v = params.protein;
  const ex = EXAMPLES.find((e) => e.value === v);
  const seen = (id) => `${E.seenIn(state.sim.obs[id], 0, NA)} of ${NA} cancer and ${E.seenIn(state.sim.obs[id], NA, N)} of ${NA} healthy measured`;
  if (ex) {
    const id = state.examples[v];
    const row = state.order.indexOf(id);
    if (row < 0) return { row: -1, title: `${ex.label}: removed by the Minimum measured filter`, missing: seen(id), id };
    return { row, id, i: state.rowOf[id], title: `${ex.label}, row ${row + 1}: ${seen(id)}` };
  }
  const row = Math.min(state.order.length, Number(String(v).slice(1)) || 1) - 1;
  const id = state.order[row];
  return { row, id, i: state.rowOf[id], title: `Row ${row + 1}: ${seen(id)}` };
}

/* ------------------------------------------------------------ the widget */
defineWidget({
  slug: "imputation",
  title: "Proteomics: Imputation",
  subtitle:
    "A mass spectrometer misses a protein most often where its abundance is low, so the holes in a protein matrix "
    + "are not at random. Imputation puts an estimate in each hole before the test: a sample's minimum, a low random "
    + "draw, the mean of the nearest proteins (kNN), or a regression forest. Each estimate changes what the test finds, "
    + "and testing only the measured values is the comparison for all four.",
  layout: "side",
  status: "draft",
  height: (p) => (p.page === "imputing" ? H_IMPUTING : H_MISSING),

  params: {
    page: {
      role: "page", type: "segmented", label: "Page", display: true, default: "missing",
      options: [{ value: "missing", label: "Missing" }, { value: "imputing", label: "Imputing" }],
    },
    dataSec: { type: "section", label: "The data" },
    filter: {
      type: "segmented", label: "Minimum measured", when: { param: "page", equals: "imputing" },
      detail: "the proteins kept for imputing and testing",
      options: [
        { value: "any", label: "Any", detail: "every protein measured in at least one sample" },
        { value: "half", label: "Half of a group", detail: "measured in at least 6 of the 11 samples of one group" },
      ],
      default: "any",
    },
    seed: { type: "int", label: "Seed", min: 1, max: FOREST_SEEDS, default: TYPICAL_SEED },
    methodSec: { type: "section", label: "Imputation", when: { param: "page", equals: "imputing" } },
    method: {
      type: "select", label: "Method", display: true, default: "forest", when: { param: "page", equals: "imputing" },
      detail: "what goes in each hole before the test",
      options: METHODS,
    },
    protein: {
      type: "select", label: "Example protein", display: true, default: "absent", when: { param: "page", equals: "imputing" },
      detail: "the protein drawn under the matrix; a click on a row of the matrix marks that row",
      options: [...EXAMPLES, ...ROW_OPTIONS],
    },
    truth: {
      type: "segmented", label: "True values", display: true, default: "off",
      detail: "the values behind the holes: known in a simulation, unknown in a measured data set",
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }],
    },
    /* authoring escape hatch, first render only: 1 = the page's press finished */
    shown: { type: "int", min: 0, max: 1, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "imputing"
    ? [
      { token: "empirical", label: "A measured value", mark: "bar" },
      { token: "highlight", label: "An imputed value", mark: "bar" },
      { token: "unknown", label: "A hole", mark: "bar" },
      ...(params.truth === "on" ? [{ token: "reference", label: "The true value behind a hole", mark: "dash" }] : []),
    ]
    : [
      { token: "empirical", label: "A measured value", mark: "bar" },
      { token: "unknown", label: "A missing value", mark: "bar" },
      { token: "group-a", label: "Cancer samples", mark: "bar" },
      { token: "group-b", label: "Healthy samples", mark: "bar" },
      ...(params.truth === "on" ? [{ token: "theory", label: "The chance a value is missing, at its true level", mark: "line" }] : []),
    ]),

  /* Pure and seeded: the matrix, every method's filled values and every test,
     whichever page and method are showing — both are display parameters. The
     forest's values come from the table computed ahead; the low draw takes
     the page's rng after the simulation. */
  compute: ({ params, rng }) => {
    const sim = E.simulateMatrix(rng);
    const all = sim.obs.map((r, p) => p);
    const fullOrder = E.abundanceOrder(sim.obs, all);
    const rows = E.keepRows(sim.obs, params.filter);
    const obs = rows.map((p) => sim.obs[p]);
    const rowOf = {}; rows.forEach((p, i) => { rowOf[p] = i; });
    const order = E.abundanceOrder(sim.obs, rows);
    const filled = {
      min: E.imputeMin(obs),
      lowdraw: E.imputeLowDraw(obs, rng),
      knn: E.imputeKnn(obs),
      forest: E.fillFromHoles(obs, FOREST[params.seed][params.filter]),
    };
    const scores = { measured: E.score(sim, rows, obs) };
    for (const [k, F] of Object.entries(filled)) scores[k] = E.score(sim, rows, F);
    // the examples are chosen on the unfiltered matrix, so the filter can be seen to remove one
    const knnAll = params.filter === "any" ? scores.knn : E.score(sim, all, E.imputeKnn(sim.obs));
    const minAll = params.filter === "any" ? scores.min : E.score(sim, all, E.imputeMin(sim.obs));
    const examples = E.pickExamples(sim, knnAll.padj, minAll.fc);
    const measuredBins = bins(obs.flat().filter((v) => !isNa(v)), NB);
    const truthBins = bins(rows.flatMap((p) => sim.obs[p].map((v, j) => (isNa(v) ? sim.truth[p][j] : NaN)).filter((v) => !isNa(v))), NB);
    const histMax = Math.max(...measuredBins, ...truthBins) * 1.15;
    const share = all.map((p) => { const seen = sim.obs[p].filter((v) => !isNa(v)); return { m: E.mean(seen), s: 1 - seen.length / N }; });
    const measuredIn = Array.from({ length: N }, (_, j) => sim.obs.filter((r) => !isNa(r[j])).length);
    const holes = sim.obs.flat().filter(isNa).length;
    const holesKept = obs.flat().filter(isNa).length;
    const missingTrue = []; const measuredVals = [];
    sim.obs.forEach((r, p) => r.forEach((v, j) => (isNa(v) ? missingTrue.push(sim.truth[p][j]) : measuredVals.push(v))));
    return {
      sim, rows, rowOf, order, fullOrder, filled, scores, examples, measuredBins, truthBins, histMax, share, measuredIn,
      holes, holesKept, missingTrueMean: E.mean(missingTrue), measuredMean: E.mean(measuredVals),
      wholeGroup: sim.obs.filter((r) => E.seenIn(r, 0, NA) === 0 || E.seenIn(r, NA, N) === 0).length,
      anyHole: sim.obs.filter((r) => E.seenIn(r) < N).length,
    };
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: {
      m0: "Measure", mrun: "Measure", mdone: "Measure again",
      i0: "Impute", irun: "Impute", idone: "Impute again",
    }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      m0: "Measure the 22 samples one at a time; a value under the detection limit is likely to be missed",
      mrun: "Finish measuring at once",
      mdone: "Measure the same samples again from the first",
      i0: "Fill the holes of each sample in turn with the chosen method",
      irun: "Finish imputing at once",
      idone: "Impute again from the first sample",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { mk: 0, ik: 0, page: params.page, moving: false, halt: false, swallow: false, inFF: false, ffMid: false };
      if (!fromScratch && Number(params.shown) > 0) { if (params.page === "missing") anim.mk = N; else anim.ik = N; }
      settle(anim, params.page);
      return anim;
    },
    /* A press while one runs finishes it; a press after it is done starts it
       again from the first sample. A page switch mid-press finishes that press
       and stops the loop, so the other page's press is never taken unasked
       (memory mid-press-page-switch). */
    advance: (anim, { dt, params }) => {
      if (anim.halt) { anim.halt = false; anim.moving = false; settle(anim, params.page); return false; }
      anim.moving = advanceBody(anim, dt, params);
      return anim.moving;
    },
    rebuild: (anim, { params }) => {
      if (params.page !== anim.page) {
        if (anim.moving) { if (anim.page === "missing") anim.mk = N; else anim.ik = N; anim.halt = true; }
        anim.page = params.page;
      }
      settle(anim, params.page);
    },
  },

  /* a row of the matrix on the Imputing page marks that protein */
  regions: ({ w, params, state }) => {
    if (params.page !== "imputing" || !state) return [];
    fitTo(w);
    const P = state.order.length, rh = M.h / P;
    return state.order.map((_, i) => ({ x: M.x0, y: rowY(i, P), w: M.w, h: rh, set: { protein: `r${i + 1}` }, label: `Row ${i + 1}` }));
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    if (params.page === "imputing") drawImputing(ctx, colors, w, params, state, anim);
    else drawMissing(ctx, colors, w, params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    const truth = params.truth === "on";
    const P = state.sim.obs.length;
    if (params.page === "missing") {
      const done = (anim ? anim.mk : (Number(params.shown) > 0 ? N : 0)) >= N;
      if (!done) {
        return [
          { label: "Values missing", value: "–", note: `of ${n0(P * N)}: ${n0(P)} proteins in ${N} samples` },
          { label: "Proteins with a missing value", value: "–", note: "counted once every sample is measured" },
          { label: "The missing values", value: "–", note: truth ? "their true mean, once every sample is measured" : "their level: True values On" },
        ];
      }
      return [
        { label: "Values missing", value: `${n0(state.holes)} of ${n0(P * N)}`, note: `${pct(state.holes / (P * N))} of the matrix` },
        { label: "Proteins with a missing value", value: `${n0(state.anyHole)} of ${n0(P)}`, note: `${n0(state.wholeGroup)} missing in every sample of one group` },
        truth
          ? { label: "The missing values", value: `mean ${state.missingTrueMean.toFixed(1)} log2`, note: `the measured values: mean ${state.measuredMean.toFixed(1)} log2` }
          : { label: "The missing values", value: "–", note: "their level: True values On" },
      ];
    }
    const m = params.method, s = state.scores[m];
    const ik = anim ? anim.ik : (Number(params.shown) > 0 ? N : 0);
    const ready = m === "measured" || ik >= N;
    const mk = resolveMarked(params, state);
    const kept = state.rows.length;
    const imputed = m === "measured"
      ? { label: "Values imputed", value: "none", note: `${n0(s.tested)} of ${n0(kept)} proteins hold 2 values or more in both groups` }
      : { label: "Values imputed", value: ready ? n0(state.holesKept) : "–", note: ready ? (truth ? `imputed − true: mean ${sg(s.bias, 2)} log2` : `in ${n0(kept)} proteins`) : "Impute fills the holes" };
    const called = ready
      ? { label: "Proteins called, adjusted p < 0.05", value: `${n0(s.called)} of ${n0(s.tested)}`,
        note: `Welch t-test on log2, Benjamini–Hochberg${truth ? `; ${n0(s.fp)} with no real difference (FDR ${pct(s.fdr)})` : ""}` }
      : { label: "Proteins called, adjusted p < 0.05", value: "–", note: "Welch t-test on log2, Benjamini–Hochberg" };
    let marked;
    if (mk.row < 0) marked = { label: "The marked protein", value: "removed", note: "by the Minimum measured filter" };
    else {
      const showF = m === "measured" || ready;
      const i = mk.i, fc = s.fc[i], p = s.p[i];
      const tru = truth ? `; true log2FC ${sg(state.sim.meta[mk.id].fc)}` : "";
      marked = !showF
        ? { label: "The marked protein", value: "–", note: `log2FC once its holes are filled${tru}` }
        : Number.isFinite(p)
          ? { label: "The marked protein", value: `log2FC ${sg(fc)}`, note: `p ${pFmt(p)}${tru}` }
          : { label: "The marked protein", value: "not tested", note: `fewer than 2 values in a group${tru}` };
    }
    return [imputed, called, marked];
  },
});
