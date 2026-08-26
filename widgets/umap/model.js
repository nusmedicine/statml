/* ============================================================================
   UMAP, at the scale a widget uses. THIS IS WHAT `main.js` RUNS, and it is a
   separate module for one reason: `_lab/umap-verify.mjs` imports it in node and
   checks it against `umap-learn`, so WHAT IS VERIFIED IS WHAT SHIPS.

   Widget 21 has the algorithm twice — once in `_lab/tsne-engine.js`, which the
   verification checks, and once in `widgets/t-sne/main.js`, which students run.
   Nothing keeps those two in step. `widgets/balancing-data/model.js` is the
   pattern that does, and HANDOVER calls it the interesting one; this follows it.

   Every number in docs/catalogue.md § NEXT · UMAP came out of this file.

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

   `_lab/umap-measure.mjs` runs the measurements the catalogue quotes and
   `_lab/umap-verify.mjs` compares this against umap-learn 0.5.12 through
   `umap-ref.json`. Both are node scripts, not pages.
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

/* --- the stage ------------------------------------------------------------- *
 *
 * HERE RATHER THAN IN `main.js` FOR THE REASON THE SOLVER IS: `_lab`'s scripts
 * import it, so the numbers the catalogue quotes come off the stage the widget
 * actually generates. Widget 21 keeps its stage private and its measurement
 * script keeps a copy, and nothing holds the two together.
 */

/* THE SAMPLES LIE ON THE SPHERE, NOT IN THE BALL, and that is the difference
   between drawing a manifold and drawing a reference. Widget 21's stage — which
   this one used first — puts the cluster CENTRES on a sphere of radius R and
   then scatters samples around them in all three dimensions, so the cloud fills
   the ball: radius from the origin ran 1.14 to 3.33 and only 9 of 48 samples
   landed within 0.1 of R. The wireframe globe was drawing a surface the data was
   not on, and the edges cut through the interior. Kenneth put it exactly: it
   "doesn't bring home the point that UMAP can find clusters on manifolds".

   Now every sample sits at exactly radius R, as a cap around each group's
   direction — a real 2-manifold embedded in three dimensions, which is what
   cell 46 assumes and what "flattening a globe onto a map" describes.

   WHAT IT DOES NOT BUY, recorded so it is not claimed: a lesson about geodesics.
   On a sphere the chord is 2R sin(theta/2) in the great-circle angle, strictly
   increasing over the whole range — so the k nearest by chord are ALWAYS the k
   nearest by arc, for every k. Measured on caps and on a band around the sphere,
   the two neighbourhoods agree 100% of the time. A sphere cannot separate the
   two metrics; only a surface that folds back on itself can, and a Swiss roll
   wound tightly enough to do it defeats UMAP at n = 48 rather than showing it
   off. `_lab/umap-sphere.html` has all four stages and the numbers.

   SO THE SPHERE IS FOR THE METAPHOR, and the metaphor is now honest.

   CAP_DEG 30 is measured. Retention is flat at 0.876 across 15 to 35 degrees and
   only falls at 60 (0.860); tightness starts loosening past 45. What decides it
   is that the caps stay compact against the 109 degrees between tetrahedral
   centres. */
export const R = 2;
const CAP_DEG = 30;
const JITTER = 0.12;

const gauss = (rng) =>
  Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit3 = (a) => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return scale3(a, 1 / m); };
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Unit directions for the group centres: two poles, three round the equator,
    or four at the vertices of a tetrahedron. */
function spreadDirs(n) {
  if (n === 2) return [[0, 0, 1], [0, 0, -1]];
  if (n === 3) {
    return [0, 1, 2].map((k) => {
      const a = (2 * Math.PI * k) / 3;
      return [Math.cos(a), Math.sin(a), 0];
    });
  }
  const c = 1 / Math.sqrt(3);
  return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => scale3(v, c));
}

export function stage(groups, per, rng) {
  const out = [];
  const centres = spreadDirs(groups).map((p) =>
    unit3([0, 1, 2].map((k) => p[k] + gauss(rng) * JITTER)));
  const sig = (CAP_DEG * Math.PI) / 180 / 2;
  for (let g = 0; g < groups; g += 1) {
    const c = centres[g];
    /* An orthonormal frame in the tangent plane at c. The seed vector only has
       to be non-parallel to c, and 0.9 is a safe threshold for a unit vector. */
    const t = Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = unit3(cross3(c, t));
    const v = cross3(c, u);
    for (let i = 0; i < per; i += 1) {
      /* A Gaussian ANGLE from the centre and a uniform bearing, then walk that
         far along the great circle. Scattering in the tangent plane and
         projecting back would bunch samples toward the rim at wide caps; this
         puts them on the surface directly. */
      const ang = Math.abs(gauss(rng) * sig);
      const phi = rng.uniform(0, 2 * Math.PI);
      const dir = [0, 1, 2].map((k) => u[k] * Math.cos(phi) + v[k] * Math.sin(phi));
      out.push({
        g,
        p: [0, 1, 2].map((k) => (c[k] * Math.cos(ang) + dir[k] * Math.sin(ang)) * R),
      });
    }
  }
  return out;
}


/* --- where the flattening STARTS -------------------------------------------
 *
 * `umap-learn`'s default `init` is **"spectral"** — the Laplacian eigenmaps
 * embedding of the fuzzy graph — and NOT random. This file used random first,
 * which is the library's non-default, and the difference is entirely at the
 * start: measured over eight seeds, 5-NN retention of the STARTING layout is
 *
 *     random          0.087        (nothing at all)
 *     PCA plane       0.653
 *     spectral        0.538
 *
 * while all three finish in the same place — 0.814 to 0.819 retention, 0.103 to
 * 0.116 tightness. So the choice costs nothing in the answer and decides only
 * what the reader watches happen. (Those three were measured on the earlier
 * ball stage; on the sphere the plane starts higher still, 0.728 against a
 * settled 0.832 at 3-NN over eight seeds, because a 2-manifold flattens to two
 * dimensions better than a solid ball does.)
 *
 * THE PCA PLANE IS THE ONE THIS WIDGET USES, for four reasons and none of them
 * is quality:
 *
 *   1. it IS a flattening — the cloud projected onto its two most-spread
 *      directions — so the notebook's globe-onto-a-map analogy stops being a
 *      metaphor and the widget can animate the real transformation.
 *   2. it is widget 19's own plane, which ties the two together: start from the
 *      flat map PCA gives you, then let the neighbour graph pull it into shape.
 *   3. `sklearn`'s t-SNE defaults to `init="pca"` for the same reason, so a
 *      structured start is library-endorsed rather than a convenience.
 *   4. it hands the widget a number: on the sphere stage 73 per cent of each
 *      sample's three nearest neighbours survive the flattening ALONE and 83
 *      per cent after UMAP, averaged over eight seeds. THAT DIFFERENCE IS WHAT
 *      UMAP ADDS, and nothing else in the arc states it. It is bigger at two
 *      and three groups (+0.215 and +0.241) than at four (+0.104), because four
 *      tetrahedral caps have a near-isotropic covariance and no plane is much
 *      better than any other — the eigenvalues run 1.56 / 1.35 / 1.07.
 *
 * It is also 43x cheaper than spectral — a 3x3 eigendecomposition against a
 * 48x48 one, 0.1 ms against 4.3 ms.
 *
 * WHAT IT MUST NOT BE is the camera's view. `turn` and `tilt` are display
 * parameters, so an init that followed them would let turning the cloud change
 * the answer — a widget lying about itself (non-negotiable 1). The plane is a
 * property of the data and of nothing else.
 */

const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  unit: (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
};

/* Exact eigenvectors of a symmetric 3x3 by cyclic Jacobi, as widget 19 has.
   Machine precision in about six sweeps and independent of any starting vector,
   which power iteration is not — widget 19's comment records it landing 0.29
   from the true PC1 on the worst of 360 trajectories. */
function jacobiEig3(Cin) {
  const A = Cin.map((r) => r.slice());
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep += 1) {
    let off = 0;
    for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) off += A[i][j] * A[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p += 1) for (let q = p + 1; q < 3; q += 1) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k += 1) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k += 1) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  return order.map((i) => v3.unit([V[0][i], V[1][i], V[2][i]]));
}

/* An eigenvector has no sign. sklearn pins it with `svd_flip` — largest
   magnitude entry positive — and so does widget 19, so the two widgets orient
   the same cloud the same way. Camera-independent on purpose: pinning it to the
   shortest turn from wherever the reader happened to be looking would make the
   embedding a function of a display parameter. */
function canonical(v) {
  let m = 0;
  for (let i = 1; i < 3; i += 1) if (Math.abs(v[i]) > Math.abs(v[m])) m = i;
  return v[m] < 0 ? v3.scale(v, -1) : v.slice();
}

/**
 * The plane the cloud is flattened onto, and the flattening itself.
 * Returns the centred points, the two directions, and the 2-D coordinates —
 * which are the descent's starting layout and the landing point of the widget's
 * entry animation, so the tween ends exactly on frame 0 of the run.
 */
export function pcaPlane(X) {
  const n = X.length, d = X[0].length;
  const centre = Array.from({ length: d }, (_, k) => X.reduce((s, p) => s + p[k], 0) / n);
  const Z = X.map((p) => p.map((v, k) => v - centre[k]));
  const C = [0, 1, 2].map((a) => [0, 1, 2].map((b) => Z.reduce((s, p) => s + p[a] * p[b], 0) / n));
  const eig = jacobiEig3(C);
  const pc1 = canonical(eig[0]);
  /* squared up against pc1, so the pair is exactly orthonormal and the tween
     rotates rather than shears */
  const pc2 = canonical(v3.unit(v3.sub(eig[1], v3.scale(pc1, v3.dot(eig[1], pc1)))));
  return { centre, Z, pc1, pc2, Y: Z.map((p) => [v3.dot(p, pc1), v3.dot(p, pc2)]) };
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
 *
 * THE START IS A SPREAD, uniform on [-2, 2], and it decides two things a
 * near-coincident start gets wrong. `umap-learn`'s `init="random"` is uniform on
 * [-10, 10]; this is the same idea at this engine's own scale, and the reason it
 * is not the same NUMBER is measured below.
 *
 * A near-coincident start (normal, sigma 1e-2 — what Rtsne does, and what this
 * file did first) puts every pair at d ~ 0, where the (1-mu)log(1-w) term
 * diverges. The cross-entropy then opens at 7103 against a final 188, so a chart
 * of it spends 97 per cent of its height on the first frame and squashes the
 * whole descent into a hairline. Five seeds, n = 48:
 *
 *   start           start r   max r   final r   fills frame   CE[0]/end   rises
 *   normal x 1e-2       0.0     6.7       6.7          100%          38      10
 *   uniform +-1         1.3     6.9       6.9          100%         4.3       0
 *   uniform +-2 (this)  2.6     6.7       6.7           99%         2.9       0
 *   uniform +-4         5.3     7.0       7.0          100%         2.7       0
 *   uniform +-10        13.2   13.2       6.5           49%         3.4       0
 *
 * "Fills frame" is final radius over the largest radius anywhere in the run, and
 * it matters because the 2-D panel is scaled to the whole trajectory so the frame
 * cannot move under the reader (principle 2.5). **At the library's literal +-10
 * the finished picture uses under half the panel**, because that constant is
 * sized for umap-learn's own output — which spans 26 to 42 on this stage against
 * this engine's 13. Copying the number rather than the ratio would spend half the
 * figure on white space.
 *
 * Among the starts that do fill it, +-2 gives the smallest opening blob, so the
 * arrangement visibly flies apart and settles — real motion the method performs,
 * which is widget 20's test rather than widget 19's. +-4 is the closest match to
 * the library's start RELATIVE to output scale if that is ever wanted back.
 *
 * `every` samples the trajectory: the widget animates 50 steps of 10 iterations
 * rather than 500 of one, because at one iteration the arrangement is worse than
 * useless (silhouette -0.119, measured). Frames and curve are both sampled at
 * the same points, so a scrub of the chart and the picture cannot disagree.
 */
export function umap(X, {
  nNeighbors = 15, minDist = 0.1, spread = 1, iters = 500, every = 1,
  eta = 0.1, clip = 4, seed = 1, mu: given = null, ab = null, init = null,
} = {}) {
  const n = X.length;
  const k = Math.max(2, Math.min(nNeighbors, n - 1));
  const set = given ? { mu: given } : fuzzySet(X, k);
  const mu = set.mu;
  const { a, b } = ab || findAbParams(spread, minDist);

  /* `init` is the starting layout, and the widget hands it the PCA plane — see
     `pcaPlane` above for why, and for the eight-seed table. The uniform fallback
     is what `umap-learn`'s `init="random"` does, kept so this module still runs
     standalone in the measurement scripts. */
  const rng = makeRng(seed);
  const Y = init
    ? init.map((p) => [p[0], p[1]])
    : Array.from({ length: n }, () => [rng.uniform(-2, 2), rng.uniform(-2, 2)]);
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
    if ((it + 1) % every === 0) {
      frames.push(Y.map((p) => p.slice()));
      curve.push(crossEntropy(mu, Y, a, b));
    }
  }
  return { Y, frames, curve, a, b, k, mu, rho: set.rho, sigma: set.sigma };
}
