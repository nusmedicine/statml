/* The lesson's own single-cell data, read for numbers before anything is
 * drawn (2026-09-21, planning the RNA-seq arc from PHM5003 08).
 *
 * 02-2 filters 40,564 cells to 31,014 with nFeature > 500, nCount > 800 and
 * mt% < 10, the thresholds of Commun Biol 2021 4:1049, and never shows how
 * many each rule removes on its own. This reads the four 10x matrices under
 * `../jupyterbook/phm5003/notebook/08 - RNAseq Expression Analysis/` and
 * reports, per sample:
 *
 *   - quantiles of nCount, nFeature and mt%          (the violin plots, as numbers)
 *   - cells removed by each rule alone and by all three (the notebook prints only the joint count)
 *   - per-cell values for the notebook's marker genes  (for a markers mock drawn on real cells)
 *
 * and writes `_lab/rnaseq-sc-qc.json` so the mock can draw real distributions.
 * The matrices are MatrixMarket, gzipped; parsed by hand rather than by
 * readline because there are ~10^8 entries and readline is several times
 * slower.
 *
 *   node widgets/_lab/rnaseq-sc-data.mjs        (~2–4 min, all four samples)
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, "../../../jupyterbook/phm5003/notebook/08 - RNAseq Expression Analysis");
const SAMPLES = ["HB17_background", "HB17_tumor", "HB53_background", "HB53_tumor"];
const MARKERS = ["DLK1", "FLT1", "PTPRC", "COL6A3", "COL3A1", "CD68", "CD163", "CYP3A4", "ALB", "APOC3", "HPGD", "GPC3", "AFP"];
const THR = { nFeature: 500, nCount: 800, mt: 10 };

function gunzipText(file) {
  return zlib.gunzipSync(fs.readFileSync(file)).toString("latin1");
}

function readFeatures(dir) {
  const txt = gunzipText(path.join(dir, "features.tsv.gz"));
  const names = [];
  for (const line of txt.split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    names.push(f[1] ?? f[0]);
  }
  return names;
}

/* Parse the MatrixMarket body once, accumulating per column (cell). The
   gunzipped text of the largest file is ~600 MB, which V8 holds as one string;
   indexOf/charCodeAt over it is the fastest thing that needs no dependency. */
function readMatrix(dir, names, markerRows) {
  const t0 = Date.now();
  const txt = gunzipText(path.join(dir, "matrix.mtx.gz"));
  let pos = 0;
  // skip comments
  while (txt.charCodeAt(pos) === 37 /* % */) pos = txt.indexOf("\n", pos) + 1;
  const hdrEnd = txt.indexOf("\n", pos);
  const [nRows, nCols, nnz] = txt.slice(pos, hdrEnd).trim().split(/\s+/).map(Number);
  pos = hdrEnd + 1;
  const isMt = new Uint8Array(nRows + 1);
  for (let r = 0; r < nRows; r += 1) if (names[r].startsWith("MT-")) isMt[r + 1] = 1;
  const nCount = new Float64Array(nCols + 1);
  const nFeature = new Uint32Array(nCols + 1);
  const mtCount = new Float64Array(nCols + 1);
  const marker = new Map(markerRows.map((r) => [r, new Float32Array(nCols + 1)]));
  const L = txt.length;
  let n = 0;
  while (pos < L) {
    // row
    let c = txt.charCodeAt(pos);
    let row = 0;
    while (c >= 48 && c <= 57) { row = row * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
    pos += 1; // space
    let col = 0; c = txt.charCodeAt(pos);
    while (c >= 48 && c <= 57) { col = col * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
    pos += 1;
    let val = 0; c = txt.charCodeAt(pos);
    while (c >= 48 && c <= 57) { val = val * 10 + (c - 48); pos += 1; c = txt.charCodeAt(pos); }
    // skip to end of line (handles a possible decimal part or \r)
    while (pos < L && txt.charCodeAt(pos) !== 10) pos += 1;
    pos += 1;
    nCount[col] += val;
    nFeature[col] += 1;
    if (isMt[row]) mtCount[col] += val;
    const m = marker.get(row);
    if (m) m[col] = val;
    n += 1;
  }
  if (n !== nnz) throw new Error(`parsed ${n} entries, header says ${nnz}`);
  console.log(`  ${path.basename(dir)}: ${nRows} genes x ${nCols} cells, ${nnz} entries, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { nRows, nCols, nCount: nCount.subarray(1), nFeature: nFeature.subarray(1), mtCount: mtCount.subarray(1), marker };
}

const q = (arr, p) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const quant = (arr) => [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => +q(arr, p).toFixed(1));

const out = { thresholds: THR, samples: {}, markers: MARKERS };
let totalBefore = 0, totalAfter = 0;
console.log("reading the four 10x matrices");
for (const s of SAMPLES) {
  const dir = path.join(DIR, `${s}_filtered_feature_bc_matrix`);
  const names = readFeatures(dir);
  const markerRows = MARKERS.map((g) => names.indexOf(g) + 1).filter((r) => r > 0);
  const M = readMatrix(dir, names, markerRows);
  const mt = Float64Array.from(M.nCount, (c, i) => (c > 0 ? (100 * M.mtCount[i]) / c : 0));
  const nc = M.nCols;
  let lowF = 0, lowC = 0, highMt = 0, keep = 0, lowBoth = 0;
  for (let i = 0; i < nc; i += 1) {
    const f = M.nFeature[i] > THR.nFeature, c = M.nCount[i] > THR.nCount, m = mt[i] < THR.mt;
    if (!f) lowF += 1;
    if (!c) lowC += 1;
    if (!f && !c) lowBoth += 1;
    if (!m) highMt += 1;
    if (f && c && m) keep += 1;
  }
  totalBefore += nc; totalAfter += keep;
  const markerCells = {};
  for (const g of MARKERS) {
    const r = names.indexOf(g) + 1;
    if (r > 0) markerCells[g] = Array.from(M.marker.get(r).subarray(1), (v) => Math.round(v));
  }
  out.samples[s] = {
    cells: nc, kept: keep,
    removed: { nFeatureOnly: lowF, nCountOnly: lowC, bothLow: lowBoth, mtOnly: highMt, any: nc - keep },
    quantiles: { nCount: quant(M.nCount), nFeature: quant(M.nFeature), mt: quant(mt) },
    // per-cell values, rounded, so the mock draws the real violins and scatters
    nCount: Array.from(M.nCount, (v) => Math.round(v)),
    nFeature: Array.from(M.nFeature),
    mt: Array.from(mt, (v) => +v.toFixed(2)),
    markerCells,
  };
  const S = out.samples[s];
  console.log(`  ${s}: ${nc} cells -> ${keep} kept | removed by nFeature<=500: ${lowF}, nCount<=800: ${lowC} (both: ${lowBoth}), mt>=10: ${highMt}, any: ${nc - keep}`);
  console.log(`    nCount p5..p95 ${S.quantiles.nCount.join(" / ")} | nFeature ${S.quantiles.nFeature.join(" / ")} | mt% ${S.quantiles.mt.join(" / ")}`);
  for (const g of ["DLK1", "GPC3", "AFP", "CD163", "PTPRC", "CYP3A4"]) {
    const v = markerCells[g]; if (!v) continue;
    const pct = (100 * v.filter((x) => x > 0).length) / nc;
    console.log(`    ${g}: detected in ${pct.toFixed(1)}% of cells`);
  }
}
console.log(`\nall four: ${totalBefore} cells -> ${totalAfter} kept (the notebook prints 40564 -> 31014)`);
fs.writeFileSync(path.join(here, "rnaseq-sc-qc.json"), JSON.stringify(out));
console.log(`wrote ${path.join(here, "rnaseq-sc-qc.json")}`);
