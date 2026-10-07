// Slot 89 (2026-10-07): the simplest rule, no proteins removed. With a share t:
// a protein measured in at least t of the samples of BOTH groups -> random forest (MAR);
// otherwise -> the minimum (MNAR). All proteins kept. t = "1 sample", 0.5, 0.7; 20 seeds.
//   node widgets/_lab/imputation-one-rule.mjs
import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST } from "../imputation/forest-table.js";
const share = (r, a, b) => E.seenIn(r, a, b) / (b - a);
const low = (r) => Math.min(share(r, 0, E.NA), share(r, E.NA, E.N));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const acc = {};
for (let s = 1; s <= 20; s += 1) {
  const sim = E.simulateMatrix(makeRng(s));
  const all = sim.obs.map((r, p) => p);
  const forest = E.fillFromHoles(sim.obs, FOREST[s].any);
  const min = E.imputeMin(sim.obs);
  const knn = E.imputeKnn(sim.obs);
  const knnS = E.score(sim, all, knn), minS = E.score(sim, all, min);
  const ex = E.pickExamples(sim, knnS.padj, minS.fc);
  for (const [name, t] of [["at least 1 sample", 1 / 11], ["50%", 0.5], ["70%", 0.7]]) {
    const M = sim.obs.map((r, i) => r.map((v, j) => (Number.isNaN(v) ? (low(r) < t - 1e-9 ? min[i][j] : forest[i][j]) : v)));
    const sc = E.score(sim, all, M);
    (acc[name] ||= []).push({ fdr: sc.fdr, tp: sc.tp, fp: sc.fp, absentFc: sc.absentFc, mnar: sim.obs.filter((r) => low(r) < t - 1e-9).length,
      scat: Math.abs(sc.fc[ex.scattered]), fewCalled: sc.padj[ex.few] < 0.05 });
  }
  for (const [name, M] of [["forest", forest], ["minimum", min], ["knn", knn]]) {
    const sc = E.score(sim, all, M);
    (acc[name] ||= []).push({ fdr: sc.fdr, tp: sc.tp, fp: sc.fp, absentFc: sc.absentFc, mnar: NaN, scat: Math.abs(sc.fc[ex.scattered]), fewCalled: sc.padj[ex.few] < 0.05 });
  }
}
for (const [k, r] of Object.entries(acc)) {
  const g = (x) => mean(r.map((o) => o[x]).filter(Number.isFinite));
  console.log(`${k.padEnd(18)} MNAR ${Number.isFinite(g("mnar")) ? g("mnar").toFixed(0).padStart(3) : "  -"}  FDR ${(100 * g("fdr")).toFixed(1).padStart(4)}%  found ${g("tp").toFixed(1).padStart(5)} / 110  absent ${g("absentFc").toFixed(2)}  |scattered FC| ${g("scat").toFixed(2)}  two-sample protein called ${r.filter((o) => o.fewCalled).length}/20`);
}
