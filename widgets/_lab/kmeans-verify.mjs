/* ============================================================================
   `widgets/kmeans/model.js` against `sklearn.cluster.KMeans`.

   The pattern is `umap-verify.mjs`'s, with one improvement it could not have:
   UMAP's reference had to rebuild the stage in numpy, so its numbers were
   comparable in kind and not to the digit. Here the JS writes the stage AND
   the initial centroids to `kmeans-fixtures.json` and Python reads them, so
   both sides run Lloyd on byte-identical input and the comparison is exact.

     node   widgets/_lab/kmeans-verify.mjs --fixtures   # write the fixtures
     python widgets/_lab/kmeans-ref.py                  # sklearn's answers
     node   widgets/_lab/kmeans-verify.mjs              # compare

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeRng } from "../core/rng.js";
import { stage as sphereStage } from "../umap/model.js";
import {
  lloyd, forgy, kmeansPlusPlus, inertia, silhouette, adjustedRand, blobs, cloud,
} from "../kmeans/model.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* The cases span both stages the plan is choosing between, both initialisers,
   K below / at / above the truth, and 3-D as well as 2-D — because the widget
   may have to run in either and a check that only covers the plane would not
   notice a dimension-hardcoded distance. */
const CASES = [
  { name: "blobs 3x16, K=3, k-means++", kind: "blobs", opt: { groups: 3, per: 16 }, K: 3, init: "++", seed: 3 },
  { name: "blobs 3x16, K=2, random   ", kind: "blobs", opt: { groups: 3, per: 16 }, K: 2, init: "random", seed: 3 },
  { name: "blobs 3x16, K=6, random   ", kind: "blobs", opt: { groups: 3, per: 16 }, K: 6, init: "random", seed: 3 },
  { name: "blobs 2x24 5:1, K=2, ++   ", kind: "blobs", opt: { groups: 2, per: 24, aspect: 5 }, K: 2, init: "++", seed: 7 },
  { name: "blobs 6x8, K=6, random    ", kind: "blobs", opt: { groups: 6, per: 8 }, K: 6, init: "random", seed: 11 },
  { name: "cloud n=48, K=3, ++       ", kind: "cloud", opt: { n: 48 }, K: 3, init: "++", seed: 5 },
  { name: "sphere 4x12 in 3-D, K=4   ", kind: "sphere", opt: { groups: 4, per: 12 }, K: 4, init: "++", seed: 2 },
  { name: "sphere 6x8 in 3-D, K=6    ", kind: "sphere", opt: { groups: 6, per: 8 }, K: 6, init: "random", seed: 9 },
];

function build(c) {
  const rng = makeRng(c.seed);
  const st = c.kind === "blobs" ? blobs(rng, c.opt)
    : c.kind === "cloud" ? cloud(rng, c.opt)
      : sphereStage(c.opt.groups, c.opt.per, rng);
  const X = st.map((s) => s.p);
  const y = st.map((s) => s.g);
  const irng = makeRng(c.seed * 1000 + 7);
  const C0 = c.init === "random" ? forgy(X, c.K, irng) : kmeansPlusPlus(X, c.K, irng);
  return { X, y, C0 };
}

if (process.argv.includes("--fixtures")) {
  const out = CASES.map((c) => ({ ...c, ...build(c) }));
  writeFileSync(join(HERE, "kmeans-fixtures.json"), JSON.stringify(out));
  console.log(`wrote kmeans-fixtures.json — ${out.length} cases`);
  process.exit(0);
}

const refPath = join(HERE, "kmeans-ref.json");
if (!existsSync(refPath)) {
  console.error("no kmeans-ref.json — run kmeans-verify.mjs --fixtures, then kmeans-ref.py");
  process.exit(1);
}
const ref = JSON.parse(readFileSync(refPath, "utf8"));

console.log(`sklearn ${ref.sklearn}\n`);
console.log("  case                          labels   inertia        silhouette   ARI");
let bad = 0;
for (const r of ref.cases) {
  const c = CASES.find((k) => k.name === r.name);
  const { X, y, C0 } = build(c);
  const run = lloyd(X, c.K, { init: C0 });

  const same = run.labels.every((v, i) => v === r.labels[i]);
  const dJ = Math.abs(run.inertia - r.inertia);
  const dS = Math.abs(silhouette(X, run.labels) - r.silhouette);
  const dA = Math.abs(adjustedRand(y, run.labels) - r.ari);
  const okJ = dJ < 1e-9;
  const okS = dS < 1e-9;
  const okA = dA < 1e-12;
  if (!same || !okJ || !okS || !okA) bad += 1;
  console.log(`  ${r.name}  ${same ? "  same " : " DIFFER"}   ${dJ.toExponential(1)}      ${dS.toExponential(1)}     ${dA.toExponential(1)}`);
}

/* The inertia of the LABELS sklearn returned, recomputed here — a second,
   independent way for a disagreement to show up, since matching labels and a
   matching objective are different claims. */
for (const r of ref.cases) {
  const c = CASES.find((k) => k.name === r.name);
  const { X } = build(c);
  const j = inertia(X, r.labels, r.centres);
  if (Math.abs(j - r.inertia) > 1e-9) {
    console.log(`  ${r.name}  sklearn's own labels+centres score ${j} against its reported ${r.inertia}`);
    bad += 1;
  }
}

console.log(`\n${bad === 0 ? "ALL MATCH" : `${bad} MISMATCH`} — ${ref.cases.length} cases`);
console.log(`\nthe notebook's own call, KMeans(n_clusters=2, random_state=42), resolves n_init to ${ref.n_init_default}`);
process.exit(bad === 0 ? 0 : 1);
