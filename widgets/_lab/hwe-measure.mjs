/* Planning measurement for the GWAS arc's `hardy-weinberg` slot (PHM5003
 * 06 / 01-2 QC, the Hardy-Weinberg heading and the `--hwe 1e-6` filter).
 *
 * The slot's one claim, read from the lesson's own `iomics_check.hwe` on
 * 2026-09-11: of the 2008 SNPs failing at 1e-6, 2007 have FEWER heterozygotes
 * than HWE predicts — the Wahlund signature of pooling three populations
 * (Chinese, Malay, Indian), not of a miscalled genotype. Across the 1.65M
 * polymorphic SNPs the mean deficit F = 1 − O(het)/E(het) is 0.030; among
 * the failures it is 0.32 (min χ² ≈ n·F² = 19.1, PLINK's column being the
 * exact test rather than the χ² the lesson's prose writes).
 *
 * This script asks the questions the widget's controls depend on:
 *
 *   1. What deficit does pooling produce? Two (or three) subpopulations, each
 *      in HWE at its own p, pooled equally: F = Var(p) / (p̄(1 − p̄)), and the
 *      HWE χ² on the pooled genotype table is n·F². So at n = 323 the 1e-6
 *      line (χ² 23.9) is F ≈ 0.27 — a frequency gap of ~0.5 at p̄ = 0.5.
 *      The file's average F 0.03 is a gap of ~0.17, invisible at 323.
 *   2. So the widget needs n as a control: which gap fails at 1e-6 at each
 *      n, by simulation with the seeded rng (power at 1e-6 and at 0.05).
 *      Measured: the file's average deficit (F 0.03) needs n ≈ 26,600 to
 *      reach the line and 50,000 to fail reliably — so the n control must
 *      run from the lesson's 323 to a biobank's tens of thousands, and at
 *      323 only a gap of ~0.5 or more fails, which is the file's 2008.
 *   3. The genotyping-error arm: heterozygotes miscalled as homozygotes at
 *      rate e gives F ≈ e — the same side of the parabola as pooling, which
 *      is why the test alone cannot tell them apart. Homozygotes miscalled
 *      as heterozygotes gives F < 0 — the other side.
 *   4. One population, sampling only: the false-failure rate at 1e-6 over
 *      many SNPs is ~0, at 0.05 ~5% — the point sits on the parabola.
 *
 * Every number here is the model's; the real-file numbers above are awk
 * over the lesson's file and are quoted, not recomputed.
 *
 * Run: node widgets/_lab/hwe-measure.mjs
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

/* ---- the test ------------------------------------------------------------ */

/* erfc, Numerical Recipes' Chebyshev fit, |error| < 1.2e-7 — enough for a
   P that is read on a log scale. */
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Upper tail of χ² with 1 df: P(X > x) = erfc(√(x/2)). */
const chi1Tail = (x) => erfc(Math.sqrt(x / 2));

/** The lesson's test on a genotype table [AA, Aa, aa]: p from the table,
    expected counts n·(p², 2pq, q²), χ² over the three cells, 1 df. */
function hweTest(counts) {
  const [aa, ab, bb] = counts;
  const n = aa + ab + bb;
  const p = (2 * aa + ab) / (2 * n);
  const q = 1 - p;
  const exp = [n * p * p, 2 * n * p * q, n * q * q];
  let chi = 0;
  for (let i = 0; i < 3; i += 1) if (exp[i] > 0) chi += (counts[i] - exp[i]) ** 2 / exp[i];
  const F = exp[1] > 0 ? 1 - ab / exp[1] : 0;
  return { n, p, chi, P: chi1Tail(chi), F, exp };
}

/* the critical χ² at the lesson's thresholds, by bisection on the tail */
function chi1Crit(alpha) {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (chi1Tail(mid) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const CRIT = { 1e-6: chi1Crit(1e-6), 1e-3: chi1Crit(1e-3), 0.05: chi1Crit(0.05) };

/* ---- the samples --------------------------------------------------------- */

/** n individuals drawn from k equal subpopulations, each in HWE at its own
    allele frequency; returns the pooled genotype table. */
function poolSample(rng, n, ps) {
  const counts = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const p = ps[i % ps.length];
    const g = (rng.next() < p ? 1 : 0) + (rng.next() < p ? 1 : 0); // copies of A
    counts[2 - g] += 1; // [AA, Aa, aa]
  }
  return counts;
}

/** One population in HWE at p, then heterozygotes miscalled as a homozygote
    (either one, at random) with probability e — allele dropout. */
function dropoutSample(rng, n, p, e) {
  const c = poolSample(rng, n, [p]);
  let moved = 0;
  for (let i = 0; i < c[1]; i += 1) if (rng.next() < e) moved += 1;
  c[1] -= moved;
  for (let i = 0; i < moved; i += 1) c[rng.next() < 0.5 ? 0 : 2] += 1;
  return c;
}

/** One population in HWE at p, then homozygotes miscalled as heterozygotes
    with probability e — the excess side. */
function overcallSample(rng, n, p, e) {
  const c = poolSample(rng, n, [p]);
  for (const k of [0, 2]) {
    let moved = 0;
    for (let i = 0; i < c[k]; i += 1) if (rng.next() < e) moved += 1;
    c[k] -= moved;
    c[1] += moved;
  }
  return c;
}

/* analytic Wahlund F for equal-weight subpopulations */
function wahlundF(ps) {
  const pbar = ps.reduce((a, b) => a + b, 0) / ps.length;
  const v = ps.reduce((a, b) => a + (b - pbar) ** 2, 0) / ps.length;
  return v / (pbar * (1 - pbar));
}

const rng = makeRng(20260911);
const REPS = 400;

function power(sampler, alpha) {
  let hits = 0;
  for (let r = 0; r < REPS; r += 1) if (hweTest(sampler()).P < alpha) hits += 1;
  return hits / REPS;
}

/* ---- 1. the identity χ² = n·F², and the critical F ----------------------- */

console.log("\n1. The lesson's χ² on a pooled table is n·F² (F = Var(p) / p̄q̄)\n");
console.log(
  `   χ² at P = 1e-6: ${CRIT[1e-6].toFixed(2)}   1e-3: ${CRIT[1e-3].toFixed(2)}   0.05: ${CRIT[0.05].toFixed(2)}`,
);
for (const n of [100, 323, 1000, 10000, 100000]) {
  const Fcrit = Math.sqrt(CRIT[1e-6] / n);
  console.log(`   n = ${String(n).padStart(6)}  fails at 1e-6 once F ≥ ${Fcrit.toFixed(3)}`);
}
check(Math.abs(CRIT[1e-6] - 23.93) < 0.05, "χ²(1e-6, 1 df) ≈ 23.93");
check(Math.abs(Math.sqrt(CRIT[1e-6] / 323) - 0.272) < 0.005, "at n = 323 the 1e-6 line is F ≈ 0.27");

/* the identity, checked on large exact tables: build the pooled EXPECTED
   table for two subpopulations and run the test on it */
for (const [p1, p2] of [
  [0.3, 0.7],
  [0.2, 0.7],
  [0.45, 0.55],
]) {
  const n = 100000;
  const half = n / 2;
  const table = [
    half * p1 * p1 + half * p2 * p2,
    half * 2 * p1 * (1 - p1) + half * 2 * p2 * (1 - p2),
    half * (1 - p1) ** 2 + half * (1 - p2) ** 2,
  ];
  const t = hweTest(table);
  const F = wahlundF([p1, p2]);
  check(Math.abs(t.F - F) < 1e-9, `F from the table equals Var(p)/p̄q̄ at (${p1}, ${p2})`);
  check(Math.abs(t.chi - n * F * F) < 1e-6 * n, `χ² = n·F² at (${p1}, ${p2})`);
}

/* ---- 2. which gap fails at which n -------------------------------------- */

console.log("\n2. Two populations pooled equally at p̄ = 0.5: F, and the fraction of samples failing\n");
console.log("   gap Δ   F      | power at 1e-6 by n:   100    323   1000   5000  20000 | at 0.05, n = 323");
const NS = [100, 323, 1000, 5000, 20000];
const gapRows = {};
for (const gap of [0.05, 0.1, 0.17, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]) {
  const ps = [0.5 - gap / 2, 0.5 + gap / 2];
  const F = wahlundF(ps);
  const row = NS.map((n) => power(() => poolSample(rng, n, ps), 1e-6));
  const at05 = power(() => poolSample(rng, 323, ps), 0.05);
  gapRows[gap] = { F, row, at05 };
  console.log(
    `   ${gap.toFixed(2)}   ${F.toFixed(3)}  |                       ${row.map((v) => v.toFixed(2).padStart(6)).join(" ")} | ${at05.toFixed(2)}`,
  );
}
check(gapRows[0.17].row[1] < 0.02, "the file's average deficit (gap ≈ 0.17, F 0.03) is invisible at n = 323 at 1e-6");
/* First written as "fails nearly always at 20000" and WRONG: F 0.029 puts the
   expected χ² at 20000·0.029² = 16.8, under the 23.9 line, so even a biobank
   of 20,000 fails the average SNP only a fifth of the time. The n at which
   the average SNP's own deficit crosses the line is 23.93 / 0.03² ≈ 26,600,
   printed below; the widget's n control has to reach ~50,000 for the
   Wahlund arm to fail at a realistic gap. */
check(gapRows[0.17].row[4] > 0.05 && gapRows[0.17].row[4] < 0.5, "…and at n = 20000 fails only sometimes (expected χ² 16.8 < 23.9)");
check(gapRows[0.3].row[1] < 0.05, "a gap of 0.3 (F 0.09) rarely fails at n = 323");
check(gapRows[0.5].row[1] > 0.3 && gapRows[0.5].row[1] < 0.9, "a gap of 0.5 (F 0.25) is the edge at n = 323");
check(gapRows[0.6].row[1] > 0.9, "a gap of 0.6 (F 0.36) fails nearly always at n = 323");
check(gapRows[0.1].row[4] < 0.02, "a gap of 0.1 (F 0.01) never fails at n = 20000");
check(gapRows[0.2].row[4] > 0.5 && gapRows[0.2].row[4] < 0.95, "a gap of 0.2 (F 0.04) is the edge at n = 20000");
{
  const nNeeded = CRIT[1e-6] / 0.03 ** 2;
  console.log(`\n   n at which the file's mean F 0.030 reaches the 1e-6 line (n·F² = ${CRIT[1e-6].toFixed(2)}): ${Math.round(nNeeded).toLocaleString()}`);
  check(nNeeded > 25000 && nNeeded < 28000, "the average SNP's deficit needs n ≈ 26,600 to fail at 1e-6");
  const p50k = power(() => poolSample(rng, 50000, [0.5 - 0.085, 0.5 + 0.085]), 1e-6);
  console.log(`   power at n = 50000, gap 0.17: ${p50k.toFixed(2)}`);
  check(p50k > 0.9, "…and at n = 50000 it fails nearly always");
}

console.log("\n   Three populations at the lesson's shape (p = 0.2, 0.5, 0.8 pooled): F, and power by n");
{
  const ps = [0.2, 0.5, 0.8];
  const F = wahlundF(ps);
  const row = NS.map((n) => power(() => poolSample(rng, n, ps), 1e-6));
  console.log(`   F = ${F.toFixed(3)}  ${row.map((v) => v.toFixed(2).padStart(6)).join(" ")}`);
  check(F > 0.2 && F < 0.3, "three populations 0.2 / 0.5 / 0.8 give F ≈ 0.24");
}

/* ---- 3. the genotyping-error arms --------------------------------------- */

console.log("\n3. One population at p = 0.5, heterozygotes miscalled as homozygotes at rate e (dropout)\n");
console.log("   e      mean F  | power at 1e-6, n = 323 | n = 5000");
const dropRows = {};
for (const e of [0.05, 0.1, 0.2, 0.27, 0.3, 0.4]) {
  let sumF = 0;
  for (let r = 0; r < REPS; r += 1) sumF += hweTest(dropoutSample(rng, 5000, 0.5, e)).F;
  const p323 = power(() => dropoutSample(rng, 323, 0.5, e), 1e-6);
  const p5000 = power(() => dropoutSample(rng, 5000, 0.5, e), 1e-6);
  dropRows[e] = { F: sumF / REPS, p323, p5000 };
  console.log(`   ${e.toFixed(2)}   ${(sumF / REPS).toFixed(3)}   |   ${p323.toFixed(2)}                  |  ${p5000.toFixed(2)}`);
}
check(Math.abs(dropRows[0.2].F - 0.2) < 0.02, "dropout at rate e gives F ≈ e");
check(dropRows[0.1].p323 < 0.05, "10% dropout passes at n = 323 at 1e-6");
check(dropRows[0.3].p323 > 0.5, "30% dropout fails at n = 323 more often than not");

console.log("\n   Homozygotes miscalled as heterozygotes at rate e (over-call): F < 0, the other side of the parabola");
for (const e of [0.1, 0.2, 0.3]) {
  let sumF = 0;
  for (let r = 0; r < REPS; r += 1) sumF += hweTest(overcallSample(rng, 5000, 0.5, e)).F;
  const p323 = power(() => overcallSample(rng, 323, 0.5, e), 1e-6);
  console.log(`   e = ${e.toFixed(2)}  mean F = ${(sumF / REPS).toFixed(3)}  power at n = 323: ${p323.toFixed(2)}`);
  check(sumF / REPS < -0.05, `over-call at ${e} gives a heterozygote EXCESS`);
}

/* ---- 4. sampling alone --------------------------------------------------- */

console.log("\n4. One population in HWE, n = 323, 20000 SNPs at p drawn uniform(0.05, 0.95): false failures\n");
{
  let f6 = 0;
  let f3 = 0;
  let f05 = 0;
  let deficit = 0;
  const M = 20000;
  for (let s = 0; s < M; s += 1) {
    const p = 0.05 + 0.9 * rng.next();
    const t = hweTest(poolSample(rng, 323, [p]));
    if (t.P < 1e-6) f6 += 1;
    if (t.P < 1e-3) f3 += 1;
    if (t.P < 0.05) f05 += 1;
    if (t.F > 0) deficit += 1;
  }
  console.log(`   at 1e-6: ${f6}   at 1e-3: ${f3}   at 0.05: ${f05} (${((100 * f05) / M).toFixed(1)}%)   deficit side: ${((100 * deficit) / M).toFixed(1)}%`);
  check(f6 === 0, "no false failure at 1e-6 in 20000 SNPs");
  check(f05 / M > 0.035 && f05 / M < 0.07, "about 5% at 0.05");
  check(deficit / M > 0.4 && deficit / M < 0.6, "deficit and excess equally likely under HWE — the file's 909,740 : 738,944 is not sampling");
}

/* ---- 5. the file's failures, against the model -------------------------- */

console.log("\n5. The lesson's file, for the widget's readout copy (awk over iomics_check.hwe, 2026-09-11)\n");
console.log("   polymorphic SNPs 1,651,345; failing at 1e-6: 2008, of which 2007 deficits (O < E) and 1 excess");
console.log("   failing SNPs: mean F 0.324, min χ² ≈ n·F² 19.1 (PLINK's P is the exact test, so the χ² line is not sharp)");
console.log("   passing SNPs: mean F 0.030; 237,362 with F > 0.1; 9,473 with F > 0.27");
console.log("   → the average SNP carries the Wahlund deficit of a gap ≈ 0.17 and the test at 323 cannot see it;");
console.log("     the 2008 it can see are the most differentiated SNPs, gap ≳ 0.5.");
{
  /* the gap whose Wahlund F is the file's mean, at p̄ = 0.5 */
  let gap = 0;
  for (let g = 0; g < 1; g += 0.001) if (wahlundF([0.5 - g / 2, 0.5 + g / 2]) < 0.03) gap = g;
  console.log(`   gap at p̄ = 0.5 with F = 0.030: ${gap.toFixed(3)}`);
  check(gap > 0.15 && gap < 0.2, "the file's mean F 0.03 is a gap of ~0.17 at p̄ = 0.5");
}

console.log(`\n${checks} checks, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
