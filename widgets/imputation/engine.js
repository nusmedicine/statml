/* imputation's engine — a log2 protein matrix with a detection limit, four
 * ways to fill its holes, and the test each one feeds. Measured in
 * `_lab/proteomics-arc-measure.mjs` and mocked in `_lab/proteomics-arc-mock.html`
 * and `_lab/imputation-mock.html` (catalogue § Slot 89); the arithmetic is the
 * arc model's (`_lab/proteomics-arc-model.js` part B), lifted unchanged so the
 * widget prints the numbers the mock printed.
 *
 * The random forest is missForest as tidyproteomics 1.x passes it the matrix
 * (01-3 cell 42, `method = 'matrix'`): samples are the variables, proteins the
 * observations. Measured 2026-10-07 against the orientation of the version the
 * lesson's recommendation table was written for (before 2023-05, the matrix
 * transposed, proteins as variables): an absence of 6 log2 reads 2.6 here and
 * 1.4 there. The forest takes 2–4 s at 600 proteins, so it is computed ahead
 * (`forest-table.js`, from `_lab/imputation-table.mjs`); everything else runs
 * in compute.
 */
import { tTailP } from "../core/stats.js";

export const NA = 11, NB = 11, N = NA + NB;     // the lesson's design: 11 cancer, 11 healthy
export const PROTEINS = 600;
export const LOD = 23.3, LOD_WIDTH = 0.5, MCAR = 0.02;
const isNa = Number.isNaN;

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function variance(a) {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function quantile(a, q) {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}
/** Benjamini–Hochberg adjusted p-values, in the input order. */
export function bh(p) {
  const m = p.length;
  const idx = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
  const out = new Array(m);
  let run = 1;
  for (let r = m - 1; r >= 0; r -= 1) {
    run = Math.min(run, (p[idx[r]] * m) / (r + 1));
    out[idx[r]] = run;
  }
  return out;
}
/** Welch's t-test, two-sided. */
export function welch(a, b) {
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  return { t, df, p: tTailP(Math.abs(t), df) };
}

/** The chance a value is missing, at its true level: the soft detection limit plus the share missing completely at random. */
export const pMissing = (x) => 1 - (1 - 1 / (1 + Math.exp((x - LOD) / LOD_WIDTH))) * (1 - MCAR);

/**
 * Rows proteins, columns 11 cancer then 11 healthy. Detection is a soft
 * limit: the chance a value is missing rises as the true value falls below
 * LOD, plus 2% missing completely at random (34% missing overall, the
 * lesson's 35.1%). 15% of proteins differ by 1–3 log2; 3% are absent in
 * healthy, six log2 below their cancer level. A protein seen in no sample is
 * not in the table, as it would not be in a real one.
 */
export function simulateMatrix(rng, {
  proteins = PROTEINS, muMean = 24, muSd = 2, sigma = 0.45, de = 0.15, onoff = 0.03,
} = {}) {
  const truth = [], obs = [], meta = [];
  for (let p = 0; p < proteins; p += 1) {
    const mu = rng.normal(muMean, muSd);
    const s = sigma * Math.exp(rng.normal(0, 0.3));
    const u = rng.next();
    let fc = 0, kind = "null";
    if (u < onoff) { fc = 6; kind = "absent"; }
    else if (u < onoff + de) { fc = (rng.next() < 0.5 ? -1 : 1) * rng.uniform(1, 3); kind = "de"; }
    const row = [], orow = [];
    for (let j = 0; j < N; j += 1) {
      const m = j < NA ? mu + fc / 2 : mu - fc / 2;
      const x = rng.normal(m, s);
      row.push(x);
      const pMiss = 1 / (1 + Math.exp((x - LOD) / LOD_WIDTH));
      const miss = rng.next() < pMiss || rng.next() < MCAR;
      orow.push(miss ? NaN : x);
    }
    if (orow.every(isNa)) { p -= 1; continue; }
    truth.push(row); obs.push(orow); meta.push({ mu, fc, kind, sd: s });
  }
  return { truth, obs, meta };
}

export const seenIn = (r, a = 0, b = N) => { let n = 0; for (let j = a; j < b; j += 1) if (!isNa(r[j])) n += 1; return n; };
/** The Minimum measured filter: `half` keeps a protein measured in at least half of one group (6 of 11). */
export function keepRows(obs, filter) {
  return obs.map((r, p) => p).filter((p) => filter !== "half" || Math.max(seenIn(obs[p], 0, NA), seenIn(obs[p], NA, N)) >= Math.ceil(NA / 2));
}
/** Rows by measured mean, most abundant first — the order every matrix on the page is drawn in. */
export function abundanceOrder(obs, rows) {
  const m = rows.map((p) => { const v = obs[p].filter((x) => !isNa(x)); return mean(v); });
  return rows.map((p, i) => [p, m[i]]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

const colOf = (M, j) => M.map((r) => r[j]);

/** Minimum: each sample's lowest measured value (tidyproteomics' "Minimum WITHIN"). */
export function imputeMin(M) {
  const mins = Array.from({ length: N }, (_, j) => Math.min(...colOf(M, j).filter((v) => !isNa(v))));
  return M.map((r) => r.map((v, j) => (isNa(v) ? mins[j] : v)));
}

/** Low draw: a draw from low in each sample's distribution (MinProb: the 1% quantile, the median protein SD as the spread). */
export function imputeLowDraw(M, rng, { q = 0.01 } = {}) {
  const sds = M.map((r) => r.filter((v) => !isNa(v))).filter((r) => r.length > 2).map((r) => Math.sqrt(variance(r)));
  const spread = median(sds);
  const qs = Array.from({ length: N }, (_, j) => quantile(colOf(M, j).filter((v) => !isNa(v)), q));
  return M.map((r) => r.map((v, j) => (isNa(v) ? rng.normal(qs[j], spread) : v)));
}

/**
 * kNN as the Bioconductor `impute` package runs it (tidymass' default, 02-3
 * cell 14): for a protein with a hole in sample j, the 10 proteins nearest to
 * it (Euclidean over the samples both measured, scaled to the count) that are
 * measured in j, averaged.
 */
export function imputeKnn(M, k = 10) {
  const P = M.length;
  const out = M.map((r) => r.slice());
  for (let p = 0; p < P; p += 1) {
    const miss = [];
    for (let j = 0; j < N; j += 1) if (isNa(M[p][j])) miss.push(j);
    if (!miss.length) continue;
    const d = [];
    for (let q = 0; q < P; q += 1) {
      if (q === p) continue;
      let s = 0, c = 0;
      for (let j = 0; j < N; j += 1) {
        const a = M[p][j], b = M[q][j];
        if (!isNa(a) && !isNa(b)) { s += (a - b) ** 2; c += 1; }
      }
      if (c) d.push([q, Math.sqrt((s / c) * N)]);
    }
    d.sort((x, y) => x[1] - y[1]);
    for (const j of miss) {
      const vals = [];
      for (const [q] of d) { if (!isNa(M[q][j])) vals.push(M[q][j]); if (vals.length === k) break; }
      out[p][j] = vals.length ? mean(vals) : NaN;
    }
  }
  // a protein with no neighbour measured in j: the sample mean (impute.knn's fallback)
  return out.map((r) => r.map((v, j) => (isNa(v) ? mean(colOf(M, j).filter((x) => !isNa(x))) : v)));
}

/* A small regression forest — enough of randomForest for missForest's loop.
   Run offline by `_lab/imputation-table.mjs` and live once by the verify. */
function buildTree(X, y, idx, rng, mtry, minLeaf, depth) {
  const m = mean(idx.map((i) => y[i]));
  if (idx.length < 2 * minLeaf || depth === 0) return { leaf: m };
  const nf = X[0].length;
  const feats = [];
  while (feats.length < mtry) { const f = Math.floor(rng.next() * nf); if (!feats.includes(f)) feats.push(f); }
  let best = null;
  for (const f of feats) {
    const order = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
    let sL = 0, sL2 = 0, sR = 0, sR2 = 0;
    for (const i of order) { sR += y[i]; sR2 += y[i] * y[i]; }
    for (let k = 0; k < order.length - 1; k += 1) {
      const v = y[order[k]];
      sL += v; sL2 += v * v; sR -= v; sR2 -= v * v;
      const nL = k + 1, nR = order.length - nL;
      if (nL < minLeaf || nR < minLeaf) continue;
      if (X[order[k]][f] === X[order[k + 1]][f]) continue;
      const sse = sL2 - (sL * sL) / nL + sR2 - (sR * sR) / nR;
      if (!best || sse < best.sse) best = { sse, f, thr: (X[order[k]][f] + X[order[k + 1]][f]) / 2 };
    }
  }
  if (!best) return { leaf: m };
  const L = idx.filter((i) => X[i][best.f] <= best.thr);
  const R = idx.filter((i) => X[i][best.f] > best.thr);
  return { f: best.f, thr: best.thr,
    l: buildTree(X, y, L, rng, mtry, minLeaf, depth - 1), r: buildTree(X, y, R, rng, mtry, minLeaf, depth - 1) };
}
const predictTree = (t, x) => (t.leaf !== undefined ? t.leaf : predictTree(x[t.f] <= t.thr ? t.l : t.r, x));
function forest(X, y, idx, rng, { trees = 40, minLeaf = 5, depth = 12 } = {}) {
  const mtry = Math.max(1, Math.floor(Math.sqrt(X[0].length)));
  const ts = [];
  for (let t = 0; t < trees; t += 1) {
    const boot = idx.map(() => idx[Math.floor(rng.next() * idx.length)]);
    ts.push(buildTree(X, y, boot, rng, mtry, minLeaf, depth));
  }
  return (x) => mean(ts.map((t) => predictTree(t, x)));
}

/**
 * missForest, samples as variables: start from each sample's mean; for each
 * sample (fewest holes first) fit a forest on the proteins measured in it,
 * predicting from the other samples' current values; repeat until the change
 * stops falling (missForest's stopping rule), at most `maxIter` times.
 */
export function imputeForest(M, rng, { maxIter = 4, trees = 40 } = {}) {
  const P = M.length;
  const missCols = Array.from({ length: N }, (_, j) => colOf(M, j).filter(isNa).length);
  const order = missCols.map((c, j) => j).filter((j) => missCols[j] > 0).sort((a, b) => missCols[a] - missCols[b]);
  let cur = M.map((r) => r.slice());
  for (let j = 0; j < N; j += 1) {
    const m = mean(colOf(M, j).filter((v) => !isNa(v)));
    for (let p = 0; p < P; p += 1) if (isNa(cur[p][j])) cur[p][j] = m;
  }
  let prevDiff = Infinity;
  let prev = cur;
  for (let it = 0; it < maxIter; it += 1) {
    const next = cur.map((r) => r.slice());
    for (const j of order) {
      const X = next.map((r) => r.filter((_, k) => k !== j));
      const y = colOf(next, j);
      const seen = [], hole = [];
      for (let p = 0; p < P; p += 1) (isNa(M[p][j]) ? hole : seen).push(p);
      const f = forest(X, y, seen, rng, { trees });
      for (const p of hole) next[p][j] = f(X[p]);
    }
    let num = 0, den = 0;
    for (let p = 0; p < P; p += 1) for (let j = 0; j < N; j += 1) if (isNa(M[p][j])) {
      num += (next[p][j] - cur[p][j]) ** 2; den += next[p][j] ** 2;
    }
    const diff = num / den;
    prev = cur;
    cur = next;
    if (diff >= prevDiff) return prev; // missForest returns the previous iteration
    prevDiff = diff;
  }
  return cur;
}
/**
 * Mixed, by protein (as DEP's impute(fun = "mixed") classifies): a protein
 * measured in at most `cut` of the 11 samples of a group is taken as below
 * the detection limit, and every one of its holes gets the MNAR fill; every
 * other protein gets the MAR fill. Measured 2026-10-07 over 20 seeds with the
 * Minimum and the forest: an absence reads 4.72, FDR 7.6%, 89.8 of 110 true
 * differences found, more than any single method. Deciding per GROUP instead
 * fails (FDR 21–32%): a protein with no real difference near the limit gets a
 * low fill in one group and a fill from the measured range in the other.
 */
export const MIXED_CUT = 2;
export function imputeMixed(M, mnar, mar, cut = MIXED_CUT) {
  return M.map((r, p) => {
    const below = Math.min(seenIn(r, 0, NA), seenIn(r, NA, N)) <= cut;
    return r.map((v, j) => (isNa(v) ? (below ? mnar[p][j] : mar[p][j]) : v));
  });
}

/** The rng the table generator gives the forest: one stream per seed and filter, apart from the page's. */
export const forestSeed = (seed, filter) => 7919 * seed + (filter === "half" ? 2 : 1);

/** Put a table's hole values back into the matrix (holes in row-major order over `obs`). */
export function fillFromHoles(obs, holes) {
  let k = 0;
  const out = obs.map((r) => r.map((v) => (isNa(v) ? holes[k++] / 100 : v)));
  if (k !== holes.length) throw new Error(`forest table holds ${holes.length} values for ${k} holes: regenerate it`);
  return out;
}
export function holesOf(F, obs) {
  const out = [];
  obs.forEach((r, p) => r.forEach((v, j) => { if (isNa(v)) out.push(Math.round(F[p][j] * 100)); }));
  return out;
}

/**
 * The test each matrix feeds: Welch's t on log2, Benjamini–Hochberg across the
 * proteins tested. Measured only tests a protein where both groups hold two
 * values or more; an imputed matrix tests every protein.
 */
export function testRows(M) {
  const ps = M.map((r) => {
    const a = r.slice(0, NA).filter((v) => !isNa(v)), b = r.slice(NA).filter((v) => !isNa(v));
    return a.length >= 2 && b.length >= 2 ? welch(a, b).p : NaN;
  });
  const idx = ps.map((p, i) => i).filter((i) => !isNa(ps[i]));
  const adj = bh(idx.map((i) => ps[i]));
  const padj = ps.map(() => NaN);
  idx.forEach((i, k) => { padj[i] = adj[k]; });
  const fc = M.map((r) => {
    const a = r.slice(0, NA).filter((v) => !isNa(v)), b = r.slice(NA).filter((v) => !isNa(v));
    return a.length && b.length ? mean(a) - mean(b) : NaN;
  });
  return { p: ps, padj, fc, tested: idx.length };
}
/** Score a test against the truth, which only a simulation has. */
export function score(sim, rows, M) {
  const t = testRows(M);
  let tp = 0, fp = 0, real = 0, n = 0, bias = 0;
  rows.forEach((p, i) => {
    if (sim.meta[p].kind !== "null") real += 1;
    if (t.padj[i] < 0.05) { if (sim.meta[p].kind === "null") fp += 1; else tp += 1; }
    sim.obs[p].forEach((v, j) => { if (isNa(v) && !isNa(M[i][j])) { n += 1; bias += M[i][j] - sim.truth[p][j]; } });
  });
  const ab = rows.map((p, i) => (sim.meta[p].kind === "absent" ? t.fc[i] : NaN)).filter((v) => !isNa(v));
  return { ...t, tp, fp, called: tp + fp, real, fdr: fp / Math.max(1, tp + fp), bias: n ? bias / n : NaN, imputed: n,
    absentFc: ab.length ? mean(ab) : NaN, absentN: ab.length };
}

/**
 * The three example proteins, chosen on the unfiltered matrix so a filter
 * can be seen to remove one: absent in healthy (the one with the most
 * healthy holes), measured in two samples (a protein with no real difference
 * that kNN calls, nearest to two values), scattered holes (no difference,
 * 4–7 holes, measured in at least 6 of 11 in a group so the filter keeps it,
 * the one the minimum moves furthest).
 */
export function pickExamples(sim, knnPadj, minFc) {
  const P = sim.obs.length, ids = Array.from({ length: P }, (_, p) => p);
  const absent = ids.filter((p) => sim.meta[p].kind === "absent")
    .sort((a, b) => seenIn(sim.obs[a], NA, N) - seenIn(sim.obs[b], NA, N) || seenIn(sim.obs[b], 0, NA) - seenIn(sim.obs[a], 0, NA))[0];
  const nulls = ids.filter((p) => sim.meta[p].kind === "null");
  const called = nulls.filter((p) => knnPadj[p] < 0.05);
  const few = (called.length ? called : nulls).sort((a, b) => Math.abs(seenIn(sim.obs[a]) - 2) - Math.abs(seenIn(sim.obs[b]) - 2) || a - b)[0];
  const scattered = nulls.filter((p) => {
    const holes = N - seenIn(sim.obs[p]);
    return holes >= 4 && holes <= 7 && seenIn(sim.obs[p], 0, NA) >= 6 && seenIn(sim.obs[p], NA, N) >= 6;
  }).sort((a, b) => Math.abs(minFc[b]) - Math.abs(minFc[a]) || a - b)[0];
  return { absent, few, scattered };
}
