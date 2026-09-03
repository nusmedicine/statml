/* ============================================================================
   Can the Heatmap tab carry the same argument as the Cluster tab?

     node widgets/_lab/hc-lift.mjs

   The Cluster tab has a dial for how much structure is really there, and its
   whole point is that at "None" the cut still answers. The Heatmap tab has no
   such dial, so it only ever shows the method WORKING — which is the half of
   the lesson that needs no widget.

   `heatStage` already takes `lift`: the amount added to the four planted gene
   blocks (the notebook's own is 2). This measures what the matrix does as that
   falls to nothing, and whether the readout stays honest when it does.
   ========================================================================= */

import {
  heatStage, cluster, cut, noiseBoxes, canonical,
  HEAT_GENES, HEAT_SAMPLES, HEAT_PLANTED,
} from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

const RUNS = 60;
const pct = (x) => `${Math.round(100 * x)}%`.padStart(4);

console.log("\n=== the matrix as the planted effect falls away ===\n");
console.log("cutree_rows = 5, cutree_cols = 2, ward.D2, euclidean. 60 seeds per row.\n");
console.log("  lift   blocks kept whole   noise genes in       columns recover     row boxes");
console.log("         (of 4)              one box              the 2 conditions    that are pure noise");

for (const lift of [2, 1.5, 1, 0.5, 0]) {
  let whole = 0;
  let together = 0;
  let recover = 0;
  let pureBoxes = 0;

  for (let seed = 1; seed <= RUNS; seed += 1) {
    const heat = heatStage({ lift }, makeRng(seed));
    const rowTree = cluster(heat.rows, "ward.D2");
    const colTree = cluster(heat.cols, "ward.D2");
    const rowLab = cut(rowTree, 5);
    const colLab = cut(colTree, 2);

    // the four planted blocks, by construction: genes 0-9, 10-19, 20-29, 30-39
    /* By label, not by index: the generator shuffles both axes. */
    const of = (b) => rowLab.filter((_, g) => heat.planted[g] === b);
    whole += [0, 1, 2, 3].filter((b) => new Set(of(b)).size === 1).length / 4;
    together += new Set(rowLab.filter((_, g) => heat.planted[g] === null)).size === 1 ? 1 : 0;
    recover += canonical(colLab) === canonical(heat.condition) ? 1 : 0;
    pureBoxes += noiseBoxes(rowLab, heat.planted).length;
  }

  console.log(
    `  ${String(lift).padEnd(5)}  ${pct(whole / RUNS)}               ${pct(together / RUNS)}` +
    `                 ${pct(recover / RUNS)}                ${(pureBoxes / RUNS).toFixed(1)} of 5`
  );
}

/* -------------------------------------------------------------------------
   THE HONESTY PROBLEM this would create.

   `planted` is derived from the gene's INDEX — genes 0-39 are "planted" and
   40-49 are not — which is true at lift 2 and a lie at lift 0, where nothing
   was added to any of them. The readout counts boxes against `planted`, so at
   lift 0 it would report "0 of 5 boxes hold no structure" over a matrix that
   is nothing but noise. Exactly backwards, and the kind of wrong-but-finite
   number no NaN sweep would catch.
   ---------------------------------------------------------------------- */
console.log("\n=== what the readout WOULD say at lift 0, as the model stands ===\n");
{
  const heat = heatStage({ lift: 0 }, makeRng(1));
  const rowTree = cluster(heat.rows, "ward.D2");
  const rowLab = cut(rowTree, 5);
  const empty = noiseBoxes(rowLab, heat.planted);
  const structured = heat.planted.filter((p) => p !== null).length;
  console.log(`  genes the model still calls planted: ${structured} of ${HEAT_GENES}`);
  console.log(`  boxes it would report as holding no structure: ${empty.length} of 5`);
  console.log("  ...over a matrix with NOTHING added to any gene.");
  console.log("\n  => `planted` has to follow `lift`, or the tab lies at the one");
  console.log("     setting the whole argument depends on.");
}

console.log("\n=== and the column side ===\n");
{
  for (const lift of [2, 1, 0]) {
    const heat = heatStage({ lift }, makeRng(1));
    const colTree = cluster(heat.cols, "ward.D2");
    for (const cc of [2, 4]) {
      const lab = cut(colTree, cc);
      const sizes = Object.values(lab.reduce((a, l) => { a[l] = (a[l] || 0) + 1; return a; }, {}))
        .sort((a, b) => b - a).join("/");
      console.log(`  lift ${lift}  cutree_cols=${cc}: sizes ${sizes}` +
        `  — it returns ${cc} groups of ${HEAT_SAMPLES} samples either way`);
    }
  }
}
console.log("");
