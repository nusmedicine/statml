/* ============================================================================
   DBSCAN — density-based clustering.

   Host: PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 60-67. The
   plan and every measurement behind the constants here are in
   docs/catalogue.md § Widget 24 · DBSCAN.

   This module is the ENGINE ONLY — no canvas, no DOM, no core imports — so
   `widgets/_lab/dbscan-*.mjs` can import the shipping code rather than a copy
   of it. That is the widget-22 lesson, applied from the first line.

   MATCHED TO scikit-learn's `dbscan_inner` DELIBERATELY, including the parts
   that are arbitrary. Border points are claimed by whichever cluster reaches
   them FIRST, and "first" is decided by sklearn's own traversal: an outer loop
   over points in index order, and inside it a LIFO stack, not a queue. A
   border point within `eps` of two clusters therefore has no principled owner
   — it has a procedural one. Change the traversal and the picture changes for
   a reason that is a bug in neither engine, so the traversal is copied.
   ========================================================================= */

const sq = (a, b) => {
  let s = 0;
  for (let d = 0; d < a.length; d += 1) s += (a[d] - b[d]) ** 2;
  return s;
};

export const NOISE = -1;

/**
 * Every point's `eps`-neighbourhood, as index lists.
 *
 * THE POINT IS ITS OWN NEIGHBOUR, because `min_samples` counts it. Cell 60
 * says so in as many words — "Minimum number of points (including the point
 * itself)" — and getting this wrong shifts every core/border verdict by
 * exactly one, which reads as a tuning difference rather than as a bug.
 *
 * O(n squared) and unapologetic: the stage is 48-150 points and a KD-tree here
 * would be machinery for a saving of microseconds. See § QUESTION 1.
 */
export function neighbourhoods(X, eps) {
  const n = X.length;
  const e2 = eps * eps;
  const out = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    out[i].push(i);
    for (let j = i + 1; j < n; j += 1) {
      if (sq(X[i], X[j]) <= e2) { out[i].push(j); out[j].push(i); }
    }
  }
  /* Ascending, which is the order sklearn's radius query returns under the
     brute-force metric and therefore the order its stack pops in. */
  for (const list of out) list.sort((a, b) => a - b);
  return out;
}

/**
 * DBSCAN, cell 60's five steps.
 *
 * Returns the verdict on every point AND the shape of the search, because the
 * widget replays the search: `clusters[c].layers` is the cluster grown one hop
 * at a time from the point that seeded it, which is what makes `eps` visible
 * as the thing a cluster travels along.
 *
 * The LABELS are sklearn's stack order; the LAYERS are breadth-first over the
 * points that order already assigned. Both describe the same cluster, and
 * keeping them apart is what lets the drawing be a growing front while the
 * answer stays byte-identical to the library's.
 */
export function dbscan(X, { eps = 0.5, minPts = 5 } = {}) {
  const n = X.length;
  const nb = neighbourhoods(X, eps);
  const core = nb.map((list) => list.length >= minPts);
  const labels = new Array(n).fill(NOISE);
  const seeds = [];

  /* sklearn's `dbscan_inner`, verbatim in structure. A point is labelled when
     it is POPPED, and only a core point pushes its neighbours — which is what
     makes a border point a leaf: it joins a cluster and does not extend it. */
  let c = 0;
  for (let i = 0; i < n; i += 1) {
    if (labels[i] !== NOISE || !core[i]) continue;
    seeds.push(i);
    const stack = [];
    let v = i;
    for (;;) {
      if (labels[v] === NOISE) {
        labels[v] = c;
        if (core[v]) for (const j of nb[v]) if (labels[j] === NOISE) stack.push(j);
      }
      if (stack.length === 0) break;
      v = stack.pop();
    }
    c += 1;
  }

  /* The replay. Breadth-first from each cluster's seed, restricted to the
     points that cluster ended up owning, so a border point taken by an earlier
     cluster does not appear in two growths. */
  const clusters = seeds.map((seed, k) => {
    const layers = [[seed]];
    const seen = new Set([seed]);
    for (;;) {
      const next = [];
      for (const v of layers[layers.length - 1]) {
        if (!core[v]) continue;          /* a border point does not extend */
        for (const j of nb[v]) {
          if (labels[j] === k && !seen.has(j)) { seen.add(j); next.push(j); }
        }
      }
      if (next.length === 0) break;
      next.sort((a, b) => a - b);
      layers.push(next);
    }
    return { k, seed, layers, size: seen.size };
  });

  const noise = [];
  const border = [];
  for (let i = 0; i < n; i += 1) {
    if (labels[i] === NOISE) noise.push(i);
    else if (!core[i]) border.push(i);
  }

  return {
    labels, core, nb, clusters, seeds, noise, border,
    counts: nb.map((list) => list.length),
    nClusters: clusters.length,
  };
}

/* --- evaluation ------------------------------------------------------------

   NOISE IS NOT A CLUSTER, and cell 67 scores it as one. `silhouette_score(
   X_umap, db_labels)` is handed the raw labels with `-1` still in them, so
   every point the algorithm declined to cluster is pooled into a single
   "cluster" scattered over the whole plane. Both readings are here because the
   difference between them is the measurement — see § THE NOISE TRAP.
   ------------------------------------------------------------------------ */

/** Mean over points of (b - a) / max(a, b) — cell 51's definition, sklearn's
    convention that a singleton scores 0, and `keep` deciding which points are
    scored at all. */
export function silhouetteOn(X, labels, keep = null) {
  const idx = keep ?? labels.map((_, i) => i);
  const groups = [...new Set(idx.map((i) => labels[i]))];
  if (groups.length < 2) return null;
  let total = 0;
  for (const i of idx) {
    const sums = new Map(groups.map((g) => [g, 0]));
    const counts = new Map(groups.map((g) => [g, 0]));
    for (const j of idx) {
      if (i === j) continue;
      const d = Math.sqrt(sq(X[i], X[j]));
      sums.set(labels[j], sums.get(labels[j]) + d);
      counts.set(labels[j], counts.get(labels[j]) + 1);
    }
    if (counts.get(labels[i]) === 0) continue;   /* singleton: scores 0 */
    const a = sums.get(labels[i]) / counts.get(labels[i]);
    let b = Infinity;
    for (const g of groups) {
      if (g === labels[i] || counts.get(g) === 0) continue;
      b = Math.min(b, sums.get(g) / counts.get(g));
    }
    if (b === Infinity) continue;
    total += (b - a) / Math.max(a, b);
  }
  return total / idx.length;
}

/** What cell 67 prints: every point scored, `-1` treated as a cluster. */
export const silhouetteWithNoise = (X, labels) => silhouetteOn(X, labels);

/** What it should print: noise dropped, the clusters scored among themselves. */
export const silhouetteClustersOnly = (X, labels) =>
  silhouetteOn(X, labels, labels.map((_, i) => i).filter((i) => labels[i] !== NOISE));

/** Adjusted Rand index. Lifted unchanged from `widgets/kmeans/model.js` so the
    two clustering widgets report the same number the same way; noise is one
    more label to it, which is also what `adjusted_rand_score` does. */
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

/**
 * The same index with every noise point counted as its own singleton, which is
 * what `-1` MEANS: not grouped with anything.
 *
 * THIS IS THE ONLY HONEST WAY TO SCORE A DBSCAN RESULT AGAINST THE TRUTH, and
 * cell 67 does not do it. Pooling noise under one label makes `-1` a cluster,
 * and the consequence is not subtle — on two well-separated groups, measured:
 *
 *   labeling                            cell 67's ARI    this one
 *   both groups found as clusters           1.000         1.000
 *   ONE group found, the other ALL NOISE    1.000         0.505
 *   both found, 6 points left as noise      0.759         0.765
 *
 * A run that found one of two cancer subtypes and threw the other away scores
 * exactly as well as a run that found both. The correction costs one line and
 * moves the number ONLY where the number was lying — which is what makes it a
 * correction rather than a different metric.
 */
export function adjustedRandNoiseAware(truth, labels) {
  let next = Math.max(0, ...labels) + 1;
  return adjustedRand(truth, labels.map((v) => (v === NOISE ? next++ : v)));
}

/**
 * Did the clustering actually RECOVER the groups? A blunt, reportable verdict
 * that no single index gives: a true group counts as found when a majority of
 * it carries one cluster label, and no two groups may share one.
 *
 * Here because both indices can be passed for the wrong reason — the ARI by
 * declaring a group noise, the silhouette by declaring enough points noise
 * that what remains looks tight — and a measurement whose criterion can be
 * gamed measures nothing. It is what the plan's tables count.
 */
export function recovered(truth, labels, share = 0.6) {
  const groups = [...new Set(truth)];
  const claimed = new Map();
  let found = 0;
  for (const g of groups) {
    const tally = new Map();
    let n = 0;
    for (let i = 0; i < truth.length; i += 1) {
      if (truth[i] !== g) continue;
      n += 1;
      if (labels[i] === NOISE) continue;
      tally.set(labels[i], (tally.get(labels[i]) ?? 0) + 1);
    }
    let bestLab = null, bestN = 0;
    for (const [lab, c] of tally) if (c > bestN) { bestN = c; bestLab = lab; }
    if (bestLab === null || bestN < share * n) continue;
    if (claimed.has(bestLab)) continue;      /* two groups cannot share one */
    claimed.set(bestLab, g);
    found += 1;
  }
  return { found, of: groups.length, all: found === groups.length };
}

/** The k-distance every point sits at, sorted descending — the standard `eps`
    heuristic, whose knee is the recommended radius. Here so the plan can
    measure whether that knee is READABLE, not because the widget must draw it. */
export function kDistances(X, k) {
  return X.map((_, i) => {
    const d = X.map((p) => Math.sqrt(sq(X[i], p))).sort((a, b) => a - b);
    return d[Math.min(k - 1, d.length - 1)];
  }).sort((a, b) => b - a);
}

/* --- stages ----------------------------------------------------------------

   Four, and each one is an argument. `blobs` (imported from widget 23, not
   redefined) is what K-Means is good at, so the two widgets can be compared on
   identical points; `rings` and `moons` are what it is not; `varying` is what
   DBSCAN itself is not.
   ------------------------------------------------------------------------ */

export { blobs, spreadFor, cloud } from "../kmeans/model.js";

/**
 * Two concentric rings. The canonical arbitrary-shape stage: one cluster
 * entirely surrounds the other, so no partition by nearest centre can separate
 * them and any density method can.
 *
 * THE COUNTS ARE SPLIT IN PROPORTION TO CIRCUMFERENCE, and the first version
 * of this was not. Equal counts on rings of radius 0.42 and 1 puts the inner
 * points 2.4x closer together than the outer ones, so the stage meant to show
 * arbitrary SHAPE was quietly also a varying-DENSITY stage — and it showed:
 * DBSCAN "solved" it by clustering the inner ring and calling the entire outer
 * ring noise, which the ARI scored 1.000 because noise is one more label to
 * it. A stage that can be passed for the wrong reason is not a stage.
 *
 * `per` is the TOTAL, not the count per ring, for the same reason: every other
 * stage here is 48 points and this one must be too.
 */
export function rings(rng, { per = 48, inner = 0.35, outer = 1, jitter = 0.02 } = {}) {
  const share = inner / (inner + outer);
  const counts = [Math.round(per * share), per - Math.round(per * share)];
  const out = [];
  [[0, inner], [1, outer]].forEach(([g, r], k) => {
    const n = counts[k];
    for (let i = 0; i < n; i += 1) {
      const th = (2 * Math.PI * (i + rng.uniform(-0.35, 0.35))) / n;
      const rr = r + rng.normal(0, jitter);
      out.push({ g, p: [rr * Math.cos(th), rr * Math.sin(th)] });
    }
  });
  return out;
}

/** Two interleaving half-circles — sklearn's `make_moons`, the shape its own
    clustering comparison uses to separate the centroid methods from the
    density ones. Neither moon is convex and their bounding discs overlap. */
export function moons(rng, { per = 24, jitter = 0.075 } = {}) {
  const out = [];
  for (let i = 0; i < per; i += 1) {
    const t = (Math.PI * (i + rng.uniform(-0.35, 0.35))) / (per - 1);
    out.push({ g: 0, p: [Math.cos(t) - 0.5 + rng.normal(0, jitter), Math.sin(t) - 0.25 + rng.normal(0, jitter)] });
    out.push({ g: 1, p: [1 - Math.cos(t) - 0.5 + rng.normal(0, jitter), 0.25 - Math.sin(t) + rng.normal(0, jitter)] });
  }
  return out;
}

/**
 * Cell 60's third limitation — "varying densities can cause clusters to be
 * merged or split incorrectly" — staged so that no single `eps` can serve the
 * whole picture: TWO TIGHT BLOBS CLOSE TOGETHER, and one loose blob away from
 * both. Below the radius that keeps the loose blob whole, it shatters into
 * noise; above it, the two tight blobs are one cluster. The failure is a
 * scissors, and both blades have to be on the stage at once.
 *
 * THREE GROUPS, NOT TWO, and the first version had two — which measured
 * nothing. With two well-separated groups, "cluster the tight one and call the
 * entire loose one noise" scores ARI 1.000, because `adjusted_rand_score`
 * treats `-1` as one more label and a whole group declared noise is a whole
 * group correctly separated. That is the same defect that made the first
 * `rings` pass for the wrong reason, and it is worth knowing in its own right:
 * it is what cell 67's ARI does on this data. See § THE TWO NOISE TRAPS.
 */
export function varying(rng, {
  /* `ratio` 1 IS THE CONTROL STAGE — three blobs at one density, which DBSCAN
     handles perfectly — so the failing stage is one parameter away from the
     working one rather than a different generator. Widget 23's `blobs` is
     built on the same rule. `near` is fixed at the value where raising `ratio`
     alone walks the stage from 30/30 recovered to 3/30. */
  per = 16, ratio = 1, spread = 0.075, near = 0.28, away = 1.15,
} = {}) {
  const out = [];
  const at = [
    [0, [-away, -near], spread],          /* tight, and close to its neighbour */
    [1, [-away, +near], spread],          /* tight                             */
    [2, [+away, 0], spread * ratio],      /* loose                             */
  ];
  for (const [g, [cx, cy], s] of at) {
    for (let i = 0; i < per; i += 1) {
      out.push({ g, p: [cx + rng.normal(0, s), cy + rng.normal(0, s)] });
    }
  }
  return out;
}
