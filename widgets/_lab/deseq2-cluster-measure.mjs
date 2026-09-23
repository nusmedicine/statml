/* does clustering the samples on the 30 most variable genes recover the two
   groups? Two readings: the dendrogram's top split is the groups, and the weaker
   one the reader sees, the leaf order keeps each group contiguous */
import { makeRng } from "../core/rng.js";
import { simulate, analyse, log2 } from "../deseq2/engine.js";
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
function agglom(items, dist) {
  let cl = items.map((i) => [i]); let top = null;
  const d = (A, B) => mean(A.flatMap((a) => B.map((b) => dist(a, b))));
  while (cl.length > 1) {
    let best = [0, 1], bd = Infinity;
    for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const v = d(cl[i], cl[j]); if (v < bd) { bd = v; best = [i, j]; } }
    const [i, j] = best; if (cl.length === 2) top = [cl[i], cl[j]];
    cl = cl.filter((_, k) => k !== i && k !== j).concat([cl[i].concat(cl[j])]);
  }
  return { order: cl[0], top };
}
const ROWS = 30, seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (const reps of [3, 2, 6]) {
  const T = { raw: [0, 0], log2: [0, 0], vst: [0, 0] };
  for (const seed of seeds) {
    const sim = simulate(makeRng(seed), { reps }), an = analyse(sim);
    const norm = sim.counts.map((row) => row.map((v, j) => v / an.sf[j])); const ex = [...an.expressed], n = sim.grp.length;
    for (const [u, fn] of [["raw", (v) => v], ["log2", (v) => log2(v + 1)], ["vst", an.vst]]) {
      const top = ex.map((g) => [g, sd(norm[g].map(fn))]).sort((a, b) => b[1] - a[1]).slice(0, ROWS).map(([g]) => g);
      const M = top.map((g) => norm[g].map(fn)); const eu = (a, b) => Math.sqrt(M.reduce((s, r) => s + (r[a] - r[b]) ** 2, 0));
      const { order, top: split } = agglom([...Array(n).keys()], eu);
      if (split.every((c) => new Set(c.map((j) => sim.grp[j])).size === 1)) T[u][0] += 1;
      const runs = order.reduce((k, j, i) => k + (i > 0 && sim.grp[j] !== sim.grp[order[i - 1]] ? 1 : 0), 0);
      if (runs === 1) T[u][1] += 1;
    }
  }
  console.log(`reps ${reps}, ${seeds.length} seeds — top split is the groups / groups contiguous in the leaf order: raw ${T.raw.join("/")}, log2 ${T.log2.join("/")}, vst ${T.vst.join("/")}`);
}
