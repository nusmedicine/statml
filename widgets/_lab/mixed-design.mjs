/* mixed-design.mjs — the measurements the mixed-model widget's design rests on.
 *
 *   node widgets/_lab/mixed-design.mjs           (~2 min)
 *
 * Every claim a control or caption might make gets a number here first:
 *   1. rows-vs-patients: more measurements of the SAME patients tighten the
 *      naive lm CI toward a false certainty; the mixed CI barely moves.
 *   2. the 500-row trade: 500×1, 100×5, 50×10, 25×20 all have "n = 500" —
 *      where the honest information actually lives.
 *   3. the between-patient SD dial: at 0 the two models agree; divergence
 *      grows with the intra-group correlation.
 *   4. a REAL effect: the mixed model is honest, not deaf.
 *   5. SNP example: false-positive SNPs vs family strength, lm vs lmm.
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(
  pathToFileURL(join(here, "..", "mixed-model", "model.js")).href
);
const { makeRng } = await import(
  pathToFileURL(join(here, "..", "core", "rng.js")).href
);

const SEEDS = 100;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (xs) => `${Math.round(100 * mean(xs))}%`;
const f2 = (x) => x.toFixed(2);

function bpCell({ patients, perPatient, effect = 0, sdPatient = 10 }) {
  const lmHalf = [], mmHalf = [], lmRej = [], mmRej = [], mmSing = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const rng = makeRng(seed);
    const d = M.simulateBP(rng, { patients, perPatient, effect, sdPatient });
    const X = M.designBP(d);
    const lm = M.fitLM(d.bp, X);
    lmHalf.push((lm.ci[3][1] - lm.ci[3][0]) / 2);
    lmRej.push(lm.ci[3][1] < 0 || lm.ci[3][0] > 0 ? 1 : 0);
    // the notebook's own formula needs ≥2 rows per patient for a random
    // slope; at 1 the intercept-only model is the honest comparator
    const mm =
      perPatient >= 2
        ? M.fitLMM(d.bp, X, d.patientId, d.time)
        : M.fitLMM(d.bp, X, d.patientId, null);
    mmHalf.push((mm.ci[3][1] - mm.ci[3][0]) / 2);
    mmRej.push(mm.ci[3][1] < 0 || mm.ci[3][0] > 0 ? 1 : 0);
    mmSing.push(mm.sdInt < 1e-4 ? 1 : 0);
  }
  return {
    lmHalf: mean(lmHalf), mmHalf: mean(mmHalf),
    lmRej, mmRej, singular: mean(mmSing),
  };
}

console.log("== 1. rows-vs-patients (100 patients, effect = 0, sdPatient = 10) ==");
console.log("perPatient |  rows | lm half-CI | lmm half-CI | lm rejects | lmm rejects");
for (const pp of [1, 2, 5, 10, 20]) {
  const r = bpCell({ patients: 100, perPatient: pp });
  console.log(
    `       ${String(pp).padStart(3)} | ${String(100 * pp).padStart(5)} |      ${f2(r.lmHalf)} |        ${f2(r.mmHalf)} |        ${pct(r.lmRej).padStart(4)} |        ${pct(r.mmRej).padStart(4)}`,
  );
}

console.log("\n== 2. the 500-row trade (effect = 0, sdPatient = 10) ==");
console.log("patients x per |  lm half-CI | lmm half-CI | lm rejects | lmm rejects");
for (const [pa, pp] of [[500, 1], [100, 5], [50, 10], [25, 20]]) {
  const r = bpCell({ patients: pa, perPatient: pp });
  console.log(
    `     ${String(pa).padStart(3)} x ${String(pp).padStart(2)}  |       ${f2(r.lmHalf)} |        ${f2(r.mmHalf)} |       ${pct(r.lmRej).padStart(4)} |        ${pct(r.mmRej).padStart(4)}`,
  );
}

console.log("\n== 3. the between-patient SD dial (100 x 5, effect = 0) ==");
console.log("sdPatient |  lm half-CI | lmm half-CI | lm rejects | lmm rejects");
for (const sd of [0, 2.5, 5, 10, 15]) {
  const r = bpCell({ patients: 100, perPatient: 5, sdPatient: sd });
  console.log(
    `     ${String(sd).padStart(4)} |       ${f2(r.lmHalf)} |        ${f2(r.mmHalf)} |       ${pct(r.lmRej).padStart(4)} |        ${pct(r.mmRej).padStart(4)}`,
  );
}

console.log("\n== 4. a REAL effect (100 x 5, sdPatient = 10): power, not deafness ==");
console.log("effect |  lm rejects | lmm rejects");
for (const eff of [-2, -4, -6, -8]) {
  const r = bpCell({ patients: 100, perPatient: 5, effect: eff });
  console.log(
    `   ${String(eff).padStart(3)} |        ${pct(r.lmRej).padStart(4)} |        ${pct(r.mmRej).padStart(4)}`,
  );
}

console.log("\n== 5. SNP example (1000 ind, 200 families, causal = SNP5 only) ==");
console.log("sdFamily | lm false+ (of 9) | lmm false+ | lm finds SNP5 | lmm finds SNP5");
const SNP_SEEDS = 50;
for (const sf of [0, 2.5, 5]) {
  const lmFP = [], mmFP = [], lmHit = [], mmHit = [];
  for (let seed = 1; seed <= SNP_SEEDS; seed += 1) {
    const rng = makeRng(seed + 1000);
    const d = M.simulateSNP(rng, { sdFamily: sf });
    const X = M.designSNP(d);
    const lm = M.fitLM(d.chol, X);
    const mm = M.fitLMM(d.chol, X, d.familyId, null);
    const sig = (fit, j) => fit.ci[j][0] > 0 || fit.ci[j][1] < 0;
    let a = 0, b = 0;
    for (let j = 1; j <= 10; j += 1) {
      if (j === 5) continue;
      if (sig(lm, j)) a += 1;
      if (sig(mm, j)) b += 1;
    }
    lmFP.push(a);
    mmFP.push(b);
    lmHit.push(sig(lm, 5) ? 1 : 0);
    mmHit.push(sig(mm, 5) ? 1 : 0);
  }
  console.log(
    `    ${String(sf).padStart(4)} |             ${f2(mean(lmFP))} |       ${f2(mean(mmFP))} |          ${pct(lmHit).padStart(4)} |           ${pct(mmHit).padStart(4)}`,
  );
}
