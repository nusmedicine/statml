// lm-measure.mjs — every number the lm-least-squares design will stand on.
//
//   node widgets/_lab/lm-measure.mjs
//
// Two jobs, in the causal-measure.mjs pattern:
//   1. VERIFY — reproduce every stored reference output in 05-01 from the
//      shared module, so what the mock-ups show is what the notebook printed.
//   2. DESIGN — measure the facts the design questions turn on (the SS
//      surface's relief and elongation, overplotting, embed cost) BEFORE any
//      mock-up argues from them.
import { N, BMI, SYSBP } from "../lm-least-squares/data.js";
import { ols, ssLine } from "../lm-least-squares/model.js";

let fails = 0;
const ck = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}: got ${got}${ok ? "" : ` want ${want}`}`);
};

console.log("== VERIFY against 05-01 stored outputs ==");
ck("n", N, 3547, 0);

const fit = ols(SYSBP, BMI);
ck("df", fit.df, 3545, 0);
ck("b0", fit.b[0], 87.068295, 1e-5);
ck("b1", fit.b[1], 1.721042, 1e-5);
ck("se(b0)", fit.se[0], 2.178396, 1e-5);
ck("se(b1)", fit.se[1], 0.08373255, 1e-7);
ck("t(b0)", fit.t[0], 39.96899, 1e-4);
ck("t(b1)", fit.t[1], 20.55403, 1e-4);
ck("R2", fit.r2, 0.1064831, 1e-6);
ck("adjR2", fit.adjR2, 0.106231, 1e-5);

// CI bounds with the notebook's own qt(0.975, 3545) = 1.960633.
const tq = 1.960633;
ck("CI(b0) lower", fit.b[0] - tq * fit.se[0], 82.797259, 1e-4);
ck("CI(b0) upper", fit.b[0] + tq * fit.se[0], 91.33933, 1e-4);
ck("CI(b1) lower", fit.b[1] - tq * fit.se[1], 1.556873, 1e-5);
ck("CI(b1) upper", fit.b[1] + tq * fit.se[1], 1.88521, 1e-5);

// The grid's own corners, from cell 15's printed head/tail (integers as printed).
ck("SS(0, 0)", ssLine(0, 0, BMI, SYSBP), 62737626, 1);
ck("SS(0, 0.5)", ssLine(0, 0.5, BMI, SYSBP), 51266955, 1);
ck("SS(150, 4.5)", ssLine(150, 4.5, BMI, SYSBP), 65890557, 1);
ck("SS(150, 5)", ssLine(150, 5, BMI, SYSBP), 78900565, 1);

console.log(`\n== DESIGN measurements ==`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.round(p * (s.length - 1))]; };
const xbar = mean(BMI), ybar = mean(SYSBP);
console.log(`BMI:   mean ${xbar.toFixed(3)}, range ${Math.min(...BMI)}-${Math.max(...BMI)}, 1%-99% ${q(BMI, 0.01)}-${q(BMI, 0.99)}`);
console.log(`sysBP: mean ${ybar.toFixed(3)}, range ${Math.min(...SYSBP)}-${Math.max(...SYSBP)}, 1%-99% ${q(SYSBP, 0.01)}-${q(SYSBP, 0.99)}`);
console.log(`r(BMI, sysBP) = ${Math.sqrt(fit.r2).toFixed(4)}`);

// The surface's relief: what dragging the line can actually win.
const ssMin = fit.ssRes;
const ssFlat = ssLine(ybar, 0, BMI, SYSBP); // the mean line — best guess with no covariate
console.log(`\nSS relief:`);
console.log(`  SS at minimum        ${Math.round(ssMin)}`);
console.log(`  SS at flat mean line ${Math.round(ssFlat)}  (drop to min: ${(100 * (1 - ssMin / ssFlat)).toFixed(1)}% = R2)`);
console.log(`  SS at (70, 2)        ${Math.round(ssLine(70, 2, BMI, SYSBP))}  (cell 11's example line)`);
console.log(`  SS at (0, 0)         ${Math.round(ssLine(0, 0, BMI, SYSBP))}  (${(ssLine(0, 0, BMI, SYSBP) / ssMin).toFixed(1)}x the minimum)`);

// The notebook grid (31 x 51): how much of it is within reach of the minimum —
// this is what decides whether a heatmap shows a point or a trench.
let cells = 0, in105 = 0, in15 = 0, in5 = 0, gridMin = Infinity, gmB0 = 0, gmB1 = 0;
for (let b0 = 0; b0 <= 150; b0 += 5) for (let b1 = 0; b1 <= 5.0001; b1 += 0.1) {
  const s = ssLine(b0, b1, BMI, SYSBP);
  cells++;
  if (s < ssMin * 1.05) in105++;
  if (s < ssMin * 1.5) in15++;
  if (s < ssMin * 5) in5++;
  if (s < gridMin) { gridMin = s; gmB0 = b0; gmB1 = b1; }
}
console.log(`\nNotebook grid (${cells} cells):`);
console.log(`  grid minimum at (${gmB0}, ${gmB1.toFixed(1)}) = ${Math.round(gridMin)}`);
console.log(`  cells within 1.05x of true min: ${in105}, within 1.5x: ${in15}, within 5x: ${in5}`);

// Valley elongation ON THE NOTEBOOK'S OWN SQUARE PLOT (b0 0-150 and b1 0-5
// each mapped to a full axis). H = 2[[n, Sx],[Sx, Sxx]] rescaled by the axis
// spans; the eigen ratio is the trench's aspect as drawn.
const Sx = BMI.reduce((s, v) => s + v, 0), Sxx = BMI.reduce((s, v) => s + v * v, 0);
const [a, bb, c] = [2 * N * 150 * 150, 2 * Sx * 150 * 5, 2 * Sxx * 5 * 5];
const tr = a + c, det = a * c - bb * bb;
const e1 = tr / 2 + Math.sqrt(tr * tr / 4 - det), e2 = tr / 2 - Math.sqrt(tr * tr / 4 - det);
console.log(`\nValley on the notebook's square plot: eigen ratio ${(Math.sqrt(e1 / e2)).toFixed(1)}:1`);
console.log(`  (curvature along the trench vs across it — the aspect a contour would draw)`);

// Overplotting at widget scale: bin to a 500x380 stage over the 1%-99% window.
const xw = [q(BMI, 0.01), q(BMI, 0.99)], yw = [q(SYSBP, 0.01), q(SYSBP, 0.99)];
const bins = new Map();
let inWin = 0;
for (let i = 0; i < N; i++) {
  if (BMI[i] < xw[0] || BMI[i] > xw[1] || SYSBP[i] < yw[0] || SYSBP[i] > yw[1]) continue;
  inWin++;
  const px = Math.round(500 * (BMI[i] - xw[0]) / (xw[1] - xw[0]));
  const py = Math.round(380 * (SYSBP[i] - yw[0]) / (yw[1] - yw[0]));
  const k = px * 1000 + py;
  bins.set(k, (bins.get(k) || 0) + 1);
}
const counts = [...bins.values()].sort((x, y) => y - x);
console.log(`\nOverplotting on a 500x380 stage (1%-99% window, ${inWin} points):`);
console.log(`  distinct pixel positions ${bins.size}, worst pixel holds ${counts[0]}, pixels with >1 point: ${counts.filter((v) => v > 1).length}`);

// Embed cost, for the data-module decision.
const pairBytes = BMI.map((v, i) => `${v},${SYSBP[i]}`).join(";").length;
console.log(`\nEmbed cost: (BMI, sysBP) pairs alone ~${(pairBytes / 1024).toFixed(0)} KB of source`);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
