/* ============================================================================
   Widget 45 · hmm — measure the engine before the figure is designed.

     node widgets/_lab/hmm-measure.mjs

   §1  one seeded instance, printed: the truth's copying path against Viterbi
   §2  every posterior row sums to 1; stage 0 is uniform
   §3  imputation accuracy at untyped sites, HMM against the allele-frequency
       fill, over 400 seeds, by switch rate rho — the stage where each end of
       the rho dial must be seen to lose (rho -> 0.5 is memoryless, rho -> 0
       forbids the recombination the sample has)
   §4  the same by array density, at the default rho
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import * as M from "../hmm/model.js";

const pct = (a, b) => `${(100 * a / b).toFixed(1)}%`;
const SEEDS = 400;

function sweep(opts) {
  let c = 0, f = 0, u = 0, s = 0, v = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const R = M.build({ rng: makeRng(seed), ...opts });
    const z = R.stages.at(-1);
    c += z.correct; f += z.freqCorrect; u += z.untyped; s += z.sure;
    for (let i = 0; i < R.L; i += 1) if (!z.sites[i].typed && z.sites[i].viterbi === R.sample.allele[i]) v += 1;
  }
  return { hmm: pct(c, u), viterbi: pct(v, u), freq: pct(f, u), sure: pct(s, u), untyped: u / SEEDS };
}

console.log("§1  seed 1, K 6, 1 in 4 typed, 2 switches, rho 0.1");
const S = M.build({ rng: makeRng(1), K: 6, every: 4, switches: 2, rho: 0.1 });
const last = S.stages.at(-1);
console.log("  typed", S.typed.length, "untyped", last.untyped, "correct", last.correct,
  "freq", last.freqCorrect, "sure", last.sure);
console.log("  truth src ", S.sample.src.join(""));
console.log("  viterbi   ", last.path.join(""));
console.log("  cuts", S.sample.cutSites.join(","), " novel",
  S.sample.novel.map((n, i) => (n ? i : null)).filter((i) => i !== null).join(","));

console.log("\n§2  posterior rows");
let off = 0, n = 0;
for (let seed = 1; seed <= 50; seed += 1) {
  const R = M.build({ rng: makeRng(seed), K: 6, every: 4, switches: 2, rho: 0.1 });
  for (const st of R.stages) for (const g of st.gamma) { n += 1; if (Math.abs(g.reduce((a, b) => a + b, 0) - 1) > 1e-9) off += 1; }
}
const u0 = S.stages[0].gamma.every((g) => g.every((x) => Math.abs(x - 1 / 6) < 1e-12));
console.log(`  ${n} rows, ${off} off 1;  stage 0 uniform: ${u0}`);

console.log("\n§3  by rho — K 6, 1 in 4 typed, 2 switches, 400 seeds");
console.log("  rho    hmm(post)  viterbi  freq-fill  sure(>=0.9)");
for (const rho of [0.005, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5]) {
  const r = sweep({ K: 6, every: 4, switches: 2, rho });
  console.log(`  ${String(rho).padEnd(6)} ${r.hmm.padStart(8)} ${r.viterbi.padStart(8)} ${r.freq.padStart(9)} ${r.sure.padStart(10)}`);
}

console.log("\n§4  by density — K 6, 2 switches, rho 0.1");
console.log("  1 in   untyped  hmm(post)  freq-fill  sure");
for (const every of [2, 3, 4, 6, 9]) {
  const r = sweep({ K: 6, every, switches: 2, rho: 0.1 });
  console.log(`  ${String(every).padEnd(6)} ${String(r.untyped).padStart(6)} ${r.hmm.padStart(9)} ${r.freq.padStart(9)} ${r.sure.padStart(6)}`);
}

console.log("\n§5  by panel size — 1 in 4, 2 switches, rho 0.1");
console.log("  K      hmm(post)  freq-fill  sure");
for (const K of [2, 3, 4, 6, 8, 12]) {
  const r = sweep({ K, every: 4, switches: 2, rho: 0.1 });
  console.log(`  ${String(K).padEnd(6)} ${r.hmm.padStart(9)} ${r.freq.padStart(9)} ${r.sure.padStart(6)}`);
}

console.log("\n§6  by true switches — K 6, 1 in 4, rho 0.1");
console.log("  sw     hmm(post)  freq-fill  sure");
for (const switches of [0, 1, 2, 3, 4]) {
  const r = sweep({ K: 6, every: 4, switches, rho: 0.1 });
  console.log(`  ${String(switches).padEnd(6)} ${r.hmm.padStart(9)} ${r.freq.padStart(9)} ${r.sure.padStart(6)}`);
}
