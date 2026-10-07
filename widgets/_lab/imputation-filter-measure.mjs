// Slot 89, the filter question (2026-10-07): what keeping proteins measured in at least
// 50% / 70% / 100% of the samples of one group does, against no filter, over 20 seeds,
// for each method; and the same thresholds counted on the lesson's own 1,337 proteins
// (01-4's Results_differential_limma.tsv, imputed_cancer / imputed_healthy).
//   node widgets/_lab/imputation-filter-measure.mjs   (about 3 min; writes imputation-filter-measure.json)
import { readFileSync, writeFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST } from "../imputation/forest-table.js";

const LEVELS = [0, 0.5, 0.7, 1];
const keepAt = (obs, f) => obs.map((r, p) => p).filter((p) => f === 0 || Math.max(E.seenIn(obs[p], 0, E.NA) / E.NA, E.seenIn(obs[p], E.NA, E.N) / E.NB) >= f - 1e-9);
const acc = {};
const t0 = Date.now();
for (let s = 1; s <= 20; s += 1) {
  const sim = E.simulateMatrix(makeRng(s));
  for (const f of LEVELS) {
    const rows = keepAt(sim.obs, f);
    const obs = rows.map((p) => sim.obs[p]);
    let forest;
    if (f === 0) forest = E.fillFromHoles(obs, FOREST[s].any);
    else forest = E.imputeForest(obs, makeRng(E.forestSeed(s, "f" + f)));
    const min = E.imputeMin(obs);
    const F = { measured: obs, minimum: min, knn: E.imputeKnn(obs), forest, mixed: E.imputeMixed(obs, min, forest) };
    for (const [m, M] of Object.entries(F)) {
      const sc = E.score(sim, rows, M);
      (acc[`${f}|${m}`] ||= []).push({ kept: rows.length, real: sc.real, absentKept: rows.filter((p) => sim.meta[p].kind === "absent").length,
        fdr: sc.fdr, tp: sc.tp, fp: sc.fp, absentFc: sc.absentFc, tested: sc.tested, missing: obs.flat().filter(Number.isNaN).length });
    }
  }
  process.stdout.write(`seed ${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sim = {};
for (const [k, r] of Object.entries(acc)) {
  const g = (x) => mean(r.map((o) => o[x]).filter(Number.isFinite));
  sim[k] = { kept: g("kept"), real: g("real"), absentKept: g("absentKept"), fdr: g("fdr"), tp: g("tp"), fp: g("fp"), absentFc: g("absentFc"), tested: g("tested"), missing: g("missing") };
}

// the lesson's own proteins: proportion measured in each group = 1 - share imputed
const nb = "D:/Documents/NUS Dropbox/Kenneth Ban Hon Kim/Development/jupyterbook/phm5003/notebook/09 - Proteomics & Metabolomics Analysis/Results_differential_limma.tsv";
const L = readFileSync(nb, "utf8").trim().split("\n");
const h = L[0].split("\t");
const lesson = L.slice(1).map((l) => { const v = l.split("\t"); const o = {}; h.forEach((k, i) => { o[k] = v[i]; }); return { c: 1 - +o.imputed_cancer, hl: 1 - +o.imputed_healthy, padj: +o.adj_p_value }; });
const lessonCounts = LEVELS.map((f) => {
  const kept = lesson.filter((p) => f === 0 || Math.max(p.c, p.hl) >= f - 1e-9);
  return { f, kept: kept.length, mnar: kept.filter((p) => Math.min(p.c, p.hl) <= 0.2 + 1e-9).length, never: lesson.filter((p) => p.c === 0 && p.hl === 0).length };
});
writeFileSync(new URL("./imputation-filter-measure.json", import.meta.url), JSON.stringify({ levels: LEVELS, sim, lesson: lesson.map((p) => [Math.round(p.c * 11), Math.round(p.hl * 11)]), lessonCounts }));
for (const f of LEVELS) {
  console.log(`\nfilter ${f === 0 ? "none" : f * 100 + "%"}: kept ${sim[`${f}|minimum`].kept.toFixed(0)} of 600, real differences kept ${sim[`${f}|minimum`].real.toFixed(1)}, absent kept ${sim[`${f}|minimum`].absentKept.toFixed(1)}`);
  for (const m of ["measured", "minimum", "knn", "forest", "mixed"]) {
    const o = sim[`${f}|${m}`];
    console.log(`  ${m.padEnd(9)} FDR ${(100 * o.fdr).toFixed(1).padStart(5)}%  true ${o.tp.toFixed(1).padStart(5)}  false ${o.fp.toFixed(1).padStart(5)}  absent FC ${Number.isFinite(o.absentFc) ? o.absentFc.toFixed(2) : "—"}`);
  }
}
console.log("\nlesson:", JSON.stringify(lessonCounts));
