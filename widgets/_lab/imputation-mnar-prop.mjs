// Slot 89 (2026-10-07): with the filter at 50%, does Mixed's mnar_prop (0 / 0.2 / 0.4) change the result?
//   node widgets/_lab/imputation-mnar-prop.mjs
import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST } from "../imputation/forest-table.js";
const sh = (r) => [E.seenIn(r, 0, E.NA) / E.NA, E.seenIn(r, E.NA, E.N) / E.NB];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const acc = {};
for (let s = 1; s <= 20; s += 1) {
  const sim = E.simulateMatrix(makeRng(s));
  const rows = sim.obs.map((r, p) => p).filter((p) => Math.max(...sh(sim.obs[p])) >= 0.5);
  const obs = rows.map((p) => sim.obs[p]);
  const forest = E.fillFromHoles(obs, FOREST[s].half), min = E.imputeMin(obs);
  const all = sim.obs.map((r, p) => p);
  const ex = E.pickExamples(sim, E.score(sim, all, E.imputeKnn(sim.obs)).padj, E.score(sim, all, E.imputeMin(sim.obs)).fc);
  for (const mp of [0, 0.2, 0.4]) {
    const M = obs.map((r, i) => r.map((v, j) => (Number.isNaN(v) ? (Math.min(...sh(r)) <= mp + 1e-9 ? min[i][j] : forest[i][j]) : v)));
    const sc = E.score(sim, rows, M);
    const ia = rows.indexOf(ex.absent), is = rows.indexOf(ex.scattered);
    (acc[mp] ||= []).push({ mnar: obs.filter((r) => Math.min(...sh(r)) <= mp + 1e-9).length, fdr: sc.fdr, tp: sc.tp, absentFc: sc.absentFc,
      exAbsent: ia >= 0 ? sc.fc[ia] : NaN, exScat: is >= 0 ? Math.abs(sc.fc[is]) : NaN });
  }
}
for (const [k, r] of Object.entries(acc)) {
  const g = (x) => mean(r.map((o) => o[x]).filter(Number.isFinite));
  console.log(`mnar_prop ${k}: MNAR ${g("mnar").toFixed(0).padStart(3)} of ~458  FDR ${(100 * g("fdr")).toFixed(1)}%  found ${g("tp").toFixed(1)}  absent mean ${g("absentFc").toFixed(2)}  example absent ${g("exAbsent").toFixed(2)}  example scattered |FC| ${g("exScat").toFixed(2)}`);
}
