/* ============================================================================
   The numbers behind slot 5, `enrichment` — PHM5003 05/09 Enrichment Analysis.
   Measured BEFORE anything is drawn, which is this arc's standing order.

     node widgets/_lab/enr-measure.mjs

   Five questions the widget's design turns on:

     1. does this project's Fisher's exact test reproduce the lesson's own
        printed output (cell 3: p = 0.00089982, odds ratio 2345.052);
     2. how far does the lesson's UNSEEDED `sample()` move that p-value;
     3. how hard does the BACKGROUND move ORA's verdict with the overlap held
        fixed — cell 3 writes `d <- 10000 - (a + b + c)` with no comment;
     4. how hard does the CUTOFF move it, and does GSEA sit still while it does;
     5. at WHICH EFFECT SIZE is any of that true — a claim measured at one
        effect size is a claim about that effect size and nothing else.

   Nothing here needs a download. Q1-Q3 are arithmetic on the lesson's own
   numbers; Q4-Q5 run on a seeded simulated stage whose truth is known, the way
   `nmf-sim.mjs` did for slot 2. The engine is `enr-model.js`, the same module
   the mock-up draws with, so no formula is written twice.
   ========================================================================= */

import {
  fisherTwoSided, fisherGreater, oddsRatioCmle,
  makeStage, ora, gsea, gseaNull, SET_KEYS, PLANT,
} from "../enrichment/model.js";
import { makeRng } from "../core/rng.js";

/* --- 1. the lesson's own printed output ----------------------------------- */

console.log("=".repeat(78));
console.log("1. CELL 3, REPRODUCED — the lesson prints p = 0.00089982, OR = 2345.052");
console.log("=".repeat(78));
console.log(`
   genes_of_interest <- sample(c("gene1"..."gene5"), 3)     <- UNSEEDED
   pathway_genes     <- c("gene2", "gene4", "gene6")
   d <- 10000 - (a + b + c)
`);

/* Every sample of 3 from 5 the lesson can draw, and the table each one makes.
   The pathway's third gene, gene6, is not in the pool the sample is drawn from,
   so the overlap is decided entirely by whether gene2 and gene4 come out. */
const POOL = ["gene1", "gene2", "gene3", "gene4", "gene5"];
const PATHWAY = ["gene2", "gene4", "gene6"];
const combos = [];
for (let i = 0; i < 5; i += 1) {
  for (let j = i + 1; j < 5; j += 1) {
    for (let k = j + 1; k < 5; k += 1) combos.push([POOL[i], POOL[j], POOL[k]]);
  }
}
const rows = combos.map((list) => {
  const a = list.filter((g) => PATHWAY.includes(g)).length;
  const b = list.length - a;
  const c = PATHWAY.length - a;
  const d = 10000 - (a + b + c);
  return { list, a, b, c, d, p: fisherTwoSided(a, b, c, d), or: oddsRatioCmle(a, b, c, d) };
});

console.log("   draw                        a  b  c     d      two-sided p   odds ratio");
for (const r of rows) {
  console.log(
    `   ${r.list.join(",").padEnd(24)} ${String(r.a).padStart(2)} ${String(r.b).padStart(2)}`
    + ` ${String(r.c).padStart(2)}  ${r.d}    ${r.p.toExponential(5).padStart(12)}`
    + `   ${Number.isFinite(r.or) ? r.or.toFixed(3) : "Inf"}`,
  );
}
const match = rows.find((r) => Math.abs(r.p - 0.00089982) < 5e-9);
console.log(`
   MATCHES THE PRINTED p: ${match ? `a = ${match.a} — e.g. ${match.list.join(", ")}` : "NONE"}`);
if (match) {
  console.log(`   printed  p = 0.00089982   OR = 2345.052`);
  console.log(`   here     p = ${match.p.toFixed(8)}   OR = ${match.or.toFixed(3)}`);
  /* The p-value reproduces to every digit printed. The odds ratio does not, and
     the reason is R's rather than ours: fisher.test finds the conditional MLE
     with uniroot on 1/psi over (eps, 1) at the default tolerance, 1.2e-4 —
     which is enormous beside a root at 1/2200 = 4.5e-4. Recorded because a
     session that takes 2345.052 for a target will chase it forever. */
  console.log(`   The OR gap is R's uniroot tolerance, not a disagreement: at 2345.052 the`);
  console.log(`   conditional mean of the overlap is 1.035, where the observed overlap is 1.`);
  console.log(`   R solves for 1/psi on (eps, 1) at tol 1.2e-4; the gap here is 2.8e-5.`);
}
console.log(`
   ALSO WORTH KNOWING: matrix(c(a, b, c, d), nrow = 2) fills COLUMN-wise, so the`);
console.log(`   table R tests is the transpose of the one the markdown draws. Fisher's`);
console.log(`   test is invariant to that, and in this example b = c anyway — but the`);
console.log(`   cell is not doing what its own table says, and a widget copying the`);
console.log(`   layout from the code rather than the table would put b and c the wrong`);
console.log(`   way round with nothing to catch it.`);

/* --- 2. what the unseeded sample() costs ---------------------------------- */

console.log(`
${"=".repeat(78)}`);
console.log("2. THE SAME CELL, RUN AGAIN — the lesson's sample() is not seeded");
console.log("=".repeat(78));
const byA = new Map();
for (const r of rows) {
  if (!byA.has(r.a)) byA.set(r.a, { n: 0, p: r.p });
  byA.get(r.a).n += 1;
}
console.log("   overlap   draws of 10   p            verdict at 0.05");
for (const [a, v] of [...byA.entries()].sort((x, y) => y[0] - x[0])) {
  console.log(
    `   a = ${a}       ${String(v.n).padStart(2)}/10  ${String(10 * v.n).padStart(3)}%`
    + `   ${v.p.toExponential(3).padStart(10)}   ${v.p < 0.05 ? "SIGNIFICANT" : "not significant"}`,
  );
}
const sig = rows.filter((r) => r.p < 0.05).length;
console.log(`
   ${sig} of 10 equally likely draws are significant at 0.05, and the three`);
console.log(`   possible p-values span four orders of magnitude. A student who re-runs`);
console.log(`   the cell sees a different number ${(10 - byA.get(match.a).n) * 10}% of the time.`);

/* --- 3. the background, with the overlap held fixed ----------------------- */

console.log(`
${"=".repeat(78)}`);
console.log("3. THE BACKGROUND — same genes, same overlap, only the universe moves");
console.log("=".repeat(78));
console.log(`
   A realistic list rather than the toy: 120 genes past a cutoff, a pathway of
   40, 12 of them in both. Only 'd' changes.
`);
const A = 12, B = 120 - 12, C = 40 - 12;
console.log("   universe   what someone would call it          p (one-sided)   verdict");
const UNIVERSES = [
  [400, "the genes on this figure"],
  [1000, "one curated pathway database"],
  [2000, "genes on a targeted panel"],
  [5000, "genes expressed in this tissue"],
  [12000, "genes detected in this experiment"],
  [20000, "protein-coding genome"],
  [60000, "every annotated transcript"],
];
for (const [n, what] of UNIVERSES) {
  const p = fisherGreater(A, B, C, n - (A + B + C));
  console.log(
    `   ${String(n).padStart(6)}     ${what.padEnd(34)} ${p.toExponential(3).padStart(10)}`
    + `    ${p < 0.05 ? "SIGNIFICANT" : "not significant"}`,
  );
}
let cross = null;
for (let n = A + B + C; n < 200000; n += 1) {
  if (fisherGreater(A, B, C, n - (A + B + C)) < 0.05) { cross = n; break; }
}
console.log(`
   The verdict flips at a universe of ${cross} genes, and the p-value spans`);
console.log(`   ${(fisherGreater(A, B, C, 400 - (A + B + C)) / fisherGreater(A, B, C, 60000 - (A + B + C))).toExponential(1)} across the range above. Nothing about the data changed —`);
console.log(`   the same 12 genes overlap the same pathway at every row.`);
console.log(`
   NOTE THE DIRECTION, because it is the opposite of the intuition: a BIGGER`);
console.log(`   background makes the overlap MORE significant, so the loosest possible`);
console.log(`   universe is also the most flattering one.`);

/* --- 4. the cutoff, and whether GSEA sits still while it moves ------------- */

console.log(`
${"=".repeat(78)}`);
console.log("4. THE CUTOFF — one ranked list, ORA re-run at each threshold");
console.log("=".repeat(78));

/* Shift 0.6, not the 1.6 this first ran at: section 5 measures that at 1.6 the
   planted set is so obvious that every cutoff finds it, and the cutoff claim is
   FALSE in that regime. 0.6 is where it lives. */
const SHIFT = 0.6;
const CUTOFFS = [10, 20, 40, 60, 80, 100, 150, 200];
const st1 = makeStage(makeRng(1), { shift: SHIFT });
console.log(`
   ${st1.genes} genes, three sets of ${st1.setSize}, shift ${SHIFT}, seed 1.
   Universe held at ${st1.genes} — section 3 is where the universe moves.
`);
for (const key of SET_KEYS) {
  const g = gsea(st1, key);
  const nul = gseaNull(st1, key, makeRng(7), 2000);
  console.log(`   SET ${key.toUpperCase()} — planted ${
    { up: "high in the ranking", none: "at random", down: "low in the ranking" }[PLANT[key]]}`);
  console.log(`      cutoff k    in both    p            verdict`);
  for (const k of CUTOFFS) {
    const o = ora(st1, key, k, st1.genes);
    console.log(
      `      ${String(k).padStart(6)}   ${String(o.a).padStart(7)}    `
      + `${o.p.toExponential(2).padStart(9)}    ${o.p < 0.05 ? "SIGNIFICANT" : "not significant"}`,
    );
  }
  console.log(`      GSEA, no cutoff anywhere:  ES = ${g.es.toFixed(3)}  at rank ${g.esAt}`
    + `  permutation p = ${nul.p.toFixed(4)}\n`);
}

/* --- 5. WHERE the cutoff bites, if anywhere ------------------------------- */

console.log(`${"=".repeat(78)}`);
console.log("5. THE SWEEP — over effect size, does the cutoff flip ORA's verdict?");
console.log("=".repeat(78));
console.log(`
   ${st1.genes} genes, sets of ${st1.setSize}, ${CUTOFFS.length} cutoffs from`
  + ` ${CUTOFFS[0]} to ${CUTOFFS.at(-1)}, 60 seeds each.
   "flips" = the eight cutoffs do not all return the same verdict.
   GSEA is run once per set: it has no cutoff to flip on.
`);
console.log("   shift   set   planted   ORA sig at k = 20 / 60 / 150    flips    GSEA p<0.05");
const SEEDS = 60, PERMS = 400;
for (const shift of [0.4, 0.6, 0.8, 1.0, 1.6]) {
  for (const key of SET_KEYS) {
    let flip = 0, gHit = 0;
    const at = { 20: 0, 60: 0, 150: 0 };
    for (let s = 1; s <= SEEDS; s += 1) {
      const st = makeStage(makeRng(s), { shift });
      const verdicts = CUTOFFS.map((k) => ora(st, key, k, st.genes).p < 0.05);
      if (new Set(verdicts).size > 1) flip += 1;
      for (const k of [20, 60, 150]) at[k] += ora(st, key, k, st.genes).p < 0.05 ? 1 : 0;
      if (gseaNull(st, key, makeRng(1000 + s), PERMS).p < 0.05) gHit += 1;
    }
    const r = (v) => `${Math.round(100 * v / SEEDS)}%`.padStart(4);
    console.log(
      `   ${shift.toFixed(1)}     ${key}     ${PLANT[key].padEnd(6)}`
      + `    ${r(at[20])} ${r(at[60])} ${r(at[150])}             ${r(flip)}       ${r(gHit)}`,
    );
  }
  console.log("");
}
console.log(`   READ THE TABLE THIS WAY:

   - The cutoff claim is LIVE at shift 0.4-0.8 and DEAD at 1.6. At 1.6 the
     planted set is so obvious that all eight cutoffs find it, so a widget whose
     default effect is strong would demonstrate nothing.
   - Set C is the finding that needs no tuning: genuinely enriched, and ORA on a
     top-k list never sees it at ANY effect size or ANY cutoff, because the list
     is the top of the ranking and the set is at the bottom.
   - Set B is the false-positive check. GSEA fires on it about 7% of the time
     against a nominal 5% — gene-set permutation is mildly liberal, which is a
     real property of the substitute null and not a bug in this code.`);

/* --- 6. the fix a practitioner would reach for ----------------------------- */

/* Section 5 says ORA on a top-k list never sees set C. The obvious objection is
   that nobody runs ORA that way — you take the genes that CHANGED, in either
   direction, and `sort(gene_list, decreasing = TRUE)` in cell 9 is just how the
   lesson happens to write it. So measure the fair version too, because a claim
   that only survives against a straw man is not a claim. */

function oraTwoSided(st, key, k, universe) {
  const set = st.sets[key];
  const byAbs = [...Array(st.genes).keys()]
    .sort((x, y) => Math.abs(st.score[y]) - Math.abs(st.score[x]));
  const list = byAbs.slice(0, k);
  const a = list.filter((g) => set.has(g)).length;
  return { a, p: fisherGreater(a, k - a, set.size - a, universe - (k - a) - set.size) };
}

console.log(`
${"=".repeat(78)}`);
console.log('6. THE FAIR VERSION — a gene list of "most changed", either direction');
console.log("=".repeat(78));
console.log(`
   60 seeds. Same list, same sets, same universe; only how the gene list is cut.
`);
console.log("   shift  set  planted   top-k sig at 20/60/150   |score| sig at 20/60/150   GSEA");
for (const shift of [0.6, 1.0]) {
  for (const key of SET_KEYS) {
    const one = { 20: 0, 60: 0, 150: 0 }, two = { 20: 0, 60: 0, 150: 0 };
    let g = 0;
    for (let s = 1; s <= 60; s += 1) {
      const st = makeStage(makeRng(s), { shift });
      for (const k of [20, 60, 150]) {
        one[k] += ora(st, key, k, st.genes).p < 0.05 ? 1 : 0;
        two[k] += oraTwoSided(st, key, k, st.genes).p < 0.05 ? 1 : 0;
      }
      g += gseaNull(st, key, makeRng(1000 + s), 400).p < 0.05 ? 1 : 0;
    }
    const r = (v) => `${Math.round(100 * v / 60)}%`.padStart(5);
    console.log(
      `   ${shift.toFixed(1)}    ${key}    ${PLANT[key].padEnd(6)}`
      + ` ${r(one[20])}${r(one[60])}${r(one[150])}        `
      + ` ${r(two[20])}${r(two[60])}${r(two[150])}       ${r(g)}`,
    );
  }
  console.log("");
}
console.log(`   THE FIX MAKES ORA WORSE, and this is the finding the widget is for.

   Taking the most-changed genes in either direction does rescue set C a
   little — 0% to 5-13% at shift 0.6 — but it costs set A most of its power,
   95% down to 20%, because the list now holds both pathways and each one is
   only half of it. There is no cutoff, and no way of cutting, at which ORA
   sees both sets. GSEA sees both, at 95-100%, and has nothing to cut.

   SO THE TWO METHODS HAVE TO SHARE ONE RANKED LIST ON ONE SCREEN. Every
   comparison above is a statement about the same list scored two ways; split
   across two widgets, not one of them can be made.`);
