/* cell-markers · Tumour vs liver: which test does better, over seeds.
 *
 * Kenneth, 2026-09-25: "what is the ground truth [in the readout]? how do we
 * compare which method works better?" One seed is one draw; this runs the
 * page's two tests over 20 seeds at every sample effect, with and without a
 * true change, on the widget's own stage (300 cells a sample, patient effect
 * 0.3). The cluster is the true cell type: at resolution 0.3 the clusters are
 * the types (ARI 1.00, page3-measure).
 *
 * Truth: at True change c, each type's own 20 spread genes (type t: the t-th
 * block of 20, conditionByType — Kupffer Gene101–Gene120, immune Gene41–Gene60)
 * change by c log2 in its tumour-sample cells, half up, half down; every
 * other gene is unchanged. (Before 2026-09-25 evening every type shared
 * Gene1–Gene20; re-run on his "give each cell type its own changed genes".) So each test's calls split into
 *   true positives  — of the 20 changed genes, how many it calls (power)
 *   false positives — unchanged genes it calls
 *   any false call  — the share of seeds with at least one (family-wise error)
 *
 *   node widgets/_lab/cell-markers-methods-measure.mjs
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { simulate, normalise, findMarkers, conditionGenesOf, TYPES, G } from "../cell-markers/engine.js";
import { analyse } from "../deseq2/engine.js";

const ORDER = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
const derived = (seed, salt) => (seed * 7919 + salt) % 2147483647;
const ALL = TYPES.map((t) => t.key), LOG05 = Math.log10(0.05);
const SEEDS = 20, out = [];
const say = (s) => { out.push(s); console.log(s); };

say(`cell-markers · Tumour vs liver: FindMarkers over cells against DESeq2 over the 4 pseudobulk samples, ${SEEDS} seeds each`);
say("TP = truly changed genes called (of 20); FP = unchanged genes called; any FP = share of seeds with at least one\n");
for (const typeKey of ["kupffer", "immune"]) {
  const ti = TYPES.findIndex((t) => t.key === typeKey);
  say(`${TYPES[ti].name}s`);
  say("change  sample  |  over cells: TP   FP  any FP  |  over samples: TP   FP  any FP");
  for (const change of [0, 1, 2]) for (const sampleSd of [0, 0.2, 0.4, 0.65]) {
    const acc = { cTP: 0, cFP: 0, cAny: 0, dTP: 0, dFP: 0, dAny: 0, n: 0 };
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const cells = simulate(makeRng(derived(seed, 1)), { cells: 300, patientSd: 0.3, sampleSd, condition: change, conditionTypes: ALL, conditionByType: true, integrated: false });
      const Y = normalise(cells), inC = (i) => cells[i].type === ti;
      const own = conditionGenesOf(ti), truth = (g) => change > 0 && own(g);
      const fm = findMarkers(Y, (i) => inC(i) && cells[i].tissue === "tumour", (i) => inC(i) && cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
      const cCalls = fm.res.filter((x) => x.lpAdj < LOG05).map((x) => x.g);
      const counts = Array.from({ length: G }, (_, g) => ORDER.map((k) => cells.reduce((s, c) => s + (c.type === ti && c.sample === k ? c.x[g] : 0), 0)));
      const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
      const dCalls = an.expressed.filter((g) => an.resMAP[g].padj < 0.05);
      const tp = (calls) => calls.filter(truth).length, fp = (calls) => calls.filter((g) => !truth(g)).length;
      acc.cTP += tp(cCalls); acc.cFP += fp(cCalls); acc.cAny += fp(cCalls) > 0;
      acc.dTP += tp(dCalls); acc.dFP += fp(dCalls); acc.dAny += fp(dCalls) > 0; acc.n += 1;
    }
    const m = (v) => (v / acc.n).toFixed(1).padStart(5), pc = (v) => `${Math.round((100 * v) / acc.n)}%`.padStart(6);
    say(`${String(change).padStart(6)}  ${String(sampleSd).padStart(6)}  |            ${change ? m(acc.cTP) : "    —"} ${m(acc.cFP)}  ${pc(acc.cAny)}  |              ${change ? m(acc.dTP) : "    —"} ${m(acc.dFP)}  ${pc(acc.dAny)}`);
  }
  say("");
}
fs.writeFileSync(new URL("./cell-markers-methods-measure.txt", import.meta.url), out.join("\n") + "\n");
