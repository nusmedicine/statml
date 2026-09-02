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

  return { X, batch, disease };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/* --- corrections ---------------------------------------------------------- *
 * The two things anyone actually does with a known batch, in the notebook's own
 * order:
 *
 * `remove`     take the batch out of the DATA — subtract each batch's own mean,
 *              per gene. This is `ComBat(dat, batch, mod = NULL)`, which cell 12
 *              runs, and cell 7's "simple batch correction" estimated from the
 *              data rather than from knowing the answer.
 * `covariate`  leave the data alone and put batch in the MODEL — estimate the
 *              condition effect from `y ~ condition + batch`. Equivalent to
 *              `ComBat(mod = model.matrix(~ condition))`, and the form the
 *              notebook's SVA and RUV sections teach: "the identified surrogate
 *              variables are included in statistical models for downstream
 *              analyses".
 *
 * Implemented by residualising on the batch term, which gives the coefficient
 * `lm(y ~ condition + batch)` reports — Frisch-Waugh-Lovell, and verified: the
 * two agree at 0.847 / 0.826 / 0.868 / 0.874 across overlap 0.25 to 0.90.
 * -------------------------------------------------------------------------- */
export const CORRECTIONS = {
  none: { label: "None", fn: ({ X }) => X },

  remove: {
    label: "Remove the batch from the data",
    fn: ({ X, batch }) => X.map((row) => {
      const m = [0, 1].map((b) => mean(row.filter((_, j) => batch[j] === b)));
      return row.map((v, j) => v - m[batch[j]]);
    }),
  },

  covariate: {
    label: "Batch as a covariate",
    fn: ({ X, batch, disease }) => X.map((row) => {
      /* Least squares on [intercept, batch, condition], removing only the batch
         term. Residualising this way returns the coefficient `lm(y ~ condition
         + batch)` reports, so the data the panel draws and the estimate the
         tile prints come from one fit rather than two.

         With batch and condition collinear the design is singular, which is
         what full confounding means; the ridge keeps the arithmetic finite and
         `design()` is what tells the widget not to print the result. */
      const n = row.length;
      const b = batch.map(Number);
      const c = disease.map(Number);
      const cols = [new Array(n).fill(1), b, c];
      const XtX = cols.map((u) => cols.map((v) => u.reduce((s, x, i) => s + x * v[i], 0)));
      const Xty = cols.map((u) => u.reduce((s, x, i) => s + x * row[i], 0));
      const beta = solve3(XtX, Xty, 1e-8);
      return row.map((v, j) => v - beta[1] * b[j]);
    }),
  },
};

/** 3x3 solve with a ridge, so a singular design returns something finite. */
function solve3(A, y, ridge) {
  const M = A.map((r, i) => r.map((v, j) => v + (i === j ? ridge : 0)).concat(y[i]));
  for (let c = 0; c < 3; c += 1) {
    let p = c;
    for (let r = c + 1; r < 3; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r = 0; r < 3; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  return [0, 1, 2].map((i) => (Math.abs(M[i][i]) < 1e-12 ? 0 : M[i][3] / M[i][i]));
}

export const correct = (sim, key) => CORRECTIONS[key].fn(sim);

/* --- what the reader is meant to read off it ------------------------------ */

/** The estimated disease effect: mean(disease) - mean(healthy) over the 25
    genes that carry one. The truth is `effect`, 0.8 by default. */
export function estimatedEffect(X, disease) {
  const d = [];
  for (let g = 0; g < AFFECTED; g += 1) {
    const yes = X[g].filter((_, j) => disease[j]);
    const no = X[g].filter((_, j) => !disease[j]);
    d.push(mean(yes) - mean(no));
  }
  return mean(d);
}

/** The same over the 25 genes that carry NO effect — a false-positive check.
    It should sit at 0 whatever the correction does. */
export function nullEffect(X, disease) {
  const d = [];
  for (let g = AFFECTED; g < GENES; g += 1) {
    const yes = X[g].filter((_, j) => disease[j]);
    const no = X[g].filter((_, j) => !disease[j]);
    d.push(mean(yes) - mean(no));
  }
  return mean(d);
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
export function projectAll(sim) {
  const raw = pca(sim.X);
  const basis = loadings(sim.X, raw.scores);
  const out = {};
  for (const key of Object.keys(CORRECTIONS)) out[key] = project(correct(sim, key), basis);
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
