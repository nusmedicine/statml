/* Planning measurements for widget 41 `nmf`, on the SIMULATED stage.

   `nmf-measure.mjs` measures the lesson's own airway matrix, which has no
   answer key. This one measures a stage whose truth is known, and answers the
   questions the widget's design turns on:

     1. does NMF recover parts that were really there;
     2. how far does the seed move the answer, at a fit that does not move;
     3. what does PCA return on the same matrix, and how is it different;
     4. how many samples and genes does the stage need for any of it to hold.

   Run:  node widgets/_lab/nmf-sim.mjs
*/

import { makeStage, nmf, pca, matchTruth, groupSep, cosine, col } from "./nmf-model.js";

const f2 = (v) => v.toFixed(2).padStart(6);
const f3 = (v) => v.toFixed(3).padStart(6);

/* --- 1. does it recover the parts? --------------------------------------- */
console.log("=== 1. rank 2 on a stage with two real programmes ===");
const st = makeStage({ seed: 1 });
console.log(`  ${st.genes} genes x ${st.samples} samples, block of ${st.block} per programme,`);
console.log(`  a third block shared. Groups: ${st.label.join("")}`);
const fit = nmf(st.V, 2, 1);
const m = matchTruth(fit.W, st.Wtrue);
console.log(`  relative residual ${fit.trace.at(-1).toFixed(4)}`);
console.log(`  W vs the truth: worst matched part cosine ${m.score.toFixed(4)}` +
  `${m.swapped ? "  (parts came out swapped)" : ""}`);
console.log(`  H row 1: ${fit.H[0].map(f2).join("")}`);
console.log(`  H row 2: ${fit.H[1].map(f2).join("")}`);
console.log(`  group separation: part 1 ${groupSep(fit.H[0], st.label).toFixed(2)}` +
  `   part 2 ${groupSep(fit.H[1], st.label).toFixed(2)}`);

/* --- 2. the seed ---------------------------------------------------------
   THE HEADLINE MEASUREMENT. On the airway matrix the residual moves 0.65%
   across twelve seeds while the treatment separation moves 0.68 to 4.21. If
   this stage does not reproduce that, it is the wrong stage. */
console.log("\n=== 2. twelve seeds, same data, same rank ===");
const runs = [];
for (let s = 1; s <= 12; s += 1) {
  const f = nmf(st.V, 2, s);
  runs.push({
    s, rel: f.trace.at(-1), W: f.W,
    truth: matchTruth(f.W, st.Wtrue).score,
    sep: Math.max(Math.abs(groupSep(f.H[0], st.label)), Math.abs(groupSep(f.H[1], st.label))),
  });
}
console.log("  seed   residual   truth-match   best group separation");
for (const r of runs)
  console.log(`  ${String(r.s).padStart(4)}  ${r.rel.toFixed(5)}      ${f3(r.truth)}        ${f2(r.sep)}`);
const rels = runs.map((r) => r.rel);
console.log(`  residual spread: ${(100 * (Math.max(...rels) - Math.min(...rels)) / Math.min(...rels)).toFixed(2)}%`);
let worst = 1;
for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) {
  const same = Math.min(cosine(col(runs[i].W, 0), col(runs[j].W, 0)), cosine(col(runs[i].W, 1), col(runs[j].W, 1)));
  const swap = Math.min(cosine(col(runs[i].W, 0), col(runs[j].W, 1)), cosine(col(runs[i].W, 1), col(runs[j].W, 0)));
  worst = Math.min(worst, Math.max(same, swap));
}
console.log(`  worst cosine between any two seeds: ${worst.toFixed(4)}`);

/* --- 3. what PCA returns on the same matrix ------------------------------ */
console.log("\n=== 3. PCA on the same matrix ===");
const pcs = pca(st.V);
for (let k = 0; k < 3; k += 1) {
  const neg = pcs[k].load.filter((v) => v < 0).length;
  console.log(`  PC${k + 1}  ${(100 * pcs[k].share).toFixed(1)}% of variance` +
    `   group separation ${f2(groupSep(pcs[k].scores, st.label))}` +
    `   negative loadings ${neg}/${st.genes}`);
}
const nmfNeg = fit.W.flat().filter((v) => v < 0).length;
console.log(`  NMF: negative entries in W: ${nmfNeg}/${st.genes * 2}  (cannot be otherwise)`);
console.log(`  PC1 . PC2 (orthogonality): ${cosine(pcs[0].load, pcs[1].load).toExponential(1)}`);
console.log(`  part 1 . part 2:            ${cosine(col(fit.W, 0), col(fit.W, 1)).toFixed(3)}`);

/* --- 4. how small can the stage be? --------------------------------------
   The widget has to draw every gene and every sample. If 24 x 12 is needed for
   the seed to matter, the heatmap is 288 cells; if 12 x 8 will do, it is 96. */
console.log("\n=== 4. stage size: does the seed still move the answer? ===");
console.log("  genes  samples   residual spread   truth-match range   separation range");
for (const [genes, samples] of [[12, 8], [15, 10], [18, 12], [24, 12], [30, 16], [24, 20]]) {
  const s0 = makeStage({ genes, samples, seed: 1 });
  const rr = [];
  for (let s = 1; s <= 12; s += 1) {
    const f = nmf(s0.V, 2, s);
    rr.push({
      rel: f.trace.at(-1),
      truth: matchTruth(f.W, s0.Wtrue).score,
      sep: Math.max(Math.abs(groupSep(f.H[0], s0.label)), Math.abs(groupSep(f.H[1], s0.label))),
    });
  }
  const R = rr.map((x) => x.rel), T = rr.map((x) => x.truth), S = rr.map((x) => x.sep);
  console.log(`  ${String(genes).padStart(5)}  ${String(samples).padStart(7)}` +
    `   ${(100 * (Math.max(...R) - Math.min(...R)) / Math.min(...R)).toFixed(2).padStart(13)}%` +
    `   ${f3(Math.min(...T))}-${f3(Math.max(...T))}` +
    `   ${f2(Math.min(...S))}-${f2(Math.max(...S))}`);
}

/* --- 5. the noise dial ---------------------------------------------------
   Non-uniqueness is not a fixed fact about NMF: it depends on whether the data
   reaches the corners of the cone the parts span. `share` is how much of each
   programme every sample carries, and it is exactly that knob. */
console.log("\n=== 5. the shared block: does non-uniqueness switch on and off? ===");
console.log("  share   truth-match range   worst seed-to-seed cosine");
for (const share of [0.05, 0.15, 0.25, 0.4, 0.6]) {
  const s0 = makeStage({ share, seed: 1 });
  const W = [], T = [];
  for (let s = 1; s <= 8; s += 1) {
    const f = nmf(s0.V, 2, s);
    W.push(f.W); T.push(matchTruth(f.W, s0.Wtrue).score);
  }
  let w = 1;
  for (let i = 0; i < W.length; i += 1) for (let j = i + 1; j < W.length; j += 1) {
    const same = Math.min(cosine(col(W[i], 0), col(W[j], 0)), cosine(col(W[i], 1), col(W[j], 1)));
    const swap = Math.min(cosine(col(W[i], 0), col(W[j], 1)), cosine(col(W[i], 1), col(W[j], 0)));
    w = Math.min(w, Math.max(same, swap));
  }
  console.log(`  ${share.toFixed(2)}    ${f3(Math.min(...T))}-${f3(Math.max(...T))}          ${w.toFixed(4)}`);
}
