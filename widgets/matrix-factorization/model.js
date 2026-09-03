/* ============================================================================
   The stage and the two decompositions for widget 41 `matrix-factorization`.

   A SIBLING MODULE, not part of main.js, because the mock-up that preceded this
   widget built its own copy of the stage and quietly disagreed with the
   measurement it was drawn to illustrate. Anything that reasons about these
   numbers — the node driver, a lab page — imports THIS file, so there is one
   stage and one solver and they cannot drift apart.

   `widgets/kmeans/model.js` is the precedent.
   ========================================================================= */

/* --- the stage -------------------------------------------------------------
   Small enough that every gene and every sample is a row and a column the
   reader can point at. Measured across 12 x 8 to 30 x 16: the seed behaves the
   same throughout, so the size is a legibility choice and nothing rests on it. */
export const GENES = 24;
export const SAMPLES = 12;

/* Snapshots of the descent, dense early. Multiplicative updates move most of
   the way in the first handful of iterations and then crawl, so a linear
   schedule spends nineteen of twenty steps showing nothing move. */
export const SCHEDULE = [0, 1, 2, 3, 5, 7, 10, 14, 20, 28, 40, 56, 80, 115, 165, 240, 350];

/* ---------------------------------------------------------------- utilities */

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const col = (M, k) => M.map((row) => row[k]);

export function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}

/* Worst agreement between two sets of columns, over the best pairing of them.
   Greedy: NMF fixes no order, so comparing column 1 with column 1 would report
   a relabelling as a disagreement. `n` caps the comparison at the smaller of
   the two, so a rank-5 fit can still be scored against three real patterns. */
/* `abs` because an EIGENVECTOR HAS NO SIGN: a PCA component and its negative
   are the same direction, so scoring one against a true pattern on the raw
   cosine would call the same match perfect or catastrophic depending on which
   way the sign convention happened to point it. NMF's columns cannot be
   negative, so there the raw cosine is the honest one. */
export function agreement(Wa, Wb, n, abs = false) {
  const used = new Set();
  let worst = 1;
  for (let a = 0; a < n; a += 1) {
    let bestC = -1, bestB = -1;
    for (let b = 0; b < n; b += 1) {
      if (used.has(b)) continue;
      const raw = cosine(col(Wa, a), col(Wb, b));
      const c = abs ? Math.abs(raw) : raw;
      if (c > bestC) { bestC = c; bestB = b; }
    }
    if (bestB < 0) break;
    used.add(bestB);
    worst = Math.min(worst, bestC);
  }
  return worst;
}

/* --- the data --------------------------------------------------------------
   `programmes` patterns, each owning a contiguous block of genes, plus a shared
   tail every sample carries. Contiguous only so a block is visible in a
   heatmap: neither method knows the row order, and shuffling the genes changes
   the picture and not one number.

   The noise is MULTIPLICATIVE. Additive Gaussian noise would put minus signs
   into a matrix whose whole premise is that it has none. */
export function makeStage(programmes, rng) {
  const K = programmes;
  const block = Math.floor(GENES / (K + 1));
  const Wtrue = Array.from({ length: GENES }, (_, g) => {
    const owner = Math.floor(g / block);
    return Array.from({ length: K }, (_, k) => {
      if (owner >= K) return 1.5;                                  /* shared tail */
      return owner === k
        ? Math.max(0.1, 6 * (1 + 0.35 * rng.normal(0, 1)))
        : Math.max(0.05, 0.6 * (1 + 0.35 * rng.normal(0, 1)));
    });
  });

  const per = Math.ceil(SAMPLES / K);
  const Htrue = Array.from({ length: K }, () => []);
  const label = [];
  for (let j = 0; j < SAMPLES; j += 1) {
    const grp = Math.min(K - 1, Math.floor(j / per));
    label.push(grp);
    for (let k = 0; k < K; k += 1) {
      Htrue[k].push(Math.max(0.02, k === grp
        ? 1 + 0.25 * rng.normal(0, 1)
        : 0.30 + 0.12 * Math.abs(rng.normal(0, 1))));
    }
  }

  const V = Array.from({ length: GENES }, (_, g) =>
    Array.from({ length: SAMPLES }, (_, j) => {
      let mu = 0;
      for (let k = 0; k < K; k += 1) mu += Wtrue[g][k] * Htrue[k][j];
      return Math.max(0, mu * Math.exp(0.18 * rng.normal(0, 1)));
    }));

  return { V, Wtrue, Htrue, label, block };
}

/* --- the two objectives ----------------------------------------------------
   Frobenius is Lee and Seung's original and the update every textbook derives.
   KL is `brunet`, the default in R's NMF package. On count data the two give
   visibly different answers, so which one is running is worth a control rather
   than a silent choice. */
export function updateFrobenius(V, W, H, r) {
  const m = V.length, n = V[0].length, eps = 1e-10;

  const WtV = Array.from({ length: r }, () => new Float64Array(n));
  const WtW = Array.from({ length: r }, () => new Float64Array(r));
  for (let i = 0; i < m; i += 1) {
    for (let k = 0; k < r; k += 1) {
      const w = W[i][k];
      if (w) for (let j = 0; j < n; j += 1) WtV[k][j] += w * V[i][j];
      for (let l = 0; l < r; l += 1) WtW[k][l] += w * W[i][l];
    }
  }
  for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) {
    let d = 0;
    for (let l = 0; l < r; l += 1) d += WtW[k][l] * H[l][j];
    H[k][j] *= WtV[k][j] / (d + eps);
  }

  const HHt = Array.from({ length: r }, () => new Float64Array(r));
  for (let k = 0; k < r; k += 1) for (let l = 0; l < r; l += 1)
    for (let j = 0; j < n; j += 1) HHt[k][l] += H[k][j] * H[l][j];
  for (let i = 0; i < m; i += 1) {
    const vh = new Float64Array(r);
    for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) vh[k] += V[i][j] * H[k][j];
    for (let k = 0; k < r; k += 1) {
      let d = 0;
      for (let l = 0; l < r; l += 1) d += W[i][l] * HHt[l][k];
      W[i][k] *= vh[k] / (d + eps);
    }
  }
}

export function updateKL(V, W, H, r) {
  const m = V.length, n = V[0].length, eps = 1e-10;
  const recon = () => Array.from({ length: m }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j += 1) {
      let p = 0;
      for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j];
      row[j] = p + eps;
    }
    return row;
  });

  let P = recon();
  const wSum = new Float64Array(r);
  for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) wSum[k] += W[i][k];
  for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) {
    let acc = 0;
    for (let i = 0; i < m; i += 1) acc += W[i][k] * (V[i][j] / P[i][j]);
    H[k][j] *= acc / (wSum[k] + eps);
  }

  P = recon();
  const hSum = new Float64Array(r);
  for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) hSum[k] += H[k][j];
  for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) {
    let acc = 0;
    for (let j = 0; j < n; j += 1) acc += H[k][j] * (V[i][j] / P[i][j]);
    W[i][k] *= acc / (hSum[k] + eps);
  }
}

export function relResidual(V, W, H, r) {
  let ss = 0, tot = 0;
  for (let i = 0; i < V.length; i += 1) for (let j = 0; j < V[0].length; j += 1) {
    let p = 0;
    for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j];
    ss += (V[i][j] - p) ** 2;
    tot += V[i][j] ** 2;
  }
  return Math.sqrt(ss / tot);
}

/* W*D and D^-1*H fit identically for any positive diagonal D, so the raw
   numbers mean nothing on their own: a solver can leave W near 400000 and H
   near 0.002 and that split is an artifact of where it stopped. Scaling each
   column to sum to one puts every start on one axis.

   THE ORDER IS THIS CODE'S CHOICE AND NOT NMF'S. Columns are sorted by how much
   of the matrix each carries; without it the same two arrive labelled 1,2 or
   2,1 at random and every comparison between starts would report a relabelling
   as a difference. The figure says so, because the code must not quietly supply
   an ordering the widget is telling the reader NMF does not have. */
export function normalise(W, H, r) {
  const Wn = W.map((row) => row.slice());
  const Hn = H.map((row) => row.slice());
  const mass = [];
  for (let k = 0; k < r; k += 1) {
    let s = 0;
    for (let i = 0; i < GENES; i += 1) s += Wn[i][k];
    if (s) {
      for (let i = 0; i < GENES; i += 1) Wn[i][k] /= s;
      for (let j = 0; j < SAMPLES; j += 1) Hn[k][j] *= s;
    }
    let t = 0;
    for (let j = 0; j < SAMPLES; j += 1) t += Hn[k][j];
    mass.push(t);
  }
  const order = [...mass.keys()].sort((a, b) => mass[b] - mass[a]);
  return {
    W: Wn.map((row) => order.map((k) => row[k])),
    H: order.map((k) => Hn[k]),
  };
}

/* The whole descent, snapshotted on SCHEDULE. Computed once per parameter
   change; the animation only reveals more of it (invariant 2). */
export function fitTrace(V, r, start, algorithm, rng) {
  let tot = 0;
  for (const row of V) for (const v of row) tot += v;
  const mean = Math.sqrt((tot / (GENES * SAMPLES)) / r);
  const W = Array.from({ length: GENES }, () =>
    Array.from({ length: r }, () => (rng.next() + 0.1) * mean));
  const H = Array.from({ length: r }, () =>
    Array.from({ length: SAMPLES }, () => (rng.next() + 0.1) * mean));

  const step = algorithm === "kl" ? updateKL : updateFrobenius;
  const snaps = [];
  let done = 0;
  for (const target of SCHEDULE) {
    while (done < target) { step(V, W, H, r); done += 1; }
    const { W: Wn, H: Hn } = normalise(W, H, r);
    snaps.push({ W: Wn, H: Hn, rel: relResidual(V, W, H, r), iter: target });
  }
  return snaps;
}

/* --- PCA ------------------------------------------------------------------
   Centred, NOT scaled: scaling as well would put a second difference between
   the two tabs, and the comparison already carries one. */
/* `k` components rather than a fixed two, so the figure can show that the
   first ones are the SAME whether you asked for two or for six. It is one
   eigendecomposition either way; `k` only decides how much of the same answer
   is handed back, and that is the difference from NMF. */
export function pcaOf(V, k = 2) {
  const mu = V.map((row) => row.reduce((s, v) => s + v, 0) / SAMPLES);
  const Z = V.map((row, i) => row.map((v) => v - mu[i]));
  const G = Array.from({ length: SAMPLES }, () => new Float64Array(SAMPLES));
  for (let i = 0; i < GENES; i += 1)
    for (let a = 0; a < SAMPLES; a += 1)
      for (let b = 0; b < SAMPLES; b += 1) G[a][b] += Z[i][a] * Z[i][b];

  /* Cyclic Jacobi: exact for a symmetric matrix and independent of any starting
     vector, which power iteration is not. Widget 19 uses the same routine. */
  const A = G.map((r) => Array.from(r));
  const Vv = Array.from({ length: SAMPLES }, (_, i) =>
    Array.from({ length: SAMPLES }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let i = 0; i < SAMPLES; i += 1)
      for (let j = i + 1; j < SAMPLES; j += 1) off += A[i][j] ** 2;
    if (off < 1e-20) break;
    for (let p = 0; p < SAMPLES; p += 1) for (let q = p + 1; q < SAMPLES; q += 1) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < SAMPLES; k += 1) {
        const kp = A[k][p], kq = A[k][q];
        A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq;
      }
      for (let k = 0; k < SAMPLES; k += 1) {
        const pk = A[p][k], qk = A[q][k];
        A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk;
      }
      for (let k = 0; k < SAMPLES; k += 1) {
        const kp = Vv[k][p], kq = Vv[k][q];
        Vv[k][p] = c * kp - s * kq; Vv[k][q] = s * kp + c * kq;
      }
    }
  }
  const order = [...Array(SAMPLES).keys()].sort((a, b) => A[b][b] - A[a][a]);
  const total = order.reduce((s, i) => s + Math.max(0, A[i][i]), 0) || 1;
  return order.slice(0, Math.min(k, order.length)).map((i) => {
    const vec = Vv.map((r) => r[i]);
    const load = Z.map((row) => row.reduce((s, v, j) => s + v * vec[j], 0));
    /* An eigenvector has no sign, so it is pinned by its largest loading — the
       same convention sklearn's svd_flip uses. Without it the picture mirrors
       itself between seeds and a shared link does not reproduce. */
    let big = 0;
    for (let g = 1; g < GENES; g += 1) if (Math.abs(load[g]) > Math.abs(load[big])) big = g;
    const sgn = load[big] < 0 ? -1 : 1;
    return {
      share: Math.max(0, A[i][i]) / total,
      /* `load` is Z·v, so its norm is the singular value; `vec` is the UNIT
         sample-space eigenvector. The rank-1 piece of Z is load × vecᵀ, and it
         is `vec` — not `scores` — that belongs in the factorization: `scores`
         is `vec` scaled by the singular value a second time, so load × scoresᵀ
         overshoots by exactly that factor. It did, and the relative residual
         came out near 19 and RISING with k before this was pinned down.
         `scores` is kept because it is what a PCA scatter plots. */
      load: load.map((v) => v * sgn),
      vec: vec.map((v) => v * sgn),
      scores: vec.map((v) => v * Math.sqrt(Math.max(0, A[i][i])) * sgn),
    };
  });
}


/* --- PCA, as a factorization of the same shape -----------------------------
   `Z ≈ L × S`: L is genes x k, S is k x samples. Exactly NMF's shapes.

   Z, NOT V. PCA centres, so it does not factorise the measurements; it
   factorises what is left after each gene's mean is taken out. NMF factorises
   the matrix itself and cannot centre, there being no negative numbers in it.
   Scoring L x S against V gave a relative residual of 6.8 that ROSE with k,
   because it compared a centred reconstruction with an uncentred matrix. The
   centred matrix is what the PCA tab draws, labelled so.

   ONE SNAPSHOT, NOT SEVENTEEN. NMF has no closed form and its trace is the
   descent; PCA is one eigendecomposition and there is nothing to iterate. The
   two traces have different lengths ON PURPOSE, and the readout reports that
   difference. Giving PCA a fake seventeen-step reveal would animate nothing. */
export function pcaTrace(V, k) {
  const pcs = pcaOf(V, k);
  const n = Math.min(k, pcs.length);
  const mu = V.map((row) => row.reduce((a, b) => a + b, 0) / SAMPLES);
  const Z = V.map((row, g) => row.map((v) => v - mu[g]));
  const L = Array.from({ length: GENES }, (_, g) => pcs.slice(0, n).map((p) => p.load[g]));
  const S = pcs.slice(0, n).map((p) => p.vec);
  return [{ W: L, H: S, Z, pcs, rel: relResidual(Z, L, S, n), iter: 1 }];
}
