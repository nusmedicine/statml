/* ============================================================================
   The engine for HTD slot 3, `batch-effect` (PHM5003 HTD `05 / 05`).

   The generator reproduces the notebook's cell 3:

       expression_data <- matrix(rnorm(50 * 40, 0, 1), ncol = 40)
       condition <- ifelse(seq(1, 40) %% 2 == 0, "Disease", "Healthy")
       expression_data[1:25, even] <- ... + rnorm(25, 0.8, 0.25)
       batch <- c(rep("Batch1", 20), rep("Batch2", 20))
       expression_data[, 21:40] <- expression_data[, 21:40] + 2

   with one addition: `overlap`, which controls how far batch and condition
   line up. The notebook's own design sits at overlap = 0, and it never says so.

   ---------------------------------------------------------------------------
   IT SERVES TWO PAGES, and only one of them exists yet. `batch-effect` asks
   what a batch effect DOES to the data and reads `simulate`, `withoutBatch`,
   `projectOnto`, `design` and `separation`. The correction page will read
   `CORRECTIONS`, `correct`, `estimateWithSE`, `nullEffect` and `projectAll` —
   built and reviewed through round 5, then set aside when Kenneth split the
   two, because correcting the data and modelling the batch prescribe opposite
   things and one page cannot say both.

   None of that half is dead: `_lab/batch-measure.mjs` runs all of it and
   prints the numbers the catalogue quotes, so it stays honest while it waits.
   The figure code it fed — the formula card and the forest plot of intervals —
   is in the widget's own history at commit e7f909d.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

export const GENES = 50;
export const SAMPLES = 40;
export const AFFECTED = 25;          // genes 1..25 carry the disease effect
export const TRUE_EFFECT = 0.8;
export const BATCH_SHIFT = 2;

/**
 * `overlap` is the one control the notebook does not have.
 *
 * Condition is assigned so batch 1 holds (1 + overlap) / 2 of its samples as
 * healthy and batch 2 the mirror. At 0 every batch is 10 healthy and 10
 * disease — the notebook's design, where the batches are balanced and the
 * correction can work. At 1 batch 1 is entirely healthy and batch 2 entirely
 * disease, so batch and condition are the same variable and no correction can
 * separate them.
 */
export function simulate({ seed = 1, overlap = 0, batchShift = BATCH_SHIFT,
  effect = TRUE_EFFECT } = {}) {
  const rng = makeRng(seed);
  const half = SAMPLES / 2;

  /* Which samples are diseased. At overlap = 0 they alternate, as in the
     notebook; as overlap rises they migrate into batch 2. Deterministic, so
     the reader sees a design change rather than another draw. */
  const nDiseaseInB1 = Math.round((half / 2) * (1 - overlap));
  const disease = new Array(SAMPLES).fill(false);
  for (let i = 0; i < nDiseaseInB1; i += 1) disease[i * 2 + 1] = true;
  const nDiseaseInB2 = half - nDiseaseInB1;
  for (let i = 0; i < nDiseaseInB2; i += 1) disease[half + i] = true;

  const batch = Array.from({ length: SAMPLES }, (_, j) => (j < half ? 0 : 1));

  /* genes x samples, the notebook's own orientation */
  const X = Array.from({ length: GENES }, () =>
    Array.from({ length: SAMPLES }, () => rng.normal(0, 1)));

  for (let j = 0; j < SAMPLES; j += 1) {
    if (!disease[j]) continue;
    for (let g = 0; g < AFFECTED; g += 1) X[g][j] += rng.normal(effect, 0.25);
  }
  for (let j = 0; j < SAMPLES; j += 1) {
    if (batch[j] !== 1) continue;
    for (let g = 0; g < GENES; g += 1) X[g][j] += batchShift;
  }

  return { X, batch, disease, shift: batchShift };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/* --- the lesson's methods -------------------------------------------------- *
 * The notebook's own five, and they fail in four different ways. Estimated
 * disease effect, truth 0.80, mean of 5 seeds — `_lab/batch-methods.mjs`
 * prints this table:
 *
 *     confounding    none   ComBat   ComBat+mod    SVA     RUV
 *      balanced      0.825   0.819      0.825     0.825   0.794
 *      half          1.808   0.633      1.131     1.808   0.838
 *      strong        2.219   0.495      1.599     2.219   0.941
 *      complete      2.771   0.122      2.771     2.771   2.803
 *
 * ComBat with `mod = NULL`, which is what cell 12 runs, DELETES the biology in
 * proportion to the confounding. ComBat with `mod = ~condition`, cell 11's
 * "optional but recommended", protects the biology and protects the confounded
 * part of the batch WITH it. The two fail in opposite directions.
 *
 * SVA NEVER MOVES THE ESTIMATE. Its surrogate variable is built from the
 * residuals after the condition has been removed, so it is orthogonal to the
 * condition by construction and cannot touch that coefficient. What it moves is
 * the standard error — 0.450 to 0.316 at a balanced design, real power, and
 * 0.315 against the true batch covariate's 0.446 at strong confounding: a
 * TIGHTER interval around a wrong answer.
 *
 * RUV holds 0.79 to 0.94 and fails only at complete confounding, because its
 * factor comes from control genes that carry the batch and nothing else. The
 * correlation between each method's estimated variable and the true batch says
 * why: SVA runs 0.991 / 0.856 / 0.701 / 0.000 across the ladder while RUV holds
 * 0.982 throughout.
 * -------------------------------------------------------------------------- */

/**
 * The reference set RUV is handed, and it IS the method.
 *
 * Kept conceptual rather than by gene index (Kenneth, 2026-09-02): the point is
 * that without a proper reference you cannot correct properly, not which rows
 * of this particular simulation happen to be quiet. Cell 21 picks `26:50`,
 * which are exactly the genes the lesson simulated with no disease effect — the
 * truth choosing the controls.
 *
 * Measured, truth 0.80, 5 seeds:
 *
 *                     estimate       |corr| with     |corr| with
 *                   (across the      the batch       the condition
 *                      ladder)
 *     housekeeping   0.79 - 1.01        0.982            0.019
 *     random         0.46 - 0.59        0.977            0.172
 *
 * BOTH SETS FIND THE BATCH. What separates them is the second column: a
 * reference set that carries biology gives RUV a factor pointing at the very
 * thing it is supposed to preserve, so the correction removes the effect along
 * with the artefact. Random references cost about 40% of the truth at every
 * setting — the failure is stable, not a corner case.
 */
export const CONTROL_SETS = {
  housekeeping: {
    label: "Housekeeping",
    detail: "genes assumed to carry no biological signal, so the factor finds the batch and nothing else",
    genes: () => range(AFFECTED, GENES),
  },
  random: {
    label: "Random",
    detail: "no proper reference — about half of them carry the disease effect, and the correction takes the biology with the batch",
    genes: () => {
      /* Fixed, not per-seed: which genes an analyst nominates as references is a
         decision made once, not another draw. */
      const rng = makeRng(7);
      const all = range(0, GENES);
      for (let i = all.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng.next() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return all.slice(0, AFFECTED).sort((a, b) => a - b);
    },
  },
};
/**
 * Every method, by what it DOES.
 *
 * `data` returns the matrix a reader would go on to look at and test. `covar`
 * returns extra columns for the model instead, and a method that has one does
 * NOT edit the matrix — that is the difference between correcting the data and
 * modelling the nuisance, and giving a covariate method a fake transformation
 * so a scatter had something to draw is what cost this widget three rounds.
 */
export const METHODS = {
  none: {
    label: "None",
    data: ({ X }) => X,
    covar: null,
  },

  combat: {
    label: "ComBat",
    /* ONE ENTRY, TWO SETTINGS, and `mod` is a sub-control rather than a second
       method (Kenneth, 2026-09-02). `mod = ~condition` is cell 11's "optional
       but recommended" and the default here; `mod = NULL` is what cell 12
       actually runs.

       They agree where it would not matter and part where it does. Estimated
       effect, truth 0.80, 5 seeds: 0.819 against 0.825 at a balanced design and
       0.791 against 0.933 at slight confounding — a difference of 0.01 and 0.14
       — then 0.633 / 1.131 at half, 0.495 / 1.599 at strong, and 0.122 / 2.771
       at complete. They do not merely differ, they fail in OPPOSITE directions:
       one decays toward zero, deleting the biology, and the other inflates past
       the true effect and eventually past the batch shift itself. */
    data: (sim, opts) => combat(sim, { keepCondition: (opts?.mod ?? "condition") !== "null" }),
    covar: null,
  },

  sva: {
    label: "SVA",
    /* IT DOES NOT TOUCH THE MATRIX. The surrogate variable goes in the model,
       which is the whole claim: you never learn the batch, you estimate a
       stand-in for it and adjust for that. */
    data: ({ X }) => X,
    covar: (sim) => [surrogateVariable(sim)],
  },

  ruv: {
    label: "RUV",
    /* THE ONLY METHOD THAT DOES BOTH, and the notebook says so in two places.
       Cell 21's `naiveRandRUV` returns CORRECTED DATA, which cell 22 runs a PCA
       on — that is the panel. Cell 19's own problem formulation is
       `Y = X beta + W gamma + eps`, W in the MODEL — that is the estimate.
       W is estimated once from the control genes and used for both.

       It matters. Residualising on W and then running a two-group test gives
       0.793 / 0.623 / 0.489 / 0.102 across the ladder — it deletes the biology
       exactly as ComBat does, because W carries the confounded part of the
       condition too. W in the model gives 0.794 / 0.838 / 0.941, holding until
       the design is singular. Same W, and the difference is only where it is
       used. */
    data: (sim, opts) => residualiseOn(sim.X, [unwantedVariable(sim, opts)]),
    covar: (sim, opts) => [unwantedVariable(sim, opts)],
  },
};

/** The matrix a method leaves behind, for the panel and for the test. */
export const applyMethod = (sim, key, opts) => METHODS[key].data(sim, opts);

/**
 * The same samples without the batch shift — GROUND TRUTH, and a thing only a
 * simulation can hand you. Cell 7 subtracts exactly this and calls it a
 * correction; the widget shows it as the benchmark it really is.
 */
export function withoutBatch({ X, batch, shift }) {
  return X.map((row) => row.map((v, j) => v - (batch[j] === 1 ? shift : 0)));
}

/* --- the methods, implemented --------------------------------------------- */

const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

/** Residuals of every gene on `cols`, or the row itself if the fit is singular. */
function residualsOn(X, cols) {
  return X.map((row) => {
    const beta = ols(cols, row);
    if (!beta) return row.slice();
    return row.map((v, j) => v - cols.reduce((s, u, a) => s + u[j] * beta[a], 0));
  });
}

/** The same, but keeping the gene's own mean so the picture stays in units. */
function residualiseOn(X, extra) {
  const n = X[0].length;
  const cols = [new Array(n).fill(1), ...extra];
  return X.map((row) => {
    const beta = ols(cols, row);
    if (!beta) return row.slice();
    /* only the extra terms come out; the intercept is the gene's own level */
    return row.map((v, j) => v - extra.reduce((s, u, a) => s + u[j] * beta[a + 1], 0));
  });
}

/**
 * ComBat: location AND scale, with the empirical-Bayes shrinkage that is the
 * method's whole point. Two things here were wrong before they were measured.
 *
 * `sigma-hat` is the WITHIN-BATCH residual sd, so the batch term is fitted for
 * it even when `mod` does not keep it. Standardising by the total sd instead
 * took the disease effect from 0.825 to 1.365 at a balanced design.
 *
 * The inverse-gamma prior's shape is `(2 s2 + dBar^2) / s2`. Written the other
 * way round, the ratio bPrior/aPrior tends to dBar/2 rather than 1 as the
 * spread of delta goes to zero — and on a stage where every gene has the same
 * batch variance, that divides by sqrt(0.5) and inflates everything by 1.41.
 *
 * The shrinkage is a real gain on gamma itself: it cuts the error in the
 * per-gene shift by 41% when every gene shares one, falling to 7% when they
 * differ. It still does not move the disease effect.
 */
function combat(sim, { keepCondition }) {
  const { X, batch, disease } = sim;
  const n = X[0].length;
  const cols = keepCondition
    ? [new Array(n).fill(1), disease.map(Number)]
    : [new Array(n).fill(1)];
  const withBatch = [...cols, batch.map(Number)];

  const fitted = X.map((row) => {
    const beta = ols(cols, row);
    return row.map((v, j) => cols.reduce((s, u, a) => s + u[j] * beta[a], 0));
  });
  const resid = X.map((row, g) => row.map((v, j) => v - fitted[g][j]));

  const sd = X.map((row) => {
    /* At complete confounding [1, condition, batch] is singular — which is what
       complete confounding MEANS — so the model without the batch is all there
       is to take a residual from. */
    const b = ols(withBatch, row);
    const use = b ? withBatch : cols;
    const beta = b || ols(cols, row);
    const r = row.map((v, j) => v - use.reduce((s, u, a) => s + u[j] * beta[a], 0));
    return Math.sqrt(mean(r.map((v) => v * v))) || 1;
  });
  const z = resid.map((r, g) => r.map((v) => v / sd[g]));

  const idxOf = (b) => range(0, n).filter((j) => batch[j] === b);
  const gamma = [];
  const delta = [];
  for (let b = 0; b < 2; b += 1) {
    const idx = idxOf(b);
    gamma.push(z.map((r) => mean(idx.map((j) => r[j]))));
    delta.push(z.map((r, g) => mean(idx.map((j) => (r[j] - gamma[b][g]) ** 2)) || 1));
  }

  const gStar = [];
  const dStar = [];
  for (let b = 0; b < 2; b += 1) {
    const idx = idxOf(b);
    const nB = idx.length;
    const gBar = mean(gamma[b]);
    const tau2 = mean(gamma[b].map((v) => (v - gBar) ** 2)) || 1e-9;
    gStar.push(gamma[b].map((v, g) => (nB * tau2 * v + delta[b][g] * gBar)
      / (nB * tau2 + delta[b][g])));
    const dBar = mean(delta[b]);
    const s2 = mean(delta[b].map((v) => (v - dBar) ** 2)) || 1e-9;
    const aPrior = (2 * s2 + dBar ** 2) / s2;
    const bPrior = (dBar * s2 + dBar ** 3) / s2;
    dStar.push(delta[b].map((_, g) => {
      const ss = idx.reduce((s, j) => s + (z[g][j] - gStar[b][g]) ** 2, 0);
      return (0.5 * ss + bPrior) / (nB / 2 + aPrior - 1);
    }));
  }

  return X.map((row, g) => row.map((v, j) => {
    const b = batch[j];
    return ((z[g][j] - gStar[b][g]) / Math.sqrt(dStar[b][g])) * sd[g] + fitted[g][j];
  }));
}

/**
 * SVA's surrogate variable: the leading direction of the residuals after the
 * condition is removed. THE BATCH IS NEVER USED, which is the point — and it is
 * also why the result is orthogonal to the condition and cannot move its
 * coefficient.
 */
function surrogateVariable(sim) {
  const n = sim.X[0].length;
  const cols = [new Array(n).fill(1), sim.disease.map(Number)];
  return topDirection(residualsOn(sim.X, cols));
}

/** RUV's factor: the leading direction of the control genes, whatever they are. */
function unwantedVariable(sim, opts) {
  const set = CONTROL_SETS[opts?.controls] ?? CONTROL_SETS.housekeeping;
  return topDirection(set.genes().map((g) => sim.X[g]));
}

/** Leading sample-space direction of a genes x samples matrix, genes centred. */
function topDirection(X) {
  const n = X[0].length;
  const C = X.map((row) => { const m = mean(row); return row.map((v) => v - m); });
  let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
  for (let it = 0; it < 300; it += 1) {
    const t = C.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
    const w = Array.from({ length: n }, (_, j) => C.reduce((s, row, g) => s + row[j] * t[g], 0));
    const nrm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
    v = w.map((x) => x / nrm);
  }
  return v;
}

/** How far a sample-space direction lines up with a split, |correlation|. */
export function alignment(v, flags) {
  const x = flags.map(Number);
  const mv = mean(v);
  const mx = mean(x);
  const num = v.reduce((s, a, i) => s + (a - mv) * (x[i] - mx), 0);
  const dv = Math.sqrt(v.reduce((s, a) => s + (a - mv) ** 2, 0));
  const dx = Math.sqrt(x.reduce((s, a) => s + (a - mx) ** 2, 0));
  return Math.abs(num / (dv * dx || 1));
}

/** The variable a method estimated, for the widget to draw against the truth. */
export function estimatedVariable(sim, key, opts) {
  if (key === "sva") return surrogateVariable(sim);
  if (key === "ruv") return unwantedVariable(sim, opts);
  return null;
}

/* --- what the reader is meant to read off it ------------------------------ */

/**
 * The per-gene estimate AND its uncertainty, tested the way that method's own
 * workflow tests it.
 *
 * A method that edits the DATA is followed by a two-group comparison on the
 * edited values, and the comparison has no idea a correction happened — so its
 * interval stays narrow while the estimate moves. A method that supplies a
 * COVARIATE is fitted with that column in the model, and pays for it honestly
 * in the standard error. That difference is the point rather than a shortcut.
 *
 * The averaging is over a gene RANGE, so the interval is the one a single
 * gene's estimate carries. A gene is what gets tested in a real analysis, and
 * the interval of the mean of 25 would hide the whole story.
 */
export function estimateWithSE(sim, key, opts) {
  return estimateOver(sim, key, 0, AFFECTED, opts);
}

/** The same over the genes that carry NO effect — a false-positive check. */
export function nullWithSE(sim, key, opts) {
  return estimateOver(sim, key, AFFECTED, GENES, opts);
}

function estimateOver(sim, key, from, to, opts) {
  const method = METHODS[key];
  const n = sim.X[0].length;
  const covar = method.covar ? method.covar(sim, opts) : [];
  /* A method with a covariate is fitted on the RAW data with that column in the
     design — which is the honest way to spend the information. Everything else
     is tested on the matrix it produced, and pays for that in a narrow interval
     the test does not know it should widen. */
  const X = covar.length ? sim.X : method.data(sim, opts);
  const cols = [new Array(n).fill(1), sim.disease.map(Number), ...covar];

  const bs = [];
  const ses = [];
  for (let g = from; g < to; g += 1) {
    const r = fitWithSE(cols, X[g]);
    if (!r) continue;
    bs.push(r.beta[1]);
    ses.push(r.se[1]);
  }
  if (!bs.length) return { beta: NaN, se: NaN, lo: NaN, hi: NaN };
  const beta = mean(bs);
  const se = mean(ses);
  return { beta, se, lo: beta - 1.96 * se, hi: beta + 1.96 * se };
}

/**
 * Least squares returning every coefficient and its standard error.
 *
 * Gauss-Jordan on [X'X | X'y | I] in one pass, so the inverse the standard
 * errors need comes out of the same elimination as the fit. Returns null on a
 * singular design, which is what complete confounding is — the caller prints
 * "not estimable" rather than a number from a ridge.
 */
function fitWithSE(cols, y) {
  const k = cols.length;
  const n = y.length;
  const A = cols.map((u) => cols.map((v) => u.reduce((s, x, i) => s + x * v[i], 0)));
  const b = cols.map((u) => u.reduce((s, x, i) => s + x * y[i], 0));
  const M = A.map((r, i) => [...r, b[i], ...r.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c += 1) {
    let p = c;
    for (let r = c + 1; r < k; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-8) return null;
    const piv = M[c][c];
    for (let j = c; j < M[c].length; j += 1) M[c][j] /= piv;
    for (let r = 0; r < k; r += 1) {
      if (r === c) continue;
      const t = M[r][c];
      for (let j = c; j < M[r].length; j += 1) M[r][j] -= t * M[c][j];
    }
  }
  const beta = M.map((r) => r[k]);
  const resid = y.map((v, i) => v - cols.reduce((s, u, a) => s + u[i] * beta[a], 0));
  const s2 = resid.reduce((s, r) => s + r * r, 0) / (n - k);
  return { beta, se: beta.map((_, a) => Math.sqrt(s2 * M[a][k + 1 + a])) };
}

/** Coefficients only, or null on a singular design. */
function ols(cols, y) {
  const r = fitWithSE(cols, y);
  return r ? r.beta : null;
}

/** PCA of the samples: centre each gene, then power-iterate the sample
    covariance. Returns the first two scores per sample and their variance
    shares. Small enough (40 x 40) that this is instant. */
export function pca(X) {
  const n = X[0].length;
  const centred = X.map((row) => {
    const m = mean(row);
    return row.map((v) => v - m);
  });
  const C = Array.from({ length: n }, (_, a) =>
    Array.from({ length: n }, (_, b) =>
      centred.reduce((s, row) => s + row[a] * row[b], 0) / (X.length - 1)));

  const total = C.reduce((s, r, i) => s + r[i], 0);
  const comps = [];
  const work = C.map((r) => r.slice());
  for (let k = 0; k < 2; k += 1) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i + k + 1));
    let lam = 0;
    for (let it = 0; it < 500; it += 1) {
      const w = work.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
      lam = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
      v = w.map((x) => x / lam);
    }
    comps.push({ vec: v, lambda: lam });
    for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) work[a][b] -= lam * v[a] * v[b];
  }
  return {
    scores: Array.from({ length: n }, (_, j) =>
      [comps[0].vec[j] * Math.sqrt(comps[0].lambda), comps[1].vec[j] * Math.sqrt(comps[1].lambda)]),
    share: comps.map((c) => c.lambda / total),
  };
}

/**
 * The gene-space directions of a PCA's first two components, so other tables
 * can be projected onto the same axes.
 */
export function loadings(X, scores) {
  const centred = X.map((row) => {
    const m = mean(row);
    return row.map((v) => v - m);
  });
  return [0, 1].map((k) => {
    const w = centred.map((row) => row.reduce((s, v, j) => s + v * scores[j][k], 0));
    const norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1;
    return w.map((v) => v / norm);
  });
}

/** Sample coordinates of `X` on a fixed pair of gene-space directions. */
export function project(X, basis) {
  const n = X[0].length;
  const centred = X.map((row) => {
    const m = mean(row);
    return row.map((v) => v - m);
  });
  return Array.from({ length: n }, (_, j) =>
    basis.map((vec) => centred.reduce((s, row, g) => s + row[j] * vec[g], 0)));
}

/**
 * Every correction on ONE set of axes — the uncorrected data's.
 *
 * Refitting the PCA per correction rotates the axes rather than merely flipping
 * them: correlation between the uncorrected and corrected scores runs 0.213 /
 * 0.167 / 0.133 on PC1 across overlap 0 / 0.5 / 0.75. Removing the batch removes
 * the dominant direction, so PC1 becomes a different thing and any motion
 * between two such states is about the axes rather than the data. Principle 2.5
 * one level up: a basis refitted per state hides the collapse that is the point.
 *
 * On the fixed basis the story is sharper anyway. At overlap 0, separation along
 * PC1 goes from 7.694 by batch and 0.446 by condition to 0.000 and 3.504 — the
 * batch separation collapses to exactly zero and the condition emerges on the
 * same axis.
 *
 * It departs from the notebook, which runs `prcomp` on the corrected data each
 * time, so the axis has to be labelled "of the uncorrected data".
 */
export function projectOnto(sim, mats) {
  const raw = pca(sim.X);
  const basis = loadings(sim.X, raw.scores);
  const out = {};
  for (const key of Object.keys(mats)) out[key] = project(mats[key], basis);
  return { points: out, share: raw.share };
}

/**
 * Is the disease effect estimable at all? Batch and condition are collinear the
 * moment one cell of their 2 x 2 is empty, and then no model can separate them.
 * Measured: only overlap = 1 reaches that; at 0.90 one sample still sits in each
 * cell and the estimate holds.
 */
export function design(sim) {
  const cell = (b, d) => sim.batch.filter((x, j) => x === b && sim.disease[j] === d).length;
  const cells = [[cell(0, false), cell(0, true)], [cell(1, false), cell(1, true)]];
  return { cells, smallest: Math.min(...cells.flat()), estimable: Math.min(...cells.flat()) > 0 };
}

/** How well a split is separated along one axis: the difference in group means
    over the pooled sd. 0 is no separation. */
export function separation(values, flags) {
  const a = values.filter((_, i) => flags[i]);
  const b = values.filter((_, i) => !flags[i]);
  if (!a.length || !b.length) return NaN;
  const sd = (x) => { const m = mean(x); return Math.sqrt(mean(x.map((v) => (v - m) ** 2))); };
  const pooled = Math.sqrt((sd(a) ** 2 + sd(b) ** 2) / 2) || 1;
  return Math.abs(mean(a) - mean(b)) / pooled;
}
