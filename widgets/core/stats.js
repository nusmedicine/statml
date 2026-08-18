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
export const EFFECT_SD = { none: 0, small: 0.4, moderate: 0.9, large: 1.3 };

export const POPULATIONS = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([key, p]) => [
    key,
    { ...p, domain: [p.mean - p.halfWidth, p.mean + p.halfWidth] },
  ])
);
