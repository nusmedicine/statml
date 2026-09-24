/* _lab/cell-markers-umap.js — UMAP at a thousand cells, with umap-learn's own
 * optimiser. For slot 81 (his pick: "a UMAP computed on the page").
 *
 * Widget 22's `umap/model.js` is exact full-batch: every pair pulls and
 * pushes every step. It was written and verified against umap-learn at
 * n = 48, where that is milliseconds. At 600–1,200 cells it is 1.6–16 s and
 * it does not converge (`_lab/cell-markers-feasibility.txt`: 30–58% 5-NN
 * type purity, the hepatocyte gradient gone). umap-learn itself never does
 * full batch: `optimize_layout_euclidean` samples EDGES — each edge of the
 * fuzzy graph is visited in proportion to its weight — and for each visit
 * pushes the head away from `negative_sample_rate` random cells. That is what
 * this file does, step for step, so it can be checked against the library
 * (`_lab/cell-markers-umap-verify.mjs` against `cell-markers-umap-ref.json`).
 *
 * STEP 1 IS WIDGET 22'S, UNCHANGED: `fuzzySet` (the kNN, rho, sigma
 * bisection and the fuzzy union) and `findAbParams` from `umap/model.js`,
 * which were verified against umap-learn there. Only the layout is new.
 *
 * What follows umap-learn 0.5.12 (`umap_.py`, `layouts.py`):
 *   - edges below max(weight) / n_epochs are dropped;
 *   - epochs_per_sample = n_epochs / (n_epochs · w / max(w));
 *   - attraction on a sampled edge, both ends moved (move_other), with
 *     grad = −2ab·d^(2(b−1)) / (1 + a·d^(2b)) on the squared distance d;
 *   - repulsion from random cells, the head only, with
 *     grad = 2γb / ((0.001 + d)(1 + a·d^(2b))), γ = 1;
 *   - every gradient component clipped at ±4; learning rate 1 falling
 *     linearly to 0 over the epochs.
 * One declared departure: the start. umap-learn's default is a spectral
 * embedding of the graph; this starts from the first two principal
 * components scaled to ±10, which is umap-learn's `init="pca"` and is
 * compared against both of the library's starts in the verify.
 *
 * VERIFIED 2026-09-24 against umap-learn 0.5.12 on this stage
 * (`cell-markers-umap-verify.txt`). The graph: every edge within 1e-3 of the
 * library's except 4 of 13,086 at 600 cells and 2 of 26,646 at 1,200 — the
 * edges where one side has a cell as its 15th neighbour and the other does
 * not, a near-tie at the cutoff (casting to float32 as the library does
 * changes nothing). The layout, five seeds, 200 epochs: 5-NN type purity 1.00
 * against the library's 1.00, the hepatocyte gradient's |r| 0.91–0.93
 * against 0.87–0.94 at the library's two starts; 216 ms at 600 cells and
 * 559 ms at 1,200. So the widget may say "this is UMAP" of it, which widget
 * 22's model could not be used for at this size.
 */
import { fuzzySet, findAbParams } from "../umap/model.js";

export function umapSgd(P, { nNeighbors = 15, minDist = 0.1, nEpochs = 200, negativeSampleRate = 5, rng }) {
  const n = P.length;
  const { mu } = fuzzySet(P, nNeighbors);
  const { a, b } = findAbParams(1, minDist);
  /* the graph as an edge list, both directions, as graph.tocoo() gives */
  const head = [], tail = [], w = [];
  let wMax = 0;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j && mu[i][j] > 0) { head.push(i); tail.push(j); w.push(mu[i][j]); if (mu[i][j] > wMax) wMax = mu[i][j]; }
  const keep = w.map((v) => v >= wMax / nEpochs);
  const H = [], T = [], eps = [];
  for (let e = 0; e < w.length; e += 1) if (keep[e]) { H.push(head[e]); T.push(tail[e]); eps.push(nEpochs / (nEpochs * (w[e] / wMax))); }
  const E = H.length;
  /* the start: PCA of P to 2-D, scaled so the largest coordinate is 10 */
  const Y = pcaInit(P, rng);
  const epochNext = eps.slice(), epsNeg = eps.map((v) => v / negativeSampleRate), epochNextNeg = epsNeg.slice();
  const clip = (v) => (v > 4 ? 4 : v < -4 ? -4 : v);
  for (let ep = 0; ep < nEpochs; ep += 1) {
    const alpha = 1 - ep / nEpochs;
    for (let e = 0; e < E; e += 1) {
      if (epochNext[e] > ep) continue;
      const j = H[e], k = T[e], cur = Y[j], oth = Y[k];
      let dx = cur[0] - oth[0], dy = cur[1] - oth[1], d = dx * dx + dy * dy;
      if (d > 0) {
        const g = (-2 * a * b * d ** (b - 1)) / (a * d ** b + 1);
        const gx = clip(g * dx) * alpha, gy = clip(g * dy) * alpha;
        cur[0] += gx; cur[1] += gy; oth[0] -= gx; oth[1] -= gy;
      }
      epochNext[e] += eps[e];
      const nNeg = Math.floor((ep - epochNextNeg[e]) / epsNeg[e]);
      for (let p = 0; p < nNeg; p += 1) {
        const m = Math.floor(rng.next() * n);
        if (m === j) continue;
        const o = Y[m];
        dx = cur[0] - o[0]; dy = cur[1] - o[1]; d = dx * dx + dy * dy;
        if (d > 0) {
          const g = (2 * b) / ((0.001 + d) * (a * d ** b + 1));
          cur[0] += clip(g * dx) * alpha; cur[1] += clip(g * dy) * alpha;
        } else { cur[0] += 4 * alpha; cur[1] += 4 * alpha; }
      }
      epochNextNeg[e] += nNeg * epsNeg[e];
    }
  }
  return { Y, mu, a, b, edges: E };
}

function pcaInit(P, rng) {
  const n = P.length, D = P[0].length;
  const m = new Float64Array(D); P.forEach((p) => p.forEach((v, d) => { m[d] += v / n; }));
  const X = P.map((p) => p.map((v, d) => v - m[d]));
  const dot = (u, v) => { let s = 0; for (let i = 0; i < u.length; i += 1) s += u[i] * v[i]; return s; };
  let V = [0, 1].map(() => Array.from({ length: D }, () => rng.normal()));
  for (let it = 0; it < 60; it += 1) {
    V = V.map((v) => { const u = X.map((x) => dot(x, v)); const r = new Array(D).fill(0); X.forEach((x, i) => { for (let t = 0; t < D; t += 1) r[t] += x[t] * u[i]; }); return r; });
    for (let i = 0; i < 2; i += 1) { for (let j = 0; j < i; j += 1) { const d = dot(V[i], V[j]); V[i] = V[i].map((v, t) => v - d * V[j][t]); } const nn = Math.sqrt(dot(V[i], V[i])); V[i] = V[i].map((v) => v / nn); }
  }
  const Y = X.map((x) => [dot(x, V[0]), dot(x, V[1])]);
  let mx = 0; Y.forEach((p) => { mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1])); });
  /* umap-learn's noisy_scale_coords: to ±10, plus noise of 1e-4 */
  return Y.map((p) => [(10 * p[0]) / mx + rng.normal() * 1e-4, (10 * p[1]) / mx + rng.normal() * 1e-4]);
}
