/* Why the seed moves the answer on the airway matrix and NOT on the clean
   simulated stage — the measurement that decides what widget 41 can claim.

   `nmf-sim.mjs` section 2 found NO seed dependence at all: residual spread
   0.00%, truth-match 0.966-0.990 across twelve seeds. `nmf-measure.mjs`
   section 5 found the opposite on the lesson's own matrix: worst seed-to-seed
   cosine 0.77 and the treatment separation swinging 0.68 to 4.21.

   HYPOTHESIS: it is not NMF that is unstable, it is an UNDER-SPECIFIED NMF.
   The simulated stage has exactly two programmes and is fitted at rank 2, so
   the optimum is sharp. The airway matrix has many and is fitted at rank 2, so
   a great many two-part summaries fit about equally well and the start decides
   which one you get.

   If that is right, adding true programmes while holding the rank at 2 should
   turn the instability on. Run:  node widgets/_lab/nmf-probe.mjs
*/

import { nmf, cosine, col, groupSep, makeStageK, partAgreement } from "./nmf-model.js";

const stageK = makeStageK;   /* the generator now lives in nmf-model.js */

function spread(V, rank, seeds = 12) {
  const W = [], R = [], S = [];
  for (let s = 1; s <= seeds; s += 1) {
    const f = nmf(V, rank, s, 400);
    W.push(f.W); R.push(f.trace.at(-1));
    S.push(Math.max(...f.H.map((row) => Math.abs(groupSep(row, LAB)))));
  }
  /* worst agreement between any two runs, over the best pairing of parts */
  let worst = 1;
  for (let i = 0; i < W.length; i += 1) for (let j = i + 1; j < W.length; j += 1)
    worst = Math.min(worst, partAgreement(W[i], W[j], rank));
  return {
    worst,
    relSpread: 100 * (Math.max(...R) - Math.min(...R)) / Math.min(...R),
    resid: R[0],
    sepLo: Math.min(...S), sepHi: Math.max(...S),
  };
}

let LAB = [];

console.log("=== A. hold rank at 2, add true programmes ===");
console.log("  true parts   residual   residual spread   worst seed-to-seed   group separation");
for (const K of [2, 3, 4, 5, 6, 8]) {
  const st = stageK({ genes: 30, samples: 16, K, seed: 1 });
  LAB = st.label;
  const r = spread(st.V, 2);
  console.log(`  ${String(K).padStart(10)}   ${r.resid.toFixed(4)}     ${r.relSpread.toFixed(2).padStart(9)}%` +
    `          ${r.worst.toFixed(4)}       ${r.sepLo.toFixed(2)} - ${r.sepHi.toFixed(2)}`);
}

console.log("\n=== B. hold the truth at 6 programmes, move the rank you ask for ===");
{
  const st = stageK({ genes: 30, samples: 16, K: 6, seed: 1 });
  LAB = st.label;
  console.log("  rank asked   residual   residual spread   worst seed-to-seed");
  for (const rk of [2, 3, 4, 5, 6, 7]) {
    const r = spread(st.V, rk);
    console.log(`  ${String(rk).padStart(10)}   ${r.resid.toFixed(4)}     ${r.relSpread.toFixed(2).padStart(9)}%` +
      `          ${r.worst.toFixed(4)}`);
  }
}

console.log("\n=== C. the same sweep at the lesson's own aspect (many rows, 8 columns) ===");
{
  const st = stageK({ genes: 60, samples: 8, K: 6, seed: 1 });
  LAB = st.label;
  console.log("  rank asked   residual   residual spread   worst seed-to-seed");
  for (const rk of [2, 3, 4, 6]) {
    const r = spread(st.V, rk);
    console.log(`  ${String(rk).padStart(10)}   ${r.resid.toFixed(4)}     ${r.relSpread.toFixed(2).padStart(9)}%` +
      `          ${r.worst.toFixed(4)}`);
  }
}

/* --- D. does B replicate, or was it one lucky draw? -----------------------
   B is a single stage built from a single seed. The claim "reproducibility
   collapses as the rank approaches the number of real parts" is the one the
   widget would rest on, so it is measured over eight independent stages. */
console.log("\n=== D. section B over eight independent stages (truth = 6 parts) ===");
console.log("  rank asked   worst seed-to-seed cosine, per stage                          median");
for (const rk of [2, 3, 4, 5, 6, 7]) {
  const per = [];
  for (let ss = 1; ss <= 8; ss += 1) {
    const st = stageK({ genes: 30, samples: 16, K: 6, seed: ss });
    LAB = st.label;
    per.push(spread(st.V, rk, 6).worst);
  }
  const sorted = [...per].sort((a, b) => a - b);
  const med = (sorted[3] + sorted[4]) / 2;
  console.log(`  ${String(rk).padStart(10)}   ${per.map((v) => v.toFixed(2)).join("  ")}    ${med.toFixed(3)}`);
}
