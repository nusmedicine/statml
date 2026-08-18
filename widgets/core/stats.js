/* ============================================================================
   Statistics helpers and a registry of teaching populations.

   POPULATIONS is shared vocabulary across widgets: the same named population
   ("Exponential", "Bimodal") behaves identically in the CLT widget, the
   bootstrap widget, and the estimator-bias widget. Students recognise the
   shape when they meet it again, which is most of the point.

   Each population declares:
     label      — display name
     sample     — (rng) => one draw
     pdf        — (x) => density, for the population panel overlay
     mean       — population mean, mu
     sd         — population standard deviation, sigma
     halfWidth  — plotting window half-width, so the window is mu +/- halfWidth

   WHY halfWidth AND NOT domain: every plotting window is centred on mu by
   construction. Any figure that stacks a population against a distribution of
   its sample means wants mu at the same pixel position in both panels, so that
   one vertical reference line reads across the whole figure. Declaring a
   half-width instead of a [lo, hi] pair makes an off-centre window
   unrepresentable rather than merely discouraged.

   The price is dead space to the left of a skewed population's support — an
   exponential is plotted on [-2.2, 4.2] with nothing below zero. That is a fair
   trade: it also puts mu visibly to the right of the mode, which is exactly the
   thing about skewed distributions that students need to see.
   ========================================================================= */

export const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normalPdf(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
}

export function mean(xs) {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n - 1 denominator). */
export function sd(xs) {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (n - 1));
}

/** Bin values into `count` equal-width bins over `domain`. */
export function histogram(values, domain, count) {
  const [lo, hi] = domain;
  const width = (hi - lo) / count;
  const counts = new Array(count).fill(0);
  for (const v of values) {
    if (v < lo || v > hi) continue;
    let i = Math.floor((v - lo) / width);
    if (i === count) i = count - 1; // right edge falls in the last bin
    if (i >= 0 && i < count) counts[i] += 1;
  }
  return { counts, width, lo, hi, n: values.length };
}

/** Round to a fixed number of significant-ish decimals for display. */
export function fmt(x, digits = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

/* --- two populations from the domain the courses teach ------------------- *
 * A population earns a slot by the SHAPE-lesson it carries, not by being a
 * familiar name — otherwise the dropdown grows and the teaching does not. These
 * two each carry something no other entry here has:
 *
 *   Counts        MEAN AND VARIANCE ARE COUPLED. var = mu + mu^2/k, so "more
 *                 expression" mechanically means "more variance". Every other
 *                 population lets you set spread independently of centre, which
 *                 is exactly the intuition count data breaks.
 *   Proportion    BOUNDED SUPPORT. On [0, 1] a symmetric interval can run past a
 *                 boundary, so x-bar +/- 1.96 s/sqrt(n) at small n produces
 *                 intervals containing -0.04 of a cell. Nothing dramatises "an
 *                 interval is what a procedure emitted, not a range of plausible
 *                 values" better than an impossible one.
 *
 * Zero-inflation was considered and deliberately left out: its lesson is that it
 * is a MIXTURE, which is structure, and a backdrop population contributes only a
 * silhouette. As a silhouette it is near-indistinguishable from these counts. It
 * deserves to be a widget's subject, not a dropdown entry.
 */

/** Negative-binomial masses, truncated and renormalised so they sum to 1.
    The declared mean and sd are computed FROM this table rather than from the
    textbook formula, because the table is what gets sampled — check.mjs compares
    the two, and a truncated tail would otherwise make them disagree. */
function negBinomialMasses(mu, size, kMax) {
  const p = size / (size + mu);
  const raw = [];
  for (let k = 0; k <= kMax; k += 1) {
    raw.push(Math.exp(
      lgamma(k + size) - lgamma(size) - lgamma(k + 1) +
      size * Math.log(p) + k * Math.log(1 - p)
    ));
  }
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v, k) => [k, v / total]);
}

const NB_MU = 3;
const NB_SIZE = 1.5;   // var = 3 + 9/1.5 = 9, so sd = mu: strongly overdispersed
const NB_MAX = 15;     // about mu + 4 sd; beyond here the mass is under 0.1%
const NB_MASSES = negBinomialMasses(NB_MU, NB_SIZE, NB_MAX);
const NB_MEAN = NB_MASSES.reduce((s, [k, q]) => s + k * q, 0);
const NB_SD = Math.sqrt(NB_MASSES.reduce((s, [k, q]) => s + q * (k - NB_MEAN) ** 2, 0));

/** Inverse-CDF draw from exactly the table above, so a sample cannot drift from
    the declared mean the way an untruncated sampler would. */
function sampleNegBinomial(rng) {
  const u = rng.next();
  let acc = 0;
  for (const [k, q] of NB_MASSES) {
    acc += q;
    if (u < acc) return k;
  }
  return NB_MASSES[NB_MASSES.length - 1][0];
}

const BETA_A = 2;
const BETA_B = 5;
const BETA_MEAN = BETA_A / (BETA_A + BETA_B);
const BETA_SD = Math.sqrt(
  (BETA_A * BETA_B) / ((BETA_A + BETA_B) ** 2 * (BETA_A + BETA_B + 1))
);
const BETA_LOG_NORM = lgamma(BETA_A + BETA_B) - lgamma(BETA_A) - lgamma(BETA_B);

/* Exact for integer a and b, and it needs nothing but rng.next(): the k-th
   smallest of n uniforms is distributed Beta(k, n + 1 - k), so the 2nd smallest
   of 6 is Beta(2, 5). No gamma sampler, no rejection loop, no new primitive. */
function sampleBeta(rng) {
  const u = Array.from({ length: BETA_A + BETA_B - 1 }, () => rng.next()).sort((x, y) => x - y);
  return u[BETA_A - 1];
}

const DEFINITIONS = {
  normal: {
    label: "Normal",
    mean: 0,
    sd: 1,
    halfWidth: 3.6,
    sample: (rng) => rng.normal(0, 1),
    pdf: (x) => normalPdf(x, 0, 1),
  },

  uniform: {
    label: "Uniform",
    mean: 0.5,
    sd: Math.sqrt(1 / 12),
    halfWidth: 0.65,
    sample: (rng) => rng.uniform(0, 1),
    pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0),
  },

  exponential: {
    label: "Exponential",
    mean: 1,
    sd: 1,
    halfWidth: 3.2, // reaches x = 4.2, where the density is 0.015
    sample: (rng) => rng.exponential(1),
    pdf: (x) => (x >= 0 ? Math.exp(-x) : 0),
  },

  // Equal mixture of N(-2, 0.45) and N(2, 0.45): visibly not normal, so the
  // sampling distribution going normal anyway is the striking part.
  bimodal: {
    label: "Bimodal",
    mean: 0,
    sd: Math.sqrt(4 + 0.45 * 0.45),
    halfWidth: 4.2,
    sample: (rng) => rng.normal(rng.next() < 0.5 ? -2 : 2, 0.45),
    pdf: (x) => 0.5 * normalPdf(x, -2, 0.45) + 0.5 * normalPdf(x, 2, 0.45),
  },

  // Pareto(alpha = 3): heavy right tail, finite mean and variance. The case
  // where convergence is real but visibly slow.
  pareto: {
    label: "Heavy-tailed",
    mean: 1.5,
    sd: Math.sqrt(3 / 4),
    halfWidth: 3.2, // reaches x = 4.7, where the density is 0.006
    sample: (rng) => Math.pow(1 - rng.next(), -1 / 3),
    pdf: (x) => (x >= 1 ? 3 * Math.pow(x, -4) : 0),
  },

  counts: {
    label: "Counts (neg. binomial)",
    mean: NB_MEAN,
    sd: NB_SD,
    /* mu-centred like every window, which here means a third of the panel sits
       below zero where a count cannot occur. That is the cost of the shared rule
       putting mu in the same pixel column across stacked panels, and the
       exponential already pays it. Recorded rather than worked around. */
    halfWidth: NB_MAX - NB_MEAN,
    sample: sampleNegBinomial,
    pdf: null,
    masses: NB_MASSES,
  },

  proportion: {
    label: "Proportion (beta)",
    mean: BETA_MEAN,
    sd: BETA_SD,
    /* Wide enough to reach 1 on the right, which puts the left edge well below
       zero — and here that emptiness EARNS its place: it is exactly where an
       impossible interval has to be visible for the lesson to land. */
    halfWidth: 1 - BETA_MEAN,
    sample: sampleBeta,
    pdf: (x) =>
      x <= 0 || x >= 1
        ? 0
        : Math.exp(BETA_LOG_NORM + (BETA_A - 1) * Math.log(x) + (BETA_B - 1) * Math.log(1 - x)),
  },

  // Discrete populations declare `masses` as [value, probability] pairs and no
  // pdf. Each mass is drawn at its own x, so nothing depends on the caller
  // guessing a bin layout.
  bernoulli: {
    label: "Coin flip",
    mean: 0.5,
    sd: 0.5,
    halfWidth: 0.85,
    sample: (rng) => rng.bernoulli(0.5),
    pdf: null,
    masses: [
      [0, 0.5],
      [1, 0.5],
    ],
  },
};

/** Derive the mu-centred plotting window, so it cannot be declared off-centre. */
/* The effect ladder, in population SDs. Shared because widgets 4 and 5 must be
   describing the SAME effects — an interval around a "Moderate" difference and a
   p-value for a "Moderate" difference are two readings of one experiment, and if
   the two widgets disagreed about what Moderate meant the arc would quietly stop
   being one continuous argument.

   The multiples were measured for widget 5, not guessed: 0.9 for Moderate rather
   than 0.8 because 0.8 puts the default seed on p = 0.055, exactly on the
   threshold. Widget 5's commentary carries the rest. In SDs rather than raw units
   so "Small" means the same thing whichever population is chosen. Each widget
   writes its own detail strings — the multiples are shared, the teaching is not. */
/* --- Student's t ---------------------------------------------------------- *
 * Widget 4 needs the 0.975 critical value and the density, for every n between
 * 3 and 40. A lookup table would be 38 numbers typed from memory with no way to
 * tell a wrong digit from a right one; this is computed, and check.mjs asserts
 * it against published values, so a transcription error cannot survive.
 *
 * Lanczos log-gamma, then the regularised incomplete beta by continued fraction,
 * which is what the t CDF is written in terms of. Standard numerical recipes.
 */
function lgamma(z) {
  const C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  const zz = z - 1;
  let x = C[0];
  for (let i = 1; i < 9; i += 1) x += C[i] / (zz + i);
  const w = zz + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(w) - w + Math.log(x);
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
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betacf(a, b, x)) / a
    : 1 - (front * betacf(b, a, 1 - x)) / b;
}

/** Density of Student's t with `df` degrees of freedom. */
export function studentTPdf(x, df) {
  const logC = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(logC - ((df + 1) / 2) * Math.log(1 + (x * x) / df));
}

/**
 * The two-sided critical value: P(|T| <= tCritical(df)) = conf.
 * This is the number a t interval multiplies s/sqrt(n) by, and the whole reason
 * a t interval is wider than a z interval at small n.
 */
export function tCritical(df, conf = 0.95) {
  if (!(df > 0)) return Infinity;
  const target = 1 - conf; // mass left in the two tails
  // P(|T| > t) = I_{df/(df+t^2)}(df/2, 1/2), decreasing in t.
  const tail = (v) => incompleteBeta(df / 2, 0.5, df / (df + v * v));
  let lo = 0;
  let hi = 400;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (tail(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Two-sided p-value for a t statistic: P(|T| > tObs) with `df` degrees of
 * freedom. This is the same tail expression tCritical inverts, so the critical
 * value and the p-value can never disagree about what the t distribution is.
 */
export function tTailP(tObs, df) {
  if (!(df > 0)) return 1;
  return incompleteBeta(df / 2, 0.5, df / (df + tObs * tObs));
}

/** The normal analogue, fixed: P(|Z| <= 1.959964) = 0.95. */
export const Z_CRITICAL_95 = 1.959963984540054;

export const EFFECT_SD = { none: 0, small: 0.4, moderate: 0.9, large: 1.3 };

export const POPULATIONS = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([key, p]) => [
    key,
    { ...p, domain: [p.mean - p.halfWidth, p.mean + p.halfWidth] },
  ])
);
