/* Widget 70 round 5 (2026-09-26): 01-4 cell 19's `estimateSignatures`, on the
 * widget's own engine. Shared by the measure and the mock; if the page is
 * built, this moves into widgets/mutational-signatures/.
 *
 * What maftools 2.26.0 and NMF 0.28 run (read from the installed sources):
 *   - brunet from a random start, stopping on the CONNECTIVITY: every 10
 *     iterations each tumour is labelled by its largest exposure, and the run
 *     stops once those labels have not changed for 41 checks in a row
 *     (stopconv 40), or at 2,000 iterations;
 *   - nrun = 10 starts a rank (maftools' default; cell 19 does not set it);
 *   - consensus = the share of the runs that give a pair of tumours the same
 *     label; cophcor() = Pearson correlation between 1 − consensus and the
 *     cophenetic distance of an average-linkage hclust on 1 − consensus.
 */
import * as M from "./mutational-signatures-model.js";
import { makeRng } from "../core/rng.js";

export const NRUN = 10;

function samePartition(a, b) {
  const map = new Map(), back = new Map();
  for (let j = 0; j < a.length; j += 1) {
    if (map.has(a[j]) ? map.get(a[j]) !== b[j] : back.has(b[j])) return false;
    map.set(a[j], b[j]); back.set(b[j], a[j]);
  }
  return true;
}

/** One brunet run with NMF's connectivity stop: each tumour's label and the KL. */
export function runOnce(V, r, rng, mean) {
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
    if (old && samePartition(lab, old)) inc += 1; else { old = lab; inc = 0; }
    if (inc > 40) break;
  }
  return { label: label(), iter, kl: M.klDivergence(V, W, H) };
}

/** Average-linkage hclust on a distance matrix: the cophenetic matrix and the leaf order. */
export function hclustAverage(D) {
  const n = D.length;
  const members = Array.from({ length: n }, (_, i) => [i]);
  const d = D.map((row) => Float64Array.from(row));
  const C = Array.from({ length: n }, () => new Float64Array(n));
  let active = members.map((_, i) => i);
  while (active.length > 1) {
    let bi = -1, bj = -1, best = Infinity;
    for (let a = 0; a < active.length; a += 1) for (let b = a + 1; b < active.length; b += 1) {
      const x = d[active[a]][active[b]];
      if (x < best) { best = x; bi = active[a]; bj = active[b]; }
    }
    for (const p of members[bi]) for (const q of members[bj]) { C[p][q] = best; C[q][p] = best; }
    const ni = members[bi].length, nj = members[bj].length;
    for (const k of active) if (k !== bi && k !== bj) {
      const v = (ni * d[bi][k] + nj * d[bj][k]) / (ni + nj);
      d[bi][k] = v; d[k][bi] = v;
    }
    members[bi] = members[bi].concat(members[bj]);
    active = active.filter((k) => k !== bj);
  }
  return { C, order: members[active[0]] };
}

export function consensusOf(labels) {
  const n = labels[0].length;
  const cons = Array.from({ length: n }, () => new Float64Array(n));
  for (const lab of labels) for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (lab[i] === lab[j]) cons[i][j] += 1 / labels.length;
  return cons;
}

export function cophcor(cons) {
  const n = cons.length;
  const D = cons.map((row) => Float64Array.from(row, (x) => 1 - x));
  let allZero = true;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) if (cons[i][j] !== 0) allZero = false;
  const { C, order } = hclustAverage(D);
  if (allZero) return { coph: 1, order };
  const xs = [], ys = [];
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) { xs.push(D[i][j]); ys.push(C[i][j]); }
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, x) => s + x, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < xs.length; k += 1) { const a = xs[k] - mx, b = ys[k] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return { coph: sxy / Math.sqrt(sxx * syy), order };
}

/** estimateSignatures at one rank: ten runs' labels, the best KL, the cophenetic correlation. */
export function estimateRank(Mat, r, seed) {
  const V = Mat.map((row) => Float64Array.from(row, (x) => x + M.P_CONSTANT));
  let mean = 0; for (const row of V) for (const x of row) mean += x; mean /= V.length * V[0].length;
  const labels = [], kls = [];
  let iters = 0;
  for (let run = 0; run < NRUN; run += 1) {
    const res = runOnce(V, r, makeRng(seed * 104729 + r * 131 + run), mean);
    labels.push(res.label); kls.push(res.kl); iters += res.iter;
  }
  const cons = consensusOf(labels);
  const { coph, order } = cophcor(cons);
  return { labels, kls, kl: Math.min(...kls), coph, order, iters: iters / NRUN };
}
