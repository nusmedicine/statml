// lm-diag-measure.mjs — every number the lm-diagnostics design will stand on.
//
//   node widgets/_lab/lm-diag-measure.mjs
//
// Two jobs, the lm-int-measure.mjs pattern:
//   1. VERIFY — reproduce every stored output in 05-01 cells 53–62 from the
//      shared stage (widgets/lm-least-squares/data.js + model.js): R² and
//      adjusted R² to the digit, and the diagnostic pipeline against the
//      stored autoplot(which = 1:2) figure — the three points it labels
//      (rows 404, 1003, 1668 of the filtered frame, 1-based) must be OUR
//      three largest |standardized residual|s, which checks residuals,
//      sigma and leverage in one go. The figure's axes are read off the
//      PNG, so those checks carry honest wide tolerances.
//   2. DESIGN — the facts the mock-ups must answer to: how flat the real
//      data's residual smooth actually is (the "hovers around 0" bullet,
//      quantified), how skewed its Q-Q is (the real data already bends —
//      the widget opens on a gentle violation), what curvature / fanning a
//      synthetic generator needs before each diagnostic plot shows it at
//      panel scale, and whether the adjusted-R² bias argument is visible
//      at n = 3547 at all (it is not — measured below — so that lesson
//      needs a small-n act or it needs to stay in prose).
//
// The machinery (qnorm, diagnostics, loessAt, makeSynth) lives in
// lm-diag-model.js — the lm-model.js arrangement: one copy for this
// script, the mock-ups and eventually the widget.
import { N, BMI, SYSBP } from "../lm-least-squares/data.js";
import { makeRng } from "../core/rng.js";
import { ols } from "../lm-least-squares/model.js";
import { qnorm, diagnostics, loessAt, makeSynth } from "./lm-diag-model.js";

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

console.log("== VERIFY against 05-01 stored outputs ==");
console.log("-- the fit (cells 25/29/47) --");
const D = diagnostics(SYSBP, BMI);
const f = D.fit;
ck("n", N, 3547, 0);
ck("df", f.df, 3545, 0);
ck("b0", f.b[0], 87.068295, 1e-5);
ck("b1", f.b[1], 1.721042, 1e-6);
ck("SE(b0)", f.se[0], 2.17839615, 1e-6);
ck("SE(b1)", f.se[1], 0.08373255, 1e-7);

console.log("-- goodness of fit (cells 56/59) --");
ck("R^2", f.r2, 0.1064831, 1e-7);
ck("adjusted R^2", f.adjR2, 0.106231, 1e-6);

console.log("-- qnorm, against R's qnorm --");
ck("qnorm(0.975)", qnorm(0.975), 1.959964, 1e-5);
ck("qnorm(0.75)", qnorm(0.75), 0.6744898, 1e-6);
ck("qnorm(0.001)", qnorm(0.001), -3.090232, 1e-5);

console.log("-- the diagnostic pipeline, against the stored autoplot --");
/* exact structural checks first */
ck("sum of leverages = k", D.lev.reduce((s, v) => s + v, 0), 2, 1e-9);
ck("residuals sum to 0", D.resid.reduce((s, v) => s + v, 0), 0, 1e-6);
/* the three rows autoplot labels are the three largest |stdres| — this is
   the check that ties residual, sigma and leverage together. R's rows are
   1-based over the filtered frame; data.js preserves that order. */
const byAbs = D.std.map((v, i) => i).sort((a, b) => Math.abs(D.std[b]) - Math.abs(D.std[a]));
const top3 = byAbs.slice(0, 3).map((i) => i + 1).sort((a, b) => a - b);
ck("labelled row 404", top3[0], 404, 0);
ck("labelled row 1003", top3[1], 1003, 0);
ck("labelled row 1668", top3[2], 1668, 0);
/* figure-read values — wide tolerances, the PNG is the source */
ck("max stdres ~ 7.3 (figure top point)", Math.max(...D.std), 7.3, 0.25);
ck("max residual ~ 143 (figure)", Math.max(...D.resid), 143, 5);
ck("min residual ~ -55 (figure)", Math.min(...D.resid), -55, 3);
ck("min stdres ~ -2.7 (figure)", Math.min(...D.std), -2.7, 0.15);
const fitLo = Math.min(...f.fitted);
const fitHi = Math.max(...f.fitted);
console.log(`  fitted range ${fitLo.toFixed(1)} – ${fitHi.toFixed(1)} (figure axis ~112–185)`);

console.log("\n== DESIGN measurements ==");

/* 1 · the real data's Residuals vs Fitted — how flat is "hovers around 0"? */
const GRID = Array.from({ length: 61 }, (_, i) => fitLo + ((fitHi - fitLo) * i) / 60);
const sm = loessAt(f.fitted, D.resid, 0.75, GRID);
/* the smooth wanders at the sparse right edge; report the span the data
   occupies densely (1%–99% of fitted) beside the full range */
const q01 = f.fitted.slice().sort((a, b) => a - b)[Math.floor(0.01 * N)];
const q99 = f.fitted.slice().sort((a, b) => a - b)[Math.floor(0.99 * N)];
const dense = sm.filter((_, i) => GRID[i] >= q01 && GRID[i] <= q99);
const rSd = sd(D.resid);
console.log(`real data, residual SD ${rSd.toFixed(1)}:`);
console.log(`  smooth range full ${Math.min(...sm).toFixed(2)} … ${Math.max(...sm).toFixed(2)}, dense (1%–99% fitted) ${Math.min(...dense).toFixed(2)} … ${Math.max(...dense).toFixed(2)}`);
console.log(`  → at a 250px panel spanning ±3 SD the dense smooth moves ${((Math.max(...dense) - Math.min(...dense)) / (6 * rSd) * 250).toFixed(1)}px — visually FLAT`);
/* equal-variance on the real data: residual SD by fitted-value fifth */
const fifthSdsOf = (fitted, resid) => {
  const byFit = fitted.map((v, i) => i).sort((a, b) => fitted[a] - fitted[b]);
  return [0, 1, 2, 3, 4].map((k) => {
    const seg = byFit.slice(Math.floor((k * N) / 5), Math.floor(((k + 1) * N) / 5));
    return sd(seg.map((i) => resid[i]));
  });
};
const fifthSds = fifthSdsOf(f.fitted, D.resid);
console.log(`  residual SD by fitted fifth: ${fifthSds.map((v) => v.toFixed(1)).join(" / ")} — ratio last/first ${(fifthSds[4] / fifthSds[0]).toFixed(2)}`);

/* 2 · the real data's Q-Q — the bend the widget opens on */
const skew = (() => {
  const m = mean(D.resid);
  const s3 = D.resid.reduce((s, v) => s + (v - m) ** 3, 0) / N;
  return s3 / rSd ** 3;
})();
console.log(`  residual skewness ${skew.toFixed(2)} (sysBP's right tail)`);
const gapAt = (d, th) => {
  let best = 0;
  for (let i = 1; i < d.qq.length; i += 1) {
    if (Math.abs(d.qq[i].th - th) < Math.abs(d.qq[best].th - th)) best = i;
  }
  const p = d.qq[best];
  return { obs: p.std, line: d.line.inter + d.line.slope * p.th };
};
for (const t of [-2, 0, 2, 3]) {
  const g = gapAt(D, t);
  console.log(`  Q-Q at theoretical ${String(t).padStart(2)}: observed ${g.obs.toFixed(2)} vs line ${g.line.toFixed(2)} (gap ${(g.obs - g.line).toFixed(2)} SD)`);
}

/* 3 · the generator — what has to be TRUE before each plot shows it.
   makeSynth: same BMI xs, y = b0 + b1·x + curve·(x − x̄)² + eps, the fan
   ramping the noise SD across the 1%–99% BMI window. Seeded. */
const synth = makeSynth(BMI, f.b[0], f.b[1], Math.sqrt(f.sigma2));
console.log("\ngenerator sweeps (seed 1, panel = 250px tall spanning ±3·residual-SD):");
console.log("  curvature — smooth bow in px, and what R² does:");
for (const curve of [0, 0.1, 0.2, 0.4]) {
  const y = synth(makeRng(1), { curve });
  const d2 = diagnostics(y, BMI);
  const g2 = loessAt(d2.fit.fitted, d2.resid, 0.75, GRID);
  const dn = g2.filter((_, i) => GRID[i] >= q01 && GRID[i] <= q99);
  const s2 = sd(d2.resid);
  const bow = (Math.max(...dn) - Math.min(...dn)) / (6 * s2) * 250;
  console.log(`    curve ${curve}: smooth moves ${bow.toFixed(0)}px, R² ${d2.fit.r2.toFixed(3)}, max|stdres| ${Math.max(...d2.std.map(Math.abs)).toFixed(1)}`);
}
console.log("  fanning — residual SD by fitted fifth (ratio last/first):");
for (const fan of [0, 1, 2, 3]) {
  const y = synth(makeRng(1), { fan });
  const d2 = diagnostics(y, BMI);
  const s5 = fifthSdsOf(d2.fit.fitted, d2.resid);
  console.log(`    fan ${fan}: ${s5.map((v) => v.toFixed(1)).join(" / ")} — ratio ${(s5[4] / s5[0]).toFixed(2)}, R² ${d2.fit.r2.toFixed(3)}`);
}
console.log("  skewed noise — the Q-Q gap at theoretical +2 (real data reads +0.88):");
for (const skewed of [false, true]) {
  const y = synth(makeRng(1), { skewed });
  const d2 = diagnostics(y, BMI);
  const g = gapAt(d2, 2);
  console.log(`    ${skewed ? "log-normal" : "normal    "}: gap at +2 = ${(g.obs - g.line).toFixed(2)} SD, max|stdres| ${Math.max(...d2.std.map(Math.abs)).toFixed(1)}`);
}

/* 4 · the adjusted-R² bias argument — where does it actually fire?
   Junk covariates are seeded N(0,1) columns with no relation to y. */
console.log("\nadjusted R² vs junk covariates (mean over 20 seeds):");
function junkSweep(nSub, ks) {
  const out = ks.map(() => ({ r2: 0, adj: 0 }));
  const SEEDS = 20;
  for (let s = 1; s <= SEEDS; s += 1) {
    const rng = makeRng(s);
    /* a seeded subsample (or the full frame) */
    let ix = Array.from({ length: N }, (_, i) => i);
    if (nSub < N) ix = rng.shuffle(ix).slice(0, nSub);
    const xs = ix.map((i) => BMI[i]);
    const ys = ix.map((i) => SYSBP[i]);
    ks.forEach((k, j) => {
      const junk = Array.from({ length: k }, () => xs.map(() => rng.normal()));
      const fit2 = ols(ys, xs, ...junk);
      out[j].r2 += fit2.r2 / SEEDS;
      out[j].adj += fit2.adjR2 / SEEDS;
    });
  }
  return out;
}
for (const nSub of [3547, 100, 30]) {
  const ks = [0, 2, 5, 10];
  const sw = junkSweep(nSub, ks);
  console.log(`  n = ${nSub}:`);
  ks.forEach((k, j) => {
    console.log(`    +${String(k).padStart(2)} junk: R² ${sw[j].r2.toFixed(3)}, adjusted ${sw[j].adj.toFixed(3)}`);
  });
}

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
