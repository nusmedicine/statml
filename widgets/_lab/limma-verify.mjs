/* ============================================================================
   Widget 90 · limma — limma's arithmetic, the claims the page draws, and the
   copy.

       node widgets/_lab/limma-verify.mjs

   §1 limma's arithmetic: trigammaInverse inverts trigamma; fitFDist recovers
      the prior the simulation draws from (d0 3, s0 0.33), over 20 seeds
   §2 what the Shrinkage page draws: every moderated variance lies between the
      protein's own and the prior's (shrinkage toward s0, up or down); the
      likelihood × prior is the posterior, and the posterior's peak is the
      moderated SD — the claim the curves make (his pick C, 2026-10-07)
   §3 what the Test page draws: the log2FC is the same in both tests, the mean
      difference of log2 abundances; Replicates n reads the first n samples
   §4 the claims over 20 seeds: at 3 vs 3 the moderated t finds several times
      the true differences at a similar FDR, at 11 vs 11 nearly the same; the
      default seed is typical
   §5 the three examples exist and are distinct on every seed and setting
   §6 the copy: no struck word (the audit of 2026-10-07) in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";
import * as E from "../limma/engine.js";

let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const TYPICAL_SEED = Number(readFileSync(new URL("../limma/main.js", import.meta.url), "utf8").match(/const TYPICAL_SEED = (\d+)/)[1]);

const sims = {};
for (let s = 1; s <= 20; s += 1) sims[s] = E.simulate(makeRng(s));

section("§1 limma's arithmetic");
{
  for (const x of [0.05, 0.3, 1, 4, 30]) {
    const y = E.trigammaInverse(x);
    assert(Math.abs(E.trigamma(y) - x) / x < 1e-6, `trigamma(trigammaInverse(${x})) = ${E.trigamma(y)}`);
  }
  const d0s = [], s0s = [];
  for (let s = 1; s <= 20; s += 1) { const f = E.fit(sims[s], 11); d0s.push(f.prior.d0); s0s.push(Math.sqrt(f.prior.s02)); }
  const md0 = E.mean(d0s), ms0 = E.mean(s0s);
  assert(Math.abs(md0 - E.D0) < 0.3, `fitted d0 averages ${md0.toFixed(2)} over 20 seeds (drawn from ${E.D0})`);
  assert(Math.abs(ms0 - E.S0) < 0.01, `fitted s0 averages ${ms0.toFixed(3)} over 20 seeds (drawn from ${E.S0})`);
}

section("§2 the Shrinkage page");
for (const n of [3, 5, 11]) {
  const f = E.fit(sims[TYPICAL_SEED], n), { d0, s02 } = f.prior;
  let between = 0;
  for (const x of f.fits) {
    const lo = Math.min(x.s2, s02), hi = Math.max(x.s2, s02);
    if (x.s2post >= lo - 1e-12 && x.s2post <= hi + 1e-12) between += 1;
  }
  assert(between === E.PROTEINS, `${n} vs ${n}: every moderated variance lies between the own and the prior's (${between} of ${E.PROTEINS})`);
  const ex = E.pickExamples(sims[TYPICAL_SEED], f);
  for (const [k, i] of Object.entries(ex)) {
    const x = f.fits[i];
    const like = E.logSdCurve(f.df, x.s2), prior = E.logSdCurve(d0, s02), post = E.logSdCurve(f.df + d0, x.s2post);
    // likelihood × prior ∝ posterior: the ratio is the same at every point of the axis
    const us = Array.from({ length: 41 }, (_, j) => -1.6 + j * 0.05);
    const ratios = us.map((u) => (like(u) * prior(u)) / post(u)).filter((r) => Number.isFinite(r) && r > 0);
    const spread = Math.max(...ratios) / Math.min(...ratios);
    assert(ratios.length > 30 && Math.abs(spread - 1) < 1e-9, `${n} vs ${n} ${k}: likelihood × prior ∝ posterior (ratio spread ${spread})`);
    // the posterior's peak is the moderated SD
    let best = -Infinity, at = 0;
    for (let u = -2.5; u <= 0.6; u += 0.0005) { const v = post(u); if (v > best) { best = v; at = u; } }
    assert(Math.abs(10 ** at - Math.sqrt(x.s2post)) / Math.sqrt(x.s2post) < 0.002, `${n} vs ${n} ${k}: the posterior peaks at ${(10 ** at).toFixed(4)}, the moderated SD ${Math.sqrt(x.s2post).toFixed(4)}`);
    let bestL = -Infinity, atL = 0;
    for (let u = -2.5; u <= 0.6; u += 0.0005) { const v = like(u); if (v > bestL) { bestL = v; atL = u; } }
    assert(Math.abs(10 ** atL - Math.sqrt(x.s2)) / Math.sqrt(x.s2) < 0.002, `${n} vs ${n} ${k}: the likelihood peaks at the own SD`);
  }
}

section("§3 the Test page");
{
  const sim = sims[TYPICAL_SEED];
  for (const n of [3, 5, 11]) {
    const f = E.fit(sim, n);
    let worst = 0;
    f.fits.forEach((x, i) => {
      const d = E.mean(sim.cancer[i].slice(0, n)) - E.mean(sim.healthy[i].slice(0, n));
      worst = Math.max(worst, Math.abs(x.diff - d));
    });
    assert(worst < 1e-12, `${n} vs ${n}: the log2FC is the mean difference of log2 abundances in both tests (largest gap ${worst})`);
    assert(f.fits.every((x) => Math.sign(x.t) === Math.sign(x.tMod)), `${n} vs ${n}: moderation changes the size of t, never its sign`);
  }
  // nested: 3 vs 3 is the first three samples of the same proteins
  const f3 = E.fit(sim, 3);
  const x = f3.fits[0], c = sim.cancer[0].slice(0, 3), h = sim.healthy[0].slice(0, 3);
  assert(Math.abs(x.diff - (E.mean(c) - E.mean(h))) < 1e-12, "Replicates 3 reads the first 3 samples of each group");
}

section("§4 the claims over 20 seeds");
{
  const tally = { 3: { o: [], m: [], of: [], mf: [] }, 11: { o: [], m: [], of: [], mf: [] } };
  for (let s = 1; s <= 20; s += 1) for (const n of [3, 11]) {
    const f = E.fit(sims[s], n);
    for (const [k, key] of [["o", "p"], ["m", "pMod"]]) {
      const adj = E.bh(f.fits.map((x) => x[key]));
      let tp = 0, fp = 0;
      adj.forEach((a, i) => { if (a < 0.05) (sims[s].meta[i].de ? tp += 1 : fp += 1); });
      tally[n][k].push(tp); tally[n][k + "f"].push(fp / Math.max(1, tp + fp));
    }
  }
  const m = (a) => E.mean(a);
  assert(m(tally[3].m) > 3 * m(tally[3].o), `3 vs 3: moderated ${m(tally[3].m).toFixed(1)} true calls against ordinary ${m(tally[3].o).toFixed(1)}`);
  assert(m(tally[3].mf) < 0.1, `3 vs 3: the moderated t's FDR ${(100 * m(tally[3].mf)).toFixed(1)}%`);
  assert(Math.abs(m(tally[11].m) - m(tally[11].o)) / m(tally[11].o) < 0.05, `11 vs 11: moderated ${m(tally[11].m).toFixed(1)}, ordinary ${m(tally[11].o).toFixed(1)}, within 5%`);
  const f = E.fit(sims[TYPICAL_SEED], 3), adj = E.bh(f.fits.map((x) => x.pMod));
  const t = adj.filter((a, i) => a < 0.05 && sims[TYPICAL_SEED].meta[i].de).length;
  assert(Math.abs(t - m(tally[3].m)) / m(tally[3].m) < 0.3, `the default seed ${TYPICAL_SEED} is typical at 3 vs 3: ${t} moderated true calls against the mean ${m(tally[3].m).toFixed(1)}`);
}

section("§5 the three examples");
for (let s = 1; s <= 200; s += 1) {
  const sim = s <= 20 ? sims[s] : E.simulate(makeRng(s));
  for (const n of [3, 5, 11]) {
    const f = E.fit(sim, n), ex = E.pickExamples(sim, f);
    const ids = [ex.small, ex.typical, ex.large];
    assert(ids.every((i) => Number.isInteger(i) && i >= 0 && i < E.PROTEINS) && new Set(ids).size === 3, `seed ${s} ${n} vs ${n}: three distinct examples (${ids})`);
    assert(!sim.meta[ex.small].de && sim.meta[ex.typical].de && sim.meta[ex.large].de, `seed ${s} ${n} vs ${n}: Small SD by chance does not differ; Typical and Large SD truly differ`);
  }
}

section("§6 the copy: no struck word in a reader-facing string (the audit of 2026-10-07)");
{
  // string literals only, comments stripped: what a reader can see
  const src = readFileSync(new URL("../limma/main.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
  const strings = [...src.matchAll(/"([^"\n]{3,})"|`([^`\n]{3,})`/g)].map((m) => m[1] || m[2]);
  // "moderated SD" and "Moderate": one word for the variance, shrink (his round 2); the t keeps limma's "moderated"
  const struck = /\b(finds?|worth|counts for|says|predicts?|pulled|unreliable|marks|moderated SDs?|moderated variance|moderate|you|your|never|carr(y|ies)|compares|reach(es)?|sits?|stands?|waits?|chose|gives|takes|real)\b/i;
  const visible = strings.map((s) => s.replace(/\$\{[^}]*\}/g, "")).filter((s) => / /.test(s.trim()));
  for (const s of visible) assert(!struck.test(s), `struck word in "${s.slice(0, 80)}"`);
  const card = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "limma");
  assert(!struck.test(card.blurb), "the blurb carries no struck word");
  assert(visible.some((s) => /moderated t-statistic/.test(s)), "the subtitle names the moderated t-statistic");
}

console.log(`\n${checks - fails} of ${checks} checks passed`);
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
