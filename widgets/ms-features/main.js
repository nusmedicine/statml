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
 *   2. Peaks: the sample's m/z × RT map (02-3's figure, RT in minutes), the
 *      trace at m/z 131.035 as its slice; Detect, then Integrate;
 *   3. Alignment: six samples' slices, peaks grouped within an RT window
 *      0.05 · 0.3 · 1.5 min; Align;
 *   4. Identification: three rows that narrow down — formulas within the Mass
 *      tolerance, the 26 metabolites within it, RT against each standard —
 *      with the level reached; Match mass, then Match RT;
 *   5. the database is the lesson's 26; RT decides between isomers.
 * The press clock is 91's: stages per page, only a page switch ends a press.
 */
import { defineWidget, mathmlRenders } from "../core/index.js";
import * as E from "./engine.js";

const H_PEAKS = 466, H_ALIGN = 404, H_ID = 566;
const DETECT_MS = 3000, INTEGRATE_MS = 1800, ALIGN_MS = 2500, MASS_MS = 1500, RTM_MS = 1200;
const RIGHT = 20, X0 = 56, XA = 112;
const LEVEL_W = 120;                                 // the right-hand column of levels on Identification

const fmt = (x) => Math.round(x).toLocaleString("en-GB");
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
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

/* ------------------------------------------------------------ the slice at m/z 131.035 */
/* One trace on a panel P = { x0, x1, y0, y1 }, RT RT0..RT1. `upTo` RT: peaks
   marked up to it (Detect); `fillTo` RT: areas shaded up to it (Integrate). */
function sliceGeom(P, top) {
  return {
    sx: (t) => P.x0 + ((t - E.RT0) / (E.RT1 - E.RT0)) * (P.x1 - P.x0),
    sy: (v) => P.y1 - (Math.min(v, top) / top) * (P.y1 - P.y0),
  };
}
function drawSlice(ctx, colors, tr, P, { upTo = -1, fillTo = -1, top, labels = true, ticks = true, peakColour = null, cursor = null }) {
  const { sx, sy } = sliceGeom(P, top);
  rule(ctx, P.x0, P.y1, P.x1, P.y1, colors.axis);
  if (ticks) for (let t = 1; t <= 4.5; t += 0.5) {
    rule(ctx, sx(t), P.y1, sx(t), P.y1 + 3, colors.axis);
    if (Number.isInteger(t)) txt(ctx, colors, String(t), sx(t), P.y1 + 15, { size: "fsXs", colour: colors.ink3, align: "center" });
  }
  // integrated areas, filled from the left as the press passes
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
  if (cursor != null && cursor >= E.RT0 && cursor <= E.RT1) rule(ctx, sx(cursor), P.y0, sx(cursor), P.y1, colors.highlight, 1.5);
  for (const d of tr.det) {
    if (d.rt > upTo) continue;
    const x = sx(d.rt), y = sy(d.h + E.BASE);
    dot(ctx, x, y, 4, peakColour ? peakColour(d) : colors.empirical);
    if (!labels) continue;
    const ly = Math.min(y, sy(E.THRESHOLD) - 26);
    const integrated = fillTo >= tr.rt[d.hi];
    txt(ctx, colors, `RT ${d.rt.toFixed(2)}`, x + 9, ly + 4, { size: "fsXs", colour: colors.ink1, weight: "600" });
    txt(ctx, colors, integrated ? `area ${fmt(d.area)}` : `S/N ${d.sn.toFixed(1)}`, x + 9, ly + 17, { size: "fsXs", colour: colors.ink2, mono: true });
  }
  return { sx, sy };
}

/* ------------------------------------------------------------ the Peaks page */
const peaksLayout = (w) => ({ map: { x0: X0, x1: w - RIGHT, y0: 40, y1: 196 }, trace: { x0: X0, x1: w - RIGHT, y0: 262, y1: 420 } });
const MZ_LO = 80, MZ_HI = 230;
const sampleIndex = (params) => Math.max(0, E.SAMPLES.findIndex((s) => s.id === params.sample));

function drawPeaks(ctx, colors, w, params, state, anim) {
  const L = peaksLayout(w), j = sampleIndex(params), tr = state.traces[j], s0 = E.SAMPLES[j];
  const { s, p } = stageOf("peaks", params, anim);
  // Detect sweeps RT 0 → 10 min across the map and the slice together; Integrate sweeps the slice
  const detT = s >= 2 || (s === 1 && p >= 1) ? Infinity : s === 1 ? p * E.MAP_RT : -1;
  const intT = s >= 2 ? (p >= 1 ? Infinity : E.RT0 + p * (E.RT1 - E.RT0)) : -1;
  const cursor = s === 1 && p < 1 ? detT : s === 2 && p < 1 ? intT : null;

  txt(ctx, colors, `Sample ${s0.id} (${s0.cohort}): every m/z against retention time`, 12, 20, { colour: colors.ink1, weight: "600" });
  const M = L.map;
  const mx = (t) => M.x0 + (t / E.MAP_RT) * (M.x1 - M.x0), my = (m) => M.y1 - ((m - MZ_LO) / (MZ_HI - MZ_LO)) * (M.y1 - M.y0);
  rule(ctx, M.x0, M.y1, M.x1, M.y1, colors.axis); rule(ctx, M.x0, M.y0, M.x0, M.y1, colors.axis);
  for (let t = 0; t <= E.MAP_RT; t += 2) { rule(ctx, mx(t), M.y1, mx(t), M.y1 + 3, colors.axis); txt(ctx, colors, String(t), mx(t), M.y1 + 15, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  for (let m = 100; m <= 220; m += 40) { rule(ctx, M.x0 - 3, my(m), M.x0, my(m), colors.axis); txt(ctx, colors, String(m), M.x0 - 6, my(m) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "m/z", M.x0 - 6, M.y0 - 8, { size: "fsXs", colour: colors.ink3, align: "right" });
  txt(ctx, colors, "min", M.x1, M.y1 + 28, { size: "fsXs", colour: colors.ink3, align: "right" });
  box(ctx, M.x0 + 1, my(131.035) - 4, M.x1 - M.x0 - 1, 8, colors.highlight, 0.16);
  txt(ctx, colors, "m/z 131.035", M.x1 - 4, my(131.035) - 7, { size: "fsXs", colour: colors.ink1, align: "right" });
  let shown = 0;
  E.METS.forEach((m) => {
    const a = m.at[j], rt = m.rt + E.SHIFT[j];
    if (a <= 0 || rt > detT) return;
    shown += 1;
    const r = intT === Infinity ? Math.max(2, 1.5 + 1.6 * (Math.log10(a) - 3)) : 3.5;
    dot(ctx, mx(rt), my(m.exact), r, colors.empirical);
  });
  if (cursor != null && s === 1) rule(ctx, mx(Math.min(cursor, E.MAP_RT)), M.y0, mx(Math.min(cursor, E.MAP_RT)), M.y1, colors.highlight, 1.5);
  if (detT >= 0) txt(ctx, colors, `${shown} of 26 detected`, M.x1 - 4, M.y0 + 10, { size: "fsXs", colour: colors.ink2, align: "right" });

  txt(ctx, colors, "The slice at m/z 131.035 ± 5 ppm: intensity against retention time", 12, L.trace.y0 - 16, { colour: colors.ink1, weight: "600" });
  const g = drawSlice(ctx, colors, tr, L.trace, { upTo: detT, fillTo: intT, top: state.top[j], cursor });
  txt(ctx, colors, "S/N 3", L.trace.x1 - 2, g.sy(E.THRESHOLD) - 5, { size: "fsXs", colour: colors.reference, align: "right" });
  txt(ctx, colors, "retention time (min)", (L.trace.x0 + L.trace.x1) / 2, L.trace.y1 + 34, { size: "fsXs", colour: colors.ink3, align: "center" });
}

/* ------------------------------------------------------------ the Alignment page */
const alignLayout = (w) => ({ x0: XA, x1: w - RIGHT, y0: 46, row: 52 });
function drawAlignment(ctx, colors, w, params, state, anim) {
  const L = alignLayout(w), win = params.window;
  const { s, p } = stageOf("alignment", params, anim);
  const T = s >= 1 ? (p >= 1 ? Infinity : E.RT0 + p * (E.RT1 - E.RT0)) : -1;
  const features = state.features[win];
  const sx = (t) => L.x0 + ((t - E.RT0) / (E.RT1 - E.RT0)) * (L.x1 - L.x0);
  const yEnd = L.y0 + L.row * E.SAMPLES.length;
  txt(ctx, colors, "m/z 131.035 in six samples, each trace on its own scale", 12, 18, { colour: colors.ink1, weight: "600" });
  // a band per feature, grown from its first peak to the press's RT
  const featureOf = new Map();
  features.forEach((f) => {
    if (T < f.lo) return;
    const hi = Math.min(f.hi, T), c = colors.clusters[f.k % colors.clusters.length];
    box(ctx, sx(f.lo) - 6, L.y0 - 4, sx(hi) - sx(f.lo) + 12, yEnd - L.y0 + 4, c, 0.2);
    txt(ctx, colors, `feature ${f.k + 1}`, (sx(f.lo) + sx(f.hi)) / 2, L.y0 - 10, { size: "fsXs", colour: c, weight: "600", align: "center" });
    f.peaks.forEach((pk) => { if (pk.rt <= T) featureOf.set(pk, c); });
  });
  E.SAMPLES.forEach((s0, j) => {
    const P = { x0: L.x0, x1: L.x1, y0: L.y0 + j * L.row + 4, y1: L.y0 + (j + 1) * L.row - 4 };
    drawSlice(ctx, colors, state.traces[j], P, { upTo: Infinity, top: state.top[j], labels: false, ticks: false, peakColour: (d) => featureOf.get(d) ?? colors.ink1 });
    txt(ctx, colors, s0.id.slice(-3), L.x0 - 8, P.y1 - 14, { size: "fsXs", colour: colors.ink1, align: "right", mono: true });
    txt(ctx, colors, groupWord(s0.cohort), L.x0 - 8, P.y1 - 1, { size: "fsXs", colour: colors.ink3, align: "right" });
  });
  if (T > E.RT0 && T < E.RT1) rule(ctx, sx(T), L.y0 - 4, sx(T), yEnd, colors.highlight, 1.5);
  for (let t = 1; t <= 4; t += 1) { rule(ctx, sx(t), yEnd, sx(t), yEnd + 3, colors.axis); txt(ctx, colors, String(t), sx(t), yEnd + 15, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  txt(ctx, colors, "retention time (min)", (L.x0 + L.x1) / 2, yEnd + 34, { size: "fsXs", colour: colors.ink3, align: "center" });
}

/* ------------------------------------------------------------ the Identification page */
const idLayout = (w) => ({ x0: 24, x1: w - RIGHT - LEVEL_W, lx: w - RIGHT, table: 382 });
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
function drawIdentification(ctx, colors, w, params, state, anim) {
  const L = idLayout(w), tol = params.tolerance, f = featureOf(params, state);
  const fs = state.features[params.window];
  const { s, p } = stageOf("identification", params, anim);
  const massP = s >= 2 || (s === 1 && p >= 1) ? 1 : s === 1 ? p : 0;
  const rtP = s >= 2 ? p : 0;
  const tolD = E.tolDa(tol, E.FEATURE_MZ), unit = tol === "unit";
  const level = (y, n, sub, on) => {
    txt(ctx, colors, n, L.lx, y, { colour: on ? colors.ink1 : colors.ink3, weight: "700", align: "right" });
    txt(ctx, colors, sub, L.lx, y + 14, { size: "fsXs", colour: colors.ink3, align: "right" });
  };
  txt(ctx, colors, `Feature ${f.k + 1} of ${fs.length}: m/z ${E.FEATURE_MZ.toFixed(4)}, RT ${f.rt.toFixed(2)} min`, 12, 20, { colour: colors.ink1, weight: "600" });

  // 1 · formulas within the tolerance: a ruler of every CHNOS formula's [M−H]⁻
  const lo = unit ? 130.45 : E.FEATURE_MZ - 0.012, hi = unit ? 131.65 : E.FEATURE_MZ + 0.012;
  const list = unit ? state.formulasWide : state.formulasNear;
  const rx = (m) => L.x0 + ((m - lo) / (hi - lo)) * (L.x1 - L.x0), ry = 84;
  const nIn = (unit ? state.formulasUnit : state.formulasPpm).length;
  txt(ctx, colors, `1 · Mass: CHNOS formulas within ${unit ? "±0.5 Da" : "±5 ppm"}`, 12, 48, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ry + 10, L.x1, ry + 10, colors.axis);
  [lo, (lo + hi) / 2, hi].forEach((m) => txt(ctx, colors, m.toFixed(unit ? 1 : 3), rx(m), ry + 24, { size: "fsXs", colour: colors.ink3, align: "center", mono: true }));
  const half = tolD * easeInOut(massP);
  if (massP > 0) box(ctx, rx(E.FEATURE_MZ - half), ry - 16, Math.max(2, rx(E.FEATURE_MZ + half) - rx(E.FEATURE_MZ - half)), 26, colors.highlight, 0.18);
  list.forEach((fm) => rule(ctx, rx(fm.mz), ry - 12, rx(fm.mz), ry + 10, massP > 0 && Math.abs(fm.mz - E.FEATURE_MZ) <= half ? colors.ink1 : colors.ink3, 1.2));
  rule(ctx, rx(E.FEATURE_MZ), ry - 18, rx(E.FEATURE_MZ), ry + 14, colors.empirical, 2);
  if (!unit) txt(ctx, colors, `ticks: ${list.map((fm) => fm.f).join(", ")}`, L.x0, ry + 40, { size: "fsXs", colour: colors.ink3, mono: true });
  if (massP >= 1) {
    txt(ctx, colors, unit ? `${nIn} formulas` : `1 formula: ${state.formulasPpm[0].f}`, L.x1, 48, { size: "fsXs", colour: colors.ink1, weight: "600", align: "right" });
    level(66, unit ? "level 5" : "level 4", unit ? "exact mass" : "molecular formula", true);
  }

  // 2 · the 26 metabolites within the tolerance
  const cands = E.candidates(E.FEATURE_MZ, tol);
  txt(ctx, colors, "2 · The 26 metabolites within the tolerance", 12, 152, { colour: colors.ink1, weight: "600" });
  if (massP >= 1) {
    const cw = Math.min(190, (L.x1 - L.x0 - 12) / Math.max(2, cands.length));
    cands.forEach((m, k) => {
      const bx = L.x0 + k * (cw + 12), on = rtP >= 1 && Math.abs(f.rt - m.rt) <= E.RT_TOL;
      box(ctx, bx, 164, cw, 42, colors.surface2);
      if (on) { ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, 165, cw - 2, 40); ctx.restore(); }
      txt(ctx, colors, m.name, bx + 8, 181, { colour: on ? colors.highlight : colors.ink1, weight: "600" });
      txt(ctx, colors, `${m.formula} · ${E.ppmOf(E.FEATURE_MZ, m.exact).toFixed(1)} ppm`, bx + 8, 197, { size: "fsXs", colour: colors.ink2, mono: true });
    });
    txt(ctx, colors, "one formula, two structures: the same exact mass", L.x0, 224, { size: "fsXs", colour: colors.ink2 });
    level(178, "level 3", `${cands.length} candidates`, true);
  }

  // 3 · RT against each candidate's standard
  const T0 = 1.5, T1 = 4.0, tx = (t) => L.x0 + ((t - T0) / (T1 - T0)) * (L.x1 - L.x0), ty = 318;
  txt(ctx, colors, `3 · Retention time against each standard (±${E.RT_TOL} min)`, 12, 256, { colour: colors.ink1, weight: "600" });
  rule(ctx, L.x0, ty, L.x1, ty, colors.axis);
  for (let t = T0; t <= T1 + 1e-9; t += 0.5) txt(ctx, colors, t.toFixed(1), tx(t), ty + 14, { size: "fsXs", colour: colors.ink3, align: "center" });
  if (rtP > 0) {
    cands.forEach((m) => {
      const hit = rtP >= 1 && Math.abs(f.rt - m.rt) <= E.RT_TOL;
      box(ctx, tx(m.rt - E.RT_TOL), ty - 30, tx(m.rt + E.RT_TOL) - tx(m.rt - E.RT_TOL), 30, hit ? colors.highlight : colors.reference, 0.18);
      rule(ctx, tx(m.rt), ty - 32, tx(m.rt), ty, colors.reference, 2);
      txt(ctx, colors, `${short(m.name)} ${m.rt}`, tx(m.rt), ty - 38, { size: "fsXs", colour: hit ? colors.highlight : colors.ink2, align: "center", weight: hit ? "600" : "" });
    });
    // the feature drops onto its RT
    const y = 268 + (ty - 12 - 268) * easeInOut(Math.min(1, rtP));
    dot(ctx, tx(Math.max(T0, Math.min(T1, f.rt))), y, 5, colors.empirical);
    if (rtP >= 1) {
      txt(ctx, colors, `feature ${f.rt.toFixed(2)}`, tx(Math.max(T0, Math.min(T1, f.rt))), ty + 30, { size: "fsXs", colour: colors.empirical, align: "center", weight: "600" });
      const { byRt } = E.identify(f, tol);
      level(282, byRt.length === 1 ? "level 1" : "level 3", byRt.length === 1 ? "with the standard's MS2" : "no standard within ±0.1", byRt.length === 1);
    }
  }

  // the feature table: one row a feature, the names as far as the presses have gone
  const stage = massP >= 1 ? (rtP >= 1 ? 2 : 1) : 0;
  txt(ctx, colors, `The feature table (RT window ${params.window} min)`, 12, L.table - 10, { colour: colors.ink1, weight: "600" });
  const cols = tableCols(w);
  ["m/z", "RT", "name", "matched by", ...E.SAMPLES.map((s0) => s0.id.slice(-3))].forEach((c, k) => txt(ctx, colors, c, cols[k], L.table + 8, { size: "fsXs", colour: colors.ink3, mono: true, align: k >= 4 ? "right" : "left" }));
  fs.forEach((g, r) => {
    const y = L.table + 26 + r * 17, sel = g === f, nm = nameOf(g, stage, tol);
    if (sel) box(ctx, 8, y - 12, w - RIGHT - 4, 16, colors.surface2);
    const cells = [E.FEATURE_MZ.toFixed(4), g.rt.toFixed(2), nm.hit ? short(nm.name) : nm.name, nm.by, ...g.area.map((a) => (a > 0 ? `${Math.round(a / 1000)}k` : "0"))];
    cells.forEach((c, k) => txt(ctx, colors, c, cols[k], y, { size: "fsXs", mono: k !== 2, align: k >= 4 ? "right" : "left", colour: k === 2 && nm.hit ? colors.highlight : colors.ink1, weight: sel && k === 2 ? "600" : "" }));
  });
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
const FEATURE_OPTIONS = [{ value: "largest", label: "The largest" }, ...Array.from({ length: 9 }, (_, k) => ({ value: String(k + 1), label: `Feature ${k + 1}` }))];

defineWidget({
  slug: "ms-features",
  title: "Metabolomics: Peaks to Names",
  subtitle:
    "LC-MS records each metabolite as a peak at an m/z and a retention time (RT). Peaks are detected above the noise, "
    + "integrated to an area, grouped across samples into features, and matched to a database. A mass match narrows the "
    + "molecular formula; isomers share it, and the RT of an authentic standard decides between them.",
  layout: "side",
  status: "draft",
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
      { token: "ink-2", label: "The intensity at m/z 131.035", mark: "line" },
      { token: "empirical", label: "A detected peak, and its integrated area", mark: "dot" },
      { token: "reference", label: "S/N 3: the detection limit", mark: "dash" },
    ];
  },

  /* Pure and seeded: six traces, their peaks, the features at every window, the formulas. */
  compute: ({ rng }) => {
    const traces = E.simulate(rng);
    const top = traces.map((t) => Math.max(...t.y) * 1.08);
    const features = Object.fromEntries(E.WINDOWS.map((v) => [v, E.group(traces, Number(v))]));
    return {
      traces, top, features,
      formulasWide: E.formulas(E.FEATURE_MZ, 0.6),
      formulasUnit: E.formulas(E.FEATURE_MZ, 0.5),
      formulasNear: E.formulas(E.FEATURE_MZ, 0.012),
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
      peaks0: "Find the peaks that stand at least three times the noise above the baseline",
      peaks1: "Sum the area over the baseline under each detected peak",
      peaksdone: "Every peak in this sample has been detected and integrated",
      alignment0: "Group the six samples' peaks into features by retention time",
      alignmentdone: "The peaks have been grouped; change RT window to group them again",
      identification0: "Find every formula, and every metabolite of the 26, within the mass tolerance",
      identification1: "Compare the feature's retention time with each candidate's standard",
      identificationdone: "The feature has been matched by mass and by retention time",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: { peaks: 0, alignment: 0, identification: 0 }, p: 1, page: params.page };
      if (!fromScratch && Number(params.shown) > 0) anim.n[params.page] = Math.min(STAGES[params.page], Number(params.shown));
      settle(anim, params.page);
      return anim;
    },
    advance: (anim, { dt, params }) => {
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
       other page's press is never taken unasked (91's halt). Any other display
       change leaves the press running. */
    rebuild: (anim, { params }) => {
      if (params.page !== anim.page && anim.p < 1) { anim.p = 1; anim.halt = true; }
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

  draw: ({ ctx, colors, w, params, state, anim }) => {
    renderFormula(params.page);
    if (params.page === "identification") drawIdentification(ctx, colors, w, params, state, anim);
    else if (params.page === "alignment") drawAlignment(ctx, colors, w, params, state, anim);
    else drawPeaks(ctx, colors, w, params, state, anim);
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
    const nMap = E.METS.filter((m) => m.at[j] > 0).length;
    return [
      { label: "Peaks at m/z 131.035", value: detected ? `${tr.det.length}` : "–", note: detected ? tr.det.map((d) => `RT ${d.rt.toFixed(2)}, S/N ${d.sn.toFixed(1)}`).join(" · ") : "once detected" },
      { label: "Areas", value: integrated ? tr.det.map((d) => fmt(d.area)).join(" · ") : "–", note: integrated ? `the file records ${tr.det.map((d) => fmt(d.who.at[j])).join(" · ")}` : "once integrated" },
      { label: "Detected in this sample", value: detected ? `${nMap} of 26` : "–", note: "the file records 0 for the rest" },
    ];
  },
});
