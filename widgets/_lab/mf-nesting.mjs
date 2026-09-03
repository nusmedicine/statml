/* Measurements for Kenneth's round 1 on widget 41 — the three points he raised.

   Everything here runs the WIDGET'S OWN code, loaded through the same import
   stub `nmf-drive.mjs` uses, so no number below is a reimplementation that
   could drift from what the figure draws. (`nmf-mock.html` computed its own
   stage once and disagreed with the measurement it was illustrating.)

     A. how much smaller W and H are than V — "reduce dimensions", as a count
     B. PCA is nested and NMF is not: the claim behind his point 3
     C. what asking for one more part costs and buys

   Run:  node widgets/_lab/nmf-nesting.mjs
*/

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../core/rng.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(join(HERE, "..", "matrix-factorization", rel)).href;
const src = readFileSync(join(HERE, "..", "matrix-factorization", "main.js"), "utf8")
  .replace(
    /^import \{ defineWidget, fmt \} from "\.\.\/core\/index\.js";$/m,
    `import { fmt } from "${abs("../core/index.js")}";\n`
    + "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);",
  )
  .replace(/from "\.\/model\.js";/, `from "${abs("model.js")}";`)
  + "\nexport { __cfg };\n";
const W = (await import(
  `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`
)).__cfg;

const defaults = Object.fromEntries(
  Object.entries(W.params).filter(([, f]) => "default" in f).map(([n, f]) => [n, f.default]));
const run = (over = {}) => {
  const params = { ...defaults, ...over };
  return { params, state: W.compute({ params, rng: makeRng(params.seed) }) };
};

const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};
const col = (M, k) => M.map((row) => row[k]);
const last = (s) => s.snaps[s.snaps.length - 1];

const GENES = 24, SAMPLES = 12;

/* --- A. the compression, as a count of numbers ---------------------------- */
console.log("=== A. how much smaller are the two factors than the matrix? ===");
console.log(`  V is ${GENES} x ${SAMPLES} = ${GENES * SAMPLES} numbers`);
console.log("  k    first is 24 x k   second is k x 12   kept   of V    NMF unexpl.   PCA unexpl.");
for (let k = 1; k <= 6; k += 1) {
  const nmf = run({ method: "nmf", rank: k, programmes: 3 }).state;
  const pca = run({ method: "pca", components: k, programmes: 3 }).state;
  const stored = GENES * k + k * SAMPLES;
  console.log(`  ${String(k).padStart(2)}   ${String(GENES * k).padStart(13)}`
    + `   ${String(k * SAMPLES).padStart(15)}   ${String(stored).padStart(4)}`
    + `   ${Math.round((100 * stored) / (GENES * SAMPLES)).toString().padStart(3)}%`
    + `   ${(100 * nmf.unexplained).toFixed(1).padStart(10)}%`
    + `   ${(100 * pca.unexplained).toFixed(1).padStart(10)}%`);
}
console.log("\n  PCA is lower at every k, and must be: a truncated SVD plus the mean");
console.log("  is the best rank-k approximation there is. NMF gives up that much fit");
console.log("  to get factors that add rather than cancel.");
console.log("\n  The lessons' own two matrices, for scale:");
console.log(`    05/04 airway     33469 x 8   = ${(33469 * 8).toLocaleString()} numbers;`
  + ` at rank 2, ${(33469 * 2 + 2 * 8).toLocaleString()} (${Math.round((100 * (33469 * 2 + 2 * 8)) / (33469 * 8))}%)`);
console.log(`    07/01-4 trinucleotide  96 x 100 = ${(96 * 100).toLocaleString()} numbers;`
  + ` at 5 signatures, ${(96 * 5 + 5 * 100).toLocaleString()} (${Math.round((100 * (96 * 5 + 5 * 100)) / (96 * 100))}%)`);
console.log("  (07's cohort size is illustrative; the shape is 96 contexts x samples.)");

/* --- B. nesting: PCA hands back all of them, NMF only the k you asked for -- */
console.log("\n=== B. ask for one more, and see what happens to the ones you had ===");
console.log("  Both are factorizations of the same shape. The difference is that PCA");
console.log("  computes every component once and you choose how many to KEEP, while");
console.log("  NMF has to be told k before it starts and refits everything.");

console.log("\n  PCA, asked for k and then for k + 1:");
for (let k = 1; k <= 5; k += 1) {
  const a = last(run({ method: "pca", components: k, programmes: 3 }).state).W;
  const b = last(run({ method: "pca", components: k + 1, programmes: 3 }).state).W;
  const best = [];
  for (let q = 0; q < k; q += 1) {
    let bc = -1;
    for (let l = 0; l < k + 1; l += 1) bc = Math.max(bc, Math.abs(cosine(col(a, q), col(b, l))));
    best.push(bc);
  }
  console.log(`    ${k} -> ${k + 1}: [${best.map((v) => v.toFixed(6)).join(", ")}]`
    + `   worst ${Math.min(...best).toFixed(6)}`);
}

console.log("\n  NMF, the same stage, refitted at each rank (same random start):");
for (let k = 1; k <= 5; k += 1) {
  const a = last(run({ method: "nmf", rank: k, programmes: 3 }).state).W;
  const b = last(run({ method: "nmf", rank: k + 1, programmes: 3 }).state).W;
  const best = [];
  for (let q = 0; q < k; q += 1) {
    let bc = -1;
    for (let l = 0; l < k + 1; l += 1) bc = Math.max(bc, cosine(col(a, q), col(b, l)));
    best.push(bc);
  }
  console.log(`    ${k} -> ${k + 1}: [${best.map((v) => v.toFixed(3)).join(", ")}]`
    + `   worst ${Math.min(...best).toFixed(3)}`);
}

/* --- C. what one more costs and buys -------------------------------------- */
console.log("\n=== C. the trade each control is actually making ===");
console.log("  k    NMF unexpl.   agreement between starts   match to truth   PCA match to truth");
for (let k = 1; k <= 6; k += 1) {
  const nmf = run({ method: "nmf", rank: k, programmes: 3 }).state;
  const pca = run({ method: "pca", components: k, programmes: 3 }).state;
  console.log(`  ${String(k).padStart(2)}   ${(100 * nmf.unexplained).toFixed(1).padStart(10)}%`
    + `   ${nmf.betweenStarts.toFixed(3).padStart(22)}`
    + `   ${nmf.toTruth.toFixed(3).padStart(13)}`
    + `   ${pca.toTruth.toFixed(3).padStart(17)}`);
}
console.log("\n  The agreement elbow is the point of 07/01-4's `estimateSignatures`,");
console.log("  which picks the rank by how STABLE the decomposition is across runs —");
console.log("  the same quantity, measured there by cophenetic correlation.");
console.log("\n  And the last two columns are the widget: PCA reconstructs better at");
console.log("  every k while matching the real signatures far worse. Fitting the");
console.log("  matrix and recovering what built it are not the same job.");
