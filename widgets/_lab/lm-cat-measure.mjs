// lm-cat-measure.mjs — every number the lm-categorical design will stand on.
//
//   node widgets/_lab/lm-cat-measure.mjs
//
// Two jobs, the lm-adjust-measure.mjs pattern:
//   1. VERIFY — reproduce every stored output in 05-03 from the shared stage
//      (widgets/lm-least-squares/data.js + model.js): the sex model's full
//      coefficient block, and the BMI-category model's. 05-03's frame is
//      05-01's exactly (filter(BPMeds==0) + drop_na, n = 3547), so the digits
//      must match, not resemble.
//   2. DESIGN — the facts the design turns on: dummy coefficient = difference
//      of group means (the identity, asserted); the relevel arithmetic (the
//      coefficients all move, the fitted means and R² do not — the reference
//      is a CHOICE); whether each offset is VISIBLE at panel scale; group
//      sizes and what they do to the SEs; what categorising BMI throws away.
import { N, BMI, SYSBP, AGE, SEX } from "../lm-least-squares/data.js";
import { ols } from "../lm-least-squares/model.js";

let fails = 0;
const ck = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}: got ${got}${ok ? "" : ` want ${want}`}`);
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

console.log("== VERIFY against 05-03 stored outputs ==");
console.log("-- sysBP ~ BMI + age + sex (cells 16/22/24/27) --");
const fSex = ols(SYSBP, BMI, AGE, SEX);
ck("intercept", fSex.b[0], 52.0377969, 1e-5);
ck("b(BMI)", fSex.b[1], 1.5247853, 1e-6);
ck("b(age)", fSex.b[2], 0.8325703, 1e-6);
ck("b(sex1)", fSex.b[3], -2.2530527, 1e-6);
ck("SE(intercept)", fSex.se[0], 2.57684123, 1e-6);
ck("SE(BMI)", fSex.se[1], 0.07914083, 1e-7);
ck("SE(age)", fSex.se[2], 0.03705549, 1e-7);
ck("SE(sex1)", fSex.se[3], 0.63156336, 1e-7);
ck("t(sex1)", fSex.t[3], -3.567421, 1e-4);
ck("df", fSex.df, 3543, 0);
const tq = 1.960633; // qt(.975, 3543) agrees with the df-3545 value to 6 dp
ck("CI(sex1) lower", fSex.b[3] - tq * fSex.se[3], -3.491317, 1e-4);
ck("CI(sex1) upper", fSex.b[3] + tq * fSex.se[3], -1.0147882, 1e-4);
ck("R2", fSex.r2, 0.2211815, 1e-6);
ck("adjR2", fSex.adjR2, 0.220522, 1e-5);

console.log("-- sysBP ~ BMI_cat, healthy reference (cell 42) --");
/* the notebook's case_when, verbatim thresholds */
const CAT = BMI.map((b) => (b < 18.5 ? "underweight" : b < 25 ? "healthy" : b < 30 ? "overweight" : "obese"));
const dummy = (name) => CAT.map((c) => (c === name ? 1 : 0));
/* R's default dummy order is alphabetical after the reference:
   healthy | obese, overweight, underweight — the reference chosen by the
   ALPHABET, which is the design's opening gift */
const fCat = ols(SYSBP, dummy("obese"), dummy("overweight"), dummy("underweight"));
ck("intercept (healthy)", fCat.b[0], 125.777429, 1e-5);
ck("b(obese)", fCat.b[1], 17.720212, 1e-5);
ck("b(overweight)", fCat.b[2], 8.423584, 1e-5);
ck("b(underweight)", fCat.b[3], -7.360763, 1e-5);
ck("SE(intercept)", fCat.se[0], 0.5058826, 1e-6);
ck("SE(obese)", fCat.se[1], 1.1039134, 1e-6);
ck("SE(overweight)", fCat.se[2], 0.7291913, 1e-6);
ck("SE(underweight)", fCat.se[3], 2.9597017, 1e-6);
ck("t(obese)", fCat.t[1], 16.052176, 1e-4);
ck("t(underweight)", fCat.t[3], -2.486995, 1e-4);

console.log("\n== DESIGN measurements ==");

/* group sizes and raw means */
const groups = ["underweight", "healthy", "overweight", "obese"];
const byCat = {};
for (const g of groups) {
  const ys = SYSBP.filter((_, i) => CAT[i] === g);
  byCat[g] = { n: ys.length, mean: mean(ys) };
}
console.log("group      n     raw mean sysBP");
for (const g of groups) console.log(`${g.padEnd(11)}${String(byCat[g].n).padEnd(6)}${byCat[g].mean.toFixed(3)}`);

/* THE IDENTITY the widget teaches: a dummy coefficient is the DIFFERENCE of
   group means, so mean = intercept + coefficient, exactly */
ck("identity: mean(healthy) = intercept", byCat.healthy.mean, fCat.b[0], 1e-9);
ck("identity: mean(obese) = intercept + b(obese)", byCat.obese.mean, fCat.b[0] + fCat.b[1], 1e-9);
ck("identity: mean(underweight) = intercept + b(underweight)", byCat.underweight.mean, fCat.b[0] + fCat.b[3], 1e-9);

/* THE RELEVEL: reference = obese — every coefficient moves, the model does
   not. The reference is a choice, not a finding. */
const fObeseRef = ols(SYSBP, dummy("healthy"), dummy("overweight"), dummy("underweight"));
console.log(`\nrelevel to obese: intercept ${fObeseRef.b[0].toFixed(3)}, healthy ${fObeseRef.b[1].toFixed(3)}, overweight ${fObeseRef.b[2].toFixed(3)}, underweight ${fObeseRef.b[3].toFixed(3)}`);
ck("relevel: R2 identical", fObeseRef.r2, fCat.r2, 1e-12);
ck("relevel: fitted means identical (obese)", fObeseRef.b[0], byCat.obese.mean, 1e-9);
ck("relevel: b(healthy) = -b(obese|healthy ref)", fObeseRef.b[1], -fCat.b[1], 1e-9);
console.log(`relevel SEs: healthy-vs-obese ${fObeseRef.se[1].toFixed(3)} (was obese-vs-healthy ${fCat.se[1].toFixed(3)} — same pair, same SE)`);
console.log(`  underweight-vs-obese SE ${fObeseRef.se[3].toFixed(3)} vs underweight-vs-healthy ${fCat.se[3].toFixed(3)} — the SE belongs to the PAIR, and both twins of it move on relevel`);

/* pixel visibility at the real panel (230px over sysBP 80..300, the arc's
   Y_DOM): which offsets can data space carry? */
const PX = 230 / 220;
console.log(`\noffsets at panel scale (230px over 80..300):`);
console.log(`  sex1 -2.25 mmHg = ${(2.2530527 * PX).toFixed(1)}px — TWO PARALLEL LINES CANNOT CARRY THE SEX STORY`);
for (const [g, b] of [["obese", fCat.b[1]], ["overweight", fCat.b[2]], ["underweight", fCat.b[3]]]) {
  console.log(`  ${g} ${b.toFixed(2)} mmHg = ${(Math.abs(b) * PX).toFixed(1)}px`);
}

/* what the sex coefficient looks like MARGINALLY vs adjusted — does the sign
   flip (the lm-adjustment echo)? */
const fSexAlone = ols(SYSBP, SEX);
console.log(`\nsex alone: b ${fSexAlone.b[1].toFixed(3)} (SE ${fSexAlone.se[1].toFixed(3)}, t ${fSexAlone.t[1].toFixed(2)}) — adjusted: ${fSex.b[3].toFixed(3)}`);
console.log(`  female mean ${mean(SYSBP.filter((_, i) => SEX[i] === 0)).toFixed(2)}, male mean ${mean(SYSBP.filter((_, i) => SEX[i] === 1)).toFixed(2)}`);

/* what categorising a continuous covariate throws away */
const fBMI = ols(SYSBP, BMI);
console.log(`\nR2: sysBP ~ BMI ${fBMI.r2.toFixed(4)} vs sysBP ~ BMI_cat ${fCat.r2.toFixed(4)} — the binning ${fCat.r2 > fBMI.r2 ? "GAINS" : "loses"} ${Math.abs(100 * (fCat.r2 - fBMI.r2) / fBMI.r2).toFixed(1)}% of it`);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
