/* _lab/integration-measure.mjs — slot 80 `integration`, measured before any mock.
 *
 * The stage is slot 79's: the same four samples (two patients × liver and
 * tumour) in the same mixes, the same six types. What 79 did not need and 80
 * does is a TECHNICAL difference between samples, so each cell here is a
 * vector of log expression over 300 genes: its type's mean, its sample's
 * technical shift (a patient part and a smaller sample part, gene by gene),
 * and noise. Hepatocytes and tumour cells share half their marker block,
 * because hepatoblastoma is a tumour of hepatocyte precursors — so each is
 * the other's nearest type, which is what makes the batch-key question bite.
 *
 * Three methods, each the lesson's figure or the arc's pick:
 *   MNN      mutual nearest neighbours in the pooled PCA, correction vectors
 *            smoothed over the query (Haghverdi 2018, as the arc measured it)
 *   CCA      Seurat's anchors (02-3 cell 0, Stuart 2019 fig. 1): CCA on the
 *            two scaled matrices, L2-normalise each cell, MNN there, score
 *            each anchor by the overlap of the two cells' neighbourhoods,
 *            correct in gene space by the anchors' weighted differences
 *   Harmony  soft k-means with the diversity penalty, per-cluster batch
 *            centroids moved onto the cluster's (the arc's block-updated
 *            stand-in)
 *
 * And two batch keys, which is the lesson's own question: it integrates the
 * four samples as layers, so liver against tumour is corrected as if it were
 * technical. Here key "patient" is two batches whose types are all shared;
 * key "tissue" is two batches in which the tumour cells sit on one side only.
 *
 *   node widgets/_lab/integration-measure.mjs      (~35 s)
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { TYPES, SAMPLES } from "../cell-qc/engine.js";

const out = [];
const say = (s) => { out.push(s); console.log(s); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const pct = (x) => `${Math.round(100 * x)}%`;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/* ---------------------------------------------------------------- the stage */
const G = 300, BLOCK = 30;
function stage(seed, { cells = 400, patientShift = 0.8, sampleShift = 0.3, noise = 0.6, markerUp = 2.2, strict = false, typeBatch = 0 } = {}) {
  const rng = makeRng(seed);
  const base = Array.from({ length: G }, () => rng.normal(1, 0.5));
  const mu = TYPES.map((t, ti) => base.map((b, g) => {
    const own = g >= ti * BLOCK && g < (ti + 1) * BLOCK;
    // tumour (1) carries the first half of the hepatocyte (0) block, and vice versa
    const kin = (ti === 1 && g < BLOCK / 2) || (ti === 0 && g >= BLOCK && g < BLOCK * 1.5);
    return b + (own ? markerUp : 0) + (kin ? markerUp * 0.7 : 0);
  }));
  const pShift = [0, 1].map(() => Array.from({ length: G }, () => rng.normal(0, patientShift)));
  /* a batch effect that is not one offset per gene: each patient's chemistry
     also scales how far a type sits above the common genes, gene by gene, so
     centring each dataset on its own mean cannot remove it */
  const pGain = [0, 1].map(() => Array.from({ length: G }, () => Math.exp(rng.normal(0, typeBatch))));
  const cellsOut = [];
  for (const s of SAMPLES) {
    const sShift = Array.from({ length: G }, () => rng.normal(0, sampleShift));
    const scale = 1 + rng.normal(0, 0.15); // a sample's dynamic range differs too — what CCA's scaling absorbs
    for (let i = 0; i < cells; i += 1) {
      const mix = strict && s.tissue === "liver" ? { ...s.mix, tumour: 0 } : s.mix;
      const tot = Object.values(mix).reduce((a, b) => a + b, 0);
      const u = rng.next() * tot; let acc = 0, ti = 0;
      for (let k = 0; k < TYPES.length; k += 1) { acc += mix[TYPES[k].key] ?? 0; if (u < acc) { ti = k; break; } }
      const x = mu[ti].map((m, g) => scale * (base[g] + (m - base[g]) * pGain[s.patient - 1][g] + rng.normal(0, noise)) + pShift[s.patient - 1][g] + sShift[g]);
      cellsOut.push({ sample: s.key, patient: s.patient, tissue: s.tissue, type: ti, x });
    }
  }
  return cellsOut;
}

/* ------------------------------------------------------------- linear algebra */
function center(X) { const D = X[0].length, m = new Float64Array(D); X.forEach((x) => x.forEach((v, d) => { m[d] += v; })); m.forEach((_, d) => { m[d] /= X.length; }); return { Xc: X.map((x) => x.map((v, d) => v - m[d])), m }; }
function standardize(X) { const { Xc } = center(X); const D = X[0].length; const sd = new Float64Array(D); Xc.forEach((x) => x.forEach((v, d) => { sd[d] += v * v; })); for (let d = 0; d < D; d += 1) sd[d] = Math.sqrt(sd[d] / (X.length - 1)) || 1; return Xc.map((x) => x.map((v, d) => v / sd[d])); }
/* top-k eigenvectors of a symmetric matrix by block power iteration with re-orthonormalisation */
function topEig(mulFn, n, k, rng, iters = 60) {
  let V = Array.from({ length: k }, () => Array.from({ length: n }, () => rng.normal()));
  const orth = (M) => { for (let i = 0; i < M.length; i += 1) { for (let j = 0; j < i; j += 1) { const d = dot(M[i], M[j]); for (let t = 0; t < n; t += 1) M[i][t] -= d * M[j][t]; } const nn = Math.sqrt(dot(M[i], M[i])) || 1; for (let t = 0; t < n; t += 1) M[i][t] /= nn; } return M; };
  V = orth(V);
  for (let it = 0; it < iters; it += 1) V = orth(V.map(mulFn));
  return V;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]; return s; };
function pca(X, k, rng) {
  const { Xc } = center(X); const D = X[0].length;
  // covariance-free: v -> Xc^T (Xc v)
  const mul = (v) => { const u = Xc.map((x) => dot(x, v)); const r = new Array(D).fill(0); Xc.forEach((x, i) => { for (let d = 0; d < D; d += 1) r[d] += x[d] * u[i]; }); return r; };
  const V = topEig(mul, D, k, rng);
  return Xc.map((x) => V.map((v) => dot(x, v)));
}
const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += (a[i] - b[i]) ** 2; return s; };
function knnBetween(A, B, k, skipSelf = false) {
  return A.map((a, i) => { const best = []; B.forEach((b, j) => { if (skipSelf && i === j) return; const dd = d2(a, b); if (best.length < k || dd < best[best.length - 1][0]) { best.push([dd, j]); best.sort((x, y) => x[0] - y[0]); if (best.length > k) best.pop(); } }); return best.map((e) => e[1]); });
}

/* ------------------------------------------------------------------ metrics */
function metrics(Z, cells, batchOf, k = 20) {
  const nn = knnBetween(Z, Z, k, true);
  const nb = new Set(cells.map(batchOf)).size;
  const share = cells.map((c, i) => nn[i].filter((j) => batchOf(cells[j]) !== batchOf(c)).length / k);
  // expected other-batch share if fully mixed, per cell's batch
  const counts = {}; cells.forEach((c) => { counts[batchOf(c)] = (counts[batchOf(c)] ?? 0) + 1; });
  const exp = cells.map((c) => 1 - counts[batchOf(c)] / cells.length);
  const purity = cells.map((c, i) => nn[i].filter((j) => cells[j].type === c.type).length / k);
  const byType = TYPES.map((t, ti) => {
    const idx = cells.map((c, i) => (c.type === ti ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    const votes = new Array(TYPES.length).fill(0);
    idx.forEach((i) => nn[i].forEach((j) => { votes[cells[j].type] += 1; }));
    const tot = votes.reduce((s, v) => s + v, 0);
    return { n: idx.length, purity: votes[ti] / tot, top: votes.map((v, q) => [v / tot, q]).filter(([, q]) => q !== ti).sort((a, b) => b[0] - a[0])[0] };
  });
  return { mixing: mean(share) / mean(exp), purity: mean(purity), byType, nb };
}
const fmtType = (bt) => bt.map((b, ti) => (b ? `${TYPES[ti].key.slice(0, 4)} ${pct(b.purity)}${b.top[0] > 0.1 ? ` (${pct(b.top[0])} ${TYPES[b.top[1]].key.slice(0, 4)})` : ""}` : "")).filter(Boolean).join(" · ");

/* ------------------------------------------------------------------- methods */
/* fastMNN's recipe: cosine-normalise each cell's PCs, find mutual nearest
   neighbours there, and move each query cell by a Gaussian-weighted average of
   the pair vectors near it. The kernel is LOCAL — its width is the typical
   distance to a cell's 20th neighbour inside its own batch — so each type gets
   its own vector. A kernel as wide as the batch gap (the first version) turns
   every pair into one global shift and leaves a third of the gap. */
function cosnorm(X) { return X.map((x) => { const n = Math.sqrt(dot(x, x)) || 1; return x.map((v) => v / n); }); }
function mnn(P, batch, k = 20) {
  const i1 = batch.map((b, i) => (b === 0 ? i : -1)).filter((i) => i >= 0), i2 = batch.map((b, i) => (b === 1 ? i : -1)).filter((i) => i >= 0);
  const Pn = cosnorm(P);
  const X1 = i1.map((i) => Pn[i]), X2 = i2.map((i) => Pn[i]);
  const nn12 = knnBetween(X1, X2, k), nn21 = knnBetween(X2, X1, k);
  const pairs = []; for (let a = 0; a < X1.length; a += 1) for (const b of nn12[a]) if (nn21[b].includes(a)) pairs.push([a, b]);
  const D = P[0].length;
  const own = knnBetween(X2, X2, k, true);
  const s2 = mean(X2.map((x, q) => d2(x, X2[own[q][k - 1]])));
  const vec = pairs.map(([a, b]) => X1[a].map((v, t) => v - X2[b][t]));
  const Z = Pn.map((x) => x.slice());
  X2.forEach((x, q) => { let w = 0; const acc = new Array(D).fill(0); pairs.forEach(([, b], p) => { const ww = Math.exp(-d2(x, X2[b]) / s2); w += ww; for (let t = 0; t < D; t += 1) acc[t] += ww * vec[p][t]; }); if (w > 0) Z[i2[q]] = x.map((v, t) => v + acc[t] / w); });
  return { Z, pairs: pairs.map(([a, b]) => [i1[a], i2[b]]) };
}

/* Seurat's anchors, the figure's four steps. */
function ccaAnchors(X, batch, rng, { dims = 20, k = 5, kScore = 30, kWeight = 100 } = {}) {
  const i1 = batch.map((b, i) => (b === 0 ? i : -1)).filter((i) => i >= 0), i2 = batch.map((b, i) => (b === 1 ? i : -1)).filter((i) => i >= 0);
  const S1 = standardize(i1.map((i) => X[i])), S2 = standardize(i2.map((i) => X[i]));
  // 1. CCA: the SVD of S1 S2^T (cells × cells), done as eigenvectors of (S1 S2^T)(S2 S1^T) on the left
  const G_ = S1[0].length;
  const mulL = (u) => { const g = new Array(G_).fill(0); S1.forEach((x, a) => { for (let t = 0; t < G_; t += 1) g[t] += x[t] * u[a]; }); const w = S2.map((y) => dot(y, g)); const g2 = new Array(G_).fill(0); S2.forEach((y, b) => { for (let t = 0; t < G_; t += 1) g2[t] += y[t] * w[b]; }); return S1.map((x) => dot(x, g2)); };
  const U = topEig(mulL, S1.length, dims, rng, 40);
  // V = S2 S1^T U / sigma
  const V = U.map((u) => { const g = new Array(G_).fill(0); S1.forEach((x, a) => { for (let t = 0; t < G_; t += 1) g[t] += x[t] * u[a]; }); const v = S2.map((y) => dot(y, g)); const nn = Math.sqrt(dot(v, v)) || 1; return v.map((z) => z / nn); });
  // cells' coordinates in the shared space, 2. L2-normalised per cell
  const l2 = (M, n) => Array.from({ length: n }, (_, c) => { const r = M.map((vec) => vec[c]); const nn = Math.sqrt(dot(r, r)) || 1; return r.map((z) => z / nn); });
  const C1 = l2(U, S1.length), C2 = l2(V, S2.length);
  // 3. anchors: mutual nearest neighbours in the shared space
  const nn12 = knnBetween(C1, C2, k), nn21 = knnBetween(C2, C1, k);
  const pairs = []; for (let a = 0; a < C1.length; a += 1) for (const b of nn12[a]) if (nn21[b].includes(a)) pairs.push([a, b]);
  // 4. score: how many of each cell's kScore neighbours (within AND across) the pair shares — Seurat's
  //    shared-neighbour overlap, rescaled to [0,1] between the 1st and 90th percentile
  const all = [...C1, ...C2];
  const nnAll = knnBetween(all, all, kScore);
  const raw = pairs.map(([a, b]) => { const A = new Set(nnAll[a]); return nnAll[C1.length + b].filter((j) => A.has(j)).length; });
  const sorted = raw.slice().sort((x, y) => x - y); const lo = sorted[Math.floor(0.01 * sorted.length)], hi = sorted[Math.floor(0.9 * sorted.length)];
  const score = raw.map((r) => Math.min(1, Math.max(0, (r - lo) / Math.max(1, hi - lo))));
  // correct in gene space: each query cell moved by its kWeight nearest anchors' (ref − query) vectors,
  // weighted by distance in the shared space and by the anchor's score
  const Xg1 = i1.map((i) => X[i]), Xg2 = i2.map((i) => X[i]);
  const vec = pairs.map(([a, b]) => Xg1[a].map((v, t) => v - Xg2[b][t]));
  const anchorQ = pairs.map(([, b]) => C2[b]);
  const Z = X.map((x) => x.slice());
  C2.forEach((c, q) => {
    const near = anchorQ.map((aq, p) => [d2(c, aq), p]).sort((x, y) => x[0] - y[0]).slice(0, kWeight);
    const dmax = near[near.length - 1][0] || 1;
    let w = 0; const acc = new Array(G_).fill(0);
    near.forEach(([dd, p]) => { const ww = (1 - dd / dmax) * score[p]; w += ww; for (let t = 0; t < G_; t += 1) acc[t] += ww * vec[p][t]; });
    if (w > 0) Z[i2[q]] = Xg2[q].map((v, t) => v + acc[t] / w);
  });
  return { Z, pairs: pairs.map(([a, b]) => [i1[a], i2[b]]), score, raw };
}

/* Harmony as published (Korsunsky 2019): cosine-normalised PCs; soft k-means
   at sigma 0.1 on the cosine distance with the diversity penalty (E/O)^theta,
   updated a block of cells at a time; then per cluster a ridge regression of
   the cells on batch (lambda 1), whose batch terms are subtracted. K is
   min(N/30, 100), as the package sets it. The arc's first stand-in worked on
   raw squared distances with sigma = 2D, which at this stage's scale is a
   hard assignment the penalty cannot move — it corrected nothing. */
function harmony(X, batch, K, theta, rng, rounds = 10, sigma = 0.1, lambda = 1) {
  const n = X.length, D = X[0].length, nbatch = Math.max(...batch) + 1;
  K = K ?? Math.min(100, Math.round(n / 30));
  let Z = cosnorm(X);
  const Nb = Array.from({ length: nbatch }, (_, b) => batch.filter((v) => v === b).length);
  let C = null;
  for (let round = 0; round < rounds; round += 1) {
    const Zn = cosnorm(Z);
    if (!C) { C = [Zn[Math.floor(rng.next() * n)].slice()]; while (C.length < K) { const dd = Zn.map((z) => Math.min(...C.map((c) => d2(c, z)))); const tot = dd.reduce((s, v) => s + v, 0); let u = rng.next() * tot, i = 0; while (u > dd[i] && i < n - 1) { u -= dd[i]; i += 1; } C.push(Zn[i].slice()); } C = cosnorm(C); }
    const dist = (i, k) => 2 * (1 - dot(Zn[i], C[k]));
    const R = Array.from({ length: n }, (_, i) => { const r = C.map((_, k) => Math.exp(-dist(i, k) / sigma)); const s = r.reduce((a, b) => a + b, 0) || 1; return r.map((v) => v / s); });
    const O = Array.from({ length: K }, () => new Array(nbatch).fill(0));
    for (let i = 0; i < n; i += 1) for (let k = 0; k < K; k += 1) O[k][batch[i]] += R[i][k];
    const idx = [...Array(n).keys()];
    for (let it = 0; it < 10; it += 1) {
      for (let k = 0; k < K; k += 1) { const c = new Array(D).fill(0); for (let i = 0; i < n; i += 1) for (let t = 0; t < D; t += 1) c[t] += R[i][k] * Zn[i][t]; C[k] = c; }
      C = cosnorm(C);
      for (let t = n - 1; t > 0; t -= 1) { const s = Math.floor(rng.next() * (t + 1)); [idx[t], idx[s]] = [idx[s], idx[t]]; }
      const block = Math.max(1, Math.floor(n * 0.05));
      for (let start = 0; start < n; start += block) {
        const cs = idx.slice(start, start + block);
        for (const i of cs) for (let k = 0; k < K; k += 1) O[k][batch[i]] -= R[i][k];
        const E = O.map((o) => { const tot = o.reduce((s, v) => s + v, 0) + cs.length / K; return Nb.map((nb) => tot * nb / n); });
        for (const i of cs) { const b = batch[i]; let s = 0; for (let k = 0; k < K; k += 1) { R[i][k] = Math.exp(-dist(i, k) / sigma) * Math.pow((E[k][b] + 1) / (Math.max(0, O[k][b]) + 1), theta); s += R[i][k]; } s = s || 1; for (let k = 0; k < K; k += 1) { R[i][k] /= s; O[k][b] += R[i][k]; } }
      }
    }
    /* the correction: per cluster, a ridge fit of Z on [1, batch one-hot] with
       R's weights; the intercept is left alone and each batch's term removed */
    const corr = Z.map(() => new Array(D).fill(0));
    for (let k = 0; k < K; k += 1) {
      const w = new Array(nbatch).fill(0), sb = Array.from({ length: nbatch }, () => new Array(D).fill(0)), s0 = new Array(D).fill(0);
      let W = 0;
      for (let i = 0; i < n; i += 1) { const r = R[i][k]; W += r; w[batch[i]] += r; for (let t = 0; t < D; t += 1) { sb[batch[i]][t] += r * Z[i][t]; s0[t] += r * Z[i][t]; } }
      if (W < 1e-9) continue;
      /* with one-hot batch terms the ridge solution is: intercept = the
         weighted mean shrunk toward the batches; beta_b = w_b (m_b - mu) / (w_b + lambda) */
      const mu = s0.map((v) => v / W);
      for (let b = 0; b < nbatch; b += 1) { if (w[b] < 1e-9) continue; const beta = sb[b].map((v, t) => (v - w[b] * mu[t]) / (w[b] + lambda)); for (let i = 0; i < n; i += 1) if (batch[i] === b) for (let t = 0; t < D; t += 1) corr[i][t] += R[i][k] * beta[t]; }
    }
    Z = Z.map((z, i) => z.map((v, t) => v - corr[i][t]));
  }
  return Z;
}

/* ------------------------------------------------------------------- the run */
const KEYS = {
  patient: (c) => c.patient - 1,
  tissue: (c) => (c.tissue === "liver" ? 0 : 1),
  sample: (c) => SAMPLES.findIndex((s) => s.key === c.sample),
};
export { stage, pca, mnn, ccaAnchors, harmony, KEYS, metrics, d2 };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
const t0 = Date.now();
const SEEDS = [1, 2];
const CONFIGS = [{ patientShift: 0.5 }, { patientShift: 0.5, strict: true }, { patientShift: 0.5, strict: true, typeBatch: 0.4 }];
say("M1 THE STAGE — 4 samples × 400 cells, 300 genes, 79's mixes; sample shift sd 0.3, noise 0.6; configs below: strict = no tumour cells in either liver sample; typeBatch = a per-patient gain on each type's marker genes");
for (const cfg of CONFIGS) for (const seed of SEEDS) {
  const cells = stage(seed, cfg);
  const rng = makeRng(100 + seed);
  let t = Date.now();
  const P = pca(cells.map((c) => c.x), 10, rng);
  const tPca = Date.now() - t;
  say(`\n${JSON.stringify(cfg)} seed ${seed}  (PCA of 1,600 × 300 to 10 dims: ${tPca} ms)`);
  for (const key of ["patient", "tissue"]) {
    const bOf = KEYS[key], batch = cells.map(bOf);
    const oneSided = TYPES.map((tp, ti) => { const n = [0, 1].map((b) => cells.filter((c) => c.type === ti && bOf(c) === b).length); return `${tp.key.slice(0, 4)} ${n[0]}/${n[1]}`; }).join(" ");
    say(`  batch = ${key}   cells per type, batch 0 / batch 1: ${oneSided}`);
    const m0 = metrics(P, cells, bOf);
    say(`    none      mixing ${f(m0.mixing)}  purity ${pct(m0.purity)}   ${fmtType(m0.byType)}`);
    t = Date.now(); const M = mnn(P, batch); const tM = Date.now() - t;
    const mM = metrics(M.Z, cells, bOf);
    const wrongM = M.pairs.filter(([a, b]) => cells[a].type !== cells[b].type).length;
    say(`    MNN       mixing ${f(mM.mixing)}  purity ${pct(mM.purity)}   ${fmtType(mM.byType)}   [${M.pairs.length} pairs, ${pct(wrongM / M.pairs.length)} across types, ${tM} ms]`);
    t = Date.now(); const A = ccaAnchors(cells.map((c) => c.x), batch, makeRng(200 + seed)); const tA = Date.now() - t;
    const PA = pca(A.Z, 10, makeRng(300 + seed));
    const mA = metrics(PA, cells, bOf);
    const wrongA = A.pairs.map(([a, b], p) => [cells[a].type !== cells[b].type, A.score[p]]);
    const nw = wrongA.filter(([w]) => w).length;
    const sW = mean(wrongA.filter(([w]) => w).map(([, s]) => s)), sR = mean(wrongA.filter(([w]) => !w).map(([, s]) => s));
    say(`    CCA       mixing ${f(mA.mixing)}  purity ${pct(mA.purity)}   ${fmtType(mA.byType)}   [${A.pairs.length} anchors, ${pct(nw / A.pairs.length)} across types; mean score right ${f(sR)} wrong ${nw ? f(sW) : "-"}; ${tA} ms]`);
    t = Date.now(); const H = harmony(P, batch, null, 2, makeRng(400 + seed)); const tH = Date.now() - t;
    const mH = metrics(H, cells, bOf);
    say(`    Harmony   mixing ${f(mH.mixing)}  purity ${pct(mH.purity)}   ${fmtType(mH.byType)}   [${tH} ms]`);
  }
  // the lesson's own key: four layers, Harmony only (anchors need a pairwise tree)
  const bS = cells.map(KEYS.sample);
  const HS = harmony(P, bS, null, 2, makeRng(500 + seed));
  const mS0 = metrics(P, cells, KEYS.sample), mS = metrics(HS, cells, KEYS.sample);
  say(`  batch = sample (the lesson's four layers), Harmony: mixing ${f(mS0.mixing)} -> ${f(mS.mixing)}, purity ${pct(mS0.purity)} -> ${pct(mS.purity)}   ${fmtType(mS.byType)}`);
}
say(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
fs.writeFileSync(new URL("./integration-measure.txt", import.meta.url), out.join("\n") + "\n");
}
