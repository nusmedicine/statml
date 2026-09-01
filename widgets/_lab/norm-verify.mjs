/* ============================================================================
   Assertions on widget 39's engine, of the kind no picture can settle.

       node widgets/_lab/norm-verify.mjs

   Imports `widgets/normalization/model.js` — the shipping code, not a copy.
   Each check is an ALGEBRAIC IDENTITY the widget's own claims rest on, so if
   one fails the widget is saying something untrue on screen, not merely
   drawing it oddly. Exits non-zero on failure.
   ========================================================================= */

import { simulate, apply, summarise } from "../normalization/model.js";

const SPREADS = [0, 0.5, 1];
const SEEDS = [1, 7, 42];
const NORMS = ["none", "median", "minmax", "zscore", "quantile"];

let failed = 0;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function check(name, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 52)} ${detail}`);
  if (!ok) failed += 1;
}

const stages = [];
for (const spread of SPREADS) {
  for (const seed of SEEDS) stages.push({ spread, seed, cols: simulate({ seed, spread, stage: "gamma" }).cols });
}

/* -- 1 · THE SCALE TILE SURVIVES ANY AFFINE MAP ---------------------------- *
 * It is a range of medians over a pooled IQR: two differences, so a shift
 * cancels and a scale cancels. Raw, min-max and z-score must therefore agree
 * EXACTLY, and that equality is what the widget teaches — a rescaling does not
 * put samples on one scale. An earlier version divided by the grand median,
 * which is shift-sensitive, and gave 0.717 / 0.717 / 1.299 for the same three. */
console.log("\n=== 1 · the scale tile is invariant under any affine map ===");
{
  let worst = 0;
  for (const { cols } of stages) {
    const base = summarise(cols).spread.relative;
    for (const n of ["minmax", "zscore"]) {
      worst = Math.max(worst, Math.abs(base - summarise(apply(cols, { normalize: n })).spread.relative));
    }
  }
  check("raw = min-max = z-score, 18 comparisons", worst < 1e-12, `worst |Δ| ${worst.toExponential(2)}`);
}

/* -- 2 · A GLOBAL AFFINE MAP CANNOT MOVE THE SHAPE ------------------------- *
 * The headline claim: min-max and z-score leave the pooled skew unchanged, and
 * unchanged means to float noise rather than approximately. Median
 * normalisation is deliberately NOT in this list — it is affine per sample and
 * is not one map over the table, so it does move the skew, which check 3 pins. */
console.log("\n=== 2 · a global affine map leaves the pooled skew unchanged ===");
{
  let worst = 0;
  for (const { cols } of stages) {
    const base = summarise(cols).skew;
    for (const n of ["minmax", "zscore"]) {
      worst = Math.max(worst, Math.abs(base - summarise(apply(cols, { normalize: n })).skew));
    }
  }
  check("skew unchanged by min-max and z-score", worst < 1e-10, `worst |Δ| ${worst.toExponential(2)}`);
}

/* -- 3 · MEDIAN NORMALISATION IS THE EXCEPTION, AND IT IS REAL ------------- *
 * Affine per sample, not one map over the table. The widget says "scaling"
 * rather than "affine" on screen because of this; the check exists so nobody
 * later "fixes" the wording back. */
console.log("\n=== 3 · median normalisation DOES move the skew (per sample, not per table) ===");
{
  let biggest = 0;
  for (const { cols } of stages) {
    biggest = Math.max(biggest, Math.abs(summarise(cols).skew - summarise(apply(cols, { normalize: "median" })).skew));
  }
  check("skew moves by more than float noise", biggest > 1e-6, `largest |Δ| ${biggest.toExponential(2)}`);
}

/* -- 4 · NORMALISATION PUTS THE SAMPLES ON ONE SCALE, EXACTLY -------------- *
 * On a continuous stage both per-sample methods take the scale gap to zero.
 * This is the check that made the stage gamma rather than the notebook's
 * counts, where ties leave quantile at 0.022 to 0.038 instead. */
console.log("\n=== 4 · median and quantile take the scale gap to exactly zero ===");
for (const n of ["median", "quantile"]) {
  let worst = 0;
  for (const { cols } of stages) worst = Math.max(worst, summarise(apply(cols, { normalize: n })).spread.relative);
  check(`${n}: scale gap is zero at every spread and seed`, worst < 1e-12, `worst ${worst.toExponential(2)}`);
}

/* -- 5 · BOX-COX AT lambda = 1 IS (y - 1), AN AFFINE MAP ------------------- *
 * The self-checking end of the slider — WHERE EVERY VALUE IS STRICTLY
 * POSITIVE. After min-max the global minimum is exactly 0 and after z-score
 * half the table is negative, so those two are not identities and must not be
 * asserted as ones. Both halves are checked, because a claim that holds on
 * three of five paths and is silently false on the other two is worse than no
 * claim at all. */
console.log("\n=== 5 · Box-Cox at λ = 1 lands back on the untransformed row ===");
{
  const worst = {};
  const drops = {};
  for (const n of NORMS) { worst[n] = 0; drops[n] = 0; }
  for (const { cols } of stages) {
    for (const n of NORMS) {
      const a = summarise(apply(cols, { normalize: n, transform: "none" }));
      const b = summarise(apply(cols, { normalize: n, transform: "boxcox", lambda: 1 }));
      worst[n] = Math.max(worst[n], Math.abs(a.skew - b.skew), Math.abs(a.rho - b.rho));
      const flat = apply(cols, { normalize: n, transform: "boxcox", lambda: 1 }).flat();
      drops[n] = Math.max(drops[n], flat.length - flat.filter(Number.isFinite).length);
    }
  }
  for (const n of ["none", "median", "quantile"]) {
    check(`${n}: identity holds (all values > 0)`, worst[n] < 1e-10 && drops[n] === 0,
      `worst |Δ| ${worst[n].toExponential(2)}, ${drops[n]} dropped`);
  }
  for (const n of ["minmax", "zscore"]) {
    check(`${n}: identity BREAKS, and the figure says why`, drops[n] > 0,
      `worst |Δ| ${rpad(worst[n].toExponential(2), 9)}, ${rpad(drops[n], 5)} dropped — Box-Cox needs y > 0`);
  }
}

/* -- 6 · lambda -> 0 IS log(y), AND log(1+y) IS A DIFFERENT TRANSFORM ------ *
 * This check was first written asserting that lambda = 0.02 tracks log(1+y) to
 * within 0.05, WHICH IS FALSE ON THIS STAGE and was already in the widget's own
 * source comment when the check caught it. The number that made it look true
 * came from the notebook's integer-count stage, where the smallest value is 0
 * and log1p's +1 barely matters.
 *
 * The gamma stage runs down to 2.35e-6, and 0.33% of its values sit below 1 —
 * enough for the +1 to separate the three transforms outright:
 *
 *     log(y)            skew -0.665   rho 0.470
 *     Box-Cox l = 0.02  skew -0.446   rho 0.496
 *     log(1 + y)        skew -0.061   rho 0.529
 *
 * So the honest claim, and the one the lambda slider actually teaches, is that
 * lambda -> 0 approaches log(y) MONOTONICALLY, and that log(1+y) is a third
 * thing whose "+1" matters exactly where the data is small. Both halves are
 * asserted. */
console.log("\n=== 6 · λ → 0 approaches log(y), monotonically ===");
{
  const LADDER = [1, 0.75, 0.5, 0.25, 0.1, 0.02];
  let monotone = true;
  let closer = true;
  for (const { cols } of stages) {
    const logY = summarise(cols.map((c) => c.map((v) => (v > 0 ? Math.log(v) : NaN))));
    const skews = LADDER.map((lambda) => summarise(apply(cols, { transform: "boxcox", lambda })).skew);
    for (let i = 1; i < skews.length; i += 1) if (skews[i] >= skews[i - 1]) monotone = false;
    const l1 = summarise(apply(cols, { transform: "log1p" }));
    const end = skews[skews.length - 1];
    if (Math.abs(end - logY.skew) >= Math.abs(end - l1.skew)) closer = false;
  }
  check("skew falls monotonically as λ runs 1 → 0.02", monotone, `${LADDER.length} rungs x ${stages.length} stages`);
  check("λ = 0.02 is nearer log(y) than log(1+y)", closer, "the +1 is a different transform, not a rounding");
}

/* -- 7 · compute() IS PURE AND SEEDED -------------------------------------- */
console.log("\n=== 7 · same parameters, same table ===");
{
  const a = simulate({ seed: 3, spread: 0.5, stage: "gamma" }).cols;
  const b = simulate({ seed: 3, spread: 0.5, stage: "gamma" }).cols;
  const same = a.every((c, i) => c.every((v, j) => v === b[i][j]));
  const c = simulate({ seed: 4, spread: 0.5, stage: "gamma" }).cols;
  const differs = a.some((col, i) => col.some((v, j) => v !== c[i][j]));
  check("seed 3 twice is identical; seed 4 differs", same && differs, `${a.length} x ${a[0].length} values`);
}

console.log(failed ? `\n${failed} FAILURE(S)\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
