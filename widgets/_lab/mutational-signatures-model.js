/* ============================================================================
   Slot 70 `mutational-signatures` — the planning model, now the widget's.

   Until the draft (2026-09-19) this file WAS the model: the look-alike
   references, the simulated cohort and the KL extraction the mock and the
   measure drew from. It moved to `widgets/mutational-signatures/model.js`, and
   this file re-exports it, so `_lab/mutational-signatures-measure.mjs` and
   `_lab/mutational-signatures-mock.html` run the widget's own code (widget 41's
   rule, and 69's `_lab/driver-genes-model.js`).

   One helper stays here because only the mock uses it: § 1's standalone tumor
   of 1,302 substitutions, the arm Kenneth did not pick (the widget draws two of
   the cohort's tumors instead, `tumorFor`).
   ========================================================================= */

export * from "../mutational-signatures/model.js";
import { PLANTED, plantedProfile, CLASSES, PURINE_FORM, sum } from "../mutational-signatures/model.js";

/* One tumor, each mutation drawn in its pyrimidine channel and then written on
   one strand or the other at even odds. */
export function drawTumour(rng, n, weights) {
  const keys = Object.keys(weights);
  const mix = new Float64Array(96);
  const ws = sum(Object.values(weights));
  for (const k of keys) {
    const p = PLANTED.find((q) => q.key === k);
    plantedProfile(p).forEach((x, c) => { mix[c] += (weights[k] / ws) * x; });
  }
  const cdf = [];
  let acc = 0;
  for (const x of mix) { acc += x; cdf.push(acc); }
  const mutations = [];
  const counts = new Float64Array(96);
  for (let m = 0; m < n; m += 1) {
    const u = rng.next() * acc;
    let c = 0;
    while (cdf[c] < u) c += 1;
    const cls = CLASSES[c >> 4];
    const purine = rng.next() < 0.5;
    mutations.push({ index: c, cls, written: purine ? PURINE_FORM[cls] : cls, purine });
    counts[c] += 1;
  }
  return { mutations, counts, mix };
}
