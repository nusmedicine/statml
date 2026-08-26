/* ============================================================================
   UMAP, at the scale a widget uses. NOT DEPLOYED — this is the planning
   prototype for widget 22, kept because every number in docs/catalogue.md
   § NEXT · UMAP came out of it, and because it is what that widget's
   compute() should be.

   WHY THIS EXISTS RATHER THAN A REPLAY TABLE. The catalogue's standing
   question was whether UMAP has to precompute; the old reconnaissance called a
   replay "likely the only honest option". It is not. 500 iterations at n = 48
   cost single-digit milliseconds here, which compute() can afford on a
   parameter change — and a replayed table could not have honoured a live
   `n_neighbors` slider, which is one of the two controls the lesson names.

   THE THREE STEPS ARE THE NOTEBOOK'S OWN, cell 46 of PHM5003 `05 / 04`:

     1. the fuzzy membership in high dimensions,
        mu(xi,xj) = exp(-max(0, d(xi,xj) - rho_i) / sigma_i), with rho_i the
        distance to i's nearest neighbour. That subtraction is the piece t-SNE
        has no counterpart for: it guarantees every point is joined to
        something, which is why UMAP does not care how dense a region is.
        sigma_i is bisected so the row sums to log2(k) — the same shape as
        t-SNE's perplexity bisection, and `n_neighbors` is what sets the
        target.
     2. the low-dimensional membership 1 / (1 + a d^2b), with a and b FITTED
        from `min_dist` rather than fixed. t-SNE's Student-t has no free
        parameter at all.
     3. CROSS-ENTROPY, not KL. KL is one-sided: it pays for pulling a true
        neighbour apart and is credited for drawing a stranger close. The
        cross-entropy carries both terms, so UMAP pays for putting strangers
        together too — and that is the mechanism behind it spreading clusters
        further than t-SNE does.

   WHERE THIS DEPARTS FROM `umap-learn`, DELIBERATELY AND MEASURED. The library
   optimises by stochastic edge sampling with 5 negative samples a step, which
   is an approximation built for n in the millions. At n = 48 the exact
   full-batch gradient over all 1128 pairs is affordable, so that is what runs
   here. Measured against the library on the library's own mu, eight seeds:
   5-NN retention 0.820 against 0.718, cluster tightness 0.085 against 0.093,
   silhouette 0.807 against 0.765 — the same picture, slightly better, because
   this is the objective the library approximates. It follows that the widget
   may say "this is UMAP's objective" and may NOT say "this is what umap-learn
   prints".

   The gradient is exact and worth writing down, because it is one line:

       C   = -SUM [ mu*log(w) + (1-mu)*log(1-w) ],  w = 1/(1 + a*s^b), s = d^2
       dC/ds = (b/s) * (mu - w)

   umap-checks.mjs runs the verifications; umap-measure.mjs runs the
   measurements the catalogue quotes; umap-verify.mjs compares this against
   umap-learn 0.5.12 through umap-ref.json. All three are node scripts, not
   pages.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* --- step 1: the fuzzy simplicial set ---------------------------------------

   `umap-learn`'s own constants, named so a reader can find them in its source:
   64 bisections, a tolerance of 1e-5 on the row sum, and a floor on sigma at
   1e-3 of the mean neighbour distance so a point whose neighbours are all at
   the same distance does not get sigma = 0. */
const SMOOTH_K_TOLERANCE = 1e-5;
const MIN_K_DIST_SCALE = 1e-3;

export function sqDists(X) {
  const n = X.length;
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < X[i].length; k += 1) { const d = X[i][k] - X[j][k]; s += d * d; }
      D[i][j] = s; D[j][i] = s;
    }
  return D;
}

/** The k nearest neighbours of each point, INCLUDING itself at distance 0 —
    which is what sklearn's NearestNeighbors hands the library, and the reason
    the bisection below skips column 0. */
export function knn(X, k) {
  const D = sqDists(X), n = X.length;
  const idx = [], dist = [];
  for (let i = 0; i < n; i += 1) {
    const order = Array.from({ length: n }, (_, j) => j)
      .sort((p, q) => D[i][p] - D[i][q] || p - q)
      .slice(0, k);
    idx.push(order);
    dist.push(order.map((j) => Math.sqrt(D[i][j])));
  }
  return { idx, dist };
}

/** rho_i and sigma_i. rho is the nearest NON-ZERO neighbour distance, sigma is
    bisected so SUM_j exp(-max(0, d_ij - rho_i)/sigma_i) hits log2(k). */
export function smoothKnnDist(dist, k) {
  const target = Math.log2(k);
  const n = dist.length;
  const rho = new Float64Array(n), sigma = new Float64Array(n);
  let meanAll = 0, count = 0;
  for (const row of dist) for (const d of row) { meanAll += d; count += 1; }
  meanAll /= count;

  for (let i = 0; i < n; i += 1) {
    const row = dist[i];
    const nz = row.filter((d) => d > 0);
    rho[i] = nz.length ? nz[0] : 0;

    let lo = 0, hi = Infinity, mid = 1;
    for (let it = 0; it < 64; it += 1) {
      let psum = 0;
      for (let j = 1; j < row.length; j += 1) {
        const d = row[j] - rho[i];
        psum += d > 0 ? Math.exp(-d / mid) : 1;
      }
      if (Math.abs(psum - target) < SMOOTH_K_TOLERANCE) break;
      if (psum > target) { hi = mid; mid = (lo + hi) / 2; }
      else { lo = mid; mid = hi === Infinity ? mid * 2 : (lo + hi) / 2; }
    }
    sigma[i] = mid;

    /* the floor, and it is relative to THIS point's neighbours when rho > 0
       and to the whole matrix otherwise — the library's own distinction. */
    const meanRow = row.reduce((s, d) => s + d, 0) / row.length;
    const floor = MIN_K_DIST_SCALE * (rho[i] > 0 ? meanRow : meanAll);
    if (sigma[i] < floor) sigma[i] = floor;
  }
  return { rho, sigma };
}

/** The symmetrised membership matrix: a fuzzy union, mu = A + A' - A.A'. */
export function fuzzySet(X, k) {
  const n = X.length;
  const { idx, dist } = knn(X, k);
  const { rho, sigma } = smoothKnnDist(dist, k);
  const A = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1)
    for (let c = 0; c < k; c += 1) {
      const j = idx[i][c];
      if (j === i) continue;
      const d = dist[i][c] - rho[i];
      A[i][j] = d <= 0 || sigma[i] === 0 ? 1 : Math.exp(-d / sigma[i]);
    }
  const mu = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) mu[i][j] = A[i][j] + A[j][i] - A[i][j] * A[j][i];
  return { mu, rho, sigma, idx, dist };
}

/* --- step 2: a and b, fitted from min_dist -----------------------------------

   The library fits 1/(1 + a x^2b) by least squares to the piecewise target
   psi(x) = 1 for x < min_dist, exp(-(x - min_dist)/spread) beyond it, sampled
   at 300 points over [0, 3*spread]. scipy does that with Levenberg-Marquardt;
   this is Gauss-Newton with a damping term, which is the same fit and about
   twenty lines. Checked against `umap.umap_.find_ab_params` — see
   umap-verify.mjs.

   A LOOKUP TABLE WOULD ALSO HAVE WORKED and was rejected: min_dist is a
   control, and tabulating it would quietly decide that only the tabulated
   values exist. */
export function findAbParams(spread = 1, minDist = 0.1) {
  const N = 300;
  const xs = new Float64Array(N), ys = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    const x = (3 * spread * i) / (N - 1);
    xs[i] = x;
    ys[i] = x < minDist ? 1 : Math.exp(-(x - minDist) / spread);
  }
  let a = 1, b = 1;
  for (let it = 0; it < 200; it += 1) {
    let h00 = 0, h01 = 0, h11 = 0, g0 = 0, g1 = 0, sse = 0;
    for (let i = 0; i < N; i += 1) {
      const x = xs[i];
      if (x === 0) continue;
      const p = a * x ** (2 * b), f = 1 / (1 + p), r = f - ys[i];
      const dfa = -(x ** (2 * b)) / (1 + p) ** 2;
      const dfb = -(2 * p * Math.log(x)) / (1 + p) ** 2;
      h00 += dfa * dfa; h01 += dfa * dfb; h11 += dfb * dfb;
      g0 += dfa * r; g1 += dfb * r; sse += r * r;
    }
    const lam = 1e-8 * (h00 + h11);
    const d = (h00 + lam) * (h11 + lam) - h01 * h01;
    if (!(Math.abs(d) > 0)) break;
    const da = -((h11 + lam) * g0 - h01 * g1) / d;
    const db = -(-h01 * g0 + (h00 + lam) * g1) / d;
    a += da; b += db;
    if (a < 1e-6) a = 1e-6;
    if (b < 1e-6) b = 1e-6;
    if (Math.abs(da) + Math.abs(db) < 1e-12) break;
    void sse;
  }
  return { a, b };
}

/* --- step 3: the descent ---------------------------------------------------- */

/** The cross-entropy itself, summed over unordered pairs. */
export function crossEntropy(mu, Y, a, b) {
  const n = Y.length;
  let c = 0;
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1) {
      const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
      const s = dx * dx + dy * dy + 1e-12;
      let w = 1 / (1 + a * s ** b);
      w = Math.min(1 - 1e-9, Math.max(1e-9, w));
      c -= mu[i][j] * Math.log(w) + (1 - mu[i][j]) * Math.log(1 - w);
    }
  return c;
}

/**
 * Full-batch exact gradient descent on the cross-entropy.
 *
 * `eta` 0.1 rather than the 1.0 a stochastic optimiser wants, and it is a
 * measured choice with a measured cost: at 1.0 the reported curve RISES on 208
 * of 499 steps, at 0.1 on 2 of 499. The price is a final cross-entropy of
 * 194.0 against 190.3 — two per cent — and a picture 0.02 looser on the
 * tightness measure. A chart of the objective that goes up two fifths of the
 * time teaches nothing about descent; see widget 20's stress-1 and widget 21's
 * KL for the same problem met twice before.
 *
 * `clip` is the library's own +-4 on the per-point step.
 */
export function umap(X, {
  nNeighbors = 15, minDist = 0.1, spread = 1, iters = 500,
  eta = 0.1, clip = 4, seed = 1, mu: given = null, ab = null,
} = {}) {
  const n = X.length;
  const k = Math.max(2, Math.min(nNeighbors, n - 1));
  const set = given ? { mu: given } : fuzzySet(X, k);
  const mu = set.mu;
  const { a, b } = ab || findAbParams(spread, minDist);

  const rng = makeRng(seed);
  const Y = Array.from({ length: n }, () => [rng.normal(0, 1e-2), rng.normal(0, 1e-2)]);
  const frames = [Y.map((p) => p.slice())];
  const curve = [crossEntropy(mu, Y, a, b)];

  const gx = new Float64Array(n), gy = new Float64Array(n);
  for (let it = 0; it < iters; it += 1) {
    gx.fill(0); gy.fill(0);
    for (let i = 0; i < n; i += 1)
      for (let j = i + 1; j < n; j += 1) {
        const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
        const s = dx * dx + dy * dy + 1e-12;
        const w = 1 / (1 + a * s ** b);
        const c = (2 * b * (mu[i][j] - w)) / s;
        gx[i] += c * dx; gy[i] += c * dy;
        gx[j] -= c * dx; gy[j] -= c * dy;
      }
    const step = eta * (1 - it / iters);
    for (let i = 0; i < n; i += 1) {
      Y[i][0] -= step * Math.min(clip, Math.max(-clip, gx[i]));
      Y[i][1] -= step * Math.min(clip, Math.max(-clip, gy[i]));
    }
    frames.push(Y.map((p) => p.slice()));
    curve.push(crossEntropy(mu, Y, a, b));
  }
  return { Y, frames, curve, a, b, k, mu, rho: set.rho, sigma: set.sigma };
}
