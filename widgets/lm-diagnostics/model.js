// model.js — the lm-diagnostics machinery.
//
// The lm-model.js arrangement: one copy that the measure script and the
// mock-ups import, and that moves into widgets/lm-diagnostics/ when the
// widget is built — the numbers Kenneth reviews in a mock-up and the
// numbers the widget ships are the same numbers because they come from
// the same functions.
//
// What lives here and why:
//   qnorm        — inverse normal CDF, needed for the Q-Q panel's
//                  theoretical quantiles (R's ppoints, a = 1/2 for n > 10)
//   diagnostics  — residuals, leverage, standardized residuals
//                  (R's rstandard), sorted Q-Q pairs, and the quartile
//                  line stats::qqline draws. Verified against 05-01's
//                  stored autoplot: the three rows it labels (404, 1003,
//                  1668) are this pipeline's three largest |stdres|.
//   loessAt      — local-linear tricube smoother (loess degree 1, no
//                  robustness pass) for the Residuals-vs-Fitted trend.
//                  A mark, not a printed number: it needs to tell flat
//                  from bowed honestly, not reproduce ggplot's smoother.
//   makeSynth    — the assumption-breaking generator: the real BMI xs,
//                  y = b0 + b1·x + curve·(x − x̄)² + eps, with eps
//                  optionally fanning (SD ramps across the 1%–99% BMI
//                  window — ramping over the full range hid the fan in
//                  the outlier tail, measured) or skewed (standardized
//                  log-normal). Seeded: pass an rng.

import { ols } from "../lm-least-squares/model.js";

/* qnorm — Acklam's rational approximation, |error| < 1.15e-9 over (0,1).
   Checked against R's qnorm in lm-diag-measure.mjs. */
export function qnorm(p) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/* The diagnostic pipeline: simple-regression leverage is closed-form,
   which is what keeps this O(n) and exact. */
export function diagnostics(y, x) {
  const fit = ols(y, x);
  const n = y.length;
  const resid = y.map((yi, i) => yi - fit.fitted[i]);
  const xbar = mean(x);
  const sxx = x.reduce((s, v) => s + (v - xbar) ** 2, 0);
  const lev = x.map((v) => 1 / n + (v - xbar) ** 2 / sxx);
  const sigma = Math.sqrt(fit.sigma2);
  const std = resid.map((e, i) => e / (sigma * Math.sqrt(1 - lev[i])));
  /* sorted Q-Q pairs: i-th order statistic against qnorm((i + 0.5) / n) */
  const order = std.map((v, i) => i).sort((a, b) => std[a] - std[b]);
  const qq = order.map((idx, i) => ({ th: qnorm((i + 0.5) / n), std: std[idx], idx }));
  /* qqline through the quartiles, as stats::qqline draws it */
  const qs = order.map((i) => std[i]);
  const quart = (p) => qs[Math.floor(p * (n - 1))];
  const slope = (quart(0.75) - quart(0.25)) / (qnorm(0.75) - qnorm(0.25));
  const inter = quart(0.25) - slope * qnorm(0.25);
  return { fit, resid, lev, std, qq, line: { slope, inter } };
}

/* Local-linear tricube smoother, evaluated at `grid`. */
export function loessAt(xs, ys, span, grid) {
  const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b]);
  const sx = idx.map((i) => xs[i]);
  const sy = idx.map((i) => ys[i]);
  const k = Math.max(2, Math.ceil(span * xs.length));
  return grid.map((g) => {
    /* window of the k nearest by x: binary search then expand */
    let lo = 0;
    let hi = sx.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (sx[m] < g) lo = m + 1;
      else hi = m;
    }
    let a = lo;
    let b = lo;
    while (b - a < k) {
      if (a === 0) b += 1;
      else if (b === sx.length) a -= 1;
      else if (g - sx[a - 1] <= sx[b] - g) a -= 1;
      else b += 1;
    }
    const h = Math.max(g - sx[a], sx[b - 1] - g) || 1;
    let sw = 0;
    let swx = 0;
    let swy = 0;
    let swxx = 0;
    let swxy = 0;
    for (let i = a; i < b; i += 1) {
      const u = Math.abs(sx[i] - g) / h;
      const w = u >= 1 ? 0 : (1 - u ** 3) ** 3;
      sw += w;
      swx += w * sx[i];
      swy += w * sy[i];
      swxx += w * sx[i] * sx[i];
      swxy += w * sx[i] * sy[i];
    }
    const det = sw * swxx - swx * swx;
    if (Math.abs(det) < 1e-12) return swy / sw;
    const beta = (sw * swxy - swx * swy) / det;
    const alpha = (swy - beta * swx) / sw;
    return alpha + beta * g;
  });
}

/* The assumption-breaking generator, built once over a covariate vector.
   Returns synth(rng, { curve, fan, skewed }) → y array. The fan ramps
   the noise SD across the 1%–99% window of x — measured: ramping over
   the full range spends most of the ramp on the outlier tail and the
   fan never shows where the data is. */
export function makeSynth(x, b0, b1, sigma) {
  const xbar = mean(x);
  const sorted = [...x].sort((a, b) => a - b);
  const q01 = sorted[Math.floor(0.01 * x.length)];
  const q99 = sorted[Math.floor(0.99 * x.length)];
  const LN_S = 0.6;
  const lnMean = Math.exp(LN_S * LN_S / 2);
  const lnSd = Math.sqrt((Math.exp(LN_S * LN_S) - 1) * Math.exp(LN_S * LN_S));
  return (rng, { curve = 0, fan = 0, skewed = false } = {}) =>
    x.map((xi) => {
      const u = Math.min(1, Math.max(0, (xi - q01) / (q99 - q01)));
      const s = sigma * (1 + fan * u);
      const e = skewed
        ? ((Math.exp(LN_S * rng.normal()) - lnMean) / lnSd) * s
        : rng.normal(0, s);
      return b0 + b1 * xi + curve * (xi - xbar) ** 2 + e;
    });
}
