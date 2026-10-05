/* ============================================================================
   The proteomics and metabolomics arc (PHM5003 09) — the arithmetic for the
   measurement (`proteomics-arc-measure.mjs`) and the mock
   (`proteomics-arc-mock.html`), in one module so the page draws the numbers
   the script prints.

   Four parts, one per picked slot:
     A · 88 target-decoy  — PSM scores, the decoy estimate of the FDR, q-values;
                            protein inference by parsimony
     B · 89 imputation    — a log2 protein matrix with a detection limit, and
                            five ways to fill it (minimum, low draw, kNN, random
                            forest as missForest runs it)
     C · 90 limma         — per-protein variances, limma's fitFDist and the
                            moderated t
     D · 91 qc-drift      — an injection sequence with pooled QCs, per-metabolite
                            drift, median normalization against QC-LOESS

   Every draw comes from the seeded rng passed in. Nothing here touches the DOM.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { tTailP } from "../core/stats.js";

export { makeRng, tTailP };

/* ---------------------------------------------------------------- helpers */

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function variance(a) {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function quantile(a, q) {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

/** Benjamini–Hochberg adjusted p-values, in the input order. */
export function bh(p) {
  const m = p.length;
  const idx = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
  const out = new Array(m);
  let run = 1;
  for (let r = m - 1; r >= 0; r -= 1) {
    run = Math.min(run, (p[idx[r]] * m) / (r + 1));
    out[idx[r]] = run;
  }
  return out;
}

/** Welch's t-test, two-sided. */
export function welch(a, b) {
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  return { t, df, p: tTailP(Math.abs(t), df) };
}

/** Pooled two-sample t-test (what lmFit fits with one group factor). */
export function pooledT(a, b) {
  const df = a.length + b.length - 2;
  const s2 = ((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / df;
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(s2 * (1 / a.length + 1 / b.length));
  const t = diff / se;
  return { diff, s2, df, t, p: tTailP(Math.abs(t), df), unscaled: 1 / a.length + 1 / b.length };
}

function gumbel(rng, loc, scale) {
  let u = 0;
  while (u === 0) u = rng.next();
  return loc - scale * Math.log(-Math.log(u));
}

/* ======================================================= A · target-decoy */

/**
 * One search. Each spectrum's best match is the highest of: the correct
 * peptide (if the spectrum's peptide is in the database at all), the best
 * wrong target and the best decoy. Wrong targets and decoys come from the
 * same null — that equality is the whole method — so above any threshold the
 * decoys count roughly as many wrong matches as hide among the targets.
 */
export function simulateSearch(rng, {
  n = 5000, inDb = 0.6, nullLoc = 0, nullScale = 1, correctMu = 6.5, correctSd = 1.5,
} = {}) {
  const psms = [];
  for (let i = 0; i < n; i += 1) {
    const wrongT = gumbel(rng, nullLoc, nullScale);
    const decoy = gumbel(rng, nullLoc, nullScale);
    const hasCorrect = rng.next() < inDb;
    const correct = hasCorrect ? rng.normal(correctMu, correctSd) : -Infinity;
    let score;
    let kind;
    if (correct >= wrongT && correct >= decoy) { score = correct; kind = "correct"; }
    else if (wrongT >= decoy) { score = wrongT; kind = "wrong"; }
    else { score = decoy; kind = "decoy"; }
    psms.push({ score, kind, hasCorrect });
  }
  return psms;
}

/**
 * Walk down the score list: at each target, estimated FDR = decoys / targets
 * above it, true FDR = wrong targets / targets; q-value = the smallest
 * estimated FDR at that score or below.
 */
export function fdrCurve(psms) {
  const s = [...psms].sort((a, b) => b.score - a.score);
  let T = 0, D = 0, W = 0;
  const rows = [];
  for (const m of s) {
    if (m.kind === "decoy") D += 1;
    else { T += 1; if (m.kind === "wrong") W += 1; }
    rows.push({ score: m.score, kind: m.kind, T, D, W, est: T ? D / T : 0, tru: T ? W / T : 0 });
  }
  let q = Infinity;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    q = Math.min(q, rows[i].est);
    rows[i].q = q;
  }
  return rows;
}

/** The accepted list at a q-value level, and what is in it. */
export function acceptAt(rows, level = 0.01) {
  let last = -1;
  for (let i = 0; i < rows.length; i += 1) if (rows[i].q <= level) last = i;
  const acc = rows.slice(0, last + 1).filter((r) => r.kind !== "decoy");
  const threshold = last >= 0 ? rows[last].score : Infinity;
  const wrong = acc.filter((r) => r.kind === "wrong").length;
  // the local rate at the threshold: the last 10% of the accepted targets
  const tail = acc.slice(Math.floor(acc.length * 0.9));
  const tailWrong = tail.filter((r) => r.kind === "wrong").length;
  return {
    threshold, accepted: acc.length, wrong, trueFdr: acc.length ? wrong / acc.length : 0,
    tailN: tail.length, tailWrong, tailRate: tail.length ? tailWrong / tail.length : 0,
  };
}

/* Protein inference by parsimony: widget 88's engine (01-1 cell 2's three rules). */
import { inferProteins } from "../target-decoy/engine.js";
export { inferProteins };

/**
 * A simulated proteome in families: each family a canonical protein and
 * isoforms sharing most of its tryptic peptides. Some proteins are present;
 * each peptide of a present protein is detected with a probability.
 */
export function simulateProteome(rng, { families = 60, isoforms = 2, pepsPer = 10, share = 0.7, present = 0.5, detect = 0.5 } = {}) {
  const proteins = [];
  let pid = 0;
  for (let f = 0; f < families; f += 1) {
    const core = Array.from({ length: pepsPer }, (_, i) => `f${f}p${i}`);
    for (let k = 0; k <= isoforms; k += 1) {
      const peps = k === 0 ? core.slice() : core.filter(() => rng.next() < share).concat(
        Array.from({ length: Math.round(pepsPer * (1 - share)) }, (_, i) => `f${f}i${k}u${i}`));
      proteins.push({ id: `P${pid += 1}`, family: f, peptides: peps, present: rng.next() < present });
    }
  }
  const observed = new Set();
  for (const p of proteins) if (p.present) for (const x of p.peptides) if (rng.next() < detect) observed.add(x);
  return { proteins, observed: [...observed] };
}

/* ======================================================== B · imputation */

/**
 * A log2 protein matrix, rows proteins, columns 11 cancer then 11 healthy
 * (the lesson's design). Detection is a soft limit: the chance a value is
 * missing rises as the true value falls below `lod`, plus a small share of
 * values missing completely at random. `onoff` proteins are absent in
 * healthy — six log2 units below their cancer level.
 */
export function simulateMatrix(rng, {
  proteins = 600, nA = 11, nB = 11, muMean = 24, muSd = 2, sigma = 0.45, de = 0.15, onoff = 0.03,
  lod = 23.3, lodWidth = 0.5, mcar = 0.02,
} = {}) {
  const n = nA + nB;
  const truth = [], obs = [], meta = [];
  for (let p = 0; p < proteins; p += 1) {
    const mu = rng.normal(muMean, muSd);
    const s = sigma * Math.exp(rng.normal(0, 0.3));
    const u = rng.next();
    let fc = 0, kind = "null";
    if (u < onoff) { fc = 6; kind = "onoff"; }
    else if (u < onoff + de) { fc = (rng.next() < 0.5 ? -1 : 1) * rng.uniform(1, 3); kind = "de"; }
    const row = [], orow = [];
    for (let j = 0; j < n; j += 1) {
      const m = j < nA ? mu + fc / 2 : mu - fc / 2;
      const x = rng.normal(m, s);
      row.push(x);
      const pMiss = 1 / (1 + Math.exp((x - lod) / lodWidth));
      const miss = rng.next() < pMiss || rng.next() < mcar;
      orow.push(miss ? NaN : x);
    }
    // a protein seen nowhere would not be in the table at all
    if (orow.every(Number.isNaN)) { p -= 1; continue; }
    truth.push(row); obs.push(orow); meta.push({ mu, fc, kind, sd: s });
  }
  return { truth, obs, meta, nA, nB };
}

const colOf = (M, j) => M.map((r) => r[j]);

/** Each sample's minimum observed value. */
export function imputeMin(M) {
  const n = M[0].length;
  const mins = Array.from({ length: n }, (_, j) => Math.min(...colOf(M, j).filter((v) => !Number.isNaN(v))));
  return M.map((r) => r.map((v, j) => (Number.isNaN(v) ? mins[j] : v)));
}

/** A draw from low in each sample's distribution (MinProb: the 1% quantile, a narrow spread). */
export function imputeLowDraw(M, rng, { q = 0.01, tune = 1 } = {}) {
  const n = M[0].length;
  const sds = M.map((r) => r.filter((v) => !Number.isNaN(v))).filter((r) => r.length > 2).map((r) => Math.sqrt(variance(r)));
  const spread = median(sds) * tune;
  const qs = Array.from({ length: n }, (_, j) => quantile(colOf(M, j).filter((v) => !Number.isNaN(v)), q));
  return M.map((r) => r.map((v, j) => (Number.isNaN(v) ? rng.normal(qs[j], spread) : v)));
}

/**
 * impute.knn as the Bioconductor `impute` package runs it: for a protein with
 * a missing value in sample j, the k proteins nearest to it (Euclidean over
 * the samples both observed, scaled to the count) that are observed in j,
 * averaged.
 */
export function imputeKnn(M, k = 10) {
  const P = M.length, n = M[0].length;
  const out = M.map((r) => r.slice());
  for (let p = 0; p < P; p += 1) {
    const miss = [];
    for (let j = 0; j < n; j += 1) if (Number.isNaN(M[p][j])) miss.push(j);
    if (!miss.length) continue;
    const d = [];
    for (let q = 0; q < P; q += 1) {
      if (q === p) continue;
      let s = 0, c = 0;
      for (let j = 0; j < n; j += 1) {
        const a = M[p][j], b = M[q][j];
        if (!Number.isNaN(a) && !Number.isNaN(b)) { s += (a - b) ** 2; c += 1; }
      }
      if (c) d.push([q, Math.sqrt((s / c) * n)]);
    }
    d.sort((x, y) => x[1] - y[1]);
    for (const j of miss) {
      const vals = [];
      for (const [q] of d) { if (!Number.isNaN(M[q][j])) vals.push(M[q][j]); if (vals.length === k) break; }
      out[p][j] = vals.length ? mean(vals) : NaN;
    }
  }
  // a protein with no neighbour observed in j: the sample mean (impute.knn's row-mean fallback)
  return out.map((r) => r.map((v, j) => (Number.isNaN(v) ? mean(colOf(M, j).filter((x) => !Number.isNaN(x))) : v)));
}

/* A small regression forest — enough of randomForest for missForest's loop. */
function buildTree(X, y, idx, rng, mtry, minLeaf, depth) {
  const m = mean(idx.map((i) => y[i]));
  if (idx.length < 2 * minLeaf || depth === 0) return { leaf: m };
  const nf = X[0].length;
  const feats = [];
  while (feats.length < mtry) { const f = Math.floor(rng.next() * nf); if (!feats.includes(f)) feats.push(f); }
  let best = null;
  for (const f of feats) {
    const order = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
    let sL = 0, sL2 = 0, sR = 0, sR2 = 0;
    for (const i of order) { sR += y[i]; sR2 += y[i] * y[i]; }
    for (let k = 0; k < order.length - 1; k += 1) {
      const v = y[order[k]];
      sL += v; sL2 += v * v; sR -= v; sR2 -= v * v;
      const nL = k + 1, nR = order.length - nL;
      if (nL < minLeaf || nR < minLeaf) continue;
      if (X[order[k]][f] === X[order[k + 1]][f]) continue;
      const sse = sL2 - (sL * sL) / nL + sR2 - (sR * sR) / nR;
      if (!best || sse < best.sse) best = { sse, f, thr: (X[order[k]][f] + X[order[k + 1]][f]) / 2 };
    }
  }
  if (!best) return { leaf: m };
  const L = idx.filter((i) => X[i][best.f] <= best.thr);
  const R = idx.filter((i) => X[i][best.f] > best.thr);
  return { f: best.f, thr: best.thr,
    l: buildTree(X, y, L, rng, mtry, minLeaf, depth - 1), r: buildTree(X, y, R, rng, mtry, minLeaf, depth - 1) };
}
const predictTree = (t, x) => (t.leaf !== undefined ? t.leaf : predictTree(x[t.f] <= t.thr ? t.l : t.r, x));
function forest(X, y, idx, rng, { trees = 40, minLeaf = 5, depth = 12 } = {}) {
  const mtry = Math.max(1, Math.floor(Math.sqrt(X[0].length)));
  const ts = [];
  for (let t = 0; t < trees; t += 1) {
    const boot = idx.map(() => idx[Math.floor(rng.next() * idx.length)]);
    ts.push(buildTree(X, y, boot, rng, mtry, minLeaf, depth));
  }
  return (x) => mean(ts.map((t) => predictTree(t, x)));
}

/**
 * missForest on the matrix, oriented as tidyproteomics passes it: samples
 * are the variables, proteins the observations. Start from column means; for
 * each sample (fewest missing first) fit a forest on the proteins observed in
 * it, predicting from the other samples' current values; repeat until the
 * change stops falling (missForest's stopping rule), at most `maxIter`.
 */
export function imputeForest(M, rng, { maxIter = 4, trees = 40 } = {}) {
  const P = M.length, n = M[0].length;
  const missCols = Array.from({ length: n }, (_, j) => colOf(M, j).filter(Number.isNaN).length);
  const order = missCols.map((c, j) => j).filter((j) => missCols[j] > 0).sort((a, b) => missCols[a] - missCols[b]);
  let cur = M.map((r) => r.slice());
  for (let j = 0; j < n; j += 1) {
    const m = mean(colOf(M, j).filter((v) => !Number.isNaN(v)));
    for (let p = 0; p < P; p += 1) if (Number.isNaN(cur[p][j])) cur[p][j] = m;
  }
  let prevDiff = Infinity;
  let prev = cur;
  for (let it = 0; it < maxIter; it += 1) {
    const next = cur.map((r) => r.slice());
    for (const j of order) {
      const X = next.map((r) => r.filter((_, k) => k !== j));
      const y = colOf(next, j);
      const seen = [], hole = [];
      for (let p = 0; p < P; p += 1) (Number.isNaN(M[p][j]) ? hole : seen).push(p);
      const f = forest(X, y, seen, rng, { trees });
      for (const p of hole) next[p][j] = f(X[p]);
    }
    let num = 0, den = 0;
    for (let p = 0; p < P; p += 1) for (let j = 0; j < n; j += 1) if (Number.isNaN(M[p][j])) {
      num += (next[p][j] - cur[p][j]) ** 2; den += next[p][j] ** 2;
    }
    const diff = num / den;
    prev = cur;
    cur = next;
    if (diff >= prevDiff) return prev; // missForest returns the previous iteration
    prevDiff = diff;
  }
  return cur;
}

/** Score an imputation against the truth, and the test it feeds. */
export function scoreImputation(sim, filled) {
  const { truth, obs, meta, nA } = sim;
  let n = 0, se = 0, bias = 0;
  for (let p = 0; p < obs.length; p += 1) for (let j = 0; j < obs[p].length; j += 1) if (Number.isNaN(obs[p][j])) {
    const e = filled[p][j] - truth[p][j];
    n += 1; se += e * e; bias += e;
  }
  const tests = filled.map((r) => welch(r.slice(0, nA), r.slice(nA)));
  const padj = bh(tests.map((t) => t.p));
  const fc = filled.map((r) => mean(r.slice(0, nA)) - mean(r.slice(nA)));
  let fp = 0, nul = 0, tp = 0, real = 0;
  meta.forEach((m, p) => {
    if (m.kind === "null") { nul += 1; if (padj[p] < 0.05) fp += 1; } else { real += 1; if (padj[p] < 0.05) tp += 1; }
  });
  const called = fp + tp;
  const onoff = meta.map((m, p) => (m.kind === "onoff" ? fc[p] : null)).filter((v) => v !== null);
  return { rmse: Math.sqrt(se / n), bias: bias / n, missing: n, fp, nul, tp, real, fdr: called ? fp / called : 0,
    onoffFc: onoff.length ? mean(onoff) : NaN, tests, padj, fc };
}

/* ============================================================== C · limma */

export function digamma(x) {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
export function trigamma(x) {
  let r = 0;
  while (x < 6) { r += 1 / (x * x); x += 1; }
  const f = 1 / (x * x);
  // 1/x + 1/2x² + 1/6x³ − 1/30x⁵ + 1/42x⁷ − 1/30x⁹
  return r + 1 / x + f / 2 + (f / x) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30)));
}
function tetragamma(x) {
  let r = 0;
  while (x < 6) { r -= 2 / (x * x * x); x += 1; }
  const f = 1 / (x * x);
  // −1/x² − 1/x³ − 1/2x⁴ + 1/6x⁶ − 1/6x⁸ + 3/10x¹⁰
  return r - f - f / x - f * f * (1 / 2 - f * (1 / 6 - f * (1 / 6 - (f * 3) / 10)));
}
/** limma's trigammaInverse: Newton's method, y += tri·(1 − tri/x) / ψ₂(y). */
export function trigammaInverse(x) {
  if (x > 1e7) return 1 / Math.sqrt(x);
  if (x < 1e-6) return 1 / x;
  let y = 0.5 + 1 / x;
  for (let i = 0; i < 50; i += 1) {
    const tri = trigamma(y);
    const d = (tri * (1 - tri / x)) / tetragamma(y);
    y += d;
    if (-d / y < 1e-8) break;
  }
  return y;
}

/**
 * limma's fitFDist with a common df: the prior df d0 and prior variance s0²
 * from the spread of log s² across proteins, by the method of moments.
 */
export function fitFDist(s2, df) {
  const z = s2.filter((v) => v > 0).map(Math.log);
  const e = z.map((v) => v - digamma(df / 2) + Math.log(df / 2));
  const emean = mean(e);
  const evar = variance(e) - trigamma(df / 2);
  if (evar <= 0) return { d0: Infinity, s02: Math.exp(emean) };
  const d0 = 2 * trigammaInverse(evar);
  const s02 = Math.exp(emean + digamma(d0 / 2) - Math.log(d0 / 2));
  return { d0, s02 };
}

/** The ordinary and the moderated t for every protein. */
export function limmaFit(rows, nA) {
  const fits = rows.map((r) => pooledT(r.slice(0, nA), r.slice(nA)));
  const df = fits[0].df;
  const prior = fitFDist(fits.map((f) => f.s2), df);
  const { d0, s02 } = prior;
  const out = fits.map((f) => {
    const post = Number.isFinite(d0) ? (d0 * s02 + df * f.s2) / (d0 + df) : s02;
    const dft = Number.isFinite(d0) ? df + d0 : Infinity;
    const tMod = f.diff / Math.sqrt(post * f.unscaled);
    const pMod = Number.isFinite(dft) ? tTailP(Math.abs(tMod), dft) : 2 * (1 - normCdf(Math.abs(tMod)));
    return { ...f, s2post: post, tMod, dfMod: dft, pMod };
  });
  return { prior, fits: out };
}
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
}

/** Proteins whose true variance is drawn from a scaled inverse chi-square — limma's own model. */
export function simulateVariances(rng, { proteins = 2000, n = 3, d0 = 4, s0 = 0.3, de = 0.1, fcLo = 0.5, fcHi = 1.5, mu = 24 } = {}) {
  const rows = [], meta = [];
  for (let p = 0; p < proteins; p += 1) {
    let chi = 0;
    for (let k = 0; k < d0; k += 1) chi += rng.normal() ** 2;
    const sigma2 = (d0 * s0 * s0) / chi;
    const isDe = rng.next() < de;
    const fc = isDe ? (rng.next() < 0.5 ? -1 : 1) * rng.uniform(fcLo, fcHi) : 0;
    const m = rng.normal(mu, 2);
    const row = [];
    for (let j = 0; j < 2 * n; j += 1) row.push(rng.normal(j < n ? m + fc / 2 : m - fc / 2, Math.sqrt(sigma2)));
    rows.push(row);
    meta.push({ sigma2, fc, de: isDe });
  }
  return { rows, meta, n };
}

/* =========================================================== D · qc-drift */

export const METABOLITES = [
  "Lactic acid", "Succinic acid", "Fumaric acid", "Malic acid", "Maleic acid", "Citric acid", "Malonic acid",
  "Glutaric acid", "Vanillic acid", "D-Glucuronic acid", "Pantothenic acid", "Nicotinic acid", "Adipic acid",
  "Tartaric acid", "Hippuric acid", "Pyroglutamic acid", "5-Hydroxymethyl-2-furoic acid", "3-Methylglutaric acid",
  "Ethylmalonic acid", "Suberic acid", "Phenyllactic acid", "Pyridoxine", "3-Indoleacetic acid",
  "Homovanillic acid", "3-Hydroxy-3-methylglutaric acid", "Phenylpyruvic acid",
];

/**
 * One LC-MS run in log2. Injections: a pooled QC first, then a QC after
 * every `qcEvery` study samples, and a QC last. Study samples are two groups,
 * run `order` = "random" (shuffled) or "grouped" (all of A, then all of B).
 * Every metabolite drifts by a shared curve (the whole signal falling as the
 * source dirties) plus its own: a slope and a bend of its own size and sign.
 * A pooled QC is the same material every time, so all its variation is drift
 * plus technical noise.
 */
export function simulateRun(rng, {
  perGroup = 40, qcEvery = 5, order = "random", metabolites = METABOLITES.length, real = 4, fc = 0.6,
  shared = 0.5, ownSd = 0.5, bendSd = 0.3, tech = 0.08, bio = 0.35,
} = {}) {
  const study = [];
  for (let i = 0; i < perGroup; i += 1) study.push("A");
  for (let i = 0; i < perGroup; i += 1) study.push("B");
  const seq = order === "grouped" ? study : shuffle(rng, study);
  const inj = [{ kind: "QC" }];
  seq.forEach((g, i) => {
    inj.push({ kind: g });
    if ((i + 1) % qcEvery === 0) inj.push({ kind: "QC" });
  });
  if (inj[inj.length - 1].kind !== "QC") inj.push({ kind: "QC" });
  const N = inj.length;
  const mets = [];
  for (let m = 0; m < metabolites; m += 1) {
    mets.push({
      name: METABOLITES[m % METABOLITES.length], base: rng.normal(18, 2),
      slope: rng.normal(0, ownSd), bend: rng.normal(0, bendSd), real: m < real,
      // half up, half down, so a per-sample median is not moved by the biology itself
      fc: m < real ? (m % 2 ? -fc : fc) : 0,
    });
  }
  // shared: a fall of `shared` log2 units across the run, steepest early
  const sharedAt = (t) => -shared * (1 - Math.exp(-3 * t)) / (1 - Math.exp(-3));
  const drift = mets.map((mt) => inj.map((_, i) => {
    const t = i / (N - 1);
    return sharedAt(t) + mt.slope * (t - 0.5) + mt.bend * Math.sin(Math.PI * t * 2);
  }));
  // the biological value of each study sample, per metabolite (QCs are the pool: the base)
  const X = mets.map((mt, m) => inj.map((s, i) => {
    let v = mt.base + drift[m][i] + rng.normal(0, tech);
    if (s.kind !== "QC") v += rng.normal(0, bio) + (s.kind === "B" ? mt.fc : 0);
    return v;
  }));
  return { inj, mets, X, drift, N };
}
function shuffle(rng, a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rng.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Local linear regression with tricube weights — R's loess, degree 1, no robustness iterations. */
export function loess(xs, ys, at, span = 0.75) {
  const n = xs.length;
  const k = Math.max(2, Math.ceil(span * n));
  return at.map((x0) => {
    const d = xs.map((x) => Math.abs(x - x0));
    const h = [...d].sort((a, b) => a - b)[k - 1] * (span > 1 ? span : 1) || 1;
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i += 1) {
      const u = d[i] / h;
      if (u >= 1) continue;
      const w = (1 - u ** 3) ** 3;
      sw += w; sx += w * xs[i]; sy += w * ys[i]; sxx += w * xs[i] * xs[i]; sxy += w * xs[i] * ys[i];
    }
    const den = sw * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) return sy / sw;
    const b = (sw * sxy - sx * sy) / den;
    return (sy - b * sx) / sw + b * x0;
  });
}

/** Median normalization: each injection shifted by its median across metabolites (log scale). */
export function correctMedian(run) {
  const { X, N } = run;
  const med = Array.from({ length: N }, (_, i) => median(X.map((r) => r[i])));
  const grand = median(med);
  return X.map((r) => r.map((v, i) => v - med[i] + grand));
}

/** QC-LOESS: per metabolite, a curve through the QCs against injection order, removed. */
export function correctQcLoess(run, span = 0.75) {
  const { X, inj } = run;
  const qcIdx = inj.map((s, i) => (s.kind === "QC" ? i : -1)).filter((i) => i >= 0);
  const all = inj.map((_, i) => i);
  return X.map((r) => {
    const fit = loess(qcIdx, qcIdx.map((i) => r[i]), all, span);
    const level = median(qcIdx.map((i) => r[i]));
    return r.map((v, i) => v - fit[i] + level);
  });
}

/** QC RSD per metabolite on the linear scale, and the group test per metabolite. */
export function scoreRun(run, Y) {
  const { inj, mets } = run;
  const qc = inj.map((s, i) => (s.kind === "QC" ? i : -1)).filter((i) => i >= 0);
  const A = inj.map((s, i) => (s.kind === "A" ? i : -1)).filter((i) => i >= 0);
  const B = inj.map((s, i) => (s.kind === "B" ? i : -1)).filter((i) => i >= 0);
  const rsd = Y.map((r) => { const lin = qc.map((i) => 2 ** r[i]); return Math.sqrt(variance(lin)) / mean(lin); });
  const tests = Y.map((r) => welch(B.map((i) => r[i]), A.map((i) => r[i])));
  const padj = bh(tests.map((t) => t.p));
  let fp = 0, tp = 0;
  mets.forEach((m, k) => { if (padj[k] < 0.05) (m.real ? tp += 1 : fp += 1); });
  return { rsd, tests, padj, fp, tp, nul: mets.filter((m) => !m.real).length, real: mets.filter((m) => m.real).length };
}

/* ============================================ A2 · a search from fragment masses */

/* Moved into widget 88's engine when the draft was built (2026-10-05), so the
   mock, this measurement and the widget run one search. */
export { RESIDUE, digest, peptideMass, fragments, matchCount, randomProtein, search as simulateSpectraSearch }
  from "../target-decoy/engine.js";
