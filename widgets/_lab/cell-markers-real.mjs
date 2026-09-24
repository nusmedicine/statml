/* _lab/cell-markers-real.mjs — slot 81, measured on the lesson's own cells.
 *
 * The arc's claim for 81's Conditions page came from a simulation whose
 * Wilcoxon had no tie correction (single-cell values are mostly zeros, so
 * nearly every value is a tie and the uncorrected variance is too large).
 * This reads the four 10x matrices the lesson reads, applies its QC (nFeature
 * > 500, nCount > 800, mt% < 10), takes the Kupffer cells (CD163 ≥ 2 counts,
 * the lesson's marker) in each sample, and tests them the way FindMarkers
 * does by default in Seurat v5:
 *
 *   - NormalizeData: each cell to 10^4, log1p
 *   - genes kept if detected in ≥ 1% of either group (min.pct 0.01) and
 *     |avg_log2FC| ≥ 0.1 (logfc.threshold), avg_log2FC = log2(mean(expm1) + 1)
 *     difference, as Seurat v5 computes it
 *   - Wilcoxon rank-sum over CELLS, normal approximation WITH the tie
 *     correction and continuity correction (R's wilcox.test, which presto
 *     matches)
 *   - Bonferroni over every gene in the dataset (33,538), as p_val_adj is
 *
 * Three comparisons, each within the Kupffer cells:
 *   A. patient 1's normal liver against patient 2's normal liver — the same
 *      cell type in the same tissue in two people: every call is a patient
 *      difference, since there is no condition;
 *   B. the lesson's own comparison, tumour against background, both patients
 *      pooled on each side (02-4 cell 21, which it runs on cluster 5);
 *   C. B as a test over PATIENTS: the four samples' pseudobulk (summed counts,
 *      log2 CPM), a paired t-test over the two patients (tumour − background
 *      within each), df = 1. A stand-in for DESeq2 on summed counts, which is
 *      what the field recommends; two patients is the design's real n.
 *
 *   node --max-old-space-size=6000 widgets/_lab/cell-markers-real.mjs   (~2–3 min)
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { lgamma } from "../core/stats.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, "../../../jupyterbook/phm5003/notebook/08 - RNAseq Expression Analysis");
const SAMPLES = ["HB17_background", "HB53_background", "HB17_tumor", "HB53_tumor"];
const THR = { nFeature: 500, nCount: 800, mt: 10 };
const out = [];
const say = (s) => { out.push(s); console.log(s); };

function readFeatures(dir) {
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, "features.tsv.gz"))).toString("latin1");
  return txt.split("\n").filter(Boolean).map((l) => { const f = l.split("\t"); return f[1] ?? f[0]; });
}

/* Two passes over the matrix held once as text: the per-cell QC numbers and
   CD163, then every entry of the cells that pass and are Kupffer cells. */
function readKupffer(sample) {
  const t0 = Date.now();
  const dir = path.join(DIR, `${sample}_filtered_feature_bc_matrix`);
  const names = readFeatures(dir);
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, "matrix.mtx.gz"))).toString("latin1");
  let pos = 0;
  while (txt.charCodeAt(pos) === 37) pos = txt.indexOf("\n", pos) + 1;
  const hdrEnd = txt.indexOf("\n", pos);
  const [nRows, nCols] = txt.slice(pos, hdrEnd).trim().split(/\s+/).map(Number);
  const body = hdrEnd + 1, L = txt.length;
  const isMt = new Uint8Array(nRows + 1);
  names.forEach((n, r) => { if (n.startsWith("MT-")) isMt[r + 1] = 1; });
  const cd163 = names.indexOf("CD163") + 1, gpc3 = names.indexOf("GPC3") + 1, dlk1 = names.indexOf("DLK1") + 1, ptprc = names.indexOf("PTPRC") + 1;
  const nCount = new Float64Array(nCols + 1), nFeature = new Uint32Array(nCols + 1), mt = new Float64Array(nCols + 1), mark = new Float64Array(nCols + 1), gp = new Float64Array(nCols + 1), dl = new Float64Array(nCols + 1), pt = new Float64Array(nCols + 1);
  const scan = (fn) => {
    pos = body;
    while (pos < L) {
      let c = txt.charCodeAt(pos), row = 0, col = 0, val = 0;
      while (c >= 48 && c <= 57) { row = row * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
      pos += 1; c = txt.charCodeAt(pos);
      while (c >= 48 && c <= 57) { col = col * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
      pos += 1; c = txt.charCodeAt(pos);
      while (c >= 48 && c <= 57) { val = val * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
      while (pos < L && txt.charCodeAt(pos) !== 10) pos += 1;
      pos += 1;
      fn(row, col, val);
    }
  };
  scan((row, col, val) => { nCount[col] += val; nFeature[col] += 1; if (isMt[row]) mt[col] += val; if (row === cd163) mark[col] = val; if (row === gpc3) gp[col] = val; if (row === dlk1) dl[col] = val; if (row === ptprc) pt[col] = val; });
  const keep = new Int32Array(nCols + 1).fill(-1);
  let n = 0, qc = 0;
  for (let c = 1; c <= nCols; c += 1) {
    const pass = nFeature[c] > THR.nFeature && nCount[c] > THR.nCount && (100 * mt[c]) / nCount[c] < THR.mt;
    if (pass) qc += 1;
    if (pass && mark[c] >= 2) keep[c] = n++;
  }
  /* GPC3 per cell, as counts and per 10^4, in three groups of QC cells: the
     Kupffer cells kept, cells with DLK1 >= 3 (tumour cells), and PTPRC >= 2
     (immune cells) — ambient RNA shows as a low, even level in every group,
     a misplaced tumour cell as a tumour cell's level */
  const grp = { kupffer: [], tumourCells: [], immune: [] };
  for (let c = 1; c <= nCols; c += 1) {
    const pass = nFeature[c] > THR.nFeature && nCount[c] > THR.nCount && (100 * mt[c]) / nCount[c] < THR.mt;
    if (!pass) continue;
    const per = (gp[c] / nCount[c]) * 1e4;
    if (keep[c] >= 0) grp.kupffer.push([gp[c], per]);
    if (dl[c] >= 3) grp.tumourCells.push([gp[c], per]);
    if (pt[c] >= 2) grp.immune.push([gp[c], per]);
  }
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const gpc3Line = Object.entries(grp).map(([k, a]) => `${k} n=${a.length}: GPC3 detected ${a.length ? Math.round(100 * a.filter((v) => v[0] > 0).length / a.length) : "-"}%, median count ${med(a.map((v) => v[0]))}, median per 10^4 ${med(a.map((v) => v[1])).toFixed(1)}`).join(" | ");
  /* per gene, the (cell, normalised value) pairs of the kept cells */
  const byGene = new Map();
  const total = new Float64Array(n);
  for (let c = 1; c <= nCols; c += 1) if (keep[c] >= 0) total[keep[c]] = nCount[c];
  const counts = new Float64Array(nRows + 1); // pseudobulk
  scan((row, col, val) => {
    const k = keep[col]; if (k < 0) return;
    counts[row] += val;
    let g = byGene.get(row); if (!g) { g = []; byGene.set(row, g); }
    g.push(Math.log1p((val / total[k]) * 1e4));
  });
  const lib = counts.reduce((s, v) => s + v, 0);
  console.log(`  ${sample}: ${nCols} cells, ${qc} pass QC, ${n} Kupffer (CD163 ≥ 2) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return { sample, names, nRows, nCells: n, qc, byGene, counts, lib, gpc3Line };
}

/* ---------------------------------------------------------------- the tests */
function normLogSf(z) { // log of the upper normal tail, stable far out
  if (z < 5) { const p = 0.5 * erfc(z / Math.SQRT2); return Math.log(p); }
  return -0.5 * z * z - Math.log(z) - 0.5 * Math.log(2 * Math.PI) + Math.log(1 - 1 / (z * z) + 3 / z ** 4);
}
function erfc(x) { // Numerical Recipes erfcc, |rel err| < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
/** Wilcoxon rank-sum over cells with the tie and continuity corrections; `a`
    and `b` hold the NONZERO values, `na` and `nb` the group sizes. Returns
    log10 of the two-sided p. */
function wilcoxLog10P(a, na, b, nb) {
  const za = na - a.length, zb = nb - b.length, z0 = za + zb;
  const nz = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  let R1 = za * ((z0 + 1) / 2), tie = z0 > 1 ? z0 ** 3 - z0 : 0;
  let i = 0;
  while (i < nz.length) {
    let j = i; while (j + 1 < nz.length && nz[j + 1][0] === nz[i][0]) j += 1;
    const r = z0 + (i + j) / 2 + 1, t = j - i + 1;
    for (let q = i; q <= j; q += 1) if (nz[q][1] === 0) R1 += r;
    if (t > 1) tie += t ** 3 - t;
    i = j + 1;
  }
  const N = na + nb, U = R1 - (na * (na + 1)) / 2, mu = (na * nb) / 2;
  const v = (na * nb / 12) * (N + 1 - tie / (N * (N - 1)));
  if (v <= 0) return 0;
  const zz = Math.max(0, Math.abs(U - mu) - 0.5) / Math.sqrt(v);
  return (Math.log(2) + normLogSf(zz)) / Math.LN10;
}
function tLog10P(t, df) { // two-sided, via the regularised incomplete beta
  const x = df / (df + t * t);
  return Math.log10(Math.max(1e-300, ibeta(x, df / 2, 0.5)));
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d; for (let m = 1; m <= 300; m += 1) { const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c; aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/** FindMarkers over cells: group 1 = the union of `s1`, group 2 = of `s2`. */
function findMarkers(s1, s2, nGenes) {
  const n1 = s1.reduce((s, x) => s + x.nCells, 0), n2 = s2.reduce((s, x) => s + x.nCells, 0);
  const rows = new Set([...s1, ...s2].flatMap((x) => [...x.byGene.keys()]));
  const res = [];
  for (const r of rows) {
    const a = s1.flatMap((x) => x.byGene.get(r) ?? []), b = s2.flatMap((x) => x.byGene.get(r) ?? []);
    const p1 = a.length / n1, p2 = b.length / n2;
    if (Math.max(p1, p2) < 0.01) continue;
    const m1 = a.reduce((s, v) => s + Math.expm1(v), 0) / n1, m2 = b.reduce((s, v) => s + Math.expm1(v), 0) / n2;
    const lfc = Math.log2(m1 + 1) - Math.log2(m2 + 1);
    if (Math.abs(lfc) < 0.1) continue;
    const lp = wilcoxLog10P(a, n1, b, n2);
    res.push({ gene: s1[0].names[r - 1], row: r, lfc, p1, p2, lp, lpAdj: Math.min(0, lp + Math.log10(nGenes)) });
  }
  return { n1, n2, res };
}
function summarise(tag, fm) {
  const sig = fm.res.filter((x) => x.lpAdj < Math.log10(0.05));
  const zero = fm.res.filter((x) => x.lp < -300).length;
  say(`  ${tag}: ${fm.n1} against ${fm.n2} cells; ${fm.res.length} genes tested; ${sig.length} at p_val_adj < 0.05 (${sig.filter((x) => Math.abs(x.lfc) > 1).length} of them with |avg_log2FC| > 1); ${zero} with p below 1e-300, which R prints as 0`);
  return sig;
}

/* ------------------------------------------------------------------- the run */
const t0 = Date.now();
say("REAL — the lesson's four 10x samples, its QC, the Kupffer cells (CD163 ≥ 2) of each; FindMarkers' Seurat v5 defaults with a tie-corrected Wilcoxon");
const S = Object.fromEntries(SAMPLES.map((s) => [s, readKupffer(s)]));
const nGenes = S.HB17_background.nRows;
say(`  Kupffer cells after QC: ${SAMPLES.map((s) => `${s} ${S[s].nCells} of ${S[s].qc}`).join(", ")}`);
say("  GPC3 by group, per sample (ambient RNA is low and even across groups; a tumour cell's own level is high):");
for (const s of SAMPLES) say(`    ${s}: ${S[s].gpc3Line}`);

say("\nA. patient 1's normal liver against patient 2's — the same cell type in the same tissue; no condition");
const sigA = summarise("HB17_background vs HB53_background", findMarkers([S.HB17_background], [S.HB53_background], nGenes));
say(`  top by p: ${sigA.sort((x, y) => x.lp - y.lp).slice(0, 8).map((x) => `${x.gene} (lfc ${x.lfc.toFixed(1)}, pct ${x.p1.toFixed(2)}/${x.p2.toFixed(2)})`).join(", ")}`);

say("\nB. the lesson's comparison: tumour against background, both patients pooled on each side");
const fmB = findMarkers([S.HB17_tumor, S.HB53_tumor], [S.HB17_background, S.HB53_background], nGenes);
const sigB = summarise("tumour vs background (cells)", fmB);
say(`  top by avg_log2FC among those: ${sigB.slice().sort((x, y) => y.lfc - x.lfc).slice(0, 8).map((x) => `${x.gene} (${x.lfc.toFixed(1)}, pct ${x.p1.toFixed(3)}/${x.p2.toFixed(3)})`).join(", ")}`);

say("\nC. the same comparison over PATIENTS: pseudobulk log2 CPM per sample, paired t over the 2 patients (df 1)");
const cpm = (s, r) => Math.log2(1 + (1e6 * s.counts[r]) / s.lib);
let callsC = 0, testedC = 0, callsBonf = 0;
const agree = [];
for (const x of fmB.res) {
  const r = x.row;
  const d = [cpm(S.HB17_tumor, r) - cpm(S.HB17_background, r), cpm(S.HB53_tumor, r) - cpm(S.HB53_background, r)];
  const m = (d[0] + d[1]) / 2, sd = Math.abs(d[0] - d[1]) / Math.SQRT2;
  testedC += 1;
  const lp = sd > 0 ? tLog10P(m / (sd / Math.SQRT2), 1) : (m !== 0 ? -Infinity : 0);
  if (lp < Math.log10(0.05)) callsC += 1;
  if (lp + Math.log10(nGenes) < Math.log10(0.05)) callsBonf += 1;
  if (x.lpAdj < Math.log10(0.05)) agree.push(Math.sign(d[0]) === Math.sign(d[1]));
}
say(`  ${testedC} genes (those B tested); ${callsC} at p < 0.05 unadjusted, ${callsBonf} after Bonferroni — with two patients the smallest two-sided p a paired t on df 1 can give is set by how alike the two differences are`);
say(`  of B's ${sigB.length} cell-level calls, ${agree.filter(Boolean).length} change the same way in both patients and ${agree.filter((v) => !v).length} change in opposite directions in the two patients`);

say("\nA's pseudobulk: the two patients' normal-liver Kupffer cells, log2 CPM per gene");
{
  const rows = fmB.res.map((x) => x.row);
  const d = rows.map((r) => cpm(S.HB17_background, r) - cpm(S.HB53_background, r)).filter((v) => Number.isFinite(v));
  const sorted = d.map(Math.abs).sort((a, b) => a - b);
  say(`  |log2 CPM difference| between the patients over ${d.length} genes: median ${sorted[Math.floor(0.5 * sorted.length)].toFixed(2)}, 90th percentile ${sorted[Math.floor(0.9 * sorted.length)].toFixed(2)} — the patient effect a simulation should carry`);
}
say(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
fs.writeFileSync(path.join(here, "cell-markers-real.txt"), out.join("\n") + "\n");
