/* ============================================================================
   Widget 60 · Mendelian randomization — the engine, the geometry and the copy.

   PHM5003 week 6 (03 - MR), the last of the GWAS and PRS arc. `main.js` draws
   what this file computes.

   THE NUMERICS ARE MOVED, NOT REWRITTEN. `drawInstruments`, `summaryStats`,
   `ivw`, `egger`, `weightedMedianOf`, `wald`, `weightedMedian`, `meanF`,
   `cohort` and `slope` are the ones `_lab/mr-measure.mjs` measured the design
   with (31 checks, 2026-09-12), copied here verbatim — that script runs its
   tables at top level and cannot be imported from, and the measured numbers
   are only the widget's numbers while the code is the same code. Each
   `FIRST WRITTEN AS` comment is the record of a claim the measurement
   corrected, and they are kept where they are.

   WHAT THE MEASUREMENT SETTLED:

     1. A clean summary-level simulation at the lesson's sizes gives every
        interval half the lesson's. Its instruments are heterogeneous, so the
        engine carries a mean-zero direct effect of SD 0.012 log odds per
        allele on EVERY SNP (τ), which lands IVW ±0.054, Egger ±0.146 and the
        median ±0.054 on the lesson's 0.059 / 0.144 / 0.073.
     2. The weighted median DRIFTS at 30% pleiotropic SNPs, by six tenths of
        IVW's bias — a single-SNP ratio's SE here is ≈ 0.36, the lesson's own
        forest. The printable claim is relative: the median moves less than
        IVW at every share, and at 60% it is further off than IVW was at 30%.
     3. The confounder-to-variant term must have EITHER sign per SNP. One-signed
        it is a constant Egger absorbs as an intercept; either-signed it sits
        in both effects, InSIDE fails, and all three estimators move — Egger
        furthest, with a NEGATIVE intercept.
     4. Instrument strength is the exposure GWAS's size: 339k / 60k / 8k give
        mean F 126 / 23 / 4. The pull toward null (two samples) or toward the
        observational value (one sample) is an average over seeds, not a
        certainty on any one.
     5. Step 1 works on the liability scale and not on binary CHD: at n 2,000
        and 0.4 SD per allele the genotype centroids separate (z 13) and the
        single-SNP ratio's interval excludes the observational slope in 75% of
        seeds; on binary CHD at any drawable n it does so in 17%.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD. `_lab/mr-mock.html` drew seven
       sections at the widget's 550px and Kenneth picked from every one
       (catalogue § Slot 60, 2026-09-12).

    2. FOUR STEPS, ONE RAIL, AND `page` IS A DISPLAY PARAMETER. The run is per
       step, so leaving a step and coming back keeps what was built
       (non-negotiable 3).

    3. THREE SUB-STREAMS, DRAWN FIRST. `build` takes three seeds off the top of
       the rng it is handed — the cohort, the study, the median's bootstrap —
       so a control on one step cannot redraw another's figure by consuming a
       different number of draws (polygenic-score's decision 1).

    4. HARMONISE AND ESTIMATOR ARE DISPLAY PARAMETERS. The two GWAS are the
       same two GWAS read on the same allele or not, so `build` derives the
       unharmonised study from the harmonised one by flipping the signs it
       recorded, and fits all three estimators to both. 2 ms.

    5. THE FRAME IS FIXED TO THE WHOLE STUDY (2.5). The scatter's domain is
       computed over every SNP, not the ones that have arrived, so points
       arrive into a frame that does not move under them — and the hit map,
       which cannot see the run, agrees with the picture.

    6. THE ESTIMATE WAITS FOR THE LAST SNP (2.4). On steps 3 and 4 the lines
       and the combined rows are drawn, and the tiles filled, only when every
       SNP has arrived; a partial IVW has no standing.

    7. ONE SNP ON STEP 1 IS ONE OF THE BREAKERS. When the exclusion restriction
       is broken the step-1 SNP carries a direct effect, and when independence
       is broken its allele is commoner where the confounders are high, so
       each assumption maps to one visible failure on the first step as well.

    8. THE STEP-1 SNP IS DRAWN STRONGER THAN ANY REAL BMI SNP — 0.4 SD per
       allele where the largest real one is 0.08 — and the caption says so.
       At a real effect nothing separates at a cohort a browser can draw.

    9. ROUND TWO, KENNETH'S ADVERSARIAL REVIEW (2026-09-12, evening): "think
       from the student's perspective". Four calls, every one taken:
       (a) THE TWO-STAGE METHOD IS STEP 1, NAMED. The line through the three
           genotype centroids IS two-stage least squares — stage one is BMI
           by genotype, stage two is CHD risk by genotype, the ratio is the
           slope — so the beats say so and the tiles print the two stages
           and their quotient. No concept page: the lesson links to the
           widget, not the reverse.
       (b) THE ESTIMATORS ARE TAUGHT ON THE FIGURE. A hovered SNP draws its
           own slope from the origin, so IVW reads as the one slope fitting
           every SNP's; Egger's intercept is marked on the axis as the
           average direct effect; the forest marks the middle row by weight
           as what the median takes; and every step ends on one computed
           reading line saying what to look at.
       (c) THE RAIL IS TEN CONTROLS, NOT TWELVE. SNPs (fixed at the lesson's
           79) and Samples (fixed at two) are cut — the count only widened
           intervals, which Relevance already does, and the one-sample
           direction is a lottery seed by seed. Harmonise lives on step 2
           alone; steps 3 and 4 always read the harmonised effects, so the
           estimate is never wrong by default.
       (d) THE NOTEBOOK TAKES THREE SENTENCES the widget cannot fit: one per
           estimator, the F statistic, what harmonising does.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* ==========================================================================
   The lesson's numbers, quoted from its saved outputs and never recomputed.
   ====================================================================== */
export const LESSON = {
  m: 79,
  nX: 339152,
  nY: 184305,
  /* ieu-a-7 is CARDIoGRAMplusC4D: 60,801 cases of 184,305 */
  caseFrac: 60801 / 184305,
  ivw: 0.446, ivwSe: 0.059,
  egger: 0.502, eggerSe: 0.144,
  median: 0.387, medianSe: 0.073,
};

export const THETA = 0.45;
export const TAU = 0.012;
export const ALPHA_MEAN = 0.03;
export const STRAT_SD = 0.04;
export const FLIP = 0.5;
export const COHORT = { n: 2000, b: 0.4, p: 0.5, strat: 0.08, alpha: 0.15 };
export const BOOTS = 200;

/* ==========================================================================
   The engine — VERBATIM from `_lab/mr-measure.mjs`.
   ====================================================================== */

function obsCorrelation(theta, gamma, delta) {
  /* X = γU + eX with var 1; L = θX + δU + eL with var(eL) = 1. */
  const cov = theta + gamma * delta;
  const varL = theta * theta + delta * delta + 2 * theta * gamma * delta + 1;
  return cov / Math.sqrt(varL);
}

/** m instruments: an allele frequency and a true per-allele effect on BMI in
    SD units, oriented so the effect allele RAISES BMI. The lesson's 79 run
    0.017 to 0.08 with most between 0.02 and 0.035. */
export function drawInstruments(rng, m) {
  const p = new Float64Array(m);
  const bx = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    p[j] = rng.uniform(0.1, 0.9);
    bx[j] = Math.min(0.09, 0.017 + rng.exponential(1 / 0.011));
  }
  return { p, bx };
}

/** The two GWAS as summary statistics. */
export function summaryStats(rng, inst, cfg) {
  const {
    theta = THETA, nX = LESSON.nX, nY = LESSON.nY, caseFrac = LESSON.caseFrac,
    share = 0, alphaMean = ALPHA_MEAN, strat = 0, gamma = 0, delta = 0,
    oneSample = false, flipFrac = 0, harmonised = true, tau = TAU,
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
       simulation's. The one-signed direct effect on the pleiotropic share
       sits on top of it. */
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

/** mr_ivw: lm(by ~ -1 + bx, weights 1/sy²); SE × max(1, σ). */
export function ivw(S) {
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
export function egger(S) {
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
export function weightedMedianOf(ratios, weights) {
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

/** Each SNP's ratio — its effect on CHD over its effect on BMI — and the
    first-order SE of it. */
export function wald(S) {
  const m = S.bxHat.length;
  const ratio = new Float64Array(m);
  const se = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    ratio[j] = S.byHat[j] / S.bxHat[j];
    se[j] = S.sy[j] / Math.abs(S.bxHat[j]);
  }
  return { ratio, se };
}

const sdOf = (v) => {
  const mu = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
};

/** mr_weighted_median: the median of the ratios, SE by parametric bootstrap. */
export function weightedMedian(S, rng, boots = BOOTS) {
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

export function meanF(S) {
  let s = 0;
  for (let j = 0; j < S.bxHat.length; j += 1) s += (S.bxHat[j] / S.sx[j]) ** 2;
  return s / S.bxHat.length;
}

/** Step 1's cohort: one SNP, the confounders, BMI and CHD liability. */
export function cohort(rng, n, b, cfg) {
  const { theta = THETA, gamma, delta, p = 0.5, strat = 0, alpha = 0 } = cfg;
  const G = new Uint8Array(n);
  const X = new Float64Array(n);
  const L = new Float64Array(n);
  const U = new Float64Array(n);
  const sdE = Math.sqrt(Math.max(0.05, 1 - gamma * gamma - b * b * 2 * p * (1 - p)));
  for (let i = 0; i < n; i += 1) {
    U[i] = rng.normal();
    /* stratification: the allele is commoner where the confounders are high */
    const pi = Math.min(0.95, Math.max(0.05, p + strat * U[i]));
    G[i] = rng.bernoulli(pi) + rng.bernoulli(pi);
    X[i] = b * G[i] + gamma * U[i] + sdE * rng.normal();
    L[i] = theta * X[i] + delta * U[i] + alpha * G[i] + rng.normal();
  }
  return { G, X, L, U };
}

/** OLS slope of y on x, with its SE and the two means. */
export function slope(y, x) {
  const n = y.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) { mx += x[i]; my += y[i]; }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  const bh = sxy / sxx;
  let rss = 0;
  for (let i = 0; i < n; i += 1) rss += (y[i] - my - bh * (x[i] - mx)) ** 2;
  return { b: bh, se: Math.sqrt(rss / (n - 2) / sxx), mx, my };
}

/* ==========================================================================
   The controls' options, each with what the engine reads from it.
   ====================================================================== */

/* Kenneth's round (2026-09-12, late): the first page is THE IDEA, set apart
   and unnumbered, and the three after it are the notebook's own workflow,
   numbered 1 to 3. "One SNP as a trial" named the analogy rather than the
   figure, and truncated in the grid. */
/* Kenneth's next note: the overview is ITS OWN BUTTON above a "Step" head and
   the three steps — two runs of one control, core's option `group` with
   `groupHeads`, so one parameter still carries the page. */
export const PAGES = [
  { value: "trial", label: "Overview", span: true },
  { value: "gwas", label: "1 · The two GWAS", group: "Step" },
  { value: "estimate", label: "2 · Estimate", group: "Step" },
  { value: "forest", label: "3 · The forest", group: "Step" },
];
export const PAGE_VALUES = PAGES.map((p) => p.value);
export const pageOf = (values) =>
  (PAGE_VALUES.includes(values?.page) ? values.page : PAGE_VALUES[0]);
export const WORKFLOW_STEPS = PAGES.length - 1;
/** Where a workflow step sits in the three, one-based; 0 for the idea. */
export const stepNumber = (page) => PAGE_VALUES.indexOf(pageOf({ page }));
export const PIN_PAGES = ["estimate", "forest"];

export const CONFOUNDING = [
  { value: "none", label: "None", gamma: 0, delta: 0 },
  { value: "moderate", label: "Moderate", gamma: 0.3, delta: 0.3 },
  { value: "strong", label: "Strong", gamma: 0.5, delta: 0.5 },
];
export const confoundingOf = (key) => CONFOUNDING.find((c) => c.value === key) ?? CONFOUNDING[2];

export const STRENGTH = [
  { value: "strong", label: "Strong", nX: LESSON.nX },
  { value: "moderate", label: "Moderate", nX: 60000 },
  { value: "weak", label: "Weak", nX: 8000 },
];
export const strengthOf = (key) => STRENGTH.find((s) => s.value === key) ?? STRENGTH[0];

export const PLEIO = [
  { value: "0", label: "Holds", share: 0 },
  { value: "0.3", label: "30% break it", share: 0.3 },
  { value: "0.6", label: "60% break it", share: 0.6 },
];
export const pleioOf = (key) => PLEIO.find((p) => p.value === key) ?? PLEIO[0];

export const ESTIMATORS = [
  { value: "ivw", label: "IVW",
    detail: "inverse variance weighted: the slope through the origin, each SNP weighted by the precision of its CHD effect" },
  { value: "egger", label: "MR Egger",
    detail: "the same regression with an intercept, which reads directional pleiotropy" },
  { value: "median", label: "Weighted median",
    detail: "the median of the single-SNP ratios, weighted by their precision" },
  { value: "all", label: "All", detail: "the three together" },
];
export const estimatorShows = (key, which) => key === "all" || key === which;

/* ==========================================================================
   The copy — every reader-facing string in one place, so the verify script
   can sweep them (5.9).
   ====================================================================== */

export const STRINGS = {
  /* Kenneth's pick A, 2026-09-12 */
  subtitle:
    "A variant that raises an exposure is assigned at conception, so the people who carry it are an arm "
    + "of a trial no confounder chose. Each SNP's effect on the outcome divided by its effect on the exposure "
    + "is one estimate of the causal effect, and many SNPs combined is the study's. Whether the estimate is "
    + "right rests on three assumptions, each an arrow the graph must not have.",
  blurb:
    "Variants assigned at conception stand in for a randomised exposure; their two GWAS effects estimate the causal effect.",

  pageLabel: "Page",
  pageDetail: "the overview, then the three steps of a Mendelian randomization study",

  dataSection: "The data",
  seedLabel: "Seed",
  seedDetail: "draws a different cohort and different summary statistics",
  confoundingLabel: "Confounding",
  confoundingDetail: "how strongly the confounders move both BMI and CHD",
  truthLabel: "True effect",
  truthOff: "what would you conclude from the estimates alone?",
  truthOn: "the effect the simulation was built with",
  colourLabel: "Colour by the confounders",
  colourOn: "each person tinted by the confounders, unmeasured on the graph",

  assumptionsSection: "The assumptions",
  relevanceLabel: "Relevance",
  relevanceDetail: "how strongly the SNPs are associated with BMI: the size of the exposure GWAS",
  exclusionLabel: "Exclusion restriction",
  exclusionDetail: "the share of SNPs associated with CHD by a path that is not BMI: horizontal pleiotropy",
  independenceLabel: "Independence",
  independenceHolds: "the SNPs are not associated with the confounders",
  independenceBroken: "the confounders also shift which alleles people carry, as population stratification does",

  studySection: "The study",
  harmoniseLabel: "Harmonise",
  harmoniseOff: "each GWAS reports on its own effect allele",
  harmoniseOn: "every effect read on the BMI-raising allele",
  estimatorLabel: "Estimator",

  /* the graph */
  graphCaption: "The graph",
  nodeSnp: "SNP",
  nodeSnps: "SNPs",
  nodeBmi: "BMI",
  nodeChd: "CHD",
  nodeConfounders: "confounders",

  /* step 1 — decision 9a: the beats are the two stages */
  trialX: "BMI, in SD",
  trialY: "CHD risk, in log odds",
  trialPeople: "2,000 people",
  trialFit: "CHD risk ~ BMI, every person",
  trialStage1: "stage 1: BMI by genotype",
  trialStage2: "stage 2: CHD risk by genotype",
  trialRatio: "the ratio: stage 2 over stage 1",
  trialSnpNote: "one SNP, drawn stronger than any real BMI SNP so the groups can be seen",
  tileStage1: "Stage 1: BMI per allele",
  tileStage2: "Stage 2: CHD risk per allele",
  tileRatio: "Ratio: stage 2 over stage 1",

  /* step 2 */
  exposureCaption: "Exposure GWAS · n 339,152 · effect of each SNP on BMI, in SD per allele",
  outcomeCaption: "Outcome GWAS · effect of the same SNPs on CHD, in log odds per allele",
  exposureY: "on BMI",
  outcomeY: "on CHD",
  stripsX: "SNPs, in the order the run takes them: strongest on BMI first",
  flippedNote: "open marker: reported on the other allele",
  gwasScatterCaption: "each SNP's two effects, one against the other",
  gwasScatterRaw: "unharmonised: half the outcome effects point the wrong way",

  /* steps 3 and 4 */
  scatterX: "SNP effect on BMI, in SD per allele",
  scatterY: "SNP effect on CHD, in log odds per allele",
  scatterYShort: "on CHD",
  captionIvw: "IVW: the slope through the origin",
  captionEgger: "MR Egger: a slope and an intercept",
  captionMedian: "the weighted median of the ratios",
  captionAll: "IVW, MR Egger, weighted median",
  waitingNote: "the estimate waits for the last SNP",
  observationalTag: "observational",
  truthTag: "true effect",
  interceptTag: "intercept: the average direct effect",
  forestX: "MR effect of BMI on CHD, in log odds per SD",
  forestCaption: "each SNP's ratio with its 95% interval",
  combinedIvw: "All · IVW",
  combinedEgger: "All · MR Egger",
  combinedMedian: "All · weighted median",
  medianRowTag: "the middle ratio by weight",
};

/* The verdict under the graph names the mechanism, never a moral (2.9). */
export function verdict({ page, confounding, pleio, indep }) {
  const one = page === "trial";
  const g = one ? STRINGS.nodeSnp : STRINGS.nodeSnps;
  if (confounding === "none") return "no path through the confounders: nothing to route around";
  if (pleio && indep) return `both forbidden arrows are drawn: pleiotropy, and the confounders reaching the ${g}`;
  if (pleio) return `a second path from the ${g} to CHD is open: horizontal pleiotropy`;
  if (indep) return `the confounders reach the ${g}: ${one ? "it sits" : "they sit"} on the open path`;
  return `the path through the confounders is open; the ${g} ${one ? "is" : "are"} not on it`;
}

/* The step line and the hand-off each step carries (polygenic-score's
   decision 8): "step 1 of 3 · The two GWAS", and a line saying what this step
   takes from the one before. */
export const HANDOFFS = {
  trial: "one SNP, one cohort: the trial no confounder chose",
  gwas: "from the overview: the same ratio, now for every SNP, from two studies",
  estimate: "from step 1: the harmonised effects, combined",
  forest: "from step 2: the same ratios, one row each",
};
export const stepLine = (page) => {
  const n = stepNumber(page);
  if (n === 0) return "overview";
  return `step ${n} of ${WORKFLOW_STEPS} · ${PAGES[n].label.replace(/^\d+ · /, "")}`;
};

/* Step 1's run is five beats and the Step button names the next one
   (Kenneth's pick, 2026-09-12; decision 9a names the two stages); on the
   study steps every press is one SNP. */
export const TRIAL_BEAT_LABELS = ["Draw the people", "Fit the observational line", "Stage 1: BMI by genotype", "Stage 2: CHD by genotype", "Draw the ratio"];
export const STEP_LABELS = {
  param: "page",
  labels: {
    trial: {
      anim: "trialBeat",
      labels: Object.fromEntries(TRIAL_BEAT_LABELS.map((l, i) => [i, l])),
      default: TRIAL_BEAT_LABELS[4],
    },
    gwas: "Next SNP",
    estimate: "Next SNP",
    forest: "Next SNP",
  },
  default: "Next SNP",
};
export const STEP_TITLES = {
  param: "page",
  labels: {
    trial: "Advance the cohort one act: the people, the observational fit, the two stages, the ratio",
    gwas: "Add the next SNP's two effects",
    estimate: "Add the next SNP to the scatter",
    forest: "Add the next SNP's ratio to the forest",
  },
  default: "Add the next SNP",
};
export const RUN_TITLES = {
  param: "page",
  labels: {
    trial: "Run all five: the people, the observational fit, the two stages, the ratio",
    gwas: "Run every SNP through both GWAS",
    estimate: "Run every SNP onto the scatter, then fit",
    forest: "Run every SNP into the forest, then combine",
  },
  default: "Run every SNP",
};

/* ==========================================================================
   The state: three sub-streams, one build.
   ====================================================================== */

export const TRIAL_BEATS = 5;

/* decision 9c: the lesson's 79 instruments and its two-sample design are
   fixed, not controls */
export function configFor(params) {
  const conf = confoundingOf(params.confounding);
  return {
    m: LESSON.m,
    nX: strengthOf(params.strength).nX,
    share: pleioOf(params.pleio).share,
    indep: params.indep === "broken",
    gamma: conf.gamma,
    delta: conf.delta,
    confounding: conf.value,
    oneSample: false,
  };
}

/** The three estimators, the ratios and the forest's order for one reading of
    the two GWAS. */
function analyse(S, rngBoot) {
  const est = { ivw: ivw(S), egger: egger(S), median: weightedMedian(S, rngBoot) };
  const W = wald(S);
  const m = S.bxHat.length;
  /* the forest: largest ratio at the top, the lesson's own order */
  const forestOrder = [...Array(m).keys()].sort((a, b) => W.ratio[b] - W.ratio[a]);
  /* decision 9b: the row the weighted median takes — walking the rows from
     the smallest ratio with weight 1/se², the first whose running weight
     reaches half. `weightedMedianOf` interpolates between this row and the
     one before it; this is the row a reader can point at. */
  const asc = [...forestOrder].reverse();
  const total = asc.reduce((a, j) => a + 1 / (W.se[j] * W.se[j]), 0);
  let acc = 0;
  let medianSnp = asc[asc.length - 1];
  for (const j of asc) {
    acc += 1 / (W.se[j] * W.se[j]);
    if (acc - 0.5 / (W.se[j] * W.se[j]) >= 0.5 * total) { medianSnp = j; break; }
  }
  /* decision 5: the frame over every SNP */
  let lo = 0;
  let hi = 0;
  let bxMax = 0;
  for (let j = 0; j < m; j += 1) {
    lo = Math.min(lo, S.byHat[j] - 1.96 * S.sy[j]);
    hi = Math.max(hi, S.byHat[j] + 1.96 * S.sy[j]);
    bxMax = Math.max(bxMax, S.bxHat[j] + 1.96 * S.sx[j]);
  }
  const pad = (hi - lo) * 0.05 || 0.01;
  const frame = { x: [0, bxMax * 1.08], y: [lo - pad, hi + pad] };
  return { S, est, W, forestOrder, medianSnp, frame, F: meanF(S) };
}

export function build(rng, cfg) {
  /* decision 3: the seeds first */
  const sCohort = rng.int(1, 2 ** 30);
  const sStudy = rng.int(1, 2 ** 30);
  const sBoot = rng.int(1, 2 ** 30);

  /* step 1 — decision 7: the one SNP is one of the breakers */
  const co = cohort(makeRng(sCohort), COHORT.n, COHORT.b, {
    gamma: cfg.gamma,
    delta: cfg.delta,
    p: COHORT.p,
    strat: cfg.indep ? COHORT.strat : 0,
    alpha: cfg.share > 0 ? COHORT.alpha : 0,
  });
  const obs = slope(co.L, co.X);
  const gx = slope(co.X, co.G);
  const gl = slope(co.L, co.G);
  const centroids = [0, 1, 2].map((g) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < co.G.length; i += 1) if (co.G[i] === g) { sx += co.X[i]; sy += co.L[i]; n += 1; }
    return { mx: sx / n, my: sy / n, n };
  });
  const padDom = (v) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < v.length; i += 1) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    const p = (hi - lo) * 0.06 || 1;
    return [lo - p, hi + p];
  };
  let uLo = Infinity;
  let uHi = -Infinity;
  const us = Array.from(co.U).sort((a, b) => a - b);
  uLo = us[Math.floor(0.05 * (us.length - 1))];
  uHi = us[Math.floor(0.95 * (us.length - 1))];
  const trial = {
    ...co,
    obs,
    gx,
    gl,
    ratio: { b: gl.b / gx.b, se: gl.se / Math.abs(gx.b) },
    centroids,
    xDom: padDom(co.X),
    yDom: padDom(co.L),
    uLo,
    uHi: uHi === uLo ? uLo + 1 : uHi,
  };

  /* steps 2 to 4 — decision 4: one draw, two readings */
  const rngStudy = makeRng(sStudy);
  const inst = drawInstruments(rngStudy, cfg.m);
  const S = summaryStats(rngStudy, inst, {
    nX: cfg.nX,
    share: cfg.share,
    strat: cfg.indep ? STRAT_SD : 0,
    gamma: cfg.gamma,
    delta: cfg.delta,
    oneSample: cfg.oneSample,
    flipFrac: FLIP,
    harmonised: true,
  });
  const raw = { ...S, byHat: Float64Array.from(S.byHat, (v, j) => (S.flipped[j] ? -v : v)) };
  const harmonised = analyse(S, makeRng(sBoot));
  const unharmonised = analyse(raw, makeRng(sBoot));
  /* the run's order: strongest instrument first */
  const order = [...Array(cfg.m).keys()].sort((a, b) => S.bxHat[b] - S.bxHat[a]);
  let nFlipped = 0;
  for (let j = 0; j < cfg.m; j += 1) nFlipped += S.flipped[j];

  return { cfg, trial, harmonised, unharmonised, order, m: cfg.m, nFlipped };
}

/** The reading of the study: the Harmonise control's on step 2, the
    harmonised one on every step after (decision 9c). */
export const studyOf = (state, params) =>
  (pageOf(params) === "gwas" && params.harmonise !== "on" ? state.unharmonised : state.harmonised);

/** How many units a step's run has: four beats on step 1, a SNP each after. */
export const totalFor = (page, state) => (pageOf({ page }) === "trial" ? TRIAL_BEATS : state.m);

/* ==========================================================================
   Pacing.
   ====================================================================== */

/* Step 1's beats: the people fall in over the first, the rest are short. */
export const TRIAL_BEAT_MS = [1600, 600, 700, 700, 600];
/* A SNP a beat, the run capped near five seconds at 79. */
export const SNP_BEAT_MAX_MS = 140;
export const SNP_RUN_MS = 5000;
export function beatMs(page, state, k) {
  if (pageOf({ page }) === "trial") return TRIAL_BEAT_MS[Math.min(k, TRIAL_BEATS - 1)];
  return Math.max(45, Math.min(SNP_BEAT_MAX_MS, SNP_RUN_MS / state.m));
}

/* ==========================================================================
   Geometry — one place, for the height the page reserves, every rect the
   figure draws in, and the hit map (5.8).
   ====================================================================== */

export const HEAD_Y = 6;
export const TOP = 36;
export const DAG_W = 200;
export const AX_L = 52;
export const AX_R = 12;

export const TRIAL_H = 384;
export const GWAS_H = 560;
export const ESTIMATE_H = 414;
export const STRIP_H = 96;

/* The forest: a pitch that keeps 79 rows in 340px and gives 20 rows room for
   their names; the height follows the count (Kenneth's pick). */
export const FOREST_LIM = 3;
export const FOREST_ROW_MAX = 12;
export const FOREST_ROW_MIN = 4.4;
export const forestPitch = (m) => Math.min(FOREST_ROW_MAX, Math.max(FOREST_ROW_MIN, 340 / m));
export const FOREST_NAMES_PITCH = 9;
export const COMBINED_ROW_H = 14;
export const forestHeight = (m) => Math.round(TOP + 8 + forestPitch(m) * m + 6 + 3 * COMBINED_ROW_H + 8 + 46);

export function dagLayout(x, y, h) {
  const R = 20;
  const bottom = y + h - 26;
  return {
    R,
    box: { x, y, w: DAG_W, h },
    P: {
      g: [x + 28, bottom],
      x: [x + DAG_W / 2, bottom],
      y: [x + DAG_W - 28, bottom],
      u: [x + DAG_W * 0.68, y + 26],
    },
    /* the confounders node is a pill (the mock's fix): its half-width and
       half-height, for the arrows' end offsets */
    pill: { hw: 38, hh: 15 },
  };
}

export function layout(w, values) {
  const page = pageOf(values);
  const head = { x: 6, y: HEAD_Y, w: w - 12 };
  if (page === "trial") {
    return {
      page, head, height: TRIAL_H,
      dag: dagLayout(6, TOP, TRIAL_H - 114),
      plot: { x: DAG_W + 58, y: TOP, w: w - DAG_W - 58 - 12, h: TRIAL_H - TOP - 60 },
    };
  }
  if (page === "gwas") {
    const y1 = TOP;
    const y2 = y1 + STRIP_H + 46;
    const y3 = y2 + STRIP_H + 58;
    return {
      page, head, height: GWAS_H,
      exposure: { x: AX_L, y: y1, w: w - AX_L - AX_R, h: STRIP_H },
      outcome: { x: AX_L, y: y2, w: w - AX_L - AX_R, h: STRIP_H },
      plot: { x: AX_L + 30, y: y3, w: w - AX_L - 30 - AX_R - 60, h: GWAS_H - y3 - 40 },
    };
  }
  if (page === "estimate") {
    return {
      page, head, height: ESTIMATE_H,
      dag: dagLayout(6, TOP, ESTIMATE_H - 144),
      plot: { x: DAG_W + 60, y: TOP, w: w - DAG_W - 60 - 14, h: ESTIMATE_H - TOP - 62 },
    };
  }
  const m = LESSON.m;
  const pitch = forestPitch(m);
  const L = pitch >= FOREST_NAMES_PITCH ? 70 : 46;
  const rowsTop = TOP + 8;
  return {
    page, head, height: forestHeight(m), m, pitch, rowsTop,
    L,
    plot: { x: L, y: TOP, w: w - L - 14, h: 8 + pitch * m + 6 + 3 * COMBINED_ROW_H + 8 },
    ruleY: rowsTop + pitch * m + 6,
  };
}
export const stageHeight = (w, values) => layout(w, values).height;

/* Linear scales — the same arithmetic makePlot performs, written once here
   so the hit map and the picture cannot disagree. */
export const scaleX = (rect, dom) => (v) => rect.x + ((v - dom[0]) / (dom[1] - dom[0] || 1)) * rect.w;
export const scaleY = (rect, dom) => (v) => rect.y + rect.h - ((v - dom[0]) / (dom[1] - dom[0] || 1)) * rect.h;

/** The column of the k-th SNP of the run on the two strips. */
export const stripX = (rect, m, k) => rect.x + ((k + 0.5) / m) * rect.w;

/* ==========================================================================
   The pin — one SNP, hovered or clicked (polygenic-score's decision 15).
   ====================================================================== */

export const PIN_R = 9;
/* THE SCATTER'S TARGETS ARE CELLS, NOT BOXES AROUND POINTS. A box a SNP
   overlaps its neighbours' in the cluster the lesson's scatter has, and
   core's `hitTest` returns the LAST box under a click — so a click pinned
   whichever SNP was later in the table while the hover, which takes the
   nearest, ringed another (the verify script's §5 caught 43 of 79). The
   plot is cut into 4px cells, each cell names the SNP nearest its own
   centre within PIN_R, and BOTH the hover and the click read the cell:
   they cannot disagree. */
export const CELL = 4;

function nearestSnp(L, study, m, x, y) {
  const sx = scaleX(L.plot, study.frame.x);
  const sy = scaleY(L.plot, study.frame.y);
  let best = null;
  let bestD = PIN_R * PIN_R;
  for (let j = 0; j < m; j += 1) {
    const dx = sx(study.S.bxHat[j]) - x;
    const dy = sy(study.S.byHat[j]) - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = j; }
  }
  return best;
}
const cellCentre = (L, x, y) => [
  L.plot.x + (Math.floor((x - L.plot.x) / CELL) + 0.5) * CELL,
  L.plot.y + (Math.floor((y - L.plot.y) / CELL) + 0.5) * CELL,
];

/** The SNP under the pointer on the estimate's scatter or the forest, or null. */
export function subjectAt(L, state, params, x, y) {
  if (!state) return null;
  const study = studyOf(state, params);
  if (L.page === "estimate") {
    if (x < L.plot.x || x >= L.plot.x + L.plot.w || y < L.plot.y || y >= L.plot.y + L.plot.h) return null;
    const [cx, cy] = cellCentre(L, x, y);
    return nearestSnp(L, study, state.m, cx, cy);
  }
  if (L.page === "forest") {
    if (x < L.plot.x || x > L.plot.x + L.plot.w) return null;
    const row = Math.floor((y - L.rowsTop) / L.pitch);
    if (row < 0 || row >= state.m) return null;
    return study.forestOrder[row];
  }
  return null;
}

export const SNP_MAX_LENGTH = 3;
/** The pin's canonical form: a SNP number 1..79, or empty. */
export function parseSnp(text) {
  const n = parseInt(String(text ?? "").trim(), 10);
  return Number.isInteger(n) && n >= 1 && n <= LESSON.m ? String(n) : "";
}
export function pinnedSubject(params) {
  const s = parseSnp(params.snp);
  return s ? Number(s) - 1 : null;
}

/** The click targets: one per SNP, on the page's figure. */
export function regionsFor(L, state, params) {
  if (!state || !PIN_PAGES.includes(L.page)) return [];
  const pinned = pinnedSubject(params);
  const study = studyOf(state, params);
  const out = [];
  if (L.page === "estimate") {
    const cols = Math.ceil(L.plot.w / CELL);
    const rows = Math.ceil(L.plot.h / CELL);
    for (let i = 0; i < cols; i += 1) {
      for (let r = 0; r < rows; r += 1) {
        const j = nearestSnp(L, study, state.m, L.plot.x + (i + 0.5) * CELL, L.plot.y + (r + 0.5) * CELL);
        if (j === null) continue;
        out.push({
          x: L.plot.x + i * CELL, y: L.plot.y + r * CELL, w: CELL, h: CELL,
          set: { snp: pinned === j ? "" : String(j + 1) },
          label: `Pin SNP ${j + 1}`,
        });
      }
    }
  } else {
    for (let row = 0; row < state.m; row += 1) {
      const j = study.forestOrder[row];
      out.push({
        x: L.plot.x, y: L.rowsTop + row * L.pitch, w: L.plot.w, h: L.pitch,
        set: { snp: pinned === j ? "" : String(j + 1) },
        label: `Pin SNP ${j + 1}`,
      });
    }
  }
  return out;
}

/* ==========================================================================
   Numbers and readings.
   ====================================================================== */

export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
export const intText = (v) => Math.round(v).toLocaleString("en-US");
export const ciText = (b, se, d = 2) => `95% CI ${(b - 1.96 * se).toFixed(d)} to ${(b + 1.96 * se).toFixed(d)}`;

/** The line under the figure for one SNP, hovered or pinned. */
export function snpReading(study, j) {
  const S = study.S;
  const r = study.W.ratio[j];
  const se = study.W.se[j];
  return `SNP ${j + 1} · on BMI ${n3(S.bxHat[j])} · on CHD ${n3(S.byHat[j])} · ratio ${n2(r)} (${n2(r - 1.96 * se)} to ${n2(r + 1.96 * se)})`;
}

/* ==========================================================================
   The reading line at each run's end (decision 9b): one computed sentence
   under the figure saying what to look at. Built from live numbers, so the
   verify script calls these and sweeps them.
   ====================================================================== */

const inside = (v, b, se) => v > b - 1.96 * se && v < b + 1.96 * se;

/** The odds ratio a log-odds effect per SD of BMI is, for the tiles' notes. */
export const orText = (b) => `odds ratio ${Math.exp(b).toFixed(2)} per SD`;

export function trialReading(trial, truth, cfg = {}) {
  const r = trial.ratio;
  const obs = trial.obs.b;
  let s = `the ratio ${n2(r.b)} (${n2(r.b - 1.96 * r.se)} to ${n2(r.b + 1.96 * r.se)}) against the observational ${n2(obs)}`;
  s += inside(obs, r.b, r.se) ? ", inside its interval" : ", outside its interval";
  if (truth) s += `; the true ${n2(THETA)} is ${inside(THETA, r.b, r.se) ? "inside" : "outside"}`;
  /* decision 7: when this SNP breaks an assumption, the reading says the
     broken path is in the number — the graph shows it, the line names it */
  if (cfg.share > 0 && cfg.indep) s += "; both open paths are in this ratio";
  else if (cfg.share > 0) s += "; the second path is in this ratio";
  else if (cfg.indep && cfg.confounding !== "none") s += "; the confounders' path is in this ratio";
  return s;
}

export function gwasReading(state, params) {
  if (pageOf(params) === "gwas" && params.harmonise !== "on") {
    return `${state.nFlipped} of ${state.m} outcome effects carry the other allele's sign; harmonise before combining`;
  }
  return `${state.m} SNPs, every effect read on the BMI-raising allele`;
}

export function estimateReading(study, params, obs, truth) {
  const e = study.est;
  const one = (name, b, se) => {
    let s = `${name} ${n2(b)} (${n2(b - 1.96 * se)} to ${n2(b + 1.96 * se)}): the observational ${n2(obs)} is ${inside(obs, b, se) ? "inside" : "outside"}`;
    if (truth) s += `, the true ${n2(THETA)} ${inside(THETA, b, se) ? "inside" : "outside"}`;
    return s;
  };
  const key = params.estimator;
  if (key === "egger") return one("MR Egger", e.egger.b, e.egger.se) + `; intercept ${n3(e.egger.a)}`;
  if (key === "median") return one("weighted median", e.median.b, e.median.se);
  if (key === "all") {
    return `IVW ${n2(e.ivw.b)} · MR Egger ${n2(e.egger.b)} · median ${n2(e.median.b)}, against the observational ${n2(obs)}${truth ? ` and the true ${n2(THETA)}` : ""}`;
  }
  return one("IVW", e.ivw.b, e.ivw.se);
}

export function forestReading(study, m, params) {
  let cross = 0;
  for (let j = 0; j < m; j += 1) if (inside(0, study.W.ratio[j], study.W.se[j])) cross += 1;
  const e = study.est;
  const key = params.estimator;
  const pick = key === "egger" ? ["MR Egger", e.egger] : key === "median" ? ["the weighted median", e.median] : ["IVW", e.ivw];
  const combinedCross = inside(0, pick[1].b, pick[1].se);
  return `${cross} of ${m} single-SNP intervals cross zero; ${key === "all" ? "IVW's" : `${pick[0]}'s`} combined interval ${combinedCross ? "does too" : "does not"}`;
}
