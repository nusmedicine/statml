/* ============================================================================
   Support vector machines — widget 16. DRAFT.

   Hosts at PHM5005 `04-3 Tour of Algorithms`, section "Margin-based Models
   (SVM)". That section prints one objective for both SVC and SVR:

       min  1/2 ||w||^2  +  C * sum_i Loss_i

   and describes C as "the trade-off between margin size and misclassification".
   Students read that as a quality dial and reach for a grid search. What C
   actually sets is how wide the corridor is, and the corridor decides which
   samples are support vectors — and the support vectors are the only samples the
   boundary depends on at all. Every sample BEYOND the corridor has loss EXACTLY
   zero, not merely small, and weight exactly zero with it, so it enters the
   objective at nothing and could be deleted.

   The line between the two is drawn by alpha, not by the loss, and the
   difference bites at the separable end: a support vector sitting exactly ON
   the margin has y f(x) = 1, so its hinge loss is zero while its alpha is not.
   At C = 30 on the biopsies all 194 samples have zero loss and 3 of them still
   set the boundary. Everything the widget says is phrased on alpha for that
   reason — "inside the corridor or touching its edge" against "beyond it".

   That is the one thing about an SVM that is true of nothing else in the tour.
   A logistic regression's loss never reaches zero, so every patient pulls on it
   (widget 15). A least-squares fit squares every residual (widget 14). Here most
   of the cohort contributes literally nothing, and the widget's second panel is
   the loss curve that says why.

   ---------------------------------------------------------------------------
   TWO DATA SETS, BECAUSE THE STORY DOES NOT FIRE ON ONE OF THEM. 04-3's own SVC
   example is the heart-failure cohort, and on its two informative features the
   margin story is dead: 179 of 299 patients are support vectors at C = 1 and
   never fewer than 175 anywhere on the ladder. Four orders of magnitude of C
   move the corridor's width 4x and the count inside it by TWO patients. There is
   no corridor to see, because the corridor is the cohort.

   03-5's colorectal biopsies do fire: C sweeps the support vectors from 174 of
   194 down to 3, while accuracy never leaves 1.000.

   Both are here, as one control, and that pairing IS the argument (2.6). The
   biopsies say what a margin is; the cohort is what the same method does when
   there is no gap between the classes. A widget with only the biopsies would
   teach a picture clinical data rarely looks like; one with only the cohort
   would have a dial that drives nothing.

   ---------------------------------------------------------------------------
   THE PLANE IS ISOMETRIC, WHICH IS WHY ITS HEIGHT IS A FUNCTION OF THE WIDTH.
   The margin is a distance, and a distance is only a distance if both axes carry
   the same units per pixel. So the panel's aspect ratio is the data's own
   aspect ratio in standardised units, and a wider frame costs a taller one —
   the same trade widget 14 makes for its square panels.

   Serum creatinine is drawn and fitted on a LOG scale, which is how it is read
   clinically and what makes the panel a usable shape: raw, it spans 8.6 SD
   against ejection fraction's 5.6 because of a handful of patients above
   5 mg/dL, and the cohort collapses into one corner. Logged it spans 6.5, and
   the fit is better as well — accuracy 0.766 against 0.732 at C = 1. The
   notebook does not log it, but the notebook is fitting eleven features with an
   RBF kernel; this is a two-feature linear projection and its numbers differ
   from that one either way.

   ---------------------------------------------------------------------------
   NO ANIMATION, NO SEED, NO SHOWN. Principle 4.5. There is one dial and dragging
   it IS the motion; nothing is random, since every sample is fitted every time.
   The widget opens at C = 1, which is sklearn's default and the value the
   notebook writes — not an answer, just where the lesson starts (2.1).

   THE SOLVER IS SMO, and it is deterministic: the working pair is LIBSVM's
   maximal violating pair, chosen from the gradient, never at random. It agrees
   with `sklearn.svm.SVC(kernel="linear")` to four decimal places in both w and b
   at every rung of the ladder on both data sets. The ladder stops at C = 30
   because the worst case there is 17 ms against 55 ms at C = 100, and the
   solution is identical from C = 1 upward on the cohort and from C = 10 upward
   on the biopsies — so the top rungs would cost the drag and teach nothing.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";

/* --- the two stages ------------------------------------------------------ *
 * Colorectal: GSE44076 via CuMiDa, 194 samples, 97 normal and 97
 * adenocarcinoma, platform GPL13667. The two probes are 11718290_a_at (FXYD5,
 * dysadherin — up in tumour) and 11717979_at (C7, complement component 7 —
 * down), chosen from the 38 separable pairs among the 120 best-AUC probes
 * carrying gene symbols, scored on margin width times how evenly the two axes
 * share the weight. Values are log2 expression.
 *
 * Heart failure: heart_failure_alpha.csv, 299 patients, 96 deaths — 04-3's own
 * SVC data. Ejection fraction (%) and serum creatinine (mg/dL). */
const CRC = "6.258,9.389,-1;5.327,7.759,-1;7.087,9.637,-1;5.787,7.871,-1;5.349,6.76,-1;6.55,8.607,-1;6.195,9.23,-1;5.745,7.832,-1;5.977,8.642,-1;5.132,7.493,-1;6.399,6.852,-1;6.848,8.198,-1;6.863,8.763,-1;5.405,7.916,-1;6.567,8.36,-1;5.486,8.638,-1;5.086,7.751,-1;6.3,10.186,-1;6.218,8.054,-1;5.401,8.863,-1;5.883,8.469,-1;6.216,11.096,-1;6.709,10.924,-1;5.765,8.639,-1;6.609,8.528,-1;6.062,9.485,-1;6.841,8.82,-1;6.235,8.777,-1;4.852,8.491,-1;5.555,8.163,-1;6.309,10.383,-1;5.804,8.118,-1;7.052,9.158,-1;6.009,8.317,-1;5.199,8.778,-1;6.304,7.583,-1;5.346,8.023,-1;5.02,10.358,-1;5.91,6.604,-1;6.482,10.309,-1;5.541,9.733,-1;6.187,8.348,-1;5.773,7.869,-1;5.386,9.106,-1;6.486,10.791,-1;6.035,9.598,-1;6.188,11.974,-1;5.029,7.064,-1;6.346,9.05,-1;6.161,9.371,-1;5.871,10.16,-1;6.385,8.411,-1;6.988,8.996,-1;6.028,9.329,-1;6.284,9.59,-1;5.088,9.193,-1;5.763,9.398,-1;5.485,10.208,-1;6.199,9.776,-1;6.481,8.174,-1;6.656,11.369,-1;6.066,8.711,-1;7.234,9.739,-1;5.026,7.161,-1;6.483,11.633,-1;6.254,9.767,-1;7.506,9.434,-1;6.293,9.227,-1;5.934,7.053,-1;6.337,9.44,-1;5.278,9.496,-1;5.315,8.698,-1;5.79,8.486,-1;6.827,8.669,-1;6.828,8.23,-1;5.831,10.937,-1;6.033,9.93,-1;7.305,8.735,-1;7.008,10.532,-1;6.046,8.913,-1;6.024,9.11,-1;6.486,8.756,-1;6.622,8.979,-1;6.345,10.225,-1;4.886,9.618,-1;5.482,8.471,-1;5.704,8.906,-1;5.514,9.308,-1;6.403,10.804,-1;6.951,9.173,-1;5.059,7.65,-1;5.229,7.334,-1;4.995,5.852,-1;6.433,10.453,-1;5.862,9.764,-1;6.613,8.435,-1;6.352,10.055,-1;8.237,8.216,1;7.561,4.035,1;8.409,2.949,1;7.975,5.043,1;8.346,4.261,1;9.581,5.418,1;8.363,5.007,1;9.513,2.478,1;7.954,5.529,1;8.258,5.769,1;8.252,4.391,1;8.29,4.741,1;9.071,4.964,1;6.752,4.948,1;8.228,3.718,1;8.823,3.28,1;8.617,5.303,1;8.501,4.758,1;7.153,6.346,1;6.026,3.26,1;8.057,3.457,1;6.799,3.768,1;7.918,4.55,1;9.809,2.557,1;8.323,5.687,1;9.446,6.404,1;7.29,4.456,1;7.647,5.911,1;9.233,3.519,1;8.695,3.686,1;7.001,5.215,1;9.001,8.365,1;8.193,4.597,1;8.378,3.011,1;6.284,5.372,1;7.71,3.703,1;8.268,3.559,1;6.747,2.977,1;8.114,4.355,1;6.927,3.359,1;7.527,2.912,1;8.18,5.596,1;7.419,4.946,1;8.492,7.568,1;8.143,7.072,1;8.235,3.022,1;8.772,3.536,1;8.162,5.569,1;8.838,7.1,1;8.147,6.817,1;9.213,3.063,1;8.066,5.01,1;8.898,4.258,1;9.362,10.5,1;8.81,4.573,1;7.912,3.575,1;7.544,3.618,1;7.98,8.066,1;9.439,5.445,1;8.28,2.923,1;8.699,4.867,1;8.094,7.427,1;6.593,4.061,1;7.362,6.862,1;9.112,2.809,1;8.446,5.325,1;7.536,5.668,1;9.054,2.911,1;8.942,6.86,1;9.006,6.717,1;8.053,4.052,1;7.414,4.24,1;9.21,4.788,1;6.681,3.604,1;8.634,6.67,1;7.154,4.507,1;8.366,6.868,1;8.898,4.205,1;7.02,3.909,1;7.956,3.568,1;7.706,3.631,1;8.345,7.524,1;8.481,5.542,1;7.602,2.699,1;8.597,4.263,1;8.226,3.894,1;9.272,7.659,1;8.911,6.086,1;9.821,4.682,1;8.961,4.946,1;7.955,5.777,1;8.771,4.129,1;8.588,4.078,1;7.852,5.97,1;7.48,4.095,1;6.843,3.251,1;7.691,5.085,1";
const HF = "20,1.9,1;38,1.1,1;20,1.3,1;20,1.9,1;20,2.7,1;40,2.1,1;15,1.2,1;60,1.1,1;65,1.5,1;35,9.4,1;38,4,1;25,0.9,1;30,1.1,1;38,1.1,1;30,1,-1;50,1.3,1;38,0.9,1;14,0.8,1;25,1,1;55,1.9,1;25,1.3,-1;30,1.6,1;35,0.9,1;60,0.8,-1;30,1.83,1;38,1.9,1;40,1,1;45,1.3,1;38,5.8,1;30,1.2,1;38,1.83,1;45,3,1;35,1,1;30,1.2,-1;50,1,1;35,3.5,1;50,1,1;50,1,1;30,2.3,-1;38,3,1;20,1.83,1;30,1.2,1;45,1.2,1;50,1,-1;60,1.1,1;38,1.9,1;25,0.9,1;38,0.6,1;20,4.4,1;30,1,1;25,1,1;20,1.4,1;62,6.8,1;50,1,1;38,2.2,1;30,2,1;35,2.7,-1;40,0.6,-1;20,1.1,1;20,1.3,1;25,1,1;40,2.3,1;35,1.1,-1;35,1,1;80,1.18,-1;20,2.9,1;15,1.3,1;25,1,1;25,1.2,1;25,1.83,1;40,0.8,-1;35,0.9,-1;35,1,1;50,1.3,-1;20,1.2,1;20,0.7,1;60,0.8,-1;40,1.2,-1;38,0.6,-1;45,0.9,-1;40,1.7,-1;50,1.18,-1;25,2.5,1;50,1.8,-1;25,1,1;50,0.7,-1;35,1.1,-1;60,0.8,-1;40,0.7,-1;25,1.1,-1;45,0.8,-1;45,1,-1;60,1.18,-1;25,1.7,1;38,0.7,-1;60,1,-1;25,1.3,-1;60,1.1,-1;25,1.2,-1;40,1.1,-1;25,1.1,-1;45,1.18,-1;25,1.1,-1;30,1,-1;50,2.3,-1;30,1.7,1;45,1.3,-1;35,0.9,-1;38,1.1,-1;35,1.3,-1;60,1.2,1;35,1.2,-1;25,1.6,-1;60,1.3,1;40,1.2,-1;40,1,-1;60,0.7,-1;60,3.2,-1;60,0.9,-1;38,1.83,1;60,1.5,-1;38,1,-1;38,0.75,-1;30,0.9,-1;40,3.7,1;50,1.3,-1;17,2.1,1;60,0.8,-1;30,0.7,-1;35,3.4,-1;60,0.7,-1;45,6.1,-1;40,1.18,-1;60,1.3,-1;35,1.18,-1;40,1.18,-1;60,0.9,-1;25,2.1,-1;35,1,-1;30,0.8,-1;38,1.1,1;35,0.9,-1;30,0.9,-1;40,0.9,-1;25,1.7,1;30,0.7,-1;30,0.7,-1;60,1,-1;30,1.83,1;35,0.9,-1;45,2.5,1;60,0.9,-1;45,0.9,-1;35,1.18,-1;35,0.8,-1;25,1.7,-1;35,1.4,-1;25,1,-1;50,1.3,-1;45,1.1,-1;40,1.2,-1;35,0.8,-1;40,0.9,-1;35,0.9,1;30,1.1,1;38,1.3,1;60,0.7,-1;20,2.4,1;40,1,-1;35,0.8,-1;35,1.5,-1;40,0.9,-1;60,1.1,-1;20,0.8,-1;35,0.9,-1;60,1,-1;40,1,-1;50,1,-1;60,1.2,-1;40,0.7,-1;30,0.9,-1;25,1,1;25,1.2,1;38,2.5,1;25,1.2,1;30,1.5,1;50,0.6,1;25,2.1,1;40,1,-1;45,0.9,-1;35,2.1,-1;60,1.5,-1;40,0.7,-1;30,1.18,-1;20,1.6,1;45,1.8,1;38,1.18,-1;30,0.8,-1;20,1,-1;35,1.8,-1;45,0.7,-1;60,1,-1;60,0.9,-1;25,3.5,-1;40,0.7,-1;45,1,-1;40,0.8,-1;38,0.9,-1;40,1,-1;35,0.8,-1;17,1,-1;62,0.8,-1;50,1.4,-1;30,1.6,1;35,0.8,-1;35,1.3,-1;50,0.9,-1;70,9,1;35,1.1,-1;35,0.7,-1;20,1.83,1;50,1.1,-1;35,1.1,-1;25,0.8,-1;25,1,-1;60,1.4,-1;25,1.3,-1;35,1,-1;25,5,-1;25,1.2,-1;30,1.7,1;35,1.1,-1;35,0.9,-1;38,1.4,-1;45,1.1,-1;50,1.1,-1;50,1.1,-1;30,1.2,-1;40,1,-1;45,1.18,-1;35,1.3,-1;30,1.3,-1;35,1.1,-1;40,0.9,-1;38,1.8,-1;38,1.4,-1;25,1.1,1;25,2.4,-1;35,1,-1;40,1.2,-1;30,0.5,-1;35,0.8,-1;45,1,-1;35,1.2,-1;60,1,-1;30,1,-1;38,1.7,-1;38,1,-1;25,0.8,-1;50,0.7,-1;40,1,-1;40,0.7,-1;25,1.4,1;60,1,-1;38,1.2,-1;35,0.9,-1;20,1.83,1;38,1.7,-1;38,0.9,-1;35,1,-1;30,1.6,-1;40,0.9,-1;38,1.2,-1;40,0.7,-1;30,1,-1;38,0.8,-1;35,1.1,-1;38,1.1,-1;30,0.7,-1;38,1.3,-1;40,1,-1;40,2.7,-1;30,3.8,-1;38,1.1,-1;40,0.8,-1;40,1.2,-1;35,1.7,-1;55,1,-1;35,1.1,-1;38,0.9,-1;55,0.8,-1;35,1.4,-1;38,1,-1;35,0.9,-1;38,1.1,-1;38,1.2,-1;60,0.8,-1;38,1.4,-1;45,1.6,-1";

/* Standardising is not cosmetic: the kernel is an inner product, so a feature
   measured in a unit with a bigger number in it would simply weigh more. The
   notebook's own pipeline standardises for the same reason, and its Caveats
   list says so. */
function prep(raw, meta) {
  const rows = raw.split(";").map((s) => s.split(",").map(Number));
  const vals = rows.map((r) => [meta.logX ? Math.log(r[0]) : r[0], meta.logY ? Math.log(r[1]) : r[1]]);
  const n = rows.length;
  const mu = [0, 1].map((j) => vals.reduce((s, v) => s + v[j], 0) / n);
  const sd = [0, 1].map((j) => Math.sqrt(vals.reduce((s, v) => s + (v[j] - mu[j]) ** 2, 0) / n));
  const X = vals.map((v) => [(v[0] - mu[0]) / sd[0], (v[1] - mu[1]) / sd[1]]);
  const y = rows.map((r) => r[2]);
  const K = X.map((a) => X.map((b) => a[0] * b[0] + a[1] * b[1]));
  const pad = (j) => {
    const lo = Math.min(...X.map((v) => v[j])), hi = Math.max(...X.map((v) => v[j]));
    const m = (hi - lo) * 0.07;
    return [lo - m, hi + m];
  };
  return { ...meta, X, y, K, mu, sd, n, nPos: y.filter((v) => v > 0).length, domain: [pad(0), pad(1)] };
}

/* Back to the reading a clinician would recognise, for the axis ticks. */
const unstd = (d, j, z) => {
  const v = z * d.sd[j] + d.mu[j];
  return (j === 0 ? d.logX : d.logY) ? Math.exp(v) : v;
};
const std = (d, j, v) => (((j === 0 ? d.logX : d.logY) ? Math.log(v) : v) - d.mu[j]) / d.sd[j];

const STAGES = {
  crc: prep(CRC, {
    key: "crc",
    label: "Colorectal biopsies",
    detail: "194 samples, 97 with a tumour — two genes, and a gap between them",
    xName: "FXYD5", yName: "C7", axisUnit: "log₂ expression",
    xTicks: [5, 6, 7, 8, 9, 10], yTicks: [3, 5, 7, 9, 11],
    posLabel: "Adenocarcinoma", negLabel: "Normal",
    caption: "194 biopsies, 97 tumours",
  }),
  hf: prep(HF, {
    key: "hf",
    label: "Heart failure",
    detail: "299 patients, 96 deaths — 04-3's own SVC data, and no gap at all",
    xName: "Ejection fraction", yName: "Serum creatinine",
    xUnit: "%", yUnit: "mg/dL, log", logY: true,
    xTicks: [20, 30, 40, 50, 60, 70, 80], yTicks: [0.5, 1, 2, 4, 8],
    posLabel: "Died", negLabel: "Survived",
    caption: "299 patients, 96 deaths",
  }),
};

/* The ladder. A `choice` slider rather than a float: these are the rungs of a
   log scale, so left-to-right is a magnitude and the tick labels can name what
   each one does. */
const LADDER = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];

/**
 * SMO for the C-SVM dual, with LIBSVM's working set selection 1 — the maximal
 * violating pair. Deterministic: the pair is read off the gradient, so nothing
 * about the fit depends on an order or a random draw.
 *
 *     min  1/2 a'Qa - e'a    s.t.  y'a = 0,  0 <= a_i <= C,   Q_ij = y_i y_j K_ij
 *
 * G_k = sum_m Q_km a_m - 1, so y_k G_k is exactly sample k's prediction error
 * with the bias left out — which is the quantity Platt's two-variable update
 * takes as E_k, and it is why the gradient is worth carrying.
 */
function solveSVM(K, y, C, { eps = 1e-8, maxIter = 100000 } = {}) {
  const n = y.length;
  const a = new Float64Array(n);
  const G = new Float64Array(n).fill(-1);
  const inUp = (k) => (y[k] > 0 ? a[k] < C - 1e-12 : a[k] > 1e-12);
  const inLow = (k) => (y[k] > 0 ? a[k] > 1e-12 : a[k] < C - 1e-12);
  for (let iter = 0; iter < maxIter; iter += 1) {
    let i = -1, mUp = -Infinity, j = -1, mLow = Infinity;
    for (let k = 0; k < n; k += 1) {
      const v = -y[k] * G[k];
      if (v > mUp && inUp(k)) { mUp = v; i = k; }
      if (v < mLow && inLow(k)) { mLow = v; j = k; }
    }
    if (i < 0 || j < 0 || mUp - mLow < eps) break;

    const Ei = y[i] * G[i], Ej = y[j] * G[j];
    let eta = K[i][i] + K[j][j] - 2 * K[i][j];
    if (eta < 1e-12) eta = 1e-12;
    let lo, hi;
    if (y[i] !== y[j]) { lo = Math.max(0, a[j] - a[i]); hi = Math.min(C, C + a[j] - a[i]); }
    else { lo = Math.max(0, a[i] + a[j] - C); hi = Math.min(C, a[i] + a[j]); }
    if (hi - lo < 1e-15) break;
    const oldAi = a[i], oldAj = a[j];
    let aj = a[j] + (y[j] * (Ei - Ej)) / eta;
    aj = aj < lo ? lo : aj > hi ? hi : aj;
    a[i] = a[i] + y[i] * y[j] * (oldAj - aj);
    a[j] = aj;
    const di = a[i] - oldAi, dj = a[j] - oldAj;
    for (let k = 0; k < n; k += 1) {
      G[k] += y[k] * (y[i] * K[i][k] * di + y[j] * K[j][k] * dj);
    }
  }
  /* b from the FREE support vectors: 0 < a_k < C means y_k f(x_k) = 1 exactly,
     so y_k G_k is the same number for each of them and b is minus their mean.
     When every support vector is bounded there is no such k and b is only
     pinned to an interval, whose midpoint LIBSVM takes and so does this.
     Getting that fallback's sign wrong moved the boundary by 0.39 on two rungs
     WHILE w stayed exact to four decimals — the fit and the margin width both
     looked right and only the accuracy was wrong. */
  let sum = 0, cnt = 0, ub = Infinity, lb = -Infinity;
  for (let k = 0; k < n; k += 1) {
    const yG = y[k] * G[k];
    if (a[k] > 1e-12 && a[k] < C - 1e-12) { sum += yG; cnt += 1; }
    else if (inUp(k)) ub = Math.min(ub, yG);
    else if (inLow(k)) lb = Math.max(lb, yG);
  }
  return { alpha: Array.from(a), b: -(cnt > 0 ? sum / cnt : (ub + lb) / 2) };
}

/**
 * One fit, plus everything the two panels read off it. `keep` restricts which
 * samples enter the fit; the plane still knows about all of them, because the
 * claim being demonstrated is that leaving the others out changes nothing.
 *
 * This is the ONE place the fit is written. The "support vectors only" refit
 * calls it again rather than carrying a second copy of the algebra (5.8).
 */
function fitOn(d, C, keep) {
  const idx = keep ?? d.X.map((_, i) => i);
  const K = idx.map((i) => idx.map((j) => d.K[i][j]));
  const yy = idx.map((i) => d.y[i]);
  const { alpha, b } = solveSVM(K, yy, C);
  const w = [0, 1].map((j) => alpha.reduce((s, a, k) => s + a * yy[k] * d.X[idx[k]][j], 0));

  /* The decomposition by alpha, not by a float comparison on y f(x): a support
     vector is a sample with alpha > 0, a FREE one sits exactly on the margin,
     and a BOUNDED one (alpha = C) is inside it or on the wrong side. Reading
     that off the dual is exact where reading it off y f(x) = 1 needs a
     tolerance and gets the ends of the ladder wrong. */
  const sv = [], free = [], bound = [];
  idx.forEach((i, k) => {
    if (alpha[k] <= 1e-8) return;
    sv.push(i);
    (alpha[k] < C - 1e-8 ? free : bound).push(i);
  });
  const f = d.X.map((x) => w[0] * x[0] + w[1] * x[1] + b);
  const marg = d.y.map((yi, i) => yi * f[i]);
  return {
    w, b, f, marg, sv, free, bound,
    svSet: new Set(sv),
    marginW: 2 / Math.hypot(w[0], w[1]),
    wrong: marg.filter((m) => m <= 0).length,
    nFit: idx.length,
  };
}

/* --- the loss panel's frame, fixed once ---------------------------------- *
 * 2.5: fix the frame, not the data. y f(x) spreads out as C rises — on the
 * biopsies its 99th percentile runs 1.25 at C = 0.003 to 12.3 at C = 30 — so a
 * frame fitted to the data would put the elbow at 60% of the width at one end
 * of the ladder and 12% at the other, and the panel would jump under the
 * reader's hand every time they moved the dial.
 *
 * [-3, 7] instead, which holds the cohort entirely (it never passes 2.62) and
 * the biopsies up to C = 1. Past that, samples run off the right — and they
 * are all sitting on the floor at zero loss, so the honest mark is a heap at
 * the edge with its count, not a dot drawn where the sample is not. A first
 * cut used [-2.5, 3] and put 167 of 194 off frame at the DEFAULT C: the floor
 * this panel exists to show as crowded was nearly empty. */
const LOSS_X = [-3, 7];
const LOSS_Y = [0, 1 - LOSS_X[0]];
const hinge = (m) => Math.max(0, 1 - m);
const logistic = (m) => Math.log(1 + Math.exp(-m)) / Math.LN2;

/* --- geometry ------------------------------------------------------------ */
const PAD_L = 46, PAD_R = 10, PAD_T = 20, PAD_B = 42, GAP = 26, LOSS_L = 34;
const STRIP_H = 58;

function planeBox(w, d) {
  const usable = Math.max(180, w - PAD_L - PAD_R - GAP - LOSS_L);
  const side = Math.round(usable * 0.58);
  const [xd, yd] = d.domain;
  const aspect = (yd[1] - yd[0]) / (xd[1] - xd[0]);
  return { pw: side, ph: Math.round(side * aspect), lw: usable - side };
}

const heightFor = ({ w, data }) => {
  const d = STAGES[data] ?? STAGES.crc;
  return PAD_T + Math.max(planeBox(w, d).ph, 240) + PAD_B;
};

defineWidget({
  slug: "support-vector-machine",
  title: "Support Vector Machines",
  subtitle:
    "An SVM puts the widest corridor it can between the two classes, and C is the price "
    + "of letting a sample inside. Every sample beyond the corridor has loss exactly zero "
    + "and no weight, so the boundary is set by the ones inside it and touching its edge.",
  layout: "side",
  height: heightFor,
  status: "draft",

  params: {
    /* Data: what the numbers ARE. The stage comes first because everything
       below reads differently depending on which one you are in. */
    data: {
      type: "segmented",
      label: "Samples",
      options: Object.values(STAGES).map((s) => ({ value: s.key, label: s.label, detail: s.detail })),
      default: "crc",
    },
    C: {
      type: "choice",
      label: "C — the price of one violation",
      options: LADDER.map((v, i) => ({
        value: String(i),
        label: v < 1 ? String(v).replace("0.", ".") : String(v),
        /* Three bands, and they are within four characters of each other on
           purpose (3.4d): the rail jogs by a whole line if a detail wraps at
           one end of a dial and not the other, and this is a dial meant to be
           dragged end to end. The one that named sklearn's default on every
           rung was also simply false on eight of the nine. */
        detail: v <= 0.03
          ? `${v} — violations are cheap, so the corridor stays wide`
          : v >= 10
            ? `${v} — violations are dear, so the corridor pulls in`
            : `${v} — the middle of the ladder; sklearn's default is 1`,
      })),
      default: "5",
    },

    /* Display: how it is DRAWN. `only` is declared display even though it does
       re-run the fit, because its entire content is that the fit does not
       change — and there is no animation for either kind to preserve. */
    only: {
      type: "bool",
      label: "Fit on the support vectors only",
      detail: "Drop every other sample and refit. The boundary does not move.",
      default: false,
      display: true,
    },
    compare: {
      type: "bool",
      label: "Add the logistic loss",
      detail: "Widget 15's loss, on the same axis. It never reaches zero.",
      default: false,
      display: true,
    },
  },

  legend: [
    { token: "nonevent", label: "y = −1 · normal, or survived", mark: "dot" },
    { token: "event", label: "y = +1 · tumour, or died", mark: "dot" },
    { token: "ink-1", label: "Support vector — the fit depends on it", mark: "dot" },
    { token: "highlight", label: "Boundary, and the margin either side", mark: "line" },
    { token: "reference", label: "Logistic loss, for comparison", mark: "line" },
  ],

  compute({ params }) {
    const d = STAGES[params.data];
    const C = LADDER[Number(params.C)];
    const full = fitOn(d, C, null);
    const shown = params.only ? fitOn(d, C, full.sv) : full;
    /* How far the refit moved the decision surface, measured rather than
       claimed: the largest gap between the two functions over the plane. */
    let drift = 0;
    if (params.only) {
      const [xd, yd] = d.domain;
      for (let a = 0; a <= 8; a += 1) {
        for (let b = 0; b <= 8; b += 1) {
          const px = xd[0] + ((xd[1] - xd[0]) * a) / 8, py = yd[0] + ((yd[1] - yd[0]) * b) / 8;
          const g = (r) => r.w[0] * px + r.w[1] * py + r.b;
          drift = Math.max(drift, Math.abs(g(full) - g(shown)));
        }
      }
    }
    return { d, C, full, shown, drift };
  },

  draw({ ctx, colors, w, h, params, state }) {
    const { d, full, shown } = state;
    const { pw, ph, lw } = planeBox(w, d);
    const top = PAD_T + Math.max(0, (Math.max(ph, 240) - ph) / 2);

    drawPlane(ctx, colors, { x: PAD_L, y: top, w: pw, h: ph }, d, shown, full, params);
    drawLoss(
      ctx, colors,
      { x: PAD_L + pw + GAP + LOSS_L, y: PAD_T, w: lw, h: Math.max(ph, 240) },
      d, shown, params
    );
    void h;
  },

  /* THE FIRST TWO TILES ADD UP TO n, and getting that pair right took a
     correction. "Loss exactly zero" was the second tile, and at the tight end
     of the biopsies it read 194 beside 3 support vectors — a flat
     contradiction of the subtitle, and the subtitle was the thing that was
     wrong. A support vector sitting exactly ON the margin has y f(x) = 1, so
     its hinge loss is zero while its weight is not: influence is carried by
     alpha, and alpha is positive for y f(x) <= 1. The clean complementary pair
     is inside-or-touching against strictly beyond, which is exactly
     alpha > 0 against alpha = 0. */
  readout({ params, state }) {
    const { d, C, shown, drift } = state;
    const pct = Math.round((shown.sv.length / d.n) * 100);
    return [
      {
        label: "Support vectors",
        value: `${shown.sv.length} of ${d.n}`,
        note: params.only
          ? `refitted on these alone — the boundary moved ${drift < 1e-6 ? "0" : fmt(drift, 6)}`
          : `${pct}% — inside the corridor, or touching its edge`,
      },
      {
        label: "Beyond the corridor",
        value: String(d.n - shown.sv.length),
        note: "zero loss and zero weight — delete them and nothing moves",
      },
      {
        label: "Margin width",
        value: fmt(shown.marginW, 2),
        note: `2 / ‖w‖ at C = ${C}, in standardised feature units`,
      },
      {
        label: "Misclassified",
        value: `${shown.wrong} of ${d.n}`,
        note: `accuracy ${fmt(1 - shown.wrong / d.n, 3)}`,
      },
    ];
  },
});

/* --- the plane ----------------------------------------------------------- */
function drawPlane(ctx, colors, rect, d, r, full, params) {
  const [xd, yd] = d.domain;
  const plot = makePlot({ ctx, colors, rect, xDomain: xd, yDomain: yd });
  const { sx, sy } = plot;

  const inRange = (j, v) => v >= d.domain[j][0] && v <= d.domain[j][1];
  plot.grid(d.yTicks.map((v) => std(d, 1, v)).filter((v) => inRange(1, v)));
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const t of d.xTicks) {
    const z = std(d, 0, t);
    if (!inRange(0, z)) continue;
    ctx.beginPath();
    ctx.moveTo(Math.round(sx(z)) + 0.5, rect.y);
    ctx.lineTo(Math.round(sx(z)) + 0.5, rect.y + rect.h);
    ctx.stroke();
  }
  ctx.restore();

  /* The corridor as ONE quad, built from the boundary's own direction. Built
     instead from the two margin lines clipped to the panel, it folds into a bow
     tie whenever they leave through different edges — which happens on the
     cohort and never on the biopsies, so it looked correct while being wrong. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const nrm = Math.hypot(r.w[0], r.w[1]) || 1;
  const ux = -r.w[1] / nrm, uy = r.w[0] / nrm;
  const nx = r.w[0] / nrm, ny = r.w[1] / nrm;
  const off = 1 / nrm;
  const px = (-r.b * r.w[0]) / (nrm * nrm), py = (-r.b * r.w[1]) / (nrm * nrm);
  const L = 60;
  const corner = (su, sn) => [px + su * L * ux + sn * off * nx, py + su * L * uy + sn * off * ny];
  ctx.beginPath();
  [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)].forEach(([X, Y], k) =>
    (k ? ctx.lineTo(sx(X), sy(Y)) : ctx.moveTo(sx(X), sy(Y))));
  ctx.closePath();
  ctx.fillStyle = colors.highlight;
  ctx.globalAlpha = 0.09;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.highlight;
  for (const [sn, dash, width] of [[1, [4, 4], 1], [-1, [4, 4], 1], [0, null, 2]]) {
    const a = [px + L * ux + sn * off * nx, py + L * uy + sn * off * ny];
    const b = [px - L * ux + sn * off * nx, py - L * uy + sn * off * ny];
    ctx.setLineDash(dash ?? []);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(sx(a[0]), sy(a[1]));
    ctx.lineTo(sx(b[0]), sy(b[1]));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* Samples. When the fit is restricted, the ones left out are not drawn at
     all — the whole demonstration is watching them go and watching the line
     stay. A support vector keeps its own class colour and gains a ring rather
     than being recoloured: it is still a tumour or a normal, and hiding that to
     mark it would cost more than the mark is worth. */
  for (let i = 0; i < d.n; i += 1) {
    const isSV = r.svSet.has(i);
    if (params.only && !isSV) continue;
    const cx = sx(d.X[i][0]), cy = sy(d.X[i][1]);
    ctx.beginPath();
    ctx.arc(cx, cy, isSV ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fillStyle = d.y[i] > 0 ? colors.event : colors.nonevent;
    ctx.globalAlpha = isSV ? 1 : 0.32;
    ctx.fill();
    if (isSV) {
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = colors.ink1;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* One decimal below 1 and none above it, so the log creatinine axis reads
     0.5 · 1 · 2 · 4 · 8 the way a chemistry panel does. Three-decimal-places
     rules printed "0.5, 1.0, 2.0, 4, 8" — decimals on some rungs and not
     others, on one axis. */
  const fmtTick = (j) => (v) => {
    const raw = unstd(d, j, v);
    return raw < 1 ? fmt(raw, 1) : String(Math.round(raw));
  };
  plot.axisX({
    ticks: d.xTicks.map((t) => std(d, 0, t)).filter((v) => inRange(0, v)),
    format: fmtTick(0),
    label: d.xUnit ? `${d.xName} (${d.xUnit})` : `${d.xName} · ${d.axisUnit}`,
  });
  plot.axisY({
    ticks: d.yTicks.map((t) => std(d, 1, t)).filter((v) => inRange(1, v)),
    format: fmtTick(1),
    label: d.yUnit ? `${d.yName} (${d.yUnit})` : `${d.yName} · ${d.axisUnit}`,
  });
  /* The plane's caption shares a baseline with the loss panel's, and it is
     LEFT-aligned in a panel about 250px wide at the narrowest frame — so it has
     to stay short or it strokes surface-coloured straight through "Hinge loss"
     and erases it. A text sweep found that in 54 of 72 states; on screen it
     just looked like a caption. */
  plot.caption(params.only ? `Fitted on ${r.sv.length} of ${d.n}` : d.caption);
  void full;
}

/* --- the loss ------------------------------------------------------------ *
 * Two panels on one x-axis: the hinge curve above, and where the samples
 * actually sit below it.
 *
 * The samples were drawn as dots ON the curve first, which is the truer mark —
 * each sample at its own loss. At these counts it fails: 187 dots along a flat
 * floor merge into one coloured line, and a line does not say "187". Counted
 * into bins it does, and the pile past y f(x) = 1 is the panel's whole subject.
 */
function drawLoss(ctx, colors, rect, d, r, params) {
  const curveH = Math.max(90, rect.h - STRIP_H - 24);
  const plot = makePlot({
    ctx, colors, rect: { ...rect, h: curveH }, xDomain: LOSS_X, yDomain: LOSS_Y,
  });
  plot.grid([1, 2, 3]);

  if (params.compare) {
    plot.curve(
      Array.from({ length: 121 }, (_, k) => {
        const m = LOSS_X[0] + ((LOSS_X[1] - LOSS_X[0]) * k) / 120;
        return [m, logistic(m)];
      }),
      { stroke: colors.reference, width: 1.25, dash: [3, 3] }
    );
  }
  plot.curve([[LOSS_X[0], hinge(LOSS_X[0])], [1, 0], [LOSS_X[1], 0]], {
    stroke: colors.highlight, width: 2,
  });
  plot.axisY({ ticks: [0, 1, 2, 3, 4] });

  /* The distribution of y f(x), stacked by class. The last bin is an overflow:
     everything past the frame is on the floor at zero loss, so its height is
     exact and only its distance is capped. */
  const strip = {
    x: rect.x, y: rect.y + curveH + 24, w: rect.w, h: STRIP_H,
  };
  const BINS = 32;
  const counts = new Array(BINS * 2).fill(0);
  let shown = 0;
  for (let i = 0; i < d.n; i += 1) {
    if (params.only && !r.svSet.has(i)) continue;
    const t = (r.marg[i] - LOSS_X[0]) / (LOSS_X[1] - LOSS_X[0]);
    const k = Math.min(BINS - 1, Math.max(0, Math.floor(t * BINS)));
    counts[k * 2 + (d.y[i] > 0 ? 1 : 0)] += 1;
    shown += 1;
  }
  let peak = 1;
  for (let k = 0; k < BINS; k += 1) peak = Math.max(peak, counts[k * 2] + counts[k * 2 + 1]);
  const bw = strip.w / BINS;
  ctx.save();
  for (let k = 0; k < BINS; k += 1) {
    let base = 0;
    for (const [s, col] of [[0, colors.nonevent], [1, colors.event]]) {
      const n = counts[k * 2 + s];
      if (!n) continue;
      const bh = (n / peak) * strip.h;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(strip.x + k * bw, strip.y + strip.h - base - bh, Math.max(1, bw - 1), bh);
      base += bh;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* y f(x) = 1 is the margin, and it is the same line as the corridor's edge on
     the plane — everything left of it is a support vector. */
  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  const mx = Math.round(plot.sx(1)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(mx, rect.y);
  ctx.lineTo(mx, strip.y + strip.h);
  ctx.stroke();
  ctx.restore();

  const stripPlot = makePlot({ ctx, colors, rect: strip, xDomain: LOSS_X, yDomain: [0, peak] });
  stripPlot.axisX({ ticks: [-2, 0, 1, 2, 4, 6], label: "y f(x), in margins" });
  plot.caption("Hinge loss");
  plot.note(`${d.n - r.sv.length} at zero`);
  stripPlot.caption(params.only ? `The ${shown} that are left` : `All ${shown}, counted`);
}
