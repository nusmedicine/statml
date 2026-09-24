/* _lab/cell-markers-page3-measure.mjs — the reorganised page 3 (his round,
 * 2026-09-25: the widget in the notebook's order, the third page "genes that
 * differ between conditions in a selected cluster"), measured before building.
 * Page 3 would run on the map's OWN cells, so the one stage must carry the
 * sample effect and a true tumour change in every type. Three questions:
 *   1. do the clusters still follow the types (ARI) when it does?
 *   2. how many cells a cluster has in each of the four samples?
 *   3. how long a change takes?
 *   node widgets/_lab/cell-markers-page3-measure.mjs
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { simulate, normalise, pcaScaled, knn, snn, findClusters, ari, TYPES, SAMPLES } from "../cell-markers/engine.js";
const out = []; const say = (s) => { out.push(s); console.log(s); };
const ALL = TYPES.map((t) => t.key);
say("FIRST RUN (no integration): every type split by patient, ARI 0.6 — see git history. SECOND RUN, clustered on the integrated counts:");
for (const per of [250, 400]) for (const sampleSd of [0, 0.4]) for (const seed of [1, 2]) {
  let t = Date.now();
  const cells = simulate(makeRng(seed), { cells: per, patientSd: 0.3, sampleSd, condition: 1, conditionTypes: ALL, integrated: true });
  /* clustered on the integrated counts, as the lesson clusters on integrated.cca */
  const Y = normalise(cells.map((c) => ({ x: c.xi }))), P = pcaScaled(Y, 20, makeRng(10 + seed)), adj = snn(knn(P, 20));
  const r = findClusters(adj, 0.3, makeRng(100 + seed));
  const ms = Date.now() - t;
  const byC = Array.from({ length: r.k }, () => ({ n: {}, types: new Array(TYPES.length).fill(0) }));
  cells.forEach((c, i) => { const b = byC[r.clusters[i]]; b.n[c.sample] = (b.n[c.sample] ?? 0) + 1; b.types[c.type] += 1; });
  const rows = byC.map((b, c) => { const ty = b.types.indexOf(Math.max(...b.types)); return `${c} ${TYPES[ty].name.split(" ")[0]} ${SAMPLES.map((s) => b.n[s.key] ?? 0).join("/")}`; });
  say(`${per}/sample, sampleSd ${sampleSd}, seed ${seed}: ${r.k} clusters, ARI ${ari(cells.map((c) => c.type), r.clusters).toFixed(2)}, ${ms} ms (before UMAP) — cells per sample P1 liver/P1 tumour/P2 liver/P2 tumour: ${rows.join(" · ")}`);
}
fs.writeFileSync(new URL("./cell-markers-page3-measure.txt", import.meta.url), out.join("\n") + "\n");
