/* _lab/cell-markers-umap-verify.mjs — the edge-sampling UMAP against
 * umap-learn 0.5.12, on slot 81's own stage.
 *
 *   node widgets/_lab/cell-markers-umap-verify.mjs --export   writes the PCs
 *   python widgets/_lab/cell-markers-umap-ref.py              the library's side
 *   node widgets/_lab/cell-markers-umap-verify.mjs            the comparison
 *
 * Two checks. The GRAPH: every weight of widget 22's fuzzySet against the
 * library's fuzzy_simplicial_set on the same PCs (the first step, which the
 * JS reuses unchanged). The LAYOUT: a layout is not reproducible across two
 * implementations' random streams, so it is compared by what it is for —
 * 5-NN type purity in 2-D and the hepatocyte gradient's |r| — over several
 * seeds, against the library at its own two starts.
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { fuzzySet } from "../umap/model.js";
import { simulate, normalise, pcaScaled } from "../cell-markers/engine.js";
import { umapSgd } from "../cell-markers/umap.js";

const HERE = new URL(".", import.meta.url);
const CASES = [{ per: 150, seed: 1 }, { per: 300, seed: 1 }];
const stageOf = ({ per, seed }) => {
  const cells = simulate(makeRng(seed), { cells: per, patientSd: 0, zonation: 3 });
  return { cells, P: pcaScaled(normalise(cells), 20, makeRng(10 + seed)) };
};

if (process.argv.includes("--export")) {
  const cases = CASES.map((c) => { const { cells, P } = stageOf(c); return { ...c, pcs: P.map((p) => p.map((v) => +v.toFixed(6))), types: cells.map((x) => x.type), z: cells.map((x) => x.z) }; });
  fs.writeFileSync(new URL("cell-markers-umap-pcs.json", HERE), JSON.stringify({ cases }));
  console.log("wrote cell-markers-umap-pcs.json");
  process.exit(0);
}

const ref = JSON.parse(fs.readFileSync(new URL("cell-markers-umap-ref.json", HERE), "utf8"));
const src = JSON.parse(fs.readFileSync(new URL("cell-markers-umap-pcs.json", HERE), "utf8"));
const out = [];
const say = (s) => { out.push(s); console.log(s); };
say(`UMAP VERIFY — the JS edge-sampling layout against umap-learn ${ref.version}, on slot 81's stage (zonation 3)`);

function measures(Y, types, z) {
  const n = Y.length;
  let pure = 0;
  for (let i = 0; i < n; i += 1) {
    const d = []; for (let j = 0; j < n; j += 1) if (j !== i) d.push([(Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2, j]);
    d.sort((p, q) => p[0] - q[0]);
    pure += d.slice(0, 5).filter(([, j]) => types[j] === types[i]).length / 5;
  }
  const hep = types.map((t, i) => (t === 0 ? i : -1)).filter((i) => i >= 0);
  const corr = (xs, ys) => { const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length; let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, k) => { sxy += (x - mx) * (ys[k] - my); sxx += (x - mx) ** 2; syy += (ys[k] - my) ** 2; }); return sxy / Math.sqrt(sxx * syy); };
  const zz = hep.map((i) => z[i]);
  return { purity: pure / n, r: Math.max(Math.abs(corr(zz, hep.map((i) => Y[i][0]))), Math.abs(corr(zz, hep.map((i) => Y[i][1])))) };
}

src.cases.forEach((c, ci) => {
  const P = c.pcs, n = P.length, R = ref.cases[ci];
  /* the graph */
  const { mu } = fuzzySet(P, 15);
  const refW = new Map(R.graph.map(([i, j, v]) => [`${i},${j}`, v]));
  let maxDiff = 0, missing = 0, extra = 0;
  for (const [key, v] of refW) { const [i, j] = key.split(",").map(Number); const dv = Math.abs(mu[i][j] - v); if (mu[i][j] === 0) missing += 1; maxDiff = Math.max(maxDiff, dv); }
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j && mu[i][j] > 0 && !refW.has(`${i},${j}`)) extra += 1;
  say(`\n  ${n} cells — graph: ${refW.size} library edges; largest weight difference ${maxDiff.toExponential(1)}; ${missing} library edges absent here, ${extra} here absent there`);
  R.layouts.forEach((L) => say(`    umap-learn ${L.init.padEnd(8)} ${L.epochs} epochs: purity ${L.purity.toFixed(2)}, hepatocyte |r| ${L.hepR.toFixed(2)}, ${Math.round(L.ms)} ms`));
  for (const epochs of [200, 500]) {
    const rows = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const t = Date.now();
      const { Y } = umapSgd(P, { nEpochs: epochs, rng: makeRng(seed) });
      const ms = Date.now() - t;
      rows.push({ ...measures(Y, c.types, c.z), ms });
    }
    const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length, lo = (k) => Math.min(...rows.map((r) => r[k])), hi = (k) => Math.max(...rows.map((r) => r[k]));
    say(`    this file, pca start, ${epochs} epochs, 5 seeds: purity ${avg("purity").toFixed(2)} (${lo("purity").toFixed(2)}–${hi("purity").toFixed(2)}), hepatocyte |r| ${avg("r").toFixed(2)} (${lo("r").toFixed(2)}–${hi("r").toFixed(2)}), ${Math.round(avg("ms"))} ms`);
  }
});
fs.writeFileSync(new URL("cell-markers-umap-verify.txt", HERE), out.join("\n") + "\n");
