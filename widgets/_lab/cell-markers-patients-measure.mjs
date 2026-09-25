/* cell-markers · Tumour vs liver: does a third patient (or a fifth) change
 * which test does better?
 *
 * Kenneth, 2026-09-25, reading cell-markers-methods-measure: "with n=2, over
 * cells seems to work better than pseudobulk? should we increase to 3
 * patients per tissue?" The same two tests, 20 seeds, Kupffer cells, each
 * type its own 20 changed genes, patient effect 0.3, 300 cells a sample —
 * now at 2, 3 and 5 patients a tissue (engine `patients`). Precision is the
 * share of all calls, pooled over seeds, that truly change.
 *
 *   node widgets/_lab/cell-markers-patients-measure.mjs
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { simulate, normalise, findMarkers, conditionGenesOf, TYPES, G } from "../cell-markers/engine.js";
import { analyse } from "../deseq2/engine.js";

const derived = (seed, salt) => (seed * 7919 + salt) % 2147483647;
const ALL = TYPES.map((t) => t.key), LOG05 = Math.log10(0.05), SEEDS = 20, out = [];
const say = (s) => { out.push(s); console.log(s); };
const ti = TYPES.findIndex((t) => t.key === "kupffer"), own = conditionGenesOf(ti);

say(`Kupffer cells, ${SEEDS} seeds: TP = truly changed genes called (of 20), FP = unchanged called, prec = share of calls true`);
say("patients  change  sample  |  over cells: TP    FP  prec  |  over samples: TP    FP  prec");
for (const patients of [2, 3, 5]) for (const change of [0, 1]) for (const sampleSd of [0, 0.2, 0.4]) {
  const a = { cTP: 0, cFP: 0, dTP: 0, dFP: 0 };
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const cells = simulate(makeRng(derived(seed, 1)), { cells: 300, patientSd: 0.3, sampleSd, condition: change, conditionTypes: ALL, conditionByType: true, patients });
    const Y = normalise(cells), inC = (i) => cells[i].type === ti, truth = (g) => change > 0 && own(g);
    const fm = findMarkers(Y, (i) => inC(i) && cells[i].tissue === "tumour", (i) => inC(i) && cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    const cCalls = fm.res.filter((x) => x.lpAdj < LOG05).map((x) => x.g);
    /* the samples, liver ones first, then tumour: DESeq2's two groups */
    const keys = [...new Set(cells.map((c) => c.sample))].sort((p, q) => (p.endsWith("tumour") - q.endsWith("tumour")) || p.localeCompare(q));
    const counts = Array.from({ length: G }, (_, g) => keys.map((k) => cells.reduce((s, c) => s + (c.type === ti && c.sample === k ? c.x[g] : 0), 0)));
    const an = analyse({ counts, grp: keys.map((k) => (k.endsWith("tumour") ? 1 : 0)), reps: patients, genes: G });
    const dCalls = an.expressed.filter((g) => an.resMAP[g].padj < 0.05);
    a.cTP += cCalls.filter(truth).length; a.cFP += cCalls.filter((g) => !truth(g)).length;
    a.dTP += dCalls.filter(truth).length; a.dFP += dCalls.filter((g) => !truth(g)).length;
  }
  const m = (v) => (v / SEEDS).toFixed(1).padStart(5), pr = (t, f) => (t + f ? `${Math.round((100 * t) / (t + f))}%` : "—").padStart(5);
  say(`${String(patients).padStart(8)}  ${String(change).padStart(6)}  ${String(sampleSd).padStart(6)}  |          ${change ? m(a.cTP) : "    —"} ${m(a.cFP)} ${pr(a.cTP, a.cFP)}  |            ${change ? m(a.dTP) : "    —"} ${m(a.dFP)} ${pr(a.dTP, a.dFP)}`);
}
fs.writeFileSync(new URL("./cell-markers-patients-measure.txt", import.meta.url), out.join("\n") + "\n");
