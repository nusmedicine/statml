/* ============================================================================
   How small can the matrix get and still make its point?

     node widgets/_lab/hc-size.mjs

   Fifty gene rows over ~300px is six pixels each, and the gene distance matrix
   is 50 x 50 in a 185px square — under four pixels a cell. Both are too small
   to read, which is a legibility problem, not a statistical one. The question
   is what the matrix still does as it shrinks:

     - do the four planted blocks survive a cut into five?
     - do the unstructured genes still gather into one box of their own?
     - does the column side still recover the two conditions?

   The last row of each block is what the act depends on: the box drawn round
   genes that had nothing added to them.
   ========================================================================= */

import { heatStage, cluster, cut, noiseBoxes, canonical, HEAT_SAMPLES } from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

const RUNS = 80;
const pct = (x) => `${Math.round(100 * x)}%`.padStart(4);

/* Widget geometry, so the pixel columns are the real ones. The matrix panel is
   roughly 300px tall on the heatmap tab and the distance square is 250px. */
const MATRIX_H = 300;
const DIST_PX = 250;

console.log("\n=== what survives at each size, lift 2, ward.D2, cutree_rows 5 ===\n");
console.log("  genes  layout        row px  gene-dist  blocks whole  noise in    columns");
console.log("                        (of 300)  cell px    (of 4)     one box    recover");

const SIZES = [
  { perBlock: 10, noise: 10 },   // the notebook's own: 50
  { perBlock: 8, noise: 8 },     // 40
  { perBlock: 6, noise: 6 },     // 30
  { perBlock: 5, noise: 5 },     // 25
  { perBlock: 4, noise: 4 },     // 20
  { perBlock: 3, noise: 3 },     // 15
];

for (const { perBlock, noise } of SIZES) {
  const genes = 4 * perBlock + noise;
  let whole = 0;
  let together = 0;
  let recover = 0;

  for (let seed = 1; seed <= RUNS; seed += 1) {
    const heat = heatStage({ perBlock, noise }, makeRng(seed));
    const rowLab = cut(cluster(heat.rows, "ward.D2"), 5);
    const colLab = cut(cluster(heat.cols, "ward.D2"), 2);
    /* The generator shuffles, so a block is the genes carrying its label —
       not a slice of consecutive indices. */
    const of = (b) => rowLab.filter((_, g) => heat.planted[g] === b);
    whole += [0, 1, 2, 3].filter((b) => new Set(of(b)).size === 1).length / 4;
    together += new Set(rowLab.filter((_, g) => heat.planted[g] === null)).size === 1 ? 1 : 0;
    recover += canonical(colLab) === canonical(heat.condition) ? 1 : 0;
  }

  console.log(
    `  ${String(genes).padStart(5)}  4x${perBlock} + ${String(noise).padEnd(2)} noise` +
    `  ${(MATRIX_H / genes).toFixed(1).padStart(6)}  ${(DIST_PX / genes).toFixed(1).padStart(8)}` +
    `  ${pct(whole / RUNS)}         ${pct(together / RUNS)}       ${pct(recover / RUNS)}`
  );
}

/* -------------------------------------------------------------------------
   The act depends on `cutree_rows = 5` producing a box that is nothing but
   unstructured genes. Below, how often that box exists at each size, and how
   many genes are in it.
   ---------------------------------------------------------------------- */
console.log("\n=== the box around nothing, at cutree_rows 5 ===\n");
console.log("  genes   a pure-noise box exists   its median size");
for (const { perBlock, noise } of SIZES) {
  const genes = 4 * perBlock + noise;
  let exists = 0;
  const sizes = [];
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const heat = heatStage({ perBlock, noise }, makeRng(seed));
    const boxes = noiseBoxes(cut(cluster(heat.rows, "ward.D2"), 5), heat.planted);
    if (boxes.length) { exists += 1; sizes.push(boxes.reduce((a, b) => a + b.size, 0)); }
  }
  sizes.sort((a, b) => a - b);
  console.log(
    `  ${String(genes).padStart(5)}   ${pct(exists / RUNS)}` +
    `                    ${sizes.length ? sizes[Math.floor(sizes.length / 2)] : "—"} of ${noise}`
  );
}

/* -------------------------------------------------------------------------
   And the same at lift 0, where the whole matrix is noise: EVERY box should
   be a noise box, at every size. If this ever drops below 5 of 5 the readout
   has stopped telling the truth at the setting the argument depends on.
   ---------------------------------------------------------------------- */
console.log("\n=== at lift 0 (nothing planted), every box must be a noise box ===\n");
for (const { perBlock, noise } of SIZES) {
  const genes = 4 * perBlock + noise;
  let allFive = 0;
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const heat = heatStage({ perBlock, noise, lift: 0 }, makeRng(seed));
    const boxes = noiseBoxes(cut(cluster(heat.rows, "ward.D2"), 5), heat.planted);
    if (boxes.length === 5) allFive += 1;
  }
  console.log(`  ${String(genes).padStart(5)} genes: 5 of 5 boxes reported as noise in ${pct(allFive / RUNS)} of runs`);
}

console.log(`\n(samples are fixed at ${HEAT_SAMPLES}; the sample distance matrix is`
  + ` ${HEAT_SAMPLES} x ${HEAT_SAMPLES} = ${(DIST_PX / HEAT_SAMPLES).toFixed(1)}px a cell at ${DIST_PX}px)\n`);
