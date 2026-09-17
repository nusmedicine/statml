/* The engine and stage behind slot 69 `driver-genes`, for the lab:
 * `_lab/driver-genes-measure.mjs` and `_lab/driver-genes-mock.html` both
 * import this file.
 *
 * SINCE THE WIDGET EXISTS, THE ENGINE IS THE WIDGET'S. Everything the widget
 * draws is re-exported from `widgets/driver-genes/model.js` (maftools'
 * `oncodrive` ported line for line, and the calibrated cohort), so the measure
 * checks the shipping code against maftools and the mock cannot draw a number
 * the page does not (5.8; vaf-model.js keeps the same arrangement for 67).
 *
 * What stays here is what only the lab needs: the repeated records the
 * lesson's MAF carries (his pick 1 left them out of the widget), the count
 * test the mock's §4 asked about (his pick 2 left it out), the lesson's own
 * scores the shapes are measured against, and the two names the scripts use
 * for core's generator.
 */
import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";
import * as W from "../driver-genes/model.js";

export {
  dbinom, threshold, clusterGene, BACKGROUND, upperTail, zOf, benjaminiHochberg,
  residuesOf, scoreGene, oncodriveTable, poisson, SHAPES, DRIVERS, GENOME, drawShaped, drawPassenger, drawGenome,
} from "../driver-genes/model.js";

/* The scripts were written against a function-style generator; core's is an
   object with `next` and `normal`, which is what the widget's model takes. */
export const mulberry32 = (seed) => makeRng(seed);
export const normal = (rng) => rng.normal();

/* The lesson's own scores for the drivers, counted once per tumor and two-base
   changes once (§3), which each simulated shape is measured against in §5. */
export const LESSON_SCORES = { PIK3CA: 0.799, AKT1: 0.923, KRAS: 0.833, TP53: 0.556, CDH1: 0.345, GATA3: 0.596, MAP3K1: 0.253, PTEN: 0.501, NF1: null };

/* The chance each mutation is recorded twice when the cohort keeps repeats as
   the MAF lists them: fitted in §4 so the passenger genome tests about as many
   genes as the file does as listed (799). */
export const REPEAT_RATE = 0.0105;

/** The same cohort with repeated records: each mutation recorded a second time
    with chance `rate`, on its own stream, so every other draw is unchanged and
    the two record options are one cohort read two ways. */
export function withRepeats(genes, rate, seed) {
  const rng = makeRng((seed * 2654435761) >>> 0);
  let added = 0;
  const out = genes.map((g) => {
    const mutations = [];
    for (const m of g.mutations) { mutations.push(m); if (rng.next() < rate) { mutations.push({ ...m, repeat: true }); added += 1; } }
    return { ...g, mutations };
  });
  out.totalMutations = genes.totalMutations + added;
  out.totalResidues = genes.totalResidues;
  return out;
}

/** A cohort, with the mock's record option. */
export function drawCohort(seed, { repeats = 0, ...rest } = {}) {
  const genes = W.drawCohort(seed, rest);
  return repeats > 0 ? withRepeats(genes, repeats, seed) : genes;
}

/* ---- a count test, for the mock's question only ---------------------------
   Not in the notebook, and not maftools' `pvalMethod = "poisson"` (two-sided,
   with the cluster count as a covariate). One-sided: is the gene's count above
   what its length predicts at the cohort's rate per residue? */
export function poissonUpper(k, lambda) {    // P(X >= k)
  if (k <= 0) return 1;
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i < k; i += 1) { term *= lambda / i; cdf += term; }
  if (cdf < 1 - 1e-9) return Math.max(0, 1 - cdf);
  let t = Math.exp(-lambda + k * Math.log(lambda) - lgamma(k + 1)), s = t;
  for (let i = k + 1; i < k + 4000; i += 1) { t *= lambda / i; s += t; if (t < s * 1e-15) break; }
  return s;
}
export function countTest(genes, { rate, minMut = 5 }) {
  const rows = genes.filter((g) => g.mutations.length >= minMut);
  for (const g of rows) { g.expected = rate * g.L; g.countP = poissonUpper(g.mutations.length, g.expected); }
  const f = W.benjaminiHochberg(rows.map((g) => g.countP));
  rows.forEach((g, i) => { g.countFdr = f[i]; g.countCalled = f[i] <= 0.05; });
  return rows;
}
