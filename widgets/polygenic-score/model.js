/* ============================================================================
   Widget 59 · Polygenic scores — the engine, the geometry and the copy.

   PHM5003 week 6 (02-1 the score and the P-threshold sweep, 02-2 the quantile
   plot), carrying slot 58's LD-and-clumping material as page 1 — Kenneth's
   call 2026-09-11. `main.js` draws what this file computes.

   THE NUMERICS ARE MOVED, NOT REWRITTEN. Every function from `betai` down to
   `binsExcludingMean` is the one `_lab/prs-measure.mjs` measured the design
   with, copied here verbatim with its comments — that script runs its tables
   at top level, so it cannot be imported from, and the measured numbers are
   only the widget's numbers while the code is the same code. Each
   `FIRST WRITTEN AS` comment is the record of a claim the measurement
   corrected, and they are kept where they are.

   WHAT THE MEASUREMENT SETTLED (`_lab/prs-measure.mjs`, 35 checks, 2026-09-12;
   eight claims came out differently from the brief):

     1. A founder mosaic with independent founder alleles cannot make LD — the
        founders sit on a random genealogy and every SNP is a mutation on one
        of its branches.
     2. 60 SNPs at 25 kb cannot teach tagging. The region is 100 SNPs at 5 kb.
     3. Spread, not heritability, decides the threshold curve's shape: 300
        causal SNPs of 1,000 reproduce the lesson's curve, 100 do not.
     4. The maximum is a plateau, not a peak, and it lands on a different
        threshold from seed to seed.
     5. An allele-frequency shift alone costs a score almost nothing. All the
        portability loss in this model is tag decay, so each Target population
        setting moves both.
     6. The matched quantile plot is not reliably steeper than the lesson's.
     7. Base 1,500 × 1,000 SNPs is 42 ms where 3,000 × 2,000 is 141–161.
     8. The threshold curve on an already-drawn genome is 2 ms, which is what
        makes the P threshold a display parameter.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. FOUR SUB-STREAMS, DRAWN FIRST. `compute` takes four seeds off the top of
       the rng it is handed and builds the region, the base study, the target
       sample and the validation sample from one stream each. Without it the
       page-1 controls would move the genome: `simulateHaplotypes` consumes a
       different number of draws at each recombination rate, so changing
       Recombination would have redrawn the base study and every page after it.
       It also fixes what the mock found on its own page 4 — three populations
       taken from one stream in turn differ by where they landed in it as well
       as by their setting.

    2. THE REGION AND THE GENOME ARE BOTH BUILT ON EVERY DATA CHANGE. 5 ms and
       42 ms, and one `compute` for the whole widget keeps the four pages one
       figure rather than four.

    3. THE P THRESHOLD AND THE PERSON ARE DISPLAY PARAMETERS. The curve is
       2 ms on a genome already drawn, so the reader slides the threshold over
       one base study rather than redrawing it (measurement 8). Everything the
       four pages read at every threshold — the kept count, both R², the
       vigintile bins — is computed once, for all eleven.

    4. THE RUN IS PER PAGE. `anim.k` is an object, one count a page, so
       visiting another page and coming back keeps the work on both
       (non-negotiable 3). The pages count different things, which is exactly
       why one shared counter could not carry them.

    5. PAGE 1'S FIRST BEAT DRAWS THE TESTS. A widget starts empty
       (non-negotiable 4), and clumping cannot be watched before the tests it
       thins are on screen. Play spends its first frame on them and places no
       clump; Step goes on to place the clump its label promises — widget 57's
       variance step, in the same shape.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* ==========================================================================
   Copied numerics.

   lgamma, betacf, betai, tTwoSided, cholesky, cholInverse, weightedScan and
   olsScan came to `_lab/prs-measure.mjs` VERBATIM from
   `_lab/gwas-measure.mjs`, and come here verbatim from there. gammaDraw and
   betaDraw are from the same file. tCritical is the same tail as
   widgets/core/stats.js inverts, written out so this file imports only the
   rng — and memoised here on the degrees of freedom, because the quantile
   summary asks for it twenty times a threshold and the bins hold one of two
   sizes.
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
 *
 * MEMOISED ON df. The quantile summary calls it once a bin, twenty bins a
 * threshold and eleven thresholds a draw, and at ~16 people a bin there are
 * two distinct df in the whole figure: 120 bisections of `betai` each, 220
 * times, for two answers.
 */
const T_CRIT = new Map();
export function tCritical(df, conf = 0.95) {
  if (!(df > 0)) return Infinity;
  const key = `${df}:${conf}`;
  const hit = T_CRIT.get(key);
  if (hit !== undefined) return hit;
  const target = 1 - conf;
  let lo = 0;
  let hi = 400;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (tTwoSided(mid, df) > target) lo = mid;
    else hi = mid;
  }
  const out = (lo + hi) / 2;
  T_CRIT.set(key, out);
  return out;
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
   frequency U(0.1, 0.9), which is what the plan asked for. That cannot work,
   and the reason is worth keeping: two SNPs at zero distance sit on the SAME
   founder, so their r² across the sample is the r² between them AMONG THE
   FOUNDERS — and independent draws have none. Measured: mean r² at 0–50 kb
   was 0.06 at 8 founders and never rose above 0.18 at any founder count, a
   ceiling of about 1/(k − 1). Real LD is high because the founders are
   RELATED, so the founders here are built on a random genealogy: split the
   founder set recursively, and let each SNP be a mutation on one branch,
   carried by exactly the founders below it. Two SNPs on the same branch are
   then perfectly correlated, which is what a tag is. Allele frequencies come
   out as branch sizes over k rather than U(0.1, 0.9) — a consequence rather
   than an assumption, and closer to a real spectrum.
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
  const { nBase = 1500, m = 1000, hCausal = 0.3, h2 = 0.3 } = opts;
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
  return { p, betaTrue, causalIdx, nCausal, m, h2, nBase, base, betaHat: scan.beta, P: scan.P };
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

/** The eleven P thresholds the lesson's own sweep reports. */
export const THRESHOLDS = [5e-8, 1e-5, 0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

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
 * sample and the validation sample come back on the same row and page 3 can
 * draw one above the other.
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
    const idx = order.slice(lo, hi);
    const vals = idx.map((i) => y[i]);
    const mu = mean(vals);
    const s1 = sd(vals);
    const se = s1 / Math.sqrt(vals.length);
    const tc = tCritical(vals.length - 1);
    bins.push({
      bin: b + 1, n: vals.length, idx, mean: mu, sd: s1, se,
      lo: mu - tc * se, hi: mu + tc * se,
    });
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
   The region, the genome, and what the four pages read off them.
   ========================================================================== */

/* Page 1's region, at the density measurement 2 arrived at: 100 SNPs 5 kb
   apart is 495 kb, an array's density rather than a figure's. */
export const REGION = { nHap: 1000, m: 100, blockLen: 5, kFounder: 4 };
export const N_REGION = 500;
/** The causal SNP's effect: β 0.25 is 5.9% of the trait's variance. */
export const REGION_BETA = 0.25;
/** PRSice's own window, `--clump-kb 250kb`. */
export const CLUMP_KB = 250;
/** The same window in SNPs, which is what the r² triangle is clipped to. */
export const CLUMP_DEPTH = Math.round(CLUMP_KB / REGION.blockLen);
/** The display cut the panel's line names and the readouts count against. */
export const REGION_ALPHA = 0.05;
export const ALPHA_L = -Math.log10(REGION_ALPHA);

/* Pages 2–4's genome, at the size measurement 7 arrived at: base 3,000 over
   2,000 SNPs is 141–161 ms, the whole budget for a draw the reader makes on
   every data change; 1,500 over 1,000 keeps the curve's shape at a third of
   the cost. */
export const GENOME = { nBase: 1500, m: 1000 };
export const N_TARGET = 319;
export const N_VALIDATION = 319;

/**
 * One region: haplotypes, the r² matrix, 500 people, one hidden causal SNP,
 * the per-SNP test and the clumping.
 *
 * `typed: false` drops the causal SNP's own column before the scan — the
 * realistic case, where the causal variant is not on the array and the lead is
 * necessarily somebody else. The trait is still built from it.
 */
export function buildRegion(rng, cfg) {
  const hap = simulateHaplotypes(rng, { ...REGION, recomb: cfg.recomb });
  const R = ldMatrix(hap.H);
  const G = makeGenotypes(rng, hap.H, N_REGION);
  const causal = rng.int(5, hap.m - 6);
  const y = regionTrait(rng, G, causal, REGION_BETA);

  const idx = [];
  for (let j = 0; j < hap.m; j += 1) if (cfg.typed || j !== causal) idx.push(j);
  const Gs = idx.map((j) => G[j]);
  const pos = idx.map((j) => hap.positions[j]);
  const Rs = idx.map((a) => Float64Array.from(idx.map((b) => R[a][b])));

  const scan = regionScan(y, Gs);
  const clumps = clump(scan.P, Rs, pos, { r2: cfg.clumpR2, kb: CLUMP_KB });
  let lead = 0;
  for (let j = 1; j < idx.length; j += 1) if (scan.P[j] < scan.P[lead]) lead = j;

  const causalPos = hap.positions[causal];
  const causalCol = idx.indexOf(causal);
  /* WHICH BEAT THE CAUSAL MARK ARRIVES ON. The answer is a reference and not
     one of the tests, so it is drawn when the clumping reaches it and not
     before (2.1): the clump that holds the causal SNP's own column, or — when
     the causal variant is not on the array — the first clump whose span
     contains its position. */
  const spans = clumps.map((c) => {
    const cols = [c.index, ...c.members];
    const xs = cols.map((j) => pos[j]);
    return { lo: Math.min(...xs), hi: Math.max(...xs) };
  });
  let causalAt = 0;
  for (let c = 0; c < clumps.length; c += 1) {
    const holds = causalCol >= 0
      ? clumps[c].index === causalCol || clumps[c].members.includes(causalCol)
      : causalPos >= spans[c].lo && causalPos <= spans[c].hi;
    if (holds) {
      causalAt = c + 1;
      break;
    }
  }
  /* A position no clump spans — possible when the causal variant is untyped
     and its neighbours fall either side of it — arrives with the last clump
     rather than never. */
  if (causalAt === 0) causalAt = clumps.length;

  let hits = 0;
  for (let j = 0; j < scan.P.length; j += 1) if (scan.P[j] < REGION_ALPHA) hits += 1;

  return {
    hap, R, Rs, idx, pos, scan, clumps, spans, lead, causal, causalCol, causalPos, causalAt,
    typed: cfg.typed,
    clumpR2: cfg.clumpR2,
    span: hap.positions[hap.m - 1],
    hits,
    sigClumps: clumps.filter((c) => c.p < REGION_ALPHA).length,
    leadIsCausal: cfg.typed && idx[lead] === causal,
    leadR2: R[idx[lead]][causal],
    leadDist: Math.abs(pos[lead] - causalPos),
    top: Math.max(4, Math.ceil(Math.max(...scan.logp) + 0.6)),
  };
}

/**
 * Pages 2–4: the base study, the target sample, the validation sample, and
 * everything the eleven thresholds imply — the kept count, both R², the
 * vigintile bins of the target and the R² over the people those bins hold.
 *
 * THE CURVE IS COMPUTED FOR EVERY THRESHOLD, ONCE. The P threshold is a
 * display parameter (decision 3), so what the reader slides over has to be
 * there already; and page 4's own reading of a partial figure — the R² over
 * the vigintiles landed so far — is a cumulative sum over the same bins.
 */
export function buildGenome(rngBase, rngTarget, rngValidation, cfg) {
  const model = simulateBase(rngBase, {
    nBase: GENOME.nBase, m: GENOME.m, hCausal: cfg.nCausal / GENOME.m, h2: cfg.h2,
  });
  const tOpts = { ancestryShift: cfg.fst, tagLoss: cfg.tagLoss, r2tag: cfg.r2tag };
  const target = drawTarget(rngTarget, model, { n: N_TARGET, ...tOpts });
  const validation = drawTarget(rngValidation, model, { n: N_VALIDATION, ...tOpts });

  const overall = mean(target.y);
  const ysd = sd(target.y);
  const rows = THRESHOLDS.map((thresh) => {
    const { keep, n } = keepAt(model.P, thresh);
    const kept = [];
    for (let j = 0; j < model.P.length; j += 1) if (keep[j]) kept.push(j);
    const sT = score(target.G, model.betaHat, keep);
    const sV = score(validation.G, model.betaHat, keep);
    const r2T = n === 0 ? 0 : r2Score(sT, target.y);
    const r2V = n === 0 ? 0 : r2Score(sV, validation.y);
    const bins = quantileBins(sT, target.y, 20);
    /* the R² over the people the first k vigintiles hold — what page 4's tile
       can honestly print while the figure is still arriving (2.8) */
    const binR2 = [0];
    const sSoFar = [];
    const ySoFar = [];
    for (const b of bins) {
      for (const i of b.idx) {
        sSoFar.push(sT[i]);
        ySoFar.push(target.y[i]);
      }
      binR2.push(sSoFar.length > 2 ? r2Score(sSoFar, ySoFar) : 0);
    }
    return {
      thresh,
      nSnp: n,
      kept,
      target: r2T,
      validation: r2V,
      score: sT,
      bins,
      binR2,
      range: (bins[19].mean - bins[0].mean) / ysd,
      excluding: binsExcludingMean(bins, overall),
      sMin: Math.min(...sT),
      sMax: Math.max(...sT),
      sMean: mean(sT),
      sSd: sd(sT),
    };
  });

  let bestIdx = 0;
  for (let i = 1; i < rows.length; i += 1) if (rows[i].target > rows[bestIdx].target) bestIdx = i;

  return { ...model, target, validation, rows, bestIdx, overall, ysd };
}

/**
 * Everything the widget draws, from the seeded rng and the resolved controls.
 *
 * DECISION 1: four sub-streams, their seeds taken off the top of the rng core
 * hands in, so a control on one page cannot move another page's data.
 */
export function build(rng, cfg) {
  const seeds = [rng.int(1, 1e9), rng.int(1, 1e9), rng.int(1, 1e9), rng.int(1, 1e9)];
  const region = buildRegion(makeRng(seeds[0]), cfg);
  const genome = buildGenome(makeRng(seeds[1]), makeRng(seeds[2]), makeRng(seeds[3]), cfg);
  return { cfg, region, genome };
}

/* ==========================================================================
   What a partly built figure reads.
   ========================================================================== */

/** The row of the curve the P threshold names. */
export const rowFor = (state, params) =>
  state.genome.rows[Math.max(0, THRESHOLDS.indexOf(Number(params.threshold)))];

/** Page 2's arithmetic for one person, at the threshold on the rail. */
export function personScore(state, params) {
  const row = rowFor(state, params);
  const i = Math.min(Math.max(Math.round(params.person) - 1, 0), N_TARGET - 1);
  const genotype = row.kept.map((j) => state.genome.target.G[j][i]);
  const beta = row.kept.map((j) => state.genome.betaHat[j]);
  const contrib = genotype.map((g, k) => g * beta[k]);
  const cum = [];
  let run = 0;
  for (const c of contrib) {
    run += c;
    cum.push(run);
  }
  const total = row.score[i];
  let below = 0;
  for (const v of row.score) if (v < total) below += 1;
  return {
    row,
    person: i + 1,
    n: row.nSnp,
    genotype,
    beta,
    contrib,
    cum,
    total,
    z: row.sSd > 0 ? (total - row.sMean) / row.sSd : 0,
    percentile: (100 * below) / row.score.length,
  };
}

/** How many beats a page's run holds. */
export function totalFor(page, state, params) {
  if (page === "ld") return state.region.clumps.length;
  if (page === "score") return rowFor(state, params).nSnp;
  if (page === "threshold") return THRESHOLDS.length;
  return 20;
}

/* PACING. One beat a unit, and the beat is the page's own: eleven thresholds
   and eight-and-some clumps are not the same length of run as thirty-eight
   SNPs, so a single interval would make one page crawl and another flick past.
   The measured totals at the defaults are in `_lab/prs-verify.mjs`, which
   fails any page whose Play lands outside 3 to 7 seconds.

   THE FRACTION IS KEPT ACROSS FRAMES (widget 55's clock): `beat` fills over
   the page's own interval and the run advances by whatever whole units have
   accumulated, so the pace stays a RATE rather than becoming one unit a frame
   on a slow machine. */
export const BEAT_MS = { ld: 400, score: 160, threshold: 400, quantile: 200 };
export const beatMs = (page) => BEAT_MS[page] ?? 200;

/* A BEAT CARRIES A BATCH once the units stop being countable (2.3) — on page 2
   at the same threshold the columns stop being countable, and on page 1 where
   a strict clumping r² leaves fifty-eight clumps of one SNP rather than eight
   of twenty. The cap is the number of beats the whole run takes, so Play is
   between three and seven seconds at every setting of every control; Step is
   always ONE unit, because a control's label names what this press will do and
   it says Next clump, Next SNP. */
export const RUN_BEATS = { ld: 17, score: 40 };
export function perUnit(page, state, params) {
  const cap = RUN_BEATS[page];
  if (!cap) return 1;
  return Math.max(1, Math.ceil(totalFor(page, state, params) / cap));
}

/* ==========================================================================
   The geometry, one function (5.8).

   The heights are set by `axisX`, which puts its tick row at the baseline + 6
   and its label at the baseline + 22 with `textBaseline: "top"`, so a label
   occupies to about + 35; a `caption` sits 8px above its rect on an alphabetic
   baseline and occupies from about − 18. The stacked page-1 and page-2 panels
   are spaced against that arithmetic and not by eye — the mock had the sum
   strip's axis label and the distribution's caption at 302 and 314, printing
   through each other.
   ========================================================================== */

export const AX_L = 52;
export const AX_R = 8;

/* page 1 */
export const ASSOC_TOP = 34;
export const ASSOC_H = 160;
export const ASSOC_GAP = 66;
export const TRI_FOOT = 12;

/* page 2 */
export const GENO_Y = 38;
export const GENO_H = 30;
export const W_Y = 90;
export const W_H = 66;
export const SUM_Y = 188;
export const SUM_H = 92;
export const DIST_Y = 336;
export const DIST_H = 44;
export const SCORE_PANEL_H = 424;

/* page 3 — the right margin holds the SNPs-kept tick column and its label */
export const TH_L = 54;
export const TH_R = 66;
export const TH_TOP = 40;
export const TH_H = 210;
export const THRESH_PANEL_H = 316;

/* page 4 */
export const Q_L = 54;
export const Q_R = 16;
export const Q_TOP = 40;
export const Q_H = 196;
export const QUANT_PANEL_H = 300;

/**
 * Every rect a page draws in, and its own height, from the width and the
 * parameters alone — the same function `height` and `draw` both call (5.8).
 */
export function layout(w, values) {
  const page = values.page ?? "ld";
  if (page === "ld") {
    const panelW = Math.max(220, Math.round(w - AX_L - AX_R));
    const triTop = ASSOC_TOP + ASSOC_H + ASSOC_GAP;
    /* The triangle is the clumping window and nothing wider: 50 SNPs either
       way is the 250 kb `--clump-kb`, and the pairs beyond it are r² ≈ 0.
       Its depth in pixels is half the window's own column pitch, so the panel
       is taller in a wider frame — the same trade `linear-regularization`
       makes for a square. */
    const cell = panelW / (REGION.m - 1);
    const triH = Math.ceil((CLUMP_DEPTH / 2) * cell);
    return {
      page,
      assoc: { x: AX_L, y: ASSOC_TOP, w: panelW, h: ASSOC_H },
      tri: { x: AX_L, y: triTop, w: panelW, h: triH, depth: CLUMP_DEPTH },
      height: triTop + triH + TRI_FOOT,
    };
  }
  if (page === "score") {
    const panelW = Math.max(220, Math.round(w - AX_L - AX_R));
    return {
      page,
      geno: { x: AX_L, y: GENO_Y, w: panelW, h: GENO_H },
      weights: { x: AX_L, y: W_Y, w: panelW, h: W_H },
      sum: { x: AX_L, y: SUM_Y, w: panelW, h: SUM_H },
      dist: { x: AX_L, y: DIST_Y, w: panelW, h: DIST_H },
      height: SCORE_PANEL_H,
    };
  }
  if (page === "threshold") {
    return {
      page,
      curve: { x: TH_L, y: TH_TOP, w: Math.max(220, Math.round(w - TH_L - TH_R)), h: TH_H },
      height: THRESH_PANEL_H,
    };
  }
  return {
    page: "quantile",
    bins: { x: Q_L, y: Q_TOP, w: Math.max(220, Math.round(w - Q_L - Q_R)), h: Q_H },
    height: QUANT_PANEL_H,
  };
}

/** The stage height, from the parameters and the width alone. */
export const stageHeight = (w, values) => layout(w, values).height;

/* ==========================================================================
   Numbers on screen.
   ========================================================================== */

export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
export const intText = (v) => Math.round(v).toLocaleString("en-US");
/** A P threshold as the reader sees it on its own tick. */
export const tText = (t) => {
  const s = String(t);
  return s.includes("e") ? s.replace("e-", "e−") : s;
};

/* ==========================================================================
   The parameters, and their copy (5.9).

   No "tune", "tuned" or "tuning" and no "holdout" anywhere a reader can see
   them — Kenneth's two nomenclature rulings, 2026-09-12. The field's own
   words are the base GWAS, the target sample, the validation sample, the
   best-fit threshold, out of sample, and overfitting; `--c-holdout` stays the
   token the validation curve is drawn in, which is a name in this file and
   not on the page.
   ========================================================================== */

export const PAGES = [
  { value: "ld", label: "LD and clumping" },
  { value: "score", label: "The score" },
  { value: "threshold", label: "The threshold" },
  { value: "quantile", label: "The quantile plot" },
];

/* The three recombination rates, measured over 50 seeds: at 0.002 the region
   holds LD out past 200 kb, at 0.005 a SNP has several neighbours over r² 0.1
   inside the clumping window, at 0.02 almost none. */
export const RECOMB = [
  { value: "low", label: "Low", rate: 0.002 },
  { value: "medium", label: "Medium", rate: 0.005 },
  { value: "high", label: "High", rate: 0.02 },
];
export const recombOf = (key) => RECOMB.find((r) => r.value === key) ?? RECOMB[1];

/* PRSice's own `--clump-r2 0.1`, and the stricter setting beside it. */
export const CLUMP_R2 = [
  { value: "0.1", label: "0.1" },
  { value: "0.5", label: "0.5" },
];

export const TYPED = [
  { value: "typed", label: "Typed" },
  { value: "untyped", label: "Untyped" },
];

/* The polygenicity ladder. Measured: 100 causal SNPs of 1,000 put R² 0.10 at
   5 × 10⁻⁸ and peak at 10⁻³, which is the opposite of the lesson's curve; 300
   reproduces it. */
export const CAUSAL = [
  { value: "100", label: "100" },
  { value: "300", label: "300" },
  { value: "600", label: "600" },
];

export const H2 = [
  { value: "0.1", label: "0.1" },
  { value: "0.3", label: "0.3" },
  { value: "0.5", label: "0.5" },
];

/* THE TARGET POPULATION MOVES TAG DECAY AS WELL AS ALLELE FREQUENCY, and that
   is measurement 5: at Fst 0.1 with every tag intact a score keeps 0.91 of its
   matched R², because each causal SNP still carries its own effect and only
   the raw-scale weight is mis-sized. The loss is in the tags. Fst 0.02 with
   half the causal SNPs seen at r² 0.5 gives about 0.7, and Fst 0.1 with all of
   them at r² 0.2 gives about 0.2 — Martin 2019's African-target figure. */
export const TARGETS = [
  { value: "same", label: "Same ancestry as the base", fst: 0, tagLoss: 0, r2tag: 0.5 },
  { value: "nearby", label: "Nearby ancestry", fst: 0.02, tagLoss: 0.5, r2tag: 0.5 },
  { value: "distant", label: "Distant ancestry", fst: 0.1, tagLoss: 1, r2tag: 0.2 },
];
export const targetOf = (key) => TARGETS.find((t) => t.value === key) ?? TARGETS[0];

/* The eleven thresholds as the slider's ticks. The value IS the tick, so a
   copied link carries the number the reader saw (5.9). */
export const THRESHOLD_OPTIONS = ["5e-8", "1e-5", "0.001", "0.01", "0.05", "0.1", "0.2", "0.3",
  "0.4", "0.5", "1"].map((s) => ({ value: s, label: s }));

export const STRINGS = {
  /* Kenneth's pick C of three, 2026-09-12, in the field's own terms after his
     question "I see the word tune — is this normal?" */
  subtitle:
    "A polygenic score is the sum of effect alleles weighted by base-GWAS effect sizes. "
    + "Its accuracy is assessed out of sample and depends on the target sample sharing "
    + "the base study's ancestry.",

  /* the gallery card: one declarative sentence naming the concept, inside the
     card's 120 characters */
  blurb:
    "A polygenic score sums effect alleles weighted by GWAS effect sizes; its accuracy is assessed out of sample.",

  pageLabel: "Page",
  pageDetail: "the four steps of building a score and assessing it",

  regionSection: "The region",
  baseSection: "The base study",
  targetSection: "The target",

  recombLabel: "Recombination",
  recombDetail: "the chance per kilobase that a haplotype switches ancestor",

  clumpR2Label: "Clumping r²",
  /* Copy audit 2026-09-12: the question-shaped details ("how many", "how
     far", "which of") and "counts as explained" restated as what each
     control is. */
  clumpR2Detail: "the r² to the lead SNP at or above which a SNP is dropped",

  typedLabel: "Causal variant",
  typedDetail: "whether the causal SNP is one of the 100 on the array",

  causalLabel: "Causal SNPs",
  causalDetail: "the number of the 1,000 SNPs with an effect on the trait",

  h2Label: "Heritability",
  h2Detail: "the fraction of the trait's variance the causal SNPs explain together",

  targetLabel: "Target population",
  targetDetail: "the distance between the target sample's ancestry and the base study's",

  thresholdLabel: "P threshold",
  thresholdDetail: "the P value in the base study below which a SNP is kept in the score",

  personLabel: "Person",
  personDetail: "the person in the target sample whose score is built",

  seedLabel: "Seed",
  seedDetail: "draws a different base study and different samples",

  /* the drive row, one noun a page (3.4c) */
  stepLd: "Next clump",
  stepScore: "Next SNP",
  stepThreshold: "Next threshold",
  stepQuantile: "Next vigintile",
  stepTitleLd: "Take the next clump: its lead SNP, and the SNPs in LD with it",
  stepTitleScore: "Add the next SNP to the sum",
  stepTitleThreshold: "Score both samples at the next P threshold",
  stepTitleQuantile: "Draw the next vigintile of the score",
  runTitleLd: "Clump the rest of the region",
  runTitleScore: "Add the remaining SNPs in order",
  runTitleThreshold: "Sweep the remaining P thresholds",
  runTitleQuantile: "Draw the remaining vigintiles",

  /* page 1, on the canvas */
  assocCaption: "one region, every SNP tested against the trait",
  assocCaptionClumped: "the lead SNP of each clump, and the SNPs in LD with it",
  assocX: "position (kb)",
  assocY: "−log₁₀P",
  alphaLabel: "P = 0.05",
  triCaption: "r² between every pair within 250 kb",
  triNote: "0 to 1",

  /* page 2 */
  genoCaption: "the person's genotype, effect alleles carried",
  weightCaption: "the base study's weight for each SNP",
  weightNote: "β̂, on the raw allele count",
  sumCaption: "the sum so far",
  sumX: "SNPs kept by the P threshold",
  distCaption: "every person in the target sample, by score",
  distX: "score",

  /* page 3 */
  curveCaption: "R² of the score against the P threshold",
  curveNote: "best-fit threshold in the target sample, then assessed in the validation sample",
  curveX: "P threshold",
  curveY: "R²",
  keptAxis: "SNPs kept",

  /* page 4 */
  quantCaption: "mean trait by score vigintile, with 95% intervals",
  quantX: "score vigintile",
  quantY: "mean trait",
  meanLine: "The sample's mean trait",
};

/** The step label a page wears, as the declarative map core reserves against. */
export const STEP_LABELS = {
  param: "page",
  labels: {
    ld: STRINGS.stepLd,
    score: STRINGS.stepScore,
    threshold: STRINGS.stepThreshold,
    quantile: STRINGS.stepQuantile,
  },
  default: STRINGS.stepLd,
};
export const STEP_TITLES = {
  param: "page",
  labels: {
    ld: STRINGS.stepTitleLd,
    score: STRINGS.stepTitleScore,
    threshold: STRINGS.stepTitleThreshold,
    quantile: STRINGS.stepTitleQuantile,
  },
  default: STRINGS.stepTitleLd,
};
export const RUN_TITLES = {
  param: "page",
  labels: {
    ld: STRINGS.runTitleLd,
    score: STRINGS.runTitleScore,
    threshold: STRINGS.runTitleThreshold,
    quantile: STRINGS.runTitleQuantile,
  },
  default: STRINGS.runTitleLd,
};

/** The region and the genome the controls describe, resolved once. */
export function configFor(params) {
  const t = targetOf(params.target);
  return {
    recomb: recombOf(params.recomb).rate,
    clumpR2: Number(params.clumpR2),
    typed: params.causalTyped !== "untyped",
    nCausal: Number(params.causal),
    h2: Number(params.h2),
    fst: t.fst,
    tagLoss: t.tagLoss,
    r2tag: t.r2tag,
  };
}
