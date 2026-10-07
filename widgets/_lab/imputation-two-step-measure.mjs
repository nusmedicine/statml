// Slot 89 (2026-10-07): filter, then mixed imputation, as one function would do it.
// keep: measured in at least `keep` of the samples of one group (none / 0.5 / 0.7 / 1.0);
// MNAR (minimum): measured in at most 0.2 of the samples of some group  [arm B, two numbers]
//              or in fewer than `keep` of some group                     [arm A, one number]
// 20 seeds; writes imputation-two-step-measure.json.   node widgets/_lab/imputation-two-step-measure.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST } from "../imputation/forest-table.js";
const sh = (r) => [E.seenIn(r, 0, E.NA) / E.NA, E.seenIn(r, E.NA, E.N) / E.NB];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const acc = {};
for (let s = 1; s <= 20; s += 1) {
  const sim = E.simulateMatrix(makeRng(s));
  for (const keep of [0, 0.5, 0.7, 1]) {
    const rows = sim.obs.map((r, p) => p).filter((p) => keep === 0 || Math.max(...sh(sim.obs[p])) >= keep - 1e-9);
    const obs = rows.map((p) => sim.obs[p]);
    const forest = keep === 0 ? E.fillFromHoles(obs, FOREST[s].any) : keep === 0.5 ? E.fillFromHoles(obs, FOREST[s].half) : E.imputeForest(obs, makeRng(E.forestSeed(s, "f" + keep)));
    const min = E.imputeMin(obs);
    const mixed = (isMnar) => obs.map((r, i) => r.map((v, j) => (Number.isNaN(v) ? (isMnar(r) ? min[i][j] : forest[i][j]) : v)));
    const arms = { B: mixed((r) => Math.min(...sh(r)) <= 0.2 + 1e-9) };
    if (keep > 0) arms.A = mixed((r) => Math.min(...sh(r)) < keep - 1e-9);
    for (const [arm, M] of Object.entries(arms)) {
      const sc = E.score(sim, rows, M);
      const mnar = obs.filter((r) => (arm === "B" ? Math.min(...sh(r)) <= 0.2 + 1e-9 : Math.min(...sh(r)) < keep - 1e-9)).length;
      (acc[`${arm}|${keep}`] ||= []).push({ kept: rows.length, mnar, fdr: sc.fdr, tp: sc.tp, absentFc: sc.absentFc });
    }
  }
}
const out = {};
for (const [k, r] of Object.entries(acc)) {
  const g = (x) => mean(r.map((o) => o[x]).filter(Number.isFinite));
  out[k] = { kept: g("kept"), mnar: g("mnar"), fdr: g("fdr"), tp: g("tp"), absentFc: g("absentFc") };
  console.log(`${k.padEnd(6)} kept ${out[k].kept.toFixed(0).padStart(3)}  MNAR ${out[k].mnar.toFixed(0).padStart(3)}  FDR ${(100 * out[k].fdr).toFixed(1).padStart(4)}%  found ${out[k].tp.toFixed(1).padStart(5)} / 110  absent ${out[k].absentFc.toFixed(2)}`);
}
// the lesson's 1,337 proteins, counted the same way
const J = JSON.parse(readFileSync(new URL("./imputation-filter-measure.json", import.meta.url), "utf8"));
const lesson = {};
for (const keep of [0, 0.5, 0.7, 1]) {
  const need = Math.ceil(keep * 11 - 1e-9);
  const kept = J.lesson.filter(([c, h]) => keep === 0 || Math.max(c, h) >= need);
  lesson[`B|${keep}`] = { kept: kept.length, mnar: kept.filter(([c, h]) => Math.min(c, h) <= 2).length };
  if (keep > 0) lesson[`A|${keep}`] = { kept: kept.length, mnar: kept.filter(([c, h]) => Math.min(c, h) < need).length };
}
console.log("lesson", JSON.stringify(lesson));
writeFileSync(new URL("./imputation-two-step-measure.json", import.meta.url), JSON.stringify({ sim: out, lesson }));
