/* Widget 79 · is a doublet page worth building, and what would it show?
 * (2026-09-23, his round 3: "can i check if it's worthwhile illustrating how
 * doublets are identified and removed? actually what's the algorithm?")
 *
 * WHAT THE LESSON DOES: nothing. 02-2 names doublets twice, both in prose —
 * cell 15, "to filter out cells with too many genes detected (doublets)", and
 * cell 24, "Too high a number could indicate doublet/multiplets" — and then
 * sets no upper threshold at all. No tool is named in any of the four
 * single-cell notebooks; grepped for DoubletFinder, scDblFinder, Scrublet and
 * DoubletDetection, none appears.
 *
 * WHAT THE FIELD DOES, and what this script measures. Every widely used
 * detector (Scrublet, DoubletFinder, scDblFinder) shares one idea, which is
 * worth a figure precisely because it is so unlike a threshold:
 *
 *   1. MAKE doublets. Take random pairs of the observed droplets and add their
 *      counts together. These are artificial doublets and you know every one.
 *   2. Put the real droplets and the artificial ones in the same space.
 *   3. For each real droplet, look at its k nearest neighbours in that space
 *      and score it by the share of them that are artificial.
 *   4. A droplet sitting in a crowd of made-up doublets is called a doublet.
 *
 * Neither scrublet nor R is installed on this machine, so the core is
 * implemented in the widget's own engine (`doubletScores`: steps 1 to 3, no
 * PCA, because the stage's space is already the six block fractions the map
 * is drawn from) and scored here against the stage's own truth, which knows
 * which droplets really hold two cells and which two types each holds. What
 * the numbers are an upper bound on is said at the foot.
 *
 * This ran BEFORE the page existed and is what decided that it should: the
 * 98% against 0% is the finding, and the widget's Doublets page is that
 * finding drawn.
 *
 *   node widgets/_lab/cell-qc-doublet-measure.mjs        (~3 s)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, applyFilters, doubletScores, median, TYPES, THRESHOLDS } from "../cell-qc/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const findings = [];
const say = (s) => { console.log(s); findings.push(s); };
const pct = (x) => `${(100 * x).toFixed(0)}%`;

const { cells } = simulate(makeRng(1), {});
const { keep } = applyFilters(cells, THRESHOLDS);
/* the method runs on what the thresholds left, as it does in a real pipeline */
const real = cells.map((c, i) => i).filter((i) => keep[i]);

const truth = (i) => cells[i].state === "doublet";
const het = (i) => cells[i].state === "doublet" && cells[i].partner !== cells[i].type;
const nDbl = real.filter(truth).length;
const nHet = real.filter(het).length;
say(`STAGE — ${real.length} droplets survive the thresholds, ${nDbl} of them hold two cells (${pct(nDbl / real.length)}); ${nHet} hold two DIFFERENT types and ${nDbl - nHet} two of the same`);

say("");
say("THE METHOD — artificial doublets, then each droplet scored by the share of its neighbours that are artificial");
say("  `ratio` is how many artificial doublets are made per droplet (Scrublet's sim_doublet_ratio is 2; DoubletFinder's pN is a quarter of the augmented set), `k` how many neighbours are counted");
const runs = {};
for (const ratio of [1, 2]) {
  for (const k of [20, 50]) {
    const t0 = performance.now();
    const { score } = doubletScores(makeRng(7), cells, real, { ratio, k });
    const ms = performance.now() - t0;
    runs[`${ratio}|${k}`] = score;
    const pick = (f) => real.map((i, r) => [i, score[r]]).filter(([i]) => f(i)).map(([, v]) => v);
    const sHet = pick(het), sHom = pick((i) => truth(i) && !het(i)), sGood = pick((i) => cells[i].state === "good");
    /* the best any line on this score could do: call the top nDbl of them */
    const order = real.map((i, r) => r).sort((x, y) => score[y] - score[x]);
    const called = new Set(order.slice(0, nDbl).map((r) => real[r]));
    const tp = [...called].filter(truth).length, tpHet = [...called].filter(het).length;
    say(`  ratio ${ratio}, k = ${k} (${ms.toFixed(0)} ms): calling the top ${nDbl} finds ${tp} of the ${nDbl} (${pct(tp / nDbl)}) — ${tpHet} of the ${nHet} holding two different types (${pct(tpHet / nHet)}), ${tp - tpHet} of the ${nDbl - nHet} holding two of the same (${pct((tp - tpHet) / Math.max(1, nDbl - nHet))})`);
    say(`      median score: two different types ${median(sHet).toFixed(2)}, two of the same ${median(sHom).toFixed(2)}, one cell ${median(sGood).toFixed(2)}`);
  }
}

say("");
say("WHERE TO PUT THE LINE — the widget's own control, at ratio 1 and k = 50");
{
  const score = runs["1|50"];
  for (const cut of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const called = real.filter((i, r) => score[r] >= cut);
    const tp = called.filter(truth).length, tpHet = called.filter(het).length;
    const lost = called.filter((i) => cells[i].state === "good").length;
    say(`  at ${cut.toFixed(1)}: calls ${String(called.length).padStart(3)}, finds ${String(tp).padStart(2)} of the ${nDbl} (${tpHet} of the ${nHet} heterotypic, ${tp - tpHet} of the ${nDbl - nHet} homotypic), and takes ${lost} droplets holding one cell`);
  }
}

say("");
say("AGAINST THE LESSON'S OWN METHOD — an upper threshold on the genes detected");
{
  const sorted = Float64Array.from(real.map((i) => cells[i].nFeature)).sort();
  for (const p of [0.9, 0.95]) {
    const cut = sorted[Math.floor(p * sorted.length)];
    const called = real.filter((i) => cells[i].nFeature >= cut);
    const tp = called.filter(truth).length, tpHet = called.filter(het).length;
    say(`  a cut at the ${100 * p}th percentile (${cut} genes) calls ${called.length} droplets and finds ${tp} of the ${nDbl} (${pct(tp / nDbl)}), ${tpHet} of them heterotypic; ${called.length - tp} of the calls hold one cell`);
  }
}

say("");
say("WHY THE SAME-TYPE DOUBLET IS THE POINT");
{
  const score = runs["1|50"];
  const by = {};
  for (const t of TYPES) by[t.key] = { het: [], hom: [] };
  real.forEach((i, r) => {
    if (!truth(i)) return;
    (het(i) ? by[cells[i].type].het : by[cells[i].type].hom).push(score[r]);
  });
  for (const t of TYPES) {
    const b = by[t.key];
    if (!b.het.length && !b.hom.length) continue;
    say(`  ${t.name.padEnd(17)} two different types ${b.het.length ? median(b.het).toFixed(2) : "  – "} (n ${String(b.het.length).padStart(2)})   two ${t.name.toLowerCase()}s ${b.hom.length ? median(b.hom).toFixed(2) : "  – "} (n ${String(b.hom.length).padStart(2)})`);
  }
  say("  A doublet of two cells of one type has that type's profile, so the artificial doublets near it are the ones made from that type too — and so is every ordinary cell of it. There is nothing in the profile to find. This is what DoubletFinder's homotypic-proportion adjustment concedes rather than solves.");
}

say("");
say("WHAT THESE NUMBERS ARE AN UPPER BOUND ON. The stage's doublets ARE two droplets' counts added together, and step 1 makes its artificial doublets the same way, so the method is being asked to recognise exactly the thing it simulates. A real doublet also carries ambient RNA, is captured with its own efficiency, and the two cells are not always in their type's centre. Read the heterotypic share as the ceiling, and the same-type share as the honest floor: the second is a property of the profile, not of the method.");

fs.writeFileSync(path.join(here, "cell-qc-doublet-measure.txt"), findings.join("\n") + "\n");
console.log("\nwritten: widgets/_lab/cell-qc-doublet-measure.txt");
