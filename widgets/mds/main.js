/* ============================================================================
   Multidimensional scaling.

   Host: PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 20-30.
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

/* The samples sit on a sphere of this radius, as far from each other as they
   can get. R = 2 makes the regular tetrahedron's edge 3.27, which is the number
   every closed-form check in the catalogue is written against. */
const R = 2;
const LETTERS = "ABCDEF";
const GENES = ["Gene 1", "Gene 2", "Gene 3"];

/* --- 3-vector arithmetic -------------------------------------------------- */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);

/* --- the stage ------------------------------------------------------------ *
 * n samples on a sphere, spread as far apart as they can get — which for these
 * counts are the shapes anyone would draw: a triangle, a regular tetrahedron, a
 * triangular bipyramid, an octahedron — and then MOVED BY THE SEED.
 *
 * IT STOPS AT SIX, and both reasons are the same reason. `--c-cluster-a…f` is
 * six colours and a sample needs its own identity in three panels at once; and
 * the table is n by n, so a seventh row takes the cells below the size two
 * numbers fit in at the narrowest canvas.
 *
 * THREE FITS EXACTLY AND FOUR NEVER DOES, which is principle 2.6's failing case
 * on one slider and needs no extra machinery: any three points make a triangle
 * and a triangle is flat, while four spread out in space cannot be laid on
 * paper at all.                                                              */
function spread(n) {
  const eq = (k, m) => {
    const a = (2 * Math.PI * k) / m;
    return [R * Math.cos(a), R * Math.sin(a), 0];
  };
  if (n === 3) return [0, 1, 2].map((k) => eq(k, 3));
  if (n === 4) {
    const c = R / Math.sqrt(3);
    return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => scale(v, c));
  }
  if (n === 5) return [...[0, 1, 2].map((k) => eq(k, 3)), [0, 0, R], [0, 0, -R]];
  return [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]];
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
function stage(n, rng) {
  return spread(n).map((p) => {
    const v = [0, 1, 2].map((k) => p[k] + gauss(rng) * JITTER * R);
    const m = Math.hypot(v[0], v[1], v[2]) || 1;
    return v.map((x) => (x / m) * R);
  });
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

/* Raw stress, which is what sklearn's `stress_` reports and what `03-5` prints:
   the sum over pairs of (what the picture shows - what the table asks for)^2. */
function rawStress(X, D) {
  let s = 0;
  for (let i = 0; i < X.length; i += 1)
    for (let j = i + 1; j < X.length; j += 1) s += (dist2(X[i], X[j]) - D[i][j]) ** 2;
  return s;
}

/* One SMACOF step — the Guttman transform. Every sample moves to the average of
   where each other sample would put it if that one distance were right, so the
   move is a compromise between n - 1 demands and the stress cannot rise. */
function guttman(X, D) {
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
      const b = d > 1e-12 ? -D[i][j] / d : 0;
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
  for (let it = 0; it < MAX_STEPS; it += 1) {
    const Y = guttman(X, D);
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
const PAD_L = 14, PAD_R = 14, GAP = 18, TOP = 26, BOT = 30;
const TABLE_RATIO = 1.3;
const SIDE_MAX = 300;
const CHART_GAP = 34;

function layout(w) {
  const inner = w - PAD_L - PAD_R - GAP * 2;
  const side = Math.min(SIDE_MAX, Math.max(40, inner / (2 + TABLE_RATIO)));
  const table = side * TABLE_RATIO;
  const used = side * 2 + table + GAP * 2;
  const x0 = Math.max(PAD_L, (w - used) / 2);
  const chartH = clamp(side * 0.34, 40, 78);
  const flatX = x0 + side + table + GAP * 2;
  return {
    side,
    space: { x: x0, y: TOP, w: side, h: side },
    table: { x: x0 + side + GAP, y: TOP, w: table, h: side },
    flat: { x: flatX, y: TOP, w: side, h: side },
    /* UNDER THE ARRANGEMENT AND NOWHERE ELSE. The stress is a reading of that
       panel, so 2.7 puts it directly beneath it; run full width it would sit
       under the cloud as well and claim a relationship it has not got. The
       empty band that leaves under the other two panels is the cost, and it is
       40-78px of it. */
    chart: { x: flatX, y: TOP + side + CHART_GAP, w: side, h: chartH },
    height: TOP + side + CHART_GAP + chartH + BOT,
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
       Per option it is also the better line: what changes with the count is
       how many distances there are and how many different lengths, and both
       are facts about the INPUT, so neither gives away what the fit will do. */
    points: {
      type: "choice",
      label: "Samples",
      options: [
        { value: "3", label: "3", detail: "3 distances to match" },
        { value: "4", label: "4", detail: "6 distances to match" },
        { value: "5", label: "5", detail: "10 distances to match" },
        { value: "6", label: "6", detail: "15 distances to match" },
      ],
      default: "4",
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

    /* Hidden, because the figure is their control — but parameters, so a shared
       link reproduces the angle the reader was looking from. */
    turn: { type: "int", label: "Turn", min: -180, max: 180, step: 3, default: TURN0, display: true, hidden: true },
    tilt: { type: "int", label: "Tilt", min: -80, max: 80, step: 3, default: TILT0, display: true, hidden: true },

    /* An authored head start, so a lesson can link to the finished arrangement.
       First render only — see core's note on why. */
    shown: { type: "int", min: 0, max: 200, default: 0, hidden: true },
  },

  compute({ params, rng }) {
    const n = Number(params.points);
    /* The samples first, so the seed reaches them before it reaches the
       starting layout: one seed, and everything downstream of it moves. */
    const pts = tilted(stage(n, rng));
    const D = targets(pts);
    const path = smacof(D, rng, n);

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
    return {
      n, pts, D, path, pairs: pairList(n), span: span * 1.1,
      stress: path.map((X) => rawStress(X, D)),
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
    rebuild: (anim, { params }) => {
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
    const { n, pts, D, pairs } = state;
    const at = shownAt(state, anim);

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
      if (linked > 0.01) {
        ctx.save();
        ctx.strokeStyle = colors.ink3;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5 * linked * (1 - 0.45 * away);
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
        sampleDot(ctx, colors, px, py, sampleCol(colors, q.i), away,
          R_DOT * (1 + 0.2 * near), 0.72 + 0.28 * ((near + 1) / 2));
        ctx.save();
        ctx.globalAlpha = 1 - 0.55 * away;
        text(ctx, colors, LETTERS[q.i], px + 7, py - 7, sampleCol(colors, q.i), colors.fsXs);
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
      const fs = clamp(Math.round(Math.min(cw * 0.3, ch * 0.42)), 7, 13);

      text(ctx, colors, "Distance between every pair", x, y - 10, colors.ink2, colors.fsSm);

      ctx.save();
      ctx.globalAlpha = clamp01(rev / 0.3);

      // Headers: the column a distance is measured from, the row it runs to.
      for (let c = 0; c < n - 1; c += 1) {
        text(ctx, colors, LETTERS[c], gx + cw * (c + 1.5), gy + ch * 0.5,
          sampleCol(colors, c), `${fs}px`, "center");
      }
      for (let r = 1; r < n; r += 1) {
        text(ctx, colors, LETTERS[r], gx + cw * 0.5, gy + ch * (r + 0.5),
          sampleCol(colors, r), `${fs}px`, "center");
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
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(gx + cw * (j + 1) + 0.5, gy + ch * i + 0.5, cw - 1, ch - 1);
        text(ctx, colors, D[i][j].toFixed(2), tx, arranged > 0.02 ? ty - fs * 0.6 : ty,
          colors.ink1, `${fs}px`, "center");
        /* THE SECOND NUMBER IS THE ARGUMENT. Adjacency (2.7): the distance the
           samples have, and directly under it the distance the picture managed
           — in every cell, so no sentence has to say which ones came out
           wrong, and every press of Rearrange moves fifteen numbers at once. */
        if (arranged > 0.02) {
          ctx.globalAlpha = show * arranged;
          text(ctx, colors, dist2(at[i], at[j]).toFixed(2), tx, ty + fs * 0.6,
            colors.empirical, `${fs}px`, "center");
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
      for (const [i, j] of pairs) {
        const a = P(at[i]), b = P(at[j]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.restore();

      for (let i = 0; i < n; i += 1) {
        const [px, py] = P(at[i]);
        sampleDot(ctx, colors, px, py, sampleCol(colors, i));
        text(ctx, colors, LETTERS[i], px + 7, py - 7, sampleCol(colors, i), colors.fsXs);
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

    /* ---- under it: the stress, step by step ----------------------------- *
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
      const top = Math.max(state.stress[0], 1e-9);
      const px = (k) => x + (total > 0 ? (k / total) * pw : 0);
      const py = (s) => y + ph - clamp01(s / top) * (ph - 2);

      ctx.save();
      ctx.globalAlpha = arranged;
      text(ctx, colors, "Stress at every step", x, y - 10, colors.ink2, colors.fsSm);

      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + ph + 0.5);
      ctx.lineTo(x + pw, y + ph + 0.5);
      ctx.stroke();
      text(ctx, colors, "0", x - 4, y + ph, colors.ink3, colors.fsXs, "right");
      text(ctx, colors, top.toFixed(1), x - 4, y + 1, colors.ink3, colors.fsXs, "right", "top");

      /* Through the completed steps, then out to wherever the one in flight has
         got to — so the line lengthens continuously rather than in jumps. */
      const live = rawStress(at, D);
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
        note: "three genes each",
      }];
    }
    const at = shownAt(state, anim);
    let worst = pairs[0], gap = 0;
    for (const [i, j] of pairs) {
      const g = Math.abs(dist2(at[i], at[j]) - D[i][j]);
      if (g > gap) { gap = g; worst = [i, j]; }
    }
    /* Alphabetical, because `pairs` runs down the table's rows and so holds the
       LATER letter first: the tile read "B–A is 3.94" of a pair every other
       part of the widget calls A–B. */
    const [wi, wj] = [Math.min(...worst), Math.max(...worst)];
    return [
      {
        label: "Stress",
        value: rawStress(at, D).toFixed(3),
        /* 2.8: the number reports what is on screen, so a reader watching it
           fall is watching the arrangement they can see. At zero steps that is
           the starting layout, which is the baseline every press is against. */
        note: anim.k === 0 && !anim.moving
          ? "the starting layout, before any step"
          : `after ${anim.k} of ${path.length - 1} steps`,
      },
      {
        label: "Largest gap",
        value: gap.toFixed(2),
        note: gap < 0.005
          ? "every distance came out exact"
          : `${LETTERS[wi]}–${LETTERS[wj]} is ${dist2(at[wi], at[wj]).toFixed(2)}, not ${D[wi][wj].toFixed(2)}`,
      },
    ];
  },

  /* Core hands this to `aria-label`, so it describes what is on screen. */
  summary({ params, state, anim }) {
    const { n, D, path } = state;
    const view = `Turned ${params.turn} degrees, tilted ${params.tilt}.`;
    if (!params.measured) {
      return `${n} samples spread over a sphere in three genes, drawn with the sphere they `
        + `sit on so their depth can be seen. ${view} No distances measured yet.`;
    }
    const stage = anim.k === 0 && !anim.moving
      ? "in their starting layout, which is random"
      : `after ${anim.k} of ${path.length - 1} steps`;
    return `The ${(n * (n - 1)) / 2} distances between the ${n} samples, written into a table; `
      + `the coordinates are faded out, because from here the table is the whole input. ${view} `
      + `Beside it the same ${n} samples arranged in two dimensions, ${stage}. Stress `
      + `${rawStress(shownAt(state, anim), D).toFixed(3)}, where 0 would mean every distance `
      + `came out exactly right.`;
  },
});
