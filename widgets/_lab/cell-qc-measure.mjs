/* Widget 79 `cell-qc`, measured before it is mocked (2026-09-23). Two sources:
 * the lesson's own four samples, already parsed to `_lab/rnaseq-sc-qc.json`
 * by `_lab/rnaseq-sc-data.mjs`, and the widget's own stage
 * (`widgets/cell-qc/engine.js`), so every number the page could print is a
 * number that was run here first.
 *
 * What the real cells say (§ REAL):
 *   R1  mt% is a sample property, not a cell-type one: inside HB17_background
 *       every marker group sits at 12–15%, and HB53_background — the same
 *       tissue in the other patient — sits at 0.1%.
 *   R2  in the three clean samples mt% falls as the count rises (r = −0.40 to
 *       −0.70), the dying cell; in the hot sample it does not (+0.20, flat
 *       across every count decile).
 *   R3  nCount and nFeature are one measurement twice: r = 0.95–0.99 on the
 *       log scale, and 1,199 of the 1,421 cells either rule removes fail both.
 *   R4  the lesson's mt% < 10 removes 9,351 of HB17_background's 11,197 cells,
 *       8,088 of them on that rule alone; the sample goes from 27.6% of the
 *       pooled cells to 5.4%. At mt% < 20 it keeps 71% instead of 15%.
 *
 * What the stage has to reproduce, and what each candidate page would claim
 * (§ STAGE, § PAGES).
 *
 * `_lab/rnaseq-sc-qc.json` is NOT in the repository — it is 1.7 MB of
 * per-cell numbers from the lesson's own four matrices. Regenerate it with
 * `node widgets/_lab/rnaseq-sc-data.mjs` (~3 min) before running this.
 *
 *   node widgets/_lab/cell-qc-measure.mjs        (~5 s)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, applyFilters, confusion, embed, median, TYPES, SAMPLES, THRESHOLDS, DEFAULTS } from "../cell-qc/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const findings = [];
const say = (s) => { console.log(s); findings.push(s); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const corr = (a, b) => {
  const n = a.length, ma = mean(a), mb = mean(b);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i += 1) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; sa += x * x; sb += y * y; }
  return sab / Math.sqrt(sa * sb);
};
const quant = (a, p) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/* ===== REAL — the lesson's own cells ===================================== */
const real = JSON.parse(fs.readFileSync(path.join(here, "rnaseq-sc-qc.json"), "utf8"));
say("REAL — the four samples of 02-2, 40,564 cells, at the lesson's thresholds nFeature > 500, nCount > 800, mt% < 10");
for (const [name, s] of Object.entries(real.samples)) {
  const lc = s.nCount.map((v) => Math.log10(v + 1)), lf = s.nFeature.map((v) => Math.log10(v + 1));
  say(`  ${name.padEnd(16)} n ${String(s.cells).padStart(6)}  nCount med ${String(quant(s.nCount, 0.5)).padStart(5)}  nFeature med ${String(quant(s.nFeature, 0.5)).padStart(5)}  mt% med ${f(quant(s.mt, 0.5), 1).padStart(5)}  r(count,feature) ${f(corr(lc, lf), 3)}  r(count,mt) ${f(corr(lc, s.mt), 3).padStart(6)}  kept ${pct(s.kept / s.cells)}`);
}
{
  /* R3, as a count: the two low rules are nearly the same rule */
  let either = 0, both = 0;
  for (const s of Object.values(real.samples)) {
    for (let i = 0; i < s.cells; i += 1) {
      const a = !(s.nFeature[i] > 500), b = !(s.nCount[i] > 800);
      if (a || b) either += 1;
      if (a && b) both += 1;
    }
  }
  say(`  R3: ${either} cells fail nFeature or nCount, ${both} fail both — ${pct(both / either)} of the removals are the same cells`);
  /* R4, the recovery curve */
  const s = real.samples.HB17_background;
  const row = [5, 10, 15, 20, 25, 100].map((mt) => {
    let k = 0;
    for (let i = 0; i < s.cells; i += 1) if (s.nFeature[i] > 500 && s.nCount[i] > 800 && s.mt[i] < mt) k += 1;
    return `${mt === 100 ? "off" : `<${mt}`} ${pct(k / s.cells)}`;
  }).join("  ");
  say(`  R4: HB17_background kept as the mt%% rule moves — ${row}`);
  /* the power law */
  for (const [name, sm] of Object.entries(real.samples)) {
    const lo = quant(sm.nCount, 0.1), hi = quant(sm.nCount, 0.9);
    const fl = median(sm.nFeature.filter((_, i) => sm.nCount[i] > lo * 0.95 && sm.nCount[i] < lo * 1.05));
    const fh = median(sm.nFeature.filter((_, i) => sm.nCount[i] > hi * 0.95 && sm.nCount[i] < hi * 1.05));
    say(`  R5: ${name.padEnd(16)} nFeature ~ nCount^${f(Math.log(fh / fl) / Math.log(hi / lo), 2)} between the 10th and 90th count percentiles (${lo} → ${hi})`);
  }
}

/* ===== STAGE — does the simulation carry those four facts? ================ */
say("");
say(`STAGE — ${DEFAULTS.cells} droplets a sample, ${pct(DEFAULTS.dying)} dying, ${pct(DEFAULTS.empty)} empty, ${pct(DEFAULTS.doublet)} doublets, "${DEFAULTS.hot}" run hot at ${DEFAULTS.hotMt}% median`);
const rng = makeRng(7);
const t0 = performance.now();
const sim = simulate(rng, {});
const ms = performance.now() - t0;
const { cells } = sim;
const bySample = (key) => cells.filter((c) => c.sample === key);
say(`  ${cells.length} droplets in ${f(ms, 0)} ms`);
for (const s of SAMPLES) {
  const cs = bySample(s.key);
  const lc = cs.map((c) => Math.log10(c.nCount)), lf = cs.map((c) => Math.log10(c.nFeature));
  say(`  ${s.name.padEnd(19)} nCount med ${String(Math.round(median(cs.map((c) => c.nCount)))).padStart(5)}  nFeature med ${String(Math.round(median(cs.map((c) => c.nFeature)))).padStart(5)}  mt% med ${f(median(cs.map((c) => c.mt)), 1).padStart(5)}  r(count,feature) ${f(corr(lc, lf), 3)}  r(count,mt) ${f(corr(lc, cs.map((c) => c.mt)), 3).padStart(6)}`);
}
say("  S1 — mt% by cell type within each sample (the real data is flat: 12–15% for every group in the hot sample)");
for (const s of SAMPLES) {
  const cs = bySample(s.key).filter((c) => c.state === "good");
  say(`    ${s.name.padEnd(19)} ` + TYPES.map((t) => {
    const g = cs.filter((c) => c.type === t.key);
    return `${t.key} ${g.length ? f(median(g.map((c) => c.mt)), 1) : "–"}`;
  }).join("  "));
}
say("  S2 — mt% by count decile (the clean samples fall, the hot one does not)");
for (const s of [SAMPLES[0], SAMPLES[2]]) {
  const cs = bySample(s.key).slice().sort((a, b) => a.nCount - b.nCount);
  const d = [0, 2, 4, 6, 8].map((i) => {
    const g = cs.slice(Math.floor(i * cs.length / 10), Math.floor((i + 2) * cs.length / 10));
    return f(median(g.map((c) => c.mt)), 1);
  }).join(" → ");
  say(`    ${s.name.padEnd(19)} ${d}`);
}
say("  S3 — nFeature against nCount, and what each state looks like");
for (const st of ["good", "dying", "empty", "doublet"]) {
  const g = cells.filter((c) => c.state === st);
  say(`    ${st.padEnd(8)} n ${String(g.length).padStart(4)}  nCount med ${String(Math.round(median(g.map((c) => c.nCount)))).padStart(5)}  nFeature med ${String(Math.round(median(g.map((c) => c.nFeature)))).padStart(5)}  mt% med ${f(median(g.map((c) => c.mt)), 1).padStart(5)}`);
}

/* ===== PAGES — the claim each candidate page would make ================== */
say("");
say("PAGES");
const { keep, tally } = applyFilters(cells, THRESHOLDS);
say("  P1 Thresholds — what each rule removes, per sample, at the lesson's numbers");
for (const s of SAMPLES) {
  const t = tally[s.key];
  say(`    ${s.name.padEnd(19)} n ${t.n}  fail nFeature ${String(t.failFeature).padStart(3)}  nCount ${String(t.failCount).padStart(3)}  (both ${String(t.failBoth).padStart(3)})  mt ${String(t.failMt).padStart(3)}  mt alone ${String(t.mtAlone).padStart(3)}  kept ${pct(t.kept / t.n)}`);
}
{
  const all = Object.values(tally);
  const either = all.reduce((s, t) => s + t.failFeature + t.failCount - t.failBoth, 0);
  const both = all.reduce((s, t) => s + t.failBoth, 0);
  say(`    the two count rules overlap on ${pct(both / either)} of the cells either removes (the lesson's four samples: 84%)`);
}
say("  P2 Composition — each sample's share of the pooled cells, before and after");
{
  const before = cells.length, after = keep.filter(Boolean).length;
  for (const s of SAMPLES) {
    const t = tally[s.key];
    say(`    ${s.name.padEnd(19)} ${f(100 * t.n / before, 1)}% → ${f(100 * t.kept / after, 1)}%`);
  }
  say(`    total ${before} → ${after} (${pct(after / before)}); the lesson's own: 40,564 → 31,014 (76%), and its hot sample 27.6% → 5.4%`);
}
say("  P3 Truth — the filter read as the claim it is");
{
  const c = confusion(cells, keep);
  say(`    removed ${c.removedGood + c.removedBad}: ${c.removedBad} held a bad droplet, ${c.removedGood} held a good cell (${pct(c.removedGood / (c.removedGood + c.removedBad))} of the removals)`);
  say(`    kept ${c.keptGood + c.keptBad}: ${c.keptDoublet} doublets, ${c.keptDying} dying, ${c.keptEmpty} empty — ${pct(c.keptBad / (c.keptGood + c.keptBad))} of what is left is not one good cell`);
  for (const st of ["good", "dying", "empty", "doublet"]) {
    const idx = cells.map((c2, i) => [c2, i]).filter(([c2]) => c2.state === st);
    const removed = idx.filter(([, i]) => !keep[i]).length;
    say(`    ${st.padEnd(8)} removed ${pct(removed / idx.length)} of ${idx.length}`);
  }
}
say("  P4 Doublets — the lesson says a high count is a doublet (02-2 cell 24). An upper nFeature rule, what it catches and what it costs:");
{
  const good = cells.filter((c) => c.state === "good");
  const dbl = cells.filter((c) => c.state === "doublet");
  for (const p of [0.90, 0.95, 0.98, 0.99]) {
    const cut = quant(cells.map((c) => c.nFeature), p);
    const caught = dbl.filter((c) => c.nFeature >= cut).length;
    const lost = good.filter((c) => c.nFeature >= cut).length;
    say(`    cut at the ${f(100 * p, 0)}th percentile (nFeature ${cut}): catches ${pct(caught / dbl.length)} of the ${dbl.length} doublets and removes ${lost} good cells with them`);
  }
  const same = dbl.filter((c) => c.partner === c.type), diff = dbl.filter((c) => c.partner !== c.type);
  const cut = quant(cells.map((c) => c.nFeature), 0.95);
  say(`    a doublet of two cells of the same type: ${same.length} of ${dbl.length}; caught at the 95th percentile ${pct(same.filter((c) => c.nFeature >= cut).length / Math.max(1, same.length))} against ${pct(diff.filter((c) => c.nFeature >= cut).length / Math.max(1, diff.length))} for two different types`);
}
say("  P5 The hot sample — what moving its mt% rule buys, in the stage");
{
  for (const mt of [5, 10, 15, 20, 25, 100]) {
    const { tally: t2 } = applyFilters(cells, { ...THRESHOLDS, mt });
    const row = SAMPLES.map((s) => `${s.key} ${pct(t2[s.key].kept / t2[s.key].n)}`).join("  ");
    say(`    mt% < ${String(mt === 100 ? "off" : mt).padStart(3)}: ${row}`);
  }
}
say("  P5b The map — a droplet is placed by the profile its own molecules measured, so the error goes as 1/sqrt(nCount)");
{
  const pos = embed(makeRng(11), cells);
  const centre = {};
  for (const t of TYPES) {
    const g = cells.map((c, i) => [c, pos[i]]).filter(([c]) => c.type === t.key && c.state === "good" && c.nCount > 4000);
    centre[t.key] = [mean(g.map(([, p]) => p.x)), mean(g.map(([, p]) => p.y))];
  }
  const apart = Math.hypot(centre.hepatocyte[0] - centre.tumour[0], centre.hepatocyte[1] - centre.tumour[1]);
  const dist = (i) => Math.hypot(pos[i].x - centre[cells[i].type][0], pos[i].y - centre[cells[i].type][1]) / apart;
  const good = cells.map((c, i) => i).filter((i) => cells[i].state === "good");
  const sorted = good.slice().sort((a, b) => cells[a].nCount - cells[b].nCount);
  say(`    two type centres are ${f(apart, 2)} apart; a good cell sits this far from its own centre, in those units:`);
  for (const [lo, hi] of [[0, 1], [3, 4], [5, 6], [8, 9]]) {
    const g = sorted.slice(Math.floor(lo * sorted.length / 10), Math.floor(hi * sorted.length / 10));
    say(`      count decile ${lo + 1}: nCount med ${String(Math.round(median(g.map((i) => cells[i].nCount)))).padStart(5)}  distance ${f(median(g.map(dist)), 2)}`);
  }
  for (const st of ["dying", "empty", "doublet"]) {
    const g = cells.map((c, i) => i).filter((i) => cells[i].state === st);
    say(`      ${st.padEnd(8)}: distance from its own type's centre ${f(median(g.map(dist)), 2)}`);
  }
  const dbl = cells.map((c, i) => i).filter((i) => cells[i].state === "doublet" && cells[i].partner !== cells[i].type);
  const mid = dbl.map((i) => {
    const a = centre[cells[i].type], b = centre[cells[i].partner];
    const t = ((pos[i].x - a[0]) * (b[0] - a[0]) + (pos[i].y - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    return t;
  });
  say(`      a doublet of two types sits ${f(median(mid), 2)} of the way from the one to the other (0.5 is the midpoint), n ${dbl.length}`);
}
say("  P6 Seeds — the same stage at four seeds, kept share and the hot sample's");
for (const seed of [1, 2, 3, 4]) {
  const s2 = simulate(makeRng(seed), {});
  const { keep: k2, tally: t2 } = applyFilters(s2.cells, THRESHOLDS);
  say(`    seed ${seed}: kept ${pct(k2.filter(Boolean).length / k2.length)}, hot sample ${pct(t2["p1-liver"].kept / t2["p1-liver"].n)}`);
}

fs.writeFileSync(path.join(here, "cell-qc-measure.txt"), findings.join("\n") + "\n");
console.log(`\nwritten: widgets/_lab/cell-qc-measure.txt`);
