/* mixed-measure.mjs — the mixed-model engine against notebook 05-07.
 *
 *   node widgets/_lab/mixed-measure.mjs
 *
 * Reads mixed-ref.json (written by mixed-ref.R, which regenerates the
 * notebook's two simulated datasets exactly and proves it against the stored
 * head/tail rows). Checks:
 *   - fitLM against R's own lm() at full precision, and against every number
 *     the notebook's cell-10 table prints, at the printed digit.
 *   - fitLMM against the notebook's stored lmer table (cell 13) — that table
 *     IS lme4's answer on this exact data, so matching it verifies the REML
 *     fitter without lme4 installed.
 *   - the SNP example's lm against R; its lmer half is checked when
 *     mixed-ref.json carries lme4 fits (see mixed-ref.R), and reported as
 *     PENDING until then.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { fitLM, fitLMM } = await import(
  pathToFileURL(join(here, "..", "mixed-model", "model.js")).href
);
const ref = JSON.parse(readFileSync(join(here, "mixed-ref.json"), "utf8"));

let pass = 0;
let fail = 0;
const ck = (label, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `${ok ? "  ok  " : "FAIL  "}${label}  got ${got}  want ${want}${ok ? "" : `  (tol ${tol})`}`,
  );
};
const one = (v) => (Array.isArray(v) ? v[0] : v); // R scalars arrive as [x]

/* ---- example 1: longitudinal BP ------------------------------------------ */

const bp = ref.bp.data;
const n1 = bp.blood_pressure.length;
const y1 = bp.blood_pressure;
const X1 = Array.from({ length: n1 }, (_, i) => [
  1,
  bp.age[i],
  bp.gender[i] === "Male" ? 1 : 0,
  bp.medication[i] === "Yes" ? 1 : 0,
]);

console.log("== BP example: fitLM vs R lm() (full precision) ==");
const lm1 = fitLM(y1, X1);
ref.bp.lm.coef.forEach((c, j) => ck(`lm coef[${j}]`, lm1.coef[j], c, 1e-8));
const rci = ref.bp.lm.ci;
["2.5 %", "97.5 %"].forEach((side, s) =>
  rci[side].forEach((v, j) => ck(`lm ci[${j}][${s}]`, lm1.ci[j][s], v, 1e-8)),
);
ck("lm sigma", lm1.sigma, one(ref.bp.lm.sigma), 1e-8);
ck("lm r2", lm1.r2, one(ref.bp.lm.r2), 1e-10);
ck("lm rmse", lm1.rmse, one(ref.bp.lm.rmse), 1e-8);

console.log("== BP example: fitLM vs notebook cell 10 (printed digits) ==");
[81.261, 0.747, 6.006, -3.403].forEach((v, j) =>
  ck(`cell10 coef[${j}]`, lm1.coef[j], v, 6e-4),
);
ck("cell10 med CI lo", lm1.ci[3][0], -5.309, 6e-4);
ck("cell10 med CI hi", lm1.ci[3][1], -1.497, 6e-4);
ck("cell10 R2", lm1.r2, 0.225, 6e-4);
ck("cell10 RMSE", lm1.rmse, 10.79, 6e-3);

console.log("== BP example: fitLMM vs notebook cell 13 (lme4's own answer) ==");
const t0 = performance.now();
const mm1 = fitLMM(y1, X1, bp.patient_id, bp.time_point);
const ms = performance.now() - t0;
const nb = ref.bp.lmer_notebook;
nb.coef.forEach((v, j) => ck(`lmer coef[${j}]`, mm1.coef[j], v, 6e-4));
const ciNames = ["(Intercept)", "age", "genderMale", "medicationYes"];
ciNames.forEach((nm, j) => {
  ck(`lmer ci[${nm}] lo`, mm1.ci[j][0], nb.ci[nm][0], 6e-4);
  ck(`lmer ci[${nm}] hi`, mm1.ci[j][1], nb.ci[nm][1], 6e-4);
});
ck("lmer SD(intercept)", mm1.sdInt, one(nb.sd_intercept), 6e-4);
ck("lmer SD(slope)", mm1.sdSlope, one(nb.sd_slope), 6e-4);
ck("lmer cor", mm1.cor, one(nb.cor), 6e-4);
ck("lmer SD(resid)", mm1.sigma, one(nb.sd_resid), 6e-4);
ck("lmer ICC", mm1.icc, one(nb.icc), 0.05);
// KNOWN-DIFF, third decimal only: ours is Johnson 2014 verbatim
// (varRe = mean over rows of zᵀΣz); performance::r2_nakagawa books the
// slope variance slightly differently. Pin exactly once lme4 + performance
// can be installed (Rscript is firewall-blocked as of 2026-08-29).
ck("lmer R2 marginal (approx, see note)", mm1.r2Marginal, one(nb.r2_marginal), 5e-3);
ck("lmer R2 conditional (approx, see note)", mm1.r2Conditional, one(nb.r2_conditional), 5e-3);
ck("lmer AIC", mm1.aic, one(nb.aic), 0.06);
ck("lmer BIC", mm1.bic, one(nb.bic), 0.06);
ck("lmer RMSE", mm1.rmse, one(nb.rmse), 6e-3);
console.log(`   (REML fit: ${ms.toFixed(1)} ms)`);

// the teaching claim itself, stated as an assertion:
ck("lm medication CI excludes 0 (the lie)", lm1.ci[3][1] < 0 ? 1 : 0, 1, 0);
ck("lmer medication CI includes 0 (the truth)",
   mm1.ci[3][0] < 0 && mm1.ci[3][1] > 0 ? 1 : 0, 1, 0);

/* ---- example 2: SNP panel ------------------------------------------------- */

const sp = ref.snp.data;
const n2 = sp.cholesterol.length;
const y2 = sp.cholesterol;
const snpCols = Array.from({ length: 10 }, (_, k) => sp[`SNP${k + 1}`]);
// the notebook's own lm keeps family_id NUMERIC — reproduced verbatim
const X2 = Array.from({ length: n2 }, (_, i) => [
  1, ...snpCols.map((c) => c[i]), sp.family_id[i],
]);

console.log("== SNP example: fitLM vs R lm() (full precision) ==");
const lm2 = fitLM(y2, X2);
ref.snp.lm.coef.forEach((c, j) => ck(`snp lm coef[${j}]`, lm2.coef[j], c, 1e-8));

const sig = (fit, j) => fit.ci[j][0] > 0 || fit.ci[j][1] < 0;
const lmHits = Array.from({ length: 10 }, (_, k) => k + 1).filter((k) => sig(lm2, k));
console.log(`   lm flags SNPs: ${lmHits.join(", ")}`);

console.log("== SNP example: fitLMM (1 | family_id) ==");
const X2m = Array.from({ length: n2 }, (_, i) => [1, ...snpCols.map((c) => c[i])]);
const t1 = performance.now();
const mm2 = fitLMM(y2, X2m, sp.family_id, null);
console.log(`   (REML fit: ${(performance.now() - t1).toFixed(1)} ms)`);
const mmHits = Array.from({ length: 10 }, (_, k) => k + 1).filter((k) => sig(mm2, k));
console.log(
  `   lmer flags SNPs: ${mmHits.join(", ")}  |  SD(family) ${mm2.sdInt.toFixed(3)}  SD(resid) ${mm2.sigma.toFixed(3)}  ICC ${mm2.icc.toFixed(3)}`,
);
// Tolerance note: the two REML criteria agree to ~1e-10 relative (and on the
// BP fit ours is marginally LOWER, i.e. better converged than lme4's default
// nloptwrap stop), so coefficient gaps of ~1e-5 are the two optimizers'
// stopping points, not a model difference. 1e-4 is far below any printed
// digit and far above either stopping error.
if (ref.snp.lmer) {
  ref.snp.lmer.coef.forEach((c, j) =>
    ck(`snp lmer coef[${j}] vs lme4`, mm2.coef[j], c, 1e-4),
  );
  ref.snp.lmer.se.forEach((s, j) =>
    ck(`snp lmer se[${j}] vs lme4`, mm2.se[j], s, 1e-4),
  );
  const vc = ref.snp.lmer.varcorr;
  ck("snp lmer SD(family) vs lme4", mm2.sdInt, vc.sdcor[0], 1e-4);
  ck("snp lmer SD(resid) vs lme4", mm2.sigma, vc.sdcor[1], 1e-4);
  ck("snp lmer REML crit vs lme4", mm2.reml, one(ref.snp.lmer.reml), 1e-4);
} else {
  console.log("   PENDING: lme4 not installed when mixed-ref.json was written —");
  console.log("   rerun mixed-ref.R once lme4 is in to pin the SNP lmer half.");
}
if (ref.bp.lmer) {
  ref.bp.lmer.coef.forEach((c, j) =>
    ck(`bp lmer coef[${j}] vs lme4`, mm1.coef[j], c, 1e-4),
  );
  ck("bp lmer REML crit vs lme4", mm1.reml, one(ref.bp.lmer.reml), 1e-4);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
