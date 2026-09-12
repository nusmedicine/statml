/* Planning measurement for the GWAS arc's `mendelian-randomization` slot (60),
 * PHM5003 week 6, notebook `03 - MR.ipynb`. Kenneth's plan-level calls
 * (2026-09-12, step by step): four steps; the two GWAS as SUMMARY STATISTICS
 * at the lesson's own sample sizes, with a visible cohort on step 1 only; the
 * confounders unnamed, as the lesson draws them; the independence violation
 * as one arrow from the confounders to the variants, stratification named in
 * the detail; harmonise as a toggle; a SNP-count control 20 · 40 · 79 opening
 * on 79; BMI in SD and coronary heart disease in log odds; step 1 the
 * causal-structures stage with the genotype centroids; an Estimator control
 * IVW · MR Egger · Weighted median · All; four controls for the violations.
 *
 * What this script has to settle before a mock is worth drawing:
 *
 *   1. THE LESSON'S SHAPE. `mr(dat)` on ieu-a-2 → ieu-a-7 gives, over 79
 *      SNPs, IVW 0.446 (SE 0.059), MR Egger 0.502 (SE 0.144), weighted median
 *      0.387 (SE 0.073). The exposure GWAS is n ≈ 339,000 and its instruments'
 *      SEs are ≈ 0.003; the outcome GWAS is n = 184,305 with SEs ≈ 0.009 to
 *      0.012. Does a summary-level simulation at those sizes, with a true
 *      effect of 0.45 log odds per SD and no violation, land where the lesson
 *      did — and does Egger's SE come out two to three times IVW's, as it did?
 *   2. PLEIOTROPY. As the share of SNPs with a direct path to the outcome
 *      rises 0 → 30% → 60%, all in one direction: IVW bends, Egger's intercept
 *      leaves zero while its slope holds, and the median holds at 30% and
 *      breaks at 60%. Each is a claim the widget will print; each is checked.
 *   3. INSTRUMENT STRENGTH. The exposure GWAS shrinks until the mean F falls
 *      through 10. In two samples the estimate is dragged toward null; in one
 *      sample, toward the confounded observational value. Which sizes make
 *      strong · moderate · weak three different pictures?
 *   4. THE CONFOUNDER-TO-VARIANT ARROW. A shared term in every SNP's two
 *      effects. All three estimators should move together, and Egger's
 *      intercept should NOT rescue it — InSIDE fails because the term sits in
 *      the exposure effect too.
 *   5. HARMONISING. With half the outcome effects reported for the other
 *      allele, how far does IVW fall? Far enough that a toggle teaches.
 *   6. THE SNP COUNT. 20 · 40 · 79: IVW's SE at each, so the control's
 *      three settings are three different intervals.
 *   7. STEP 1'S COHORT. One visible SNP on a cohort the browser can draw: at
 *      which n and per-allele effect are the three genotype centroids
 *      separable, and does the single-SNP ratio's interval exclude the
 *      confounded observational slope often enough to make the point?
 *      Measured on the liability scale (the pick's scatter) and on binary
 *      CHD (what a person actually has), so the mock can show the cost.
 *   8. TIME. One compute at m = 79 with the median's bootstrap.
 *
 * Every number below is the model's. The lesson's numbers are quoted from its
 * saved outputs and are never recomputed here.
 *
 * Run: node widgets/_lab/mr-measure.mjs
 */

import { makeRng } from "../core/rng.js";

let checks = 0;
let failed = 0;
function check(cond, msg) {
  checks += 1;
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${msg}`);
  }
}

const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pad = (s, w) => String(s).padStart(w);
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sdOf = (v) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
};

/* ==========================================================================
   The lesson's numbers, quoted.
   ========================================================================== */
const LESSON = {
  m: 79,
  ivw: 0.446, ivwSe: 0.059,
  egger: 0.502, eggerSe: 0.144,
  median: 0.387, medianSe: 0.073,
  nX: 339152, nY: 184305,
  /* ieu-a-7 is CARDIoGRAMplusC4D: 60,801 cases of 184,305. */
  caseFrac: 60801 / 184305,
};

/* ==========================================================================
   The engine — what model.js will carry.

   INSTRUMENTS. m SNPs, each with an allele frequency and a true per-allele
   effect on BMI in SD units, oriented so the effect allele RAISES BMI (what
   TwoSampleMR's scatter does — the lesson's x axis is all positive). The
   lesson's 79 run from 0.017 to 0.08 with most between 0.02 and 0.035: a
   floor plus an exponential tail reproduces that.

   THE TRUE OUTCOME EFFECT of SNP j is θ·βX_j, plus a direct effect α_j on the
   pleiotropic SNPs (exclusion restriction broken), plus δ·c_j where c_j is the
   SNP's association with the confounders (independence broken; the same c_j
   also adds γ·c_j to the exposure effect, which is why Egger cannot fix it).

   THE TWO GWAS return each true effect plus sampling error at the lesson's
   sizes. Exposure SE per allele: √((1 − b²)/nX) / √(2pq) with b the
   standardised effect. Outcome SE per allele on the log-odds scale:
   1 / √(2pq · nY · φ(1 − φ)) with φ the case fraction. In ONE sample the two
   errors share their people and correlate at ρ, the observational correlation
   of BMI and CHD liability; in TWO they are independent.
   ========================================================================== */

function drawInstruments(rng, m) {
  const p = new Float64Array(m);
  const bx = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    p[j] = rng.uniform(0.1, 0.9);
    bx[j] = Math.min(0.09, 0.017 + rng.exponential(1 / 0.011));
  }
  return { p, bx };
}

/* Confounding: the confounders' effects on BMI (SD per SD) and on CHD
   liability (log odds per SD). Observational slope on the liability scale is
   θ + γδ when var(X) = 1. */
const CONFOUNDING = {
  none: { gamma: 0, delta: 0 },
  moderate: { gamma: 0.3, delta: 0.3 },
  strong: { gamma: 0.5, delta: 0.5 },
};

function obsCorrelation(theta, gamma, delta) {
  /* X = γU + eX with var 1; L = θX + δU + eL with var(eL) = 1. */
  const cov = theta + gamma * delta;
  const varL = theta * theta + delta * delta + 2 * theta * gamma * delta + 1;
  return cov / Math.sqrt(varL);
}

function summaryStats(rng, inst, cfg) {
  const {
    theta = 0.45, nX = LESSON.nX, nY = LESSON.nY, caseFrac = LESSON.caseFrac,
    share = 0, alphaMean = 0.02, strat = 0, gamma = 0, delta = 0,
    oneSample = false, flipFrac = 0, harmonised = true, tau = 0,
  } = cfg;
  const m = inst.p.length;
  const bxHat = new Float64Array(m);
  const sx = new Float64Array(m);
  const byHat = new Float64Array(m);
  const sy = new Float64Array(m);
  const valid = new Uint8Array(m).fill(1);
  const flipped = new Uint8Array(m);
  /* Which SNPs carry the direct path: the first round(share·m) of a seeded
     shuffle, so the set grows with the share rather than being redrawn. */
  const order = rng.shuffle([...Array(m).keys()]);
  const k = Math.round(share * m);
  for (let i = 0; i < k; i += 1) valid[order[i]] = 0;
  const rho = oneSample ? obsCorrelation(theta, gamma, delta) : 0;
  const nOut = oneSample ? nX : nY;
  for (let j = 0; j < m; j += 1) {
    const pq2 = 2 * inst.p[j] * (1 - inst.p[j]);
    const s = Math.sqrt(pq2);
    /* The confounder term: c_j confounder-SD per allele, EITHER sign — an
       allele-frequency difference between ancestries has no preferred sign
       relative to the BMI-raising allele. FIRST WRITTEN AS one-signed and
       nearly constant across SNPs, which Egger absorbed as an intercept;
       the mechanism that breaks InSIDE is the term sitting in BOTH effects,
       and that needs it to vary. */
    const c = strat > 0 ? rng.normal(0, strat) : 0;
    const bxTrue = inst.bx[j] + gamma * c;
    /* Heterogeneity: a mean-zero direct effect on EVERY SNP — what the
       lesson's own scatter shows and what makes its intervals twice a clean
       simulation's (section 1). The one-signed direct effect on the
       pleiotropic share sits on top of it. */
    const alpha = (valid[j] ? 0 : alphaMean * (0.5 + rng.next())) + (tau > 0 ? rng.normal(0, tau) : 0);
    const byTrue = theta * bxTrue + alpha + delta * c;
    const bStd = bxTrue * s;
    sx[j] = Math.sqrt(Math.max(1 - bStd * bStd, 1e-9) / nX) / s;
    sy[j] = 1 / Math.sqrt(pq2 * nOut * caseFrac * (1 - caseFrac));
    const z1 = rng.normal();
    const z2 = rho * z1 + Math.sqrt(1 - rho * rho) * rng.normal();
    bxHat[j] = bxTrue + sx[j] * z1;
    byHat[j] = byTrue + sy[j] * z2;
    /* The outcome GWAS reports on its own effect allele; for a share of
       SNPs that is the other one, and the sign is wrong until harmonised. */
    if (rng.next() < flipFrac) {
      flipped[j] = 1;
      if (!harmonised) byHat[j] = -byHat[j];
    }
  }
  return { bxHat, sx, byHat, sy, valid, flipped };
}

/* ---- the three estimators, TwoSampleMR's conventions ---------------------- */

/** mr_ivw: lm(by ~ -1 + bx, weights 1/sy²); SE × max(1, σ). */
function ivw(S) {
  const m = S.bxHat.length;
  let sxy = 0;
  let sxx = 0;
  for (let j = 0; j < m; j += 1) {
    const w = 1 / (S.sy[j] * S.sy[j]);
    sxy += w * S.bxHat[j] * S.byHat[j];
    sxx += w * S.bxHat[j] * S.bxHat[j];
  }
  const b = sxy / sxx;
  let rss = 0;
  for (let j = 0; j < m; j += 1) {
    const w = 1 / (S.sy[j] * S.sy[j]);
    rss += w * (S.byHat[j] - b * S.bxHat[j]) ** 2;
  }
  const sigma = Math.sqrt(rss / (m - 1));
  return { b, se: Math.sqrt(1 / sxx) * Math.max(1, sigma), sigma };
}

/** mr_egger_regression: lm(by ~ bx, weights 1/sy²); SEs × max(1, σ). */
function egger(S) {
  const m = S.bxHat.length;
  let sw = 0;
  let swx = 0;
  let swy = 0;
  for (let j = 0; j < m; j += 1) {
    const w = 1 / (S.sy[j] * S.sy[j]);
    sw += w;
    swx += w * S.bxHat[j];
    swy += w * S.byHat[j];
  }
  const xbar = swx / sw;
  const ybar = swy / sw;
  let sxx = 0;
  let sxy = 0;
  for (let j = 0; j < m; j += 1) {
    const w = 1 / (S.sy[j] * S.sy[j]);
    sxx += w * (S.bxHat[j] - xbar) ** 2;
    sxy += w * (S.bxHat[j] - xbar) * (S.byHat[j] - ybar);
  }
  const b = sxy / sxx;
  const a = ybar - b * xbar;
  let rss = 0;
  for (let j = 0; j < m; j += 1) {
    const w = 1 / (S.sy[j] * S.sy[j]);
    rss += w * (S.byHat[j] - a - b * S.bxHat[j]) ** 2;
  }
  const sigma = Math.sqrt(rss / (m - 2));
  const infl = Math.max(1, sigma);
  return {
    b, a,
    se: Math.sqrt(1 / sxx) * infl,
    seA: Math.sqrt(1 / sw + (xbar * xbar) / sxx) * infl,
    sigma,
  };
}

/** TwoSampleMR's weighted_median, on the Wald ratios with weights 1/se². */
function weightedMedianOf(ratios, weights) {
  const idx = [...ratios.keys()].sort((a, b) => ratios[a] - ratios[b]);
  const r = idx.map((i) => ratios[i]);
  const w = idx.map((i) => weights[i]);
  const total = w.reduce((a, b) => a + b, 0);
  const cum = [];
  let acc = 0;
  for (let i = 0; i < w.length; i += 1) {
    acc += w[i];
    cum.push((acc - 0.5 * w[i]) / total);
  }
  let below = -1;
  for (let i = 0; i < cum.length; i += 1) if (cum[i] < 0.5) below = i;
  if (below < 0) return r[0];
  if (below >= r.length - 1) return r[r.length - 1];
  return r[below] + ((r[below + 1] - r[below]) * (0.5 - cum[below])) / (cum[below + 1] - cum[below]);
}

function wald(S) {
  const m = S.bxHat.length;
  const ratio = new Float64Array(m);
  const se = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    ratio[j] = S.byHat[j] / S.bxHat[j];
    se[j] = S.sy[j] / Math.abs(S.bxHat[j]);
  }
  return { ratio, se };
}

/** mr_weighted_median: the median of the ratios, SE by parametric bootstrap. */
function weightedMedian(S, rng, boots = 200) {
  const { ratio, se } = wald(S);
  const w = Array.from(se, (v) => 1 / (v * v));
  const b = weightedMedianOf(Array.from(ratio), w);
  const m = ratio.length;
  const draws = [];
  const rb = new Array(m);
  const wb = new Array(m);
  for (let t = 0; t < boots; t += 1) {
    for (let j = 0; j < m; j += 1) {
      const bx = S.bxHat[j] + rng.normal(0, S.sx[j]);
      const by = S.byHat[j] + rng.normal(0, S.sy[j]);
      rb[j] = by / bx;
      wb[j] = (bx * bx) / (S.sy[j] * S.sy[j]);
    }
    draws.push(weightedMedianOf(rb, wb));
  }
  return { b, se: sdOf(draws) };
}

function meanF(S) {
  let s = 0;
  for (let j = 0; j < S.bxHat.length; j += 1) s += (S.bxHat[j] / S.sx[j]) ** 2;
  return s / S.bxHat.length;
}

/* One run of everything, on a fresh rng per seed. */
function run(seed, m, cfg) {
  const rng = makeRng(seed);
  const inst = drawInstruments(rng, m);
  const S = summaryStats(rng, inst, cfg);
  return { S, ivw: ivw(S), egger: egger(S), median: weightedMedian(S, rng), F: meanF(S) };
}

function over(seeds, m, cfg) {
  const rows = [];
  for (let s = 1; s <= seeds; s += 1) rows.push(run(s, m, cfg));
  const col = (g) => rows.map(g);
  return {
    ivw: mean(col((r) => r.ivw.b)), ivwSe: mean(col((r) => r.ivw.se)), ivwSd: sdOf(col((r) => r.ivw.b)),
    egger: mean(col((r) => r.egger.b)), eggerSe: mean(col((r) => r.egger.se)),
    eggerA: mean(col((r) => r.egger.a)), eggerASe: mean(col((r) => r.egger.seA)),
    eggerAz: mean(col((r) => Math.abs(r.egger.a / r.egger.seA))),
    median: mean(col((r) => r.median.b)), medianSe: mean(col((r) => r.median.se)),
    F: mean(col((r) => r.F)),
    sigma: mean(col((r) => r.ivw.sigma)),
  };
}

const SEEDS = 60;
const THETA = 0.45;

function line(label, o) {
  console.log(
    `  ${pad(label, 26)}  IVW ${f(o.ivw)} ±${f(o.ivwSe)}   Egger ${f(o.egger)} ±${f(o.eggerSe)}  a ${f(o.eggerA, 4)} (|z| ${f(o.eggerAz, 1)})   median ${f(o.median)} ±${f(o.medianSe)}   F̄ ${pad(f(o.F, 0), 4)}  σ ${f(o.sigma, 2)}`,
  );
}

/* ==========================================================================
   1 · THE LESSON'S SHAPE
   ========================================================================== */
console.log("\n1 · THE LESSON'S SHAPE — 79 SNPs at the lesson's sizes, no violation, θ = 0.45");
console.log(`  ${pad("lesson", 26)}  IVW ${f(LESSON.ivw)} ±${f(LESSON.ivwSe)}   Egger ${f(LESSON.egger)} ±${f(LESSON.eggerSe)}   median ${f(LESSON.median)} ±${f(LESSON.medianSe)}`);
/* FIRST RUN, τ = 0: IVW ±0.030, Egger ±0.081, median ±0.045, σ 1.00 — every
   interval half the lesson's. The lesson's instruments are heterogeneous
   (its scatter has points far off every line; its random-effects IVW is
   inflated), so the engine carries a mean-zero direct effect on every SNP,
   and this table finds the τ that lands the three SEs where the lesson's
   are. */
const shape = {};
for (const tau of [0, 0.012, 0.017, 0.022]) {
  const o = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, tau });
  shape[tau] = o;
  line(`τ ${tau}`, o);
}
/* τ 0.012: IVW ±0.054, Egger ±0.146, median ±0.054 against the lesson's
   0.059 / 0.144 / 0.073. τ 0.017 overshoots Egger (±0.190). */
const TAU = 0.012;
const clean = shape[TAU];
check(Math.abs(clean.ivw - THETA) < 0.02, "IVW is unbiased at the lesson's sizes");
check(Math.abs(clean.ivwSe - LESSON.ivwSe) < 0.012, `IVW's SE (${f(clean.ivwSe)}) is near the lesson's 0.059`);
check(Math.abs(clean.eggerSe - LESSON.eggerSe) < 0.03, `Egger's SE (${f(clean.eggerSe)}) is near the lesson's 0.144`);
check(Math.abs(clean.median - THETA) < 0.03, "the weighted median is unbiased");
check(Math.abs(clean.medianSe - LESSON.medianSe) < 0.02, `the median's SE (${f(clean.medianSe)}) is near the lesson's 0.073`);
check(clean.eggerAz < 1.2, "and Egger's intercept sits at zero — heterogeneity of either sign is not directional pleiotropy");
console.log(`  τ ${TAU} is the engine's baseline from here on: σ ${f(clean.sigma, 2)}, the random-effects inflation the lesson's own IVW carries`);

/* ==========================================================================
   2 · PLEIOTROPY — the share of SNPs with a direct path, one-signed
   ========================================================================== */
console.log("\n2 · PLEIOTROPY — share of SNPs with a direct path to CHD, all positive; strong confounding");
const pleio = {};
for (const alphaMean of [0.02, 0.03, 0.04]) {
  console.log(`  direct effect mean ${alphaMean} log odds per allele (typical θ·βX ≈ ${f(THETA * 0.028, 3)})`);
  for (const share of [0, 0.3, 0.6]) {
    const o = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, share, alphaMean, tau: TAU });
    pleio[`${alphaMean}:${share}`] = o;
    line(`share ${share}`, o);
  }
}
/* FIRST WRITTEN AS "the median holds at 30% and breaks at 60%", and it does
   not hold: a single-SNP ratio's SE here is ≈ 0.36 (sy 0.01 over βX 0.028 —
   the lesson's own forest, ±1 on every row), so with 30% of the ratios
   piled high the median of the noisy rest drifts by roughly six tenths of
   IVW's bias. The breakdown at half is a property of the weight, not a
   cliff the picture shows. What the widget CAN print: the median moves
   less than IVW at every share, and at 60% it is further off than IVW was
   at 30%. Egger's slope is measured against ITS OWN clean value (0.41, not
   0.45 — the weighted regression with a free intercept under heterogeneity
   sits a little low, TwoSampleMR's own behaviour), and holds. */
{
  const a = 0.03;
  const s0 = pleio[`${a}:0`];
  const s30 = pleio[`${a}:0.3`];
  const s60 = pleio[`${a}:0.6`];
  check(s30.ivw - THETA > 0.1, `at 30% IVW is biased upward by a visible amount (${f(s30.ivw - THETA)})`);
  check(Math.abs(s30.egger - s0.egger) < 0.05, `at 30% Egger's slope holds (${f(s30.egger)} vs ${f(s0.egger)} clean)`);
  check(s30.eggerA > 3 * Math.abs(s0.eggerA) && s30.eggerA > 0.004, `at 30% Egger's intercept leaves zero (${f(s30.eggerA, 4)} vs ${f(s0.eggerA, 4)} clean; |z| ${f(s30.eggerAz, 1)})`);
  check(s30.median - THETA < 0.7 * (s30.ivw - THETA), `at 30% the median moves less than IVW (${f(s30.median - THETA)} vs ${f(s30.ivw - THETA)})`);
  check(s60.median - THETA > s30.ivw - THETA, `at 60% the median is further off than IVW was at 30% (${f(s60.median - THETA)} vs ${f(s30.ivw - THETA)})`);
  check(s60.ivw > s30.ivw, "IVW's bias grows with the share");
  check(Math.abs(s60.egger - s0.egger) < 0.05, `at 60% Egger's slope still holds — InSIDE is intact (${f(s60.egger)})`);
}

/* ==========================================================================
   3 · INSTRUMENT STRENGTH — the exposure GWAS shrinks; one sample vs two
   ========================================================================== */
console.log("\n3 · INSTRUMENT STRENGTH — exposure GWAS size, two samples then one; strong confounding (observational 0.70)");
const strength = {};
for (const oneSample of [false, true]) {
  console.log(oneSample ? "  ONE sample (outcome GWAS on the same people)" : "  TWO samples");
  for (const nX of [LESSON.nX, 60000, 20000, 8000, 3000]) {
    const o = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, nX, oneSample, tau: TAU });
    strength[`${oneSample}:${nX}`] = o;
    line(`nX ${nX}`, o);
  }
}
{
  const two = strength["false:8000"];
  const one = strength["true:8000"];
  check(two.F < 10, `at nX 8,000 the mean F is under 10 (${f(two.F, 1)})`);
  check(two.ivw < THETA - 0.05, `two samples, weak: IVW toward null (${f(two.ivw)})`);
  check(one.ivw > THETA + 0.05, `one sample, weak: IVW toward the observational 0.70 (${f(one.ivw)})`);
  const mod = strength["false:60000"];
  check(mod.F > 10 && mod.F < 40, `nX 60,000 is a moderate F (${f(mod.F, 1)})`);
}

/* ==========================================================================
   4 · THE CONFOUNDER-TO-VARIANT ARROW
   ========================================================================== */
console.log("\n4 · CONFOUNDER → VARIANTS — a one-signed confounder association per allele; strong confounding");
const stratRows = {};
for (const strat of [0, 0.02, 0.04, 0.06]) {
  const o = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, strat, tau: TAU });
  stratRows[strat] = o;
  line(`c sd ${strat}/allele`, o);
}
console.log("  the same arrow with NO confounding (γ = δ = 0) — the arrow has nothing to carry:");
line("c sd 0.04, none", over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.none, strat: 0.04, tau: TAU }));
console.log("  and with moderate confounding:");
line("c sd 0.04, moderate", over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.moderate, strat: 0.04, tau: TAU }));
/* FIRST WRITTEN AS "Egger's intercept stays near zero" — it does not: the
   term inflates the exposure effect and the outcome effect together, so the
   weighted regression tilts up and its intercept goes NEGATIVE, a pleiotropy
   reading with the wrong sign. Every estimator moves, and Egger's slope
   moves furthest — the one violation none of the three can be trusted on,
   which is what the widget prints. */
{
  const s = stratRows[0.04];
  const s0 = stratRows[0];
  check(s.ivw - THETA > 0.08, `IVW biased (${f(s.ivw)})`);
  check(s.egger - s0.egger > s.ivw - s0.ivw, `Egger's SLOPE is biased, and further than IVW — InSIDE fails (${f(s.egger)} vs ${f(s.ivw)})`);
  check(s.eggerA < -0.005, `and its intercept goes negative (${f(s.eggerA, 4)}, |z| ${f(s.eggerAz, 1)}) — a pleiotropy reading of the wrong sign`);
  check(s.median - THETA > 0.08, `the median is biased too (${f(s.median)})`);
  check(s.F > 1.2 * s0.F, `the arrow makes the instruments LOOK stronger (F̄ ${f(s.F, 0)} vs ${f(s0.F, 0)})`);
}

/* ==========================================================================
   5 · HARMONISING
   ========================================================================== */
console.log("\n5 · HARMONISING — half the outcome effects reported for the other allele");
for (const flipFrac of [0.3, 0.5]) {
  const before = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, flipFrac, harmonised: false, tau: TAU });
  const after = over(SEEDS, 79, { theta: THETA, ...CONFOUNDING.strong, flipFrac, harmonised: true, tau: TAU });
  line(`flipped ${flipFrac}, before`, before);
  line(`flipped ${flipFrac}, after`, after);
  if (flipFrac === 0.5) {
    check(Math.abs(before.ivw) < 0.15, `unharmonised, IVW collapses toward zero (${f(before.ivw)})`);
    check(Math.abs(after.ivw - THETA) < 0.02, "harmonised, it is back");
  }
}

/* ==========================================================================
   6 · THE SNP COUNT
   ========================================================================== */
console.log("\n6 · SNP COUNT — 20 · 40 · 79, two samples, strong confounding");
const counts = {};
for (const m of [20, 40, 79]) {
  const o = over(SEEDS, m, { theta: THETA, ...CONFOUNDING.strong, tau: TAU });
  counts[m] = o;
  line(`m ${m}`, o);
}
check(counts[20].ivwSe > 1.5 * counts[79].ivwSe, `20 SNPs widen IVW's interval by half or more (${f(counts[20].ivwSe)} vs ${f(counts[79].ivwSe)})`);
check(Math.abs(counts[20].ivw - THETA) < 0.04, "and 20 still centre on the truth");

/* ==========================================================================
   7 · STEP 1'S COHORT — one visible SNP
   ========================================================================== */
console.log("\n7 · STEP 1 — one SNP on a drawn cohort; the ratio vs the observational slope, strong confounding");

function cohort(rng, n, b, cfg) {
  const { theta = THETA, gamma, delta, p = 0.5, prev = 0.1, strat = 0, alpha = 0 } = cfg;
  const G = new Uint8Array(n);
  const X = new Float64Array(n);
  const L = new Float64Array(n);
  const D = new Uint8Array(n);
  const U = new Float64Array(n);
  const sdE = Math.sqrt(Math.max(0.05, 1 - gamma * gamma - b * b * 2 * p * (1 - p)));
  const b0 = Math.log(prev / (1 - prev));
  for (let i = 0; i < n; i += 1) {
    U[i] = rng.normal();
    /* stratification: the allele is commoner where the confounders are high */
    const pi = Math.min(0.95, Math.max(0.05, p + strat * U[i]));
    G[i] = rng.bernoulli(pi) + rng.bernoulli(pi);
    X[i] = b * G[i] + gamma * U[i] + sdE * rng.normal();
    L[i] = theta * X[i] + delta * U[i] + alpha * G[i] + rng.normal();
    D[i] = rng.next() < 1 / (1 + Math.exp(-(b0 + L[i]))) ? 1 : 0;
  }
  return { G, X, L, D, U };
}

function slope(y, x) {
  const n = y.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  const bh = sxy / sxx;
  let rss = 0;
  for (let i = 0; i < n; i += 1) rss += (y[i] - my - bh * (x[i] - mx)) ** 2;
  return { b: bh, se: Math.sqrt(rss / (n - 2) / sxx) };
}

/* Logistic slope of D on one predictor, Newton, for the binary-scale reading. */
function logit1(d, x, iters = 25) {
  let a = Math.log(mean(Array.from(d)) / (1 - mean(Array.from(d))));
  let b = 0;
  const n = d.length;
  for (let t = 0; t < iters; t += 1) {
    let g0 = 0; let g1 = 0; let h00 = 0; let h01 = 0; let h11 = 0;
    for (let i = 0; i < n; i += 1) {
      const pi = 1 / (1 + Math.exp(-(a + b * x[i])));
      const r = d[i] - pi;
      const w = pi * (1 - pi);
      g0 += r; g1 += r * x[i];
      h00 += w; h01 += w * x[i]; h11 += w * x[i] * x[i];
    }
    const det = h00 * h11 - h01 * h01;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (h00 * g1 - h01 * g0) / det;
    a += da; b += db;
    if (Math.abs(da) + Math.abs(db) < 1e-8) break;
  }
  let h00 = 0; let h01 = 0; let h11 = 0;
  for (let i = 0; i < n; i += 1) {
    const pi = 1 / (1 + Math.exp(-(a + b * x[i])));
    const w = pi * (1 - pi);
    h00 += w; h01 += w * x[i]; h11 += w * x[i] * x[i];
  }
  const det = h00 * h11 - h01 * h01;
  return { b, se: Math.sqrt(h00 / det) };
}

function step1(seeds, n, b, cfg) {
  const rows = [];
  for (let s = 1; s <= seeds; s += 1) {
    const rng = makeRng(1000 + s);
    const c = cohort(rng, n, b, cfg);
    const gx = slope(c.X, c.G);
    const gl = slope(c.L, c.G);
    const ratio = gl.b / gx.b;
    const ratioSe = gl.se / Math.abs(gx.b);
    const obs = slope(c.L, c.X);
    const gd = logit1(c.D, c.G);
    const ratioB = gd.b / gx.b;
    const ratioBSe = gd.se / Math.abs(gx.b);
    const obsB = logit1(c.D, c.X);
    rows.push({
      dX: gx.b, dXz: gx.b / gx.se, ratio, ratioSe, obs: obs.b,
      excl: Math.abs(ratio - obs.b) > 1.96 * ratioSe ? 1 : 0,
      ratioB, ratioBSe, obsB: obsB.b,
      exclB: Math.abs(ratioB - obsB.b) > 1.96 * ratioBSe ? 1 : 0,
      cases: mean(Array.from(c.D)),
    });
  }
  const col = (g) => rows.map(g);
  return {
    dXz: mean(col((r) => r.dXz)), ratio: mean(col((r) => r.ratio)), ratioSe: mean(col((r) => r.ratioSe)),
    ratioSd: sdOf(col((r) => r.ratio)), obs: mean(col((r) => r.obs)), excl: mean(col((r) => r.excl)),
    ratioB: mean(col((r) => r.ratioB)), ratioBSe: mean(col((r) => r.ratioBSe)), obsB: mean(col((r) => r.obsB)),
    exclB: mean(col((r) => r.exclB)), cases: mean(col((r) => r.cases)),
  };
}

console.log("  liability scale (the pick's scatter): ratio ± SE, observational slope, share of seeds whose ratio interval excludes it");
console.log("  binary CHD (what a person has, prevalence 10%): the same on the log-odds scale");
const s1 = {};
for (const [n, b] of [[1000, 0.4], [2000, 0.3], [2000, 0.4], [4000, 0.25], [4000, 0.3]]) {
  const o = step1(40, n, b, { ...CONFOUNDING.strong });
  s1[`${n}:${b}`] = o;
  console.log(
    `  ${pad(`n ${n}, b ${b}`, 14)}  ΔX z ${pad(f(o.dXz, 1), 5)}   liability: ratio ${f(o.ratio, 2)} ±${f(o.ratioSe, 2)} (sd ${f(o.ratioSd, 2)})  obs ${f(o.obs, 2)}  excl ${f(o.excl, 2)}` +
    `   binary: ratio ${f(o.ratioB, 2)} ±${f(o.ratioBSe, 2)}  obs ${f(o.obsB, 2)}  excl ${f(o.exclB, 2)}  cases ${f(o.cases, 2)}`,
  );
}
{
  const o = s1["2000:0.4"];
  check(o.dXz > 8, "at n 2,000 and 0.4 SD per allele the genotype centroids separate clearly on BMI");
  check(Math.abs(o.ratio - THETA) < 0.05, "the single-SNP ratio centres on the truth");
  check(o.obs > THETA + 0.2, `the observational slope is confounded upward (${f(o.obs, 2)})`);
  check(o.excl > 0.4, `the ratio's interval excludes the observational slope in ${f(o.excl, 2)} of seeds`);
}
console.log("  step 1 with the violations, n 2,000, b 0.4, liability scale:");
for (const [label, extra] of [["pleiotropy α 0.15", { alpha: 0.15 }], ["stratification 0.08", { strat: 0.08 }], ["no confounding", { ...CONFOUNDING.none }]]) {
  const o = step1(40, 2000, 0.4, { ...CONFOUNDING.strong, ...extra });
  console.log(`  ${pad(label, 22)}  ratio ${f(o.ratio, 2)} ±${f(o.ratioSe, 2)}  obs ${f(o.obs, 2)}`);
}

/* ==========================================================================
   8 · TIME
   ========================================================================== */
console.log("\n8 · TIME — one compute at m = 79 with a 200-draw bootstrap, and step 1's cohort at n 2,000");
{
  const t0 = performance.now();
  for (let s = 1; s <= 20; s += 1) run(s, 79, { theta: THETA, ...CONFOUNDING.strong, tau: TAU });
  const t1 = performance.now();
  for (let s = 1; s <= 20; s += 1) cohort(makeRng(s), 2000, 0.4, CONFOUNDING.strong);
  const t2 = performance.now();
  console.log(`  summary + three estimators: ${f((t1 - t0) / 20, 1)} ms   cohort: ${f((t2 - t1) / 20, 1)} ms`);
  check((t1 - t0) / 20 < 60, "a compute is under 60 ms");
}

console.log(`\n${checks} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
