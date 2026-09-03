/* ============================================================================
   The engine behind `hierarchical-clustering`.

   The data and nothing about how it is drawn; `main.js` is the figure.

   WHY THE STAGE IS TWO-DIMENSIONAL, which the measurement decided.

   In ONE dimension — twenty log-fold-changes, two groups at ±1.5 with sd 0.5 —
   all five linkages (average, complete, ward.D2, single, centroid) return the
   same 10/10 split, 20 of 20 correct, and first disagree at k = 3. So a
   linkage control would be INERT at the cut anyone looks at, and a distance
   control worse than inert: in one dimension every distance is |x - y| up to a
   monotone transform, so the tree cannot move at all.

   Two dimensions fixes both and sharpens the argument. The three linkages
   agree on only 16% of 2-D noise runs against 36% in 1-D, and a distance
   control becomes possible at all — Euclidean against Manhattan gives a
   different tree on essentially every seed, and a k = 2 cut that agrees 95% of
   the time when the groups are real and 53% when they are not. Two arbitrary
   choices, both irrelevant to real structure and both decisive without it.

   THE CLAIM, restated after measuring. "Pure noise produces a handsome
   dendrogram" is false by the height of the tree: real groups score a
   final-merge gap of 4.20 [3.28 .. 5.18] and pure noise 1.39 [1.15 .. 1.78],
   with 0 of 400 noise runs reaching the 10th percentile of the real ones. What
   noise does produce is a handsome CUT — ask Ward for two clusters in pure
   noise and 56% of the time it hands back a balanced split.

   So the reader is not being set up to be fooled by the tree; in two
   dimensions the tree is honest and rather hard to misread. They are being set
   up to be fooled by the ANSWER, which is the thing a pipeline prints. The
   tree carries the evidence and the cut throws it away, which is why the two
   are separate controls: `shown` builds the tree, `k` cuts it.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* ---------------------------------------------------------------------------
   The stage.

   Twenty points in two dimensions, in two planted groups displaced along x by
   `separation`, with within-group sd 0.5. separation = 0 is one Gaussian and
   no groups at all — the case the widget exists for; the planted labels still
   exist in the data and the figure must never show them as an answer, only as
   a check the reader asks for.

   Measured through THIS engine, 400 seeds per column, and the numbers the
   widget's captions have to agree with:

     separation           0.0   1.0   2.0   3.0   4.0
     ward gap            1.39  1.62  2.71  4.20  5.58
     3 linkages agree     16%   23%   65%   94%   99%
     ward recovers         0%    3%   49%   93%  100%
     cut looks balanced    56%   73%   99%  100%  100%

   The same sweep in one dimension gives softer numbers throughout — 34%
   agreement on noise, not 16%. Two dimensions makes every one of these
   sharper.
   ------------------------------------------------------------------------ */
export const N_POINTS = 20;

/**
 * `rng` is passed in rather than made here: core builds one from `seed` and
 * hands it to `compute`, and a second generator inside the model would be a
 * second seeding mechanism to keep in step with the first. The lab scripts
 * pass `makeRng(seed)` themselves.
 */
export function stage({ separation = 3 } = {}, rng = makeRng(1)) {
  const half = N_POINTS / 2;
  const pts = [];
  for (let i = 0; i < N_POINTS; i += 1) {
    const g = i < half ? 0 : 1;
    const shift = (g === 0 ? -1 : 1) * (separation / 2);
    pts.push({ x: rng.normal(shift, 0.5), y: rng.normal(0, 0.5), group: g, i });
  }
  return pts;
}

/* ---------------------------------------------------------------------------
   Agglomerative clustering.

   N singletons; merge the closest pair; repeat. The distance between two
   CLUSTERS is the linkage, and it is updated by the Lance-Williams recurrence
   rather than recomputed from the points, which is both what R does and the
   reason ward.D2 can be expressed at all.

   `single` and `centroid` are implemented because R has them and the verifier
   checks all five, but the widget offers three. Single was measured and
   dropped as a control: at n = 20 its failure is not the textbook chain but an
   isolate, a 19/1 split, which teaches nothing.
   ------------------------------------------------------------------------ */
const LINKAGES = ["average", "complete", "ward.D2", "single", "centroid"];

export { LINKAGES };

/* ---------------------------------------------------------------------------
   The distance.

   Euclidean, Manhattan, cosine, Pearson and Jaccard are the five a student
   meets. Two of them are offered here, and the reason is measured rather than
   a matter of taste:

     PEARSON IS DEGENERATE on a plane. A correlation between two vectors of
     length two is always ±1, so over 190 pairs of points it takes THREE
     distinct values where Euclidean takes 190. It cannot be a control on a
     picture of points.

     COSINE is non-degenerate but measures the angle from the ORIGIN, so it
     separates this stage only because the two groups happen to straddle zero.
     Shift the cloud and it collapses. Euclidean and Manhattan are the two that
     do not care where the origin is, which is what a point cloud needs.

   Both are honest on gene profiles as well, so one control serves both tabs.
   ------------------------------------------------------------------------ */
export const DISTANCES = {
  euclidean: {
    label: "Euclidean",
    detail: "straight-line distance — the usual choice",
    fn: (a, b) => {
      let s = 0;
      for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; s += d * d; }
      return Math.sqrt(s);
    },
  },
  manhattan: {
    label: "Manhattan",
    detail: "the coordinate differences added up — less swayed by one big gap",
    fn: (a, b) => {
      let s = 0;
      for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i] - b[i]);
      return s;
    },
  },
};

/** Points as plain vectors, which is what `cluster` consumes. */
export function pointVectors(pts) {
  return pts.map((p) => [p.x, p.y]);
}

/**
 * Lance-Williams update: the distance from cluster k to the merger of i and j.
 *
 * ward.D2 and centroid recur on SQUARED distances and take the root at the
 * end, which is exactly why R distinguishes ward.D from ward.D2: ward.D
 * applies the same coefficients to unsquared distances and is not Ward's
 * criterion at all.
 */
function lanceWilliams(method, dki, dkj, dij, ni, nj, nk) {
  switch (method) {
    case "single":
      return Math.min(dki, dkj);
    case "complete":
      return Math.max(dki, dkj);
    case "average":
      return (ni * dki + nj * dkj) / (ni + nj);
    case "ward.D2": {
      const n = ni + nj + nk;
      return Math.sqrt(
        ((ni + nk) * dki * dki + (nj + nk) * dkj * dkj - nk * dij * dij) / n
      );
    }
    case "centroid": {
      const n = ni + nj;
      return Math.sqrt(
        (ni * dki * dki + nj * dkj * dkj) / n - (ni * nj * dij * dij) / (n * n)
      );
    }
    default:
      throw new Error(`unknown linkage: ${method}`);
  }
}

/**
 * Cluster `rows` — an array of numeric vectors — returning the merge sequence.
 *
 * Everything the widget clusters goes through here — the Cluster tab's
 * objects, the heatmap's genes and its samples. One implementation on purpose:
 * the heatmap's row tree and the scatter's tree are the same algorithm, and
 * two copies of it is how the two halves of a widget come to disagree.
 *
 * The return shape follows R's `hclust` closely enough to be checked against
 * it directly: `merge[m] = [a, b]` where a NEGATIVE entry -i is the singleton
 * point i (1-based, as R writes it) and a POSITIVE entry m' is the cluster
 * formed at step m'. `height[m]` is the linkage distance at which that merge
 * happened. Both arrays have N-1 entries and are in merge order, which is the
 * order the animation reveals them.
 *
 * `order` is a leaf ordering with no crossings, computed by walking the tree
 * and placing the smaller subtree first. R uses a different rule, so the
 * ordering is NOT checked against it — it is cosmetic, and the argument lives
 * in the heights and the cuts, which are.
 */
export function cluster(rows, method = "ward.D2", distance = "euclidean") {
  if (!LINKAGES.includes(method)) throw new Error(`unknown linkage: ${method}`);
  if (!DISTANCES[distance]) throw new Error(`unknown distance: ${distance}`);
  const dist = DISTANCES[distance].fn;
  const n = rows.length;

  // Active clusters, addressed by their slot. `id` is R's numbering: -i for a
  // singleton, +m for the cluster made at step m.
  const active = [];
  for (let i = 0; i < n; i += 1) {
    active.push({ slot: i, size: 1, id: -(i + 1), leaves: [i], a: null, b: null, height: 0 });
  }

  // Full symmetric distance matrix over slots. Slots are never reused, so this
  // stays valid as clusters are retired.
  const D = [];
  for (let i = 0; i < n; i += 1) {
    D.push(new Float64Array(n));
    for (let j = 0; j < n; j += 1) D[i][j] = i === j ? 0 : dist(rows[i], rows[j]);
  }

  const merge = [];
  const height = [];
  const nodes = []; // per merge: the cluster it produced, for `order`

  for (let step = 1; step <= n - 1; step += 1) {
    // Closest pair. Ties broken by the lower slot index, deterministically —
    // a tie is possible with contrived input and must not depend on iteration
    // order, or the same seed would draw two different trees.
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let a = 0; a < active.length; a += 1) {
      for (let b = a + 1; b < active.length; b += 1) {
        const d = D[active[a].slot][active[b].slot];
        if (d < best) { best = d; bi = a; bj = b; }
      }
    }

    const ci = active[bi];
    const cj = active[bj];
    // R writes the pair with the smaller id first (both singletons: the more
    // negative). Matching it makes the verifier a straight comparison.
    merge.push(ci.id < cj.id ? [ci.id, cj.id] : [cj.id, ci.id]);
    height.push(best);

    const merged = {
      slot: ci.slot,           // reuse i's row; j's is retired with j
      size: ci.size + cj.size,
      id: step,
      leaves: ci.leaves.concat(cj.leaves),
      a: ci,
      b: cj,
      height: best,
    };
    nodes.push(merged);

    // Update distances to every other active cluster BEFORE retiring j.
    for (const ck of active) {
      if (ck === ci || ck === cj) continue;
      const d = lanceWilliams(
        method,
        D[ci.slot][ck.slot], D[cj.slot][ck.slot], best,
        ci.size, cj.size, ck.size
      );
      D[merged.slot][ck.slot] = d;
      D[ck.slot][merged.slot] = d;
    }

    active.splice(bj, 1);      // remove j first: bj > bi, so bi stays valid
    active.splice(bi, 1, merged);
  }

  return { merge, height, order: leafOrder(nodes[nodes.length - 1]), nodes, n };
}

/** Leaves left to right, smaller subtree first, so no two branches cross. */
function leafOrder(root) {
  if (!root) return [];
  const walk = (c) => {
    if (!c.a) return c.leaves;
    const l = walk(c.a);
    const r = walk(c.b);
    return l.length <= r.length ? l.concat(r) : r.concat(l);
  };
  return walk(root);
}

/* ---------------------------------------------------------------------------
   The cut.

   Keep the first n-k merges and label what is left. This
   is a separate operation from building the tree ON PURPOSE: the whole claim
   is that the tree is evidence and the cut is a choice laid over it, and a
   widget that folded the cut into the animation would blur exactly that.

   Labels are assigned in order of first appearance among the points, so they
   are stable under a re-render and comparable across linkages.
   ------------------------------------------------------------------------ */
export function cut(tree, k) {
  const { n, merge } = tree;
  const kk = Math.max(1, Math.min(n, Math.round(k)));
  const steps = n - kk;              // merges to keep

  // Union-find over the first `steps` merges.
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i += 1) parent[i] = i;
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) { parent[r] = parent[parent[r]]; r = parent[r]; }
    return r;
  };
  const made = [];                   // representative leaf of cluster made at step m

  for (let m = 0; m < steps; m += 1) {
    const [a, b] = merge[m];
    const ra = find(a < 0 ? -a - 1 : made[a - 1]);
    const rb = find(b < 0 ? -b - 1 : made[b - 1]);
    parent[rb] = ra;
    made.push(ra);
  }

  const label = new Int32Array(n);
  const seen = new Map();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    if (!seen.has(r)) seen.set(r, seen.size + 1);
    label[i] = seen.get(r);
  }
  return Array.from(label);
}

/* ---------------------------------------------------------------------------
   The readouts — the numbers the figure prints, computed here so the lab page
   and the widget cannot disagree about them.
   ------------------------------------------------------------------------ */

/**
 * The gap: the first merge NOT taken, over the last one taken. THE diagnostic,
 * and the one thing on the figure that separates real groups from noise —
 * measured 0% overlap between separation 3 and separation 0 at the 10th
 * percentile. Reported at the cut, so it answers "was this k worth taking?".
 */
export function gapAt(tree, k) {
  const h = tree.height;
  const n = tree.n;
  const above = h[n - k];            // the first merge the cut refuses
  const below = h[n - k - 1];        // the last merge it accepts
  if (above === undefined || below === undefined || !below) return null;
  return above / below;
}

/**
 * WHICH PAIRS THE LINKAGE ACTUALLY MEASURED, for one merge.
 *
 * This is the difference between the three methods, and until it is drawn the
 * difference is invisible: a merge rendered as one line between two cluster
 * centres looks the same whichever rule chose it, so the linkage control
 * appears to do nothing to the scatter.
 *
 * So each rule gets the marks that ARE its definition: complete gets ONE line
 * between the two furthest members, average gets EVERY cross pair, and Ward
 * gets spokes from each member to the centre it would form.
 *
 * Returns `{ kind, pairs, centres }` in point indices; the figure decides how
 * to paint them.
 */
export function witness(rows, leavesA, leavesB, method, distance = "euclidean") {
  const dist = DISTANCES[distance].fn;
  const mean = (leaves) => {
    const m = new Array(rows[0].length).fill(0);
    for (const i of leaves) for (let d = 0; d < m.length; d += 1) m[d] += rows[i][d] / leaves.length;
    return m;
  };

  if (method === "ward.D2" || method === "centroid") {
    // Ward is about the spread a merge creates, so the marks are the spokes
    // from every member to the centre of the cluster they are about to form.
    const all = leavesA.concat(leavesB);
    const c = mean(all);
    return { kind: "spokes", pairs: all.map((i) => [i, null]), centres: [c], members: all };
  }

  let best = method === "single" ? Infinity : -Infinity;
  let bestPair = null;
  const every = [];
  for (const i of leavesA) {
    for (const j of leavesB) {
      every.push([i, j]);
      const d = dist(rows[i], rows[j]);
      if (method === "single" ? d < best : d > best) { best = d; bestPair = [i, j]; }
    }
  }

  // Average is defined by ALL of them, so all of them are drawn — which is
  // also why it is the one that looks like a mesh.
  if (method === "average") return { kind: "all", pairs: every, centres: [] };
  return { kind: "extreme", pairs: [bestPair], centres: [] };
}

/**
 * Classical MDS: place the objects in a plane so that the distances you can
 * SEE are the distances the tree used.
 *
 * With a square data matrix an object has twenty numbers, not two, so it
 * cannot be a point by simply reading two of its coordinates. Classical
 * scaling solves that honestly: double-centre the squared distance matrix and
 * take its top two eigenvectors, and the plotted separation approximates the
 * real one. The scatter then agrees with the distance matrix beside it by
 * construction rather than by coincidence, which the old two-column stage got
 * only because its objects happened to be two-dimensional already.
 *
 * Eigenvectors by power iteration with deflation — twenty objects, so this is
 * a handful of 20 x 20 multiplications and needs no library.
 */
export function mds(rows, distance = "euclidean") {
  const { D, n } = distanceMatrix(rows, distance);

  // B = -1/2 J D^2 J, the double-centred squared-distance matrix.
  const sq = [];
  for (let i = 0; i < n; i += 1) {
    sq.push(new Float64Array(n));
    for (let j = 0; j < n; j += 1) sq[i][j] = D[i][j] * D[i][j];
  }
  const rowMean = new Float64Array(n);
  let grand = 0;
  for (let i = 0; i < n; i += 1) {
    let s = 0;
    for (let j = 0; j < n; j += 1) s += sq[i][j];
    rowMean[i] = s / n;
    grand += s;
  }
  grand /= n * n;
  const B = [];
  for (let i = 0; i < n; i += 1) {
    B.push(new Float64Array(n));
    for (let j = 0; j < n; j += 1) B[i][j] = -0.5 * (sq[i][j] - rowMean[i] - rowMean[j] + grand);
  }

  /* A FIXED starting vector, never a random one: the widget must draw the same
     picture from the same seed, and a random start would rotate the plane on
     every render. */
  const mul = (M, v) => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let j = 0; j < n; j += 1) s += M[i][j] * v[j];
      out[i] = s;
    }
    return out;
  };
  const norm = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));

  const axes = [];
  for (let k = 0; k < 2; k += 1) {
    let v = new Float64Array(n).map((_, i) => Math.cos((i + 1) * (k + 1)));
    let lambda = 0;
    for (let it = 0; it < 200; it += 1) {
      const w = mul(B, v);
      lambda = norm(w);
      if (lambda < 1e-12) break;
      for (let i = 0; i < n; i += 1) w[i] /= lambda;
      v = w;
    }
    axes.push({ v, lambda });
    // deflate so the next iteration finds the next axis
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) B[i][j] -= lambda * v[i] * v[j];
    }
  }

  return Array.from({ length: n }, (_, i) => ({
    x: axes[0].v[i] * Math.sqrt(Math.max(0, axes[0].lambda)),
    y: axes[1].v[i] * Math.sqrt(Math.max(0, axes[1].lambda)),
    i,
  }));
}

/**
 * The leaf order after `shown` merges: clusters formed so far kept together,
 * everything else in its original position.
 *
 * At `shown = 0` this is 0, 1, 2, ... — the order the objects arrived in. At
 * the end it is the tree's own leaf order. In between, the distance matrix
 * drawn in this order SORTS ITSELF into blocks as the merges happen, which is
 * the clearest available statement of what the algorithm is doing: it is not
 * inventing structure, it is reordering a table until the structure is on the
 * diagonal. It also keeps every cluster contiguous, so a box can be drawn
 * round one.
 */
export function partialOrder(tree, shown) {
  const live = new Map();
  for (let i = 0; i < tree.n; i += 1) live.set(`-${i + 1}`, [i]);
  tree.nodes.slice(0, Math.max(0, shown)).forEach((nd, m) => {
    live.delete(String(nd.a.id));
    live.delete(String(nd.b.id));
    live.set(String(m + 1), nd.leaves);
  });
  const groups = [...live.values()];
  groups.sort((a, b) => Math.min(...a) - Math.min(...b));
  return { order: groups.flat(), groups };
}

/**
 * The distance matrix — the step between the data and the tree.
 *
 * The object the whole pipeline turns on: the linkage reads it,
 * the tree is built from it, and the cut is a line across the tree it
 * produced. Drawing the data, the tree and the cut but not this skips the step
 * where the rows-versus-columns question lives — clustering the rows of a
 * 50 x 20 matrix means a 50 x 50 of gene-to-gene distances and clustering its
 * columns means a 20 x 20 of sample-to-sample ones. Different objects,
 * different sizes, and a student cannot see that from a dendrogram.
 */
export function distanceMatrix(rows, distance = "euclidean") {
  const fn = DISTANCES[distance].fn;
  const n = rows.length;
  const D = [];
  let max = 0;
  for (let i = 0; i < n; i += 1) {
    D.push(new Float64Array(n));
    for (let j = 0; j < n; j += 1) {
      const d = i === j ? 0 : fn(rows[i], rows[j]);
      D[i][j] = d;
      if (d > max) max = d;
    }
  }
  return { D, n, max };
}

/**
 * The height the cut sits at: midway between the last merge it accepts and the
 * first it refuses.
 *
 * Here rather than in `main.js` because it is a fact about the tree, not about
 * how the tree is drawn — and because a driver that recomputed it would be
 * testing its own arithmetic instead of the figure's.
 */
export function cutHeight(tree, k) {
  const above = tree.height[tree.n - k];
  const below = tree.height[tree.n - k - 1];
  if (above === undefined) return null;
  return below === undefined ? above / 2 : (above + below) / 2;
}

/** A partition as a canonical string, so labels do not matter to equality. */
export function canonical(labels) {
  const seen = new Map();
  return labels.map((l) => {
    if (!seen.has(l)) seen.set(l, seen.size);
    return seen.get(l);
  }).join(";");
}

/**
 * Do the three linkages the widget offers agree on this cut?
 *
 * Reported on the figure because it is the second diagnostic and the cheaper
 * one to read: measured on this stage, the three agree on 94% of seeds at
 * separation 3 and 16% at separation 0. It is evidence, not proof — a noise
 * draw where all three agree exists and the reader may find one.
 */
export function linkagesAgree(rows, k, methods = ["average", "complete", "ward.D2"]) {
  const parts = methods.map((m) => canonical(cut(cluster(rows, m), k)));
  return parts.every((p) => p === parts[0]);
}

/* ---------------------------------------------------------------------------
   THE MATRIX STAGE — the Heatmap tab, and the Cluster tab's objects.

   Genes in four planted blocks, over- and under-expressed in each condition in
   turn, plus GENES WITH NOTHING ADDED AT ALL. That last detail is the whole
   point of the tab: ask for five row boxes and four of them are the planted
   blocks, so the fifth is a box drawn around noise — drawn and labelled
   exactly like the others.

   Measured: at 5 boxes one is pure noise, at 8 two are. On the sample side, a
   stage with exactly two real groups subdivides into 3, 4, 5 and 6 boxes with
   every box still inside a single condition. And the row dendrogram's top
   merge heights fall off a cliff after the fourth merge, which is the evidence
   the boxes throw away.
   ------------------------------------------------------------------------ */
/* TWENTY GENES BY TWENTY SAMPLES. Measured: at fifty genes the matrix rows are
   6px and the gene distance matrix 5px a cell, both too small to read, and the
   box-around-nothing the tab depends on turns up in only 73% of seeds. At
   thirty the rows are 10px, the cells 8.3px, and that box turns up in 91%. At
   twenty it is 86%, everything is legible, and the gene matrix comes out
   20 x 20 — the same size as the sample matrix, so the rows/columns control is
   symmetric. */
export const HEAT_GENES = 20;
export const HEAT_SAMPLES = 20;
export const HEAT_PLANTED = 16;      // genes past this have no structure

/**
 * `perBlock` and `noise` size the matrix, keeping the same four-block
 * structure at any number of rows. It is a legibility question and not a
 * statistical one.
 */
export function heatStage({ lift = 2, perBlock = 4, noise = 4 } = {}, rng = makeRng(1)) {
  const half = HEAT_SAMPLES / 2;
  const planted = 4 * perBlock;
  const genes = planted + noise;
  const rows = [];
  for (let g = 0; g < genes; g += 1) {
    const row = [];
    for (let s = 0; s < HEAT_SAMPLES; s += 1) row.push(rng.normal(0, 1));
    rows.push(row);
  }
  // Four blocks: over then under in one condition, then the same in the other.
  const block = (lo, hi, from, to, delta) => {
    for (let g = lo; g < hi; g += 1) for (let s = from; s < to; s += 1) rows[g][s] += delta;
  };
  block(0, perBlock, half, HEAT_SAMPLES, lift);
  block(perBlock, 2 * perBlock, half, HEAT_SAMPLES, -lift);
  block(2 * perBlock, 3 * perBlock, 0, half, lift);
  block(3 * perBlock, 4 * perBlock, 0, half, -lift);

  /* SHUFFLED, both ways.

     Built in order, genes 0-3 are one block, 4-7 the next, and samples 0-9 are
     one condition — so the raw data matrix arrives with its structure already
     sorted onto the diagonal and LOOKS clustered before anything has clustered
     it. Reported from review as exactly that. Real data does not come with the
     genes conveniently adjacent; finding that order is the work, and a figure
     that starts with the answer cannot show the work.

     The permutation is drawn from the same seeded stream, so the picture is
     still reproducible from the URL, and `planted` and `condition` are
     permuted with it. */
  const permute = (k) => {
    const idx = Array.from({ length: k }, (_, i) => i);
    for (let i = k - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  };
  const gOrder = permute(genes);
  const sOrder = permute(HEAT_SAMPLES);

  const plantedOf = (g) => (lift > 0 && g < planted ? Math.floor(g / perBlock) : null);
  const shuffled = gOrder.map((g) => sOrder.map((sm) => rows[g][sm]));

  return {
    rows: shuffled,                              // genes as 20-vectors
    cols: transpose(shuffled),                   // samples as 20-vectors
    condition: sOrder.map((sm) => (sm < half ? 0 : 1)),
    lift,
    genes,
    perBlock,
    noise,
    /**
     * Which planted block a gene belongs to, or null for a gene with nothing
     * added.
     *
     * IT FOLLOWS `lift`. Derived from the gene's index alone it said genes
     * 0-39 were planted at every setting — so at lift 0, where nothing is
     * added to anything, the readout counted five boxes against forty
     * imaginary blocks and reported "0 of 5 hold no structure" over a matrix
     * that is nothing but noise. Exactly backwards, and finite, so no NaN
     * sweep would have seen it.
     */
    planted: gOrder.map(plantedOf),
  };
}

function transpose(m) {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

/**
 * How well a cut recovered a known grouping, as a number.
 *
 * The figure can only ever ASK "does each box hold one colour?" — a judgement
 * by eye, over a comparison whose two labellings are numbered independently.
 * This states the same thing exactly, and it is invariant to relabelling
 * because it never looks at a label's value: for each cut group it counts the
 * largest true group inside it.
 *
 * `pure` is the count of cut groups that hold exactly one true group and
 * `purity` the fraction of objects in their group's majority. Purity goes to 1
 * if you ask for enough clusters, so a caller must print `k` beside it.
 */
export function agreement(labels, truth) {
  const members = new Map();
  labels.forEach((l, i) => {
    if (!members.has(l)) members.set(l, []);
    members.get(l).push(i);
  });
  let hit = 0;
  let pure = 0;
  for (const idx of members.values()) {
    const tally = new Map();
    for (const i of idx) tally.set(truth[i], (tally.get(truth[i]) ?? 0) + 1);
    hit += Math.max(...tally.values());
    if (tally.size === 1) pure += 1;
  }
  return { pure, total: members.size, purity: hit / labels.length };
}

/**
 * Which of the k boxes contain no planted gene at all.
 *
 * A box of unstructured genes is drawn and labelled exactly like a real one,
 * and nothing on a heatmap distinguishes them — so the widget has to say it,
 * and it can, because `planted` is ground truth it holds.
 */
export function noiseBoxes(labels, planted) {
  const members = new Map();
  labels.forEach((l, i) => {
    if (!members.has(l)) members.set(l, []);
    members.get(l).push(i);
  });
  const out = [];
  for (const [label, idx] of members) {
    if (idx.every((i) => planted[i] === null)) out.push({ label, size: idx.length });
  }
  return out;
}
