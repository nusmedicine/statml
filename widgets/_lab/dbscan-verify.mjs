/* ============================================================================
   `widgets/dbscan/model.js` against `sklearn.cluster.DBSCAN`.

   `kmeans-verify.mjs`'s pattern, and DBSCAN makes it stricter still: there is
   no initialisation to reconcile and no seed anywhere in the algorithm, so
   given the same points and the same two parameters the two engines either
   agree point for point or one of them is wrong. Nothing here is allowed to be
   "comparable in kind".

     node   widgets/_lab/dbscan-verify.mjs --fixtures   # write the fixtures
     python widgets/_lab/dbscan-ref.py                  # sklearn's answers
     node   widgets/_lab/dbscan-verify.mjs              # compare

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeRng } from "../core/rng.js";
import { stage as sphereStage, umap, pcaPlane } from "../umap/model.js";
import {
  dbscan, blobs, cloud, rings, moons, varying,
  silhouetteWithNoise, silhouetteClustersOnly, adjustedRand,
} from "../dbscan/model.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* The cases span every stage the plan is choosing between, `eps` below / at /
   above the useful range, `min_samples` at 3 / 4 / 5, and 3-D as well as 2-D.
   THREE OF THEM EXIST TO EXERCISE THE AWKWARD CASES rather than the pretty
   ones: `eps` so small that everything is noise, `eps` so large that
   everything is one cluster, and a stage engineered to have border points
   reachable from two clusters at once — which is the only place the traversal
   order is observable at all. */
const CASES = [
  { name: "blobs 4x12, eps=0.30 m=4  ", kind: "blobs", opt: { groups: 4, per: 12 }, eps: 0.30, minPts: 4, seed: 3 },
  { name: "blobs 4x12, eps=0.55 m=4  ", kind: "blobs", opt: { groups: 4, per: 12 }, eps: 0.55, minPts: 4, seed: 3 },
  { name: "blobs 4x12, eps=0.08 m=4  ", kind: "blobs", opt: { groups: 4, per: 12 }, eps: 0.08, minPts: 4, seed: 3 },
  { name: "blobs 6x8,  eps=0.25 m=3  ", kind: "blobs", opt: { groups: 6, per: 8 }, eps: 0.25, minPts: 3, seed: 11 },
  { name: "rings 2x24, eps=0.28 m=4  ", kind: "rings", opt: {}, eps: 0.28, minPts: 4, seed: 1 },
  { name: "rings 2x24, eps=0.45 m=5  ", kind: "rings", opt: {}, eps: 0.45, minPts: 5, seed: 1 },
  { name: "moons 2x24, eps=0.30 m=4  ", kind: "moons", opt: {}, eps: 0.30, minPts: 4, seed: 4 },
  { name: "moons 2x24, eps=0.22 m=3  ", kind: "moons", opt: {}, eps: 0.22, minPts: 3, seed: 4 },
  { name: "varying,    eps=0.20 m=4  ", kind: "varying", opt: {}, eps: 0.20, minPts: 4, seed: 6 },
  { name: "varying,    eps=0.42 m=4  ", kind: "varying", opt: {}, eps: 0.42, minPts: 4, seed: 6 },
  { name: "cloud n=48, eps=0.35 m=5  ", kind: "cloud", opt: { n: 48 }, eps: 0.35, minPts: 5, seed: 5 },
  { name: "sphere 4x12 3-D, eps=0.9  ", kind: "sphere", opt: { groups: 4, per: 12 }, eps: 0.9, minPts: 4, seed: 2 },
  { name: "umap of sphere 4x12, e=0.6", kind: "umap", opt: { groups: 4, per: 12 }, eps: 0.6, minPts: 4, seed: 2 },
];

function build(c) {
  const rng = makeRng(c.seed);
  if (c.kind === "umap") {
    const st = sphereStage(c.opt.groups, c.opt.per, rng);
    const Y = umap(st.map((s) => s.p), { rng: makeRng(c.seed + 77) });
    const P = Y.Y ?? Y;
    return { X: P.map((p) => [p[0], p[1]]), y: st.map((s) => s.g) };
  }
  const st = c.kind === "blobs" ? blobs(rng, c.opt)
    : c.kind === "cloud" ? cloud(rng, c.opt)
      : c.kind === "rings" ? rings(rng, c.opt)
        : c.kind === "moons" ? moons(rng, c.opt)
          : c.kind === "varying" ? varying(rng, c.opt)
            : sphereStage(c.opt.groups, c.opt.per, rng);
  return { X: st.map((s) => s.p), y: st.map((s) => s.g) };
}

if (process.argv.includes("--fixtures")) {
  const out = CASES.map((c) => ({ ...c, ...build(c) }));
  writeFileSync(join(HERE, "dbscan-fixtures.json"), JSON.stringify(out));
  console.log(`wrote dbscan-fixtures.json — ${out.length} cases`);
  process.exit(0);
}

const refPath = join(HERE, "dbscan-ref.json");
if (!existsSync(refPath)) {
  console.error("no dbscan-ref.json — run with --fixtures, then dbscan-ref.py");
  process.exit(1);
}
const ref = JSON.parse(readFileSync(refPath, "utf8"));
const fixtures = JSON.parse(readFileSync(join(HERE, "dbscan-fixtures.json"), "utf8"));

console.log(`sklearn ${ref.sklearn}, numpy ${ref.numpy}\n`);
const head = "case                        n   k  noise  labels    core   sil(+noise)  sil(clusters)   ARI";
console.log(head);
console.log("-".repeat(head.length));

let bad = 0;
let worstSil = 0;
let worstAri = 0;

for (let i = 0; i < fixtures.length; i += 1) {
  const c = fixtures[i];
  const r = ref.cases[i];
  const got = dbscan(c.X, { eps: c.eps, minPts: c.minPts });

  /* LABELS ARE COMPARED AS A PARTITION AND AS INTEGERS BOTH. sklearn numbers
     its clusters in the order it seeds them and so does this, so the integers
     themselves should agree — but a partition that matches with the numbers
     permuted is a different and much weaker result, and reporting the strong
     one requires checking the strong one. */
  const sameInts = got.labels.every((v, j) => v === r.labels[j]);
  const key = (L) => {
    const map = new Map();
    return L.map((v) => {
      if (v === -1) return -1;
      if (!map.has(v)) map.set(v, map.size);
      return map.get(v);
    }).join(",");
  };
  const samePart = key(got.labels) === key(r.labels);

  /* `core_sample_indices_` is sklearn's own list of core points, which is the
     one verdict a labels-only comparison cannot see: two engines can agree on
     every cluster while disagreeing about which members are core, and the
     widget draws that difference. */
  const gotCore = got.core.map((v, j) => (v ? j : -1)).filter((j) => j >= 0);
  const sameCore = gotCore.length === r.core.length && gotCore.every((v, j) => v === r.core[j]);

  const sWith = silhouetteWithNoise(c.X, got.labels);
  const sOnly = silhouetteClustersOnly(c.X, got.labels);
  const ari = adjustedRand(c.y, got.labels);
  const dWith = r.sil_with === null || sWith === null ? 0 : Math.abs(sWith - r.sil_with);
  const dOnly = r.sil_only === null || sOnly === null ? 0 : Math.abs(sOnly - r.sil_only);
  const dAri = Math.abs(ari - r.ari);
  worstSil = Math.max(worstSil, dWith, dOnly);
  worstAri = Math.max(worstAri, dAri);

  const ok = sameInts && samePart && sameCore && dWith < 1e-12 && dOnly < 1e-12 && dAri < 1e-12;
  if (!ok) bad += 1;
  const mark = (b) => (b ? "  ok  " : " WRONG");
  console.log(
    `${c.name} ${String(c.X.length).padStart(3)} ${String(got.nClusters).padStart(3)}`
    + `  ${String(got.noise.length).padStart(4)}  ${mark(sameInts && samePart)}  ${mark(sameCore)}`
    + `   ${dWith.toExponential(1).padStart(9)}    ${dOnly.toExponential(1).padStart(9)}  ${dAri.toExponential(1).padStart(8)}`,
  );
}

console.log("-".repeat(head.length));
console.log(`worst silhouette gap ${worstSil.toExponential(1)}, worst ARI gap ${worstAri.toExponential(1)}`);
console.log(bad === 0 ? `ALL ${fixtures.length} MATCH` : `${bad} of ${fixtures.length} DISAGREE`);
process.exit(bad === 0 ? 0 : 1);
