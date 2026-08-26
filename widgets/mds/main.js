/* ============================================================================
   Multidimensional scaling, classical and non-metric.

   TWO HOSTS, ONE IN EACH COURSE, which no other widget has:
     PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 20-30 — Python,
       `sklearn.manifold.MDS`, and where this widget started
     PHM5003 `05 / 04 - Dimensionality Reduction.ipynb` — R, `cmdscale` then
       `isoMDS`, and the source of the non-metric half. It puts classical and
       non-metric under ONE heading on ONE distance matrix, which is why they
       are one widget here rather than two.

   Design history and the measurements behind every constant here are in
   docs/catalogue.md under Widget 20.

   Set how many samples there are and where the search starts. Turn the cloud by
   dragging it. Press Measure and every pair's distance goes into the table —
   and the coordinates fade out, because from that point on the table is the
   whole input. Then Rearrange, one SMACOF step at a time, until nothing moves.

   THE 2-D PANEL IS NOT A PROJECTION of the 3-D one. Nothing is flattened; the
   arrangement is built fresh from the table and has no relation to the viewing
   angle. That is the difference from widget 19, and it is the whole point.
   ========================================================================= */

import { defineWidget } from "../core/index.js";

/* The group centres sit on a sphere of this radius, as far from each other as
   they can get, and each sample scatters around its own centre by SIGMA. At one
   sample per group a centre IS a sample, which is how the ungrouped stage the
   widget started with is still reachable. */
const R = 2;
const SIGMA = 0.22;
/* Sixteen, because four groups of four is now reachable and every sample needs
   a header letter in the table whether or not its dot is labelled. */
const LETTERS = "ABCDEFGHIJKLMNOP";
const GENES = ["Gene 1", "Gene 2", "Gene 3"];
/* Past six samples an individual letter has nothing to label — the dots are in
   clusters and overlap — so identity falls back to the group's colour, and the
   table's headers keep the letters. Same threshold retires the pair lines: 15 of
   them read as a figure, 66 read as a hairball. */
const LABEL_MAX = 6;

/* --- 3-vector arithmetic -------------------------------------------------- */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);

/* --- the stage ------------------------------------------------------------ *
 * `groups` centres on a sphere, spread as far apart as they can get: two
 * antipodal, three a triangle, four a regular tetrahedron. The seed moves them,
 * and `samples` members scatter around each.
 *
 * THE SAME LESSON TWICE, AT TWO SCALES, and it is what makes `groups` carry an
 * idea rather than just adding dots (3.5). Three points make a triangle and a
 * triangle is flat; four spread out in space cannot be laid on paper at all —
 * and the group CENTRES obey exactly the same rule, because two centres make a
 * line and three make a plane. Measured over 200 seeds at three per group:
 *
 *     2 groups   stress 0.01   the picture is faithful
 *     3 groups   stress 0.10   still faithful
 *     4 groups   stress 14.3   the clusters come through, the gaps do not
 *
 * That last row is the widget's whole argument arriving on a control the reader
 * moves: at four clusters the separation still reads 2.1 — every cluster is a
 * distinct blob — while how far apart they LOOK has stopped being how far apart
 * they are.
 *
 * IT STOPS AT FOUR GROUPS, where PCA goes to six, and the table is why: it is n
 * by n, and four groups of three already takes the cells below the size a
 * number fits in. The object here is the table, so the table sets the limit. */
function spread(n) {
  if (n === 2) return [[0, 0, R], [0, 0, -R]];
  if (n === 3) {
    return [0, 1, 2].map((k) => {
      const a = (2 * Math.PI * k) / 3;
      return [R * Math.cos(a), R * Math.sin(a), 0];
    });
  }
  const c = R / Math.sqrt(3);
  return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => scale(v, c));
}

const gauss = (rng) =>
  Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

/* THE SEED MOVES EVERY SAMPLE, and 0.12 of the radius is measured rather than
   chosen by eye. Fully random samples were tried first and are wrong: n random
   points on a sphere are near-coplanar often enough that four of them fit in
   two dimensions to three decimals at the MEDIAN seed (final stress 0.037, and
   0.000 at seed 1), which hands the reader the opposite of the lesson. Over 200
   seeds, jittering the spread configuration instead:

     jitter   n = 3          n = 4, worst seed of 200
     0.00     0.000 always   1.830  — one configuration, no variety
     0.12     0.000 always   0.385  — never fits, and stress ranges 0.4 to 4.4
     0.20     0.000 always   0.048  — one seed in 200 fits almost exactly
     0.30     0.000 always   0.000  — the failing case is gone

   0.12 is the largest jitter that still fails at every seed. Each sample is put
   back on the sphere afterwards, so the cloud keeps its size: raw stress is
   scale-dependent, and a cloud that grew with the seed would make the number
   incomparable between seeds. */
const JITTER = 0.12;
function stage(groups, per, rng) {
  const centres = spread(groups).map((p) => {
    const v = [0, 1, 2].map((k) => p[k] + gauss(rng) * JITTER * R);
    const m = Math.hypot(v[0], v[1], v[2]) || 1;
    return v.map((x) => (x / m) * R);
  });
  const out = [];
  for (let g = 0; g < groups; g += 1) {
    for (let i = 0; i < per; i += 1) {
      /* At one per group the sample IS the centre, with no scatter of its own —
         so the jitter measured for the ungrouped stage still governs it. */
      out.push({ g, p: centres[g].map((x) => (per > 1 ? x + gauss(rng) * SIGMA : x)) });
    }
  }
  return out;
}

/* A fixed turn of the whole arrangement, applied once. Unrotated, the
   octahedron's six samples sit exactly ON the three gene axes, which says a
   sample is one gene and it is not. Nothing about the method changes — every
   distance is identical — which is itself the first thing the widget shows. */
function tilted(pts) {
  const a = 0.54, b = 0.33;              /* radians, chosen to miss every axis */
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return pts.map(([x, y, z]) => {
    const x1 = ca * x - sa * y, y1 = sa * x + ca * y;
    return [x1, cb * y1 - sb * z, sb * y1 + cb * z];
  });
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function targets(pts) {
  const n = pts.length;
  const D = [];
  for (let i = 0; i < n; i += 1) {
    D.push([]);
    for (let j = 0; j < n; j += 1) D[i].push(dist3(pts[i], pts[j]));
  }
  return D;
}

/* Pool-adjacent-violators: the least-squares fit to `y` that never decreases
   along the order it is given. This is `f`, the monotonic transformation
   `03-5`'s non-metric stress formula names, and it is refitted at EVERY step —
   which is what the lesson's "it is typically determined iteratively" means. */
function pava(y) {
  const lvl = [], wt = [], start = [];
  for (let i = 0; i < y.length; i += 1) {
    let val = y[i], wgt = 1, st = i;
    while (lvl.length && lvl[lvl.length - 1] > val) {
      const pv = lvl.pop(), pw = wt.pop();
      st = start.pop();
      val = (pv * pw + val * wgt) / (pw + wgt);
      wgt += pw;
    }
    lvl.push(val); wt.push(wgt); start.push(st);
  }
  const out = new Array(y.length);
  for (let b = 0; b < lvl.length; b += 1) {
    const to = b + 1 < lvl.length ? start[b + 1] : y.length;
    for (let i = start[b]; i < to; i += 1) out[i] = lvl[b];
  }
  return out;
}

/* The disparities: what the non-metric fit is actually aiming at. `order` is the
   pairs sorted by their MEASURED distance, so a monotone fit along it is exactly
   "keep the order and forget the sizes". */
function disparities(d, order) {
  const out = new Array(d.length);
  const fitted = pava(order.map((k) => d[k]));
  order.forEach((k, r) => { out[k] = fitted[r]; });
  return out;
}

/* KRUSKAL STRESS-1 FOR BOTH METHODS, and the change is deliberate rather than
   tidy. The widget used to print RAW stress, which is what `sklearn`'s
   `stress_` returns and what `03-5`'s classical formula writes. But the
   lesson's NON-metric formula is the normalised one, and the two are not
   comparable — so a single chart carrying both methods forces one definition
   over the pair, and stress-1 is the one that works for both. Every stress
   figure recorded before this change is a different number. */
function stress1(X, pairs, delta, order, metric) {
  const d = pairs.map(([i, j]) => dist2(X[i], X[j]));
  const t = metric ? delta : disparities(d, order);
  const num = d.reduce((s, v, k) => s + (v - t[k]) ** 2, 0);
  const den = d.reduce((s, v) => s + v * v, 0) || 1;
  return Math.sqrt(num / den);
}

/* 1 for the closest pair, up to n(n-1)/2 for the furthest. This is the whole of
   what the non-metric fit is given. */
function rankOf(v) {
  const order = v.map((_, k) => k).sort((a, b) => v[a] - v[b]);
  const out = new Array(v.length);
  order.forEach((k, i) => { out[k] = i + 1; });
  return out;
}

/* One SMACOF step — the Guttman transform. Every sample moves to the average of
   where each other sample would put it if that one distance were right, so the
   move is a compromise between n - 1 demands and the stress cannot rise. */
function guttman(X, target) {
  const n = X.length;
  const Y = [];
  for (let i = 0; i < n; i += 1) {
    let sx = 0, sy = 0, wii = 0;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const d = dist2(X[i], X[j]);
      /* Two samples exactly on top of each other have no direction to be pushed
         apart along, so they contribute nothing this step rather than dividing
         by zero and taking the whole layout to NaN. */
      const b = d > 1e-12 ? -target(i, j) / d : 0;
      sx += b * X[j][0];
      sy += b * X[j][1];
      wii -= b;
    }
    Y.push([(wii * X[i][0] + sx) / n, (wii * X[i][1] + sy) / n]);
  }
  return Y;
}

/* STOP WHEN THE PICTURE STOPS MOVING, not when the number stops falling. Raw
   stress keeps improving in the ninth decimal long after every sample is inside
   a pixel of where it will end up, and those steps are Play running with
   nothing on screen to see. At 0.002 units the last step is sub-pixel at every
   canvas width, n = 4 still lands on 1.830 from all 200 starts, and the median
   run is 15 steps rather than 30. */
const MOVE_TOL = 0.002;
const MAX_STEPS = 120;

function smacof(D, rng, n) {
  let X = [];
  for (let i = 0; i < n; i += 1) X.push([(rng.next() * 2 - 1) * R, (rng.next() * 2 - 1) * R]);
  /* Centred, so the Guttman transform — which preserves the centroid — keeps the
     arrangement in the middle of its panel for the whole run. */
  const mx = X.reduce((s, p) => s + p[0], 0) / n;
  const my = X.reduce((s, p) => s + p[1], 0) / n;
  X = X.map((p) => [p[0] - mx, p[1] - my]);

  const path = [X];
  const at = (i, j) => D[i][j];
  for (let it = 0; it < MAX_STEPS; it += 1) {
    const Y = guttman(X, at);
    const move = Math.max(...Y.map((p, i) => dist2(p, X[i])));
    path.push(Y);
    X = Y;
    if (move < MOVE_TOL) break;
  }
  return path;
}

/* THE NON-METRIC HALF, AND IT CONTINUES FROM THE METRIC FIT RATHER THAN FROM A
   RANDOM START. That is not a convenience: `isoMDS` takes its default starting
   configuration from `cmdscale`, so beginning at the classical answer is what
   the lesson's own code does. It also decides whether this works at all — from
   a random start, non-metric SMACOF COLLAPSED 18 OF 40 SEEDS into degenerate
   clumps at eight samples, every cluster on top of its neighbour. From the
   metric fit it never did.

   So the rank-order trajectory is the metric one with more steps on the end,
   and the reader who has already run the metric fit keeps their position when
   they switch. */
function smacofRank(pairs, order, from) {
  let X = from.map((p) => p.slice());
  const sizeOf = (Y) => Math.hypot(...pairs.map(([i, j]) => dist2(Y[i], Y[j])));
  /* THE SIZE OF A NON-METRIC ARRANGEMENT IS ARBITRARY, and holding it fixed is
     a correctness matter rather than tidiness. Only the ORDER of the distances
     is being fitted, so nothing in the objective says how big the picture
     should be — and left alone the fit drifts steadily smaller, because the
     monotone fit pools neighbouring distances and pooling averages. Measured
     before this was added: at four groups of three the arrangement finished at
     48% of the panel where the metric fit finishes at 84%, so the clusters read
     as closer together than they are and the reader is comparing two pictures
     drawn at different scales.

     Fixed to the metric fit's own size, which the first frame already has, so
     the switch is seamless and the two methods are drawn like for like. Scaling
     changes no distance ORDER, so it changes nothing the fit is judged on —
     verified: separation and stress are bit-identical with and without it. */
  const size0 = sizeOf(X) || 1;
  const path = [X];
  for (let it = 0; it < MAX_STEPS; it += 1) {
    const d = pairs.map(([i, j]) => dist2(X[i], X[j]));
    const T = disparities(d, order);
    const tgt = new Map(pairs.map(([i, j], k) => [i + "," + j, T[k]]));
    const at = (i, j) => tgt.get(i > j ? `${i},${j}` : `${j},${i}`);
    let Y = guttman(X, at);
    const size = sizeOf(Y) || 1;
    Y = Y.map((p) => [(p[0] * size0) / size, (p[1] * size0) / size]);
    const move = Math.max(...Y.map((p, i) => dist2(p, X[i])));
    path.push(Y);
    X = Y;
    if (move < MOVE_TOL) break;
  }
  return path;
}

/* --- layout --------------------------------------------------------------- *
 * One function, read by both `height` and `draw`, so the two cannot drift.
 * Three panels: where the samples are, what was measured, what came out. The
 * table gets a wider box than the two scatters because a scatter of six dots is
 * legible at any size and a six-by-six grid of two-line cells is not.
 * No lower clamp on the panel size: a floor lets the panels total more than the
 * canvas holds, which ran widget 19's right panel 60px off the edge.          */
const PAD_L = 14, PAD_R = 14, GAP = 20, TOP = 26, ROW_GAP = 34, BOT = 30;
const CELL_MAX = 360;
const ROW_RATIO = 0.8;

/* TWO BY TWO, and which quadrant each panel takes is the whole design:
 *
 *      the samples      the table
 *      the stress       the arrangement
 *
 * Three panels in a row put every one of them on a third of the canvas — 210px
 * at the width a reader has, 146 at the narrowest — and left the stress chart
 * alone in a band that was two thirds empty. The grid gives each panel HALF the
 * canvas instead, which is 37% more, and the table's cells grow enough to keep
 * their numbers at twelve samples where the row could not.
 *
 * The quadrants are not interchangeable:
 *   - the table sits DIRECTLY ABOVE the arrangement it is the input to, which
 *     is the one adjacency the widget cannot do without (2.7)
 *   - the cloud is DIAGONAL from the arrangement, never beside or above it.
 *     Widget 19 puts a cloud next to a 2-D plot because there the second is a
 *     projection of the first. Here it is not, and two spaces sharing an edge
 *     invite exactly the reading this widget exists to break
 *   - reading order runs across then down, which is the order the story does
 *     (3.1): the samples, their distances, the fit falling, the arrangement   */
function layout(w) {
  const colW = Math.min(CELL_MAX, Math.max(40, (w - PAD_L - PAD_R - GAP) / 2));
  const rowH = colW * ROW_RATIO;
  const x0 = Math.max(PAD_L, (w - (colW * 2 + GAP)) / 2);
  const x1 = x0 + colW + GAP;
  const y1 = TOP + rowH + ROW_GAP;
  return {
    /* The square a scatter gets, which is the smaller side of its cell — the
       spare width goes to the table, which is the only panel that can use it. */
    side: Math.min(colW, rowH),
    space: { x: x0, y: TOP, w: colW, h: rowH },
    table: { x: x1, y: TOP, w: colW, h: rowH },
    chart: { x: x0, y: y1, w: colW, h: rowH },
    flat: { x: x1, y: y1, w: colW, h: rowH },
    height: TOP + rowH + ROW_GAP + rowH + BOT,
  };
}

/* Two screen basis vectors rather than a projection function, and the same
   orthographic camera widget 19 turns its cloud with. */
const TURN0 = 34, TILT0 = 21;
function camera(turnDeg, tiltDeg) {
  const az = (turnDeg * Math.PI) / 180, el = (tiltDeg * Math.PI) / 180;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return { ex: [-sa, ca, 0], ey: [-ca * se, -sa * se, ce] };
}

/* --- drawing -------------------------------------------------------------- */
const R_DOT = 4.5;

function text(ctx, colors, s, x, y, col, size, align = "left", base = "middle") {
  ctx.save();
  ctx.fillStyle = col;
  ctx.font = `${size} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* Local, as every other scatter widget here has one: `plot.dot` saves, strokes
   and restores per point, which is a blob at this size. `hollow` is the sample
   once its coordinates have been set aside — still there, no longer used. */
/* `fade` is a MULTIPLIER and has to be, rather than an alpha the caller sets
   before the call: both branches below assign `globalAlpha` outright, so an
   alpha set outside is thrown away and the depth cue silently does nothing. */
function sampleDot(ctx, colors, x, y, col, hollow = 0, r = R_DOT, fade = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (hollow < 1) {
    ctx.globalAlpha = (1 - hollow) * fade;
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = hollow > 0 ? colors.ink3 : colors.surface;
  ctx.globalAlpha = (hollow > 0 ? 0.35 + 0.65 * (1 - hollow) : 1) * fade;
  ctx.stroke();
  ctx.restore();
}

const sampleCol = (colors, i) => colors.clusters[i % colors.clusters.length];

/* THE SPHERE THE SAMPLES SIT ON, drawn as its three coordinate great circles.
   It is what makes the left panel read as three dimensions rather than as a
   scatter of dots that happens to be draggable — the three ellipses change
   shape as the figure turns, and the half of each that runs BEHIND the sphere
   is drawn fainter, which is what stops it reading as three flat rings.

   A bounding cube was the other candidate and does the same job; the sphere
   wins because it is exactly true of this stage — every sample is on it — so
   it describes the data rather than furnishing the panel. */
function globe(ctx, colors, P, eye, radius, alpha) {
  const planes = [[0, 1], [1, 2], [2, 0]];
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  for (const [a, b] of planes) {
    for (const front of [false, true]) {
      ctx.globalAlpha = alpha * (front ? 0.9 : 0.32);
      ctx.beginPath();
      let drawing = false;
      for (let k = 0; k <= 96; k += 1) {
        const t = (k / 96) * Math.PI * 2;
        const p = [0, 0, 0];
        p[a] = radius * Math.cos(t);
        p[b] = radius * Math.sin(t);
        /* `eye` points at the reader, so a positive depth is the near half. */
        if ((dot(p, eye) >= 0) !== front) { drawing = false; continue; }
        const [x, y] = P(p);
        if (drawing) ctx.lineTo(x, y); else { ctx.moveTo(x, y); drawing = true; }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* Every pair, in the order the table reads: down the rows, along each row. The
   animation staggers the numbers along this order, so they fill in the way a
   person writing them down would. */
function pairList(n) {
  const out = [];
  for (let i = 1; i < n; i += 1) for (let j = 0; j < i; j += 1) out.push([i, j]);
  return out;
}

/* The arrangement on screen right now. Read by `draw`, `readout` and `summary`,
   so no two of them can disagree about where a sample is (5.8). */
function shownAt(state, anim) {
  const from = state.path[anim.k];
  if (!anim.moving) return from;
  const to = state.path[anim.k + 1];
  const e = easeIO(anim.t);
  return from.map((p, i) => [lerp(p[0], to[i][0], e), lerp(p[1], to[i][1], e)]);
}

const REVEAL_MS = 2000;
const STEP_MS = 340;
const RUN_MS = 100;

defineWidget({
  slug: "mds",
  title: "Multidimensional scaling",
  subtitle: "Drag the figure to turn it. Then measure the distance between every pair and set the coordinates aside: the picture is the arrangement whose distances come closest to that table.",
  status: "draft",
  layout: "side",
  height: ({ w }) => layout(w).height,

  legend: [
    { token: "ink-1", label: "Measured between the samples", mark: "line" },
    { token: "empirical", label: "In the arrangement on the right", mark: "line" },
  ],

  params: {
    /* THE DETAIL BELONGS TO THE OPTION, NOT THE FIELD. A `choice` renders the
       SELECTED option's `detail` and ignores the field's own, so a line written
       once for the whole slider is copy nobody can read — which is what this
       one was until it was checked in the browser rather than in the source.

       Neither detail says what the fit will do with the count, only what the
       INPUT is: how the centres sit, and how many distances there are. */
    groups: {
      type: "choice",
      label: "Groups",
      options: [
        { value: "2", label: "2", detail: "two centres — they make a line" },
        { value: "3", label: "3", detail: "three centres — they make a plane" },
        { value: "4", label: "4", detail: "four centres, spread through space" },
      ],
      default: "2",
    },
    /* Per group, so the groups stay balanced whatever the count — the same
       reading widget 19 gives the same control. One is a real setting and not a
       degenerate one: every sample its own group is the ungrouped stage, and
       three of them is where the fit is exact. */
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [
        { value: "1", label: "1", detail: "no clusters — every sample on its own" },
        { value: "2", label: "2", detail: "a pair around each centre" },
        { value: "3", label: "3", detail: "three around each centre" },
        /* FOUR EXISTS FOR THE LESSON'S OWN DESIGN. `05-04` runs on `airway`,
           which is 4 controls and 4 dexamethasone-treated samples — two groups
           of four — and without this option the widget could not reproduce the
           figure it is meant to sit beside. */
        { value: "4", label: "4", detail: "four around each centre" },
      ],
      default: "3",
    },
    /* ONE SEED, AND EVERYTHING DOWNSTREAM OF IT MOVES — the samples first, then
       the layout the fit starts from. It used to move only the second, which
       made it the one control in twenty widgets where `seed` did not mean "new
       data" and left the table reading the same six numbers at every setting. */
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "moves every sample, and where the fit starts from",
    },

    /* LABELS OFF BY DEFAULT, so the reader reads the structure off the picture
       before being told what it is — the notebook plots every method twice for
       the same reason. `--c-unknown` is what the tokens file gives "not
       measured yet": absence of information, which is what a withheld label is,
       rather than a third category. */
    labels: {
      type: "segmented",
      label: "Labels",
      options: [
        { value: "off", label: "Off", detail: "can you see the groups without being told?" },
        { value: "on", label: "On", detail: "colour shows the group each sample really came from" },
      ],
      default: "off",
      display: true,
    },

    /* `display: true`, and it has to be. As a data gate this would be the one
       gate core animates, which is convenient — but shutting it would then
       throw away a fit the reader had stepped through, and the way back is a
       button labelled "Back to the coordinates" rather than "Start again".
       The display path asks for frames with `anim.easing` instead. */
    measured: {
      type: "gate",
      label: "Measure every pair",
      labelOff: "Back to the coordinates",
      detail: "write each distance into the table, then set the coordinates aside",
      display: true,
    },

    /* THE SECOND METHOD, and `03-5` is why it is here rather than in a widget of
       its own: it has ONE section — "Multidimensional Scaling: Classical and
       Non-metric" — with the two under it, run on the same distance matrix one
       after the other. One topic, one widget.

       `display: true` although it changes what `compute` returns, and that is
       the point rather than a fudge: the rank-order trajectory IS the metric one
       with more steps on the end, so a reader who has run the metric fit keeps
       their position when they switch and simply carries on. `rebuild` clamps
       the step index for the switch back, where the path gets shorter.

       Only after the gate: there is no method to choose before there is a table
       to fit. */
    method: {
      type: "segmented",
      label: "Fit",
      options: [
        /* IT NAMES STRESS MINIMISATION, and that closes a gap rather than
           decorating the control. `05-04`'s first line of MDS code is
           `cmdscale`, which is classical Torgerson scaling: an
           eigendecomposition, closed form, no iterations at all. This fit is
           SMACOF — what `sklearn.manifold.MDS(metric=True)` runs, and what the
           lesson's own PROSE describes ("adjusting the positions of points ...
           typically done using iterative algorithms") — so it does iterate, and
           a reader who mapped it onto `cmdscale` would leave thinking that
           function converges over steps. Saying "a step at a time" is what
           stops the mapping, and it is true of this fit. */
        { value: "metric", label: "Distances", detail: "match the distances themselves — by minimising the stress, a step at a time" },
        /* THE DETAIL NO LONGER NAMES `cmdscale`, and the reason is that it was
           an overclaim on the face of the figure (2.9). `isoMDS` really does
           start from `cmdscale` — that is its documented default, `y =
           cmdscale(d, k)` — but the fit ABOVE this control is SMACOF, not
           `cmdscale`, so "the way isoMDS starts from cmdscale" invited the
           reader to map the metric half onto a function it is not. The claim
           that survives is the one the widget can back: this fit carries on
           from where that one stopped. */
        { value: "rank", label: "Rank order", detail: "keep the ORDER of the distances and forget their sizes — it carries on from where the fit above stopped" },
      ],
      default: "metric",
      display: true,
      when: { param: "measured" },
    },

    /* Hidden, because the figure is their control — but parameters, so a shared
       link reproduces the angle the reader was looking from. */
    turn: { type: "int", label: "Turn", min: -180, max: 180, step: 3, default: TURN0, display: true, hidden: true },
    tilt: { type: "int", label: "Tilt", min: -80, max: 80, step: 3, default: TILT0, display: true, hidden: true },

    /* An authored head start, so a lesson can link to the finished arrangement.
       First render only — see core's note on why. */
    shown: { type: "int", min: 0, max: 200, default: 0, hidden: true },
  },

  compute({ params, rng }) {
    const groups = Number(params.groups);
    const per = Number(params.samples);
    const n = groups * per;
    /* The samples first, so the seed reaches them before it reaches the
       starting layout: one seed, and everything downstream of it moves. */
    const placed = stage(groups, per, rng);
    const pts = tilted(placed.map((s) => s.p));
    const gs = placed.map((s) => s.g);
    const D = targets(pts);
    const pairs = pairList(n);
    const delta = pairs.map(([i, j]) => D[i][j]);
    /* The pairs from closest to furthest. The non-metric fit gets this and
       nothing else, and it is what the table prints once it is chosen. */
    const order = pairs.map((_, k) => k).sort((a, b) => delta[a] - delta[b]);
    const rankD = rankOf(delta);

    const metricPath = smacof(D, rng, n);
    const rank = params.method === "rank";
    /* The rank-order run is the metric one with more steps on the end — the
       first entry of the continuation is the last of the metric path, so it is
       dropped rather than shown twice as a step that moves nothing. */
    const path = rank
      ? metricPath.concat(smacofRank(pairs, order, metricPath[metricPath.length - 1]).slice(1))
      : metricPath;
    const switchAt = rank ? metricPath.length - 1 : null;

    /* ONE SCALE FOR BOTH PANELS, or the two pictures cannot be compared at all —
       a distance that came out short would look long simply because its panel
       was drawn bigger. It covers the whole trajectory, including the starting
       layout, so nothing ever crosses a panel edge and the frame never moves
       under the reader (2.5). */
    let span = 0;
    for (const p of pts) span = Math.max(span, Math.hypot(p[0], p[1], p[2]));
    for (const X of path) for (const p of X) span = Math.max(span, Math.hypot(p[0], p[1]));

    /* The stress at every step, computed once here rather than per frame — the
       chart is a reveal of an already-computed curve, like every other
       animation in this repo (invariant 2). Same function the readout uses, so
       the number under the figure and the point on the curve cannot disagree. */
    /* The largest distance in the table, which the cell shading is measured
       against — so the darkest cell is always the furthest pair rather than a
       fixed value that would leave a tight cloud uniformly pale. */
    let far = 0;
    for (const v of delta) far = Math.max(far, v);

    /* The stress at every step, computed once here rather than per frame — the
       chart is a reveal of an already-computed curve, like every other animation
       in this repo (invariant 2). Each step is measured against WHAT IT WAS
       MINIMISING: the distances before the switch, their monotone fit after. So
       the curve drops at the switch, and it drops because the target got easier
       rather than because the picture improved — which is exactly why the
       picture beside it can be seen not moving. */
    const stress = path.map((X, k) =>
      stress1(X, pairs, delta, order, switchAt === null || k <= switchAt));

    return {
      n, groups, per, gs, pts, D, path, pairs, delta, order, rankD, switchAt, rank,
      span: span * 1.1, far, stress,
    };
  },

  /* Two numbers, one gesture. Core applies them together, so turning the cloud
     is one recompute and one address-bar write however far it is dragged. Turn
     wraps — a cloud has no far side — and tilt clamps at 80, past which the
     vertical axis collapses to a point. */
  drag: {
    params: ["turn", "tilt"],
    value: ({ dx, dy, start }) => {
      let turn = start.turn + Math.round((dx * 0.42) / 3) * 3;
      while (turn > 180) turn -= 360;
      while (turn < -180) turn += 360;
      const tilt = clamp(start.tilt - Math.round((dy * 0.42) / 3) * 3, -80, 80);
      return { turn, tilt };
    },
  },

  animation: {
    stepLabel: "Rearrange",
    stepTitle: "Move every sample once, toward the distances the table asks for",
    runLabel: "Play",
    runTitle: "Keep rearranging until nothing moves",

    init: ({ params, state, fromScratch }) => {
      const total = state.path.length - 1;
      const pre = fromScratch ? 0 : clamp(params.shown | 0, 0, total);
      return {
        /* 0 while the coordinates are still the figure, 1 once the table is. */
        reveal: params.measured ? 1 : 0,
        k: params.measured ? pre : 0,
        t: 1,
        moving: false,
        done: params.measured ? pre >= total : false,
      };
    },

    /* `anim.easing` is core's word for "this display change wants frames". It is
       consumed when granted, so it has to be asked for each time. */
    rebuild: (anim, { params, state }) => {
      /* SWITCHING METHOD KEEPS THE READER'S PLACE, which is what makes the
         segmented control read as "carry on" rather than "start again": the
         rank-order path is the metric one with more steps, so the same index is
         the same arrangement. Going back the other way the path gets shorter,
         and a step index left past its end would index off the array. */
      const total = state.path.length - 1;
      if (anim.k > total) { anim.k = total; anim.moving = false; anim.t = 1; }
      anim.done = anim.k >= total;
      if (!params.measured) { anim.reveal = 0; return; }
      /* A fit already on screen does not replay the measuring. The reader shut
         the gate to look at the coordinates again and opened it back up; the
         work they did is still there and does not want fading out from under
         them a second time. */
      if (anim.k > 0 || anim.reveal >= 1) { anim.reveal = 1; return; }
      anim.easing = true;
    },

    advance(anim, { dt, params, state }) {
      if (!params.measured) return false;
      if (anim.reveal < 1) {
        anim.reveal = clamp01(anim.reveal + dt / REVEAL_MS);
        return anim.reveal < 1;
      }

      const total = state.path.length - 1;
      const dur = anim.mode === "step" ? STEP_MS : RUN_MS;

      /* A step in flight finishes first, then the mode decides whether another
         one starts. `moving` is what separates "arrived at k" from "on the way
         to k + 1"; without it the last frame of one step and the first of the
         next are the same picture and every step gains a stutter. */
      if (anim.moving) {
        anim.t = clamp01(anim.t + dt / dur);
        if (anim.t < 1) return true;
        anim.moving = false;
        anim.k += 1;
        if (anim.k >= total) { anim.done = true; return false; }
        if (anim.mode === "step") return false;
      }
      if (anim.k >= total) { anim.done = true; return false; }
      anim.moving = true;
      anim.t = 0;
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const { n, gs, pts, D, pairs } = state;
    const at = shownAt(state, anim);
    /* IDENTITY IS THE GROUP'S COLOUR AND, WHILE THERE IS ROOM, THE SAMPLE'S
       LETTER. Past six the letters have nothing to label — the dots sit on top
       of each other inside a cluster — and the pair lines stop being a figure:
       fifteen of them read, sixty-six are a hairball. The table's headers keep
       the letters at every count, which is where they are needed to read a row. */
    const labelled = n <= LABEL_MAX;
    const told = params.labels === "on";
    const col = (i) => (told ? sampleCol(colors, gs[i]) : colors.unknown);

    /* The measuring, in four overlapping beats:
         0.00 - 0.45   a line grows between every pair
         0.25 - 0.80   the distances fill into the table, in reading order
         0.62 - 1.00   the gene axes go out and the samples hollow
         0.78 - 1.00   the starting layout arrives in the right-hand panel

       THE STARTING LAYOUT IS PART OF THE REVEAL, not of the first press. It
       comes from the seed and is nothing but random, and showing it is what
       makes Rearrange a button that IMPROVES something rather than one that
       conjures an answer — the stress tile reads high, and every press takes it
       down. Held back until the first step, the random layout instead flashed
       past in the 340ms of that step and the reader saw only the result.      */
    const rev = anim.reveal;
    const linked = easeIO(clamp01(rev / 0.45));
    const written = clamp01((rev - 0.25) / 0.55);
    const away = easeIO(clamp01((rev - 0.62) / 0.38));
    const arranged = easeIO(clamp01((rev - 0.78) / 0.22));

    /* ---- left: where the samples are ------------------------------------ */
    {
      const { x, y, w: pw, h: ph } = L.space;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 14) / state.span;
      const { ex, ey } = camera(params.turn, params.tilt);
      const P = (p) => [cx + dot(p, ex) * S, cy - dot(p, ey) * S];
      const eye = [
        ex[1] * ey[2] - ex[2] * ey[1],
        ex[2] * ey[0] - ex[0] * ey[2],
        ex[0] * ey[1] - ex[1] * ey[0],
      ];

      text(ctx, colors, "The samples, in three genes", x, y - 10, colors.ink2, colors.fsSm);

      /* The sphere and the axes go out together with the coordinates. Leaving
         them lit past the point the table becomes the input invites reading a
         sample off a gene, which is exactly what MDS no longer has access to. */
      if (away < 0.99) globe(ctx, colors, P, eye, R, 1 - away);
      if (away < 0.99) {
        ctx.save();
        ctx.globalAlpha = 1 - away;
        ctx.strokeStyle = colors.ink3;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i += 1) {
          const d = [0, 0, 0];
          d[i] = state.span * 0.95;
          const o = P([0, 0, 0]), e = P(d);
          ctx.beginPath();
          ctx.moveTo(o[0], o[1]);
          ctx.lineTo(e[0], e[1]);
          ctx.stroke();
          text(ctx, colors, GENES[i], e[0] + 4, e[1] - 4, colors.ink3, colors.fsXs);
        }
        ctx.restore();
      }

      /* Every pair, drawn as it is measured and left faint afterwards — the
         same marks the arrangement on the right carries, so the two pictures
         read as the same kind of object. */
      if (linked > 0.01 && (labelled || away < 0.99)) {
        ctx.save();
        ctx.strokeStyle = colors.ink3;
        ctx.lineWidth = 1;
        /* Above six samples they are the MEASURING and nothing more: they draw
           with the reveal and leave with the coordinates, rather than staying
           as sixty-six lines over four clusters. */
        ctx.globalAlpha = 0.5 * linked * (labelled ? 1 - 0.45 * away : 1 - away);
        for (const [i, j] of pairs) {
          const a = P(pts[i]), b = P(pts[j]);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(a[0] + (b[0] - a[0]) * linked, a[1] + (b[1] - a[1]) * linked);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* Back to front, so near samples occlude far ones — and SIZED BY DEPTH on
         top of that, because occlusion alone only separates the samples that
         happen to overlap. A near sample is drawn a fifth larger and at full
         ink, a far one a fifth smaller and lighter, which is what tells a
         reader that a dot sitting between two others is in front of them
         rather than between them. */
      const order = pts.map((p, i) => ({ i, p, d: dot(p, eye) })).sort((a, b) => a.d - b.d);
      for (const q of order) {
        const [px, py] = P(q.p);
        const near = clamp(q.d / R, -1, 1);
        sampleDot(ctx, colors, px, py, col(q.i), away,
          R_DOT * (1 + 0.2 * near), 0.72 + 0.28 * ((near + 1) / 2));
        if (!labelled) continue;
        ctx.save();
        ctx.globalAlpha = 1 - 0.55 * away;
        text(ctx, colors, LETTERS[q.i], px + 7, py - 7, col(q.i), colors.fsXs);
        ctx.restore();
      }
    }

    /* ---- middle: the table ---------------------------------------------- */
    if (rev > 0.02) {
      const { x, y, w: pw, h: ph } = L.table;
      /* THE CELLS ARE NOT SQUARE, and that is what keeps the numbers readable.
         The box is wider than it is tall and the text in it runs across, so a
         square cell takes its size from the height it does not need: measured
         at a 550px canvas that put six samples on a 7px font, against 9px here
         and 13px at the width a reader actually has. Width sets the type size;
         height only has to hold two lines of it. */
      const cw = Math.min(78, pw / n);
      const ch = Math.min(58, ph / n);
      const gx = x + (pw - cw * n) / 2;
      const gy = y + (ph - ch * n) / 2;
      const fs = Math.round(Math.min(cw * 0.34, ch * 0.42));
      /* THE NUMBERS GO WHEN THEY STOP BEING READABLE, and the shading is what
         makes that survivable rather than a loss. Four groups of three is a
         twelve by twelve table: the cells reach 7px, which is not a number
         anybody reads. What the reader wants from a table that size is the
         BLOCK PATTERN — near within a cluster, far between them — and that is a
         picture, not a set of figures. It is drawn at every count, so at six
         samples it sits under the numbers rather than replacing them. */
      const numbered = fs >= 8;
      const type = `${clamp(fs, 7, 13)}px`;

      /* UNDER THE RANK-ORDER FIT THE TABLE PRINTS RANKS, because that is the
         whole of what the method is given: 1 for the closest pair, up to 15 or
         28 or 66 for the furthest. It is the one place the difference between
         the two methods is visible at all, which is why the caption changes
         with it — and a rank is a shorter string than a distance, so it fits
         wherever a distance did.

         THE RANKS DISAGREE EXACTLY WHERE THE FIT IS BAD, which is content and
         not noise. Measured over 40 seeds, the share of pairs holding their
         exact rank runs 87-100% at two groups, 44-100% at three and 6-33% at
         four — the same "two centres make a line, three make a plane, four make
         a tetrahedron" the widget already turns on, arriving per cell. */
      const ranked = Boolean(state.rank);
      const fitRank = ranked ? rankOf(pairs.map(([i, j]) => dist2(at[i], at[j]))) : null;
      text(ctx, colors, ranked ? "Rank of every pair's distance" : "Distance between every pair",
        x, y - 10, colors.ink2, colors.fsSm);

      ctx.save();
      ctx.globalAlpha = clamp01(rev / 0.3);

      /* Headers: the column a distance is measured from, the row it runs to —
         in the sample's own letter and its GROUP's colour, which is what makes
         the block pattern below readable as groups rather than as texture. */
      for (let c = 0; c < n - 1; c += 1) {
        text(ctx, colors, LETTERS[c], gx + cw * (c + 1.5), gy + ch * 0.5,
          col(c), type, "center");
      }
      for (let r = 1; r < n; r += 1) {
        text(ctx, colors, LETTERS[r], gx + cw * 0.5, gy + ch * (r + 0.5),
          col(r), type, "center");
      }

      /* Lower triangle only. A distance table is symmetric with a zero
         diagonal, so the full square would print every number twice and halve
         the size each one can be drawn at. */
      pairs.forEach(([i, j], k) => {
        const show = clamp01(written * pairs.length - k);
        if (show < 0.02) return;
        const tx = gx + cw * (j + 1.5);
        const ty = gy + ch * (i + 0.5);
        ctx.save();
        ctx.globalAlpha = show;
        /* Darker is further, so the shading and the number it sits under say
           the same thing rather than opposite ones. Capped well short of
           opaque: the number has to stay readable on top of it. */
        ctx.fillStyle = colors.empirical;
        /* SHADED BY WHAT THE CELL SAYS. Under the rank fit that is the rank,
           and the flattening is honest rather than incidental: a distance ramp
           separates "far" from "very far", and a rank ramp is evenly spaced
           because the method has stopped being able to tell them apart. */
        const shadeBy = ranked
          ? state.rankD[k] / pairs.length
          : clamp01(D[i][j] / state.far);
        ctx.globalAlpha = show * (0.04 + 0.30 * shadeBy);
        ctx.fillRect(gx + cw * (j + 1), gy + ch * i, cw, ch);
        ctx.globalAlpha = show;
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(gx + cw * (j + 1) + 0.5, gy + ch * i + 0.5, cw - 1, ch - 1);
        if (!numbered) { ctx.restore(); return; }
        text(ctx, colors, ranked ? String(state.rankD[k]) : D[i][j].toFixed(2),
          tx, arranged > 0.02 ? ty - fs * 0.6 : ty, colors.ink1, type, "center");
        /* THE SECOND NUMBER IS THE ARGUMENT. Adjacency (2.7): what the samples
           have, and directly under it what the picture managed — in every cell,
           so no sentence has to say which ones came out wrong. Under the rank
           fit both are ranks, so a cell agrees when its two numbers are EQUAL
           rather than merely close, which is a sharper thing to look for. */
        if (arranged > 0.02) {
          ctx.globalAlpha = show * arranged;
          text(ctx, colors, ranked ? String(fitRank[k]) : dist2(at[i], at[j]).toFixed(2),
            tx, ty + fs * 0.6, colors.empirical, type, "center");
        }
        ctx.restore();
      });
      ctx.restore();
    }

    /* ---- right: the arrangement ----------------------------------------- */
    if (arranged > 0.02) {
      const { x, y, w: pw, h: ph } = L.flat;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 14) / state.span;
      const P = (p) => [cx + p[0] * S, cy - p[1] * S];

      ctx.save();
      ctx.globalAlpha = arranged;

      text(ctx, colors, "The arrangement, in 2-D", x, y - 10, colors.ink2, colors.fsSm);

      ctx.save();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      ctx.strokeStyle = colors.ink3;
      ctx.globalAlpha = 0.5;
      if (labelled) {
        for (const [i, j] of pairs) {
          const a = P(at[i]), b = P(at[j]);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
      ctx.restore();

      for (let i = 0; i < n; i += 1) {
        const [px, py] = P(at[i]);
        sampleDot(ctx, colors, px, py, col(i));
        if (labelled) text(ctx, colors, LETTERS[i], px + 7, py - 7, col(i), colors.fsXs);
      }

      /* NO AXES AND NO AXIS LABELS, deliberately. An MDS arrangement is fixed
         only up to a turn and a mirror, so an x and a y here would name two
         quantities that do not exist. Only the distances between the samples
         carry anything, and the line says so where the labels would have been. */
      /* Centred rather than left-aligned at the panel: at the narrowest canvas
         this line is wider than the panel it belongs to, and centred it spills
         into the gap on one side and the padding on the other instead of 1.5px
         off the edge of the canvas. */
      text(ctx, colors, "only the distances mean anything", x + pw / 2, y + ph + 13,
        colors.ink3, colors.fsXs, "center");
      ctx.restore();
    }

    /* ---- bottom left: the stress, step by step -------------------------- *
     * WHAT IS BEING MINIMISED, drawn as it falls. The curve is only ever drawn
     * as far as the reader has stepped (2.1) — the whole thing up front would
     * hand them the answer before they pressed anything — but the FRAME is the
     * finished run's: the y axis is the starting layout's stress and the x axis
     * is however many steps there turn out to be, both fixed from the first
     * frame, so the curve falls through a window that does not move under it
     * (2.5). A per-frame axis would keep the curve looking the same shape while
     * the numbers changed underneath, which is the opposite reading.          */
    if (arranged > 0.02) {
      const { x, y, w: pw, h: ph } = L.chart;
      const total = state.path.length - 1;
      /* THE CEILING IS THE WHOLE TRAJECTORY'S MAXIMUM, not its first value, and
         that is not defensive coding: stress-1 divides by the size of the
         arrangement, and the first Guttman step out of a random layout can
         shrink it faster than it improves the fit. Measured over 5699 metric
         steps, 8 rise — every one of them at step 1, the worst by 0.108. Anchored
         on `stress[0]` those runs would draw their second point above the top of
         the frame. */
      const top = Math.max(...state.stress, 1e-9);
      /* Inset, because in a full quadrant the curve wants a plot area rather
         than the whole cell: the labels live in the margin the inset leaves. */
      const PL = 40, PB = 18, PT = 8, PR = 8;
      const ax = x + PL, ay = y + PT;
      const aw = Math.max(10, pw - PL - PR), ah = Math.max(10, ph - PT - PB);
      const px = (k) => ax + (total > 0 ? (k / total) * aw : 0);
      const py = (s) => ay + ah - clamp01(s / top) * ah;

      ctx.save();
      ctx.globalAlpha = arranged;
      text(ctx, colors, "Stress at every step", x, y - 10, colors.ink2, colors.fsSm);

      /* Four gridlines and a frame, which is what turns a bare baseline into a
         chart once it has a quadrant to fill. The reader is being asked to read
         a SHAPE — steep then flat — and a shape needs something to be read
         against. */
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g += 1) {
        const gyy = Math.round(ay + (ah * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, gyy);
        ctx.lineTo(ax + aw, gyy);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(ax + 0.5, ay);
      ctx.lineTo(ax + 0.5, ay + ah + 0.5);
      ctx.lineTo(ax + aw, ay + ah + 0.5);
      ctx.stroke();
      text(ctx, colors, "0", ax - 5, ay + ah, colors.ink3, colors.fsXs, "right");
      text(ctx, colors, top.toFixed(1), ax - 5, ay + 1, colors.ink3, colors.fsXs, "right", "top");
      text(ctx, colors, `${total} steps`, ax + aw, ay + ah + 5,
        colors.ink3, colors.fsXs, "right", "top");

      /* WHERE THE TARGET CHANGED, drawn only once the reader has stepped past
         it. Before that it would be announcing a stage they have not reached. */
      const sw = state.switchAt;
      if (sw !== null && anim.k > sw) {
        ctx.save();
        ctx.strokeStyle = colors.ink3;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px(sw), ay);
        ctx.lineTo(px(sw), ay + ah);
        ctx.stroke();
        ctx.restore();
        text(ctx, colors, "rank order from here", px(sw) + 4, ay + 2,
          colors.ink3, colors.fsXs, "left", "top");
      }

      /* Through the completed steps, then out to wherever the one in flight has
         got to — so the line lengthens continuously rather than in jumps. */
      const live = stress1(at, pairs, state.delta, state.order,
        sw === null || anim.k < sw);
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(px(0), py(state.stress[0]));
      for (let k = 1; k <= anim.k; k += 1) ctx.lineTo(px(k), py(state.stress[k]));
      const headX = px(anim.k + (anim.moving ? easeIO(anim.t) : 0));
      const headY = py(live);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fillStyle = colors.highlight;
      ctx.fill();
      ctx.restore();
    }
  },

  readout({ params, state, anim }) {
    const { n, D, path, pairs } = state;
    if (!params.measured) {
      return [{
        label: "Samples",
        value: String(n),
        /* The tile is a number and what it counts. How to turn the figure is an
           instruction, and instructions live in the subtitle (2.9). */
        note: state.per === 1
          ? "three genes each, no clusters"
          : `${state.groups} groups of ${state.per}, three genes each`,
      }];
    }
    const at = shownAt(state, anim);
    const metricNow = state.switchAt === null || anim.k < state.switchAt;
    const stress = [
      {
        label: "Stress",
        value: stress1(at, pairs, state.delta, state.order, metricNow).toFixed(3),
        /* 2.8: the number reports what is on screen, so a reader watching it
           fall is watching the arrangement they can see. At zero steps that is
           the starting layout, which is the baseline every press is against. */
        note: anim.k === 0 && !anim.moving
          ? "the starting layout, before any step"
          : `after ${anim.k} of ${path.length - 1} steps`,
      },
    ];

    /* THE SECOND TILE FOLLOWS WHAT IS BEING FITTED. Under the rank order,
       "largest gap" would be a gap in a quantity the method is not matching —
       so it becomes the count of pairs whose rank came out exactly right, which
       is what the table beside it is showing. */
    if (state.rank && !metricNow) {
      const fitRank = rankOf(pairs.map(([i, j]) => dist2(at[i], at[j])));
      let same = 0;
      for (let k = 0; k < pairs.length; k += 1) if (fitRank[k] === state.rankD[k]) same += 1;
      stress.push({
        label: "Ranks held",
        value: `${same}/${pairs.length}`,
        note: same === pairs.length
          ? "every pair is in the order it was measured in"
          : "pairs whose place in the order came out exactly right",
      });
      return stress;
    }

    let worst = pairs[0], gap = 0;
    for (const [i, j] of pairs) {
      const g = Math.abs(dist2(at[i], at[j]) - D[i][j]);
      if (g > gap) { gap = g; worst = [i, j]; }
    }
    /* Alphabetical, because `pairs` runs down the table's rows and so holds the
       LATER letter first: the tile read "B–A is 3.94" of a pair every other
       part of the widget calls A–B. */
    const [wi, wj] = [Math.min(...worst), Math.max(...worst)];
    stress.push({
      label: "Largest gap",
      value: gap.toFixed(2),
      note: gap < 0.005
        ? "every distance came out exact"
        : `${LETTERS[wi]}–${LETTERS[wj]} is ${dist2(at[wi], at[wj]).toFixed(2)}, not ${D[wi][wj].toFixed(2)}`,
    });
    return stress;
  },

  /* Core hands this to `aria-label`, so it describes what is on screen. */
  summary({ params, state, anim }) {
    const { n, path, groups, per, pairs } = state;
    const view = `Turned ${params.turn} degrees, tilted ${params.tilt}.`;
    const stock = per === 1
      ? `${n} samples spread over a sphere in three genes`
      : `${n} samples in ${groups} groups of ${per}, their centres spread over a sphere in `
        + `three genes`;
    if (!params.measured) {
      return `${stock}, drawn with the sphere the centres sit on so their depth can be seen. `
        + `${view} No distances measured yet.`;
    }
    const stage = anim.k === 0 && !anim.moving
      ? "in their starting layout, which is random"
      : `after ${anim.k} of ${path.length - 1} steps`;
    const metricNow = state.switchAt === null || anim.k < state.switchAt;
    const held = metricNow
      ? "matching the distances themselves"
      : "matching only the ORDER of the distances, which is what non-metric scaling is given";
    const s = stress1(shownAt(state, anim), pairs, state.delta, state.order, metricNow);
    return `The ${pairs.length} distances between the ${n} samples, written into a table; `
      + `the coordinates are faded out, because from here the table is the whole input. ${view} `
      + `Beside it the same ${n} samples arranged in two dimensions, ${stage}, ${held}. `
      + `Stress ${s.toFixed(3)}, where 0 would mean nothing was lost.`;
  },
});
