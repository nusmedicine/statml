/* ============================================================================
   Missing data — the generative model and the three missingness mechanisms.

   Widget 25 (planned 2026-08-27). The scenario is a clinic measuring body
   weight: every patient's AGE is known (you booked them in), the WEIGHT is the
   measurement that can go missing. One story per mechanism, each one line:

     MCAR   the scale was broken that day        — holes follow nothing
     MAR    older patients get weighed more
            often at check-ups                   — holes follow AGE (observed)
     MNAR   patients heavier than their age
            predicts avoid the scale             — holes follow the missing
                                                   value itself, given age

   THE MECHANISMS ARE CALIBRATED TO ONE OVERALL RATE. The rate control sets how
   much is missing; the mechanism sets only WHERE the holes bite. That is the
   claim the widget exists to make — the damage is set by the mechanism, not
   the amount — and it is only honest if the amounts are actually equal.

   Everything here is imported by the widget AND by the measurement script —
   `widgets/_lab/missing-measure.mjs` — never copied (5.8). Every constant that
   carries teaching weight was chosen by that script's sweep; see the catalogue.
   ========================================================================= */

/* --- the population -------------------------------------------------------- *
 * Age uniform on [20, 80] so the check panel's bins fill evenly; weight rises
 * with age around a 78 kg centre. The SLOPE and NOISE are the load-bearing
 * pair: the slope must be big enough that MAR (holes following age) visibly
 * biases the weight you observe, and small enough that MNAR (holes following
 * weight) does not leak into the age diagnostic and stop looking like MCAR.
 * Chosen by sweep in missing-measure.mjs. */
export const AGE_LO = 20;
export const AGE_HI = 80;
export const W_BASE = 78;      // kg at the mid age
export const W_SLOPE = 0.25;   // kg per year — see the sweep before changing
export const W_SD = 8;         // kg residual spread

const gauss = (rng) =>
  Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

/** The complete cohort — the truth the widget knows and reality never grants. */
export function cohort(n, rng) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const age = AGE_LO + (AGE_HI - AGE_LO) * rng.next();
    const w = W_BASE + W_SLOPE * (age - (AGE_LO + AGE_HI) / 2) + gauss(rng) * W_SD;
    out.push({ age, w });
  }
  return out;
}

/* --- the three mechanisms --------------------------------------------------- *
 * Each mechanism is a per-patient probability of the weight going missing.
 * MCAR is flat. MAR is logistic in AGE (younger -> more missing: the young
 * skip check-ups). MNAR is logistic in the RESIDUAL — weight relative to what
 * age predicts — which is the definition itself: MAR is missingness that is
 * independent of the value GIVEN the observed covariate, MNAR is missingness
 * that still depends on the value after age is accounted for. It also earns
 * the widget's sharpest claim honestly: the residual is orthogonal to age by
 * construction, so MNAR's check panel is genuinely as flat as MCAR's. The
 * first draft scored MNAR on raw weight, and the sweep killed it — weight
 * carries age, so MNAR leaked a 40-point slope into the age diagnostic and
 * "looks like MCAR" held on 60 of 200 cohorts.
 *
 * The intercept is calibrated by bisection so every mechanism hits the same
 * overall rate: the rate control sets how much, the mechanism only where.
 * STEEP sets how sharply the holes concentrate; from the sweep.               */
export const STEEP = 2.0;

const logistic = (s) => 1 / (1 + Math.exp(-s));

/** Standardised scores per mechanism, sharpened by `steep`. Standardising
    means one steepness carries the same meaning for age and for residual. */
function scores(pts, mechanism, steep) {
  const n = pts.length;
  if (mechanism === "mcar") return pts.map(() => 0);
  const mid = (AGE_LO + AGE_HI) / 2;
  const v = mechanism === "mar"
    ? pts.map((p) => -p.age)
    : pts.map((p) => p.w - (W_BASE + W_SLOPE * (p.age - mid)));
  const mu = v.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1;
  return v.map((x) => (steep * (x - mu)) / sd);
}

/** Per-patient missingness probabilities at an exact overall rate. */
export function missProbs(pts, mechanism, rate, steep = STEEP) {
  const s = scores(pts, mechanism, steep);
  let lo = -20, hi = 20;
  for (let it = 0; it < 60; it += 1) {
    const c = (lo + hi) / 2;
    const mean = s.reduce((acc, x) => acc + logistic(x + c), 0) / s.length;
    if (mean > rate) hi = c; else lo = c;
  }
  const c = (lo + hi) / 2;
  return s.map((x) => logistic(x + c));
}

/** Which patients go missing — one seeded draw of the mechanism. */
export function applyMissing(pts, mechanism, rate, rng, steep = STEEP) {
  const p = missProbs(pts, mechanism, rate, steep);
  return pts.map((pt, i) => ({ ...pt, miss: rng.next() < p[i] }));
}

/* --- the readings ----------------------------------------------------------- */

export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
export const sd = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length || 1));
};

/** The check you can run: % missing per age bin. The one diagnostic reality
    permits — it sees MAR and it cannot see MNAR. */
export function checkPanel(pts, bins = 6) {
  const out = [];
  for (let b = 0; b < bins; b += 1) {
    const lo = AGE_LO + ((AGE_HI - AGE_LO) * b) / bins;
    const hi = AGE_LO + ((AGE_HI - AGE_LO) * (b + 1)) / bins;
    const inBin = pts.filter((p) => p.age >= lo && p.age < hi + (b === bins - 1 ? 1e-9 : 0));
    out.push({ lo, hi, n: inBin.length, missing: inBin.filter((p) => p.miss).length });
  }
  return out;
}
