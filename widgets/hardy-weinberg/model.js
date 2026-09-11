/* ============================================================================
   Widget 56 · Hardy-Weinberg — the test, the samplers, the geometry, the copy.

   PHM5003 week 6 QC (the Hardy-Weinberg heading and the `--hwe 1e-6` filter).
   `main.js` draws what is here; nothing in this file touches the DOM.

   THE TEST AND THE FOUR SAMPLERS ARE MOVED VERBATIM from
   `_lab/hwe-measure.mjs`, comments and all — `erfc`, `chi1Tail`, `hweTest`,
   `chi1Crit`, `poolSample`, `dropoutSample`, `overcallSample`, `wahlundF`.
   That script's 28 checks are the survey the whole design was chosen from, and
   `_lab/hardy-weinberg-verify.mjs` pins the same numbers against these copies,
   so the widget and the survey cannot drift apart.

   TWO WAYS OF DRAWING A SAMPLE, and the reason there are two:

     - ONE INDIVIDUAL AT A TIME (`buildArrival`). The One-SNP page reveals the
       sample as it accumulates, so it needs the genotype of every individual
       in the order they arrive, and the running table after each. This is
       `poolSample`'s own loop with the table kept — the mock's `poolStream`,
       extended to the two miscalling sources, which apply their miscall to the
       individual as it arrives rather than to the finished table.

     - FROM COUNTS (`tableFor`). The Many-SNPs page builds 2,000 genotype
       tables at up to 50,000 individuals each. Per individual that is 200
       million draws, so a table is drawn as a multinomial over the three
       genotypes: an exact Bernoulli sum where the count is small enough for
       the normal approximation to be wrong, and a rounded, clamped normal
       above it. The exact samplers above are what the verify checks the fast
       ones against, at the same (n, p).

   χ² = n·F² EXACTLY, for any two-allele genotype table, which is why the
   threshold is a vertical line on the Many-SNPs histogram: a SNP is past the
   threshold when |F| > √(χ²crit / n) and never otherwise. The verify asserts
   the identity rather than trusting it.
   ========================================================================= */

/* ---- the test ------------------------------------------------------------ */

/* erfc, Numerical Recipes' Chebyshev fit, |error| < 1.2e-7 — enough for a
   P that is read on a log scale. */
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

/** Upper tail of χ² with 1 df: P(X > x) = erfc(√(x/2)). */
export const chi1Tail = (x) => erfc(Math.sqrt(x / 2));

/** The lesson's test on a genotype table [AA, Aa, aa]: p from the table,
    expected counts n·(p², 2pq, q²), χ² over the three cells, 1 df. */
export function hweTest(counts) {
  const [aa, ab, bb] = counts;
  const n = aa + ab + bb;
  const p = (2 * aa + ab) / (2 * n);
  const q = 1 - p;
  const exp = [n * p * p, 2 * n * p * q, n * q * q];
  let chi = 0;
  for (let i = 0; i < 3; i += 1) if (exp[i] > 0) chi += (counts[i] - exp[i]) ** 2 / exp[i];
  const F = exp[1] > 0 ? 1 - ab / exp[1] : 0;
  return { n, p, chi, P: chi1Tail(chi), F, exp };
}

/* the critical χ² at the lesson's thresholds, by bisection on the tail */
export function chi1Crit(alpha) {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (chi1Tail(mid) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---- the samplers the survey used, kept as the reference ----------------- */

/** n individuals drawn from k equal subpopulations, each in HWE at its own
    allele frequency; returns the pooled genotype table. */
export function poolSample(rng, n, ps) {
  const counts = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const p = ps[i % ps.length];
    const g = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0); // copies of A
    counts[2 - g] += 1; // [AA, Aa, aa]
  }
  return counts;
}

/** One population in HWE at p, then heterozygotes miscalled as a homozygote
    (either one, at random) with probability e — allele dropout. */
export function dropoutSample(rng, n, p, e) {
  const c = poolSample(rng, n, [p]);
  let moved = 0;
  for (let i = 0; i < c[1]; i += 1) if (rng.next() < e) moved += 1;
  c[1] -= moved;
  for (let i = 0; i < moved; i += 1) c[rng.next() < 0.5 ? 0 : 2] += 1;
  return c;
}

/** One population in HWE at p, then homozygotes miscalled as heterozygotes
    with probability e — the excess side. */
export function overcallSample(rng, n, p, e) {
  const c = poolSample(rng, n, [p]);
  for (const k of [0, 2]) {
    let moved = 0;
    for (let i = 0; i < c[k]; i += 1) if (rng.next() < e) moved += 1;
    c[k] -= moved;
    c[1] += moved;
  }
  return c;
}

/* analytic Wahlund F for equal-weight subpopulations */
export function wahlundF(ps) {
  const pbar = ps.reduce((a, b) => a + b, 0) / ps.length;
  const v = ps.reduce((a, b) => a + (b - pbar) ** 2, 0) / ps.length;
  return v / (pbar * (1 - pbar));
}

/* ---- drawing a table from counts ----------------------------------------- */

/* WHERE THE EXACT BRANCH ENDS. Below this the normal approximation is wrong in
   the shape that matters here — a count of 9 heterozygotes is not a normal
   deviate — and above it a Bernoulli sum is the only thing standing between
   2,000 SNPs at 50,000 individuals and 200 million draws. The second bound is
   on n rather than on the variance: a rare allele at 50,000 individuals has a
   small variance and a loop nobody can afford. */
const EXACT_VAR = 30;
const EXACT_N = 600;

/** A binomial count, exactly where that is cheap and by a rounded, clamped
    normal where it is not. Seeded throughout: the `rng` is the widget's. */
export function binomial(rng, n, p) {
  if (n <= 0) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return n;
  const v = n * p * (1 - p);
  if (v < EXACT_VAR && n <= EXACT_N) {
    let k = 0;
    for (let i = 0; i < n; i += 1) if (rng.next() < p) k += 1;
    return k;
  }
  return Math.max(0, Math.min(n, Math.round(rng.normal(n * p, Math.sqrt(v)))));
}

/** Three counts summing to n, as two successive binomials on the conditional
    probabilities — the third cell is what is left, so the table cannot fail to
    add up to the sample size. */
export function multinomial3(rng, n, probs) {
  const a = binomial(rng, n, probs[0]);
  const rest = 1 - probs[0];
  const b = rest > 1e-12 ? binomial(rng, n - a, Math.min(1, probs[1] / rest)) : 0;
  return [a, b, n - a - b];
}

/** The Hardy-Weinberg proportions at allele frequency p: [AA, Aa, aa]. */
export const hweProbs = (p) => [p * p, 2 * p * (1 - p), (1 - p) * (1 - p)];

/**
 * Two subpopulation frequencies a distance `gap` apart, half either side of
 * the mean.
 *
 * SHRUNK TO WHAT THE MEAN ALLOWS. A mean of 0.05 has no room for a difference
 * of 0.5, and the alternative to shrinking is a negative frequency, which is
 * not a population. The two points are drawn on the figure, so what the pair
 * actually is stays visible rather than being asserted by the control.
 */
export function subFreqs(p, gap) {
  const room = Math.max(0, 2 * Math.min(p, 1 - p) - 0.02);
  const g = Math.max(0, Math.min(gap, room));
  return [p - g / 2, p + g / 2];
}

/** One genotype table at the sample size, from counts. */
export function tableFor(rng, source, { p, subs, error, n }) {
  if (source === "pooled") {
    /* the same split the arrival makes: individual i goes to subpopulation
       i % 2, so the first takes the odd one when n is odd */
    const first = Math.ceil(n / 2);
    const a = multinomial3(rng, first, hweProbs(subs[0]));
    const b = multinomial3(rng, n - first, hweProbs(subs[1]));
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
  const c = multinomial3(rng, n, hweProbs(p));
  if (source === "heterozygotes") {
    const moved = binomial(rng, c[1], error);
    const toAA = binomial(rng, moved, 0.5);
    return [c[0] + toAA, c[1] - moved, c[2] + (moved - toAA)];
  }
  if (source === "homozygotes") {
    const m0 = binomial(rng, c[0], error);
    const m2 = binomial(rng, c[2], error);
    return [c[0] - m0, c[1] + m0 + m2, c[2] - m2];
  }
  return c;
}

/* ---- the One-SNP sample, one individual at a time ------------------------ */

/**
 * The sample as it arrives: the genotype of every individual in order, and the
 * running table after each.
 *
 * `poolSample`'s own loop with the table kept, so the last entry IS the
 * finished table and the walking point and the settled point cannot disagree
 * (5.8; the verify asserts it). The two miscalling sources apply their miscall
 * to the individual as it is called, which is what the figure shows happening;
 * the finished table has the same distribution as `dropoutSample` /
 * `overcallSample` on the same n, p and rate, which is what the verify checks.
 *
 * The running counts are three prefix arrays rather than a table per
 * individual: at 50,000 individuals the reveal needs the table at an arbitrary
 * k on every frame, and three Int32Arrays answer that in constant time.
 */
export function buildArrival(rng, cfg) {
  const { source, p, subs, error, n } = cfg;
  const order = new Uint8Array(n);
  const at = [new Int32Array(n + 1), new Int32Array(n + 1), new Int32Array(n + 1)];
  const run = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const pi = source === "pooled" ? subs[i % 2] : p;
    const g = (rng.next() < pi ? 1 : 0) + (rng.next() < pi ? 1 : 0); // copies of A
    let k = 2 - g; // [AA, Aa, aa]
    if (source === "heterozygotes" && k === 1 && rng.next() < error) {
      k = rng.next() < 0.5 ? 0 : 2;
    } else if (source === "homozygotes" && k !== 1 && rng.next() < error) {
      k = 1;
    }
    run[k] += 1;
    order[i] = k;
    at[0][i + 1] = run[0];
    at[1][i + 1] = run[1];
    at[2][i + 1] = run[2];
  }
  return { n, order, at, counts: [run[0], run[1], run[2]] };
}

/** The table after the first k individuals. */
export const countsAt = (arrival, k) => [arrival.at[0][k], arrival.at[1][k], arrival.at[2][k]];

/* ---- the Many-SNPs page -------------------------------------------------- */

export const SNP_COUNT = 2000;
/* Each SNP has its own allele frequency, uniform on this range: a genome is not
   2,000 copies of one frequency, and the deficit a difference produces depends
   on the mean it is a difference around. */
export const SNP_P_RANGE = [0.1, 0.9];
/* A half-normal has mean σ√(2/π), so this scale puts the AVERAGE difference at
   the control's own value and gives the rest a spread around it. */
const HALF_NORMAL_MEAN = Math.sqrt(2 / Math.PI);

/**
 * 2,000 genotype tables at the chosen source and sample size, each SNP with its
 * own allele frequency and — where two populations are pooled — its own
 * frequency difference.
 */
export function buildMany(rng, { source, gap, error, n, alpha }) {
  const F = new Float64Array(SNP_COUNT);
  const sd = gap / HALF_NORMAL_MEAN;
  let past = 0;
  let deficits = 0;
  let sum = 0;
  for (let s = 0; s < SNP_COUNT; s += 1) {
    const pbar = SNP_P_RANGE[0] + (SNP_P_RANGE[1] - SNP_P_RANGE[0]) * rng.next();
    const own = source === "pooled" ? Math.abs(rng.normal(0, sd)) : 0;
    const t = hweTest(tableFor(rng, source, {
      p: pbar, subs: subFreqs(pbar, own), error, n,
    }));
    F[s] = t.F;
    sum += t.F;
    if (t.F > 0) deficits += 1;
    if (t.P < alpha) past += 1;
  }
  return { count: SNP_COUNT, F, past, deficits, meanF: sum / SNP_COUNT };
}

/** The F a SNP needs to be past the threshold at this sample size: χ² = n·F². */
export const fLine = (crit, n) => Math.sqrt(crit / n);

/* The histogram of F. One fixed bin width, and the domain snapped outward to
   it, so a bar is the same width whatever the source does to the spread. */
export const F_BIN = 0.01;

export function fHistogram(F, line) {
  let lo = -line;
  let hi = line;
  for (let i = 0; i < F.length; i += 1) {
    if (F[i] < lo) lo = F[i];
    if (F[i] > hi) hi = F[i];
  }
  lo = Math.floor((lo - 0.02) / F_BIN) * F_BIN;
  hi = Math.ceil((hi + 0.02) / F_BIN) * F_BIN;
  if (hi - lo < 0.2) hi = lo + 0.2;
  const bins = Math.min(160, Math.round((hi - lo) / F_BIN));
  const width = (hi - lo) / bins;
  const inside = new Array(bins).fill(0);
  const beyond = new Array(bins).fill(0);
  for (let i = 0; i < F.length; i += 1) {
    const b = Math.max(0, Math.min(bins - 1, Math.floor((F[i] - lo) / width)));
    /* A bin belongs to one side by its own centre, so the count beside the
       line is the exact count of SNPs past it. */
    if (Math.abs(lo + (b + 0.5) * width) >= line) beyond[b] += 1;
    else inside[b] += 1;
  }
  return { lo, hi, width, bins, inside, beyond };
}

/* ---- the de Finetti map -------------------------------------------------- */

export const S3 = Math.sqrt(3);

/**
 * A genotype table [AA, Aa, aa] as one point of the triangle: AA at the left
 * corner, Aa at the apex, aa at the right corner.
 *
 * The x coordinate is f(Aa)/2 + f(aa), which is the frequency of allele a
 * exactly — so the observed point and the prediction at its own frequency sit
 * on one vertical and the heterozygote deficit is the length of the drop.
 */
export function uv(counts) {
  const n = counts[0] + counts[1] + counts[2];
  if (!n) return [0.5, 0];
  const f = [counts[0] / n, counts[1] / n, counts[2] / n];
  return [f[1] / 2 + f[2], (f[1] * S3) / 2];
}

/** The Hardy-Weinberg table at allele frequency p, as a triangle point. */
export const curvePoint = (p) => [1 - p, (S3 / 2) * 2 * p * (1 - p)];
export const CURVE = Array.from({ length: 161 }, (_, i) => curvePoint(i / 160));

/**
 * The detail window: a magnified region of the same triangle, centred on the
 * CONTROL's allele frequency and on the curve's own height there.
 *
 * Fixed per parameter value, so the sample's point can leave it — which is the
 * reading at a small difference, where the whole triangle shows a deficit of
 * two pixels at every sample size (the mock measured 0.5–2.5px on a 150px
 * triangle across the five). The window keeps the triangle's own aspect, so it
 * is a magnified region and not a second kind of plot.
 */
export const ZOOM_SPAN = 0.22;

export function zoomWindow(p) {
  const half = ZOOM_SPAN / 2;
  const halfY = (half * S3) / 2;
  const cx = Math.max(half, Math.min(1 - half, 1 - p));
  const cy = Math.max(halfY, Math.min(S3 / 2 - halfY, (S3 / 2) * 2 * p * (1 - p)));
  return { x: [cx - half, cx + half], y: [cy - halfY, cy + halfY] };
}

/* ---- the geometry, one function ------------------------------------------ */

export const PAD_L = 30;
export const PAD_R = 18;
export const TOP = 44;      // the caption row above the triangle
export const GAP = 56;      // the bars' own axis lives in here
export const BARS_MIN = 110;
export const BARS_MAX = 190;
export const SIDE_MAX = 360;
export const HIST_L = 64;   // a rotated y-axis label plus its tick numbers
export const HIST_H = 250;

/**
 * Every rect the page draws in, and its own height, from the width and the
 * parameters alone — the same function `height` and `draw` both call (5.8).
 *
 * The One-SNP page is taller in the detail view, which pays for an x-axis and
 * its label where the whole triangle needs only the corner names.
 */
export function layout(w, values) {
  const usable = Math.max(240, w - PAD_L - PAD_R);
  if (values.page === "many") {
    const hist = { x: HIST_L, y: TOP, w: Math.max(200, w - HIST_L - PAD_R), h: HIST_H };
    return { page: "many", hist, height: hist.y + hist.h + 58 };
  }
  const barsW = Math.round(Math.min(BARS_MAX, Math.max(BARS_MIN, usable * 0.26)));
  const side = Math.round(Math.min(SIDE_MAX, Math.max(200, usable - GAP - barsW)));
  const triH = Math.round((side * S3) / 2);
  const block = side + GAP + barsW;
  const x0 = PAD_L + Math.max(0, Math.round((usable - block) / 2));
  return {
    page: "one",
    tri: { x: x0, y: TOP, side, h: triH },
    bars: { x: x0 + side + GAP, y: TOP, w: barsW, h: triH },
    panel: { x: PAD_L, w: usable },
    height: TOP + triH + (values.view === "sample" ? 58 : 36),
  };
}

/** The stage height, from the parameters and the width alone. */
export const stageHeight = (w, values) => layout(w, values).height;

/* ---- pacing --------------------------------------------------------------
 * One unit of the reveal is a fixed number of individuals, so every sample size
 * takes about the same time to build: 100 units of 60 ms is six seconds at the
 * four larger sizes and 3.9 s at 323. Per individual, 50,000 of them would be
 * fifty minutes.
 *
 * THE FRACTION IS KEPT ACROSS FRAMES (widget 55's clock, not widget 48's step
 * floor): `beat` fills over UNIT_MS and the reveal advances by whatever whole
 * units have accumulated, so a unit slower than a frame stays a RATE rather
 * than becoming one unit per frame. */
export const UNIT_MS = 60;
export const BATCH = { 100: 1, 323: 5, 1000: 10, 10000: 100, 50000: 500 };
export const batchFor = (n) => BATCH[n] ?? Math.max(1, Math.round(n / 100));
export const unitsFor = (n) => Math.ceil(n / batchFor(n));

/* ---- numbers on screen ---------------------------------------------------- */

export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
/** A P as the reader would see it: four decimals until it needs an exponent. */
export const pfmt = (P) => (!Number.isFinite(P) ? "—" : P < 1e-4 ? P.toExponential(1) : P.toFixed(4));
export const intText = (v) => Math.round(v).toLocaleString("en-US");
export const pctText = (v) => `${(100 * v).toFixed(1)}%`;

/* ---- the parameters, and their copy (5.9) --------------------------------- */

export const PAGES = [
  {
    value: "one",
    label: "One SNP",
    detail: "the genotype counts of one SNP, added one individual at a time",
  },
  {
    value: "many",
    label: "Many SNPs",
    detail: "the genotype counts of 2,000 SNPs from the same source and sample size, each at its own allele frequency",
  },
];

/* The four sources, in the order the deficit is argued: one population, then
   the two ways a sample leaves the curve on the deficit side, then the one that
   leaves it on the other. The names are the mock's short set — what each source
   DOES stays in the line under the control, which is where a reader looks for
   it; the name only has to say which of the four.

   EVERY VALUE IS A WORD ITS OWN FACE SHOWS (5.9). The two miscalling arms are
   allele dropout and an over-call in the literature, and neither word is on the
   control, so a link would carry a term the reader has never seen — widget 44's
   `concept=budget` exactly. The verify asserts the property rather than the
   four strings. */
export const SOURCES = [
  {
    value: "one",
    label: "One population",
    detail: "all individuals from one population, at the allele frequency below",
    caption: "one population",
  },
  {
    value: "pooled",
    label: "Two pooled",
    detail: "half the individuals from each of two populations whose allele frequencies differ by the frequency difference below",
    caption: "two populations pooled",
  },
  {
    value: "heterozygotes",
    label: "Heterozygotes miscalled",
    detail: "each heterozygote is recorded as AA or aa with probability equal to the miscall rate below",
    caption: "heterozygotes miscalled as homozygotes",
    /* Two per row, all four: the mock measured the long names at 130px in
       a 149px cell, and the draft's `span: true` on these two (a guess made
       without a browser) was read in the browser 2026-09-12 — 298px rows,
       nothing truncating at 149. Rail C is the pick. */
  },
  {
    value: "homozygotes",
    label: "Homozygotes miscalled",
    detail: "each homozygote is recorded as Aa with probability equal to the miscall rate below",
    caption: "homozygotes miscalled as heterozygotes",
  },
];

export const sourceOf = (key) => SOURCES.find((s) => s.value === key) ?? SOURCES[0];

/* Real study sizes: 323 is a cohort, 10,000 and 50,000 are biobanks. A log
   slider from 50 to 100,000 offers a hundred values of which five carry the
   reading and hides which five. */
export const N_OPTIONS = [
  { value: "100", label: "100" },
  { value: "323", label: "323" },
  { value: "1000", label: "1,000" },
  { value: "10000", label: "10,000" },
  { value: "50000", label: "50,000" },
];
export const nOf = (key) => Number(key);

export const THRESHOLDS = [
  { value: "0.05", label: "0.05", alpha: 0.05 },
  { value: "1e-3", label: "10⁻³", alpha: 1e-3 },
  { value: "1e-6", label: "10⁻⁶", alpha: 1e-6 },
];
export const thresholdOf = (key) => THRESHOLDS.find((t) => t.value === key) ?? THRESHOLDS[2];
/** The critical χ² at each threshold, computed once at load. */
export const CRIT = Object.fromEntries(THRESHOLDS.map((t) => [t.value, chi1Crit(t.alpha)]));

export const VIEWS = [
  {
    value: "whole",
    label: "Whole triangle",
    detail: "the full triangle and curve",
  },
  {
    value: "sample",
    label: "Around the sample",
    detail: "a magnified region around the allele frequency set above",
  },
];

export const STRINGS = {
  /* Kenneth's pick A of two, 2026-09-12: three claims, the third being the one
     the sample-size control exists for. */
  /* Copy audit 2026-09-12 (Kenneth: "quite a bit of mannerisms"): every
     string below states a literal fact in plain words — no figurative verbs
     ("moves a sample off it", "decides which deviations the test finds",
     "read against"), no chatty tails ("or 2,000 of them"), no question-shaped
     labels ("What produced the sample", "How much is drawn"). */
  subtitle:
    "Hardy-Weinberg equilibrium predicts the three genotype frequencies from one "
    + "allele frequency. A sample pooled from two populations, or with miscalled "
    + "heterozygotes, has fewer heterozygotes than predicted, and the sample size "
    + "sets how small a deviation the chi-square test can detect.",

  /* the gallery card: one declarative sentence naming the concept */
  /* under the card's 120 — every one of the 52 shipped blurbs is — so the
     concept's name is left to the title above it */
  blurb:
    "One allele frequency predicts three genotype frequencies; pooled populations and "
    + "miscalled genotypes deviate from it.",

  pageLabel: "Page",
  pageDetail: "one SNP, or 2,000 SNPs",

  sampleSection: "The sample",
  testSection: "The test",
  figureSection: "The figure",

  sourceLabel: "Source",
  sourceDetail: "the process that produced the genotypes",

  pLabel: "Allele frequency",
  pDetail: "the frequency of allele A; for two pooled populations, the mean of their two frequencies",

  gapLabel: "Frequency difference",
  gapDetail: "the difference between the two populations' allele frequencies, centred on the "
    + "allele frequency above; on Many SNPs, the mean difference across SNPs",

  errorLabel: "Miscall rate",
  errorDetail: "the probability that a genotype is recorded as a different genotype",

  nLabel: "Sample size",
  nDetail: "the number of individuals genotyped",

  thresholdLabel: "Significance threshold",
  thresholdDetail: "the P value below which the deviation counts as significant",

  viewLabel: "View",
  viewDetail: "the region of the triangle shown",

  wholeLabel: "Draw the whole sample",
  wholeDetail: "all remaining individuals added at once",

  seedLabel: "Seed",
  seedDetail: "draws different samples",

  runTitle: "Add the remaining individuals, one batch at a time",

  /* on the canvas */
  curveLabel: "Hardy-Weinberg",
  barsCaption: "counts",
  barsAxis: "individuals",
  zoomX: "frequency of a",
  zoomY: "heterozygote frequency",
  noDeficit: "no deficit",
  histX: "heterozygote deficit F",
  histY: "SNPs",
};

/* A step is one unit of the reveal, and a unit is a different number of
   individuals at each sample size — 3.4c's map form, which exists because core
   has to know every label the button can hold as well as the current one. */
export const STEP_LABELS = Object.fromEntries(
  N_OPTIONS.map((o) => {
    const b = batchFor(nOf(o.value));
    return [o.value, b === 1 ? "Add 1 individual" : `Add ${intText(b)} individuals`];
  }),
);
export const STEP_TITLES = Object.fromEntries(
  N_OPTIONS.map((o) => {
    const b = batchFor(nOf(o.value));
    return [o.value, b === 1
      ? "Add the next individual to the sample"
      : `Add the next ${intText(b)} individuals to the sample`];
  }),
);

/** The sample the controls describe, resolved once so nothing re-derives it. */
export function configFor(params) {
  const n = nOf(params.n);
  return {
    source: params.source,
    p: params.p,
    /* The One-SNP sample takes the two frequencies; the Many-SNPs page takes
       the difference itself, because each of its SNPs draws its own around it.
       Both are here: leaving `gap` out made every one of the 2,000 tables NaN,
       which the figure printed as a mean deficit of 0.000 and no SNP past the
       threshold — a picture with nothing visibly wrong with it. */
    gap: params.gap,
    subs: subFreqs(params.p, params.gap),
    error: params.error,
    n,
    batch: batchFor(n),
    units: unitsFor(n),
    alpha: thresholdOf(params.threshold).alpha,
    crit: CRIT[params.threshold] ?? CRIT["1e-6"],
  };
}
