/* ============================================================================
   Planning measurements for HTD slot 3, `batch-effect`.

       node widgets/_lab/batch-measure.mjs

   Imports `batch-model.js`, so the numbers are from the code that would ship.
   ========================================================================= */

import {
  simulate, correct, CORRECTIONS, estimatedEffect, nullEffect, pca, separation,
  GENES, SAMPLES, AFFECTED, TRUE_EFFECT, BATCH_SHIFT,
} from "./batch-model.js";

const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const OVERLAPS = [0, 0.25, 0.5, 0.75, 1];
const SEEDS = [1, 2, 3, 4, 5];

/* -- 1 · the notebook's design, and the assumption it never states --------- */
console.log("\n=== 1 · THE NOTEBOOK'S OWN DESIGN IS PERFECTLY BALANCED ===");
console.log(`${GENES} genes x ${SAMPLES} samples; genes 1..${AFFECTED} carry an effect of`);
console.log(`${TRUE_EFFECT}; samples 21..40 are shifted by ${BATCH_SHIFT}. Cell 3 never says that`);
console.log("condition alternates while batch splits at 20, so the batches are balanced.\n");
console.log("overlap | batch 1: healthy/disease | batch 2: healthy/disease");
for (const overlap of OVERLAPS) {
  const { batch, disease } = simulate({ seed: 1, overlap });
  const count = (b, d) => batch.filter((x, j) => x === b && disease[j] === d).length;
  console.log(`${rpad(overlap.toFixed(2), 7)} | ${rpad(`${count(0, false)} / ${count(0, true)}`, 24)} | ${count(1, false)} / ${count(1, true)}`);
}
console.log("\n  -> overlap 0 IS the notebook. It is the only setting where the correction");
console.log("     has a chance, and nothing in the lesson says so.");

/* -- 2 · what the correction recovers, and where it stops ------------------ */
console.log("\n=== 2 · THE ESTIMATED DISEASE EFFECT, AVERAGED OVER 5 SEEDS ===");
console.log(`the truth is ${TRUE_EFFECT.toFixed(2)} on the 25 affected genes\n`);
const keys = Object.keys(CORRECTIONS);
console.log([pad("overlap", 8), ...keys.map((k) => rpad(k, 12))].join(" | "));
console.log("-".repeat(8 + keys.length * 15));
const table = {};
for (const overlap of OVERLAPS) {
  const row = {};
  for (const k of keys) {
    const vals = SEEDS.map((seed) => {
      const sim = simulate({ seed, overlap });
      return estimatedEffect(correct(sim, k), sim.disease);
    });
    row[k] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }
  table[overlap] = row;
  console.log([rpad(overlap.toFixed(2), 8), ...keys.map((k) => rpad(f(row[k]), 12))].join(" | "));
}
console.log("\n  -> uncorrected, the estimate is inflated by the batch shift as soon as the");
console.log("     design is unbalanced. Subtracting each batch's mean fixes that — and at");
console.log("     full confounding it removes the biology with it.");

/* -- 3 · the false positives on the 25 genes with no effect ---------------- */
console.log("\n=== 3 · THE 25 GENES WITH NO EFFECT — where the false positives come from ===");
console.log([pad("overlap", 8), ...keys.map((k) => rpad(k, 12))].join(" | "));
console.log("-".repeat(8 + keys.length * 15));
for (const overlap of OVERLAPS) {
  const cells = keys.map((k) => {
    const vals = SEEDS.map((seed) => {
      const sim = simulate({ seed, overlap });
      return nullEffect(correct(sim, k), sim.disease);
    });
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  });
  console.log([rpad(overlap.toFixed(2), 8), ...cells.map((v) => rpad(f(v), 12))].join(" | "));
}
console.log("\n  -> this row is the one that matters clinically: an uncorrected confounded");
console.log("     design reports a difference on genes that have none.");

/* -- 4 · which split PC1 separates ----------------------------------------- */
console.log("\n=== 4 · WHICH SPLIT DOES PC1 SEPARATE? (mean over 5 seeds) ===");
console.log("separation = |difference in group means| / pooled sd, along PC1\n");
console.log([pad("overlap", 8), pad("correction", 14), rpad("PC1 share", 10),
  rpad("by batch", 10), rpad("by condition", 13)].join(" | "));
console.log("-".repeat(62));
for (const overlap of [0, 1]) {
  for (const k of keys) {
    const acc = { share: 0, b: 0, c: 0 };
    for (const seed of SEEDS) {
      const sim = simulate({ seed, overlap });
      const p = pca(correct(sim, k));
      const pc1 = p.scores.map((s) => s[0]);
      acc.share += p.share[0];
      acc.b += separation(pc1, sim.batch.map((x) => x === 1));
      acc.c += separation(pc1, sim.disease);
    }
    const n = SEEDS.length;
    console.log([rpad(overlap.toFixed(2), 8), pad(k, 14), rpad(f(acc.share / n), 10),
      rpad(f(acc.b / n), 10), rpad(f(acc.c / n), 13)].join(" | "));
  }
}
console.log("\n  -> uncorrected, PC1 is the batch: the artefact is 2 against a 0.8 effect.");
console.log("     After correction it is the condition — unless the design is confounded,");
console.log("     where the two questions have the same answer.");

/* -- 5 · how big does the batch effect have to be to dominate? ------------- */
console.log("\n=== 5 · WHEN DOES THE BATCH TAKE OVER PC1? (overlap 0, 5 seeds) ===");
console.log([pad("batch shift", 12), rpad("PC1 by batch", 14), rpad("PC1 by condition", 17)].join(" | "));
console.log("-".repeat(48));
for (const shift of [0, 0.25, 0.5, 1, 2, 4]) {
  let b = 0;
  let c = 0;
  for (const seed of SEEDS) {
    const sim = simulate({ seed, overlap: 0, batchShift: shift });
    const pc1 = pca(sim.X).scores.map((s) => s[0]);
    b += separation(pc1, sim.batch.map((x) => x === 1));
    c += separation(pc1, sim.disease);
  }
  console.log([rpad(shift.toFixed(2), 12), rpad(f(b / SEEDS.length), 14),
    rpad(f(c / SEEDS.length), 17)].join(" | "));
}
console.log("\n  -> the notebook picks 2, which is 2.5x the biology. Below about 0.5 the");
console.log("     condition still owns PC1, so the shift is worth a control of its own.");
console.log();
