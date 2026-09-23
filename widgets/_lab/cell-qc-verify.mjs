/* ============================================================================
   Widget 79 · cell-qc — what the pages claim, held to the stage and to the
   lesson's own 40,564 cells.

       node widgets/_lab/cell-qc-verify.mjs

   §1 the draw: the stage is pure and seeded, every droplet's three numbers are
      finite and in range, and nFeature never exceeds the molecules it was seen in
   §2 the four facts the real cells gave, reproduced by the stage: mitochondrial
      percentage flat across cell types and across the count deciles of the
      sample carrying ambient RNA, falling with the count in the clean ones,
      the two count rules removing mostly the same droplets, and the recovery
      curve as the mitochondrial rule moves
   §3 the filter: each droplet is assigned to the FIRST rule that removes it,
      the per-sample tallies add up, and every rule is monotone in its threshold
   §4 the map: a doublet of two types lands between them, an empty droplet in
      the middle, and the distance from a type's centre falls as the count rises
   §5 which rule catches what: the count rules take the empty droplets and
      most of the dying cells and NO doublet, and the mitochondrial rule takes
      the sample carrying ambient RNA, good cells and all
   §6 the fourth rule: the neighbour score is seeded and bounded, it calls the
      doublets holding two different types and none of those holding two of
      the same, and it only ever removes droplets the other three rules kept
   §7 the copy: no struck word, no lesson reference, in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, applyFilters, confusion, embed, doubletScores, median, DOUBLET, TYPES, SAMPLES, THRESHOLDS, DEFAULTS } from "../cell-qc/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i += 1) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; sa += x * x; sb += y * y; }
  return sab / Math.sqrt(sa * sb);
};

const stage = simulate(makeRng(1), {});
const cells = stage.cells;

section("§1 the draw is pure, seeded and in range");
{
  const again = simulate(makeRng(1), {});
  assert(JSON.stringify(again.cells) === JSON.stringify(cells), "the same seed draws the same droplets");
  const other = simulate(makeRng(2), {});
  assert(JSON.stringify(other.cells) !== JSON.stringify(cells), "another seed draws different droplets");
  assert(cells.length === DEFAULTS.cells * SAMPLES.length, `${cells.length} droplets, ${DEFAULTS.cells} a sample`);
  assert(cells.every((c) => Number.isFinite(c.nCount) && Number.isFinite(c.nFeature) && Number.isFinite(c.mt)), "every droplet's three numbers are finite");
  assert(cells.every((c) => c.mt > 0 && c.mt < 100), "every mitochondrial percentage is inside (0, 100)");
  assert(cells.every((c) => c.nFeature <= c.nCount), "no droplet shows more genes than it held molecules");
  assert(cells.every((c) => c.nFeature >= 1 && c.nCount >= 20), "no droplet is empty of both");
  assert(cells.every((c) => (c.partner === null) === (c.state !== "doublet")), "a partner is a doublet's and nothing else's");
  const states = new Set(cells.map((c) => c.state));
  assert(states.size === 4, `all four states are drawn (${[...states].sort().join(", ")})`);
  console.log(`  ${checks} checks`);
}

section("§2 the four facts of the lesson's own cells");
{
  const hot = cells.filter((c) => c.sample === DEFAULTS.hot);
  const clean = cells.filter((c) => c.sample === "p2-liver");
  /* R1 — mitochondrial percentage belongs to the sample, not to a cell type */
  const byType = TYPES.map((t) => hot.filter((c) => c.state === "good" && c.type === t.key)).filter((g) => g.length >= 12).map((g) => median(g.map((c) => c.mt)));
  const spread = Math.max(...byType) / Math.min(...byType);
  assert(spread < 1.35, `inside the sample carrying ambient RNA every cell type sits at the same level (highest / lowest median = ${spread.toFixed(2)}; the lesson's four marker groups span 11.9–15.2%)`);
  assert(median(hot.map((c) => c.mt)) / median(clean.map((c) => c.mt)) > 8,
    `the same tissue in the other patient sits far below it (${median(hot.map((c) => c.mt)).toFixed(1)}% against ${median(clean.map((c) => c.mt)).toFixed(1)}%; the lesson's own are 14.8% and 0.1%)`);
  /* R2 — the dying cell falls with the count, the ambient sample does not */
  const rClean = corr(clean.map((c) => Math.log10(c.nCount)), clean.map((c) => c.mt));
  assert(rClean < -0.3 && rClean > -0.85, `in a clean sample the percentage falls as the count rises (r = ${rClean.toFixed(2)}; the lesson's three are −0.40, −0.47, −0.70)`);
  const sorted = hot.slice().sort((a, b) => a.nCount - b.nCount);
  const dec = (i) => median(sorted.slice(Math.floor((i * sorted.length) / 10), Math.floor(((i + 2) * sorted.length) / 10)).map((c) => c.mt));
  const lowDec = dec(0), highDec = dec(8);
  assert(Math.abs(lowDec - highDec) / lowDec < 0.35, `with ambient RNA it is flat across the count deciles instead (${lowDec.toFixed(1)}% to ${highDec.toFixed(1)}%; the lesson's hot sample runs 13.5% to 15.8%)`);
  /* R3 — the two count rules are one rule */
  let either = 0, both = 0;
  for (const c of cells) {
    const a = !(c.nFeature > THRESHOLDS.nFeature), b = !(c.nCount > THRESHOLDS.nCount);
    if (a || b) either += 1;
    if (a && b) both += 1;
  }
  assert(both / either > 0.7, `${Math.round((100 * both) / either)}% of the droplets either count rule removes fail both (the lesson's four samples: 84%)`);
  /* R4 — the recovery curve */
  const keptAt = (mt) => {
    const { tally } = applyFilters(hot, { ...THRESHOLDS, mt });
    return tally[DEFAULTS.hot].kept / tally[DEFAULTS.hot].n;
  };
  const curve = [10, 15, 20, 25].map(keptAt);
  assert(curve.every((v, i) => i === 0 || v > curve[i - 1]), "the sample keeps more at every looser mitochondrial rule");
  assert(curve[0] < 0.25 && curve[2] > 0.55, `it keeps ${Math.round(100 * curve[0])}% at 10 and ${Math.round(100 * curve[2])}% at 20 (the lesson's own: 15% and 71%)`);
  console.log(`  ${checks} checks`);
}

section("§3 the filter, as the sliders apply it");
{
  const thr = THRESHOLDS;
  const removedAt = cells.map((c) => (c.nFeature > thr.nFeature ? (c.nCount > thr.nCount ? (c.mt < thr.mt ? 0 : 3) : 2) : 1));
  const { keep, tally } = applyFilters(cells, thr);
  assert(removedAt.every((r, i) => (r === 0) === keep[i]), "a droplet removed by no rule is a droplet the filter keeps");
  assert(cells.every((c, i) => removedAt[i] !== 1 || !(c.nFeature > thr.nFeature)), "a droplet charged to the gene rule really is short of genes");
  assert(cells.every((c, i) => removedAt[i] !== 2 || (c.nFeature > thr.nFeature && !(c.nCount > thr.nCount))), "the transcript rule is charged only droplets the gene rule left");
  assert(cells.every((c, i) => removedAt[i] !== 3 || (c.nFeature > thr.nFeature && c.nCount > thr.nCount && !(c.mt < thr.mt))), "the mitochondrial rule is charged only droplets the other two left");
  for (const s of SAMPLES) {
    const t = tally[s.key];
    const mine = cells.map((c, i) => i).filter((i) => cells[i].sample === s.key);
    const byRule = [1, 2, 3].map((r) => mine.filter((i) => removedAt[i] === r).length);
    assert(t.kept + byRule[0] + byRule[1] + byRule[2] === t.n, `${s.name}: kept and the three rules' removals add to ${t.n}`);
  }
  /* monotone in each threshold */
  const keptWith = (over) => applyFilters(cells, { ...thr, ...over }).keep.filter(Boolean).length;
  assert(keptWith({ nFeature: 0 }) >= keptWith({}) && keptWith({ nFeature: 1500 }) <= keptWith({}), "a stricter gene rule never keeps more");
  assert(keptWith({ nCount: 0 }) >= keptWith({}) && keptWith({ nCount: 3000 }) <= keptWith({}), "a stricter transcript rule never keeps more");
  assert(keptWith({ mt: 40 }) >= keptWith({}) && keptWith({ mt: 1 }) <= keptWith({}), "a stricter mitochondrial rule never keeps more");
  assert(keptWith({ nFeature: 0, nCount: 0, mt: 100 }) === cells.length, "with every rule off, nothing is removed");
  /* THE BAR'S THREE SEGMENTS ARE THE ARGUMENT THAT TWO OF THE RULES ARE ONE:
     a droplet is charged to the first rule that removes it, so the transcript
     rule's segment is what the gene rule did not already take. The
     walkthrough that used to say this in time was cut at his round 2, and the
     segments are where it says it now. */
  const charged = (k) => removedAt.filter((r) => r === k).length;
  assert(charged(1) + charged(2) + charged(3) === cells.length - keep.filter(Boolean).length, "the three segments add to what the filter removes");
  assert(charged(2) < charged(1) / 4,
    `the transcript rule's segment is a sliver beside the gene rule's (${charged(2)} against ${charged(1)}) — the lesson's own two count rules remove 84% the same cells`);

  /* what the Truth page prints */
  const conf = confusion(cells, keep);
  assert(conf.removedGood + conf.removedBad + conf.keptGood + conf.keptBad === cells.length, "the four corners of the claim add to every droplet");
  assert(conf.removedGood > 0 && conf.keptBad > 0, `the filter is wrong in both directions (${conf.removedGood} good cells removed, ${conf.keptBad} bad droplets kept)`);
  assert(conf.keptDoublet + conf.keptDying + conf.keptEmpty === conf.keptBad, "the kept bad droplets are the doublets, the dying and the empty");
  console.log(`  ${checks} checks`);
}

section("§4 the map: a droplet is placed by what was sequenced in it");
{
  const pos = embed(makeRng(11), cells);
  assert(pos.length === cells.length && pos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), "every droplet has a finite position");
  assert(JSON.stringify(embed(makeRng(11), cells)) === JSON.stringify(pos), "the same seed places them the same way");
  const centre = {};
  for (const t of TYPES) {
    const g = cells.map((c, i) => i).filter((i) => cells[i].type === t.key && cells[i].state === "good" && cells[i].nCount > 4000);
    if (g.length >= 8) centre[t.key] = [mean(g.map((i) => pos[i].x)), mean(g.map((i) => pos[i].y))];
  }
  assert(Object.keys(centre).length >= 5, `at least five of the six populations have a centre (${Object.keys(centre).length})`);
  const apart = Math.hypot(centre.hepatocyte[0] - centre.tumour[0], centre.hepatocyte[1] - centre.tumour[1]);
  const dist = (i) => Math.hypot(pos[i].x - centre[cells[i].type][0], pos[i].y - centre[cells[i].type][1]) / apart;
  /* a doublet of two types sits between the two it holds */
  const dbl = cells.map((c, i) => i).filter((i) => cells[i].state === "doublet" && cells[i].partner !== cells[i].type && centre[cells[i].type] && centre[cells[i].partner]);
  const along = dbl.map((i) => {
    const a = centre[cells[i].type], b = centre[cells[i].partner];
    return ((pos[i].x - a[0]) * (b[0] - a[0]) + (pos[i].y - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  });
  assert(Math.abs(median(along) - 0.5) < 0.12, `a doublet of two types lands halfway between them (${median(along).toFixed(2)} of the way, n ${dbl.length})`);
  /* an empty droplet lands in the middle, further from any one type */
  const emptyD = cells.map((c, i) => i).filter((i) => cells[i].state === "empty" && centre[cells[i].type]);
  const goodD = cells.map((c, i) => i).filter((i) => cells[i].state === "good" && centre[cells[i].type]);
  assert(median(emptyD.map(dist)) > 2 * median(goodD.map(dist)), `an empty droplet sits far from any one population (${median(emptyD.map(dist)).toFixed(2)} against a good cell's ${median(goodD.map(dist)).toFixed(2)})`);
  /* the error falls as the count rises: that is the whole claim of the map */
  const byCount = goodD.slice().sort((a, b) => cells[a].nCount - cells[b].nCount);
  const lowQ = byCount.slice(0, Math.floor(byCount.length / 5));
  const highQ = byCount.slice(-Math.floor(byCount.length / 5));
  assert(median(lowQ.map(dist)) > median(highQ.map(dist)) * 1.5,
    `a shallow droplet lands further from its own population than a deep one (${median(lowQ.map(dist)).toFixed(2)} against ${median(highQ.map(dist)).toFixed(2)})`);
  console.log(`  ${checks} checks`);
}

section("§5 which rule catches what — the figure's whole claim, as counts");
{
  const thr = THRESHOLDS;
  const at = cells.map((c) => (c.nFeature > thr.nFeature ? (c.nCount > thr.nCount ? (c.mt < thr.mt ? 0 : 3) : 2) : 1));
  const of = (st) => cells.map((c, i) => i).filter((i) => cells[i].state === st);
  const charged = (idx, k) => idx.filter((i) => at[i] === k).length;
  const byCount = (idx) => charged(idx, 1) + charged(idx, 2);
  const empty = of("empty"), dying = of("dying"), dbl = of("doublet"), good = of("good");
  assert(byCount(empty) / empty.length > 0.8,
    `the two count rules are what catches an empty droplet: ${byCount(empty)} of ${empty.length}`);
  assert(byCount(dying) / dying.length > 0.5,
    `and most dying cells, which lost their RNA with their cytoplasm: ${byCount(dying)} of ${dying.length}`);
  assert(byCount(dbl) === 0,
    `and NO droplet holding two cells: ${byCount(dbl)} of ${dbl.length}. A doublet has more of everything and every count rule is a floor — which is the lesson's own aside about high counts, answered`);
  assert(charged(dbl, 3) > 0 && charged(dbl, 3) === dbl.length - charged(dbl, 0),
    `the mitochondrial rule is the only one that ever removes one, and it removes ${charged(dbl, 3)} — the ones in the sample carrying ambient RNA`);
  assert(charged(good, 3) > 10 * byCount(good),
    `a good cell removed is almost always removed by the mitochondrial rule (${charged(good, 3)} against ${byCount(good)} by the count rules), because that rule is reading a sample, not a cell`);
  console.log(`  ${checks} checks`);
}

section("§6 the fourth rule: doublets found by the company they keep");
{
  const thr = THRESHOLDS;
  const { keep } = applyFilters(cells, thr);
  /* THE COUNT RULES ARE THE SCORING FLOOR, not all three (his round 16). The
     mitochondrial threshold is downstream of the score now, which is what
     lets the sweep on the Thresholds page apply all four rules at every
     setting instead of three. */
  const floor = cells.map((c) => c.nFeature > thr.nFeature && c.nCount > thr.nCount);
  const index = cells.map((c, i) => i).filter((i) => floor[i]);
  const run = () => doubletScores(makeRng(38), cells, index, DOUBLET);
  const t0 = performance.now();
  const { score, art } = run();
  const ms = performance.now() - t0;
  assert(score.length === index.length && art.length === index.length, "one score a droplet, and one artificial doublet a droplet at ratio 1");
  assert([...score].every((v) => v >= 0 && v <= 1), "every score is a share");
  assert(JSON.stringify([...run().score]) === JSON.stringify([...score]), "the same seed scores the same way");
  assert(ms < 300, `it runs in ${ms.toFixed(0)} ms, which is what lets the call be a control the reader drags`);
  const het = [], hom = [], one = [];
  index.forEach((i, r) => {
    const c = cells[i];
    if (c.state !== "doublet") one.push(score[r]);
    else (c.partner !== c.type ? het : hom).push(score[r]);
  });
  assert(het.length >= 20 && hom.length >= 5, `the stage holds both kinds to test with (${het.length} of two types, ${hom.length} of one)`);
  assert(median(het) > 0.7, `a doublet of two different types sits among the artificial ones (median ${median(het).toFixed(2)})`);
  assert(median(hom) < 0.5 && median(one) < 0.5,
    `a doublet of two of the SAME type does not (median ${median(hom).toFixed(2)}), and neither does a droplet holding one cell (${median(one).toFixed(2)}) — that is the method's own limit, not this stage's`);
  /* the call, at the value the page offers */
  for (const cut of [0.6, 0.8]) {
    const calledHet = het.filter((v) => v >= cut).length;
    const calledHom = hom.filter((v) => v >= cut).length;
    const calledOne = one.filter((v) => v >= cut).length;
    assert(calledHet / het.length > 0.8, `at a score of ${cut} it finds ${calledHet} of the ${het.length} doublets holding two different types`);
    assert(calledHom === 0, `and ${calledHom} of the ${hom.length} holding two of the same`);
    assert(calledOne < 0.02 * one.length, `taking ${calledOne} droplets that hold one cell with them (${(100 * calledOne / one.length).toFixed(1)}%)`);
  }
  /* it is charged after the other three, never before: a droplet the count
     rules or the mitochondrial rule removed is attributed to that rule even
     though it now carries a score */
  const withRule = cells.map((c) => (c.nFeature > thr.nFeature ? (c.nCount > thr.nCount ? (c.mt < thr.mt ? 0 : 3) : 2) : 1));
  index.forEach((i, r) => { if (score[r] >= 0.6 && withRule[i] === 0) withRule[i] = 4; });
  assert(withRule.every((r, i) => r !== 4 || keep[i]), "the fourth rule only ever removes a droplet the other three kept");
  assert(cells.every((c, i) => !(floor[i] && !keep[i]) || withRule[i] === 3),
    "a droplet the mitochondrial rule removed is charged to that rule, not to the doublet call it also carries");

  /* AND THE CURVE BESIDE THE BAR CAN NOW SAY ALL FOUR (his round 16). The
     Thresholds page sweeps the mitochondrial rule; because the score is
     computed on the count floor it does not move as that sweep runs, so the
     curve is exact at every setting and equal to the bar at the one the
     reader set. Three rules read four to five points high, which is what he
     caught: this asserts the two agree now. */
  const scoreOf = new Float64Array(cells.length).fill(NaN);
  index.forEach((i, r) => { scoreOf[i] = score[r]; });
  for (const s of SAMPLES) {
    const cs = cells.map((c, i) => [c, i]).filter(([c]) => c.sample === s.key);
    const onCurve = cs.filter(([c, i]) => c.nFeature > thr.nFeature && c.nCount > thr.nCount && c.mt < thr.mt && !(scoreOf[i] >= 0.6)).length;
    const onBar = cs.filter(([c, i]) => withRule[i] === 0).length;
    assert(onCurve === onBar, `${s.name}: the curve at the set rule is the bar (${onCurve} against ${onBar})`);
  }
  console.log(`  ${checks} checks`);
}

section("§7 the copy");
{
  const src = readFileSync(join(here, "../cell-qc/main.js"), "utf8");
  /* comments are exempt and carry the record of where a decision came from;
     the sweep reads the strings the reader can see */
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* prose only: a string with no space in it is an identifier, a parameter key
     or a token name, and none of those is copy */
  const strings = [...stripped.matchAll(/["'`]([^"'`\n]{6,})["'`]/g)].map((m) => m[1])
    /* what the reader sees: the slots an interpolation fills are numbers by
       the time the page is painted, and the expression inside one is code */
    .map((t) => t.replace(/\$\{[^}]*\}/g, "…"))
    .filter((t) => /\s/.test(t));
  const STRUCK = [
    ["\\bhot\\b", "ours, not the field's — the sample carries ambient RNA and the copy should say so"],
    ["\\bnotebook\\b|\\blesson\\b|\\bcell \\d+", "no lesson reference in reader-facing copy"],
    ["\\bnever\\b", "say the positive literal fact"],
    ["\\bSeurat\\b|\\bnFeature\\b|\\bnCount\\b|mtPercent", "a library's own variable name is not the reader's word"],
    ["\\bpress(es|ed)?\\b|\\bstep\\b", "nothing is driven any more: the rules follow the sliders (his round 2)"],
  ];
  for (const [pat, why] of STRUCK) {
    const re = new RegExp(pat, "i");
    const hit = strings.filter((s) => re.test(s));
    assert(hit.length === 0, `${why}: ${hit.slice(0, 3).map((s) => JSON.stringify(s)).join(", ")}`);
  }
  console.log(`  ${checks} checks`);
}

console.log(`\n${fails ? `${fails} FAILED of ${checks}` : `all ${checks} checks passed`}`);
process.exit(fails ? 1 : 0);
