/* _lab/cell-markers-compare-measure.mjs — the four comparisons he asked for
 * (2026-09-24, "how we compare and identify genes between samples and between
 * cell types; any other common comparisons?"), measured before any mock.
 *
 *   C1 CONDITION, WITH A REAL EFFECT — Kupffer cells, tumour against liver,
 *      20 genes truly changed (up or down by `condition` log2), under the
 *      sample effect: what each test finds (true changes called) and what it
 *      calls besides (false calls), at p_val_adj / padj < 0.05.
 *   C2 CLUSTER AGAINST CLUSTER — hepatocytes against all other cells, and
 *      against tumour cells, which share 10 of the hepatocyte markers
 *      (hepatoblastoma is a tumour of hepatocyte precursors); and periportal
 *      against pericentral hepatocytes: which genes top each list.
 *   C3 DIFFERENTIAL ABUNDANCE — each type's share per sample, liver against
 *      tumour, with the samples' own mixes varying (compSd): a test over
 *      CELLS (the pooled counts, chi-square) against a test over SAMPLES
 *      (the four shares, a t-test on the logit), for types whose true share
 *      barely differs between the tissues.
 *   C4 CONSERVED MARKERS — hepatocytes against all other cells, pooled and
 *      within each patient separately, with 10 genes raised in patient 1's
 *      hepatocytes only: which list those genes reach. FindConservedMarkers
 *      combines the per-group p with metap's minimump by default:
 *      p = 1 − (1 − min p)^k.
 *
 *   node widgets/_lab/cell-markers-compare-measure.mjs
 */
import fs from "node:fs";
import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";
import { analyse } from "../deseq2/engine.js";
import { simulate, simulateType, normalise, findMarkers, geneKind, geneName, isConditionGene, TYPES, SAMPLES, G, G_MARK, G_HOUSE, G_ZONE } from "../cell-markers/engine.js";

const out = [];
const say = (s) => { out.push(s); console.log(s); };
const pct = (x) => `${Math.round(100 * x)}%`;
const LOG05 = Math.log10(0.05);
const t0 = Date.now();

/* ------------------------------------------------------------- C1 */
say("C1 CONDITION WITH A REAL EFFECT — Kupffer cells, 120 a sample; 20 genes truly changed; three seeds each");
for (const cond of [0.5, 1, 2]) for (const sampleSd of [0, 0.4]) {
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const cells = simulateType(makeRng(seed), "kupffer", { perSample: 120, patientSd: 0.3, sampleSd, condition: cond });
    const Y = normalise(cells);
    const fm = findMarkers(Y, (i) => cells[i].tissue === "tumour", (i) => cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    const sigC = fm.res.filter((x) => x.lpAdj < LOG05);
    const order = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
    const counts = Array.from({ length: G }, (_, g) => order.map((sk) => cells.reduce((s, c) => s + (c.sample === sk ? c.x[g] : 0), 0)));
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    const sigD = an.expressed.filter((g) => an.resMAP[g].padj < 0.05);
    const tpC = sigC.filter((x) => isConditionGene(x.g)).length, fpC = sigC.length - tpC;
    const tpD = sigD.filter((g) => isConditionGene(g)).length, fpD = sigD.length - tpD;
    rows.push({ tpC, fpC, tpD, fpD });
  }
  const avg = (k) => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
  say(`  change ${cond} log2, sample sd ${sampleSd}: over cells finds ${avg("tpC")} of 20 and calls ${avg("fpC")} unchanged genes; DESeq2 over samples finds ${avg("tpD")} of 20 and calls ${avg("fpD")}`);
}

/* ------------------------------------------------------------- C2 */
say("\nC2 CLUSTER AGAINST CLUSTER — true types, zonation 3; the top 10 genes up in hepatocytes by p");
{
  const cells = simulate(makeRng(1), { cells: 300, patientSd: 0, zonation: 3 });
  const Y = normalise(cells);
  const kind = (g) => { const k = geneKind(g); if (k.kind === "marker" && k.type === 0) return g % G_MARK < 10 ? "shared with tumour" : "hepatocyte only"; return k.kind === "marker" ? `${TYPES[k.type].name} marker` : k.kind; };
  const top = (fm) => fm.res.filter((x) => x.lfc > 0).sort((a, b) => a.lp - b.lp).slice(0, 10);
  const tally = (list) => { const m = {}; list.forEach((x) => { const k = kind(x.g); m[k] = (m[k] ?? 0) + 1; }); return Object.entries(m).map(([k, v]) => `${v} ${k}`).join(", "); };
  const vsRest = findMarkers(Y, (i) => cells[i].type === 0, (i) => cells[i].type !== 0, { nGenes: 33538 });
  const vsTum = findMarkers(Y, (i) => cells[i].type === 0, (i) => cells[i].type === 1, { nGenes: 33538 });
  say(`  hepatocytes vs all other cells: ${tally(top(vsRest))}`);
  say(`  hepatocytes vs tumour cells:    ${tally(top(vsTum))}`);
  const sharedRest = vsRest.res.filter((x) => kind(x.g) === "shared with tumour"), sharedTum = vsTum.res.filter((x) => kind(x.g) === "shared with tumour");
  const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  say(`  the 10 genes hepatocytes share with tumour cells: vs rest median avg_log2FC ${med(sharedRest.map((x) => x.lfc)).toFixed(2)}, p 1e${Math.round(med(sharedRest.map((x) => x.lp)))}; vs tumour ${sharedTum.length ? `median avg_log2FC ${med(sharedTum.map((x) => x.lfc)).toFixed(2)}, ${sharedTum.filter((x) => x.lpAdj < LOG05).length} of 10 at p_val_adj < 0.05` : "none pass the logfc threshold"}`);
  const hepIdx = cells.map((c, i) => (c.type === 0 ? i : -1)).filter((i) => i >= 0);
  const portal = new Set(hepIdx.filter((i) => cells[i].z < 0.5)), central = new Set(hepIdx.filter((i) => cells[i].z >= 0.5));
  const vsZone = findMarkers(Y, (i) => portal.has(i), (i) => central.has(i), { nGenes: 33538 });
  const topZ = vsZone.res.slice().sort((a, b) => a.lp - b.lp).slice(0, 10);
  say(`  periportal vs pericentral hepatocytes (by true position, z < 0.5): top 10 by p ${topZ.map((x) => geneName(x.g)).join(" ")}; ${vsZone.res.filter((x) => x.lpAdj < LOG05).length} genes at p_val_adj < 0.05, ${vsZone.res.filter((x) => x.lpAdj < LOG05 && geneKind(x.g).kind === "zone").length} of them zonation genes`);
}

/* ------------------------------------------------------------- C3 */
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d; for (let m = 1; m <= 300; m += 1) { const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c; aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}
function chi2P(x2) { // df 1: p = erfc(sqrt(x2/2))
  const z = Math.sqrt(x2 / 2), t = 1 / (1 + 0.5 * z);
  return t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
}
say("\nC3 DIFFERENTIAL ABUNDANCE — 400 cells a sample; each sample's mix varies around its tissue's by compSd; per type, liver against tumour");
say(`  true shares, liver → tumour (79's mixes): ${TYPES.map((t) => `${t.name} ${Math.round(100 * ((SAMPLES[0].mix[t.key] + SAMPLES[2].mix[t.key]) / 2))}→${Math.round(100 * ((SAMPLES[1].mix[t.key] + SAMPLES[3].mix[t.key]) / 2))}%`).join(", ")}`);
for (const compSd of [0, 0.3, 0.6]) {
  const calls = TYPES.map(() => ({ cells: 0, samples: 0 }));
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const seed of SEEDS) {
    const cells = simulate(makeRng(seed), { cells: 400, patientSd: 0, compSd });
    const n = {}; SAMPLES.forEach((s) => { n[s.key] = new Array(TYPES.length).fill(0); });
    cells.forEach((c) => { n[c.sample][c.type] += 1; });
    TYPES.forEach((_, t) => {
      /* over cells: the 2×2 table of this type against the rest, liver against tumour, pooled */
      const a = n["p1-liver"][t] + n["p2-liver"][t], b = 800 - a, c2 = n["p1-tumour"][t] + n["p2-tumour"][t], d = 800 - c2;
      const N = a + b + c2 + d, x2 = (N * (a * d - b * c2) ** 2) / ((a + b) * (c2 + d) * (a + c2) * (b + d) || 1);
      if (chi2P(x2) < 0.05) calls[t].cells += 1;
      /* over samples: logit share per sample, a two-sample t, 2 against 2 */
      const lg = (k) => { const p = (n[k][t] + 0.5) / 401; return Math.log(p / (1 - p)); };
      const L = [lg("p1-liver"), lg("p2-liver")], T = [lg("p1-tumour"), lg("p2-tumour")];
      const m1 = (L[0] + L[1]) / 2, m2 = (T[0] + T[1]) / 2, v = ((L[0] - m1) ** 2 + (L[1] - m1) ** 2 + (T[0] - m2) ** 2 + (T[1] - m2) ** 2) / 2;
      const tt = (m2 - m1) / Math.sqrt(v * (1 / 2 + 1 / 2) || 1e-12);
      if (ibeta(2 / (2 + tt * tt), 1, 0.5) < 0.05) calls[t].samples += 1;
    });
  }
  say(`  compSd ${compSd}: called at p < 0.05 in ${SEEDS.length} seeds — ${TYPES.map((t, i) => `${t.name} ${calls[i].cells}/${calls[i].samples}`).join(", ")}  (over cells / over samples)`);
}

/* ------------------------------------------------------------- C4 */
say("\nC4 CONSERVED MARKERS — hepatocytes against all other cells; 10 genes raised in patient 1's hepatocytes only (interaction, log2)");
for (const interaction of [1, 2]) {
  const cells = simulate(makeRng(1), { cells: 300, patientSd: 0.3, zonation: 3, interaction });
  const Y = normalise(cells);
  const inter = (g) => g >= TYPES.length * G_MARK + G_HOUSE && g < TYPES.length * G_MARK + G_HOUSE + 10;
  const pooled = findMarkers(Y, (i) => cells[i].type === 0, (i) => cells[i].type !== 0, { nGenes: 33538 });
  const per = [1, 2].map((p) => findMarkers(Y, (i) => cells[i].patient === p && cells[i].type === 0, (i) => cells[i].patient === p && cells[i].type !== 0, { nGenes: 33538, logfc: 0, minPct: 0 }));
  const lpOf = (fm) => new Map(fm.res.map((x) => [x.g, x]));
  const [m1, m2] = per.map(lpOf);
  /* conserved: up in both patients, combined by minimump, Bonferroni over the dataset */
  const conserved = pooled.res.filter((x) => x.lfc > 0).map((x) => {
    const a = m1.get(x.g), b = m2.get(x.g);
    if (!a || !b || a.lfc <= 0 || b.lfc <= 0) return { ...x, ok: false };
    const pmin = Math.min(10 ** a.lp, 10 ** b.lp), comb = 1 - (1 - pmin) ** 2;
    return { ...x, ok: Math.min(1, comb * 33538) < 0.05 && Math.max(a.lpAdj, b.lpAdj) < LOG05 };
  });
  const pooledSig = pooled.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05);
  const interPooled = pooledSig.filter((x) => inter(x.g)).length;
  const interCons = conserved.filter((x) => x.ok && inter(x.g)).length;
  const topPooled = pooledSig.slice().sort((a, b) => a.lp - b.lp).slice(0, 20).filter((x) => inter(x.g)).length;
  say(`  interaction ${interaction}: pooled, ${interPooled} of the 10 patient-1-only genes at p_val_adj < 0.05 (${topPooled} in the top 20); conserved in both patients, ${interCons}; the hepatocyte markers conserved: ${conserved.filter((x) => x.ok && geneKind(x.g).kind === "marker" && geneKind(x.g).type === 0).length} of 25`);
}
say(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
fs.writeFileSync(new URL("./cell-markers-compare-measure.txt", import.meta.url), out.join("\n") + "\n");
