/* ============================================================================
   Support vector machines — widget 16. DRAFT.

   Hosts at PHM5005 `04-3 Tour of Algorithms`, section "Margin-based Models
   (SVM)". That section prints one objective —

       min  1/2 ||w||^2  +  C * sum_i Loss_i

   — and then three kernel formulas, and describes C as "the trade-off between
   margin size and misclassification". Students read C as a quality dial and the
   kernel as a menu of algorithms. They are neither. C is the price of letting a
   sample inside the corridor, and the kernel decides what shape the corridor is
   allowed to be.

   ---------------------------------------------------------------------------
   THE DATA IS GENERATED, AND IT HAS TO BE. None of PHM5005's data sets can show
   a kernel doing anything, which was measured rather than assumed:

     colorectal (03-5)  2,258 probes have |AUC - 0.5| > 0.45 and one separates
                        the classes on its own; of 435 mid-strength pairs, ZERO
                        need a curve
     heart failure      RBF beats linear by 2.4-4.0 CV points on the best
       (04-3)           2-feature pairs and is WORSE on all features, 0.729
                        against 0.736. Ejection fraction is not U-shaped: the
                        50-60 uptick is 7 deaths in 24 patients and 60+ drops
                        back to 0.194
     body fat           regression

   So the samples are drawn from the seeded `rng`, as widgets 1-11 are, and the
   axes are x1 and x2 rather than a clinical measurement. A borrowed clinical
   frame was built first — two labs, each with a reference range, so "normal on
   both" is a region in the middle — and it was cut: a made-up label on invented
   patients reads as a clinical finding, and this widget's subject is a shape.
   `widgets/_lab/svm-kernel.html` keeps that version and the measurements.

   Three generators, chosen so the kernel control has something to be wrong
   about: BLOBS a line already separates, RINGS where one class surrounds the
   other, CRESCENTS where the two interleave. All three live on one fixed square
   domain so that gamma means the same thing in each (2.5).

   ---------------------------------------------------------------------------
   THE PANEL IS SQUARE, and it has to be. The margin is a distance, and a
   distance is only a distance if both axes carry the same units per pixel — so
   the height is a function of the WIDTH, the same trade widget 14 makes.

   ---------------------------------------------------------------------------
   NO ANIMATION AND NO `shown`. Principle 4.5: there is nothing here that
   happens over time. Fitting is not shown either — widget 8 owns iterative
   fitting, and an SVM's solver is not what a student needs to see.

   THE SOLVER IS SMO with LIBSVM's maximal violating pair, so it is
   deterministic: the working pair is read off the gradient, never drawn at
   random. On a linear kernel it agrees with `sklearn.svm.SVC(kernel="linear")`
   to four decimal places in both w and b at every rung of the C ladder.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";

/* One square domain for all three generators, fixed once: the frame is not
   allowed to move when the reader changes data set or dial (2.5). */
const DOM = [-2.2, 2.2];
const N_PER_CLASS = 90;

/* --- the three generators ------------------------------------------------ *
 * Shapes borrowed from sklearn's make_blobs / make_circles / make_moons, which
 * is what every SVM tutorial draws, scaled onto DOM so that one gamma ladder
 * covers all three.                                                          */
const SETS = {
  blobs: {
    label: "Two blobs",
    detail: "A straight line already separates these.",
    make(rng) {
      const out = [];
      for (const y of [-1, 1]) {
        const cx = y * 0.95, cy = y * 0.8;
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          out.push({ x: [rng.normal(cx, 0.42), rng.normal(cy, 0.42)], y });
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
          out.push({ x: [r * Math.cos(t) + rng.normal(0, 0.12), r * Math.sin(t) + rng.normal(0, 0.12)], y });
        }
      }
      return out;
    },
  },
  moons: {
    label: "Crescents",
    detail: "Two interleaving arcs. No straight line can do this either.",
    /* THE UPPER ARC IS THE +1 CLASS, and which way round that goes is not
       cosmetic. The kernel space puts +1 above the boundary by definition, so
       a data set whose +1 class sits LOW in the input space has to turn over on
       the way up — and with the arcs labelled the other way round the lift
       looked like an unexplained mirror rather than a transformation. Measured:
       the correlation between x2 and f ran -0.75 to -0.94 for every kernel. */
    make(rng) {
      const out = [];
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({ x: [1.25 * (Math.cos(t) - 0.5) + rng.normal(0, 0.11),
                       1.25 * (Math.sin(t) - 0.25) + rng.normal(0, 0.11)], y: 1 });
      }
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({ x: [1.25 * (0.5 - Math.cos(t)) + rng.normal(0, 0.11),
                       1.25 * (0.25 - Math.sin(t)) + rng.normal(0, 0.11)], y: -1 });
      }
      return out;
    },
  },
};

/* Both ladders are `choice` sliders: the rungs are a magnitude, so left-to-right
   carries the idea and each tick can say what it does. */
const C_LADDER = [0.01, 0.1, 1, 10, 100];
const G_LADDER = [0.1, 0.3, 1, 3, 10, 30];
const DEGREES = [2, 3, 4];

/* All three of 04-3's kernels, written the way the notebook writes them. */
const KERNELS = {
  linear: {
    label: "Linear",
    detail: "No transformation. The boundary is a straight line in this plane.",
    k: (a, b) => a[0] * b[0] + a[1] * b[1],
  },
  poly: {
    label: "Polynomial",
    detail: "Products of the features up to degree d, so the boundary is a curve.",
    k: (a, b, d) => (a[0] * b[0] + a[1] * b[1] + 1) ** d,
  },
  rbf: {
    label: "RBF",
    detail: "A bump around every sample, so the boundary can curve and close.",
    k: (a, b, g) => Math.exp(-g * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)),
  },
};

/* --- the kernel space, and how its vertical axis is scaled --------------- *
 * f(x) = w.phi(x) + b is a LINEAR functional of the feature vector, so plotting
 * it against x1 is a true 2-D view of the kernel space: the direction w, and
 * one input coordinate. In it the boundary is exactly the line f = 0 and the
 * margins exactly f = +/-1, for EVERY kernel — nothing about that view is an
 * illustration.
 *
 * Its dynamic range is the problem. Median max|f| over the 150 states is 1.90
 * and the worst is 42 (blobs, degree-4 polynomial, C = 100), so a linear axis
 * either wastes four fifths of the panel or throws away 68 of 180 samples. So
 * it is LINEAR OUT TO ONE MARGIN AND LOGARITHMIC BEYOND: the three positions
 * that carry meaning — the boundary and the two margins — keep true spacing,
 * and "much further out" is compressed, which is the half that carries none.
 * Those three are the only labelled positions, so the axis never claims a
 * reading it is not giving. */
const LIFT_DOM = [-3.2, 3.2];
const squash = (f) => {
  const a = Math.abs(f);
  const v = a <= 1 ? a : 1 + Math.log(a);
  return Math.sign(f) * Math.min(v, LIFT_DOM[1]);
};

/**
 * SMO for the C-SVM dual, with LIBSVM's working set selection 1 — the maximal
 * violating pair. Deterministic: the pair is read off the gradient, so nothing
 * about the fit depends on an ordering or a random draw.
 *
 *     min  1/2 a'Qa - e'a    s.t.  y'a = 0,  0 <= a_i <= C,   Q_ij = y_i y_j K_ij
 *
 * G_k = sum_m Q_km a_m - 1, so y_k G_k is exactly sample k's prediction error
 * with the bias left out — the quantity Platt's two-variable update takes as
 * E_k, and the reason the gradient is worth carrying.
 */
function solveSVM(K, y, C, { eps = 1e-6, maxIter = 120000 } = {}) {
  const n = y.length;
  const a = new Float64Array(n);
  const G = new Float64Array(n).fill(-1);
  const hi = C - 1e-12;
  const inUp = (k) => (y[k] > 0 ? a[k] < hi : a[k] > 1e-12);
  const inLow = (k) => (y[k] > 0 ? a[k] > 1e-12 : a[k] < hi);
  for (let iter = 0; iter < maxIter; iter += 1) {
    /* THE SELECTION LOOP IS THE WHOLE COST, so the membership tests are written
       out here rather than called. At C = 10 on the crescents this runs tens of
       thousands of times over 180 samples, and with the two predicates as
       closures one state took 1.9 SECONDS — on a control meant to be dragged.
       Inlined, the same state is a few tens of milliseconds.

       MAXITER IS THE BINDING CONSTRAINT, NOT EPS, and a cut-off solve is
       silently wrong rather than obviously wrong. On the rings at C = 100 —
       a linear kernel on data no line can separate, so the optimum is flat —
       stopping at 20,000 gave 175 support vectors and 77 errors against
       sklearn's 170 and 74. Every value of eps from 1e-5 to 1e-9 gave the same
       cut-off answer, and every one of them converged to sklearn's exactly once
       the cap was raised. 120,000 leaves the worst state at ~57 ms and every
       other one under 15. */
    let i = -1, mUp = -Infinity, j = -1, mLow = Infinity;
    for (let k = 0; k < n; k += 1) {
      const ak = a[k], pos = y[k] > 0;
      const v = -y[k] * G[k];
      if (v > mUp && (pos ? ak < hi : ak > 1e-12)) { mUp = v; i = k; }
      if (v < mLow && (pos ? ak > 1e-12 : ak < hi)) { mLow = v; j = k; }
    }
    if (i < 0 || j < 0 || mUp - mLow < eps) break;

    const Ei = y[i] * G[i], Ej = y[j] * G[j];
    let eta = K[i][i] + K[j][j] - 2 * K[i][j];
    if (eta < 1e-12) eta = 1e-12;
    /* clipBoxLo/Hi, not lo/hi: `hi` at this scope shadows the function-level
       one the selection loop above reads, and a `let` shadow puts that read in
       the temporal dead zone — so every solve threw, on every state. It looked
       like the harness settling too early rather than like a bug, because a
       widget that throws in render() leaves its canvas at the default 150x75
       and the sweep reports zero strings. */
    let clipLo, clipHi;
    if (y[i] !== y[j]) { clipLo = Math.max(0, a[j] - a[i]); clipHi = Math.min(C, C + a[j] - a[i]); }
    else { clipLo = Math.max(0, a[i] + a[j] - C); clipHi = Math.min(C, a[i] + a[j]); }
    if (clipHi - clipLo < 1e-15) break;
    const oldAi = a[i], oldAj = a[j];
    let aj = a[j] + (y[j] * (Ei - Ej)) / eta;
    aj = aj < clipLo ? clipLo : aj > clipHi ? clipHi : aj;
    a[i] = a[i] + y[i] * y[j] * (oldAj - aj);
    a[j] = aj;
    const di = a[i] - oldAi, dj = a[j] - oldAj;
    for (let k = 0; k < n; k += 1) {
      G[k] += y[k] * (y[i] * K[i][k] * di + y[j] * K[j][k] * dj);
    }
  }
  /* b from the FREE support vectors: 0 < a_k < C means y_k f(x_k) = 1 exactly,
     so y_k G_k is the same number for each of them and b is minus their mean.
     When every support vector is bounded there is no such k and b is only
     pinned to an interval, whose midpoint LIBSVM takes and so does this.
     Getting that fallback's sign wrong moved the boundary by 0.39 on two rungs
     WHILE w stayed exact to four decimals — the fit and the margin width both
     looked right and only the accuracy was wrong. */
  let sum = 0, cnt = 0, ub = Infinity, lb = -Infinity;
  for (let k = 0; k < n; k += 1) {
    const yG = y[k] * G[k];
    if (a[k] > 1e-12 && a[k] < C - 1e-12) { sum += yG; cnt += 1; }
    else if (inUp(k)) ub = Math.min(ub, yG);
    else if (inLow(k)) lb = Math.max(lb, yG);
  }
  return { alpha: Array.from(a), b: -(cnt > 0 ? sum / cnt : (ub + lb) / 2) };
}

/* The decision surface is sampled once per parameter change, never per frame:
   at 130 x 130 over the fixed domain that is 16,900 evaluations, and an RBF one
   costs a kernel call per support vector on top. Both the shaded corridor and
   the three contours are read off this one grid, so they cannot disagree. */
const GRID = 120;
const gridAt = (i) => DOM[0] + ((DOM[1] - DOM[0]) * i) / (GRID - 1);

/**
 * Marching squares. Emits [x0, y0, x1, y1] segments for one level of a scalar
 * field, with the crossings linearly interpolated — which is what keeps a
 * contour smooth on a grid coarse enough to compute while a slider is moving.
 */
function contour(F, level) {
  const segs = [];
  const at = (i, j) => F[j * GRID + i] - level;
  const mix = (va, vb, a, b) => a + ((b - a) * va) / (va - vb);
  for (let j = 0; j < GRID - 1; j += 1) {
    for (let i = 0; i < GRID - 1; i += 1) {
      const v00 = at(i, j), v10 = at(i + 1, j), v11 = at(i + 1, j + 1), v01 = at(i, j + 1);
      let code = 0;
      if (v00 > 0) code |= 1;
      if (v10 > 0) code |= 2;
      if (v11 > 0) code |= 4;
      if (v01 > 0) code |= 8;
      if (code === 0 || code === 15) continue;
      const x0 = gridAt(i), x1 = gridAt(i + 1), y0 = gridAt(j), y1 = gridAt(j + 1);
      const B = [mix(v00, v10, x0, x1), y0];          // bottom edge
      const R = [x1, mix(v10, v11, y0, y1)];          // right edge
      const T = [mix(v01, v11, x0, x1), y1];          // top edge
      const L = [x0, mix(v00, v01, y0, y1)];          // left edge
      const push = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      /* The two saddle cases (5 and 10) are resolved by the cell's mean, which
         is the standard tie-break and the one that keeps a closed contour from
         pinching shut at its waist. */
      switch (code) {
        case 1: case 14: push(L, B); break;
        case 2: case 13: push(B, R); break;
        case 3: case 12: push(L, R); break;
        case 4: case 11: push(R, T); break;
        case 6: case 9: push(B, T); break;
        case 7: case 8: push(L, T); break;
        case 5: {
          const mid = (v00 + v10 + v11 + v01) / 4;
          if (mid > 0) { push(L, T); push(B, R); } else { push(L, B); push(R, T); }
          break;
        }
        default: {
          const mid = (v00 + v10 + v11 + v01) / 4;
          if (mid > 0) { push(L, B); push(R, T); } else { push(L, T); push(B, R); }
        }
      }
    }
  }
  return { level, paths: chain(segs) };
}

/**
 * Marching squares emits its segments cell by cell, in no order. Stroked like
 * that, EVERY SEGMENT RESTARTS THE DASH PHASE — a dashed contour comes out as
 * an even stipple with no dashes in it at all, and the solid one shows a seam
 * at every join. Linking them end to end first fixes both, and costs one pass.
 *
 * Endpoints are matched on a rounded key rather than on equality: two cells
 * sharing an edge compute the same crossing from the same two corner values, so
 * they agree to the last bit — but rounding is what keeps that a fact about the
 * data rather than a bet on float arithmetic.
 */
function chain(segs) {
  const key = (x, y) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const k of [key(s[0], s[1]), key(s[2], s[3])]) {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const used = new Array(segs.length).fill(false);
  const out = [];
  const grow = (path, atKey) => {
    for (;;) {
      const next = (ends.get(atKey) ?? []).find((i) => !used[i]);
      if (next === undefined) return atKey;
      used[next] = true;
      const s = segs[next];
      const head = key(s[0], s[1]) === atKey;
      const px = head ? s[2] : s[0], py = head ? s[3] : s[1];
      path.push([px, py]);
      atKey = key(px, py);
    }
  };
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const s = segs[i];
    const path = [[s[0], s[1]], [s[2], s[3]]];
    grow(path, key(s[2], s[3]));
    // and backwards from the other end, for a contour that is not a closed loop
    const back = [];
    grow(back, key(s[0], s[1]));
    out.push(back.reverse().concat(path));
  }
  return out;
}

/* --- geometry ------------------------------------------------------------ */
const PAD_L = 44, PAD_R = 12, PAD_T = 22, PAD_B = 44, SIDE_MAX = 560;

const planeSide = (w) => Math.min(SIDE_MAX, Math.max(200, w - PAD_L - PAD_R));
const heightFor = ({ w }) => PAD_T + planeSide(w) + PAD_B;

defineWidget({
  slug: "support-vector-machine",
  title: "Support Vector Machines",
  subtitle:
    "An SVM finds the boundary that separates two classes with the widest "
    + "margin. The kernel determines what shape the boundary can take, and C "
    + "sets the penalty for samples inside the margin.",
  layout: "side",
  height: heightFor,

  params: {
    /* Reading order is the instruction (3.1): what am I looking at, what is
       the model allowed to do, then the two dials that tune it. */
    data: {
      type: "segmented",
      label: "Samples",
      options: Object.entries(SETS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "blobs",
    },
    kernel: {
      type: "segmented",
      label: "Kernel",
      options: Object.entries(KERNELS).map(([value, k]) => ({ value, label: k.label, detail: k.detail })),
      default: "linear",
    },
    C: {
      type: "choice",
      label: "C — the price of one violation",
      options: C_LADDER.map((v, i) => ({
        value: String(i),
        label: String(v),
        /* Within a few characters of each other on purpose (3.4d): a detail
           that wraps at one end of a dial and not the other makes the rail jog
           by a whole line every time the reader drags across it. */
        detail: v < 1
          ? `${v} — violations are cheap, so the corridor stays wide`
          : v > 1
            ? `${v} — violations are dear, so the corridor pulls in`
            : `${v} — sklearn's default, and the notebook's`,
      })),
      default: "2",
    },
    degree: {
      type: "choice",
      label: "d — the degree",
      when: { param: "kernel", equals: "poly" },
      options: DEGREES.map((v, i) => ({
        value: String(i),
        label: String(v),
        detail: `${v} — products of up to ${v} features at a time`,
      })),
      default: "1",
    },
    gamma: {
      type: "choice",
      label: "γ — how far one sample reaches",
      when: { param: "kernel", equals: "rbf" },
      options: G_LADDER.map((v, i) => ({
        value: String(i),
        label: String(v),
        detail: v <= 0.3
          ? `${v} — wide bumps, so the boundary comes out smooth`
          : v >= 10
            ? `${v} — narrow bumps, so it wraps single samples`
            : `${v} — near sklearn's "scale" on data this wide`,
      })),
      default: "2",
    },

    /* Display: how it is DRAWN. Neither of these changes the fit — the lift is
       the SAME model seen along the direction w rather than in the plane the
       measurements were taken in (3.2). */
    lift: {
      type: "segmented",
      label: "Looking at",
      options: [
        { value: "input", label: "Input space", detail: "The two measurements, as they were taken." },
        { value: "kernel", label: "Kernel space", detail: "The same samples, along the direction the boundary is perpendicular to." },
      ],
      default: "input",
      display: true,
    },
    marks: {
      type: "bool",
      label: "Ring the support vectors",
      detail: "The samples the boundary depends on — every other one could be deleted.",
      default: true,
      display: true,
    },
  },

  legend: [
    { token: "nonevent", label: "Class y = −1", mark: "dot" },
    { token: "event", label: "Class y = +1", mark: "dot" },
    { token: "ink-1", label: "Support vector", mark: "dot" },
    { token: "highlight", label: "Boundary, and the margin either side", mark: "line" },
  ],

  compute({ params, rng }) {
    const set = SETS[params.data];
    const kern = KERNELS[params.kernel];
    const C = C_LADDER[Number(params.C)];
    /* The second kernel argument, whichever kernel is in play: gamma for the
       RBF, the degree for the polynomial, ignored by the linear one. Kept as
       ONE value so the solver, the per-sample decision and the grid all read
       the same number — three copies of "which dial is live" is how two halves
       of a figure come to disagree. */
    const g = params.kernel === "poly" ? DEGREES[Number(params.degree)] : G_LADDER[Number(params.gamma)];
    const pts = set.make(rng);
    const X = pts.map((p) => p.x);
    const y = pts.map((p) => p.y);
    const kf = (a, b) => kern.k(a, b, g);

    const K = X.map((a) => X.map((b) => kf(a, b)));
    const { alpha, b } = solveSVM(K, y, C);

    /* THE LINEAR KERNEL'S "KERNEL SPACE" IS THE INPUT PLANE — phi is the
       identity — so its lift is the plane TURNED until the boundary is level,
       and the horizontal axis is the along-boundary coordinate rather than x1.
       Written as a proper rotation: t = (w2, -w1)/|w| against n = w/|w| has
       determinant +1, where the more obvious (-w2, w1) has determinant -1 and
       is a REFLECTION. That distinction is the whole of this fix — a reflection
       reads as an unexplained mirror, a rotation reads as turning the page.

       For a curved kernel there is no along-boundary coordinate to use, so x1
       stays put and only the height moves. */
    let alongOf = (p) => p[0];
    if (params.kernel === "linear") {
      const w = [0, 1].map((j) => y.reduce((sacc, yi, i) => sacc + alpha[i] * yi * X[i][j], 0));
      const nrm = Math.hypot(w[0], w[1]) || 1;
      alongOf = (p) => (w[1] * p[0] - w[0] * p[1]) / nrm;
    }

    /* Support vectors are read off ALPHA, not off a float comparison on
       y f(x) = 1: a support vector sitting exactly on the margin has zero hinge
       loss and a positive weight, and only alpha tells the two apart. */
    const sv = [];
    for (let i = 0; i < y.length; i += 1) if (alpha[i] > 1e-8) sv.push(i);
    const decide = (p) => {
      let s = b;
      for (const i of sv) s += alpha[i] * y[i] * kf(X[i], p);
      return s;
    };
    const f = X.map(decide);
    const marg = y.map((yi, i) => yi * f[i]);

    /* The grid is 14,400 evaluations and each costs a kernel call per support
       vector, so it is the whole cost of a parameter change — 80 ms written the
       obvious way, with a closure over an array of arrays. Flattened into typed
       arrays with the branch on the kernel hoisted out of the loop it is 20.
       That matters because this runs on every notch of two sliders. */
    const m = sv.length;
    const svX = new Float64Array(m), svY = new Float64Array(m), svC = new Float64Array(m);
    sv.forEach((i, k) => { svX[k] = X[i][0]; svY[k] = X[i][1]; svC[k] = alpha[i] * y[i]; });
    const F = new Float64Array(GRID * GRID);
    const kind = params.kernel;
    for (let j = 0; j < GRID; j += 1) {
      const py = gridAt(j);
      for (let i = 0; i < GRID; i += 1) {
        const px = gridAt(i);
        let s = b;
        if (kind === "linear") {
          for (let k = 0; k < m; k += 1) s += svC[k] * (svX[k] * px + svY[k] * py);
        } else if (kind === "poly") {
          for (let k = 0; k < m; k += 1) s += svC[k] * (svX[k] * px + svY[k] * py + 1) ** g;
        } else {
          for (let k = 0; k < m; k += 1) {
            const dx = svX[k] - px, dy = svY[k] - py;
            s += svC[k] * Math.exp(-g * (dx * dx + dy * dy));
          }
        }
        F[j * GRID + i] = s;
      }
    }

    return {
      pts, sv, svSet: new Set(sv), F,
      /* WHERE EACH SAMPLE LANDS IN THE KERNEL SPACE — both coordinates, because
         the linear kernel's lift is a ROTATION and moves points sideways too.
         Computed here rather than in draw(), which runs on every frame. */
      lifted: pts.map((p, i) => [alongOf(p.x), squash(f[i])]),
      alongOf,
      contours: [contour(F, 1), contour(F, -1), contour(F, 0)],
      inside: marg.filter((m) => m < 1 - 1e-7).length,
      wrong: marg.filter((m) => m <= 0).length,
      n: y.length,
    };
  },

  /* --- the lift ---------------------------------------------------------- *
   * `t` runs 0 at the input space to 1 at the kernel space, and EVERYTHING
   * moves by the same rule: a sample at input height x2 with decision value f
   * is drawn at (1 - t)*x2 + t*squash(f), and a contour vertex at height b on
   * the level L is drawn at (1 - t)*b + t*L. So the boundary flattens into the
   * line y = 0 and its two margins into y = +/-1, which is exactly what they
   * are in the kernel space. One formula, so the samples and the boundary
   * cannot disagree about where they are mid-flight (5.8).
   *
   * Only the HEIGHT moves; x1 is the horizontal axis at both ends. That is what
   * makes the motion readable — every dot slides straight up or down, and a
   * reader can follow the one they were looking at.                          */
  animation: {
    /* NO STEP AND NO PLAY. Principle 4.5, and `null` rather than omitted:
       omitting still gets core's default button. There is nothing here to
       advance one of, and nothing to keep going — the only motion is the lift,
       and the control that drives it is `Looking at`. A dead Step beside a live
       toggle teaches that the toggle is the afterthought, which is backwards.
       Widget 12 declines for the same reason. */
    stepLabel: null,
    runLabel: null,

    init: ({ params }) => {
      const t = params.lift === "kernel" ? 1 : 0;
      return { t, tT: t, easing: false, done: false };
    },
    /* Exponential rather than a normalised clock, so an interruption resumes
       from where the figure actually is instead of jumping back to an origin —
       which is what happens when the reader changes their mind mid-lift. */
    advance: (anim, { dt }) => {
      const gap = anim.tT - anim.t;
      if (Math.abs(gap) < 0.002) { anim.t = anim.tT; return false; }
      anim.t += gap * Math.min(1, (dt / 460) * 2.6);
      return true;
    },
    /* `rebuild` runs on every display change and is not told which parameter
       moved, so the widget compares what it is showing against what the
       parameters now ask for. Setting `easing` is the request for frames; core
       clears it when it grants one (4.4). */
    rebuild: (anim, { params }) => {
      anim.tT = params.lift === "kernel" ? 1 : 0;
      if (Math.abs(anim.tT - anim.t) > 0.002) anim.easing = true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const t = anim?.t ?? (params.lift === "kernel" ? 1 : 0);
    const mix = (a, b) => a + (b - a) * t;
    const along = state.alongOf;
    const side = planeSide(w);
    const rect = { x: Math.round(PAD_L + (w - PAD_L - PAD_R - side) / 2), y: PAD_T, w: side, h: side };
    /* The vertical frame travels with the lift. It has to: the input space runs
       to +/-2.2 and the kernel space's compressed axis to +/-3.2, and a frame
       that jumped between them at the ends of the motion would undo the whole
       point of easing it. */
    const yDom = [mix(DOM[0], LIFT_DOM[0]), mix(DOM[1], LIFT_DOM[1])];
    const plot = makePlot({ ctx, colors, rect, xDomain: DOM, yDomain: yDom });
    const { sx, sy } = plot;
    const ticks = [-2, -1, 0, 1, 2];
    /* Past the halfway point the vertical axis is f, not x2, so it carries the
       three positions that mean something there and nothing else. Swapping at
       the midpoint is safe because nobody reads a tick label mid-flight. */
    const yTicks = t < 0.5 ? ticks : [-1, 0, 1];
    plot.grid(yTicks);
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (const t of ticks) {
      ctx.beginPath();
      ctx.moveTo(Math.round(sx(t)) + 0.5, rect.y);
      ctx.lineTo(Math.round(sx(t)) + 0.5, rect.y + rect.h);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    /* THE CORRIDOR IS NOT SHADED, and that is a decision rather than an
       omission. Shading |f| <= 1 is right for a linear kernel, where the band
       is a strip and everything outside it is far away. On an RBF it inverts
       the picture: f decays to b away from the data, so the whole far field
       sits inside the margin and the shading covers everything EXCEPT the two
       clouds — which reads as "the margin is the plane". Both were drawn; the
       three contours say it without lying, which is also what every SVM
       tutorial figure does. */
    ctx.strokeStyle = colors.highlight;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const { level, paths } of state.contours) {
      ctx.setLineDash(level === 0 ? [] : [5, 4]);
      ctx.lineWidth = level === 0 ? 2 : 1.25;
      ctx.globalAlpha = 1 - t * t;
      ctx.beginPath();
      for (const path of paths) {
        path.forEach(([px, py], k) => {
          const X0 = sx(mix(px, along([px, py]))), Y0 = sy(mix(py, level));
          return k ? ctx.lineTo(X0, Y0) : ctx.moveTo(X0, Y0);
        });
      }
      ctx.stroke();

      /* A contour is only traced where it EXISTS in the input plane, so a
         closed ring flattens into a segment as wide as the ring was — a
         boundary that stops in mid-air. In the kernel space it runs the whole
         width, so the straight line is CROSS-FADED with it.
         Both, not just one: they land at the same height at t = 1, but a dashed
         contour and a dashed line arrive with different dash phases, and two
         dashes out of phase on the same line read as a solid one. */
      ctx.globalAlpha = t * t;
      ctx.beginPath();
      ctx.moveTo(rect.x, sy(t * level));
      ctx.lineTo(rect.x + rect.w, sy(t * level));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);

    /* A support vector keeps its own class colour and gains a ring rather than
       being recoloured: it is still a y = +1 or a y = −1, and hiding that to
       mark it would cost more than the mark is worth. */
    state.pts.forEach((p, i) => {
      const isSV = params.marks && state.svSet.has(i);
      const cx = sx(mix(p.x[0], state.lifted[i][0]));
      const cy = sy(mix(p.x[1], state.lifted[i][1]));
      ctx.beginPath();
      ctx.arc(cx, cy, isSV ? 3.6 : 2.9, 0, Math.PI * 2);
      ctx.fillStyle = p.y > 0 ? colors.event : colors.nonevent;
      ctx.globalAlpha = isSV ? 1 : 0.45;
      ctx.fill();
      if (isSV) {
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = colors.ink1;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    /* On a linear kernel the lift ROTATES, so past the halfway point the
       horizontal axis is the along-boundary coordinate and not x1 any more.
       Saying so is not optional: a rotated axis still labelled x1 is a figure
       claiming a reading it is not giving. */
    const rotated = t >= 0.5 && params.kernel === "linear";
    plot.axisX({ ticks, label: rotated ? "along the boundary" : "x₁" });
    plot.axisY({
      ticks: yTicks,
      format: t < 0.5 ? String : (v) => (v === 0 ? "0" : v > 0 ? "+1" : "−1"),
      label: t < 0.5 ? "x₂" : "f(x)",
    });
    plot.caption(
      t < 0.5
        ? `${SETS[params.data].label} · ${KERNELS[params.kernel].label} kernel`
        : rotated
          ? "Kernel space · the same plane, turned level"
          : "Kernel space · the boundary is flat here"
    );
  },

  readout({ state, params }) {
    const pct = Math.round((state.sv.length / state.n) * 100);
    return [
      {
        label: "Support vectors",
        value: `${state.sv.length} of ${state.n}`,
        note: `${pct}% — inside the corridor, or touching its edge`,
      },
      {
        label: "Beyond the corridor",
        value: String(state.n - state.sv.length),
        note: "zero loss and zero weight — delete them and nothing moves",
      },
      {
        label: "Misclassified",
        value: `${state.wrong} of ${state.n}`,
        note: `accuracy ${fmt(1 - state.wrong / state.n, 3)}`
          + (params.kernel === "rbf" ? " on the samples it was fitted to" : ""),
      },
    ];
  },
});
