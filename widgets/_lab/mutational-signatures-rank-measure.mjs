/* Planning measurement for widget 70 `mutational-signatures`, round 5
 * (2026-09-26): can 01-4 cells 19–20's step, "Estimate number of signatures",
 * go in the widget? Kenneth asked after the ship.
 *
 *   node widgets/_lab/mutational-signatures-rank-measure.mjs > widgets/_lab/mutational-signatures-rank-measure.txt
 *
 * What `estimateSignatures` runs (maftools 2.26.0 and NMF 0.28, read from the
 * installed sources on 2026-09-26):
 *   - t(nmf_matrix) + pConstant, so 96 rows and a column per tumour;
 *   - NMF::nmfEstimateRank(ranks nMin..nTry, method "brunet", nrun = 10,
 *     seed 123456) — nrun is maftools' default and cell 19 does not set it;
 *   - brunet stops on the CONNECTIVITY: every 10 iterations each tumour is
 *     labelled by its largest exposure, and the run stops once those labels
 *     have not changed for 41 checks in a row (stopconv 40), or at 2,000;
 *   - the consensus matrix is the mean over the runs of "same label" (1/0)
 *     for every pair of tumours, and cophcor() is the Pearson correlation
 *     between 1 − consensus and the cophenetic distance of an average-linkage
 *     hclust on 1 − consensus.
 * This script does the same on the widget's simulated cohort with the widget's
 * own engine (brunetStep), so the numbers are the ones a page would draw.
 *
 *   §1 The cophenetic curve over ranks 2–8, seeds 1–10, the hypermutated
 *      tumour in and out, beside the planted truth: 4 processes, 5 with the
 *      tumour in.
 *   §2 Where each reading of "the elbow" lands: the last rank before the
 *      largest drop, and the rank after it (cell 20's reading picks 5 on a
 *      curve whose largest early drop is 4 → 5).
 *   §3 The fit over the same ranks: the best KL of the runs, which only
 *      improves with rank — the other half of cell 19's "balance".
 *   §4 What it costs: iterations and milliseconds per run, and per rank.
 */
import * as M from "./mutational-signatures-model.js";
import { makeRng } from "../core/rng.js";

const RANKS = [2, 3, 4, 5, 6, 7, 8];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NRUN = 10;

/* brunet with NMF's connectivity stop; returns each tumour's label. */
function runOnce(V, r, rng, mean) {
  const m = V.length, n = V[0].length;
  const W = Array.from({ length: m }, () => Float64Array.from({ length: r }, () => rng.next() * mean + 1e-6));
  const H = Array.from({ length: r }, () => Float64Array.from({ length: n }, () => rng.next() * mean + 1e-6));
  const label = () => Int32Array.from({ length: n }, (_, j) => { let b = 0; for (let k = 1; k < r; k += 1) if (H[k][j] > H[b][j]) b = k; return b; });
  let old = null, inc = 0, iter = 0;
  while (iter < 2000) {
    iter += 1;
    M.brunetStep(V, W, H, r, iter);
    if (iter % 10 !== 0) continue;
    const lab = label();
    /* "no pair changed" is the same as "the partition is the same", and a
       partition compares by its pairs, not its label names */
    const same = old && samePartition(lab, old);
    if (same) inc += 1; else { old = lab; inc = 0; }
    if (inc > 40) break;
  }
  return { label: label(), iter, kl: M.klDivergence(V, W, H) };
}
function samePartition(a, b) {
  const map = new Map(), back = new Map();
  for (let j = 0; j < a.length; j += 1) {
    if (map.has(a[j]) ? map.get(a[j]) !== b[j] : back.has(b[j])) return false;
    map.set(a[j], b[j]); back.set(b[j], a[j]);
  }
  return true;
}

/* average-linkage hclust on D (n×n), returning the cophenetic matrix */
function cophenetic(D) {
  const n = D.length;
  let clusters = Array.from({ length: n }, (_, i) => [i]);
  const d = D.map((row) => Float64Array.from(row));
  const C = Array.from({ length: n }, () => new Float64Array(n));
  let active = clusters.map((_, i) => i);
  while (active.length > 1) {
    let bi = -1, bj = -1, best = Infinity;
    for (let a = 0; a < active.length; a += 1) for (let b = a + 1; b < active.length; b += 1) {
      const x = d[active[a]][active[b]];
      if (x < best) { best = x; bi = active[a]; bj = active[b]; }
    }
    for (const p of clusters[bi]) for (const q of clusters[bj]) { C[p][q] = best; C[q][p] = best; }
    const ni = clusters[bi].length, nj = clusters[bj].length;
    for (const k of active) if (k !== bi && k !== bj) {
      const v = (ni * d[bi][k] + nj * d[bj][k]) / (ni + nj);
      d[bi][k] = v; d[k][bi] = v;
    }
    clusters[bi] = clusters[bi].concat(clusters[bj]);
    active = active.filter((k) => k !== bj);
  }
  return C;
}
function cophcor(cons) {
  const n = cons.length;
  const D = cons.map((row) => Float64Array.from(row, (x) => 1 - x));
  let allZero = true;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) if (cons[i][j] !== 0) allZero = false;
  if (allZero) return 1;
  const C = cophenetic(D);
  const xs = [], ys = [];
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) { xs.push(D[i][j]); ys.push(C[i][j]); }
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, x) => s + x, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < xs.length; k += 1) { const a = xs[k] - mx, b = ys[k] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxy / Math.sqrt(sxx * syy);
}
/* how many pairs of tumours the runs disagree on: 0 < consensus < 1 */
function mixedShare(cons) {
  const n = cons.length; let mixed = 0, all = 0;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) { all += 1; if (cons[i][j] > 0 && cons[i][j] < 1) mixed += 1; }
  return mixed / all;
}

function estimate(Mat, r, seed) {
  const V = Mat.map((row) => Float64Array.from(row, (x) => x + M.P_CONSTANT));
  let mean = 0; for (const row of V) for (const x of row) mean += x; mean /= V.length * V[0].length;
  const n = V[0].length;
  const cons = Array.from({ length: n }, () => new Float64Array(n));
  let iters = 0, bestKl = Infinity;
  const t0 = performance.now();
  for (let run = 0; run < NRUN; run += 1) {
    const res = runOnce(V, r, makeRng(seed * 104729 + r * 131 + run), mean);
    iters += res.iter; bestKl = Math.min(bestKl, res.kl);
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (res.label[i] === res.label[j]) cons[i][j] += 1 / NRUN;
  }
  const ms = performance.now() - t0;
  return { coph: cophcor(cons), mixed: mixedShare(cons), kl: bestKl, iters: iters / NRUN, ms };
}

const f3 = (x) => x.toFixed(3);
const pad = (s, w) => String(s).padStart(w);
const out = [];
const log = (s = "") => { out.push(s); console.log(s); };

const table = {};
let totalMs = 0, runs = 0, itersAll = 0;
for (const hyper of ["out", "in"]) {
  table[hyper] = {};
  for (const seed of SEEDS) {
    const co = M.cohortFor(seed);
    const cols = hyper === "out" ? co.hyperIndex : co.hyperIndex + 1;
    const Mat = co.M.map((row) => row.slice(0, cols));
    table[hyper][seed] = RANKS.map((r) => {
      const e = estimate(Mat, r, seed);
      totalMs += e.ms; runs += NRUN; itersAll += e.iters * NRUN;
      return e;
    });
  }
}

log("§1 Cophenetic correlation, ranks " + RANKS.join(" ") + ", nrun " + NRUN + " (truth: 4 planted processes, 5 with the tumour in)");
for (const hyper of ["out", "in"]) {
  log(`\n  hypermutated tumour ${hyper}`);
  log("  seed  " + RANKS.map((r) => pad("r" + r, 7)).join(""));
  for (const seed of SEEDS) log("  " + pad(seed, 4) + "  " + table[hyper][seed].map((e) => pad(f3(e.coph), 7)).join(""));
  const med = RANKS.map((_, k) => { const v = SEEDS.map((s) => table[hyper][s][k].coph).sort((a, b) => a - b); return (v[4] + v[5]) / 2; });
  log("  med   " + med.map((x) => pad(f3(x), 7)).join(""));
  log("  pairs the 10 runs split (0 < consensus < 1), median over seeds:");
  const mix = RANKS.map((_, k) => { const v = SEEDS.map((s) => table[hyper][s][k].mixed).sort((a, b) => a - b); return (v[4] + v[5]) / 2; });
  log("        " + mix.map((x) => pad((100 * x).toFixed(1) + "%", 7)).join(""));
}

log("\n§2 The elbow, two readings: A = last rank before the largest drop, B = the rank after it");
for (const hyper of ["out", "in"]) {
  const truth = hyper === "out" ? 4 : 5;
  const A = {}, B = {};
  for (const seed of SEEDS) {
    const c = table[hyper][seed].map((e) => e.coph);
    let k = 0; for (let i = 1; i < c.length - 1; i += 1) if (c[i] - c[i + 1] > c[k] - c[k + 1]) k = i;
    A[RANKS[k]] = (A[RANKS[k]] || 0) + 1; B[RANKS[k + 1]] = (B[RANKS[k + 1]] || 0) + 1;
  }
  const show = (o) => Object.keys(o).sort().map((r) => `${r}×${o[r]}`).join(" ");
  log(`  tumour ${hyper} (truth ${truth}):  A ${show(A)}   B ${show(B)}`);
}

log("\n§3 Best KL of the 10 runs, relative to rank 2 (seed 1..10 median)");
for (const hyper of ["out", "in"]) {
  const rel = RANKS.map((_, k) => { const v = SEEDS.map((s) => table[hyper][s][k].kl / table[hyper][s][0].kl).sort((a, b) => a - b); return (v[4] + v[5]) / 2; });
  log(`  tumour ${hyper}:  ` + rel.map((x) => pad(f3(x), 7)).join(""));
}

log("\n§4 Cost");
log(`  ${runs} runs, mean ${(itersAll / runs).toFixed(0)} iterations, ${(totalMs / runs).toFixed(0)} ms a run, ${(totalMs / runs * NRUN).toFixed(0)} ms a rank`);
for (const hyper of ["out", "in"]) {
  log(`  tumour ${hyper}: ms a rank by rank ` + RANKS.map((_, k) => pad((SEEDS.reduce((s, sd) => s + table[hyper][sd][k].ms, 0) / SEEDS.length).toFixed(0), 6)).join(""));
}
