/* ms-features — slot 93, metabolomics from peaks to names. DRAFT 2026-10-08.
 *
 * Planned in the catalogue's § Slot 93: measured on the lesson's MAF and
 * mocked in `_lab/ms-features-mock.html`; his nine calls all the
 * recommendation. The misconception: an m/z match is an identification. Mass
 * accuracy narrows the FORMULA (40 CHNOS formulas fit m/z 131.035 at ±0.5 Da,
 * one at ±5 ppm) and stops there: glutaric and ethylmalonic acid share
 * C5H8O4, and only the retention time against a standard tells them apart.
 * Ethylmalonic acid is 02-4's top hit; glutaric acid is detected in 30 of 179.
 *   1. three pages under Step, 02-1 cell 3's headings: Peaks · Alignment ·
 *      Identification, the feature table at the foot of Identification;
 *   2. Peaks: the sample's raw m/z × RT intensity, a zoom box joined to the
 *      trace at m/z 131.035; Detect rings each spot and brackets each peak's
 *      height in noise SDs; Integrate fills the areas and moves each into its
 *      row of the table;
 *   3. Alignment: six samples' slices over one axis of every peak; Align moves
 *      a bracket one RT window wide from tick to tick, and a tick that lands
 *      inside joins the feature; a window change walks the bracket again;
 *   4. Identification: formulas within the Mass tolerance (a change zooms the
 *      ruler), the 26 metabolites within it drawn as structures, RT against
 *      each standard, the level reached; Match mass, then Match RT;
 *   5. hover inspects everything named in the round 1 mock's § 4.
 * Round 1 (his picks, `_lab/ms-features-round1-mock.html`): all four the
 * recommendation. The press clock is 91's: only a page switch ends a press.
 */
import { defineWidget, mathmlRenders } from "../core/index.js";
import * as E from "./engine.js";

const H_PEAKS = 500, H_ALIGN = 400, H_ID = 540;
const DETECT_MS = 3000, INTEGRATE_MS = 2600, ALIGN_MS = 3000, MASS_MS = 1500, RTM_MS = 1200;
const WALK_MS = 1500, ZOOM_MS = 900;                 // the eases: a window change, a tolerance change
const RIGHT = 20, X0 = 56, XA = 112;
const LEVEL_W = 120;                                 // the right-hand column of levels on Identification
const FILL_END = 0.6;                                // Integrate: the fill, then the areas move to their rows

const fmt = (x) => Math.round(x).toLocaleString("en-GB");
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const short = (name) => name.replace(" acid", "");
const groupWord = (c) => (c === "Prostate cancer" ? "cancer" : "hyperplasia");
const sampleLabel = (s) => `${s.id} · ${s.cohort}`;

/* ------------------------------------------------------------ the press clock (91's) */
const STAGES = { peaks: 2, alignment: 1, identification: 2 };
const MS = { peaks: [DETECT_MS, INTEGRATE_MS], alignment: [ALIGN_MS], identification: [MASS_MS, RTM_MS] };
function settle(anim, page) {
  const max = STAGES[page], n = anim.n[page] ?? 0;
  anim.inert = max === 0;
  anim.done = n >= max && anim.p >= 1;
  anim.labelAt = `${page}${anim.done ? "done" : n}`;
}
/* s: presses begun on this page; p: how far the latest has run (1 = landed) */
function stageOf(page, params, anim) {
  if (!anim) return { s: params.page === page ? Math.min(STAGES[page], Number(params.shown) || 0) : 0, p: 1 };
  const s = anim.n[page] ?? 0;
  return { s, p: anim.page === page && anim.p < 1 ? anim.p : 1 };
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
function poly(ctx, xs, ys, colour, width = 1.2) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineJoin = "round";
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i]))); ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
function box(ctx, x, y, w, h, fill, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore(); }
function frame(ctx, x, y, w, h, colour, width = 1) { ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore(); }
const near = (pt, x, y, r) => pt && Math.hypot(pt.x - x, pt.y - y) <= r;

/* the hover inspector: a box of lines beside the pointer, kept on the canvas */
function tip(ctx, colors, w, x, y, lines) {
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const bw = Math.max(...lines.map((s) => ctx.measureText(s).width)) + 16, bh = lines.length * 15 + 8;
  const bx = Math.max(4, Math.min(x + 12, w - bw - 4)), by = Math.max(4, y - bh - 10);
  box(ctx, bx, by, bw, bh, colors.surface2);
  frame(ctx, bx, by, bw, bh, colors.ink3);
  lines.forEach((s, i) => txt(ctx, colors, s, bx + 8, by + 17 + i * 15, { size: "fsXs", colour: i ? colors.ink2 : colors.ink1, weight: i ? "" : "600" }));
  ctx.restore();
}

/* ------------------------------------------------------------ the slice at m/z 131.035 */
function sliceGeom(P, top) {
  return {
    sx: (t) => P.x0 + ((t - E.RT0) / (E.RT1 - E.RT0)) * (P.x1 - P.x0),
    sy: (v) => P.y1 - (Math.min(v, top) / top) * (P.y1 - P.y0),
  };
}
/* `upTo` RT: peaks marked up to it (Detect); `fillTo` RT: areas shaded up to it (Integrate) */
function drawSlice(ctx, colors, tr, P, { upTo = -1, fillTo = -1, top, ticks = true, band = false, brackets = false, peakColour = null, ring = null }) {
  const { sx, sy } = sliceGeom(P, top);
  rule(ctx, P.x0, P.y1, P.x1, P.y1, colors.axis);
  if (ticks) for (let t = 1; t <= 4.5; t += 0.5) {
    rule(ctx, sx(t), P.y1, sx(t), P.y1 + 3, colors.axis);
    if (Number.isInteger(t)) txt(ctx, colors, String(t), sx(t), P.y1 + 15, { size: "fsXs", colour: colors.ink3, align: "center" });
  }
  if (band) box(ctx, P.x0, sy(E.BASE + E.NOISE), P.x1 - P.x0, sy(E.BASE - E.NOISE) - sy(E.BASE + E.NOISE), colors.reference, 0.16);
  for (const d of tr.det) {
    if (fillTo < tr.rt[d.lo]) continue;
    const hi = Math.min(d.hi, Math.round((fillTo - E.RT0) / E.DT));
    ctx.save(); ctx.fillStyle = colors.empirical; ctx.globalAlpha = 0.45; ctx.beginPath();
    ctx.moveTo(sx(tr.rt[d.lo]), sy(E.BASE));
    for (let k = d.lo; k <= hi; k++) ctx.lineTo(sx(tr.rt[k]), sy(tr.y[k]));
    ctx.lineTo(sx(tr.rt[hi]), sy(E.BASE)); ctx.closePath(); ctx.fill(); ctx.restore();
    rule(ctx, sx(tr.rt[d.lo]), sy(E.BASE), sx(tr.rt[hi]), sy(E.BASE), colors.empirical, 1.4);
  }
  poly(ctx, tr.rt.map(sx), tr.y.map(sy), colors.ink2, 1);
  rule(ctx, P.x0, sy(E.THRESHOLD), P.x1, sy(E.THRESHOLD), colors.reference, 1.2, [5, 3]);
  for (const d of tr.det) {
    if (d.rt > upTo) continue;
    const x = sx(d.rt), y = sy(d.h + E.BASE);
    if (brackets) {
      // the peak's height over the baseline, in noise SDs: S/N as a length
      rule(ctx, x - 14, sy(E.BASE), x - 14, y, colors.ink1, 1.4);
      rule(ctx, x - 18, sy(E.BASE), x - 10, sy(E.BASE), colors.ink1, 1.4);
      rule(ctx, x - 18, y, x - 10, y, colors.ink1, 1.4);
      txt(ctx, colors, `${d.sn.toFixed(1)} SD`, x - 20, (sy(E.BASE) + y) / 2 + 4, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });
    }
    dot(ctx, x, y, 4, peakColour ? peakColour(d) : colors.empirical);
    if (ring === d) dot(ctx, x, y, 7, null, colors.ink1, 1.6);
  }
  return { sx, sy };
}

/* ------------------------------------------------------------ the Peaks page */
const peaksLayout = (w) => ({
  map: { x0: X0, x1: w - RIGHT, y0: 34, y1: 184 },
  trace: { x0: X0, x1: w - RIGHT, y0: 250, y1: 390 },
  table: { y: 444, xMz: 20, xRt: 92, xArea: 196 },
});
const ZOOM = { rt0: E.RT0, rt1: E.RT1, mz0: 126, mz1: 136 };
const sampleIndex = (params) => Math.max(0, E.SAMPLES.findIndex((s) => s.id === params.sample));

/* the raw grid as an image on the magnitude ramp, log intensity; cached per sample and theme */
const mapCache = new Map();
function mapImage(colors, grid, j) {
  const key = `${j}|${colors.surface3}|${colors.magnitude}`;
  if (mapCache.has(key)) return mapCache.get(key);
  const { nRt, nMz } = E.GRID;
  const c = document.createElement("canvas"); c.width = nRt; c.height = nMz;
  const g = c.getContext("2d"), img = g.createImageData(nRt, nMz);
  const hex = (s) => { const m = String(s).trim().match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
  const a = hex(colors.surface3), b = hex(colors.magnitude);
  const lo = Math.log10(E.NOISE * 1.2), hi = Math.log10(E.heightOf(40000));
  for (let y = 0; y < nMz; y++) for (let x = 0; x < nRt; x++) {
    const v = grid[y * nRt + x], f = clamp01((Math.log10(Math.max(v, 1)) - lo) / (hi - lo));
    const k = ((nMz - 1 - y) * nRt + x) * 4;               // m/z rises up the image
    for (let ch = 0; ch < 3; ch++) img.data[k + ch] = Math.round(a[ch] + (b[ch] - a[ch]) * f);
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  mapCache.set(key, c);
  return c;
}

/* Integrate's clock: the fill over the first FILL_END, then each area moves to its row, one at a time */
function integrateClock(s, p, n) {
  if (s < 2) return { fillTo: -1, moved: () => 0 };
  if (p >= 1) return { fillTo: Infinity, moved: () => 1 };
  const fillTo = p < FILL_END ? E.RT0 + (p / FILL_END) * (E.RT1 - E.RT0) : Infinity;
  const moved = (k) => (p < FILL_END ? 0 : easeInOut(clamp01(((p - FILL_END) / (1 - FILL_END)) * n - k)));
  return { fillTo, moved };
}

function drawPeaks(ctx, colors, w, params, state, anim, pointer) {
  const L = peaksLayout(w), j = sampleIndex(params), tr = state.traces[j], s0 = E.SAMPLES[j];
  const { s, p } = stageOf("peaks", params, anim);
  // Detect sweeps RT 0 → 10 min across the map and the slice together
  const detT = s >= 2 || (s === 1 && p >= 1) ? Infinity : s === 1 ? p * E.MAP_RT : -1;
  const { fillTo, moved } = integrateClock(s, p, tr.det.length);
  const integrated = s >= 2 && p >= 1;

  txt(ctx, colors, `Sample ${s0.id} (${s0.cohort}): intensity at every m/z and RT`, 12, 18, { colour: colors.ink1, weight: "600" });
  const M = L.map;
  const mx = (t) => M.x0 + (t / E.MAP_RT) * (M.x1 - M.x0), my = (m) => M.y1 - ((m - E.GRID.mz0) / (E.GRID.mz1 - E.GRID.mz0)) * (M.y1 - M.y0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(mapImage(colors, state.grids[j], j), M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0); ctx.restore();
  rule(ctx, M.x0, M.y1, M.x1, M.y1, colors.axis); rule(ctx, M.x0, M.y0, M.x0, M.y1, colors.axis);
  for (let t = 0; t <= E.MAP_RT; t += 2) { rule(ctx, mx(t), M.y1, mx(t), M.y1 + 3, colors.axis); txt(ctx, colors, String(t), mx(t), M.y1 + 14, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  for (let m = 100; m <= 220; m += 40) { rule(ctx, M.x0 - 3, my(m), M.x0, my(m), colors.axis); txt(ctx, colors, String(m), M.x0 - 6, my(m) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "m/z", M.x0 - 6, M.y0 - 6, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "RT (min)", M.x1, M.y1 + 28, { size: "fsXs", colour: colors.ink3, align: "right" });
  /* each spot the sweep has passed is ringed if it stands at S/N 3 or more — the
     trace's rule, applied to every row (his call, 2026-10-08: the rings had marked
     the file's non-zero values, three of which sit below the line at this noise
     level); after Integrate, the ring is sized by its area. Every spot the file
     records can be inspected, ringed or not. */
  const spots = E.METS.filter((m) => m.at[j] > 0).map((m) => ({ m, x: mx(m.rt + E.SHIFT[j]), y: my(m.exact), rt: m.rt + E.SHIFT[j], sn: E.snOf(m.at[j]) }));
  let hoverSpot = null;
  for (const sp of spots) {
    if (sp.rt > detT) continue;
    if (sp.sn >= 3) dot(ctx, sp.x, sp.y, integrated ? Math.max(3, 1.5 + 1.6 * (Math.log10(sp.m.at[j]) - 3)) : 6, null, colors.ink1, 1.4);
    if (!hoverSpot && near(pointer, sp.x, sp.y, 9)) hoverSpot = sp;
  }
  if (detT > 0 && detT < E.MAP_RT) rule(ctx, mx(detT), M.y0, mx(detT), M.y1, colors.ink1, 1.5);
  if (detT >= 0) txt(ctx, colors, `${spots.filter((sp) => sp.rt <= detT && sp.sn >= 3).length} above S/N 3`, M.x1 - 4, M.y0 + 12, { size: "fsXs", colour: colors.ink1, align: "right" });
  // the zoom box, joined to the trace below
  const P = L.trace;
  const bx0 = mx(ZOOM.rt0), bx1 = mx(ZOOM.rt1), by0 = my(ZOOM.mz1), by1 = my(ZOOM.mz0);
  frame(ctx, bx0, by0, bx1 - bx0, by1 - by0, colors.ink1, 1.4);
  rule(ctx, bx0, by1, P.x0, P.y0 - 2, colors.ink3, 1, [3, 3]);
  rule(ctx, bx1, by1, P.x1, P.y0 - 2, colors.ink3, 1, [3, 3]);

  const g = drawSlice(ctx, colors, tr, P, { upTo: detT, fillTo, top: state.top[j], band: true, brackets: true });
  txt(ctx, colors, "The box at m/z 131.035 ± 5 ppm: intensity against RT", P.x0 + 6, P.y0 + 14, { colour: colors.ink1, weight: "600" });
  txt(ctx, colors, "S/N 3", P.x1 - 2, g.sy(E.THRESHOLD) - 5, { size: "fsXs", colour: colors.reference, align: "right" });
  txt(ctx, colors, "noise ±1 SD", P.x0 + 4, g.sy(E.BASE - E.NOISE) + 13, { size: "fsXs", colour: colors.reference });
  if (detT > E.RT0 && detT < E.RT1) rule(ctx, g.sx(detT), P.y0, g.sx(detT), P.y1, colors.ink1, 1.5);
  txt(ctx, colors, "retention time (min)", (P.x0 + P.x1) / 2, P.y1 + 30, { size: "fsXs", colour: colors.ink3, align: "center" });

  // the table: a row per peak; m/z and RT once detected, the area once it has arrived
  const T = L.table;
  txt(ctx, colors, "m/z", T.xMz, T.y, { size: "fsXs", colour: colors.ink3, mono: true });
  txt(ctx, colors, "RT", T.xRt, T.y, { size: "fsXs", colour: colors.ink3, mono: true });
  txt(ctx, colors, "area", T.xArea, T.y, { size: "fsXs", colour: colors.ink3, mono: true, align: "right" });
  tr.det.forEach((d, k) => {
    const ry = T.y + 18 + k * 16, seen = d.rt <= detT;
    txt(ctx, colors, seen ? "131.035" : "–", T.xMz, ry, { size: "fsXs", colour: seen ? colors.ink1 : colors.ink3, mono: true });
    txt(ctx, colors, seen ? d.rt.toFixed(2) : "–", T.xRt, ry, { size: "fsXs", colour: seen ? colors.ink1 : colors.ink3, mono: true });
    // the area: by the peak once filled, then down its own column and along its row (an L, one mover at a time)
    const filled = fillTo >= tr.rt[d.hi], e = moved(k);
    const px = g.sx(d.rt) + 10, py = Math.min(g.sy(d.h + E.BASE), g.sy(E.THRESHOLD) - 26) + 18;
    if (!filled) { txt(ctx, colors, "–", T.xArea, ry, { size: "fsXs", colour: colors.ink3, mono: true, align: "right" }); return; }
    if (e >= 1) { txt(ctx, colors, fmt(d.area), T.xArea, ry, { size: "fsXs", colour: colors.empirical, mono: true, align: "right", weight: "600" }); return; }
    const down = clamp01(e * 2), across = clamp01(e * 2 - 1);
    const x = px + (T.xArea - 44 - px) * across, y = py + (ry - py) * down;
    txt(ctx, colors, fmt(d.area), x, y, { size: "fsXs", colour: colors.empirical, mono: true, weight: "600" });
    if (e === 0) txt(ctx, colors, "–", T.xArea, ry, { size: "fsXs", colour: colors.ink3, mono: true, align: "right" });
  });
  tr.det.forEach((d) => { if (d.rt <= detT) txt(ctx, colors, `RT ${d.rt.toFixed(2)}`, g.sx(d.rt) + 10, Math.min(g.sy(d.h + E.BASE), g.sy(E.THRESHOLD) - 26) + 4, { size: "fsXs", colour: colors.ink1, weight: "600" }); });

  // hover: a spot on the map, or a point on the trace
  if (hoverSpot) {
    dot(ctx, hoverSpot.x, hoverSpot.y, 9, null, colors.ink1, 2);
    tip(ctx, colors, w, hoverSpot.x, hoverSpot.y, [hoverSpot.m.name, `m/z ${hoverSpot.m.exact.toFixed(4)} · RT ${hoverSpot.rt.toFixed(2)} min`, `S/N ${hoverSpot.sn.toFixed(1)}: ${hoverSpot.sn >= 3 ? "above" : "below"} the line of 3`, `the file records ${fmt(hoverSpot.m.at[j])}`]);
  } else if (pointer && pointer.x >= P.x0 && pointer.x <= P.x1 && pointer.y >= P.y0 && pointer.y <= P.y1) {
    const t = E.RT0 + ((pointer.x - P.x0) / (P.x1 - P.x0)) * (E.RT1 - E.RT0);
    const i = Math.max(0, Math.min(tr.y.length - 1, Math.round((t - E.RT0) / E.DT)));
    rule(ctx, g.sx(tr.rt[i]), P.y0, g.sx(tr.rt[i]), P.y1, colors.ink3, 1);
    dot(ctx, g.sx(tr.rt[i]), g.sy(tr.y[i]), 3, colors.ink1);
    tip(ctx, colors, w, g.sx(tr.rt[i]), g.sy(tr.y[i]), [`RT ${tr.rt[i].toFixed(2)} min`, `intensity ${fmt(tr.y[i])}`, `${((tr.y[i] - E.BASE) / E.NOISE).toFixed(1)} noise SDs over the baseline`]);
  }
}

/* ------------------------------------------------------------ the Alignment page */
const alignLayout = (w) => ({ x0: XA, x1: w - RIGHT, y0: 40, row: 44, axis: 40 + 44 * 6 + 40 });
/* how far the bracket has walked: the press, or the walk again after a window change */
function walkT(params, anim) {
  const { s, p } = stageOf("alignment", params, anim);
  if (s < 1) return -1;
  if (p < 1) return E.RT0 + p * (E.RT1 - E.RT0);
  if (anim && anim.walk < 1) return E.RT0 + anim.walk * (E.RT1 - E.RT0);
  return Infinity;
}
function drawAlignment(ctx, colors, w, params, state, anim, pointer) {
  const L = alignLayout(w), win = Number(params.window), fs = state.features[params.window];
  const T = walkT(params, anim);
  const sx = (t) => L.x0 + ((t - E.RT0) / (E.RT1 - E.RT0)) * (L.x1 - L.x0);
  const ay = L.axis;
  const peaks = state.traces.flatMap((t) => t.det);
  txt(ctx, colors, "m/z 131.035 in six samples, each trace on its own scale", 12, 18, { colour: colors.ink1, weight: "600" });

  // hover: a peak first, else a feature band
  let hoverPeak = null, hoverFeature = null;
  if (pointer) {
    state.traces.forEach((tr, j) => {
      const P = { x0: L.x0, x1: L.x1, y0: L.y0 + j * L.row + 3, y1: L.y0 + (j + 1) * L.row - 3 }, g = sliceGeom(P, state.top[j]);
      tr.det.forEach((d) => { if (!hoverPeak && near(pointer, g.sx(d.rt), g.sy(d.h + E.BASE), 8)) hoverPeak = d; });
      tr.det.forEach((d) => { if (!hoverPeak && near(pointer, sx(d.rt), ay, 6)) hoverPeak = d; });
    });
    if (!hoverPeak && T === Infinity && pointer.y >= L.y0 - 4 && pointer.y <= ay + 12) hoverFeature = fs.find((f) => pointer.x >= sx(f.lo) - 6 && pointer.x <= sx(f.hi) + 6) ?? null;
  }

  const colourOf = new Map();
  fs.forEach((f) => {
    if (T < f.lo) return;
    const hi = Math.min(f.hi, T), c = colors.clusters[f.k % colors.clusters.length];
    box(ctx, sx(f.lo) - 6, L.y0 - 4, sx(hi) - sx(f.lo) + 12, ay + 12 - (L.y0 - 4), c, hoverFeature === f ? 0.34 : 0.18);
    txt(ctx, colors, sx(f.hi) - sx(f.lo) > 50 ? `feature ${f.k + 1}` : `${f.k + 1}`, (sx(f.lo) + sx(f.hi)) / 2, L.y0 - 10, { size: "fsXs", colour: c, weight: "600", align: "center" });
    f.peaks.forEach((pk) => { if (pk.rt <= T) colourOf.set(pk, c); });
  });
  E.SAMPLES.forEach((s0, j) => {
    const P = { x0: L.x0, x1: L.x1, y0: L.y0 + j * L.row + 3, y1: L.y0 + (j + 1) * L.row - 3 };
    drawSlice(ctx, colors, state.traces[j], P, { upTo: Infinity, top: state.top[j], ticks: false, peakColour: (d) => colourOf.get(d) ?? colors.ink1, ring: hoverPeak });
    if (hoverFeature) {
      const g = sliceGeom(P, state.top[j]);
      hoverFeature.peaks.filter((pk) => pk.j === j).forEach((pk) => dot(ctx, g.sx(pk.rt), g.sy(pk.h + E.BASE), 7, null, colors.ink1, 1.6));
    }
    txt(ctx, colors, s0.id.slice(-3), L.x0 - 8, P.y1 - 12, { size: "fsXs", colour: colors.ink1, align: "right", mono: true });
    txt(ctx, colors, groupWord(s0.cohort), L.x0 - 8, P.y1 + 1, { size: "fsXs", colour: colors.ink3, align: "right" });
  });

  // every peak on one RT axis, and the bracket one window wide
  txt(ctx, colors, "every peak", L.x0 - 8, ay + 4, { size: "fsXs", colour: colors.ink2, align: "right" });
  rule(ctx, L.x0, ay, L.x1, ay, colors.axis);
  peaks.forEach((pk) => rule(ctx, sx(pk.rt), ay - 9, sx(pk.rt), ay + 9, colourOf.get(pk) ?? colors.ink1, hoverPeak === pk ? 3.5 : 2));
  for (let t = 1; t <= 4; t += 1) txt(ctx, colors, String(t), sx(t), ay + 24, { size: "fsXs", colour: colors.ink3, align: "center" });
  txt(ctx, colors, "retention time (min)", (L.x0 + L.x1) / 2, ay + 42, { size: "fsXs", colour: colors.ink3, align: "center" });
  if (T >= E.RT0 && T < Infinity) {
    /* the bracket starts at the latest tick passed and reaches one window to the
       right: the next tick joins that feature if it lands inside */
    const last = peaks.map((pk) => pk.rt).filter((r) => r <= T).sort((a, b) => b - a)[0];
    if (last != null) {
      const bx = sx(last), bw = sx(E.RT0 + win) - sx(E.RT0);
      rule(ctx, bx, ay - 16, bx + bw, ay - 16, colors.ink1, 2);
      rule(ctx, bx, ay - 20, bx, ay - 12, colors.ink1, 2);
      rule(ctx, bx + bw, ay - 20, bx + bw, ay - 12, colors.ink1, 2);
      txt(ctx, colors, `${params.window} min`, bx + bw / 2, ay - 23, { size: "fsXs", colour: colors.ink1, weight: "600", align: "center" });
    }
  }

  if (hoverPeak) {
    const s0 = E.SAMPLES[hoverPeak.j], f = fs.find((g) => g.peaks.includes(hoverPeak));
    tip(ctx, colors, w, pointer.x, pointer.y, [`${s0.id} · ${s0.cohort}`, `RT ${hoverPeak.rt.toFixed(2)} min · area ${fmt(hoverPeak.area)}`, f && T === Infinity ? `in feature ${f.k + 1}` : "not yet grouped"]);
  } else if (hoverFeature) {
    const n = new Set(hoverFeature.peaks.map((pk) => pk.j)).size;
    tip(ctx, colors, w, pointer.x, pointer.y, [`Feature ${hoverFeature.k + 1}`, `RT ${hoverFeature.lo.toFixed(2)}–${hoverFeature.hi.toFixed(2)} min`, `${hoverFeature.peaks.length} peaks in ${n} sample${n === 1 ? "" : "s"}`]);
  }
}

/* ------------------------------------------------------------ the Identification page */
const idLayout = (w) => ({ x0: 24, x1: w - RIGHT - LEVEL_W, lx: w - RIGHT, ruler: 86, cards: 164, rt: 368, table: 424 });
const HALF = { unit: 0.6, ppm: 0.012 };              // the ruler's half-width in Da at each tolerance
function featureOf(params, state) {
  const fs = state.features[params.window];
  const k = Number(params.feature);
  return params.feature === "largest" || !(k >= 1 && k <= fs.length) ? E.largest(fs) : fs[k - 1];
}
function nameOf(f, stage, tol) {
  if (stage < 1) return { name: "–", by: "–" };
  const { cands, byRt } = E.identify(f, tol);
  if (stage >= 2 && byRt.length === 1) return { name: byRt[0].name, by: "m/z, RT", hit: true };
  return { name: cands.map((m) => short(m.name)).join(" or "), by: "m/z" };
}
/* skeletal formulas from the MAF's SMILES: glutaric OC(=O)CCCC(O)=O, ethylmalonic CCC(C(O)=O)C(O)=O */
function skeleton(ctx, colors, x, y, name) {
  const s = 20, dx = s * Math.cos(Math.PI / 6), dy = s * Math.sin(Math.PI / 6);
  const bond = (a, b, dbl = false) => {
    rule(ctx, a[0], a[1], b[0], b[1], colors.ink1, 1.6);
    if (dbl) { const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny); rule(ctx, a[0] + (nx / L) * 4, a[1] + (ny / L) * 4, b[0] + (nx / L) * 4, b[1] + (ny / L) * 4, colors.ink1, 1.6); }
  };
  const O = (p, t) => { box(ctx, p[0] - 10, p[1] - 8, 20, 16, colors.surface2); txt(ctx, colors, t, p[0], p[1] + 4, { size: "fsXs", colour: colors.ink1, weight: "600", align: "center" }); };
  const acid = (c, toLeft, up) => {
    const oh = [c[0] + (toLeft ? -dx : dx), c[1] + (up ? -dy : dy)], o = [c[0], c[1] + (up ? s : -s)];
    bond(c, oh); bond(c, o, true); O(oh, toLeft ? "HO" : "OH"); O(o, "O");
  };
  if (name === "Glutaric acid") {
    const c = [0, 1, 2, 3, 4].map((i) => [x + i * dx, y + (i % 2 ? -dy : dy)]);
    for (let i = 0; i < 4; i++) bond(c[i], c[i + 1]);
    acid(c[0], true, true); acid(c[4], false, true);
  } else if (name === "Ethylmalonic acid") {
    const ca = [x + 2 * dx, y + 6], c1 = [ca[0] - dx, ca[1] - dy], c2 = [ca[0] + dx, ca[1] - dy], e1 = [ca[0], ca[1] + s], e2 = [e1[0] + dx, e1[1] + dy];
    bond(ca, c1); bond(ca, c2); bond(ca, e1); bond(e1, e2);
    acid(c1, true, false); acid(c2, false, false);
  }
}
function drawIdentification(ctx, colors, w, params, state, anim, pointer) {
  const L = idLayout(w), tol = params.tolerance, f = featureOf(params, state);
  const fs = state.features[params.window];
  const { s, p } = stageOf("identification", params, anim);
  const massP = s >= 2 || (s === 1 && p >= 1) ? 1 : s === 1 ? p : 0;
  const rtP = s >= 2 ? p : 0;
  const level = (y, n, sub, on) => {
    txt(ctx, colors, n, L.lx, y, { colour: on ? colors.ink1 : colors.ink3, weight: "700", align: "right" });
    txt(ctx, colors, sub, L.lx, y + 14, { size: "fsXs", colour: colors.ink3, align: "right" });
  };
  txt(ctx, colors, `Feature ${f.k + 1} of ${fs.length}: m/z ${E.FEATURE_MZ.toFixed(4)}, RT ${f.rt.toFixed(2)} min`, 12, 20, { colour: colors.ink1, weight: "600" });

  // 1 · formulas within the tolerance: a ruler of every CHNOS formula's [M−H]⁻, zoomed by a tolerance change
  const z = anim && anim.zoom.t < 1 ? { from: anim.zoom.from, e: easeInOut(anim.zoom.t) } : null;
  const lerpLog = (a, b, e) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * e);
  const half = z ? lerpLog(HALF[z.from], HALF[tol], z.e) : HALF[tol];
  const winD = z ? lerpLog(E.tolDa(z.from, E.FEATURE_MZ), E.tolDa(tol, E.FEATURE_MZ), z.e) : E.tolDa(tol, E.FEATURE_MZ);
  const lo = E.FEATURE_MZ - half, hi = E.FEATURE_MZ + half;
  const rx = (m) => L.x0 + ((m - lo) / (hi - lo)) * (L.x1 - L.x0), ry = L.ruler;
  txt(ctx, colors, `1 · Mass: CHNOS formulas within ${tol === "unit" ? "±0.5 Da" : "±5 ppm"}`, 12, 48, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ry + 10, L.x1, ry + 10, colors.axis);
  [lo, E.FEATURE_MZ, hi].forEach((m) => txt(ctx, colors, m.toFixed(half > 0.1 ? 2 : 3), rx(m), ry + 24, { size: "fsXs", colour: colors.ink3, align: "center", mono: true }));
  const shownHalf = winD * easeInOut(massP);
  if (massP > 0) box(ctx, rx(E.FEATURE_MZ - shownHalf), ry - 16, Math.max(2, rx(E.FEATURE_MZ + shownHalf) - rx(E.FEATURE_MZ - shownHalf)), 26, colors.highlight, 0.18);
  let hoverTick = null;
  for (const fm of state.formulasWide) {
    const x = rx(fm.mz);
    if (x < L.x0 || x > L.x1) continue;
    const inside = massP > 0 && Math.abs(fm.mz - E.FEATURE_MZ) <= shownHalf;
    rule(ctx, x, ry - 12, x, ry + 10, inside ? colors.ink1 : colors.ink3, 1.2);
    if (pointer && Math.abs(pointer.x - x) <= 3 && Math.abs(pointer.y - ry) <= 16) hoverTick = { fm, x };
  }
  rule(ctx, rx(E.FEATURE_MZ), ry - 18, rx(E.FEATURE_MZ), ry + 14, colors.empirical, 2);
  if (massP >= 1 && !z) {
    const nIn = (tol === "unit" ? state.formulasUnit : state.formulasPpm).length;
    txt(ctx, colors, tol === "unit" ? `${nIn} formulas` : `1 formula: ${state.formulasPpm[0].f}`, L.x1, 48, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });
    level(68, tol === "unit" ? "level 5" : "level 4", tol === "unit" ? "exact mass" : "molecular formula", true);
  }

  // 2 · the 26 metabolites within the tolerance, drawn as structures
  const cands = E.candidates(E.FEATURE_MZ, tol);
  txt(ctx, colors, "2 · The 26 metabolites within the tolerance", 12, L.cards - 12, { colour: colors.ink1, weight: "600" });
  if (massP >= 1) {
    const cw = Math.min(220, (L.x1 - L.x0 - 12) / Math.max(2, cands.length));
    cands.forEach((m, k) => {
      const bx = L.x0 + k * (cw + 12), on = rtP >= 1 && Math.abs(f.rt - m.rt) <= E.RT_TOL;
      box(ctx, bx, L.cards, cw, 110, colors.surface2);
      if (on) frame(ctx, bx, L.cards, cw, 110, colors.highlight, 2);
      txt(ctx, colors, m.name, bx + 8, L.cards + 17, { colour: on ? colors.highlight : colors.ink1, weight: "600" });
      txt(ctx, colors, `${m.formula} · ${E.ppmOf(E.FEATURE_MZ, m.exact).toFixed(1)} ppm`, bx + 8, L.cards + 32, { size: "fsXs", colour: colors.ink2, mono: true });
      skeleton(ctx, colors, bx + cw / 2 - 2 * 17.3, L.cards + 66, m.name);
    });
    level(L.cards + 16, "level 3", `${cands.length} candidates`, true);
  }

  // 3 · RT against each candidate's standard
  const T0 = 1.5, T1 = 4.0, tx = (t) => L.x0 + ((t - T0) / (T1 - T0)) * (L.x1 - L.x0), ty = L.rt;
  txt(ctx, colors, `3 · Retention time against each standard (±${E.RT_TOL} min)`, 12, ty - 70, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ty, L.x1, ty, colors.axis);
  for (let t = T0; t <= T1 + 1e-9; t += 0.5) txt(ctx, colors, t.toFixed(1), tx(t), ty + 14, { size: "fsXs", colour: colors.ink3, align: "center" });
  let hoverStd = null;
  if (rtP > 0) {
    cands.forEach((m) => {
      const hit = rtP >= 1 && Math.abs(f.rt - m.rt) <= E.RT_TOL;
      box(ctx, tx(m.rt - E.RT_TOL), ty - 30, tx(m.rt + E.RT_TOL) - tx(m.rt - E.RT_TOL), 30, hit ? colors.highlight : colors.reference, 0.18);
      rule(ctx, tx(m.rt), ty - 32, tx(m.rt), ty, colors.reference, 2);
      txt(ctx, colors, `${short(m.name)} ${m.rt}`, tx(m.rt), ty - 38, { size: "fsXs", colour: hit ? colors.highlight : colors.ink2, align: "center", weight: hit ? "600" : "" });
      if (pointer && Math.abs(pointer.x - tx(m.rt)) <= 8 && pointer.y >= ty - 46 && pointer.y <= ty + 4) hoverStd = m;
    });
    // the feature drops onto its RT
    const fx = tx(Math.max(T0, Math.min(T1, f.rt)));
    const y = ty - 62 + 50 * easeInOut(clamp01(rtP));
    dot(ctx, fx, y, 5, colors.empirical);
    if (rtP >= 1) {
      txt(ctx, colors, `feature ${f.rt.toFixed(2)}`, fx, ty + 30, { size: "fsXs", colour: colors.empirical, align: "center", weight: "600" });
      const { byRt } = E.identify(f, tol);
      level(ty - 52, byRt.length === 1 ? "level 1" : "level 3", byRt.length === 1 ? "with the standard's MS2" : "no standard within ±0.1", byRt.length === 1);
    }
  }

  // the feature table: one row a feature, the names as far as the presses have gone
  const stage = massP >= 1 ? (rtP >= 1 ? 2 : 1) : 0;
  txt(ctx, colors, `The feature table (RT window ${params.window} min)`, 12, L.table - 10, { colour: colors.ink1, weight: "600" });
  const cols = tableCols(w);
  ["m/z", "RT", "name", "matched by", ...E.SAMPLES.map((s0) => s0.id.slice(-3))].forEach((c, k) => txt(ctx, colors, c, cols[k], L.table + 8, { size: "fsXs", colour: colors.ink3, mono: true, align: k >= 4 ? "right" : "left" }));
  fs.forEach((g, r) => {
    const y = L.table + 26 + r * 17, sel = g === f, nm = nameOf(g, stage, tol);
    const over = pointer && pointer.y >= y - 12 && pointer.y < y + 4 && pointer.x >= 8;
    if (sel || over) box(ctx, 8, y - 12, w - RIGHT - 4, 16, colors.surface2);
    const cells = [E.FEATURE_MZ.toFixed(4), g.rt.toFixed(2), nm.hit ? short(nm.name) : nm.name, nm.by, ...g.area.map((a) => (a > 0 ? `${Math.round(a / 1000)}k` : "0"))];
    cells.forEach((c, k) => txt(ctx, colors, c, cols[k], y, { size: "fsXs", mono: k !== 2, align: k >= 4 ? "right" : "left", colour: k === 2 && nm.hit ? colors.highlight : colors.ink1, weight: sel && k === 2 ? "600" : "" }));
  });

  if (hoverTick) {
    rule(ctx, hoverTick.x, ry - 14, hoverTick.x, ry + 12, colors.ink1, 3);
    tip(ctx, colors, w, hoverTick.x, ry - 14, [hoverTick.fm.f, `m/z ${hoverTick.fm.mz.toFixed(4)}`, `${E.ppmOf(hoverTick.fm.mz, E.FEATURE_MZ).toFixed(0)} ppm from the feature`]);
  } else if (hoverStd) {
    tip(ctx, colors, w, tx(hoverStd.rt), ty - 46, [`${hoverStd.name}, the standard`, `RT ${hoverStd.rt} min`, `${Math.abs(f.rt - hoverStd.rt).toFixed(2)} min from the feature`]);
  }
}
const tableCols = (w) => { const r = w - RIGHT; return [16, 82, 122, 280, ...E.SAMPLES.map((_, j) => r - (E.SAMPLES.length - 1 - j) * 42)]; };

/* ------------------------------------------------------------ the formula card */
const MATHML = mathmlRenders();
const FORMULAS = {
  peaks: {
    math: "<math><mrow><mi>S/N</mi><mo>=</mo><mfrac><mi>h</mi><msub><mi>σ</mi><mtext>noise</mtext></msub></mfrac><mo>≥</mo><mn>3</mn><mo>,</mo><mspace width='1em'/><mi>A</mi><mo>=</mo><munder><mo>∑</mo><mi>t</mi></munder><mo>(</mo><msub><mi>y</mi><mi>t</mi></msub><mo>−</mo><mi>b</mi><mo>)</mo><mi>Δ</mi><mi>t</mi></mrow></math>",
    plain: "S/N = h / σ_noise ≥ 3,  A = Σ (y_t − b) Δt",
    note: "a peak is detected when its height h over the baseline b is at least three times the SD of the noise; its area A, summed over the peak, is the abundance recorded in the table",
  },
  alignment: {
    math: "<math><mrow><mo>|</mo><msub><mi>RT</mi><mi>a</mi></msub><mo>−</mo><msub><mi>RT</mi><mi>b</mi></msub><mo>|</mo><mo>≤</mo><mi>w</mi></mrow></math>",
    plain: "|RT_a − RT_b| ≤ w",
    note: "peaks at the same m/z are sorted by retention time, and a peak within the window w of the one before it joins that peak's feature",
  },
  identification: {
    math: "<math><mrow><mi>error</mi><mo>=</mo><mfrac><mrow><msub><mi>m</mi><mtext>observed</mtext></msub><mo>−</mo><msub><mi>m</mi><mtext>exact</mtext></msub></mrow><msub><mi>m</mi><mtext>exact</mtext></msub></mfrac><mo>×</mo><msup><mn>10</mn><mn>6</mn></msup><mspace width='0.3em'/><mtext>ppm</mtext></mrow></math>",
    plain: "error = (m_observed − m_exact) / m_exact × 10⁶ ppm",
    note: "m_exact is the [M−H]⁻ mass computed from a formula; molecules with the same formula have the same exact mass, so a mass match names a formula and leaves its structures open",
  },
};
let mathHost = null, mathKey = null;
function renderFormula(key) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === key) return;
  mathKey = key;
  const F = FORMULAS[key];
  mathHost.innerHTML = `<div class="w-math-eq"><span style="color:var(--ink-2)">${MATHML ? F.math : F.plain}</span></div><div class="w-math-note">${F.note}</div>`;
}

/* ------------------------------------------------------------ the widget */
/* 1–5: the most features any RT window gives on this data (5 at 0.05 min) */
const FEATURE_OPTIONS = [{ value: "largest", label: "The largest" }, ...Array.from({ length: 5 }, (_, k) => ({ value: String(k + 1), label: `Feature ${k + 1}` }))];

defineWidget({
  slug: "ms-features",
  title: "Metabolomics: Peaks to Names",
  subtitle:
    "LC-MS records each metabolite as a peak at an m/z and a retention time (RT). Peaks are detected above the noise, "
    + "integrated to an area, grouped across samples into features, and matched to a database. A mass match narrows the "
    + "molecular formula; isomers share it, and the RT of an authentic standard decides between them.",
  layout: "side",
  status: "draft",
  pointer: true,
  height: (p) => (p.page === "identification" ? H_ID : p.page === "alignment" ? H_ALIGN : H_PEAKS),

  params: {
    page: {
      role: "page", type: "segmented", label: "Step", display: true, default: "peaks",
      options: [{ value: "peaks", label: "Peaks" }, { value: "alignment", label: "Alignment" }, { value: "identification", label: "Identification" }],
    },
    peaksSec: { type: "section", label: "The sample", when: { param: "page", equals: "peaks" } },
    sample: {
      type: "select", label: "Sample", display: true, default: E.SAMPLES[1].id, when: { param: "page", equals: "peaks" },
      detail: "six serum samples of MTBLS6038, with the areas its file records",
      options: E.SAMPLES.map((s0) => ({ value: s0.id, label: sampleLabel(s0) })),
    },
    alignSec: { type: "section", label: "Grouping", when: { param: "page", equals: "alignment" } },
    window: {
      type: "segmented", label: "RT window", display: true, default: "0.3", when: { param: "page", equals: "alignment" },
      detail: "the largest gap in retention time between two peaks of one feature, in minutes",
      options: E.WINDOWS.map((v) => ({ value: v, label: v })),
    },
    idSec: { type: "section", label: "Matching", when: { param: "page", equals: "identification" } },
    tolerance: {
      type: "segmented", label: "Mass tolerance", display: true, default: "unit", when: { param: "page", equals: "identification" },
      options: [
        { value: "unit", label: "±0.5 Da", detail: "unit resolution, as the triple quadrupole that measured MTBLS6038" },
        { value: "ppm", label: "±5 ppm", detail: "high resolution, as an Orbitrap or a time-of-flight instrument" },
      ],
    },
    feature: {
      type: "select", label: "Feature", display: true, default: "largest", when: { param: "page", equals: "identification" },
      detail: "the feature matched above; a click on a row of the table selects it",
      options: FEATURE_OPTIONS,
    },
    /* authoring escape hatch, first render only: presses finished on the page */
    shown: { type: "int", min: 0, max: 2, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "alignment") {
      return [
        { token: "ink-2", label: "The intensity at m/z 131.035", mark: "line" },
        { token: "cluster-a", label: "A feature: peaks grouped across samples", mark: "bar" },
        { token: "reference", label: "S/N 3: the detection limit", mark: "dash" },
      ];
    }
    if (params.page === "identification") {
      return [
        { token: "empirical", label: "The feature: its m/z and its RT", mark: "line" },
        { token: "highlight", label: "Within the tolerance, and the match", mark: "bar" },
        { token: "reference", label: "An authentic standard's RT", mark: "line" },
      ];
    }
    return [
      { token: "magnitude", label: "Intensity, from the noise to the brightest spot", mark: "bar" },
      { token: "ink-2", label: "The intensity at m/z 131.035", mark: "line" },
      { token: "empirical", label: "A detected peak, and its integrated area", mark: "dot" },
      { token: "reference", label: "S/N 3, and the noise band of ±1 SD", mark: "dash" },
    ];
  },

  /* Pure and seeded: six traces and their peaks, six raw maps, the features at every window, the formulas. */
  compute: ({ rng }) => {
    const traces = E.simulate(rng);
    const grids = E.SAMPLES.map((_, j) => E.rawGrid(rng, j));
    const top = traces.map((t) => Math.max(...t.y) * 1.08);
    const features = Object.fromEntries(E.WINDOWS.map((v) => [v, E.group(traces, Number(v))]));
    return {
      traces, grids, top, features,
      formulasWide: E.formulas(E.FEATURE_MZ, 0.6),
      formulasUnit: E.formulas(E.FEATURE_MZ, 0.5),
      formulasPpm: E.formulas(E.FEATURE_MZ, E.tolDa("ppm", E.FEATURE_MZ)),
    };
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: {
      peaks0: "Detect", peaks1: "Integrate", peaksdone: "Integrate",
      alignment0: "Align", alignmentdone: "Align",
      identification0: "Match mass", identification1: "Match RT", identificationdone: "Match RT",
    }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      peaks0: "Find the spots that stand at least three noise SDs above the baseline",
      peaks1: "Sum the area over the baseline under each detected peak, and enter it in the table",
      peaksdone: "Every peak in this sample has been detected and integrated",
      alignment0: "Group the six samples' peaks into features by retention time",
      alignmentdone: "The peaks have been grouped; change RT window to group them again",
      identification0: "Find every formula, and every metabolite of the 26, within the mass tolerance",
      identification1: "Compare the feature's retention time with each candidate's standard",
      identificationdone: "The feature has been matched by mass and by retention time",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: { peaks: 0, alignment: 0, identification: 0 }, p: 1, page: params.page, walk: 1, win: params.window, zoom: { from: params.tolerance, to: params.tolerance, t: 1 } };
      if (!fromScratch && Number(params.shown) > 0) anim.n[params.page] = Math.min(STAGES[params.page], Number(params.shown));
      settle(anim, params.page);
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.walk < 1) anim.walk = Math.min(1, anim.walk + dt / WALK_MS);
      if (anim.zoom.t < 1) { anim.zoom.t = Math.min(1, anim.zoom.t + dt / ZOOM_MS); if (anim.zoom.t >= 1) anim.zoom.from = anim.zoom.to; }
      const easing = anim.walk < 1 || anim.zoom.t < 1;
      /* core answers an ease request by replacing whatever loop is running, so
         the ease loop carries a press in flight to its end — and never starts one */
      if (anim.mode === "ease") {
        anim.halt = false;                           // the press it would stop is not this loop's
        if (anim.p < 1) {
          anim.p = Math.min(1, anim.p + dt / MS[anim.page][anim.n[anim.page] - 1]);
          if (anim.p >= 1) settle(anim, params.page);
        }
        return easing || anim.p < 1;
      }
      const page = params.page;
      if (anim.halt) { anim.halt = false; settle(anim, page); return false; }
      if (anim.p >= 1) {
        if ((anim.n[page] ?? 0) >= STAGES[page]) { settle(anim, page); return false; }
        anim.n[page] += 1; anim.p = 0; anim.page = page;
      }
      anim.p = Math.min(1, anim.p + dt / MS[page][anim.n[page] - 1]);
      if (anim.p >= 1) { settle(anim, page); return false; }
      return true;
    },
    /* A page switch mid-press finishes that press and stops the loop, so the
       other page's press is never taken unasked (91's halt). A window change
       after Align walks the bracket again; a tolerance change zooms the ruler.
       Any other display change leaves a press running. */
    rebuild: (anim, { params }) => {
      if (params.page !== anim.page && anim.p < 1) { anim.p = 1; anim.halt = true; }
      if (params.window !== anim.win) {
        anim.win = params.window;
        if (anim.n.alignment >= 1 && !(anim.page === "alignment" && anim.p < 1)) { anim.walk = 0; anim.easing = true; }
      }
      const z = anim.zoom;
      if (params.tolerance !== z.to) {
        z.from = z.t < 0.5 ? z.from : z.to;
        z.to = params.tolerance; z.t = 0; anim.easing = true;
      }
      anim.page = params.page;
      settle(anim, params.page);
    },
  },

  /* a row of the feature table selects that feature */
  regions: ({ w, params, state }) => {
    if (!state || params.page !== "identification") return [];
    const L = idLayout(w);
    return state.features[params.window].map((g, r) => ({ x: 8, y: L.table + 14 + r * 17, w: w - RIGHT - 4, h: 16, set: { feature: String(r + 1) }, label: `Feature ${r + 1}` }));
  },

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    renderFormula(params.page);
    if (params.page === "identification") drawIdentification(ctx, colors, w, params, state, anim, pointer);
    else if (params.page === "alignment") drawAlignment(ctx, colors, w, params, state, anim, pointer);
    else drawPeaks(ctx, colors, w, params, state, anim, pointer);
  },

  readout: ({ params, state, anim }) => {
    if (params.page === "alignment") {
      const { s, p } = stageOf("alignment", params, anim), done = s >= 1 && p >= 1;
      const fs = state.features[params.window], n = state.traces.reduce((a, t) => a + t.det.length, 0);
      const big = E.largest(fs);
      return [
        { label: "Peaks at m/z 131.035", value: `${n}`, note: "above S/N 3, in the six samples" },
        { label: "Features", value: done ? `${fs.length}` : "–", note: done ? `RT window ${params.window} min` : "once the peaks are grouped" },
        { label: "Largest feature", value: done ? `RT ${big.lo.toFixed(2)}–${big.hi.toFixed(2)}` : "–", note: done ? `${big.peaks.length} peaks in ${new Set(big.peaks.map((pk) => pk.j)).size} samples` : "once the peaks are grouped" },
      ];
    }
    if (params.page === "identification") {
      const { s, p } = stageOf("identification", params, anim);
      const stage = s >= 2 && p >= 1 ? 2 : s >= 1 && (s >= 2 || p >= 1) ? 1 : 0;
      const f = featureOf(params, state), tol = params.tolerance, { cands, byRt } = E.identify(f, tol);
      const nF = (tol === "unit" ? state.formulasUnit : state.formulasPpm).length;
      return [
        { label: "Formulas within the tolerance", value: stage >= 1 ? `${nF}` : "–", note: tol === "unit" ? "±0.5 Da: CHNOS, [M−H]⁻" : "±5 ppm: CHNOS, [M−H]⁻" },
        { label: "Candidates among the 26", value: stage >= 1 ? `${cands.length}` : "–", note: stage >= 1 ? cands.map((m) => m.name).join(", ") : "once matched by mass" },
        { label: "Identified", value: stage >= 2 ? (byRt.length === 1 ? byRt[0].name : "–") : "–", note: stage >= 2 ? (byRt.length === 1 ? `standard at RT ${byRt[0].rt}, feature at ${f.rt.toFixed(2)}` : `no standard within ±${E.RT_TOL} min of RT ${f.rt.toFixed(2)}`) : "once matched by RT" },
      ];
    }
    const { s, p } = stageOf("peaks", params, anim);
    const j = sampleIndex(params), tr = state.traces[j];
    const detected = s >= 2 || (s === 1 && p >= 1), integrated = s >= 2 && p >= 1;
    const nFile = E.METS.filter((m) => m.at[j] > 0).length, nMap = E.METS.filter((m) => m.at[j] > 0 && E.snOf(m.at[j]) >= 3).length;
    return [
      { label: "Peaks at m/z 131.035", value: detected ? `${tr.det.length}` : "–", note: detected ? tr.det.map((d) => `RT ${d.rt.toFixed(2)}, S/N ${d.sn.toFixed(1)}`).join(" · ") : "once detected" },
      { label: "Areas", value: integrated ? tr.det.map((d) => fmt(d.area)).join(" · ") : "–", note: integrated ? `the file records ${tr.det.map((d) => fmt(d.who.at[j])).join(" · ")}` : "once integrated" },
      { label: "Above S/N 3 in this sample", value: detected ? `${nMap} of 26` : "–", note: `the file records ${nFile} as non-zero: the study measured each metabolite against its own detection limit` },
    ];
  },
});
