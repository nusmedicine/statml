/* ============================================================================
   Trees and forests — the model code behind the widget-17 lab page.

   A CART, a bootstrap forest and discrete AdaBoost, written from scratch:
   nothing in the repo implements a decision tree, Gini, bootstrap resampling
   or a forest, so all of this is new. It lives in `_lab/` because the page
   next door is a design comparison and nothing here is deployed — but it is
   NOT throwaway. Widget 17 will copy from this file, so it is written the way
   `widgets/core/` is written, and every number it produces is asserted against
   `widgets/_lab/tree-forest-reference.json` (a numpy port of this same
   protocol, itself cross-checked against scikit-learn).

   Five things in here are load-bearing and easy to get wrong. Each is
   commented where it happens; they are listed here so a reader knows what to
   look for before changing anything.

     1. THE DRAW ORDER IS THE GEOMETRY. `rng.normal()` caches its Box–Muller
        spare, so the number AND order of rng calls per point is part of the
        point cloud. The generators are transcribed from widget 16 call for
        call, not merely "the same distribution".
     2. THE FOREST DRAWS FROM THE SAME STREAM the data came from — one
        `rng.int(0, 1)` at every node eligible to split, in PRE-ORDER, with no
        fallback when the drawn feature turns out to be dead. All three of
        those clauses are observable in the boundary at B = 50; see fitForest.
     3. THE PARTITION IS DRAWN AS RECTANGLES, never as a contour. See
        `levelRects`.
     4. TIE-BREAKS ARE PART OF THE MODEL. Lowest feature index, then lowest
        threshold; a leaf tie predicts -1; a forest vote of exactly 0.5 is -1.
        The last of those moves the headline jaggedness number by 15-30%.
     5. BOOSTING IS DISCRETE ADABOOST WITH A FULL STEP. Gradient boosting at
        the usual learning_rate = 0.1 has not converged in 50 rounds and its
        per-round repaint vanishes — which is how boosting came to be cut from
        this widget on a mis-specified measurement the first time round.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

/* --- the stage ------------------------------------------------------------ *
 * Copied from `widgets/support-vector-machine/main.js`. Widget 17 shares
 * widget 16's stage exactly so the two read as one arc: same square domain,
 * same point count, same seed, so a reader can flip between the two tabs and
 * see the same cloud under a different model.                                */

export const DOM = [-2.2, 2.2];
export const N_PER_CLASS = 90;
export const N = N_PER_CLASS * 2;

/* Widget 16 declares no `seed` param, and `widgets/core/widget.js` falls back
   to `makeRng(values.seed ?? 1)`. So the cloud everyone has actually seen is
   seed 1, and every reference number in tree-forest-reference.json is at
   seed 1. Naming it here rather than writing `1` at four call sites. */
export const SEED = 1;

/* Layout constants, also widget 16's. `planeSide` is the square panel's side
   in CSS pixels, and every px figure this module reports is in CSS pixels —
   never backing-store pixels, which on this machine are 1.25x larger. */
export const PAD_L = 44, PAD_R = 12, PAD_T = 22, PAD_B = 44, SIDE_MAX = 560;
export const planeSide = (w) => Math.min(SIDE_MAX, Math.max(200, w - PAD_L - PAD_R));

/* ============================================================================
   The generators.

   Transcribed from widget 16's `SETS`, which cannot be imported: that file
   calls `defineWidget({…})` at module scope, so importing it would mount a
   whole widget, and `SETS` is not exported in any case.

   THE TRANSCRIPTION IS CALL-FOR-CALL, NOT DISTRIBUTION-FOR-DISTRIBUTION, and
   that is the whole difficulty. `rng.normal()` consumes two `next()` draws and
   caches the second variate as a spare, which the NEXT call to `normal()`
   returns for free. So:

     blobs  costs 2 draws per point (normal, normal — the second is the spare)
     rings  costs 3 (uniform, then normal, normal)
     moons  costs 3 (uniform, then normal, normal)

   and `make()` therefore leaves the stream at draw 360 for blobs and 540 for
   rings and moons. That position is not bookkeeping: the forest continues the
   same stream, so a generator that drew its noise in a different order would
   hand the forest a different bootstrap and every forest number below would
   move. (A pleasant consequence of rings and moons costing the same: their
   first bootstrap index arrays are identical.)

   Two transcription hazards, both silent if you get them wrong:

     - The object literal `{ x1: rng.normal(…), x2: rng.normal(…) }` evaluates
       its properties in source order, exactly as widget 16's array literal
       `[rng.normal(…), rng.normal(…)]` evaluates its elements. Swapping the
       two lines swaps which coordinate gets the fresh pair and which gets the
       spare, and the cloud changes without any error.
     - The class ORDER matters for the same reason. blobs and rings emit -1
       first; moons emits +1 first.

   The departure from widget 16 is the point shape: `{ x1, x2, y }` here
   against `{ x: [a, b], y }` there. Named fields because a tree talks about
   "feature 0" and "feature 1" constantly and `p.x[0]` reads worse than `p.x1`
   at every one of those sites. `featureOf` below is the single place the two
   namings meet.
   ========================================================================= */

/* The wave's two shape constants. Declared before SETS rather than beside the
   generator that uses them, because the frequency is the one number a reviewer
   will want to change and it should not be buried three screens down. */
export const WAVE_FREQ = 6.0;
export const WAVE_AMP = 1.2;

export const SETS = {
  blobs: {
    label: "Two blobs",
    detail: "A straight line already separates these.",
    make(rng) {
      const out = [];
      for (const y of [-1, 1]) {
        const cx = y * 0.95, cy = y * 0.8;
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          out.push({ x1: rng.normal(cx, 0.42), x2: rng.normal(cy, 0.42), y });
        }
      }
      return out;
    },
  },

  rings: {
    label: "Rings",
    detail: "One class surrounds the other. No straight line can do this.",
    make(rng) {
      const out = [];
      for (const [y, r] of [[-1, 0.75], [1, 1.72]]) {
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          const t = rng.uniform(0, Math.PI * 2);
          out.push({
            x1: r * Math.cos(t) + rng.normal(0, 0.12),
            x2: r * Math.sin(t) + rng.normal(0, 0.12),
            y,
          });
        }
      }
      return out;
    },
  },

  moons: {
    label: "Crescents",
    detail: "Two interleaving arcs. No straight line can do this either.",
    /* The upper arc is +1, and widget 16 records why: the kernel space puts +1
       above the boundary by definition, so labelling the arcs the other way
       round made the lift look like an unexplained mirror. A tree has no such
       lift, but the labelling is kept because the two widgets share a cloud. */
    make(rng) {
      const out = [];
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x1: 1.25 * (Math.cos(t) - 0.5) + rng.normal(0, 0.11),
          x2: 1.25 * (Math.sin(t) - 0.25) + rng.normal(0, 0.11),
          y: 1,
        });
      }
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x1: 1.25 * (0.5 - Math.cos(t)) + rng.normal(0, 0.11),
          x2: 1.25 * (0.25 - Math.sin(t)) + rng.normal(0, 0.11),
          y: -1,
        });
      }
      return out;
    },
  },

  /* --- the fourth generator, and it exists only for boosting ---------------
   *
   * Boosting was cut from this widget once already, on the finding that it
   * repaints 0.00%-0.19% of the panel per round against a forest's 5.70%.
   * That measurement reproduces EXACTLY — but only when the weak learner is a
   * full-depth CART, which fits all three sets above at round 1 and leaves
   * AdaBoost with nothing to do. It measured a mis-specified weak learner, not
   * a property of boosting.
   *
   * With a depth-2 stump the picture changes, but not enough on these three:
   * blobs still terminates at round 1 (the classes are 5.9 sd apart), and on
   * crescents boosting only ties the forest's repaint. A sweep of 41 candidate
   * generators found exactly one that clears both bars — more per-round
   * repaint than the forest AND a real accuracy advantage that survives every
   * fair forest configuration:
   *
   *   AdaBoost depth-2, 50 rounds, 100 data seeds, balanced accuracy 0.905
   *     vs forest B=50 mf=1 msl=2  0.881   +2.43 points, 93% of seeds
   *     vs forest B=500 mf=2 msl=1 0.876   +2.93 points, 97% of seeds
   *     vs a single CART           0.860   +4.46 points, 97% of seeds
   *
   * The decisive fact is the second row: boosting beats the STRONGEST forest
   * by more than it beats the hobbled one. Three other candidates posted
   * larger headline wins (a thin diagonal corridor, +5.44 points; a 3x3
   * checkerboard, +3.43) and all of them collapsed the moment the forest was
   * allowed a fair configuration — the corridor's win was class imbalance
   * under balanced accuracy, the checkerboard's was max_features=1 failing on
   * a parity grid. Repaint alone is not enough either: a minority-pocket set
   * had boosting repainting 7.5x the forest with no accuracy advantage at all.
   *
   * THE ACCURACY BAR IS THE ONE THAT HOLDS. Re-measured here on the mulberry32
   * stream: 0.9044 against the forest's 0.8765 over 100 seeds, +2.78 points,
   * boosting ahead in 98 of 100. That reproduces the probe.
   *
   * THE REPAINT BAR DOES NOT HOLD AT THE STRENGTH CLAIMED, and a widget that
   * promises "boosting churns twice as hard as the forest" will not deliver
   * it. Rounds 2-10, 100 seeds, measured on this engine:
   *
   *   AdaBoost d2                  6.38% +/- 0.52   (sd 5.19, MEDIAN 4.82%)
   *   forest, hard vote (ours)     4.91% +/- 0.10   (sd 1.01, median 5.00%)
   *   forest, soft vote (sklearn)  4.28% +/- 0.09
   *
   * so 1.30x against our own forest, not 1.9x — and boosting repaints more
   * than the forest in only 50 of 100 seeds. On the median the two are level;
   * the mean is carried by a long right tail (per-seed values run 0.07% to
   * 26%). Three things compounded into the published 1.9x, and all three are
   * reproducible: the probe averaged 8 seeds of a statistic whose sd is 5.19,
   * so its 7.36% sits about one standard error above the 100-seed mean; it
   * compared against scikit-learn's forest, which averages leaf PROBABILITIES
   * and therefore repaints 13% less than the hard majority vote this widget is
   * specified to use (3.87% vs 4.55% on identical fits); and the skew makes
   * any small-sample mean read high. The engine's AdaBoost is not in doubt —
   * run on the probe's own eight clouds it reproduces sklearn's alphas to the
   * last digit and its repaint band to 0.01 of a percentage point.
   *
   * What that leaves for a widget to argue: the accuracy claim, and a shape of
   * churn rather than an amount of it (98.8% of boosting's repainted pixels
   * lie inside the hard strip |x2| < 1.2, against the forest's 92.2%). "Twice
   * as much repainting per round" is not available and should not be printed.
   *
   * Two properties of the picture, both measured over 200 seeds and both the
   * reason this shape is drawable rather than merely winning: 4.20 periods
   * across the domain at ~43 points per period, so the wave is resolvable by
   * eye rather than aliased; and a +1 fraction of 0.503 (range 0.411-0.600),
   * so it is naturally balanced and none of the imbalance artefacts that
   * killed the corridor can arise. The hard region is the strip |x2| < 1.2 —
   * 55% of the panel height, holding 54% of the points — so round 1 settles
   * the top and bottom of the panel and every later round visibly works on the
   * strip. That is the sequential-correction reading the widget would exist to
   * show.
   *
   * Frequency was chosen on the picture, not the numbers: the advantage grows
   * monotonically with frequency (+0.70 points at 3.0, +3.14 at 7.0), and 6.0
   * is the highest that still reads as a wave rather than a texture.
   *
   * The one departure from widget 16's conventions: the class split falls out
   * of the geometry instead of being fixed at 90 per class, so the draw order
   * is x1 then x2 for all 180 points and there is no per-class loop. Two
   * uniforms and one sine — no Gaussian noise, no label flips, no rejection
   * sampling. Label noise in particular must NOT be added: across eight noisy
   * generators boosting trails the forest by 2.2 to 5.9 points at win rates of
   * 0-10%, because AdaBoost upweights the flipped labels and memorises them.
   */
  wave: {
    label: "Wave",
    detail: "The boundary bends back on itself four times. No one split follows it.",
    make(rng) {
      const out = [];
      for (let i = 0; i < N; i += 1) {
        const x1 = rng.uniform(DOM[0], DOM[1]);
        const x2 = rng.uniform(DOM[0], DOM[1]);
        out.push({ x1, x2, y: x2 > WAVE_AMP * Math.sin(WAVE_FREQ * x1) ? 1 : -1 });
      }
      return out;
    },
  },
};

/** The one place feature index and coordinate name meet. */
export const featureOf = (p, j) => (j === 0 ? p.x1 : p.x2);

/** The feature names, in index order — for axis labels and node text. */
export const FEATURE_NAMES = ["x₁", "x₂"];

/**
 * The cloud a given set opens on, plus the stream it left behind.
 *
 * Returned together on purpose: the forest MUST continue this exact generator,
 * and handing back a fresh `makeRng(SEED)` alongside the points would be the
 * single easiest way to get a plausible-looking forest that matches nothing.
 */
export function makeData(setName, seed = SEED) {
  const rng = makeRng(seed);
  const points = SETS[setName].make(rng);
  return { points, rng };
}

/* ============================================================================
   CART.

   The protocol, written out because every clause of it is observable and
   because the JS and the numpy reference have to agree on all of them:

     - a node splits iff it is IMPURE and n >= 2 * minLeaf and depth < maxDepth
     - candidate thresholds are midpoints of consecutive DISTINCT sorted values
     - a candidate is valid iff both sides hold >= minLeaf samples
     - score is the weighted child Gini, minimised
     - ties go to the lower feature index, then the lower threshold
     - x[j] <= thr goes LEFT
     - a leaf predicts the majority class, and a tie predicts -1

   Tie tolerance is deliberately absent. Tolerances of 0, 1e-15, 1e-12 and
   1e-9 were measured to produce byte-identical trees on all three sets, so
   the ties that occur are exact equalities between identically-computed
   scores rather than near misses, and a plain strict `<` is the honest rule.
   ========================================================================= */

/** Weighted Gini of one side, from its two weighted class sums. */
function gini(w0, w1) {
  const W = w0 + w1;
  if (W <= 0) return 0;
  const p0 = w0 / W, p1 = w1 / W;
  return 1 - p0 * p0 - p1 * p1;
}

/**
 * Fit a CART.
 *
 * @param points  [{ x1, x2, y }] with y in {-1, +1}
 * @param minLeaf   min samples in a leaf. A COUNT, never a weight — sklearn's
 *                  min_samples_leaf is a count, and boosting must not be able
 *                  to shrink a leaf below it by downweighting.
 * @param maxDepth  depth cap; the root is depth 0, so maxDepth 2 gives at most
 *                  4 leaves. Infinity is the widget's tree and the forest's.
 * @param features  how many of the two features each split may consider.
 *                  2 = both (a plain CART, no rng draws at all).
 *                  1 = one drawn per node from `rng` — the forest's rule.
 * @param weights   optional per-point weights, for AdaBoost. Absent means all
 *                  ones, and with all ones the weighted arithmetic below is
 *                  bit-identical to the unweighted formula, which is why there
 *                  is only one code path rather than two that drift.
 * @param rng       required iff features < 2.
 */
export function fitTree(points, { minLeaf = 2, maxDepth = Infinity, features = 2, weights = null, rng = null } = {}) {
  const n = points.length;
  if (features < 2 && !rng) throw new Error("fitTree: features < 2 needs an rng");

  /* Flat typed columns rather than the object array: the split sweep touches
     every value at every node, and the vote grid fits fifty of these. */
  const col = [new Float64Array(n), new Float64Array(n)];
  const y = new Int8Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    col[0][i] = points[i].x1;
    col[1][i] = points[i].x2;
    y[i] = points[i].y;
    w[i] = weights ? weights[i] : 1;
  }

  const data = { col, y, w };
  const rootRect = { x1: [DOM[0], DOM[1]], x2: [DOM[0], DOM[1]] };
  const idx = new Array(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;

  const tree = grow(idx, data, rootRect, 0, { minLeaf, maxDepth, features, rng });
  tree.nTrain = n;
  return tree;
}

function grow(idx, data, rect, depth, opt) {
  const { col, y, w } = data;
  const n = idx.length;

  let c0 = 0, c1 = 0, wc0 = 0, wc1 = 0;
  for (const i of idx) {
    if (y[i] > 0) { c1 += 1; wc1 += w[i]; } else { c0 += 1; wc0 += w[i]; }
  }

  const node = {
    depth,
    n,
    counts: [c0, c1],
    wcounts: [wc0, wc1],
    /* A tie predicts -1. Arbitrary, but it has to be written down somewhere:
       widget-16's blobs tree carries a (1,1) leaf, so the rule is visible in
       the very first picture the reader sees. */
    pred: wc1 > wc0 ? 1 : -1,
    rect,
    feature: null,
    threshold: null,
    left: null,
    right: null,
    leaf: null,
  };

  /* Eligibility, and the order of these three clauses is the rng contract:
     the feature draw below happens once per ELIGIBLE node and not otherwise,
     so anything that short-circuits before the draw must short-circuit in the
     reference too. Impurity is a count test, not a weight test — a node whose
     minority class has been driven to a tiny weight by boosting is still
     impure and still worth splitting. */
  const impure = c0 > 0 && c1 > 0;
  if (!impure || n < 2 * opt.minLeaf || depth >= opt.maxDepth) {
    node.leaf = node.pred;
    return node;
  }

  /* ONE draw per eligible node, in pre-order: draw here, then recurse left
     fully, then right. Not one draw per feature and not one per tree — the
     count and the order both show up in the boundary, because every draw
     shifts the stream for every node after it.

     NO FALLBACK when the drawn feature admits no valid split: the node simply
     becomes a leaf. That is not cosmetic. A drawn feature is dead at 1.6-2.5%
     of eligible nodes, and falling back to the other feature moves rings from
     436 cuts / 146 runs to 437 / 148 and crescents from 512 / 143 to 514 / 147
     at B = 50, while leaving every B = 1, 5 and 15 row untouched. A forest
     mismatch that appears only at B = 50 is this rule and nothing else. */
  let feats;
  if (opt.features >= 2) {
    feats = [0, 1];
  } else {
    feats = [opt.rng.int(0, 1)];
  }

  const split = bestSplit(idx, data, opt.minLeaf, feats);
  if (!split) {
    node.leaf = node.pred;
    return node;
  }

  /* Partition by the stored threshold rather than by the sweep position that
     found it. The two agree, but only the threshold survives into prediction,
     so partitioning by anything else would let a leaf's counts describe a set
     of points the fitted tree does not actually route there. */
  const lo = [], hi = [];
  for (const i of idx) {
    if (col[split.feature][i] <= split.threshold) lo.push(i); else hi.push(i);
  }

  node.feature = split.feature;
  node.threshold = split.threshold;
  node.left = grow(lo, data, narrow(rect, split.feature, "lo", split.threshold), depth + 1, opt);
  node.right = grow(hi, data, narrow(rect, split.feature, "hi", split.threshold), depth + 1, opt);
  return node;
}

/**
 * The child's rectangle, clamped to DOM.
 *
 * Clamped because a threshold is the midpoint of two DATA values and the
 * generators are not bounded by DOM — blobs draws from a normal, so a point
 * beyond ±2.2 is rare but possible, and an unclamped rect would then run off
 * the panel and paint over the axis. At seed 1 no threshold on any of the four
 * sets lies outside DOM, so this clamp is invisible in every reference number.
 */
function narrow(rect, feature, side, thr) {
  const key = feature === 0 ? "x1" : "x2";
  const out = { x1: rect.x1.slice(), x2: rect.x2.slice() };
  if (side === "lo") out[key][1] = Math.min(out[key][1], Math.max(out[key][0], thr));
  else out[key][0] = Math.max(out[key][0], Math.min(out[key][1], thr));
  return out;
}

function bestSplit(idx, data, minLeaf, feats) {
  const { col, y, w } = data;
  const n = idx.length;

  let W = 0, T0 = 0, T1 = 0;
  for (const i of idx) {
    W += w[i];
    if (y[i] > 0) T1 += w[i]; else T0 += w[i];
  }

  let best = null;

  /* Features in ascending index order, thresholds in ascending value order,
     and a new best accepted only on strict `<`. Those three together ARE the
     tie-break rule — there is no separate tie-breaking pass. */
  for (const j of feats) {
    const c = col[j];
    const order = idx.slice().sort((a, b) => c[a] - c[b]);

    let L0 = 0, L1 = 0;
    for (let k = 1; k < n; k += 1) {
      const prev = order[k - 1];
      if (y[prev] > 0) L1 += w[prev]; else L0 += w[prev];

      /* A candidate exists only BETWEEN DISTINCT values. Splitting inside a
         run of equal values is not representable by a threshold test. */
      if (c[order[k]] === c[prev]) continue;
      if (k < minLeaf || n - k < minLeaf) continue;

      const R0 = T0 - L0, R1 = T1 - L1;
      const WL = L0 + L1, WR = R0 + R1;
      const score = (WL * gini(L0, L1) + WR * gini(R0, R1)) / W;

      if (best === null || score < best.score) {
        best = { feature: j, threshold: (c[prev] + c[order[k]]) / 2, score };
      }
    }
  }

  return best;
}

/** A node is a leaf iff it has no children. `leaf` holds its class. */
export const isLeaf = (node) => node.left === null;

/** Route one point to its leaf and return the leaf's class. */
export function predictTree(tree, x1, x2) {
  let node = tree;
  while (node.left !== null) {
    const v = node.feature === 0 ? x1 : x2;
    node = v <= node.threshold ? node.left : node.right;
  }
  return node.leaf;
}

/** Depth of the deepest leaf. The root alone is depth 0. */
export function treeDepth(node) {
  if (isLeaf(node)) return node.depth;
  return Math.max(treeDepth(node.left), treeDepth(node.right));
}

/** [leaves, cuts] for the whole tree. `cuts` counts internal nodes. */
export function treeSize(node) {
  if (isLeaf(node)) return [1, 0];
  const l = treeSize(node.left), r = treeSize(node.right);
  return [l[0] + r[0], l[1] + r[1] + 1];
}

/** Every internal node in pre-order — the order the cuts were chosen in. */
export function cutsPreOrder(node, out = []) {
  if (isLeaf(node)) return out;
  out.push({ depth: node.depth, feature: node.feature, threshold: node.threshold, n: node.n, counts: node.counts });
  cutsPreOrder(node.left, out);
  cutsPreOrder(node.right, out);
  return out;
}

/* ============================================================================
   The partition, as rectangles.

   RECTANGLES AND NOT A CONTOUR, and this is the one drawing decision in the
   file that is a measured failure rather than a preference.

   The obvious way to paint a classifier's regions is to sample a grid of the
   predicted class and run marching squares at level 0, which is exactly what
   widget 16 does for its kernel corridor. For a tree it throws away the tree.
   A cut between two leaves that happen to predict the SAME class produces no
   contour at all, so the split vanishes from the picture while remaining in
   the model — and that is not a corner case here, it is the FIRST thing the
   reader sees:

     - blobs at seed 1 has 4 leaves and only 2 visible class patches. Two of
       the four leaves, (87,0) and (1,1), both predict -1, so the whole of the
       root cut's left half is one flat colour and a contour shows one line
       where the tree made three cuts.
     - crescents carries a 364.78 x 3.49 px leaf that predicts +1 with a +1
       leaf directly above it. Invisible as a class region; a 3.5 px band if
       leaf rectangles are outlined.

   A tree's regions are axis-aligned boxes and are known exactly from the
   thresholds, so the exact thing is also the cheap thing. Marching squares
   would additionally round corners the tree does not have.
   ========================================================================= */

/**
 * The leaf rectangles of the tree TRUNCATED at `level`.
 *
 * Level 0 is the root as a single rect covering DOM; level 1 is the two halves
 * of the first cut; a level past the tree's depth is the finished partition.
 * Because CART is greedy and top-down, growing to depth L and truncating a
 * full tree at depth L give the same rectangles — the widget's level control
 * can therefore reveal one fitted tree rather than refit at every step.
 *
 * Each rect carries the counts that reached it, so `wrongIn` can price the
 * level without a second pass over the data.
 */
export function levelRects(tree, level = Infinity, out = []) {
  if (isLeaf(tree) || tree.depth >= level) {
    out.push({
      x1: tree.rect.x1.slice(),
      x2: tree.rect.x2.slice(),
      pred: tree.pred,
      n: tree.n,
      counts: tree.counts.slice(),
      depth: tree.depth,
      /* True only when this rect is a real leaf of the fitted tree; a rect the
         level cap manufactured is still splittable and should not be drawn as
         if the tree had finished with it. */
      terminal: isLeaf(tree),
    });
    return out;
  }
  levelRects(tree.left, level, out);
  levelRects(tree.right, level, out);
  return out;
}

/** Training samples the truncated tree gets wrong, from the rects alone. */
export function wrongIn(rects) {
  let wrong = 0;
  for (const r of rects) wrong += r.pred > 0 ? r.counts[0] : r.counts[1];
  return wrong;
}

/** The per-level table the lab page prints: leaves, cuts and cost at depth L. */
export function levelSummary(tree, level) {
  const rects = levelRects(tree, level);
  return {
    level,
    leaves: rects.length,
    /* A binary tree with L leaves has L-1 internal nodes, always. Deriving it
       rather than counting is one fewer traversal that can disagree. */
    cuts: rects.length - 1,
    wrong: wrongIn(rects),
    rects,
  };
}

/** Rect width and height in CSS pixels on a `sidePx` square panel. */
export function rectPx(rect, sidePx) {
  const span = DOM[1] - DOM[0];
  return {
    wPx: ((rect.x1[1] - rect.x1[0]) / span) * sidePx,
    hPx: ((rect.x2[1] - rect.x2[0]) / span) * sidePx,
  };
}

/* ============================================================================
   The forest.
   ========================================================================= */

/**
 * Bootstrap forest, max_features = 1 of 2.
 *
 * @param rng  MUST be the generator that produced `points`, positioned exactly
 *             where `make()` left it. Not a fresh `makeRng(SEED)`: the whole
 *             forest is a continuation of one stream, and a fresh generator
 *             would give a forest that is internally consistent, plausible,
 *             deterministic, and matches no reference number in the repo.
 *
 * Per member, in this order and no other:
 *   1. `rng.resample(n)` — n draws, the bootstrap INDICES
 *   2. grow with features = 1, which spends one `rng.int(0, 1)` at each
 *      eligible node in pre-order
 *
 * Members are returned in fitting order and every accessor takes a prefix
 * length `k`, because the widget's B control is a prefix of one fitted forest
 * rather than a refit: refitting at each B would redraw the stream and make
 * the first tree change when the reader asked for more trees.
 */
export function fitForest(points, { B = 50, minLeaf = 2, rng } = {}) {
  if (!rng) throw new Error("fitForest: needs the rng that made the points");
  const n = points.length;
  const members = [];
  const cutsCum = [];
  const leavesCum = [];
  let cuts = 0, leaves = 0;

  for (let b = 0; b < B; b += 1) {
    const idx = rng.resample(n);
    const sample = new Array(n);
    for (let i = 0; i < n; i += 1) sample[i] = points[idx[i]];
    const tree = fitTree(sample, { minLeaf, features: 1, rng });
    tree.bootstrap = idx;
    members.push(tree);
    const [lv, ct] = treeSize(tree);
    cuts += ct; leaves += lv;
    cutsCum.push(cuts); leavesCum.push(leaves);
  }

  /** Share of the first `k` members voting +1. */
  const voteAt = (x1, x2, k = members.length) => {
    let pos = 0;
    for (let b = 0; b < k; b += 1) if (predictTree(members[b], x1, x2) > 0) pos += 1;
    return pos / k;
  };

  /* p == 0.5 goes to -1, and this is not a detail. Only 0.28-0.84% of the
     panel ever sits at exactly 0.5 (and only at even B), but flipping the tie
     to +1 moves rings from 146 boundary runs to 124 and crescents from 143 to
     187 — a 15-30% swing in the headline jaggedness number off less than one
     percent of the picture. */
  const classify = (p) => (p > 0.5 ? 1 : -1);

  return {
    members,
    B: members.length,
    voteAt,
    classify,
    predictAt: (x1, x2, k = members.length) => classify(voteAt(x1, x2, k)),
    /** Total internal nodes across the first `k` members. */
    cutsUpTo: (k = members.length) => (k > 0 ? cutsCum[k - 1] : 0),
    leavesUpTo: (k = members.length) => (k > 0 ? leavesCum[k - 1] : 0),
    cuts,
    leaves,
    /** Training points the first `k` members get wrong, by majority vote. */
    wrongAt(k = members.length) {
      let wrong = 0;
      for (const p of points) if (classify(voteAt(p.x1, p.x2, k)) !== p.y) wrong += 1;
      return wrong;
    },
  };
}

/* ============================================================================
   Boosting — discrete AdaBoost (SAMME), full step.

   Included because the probe found a stage worth it, and the stage is the
   `wave` generator above rather than any of widget 16's three. Read the note
   on `SETS.wave` before using this on anything else: on blobs it terminates at
   round 1 and there is no sequence to watch.

   THE ALGORITHM IS A CONSTRAINT, NOT A CHOICE. On the winning generator, over
   100 seeds:

     AdaBoost, depth 2, 50 rounds          0.9050
     gradient boosting, lr = 1.0           0.8993
     gradient boosting, lr = 0.5           0.8943
     gradient boosting, lr = 0.1 (default) 0.8540   <- 2.67 points BELOW a forest

   Shrinkage at the usual learning rate has not converged in fifty rounds, and
   it is also what makes the per-round repaint vanish. Anyone who reaches for
   GradientBoostingClassifier's defaults will rediscover the original negative
   result and conclude, again, that boosting has nothing to show.

   Depth is the other setting that matters and it is forgiving here: depth 2
   and depth 3 are statistically indistinguishable on the wave (0.9050 vs
   0.9066, p = 0.06) while depth 1 is much worse (0.8732). Depth 2 by default,
   because a stump that can make one cut in each feature is the smallest thing
   that can be called a model of a curve.
   ========================================================================= */

/**
 * @param rounds    M. 50 is where the measurements were taken; the advantage
 *                  is flat from 50 to 200 (+2.43, +2.55, +2.49 points) and
 *                  roughly half of it is present by 25.
 * @param maxDepth  the weak learner's depth cap. 2, see above.
 * @param minLeaf   1, not the tree's 2 — a weak learner is meant to be weak in
 *                  DEPTH, and a leaf-size floor on top of a depth cap is a
 *                  second, redundant handicap.
 *
 * No rng: AdaBoost is deterministic given the data. Every member sees every
 * point and every feature; only the weights move.
 */
export function fitBoost(points, { rounds = 50, maxDepth = 2, minLeaf = 1 } = {}) {
  const n = points.length;
  const w = new Float64Array(n).fill(1 / n);
  const members = [];

  for (let m = 0; m < rounds; m += 1) {
    const tree = fitTree(points, { minLeaf, maxDepth, features: 2, weights: w });

    const wrong = new Uint8Array(n);
    let err = 0, W = 0;
    for (let i = 0; i < n; i += 1) {
      W += w[i];
      if (predictTree(tree, points[i].x1, points[i].x2) !== points[i].y) {
        wrong[i] = 1;
        err += w[i];
      }
    }
    err /= W;

    /* A weak learner that fits the weighted data perfectly ends the sequence:
       there is nothing left to reweight, and 0.5*ln((1-0)/0) is infinite.
       sklearn keeps the member at weight 1 and stops, so this does too.

       THIS IS THE WHOLE STORY OF THE ORIGINAL NEGATIVE RESULT. With a
       full-depth CART as the weak learner, err is 0 at round 1 on all three of
       widget 16's sets — mean rounds to termination, 1.0 — so "boosting
       repaints 0.00% of the panel per round" was measuring a single tree with
       forty-nine empty rounds after it. */
    if (err <= 0) {
      members.push({ tree, alpha: 1, err: 0, terminated: "perfect" });
      break;
    }
    /* Worse than a coin flip at two classes: the member is discarded and the
       sequence stops rather than being handed a negative weight. */
    if (err >= 0.5) break;

    const alpha = 0.5 * Math.log((1 - err) / err);
    members.push({ tree, alpha, err, terminated: null });

    /* w_i *= exp(-alpha * y_i * h_m(x_i)), then renormalise. Written as the
       two-case form because `wrong` is already computed and exp() is the
       expensive call here. Note this is Freund & Schapire's alpha, half of
       sklearn's SAMME estimator weight — after renormalisation the two give
       an identical weight vector (the ratio wrong:right is (1-err)/err either
       way) and an identical decision (a positive rescaling of the same sum),
       which is why this reproduces AdaBoostClassifier to 4 dp. */
    const up = Math.exp(alpha), down = Math.exp(-alpha);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      w[i] *= wrong[i] ? up : down;
      sum += w[i];
    }
    for (let i = 0; i < n; i += 1) w[i] /= sum;
  }

  /** The margin after `k` rounds: sum of alpha_m * h_m(x). */
  const scoreAt = (x1, x2, k = members.length) => {
    let s = 0;
    for (let m = 0; m < k; m += 1) s += members[m].alpha * predictTree(members[m].tree, x1, x2);
    return s;
  };

  return {
    members,
    rounds: members.length,
    scoreAt,
    /* Sign of the margin; an exact zero goes to -1, matching the leaf and vote
       tie rules so the three tie-breaks in this file all point the same way. */
    predictAt: (x1, x2, k = members.length) => (scoreAt(x1, x2, k) > 0 ? 1 : -1),
  };
}

/* ============================================================================
   Rasters and boundary geometry.

   Every px number this module reports is a CSS-pixel number on a square panel
   of `sidePx`, measured on a raster of PIXEL CENTRES over DOM. That convention
   lives here and nowhere else — the reference table already carries two wrong
   numbers ("226 x 253 px", "59 px") produced by measuring the same boxes
   against a ±2.5 domain, which is what a second copy of this arithmetic buys
   you.
   ========================================================================= */

/** Centre of raster cell `i` of `side`, in domain units. */
export const cellCentre = (i, side) => DOM[0] + ((i + 0.5) * (DOM[1] - DOM[0])) / side;

/**
 * `side` x `side` labels from any classifier, row-major with `i` the x1 column
 * and `j` the x2 row: `grid[j * side + i]`.
 */
export function rasterise(labelOf, side) {
  const g = new Int8Array(side * side);
  for (let j = 0; j < side; j += 1) {
    const x2 = cellCentre(j, side);
    for (let i = 0; i < side; i += 1) g[j * side + i] = labelOf(cellCentre(i, side), x2);
  }
  return g;
}

/**
 * The same raster for one tree, filled by leaf rectangle instead of by point.
 *
 * Identical output to `rasterise((a, b) => predictTree(tree, a, b), side)` by
 * construction — the index bounds below are the algebraic inverse of the same
 * `<= threshold` test — but it costs one fill per leaf instead of one tree
 * walk per cell, which is what makes a fifty-member vote grid affordable. The
 * verify script asserts the two agree rather than trusting that sentence.
 *
 * Pass `out` to accumulate; otherwise a fresh Int8Array comes back.
 */
export function rasteriseTree(tree, side, out = new Int8Array(side * side)) {
  const step = (DOM[1] - DOM[0]) / side;
  for (const r of levelRects(tree)) {
    /* c(i) = DOM0 + (i + 0.5) * step, so
         c(i) >  lo  <=>  i >  (lo - DOM0)/step - 0.5
         c(i) <= hi  <=>  i <= (hi - DOM0)/step - 0.5
       Both bounds derive from `floor` of the same expression, so adjacent
       rects meet exactly: no gap, no overlap, no cell written twice. */
    const i0 = Math.max(0, Math.floor((r.x1[0] - DOM[0]) / step - 0.5) + 1);
    const i1 = Math.min(side - 1, Math.floor((r.x1[1] - DOM[0]) / step - 0.5));
    const j0 = Math.max(0, Math.floor((r.x2[0] - DOM[0]) / step - 0.5) + 1);
    const j1 = Math.min(side - 1, Math.floor((r.x2[1] - DOM[0]) / step - 0.5));
    for (let j = j0; j <= j1; j += 1) {
      const row = j * side;
      for (let i = i0; i <= i1; i += 1) out[row + i] = r.pred;
    }
  }
  return out;
}

/**
 * Boundary geometry of a labelled raster.
 *
 * The definitions, because "how jagged is it" has several plausible answers
 * and they disagree by a factor of three:
 *
 *   edge    a unit lattice segment between two 4-adjacent cells carrying
 *           different labels. The panel edge is never an edge.
 *   run     a maximal collinear contiguous chain of edges. A run is NOT
 *           broken at a T-junction.
 *   corner  a lattice vertex touched by at least one vertical AND at least
 *           one horizontal edge. A T-junction counts once.
 *
 * This counts RASTER runs, not cut lines. An earlier pass counted cut lines
 * and reported 46 corners where this reports 146 — the numbers are not
 * comparable and the raster one is the one the reader can see, because two
 * collinear cuts from different trees paint one visible line.
 *
 * The relationship between `runs` and `corners` is a free self-check on this
 * function, but state it in the general form or it will fire falsely:
 *
 *     runs - corners == the number of OPEN boundary components
 *
 * A closed rectilinear loop contributes equally to both (a rectangle: 4 runs,
 * 4 corners), and each curve that terminates on the panel edge at both ends
 * contributes one more run than corner. The reference table's note gives only
 * the one-component cases and calls runs == corners + 1 true of "every
 * blobs/moons forest row" — it is not, and its own numbers say so: crescents
 * at B = 1, 5 and 15 read 11/9, 93/91 and 59/57, which is two open components
 * each, not a defect. This module reproduces those pairs exactly.
 *
 * @param grid    length must be a perfect square; cells compared with `!==`
 * @param sidePx  the panel's side in CSS pixels, so run lengths come back in
 *                the units the page prints. Equal to the grid side in the
 *                reference table, where the raster is 560 over a 560 px panel.
 */
export function boundaryStats(grid, sidePx) {
  const side = Math.round(Math.sqrt(grid.length));
  if (side * side !== grid.length) throw new Error("boundaryStats: grid is not square");
  const pxPer = sidePx / side;

  /* Vertex flags on the (side+1)^2 lattice: bit 1 vertical, bit 2 horizontal. */
  const vert = new Uint8Array((side + 1) * (side + 1));
  const vkey = (a, b) => b * (side + 1) + a;
  const runs = [];

  /* Vertical edges: lattice column a (1..side-1), between cells a-1 and a. */
  for (let a = 1; a < side; a += 1) {
    let len = 0;
    for (let j = 0; j <= side; j += 1) {
      const on = j < side && grid[j * side + a - 1] !== grid[j * side + a];
      if (on) {
        len += 1;
        vert[vkey(a, j)] |= 1;
        vert[vkey(a, j + 1)] |= 1;
      } else if (len > 0) {
        runs.push(len);
        len = 0;
      }
    }
  }

  /* Horizontal edges: lattice row b (1..side-1), between rows b-1 and b. */
  for (let b = 1; b < side; b += 1) {
    let len = 0;
    for (let i = 0; i <= side; i += 1) {
      const on = i < side && grid[(b - 1) * side + i] !== grid[b * side + i];
      if (on) {
        len += 1;
        vert[vkey(i, b)] |= 2;
        vert[vkey(i + 1, b)] |= 2;
      } else if (len > 0) {
        runs.push(len);
        len = 0;
      }
    }
  }

  let corners = 0;
  for (let k = 0; k < vert.length; k += 1) if (vert[k] === 3) corners += 1;

  const lens = runs.map((r) => r * pxPer).sort((a, b) => a - b);
  const total = lens.reduce((s, v) => s + v, 0);
  const mid = lens.length >> 1;

  return {
    runs: lens.length,
    corners,
    totalPx: total,
    meanRunPx: lens.length ? total / lens.length : 0,
    medianRunPx: lens.length === 0 ? 0 : lens.length % 2 ? lens[mid] : (lens[mid - 1] + lens[mid]) / 2,
    runLensPx: lens,
  };
}

/**
 * Number of 4-connected regions of constant label.
 *
 * The "visible patches" number, and it is deliberately not the leaf count:
 * blobs has 4 leaves and 2 patches. The gap between those two numbers is the
 * teaching point that the tree does more work than the picture shows.
 */
export function patchCount(grid) {
  const side = Math.round(Math.sqrt(grid.length));
  const seen = new Uint8Array(grid.length);
  const stack = new Int32Array(grid.length);
  let patches = 0;

  for (let s = 0; s < grid.length; s += 1) {
    if (seen[s]) continue;
    patches += 1;
    const label = grid[s];
    /* `top` is the count of items on the stack, so push writes at `top` and
       then increments. Writing it as `stack[top += 1] = c` instead leaves
       stack[0] permanently zero and pops it back on the last step, which makes
       every flood fill visit cell 0 and stop — measured as 312,481 patches on
       a picture with two. Every cell is marked seen at PUSH time, so no cell
       is ever queued twice and the stack cannot exceed grid.length. */
    let top = 0;
    stack[top] = s; top += 1;
    seen[s] = 1;
    while (top > 0) {
      top -= 1;
      const c = stack[top];
      const i = c % side, j = (c / side) | 0;
      if (i > 0 && !seen[c - 1] && grid[c - 1] === label) { seen[c - 1] = 1; stack[top] = c - 1; top += 1; }
      if (i < side - 1 && !seen[c + 1] && grid[c + 1] === label) { seen[c + 1] = 1; stack[top] = c + 1; top += 1; }
      if (j > 0 && !seen[c - side] && grid[c - side] === label) { seen[c - side] = 1; stack[top] = c - side; top += 1; }
      if (j < side - 1 && !seen[c + side] && grid[c + side] === label) { seen[c + side] = 1; stack[top] = c + side; top += 1; }
    }
  }
  return patches;
}

/**
 * The narrowest band of one class anywhere in the picture, in CSS pixels.
 *
 * Measured on the raster — the minimum, over every row and every column, of
 * the maximal constant-label run along it — and NOT from the leaf rectangles,
 * because a leaf whose neighbour predicts the same class is not a band at all.
 * Crescents is the case that separates the two: its rectangles bottom out at
 * 3.49 px (a +1 leaf under a +1 leaf, invisible) while the narrowest thing a
 * reader can actually see there is 67 px. At min_samples_leaf = 1 the same set
 * really does show a 3 px stripe, which is the number this must report and the
 * argument for the default of 2.
 */
export function narrowestStripePx(grid, sidePx) {
  const side = Math.round(Math.sqrt(grid.length));
  const pxPer = sidePx / side;
  let min = Infinity;

  const scan = (get) => {
    let len = 0, prev = null;
    for (let k = 0; k < side; k += 1) {
      const v = get(k);
      if (v === prev) { len += 1; } else {
        if (prev !== null && len < min) min = len;
        prev = v; len = 1;
      }
    }
    if (len < min) min = len;
  };

  for (let j = 0; j < side; j += 1) scan((i) => grid[j * side + i]);
  for (let i = 0; i < side; i += 1) scan((j) => grid[j * side + i]);
  return min * pxPer;
}

/**
 * Share of cells whose label changed between two rasters — the per-round
 * "repaint" figure the boosting-versus-forest comparison turns on.
 */
export function repaintPct(a, b) {
  let changed = 0;
  for (let k = 0; k < a.length; k += 1) if (a[k] !== b[k]) changed += 1;
  return (100 * changed) / a.length;
}
