import { makeRng } from "../core/rng.js";
import { simulate, analyse, log2 } from "../deseq2/engine.js";
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const pear = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db); };
for (const reps of [3, 2, 6]) for (const seed of [1, 7, 9]) {
  const rng = makeRng(seed);
  const sim = simulate(rng, { reps });
  const an = analyse(sim);
  const norm = sim.counts.map((row) => row.map((v, j) => v / an.sf[j]));
  const units = { raw: (v) => v, log2: (v) => log2(v + 1), vst: an.vst };
  const expressed = [...an.expressed];
  const out = [`reps ${reps} seed ${seed}`];
  for (const [u, fn] of Object.entries(units)) {
    const M = expressed.map((g) => norm[g].map(fn));
    const S = sim.grp.length;
    const cols = Array.from({ length: S }, (_, j) => M.map((r) => r[j]));
    let win = [], bet = [];
    for (let i = 0; i < S; i++) for (let j = i + 1; j < S; j++) (sim.grp[i] === sim.grp[j] ? win : bet).push(pear(cols[i], cols[j]));
    // top-40 by variance across samples: share truly DE
    const v = expressed.map((g, k) => [g, sd(M[k])]).sort((a, b) => b[1] - a[1]);
    const top = v.slice(0, 40);
    const deShare = top.filter(([g]) => sim.isDE[g]).length / 40;
    // called DEGs top 40 by padj: the raw colour scale — share of the max from the biggest row
    const called = expressed.filter((g) => an.resMAP[g].padj < 0.1).sort((a, b) => an.resMAP[a].padj - an.resMAP[b].padj).slice(0, 40);
    const rows = called.map((g) => norm[g].map(fn));
    const mx = Math.max(...rows.flat());
    const rowMax = rows.map((r) => Math.max(...r));
    const dimRows = rowMax.filter((m) => m < 0.1 * mx).length;
    out.push(`  ${u.padEnd(4)} corr within ${mean(win).toFixed(3)} between ${mean(bet).toFixed(3)} gap ${(mean(win) - mean(bet)).toFixed(3)} | top40-var truly DE ${(100 * deShare).toFixed(0)}% | called ${called.length}, rows under 10% of the scale ${dimRows}/${rows.length}`);
  }
  console.log(out.join("\n"));
}
