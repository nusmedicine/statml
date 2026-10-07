/* ============================================================================
   Widget 89 · imputation — the forest table, the examples and the claims the
   page makes.

       node widgets/_lab/imputation-verify.mjs

   §1 the forest table: every seed and filter holds one value per hole of the
      matrix the engine simulates now, and one entry rerun live reproduces it
   §2 the simulation: about a third missing, as the lesson's 35.1%
   §3 the three example proteins exist on every seed, and the filter removes
      the two-sample one and keeps the other two
   §4 the claims the arc measured and the page shows, over the 20 seeds: the
      minimum keeps an absence best, kNN and the forest shrink it; kNN makes
      the most false calls and the filter cuts them
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import * as E from "../imputation/engine.js";
import { FOREST, FOREST_SEEDS, TYPICAL_SEED } from "../imputation/forest-table.js";

let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const isNa = Number.isNaN;

const sims = {};
for (let s = 1; s <= FOREST_SEEDS; s += 1) sims[s] = E.simulateMatrix(makeRng(s));

section("§1 the forest table");
{
  assert(TYPICAL_SEED >= 1 && TYPICAL_SEED <= FOREST_SEEDS, `the typical seed ${TYPICAL_SEED} is in 1–${FOREST_SEEDS}`);
  for (let s = 1; s <= FOREST_SEEDS; s += 1) for (const filter of ["any", "half"]) {
    const obs = E.keepRows(sims[s].obs, filter).map((p) => sims[s].obs[p]);
    const holes = obs.flat().filter(isNa).length;
    assert(FOREST[s]?.[filter]?.length === holes, `seed ${s} ${filter}: ${FOREST[s]?.[filter]?.length} table values for ${holes} holes`);
  }
  // one entry live: the smaller matrix, so the check costs about 3 s
  const s = TYPICAL_SEED, filter = "half";
  const obs = E.keepRows(sims[s].obs, filter).map((p) => sims[s].obs[p]);
  const live = E.holesOf(E.imputeForest(obs, makeRng(E.forestSeed(s, filter))), obs);
  const diff = live.reduce((m, v, i) => Math.max(m, Math.abs(v - FOREST[s][filter][i])), 0);
  assert(diff === 0, `seed ${s} ${filter} rerun live matches the table (largest difference ${diff / 100} log2)`);
}

section("§2 the simulation");
{
  const share = Object.values(sims).map((sim) => sim.obs.flat().filter(isNa).length / (sim.obs.length * E.N));
  const m = E.mean(share);
  assert(m > 0.3 && m < 0.36, `mean share missing ${(100 * m).toFixed(1)}% (the lesson's 35.1%)`);
  for (const sim of Object.values(sims)) assert(sim.obs.length === E.PROTEINS && sim.obs.every((r) => E.seenIn(r) > 0), "600 proteins, each measured somewhere");
}

section("§3 the example proteins");
for (let s = 1; s <= FOREST_SEEDS; s += 1) {
  const sim = sims[s], all = sim.obs.map((r, p) => p);
  const knn = E.score(sim, all, E.imputeKnn(sim.obs));
  const min = E.score(sim, all, E.imputeMin(sim.obs));
  const ex = E.pickExamples(sim, knn.padj, min.fc);
  const kept = new Set(E.keepRows(sim.obs, "half"));
  assert(sim.meta[ex.absent]?.kind === "absent", `seed ${s}: an absent-in-healthy protein`);
  assert(ex.few !== undefined && sim.meta[ex.few].kind === "null" && E.seenIn(sim.obs[ex.few]) <= 4, `seed ${s}: a no-difference protein measured in ${ex.few === undefined ? "?" : E.seenIn(sim.obs[ex.few])} samples`);
  assert(ex.scattered !== undefined, `seed ${s}: a scattered-holes protein`);
  assert(!kept.has(ex.few) && kept.has(ex.absent) && kept.has(ex.scattered), `seed ${s}: the filter removes the two-sample protein only`);
}

section("§4 the claims, over the seeds (mixed included)");
{
  const acc = { min: [], knn: [], forest: [], knnHalf: [], mixed: [] };
  for (let s = 1; s <= FOREST_SEEDS; s += 1) {
    const sim = sims[s], all = sim.obs.map((r, p) => p);
    acc.min.push(E.score(sim, all, E.imputeMin(sim.obs)));
    acc.knn.push(E.score(sim, all, E.imputeKnn(sim.obs)));
    acc.forest.push(E.score(sim, all, E.fillFromHoles(sim.obs, FOREST[s].any)));
    acc.mixed.push(E.score(sim, all, E.imputeMixed(sim.obs, E.imputeMin(sim.obs), E.fillFromHoles(sim.obs, FOREST[s].any))));
    const half = E.keepRows(sim.obs, "half");
    acc.knnHalf.push(E.score(sim, half, E.imputeKnn(half.map((p) => sim.obs[p]))));
  }
  const g = (k, f) => E.mean(acc[k].map((x) => x[f]).filter(Number.isFinite));
  console.log(`  absence (true 6): minimum ${g("min", "absentFc").toFixed(2)}, kNN ${g("knn", "absentFc").toFixed(2)}, forest ${g("forest", "absentFc").toFixed(2)}`);
  console.log(`  FDR: minimum ${(100 * g("min", "fdr")).toFixed(1)}%, kNN ${(100 * g("knn", "fdr")).toFixed(1)}%, forest ${(100 * g("forest", "fdr")).toFixed(1)}%, kNN filtered ${(100 * g("knnHalf", "fdr")).toFixed(1)}%`);
  assert(g("min", "absentFc") > g("forest", "absentFc") && g("forest", "absentFc") > g("knn", "absentFc"), "an absence: the minimum keeps most, then the forest, then kNN");
  assert(g("knn", "fdr") > 2 * g("forest", "fdr") && g("knn", "fdr") > 0.15, "kNN makes the most false calls");
  assert(g("knnHalf", "fdr") < g("knn", "fdr") / 2, "the filter cuts kNN's false discovery rate by more than half");
  console.log(`  mixed (minimum + forest, by protein): absence ${g("mixed", "absentFc").toFixed(2)}, FDR ${(100 * g("mixed", "fdr")).toFixed(1)}%, true ${g("mixed", "tp").toFixed(1)} (minimum ${g("min", "tp").toFixed(1)}, forest ${g("forest", "tp").toFixed(1)}, kNN ${g("knn", "tp").toFixed(1)})`);
  assert(g("mixed", "absentFc") > 4 && g("mixed", "fdr") < g("forest", "fdr"), "mixed keeps an absence and makes fewer false calls than the forest");
  assert(["min", "knn", "forest"].every((k) => g("mixed", "tp") > g(k, "tp")), "mixed finds more true differences than any single method");
  assert(g("knn", "bias") > 0.5 && g("forest", "bias") > 0.3 && g("min", "bias") < -0.5, "kNN and the forest fill above the truth, the minimum below");
}

console.log(`\n${checks - fails} of ${checks} checks pass`);
if (fails) process.exit(1);
