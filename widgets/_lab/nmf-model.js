/* ============================================================================
   The stage and the two decompositions for slot 2 `nmf` (PHM5003 05/04 `## 2`).

   Shared by `_lab/nmf-mock.html` (drawn) and `_lab/nmf-sim.mjs` (printed), so
   every number in a mock caption is one a script can reprint.

   THE STAGE IS SIMULATED AND ITS TRUTH IS KNOWN, which the lesson's own stage
   is not: the airway matrix has no answer key, so "did NMF find the parts"
   cannot be asked of it. Here two gene programmes are built by hand, every
   sample is a non-negative mix of them plus noise, and W can be scored.

   Counts, not z-scores. NMF needs a non-negative matrix and that is not a
   detail: it is the whole reason its parts add rather than cancel.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* ---------------------------------------------------------------- the stage */

/* Two programmes over `genes` genes. Each owns a contiguous block — contiguous
   only so the reader can see a block in a heatmap; nothing in NMF knows the
   order. A third block is shared, and it is the honest part of the picture:
   real programmes overlap, and a shared block is what stops the two parts from
   being trivially separable. */
export function makeStage({
  genes = 24, samples = 12, groups = 2, share = 0.25,
  noise = 0.18, base = 6, seed = 1,
} = {}) {
  const rng = makeRng(seed);
  const block = Math.floor(genes / 3);

  /* W_true: genes x 2, non-negative by construction. */
  const Wt = Array.from({ length: genes }, (_, g) => {
    const inA = g < block, inB = g >= block && g < 2 * block;
    const hi = base * (1 + 0.35 * rng.normal(0, 1));
    const lo = base * share * (1 + 0.35 * rng.normal(0, 1));
    if (inA) return [Math.max(0.1, hi), Math.max(0.05, lo * 0.4)];
    if (inB) return [Math.max(0.05, lo * 0.4), Math.max(0.1, hi)];
    return [Math.max(0.1, base * share), Math.max(0.1, base * share)];  /* shared */
  });

  /* H_true: 2 x samples. Half the samples run on programme 1, half on
     programme 2, and every sample carries some of both. */
  const per = Math.ceil(samples / groups);
  const Ht = [[], []];
  const label = [];
  for (let j = 0; j < samples; j += 1) {
    const grp = Math.min(groups - 1, Math.floor(j / per));
    label.push(grp);
    const strong = 1 + 0.25 * rng.normal(0, 1);
    const weak = 0.30 + 0.12 * Math.abs(rng.normal(0, 1));
    Ht[0].push(Math.max(0.02, grp === 0 ? strong : weak));
    Ht[1].push(Math.max(0.02, grp === 0 ? weak : strong));
  }

  /* V = W_true H_true, then multiplicative noise so it stays non-negative.
     Additive Gaussian noise would put minus signs in a matrix whose whole
     premise is that it has none. */
  const V = Array.from({ length: genes }, (_, g) =>
    Array.from({ length: samples }, (_, j) => {
      const mu = Wt[g][0] * Ht[0][j] + Wt[g][1] * Ht[1][j];
      return Math.max(0, mu * Math.exp(noise * rng.normal(0, 1)));
    }));

  return { V, Wtrue: Wt, Htrue: Ht, label, genes, samples, block };
}

/* A stage with K true programmes rather than two, each owning its own block of
   genes. `makeStage` above is the K = 2 case with the shared block spelled out;
   this one is what the rank measurements need.

   IT MUST BE THE ONE GENERATOR BOTH THE PROBE AND THE MOCK USE. The mock first
   improvised a six-programme stage by summing three two-programme ones, and
   because those three share a block layout the sum has a true rank nearer 2
   than 6 — so the page showed a cliff at rank 3 that the probe's monotone
   slide does not have. A mock that computes its own stage is a mock that can
   disagree with the measurement it is illustrating. */
export function makeStageK({
  genes = 30, samples = 16, K = 6, noise = 0.18, base = 6, share = 0.25, seed = 1,
} = {}) {
  const rng = makeRng(seed);
  const block = Math.floor(genes / (K + 1));
  const Wt = Array.from({ length: genes }, (_, g) => {
    const owner = Math.floor(g / block);
    return Array.from({ length: K }, (_, k) => {
      if (owner >= K) return Math.max(0.1, base * share);          /* shared tail */
      return owner === k
        ? Math.max(0.1, base * (1 + 0.35 * rng.normal(0, 1)))
        : Math.max(0.05, base * share * 0.4 * (1 + 0.35 * rng.normal(0, 1)));
    });
  });
  const per = Math.ceil(samples / K);
  const Ht = Array.from({ length: K }, () => []);
  const label = [];
  for (let j = 0; j < samples; j += 1) {
    const grp = Math.min(K - 1, Math.floor(j / per));
    label.push(grp < 1 ? 0 : 1);          /* the two groups the reader is told about */
    for (let k = 0; k < K; k += 1)
      Ht[k].push(Math.max(0.02, k === grp
        ? 1 + 0.25 * rng.normal(0, 1)
        : 0.30 + 0.12 * Math.abs(rng.normal(0, 1))));
  }
  const V = Array.from({ length: genes }, (_, g) =>
    Array.from({ length: samples }, (_, j) => {
      let mu = 0; for (let k = 0; k < K; k += 1) mu += Wt[g][k] * Ht[k][j];
      return Math.max(0, mu * Math.exp(noise * rng.normal(0, 1)));
    }));
  return { V, Wtrue: Wt, label, genes, samples, block, K };
}

/* Worst agreement between two fitted W's, over the best pairing of their parts.
   Greedy pairing: enough for a spread statistic, and the same rule everywhere
   so the probe and the mock cannot disagree by using different ones. */
export function partAgreement(Wa, Wb, rank) {
  const used = new Set();
  let mn = 1;
  for (let a = 0; a < rank; a += 1) {
    let bestC = -1, bestB = -1;
    for (let b = 0; b < rank; b += 1) {
      if (used.has(b)) continue;
      const c = cosine(col(Wa, a), col(Wb, b));
      if (c > bestC) { bestC = c; bestB = b; }
    }
    used.add(bestB); mn = Math.min(mn, bestC);
  }
  return mn;
}

/* --------------------------------------------------------------------- NMF */

/* Lee and Seung multiplicative updates on the Frobenius norm. `iters` is a
   parameter and not a constant because the widget may animate the descent: the
   picture at iteration 12 is a real state of the algorithm, not a tween. */
export function nmf(V, r, seed, iters = 400) {
  const m = V.length, n = V[0].length, rng = makeRng(seed);
  let tot = 0;
  for (const row of V) for (const v of row) tot += v;
  const mean = Math.sqrt((tot / (m * n)) / r);
  const W = Array.from({ length: m }, () => Array.from({ length: r }, () => (rng.next() + 0.1) * mean));
  const H = Array.from({ length: r }, () => Array.from({ length: n }, () => (rng.next() + 0.1) * mean));
  const eps = 1e-10;
  const trace = [];
  for (let it = 0; it < iters; it += 1) {
    const WtV = Array.from({ length: r }, () => new Float64Array(n));
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) {
      const w = W[i][k]; if (!w) continue;
      for (let j = 0; j < n; j += 1) WtV[k][j] += w * V[i][j];
    }
    const WtW = Array.from({ length: r }, () => new Float64Array(r));
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1)
      for (let l = 0; l < r; l += 1) WtW[k][l] += W[i][k] * W[i][l];
    for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) {
      let d = 0; for (let l = 0; l < r; l += 1) d += WtW[k][l] * H[l][j];
      H[k][j] *= WtV[k][j] / (d + eps);
    }
    const HHt = Array.from({ length: r }, () => new Float64Array(r));
    for (let k = 0; k < r; k += 1) for (let l = 0; l < r; l += 1)
      for (let j = 0; j < n; j += 1) HHt[k][l] += H[k][j] * H[l][j];
    for (let i = 0; i < m; i += 1) {
      const vh = new Float64Array(r);
      for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) vh[k] += V[i][j] * H[k][j];
      for (let k = 0; k < r; k += 1) {
        let d = 0; for (let l = 0; l < r; l += 1) d += W[i][l] * HHt[l][k];
        W[i][k] *= vh[k] / (d + eps);
      }
    }
    trace.push(relResidual(V, W, H));
  }
  return normalise(W, H, trace);
}

export function relResidual(V, W, H) {
  const m = V.length, n = V[0].length, r = H.length;
  let ss = 0, tot = 0;
  for (let i = 0; i < m; i += 1) for (let j = 0; j < n; j += 1) {
    let p = 0; for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j];
    ss += (V[i][j] - p) ** 2; tot += V[i][j] ** 2;
  }
  return Math.sqrt(ss / tot);
}

/* W*D and D^-1*H fit identically for any positive diagonal D, so the raw
   numbers are not comparable between runs — the lesson's own printout has W
   near 400000 and H near 0.002 and that split means nothing. Scaling each part
   to sum to one puts every run on the same axis. Parts are then ordered by how
   much of the matrix each explains, which is a CHOICE this code makes and NMF
   does not: without it the same two parts arrive labelled 1,2 or 2,1 at random.
   THE WIDGET SHOULD SAY SO — ordering is one of the four properties NMF is
   claimed here not to have, so the code must not quietly supply it. */
export function normalise(W, H, trace) {
  const r = H.length, m = W.length, n = H[0].length;
  const Wn = W.map((row) => row.slice()), Hn = H.map((row) => row.slice());
  const mass = [];
  for (let k = 0; k < r; k += 1) {
    let s = 0; for (let i = 0; i < m; i += 1) s += Wn[i][k];
    if (s) { for (let i = 0; i < m; i += 1) Wn[i][k] /= s; for (let j = 0; j < n; j += 1) Hn[k][j] *= s; }
    let t = 0; for (let j = 0; j < n; j += 1) t += Hn[k][j];
    mass.push(t);
  }
  const order = [...mass.keys()].sort((a, b) => mass[b] - mass[a]);
  return {
    W: Wn.map((row) => order.map((k) => row[k])),
    H: order.map((k) => Hn[k]),
    trace,
  };
}

/* --------------------------------------------------------------------- PCA */

/* prcomp on the samples, centred. NOT scaled: the lesson scales, but scaling
   here would make the PCA and the NMF read different matrices and the whole
   comparison would be between two preprocessings rather than two methods. */
export function pca(V, center = true) {
  const m = V.length, n = V[0].length;
  const mu = V.map((row) => (center ? row.reduce((s, v) => s + v, 0) / n : 0));
  const Z = V.map((row, i) => row.map((v) => v - mu[i]));
  const G = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < m; i += 1)
    for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) G[a][b] += Z[i][a] * Z[i][b];
  const eig = jacobi(G);
  const tot = eig.reduce((s, e) => s + Math.max(0, e.val), 0) || 1;
  return eig.map((e) => {
    const scores = e.vec.map((v) => v * Math.sqrt(Math.max(0, e.val)));
    /* the gene-space loading, sign-pinned the way sklearn svd_flip does */
    const load = Z.map((row) => row.reduce((s, v, j) => s + v * e.vec[j], 0));
    let big = 0; for (let i = 1; i < m; i += 1) if (Math.abs(load[i]) > Math.abs(load[big])) big = i;
    const sgn = load[big] < 0 ? -1 : 1;
    return {
      share: Math.max(0, e.val) / tot,
      scores: scores.map((v) => v * sgn),
      load: load.map((v) => v * sgn),
    };
  });
}

export function jacobi(Ain) {
  const n = Ain.length, A = Ain.map((r) => Array.from(r));
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) off += A[i][j] ** 2;
    if (off < 1e-20) break;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k += 1) { const kp = A[k][p], kq = A[k][q]; A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k += 1) { const pk = A[p][k], qk = A[q][k]; A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk; }
      for (let k = 0; k < n; k += 1) { const kp = V[k][p], kq = V[k][q]; V[k][p] = c * kp - s * kq; V[k][q] = s * kp + c * kq; }
    }
  }
  return [...Array(n).keys()].sort((a, b) => A[b][b] - A[a][a])
    .map((i) => ({ val: A[i][i], vec: V.map((r) => r[i]) }));
}

/* ------------------------------------------------------------------ scoring */

export const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};
export const col = (W, k) => W.map((row) => row[k]);

/* How well a fitted W matches the truth, allowing for the part order NMF does
   not fix. Returns the WORSE of the two matched parts, so one good part cannot
   carry a bad one. */
export function matchTruth(W, Wtrue) {
  const same = Math.min(cosine(col(W, 0), col(Wtrue, 0)), cosine(col(W, 1), col(Wtrue, 1)));
  const swap = Math.min(cosine(col(W, 0), col(Wtrue, 1)), cosine(col(W, 1), col(Wtrue, 0)));
  return { score: Math.max(same, swap), swapped: swap > same };
}

/* Separation of the two sample groups along one row of H, in pooled SDs. */
export function groupSep(vals, label) {
  const a = vals.filter((_, j) => label[j] === 0), b = vals.filter((_, j) => label[j] === 1);
  if (!a.length || !b.length) return 0;
  const mu = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  const vr = (x) => (x.length < 2 ? 0 : x.reduce((s, v) => s + (v - mu(x)) ** 2, 0) / (x.length - 1));
  const pooled = Math.sqrt((vr(a) + vr(b)) / 2) || 1e-9;
  return (mu(b) - mu(a)) / pooled;
}
