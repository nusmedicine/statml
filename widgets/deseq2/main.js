/* deseq2 — Bulk RNA-seq: Differential Expression (PHM5003 08 / 01-2 cells 1,
 * 22, 24, 35–45)
 *
 * THE MISCONCEPTION: with three replicates a gene's own dispersion estimate is
 * a measurement, and a fold change read at a low count means what it says.
 * Neither holds. A count's variance across replicates is mu + alpha·mu², not
 * mu; with few replicates alpha estimated gene by gene is noise, so DESeq2
 * fits a trend through all genes and pulls each gene's estimate toward it
 * (the prior times the likelihood, the MAP as the posterior's mode) — measured
 * here as the realised false discovery rate at padj < 0.1, about 40% with the
 * gene-wise dispersion and 20% shrunk at three replicates. The same argument
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
 *
 * THE MOTION IS EVERY CHANGE (his rounds 1 and 2, 2026-09-22): a display change
 * eases through core's display door, as widget 77's; a DATA change eases
 * through core's data door (`init` sets `anim.easing`, as widget 53's), with
 * the widget carrying the picture it last painted. Replicates change the
 * counts of the SAME 1,200 genes (the engine draws the genes' truths before
 * anything that depends on the replicate count), so every estimate slides to
 * its new value; a seed change is different genes, so the picture crossfades.
 * The Transform page's unit switch slides every SD on a log axis whose range
 * eases with it, so counts → log2(x + 1) is a slide too (his round 2: the
 * crossfade there read as absent).
 *
 * A helper used by draw() must sit above `defineWidget` or be a function
 * declaration: the module draws once at load, and a `const` below the call
 * threw on the Transform page's first draw (round 1).
 */
import { defineWidget, fmt, mathmlRenders } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { simulate, analyse, nbDraw, nbPmf, poissonPmf, crLogLik, log2, median } from "./engine.js";

const GENES = 1200;
const REPS = ["2", "3", "4", "6"];
const MUS = ["10", "100", "1000"];
const ALPHAS = ["0.01", "0.05", "0.5"];
const SHOWN_GENES = 60;
const PAGES = [
  { value: "model", label: "Model" },
  { value: "shrinkage", label: "Shrinkage" },
  { value: "transform", label: "Transform" },
  { value: "test", label: "Test" },
];
const ON = (page) => ({ param: "page", equals: page });
const HEIGHTS = { model: 300, shrinkage: 340, transform: 300, test: 500 };
/* THE SHRINKAGE PAGE IS A WALKTHROUGH (his ask, round 3, 2026-09-22: "demonstrate
   step by step how empirical Bayes works"), the notebook's own three figures as
   three presses of Step: one gene's likelihood over α and its own estimate; the
   trend through all genes as the prior's centre, its width from their spread;
   prior × likelihood as the posterior, its mode the shrunk estimate — then every
   gene's arrow. Steps that are read get Step alone (4.5). */
const STAGES = 3;
const STEP_MS = 700;
const stagesOf = (page) => (page === "shrinkage" ? STAGES : 0);
/* the walk panel's α axis, log10 */
const WALK_DOMAIN = [-3, 1];
const EASE_MS = 550;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const DISPLAY_TWEENS = ["shrinkLfc", "unit"];
const DATA_KEYS = ["reps", "seed", "mu", "alpha"];
const lerp = (a, b, e) => a + (b - a) * e;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const log10 = (x) => Math.log10(x);
const sci = (p) => (p < 1e-4 ? p.toExponential(1) : fmt(p, 4));
const bigNum = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
/* the Transform page's SD axis, log10, per unit; and its per-gene SD arrays */
const SD_DOMAIN = { raw: [0, 3.3], log2: [-1, 0.3], vst: [-1, 0.3] };
const SD_KEY = { raw: "sdRaw", log2: "sdLog2", vst: "sdVst" };
const CURVE_MAX = { raw: 10000, log2: 14, vst: 14 };

/* the Shrinkage page's left panel, one geometry for the drawing and the hover
   test (5.8) — above defineWidget, which draws once at load */
const shrinkLayout = (w) => ({ H: HEIGHTS.shrinkage, split: Math.floor(w * 0.56) });
const shrinkLeft = (w) => { const { H, split } = shrinkLayout(w); return { x0: 50, y0: 30, x1: split - 14, y1: H - 40 }; };
const SHRINK_X = [0, 4.3], SHRINK_Y = [-3.2, 1.3];
/* HOVER (his round 4): pointing at one of the sixty on the left walks it
   through on the right; nothing is written, and with no pointer the gene is
   the one chosen at compute */
function hoverAt(pointer, w, state) {
  if (!pointer) return null;
  const R = shrinkLeft(w);
  const sx = (v) => R.x0 + ((v - SHRINK_X[0]) / (SHRINK_X[1] - SHRINK_X[0])) * (R.x1 - R.x0);
  const sy = (v) => R.y1 - ((v - SHRINK_Y[0]) / (SHRINK_Y[1] - SHRINK_Y[0])) * (R.y1 - R.y0);
  let best = null, d2 = 12 * 12;
  for (const g of state.shown) {
    const bm = state.per.bmLog[g];
    const x = sx(Number.isFinite(bm) ? bm : 0), y = sy(state.per.gwLog[g]);
    const d = (pointer.x - x) ** 2 + (pointer.y - y) ** 2;
    if (d < d2) { d2 = d; best = g; }
  }
  return best;
}
/* what draw() last painted, for the ease a data change asks for */
let lastState = null, lastParams = null;
/* the drive's state between presses: the label the button wears, and whether
   the page has anything left to step */
function settle(anim, page) {
  const max = stagesOf(page);
  anim.done = anim.n >= max;
  anim.labelAt = anim.done ? "done" : `s${anim.n}`;
}

/* --- the formula card, one line per page ------------------------------------ */
const MATHML = mathmlRenders();
const FORMULAS = {
  model: { math: "<math><mrow><mi>Var</mi><mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo><mi>μ</mi><mo>+</mo><mi>α</mi><msup><mi>μ</mi><mn>2</mn></msup></mrow></math>", plain: "Var(y) = μ + α μ²", note: "a count's variance across replicates: Poisson's μ, and α μ² beyond it" },
  shrinkage0: {
    math: "<math><mrow><mi>L</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>=</mo><munder><mo>∏</mo><mi>j</mi></munder><mi>NB</mi><mo>(</mo><msub><mi>y</mi><mi>j</mi></msub><mo>;</mo><msub><mi>μ</mi><mi>j</mi></msub><mo>,</mo><mi>α</mi><mo>)</mo><mo>,</mo><mspace width=\"0.8em\"></mspace><msub><mover><mi>α</mi><mo>^</mo></mover><mi>gene</mi></msub><mo>=</mo><munder><mi>argmax</mi><mi>α</mi></munder><mi>log</mi><mi>L</mi><mo>(</mo><mi>α</mi><mo>)</mo></mrow></math>",
    plain: "L(α) = ∏_j NB(y_j; μ_j, α),   α̂_gene = argmax_α log L(α)",
    note: "one gene's likelihood over its own replicates alone: with few of them the curve is wide, and its maximum is the gene-wise estimate",
  },
  shrinkage1: {
    math: "<math><mrow><mi>log</mi><mi>α</mi><mo>∼</mo><mi>N</mi><mo>(</mo><mi>log</mi><msub><mi>α</mi><mi>tr</mi></msub><mo>(</mo><mover><mi>μ</mi><mo>¯</mo></mover><mo>)</mo><mo>,</mo><msubsup><mi>σ</mi><mi>prior</mi><mn>2</mn></msubsup><mo>)</mo><mo>,</mo><mspace width=\"0.8em\"></mspace><msub><mi>α</mi><mi>tr</mi></msub><mo>(</mo><mi>μ</mi><mo>)</mo><mo>=</mo><msub><mi>a</mi><mn>0</mn></msub><mo>+</mo><mfrac><msub><mi>a</mi><mn>1</mn></msub><mi>μ</mi></mfrac></mrow></math>",
    plain: "log α ~ N( log α_tr(μ̄), σ²_prior ),   α_tr(μ) = a0 + a1 / μ",
    note: "the prior, from all genes: its centre is the trend at the gene's mean, its width the spread of the estimates about the trend less what few replicates alone would spread them",
  },
  shrinkage2: {
    math: "<math><mrow><mi>posterior</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>∝</mo><mi>L</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>×</mo><mi>prior</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>,</mo><mspace width=\"0.8em\"></mspace><msub><mi>α</mi><mi>MAP</mi></msub><mo>=</mo><munder><mi>argmax</mi><mi>α</mi></munder><mo>[</mo><mi>log</mi><mi>L</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>+</mo><mi>log</mi><mi>prior</mi><mo>(</mo><mi>α</mi><mo>)</mo><mo>]</mo></mrow></math>",
    plain: "posterior(α) ∝ L(α) × prior(α),   α_MAP = argmax_α [ log L(α) + log prior(α) ]",
    note: "the posterior's mode is the shrunk estimate: a wide likelihood is pulled to the prior, a sharp one stays; a gene far above the trend keeps its own",
  },
  transform: { math: "<math><mrow><mi>vst</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><msub><mi>log</mi><mn>2</mn></msub><mfrac><mrow><mn>1</mn><mo>+</mo><msub><mi>a</mi><mn>1</mn></msub><mo>+</mo><mn>2</mn><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>+</mo><mn>2</mn><msqrt><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>(</mo><mn>1</mn><mo>+</mo><msub><mi>a</mi><mn>1</mn></msub><mo>+</mo><msub><mi>a</mi><mn>0</mn></msub><mi>x</mi><mo>)</mo></msqrt></mrow><mrow><mn>4</mn><msub><mi>a</mi><mn>0</mn></msub></mrow></mfrac></mrow></math>", plain: "vst(x) = log2 [ (1 + a1 + 2 a0 x + 2 √(a0 x (1 + a1 + a0 x))) / (4 a0) ]", note: "the closed form for a trend α = a0 + a1 / μ: a transform whose variance is constant across the mean" },
  test: { math: "<math><mrow><mi>log</mi><msub><mi>μ</mi><mi>ij</mi></msub><mo>=</mo><msub><mi>β</mi><mn>0</mn></msub><mo>+</mo><msub><mi>β</mi><mn>1</mn></msub><msub><mi>x</mi><mi>j</mi></msub><mo>,</mo><mspace width=\"0.8em\"></mspace><mi>W</mi><mo>=</mo><mfrac><msub><mi>β</mi><mn>1</mn></msub><mrow><mi>SE</mi><mo>(</mo><msub><mi>β</mi><mn>1</mn></msub><mo>)</mo></mrow></mfrac></mrow></math>", plain: "log μ_ij = β0 + β1 x_j,   W = β1 / SE(β1)", note: "x_j is 0 in group A and 1 in group B, so β1 is the log fold change; W is compared with a standard normal" },
};
let mathHost = null, mathKey = null;
function renderFormula(page, stage = 0) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = page === "shrinkage" ? `shrinkage${Math.min(2, stage)}` : page;
  if (mathKey === key) return;
  mathKey = key;
  const F = FORMULAS[key];
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
  for (const t of yt) {
    const y = sy(t);
    if (y < y0 - 1 || y > y1 + 1) continue;          // a tick outside an easing range
    const yy = Math.round(y) + 0.5;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(yfmt(t), x0 - 5, yy + 4);
  }
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
function transformOf(u, an) { return u === "raw" ? (v) => v : u === "log2" ? (v) => log2(v + 1) : an.vst; }

/* --- the data ease: from the picture last painted to this one ------------------- *
 * `D` is null when nothing is easing; otherwise { from, fromParams, e, kind }.
 * `at(state, D, key, g)` reads one gene's value from the state's per-gene
 * arrays, slid from the old picture's when the genes are the same. */
const at = (state, D, key, g) => {
  const v = state.per[key][g];
  if (!D || D.kind !== "slide") return v;
  const u = D.from.per[key][g];
  return Number.isFinite(u) && Number.isFinite(v) ? lerp(u, v, D.e) : v;
};
const scalar = (state, D, get) => (D && D.kind === "slide" ? lerp(get(D.from), get(state), D.e) : get(state));
/** a page drawn twice under a crossfade, or once; `drawAt(S, DD)` draws state S
    (null for the current one) with the slide DD (null under a fade) */
function fadeOrDraw(ctx, D, drawAt) {
  if (D && D.kind === "fade") {
    ctx.save(); ctx.globalAlpha *= 1 - D.e; drawAt(D.from, null); ctx.restore();
    ctx.save(); ctx.globalAlpha *= D.e; drawAt(null, null); ctx.restore();
  } else drawAt(null, D);
}

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
  pointer: true,
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

    /* authoring escape hatch, first render only: presses already taken on the Shrinkage page */
    shown: { type: "int", min: 0, max: STAGES, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const p = params.page;
    if (p === "model") return [
      { token: "empirical", label: "A replicate's count; a gene", mark: "bar" },
      { token: "highlight", label: "A gene that changed", mark: "bar" },
      { token: "reference", label: "Poisson: variance = mean", mark: "line" },
      { token: "theory", label: "Negative binomial: mean + α·mean²", mark: "line" },
    ];
    if (p === "shrinkage") return [
      { token: "empirical", label: "A gene's own estimate; the likelihood", mark: "bar" },
      { token: "theory", label: "The trend through all genes; the prior", mark: "line" },
      { token: "highlight", label: "The shrunk estimate; the posterior", mark: "bar" },
      { token: "reference", label: "The gene walked through: point at another", mark: "line" },
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
     the first, so its mean and α leave the 1,200 genes where they are. The
     `per` arrays are what the eases slide, one value per gene. */
  compute: ({ params, rng }) => {
    const reps = Number(params.reps);
    const simRng = makeRng(Math.floor(rng.next() * 2 ** 31)), geneRng = makeRng(Math.floor(rng.next() * 2 ** 31));
    const sim = simulate(simRng, { genes: GENES, reps });
    const an = analyse(sim);
    const nullG = an.expressed.filter((g) => !sim.isDE[g]), deG = an.expressed.filter((g) => sim.isDE[g]);
    const mu = Number(params.mu), alpha = Number(params.alpha);
    const draws = Array.from({ length: 2 * reps }, () => nbDraw(geneRng, mu, alpha));
    /* the 60 genes the Dispersion page draws, spread evenly over the TRUE
       means, so the set is the same at every replicate count of one seed */
    const byTruth = sim.mu0.map((_, g) => g).filter((g) => sim.mu0[g] >= 3).sort((a, b) => sim.mu0[a] - sim.mu0[b]);
    const shown = Array.from({ length: SHOWN_GENES }, (_, k) => byTruth[Math.floor(((k + 0.5) / SHOWN_GENES) * byTruth.length)]);
    const cands = deG.filter((g) => an.baseMean[g] > 60 && an.baseMean[g] < 200).sort((a, b) => an.resMAP[a].p - an.resMAP[b].p);
    const ex = cands[Math.min(2, cands.length - 1)] ?? deG.slice().sort((a, b) => an.resMAP[a].p - an.resMAP[b].p)[0];
    /* the one gene walked through: low counts, so its likelihood is wide and
       the pull is large; not an outlier, so the pull happens */
    const walkers = shown.filter((g) => !an.outlier[g] && an.baseMean[g] >= 4 && an.baseMean[g] <= 60 && an.alphaGW[g] > 0.002 && an.alphaGW[g] < 5)
      .sort((a, b) => Math.abs(Math.log(an.alphaGW[b] / an.alphaTr[b])) - Math.abs(Math.log(an.alphaGW[a] / an.alphaTr[a])));
    const walk = walkers[0] ?? shown[Math.floor(shown.length / 4)];
    /* the three curves over α for every one of the sixty, so pointing at any
       of them walks it through (his round 4): 60 × 81 likelihoods, a few ms */
    const grid = Array.from({ length: 81 }, (_, k) => WALK_DOMAIN[0] + ((WALK_DOMAIN[1] - WALK_DOMAIN[0]) * k) / 80);   // log10 α
    const pv = an.prior.priorVar;
    const curvesByGene = {};
    for (const g of shown) {
      const ll = grid.map((x) => crLogLik(sim.counts[g], an.fits[g].mus, sim.grp, 10 ** x));
      const llMax = Math.max(...ll), lt = Math.log(an.alphaTr[g]);
      const lp = grid.map((x) => -((x * Math.LN10 - lt) ** 2) / (2 * pv));
      const post = grid.map((_, k) => ll[k] - llMax + lp[k]);
      const postMax = Math.max(...post);
      curvesByGene[g] = { grid, like: ll.map((v) => Math.exp(v - llMax)), prior: lp.map((v) => Math.exp(v)), post: post.map((v) => Math.exp(v - postMax)) };
    }
    const called = (res) => ({ nulls: nullG.filter((g) => res[g].padj < 0.1).length, de: deG.filter((g) => res[g].padj < 0.1).length });
    const lowNull = nullG.filter((g) => an.baseMean[g] < 10), deBig = deG.filter((g) => Math.abs(sim.lfcT[g]) > 1);
    const over1 = (lfcOf, gs) => gs.filter((g) => Math.abs(lfcOf(g)) > 1).length;
    const isNull = new Set(nullG), expressed = new Set(an.expressed);
    const norm = sim.counts.map((row) => row.map((v, j) => v / an.sf[j]));
    const per = {
      bmLog: an.baseMean.map((m) => (m >= 1 ? log10(m) : NaN)),
      varLog: norm.map((row, g) => { const v = sd(row) ** 2; return expressed.has(g) && v > 0 ? log10(Math.min(2e7, v)) : NaN; }),
      gwLog: an.alphaGW.map((a) => log10(Math.min(20, Math.max(0.0006, a)))),
      mapLog: an.alphaMAP.map((a) => log10(Math.min(20, Math.max(0.0006, a)))),
      lfc: an.resMAP.map((r, g) => (expressed.has(g) ? Math.max(-6, Math.min(6, r.lfc)) : NaN)),
      shrunk: an.shrunk.map((v, g) => (expressed.has(g) ? Math.max(-6, Math.min(6, v)) : NaN)),
      sdRaw: norm.map((row, g) => (isNull.has(g) ? log10(Math.max(0.05, Math.min(2000, sd(row)))) : NaN)),
      sdLog2: norm.map((row, g) => (isNull.has(g) ? log10(Math.max(0.05, Math.min(2, sd(row.map((v) => log2(v + 1)))))) : NaN)),
      sdVst: norm.map((row, g) => (isNull.has(g) ? log10(Math.max(0.05, Math.min(2, sd(row.map(an.vst))))) : NaN)),
    };
    const bins = [[1, 5], [5, 20], [20, 100], [100, 1000], [1000, 1e9]];
    const sdBins = bins.map(([a, b]) => {
      const gs = nullG.filter((g) => an.baseMean[g] >= a && an.baseMean[g] < b);
      const s = (fn) => (gs.length ? median(gs.map((g) => sd(norm[g].map(fn)))) : NaN);
      return { a, b, n: gs.length, raw: s((v) => v), log2: s((v) => log2(v + 1)), vst: s(an.vst) };
    });
    return {
      sim, an, nullG, deG, reps, mu, alpha, draws, shown, walk, curvesByGene, ex, per, sdBins,
      calledGW: called(an.resGW), calledMAP: called(an.resMAP),
      funnel: { lowNull: lowNull.length, before: over1((g) => an.resMAP[g].lfc, lowNull), after: over1((g) => an.shrunk[g], lowNull) },
      cost: { deBig: deBig.length, before: over1((g) => an.resMAP[g].lfc, deBig), after: over1((g) => an.shrunk[g], deBig) },
    };
  },

  /* Step alone, on the Shrinkage page: three presses that are read (4.5). The
     other pages have nothing to step, so there the button is disabled through
     `done`. Each tweened display parameter keeps its own clock, so a second
     toggle mid-ease does not restart the first; a toggle flipped back mid-ease
     starts from where the picture is. A data change gets a fresh `anim` from
     `init`, which asks core for an ease when there is a last picture to ease
     from, and puts the walkthrough back at its first step. */
  animation: {
    stepLabel: { anim: "labelAt", labels: { s0: "Fit the trend", s1: "Multiply by the prior", s2: "Shrink every gene", done: "Step" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      s0: "Fit the trend through every gene's own estimate: the prior's centre, and its width from their spread",
      s1: "Multiply the one gene's likelihood by the prior: the posterior, whose mode is the shrunk estimate",
      s2: "Pull every gene's estimate toward the trend the same way",
      done: "Every step of the Dispersion page has been taken",
    }, default: "Step through the shrinkage on the Shrinkage page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const now = { shrinkLfc: params.shrinkLfc ? 1 : 0, unit: params.unit };
      const anim = { t: { shrinkLfc: 1, unit: 1 }, from: { ...now }, to: { ...now }, data: { t: 1, from: null, fromParams: null, kind: "slide" }, easing: false, n: 0, p: 1 };
      anim.n = fromScratch ? 0 : Math.min(STAGES, Math.max(0, Number(params.shown) || 0));
      if (lastState && lastParams && DATA_KEYS.some((k) => lastParams[k] !== params[k])) {
        anim.data = { t: 0, from: lastState, fromParams: lastParams, kind: lastParams.seed !== params.seed ? "fade" : "slide" };
        anim.easing = true;
      }
      settle(anim, params.page);
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.mode === "ease") {
        let more = false;
        for (const k of DISPLAY_TWEENS) { if (anim.t[k] < 1) { anim.t[k] = Math.min(1, anim.t[k] + dt / EASE_MS); more = more || anim.t[k] < 1; } }
        if (anim.data.t < 1) { anim.data.t = Math.min(1, anim.data.t + dt / EASE_MS); more = more || anim.data.t < 1; }
        if (anim.data.t >= 1) anim.data.from = null;
        return more;
      }
      /* a press: the next stage grows in over STEP_MS, then the press ends */
      if (anim.n >= stagesOf(params.page)) { settle(anim, params.page); return false; }
      if (anim.p >= 1) { anim.n += 1; anim.p = 0; }
      anim.p = Math.min(1, anim.p + dt / STEP_MS);
      if (anim.p >= 1) { settle(anim, params.page); return false; }
      return true;
    },
    rebuild: (anim, { params }) => {
      const target = { shrinkLfc: params.shrinkLfc ? 1 : 0, unit: params.unit };
      if (target.shrinkLfc !== anim.to.shrinkLfc) {
        anim.from.shrinkLfc = lerp(anim.from.shrinkLfc, anim.to.shrinkLfc, easeInOut(anim.t.shrinkLfc));
        anim.to.shrinkLfc = target.shrinkLfc; anim.t.shrinkLfc = 0; anim.easing = true;
      }
      if (target.unit !== anim.to.unit) {
        /* a unit chosen mid-ease starts from the unit the picture was leaving toward */
        anim.from.unit = anim.t.unit < 0.5 ? anim.from.unit : anim.to.unit;
        anim.to.unit = target.unit; anim.t.unit = 0; anim.easing = true;
      }
      /* a page switch mid-press finishes the press where it was (the 2026-09-20 sweep) */
      if (anim.p < 1) anim.p = 1;
      settle(anim, params.page);
    },
  },

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    const stage = anim ? anim.n : Number(params.shown) || 0, p = anim && anim.p < 1 ? easeInOut(anim.p) : 1;
    renderFormula(params.page, stage);
    const frac = (k) => (anim ? lerp(anim.from[k], anim.to[k], easeInOut(anim.t[k])) : (params[k] ? 1 : 0));
    const D = anim && anim.data.from && anim.data.t < 1 ? { from: anim.data.from, fromParams: anim.data.fromParams, e: easeInOut(anim.data.t), kind: anim.data.kind } : null;
    if (params.page === "model") drawModel(ctx, colors, w, state, D);
    else if (params.page === "shrinkage") drawShrinkage(ctx, colors, w, state, stage, p, D, hoverAt(pointer, w, state));
    else if (params.page === "transform") drawTransform(ctx, colors, w, state, anim ? anim.from.unit : params.unit, anim ? anim.to.unit : params.unit, anim ? easeInOut(anim.t.unit) : 1, D);
    else drawTest(ctx, colors, w, params, state, frac("shrinkLfc"), D);
    lastState = state;
    lastParams = { reps: params.reps, seed: params.seed, mu: params.mu, alpha: params.alpha };
  },

  readout: ({ params, state, anim }) => {
    const { an, ex, mu, alpha } = state;
    const stage = anim ? anim.n : Number(params.shown) || 0;
    if (params.page === "model") return [
      { label: `SD of the gene's count, Poisson`, value: fmt(Math.sqrt(mu), 1), note: `√μ at μ = ${mu}` },
      { label: `SD, negative binomial`, value: fmt(Math.sqrt(mu + alpha * mu * mu), 1), note: `√(μ + αμ²) at α = ${alpha}; the ${state.draws.length} replicates drawn have SD ${fmt(sd(state.draws), 1)}` },
    ];
    if (params.page === "shrinkage") {
      const g = state.walk;
      return [
        { label: "The one gene's dispersion: own estimate, and shrunk", value: `${fmt(an.alphaGW[g], 3)}${stage >= 2 ? ` → ${fmt(an.alphaMAP[g], 3)}` : ""}`, note: `mean ${fmt(an.baseMean[g], 1)}, counts ${state.sim.counts[g].join(" ")}${stage >= 1 ? `; trend at that mean ${fmt(an.alphaTr[g], 3)}, prior SD ${fmt(Math.sqrt(an.prior.priorVar), 2)} in log α` : ""}` },
        { label: "Unchanged genes called at padj < 0.1: gene-wise, then shrunk", value: stage >= 3 ? `${state.calledGW.nulls} → ${state.calledMAP.nulls}` : String(state.calledGW.nulls), note: `of ${state.nullG.length}; changed genes found ${state.calledGW.de}${stage >= 3 ? ` → ${state.calledMAP.de}` : ""} of ${state.deG.length}` },
      ];
    }
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
function drawModel(ctx, colors, w, state, D) {
  const H = HEIGHTS.model, half = Math.floor(w / 2);
  /* left: the two pmfs at a mean and α that ease between the old and the new,
     and the replicate counts, which are new draws, so they crossfade */
  {
    const e = D ? D.e : 1;
    const mu = D ? Math.exp(lerp(Math.log(D.from.mu), Math.log(state.mu), e)) : state.mu;
    const alpha = D ? Math.exp(lerp(Math.log(D.from.alpha), Math.log(state.alpha), e)) : state.alpha;
    const kmax = Math.ceil(mu + 4 * Math.sqrt(mu + alpha * mu * mu));
    const P = [], N = []; let pm = 0;
    for (let k = 0; k <= kmax; k += 1) { P.push(poissonPmf(k, mu)); N.push(nbPmf(k, mu, alpha)); pm = Math.max(pm, P[k], N[k]); }
    const step = Math.max(1, Math.round(kmax / 4 / (10 ** Math.floor(log10(kmax / 4))))) * 10 ** Math.floor(log10(kmax / 4));
    const xt = []; for (let t = 0; t <= kmax; t += step) xt.push(t);
    const F = frame(ctx, colors, { x0: 40, y0: 30, x1: half - 16, y1: H - 40 }, [0, kmax], [0, pm * 1.08], { xlog: false, ylog: false, xlabel: "count", ylabel: `one gene at mean ${state.mu}: probability of each count`, xt, xfmt: bigNum });
    curve(ctx, colors.reference, 1.5, P.map((p, k) => [F.sx(k), F.sy(p)]));
    curve(ctx, colors.theory, 2, N.map((p, k) => [F.sx(k), F.sy(p)]));
    const ticks = (draws, alpha) => { ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = colors.empirical; ctx.lineWidth = 2; for (const c of draws) { ctx.beginPath(); ctx.moveTo(F.sx(Math.min(c, kmax)), F.sy(0)); ctx.lineTo(F.sx(Math.min(c, kmax)), F.sy(0) - 14); ctx.stroke(); } ctx.restore(); };
    if (D) ticks(D.from.draws, 1 - e);
    ticks(state.draws, D ? e : 1);
    label(ctx, colors, `${state.draws.length} replicates: ${state.draws.join(" ")}`, F.x0 + 4, F.y0 + 12, { color: colors.empirical });
  }
  /* right: variance against mean, all genes — the same genes slide, new genes crossfade */
  {
    const F = frame(ctx, colors, { x0: half + 44, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4.3], [0, 7.3], { xlabel: "mean of normalised counts", ylabel: "1,200 genes: variance across replicates", xt: [1, 10, 100, 1000, 10000], yt: [1, 100, 10000, 1000000], xfmt: bigNum, yfmt: (v) => `1e${log10(v)}` });
    fadeOrDraw(ctx, D, (S, DD) => {
      const st = S ?? state;
      for (const g of st.an.expressed) {
        const x = at(st, DD, "bmLog", g), y = at(st, DD, "varLog", g);
        if (Number.isFinite(x) && Number.isFinite(y)) dot(ctx, F.sx(10 ** x), F.sy(10 ** y), 1.6, st.sim.isDE[g] ? colors.highlight : colors.empirical, 0.45 * ctx.globalAlpha);
      }
    });
    curve(ctx, colors.reference, 1.5, [[F.sx(1), F.sy(1)], [F.sx(20000), F.sy(20000)]]);
    const a0 = scalar(state, D, (S) => S.an.trend.a0);
    const pts = []; for (let q = 0; q <= 4.3; q += 0.05) { const m = 10 ** q; pts.push([F.sx(m), F.sy(m + a0 * m * m)]); }
    curve(ctx, colors.theory, 2, pts);
    label(ctx, colors, `mean + ${fmt(a0, 3)}·mean²`, F.x1 - 4, F.y0 + 12, { color: colors.theory, align: "right" });
    label(ctx, colors, "Poisson: mean", F.x1 - 4, F.sy(20000) + 14, { color: colors.reference, align: "right" });
  }
}

/* --- Shrinkage: 60 genes, each pulled toward the trend; one gene walked through --- */
function drawShrinkage(ctx, colors, w, state, stage, p, D, hover) {
  const { H, split } = shrinkLayout(w);
  const walk = hover ?? state.walk, curves = state.curvesByGene[walk];
  /* the reveal fractions: the trend at stage 1, the one gene's pull at 2, every gene's at 3 */
  const trendF = stage > 1 ? 1 : stage === 1 ? p : 0;
  const oneF = stage > 2 ? 1 : stage === 2 ? p : 0;
  const allF = stage >= 3 ? p : 0;
  /* left: the estimates against the mean */
  {
    const F = frame(ctx, colors, shrinkLeft(w), SHRINK_X, SHRINK_Y, { xlabel: "mean of normalised counts", ylabel: `${SHOWN_GENES} of the 1,200 genes: dispersion α`, xt: [1, 10, 100, 1000, 10000], yt: [0.001, 0.01, 0.1, 1, 10], xfmt: bigNum });
    const ylog = (v) => F.sy(10 ** v);
    const trendPts = (a0, a1, upTo) => { const pts = []; for (let q = 0; q <= 4.3 * upTo + 1e-9; q += 0.05) { const m = 10 ** q; pts.push([F.sx(m), ylog(log10(Math.min(20, Math.max(0.0006, a0 + a1 / m))))]); } return pts; };
    const a0 = scalar(state, D, (S) => S.an.trend.a0), a1 = scalar(state, D, (S) => S.an.trend.a1);
    fadeOrDraw(ctx, D, (S, DD) => {
      const st = S ?? state, base = ctx.globalAlpha;
      if (trendF > 0) curve(ctx, colors.theory, 2, S ? trendPts(S.an.trend.a0, S.an.trend.a1, trendF) : trendPts(a0, a1, trendF));
      for (const g of st.shown) {
        const bm = at(st, DD, "bmLog", g);
        const x = F.sx(10 ** (Number.isFinite(bm) ? bm : 0));
        const yGW = ylog(at(st, DD, "gwLog", g));
        const f = g === walk ? Math.max(oneF, allF) : allF;
        if (f > 0) {
          const yNow = lerp(yGW, ylog(at(st, DD, "mapLog", g)), f);
          ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1; ctx.globalAlpha = 0.8 * base;
          ctx.beginPath(); ctx.moveTo(x, yGW); ctx.lineTo(x, yNow); ctx.stroke(); ctx.restore();
          dot(ctx, x, yNow, 3, colors.highlight, Math.min(1, f * 2) * base);
          if (st.an.outlier[g]) { ctx.save(); ctx.globalAlpha = f * base; ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, yGW, 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        }
        dot(ctx, x, yGW, 3, colors.empirical, base);
        if (g === walk) { ctx.save(); ctx.globalAlpha = base; ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, yGW, 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
    });
    if (trendF > 0) label(ctx, colors, `trend: α = ${fmt(a0, 3)} + ${fmt(a1, 2)} / mean`, F.x1 - 6, ylog(log10(a0)) - 8, { color: colors.theory, align: "right" });
    /* short captions: the left panel is 235px wide at the narrowest canvas (the sweep) */
    label(ctx, colors, stage === 0 ? "each gene's own estimate" : stage === 1 ? "the trend through all genes" : stage === 2 ? "the one gene, pulled to the mode" : "every gene pulled; ringed: left alone", F.x0 + 4, F.y0 + 12, { color: colors.ink3 });
    label(ctx, colors, "point at a gene to walk it through", F.x1 - 4, F.y1 - 6, { color: colors.ink3, align: "right" });
  }
  /* right: the one gene's curves over α — likelihood, prior, posterior */
  {
    const F = frame(ctx, colors, { x0: split + 40, y0: 30, x1: w - 12, y1: H - 40 }, WALK_DOMAIN, [0, 1.12], { ylog: false, xlabel: "dispersion α", ylabel: `one gene, mean ${fmt(state.an.baseMean[walk], 1)}`, xt: [0.001, 0.01, 0.1, 1, 10] });
    const sx = (v) => F.sx(v), sy = (v) => F.sy(v);
    const line = (ys, color, width, alpha) => { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; curve(ctx, color, width, ys.map((v, k) => [sx(10 ** curves.grid[k]), sy(v)])); ctx.restore(); };
    const mark = (a0, color, text, y, alpha) => {
      if (alpha <= 0) return;
      const a = Math.min(10 ** WALK_DOMAIN[1], Math.max(10 ** WALK_DOMAIN[0], a0));   // an estimate at the floor stays on the axis
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(Math.round(sx(a)) + 0.5, F.y0 + 4); ctx.lineTo(Math.round(sx(a)) + 0.5, F.y1); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = alpha; label(ctx, colors, text, sx(a) + (a < 0.1 ? 5 : -5), y, { color, align: a < 0.1 ? "left" : "right" }); ctx.restore();
    };
    line(curves.like, colors.empirical, 2, 1);
    line(curves.prior, colors.theory, 2, trendF);
    line(curves.post, colors.highlight, 2.5, oneF);
    const an = state.an;
    mark(an.alphaGW[walk], colors.empirical, `own estimate ${fmt(an.alphaGW[walk], 3)}`, F.y0 + 14, 1);
    mark(an.alphaTr[walk], colors.theory, `trend ${fmt(an.alphaTr[walk], 3)}`, F.y0 + 28, trendF);
    mark(an.alphaMAP[walk], colors.highlight, `shrunk ${fmt(an.alphaMAP[walk], 3)}`, F.y0 + 42, oneF);
    label(ctx, colors, stage === 0 ? "its likelihood over α" : stage === 1 ? "and the prior at this mean" : "prior × likelihood: the posterior", F.x0 + 4, F.y1 - 6, { color: colors.ink3 });
  }
}

/* --- Transform: SD against mean on a log axis whose range eases with the unit ------ */
function drawTransform(ctx, colors, w, state, uFrom, uTo, eU, D) {
  const H = HEIGHTS.transform, half = Math.floor(w / 2);
  const yd = [lerp(SD_DOMAIN[uFrom][0], SD_DOMAIN[uTo][0], eU), lerp(SD_DOMAIN[uFrom][1], SD_DOMAIN[uTo][1], eU)];
  {
    const F = frame(ctx, colors, { x0: 50, y0: 30, x1: half - 16, y1: H - 40 }, [0, 4.3], yd, { xlabel: "mean of normalised counts", ylabel: "unchanged genes: SD across replicates", xt: [1, 10, 100, 1000, 10000], yt: [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000], xfmt: bigNum });
    const ylog = (v) => F.sy(10 ** v);
    fadeOrDraw(ctx, D, (S, DD) => {
      const st = S ?? state, base = ctx.globalAlpha;
      for (const g of st.nullG) {
        const bm = at(st, DD, "bmLog", g);
        const a = at(st, DD, SD_KEY[uFrom], g), b = at(st, DD, SD_KEY[uTo], g);
        if (!Number.isFinite(bm) || !Number.isFinite(a) || !Number.isFinite(b)) continue;
        dot(ctx, F.sx(10 ** bm), ylog(lerp(a, b, eU)), 1.6, colors.empirical, 0.45 * base);
      }
      for (const b of st.sdBins) {
        if (!Number.isFinite(b[uFrom]) || !Number.isFinite(b[uTo])) continue;
        const y = ylog(lerp(log10(Math.max(0.05, b[uFrom])), log10(Math.max(0.05, b[uTo])), eU));
        curve(ctx, colors.theory, 2.5, [[F.sx(Math.max(1, b.a)), y], [F.sx(Math.min(20000, b.b)), y]]);
      }
    });
  }
  {
    const ymax = lerp(CURVE_MAX[uFrom], CURVE_MAX[uTo], eU);
    const yt = ymax > 100 ? [0, 5000, 10000].filter((t) => t <= ymax) : [0, 4, 8, 12];
    const F = frame(ctx, colors, { x0: half + 44, y0: 30, x1: w - 12, y1: H - 40 }, [0, 4], [0, ymax], { ylog: false, xlabel: "normalised count", ylabel: "the value the count becomes", xt: [1, 10, 100, 1000, 10000], yt, xfmt: bigNum, yfmt: bigNum });
    const fA = transformOf(uFrom, state.an), fB = transformOf(uTo, state.an);
    /* the log2 reference is drawn beside a transform only: under counts it sat on the axis (the sweep) */
    const refAlpha = uFrom === "raw" && uTo === "raw" ? 0 : uFrom === "raw" ? eU : uTo === "raw" ? 1 - eU : 1;
    if (refAlpha > 0) {
      const ref = []; for (let q = 0; q <= 4; q += 0.05) { const x = 10 ** q; ref.push([F.sx(x), F.sy(log2(x + 1))]); }
      ctx.save(); ctx.globalAlpha = refAlpha; curve(ctx, colors.reference, 1, ref); label(ctx, colors, "log2(x + 1)", F.sx(40), F.sy(log2(41)) + 14, { color: colors.reference }); ctx.restore();
    }
    const pts = []; for (let q = 0; q <= 4; q += 0.05) { const x = 10 ** q; pts.push([F.sx(x), F.sy(lerp(fA(x), fB(x), eU))]); }
    curve(ctx, colors.empirical, 2, pts);
    const u = eU < 0.5 ? uFrom : uTo;
    label(ctx, colors, u === "raw" ? "the count itself" : u === "log2" ? "log2(x + 1)" : `vst: ${fmt(state.an.vst(0), 2)} at zero, log2 above a hundred`, F.x0 + 4, F.y0 + 12, { color: colors.empirical });
  }
}

/* --- Test: one gene's fit; the MA plot, before and after LFC shrinkage --------------- */
function drawTest(ctx, colors, w, params, state, frac, D) {
  const TOP = 210, half = Math.floor(w / 2);
  /* the one gene: a different gene under a data change, so its panel crossfades */
  const onePanel = (S, alpha) => {
    const { an, sim, ex, reps } = S;
    const r = an.resMAP[ex], fit = an.fits[ex];
    ctx.save(); ctx.globalAlpha = alpha;
    const norm = sim.counts[ex].map((v, j) => v / an.sf[j]);
    const vals = norm.map((v) => log2(Math.max(0.5, v)));
    const lo = Math.floor(Math.min(...vals)) - 1, hi = Math.ceil(Math.max(...vals)) + 1;
    const yt = []; for (let t = lo; t <= hi; t += 1) yt.push(t);
    const F = frame(ctx, colors, { x0: 44, y0: 30, x1: half - 16, y1: TOP - 30 }, [0, 1], [lo, hi], { xlog: false, ylog: false, ylabel: `one changed gene: counts ${sim.counts[ex].join(" ")}, after the size factors`, yt });
    const xg = [0.28, 0.72];
    label(ctx, colors, "group A", F.sx(xg[0]), F.y1 + 13, { align: "center", color: colors.ink3 });
    label(ctx, colors, "group B", F.sx(xg[1]), F.y1 + 13, { align: "center", color: colors.ink3 });
    norm.forEach((v, j) => dot(ctx, F.sx(xg[sim.grp[j]]) + ((j % reps) - (reps - 1) / 2) * 7, F.sy(log2(Math.max(0.5, v))), 3.5, colors.empirical, alpha));
    for (const k of [0, 1]) curve(ctx, colors.theory, 2, [[F.sx(xg[k]) - 24, F.sy(log2(fit.q[k]))], [F.sx(xg[k]) + 24, F.sy(log2(fit.q[k]))]]);
    const xm = F.sx(0.5);
    curve(ctx, colors.highlight, 1.5, [[xm, F.sy(log2(fit.q[0]))], [xm, F.sy(log2(fit.q[1]))]]);
    curve(ctx, colors.highlight, 4, [[xm + 8, F.sy(log2(fit.q[1]) - r.se)], [xm + 8, F.sy(log2(fit.q[1]) + r.se)]]);
    /* six short lines: the right half is 223px wide at the narrowest canvas */
    const tx = half + 44, ty = 44;
    label(ctx, colors, `β = ${fmt(r.lfc, 2)}, the gap in log2`, tx, ty, { color: colors.highlight, weight: "600" });
    label(ctx, colors, `SE = ${fmt(r.se, 2)} at α = ${fmt(an.alphaMAP[ex], 3)}`, tx, ty + 16, { color: colors.ink2 });
    label(ctx, colors, `W = β / SE = ${fmt(r.W, 2)}`, tx, ty + 32, { color: colors.ink2 });
    label(ctx, colors, `p = ${sci(r.p)}, padj = ${sci(r.padj)}`, tx, ty + 48, { color: colors.ink2 });
    label(ctx, colors, `α: gene-wise ${fmt(an.alphaGW[ex], 3)}, trend ${fmt(an.alphaTr[ex], 3)}`, tx, ty + 64, { color: colors.ink3 });
    label(ctx, colors, frac > 0 ? `shrunk β = ${fmt(lerp(r.lfc, an.shrunk[ex], frac), 2)}, true ${fmt(sim.lfcT[ex], 2)}` : `true β = ${fmt(sim.lfcT[ex], 2)}`, tx, ty + 80, { color: colors.ink3 });
    ctx.restore();
  };
  if (D && D.from.ex !== state.ex) { onePanel(D.from, 1 - D.e); onePanel(state, D.e); } else onePanel(state, 1);
  /* the MA plots: the same genes slide, new genes crossfade */
  const ma = (rect, title, mix, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = alpha;
    const F = frame(ctx, colors, rect, [0, 4.3], [-6, 6], { ylog: false, xlabel: "mean of normalised counts", ylabel: title, xt: [1, 10, 100, 1000, 10000], yt: [-4, -2, 0, 2, 4], xfmt: bigNum });
    curve(ctx, colors.reference, 1.5, [[F.sx(1), F.sy(0)], [F.sx(20000), F.sy(0)]]);
    fadeOrDraw(ctx, D, (S, DD) => {
      const st = S ?? state, base = ctx.globalAlpha;
      for (const g of st.an.expressed) {
        const bm = at(st, DD, "bmLog", g), y = mix(st, DD, g);
        if (!Number.isFinite(bm) || !Number.isFinite(y)) continue;
        const sig = st.an.resMAP[g].padj < 0.1;
        dot(ctx, F.sx(10 ** bm), F.sy(y), 1.6, sig ? colors.extreme : colors.empirical, (sig ? 0.9 : 0.4) * base);
      }
      const exY = mix(st, DD, st.ex);
      if (Number.isFinite(exY)) dot(ctx, F.sx(Math.max(1, st.an.baseMean[st.ex])), F.sy(exY), 5, colors.highlight, base);
    });
    ctx.restore();
  };
  const y0 = TOP + 10, y1 = HEIGHTS.test - 40;
  ma({ x0: 44, y0, x1: half - 16, y1 }, "1,200 genes: log2 fold change against mean", (st, DD, g) => at(st, DD, "lfc", g));
  if (frac > 0) {
    /* the after plot fades in as every dot slides from its fold change to the shrunk one;
       what it removed and what it cost are the second tile's numbers */
    ma({ x0: half + 44, y0, x1: w - 12, y1 }, "after shrinking the fold changes", (st, DD, g) => lerp(at(st, DD, "lfc", g), at(st, DD, "shrunk", g), frac), Math.min(1, frac * 2));
  } else {
    frame(ctx, colors, { x0: half + 44, y0, x1: w - 12, y1 }, [0, 4.3], [-6, 6], { ylog: false, ylabel: "after shrinking the fold changes", xt: [], yt: [] });
    label(ctx, colors, "shrink the fold changes to draw it", (half + 44 + w - 12) / 2, (y0 + y1) / 2, { align: "center", color: colors.ink3 });
  }
}
