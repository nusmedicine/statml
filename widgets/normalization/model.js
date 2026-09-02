/* ============================================================================
   The engine behind widget 39, `normalization` (PHM5003 HTD `05 / 03`).

   The data and nothing about how it is drawn; `main.js` is the figure.
   `_lab/norm-measure.mjs`, `_lab/norm-verify.mjs` and `_lab/norm-mock.html`
   import this file rather than copying it.

   The generator reproduces the notebook's `simulate_data`:

       means <- runif(genes, 10, 100)
       disp  <- means / 100
       data  <- rnbinom(n = genes, mu = means, size = 1 / disp)

   with one addition, `spread` — see below.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { nbDraw } from "../core/stats.js";

/* ---------------------------------------------------------------------------
   The stage.

   `simulate_data` draws every sample from the same mean vector, so its ten
   samples are exchangeable and nothing on screen needs normalising. `spread`
   adds the per-sample multiplier that sequencing depth or injected sample
   amount produces, which is what a reference-based method removes.

   spread = 0 reproduces the notebook. Above 0, sample j is scaled by a factor
   spanning [1/(1+spread), 1+spread] across the samples.
   ------------------------------------------------------------------------ */
/**
 * Gamma variate, Marsaglia-Tsang, off the seeded stream. Rejection sampling, so
 * the number of draws varies — reproducible from one seed, but the stage changes
 * if this loop ever does.
 */
function gammaDraw(rng, shape, scale) {
  if (shape < 1) return gammaDraw(rng, shape + 1, scale) * rng.next() ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do { x = rng.normal(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/**
 * The stage is gamma, not counts. Three candidates, measured:
 *
 *   stage      raw skew   raw rho   quantile spread   rho after log1p
 *   rnbinom      3.201     0.950      1.50  fails         0.432
 *   log-normal   1.923     0.913      0.00               0.063  degenerate
 *   gamma        3.030     0.955      0.00                0.529
 *
 * The distribution panel is boxplots, so quantile normalisation's claim — every
 * sample's distribution is now identical — is checked by eye. Integer counts
 * fail it: 1000 genes hold only ~198 distinct values, so ties leave the medians
 * spanning 1.5. Averaging the tied blocks gets it to 0.997, and raising the
 * count scale does not help — `nbDraw` caps at k = 4000 and compute climbs
 * 53 ms -> 419 ms.
 *
 * Log-normal fixes the ties and makes the transform circular: log1p inverts the
 * generator, taking rho to 0.063, so "the log stabilises the variance" holds by
 * construction rather than by demonstration.
 *
 * Gamma is the negative binomial's mixing distribution — the same gamma-Poisson
 * model without the Poisson step. shape = 1/disp and scale = mu*disp give mean
 * mu and variance mu^3/100, the notebook's overdispersion term without its
 * Poisson part.
 *
 * `stage: "counts"` keeps the notebook's generator, for measurement.
 */
export function simulate({
  seed = 1,
  genes = 1000,
  samples = 10,
  spread = 0.5,
  stage = "gamma",
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
    means.map((mu) => {
      const m = d * mu;
      if (stage === "counts") return nbDraw(rng, 100 / mu, m);  // size = 1/disp
      if (stage === "lognorm") return m * Math.exp(rng.normal(0, 0.45));
      return gammaDraw(rng, 100 / mu, (m * mu) / 100);          // mean m, var m^2*mu/100
    }),
  );

  return { cols, means, depth };
}

/* ---------------------------------------------------------------------------
   Normalisation, applied before any transform. Everything here except
   `quantile` is affine, and an affine map cannot move a shape: measured,
   min-max and z-score leave the pooled skew unchanged to 7e-14.
   ------------------------------------------------------------------------ */
const flat = (cols) => cols.flat();
export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export const varOf = (a) => {
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};

export const NORMALIZE = {
  /* `affine` means one map over the whole table. Median normalisation is affine
     per sample and is not one map over the table, so it does move the pooled
     skew, 2.978 -> 3.014 — which is why on-screen copy says "scaling". */
  none: { label: "None", affine: true, fn: (cols) => cols },

  /* Reference-based, and the only method here that works per sample. The
     notebook introduces it for proteomics and metabolomics — "divide each peak
     by the median of all the peaks in the sample" — and it is the same idea as
     a library-size factor. */
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
     ties.method = "min". Ties matter: 1000 negative-binomial counts hold only
     ~190 distinct values per sample, so min-ranking leaves the sample medians
     spanning ~1.0 after normalising. On a continuous stage the spread is
     exactly 0 under either tie rule. */
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
   Transformation, applied after normalisation. A second table rather than one
   list of ten methods, because the misconception this widget targets is that
   the two are one operation (2.7).
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

/* --- the three readouts --------------------------------------------------- */
export function median(a) {
  const b = a.slice().sort((x, y) => x - y);
  const n = b.length;
  if (!n) return NaN;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

/**
 * One boxplot on `geom_boxplot`'s grammar: box at the quartiles, whiskers to
 * the furthest point within 1.5 x IQR, everything beyond drawn as a dot.
 *
 * It was p5..p95 whiskers with no outliers, which hid two things. Fitted to the
 * middle 90% of each state, min-max's axis topped out at 0.41 rather than 1;
 * and fitting each state to its own interquantile span rescaled the skew away,
 * so raw and log(1+y) drew near-identical pictures while the skew tile read
 * 3.03 against -0.06. With Tukey whiskers and a full-range axis the box is 6%
 * of the panel on raw and 19% after the log, and the outlier count moves
 * 683 -> 55.
 */
export function boxStats(values) {
  const v = values.filter(Number.isFinite);
  const [q1, med, q3] = quantiles(v, [0.25, 0.5, 0.75]);
  const w = 1.5 * (q3 - q1);
  let lo = Infinity;
  let hi = -Infinity;
  const out = [];
  for (const x of v) {
    if (x < q1 - w || x > q3 + w) { out.push(x); continue; }
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  if (lo === Infinity) { lo = q1; hi = q3; }
  return { lo, q1, med, q3, hi, out };
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

/** Pooled skew: did the shape move? An affine map cannot change it. */
export function skew(cols) {
  const a = flat(cols).filter(Number.isFinite);
  const m = mean(a);
  const s = Math.sqrt(varOf(a));
  return mean(a.map((x) => ((x - m) / s) ** 3));
}

/**
 * Are the samples on one scale? The spread of the sample medians, measured in
 * units of how spread the values themselves are.
 *
 * The denominator is the pooled IQR. It was the grand median, which is
 * invariant under a rescaling but not under a shift: z-score shifts by the mean
 * of a right-skewed table, dragging the grand median toward zero and inflating
 * the ratio, so raw and min-max read 0.717 while z-score read 1.299 — three
 * answers for three affine maps, none of which changes how unequal the samples
 * are.
 *
 * Range and IQR are both differences in the data's units, so their ratio
 * survives any affine map exactly. Raw, min-max and z-score now agree; median
 * and quantile normalisation take it to 0.
 */
export function sampleSpread(cols) {
  const kept = cols.map((c) => c.filter(Number.isFinite));
  const meds = kept.map(median);
  const range = Math.max(...meds) - Math.min(...meds);
  const all = kept.flat();
  const [q1, q3] = quantiles(all, [0.25, 0.75]);
  const iqr = q3 - q1;
  return { meds, range, iqr, relative: iqr > 1e-12 ? range / iqr : NaN };
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
 * Spearman ρ between each gene's mean and its variance: does the variance still
 * climb with the mean?
 *
 * Not the log–log slope of variance on mean, which fails twice: it is undefined
 * for 558 of 1000 genes after z-score, and reads 2.58 after log1p when the
 * relationship has gone. ρ is rank-based, so it is invariant under any affine
 * map and moves only when the map is not one.
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
