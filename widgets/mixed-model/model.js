/* model.js — linear model and linear mixed model for the mixed-model widget
 * (05-07, Hierarchical Data).
 *
 * Pure functions, no DOM, no rng of their own — what the widget's compute()
 * and `_lab/mixed-measure.mjs` share, so what is verified is what runs.
 *
 * Conventions follow lme4, because the notebook's stored outputs are what
 * these must reproduce:
 *   - REML, profiled the way lme4 profiles it: the random-effect covariance
 *     is σ²·G with G = ΛΛᵀ the RELATIVE covariance, β and σ² solved in
 *     closed form at each Λ, and only Λ's Cholesky entries optimised.
 *   - Fixed-effect CIs are Wald z intervals (estimate ± 1.96·SE), which is
 *     what modelsummary prints for an lmer fit; the lm CIs are t intervals,
 *     which is what confint.lm computes.
 *   - R² marginal/conditional are Nakagawa's, with Johnson's (2014)
 *     mean-observation random-effect variance so random slopes count.
 *
 * The grouped structure keeps every θ-step cheap: all cross-products are
 * computed once per group, so one REML evaluation is q×q algebra (q ≤ 2)
 * per group plus one p×p solve — the whole fit is milliseconds at the
 * notebook's 500 rows, which is what lets compute() refit on every change.
 */

import { tCritical } from "../core/stats.js";

/* --- small dense matrix helpers ------------------------------------------- */

/** Cholesky lower factor of a symmetric PD matrix. Throws on non-PD. */
export function chol(A) {
  const n = A.length;
  const L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = A[i][j];
      for (let k = 0; k < j; k += 1) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) throw new Error("chol: not positive definite");
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

/** Solve A x = b given L = chol(A). */
export function cholSolve(L, b) {
  const n = L.length;
  const y = new Array(n);
  for (let i = 0; i < n; i += 1) {
    let s = b[i];
    for (let k = 0; k < i; k += 1) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = y[i];
    for (let k = i + 1; k < n; k += 1) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Inverse of a symmetric PD matrix given its Cholesky factor. */
function cholInverse(L) {
  const n = L.length;
  const inv = [];
  for (let j = 0; j < n; j += 1) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    inv.push(cholSolve(L, e));
  }
  // columns of the inverse; symmetric, so rows work too
  return inv;
}

const logDetFromChol = (L) => 2 * L.reduce((s, row, i) => s + Math.log(row[i]), 0);

/* --- ordinary least squares ------------------------------------------------ */

/**
 * OLS with t confidence intervals, R's lm()/confint() conventions.
 * X is an array of rows (each already carrying its intercept column).
 * Returns { coef, se, ci, sigma, r2, rmse, df, fitted, residuals }.
 */
export function fitLM(y, X, conf = 0.95) {
  const n = y.length;
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    const xi = X[i];
    for (let j = 0; j < p; j += 1) {
      b[j] += xi[j] * y[i];
      for (let k = 0; k <= j; k += 1) A[j][k] += xi[j] * xi[k];
    }
  }
  for (let j = 0; j < p; j += 1)
    for (let k = j + 1; k < p; k += 1) A[j][k] = A[k][j];
  const L = chol(A);
  const coef = cholSolve(L, b);
  const fitted = X.map((xi) => xi.reduce((s, v, j) => s + v * coef[j], 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const tss = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const df = n - p;
  const sigma2 = rss / df;
  const cov = cholInverse(L);
  const se = coef.map((_, j) => Math.sqrt(sigma2 * cov[j][j]));
  const tc = tCritical(df, conf);
  const ci = coef.map((c, j) => [c - tc * se[j], c + tc * se[j]]);
  return {
    coef, se, ci, df,
    sigma: Math.sqrt(sigma2),
    r2: 1 - rss / tss,
    rmse: Math.sqrt(rss / n),
    fitted, residuals,
  };
}

/* --- linear mixed model ----------------------------------------------------
 *
 * fitLMM(y, X, group, zslope) fits
 *     y = Xβ + Z u + ε,   u_g ~ N(0, σ²·G),   ε ~ N(0, σ²·I)
 * by REML. `group` assigns each row to a grouping unit. `zslope` is null for
 * a random intercept — lmer's (1 | g) — or the covariate whose slope varies
 * by unit — (1 + zslope | g). q is 1 or 2 accordingly.
 *
 * Per group, with M = ZᵀZ and G = ΛΛᵀ (Λ lower triangular from θ):
 *     V⁻¹ = I − ZΛ K⁻¹ ΛᵀZᵀ,   K = I_q + ΛᵀMΛ,   log|V| = log|K|
 * so accumulating XᵀV⁻¹X, XᵀV⁻¹y and yᵀV⁻¹y needs only the cached
 * cross-products XᵀX, XᵀZ, Zᵀy, ZᵀZ, Xᵀy, yᵀy per group.
 */

function groupRows(group) {
  const map = new Map();
  group.forEach((g, i) => {
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(i);
  });
  return [...map.values()];
}

/** Generic Nelder–Mead, minimising f over R^d. Small and deterministic. */
export function nelderMead(f, x0, { maxIter = 4000, tol = 1e-13, step = 0.1 } = {}) {
  const d = x0.length;
  const pts = [x0.slice()];
  for (let i = 0; i < d; i += 1) {
    const p = x0.slice();
    p[i] += p[i] !== 0 ? step * Math.abs(p[i]) : step;
    pts.push(p);
  }
  let simplex = pts.map((p) => ({ p, v: f(p) }));
  for (let it = 0; it < maxIter; it += 1) {
    simplex.sort((a, b) => a.v - b.v);
    const best = simplex[0];
    const worst = simplex[d];
    if (Math.abs(worst.v - best.v) < tol * (Math.abs(best.v) + tol)) break;
    const centroid = new Array(d).fill(0);
    for (let i = 0; i < d; i += 1)
      for (let j = 0; j < d; j += 1) centroid[j] += simplex[i].p[j] / d;
    const move = (t) => centroid.map((c, j) => c + t * (worst.p[j] - c));
    const refl = move(-1);
    const vRefl = f(refl);
    if (vRefl < best.v) {
      const exp = move(-2);
      const vExp = f(exp);
      simplex[d] = vExp < vRefl ? { p: exp, v: vExp } : { p: refl, v: vRefl };
    } else if (vRefl < simplex[d - 1].v) {
      simplex[d] = { p: refl, v: vRefl };
    } else {
      const con = move(vRefl < worst.v ? -0.5 : 0.5);
      const vCon = f(con);
      if (vCon < Math.min(vRefl, worst.v)) {
        simplex[d] = { p: con, v: vCon };
      } else {
        simplex = simplex.map(({ p }, i) => {
          if (i === 0) return simplex[0];
          const q = p.map((v, j) => best.p[j] + 0.5 * (v - best.p[j]));
          return { p: q, v: f(q) };
        });
      }
    }
  }
  simplex.sort((a, b) => a.v - b.v);
  return simplex[0];
}

export function fitLMM(y, X, group, zslope = null, opts = {}) {
  /* opts.start warm-starts θ — the repeat-study stage refits the same design
     a hundred times and the optimum barely moves between draws, so starting
     from the last θ cuts the Nelder–Mead budget by an order of magnitude.
     opts.fast additionally runs ONE pass at a looser stop — verified in
     _lab/mixed-drive.mjs to reach the same reject/keep decision as the full
     fit on every study of a 100-study tally. */
  const { conf = 0.95, start = null, fast = false } = opts;
  const n = y.length;
  const p = X[0].length;
  const q = zslope ? 2 : 1;
  const idxGroups = groupRows(group);

  // per-group cached cross-products
  const cache = idxGroups.map((rows) => {
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtZ = Array.from({ length: p }, () => new Array(q).fill(0));
    const ZtZ = Array.from({ length: q }, () => new Array(q).fill(0));
    const Xty = new Array(p).fill(0);
    const Zty = new Array(q).fill(0);
    let yty = 0;
    for (const i of rows) {
      const xi = X[i];
      const zi = q === 2 ? [1, zslope[i]] : [1];
      for (let j = 0; j < p; j += 1) {
        Xty[j] += xi[j] * y[i];
        for (let k = 0; k <= j; k += 1) XtX[j][k] += xi[j] * xi[k];
        for (let k = 0; k < q; k += 1) XtZ[j][k] += xi[j] * zi[k];
      }
      for (let j = 0; j < q; j += 1) {
        Zty[j] += zi[j] * y[i];
        for (let k = 0; k <= j; k += 1) ZtZ[j][k] += zi[j] * zi[k];
      }
      yty += y[i] * y[i];
    }
    for (let j = 0; j < p; j += 1)
      for (let k = j + 1; k < p; k += 1) XtX[j][k] = XtX[k][j];
    for (let j = 0; j < q; j += 1)
      for (let k = j + 1; k < q; k += 1) ZtZ[j][k] = ZtZ[k][j];
    return { rows, XtX, XtZ, ZtZ, Xty, Zty, yty };
  });

  // One REML evaluation; returns the profiled criterion, or the full pieces.
  // Specialised to q ≤ 2 with the 2×2 algebra written out — the generic
  // per-group Cholesky version allocated its way to ~30 ms a fit, which
  // priced the repeat-study tally out of compute(). Same maths, same
  // answers (the 89-check measure suite pins it), an order of magnitude
  // less garbage.
  const u0s = new Array(p);
  const u1s = new Array(p);
  const a0s = new Array(p);
  const a1s = new Array(p);
  const evaluate = (theta, full = false) => {
    const l0 = Math.abs(theta[0]);
    const l1 = q === 2 ? theta[1] : 0;
    const l2 = q === 2 ? Math.abs(theta[2]) : 0;
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const b = new Array(p).fill(0);
    let yy = 0;
    let logDetV = 0;
    const perGroup = full ? [] : null;
    for (const g of cache) {
      const M = g.ZtZ;
      // K = I + Λᵀ M Λ, its determinant and inverse, closed form
      let det;
      let i00;
      let i01 = 0;
      let i11 = 0;
      if (q === 1) {
        det = 1 + l0 * M[0][0] * l0;
        if (!(det > 0)) return full ? null : Number.MAX_VALUE / 2;
        i00 = 1 / det;
      } else {
        const T00 = l0 * M[0][0] + l1 * M[1][0];
        const T01 = l0 * M[0][1] + l1 * M[1][1];
        const k00 = 1 + T00 * l0 + T01 * l1;
        const k01 = T01 * l2;
        const k11 = 1 + l2 * M[1][1] * l2;
        det = k00 * k11 - k01 * k01;
        if (!(det > 0)) return full ? null : Number.MAX_VALUE / 2;
        i00 = k11 / det;
        i01 = -k01 / det;
        i11 = k00 / det;
      }
      logDetV += Math.log(det);
      const zy0 = g.Zty[0];
      const zy1 = q === 2 ? g.Zty[1] : 0;
      const w0 = l0 * zy0 + l1 * zy1;
      const w1 = q === 2 ? l2 * zy1 : 0;
      const kw0 = i00 * w0 + i01 * w1;
      const kw1 = i01 * w0 + i11 * w1;
      yy += g.yty - (w0 * kw0 + w1 * kw1);
      for (let j = 0; j < p; j += 1) {
        const xz0 = g.XtZ[j][0];
        const xz1 = q === 2 ? g.XtZ[j][1] : 0;
        const uj0 = l0 * xz0 + l1 * xz1;
        const uj1 = l2 * xz1;
        u0s[j] = uj0;
        u1s[j] = uj1;
        a0s[j] = i00 * uj0 + i01 * uj1;
        a1s[j] = i01 * uj0 + i11 * uj1;
        b[j] += g.Xty[j] - (uj0 * kw0 + uj1 * kw1);
      }
      for (let j = 0; j < p; j += 1) {
        const rowA = A[j];
        const rowX = g.XtX[j];
        const aj0 = a0s[j];
        const aj1 = a1s[j];
        for (let k = 0; k <= j; k += 1)
          rowA[k] += rowX[k] - (u0s[k] * aj0 + u1s[k] * aj1);
      }
      if (full) perGroup.push({ g, i00, i01, i11 });
    }
    for (let j = 0; j < p; j += 1)
      for (let k = j + 1; k < p; k += 1) A[j][k] = A[k][j];
    let LA;
    try {
      LA = chol(A);
    } catch {
      return full ? null : Number.MAX_VALUE / 2;
    }
    const beta = cholSolve(LA, b);
    const qform = yy - b.reduce((s, v, j) => s + v * beta[j], 0);
    const df = n - p;
    // a wild θ can drive the profiled quadratic form to ≤0 in floating point;
    // Nelder–Mead must see a finite penalty there, never a NaN
    if (!(qform > 0)) return full ? null : Number.MAX_VALUE / 2;
    const crit =
      logDetV + logDetFromChol(LA) + df * (1 + Math.log((2 * Math.PI * qform) / df));
    if (!full) return crit;
    const Lam = q === 1 ? [[l0]] : [[l0, 0], [l1, l2]];
    return { crit, Lam, A, LA, beta, qform, df, perGroup };
  };

  const s0 = start ?? (q === 1 ? [1] : [1, 0, 1]);
  let best;
  if (fast && start) {
    best = nelderMead((t) => evaluate(t), s0, { tol: 1e-10, step: 0.06 });
  } else {
    best = nelderMead((t) => evaluate(t), s0);
    // one restart from the optimum guards a premature simplex collapse
    best = nelderMead((t) => evaluate(t), best.p);
  }

  const fit = evaluate(best.p, true);
  const sigma2 = fit.qform / fit.df;
  const sigma = Math.sqrt(sigma2);
  const G = (() => {
    const Lam = fit.Lam;
    const out = Array.from({ length: q }, () => new Array(q).fill(0));
    for (let a = 0; a < q; a += 1)
      for (let c = 0; c < q; c += 1)
        for (let r = 0; r < q; r += 1) out[a][c] += Lam[a][r] * Lam[c][r];
    return out;
  })();
  const covBeta = cholInverse(fit.LA).map((row) => row.map((v) => v * sigma2));
  const se = fit.beta.map((_, j) => Math.sqrt(covBeta[j][j]));
  // Wald t on residual df — measured against cell 13's printed intervals:
  // every half-width there is SE × t₀.₉₇₅(n−p), not SE × 1.96.
  const tc = tCritical(fit.df, conf);
  const ci = fit.beta.map((c, j) => [c - tc * se[j], c + tc * se[j]]);

  const sdInt = sigma * Math.sqrt(G[0][0]);
  const sdSlope = q === 2 ? sigma * Math.sqrt(G[1][1]) : null;
  const cor =
    q === 2 && G[0][0] > 0 && G[1][1] > 0
      ? G[0][1] / Math.sqrt(G[0][0] * G[1][1])
      : null;

  // BLUPs: u = σ²G Zᵀ V⁻¹ r / σ² = G (Zᵀr − M Λ K⁻¹ Λᵀ Zᵀr)
  const blups = fit.perGroup.map(({ g, i00, i01, i11 }) => {
    const Ztr = g.Zty.map(
      (v, r) => v - g.XtZ.reduce((s, row, j) => s + row[r] * fit.beta[j], 0),
    );
    const w = new Array(q).fill(0);
    for (let c = 0; c < q; c += 1)
      for (let r = 0; r < q; r += 1) w[c] += fit.Lam[r][c] * Ztr[r];
    const Kw = q === 1
      ? [i00 * w[0]]
      : [i00 * w[0] + i01 * w[1], i01 * w[0] + i11 * w[1]];
    const LKw = new Array(q).fill(0);
    for (let r = 0; r < q; r += 1)
      for (let c = 0; c < q; c += 1) LKw[r] += fit.Lam[r][c] * Kw[c];
    const MLKw = new Array(q).fill(0);
    for (let r = 0; r < q; r += 1)
      for (let t = 0; t < q; t += 1) MLKw[r] += g.ZtZ[r][t] * LKw[t];
    const inner = Ztr.map((v, r) => v - MLKw[r]);
    const u = new Array(q).fill(0);
    for (let a = 0; a < q; a += 1)
      for (let r = 0; r < q; r += 1) u[a] += G[a][r] * inner[r];
    return u;
  });

  // Nakagawa R² with Johnson's mean-observation random-effect variance:
  // varRe = mean over rows of zᵢᵀ (σ²G) zᵢ = tr(σ²G · ΣZᵀZ/n)
  const Mtot = Array.from({ length: q }, () => new Array(q).fill(0));
  for (const g of cache)
    for (let r = 0; r < q; r += 1)
      for (let t = 0; t < q; t += 1) Mtot[r][t] += g.ZtZ[r][t];
  let varRe = 0;
  for (let r = 0; r < q; r += 1)
    for (let t = 0; t < q; t += 1) varRe += sigma2 * G[r][t] * (Mtot[t][r] / n);
  const fittedFix = X.map((xi) => xi.reduce((s, v, j) => s + v * fit.beta[j], 0));
  const fbar = fittedFix.reduce((s, v) => s + v, 0) / n;
  const varFix = fittedFix.reduce((s, v) => s + (v - fbar) ** 2, 0) / n;
  const total = varFix + varRe + sigma2;

  // conditional fitted values (fixed + BLUP), for the RMSE modelsummary prints
  const groupIndex = new Map();
  idxGroups.forEach((rows, gi) => rows.forEach((i) => groupIndex.set(i, gi)));
  const fitted = fittedFix.map((v, i) => {
    const u = blups[groupIndex.get(i)];
    return v + u[0] + (q === 2 ? u[1] * zslope[i] : 0);
  });
  const rmse = Math.sqrt(
    y.reduce((s, v, i) => s + (v - fitted[i]) ** 2, 0) / n,
  );

  const nPar = (q === 1 ? 1 : 3) + 1 + p; // θ, σ, β — lme4's AIC/BIC count
  return {
    coef: fit.beta, se, ci, sigma, sdInt, sdSlope, cor,
    icc: varRe / (varRe + sigma2),
    r2Marginal: varFix / total,
    r2Conditional: (varFix + varRe) / total,
    reml: fit.crit,
    aic: fit.crit + 2 * nPar,
    bic: fit.crit + Math.log(n) * nPar,
    rmse, fitted, blups,
    groups: idxGroups,
    theta: best.p,
  };
}

/* --- the widget's data ----------------------------------------------------- *
 * Both generators are the notebook's own processes with the teaching dials
 * exposed. At the notebook's values they produce the same KIND of dataset it
 * analyses (its exact rows come from R's RNG and live in _lab/mixed-ref.json;
 * the measure script fits those directly).
 */

/**
 * Longitudinal blood pressure — notebook 05-07 cell 5.
 *   bp = 120 + (age−50)·0.75 + male·5 + effect·med + u0 + t·u1 + ε
 * with u0 ~ N(0, sdPatient), u1 ~ N(meanSlope, sdSlope), ε ~ N(0, sdNoise).
 * The notebook has effect = 0 (the medication does nothing) and sdPatient=10.
 * Rows are patient-major: all of patient 1's visits, then patient 2's.
 */
export function simulateBP(rng, opts = {}) {
  const {
    patients = 100, perPatient = 5, effect = 0,
    sdPatient = 10, meanSlope = -1, sdSlope = 0.5, sdNoise = 5,
  } = opts;
  const out = {
    patientId: [], time: [], bp: [], age: [], male: [], med: [],
  };
  for (let pIdx = 0; pIdx < patients; pIdx += 1) {
    const age = Math.round(40 + rng.next() * 20);
    const male = rng.next() < 0.5 ? 1 : 0;
    const med = rng.next() < 0.5 ? 1 : 0;
    const u0 = rng.normal(0, sdPatient);
    const u1 = rng.normal(meanSlope, sdSlope);
    for (let t = 1; t <= perPatient; t += 1) {
      out.patientId.push(pIdx + 1);
      out.time.push(t);
      out.age.push(age);
      out.male.push(male);
      out.med.push(med);
      out.bp.push(
        120 + (age - 50) * 0.75 + male * 5 + effect * med +
        u0 + t * u1 + rng.normal(0, sdNoise),
      );
    }
  }
  return out;
}

/** Design matrix for the BP fits: [1, age, male, med]; med is column 3. */
export const designBP = (d) =>
  d.bp.map((_, i) => [1, d.age[i], d.male[i], d.med[i]]);
export const BP_MED_COL = 3;

/**
 * SNP panel — notebook 05-07 cell 16. Families share a base genotype
 * (individual = base OR own variation, capped at 1) AND a shared phenotype
 * shift ~ N(0, sdFamily); both channels together are what fools the lm.
 * `causal` is a bitmask over the ten SNPs (bit j = SNP j+1 carries `effect`);
 * 16 is the notebook's truth, SNP5 alone.
 */
export function simulateSNP(rng, opts = {}) {
  const {
    n = 1000, families = 200, snps = 10,
    causal = 16, effect = 1.2, sdFamily = 5, sdNoise = 0.5,
  } = opts;
  const base = Array.from({ length: families }, () =>
    Array.from({ length: snps }, () => (rng.next() < 0.5 ? 1 : 0)),
  );
  const famShift = Array.from({ length: families }, () =>
    rng.normal(0, sdFamily),
  );
  const out = { familyId: [], chol: [], geno: [] };
  for (let i = 0; i < n; i += 1) {
    const f = Math.floor(rng.next() * families);
    // always draw the variation bit, so the rng stream does not depend on
    // the base genotype and a seed stays comparable across `causal` masks
    const g = base[f].map((b) => {
      const v = rng.next() < 0.5 ? 1 : 0;
      return b | v;
    });
    let y = 8 + rng.normal(0, sdNoise) + famShift[f];
    for (let j = 0; j < snps; j += 1)
      if (causal & (1 << j)) y += g[j] * effect;
    out.familyId.push(f + 1);
    out.chol.push(y);
    out.geno.push(g);
  }
  return out;
}

/** Design matrix for the SNP fits: [1, SNP1..SNP10]; SNP j is column j. */
export const designSNP = (d) => d.geno.map((g) => [1, ...g]);
