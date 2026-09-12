/* Planning measurement for the GWAS arc's `polygenic-score` slot (59), which
 * carries slot 58's LD-and-clumping material as its first page — Kenneth's
 * call 2026-09-11. Four pages, four questions this script has to answer
 * before a mock is worth drawing:
 *
 *   1. LD and clumping. Does a mosaic haplotype simulator cheap enough for a
 *      widget produce r² that falls with distance the way a real region's
 *      does — several neighbours over r² 0.1 within the lesson's 250 kb and
 *      nothing beyond a few hundred kb? And at PRSice's own defaults
 *      (`--clump-r2 0.1 --clump-kb 250kb`), how often is the lead SNP the
 *      causal one? The slot's sentence is that it often is not.
 *   2. The score. Σ βⱼ xᵢⱼ over the SNPs a P threshold keeps, weights from a
 *      BASE study — a page of arithmetic, so all this section owes is a
 *      cohort the arithmetic can run on.
 *   3. The threshold. The lesson's `cholesterol_prs.prsice` holds 1316
 *      thresholds: 5e-8 → 22 SNPs, R² 0.0013; 1e-3 → 449 SNPs, 0.0075;
 *      0.05 → 11,553 SNPs, 0.036; the best at 0.404 → 56,054 SNPs, 0.0497;
 *      and 0.5 → 0.046. That maximum is tuned on the target and 02-1 reports
 *      it without the caveat. How big is the selection optimism at the
 *      lesson's n = 319, and does the simulated curve have the same shape —
 *      rise, maximum at a loose threshold, fall?
 *   4. Portability. The lesson's base study is East Asian and its target is
 *      three populations, which is its own explanation for the weak trend.
 *      Martin 2019 puts the loss at roughly half for an East Asian target of
 *      a European base and a fifth for an African one. What Fst and tag loss
 *      land the widget's Strong setting near 0.5 or below?
 *   5. The quantile plot. 02-2's figure: mean trait by vigintile with a 95%
 *      t interval. The real curve runs 20.76 at vigintile 1 to 21.21 at
 *      vigintile 20 — a range of 0.45 on bin SEs of ~0.08 at n ≈ 16, so a
 *      trait SD near 0.32 and a range near 1.4 SD. Is the simulated matched
 *      target steeper than that?
 *
 * Every number below is the model's. The lesson's numbers are quoted from its
 * own output files and are never recomputed here.
 *
 * Run: node widgets/_lab/prs-measure.mjs
 */

import { makeRng } from "../core/rng.js";

let checks = 0;
let failed = 0;
function check(cond, msg) {
  checks += 1;
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${msg}`);
  }
}

const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pad = (s, w) => String(s).padStart(w);

/* ==========================================================================
   Copied numerics.

   lgamma, betacf, betai, tTwoSided, cholesky, cholInverse, weightedScan and
   olsScan are copied VERBATIM from widgets/_lab/gwas-measure.mjs, which runs
   its own tables on import and so cannot be imported from. gammaDraw and
   betaDraw are copied from the same file. tCritical is the same tail as
   widgets/core/stats.js inverts, written out here so this file has no import
   but the rng.
   ========================================================================== */

/* FROM gwas-measure.mjs — Lanczos log-gamma. */
const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
];
function lgamma(x) {
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) ser += LANCZOS[j] / (y += 1);
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/* FROM gwas-measure.mjs — the incomplete beta's continued fraction. */
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let mm = 1; mm <= 300; mm += 1) {
    const m2 = 2 * mm;
    let aa = (mm * (b - mm) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + mm) * (qab + mm) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}

/** FROM gwas-measure.mjs — regularized incomplete beta I_x(a, b). */
export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** FROM gwas-measure.mjs — two-sided P for a t statistic on df degrees. */
export function tTwoSided(t, df) {
  if (!Number.isFinite(t)) return 1;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/**
 * The two-sided critical value — the same tail widgets/core/stats.js
 * `tCritical` inverts, bisected here so this file imports only the rng.
 * This is the qt(0.975, n − 1) the lesson's own interval multiplies sd/√n by.
 */
export function tCritical(df, conf = 0.95) {
  if (!(df > 0)) return Infinity;
  const target = 1 - conf;
  let lo = 0;
  let hi = 400;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (tTwoSided(mid, df) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* FROM gwas-measure.mjs — Cholesky and its inverse. */
function cholesky(A) {
  const p = A.length;
  const L = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = A[i][j];
      for (let kk = 0; kk < j; kk += 1) s -= L[i][kk] * L[j][kk];
      if (i === j) {
        if (s <= 0) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

function cholInverse(L) {
  const p = L.length;
  const Li = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j += 1) {
      let s = 0;
      for (let kk = j; kk < i; kk += 1) s += L[i][kk] * Li[kk][j];
      Li[i][j] = -s / L[i][i];
    }
  }
  const Ai = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = 0;
      for (let kk = i; kk < p; kk += 1) s += Li[kk][i] * Li[kk][j];
      Ai[i][j] = s;
      Ai[j][i] = s;
    }
  }
  return Ai;
}

/** FROM gwas-measure.mjs — per-SNP weighted least squares. */
export function weightedScan(y, X, G, winv) {
  const n = y.length;
  const p = X.length;
  const m = G.length;
  const A = Array.from({ length: p }, () => new Float64Array(p));
  for (let a = 0; a < p; a += 1) {
    for (let b = 0; b <= a; b += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += winv[i] * X[a][i] * X[b][i];
      A[a][b] = s;
      A[b][a] = s;
    }
  }
  const L = cholesky(A);
  if (!L) throw new Error("weightedScan: singular covariate matrix");
  const Ai = cholInverse(L);

  const by = new Float64Array(p);
  for (let a = 0; a < p; a += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += winv[i] * X[a][i] * y[i];
    by[a] = s;
  }
  const cy = new Float64Array(p);
  for (let a = 0; a < p; a += 1) {
    let s = 0;
    for (let b = 0; b < p; b += 1) s += Ai[a][b] * by[b];
    cy[a] = s;
  }
  const yt = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let v = y[i];
    for (let a = 0; a < p; a += 1) v -= X[a][i] * cy[a];
    yt[i] = v;
  }
  let ssy = 0;
  for (let i = 0; i < n; i += 1) ssy += winv[i] * yt[i] * yt[i];

  const df = n - p - 1;
  const beta = new Float64Array(m);
  const se = new Float64Array(m);
  const P = new Float64Array(m);
  const bg = new Float64Array(p);
  const cg = new Float64Array(p);
  for (let j = 0; j < m; j += 1) {
    const g = G[j];
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      const Xa = X[a];
      for (let i = 0; i < n; i += 1) s += winv[i] * Xa[i] * g[i];
      bg[a] = s;
    }
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      for (let b = 0; b < p; b += 1) s += Ai[a][b] * bg[b];
      cg[a] = s;
    }
    let den = 0;
    let num = 0;
    for (let i = 0; i < n; i += 1) {
      let gt = g[i];
      for (let a = 0; a < p; a += 1) gt -= X[a][i] * cg[a];
      den += winv[i] * gt * gt;
      num += winv[i] * gt * yt[i];
    }
    if (den <= 1e-12) {
      beta[j] = 0;
      se[j] = Infinity;
      P[j] = 1;
      continue;
    }
    const b = num / den;
    const rss = Math.max(ssy - b * b * den, 1e-300);
    const s2 = rss / df;
    const s = Math.sqrt(s2 / den);
    beta[j] = b;
    se[j] = s;
    P[j] = tTwoSided(b / s, df);
  }
  return { beta, se, P, df };
}

/** FROM gwas-measure.mjs — per-SNP OLS of y on the SNP plus an intercept. */
export function olsScan(y, G, covariates = []) {
  const n = y.length;
  const ones = new Float64Array(n).fill(1);
  const winv = new Float64Array(n).fill(1);
  return weightedScan(y, [ones, ...covariates], G, winv);
}

/** FROM gwas-measure.mjs — Gamma(shape, 1), Marsaglia–Tsang, seeded. */
export function gammaDraw(rng, shape) {
  if (shape < 1) {
    let u = 0;
    while (u === 0) u = rng.next();
    return gammaDraw(rng, shape + 1) * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let v = 0;
    do {
      x = rng.normal(0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** FROM gwas-measure.mjs — Beta(a, b) as X / (X + Y). */
export function betaDraw(rng, a, b) {
  const x = gammaDraw(rng, a);
  const y = gammaDraw(rng, b);
  return x + y > 0 ? x / (x + y) : 0.5;
}

/* ==========================================================================
   Small statistics.
   ========================================================================== */

export function mean(v) {
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += v[i];
  return s / v.length;
}

export function sd(v) {
  const mu = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += (v[i] - mu) ** 2;
  return Math.sqrt(s / Math.max(v.length - 1, 1));
}

/** Pearson correlation; 0 when either side is constant. */
export function cor(a, b) {
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

/** The R² the lesson's `PRS.R2` is: the squared correlation of score and trait. */
export function r2Score(s, y) {
  const c = cor(s, y);
  return c * c;
}

/* ==========================================================================
   1. Haplotypes with LD.

   A coalescent is not worth its cost in a widget, so this is Li–Stephens'
   mosaic: `kFounder` founder haplotypes, and every sampled haplotype copies
   one founder and switches to a fresh one with probability
   1 − exp(−recomb × distance) at each step. Nearby SNPs sit on the same
   founder and so share alleles; far ones do not, and the block structure is a
   consequence of the switch points rather than a parameter — which is the
   picture page 1 wants.

   FIRST WRITTEN AS founders whose alleles were drawn independently at a
   frequency U(0.1, 0.9) per SNP, which is what the plan asked for. That
   cannot work, and the reason is worth keeping: two SNPs at zero distance sit
   on the SAME founder, so their r² across the sample is the r² between them
   AMONG THE FOUNDERS — and independent draws have none. Measured: mean r² at
   0–50 kb was 0.06 at 8 founders and never rose above 0.18 at any founder
   count, a ceiling of about 1/(k − 1). Real LD is high because the founders
   are RELATED, so the founders here are now built on a random genealogy:
   split the founder set recursively, and let each SNP be a mutation on one
   branch, carried by exactly the founders below it. Two SNPs on the same
   branch are then perfectly correlated, which is what a tag is. Allele
   frequencies come out as branch sizes over k rather than U(0.1, 0.9) —
   a consequence rather than an assumption, and closer to a real spectrum.
   ========================================================================== */

/**
 * `nHap` haplotypes over `m` SNPs spaced `blockLen` kb apart.
 * `recomb` is the switch probability PER KB.
 * Returns { H, positions, founders, freq } with H[j] the allele vector (0/1)
 * of SNP j across haplotypes — the orientation ldMatrix and the scan want.
 *
 * FIRST WRITTEN AS m 60 SNPs at 25 kb (a 1475 kb stretch), which is the plan's
 * default. Measured, that stretch cannot teach tagging: a 250 kb clumping
 * window holds only 20 SNPs, a causal SNP has 0.0 neighbours at r² > 0.8, and
 * the lead SNP is the causal one 92% of the time. The region is now 100 SNPs
 * at 5 kb — 495 kb, the density of a genotyping array rather than of a figure.
 */
export function simulateHaplotypes(rng, opts = {}) {
  const { nHap = 1000, m = 100, blockLen = 5, recomb = 0.005, kFounder = 4 } = opts;
  const positions = new Float64Array(m);
  for (let j = 0; j < m; j += 1) positions[j] = j * blockLen;

  /* the founders' genealogy: every edge is the set of founders below it */
  const edges = [];
  (function split(set) {
    if (set.length <= 1) return;
    const sh = rng.shuffle(set);
    const cut = rng.int(1, set.length - 1);
    const left = sh.slice(0, cut);
    const right = sh.slice(cut);
    edges.push(left, right);
    split(left);
    split(right);
  })(Array.from({ length: kFounder }, (_, i) => i));

  const founders = Array.from({ length: kFounder }, () => new Uint8Array(m));
  const branch = new Int32Array(m); // which edge each SNP mutated on
  for (let j = 0; j < m; j += 1) {
    const e = rng.int(0, edges.length - 1);
    branch[j] = e;
    for (const fdx of edges[e]) founders[fdx][j] = 1;
  }
  const freq = new Float64Array(m);
  for (let j = 0; j < m; j += 1) freq[j] = edges[branch[j]].length / kFounder;

  const H = Array.from({ length: m }, () => new Uint8Array(nHap));
  for (let h = 0; h < nHap; h += 1) {
    let fdx = rng.int(0, kFounder - 1);
    H[0][h] = founders[fdx][0];
    for (let j = 1; j < m; j += 1) {
      const d = positions[j] - positions[j - 1];
      if (rng.next() < 1 - Math.exp(-recomb * d)) fdx = rng.int(0, kFounder - 1);
      H[j][h] = founders[fdx][j];
    }
  }
  return { H, positions, founders, freq, branch, edges, nHap, m, blockLen, recomb, kFounder };
}

/** r² between two SNPs' allele vectors: D² / (pA qA pB qB). */
export function r2(hapA, hapB) {
  const n = hapA.length;
  let pa = 0;
  let pb = 0;
  let pab = 0;
  for (let i = 0; i < n; i += 1) {
    pa += hapA[i];
    pb += hapB[i];
    pab += hapA[i] * hapB[i];
  }
  pa /= n;
  pb /= n;
  pab /= n;
  const D = pab - pa * pb;
  const den = pa * (1 - pa) * pb * (1 - pb);
  return den > 0 ? (D * D) / den : 0;
}

/** The full m × m r² matrix — page 1's triangle, and clumping's input. */
export function ldMatrix(H) {
  const m = H.length;
  const R = Array.from({ length: m }, () => new Float64Array(m));
  for (let j = 0; j < m; j += 1) {
    R[j][j] = 1;
    for (let k = 0; k < j; k += 1) {
      const v = r2(H[j], H[k]);
      R[j][k] = v;
      R[k][j] = v;
    }
  }
  return R;
}

/* ==========================================================================
   2. Individuals, the region's association test, and clumping.
   ========================================================================== */

/** `n` people, each two haplotypes drawn from the pool: G[j][i] ∈ {0, 1, 2}. */
export function makeGenotypes(rng, H, n) {
  const m = H.length;
  const nHap = H[0].length;
  const G = Array.from({ length: m }, () => new Int8Array(n));
  for (let i = 0; i < n; i += 1) {
    const a = rng.int(0, nHap - 1);
    const b = rng.int(0, nHap - 1);
    for (let j = 0; j < m; j += 1) G[j][i] = H[j][a] + H[j][b];
  }
  return G;
}

/**
 * One hidden causal SNP: y = beta × standardised genotype + N(0, 1).
 * So the causal SNP's share of the trait's variance is beta² / (1 + beta²).
 */
export function regionTrait(rng, G, causalIdx, beta) {
  const n = G[0].length;
  const g = G[causalIdx];
  let mu = 0;
  for (let i = 0; i < n; i += 1) mu += g[i];
  mu /= n;
  let v = 0;
  for (let i = 0; i < n; i += 1) v += (g[i] - mu) ** 2;
  const s = Math.sqrt(v / n) || 1;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) y[i] = beta * ((g[i] - mu) / s) + rng.normal(0, 1);
  return y;
}

/** Per-SNP OLS over the region; returns β, P and the −log₁₀P the plot draws. */
export function regionScan(y, G) {
  const s = olsScan(y, G);
  const logp = new Float64Array(s.P.length);
  for (let j = 0; j < s.P.length; j += 1) logp[j] = -Math.log10(Math.max(s.P[j], 1e-300));
  return { ...s, logp };
}

/**
 * PLINK/PRSice greedy clumping at the lesson's own defaults
 * (`--clump-r2 0.1 --clump-kb 250kb`): sort by P, take the best remaining SNP
 * as an index, absorb every not-yet-taken SNP within `kb` whose r² to it is at
 * least `r2`, repeat until nothing is left.
 *
 * Every SNP is clumped, with no `--clump-p1` cut on the index — PRSice clumps
 * the whole base file and applies its P thresholds afterwards, which is the
 * order page 1 then page 3 follow.
 */
export function clump(P, R, positions, opts = {}) {
  const { r2: r2Thresh = 0.1, kb = 250 } = opts;
  const m = P.length;
  const order = Array.from({ length: m }, (_, j) => j).sort((a, b) => P[a] - P[b]);
  const taken = new Uint8Array(m);
  const clumps = [];
  for (const idx of order) {
    if (taken[idx]) continue;
    taken[idx] = 1;
    const members = [];
    for (let j = 0; j < m; j += 1) {
      if (taken[j]) continue;
      if (Math.abs(positions[j] - positions[idx]) <= kb && R[idx][j] >= r2Thresh) {
        taken[j] = 1;
        members.push(j);
      }
    }
    clumps.push({ index: idx, members, p: P[idx] });
  }
  return clumps;
}

/* ==========================================================================
   3. A genome for the score.

   Page 2 and after need many SNPs and no LD: the score is a sum over SNPs
   and the argument is the count, not the correlation between neighbours. So
   these SNPs are INDEPENDENT — drawn one at a time from their own allele
   frequency — and the LD that page 1 taught is represented on the later pages
   only by `tagLoss`, which is what LD across ancestries costs a score.
   ========================================================================== */

/** Balding–Nichols: the target's frequency around the base's at the given Fst. */
export function shiftFrequency(rng, p, fst) {
  if (!(fst > 0)) return p;
  const a = (p * (1 - fst)) / fst;
  const b = ((1 - p) * (1 - fst)) / fst;
  const q = betaDraw(rng, a, b);
  return Math.min(Math.max(q, 0.01), 0.99);
}

/**
 * One cohort at the given allele frequencies.
 *
 * `tagged` marks causal SNPs whose OBSERVED genotype in this cohort is only a
 * tag for the causal one: each allele is kept with probability √r2tag and
 * otherwise redrawn from the same frequency, which makes the observed and the
 * causal genotype correlate at exactly r = √r2tag, so r² = r2tag. The TRAIT is
 * always built from the causal genotype and the SCORE always from the observed
 * one — which is what an LD tag that travels badly across ancestries does to a
 * weight estimated in the base study.
 */
export function drawCohort(rng, n, p, betaTrue, h2, tagged, r2tag) {
  const m = p.length;
  const G = Array.from({ length: m }, () => new Int8Array(n));
  const gen = new Float64Array(n);
  const keep = Math.sqrt(r2tag);
  for (let j = 0; j < m; j += 1) {
    const col = G[j];
    const pj = p[j];
    const bj = betaTrue[j];
    const s = Math.sqrt(2 * pj * (1 - pj)) || 1;
    const isTag = tagged ? tagged[j] === 1 : false;
    for (let i = 0; i < n; i += 1) {
      const a = rng.next() < pj ? 1 : 0;
      const b = rng.next() < pj ? 1 : 0;
      let obs = a + b;
      if (isTag) {
        const a2 = rng.next() < keep ? a : rng.next() < pj ? 1 : 0;
        const b2 = rng.next() < keep ? b : rng.next() < pj ? 1 : 0;
        obs = a2 + b2;
      }
      col[i] = obs;
      if (bj !== 0) gen[i] += (bj * (a + b - 2 * pj)) / s;
    }
  }
  const resSd = Math.sqrt(Math.max(1 - h2, 0));
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) y[i] = gen[i] + rng.normal(0, resSd);
  return { G, y, gen };
}

/**
 * The base study: `m` independent SNPs, a fraction `hCausal` of them causal
 * with effects N(0, 1) rescaled so the causal SNPs together explain `h2` of
 * the trait's variance (every other SNP's effect is exactly zero), a cohort of
 * `nBase` people, and the per-SNP OLS that gives β̂ and P.
 */
export function simulateBase(rng, opts = {}) {
  const { nBase = 3000, m = 2000, hCausal = 0.05, h2 = 0.3 } = opts;
  const p = new Float64Array(m);
  for (let j = 0; j < m; j += 1) p[j] = 0.05 + 0.9 * rng.next();

  const nCausal = Math.max(1, Math.round(hCausal * m));
  const idx = Array.from({ length: m }, (_, j) => j);
  const causalIdx = rng.shuffle(idx).slice(0, nCausal);
  const betaTrue = new Float64Array(m);
  let ss = 0;
  for (const j of causalIdx) {
    const b = rng.normal(0, 1);
    betaTrue[j] = b;
    ss += b * b;
  }
  const scale = Math.sqrt(h2 / ss);
  for (const j of causalIdx) betaTrue[j] *= scale;

  const base = drawCohort(rng, nBase, p, betaTrue, h2, null, 1);
  const scan = olsScan(base.y, base.G);
  return { p, betaTrue, causalIdx, nCausal, m, h2, base, betaHat: scan.beta, P: scan.P };
}

/**
 * A target cohort drawn against an existing base: allele frequencies shifted
 * by Balding–Nichols at `ancestryShift`, and a fraction `tagLoss` of the
 * causal SNPs observed only through a tag at r² `r2tag`.
 */
export function drawTarget(rng, model, opts = {}) {
  const { n = 319, ancestryShift = 0, tagLoss = 0, r2tag = 0.5 } = opts;
  const { p, betaTrue, causalIdx, h2 } = model;
  const pT = new Float64Array(p.length);
  for (let j = 0; j < p.length; j += 1) pT[j] = shiftFrequency(rng, p[j], ancestryShift);
  const tagged = new Uint8Array(p.length);
  if (tagLoss > 0) {
    const shuffled = rng.shuffle(causalIdx);
    const k = Math.round(tagLoss * causalIdx.length);
    for (let i = 0; i < k; i += 1) tagged[shuffled[i]] = 1;
  }
  const co = drawCohort(rng, n, pT, betaTrue, h2, tagged, r2tag);
  return { ...co, p: pT, tagged };
}

/**
 * The whole page-3 setup in one call: a base study, a target, and a HOLDOUT
 * drawn exactly like the target — the cohort the tuned threshold was not
 * allowed to see.
 */
export function simulateGenome(rng, opts = {}) {
  const {
    nBase = 3000,
    nTarget = 319,
    nHoldout = null,
    m = 2000,
    hCausal = 0.05,
    h2 = 0.3,
    ancestryShift = 0,
    tagLoss = 0,
    r2tag = 0.5,
  } = opts;
  const model = simulateBase(rng, { nBase, m, hCausal, h2 });
  const tOpts = { n: nTarget, ancestryShift, tagLoss, r2tag };
  const target = drawTarget(rng, model, tOpts);
  const holdout = drawTarget(rng, model, { ...tOpts, n: nHoldout ?? nTarget });
  return { ...model, target, holdout };
}

/** Σⱼ β̂ⱼ xᵢⱼ over the SNPs `keep` marks — the lesson's equation, literally. */
export function score(G, betaHat, keep) {
  const n = G[0].length;
  const s = new Float64Array(n);
  for (let j = 0; j < G.length; j += 1) {
    if (!keep[j]) continue;
    const b = betaHat[j];
    const col = G[j];
    for (let i = 0; i < n; i += 1) s[i] += b * col[i];
  }
  return s;
}

export const THRESHOLDS = [5e-8, 1e-5, 1e-3, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

/** Which SNPs a P threshold keeps. */
export function keepAt(P, thresh) {
  const keep = new Uint8Array(P.length);
  let n = 0;
  for (let j = 0; j < P.length; j += 1) {
    if (P[j] < thresh) {
      keep[j] = 1;
      n += 1;
    }
  }
  return { keep, n };
}

/**
 * The R² curve: for each threshold, the SNPs kept and the score's R² in every
 * cohort handed in. `cohorts` is an object of name → { G, y }, so the target
 * and the holdout come back on the same row and page 3 can draw one above the
 * other.
 */
export function thresholdCurve(betaHat, P, cohorts, thresholds = THRESHOLDS) {
  return thresholds.map((t) => {
    const { keep, n } = keepAt(P, t);
    const row = { thresh: t, nSnp: n };
    for (const [name, co] of Object.entries(cohorts)) {
      row[name] = n === 0 ? 0 : r2Score(score(co.G, betaHat, keep), co.y);
    }
    return row;
  });
}

/** The threshold with the largest R² in the named cohort — PRSice's "best". */
export function bestThreshold(curve, name = "target") {
  let best = curve[0];
  for (const row of curve) if (row[name] > best[name]) best = row;
  return best;
}

/* ==========================================================================
   5. The quantile plot — 02-2's figure.
   ========================================================================== */

/**
 * `k` quantile bins of the score (k = 20 is the lesson's vigintile), each with
 * the mean trait and its 95% t interval: mean ± qt(0.975, n − 1) × sd/√n,
 * the lesson's own formula.
 */
export function quantileBins(s, y, k = 20) {
  const n = s.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[a] - s[b]);
  const bins = [];
  for (let b = 0; b < k; b += 1) {
    const lo = Math.floor((b * n) / k);
    const hi = Math.floor(((b + 1) * n) / k);
    const vals = order.slice(lo, hi).map((i) => y[i]);
    const mu = mean(vals);
    const s1 = sd(vals);
    const se = s1 / Math.sqrt(vals.length);
    const tc = tCritical(vals.length - 1);
    bins.push({ bin: b + 1, n: vals.length, mean: mu, sd: s1, se, lo: mu - tc * se, hi: mu + tc * se });
  }
  return bins;
}

/** OLS slope of the bin mean against the bin number — the trend's steepness. */
export function binSlope(bins) {
  const xs = bins.map((b) => b.bin);
  const ys = bins.map((b) => b.mean);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return num / den;
}

/** How many bins' intervals exclude the cohort's overall mean. */
export function binsExcludingMean(bins, overall) {
  let k = 0;
  for (const b of bins) if (b.lo > overall || b.hi < overall) k += 1;
  return k;
}

/* ==========================================================================
   The tables.
   ========================================================================== */

const rng = makeRng(20260912);

console.log("\n=== prs-measure — planning for slot 59 `polygenic-score` ===");

/* ---- 1. LD against distance --------------------------------------------- */

console.log("\n1. Mosaic haplotypes on a founder genealogy: r² against distance");
console.log("   (nHap 1000, m 100 SNPs at 5 kb spacing = 495 kb, 4 founders)\n");

const DIST_BINS = [
  [0, 25],
  [25, 50],
  [50, 100],
  [100, 200],
  [200, 400],
  [400, 1e9],
];
const BIN_LABEL = ["0–25", "25–50", "50–100", "100–200", "200–400", "400+"];

function ldProfile(rng_, recomb) {
  const hap = simulateHaplotypes(rng_, { recomb });
  const R = ldMatrix(hap.H);
  const sums = DIST_BINS.map(() => 0);
  const counts = DIST_BINS.map(() => 0);
  let near = 0; // pairs with r² > 0.1 within 250 kb
  let far = 0; // pairs with r² > 0.1 beyond 250 kb
  let maxFar = 0; // the largest distance at which any pair holds r² > 0.1
  let tags = 0; // pairs at r² > 0.8 — a tag good enough to stand in
  for (let j = 0; j < hap.m; j += 1) {
    for (let k = 0; k < j; k += 1) {
      const d = hap.positions[j] - hap.positions[k];
      for (let b = 0; b < DIST_BINS.length; b += 1) {
        if (d >= DIST_BINS[b][0] && d < DIST_BINS[b][1]) {
          sums[b] += R[j][k];
          counts[b] += 1;
        }
      }
      if (R[j][k] > 0.8) tags += 1;
      if (R[j][k] > 0.1) {
        if (d <= 250) near += 1;
        else far += 1;
        if (d > maxFar) maxFar = d;
      }
    }
  }
  return {
    hap,
    R,
    means: sums.map((s, b) => (counts[b] ? s / counts[b] : NaN)),
    near,
    far,
    maxFar,
    perSnp: (2 * near) / hap.m,
    tagsPerSnp: (2 * tags) / hap.m,
  };
}

console.log(`   recomb/kb   ${BIN_LABEL.map((s) => pad(s, 9)).join("")}   r²>0.1 ≤250kb: pairs   per SNP   r²>0.8 per SNP   >250kb   max kb`);
const profiles = {};
const RECOMBS = [0.002, 0.005, 0.02];
for (const recomb of RECOMBS) {
  const pr = ldProfile(rng, recomb);
  profiles[recomb] = pr;
  console.log(
    `   ${pad(recomb.toFixed(3), 9)}   ${pr.means.map((v) => pad(f(v, 3), 9)).join("")}   ` +
      `${pad(pr.near, 20)}   ${pad(f(pr.perSnp, 1), 7)}   ${pad(f(pr.tagsPerSnp, 1), 14)}   ${pad(pr.far, 6)}   ${pad(pr.maxFar, 6)}`,
  );
}

{
  const d = profiles[0.005];
  check(d.means[0] > d.means[2] && d.means[2] > d.means[4], "at the default recombination r² falls with distance");
  check(
    profiles[0.002].means[3] > profiles[0.02].means[3],
    "less recombination holds more LD at 100–200 kb",
  );
  check(d.perSnp >= 2, "at the default a SNP has several neighbours over r² 0.1 within 250 kb");
  check(d.maxFar <= 400, "and none beyond a few hundred kb");
  check(d.tagsPerSnp >= 1, "and at least one near-perfect tag — what makes a lead SNP ambiguous");
}

/* ---- 2. the region scan and clumping ------------------------------------ */

console.log("\n2. The region: n 500, one hidden causal SNP, beta 0.25 (5.9% of the trait), 50 seeds");
console.log("   clumped at PRSice's own defaults, r² 0.1 within 250 kb\n");

/**
 * `typed: false` drops the causal SNP's own column before the scan — the
 * realistic case, where the causal variant is not on the array and the lead is
 * necessarily somebody else. The trait is still built from it.
 */
function regionTrial(seed, opts = {}) {
  const { recomb = 0.005, beta = 0.25, n = 500, clumpR2 = 0.1, kb = 250, typed = true } = opts;
  const r = makeRng(seed);
  const hap = simulateHaplotypes(r, { recomb });
  const R = ldMatrix(hap.H);
  const G = makeGenotypes(r, hap.H, n);
  const causal = r.int(5, hap.m - 6);
  const y = regionTrait(r, G, causal, beta);

  /* the SNPs the scan is allowed to see */
  const idx = [];
  for (let j = 0; j < hap.m; j += 1) if (typed || j !== causal) idx.push(j);
  const Gs = idx.map((j) => G[j]);
  const pos = idx.map((j) => hap.positions[j]);
  const Rs = idx.map((a) => Float64Array.from(idx.map((b) => R[a][b])));

  const scan = regionScan(y, Gs);
  const hits = Array.from(scan.P).filter((p) => p < 0.05).length;
  const clumps = clump(scan.P, Rs, pos, { r2: clumpR2, kb });
  const sig = clumps.filter((c) => c.p < 0.05);
  let lead = 0;
  for (let j = 1; j < idx.length; j += 1) if (scan.P[j] < scan.P[lead]) lead = j;
  const leadClump = clumps.find((c) => c.index === lead);
  /* "the causal SNP is accounted for" — its own column when it is typed, and
     otherwise the causal POSITION falling inside the lead's clump span. */
  const inLead = typed
    ? leadClump.index === idx.indexOf(causal) || leadClump.members.includes(idx.indexOf(causal))
    : (() => {
        const span = [leadClump.index, ...leadClump.members].map((j) => pos[j]);
        const cp = hap.positions[causal];
        return cp >= Math.min(...span) && cp <= Math.max(...span);
      })();
  return {
    hits,
    nClump: clumps.length,
    nSigClump: sig.length,
    leadIsCausal: typed ? idx[lead] === causal : false,
    inLead,
    leadR2Causal: R[idx[lead]][causal],
    leadDistKb: Math.abs(pos[lead] - hap.positions[causal]),
    detected: scan.P[lead] < 0.05,
  };
}

const REGION_KEYS = ["hits", "nClump", "nSigClump", "lead", "inLead", "r2lc", "dist", "detected"];
function regionSummary(opts, seeds = 50) {
  const acc = Object.fromEntries(REGION_KEYS.map((k) => [k, 0]));
  for (let s = 0; s < seeds; s += 1) {
    const t = regionTrial(9000 + s, opts);
    acc.hits += t.hits;
    acc.nClump += t.nClump;
    acc.nSigClump += t.nSigClump;
    acc.lead += t.leadIsCausal ? 1 : 0;
    acc.inLead += t.inLead ? 1 : 0;
    acc.r2lc += t.leadR2Causal;
    acc.dist += t.leadDistKb;
    acc.detected += t.detected ? 1 : 0;
  }
  for (const k of REGION_KEYS) acc[k] /= seeds;
  return acc;
}

console.log("   recomb/kb   SNPs P<0.05   clumps   clumps P<0.05   lead IS causal   causal in lead's clump   r²(lead, causal)   lead–causal kb");
const regionRows = {};
for (const recomb of RECOMBS) {
  const s = regionSummary({ recomb });
  regionRows[recomb] = s;
  console.log(
    `   ${pad(recomb.toFixed(3), 9)}   ${pad(f(s.hits, 1), 11)}   ${pad(f(s.nClump, 1), 6)}   ` +
      `${pad(f(s.nSigClump, 1), 13)}   ${pad(f(s.lead, 2), 14)}   ${pad(f(s.inLead, 2), 22)}   ` +
      `${pad(f(s.r2lc, 2), 16)}   ${pad(f(s.dist, 1), 14)}`,
  );
}

{
  const d = regionRows[0.005];
  check(d.hits > d.nSigClump, "clumping leaves fewer findings than there are significant SNPs");
  check(d.lead < 0.8, "the lead SNP is often NOT the causal one — the slot's sentence");
  check(d.inLead > d.lead, "but the causal SNP is usually inside the lead's clump");
}

console.log("\n   The causal SNP NOT on the array — the realistic case, at the default recombination (50 seeds)\n");
{
  const s = regionSummary({ typed: false });
  console.log(
    `   clumps ${f(s.nClump, 1)}   clumps P<0.05 ${f(s.nSigClump, 1)}   ` +
      `lead's r² to the causal variant ${f(s.r2lc, 2)}   lead–causal distance ${f(s.dist, 1)} kb   ` +
      `causal position inside the lead's clump ${f(s.inLead, 2)}`,
  );
  check(s.r2lc > 0.4, "with the causal variant untyped the lead is still a good tag for it");
  check(s.inLead > 0.5, "and the lead's clump usually spans the causal position");
}

console.log("\n   Clump r², at the default recombination (50 seeds)\n");
console.log("   clump r²   clumps   clumps P<0.05   causal in lead's clump");
for (const cr of [0.05, 0.1, 0.3, 0.6]) {
  const s = regionSummary({ clumpR2: cr });
  console.log(
    `   ${pad(cr.toFixed(2), 8)}   ${pad(f(s.nClump, 1), 6)}   ${pad(f(s.nSigClump, 1), 13)}   ${pad(f(s.inLead, 2), 22)}`,
  );
}

/* ---- 3. the threshold curve --------------------------------------------- */

console.log("\n3. The threshold curve: base 3000, m 2000 independent SNPs, h² 0.30");
console.log("   target and holdout 319 each (the lesson's n), matched ancestry\n");

function curveTrial(seed, opts = {}) {
  const { nTarget = 319, ancestryShift = 0, tagLoss = 0, r2tag = 0.5, hCausal, nBase, m } = opts;
  const r = makeRng(seed);
  const g = simulateGenome(r, {
    nTarget,
    ancestryShift,
    tagLoss,
    r2tag,
    ...(hCausal ? { hCausal } : {}),
    ...(nBase ? { nBase } : {}),
    ...(m ? { m } : {}),
  });
  const curve = thresholdCurve(g.betaHat, g.P, { target: g.target, holdout: g.holdout });
  const best = bestThreshold(curve, "target");
  return { curve, best, model: g };
}

/** mean and the standard error of the mean, for a paired difference. */
function meanSe(v) {
  const mu = mean(v);
  return { mu, se: sd(v) / Math.sqrt(v.length) };
}

function curveSummary(seeds, opts = {}) {
  const rows = THRESHOLDS.map((t) => ({ thresh: t, nSnp: 0, target: 0, holdout: 0 }));
  const all = [];
  const bests = [];
  const peakCount = new Map();
  let peakLog = 0;
  for (let s = 0; s < seeds; s += 1) {
    const { curve, best } = curveTrial(4000 + s, opts);
    all.push(curve);
    bests.push(best);
    curve.forEach((row, i) => {
      rows[i].nSnp += row.nSnp;
      rows[i].target += row.target;
      rows[i].holdout += row.holdout;
    });
    peakLog += Math.log10(best.thresh);
    peakCount.set(best.thresh, (peakCount.get(best.thresh) ?? 0) + 1);
  }
  for (const row of rows) {
    row.nSnp /= seeds;
    row.target /= seeds;
    row.holdout /= seeds;
  }
  /* The threshold that is best ON AVERAGE in the holdout — the one a reader
     who never tuned would have chosen. Comparing the tuned R² against the
     SAME COHORT's R² there is a paired, within-cohort measure of what tuning
     buys, and it carries none of the draw-to-draw noise that separates two
     different cohorts of 319. */
  let iStar = 0;
  for (let i = 1; i < rows.length; i += 1) if (rows[i].holdout > rows[iStar].holdout) iStar = i;
  return {
    rows,
    iStar,
    tuned: mean(bests.map((b) => b.target)),
    tunedHold: mean(bests.map((b) => b.holdout)),
    gap: meanSe(bests.map((b) => b.target - b.holdout)),
    gain: meanSe(all.map((c, s) => bests[s].target - c[iStar].target)),
    transfer: meanSe(all.map((c, s) => bests[s].holdout - c[iStar].holdout)),
    peakLog: peakLog / seeds,
    peakCount,
  };
}

/* How polygenic the trait is decides the whole shape of page 3, and the
   plan's default turned out to be the wrong end of it.

   FIRST WRITTEN AS hCausal 0.05 — 100 causal SNPs of 2000 at h² 0.30, so each
   causal SNP carries 0.003 of the trait and a base study of 3000 sees it at
   χ² ≈ 9. Measured at that setting the curve peaks at 1e-3 and reads 0.10 at
   5e-8, which is the opposite of the lesson's curve (0.0013 at 5e-8, maximum
   at 0.404). The lesson's shape is what a trait with effects too small for
   genome-wide significance looks like, so the ladder below is the measurement
   that picks the default, and it is spread, not h², that moves the peak. */
console.log("   The polygenicity ladder — what moves the peak (12 seeds each)\n");
console.log("   causal SNPs   peak threshold   R² at the peak   R² at 5e-8   R² at 0.5   R² at 1   tuning gain");
const LADDER = [0.05, 0.15, 0.3, 0.6, 1];
for (const hc of LADDER) {
  const s = curveSummary(12, { hCausal: hc });
  const peak = s.rows.reduce((a, b) => (b.target > a.target ? b : a));
  console.log(
    `   ${pad(Math.round(hc * 2000), 11)}   ${pad(peak.thresh.toExponential(0), 14)}   ` +
      `${pad(f(peak.target, 4), 14)}   ${pad(f(s.rows[0].target, 4), 10)}   ` +
      `${pad(f(s.rows[9].target, 4), 10)}   ${pad(f(s.rows[10].target, 4), 8)}   ${pad(f(s.gain.mu, 4), 11)}`,
  );
}
console.log("   the lesson's own:      4e-1           0.0497       0.0013       0.0460");

/* The default the rest of this file uses, chosen from the ladder above: the
   only row with an INTERIOR maximum whose fall past it matches the lesson's
   (peak 0.0497 at 0.404, 0.046 at 0.5 — a fall of 7%). 1200 and 2000 causal
   peak at the last threshold, which is a curve with no maximum to point at. */
const H_CAUSAL = 0.3;
console.log(`\n   The default from here on: ${Math.round(H_CAUSAL * 2000)} causal SNPs of 2000, h² 0.30\n`);

const SEEDS_319 = 30;
const sum319 = curveSummary(SEEDS_319, { hCausal: H_CAUSAL });
console.log("   threshold   SNPs kept   R² target (tuned on)   R² holdout");
for (const row of sum319.rows) {
  console.log(
    `   ${pad(row.thresh.toExponential(0), 9)}   ${pad(f(row.nSnp, 0), 9)}   ${pad(f(row.target, 4), 20)}   ${pad(f(row.holdout, 4), 10)}`,
  );
}
function gapReport(s, label) {
  console.log(
    `\n   ${label}: best-on-target R² ${f(s.tuned, 4)}   holdout R² at that same threshold ${f(s.tunedHold, 4)}` +
      `\n     gap ${f(s.gap.mu, 4)} ± ${f(s.gap.se, 4)}   —   two cohorts of different draws, so the standard error is the cohort's, not the tuning's` +
      `\n     the tuning gain on the SAME cohort, against the threshold ${s.rows[s.iStar].thresh.toExponential(0)} that is best on average: ` +
      `${f(s.gain.mu, 4)} ± ${f(s.gain.se, 4)}` +
      `\n     what that gain is worth in the holdout: ${f(s.transfer.mu, 4)} ± ${f(s.transfer.se, 4)}`,
  );
}
gapReport(sum319, "n = 319");
console.log(`   the tuned threshold, geometric mean: ${(10 ** sum319.peakLog).toExponential(2)}`);
console.log(
  `   where the maximum fell: ${[...sum319.peakCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, c]) => `${t.toExponential(0)}×${c}`)
    .join("  ")}`,
);

/* The plateau, and why it is the whole of page 3's argument. */
{
  const top = sum319.rows.filter((r) => r.thresh >= 0.05);
  const spread = Math.max(...top.map((r) => r.target)) - Math.min(...top.map((r) => r.target));
  console.log(
    `\n   Across the thresholds from 0.05 to 1 the MEAN curve moves ${f(spread, 4)} in R², and one cohort's` +
      `\n   tuning gain is ${f(sum319.gain.mu, 4)} — larger than the real difference between the thresholds it is choosing among.` +
      `\n   The maximum landed on ${sum319.peakCount.size} different thresholds over ${SEEDS_319} seeds. The top of this curve` +
      `\n   is a plateau, not a peak, and the lesson's own is too: 0.0497 at 0.404 against 0.046 at 0.5, a fall of 7%.`,
  );
  check(sum319.gain.mu > spread, "the tuning gain exceeds the whole spread of the plateau it is choosing within");
  check(sum319.peakCount.size >= 4, "and the maximum lands on a different threshold from seed to seed");
}

check(sum319.tuned > sum319.tunedHold, "the tuned R² exceeds the holdout R² on average — the selection optimism");
check(sum319.gain.mu > 3 * sum319.gain.se, "and the within-cohort tuning gain is clear of its own noise");
check(sum319.gain.mu > sum319.transfer.mu, "while what the tuning is worth in the holdout is smaller");
{
  const peak = sum319.rows.reduce((a, b) => (b.target > a.target ? b : a));
  const last = sum319.rows[sum319.rows.length - 1];
  check(peak.thresh >= 0.01, "the mean curve peaks at a LOOSE threshold, as the lesson's 0.404 did");
  check(sum319.rows[0].target < 0.01, "and is near zero at 5e-8, as the lesson's 0.0013 was");
  check(last.target < peak.target, "the curve falls again past its maximum");
}

console.log("\n   The same at n = 3000 in the target and the holdout (12 seeds — the draw is the cost)\n");
const sum3000 = curveSummary(12, { nTarget: 3000, hCausal: H_CAUSAL });
console.log("   threshold   SNPs kept   R² target   R² holdout");
for (const row of sum3000.rows) {
  console.log(
    `   ${pad(row.thresh.toExponential(0), 9)}   ${pad(f(row.nSnp, 0), 9)}   ${pad(f(row.target, 4), 9)}   ${pad(f(row.holdout, 4), 10)}`,
  );
}
gapReport(sum3000, "n = 3000");
check(sum3000.gain.mu < sum319.gain.mu, "the tuning gain shrinks as the target grows — there is less noise to fit");

/* Section 6 recommends building at base 1500 × m 1000, so the shape has to be
   checked THERE and not only at the size this section measured. */
console.log("\n   The same curve at the size the budget allows: base 1500, m 1000, 300 causal (12 seeds)\n");
const sumSmall = curveSummary(12, { nBase: 1500, m: 1000, hCausal: H_CAUSAL });
console.log("   threshold   SNPs kept   R² target   R² holdout");
for (const row of sumSmall.rows) {
  console.log(
    `   ${pad(row.thresh.toExponential(0), 9)}   ${pad(f(row.nSnp, 0), 9)}   ${pad(f(row.target, 4), 9)}   ${pad(f(row.holdout, 4), 10)}`,
  );
}
gapReport(sumSmall, "base 1500, m 1000");
{
  const peak = sumSmall.rows.reduce((a, b) => (b.target > a.target ? b : a));
  check(sumSmall.rows[0].target < 0.01, "the small genome is still near zero at 5e-8");
  check(peak.thresh >= 0.01, "and still peaks at a loose threshold");
  check(sumSmall.gain.mu > 3 * sumSmall.gain.se, "and still has a tuning gain clear of its own noise");
}

/* ---- 4. portability ------------------------------------------------------ */

console.log("\n4. Portability: the SAME weights and the SAME threshold on targets further and further from the base");
console.log("   (20 seeds, n 319; every ratio paired inside its own seed, so the base study's noise cancels)\n");

const PORT = [
  { label: "matched        Fst 0.00, no tag loss     ", fst: 0, tagLoss: 0, r2tag: 0.5 },
  { label: "frequency only Fst 0.10, no tag loss     ", fst: 0.1, tagLoss: 0, r2tag: 0.5 },
  { label: "near           Fst 0.02, tagLoss 0.5/0.5", fst: 0.02, tagLoss: 0.5, r2tag: 0.5 },
  { label: "far            Fst 0.10, tagLoss 1.0/0.2", fst: 0.1, tagLoss: 1, r2tag: 0.2 },
];

/* the tag-loss grid, all at Fst 0.10 — which setting reaches Martin's 0.5 */
const GRID = [];
for (const tagLoss of [0.25, 0.5, 1]) for (const r2tag of [0.8, 0.5, 0.2]) GRID.push({ tagLoss, r2tag });
const gridKey = (g) => `tagLoss ${g.tagLoss} × r²tag ${g.r2tag}`;

function portabilityTrial(seed) {
  const r = makeRng(seed);
  const model = simulateBase(r, { hCausal: H_CAUSAL });
  /* tune the threshold on the MATCHED target, then carry it — the widget's
     reader tunes once in the base study's own population and then asks what it
     is worth elsewhere, which is the portability question. */
  const tuneTarget = drawTarget(r, model, { n: 319 });
  const tuneCurve = thresholdCurve(model.betaHat, model.P, { target: tuneTarget });
  const best = bestThreshold(tuneCurve, "target");
  const { keep } = keepAt(model.P, best.thresh);
  const at = (o) => {
    const co = drawTarget(r, model, { n: 319, ...o });
    return r2Score(score(co.G, model.betaHat, keep), co.y);
  };
  const out = {};
  for (const c of PORT) out[c.label] = at({ ancestryShift: c.fst, tagLoss: c.tagLoss, r2tag: c.r2tag });
  const grid = {};
  for (const g of GRID) grid[gridKey(g)] = at({ ancestryShift: 0.1, ...g });
  return { out, grid, thresh: best.thresh, nSnp: best.nSnp, matched: out[PORT[0].label] };
}

const portR2 = Object.fromEntries(PORT.map((c) => [c.label, []]));
const portRatio = Object.fromEntries(PORT.map((c) => [c.label, []]));
const gridRatio = Object.fromEntries(GRID.map((g) => [gridKey(g), []]));
const PORT_SEEDS = 20;
let portThresh = 0;
for (let s = 0; s < PORT_SEEDS; s += 1) {
  const t = portabilityTrial(7000 + s);
  for (const c of PORT) {
    portR2[c.label].push(t.out[c.label]);
    portRatio[c.label].push(t.out[c.label] / t.matched);
  }
  for (const g of GRID) gridRatio[gridKey(g)].push(t.grid[gridKey(g)] / t.matched);
  portThresh += Math.log10(t.thresh);
}
console.log("   target                                       R²   ratio to matched (paired)");
const portMean = {};
for (const c of PORT) {
  portMean[c.label] = { r2: mean(portR2[c.label]), ratio: meanSe(portRatio[c.label]) };
  console.log(
    `   ${c.label}   ${pad(f(portMean[c.label].r2, 4), 6)}   ` +
      `${pad(f(portMean[c.label].ratio.mu, 2), 10)} ± ${f(portMean[c.label].ratio.se, 2)}`,
  );
}
console.log(`   threshold carried across, geometric mean: ${(10 ** (portThresh / PORT_SEEDS)).toExponential(2)}`);

/* FIRST WRITTEN AS three rows that differed only in Fst, on the plan's
   assumption that shifted allele frequencies alone cost a score its accuracy.
   Measured, they do not: Fst 0.10 with no tag loss keeps essentially all of
   the matched R², because every causal SNP still carries its own effect and
   only the raw-scale weight is mis-sized by the frequency change. The whole
   portability loss in this model comes from tag decay, which is the honest
   version anyway — the base study's SNP is a proxy, and a proxy is what
   travels badly. The widget's Target population control has to move BOTH. */
{
  const freqOnly = portMean[PORT[1].label].ratio;
  const near = portMean[PORT[2].label].ratio.mu;
  const far = portMean[PORT[3].label].ratio.mu;
  check(freqOnly.mu > 0.9, "an allele-frequency shift alone costs the score almost nothing");
  check(near < 0.9, "tag decay is what costs it — the near target loses a tenth or more");
  check(far < near, "and the far target loses more still");
  check(far <= 0.55, "the Strong setting lands at or below Martin 2019's ~0.5");
}

console.log("\n   Tag loss on its own, all at Fst 0.10 — the ratio to the matched target\n");
console.log("   r²tag →      0.8      0.5      0.2");
for (const tagLoss of [0.25, 0.5, 1]) {
  const cells = [0.8, 0.5, 0.2].map((r2tag) => mean(gridRatio[gridKey({ tagLoss, r2tag })]));
  console.log(`   tagLoss ${tagLoss.toFixed(2)}   ${cells.map((v) => pad(f(v, 2), 9)).join("")}`);
}
{
  const strong = mean(gridRatio[gridKey({ tagLoss: 1, r2tag: 0.2 })]);
  const mild = mean(gridRatio[gridKey({ tagLoss: 0.25, r2tag: 0.8 })]);
  console.log(
    `\n   Martin 2019 reads ~0.5 for an East Asian target of a European base and ~0.2 for an African one;` +
      `\n   the grid's mildest cell is ${f(mild, 2)} and its strongest ${f(strong, 2)}.`,
  );
  check(strong <= 0.3, "tagLoss 1.00 × r²tag 0.2 reaches Martin's African figure");
  check(mild > strong, "and the mild cell stays well above it — the control has range");
}

/* ---- 5. the quantile plot ------------------------------------------------ */

console.log("\n5. The quantile plot: vigintiles of the score in a target of 319 (~16 per bin), 20 seeds\n");

function quantileTrial(seed, opts = {}) {
  const { ancestryShift = 0, tagLoss = 0, r2tag = 0.5 } = opts;
  const r = makeRng(seed);
  const model = simulateBase(r, { hCausal: H_CAUSAL });
  const tune = drawTarget(r, model, { n: 319 });
  const best = bestThreshold(thresholdCurve(model.betaHat, model.P, { target: tune }), "target");
  const { keep } = keepAt(model.P, best.thresh);
  const co = drawTarget(r, model, { n: 319, ancestryShift, tagLoss, r2tag });
  const s = score(co.G, model.betaHat, keep);
  const bins = quantileBins(s, co.y, 20);
  const ysd = sd(co.y);
  const range = (bins[19].mean - bins[0].mean) / ysd;
  return {
    slope: binSlope(bins) / ysd,
    range,
    excluding: binsExcludingMean(bins, mean(co.y)),
    meanSe: mean(bins.map((b) => b.se)),
    r2: r2Score(s, co.y),
    ysd,
  };
}

console.log("   target                   R²   slope (SD/bin)   range bin1→bin20 (SD)   bins excluding the overall mean   mean bin SE");
const QUANT = [
  { label: "matched              ", fst: 0, tagLoss: 0, r2tag: 0.5 },
  { label: "far  Fst 0.10, 1.0/0.2", fst: 0.1, tagLoss: 1, r2tag: 0.2 },
];
const quantOut = {};
const QSEEDS = 20;
const LESSON_RANGE_SD = 1.4; // 0.45 on a trait SD of ~0.32 — see the note below
for (const q of QUANT) {
  const acc = { slope: [], range: [], excluding: [], meanSe: [], r2: [] };
  for (let s = 0; s < QSEEDS; s += 1) {
    const t = quantileTrial(3100 + s, { ancestryShift: q.fst, tagLoss: q.tagLoss, r2tag: q.r2tag });
    for (const k of Object.keys(acc)) acc[k].push(t[k]);
  }
  const out = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, mean(v)]));
  out.rangeSd = sd(acc.range);
  out.overLesson = acc.range.filter((v) => v > LESSON_RANGE_SD).length / QSEEDS;
  out.overOne = acc.range.filter((v) => v > 1).length / QSEEDS;
  quantOut[q.label] = out;
  console.log(
    `   ${q.label}   ${pad(f(out.r2, 3), 4)}   ${pad(f(out.slope, 3), 14)}   ${pad(f(out.range, 2), 21)}   ${pad(f(out.excluding, 1), 31)}   ${pad(f(out.meanSe, 3), 11)}`,
  );
}

{
  const m0 = quantOut[QUANT[0].label];
  const m1 = quantOut[QUANT[1].label];
  check(m0.range > 1, "at the matched target the trend is visible — a range over 1 trait SD");
  check(m1.range < m0.range, "and at the shifted target it is shallower");
  check(m0.excluding > m1.excluding, "and fewer of its bins separate from the overall mean");
}

console.log("\n   The lesson's own curve, for the comparison (02-2, quoted not recomputed):");
console.log("   vigintile 1 at 20.76, vigintile 20 at 21.21 — a range of 0.45 on bin SEs of ~0.08 at n ≈ 16,");
console.log("   so a trait SD near 0.32 and a range near 1.4 SD.");
/* FIRST WRITTEN AS the expectation that the simulated matched target would be
   STEEPER than the lesson's real curve. It is not, on average, and the reason
   is that the lesson's single curve is a high draw: at n = 319 the range from
   the first vigintile to the twentieth is itself noisy, and what looks like a
   weak trend in the lesson is not weaker than a matched simulation of it. */
{
  const m0 = quantOut[QUANT[0].label];
  console.log(
    `\n   The matched simulation, at R² ${f(m0.r2, 3)}, has a mean range of ${f(m0.range, 2)} SD with a seed-to-seed SD of ${f(m0.rangeSd, 2)}:` +
      `\n   ${f(m0.overOne, 2)} of seeds clear 1 SD but only ${f(m0.overLesson, 2)} clear the lesson's 1.4. So the matched target is NOT` +
      `\n   reliably steeper than the lesson's curve — the lesson's is a high draw, and the honest claim for page 4 is` +
      `\n   that the trend is visible at matched and shallower at the shifted target, not that the lesson's looks weak.` +
      `\n   Only ${f(m0.excluding, 1)} of 20 bins separate from the overall mean at matched: at ~16 per bin the intervals are wide,` +
      `\n   which is the lesson's figure and not a defect in it.`,
  );
}

/* ---- 6. cost ------------------------------------------------------------- */

console.log("\n6. Cost, against the ~150 ms compute() budget\n");

const MODEL_FOR_COST = simulateBase(makeRng(17), { hCausal: H_CAUSAL });

function time(label, fn, reps = 5) {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < reps; i += 1) fn();
  const ms = (performance.now() - t0) / reps;
  console.log(`   ${label.padEnd(58)} ${pad(f(ms, 1), 8)} ms`);
  return ms;
}

const tRegion = time("page 1: haplotypes 1000×100, LD matrix, genotypes 500, scan, clump", () => {
  const r = makeRng(11);
  const hap = simulateHaplotypes(r, {});
  const R = ldMatrix(hap.H);
  const G = makeGenotypes(r, hap.H, 500);
  const y = regionTrait(r, G, 50, 0.25);
  const scan = regionScan(y, G);
  clump(scan.P, R, hap.positions, {});
});

const tGenome = time(
  "pages 2–4: genome 3000 + 319 + 319, m 2000, base GWAS",
  () => {
    const r = makeRng(12);
    simulateGenome(r, { hCausal: H_CAUSAL });
  },
  3,
);

let tCurve = 0;
{
  const r = makeRng(13);
  const g = simulateGenome(r, { hCausal: H_CAUSAL });
  tCurve = time("      the 11-threshold curve with the holdout, alone", () => {
    thresholdCurve(g.betaHat, g.P, { target: g.target, holdout: g.holdout });
  });
}

const tSmall = time(
  "      the same at base 1500, m 1000",
  () => {
    const r = makeRng(14);
    simulateGenome(r, { nBase: 1500, m: 1000, hCausal: H_CAUSAL });
  },
  3,
);

time(
  "      the same at base 1000, m 600",
  () => {
    const r = makeRng(15);
    simulateGenome(r, { nBase: 1000, m: 600, hCausal: H_CAUSAL });
  },
  3,
);

const tTarget = time(
  "      one more target of 319 drawn against an existing base (m 2000)",
  () => {
    const r = makeRng(16);
    drawTarget(r, MODEL_FOR_COST, { n: 319, ancestryShift: 0.1, tagLoss: 1, r2tag: 0.2 });
  },
  3,
);

console.log(
  `\n   Page 1 is free at full size (${f(tRegion, 1)} ms), so the haplotype region needs no shrinking.` +
    `\n   Pages 2–4 at base 3000 × m 2000 sit at ${f(tGenome, 1)} ms, which is the whole budget for a draw the reader` +
    `\n   makes on every data-parameter change. Base 1500 × m 1000 is ${f(tSmall, 1)} ms and leaves room; that is the` +
    `\n   size to build at. The curve itself is ${f(tCurve, 1)} ms, so the P-threshold control is free — it must be a` +
    `\n   display parameter over a genome drawn once, never a reason to redraw. A further target cohort is ${f(tTarget, 1)} ms,` +
    `\n   so the Target population control is affordable at full size even if the base study is not redrawn with it.`,
);
check(tRegion < 150, "page 1 fits the compute() budget at full size");
check(tCurve < 150, "the threshold curve on an already-drawn genome fits");
check(tSmall < tGenome, "shrinking the base study shrinks the draw");
check(tSmall < 150, "and base 1500 × m 1000 fits with room to spare");

console.log(`\n${checks} checks, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
