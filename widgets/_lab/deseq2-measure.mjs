/* Widget 78 `deseq2`, measured before it is mocked (2026-09-22). The engine is
 * the widget's own (`widgets/deseq2/engine.js`), so every number here is a
 * number the page can print. Four pages, four claims:
 *
 *   MODEL — the variance of a gene's counts across replicates is mu + alpha·mu²;
 *      Poisson's is mu. At mu = 100 and alpha = 0.05 the SD is 24 against 10.
 *   DISPERSION — with few replicates a gene's own dispersion estimate is noise;
 *      the trend is the prior, the MAP estimate is the posterior. The number:
 *      the realised FDR at padj < 0.1 under the gene-wise, the shrunk and the
 *      true dispersion, from 2 to 6 replicates.
 *   TEST — the LFC funnel at low counts; what LFC shrinkage removes and what it
 *      costs (true effects at low counts pulled in too).
 *   TRANSFORM — the SD across replicates against the mean under raw counts,
 *      log2(x + 1) and the vst.
 *
 *   node widgets/_lab/deseq2-measure.mjs        (~5 s)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, analyse, median, log2, nbPmf, poissonPmf } from "../deseq2/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const findings = [];
const say = (s) => { console.log(s); findings.push(s); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

/* --- MODEL ------------------------------------------------------------------------ */
say("MODEL — variance against mean: Poisson mu, negative binomial mu + alpha·mu²");
for (const [mu, alpha] of [[10, 0.05], [100, 0.05], [1000, 0.05], [100, 0.5], [100, 0.01]]) {
  const sdP = Math.sqrt(mu), sdNB = Math.sqrt(mu + alpha * mu * mu);
  let tail = 0; for (let k = 0; k < 20 * mu + 100; k += 1) if (k > 2 * mu) tail += nbPmf(k, mu, alpha);
  let tailP = 0; for (let k = 0; k < 20 * mu + 100; k += 1) if (k > 2 * mu) tailP += poissonPmf(k, mu);
  say(`  mu ${String(mu).padStart(5)} alpha ${f(alpha, 2)}: SD Poisson ${f(sdP, 1).padStart(5)}  NB ${f(sdNB, 1).padStart(6)}  (CV ${pct(sdNB / mu)}); P(count > 2·mu) Poisson ${tailP.toExponential(1)}  NB ${tail.toExponential(1)}`);
}
{
  /* a gene at mu = 100 across many replicates: the empirical variance matches */
  const rng = makeRng(3);
  const sim = simulate(rng, { genes: 2000, reps: 3, deShare: 0 });
  const an = analyse(sim);
  const rows = sim.counts.map((row, g) => ({ m: an.baseMean[g], v: sd(row.map((v, j) => v / an.sf[j])) ** 2, a: sim.alphaT[g] }));
  for (const [a, b] of [[5, 20], [20, 100], [100, 1000], [1000, 1e9]]) {
    const gs = rows.filter((r) => r.m >= a && r.m < b);
    say(`  null genes, mean ${String(a).padStart(4)}–${b === 1e9 ? "    " : String(b).padStart(4)}: n ${String(gs.length).padStart(4)}, median variance/mean ${f(median(gs.map((r) => r.v / r.m)), 1).padStart(6)} (Poisson: 1)`);
  }
}

/* --- DISPERSION and TEST, from 2 to 6 replicates --------------------------------------- */
say("DISPERSION — 1,200 genes (the widget's size) and 4,000; a tenth DE; realised FDR at padj < 0.1 and power, by replicates");
const table = [];
for (const genes of [1200, 4000]) {
  for (const reps of [2, 3, 4, 6]) {
    const rng = makeRng(7);
    const t0 = performance.now();
    const sim = simulate(rng, { genes, reps });
    const an = analyse(sim);
    const ms = performance.now() - t0;
    const { expressed } = an;
    const nullG = expressed.filter((g) => !sim.isDE[g]), deG = expressed.filter((g) => sim.isDE[g]);
    const line = (name, res) => {
      const fp = nullG.filter((g) => res[g].padj < 0.1).length, tp = deG.filter((g) => res[g].padj < 0.1).length;
      return `${name} FDR ${pct(fp / Math.max(1, fp + tp)).padStart(6)} power ${pct(tp / deG.length).padStart(6)} (null p<0.05 ${pct(nullG.filter((g) => res[g].p < 0.05).length / nullG.length)})`;
    };
    const lo = nullG.filter((g) => an.baseMean[g] < 20);
    const err = (est) => median(lo.map((g) => Math.abs(Math.log(est[g] / sim.alphaT[g]))));
    say(`  genes ${genes} reps ${reps} (${f(ms, 0)} ms): trend a0 ${f(an.trend.a0, 3)} a1 ${f(an.trend.a1, 2)} (true 0.05, 2); prior sd ${f(Math.sqrt(an.prior.priorVar), 2)}; outliers kept ${an.outlier.filter(Boolean).length}; low-count |log error| gene-wise ${f(err(an.alphaGW), 2)} shrunk ${f(err(an.alphaMAP), 2)}`);
    say(`     ${line("gene-wise", an.resGW)} | ${line("shrunk", an.resMAP)} | ${line("true", an.resTrue)}`);
    table.push({ genes, reps, ms: Math.round(ms), trend: an.trend, priorSd: Math.sqrt(an.prior.priorVar) });
    if (genes === 1200 && reps === 3) {
      /* TEST: the funnel and the shrinkage's cost */
      say("TEST — the LFC funnel and LFC shrinkage at 3 vs 3, 1,200 genes");
      say(`  LFC prior: null share ${f(an.lfcPrior.pi0, 2)} (true 0.90), effect sd ${f(Math.sqrt(an.lfcPrior.tau2), 2)}`);
      for (const [a, b] of [[1, 10], [10, 100], [100, 1000], [1000, 1e9]]) {
        const gs = nullG.filter((g) => an.baseMean[g] >= a && an.baseMean[g] < b);
        if (!gs.length) continue;
        say(`    null, baseMean ${String(a).padStart(4)}–${b === 1e9 ? "    " : String(b).padStart(4)}: n ${String(gs.length).padStart(4)}, |LFC| > 1: ${String(gs.filter((g) => Math.abs(an.resMAP[g].lfc) > 1).length).padStart(3)} -> ${String(gs.filter((g) => Math.abs(an.shrunk[g]) > 1).length).padStart(3)} shrunk; median SE ${f(median(gs.map((g) => an.resMAP[g].se)), 2)}`);
      }
      const deBig = deG.filter((g) => Math.abs(sim.lfcT[g]) > 1);
      say(`    DE genes with true |LFC| > 1 (n ${deBig.length}): read as |LFC| > 1 before ${deBig.filter((g) => Math.abs(an.resMAP[g].lfc) > 1).length}, after ${deBig.filter((g) => Math.abs(an.shrunk[g]) > 1).length}; with baseMean < 10: ${deBig.filter((g) => an.baseMean[g] < 10).length} true, ${deBig.filter((g) => an.baseMean[g] < 10 && Math.abs(an.shrunk[g]) > 1).length} kept`);
      /* one gene's fit, for the Test page's worked example: pick a DE gene near baseMean 100 */
      const ex = deG.filter((g) => an.baseMean[g] > 60 && an.baseMean[g] < 200).sort((a, b) => an.resMAP[a].p - an.resMAP[b].p)[Math.floor(deG.length / 40)];
      if (ex !== undefined) {
        const r = an.resMAP[ex], fit = an.fits[ex];
        say(`  one DE gene (index ${ex}): counts ${sim.counts[ex].join(" ")}; size factors ${an.sf.map((v) => f(v, 2)).join(" ")}; group means ${f(fit.q[0], 1)} ${f(fit.q[1], 1)}; alpha gene-wise ${f(an.alphaGW[ex], 3)} trend ${f(an.alphaTr[ex], 3)} MAP ${f(an.alphaMAP[ex], 3)}; LFC ${f(r.lfc, 2)} (true ${f(sim.lfcT[ex], 2)}) SE ${f(r.se, 2)} W ${f(r.W, 2)} p ${r.p.toExponential(1)} padj ${r.padj.toExponential(1)}; shrunk LFC ${f(an.shrunk[ex], 2)}`);
      }
      /* TRANSFORM: SD across the replicates against the mean */
      say("TRANSFORM — SD across the six replicates (null genes, normalised counts) by mean: raw, log2(x + 1), vst");
      for (const [a, b] of [[1, 5], [5, 20], [20, 100], [100, 1000], [1000, 1e9]]) {
        const gs = nullG.filter((g) => an.baseMean[g] >= a && an.baseMean[g] < b);
        if (!gs.length) continue;
        const norm = gs.map((g) => sim.counts[g].map((v, j) => v / an.sf[j]));
        const s = (fn) => median(norm.map((row) => sd(row.map(fn))));
        say(`    mean ${String(a).padStart(4)}–${b === 1e9 ? "    " : String(b).padStart(4)}: n ${String(gs.length).padStart(4)}  raw ${f(s((v) => v), 1).padStart(6)}  log2(x+1) ${f(s((v) => log2(v + 1)), 2)}  vst ${f(s(an.vst), 2)}`);
      }
      say(`  vst of 0, 1, 10, 100, 1000, 10000: ${[0, 1, 10, 100, 1000, 10000].map((x) => f(an.vst(x), 2)).join(" ")}; log2(x + 1): ${[0, 1, 10, 100, 1000, 10000].map((x) => f(log2(x + 1), 2)).join(" ")}`);
    }
  }
}
/* determinism: the same seed twice */
{
  const a = analyse(simulate(makeRng(11), { genes: 600, reps: 3 })), b = analyse(simulate(makeRng(11), { genes: 600, reps: 3 }));
  say(`DETERMINISM — same seed twice: trend ${a.trend.a0 === b.trend.a0 && a.trend.a1 === b.trend.a1}, every MAP dispersion ${a.alphaMAP.every((v, g) => v === b.alphaMAP[g])}`);
}
fs.writeFileSync(path.join(here, "deseq2-measure.json"), JSON.stringify({ when: new Date().toISOString(), table, findings }, null, 2));
