/* _lab/cell-markers-feasibility.mjs — his two picks that were not the
 * recommendation, measured before they become the plan (2026-09-24).
 *
 *   F1 UMAP ON THE PAGE — widget 22's model (`umap/model.js`, exact
 *      full-batch, verified against umap-learn at n = 48) on the 20 PCs of
 *      this stage: time at 600 and 1,200 cells, and whether the six types
 *      and the hepatocyte gradient survive (5-NN type purity in 2-D, and the
 *      correlation of a hepatocyte's lobule position with its UMAP coordinate).
 *   F2 DESEQ2 ON PSEUDOBULK — widget 78's engine (`deseq2/engine.js`,
 *      `analyse`), two groups only, so `~ tissue` over the four samples'
 *      summed Kupffer counts, 2 against 2: the share of null genes called
 *      under the sample and the patient effect, against the Wilcoxon over
 *      cells.
 *
 *   node widgets/_lab/cell-markers-feasibility.mjs
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { umap } from "../umap/model.js";
import { analyse } from "../deseq2/engine.js";
import { simulate, normalise, pcaScaled, findMarkers, geneKind, G } from "../cell-markers/engine.js";

const out = [];
const say = (s) => { out.push(s); console.log(s); };
const pct = (x) => `${Math.round(100 * x)}%`;

say("F1 UMAP — widget 22's model on this stage's 20 PCs, n_neighbors 15, min_dist 0.1");
for (const per of [150, 300]) {
  const cells = simulate(makeRng(1), { cells: per, patientSd: 0, zonation: 3 });
  const P = pcaScaled(normalise(cells), 20, makeRng(11));
  for (const iters of [200, 500]) {
    const t = Date.now();
    const res = umap(P, { nNeighbors: 15, iters, seed: 1 });
    const ms = Date.now() - t;
    const Y = res.Y ?? res.embedding ?? res;
    const n = cells.length;
    let pure = 0;
    for (let i = 0; i < n; i += 1) {
      const d = []; for (let j = 0; j < n; j += 1) if (j !== i) d.push([(Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2, j]);
      d.sort((a, b) => a[0] - b[0]);
      pure += d.slice(0, 5).filter(([, j]) => cells[j].type === cells[i].type).length / 5;
    }
    /* the hepatocyte gradient: |r| between z and the better of the two UMAP axes */
    const hep = cells.map((c, i) => (c.type === 0 ? i : -1)).filter((i) => i >= 0);
    const corr = (xs, ys) => { const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length; let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, k) => { sxy += (x - mx) * (ys[k] - my); sxx += (x - mx) ** 2; syy += (ys[k] - my) ** 2; }); return sxy / Math.sqrt(sxx * syy); };
    const z = hep.map((i) => cells[i].z);
    const r = Math.max(Math.abs(corr(z, hep.map((i) => Y[i][0]))), Math.abs(corr(z, hep.map((i) => Y[i][1]))));
    say(`  ${n} cells, ${iters} iterations: ${ms} ms; 5-NN type purity ${pct(pure / n)}; hepatocyte lobule position against the better UMAP axis |r| = ${r.toFixed(2)}`);
  }
}

say("\nF2 DESEQ2 ON PSEUDOBULK — Kupffer cells' summed counts per sample, ~ tissue, 2 against 2; the 210 genes that differ a little between types are the null set; three seeds each");
for (const [patientSd, sampleSd] of [[0.3, 0], [0.3, 0.2], [0.3, 0.4], [0.3, 0.65], [0, 0.4], [0.65, 0.4]]) {
  const rows = [];
  let ms = 0;
  for (const seed of [1, 2, 3]) {
    const cells = simulate(makeRng(seed), { cells: 1200, patientSd, sampleSd });
    const kup = cells.filter((c) => c.type === 5);
    const order = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
    const counts = Array.from({ length: G }, (_, g) => order.map((sk) => kup.filter((c) => c.sample === sk).reduce((s, c) => s + c.x[g], 0)));
    const t = Date.now();
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    ms = Math.max(ms, Date.now() - t);
    const nulls = Array.from({ length: G }, (_, g) => g).filter((g) => geneKind(g).kind === "spread" && an.expressed.includes(g));
    const Y = normalise(kup);
    const fm = findMarkers(Y, (i) => kup[i].tissue === "tumour", (i) => kup[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    const wil = fm.res.filter((x) => geneKind(x.g).kind === "spread");
    rows.push({
      d05: nulls.filter((g) => an.resMAP[g].p < 0.05).length / nulls.length,
      dAdj: nulls.filter((g) => an.resMAP[g].padj < 0.05).length / nulls.length,
      w05: wil.filter((x) => x.lp < Math.log10(0.05)).length / wil.length,
      wAdj: wil.filter((x) => x.lpAdj < Math.log10(0.05)).length / wil.length,
    });
  }
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  say(`  patient sd ${patientSd}, sample sd ${sampleSd}: over cells ${pct(avg("w05"))} at p < 0.05 (${pct(avg("wAdj"))} adjusted) · DESeq2 over the 4 samples ${pct(avg("d05"))} at p < 0.05 (${pct(avg("dAdj"))} at padj < 0.05) · DESeq2 ${ms} ms`);
}
fs.writeFileSync(new URL("./cell-markers-feasibility.txt", import.meta.url), out.join("\n") + "\n");
