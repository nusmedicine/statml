/* ============================================================================
   Fitting and generalizing — widget 13. DRAFT.

   Hosts at PHM5005 `04-2 Model Evaluation` (its under/optimal/overfit table,
   currently prose and a static image), `04-1 Overview` (workflow step 2, "split
   first") and `04-4 Model Selection and Tuning` (cross-validation).

   ---------------------------------------------------------------------------
   THE SHAPE IS THE NOTEBOOK'S OWN WORKFLOW DIAGRAM.

       Dataset ──> Training ──────> [ cross-validation: training | validation ]
               └─> Test ─────────────────────────────────> final metrics

   Two tabs, and they are the two halves of that picture:

     The fit    split the dataset by a RATIO into training and test, and watch
                training error fall while test error turns around. This is the
                textbook overfitting figure, and it is drawn against the test
                set because that is what makes the point visible.

     Cross-     you are not allowed to CHOOSE on the test set — so the training
     validation set becomes the cross-validation set, divided into folds, and
                the estimate is built without the test set being touched. The
                test curve stays on the panel as the thing CV is trying to
                match blind, and it lands in the same place.

   That ordering matters. An earlier build put a validation set on the fit tab
   and had cross-validation "pool it back in", which inverts the argument: it
   showed the machinery before the reason for it. The reason is that the first
   tab's second curve is a curve you are not entitled to select on.

   scikit-learn states the destination: "A test set should still be held out for
   final evaluation, but the validation set is no longer needed when doing CV."
   `04-4` is the same shape — `train_test_split`, `cross_val_score` on X_train,
   then one final test evaluation.

   ---------------------------------------------------------------------------
   THE RATIO IS THE CONTROL, NOT THE COHORT SIZE. A "patients in the study"
   slider was tried and reported as confusing: splits are quoted as ratios, and
   60/40 or 80/20 is the form everyone already holds. It carries the same lesson
   — overfitting is the parameter count against how much TRAINING data there is,
   and the ratio moves that — plus a second one it gets for free: every patient
   you move into training is one you can no longer measure with, so the test
   estimate gets noisier exactly as the model gets better.

   ---------------------------------------------------------------------------
   WHY PLASMA CONCENTRATION AND NOT LUNG FUNCTION AGAINST AGE. Both were tested.
   FEV1 against age is very nearly a quadratic, so the best polynomial IS three
   parameters and the exercise answers itself. A one-compartment concentration
   curve is a difference of two exponentials, so no polynomial is ever right and
   the best count is a genuine trade-off — which is the thing being taught.

   ---------------------------------------------------------------------------
   MSE ON A LOG AXIS, AND WHY THAT IS SAFE. Validation MSE spans three or more
   decades here, and a linear axis that can show the top cannot show the band
   where the lesson happens. Log needs MSE strictly positive: asserted on the
   widget over thousands of (cohort x seed x parameter) states, the training MSE
   was never exactly zero. It cannot be while the parameter count stays below
   the training size, because the fit cannot interpolate.

   ---------------------------------------------------------------------------
   FORSYTHE, NOT NORMAL EQUATIONS. Fitting 24 coefficients by solving a 24x24
   Vandermonde system is numerically hopeless. Instead the widget builds
   polynomials orthogonal ON THE DATA POINTS by three-term recurrence, which
   needs no matrix at all and is stable to the top of the ladder. Two properties
   fall out and both are used:

     - every count comes from ONE pass, because the p-parameter fit is the
       partial sum of the first p terms. Twenty-four models for the price of
       one, and the curve and the drawn fit cannot disagree (5.8)
     - checked against numpy's `Polynomial.fit`: worst disagreement anywhere on
       the plotting grid was 3e-11. Re-asserted in the browser as training MSE
       being non-increasing in the parameter count, which least squares
       guarantees and a numerical breakdown would violate
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";

/* --- the truth: one oral dose, first-order absorption and elimination ------ */
const DOSE = 42, KE = 0.28, KA = 1.1;
const T_LO = 0, T_HI = 14;
const NOISE = 1.6;
const trueConc = (t) => DOSE * (Math.exp(-KE * t) - Math.exp(-KA * t));

/* FIFTY PATIENTS, FIXED. A pharmacokinetic study of this size is ordinary, and
   it is small enough that the ladder can actually break the model — which is the
   thing being taught. At 100 the widget is honest and shows overfitting to
   fewer than half of readers on the opening seed; measured numbers per ratio
   are on RATIOS below. */
const N = 50;

/* THE SPLITS PEOPLE QUOTE. Measured on the widget, 30 seeds each, sweeping the
   ladder and asking whether TEST error ends more than 3x above its own minimum:

       60 / 40    97% of seeds    median 9418x
       70 / 30    93%             median 9309x
       80 / 20    80%             median   92x    <- default, the usual one

   Every setting demonstrates, which is the point of fixing the cohort at 50:
   the reader cannot land on a configuration where the lesson fails to appear.
   The gradient is gentler than a cohort-size control gave, because 30, 35 and
   40 training patients are close together — that is the honest cost of putting
   the control in the units people actually quote. */
const RATIOS = {
  "60": { train: 0.6, label: "60 / 40", detail: "30 to train on, 20 to test with" },
  "70": { train: 0.7, label: "70 / 30", detail: "35 to train on, 15 to test with" },
  "80": { train: 0.8, label: "80 / 20", detail: "40 to train on, 10 to test with — the usual default" },
};

/* THE LADDER IS PARAMETERS, NOT DEGREE. A degree-7 polynomial has 8
   coefficients, and it is the COUNT that generalizes: every model has a number
   of fitted parameters, and capacity against sample size is the same idea for a
   tree's leaves, a network's weights or a regression's terms. The polynomial is
   only the vehicle that makes it drawable. */
const MAXP = 24;
const PARAMS = Array.from({ length: MAXP }, (_, i) => i + 1);   // 1..24 => degree 0..23
const MAXD = MAXP - 1;
const DEGREES = Array.from({ length: MAXP }, (_, i) => i);

/* Fold counts, over the TRAINING set. `k: null` means one patient per fold,
   resolved at compute time because the training size depends on the cohort.
   LOOCV only animates because the strip gives it somewhere to happen: a single
   block slides along it, once per patient.

   FIT_TAB_FOLDS is why the fit tab has no control of its own for this: holding
   out a fifth ONCE is exactly fold 1 of a 5-fold rotation, and saying so in the
   arithmetic is what makes the two tabs one mechanism rather than two. */
const FIT_TAB_FOLDS = 5;
const FOLDS = {
  "5": { k: 5, label: "5-fold", detail: "a fifth of the training set held out each time" },
  "10": { k: 10, label: "10-fold", detail: "a tenth held out each time" },
  "loo": { k: null, label: "LOOCV", detail: "one patient per fold — every patient checked alone" },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --- Forsythe orthogonal-polynomial least squares --------------------------
   Returns the recurrence, not coefficients in x: evaluating means re-running
   the recurrence at the query points, which is what keeps it stable. */
function fitPoly(xs, ys, idx, maxDeg) {
  const m = idx.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (const i of idx) { if (xs[i] < lo) lo = xs[i]; if (xs[i] > hi) hi = xs[i]; }
  const span = hi - lo || 1;
  const u = new Float64Array(m);
  for (let j = 0; j < m; j += 1) u[j] = (2 * (xs[idx[j]] - lo)) / span - 1;

  const D = Math.min(maxDeg, m - 1);
  let pkm1 = new Float64Array(m);
  let pk = new Float64Array(m).fill(1);
  const alpha = [];
  const beta = [];
  const c = [];
  const norm = [];

  let n0 = 0;
  for (let j = 0; j < m; j += 1) n0 += pk[j] * pk[j];
  norm.push(n0);
  let dot = 0;
  for (let j = 0; j < m; j += 1) dot += ys[idx[j]] * pk[j];
  c.push(dot / n0);

  for (let k = 0; k < D; k += 1) {
    let a = 0;
    for (let j = 0; j < m; j += 1) a += u[j] * pk[j] * pk[j];
    a /= norm[k];
    const b = k > 0 ? norm[k] / norm[k - 1] : 0;
    alpha.push(a);
    beta.push(b);

    const next = new Float64Array(m);
    for (let j = 0; j < m; j += 1) next[j] = (u[j] - a) * pk[j] - b * pkm1[j];
    pkm1 = pk;
    pk = next;

    let nn = 0;
    for (let j = 0; j < m; j += 1) nn += pk[j] * pk[j];
    norm.push(nn);
    let dy = 0;
    for (let j = 0; j < m; j += 1) dy += ys[idx[j]] * pk[j];
    c.push(nn > 1e-12 ? dy / nn : 0);
  }
  return { lo, span, alpha, beta, c, D };
}

/** The p-parameter fit (degree p-1) evaluated at arbitrary x. */
function evalPoly(f, xq, deg) {
  const d = Math.min(deg, f.D);
  const m = xq.length;
  let pkm1 = new Float64Array(m);
  let pk = new Float64Array(m).fill(1);
  const out = new Float64Array(m);
  for (let j = 0; j < m; j += 1) out[j] = f.c[0];
  for (let k = 0; k < d; k += 1) {
    const next = new Float64Array(m);
    for (let j = 0; j < m; j += 1) {
      const u = (2 * (xq[j] - f.lo)) / f.span - 1;
      next[j] = (u - f.alpha[k]) * pk[j] - f.beta[k] * pkm1[j];
    }
    pkm1 = pk;
    pk = next;
    for (let j = 0; j < m; j += 1) out[j] += f.c[k + 1] * pk[j];
  }
  return out;
}

/** MSE over `idx`, at every parameter count at once. */
function mseCurve(f, xs, ys, idx) {
  const xq = Float64Array.from(idx, (i) => xs[i]);
  const out = new Float64Array(MAXP);
  for (let d = 0; d <= MAXD; d += 1) {
    const p = evalPoly(f, xq, d);
    let s = 0;
    for (let j = 0; j < idx.length; j += 1) s += (ys[idx[j]] - p[j]) ** 2;
    out[d] = s / idx.length;
  }
  return out;
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** One fold held out of `train`: fit on the rest, score on the fold. */
function foldOf(xs, ys, train, from, to) {
  const val = train.slice(from, to);
  const inVal = new Set(val);
  const ft = train.filter((i) => !inVal.has(i));
  const fit = fitPoly(xs, ys, ft, MAXD);
  return {
    train: ft, val, fit,
    trainMse: mseCurve(fit, xs, ys, ft),
    valMse: mseCurve(fit, xs, ys, val),
  };
}

function computeAll({ params, rng }) {
  const xs = new Float64Array(N);
  const ys = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    xs[i] = rng.uniform(T_LO, T_HI);
    ys[i] = Math.max(0, trueConc(xs[i]) + rng.normal(0, NOISE));
  }

  /* ONE SPLIT, DRAWN ONCE. Everything else divides the training half — the
     discipline expressed as the shape of the data rather than as a caption
     (principle 5.3). */
  const order = shuffle(Array.from({ length: N }, (_, i) => i), rng);
  const nTrain = Math.round(N * RATIOS[params.ratio].train);
  const train = order.slice(0, nTrain);
  const test = order.slice(nTrain);

  /* THE MODEL YOU WOULD ACTUALLY SHIP, fitted on the whole training set. Both
     tabs read from it: the fit tab draws its training error against its test
     error, and the CV tab keeps the test error on the panel as the number
     cross-validation is trying to reach without looking at it. */
  const fit = fitPoly(xs, ys, train, MAXD);
  const trainMse = mseCurve(fit, xs, ys, train);
  const testMse = mseCurve(fit, xs, ys, test);

  /* The training set becomes the cross-validation set. */
  const k = FOLDS[params.folds].k ?? nTrain;
  const size = Math.floor(nTrain / k);
  const folds = [];
  for (let f = 0; f < k; f += 1) {
    folds.push(foldOf(xs, ys, train, f * size, f === k - 1 ? nTrain : (f + 1) * size));
  }

  return { xs, ys, n: N, train, test, nTrain, nTest: N - nTrain, fit, trainMse, testMse, folds, k };
}

/* --- log-MSE plotting ------------------------------------------------------ */
const L_LO = 0;
const TICK_TEXT = ["1", "10", "100", "1k", "10k", "100k", "1M"];

/* The ceiling fits what is on screen, in whole decades, so the gridlines stay
   powers of ten and the axis cannot jitter as the reader sweeps the ladder. */
function ceilingFor(curves, upto) {
  let hi = 1;
  for (const arr of curves) {
    for (let d = 0; d <= upto; d += 1) if (arr[d] > hi) hi = arr[d];
  }
  return clamp(Math.ceil(Math.log10(hi)), 2, 6);
}
const lgTo = (hi) => (v) => clamp(Math.log10(Math.max(v, 1e-6)), L_LO, hi);

const argmin = (a, upto) => {
  let b = 0;
  for (let i = 1; i <= upto; i += 1) if (a[i] < a[b]) b = i;
  return b;
};

/* Curves name themselves at their own ends: core's legend is one list for the
   whole widget, and these curves differ by tab.

   DRAWN AS A SET, NOT ONE AT A TIME, because two curves that agree put their
   labels in the same place. Under LOOCV the cross-validated curve and the test
   curve very nearly coincide — which is the good news about LOOCV and was
   rendering as "cross-validated" and "test" printed over each other. */
function labelEnds(ctx, colors, plot, upto, lg, items) {
  const MIN_GAP = 13;
  const placed = items
    .map((it) => ({ ...it, y: plot.sy(lg(it.arr[upto])) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i += 1) {
    if (placed[i].y - placed[i - 1].y < MIN_GAP) placed[i].y = placed[i - 1].y + MIN_GAP;
  }
  const px = plot.sx(upto);
  const near = px > plot.x + plot.w - 76;
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = near ? "right" : "left";
  ctx.textBaseline = "middle";
  for (const it of placed) {
    ctx.fillStyle = it.tone;
    ctx.fillText(it.text, px + (near ? -8 : 8), it.y);
  }
  ctx.restore();
}

defineWidget({
  slug: "generalization",
  title: "Fitting and Generalizing",
  subtitle:
    "A model is fit to training data and evaluated on data it has never seen; "
    + "cross-validation rotates the held-out portion to estimate generalization "
    + "before the test set is used.",
  layout: "side",
  status: "shipped",
  height: 528,

  params: {
    view: {
      type: "segmented",
      label: "",
      options: [
        { value: "fit", label: "The fit" },
        { value: "cv", label: "Cross-validation" },
      ],
      default: "fit",
      display: true,
    },

    /* THE MODEL, AND A CURSOR RATHER THAN A REFIT. One Forsythe pass holds every
       count; this says how many terms to add up. So it is `display`: it changes
       no data and recomputes no error. */
    params: {
      type: "choice",
      label: "Parameters in the model",
      options: PARAMS.map((p) => ({
        value: String(p),
        label: String(p),
        detail: p === 1 ? "1 — a flat line at the mean concentration"
          : p === 2 ? "2 — a straight line: a slope and an intercept"
            : `${p} coefficients, fitted to the training patients`,
      })),
      default: "2",
      display: true,
    },

    /* THE REMEDY, AS A CONTROL. Overfitting is the parameter count against the
       number of patients, so this is the slider that turns it off — and it turns
       it off the way it is actually turned off in practice, by having more
       patients rather than by choosing a cleverer model. */
    /* THE SPLIT, AS A RATIO. Shown on BOTH tabs, because it is upstream of both:
       it fixes the training set that the fit tab fits and the CV tab divides
       into folds. That is the notebook's diagram — one split, then everything
       else happens inside the training half. */
    ratio: {
      type: "choice",
      label: "Training / test split",
      options: Object.entries(RATIOS).map(([value, o]) => ({
        value, label: o.label, detail: o.detail,
      })),
      default: "80",
    },

    folds: {
      type: "choice",
      label: "Folds",
      options: Object.entries(FOLDS).map(([value, o]) => ({ value, label: o.label, detail: o.detail })),
      default: "5",
      when: { param: "view", equals: "cv" },
    },

    /* WHICH PATIENTS TO LOOK AT, AND THE ERRORS DRAWN TO THEM. A whole cohort in
       three roles on one panel is unreadable — reported as exactly that.
       Selecting one role dims the others and draws a vertical line from every
       one of its patients to the curve.

       Those lines are the residuals, and MSE is the mean of their squares. That
       is the connection students are asked to take on trust from a formula: the
       error panel below is a summary of the lines above it. */
    look: {
      type: "segmented",
      label: "Look at",
      options: [
        { value: "train", label: "Training", detail: "the patients the curve was fitted to" },
        { value: "valid", label: "Held out", detail: "the test set on the fit tab, this fold on the other" },
        { value: "both", label: "Both", detail: "no error lines: at a whole cohort they overlap" },
      ],
      default: "train",
      display: true,
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* The reveal, in the arc's one pattern: segmented Off/On after Seed. It
       was a checkbox below the drive row until the 2026-08-27 sweep. Values
       stay "0"/"1" so shared ?truth=1 links parse unchanged. */
    truth: {
      type: "segmented",
      label: "True curve",
      detail: "what the concentrations were actually drawn from",
      options: [
        { value: "0", label: "Off" },
        { value: "1", label: "On" },
      ],
      default: "0",
      display: true,
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "Slow" },
        { value: "brisk", label: "Medium" },
        { value: "fast", label: "Fast", detail: "no pause per fold — the only way to watch LOOCV" },
      ],
      default: "brisk",
      display: true,
    },

    shown: { type: "int", min: 0, max: MAXP, default: 0, hidden: true },
  },

  /* Three marks for the three roles, and they hold on both tabs. The aqua one
     only appears on the cross-validation tab, which is correct rather than
     untidy: it names a thing that exists only there. */
  legend: [
    { token: "group-a", label: "Training", mark: "dot" },
    { token: "group-b", label: "The fold held out right now", mark: "dot" },
    { token: "holdout", label: "Test — touched once, at the end", mark: "dot" },
  ],

  compute: computeAll,

  animation: {
    stepLabel: { param: "view", labels: { cv: "Next fold" }, default: "Add a parameter" },
    stepTitle: "Give the model one more coefficient and refit",
    runTitle: "Add parameters one at a time, all the way up the ladder",

    init: ({ params }) => ({
      fold: 0,
      seen: 1,
      /* `pos` is how many parameters the figure shows: the slider SETS it and
         Play ADVANCES it, so the two never fight. `maxSeen` is how far the
         curves have been drawn and only ever grows, which keeps the widget from
         opening on its own answer (invariant 4) while still letting the reader
         sweep back to compare.

         `lastSlider` exists because `rebuild` runs on EVERY display change:
         syncing `pos` from the slider unconditionally meant that toggling "Look
         at" threw away a ladder the reader had played all the way up. */
      pos: Math.max(1, Number(params.params)),
      lastSlider: Math.max(1, Number(params.params)),
      maxSeen: Math.max(1, params.shown || 1, Number(params.params)),
      t: 0,
      done: false,
    }),

    rebuild(anim, { params }) {
      const p = Math.max(1, Number(params.params));
      if (p !== anim.lastSlider) {
        anim.pos = p;
        anim.lastSlider = p;
      }
      anim.maxSeen = Math.max(anim.maxSeen, anim.pos);
    },

    advance(anim, { dt, params, state }) {
      const per = params.speed === "slow" ? 900 : params.speed === "fast" ? 90 : 400;
      anim.t += dt;

      /* THE FIT TAB CLIMBS THE LADDER; THE CV TAB ROTATES THE FOLDS. Two tabs,
         two nouns, and the step label declares which (3.4c, amended). */
      if (params.view !== "cv") {
        while (anim.t >= per) {
          anim.t -= per;
          if (anim.pos >= MAXP) { anim.done = true; return false; }
          anim.pos += 1;
          anim.maxSeen = Math.max(anim.maxSeen, anim.pos);
          if (anim.mode === "step") return false;
        }
        return true;
      }

      const count = state.folds.length;
      while (anim.t >= per) {
        anim.t -= per;
        anim.fold = (anim.fold + 1) % count;
        anim.seen = Math.min(count, anim.seen + 1);
        if (anim.mode === "step") return false;
        if (anim.fold === 0) { anim.done = true; return false; }
      }
      return true;
    },
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    /* `--c-group-a`/`--c-group-b` are the roles that fit these two — two arms of
       one comparison — and nothing else claims them here, because the outcome is
       numeric and there is no event/non-event colour on the figure. */
    /* THREE ROLES, AND EACH KEEPS ITS COLOUR ON BOTH TABS. Training is blue
       wherever it appears, the test set is amber wherever it appears, and the
       cross-validated estimate is aqua — a role of its own, because it is
       neither of the other two: it is an average of folds cut out of training,
       drawn on the same panel as the test curve it is trying to match. A colour
       that changed meaning between tabs is the defect this avoids. */
    const FITTED = colors.groupA;    /* blue   — the patients the fit used     */
    const CVEST = colors.groupB;     /* yellow — the fold held out right now   */
    const TEST = colors.holdout;     /* red    — spent once, at the very end   */

    const cv = params.view === "cv";
    const shownP = cv ? Number(params.params) : (anim?.pos ?? Number(params.params));
    const deg = shownP - 1;
    const cur = cv ? state.folds[(anim?.fold ?? 0) % state.folds.length] : null;
    const fitOf = cur ? cur.fit : state.fit;
    const trainSet = cur ? cur.train : state.train;
    const heldSet = cur ? cur.val : state.test;
    const left = 54;
    const width = w - left - 18;

    /* --- the strip: the whole cohort, in the roles it holds right now ------- */
    /* 0 test, 1 training, 2 the fold held out right now. On the fit tab nothing
       is role 2: the split is training and test, full stop. */
    const role = new Uint8Array(state.n);
    for (const i of state.train) role[i] = 1;
    if (cur) for (const i of cur.val) role[i] = 2;

    const stripY = 18;
    const stripH = 16;
    const pitch = width / state.n;
    /* Training first and the test set last, so the strip reads as one ordered
       cohort rather than as the shuffle that produced it. */
    const ordered = [...state.train, ...state.test];
    ordered.forEach((idx, s) => {
      const c = role[idx] === 0 ? TEST : role[idx] === 1 ? FITTED : CVEST;
      ctx.save();
      ctx.globalAlpha = role[idx] === 0 ? 0.55 : 1;
      ctx.fillStyle = c;
      ctx.fillRect(left + s * pitch + 0.5, stripY, Math.max(1.5, pitch - 1.5), stripH);
      ctx.restore();
    });

    /* A RULE UNDER THE TRAINING PORTION, because the held-out fold is INSIDE it
       and a flat row of three colours says otherwise. The two-way split is the
       claim; the fold is a division of one side of it. */
    const trainW = state.nTrain * pitch;
    ctx.save();
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    const ry = Math.round(stripY + stripH + 3) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, ry);
    ctx.lineTo(left + trainW - 3, ry);
    ctx.moveTo(left + trainW + 3, ry);
    ctx.lineTo(left + width, ry);
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(
      cv
        ? `${state.nTrain} training · ${state.k} folds of ${Math.floor(state.nTrain / state.k)}`
        : `${state.nTrain} training`,
      left, ry + 4
    );
    ctx.textAlign = "right";
    ctx.fillText(`${state.nTest} test`, left + width, ry + 4);
    ctx.restore();

    /* --- the scatter, and the fit at the chosen parameter count ------------- */
    const sc = makePlot({
      ctx, colors,
      rect: { x: left, y: 78, w: width, h: 164 },
      xDomain: [T_LO, T_HI],
      yDomain: [-2, 26],
    });
    sc.grid([0, 5, 10, 15, 20, 25]);
    sc.axisY({ ticks: [0, 5, 10, 15, 20, 25], label: "Concentration (mg/L)" });
    sc.axisX({ label: "Hours since dose" });

    if (params.truth === "1") {
      const g = [];
      for (let s = 0; s <= 160; s += 1) {
        const t = T_LO + ((T_HI - T_LO) * s) / 160;
        g.push([t, trueConc(t)]);
      }
      sc.curve(g, { stroke: colors.reference, width: 2, dash: [5, 4] });
    }

    /* CLIPPED TO ITS OWN PANEL. A 20-parameter fit dives far below the axis
       between two training patients, and canvas does not clip — it was drawn
       straight down through the error panel below and read as a stray axis.
       Clamping the values instead would be worse: it would draw a flat line
       along the floor and quietly claim the model predicts that. */
    const gx = new Float64Array(220);
    for (let s = 0; s < 220; s += 1) gx[s] = T_LO + ((T_HI - T_LO) * s) / 219;
    const gy = evalPoly(fitOf, gx, deg);
    const fitPts = [];
    for (let s = 0; s < 220; s += 1) fitPts.push([gx[s], gy[s]]);

    ctx.save();
    ctx.beginPath();
    ctx.rect(sc.x, sc.y, sc.w, sc.h);
    ctx.clip();
    sc.curve(fitPts, { stroke: colors.highlight, width: 2 });

    /* Residual lines, inside the same clip, under the patients themselves. */
    const focus = params.look;
    if (focus !== "both") {
      const idx = focus === "train" ? trainSet : heldSet;
      const xq = Float64Array.from(idx, (i) => state.xs[i]);
      const py = evalPoly(fitOf, xq, deg);
      ctx.strokeStyle = focus === "train" ? FITTED : (cv ? CVEST : TEST);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      for (let j = 0; j < idx.length; j += 1) {
        const px = sc.sx(state.xs[idx[j]]);
        ctx.beginPath();
        ctx.moveTo(px, sc.sy(state.ys[idx[j]]));
        ctx.lineTo(px, sc.sy(py[j]));
        ctx.stroke();
      }
    }
    ctx.restore();

    for (let s = 0; s < state.n; s += 1) {
      const i = ordered[s];
      const r = role[i];
      const lit = focus === "both" ? r !== 0 : (focus === "train" ? r === 1 : r === 2);
      const c = r === 0 ? TEST : r === 1 ? FITTED : CVEST;
      ctx.globalAlpha = lit ? 1 : 0.16;
      sc.dot(state.xs[i], state.ys[i], { fill: c, r: lit ? 3.4 : 2.6 });
    }
    ctx.globalAlpha = 1;

    sc.caption(cv
      ? `Fold ${(anim?.fold ?? 0) + 1} of ${state.k} held out · ${shownP} parameters`
      : focus === "both"
        ? `${shownP} parameter${shownP === 1 ? "" : "s"} fitted to ${trainSet.length} patients`
        : `${shownP} parameter${shownP === 1 ? "" : "s"} · each line is one patient's error`);

    /* --- MSE against the parameter count, on a log axis --------------------- */
    const upto = Math.max(1, anim?.maxSeen ?? 1) - 1;
    const onScreen = cv
      ? [...state.folds.slice(0, Math.min(anim?.seen ?? 1, state.folds.length)).map((f) => f.valMse), state.testMse]
      : [state.trainMse, state.testMse];
    const hi = ceilingFor(onScreen, upto);
    const lg = lgTo(hi);
    const ticks = Array.from({ length: hi + 1 }, (_, i) => i);

    const p2 = makePlot({
      ctx, colors,
      rect: { x: left, y: 318, w: width, h: 150 },
      xDomain: [-0.3, MAXD + 0.3],
      yDomain: [L_LO, hi],
    });
    p2.grid(ticks);
    p2.axisY({ ticks, format: (t) => TICK_TEXT[t] ?? "", label: "MSE" });
    p2.axisX({ ticks: DEGREES.filter((d) => d % 4 === 0), format: (d) => String(d + 1), label: "Parameters in the model" });

    const cut = (arr) => Array.from({ length: upto + 1 }, (_, d) => [d, lg(arr[d])]);

    if (!cv) {
      p2.curve(cut(state.trainMse), { stroke: FITTED, width: 2 });
      p2.curve(cut(state.testMse), { stroke: TEST, width: 2 });
      labelEnds(ctx, colors, p2, upto, lg, [
        { arr: state.trainMse, tone: FITTED, text: "training" },
        { arr: state.testMse, tone: TEST, text: "test" },
      ]);
      p2.dot(deg, lg(state.trainMse[deg]), { fill: FITTED, r: 4 });
      p2.dot(deg, lg(state.testMse[deg]), { fill: TEST, r: 4 });
      p2.caption(upto < 2
        ? "Take the parameters up, and the two curves draw themselves"
        : "Error on the patients it fitted, against error on the test set it has never seen");
    } else {
      const seen = Math.min(anim?.seen ?? 1, state.folds.length);
      for (let f = 0; f < seen; f += 1) {
        p2.curve(cut(state.folds[f].valMse), { stroke: CVEST, width: 1, opacity: 0.18 });
      }
      const mean = new Float64Array(MAXP);
      for (let d = 0; d <= MAXD; d += 1) {
        let s = 0;
        for (let f = 0; f < seen; f += 1) s += state.folds[f].valMse[d];
        mean[d] = s / seen;
      }
      p2.curve(cut(mean), { stroke: CVEST, width: 2 });
      p2.curve(cut(state.testMse), { stroke: TEST, width: 2, dash: [5, 4] });
      labelEnds(ctx, colors, p2, upto, lg, [
        { arr: mean, tone: CVEST, text: "cross-validated" },
        { arr: state.testMse, tone: TEST, text: "test" },
      ]);

      /* ONE FAINT DOT PER FOLD, ONE SOLID DOT FOR THEIR MEAN — the same
         weighting the curves already use, so the convention is learned once.
         The spread of the faint dots at the current parameter count IS the
         fold-to-fold variability, which is what cross-validation averages away;
         without them the only dot was the running mean, which drifts and reads
         as a single measurement wandering rather than an average settling. */
      for (let f = 0; f < seen; f += 1) {
        ctx.save();
        ctx.globalAlpha = f === (anim?.fold ?? 0) ? 0.75 : 0.3;
        ctx.beginPath();
        ctx.arc(p2.sx(deg), p2.sy(lg(state.folds[f].valMse[deg])), 3, 0, Math.PI * 2);
        ctx.fillStyle = CVEST;
        ctx.fill();
        ctx.restore();
      }
      p2.dot(deg, lg(mean[deg]), { fill: CVEST, r: 5 });
      p2.caption(seen < state.folds.length
        ? `${seen} of ${state.folds.length} folds scored`
        : `All ${state.folds.length} folds scored — their mean is the cross-validated error`);
    }

    /* The rule carries no label: it said `N parameters`, which collided with the
       curve's own end-label in exactly the states worth looking at, and the
       count is already on the slider, in the caption and in the readout. */
    p2.vline(deg, { stroke: colors.highlight });
  },

  readout: ({ params, state, anim }) => {
    const cv = params.view === "cv";
    const shownP = cv ? Number(params.params) : (anim?.pos ?? Number(params.params));
    const deg = shownP - 1;
    /* `maxSeen` counts PARAMETERS and the curves are indexed by DEGREE, so the
       last index reached is one less. Off by one, this reported "best so far: 3
       parameters, of the 2 you have tried". */
    const grown = Math.max(1, anim?.maxSeen ?? 1);
    const upto = grown - 1;

    if (!cv) {
      const best = argmin(state.testMse, upto);
      return [
        {
          label: "MSE on the patients it fitted",
          value: fmt(state.trainMse[deg], 2),
          note: `${shownP} parameter${shownP === 1 ? "" : "s"} · ${state.nTrain} patients`,
        },
        { label: "MSE on the test set", value: fmt(state.testMse[deg], 2), note: `${state.nTest} patients` },
        {
          label: "Best so far",
          value: `${best + 1} parameter${best === 0 ? "" : "s"}`,
          note: grown < MAXP ? `of the ${grown} you have tried` : "over the whole ladder",
        },
      ];
    }

    const seen = Math.min(anim?.seen ?? 1, state.folds.length);
    let s = 0;
    for (let f = 0; f < seen; f += 1) s += state.folds[f].valMse[deg];
    const mu = s / seen;
    const meanAll = new Float64Array(MAXP);
    for (let d = 0; d <= MAXD; d += 1) {
      let t = 0;
      for (let f = 0; f < seen; f += 1) t += state.folds[f].valMse[d];
      meanAll[d] = t / seen;
    }
    const pick = argmin(meanAll, upto);
    return [
      { label: "Cross-validated MSE", value: fmt(mu, 2), note: `mean of ${seen} fold${seen === 1 ? "" : "s"}` },
      { label: "Parameters it picks", value: String(pick + 1), note: "lowest CV error so far" },
      { label: "Test MSE there", value: fmt(state.testMse[pick], 2), note: `${state.nTest} patients, never split` },
    ];
  },
});
