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

/* THE SCORE IS THE TRAINED MODEL'S CALIBRATED PROBABILITY. For latent
   z ~ N(±d/2, 1) the log-likelihood ratio is d·z, so a logistic regression
   trained at prevalence p outputs prob = σ(d·z + logit(p)) — and cutting
   that probability at 0.5 is ALGEBRAICALLY the plug-in rule the round-0
   sweep measured (prob ≥ 0.5 ⇔ z ≥ log((1−p)/p)/d). One generator
   therefore serves the confusion-matrix act, the score histograms AND the
   ROC curve: the cells are just cellsAt(patients, threshold). */
export function categoricalPatients(rng, { n = CAT_N, prev, d }) {
  const priorLogOdds = Math.log(prev / (1 - prev));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const disease = rng.next() < prev;
    const z = rng.normal(disease ? d / 2 : -d / 2, 1);
    out.push({ prob: 1 / (1 + Math.exp(-(d * z + priorLogOdds))), disease });
  }
  return out;
}

export function cellsAt(patients, thr) {
  const cells = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const p of patients) {
    const pos = p.prob >= thr;
    if (p.disease && pos) cells.tp += 1;
    else if (p.disease) cells.fn += 1;
    else if (pos) cells.fp += 1;
    else cells.tn += 1;
  }
  return cells;
}

/* --- the ROC engine, widget 34's own (roc-auc/model.js), copied not
   imported: a cross-widget import would let an edit over there silently
   change the numbers here, and both copies answer to sklearn, not to each
   other. The walk IS the curve: patients sorted by probability, highest
   first, one point after each — up for a disease patient, right for a
   healthy one; walk[i].th is that patient's own score, the threshold at
   which they have just been called positive. ------------------------------ */

export function rocWalk(patients) {
  const sorted = patients.slice().sort((a, b) => b.prob - a.prob);
  const P = sorted.filter((p) => p.disease).length;
  const N = sorted.length - P;
  const walk = [{ fpr: 0, tpr: 0, th: Infinity, disease: null }];
  let tp = 0;
  let fp = 0;
  for (const p of sorted) {
    if (p.disease) tp += 1;
    else fp += 1;
    walk.push({ fpr: N ? fp / N : 0, tpr: P ? tp / P : 0, th: p.prob, disease: p.disease });
  }
  return walk;
}

/** Trapezoidal area under the walk — identical to sklearn's roc_auc_score. */
export function aucOf(walk) {
  let auc = 0;
  for (let i = 1; i < walk.length; i += 1) {
    auc += (walk[i].fpr - walk[i - 1].fpr) * (walk[i].tpr + walk[i - 1].tpr) / 2;
  }
  return auc;
}

/** The point maximising Youden's J = TPR − FPR, the notebook's argmax(tpr−fpr). */
export function youdenOf(walk) {
  let best = null;
  for (const p of walk) {
    if (p.th === Infinity) continue;
    if (!best || p.tpr - p.fpr > best.tpr - best.fpr) best = p;
  }
  return best;
}

/* --- the positive class is a CHOICE, sklearn's own view ------------------- *
 * The four cells are counted with "disease" as the positive class; calling
 * "no disease" positive does not recount anything — it RENAMES the cells:
 * the true negatives become that class's true positives, and which mistakes
 * are "false positives" swaps with it. That renaming is the whole lesson of
 * the pill, and it is why classification_report has one row per class.     */
export function classCells(cells, positive) {
  return positive === "disease"
    ? cells
    : { tp: cells.tn, fp: cells.fn, fn: cells.fp, tn: cells.tp };
}

/* classification_report's two summary rows: macro averages the two classes'
   metrics equally; weighted weights them by support, which is what lets a
   large healthy class mask a failing disease class. */
export function reportAverages(cells) {
  const a = categoricalMetrics(classCells(cells, "disease"));
  const b = categoricalMetrics(classCells(cells, "healthy"));
  const nA = cells.tp + cells.fn;
  const nB = cells.tn + cells.fp;
  const n = nA + nB;
  /* sklearn's zero_division=0: an undefined ratio (no predicted positives)
     enters the averages as 0, exactly as classification_report prints it */
  const z = (v) => (Number.isFinite(v) ? v : 0);
  const avg = (k) => ({
    macro: (z(a[k]) + z(b[k])) / 2,
    weighted: (nA * z(a[k]) + nB * z(b[k])) / n,
  });
  return { prec: avg("prec"), rec: avg("rec"), f1: avg("f1"), support: { disease: nA, healthy: nB } };
}

/* The round-0 sweep's door, kept so `_lab/metrics-measure.mjs` reads
   unchanged: "plugin" is probability 0.5 (see above); "mid" is the fixed
   latent midpoint z ≥ 0, which on the probability scale is prob ≥ p. */
export function categoricalCohort(rng, { n = CAT_N, prev, d, rule = "plugin" }) {
  return cellsAt(categoricalPatients(rng, { n, prev, d }), rule === "plugin" ? 0.5 : prev);
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
