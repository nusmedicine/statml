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

  /* CELL 7, AND IT IS AN ORACLE. The notebook subtracts `batch_effect_size`
     itself — "we know what the batch effect was and thus could correct for it".
     That is information the data does not contain, which is why it is the only
     correction that still works when the design is fully confounded: at overlap
     1 it returns 0.771 while every estimable method has nothing to work with.
     Its job here is to show that cell 7's success is borrowed. */
  known: { label: "Ground truth", fn: withoutBatch },

  remove: {
    label: "Remove the batch from the data",
    fn: ({ X, batch }) => X.map((row) => {
      const m = [0, 1].map((b) => mean(row.filter((_, j) => batch[j] === b)));
      return row.map((v, j) => v - m[batch[j]]);
    }),
  },

  /* IT DOES NOT TOUCH THE MATRIX, and that is its defining property rather
     than an omission. A covariate changes the MODEL: the batch gets a column
     in the design and the condition coefficient is read off the same fit.

     This used to residualise each gene on the fitted batch term, purely so
     that a scatter would have something to draw — a model-based method dressed
     as a data transformation, which is the conflation that split this slot in
     two. `estimateWithSE` reads the raw gene and fits `y ~ condition + batch`,
     so nothing is lost: the estimate is identical (Frisch-Waugh-Lovell), and
     the picture is now honest.

     What that buys the correction page is its sharpest comparison. At strong
     confounding `remove` shows a perfect picture — batch separation exactly
     0.00 — and reports 0.42 for an effect of 0.80. `covariate` leaves the
     picture at 10.58, untouched and ugly, and reports 0.83. The method with
     the best picture gives the worst answer. */
  covariate: { label: "Batch as a covariate", fn: ({ X }) => X },
};

export const correct = (sim, key) => CORRECTIONS[key].fn(sim);

/**
 * The same samples without the batch shift — what the study would have
 * measured if every sample had gone through one run.
 *
 * ONE DEFINITION, TWO NAMES, and the names are the point. On the batch-effect
 * page this is GROUND TRUTH: a thing only a simulation can hand you. On the
 * correction page the identical arithmetic is `CORRECTIONS.known`, an oracle
 * offered as a method so that its success can be shown to be borrowed. Writing
 * it twice is how the two pages would come to disagree.
 */
export function withoutBatch({ X, batch, shift }) {
  return X.map((row) => row.map((v, j) => v - (batch[j] === 1 ? shift : 0)));
}

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

/**
 * The per-gene estimate AND its uncertainty, which is what separates two
 * corrections that a point estimate makes look equally good.
 *
 * Each correction is tested the way a reader would test it: the ones that
 * change the DATA are followed by a two-group comparison on the corrected
 * values, and `covariate` is the coefficient of `condition` in
 * `y ~ condition + batch` on the raw values. So the interval a reader sees is
 * the interval their own workflow would report.
 *
 * That is the point rather than a shortcut. `remove` subtracts each batch's
 * mean and the t-test that follows has no idea a correction happened, so it
 * reports a NARROW interval around a shifted estimate — confidently wrong.
 * `covariate` spends the same information inside the model, so its interval
 * WIDENS instead. Measured at overlap 0.9, batch shift 2, five seeds:
 *
 *     none        2.590  +/- 0.677   [ 1.91, 3.27]   misses the truth
 *     known       0.790  +/- 0.624   [ 0.17, 1.41]
 *     remove      0.166  +/- 0.631   [-0.47, 0.80]   misses the truth
 *     covariate   0.874  +/- 1.428   [-0.55, 2.30]   covers it, and says nothing
 *
 * The averaging is over the 25 genes that carry an effect, so the interval is
 * the one a SINGLE gene's estimate carries, not the interval of their mean.
 * A gene is what gets tested in a real analysis, and the mean of 25 would have
 * an interval small enough to hide the whole story.
 */
export function estimateWithSE(sim, key) {
  return estimateOver(sim, key, 0, AFFECTED);
}

/**
 * The same, over the genes that carry NO effect — a false-positive check that
 * should sit at 0 whatever the method does.
 *
 * IT HAS TO GO THROUGH THE SAME FIT, and getting that wrong shipped a lie for
 * one state: `nullEffect` took a two-group difference off the matrix, which for
 * `covariate` is the UNCORRECTED matrix, so the widget reported 1.49 on genes
 * with no effect for a method whose own model reports 0.04. Two estimators, one
 * tile each, disagreeing about which method they described.
 */
export function nullWithSE(sim, key) {
  return estimateOver(sim, key, AFFECTED, GENES);
}

/** One fit, one gene range. Both tiles read this and nothing else. */
function estimateOver(sim, key, from, to) {
  const X = correct(sim, key);
  const withBatch = key === "covariate";
  const n = SAMPLES;
  const cols = [
    new Array(n).fill(1),
    sim.disease.map(Number),
    ...(withBatch ? [sim.batch.map(Number)] : []),
  ];
  const bs = [];
  const ses = [];
  for (let g = from; g < to; g += 1) {
    /* The covariate fit reads the RAW gene: its whole claim is that the batch
       is handled inside the model rather than taken out of the data first. */
    const r = ols(cols, withBatch ? sim.X[g] : X[g]);
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
 * Least squares for a design of two or three columns, returning each
 * coefficient and its standard error. Small and explicit rather than general:
 * the inverse is needed for the standard errors, and at this size a cofactor
 * inverse is clearer than a factorisation.
 *
 * Returns null on a singular design, which is what full confounding is — the
 * caller prints "not estimable" rather than a number from a ridge.
 */
function ols(cols, y) {
  const k = cols.length;
  const n = y.length;
  const A = cols.map((u) => cols.map((v) => u.reduce((s, x, i) => s + x * v[i], 0)));
  const b = cols.map((u) => u.reduce((s, x, i) => s + x * y[i], 0));
  const inv = invert(A);
  if (!inv) return null;
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  const resid = y.map((v, i) => v - cols.reduce((s, u, a) => s + u[i] * beta[a], 0));
  const s2 = resid.reduce((s, r) => s + r * r, 0) / (n - k);
  return { beta, se: beta.map((_, a) => Math.sqrt(s2 * inv[a][a])) };
}

/** Cofactor inverse of a 2x2 or 3x3, or null if it is singular. */
function invert(A) {
  const k = A.length;
  if (k === 2) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(det) < 1e-8) return null;
    return [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
  }
  const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
    - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
    + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  if (Math.abs(det) < 1e-8) return null;
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => {
    const sub = [0, 1, 2].filter((a) => a !== j).map((a) =>
      [0, 1, 2].filter((c) => c !== i).map((c) => A[a][c]));
    const c = sub[0][0] * sub[1][1] - sub[0][1] * sub[1][0];
    return ((i + j) % 2 ? -c : c) / det;
  }));
}

/**
 * The same over the 25 genes that carry NO effect, as a plain two-group
 * difference on whatever matrix it is handed.
 *
 * NOT WHAT A WIDGET SHOULD PRINT beside a model's estimate: for `covariate` the
 * matrix is the uncorrected one, so this returns 1.488 where the covariate
 * model itself reports 0.087. `nullWithSE` goes through the same fit as the
 * effect tile and is what the figures read. This one stays because the lab
 * pages describe the DATA rather than a model.
 */
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
export function projectOnto(sim, mats) {
  const raw = pca(sim.X);
  const basis = loadings(sim.X, raw.scores);
  const out = {};
  for (const key of Object.keys(mats)) out[key] = project(mats[key], basis);
  return { points: out, share: raw.share };
}

/** Every correction on the observed data's axes — the correction page's door. */
export function projectAll(sim) {
  const mats = {};
  for (const key of Object.keys(CORRECTIONS)) mats[key] = correct(sim, key);
  return projectOnto(sim, mats);
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
