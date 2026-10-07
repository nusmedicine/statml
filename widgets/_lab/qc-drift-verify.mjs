/* ============================================================================
   Widget 91 · qc-drift — the run, the corrections, 02-4's test, the claims the
   page draws, and the copy.

       node widgets/_lab/qc-drift-verify.mjs

   §1 the run: 104 study samples and the QCs where QC every puts them; Random
      and Grouped hold the same samples in a different order; the drift is a
      function of the position in the run
   §2 the corrections: on a run whose drift every metabolite shares, the median
      removes it all; QC-LOESS is a curve through the QCs, not the samples
   §3 the test: the rank-sum statistic is the count of pairs, symmetric, and a
      shift moves p the right way
   §4 the claims over 30 seeds: grouped and uncorrected, most nulls called;
      the median leaves them; QC-LOESS at 0.3 nearly none; random order costs
      little; the default seed is typical; the example metabolite exists
   §5 the copy: no struck word (the audit of 2026-10-08) in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";
import * as E from "../qc-drift/engine.js";

let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const SRC = readFileSync(new URL("../qc-drift/main.js", import.meta.url), "utf8");
const TYPICAL_SEED = Number(SRC.match(/const TYPICAL_SEED = (\d+)/)[1]);

section("§1 the run");
{
  const sim = E.simulate(makeRng(TYPICAL_SEED));
  for (const qc of [5, 10]) {
    const g = E.layout(sim, "grouped", qc), r = E.layout(sim, "random", qc);
    const study = (run) => run.inj.filter((x) => x.kind !== "QC").map((x) => x.s);
    assert(study(g).length === 104 && study(r).length === 104, `QC every ${qc}: 104 study samples`);
    assert(g.N === r.N && g.qcIdx.join() === r.qcIdx.join(), `QC every ${qc}: the QCs sit at the same positions in both orders`);
    assert([...study(r)].sort((a, b) => a - b).join() === study(g).join(), `QC every ${qc}: Random holds the same samples as Grouped`);
    assert(g.inj[0].kind === "QC" && g.inj[g.N - 1].kind === "QC", `QC every ${qc}: a QC first and last`);
    const gaps = g.qcIdx.slice(1).map((v, i) => v - g.qcIdx[i] - 1);
    assert(gaps.slice(0, -1).every((d) => d === qc), `QC every ${qc}: ${qc} study samples between QCs`);
    // a sample's value minus its drift is the same wherever it is run
    const s0 = g.inj.findIndex((x) => x.s === 17), s1 = r.inj.findIndex((x) => x.s === 17);
    assert(Math.abs((g.X[3][s0] - g.drift[3][s0]) - (r.X[3][s1] - r.drift[3][s1])) < 1e-12, `QC every ${qc}: a sample's drift-free value does not depend on its position`);
  }
  assert(E.METABOLITES.length === 26 && E.PER_GROUP === 52, "26 metabolites, 52 a group (02-4)");
}

section("§2 the corrections");
{
  // a run whose metabolites share one drift and have no bend or slope of their own
  const sim = E.simulate(makeRng(3));
  sim.mets.forEach((mt) => { mt.slope = 0; mt.bend = 0; });
  const run = E.layout(sim, "grouped", 5);
  /* at the QCs, which carry no biology, the median's curve follows the shared
     drift; at a study sample it also carries that sample's biology (26
     metabolites make a noisy median), which is why the median adds false calls
     in a random order (arc: 0.97 against 0.18) */
  const med = E.correct(run, "median").curve[0];
  const gap = run.qcIdx.map((i) => med[i] - run.drift[0][i]);
  const sd = Math.sqrt(E.variance(gap)), range = Math.max(...run.drift[0]) - Math.min(...run.drift[0]);
  assert(sd < 0.2 * range, `shared drift only: at the QCs the median's curve follows it (SD of the gap ${sd.toFixed(3)} against a drift of ${range.toFixed(3)} log2)`);
  const real = E.layout(E.simulate(makeRng(3)), "grouped", 5);
  const lo = E.correct(real, "qc-loess", 0.3);
  assert(lo.curve.every((c) => c.length === real.N), "QC-LOESS: a curve for every metabolite at every injection");
  // the curve is fitted to the QCs: moving a study sample does not move it
  const moved = { ...real, X: real.X.map((r) => r.slice()) };
  const sIdx = real.inj.findIndex((x) => x.kind !== "QC");
  moved.X[0][sIdx] += 5;
  const lo2 = E.correct(moved, "qc-loess", 0.3);
  assert(lo2.curve[0].every((v, i) => Math.abs(v - lo.curve[0][i]) < 1e-12), "QC-LOESS: the curve is a fit to the QCs alone");
}

section("§3 the test");
{
  const rng = makeRng(5);
  const a = Array.from({ length: 52 }, () => rng.normal(0, 1)), b = Array.from({ length: 52 }, () => rng.normal(0.8, 1));
  const t = E.rankSum(a, b);
  let pairs = 0;
  for (const x of a) for (const y of b) pairs += y > x ? 1 : 0;
  assert(t.W === pairs, `W ${t.W} is the count of pairs with the cancer value higher (${pairs})`);
  const u = E.rankSum(b, a);
  assert(Math.abs(t.p - u.p) < 1e-12, "the p-value does not depend on which group is first");
  const same = E.rankSum(a, a.slice().reverse()).p;
  assert(t.p < 1e-3 && same > 0.99, `a shift of 0.8 SD: p ${t.p.toExponential(1)}; the same values in both groups: p ${same.toFixed(3)}`);
}

section("§4 the claims over 30 seeds");
{
  const tally = { gNone: [], gMed: [], gLo: [], gLo75: [], rNone: [] };
  for (let s = 1; s <= 30; s += 1) {
    const sim = E.simulate(makeRng(s));
    const g = E.layout(sim, "grouped", 5), r = E.layout(sim, "random", 5);
    tally.gNone.push(E.score(g, g.X).fp);
    tally.gMed.push(E.score(g, E.correct(g, "median").Y).fp);
    tally.gLo.push(E.score(g, E.correct(g, "qc-loess", 0.3).Y).fp);
    tally.gLo75.push(E.score(g, E.correct(g, "qc-loess", 0.75).Y).fp);
    tally.rNone.push(E.score(r, r.X).fp);
    const ex = E.mostDrift(g);
    assert(Number.isInteger(ex) && !g.mets[ex].real, `seed ${s}: the example metabolite is one not truly different`);
  }
  const m = (k) => E.mean(tally[k]);
  assert(m("gNone") > 12, `grouped, uncorrected: ${m("gNone").toFixed(1)} of 22 nulls called`);
  assert(m("gMed") > 12, `grouped, median: ${m("gMed").toFixed(1)} of 22 — it removes only the shared drift`);
  assert(m("gLo") < 1.5, `grouped, QC-LOESS 0.3: ${m("gLo").toFixed(2)}`);
  assert(m("gLo75") > m("gLo"), `grouped, QC-LOESS 0.75 leaves more than 0.3: ${m("gLo75").toFixed(2)}`);
  assert(m("rNone") < 1, `random order, uncorrected: ${m("rNone").toFixed(2)}`);
  const sim = E.simulate(makeRng(TYPICAL_SEED)), g = E.layout(sim, "grouped", 5);
  const a = E.score(g, g.X).fp, b = E.score(g, E.correct(g, "qc-loess", 0.3).Y).fp;
  assert(Math.abs(a - m("gNone")) <= 3 && b <= 1, `the default seed ${TYPICAL_SEED} is typical: ${a} uncorrected, ${b} after QC-LOESS`);
}

section("§5 the copy: no struck word in a reader-facing string (the audit of 2026-10-08)");
{
  const src = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
  const strings = [...src.matchAll(/"([^"\n]{3,})"|`([^`\n]{3,})`/g)].map((m) => m[1] || m[2]);
  const struck = /\b(beat|drift left|gives?|becomes?|track|finds?|worth|says|predicts?|you|your|never|carr(y|ies)|compares?|reach(es)?|sits?|stands?|waits?|chose|takes|real|tick)\b/i;
  const visible = strings.map((s) => s.replace(/\$\{[^}]*\}/g, "")).filter((s) => / /.test(s.trim()));
  for (const s of visible) assert(!struck.test(s), `struck word in "${s.slice(0, 80)}"`);
  const card = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "qc-drift");
  assert(!struck.test(card.blurb) && card.blurb.length <= 120, "the blurb carries no struck word and fits 120 characters");
  assert(visible.some((s) => /confounded with/.test(s)), "the subtitle says drift is confounded with the group difference");
}

console.log(`\n${checks - fails} of ${checks} checks passed`);
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
