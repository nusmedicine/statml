/* ============================================================================
   Planning measurements for HTD slot 3, `batch-effect`.

       node widgets/_lab/batch-measure.mjs

   Imports `batch-model.js`, so the numbers are from the code that would ship.
   ========================================================================= */

import {
  simulate, correct, CORRECTIONS, estimatedEffect, estimateWithSE, nullEffect,
  pca, separation, projectAll,
  GENES, SAMPLES, AFFECTED, TRUE_EFFECT, BATCH_SHIFT,
} from "../batch-effect/model.js";

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

/* -- 6 · the point estimate is not the story; the interval is -------------- */
console.log();
console.log("=== 6 · WHY THE COVARIATE IS NOT ENOUGH ===");
console.log("Per-gene estimate of the disease effect and its 95% interval, averaged over");
console.log(`the ${AFFECTED} genes that carry one, ${SEEDS.length} seeds, batch shift ${BATCH_SHIFT}. Truth ${TRUE_EFFECT}.`);
console.log();
console.log([pad("confounding", 12), pad("correction", 12), rpad("estimate", 9),
  rpad("interval", 18), "reads"].join(" | "));
console.log("-".repeat(72));
for (const overlap of OVERLAPS) {
  for (const key of Object.keys(CORRECTIONS)) {
    let b = 0;
    let lo = 0;
    let hi = 0;
    let ok = 0;
    for (const seed of SEEDS) {
      const r = estimateWithSE(simulate({ seed, overlap }), key);
      if (!Number.isFinite(r.beta)) continue;
      b += r.beta; lo += r.lo; hi += r.hi; ok += 1;
    }
    if (!ok) {
      console.log([rpad(overlap.toFixed(2), 12), pad(key, 12), rpad("—", 9),
        rpad("—", 18), "not estimable"].join(" | "));
      continue;
    }
    b /= ok; lo /= ok; hi /= ok;
    const reads = [lo > 0 ? "excludes 0" : "CROSSES 0",
      Math.abs(b - TRUE_EFFECT) < (hi - lo) / 2 ? "covers the truth" : "MISSES the truth"].join(", ");
    console.log([rpad(overlap.toFixed(2), 12), pad(key, 12), rpad(f(b), 9),
      rpad(`${f(lo, 2)} to ${f(hi, 2)}`, 18), reads].join(" | "));
  }
}
console.log();
console.log("  -> `remove` takes the batch out of the DATA and the comparison that follows");
console.log("     has no idea a correction happened, so it stays NARROW while the estimate");
console.log("     moves: confidently wrong. `covariate` spends the same information inside");
console.log("     the model, so it WIDENS instead — the right answer, and no power left to");
console.log("     act on it. A point estimate makes those two look like near neighbours.");

/* -- 7 · the frame the two panels share ------------------------------------ */
console.log();
console.log("=== 7 · THE CLOUD COLLAPSES, AND A PER-STATE AXIS HID IT ===");
console.log("Width of the point cloud on the fixed frame, overlap 0, batch shift 2.");
console.log();
{
  const sim = simulate({ seed: 1, overlap: 0 });
  const { points } = projectAll(sim);
  const all = Object.values(points).flat();
  const span = Math.max(...all.map((q) => q[0])) - Math.min(...all.map((q) => q[0]));
  console.log([pad("correction", 12), rpad("cloud width", 12), rpad("of the frame", 14),
    rpad("PC1 by batch", 14), rpad("PC1 by condition", 17)].join(" | "));
  console.log("-".repeat(76));
  for (const key of Object.keys(points)) {
    const xs = points[key].map((q) => q[0]);
    const w = Math.max(...xs) - Math.min(...xs);
    console.log([pad(key, 12), rpad(f(w, 1), 12), rpad(`${(100 * w / span).toFixed(0)}%`, 14),
      rpad(f(separation(xs, sim.batch.map((x) => x === 1)), 2), 14),
      rpad(f(separation(xs, sim.disease), 2), 17)].join(" | "));
  }
}
console.log();
console.log("  -> the axis used to be fitted to the CURRENT correction, so the cloud");
console.log("     refilled the panel every time and this 3x collapse was invisible.");
console.log();
