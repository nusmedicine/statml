/* limma's engine — a protein table whose variances follow limma's own prior,
 * each protein's ordinary t, limma's fitFDist and the moderated t. Measured in
 * `_lab/proteomics-arc-measure.mjs` and mocked in `_lab/limma-mock.html`
 * (catalogue § Slot 90); the arithmetic is the arc model's part C, which
 * refitted from 01-4's own abundances reproduces the lesson's
 * `limma_t_statistic` to 1e-10 (d0 3.09, s0 0.33, 20 residual df).
 *
 * One change from the arc model, on purpose: the simulation draws every
 * protein's 11 cancer and 11 healthy values once, and Replicates n takes the
 * FIRST n of each group. So 3 vs 3 and 11 vs 11 are the same proteins with the
 * same truth, measured in fewer samples — which is what the control claims.
 * The arc model drew a fresh table for each n.
 */
import { tTailP } from "../core/stats.js";

export const PROTEINS = 1337;          // 01-4's table
export const D0 = 3, S0 = 0.33;        // the lesson's fitted prior (01-4 refit: d0 3.09, s0 0.333)
export const DE_SHARE = 0.1, FC_LO = 0.5, FC_HI = 1.5;
export const MAX_N = 11;               // the lesson's 11 cancer, 11 healthy

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function variance(a) {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}

/** Benjamini–Hochberg adjusted p-values, in the input order. */
export function bh(p) {
  const m = p.length;
  const idx = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
  const out = new Array(m);
  let run = 1;
  for (let r = m - 1; r >= 0; r -= 1) {
    run = Math.min(run, (p[idx[r]] * m) / (r + 1));
    out[idx[r]] = run;
  }
  return out;
}

/** Every protein's truth and all 22 values. Truth first, then values, so a
    protein's truth does not depend on how many samples are read from it. */
export function simulate(rng) {
  const meta = [];
  for (let p = 0; p < PROTEINS; p += 1) {
    let chi = 0;
    for (let k = 0; k < D0; k += 1) chi += rng.normal() ** 2;
    const sigma2 = (D0 * S0 * S0) / chi;
    const de = rng.next() < DE_SHARE;
    const fc = de ? (rng.next() < 0.5 ? -1 : 1) * rng.uniform(FC_LO, FC_HI) : 0;
    meta.push({ sigma2, de, fc, mu: rng.normal(24, 2) });
  }
  const cancer = [], healthy = [];
  meta.forEach(({ sigma2, fc, mu }) => {
    const s = Math.sqrt(sigma2);
    cancer.push(Array.from({ length: MAX_N }, () => rng.normal(mu + fc / 2, s)));
    healthy.push(Array.from({ length: MAX_N }, () => rng.normal(mu - fc / 2, s)));
  });
  return { meta, cancer, healthy };
}

/* ------------------------------------------------------------ limma */

export function digamma(x) {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
export function trigamma(x) {
  let r = 0;
  while (x < 6) { r += 1 / (x * x); x += 1; }
  const f = 1 / (x * x);
  return r + 1 / x + f / 2 + (f / x) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30)));
}
function tetragamma(x) {
  let r = 0;
  while (x < 6) { r -= 2 / (x * x * x); x += 1; }
  const f = 1 / (x * x);
  return r - f - f / x - f * f * (1 / 2 - f * (1 / 6 - f * (1 / 6 - (f * 3) / 10)));
}
/** limma's trigammaInverse: Newton's method, y += tri·(1 − tri/x) / ψ₂(y). */
export function trigammaInverse(x) {
  if (x > 1e7) return 1 / Math.sqrt(x);
  if (x < 1e-6) return 1 / x;
  let y = 0.5 + 1 / x;
  for (let i = 0; i < 50; i += 1) {
    const tri = trigamma(y);
    const d = (tri * (1 - tri / x)) / tetragamma(y);
    y += d;
    if (-d / y < 1e-8) break;
  }
  return y;
}
/** limma's fitFDist with a common df: the prior df d0 and prior variance s0²
    from the spread of log s² across proteins, by the method of moments. */
export function fitFDist(s2, df) {
  const z = s2.filter((v) => v > 0).map(Math.log);
  const e = z.map((v) => v - digamma(df / 2) + Math.log(df / 2));
  const emean = mean(e);
  const evar = variance(e) - trigamma(df / 2);
  if (evar <= 0) return { d0: Infinity, s02: Math.exp(emean) };
  const d0 = 2 * trigammaInverse(evar);
  const s02 = Math.exp(emean + digamma(d0 / 2) - Math.log(d0 / 2));
  return { d0, s02 };
}

/** The pooled two-sample t (what lmFit fits with one group factor). */
export function pooledT(a, b) {
  const df = a.length + b.length - 2;
  const s2 = ((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / df;
  const diff = mean(a) - mean(b);
  const unscaled = 1 / a.length + 1 / b.length;
  const t = diff / Math.sqrt(s2 * unscaled);
  return { diff, s2, df, t, p: tTailP(Math.abs(t), df), unscaled };
}

/** limma at n vs n: the ordinary t, the fitted prior, the moderated variance and t. */
export function fit(sim, n) {
  const fits = sim.cancer.map((c, i) => pooledT(c.slice(0, n), sim.healthy[i].slice(0, n)));
  const df = fits[0].df;
  const prior = fitFDist(fits.map((f) => f.s2), df);
  const { d0, s02 } = prior;
  const out = fits.map((f) => {
    const s2post = Number.isFinite(d0) ? (d0 * s02 + df * f.s2) / (d0 + df) : s02;
    const tMod = f.diff / Math.sqrt(s2post * f.unscaled);
    const pMod = Number.isFinite(d0) ? tTailP(Math.abs(tMod), df + d0) : tTailP(Math.abs(tMod), 1e6);
    return { ...f, s2post, tMod, pMod };
  });
  return { prior, df, fits: out };
}

/* ------------------------------------------------------------ the prior's curve */

function lgamma(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let s = 1.000000000190015;
  for (const c of g) s += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * s) / x);
}
/** The density of log10(own SD) the fitted prior predicts: under limma's model
    s²/s0² ~ F(df, d0), so this is the curve fitFDist matched to the histogram. */
export function priorDensityLog10(u, df, d0, s02) {
  const x = 10 ** (2 * u) / s02;
  const lf = (df / 2) * Math.log(df / d0) + (df / 2 - 1) * Math.log(x) - ((df + d0) / 2) * Math.log(1 + (df * x) / d0)
    - (lgamma(df / 2) + lgamma(d0 / 2) - lgamma((df + d0) / 2));
  return Math.exp(lf) * x * 2 * Math.LN10;
}

/** One protein's curve over log10 σ, peak 1: a scaled inverse χ² with nu
    degrees of freedom and scale tau2, as a function of ln σ². Its peak is at
    σ² = tau2 exactly — so the likelihood (nu = d, tau2 = s²) peaks at the own
    SD, the prior (d0, s0²) at s0, and their product (d + d0, s̃²) at the
    moderated SD. */
export function logSdCurve(nu, tau2) {
  const zc = Math.log(tau2);
  return (u) => {
    const z = 2 * Math.LN10 * u;
    return Math.exp(-(nu / 2) * (z - zc) - (nu / 2) * (Math.exp(zc - z) - 1));
  };
}

/* ------------------------------------------------------------ the examples */
export function pickExamples(sim, fitted) {
  const own = fitted.fits.map((x) => Math.sqrt(x.s2));
  const ids = own.map((_, i) => i);
  const nulls = ids.filter((i) => !sim.meta[i].de), des = ids.filter((i) => sim.meta[i].de);
  const byP = ids.slice().sort((a, b) => fitted.fits[a].p - fitted.fits[b].p).slice(0, 60);
  const topNull = byP.filter((i) => !sim.meta[i].de);
  const small = (topNull.length ? topNull : nulls).slice().sort((a, b) => own[a] - own[b])[0];
  const sorted = own.slice().sort((a, b) => a - b);
  const near = (target, pool) => pool.slice().sort((a, b) => Math.abs(Math.log(own[a] / target)) - Math.abs(Math.log(own[b] / target)))[0];
  const typical = near(sorted[Math.floor(PROTEINS / 2)], des.filter((i) => i !== small));
  /* among the truly different proteins with an own SD in the top 15%, the one
     the test sees best: an unlucky draw whose sample log2FC came out near 0 at
     11 vs 11 made a poor example of what moderation does to a large SD */
  const wide = des.filter((i) => i !== small && i !== typical && own[i] >= sorted[Math.floor(PROTEINS * 0.85)] && own[i] <= sorted[Math.floor(PROTEINS * 0.97)]);
  const large = wide.length
    ? wide.slice().sort((a, b) => Math.abs(fitted.fits[b].t) - Math.abs(fitted.fits[a].t))[0]
    : near(sorted[Math.floor(PROTEINS * 0.95)], des.filter((i) => i !== small && i !== typical));
  return { small, typical, large };
}
