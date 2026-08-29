/* ============================================================================
   roc-auc/model.js — the ROC engine, and the real test set it defaults to.

   Kept apart from main.js so the lab can import FROM the widget (the
   lm-diagnostics arrangement): `_lab/roc-measure.py` reproduces notebook
   04-2 Model Evaluation in sklearn and this file must agree with it to the
   digit — AUC 0.740693, Youden threshold 0.313674, and cell 39's comparison
   (accuracy 0.70 at threshold 0.50 AND at Youden, missed deaths 9 -> 3).

   One geometry note, measured 2026-08-29: sklearn's roc_curve returns 24
   points for this data because drop_intermediate=True removes collinear
   ones; the per-patient walk below has 61. The CURVES are identical — every
   dropped point lies on the segment between its neighbours — and the walk
   is what the widget wants, because the animation advances one patient at
   a time and each patient is one step of the staircase.
   ========================================================================= */

/* The 60 held-out patients of 04-2's heart-failure model: predicted
   probability of death from LogisticRegression(class_weight='balanced') on
   the notebook's own split (random_state 42, stratified), and the outcome
   that actually happened. Regenerate with _lab/roc-measure.py; the copy in
   _lab/roc-ref.json is the provenance record. */
export const REAL = {
  probs: [0.618693, 0.437255, 0.324323, 0.640161, 0.132661, 0.152053, 0.172219,
    0.206101, 0.149348, 0.725111, 0.74622, 0.438778, 0.389591, 0.300861,
    0.154251, 0.642931, 0.746998, 0.450307, 0.799956, 0.215895, 0.032317,
    0.47936, 0.28854, 0.066117, 0.102334, 0.773484, 0.391266, 0.963578,
    0.732587, 0.279051, 0.138426, 0.332455, 0.256659, 0.891399, 0.123224,
    0.429606, 0.313674, 0.496892, 0.519047, 0.721931, 0.580567, 0.225333,
    0.267684, 0.04678, 0.087138, 0.117796, 0.200472, 0.079533, 0.30966,
    0.87267, 0.590528, 0.720303, 0.380045, 0.216238, 0.141445, 0.807341,
    0.224757, 0.737174, 0.116428, 0.163896],
  labels: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0,
    0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
};

/**
 * The per-patient walk that IS the ROC curve: patients sorted by score,
 * highest first, one point after each. A death moves the path up by 1/P,
 * a survivor moves it right by 1/N. walk[0] is the origin at threshold
 * "above every score"; walk[i].th is the i-th patient's own score, i.e.
 * the threshold at which that patient has just been called positive.
 */
export function rocWalk(scores, labels) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const P = labels.reduce((a, l) => a + l, 0);
  const N = labels.length - P;
  const walk = [{ fpr: 0, tpr: 0, th: Infinity, died: null }];
  let tp = 0;
  let fp = 0;
  for (const i of order) {
    if (labels[i] === 1) tp += 1; else fp += 1;
    walk.push({ fpr: fp / N, tpr: tp / P, th: scores[i], died: labels[i] === 1 });
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

/** Confusion counts and rates at one threshold; score >= th predicts positive,
    the notebook's rule. */
export function metricsAt(scores, labels, th) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const pos = scores[i] >= th;
    if (labels[i] === 1) { if (pos) tp += 1; else fn += 1; }
    else if (pos) fp += 1; else tn += 1;
  }
  const n = scores.length;
  return {
    tp, fp, tn, fn,
    accuracy: (tp + tn) / n,
    sensitivity: tp + fn ? tp / (tp + fn) : 0,
    specificity: tn + fp ? tn / (tn + fp) : 0,
    precision: tp + fp ? tp / (tp + fp) : 0,
    fpr: fp + tn ? fp / (fp + tn) : 0,
    tpr: tp + fn ? tp / (tp + fn) : 0,
  };
}

/**
 * A simulated cohort for the "What moves the curve" tab. Latent score
 * z ~ Normal(±sep/2, 1) by class, squashed through the logistic so the
 * axis reads as a probability-like score in (0, 1). The squash is FIXED,
 * not fitted to the sample: a min–max rescale (the uploaded app's choice)
 * makes the axis a function of the two most extreme draws, so the same
 * separation lands differently on every seed.
 */
export function simulate(rng, { n, balance, sep }) {
  const nPos = Math.round(n * balance);
  const scores = [];
  const labels = [];
  for (let i = 0; i < n; i += 1) {
    const died = i < nPos;
    const z = rng.normal(died ? sep / 2 : -sep / 2, 1);
    scores.push(1 / (1 + Math.exp(-z)));
    labels.push(died ? 1 : 0);
  }
  return { scores, labels };
}
