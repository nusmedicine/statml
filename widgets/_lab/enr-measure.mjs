/* ============================================================================
   The numbers behind slot 5, `enrichment` — PHM5003 05/09 Enrichment Analysis.
   Measured BEFORE anything is drawn, which is this arc's standing order.

     node widgets/_lab/enr-measure.mjs

   Eight questions the widget's design turns on:

     1. does this project's Fisher's exact test reproduce the lesson's own
        printed output (cell 3: p = 0.00089982, odds ratio 2345.052);
     2. how far does the lesson's UNSEEDED `sample()` move that p-value;
     3. how hard does the BACKGROUND move ORA's verdict with the overlap held
        fixed — cell 3 writes `d <- 10000 - (a + b + c)` with no comment;
     4. how hard does the CUTOFF move it, and does GSEA sit still while it does;
     5. at WHICH EFFECT SIZE is any of that true — a claim measured at one
        effect size is a claim about that effect size and nothing else;
     6. does the fix a reader proposes within a minute actually help;
     7. what the correction does over a whole COLLECTION of pathways, which is
        the shape enrichment analysis is run in and the shape cell 5 admits it
        cannot demonstrate;
     8. does this project's Benjamini-Hochberg agree with R's.

   Nothing here needs a download. Q1-Q3 are arithmetic on the lesson's own
   numbers; Q4-Q5 run on a seeded simulated stage whose truth is known, the way
   `nmf-sim.mjs` did for slot 2. The engine is `enr-model.js`, the same module
   the mock-up draws with, so no formula is written twice.
   ========================================================================= */


import {
  fisherTwoSided, fisherGreater, oddsRatioCmle,
  makeStage, ora, oraAll, gsea, gseaNull, benjaminiHochberg, N_SETS,
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


/* --- the stage's own vocabulary, now that pathways are a collection -------- */

/* §§ 4-7 all ask the same question of three KINDS of pathway, and the stage
   plants two up and one down among twenty. `pick` finds one of each on a given
   seed, so a claim is always measured on the same kind of object even though
   which index that is moves with the seed. */
function pick(stage) {
  const up = stage.sets.find((s) => s.planted === "up");
  const down = stage.sets.find((s) => s.planted === "down");
  const none = stage.sets.find((s) => s.planted === null);
  return { up: up.index, down: down.index, none: none.index };
}
const KINDS = ["up", "none", "down"];
const PLANTED_AS = {
  up: "high in the ranking", none: "at random", down: "low in the ranking",
};

/* --- 4. the cutoff, and whether GSEA sits still while it moves ------------- */

console.log(`
${"=".repeat(78)}`);
console.log("4. THE CUTOFF — one ranked list, ORA re-run at each threshold");
console.log("=".repeat(78));

/* Shift 0.6, not the 1.6 this first ran at: § 5 measures that at 1.6 the
   planted pathway is so obvious that every cutoff finds it, and the cutoff
   claim is FALSE in that regime. 0.6 is where it lives. */
const SHIFT = 0.6;
const CUTOFFS = [10, 20, 40, 60, 80, 100, 150, 200];
const st1 = makeStage(makeRng(1), { shift: SHIFT });
const p1 = pick(st1);
console.log(`
   ${st1.genes} genes, ${N_SETS} pathways, shift ${SHIFT}, seed 1.
   Universe held at ${st1.genes} — § 3 is where the universe moves.
`);
for (const kind of KINDS) {
  const i = p1[kind];
  const g = gsea(st1, i);
  const nul = gseaNull(st1, i, makeRng(7), 2000);
  console.log(`   ${st1.sets[i].label} (${st1.sets[i].size} genes) — planted ${PLANTED_AS[kind]}`);
  console.log(`      cutoff k    in both    p            verdict`);
  for (const k of CUTOFFS) {
    const o = ora(st1, i, k, st1.genes);
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
   ${CUTOFFS.length} cutoffs from ${CUTOFFS[0]} to ${CUTOFFS.at(-1)}, 60 seeds each.
   "flips" = the eight cutoffs do not all return the same verdict.
   GSEA is run once per pathway: it has no cutoff to flip on.
`);
console.log("   shift   planted   ORA sig at k = 20 / 60 / 150    flips    GSEA p<0.05");
const SEEDS = 60, PERMS = 400;
for (const shift of [0.4, 0.6, 0.8, 1.0, 1.6]) {
  for (const kind of KINDS) {
    let flip = 0, gHit = 0;
    const at = { 20: 0, 60: 0, 150: 0 };
    for (let s = 1; s <= SEEDS; s += 1) {
      const st = makeStage(makeRng(s), { shift });
      const i = pick(st)[kind];
      const verdicts = CUTOFFS.map((k) => ora(st, i, k, st.genes).p < 0.05);
      if (new Set(verdicts).size > 1) flip += 1;
      for (const k of [20, 60, 150]) at[k] += ora(st, i, k, st.genes).p < 0.05 ? 1 : 0;
      if (gseaNull(st, i, makeRng(1000 + s), PERMS).p < 0.05) gHit += 1;
    }
    const r = (v) => `${Math.round(100 * v / SEEDS)}%`.padStart(4);
    console.log(
      `   ${shift.toFixed(1)}     ${kind.padEnd(6)}`
      + `    ${r(at[20])} ${r(at[60])} ${r(at[150])}             ${r(flip)}       ${r(gHit)}`,
    );
  }
  console.log("");
}
console.log(`   READ THE TABLE THIS WAY:

   - The cutoff claim is LIVE at shift 0.4-0.8 and DEAD at 1.6. At 1.6 the
     planted pathway is so obvious that all eight cutoffs find it, so a widget
     whose default effect is strong would demonstrate nothing.
   - The DOWN pathway needs no tuning: genuinely enriched, and ORA on a top-k
     list never sees it at ANY effect size or ANY cutoff, because the list is
     the top of the ranking and the pathway is at the bottom.
   - The unplanted pathway is the false-positive check. GSEA fires on it about
     7% of the time against a nominal 5% — gene-set permutation is mildly
     liberal, which is a real property of the substitute null and not a bug.`);

/* --- 6. the fix a practitioner would reach for ----------------------------- */

/* § 5 says ORA on a top-k list never sees the down-regulated pathway. The
   obvious objection is that nobody runs ORA that way — you take the genes that
   CHANGED, in either direction, and `sort(gene_list, decreasing = TRUE)` in
   cell 9 is just how the lesson happens to write it. So measure the fair
   version too, because a claim that only survives against a straw man is not a
   claim. */

console.log(`
${"=".repeat(78)}`);
console.log('6. THE FAIR VERSION — a gene list of "most changed", either direction');
console.log("=".repeat(78));
console.log(`
   60 seeds. Same list, same pathways, same universe; only how the list is cut.
`);
console.log("   shift  planted   top-k sig at 20/60/150   most-changed at 20/60/150   GSEA");
for (const shift of [0.6, 1.0]) {
  for (const kind of KINDS) {
    const one = { 20: 0, 60: 0, 150: 0 }, two = { 20: 0, 60: 0, 150: 0 };
    let g = 0;
    for (let s = 1; s <= 60; s += 1) {
      const st = makeStage(makeRng(s), { shift });
      const i = pick(st)[kind];
      for (const k of [20, 60, 150]) {
        one[k] += ora(st, i, k, st.genes, "top").p < 0.05 ? 1 : 0;
        two[k] += ora(st, i, k, st.genes, "both").p < 0.05 ? 1 : 0;
      }
      g += gseaNull(st, i, makeRng(1000 + s), 400).p < 0.05 ? 1 : 0;
    }
    const r = (v) => `${Math.round(100 * v / 60)}%`.padStart(5);
    console.log(
      `   ${shift.toFixed(1)}    ${kind.padEnd(6)}`
      + ` ${r(one[20])}${r(one[60])}${r(one[150])}         `
      + ` ${r(two[20])}${r(two[60])}${r(two[150])}       ${r(g)}`,
    );
  }
  console.log("");
}
console.log(`   THE FIX MAKES ORA WORSE, and this is a finding the widget is for.

   Taking the most-changed genes in either direction does rescue the down
   pathway a little, and it costs the up one most of its power, because the
   list now holds both and each is only half of it. There is no cutoff, and no
   way of cutting, at which ORA sees both. GSEA sees both and has nothing to
   cut.`);

/* --- 7. the correction, which is why the tab tests a COLLECTION ------------ */

console.log(`
${"=".repeat(78)}`);
console.log("7. MULTIPLE TESTING — every pathway tested, then Benjamini-Hochberg");
console.log("=".repeat(78));
console.log(`
   Cell 5 runs p.adjust on ONE p-value and says so itself: "in this case, no
   correction as there is only one p-value". A collection is the smallest stage
   on which the correction is not the identity function, which is why the ORA
   tab tests all ${N_SETS} pathways rather than the one on screen.

   200 seeds at the widget's defaults — cutoff 60, background 400.
`);
console.log("   shift   significant at 0.05     the planted UP pathways found");
console.log("           raw  median   BH  median    raw       after BH");
for (const shift of [0.4, 0.6, 1.0]) {
  const raw = [], adj = [];
  let upRaw = 0, upAdj = 0, upN = 0;
  for (let s = 1; s <= 200; s += 1) {
    const st = makeStage(makeRng(s), { shift });
    const all = oraAll(st, 60, st.genes, "top");
    raw.push(all.filter((r) => r.p < 0.05).length);
    adj.push(all.filter((r) => r.padj < 0.05).length);
    for (const r of all) {
      if (r.planted !== "up") continue;
      upN += 1;
      if (r.p < 0.05) upRaw += 1;
      if (r.padj < 0.05) upAdj += 1;
    }
  }
  const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(
    `   ${shift.toFixed(1)}    ${mean(raw).padStart(5)}  ${String(med(raw)).padStart(4)}`
    + `  ${mean(adj).padStart(5)} ${String(med(adj)).padStart(4)}`
    + `    ${(100 * upRaw / upN).toFixed(0).padStart(4)}%     ${(100 * upAdj / upN).toFixed(0).padStart(4)}%`,
  );
}
console.log(`
   WHY THE DEFAULT IS TWO PLANTED UP AND ONE DOWN. With one planted pathway the
   median at the defaults is 1 significant raw and 0 after correcting, so the
   panel opens empty and demonstrates nothing. With two it is 2 and 1: a couple
   of bars over the 0.05 line and one still standing after the correction.

   AND THE HONEST HALF OF THE LESSON is in the last two columns. The correction
   is not free — it removes real findings along with the false ones, and at the
   default effect it costs about half of the genuinely enriched pathways ORA
   had found.`);

/* --- 8. Benjamini-Hochberg against R's own algorithm ----------------------- */

console.log(`
${"=".repeat(78)}`);
console.log("8. THE BH STEP, checked against R's documented algorithm");
console.log("=".repeat(78));

/* R's p.adjust(method = "BH") is four lines of R and they are worth writing
   out rather than trusting a remembered vector of outputs:

     i <- n:1L; o <- order(p, decreasing = TRUE); ro <- order(o)
     pmin(1, cummin(n / i * p[o]))[ro]

   Implemented here independently of the model, so agreement is a check rather
   than a tautology. An earlier version of this file quoted an R output from
   memory and flagged a correct implementation as wrong. */
function rAlgorithm(p) {
  const n = p.length;
  const o = [...p.keys()].sort((a, b) => p[b] - p[a]);
  const out = new Array(n);
  let run = Infinity;
  o.forEach((idx, j) => {
    run = Math.min(run, (n / (n - j)) * p[idx]);
    out[idx] = Math.min(1, run);
  });
  return out;
}
const rngB = makeRng(99);
let worst = 0, compared = 0, nonMonotone = 0;
for (let t = 0; t < 2000; t += 1) {
  const len = 1 + Math.floor(rngB.next() * 30);
  const p = Array.from({ length: len }, () => 10 ** (-6 * rngB.next()));
  const mine = benjaminiHochberg(p);
  const theirs = rAlgorithm(p);
  for (let i = 0; i < len; i += 1) {
    worst = Math.max(worst, Math.abs(mine[i] - theirs[i]));
    compared += 1;
  }
  const asc = [...p.keys()].sort((x, y) => p[x] - p[y]);
  for (let i = 1; i < len; i += 1) {
    if (mine[asc[i]] < mine[asc[i - 1]] - 1e-12) nonMonotone += 1;
  }
}
console.log(`
   ${compared} adjusted values compared: largest absolute difference ${worst.toExponential(2)}`);
console.log(`   adjusted values that decrease where the raw ones increase: ${nonMonotone}`);
