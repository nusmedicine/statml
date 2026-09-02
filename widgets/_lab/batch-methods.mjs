/* ============================================================================
   The lesson's methods, measured on the shipping engine: four in the picker,
   five settings once ComBat's `mod` sub-control is counted.

       node widgets/_lab/batch-methods.mjs

   Everything here imports `../batch-effect/model.js`, so these are the numbers
   the widget draws. The implementations used to live in this file; they moved
   into the model once the widget needed them, because two copies of ComBat is
   how the table and the figure come to disagree.
   ========================================================================= */

import {
  simulate, METHODS, CONTROL_SETS, applyMethod, estimateWithSE, estimatedVariable,
  alignment, withoutBatch, projectOnto, separation,
  AFFECTED, GENES, SAMPLES, TRUE_EFFECT,
} from "../batch-effect/model.js";

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "  n/a");
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const OV = [0, 0.5, 0.75, 1];
const SEEDS = [1, 2, 3, 4, 5];
/* Four methods, five settings: ComBat's `mod` is a sub-control rather than a
   second entry, so the tables carry it as an extra column. */
const KEYS = Object.keys(METHODS);
const COLS = [
  ["none", {}, "None"],
  ["combat", { mod: "null" }, "ComBat NULL"],
  ["combat", { mod: "condition" }, "ComBat ~cond"],
  ["sva", {}, "SVA"],
  ["ruv", {}, "RUV"],
];

/* ==== 1 · four different failures ========================================= */
console.log();
console.log("=== 1 · THE NOTEBOOK'S STAGE: +2 on EVERY gene, both batches equal spread ===");
console.log(`estimated disease effect, truth ${TRUE_EFFECT}, mean of ${SEEDS.length} seeds`);
console.log();
console.log([pad("confounding", 12), ...COLS.map(([, , n]) => rpad(n, 12))].join(" | "));
console.log("-".repeat(12 + COLS.length * 15));
for (const overlap of OV) {
  const row = COLS.map(([k, opts]) => {
    const v = SEEDS.map((seed) => estimateWithSE(simulate({ seed, overlap }), k, opts).beta)
      .filter(Number.isFinite);
    return rpad(v.length ? f(mean(v)) : "n/a", 12);
  });
  console.log([rpad(overlap.toFixed(2), 12), ...row].join(" | "));
}
console.log();
console.log("  -> ComBat with mod = NULL, which is what cell 12 runs, DELETES the biology.");
console.log("     ComBat with mod = ~condition protects the biology and the confounded");
console.log("     part of the batch with it. The two fail in opposite directions.");
console.log("     SVA never moves the estimate at all. RUV is the one that holds.");

/* ==== 2 · what SVA moves is the interval ================================== */
console.log();
console.log("=== 2 · SVA CANNOT MOVE THE ESTIMATE. What it moves is the interval ===");
console.log("mean standard error of the per-gene condition coefficient");
console.log();
console.log([pad("confounding", 12), ...COLS.map(([, , n]) => rpad(n, 12))].join(" | "));
console.log("-".repeat(12 + COLS.length * 15));
for (const overlap of OV) {
  const row = COLS.map(([k, opts]) => {
    const v = SEEDS.map((seed) => estimateWithSE(simulate({ seed, overlap }), k, opts).se)
      .filter(Number.isFinite);
    return rpad(v.length ? f(mean(v)) : "n/a", 12);
  });
  console.log([rpad(overlap.toFixed(2), 12), ...row].join(" | "));
}
console.log();
console.log("  -> SVA buys power on a clean design and, at strong confounding, a TIGHTER");
console.log("     interval around a wrong answer. ComBat and RUV edit the data, so the");
console.log("     comparison that follows has no idea a correction happened.");

/* ==== 3 · why SVA loses the batch and RUV does not ======================== */
console.log();
console.log("=== 3 · THE VARIABLE EACH METHOD ESTIMATED, against the true batch ===");
console.log("|correlation| with the batch label, which neither method is told");
console.log();
console.log([pad("confounding", 12), rpad("SVA", 12), rpad("RUV", 12)].join(" | "));
console.log("-".repeat(42));
for (const overlap of OV) {
  const row = ["sva", "ruv"].map((k) => {
    const v = SEEDS.map((seed) => {
      const sim = simulate({ seed, overlap });
      return alignment(estimatedVariable(sim, k), sim.batch.map((b) => b === 1));
    });
    return rpad(f(mean(v)), 12);
  });
  console.log([rpad(overlap.toFixed(2), 12), ...row].join(" | "));
}
console.log();
console.log("  -> SVA residualises the condition away first, so the part of the batch that");
console.log("     correlates with the condition goes with it. RUV reads the batch off");
console.log("     control genes, which carry it whatever the design does.");

/* ==== 4 · RUV is only as good as its control genes ======================== */
console.log();
console.log("=== 4 · RUV DEPENDS ENTIRELY ON WHICH GENES YOU CALL CONTROLS ===");
console.log(`estimated effect, overlap 0.5, truth ${TRUE_EFFECT}`);
console.log();
for (const key of Object.keys(CONTROL_SETS)) {
  const v = SEEDS.map((seed) =>
    estimateWithSE(simulate({ seed, overlap: 0.5 }), "ruv", { controls: key }).beta);
  console.log(" ", pad(CONTROL_SETS[key].label, 16), rpad(f(mean(v)), 8),
    ` ${CONTROL_SETS[key].detail}`);
}

/* ==== 5 · what each method leaves on the screen =========================== */
console.log();
console.log("=== 5 · AND WHAT THE PICTURE SHOWS, on the observed data's axes ===");
console.log("separation along PC1, overlap 0.75, batch shift 2, seed 1");
console.log();
{
  const sim = simulate({ seed: 1, overlap: 0.75 });
  const mats = { truth: withoutBatch(sim) };
  for (const [k, opts, name] of COLS) mats[name] = applyMethod(sim, k, opts);
  const { points } = projectOnto(sim, mats);
  console.log([pad("panel", 14), rpad("by batch", 10), rpad("by condition", 14)].join(" | "));
  console.log("-".repeat(42));
  for (const k of ["truth", ...COLS.map(([, , n]) => n)]) {
    const xs = points[k].map((p) => p[0]);
    console.log([pad(k === "truth" ? "ground truth" : k, 14),
      rpad(f(separation(xs, sim.batch.map((b) => b === 1)), 2), 10),
      rpad(f(separation(xs, sim.disease), 2), 14)].join(" | "));
  }
}
console.log();
console.log(`  -> ${GENES} genes x ${SAMPLES} samples, ${AFFECTED} carrying an effect.`);
console.log("     SVA's row is identical to None's, because it never edits the matrix.");
console.log();
