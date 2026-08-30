/* ============================================================================
   Widget 35 candidate `metrics` — round-0 measurements, taken BEFORE the mock.

   Two acts, both simulated (Kenneth 2026-08-30: simulated data for clarity,
   healthcare-framed, realistic values), and every dial below is chosen by
   these numbers rather than by feel:

   NUMERIC — predicting body fat % (the notebook 04-2 numeric example).
     actual_i ~ Normal(19, 8) clipped to [5, 40]  (bodyfat.csv: mean 19.2, SD 8.4)
     pred_i   = actual_i + Normal(0, sigma)        (sigma = the model-quality dial)
     outliers: k points get an extra +/-MAG error  (the MSE-vs-MAE split)
   Questions: which sigma range keeps R^2 in a teaching band; how big must one
   outlier be for RMSE to move visibly while MAE barely does; does the
   mean-model read R^2 = 0 on screen.

   CATEGORICAL — a screening/prognosis cohort, confusion-matrix act.
     latent score: event ~ N(+d/2, 1), no event ~ N(-d/2, 1)
     the model is the PLUG-IN rule a logistic regression trained on data of
     this prevalence applies at the default 0.5 cutoff: predict positive iff
     z >= log((1-p)/p) / d   (the cutoff SHIFTS with imbalance — that is the
     notebook's own cell-25 behaviour, class_weight absent)
   Questions: at which (d, prevalence) does the accuracy trap fire — accuracy
   climbing while recall collapses and the all-negative baseline nearly ties;
   and the fixed-midpoint comparison that shows why the plug-in generator is
   the honest one (a fixed cutoff holds every rate constant, no trap).

   Run: node widgets/_lab/metrics-measure.mjs
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { mean, sd } from "../core/stats.js";

const erf = (x) => {
  // Abramowitz-Stegun 7.1.26, |err| < 1.5e-7 — plenty for design numbers
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
};
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const pad = (s, w) => String(s).padStart(w);

/* ---------------------------------------------------------------- numeric */

function numericCohort(rng, { n, sigma, outliers = 0, mag = 18 }) {
  const actual = [];
  for (let i = 0; i < n; i += 1) {
    let a = rng.normal(19, 8);
    a = Math.min(40, Math.max(5, a));
    actual.push(a);
  }
  const pred = actual.map((a) => a + rng.normal(0, sigma));
  // outliers: the k largest-actual points get a big signed miss, so they sit
  // in a consistent screen region rather than anywhere the seed likes
  const order = actual.map((a, i) => [a, i]).sort((p, q) => q[0] - p[0]);
  for (let k = 0; k < outliers && k < n; k += 1) {
    const i = order[k][1];
    pred[i] = actual[i] + (k % 2 === 0 ? -mag : mag);
  }
  // keep predictions in a plausible printable band (a negative body fat is
  // exactly the bizarre value Kenneth ruled out)
  for (let i = 0; i < n; i += 1) pred[i] = Math.min(48, Math.max(0, pred[i]));
  return { actual, pred };
}

function numericMetrics(actual, pred) {
  const n = actual.length;
  let se = 0;
  let ae = 0;
  for (let i = 0; i < n; i += 1) {
    const e = pred[i] - actual[i];
    se += e * e;
    ae += Math.abs(e);
  }
  const mse = se / n;
  const ybar = mean(actual);
  let sst = 0;
  for (const a of actual) sst += (a - ybar) * (a - ybar);
  return { mse, rmse: Math.sqrt(mse), mae: ae / n, r2: 1 - se / sst };
}

function sweepNumeric() {
  console.log("== NUMERIC ACT: body fat, pred = actual + N(0, sigma) ==\n");
  const SEEDS = 60;
  const n = 40;

  console.log("-- sigma dial (n=40, no outliers), mean over 60 seeds --");
  console.log("sigma   RMSE       MAE        R2");
  for (const sigma of [1, 2, 3, 4, 6, 8, 10]) {
    const rows = [];
    for (let s = 1; s <= SEEDS; s += 1) {
      const { actual, pred } = numericCohort(makeRng(s), { n, sigma });
      rows.push(numericMetrics(actual, pred));
    }
    const m = (k) => mean(rows.map((r) => r[k]));
    const v = (k) => sd(rows.map((r) => r[k]));
    console.log(
      `${pad(sigma, 5)}   ${f2(m("rmse"))}±${f2(v("rmse"))}  ${f2(m("mae"))}±${f2(v("mae"))}  ${f3(m("r2"))}±${f3(v("r2"))}`,
    );
  }

  console.log("\n-- outliers at sigma=3 (n=40), magnitude 18: the MSE/MAE split --");
  console.log("k    RMSE           MAE            R2       dRMSE%  dMAE%");
  const base = [];
  for (const k of [0, 1, 2, 3]) {
    const rows = [];
    for (let s = 1; s <= SEEDS; s += 1) {
      const { actual, pred } = numericCohort(makeRng(s), { n, sigma: 3, outliers: k });
      rows.push(numericMetrics(actual, pred));
    }
    const m = (key) => mean(rows.map((r) => r[key]));
    if (k === 0) base.push(m("rmse"), m("mae"));
    console.log(
      `${k}    ${f2(m("rmse"))}          ${f2(m("mae"))}          ${f3(m("r2"))}   ${pad(f2((100 * (m("rmse") - base[0])) / base[0]), 6)}  ${pad(f2((100 * (m("mae") - base[1])) / base[1]), 6)}`,
    );
  }

  console.log("\n-- outlier magnitude at k=1, sigma=3 --");
  console.log("mag   RMSE     MAE      (one point's pull on each)");
  for (const mag of [10, 14, 18, 22]) {
    const rows = [];
    for (let s = 1; s <= SEEDS; s += 1) {
      const { actual, pred } = numericCohort(makeRng(s), { n, sigma: 3, outliers: 1, mag });
      rows.push(numericMetrics(actual, pred));
    }
    const m = (key) => mean(rows.map((r) => r[key]));
    console.log(`${pad(mag, 3)}   ${f2(m("rmse"))}    ${f2(m("mae"))}`);
  }

  console.log("\n-- the mean model (pred_i = ybar for every i): R2 should read ~0 --");
  {
    const rows = [];
    for (let s = 1; s <= SEEDS; s += 1) {
      const { actual } = numericCohort(makeRng(s), { n, sigma: 3 });
      const ybar = mean(actual);
      rows.push(numericMetrics(actual, actual.map(() => ybar)));
    }
    const m = (key) => mean(rows.map((r) => r[key]));
    console.log(
      `RMSE ${f2(m("rmse"))} (= SD of actual, ${f2(mean(rows.map(() => 0)) + m("rmse"))})  MAE ${f2(m("mae"))}  R2 ${f3(m("r2"))}`,
    );
  }

  console.log("\n-- one seed, the shipping default candidate (seed 1, sigma 3, k 0) --");
  {
    const { actual, pred } = numericCohort(makeRng(1), { n, sigma: 3 });
    const r = numericMetrics(actual, pred);
    const lo = Math.min(...actual, ...pred);
    const hi = Math.max(...actual, ...pred);
    console.log(
      `range [${f2(lo)}, ${f2(hi)}] %  RMSE ${f2(r.rmse)}  MAE ${f2(r.mae)}  R2 ${f3(r.r2)}`,
    );
  }
}

/* ------------------------------------------------------------ categorical */

function categoricalCohort(rng, { n, prev, d, rule }) {
  // rule "plugin": cutoff log((1-p)/p)/d on the latent scale (what a default
  //               logistic regression trained at this prevalence does at 0.5)
  // rule "mid":   cutoff 0 (a fixed midpoint — the comparison generator)
  const cut = rule === "plugin" ? Math.log((1 - prev) / prev) / d : 0;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < n; i += 1) {
    const event = rng.next() < prev;
    const z = rng.normal(event ? d / 2 : -d / 2, 1);
    const predPos = z >= cut;
    if (event && predPos) tp += 1;
    else if (event) fn += 1;
    else if (predPos) fp += 1;
    else tn += 1;
  }
  return { tp, fp, tn, fn };
}

function categoricalMetrics({ tp, fp, tn, fn }) {
  const n = tp + fp + tn + fn;
  const acc = (tp + tn) / n;
  const prec = tp + fp ? tp / (tp + fp) : NaN;
  const rec = tp + fn ? tp / (tp + fn) : NaN;
  const f1 = Number.isFinite(prec) && Number.isFinite(rec) && prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : NaN;
  return { acc, prec, rec, f1 };
}

function sweepCategorical() {
  console.log("\n\n== CATEGORICAL ACT: confusion matrix, plug-in rule at 0.5 ==\n");
  const SEEDS = 60;
  const n = 200;

  for (const rule of ["plugin", "mid"]) {
    console.log(
      rule === "plugin"
        ? "-- PLUG-IN rule (the trap generator): cutoff moves with prevalence --"
        : "\n-- FIXED midpoint (the comparison): nothing moves, no trap --",
    );
    console.log("d     prev   acc     prec    rec     f1      base(1-p)  th.sens th.spec");
    for (const d of [1, 1.5, 2]) {
      for (const prev of [0.5, 0.3, 0.2, 0.1, 0.05]) {
        const rows = [];
        for (let s = 1; s <= SEEDS; s += 1) {
          rows.push(categoricalMetrics(categoricalCohort(makeRng(s), { n, prev, d, rule })));
        }
        const m = (key) => mean(rows.map((r) => r[key]).filter(Number.isFinite));
        const cut = rule === "plugin" ? Math.log((1 - prev) / prev) / d : 0;
        const sens = 1 - phi(cut - d / 2);
        const spec = phi(cut + d / 2);
        console.log(
          `${pad(d, 3)}   ${pad(prev, 4)}   ${f3(m("acc"))}  ${f3(m("prec"))}  ${f3(m("rec"))}  ${f3(m("f1"))}  ${pad(f3(1 - prev), 9)}  ${f3(sens)}  ${f3(spec)}`,
        );
      }
    }
  }

  console.log("\n-- one seed, shipping default candidate (seed 1, d 1.5, prev 0.3, plugin) --");
  {
    const cells = categoricalCohort(makeRng(1), { n, prev: 0.3, d: 1.5, rule: "plugin" });
    const r = categoricalMetrics(cells);
    console.log(
      `cells TP ${cells.tp} FP ${cells.fp} FN ${cells.fn} TN ${cells.tn}   acc ${f3(r.acc)} prec ${f3(r.prec)} rec ${f3(r.rec)} f1 ${f3(r.f1)}`,
    );
  }
  {
    const cells = categoricalCohort(makeRng(1), { n, prev: 0.1, d: 1.5, rule: "plugin" });
    const r = categoricalMetrics(cells);
    console.log(
      `same at prev 0.1: TP ${cells.tp} FP ${cells.fp} FN ${cells.fn} TN ${cells.tn}   acc ${f3(r.acc)} prec ${f3(r.prec)} rec ${f3(r.rec)} f1 ${f3(r.f1)}`,
    );
  }
}

sweepNumeric();
sweepCategorical();
