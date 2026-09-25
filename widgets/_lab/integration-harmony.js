/* _lab/integration-harmony.js — Harmony (Korsunsky 2019) on slot 80's 2-D
 * stage, for the mock and its measurement (integration-harmony-measure.mjs).
 *
 *   - soft k-means: R[i][k] ∝ exp(-|z_i - c_k|² / σ) · ((E_kb + 1)/(O_kb + 1))^θ,
 *     O the batch's soft count in the cluster, E what it would be if the
 *     cluster held each batch in the data's overall proportion; updated a
 *     block of cells at a time, as the package does
 *   - correction (mixture of experts): per cluster, a ridge fit (λ) of the
 *     ORIGINAL embedding on batch; each cell loses its batch's term, weighted
 *     by R; clustering then reruns on the corrected embedding
 * The cosine normalisation is left out: in two dimensions it would put every
 * cell on the unit circle. σ is in the stage's squared distance.
 */
import { KEYS } from "../integration/engine.js";

export function harmony2d(cells, keyName, rng, { K = 12, theta = 2, sigma = 0.1, lambda = 1, rounds = 5, inner = 10, trace = false } = {}) {
  const b = cells.map(KEYS[keyName].of);
  const n = cells.length, nb = 2;
  const Z0 = cells.map((c) => [c.x, c.y]);
  const Nb = [0, 1].map((v) => b.filter((x) => x === v).length);
  let Z = Z0.map((p) => p.slice());
  let C = null, R = null;
  const d2 = (a, c) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2;
  const history = [];
  for (let round = 0; round < rounds; round += 1) {
    if (!C) { // k-means++ seeding on the uncorrected cells
      C = [Z[Math.floor(rng.next() * n)].slice()];
      while (C.length < K) {
        const dd = Z.map((z) => Math.min(...C.map((c) => d2(z, c))));
        let u = rng.next() * dd.reduce((s, v) => s + v, 0), i = 0;
        while (u > dd[i] && i < n - 1) { u -= dd[i]; i += 1; }
        C.push(Z[i].slice());
      }
    }
    R = Z.map((z) => { const r = C.map((c) => Math.exp(-d2(z, c) / sigma)); const s = r.reduce((a, v) => a + v, 0) || 1; return r.map((v) => v / s); });
    const O = C.map(() => [0, 0]);
    for (let i = 0; i < n; i += 1) for (let k = 0; k < K; k += 1) O[k][b[i]] += R[i][k];
    const idx = [...Array(n).keys()];
    for (let it = 0; it < inner; it += 1) {
      C = C.map((_, k) => { let w = 0, x = 0, y = 0; for (let i = 0; i < n; i += 1) { w += R[i][k]; x += R[i][k] * Z[i][0]; y += R[i][k] * Z[i][1]; } return w > 1e-9 ? [x / w, y / w] : C[k]; });
      for (let t = n - 1; t > 0; t -= 1) { const s = Math.floor(rng.next() * (t + 1)); [idx[t], idx[s]] = [idx[s], idx[t]]; }
      const block = Math.max(1, Math.floor(n * 0.05));
      for (let st = 0; st < n; st += block) {
        const cs = idx.slice(st, st + block);
        for (const i of cs) for (let k = 0; k < K; k += 1) O[k][b[i]] -= R[i][k];
        const E = O.map((o) => { const tot = o[0] + o[1] + cs.length / K; return Nb.map((m) => (tot * m) / n); });
        for (const i of cs) {
          let s = 0;
          for (let k = 0; k < K; k += 1) { R[i][k] = Math.exp(-d2(Z[i], C[k]) / sigma) * Math.pow((E[k][b[i]] + 1) / (Math.max(0, O[k][b[i]]) + 1), theta); s += R[i][k]; }
          s = s || 1;
          for (let k = 0; k < K; k += 1) { R[i][k] /= s; O[k][b[i]] += R[i][k]; }
        }
      }
    }
    // mixture of experts on the ORIGINAL embedding
    const beta = C.map(() => [[0, 0], [0, 0]]), mid = C.map(() => [0, 0]), bc = C.map(() => [[NaN, NaN], [NaN, NaN]]);
    const corr = Z0.map(() => [0, 0]);
    for (let k = 0; k < K; k += 1) {
      const w = [0, 0], s = [[0, 0], [0, 0]];
      for (let i = 0; i < n; i += 1) { const r = R[i][k]; w[b[i]] += r; s[b[i]][0] += r * Z0[i][0]; s[b[i]][1] += r * Z0[i][1]; }
      const W = w[0] + w[1];
      if (W < 1e-9) continue;
      const mu = [(s[0][0] + s[1][0]) / W, (s[0][1] + s[1][1]) / W];
      mid[k] = mu;
      for (let v = 0; v < nb; v += 1) {
        if (w[v] < 1e-9) continue;
        bc[k][v] = [s[v][0] / w[v], s[v][1] / w[v]];
        beta[k][v] = [(s[v][0] - w[v] * mu[0]) / (w[v] + lambda), (s[v][1] - w[v] * mu[1]) / (w[v] + lambda)];
      }
    }
    for (let i = 0; i < n; i += 1) for (let k = 0; k < K; k += 1) { corr[i][0] += R[i][k] * beta[k][b[i]][0]; corr[i][1] += R[i][k] * beta[k][b[i]][1]; }
    const before = Z;
    Z = Z0.map((p, i) => [p[0] - corr[i][0], p[1] - corr[i][1]]);
    if (trace) {
      /* the same weighted centres in the space the cells are DRAWN in this
         round (`before`): the fit uses the original embedding, so from
         round 2 these arrows are the residual the round removes */
      const cur = C.map((_, k) => { const w = [0, 0], s = [[0, 0], [0, 0]]; for (let i = 0; i < n; i += 1) { const r = R[i][k]; w[b[i]] += r; s[b[i]][0] += r * before[i][0]; s[b[i]][1] += r * before[i][1]; } const W = w[0] + w[1]; return { w, W, mid: W > 1e-9 ? [(s[0][0] + s[1][0]) / W, (s[0][1] + s[1][1]) / W] : null, bc: [0, 1].map((v) => (w[v] > 1e-9 ? [s[v][0] / w[v], s[v][1] / w[v]] : null)) }; });
      history.push({ C: C.map((c) => c.slice()), R: R.map((r) => r.slice()), mid, bc, cur, before, after: Z });
    }
    const moved = Math.sqrt(Z.reduce((s, z, i) => s + d2(z, before[i]), 0) / n);
    if (trace) history[history.length - 1].moved = moved;
  }
  return { batch: b, raw: Z0, corrected: Z, R, C, history };
}
