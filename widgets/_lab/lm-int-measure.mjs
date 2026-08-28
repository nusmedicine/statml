// lm-int-measure.mjs — every number the lm-interaction design will stand on.
//
//   node widgets/_lab/lm-int-measure.mjs
//
// Two jobs, the lm-cat-measure.mjs pattern:
//   1. VERIFY — reproduce every stored output in 05-04 from the shared stage
//      (widgets/lm-least-squares/data.js + model.js): all six models — the
//      three acts (age×BMI, age×sex, diabetes×sex), each with and without
//      its interaction. 05-04's frame is 05-01's exactly (filter(BPMeds==0)
//      + drop_na, n = 3547), and the outcome is totChol.
//   2. DESIGN — the facts the design turns on: where each "main effect"
//      actually LIVES once the interaction is in (the gap at x = 0, off the
//      data); where the lines cross; the conditional effect as a function;
//      the 2×2 cell means and the difference of differences; and whether
//      each picture is visible at panel scale.
import { N, BMI, AGE, SEX, TOTCHOL, DIABETES } from "../lm-least-squares/data.js";
import { ols } from "../lm-least-squares/model.js";

let fails = 0;
const ck = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}: got ${got}${ok ? "" : ` want ${want}`}`);
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const mul = (a, b) => a.map((v, i) => v * b[i]);
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.round(p * (s.length - 1))];
};

console.log("== VERIFY against 05-04 stored outputs ==");
console.log("-- act 1: totChol ~ age + BMI (cell 7) --");
const f1i = ols(TOTCHOL, AGE, BMI);
ck("intercept", f1i.b[0], 148.5875023, 1e-5);
ck("b(age)", f1i.b[1], 1.3214189, 1e-6);
ck("b(BMI)", f1i.b[2], 0.8681408, 1e-6);
ck("SE(BMI)", f1i.se[2], 0.17804235, 1e-6);

console.log("-- act 1: totChol ~ age * BMI (cell 11) --");
const f1 = ols(TOTCHOL, AGE, BMI, mul(AGE, BMI));
ck("intercept", f1.b[0], 2.7702104, 1e-5);
ck("b(age)", f1.b[1], 4.2670665, 1e-6);
ck("b(BMI)", f1.b[2], 6.5672711, 1e-6);
ck("b(age:BMI)", f1.b[3], -0.1147453, 1e-7);
ck("SE(intercept)", f1.se[0], 26.51006892, 1e-5);
ck("SE(age:BMI)", f1.se[3], 0.02035792, 1e-7);
ck("t(age:BMI)", f1.t[3], -5.6363952, 1e-4);

console.log("-- act 2: totChol ~ age + sex (cell 18) --");
const f2i = ols(TOTCHOL, AGE, SEX);
ck("intercept", f2i.b[0], 170.819672, 1e-5);
ck("b(age)", f2i.b[1], 1.368518, 1e-6);
ck("b(sex1)", f2i.b[2], -4.995438, 1e-6);

console.log("-- act 2: totChol ~ age * sex (cell 22) --");
const f2 = ols(TOTCHOL, AGE, SEX, mul(AGE, SEX));
ck("intercept", f2.b[0], 125.414752, 1e-5);
ck("b(age)", f2.b[1], 2.286742, 1e-6);
ck("b(sex1)", f2.b[2], 95.568418, 1e-5);
ck("b(age:sex1)", f2.b[3], -2.038796, 1e-6);
ck("SE(sex1)", f2.se[2], 8.1912477, 1e-6);
ck("SE(age:sex1)", f2.se[3], 0.1636471, 1e-7);
ck("t(age:sex1)", f2.t[3], -12.45849, 1e-4);

console.log("-- act 3: totChol ~ diabetes + sex (cell 29) --");
const f3i = ols(TOTCHOL, DIABETES, SEX);
ck("intercept", f3i.b[0], 238.262078, 1e-5);
ck("b(diabetes1)", f3i.b[1], 10.184390, 1e-5);
ck("b(sex1)", f3i.b[2], -5.375076, 1e-6);
ck("p-ish t(diabetes1)", f3i.t[1], 2.194067, 1e-4);

console.log("-- act 3: totChol ~ diabetes * sex (cell 34) --");
const f3 = ols(TOTCHOL, DIABETES, SEX, mul(DIABETES, SEX));
ck("intercept", f3.b[0], 238.018819, 1e-5);
ck("b(diabetes1)", f3.b[1], 21.003909, 1e-5);
ck("b(sex1)", f3.b[2], -4.830225, 1e-6);
ck("b(diabetes1:sex1)", f3.b[3], -21.022290, 1e-5);
ck("SE(diabetes1:sex1)", f3.se[3], 9.2821630, 1e-6);

console.log("\n== DESIGN measurements ==");

/* where the data actually lives */
console.log(`age range ${Math.min(...AGE)}–${Math.max(...AGE)} (1%–99%: ${q(AGE, 0.01)}–${q(AGE, 0.99)})`);
console.log(`totChol range ${Math.min(...TOTCHOL)}–${Math.max(...TOTCHOL)} (1%–99%: ${q(TOTCHOL, 0.01)}–${q(TOTCHOL, 0.99)})`);

/* ACT 2 — the crossing lines, and where the "sex effect" lives */
const cross = f2.b[2] / -f2.b[3];
console.log(`\nact 2 (age × sex): female slope ${f2.b[1].toFixed(3)}, male slope ${(f2.b[1] + f2.b[3]).toFixed(3)}`);
console.log(`  the lines CROSS at age ${cross.toFixed(1)}; the youngest patient is ${Math.min(...AGE)}`);
for (const a of [0, 35, 47, 55, 65]) {
  const gap = f2.b[2] + f2.b[3] * a;
  console.log(`  sex gap at age ${String(a).padStart(2)}: ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}`);
}
console.log(`  "the sex effect is +95.57" is a claim about age 0 — ${Math.min(...AGE)} years left of the youngest patient`);
/* px at a plausible act-2 panel: y [150, 350], 230px */
const PX2 = 230 / 200;
console.log(`  at a [150,350] panel: gap at 35 = ${(Math.abs(f2.b[2] + f2.b[3] * 35) * PX2).toFixed(0)}px, at 65 = ${(Math.abs(f2.b[2] + f2.b[3] * 65) * PX2).toFixed(0)}px — the crossing is LEGIBLE`);
/* R² with and without */
console.log(`  R²: independent ${f2i.r2.toFixed(4)} → interaction ${f2.r2.toFixed(4)}`);

/* ACT 1 — the conditional slope as a function, and its sign flips */
console.log(`\nact 1 (age × BMI): BMI slope = ${f1.b[2].toFixed(2)} ${f1.b[3].toFixed(4)}·age — flips sign at age ${(f1.b[2] / -f1.b[3]).toFixed(1)}`);
console.log(`  age slope = ${f1.b[1].toFixed(2)} ${f1.b[3].toFixed(4)}·BMI — flips sign at BMI ${(f1.b[1] / -f1.b[3]).toFixed(1)}`);
for (const a of [40, 50, 60]) console.log(`  BMI slope at age ${a}: ${(f1.b[2] + f1.b[3] * a).toFixed(2)}`);
console.log(`  "the age effect is +4.27" is a claim about BMI 0; the thinnest patient is ${Math.min(...BMI)}`);

/* ACT 3 — the 2×2 cells, and the effect that is an average of 21 and nothing */
const cells = {};
for (const d of [0, 1]) {
  for (const s of [0, 1]) {
    const ys = TOTCHOL.filter((_, i) => DIABETES[i] === d && SEX[i] === s);
    cells[`d${d}s${s}`] = { n: ys.length, mean: mean(ys) };
  }
}
console.log(`\nact 3 (diabetes × sex) cell means (n):`);
console.log(`  women: no-diab ${cells.d0s0.mean.toFixed(2)} (${cells.d0s0.n}), diab ${cells.d1s0.mean.toFixed(2)} (${cells.d1s0.n})`);
console.log(`  men:   no-diab ${cells.d0s1.mean.toFixed(2)} (${cells.d0s1.n}), diab ${cells.d1s1.mean.toFixed(2)} (${cells.d1s1.n})`);
ck("saturated model = cell means: d0s0", f3.b[0], cells.d0s0.mean, 1e-9);
ck("saturated model = cell means: d1s0", f3.b[0] + f3.b[1], cells.d1s0.mean, 1e-9);
ck("saturated model = cell means: d0s1", f3.b[0] + f3.b[2], cells.d0s1.mean, 1e-9);
ck("saturated model = cell means: d1s1", f3.b[0] + f3.b[1] + f3.b[2] + f3.b[3], cells.d1s1.mean, 1e-9);
const dInWomen = cells.d1s0.mean - cells.d0s0.mean;
const dInMen = cells.d1s1.mean - cells.d0s1.mean;
console.log(`  diabetes effect: in women ${dInWomen >= 0 ? "+" : ""}${dInWomen.toFixed(2)}, in men ${dInMen >= 0 ? "+" : ""}${dInMen.toFixed(2)}`);
console.log(`  the interaction IS the difference of differences: ${(dInMen - dInWomen).toFixed(2)}`);
console.log(`  the independent model's "+10.18 diabetes effect" is an average of ${dInWomen.toFixed(1)} and ${dInMen.toFixed(1)}`);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
