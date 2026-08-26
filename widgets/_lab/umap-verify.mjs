/* ============================================================================
   Compare widgets/umap/model.js — the SHIPPING module — against umap-learn 0.5.12, through umap-ref.json.

   The pattern is tsne-verify.mjs's, which is what proved widget 21's engine:
   pull a table out of the library, compare against it, and SET THE TOLERANCE BY
   MEASURING WHERE AGREEMENT BOTTOMS OUT rather than by what passes.

   THE RESIDUAL IS THE LIBRARY'S, AND IT WAS DIAGNOSED RATHER THAN ABSORBED.
   The first run of this script reported rho off by 5.2e-8 everywhere, which
   looked like a distance-computation difference — sklearn's kneighbors uses the
   cancelling |x|^2 + |y|^2 - 2x.y form, and that was the obvious suspect. It is
   not: sklearn's distances agree with the direct sum of squares EXACTLY (0.0e0
   over both cases checked). What is actually happening is that umap-learn
   declares `rho` and `result` as np.float32 inside `smooth_knn_dist`, so the
   library rounds regardless of the dtype it is handed. The evidence is not a
   plausible story but a bit pattern: 200 of 200 rho values across five cases
   satisfy `Math.fround(js) === lib` EXACTLY. So this script compares at float32
   and asserts the exact equality, which is a stronger check than any tolerance.

   The one sigma that does not match bit-for-bit is the bisection's own stopping
   tolerance, also measured: at seed 1, point 40, the two sigmas differ by
   3.5e-6 relative and BOTH land inside umap-learn's SMOOTH_K_TOLERANCE of 1e-5
   on the row sum (js 3.90688992 against lib 3.90690118, target 3.90689060).
   Two legal stopping points of the same bisection, not two answers.

   Run: node widgets/_lab/umap-verify.mjs
   Regenerate the table first with widgets/_lab/umap-ref.py if the stage moves.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { knn, smoothKnnDist, fuzzySet, findAbParams, umap } from "../umap/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(join(here, "umap-ref.json"), "utf8"));
const f32 = Math.fround;
const fmt = (x) => (x === 0 ? "0" : x.toExponential(1));
let fails = 0;
const check = (name, got, tol) => {
  const ok = got <= tol;
  if (!ok) fails += 1;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name.padEnd(48)} ${fmt(got)}  (tol ${fmt(tol)})`);
};

console.log(`umap-learn ${ref.umap_learn}, numpy ${ref.numpy}\n`);

/* --- a and b, fitted from min_dist ------------------------------------------
   Gauss-Newton here against scipy's Levenberg-Marquardt there. Worst relative
   error measured at 4.7e-6 over twelve min_dist values, so the tolerance is
   1e-5 — one order above what the fit actually achieves. */
console.log("a and b, fitted from min_dist:");
let abWorst = 0;
for (const row of ref.ab) {
  const { a, b } = findAbParams(row.spread, row.min_dist);
  abWorst = Math.max(abWorst, Math.abs(a - row.a) / row.a, Math.abs(b - row.b) / row.b);
}
console.log(`  ${ref.ab.length} values of min_dist, 0.0 to 0.99`);
check("worst relative error in a or b", abWorst, 1e-5);

/* --- rho, sigma and mu ------------------------------------------------------ */
console.log("\nthe fuzzy simplicial set — compared at float32, which is the");
console.log("dtype umap-learn computes rho and sigma in:\n");
let rhoExact = 0, rhoTotal = 0, sigExact = 0, sigTotal = 0, sigRel = 0, muAbs = 0, muRel = 0;
for (const c of ref.cases) {
  const n = c.X.length;
  const { dist } = knn(c.X, c.k);
  const { rho, sigma } = smoothKnnDist(dist, c.k);
  const { mu } = fuzzySet(c.X, c.k);
  let re = 0, se = 0, sr = 0, ma = 0, mr = 0;
  for (let i = 0; i < n; i += 1) {
    if (f32(rho[i]) === c.rho[i]) re += 1;
    if (f32(sigma[i]) === c.sigma[i]) se += 1;
    sr = Math.max(sr, Math.abs(sigma[i] / c.sigma[i] - 1));
    for (let j = 0; j < n; j += 1) {
      const d = Math.abs(f32(mu[i][j]) - c.mu[i][j]);
      ma = Math.max(ma, d);
      if (c.mu[i][j] > 1e-6) mr = Math.max(mr, d / c.mu[i][j]);
    }
  }
  console.log(`  seed ${c.seed}, n = ${String(n).padStart(2)}, n_neighbors = ${String(c.k).padStart(2)}:` +
    `  rho ${re}/${n} bit-exact,  sigma ${se}/${n} bit-exact (worst rel ${fmt(sr)}),` +
    `  mu worst ${fmt(ma)} abs / ${fmt(mr)} rel`);
  rhoExact += re; rhoTotal += n; sigExact += se; sigTotal += n;
  sigRel = Math.max(sigRel, sr); muAbs = Math.max(muAbs, ma); muRel = Math.max(muRel, mr);
}
console.log("");
check(`rho NOT bit-exact at float32 (of ${rhoTotal})`, rhoTotal - rhoExact, 0);
check(`sigma NOT bit-exact at float32 (of ${sigTotal})`, sigTotal - sigExact, 1);
/* the library's own SMOOTH_K_TOLERANCE is 1e-5 on the row sum; the one sigma
   that is not bit-exact differs by 3.5e-6 relative, inside it. */
check("worst relative sigma difference", sigRel, 1e-5);
/* mu compounds float32 through an exp with a small sigma, so it is looser than
   float32 eps: 1.4e-5 absolute at n_neighbors = 3, which is where sigma is
   smallest. 5e-5 is one order above the worst measured. */
check("worst |mu| difference, absolute", muAbs, 5e-5);
check("worst |mu| difference, relative", muRel, 5e-5);

/* --- the descent ------------------------------------------------------------
   NOT a coordinate comparison, and it must not become one: the library
   optimises by stochastic edge sampling with negative samples, this runs the
   exact full-batch gradient, and at n = 48 those are different algorithms
   reaching the same kind of picture. What has to hold is that the objective
   falls and that it falls monotonically enough to chart. */
console.log("\nthe descent (exact full-batch, on the library's own mu):");
for (const c of ref.cases.slice(0, 3)) {
  const mu = c.mu.map((r) => Float64Array.from(r));
  const { curve } = umap(c.X, { mu, minDist: 0.1, iters: 500, seed: c.seed });
  const rises = curve.slice(1).filter((v, i) => v > curve[i]).length;
  console.log(`  seed ${c.seed}, n_neighbors = ${c.k}: cross-entropy ` +
    `${curve[0].toFixed(1)} -> ${curve[curve.length - 1].toFixed(1)}, ` +
    `rises on ${rises}/${curve.length - 1} steps`);
  check("cross-entropy fell", curve[curve.length - 1] < curve[0] ? 0 : 1, 0);
  check("curve rises on under 1% of its steps", rises / (curve.length - 1), 0.01);
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nall checks passed");
process.exit(fails ? 1 : 0);
