/* Planning measurement for the GWAS arc's `gwas` slot (PHM5003 06 / 01-4 the
 * PCA, 01-5 the GRM and fastGWA, 01-6 the Manhattan and QQ plots).
 *
 * The slot's one claim: a test of every SNP on a structured sample finds the
 * structure at every SNP, and the mixed model is how the structure is taken
 * out — principal components for ancestry, the genetic relationship matrix for
 * relatedness — before a skyline or a QQ plot means anything.
 *
 * The lesson's own run is the case that fails. 01-5's log reads `Vg 4.8e-18`,
 * `Heritability = 6e-17 (Pval = 1)`, then "the estimate of Vg is not
 * statistically significant … the program will use linear regression for
 * association test" — 319 people from three populations with no relatives
 * carry no relatedness variance to estimate, so every P in the lesson's
 * `.fastGWA` file is ordinary least squares on the SNP plus five PCs. The GRM
 * term did nothing. The widget has to be able to show that, and to show what
 * brings it back.
 *
 * So this script asks seven things, each one a control the widget depends on.
 * The answers below are what it printed; four of them are not what the plan
 * expected, and each of those carries a /* FIRST WRITTEN AS … *\/ comment at
 * the check that changed.
 *
 *   1. λ, false positives and power by model (SNP only · + 2 PCs · + 5 PCs)
 *      across the subpopulation shift and Fst. At shift 1, Fst 0.03: SNP only
 *      gives λ 3.1 and 28 false peaks of 1997; + 2 PCs gives λ 0.99 and 0.1.
 *      At Fst 0.1, shift 2 it is λ 14.4 and 531 false peaks — half the genome.
 *      PCs 3 through 5 change nothing anywhere. NOT as expected: the PCs cost
 *      the causal SNPs power at Fst 0.1 (0.40 → 0.30), because a strongly
 *      differentiated causal SNP is partly collinear with PC1.
 *   2. Whether the GRM term is inert without families. The SCAN is: λ moves by
 *      at most 0.05 and no peak crosses Bonferroni, whether fastGWA falls back
 *      or is forced to use the GRM. The ESTIMATE is not: ĥ² comes back 0.12 to
 *      0.44 rather than the lesson's 6e-17, and a polygenic background of 0.3
 *      is found in 6 of 10 cohorts. That is a property of a 2000-SNP genome —
 *      §4 measures the GRM's off-diagonal spread at 0.024, fifteen times a real
 *      GRM's — and it means the widget can promise the reader the skyline will
 *      not move, but not that the variance readout will print zero.
 *   3. Whether families bring it back. Yes: sdFamily 1 takes λ from 1.00 to
 *      1.76 under + 5 PCs alone with 3.8 false peaks, and the GRM returns it
 *      to 0.99 with none, the LRT at 5e-12. NOT as expected: sibships with NO
 *      shared effect are already inflated (λ 1.13), because the causal SNPs'
 *      heritability is itself a family resemblance.
 *   4. The eigenvalue signature. Two large then flat, as the lesson has — but
 *      NOT as expected, three equidistant subpopulations give λ1 ≈ λ2 (7.46,
 *      7.06) where the lesson has 17.28 and 3.08. Chinese and Malay are close
 *      and Indian is far, so the simulation needs a NESTED topology; at Fst
 *      0.05 with the near pair at 0.005 the ratio comes out at 6.4 against the
 *      lesson's 5.6. With sibships the spectrum grows a ramp exactly nFam − 1
 *      wide, ending in a cliff where the value halves in one step.
 *   5. The QQ reading: SNP only puts 26% of SNPs under P < 0.05 where the null
 *      puts 5%, so the plot lifts along its whole length and not only at the
 *      tail. + 2 PCs returns it to 4.9%.
 *   6. Which effect size puts the three causal SNPs over Bonferroni at the
 *      lesson's n. NOT as expected: h2snp 0.05 clears it one time in four and
 *      0.08 only 63% of the time; 0.12 is the lowest setting that shows a peak
 *      reliably at n = 300.
 *   7. What one compute() costs. 128 ms for a PC-only pass at n = 300 and 752
 *      at n = 600, so n = 300 is the ceiling at m = 2000. NOT as expected, the
 *      largest single item is the eigendecomposition (67 ms), not the GRM (42)
 *      — and it is avoidable: the widget needs a two-dimensional subspace, and
 *      subspace iteration finds it in 5.5 ms with an identical scan.
 *
 * The simulation is Balding–Nichols: an ancestral frequency per SNP, a
 * subpopulation frequency drawn Beta(p(1−F)/F, (1−p)(1−F)/F), genotypes
 * Binomial(2, p_k). Families are sibships of four, two parents drawn from the
 * subpopulation and each child by Mendelian transmission at each SNP
 * independently — no linkage, which is slot 59's business, not this one.
 *
 * P comes from the t distribution on n − p − 1 df (regularized incomplete
 * beta), not the normal approximation, and the same machinery serves OLS and
 * GLS so that λ is comparable between models: the GLS scan is the OLS scan
 * with weights 1/(h²d_i + 1 − h²) in the eigenbasis of the GRM. The REML step
 * profiles the restricted likelihood over h² on a grid and then refines, and
 * reports the LRT of Vg = 0 as GCTA does, halving the χ²(1) tail for the
 * boundary.
 *
 * All randomness is the seeded `makeRng`. Zero dependencies.
 *
 * Run: node widgets/_lab/gwas-measure.mjs
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

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const pad = (s, w) => String(s).padStart(w);

/* ==========================================================================
   Distributions: the tails the tests need, and the draws the cohort needs.
   ========================================================================== */

/* erfc, Numerical Recipes' Chebyshev fit, |error| < 1.2e-7 — copied from
   hwe-measure.mjs, where it serves the same χ²(1) tail. */
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Upper tail of χ² with 1 df. */
export const chi1Tail = (x) => (x <= 0 ? 1 : erfc(Math.sqrt(x / 2)));

/** χ²(1) quantile: the x with chi1Tail(x) = alpha, by bisection. */
export function chi1Inv(alpha) {
  if (alpha >= 1) return 0;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (chi1Tail(mid) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* Lanczos log-gamma, and the regularized incomplete beta by its continued
   fraction — together they give the two-sided t tail exactly enough to count
   hits at 2.5e-5, which the normal approximation on 294 df does not. */
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

/** Regularized incomplete beta I_x(a, b). */
export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided P for a t statistic on df degrees of freedom. */
export function tTwoSided(t, df) {
  if (!Number.isFinite(t)) return 1;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** Gamma(shape, 1) — Marsaglia–Tsang, seeded. */
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

/** Beta(a, b) as X / (X + Y) with two Gamma draws. */
export function betaDraw(rng, a, b) {
  const x = gammaDraw(rng, a);
  const y = gammaDraw(rng, b);
  return x + y > 0 ? x / (x + y) : 0.5;
}

/* ==========================================================================
   The cohort.
   ========================================================================== */

/**
 * n individuals in k equal subpopulations, m SNPs, Balding–Nichols
 * frequencies at the given Fst, and a trait.
 *
 * The trait is
 *     y = μ_pop + Σ_causal √h2snp · z_j + Σ_bg √(h2bg/nbg) · z_j + f + ε
 * with z the sample-standardised genotype, f the sibship effect N(0, sdFamily)
 * and ε ~ N(0, σ²) where σ² = 1 − (#causal)·h2snp − h2bg. The residual SD is
 * set that way, rather than fixed at 1, so that `h2snp` really is the fraction
 * of the trait's variance one causal SNP explains — which is the number the
 * widget's control will be labelled with. μ_pop is `shift` × that residual SD
 * × (−1, 0, +1): the "diet" confounder, in units the reader can hold.
 *
 * Note that the population shift and the family effect ADD variance on top of
 * that 1, so a causal SNP's marginal R² in the raw sample is smaller than
 * h2snp — by a third at shift 1. Conditioning on the PCs gives it back, which
 * is one of the things §6 measures.
 */
export function simulateCohort(rng, opts = {}) {
  const {
    n = 300,
    k = 3,
    m = 2000,
    fst = 0.03,
    shift = 1,
    causal = null,
    h2snp = 0.05,
    h2bg = 0,
    nbg = 200,
    families = false,
    sdFamily = 0,
    topology = "star",
    fstShallow = null,
  } = opts;

  const causalIdx = causal ?? [Math.floor(m * 0.1), Math.floor(m * 0.45), Math.floor(m * 0.8)];
  const famSize = 4;
  const nFam = families ? Math.floor(n / famSize) : 0;

  /* who is in which subpopulation, and which sibship */
  const pop = new Int32Array(n);
  const famId = new Int32Array(n).fill(-1);
  if (families) {
    for (let f = 0; f < nFam; f += 1) {
      const fpop = Math.min(k - 1, Math.floor((f * k) / nFam));
      for (let c = 0; c < famSize; c += 1) {
        const i = f * famSize + c;
        pop[i] = fpop;
        famId[i] = f;
      }
    }
  } else {
    for (let i = 0; i < n; i += 1) pop[i] = Math.min(k - 1, Math.floor((i * k) / n));
  }

  /* genotypes.

     `topology` is "star" — every subpopulation diverges from the ancestor by
     the same Fst — or "nested", where two of the three share a recent ancestor
     and the third split earlier. §4 is why the option exists: a star gives two
     eigenvalues of equal height and the lesson's GRM gives 17.28 and 3.08. */
  const nested = topology === "nested" && k === 3;
  const fstNear = fstShallow ?? fst / 10;
  const G = new Array(m);
  const a0 = (1 - fst) / fst;
  const aNear = (1 - fstNear) / fstNear;
  const clamp = (p) => Math.min(1 - 1e-6, Math.max(1e-6, p));
  for (let j = 0; j < m; j += 1) {
    const p0 = rng.uniform(0.1, 0.9);
    const pk = new Float64Array(k);
    if (nested) {
      const pA = clamp(betaDraw(rng, p0 * a0, (1 - p0) * a0));
      pk[2] = betaDraw(rng, p0 * a0, (1 - p0) * a0);
      pk[0] = betaDraw(rng, pA * aNear, (1 - pA) * aNear);
      pk[1] = betaDraw(rng, pA * aNear, (1 - pA) * aNear);
    } else for (let s = 0; s < k; s += 1) pk[s] = betaDraw(rng, p0 * a0, (1 - p0) * a0);
    const col = new Float64Array(n);
    if (families) {
      for (let f = 0; f < nFam; f += 1) {
        const p = pk[pop[f * famSize]];
        const gm = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0);
        const gf = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0);
        for (let c = 0; c < famSize; c += 1) {
          col[f * famSize + c] =
            (rng.next() < gm / 2 ? 1 : 0) + (rng.next() < gf / 2 ? 1 : 0);
        }
      }
    } else {
      for (let i = 0; i < n; i += 1) {
        const p = pk[pop[i]];
        col[i] = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0);
      }
    }
    G[j] = col;
  }

  /* sample mean and SD per SNP, once */
  const mean = new Float64Array(m);
  const sd = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    const col = G[j];
    let s = 0;
    for (let i = 0; i < n; i += 1) s += col[i];
    const mu = s / n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (col[i] - mu) ** 2;
    mean[j] = mu;
    sd[j] = Math.sqrt(v / n);
  }

  /* the background SNPs: nbg distinct non-causal indices */
  const bgIdx = [];
  if (h2bg > 0) {
    const taken = new Set(causalIdx);
    let guard = 0;
    while (bgIdx.length < Math.min(nbg, m - causalIdx.length) && guard < 50 * m) {
      const j = rng.int(0, m - 1);
      guard += 1;
      if (!taken.has(j)) {
        taken.add(j);
        bgIdx.push(j);
      }
    }
  }

  const resVar = Math.max(0.05, 1 - causalIdx.length * h2snp - h2bg);
  const resSd = Math.sqrt(resVar);
  const bCausal = Math.sqrt(h2snp);
  const bBg = bgIdx.length ? Math.sqrt(h2bg / bgIdx.length) : 0;
  const famEff = new Float64Array(Math.max(1, nFam));
  for (let f = 0; f < nFam; f += 1) famEff[f] = rng.normal(0, sdFamily);

  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let v = shift * resSd * (pop[i] - (k - 1) / 2) * (k > 1 ? 2 / (k - 1) : 0);
    for (const j of causalIdx) if (sd[j] > 0) v += bCausal * ((G[j][i] - mean[j]) / sd[j]);
    for (const j of bgIdx) if (sd[j] > 0) v += bBg * ((G[j][i] - mean[j]) / sd[j]);
    if (families && sdFamily > 0) v += famEff[famId[i]];
    y[i] = v + rng.normal(0, resSd);
  }

  return { n, k, m, G, y, pop, famId, nFam, causalIdx, bgIdx, mean, sd, resSd, opts: { ...opts } };
}

/**
 * The GRM as the lesson computes it:
 *     K_ij = (1/M) Σ_l (X_il − 2p_l)(X_jl − 2p_l) / (2 p_l (1 − p_l))
 * with p_l the SAMPLE allele frequency and monomorphic SNPs skipped.
 */
export function grm(G) {
  const m = G.length;
  const n = G[0].length;
  const use = [];
  const freq = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    const col = G[j];
    let s = 0;
    for (let i = 0; i < n; i += 1) s += col[i];
    const p = s / (2 * n);
    freq[j] = p;
    if (p > 0 && p < 1) use.push(j);
  }
  const M = use.length;
  const Z = new Float64Array(n * M); // row-major: person i, SNP t
  for (let t = 0; t < M; t += 1) {
    const j = use[t];
    const col = G[j];
    const p = freq[j];
    const s = Math.sqrt(2 * p * (1 - p));
    for (let i = 0; i < n; i += 1) Z[i * M + t] = (col[i] - 2 * p) / s;
  }
  const K = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1) {
    const oi = i * M;
    for (let j = 0; j <= i; j += 1) {
      const oj = j * M;
      let s = 0;
      for (let t = 0; t < M; t += 1) s += Z[oi + t] * Z[oj + t];
      const v = s / M;
      K[i][j] = v;
      K[j][i] = v;
    }
  }
  return K;
}

/* ==========================================================================
   Symmetric eigendecomposition.

   Householder tridiagonalisation (tred2) then implicit-shift QL (tql2), the
   EISPACK pair. Cyclic Jacobi is also here, unused by the measurements and
   kept for §7's timing: the brief allowed Jacobi at n = 300 and the answer is
   that it costs about ten times as much, which is the difference between a
   compute() that fits the frame budget and one that does not.
   ========================================================================== */

function tred2(a, n, d, e) {
  for (let i = n - 1; i >= 1; i -= 1) {
    const l = i - 1;
    let h = 0;
    let scale = 0;
    let g = 0;
    if (l > 0) {
      for (let kk = 0; kk <= l; kk += 1) scale += Math.abs(a[i][kk]);
      if (scale === 0) {
        e[i] = a[i][l];
      } else {
        for (let kk = 0; kk <= l; kk += 1) {
          a[i][kk] /= scale;
          h += a[i][kk] * a[i][kk];
        }
        let f = a[i][l];
        g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
        e[i] = scale * g;
        h -= f * g;
        a[i][l] = f - g;
        f = 0;
        for (let j = 0; j <= l; j += 1) {
          a[j][i] = a[i][j] / h;
          g = 0;
          for (let kk = 0; kk <= j; kk += 1) g += a[j][kk] * a[i][kk];
          for (let kk = j + 1; kk <= l; kk += 1) g += a[kk][j] * a[i][kk];
          e[j] = g / h;
          f += e[j] * a[i][j];
        }
        const hh = f / (h + h);
        for (let j = 0; j <= l; j += 1) {
          f = a[i][j];
          g = e[j] - hh * f;
          e[j] = g;
          for (let kk = 0; kk <= j; kk += 1) a[j][kk] -= f * e[kk] + g * a[i][kk];
        }
      }
    } else {
      e[i] = a[i][l];
    }
    d[i] = h;
  }
  d[0] = 0;
  e[0] = 0;
  for (let i = 0; i < n; i += 1) {
    const l = i - 1;
    if (d[i] !== 0) {
      for (let j = 0; j <= l; j += 1) {
        let g = 0;
        for (let kk = 0; kk <= l; kk += 1) g += a[i][kk] * a[kk][j];
        for (let kk = 0; kk <= l; kk += 1) a[kk][j] -= g * a[kk][i];
      }
    }
    d[i] = a[i][i];
    a[i][i] = 1;
    for (let j = 0; j <= l; j += 1) {
      a[j][i] = 0;
      a[i][j] = 0;
    }
  }
}

function tql2(d, e, z, n) {
  for (let i = 1; i < n; i += 1) e[i - 1] = e[i];
  e[n - 1] = 0;
  for (let l = 0; l < n; l += 1) {
    let iter = 0;
    let mm = l;
    do {
      for (mm = l; mm < n - 1; mm += 1) {
        const dd = Math.abs(d[mm]) + Math.abs(d[mm + 1]);
        if (Math.abs(e[mm]) <= Number.EPSILON * dd) break;
      }
      if (mm !== l) {
        iter += 1;
        if (iter > 60) throw new Error("tql2: too many iterations");
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = Math.hypot(g, 1);
        g = d[mm] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1;
        let c = 1;
        let pp = 0;
        let i = mm - 1;
        for (; i >= l; i -= 1) {
          let f = s * e[i];
          const b = c * e[i];
          r = Math.hypot(f, g);
          e[i + 1] = r;
          if (r === 0) {
            d[i + 1] -= pp;
            e[mm] = 0;
            break;
          }
          s = f / r;
          c = g / r;
          g = d[i + 1] - pp;
          r = (d[i] - g) * s + 2 * c * b;
          pp = s * r;
          d[i + 1] = g + pp;
          g = c * r - b;
          for (let kk = 0; kk < n; kk += 1) {
            f = z[kk][i + 1];
            z[kk][i + 1] = s * z[kk][i] + c * f;
            z[kk][i] = c * z[kk][i] - s * f;
          }
        }
        if (r === 0 && i >= l) continue;
        d[l] -= pp;
        e[l] = g;
        e[mm] = 0;
      }
    } while (mm !== l);
  }
}

/**
 * Symmetric eigendecomposition. Returns { values, vectors, ut } with values
 * descending, `vectors[t]` the t-th eigenvector as a column of length n, and
 * `ut` the same thing row-major (row t = eigenvector t) for the rotation.
 * The input is not modified.
 */
export function eigenSym(A) {
  const n = A.length;
  const z = A.map((row) => Float64Array.from(row));
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  tred2(z, n, d, e);
  tql2(d, e, z, n);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => d[b] - d[a]);
  const values = new Float64Array(n);
  const vectors = new Array(n);
  const ut = new Float64Array(n * n);
  for (let t = 0; t < n; t += 1) {
    const src = order[t];
    values[t] = d[src];
    const v = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      v[i] = z[i][src];
      ut[t * n + i] = v[i];
    }
    vectors[t] = v;
  }
  return { values, vectors, ut };
}

/** Cyclic Jacobi, for the timing comparison in §7 only. */
export function jacobiEigen(A) {
  const n = A.length;
  const a = A.map((row) => Float64Array.from(row));
  const v = Array.from({ length: n }, (_, i) => {
    const r = new Float64Array(n);
    r[i] = 1;
    return r;
  });
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n - 1; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let kk = 0; kk < n; kk += 1) {
          const akp = a[kk][p];
          const akq = a[kk][q];
          a[kk][p] = c * akp - s * akq;
          a[kk][q] = s * akp + c * akq;
        }
        for (let kk = 0; kk < n; kk += 1) {
          const apk = a[p][kk];
          const aqk = a[q][kk];
          a[p][kk] = c * apk - s * aqk;
          a[q][kk] = s * apk + c * aqk;
        }
        for (let kk = 0; kk < n; kk += 1) {
          const vkp = v[kk][p];
          const vkq = v[kk][q];
          v[kk][p] = c * vkp - s * vkq;
          v[kk][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const d = Array.from({ length: n }, (_, i) => a[i][i]);
  const order = Array.from({ length: n }, (_, i) => i).sort((x, yy) => d[yy] - d[x]);
  return { values: Float64Array.from(order.map((i) => d[i])) };
}

/** The top `k` eigenvectors of the GRM, as covariate columns. */
export function pcs(eig, k) {
  return Array.from({ length: k }, (_, t) => eig.vectors[t]);
}

/**
 * The top `k` eigenpairs by subspace iteration — K times a block, then
 * Gram–Schmidt, repeated. Deterministic start (no rng, so it is a pure
 * function of K). §7 times it against the full decomposition; §7 also records
 * which of the k it can actually be trusted for, which is the two with a gap
 * above the floor and no more.
 */
export function topEigen(K, k, iters = 30) {
  const n = K.length;
  let V = Array.from({ length: k }, (_, t) => {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i += 1) v[i] = Math.cos((t + 1) * (i + 1) * 0.7391);
    return v;
  });
  const orth = (B) => {
    for (let t = 0; t < B.length; t += 1) {
      for (let s = 0; s < t; s += 1) {
        let d = 0;
        for (let i = 0; i < n; i += 1) d += B[t][i] * B[s][i];
        for (let i = 0; i < n; i += 1) B[t][i] -= d * B[s][i];
      }
      let nr = 0;
      for (let i = 0; i < n; i += 1) nr += B[t][i] * B[t][i];
      nr = Math.sqrt(nr) || 1;
      for (let i = 0; i < n; i += 1) B[t][i] /= nr;
    }
    return B;
  };
  V = orth(V);
  for (let it = 0; it < iters; it += 1) {
    const W = V.map((v) => {
      const w = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const row = K[i];
        let s = 0;
        for (let jj = 0; jj < n; jj += 1) s += row[jj] * v[jj];
        w[i] = s;
      }
      return w;
    });
    V = orth(W);
  }
  const values = V.map((v) => {
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      const row = K[i];
      let t = 0;
      for (let jj = 0; jj < n; jj += 1) t += row[jj] * v[jj];
      s += v[i] * t;
    }
    return s;
  });
  return { values, vectors: V };
}

/* ==========================================================================
   The scans. One weighted engine; OLS is the engine with weights 1.
   ========================================================================== */

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
  /* invert L, then A⁻¹ = L⁻ᵀ L⁻¹ */
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

/**
 * Per-SNP weighted least squares of y on [X, g], returning the SNP column's
 * β, se and two-sided P on n − p − 1 df.
 *
 * X is the whole null design (intercept included); `winv` is the diagonal of
 * V⁻¹ — all ones for OLS, 1/(h²d + 1 − h²) in the GRM's eigenbasis for GLS.
 * The null projection is solved once and every SNP is then a one-column
 * regression on the residualised outcome, which is what makes 2000 fits cheap.
 */
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

/** Per-SNP OLS of y on the SNP plus an intercept and the covariate columns. */
export function olsScan(y, G, covariates = []) {
  const n = y.length;
  const ones = new Float64Array(n).fill(1);
  const winv = new Float64Array(n).fill(1);
  return weightedScan(y, [ones, ...covariates], G, winv);
}

/**
 * Per-SNP GLS in the GRM's eigenbasis, with V = h²D + (1 − h²)I diagonal.
 * yRot, XRot and GRot are already rotated by Uᵀ; the variance COMPONENT is
 * fixed at the one REML estimated, and only the residual scale is re-estimated
 * per SNP — which is fastGWA's "one variance for every SNP".
 */
export function glsScan(yRot, XRot, GRot, D, h2) {
  const n = yRot.length;
  const winv = new Float64Array(n);
  for (let i = 0; i < n; i += 1) winv[i] = 1 / (h2 * D[i] + (1 - h2));
  return weightedScan(yRot, XRot, GRot, winv);
}

/** Uᵀ applied to a set of columns. */
export function rotate(ut, cols, n) {
  return cols.map((c) => {
    const out = new Float64Array(n);
    for (let t = 0; t < n; t += 1) {
      const o = t * n;
      let s = 0;
      for (let i = 0; i < n; i += 1) s += ut[o + i] * c[i];
      out[t] = s;
    }
    return out;
  });
}

/* ==========================================================================
   The variance step.
   ========================================================================== */

/**
 * REML for y = Xβ + g + ε with Var(g) = Vg·K and Var(ε) = Ve·I, profiled over
 * h² = Vg / (Vg + Ve) on a grid and then refined by golden section.
 *
 * `eig` is eigenSym(K). Returns h², Vg, Ve, the restricted log-likelihood at
 * the optimum and at h² = 0, the LRT of Vg = 0 and its P — halved, as GCTA
 * does, because h² is on a boundary and the null distribution is the ½:½
 * mixture of a point mass at 0 and χ²(1).
 */
export function remlH2(y, X, eig, opts = {}) {
  const { grid = 100, hmax = 0.99 } = opts;
  const n = y.length;
  const p = X.length;
  const D = eig.values;
  const yR = rotate(eig.ut, [y], n)[0];
  const XR = rotate(eig.ut, X, n);

  function logLik(h2) {
    const w = new Float64Array(n);
    let sumLogW = 0;
    for (let i = 0; i < n; i += 1) {
      w[i] = h2 * D[i] + (1 - h2);
      if (w[i] <= 0) return -Infinity;
      sumLogW += Math.log(w[i]);
    }
    const A = Array.from({ length: p }, () => new Float64Array(p));
    for (let a = 0; a < p; a += 1) {
      for (let b = 0; b <= a; b += 1) {
        let s = 0;
        for (let i = 0; i < n; i += 1) s += (XR[a][i] * XR[b][i]) / w[i];
        A[a][b] = s;
        A[b][a] = s;
      }
    }
    const L = cholesky(A);
    if (!L) return -Infinity;
    let logDetA = 0;
    for (let a = 0; a < p; a += 1) logDetA += 2 * Math.log(L[a][a]);
    const Ai = cholInverse(L);
    const b = new Float64Array(p);
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += (XR[a][i] * yR[i]) / w[i];
      b[a] = s;
    }
    const beta = new Float64Array(p);
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      for (let c = 0; c < p; c += 1) s += Ai[a][c] * b[c];
      beta[a] = s;
    }
    let rss = 0;
    for (let i = 0; i < n; i += 1) {
      let r = yR[i];
      for (let a = 0; a < p; a += 1) r -= XR[a][i] * beta[a];
      rss += (r * r) / w[i];
    }
    const s2 = rss / (n - p);
    const ll = -0.5 * (sumLogW + logDetA + (n - p) * Math.log(s2));
    return { ll, s2 };
  }

  const at = (h2) => {
    const r = logLik(h2);
    return r === -Infinity ? { ll: -Infinity, s2: NaN } : r;
  };

  let best = 0;
  let bestLL = at(0).ll;
  for (let i = 1; i <= grid; i += 1) {
    const h2 = (hmax * i) / grid;
    const ll = at(h2).ll;
    if (ll > bestLL) {
      bestLL = ll;
      best = h2;
    }
  }
  /* golden-section refinement inside the bracketing grid cell */
  const step = hmax / grid;
  let lo = Math.max(0, best - step);
  let hi = Math.min(hmax, best + step);
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = hi - phi * (hi - lo);
  let d = lo + phi * (hi - lo);
  let fc = at(c).ll;
  let fd = at(d).ll;
  for (let it = 0; it < 40 && hi - lo > 1e-6; it += 1) {
    if (fc > fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - phi * (hi - lo);
      fc = at(c).ll;
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + phi * (hi - lo);
      fd = at(d).ll;
    }
  }
  const cand = [best, (lo + hi) / 2];
  let h2 = best;
  let llBest = bestLL;
  for (const h of cand) {
    const r = at(h);
    if (r.ll > llBest) {
      llBest = r.ll;
      h2 = h;
    }
  }
  const fit = at(h2);
  const null0 = at(0);
  const s2 = fit.s2;
  const lrt = Math.max(0, 2 * (llBest - null0.ll));
  const P = lrt <= 0 ? 1 : 0.5 * chi1Tail(lrt);
  return {
    h2,
    Vg: h2 * s2,
    Ve: (1 - h2) * s2,
    logLik: llBest,
    logLik0: null0.ll,
    lrt,
    P,
    yR,
    XR,
    D,
  };
}

/**
 * The two-step, with the fallback. REML once; if the LRT of Vg = 0 is not
 * significant, GCTA prints that it will use linear regression and does — so
 * this returns the OLS scan and says it fell back.
 */
export function fastgwa(y, G, covariates, eig, opts = {}) {
  const { alpha = 0.05 } = opts;
  const n = y.length;
  const ones = new Float64Array(n).fill(1);
  const X = [ones, ...covariates];
  const re = remlH2(y, X, eig);
  if (re.P > alpha) {
    return { ...olsScan(y, G, covariates), reml: re, fellBack: true };
  }
  const GRot = rotate(eig.ut, G, n);
  return { ...glsScan(re.yR, re.XR, GRot, re.D, re.h2), reml: re, fellBack: false };
}

/* ==========================================================================
   Readings off a scan.
   ========================================================================== */

/** Genomic inflation factor: the median χ²(1) implied by P, over 0.4549. */
export function lambda(P) {
  const s = Array.from(P).sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return chi1Inv(mid) / 0.4549364;
}

export const bonferroni = (m) => 0.05 / m;

export function summarise(P, causalIdx, m) {
  const thr = bonferroni(m);
  const causal = new Set(causalIdx);
  let hits = 0;
  let fp = 0;
  let hitCausal = 0;
  let body = 0;
  for (let j = 0; j < m; j += 1) {
    if (P[j] < 0.05) body += 1;
    if (P[j] < thr) {
      hits += 1;
      if (causal.has(j)) hitCausal += 1;
      else fp += 1;
    }
  }
  return {
    lambda: lambda(P),
    hits,
    fp,
    power: hitCausal / causalIdx.length,
    frac05: body / m,
  };
}

/** One cohort, its GRM and its eigendecomposition — the widget's compute(). */
function build(seed, opts) {
  const rng = makeRng(seed);
  const co = simulateCohort(rng, opts);
  const K = grm(co.G);
  const eig = eigenSym(K);
  return { co, K, eig };
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/* ==========================================================================
   0. The machinery, checked before anything is read off it.
   ========================================================================== */

console.log("\n0. The machinery\n");
{
  const A = [
    new Float64Array([4, 1, 0]),
    new Float64Array([1, 3, 1]),
    new Float64Array([0, 1, 2]),
  ];
  const e = eigenSym(A);
  /* reconstruct */
  let maxErr = 0;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let s = 0;
      for (let t = 0; t < 3; t += 1) s += e.values[t] * e.vectors[t][i] * e.vectors[t][j];
      maxErr = Math.max(maxErr, Math.abs(s - A[i][j]));
    }
  }
  const tr = e.values.reduce((a, b) => a + b, 0);
  console.log(`   eigenSym on a 3×3: values ${Array.from(e.values).map(f3).join(", ")}  trace ${f3(tr)}  reconstruction error ${maxErr.toExponential(1)}`);
  check(maxErr < 1e-12, "eigenSym reconstructs A = U D Uᵀ");
  check(Math.abs(tr - 9) < 1e-12, "eigenvalues sum to the trace");
  check(e.values[0] > e.values[1] && e.values[1] > e.values[2], "eigenvalues come back descending");

  const j3 = jacobiEigen(A);
  check(
    Math.max(...Array.from(e.values, (v, i) => Math.abs(v - j3.values[i]))) < 1e-10,
    "Jacobi agrees with tred2/tql2",
  );

  /* the t tail against known quantiles */
  check(Math.abs(tTwoSided(1.96, 1e7) - 0.05) < 1e-3, "t on huge df is the normal: t = 1.96 → P ≈ 0.05");
  check(Math.abs(tTwoSided(2.0, 60) - 0.05) < 2e-3, "t(60) at 2.00 → P ≈ 0.05");
  check(Math.abs(chi1Inv(0.5) - 0.4549) < 1e-3, "the χ²(1) median is 0.4549 — λ's denominator");

  /* a null scan: λ ≈ 1 and 5% under 0.05 when nothing is going on */
  const rng = makeRng(7);
  const n = 300;
  const m = 2000;
  const G = Array.from({ length: m }, () => {
    const p = rng.uniform(0.1, 0.9);
    const c = new Float64Array(n);
    for (let i = 0; i < n; i += 1) c[i] = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0);
    return c;
  });
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) y[i] = rng.normal(0, 1);
  const s = summarise(olsScan(y, G, []).P, [], m);
  console.log(`   a pure null scan (no structure, no effect): λ = ${f3(s.lambda)}, ${(100 * s.frac05).toFixed(1)}% under P < 0.05, ${s.hits} past Bonferroni`);
  check(Math.abs(s.lambda - 1) < 0.12, "λ ≈ 1 under the null");
  check(s.frac05 > 0.035 && s.frac05 < 0.07, "about 5% under P < 0.05 under the null");
  check(s.hits === 0, "no Bonferroni hit in 2000 null SNPs");
}

/* ==========================================================================
   1. λ, false positives and power by model, shift and Fst.
   ========================================================================== */

console.log("\n1. n = 300, m = 2000, three causal SNPs at h2snp 0.05, no families, 10 seeds");
console.log("   Bonferroni 0.05/2000 = 2.5e-5. λ, false positives (of 1997), power (of 3).\n");
console.log("   Fst   shift |    SNP only              |    + 2 PCs               |    + 5 PCs");
console.log("               |     λ     FP    power     |     λ     FP    power    |     λ     FP    power");

const SEEDS1 = 10;
const q1 = {};
for (const fst of [0.01, 0.03, 0.1]) {
  for (const shift of [0, 0.5, 1, 2]) {
    const rows = { none: [], pc2: [], pc5: [] };
    for (let s = 0; s < SEEDS1; s += 1) {
      const { co, eig } = build(1000 + s, { n: 300, m: 2000, fst, shift, h2snp: 0.05 });
      rows.none.push(summarise(olsScan(co.y, co.G, []).P, co.causalIdx, co.m));
      rows.pc2.push(summarise(olsScan(co.y, co.G, pcs(eig, 2)).P, co.causalIdx, co.m));
      rows.pc5.push(summarise(olsScan(co.y, co.G, pcs(eig, 5)).P, co.causalIdx, co.m));
    }
    const agg = (k) => ({
      lambda: mean(rows[k].map((r) => r.lambda)),
      fp: mean(rows[k].map((r) => r.fp)),
      power: mean(rows[k].map((r) => r.power)),
    });
    const a = { none: agg("none"), pc2: agg("pc2"), pc5: agg("pc5") };
    q1[`${fst}|${shift}`] = a;
    const cell = (x) => `${pad(f2(x.lambda), 6)} ${pad(x.fp.toFixed(1), 6)} ${pad(f2(x.power), 8)}`;
    console.log(`   ${pad(fst, 5)} ${pad(shift, 5)} | ${cell(a.none)}  | ${cell(a.pc2)} | ${cell(a.pc5)}`);
  }
}

for (const fst of [0.03, 0.1]) {
  for (const shift of [1, 2]) {
    const a = q1[`${fst}|${shift}`];
    check(a.none.lambda > 1.5, `SNP only is inflated at Fst ${fst}, shift ${shift} (λ = ${f2(a.none.lambda)})`);
    check(a.none.fp > 5, `SNP only produces false peaks at Fst ${fst}, shift ${shift} (${a.none.fp.toFixed(1)})`);
    check(
      a.pc2.lambda > 0.9 && a.pc2.lambda < 1.15,
      `+ 2 PCs brings λ back to ~1 at Fst ${fst}, shift ${shift} (λ = ${f2(a.pc2.lambda)})`,
    );
    check(a.pc2.fp < 2, `+ 2 PCs leaves few false peaks at Fst ${fst}, shift ${shift} (${a.pc2.fp.toFixed(1)})`);
    /* FIRST WRITTEN AS "+ 2 PCs keeps the causal SNPs", power within 0.05 of
       SNP only. True at Fst 0.03 (0.30 → 0.33, better) and FALSE at Fst 0.1
       (0.40 → 0.30): a causal SNP that is itself strongly differentiated is
       partly collinear with PC1 and PC2, so the correction takes some of its
       signal with the confounder's. The claim the widget can make is the
       weaker and true one — the causal SNPs stay standing — plus the honest
       cost, which is its own teaching point and is checked below. */
    check(
      a.pc2.power > 0.6 * a.none.power,
      `+ 2 PCs leaves the causal SNPs standing at Fst ${fst}, shift ${shift} (${f2(a.pc2.power)} vs ${f2(a.none.power)})`,
    );
    check(
      Math.abs(a.pc5.lambda - a.pc2.lambda) < 0.1,
      `the third through fifth PC change nothing at Fst ${fst}, shift ${shift}`,
    );
  }
}
check(
  Math.abs(q1["0.03|0"].none.lambda - 1) < 0.15,
  "with no subpopulation shift there is nothing to correct: λ ≈ 1 at SNP only",
);
check(
  q1["0.1|1"].none.lambda > q1["0.01|1"].none.lambda,
  "more differentiation, more inflation, at the same shift",
);
check(
  q1["0.03|2"].none.lambda > q1["0.03|1"].none.lambda,
  "a bigger subpopulation shift, more inflation, at the same Fst",
);
check(
  q1["0.03|1"].pc2.power >= q1["0.03|1"].none.power,
  `at Fst 0.03 the PCs cost the causal SNPs nothing (${f2(q1["0.03|1"].none.power)} → ${f2(q1["0.03|1"].pc2.power)})`,
);
check(
  q1["0.1|1"].pc2.power < q1["0.1|1"].none.power,
  `at Fst 0.1 they cost some — a differentiated causal SNP is partly collinear with PC1 (${f2(q1["0.1|1"].none.power)} → ${f2(q1["0.1|1"].pc2.power)})`,
);

/* ==========================================================================
   2. Is the GRM term inert without families? (The lesson's own run.)
   ========================================================================== */

console.log("\n2. The same cohorts, + 5 PCs + GRM through fastgwa(): does REML find anything, and does it matter?");
console.log("   n = 300, m = 2000, Fst 0.03, shift 1, no families, 10 seeds");
console.log("   'forced' runs the GLS scan at ĥ² whether or not the LRT was significant — the GRM used, not skipped.\n");
console.log("   h2snp h2bg | fell back | mean ĥ²  max ĥ² | min LRT P | λ + 5 PCs | λ + PCs + GRM (forced) | FP PCs  FP forced");

const SEEDS2 = 10;
const q2 = {};
for (const [h2snp, h2bg] of [
  [0, 0],
  [0.05, 0],
  [0.05, 0.3],
]) {
  const h2s = [];
  const ps = [];
  const lamP = [];
  const lamF = [];
  const fpP = [];
  const fpF = [];
  let fell = 0;
  for (let s = 0; s < SEEDS2; s += 1) {
    const { co, eig } = build(2000 + s, { n: 300, m: 2000, fst: 0.03, shift: 1, h2snp, h2bg });
    const cov = pcs(eig, 5);
    const fa = fastgwa(co.y, co.G, cov, eig);
    if (fa.fellBack) fell += 1;
    h2s.push(fa.reml.h2);
    ps.push(fa.reml.P);
    const oi = summarise(olsScan(co.y, co.G, cov).P, co.causalIdx, co.m);
    lamP.push(oi.lambda);
    fpP.push(oi.fp);
    const GRot = rotate(eig.ut, co.G, co.n);
    const forced = glsScan(fa.reml.yR, fa.reml.XR, GRot, fa.reml.D, Math.max(fa.reml.h2, 1e-9));
    const fi = summarise(forced.P, co.causalIdx, co.m);
    lamF.push(fi.lambda);
    fpF.push(fi.fp);
  }
  q2[`${h2snp}|${h2bg}`] = {
    fell,
    h2: mean(h2s),
    h2max: Math.max(...h2s),
    Pmin: Math.min(...ps),
    lamP: mean(lamP),
    lamF: mean(lamF),
    fpP: mean(fpP),
    fpF: mean(fpF),
  };
  const r = q2[`${h2snp}|${h2bg}`];
  console.log(
    `   ${pad(h2snp, 5)} ${pad(h2bg, 4)} |  ${pad(`${fell}/${SEEDS2}`, 7)}  | ${pad(f3(r.h2), 7)} ${pad(f3(r.h2max), 7)} |  ${pad(f2(r.Pmin), 7)}  |  ${pad(f2(r.lamP), 7)}  |        ${pad(f2(r.lamF), 7)}         | ${pad(r.fpP.toFixed(1), 6)} ${pad(r.fpF.toFixed(1), 8)}`,
  );
}

/* FIRST WRITTEN AS "with unrelated people the LRT is not significant and it
   falls back — the lesson's case — at h2bg 0 always and at 0.3 usually". The
   first half is nearly right (9 of 10 at h2bg 0, and the one exception moves
   nothing); the second half is FALSE HERE, and the reason is the simulation's
   size rather than the biology.

   GCTA's fallback on the lesson's data is a statement about a GRM built from
   1.4 MILLION SNPs: its off-diagonal entries among unrelated people have SD
   ~1/√M ≈ 0.001, so there is no spread to regress a trait against and ĥ² has
   a standard error of order 1. Ours is built from 2000, where that SD is
   0.022 — twenty times larger — and the 200 SNPs carrying the polygenic
   background are a TENTH of the SNPs in the GRM rather than a millionth. So
   REML can see the background (ĥ² 0.44, significant in 6 of 10) purely because
   the simulated genome is small. A widget at m = 2000 cannot reproduce the
   lesson's `Pval = 1` by way of a polygenic background.

   What it CAN reproduce, and what the claim should be, is the thing the
   reader is actually looking at: WITH NO FAMILIES THE GRM CHANGES THE SCAN BY
   NOTHING — λ within 0.05 and no change in false peaks — whether fastGWA
   falls back or is forced to use it. That is checked below and it holds in
   all three rows. The widget's Families = none case should therefore show the
   variance readout going to zero and the skyline not moving, and the honest
   default for the background is 0. */
const K2 = ["0|0", "0.05|0", "0.05|0.3"];
/* Also measured, and a caution for the readout: with NOTHING heritable in the
   trait at all the LRT still came back under 0.05 twice in ten. At the ½:½
   boundary mixture two in ten is inside binomial noise (P = 0.09), but it
   means the widget cannot promise the reader that Families = none prints
   Vg = 0 — it prints a small positive ĥ² with a non-significant P most of the
   time, and occasionally a significant one. The line the figure can stand on
   is the one below: the scan does not move either way. */
check(q2["0|0"].fell >= 7, `with nothing heritable in the trait, fastGWA falls back most of the time (${q2["0|0"].fell}/${SEEDS2})`);
check(q2["0|0"].h2 < 0.2, `…and ĥ² sits near zero (${f3(q2["0|0"].h2)}) — the lesson's Vg 4.8e-18`);
check(q2["0.05|0"].fell >= 8, "three causal SNPs alone do not turn the GRM on either");
check(
  q2["0.05|0.3"].fell < SEEDS2 - 1,
  `a polygenic background of 0.3 IS found at m = 2000 (${SEEDS2 - q2["0.05|0.3"].fell} of ${SEEDS2} significant, ĥ² = ${f3(q2["0.05|0.3"].h2)}) — an artefact of the small genome, not the lesson's case`,
);
for (const k of K2) {
  check(
    Math.abs(q2[k].lamF - q2[k].lamP) <= 0.06,
    `the GRM changes λ by nothing without families (${k}: ${f2(q2[k].lamP)} → ${f2(q2[k].lamF)})`,
  );
  check(
    Math.abs(q2[k].lamP - 1) < 0.06 && Math.abs(q2[k].lamF - 1) < 0.06,
    `…and both sit on 1 (${k}: ${f2(q2[k].lamP)}, ${f2(q2[k].lamF)})`,
  );
  check(
    Math.abs(q2[k].fpF - q2[k].fpP) < 0.5,
    `…and moves no peak past Bonferroni (${k}: ${q2[k].fpP.toFixed(1)} → ${q2[k].fpF.toFixed(1)})`,
  );
}

/* ==========================================================================
   3. Families.
   ========================================================================== */

console.log("\n3. Sibships of 4 (75 families), Fst 0.03, shift 1, n = 300, m = 2000, 5 seeds\n");
console.log("   sdFam h2bg | + 5 PCs alone      | + 5 PCs + GRM      | REML ĥ²  LRT P    fell back");
console.log("              |    λ      FP       |    λ      FP       |");

const SEEDS3 = 5;
const q3 = {};
for (const sdFamily of [0, 0.5, 1]) {
  for (const h2bg of [0, 0.3]) {
    const lp = [];
    const fpP = [];
    const lg = [];
    const fpG = [];
    const h2s = [];
    const ps = [];
    let fell = 0;
    for (let s = 0; s < SEEDS3; s += 1) {
      const { co, eig } = build(3000 + s, {
        n: 300,
        m: 2000,
        fst: 0.03,
        shift: 1,
        h2snp: 0.05,
        h2bg,
        families: true,
        sdFamily,
      });
      const cov = pcs(eig, 5);
      const oi = summarise(olsScan(co.y, co.G, cov).P, co.causalIdx, co.m);
      lp.push(oi.lambda);
      fpP.push(oi.fp);
      const fa = fastgwa(co.y, co.G, cov, eig);
      const gi = summarise(fa.P, co.causalIdx, co.m);
      lg.push(gi.lambda);
      fpG.push(gi.fp);
      h2s.push(fa.reml.h2);
      ps.push(fa.reml.P);
      if (fa.fellBack) fell += 1;
    }
    q3[`${sdFamily}|${h2bg}`] = {
      lamPC: mean(lp),
      fpPC: mean(fpP),
      lamGRM: mean(lg),
      fpGRM: mean(fpG),
      h2: mean(h2s),
      P: mean(ps),
      fell,
    };
    const r = q3[`${sdFamily}|${h2bg}`];
    console.log(
      `   ${pad(sdFamily, 5)} ${pad(h2bg, 4)} | ${pad(f2(r.lamPC), 6)} ${pad(r.fpPC.toFixed(1), 8)}    | ${pad(f2(r.lamGRM), 6)} ${pad(r.fpGRM.toFixed(1), 8)}    | ${pad(f3(r.h2), 7)} ${pad(r.P < 1e-3 ? r.P.toExponential(1) : f3(r.P), 9)} ${pad(`${r.fell}/${SEEDS3}`, 6)}`,
    );
  }
}

for (const key of ["0.5|0", "1|0", "0.5|0.3", "1|0.3"]) {
  const r = q3[key];
  check(r.lamPC > 1.1, `sibships with a family effect inflate + 5 PCs alone (${key}: λ = ${f2(r.lamPC)})`);
  check(r.fell === 0, `…and fastGWA does NOT fall back (${key}: LRT P = ${r.P.toExponential(1)})`);
  check(r.h2 > 0.2, `…because REML finds real variance (${key}: ĥ² = ${f3(r.h2)})`);
  check(
    r.lamGRM < r.lamPC && r.lamGRM < 1.12,
    `…and the GRM brings λ back (${key}: ${f2(r.lamPC)} → ${f2(r.lamGRM)})`,
  );
  check(r.fpGRM <= r.fpPC, `…with no more false peaks than + PCs alone (${key})`);
}
/* FIRST WRITTEN AS "sibships alone, with nothing shared but genotypes, are not
   inflated". They are, mildly: λ 1.13. Sibs share half their genome, so they
   share the three causal SNPs' contribution too, and h² 0.15 with a genotype
   correlation of 0.5 in sibships of four predicts 1 + 3 × 0.5 × 0.075 ≈ 1.11 —
   which is what came back. HERITABILITY IS ITSELF A FAMILY RESEMBLANCE, so
   there is no such thing as a pedigree with no shared trait variance unless
   the trait has no genetic part at all. The claim to make is the ordering: a
   pedigree alone inflates a little, a shared family effect inflates a lot, and
   the GRM answers both. */
check(
  q3["0|0"].lamPC > 1.05 && q3["0|0"].lamPC < 1.25,
  `sibships with only the causal SNPs' heritability are already mildly inflated (λ = ${f2(q3["0|0"].lamPC)})`,
);
check(
  q3["0|0"].lamPC < q3["0.5|0"].lamPC && q3["0.5|0"].lamPC < q3["1|0"].lamPC,
  "…and a shared family effect adds to it, monotonically",
);
check(
  q3["0|0"].lamGRM < q3["0|0"].lamPC,
  `…with the GRM pulling even that back (${f2(q3["0|0"].lamPC)} → ${f2(q3["0|0"].lamGRM)})`,
);
/* FIRST WRITTEN AS a check that sdFamily 0 with h2bg 0.3 also falls back, by
   analogy with §2. It does not: once people are related, a polygenic
   background IS visible to the GRM — the off-diagonal spread is now real
   (0.5 within a sibship) rather than noise, so REML has something to regress
   against. That is the cleanest version of the widget's claim: the same h2bg
   that is invisible among 300 unrelated people is found among 75 sibships. */
check(
  q3["0|0.3"].h2 > 0.2 && q3["0|0.3"].fell === 0,
  `a purely genetic family resemblance is found once people are related (ĥ² = ${f3(q3["0|0.3"].h2)})`,
);

/* ==========================================================================
   4. The eigenvalue signature.
   ========================================================================== */

console.log("\n4. Top 6 GRM eigenvalues (the lesson's are 17.28, 3.08, 1.55, 1.51, 1.40 at n = 319, ratio λ1/λ2 = 5.6)");
console.log("   n = 300, m = 2000, 3 seeds averaged. The eigenvalues average 1 (the GRM's trace is n), and the bulk's");
console.log("   upper edge is Marchenko–Pastur's (1 + √(n/M))² = 1.92 — which is where λ3 sits with no families, so");
console.log("   a flat λ3…λ6 near 1.8 is the FLOOR of a 300 × 2000 Gram matrix and not a fourth axis of anything.");
console.log("   'offdiag SD' is the spread of the GRM's off-diagonal entries: the quantity REML has to work with.\n");
console.log("   shape         fam   Fst |    λ1     λ2     λ3     λ4     λ5     λ6  | λ1/λ2 |  λ74   λ75   λ76  | >2.5 | offdiag SD");

const q4 = {};
function eigRow(shape, fam, fstLabel, opts, key) {
  const label = `${String(shape).padEnd(13)} ${String(fam).padEnd(3)} ${pad(fstLabel, 5)}`;
  const tops = [];
  const extra = [];
  const big = [];
  const offs = [];
  for (let s = 0; s < 3; s += 1) {
    const { eig, K } = build(4000 + s, { n: 300, m: 2000, shift: 1, h2snp: 0.05, ...opts });
    const v = Array.from(eig.values);
    tops.push(v.slice(0, 6));
    extra.push([v[73], v[74], v[75]]);
    big.push(v.filter((x) => x > 2.5).length);
    const n = K.length;
    let s1 = 0;
    let s2 = 0;
    let cnt = 0;
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < i; j += 1) {
        s1 += K[i][j];
        s2 += K[i][j] * K[i][j];
        cnt += 1;
      }
    offs.push(Math.sqrt(s2 / cnt - (s1 / cnt) ** 2));
  }
  const avg = Array.from({ length: 6 }, (_, t) => mean(tops.map((r) => r[t])));
  const ex = [0, 1, 2].map((t) => mean(extra.map((r) => r[t])));
  const r = { avg, big: mean(big), ex, offSd: mean(offs) };
  q4[key] = r;
  console.log(
    `   ${label} | ${avg.map((v) => pad(f2(v), 6)).join(" ")} | ${pad(f2(avg[0] / avg[1]), 5)} | ${ex.map((v) => pad(f2(v), 5)).join(" ")} | ${pad(r.big.toFixed(1), 4)} | ${r.offSd.toFixed(4)}`,
  );
}
for (const fst of [0.01, 0.03, 0.1]) eigRow("star", "no", fst, { fst }, `star|no|${fst}`);
for (const fst of [0.01, 0.03, 0.1])
  eigRow("star", "yes", fst, { fst, families: true, sdFamily: 1 }, `star|yes|${fst}`);
for (const [fst, shal] of [
  [0.05, 0.005],
  [0.05, 0.017],
  [0.1, 0.01],
])
  eigRow(
    `nested/${shal}`,
    "no",
    fst,
    { fst, topology: "nested", fstShallow: shal },
    `nested|${fst}|${shal}`,
  );

{
  const a = q4["star|no|0.03"];
  check(a.avg[0] > 3 * a.avg[2], `PC1 towers over the bulk edge with no families at Fst 0.03 (${f2(a.avg[0])} vs ${f2(a.avg[2])})`);
  check(a.avg[1] > 3 * a.avg[2], `PC2 too — two axes for three populations (${f2(a.avg[1])})`);
  check(
    Math.abs(a.avg[2] - a.avg[5]) / a.avg[2] < 0.15,
    `PC3 through PC6 are flat (${f2(a.avg[2])} … ${f2(a.avg[5])}) — the lesson's 1.55, 1.51, 1.40`,
  );
  check(a.big <= 3, `with no families nothing but the population axes stands clear of the floor (${a.big.toFixed(1)} above 2.5)`);
  check(q4["star|no|0.1"].avg[0] > q4["star|no|0.01"].avg[0], "more differentiation, a taller PC1");

  const fam = q4["star|yes|0.03"];
  const star = q4["star|no|0.03"];
  /* FIRST WRITTEN AS "a shoulder of mid-sized values, counted above 2.5". The
     count above a value is the wrong instrument: the shoulder is a RAMP, not a
     plateau — it starts at 3.5 and slides to 1.7 — so a 2.5 cut catches only
     its upper half (37 of 74). What marks its end is the CLIFF at 74/75, where
     the value halves in one step. The width is exactly nFam − 1 = 74: 75
     sibships give 75 between-family directions and the overall mean takes one.
     The widget should not draw a threshold on the scree plot; it should draw
     the cliff, and its position is the number of families. */
  check(
    fam.big > 20 && fam.big < 60,
    `with 75 sibships a ramp of mid-sized values appears (${fam.big.toFixed(1)} above 2.5, against ${star.big.toFixed(1)} with none)`,
  );
  check(
    fam.ex[0] / fam.ex[1] > 1.8,
    `…and it ends at exactly nFam − 1 = 74: λ74 = ${f2(fam.ex[0])}, λ75 = ${f2(fam.ex[1])}, a cliff of ${f2(fam.ex[0] / fam.ex[1])}×`,
  );
  check(
    star.ex[0] / star.ex[1] < 1.1,
    `where with no families there is no cliff at all (λ74 = ${f2(star.ex[0])}, λ75 = ${f2(star.ex[1])})`,
  );
  /* FIRST WRITTEN AS "relatedness lifts the whole floor, which is what makes
     the GRM estimable". It lowers it: the trace of a GRM is n whatever the
     relatedness, so a shoulder is taken OUT of the bulk, not added on top.
     The quantity that makes the GRM estimable is the spread of its off-diagonal
     entries, the last column, and that does rise — 2.3× at Fst 0.01, where
     population structure contributes least to it. */
  check(
    q4["star|yes|0.01"].offSd > 2 * q4["star|no|0.01"].offSd,
    `relatedness widens the GRM's off-diagonal spread (${q4["star|yes|0.01"].offSd.toFixed(4)} against ${q4["star|no|0.01"].offSd.toFixed(4)} at Fst 0.01) — that, not the floor, is what REML has to work with`,
  );
  check(
    fam.offSd > 1.6 * star.offSd,
    `…and still does at Fst 0.03, where the structure itself already spreads it (${fam.offSd.toFixed(4)} against ${star.offSd.toFixed(4)})`,
  );
  check(
    Math.abs(q4["star|no|0.01"].offSd - 1 / Math.sqrt(2000)) < 0.005,
    `with no families and little structure that spread is just sampling noise, 1/√M = ${(1 / Math.sqrt(2000)).toFixed(4)} at m = 2000 — fifteen times a real GRM's 1/√1.4M = 0.0008, which is §2's whole story`,
  );

  /* FIRST WRITTEN AS a check that the default (star) shape reproduces the
     lesson's. It does not, and the reason is a fact about the three
     populations rather than about the code: equal Fst on every branch gives
     TWO EIGENVALUES OF THE SAME HEIGHT (7.46 and 7.06 at Fst 0.03, ratio
     1.06), while the lesson's are 17.28 and 3.08, a ratio of 5.6. Chinese and
     Malay are close to each other and Indian is far from both, so PC1 is one
     split and PC2 the other and they are not the same size. A widget that
     wants 01-4's picture — one population off on its own, the other two
     separated on the second axis — must simulate the nested topology, not the
     star. At Fst 0.05 with the near pair at 0.005 the ratio comes out near
     the lesson's. */
  const nest = q4["nested|0.05|0.005"];
  check(
    q4["star|no|0.03"].avg[0] / q4["star|no|0.03"].avg[1] < 1.3,
    `a star topology gives two equal axes (λ1/λ2 = ${f2(q4["star|no|0.03"].avg[0] / q4["star|no|0.03"].avg[1])}), which is NOT the lesson's shape`,
  );
  check(
    nest.avg[0] / nest.avg[1] > 3,
    `a nested topology gives the lesson's unequal pair (λ1/λ2 = ${f2(nest.avg[0] / nest.avg[1])} against its 5.6)`,
  );
  check(
    nest.avg[1] > 1.15 * nest.avg[2],
    `…with PC2 still clear of the bulk edge (${f2(nest.avg[1])} vs ${f2(nest.avg[2])}) — three clusters on the scatter, not two`,
  );
}

/* ==========================================================================
   5. The QQ body against the tail.
   ========================================================================== */

console.log("\n5. Shift 1, Fst 0.03, n = 300, m = 2000, 10 seeds: what fraction of SNPs is under P < 0.05?");
console.log("   (0.05 under the null — so the QQ plot lifts along its whole length, not only at the tail)\n");
console.log("   model        |  P < 0.05   |   λ    | FP past Bonferroni");

const q5 = {};
{
  const acc = { none: [], pc2: [], pc5: [] };
  for (let s = 0; s < 10; s += 1) {
    const { co, eig } = build(5000 + s, { n: 300, m: 2000, fst: 0.03, shift: 1, h2snp: 0.05 });
    acc.none.push(summarise(olsScan(co.y, co.G, []).P, co.causalIdx, co.m));
    acc.pc2.push(summarise(olsScan(co.y, co.G, pcs(eig, 2)).P, co.causalIdx, co.m));
    acc.pc5.push(summarise(olsScan(co.y, co.G, pcs(eig, 5)).P, co.causalIdx, co.m));
  }
  for (const [k, label] of [["none", "SNP only"], ["pc2", "+ 2 PCs"], ["pc5", "+ 5 PCs"]]) {
    const r = {
      frac05: mean(acc[k].map((x) => x.frac05)),
      lambda: mean(acc[k].map((x) => x.lambda)),
      fp: mean(acc[k].map((x) => x.fp)),
    };
    q5[k] = r;
    console.log(
      `   ${pad(label, 12)} |   ${pad(f3(r.frac05), 7)}   | ${pad(f2(r.lambda), 6)} | ${pad(r.fp.toFixed(1), 8)}`,
    );
  }
}
check(q5.none.frac05 > 0.15, `SNP only puts ${(100 * q5.none.frac05).toFixed(0)}% of SNPs under 0.05, not 5% — the body lifts`);
check(Math.abs(q5.pc5.frac05 - 0.05) < 0.02, "+ 5 PCs puts the body back on the line");
check(q5.none.fp > 20, "and the tail is a forest: a Manhattan plot of false peaks");

/* ==========================================================================
   6. Effect size and n.
   ========================================================================== */

console.log("\n6. Power of the three causal SNPs past Bonferroni, + 5 PCs, Fst 0.03, shift 1, 8 seeds");
console.log("   (the marginal R² is smaller than h2snp in the raw sample — the shift adds variance —");
console.log("    so SNP only is the weaker test as well as the wrong one)\n");
console.log("     n   h2snp | power + 5 PCs | power SNP only | mean −log10 P at the causal SNPs");

const q6 = {};
for (const n of [300, 600]) {
  for (const h2snp of [0.03, 0.05, 0.08, 0.12, 0.2]) {
    const pw = [];
    const pwN = [];
    const lp = [];
    for (let s = 0; s < 8; s += 1) {
      const { co, eig } = build(6000 + s, { n, m: 2000, fst: 0.03, shift: 1, h2snp });
      const cov = pcs(eig, 5);
      const sc = olsScan(co.y, co.G, cov);
      pw.push(summarise(sc.P, co.causalIdx, co.m).power);
      pwN.push(summarise(olsScan(co.y, co.G, []).P, co.causalIdx, co.m).power);
      lp.push(mean(co.causalIdx.map((j) => -Math.log10(Math.max(sc.P[j], 1e-300)))));
    }
    q6[`${n}|${h2snp}`] = { power: mean(pw), powerNone: mean(pwN), logp: mean(lp) };
    const r = q6[`${n}|${h2snp}`];
    console.log(
      `   ${pad(n, 4)} ${pad(h2snp, 6)}  |    ${pad(f2(r.power), 6)}     |     ${pad(f2(r.powerNone), 6)}     |  ${f2(r.logp)}`,
    );
  }
}
check(
  q6["300|0.08"].power > q6["300|0.05"].power && q6["300|0.05"].power > q6["300|0.03"].power,
  "power rises with the effect size at n = 300",
);
for (const h of [0.03, 0.05, 0.08]) {
  check(q6[`600|${h}`].power > q6[`300|${h}`].power, `doubling n raises power at h2snp ${h}`);
}
/* FIRST WRITTEN AS a check that h2snp 0.08 clears Bonferroni most of the time
   at n = 300, on the arithmetic that R² 0.08 on 294 df is a χ² of 25 against a
   threshold of 17.8. It comes out at 0.63, not above 0.7 — the arithmetic
   ignores that R² is a random variable and that half its draws land low. The
   measured ladder says the mock's default effect must be 0.12, where power is
   above 0.8 at the lesson's n; 0.05 puts a causal SNP over the line one time in
   four, which on a Manhattan plot reads as "the method found nothing". */
check(
  q6["300|0.12"].power > 0.8,
  `h2snp 0.12 clears Bonferroni reliably at n = 300 (${f2(q6["300|0.12"].power)}) — the mock's setting`,
);
check(
  q6["300|0.08"].power < 0.8,
  `h2snp 0.08 does not (${f2(q6["300|0.08"].power)})`,
);
check(
  q6["300|0.05"].power < 0.4,
  `and h2snp 0.05 shows a peak one time in four (${f2(q6["300|0.05"].power)}) — too weak for a default`,
);
check(
  q6["300|0.2"].power > 0.95,
  `h2snp 0.2 is a certainty at n = 300 (${f2(q6["300|0.2"].power)}) — the top of the control's range`,
);
check(
  q6["300|0.05"].power > q6["300|0.05"].powerNone,
  "the PCs make the causal SNPs EASIER to see as well as the false ones harder",
);

/* ==========================================================================
   7. Cost.
   ========================================================================== */

console.log("\n7. One compute(), milliseconds (best of 3), m = 2000\n");
console.log("     n | cohort |  GRM  | eigen (tred2/tql2) | Jacobi | top-5 by subspace | 3 OLS scans | rotate Uᵀ | REML | GLS scan | TOTAL");

const q7 = {};
for (const n of [300, 600]) {
  const t = { cohort: [], grm: [], eig: [], jac: [], sub: [], ols: [], rot: [], reml: [], gls: [] };
  let last = null;
  for (let rep = 0; rep < 3; rep += 1) {
    const rng = makeRng(7000 + rep);
    let t0 = performance.now();
    const co = simulateCohort(rng, { n, m: 2000, fst: 0.03, shift: 1, h2snp: 0.05 });
    t.cohort.push(performance.now() - t0);
    t0 = performance.now();
    const K = grm(co.G);
    t.grm.push(performance.now() - t0);
    t0 = performance.now();
    const eig = eigenSym(K);
    t.eig.push(performance.now() - t0);
    if (rep === 0) {
      t0 = performance.now();
      jacobiEigen(K);
      t.jac.push(performance.now() - t0);
    }
    t0 = performance.now();
    const sub = topEigen(K, 5, 30);
    t.sub.push(performance.now() - t0);
    if (rep === 0) {
      const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
      q7[`sub${n}`] = [0, 1, 2, 3, 4].map((i) => rel(sub.values[i], eig.values[i]));
    }
    const cov = pcs(eig, 5);
    t0 = performance.now();
    olsScan(co.y, co.G, []);
    olsScan(co.y, co.G, pcs(eig, 2));
    olsScan(co.y, co.G, cov);
    t.ols.push(performance.now() - t0);
    const ones = new Float64Array(n).fill(1);
    t0 = performance.now();
    const re = remlH2(co.y, [ones, ...cov], eig);
    t.reml.push(performance.now() - t0);
    t0 = performance.now();
    const GRot = rotate(eig.ut, co.G, n);
    t.rot.push(performance.now() - t0);
    t0 = performance.now();
    glsScan(re.yR, re.XR, GRot, re.D, Math.max(re.h2, 0.2));
    t.gls.push(performance.now() - t0);
    last = { co, eig };
  }
  const best = (k) => Math.min(...t[k]);
  const core = best("cohort") + best("grm") + best("eig") + best("ols");
  const full = core + best("rot") + best("reml") + best("gls");
  q7[n] = {
    cohort: best("cohort"),
    grm: best("grm"),
    eig: best("eig"),
    jac: best("jac"),
    sub: best("sub"),
    ols: best("ols"),
    rot: best("rot"),
    reml: best("reml"),
    gls: best("gls"),
    core,
    full,
  };
  const r = q7[n];
  console.log(
    `   ${pad(n, 3)} | ${pad(r.cohort.toFixed(1), 6)} | ${pad(r.grm.toFixed(1), 5)} | ${pad(r.eig.toFixed(1), 18)} | ${pad(r.jac.toFixed(1), 6)} | ${pad(r.sub.toFixed(1), 17)} | ${pad(r.ols.toFixed(1), 11)} | ${pad(r.rot.toFixed(1), 9)} | ${pad(r.reml.toFixed(1), 4)} | ${pad(r.gls.toFixed(1), 8)} | ${pad(r.full.toFixed(1), 6)}`,
  );
  if (last) void last;
}
console.log(
  `\n   one PC-only compute (cohort + GRM + eigen + one OLS scan): ${(q7[300].cohort + q7[300].grm + q7[300].eig + q7[300].ols / 3).toFixed(1)} ms at n = 300, ${(q7[600].cohort + q7[600].grm + q7[600].eig + q7[600].ols / 3).toFixed(1)} ms at n = 600`,
);
console.log(
  `   the same with the PCs by subspace iteration instead: ${(q7[300].cohort + q7[300].grm + q7[300].sub + q7[300].ols / 3).toFixed(1)} ms at n = 300, ${(q7[600].cohort + q7[600].grm + q7[600].sub + q7[600].ols / 3).toFixed(1)} ms at n = 600`,
);
console.log(
  `   Jacobi / tred2+tql2: ${f2(q7[300].jac / q7[300].eig)}× at n = 300, ${f2(q7[600].jac / q7[600].eig)}× at n = 600`,
);
console.log(
  `   subspace iteration's relative error on λ1…λ5 at n = 300: ${q7.sub300.map((x) => x.toExponential(1)).join(", ")}`,
);
console.log("   — the top two to 1e-3, 3 through 5 an order worse: the floor they sit on is flat and offers no gap to converge to.");
check(q7[300].jac > 3 * q7[300].eig, "Jacobi at n = 300 costs several times what the Householder pair costs");
/* FIRST WRITTEN AS "the eigendecomposition at n = 300 is not the problem". It
   IS the single largest item: 69 ms of a 136 ms PC-only compute, more than the
   GRM's 43. The brief's 150 ms budget is met at n = 300 and missed by a factor
   of five at n = 600, and the fix is not a faster Jacobi but not doing the
   full decomposition at all — the widget needs two PCs, and subspace iteration
   gives those two exactly for a tenth of the cost. */
check(
  q7[300].eig > q7[300].grm,
  `the full eigendecomposition is the largest item at n = 300 (${q7[300].eig.toFixed(1)} ms against the GRM's ${q7[300].grm.toFixed(1)})`,
);
check(
  q7[300].sub < q7[300].eig / 3,
  `subspace iteration for five vectors costs a fraction of it (${q7[300].sub.toFixed(1)} ms)`,
);
/* FIRST WRITTEN AS "the two PCs the widget actually needs come back exact".
   They come back to a relative 1e-3, not to machine precision, and the reason
   is §4's: on a star topology λ1 and λ2 are nearly EQUAL, so the iteration
   separates the pair slowly even though it locks onto the plane they span
   immediately. Which is the right answer anyway — a covariate is a subspace,
   not a vector — so the check that matters is whether a scan run on those
   columns gives the same λ, and it does to two decimals. */
check(
  q7.sub300[0] < 5e-3 && q7.sub300[1] < 5e-3,
  `the two PCs the widget needs come back to 1e-3 (${q7.sub300[0].toExponential(1)}, ${q7.sub300[1].toExponential(1)})`,
);
check(
  q7.sub300[4] > 5 * q7.sub300[0],
  "…while PC5 is an order worse, there being no gap in the floor to converge to",
);
{
  const { co, K, eig } = build(7777, { n: 300, m: 2000, fst: 0.03, shift: 1, h2snp: 0.05 });
  const exact = summarise(olsScan(co.y, co.G, pcs(eig, 2)).P, co.causalIdx, co.m);
  const sub = topEigen(K, 2, 30);
  const approx = summarise(olsScan(co.y, co.G, sub.vectors).P, co.causalIdx, co.m);
  console.log(
    `   a scan on 2 subspace-iteration PCs against 2 exact PCs: λ ${f3(approx.lambda)} against ${f3(exact.lambda)}, false peaks ${approx.fp} against ${exact.fp}`,
  );
  check(
    Math.abs(approx.lambda - exact.lambda) < 0.02 && approx.fp === exact.fp,
    "…and a scan on the approximate pair is the same scan — a covariate is a subspace, not a vector",
  );
}
check(
  q7[300].core < 200,
  `a full three-model compute at n = 300 is ${q7[300].core.toFixed(0)} ms — at the brief's budget, not under it`,
);
check(
  q7[600].core > 400,
  `and at n = 600 it is ${q7[600].core.toFixed(0)} ms, so n = 300 is the widget's ceiling at m = 2000`,
);

console.log(`\n${checks} checks, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
