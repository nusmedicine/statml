/* deseq2 — Bulk RNA-seq: Differential Expression (PHM5003 08 / 01-2 cells 1,
 * 22, 24, 35–45)
 *
 * THE MISCONCEPTION: with three replicates a gene's own dispersion estimate is
 * a measurement, and a fold change read at a low count means what it says.
 * Neither holds. A count's variance across replicates is mu + alpha·mu², not
 * mu; with few replicates alpha estimated gene by gene is noise, so DESeq2
 * fits a trend through all genes and pulls each gene's estimate toward it
 * (the prior times the likelihood, the MAP as the posterior's mode) — measured
 * here as the realised false discovery rate at padj < 0.1, 39% with the
 * gene-wise dispersion and 17% shrunk at three replicates. The same argument
 * shrinks the log2 fold change, which removes the funnel at low counts and
 * costs some true effects there. And the vst is what the trend implies for a
 * transform whose variance no longer grows with the mean.
 *
 * FOUR PAGES in the notebook's order (his pick at planning, 2026-09-21):
 * Model · Dispersion · Transform · Test. One simulated stage — 1,200 genes, a
 * tenth changed, the replicates the reader's — analysed by the widget's own
 * engine (`./engine.js`), which `_lab/deseq2-measure.mjs` measured first and
 * `_lab/deseq2-mock.html` drew; his six picks from the mock (2026-09-22) are
 * the shape here: the Dispersion page is the exposition's own figure (60
 * genes, an arrow from each gene's estimate to its shrunk one), the MA plot
 * before and after LFC shrinkage side by side, both Model panels, replicates
 * and a seed as the shared data control, a fixed changed gene as the Test
 * page's example.
 */
import { defineWidget, fmt, mathmlRenders } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { simulate, analyse, nbDraw, nbPmf, poissonPmf, log2, median } from "./engine.js";

const GENES = 1200;
const REPS = ["2", "3", "4", "6"];
const MUS = ["10", "100", "1000"];
const ALPHAS = ["0.01", "0.05", "0.5"];
const SHOWN_GENES = 60;
const PAGES = [
  { value: "model", label: "Model" },
  { value: "dispersion", label: "Dispersion" },
  { value: "transform", label: "Transform" },
  { value: "test", label: "Test" },
];
const ON = (page) => ({ param: "page", equals: page });
const HEIGHTS = { model: 300, dispersion: 330, transform: 300, test: 500 };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const log10 = (x) => Math.log10(x);
const sci = (p) => (p < 1e-4 ? p.toExponential(1) : fmt(p, 4));

/* --- the formula card, one line per page ------------------------------------ */
const MATHML = mathmlRenders();
const FORMULAS = {
  model: { math: "<math><mrow><mi>Var</mi><mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo><mi>μ</mi><mo>+</mo><mi>α</mi><msup><mi>μ</mi><mn>2</mn></msup></mrow></math>", plain: "Var(y) = μ + α μ²", note: "a count's variance across replicates: Poisson's μ, and α μ² beyond it" },
  dispersion: { math: "<math><mrow><msub><mi>α</mi><mi>MAP</mi></msub><mo>=</mo><mi>argmax</mi><mo>[</mo><mi>log</mi><mi>L</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>+</mo><mi>log</mi><mi>prior</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>]</mo></mrow></math>", plain: "α_MAP = argmax [ log L(α) + log prior(α) ]", note: "the prior is log-normal around the trend fitted through all genes; the posterior's mode is the shrunk estimate" },
  transform: { math: "<math><mrow><mi>vst</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><msub><mi>log</mi><mn>2</mn></msub><mfrac><mrow><mn>1</mn><mo>+</mo><msub><mi>a</mi><mn>1</mn></msub><mo>+</mo><mn>2</mn><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>+</mo><mn>2</mn><msqrt><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>(</mo><mn>1</mn><mo>+</mo><msub><mi>a</mi><mn>1</mn></msub><mo>+</mo><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>)</mo></msqrt></mrow><mrow><mn>4</mn><msub><mi>a</mi><mn>0</mn></msub></mrow></mfrac></mrow></math>", plain: "vst(x) = log2 [ (1 + a1 + 2 a0 x + 2 √(a0 x (1 + a1 + a0 x))) / (4 a0) ]", note: "the closed form for a trend α = a0 + a1 / μ: a transform whose variance is constant across the mean" },
  test: { math: "<math><mrow><mi>log</mi><msub><mi>μ</mi><mi>ij</mi></msub><mo>=</mo><msub><mi>β</mi><mn>0</mn></msub><mo>+</mo><msub><mi>β</mi><mn>1</mn></msub><msub><mi>x</mi><mi>j</mi></msub><mo>,</mo><mspace width=\"0.8em\"></mspace><mi>W</mi><mo>=</mo><mfrac><msub><mi>β</mi><mn>1</mn></msub><mrow><mi>SE</mi><mo>(</mo><msub><mi>β</mi><mn>1</mn></msub><mo>)</mo></mrow></mfrac></mrow></math>", plain: "log μ_ij = β0 + β1 x_j,   W = β1 / SE(β1)", note: "x_j is 0 in group A and 1 in group B, so β1 is the log fold change; W is compared with a standard normal" },
};
let mathHost = null, mathKey = null;
function renderFormula(page) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === page) return;
  mathKey = page;
  const F = FORMULAS[page];
  mathHost.innerHTML = `<div class="w-math-eq"><span style="color:var(--ink-2)">${MATHML ? F.math : F.plain}</span></div><div class="w-math-note">${F.note}</div>`;
}

/* --- a small plot frame: log or linear axes, ticks named --------------------- */
function frame(ctx, colors, { x0, y0, x1, y1 }, xd, yd, { xlog = true, ylog = true, xlabel = "", ylabel = "", xt = [], yt = [], xfmt = String, yfmt = String } = {}) {
  const sx = (v) => x0 + (((xlog ? log10(v) : v) - xd[0]) / (xd[1] - xd[0])) * (x1 - x0);
  const sy = (v) => y1 - (((ylog ? log10(v) : v) - yd[0]) / (yd[1] - yd[0])) * (y1 - y0);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3;
  for (const t of xt) { const x = Math.round(sx(t)) + 0.5; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText(xfmt(t), x, y1 + 13); }
  for (const t of yt) { const y = Math.round(sy(t)) + 0.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(yfmt(t), x0 - 5, y + 4); }
  ctx.strokeStyle = colors.ink3; ctx.beginPath(); ctx.moveTo(x0, Math.round(y1) + 0.5); ctx.lineTo(x1, Math.round(y1) + 0.5); ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  if (xlabel) { ctx.textAlign = "center"; ctx.fillText(xlabel, (x0 + x1) / 2, y1 + 26); }
  if (ylabel) { ctx.textAlign = "left"; ctx.fillText(ylabel, x0, y0 - 6); }
  ctx.restore();
  return { sx, sy, x0, y0, x1, y1 };
}
const dot = (ctx, x, y, r, color, alpha = 1) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
const label = (ctx, colors, s, x, y, { color = colors.ink2, align = "left", weight = "" } = {}) => { ctx.save(); ctx.textBaseline = "alphabetic"; ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${colors.fsXs} ${colors.font}`.trim(); ctx.fillText(s, x, y); ctx.restore(); };
const curve = (ctx, color, width, pts) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); };
const bigNum = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

defineWidget({
  slug: "deseq2",
  title: "Bulk RNA-seq: Differential Expression",
  subtitle:
    "A count varies across replicates by more than Poisson allows, and with few "
    + "replicates a gene's own estimate of that extra variance is noise. A trend "
    + "fitted through all genes is the prior; each gene's estimate is pulled toward "
    + "it; the fold change is tested against the pulled estimate, and shrunk the "
    + "same way where the counts are low.",
  layout: "side",
  status: "draft",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.model,

  params: {
    page: { type: "segmented", label: "Page", options: PAGES, default: "model", display: true },

    dataSec: { type: "section", label: "The data" },
    reps: {
      type: "choice", label: "Replicates in each group",
      detail: "1,200 genes, a tenth of them changed between the groups",
      options: REPS.map((r) => ({ value: r, label: r })), default: "3",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    modelSec: { type: "section", label: "One gene", when: ON("model") },
    mu: {
      type: "choice", label: "Mean count", detail: "the gene's expected count in every replicate",
      options: MUS.map((m) => ({ value: m, label: bigNum(Number(m)) })), default: "100", when: ON("model"),
    },
    alpha: {
      type: "choice", label: "Dispersion α", detail: "the variance beyond Poisson, as a share of the mean squared",
      options: ALPHAS.map((a) => ({ value: a, label: a })), default: "0.05", when: ON("model"),
    },

    dispSec: { type: "section", label: "The estimate", when: ON("dispersion") },
    shrinkDisp: {
      type: "bool", label: "Shrink toward the trend", detail: "each gene's estimate pulled to the trend through all genes",
      default: false, display: true, when: ON("dispersion"),
    },

    transSec: { type: "section", label: "The transform", when: ON("transform") },
    unit: {
      type: "segmented", label: "Values",
      options: [{ value: "raw", label: "Counts" }, { value: "log2", label: "log2(x + 1)" }, { value: "vst", label: "vst" }],
      default: "raw", display: true, when: ON("transform"),
    },

    testSec: { type: "section", label: "The fold change", when: ON("test") },
    shrinkLfc: {
      type: "bool", label: "Shrink the fold changes", detail: "a spike at zero and a normal as the prior over all genes",
      default: false, display: true, when: ON("test"),
    },
  },

  legend: ({ params }) => {
    const p = params.page;
    if (p === "model") return [
      { token: "empirical", label: "A replicate's count; a gene", mark: "bar" },
      { token: "highlight", label: "A gene that changed", mark: "bar" },
      { token: "reference", label: "Poisson: variance = mean", mark: "line" },
      { token: "theory", label: "Negative binomial: mean + α·mean²", mark: "line" },
    ];
    if (p === "dispersion") return [
      { token: "empirical", label: "A gene's own estimate", mark: "bar" },
      { token: "theory", label: "The trend through all genes: the prior", mark: "line" },
      { token: "highlight", label: "The shrunk estimate; ringed, left on its own", mark: "bar" },
    ];
    if (p === "transform") return [
      { token: "empirical", label: "An unchanged gene: SD across its replicates", mark: "bar" },
      { token: "theory", label: "Median SD in a bin of means", mark: "line" },
    ];
    return [
      { token: "empirical", label: "A replicate's count; a gene", mark: "bar" },
      { token: "theory", label: "A group's mean: the GLM's coefficient", mark: "line" },
      { token: "highlight", label: "β, the log2 fold change, and its SE", mark: "line" },
      { token: "extreme", label: "padj < 0.1", mark: "bar" },
    ];
  },

  /* Pure and seeded. The engine's simulation and its analysis are one call;
     the one gene of the Model page draws from a second generator forked off
     the first, so its mean and α leave the 1,200 genes where they are. */
  compute: ({ params, rng }) => {
    const reps = Number(params.reps);
    const simRng = makeRng(Math.floor(rng.next() * 2 ** 31)), geneRng = makeRng(Math.floor(rng.next() * 2 ** 31));
    const sim = simulate(simRng, { genes: GENES, reps });
    const an = analyse(sim);
    const nullG = an.expressed.filter((g) => !sim.isDE[g]), deG = an.expressed.filter((g) => sim.isDE[g]);
    /* the one gene */
    const mu = Number(params.mu), alpha = Number(params.alpha);
    const draws = Array.from({ length: 2 * reps }, () => nbDraw(geneRng, mu, alpha));
    /* the 60 genes the Dispersion page draws: spread evenly over the means */
    const byMean = an.expressed.slice().sort((a, b) => an.baseMean[a] - an.baseMean[b]).filter((g) => an.baseMean[g] >= 2);
    const shown = Array.from({ length: SHOWN_GENES }, (_, k) => byMean[Math.floor(((k + 0.5) / SHOWN_GENES) * byMean.length)]);
    /* the Test page's gene: a changed gene near a mean of 100, well found */
    const cands = deG.filter((g) => an.baseMean[g] > 60 && an.baseMean[g] < 200).sort((a, b) => an.resMAP[a].p - an.resMAP[b].p);
    const ex = cands[Math.min(2, cands.length - 1)] ?? deG.sort((a, b) => an.resMAP[a].p - an.resMAP[b].p)[0];
    /* the numbers the pages print */
    const called = (res) => ({ nulls: nullG.filter((g) => res[g].padj < 0.1).length, de: deG.filter((g) => res[g].padj < 0.1).length });
    const lowNull = nullG.filter((g) => an.baseMean[g] < 10), deBig = deG.filter((g) => Math.abs(sim.lfcT[g]) > 1);
    const over1 = (lfcOf, gs) => gs.filter((g) => Math.abs(lfcOf(g)) > 1).length;
    const bins = [[1, 5], [5, 20], [20, 100], [100, 1000], [1000, 1e9]];
    const sdBins = bins.map(([a, b]) => {
      const gs = nullG.filter((g) => an.baseMean[g] >= a && an.baseMean[g] < b);
      const norm = gs.map((g) => sim.counts[g].map((v, j) => v / an.sf[j]));
      const s = (fn) => (norm.length ? median(norm.map((row) => sd(row.map(fn)))) : NaN);
      return { a, b, n: gs.length, raw: s((v) => v), log2: s((v) => log2(v + 1)), vst: s(an.vst) };
    });
    return {
      sim, an, nullG, deG, reps, mu, alpha, draws, shown, ex,
      calledGW: called(an.resGW), calledMAP: called(an.resMAP),
      funnel: { lowNull: lowNull.length, before: over1((g) => an.resMAP[g].lfc, lowNull), after: over1((g) => an.shrunk[g], lowNull) },
      cost: { deBig: deBig.length, before: over1((g) => an.resMAP[g].lfc, deBig), after: over1((g) => an.shrunk[g], deBig) },
      sdBins,
    };
  },

  draw: ({ ctx, colors, w, params, state }) => {
    renderFormula(params.page);
    if (params.page === "model") drawModel(ctx, colors, w, state);
    else if (params.page === "dispersion") drawDispersion(ctx, colors, w, params, state);
    else if (params.page === "transform") drawTransform(ctx, colors, w, params, state);
    else drawTest(ctx, colors, w, params, state);
  },

  readout: ({ params, state }) => {
    const { an, ex, mu, alpha } = state;
    if (params.page === "model") return [
      { label: `SD of the gene's count, Poisson`, value: fmt(Math.sqrt(mu), 1), note: `√μ at μ = ${mu}` },
      { label: `SD, negative binomial`, value: fmt(Math.sqrt(mu + alpha * mu * mu), 1), note: `√(μ + αμ²) at α = ${alpha}; the ${state.draws.length} replicates drawn have SD ${fmt(sd(state.draws), 1)}` },
    ];
    if (params.page === "dispersion") return [
      { label: "Unchanged genes called at padj < 0.1, gene-wise dispersion", value: String(state.calledGW.nulls), note: `of ${state.nullG.length}; ${state.calledGW.de} of ${state.deG.length} changed genes found` },
      { label: "Shrunk dispersion", value: params.shrinkDisp ? String(state.calledMAP.nulls) : "—", note: params.shrinkDisp ? `of ${state.nullG.length}; ${state.calledMAP.de} of ${state.deG.length} changed genes found; trend α = ${fmt(an.trend.a0, 3)} + ${fmt(an.trend.a1, 2)} / mean, prior SD ${fmt(Math.sqrt(an.prior.priorVar), 2)}` : "shrink toward the trend to read it" },
    ];
    if (params.page === "transform") {
      const lo = state.sdBins[1], hi = state.sdBins[3], u = params.unit;
      return [
        { label: `SD across replicates, means 5–20`, value: fmt(lo[u], u === "raw" ? 1 : 2), note: `median over ${lo.n} unchanged genes` },
        { label: `SD across replicates, means 100–1,000`, value: fmt(hi[u], u === "raw" ? 1 : 2), note: `median over ${hi.n} unchanged genes${u === "vst" ? "; the same SD at every mean is what the transform is for" : u === "log2" ? "; the log still spreads the low counts" : "; the SD grows with the mean"}` },
      ];
    }
    const r = an.resMAP[ex];
    return [
      { label: "β: the log2 fold change of the gene", value: fmt(r.lfc, 2), note: `true ${fmt(state.sim.lfcT[ex], 2)}; SE ${fmt(r.se, 2)}, W = ${fmt(r.W, 2)}, p = ${sci(r.p)}, padj = ${sci(r.padj)}${params.shrinkLfc ? `; shrunk to ${fmt(an.shrunk[ex], 2)}` : ""}` },
      { label: "Unchanged genes under a mean of 10 read at |LFC| > 1", value: params.shrinkLfc ? `${state.funnel.before} → ${state.funnel.after}` : String(state.funnel.before), note: `of ${state.funnel.lowNull}${params.shrinkLfc ? `; changed genes with a true |LFC| > 1 still read so: ${state.cost.before} → ${state.cost.after} of ${state.cost.deBig}` : ""}` },
    ];
  },
});

/* --- Model: one gene's two distributions; every gene's variance against its mean --- */
function drawModel(ctx, colors, w, state) {
  const { mu, alpha, draws, an, sim } = state;
  const H = HEIGHTS.model, half = Math.floor(w / 2);
  /* left: the two pmfs and the replicate counts */
  {
    const kmax = Math.ceil(mu + 4 * Math.sqrt(mu + alpha * mu * mu));
    const P = [], N = []; let pm = 0;
    for (let k = 0; k <= kmax; k += 1) { P.push(poissonPmf(k, mu)); N.push(nbPmf(k, mu, alpha)); pm = Math.max(pm, P[k], N[k]); }
    const step = Math.max(1, Math.round(kmax / 4 / (10 ** Math.floor(log10(kmax / 4))))) * 10 ** Math.floor(log10(kmax / 4));
    const xt = []; for (let t = 0; t <= kmax; t += step) xt.push(t);
    const F = frame(ctx, colors, { x0: 40, y0: 30, x1: half - 16, y1: H - 40 }, [0, kmax], [0, pm * 1.08], { xlog: false, ylog: false, xlabel: "count", ylabel: `one gene at mean ${mu}: probability of each count`, xt, xfmt: bigNum });
    curve(ctx, colors.reference, 1.5, P.map((p, k) => [F.sx(k), F.sy(p)]));
    curve(ctx, colors.theory, 2, N.map((p, k) => [F.sx(k), F.sy(p)]));
    ctx.save(); ctx.strokeStyle = colors.empirical; ctx.lineWidth = 2;
    for (const c of draws) { ctx.beginPath(); ctx.moveTo(F.sx(Math.min(c, kmax)), F.sy(0)); ctx.lineTo(F.sx(Math.min(c, kmax)), F.sy(0) - 14); ctx.stroke(); }
    ctx.restore();
    label(ctx, colors, `${draws.length} replicates: ${draws.join(" ")}`, F.x0 + 4, F.y0 + 12, { color: colors.empirical });
  }
  /* right: variance against mean, all genes */
  {
    const F = frame(ctx, colors, { x0: half + 44, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4.3], [0, 7.3], { xlabel: "mean of normalised counts", ylabel: "1,200 genes: variance across replicates", xt: [1, 10, 100, 1000, 10000], yt: [1, 100, 10000, 1000000], xfmt: bigNum, yfmt: (v) => `1e${log10(v)}` });
    for (const g of an.expressed) { const v = sd(sim.counts[g].map((x, j) => x / an.sf[j])) ** 2; if (v > 0 && an.baseMean[g] >= 1) dot(ctx, F.sx(an.baseMean[g]), F.sy(Math.min(2e7, v)), 1.6, sim.isDE[g] ? colors.highlight : colors.empirical, 0.45); }
    curve(ctx, colors.reference, 1.5, [[F.sx(1), F.sy(1)], [F.sx(20000), F.sy(20000)]]);
    const pts = []; for (let e = 0; e <= 4.3; e += 0.05) { const m = 10 ** e; pts.push([F.sx(m), F.sy(m + an.trend.a0 * m * m)]); }
    curve(ctx, colors.theory, 2, pts);
    /* the two names at the right edge, one row each, clear of the lines (the sweep found them on each other at a small trend) */
    label(ctx, colors, `mean + ${fmt(an.trend.a0, 3)}·mean²`, F.x1 - 4, F.y0 + 12, { color: colors.theory, align: "right" });
    label(ctx, colors, "Poisson: mean", F.x1 - 4, F.sy(20000) + 14, { color: colors.reference, align: "right" });
  }
}

/* --- Dispersion: 60 genes, each pulled toward the trend ---------------------------- */
function drawDispersion(ctx, colors, w, params, state) {
  const { an, shown } = state;
  const H = HEIGHTS.dispersion;
  const F = frame(ctx, colors, { x0: 50, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4.3], [-3.2, 1.3], { xlabel: "mean of normalised counts", ylabel: `${SHOWN_GENES} of the 1,200 genes: dispersion α`, xt: [1, 10, 100, 1000, 10000], yt: [0.001, 0.01, 0.1, 1, 10], xfmt: bigNum });
  const yc = (a) => F.sy(Math.min(20, Math.max(0.0006, a)));
  const pts = []; for (let e = 0; e <= 4.3; e += 0.05) { const m = 10 ** e; pts.push([F.sx(m), yc(an.trend.a0 + an.trend.a1 / m)]); }
  curve(ctx, colors.theory, 2, pts);
  for (const g of shown) {
    const x = F.sx(Math.max(1, an.baseMean[g]));
    if (params.shrinkDisp) {
      ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(x, yc(an.alphaGW[g])); ctx.lineTo(x, yc(an.alphaMAP[g])); ctx.stroke(); ctx.restore();
      dot(ctx, x, yc(an.alphaMAP[g]), 3, colors.highlight);
      if (an.outlier[g]) { ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, yc(an.alphaGW[g]), 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
    dot(ctx, x, yc(an.alphaGW[g]), 3, colors.empirical);
  }
  label(ctx, colors, `trend: α = ${fmt(an.trend.a0, 3)} + ${fmt(an.trend.a1, 2)} / mean`, F.x1 - 6, yc(an.trend.a0) - 8, { color: colors.theory, align: "right" });
  label(ctx, colors, params.shrinkDisp ? `prior SD ${fmt(Math.sqrt(an.prior.priorVar), 2)} in log α; a gene more than two residual SDs above the trend keeps its own` : "each gene's own estimate, from its replicates alone", F.x0 + 4, F.y0 + 12, { color: colors.ink3 });
}

/* --- Transform: SD against mean under the chosen values; the transform as a curve --- */
function drawTransform(ctx, colors, w, params, state) {
  const { an, sim, nullG, sdBins } = state;
  const H = HEIGHTS.transform, half = Math.floor(w / 2), u = params.unit;
  const fn = u === "raw" ? (v) => v : u === "log2" ? (v) => log2(v + 1) : an.vst;
  {
    const F = u === "raw"
      ? frame(ctx, colors, { x0: 50, y0: 30, x1: half - 16, y1: H - 40 }, [0, 4.3], [-0.3, 3.3], { xlabel: "mean of normalised counts", ylabel: "unchanged genes: SD across replicates", xt: [1, 10, 100, 1000, 10000], yt: [1, 10, 100, 1000], xfmt: bigNum })
      : frame(ctx, colors, { x0: 50, y0: 30, x1: half - 16, y1: H - 40 }, [0, 4.3], [0, 1.6], { ylog: false, xlabel: "mean of normalised counts", ylabel: "unchanged genes: SD across replicates", xt: [1, 10, 100, 1000, 10000], yt: [0, 0.5, 1, 1.5], xfmt: bigNum });
    for (const g of nullG) {
      const s = sd(sim.counts[g].map((v, j) => fn(v / an.sf[j])));
      if (!(s > 0) || an.baseMean[g] < 1) continue;
      dot(ctx, F.sx(an.baseMean[g]), F.sy(u === "raw" ? Math.min(2000, s) : Math.min(1.6, s)), 1.6, colors.empirical, 0.45);
    }
    /* the bin medians as short lines */
    for (const b of sdBins) {
      if (!Number.isFinite(b[u])) continue;
      const xa = F.sx(Math.max(1, b.a)), xb = F.sx(Math.min(20000, b.b));
      curve(ctx, colors.theory, 2.5, [[xa, F.sy(u === "raw" ? Math.min(2000, b[u]) : Math.min(1.6, b[u]))], [xb, F.sy(u === "raw" ? Math.min(2000, b[u]) : Math.min(1.6, b[u]))]]);
    }
  }
  {
    const F = u === "raw"
      ? frame(ctx, colors, { x0: half + 44, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4], [0, 10000], { ylog: false, xlabel: "normalised count", ylabel: "the value the count becomes", xt: [1, 10, 100, 1000, 10000], yt: [0, 5000, 10000], xfmt: bigNum, yfmt: bigNum })
      : frame(ctx, colors, { x0: half + 44, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4], [0, 14], { ylog: false, xlabel: "normalised count", ylabel: "the value the count becomes", xt: [1, 10, 100, 1000, 10000], yt: [0, 4, 8, 12], xfmt: bigNum });
    const pts = []; for (let e = 0; e <= 4; e += 0.05) { const x = 10 ** e; pts.push([F.sx(x), F.sy(fn(x))]); }
    if (u !== "raw") { const ref = []; for (let e = 0; e <= 4; e += 0.05) { const x = 10 ** e; ref.push([F.sx(x), F.sy(log2(x + 1))]); } curve(ctx, colors.reference, 1, ref); label(ctx, colors, "log2(x + 1)", F.sx(2), F.sy(log2(3)) + 14, { color: colors.reference }); }
    curve(ctx, colors.empirical, 2, pts);
    label(ctx, colors, u === "raw" ? "the count itself" : u === "log2" ? "log2(x + 1)" : `vst: ${fmt(an.vst(0), 2)} at zero, log2 above a hundred`, F.x0 + 4, F.y0 + 12, { color: colors.empirical });
  }
}

/* --- Test: one gene's fit; the MA plot, before and after LFC shrinkage --------------- */
function drawTest(ctx, colors, w, params, state) {
  const { an, sim, ex } = state;
  const r = an.resMAP[ex], fit = an.fits[ex], reps = state.reps;
  const TOP = 210, half = Math.floor(w / 2);
  {
    const norm = sim.counts[ex].map((v, j) => v / an.sf[j]);
    const vals = norm.map((v) => log2(Math.max(0.5, v)));
    const lo = Math.floor(Math.min(...vals)) - 1, hi = Math.ceil(Math.max(...vals)) + 1;
    const yt = []; for (let t = lo; t <= hi; t += 1) yt.push(t);
    const F = frame(ctx, colors, { x0: 44, y0: 30, x1: half - 16, y1: TOP - 30 }, [0, 1], [lo, hi], { xlog: false, ylog: false, ylabel: `one changed gene: counts ${sim.counts[ex].join(" ")}, after the size factors`, yt });
    const xg = [0.28, 0.72];
    label(ctx, colors, "group A", F.sx(xg[0]), F.y1 + 13, { align: "center", color: colors.ink3 });
    label(ctx, colors, "group B", F.sx(xg[1]), F.y1 + 13, { align: "center", color: colors.ink3 });
    norm.forEach((v, j) => dot(ctx, F.sx(xg[sim.grp[j]]) + ((j % reps) - (reps - 1) / 2) * 7, F.sy(log2(Math.max(0.5, v))), 3.5, colors.empirical));
    for (const k of [0, 1]) curve(ctx, colors.theory, 2, [[F.sx(xg[k]) - 24, F.sy(log2(fit.q[k]))], [F.sx(xg[k]) + 24, F.sy(log2(fit.q[k]))]]);
    const xm = F.sx(0.5);
    curve(ctx, colors.highlight, 1.5, [[xm, F.sy(log2(fit.q[0]))], [xm, F.sy(log2(fit.q[1]))]]);
    curve(ctx, colors.highlight, 4, [[xm + 8, F.sy(log2(fit.q[1]) - r.se)], [xm + 8, F.sy(log2(fit.q[1]) + r.se)]]);
    /* the fit's numbers, in the right half's top */
    const tx = half + 44, ty = 44;
    /* six short lines: the right half is 223px wide at the narrowest canvas */
    label(ctx, colors, `β = ${fmt(r.lfc, 2)}, the gap in log2`, tx, ty, { color: colors.highlight, weight: "600" });
    label(ctx, colors, `SE = ${fmt(r.se, 2)} at α = ${fmt(an.alphaMAP[ex], 3)}`, tx, ty + 16, { color: colors.ink2 });
    label(ctx, colors, `W = β / SE = ${fmt(r.W, 2)}`, tx, ty + 32, { color: colors.ink2 });
    label(ctx, colors, `p = ${sci(r.p)}, padj = ${sci(r.padj)}`, tx, ty + 48, { color: colors.ink2 });
    label(ctx, colors, `α: gene-wise ${fmt(an.alphaGW[ex], 3)}, trend ${fmt(an.alphaTr[ex], 3)}`, tx, ty + 64, { color: colors.ink3 });
    label(ctx, colors, params.shrinkLfc ? `shrunk β = ${fmt(an.shrunk[ex], 2)}, true ${fmt(sim.lfcT[ex], 2)}` : `true β = ${fmt(sim.lfcT[ex], 2)}`, tx, ty + 80, { color: colors.ink3 });
  }
  const ma = (rect, lfcOf, title) => {
    const F = frame(ctx, colors, rect, [0, 4.3], [-6, 6], { ylog: false, xlabel: "mean of normalised counts", ylabel: title, xt: [1, 10, 100, 1000, 10000], yt: [-4, -2, 0, 2, 4], xfmt: bigNum });
    curve(ctx, colors.reference, 1.5, [[F.sx(1), F.sy(0)], [F.sx(20000), F.sy(0)]]);
    for (const g of an.expressed) { const sig = an.resMAP[g].padj < 0.1; dot(ctx, F.sx(Math.max(1, an.baseMean[g])), F.sy(Math.max(-6, Math.min(6, lfcOf(g)))), 1.6, sig ? colors.extreme : colors.empirical, sig ? 0.9 : 0.4); }
    dot(ctx, F.sx(an.baseMean[ex]), F.sy(lfcOf(ex)), 5, colors.highlight);
    return F;
  };
  const y0 = TOP + 10, y1 = HEIGHTS.test - 40;
  ma({ x0: 44, y0, x1: half - 16, y1 }, (g) => an.resMAP[g].lfc, "1,200 genes: log2 fold change against mean");
  if (params.shrinkLfc) {
    /* what it removed and what it cost are the second tile's numbers */
    ma({ x0: half + 44, y0, x1: w - 12, y1 }, (g) => an.shrunk[g], "after shrinking the fold changes");
  } else {
    frame(ctx, colors, { x0: half + 44, y0, x1: w - 12, y1 }, [0, 4.3], [-6, 6], { ylog: false, ylabel: "after shrinking the fold changes", xt: [], yt: [] });
    label(ctx, colors, "shrink the fold changes to draw it", (half + 44 + w - 12) / 2, (y0 + y1) / 2, { align: "center", color: colors.ink3 });
  }
}
