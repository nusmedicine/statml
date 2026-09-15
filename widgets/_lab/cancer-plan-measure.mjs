/* Planning measurements for the cancer mutation arc (PHM5003 07, slots 67–71
 * in docs/catalogue.md § *The cancer mutation arc*), on the lesson's own
 * TCGA-BRCA data frames, exported first with base R:
 *
 *   Rscript widgets/_lab/cancer-plan-export.R "<07 - Cancer Mutation Analysis>" <dir>
 *   node widgets/_lab/cancer-plan-measure.mjs <dir>
 *
 * Every number the arc's plan quotes is printed here. Each slot's own measure
 * script comes after Kenneth's picks; this one decides what the slots are.
 *
 *   §1 VAF (01-2). Median depth 88 at a non-synonymous mutation; 965 of 967
 *      tumours have a median VAF below 0.5 (median of medians 0.243), so the
 *      purity-1 reading of plotVaf calls nearly every tumour subclonal. MATH is
 *      100 × 1.4826 × MAD / median: all ten of cell 23's titles reproduce to
 *      the digit. A tumour with ONE clone reads MATH ≈ 15 at depth 88 and ≈ 25
 *      at depth 31 from binomial sampling alone.
 *   §2 oncodrive (01-3). Cell 15 fell back to predefined background values:
 *      all seven printed z-scores are (score − 0.279) / 0.13, their p the
 *      normal upper tail, the FDR Benjamini-Hochberg over 799 genes. TP53,
 *      CDH1, GATA3 and MAP3K1 — four of the six most mutated genes — are
 *      absent from cell 16's table; their mutations spread along the protein.
 *   §3 signatures (01-4). Cell 14's tumour reproduces in all 96 channels.
 *      Signature_1, the POLE match, is one tumour: TCGA-AN-A046's own
 *      profile, 59–61% of the signature's mutations, gone when that tumour is
 *      removed. The APOBEC signature survives removal.
 *   §4 clonal architecture (01-2 cell 25's RETCHER figure). The sum rule
 *      admits only the linear tree at three of the four samples.
 *   §5 somatic interactions (01-3 cells 9–11). The ten printed 2 × 2 tables
 *      reproduce; TP53–CDH1's odds ratio 0.153 is 0.407 within histology.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("usage: node cancer-plan-measure.mjs <dir holding maf_cols.tsv and clin_cols.tsv>"); process.exit(1); }
function readTsv(file) {
  const L = readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean);
  const h = L[0].replace(/\r$/, "").split("\t");
  return L.slice(1).map((l) => { const x = l.replace(/\r$/, "").split("\t"); return Object.fromEntries(h.map((k, i) => [k, x[i]])); });
}
// `read.maf(rmFlags = 20)` in 01-2 cell 9, 01-3 cell 2 and 01-4 cell 2 drops
// the first twenty of maftools' FLAGS genes. This list is inferred, not read
// from maftools: with it removed, cell 14's tumour reproduces in all 96
// channels (1,302 SNVs) where keeping it adds 13.
const FLAGS_20 = new Set(["TTN", "MUC16", "OBSCN", "AHNAK2", "SYNE1", "FLG", "MUC5B", "DNAH17", "PLEC", "DST",
  "SYNE2", "NEB", "HSPG2", "LAMA5", "AHNAK", "HMCN1", "USH2A", "DNAH11", "MACF1", "MUC17"]);
const everyRow = readTsv("maf_cols.tsv");
const rows = everyRow.filter((r) => !FLAGS_20.has(r.Hugo_Symbol));
const clin = readTsv("clin_cols.tsv");
console.log(`${everyRow.length - rows.length} mutations in the 20 FLAG genes left out, as rmFlags = 20 does`);

const NONSYN = new Set(["Frame_Shift_Del", "Frame_Shift_Ins", "Splice_Site", "Translation_Start_Site",
  "Nonsense_Mutation", "Nonstop_Mutation", "In_Frame_Del", "In_Frame_Ins", "Missense_Mutation"]);
const tsb = (r) => r.Tumor_Sample_Barcode.slice(0, 12);
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
const f3 = (x) => x.toFixed(3);
const nonsyn = rows.filter((r) => NONSYN.has(r.Variant_Classification));
const tumours = [...new Set(rows.map(tsb))];
console.log(`${rows.length} mutations in ${tumours.length} tumours; ${nonsyn.length} non-synonymous`);

// ------------------------------------------------------------------ §1 VAF
console.log("\n§1 VAF (01-2 cells 17–25)");
const vafs = new Map();
for (const r of nonsyn) {
  const alt = +r.t_alt_count, ref = +r.t_ref_count;
  if (!(alt + ref > 0)) continue;
  const k = tsb(r);
  if (!vafs.has(k)) vafs.set(k, []);
  vafs.get(k).push(alt / (alt + ref));
}
const depth = nonsyn.map((r) => +r.t_ref_count + +r.t_alt_count).filter((d) => d > 0);
console.log(`  depth (ref + alt): median ${median(depth)}, IQR ${quantile(depth, 0.25)}–${quantile(depth, 0.75)}, 10th percentile ${quantile(depth, 0.1)}`);
const medians = [...vafs.values()].map(median);
console.log(`  per-tumour median VAF, ${medians.length} tumours: median ${f3(median(medians))}, IQR ${f3(quantile(medians, 0.25))}–${f3(quantile(medians, 0.75))}; below 0.5: ${medians.filter((m) => m < 0.5).length}; below 0.4: ${medians.filter((m) => m < 0.4).length}`);
const MATH = (v) => { const m = median(v); return (100 * 1.4826 * median(v.map((x) => Math.abs(x - m)))) / m; };
const printedMATH = { "TCGA-AN-A046": 47.316, "TCGA-AC-A23H": 37.065, "TCGA-BH-A18G": 20.725, "TCGA-AN-A0AK": 49.257,
  "TCGA-A8-A09Z": 17.905, "TCGA-5L-AAT1": 28.376, "TCGA-D8-A1XK": 50.793, "TCGA-BH-A0HF": 68.931,
  "TCGA-D8-A1XQ": 44.037, "TCGA-AO-A128": 34.724 };
let worst = 0;
for (const [k, p] of Object.entries(printedMATH)) {
  const m = MATH(vafs.get(k));
  worst = Math.max(worst, Math.abs(m - p));
  console.log(`  MATH ${k}: cell 23 prints ${p}, 100·1.4826·MAD/median = ${f3(m)}  (median VAF ${f3(median(vafs.get(k)))})`);
}
console.log(`  largest MATH difference ${worst.toFixed(2)}`);
// one clone, heterozygous, diploid: VAF = purity / 2; MATH ≈ 100·sd/mean under the normal approximation
for (const [purity, d] of [[0.7, 88], [0.7, 31], [0.35, 88]]) {
  const mu = purity / 2, sd = Math.sqrt((mu * (1 - mu)) / d);
  console.log(`  one clone, purity ${purity}, depth ${d}: VAF ${mu.toFixed(3)}, binomial sd ${sd.toFixed(3)}, MATH ≈ ${(100 * sd / mu).toFixed(1)}`);
}
const bins = new Array(12).fill(0);
for (const v of vafs.get("TCGA-AN-A046")) bins[Math.min(11, Math.floor(v * 20))]++;
console.log(`  TCGA-AN-A046 VAF counts in 0.05 bins from 0: ${bins.join(" ")}`);

// ------------------------------------------------------------------ §2 oncodrive
console.log("\n§2 oncodrive (01-3 cells 12–25)");
function erfc(x) { // Numerical Recipes erfcc
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const cell16 = [ // gene, clusterScores, zscore, pval, fdr — in ascending p, which is rank order
  ["NDUFS1", 1.0, 5.546154, 1.460110e-08, 5.833137e-06],
  ["RPL22", 1.0, 5.546154, 1.460110e-08, 5.833137e-06],
  ["AKT1", 0.9259259, 4.976353, 3.239667e-07, 8.628314e-05],
  ["KRAS", 0.8333333, 4.264103, 1.003536e-05, 2.004564e-03],
  ["PIK3CA", 0.8043175, 4.040904, 2.662280e-05, 3.499331e-03],
  ["DPEP1", 0.8, 4.007692, 3.065747e-05, 3.499331e-03],
  ["FAM102A", 0.8, 4.007692, 3.065747e-05, 3.499331e-03],
];
// Benjamini-Hochberg step-up over GENES_TESTED genes: min over j ≥ i of p_j · m / j.
// The seven rows are ranks 1–7 of the whole table, so their adjusted values
// depend only on each other and on m — and m = 799 reproduces all seven.
const GENES_TESTED = 799;
const stepUp = cell16.map((_, i) => Math.min(...cell16.slice(i).map((row, k) => (row[3] * GENES_TESTED) / (i + k + 1))));
cell16.forEach(([g, s, z, p, fdr], i) => {
  const zz = (s - 0.279) / 0.13;
  console.log(`  ${g.padEnd(8)} score ${s}: printed z ${z}, (score − 0.279)/0.13 = ${zz.toFixed(6)}; printed p ${p.toExponential(4)}, upper tail ${(0.5 * erfc(zz / Math.SQRT2)).toExponential(4)}; printed fdr ${fdr.toExponential(4)}, BH over ${GENES_TESTED} ${stepUp[i].toExponential(4)}`);
});
function geneShape(g) {
  const pos = new Map(), cls = {};
  let placed = 0;
  for (const r of nonsyn) {
    if (r.Hugo_Symbol !== g) continue;
    cls[r.Variant_Classification] = (cls[r.Variant_Classification] || 0) + 1;
    if (r.Variant_Classification === "Splice_Site") continue;
    const p = parseInt((r.Protein_position || "").split("/")[0], 10);
    if (!Number.isFinite(p)) continue;
    placed++;
    pos.set(p, (pos.get(p) || 0) + 1);
  }
  const total = Object.values(cls).reduce((a, b) => a + b, 0);
  const trunc = ["Nonsense_Mutation", "Frame_Shift_Del", "Frame_Shift_Ins", "Splice_Site"].reduce((a, c) => a + (cls[c] || 0), 0);
  const top = [...pos].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return { total, trunc, placed, distinct: pos.size, top };
}
for (const g of ["PIK3CA", "TP53", "CDH1", "GATA3", "MAP3K1", "KMT2C", "AKT1", "KRAS"]) {
  const s = geneShape(g);
  const top3 = s.top.slice(0, 3).reduce((a, [, c]) => a + c, 0);
  console.log(`  ${g.padEnd(7)} ${s.total} mutations; truncating or splice ${s.trunc} (${Math.round(100 * s.trunc / s.total)}%); ${s.placed} placed on ${s.distinct} residues; top ${s.top.map(([p, c]) => `${p}:${c}`).join(" ")} (top three ${Math.round(100 * top3 / s.total)}%)`);
}

// ------------------------------------------------------------------ §3 signatures
console.log("\n§3 mutational signatures (01-4)");
const comp = { A: "T", C: "G", G: "C", T: "A" };
const revcomp = (s) => [...s].reverse().map((b) => comp[b]).join("");
const CH = [];
for (const sub of ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"]) for (const l of "ACGT") for (const r of "ACGT") CH.push(`${l}[${sub}]${r}`);
const CHI = Object.fromEntries(CH.map((c, i) => [c, i]));
const cat = new Map();
let off = 0;
for (const r of rows) {
  if (r.Variant_Type !== "SNP" || !r.CONTEXT || r.CONTEXT.length !== 11) continue;
  let ref = r.Reference_Allele, alt = r.Tumor_Seq_Allele2, tri = r.CONTEXT.slice(4, 7);
  if (!comp[ref] || !comp[alt]) continue;
  if (tri[1] !== ref) { off++; continue; }
  if (ref === "G" || ref === "A") { tri = revcomp(tri); ref = comp[ref]; alt = comp[alt]; }
  const k = tsb(r);
  if (!cat.has(k)) cat.set(k, new Float64Array(96));
  cat.get(k)[CHI[`${tri[0]}[${ref}>${alt}]${tri[2]}`]]++;
}
const sum = (v) => v.reduce((a, b) => a + b, 0);
const names = [...cat.keys()];
const totalSNV = sum(names.map((k) => sum(cat.get(k))));
console.log(`  ${totalSNV} SNVs from ${names.length} tumours into 96 channels (context mismatches ${off}); SNVs per tumour median ${median(names.map((k) => sum(cat.get(k))))}`);
// cell 14's single tumour, as printed (A[C>A]A … T[T>G]T)
const CELL14 = [0, 5, 1, 4, 4, 21, 10, 53, 1, 2, 1, 7, 0, 3, 1, 15, 0, 2, 0, 1, 1, 0, 2, 2, 2, 8, 0, 1, 0, 0, 0, 3,
  23, 20, 88, 15, 12, 15, 66, 15, 54, 86, 146, 64, 8, 11, 37, 3, 0, 8, 0, 8, 3, 8, 3, 1, 1, 6, 0, 3, 1, 1, 1, 0,
  21, 20, 41, 8, 18, 14, 53, 19, 59, 26, 43, 38, 14, 18, 20, 9, 0, 1, 1, 2, 0, 3, 8, 4, 0, 0, 2, 1, 0, 2, 0, 0];
const a18g = cat.get("TCGA-BH-A18G");
const off14 = CELL14.filter((v, i) => v !== a18g[i]).length;
console.log(`  cell 14's TCGA-BH-A18G: ${sum(a18g)} SNVs against ${sum(CELL14)} printed; channels that differ: ${off14}`);
const byLoad = names.map((k) => [k, sum(cat.get(k))]).sort((a, b) => b[1] - a[1]);
console.log(`  heaviest: ${byLoad.slice(0, 3).map(([k, n]) => `${k} ${n}`).join(", ")}; the two heaviest hold ${(100 * (byLoad[0][1] + byLoad[1][1]) / totalSNV).toFixed(1)}% of all SNVs`);
for (const ch of ["T[C>A]T", "T[C>T]G"]) {
  const all = sum(names.map((k) => cat.get(k)[CHI[ch]]));
  const a046 = cat.get("TCGA-AN-A046")[CHI[ch]];
  console.log(`  ${ch}: ${all} in the cohort, ${a046} (${(100 * a046 / all).toFixed(1)}%) in TCGA-AN-A046, whose own share of its SNVs there is ${f3(a046 / sum(cat.get("TCGA-AN-A046")))}`);
}

function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// KL (Brunet) multiplicative updates, as NMF::nmf's default method
function nmfKL(V, r, seed, iters) {
  const m = V.length, n = V[0].length, R = mulberry32(seed);
  const W = Array.from({ length: m }, () => Float64Array.from({ length: r }, () => R() + 0.01));
  const H = Array.from({ length: r }, () => Float64Array.from({ length: n }, () => R() + 0.01));
  const WH = Array.from({ length: m }, () => new Float64Array(n));
  const product = () => { for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < r; k++) s += W[i][k] * H[k][j]; WH[i][j] = s; } };
  for (let it = 0; it < iters; it++) {
    product();
    for (let k = 0; k < r; k++) {
      let ws = 0; for (let i = 0; i < m; i++) ws += W[i][k];
      for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += (W[i][k] * V[i][j]) / WH[i][j]; H[k][j] *= s / ws; }
    }
    product();
    for (let k = 0; k < r; k++) {
      let hs = 0; for (let j = 0; j < n; j++) hs += H[k][j];
      for (let i = 0; i < m; i++) { let s = 0; for (let j = 0; j < n; j++) s += (H[k][j] * V[i][j]) / WH[i][j]; W[i][k] *= s / hs; }
    }
  }
  return { W, H };
}
const cosine = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
function extract(label, keep, seeds) {
  // maftools' pConstant = 0.1 (cell 21), rank 5 (cell 20's pick)
  const V = CH.map((_, i) => Float64Array.from(keep, (k) => cat.get(k)[i] + 0.1));
  console.log(`  rank 5, ${label} (${keep.length} tumours):`);
  for (const seed of seeds) {
    const { W, H } = nmfKL(V, 5, seed, 1500);
    for (let k = 0; k < 5; k++) {
      const col = Float64Array.from(W, (row) => row[k]), s = sum(col), sig = col.map((x) => x / s);
      const expo = Float64Array.from(H[k], (h) => h * s), tot = sum(expo);
      let j = 0; expo.forEach((e, i) => { if (e > expo[j]) j = i; });
      const top = [...sig].map((x, i) => [CH[i], x]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, x]) => `${c} ${f3(x)}`).join(", ");
      console.log(`    seed ${seed} sig ${k + 1}: ${top}; cosine to TCGA-AN-A046 ${f3(cosine(sig, cat.get("TCGA-AN-A046")))}, to TCGA-AC-A23H ${f3(cosine(sig, cat.get("TCGA-AC-A23H")))}; largest share ${keep[j]} ${(100 * expo[j] / tot).toFixed(1)}%`);
    }
  }
}
extract("every tumour", names, [1, 2]);
extract("without TCGA-AN-A046 and TCGA-AC-A23H", names.filter((k) => k !== "TCGA-AN-A046" && k !== "TCGA-AC-A23H"), [1]);

// ------------------------------------------------------------------ §4 clonal architecture
console.log("\n§4 clonal architecture (01-2 cell 25, the RETCHER figure's cluster mean CCFs)");
for (const [sample, c1, c2, c3] of [["P2.1st", 0.729, 0.534, 0.512], ["P2.2st", 0.826, 0.597, 0.353], ["P2.3st", 0.926, 0.767, 0.348], ["P2.surgery", 0.806, 0.476, 0.304]]) {
  const linear = c3 <= c2 && c2 <= c1, branching = c2 + c3 <= c1;
  console.log(`  ${sample.padEnd(10)} CCF ${c1} / ${c2} / ${c3}: linear 1→2→3 ${linear ? "fits" : "fails"}; 2 and 3 as siblings under 1 (${(c2 + c3).toFixed(3)} ≤ ${c1}) ${branching ? "fits" : "fails"}`);
}

// ------------------------------------------------------------------ §5 somatic interactions
console.log("\n§5 somatic interactions (01-3 cells 9–11, 35)");
const genesOf = new Map(tumours.map((s) => [s, new Set()]));
const burden = new Map(tumours.map((s) => [s, 0]));
for (const r of nonsyn) { genesOf.get(tsb(r)).add(r.Hugo_Symbol); burden.set(tsb(r), burden.get(tsb(r)) + 1); }
const histology = new Map(clin.map((c) => [c.Tumor_Sample_Barcode, c.primary_diagnosis || ""]));
const hist = (s) => { const d = histology.get(s) || ""; return /^Infiltrating duct carcinoma/.test(d) ? "ductal" : /^Lobular carcinoma/.test(d) ? "lobular" : "other"; };
const bs = [...burden.values()].sort((a, b) => a - b), cuts = [0.25, 0.5, 0.75].map((p) => bs[Math.floor(p * (bs.length - 1))]);
const quart = (s) => { const b = burden.get(s); return b <= cuts[0] ? 1 : b <= cuts[1] ? 2 : b <= cuts[2] ? 3 : 4; };
const strata = (f) => { const m = new Map(); for (const s of tumours) { const k = f(s); if (!m.has(k)) m.set(k, []); m.get(k).push(s); } return [...m.values()]; };
const table = (A, B, set) => { const t = { n00: 0, n01: 0, n11: 0, n10: 0 }; for (const s of set) { const a = genesOf.get(s).has(A), b = genesOf.get(s).has(B); t[a && b ? "n11" : a ? "n10" : b ? "n01" : "n00"]++; } return t; };
const mantelHaenszel = (A, B, groups) => { let num = 0, den = 0; for (const g of groups) { const t = table(A, B, g); num += (t.n11 * t.n00) / g.length; den += (t.n10 * t.n01) / g.length; } return num / den; };
const byHist = strata(hist), byQuart = strata(quart);
console.log(`  ${tumours.filter((s) => hist(s) === "ductal").length} ductal, ${tumours.filter((s) => hist(s) === "lobular").length} lobular, ${tumours.filter((s) => hist(s) === "other").length} other; burden quartile cuts ${cuts.join(", ")}`);
for (const [A, B, printed] of [["GATA3", "TP53", "521 322 9 116"], ["TP53", "CDH1", "520 117 11 320"], ["TP53", "MAP3K1", "564 73 9 322"],
  ["TP53", "PIK3CA", "388 249 79 252"], ["CDH1", "PIK3CA", "575 265 63 65"], ["MAP3K1", "PIK3CA", "601 285 43 39"],
  ["ZFHX4", "RYR2", "874 47 8 39"], ["PTEN", "RYR2", "869 47 8 44"], ["GATA3", "NCOR1", "807 36 13 112"], ["KMT2C", "PIK3CA", "595 288 40 45"]]) {
  const t = table(A, B, tumours), counts = `${t.n00} ${t.n01} ${t.n11} ${t.n10}`;
  console.log(`  ${(A + "–" + B).padEnd(13)} 00 01 11 10 = ${counts} ${counts === printed ? "(as printed)" : "(printed " + printed + ")"}; OR ${f3((t.n11 * t.n00) / (t.n10 * t.n01))}, within histology ${f3(mantelHaenszel(A, B, byHist))}, within burden quartile ${f3(mantelHaenszel(A, B, byQuart))}`);
}
for (const g of ["CDH1", "TP53"]) {
  const pct = (h) => { const set = tumours.filter((s) => hist(s) === h); return (100 * set.filter((s) => genesOf.get(s).has(g)).length / set.length).toFixed(1); };
  console.log(`  ${g} mutated in ${pct("lobular")}% of lobular and ${pct("ductal")}% of ductal tumours`);
}
for (const g of ["RYR2", "ZFHX4"]) {
  const carriers = tumours.filter((s) => genesOf.get(s).has(g)).map((s) => burden.get(s));
  const others = tumours.filter((s) => !genesOf.get(s).has(g)).map((s) => burden.get(s));
  console.log(`  ${g} carriers' median non-synonymous count ${median(carriers)} against ${median(others)}`);
}
