/* ============================================================================
   Widget 57 · Genome-wide association studies — the cohort, the three scans,
   the variance step, the geometry and the copy.

   PHM5003 week 6 (01-3 the association scan, 01-4 the PCA, 01-5 the GRM and
   fastGWA, 01-6 the Manhattan and QQ plots). `main.js` draws what is here;
   nothing in this file touches the DOM.

   THE ENGINE IS MOVED VERBATIM from `_lab/gwas-measure.mjs`, comments and all:
   `chi1Tail`, `chi1Inv`, `betai`, `tTwoSided`, `gammaDraw`, `betaDraw`,
   `simulateCohort`, `grm`, `tred2`/`tql2`/`eigenSym`, `pcs`, `topEigen`,
   `weightedScan`, `olsScan`, `glsScan`, `rotate`, `remlH2`, `fastgwa`,
   `lambda`, `bonferroni` and `summarise`. That script's 110 checks are the
   survey this widget's every control was chosen from, and
   `_lab/gwas-verify.mjs` pins the same numbers against these copies, so the
   widget and the survey cannot drift apart.

   ONE FUNCTION IS DELIBERATELY LEFT BEHIND. `jacobiEigen` exists in the
   measure script for one timing comparison — Jacobi costs about ten times the
   Householder pair at n = 300 — and nothing draws with it.

   THE MEASURED CEILING IS n = 300, m = 2000. A full compute at n = 600 is
   1133 ms against 230 at n = 300, so the sample size and the SNP count are
   fixed here rather than offered as controls.

   WHAT THE SIMULATION IS. Balding–Nichols frequencies at a NESTED topology —
   two subpopulations close (FST 0.005) and one far — because three equidistant
   subpopulations give two eigenvalues of equal height where the lesson's own
   relationship matrix has 17.28 and 3.08. Genotypes are Binomial(2, p_k), or
   Mendelian transmission inside sibships of four when families are on. The
   trait is a subpopulation shift in residual-SD units plus three causal SNPs
   plus an optional shared family effect.
   ========================================================================= */

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
 * widget's control is labelled with. μ_pop is `shift` × that residual SD
 * × (−1, 0, +1): the trait difference between the outer subpopulations, in
 * units the reader can hold.
 *
 * Note that the population shift and the family effect ADD variance on top of
 * that 1, so a causal SNP's marginal R² in the raw sample is smaller than
 * h2snp — by a third at shift 1. Conditioning on the PCs gives it back.
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
     and the third split earlier. The option exists because a star gives two
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
   EISPACK pair. The measure script also carries a cyclic Jacobi, for one
   timing comparison and nothing else: it costs about ten times as much at
   n = 300, which is the difference between a compute() that fits the budget
   and one that does not.
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

/** The top `k` eigenvectors of the GRM, as covariate columns. */
export function pcs(eig, k) {
  return Array.from({ length: k }, (_, t) => eig.vectors[t]);
}

/**
 * The top `k` eigenpairs by subspace iteration — K times a block, then
 * Gram–Schmidt, repeated. Deterministic start (no rng, so it is a pure
 * function of K). The measure script times it against the full decomposition
 * and records which of the k it can be trusted for: the two with a gap above
 * the floor and no more — and a scan on the approximate pair is the same scan,
 * because a covariate is a subspace and not a vector.
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

/* ==========================================================================
   The cohort this widget draws, and the scan the Model control asks for.
   ========================================================================== */

export const N = 300;
export const M_SNPS = 2000;
export const NCHR = 4;
export const PER_CHR = M_SNPS / NCHR;
/* simulateCohort's own default for m = 2000 is [200, 900, 1600] — 10%, 45% and
   80% of the genome — which on four chromosomes of 500 puts one causal SNP on
   chromosome 1, one on 2 and one on 4. Written out rather than defaulted so
   the figure and the tiles name the same three. */
export const CAUSAL = [200, 900, 1600];
export const THRESHOLD = bonferroni(M_SNPS);
export const THR_L = -Math.log10(THRESHOLD);
/** The corrected threshold as the reader reads it, on the panel's own note. */
export const THR_TEXT = "0.05 / 2,000";

/* THE SCATTER'S THREE COMPONENTS, BY SUBSPACE ITERATION AND ALWAYS.
   `topEigen` is a deterministic function of the relationship matrix — no rng,
   a fixed start — so the picture of the cohort has ONE source whatever the
   Model control says, and a control that changes no genotype cannot mirror it.
   It costs 7 ms against the full decomposition's 73, and the two components
   the scatter draws come back to a relative 1e-3 (measured). */
const VIEW_PCS = 3;
const SUBSPACE_ITERS = 30;

/**
 * The cohort, its relationship matrix, its principal components and the one
 * scan the Model control asks for.
 *
 * THE COVARIATE COLUMNS ALWAYS COME FROM THE FULL DECOMPOSITION, and the full
 * decomposition is skipped entirely under SNP only. Measured: a scan on
 * subspace-iteration columns gives the same count past the line and the same
 * causal SNPs, and λ differs by up to 0.009 — which is the second decimal of
 * the number the tile prints, on the one comparison the Model control exists
 * to make (+ PCs against + PCs + GRM, where the second falls back to the
 * first). So the cheap path is taken where no test reads the components and
 * nowhere else: 67 ms under SNP only, 140 under + PCs, 230 under + PCs + GRM,
 * where the rotation of 2,000 SNP columns is most of the difference.
 *
 * Everything here is a pure function of the parameters and the seeded rng
 * (non-negotiable 2 and 6): the run reveals tests that are already computed.
 */
export function build(rng, cfg) {
  const co = simulateCohort(rng, cfg.sim);
  const K = grm(co.G);
  const view = topEigen(K, VIEW_PCS, SUBSPACE_ITERS);
  const eig = cfg.model === "snp" ? null : eigenSym(K);
  const cov = eig ? pcs(eig, cfg.npcs) : [];
  const scan = cfg.model === "grm"
    ? fastgwa(co.y, co.G, cov, eig)
    : olsScan(co.y, co.G, cov);
  const lp = Float64Array.from(scan.P, (p) => -Math.log10(Math.max(p, 1e-300)));
  return {
    cfg, co, K, view, eig, scan, lp, reml: scan.reml ?? null, fellBack: Boolean(scan.fellBack),
  };
}

/* ==========================================================================
   What the figure reads off a scan that is only partly revealed.
   ========================================================================== */

/* ONE CEILING FOR THE QQ PLOT, and it is below the tallest point. The expected
   −log₁₀P of 2,000 tests runs to 3.6 and a causal SNP comes back at 11 to 17,
   so a square tall enough to hold the tail puts the whole BODY of the plot —
   the thing the reader is asked to read — in the bottom fifth of the panel.
   The ceiling is 6: past the corrected threshold's 4.60, so a point crossing
   the line is seen crossing it, and high enough that nothing in the body is
   touched. Points past it are NOT drawn at it — drawn at it they became a flat
   run of 33 marks along the top edge, a shape the data does not have — and the
   panel prints how many there are instead. */
export const QQ_TOP = 6;

/* ONE Y AXIS, 0 TO 19, FOR EVERY MODEL AND EVERY COHORT (Kenneth's pick §1).
   The three models are read against each other and an axis fitted to each
   would draw a genome of false peaks and three true ones at the same height.
   19 is the default cohort's tallest peak plus two whole units of headroom:
   the causal SNPs' marks are drawn 2 to 8 pixels inside the top edge, and one
   unit at this panel size is 11px, so one unit of headroom put a mark 3px from
   the peak it points at.

   WHAT A FIXED CEILING COSTS, measured over 648 settings (3 ancestries × 4
   trait differences × 3 effects × 2 family settings × 3 models × 3 seeds): 32
   of them put a SNP past 19, almost always one, and the tallest anywhere is
   30.4. Such a SNP is drawn at the ceiling, in --c-extreme — it is past the
   corrected threshold's 4.60 by a factor of four, so its reading is the one it
   is drawn with — and no number the figure prints is read off it: the count
   past the threshold, λ and the causal tile all come from the P values
   themselves. */
export const AXIS_TOP = 19;

/* The reading is a sort over the tests run so far, and the figure asks for it
   three times a frame — the QQ points, λ on the panel's note and λ on the
   tile. One memo of one result: the inputs are an array identity and a count,
   so the same question always returns the same answer and `compute` stays the
   only place data is made. */
let lastReading = null;

/**
 * λ, the count past the threshold, which causal SNPs are found, and the QQ
 * points — all from the first `upTo` tests.
 */
export function reading(state, upTo) {
  const k = Math.max(0, Math.min(upTo, M_SNPS));
  if (lastReading && lastReading.P === state.scan.P && lastReading.k === k) {
    return lastReading.value;
  }
  const P = state.scan.P;
  const sorted = Array.prototype.slice.call(P, 0, k).sort((a, b) => a - b);
  const points = new Array(sorted.length);
  let above = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const obs = -Math.log10(Math.max(sorted[i], 1e-300));
    points[i] = [-Math.log10((i + 0.5) / sorted.length), obs];
    if (obs > QQ_TOP) above += 1;
  }
  let hits = 0;
  let found = 0;
  for (let j = 0; j < k; j += 1) if (P[j] < THRESHOLD) hits += 1;
  for (const j of CAUSAL) if (j < k && P[j] < THRESHOLD) found += 1;
  const mid = sorted.length
    ? (sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : NaN;
  const value = {
    k,
    points,
    above,
    hits,
    found,
    lambda: sorted.length ? chi1Inv(mid) / 0.4549364 : NaN,
  };
  lastReading = { P, k, value };
  return value;
}

/** The off-diagonal range of the relationship matrix, and its diagonal. */
export function grmRange(K) {
  let lo = Infinity;
  let hi = -Infinity;
  let dlo = Infinity;
  let dhi = -Infinity;
  for (let i = 0; i < K.length; i += 1) {
    for (let j = 0; j < K.length; j += 1) {
      if (i === j) {
        dlo = Math.min(dlo, K[i][j]);
        dhi = Math.max(dhi, K[i][j]);
      } else {
        lo = Math.min(lo, K[i][j]);
        hi = Math.max(hi, K[i][j]);
      }
    }
  }
  return { lo, hi, dlo, dhi };
}

/* THE RAMP IS CAPPED AT ±0.25, IN BOTH STATES. The off-diagonal entries
   without families run about −0.13 to 0.17, with families to 0.67 at a sibling
   pair, and the diagonal is about 1. A cap fitted to each state would draw the
   population blocks at two different strengths in the two pictures, which is
   the one comparison the control exists to make; a cap at the sibling pairs'
   value would leave the population blocks invisible. */
export const GRM_CAP = 0.25;

/* ==========================================================================
   The geometry, one function (5.8).
   ========================================================================== */

/* The association-test stage: a y-axis gutter, the Manhattan plot, a gap and a
   square QQ plot. The heights are set by `axisX`, which puts its tick row at
   the baseline + 6 and its label at the baseline + 22: a 188px plot starting
   at y 36 ends at 224, ticks at 230 and the label at 246, which is inside 260
   of canvas. At the narrowest canvas the side layout reaches — 550px — this is
   the mock's own 294 × 188 Manhattan plot and 166px QQ square. */
export const AX_L = 52;
export const AX_R = 8;
export const PANEL_GAP = 30;
export const TOP = 36;
export const MAN_H = 188;
export const AXIS_ROW = 36;
/* The QQ square's share of the width, so that 550 gives the mock's 166px. It
   is capped at the Manhattan plot's own height, which is what keeps the stage
   260px tall at every width. */
const QQ_FRAC = 0.3609;
/* One line for what the variance step decided, reserved whenever the model
   that has a variance step is chosen — 3.4k: the reserve is paid in every
   state of that model, so the figure below does not move when the estimate
   crosses its own threshold. */
export const FOOT_H = 20;

/* The cohort stage: two square panels of the same size, side by side. */
export const COH_L = 46;
export const COH_R = 16;
export const COH_GAP = 40;
export const COH_TOP = 40;
export const COH_BOTTOM = 36;
export const COH_MAX = 250;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Every rect the page draws in, and its own height, from the width and the
 * parameters alone — the same function `height` and `draw` both call (5.8).
 */
export function layout(w, values) {
  if (values.page === "cohort") {
    const usable = Math.max(200, w - COH_L - COH_R - COH_GAP);
    const side = Math.min(COH_MAX, Math.floor(usable / 2));
    const x0 = COH_L + Math.max(0, Math.round((usable - 2 * side) / 2));
    return {
      page: "cohort",
      scatter: { x: x0, y: COH_TOP, w: side, h: side },
      grm: { x: x0 + side + COH_GAP, y: COH_TOP, w: side, h: side },
      height: COH_TOP + side + COH_BOTTOM,
    };
  }
  const usable = Math.max(220, w - AX_L - AX_R - PANEL_GAP);
  const qq = Math.round(clamp(usable * QQ_FRAC, 140, MAN_H));
  const manW = usable - qq;
  const foot = values.model === "grm" ? FOOT_H : 0;
  return {
    page: "association",
    man: { x: AX_L, y: TOP, w: manW, h: MAN_H },
    qq: { x: AX_L + manW + PANEL_GAP, y: TOP + Math.round((MAN_H - qq) / 2), w: qq, h: qq },
    /* The footer line is a reading of the whole figure rather than of one
       panel, so it starts at the canvas's own left margin: aligned with the
       Manhattan plot's column it would have 44px less to fit a sentence that
       measures about 480px at --fs-xs, against the 534 the narrowest canvas
       offers here. */
    foot: { x: 8, y: TOP + MAN_H + AXIS_ROW + 12, w: w - 16, on: foot > 0 },
    height: TOP + MAN_H + AXIS_ROW + foot,
  };
}

/** The stage height, from the parameters and the width alone. */
export const stageHeight = (w, values) => layout(w, values).height;

/* ==========================================================================
   Pacing.

   2,000 tests at 60 frames a second: one SNP a frame is 33 seconds, so a frame
   carries a batch. At 10 a frame the run is 200 frames — 3.3 s — and one
   chromosome of 500 is 50 frames, 0.83 s, which is long enough to see a band
   arrive and short enough that nobody waits for the fourth. Step is ONE SNP,
   not a batch: Step is the beat that shows a single test landing, and a batch
   of ten would make the highlighted SNP a lie about what just happened.

   THE FRACTION IS KEPT ACROSS FRAMES (widget 55's clock, not widget 48's step
   floor): `beat` fills over UNIT_MS and the run advances by whatever whole
   units have accumulated, so the pace stays a RATE rather than becoming one
   unit per frame on a slow machine.
   ========================================================================== */
export const UNIT_MS = 1000 / 60;
export const PER_UNIT = 10;

/* ==========================================================================
   Numbers on screen.
   ========================================================================== */

export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
/** A P as the reader would see it: four decimals until it needs an exponent. */
export const pfmt = (P) => (!Number.isFinite(P) ? "—" : P < 1e-4 ? P.toExponential(1) : P.toFixed(4));
export const intText = (v) => Math.round(v).toLocaleString("en-US");

/* ==========================================================================
   The parameters, and their copy (5.9).
   ========================================================================== */

export const PAGES = [
  { value: "cohort", label: "Cohort", detail: "the 300 people, their ancestry and their relatedness" },
  { value: "association", label: "Association test", detail: "every SNP tested against the trait" },
];

/* The three ancestry settings, measured under SNP only at the default trait
   difference and seed 1: None gives λ 1.04 with 3 SNPs past the line and all
   three of them causal, Weak λ 2.47 with 11 past and 1 causal found, Strong
   λ 4.83 with 96 past and 2 causal found. Three options that each say
   something different, which is the condition a segmented control has to
   meet. */
export const ANCESTRY = [
  {
    value: "none",
    label: "None",
    topology: "star",
    fst: 1e-6,
    fstShallow: 1e-6,
  },
  {
    value: "weak",
    label: "Weak",
    topology: "nested",
    fst: 0.02,
    fstShallow: 0.005,
  },
  {
    value: "strong",
    label: "Strong",
    topology: "nested",
    fst: 0.05,
    fstShallow: 0.005,
  },
];
export const ancestryOf = (key) => ANCESTRY.find((a) => a.value === key) ?? ANCESTRY[2];

export const SHIFTS = [
  { value: "0", label: "0" },
  { value: "0.5", label: "0.5" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

/* The causal effect ladder, measured at n = 300: 0.05 clears the corrected
   threshold about one time in four, 0.12 almost always, 0.20 always. */
export const EFFECTS = [
  { value: "0.05", label: "0.05" },
  { value: "0.12", label: "0.12" },
  { value: "0.20", label: "0.20" },
];

/* `caption` is what the relationship matrix's panel calls the setting, where
   the control's own "None" would name nothing. */
export const FAMILIES = [
  { value: "none", label: "None", caption: "no families" },
  { value: "sibships", label: "Sibships of 4", caption: "sibships of 4" },
];
export const familiesOf = (key) => FAMILIES.find((f) => f.value === key) ?? FAMILIES[0];

/* THE URL VALUES ARE WORDS THE CONTROL SHOWS (5.9). `grm` is the word that
   tells the third model from the second; `pcs` and `snp` are the other two
   controls' own words. */
export const MODELS = [
  { value: "snp", label: "SNP only" },
  { value: "pcs", label: "+ PCs" },
  { value: "grm", label: "+ PCs + GRM" },
];

export const NPCS = [
  { value: "2", label: "2" },
  { value: "5", label: "5" },
];

export const STRINGS = {
  /* Kenneth's pick A of two, 2026-09-12: three claims, the third naming the
     two covariate sets the Model control offers. */
  subtitle:
    "A genome-wide association study tests every SNP against the trait separately. "
    + "Ancestry differences between subpopulations enter every one of those tests, and "
    + "principal components and the genetic relationship matrix remove them.",

  /* the gallery card: one declarative sentence naming the concept, inside the
     card's 120 characters */
  blurb:
    "Every SNP is tested against the trait; ancestry enters every test, and the mixed model removes it.",

  pageLabel: "Page",
  pageDetail: "the cohort, or the association test",

  cohortSection: "The cohort",
  testSection: "The test",

  ancestryLabel: "Ancestry structure",
  ancestryDetail: "the FST separating the three subpopulations: none, 0.005 and 0.02, or 0.005 and 0.05",

  shiftLabel: "Trait difference between populations",
  shiftDetail: "the difference in mean trait between the outer subpopulations, in residual SD",

  effectLabel: "Causal effect",
  effectDetail: "the fraction of the trait's variance each of the three causal SNPs explains",

  familiesLabel: "Families",
  familiesDetail: "whether the 300 people are unrelated or arranged as 75 sibships of four",

  familyEffectLabel: "Family effect",
  familyEffectDetail: "the trait effect a sibship shares, in residual SD",

  modelLabel: "Model",
  modelDetail: "the covariates each SNP is tested alongside",

  npcsLabel: "Principal components",
  npcsDetail: "how many eigenvectors of the relationship matrix are used as covariates",

  seedLabel: "Seed",
  seedDetail: "draws a different cohort",

  stepLabel: "Next SNP",
  stepTitle: "Test the next SNP against the trait",
  runTitle: "Test the remaining SNPs in order",

  /* on the canvas */
  manY: "−log₁₀P",
  manX: "chromosome",
  qqCaption: "observed −log₁₀P",
  qqX: "expected −log₁₀P",
  scatterCaption: "the first two principal components",
  scatterX: "PC1",
  scatterY: "PC2",
  grmCaption: "relatedness, every pair",
  grmAxis: "300 people, both ways",
  noTest: "no SNP tested yet",

  /* THE VARIANCE STEP'S OWN LINE, in both of its states. Kenneth's pick
     (§4, 2026-09-12) is the first of these, worded as something that happened
     at this cohort rather than as what the model always does with unrelated
     people — because at the default cohort and seed 1 the step does NOT fall
     back, and seed 4 at the same settings does. */
  fellBack: "The variance step found no genetic variance, so each SNP is tested by linear regression.",
  usedGrm: "The variance step found genetic variance, so each SNP is tested with the relationship matrix.",
};

/** The Manhattan panel's caption: the model, in the control's own words. */
export function modelCaption(params) {
  const npc = Number(params.npcs);
  if (params.model === "snp") return "SNP only";
  return params.model === "pcs" ? `+ ${npc} PCs` : `+ ${npc} PCs + GRM`;
}

/** The sample the controls describe, resolved once so nothing re-derives it. */
export function configFor(params) {
  const anc = ancestryOf(params.ancestry);
  const families = params.families === "sibships";
  return {
    model: params.model,
    npcs: Number(params.npcs),
    families,
    sim: {
      n: N,
      m: M_SNPS,
      k: 3,
      causal: CAUSAL,
      topology: anc.topology,
      fst: anc.fst,
      fstShallow: anc.fstShallow,
      shift: Number(params.shift),
      h2snp: Number(params.effect),
      families,
      sdFamily: families ? params.familyEffect : 0,
    },
  };
}
