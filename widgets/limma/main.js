/* limma — slot 90, "Proteomics: Differential Expression". DRAFT 2026-10-07.
 *
 * Planned in the catalogue's § The proteomics and metabolomics arc and
 * § Slot 90: measured in `_lab/proteomics-arc-measure.mjs`, mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/limma-mock.html`; his eight calls
 * all the recommendation. The misconception is 01-4 cell 9's: limma's log2FC
 * is not shrunk — limma shrinks each protein's VARIANCE toward a prior fitted
 * across all proteins, which changes the t and so the p-value.
 *   1. two pages, Variance · Test; Replicates 3 · 5 · 11 per group, default 3;
 *   2. simulated: 1,337 proteins (01-4's count) whose true variances follow
 *      the lesson's fitted prior, about 10% truly different;
 *   3. Variance: a histogram of every protein's own SD, the fitted prior's
 *      curve and s0, the moderated SDs as an outline; one protein below, its
 *      values in two ink rows (no group colours: --c-prior shares a slot with
 *      --c-group-b), its own, prior and moderated SD as bars, and limma's
 *      weighted average written out; a Step press of three steps;
 *   4. Test: 01-4 cell 14's volcano, a Statistic control Ordinary t ·
 *      Moderated t; a change moves every protein straight up or down, because
 *      the log2FC is the same in both tests — cell 9's correction as motion;
 *   5. significant at adjusted p < 0.05 only (no fold-change cut-off);
 *   6. Example protein: Small SD by chance · Typical · Large SD, or a click;
 *   7. True values Off · On, as 88 and 89.
 * The press clock is 78's (deseq2, the count-data cousin of this widget):
 * stages per page, `anim.inert` where a page has nothing to step.
 */
import { defineWidget } from "../core/index.js";
import * as E from "./engine.js";

const P = E.PROTEINS;
const REPS = ["3", "5", "11"];
const TYPICAL_SEED = 9;                // measured over 40 seeds (scratch limma-seed.mjs): nearest the mean at 3, 5 and 11
const H_VARIANCE = 520, H_TEST = 480;
const STEP_MS = [700, 1, 1400];        // own SDs grow in · the prior appears · every SD moves to its moderated value
const EASE_MS = 900;                   // a Statistic change: the dots move vertically
const U0 = -2, U1 = Math.log10(2.5), NBINS = 48;   // log10 SD: 0.01 to 2.5 log2
const FC_LIM = 2.5;

const EXAMPLES = [
  { value: "small-sd-by-chance", key: "small", label: "Small SD by chance", group: "Example proteins" },
  { value: "typical", key: "typical", label: "Typical", group: "Example proteins" },
  { value: "large-sd", key: "large", label: "Large SD", group: "Example proteins" },
];
const PROTEIN_OPTIONS = Array.from({ length: P }, (_, i) => ({ value: `protein-${i + 1}`, label: `Protein ${i + 1}`, group: "Proteins" }));
const STATS = { ordinary: "Ordinary t", moderated: "Moderated t" };

const n0 = (v) => v.toLocaleString("en-US");
const f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
const sg = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
const tFmt = (t) => `${t < 0 ? "−" : ""}${Math.abs(t).toFixed(2)}`;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/* a rare SD past either end of the axis (limma's prior has a long upper tail) counts in the end bar */
const binOf = (s) => Math.min(NBINS - 1, Math.max(0, Math.floor(((Math.log10(s) - U0) / (U1 - U0)) * NBINS)));

/* ------------------------------------------------------------ geometry */
const RIGHT = 20;
const varianceLayout = (w) => ({
  hist: { x0: 112, x1: w - RIGHT, top: 44, base: 244 },
  prot: { title: 296, rows: [318, 340], ticks: 362, bars: [392, 414, 436], formula: 468, t: 490 },
});
const testLayout = (w) => ({ x0: 64, x1: w - RIGHT, top: 52, base: 420 });
const histX = (L, u) => L.hist.x0 + ((u - U0) / (U1 - U0)) * (L.hist.x1 - L.hist.x0);

/* ------------------------------------------------------------ the press clock (78's) */
const stagesOf = (page) => (page === "variance" ? 3 : 0);
function settle(anim, page) {
  const max = stagesOf(page), n = anim.n[page] ?? 0;
  anim.inert = max === 0;                 // core takes Step out of the row on Test
  anim.done = n >= max && anim.p >= 1;
  anim.labelAt = anim.done ? "done" : `${page[0]}${n}`;
}
function stageOf(params, anim) {
  if (!anim) return { s: Math.min(3, Number(params.shown) || 0), e: 1 };
  const s = anim.n.variance ?? 0;
  return { s, e: anim.p < 1 ? easeInOut(anim.p) : 1 };
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
function box(ctx, x, y, w, h, fill, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore(); }
function counts(sds) {
  const c = new Array(NBINS).fill(0);
  for (const s of sds) { const k = binOf(s); if (k >= 0 && k < NBINS) c[k] += 1; }
  return c;
}
const SD_TICKS = [0.01, 0.03, 0.1, 0.3, 1];

/* ------------------------------------------------------------ the Variance page */
function drawVariance(ctx, colors, w, params, state, anim) {
  const L = varianceLayout(w), H = L.hist;
  const { s, e } = stageOf(params, anim);
  const sx = (sd) => histX(L, Math.min(U1, Math.max(U0, Math.log10(sd))));
  const sy = (c) => H.base - (c / state.yMax) * (H.base - H.top);
  const bw = (H.x1 - H.x0) / NBINS;

  txt(ctx, colors, `Each protein's SD across its replicates: ${n0(P)} proteins, ${state.n} cancer and ${state.n} healthy samples`, 12, 18, { colour: colors.ink1, weight: "600" });
  rule(ctx, H.x0, H.base, H.x1, H.base, colors.axis); rule(ctx, H.x0, H.top, H.x0, H.base, colors.axis);
  for (const t of SD_TICKS) { rule(ctx, sx(t), H.base, sx(t), H.base + 4, colors.axis); txt(ctx, colors, String(t), sx(t), H.base + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  txt(ctx, colors, "SD, log2 (log scale)", (H.x0 + H.x1) / 2, H.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  for (const c of state.yTicks) { rule(ctx, H.x0 - 4, sy(c), H.x0, sy(c), colors.axis); txt(ctx, colors, String(c), H.x0 - 6, sy(c) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "proteins", H.x0 - 6, H.top - 8, { size: "fsXs", colour: colors.ink3, align: "right" });

  const mk = resolveMarked(params, state), x = state.fit.fits[mk.id];
  const own = Math.sqrt(x.s2), mod = Math.sqrt(x.s2post);

  // stage 1: every protein's own SD, the bars growing from the axis
  if (s >= 1) {
    const g = s === 1 ? e : 1;
    state.ownCounts.forEach((c, k) => { if (c) box(ctx, H.x0 + k * bw + 0.5, H.base - g * (H.base - sy(c)), bw - 1, g * (H.base - sy(c)), colors.empirical, 0.55); });
  }
  // stage 2: the prior fitted to them — its curve and s0, at once
  if (s >= 2) {
    ctx.save(); ctx.strokeStyle = colors.prior; ctx.lineWidth = 2; ctx.beginPath();
    state.curve.forEach(([u, c], i) => { const px = histX(L, u), py = sy(Math.min(c, state.yMax)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke(); ctx.restore();
    rule(ctx, sx(state.s0), H.top, sx(state.s0), H.base, colors.prior, 1.5, [4, 3]);
    const away = own > state.s0 ? -6 : 6;     // on the side away from the example protein's lines
    txt(ctx, colors, `prior: s0 = ${f2(state.s0)}, d0 = ${state.d0.toFixed(1)}`, sx(state.s0) + away, H.top + 10, { size: "fsXs", colour: colors.prior, weight: "600", align: away < 0 ? "right" : "left" });
  }
  // stage 3: every SD moves to its moderated value; the outline is the moving histogram
  if (s >= 3) {
    const k = s === 3 ? e : 1;
    const moving = k >= 1 ? state.modCounts : counts(state.ownSd.map((o, i) => o ** (1 - k) * state.modSd[i] ** k));
    ctx.save(); ctx.strokeStyle = colors.posterior; ctx.lineWidth = 2; ctx.beginPath();
    moving.forEach((c, b) => { const xa = H.x0 + b * bw, xb = xa + bw, y = sy(Math.min(c, state.yMax)); if (b === 0) ctx.moveTo(xa, y); else ctx.lineTo(xa, y); ctx.lineTo(xb, y); });
    ctx.stroke(); ctx.restore();
  }
  // the example protein's place in the histogram
  if (s >= 1) {
    rule(ctx, sx(own), H.top, sx(own), H.base, colors.empirical, 1.5);
    if (s >= 3) { const m = own ** (1 - (s === 3 ? e : 1)) * mod ** (s === 3 ? e : 1); rule(ctx, sx(m), H.top, sx(m), H.base, colors.posterior, 1.5); }
  }
  if (s >= 1) {
    txt(ctx, colors, "own SD", H.x0 + 8, H.top + 10, { size: "fsXs", colour: colors.empirical, weight: "600" });
    if (s >= 3) txt(ctx, colors, "moderated SD", H.x0 + 8, H.top + 24, { size: "fsXs", colour: colors.posterior, weight: "600" });
  }

  // the protein walked through
  const R = L.prot;
  txt(ctx, colors, mk.title, 12, R.title, { colour: colors.ink1, weight: "600" });
  if (s < 1) return;
  const row = [...state.sim.cancer[mk.id].slice(0, state.n), ...state.sim.healthy[mk.id].slice(0, state.n)];
  const centre = E.mean(row);
  const half = Math.max(1.5, 1.1 * Math.max(...row.map((v) => Math.abs(v - centre))));   // every value on the row
  const qx = (v) => (H.x0 + H.x1) / 2 + ((v - centre) / half) * ((H.x1 - H.x0) / 2);
  ["cancer", "healthy"].forEach((g, k) => {
    const y = R.rows[k], vs = row.slice(k * state.n, (k + 1) * state.n);
    rule(ctx, H.x0, y, H.x1, y, colors.grid);
    txt(ctx, colors, g, H.x0 - 8, y + 4, { size: "fsXs", colour: colors.ink2, align: "right" });
    vs.forEach((v) => dot(ctx, qx(v), y, 3.6, colors.ink1));
    const m = E.mean(vs);
    rule(ctx, qx(m), y - 8, qx(m), y + 8, colors.ink2, 1.5);
  });
  for (const v of [-1, 0, 1]) txt(ctx, colors, v === 0 ? "mean" : sg(v, 0), qx(centre + v), R.ticks, { size: "fsXs", colour: colors.ink3, align: "center" });
  txt(ctx, colors, "log2", H.x1, R.ticks, { size: "fsXs", colour: colors.ink3, align: "right" });

  const bar = (y, name, sd, colour, note, alpha = 1) => {
    txt(ctx, colors, name, H.x0 - 8, y + 4, { size: "fsXs", colour, weight: "600", align: "right" });
    box(ctx, H.x0, y - 6, sx(sd) - H.x0, 12, colour, alpha);
    txt(ctx, colors, `${f3(sd)}${note}`, sx(sd) + 6, y + 4, { size: "fsXs", mono: true, colour: colors.ink2 });
  };
  bar(R.bars[0], "own SD", own, colors.empirical, `  ${state.df} df`, 0.55);
  if (s >= 2) bar(R.bars[1], "prior s0", state.s0, colors.prior, `  ${state.d0.toFixed(1)} df`, 0.85);
  if (s >= 3) {
    const k = s === 3 ? e : 1;
    bar(R.bars[2], "moderated SD", own ** (1 - k) * mod ** k, colors.posterior, "");
  }
  if (params.truth === "on") {
    const tsd = Math.sqrt(state.sim.meta[mk.id].sigma2);
    rule(ctx, sx(tsd), R.bars[0] - 12, sx(tsd), R.bars[2] + 10, colors.reference, 1.5, [3, 3]);
    txt(ctx, colors, `true ${f3(tsd)}`, sx(tsd), R.bars[2] + 22, { size: "fsXs", colour: colors.reference, align: "center" });
  }
  if (s >= 3 && e >= 1) {
    txt(ctx, colors, `moderated SD² = (${state.df} × ${f3(own)}² + ${state.d0.toFixed(1)} × ${f3(state.s0)}²) / (${state.df} + ${state.d0.toFixed(1)}) = ${f3(mod)}²`, 12, R.formula, { size: "fsXs", mono: true, colour: colors.ink1 });
    txt(ctx, colors, `t = log2FC / (SD × √(1/${state.n} + 1/${state.n})): ordinary ${tFmt(x.t)}, moderated ${tFmt(x.tMod)}; log2FC ${sg(x.diff)} in both`, 12, R.t, { size: "fsXs", mono: true, colour: colors.ink1 });
  }
}

/* ------------------------------------------------------------ the Test page */
function volcanoGeometry(w, state) {
  const V = testLayout(w);
  const qx = (v) => V.x0 + ((Math.max(-FC_LIM, Math.min(FC_LIM, v)) + FC_LIM) / (2 * FC_LIM)) * (V.x1 - V.x0);
  const qy = (p) => V.base - (Math.min(-Math.log10(p), state.yMaxLog) / state.yMaxLog) * (V.base - V.top);
  return { V, qx, qy };
}
const pOf = (x, stat) => (stat === "moderated" ? x.pMod : x.p);
function drawTest(ctx, colors, w, params, state, anim) {
  const { V, qx, qy } = volcanoGeometry(w, state);
  const from = anim ? anim.st.from : params.stat, to = anim ? anim.st.to : params.stat;
  const k = anim && anim.st.t < 1 ? easeInOut(anim.st.t) : 1;
  const landed = k >= 1 ? to : from;          // colours switch when the dots land
  const yOf = (x) => qy(pOf(x, from)) * (1 - k) + qy(pOf(x, to)) * k;
  const C = state.calls[landed];

  const title = `${STATS[landed]}, ${landed === "moderated" ? (state.df + state.d0).toFixed(1) : state.df} df`;
  txt(ctx, colors, `${n0(P)} proteins, ${state.n} cancer and ${state.n} healthy samples`, 12, 18, { colour: colors.ink1, weight: "600" });
  rule(ctx, V.x0, V.base, V.x1, V.base, colors.axis); rule(ctx, V.x0, V.top, V.x0, V.base, colors.axis);
  for (const t of [-2, -1, 0, 1, 2]) { rule(ctx, qx(t), V.base, qx(t), V.base + 4, colors.axis); txt(ctx, colors, String(t).replace("-", "−"), qx(t), V.base + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  txt(ctx, colors, "log2 fold change, cancer − healthy", (V.x0 + V.x1) / 2, V.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  for (const t of state.pTicks) { const y = V.base - (t / state.yMaxLog) * (V.base - V.top); rule(ctx, V.x0 - 4, y, V.x0, y, colors.axis); txt(ctx, colors, String(t), V.x0 - 6, y + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "−log10 p", V.x0 - 6, V.top - 10, { size: "fsXs", colour: colors.ink3, align: "right" });

  // the significance line moves with the dots
  const cutY = (st) => (state.calls[st].cut > 0 ? qy(state.calls[st].cut) : null);
  const ya = cutY(from), yb = cutY(to);
  if (ya !== null && yb !== null) {
    const y = ya * (1 - k) + yb * k;
    rule(ctx, V.x0, y, V.x1, y, colors.extreme, 1, [4, 3]);
    txt(ctx, colors, "adjusted p = 0.05", V.x1 - 4, y - 5, { size: "fsXs", colour: colors.extreme, align: "right" });
  }
  ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = colors.ink3;
  state.fit.fits.forEach((x, i) => { if (!(C.adj[i] < 0.05)) { ctx.beginPath(); ctx.arc(qx(x.diff), yOf(x), 1.8, 0, Math.PI * 2); ctx.fill(); } });
  ctx.restore();
  state.fit.fits.forEach((x, i) => { if (C.adj[i] < 0.05) dot(ctx, qx(x.diff), yOf(x), 2.6, colors.extreme); });
  if (params.truth === "on") state.fit.fits.forEach((x, i) => { if (state.sim.meta[i].de) dot(ctx, qx(x.diff), yOf(x), 4.4, null, colors.reference, 1); });

  const mk = resolveMarked(params, state), mx = state.fit.fits[mk.id];
  dot(ctx, qx(mx.diff), yOf(mx), 7, null, colors.highlight, 2);
  const right = qx(mx.diff) < (V.x0 + V.x1) / 2;
  txt(ctx, colors, `protein ${mk.id + 1}`, qx(mx.diff) + (right ? 11 : -11), yOf(mx) + 4, { size: "fsXs", colour: colors.highlight, weight: "600", align: right ? "left" : "right" });

  txt(ctx, colors, title, V.x0 + 8, V.top + 4, { colour: colors.ink1, weight: "600" });
}

/* ------------------------------------------------------------ the marked protein */
function resolveMarked(params, state) {
  const ex = EXAMPLES.find((e) => e.value === params.protein);
  const id = ex ? state.examples[ex.key] : Math.min(P, Math.max(1, Number(String(params.protein).replace("protein-", "")) || 1)) - 1;
  const truth = params.truth === "on"
    ? (state.sim.meta[id].de ? `: truly differs, log2FC ${sg(state.sim.meta[id].fc)}` : ": does not differ")
    : "";
  return { id, title: `${ex ? `${ex.label}: protein` : "Protein"} ${id + 1}${truth}` };
}

/* ------------------------------------------------------------ the examples */
function pickExamples(sim, fitted) {
  const own = fitted.fits.map((x) => Math.sqrt(x.s2));
  const ids = own.map((_, i) => i);
  const nulls = ids.filter((i) => !sim.meta[i].de), des = ids.filter((i) => sim.meta[i].de);
  const byP = ids.slice().sort((a, b) => fitted.fits[a].p - fitted.fits[b].p).slice(0, 60);
  const topNull = byP.filter((i) => !sim.meta[i].de);
  const small = (topNull.length ? topNull : nulls).slice().sort((a, b) => own[a] - own[b])[0];
  const sorted = own.slice().sort((a, b) => a - b);
  const near = (target, pool) => pool.slice().sort((a, b) => Math.abs(Math.log(own[a] / target)) - Math.abs(Math.log(own[b] / target)))[0];
  const typical = near(sorted[Math.floor(P / 2)], des.filter((i) => i !== small));
  /* among the truly different proteins with an own SD in the top 15%, the one
     the test sees best: an unlucky draw whose sample log2FC came out near 0 at
     11 vs 11 made a poor example of what moderation does to a large SD */
  const wide = des.filter((i) => i !== small && i !== typical && own[i] >= sorted[Math.floor(P * 0.85)] && own[i] <= sorted[Math.floor(P * 0.97)]);
  const large = wide.length
    ? wide.slice().sort((a, b) => Math.abs(fitted.fits[b].t) - Math.abs(fitted.fits[a].t))[0]
    : near(sorted[Math.floor(P * 0.95)], des.filter((i) => i !== small && i !== typical));
  return { small, typical, large };
}

/* ------------------------------------------------------------ the widget */
defineWidget({
  slug: "limma",
  title: "Proteomics: Differential Expression",
  subtitle:
    "limma tests each protein with its own variance pulled toward a typical variance fitted across all proteins (empirical Bayes). "
    + "With few replicates a protein's own variance is unreliable, so the moderated t finds more of the true differences at the same "
    + "false discovery rate. The fold change is the same in both tests: the difference of the mean log2 abundances.",
  layout: "side",
  status: "draft",
  height: (p) => (p.page === "test" ? H_TEST : H_VARIANCE),

  params: {
    page: {
      role: "page", type: "segmented", label: "Page", display: true, default: "variance",
      options: [{ value: "variance", label: "Variance" }, { value: "test", label: "Test" }],
    },
    dataSec: { type: "section", label: "The data" },
    reps: {
      type: "choice", label: "Replicates in each group", default: "3",
      detail: "the cancer samples and the healthy samples measured for every protein",
      options: REPS.map((r) => ({ value: r, label: r })),
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: TYPICAL_SEED },
    testSec: { type: "section", label: "The test", when: { param: "page", equals: "test" } },
    stat: {
      type: "segmented", label: "Statistic", display: true, default: "ordinary", when: { param: "page", equals: "test" },
      detail: "the t's denominator: the protein's own SD, or limma's moderated SD",
      options: [{ value: "ordinary", label: "Ordinary t" }, { value: "moderated", label: "Moderated t" }],
    },
    showSec: { type: "section", label: "Show" },
    protein: {
      type: "select", label: "Example protein", display: true, default: "small-sd-by-chance",
      detail: "a click on a bar of the histogram or a point of the volcano marks that protein",
      options: [...EXAMPLES, ...PROTEIN_OPTIONS],
    },
    truth: {
      type: "segmented", label: "True values", display: true, default: "off",
      detail: "each protein's true SD and whether it truly differs: known in a simulation, unknown in a measured data set",
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }],
    },
    /* authoring escape hatch, first render only: the Variance page's stage */
    shown: { type: "int", min: 0, max: 3, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "test"
    ? [
      { token: "extreme", label: "Significant: adjusted p < 0.05 (Benjamini–Hochberg)", mark: "dot" },
      { token: "highlight", label: "The example protein", mark: "ring" },
      ...(params.truth === "on" ? [{ token: "reference", label: "A protein that truly differs", mark: "ring" }] : []),
    ]
    : [
      { token: "empirical", label: "A protein's own SD, from its replicates", mark: "bar" },
      { token: "prior", label: "The prior fitted across all proteins: the SDs it predicts, and s0", mark: "line" },
      { token: "posterior", label: "The moderated SD", mark: "line" },
      ...(params.truth === "on" ? [{ token: "reference", label: "The example protein's true SD", mark: "dash" }] : []),
    ]),

  /* Pure and seeded: the table, limma at the chosen replicates, both tests,
     the histograms and the prior's curve, whichever page is showing. */
  compute: ({ params, rng }) => {
    const n = Number(params.reps);
    const sim = E.simulate(rng);
    const fitted = E.fit(sim, n);
    const { d0, s02 } = fitted.prior;
    const ownSd = fitted.fits.map((x) => Math.sqrt(x.s2));
    const modSd = fitted.fits.map((x) => Math.sqrt(x.s2post));
    const ownCounts = counts(ownSd), modCounts = counts(modSd);
    const binW = (U1 - U0) / NBINS;
    const curve = Array.from({ length: 160 }, (_, i) => { const u = U0 + (i / 159) * (U1 - U0); return [u, E.priorDensityLog10(u, fitted.df, d0, s02) * binW * P]; });
    const top = Math.max(...ownCounts, ...modCounts, ...curve.map(([, c]) => c));
    const step = top > 300 ? 100 : top > 120 ? 50 : 20;
    const yMax = Math.ceil((top * 1.08) / step) * step;
    const yTicks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
    const calls = {};
    for (const [stat, key] of [["ordinary", "p"], ["moderated", "pMod"]]) {
      const adj = E.bh(fitted.fits.map((x) => x[key]));
      let tp = 0, fp = 0;
      adj.forEach((a, i) => { if (a < 0.05) (sim.meta[i].de ? tp += 1 : fp += 1); });
      calls[stat] = { adj, tp, fp, called: tp + fp, cut: Math.max(0, ...fitted.fits.map((x, i) => (adj[i] < 0.05 ? x[key] : 0))) };
    }
    // one y axis for both statistics, so a dot's move is the change in its p
    const logs = fitted.fits.flatMap((x) => [-Math.log10(x.p), -Math.log10(x.pMod)]).sort((a, b) => a - b);
    const hi = logs[Math.floor(logs.length * 0.999)];
    const pStep = hi > 24 ? 10 : hi > 12 ? 4 : 2;
    const yMaxLog = Math.max(6, Math.ceil(hi / pStep) * pStep);
    const pTicks = Array.from({ length: yMaxLog / pStep + 1 }, (_, i) => i * pStep);
    return {
      n, sim, fit: fitted, df: fitted.df, d0, s0: Math.sqrt(s02), ownSd, modSd, ownCounts, modCounts, curve, yMax, yTicks,
      calls, yMaxLog, pTicks, examples: pickExamples(sim, fitted), medianOwn: ownSd.slice().sort((a, b) => a - b)[Math.floor(P / 2)],
      trulyDiffer: sim.meta.filter((m) => m.de).length,
    };
  },

  /* Step alone, on the Variance page: three presses that are read. The Test
     page has nothing to step (`inert`). A Statistic change asks core for an
     ease; a change flipped back mid-ease starts from where the picture is. */
  animation: {
    stepLabel: { anim: "labelAt", labels: { v0: "Own SDs", v1: "Fit the prior", v2: "Moderate", done: "Step" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      v0: "Each protein's SD from its own replicates",
      v1: "Fit a prior to every protein's SD: a typical SD, s0, and how many degrees of freedom it is worth, d0",
      v2: "Replace each protein's SD by a weighted average of its own and the prior's, weighted by their degrees of freedom",
      done: "Every step of this page has been taken",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: { variance: 0, test: 0 }, p: 1, st: { from: params.stat, to: params.stat, t: 1 }, easing: false };
      if (!fromScratch) anim.n.variance = Math.min(3, Math.max(0, Number(params.shown) || 0));
      settle(anim, params.page);
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.mode === "ease") {
        anim.st.t = Math.min(1, anim.st.t + dt / EASE_MS);
        if (anim.st.t >= 1) anim.st.from = anim.st.to;
        return anim.st.t < 1;
      }
      if (anim.p >= 1) {
        if ((anim.n[params.page] ?? 0) >= stagesOf(params.page)) { settle(anim, params.page); return false; }
        anim.n[params.page] += 1; anim.p = 0;
      }
      anim.p = Math.min(1, anim.p + dt / STEP_MS[anim.n[params.page] - 1]);
      if (anim.p >= 1) { settle(anim, params.page); return false; }
      return true;
    },
    rebuild: (anim, { params }) => {
      if (params.stat !== anim.st.to) {
        anim.st.from = anim.st.t < 0.5 ? anim.st.from : anim.st.to;
        anim.st.to = params.stat; anim.st.t = 0; anim.easing = true;
      }
      /* a page switch mid-press finishes the press where it was (the 2026-09-20 sweep) */
      if (anim.p < 1) anim.p = 1;
      settle(anim, params.page);
    },
  },

  /* a bar of the histogram, or a point of the volcano, marks that protein */
  regions: ({ w, params, state, anim }) => {
    if (!state) return [];
    if (params.page === "test") {
      const { qx, qy } = volcanoGeometry(w, state);
      return state.fit.fits.map((x, i) => ({ x: qx(x.diff) - 4, y: qy(pOf(x, params.stat)) - 4, w: 8, h: 8, set: { protein: `protein-${i + 1}` }, label: `Protein ${i + 1}` }));
    }
    const s = anim ? anim.n.variance : Number(params.shown) || 0;
    if (s < 1) return [];
    const L = varianceLayout(w), H = L.hist, bw = (H.x1 - H.x0) / NBINS;
    const byBin = new Map();
    state.ownSd.forEach((sd, i) => { const k = binOf(sd); if (k >= 0 && k < NBINS) { if (!byBin.has(k)) byBin.set(k, []); byBin.get(k).push(i); } });
    return [...byBin.entries()].map(([k, ids]) => {
      ids.sort((a, b) => state.ownSd[a] - state.ownSd[b]);
      const id = ids[ids.length >> 1];
      return { x: H.x0 + k * bw, y: H.top, w: bw, h: H.base - H.top, set: { protein: `protein-${id + 1}` }, label: `Protein ${id + 1}` };
    });
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    if (params.page === "test") drawTest(ctx, colors, w, params, state, anim);
    else drawVariance(ctx, colors, w, params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    const truth = params.truth === "on";
    const mk = resolveMarked(params, state), x = state.fit.fits[mk.id];
    if (params.page === "test") {
      const line = (stat, df) => {
        const c = state.calls[stat];
        return { label: `Significant, ${STATS[stat].toLowerCase()}`, value: `${n0(c.called)} of ${n0(P)}`,
          note: truth ? `${n0(c.tp)} of the ${n0(state.trulyDiffer)} that truly differ; ${n0(c.fp)} that do not` : `adjusted p < 0.05, ${df} df` };
      };
      return [
        line("ordinary", state.df),
        line("moderated", (state.df + state.d0).toFixed(1)),
        { label: `Protein ${mk.id + 1}`, value: `log2FC ${sg(x.diff)}`, note: `in both tests; t ${tFmt(x.t)} ordinary, ${tFmt(x.tMod)} moderated` },
      ];
    }
    const { s } = stageOf(params, anim);
    const own = Math.sqrt(x.s2), mod = Math.sqrt(x.s2post);
    const tsd = truth ? `; true SD ${f3(Math.sqrt(state.sim.meta[mk.id].sigma2))}` : "";
    return [
      { label: "Each protein's own SD", value: s >= 1 ? `median ${f2(state.medianOwn)}` : "–", note: `from ${state.n} + ${state.n} values: ${state.df} degrees of freedom` },
      { label: "The prior, across all proteins", value: s >= 2 ? `s0 ${f2(state.s0)}, d0 ${state.d0.toFixed(1)}` : "–", note: "a typical SD, and the degrees of freedom it is worth" },
      { label: `Protein ${mk.id + 1}'s SD`, value: s >= 3 ? `${f3(own)} → ${f3(mod)}` : s >= 1 ? f3(own) : "–", note: s >= 3 ? `weights ${state.df} : ${state.d0.toFixed(1)}${tsd}` : `its own, then moderated${tsd}` },
    ];
  },
});
