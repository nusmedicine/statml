/* ============================================================================
   Widget 35 `metrics` — the two simulated cohorts and every metric printed.

   Lives apart from main.js so the lab imports FROM the widget (the
   lm-diagnostics rule): `_lab/metrics-measure.mjs` runs these exact functions,
   so a number in the catalogue and a number on screen cannot come from two
   copies of a generator.

   NUMERIC — predicting body fat % (notebook 04-2's numeric example; bodyfat.csv
   has mean 19.2, SD 8.4, so Normal(19, 8) clipped to [5, 40] is the realistic
   band). The model's predictions are actual + Normal(0, sigma): sigma IS the
   model's error dial. Outliers are applied to the largest-actual patients so
   they sit in a consistent screen region rather than wherever the seed likes,
   and alternate sign so two of them do not read as bias.

   CATEGORICAL — a screening cohort. Latent score: disease ~ N(+d/2, 1),
   healthy ~ N(-d/2, 1). The model is the rule a default logistic regression
   trained at this prevalence applies at the 0.5 cutoff: predict disease iff
   z >= log((1-p)/p) / d. The cutoff MOVING with prevalence is what makes the
   accuracy trap honest — measured in the round-0 sweep: at d 1.5, prevalence
   0.5 -> 0.05 sends accuracy 0.77 -> 0.95 while recall collapses 0.77 -> 0.14,
   and a fixed midpoint cutoff holds every rate constant and shows no trap.
   ========================================================================= */

/** Both axes of the numeric stage, % body fat. Predictions are clipped to it
    because a negative body fat is exactly the bizarre value ruled out. */
export const NUM_LO = 0;
export const NUM_HI = 48;

export const NUM_N = 40;
export const CAT_N = 200;
export const OUTLIER_MAG = 18;

export function numericCohort(rng, { n = NUM_N, sigma, outliers = 0, mag = OUTLIER_MAG }) {
  const actual = [];
  for (let i = 0; i < n; i += 1) actual.push(Math.min(40, Math.max(5, rng.normal(19, 8))));
  const clip = (v) => Math.min(NUM_HI, Math.max(NUM_LO, v));
  const predBase = actual.map((a) => clip(a + rng.normal(0, sigma)));
  const pred = predBase.slice();
  const order = actual.map((a, i) => [a, i]).sort((p, q) => q[0] - p[0]);
  const flagged = [];
  for (let k = 0; k < outliers && k < n; k += 1) {
    const i = order[k][1];
    pred[i] = clip(actual[i] + (k % 2 === 0 ? -mag : mag));
    flagged.push(i);
  }
  return { actual, pred, predBase, flagged };
}

export function numericMetrics(actual, pred) {
  const n = actual.length;
  let se = 0;
  let ae = 0;
  let ybar = 0;
  for (const a of actual) ybar += a;
  ybar /= n;
  for (let i = 0; i < n; i += 1) {
    const e = pred[i] - actual[i];
    se += e * e;
    ae += Math.abs(e);
  }
  let sst = 0;
  for (const a of actual) sst += (a - ybar) * (a - ybar);
  return { rmse: Math.sqrt(se / n), mae: ae / n, r2: 1 - se / sst, sse: se, sst, ybar };
}

export function categoricalCohort(rng, { n = CAT_N, prev, d, rule = "plugin" }) {
  const cut = rule === "plugin" ? Math.log((1 - prev) / prev) / d : 0;
  const cells = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (let i = 0; i < n; i += 1) {
    const disease = rng.next() < prev;
    const z = rng.normal(disease ? d / 2 : -d / 2, 1);
    const pos = z >= cut;
    if (disease && pos) cells.tp += 1;
    else if (disease) cells.fn += 1;
    else if (pos) cells.fp += 1;
    else cells.tn += 1;
  }
  return cells;
}

export function categoricalMetrics({ tp, fp, tn, fn }) {
  const n = tp + fp + tn + fn;
  const prec = tp + fp ? tp / (tp + fp) : NaN;
  const rec = tp + fn ? tp / (tp + fn) : NaN;
  return {
    acc: (tp + tn) / n,
    prec,
    rec,
    f1: Number.isFinite(prec) && Number.isFinite(rec) && prec + rec > 0
      ? (2 * prec * rec) / (prec + rec)
      : NaN,
    /* the all-negative baseline: predict "no disease" for everyone and be
       right about exactly the healthy — the number accuracy has to beat */
    base: (fp + tn) / n,
    n,
  };
}
