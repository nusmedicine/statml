// Slot 89 (2026-10-07): can ONE threshold do both jobs? With a share t:
//   a protein is "detected" in a group if measured in at least t of that group's samples;
//   detected in both groups -> MAR (random forest); in one group only -> MNAR (the minimum);
//   in neither -> removed.
// Against the two-threshold version (filter at t, MNAR if measured in at most 0.2 of a group),
// over 20 seeds.   node widgets/_lab/imputation-one-threshold.mjs
import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST } from "../imputation/forest-table.js";

const share = (r, a, b) => E.seenIn(r, a, b) / (b - a);
const shares = (r) => [share(r, 0, E.NA), share(r, E.NA, E.N)];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const acc = {};
for (let s = 1; s <= 20; s += 1) {
  const sim = E.simulateMatrix(makeRng(s));
  for (const t of [0.5, 0.7]) {
    const rows = sim.obs.map((r, p) => p).filter((p) => Math.max(...shares(sim.obs[p])) >= t - 1e-9);
    const obs = rows.map((p) => sim.obs[p]);
    const forest = t === 0.5 ? E.fillFromHoles(obs, FOREST[s].half) : E.imputeForest(obs, makeRng(E.forestSeed(s, "f" + t)));
    const min = E.imputeMin(obs);
    const fill = (isMnar) => obs.map((r, i) => r.map((v, j) => (Number.isNaN(v) ? (isMnar(r) ? min[i][j] : forest[i][j]) : v)));
    const variants = {
      [`one threshold ${t}`]: fill((r) => Math.min(...shares(r)) < t - 1e-9),
      [`filter ${t} + MNAR at 0.2`]: fill((r) => Math.min(...shares(r)) <= 0.2 + 1e-9),
      [`filter ${t} + forest only`]: forest,
    };
    for (const [k, M] of Object.entries(variants)) {
      const sc = E.score(sim, rows, M);
      const mnar = obs.filter((r) => (k.startsWith("one") ? Math.min(...shares(r)) < t - 1e-9 : k.includes("0.2") ? Math.min(...shares(r)) <= 0.2 + 1e-9 : false)).length;
      (acc[k] ||= []).push({ fdr: sc.fdr, tp: sc.tp, fp: sc.fp, absentFc: sc.absentFc, kept: rows.length, mnar });
    }
  }
}
for (const [k, r] of Object.entries(acc)) {
  const g = (x) => mean(r.map((o) => o[x]).filter(Number.isFinite));
  console.log(`${k.padEnd(30)} kept ${g("kept").toFixed(0)}  MNAR ${g("mnar").toFixed(0).padStart(3)}  FDR ${(100 * g("fdr")).toFixed(1).padStart(4)}%  found ${g("tp").toFixed(1)} / 110  false ${g("fp").toFixed(1)}  absent ${g("absentFc").toFixed(2)}`);
}
