/* ============================================================================
   The engine behind widget-slot 1, `normalization` (PHM5003 HTD `05 / 03`).

   Lives in _lab/ until the widget exists, then MOVES to
   widgets/normalization/model.js and this file is deleted — the widget-22
   lesson, applied from the first line: the measurement script and the mock
   page IMPORT the shipping code, they never carry a second copy of it. Two
   copies of a formula is how the halves of a figure come to disagree.

   The generator reproduces the notebook's `simulate_data` exactly:

       means <- runif(genes, 10, 100)
       disp  <- means / 100
       data  <- rnbinom(n = genes, mu = means, size = 1 / disp)

   with one addition the notebook does not have and probably should — see
   `depth` below.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { nbDraw } from "../core/stats.js";

/* ---------------------------------------------------------------------------
   The stage.

   `spread` is the one thing here the notebook does not do, and it is the
   reason to look twice at its stage. `simulate_data` draws every sample from
   the SAME mean vector, so the ten samples are exchangeable: their boxplots
   already line up, and nothing on screen needs normalising. That makes the
   lesson's own figure a demonstration of methods on data that does not need
   them. A per-sample depth factor is what sequencing depth or injected sample
   amount actually looks like, and it is what a reference-based method exists
   to remove.

   spread = 0 reproduces the notebook exactly. Above 0, sample j's counts are
   scaled by a factor spanning [1/(1+spread), 1+spread] across the samples.
   ------------------------------------------------------------------------ */
export function simulate({
  seed = 1,
  genes = 1000,
  samples = 10,
  spread = 0,
  continuous = false,
} = {}) {
  const rng = makeRng(seed);
  const means = Array.from({ length: genes }, () => rng.uniform(10, 100));

  // Deterministic ladder rather than random factors: the reader is meant to
  // see a staircase of medians, not another thing that moved when the seed did.
  const depth = Array.from({ length: samples }, (_, j) => {
    if (spread <= 0) return 1;
    const t = samples === 1 ? 0.5 : j / (samples - 1);          // 0 … 1
    return (1 / (1 + spread)) * (1 - t) + (1 + spread) * t;
  });

  const cols = depth.map((d) =>
    means.map((mu) =>
      continuous
        // A log-normal stage with the same mean-variance climb, used to show
        // quantile normalisation collapsing the samples EXACTLY — on integer
        // counts, ties stop it (see `TIES` below).
        ? d * mu * Math.exp(rng.normal(0, 0.45))
        : nbDraw(rng, 100 / mu, d * mu)),               // size = 1/disp = 100/mu
  );

  return { cols, means, depth };
}

/* ---------------------------------------------------------------------------
   Normalisation — a map over the whole table, applied BEFORE any transform.

   Everything in this group except `quantile` is affine, and that is the whole
   lesson: an affine map cannot move a shape. Measured — min-max and z-score
   leave the pooled skew unchanged to 7e-14, which is float noise.
   ------------------------------------------------------------------------ */
const flat = (cols) => cols.flat();
export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export const varOf = (a) => {
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};

export const NORMALIZE = {
  /* `affine` means ONE affine map over the whole table, which is the property
     that makes the shape unmovable. Median normalisation is affine per sample
     and is NOT one map over the table — pooling ten differently-rescaled
     samples does move the pooled skew, 2.978 -> 3.014. Small, real, and the
     reason on-screen copy should say "scaling" rather than "affine". */
  none: { label: "None", affine: true, fn: (cols) => cols },

  /* Reference-based, and the only one here that is PER SAMPLE. The notebook
     names it under proteomics/metabolomics ("divide each peak by the median of
     all peaks in the sample"); it is the same idea as a library-size factor.
     It is the method whose job the notebook's own stage gives it nothing to
     do, because every sample there has the same depth. */
  median: {
    label: "Median (per sample)",
    affine: false,                      // per sample, not over the table
    fn: (cols) => {
      const grand = mean(cols.map(median));
      return cols.map((c) => {
        const m = median(c);
        return m === 0 ? c.slice() : c.map((v) => (v / m) * grand);
      });
    },
  },

  minmax: {
    label: "Min–max → [0, 1]",
    affine: true,
    fn: (cols) => {
      const a = flat(cols);
      const lo = Math.min(...a);
      const hi = Math.max(...a);
      const d = hi - lo || 1;
      return cols.map((c) => c.map((v) => (v - lo) / d));
    },
  },

  zscore: {
    label: "Z-score → mean 0, sd 1",
    affine: true,
    fn: (cols) => {
      const a = flat(cols);
      const m = mean(a);
      const s = Math.sqrt(varOf(a)) || 1;
      return cols.map((c) => c.map((v) => (v - m) / s));
    },
  },

  /* The notebook's `quantile_normalize_custom`, cell 17, including its
     ties.method = "min". TIES ARE NOT A DETAIL HERE: 1000 negative-binomial
     counts hold only ~190 distinct values per sample, so min-ranking leaves
     the sample medians still spanning ~1.0 after normalising — the one thing
     quantile normalisation exists to make identical. `ties: "average"` on a
     continuous stage collapses the spread to exactly 0. */
  quantile: {
    label: "Quantile",
    affine: false,
    fn: (cols, { ties = "min" } = {}) => {
      const n = cols[0].length;
      const sorted = cols.map((c) => c.slice().sort((x, y) => x - y));
      const refs = Array.from({ length: n }, (_, r) =>
        mean(sorted.map((s) => s[r])));

      return cols.map((c) => {
        const order = c.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
        const out = new Array(n);
        let i = 0;
        while (i < order.length) {
          let j = i;
          while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
          const val = ties === "average"
            ? mean(refs.slice(i, j + 1))
            : refs[i];                                   // ties.method = "min"
          for (let k = i; k <= j; k += 1) out[order[k][1]] = val;
          i = j + 1;
        }
        return out;
      });
    },
  },
};

/* ---------------------------------------------------------------------------
   Transformation — applied AFTER normalisation, and a different operation.

   Keeping these in a second table rather than one list of ten methods is the
   design claim itself: the misconception this slot targets is that scaling and
   transforming are one thing. Two controls in sequence say otherwise by their
   shape, before any caption does (principle 2.7).
   ------------------------------------------------------------------------ */
export const TRANSFORM = {
  none: { label: "None", fn: (v) => v },
  log1p: { label: "log(1 + y)", fn: (v) => Math.log1p(v) },
  // Box-Cox is undefined at or below zero, which is why it cannot follow
  // z-score — a real constraint the rail has to express somehow.
  boxcox: {
    label: "Box–Cox λ",
    fn: (v, lam) => (v > 0 ? (v ** lam - 1) / lam : NaN),
  },
};

export function apply(cols, { normalize = "none", transform = "none", lambda = 0.5, ties = "min" } = {}) {
  const n = NORMALIZE[normalize];
  if (!n) throw new Error(`unknown normalize: ${normalize}`);
  const t = TRANSFORM[transform];
  if (!t) throw new Error(`unknown transform: ${transform}`);
  const out = n.fn(cols, { ties });
  if (transform === "none") return out;
  return out.map((c) => c.map((v) => (transform === "boxcox" ? t.fn(v, lambda) : t.fn(v))));
}

/* ---------------------------------------------------------------------------
   The three readouts, one per question the two panels ask.
   ------------------------------------------------------------------------ */
export function median(a) {
  const b = a.slice().sort((x, y) => x - y);
  const n = b.length;
  if (!n) return NaN;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

export function quantiles(a, qs = [0.05, 0.25, 0.5, 0.75, 0.95]) {
  const b = a.slice().sort((x, y) => x - y);
  return qs.map((q) => {
    const h = (b.length - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return b[lo] + (b[hi] - b[lo]) * (h - lo);
  });
}

/** Pooled skew — "did the SHAPE move?" An affine map cannot change it. */
export function skew(cols) {
  const a = flat(cols).filter(Number.isFinite);
  const m = mean(a);
  const s = Math.sqrt(varOf(a));
  return mean(a.map((x) => ((x - m) / s) ** 3));
}

/** Are the samples on one scale? The spread of the sample medians, as a
    fraction of the grand median, so it survives a rescaling and can be
    compared across methods. */
export function sampleSpread(cols) {
  const meds = cols.map((c) => median(c.filter(Number.isFinite)));
  const grand = median(meds);
  const range = Math.max(...meds) - Math.min(...meds);
  return { meds, range, relative: Math.abs(grand) > 1e-12 ? range / Math.abs(grand) : NaN };
}

/** Per-gene mean and variance ACROSS samples — the second panel's points. */
export function meanVariance(cols) {
  const genes = cols[0].length;
  const pts = [];
  for (let g = 0; g < genes; g += 1) {
    const row = cols.map((c) => c[g]).filter(Number.isFinite);
    if (row.length < 2) continue;
    pts.push([mean(row), varOf(row)]);
  }
  return pts;
}

function rankOf(a) {                                    // average ranks, 1-based
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/**
 * Spearman ρ between each gene's mean and its variance — "does the variance
 * still climb with the mean?"
 *
 * THIS REPLACED THE OBVIOUS CHOICE, and the obvious choice was wrong twice
 * over. A log–log slope of variance on mean is undefined for 558 of 1000 genes
 * after z-score (most values go negative), and it reads 2.58 after log1p while
 * the relationship has already gone. ρ is rank-based, so it is provably
 * invariant under any affine map and moves only when the map is not one —
 * which is exactly the distinction the widget teaches.
 */
export function spearman(pts) {
  const rx = rankOf(pts.map((p) => p[0]));
  const ry = rankOf(pts.map((p) => p[1]));
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

/** Everything the readout tiles would print, from one table. */
export function summarise(cols) {
  const pts = meanVariance(cols);
  return {
    skew: skew(cols),
    rho: spearman(pts),
    spread: sampleSpread(cols),
    pts,
  };
}
