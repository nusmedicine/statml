/* ============================================================================
   Widget 59 · Polygenic scores — the engine, the geometry and the copy.

   PHM5003 week 6 (02-1 the score and the P-threshold sweep, 02-2 the quantile
   plot), carrying slot 58's LD-and-clumping material as page 1 — Kenneth's
   call 2026-09-11. `main.js` draws what this file computes.

   THE NUMERICS ARE MOVED, NOT REWRITTEN. Every function from `betai` down to
   `binsExcludingMean` is the one `_lab/prs-measure.mjs` measured the design
   with, copied here verbatim with its comments — that script runs its tables
   at top level, so it cannot be imported from, and the measured numbers are
   only the widget's numbers while the code is the same code. Each
   `FIRST WRITTEN AS` comment is the record of a claim the measurement
   corrected, and they are kept where they are.

   WHAT THE MEASUREMENT SETTLED (`_lab/prs-measure.mjs`, 35 checks, 2026-09-12;
   eight claims came out differently from the brief):

     1. A founder mosaic with independent founder alleles cannot make LD — the
        founders sit on a random genealogy and every SNP is a mutation on one
        of its branches.
     2. 60 SNPs at 25 kb cannot teach tagging. The region is 100 SNPs at 5 kb.
     3. Spread, not heritability, decides the threshold curve's shape: 300
        causal SNPs of 1,000 reproduce the lesson's curve, 100 do not.
     4. The maximum is a plateau, not a peak, and it lands on a different
        threshold from seed to seed.
     5. An allele-frequency shift alone costs a score almost nothing. All the
        portability loss in this model is tag decay, so each Target population
        setting moves both.
     6. The matched quantile plot is not reliably steeper than the lesson's.
     7. Base 1,500 × 1,000 SNPs is 42 ms where 3,000 × 2,000 is 141–161.
     8. The threshold curve on an already-drawn genome is 2 ms, which is what
        makes the P threshold a display parameter.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. FOUR SUB-STREAMS, DRAWN FIRST. `compute` takes four seeds off the top of
       the rng it is handed and builds the region, the base study, the target
       sample and the validation sample from one stream each. Without it the
       page-1 controls would move the genome: `simulateHaplotypes` consumes a
       different number of draws at each recombination rate, so changing
       Recombination would have redrawn the base study and every page after it.
       It also fixes what the mock found on its own page 4 — three populations
       taken from one stream in turn differ by where they landed in it as well
       as by their setting.

    2. THE REGION AND THE GENOME ARE BOTH BUILT ON EVERY DATA CHANGE. 5 ms and
       42 ms, and one `compute` for the whole widget keeps the four pages one
       figure rather than four.

    3. THE P THRESHOLD AND THE PERSON ARE DISPLAY PARAMETERS. The curve is
       2 ms on a genome already drawn, so the reader slides the threshold over
       one base study rather than redrawing it (measurement 8). Everything the
       four pages read at every threshold — the kept count, both R², the
       vigintile bins — is computed once, for all eleven.

    4. THE RUN IS PER PAGE. `anim.k` is an object, one count a page, so
       visiting another page and coming back keeps the work on both
       (non-negotiable 3). The pages count different things, which is exactly
       why one shared counter could not carry them.

    5. PAGE 1'S FIRST BEAT DRAWS THE TESTS. A widget starts empty
       (non-negotiable 4), and clumping cannot be watched before the tests it
       thins are on screen. Play spends its first frame on them and places no
       clump; Step goes on to place the clump its label promises — widget 57's
       variance step, in the same shape.

   ROUND TWO, from Kenneth's review of the four-page draft and his eight picks
   on `_lab/prs-round2-mock.html` (catalogue § Slot 59, 2026-09-12). His three
   points were that the score is weak on this data, that clumping's CAUSE is
   invisible, and that four nouns in a grid do not say which order to read them
   in. Decisions 6 to 13 are the answers:

    6. THE BASE STUDY IS SUMMARY STATISTICS, NOT A COHORT. What a PRS consumes
       is one β̂ and one P a SNP, so `summaryBase` draws them directly:
       β̂ⱼ ~ N(βⱼ, seⱼ²) on the standardised genotype with seⱼ = √((1 − βⱼ²)/n),
       both divided by √(2pⱼ(1 − pⱼ)) for the raw allele count the score sums,
       and P from the two-sided normal tail. That is what makes **Base study
       size** a control the reader can move — the per-person route costs 28 ms
       at 1,500 people and 415 ms at 20,000, and the summary route costs
       nothing at any size. The mock checked the two against each other at
       n = 1,500 and every quantity agreed inside 0.82 SD of the two routes'
       own spread; `_lab/prs-verify.mjs` §5b keeps that check.

    7. SIX STEPS, NOT FOUR PAGES. The region splits: the haplotypes are step 1
       and clumping is step 2, because the draft drew clumping's RESULT and not
       its cause. Calibration is step 6. The values `score`, `threshold` and
       `quantile` are unchanged, so the draft's links still resolve; `page=ld`
       is the one that breaks, and it is the value that became two steps.

    8. EVERY STAGE SAYS WHERE IT IS AND WHAT IT WAS HANDED. A step line above
       the caption — `step 2 of 6 · Clump the SNPs` in `--c-highlight` — with
       the hand-off right-aligned on the same line naming what the step before
       produced. It costs 21px of every stage, and it is the answer to "nothing
       says how the pages chain".

    9. STEP 2 COUNTS BEATS, NOT CLUMPS: three a clump, and the run is a
       function of that one number. Beat 1 lights the lead, beat 2 draws an arc
       to every SNP its r² takes, beat 3 slides those SNPs to the baseline. The
       fraction inside the third beat tweens the slide. **Step advances to the
       next multiple of three**, so one press is one whole clump and the
       button's label is what that press does (4.4b) — and the reader stepping
       still sees the arcs, because the three beats run at the beat rate.

   10. THE BASE POPULATION IS THE ONE COHORT STILL DRAWN PERSON BY PERSON.
       3,000 people at the base study's own allele frequencies, because a
       logistic fit needs individual outcomes. It costs 52 ms, which is the
       largest single cost in `compute`, and it is what makes step 6's
       calibration a test rather than a tautology: a model fitted in the target
       sample sits on the diagonal there by construction.

   11. PREVALENCE IS DATA, THE RISK THRESHOLD IS DISPLAY. Prevalence sets the
       liability threshold, so it changes who has the disease and therefore the
       fitted model — it cannot be a display parameter without computing every
       prevalence, which is three times the logistic fitting. The risk
       threshold moves one line across already-computed risks, so it is
       display.

   12. STEP 6 FOLLOWS THE P THRESHOLD ON THE RAIL, like step 5. That needs a
       risk model at each of the eleven thresholds, and the base population's
       scores are accumulated ACROSS them rather than summed from scratch at
       each — the kept sets are nested, so eleven scores over 3,000 people cost
       4.6 ms that way against 7.3 ms independently and one pass over the SNPs
       either way.

   13. STEP 1'S TRIANGLE ARRIVES WITH THE LAST HAPLOTYPE. The r² is measured
       over the whole pool, not over the rows drawn so far, so revealing it
       against the row count would tie two numbers that are not tied. The
       measurement follows the data: the pool fills a row a beat, and the
       triangle is what the finished pool says.

       IT IS THE WHOLE HALF-MATRIX — Kenneth's pick, round three (2026-09-12).
       Round two clipped it to the 250 kb clumping window on the mock's
       argument that the deeper half is r² ≈ 0; the round-three mock measured
       that argument (beyond the window the largest r² in the region is 0.087
       and no pair clears 0.5) and he wanted the ground SEEN rather than cut
       off. The window's reach is drawn across it as one rule instead, so the
       pairs step 2 can act on are the ones above a line the reader has looked
       at. And the triangle's SNPs are spaced at w / m, the same pitch as the
       block's columns, so a cell sits above the midpoint of the two columns
       it joins — round two spaced them at w / (m − 1), which put SNP 100 five
       pixels right of its own column.

   14. STEP 3 IS ONE COLUMN A SNP AT EVERY COUNT — Kenneth's pick, round three
       (2026-09-12), replacing round two's "countable first, then batched".
       The batch drew the sum as one flat step across a quarter of the panel,
       which read as "nothing happened for 120 SNPs" when the truth was 120
       small steps; his note was that it "just flatlines". So the x axis is
       the kept count from the first frame, every SNP has its own column
       (3px at 160, half a pixel at 1,000, 14px at 35 — the round-one picture
       unchanged), and the run is capped at SCORE_RUN_MS whatever the count.

       THE ORDER IS BY EVIDENCE, NOT BY POSITION, and it is what gives the
       staircase its shape: `kept` is ordered by P ASCENDING, so the strongest
       weights come first and the sum takes its big steps early and then
       settles — step 4's plateau, met one SNP at a time. A score is a sum, so
       its value does not depend on the order; only the picture does, and the
       axis label says which order it is in.

       `kept` is sorted here rather than in `personScore` because the order is
       a property of the SNPs the threshold keeps, not of the person the sum is
       drawn for, and every reader of `kept` should see the same one.

   15. THE BLOCK AND THE TRIANGLE ARE ONE FIGURE, AND THE READER CAN ASK IT
       WHICH IS WHICH — Kenneth's ask, round three. A cell of the triangle is
       a pair of SNPs; the two columns it joins are in the block above it, and
       the rows where the pair's alleles travel together are what the r²
       counts. So: the causal SNP's row and column in the triangle are drawn
       at rest as a dashed V under its marked column; a block column under the
       pointer is outlined and its V drawn; a triangle cell under the pointer
       is outlined with its two legs up to the axis, both columns outlined,
       and the stretch between them banded in every row whose pairing is one
       of the two commonest (the sign of D says which two). The reading under
       the block names it. A CLICK PINS THE SAME THING into `snps`, a hidden
       display parameter ("37" or "37,52"), so a lesson link can open on a
       pair and the pin holds when the pointer leaves; the pointer overrides
       the pin while it is on a target. All of the geometry is here — the
       column under a point, the cell under a point (the rotated frame
       inverts to u = ⌊a − b⌋, v = ⌊a + b⌋), the region table — so the verify
       can assert it with no DOM, which no pixel hash can.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* ==========================================================================
   Copied numerics.

   lgamma, betacf, betai, tTwoSided, cholesky, cholInverse, weightedScan and
   olsScan came to `_lab/prs-measure.mjs` VERBATIM from
   `_lab/gwas-measure.mjs`, and come here verbatim from there. gammaDraw and
   betaDraw are from the same file. tCritical is the same tail as
   widgets/core/stats.js inverts, written out so this file imports only the
   rng — and memoised here on the degrees of freedom, because the quantile
   summary asks for it twenty times a threshold and the bins hold one of two
   sizes.
   ========================================================================== */

/* FROM gwas-measure.mjs — Lanczos log-gamma. */
const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
];
function lgamma(x) {
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) ser += LANCZOS[j] / (y += 1);
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/* FROM gwas-measure.mjs — the incomplete beta's continued fraction. */
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let mm = 1; mm <= 300; mm += 1) {
    const m2 = 2 * mm;
    let aa = (mm * (b - mm) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + mm) * (qab + mm) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}

/** FROM gwas-measure.mjs — regularized incomplete beta I_x(a, b). */
export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** FROM gwas-measure.mjs — two-sided P for a t statistic on df degrees. */
export function tTwoSided(t, df) {
  if (!Number.isFinite(t)) return 1;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/**
 * The two-sided critical value — the same tail widgets/core/stats.js
 * `tCritical` inverts, bisected here so this file imports only the rng.
 * This is the qt(0.975, n − 1) the lesson's own interval multiplies sd/√n by.
 *
 * MEMOISED ON df. The quantile summary calls it once a bin, twenty bins a
 * threshold and eleven thresholds a draw, and at ~16 people a bin there are
 * two distinct df in the whole figure: 120 bisections of `betai` each, 220
 * times, for two answers.
 */
const T_CRIT = new Map();
export function tCritical(df, conf = 0.95) {
  if (!(df > 0)) return Infinity;
  const key = `${df}:${conf}`;
  const hit = T_CRIT.get(key);
  if (hit !== undefined) return hit;
  const target = 1 - conf;
  let lo = 0;
  let hi = 400;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (tTwoSided(mid, df) > target) lo = mid;
    else hi = mid;
  }
  const out = (lo + hi) / 2;
  T_CRIT.set(key, out);
  return out;
}

/* FROM gwas-measure.mjs — Cholesky and its inverse. */
function cholesky(A) {
  const p = A.length;
  const L = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = A[i][j];
      for (let kk = 0; kk < j; kk += 1) s -= L[i][kk] * L[j][kk];
      if (i === j) {
        if (s <= 0) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

function cholInverse(L) {
  const p = L.length;
  const Li = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j += 1) {
      let s = 0;
      for (let kk = j; kk < i; kk += 1) s += L[i][kk] * Li[kk][j];
      Li[i][j] = -s / L[i][i];
    }
  }
  const Ai = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = 0;
      for (let kk = i; kk < p; kk += 1) s += Li[kk][i] * Li[kk][j];
      Ai[i][j] = s;
      Ai[j][i] = s;
    }
  }
  return Ai;
}

/** FROM gwas-measure.mjs — per-SNP weighted least squares. */
export function weightedScan(y, X, G, winv) {
  const n = y.length;
  const p = X.length;
  const m = G.length;
  const A = Array.from({ length: p }, () => new Float64Array(p));
  for (let a = 0; a < p; a += 1) {
    for (let b = 0; b <= a; b += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += winv[i] * X[a][i] * X[b][i];
      A[a][b] = s;
      A[b][a] = s;
    }
  }
  const L = cholesky(A);
  if (!L) throw new Error("weightedScan: singular covariate matrix");
  const Ai = cholInverse(L);

  const by = new Float64Array(p);
  for (let a = 0; a < p; a += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += winv[i] * X[a][i] * y[i];
    by[a] = s;
  }
  const cy = new Float64Array(p);
  for (let a = 0; a < p; a += 1) {
    let s = 0;
    for (let b = 0; b < p; b += 1) s += Ai[a][b] * by[b];
    cy[a] = s;
  }
  const yt = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let v = y[i];
    for (let a = 0; a < p; a += 1) v -= X[a][i] * cy[a];
    yt[i] = v;
  }
  let ssy = 0;
  for (let i = 0; i < n; i += 1) ssy += winv[i] * yt[i] * yt[i];

  const df = n - p - 1;
  const beta = new Float64Array(m);
  const se = new Float64Array(m);
  const P = new Float64Array(m);
  const bg = new Float64Array(p);
  const cg = new Float64Array(p);
  for (let j = 0; j < m; j += 1) {
    const g = G[j];
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      const Xa = X[a];
      for (let i = 0; i < n; i += 1) s += winv[i] * Xa[i] * g[i];
      bg[a] = s;
    }
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      for (let b = 0; b < p; b += 1) s += Ai[a][b] * bg[b];
      cg[a] = s;
    }
    let den = 0;
    let num = 0;
    for (let i = 0; i < n; i += 1) {
      let gt = g[i];
      for (let a = 0; a < p; a += 1) gt -= X[a][i] * cg[a];
      den += winv[i] * gt * gt;
      num += winv[i] * gt * yt[i];
    }
    if (den <= 1e-12) {
      beta[j] = 0;
      se[j] = Infinity;
      P[j] = 1;
      continue;
    }
    const b = num / den;
    const rss = Math.max(ssy - b * b * den, 1e-300);
    const s2 = rss / df;
    const s = Math.sqrt(s2 / den);
    beta[j] = b;
    se[j] = s;
    P[j] = tTwoSided(b / s, df);
  }
  return { beta, se, P, df };
}

/** FROM gwas-measure.mjs — per-SNP OLS of y on the SNP plus an intercept. */
export function olsScan(y, G, covariates = []) {
  const n = y.length;
  const ones = new Float64Array(n).fill(1);
  const winv = new Float64Array(n).fill(1);
  return weightedScan(y, [ones, ...covariates], G, winv);
}

/** FROM gwas-measure.mjs — Gamma(shape, 1), Marsaglia–Tsang, seeded. */
export function gammaDraw(rng, shape) {
  if (shape < 1) {
    let u = 0;
    while (u === 0) u = rng.next();
    return gammaDraw(rng, shape + 1) * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let v = 0;
    do {
      x = rng.normal(0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** FROM gwas-measure.mjs — Beta(a, b) as X / (X + Y). */
export function betaDraw(rng, a, b) {
  const x = gammaDraw(rng, a);
  const y = gammaDraw(rng, b);
  return x + y > 0 ? x / (x + y) : 0.5;
}

/* ==========================================================================
   Round two's numerics: the normal tail, the normal quantile, a logistic fit
   and a binomial interval.

   All four came from `_lab/prs-round2-mock.html`, which asserted every one of
   them against a closed form before drawing anything with it — Φ(1.96), the
   5e−8 tail, Φ⁻¹(0.975), the intercept-only MLE log(k/(n−k)), the 2 × 2 log
   odds ratio, and a calibration intercept of 0 and slope of 1 on outcomes
   generated at a known logit. `_lab/prs-verify.mjs` §1b carries those
   assertions.
   ========================================================================== */

/** Chebyshev erfc (Numerical Recipes `erfccheb`), relative error < 1e−10 —
    good to the 5e−8 end of the threshold slider, where a t tail would be
    indistinguishable at every base study size the control offers. */
function erfc(x) {
  const z = Math.abs(x);
  const t = 2 / (2 + z);
  const ty = 4 * t - 2;
  const cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
    -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5,
    -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8,
    -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10,
    9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13,
    -1.12708e-13, 3.81e-16, 7.106e-15];
  let d = 0;
  let dd = 0;
  for (let j = cof.length - 1; j > 0; j -= 1) {
    const tmp = d;
    d = ty * d - dd + cof[j];
    dd = tmp;
  }
  const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
  return x >= 0 ? ans : 2 - ans;
}

/** The two-sided normal tail — the P value a summary statistic carries. */
export const normTail2 = (z) => erfc(Math.abs(z) / Math.SQRT2);
export const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2);

/** Acklam's inverse normal CDF — the liability threshold a prevalence names. */
export function normQuantile(p) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - 0.02425) return -normQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const expit = (e) => 1 / (1 + Math.exp(-e));

/**
 * Logistic regression by Newton steps.
 *
 * `X` is an array of column vectors with the intercept included by the caller.
 * `offset` is added to the linear predictor and NOT fitted, which is what makes
 * a calibration intercept an intercept: the model's own logit goes in as the
 * offset and the fitted constant is how far the outcome sits from it.
 *
 * p is 1 or 2 here, so the Newton step is solved by Gauss–Jordan on a matrix of
 * that size rather than by bringing in a decomposition.
 */
export function logistic(X, y, { offset = null, steps = 40 } = {}) {
  const p = X.length;
  const n = y.length;
  const beta = new Float64Array(p);
  for (let it = 0; it < steps; it += 1) {
    const mu = new Float64Array(n);
    const w = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let e = offset ? offset[i] : 0;
      for (let a = 0; a < p; a += 1) e += X[a][i] * beta[a];
      const m = expit(e);
      mu[i] = m;
      w[i] = Math.max(m * (1 - m), 1e-9);
    }
    const g = new Float64Array(p);
    const H = Array.from({ length: p }, () => new Float64Array(p));
    for (let a = 0; a < p; a += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += X[a][i] * (y[i] - mu[i]);
      g[a] = s;
      for (let b = 0; b <= a; b += 1) {
        let h = 0;
        for (let i = 0; i < n; i += 1) h += w[i] * X[a][i] * X[b][i];
        H[a][b] = h;
        H[b][a] = h;
      }
    }
    const A = H.map((r, i) => [...r, g[i]]);
    for (let c = 0; c < p; c += 1) {
      let piv = c;
      for (let r = c + 1; r < p; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      const tmp = A[c];
      A[c] = A[piv];
      A[piv] = tmp;
      const d0 = A[c][c];
      if (Math.abs(d0) < 1e-12) return { beta: Array.from(beta), converged: false };
      for (let k = c; k <= p; k += 1) A[c][k] /= d0;
      for (let r = 0; r < p; r += 1) {
        if (r === c) continue;
        const f = A[r][c];
        for (let k = c; k <= p; k += 1) A[r][k] -= f * A[c][k];
      }
    }
    let maxd = 0;
    for (let a = 0; a < p; a += 1) {
      beta[a] += A[a][p];
      maxd = Math.max(maxd, Math.abs(A[a][p]));
    }
    if (maxd < 1e-10) return { beta: Array.from(beta), converged: true, iters: it + 1 };
  }
  return { beta: Array.from(beta), converged: false, iters: steps };
}

/**
 * Wilson's 95% interval for a fraction.
 *
 * A decile of a 319-person sample holds 32 people, so an observed fraction
 * moves in steps of 1/32 and a point three steps off the diagonal is not
 * evidence of anything. Without the interval the calibration panel reads as
 * miscalibration wherever it is only small numbers.
 */
export function wilson(k, n) {
  const z = 1.959964;
  const ph = k / n;
  const den = 1 + (z * z) / n;
  const ctr = (ph + (z * z) / (2 * n)) / den;
  const hw = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, ctr - hw), Math.min(1, ctr + hw)];
}

/* ==========================================================================
   Small statistics.
   ========================================================================== */

export function mean(v) {
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += v[i];
  return s / v.length;
}

export function sd(v) {
  const mu = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += (v[i] - mu) ** 2;
  return Math.sqrt(s / Math.max(v.length - 1, 1));
}

/** Pearson correlation; 0 when either side is constant. */
export function cor(a, b) {
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

/** The R² the lesson's `PRS.R2` is: the squared correlation of score and trait. */
export function r2Score(s, y) {
  const c = cor(s, y);
  return c * c;
}

/* ==========================================================================
   1. Haplotypes with LD.

   A coalescent is not worth its cost in a widget, so this is Li–Stephens'
   mosaic: `kFounder` founder haplotypes, and every sampled haplotype copies
   one founder and switches to a fresh one with probability
   1 − exp(−recomb × distance) at each step. Nearby SNPs sit on the same
   founder and so share alleles; far ones do not, and the block structure is a
   consequence of the switch points rather than a parameter — which is the
   picture page 1 wants.

   FIRST WRITTEN AS founders whose alleles were drawn independently at a
   frequency U(0.1, 0.9), which is what the plan asked for. That cannot work,
   and the reason is worth keeping: two SNPs at zero distance sit on the SAME
   founder, so their r² across the sample is the r² between them AMONG THE
   FOUNDERS — and independent draws have none. Measured: mean r² at 0–50 kb
   was 0.06 at 8 founders and never rose above 0.18 at any founder count, a
   ceiling of about 1/(k − 1). Real LD is high because the founders are
   RELATED, so the founders here are built on a random genealogy: split the
   founder set recursively, and let each SNP be a mutation on one branch,
   carried by exactly the founders below it. Two SNPs on the same branch are
   then perfectly correlated, which is what a tag is. Allele frequencies come
   out as branch sizes over k rather than U(0.1, 0.9) — a consequence rather
   than an assumption, and closer to a real spectrum.
   ========================================================================== */

/**
 * `nHap` haplotypes over `m` SNPs spaced `blockLen` kb apart.
 * `recomb` is the switch probability PER KB.
 * Returns { H, positions, founders, freq } with H[j] the allele vector (0/1)
 * of SNP j across haplotypes — the orientation ldMatrix and the scan want.
 *
 * FIRST WRITTEN AS m 60 SNPs at 25 kb (a 1475 kb stretch), which is the plan's
 * default. Measured, that stretch cannot teach tagging: a 250 kb clumping
 * window holds only 20 SNPs, a causal SNP has 0.0 neighbours at r² > 0.8, and
 * the lead SNP is the causal one 92% of the time. The region is now 100 SNPs
 * at 5 kb — 495 kb, the density of a genotyping array rather than of a figure.
 */
export function simulateHaplotypes(rng, opts = {}) {
  const { nHap = 1000, m = 100, blockLen = 5, recomb = 0.005, kFounder = 4 } = opts;
  const positions = new Float64Array(m);
  for (let j = 0; j < m; j += 1) positions[j] = j * blockLen;

  /* the founders' genealogy: every edge is the set of founders below it */
  const edges = [];
  (function split(set) {
    if (set.length <= 1) return;
    const sh = rng.shuffle(set);
    const cut = rng.int(1, set.length - 1);
    const left = sh.slice(0, cut);
    const right = sh.slice(cut);
    edges.push(left, right);
    split(left);
    split(right);
  })(Array.from({ length: kFounder }, (_, i) => i));

  const founders = Array.from({ length: kFounder }, () => new Uint8Array(m));
  const branch = new Int32Array(m); // which edge each SNP mutated on
  for (let j = 0; j < m; j += 1) {
    const e = rng.int(0, edges.length - 1);
    branch[j] = e;
    for (const fdx of edges[e]) founders[fdx][j] = 1;
  }
  const freq = new Float64Array(m);
  for (let j = 0; j < m; j += 1) freq[j] = edges[branch[j]].length / kFounder;

  const H = Array.from({ length: m }, () => new Uint8Array(nHap));
  for (let h = 0; h < nHap; h += 1) {
    let fdx = rng.int(0, kFounder - 1);
    H[0][h] = founders[fdx][0];
    for (let j = 1; j < m; j += 1) {
      const d = positions[j] - positions[j - 1];
      if (rng.next() < 1 - Math.exp(-recomb * d)) fdx = rng.int(0, kFounder - 1);
      H[j][h] = founders[fdx][j];
    }
  }
  return { H, positions, founders, freq, branch, edges, nHap, m, blockLen, recomb, kFounder };
}

/** r² between two SNPs' allele vectors: D² / (pA qA pB qB). */
export function r2(hapA, hapB) {
  const n = hapA.length;
  let pa = 0;
  let pb = 0;
  let pab = 0;
  for (let i = 0; i < n; i += 1) {
    pa += hapA[i];
    pb += hapB[i];
    pab += hapA[i] * hapB[i];
  }
  pa /= n;
  pb /= n;
  pab /= n;
  const D = pab - pa * pb;
  const den = pa * (1 - pa) * pb * (1 - pb);
  return den > 0 ? (D * D) / den : 0;
}

/** The full m × m r² matrix — page 1's triangle, and clumping's input. */
export function ldMatrix(H) {
  const m = H.length;
  const R = Array.from({ length: m }, () => new Float64Array(m));
  for (let j = 0; j < m; j += 1) {
    R[j][j] = 1;
    for (let k = 0; k < j; k += 1) {
      const v = r2(H[j], H[k]);
      R[j][k] = v;
      R[k][j] = v;
    }
  }
  return R;
}

/* ==========================================================================
   2. Individuals, the region's association test, and clumping.
   ========================================================================== */

/** `n` people, each two haplotypes drawn from the pool: G[j][i] ∈ {0, 1, 2}. */
export function makeGenotypes(rng, H, n) {
  const m = H.length;
  const nHap = H[0].length;
  const G = Array.from({ length: m }, () => new Int8Array(n));
  for (let i = 0; i < n; i += 1) {
    const a = rng.int(0, nHap - 1);
    const b = rng.int(0, nHap - 1);
    for (let j = 0; j < m; j += 1) G[j][i] = H[j][a] + H[j][b];
  }
  return G;
}

/**
 * One hidden causal SNP: y = beta × standardised genotype + N(0, 1).
 * So the causal SNP's share of the trait's variance is beta² / (1 + beta²).
 */
export function regionTrait(rng, G, causalIdx, beta) {
  const n = G[0].length;
  const g = G[causalIdx];
  let mu = 0;
  for (let i = 0; i < n; i += 1) mu += g[i];
  mu /= n;
  let v = 0;
  for (let i = 0; i < n; i += 1) v += (g[i] - mu) ** 2;
  const s = Math.sqrt(v / n) || 1;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) y[i] = beta * ((g[i] - mu) / s) + rng.normal(0, 1);
  return y;
}

/** Per-SNP OLS over the region; returns β, P and the −log₁₀P the plot draws. */
export function regionScan(y, G) {
  const s = olsScan(y, G);
  const logp = new Float64Array(s.P.length);
  for (let j = 0; j < s.P.length; j += 1) logp[j] = -Math.log10(Math.max(s.P[j], 1e-300));
  return { ...s, logp };
}

/**
 * PLINK/PRSice greedy clumping at the lesson's own defaults
 * (`--clump-r2 0.1 --clump-kb 250kb`): sort by P, take the best remaining SNP
 * as an index, absorb every not-yet-taken SNP within `kb` whose r² to it is at
 * least `r2`, repeat until nothing is left.
 *
 * Every SNP is clumped, with no `--clump-p1` cut on the index — PRSice clumps
 * the whole base file and applies its P thresholds afterwards, which is the
 * order page 1 then page 3 follow.
 */
export function clump(P, R, positions, opts = {}) {
  const { r2: r2Thresh = 0.1, kb = 250 } = opts;
  const m = P.length;
  const order = Array.from({ length: m }, (_, j) => j).sort((a, b) => P[a] - P[b]);
  const taken = new Uint8Array(m);
  const clumps = [];
  for (const idx of order) {
    if (taken[idx]) continue;
    taken[idx] = 1;
    const members = [];
    for (let j = 0; j < m; j += 1) {
      if (taken[j]) continue;
      if (Math.abs(positions[j] - positions[idx]) <= kb && R[idx][j] >= r2Thresh) {
        taken[j] = 1;
        members.push(j);
      }
    }
    clumps.push({ index: idx, members, p: P[idx] });
  }
  return clumps;
}

/* ==========================================================================
   3. A genome for the score.

   Page 2 and after need many SNPs and no LD: the score is a sum over SNPs
   and the argument is the count, not the correlation between neighbours. So
   these SNPs are INDEPENDENT — drawn one at a time from their own allele
   frequency — and the LD that page 1 taught is represented on the later pages
   only by `tagLoss`, which is what LD across ancestries costs a score.
   ========================================================================== */

/** Balding–Nichols: the target's frequency around the base's at the given Fst. */
export function shiftFrequency(rng, p, fst) {
  if (!(fst > 0)) return p;
  const a = (p * (1 - fst)) / fst;
  const b = ((1 - p) * (1 - fst)) / fst;
  const q = betaDraw(rng, a, b);
  return Math.min(Math.max(q, 0.01), 0.99);
}

/**
 * One cohort at the given allele frequencies.
 *
 * `tagged` marks causal SNPs whose OBSERVED genotype in this cohort is only a
 * tag for the causal one: each allele is kept with probability √r2tag and
 * otherwise redrawn from the same frequency, which makes the observed and the
 * causal genotype correlate at exactly r = √r2tag, so r² = r2tag. The TRAIT is
 * always built from the causal genotype and the SCORE always from the observed
 * one — which is what an LD tag that travels badly across ancestries does to a
 * weight estimated in the base study.
 */
export function drawCohort(rng, n, p, betaTrue, h2, tagged, r2tag) {
  const m = p.length;
  const G = Array.from({ length: m }, () => new Int8Array(n));
  const gen = new Float64Array(n);
  const keep = Math.sqrt(r2tag);
  for (let j = 0; j < m; j += 1) {
    const col = G[j];
    const pj = p[j];
    const bj = betaTrue[j];
    const s = Math.sqrt(2 * pj * (1 - pj)) || 1;
    const isTag = tagged ? tagged[j] === 1 : false;
    for (let i = 0; i < n; i += 1) {
      const a = rng.next() < pj ? 1 : 0;
      const b = rng.next() < pj ? 1 : 0;
      let obs = a + b;
      if (isTag) {
        const a2 = rng.next() < keep ? a : rng.next() < pj ? 1 : 0;
        const b2 = rng.next() < keep ? b : rng.next() < pj ? 1 : 0;
        obs = a2 + b2;
      }
      col[i] = obs;
      if (bj !== 0) gen[i] += (bj * (a + b - 2 * pj)) / s;
    }
  }
  const resSd = Math.sqrt(Math.max(1 - h2, 0));
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) y[i] = gen[i] + rng.normal(0, resSd);
  return { G, y, gen };
}

/**
 * The base study: `m` independent SNPs, a fraction `hCausal` of them causal
 * with effects N(0, 1) rescaled so the causal SNPs together explain `h2` of
 * the trait's variance (every other SNP's effect is exactly zero), a cohort of
 * `nBase` people, and the per-SNP OLS that gives β̂ and P.
 */
export function simulateBase(rng, opts = {}) {
  const { nBase = 1500, m = 1000, hCausal = 0.3, h2 = 0.3 } = opts;
  const p = new Float64Array(m);
  for (let j = 0; j < m; j += 1) p[j] = 0.05 + 0.9 * rng.next();

  const nCausal = Math.max(1, Math.round(hCausal * m));
  const idx = Array.from({ length: m }, (_, j) => j);
  const causalIdx = rng.shuffle(idx).slice(0, nCausal);
  const betaTrue = new Float64Array(m);
  let ss = 0;
  for (const j of causalIdx) {
    const b = rng.normal(0, 1);
    betaTrue[j] = b;
    ss += b * b;
  }
  const scale = Math.sqrt(h2 / ss);
  for (const j of causalIdx) betaTrue[j] *= scale;

  const base = drawCohort(rng, nBase, p, betaTrue, h2, null, 1);
  const scan = olsScan(base.y, base.G);
  return { p, betaTrue, causalIdx, nCausal, m, h2, nBase, base, betaHat: scan.beta, P: scan.P };
}

/**
 * DECISION 6: the truth alone — allele frequencies and true effects, with no
 * base cohort drawn.
 *
 * The draw order is `simulateBase`'s minus the cohort and the scan, so the same
 * rng gives the same p and the same betaTrue and the two routes can be compared
 * on one truth. `simulateBase` stays because the verify's agreement check needs
 * the per-person route to compare against.
 */
export function drawModel(rng, { m = 1000, nCausal = 300, h2 = 0.3 } = {}) {
  const p = new Float64Array(m);
  for (let j = 0; j < m; j += 1) p[j] = 0.05 + 0.9 * rng.next();
  const idx = Array.from({ length: m }, (_, j) => j);
  const causalIdx = rng.shuffle(idx).slice(0, nCausal);
  const betaTrue = new Float64Array(m);
  let ss = 0;
  for (const j of causalIdx) {
    const b = rng.normal(0, 1);
    betaTrue[j] = b;
    ss += b * b;
  }
  const scale = Math.sqrt(h2 / ss);
  for (const j of causalIdx) betaTrue[j] *= scale;
  return { p, betaTrue, causalIdx, nCausal, m, h2 };
}

/**
 * DECISION 6: what a PRS actually consumes — one β̂ and one P a SNP, from a base
 * study of `nBase` people that is never simulated person by person.
 *
 * On the standardised genotype SNP j's residual variance is 1 − βⱼ², so
 * seⱼ = √((1 − βⱼ²)/n), which is 1/√n to three decimals at every effect size
 * here. The score sums the RAW allele count, so β̂ and se are both divided by
 * √(2pⱼ(1 − pⱼ)); the ratio the P value comes from is the same either way.
 *
 * The approximation is that a SNP's own variance explained is its only
 * departure from 1, and that the allele frequency is the base study's true one
 * rather than its realised one.
 */
export function summaryBase(rng, model, nBase) {
  const m = model.p.length;
  const betaHat = new Float64Array(m);
  const P = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    const pj = model.p[j];
    const s = Math.sqrt(2 * pj * (1 - pj)) || 1;
    const bStd = model.betaTrue[j];
    const seStd = Math.sqrt(Math.max(1 - bStd * bStd, 1e-9) / nBase);
    const hatStd = bStd + rng.normal(0, seStd);
    betaHat[j] = hatStd / s;
    P[j] = normTail2(hatStd / seStd);
  }
  return { betaHat, P };
}

/**
 * A target cohort drawn against an existing base: allele frequencies shifted
 * by Balding–Nichols at `ancestryShift`, and a fraction `tagLoss` of the
 * causal SNPs observed only through a tag at r² `r2tag`.
 */
export function drawTarget(rng, model, opts = {}) {
  const { n = 319, ancestryShift = 0, tagLoss = 0, r2tag = 0.5 } = opts;
  const { p, betaTrue, causalIdx, h2 } = model;
  const pT = new Float64Array(p.length);
  for (let j = 0; j < p.length; j += 1) pT[j] = shiftFrequency(rng, p[j], ancestryShift);
  const tagged = new Uint8Array(p.length);
  if (tagLoss > 0) {
    const shuffled = rng.shuffle(causalIdx);
    const k = Math.round(tagLoss * causalIdx.length);
    for (let i = 0; i < k; i += 1) tagged[shuffled[i]] = 1;
  }
  const co = drawCohort(rng, n, pT, betaTrue, h2, tagged, r2tag);
  return { ...co, p: pT, tagged };
}

/** Σⱼ β̂ⱼ xᵢⱼ over the SNPs `keep` marks — the lesson's equation, literally. */
export function score(G, betaHat, keep) {
  const n = G[0].length;
  const s = new Float64Array(n);
  for (let j = 0; j < G.length; j += 1) {
    if (!keep[j]) continue;
    const b = betaHat[j];
    const col = G[j];
    for (let i = 0; i < n; i += 1) s[i] += b * col[i];
  }
  return s;
}

/** The eleven P thresholds the lesson's own sweep reports. */
export const THRESHOLDS = [5e-8, 1e-5, 0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

/** Which SNPs a P threshold keeps. */
export function keepAt(P, thresh) {
  const keep = new Uint8Array(P.length);
  let n = 0;
  for (let j = 0; j < P.length; j += 1) {
    if (P[j] < thresh) {
      keep[j] = 1;
      n += 1;
    }
  }
  return { keep, n };
}

/**
 * The R² curve: for each threshold, the SNPs kept and the score's R² in every
 * cohort handed in. `cohorts` is an object of name → { G, y }, so the target
 * sample and the validation sample come back on the same row and page 3 can
 * draw one above the other.
 */
export function thresholdCurve(betaHat, P, cohorts, thresholds = THRESHOLDS) {
  return thresholds.map((t) => {
    const { keep, n } = keepAt(P, t);
    const row = { thresh: t, nSnp: n };
    for (const [name, co] of Object.entries(cohorts)) {
      row[name] = n === 0 ? 0 : r2Score(score(co.G, betaHat, keep), co.y);
    }
    return row;
  });
}

/** The threshold with the largest R² in the named cohort — PRSice's "best". */
export function bestThreshold(curve, name = "target") {
  let best = curve[0];
  for (const row of curve) if (row[name] > best[name]) best = row;
  return best;
}

/* ==========================================================================
   5. The quantile plot — 02-2's figure.
   ========================================================================== */

/**
 * `k` quantile bins of the score (k = 20 is the lesson's vigintile), each with
 * the mean trait and its 95% t interval: mean ± qt(0.975, n − 1) × sd/√n,
 * the lesson's own formula.
 */
export function quantileBins(s, y, k = 20) {
  const n = s.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[a] - s[b]);
  const bins = [];
  for (let b = 0; b < k; b += 1) {
    const lo = Math.floor((b * n) / k);
    const hi = Math.floor(((b + 1) * n) / k);
    const idx = order.slice(lo, hi);
    const vals = idx.map((i) => y[i]);
    const mu = mean(vals);
    const s1 = sd(vals);
    const se = s1 / Math.sqrt(vals.length);
    const tc = tCritical(vals.length - 1);
    bins.push({
      bin: b + 1, n: vals.length, idx, mean: mu, sd: s1, se,
      lo: mu - tc * se, hi: mu + tc * se,
    });
  }
  return bins;
}

/** OLS slope of the bin mean against the bin number — the trend's steepness. */
export function binSlope(bins) {
  const xs = bins.map((b) => b.bin);
  const ys = bins.map((b) => b.mean);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return num / den;
}

/** How many bins' intervals exclude the cohort's overall mean. */
export function binsExcludingMean(bins, overall) {
  let k = 0;
  for (const b of bins) if (b.lo > overall || b.hi < overall) k += 1;
  return k;
}

/* ==========================================================================
   The region, the genome, and what the four pages read off them.
   ========================================================================== */

/* Page 1's region, at the density measurement 2 arrived at: 100 SNPs 5 kb
   apart is 495 kb, an array's density rather than a figure's. */
export const REGION = { nHap: 1000, m: 100, blockLen: 5, kFounder: 4 };
export const N_REGION = 500;
/** The causal SNP's effect: β 0.25 is 5.9% of the trait's variance. */
export const REGION_BETA = 0.25;
/** PRSice's own window, `--clump-kb 250kb`. */
export const CLUMP_KB = 250;
/** The same window in SNPs, which is what the r² triangle is clipped to. */
export const CLUMP_DEPTH = Math.round(CLUMP_KB / REGION.blockLen);
/** The r² step 1's readout counts pairs above — the level at which two SNPs
    are carrying nearly the same information about the trait. */
export const R_HIGH = 0.5;
/** The display cut the panel's line names and the readouts count against. */
export const REGION_ALPHA = 0.05;
export const ALPHA_L = -Math.log10(REGION_ALPHA);

/* Steps 3–6's genome, at the size measurement 7 arrived at: 2,000 SNPs is
   141–161 ms, the whole budget for a draw the reader makes on every data
   change; 1,000 keeps the curve's shape at a third of the cost. The base
   study's own size is now a control (decision 6) and costs nothing, because
   no base cohort is drawn. */
export const GENOME = { m: 1000 };
export const N_TARGET = 319;
export const N_VALIDATION = 319;
/** DECISION 10: the one cohort still simulated person by person. */
export const BASE_POP_N = 3000;

/**
 * One region: haplotypes, the r² matrix, 500 people, one hidden causal SNP,
 * the per-SNP test and the clumping.
 *
 * `typed: false` drops the causal SNP's own column before the scan — the
 * realistic case, where the causal variant is not on the array and the lead is
 * necessarily somebody else. The trait is still built from it.
 */
export function buildRegion(rng, cfg) {
  const hap = simulateHaplotypes(rng, { ...REGION, recomb: cfg.recomb });
  const R = ldMatrix(hap.H);
  const G = makeGenotypes(rng, hap.H, N_REGION);
  const causal = rng.int(5, hap.m - 6);
  const y = regionTrait(rng, G, causal, REGION_BETA);

  const idx = [];
  for (let j = 0; j < hap.m; j += 1) if (cfg.typed || j !== causal) idx.push(j);
  const Gs = idx.map((j) => G[j]);
  const pos = idx.map((j) => hap.positions[j]);
  const Rs = idx.map((a) => Float64Array.from(idx.map((b) => R[a][b])));

  const scan = regionScan(y, Gs);
  const clumps = clump(scan.P, Rs, pos, { r2: cfg.clumpR2, kb: CLUMP_KB });
  let lead = 0;
  for (let j = 1; j < idx.length; j += 1) if (scan.P[j] < scan.P[lead]) lead = j;

  const causalPos = hap.positions[causal];
  const causalCol = idx.indexOf(causal);
  /* WHICH BEAT THE CAUSAL MARK ARRIVES ON. The answer is a reference and not
     one of the tests, so it is drawn when the clumping reaches it and not
     before (2.1): the clump that holds the causal SNP's own column, or — when
     the causal variant is not on the array — the first clump whose span
     contains its position. */
  const spans = clumps.map((c) => {
    const cols = [c.index, ...c.members];
    const xs = cols.map((j) => pos[j]);
    return { lo: Math.min(...xs), hi: Math.max(...xs) };
  });
  let causalAt = 0;
  for (let c = 0; c < clumps.length; c += 1) {
    const holds = causalCol >= 0
      ? clumps[c].index === causalCol || clumps[c].members.includes(causalCol)
      : causalPos >= spans[c].lo && causalPos <= spans[c].hi;
    if (holds) {
      causalAt = c + 1;
      break;
    }
  }
  /* A position no clump spans — possible when the causal variant is untyped
     and its neighbours fall either side of it — arrives with the last clump
     rather than never. */
  if (causalAt === 0) causalAt = clumps.length;

  let hits = 0;
  for (let j = 0; j < scan.P.length; j += 1) if (scan.P[j] < REGION_ALPHA) hits += 1;

  /* STEP 1'S OWN READING, over every pair of the region's own SNPs. The mock
     measured the clump COUNT as the wrong number to promise — it reads 8 → 8 →
     23 across the three recombination rates, so Low and Medium are the same —
     while the pairs over r² 0.5 go 634 → 282 → 66 and the furthest of them
     reaches 180 → 80 → 20 kb. What the control moves is how far a shared
     stretch of ancestor runs, so that is what the readout names. */
  let pairsHigh = 0;
  let pairReach = 0;
  for (let j = 0; j < R.length; j += 1) {
    for (let k = 0; k < j; k += 1) {
      if (R[j][k] > R_HIGH) {
        pairsHigh += 1;
        const d = (j - k) * hap.blockLen;
        if (d > pairReach) pairReach = d;
      }
    }
  }

  return {
    hap, R, Rs, idx, pos, scan, clumps, spans, lead, causal, causalCol, causalPos, causalAt,
    pairsHigh,
    pairReach,
    pairsTotal: (R.length * (R.length - 1)) / 2,
    firstClump: clumps.length ? 1 + clumps[0].members.length : 0,
    typed: cfg.typed,
    clumpR2: cfg.clumpR2,
    span: hap.positions[hap.m - 1],
    hits,
    sigClumps: clumps.filter((c) => c.p < REGION_ALPHA).length,
    leadIsCausal: cfg.typed && idx[lead] === causal,
    leadR2: R[idx[lead]][causal],
    leadDist: Math.abs(pos[lead] - causalPos),
    top: Math.max(4, Math.ceil(Math.max(...scan.logp) + 0.6)),
  };
}

/**
 * DECISION 10, 11 and 12: one risk model a threshold, fitted in the base
 * population, and the target sample read through it.
 *
 * The disease is the trait as a liability with a cut at the prevalence, so
 * `prev` decides who has it and the model has to be refitted when it moves —
 * which is why Prevalence is a data parameter. The logistic model is of the
 * outcome on the STANDARDISED score, standardised by the base population's own
 * mean and SD, because that is what a published risk model carries.
 *
 * The calibration intercept is fitted with the model's own logit as an offset,
 * so it reads how far the outcome sits from the prediction; the calibration
 * slope is the coefficient of that logit fitted freely. On the truth they are
 * 0 and 1.
 */
function buildRiskModels(betaHat, P, basePop, target, rows, prev) {
  const liability = normQuantile(1 - prev);
  const yBase = Array.from(basePop.y, (v) => (v > liability ? 1 : 0));
  const yT = Array.from(target.y, (v) => (v > liability ? 1 : 0));
  const nB = basePop.y.length;
  const nT = target.y.length;
  const onesB = new Float64Array(nB).fill(1);
  const onesT = new Float64Array(nT).fill(1);

  /* DECISION 12: the kept sets are nested, so the base population's score at
     one threshold is its score at the last plus the SNPs that fell between
     them — one pass over the SNPs for all eleven. */
  const order = Array.from({ length: P.length }, (_, j) => j).sort((a, b) => P[a] - P[b]);
  const sBase = new Float64Array(nB);
  let next = 0;

  return rows.map((row) => {
    while (next < order.length && P[order[next]] < row.thresh) {
      const j = order[next];
      const b = betaHat[j];
      const col = basePop.G[j];
      for (let i = 0; i < nB; i += 1) sBase[i] += b * col[i];
      next += 1;
    }
    /* A threshold that keeps nothing has no score to fit on, and 5 × 10⁻⁸ over
       a base study of 1,500 people keeps nothing. The step draws its axes and
       says so rather than fitting a model to a column of zeros. */
    if (row.nSnp === 0) return null;
    const mu = mean(sBase);
    const sg = sd(sBase) || 1;
    const z = Float64Array.from(sBase, (v) => (v - mu) / sg);
    const fit = logistic([onesB, z], yBase);
    const a = fit.beta[0];
    const b1 = fit.beta[1];

    const eta = Float64Array.from(row.score, (v) => a + b1 * ((v - mu) / sg));
    const risk = Array.from(eta, expit);
    const idx = risk.map((v, i) => i).sort((x, y2) => risk[x] - risk[y2]);
    const bins = [];
    for (let b = 0; b < RISK_DECILES; b += 1) {
      const lo = Math.floor((b * nT) / RISK_DECILES);
      const hi = Math.floor(((b + 1) * nT) / RISK_DECILES);
      const inBin = idx.slice(lo, hi);
      const cases = inBin.reduce((acc, i) => acc + yT[i], 0);
      const [wl, wh] = wilson(cases, inBin.length);
      bins.push({
        bin: b + 1,
        n: inBin.length,
        cases,
        pred: mean(inBin.map((i) => risk[i])),
        obs: cases / inBin.length,
        lo: wl,
        hi: wh,
      });
    }
    const slope = logistic([onesT, eta], yT).beta[1];
    const inter = logistic([onesT], yT, { offset: eta }).beta[0];
    return {
      a,
      b: b1,
      mu,
      sd: sg,
      liability,
      prev,
      risk,
      order: idx,
      bins,
      slope,
      inter,
      covered: bins.filter((x) => x.lo <= x.pred && x.pred <= x.hi).length,
      cases: yT.reduce((x, y2) => x + y2, 0),
      baseCases: yBase.reduce((x, y2) => x + y2, 0),
      max: Math.max(...risk),
      /* THE CURVE IS ORDERED BY SCORE, NOT BY PREDICTED RISK, and the two are
         the same order only while the fitted slope is positive. Ordering it by
         risk and labelling the axis "score percentile" would be a claim the
         figure could not keep at a slope of the other sign, so the rank the
         axis names is the rank it is drawn from. The deciles above stay
         deciles of PREDICTED RISK, which is what a calibration plot bins on. */
      curve: Array.from({ length: nT }, (_, i) => i)
        .sort((x, y2) => row.score[x] - row.score[y2])
        .map((i, r) => [(100 * r) / (nT - 1), risk[i]]),
    };
  });
}

/** How many of the target sample the model puts at or above a risk. */
export const peopleAbove = (rm, t) => (rm ? rm.risk.filter((v) => v >= t).length : 0);

/**
 * The score percentile at which predicted risk reaches a threshold, or null
 * when the whole sample is one side of it — a line nobody crosses has no
 * crossing, and printing 0 or 100 there would be the figure claiming a reading
 * the data does not carry (2.11).
 */
export function crossingPercentile(rm, t) {
  if (!rm) return null;
  const above = peopleAbove(rm, t);
  if (above === 0 || above === rm.risk.length) return null;
  return 100 * (1 - above / rm.risk.length);
}

/**
 * Steps 3–6: the base study's summary statistics, the target sample, the
 * validation sample, the base population, and everything the eleven thresholds
 * imply — the kept count, both R², the vigintile bins of the target, the R²
 * over the people those bins hold, and the risk model.
 *
 * THE CURVE IS COMPUTED FOR EVERY THRESHOLD, ONCE. The P threshold is a
 * display parameter (decision 3), so what the reader slides over has to be
 * there already; and step 5's own reading of a partial figure — the R² over
 * the vigintiles landed so far — is a cumulative sum over the same bins.
 */
export function buildGenome(rngs, cfg) {
  const model = drawModel(rngs.truth, { m: GENOME.m, nCausal: cfg.nCausal, h2: cfg.h2 });
  /* DECISION 6: the base study is β̂ and P, drawn from its own sub-stream keyed
     by its size, so moving Base study size does not redraw the target sample
     under it. */
  const { betaHat, P: basePv } = summaryBase(rngs.summary, model, cfg.nBase);
  const tOpts = { ancestryShift: cfg.fst, tagLoss: cfg.tagLoss, r2tag: cfg.r2tag };
  const target = drawTarget(rngs.target, model, { n: N_TARGET, ...tOpts });
  const validation = drawTarget(rngs.validation, model, { n: N_VALIDATION, ...tOpts });
  /* DECISION 10: the base population, at the base study's own allele
     frequencies with every causal SNP seen directly — a model fitted in the
     target sample would sit on the diagonal there by construction. */
  const basePop = drawTarget(rngs.basePop, model, { n: BASE_POP_N });

  const overall = mean(target.y);
  const ysd = sd(target.y);
  const rows = THRESHOLDS.map((thresh) => {
    const { keep, n } = keepAt(basePv, thresh);
    const kept = [];
    for (let j = 0; j < basePv.length; j += 1) if (keep[j]) kept.push(j);
    /* DECISION 14: strongest evidence first, so step 3's countable forty are
       the forty that carry the most weight. The index breaks a tie, so the
       order is the same in any engine. */
    kept.sort((a, b) => basePv[a] - basePv[b] || a - b);
    const sT = score(target.G, betaHat, keep);
    const sV = score(validation.G, betaHat, keep);
    const r2T = n === 0 ? 0 : r2Score(sT, target.y);
    const r2V = n === 0 ? 0 : r2Score(sV, validation.y);
    const bins = quantileBins(sT, target.y, 20);
    /* the R² over the people the first k vigintiles hold — what page 4's tile
       can honestly print while the figure is still arriving (2.8) */
    const binR2 = [0];
    const sSoFar = [];
    const ySoFar = [];
    for (const b of bins) {
      for (const i of b.idx) {
        sSoFar.push(sT[i]);
        ySoFar.push(target.y[i]);
      }
      binR2.push(sSoFar.length > 2 ? r2Score(sSoFar, ySoFar) : 0);
    }
    return {
      thresh,
      nSnp: n,
      kept,
      target: r2T,
      validation: r2V,
      score: sT,
      bins,
      binR2,
      range: (bins[19].mean - bins[0].mean) / ysd,
      excluding: binsExcludingMean(bins, overall),
      sMin: Math.min(...sT),
      sMax: Math.max(...sT),
      sMean: mean(sT),
      sSd: sd(sT),
    };
  });

  let bestIdx = 0;
  for (let i = 1; i < rows.length; i += 1) if (rows[i].target > rows[bestIdx].target) bestIdx = i;

  const risk = buildRiskModels(betaHat, basePv, basePop, target, rows, cfg.prevalence);

  return {
    ...model,
    betaHat,
    P: basePv,
    nBase: cfg.nBase,
    target,
    validation,
    basePop,
    rows,
    risk,
    bestIdx,
    overall,
    ysd,
  };
}

/**
 * Everything the widget draws, from the seeded rng and the resolved controls.
 *
 * DECISION 1: five sub-streams, their seeds taken off the top of the rng core
 * hands in, so a control on one step cannot move another step's data. The
 * fifth is round two's base population; taking it after the first four leaves
 * those four exactly where they were.
 *
 * The base study's own stream is keyed by its SIZE, so moving Base study size
 * redraws the summary statistics and nothing else — the truth, the target
 * sample and the validation sample stay where they are, which is what makes
 * the control a lever on one quantity rather than a reshuffle.
 */
export function build(rng, cfg) {
  const seeds = [];
  for (let i = 0; i < 5; i += 1) seeds.push(rng.int(1, 1e9));
  const region = buildRegion(makeRng(seeds[0]), cfg);
  const genome = buildGenome({
    truth: makeRng(seeds[1]),
    summary: makeRng(seeds[1] ^ cfg.nBase),
    target: makeRng(seeds[2]),
    validation: makeRng(seeds[3]),
    basePop: makeRng(seeds[4]),
  }, cfg);
  return { cfg, region, genome };
}

/* ==========================================================================
   What a partly built figure reads.
   ========================================================================== */

/** The row of the curve the P threshold names. */
export const rowFor = (state, params) =>
  state.genome.rows[Math.max(0, THRESHOLDS.indexOf(Number(params.threshold)))];

/** Page 2's arithmetic for one person, at the threshold on the rail. */
export function personScore(state, params) {
  const row = rowFor(state, params);
  const i = Math.min(Math.max(Math.round(params.person) - 1, 0), N_TARGET - 1);
  const genotype = row.kept.map((j) => state.genome.target.G[j][i]);
  const beta = row.kept.map((j) => state.genome.betaHat[j]);
  const contrib = genotype.map((g, k) => g * beta[k]);
  const cum = [];
  let run = 0;
  for (const c of contrib) {
    run += c;
    cum.push(run);
  }
  const total = row.score[i];
  let below = 0;
  for (const v of row.score) if (v < total) below += 1;
  return {
    row,
    person: i + 1,
    n: row.nSnp,
    genotype,
    beta,
    contrib,
    cum,
    total,
    z: row.sSd > 0 ? (total - row.sMean) / row.sSd : 0,
    percentile: (100 * below) / row.score.length,
  };
}

/** The risk model the P threshold names, or null where nothing is kept. */
export const riskFor = (state, params) =>
  state.genome.risk[Math.max(0, THRESHOLDS.indexOf(Number(params.threshold)))];

/**
 * One person's predicted risk, beside the score percentile step 3 gives them —
 * the pair the first five steps withhold.
 *
 * The percentile is read off the SCORE and not off the risk, so the number here
 * is the number step 3 prints for the same person.
 */
export function personRisk(state, params) {
  const rm = riskFor(state, params);
  const row = rowFor(state, params);
  const i = Math.min(Math.max(Math.round(params.person) - 1, 0), N_TARGET - 1);
  if (!rm) return { person: i + 1, risk: null, percentile: null };
  let below = 0;
  for (const v of row.score) if (v < row.score[i]) below += 1;
  return { person: i + 1, risk: rm.risk[i], percentile: (100 * below) / row.score.length };
}

/** How many deciles of predicted risk step 6 draws. */
export const RISK_DECILES = 10;

/* DECISION 14: every kept SNP is a column, and the axis is the kept count from
   the first frame. `cw` is what one SNP gets; the strips switch from dots to
   bars of whole units below SCORE_DOT_MIN because two stacked dots need the
   room and a hairline bar of 0, 1 or 2 units says the same thing at any width
   (2.3). `units` is the domain the three plots share, in column widths. */
export const SCORE_DOT_MIN = 4;
export function scoreAxis(w, nKept) {
  const cols = Math.max(0, nKept);
  return { cols, cw: cols > 0 ? w / cols : w, units: Math.max(cols, 1) };
}

/** How many beats a step's run holds. */
export function totalFor(page, state, params) {
  if (page === "haplotypes") return HAP_ROWS;
  /* DECISION 9: three beats a clump — the lead lights, the arcs draw, the
     absorbed SNPs slide. */
  if (page === "clump") return CLUMP_BEATS * state.region.clumps.length;
  /* DECISION 14: a beat a SNP, however many the threshold keeps. */
  if (page === "score") return rowFor(state, params).nSnp;
  if (page === "threshold") return THRESHOLDS.length;
  if (page === "risk") return RISK_DECILES;
  return 20;
}

/* PACING. One beat a unit, and the beat is the step's own: eleven thresholds
   and twenty-four clumping beats are not the same length of run as thirty-eight
   SNPs, so a single interval would make one step crawl and another flick past.
   The measured totals at the defaults are in `_lab/prs-verify.mjs`, which
   fails any step whose Play lands outside 3 to 7 seconds.

   THE FRACTION IS KEPT ACROSS FRAMES (widget 55's clock): `beat` fills over
   the step's own interval and the run advances by whatever whole units have
   accumulated, so the pace stays a RATE rather than becoming one unit a frame
   on a slow machine. */
export const BEAT_MS = {
  haplotypes: 100, clump: 260, score: 140, threshold: 400, quantile: 200, risk: 400,
};
/* DECISION 14: A LONG RUN IS HURRIED, on step 3 alone. A beat a SNP at 140 ms
   is 22 s for the default's 160 and over two minutes for every SNP in the base
   study, so step 3's beat is the smaller of its nominal one and the one that
   makes the whole run SCORE_RUN_MS — 38 ms a SNP at 160, 6 at 1,000, which the
   rate clock below turns into two or three SNPs a frame. At 40 or fewer kept
   the nominal beat is the smaller and nothing changes. The floor below still
   applies, so the two limits meet at a run of 3.2 to 6 s at every count. */
export const SCORE_RUN_MS = 6000;
/* A SHORT RUN IS STRETCHED, NEVER A LONG ONE HURRIED. Low recombination leaves
   two clumps where the default leaves eight, and six beats at 260 ms is 1.6
   seconds — a run that is over before a room has looked up. The floor is a
   declared property of the SETTING, computed the same way on every frame, not
   the animation deciding about its own pace mid-run (4.1): a run of n beats
   gets whichever is slower, the step's own beat or the beat that makes the
   whole run MIN_RUN_MS. The cap keeps a one-unit run from crawling. */
export const MIN_RUN_MS = 3200;
export const MAX_BEAT_MS = 1200;
export function beatMs(page, state, params) {
  let nominal = BEAT_MS[page] ?? 200;
  if (!state) return nominal;
  const beats = Math.ceil(totalFor(page, state, params) / perUnit(page, state, params));
  if (!(beats > 0)) return nominal;
  /* DECISION 14: step 3's ceiling, then the floor every step has */
  if (page === "score") nominal = Math.min(nominal, SCORE_RUN_MS / beats);
  return Math.max(nominal, Math.min(MAX_BEAT_MS, MIN_RUN_MS / beats));
}

/* A BEAT CARRIES A BATCH once the units stop being countable (2.3) — on step 2
   where a strict clumping r² leaves fifty-eight clumps of one SNP rather than
   eight of twenty. The cap is the number of beats the whole run takes, so Play
   is between three and seven seconds at every setting of every control.

   STEP 3 IS NOT CAPPED HERE (decision 14): its unit is a SNP at every count,
   and a long run is hurried by the beat rather than carrying several SNPs a
   press, so Next SNP keeps meaning one.

   STEP IS ONE UNIT EVERYWHERE EXCEPT STEP 2, where it runs to the end of the
   clump in progress (decision 9) — a control's label names what this press
   will do (4.4b), and on step 2 it says Next clump while the unit is a beat. */
export const RUN_BEATS = { clump: 24 };
export function perUnit(page, state, params) {
  const cap = RUN_BEATS[page];
  if (!cap) return 1;
  return Math.max(1, Math.ceil(totalFor(page, state, params) / cap));
}

/* ==========================================================================
   The geometry, one function (5.8).

   The heights are set by `axisX`, which puts its tick row at the baseline + 6
   and its label at the baseline + 22 with `textBaseline: "top"`, so a label
   occupies to about + 35; a `caption` sits 8px above its rect on an alphabetic
   baseline and occupies from about − 18. The stacked page-1 and page-2 panels
   are spaced against that arithmetic and not by eye — the mock had the sum
   strip's axis label and the distribution's caption at 302 and 314, printing
   through each other.
   ========================================================================== */

export const AX_L = 52;
export const AX_R = 8;

/* DECISION 8: the step line, above every stage's caption row. One --fs-xs line
   plus the air under it, and every panel below it starts that much lower. */
export const STEP_LINE_H = 21;
/** The step line's own baseline, with `textBaseline: "top"`. */
export const HEAD_Y = 14;

/* step 1 — 40 rows of the pool, then the triangle under them. The block's
   height and the gap are the mock's §1 candidate A at 550px: 410px of stage. */
export const HAP_ROWS = 40;
export const HAP_TOP = 34;
export const HAP_H = 168;
export const HAP_FOOT = 26;
export const HAP_GAP = 44;
export const TRI_FOOT = 14;

/* step 2 — the association plot alone, at the mock's own 550 × 300 */
export const ASSOC_TOP = 46;
export const ASSOC_H = 198;
export const ASSOC_PANEL_H = 300;
/** DECISION 9: three beats a clump. */
export const CLUMP_BEATS = 3;

/* step 3 */
export const GENO_Y = 38;
export const GENO_H = 30;
export const W_Y = 90;
export const W_H = 66;
export const SUM_Y = 188;
export const SUM_H = 92;
export const DIST_Y = 336;
export const DIST_H = 44;
export const SCORE_PANEL_H = 424;

/* step 4 — the right margin holds the SNPs-kept tick column and its label, and
   the panel is 21px taller than the draft's for the reading line under the
   axis (the mock's §4) */
export const TH_L = 54;
export const TH_R = 66;
export const TH_TOP = 40;
export const TH_H = 210;
export const READ_LINE_DY = 46;
export const THRESH_PANEL_H = 337;

/* step 5 */
export const Q_L = 54;
export const Q_R = 16;
export const Q_TOP = 40;
export const Q_H = 196;
export const QUANT_PANEL_H = 300;

/* step 6 — two square plots side by side, the mock's §6 candidate B */
export const RISK_TOP = 44;
export const RISK_SIDE = 196;
export const RISK_L = 44;
/* room between the two squares for the right one's own tick labels */
export const RISK_GAP = 90;

/**
 * Every rect a step draws in, and its own height, from the width and the
 * parameters alone — the same function `height` and `draw` both call (5.8).
 *
 * EVERY STAGE CARRIES THE STEP LINE, so every panel's y is offset by
 * `STEP_LINE_H` and every height includes it. One constant, added once here,
 * rather than a different top margin written into six branches.
 */
export function layout(w, values) {
  const page = pageOf(values);
  const top = STEP_LINE_H;
  const panelW = Math.max(220, Math.round(w - AX_L - AX_R));
  /* The step line runs the width of whatever the step draws under it, so it is
     part of the geometry and not a margin guessed in the drawing code. */
  const head = (x, width) => ({ x, y: HEAD_Y, w: width });
  if (page === "haplotypes") {
    const triTop = top + HAP_TOP + HAP_H + HAP_FOOT + HAP_GAP;
    /* DECISION 13: the whole half-matrix, m − 1 cells deep at half the column
       pitch — 243px at the 550 stage, 312 at 690 — so the panel is taller in
       a wider frame, the same trade `linear-regularization` makes for a
       square. The pitch is the BLOCK'S, w / m, so a cell sits above the
       midpoint of the two columns it joins. */
    const block = { x: AX_L, y: top + HAP_TOP, w: panelW, h: HAP_H };
    const triH = Math.ceil(((REGION.m - 1) / 2) * snpPitch(block));
    return {
      page,
      head: head(AX_L, panelW),
      block,
      tri: { x: AX_L, y: triTop, w: panelW, h: triH },
      height: triTop + triH + TRI_FOOT,
    };
  }
  if (page === "clump") {
    return {
      page,
      head: head(AX_L, panelW),
      assoc: { x: AX_L, y: top + ASSOC_TOP, w: panelW, h: ASSOC_H },
      height: top + ASSOC_PANEL_H,
    };
  }
  if (page === "score") {
    return {
      page,
      head: head(AX_L, panelW),
      geno: { x: AX_L, y: top + GENO_Y, w: panelW, h: GENO_H },
      weights: { x: AX_L, y: top + W_Y, w: panelW, h: W_H },
      sum: { x: AX_L, y: top + SUM_Y, w: panelW, h: SUM_H },
      dist: { x: AX_L, y: top + DIST_Y, w: panelW, h: DIST_H },
      height: top + SCORE_PANEL_H,
    };
  }
  if (page === "threshold") {
    return {
      page,
      head: head(TH_L, Math.max(220, Math.round(w - TH_L - AX_R))),
      curve: {
        x: TH_L, y: top + TH_TOP, w: Math.max(220, Math.round(w - TH_L - TH_R)), h: TH_H,
      },
      height: top + THRESH_PANEL_H,
    };
  }
  if (page === "risk") {
    /* BOTH PLOTS STAY SQUARE, because a calibration plot whose diagonal is not
       a diagonal is not a calibration plot. The side is capped at the mock's
       196 so the stage stays 296px at every width the side layout reaches, and
       shrinks only if the frame is narrower than that allows. */
    const side = Math.max(120, Math.min(RISK_SIDE, Math.floor((w - RISK_L - 86 - 16) / 2)));
    const left = Math.max(RISK_L, Math.round((w - (2 * side + RISK_GAP)) / 2));
    return {
      page,
      head: head(RISK_L, Math.max(220, Math.round(w - 20 - RISK_L))),
      cal: { x: left, y: top + RISK_TOP, w: side, h: side },
      strat: { x: left + side + RISK_GAP, y: top + RISK_TOP, w: side, h: side },
      height: top + RISK_TOP + side + 56,
    };
  }
  return {
    page: "quantile",
    head: head(Q_L, Math.max(220, Math.round(w - Q_L - Q_R))),
    bins: { x: Q_L, y: top + Q_TOP, w: Math.max(220, Math.round(w - Q_L - Q_R)), h: Q_H },
    height: top + QUANT_PANEL_H,
  };
}

/** The stage height, from the parameters and the width alone. */
export const stageHeight = (w, values) => layout(w, values).height;

/* ==========================================================================
   DECISION 15: the block ↔ triangle link — its geometry, its statistics and
   its copy, all of it callable with no DOM.
   ========================================================================== */

/** One pitch for the block's columns and the triangle's SNPs. */
export const snpPitch = (rect) => rect.w / REGION.m;
export const snpCentreX = (rect, j) => rect.x + (j + 0.5) * snpPitch(rect);

/** Where the pair (j, k) sits in the triangle: above the midpoint of its two
    columns, |j − k| / 2 cells deep. */
export function cellCentre(tri, j, k) {
  const cw = snpPitch(tri);
  return { x: tri.x + ((j + k + 1) / 2) * cw, y: tri.y + (Math.abs(j - k) / 2) * cw };
}

/** The block column under a point, or −1. */
export function blockColumnAt(block, x, y) {
  if (x < block.x || x >= block.x + block.w || y < block.y || y >= block.y + block.h) return -1;
  return Math.min(REGION.m - 1, Math.floor((x - block.x) / snpPitch(block)));
}

/**
 * The triangle cell under a point as [k, j] with k < j, or null.
 *
 * The image is drawn through (u, v) → (x₀ + cw(u + v)/2, y₀ + cw(v − u)/2),
 * which inverts to u = a − b and v = a + b for a = (x − x₀)/cw and
 * b = (y − y₀)/cw; the cell is the floor of each. Above the axis there is no
 * cell, and on or above the diagonal (v ≤ u) there is none either.
 */
export function triCellAt(tri, x, y) {
  if (y < tri.y) return null;
  const cw = snpPitch(tri);
  const a = (x - tri.x) / cw;
  const b = (y - tri.y) / cw;
  const u = Math.floor(a - b);
  const v = Math.floor(a + b);
  if (u < 0 || v >= REGION.m || v <= u) return null;
  return [u, v];
}

/** What is under a point on step 1: one SNP, a pair, or nothing. */
export function subjectAt(L, x, y) {
  const j = blockColumnAt(L.block, x, y);
  if (j >= 0) return { kind: "snp", snps: [j] };
  const cell = triCellAt(L.tri, x, y);
  return cell ? { kind: "pair", snps: cell } : null;
}

/* THE PIN. `snps` carries one SNP number or two, as the reading line prints
   them (one-based, ascending, "37" or "37,52"); anything else parses to the
   empty pin. Seven characters holds "99,100". */
export const SNPS_MAX_LENGTH = 7;
export function parseSnps(text) {
  const seen = [];
  for (const part of String(text ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 1 && n <= REGION.m && !seen.includes(n)) seen.push(n);
  }
  return seen.slice(0, 2).sort((a, b) => a - b).join(",");
}
/** The pinned SNPs, zero-based: [], [j] or [k, j]. */
export const snpsOf = (params) =>
  parseSnps(params?.snps).split(",").filter(Boolean).map((v) => Number(v) - 1);
export const snpsText = (snps) => [...snps].sort((a, b) => a - b).map((j) => j + 1).join(",");
/** The subject a pin names, in the shape `subjectAt` returns. */
export function pinnedSubject(params) {
  const snps = snpsOf(params);
  if (!snps.length) return null;
  return { kind: snps.length === 2 ? "pair" : "snp", snps };
}

/**
 * The region table core resolves a click through: the block's m columns and
 * the triangle's m(m − 1)/2 cells. A cell is a diamond and a region is a
 * rectangle, so a cell's is the square inscribed in its bounding box less half
 * a pixel a side — the centre of every cell then lies in its own square and
 * no other, which is what the hit-driven state aims at. Clicking what is
 * already pinned clears the pin.
 */
export function regionsFor(L, params) {
  const current = parseSnps(params?.snps);
  const toggle = (snps) => {
    const text = snpsText(snps);
    return text === current ? "" : text;
  };
  const out = [];
  const bw = snpPitch(L.block);
  for (let j = 0; j < REGION.m; j += 1) {
    out.push({
      x: L.block.x + j * bw, y: L.block.y, w: bw, h: L.block.h,
      set: { snps: toggle([j]) }, label: `SNP ${j + 1}`,
    });
  }
  const cw = snpPitch(L.tri);
  const side = Math.max(1, cw - 0.5);
  for (let j = 1; j < REGION.m; j += 1) {
    for (let k = 0; k < j; k += 1) {
      const c = cellCentre(L.tri, j, k);
      out.push({
        x: c.x - side / 2, y: c.y - side / 2, w: side, h: side,
        set: { snps: toggle([k, j]) }, label: `SNPs ${k + 1} and ${j + 1}`,
      });
    }
  }
  return out;
}

/**
 * A pair's statistics: r² from the pool, the sign of D, and how many of the
 * rows on screen carry the pair in one of its two commonest forms — both
 * derived or both ancestral when D ≥ 0, one of each when D < 0. Those rows
 * are the ones on one stretch of ancestor across the pair, which is the thing
 * r² measures; the count beside the r² is the nearest the figure comes to
 * defining it without a formula.
 */
export function pairStats(region, j, k, rows = HAP_ROWS) {
  const H = region.hap.H;
  const n = H[0].length;
  let pa = 0;
  let pb = 0;
  let pab = 0;
  for (let i = 0; i < n; i += 1) {
    pa += H[j][i];
    pb += H[k][i];
    pab += H[j][i] * H[k][i];
  }
  const D = pab / n - (pa / n) * (pb / n);
  const flags = new Uint8Array(rows);
  let together = 0;
  for (let i = 0; i < rows; i += 1) {
    const same = H[j][i] === H[k][i];
    if (D >= 0 ? same : !same) {
      flags[i] = 1;
      together += 1;
    }
  }
  return {
    r2: region.R[j][k], D, together, rows, flags,
    dist: Math.abs(region.hap.positions[j] - region.hap.positions[k]),
  };
}

/** One SNP's statistics: its partners above R_HIGH, the furthest of them, and
    its r² with the causal SNP. */
export function snpStats(region, j) {
  let n = 0;
  let reach = 0;
  for (let k = 0; k < REGION.m; k += 1) {
    if (k !== j && region.R[j][k] > R_HIGH) {
      n += 1;
      reach = Math.max(reach, Math.abs(region.hap.positions[j] - region.hap.positions[k]));
    }
  }
  return { n, reach, pos: region.hap.positions[j], r2Causal: region.R[j][region.causal] };
}

/* THE READING LINES, under the block while a subject is on screen. They are
   functions of live numbers, so `_lab/prs-verify.mjs` §11 calls them to put
   them through the register sweep. "Travel together" is the lesson's own
   sense of LD — variants "inherited together more often than expected by
   chance" — and the rows clause is dropped while no row is drawn. */
export const pairReading = (j, k, st) =>
  `SNP ${Math.min(j, k) + 1} and SNP ${Math.max(j, k) + 1} · ${intText(st.dist)} kb apart · `
  + `r² ${n2(st.r2)}`
  + (st.rows > 0 ? ` · the two alleles travel together in ${st.together} of ${st.rows} rows` : "");
export const snpReading = (region, j, st) =>
  `SNP ${j + 1} at ${intText(st.pos)} kb${j === region.causal ? ", the causal SNP" : ""} · `
  + `r² above ${R_HIGH} with ${st.n} SNP${st.n === 1 ? "" : "s"}`
  + (st.n > 0 ? `, the furthest ${intText(st.reach)} kb away` : "");
/** The line a subject earns, over the rows drawn so far. */
export function readingFor(region, subject, rows) {
  if (!subject) return null;
  if (subject.kind === "pair") {
    const [k, j] = subject.snps;
    return pairReading(j, k, pairStats(region, Math.max(j, k), Math.min(j, k), rows));
  }
  const [j] = subject.snps;
  return snpReading(region, j, snpStats(region, j));
}

/* ==========================================================================
   Numbers on screen.
   ========================================================================== */

export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
export const intText = (v) => Math.round(v).toLocaleString("en-US");
/** A P threshold as the reader sees it on its own tick. */
export const tText = (t) => {
  const s = String(t);
  return s.includes("e") ? s.replace("e-", "e−") : s;
};

/* ==========================================================================
   The parameters, and their copy (5.9).

   No "tune", "tuned" or "tuning" and no "holdout" anywhere a reader can see
   them — Kenneth's two nomenclature rulings, 2026-09-12. The field's own
   words are the base GWAS, the target sample, the validation sample, the
   best-fit threshold, out of sample, and overfitting; `--c-holdout` stays the
   token the validation curve is drawn in, which is a name in this file and
   not on the page.
   ========================================================================== */

/* DECISION 7: six numbered verbs, two a row. A grid of nouns is a menu of
   places; the numbers are what say which way to read it.

   THE URL VALUES. Five of the six are a word on the control's own face
   (5.9). `quantile` is the sixth: it was this step's own displayed name in
   round one ("The quantile plot"), it is the field's word for the figure, and
   keeping it means the draft's `?page=quantile` links still resolve — where
   renaming it "check" would break them and collide with step 3's own noun.
   `page=ld` is the one value round two breaks, and it is the value that became
   two steps. */
export const PAGES = [
  { value: "haplotypes", label: "1 · See the haplotypes" },
  { value: "clump", label: "2 · Clump the SNPs" },
  { value: "score", label: "3 · Build the score" },
  { value: "threshold", label: "4 · Choose the threshold" },
  { value: "quantile", label: "5 · Check the score" },
  { value: "risk", label: "6 · Calibrate the risk" },
];
export const PAGE_VALUES = PAGES.map((p) => p.value);
export const pageOf = (values) =>
  (PAGE_VALUES.includes(values?.page) ? values.page : PAGE_VALUES[0]);
/** Where a step sits in the six, one-based — what the step line prints. */
export const stepNumber = (page) => PAGE_VALUES.indexOf(pageOf({ page })) + 1;

/* DECISION 6: the base study's size, the lever round one was missing. Measured
   over 16 seeds the best-fit R² goes 0.106 → 0.261 → 0.290 and the vigintile
   range 1.29 → 2.06 → 2.21 SD; 15,000 is the default because it is where the
   jump happens and it is the size of the base the field's own cholesterol
   scores come from. */
export const BASE_SIZES = [
  { value: "1500", label: "1,500", n: 1500 },
  { value: "15000", label: "15,000", n: 15000 },
  { value: "150000", label: "150,000", n: 150000 },
];
export const baseSizeOf = (key) => BASE_SIZES.find((b) => b.value === key) ?? BASE_SIZES[1];

/* DECISION 11: the prevalence sets the liability cut, so it decides who has the
   disease. Measured: at 5% five of the ten deciles hold no case at all and the
   panel is a row of zeros with wide intervals; at 20% a decile holds about six
   and the matched panel reads as calibrated. */
export const PREVALENCES = [
  { value: "5", label: "5%", p: 0.05 },
  { value: "10", label: "10%", p: 0.1 },
  { value: "20", label: "20%", p: 0.2 },
];
export const prevalenceOf = (key) => PREVALENCES.find((p) => p.value === key) ?? PREVALENCES[2];

/* The absolute risks a guideline-like cut is drawn at. Measured: at 10% the
   line catches 216 of the 319 in a matched target, which is not a
   stratification; 30% catches about a fifth. */
export const RISK_THRESHOLDS = [
  { value: "20", label: "20%", p: 0.2 },
  { value: "30", label: "30%", p: 0.3 },
  { value: "40", label: "40%", p: 0.4 },
];
export const riskThresholdOf = (key) =>
  RISK_THRESHOLDS.find((r) => r.value === key) ?? RISK_THRESHOLDS[1];

/* The three recombination rates, measured over 50 seeds: at 0.002 the region
   holds LD out past 200 kb, at 0.005 a SNP has several neighbours over r² 0.1
   inside the clumping window, at 0.02 almost none. */
export const RECOMB = [
  { value: "low", label: "Low", rate: 0.002 },
  { value: "medium", label: "Medium", rate: 0.005 },
  { value: "high", label: "High", rate: 0.02 },
];
export const recombOf = (key) => RECOMB.find((r) => r.value === key) ?? RECOMB[1];

/* PRSice's own `--clump-r2 0.1`, and the stricter setting beside it. */
export const CLUMP_R2 = [
  { value: "0.1", label: "0.1" },
  { value: "0.5", label: "0.5" },
];

export const TYPED = [
  { value: "typed", label: "Typed" },
  { value: "untyped", label: "Untyped" },
];

/* The polygenicity ladder. Measured: 100 causal SNPs of 1,000 put R² 0.10 at
   5 × 10⁻⁸ and peak at 10⁻³, which is the opposite of the lesson's curve; 300
   reproduces it. */
export const CAUSAL = [
  { value: "100", label: "100" },
  { value: "300", label: "300" },
  { value: "600", label: "600" },
];

export const H2 = [
  { value: "0.1", label: "0.1" },
  { value: "0.3", label: "0.3" },
  { value: "0.5", label: "0.5" },
];

/* THE TARGET POPULATION MOVES TAG DECAY AS WELL AS ALLELE FREQUENCY, and that
   is measurement 5: at Fst 0.1 with every tag intact a score keeps 0.91 of its
   matched R², because each causal SNP still carries its own effect and only
   the raw-scale weight is mis-sized. The loss is in the tags. Fst 0.02 with
   half the causal SNPs seen at r² 0.5 gives about 0.7, and Fst 0.1 with all of
   them at r² 0.2 gives about 0.2 — Martin 2019's African-target figure. */
/* `sample` is the label in the middle of a sentence: "a target sample of the
   base study's own ancestry" reads where "a Same ancestry as the base target
   sample" does not. The control and the canvas keep `label`. */
export const TARGETS = [
  {
    value: "same",
    label: "Same ancestry as the base",
    sample: "the base study's own ancestry",
    fst: 0,
    tagLoss: 0,
    r2tag: 0.5,
  },
  {
    value: "nearby",
    label: "Nearby ancestry",
    sample: "a nearby ancestry",
    fst: 0.02,
    tagLoss: 0.5,
    r2tag: 0.5,
  },
  {
    value: "distant",
    label: "Distant ancestry",
    sample: "a distant ancestry",
    fst: 0.1,
    tagLoss: 1,
    r2tag: 0.2,
  },
];
export const targetOf = (key) => TARGETS.find((t) => t.value === key) ?? TARGETS[0];

/* The eleven thresholds as the slider's ticks. The value IS the tick, so a
   copied link carries the number the reader saw (5.9). */
export const THRESHOLD_OPTIONS = ["5e-8", "1e-5", "0.001", "0.01", "0.05", "0.1", "0.2", "0.3",
  "0.4", "0.5", "1"].map((s) => ({ value: s, label: s }));

export const STRINGS = {
  /* Kenneth's pick C of three, 2026-09-12, in the field's own terms after his
     question "I see the word tune — is this normal?" */
  subtitle:
    "A polygenic score is the sum of effect alleles weighted by base-GWAS effect sizes. "
    + "Its accuracy is assessed out of sample and depends on the target sample sharing "
    + "the base study's ancestry.",

  /* the gallery card: one declarative sentence naming the concept, inside the
     card's 120 characters */
  blurb:
    "A polygenic score sums effect alleles weighted by GWAS effect sizes; its accuracy is assessed out of sample.",

  pageLabel: "Step",
  pageDetail: "the six steps of building a score and reading it",

  regionSection: "The region",
  baseSection: "The base study",
  targetSection: "The target",

  baseSizeLabel: "Base study size",
  baseSizeDetail: "the number of people in the base GWAS",

  recombLabel: "Recombination",
  recombDetail: "the chance per kilobase that a haplotype switches ancestor",

  clumpR2Label: "Clumping r²",
  /* Copy audit 2026-09-12: the question-shaped details ("how many", "how
     far", "which of") and "counts as explained" restated as what each
     control is. */
  clumpR2Detail: "the r² to the lead SNP at or above which a SNP is dropped",

  typedLabel: "Causal variant",
  typedDetail: "whether the causal SNP is one of the 100 on the array",

  causalLabel: "Causal SNPs",
  causalDetail: "the number of the 1,000 SNPs with an effect on the trait",

  h2Label: "Heritability",
  /* One line at 300px — Kenneth's pick 7, which trimmed the two details that
     wrapped. The longer form was "the fraction of the trait's variance the
     causal SNPs explain together". */
  h2Detail: "the trait's variance the causal SNPs explain",

  targetLabel: "Target population",
  targetDetail: "the distance between the target sample's ancestry and the base study's",

  thresholdLabel: "P threshold",
  thresholdDetail: "the P value in the base study below which a SNP is kept in the score",

  personLabel: "Person",
  personDetail: "the person in the target sample whose score is built",

  seedLabel: "Seed",
  seedDetail: "draws a different base study and different samples",

  /* the drive row, one noun a step (3.4c) */
  stepHaplotypes: "Next haplotype",
  stepLd: "Next clump",
  stepScore: "Next SNP",
  stepThreshold: "Next threshold",
  stepQuantile: "Next vigintile",
  stepTitleHaplotypes: "Draw the next haplotype of the pool",
  stepTitleLd: "Choose the next lead SNP, and drop the SNPs in LD with it",
  stepTitleScore: "Add the next SNP to the sum",
  stepTitleThreshold: "Score both samples at the next P threshold",
  stepTitleQuantile: "Draw the next vigintile of the score",
  runTitleHaplotypes: "Draw the rest of the haplotypes",
  runTitleLd: "Clump the rest of the region",
  runTitleScore: "Add the remaining SNPs in order",
  runTitleThreshold: "Sweep the remaining P thresholds",
  runTitleQuantile: "Draw the remaining vigintiles",

  /* DECISION 8: the step line and the hand-off, above every caption row. The
     hand-off names what the step before produced; step 1 has no step before
     it, so it names what this one draws. Steps 3 to 6 work on independent
     SNPs, which is what clumping a base study leaves — so the hand-off from
     step 2 can say so without claiming the region's own SNPs travelled. */
  handHaplotypes: "the region's haplotype pool",
  handClump: "from step 1: the region's haplotypes",
  handScore: "from step 2: SNPs with no LD between them",
  handThreshold: "from step 3: a score for every person",
  handQuantile: "from step 4: the P threshold to score at",

  /* step 1, on the canvas */
  blockCaption: "haplotypes in the region, one row each",
  blockNote: "one tone an allele",
  /* decision 13: the whole half-matrix, with the clumping window's reach as a
     rule across it */
  /* round 3: the lesson's one term for this is linkage disequilibrium, so the
     caption names it and r² is its measure */
  triCaption: "linkage disequilibrium (r²) between every pair of SNPs",
  triNote: "0 to 1",
  windowLabel: `the clumping window · ${CLUMP_KB} kb`,

  /* step 2 */
  assocCaption: "every SNP in the region tested against the trait",
  assocCaptionLead: "the lowest P in the region, and every SNP in LD with it",
  assocCaptionClumped: "the lead SNP of each clump, and the SNPs in LD with it",
  assocX: "position (kb)",
  assocY: "−log₁₀P",
  alphaLabel: "P = 0.05",

  /* step 3 */
  genoCaption: "the person's genotype, effect alleles carried",
  weightCaption: "the base study's weight for each SNP",
  weightNote: "β̂ per effect allele",
  sumCaption: "the sum so far",
  /* The order is by P and the axis is where a reader can be told so (2.9). */
  sumX: "SNPs kept by the P threshold, lowest P first",
  distCaption: "every person in the target sample, by score",
  distX: "score",

  /* step 4 */
  curveCaption: "R² of the score against the P threshold",
  curveNote: "best-fit threshold in the target sample, then assessed in the validation sample",
  curveX: "P threshold",
  curveY: "R²",
  keptAxis: "SNPs kept",

  /* step 5 */
  quantCaption: "mean trait by score vigintile, with 95% intervals",
  quantX: "score vigintile",
  quantY: "mean trait",
  meanLine: "The sample's mean trait",
};

/* ==========================================================================
   Step 6's copy, kept apart from the rest.

   Every line about a RISK lives here, and `_lab/prs-verify.mjs` §11 uses that
   split: the score itself is not a risk and no string on steps 1 to 5 may call
   it one, while step 6 is where a calibrated model turns it into one. A single
   sweep over one object could not say that.
   ========================================================================== */

export const RISK_STRINGS = {
  riskSection: "The risk",

  /* the drive row, step 6's own nouns — here rather than in STRINGS because
     the verify's no-risk sweep reads STRINGS as the steps that must not call a
     score a risk, and these two name a predicted one */
  stepRisk: "Next decile",
  stepTitleRisk: "Draw the next decile of predicted risk",
  runTitleRisk: "Draw the remaining deciles",

  /* Kenneth, 2026-09-12, after the round-3 review: the lesson's logistic
     model carries clinical covariates and this one carries the score alone,
     and nothing on the step said so. The hand-off is where a reader looks
     first, so it says what came in AND that it is the model's only input —
     and it lives here, not in STRINGS, because it names a risk. */
  handRisk: "from step 5: the score, the risk model's only predictor",

  prevalenceLabel: "Prevalence",
  /* round 3: the one line that says what the disease IS — the trait's upper
     tail, cut at the prevalence (decision 11) */
  prevalenceDetail: "the trait's upper tail, counted as the disease",

  riskThreshLabel: "Risk threshold",
  riskThreshDetail: "the absolute risk above which the disease is acted on",

  calCaption: "predicted risk against the observed fraction",
  /* 319 people in ten deciles is 32 a decile; the verify asserts the number
     against N_TARGET rather than letting a literal drift. */
  calNote: "by decile, 32 people each",
  calX: "predicted risk",
  diagonalLabel: "predicted = observed",

  stratCaption: "predicted risk by score percentile",
  stratX: "score percentile",

  emptyNote: "no SNP is kept at this P threshold",
};

/** The step label a step wears, as the declarative map core reserves against. */
export const STEP_LABELS = {
  param: "page",
  labels: {
    haplotypes: STRINGS.stepHaplotypes,
    clump: STRINGS.stepLd,
    score: STRINGS.stepScore,
    threshold: STRINGS.stepThreshold,
    quantile: STRINGS.stepQuantile,
    risk: RISK_STRINGS.stepRisk,
  },
  default: STRINGS.stepHaplotypes,
};
export const STEP_TITLES = {
  param: "page",
  labels: {
    haplotypes: STRINGS.stepTitleHaplotypes,
    clump: STRINGS.stepTitleLd,
    score: STRINGS.stepTitleScore,
    threshold: STRINGS.stepTitleThreshold,
    quantile: STRINGS.stepTitleQuantile,
    risk: RISK_STRINGS.stepTitleRisk,
  },
  default: STRINGS.stepTitleHaplotypes,
};
export const RUN_TITLES = {
  param: "page",
  labels: {
    haplotypes: STRINGS.runTitleHaplotypes,
    clump: STRINGS.runTitleLd,
    score: STRINGS.runTitleScore,
    threshold: STRINGS.runTitleThreshold,
    quantile: STRINGS.runTitleQuantile,
    risk: RISK_STRINGS.runTitleRisk,
  },
  default: STRINGS.runTitleHaplotypes,
};

/** The hand-off line each step carries (decision 8). */
export const HANDOFFS = {
  haplotypes: STRINGS.handHaplotypes,
  clump: STRINGS.handClump,
  score: STRINGS.handScore,
  threshold: STRINGS.handThreshold,
  quantile: STRINGS.handQuantile,
  risk: RISK_STRINGS.handRisk,
};

/** `step 2 of 6 · Clump the SNPs`, with the number already in the label. */
export const stepLine = (page) => {
  const n = stepNumber(page);
  return `step ${n} of ${PAGES.length} · ${PAGES[n - 1].label.replace(/^\d+ · /, "")}`;
};

/** The region and the genome the controls describe, resolved once. */
export function configFor(params) {
  const t = targetOf(params.target);
  return {
    recomb: recombOf(params.recomb).rate,
    clumpR2: Number(params.clumpR2),
    typed: params.causalTyped !== "untyped",
    nBase: baseSizeOf(params.baseSize).n,
    nCausal: Number(params.causal),
    h2: Number(params.h2),
    fst: t.fst,
    tagLoss: t.tagLoss,
    r2tag: t.r2tag,
    prevalence: prevalenceOf(params.prevalence).p,
  };
}
