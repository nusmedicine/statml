/* ============================================================================
   The numbers behind slot 4, `hierarchical-clustering`, computed by the engine
   that will ship rather than by the R script that first found them.

     node widgets/_lab/hc-measure.mjs

   The claim was measured in R (see the catalogue). This re-measures it through
   `model.js` and its mulberry32 stream, because a number established in one
   generator and quoted about another is one draw from a possibly unseeded
   model — the standing rule in HANDOVER. The two agree to within sampling
   noise at 400 seeds; where they do not, THIS file is the one the widget's
   captions must match.
   ========================================================================= */

import {
  stage, pointVectors, cluster, cut, gapAt, canonical, N_POINTS, DISTANCES,
} from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

const OFFERED = ["average", "complete", "ward.D2"];
const RUNS = 400;

function pct(x) { return `${(100 * x).toFixed(0)}%`.padStart(4); }
function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/* -------------------------------------------------------------------------
   THE SEPARATION SWEEP — the table the widget's own claim rests on.
   ---------------------------------------------------------------------- */
console.log(`\n=== the separation sweep — ${RUNS} seeds per row, n = ${N_POINTS} ===\n`);
console.log("            ward   3 agree  ward finds  cut looks   ward's k=2");
console.log("  sep        gap    on k=2   the truth   balanced    sizes (median)");

const sweep = [];
for (const separation of [0, 0.5, 1, 1.5, 2, 2.5, 3, 4]) {
  const gaps = [];
  let agree = 0;
  let truth = 0;
  let balanced = 0;
  const minSizes = [];

  for (let seed = 1; seed <= RUNS; seed += 1) {
    const pts = stage({ separation }, makeRng(seed));
    const trees = OFFERED.map((m) => cluster(pointVectors(pts), m));
    const cuts = trees.map((t) => canonical(cut(t, 2)));
    if (cuts.every((c) => c === cuts[0])) agree += 1;

    const ward = trees[2];
    const lab = cut(ward, 2);
    // Did it recover the planted groups? Label-invariant.
    const planted = pts.map((p) => p.group);
    const hit = lab.filter((l, i) => (l === 1) === (planted[i] === 0)).length;
    if (hit === N_POINTS || hit === 0) truth += 1;

    const a = lab.filter((l) => l === 1).length;
    const small = Math.min(a, N_POINTS - a);
    minSizes.push(small);
    if (small >= N_POINTS * 0.35) balanced += 1;

    gaps.push(gapAt(ward, 2));
  }

  gaps.sort((x, y) => x - y);
  minSizes.sort((x, y) => x - y);
  const medMin = quantile(minSizes, 0.5);
  sweep.push({ separation, gap: quantile(gaps, 0.5), agree: agree / RUNS });
  console.log(
    `  ${separation.toFixed(1).padStart(3)}   ${quantile(gaps, 0.5).toFixed(2).padStart(8)}` +
    `   ${pct(agree / RUNS)}      ${pct(truth / RUNS)}      ${pct(balanced / RUNS)}` +
    `        ${medMin}/${N_POINTS - medMin}`
  );
}

/* -------------------------------------------------------------------------
   THE DIAGNOSTIC — does the height gap separate real groups from noise?
   ---------------------------------------------------------------------- */
console.log(`\n=== the gap as a diagnostic — PER LINKAGE AND DISTANCE, ${RUNS} seeds each ===\n`);
console.log("The widget prints the gap beside what real groups score. That reference");
console.log("range is NOT one number and NOT one per linkage: Manhattan is a different");
console.log("metric, not a rescaling of Euclidean, so it moves the ratio too. Quoting");
console.log("one combination's range under another is a false claim on the figure.");
console.log("These are the numbers `GAP_REFERENCE` in main.js must carry.\n");
console.log("  linkage    distance    real groups (sep 3)      pure noise (sep 0)    overlap");

for (const method of OFFERED) {
  for (const distance of Object.keys(DISTANCES)) {
    const real = [];
    const fake = [];
    for (let seed = 1; seed <= RUNS; seed += 1) {
      real.push(gapAt(cluster(pointVectors(stage({ separation: 3 }, makeRng(seed))), method, distance), 2));
      fake.push(gapAt(cluster(pointVectors(stage({ separation: 0 }, makeRng(seed))), method, distance), 2));
    }
    real.sort((a, b) => a - b);
    fake.sort((a, b) => a - b);
    const overlap = fake.filter((f) => f > quantile(real, 0.1)).length / RUNS;
    console.log(
      `  ${method.padEnd(9)}  ${distance.padEnd(10)}  ${quantile(real, 0.5).toFixed(2)}` +
      ` [${quantile(real, 0.1).toFixed(2)} .. ${quantile(real, 0.9).toFixed(2)}]` +
      `      ${quantile(fake, 0.5).toFixed(2)}` +
      ` [${quantile(fake, 0.1).toFixed(2)} .. ${quantile(fake, 0.9).toFixed(2)}]` +
      `    ${pct(overlap)}`
    );
  }
}

/* -------------------------------------------------------------------------
   THE SEED TO OPEN ON. The widget must not open on its own answer
   (non-negotiable 4), but it does have to open on a stage that carries the
   argument. These are the noise seeds whose cut looks most convincing —
   balanced AND high-gap — which is the picture the reader has to be able to
   be taken in by before the gap is any use to them.
   ---------------------------------------------------------------------- */
console.log("\n=== noise seeds whose k=2 cut looks most convincing ===\n");
const cands = [];
for (let seed = 1; seed <= 200; seed += 1) {
  const pts = stage({ separation: 0 }, makeRng(seed));
  const ward = cluster(pointVectors(pts), "ward.D2");
  const lab = cut(ward, 2);
  const a = lab.filter((l) => l === 1).length;
  const small = Math.min(a, N_POINTS - a);
  const g = gapAt(ward, 2);
  const cuts = OFFERED.map((m) => canonical(cut(cluster(pointVectors(pts), m), 2)));
  if (small >= 8 && g >= 2.0) {
    cands.push({ seed, sizes: `${small}/${N_POINTS - small}`, gap: g,
                 agree: cuts.every((c) => c === cuts[0]) });
  }
}
cands.sort((a, b) => b.gap - a.gap);
for (const c of cands.slice(0, 8)) {
  console.log(`  seed ${String(c.seed).padStart(3)}: ${c.sizes}  gap ${c.gap.toFixed(2)}` +
              `  all three linkages agree: ${c.agree}`);
}
console.log(`  ${cands.length} of 200 noise seeds are both balanced and high-gap`);
console.log("");
