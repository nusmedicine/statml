/* deseq2/engine.js — DESeq2's pipeline on simulated counts, as the widget,
 * its mock and `_lab/deseq2-measure.mjs` all run it (one engine, three
 * readers, so the numbers on the page are the numbers that were measured).
 *
 * The steps are the notebook's (01-2 cell 22): size factors by the median of
 * ratios; a gene-wise dispersion by maximum likelihood; a trend a0 + a1/mu
 * through all genes; the shrunk (MAP) dispersion under a log-normal prior
 * around the trend; the GLM fit with the log link, the Wald statistic
 * W = beta / SE, and Benjamini–Hochberg; LFC shrinkage; the vst.
 *
 * Two stand-ins were wrong before they were right, and the record is in the
 * arc's measure script (`_lab/rnaseq-measure.mjs` M2, 2026-09-21):
 *   - the gene-wise MLE needs the Cox–Reid adjustment, ll − ½ log det(XᵀWX)
 *     with W = μ/(1 + αμ), or with three replicates it sits low and the trend
 *     fitted through it is half its true height (a0 0.028 against 0.05);
 *   - a single normal prior on the LFC fitted to a set that is 90% null shrinks
 *     with sd 0.22 and erases the true effects with the false; the prior here
 *     is a spike at 0 and a normal, fitted on the marginal likelihood by grid.
 * The trend is fitted through binned medians, standing in for DESeq2's gamma
 * GLM; the prior width is the residual variance about the trend less the
 * sampling variance of a log-dispersion MLE (trigamma of (m − p)/2), floored
 * at 0.25, as DESeq2's is; a gene more than two residual SDs above the trend
 * keeps its own estimate, as DESeq2 leaves it. The vst is DESeq2's closed form
 * for a parametric trend.
 */
import { lgamma } from "../core/stats.js";

export const TREND_TRUE = { a0: 0.05, a1: 2 };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const median = (a) => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const log2 = (x) => Math.log(x) / Math.LN2;

/* --- draws ------------------------------------------------------------------ */
function gammaDraw(rng, shape, scale = 1) {
  if (shape < 1) return gammaDraw(rng, shape + 1, scale) * rng.next() ** (1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = rng.normal(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}
export function poissonDraw(rng, mu) {
  if (mu <= 0) return 0;
  if (mu < 30) { const L = Math.exp(-mu); let k = 0, p = 1; do { k += 1; p *= rng.next(); } while (p > L); return k - 1; }
  return Math.max(0, Math.round(mu + Math.sqrt(mu) * rng.normal()));
}
/** a negative binomial draw as gamma–Poisson: the Poisson rate is itself drawn
    with mean mu and CV² alpha, which is where the extra variance alpha·mu² is */
export function nbDraw(rng, mu, alpha) {
  if (alpha <= 1e-8) return poissonDraw(rng, mu);
  return poissonDraw(rng, gammaDraw(rng, 1 / alpha, alpha * mu));
}

/* --- the distributions themselves, for the Model page --------------------------- */
export function poissonPmf(k, mu) { return Math.exp(k * Math.log(mu) - mu - lgamma(k + 1)); }
export function nbPmf(k, mu, alpha) {
  if (alpha <= 1e-8) return poissonPmf(k, mu);
  const r = 1 / alpha, p = r / (r + mu);
  return Math.exp(lgamma(k + r) - lgamma(r) - lgamma(k + 1) + r * Math.log(p) + k * Math.log(1 - p));
}

/* --- the simulation ---------------------------------------------------------- */
/** `reps` replicates per group, `genes` genes; a tenth of them DE at a log2
    fold change of 0.7 to 2.2 either way; each gene's true dispersion is the
    trend times a log-normal spread; each sample has its own depth */
export function simulate(rng, { genes = 1200, reps = 3, deShare = 0.1, spread = 0.5, trend = TREND_TRUE } = {}) {
  const n = 2 * reps;
  const grp = Array.from({ length: n }, (_, j) => (j < reps ? 0 : 1));
  const depth = Array.from({ length: n }, () => Math.exp(rng.normal(0, 0.35)));
  const mu0 = Array.from({ length: genes }, () => Math.exp(rng.normal(Math.log(80), 1.8)));
  const alphaT = mu0.map((m) => (trend.a0 + trend.a1 / m) * Math.exp(rng.normal(0, spread)));
  const every = deShare > 0 ? Math.round(1 / deShare) : Infinity;
  const isDE = Array.from({ length: genes }, (_, i) => i % every === 0);
  const lfcT = isDE.map((d) => (d ? (rng.next() < 0.5 ? -1 : 1) * (0.7 + 1.5 * rng.next()) : 0));
  const counts = mu0.map((m, g) => grp.map((gr, j) => nbDraw(rng, m * depth[j] * (gr ? 2 ** lfcT[g] : 1), alphaT[g])));
  return { genes, reps, grp, depth, mu0, alphaT, isDE, lfcT, counts };
}

/* --- size factors: the median of ratios ------------------------------------------ */
export function sizeFactors(counts) {
  const logGeo = counts.map((row) => (row.every((v) => v > 0) ? mean(row.map(Math.log)) : NaN));
  const n = counts[0].length;
  return Array.from({ length: n }, (_, j) => Math.exp(median(counts.map((row, g) => Math.log(row[j]) - logGeo[g]).filter(Number.isFinite))));
}

/* --- the NB likelihood, Cox–Reid adjusted ---------------------------------------- */
function nbLogLik(row, mus, alpha) {
  const r = 1 / alpha;
  let ll = 0;
  for (let j = 0; j < row.length; j += 1) {
    const y = row[j], mu = mus[j];
    ll += lgamma(y + r) - lgamma(r) - lgamma(y + 1) + r * Math.log(r / (r + mu)) + y * Math.log(mu / (r + mu));
  }
  return ll;
}
/** ll − ½ log det(XᵀWX): for a two-group design the determinant is the product
    of the two groups' weight sums, W = μ/(1 + αμ) */
export function crLogLik(row, mus, grp, alpha) {
  let det = 0;
  for (const gr of [0, 1]) { let w = 0; for (let j = 0; j < row.length; j += 1) if (grp[j] === gr) w += mus[j] / (1 + alpha * mus[j]); det += Math.log(w); }
  return nbLogLik(row, mus, alpha) - 0.5 * det;
}
function argmaxGolden(fn, lo, hi, iters = 36) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - phi * (b - a), d = a + phi * (b - a), fc = fn(c), fd = fn(d);
  for (let i = 0; i < iters; i += 1) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = fn(c); } else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
}

/* --- one gene's fit: group means, the gene-wise dispersion ------------------------ */
export function fitMeans(row, grp, sf) {
  const q = [0, 1].map((gr) => { let s = 0, k = 0; row.forEach((v, j) => { if (grp[j] === gr) { s += v / sf[j]; k += 1; } }); return s / k; });
  const baseMean = mean(row.map((v, j) => v / sf[j]));
  const mus = row.map((_, j) => Math.max(1e-6, q[grp[j]] * sf[j]));
  return { q, baseMean, mus };
}
export const geneWise = (row, mus, grp) => Math.exp(argmaxGolden((la) => crLogLik(row, mus, grp, Math.exp(la)), -9, 4));

/* --- the trend and the prior --------------------------------------------------- */
export function fitTrend(baseMean, alphaGW) {
  const ok = baseMean.map((_, g) => g).filter((g) => baseMean[g] > 5 && alphaGW[g] > 1e-4).sort((a, b) => baseMean[a] - baseMean[b]);
  const bins = Math.max(6, Math.min(25, Math.floor(ok.length / 40))), xs = [], ys = [];
  for (let b = 0; b < bins; b += 1) {
    const sl = ok.slice(Math.floor((b * ok.length) / bins), Math.floor(((b + 1) * ok.length) / bins));
    if (!sl.length) continue;
    xs.push(1 / median(sl.map((g) => baseMean[g]))); ys.push(median(sl.map((g) => alphaGW[g])));
  }
  const mx = mean(xs), my = mean(ys);
  const a1 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return { a0: Math.max(1e-4, my - a1 * mx), a1: Math.max(0, a1) };
}
/** trigamma at an integer: π²/6 − Σ_{k<x} 1/k² */
const trigammaInt = (x) => { let s = Math.PI * Math.PI / 6; for (let k = 1; k < x; k += 1) s -= 1 / (k * k); return s; };
export function priorWidth(baseMean, alphaGW, alphaTr, reps) {
  const resid = baseMean.map((_, g) => g).filter((g) => baseMean[g] > 5 && alphaGW[g] > 1e-4).map((g) => Math.log(alphaGW[g]) - Math.log(alphaTr[g]));
  const madSd = 1.4826 * median(resid.map((r) => Math.abs(r - median(resid))));
  const sampling = trigammaInt(Math.max(1, reps - 1));        // trigamma((m − p)/2), m = 2·reps, p = 2
  return { madSd, priorVar: Math.max(madSd * madSd - sampling, 0.25) };
}
/** the MAP dispersion, or the gene's own when it sits more than two residual
    SDs above the trend (the residual SD of the log gene-wise estimates, as
    DESeq2's rule reads it; against the prior SD the rule kept 5% of genes) */
export function mapDispersion(row, mus, grp, alphaGW, alphaTr, priorVar, madSd) {
  const lt = Math.log(alphaTr);
  if (Math.log(alphaGW) - lt > 2 * madSd) return { alpha: alphaGW, outlier: true };
  const la = argmaxGolden((x) => crLogLik(row, mus, grp, Math.exp(x)) - ((x - lt) ** 2) / (2 * priorVar), -9, 4);
  return { alpha: Math.exp(la), outlier: false };
}

/* --- the test --------------------------------------------------------------------- */
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const normalSf = (z) => 0.5 * erfc(z / Math.SQRT2);
/** the GLM's two coefficients on the log link are the two group means; the LFC
    is their difference in log2; its SE comes from the working weights */
export function wald(fit, alpha, grp) {
  const v = [0, 1].map((gr) => { let w = 0; fit.mus.forEach((mu, j) => { if (grp[j] === gr) w += mu / (1 + alpha * mu); }); return 1 / w; });
  const lfc = log2(Math.max(fit.q[1], 0.1) / Math.max(fit.q[0], 0.1));
  const se = Math.sqrt(v[0] + v[1]) / Math.LN2;
  const W = lfc / se;
  return { lfc, se, W, p: 2 * normalSf(Math.abs(W)) };
}
export function bh(p) {
  const n = p.length, idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]), out = new Array(n);
  let prev = 1;
  for (let k = n - 1; k >= 0; k -= 1) { prev = Math.min(prev, (p[idx[k]] * n) / (k + 1)); out[idx[k]] = prev; }
  return out;
}

/* --- LFC shrinkage: a spike at zero and a normal, fitted by grid ------------------ */
export function lfcPrior(res, expressed) {
  const ll = (p0, t2) => expressed.reduce((s, g) => { const v0 = res[g].se ** 2, v1 = v0 + t2, x2 = res[g].lfc ** 2; return s + Math.log((p0 / Math.sqrt(v0)) * Math.exp(-x2 / (2 * v0)) + ((1 - p0) / Math.sqrt(v1)) * Math.exp(-x2 / (2 * v1)) + 1e-300); }, 0);
  let best = -Infinity, pi0 = 0.9, tau2 = 1;
  for (const p0 of [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.99]) for (const t of [0.3, 0.5, 0.7, 1, 1.3, 1.6, 2, 2.5, 3]) { const v = ll(p0, t * t); if (v > best) { best = v; pi0 = p0; tau2 = t * t; } }
  return { pi0, tau2 };
}
export function shrinkLfc(r, { pi0, tau2 }) {
  const v0 = r.se ** 2, v1 = v0 + tau2, x2 = r.lfc ** 2;
  const l0 = (pi0 / Math.sqrt(v0)) * Math.exp(-x2 / (2 * v0)), l1 = ((1 - pi0) / Math.sqrt(v1)) * Math.exp(-x2 / (2 * v1));
  return (l1 / (l0 + l1)) * r.lfc * (tau2 / v1);
}

/* --- the vst, closed form for a parametric trend ------------------------------------ */
export const vstFor = ({ a0, a1 }) => (x) => log2((1 + a1 + 2 * a0 * x + 2 * Math.sqrt(a0 * x * (1 + a1 + a0 * x))) / (4 * a0));

/* --- the whole pipeline ------------------------------------------------------------ */
export function analyse(sim) {
  const { counts, grp, reps, genes } = sim;
  const sf = sizeFactors(counts);
  const fits = counts.map((row) => fitMeans(row, grp, sf));
  const baseMean = fits.map((f) => f.baseMean);
  const alphaGW = counts.map((row, g) => geneWise(row, fits[g].mus, grp));
  const trend = fitTrend(baseMean, alphaGW);
  const alphaTr = baseMean.map((m) => trend.a0 + trend.a1 / m);
  const prior = priorWidth(baseMean, alphaGW, alphaTr, reps);
  const map = counts.map((row, g) => mapDispersion(row, fits[g].mus, grp, alphaGW[g], alphaTr[g], prior.priorVar, prior.madSd));
  const alphaMAP = map.map((m) => m.alpha), outlier = map.map((m) => m.outlier);
  const expressed = baseMean.map((_, g) => g).filter((g) => baseMean[g] >= 1);
  const testWith = (alpha) => {
    const res = counts.map((_, g) => wald(fits[g], alpha[g], grp));
    const padj = bh(expressed.map((g) => res[g].p));
    expressed.forEach((g, k) => { res[g].padj = padj[k]; });
    return res;
  };
  const resGW = testWith(alphaGW), resMAP = testWith(alphaMAP);
  const resTrue = sim.alphaT ? testWith(sim.alphaT) : null;
  const lfcP = lfcPrior(resMAP, expressed);
  const shrunk = resMAP.map((r) => shrinkLfc(r, lfcP));
  return { genes, reps, sf, fits, baseMean, alphaGW, trend, alphaTr, prior, alphaMAP, outlier, expressed, resGW, resMAP, resTrue, lfcPrior: lfcP, shrunk, vst: vstFor(trend) };
}
