/* The RNA-seq arc, measured before it is mocked (2026-09-21, planning from
 * PHM5003 08 — four bulk notebooks on DESeq2 and four single-cell notebooks on
 * Seurat). Kenneth's ask named three confusions: what FPKM and TPM mean and
 * why some units cannot be compared between conditions; DESeq2's size factors,
 * dispersion shrinkage, negative binomial and variance stabilisation; and the
 * Seurat pipeline — integration, clusters, markers. Six candidate slots came
 * out of the eight notebooks, and each rests on a claim that has to be a
 * number before it is a widget:
 *
 *   M1 UNITS — CPM corrects depth, FPKM and TPM correct depth and length, and
 *      every one of them is a share of the sample's total, so when a few genes
 *      rise the share of every unchanged gene falls. The median of ratios
 *      does not, because it assumes most genes are unchanged and reads the
 *      scale off them. And a TPM has thrown away the depth that decides how
 *      sure it is.
 *   M2 DESEQ2 — with three replicates a gene's own dispersion estimate is
 *      noise; the trend over all genes is a prior; the MAP estimate pulls each
 *      gene to it. Measured as a false-positive rate under the null with the
 *      gene-wise, the shrunk and the true dispersion. Then the LFC funnel at
 *      low counts and what shrinking the LFC does to it; and the SD-against-
 *      mean of raw, log2(x + 1) and the closed-form vst.
 *   M2r THE LESSON'S OWN OUTPUT — results_DESeq2.tsv (19,938 protein-coding
 *      genes, ashr-shrunk): lfcSE and the significant fraction by baseMean.
 *   M4 GRAPH CLUSTERS — a kNN graph, SNN weights, Louvain at a resolution:
 *      the same 600 cells give 2 to 12 clusters as the resolution moves.
 *   M5 INTEGRATION — mutual nearest neighbours between two batches correct a
 *      shift when every type is in both; a type present in one batch only is
 *      merged into whichever shared type is nearest. The notebook integrates
 *      tumour and background as layers, and its Kupffer cluster's tumour-vs-
 *      background test returns GPC3 and AFP at LFC 9 — the tumour cells.
 *   M6 MARKERS — a gene high in every cluster and a gene specific to one both
 *      test at p ≈ 0 over a thousand cells; pct.1 against pct.2 separates them,
 *      the p-value does not. And cells are not replicates: with two patients
 *      per arm and no condition effect, a Wilcoxon over cells rejects far
 *      above 5%; a pseudobulk t-test over patients does not.
 *
 *   node widgets/_lab/rnaseq-measure.mjs        (~20 s)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const findings = [];
const say = (s) => { console.log(s); findings.push(s); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const log2 = (x) => Math.log(x) / Math.LN2;

/* --- draws: gamma (Marsaglia–Tsang), Poisson, negative binomial as gamma–Poisson --- */
function gammaDraw(rng, shape, scale = 1) {
  if (shape < 1) return gammaDraw(rng, shape + 1, scale) * Math.pow(rng.next(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = rng.normal(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}
function poissonDraw(rng, mu) {
  if (mu <= 0) return 0;
  if (mu < 40) { const L = Math.exp(-mu); let k = 0, p = 1; do { k += 1; p *= rng.next(); } while (p > L); return k - 1; }
  // transformed rejection (PTRS, Hörmann 1993) for large means
  const smu = Math.sqrt(mu), b = 0.931 + 2.53 * smu, a = -0.059 + 0.02483 * b, invAlpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
  for (;;) {
    const u = rng.next() - 0.5, v = rng.next(), us = 0.5 - Math.abs(u), k = Math.floor((2 * a / us + b) * u + mu + 0.43);
    if (us >= 0.07 && v <= vr) return k;
    if (k < 0 || (us < 0.013 && v > us)) continue;
    if (Math.log(v) + Math.log(invAlpha) - Math.log(a / (us * us) + b) <= -mu + k * Math.log(mu) - lgamma(k + 1)) return k;
  }
}
const nbDraw = (rng, mu, alpha) => (alpha <= 1e-8 ? poissonDraw(rng, mu) : poissonDraw(rng, mu * gammaDraw(rng, 1 / alpha, alpha)));

/* --- NB log-likelihood in DESeq2's parameterisation (alpha = 1/size) --- */
function nbLogLik(counts, mus, alpha) {
  const size = 1 / alpha;
  let ll = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const k = counts[i], mu = mus[i], lsm = Math.log(size + mu);
    ll += lgamma(k + size) - lgamma(size) - lgamma(k + 1) + size * (Math.log(size) - lsm) + k * (Math.log(mu) - lsm);
  }
  return ll;
}
function argmaxGolden(fn, lo, hi, iters = 60) {
  const gr = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - gr * (b - a), d = a + gr * (b - a), fc = fn(c), fd = fn(d);
  for (let i = 0; i < iters; i += 1) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = fn(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
}
const normalSf = (z) => 0.5 * erfc(z / Math.SQRT2);
function erfc(x) { // Numerical Recipes erfcc, 1.2e-7 relative
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
function bh(pvals) {
  const n = pvals.length, idx = pvals.map((p, i) => i).sort((a, b) => pvals[a] - pvals[b]);
  const adj = new Array(n); let prev = 1;
  for (let r = n - 1; r >= 0; r -= 1) { const i = idx[r]; prev = Math.min(prev, (pvals[i] * n) / (r + 1)); adj[i] = prev; }
  return adj;
}

/* ============================================================================
 * M1 · UNITS — CPM, FPKM, TPM, and the median of ratios
 * ========================================================================== */
say("M1 UNITS — the toy: six genes, two samples, identical expression, sample B sequenced 3x deeper");
{
  const len = [1, 2, 4, 1, 10, 0.5]; // kb
  const expr = [100, 100, 100, 20, 300, 50]; // transcripts per cell, "truth"
  const reads = (depthM, e, l, scale = 1) => e.map((v, i) => Math.round(v * l[i] * depthM * scale));
  const cpm = (c) => { const t = c.reduce((s, v) => s + v, 0); return c.map((v) => (1e6 * v) / t); };
  const fpkm = (c, l) => { const t = c.reduce((s, v) => s + v, 0); return c.map((v, i) => (1e9 * v) / (t * l[i])); };
  const tpm = (c, l) => { const r = c.map((v, i) => v / l[i]); const t = r.reduce((s, v) => s + v, 0); return r.map((v) => (1e6 * v) / t); };
  const mor = (A, B) => { const ratios = A.map((a, i) => (a > 0 && B[i] > 0 ? B[i] / Math.sqrt(a * B[i]) : NaN)).filter(Number.isFinite); return median(ratios) / median(A.map((a, i) => a / Math.sqrt(a * B[i])).filter(Number.isFinite)); };
  const A = reads(1, expr, len), B = reads(3, expr, len);
  say(`  raw counts A ${A.join(" ")} | B ${B.join(" ")}  -> B/A = ${f(B[0] / A[0], 1)} for every gene: depth, not expression`);
  say(`  CPM A ${cpm(A).map((v) => f(v, 0)).join(" ")} | B ${cpm(B).map((v) => f(v, 0)).join(" ")}  -> equal, but gene 3 (4 kb) reads 4x gene 1 at the same expression: length`);
  say(`  TPM A ${tpm(A, len).map((v) => f(v, 0)).join(" ")} | B ${tpm(B, len).map((v) => f(v, 0)).join(" ")}  -> equal, and genes 1..3 equal: length corrected`);
  const fa = fpkm(A, len), fb = fpkm(B, len);
  say(`  FPKM A ${fa.map((v) => f(v, 0)).join(" ")} sum ${f(fa.reduce((s, v) => s + v), 0)} | B sum ${f(fb.reduce((s, v) => s + v), 0)}  -> sums equal here because composition is equal`);
  // composition: gene 5 (long, abundant) up 8x in B; everything else unchanged
  const exprB = expr.slice(); exprB[4] *= 8;
  const B2 = reads(1, exprB, len);
  const tA = tpm(A, len), tB = tpm(B2, len), fA = fpkm(A, len), fB = fpkm(B2, len);
  const unchanged = [0, 1, 2, 3, 5];
  say(`  composition: gene 5 up 8x in B, five genes unchanged at the same depth`);
  say(`    TPM of the unchanged genes, B/A: ${unchanged.map((i) => f(tB[i] / tA[i], 2)).join(" ")}  -> every unchanged gene reads DOWN ${f(1 - tB[0] / tA[0], 2)}`);
  say(`    FPKM of the unchanged genes, B/A: ${unchanged.map((i) => f(fB[i] / fA[i], 2)).join(" ")}; FPKM sums A ${f(fA.reduce((s, v) => s + v), 0)} B ${f(fB.reduce((s, v) => s + v), 0)}  -> the sums differ, TPM's are 1e6 by construction`);
  const ratiosB = B2.map((b, i) => b / Math.sqrt(A[i] * b)), ratiosA = A.map((a, i) => a / Math.sqrt(a * B2[i]));
  const sfA = median(ratiosA), sfB = median(ratiosB);
  say(`    median of ratios: size factors A ${f(sfA, 3)} B ${f(sfB, 3)}; normalised B/A of the unchanged genes: ${unchanged.map((i) => f((B2[i] / sfB) / (A[i] / sfA), 2)).join(" ")}; gene 5: ${f((B2[4] / sfB) / (A[4] / sfA), 1)}`);
}
say("M1b UNITS — 2,000 genes, 5% of them up 8x in B, the rest unchanged; per-unit log2 shift of the UNCHANGED genes (0 is right)");
{
  const rng = makeRng(11);
  const G = 2000;
  const len = Array.from({ length: G }, () => Math.exp(rng.normal(Math.log(2), 0.7)));
  const expr = Array.from({ length: G }, () => Math.exp(rng.normal(Math.log(30), 1.6)));
  const up = new Set(); while (up.size < 100) up.add(Math.floor(rng.next() * G));
  const exprB = expr.map((v, i) => (up.has(i) ? 8 * v : v));
  const draw = (e, depth) => e.map((v, i) => poissonDraw(rng, v * len[i] * depth));
  const A = draw(expr, 0.02), B = draw(exprB, 0.03);
  const tot = (c) => c.reduce((s, v) => s + v, 0);
  const unchanged = [...Array(G).keys()].filter((i) => !up.has(i) && A[i] > 20 && B[i] > 20);
  const cpmR = unchanged.map((i) => log2((B[i] / tot(B)) / (A[i] / tot(A))));
  const perKb = (c) => c.map((v, i) => v / len[i]);
  const tA = perKb(A), tB = perKb(B);
  const tpmR = unchanged.map((i) => log2((tB[i] / tot(tB)) / (tA[i] / tot(tA))));
  const ratios = unchanged.map((i) => B[i] / A[i]); // geometric-mean reference: sf ratio = median(B/A)
  const sfRatio = median([...Array(G).keys()].filter((i) => A[i] > 0 && B[i] > 0).map((i) => B[i] / A[i]));
  const morR = unchanged.map((i) => log2(B[i] / A[i] / sfRatio));
  const upShare = up.size ? [...up].reduce((s, i) => s + B[i], 0) / tot(B) : 0;
  say(`  the 100 up genes hold ${pct(upShare)} of B's reads. median log2(B/A) of the unchanged genes: CPM ${f(median(cpmR), 3)}, TPM ${f(median(tpmR), 3)}, median-of-ratios ${f(median(morR), 3)}`);
  say(`  under a 0.58 cutoff (1.5x), unchanged genes called DOWN by the shift alone: CPM ${unchanged.filter((_, k) => cpmR[k] < -0.58).length}, TPM ${unchanged.filter((_, k) => tpmR[k] < -0.58).length}, median-of-ratios ${unchanged.filter((_, k) => morR[k] < -0.58).length} of ${unchanged.length}`);
  void ratios;
}
say("M1c UNITS — the same TPM at two depths: a TPM of 50 from a 1M-read library is 50 reads; from a 50M-read library it is 2,500");
say(`  Poisson CV of the count: ${pct(1 / Math.sqrt(50))} against ${pct(1 / Math.sqrt(2500))} — the unit is the same, the certainty is not, and DESeq2 asks for the count because the count carries it`);

/* ============================================================================
 * M2 · DESEQ2 — size factors, dispersion, shrinkage, the test, the vst
 * ========================================================================== */
say("M2 DESEQ2 — 4,000 genes, 3 vs 3, trend alpha = 0.05 + 2/mu with lognormal spread sd 0.5; 10% of genes DE");
const M2 = {};
{
  const rng = makeRng(7);
  const G = 4000, n = 3;
  const depth = [0.6, 1.0, 1.6, 0.8, 1.3, 2.0]; // true size factors
  const mu0 = Array.from({ length: G }, () => Math.exp(rng.normal(Math.log(80), 1.8)));
  const trend = (mu) => 0.05 + 2 / mu;
  const alphaT = mu0.map((m) => trend(m) * Math.exp(rng.normal(0, 0.5)));
  const isDE = Array.from({ length: G }, (_, i) => i % 10 === 0);
  const lfcT = isDE.map((d) => (d ? (rng.next() < 0.5 ? -1 : 1) * (0.7 + 1.5 * rng.next()) : 0));
  const grp = [0, 0, 0, 1, 1, 1];
  const counts = mu0.map((m, g) => grp.map((gr, j) => nbDraw(rng, m * depth[j] * (gr ? 2 ** lfcT[g] : 1), alphaT[g])));
  // size factors, median of ratios
  const logGeo = counts.map((row) => (row.every((v) => v > 0) ? mean(row.map(Math.log)) : NaN));
  const sf = grp.map((_, j) => Math.exp(median(counts.map((row, g) => Math.log(row[j]) - logGeo[g]).filter(Number.isFinite))));
  const sfN = sf.map((s) => s / Math.exp(mean(sf.map(Math.log))));
  const depthN = depth.map((s) => s / Math.exp(mean(depth.map(Math.log))));
  say(`  size factors, median of ratios: ${sfN.map((v) => f(v, 3)).join(" ")} | true (geometric-mean centred): ${depthN.map((v) => f(v, 3)).join(" ")}; max error ${f(Math.max(...sfN.map((v, j) => Math.abs(v / depthN[j] - 1))), 3)}`);
  // per-gene: group means q, gene-wise MLE dispersion
  const q = counts.map((row) => [0, 1].map((gr) => mean(row.filter((_, j) => grp[j] === gr).map((v, k) => v / sf[grp.indexOf(gr) + k]))));
  const baseMean = counts.map((row) => mean(row.map((v, j) => v / sf[j])));
  const mus = counts.map((row, g) => row.map((_, j) => Math.max(1e-6, q[g][grp[j]] * sf[j])));
  // Cox–Reid adjusted profile likelihood, as DESeq2 fits it: ll − ½ log det(XᵀWX) with W = μ/(1 + αμ).
  // For a two-group design the determinant is the product of the two groups' weight sums. Without
  // the adjustment the gene-wise MLE with three replicates sits low, and the trend fitted through
  // it sits at half its true height (the first run of this script: a0 0.028, a1 0.92 against 0.05, 2).
  const crLogLik = (row, mu, alpha) => {
    let ll = nbLogLik(row, mu, alpha), det = 0;
    for (const gr of [0, 1]) { let w = 0; for (let j = 0; j < row.length; j += 1) if (grp[j] === gr) w += mu[j] / (1 + alpha * mu[j]); det += Math.log(w); }
    return ll - 0.5 * det;
  };
  const alphaGW = counts.map((row, g) => Math.exp(argmaxGolden((la) => crLogLik(row, mus[g], Math.exp(la)), -9, 4)));
  // trend: a0 + a1/mu, fitted on binned medians (a stand-in for DESeq2's gamma GLM)
  const fitTrend = () => {
    const ok = [...Array(G).keys()].filter((g) => baseMean[g] > 5 && alphaGW[g] > 1e-4);
    const order = ok.sort((a, b) => baseMean[a] - baseMean[b]);
    const bins = 25, xs = [], ys = [];
    for (let b = 0; b < bins; b += 1) {
      const sl = order.slice(Math.floor((b * order.length) / bins), Math.floor(((b + 1) * order.length) / bins));
      xs.push(1 / median(sl.map((g) => baseMean[g]))); ys.push(median(sl.map((g) => alphaGW[g])));
    }
    const mx = mean(xs), my = mean(ys);
    const a1 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return { a0: Math.max(1e-4, my - a1 * mx), a1: Math.max(0, a1) };
  };
  const tr = fitTrend();
  const alphaTr = baseMean.map((m) => tr.a0 + tr.a1 / m);
  say(`  trend fitted a0 ${f(tr.a0, 3)} a1 ${f(tr.a1, 2)} (true 0.05, 2)`);
  // prior width: residual variance minus the sampling variance of a log-dispersion MLE, floored at 0.25 (DESeq2)
  const resid = [...Array(G).keys()].filter((g) => baseMean[g] > 5 && alphaGW[g] > 1e-4).map((g) => Math.log(alphaGW[g]) - Math.log(alphaTr[g]));
  const madSd = 1.4826 * median(resid.map((r) => Math.abs(r - median(resid))));
  const trigamma2 = 0.6449; // trigamma((m - p)/2) with m = 6, p = 2
  const priorVar = Math.max(madSd * madSd - trigamma2, 0.25);
  const alphaMAP = counts.map((row, g) => {
    const lt = Math.log(alphaTr[g]);
    const la = argmaxGolden((x) => crLogLik(row, mus[g], Math.exp(x)) - ((x - lt) ** 2) / (2 * priorVar), -9, 4);
    // DESeq2 leaves a gene above the trend by more than 2 residual sd on its own estimate
    return Math.log(alphaGW[g]) - lt > 2 * Math.sqrt(priorVar) ? alphaGW[g] : Math.exp(la);
  });
  say(`  residual sd of log gene-wise dispersion about the trend ${f(madSd, 2)}; prior sd ${f(Math.sqrt(priorVar), 2)}`);
  const lo = [...Array(G).keys()].filter((g) => baseMean[g] < 20 && !isDE[g]);
  const err = (est) => median(lo.map((g) => Math.abs(Math.log(est[g] / alphaT[g]))));
  say(`  low-count null genes (baseMean < 20, n = ${lo.length}): median |log error| of the dispersion — gene-wise ${f(err(alphaGW), 2)}, shrunk ${f(err(alphaMAP), 2)}; gene-wise at the floor (alpha < 1e-3): ${pct(lo.filter((g) => alphaGW[g] < 1e-3).length / lo.length)}`);
  // Wald test with each dispersion
  const test = (alpha) => counts.map((row, g) => {
    const varLog = [0, 1].map((gr) => 1 / grp.reduce((s, gg, j) => s + (gg === gr ? mus[g][j] / (1 + alpha[g] * mus[g][j]) : 0), 0));
    const lfc = log2(Math.max(q[g][1], 0.1) / Math.max(q[g][0], 0.1));
    const se = Math.sqrt(varLog[0] + varLog[1]) / Math.LN2;
    return { lfc, se, p: 2 * normalSf(Math.abs(lfc / se)) };
  });
  const expressed = [...Array(G).keys()].filter((g) => baseMean[g] >= 1);
  for (const [name, alpha] of [["gene-wise", alphaGW], ["shrunk (MAP)", alphaMAP], ["true", alphaT]]) {
    const r = test(alpha);
    const padj = bh(expressed.map((g) => r[g].p));
    const nullG = expressed.filter((g, k) => !isDE[g] && padj[k] < 0.1).length, deG = expressed.filter((g, k) => isDE[g] && padj[k] < 0.1).length;
    const nullAll = expressed.filter((g) => !isDE[g]).length, deAll = expressed.filter((g) => isDE[g]).length;
    const fdr = nullG / Math.max(1, nullG + deG);
    say(`  ${name.padEnd(13)}: p < 0.05 among null ${pct(expressed.filter((g) => !isDE[g] && r[g].p < 0.05).length / nullAll)} | padj < 0.1: ${nullG} null + ${deG} of ${deAll} DE -> realised FDR ${pct(fdr)}`);
    if (name === "shrunk (MAP)") M2.res = r;
    if (name === "gene-wise") M2.resGW = r;
  }
  // the LFC funnel and LFC shrinkage (normal prior; apeglm-like)
  const r = M2.res;
  const binsBM = [[0, 10], [10, 100], [100, 1000], [1000, 1e9]];
  // LFC shrinkage with a spike-and-normal prior fitted by EM (ashr with one normal component): a
  // single normal prior fitted to 90% null genes shrinks with sd 0.22 and erases the true effects
  // too (the first run: 274 -> 11 DE genes kept at |LFC| > 1). The mixture keeps them.
  // fitted by a grid over the marginal likelihood — a moment EM collapsed the effect component
  // onto the spike (null share 0.10, effect sd 0.10) and shrank every true effect to nothing
  let pi0 = 0.9, tau2 = 1, bestLL = -Infinity;
  const gsE = expressed;
  const ll2 = (p0, t2) => gsE.reduce((s, g) => { const v0 = r[g].se ** 2, v1 = v0 + t2; return s + Math.log((p0 / Math.sqrt(v0)) * Math.exp(-(r[g].lfc ** 2) / (2 * v0)) + ((1 - p0) / Math.sqrt(v1)) * Math.exp(-(r[g].lfc ** 2) / (2 * v1)) + 1e-300); }, 0);
  for (const p0 of [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.99]) for (const t of [0.3, 0.5, 0.7, 1, 1.3, 1.6, 2, 2.5, 3]) { const v = ll2(p0, t * t); if (v > bestLL) { bestLL = v; pi0 = p0; tau2 = t * t; } }
  const shrinkLfc = (g) => { const v0 = r[g].se ** 2, v1 = v0 + tau2; const l0 = (pi0 / Math.sqrt(v0)) * Math.exp(-(r[g].lfc ** 2) / (2 * v0)), l1 = ((1 - pi0) / Math.sqrt(v1)) * Math.exp(-(r[g].lfc ** 2) / (2 * v1)); return (l1 / (l0 + l1)) * r[g].lfc * (tau2 / v1); };
  say(`  LFC shrinkage prior: null share ${f(pi0, 2)} (true 0.90), effect sd ${f(Math.sqrt(tau2), 2)}; per baseMean bin, NULL genes with |LFC| > 1 before -> after shrinking, and the median SE:`);
  for (const [a, b] of binsBM) {
    const gs = expressed.filter((g) => !isDE[g] && baseMean[g] >= a && baseMean[g] < b);
    if (!gs.length) continue;
    const big = gs.filter((g) => Math.abs(r[g].lfc) > 1).length;
    const bigS = gs.filter((g) => Math.abs(shrinkLfc(g)) > 1).length;
    say(`    baseMean ${String(a).padStart(4)}–${b === 1e9 ? "   " : String(b).padStart(4)}: n ${String(gs.length).padStart(4)}, |LFC| > 1: ${String(big).padStart(3)} -> ${String(bigS).padStart(3)}, median SE ${f(median(gs.map((g) => r[g].se)), 2)}`);
  }
  const deBig = expressed.filter((g) => isDE[g] && Math.abs(lfcT[g]) > 1);
  say(`  DE genes with a true |LFC| > 1 (n ${deBig.length}): read as |LFC| > 1 before ${deBig.filter((g) => Math.abs(r[g].lfc) > 1).length}, after shrinking ${deBig.filter((g) => Math.abs(shrinkLfc(g)) > 1).length}; of those with baseMean < 10: ${deBig.filter((g) => baseMean[g] < 10).length} true, ${deBig.filter((g) => baseMean[g] < 10 && Math.abs(shrinkLfc(g)) > 1).length} kept`);
  // vst, closed form for the parametric trend (DESeq2's vst for fitType = "parametric")
  const vst = (x) => log2((1 + tr.a1 + 2 * tr.a0 * x + 2 * Math.sqrt(tr.a0 * x * (1 + tr.a1 + tr.a0 * x))) / (4 * tr.a0));
  say(`  SD across the six replicates (null genes, normalised counts) by mean, for raw, log2(x + 1) and vst:`);
  const binsV = [[1, 5], [5, 20], [20, 100], [100, 1000], [1000, 1e9]];
  const rows = [];
  for (const [a, b] of binsV) {
    const gs = [...Array(G).keys()].filter((g) => !isDE[g] && baseMean[g] >= a && baseMean[g] < b);
    const norm = gs.map((g) => counts[g].map((v, j) => v / sf[j]));
    const s = (fn) => median(norm.map((row) => sd(row.map(fn))));
    rows.push({ bin: `${a}–${b === 1e9 ? "" : b}`, raw: s((v) => v), log: s((v) => log2(v + 1)), vst: s(vst) });
    say(`    mean ${String(a).padStart(4)}–${b === 1e9 ? "    " : String(b).padStart(4)}: raw ${f(rows.at(-1).raw, 1).padStart(6)}  log2(x+1) ${f(rows.at(-1).log, 2)}  vst ${f(rows.at(-1).vst, 2)}`);
  }
  M2.vstRows = rows; M2.trend = tr; M2.priorSd = Math.sqrt(priorVar);
}

/* --- M2r · the lesson's own results table --- */
say("M2r THE LESSON'S OUTPUT — results_DESeq2.tsv (ashr-shrunk LFC, protein-coding, one row per symbol)");
{
  const file = path.resolve(here, "../../../jupyterbook/phm5003/notebook/08 - RNAseq Expression Analysis/results_DESeq2.tsv");
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf8").split("\n").slice(1).filter(Boolean);
    const rows = lines.map((l) => { const c = l.split("\t"); return { bm: +c[1], lfc: +c[2], se: +c[3], p: +c[4], padj: +c[5], name: c[6] }; });
    say(`  ${rows.length} genes; baseMean quartiles ${[0.25, 0.5, 0.75].map((p) => f(Float64Array.from(rows.map((r) => r.bm)).sort()[Math.floor(p * rows.length)], 1)).join(" / ")}; padj NA (filtered) ${rows.filter((r) => !Number.isFinite(r.padj)).length}`);
    say(`  by baseMean: n, median lfcSE, padj < 0.05, and |LFC| > 1 among those`);
    for (const [a, b] of [[0, 1], [1, 10], [10, 100], [100, 1000], [1000, 1e4], [1e4, 1e9]]) {
      const gs = rows.filter((r) => r.bm >= a && r.bm < b);
      if (!gs.length) continue;
      const sig = gs.filter((r) => r.padj < 0.05);
      say(`    ${String(a).padStart(5)}–${b === 1e9 ? "     " : String(b).padStart(5)}: n ${String(gs.length).padStart(5)}, lfcSE ${f(median(gs.map((r) => r.se)), 2)}, padj<0.05 ${pct(sig.length / gs.length).padStart(6)}, of which |LFC|>1 ${pct(sig.length ? sig.filter((r) => Math.abs(r.lfc) > 1).length / sig.length : 0)}`);
    }
    const par = rows.filter((r) => r.name === "GPC3" || r.name === "AFP" || r.name === "DLK1" || r.name === "CDK1" || r.name === "EGFR" || r.name === "BRAF");
    say(`  named genes: ${par.map((r) => `${r.name} LFC ${f(r.lfc, 2)} padj ${r.padj.toExponential(1)}`).join(" | ")}`);
  } else say("  (file not found — skipped)");
}

/* ============================================================================
 * M4 · GRAPH CLUSTERS — kNN, SNN, Louvain at a resolution
 * ========================================================================== */
function knn(X, k) {
  const n = X.length, out = [];
  for (let i = 0; i < n; i += 1) {
    const d = [];
    for (let j = 0; j < n; j += 1) if (j !== i) { let s = 0; for (let t = 0; t < X[i].length; t += 1) s += (X[i][t] - X[j][t]) ** 2; d.push([s, j]); }
    d.sort((a, b) => a[0] - b[0]);
    out.push(d.slice(0, k).map((e) => e[1]));
  }
  return out;
}
function snnGraph(nn, prune = 1 / 15) { // Seurat: Jaccard over kNN sets, edges under 1/15 dropped
  const n = nn.length, sets = nn.map((a, i) => new Set([...a, i])), adj = Array.from({ length: n }, () => new Map());
  for (let i = 0; i < n; i += 1) {
    const cand = new Set(); for (const j of nn[i]) { cand.add(j); for (const l of nn[j]) cand.add(l); }
    for (const j of cand) {
      if (j <= i) continue;
      let inter = 0; for (const v of sets[i]) if (sets[j].has(v)) inter += 1;
      const jac = inter / (sets[i].size + sets[j].size - inter);
      if (jac >= prune) { adj[i].set(j, jac); adj[j].set(i, jac); }
    }
  }
  return adj;
}
function louvain(adj, gamma, rng) {
  const n = adj.length;
  const k = adj.map((m) => [...m.values()].reduce((s, w) => s + w, 0));
  const m2 = k.reduce((s, v) => s + v, 0); // 2m
  let comm = [...Array(n).keys()], tot = k.slice();
  const order = [...Array(n).keys()];
  let moved = true, passes = 0;
  while (moved && passes < 30) {
    moved = false; passes += 1;
    for (let t = order.length - 1; t > 0; t -= 1) { const s = Math.floor(rng.next() * (t + 1)); [order[t], order[s]] = [order[s], order[t]]; }
    for (const i of order) {
      const ci = comm[i]; tot[ci] -= k[i];
      const wTo = new Map();
      for (const [j, w] of adj[i]) wTo.set(comm[j], (wTo.get(comm[j]) ?? 0) + w);
      let best = ci, bestGain = (wTo.get(ci) ?? 0) - (gamma * k[i] * tot[ci]) / m2;
      for (const [c, w] of wTo) { const gain = w - (gamma * k[i] * tot[c]) / m2; if (gain > bestGain + 1e-12) { bestGain = gain; best = c; } }
      tot[best] += k[i];
      if (best !== ci) { comm[i] = best; moved = true; }
    }
  }
  // one aggregation level, then local moving again on the aggregated graph
  const ids = [...new Set(comm)], map = new Map(ids.map((c, i) => [c, i]));
  comm = comm.map((c) => map.get(c));
  const N = ids.length, A2 = Array.from({ length: N }, () => new Map());
  for (let i = 0; i < n; i += 1) for (const [j, w] of adj[i]) { const a = comm[i], b = comm[j]; if (a !== b) A2[a].set(b, (A2[a].get(b) ?? 0) + w); else A2[a].set(a, (A2[a].get(a) ?? 0) + w); }
  const k2 = A2.map((mm) => [...mm.values()].reduce((s, w) => s + w, 0)), tot2 = k2.slice();
  let c2 = [...Array(N).keys()]; moved = true; passes = 0;
  while (moved && passes < 30) {
    moved = false; passes += 1;
    for (let i = 0; i < N; i += 1) {
      const ci = c2[i]; tot2[ci] -= k2[i];
      const wTo = new Map(); for (const [j, w] of A2[i]) if (j !== i) wTo.set(c2[j], (wTo.get(c2[j]) ?? 0) + w);
      let best = ci, bestGain = (wTo.get(ci) ?? 0) - (gamma * k2[i] * tot2[ci]) / m2;
      for (const [c, w] of wTo) { const gain = w - (gamma * k2[i] * tot2[c]) / m2; if (gain > bestGain + 1e-12) { bestGain = gain; best = c; } }
      tot2[best] += k2[i]; if (best !== ci) { c2[i] = best; moved = true; }
    }
  }
  const final = comm.map((c) => c2[c]);
  const ids2 = [...new Set(final)], map2 = new Map(ids2.map((c, i) => [c, i]));
  return final.map((c) => map2.get(c));
}
function ari(a, b) {
  const n = a.length, A = new Map(), B = new Map(), AB = new Map();
  for (let i = 0; i < n; i += 1) { A.set(a[i], (A.get(a[i]) ?? 0) + 1); B.set(b[i], (B.get(b[i]) ?? 0) + 1); const k = `${a[i]}|${b[i]}`; AB.set(k, (AB.get(k) ?? 0) + 1); }
  const c2 = (x) => (x * (x - 1)) / 2;
  const sAB = [...AB.values()].reduce((s, v) => s + c2(v), 0), sA = [...A.values()].reduce((s, v) => s + c2(v), 0), sB = [...B.values()].reduce((s, v) => s + c2(v), 0);
  const exp = (sA * sB) / c2(n), max = (sA + sB) / 2;
  return (sAB - exp) / (max - exp);
}
say("M4 GRAPH CLUSTERS — 600 cells in 10 PCs: three types of 200 / 120 / 80 at centre spread 1.3, and 200 cells along a continuum of length 7 (a differentiating lineage); kNN k = 20, SNN pruned at 1/15, Louvain by resolution");
const M4 = {};
{
  const rng = makeRng(3);
  const sizes = [200, 120, 80], D = 10;
  const centres = sizes.map(() => Array.from({ length: D }, () => rng.normal(0, 1.3)));
  const X = [], truth = [];
  sizes.forEach((s, t) => { for (let i = 0; i < s; i += 1) { X.push(centres[t].map((c) => c + rng.normal(0, 1))); truth.push(t); } });
  // a continuum: cells spread along a line of length 7 in a direction away from the types; the truth calls it ONE type
  const dir = Array.from({ length: D }, () => rng.normal(0, 1)); const dn = Math.sqrt(dir.reduce((s, v) => s + v * v, 0)); for (let t = 0; t < D; t += 1) dir[t] /= dn;
  const start = Array.from({ length: D }, () => rng.normal(0, 1.3) + 3);
  for (let i = 0; i < 200; i += 1) { const u = 7 * rng.next(); X.push(start.map((c, t) => c + u * dir[t] + rng.normal(0, 1))); truth.push(3); }
  const nn = knn(X, 20), adj = snnGraph(nn);
  const line = [];
  for (const res of [0.05, 0.1, 0.3, 0.5, 0.8, 1.2, 2.0]) {
    const best = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => louvain(adj, res, makeRng(100 + s))).map((c) => ({ c, k: new Set(c).size })).sort((a, b) => a.k - b.k)[5];
    line.push(`r ${res}: ${best.k} clusters, ARI ${f(ari(truth, best.c), 2)}`);
    M4[res] = { k: best.k, ari: +ari(truth, best.c).toFixed(3) };
  }
  say(`  ${line.join(" | ")}`);
  say(`  the notebook's resolution 0.3 on 31,014 cells gave 12 communities; the count is the resolution's, the cells are the same`);
}

/* ============================================================================
 * M5 · INTEGRATION — mutual nearest neighbours, and a type in one batch only
 * ========================================================================== */
say("M5 INTEGRATION — two batches in 10 PCs; types A, B, C in both (200 each); a batch shift of norm 4; MNN k = 20");
function mnnCorrect(X1, X2, k, sigma) {
  const nn12 = knnBetween(X1, X2, k), nn21 = knnBetween(X2, X1, k);
  const pairs = [];
  for (let i = 0; i < X1.length; i += 1) for (const j of nn12[i]) if (nn21[j].includes(i)) pairs.push([i, j]);
  const D = X1[0].length;
  const corr = pairs.map(([i, j]) => X1[i].map((v, t) => v - X2[j][t]));
  const out = X2.map((x) => {
    let wsum = 0; const acc = new Array(D).fill(0);
    pairs.forEach(([, j], p) => { let d2 = 0; for (let t = 0; t < D; t += 1) d2 += (x[t] - X2[j][t]) ** 2; const w = Math.exp(-d2 / (2 * sigma * sigma)); wsum += w; for (let t = 0; t < D; t += 1) acc[t] += w * corr[p][t]; });
    return wsum > 0 ? x.map((v, t) => v + acc[t] / wsum) : x.slice();
  });
  return { corrected: out, pairs: pairs.length };
}
function knnBetween(A, B, k) {
  return A.map((a) => B.map((b, j) => { let s = 0; for (let t = 0; t < a.length; t += 1) s += (a[t] - b[t]) ** 2; return [s, j]; }).sort((x, y) => x[0] - y[0]).slice(0, k).map((e) => e[1]));
}
const M5 = {};
{
  const rng = makeRng(5);
  const D = 10, types = ["A", "B", "C", "D"];
  const centres = types.map(() => Array.from({ length: D }, () => rng.normal(0, 2.2)));
  const shift = Array.from({ length: D }, () => rng.normal(0, 1)); const sn = Math.sqrt(shift.reduce((s, v) => s + v * v, 0)); for (let t = 0; t < D; t += 1) shift[t] *= 4 / sn;
  const make = (batch, present) => { const X = [], lab = []; present.forEach((t) => { for (let i = 0; i < (t === 3 ? 150 : 200); i += 1) { X.push(centres[t].map((c, d) => c + rng.normal(0, 1) + (batch ? shift[d] : 0))); lab.push(t); } }); return { X, lab }; };
  const majorityType = (X2, lab2, X1, lab1) => {
    const nn = knnBetween(X2, X1, 20);
    const table = {};
    types.forEach((t, ti) => { const idx = lab2.map((l, i) => (l === ti ? i : -1)).filter((i) => i >= 0); if (!idx.length) return; const votes = new Map(); idx.forEach((i) => nn[i].forEach((j) => votes.set(lab1[j], (votes.get(lab1[j]) ?? 0) + 1))); const tot = [...votes.values()].reduce((s, v) => s + v, 0); table[t] = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([l, v]) => `${types[l]} ${pct(v / tot)}`).slice(0, 2).join(", "); });
    return table;
  };
  const mixing = (X1, X2) => { // fraction of each cell's 20 nearest (both batches) from the other batch; 0.5 is perfect
    const all = [...X1, ...X2], b = [...X1.map(() => 0), ...X2.map(() => 1)], nn = knn(all, 20);
    return mean(nn.map((a, i) => a.filter((j) => b[j] !== b[i]).length / 20));
  };
  const centroid = (X, lab, t) => { const idx = lab.map((l, i) => (l === t ? i : -1)).filter((i) => i >= 0); return X[0].map((_, d) => mean(idx.map((i) => X[i][d]))); };
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, d) => s + (v - b[d]) ** 2, 0));
  for (const [name, present2] of [["type D in BOTH batches", [0, 1, 2, 3]], ["type D in batch 2 ONLY", [0, 1, 2, 3]]]) {
    const b1 = make(0, name.includes("BOTH") ? [0, 1, 2, 3] : [0, 1, 2]), b2 = make(1, present2);
    const before = majorityType(b2.X, b2.lab, b1.X, b1.lab), mixB = mixing(b1.X, b2.X);
    const { corrected, pairs } = mnnCorrect(b1.X, b2.X, 20, 2.5);
    const after = majorityType(corrected, b2.lab, b1.X, b1.lab), mixA = mixing(b1.X, corrected);
    say(`  ${name}: ${pairs} MNN pairs; batch mixing ${f(mixB, 2)} -> ${f(mixA, 2)} (0.5 is fully mixed)`);
    say(`    batch-2 cells' nearest batch-1 type, before: ${types.filter((t) => before[t]).map((t) => `${t}->${before[t]}`).join(" | ")}`);
    say(`    after:                                   ${types.filter((t) => after[t]).map((t) => `${t}->${after[t]}`).join(" | ")}`);
    // where type D's centroid lands, in within-type SDs (= 1), from each batch-1 centroid
    const present1 = [...new Set(b1.lab)];
    const dB = present1.map((t) => `${types[t]} ${f(dist(centroid(b2.X, b2.lab, 3), centroid(b1.X, b1.lab, t)), 1)}`).join(", ");
    const dA = present1.map((t) => `${types[t]} ${f(dist(centroid(corrected, b2.lab, 3), centroid(b1.X, b1.lab, t)), 1)}`).join(", ");
    say(`    distance of D's centroid to batch-1 centroids (within-type sd = 1): before ${dB} | after ${dA}`);
    // which batch-1 type D's own MNN pairs point at
    const nn12 = knnBetween(b1.X, b2.X, 20), nn21 = knnBetween(b2.X, b1.X, 20);
    const votes = new Map(); let nD = 0;
    for (let j = 0; j < b2.X.length; j += 1) if (b2.lab[j] === 3) for (const i of nn21[j]) if (nn12[i].includes(j)) { nD += 1; votes.set(b1.lab[i], (votes.get(b1.lab[i]) ?? 0) + 1); }
    say(`    MNN pairs from D cells: ${nD}, paired with ${[...votes.entries()].sort((a, b) => b[1] - a[1]).map(([l, v]) => `${types[l]} ${pct(v / nD)}`).join(", ")}`);
    // Harmony, simplified: soft k-means over both batches with the diversity penalty
    // (R ∝ exp(−d²/σ) · (E/O)^θ, θ = 2), then per cluster each batch is moved by
    // (its own centroid − the cluster's), five rounds. The penalty is what pulls a
    // batch-only cluster apart: a cluster of one batch scores E/O < 1 for that batch.
    const H = harmony([...b1.X, ...b2.X], [...b1.X.map(() => 0), ...b2.X.map(() => 1)], 8, 2, makeRng(21));
    const h1 = H.slice(0, b1.X.length), h2 = H.slice(b1.X.length);
    const afterH = majorityType(h2, b2.lab, h1, b1.lab), mixH = mixing(h1, h2);
    const dH = present1.map((t) => `${types[t]} ${f(dist(centroid(h2, b2.lab, 3), centroid(h1, b1.lab, t)), 1)}`).join(", ");
    say(`    Harmony (simplified, theta 2): mixing ${f(mixH, 2)}; D's nearest batch-1 type ${afterH.D}; D's centroid to batch-1 centroids: ${dH}`);
    M5[name] = { pairs, mixB: +mixB.toFixed(3), mixA: +mixA.toFixed(3), before, after, dB, dA, nD, mixH: +mixH.toFixed(3), afterH, dH };
  }
  function harmony(X, batch, K, theta, rng) {
    const n = X.length, D = X[0].length, nb = 2;
    let Z = X.map((x) => x.slice());
    const Nb = [batch.filter((b) => b === 0).length, batch.filter((b) => b === 1).length];
    for (let round = 0; round < 5; round += 1) {
      // k-means++ seeds on the corrected data, then soft assignment with the diversity term
      let C = [Z[Math.floor(rng.next() * n)].slice()];
      while (C.length < K) { const d2 = Z.map((z) => Math.min(...C.map((c) => c.reduce((s, v, t) => s + (v - z[t]) ** 2, 0)))); const tot = d2.reduce((s, v) => s + v, 0); let u = rng.next() * tot, i = 0; while (u > d2[i]) { u -= d2[i]; i += 1; } C.push(Z[i].slice()); }
      let R = Array.from({ length: n }, () => new Array(K).fill(1 / K));
      const sigma = 2 * D; // squared-distance scale
      // O_kb kept incrementally and R updated one random block of cells at a time, as Harmony does:
      // updating every cell at once lets a whole batch flip cluster together and the clusters stay pure
      // (the first run of this stand-in: displacement 0.01, mixing unchanged).
      const O = Array.from({ length: K }, () => [0, 0]);
      for (let i = 0; i < n; i += 1) for (let k = 0; k < K; k += 1) O[k][batch[i]] += R[i][k];
      const idx = [...Array(n).keys()];
      for (let it = 0; it < 15; it += 1) {
        for (let t = n - 1; t > 0; t -= 1) { const s = Math.floor(rng.next() * (t + 1)); [idx[t], idx[s]] = [idx[s], idx[t]]; }
        const block = Math.max(1, Math.floor(n / 20));
        for (let start = 0; start < n; start += block) {
          const cells = idx.slice(start, start + block);
          for (const i of cells) for (let k = 0; k < K; k += 1) O[k][batch[i]] -= R[i][k];
          const E = O.map((o) => { const tot = Math.max(0, o[0] + o[1]); return [tot * (Nb[0] / n), tot * (Nb[1] / n)]; });
          for (const i of cells) {
            const b = batch[i]; let s = 0;
            for (let k = 0; k < K; k += 1) { const d2 = C[k].reduce((acc, v, t) => acc + (v - Z[i][t]) ** 2, 0); R[i][k] = Math.exp(-d2 / sigma) * Math.pow((E[k][b] + 1) / (Math.max(0, O[k][b]) + 1), theta); s += R[i][k]; }
            for (let k = 0; k < K; k += 1) { R[i][k] /= s; O[k][b] += R[i][k]; }
          }
        }
        for (let k = 0; k < K; k += 1) { const w = R.reduce((s, r) => s + r[k], 0); C[k] = Array.from({ length: D }, (_, t) => R.reduce((s, r, i) => s + r[k] * Z[i][t], 0) / Math.max(w, 1e-9)); }
      }
      // correction: per cluster, move each batch onto the cluster centroid
      const corr = Z.map(() => new Array(D).fill(0));
      for (let k = 0; k < K; k += 1) {
        const w = [0, 0], cb = [new Array(D).fill(0), new Array(D).fill(0)];
        for (let i = 0; i < n; i += 1) { w[batch[i]] += R[i][k]; for (let t = 0; t < D; t += 1) cb[batch[i]][t] += R[i][k] * Z[i][t]; }
        for (let b = 0; b < nb; b += 1) for (let t = 0; t < D; t += 1) cb[b][t] = w[b] > 1e-9 ? cb[b][t] / w[b] : C[k][t];
        for (let i = 0; i < n; i += 1) for (let t = 0; t < D; t += 1) corr[i][t] += R[i][k] * (cb[batch[i]][t] - C[k][t]);
      }
      Z = Z.map((z, i) => z.map((v, t) => v - corr[i][t]));
    }
    return Z;
  }
  say(`  the notebook's layers are patient x type, so tumour against background is integrated as a batch; its cluster 5 (Kupffer by CD163) tested tumour_5 against background_5 and returned GPC3 (LFC 9.9, pct 0.95 vs 0.004), AFP, LIN28B — hepatoblastoma cells sitting in the Kupffer cluster`);
}

/* ============================================================================
 * M6 · MARKERS — specificity, and cells are not replicates
 * ========================================================================== */
function wilcoxonP(a, b) { // rank-sum, normal approximation with ties ignored (fine at these sizes)
  const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  const ranks = new Array(all.length); let i = 0;
  while (i < all.length) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j += 1; const r = (i + j) / 2 + 1; for (let t = i; t <= j; t += 1) ranks[t] = r; i = j + 1; }
  const n1 = a.length, n2 = b.length; let R1 = 0; all.forEach((e, t) => { if (e[1] === 0) R1 += ranks[t]; });
  const U = R1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2, s = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  return 2 * normalSf(Math.abs((U - mu) / s));
}
function tTestP(a, b) {
  const va = sd(a) ** 2, vb = sd(b) ** 2, se = Math.sqrt(va / a.length + vb / b.length), t = (mean(a) - mean(b)) / se;
  const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  // two-sided p via the regularised incomplete beta
  const x = df / (df + t * t);
  return ibeta(x, df / 2, 0.5);
}
function ibeta(x, a, b) { // regularised incomplete beta by continued fraction (NR betacf)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300; const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - (qab * x) / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d; for (let m = 1; m <= MAXIT; m += 1) { const m2 = 2 * m; let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c; aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}
say("M6 MARKERS — cluster of 300 cells against 900 others; log-normalised expression as Seurat's data layer");
const M6 = {};
{
  const rng = makeRng(9);
  const drawCells = (n, rate, pctOn) => Array.from({ length: n }, () => (rng.next() < pctOn ? Math.log1p(poissonDraw(rng, rate) * 10) : 0));
  const inA = drawCells(300, 8, 0.9), outA = drawCells(900, 6, 0.85); // a housekeeping-like gene, on everywhere
  const inB = drawCells(300, 6, 0.7), outB = drawCells(900, 4, 0.05); // a marker: on in the cluster, off elsewhere
  const stats = (a, b) => ({ lfc: log2((mean(a.map(Math.expm1)) + 1) / (mean(b.map(Math.expm1)) + 1)), p1: a.filter((v) => v > 0).length / a.length, p2: b.filter((v) => v > 0).length / b.length, p: wilcoxonP(a, b) });
  const sA = stats(inA, outA), sB = stats(inB, outB);
  say(`  gene high everywhere: avg_log2FC ${f(sA.lfc, 2)}, pct.1 ${f(sA.p1, 2)}, pct.2 ${f(sA.p2, 2)}, p ${sA.p.toExponential(1)}`);
  say(`  gene specific to it:  avg_log2FC ${f(sB.lfc, 2)}, pct.1 ${f(sB.p1, 2)}, pct.2 ${f(sB.p2, 2)}, p ${sB.p.toExponential(1)}  -> both p ~ 0; pct.2 is what separates a marker from a gene that is merely expressed`);
  M6.markers = { sA, sB };
  // cells are not replicates
  say("M6b PSEUDOREPLICATION — 2 patients per arm, 400 cells each, a patient effect of sd 0.25 on the log mean, NO condition effect; 400 genes");
  let wilRej = 0, pbRej = 0, wilRej0 = 0;
  const G = 400;
  for (let g = 0; g < G; g += 1) {
    const base = Math.log(3 + 20 * rng.next());
    const pat = [0, 1, 2, 3].map(() => rng.normal(0, 0.25));
    const cells = pat.map((pe) => Array.from({ length: 400 }, () => poissonDraw(rng, Math.exp(base + pe) * gammaDraw(rng, 2, 0.5))));
    const cellsNoPat = pat.map(() => Array.from({ length: 400 }, () => poissonDraw(rng, Math.exp(base) * gammaDraw(rng, 2, 0.5))));
    const logn = (a) => a.map((v) => Math.log1p(v));
    if (wilcoxonP(logn([...cells[0], ...cells[1]]), logn([...cells[2], ...cells[3]])) < 0.05) wilRej += 1;
    if (wilcoxonP(logn([...cellsNoPat[0], ...cellsNoPat[1]]), logn([...cellsNoPat[2], ...cellsNoPat[3]])) < 0.05) wilRej0 += 1;
    const pb = cells.map((c) => Math.log1p(mean(c)));
    if (tTestP([pb[0], pb[1]], [pb[2], pb[3]]) < 0.05) pbRej += 1;
  }
  say(`  null genes called at p < 0.05 — Wilcoxon over cells: ${pct(wilRej / G)} (with no patient effect: ${pct(wilRej0 / G)}); pseudobulk t-test over 2 vs 2 patients: ${pct(pbRej / G)}`);
  say(`  the notebook's FindMarkers output prints p_val 0 for its top rows over 31,014 cells from two patients — the same mechanism`);
  M6.pseudo = { wil: wilRej / G, wil0: wilRej0 / G, pb: pbRej / G };
}

fs.writeFileSync(path.join(here, "rnaseq-measure.json"), JSON.stringify({ M2: { vstRows: M2.vstRows, trend: M2.trend, priorSd: M2.priorSd }, M4, M5, M6, findings }, null, 1));
console.log(`\nwrote ${path.join(here, "rnaseq-measure.json")}`);
