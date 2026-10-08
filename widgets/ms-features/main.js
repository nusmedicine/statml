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
 *   2. Peaks: the sample's raw m/z × RT intensity over RT 0.8–5.6 min, and
 *      under it, on the same RT axis, the trace of one row (m/z 131.035 by
 *      default; a click on a spot, or Row, picks another); Detect rings each
 *      spot at S/N 3 or more and brackets each peak's height in noise SDs;
 *      Integrate fills the areas and moves each into its row of the table;
 *   3. Alignment: six samples' slices over one axis of every peak; Align moves
 *      a bracket one RT window wide from tick to tick, and a tick that lands
 *      inside joins the feature; a window change walks the bracket again;
 *   4. Identification: formulas within the Mass tolerance (a change zooms the
 *      ruler), the study's metabolites within it drawn as structures, every
 *      feature of the row on the RT axis against each standard, the level
 *      reached; Match mass, then Match RT;
 *   5. no metabolite is named before Identification (round 3, his call: page 1
 *      had named the two peaks, the answer the last page exists to reach);
 *   6. hover inspects everything named in the round 1 mock's § 4;
 *   7. one Row is followed through the three pages (round 4, his pick), and
 *      Identification opens on every feature of the run on the Peaks map's axes,
 *      with the table of every feature at its foot.
 * Round 1 (his picks, `_lab/ms-features-round1-mock.html`): all four the
 * recommendation. The press clock is 91's: only a page switch ends a press.
 */
import { defineWidget, mathmlRenders } from "../core/index.js";
import * as E from "./engine.js";
import { makeRng } from "../core/rng.js";

const H_PEAKS = 500, H_ALIGN = 416;
/* The Identification page's table holds every feature of the run, so its height
   is the feature count's; a height reads only the parameters, so the run is
   simulated once here as compute() does it (core seeds compute's rng with 1,
   this widget having no seed), and compute() checks that the counts agree. */
const COUNTS = (() => {
  const t = E.simulate(makeRng(1));
  return Object.fromEntries(E.WINDOWS.map((v) => [v, E.ROWS.reduce((n, _, r) => n + E.group(t.map((x) => x[r]), Number(v)).length, 0)]));
})();
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
/* the RT range a panel shows: the whole run on Peaks, the row's own stretch on Alignment */
const VIEW_RUN = [E.RT0, E.RT1];
function sliceGeom(P, top, view = VIEW_RUN) {
  return {
    sx: (t) => P.x0 + ((t - view[0]) / (view[1] - view[0])) * (P.x1 - P.x0),
    sy: (v) => P.y1 - (Math.min(v, top) / top) * (P.y1 - P.y0),
  };
}
/* `upTo` RT: peaks marked up to it (Detect); `fillTo` RT: areas shaded up to it (Integrate) */
function drawSlice(ctx, colors, tr, P, { upTo = -1, fillTo = -1, top, ticks = true, band = false, brackets = false, peakColour = null, ring = null, view = VIEW_RUN, label = null }) {
  const { sx, sy } = sliceGeom(P, top, view);
  const inView = (i) => tr.rt[i] >= view[0] - 1e-9 && tr.rt[i] <= view[1] + 1e-9;
  rule(ctx, P.x0, P.y1, P.x1, P.y1, colors.axis);
  if (ticks) for (let t = Math.ceil(view[0] * 2) / 2; t <= view[1] + 1e-9; t += 0.5) {
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
  const idx = tr.rt.map((_, i) => i).filter(inView);
  poly(ctx, idx.map((i) => sx(tr.rt[i])), idx.map((i) => sy(tr.y[i])), colors.ink2, 1);
  rule(ctx, P.x0, sy(E.THRESHOLD), P.x1, sy(E.THRESHOLD), colors.reference, 1.2, [5, 3]);
  for (const d of tr.det) {
    if (d.rt > upTo || !inView(d.i)) continue;
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
    if (label) label(d, x, Math.min(y, sy(E.THRESHOLD) - 26));
  }
  return { sx, sy };
}

/* ------------------------------------------------------------ the Peaks page */
/* Round 2 (his picks, `_lab/ms-features-round2-mock.html`): the map and the
   trace share one RT axis, so a moment is one x position on both and the hover
   is one line through both panels; the row is a line one m/z thin (the draft's
   10-m/z box enclosed malic and pyroglutamic acid, which the trace never shows);
   a click on a spot, or the Row control, makes that spot's row the trace. */
const peaksLayout = (w) => ({
  map: { x0: X0, x1: w - RIGHT, y0: 34, y1: 184 },
  trace: { x0: X0, x1: w - RIGHT, y0: 240, y1: 384 },
  table: { y: 440, xMz: 20, xRt: 92, xArea: 196 },
});
const sampleIndex = (params) => Math.max(0, E.SAMPLES.findIndex((s) => s.id === params.sample));
const rowIndex = (params) => Math.max(0, E.ROWS.findIndex((r) => r.key === params.row));
const mapGeom = (M) => ({
  mx: (t) => M.x0 + ((t - E.RT0) / (E.RT1 - E.RT0)) * (M.x1 - M.x0),
  my: (m) => M.y1 - ((m - E.GRID.mz0) / (E.GRID.mz1 - E.GRID.mz0)) * (M.y1 - M.y0),
});
/* every spot MTBLS6038 records in this sample, inside the run: its place, its S/N at the page's noise, its row */
function spotsOf(j, M) {
  const { mx, my } = mapGeom(M);
  return E.METS.filter((m) => m.at[j] > 0 && m.rt <= E.RT1).map((m) => ({
    m, x: mx(m.rt + E.SHIFT[j]), y: my(m.exact), rt: m.rt + E.SHIFT[j], sn: E.snOf(m.at[j]),
    key: E.ROWS.find((r) => r.mets.includes(m)).key,
  }));
}

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
  const L = peaksLayout(w), j = sampleIndex(params), r = rowIndex(params), row = E.ROWS[r];
  const tr = state.traces[j][r], s0 = E.SAMPLES[j];
  const { s, p } = stageOf("peaks", params, anim);
  // Detect sweeps the run's RT across the map and the trace together: one line through both
  const detT = s >= 2 || (s === 1 && p >= 1) ? Infinity : s === 1 ? E.RT0 + p * (E.RT1 - E.RT0) : -1;
  const { fillTo, moved } = integrateClock(s, p, tr.det.length);
  const integrated = s >= 2 && p >= 1;
  const M = L.map, P = L.trace, { mx, my } = mapGeom(M);

  txt(ctx, colors, `Sample ${s0.id} (${s0.cohort}): intensity at every m/z and RT`, 12, 18, { colour: colors.ink1, weight: "600" });
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(mapImage(colors, state.grids[j], j), M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0); ctx.restore();
  rule(ctx, M.x0, M.y1, M.x1, M.y1, colors.axis); rule(ctx, M.x0, M.y0, M.x0, M.y1, colors.axis);
  for (let t = 1; t <= E.RT1; t += 1) { rule(ctx, mx(t), M.y1, mx(t), M.y1 + 3, colors.axis); txt(ctx, colors, String(t), mx(t), M.y1 + 14, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  for (let m = 100; m <= 220; m += 40) { rule(ctx, M.x0 - 3, my(m), M.x0, my(m), colors.axis); txt(ctx, colors, String(m), M.x0 - 6, my(m) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "m/z", M.x0 - 6, M.y0 - 6, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, `${E.LATE.length} of the 26 elute after ${E.RT1} min`, M.x0, M.y1 + 28, { size: "fsXs", colour: colors.ink3 });
  /* each spot the sweep has passed is ringed if it stands at S/N 3 or more — the
     trace's rule, applied to every row (his call, 2026-10-08); after Integrate
     the ring is sized by its area. Every spot can be inspected and clicked. */
  const spots = spotsOf(j, M);
  let hoverSpot = null;
  for (const sp of spots) {
    if (!hoverSpot && near(pointer, sp.x, sp.y, 9)) hoverSpot = sp;
    if (sp.rt > detT || sp.sn < 3) continue;
    dot(ctx, sp.x, sp.y, integrated ? Math.max(3, 1.5 + 1.6 * (Math.log10(sp.m.at[j]) - 3)) : 6, null, colors.ink1, 1.4);
  }
  if (detT >= 0) txt(ctx, colors, `${spots.filter((sp) => sp.rt <= detT && sp.sn >= 3).length} above S/N 3`, M.x1 - 4, M.y0 + 12, { size: "fsXs", colour: colors.ink1, align: "right" });
  // the row: a line one m/z thin across the map
  rule(ctx, M.x0, my(row.mz), M.x1, my(row.mz), colors.ink1, 1.4);
  txt(ctx, colors, `m/z ${row.key}`, M.x1 - 4, my(row.mz) - 5, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });

  txt(ctx, colors, `The row at m/z ${row.key} ± 5 ppm: intensity against RT`, 12, P.y0 - 10, { colour: colors.ink1, weight: "600" });
  const g = drawSlice(ctx, colors, tr, P, {
    upTo: detT, fillTo, top: state.top[j][r], band: true, brackets: true,
    label: (d, x, y) => txt(ctx, colors, `RT ${d.rt.toFixed(2)}`, x + 10, y + 4, { size: "fsXs", colour: colors.ink1, weight: "600" }),
  });
  txt(ctx, colors, "S/N 3", P.x1 - 2, g.sy(E.THRESHOLD) - 5, { size: "fsXs", colour: colors.reference, align: "right" });
  txt(ctx, colors, "noise ±1 SD", P.x0 + 4, g.sy(E.BASE - E.NOISE) + 13, { size: "fsXs", colour: colors.reference });
  txt(ctx, colors, "retention time (min)", (P.x0 + P.x1) / 2, P.y1 + 30, { size: "fsXs", colour: colors.ink3, align: "center" });
  // the sweep: one line through both panels
  if (detT > E.RT0 && detT < E.RT1) rule(ctx, mx(detT), M.y0, mx(detT), P.y1, colors.ink1, 1.5);

  // the table: a row per peak; m/z and RT once detected, the area once it has arrived
  const T = L.table;
  txt(ctx, colors, "m/z", T.xMz, T.y, { size: "fsXs", colour: colors.ink3, mono: true });
  txt(ctx, colors, "RT", T.xRt, T.y, { size: "fsXs", colour: colors.ink3, mono: true });
  txt(ctx, colors, "area", T.xArea, T.y, { size: "fsXs", colour: colors.ink3, mono: true, align: "right" });
  if (!tr.det.length && detT === Infinity) txt(ctx, colors, "no peak at S/N 3 or more in this row", T.xMz, T.y + 18, { size: "fsXs", colour: colors.ink3 });
  tr.det.forEach((d, k) => {
    const ry = T.y + 18 + k * 16, seen = d.rt <= detT;
    txt(ctx, colors, seen ? row.key : "–", T.xMz, ry, { size: "fsXs", colour: seen ? colors.ink1 : colors.ink3, mono: true });
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

  // hover: one vertical line through both panels at the pointer's RT; a spot, or the trace, inspected
  const overMap = pointer && pointer.x >= M.x0 && pointer.x <= M.x1 && pointer.y >= M.y0 && pointer.y <= M.y1;
  const overTrace = pointer && pointer.x >= P.x0 && pointer.x <= P.x1 && pointer.y >= P.y0 - 4 && pointer.y <= P.y1;
  if (overMap || overTrace) {
    const t = E.RT0 + ((pointer.x - P.x0) / (P.x1 - P.x0)) * (E.RT1 - E.RT0);
    const i = Math.max(0, Math.min(tr.y.length - 1, Math.round((t - E.RT0) / E.DT)));
    const x = hoverSpot ? hoverSpot.x : g.sx(tr.rt[i]);
    rule(ctx, x, M.y0, x, P.y1, colors.ink3, 1);
    dot(ctx, x, my(row.mz), 3, colors.ink1);
    if (hoverSpot) {
      dot(ctx, hoverSpot.x, hoverSpot.y, 9, null, colors.ink1, 2);
      const here = hoverSpot.key === row.key;
      tip(ctx, colors, w, hoverSpot.x, hoverSpot.y, [
        `m/z ${hoverSpot.key} · RT ${hoverSpot.rt.toFixed(2)} min`,
        `S/N ${hoverSpot.sn.toFixed(1)}: ${hoverSpot.sn >= 3 ? "above" : "below"} the line of 3`,
        `MTBLS6038 records an area of ${fmt(hoverSpot.m.at[j])}`,
        here ? "its row is the trace below" : "a click makes its row the trace below",
      ]);
    } else {
      dot(ctx, g.sx(tr.rt[i]), g.sy(tr.y[i]), 3, colors.ink1);
      if (overTrace) tip(ctx, colors, w, g.sx(tr.rt[i]), g.sy(tr.y[i]), [`RT ${tr.rt[i].toFixed(2)} min`, `intensity ${fmt(tr.y[i])}`, `${((tr.y[i] - E.BASE) / E.NOISE).toFixed(1)} noise SDs over the baseline`]);
    }
  }
}

/* ------------------------------------------------------------ the Alignment page */
/* Round 4 (his pick): the row chosen on Peaks is followed here and on
   Identification; 131.035, the isomer pair, by default. */
/* a feature is its m/z and its RT: the mean RT of its peaks, after grouping */
const featurePair = (f, row) => `m/z ${row.key} · RT ${f.rt.toFixed(2)}`;
const alignLayout = (w) => ({ x0: XA, x1: w - RIGHT, y0: 40, row: 44, axis: 40 + 44 * 6 + 40 });
/* the RT range the page shows for a row: its peaks in every sample, half a minute
   either side, at least 2.5 min wide, inside the run */
function viewOf(state, r) {
  const rts = state.traces.flatMap((rows) => rows[r].det.map((d) => d.rt));
  if (!rts.length) return [E.RT0, E.RT1];
  let lo = Math.min(...rts) - 0.5, hi = Math.max(...rts) + 0.5;
  if (hi - lo < 2.5) { const c = (lo + hi) / 2; lo = c - 1.25; hi = c + 1.25; }
  if (lo < E.RT0) { hi += E.RT0 - lo; lo = E.RT0; }
  if (hi > E.RT1) { lo -= hi - E.RT1; hi = E.RT1; }
  return [Math.max(E.RT0, lo), hi];
}
/* how far the bracket has walked: the press, or the walk again after a window change */
function walkT(params, anim, view) {
  const { s, p } = stageOf("alignment", params, anim);
  if (s < 1) return -1;
  if (p < 1) return view[0] + p * (view[1] - view[0]);
  if (anim && anim.walk < 1) return view[0] + anim.walk * (view[1] - view[0]);
  return Infinity;
}
function drawAlignment(ctx, colors, w, params, state, anim, pointer) {
  const L = alignLayout(w), win = Number(params.window), r = rowIndex(params), row = E.ROWS[r];
  const fs = state.features[params.window][r], tRow = state.traces.map((rows) => rows[r]), topRow = state.top.map((rows) => rows[r]);
  const view = viewOf(state, r), T = walkT(params, anim, view);
  const sx = (t) => L.x0 + ((t - view[0]) / (view[1] - view[0])) * (L.x1 - L.x0);
  const ay = L.axis;
  const peaks = tRow.flatMap((t) => t.det);
  txt(ctx, colors, `The row at m/z ${row.key} in six samples, each trace on its own scale`, 12, 18, { colour: colors.ink1, weight: "600" });

  // hover: a peak first, else a feature band
  let hoverPeak = null, hoverFeature = null;
  if (pointer) {
    tRow.forEach((tr, j) => {
      const P = { x0: L.x0, x1: L.x1, y0: L.y0 + j * L.row + 3, y1: L.y0 + (j + 1) * L.row - 3 }, g = sliceGeom(P, topRow[j], view);
      tr.det.forEach((d) => { if (!hoverPeak && near(pointer, g.sx(d.rt), g.sy(d.h + E.BASE), 8)) hoverPeak = d; });
      tr.det.forEach((d) => { if (!hoverPeak && near(pointer, sx(d.rt), ay, 6)) hoverPeak = d; });
    });
    if (!hoverPeak && T === Infinity && pointer.y >= L.y0 - 4 && pointer.y <= ay + 12) hoverFeature = fs.find((f) => pointer.x >= sx(f.lo) - 6 && pointer.x <= sx(f.hi) + 6) ?? null;
  }

  /* A band is labelled by what a feature IS, its m/z and its RT (his call,
     2026-10-08: two molecules share the m/z, the RT separates them, and a name
     comes only on the next page). When the pairs cannot all sit side by side
     without touching — five features at 0.05 min — every band takes its
     number instead, and a line under the axis gives each number's pair. */
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  const centre = (f) => (sx(f.lo) + sx(f.hi)) / 2, half = (f) => ctx.measureText(featurePair(f, row)).width / 2;
  const pairsFit = fs.every((f, k) => centre(f) - half(f) >= 4 && centre(f) + half(f) <= w - 4 && (k === 0 || centre(f) - half(f) > centre(fs[k - 1]) + half(fs[k - 1]) + 8));
  const colourOf = new Map(), shown = [];
  fs.forEach((f) => {
    if (T < f.lo) return;
    const hi = Math.min(f.hi, T), c = colors.clusters[f.k % colors.clusters.length];
    box(ctx, sx(f.lo) - 6, L.y0 - 4, sx(hi) - sx(f.lo) + 12, ay + 12 - (L.y0 - 4), c, hoverFeature === f ? 0.34 : 0.18);
    txt(ctx, colors, pairsFit ? featurePair(f, row) : `${f.k + 1}`, centre(f), L.y0 - 10, { size: "fsXs", colour: c, weight: "600", align: "center" });
    shown.push(f);
    f.peaks.forEach((pk) => { if (pk.rt <= T) colourOf.set(pk, c); });
  });
  if (!pairsFit && shown.length) txt(ctx, colors, `m/z ${row.key} · ${shown.map((f) => `${f.k + 1}: RT ${f.rt.toFixed(2)}`).join(" · ")}`, L.x0, ay + 60, { size: "fsXs", colour: colors.ink2 });
  E.SAMPLES.forEach((s0, j) => {
    const P = { x0: L.x0, x1: L.x1, y0: L.y0 + j * L.row + 3, y1: L.y0 + (j + 1) * L.row - 3 };
    drawSlice(ctx, colors, tRow[j], P, { upTo: Infinity, top: topRow[j], ticks: false, view, peakColour: (d) => colourOf.get(d) ?? colors.ink1, ring: hoverPeak });
    if (hoverFeature) {
      const g = sliceGeom(P, topRow[j], view);
      hoverFeature.peaks.filter((pk) => pk.j === j).forEach((pk) => dot(ctx, g.sx(pk.rt), g.sy(pk.h + E.BASE), 7, null, colors.ink1, 1.6));
    }
    txt(ctx, colors, s0.id.slice(-3), L.x0 - 8, P.y1 - 12, { size: "fsXs", colour: colors.ink1, align: "right", mono: true });
    txt(ctx, colors, groupWord(s0.cohort), L.x0 - 8, P.y1 + 1, { size: "fsXs", colour: colors.ink3, align: "right" });
  });
  if (!peaks.length) txt(ctx, colors, "no peak at S/N 3 or more in this row, in any of the six samples", (L.x0 + L.x1) / 2, L.y0 + 3 * L.row, { colour: colors.ink2, align: "center" });

  // every peak on one RT axis, and the bracket one window wide
  txt(ctx, colors, "every peak", L.x0 - 8, ay + 4, { size: "fsXs", colour: colors.ink2, align: "right" });
  rule(ctx, L.x0, ay, L.x1, ay, colors.axis);
  peaks.forEach((pk) => rule(ctx, sx(pk.rt), ay - 9, sx(pk.rt), ay + 9, colourOf.get(pk) ?? colors.ink1, hoverPeak === pk ? 3.5 : 2));
  for (let t = Math.ceil(view[0]); t <= view[1]; t += 1) txt(ctx, colors, String(t), sx(t), ay + 24, { size: "fsXs", colour: colors.ink3, align: "center" });
  txt(ctx, colors, "retention time (min)", (L.x0 + L.x1) / 2, ay + 42, { size: "fsXs", colour: colors.ink3, align: "center" });
  if (T >= view[0] && T < Infinity) {
    /* the bracket starts at the latest tick passed and reaches one window to the
       right: the next tick joins that feature if it lands inside */
    const last = peaks.map((pk) => pk.rt).filter((x) => x <= T).sort((a, b) => b - a)[0];
    if (last != null) {
      const bx = sx(last), bw = sx(view[0] + win) - sx(view[0]);
      rule(ctx, bx, ay - 16, bx + bw, ay - 16, colors.ink1, 2);
      rule(ctx, bx, ay - 20, bx, ay - 12, colors.ink1, 2);
      rule(ctx, bx + bw, ay - 20, bx + bw, ay - 12, colors.ink1, 2);
      txt(ctx, colors, `${params.window} min`, bx + bw / 2, ay - 23, { size: "fsXs", colour: colors.ink1, weight: "600", align: "center" });
    }
  }

  if (hoverPeak) {
    const s0 = E.SAMPLES[hoverPeak.j], f = fs.find((g) => g.peaks.includes(hoverPeak));
    tip(ctx, colors, w, pointer.x, pointer.y, [`${s0.id} · ${s0.cohort}`, `RT ${hoverPeak.rt.toFixed(2)} min · area ${fmt(hoverPeak.area)}`, f && T === Infinity ? `in the feature ${featurePair(f, row)}` : "not yet grouped"]);
  } else if (hoverFeature) {
    const n = new Set(hoverFeature.peaks.map((pk) => pk.j)).size;
    tip(ctx, colors, w, pointer.x, pointer.y, [featurePair(hoverFeature, row), `its peaks from RT ${hoverFeature.lo.toFixed(2)} to ${hoverFeature.hi.toFixed(2)} min`, `${hoverFeature.peaks.length} peaks in ${n} sample${n === 1 ? "" : "s"}`]);
  }
}

/* ------------------------------------------------------------ the Identification page */
/* Round 4 (his picks, `_lab/ms-features-round4-mock.html`): on top, every
   feature of the run on the Peaks map's axes, so the page the student started
   on is where the names arrive; Match mass marks each feature's candidates
   among the 26, Match RT names each that sits on its standard's RT. Under it,
   the funnel for the row followed through the pages (a click on a feature
   picks it), and at the foot the table of every feature. */
const B = 236;                                       // where the funnel starts, under the overview
const idLayout = (w) => ({ x0: 24, x1: w - RIGHT - LEVEL_W, lx: w - RIGHT, title: B, ruler: B + 66, cards: B + 144, rt: B + 348, table: B + 424 });
const ovLayout = (w) => ({ x0: X0, x1: w - RIGHT, y0: 34, y1: 174 });
const HALF = { unit: 0.6, ppm: 0.012 };              // the ruler's half-width in Da at each tolerance
const TABLE_ROW = 15;
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
const SKELETONS = new Set(["Glutaric acid", "Ethylmalonic acid"]);

/* what a feature has been matched to, as far as the presses have gone */
function nameOf(x, stage, tol) {
  if (stage < 1) return { name: "–", by: "–", n: null };
  const { cands, byRt } = E.identify(x.f, tol, E.measuredMz(x.row.mz));
  if (stage >= 2 && byRt.length === 1) return { name: byRt[0].name, by: "m/z, RT", hit: true, n: cands.length };
  return { name: cands.length ? cands.map((m) => short(m.name)).join(" or ") : "none of the 26", by: "m/z", n: cands.length };
}
const rtList = (fs) => fs.map((f) => f.rt.toFixed(2)).join(", ");

/* the overview: every feature of the run at its m/z and RT */
function drawOverview(ctx, colors, w, params, state, stage, rowNow, pointer) {
  const M = ovLayout(w), { mx, my } = mapGeom(M), tol = params.tolerance;
  const all = state.featuresAll[params.window];
  txt(ctx, colors, `Every feature of the run (RT window ${params.window} min): its m/z and RT`, 12, 18, { colour: colors.ink1, weight: "600" });
  box(ctx, M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0, colors.surface2);
  rule(ctx, M.x0, M.y1, M.x1, M.y1, colors.axis); rule(ctx, M.x0, M.y0, M.x0, M.y1, colors.axis);
  for (let t = 1; t <= E.RT1; t += 1) txt(ctx, colors, String(t), mx(t), M.y1 + 14, { size: "fsXs", colour: colors.ink3, align: "center" });
  for (let m = 100; m <= 220; m += 40) txt(ctx, colors, String(m), M.x0 - 6, my(m) + 4, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "m/z", M.x0 - 6, M.y0 - 6, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "RT (min)", M.x1, M.y1 + 28, { size: "fsXs", colour: colors.ink3, align: "right" });
  rule(ctx, M.x0, my(rowNow.mz), M.x1, my(rowNow.mz), colors.ink1, 1.3);
  txt(ctx, colors, `m/z ${rowNow.key}: the row below`, M.x1 - 4, my(rowNow.mz) - 5, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });
  let hover = null, named = 0, multi = 0;
  for (const x of all) {
    const px = mx(x.f.rt), py = my(x.row.mz), nm = nameOf(x, stage, tol), here = x.row === rowNow;
    if (stage === 0) dot(ctx, px, py, 4.5, colors.empirical);
    else if (stage === 1) {
      if (nm.n > 1) { multi++; dot(ctx, px, py, 6, null, colors.ink1, 1.6); txt(ctx, colors, String(nm.n), px + 8, py + 4, { size: "fsXs", colour: colors.ink1, weight: "700" }); }
      else dot(ctx, px, py, 4.5, colors.ink1);
    } else if (nm.hit) {
      named++; dot(ctx, px, py, 5, colors.highlight);
      if (here) txt(ctx, colors, short(nm.name), px, py - 9, { size: "fsXs", colour: colors.highlight, weight: "600", align: "center" });
    } else { dot(ctx, px, py, 6, null, colors.ink1, 1.6); txt(ctx, colors, "?", px, py - 10, { size: "fsXs", colour: colors.ink1, weight: "700", align: "center" }); }
    if (!hover && near(pointer, px, py, 8)) hover = { x, px, py, nm };
  }
  const head = stage === 0 ? `${all.length} features` : stage === 1 ? `${multi} with more than one candidate · ${all.length - multi} with one` : `${named} of ${all.length} named`;
  txt(ctx, colors, head, M.x1 - 4, M.y0 + 14, { colour: colors.ink1, weight: "700", align: "right" });
  txt(ctx, colors, "candidates from the study's 26 metabolites; a database of every known metabolite holds more per formula", 12, M.y1 + 46, { size: "fsXs", colour: colors.ink3 });
  return hover;
}

function drawIdentification(ctx, colors, w, params, state, anim, pointer) {
  const L = idLayout(w), tol = params.tolerance, r = rowIndex(params), row = E.ROWS[r];
  const mz = E.measuredMz(row.mz), forms = state.formulas[r];
  const fs = state.features[params.window][r];
  const { s, p } = stageOf("identification", params, anim);
  const massP = s >= 2 || (s === 1 && p >= 1) ? 1 : s === 1 ? p : 0;
  const rtP = s >= 2 ? p : 0;
  const stage = massP >= 1 ? (rtP >= 1 ? 2 : 1) : 0;
  const level = (y, n, sub, on) => {
    txt(ctx, colors, n, L.lx, y, { colour: on ? colors.ink1 : colors.ink3, weight: "700", align: "right" });
    txt(ctx, colors, sub, L.lx, y + 14, { size: "fsXs", colour: colors.ink3, align: "right" });
  };
  const hoverOv = drawOverview(ctx, colors, w, params, state, stage, row, pointer);
  txt(ctx, colors, fs.length ? `The features at m/z ${row.key} (RT window ${params.window} min): RT ${rtList(fs)}` : `m/z ${row.key}: no feature in this row`, 12, L.title, { colour: colors.ink1, weight: "600" });

  // 1 · formulas within the tolerance: a ruler of every CHNOS formula's [M−H]⁻, zoomed by a tolerance change
  const z = anim && anim.zoom.t < 1 ? { from: anim.zoom.from, e: easeInOut(anim.zoom.t) } : null;
  const lerpLog = (a, b, e) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * e);
  const half = z ? lerpLog(HALF[z.from], HALF[tol], z.e) : HALF[tol];
  const winD = z ? lerpLog(E.tolDa(z.from, mz), E.tolDa(tol, mz), z.e) : E.tolDa(tol, mz);
  const lo = mz - half, hi = mz + half;
  const rx = (m) => L.x0 + ((m - lo) / (hi - lo)) * (L.x1 - L.x0), ry = L.ruler;
  txt(ctx, colors, `1 · Mass: CHNOS formulas within ${tol === "unit" ? "±0.5 Da" : "±5 ppm"} of the measured m/z`, 12, L.title + 28, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ry + 10, L.x1, ry + 10, colors.axis);
  [lo, hi].forEach((m) => txt(ctx, colors, m.toFixed(half > 0.1 ? 2 : 3), rx(m), ry + 24, { size: "fsXs", colour: colors.ink3, align: "center", mono: true }));
  txt(ctx, colors, `measured ${mz.toFixed(4)}`, rx(mz), ry + 24, { size: "fsXs", colour: colors.empirical, align: "center", mono: true, weight: "600" });
  const shownHalf = winD * easeInOut(massP);
  if (massP > 0) box(ctx, rx(mz - shownHalf), ry - 16, Math.max(2, rx(mz + shownHalf) - rx(mz - shownHalf)), 26, colors.highlight, 0.18);
  let hoverTick = null;
  for (const fm of forms.wide) {
    const x = rx(fm.mz);
    if (x < L.x0 || x > L.x1) continue;
    const inside = massP > 0 && Math.abs(fm.mz - mz) <= shownHalf;
    rule(ctx, x, ry - 12, x, ry + 10, inside ? colors.ink1 : colors.ink3, 1.2);
    if (pointer && Math.abs(pointer.x - x) <= 3 && Math.abs(pointer.y - ry) <= 16) hoverTick = { fm, x };
  }
  rule(ctx, rx(mz), ry - 18, rx(mz), ry + 14, colors.empirical, 2);
  if (massP >= 1 && !z) {
    const nIn = forms[tol].length;
    txt(ctx, colors, nIn === 1 ? `1 formula: ${forms[tol][0].f}` : `${nIn} formulas`, L.x1, L.title + 28, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });
    level(L.title + 48, nIn === 1 ? "level 4" : "level 5", nIn === 1 ? "molecular formula" : "exact mass", true);
  }

  // 2 · of the study's 26 metabolites, those within the tolerance
  const cands = E.candidates(mz, tol);
  const named = (m) => rtP >= 1 && fs.some((f) => Math.abs(f.rt - m.rt) <= E.RT_TOL);
  txt(ctx, colors, "2 · Of the study's 26 metabolites, those within the tolerance", 12, L.cards - 12, { colour: colors.ink1, weight: "600" });
  if (massP >= 1) {
    const cw = Math.min(220, (L.x1 - L.x0 - 12) / Math.max(2, cands.length));
    cands.forEach((m, k) => {
      const bx = L.x0 + k * (cw + 12), on = named(m);
      box(ctx, bx, L.cards, cw, 110, colors.surface2);
      if (on) frame(ctx, bx, L.cards, cw, 110, colors.highlight, 2);
      txt(ctx, colors, m.name, bx + 8, L.cards + 17, { colour: on ? colors.highlight : colors.ink1, weight: "600" });
      txt(ctx, colors, `${m.formula} · ${E.ppmOf(mz, m.exact).toFixed(1)} ppm`, bx + 8, L.cards + 32, { size: "fsXs", colour: colors.ink2, mono: true });
      if (SKELETONS.has(m.name)) skeleton(ctx, colors, bx + cw / 2 - 2 * 17.3, L.cards + 66, m.name);
      else txt(ctx, colors, `standard's RT ${m.rt} min`, bx + 8, L.cards + 52, { size: "fsXs", colour: colors.ink2 });
    });
    if (!cands.length) txt(ctx, colors, "none of the 26 lies within the tolerance", L.x0, L.cards + 20, { colour: colors.ink2 });
    level(L.cards + 16, "level 3", `${cands.length} candidate${cands.length === 1 ? "" : "s"}`, true);
  }

  // 3 · every feature's RT against each candidate's standard
  const rts = [...fs.map((f) => f.rt), ...cands.map((m) => m.rt)];
  let T0 = rts.length ? Math.min(...rts) - 0.5 : 1.5, T1 = rts.length ? Math.max(...rts) + 0.5 : 4;
  if (T1 - T0 < 2.5) { const c = (T0 + T1) / 2; T0 = c - 1.25; T1 = c + 1.25; }
  const tx = (t) => L.x0 + ((t - T0) / (T1 - T0)) * (L.x1 - L.x0), ty = L.rt;
  txt(ctx, colors, `3 · Retention time: every feature against each standard (±${E.RT_TOL} min)`, 12, ty - 70, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ty, L.x1, ty, colors.axis);
  for (let t = Math.ceil(T0 * 2) / 2; t <= T1 + 1e-9; t += 0.5) txt(ctx, colors, t.toFixed(1), tx(t), ty + 14, { size: "fsXs", colour: colors.ink3, align: "center" });
  let hoverStd = null, hoverDot = null;
  const rowOver = pointer ? state.featuresAll[params.window].find((x, k) => { const y = L.table + 26 + k * TABLE_ROW; return pointer.y >= y - 11 && pointer.y < y + 4 && pointer.x >= 8; }) : null;
  if (rtP > 0) {
    cands.forEach((m) => {
      const hit = named(m);
      box(ctx, tx(m.rt - E.RT_TOL), ty - 30, tx(m.rt + E.RT_TOL) - tx(m.rt - E.RT_TOL), 30, hit ? colors.highlight : colors.reference, 0.18);
      rule(ctx, tx(m.rt), ty - 32, tx(m.rt), ty, colors.reference, 2);
      txt(ctx, colors, `${short(m.name)} standard ${m.rt}`, tx(m.rt), ty - 38, { size: "fsXs", colour: hit ? colors.highlight : colors.ink2, align: "center", weight: hit ? "600" : "" });
      if (pointer && Math.abs(pointer.x - tx(m.rt)) <= 8 && pointer.y >= ty - 46 && pointer.y <= ty - 28) hoverStd = m;
    });
    // every feature drops onto its RT, each in its own vertical lane
    const y = ty - 62 + 50 * easeInOut(clamp01(rtP));
    fs.forEach((f, k) => {
      const fx = tx(f.rt);
      dot(ctx, fx, y, 5, colors.empirical);
      if (rowOver && rowOver.f === f) dot(ctx, fx, y, 9, null, colors.ink1, 2);
      if (rtP >= 1) txt(ctx, colors, f.rt.toFixed(2), fx, ty + 28 + (k % 2) * 13, { size: "fsXs", colour: colors.empirical, align: "center", weight: "600" });
      if (near(pointer, fx, y, 8)) hoverDot = { f, fx, y };
    });
    if (rtP >= 1) {
      const nNamed = fs.filter((f) => E.identify(f, tol, mz).byRt.length === 1).length;
      level(ty - 66, nNamed ? "level 1" : "level 3", nNamed ? `${nNamed} of ${fs.length} named` : "no feature within ±0.1", nNamed > 0);
      txt(ctx, colors, nNamed ? "with the standard's MS2" : "of a standard", L.lx, ty - 38, { size: "fsXs", colour: colors.ink3, align: "right" });
    }
  }

  // the feature table: every feature of the run, the row followed shaded, names as far as the presses have gone
  const all = state.featuresAll[params.window];
  txt(ctx, colors, `The feature table: every feature of the run (RT window ${params.window} min)`, 12, L.table - 10, { colour: colors.ink1, weight: "600" });
  const cols = [16, 82, 128, 214, 300, w - RIGHT - 120, w - RIGHT];
  ["m/z", "RT", "formulas", "candidates", "name", "matched by", "samples"].forEach((c, k) => txt(ctx, colors, c, cols[k], L.table + 8, { size: "fsXs", colour: colors.ink3, mono: true, align: k === 6 ? "right" : "left" }));
  all.forEach((x, k) => {
    const y = L.table + 26 + k * TABLE_ROW, nm = nameOf(x, stage, tol), here = x.row === row;
    if (here || rowOver === x) box(ctx, 8, y - 11, w - RIGHT - 4, TABLE_ROW, colors.surface2, rowOver === x ? 1 : 0.6);
    const cells = [x.row.key, x.f.rt.toFixed(2), stage >= 1 ? String(state.formulas[x.r][tol].length) : "–", stage >= 1 ? String(nm.n) : "–", nm.hit ? short(nm.name) : nm.name, nm.by, `${new Set(x.f.peaks.map((pk) => pk.j)).size} of 6`];
    cells.forEach((c, j) => txt(ctx, colors, c, cols[j], y, { size: "fsXs", mono: j !== 4, align: j === 6 ? "right" : "left", colour: j === 4 && nm.hit ? colors.highlight : colors.ink1, weight: here && j === 4 ? "600" : "" }));
  });

  if (hoverOv) {
    dot(ctx, hoverOv.px, hoverOv.py, 9, null, colors.ink1, 2);
    const nm = hoverOv.nm, lines = [`m/z ${hoverOv.x.row.key} · RT ${hoverOv.x.f.rt.toFixed(2)}`];
    if (stage >= 1) lines.push(`${nm.n} of the 26 within ${tol === "unit" ? "±0.5 Da" : "±5 ppm"}`);
    if (stage >= 2) lines.push(nm.hit ? `named ${nm.name.toLowerCase()}: its standard's RT` : "within ±0.1 min of no standard");
    lines.push(hoverOv.x.row === row ? "its row is the one below" : "a click makes its row the one below");
    tip(ctx, colors, w, hoverOv.px, hoverOv.py, lines);
  } else if (hoverTick) {
    rule(ctx, hoverTick.x, ry - 14, hoverTick.x, ry + 12, colors.ink1, 3);
    tip(ctx, colors, w, hoverTick.x, ry - 14, [hoverTick.fm.f, `m/z ${hoverTick.fm.mz.toFixed(4)}`, `${E.ppmOf(hoverTick.fm.mz, mz).toFixed(0)} ppm from the measured m/z`]);
  } else if (hoverDot) {
    const { byRt } = E.identify(hoverDot.f, tol, mz);
    tip(ctx, colors, w, hoverDot.fx, hoverDot.y, [`m/z ${row.key} · RT ${hoverDot.f.rt.toFixed(2)}`, byRt.length === 1 ? `within ±${E.RT_TOL} min of the ${short(byRt[0].name).toLowerCase()} standard (${byRt[0].rt})` : `within ±${E.RT_TOL} min of no standard`]);
  } else if (hoverStd) {
    tip(ctx, colors, w, tx(hoverStd.rt), ty - 46, [`${hoverStd.name}, the standard`, `RT ${hoverStd.rt} min, run on the same column`]);
  }
}

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
  height: (p) => (p.page === "identification" ? B + 424 + 26 + (COUNTS[p.window] ?? 11) * TABLE_ROW + 10 : p.page === "alignment" ? H_ALIGN : H_PEAKS),

  params: {
    page: {
      role: "page", type: "segmented", label: "Step", display: true, default: "peaks",
      options: [{ value: "peaks", label: "Peaks" }, { value: "alignment", label: "Alignment" }, { value: "identification", label: "Identification" }],
    },
    rowSec: { type: "section", label: "The row" },
    row: {
      type: "select", label: "Row", display: true, default: E.ROWS[E.ROW_131].key,
      detail: "the m/z followed through the three steps, with the RT of each metabolite MTBLS6038 reports at it; a click on a spot (Peaks) or a feature (Identification) selects its row",
      options: E.ROWS.map((r) => ({ value: r.key, label: `${r.key} · RT ${r.mets.map((m) => m.rt.toFixed(2)).join(", ")}` })),
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
    const traces = E.simulate(rng);                  // [sample][row]
    const grids = E.SAMPLES.map((_, j) => E.rawGrid(rng, j));
    const top = traces.map((rows) => rows.map((t) => Math.max(...t.y, E.THRESHOLD + 4 * E.NOISE) * 1.08));
    const features = Object.fromEntries(E.WINDOWS.map((v) => [v, E.ROWS.map((_, r) => E.group(traces.map((rows) => rows[r]), Number(v)))]));
    const featuresAll = Object.fromEntries(E.WINDOWS.map((v) => [v, features[v].flatMap((fs, r) => fs.map((f) => ({ r, row: E.ROWS[r], f }))).sort((a, b) => a.row.mz - b.row.mz || a.f.rt - b.f.rt)]));
    for (const v of E.WINDOWS) if (featuresAll[v].length !== COUNTS[v]) console.error(`ms-features: ${featuresAll[v].length} features at ${v} min, the height expects ${COUNTS[v]}`);
    const formulas = E.ROWS.map((row) => { const mz = E.measuredMz(row.mz); return { wide: E.formulas(mz, 0.6), unit: E.formulas(mz, 0.5), ppm: E.formulas(mz, E.tolDa("ppm", mz)) }; });
    return { traces, grids, top, features, featuresAll, formulas };
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
      identification1: "Compare each feature's retention time with each candidate's standard",
      identificationdone: "Every feature has been matched by mass and by retention time",
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

  /* a spot on the map (Peaks) or a feature on the overview (Identification) selects its row */
  regions: ({ w, params, state }) => {
    if (!state) return [];
    if (params.page === "peaks") return spotsOf(sampleIndex(params), peaksLayout(w).map).map((sp) => ({ x: sp.x - 8, y: sp.y - 8, w: 16, h: 16, set: { row: sp.key }, label: `m/z ${sp.key}, RT ${sp.rt.toFixed(2)}` }));
    if (params.page === "identification") {
      const { mx, my } = mapGeom(ovLayout(w));
      return state.featuresAll[params.window].map((x) => ({ x: mx(x.f.rt) - 8, y: my(x.row.mz) - 8, w: 16, h: 16, set: { row: x.row.key }, label: `m/z ${x.row.key}, RT ${x.f.rt.toFixed(2)}` }));
    }
    return [];
  },

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    renderFormula(params.page);
    if (params.page === "identification") drawIdentification(ctx, colors, w, params, state, anim, pointer);
    else if (params.page === "alignment") drawAlignment(ctx, colors, w, params, state, anim, pointer);
    else drawPeaks(ctx, colors, w, params, state, anim, pointer);
  },

  readout: ({ params, state, anim }) => {
    const rr = rowIndex(params), rowR = E.ROWS[rr];
    if (params.page === "alignment") {
      const { s, p } = stageOf("alignment", params, anim), done = s >= 1 && p >= 1;
      const fs = state.features[params.window][rr], n = state.traces.reduce((a, rows) => a + rows[rr].det.length, 0);
      const nSamples = (f) => new Set(f.peaks.map((pk) => pk.j)).size;
      return [
        { label: `Peaks at m/z ${rowR.key}`, value: `${n}`, note: "above S/N 3, in the six samples" },
        { label: "Features", value: done ? `${fs.length}` : "–", note: done ? `RT window ${params.window} min` : "once the peaks are grouped" },
        { label: "Feature RTs", value: done && fs.length ? fs.map((f) => f.rt.toFixed(2)).join(" · ") : "–", note: done ? (fs.length ? `m/z ${rowR.key}, found in ${fs.map((f) => nSamples(f)).join(" · ")} of the six samples` : "no peak to group in this row") : "once the peaks are grouped" },
      ];
    }
    if (params.page === "identification") {
      const { s, p } = stageOf("identification", params, anim);
      const stage = s >= 2 && p >= 1 ? 2 : s >= 1 && (s >= 2 || p >= 1) ? 1 : 0;
      const tol = params.tolerance, mz = E.measuredMz(rowR.mz), cands = E.candidates(mz, tol);
      const nF = state.formulas[rr][tol].length, all = state.featuresAll[params.window];
      const named = all.filter((x) => E.identify(x.f, tol, E.measuredMz(x.row.mz)).byRt.length === 1).length;
      const mine = state.features[params.window][rr].map((f) => ({ f, hit: E.identify(f, tol, mz).byRt }));
      return [
        { label: `Formulas at m/z ${rowR.key}`, value: stage >= 1 ? `${nF}` : "–", note: tol === "unit" ? "±0.5 Da: CHNOS, [M−H]⁻" : "±5 ppm: CHNOS, [M−H]⁻" },
        { label: "Candidates among the 26", value: stage >= 1 ? `${cands.length}` : "–", note: stage >= 1 ? (cands.map((m) => m.name).join(", ") || "none") : "once matched by mass" },
        { label: "Features named in the run", value: stage >= 2 ? `${named} of ${all.length}` : "–", note: stage >= 2 ? (mine.map((x) => `RT ${x.f.rt.toFixed(2)}: ${x.hit.length === 1 ? x.hit[0].name.toLowerCase() : "no standard"}`).join(" · ") || `no feature at m/z ${rowR.key}`) : "once matched by RT" },
      ];
    }
    const { s, p } = stageOf("peaks", params, anim);
    const j = sampleIndex(params), r = rowIndex(params), tr = state.traces[j][r];
    const detected = s >= 2 || (s === 1 && p >= 1), integrated = s >= 2 && p >= 1;
    const inRun = E.METS.filter((m) => m.rt <= E.RT1), nFile = inRun.filter((m) => m.at[j] > 0).length, nMap = inRun.filter((m) => m.at[j] > 0 && E.snOf(m.at[j]) >= 3).length;
    return [
      { label: `Peaks at m/z ${E.ROWS[r].key}`, value: detected ? `${tr.det.length}` : "–", note: detected ? (tr.det.length ? tr.det.map((d) => `RT ${d.rt.toFixed(2)}, S/N ${d.sn.toFixed(1)}`).join(" · ") : "none at S/N 3 or more") : "once detected" },
      { label: "Areas", value: integrated && tr.det.length ? tr.det.map((d) => fmt(d.area)).join(" · ") : "–", note: integrated ? (tr.det.length ? `MTBLS6038 records ${tr.det.map((d) => fmt(d.who.at[j])).join(" · ")}` : "no peak to integrate in this row") : "once integrated" },
      { label: "Above S/N 3 in this sample", value: detected ? `${nMap} of ${inRun.length}` : "–", note: `of the metabolites eluting by ${E.RT1} min; MTBLS6038 records ${nFile} as non-zero, each measured against its own detection limit` },
    ];
  },
});
