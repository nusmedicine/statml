import { makeRng } from "../core/rng.js";
import { simulate, analyse, TREND_TRUE } from "../deseq2/engine.js";
for (const a0 of [0.01, 0.05, 0.5]) for (const reps of [2, 3, 6]) {
  const rows = [];
  for (const seed of [1, 7, 9]) {
    const sim = simulate(makeRng(seed), { reps, trend: { a0, a1: TREND_TRUE.a1 } });
    const t0 = performance.now(); const an = analyse(sim); const ms = performance.now() - t0;
    const ex = [...an.expressed];
    const called = ex.filter((g) => an.resMAP[g].padj < 0.1), fp = called.filter((g) => !sim.isDE[g]).length;
    const de = ex.filter((g) => sim.isDE[g]).length, found = called.length - fp;
    rows.push(`seed ${seed}: fitted a0 ${an.trend.a0.toFixed(3)} a1 ${an.trend.a1.toFixed(2)}, prior sd ${Math.sqrt(an.prior.priorVar).toFixed(2)}, called ${called.length} (FDR ${(100 * fp / Math.max(1, called.length)).toFixed(0)}%, found ${found}/${de}), lfc prior pi0 ${an.lfcPrior.pi0} tau ${Math.sqrt(an.lfcPrior.tau2).toFixed(2)}, vst(0) ${an.vst(0).toFixed(2)} vst(1e4) ${an.vst(1e4).toFixed(2)}, ${ms.toFixed(0)} ms`);
  }
  console.log(`a0 ${a0} reps ${reps}\n  ` + rows.join("\n  "));
}
