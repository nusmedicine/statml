/* limma — slot 90, "Proteomics: Differential Expression". DRAFT 2026-10-07.
 *
 * Planned in the catalogue's § The proteomics and metabolomics arc and
 * § Slot 90: measured in `_lab/proteomics-arc-measure.mjs`, mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/limma-mock.html`; his eight calls
 * all the recommendation. The misconception is 01-4 cell 9's: limma's log2FC
 * is not shrunk — limma shrinks each protein's VARIANCE toward a prior fitted
 * across all proteins, which changes the t and so the p-value.
 *   1. two pages, Shrinkage · Test under a control named Step (named Variance on the mock;
 *      his rounds 1 and 2); one word for what happens to the variance, shrink:
 *      the shrunk SD, the Shrink press; the moderated t keeps limma's name;
 *      Replicates 3 · 5 · 11 per group, default 3;
 *   2. simulated: 1,337 proteins (01-4's count) whose true variances follow
 *      the lesson's fitted prior, about 10% truly different;
 *   3. Shrinkage: a histogram of every protein's own SD, the fitted prior's
 *      curve and s0, the shrunk SDs as an outline; one protein below as 78's
 *      likelihood × prior = posterior on the same log-SD axis (his round 1,
 *      pick C); no group colours (--c-prior shares a slot with --c-group-b);
 *      limma's weighted average in the MathML card; three Step presses;
 *   4. Test: 01-4 cell 14's volcano, a Statistic control Ordinary t ·
 *      Moderated t; a change moves every protein straight up or down, because
 *      the log2FC is the same in both tests — cell 9's correction as motion;
 *   5. significant at adjusted p < 0.05 only (no fold-change cut-off);
 *   6. Example protein: Small SD by chance · Typical · Large SD, or a click;
 *   7. True values Off · On, as 88 and 89.
 * The press clock is 78's (deseq2, the count-data cousin of this widget):
 * stages per page, `anim.inert` where a page has nothing to step.
 */
import { defineWidget, mathmlRenders } from "../core/index.js";
import * as E from "./engine.js";

const P = E.PROTEINS;
const REPS = ["3", "5", "11"];
const TYPICAL_SEED = 9;                // measured over 40 seeds (scratch limma-seed.mjs): nearest the mean at 3, 5 and 11
const H_SHRINKAGE = 456, H_TEST = 480;
const STEP_MS = [700, 1, 1400];        // own SDs grow in · the prior appears · every SD moves to its shrunk value
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
const f3 = (v) => v.toFixed(3);
const sg = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
const tFmt = (t) => `${t < 0 ? "−" : ""}${Math.abs(t).toFixed(2)}`;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/* a rare SD past either end of the axis (limma's prior has a long upper tail) counts in the end bar */
const binOf = (s) => Math.min(NBINS - 1, Math.max(0, Math.floor(((Math.log10(s) - U0) / (U1 - U0)) * NBINS)));

/* ------------------------------------------------------------ geometry */
const RIGHT = 20;
const shrinkageLayout = (w) => ({
  hist: { x0: 112, x1: w - RIGHT, top: 44, base: 244 },
  prot: { title: 292, key: 312, top: 322, base: 408 },
});
const testLayout = (w) => ({ x0: 64, x1: w - RIGHT, top: 52, base: 420 });
const histX = (L, u) => L.hist.x0 + ((u - U0) / (U1 - U0)) * (L.hist.x1 - L.hist.x0);

/* ------------------------------------------------------------ the press clock (78's) */
const stagesOf = (page) => (page === "shrinkage" ? 3 : 0);
function settle(anim, page) {
  const max = stagesOf(page), n = anim.n[page] ?? 0;
  anim.inert = max === 0;                 // core takes Step out of the row on Test
  anim.done = n >= max && anim.p >= 1;
  anim.labelAt = anim.done ? "done" : `${page[0]}${n}`;
}
function stageOf(params, anim) {
  if (!anim) return { s: Math.min(3, Number(params.shown) || 0), e: 1 };
  const s = anim.n.shrinkage ?? 0;
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

/* ------------------------------------------------------------ the Shrinkage page */
function drawShrinkage(ctx, colors, w, params, state, anim) {
  const L = shrinkageLayout(w), H = L.hist;
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
    txt(ctx, colors, `prior: s0 = ${f3(state.s0)}, d0 = ${state.d0.toFixed(1)}`, sx(state.s0) + away, H.top + 10, { size: "fsXs", colour: colors.prior, weight: "600", align: away < 0 ? "right" : "left" });
  }
  // stage 3: every SD moves to its shrunk value; the outline is the moving histogram
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
    if (s >= 3) txt(ctx, colors, "shrunk SD", H.x0 + 8, H.top + 24, { size: "fsXs", colour: colors.posterior, weight: "600" });
  }

  /* the protein walked through: its likelihood, the prior and their product,
     the posterior, on the histogram's own log-SD axis (his round 2: arm C of
     `_lab/limma-shrinkage-mock.html`, 78's right-hand panel). Over ln σ² each
     is a scaled inverse χ² and peaks at its scale, so the likelihood peaks at
     the protein's own SD, the prior at s0, and the posterior — the product,
     with d + d0 degrees of freedom — at the moderated SD, exactly. */
  const R = L.prot;
  txt(ctx, colors, mk.title, 12, R.title, { colour: colors.ink1, weight: "600" });
  for (const t of SD_TICKS) { rule(ctx, sx(t), R.base, sx(t), R.base + 4, colors.axis); txt(ctx, colors, String(t), sx(t), R.base + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  rule(ctx, H.x0, R.base, H.x1, R.base, colors.axis);
  txt(ctx, colors, "σ, the protein's true SD, log2 (log scale)", (H.x0 + H.x1) / 2, R.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  if (s < 1) return;
  const us = Array.from({ length: 240 }, (_, i) => U0 + (i / 239) * (U1 - U0));
  const cy = (v) => R.base - v * (R.base - R.top);
  const curve = (nu, tau, colour, width) => {
    const f = E.logSdCurve(nu, tau * tau);
    ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.beginPath();
    us.forEach((u, i) => { const px = histX(L, u), py = cy(f(u)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke(); ctx.restore();
    rule(ctx, sx(tau), R.top, sx(tau), R.base, colour, 1.2, [3, 3]);
  };
  const keys = [[`likelihood ${f3(own)} · ${state.df} df`, colors.empirical]];
  curve(state.df, own, colors.empirical, 2);
  if (s >= 2) { curve(state.d0, state.s0, colors.prior, 2); keys.push([`× prior ${f3(state.s0)} · ${state.d0.toFixed(1)} df`, colors.prior]); }
  if (s >= 3) {
    // the posterior leaves from where the likelihood is and lands at the shrunk SD
    const k = s === 3 ? e : 1;
    curve(state.df + k * state.d0, own ** (1 - k) * mod ** k, colors.posterior, 2.5);
    keys.push([`= posterior ${f3(mod)} · ${(state.df + state.d0).toFixed(1)} df`, colors.posterior]);
  }
  if (params.truth === "on") {
    const tsd = Math.sqrt(state.sim.meta[mk.id].sigma2);
    rule(ctx, sx(tsd), R.top - 4, sx(tsd), R.base, colors.reference, 1.5, [2, 4]);
    keys.push([`true SD ${f3(tsd)}`, colors.reference]);
  }
  let kx = 12;
  for (const [t, c] of keys) {
    txt(ctx, colors, t, kx, R.key, { size: "fsXs", colour: c, weight: "600" });
    kx += ctx.measureText(t).width + 14;
  }
}

/* ------------------------------------------------------------ the formula card */
/* MathML above the figure, one equation per stage, as 78's (his round 1,
   2026-10-07: "use mathml for equations"). Symbols only; the protein's numbers
   are in the readout. */
const MATHML = mathmlRenders();
const BAR = (v, sub) => `<msub><mover><mi>${v}</mi><mo>¯</mo></mover><mtext>${sub}</mtext></msub>`;
const SQ = (inner) => `<msup><mrow><mo>(</mo>${inner}<mo>)</mo></mrow><mn>2</mn></msup>`;
const ROOT = "<msqrt><mfrac><mn>1</mn><mi>n</mi></mfrac><mo>+</mo><mfrac><mn>1</mn><mi>n</mi></mfrac></msqrt>";
const S0SQ = "<msubsup><mi>s</mi><mn>0</mn><mn>2</mn></msubsup>", D0 = "<msub><mi>d</mi><mn>0</mn></msub>";
const STILDE = "<mover><mi>s</mi><mo>~</mo></mover>";
const FORMULAS = {
  shrinkage1: {
    math: `<math><mrow><msup><mi>s</mi><mn>2</mn></msup><mo>=</mo><mfrac><mrow><munder><mo>∑</mo><mtext>cancer</mtext></munder>${SQ(`<mi>y</mi><mo>−</mo>${BAR("y", "c")}`)}<mo>+</mo><munder><mo>∑</mo><mtext>healthy</mtext></munder>${SQ(`<mi>y</mi><mo>−</mo>${BAR("y", "h")}`)}</mrow><mi>d</mi></mfrac><mo>,</mo><mspace width="0.8em"></mspace><mi>d</mi><mo>=</mo><mn>2</mn><mi>n</mi><mo>−</mo><mn>2</mn></mrow></math>`,
    plain: "s² = [ Σ_cancer (y − ȳc)² + Σ_healthy (y − ȳh)² ] / d,   d = 2n − 2",
    note: "each protein's variance from its own replicates, pooled over the two groups: y is a log2 abundance, n the replicates in each group, d the degrees of freedom",
  },
  shrinkage2: {
    math: `<math><mrow><mfrac><mn>1</mn><msup><mi>σ</mi><mn>2</mn></msup></mfrac><mo>∼</mo><mfrac><msubsup><mi>χ</mi><msub><mi>d</mi><mn>0</mn></msub><mn>2</mn></msubsup><mrow>${D0}${S0SQ}</mrow></mfrac></mrow></math>`,
    plain: "1/σ² ~ χ²(d0) / (d0 s0²)",
    note: "the prior: across proteins the true variances σ² scatter around s0², more tightly the larger d0; s0 and d0 are estimated from all proteins' s² together (empirical Bayes)",
  },
  shrinkage3: {
    math: `<math><mrow><msup>${STILDE}<mn>2</mn></msup><mo>=</mo><mfrac><mrow>${D0}${S0SQ}<mo>+</mo><mi>d</mi><msup><mi>s</mi><mn>2</mn></msup></mrow><mrow>${D0}<mo>+</mo><mi>d</mi></mrow></mfrac></mrow></math>`,
    plain: "s̃² = (d0 s0² + d s²) / (d0 + d)",
    note: "the shrunk variance: the prior's and the protein's own, averaged with their degrees of freedom as weights, and the peak of the posterior, likelihood × prior; with few replicates d is small and the prior has more weight",
  },
  ordinary: {
    math: `<math><mrow><mi>t</mi><mo>=</mo><mfrac><mrow>${BAR("y", "c")}<mo>−</mo>${BAR("y", "h")}</mrow><mrow><mi>s</mi>${ROOT}</mrow></mfrac><mo>,</mo><mspace width="0.8em"></mspace><mi>d</mi><mtext> degrees of freedom</mtext></mrow></math>`,
    plain: "t = (ȳc − ȳh) / ( s √(1/n + 1/n) ),   d degrees of freedom",
    note: "ȳ is a group's mean log2 abundance, so the numerator is the log2 fold change; s is the protein's own SD",
  },
  moderated: {
    math: `<math><mrow><mover><mi>t</mi><mo>~</mo></mover><mo>=</mo><mfrac><mrow>${BAR("y", "c")}<mo>−</mo>${BAR("y", "h")}</mrow><mrow>${STILDE}${ROOT}</mrow></mfrac><mo>,</mo><mspace width="0.8em"></mspace><mi>d</mi><mo>+</mo>${D0}<mtext> degrees of freedom</mtext></mrow></math>`,
    plain: "t̃ = (ȳc − ȳh) / ( s̃ √(1/n + 1/n) ),   d + d0 degrees of freedom",
    note: "the same numerator, the log2 fold change; the denominator has the shrunk SD, and the t has d + d0 degrees of freedom; limma calls this t moderated",
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
  return { id, title: `${ex ? `${ex.label}, protein` : "Protein"} ${id + 1}${truth}` };
}

/* ------------------------------------------------------------ the widget */
defineWidget({
  slug: "limma",
  title: "Proteomics: Differential Expression",
  subtitle:
    "Protein abundances are compared on the log2 scale with one t-test per protein. With few replicates each protein's "
    + "variance estimate is imprecise, so limma shrinks it toward a prior variance fitted across all proteins by empirical "
    + "Bayes and tests with a moderated t-statistic. The log2 fold change is not shrunk.",
  layout: "side",
  status: "draft",
  height: (p) => (p.page === "test" ? H_TEST : H_SHRINKAGE),

  params: {
    page: {
      role: "page", type: "segmented", label: "Step", display: true, default: "shrinkage",
      options: [{ value: "shrinkage", label: "Shrinkage" }, { value: "test", label: "Test" }],
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
      detail: "the t's denominator: the protein's own SD, or its shrunk SD",
      options: [{ value: "ordinary", label: "Ordinary t" }, { value: "moderated", label: "Moderated t" }],
    },
    showSec: { type: "section", label: "Show" },
    protein: {
      type: "select", label: "Example protein", display: true, default: "small-sd-by-chance",
      detail: "a click on a bar of the histogram selects its middle protein; a click on a point of the volcano selects that protein",
      options: [...EXAMPLES, ...PROTEIN_OPTIONS],
    },
    truth: {
      type: "segmented", label: "True values", display: true, default: "off",
      detail: "each protein's true SD and whether it truly differs: known in a simulation, unknown in a measured data set",
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }],
    },
    /* authoring escape hatch, first render only: the Shrinkage page's stage */
    shown: { type: "int", min: 0, max: 3, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "test"
    ? [
      { token: "extreme", label: "Significant: adjusted p < 0.05 (Benjamini–Hochberg)", mark: "dot" },
      { token: "highlight", label: "The example protein", mark: "ring" },
      ...(params.truth === "on" ? [{ token: "reference", label: "A protein that truly differs", mark: "ring" }] : []),
    ]
    : [
      { token: "empirical", label: "A protein's own SD, from its replicates; below, the example protein's likelihood", mark: "bar" },
      { token: "prior", label: "The prior fitted across all proteins: the distribution of own SDs it implies, and s0", mark: "line" },
      { token: "posterior", label: "The shrunk SD; below, the posterior, likelihood × prior", mark: "line" },
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
      calls, yMaxLog, pTicks, examples: E.pickExamples(sim, fitted), medianOwn: ownSd.slice().sort((a, b) => a - b)[Math.floor(P / 2)],
      trulyDiffer: sim.meta.filter((m) => m.de).length,
    };
  },

  /* Step alone, on the Shrinkage page: three presses that are read. The Test
     page has nothing to step (`inert`). A Statistic change asks core for an
     ease; a change flipped back mid-ease starts from where the picture is. */
  animation: {
    stepLabel: { anim: "labelAt", labels: { s0: "Compute SDs", s1: "Fit the prior", s2: "Shrink", done: "Shrink" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      s0: "Compute each protein's SD from its own replicates",
      s1: "Fit a prior to every protein's SD: its SD, s0, and its degrees of freedom, d0",
      s2: "Shrink each protein's SD toward s0: the average of its own and the prior's, with their degrees of freedom as weights",
      done: "Every step of this page has been taken",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: { shrinkage: 0, test: 0 }, p: 1, st: { from: params.stat, to: params.stat, t: 1 }, easing: false };
      if (!fromScratch) anim.n.shrinkage = Math.min(3, Math.max(0, Number(params.shown) || 0));
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
    const s = anim ? anim.n.shrinkage : Number(params.shown) || 0;
    if (s < 1) return [];
    const L = shrinkageLayout(w), H = L.hist, bw = (H.x1 - H.x0) / NBINS;
    const byBin = new Map();
    state.ownSd.forEach((sd, i) => { const k = binOf(sd); if (k >= 0 && k < NBINS) { if (!byBin.has(k)) byBin.set(k, []); byBin.get(k).push(i); } });
    return [...byBin.entries()].map(([k, ids]) => {
      ids.sort((a, b) => state.ownSd[a] - state.ownSd[b]);
      const id = ids[ids.length >> 1];
      return { x: H.x0 + k * bw, y: H.top, w: bw, h: H.base - H.top, set: { protein: `protein-${id + 1}` }, label: `Protein ${id + 1}` };
    });
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    renderFormula(params.page === "test" ? params.stat : `shrinkage${Math.max(1, stageOf(params, anim).s)}`);
    if (params.page === "test") drawTest(ctx, colors, w, params, state, anim);
    else drawShrinkage(ctx, colors, w, params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    const truth = params.truth === "on";
    const mk = resolveMarked(params, state), x = state.fit.fits[mk.id];
    if (params.page === "test") {
      const line = (stat, df) => {
        const c = state.calls[stat];
        return { label: `Significant, ${STATS[stat].toLowerCase()}`, value: `${n0(c.called)} of ${n0(P)}`,
          note: truth ? `${n0(c.tp)} true positive${c.tp === 1 ? "" : "s"}, ${n0(c.fp)} false positive${c.fp === 1 ? "" : "s"}; ${n0(state.trulyDiffer)} truly differ` : `adjusted p < 0.05, ${df} df` };
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
      { label: "Each protein's own SD", value: s >= 1 ? `median ${f3(state.medianOwn)}` : "–", note: `from ${state.n} + ${state.n} values: ${state.df} degrees of freedom` },
      { label: "The prior, across all proteins", value: s >= 2 ? `s0 ${f3(state.s0)}, d0 ${state.d0.toFixed(1)}` : "–", note: "the prior's SD, s0, and its degrees of freedom, d0" },
      { label: `Protein ${mk.id + 1}'s SD`, value: s >= 3 ? `${f3(own)} → ${f3(mod)}` : s >= 1 ? f3(own) : "–", note: s >= 3 ? `weights ${state.df} : ${state.d0.toFixed(1)}${tsd}` : `own SD, then shrunk SD${tsd}` },
    ];
  },
});
