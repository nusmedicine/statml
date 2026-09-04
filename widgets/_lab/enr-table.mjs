/* ============================================================================
   SHOULD THE SCORE TAB HAVE A RESULTS TABLE? — measured before it was built,
   because two of the three answers were not guessable.

     node widgets/_lab/enr-table.mjs

   Tab 1 prints eight pathways with a p and a corrected p. Tab 2 printed one
   pathway's permutation p in a readout tile and nothing else, which left a
   reader able to conclude that multiple test correction is ORA's problem —
   when `gseGO` corrects too, and cell 10 of the notebook passes
   `pAdjustMethod = "BH"` explicitly.

   Three questions decided it:

     1. is a raw ES COMPARABLE across pathways of different sizes? If not, a
        column of ES invites a comparison the number cannot support, and the
        answer is a NORMALISED score rather than no table;
     2. does normalising actually reorder THIS collection, or is it a
        formality on a stage whose sets are all much of a size;
     3. what eight permutation nulls cost, on a panel whose cache exists
        because a thousand permutations already blew the frame budget once.

   Kenneth read these on 2026-09-04 and chose the table.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import {
  makeStage, gsea, gseaNull, gseaAll, normalisedScore, N_SETS,
} from "../enrichment/model.js";

const PERMS = 1000, A = 0.05;
const L = console.log;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;


/* --- 1. is a raw ES comparable across set sizes? --------------------------- */

L("=".repeat(78));
L("1. IS A RAW ES COMPARABLE ACROSS SET SIZES?");
L("=".repeat(78));
L(`
   Random sets only — nothing planted — so any pattern here is SIZE, not
   biology. 40 draws of each size, |ES| averaged. Seed 174, fold change.
`);
const st = makeStage(makeRng(174), { scale: 1, metric: "fc" });
const all = [...Array(st.genes).keys()];
const rng = makeRng(99);
L("     set size |  mean |ES| of a RANDOM set of that size");
L("   " + "-".repeat(56));
const bySize = {};
for (const size of [12, 20, 30, 45, 80, 150]) {
  const es = [];
  for (let i = 0; i < 40; i += 1) {
    const members = new Set(rng.shuffle(all).slice(0, size));
    es.push(Math.abs(gsea({ ...st, sets: [{ index: 0, members, size }] }, 0).es));
  }
  bySize[size] = mean(es);
  L(`        ${String(size).padStart(4)}   |   ${bySize[size].toFixed(3)}`);
}
L(`
   A random 12-gene set scores ${bySize[12].toFixed(3)} and a random 150-gene set
   ${bySize[150].toFixed(3)} — ${(bySize[12] / bySize[150]).toFixed(1)}x apart with NOTHING in either, and still
   ${(bySize[12] / bySize[45]).toFixed(2)}x over the 12-45 range this stage actually uses. A raw ES is
   therefore not comparable down a column, which is why GSEA reports a
   NORMALISED score and why the table's score column is NES.`);


/* --- 2. does normalising reorder anything? --------------------------------- */

L(`
${"=".repeat(78)}`);
L("2. DOES NES REORDER THE COLLECTION?");
L("=".repeat(78));
L(`
   Set sizes here run 12-45, a much narrower spread than a real GO collection's
   10 to 500+, so it is a fair question whether the correction does anything.
   40 seeds, 400 permutations.
`);
let reordered = 0, topChanged = 0, vsP = 0;
const SEEDS = 40;
for (let s = 1; s <= SEEDS; s += 1) {
  const stage = makeStage(makeRng(s), { scale: 1, metric: "fc" });
  const rows = stage.sets.map((set) => {
    const nul = gseaNull(stage, set.index, makeRng(400 + set.index), 400);
    return { i: set.index, es: gsea(stage, set.index).es, nes: normalisedScore(nul.obs, nul.draws), p: nul.p };
  });
  const byEs = [...rows].sort((a, b) => Math.abs(b.es) - Math.abs(a.es)).map((r) => r.i).join();
  const byNes = [...rows].sort((a, b) => Math.abs(b.nes) - Math.abs(a.nes)).map((r) => r.i).join();
  const byP = [...rows].sort((a, b) => a.p - b.p).map((r) => r.i).join();
  if (byEs !== byNes) reordered += 1;
  if (byEs[0] !== byNes[0]) topChanged += 1;
  if (byNes !== byP) vsP += 1;
}
const pc = (v) => `${((100 * v) / SEEDS).toFixed(0)}%`.padStart(4);
L(`   the eight rows come out in a DIFFERENT order under NES:  ${pc(reordered)} of seeds`);
L(`   the TOP row changes:                                     ${pc(topChanged)} of seeds`);
L(`   the NES order disagrees with the p-value order:          ${pc(vsP)} of seeds`);
L(`
   SO IT IS NOT A FORMALITY. Worth knowing how this nearly went the other way:
   the first check was run on seed 174 alone, where ES and NES give the SAME
   order, and the conclusion drawn was that normalising did nothing here. Seed
   174 is in the 10% minority. One seed is not a finding — see
   \`docs/design-principles.md\` on measuring before asserting.`);


/* --- 3. the table at the default state, and what it costs ------------------ */

L(`
${"=".repeat(78)}`);
L("3. THE TABLE AT THE WIDGET'S DEFAULT STATE — seed 174, moderate, fold change");
L("=".repeat(78));
L("");
const rows = gseaAll(st, makeRng(7), PERMS);
L("   pathway    planted   size      ES      NES        p    after BH");
L("   " + "-".repeat(64));
for (const r of rows) {
  L(`   ${r.label.padEnd(10)} ${String(r.planted ?? "—").padEnd(9)} ${String(r.size).padStart(4)}  `
    + `${r.es.toFixed(3).padStart(6)}  ${r.nes.toFixed(3).padStart(6)}  ${r.p.toFixed(4).padStart(7)}  `
    + `${r.padj.toFixed(4).padStart(8)}${r.padj < A ? "  <== survives" : r.p < A ? "  (lost to BH)" : ""}`);
}
L(`
   ${rows.filter((r) => r.p < A).length} of ${N_SETS} reach ${A}, ${rows.filter((r) => r.padj < A).length} survive the correction.

   WHY THIS IS WORTH A PANEL: the top row is the DOWN-REGULATED pathway, and on
   the ORA tab at this very seed it reads p = 0.9991 with one gene of 41 in the
   list. The arc's whole argument — a cutoff at the top of a ranking cannot see
   a set at the bottom, and a walk over the whole ranking can — is those two
   tables side by side rather than a claim in a caption.`);

L(`
${"=".repeat(78)}`);
L("4. WHAT IT COSTS");
L("=".repeat(78));
L("");
for (const perms of [200, 400, 1000]) {
  const t0 = performance.now();
  for (const s of st.sets) gseaNull(st, s.index, makeRng(7), perms);
  const t8 = performance.now() - t0;
  const t1 = (() => { const a = performance.now(); gseaNull(st, 0, makeRng(7), perms); return performance.now() - a; })();
  L(`   ${String(perms).padStart(4)} permutations:  one pathway ${t1.toFixed(1)} ms, all ${N_SETS} ${t8.toFixed(1)} ms`);
}
L(`
   MEASURED IN THE BROWSER at ${PERMS}: a seed change 106 ms, a cutoff drag 3 ms,
   picking a pathway 2 ms. The last two are the ones that improved — the null
   cache stopped keying on the pathway, so a pick that used to cost a fresh
   thousand permutations now costs nothing.

   THE SEED DRAG IS THE PRICE: 110 ms a step, about 9 frames a second. Kenneth
   chose that on 2026-09-04 over dropping to 400 permutations (~42 ms a step),
   because at 400 the finest p a pathway can reach is 1/401 and the readout
   could no longer print the 0.001 it prints today. The figure is correct at
   every step of the drag; it steps rather than slides.`);
