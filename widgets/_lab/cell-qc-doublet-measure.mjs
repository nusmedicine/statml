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
 * implemented here (step 1 to 4, no PCA: the stage's space is already the six
 * block fractions the map is drawn from) and scored against the stage's own
 * truth, which knows which droplets really hold two cells and which two types
 * each holds. What the numbers are an upper bound on is said at the foot.
 *
 *   node widgets/_lab/cell-qc-doublet-measure.mjs        (~3 s)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, profileOf, applyFilters, median, TYPES, THRESHOLDS } from "../cell-qc/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const findings = [];
const say = (s) => { console.log(s); findings.push(s); };
const pct = (x) => `${(100 * x).toFixed(0)}%`;

const rng = makeRng(1);
const { cells } = simulate(rng, {});
const { keep } = applyFilters(cells, THRESHOLDS);
/* the method runs on what the thresholds left, as it does in a real pipeline */
const real = cells.map((c, i) => i).filter((i) => keep[i]);
const prof = new Map();
const pRng = makeRng(11);
for (const i of real) prof.set(i, profileOf(pRng, cells[i]));

const truth = (i) => cells[i].state === "doublet";
const heterotypic = (i) => cells[i].state === "doublet" && cells[i].partner !== cells[i].type;
const nDbl = real.filter(truth).length;
const nHet = real.filter(heterotypic).length;
say(`STAGE — ${real.length} droplets survive the lesson's thresholds, ${nDbl} of them hold two cells (${pct(nDbl / real.length)}); ${nHet} hold two DIFFERENT types and ${nDbl - nHet} two of the same`);

/* --- step 1: make doublets ------------------------------------------------- */
/* the field's own rate: Scrublet's `sim_doublet_ratio` is 2 by default,
   DoubletFinder's pN is 0.25 of the augmented set. Both make far more than
   they expect to find, so the neighbourhood of a real doublet can fill up. */
function makeArtificial(rng2, n) {
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const a = real[Math.floor(rng2.next() * real.length)];
    let b = real[Math.floor(rng2.next() * real.length)];
    while (b === a) b = real[Math.floor(rng2.next() * real.length)];
    /* adding two droplets' counts adds their profiles in proportion to what
       each contributed, which is what summing their count vectors does */
    const wa = cells[a].nCount, wb = cells[b].nCount;
    const pa = prof.get(a), pb = prof.get(b);
    out.push(pa.map((v, j) => (v * wa + pb[j] * wb) / (wa + wb)));
  }
  return out;
}

/* --- steps 2 and 3: the neighbourhood score -------------------------------- */
const dist2 = (u, v) => { let s = 0; for (let j = 0; j < u.length; j += 1) s += (u[j] - v[j]) ** 2; return s; };
function scores(art, k) {
  const pts = [...real.map((i) => ({ p: prof.get(i), art: 0 })), ...art.map((p) => ({ p, art: 1 }))];
  return real.map((i, ri) => {
    const me = pts[ri].p;
    /* the k nearest, excluding the droplet itself */
    const d = [];
    for (let j = 0; j < pts.length; j += 1) { if (j === ri) continue; d.push([dist2(me, pts[j].p), pts[j].art]); }
    d.sort((a, b) => a[0] - b[0]);
    let a = 0;
    for (let j = 0; j < k; j += 1) a += d[j][1];
    return a / k;
  });
}

/* --- step 4: call them, and score the calls -------------------------------- */
function report(label, sc) {
  /* call the top `nDbl` scores, which is the best any threshold on this score
     could do — an expected doublet rate is what a real run supplies instead */
  const order = real.map((i, ri) => ri).sort((a, b) => sc[b] - sc[a]);
  const called = new Set(order.slice(0, nDbl).map((ri) => real[ri]));
  const tp = [...called].filter(truth).length;
  const tpHet = [...called].filter(heterotypic).length;
  say(`  ${label}: calling the top ${nDbl} scores finds ${tp} of the ${nDbl} doublets (${pct(tp / nDbl)}) — ${tpHet} of the ${nHet} that hold two different types (${pct(tpHet / nHet)}), ${tp - tpHet} of the ${nDbl - nHet} that hold two of the same (${pct((tp - tpHet) / Math.max(1, nDbl - nHet))})`);
  /* and the separation itself, which does not depend on where the line goes */
  const sDbl = real.map((i, ri) => [i, sc[ri]]).filter(([i]) => truth(i)).map(([, v]) => v);
  const sHet = real.map((i, ri) => [i, sc[ri]]).filter(([i]) => heterotypic(i)).map(([, v]) => v);
  const sHom = real.map((i, ri) => [i, sc[ri]]).filter(([i]) => truth(i) && !heterotypic(i)).map(([, v]) => v);
  const sGood = real.map((i, ri) => [i, sc[ri]]).filter(([i]) => cells[i].state === "good").map(([, v]) => v);
  say(`      median score: two different types ${median(sHet).toFixed(2)}, two of the same ${median(sHom).toFixed(2)}, one cell ${median(sGood).toFixed(2)}`);
  return { tp, tpHet, sDbl, sGood };
}

say("");
say("THE METHOD — artificial doublets, then each droplet scored by the share of its neighbours that are artificial");
for (const ratio of [1, 2]) {
  const art = makeArtificial(makeRng(7), Math.round(ratio * real.length));
  for (const k of [20, 50]) report(`${ratio}× artificial, k = ${k}`, scores(art, k));
}

say("");
say("AGAINST THE LESSON'S OWN METHOD — an upper threshold on the genes detected");
{
  const sorted = Float64Array.from(real.map((i) => cells[i].nFeature)).sort();
  for (const p of [0.9, 0.95]) {
    const cut = sorted[Math.floor(p * sorted.length)];
    const called = real.filter((i) => cells[i].nFeature >= cut);
    const tp = called.filter(truth).length;
    const tpHet = called.filter(heterotypic).length;
    say(`  a cut at the ${100 * p}th percentile (${cut} genes) calls ${called.length} droplets and finds ${tp} of the ${nDbl} (${pct(tp / nDbl)}), ${tpHet} of them heterotypic; ${called.length - tp} of the calls hold one cell`);
  }
}

say("");
say("WHY THE SAME-TYPE DOUBLET IS THE POINT");
{
  const art = makeArtificial(makeRng(7), 2 * real.length);
  const sc = scores(art, 50);
  const byType = {};
  for (const t of TYPES) byType[t.key] = { het: [], hom: [] };
  real.forEach((i, ri) => {
    if (!truth(i)) return;
    (heterotypic(i) ? byType[cells[i].type].het : byType[cells[i].type].hom).push(sc[ri]);
  });
  for (const t of TYPES) {
    const b = byType[t.key];
    if (!b.het.length && !b.hom.length) continue;
    say(`  ${t.name.padEnd(17)} two different types ${b.het.length ? median(b.het).toFixed(2) : "  – "} (n ${String(b.het.length).padStart(2)})   two ${t.name.toLowerCase()}s ${b.hom.length ? median(b.hom).toFixed(2) : "  – "} (n ${String(b.hom.length).padStart(2)})`);
  }
  say("  A doublet of two cells of one type has that type's profile, so the artificial doublets near it are the ones made from that type too — and so is every ordinary cell of it. There is nothing in the profile to find. This is what DoubletFinder's homotypic-proportion adjustment concedes rather than solves.");
}

say("");
say("WHAT THESE NUMBERS ARE AN UPPER BOUND ON. The stage's doublets ARE two droplets' counts added together, and step 1 makes its artificial doublets the same way, so the method is being asked to recognise exactly the thing it simulates. A real doublet also carries ambient RNA, is captured with its own efficiency, and the two cells are not always in their type's centre. Read the heterotypic share as the ceiling, and the same-type share as the honest floor: the second is a property of the profile, not of the method.");

fs.writeFileSync(path.join(here, "cell-qc-doublet-measure.txt"), findings.join("\n") + "\n");
console.log("\nwritten: widgets/_lab/cell-qc-doublet-measure.txt");
