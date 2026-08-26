/* ============================================================================
   K-Means — Lloyd's algorithm, the exact procedure `sklearn.cluster.KMeans`
   runs with `algorithm="lloyd"`, plus the two evaluations PHM5005 `03-5`
   cell 59 prints (silhouette and ARI).

   IN ITS OWN MODULE ON PURPOSE. Widget 21 kept a private copy of its engine in
   `_lab/` and the shipped one drifted from the verified one; widget 22 put the
   algorithm here and `_lab/umap-verify.mjs` imported it, which is what made
   "what is verified is what ships" true rather than hoped for. This file is
   imported by `main.js`, by `_lab/kmeans-measure.mjs` (the numbers the
   catalogue quotes) and by `_lab/kmeans-verify.mjs` (the check against
   sklearn).

   DIMENSION-AGNOSTIC. Points are plain arrays and nothing here knows whether
   there are two coordinates or three, because the widget has to run the same
   algorithm in the data's space and in a 2-D projection of it and compare —
   which is what cell 53 asserts and does not show.
   ========================================================================= */

const sq = (a, b) => {
  let s = 0;
  for (let d = 0; d < a.length; d += 1) s += (a[d] - b[d]) * (a[d] - b[d]);
  return s;
};

/** Nearest centroid for every point, by squared Euclidean distance — the
    ordering is the same as by distance, and the square root buys nothing. */
export function assign(X, C) {
  return X.map((x) => {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < C.length; k += 1) {
      const d = sq(x, C[k]);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  });
}

/** The mean of the points assigned to each centroid.

    AN EMPTY CLUSTER KEEPS ITS CENTROID rather than being relocated. sklearn
    moves it onto the point furthest from its own centre; freezing it is the
    honest picture for a teaching widget — a centroid nobody chose sits still
    and visibly owns nothing, which is what "K was too big" looks like. The two
    only differ once a cluster empties, and `_lab/kmeans-measure.mjs` reports
    how often that happens at widget scale. */
export function update(X, labels, C) {
  const dim = X[0].length;
  const sums = C.map(() => new Array(dim).fill(0));
  const counts = C.map(() => 0);
  for (let i = 0; i < X.length; i += 1) {
    counts[labels[i]] += 1;
    for (let d = 0; d < dim; d += 1) sums[labels[i]][d] += X[i][d];
  }
  return {
    centroids: C.map((c, k) => (counts[k] ? sums[k].map((s) => s / counts[k]) : c.slice())),
    counts,
  };
}

/** The objective itself: the within-cluster sum of squares cell 52 writes as
    min over C of the sum of ||x − mu_k||². `sklearn` calls it `inertia_`. */
export function inertia(X, labels, C) {
  let s = 0;
  for (let i = 0; i < X.length; i += 1) s += sq(X[i], C[labels[i]]);
  return s;
}

/** K distinct observations, uniformly at random — sklearn's `init="random"`,
    and the "choose K cluster centres randomly" of cell 52's step 1. */
export function forgy(X, K, rng) {
  const idx = rng.shuffle(X.map((_, i) => i)).slice(0, K);
  return idx.map((i) => X[i].slice());
}

/** k-means++ — sklearn's DEFAULT init, so it is what the notebook's own
    `KMeans(n_clusters=2, random_state=42)` runs. Each new centre is drawn with
    probability proportional to its squared distance from the nearest centre
    already chosen, which spreads the starts out and is why the library looks
    less seed-sensitive than the lesson's limitations column says it is.

    sklearn additionally samples 2 + log(K) candidates per centre and keeps the
    best, so the two agree in kind and not draw for draw. `kmeans-verify.mjs`
    therefore hands sklearn an EXPLICIT initial array rather than comparing
    initialisers. */
export function kmeansPlusPlus(X, K, rng) {
  const C = [X[rng.int(0, X.length - 1)].slice()];
  while (C.length < K) {
    const d2 = X.map((x) => Math.min(...C.map((c) => sq(x, c))));
    const total = d2.reduce((s, v) => s + v, 0);
    if (total === 0) { C.push(X[rng.int(0, X.length - 1)].slice()); continue; }
    let r = rng.uniform(0, total);
    let i = 0;
    while (i < X.length - 1 && (r -= d2[i]) > 0) i += 1;
    C.push(X[i].slice());
  }
  return C;
}

/**
 * Lloyd's algorithm, returning THE WHOLE RUN rather than its answer.
 *
 * `steps` is the replay the animation reveals: one frame per half-iteration,
 * alternating assign and update, exactly the four panels of cell 52's diagram.
 * `compute()` is pure and runs on parameter change only (invariant 2), so the
 * loop is over before the first frame is drawn and the animation never
 * computes anything — it walks this array.
 *
 * Converged means "no assignment changed", which is cell 52's own stopping
 * rule and is a stronger statement than "the centroids barely moved": once the
 * labels repeat, every later iteration is identical.
 */
export function lloyd(X, K, { init, maxIter = 40 } = {}) {
  let C = init.map((c) => c.slice());
  const steps = [{ kind: "init", centroids: C.map((c) => c.slice()), labels: null }];
  let labels = null;
  let converged = false;

  for (let t = 0; t < maxIter; t += 1) {
    const next = assign(X, C);
    const same = labels !== null && next.every((v, i) => v === labels[i]);
    labels = next;
    steps.push({
      kind: "assign",
      centroids: C.map((c) => c.slice()),
      labels: labels.slice(),
      inertia: inertia(X, labels, C),
    });
    if (same) { converged = true; break; }

    const moved = update(X, labels, C);
    steps.push({
      kind: "update",
      from: C.map((c) => c.slice()),
      centroids: moved.centroids.map((c) => c.slice()),
      labels: labels.slice(),
      counts: moved.counts,
      inertia: inertia(X, labels, moved.centroids),
      empty: moved.counts.map((n, k) => (n ? -1 : k)).filter((k) => k >= 0),
    });
    C = moved.centroids;
  }

  return {
    steps,
    labels,
    centroids: C,
    inertia: inertia(X, labels, C),
    converged,
    iters: steps.filter((s) => s.kind === "update").length,
  };
}

/* --- the two evaluations cell 59 prints ------------------------------------

   Both are computed on the SPACE THE CLUSTERING RAN IN, which is cell 59's own
   choice (`silhouette_score(X_pca, kmeans_labels)`) and is the thing the
   widget's "which space" comparison has to keep honest: a silhouette from the
   2-D picture and one from the data are different numbers about different
   spaces, and putting them side by side without saying so would be a lie.
   ------------------------------------------------------------------------ */

/** Mean over points of (b − a) / max(a, b), cell 51's definition verbatim.
    A cluster of one scores 0 by convention, as in sklearn. */
export function silhouette(X, labels) {
  const K = Math.max(...labels) + 1;
  const n = X.length;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const sums = new Array(K).fill(0);
    const counts = new Array(K).fill(0);
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const d = Math.sqrt(sq(X[i], X[j]));
      sums[labels[j]] += d;
      counts[labels[j]] += 1;
    }
    if (counts[labels[i]] === 0) continue;
    const a = sums[labels[i]] / counts[labels[i]];
    let b = Infinity;
    for (let k = 0; k < K; k += 1) {
      if (k === labels[i] || counts[k] === 0) continue;
      b = Math.min(b, sums[k] / counts[k]);
    }
    if (b === Infinity) continue;
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

/** Adjusted Rand index against the true labels — cell 51's second evaluation,
    and the first thing in this arc that scores an answer against the truth
    rather than describing the picture. */
export function adjustedRand(a, b) {
  const A = [...new Set(a)];
  const B = [...new Set(b)];
  const table = A.map(() => new Array(B.length).fill(0));
  for (let i = 0; i < a.length; i += 1) table[A.indexOf(a[i])][B.indexOf(b[i])] += 1;
  const c2 = (m) => (m * (m - 1)) / 2;
  let sumIJ = 0;
  for (const row of table) for (const m of row) sumIJ += c2(m);
  const sumI = table.reduce((s, row) => s + c2(row.reduce((t, m) => t + m, 0)), 0);
  const sumJ = B
    .map((_, j) => table.reduce((t, row) => t + row[j], 0))
    .reduce((s, m) => s + c2(m), 0);
  const total = c2(a.length);
  const expected = (sumI * sumJ) / total;
  const max = (sumI + sumJ) / 2;
  return max === expected ? 0 : (sumIJ - expected) / (max - expected);
}

/* --- stages ----------------------------------------------------------------

   Flat 2-D blobs, because cell 52's diagram is a 2-D scatter with crosses for
   centroids and the whole assign/update beat reads in the plane. The arc's
   3-D sphere stage (widgets 20–22) is available by importing `stage` from
   `../umap/model.js`, and is what the "which space" comparison needs.
   ------------------------------------------------------------------------ */

/** How wide a blob is, as a share of the gap between neighbouring centres.
    Measured at six groups; scaling it with the gap is what keeps `groups` a
    control over HOW MANY clusters there are and nothing else. Fix the width
    instead and raising `groups` also raises the difficulty, so a reader
    changing it cannot tell which of the two they just saw. */
export const SPREAD_OF_GAP = 0.16;

/** The gap between neighbouring centres on the circle, times `SPREAD_OF_GAP`. */
export const spreadFor = (groups, radius = 1) =>
  SPREAD_OF_GAP * 2 * radius * Math.sin(Math.PI / groups);

/**
 * `groups` Gaussian blobs on a circle of radius `radius`.
 *
 * `aspect` stretches every blob along its own axis — the lesson's "assumes
 * clusters are spherical". `sizes` scales each blob's count and `spreads` its
 * width — "and similar size". Both default to the shape K-Means is good at, so
 * a failing stage is one parameter away from the working one rather than a
 * different generator.
 */
export function blobs(rng, {
  groups = 3, per = 16, radius = 1, spread = null,
  aspect = 1, sizes = null, spreads = null, angle0 = Math.PI / 2,
} = {}) {
  const out = [];
  if (spread === null) spread = spreadFor(groups, radius);
  for (let g = 0; g < groups; g += 1) {
    const th = angle0 + (2 * Math.PI * g) / groups;
    const cx = radius * Math.cos(th);
    const cy = radius * Math.sin(th);
    const s = (spreads ? spreads[g] : 1) * spread;
    const n = Math.round(per * (sizes ? sizes[g] : 1));
    /* Stretch along the blob's own long axis, then rotate that axis to the
       tangent of the circle — bars side by side rather than pointing at each
       other, which is the arrangement K-Means cuts across. */
    const ax = th + Math.PI / 2;
    for (let i = 0; i < n; i += 1) {
      const u = rng.normal(0, s * aspect);
      const v = rng.normal(0, s);
      out.push({
        g,
        p: [cx + u * Math.cos(ax) - v * Math.sin(ax), cy + u * Math.sin(ax) + v * Math.cos(ax)],
      });
    }
  }
  return out;
}

/** One uniform disc and NO groups at all. K-Means returns K clusters from it
    all the same, which is the demonstration behind "must specify K". */
export function cloud(rng, { n = 48, radius = 1.3 } = {}) {
  return Array.from({ length: n }, () => {
    const r = radius * Math.sqrt(rng.next());
    const th = rng.uniform(0, 2 * Math.PI);
    return { g: 0, p: [r * Math.cos(th), r * Math.sin(th)] };
  });
}
