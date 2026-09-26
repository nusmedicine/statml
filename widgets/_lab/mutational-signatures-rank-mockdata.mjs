/* Writes the round-5 mock's data: seed 1, the hypermutated tumour out and in,
 * ranks 2–8 — each rank's ten runs' labels, cophenetic correlation, best KL
 * and the hclust leaf order — as the widget's own engine computes them.
 *   node widgets/_lab/mutational-signatures-rank-mockdata.mjs > widgets/_lab/mutational-signatures-rank-mock.json
 */
import * as M from "./mutational-signatures-model.js";
import { estimateRank } from "./mutational-signatures-estimate.js";
const seed = 1, out = { seed, ranks: [2, 3, 4, 5, 6, 7, 8] };
for (const hyper of ["out", "in"]) {
  const co = M.cohortFor(seed);
  const cols = hyper === "out" ? co.hyperIndex : co.hyperIndex + 1;
  const Mat = co.M.map((row) => row.slice(0, cols));
  out[hyper] = { counts: co.counts.slice(0, cols), hyperIndex: hyper === "in" ? co.hyperIndex : -1, ranks: {} };
  for (const r of out.ranks) {
    const e = estimateRank(Mat, r, seed);
    out[hyper].ranks[r] = { coph: +e.coph.toFixed(4), kl: +e.kl.toFixed(1), order: e.order, labels: e.labels.map((l) => Array.from(l).join("")) };
  }
}
console.log(JSON.stringify(out));
