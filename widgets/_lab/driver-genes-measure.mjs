/* Planning measurement for slot 69 `driver-genes` (PHM5003 07 / 01-3 cells
 * 12–25), after maftools was installed on Kenneth's approval (2026-09-17).
 *
 *   Rscript widgets/_lab/driver-genes-oncodrive.R "<07 - Cancer Mutation Analysis>" <dir>
 *   Rscript widgets/_lab/cancer-plan-export.R "<07 - Cancer Mutation Analysis>" <dir2>
 *   node widgets/_lab/driver-genes-measure.mjs <dir> <dir2> <maftools>/extdata/prot_len.txt.gz
 *
 * (CALIBRATE=1 reruns §4's grid.) The R script runs maftools' own `oncodrive`
 * on the lesson's MAF and writes every gene's residues; this script checks
 * `_lab/driver-genes-model.js`, the port, against all of them before scoring
 * anything simulated with it. Output: `_lab/driver-genes-measure.txt`.
 *
 *   §1 The port. All 4,655 thresholds, all 3,856 genes left out, and all 799
 *      scores, cluster counts, z, p and FDRs agree with maftools.
 *   §2 What decides the score, on the lesson's genes: the count only admits a
 *      gene (minMut), and a gene joining the table is called from score 0.707.
 *   §3 The file counted three ways, the JS recount matching R's 799, 478 and
 *      415 tested genes; and the drivers' shapes counted once.
 *   §4 The passenger genome, calibrated to the file counted once: genes at 5+,
 *      their count quantiles, length by count, the tested share by count, and
 *      the count test's 207 calls on the file. REPEAT_RATE fitted to 799.
 *   §5 Each driver shape against its gene, and score against count.
 *   §6 The cohort page, ten cohorts each way, and the count test beside it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { threshold, clusterGene, zOf, upperTail, benjaminiHochberg, BACKGROUND } from "./driver-genes-model.js";
import * as M from "./driver-genes-model.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node driver-genes-measure.mjs <dir holding gene_positions.tsv and oncodrive_table.tsv>"); process.exit(1); }
function readTsv(file) {
  const L = readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean);
  const h = L[0].replace(/\r$/, "").split("\t");
  return L.slice(1).map((l) => { const x = l.replace(/\r$/, "").split("\t"); return Object.fromEntries(h.map((k, i) => [k, x[i]])); });
}
let checks = 0, failed = 0;
function ck(label, cond, note = "") {
  checks += 1;
  if (!cond) failed += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${note ? " — " + note : ""}`);
}
const f3 = (x) => x.toFixed(3), f4 = (x) => x.toFixed(4);

/* ---------------------------------------------------------------- §1 the port */
console.log("§1 the port against maftools 2.26.0, gene by gene");
const genes = new Map();
for (const r of readTsv("gene_positions.tsv")) {
  if (!genes.has(r.Hugo_Symbol)) genes.set(r.Hugo_Symbol, { gene: r.Hugo_Symbol, total: +r.total, placed: +r.placed, protLen: +r.protLen, th: +r.th, residues: [] });
  genes.get(r.Hugo_Symbol).residues.push({ order: +r.order, pos: +r.pos, N: +r.N });
}
for (const g of genes.values()) g.residues.sort((a, b) => a.order - b.order);
const table = new Map(readTsv("oncodrive_table.tsv").map((r) => [r.Hugo_Symbol, r]));

let thOff = 0, nullOff = 0, countOff = 0, worstScore = 0;
const scored = [];
for (const g of genes.values()) {
  if (threshold(g.total, g.protLen) !== g.th) thOff += 1;
  const res = clusterGene(g.residues, g.th, g.placed);
  const row = table.get(g.gene);
  if ((res === null) !== (row === undefined)) { nullOff += 1; continue; }
  if (!res) continue;
  if (res.count !== +row.clusters || res.inClusters !== +row.muts_in_clusters) countOff += 1;
  worstScore = Math.max(worstScore, Math.abs(res.score - +row.clusterScores));
  scored.push({ ...g, res, row });
}
ck(`threshold equals get_threshold for all ${genes.size} genes`, thOff === 0, `${thOff} differ`);
ck(`null exactly where maftools leaves a gene out (${genes.size - table.size} genes)`, nullOff === 0, `${nullOff} differ`);
ck(`cluster count and mutations in clusters equal for all ${scored.length} tested genes`, countOff === 0 && scored.length === table.size, `${countOff} differ`);
ck("every score equal to maftools' clusterScores", worstScore < 1e-12, `largest difference ${worstScore.toExponential(1)}`);

const z = scored.map((s) => zOf(s.res.score));
const p = z.map(upperTail);
const fdr = benjaminiHochberg(p);
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
ck("every z equal to maftools'", Math.max(...scored.map((s, i) => Math.abs(z[i] - +s.row.zscore))) < 1e-9);
ck("every p within the erfc's accuracy of maftools' 1 − pnorm(z)", Math.max(...scored.map((s, i) => rel(p[i], +s.row.pval))) < 1e-6,
  `largest relative difference ${Math.max(...scored.map((s, i) => rel(p[i], +s.row.pval))).toExponential(1)}`);
ck("every FDR the same, Benjamini-Hochberg over the table's rows", Math.max(...scored.map((s, i) => rel(fdr[i], +s.row.fdr))) < 1e-6,
  `largest relative difference ${Math.max(...scored.map((s, i) => rel(fdr[i], +s.row.fdr))).toExponential(1)}`);
scored.forEach((s, i) => { s.z = z[i]; s.p = p[i]; s.fdr = fdr[i]; s.called = fdr[i] <= 0.05; });

// The tie quirk: R recycles tied peaks along the residues. Against distance to the nearest peak:
for (const s of scored) {
  for (const c of s.res.clusters) {
    if (c.peaks.length < 2) continue;
    const nearest = c.parts.reduce((t, q) => t + q.fraction / Math.SQRT2 ** Math.min(...c.peaks.map((pk) => Math.abs(q.pos - pk))), 0);
    console.log(`  tie: ${s.gene} cluster ${c.start}–${c.end}, peaks ${c.peaks.join("/")}: maftools ${f4(c.score)}, nearest peak ${f4(nearest)}; the gene ${s.called ? "called" : "not called"} either way (score ${f4(s.res.score)})`);
  }
}

/* ---------------------------------------------------------------- §2 what decides the score */
console.log("\n§2 what decides the score, on the lesson's genes");
const called = scored.filter((s) => s.called).sort((a, b) => a.fdr - b.fdr);
console.log(`  called: ${called.map((s) => `${s.gene} (${s.total} mutations, score ${f3(s.res.score)})`).join(", ")}`);
// the lowest score that would be called if it joined the table as the 800th gene
let lo = 0, hi = 1;
for (let k = 0; k < 50; k += 1) {
  const mid = (lo + hi) / 2;
  const pp = [...p, upperTail(zOf(mid))];
  (benjaminiHochberg(pp).at(-1) <= 0.05 ? (hi = mid) : (lo = mid));
}
console.log(`  a gene joining the table is called from score ${f3(hi)} (z ${zOf(hi).toFixed(2)}); the fixed background makes that line the same for every cohort of this size`);
const maxP = upperTail(zOf(1));
console.log(`  a score cannot pass 1: every mutation at one residue gives z ${f3(zOf(1))}, p ${maxP.toExponential(2)}, whatever the count — ${scored.filter((s) => s.res.score === 1).length} genes tie at the top`);
const byTh = new Map();
for (const g of genes.values()) byTh.set(g.th, (byTh.get(g.th) || 0) + 1);
console.log(`  thresholds over all ${genes.size} genes: ${[...byTh].sort((a, b) => a[0] - b[0]).map(([t, n]) => `th ${t}: ${n}`).join(", ")}`);
for (const [n, L] of [[5, 400], [9, 741], [30, 1000], [100, 1000], [369, 1068], [348, 393], [127, 444], [1000, 393]]) {
  console.log(`    ${n} mutations on ${L} residues: th ${threshold(n, L)}`);
}
const tested = [...genes.values()];
const withCluster = tested.filter((g) => table.has(g.gene)).length;
const nBins = [[5, 9], [10, 19], [20, 49], [50, 1e9]];
for (const [a, b] of nBins) {
  const bin = tested.filter((g) => g.total >= a && g.total <= b);
  const inT = bin.filter((g) => table.has(g.gene));
  console.log(`  genes with ${a}–${b < 1e9 ? b : "∞"} mutations: ${bin.length}, of which ${inT.length} (${Math.round(100 * inT.length / bin.length)}%) return a cluster and are tested; median length ${bin.map((g) => g.protLen).sort((x, y) => x - y)[bin.length >> 1]}`);
}
console.log(`  overall ${withCluster} of ${tested.length} tested`);

/* ---------------------------------------------------------------- §3 the lesson's file, counted once */
console.log("\n§3 the lesson's file three ways: as listed, each mutation once per tumour, and each two-base change once");
const mafDir = process.argv[3];
if (!mafDir) { console.log("  (no MAF export dir given; §3–§6 skipped)"); console.log(`\n${checks} checks, ${failed} failed`); process.exit(failed ? 1 : 0); }
const readAt = (d, file) => { const L = readFileSync(join(d, file), "utf8").split("\n").filter(Boolean); const h = L[0].replace(/\r$/, "").split("\t"); return L.slice(1).map((l) => { const x = l.replace(/\r$/, "").split("\t"); return Object.fromEntries(h.map((k, i) => [k, x[i]])); }); };
const maf = readAt(mafDir, "maf_cols.tsv");
const FLAGS_20 = new Set(["TTN", "MUC16", "OBSCN", "AHNAK2", "SYNE1", "FLG", "MUC5B", "DNAH17", "PLEC", "DST",
  "SYNE2", "NEB", "HSPG2", "LAMA5", "AHNAK", "HMCN1", "USH2A", "DNAH11", "MACF1", "MUC17"]);
const NONSYN = new Set(["Frame_Shift_Del", "Frame_Shift_Ins", "Splice_Site", "Translation_Start_Site",
  "Nonsense_Mutation", "Nonstop_Mutation", "In_Frame_Del", "In_Frame_Ins", "Missense_Mutation"]);
const TRUNC = new Set(["Frame_Shift_Del", "Frame_Shift_Ins", "Nonsense_Mutation", "Splice_Site"]);
const tsbOf = (r) => r.Tumor_Sample_Barcode.slice(0, 12);
function posOf(r) {                                  // parse_prot's own chain
  if (r.Variant_Classification === "Splice_Site") return NaN;
  const parts = (r.HGVSp_Short || "").split(".");
  let p = parts[parts.length - 1] ?? "";
  p = p.replace(/Ter.*/, "").replace(/[A-Za-z]/g, "").replace(/\*$/, "").replace(/^\*/, "").replace(/\*.*/, "");
  const head = p.split("_")[0];
  return head === "" ? NaN : Number(head);
}
// as R's §10: unique by (tumour, chromosome, position, allele), first row kept
const seenKey = new Set();
const once = [];
for (const r of maf) { const k = `${tsbOf(r)}|${r.Chromosome}|${r.Start_Position}|${r.Tumor_Seq_Allele2}`; if (!seenKey.has(k)) { seenKey.add(k); once.push(r); } }
// then the second row of each adjacent-base SNV pair in one tumour and one gene
const sorted = once.map((r, i) => ({ r, i })).sort((a, b) => (tsbOf(a.r) < tsbOf(b.r) ? -1 : tsbOf(a.r) > tsbOf(b.r) ? 1 : 0)
  || (a.r.Chromosome < b.r.Chromosome ? -1 : a.r.Chromosome > b.r.Chromosome ? 1 : 0) || (+a.r.Start_Position - +b.r.Start_Position) || (a.i - b.i));
const second = new Set();
for (let k = 1; k < sorted.length; k += 1) {
  const a = sorted[k - 1].r, b = sorted[k].r;
  if (tsbOf(a) === tsbOf(b) && a.Chromosome === b.Chromosome && a.Variant_Type === "SNP" && b.Variant_Type === "SNP"
    && +b.Start_Position - +a.Start_Position === 1 && a.Hugo_Symbol === b.Hugo_Symbol) second.add(sorted[k].i);
}
const merged = once.filter((_, i) => !second.has(i));
function lessonTable(rows) {
  const by = new Map();
  for (const r of rows) {
    if (FLAGS_20.has(r.Hugo_Symbol) || !NONSYN.has(r.Variant_Classification)) continue;
    if (!by.has(r.Hugo_Symbol)) by.set(r.Hugo_Symbol, []);
    by.get(r.Hugo_Symbol).push(r);
  }
  const out = [];
  for (const [gene, list] of by) {
    const L = genes.get(gene)?.protLen;
    if (!L || list.length < 5) continue;
    const placedRows = list.filter((r) => Number.isFinite(posOf(r)));
    const res = clusterGene(residuesAt(placedRows), threshold(list.length, L), placedRows.length);
    out.push({ gene, L, total: list.length, tested: !!res, res, list });
  }
  return out;
}
function residuesAt(rows) { const at = new Map(); for (const r of rows) { const p = posOf(r); at.set(p, (at.get(p) || 0) + 1); } return [...at].map(([pos, N]) => ({ pos, N })); }
const views = { "as listed": lessonTable(maf), "once per tumour": lessonTable(once), "and two-base changes once": lessonTable(merged) };
const bins = [[5, 9], [10, 19], [20, 49], [50, Infinity]];
const binOf = (n) => bins.findIndex(([a, b]) => n >= a && n <= b);
const lessonShares = {};
for (const [name, t] of Object.entries(views)) {
  const per = bins.map(([a, b]) => { const inBin = t.filter((g) => g.total >= a && g.total <= b); return { n: inBin.length, tested: inBin.filter((g) => g.tested).length }; });
  lessonShares[name] = { genes: t.length, tested: t.filter((g) => g.tested).length, per };
  console.log(`  ${name.padEnd(26)} ${t.length} genes with at least 5 mutations, ${t.filter((g) => g.tested).length} tested; by count ${per.map((p, k) => `${bins[k][0]}–${bins[k][1] === Infinity ? "∞" : bins[k][1]}: ${p.tested}/${p.n} (${(100 * p.tested / p.n).toFixed(1)}%)`).join(", ")}`);
}
ck("as listed, the JS table tests the 799 genes R does", lessonShares["as listed"].tested === 799 && lessonShares["as listed"].genes === genes.size);
ck("once per tumour, it tests R's 478", lessonShares["once per tumour"].tested === 478, `${lessonShares["once per tumour"].tested}`);
ck("with two-base changes once, R's 415", lessonShares["and two-base changes once"].tested === 415, `${lessonShares["and two-base changes once"].tested}`);

// the drivers' shapes, counted once (what SHAPES is built from)
const clean = new Map(views["and two-base changes once"].map((g) => [g.gene, g]));
for (const name of ["PIK3CA", "AKT1", "KRAS", "TP53", "CDH1", "GATA3", "MAP3K1", "PTEN", "NF1"]) {
  const g = clean.get(name);
  if (!g) { console.log(`  ${name}: fewer than 5 once counted`); continue; }
  const placedRows = g.list.filter((r) => Number.isFinite(posOf(r)));
  const at = residuesAt(placedRows).sort((a, b) => b.N - a.N);
  const trunc = g.list.filter((r) => TRUNC.has(r.Variant_Classification)).length;
  console.log(`  ${name.padEnd(7)} L ${g.L}, ${g.total} mutations (${placedRows.length} placed), truncating or splice ${(100 * trunc / g.total).toFixed(0)}%, top ${at.slice(0, 10).map((x) => `${x.pos}:${x.N}`).join(" ")}; score ${g.res ? g.res.score.toFixed(3) : "untested"}`);
}

/* ---------------------------------------------------------------- §4 calibration */
console.log("\n§4 the passenger genome, calibrated to the file counted once");
const { gunzipSync } = await import("node:zlib");
const protLenPath = process.argv[4];
let lengths = null;
if (protLenPath) {
  const txt = gunzipSync(readFileSync(protLenPath)).toString("utf8").split("\n").filter(Boolean).slice(1);
  lengths = txt.map((l) => +l.split("\t")[3]).filter((x) => x > 0);
  const logs = lengths.map(Math.log), mu = logs.reduce((a, b) => a + b, 0) / logs.length;
  const sd = Math.sqrt(logs.reduce((a, b) => a + (b - mu) ** 2, 0) / (logs.length - 1));
  console.log(`  prot_len.txt.gz: ${lengths.length} genes, log-length mean ${mu.toFixed(3)} (median ${Math.exp(mu).toFixed(0)}), sd ${sd.toFixed(3)}`);
}
const target = views["and two-base changes once"];
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)]; };
const tTotals = target.map((g) => g.total);
console.log(`  target: ${target.length} genes with at least 5; count quantiles 50/75/90/99 ${[0.5, 0.75, 0.9, 0.99].map((p) => q(tTotals, p)).join(" ")}; tested ${lessonShares["and two-base changes once"].tested}`);
console.log(`  model: ${JSON.stringify(M.GENOME)}`);
function genomeStats(genome, seeds, dup = 0) {
  let n5 = 0, testedAll = 0; const totals = []; const per = bins.map(() => ({ n: 0, tested: 0 }));
  for (const seed of seeds) {
    const base = M.drawGenome(M.mulberry32(seed), { genome });
    const gs = dup > 0 ? M.withRepeats(base, dup, seed) : base;
    M.oncodriveTable(gs);
    for (const g of gs) {
      if (g.n < 5) continue;
      n5 += 1; totals.push(g.n);
      const k = binOf(g.n); per[k].n += 1; if (g.tested) { per[k].tested += 1; testedAll += 1; }
    }
  }
  const s = seeds.length;
  return { genes: n5 / s, tested: testedAll / s, q: [0.5, 0.75, 0.9, 0.99].map((p) => q(totals, p)), per: per.map((p) => ({ n: p.n / s, tested: p.tested / s })) };
}
const show = (label, st) => console.log(`  ${label}: ${st.genes.toFixed(0)} genes at 5+, tested ${st.tested.toFixed(0)}; quantiles ${st.q.join(" ")}; by count ${st.per.map((p, k) => `${(100 * p.tested / Math.max(1, p.n)).toFixed(1)}% of ${p.n.toFixed(0)}`).join(", ")}`);
const tLenByBin = bins.slice(0, 3).map(([a, b]) => q(target.filter((g) => g.total >= a && g.total <= b).map((g) => g.L), 0.5));
const tShare = lessonShares["and two-base changes once"].per.slice(0, 3).map((p) => p.tested / p.n);
console.log(`  target median length by count 5–9, 10–19, 20–49: ${tLenByBin.join(", ")}; tested share ${tShare.map((s) => (100 * s).toFixed(1) + "%").join(", ")}`);
if (process.env.CALIBRATE) {
  // counts and lengths first: rate median and sd against the number at 5+, the count quantiles and the length by count
  const tq = [0.5, 0.75, 0.9, 0.99].map((p) => q(tTotals, p));
  const results = [];
  for (const rateMedian of [0.002, 0.0025, 0.003, 0.0035, 0.004, 0.005, 0.006]) for (const rateSd of [0.3, 0.5, 0.7, 0.9, 1.1]) {
    const genome = { ...M.GENOME, rateMedian, rateSd };
    let n5 = 0; const totals = [], lens = [];
    const rng = M.mulberry32(7);
    for (let g = 0; g < genome.genes; g += 1) {
      const L = Math.max(30, Math.min(9000, Math.round(genome.lengthMedian * Math.exp(genome.lengthSd * M.normal(rng)))));
      const n = M.poisson(rng, genome.rateMedian * Math.exp(genome.rateSd * M.normal(rng)) * L);
      if (n >= 5) { n5 += 1; totals.push(n); lens.push([n, L]); }
    }
    const qq = [0.5, 0.75, 0.9, 0.99].map((p) => q(totals, p));
    const lb = bins.slice(0, 3).map(([a, b]) => q(lens.filter(([n]) => n >= a && n <= b).map(([, L]) => L), 0.5));
    const err = ((n5 - target.length) / target.length) ** 2 + qq.reduce((s, v, k) => s + ((v - tq[k]) / tq[k]) ** 2, 0)
      + lb.reduce((s, v, k) => s + ((v - tLenByBin[k]) / tLenByBin[k]) ** 2, 0);
    results.push({ rateMedian, rateSd, n5, qq, lb, err });
  }
  results.sort((a, b) => a.err - b.err);
  for (const r of results.slice(0, 4)) console.log(`    rate median ${r.rateMedian}, sd ${r.rateSd}: ${r.n5} at 5+, quantiles ${r.qq.join(" ")}, length by count ${r.lb.join(", ")}, error ${r.err.toFixed(3)}`);
  const fits = [];
  for (const cand of results.slice(0, 3)) for (const mutabilitySd of [0.6, 0.8, 1.0, 1.2]) {
    const genome = { ...M.GENOME, rateMedian: cand.rateMedian, rateSd: cand.rateSd, mutabilitySd };
    const st = genomeStats(genome, [11, 12]);
    const share = st.per.slice(0, 3).map((p) => p.tested / Math.max(1, p.n));
    const err = share.reduce((s, v, k) => s + ((v - tShare[k]) / tShare[k]) ** 2, 0) + ((st.tested - 415) / 415) ** 2;
    fits.push({ rateMedian: cand.rateMedian, rateSd: cand.rateSd, mutabilitySd, st, err });
  }
  fits.sort((a, b) => a.err - b.err);
  for (const f of fits.slice(0, 4)) show(`    rate ${f.rateMedian}/${f.rateSd}, mutability ${f.mutabilitySd} (error ${f.err.toFixed(3)})`, f.st);
  const best = fits[0];
  for (const dup of [0.005, 0.01, 0.015, 0.02]) {
    const st = genomeStats({ ...M.GENOME, rateMedian: best.rateMedian, rateSd: best.rateSd, mutabilitySd: best.mutabilitySd }, [11, 12], dup);
    show(`    with repeats ${dup}: target 4655 genes and 799 tested`, st);
  }
}
const cleanStats = genomeStats(M.GENOME, [21, 22, 23]);
show("  GENOME as set, each mutation once", cleanStats);
const dupStats = genomeStats(M.GENOME, [21, 22, 23], M.REPEAT_RATE);
show(`  GENOME as set, repeats at ${M.REPEAT_RATE}`, dupStats);
ck("counted once, the genome tests within 12% of the file's 415", Math.abs(cleanStats.tested - 415) / 415 < 0.12, `${cleanStats.tested.toFixed(0)}`);
ck("with repeats, within 12% of the file's 799 as listed", Math.abs(dupStats.tested - 799) / 799 < 0.12, `${dupStats.tested.toFixed(0)}`);
ck("genes at 5+ within 10% of the file's, both ways", Math.abs(cleanStats.genes - 4566) / 4566 < 0.1 && Math.abs(dupStats.genes - 4655) / 4655 < 0.1,
  `${cleanStats.genes.toFixed(0)} and ${dupStats.genes.toFixed(0)}`);

/* ---------------------------------------------------------------- §5 the shapes */
console.log("\n§5 each driver shape over 200 seeds, against its gene counted once");
const pct = (a, p) => q(a, p);
for (const [name, shape] of Object.entries(M.SHAPES)) {
  const scores = []; let untested = 0;
  for (let s = 1; s <= 200; s += 1) {
    const g = M.drawShaped(shape, M.mulberry32(1000 + s), { name });
    const r = M.scoreGene(g);
    if (r.res) scores.push(r.res.score); else untested += 1;
  }
  const lesson = M.LESSON_SCORES[name];
  const med = scores.length ? pct(scores, 0.5) : NaN;
  console.log(`  ${name.padEnd(7)} ${shape.kind.padEnd(10)} n ${String(shape.n).padStart(3)} on ${shape.L}: score median ${Number.isFinite(med) ? med.toFixed(3) : "—"}, 5–95% ${scores.length ? pct(scores, 0.05).toFixed(3) + "–" + pct(scores, 0.95).toFixed(3) : "—"}, untested ${untested}/200; the file's gene ${lesson == null ? "untested" : lesson.toFixed(3)}`);
  if (lesson != null) ck(`${name}'s simulated median is within 0.1 of its gene`, Math.abs(med - lesson) < 0.1, `${med.toFixed(3)} against ${lesson}`);
}
console.log("\n  the count, with each shape's hotspot shares kept:");
for (const [name, ns] of [["PIK3CA", [10, 25, 100, 359]], ["TP53", [10, 25, 100, 313]], ["AKT1", [6, 12, 26, 100]]]) {
  const row = ns.map((n) => {
    const sc = []; let un = 0;
    for (let s = 1; s <= 100; s += 1) { const r = M.scoreGene(M.drawShaped(M.SHAPES[name], M.mulberry32(5000 + s), { n })); if (r.res) sc.push(r.res.score); else un += 1; }
    return `n ${n}: ${sc.length ? pct(sc, 0.5).toFixed(3) : "—"}${un ? ` (${un}% untested)` : ""}`;
  });
  console.log(`    ${name.padEnd(7)} ${row.join("; ")}`);
}
for (const [L, ns] of [[749, [5, 7, 9]], [1391, [10, 14, 19]], [2804, [20, 30, 45]]]) {
  const row = ns.map((n) => {
    let tested = 0; const sc = [];
    for (let s = 1; s <= 400; s += 1) { const r = M.scoreGene(M.drawPassenger(M.mulberry32(9000 + s), { L, n })); if (r.res) { tested += 1; sc.push(r.res.score); } }
    return `n ${n}: tested ${(100 * tested / 400).toFixed(0)}%, score median ${sc.length ? pct(sc, 0.5).toFixed(2) : "—"}`;
  });
  console.log(`    passenger on ${L}: ${row.join("; ")}`);
}

/* ---------------------------------------------------------------- §6 the cohort */
console.log("\n§6 the cohort page: ten cohorts each way, with the count test beside");
const summary = {};
for (const [label, dup] of [["each mutation once", 0], ["repeats as the MAF lists them", M.REPEAT_RATE]]) {
  const agg = { tested: 0, called: { oncogene: 0, suppressor: 0, passenger: 0 }, cCalled: { oncogene: 0, suppressor: 0, passenger: 0 }, drivers: {}, cDrivers: {}, lines: [], smallest: [] };
  for (let seed = 1; seed <= 10; seed += 1) {
    const genes = M.drawCohort(seed, { repeats: dup });
    const table = M.oncodriveTable(genes);
    agg.tested += table.length;
    for (const r of table) if (r.called) { agg.called[r.kind] += 1; if (r.kind !== "passenger") agg.drivers[r.name] = (agg.drivers[r.name] || 0) + 1; else agg.smallest.push(`${r.n}:${r.score.toFixed(2)}${r.mutations.some((m) => m.repeat) ? "r" : ""}`); }
    const notCalled = table.filter((r) => !r.called).map((r) => r.score);
    const called = table.filter((r) => r.called).map((r) => r.score);
    agg.lines.push(`${Math.min(...called).toFixed(2)}/${Math.max(...notCalled).toFixed(2)}`);
    const rate = genes.totalMutations / genes.totalResidues;
    const ct = M.countTest(genes, { rate });
    for (const g of ct) if (g.countCalled) { agg.cCalled[g.kind] += 1; if (g.kind !== "passenger") agg.cDrivers[g.name] = (agg.cDrivers[g.name] || 0) + 1; }
  }
  summary[label] = agg;
  console.log(`  ${label}: tested ${(agg.tested / 10).toFixed(0)} a cohort; oncodrive calls per cohort — oncogenes ${(agg.called.oncogene / 10).toFixed(1)} of 3, suppressors ${(agg.called.suppressor / 10).toFixed(1)} of 6, passengers ${(agg.called.passenger / 10).toFixed(1)}`);
  console.log(`    drivers called in 10 cohorts: ${Object.entries(agg.drivers).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}; passengers called (count:score, r = carries a repeat): ${agg.smallest.join(" ") || "none"}`);
  console.log(`    lowest score called / highest not called, per cohort: ${agg.lines.join(" ")}`);
  console.log(`    count test calls per cohort — oncogenes ${(agg.cCalled.oncogene / 10).toFixed(1)}, suppressors ${(agg.cCalled.suppressor / 10).toFixed(1)}, passengers ${(agg.cCalled.passenger / 10).toFixed(1)}; drivers: ${Object.entries(agg.cDrivers).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
// the same count test on the file itself, counted once: every gene with a length, at the file's own rate per residue
if (lengths) {
  const cleanNonsyn = merged.filter((r) => !FLAGS_20.has(r.Hugo_Symbol) && NONSYN.has(r.Variant_Classification));
  const protLens = new Map(gunzipSync(readFileSync(protLenPath)).toString("utf8").split("\n").filter(Boolean).slice(1).map((l) => { const x = l.split("\t"); return [x[0], +x[3]]; }));
  const withLen = cleanNonsyn.filter((r) => protLens.has(r.Hugo_Symbol));
  const residues = [...protLens.values()].reduce((a, b) => a + b, 0);
  const rate = withLen.length / residues;
  const rows = target.map((g) => ({ gene: g.gene, n: g.total, L: g.L, p: M.poissonUpper(g.total, rate * g.L) }));
  const f = M.benjaminiHochberg(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.fdr = f[i]; });
  const calledRows = rows.filter((r) => r.fdr <= 0.05).sort((a, b) => a.fdr - b.fdr);
  console.log(`\n  the count test on the file, counted once: rate ${rate.toExponential(3)} a residue over ${residues} residues; ${calledRows.length} of ${rows.length} genes at fdr <= 0.05`);
  console.log(`    among them: ${["TP53", "CDH1", "GATA3", "MAP3K1", "PTEN", "NF1", "PIK3CA", "AKT1", "KRAS", "NDUFS1", "RPL22"].map((g) => `${g} ${calledRows.some((r) => r.gene === g) ? "called" : "not"}`).join(", ")}`);
  console.log(`    the longest called: ${calledRows.sort((a, b) => b.L - a.L).slice(0, 8).map((r) => `${r.gene} (${r.n} on ${r.L})`).join(", ")}`);
}
{
  const s = summary["each mutation once"];
  const other = Object.keys(s.drivers).filter((k) => M.SHAPES[k].kind === "suppressor" && k !== "GATA3");
  ck("counted once, no suppressor but GATA3 is called in ten cohorts, and GATA3 in at most two", other.length === 0 && (s.drivers.GATA3 || 0) <= 2,
    `GATA3 ${s.drivers.GATA3 || 0}; its shape scores 0.61, with its frameshifts clustered at the C-terminal`);
}
ck("counted once, PIK3CA and AKT1 are called in every cohort", summary["each mutation once"].drivers.PIK3CA === 10 && summary["each mutation once"].drivers.AKT1 === 10);

console.log(`\n${checks} checks, ${failed} failed`);
