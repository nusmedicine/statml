// time-event-measure.mjs — every number the time-event design will stand on.
//
//   node widgets/_lab/time-event-measure.mjs
//
// Two jobs, the lm-*-measure.mjs pattern, adapted to what 05-06 actually
// stores. The notebook has TWO data arms and they verify differently:
//
//   1. VERIFY — the hand-made five-patient table (cells 6/8) is fully
//      deterministic: reproduce its KM curve to the digit against the stored
//      plot (S = 0.8, 0.6, 0.3; censor marks at (7, 0.6) and (10, 0.3)).
//      Cell 16 (coxph) stored NO output, so the Cox implementation is
//      verified by an independent naive reimplementation plus exact
//      identities (log-rank = Cox score test on tie-free data) and
//      invariances — there are no printed digits to match.
//   2. DESIGN — the facts the design turns on. The R set.seed(0) draw cannot
//      be reproduced in JS (the widget-28 ruling), so the simulated arm is
//      re-measured across the widget's own seeds and only that is claimed.
//      The decisive measurement: under the notebook's own generator, Status
//      is drawn INDEPENDENTLY of time, so discarding the censored is random
//      thinning and barely biases the curve — the misconception the widget
//      exists to dislodge only fires under time-dependent censoring
//      (study end / dropout). That decides the widget's generator.

import { km, kmMedian, logrank, coxph, chi2Tail1, simulate } from "../time-event/model.js";
import { makeRng } from "../core/rng.js";

let fails = 0;
const ck = (name, got, want, tol = 0) => {
  const ok = typeof want === "number"
    ? Math.abs(got - want) <= tol
    : got === want;
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}: got ${got}${ok ? "" : ` want ${want}`}`);
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const fmtP = (p) => (p < 1e-4 ? "<1e-4" : p.toFixed(4));

/* ========================================================================== */
console.log("== VERIFY: the five-patient table (cells 6/8), to the digit ==");

const T5 = [5, 10, 6, 8, 7]; // A..E, the notebook's own order
const S5 = [1, 0, 1, 1, 0];

const fit5 = km(T5, S5);
ck("distinct times", fit5.steps.length, 5);
const at = (t) => fit5.steps.find((s) => s.t === t);
ck("t=5: at risk", at(5).atRisk, 5);
ck("t=5: S", at(5).S, 0.8, 1e-12);
ck("t=6: at risk", at(6).atRisk, 4);
ck("t=6: S", at(6).S, 0.6, 1e-12);
ck("t=7: censored, S unchanged", at(7).S, 0.6, 1e-12);
ck("t=7: no event", at(7).events, 0);
ck("t=8: at risk", at(8).atRisk, 2);
ck("t=8: S (the 1-of-2 halving)", at(8).S, 0.3, 1e-12);
ck("t=10: censored, S unchanged", at(10).S, 0.3, 1e-12);
ck("censor marks", fit5.censors.length, 2);
ck("censor mark 1 at (7, 0.6)", fit5.censors[0].t === 7 && Math.abs(fit5.censors[0].S - 0.6) < 1e-12, true);
ck("censor mark 2 at (10, 0.3)", fit5.censors[1].t === 10 && Math.abs(fit5.censors[1].S - 0.3) < 1e-12, true);
ck("median survival", kmMedian(fit5.steps), 8);
// Greenwood log-scale CI at the first event, hand-computed:
// se(log S) = sqrt(1/(5·4)) = 0.223607, lo = 0.8·exp(−1.959964·0.223607)
ck("t=5: CI lo (Greenwood, log scale)", at(5).lo, 0.516126, 5e-6);
ck("t=5: CI hi capped at 1", at(5).hi, 1, 1e-12);

/* ========================================================================== */
console.log("\n== VERIFY: the Cox implementation (cell 16 stored no output) ==");

/* An independent naive Efron partial log-likelihood: direct sums, O(n²),
   written from the formula rather than from the model's suffix-sum code. */
function naiveEfronLoglik(times, status, X, beta) {
  const n = times.length;
  const r = X.map((row) => Math.exp(row.reduce((s, x, j) => s + x * beta[j], 0)));
  const eventTimes = [...new Set(times.filter((_, i) => status[i] === 1))].sort((a, b) => a - b);
  let ll = 0;
  for (const t of eventTimes) {
    const D = [];
    const R = [];
    for (let i = 0; i < n; i += 1) {
      if (times[i] >= t) R.push(i);
      if (times[i] === t && status[i] === 1) D.push(i);
    }
    const sR = R.reduce((s, i) => s + r[i], 0);
    const sD = D.reduce((s, i) => s + r[i], 0);
    for (const i of D) ll += X[i].reduce((s, x, j) => s + x * beta[j], 0);
    for (let l = 0; l < D.length; l += 1) ll -= Math.log(sR - (l / D.length) * sD);
  }
  return ll;
}

// a small tied dataset with one binary and one continuous covariate
const rngV = makeRng(11);
const nV = 60;
const tV = [];
const sV = [];
const XV = [];
for (let i = 0; i < nV; i += 1) {
  const g = rngV.bernoulli(0.5);
  const x = rngV.uniform(-1, 1);
  const t = Math.max(0.5, Math.round((rngV.exponential(0.2) * Math.exp(-0.7 * g - 0.4 * x)) * 2) / 2);
  tV.push(t);
  sV.push(rngV.bernoulli(0.7));
  XV.push([g, x]);
}
const fitV = coxph(tV, sV, XV);
ck("converged on tied data", fitV.converged, true);
ck("naive loglik agrees at beta-hat", naiveEfronLoglik(tV, sV, XV, fitV.beta), fitV.loglik, 1e-8);
ck("naive loglik agrees at 0", naiveEfronLoglik(tV, sV, XV, [0, 0]), fitV.loglik0, 1e-8);
// beta-hat maximises the NAIVE likelihood too: nudge each coordinate
{
  const base = naiveEfronLoglik(tV, sV, XV, fitV.beta);
  let isMax = true;
  for (const j of [0, 1]) {
    for (const eps of [-1e-4, 1e-4]) {
      const b = fitV.beta.slice();
      b[j] += eps;
      if (naiveEfronLoglik(tV, sV, XV, b) > base + 1e-12) isMax = false;
    }
  }
  ck("beta-hat maximises the naive likelihood", isMax, true);
}
// invariances
{
  const shift = coxph(tV, sV, XV.map(([g, x]) => [g, x + 5]));
  ck("location shift leaves beta unchanged", shift.beta[1], fitV.beta[1], 1e-6);
  const scale = coxph(tV, sV, XV.map(([g, x]) => [g, x / 2]));
  ck("halving a covariate doubles its beta", scale.beta[1], 2 * fitV.beta[1], 1e-5);
  ck("...and leaves z unchanged", scale.z[1], fitV.z[1], 1e-5);
  const tscale = coxph(tV.map((t) => t * 3), sV, XV);
  ck("rescaling time leaves beta unchanged", tscale.beta[0], fitV.beta[0], 1e-8);
}
// tie-free identity: log-rank chi2 == Cox score chi2 at beta = 0 (exact when
// no ties, where Efron = Breslow). Score chi2 computed from the naive loglik
// by central differences.
{
  const rngI = makeRng(7);
  const nI = 80;
  const tI = [];
  const sI = [];
  const gI = [];
  for (let i = 0; i < nI; i += 1) {
    const g = i < nI / 2 ? 0 : 1;
    gI.push(g);
    tI.push(rngI.exponential(0.1) * Math.exp(-0.8 * g) + rngI.next() * 1e-9);
    sI.push(rngI.bernoulli(0.75));
  }
  ck("tie-free check data really tie-free", new Set(tI).size, nI);
  const XI = gI.map((g) => [g]);
  // h = 1e-3, NOT smaller: a central second difference divides round-off by
  // h², and at h = 1e-5 that noise reached 0.1% of the statistic.
  const h = 1e-3;
  const lp = naiveEfronLoglik(tI, sI, XI, [h]);
  const lm = naiveEfronLoglik(tI, sI, XI, [-h]);
  const l0 = naiveEfronLoglik(tI, sI, XI, [0]);
  const score = (lp - lm) / (2 * h);
  const info = -(lp - 2 * l0 + lm) / (h * h);
  const scoreChi2 = (score * score) / info;
  const lr = logrank(tI, sI, gI);
  ck("log-rank == Cox score test (no ties)", lr.chi2, scoreChi2, 1e-4);
}

/* ========================================================================== */
console.log("\n== DESIGN: the five-patient table under the two wrong treatments ==");

// discard the censored (B and E vanish): three patients, all events
const drop = km([5, 6, 8], [1, 1, 1]);
console.log("  discard censored:  S = " + drop.steps.map((s) => `${s.S.toFixed(3)}@${s.t}`).join(", "));
ck("discard: S after t=8 is 0 — 'everyone dies by 8'", drop.steps[2].S, 0, 1e-12);
// treat censored as events
const asEvents = km(T5, [1, 1, 1, 1, 1]);
console.log("  censored=events:   S = " + asEvents.steps.map((s) => `${s.S.toFixed(3)}@${s.t}`).join(", "));
ck("as-events: S after t=10 is 0", asEvents.steps[4].S, 0, 1e-12);
console.log("  correct KM:        S = 0.800@5, 0.600@6, 0.600@7, 0.300@8, 0.300@10");
console.log("  the gap at t>=8: correct 0.30 vs discard 0.00 vs as-events 0.20");
console.log("  at a 300px survival axis those gaps are 90px and 30px — both legible");

/* ========================================================================== */
console.log("\n== DESIGN: the notebook's simulated arm, across the widget's own seeds ==");

/* Mirror of cell 11's generator, on the widget's seeded rng. R's seeded draw
   will not reproduce in JS; what is measured is the DESIGN, over many seeds. */
function simulateNotebook(rng, n = 200) {
  const age = [];
  const disease = [];
  const snps = [];
  const time = [];
  const status = [];
  for (let i = 0; i < n; i += 1) {
    age.push(rng.int(30, 80));
    disease.push(rng.int(0, 1));
  }
  for (let i = 0; i < n; i += 1) {
    const row = new Array(10);
    if (disease[i] === 1) {
      for (let j = 0; j < 3; j += 1) row[j] = rng.next() < 0.8 ? 1 : 0;
      for (let j = 3; j < 10; j += 1) row[j] = rng.int(0, 1);
    } else {
      for (let j = 0; j < 10; j += 1) row[j] = rng.int(0, 1);
    }
    snps.push(row);
  }
  for (let i = 0; i < n; i += 1) {
    let t = 20 - 0.1 * age[i] - 2 * disease[i]
      - (snps[i][0] + snps[i][1] + snps[i][2]) + rng.uniform(0, 5);
    t = Math.round(t * 2) / 2;
    if (t < 0.5) t = 0.5;
    time.push(t);
    status.push(rng.int(0, 1));
  }
  return { age, disease, snps, time, status };
}

{
  const SEEDS = 100;
  const lrP = [];
  const evFrac = [];
  const nDistinct = [];
  const sigCount = { Age: 0, Disease: 0 };
  for (let j = 0; j < 10; j += 1) sigCount[`SNP_${j + 1}`] = 0;
  const hrAge = [];
  const hrSnp1 = [];
  let conv = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const d = simulateNotebook(makeRng(seed));
    evFrac.push(mean(d.status));
    nDistinct.push(new Set(d.time.filter((_, i) => d.status[i] === 1)).size);
    lrP.push(logrank(d.time, d.status, d.disease).p);
    const X = d.age.map((a, i) => [a, d.disease[i], ...d.snps[i]]);
    const fit = coxph(d.time, d.status, X);
    if (fit.converged) conv += 1;
    const names = ["Age", "Disease", ...Array.from({ length: 10 }, (_, j) => `SNP_${j + 1}`)];
    names.forEach((nm, k) => { if (fit.p[k] < 0.05) sigCount[nm] += 1; });
    hrAge.push(fit.hr[0]);
    hrSnp1.push(fit.hr[2]);
  }
  console.log(`  ${SEEDS} seeds, n = 200 each; coxph converged ${conv}/${SEEDS}`);
  console.log(`  event fraction: ${mean(evFrac).toFixed(3)} (Status ~ Bernoulli(0.5) by design)`);
  console.log(`  distinct event times per draw: ${mean(nDistinct).toFixed(1)} — step count at 550px`);
  console.log(`  log-rank by disease: p < 1e-4 on ${lrP.filter((p) => p < 1e-4).length}/${SEEDS} seeds (notebook prints p < 0.0001), p < 0.05 on ${lrP.filter((p) => p < 0.05).length}`);
  console.log(`  Cox, share of seeds significant at 0.05:`);
  console.log(`    Age ${sigCount.Age}%  SNP_1 ${sigCount.SNP_1}%  SNP_2 ${sigCount.SNP_2}%  SNP_3 ${sigCount.SNP_3}%  (cell 17 claims all four)`);
  console.log(`    Disease ${sigCount.Disease}%  (cell 17 does NOT claim it — its effect hides in SNPs 1-3)`);
  const nullSnps = [4, 5, 6, 7, 8, 9, 10].map((j) => sigCount[`SNP_${j}`]);
  console.log(`    null SNPs 4-10: ${nullSnps.join(", ")}% — the 5% false-positive floor`);
  console.log(`  HR(Age) median ~ ${[...hrAge].sort((a, b) => a - b)[50].toFixed(3)}, HR(SNP_1) median ~ ${[...hrSnp1].sort((a, b) => a - b)[50].toFixed(3)}`);
}

/* ========================================================================== */
console.log("\n== DESIGN: does 'discard the censored' even bias the notebook's generator? ==");

/* The decisive comparison. Two censoring designs, same true event process:
     A. the notebook's: Status ~ Bernoulli(0.5), independent of time
     B. administrative: staggered entry, study ends — censor time C = 15 - U(0,10),
        observed = min(T, C), status = [T <= C]
   Under A, discarding the censored is a random half-sample of the SAME
   distribution; under B, the censored are preferentially the long survivors,
   and discarding them is the misconception the widget exists to show. */

function trueTime(rng) {
  // the notebook's event process for a random patient (no censoring)
  const age = rng.int(30, 80);
  const disease = rng.int(0, 1);
  let s3 = 0;
  if (disease === 1) {
    for (let j = 0; j < 3; j += 1) s3 += rng.next() < 0.8 ? 1 : 0;
    for (let j = 3; j < 10; j += 1) rng.int(0, 1);
  } else {
    let first3 = 0;
    for (let j = 0; j < 10; j += 1) {
      const v = rng.int(0, 1);
      if (j < 3) first3 += v;
    }
    s3 = first3;
  }
  let t = 20 - 0.1 * age - 2 * disease - s3 + rng.uniform(0, 5);
  t = Math.round(t * 2) / 2;
  return t < 0.5 ? 0.5 : t;
}

{
  /* Every estimator is scored against the TRUTH — the empirical survival of
     the same patients' uncensored event times — as signed bias averaged over
     the grid. Signs matter: they say which way each curve lies. */
  const SEEDS = 100;
  const N = 200;
  const grid = [];
  for (let t = 6; t <= 19; t += 0.5) grid.push(t);
  const readS = (steps, t) => {
    let S = 1;
    for (const s of steps) { if (s.t <= t) S = s.S; else break; }
    return S;
  };
  const bias = (steps, truth) => mean(grid.map((t) => readS(steps, t) - readS(truth, t)));
  const bA = { km: [], drop: [] };
  const bB = { km: [], drop: [] };
  const evFracB = [];
  let medReachedB = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const rng = makeRng(1000 + seed);
    const T = Array.from({ length: N }, () => trueTime(rng));
    const truth = km(T, T.map(() => 1)).steps;
    // A: the notebook's — Status ~ Bernoulli(0.5), so a censored patient is
    // censored AT the very time the event would have happened
    const stA = T.map(() => rng.int(0, 1));
    const keptA = T.filter((_, i) => stA[i] === 1);
    bA.km.push(bias(km(T, stA).steps, truth));
    bA.drop.push(bias(km(keptA, keptA.map(() => 1)).steps, truth));
    // B: study-end — staggered entry, doors close at 20: C = 20 − U(0,10),
    // observed = min(T, C). The long survivors are the ones cut. (A harsher
    // close at 15 was tried first: event fraction 0.16 and no information at
    // all past t = 15, so KM showed a spurious +0.08 "bias" that was really
    // the inestimable tail flatlining across the grid. Keep C_max above most
    // of T's support, or the comparison measures the grid, not the method.)
    const C = T.map(() => 20 - rng.uniform(0, 10));
    const tB = T.map((t, i) => Math.min(t, C[i]));
    const stB = T.map((t, i) => (t <= C[i] ? 1 : 0));
    evFracB.push(mean(stB));
    const kmB = km(tB, stB).steps;
    if (!Number.isNaN(kmMedian(kmB))) medReachedB += 1;
    const keptB = tB.filter((_, i) => stB[i] === 1);
    bB.km.push(bias(kmB, truth));
    bB.drop.push(bias(km(keptB, keptB.map(() => 1)).steps, truth));
  }
  console.log(`  signed bias vs truth, mean over t = 6..19 and ${SEEDS} seeds:`);
  console.log(`  A (notebook: Status ⊥ time — censored AT their event time):`);
  console.log(`    KM ${mean(bA.km).toFixed(4)}  discard ${mean(bA.drop).toFixed(4)}`);
  console.log(`    => under the notebook's own generator KM lies HIGH and discarding is the`);
  console.log(`       unbiased one — a discard toggle there would teach the OPPOSITE lesson.`);
  console.log(`  B (study-end: C = 20 − U(0,10), observed = min(T, C)):`);
  console.log(`    KM ${mean(bB.km).toFixed(4)}  discard ${mean(bB.drop).toFixed(4)}  (event fraction ${mean(evFracB).toFixed(2)}, KM median reachable on ${medReachedB}/${SEEDS} seeds)`);
  console.log(`    => with real censoring KM is honest and discarding lies LOW — the`);
  console.log(`       misconception, on screen. The widget's simulated arm must generate`);
  console.log(`       observed = min(T, C) with its own seeds, NOT the notebook's Status coin.`);
}

/* ========================================================================== */
console.log("\n== DESIGN: the widget's OWN generator — true process + study-end censoring ==");

/* What the simulated arm becomes once the Status coin is ruled out: the
   notebook's event process untouched, censoring by staggered entry with the
   doors closing at 20. Everything the widget will print about groups and
   hazards must hold under THIS design — and the generator measured here IS
   the shipping one, imported from ../time-event/model.js, so what is
   verified is what runs. */
const simulateWidget = simulate;

{
  const SEEDS = 100;
  const lrP = [];
  const evFrac = [];
  const sigAge = [];
  let snp123 = 0;
  let conv = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const d = simulateWidget(makeRng(seed));
    evFrac.push(mean(d.status));
    lrP.push(logrank(d.time, d.status, d.disease).p);
    const X = d.age.map((a, i) => [a, d.disease[i], ...d.snps[i]]);
    const fit = coxph(d.time, d.status, X);
    if (fit.converged) conv += 1;
    sigAge.push(fit.p[0] < 0.05 ? 1 : 0);
    if (fit.p[2] < 0.05 && fit.p[3] < 0.05 && fit.p[4] < 0.05) snp123 += 1;
  }
  console.log(`  event fraction ${mean(evFrac).toFixed(2)}; coxph converged ${conv}/${SEEDS}`);
  console.log(`  log-rank by disease: p < 1e-4 on ${lrP.filter((p) => p < 1e-4).length}/${SEEDS} seeds, p < 0.05 on ${lrP.filter((p) => p < 0.05).length}/${SEEDS}`);
  console.log(`  Cox: Age significant on ${sigAge.reduce((a, b) => a + b, 0)}%, all three causal SNPs jointly on ${snp123}%`);
  console.log(`  => the lesson's group separation and hazard reading SURVIVE the honest`);
  console.log(`     censoring design; a widget seed can be chosen at build time.`);
}

/* ========================================================================== */
console.log("\n== DESIGN: is a per-interval hazard panel legible at n = 200, by group? ==");

/* The hazard candidate for the groups tab: life-table bins, h = d / n_start
   (the discrete-time teaching form — Singer & Willett's profile). Measured
   question: does disease sit visibly ABOVE no-disease bin after bin on the
   default seed, or does small-d noise drown the story? Also measured across
   seeds: how often the ordering h1 > h0 holds per bin, and the bins' d. */
{
  const BINS = [[6, 10], [10, 12], [12, 14], [14, 16], [16, 20]];
  const intervalHazard = (time, status, lo, hi) => {
    const nStart = time.filter((t) => t >= lo).length;
    const d = time.filter((t, i) => status[i] === 1 && t >= lo && t < hi).length;
    return { nStart, d, h: nStart > 0 ? d / nStart : NaN };
  };
  const one = (seed) => {
    const d = simulateWidget(makeRng(seed));
    return BINS.map(([lo, hi]) => {
      const g0 = intervalHazard(
        d.time.filter((_, i) => d.disease[i] === 0),
        d.status.filter((_, i) => d.disease[i] === 0), lo, hi);
      const g1 = intervalHazard(
        d.time.filter((_, i) => d.disease[i] === 1),
        d.status.filter((_, i) => d.disease[i] === 1), lo, hi);
      return { g0, g1 };
    });
  };
  const s1 = one(1);
  console.log("  seed 1, h = d/n at bin start (no disease vs disease):");
  BINS.forEach(([lo, hi], k) => {
    const { g0, g1 } = s1[k];
    console.log(`    [${lo},${hi}): ${g0.h.toFixed(2)} (${g0.d}/${g0.nStart})  vs  ${g1.h.toFixed(2)} (${g1.d}/${g1.nStart})  ${g1.h > g0.h ? "disease higher" : "ORDER FLIPS"}`);
  });
  const SEEDS = 100;
  const holds = new Array(BINS.length).fill(0);
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const r = one(seed);
    r.forEach(({ g0, g1 }, k) => { if (g1.h > g0.h) holds[k] += 1; });
  }
  console.log(`  h(disease) > h(no disease) across ${SEEDS} seeds, per bin: ${holds.join(", ")}%`);
  console.log(`  => the first bins carry the story; the last bin has few at risk in the`);
  console.log(`     disease arm and flips often — bin choice is a design decision, not free.`);
}

console.log(`\nchi2Tail1 sanity: P(chi2_1 > 3.841) = ${chi2Tail1(3.841).toFixed(4)} (want 0.0500)`);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
