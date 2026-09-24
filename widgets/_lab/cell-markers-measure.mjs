/* _lab/cell-markers-measure.mjs — slot 81 on the simulated stage, with every
 * method written as published (`cell-markers-engine.js`).
 *
 *   M1 CLUSTERS — kNN → SNN → Louvain on slot 79's six types: the cluster
 *      count and ARI across resolutions, at 1,600 and 6,400 cells; and time.
 *   M2 MARKERS — each true type against the rest: of the top 10 genes by
 *      p, by avg_log2FC and by pct.1 − pct.2, how many are that type's own
 *      markers; and how many non-marker genes pass p_val_adj < 0.05.
 *   M3 CONDITIONS — Kupffer cells, tumour against liver, no condition effect,
 *      the SAMPLE effect swept (a patient effect cancels, since each patient
 *      gives cells to both arms — the first run's finding; the lesson's own
 *      two normal livers differ by a median |log2 CPM| of 0.90 —
 *      `cell-markers-real.txt`): the share of genes a Wilcoxon over cells
 *      calls against a test over the two patients.
 *
 *   node widgets/_lab/cell-markers-measure.mjs      (~70 s)
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { simulate, normalise, pcaScaled, knn, snn, findClusters, ari, findMarkers, geneKind, TYPES, G, G_MARK, G_HOUSE } from "../cell-markers/engine.js";
import { lgamma } from "../core/stats.js";

const out = [];
const say = (s) => { out.push(s); console.log(s); };
const pct = (x) => `${Math.round(100 * x)}%`;
const t0 = Date.now();

/* ------------------------------------------------------------ M1 clusters */
say("M1 CLUSTERS — 79's six types and mixes; NormalizeData, ScaleData, PCA 20, kNN 20, SNN 1/15, Louvain best of 10; patient effect 0 (an integrated stage)");
say("  first run, no zonation: 6–7 clusters at every resolution from 0.05 to 0.5 at 1,600 cells — six well-separated types leave resolution nothing to cut. Hepatocytes are ZONED along the lobule (the lesson's own heatmap spreads them over clusters 0, 1 and 2), so the stage gives them a gradient: 30 genes, half periportal and half pericentral, changing by `zonation` in log across the lobule");
const RES = [0.1, 0.2, 0.3, 0.5, 0.8, 1.2];
for (const [cellsPer, zonation] of [[400, 0], [400, 3], [400, 5], [1600, 3]]) {
  for (const seed of [1, 2]) {
    const cells = simulate(makeRng(seed), { cells: cellsPer, patientSd: 0, zonation });
    let t = Date.now();
    const Y = normalise(cells), P = pcaScaled(Y, 20, makeRng(10 + seed));
    const tPc = Date.now() - t; t = Date.now();
    const adj = snn(knn(P, 20));
    const tG = Date.now() - t;
    const truth = cells.map((c) => c.type);
    const line = [];
    let tC = 0;
    for (const res of RES) {
      t = Date.now();
      const r = findClusters(adj, res, makeRng(100 + seed));
      tC = Math.max(tC, Date.now() - t);
      /* clusters whose majority is hepatocytes, and how well they follow z */
      const byC = new Map(); cells.forEach((c, i) => { const k = r.clusters[i]; const e = byC.get(k) ?? { n: 0, hep: 0, z: [] }; e.n += 1; if (c.type === 0) { e.hep += 1; e.z.push(c.z); } byC.set(k, e); });
      const hepC = [...byC.values()].filter((e) => e.hep > e.n / 2).map((e) => e.z.reduce((a, b) => a + b, 0) / e.z.length).sort((a, b) => a - b);
      line.push(`${res}: ${r.k} (hep ${hepC.length}${hepC.length > 1 ? ` at z̄ ${hepC.map((v) => v.toFixed(2)).join("/")}` : ""}; ARI ${ari(truth, r.clusters).toFixed(2)})`);
    }
    say(`  ${4 * cellsPer} cells, zonation ${zonation}, seed ${seed} [PCA ${tPc} ms, graph ${tG} ms, clusters ≤ ${tC} ms]: ${line.join(" · ")}`);
  }
}

/* ------------------------------------------------------------- M2 markers */
say("\nM2 MARKERS — each true type against every other cell (FindAllMarkers' form): of the top 10 genes, how many are that type's own 25 markers");
for (const seed of [1, 2]) {
  const cells = simulate(makeRng(seed), { cells: 400, patientSd: 0.3 });
  const Y = normalise(cells);
  for (let ti = 0; ti < TYPES.length; ti += 1) {
    const fm = findMarkers(Y, (i) => cells[i].type === ti, (i) => cells[i].type !== ti, { nGenes: 33538 });
    const pos = fm.res.filter((x) => x.lfc > 0);
    const own = (x) => { const k = geneKind(x.g); return k.kind === "marker" && k.type === ti; };
    const top = (key) => pos.slice().sort(key).slice(0, 10).filter(own).length;
    const byP = top((a, b) => a.lp - b.lp || b.lfc - a.lfc), byL = top((a, b) => b.lfc - a.lfc), byD = top((a, b) => (b.p1 - b.p2) - (a.p1 - a.p2));
    const sig = pos.filter((x) => x.lpAdj < Math.log10(0.05));
    const sigNon = sig.filter((x) => !own(x));
    const kinds = sigNon.reduce((m, x) => { const k = geneKind(x.g); const lab = k.kind === "marker" ? "other types' markers" : k.kind === "house" ? "high everywhere" : "differ a little"; m[lab] = (m[lab] ?? 0) + 1; return m; }, {});
    const pZero = pos.filter((x) => x.lp < -300).length;
    const eg = sigNon.filter((x) => geneKind(x.g).kind === "spread").sort((a, b) => a.lp - b.lp)[0];
    const m1 = pos.filter(own).sort((a, b) => a.lp - b.lp)[0];
    say(`  seed ${seed} ${TYPES[ti].name.padEnd(16)} ${fm.n1} vs ${fm.n2} cells · own markers in top 10 by p ${byP}, by avg_log2FC ${byL}, by pct.1 − pct.2 ${byD} · p_adj < 0.05: ${sig.length} up, ${sigNon.length} not its markers (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")}) · ${pZero} below 1e-300`
      + (eg && m1 ? `\n      e.g. a marker: lfc ${m1.lfc.toFixed(2)}, pct ${m1.p1.toFixed(2)}/${m1.p2.toFixed(2)}, log10 p ${m1.lp.toFixed(0)}; a gene that differs a little: lfc ${eg.lfc.toFixed(2)}, pct ${eg.p1.toFixed(2)}/${eg.p2.toFixed(2)}, log10 p ${eg.lp.toFixed(0)}` : ""));
  }
}

/* ---------------------------------------------------------- M3 conditions */
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d; for (let m = 1; m <= 300; m += 1) { const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c; aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}
const tP = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);
say("\nM3 CONDITIONS — Kupffer cells only, tumour against liver, NO condition effect; the 210 genes that differ a little between types are the null set");
say("  (the first run swept the PATIENT effect and found nothing: each patient gives cells to both arms, so it cancels. The lesson's two normal livers — two samples — differ by a median |log2 CPM| of 0.90, which a per-sample sd of about 0.65 in natural log gives, an upper bound since 61 cells add their own noise)");
for (const sampleSd of [0, 0.1, 0.2, 0.4, 0.65]) {
  const patientSd = 0.3;
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const cells = simulate(makeRng(seed), { cells: 1600, patientSd, sampleSd });
    const Y = normalise(cells);
    const kup = (i) => cells[i].type === 5;
    const fm = findMarkers(Y, (i) => kup(i) && cells[i].tissue === "tumour", (i) => kup(i) && cells[i].tissue === "liver", { nGenes: 33538, logfc: 0, minPct: 0 });
    const nullSet = fm.res.filter((x) => geneKind(x.g).kind === "spread");
    const cellsP05 = nullSet.filter((x) => x.lp < Math.log10(0.05)).length / nullSet.length;
    const cellsAdj = nullSet.filter((x) => x.lpAdj < Math.log10(0.05)).length / nullSet.length;
    /* over patients: pseudobulk per sample (summed counts of its Kupffer cells, log2 CPM), paired t over 2 patients */
    const pb = {};
    cells.forEach((c, i) => { if (!kup(i)) return; const k = c.sample; pb[k] = pb[k] ?? new Float64Array(G); for (let g = 0; g < G; g += 1) pb[k][g] += c.x[g]; });
    const lib = Object.fromEntries(Object.entries(pb).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0)]));
    const cpm = (k, g) => Math.log2(1 + (1e6 * pb[k][g]) / lib[k]);
    let pat05 = 0;
    for (const x of nullSet) { const d = [cpm("p1-tumour", x.g) - cpm("p1-liver", x.g), cpm("p2-tumour", x.g) - cpm("p2-liver", x.g)]; const m = (d[0] + d[1]) / 2, s = Math.abs(d[0] - d[1]) / Math.SQRT2; if (s > 0 && tP(m / (s / Math.SQRT2), 1) < 0.05) pat05 += 1; }
    rows.push({ n: fm.n1 + fm.n2, cellsP05, cellsAdj, pat05: pat05 / nullSet.length });
  }
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  say(`  sample sd ${sampleSd} (patient sd ${patientSd}): ${Math.round(avg("n"))} Kupffer cells; null genes called — over cells ${pct(avg("cellsP05"))} at p < 0.05, ${pct(avg("cellsAdj"))} at p_val_adj < 0.05; over the 2 patients ${pct(avg("pat05"))} at p < 0.05`);
}
say(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
fs.writeFileSync(new URL("./cell-markers-measure.txt", import.meta.url), out.join("\n") + "\n");
