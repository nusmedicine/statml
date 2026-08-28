// lm-adjust-measure.mjs — every number the lm-adjustment design will stand on.
//
//   node widgets/_lab/lm-adjust-measure.mjs
//
// Two jobs, the lm-measure.mjs pattern:
//   1. VERIFY — reproduce every DETERMINISTIC stored output in 05-02 from the
//      shared module (the single-covariate fits, sysBP ~ BMI + age, its SEs,
//      t's, CIs and R²) so the mock-ups show what the notebook printed.
//      The collinearity cells (33-53) CANNOT be verified to the digit: the
//      notebook's jitter() is UNSEEDED, so its printed 1.2544 / 0.0249 /
//      VIF 6.47 are one draw — HANDOVER's standing warning applies. Those
//      are re-measured across 200 seeds instead, which is what the widget
//      can honestly claim.
//   2. DESIGN — the facts the design turns on: how far the BMI slope moves
//      when age enters (is it VISIBLE at 240px?), the FWL residual view's
//      exactness (widget 26's motion, reusable here), and the collinearity
//      arm's stability across seeds.
import { N, BMI, SYSBP, AGE } from "../lm-least-squares/data.js";
import { ols } from "../lm-least-squares/model.js";
import { makeRng } from "../core/rng.js";

let fails = 0;
const ck = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}: got ${got}${ok ? "" : ` want ${want}`}`);
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i += 1) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};

console.log("== VERIFY against 05-02 stored outputs (deterministic cells) ==");
const fBMI = ols(SYSBP, BMI);
const fAge = ols(SYSBP, AGE);
const fBoth = ols(SYSBP, BMI, AGE);

ck("BMI alone: b0", fBMI.b[0], 87.068295, 1e-5);
ck("BMI alone: b1", fBMI.b[1], 1.721042, 1e-5);
ck("age alone: b0", fAge.b[0], 85.7252063, 1e-5);
ck("age alone: b1", fAge.b[1], 0.9237601, 1e-6);
ck("both: intercept", fBoth.b[0], 51.5287670, 1e-5);
ck("both: BMI", fBoth.b[1], 1.4990839, 1e-6);
ck("both: age", fBoth.b[2], 0.8358078, 1e-6);
ck("both: SE(intercept)", fBoth.se[0], 2.57714073, 1e-6);
ck("both: SE(BMI)", fBoth.se[1], 0.07894250, 1e-7);
ck("both: SE(age)", fBoth.se[2], 0.03710561, 1e-7);
ck("both: t(intercept)", fBoth.t[0], 19.99455, 1e-4);
ck("both: t(BMI)", fBoth.t[1], 18.98957, 1e-4);
ck("both: t(age)", fBoth.t[2], 22.52510, 1e-4);
ck("both: df", fBoth.df, 3544, 0);
// confint at qt(0.975, 3544); the df-3545 value 1.960633 agrees to 6 dp.
const tq = 1.960633;
ck("both: CI(BMI) lower", fBoth.b[1] - tq * fBoth.se[1], 1.3443066, 1e-4);
ck("both: CI(BMI) upper", fBoth.b[1] + tq * fBoth.se[1], 1.6538612, 1e-4);
ck("both: CI(age) lower", fBoth.b[2] - tq * fBoth.se[2], 0.7630573, 1e-4);
ck("both: CI(age) upper", fBoth.b[2] + tq * fBoth.se[2], 0.9085583, 1e-4);
ck("both: R2", fBoth.r2, 0.2183839, 1e-6);
ck("both: adjR2", fBoth.adjR2, 0.2179428, 1e-6);
ck("BMI alone: R2", fBMI.r2, 0.1064831, 1e-6);

console.log("\n== DESIGN measurements ==");
console.log(`r(BMI, age) = ${corr(BMI, AGE).toFixed(4)}   r(sysBP, age) = ${corr(SYSBP, AGE).toFixed(4)}   r(sysBP, BMI) = ${corr(SYSBP, BMI).toFixed(4)}`);
console.log(`age: mean ${mean(AGE).toFixed(2)}, sd ${sd(AGE).toFixed(2)}, range ${Math.min(...AGE)}-${Math.max(...AGE)}`);

console.log(`\nThe coefficient moves when age enters:`);
console.log(`  BMI: ${fBMI.b[1].toFixed(4)} alone -> ${fBoth.b[1].toFixed(4)} adjusted  (${(100 * (fBoth.b[1] / fBMI.b[1] - 1)).toFixed(1)}%)`);
console.log(`  age: ${fAge.b[1].toFixed(4)} alone -> ${fBoth.b[2].toFixed(4)} adjusted  (${(100 * (fBoth.b[2] / fAge.b[1] - 1)).toFixed(1)}%)`);

/* Is the move VISIBLE as two slopes on the scatter? The adjusted line drawn
   at mean(age): the vertical gap between unadjusted and adjusted lines
   across the 1%-99% BMI window, in mmHg and in pixels at the real panel. */
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.round(p * (s.length - 1))];
};
const xw = [q(BMI, 0.01), q(BMI, 0.99)];
const adjAt = (x) => fBoth.b[0] + fBoth.b[1] * x + fBoth.b[2] * mean(AGE);
const unAt = (x) => fBMI.b[0] + fBMI.b[1] * x;
const gapL = Math.abs(adjAt(xw[0]) - unAt(xw[0]));
const gapR = Math.abs(adjAt(xw[1]) - unAt(xw[1]));
const PXMM = 240 / 220; // widget 27's scatter: 240px over the 80-300 frame
console.log(`\nTwo slopes on the scatter (adjusted drawn at mean age):`);
console.log(`  vertical gap at BMI ${xw[0]}: ${gapL.toFixed(2)} mmHg (${(gapL * PXMM).toFixed(1)}px); at BMI ${xw[1]}: ${gapR.toFixed(2)} mmHg (${(gapR * PXMM).toFixed(1)}px)`);

/* The FWL residual view — widget 26's motion, candidate for reuse: regress
   BOTH axes on age, plot what is left; the residual slope IS the adjusted
   BMI coefficient exactly. Asserted, not assumed. */
const resid = (v, z) => {
  const g = ols(v, z);
  return v.map((x, i) => x - g.b[0] - g.b[1] * z[i]);
};
const rx = resid(BMI, AGE);
const ry = resid(SYSBP, AGE);
const fR = ols(ry, rx);
ck("FWL: residual slope = adjusted BMI coefficient", fR.b[1], fBoth.b[1], 1e-9);
console.log(`  residual ranges: BMI-resid ${q(rx, 0.01).toFixed(1)}..${q(rx, 0.99).toFixed(1)}, sysBP-resid ${q(ry, 0.01).toFixed(1)}..${q(ry, 0.99).toFixed(1)}`);

/* --- the collinearity arm, 200 seeds (the notebook's jitter is unseeded) -- */
console.log("\n== Collinearity across 200 seeds: BMI_related = BMI + U(-3, 3) ==");
const SEEDS = 200;
const bRelAlone = [];
const bBMImixed = [];
const bRelMixed = [];
const seBMImixed = [];
const vifBMI = [];
const nsRel = [];
const nsEither = [];
for (let s = 1; s <= SEEDS; s += 1) {
  const rng = makeRng(s);
  const rel = BMI.map((v) => v + (rng.next() * 6 - 3));
  const fRel = ols(SYSBP, rel, AGE);
  const fMix = ols(SYSBP, BMI, rel, AGE);
  bRelAlone.push(fRel.b[1]);
  bBMImixed.push(fMix.b[1]);
  bRelMixed.push(fMix.b[2]);
  seBMImixed.push(fMix.se[1]);
  const r2b = ols(BMI, rel, AGE).r2;
  vifBMI.push(1 / (1 - r2b));
  const tRel = Math.abs(fMix.t[2]);
  const tB = Math.abs(fMix.t[1]);
  nsRel.push(tRel < tq ? 1 : 0);
  nsEither.push(tRel < tq || tB < tq ? 1 : 0);
}
console.log(`BMI_related + age (no BMI): b ${mean(bRelAlone).toFixed(3)} ± ${sd(bRelAlone).toFixed(3)}   (notebook's one draw: 1.2544)`);
console.log(`BMI + BMI_related + age:`);
console.log(`  b(BMI)         ${mean(bBMImixed).toFixed(3)} ± ${sd(bBMImixed).toFixed(3)}   (notebook: 1.4739)`);
console.log(`  b(BMI_related) ${mean(bRelMixed).toFixed(4)} ± ${sd(bRelMixed).toFixed(4)}  (notebook: 0.0249)`);
console.log(`  SE(BMI) ${mean(seBMImixed).toFixed(4)} vs ${fBoth.se[1].toFixed(4)} without the twin — inflation x${(mean(seBMImixed) / fBoth.se[1]).toFixed(2)} (sqrt(VIF) predicts x${Math.sqrt(mean(vifBMI)).toFixed(2)})`);
console.log(`  VIF(BMI) ${mean(vifBMI).toFixed(2)} ± ${sd(vifBMI).toFixed(2)}, range ${Math.min(...vifBMI).toFixed(2)}-${Math.max(...vifBMI).toFixed(2)}   (notebook: 6.47; threshold 5)`);
console.log(`  BMI_related n.s. in ${nsRel.reduce((a, v) => a + v, 0)}/${SEEDS} seeds; at least one twin n.s. in ${nsEither.reduce((a, v) => a + v, 0)}/${SEEDS}`);

/* --- the SHIPPING twin: weight = BMI x height^2, unisex N(1.68, 0.05) ----
   The widget does not ship the notebook's jitter twin (above) — round 5
   replaced it with a simulated weight, and the construction must be
   measured AS SHIPPED: the exact rng draw order of compute() (two draws
   per patient, Box-Muller), 200 seeds. The catalogue's round-5/7 numbers
   are asserted here so a drift in rng.js or the construction fails loudly. */
console.log("\n== The shipping twin across 200 seeds: weight = BMI x height^2, height ~ N(1.68, 0.05) ==");
const wgtFor = (seed) => {
  const rng = makeRng(seed);
  const gauss = () => {
    const u = Math.max(rng.next(), 1e-12);
    const v = rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return BMI.map((b) => {
    const ht = 1.68 + 0.05 * gauss();
    return b * ht * ht;
  });
};
const rBW = [];
const vifW = [];
const bBMIw = [];
const nsWeight = [];
const ciInfl = [];
for (let s = 1; s <= SEEDS; s += 1) {
  const wgt = wgtFor(s);
  rBW.push(corr(BMI, wgt));
  const fMix = ols(SYSBP, BMI, wgt, AGE);
  bBMIw.push(fMix.b[1]);
  nsWeight.push(Math.abs(fMix.t[2]) < tq ? 1 : 0);
  ciInfl.push(fMix.se[1] / fBoth.se[1]);
  vifW.push(1 / (1 - ols(wgt, BMI, AGE).r2));
}
const w1 = wgtFor(1);
const f1 = ols(SYSBP, BMI, w1, AGE);
console.log(`r(BMI, weight) ${mean(rBW).toFixed(3)} ± ${sd(rBW).toFixed(3)}   (seed 1: ${corr(BMI, w1).toFixed(3)})`);
console.log(`VIF(weight) ${mean(vifW).toFixed(2)} ± ${sd(vifW).toFixed(2)}   (seed 1: ${vifW[0].toFixed(2)}; threshold 5)`);
console.log(`b(BMI) with both twins ${mean(bBMIw).toFixed(3)} ± ${sd(bBMIw).toFixed(3)}   (unbiased against ${fBoth.b[1].toFixed(3)})`);
console.log(`weight n.s. in ${nsWeight.reduce((a, v) => a + v, 0)}/${SEEDS} seeds; CI(BMI) inflation x${mean(ciInfl).toFixed(2)}`);
console.log(`prediction untouched at seed 1: R2 ${f1.r2.toFixed(4)} vs ${fBoth.r2.toFixed(4)} without weight`);
ck("shipping twin: mean r(BMI, weight)", mean(rBW), 0.933, 0.005);
ck("shipping twin: mean VIF(weight)", mean(vifW), 7.7, 0.3);
ck("shipping twin: b(BMI) unbiased", mean(bBMIw), fBoth.b[1], 0.05);
ck("shipping twin: R2 with the twin (seed 1)", f1.r2, fBoth.r2, 5e-4);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
