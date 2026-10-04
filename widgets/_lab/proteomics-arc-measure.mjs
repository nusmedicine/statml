// The proteomics and metabolomics arc (PHM5003 09), measured before anything is
// drawn. `node widgets/_lab/proteomics-arc-measure.mjs [lesson folder]`.
//
// The lesson folder (default ../jupyterbook/phm5003/notebook/09 - …) is read
// for its two result tables: the real-data checks need them, the simulations
// do not. Every simulation's arithmetic is in proteomics-arc-model.js, which
// the mock imports, so the page and this script cannot disagree.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./proteomics-arc-model.js";

const here = dirname(fileURLToPath(import.meta.url));
const lesson = process.argv[2] ||
  join(here, "../../../jupyterbook/phm5003/notebook/09 - Proteomics & Metabolomics Analysis");
const out = [];
// derived numbers from the lesson's own tables, for the mock (not the tables themselves)
const real = {};
const say = (s = "") => { out.push(s); console.log(s); };
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const seeds = (n) => Array.from({ length: n }, (_, i) => i + 1);

/* ------------------------------------------------------------ real data */

function readTsv(name) {
  const lines = readFileSync(join(lesson, name), "utf8").trim().split(/\r?\n/);
  const head = lines[0].split("\t");
  return lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i], v])));
}

if (existsSync(join(lesson, "Results_differential_limma.tsv"))) {
  const L = readTsv("Results_differential_limma.tsv");
  const kc = Object.keys(L[0]).filter((k) => k.startsWith("abundance_cancer"));
  const kh = Object.keys(L[0]).filter((k) => k.startsWith("abundance_healthy"));
  const rows = L.map((r) => [...kc, ...kh].map((k) => Math.log2(+r[k])));
  const fit = M.limmaFit(rows, kc.length);
  let maxErr = 0, maxRel = 0;
  fit.fits.forEach((x, i) => {
    const want = +L[i].limma_t_statistic;
    maxErr = Math.max(maxErr, Math.abs(x.tMod - want));
    maxRel = Math.max(maxRel, Math.abs(x.tMod - want) / Math.abs(want));
  });
  say("REAL · 01-4's limma table, refitted here from its own abundances (log2)");
  say(`  prior: d0 = ${f(fit.prior.d0, 3)}, s0 = ${f(Math.sqrt(fit.prior.s02), 4)} (log2); residual df = ${fit.fits[0].df}`);
  say(`  moderated t against the file's limma_t_statistic: max |Δ| ${maxErr.toExponential(2)}, max relative ${maxRel.toExponential(2)}`);
  const ordP = M.bh(fit.fits.map((x) => x.p));
  const modP = M.bh(fit.fits.map((x) => x.pMod));
  const nO = ordP.filter((p) => p < 0.05).length, nM = modP.filter((p) => p < 0.05).length;
  say(`  on log2, at BH < 0.05: ordinary pooled t ${nO}, moderated t ${nM} (the file's limma: ${L.filter((r) => +r.adj_p_value < 0.05).length})`);
  const shrink = fit.fits.map((x) => x.s2post / x.s2);
  say(`  posterior / own variance: median ${f(M.median(shrink), 3)}, 5–95% ${f(M.quantile(shrink, 0.05), 3)}–${f(M.quantile(shrink, 0.95), 3)}`);

  // missingness against abundance: the imputed share per protein by decile of its mean
  const T = readTsv("Results_differential_ttest.tsv");
  const pr = L.map((r, i) => ({ imp: +r.imputed, ic: +r.imputed_cancer, ih: +r.imputed_healthy, ab: M.mean(rows[i]), fc: +r.log2_foldchange }));
  pr.sort((a, b) => a.ab - b.ab);
  say("REAL · 01-3's imputation, read from 01-4's table: share of values imputed, by decile of the protein's mean log2 abundance");
  const dec = [];
  for (let d = 0; d < 10; d += 1) {
    const s = pr.slice(Math.floor((d * pr.length) / 10), Math.floor(((d + 1) * pr.length) / 10));
    dec.push(M.mean(s.map((x) => x.imp)));
  }
  say(`  lowest → highest: ${dec.map(pct).join("  ")}`);
  say(`  values imputed overall: ${pct(M.mean(pr.map((x) => x.imp)))}; proteins with any: ${pr.filter((x) => x.imp > 0).length} of ${pr.length}`);
  const oneSided = pr.filter((x) => (x.ic >= 0.8 && x.ih === 0) || (x.ih >= 0.8 && x.ic === 0));
  say(`  proteins imputed in ≥ 80% of one group and none of the other: ${oneSided.length}; their |log2FC| (limma) median ${f(M.median(oneSided.map((x) => Math.abs(x.fc))))}`);
  // all of them are missing in CANCER and seen in every healthy sample; a detection
  // limit would put cancer below healthy, so the sign is the check
  const missC = L.map((r, i) => ({ r, i })).filter(({ r }) => +r.imputed_cancer >= 0.8 && +r.imputed_healthy === 0);
  const higher = missC.filter(({ r }) => +r.log2_foldchange > 0).length;
  say(`  missing in ≥ 9 of 11 cancer, seen in all 11 healthy: ${missC.length}; log2FC (cancer/healthy) median ${f(M.median(missC.map(({ r }) => +r.log2_foldchange)))}, ${higher} come out HIGHER in cancer, none at |log2FC| ≥ 1, ${missC.filter(({ r }) => +r.adj_p_value < 0.05).length} at adj p < 0.05`);
  const sdImp = missC.filter(({ r }) => +r.imputed_cancer === 1).map(({ i }) => Math.sqrt(M.variance(rows[i].slice(0, kc.length))));
  const sdSeen = missC.map(({ i }) => Math.sqrt(M.variance(rows[i].slice(kc.length))));
  say(`  their spread (SD, log2): the imputed cancer values ${f(M.median(sdImp), 3)} where all 11 were imputed (${sdImp.length} proteins), the measured healthy values ${f(M.median(sdSeen), 3)}`);
  real.limma = { d0: fit.prior.d0, s0: Math.sqrt(fit.prior.s02), df: fit.fits[0].df, ordinary: nO, moderated: nM,
    ttestRaw: T.filter((r) => +r.adj_p_value < 0.05).length, pairs: fit.fits.map((x) => [+x.s2.toPrecision(4), +x.s2post.toPrecision(4)]) };
  real.imputation = { deciles: dec, overall: M.mean(pr.map((x) => x.imp)), anyImputed: pr.filter((x) => x.imp > 0).length, proteins: pr.length,
    oneSided: missC.map(({ r, i }) => ({ protein: r.protein, fc: +r.log2_foldchange, padj: +r.adj_p_value, ic: +r.imputed_cancer,
      values: rows[i].map((v) => +v.toFixed(3)) })) };
  say();
} else {
  say(`(lesson tables not found at ${lesson}; real-data checks skipped)`);
}

/* ------------------------------------------------- A · 88 target-decoy */

say("A · 88 target-decoy — 5,000 spectra, 60% with their peptide in the database, 50 seeds");
{
  const acc = [], est = [];
  for (const s of seeds(50)) {
    const rng = M.makeRng(s);
    const rows = M.fdrCurve(M.simulateSearch(rng));
    acc.push(M.acceptAt(rows, 0.01));
    const at = rows.find((r) => r.T >= 1000);
    est.push([at.est, at.tru]);
  }
  say(`  accepted at q ≤ 1%: ${f(M.mean(acc.map((a) => a.accepted)), 0)} PSMs; realised FDR mean ${pct(M.mean(acc.map((a) => a.trueFdr)))}, range ${pct(Math.min(...acc.map((a) => a.trueFdr)))}–${pct(Math.max(...acc.map((a) => a.trueFdr)))}`);
  say(`  the last 10% of the accepted list (nearest the threshold): ${pct(M.mean(acc.map((a) => a.tailRate)))} wrong — the list's 1% is not each match's`);
  say(`  at the first 1,000 targets: decoy estimate ${pct(M.mean(est.map((e) => e[0])))} vs true ${pct(M.mean(est.map((e) => e[1])))}`);
  // sensitivity: fewer spectra in the database
  for (const inDb of [0.3, 0.9]) {
    const a = seeds(20).map((s) => M.acceptAt(M.fdrCurve(M.simulateSearch(M.makeRng(s), { inDb })), 0.01));
    say(`  ${pct(inDb)} in the database: ${f(M.mean(a.map((x) => x.accepted)), 0)} accepted, realised ${pct(M.mean(a.map((x) => x.trueFdr)))}, near threshold ${pct(M.mean(a.map((x) => x.tailRate)))}`);
  }
  // protein inference on a simulated proteome
  const inf = seeds(20).map((s) => {
    const rng = M.makeRng(100 + s);
    const { proteins, observed } = M.simulateProteome(rng);
    const g = M.inferProteins(proteins, observed);
    const byId = new Map(proteins.map((p) => [p.id, p]));
    const rep = g.filter((x) => x.reported);
    return {
      present: proteins.filter((p) => p.present).length,
      reported: rep.length,
      multi: rep.filter((x) => x.ids.length > 1).length,
      absentOnly: rep.filter((x) => x.ids.every((id) => !byId.get(id).present)).length,
      presentDropped: proteins.filter((p) => p.present && !rep.some((x) => x.ids.includes(p.id))).length,
      subsumable: g.filter((x) => x.subsumable).length,
    };
  });
  const av = (k) => f(M.mean(inf.map((x) => x[k])), 1);
  say(`  inference, 60 families × 3 isoforms, half present, half of peptides seen (20 seeds): present ${av("present")}, reported groups ${av("reported")} (${av("multi")} with more than one protein), groups of absent proteins only ${av("absentOnly")}, present proteins in no reported group ${av("presentDropped")}, subsumable ${av("subsumable")}`);
}
say();

/* --------------------------------------------------- B · 89 imputation */

say("B · 89 imputation — 600 proteins, 11 vs 11, a soft detection limit, 15% DE, 3% absent in healthy");
{
  const methods = ["complete", "observed", "min", "lowdraw", "knn", "forest"];
  const acc = Object.fromEntries(methods.map((m) => [m, []]));
  let missShare = [];
  const t0 = Date.now();
  const nSeeds = 5;
  for (const s of seeds(nSeeds)) {
    const rng = M.makeRng(s);
    const sim = M.simulateMatrix(rng);
    const cells = sim.obs.length * sim.obs[0].length;
    missShare.push(sim.obs.flat().filter(Number.isNaN).length / cells);
    const filled = {
      complete: sim.truth,
      min: M.imputeMin(sim.obs),
      lowdraw: M.imputeLowDraw(sim.obs, M.makeRng(1000 + s)),
      knn: M.imputeKnn(sim.obs, 10),
      forest: M.imputeForest(sim.obs, M.makeRng(2000 + s)),
    };
    for (const m of Object.keys(filled)) acc[m].push(M.scoreImputation(sim, filled[m]));
    // "observed": test only what was measured, where both groups have ≥ 2 values
    {
      const { obs, meta, nA } = sim;
      const p = obs.map((r) => {
        const a = r.slice(0, nA).filter((v) => !Number.isNaN(v)), b = r.slice(nA).filter((v) => !Number.isNaN(v));
        return a.length >= 2 && b.length >= 2 ? M.welch(a, b).p : NaN;
      });
      const keep = p.map((v, i) => i).filter((i) => !Number.isNaN(p[i]));
      const adj = M.bh(keep.map((i) => p[i]));
      let fp = 0, tp = 0;
      keep.forEach((i, k) => { if (adj[k] < 0.05) (meta[i].kind === "null" ? fp += 1 : tp += 1); });
      acc.observed.push({ rmse: NaN, bias: NaN, fp, tp, real: meta.filter((m) => m.kind !== "null").length,
        nul: meta.filter((m) => m.kind === "null").length, fdr: fp / Math.max(1, fp + tp), onoffFc: NaN, untested: obs.length - keep.length });
    }
  }
  say(`  missing values: ${pct(M.mean(missShare))} of the matrix (the lesson: 35.1%); ${nSeeds} seeds in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const m of methods) {
    const a = acc[m];
    const g = (k) => M.mean(a.map((x) => x[k]));
    say(`  ${m.padEnd(9)} imputed−true bias ${f(g("bias"))}, RMSE ${f(g("rmse"))} · BH<0.05: true calls ${f(g("tp"), 1)}/${f(g("real"), 0)}, false ${f(g("fp"), 1)}/${f(g("nul"), 0)} (FDR ${pct(g("fdr"))}) · absent-in-healthy log2FC ${f(g("onoffFc"))} (true 6)${m === "observed" ? ` · untested ${f(g("untested"), 1)}` : ""}`);
  }
}
say();

/* -------------------------------------------------------- C · 90 limma */

say("C · 90 limma — 2,000 proteins, variances from limma's own prior (d0 4, s0 0.3), 10% DE at |log2FC| 0.5–1.5, 20 seeds");
for (const n of [3, 5, 11]) {
  const r = seeds(20).map((s) => {
    const sim = M.simulateVariances(M.makeRng(s), { n });
    const fit = M.limmaFit(sim.rows, n);
    const po = M.bh(fit.fits.map((x) => x.p)), pm = M.bh(fit.fits.map((x) => x.pMod));
    const cnt = (adj) => {
      let tp = 0, fp = 0;
      adj.forEach((p, i) => { if (p < 0.05) (sim.meta[i].de ? tp += 1 : fp += 1); });
      return { tp, fp, fdr: fp / Math.max(1, tp + fp) };
    };
    // the top 50 by |t|: how many are null, and how small their variance
    const top = (key) => fit.fits.map((x, i) => [Math.abs(x[key]), i]).sort((a, b) => b[0] - a[0]).slice(0, 50).map((x) => x[1]);
    const nullsIn = (ix) => ix.filter((i) => !sim.meta[i].de).length;
    const fcMatch = Math.max(...fit.fits.map((x, i) => Math.abs(x.diff - (M.mean(sim.rows[i].slice(0, n)) - M.mean(sim.rows[i].slice(n))))));
    return { o: cnt(po), m: cnt(pm), d0: fit.prior.d0, s0: Math.sqrt(fit.prior.s02), topO: nullsIn(top("t")), topM: nullsIn(top("tMod")), fcMatch,
      de: sim.meta.filter((x) => x.de).length };
  });
  const g = (fn) => M.mean(r.map(fn));
  say(`  n = ${String(n).padStart(2)} per group: prior fitted d0 ${f(g((x) => x.d0), 1)}, s0 ${f(g((x) => x.s0), 3)} · ordinary t: ${f(g((x) => x.o.tp), 1)} true, ${f(g((x) => x.o.fp), 1)} false (FDR ${pct(g((x) => x.o.fdr))}) · moderated: ${f(g((x) => x.m.tp), 1)} true, ${f(g((x) => x.m.fp), 1)} false (FDR ${pct(g((x) => x.m.fdr))}) of ${f(g((x) => x.de), 0)} · nulls in the top 50: ordinary ${f(g((x) => x.topO), 1)}, moderated ${f(g((x) => x.topM), 1)} · log2FC identical to ${g((x) => x.fcMatch).toExponential(1)}`);
}
say();

/* ----------------------------------------------------- D · 91 qc-drift */

say("D · 91 qc-drift — 26 metabolites, 40 + 40 samples, a pooled QC every 5th injection, 4 real differences at ±0.6 log2 (two up, two down), 100 seeds");
for (const order of ["random", "grouped"]) {
  const r = seeds(100).map((s) => {
    const run = M.simulateRun(M.makeRng(s), { order });
    return {
      none: M.scoreRun(run, run.X),
      median: M.scoreRun(run, M.correctMedian(run)),
      "loess .3": M.scoreRun(run, M.correctQcLoess(run, 0.3)),
      "loess .75": M.scoreRun(run, M.correctQcLoess(run, 0.75)),
      // the drift itself removed: the floor any correction is judged against
      truth: M.scoreRun(run, run.X.map((row, m) => row.map((v, i) => v - run.drift[m][i]))),
    };
  });
  say(`  run order ${order}:`);
  for (const k of ["none", "median", "loess .3", "loess .75", "truth"]) {
    const g = (fn) => M.mean(r.map((x) => fn(x[k])));
    say(`    ${k.padEnd(9)} QC RSD median ${pct(g((x) => M.median(x.rsd)))}, metabolites under 20% ${f(g((x) => x.rsd.filter((v) => v < 0.2).length), 1)}/26 · BH<0.05: true ${f(g((x) => x.tp), 2)}/4, false ${f(g((x) => x.fp), 2)}/22 · runs with any false call ${pct(M.mean(r.map((x) => (x[k].fp > 0 ? 1 : 0))))}`);
  }
}

// The span: each one wins somewhere, which is the rule for offering it as a choice.
// "Drift left" is what the correction leaves in the study samples, against the
// drift-free values; the QC RSD is measured on the QCs the curve went through.
say("  the LOESS span, run order grouped, 100 seeds:");
for (const bendSd of [0, 0.3]) for (const qcEvery of [5, 10]) for (const span of [0.3, 0.75]) {
  const s = seeds(100).map((sd) => {
    const run = M.simulateRun(M.makeRng(sd), { order: "grouped", bendSd, qcEvery });
    const Y = M.correctQcLoess(run, span);
    const sc = M.scoreRun(run, Y);
    const left = run.X.map((row, m) => {
      const r = row.map((v, j) => Y[m][j] - (v - run.drift[m][j])).filter((_, j) => run.inj[j].kind !== "QC");
      const mu = M.mean(r);
      return Math.sqrt(M.mean(r.map((x) => (x - mu) ** 2)));
    });
    return { fp: sc.fp, rsd: M.median(sc.rsd), left: M.mean(left), qcs: run.inj.filter((x) => x.kind === "QC").length };
  });
  say(`    drift ${bendSd ? "with a bend" : "smooth"}, a QC every ${qcEvery} (${s[0].qcs} QCs), span ${span}: QC RSD ${pct(M.mean(s.map((x) => x.rsd)))}, drift left ${f(M.mean(s.map((x) => x.left)), 3)} log2, false ${f(M.mean(s.map((x) => x.fp)), 2)}/22`);
}

import { writeFileSync } from "node:fs";
writeFileSync(join(here, "proteomics-arc-measure.json"), JSON.stringify({ findings: out, real }));
