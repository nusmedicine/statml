/* ============================================================================
   The numerics behind widget 18, with no DOM in them.

   A SEPARATE MODULE, which no other widget in the collection has, and the
   reason is principle 5.8. Widget 16 kept a solver in `_lab/svm-stage-core.js`
   AND a second copy in its own `main.js`, verified twice over because the two
   could drift. Everything here is checkable against scikit-learn in node
   (`_scratch/verify18.mjs` beside the notebooks), and `main.js` imports the same
   functions the check ran — so there is one implementation, not two that agree.

   Four things live here: the stage, the four balancing methods, a weighted
   logistic fit, and the scoring. Nothing draws.
   ========================================================================= */

/* One fixed square domain, so the frame never moves when the reader changes the
   imbalance (2.5). Both clouds are drawn at the same centres at every share —
   only HOW MANY minority points appear changes, which is the whole subject. */
export const DOMAIN = [0, 10];
export const N_TOTAL = 200;

/* THE COHORT, and rarity is a REMOVAL from it. Both classes are fully sampled
   first — 150 and 150 — and the dial then keeps only some of the minority. So
   5% is a subset of 10% is a subset of 40%, the majority never moves, and moving
   the dial makes cases DISAPPEAR rather than redrawing the scene. A reader can
   see what rarity cost them, which is the whole reason the widget opens on the
   full cohort.

   Keeping 100 / 38 / 17 / 8 of 150 minority against a fixed 150 majority gives
   1:1.5, 1:3.9, 1:8.8 and 1:18.8.

   k tops out at 5 because eight cases at the 5% end leave k <= 7, and a control
   whose options quietly stop working at one end of another control is the defect
   3.4d records. */
export const N_MAJ = 150;
export const N_MIN_POOL = 150;

/* THE DIAL IS HOW MANY OF THE CASES YOU KEEP, and it starts at all of them.
   Running 100% -> 5% means the widget opens on the whole cohort with no
   imbalance at all, and the reader creates the imbalance themselves by sliding
   down — 150, 75, 38, 15, 8 cases against a fixed 150 majority, so the outcome
   goes from half of the cohort to one patient in twenty.

   Expressed as a fraction KEPT rather than as a minority share, because that is
   what the reader is doing: throwing cases away. The share is the consequence,
   and the control's own detail line prints it.

   k tops out at 5 because eight cases at the far end leave k <= 7, and a control
   whose options quietly stop working at one end of another is 3.4d's defect. */
export const KEEPS = [1, 0.5, 0.25, 0.1, 0.05];
export const K_OPTIONS = [1, 3, 5];

/** How many minority cases survive, and what share of the sample they are. */
export const keptCount = (keep) => Math.max(6, Math.round(N_MIN_POOL * keep));
export const shareOf = (keep) => keptCount(keep) / (N_MAJ + keptCount(keep));

/* Held out at the SAME prevalence as the stage, because recall and precision
   are properties of the population a model meets, not of the training set it
   was handed. Balancing changes the second and not the first — which is the
   thing the readout has to be able to say. */
const N_TEST = 4000;

/* THE MINORITY IS THE POSITIVE CLASS, EVERYWHERE, and it is a `1` for a reason
   rather than by accident. `fitLogistic` regresses on `p.y`, so `y = 1` is the
   side the model's decision value points at; `score` counts a minority patient
   the model flagged as a TRUE POSITIVE. Recall, precision and F1 therefore all
   describe FINDING THE RARE OUTCOME, which is the job a clinical model is
   given — a screening test is asked to find disease, not to confirm health.

   It matters that this is fixed rather than offered as a choice: F1, precision
   and recall are not invariant to swapping the classes (that asymmetry is the
   whole argument for MCC), so a control that let a reader relabel which class
   is "positive" would let them flatter a model without changing it. Stated on
   screen instead — in the subtitle, in the legend, and in the F1 tile. */
export const MAJORITY = 0;
export const MINORITY = 1;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Minority and majority counts at a given share of `N_TOTAL`. */
export function countsFor(share) {
  const nMin = Math.round(N_TOTAL * share);
  return { nMin, nMaj: N_TOTAL - nMin };
}

/* ---- the stage ---------------------------------------------------------- */

/* Two overlapping Gaussian clouds. Overlapping on purpose: a stage the classes
   separate cleanly on has no boundary to get wrong, so balancing would have
   nothing to move and every method would score 1.000. The centres and spreads
   are the ones measured in `imb5.py`, where an unbalanced logistic model finds
   0.7795 of the minority at 40% and 0.1633 at 5%. */
const MAJ_MU = [3.7, 5.0], MAJ_SD = [1.7, 1.9];
const MIN_MU = [6.6, 5.0], MIN_SD = [1.3, 1.6];

function drawCloud(rng, n, mu, sd, label, out) {
  for (let i = 0; i < n; i += 1) {
    out.push({
      x1: clamp(rng.normal(mu[0], sd[0]), DOMAIN[0] + 0.3, DOMAIN[1] - 0.3),
      x2: clamp(rng.normal(mu[1], sd[1]), DOMAIN[0] + 0.3, DOMAIN[1] - 0.3),
      y: label,
    });
  }
}

/**
 * The training stage: `nMaj` majority points then `nMin` minority ones.
 *
 * Majority first so that index order is stable as the share changes — the
 * majority cloud a reader is looking at does not reshuffle when they move the
 * dial, because it is drawn from the same stream positions every time.
 */
export function makeStage(rng, share) {
  const { nMin, nMaj } = countsFor(share);
  const pts = [];
  drawCloud(rng, nMaj, MAJ_MU, MAJ_SD, MAJORITY, pts);
  drawCloud(rng, nMin, MIN_MU, MIN_SD, MINORITY, pts);
  return pts;
}

/**
 * The whole cohort: `N_MAJ` majority and `N_MIN_POOL` minority, both complete.
 *
 * DRAWN UNTIL BOTH LISTS ARE FULL, not from one call. `makeStage` returns
 * `N_TOTAL` points, so a single call yields 100 of each — and every share then
 * comes out wrong while every number on screen still looks entirely plausible.
 * That cost a measurement pass before it was noticed.
 */
export function makeCohort(rng) {
  const maj = [], min = [];
  while (maj.length < N_MAJ || min.length < N_MIN_POOL) {
    for (const p of makeStage(rng, 0.5)) {
      if (p.y === MAJORITY) { if (maj.length < N_MAJ) maj.push(p); }
      else if (min.length < N_MIN_POOL) min.push(p);
    }
  }
  return { maj, min };
}

/** A held-out set at the same prevalence, big enough that recall is not noise. */
export function makeTest(rng, share) {
  const nMin = Math.max(200, Math.round(N_TEST * share));
  const pts = [];
  drawCloud(rng, N_TEST - nMin, MAJ_MU, MAJ_SD, MAJORITY, pts);
  drawCloud(rng, nMin, MIN_MU, MIN_SD, MINORITY, pts);
  return pts;
}

/* ---- the four methods --------------------------------------------------- */

/* Every method returns a PLAN — an ordered list of the individual changes it
   makes — rather than a finished data set. Two reasons, and both are contract
   rather than taste:

   1. The animation reveals already-computed data (invariant 2). One step is one
      entry of the plan, so `compute` runs once per parameter change and the
      frame clock only moves a cursor along the list.
   2. A plan is countable while the count is small (2.3). "188 of 190 majority
      samples dropped" is a sentence about a list. */

/** k nearest OTHER minority points, by index into `pts`. */
export function minorityNeighbours(pts, k) {
  const idx = [];
  for (let i = 0; i < pts.length; i += 1) if (pts[i].y === MINORITY) idx.push(i);
  const out = new Map();
  for (const i of idx) {
    const d = idx
      .filter((j) => j !== i)
      .map((j) => ({ j, d2: (pts[i].x1 - pts[j].x1) ** 2 + (pts[i].x2 - pts[j].x2) ** 2 }))
      /* Ties broken by index, never by insertion order, so the same URL gives
         the same neighbours on every browser. Array.prototype.sort is stable in
         every engine since ES2019, but a comparator that can return 0 leaves the
         choice to the engine's stability rather than stating it. */
      .sort((a, b) => (a.d2 - b.d2) || (a.j - b.j));
    out.set(i, d.slice(0, Math.min(k, d.length)).map((e) => e.j));
  }
  return { idx, neighbours: out };
}

/**
 * SMOTE, exactly as `03-4` cell 65 describes it: for each new sample pick a
 * minority point, pick one of its k nearest minority neighbours, and place the
 * new point at a uniform random position on the segment between them.
 *
 * imbalanced-learn cycles the parents rather than drawing them at random, so
 * every minority point contributes about equally; that is reproduced here,
 * because a random parent draw leaves some real points with no offspring at all
 * and the picture would then be about the draw rather than about the method.
 */
export function smotePlan(pts, k, rng) {
  const { idx, neighbours } = minorityNeighbours(pts, k);
  const nMin = idx.length;
  const nMaj = pts.length - nMin;
  const need = Math.max(0, nMaj - nMin);
  const plan = [];
  for (let s = 0; s < need; s += 1) {
    const parent = idx[s % nMin];
    const near = neighbours.get(parent);
    if (!near || !near.length) continue;
    const neighbour = near[rng.int(0, near.length - 1)];
    const t = rng.next();
    plan.push({
      parent,
      neighbour,
      t,
      x1: pts[parent].x1 + t * (pts[neighbour].x1 - pts[parent].x1),
      x2: pts[parent].x2 + t * (pts[neighbour].x2 - pts[parent].x2),
      y: MINORITY,
    });
  }
  return plan;
}

/** Random oversampling: minority points drawn WITH replacement until balanced. */
export function overPlan(pts, rng) {
  const idx = [];
  for (let i = 0; i < pts.length; i += 1) if (pts[i].y === MINORITY) idx.push(i);
  const need = Math.max(0, pts.length - 2 * idx.length);
  const plan = [];
  for (let s = 0; s < need; s += 1) {
    const parent = idx[rng.int(0, idx.length - 1)];
    plan.push({ parent, x1: pts[parent].x1, x2: pts[parent].x2, y: MINORITY });
  }
  return plan;
}

/** Random undersampling: majority points removed, at random, until balanced. */
export function underPlan(pts, rng) {
  const idx = [];
  for (let i = 0; i < pts.length; i += 1) if (pts[i].y === MAJORITY) idx.push(i);
  const nMin = pts.length - idx.length;
  const drop = Math.max(0, idx.length - nMin);
  const order = rng.shuffle(idx);
  return order.slice(0, drop).map((i) => ({ drop: i }));
}

/**
 * `class_weight='balanced'` — sklearn's formula, n / (n_classes * n_c).
 *
 * A plan with no entries, because it adds and removes nothing: cell 63's whole
 * point is that this one "leaves dataset unchanged". The empty plan is what
 * makes the drive buttons disable themselves on that method, and the disabled
 * buttons are the lesson rather than an oversight (4.5).
 */
export function balancedWeights(pts) {
  let nMin = 0;
  for (const p of pts) if (p.y === MINORITY) nMin += 1;
  const nMaj = pts.length - nMin;
  return {
    [MAJORITY]: nMaj ? pts.length / (2 * nMaj) : 1,
    [MINORITY]: nMin ? pts.length / (2 * nMin) : 1,
  };
}

/* ---- the model ---------------------------------------------------------- */

/**
 * Weighted logistic regression with an L2 penalty, minimising
 *
 *     0.5 * (b1^2 + b2^2)  +  C * sum_i w_i * logloss_i
 *
 * which is scikit-learn's objective, C = 1 and the intercept unpenalised. Newton
 * / IRLS with a ridge on the Hessian: three parameters, so the 3x3 solve is
 * written out rather than looped.
 *
 * FITTED ON THE PLANE THE READER SEES. That is the whole reason the stage is
 * generated — on the heart-failure data SMOTE runs in eleven columns and a
 * two-column picture puts its neighbours at median rank 16, so the widget would
 * draw a line to a point that visibly is not nearby. Measured in `imb4.py`.
 */
export function fitLogistic(pts, { weights = null, C = 1, iters = 60 } = {}) {
  let b = [0, 0, 0];                       // intercept, x1, x2
  for (let it = 0; it < iters; it += 1) {
    /* Gradient and Hessian of the penalised objective. g/H are accumulated over
       samples first, then the penalty is added, so the intercept can be left out
       of the penalty by simply not touching g[0]/H[0][0]. */
    const g = [0, 0, 0];
    const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) {
      const w = weights ? weights[p.y] : 1;
      const z = b[0] + b[1] * p.x1 + b[2] * p.x2;
      const mu = 1 / (1 + Math.exp(-clamp(z, -35, 35)));
      const r = C * w * (mu - p.y);
      const s = C * w * Math.max(mu * (1 - mu), 1e-9);
      const x = [1, p.x1, p.x2];
      for (let a = 0; a < 3; a += 1) {
        g[a] += r * x[a];
        for (let c = 0; c < 3; c += 1) H[a][c] += s * x[a] * x[c];
      }
    }
    g[1] += b[1]; g[2] += b[2];
    H[1][1] += 1; H[2][2] += 1;
    /* A small ridge on the diagonal so a degenerate stage (one class empty)
       cannot produce a singular solve and a canvas full of NaN. A NaN at one
       end of a slider is the exact failure the text sweep exists to catch. */
    for (let a = 0; a < 3; a += 1) H[a][a] += 1e-9;
    const step = solve3(H, g);
    if (!step) break;
    let move = 0;
    for (let a = 0; a < 3; a += 1) { b[a] -= step[a]; move += Math.abs(step[a]); }
    if (move < 1e-11) break;
  }
  return { b0: b[0], b1: b[1], b2: b[2] };
}

/** Gaussian elimination with partial pivoting on a 3x3. Null if singular. */
function solve3(A, v) {
  const M = [[A[0][0], A[0][1], A[0][2], v[0]],
             [A[1][0], A[1][1], A[1][2], v[1]],
             [A[2][0], A[2][1], A[2][2], v[2]]];
  for (let c = 0; c < 3; c += 1) {
    let piv = c;
    for (let r = c + 1; r < 3; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 3; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j < 4; j += 1) M[r][j] -= f * M[c][j];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

/* The decision value. `probAt` is deliberately absent: this widget never asks
   for a probability, and 03-4 never touches a threshold — a helper nothing calls
   is a number that drifts. */
const scoreAt = (fit, x1, x2) => fit.b0 + fit.b1 * x1 + fit.b2 * x2;

/**
 * Recall, precision and accuracy on a held-out set, at the 0.5 cut.
 *
 * The 0.5 cut and not a tuned one, deliberately: `03-4` never touches a
 * threshold, and the claim this widget can make honestly is that balancing MOVES
 * the cut for you. Tuning it here would answer the question the figure is asking.
 */
export function score(fit, test) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of test) {
    const yes = scoreAt(fit, p.x1, p.x2) > 0;
    if (p.y === MINORITY) { if (yes) tp += 1; else fn += 1; }
    else if (yes) fp += 1; else tn += 1;
  }
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  return {
    tp, fp, fn, tn, recall, precision,
    accuracy: (tp + tn) / test.length,
    /* F1 FOR THE MINORITY CLASS, and which class that is matters: F1 is not
       invariant to swapping the labels, which is exactly why the positive class
       has to be stated rather than assumed. Here it is always the rare outcome,
       because that is what a clinical model is asked to find. `scoring="f1"` is
       what `04-4` itself uses. */
    f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : 0,
  };
}

/* ---- the reference line --------------------------------------------------- */

/* THE TARGET IS THE WHOLE COHORT'S OWN FIT, and it used to be a line fitted to
   20,000 points nobody ever saw. That was defensible — it is what every
   balancing method estimates — but it invited exactly the question it got:
   "is that the ground truth from the data?" It was not, and it could not be
   checked, because the data behind it was invisible.

   Now the reference is `fitLogistic` on the cohort the reader looked at on the
   first step. Same role, one fewer invisible object, and an honest answer to the
   question: it is the line you get when you have every case. */

/** The share of `pop` two lines put on opposite sides. */
export function disagreement(a, b, pop) {
  let n = 0;
  for (const p of pop) {
    if ((scoreAt(a, p.x1, p.x2) > 0) !== (scoreAt(b, p.x1, p.x2) > 0)) n += 1;
  }
  return pop.length ? n / pop.length : 0;
}

/**
 * The region of the domain two lines label differently, as polygons.
 *
 * THE SAME QUANTITY THE READOUT PRINTS, drawn instead of counted — which is why
 * it is here beside `disagreement` and not in the drawing code (5.8). Built by
 * clipping the domain square against each half-plane in turn rather than by
 * joining the two lines into a quadrilateral: a near-vertical line's endpoints
 * on the x = 0 and x = 10 edges sit at |y| ~ 1e5, and two lines that cross
 * inside the panel make that quadrilateral a self-intersecting bow-tie whose
 * fill depends on the winding rule. Two convex pieces, exact at any angle.
 */
export function disagreementRegion(a, b) {
  const [lo, hi] = DOMAIN;
  const square = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];
  const half = (poly, fit, sign) => {
    const keep = (p) => sign * scoreAt(fit, p[0], p[1]);
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const dp = keep(p), dq = keep(q);
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  };
  return [
    half(half(square, a, 1), b, -1),
    half(half(square, a, -1), b, 1),
  ].filter((poly) => poly.length >= 3);
}
