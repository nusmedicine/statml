/* ============================================================================
   UMAP — uniform manifold approximation and projection. Widget 22, DRAFT.

   TWO HOSTS, ONE IN EACH COURSE, as widgets 20 and 21 have:
     PHM5003 `05 / 04 - Dimensionality Reduction.ipynb`, heading `## 5`,
       cells 46-53 — R, the `umap` CRAN package, `n_neighbors = 3` and
       `min_dist = 0.5` on 8 samples. Cell 47 links Google PAIR's
       "Understanding UMAP".
     PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, heading `### UMAP`,
       cells 41-50 — Python, `umap-learn`, `n_neighbors = 15` and
       `min_dist = 0.1`. Its cell 41 is the source of this widget's shape.

   THE LAYOUT IS KENNETH'S DIAGRAM — `unsupervised-umap.png`, embedded in
   PHM5005 cell 41. Four quadrants: 3D space and 2D space on top, three points
   wearing concentric halos, tight in 3-D and wide and overlapping in 2-D; and
   underneath, "Graph of neighborhood probabilities" twice, the same points with
   WEIGHTED edges re-drawn flat. He settled how those become panels: THE
   DIAGRAM IS THE TOP ROW AND THE GRAPH IS DRAWN ON THE POINTS — its bottom row
   isolates the edges the way its top row isolates the halos, which is exactly
   what widget 21 did with t-SNE's halos. The bottom row here is the two
   cross-entropy panels.

   THE ANALOGY IS THE NOTEBOOK'S OWN, and it is why the globe is drawn: cell 41
   says the data lies on a manifold, "analogous to mapping points on a globe to
   a flat map while trying to keep nearby points close together and faraway
   points far apart without too much distortion". Kenneth put it as CONNECT THEM
   IN A GRAPH, THEN FLATTEN THE MANIFOLD — LIKE FLATTENING A MAP. The two gates
   are those two clauses, and they are cell 41's own numbered steps.

   AND THE ANALOGY IS THE FAILING CASE. Flattening a globe is why Greenland
   draws the size of Africa; measured on this stage, a cluster genuinely 4.6x
   wider than its neighbour draws 1.02x +- 0.07. The readout says so.

   THE ONE SENTENCE: `min_dist` decides how tight the picture LOOKS, not what
   UMAP KNOWS. Swept end to end over ten seeds it moves 5-NN retention by
   +0.013 — inside the seed noise on nine of ten — while moving the clusters
   x3.62 looser on TEN of ten. `n_neighbors` over its range moves retention by
   +0.271, up on ten of ten and far outside that noise: twenty-one times the
   effect on the same measure. The two controls sit next to each other so a
   reader can find out which is which.

   The solver is `./model.js`, a separate module so `_lab/umap-verify.mjs` can
   import it in node — WHAT IS VERIFIED IS WHAT SHIPS. Against umap-learn
   0.5.12: rho bit-exact at float32 on 200 of 200 values, sigma on 199, mu to
   2.4e-5, a and b to 4.7e-6.

   Design record, and every constant here, in docs/catalogue.md § NEXT · UMAP.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { fuzzySet, findAbParams, umap, pcaPlane, stage, R } from "./model.js";

/* 300 iterations, revealed 20 at a time — FIFTEEN STEPS. The count follows from
   how far the picture actually moves, measured on the sphere stage over ten
   seeds as the mean distance a sample travels in a step, against the radius of
   the arrangement:

     step    moves, as % of the picture's radius
        1                                 41.52%
        2                                 12.01%
        3                                  6.86%
        5                                  3.38%
       10                                  1.03%
       15                                  0.08%
     steps moving under 1%                5 of 15

   At ten iterations a step it is thirty presses and sixteen of them move the
   picture by under one per cent of its own size. KENNETH REPORTED THAT DEFECT
   ON WIDGET 17 — twenty boosting rounds with nothing visible after six — so it
   is not hypothetical.

   The tail is not dead, it is TIGHTENING: retention flattens early while the
   clusters keep contracting, 0.104 down to 0.036 on the spread-over-gap
   measure. Real motion, just not rearrangement.

   A step still cannot be ONE iteration. */
const ITERS = 300;
const PER_STEP = 20;

/* THE LEARNING RATE IS 0.1, AND WHAT DECIDES IT IS WHAT THE CHART CAN DRAW.
   A full-batch gradient does not need the large steps a stochastic one does, so
   a small eta is the appropriate setting; the question is how small. Ten seeds,
   300 iterations:

     eta      iterations that rise     rises ON THE CHART     final CE
     1.0                   ~130/300                  many        143.0
     0.25                   ~103/300                  some       145.4
     0.1                      17/300                 0 of 15      148.5
     0.05                      0/300                 0 of 15      152.2

   THE CHART PLOTS EVERY TWENTIETH ITERATION, and at eta 0.1 not one of its
   fifteen points rises — the seventeen upticks all fall between plotted points
   and are invisible. So 0.05 buys nothing a reader can see and costs 2.5% of
   the objective and a visibly looser picture (0.071 against 0.060). Widget 20's
   raw stress and widget 21's KL both rose visibly and had to be explained away;
   this one does not, and the reason is measured rather than asserted. */
const ETA = 0.1;

/* --- 3-vector arithmetic, as widgets 19, 20 and 21 have ---------------------- */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit3 = (a) => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return scale3(a, 1 / m); };
const easeCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

/* Shorter arc between two unit vectors, as widget 19 has. Interpolating the
   components and renormalising instead cuts through the inside of the sphere on
   a wide turn, which reads as the cloud shrinking rather than turning. */
function slerp(a, b, t) {
  const d = clamp(dot(a, b), -1, 1);
  const th = Math.acos(d);
  if (th < 1e-6) return b.slice();
  const s = Math.sin(th);
  const c1 = Math.sin((1 - t) * th) / s, c2 = Math.sin(t * th) / s;
  return [0, 1, 2].map((k) => a[k] * c1 + b[k] * c2);
}

/* How much of each sample's neighbourhood survived into the picture: of its
   three nearest in three dimensions, how many are still among its three
   nearest in two. THE ONE NUMBER THE WIDGET'S SENTENCE TURNS ON — it is what
   min_dist leaves alone while changing everything about how the picture looks. */
function neighboursKept(pts, Y, k = 3) {
  const n = pts.length;
  if (n <= k) return 1;
  const near = (D, i) => D[i].map((v, j) => [v, j]).filter(([, j]) => j !== i)
    .sort((a, b) => a[0] - b[0]).slice(0, k).map(([, j]) => j);
  const Dh = pts.map((a) => pts.map((b) => dist3(a, b)));
  const Dl = Y.map((a) => Y.map((b) => dist2(a, b)));
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const A = new Set(near(Dh, i));
    s += near(Dl, i).filter((j) => A.has(j)).length / k;
  }
  return s / n;
}

/* How tight the clusters LOOK, against how much they mean: mean within-group
   radius over mean centre-to-centre gap. The other half of the sentence, and
   the half min_dist DOES move — x3.62 across its range on ten seeds. */
function tightness(Y, gs, groups) {
  if (groups < 2) return 0;
  const cs = [];
  for (let g = 0; g < groups; g += 1) {
    const m = Y.filter((_, i) => gs[i] === g);
    if (!m.length) return 0;
    cs.push([m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length]);
  }
  let within = 0;
  for (let g = 0; g < groups; g += 1) {
    const m = Y.filter((_, i) => gs[i] === g);
    within += m.reduce((s, p) => s + dist2(p, cs[g]), 0) / m.length;
  }
  within /= groups;
  let gaps = 0, np = 0;
  for (let i = 0; i < groups; i += 1)
    for (let j = i + 1; j < groups; j += 1) { gaps += dist2(cs[i], cs[j]); np += 1; }
  return np && gaps ? within / (gaps / np) : 0;
}

/* --- layout ---------------------------------------------------------------- *
 *
 * KENNETH'S DIAGRAM, with its bottom row folded onto its top one:
 *
 *      3D space   --->   2D space          points, halos AND the weighted graph
 *      CE vs distance    CE falling        the mechanism, then the descent
 *
 * The bottom row's order matches widget 21's — the panel that explains the
 * MECHANISM on the left, the objective descending on the right — so a reader
 * coming from t-SNE finds the descent chart where they left it.
 *
 * ONE PANEL WHILE THE `flatten` GATE IS SHUT. There is no 2-D arrangement yet,
 * and neither cross-entropy panel means anything without one; drawing three
 * empty frames beside the cloud would read as a broken figure rather than as an
 * invitation. So the cloud takes the whole stage until it is flattened, which
 * is also the workflow widgets 19 and 21 use: set the samples up, turn them,
 * decide what you think, and only then run the method. */
const PAD_L = 14, PAD_R = 14, GAP = 34, TOP = 26, ROW_GAP = 40, BOT = 34;
const CELL_MAX = 340;
const SOLO_MAX = 460;

function layout(w, open) {
  if (!open) {
    const side = Math.min(SOLO_MAX, Math.max(60, w - PAD_L - PAD_R));
    return {
      open: false,
      side,
      space: { x: (w - side) / 2, y: TOP, w: side, h: side * 0.82 },
      height: TOP + side * 0.82 + BOT,
    };
  }
  const colW = Math.min(CELL_MAX, Math.max(40, (w - PAD_L - PAD_R - GAP) / 2));
  const rowH = colW * 0.82;
  const x0 = Math.max(PAD_L, (w - (colW * 2 + GAP)) / 2);
  const x1 = x0 + colW + GAP;
  const y1 = TOP + rowH + ROW_GAP;
  const curveH = Math.max(150, rowH * 0.95);
  return {
    open: true,
    side: Math.min(colW, rowH),
    space: { x: x0, y: TOP, w: colW, h: rowH },
    flat: { x: x1, y: TOP, w: colW, h: rowH },
    arrow: { x: x0 + colW, y: TOP + rowH / 2, w: GAP },
    kernel: { x: x0, y: y1, w: colW, h: curveH },
    descent: { x: x1, y: y1, w: colW, h: curveH },
    height: TOP + rowH + ROW_GAP + curveH + BOT,
  };
}

/* A chart's plot area, inset from its cell. Shared by `draw` and `regions` so
   the curve and the click targets cannot drift apart — the one piece of
   geometry no pixel hash can see, since the picture is identical whether a
   target sits where it is drawn or six columns away. */
const CH_L = 42, CH_B = 20, CH_T = 10, CH_R = 10;
const chartArea = (x, y, w, h) => ({
  x: x + CH_L,
  y: y + CH_T,
  w: Math.max(10, w - CH_L - CH_R),
  h: Math.max(10, h - CH_T - CH_B),
});

const TURN0 = 34, TILT0 = 21;
function camera(turnDeg, tiltDeg) {
  const az = (turnDeg * Math.PI) / 180, el = (tiltDeg * Math.PI) / 180;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return { ex: [-sa, ca, 0], ey: [-ca * se, -sa * se, ce] };
}

/* --- drawing --------------------------------------------------------------- */
const R_DOT = 4;

function text(ctx, colors, s, x, y, col, size, align = "left", base = "middle") {
  ctx.save();
  ctx.fillStyle = col;
  ctx.font = `${size} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.restore();
}

const sampleCol = (colors, g) => colors.clusters[g % colors.clusters.length];

/* THE HALO IS THE SAME MEMBERSHIP FUNCTION IN BOTH PANELS, drawn from the two
   different kernels — which is the whole of what UMAP matches. Three rings at
   the quarter, half and three-quarter heights, so the SHAPE of the falloff is
   visible rather than just a radius.

   The 3-D one also has a FLAT TOP, and that is the piece t-SNE has no
   counterpart for: inside rho — the distance to the sample's nearest neighbour
   — membership is exactly 1. It is what guarantees every point is joined to
   something, and it is why UMAP does not care how dense a region is. Drawn as a
   distinct inner disc rather than as another ring, because it is a plateau and
   not a level. */
function halo(ctx, col, cx, cy, radii, alpha, core = 0) {
  ctx.save();
  for (let k = radii.length - 1; k >= 0; k -= 1) {
    ctx.globalAlpha = alpha * (0.10 + 0.05 * (radii.length - 1 - k));
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, radii[k], 0, Math.PI * 2);
    ctx.fill();
  }
  if (core > 0) {
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, core, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* THE GRAPH, and how mu becomes ink. Mapping C of `_lab/umap-edges.html`:
   BOTH opacity and width carry the weight. Kenneth chose it over opacity alone
   after seeing the four side by side at panel size.

   The ink measure on that page argues against it — C is the heaviest at every
   setting, 2.2 / 4.0 / 5.2 ink per point across n_neighbors 3 / 15 / 40 against
   a linear alpha's 1.1 / 2.9 / 4.0 — and the measure is the wrong one, because
   C CONCENTRATES its ink. Width is a far stronger channel than opacity, so a
   strong edge reads as a line and a weak one as a hairline; under a linear
   alpha every edge is the same line at a different grey.

   NO MAPPING IS LITERALLY HONEST and the widget does not pretend otherwise.
   Overlapping semi-transparent strokes compound, so alpha = mu does not render
   as darkness proportional to mu wherever edges cross — at 385 edges that is
   everywhere. Nothing on screen invites reading a weight back off an edge. */
const EDGE_FLOOR = 0.004;
function edges(ctx, colors, mu, at, n, alpha) {
  ctx.save();
  ctx.strokeStyle = colors.ink2;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const w = mu[i][j];
      if (w <= 1e-9) continue;
      const a = alpha * w ** 1.5;
      if (a < EDGE_FLOOR) continue;
      const p = at(i), q = at(j);
      ctx.globalAlpha = a;
      ctx.lineWidth = 0.4 + 1.8 * w;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function ring(ctx, colors, x, y, r) {
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function sampleDot(ctx, colors, x, y, col, r = R_DOT, fade = 1) {
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.restore();
}

/* THE SPHERE THE SAMPLES LIE ON, drawn as a wireframe of parallels and
   meridians rather than the three coordinate circles widget 21 uses.

   That change follows the stage change. While the samples filled the ball the
   globe was a reference and three great circles were enough to place it; now
   every sample sits ON it and the wireframe has to read as a SURFACE, because
   whether a reader sees a curved surface or a scatter in a box is the whole
   difference between a manifold and a cloud. Kenneth asked for it in as many
   words after seeing the caps land on three circles.

   Front arcs are drawn at full weight and back arcs at a third, which is what
   gives the sphere its inside and outside. Every arc is broken wherever it
   crosses the horizon rather than drawn whole and over-painted, so the split is
   exact at any camera angle. */
const PARALLELS = 7, MERIDIANS = 12;

function arc(ctx, P, eye, pt, steps, front) {
  ctx.beginPath();
  let drawing = false;
  for (let k = 0; k <= steps; k += 1) {
    const p = pt(k / steps);
    if ((dot(p, eye) >= 0) !== front) { drawing = false; continue; }
    const [x, y] = P(p);
    if (drawing) ctx.lineTo(x, y); else { ctx.moveTo(x, y); drawing = true; }
  }
  ctx.stroke();
}

function globe(ctx, colors, P, eye, radius, alpha) {
  ctx.save();
  ctx.strokeStyle = colors.grid;
  for (const front of [false, true]) {
    ctx.globalAlpha = alpha * (front ? 0.85 : 0.28);
    /* Parallels, skipping the poles where the ring has no radius. */
    for (let i = 1; i < PARALLELS + 1; i += 1) {
      const lat = -Math.PI / 2 + (Math.PI * i) / (PARALLELS + 1);
      const r = radius * Math.cos(lat), z = radius * Math.sin(lat);
      /* The equator carries the weight, so the sphere has a waist to read. */
      ctx.lineWidth = Math.abs(lat) < 1e-6 ? 1.2 : 0.8;
      arc(ctx, P, eye, (t) => {
        const th = t * Math.PI * 2;
        return [r * Math.cos(th), r * Math.sin(th), z];
      }, 72, front);
    }
    ctx.lineWidth = 0.8;
    /* Meridians: half circles pole to pole, so each is drawn once. */
    for (let i = 0; i < MERIDIANS; i += 1) {
      const lon = (Math.PI * i) / MERIDIANS;
      const ca = Math.cos(lon), sa = Math.sin(lon);
      arc(ctx, P, eye, (t) => {
        const th = t * Math.PI * 2;
        return [radius * Math.cos(th) * ca, radius * Math.cos(th) * sa, radius * Math.sin(th)];
      }, 72, front);
    }
  }
  ctx.restore();
}

/* The red arrow of the diagram. Load-bearing rather than decoration: it says
   the right panel was BUILT from the left rather than being a view of it,
   which is the job widget 20 gave to a diagonal. */
function arrow(ctx, colors, { x, y, w }, alpha) {
  const x0 = x + 7, x1 = x + w - 7, head = 7;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colors.ink3;
  ctx.fillStyle = colors.ink3;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1 - head, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x1 - head, y - head * 0.6);
  ctx.lineTo(x1 - head, y + head * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function shownAt(state, anim) {
  const from = state.path[anim.k];
  if (!anim.moving) return from;
  const to = state.path[anim.k + 1];
  const e = easeIO(anim.t);
  return from.map((p, i) => [lerp(p[0], to[i][0], e), lerp(p[1], to[i][1], e)]);
}

const STEP_MS = 260;
const RUN_MS = 70;

/* THE FLATTENING, and it is a move rather than a reveal — widget 19 spends 1800
   on the same turn and 900 on its components appearing, for that reason. The
   cloud has to be seen to ROTATE onto its plane, because that is the claim: the
   arrangement UMAP starts from is a real projection of the data and not noise. */
const ENTER_MS = 1500;

/* THE LOW-DIMENSIONAL MEMBERSHIP, and the distance at which a pair of a given
   strength is happiest. dC/ds = (b/s)(mu - w) is zero exactly when w = mu, so

       d*(mu) = ( (1/mu - 1) / a ) ^ (1 / 2b)

   mu comes from the data and `n_neighbors`; a and b come from `min_dist` AND
   NOTHING ELSE. That is the one sentence written as a formula: raising min_dist
   moves every pair's target distance without touching a single mu, and what it
   does is compress the RANGE — the spread of d* across mu falls from x25.8 at
   min_dist 0 to x3.8 at 0.99. */
const lowW = (d, a, b) => 1 / (1 + a * d ** (2 * b));
const dStar = (mu, a, b) => ((1 / mu - 1) / a) ** (1 / (2 * b));
const ceTerm = (mu, d, a, b) => {
  const w = clamp(lowW(d, a, b), 1e-9, 1 - 1e-9);
  return -(mu * Math.log(w) + (1 - mu) * Math.log(1 - w));
};

/* The kernel panel's fixed frame. It does NOT follow the curves, because the
   whole point is watching them move: an axis rescaled per parameter change
   would hold them still and show nothing (principle 2.5). Measured bounds —
   d*(mu = 0.05) reaches 3.75 at min_dist 0.99, and CE at d = 0.1 reaches 6.35
   at mu = 0.05 — so 4 and 7 hold every setting of both controls. */
const KERN_D = 4, KERN_CE = 7;

/* Every display parameter EXCEPT `step`, as one string. `rebuild` compares it
   against the last one to work out whether the write it is reacting to was a
   scrub of the descent chart or something else. ADD TO THIS WHENEVER A DISPLAY
   PARAMETER IS ADDED — an omission does not throw, it silently throws the
   reader's position away on that control. Widget 21 got this wrong twice before
   getting it right; its comment carries both failures. */
const otherDisplay = (p) => `${p.turn},${p.tilt},${p.labels},${p.pick},${p.graph},${p.flatten}`;

defineWidget({
  slug: "umap",
  title: "UMAP",
  subtitle: "UMAP assumes the data lie on a curved lower-dimensional surface, a manifold. It builds a weighted graph of each sample's nearest neighbours and lays that graph out flat, preserving local structure over global distances.",
  status: "shipped",
  layout: "side",
  height: ({ w, flatten }) => layout(w, !!flatten).height,

  /* THE KEY IS `token`, NOT `swatch`, and getting it wrong fails SILENTLY —
     core writes `var(--c-${item.token}, var(--${item.token}))`, so an unknown
     key leaves every swatch the same default grey. Widget 21 shipped that way
     and a human found it on screen; no check in this repo would have.

     These have to read true with the labels BOTH off and on, because core takes
     the legend once at build time rather than per render. */
  legend: [
    { token: "ink-2", label: "Edge — the membership strength μ between two samples", mark: "line" },
    { token: "empirical", label: "Cross-entropy over all pairs", mark: "line" },
    { token: "reference", label: "Lower bound — the entropy of the graph itself", mark: "line" },
    { token: "highlight", label: "Selected sample", mark: "dot" },
    /* The bottom-left panel's explanation lives here because the legend is DOM
       and wraps, where a canvas caption in a 192px cell cannot. */
    { token: "ink-3", label: "One pair's cross-entropy against distance; the dot marks its minimum", mark: "line" },
  ],

  params: {
    /* OFF BY DEFAULT, so the reader reads the clusters off the picture before
       being told what they are — the notebook's own order (both hosts plot
       every method twice, once bare and once coloured by type), and
       non-negotiable 4 applied to knowledge rather than to the figure. */
    labels: {
      type: "segmented",
      label: "True groups",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ],
      default: "off",
      display: true,
    },
    /* SIX BY DEFAULT, because four can be flattened without losing them. See
       `spreadDirs` in model.js for the table: the flat map the descent starts
       from separates four clusters at silhouette 0.684 and six at 0.540, so at
       four the optimisation looks like it earns nothing. Six is also every
       cluster colour the tokens file defines and no more. */
    groups: {
      type: "choice",
      label: "Groups in the data",
      options: [
        { value: "2", label: "2", detail: "at the poles" },
        { value: "3", label: "3", detail: "round the equator" },
        { value: "4", label: "4", detail: "a tetrahedron" },
        { value: "6", label: "6", detail: "an octahedron" },
      ],
      default: "6",
    },
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [
        { value: "4", label: "4" },
        { value: "8", label: "8" },
        { value: "12", label: "12" },
      ],
      default: "8",
    },

    /* THE FIRST OF THE LESSON'S TWO CONTROLS, and the one that changes what
       UMAP KNOWS. Swept 2 to 40 it moves 5-NN retention by +0.271, up on 10 of
       10 seeds: 0.663 at 2, 0.847 at 3, 0.897 at 5, 0.930 at 15, 0.934 at 40.
       The silhouette turns over where retention flattens — 0.904 at 15 against
       0.884 at 40 — so there is an optimum in the middle rather than a ceiling.
       PHM5003's own setting of 3 is at the shattering end, because 8 samples
       leave nowhere else to be — worth showing rather than copying. */
    neighbours: {
      type: "int",
      label: "Neighbours",
      min: 2,
      max: 40,
      default: 15,
      detail: "n_neighbors",
    },

    /* THE SECOND, and the one the widget is about. Over the same sweep it moves
       retention by +0.013, which is inside the seed noise on nine of ten seeds,
       while moving how tight the clusters LOOK by x3.62, looser on 10 of 10.

       NOT `display: true`, however much it behaves like a presentation control.
       It feeds `compute()`: a and b change, the descent is different, the
       arrangement moves. Marking it display to preserve the reader's position
       would be a widget lying about itself (non-negotiable 1). That it changes
       the picture without changing the knowledge is the LESSON, not a licence
       to skip the recompute. */
    minDist: {
      type: "float",
      label: "Minimum distance",
      min: 0,
      max: 0.95,
      step: 0.05,
      default: 0.1,
      detail: "min_dist",
    },

    /* THE TWO GATES ARE CELL 41'S TWO NUMBERED STEPS, and Kenneth's own
       phrasing: connect them in a graph, then flatten the manifold.

       BOTH ARE `display: true`, and that is not a preference. `GATE_PARAM` in
       core is the FIRST gate in the spec and only that one, and it is what the
       entry animation is keyed on — so as data gates the second would silently
       JUMP where the first played in. Widget 19 shipped that bug and it was
       reported as "i didn't see any animation for projection?". Display is also
       the honest reading: `compute` builds the graph and runs the descent
       whatever the gates say, and the gates choose how much is drawn. */
    graph: {
      type: "gate",
      label: "Build the neighbour graph",
      labelOff: "Clear the graph",
      display: true,
    },
    flatten: {
      type: "gate",
      label: "Flatten to 2-D",
      labelOff: "Back to the cloud",
      when: { param: "graph" },
      display: true,
    },

    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "moves every sample, and where the flattening starts from",
    },

    /* Hidden, because the figure is their control — but parameters, so a shared
       link reproduces the angle the reader was looking from. */
    turn: { type: "int", label: "Turn", min: -180, max: 180, step: 3, default: TURN0, display: true, hidden: true },
    tilt: { type: "int", label: "Tilt", min: -80, max: 80, step: 3, default: TILT0, display: true, hidden: true },

    /* WHERE THE READER IS IN THE RUN, and it is a PARAMETER because clicking
       the descent chart has to go through the same door every other write does
       (non-negotiable 1). A region resolves a pixel to one parameter, core
       syncs it and writes the URL, and the arrangement jumps there — so a
       scrubbed position is shareable in a way `anim.k` alone could never be.
       0 by default, so the widget still starts empty; `?step=50` publishes the
       finished figure the way `?shown=N` does elsewhere. */
    step: {
      type: "int",
      label: "Step",
      min: 0,
      max: ITERS / PER_STEP,
      default: 0,
      display: true,
      hidden: true,
    },

    /* WHICH SAMPLE THE KERNEL PANEL IS ABOUT. A parameter for the same reason
       `step` is: clicking a sample goes through the one door, so the chosen
       sample lands in the URL and a link can point at it. */
    pick: {
      type: "int",
      label: "Sample",
      min: 0,
      /* THE LARGEST STAGE, which is six groups of twelve. It was 47 while four
         groups was the ceiling, so the last 24 samples of the biggest stage were
         unreachable by URL — `draw` clamps, so nothing broke and nothing said
         so. A hidden parameter's range still has to cover every stage. */
      max: 71,
      default: 0,
      display: true,
      hidden: true,
    },
  },

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

  compute({ params, rng }) {
    const groups = +params.groups;
    const per = +params.samples;
    const st = stage(groups, per, rng);
    const pts = st.map((s) => s.p);
    const gs = st.map((s) => s.g);
    const n = pts.length;

    /* UMAP'S LIMIT IS NOT RTSNE'S, and the difference is worth knowing. Widget
       21 REFUSES above `3 * perplexity >= n - 1` because Rtsne errors there.
       `umap-learn` raises only at n_neighbors = 1, and above n - 1 it runs
       anyway, SILENTLY CLAMPING to n - 1 with no warning that names the clamp.
       So the floor is a hard error and the ceiling is a quiet correction.

       This widget clamps like the library and SAYS SO in the readout, which is
       the difference that matters: a control that stops meaning what it reads
       is the failure this project exists to avoid, whether or not the library
       bothers to mention it. */
    const legal = Math.max(2, n - 1);
    const neighbours = clamp(params.neighbours, 2, legal);
    const clamped = neighbours !== params.neighbours;

    const { mu, rho, sigma } = fuzzySet(pts, neighbours);
    const { a, b } = findAbParams(1, params.minDist);

    /* THE FLATTENING STARTS ON THE PCA PLANE, not at random — `umap-learn`'s own
       default is structured too (spectral), and the eight-seed table is in
       model.js. `Z` is the centred cloud and `pc1`/`pc2` its two most-spread
       directions, so `Y0` IS the flattening: the entry animation rotates the
       cloud onto exactly this plane and lands on frame 0 of the run. */
    const { Z, pc1, pc2, Y: Y0 } = pcaPlane(pts);

    const { frames: path, curve } = umap(pts, {
      nNeighbors: neighbours, iters: ITERS, every: PER_STEP,
      eta: ETA, seed: params.seed, mu, ab: { a, b }, init: Y0,
    });

    /* ONE SCALE FOR THE 2-D PANEL, covering the whole trajectory, so the frame
       never moves under the reader (2.5) and a sample never crosses an edge.
       Each frame is centred first, because the descent has no term fixing the
       centroid and a slow drift would otherwise eat the frame. The absolute
       scale is still arbitrary — nothing may be read off this panel in units —
       and the axes carry no ticks for exactly that reason. */
    let span2 = 0;
    for (const Y of path) {
      let cx = 0, cy = 0;
      for (const p of Y) { cx += p[0]; cy += p[1]; }
      cx /= n; cy /= n;
      for (const p of Y) { p[0] -= cx; p[1] -= cy; }
      for (const p of Y) span2 = Math.max(span2, Math.hypot(p[0], p[1]));
    }
    let span3 = 0;
    for (const p of pts) span3 = Math.max(span3, Math.hypot(p[0], p[1], p[2]));

    /* The edge weights the picked sample actually has, which is what the kernel
       panel draws curves for. Sorted so the strongest, the middling and the
       weakest can each get one. */
    /* THE CROSS-ENTROPY HAS A FLOOR AND IT IS NOT ZERO. Writing it as
       CE = SUM H(mu) + KL(mu || w) splits it in two: the entropy of the graph
       itself, which no arrangement can remove, and the fit error, which is the
       only part the descent can touch. On this stage the floor is 139.8 against
       a final 170.9 — SO 82 PER CENT OF WHAT THE WIDGET REPORTS IS IRREDUCIBLE.
       A chart anchored at 0 with no floor marked says the opposite: that the
       curve is failing to reach a target it could in principle hit. */
    const edgeList = [];
    let floor = 0;
    for (let i = 0; i < n; i += 1)
      for (let j = i + 1; j < n; j += 1) {
        const m = mu[i][j];
        if (m > 1e-9) edgeList.push(m);
        if (m > 1e-9 && m < 1 - 1e-9) floor -= m * Math.log(m) + (1 - m) * Math.log(1 - m);
      }

    /* WHAT THE FLATTENING ALONE GETS, before UMAP moves a single point. It is
       the readout tile that says what UMAP ADDS — 65 per cent against 81 on
       this stage — and no other widget in the arc states that difference.
       Taken from path[0] rather than from Y0 because compute recentres every
       frame below, and the two must be the same numbers. */
    return {
      n, groups, per, gs, pts, Z, pc1, pc2, path, curve, mu, rho, sigma, a, b,
      keptFlat: neighboursKept(pts, path[0]), floor,
      neighbours, clamped, legal, edgeCount: edgeList.length,
      meanMu: edgeList.length ? edgeList.reduce((s, v) => s + v, 0) / edgeList.length : 0,
      span2: span2 * 1.08 || 1,
      span3: span3 * 1.1 || 1,
      ceMax: Math.max(...curve) * 1.05 || 1,
    };
  },

  regions({ w, params, state }) {
    /* STATE IS NULL ON CORE'S LOAD-TIME VALIDATION PROBE, which runs before the
       first render. Widget 21 met this first and its comment records the cost:
       the probe validates nothing, so a bad region table would not throw at
       load the way core intends. The proper fix is in core, moving the probe
       after the first render — a `widgets/core/` change owing a full
       fingerprint run. */
    if (!state) return [];
    const open = !!params.flatten;
    const L = layout(w, open);
    const out = [];

    /* THE SAMPLES ARE CLICKABLE IN THE 3-D PANEL ONLY, and that is a
       correctness limit rather than a preference. A region is resolved from
       `params` and `state`, and core hands it no `anim`. The 3-D positions
       depend only on turn and tilt, both parameters, so they hit-test exactly.
       The 2-D positions depend on how far the descent has run, which lives in
       `anim` — a target computed from `params.step` would sit wherever the
       reader last CLICKED rather than where the sample is drawn as they aim at
       it, which is exactly the silent mismatch no pixel hash can see. */
    {
      const { x, y, w: pw, h: ph } = L.space;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 16) / state.span3;
      const { ex, ey } = camera(params.turn, params.tilt);
      const eye = [
        ex[1] * ey[2] - ex[2] * ey[1],
        ex[2] * ey[0] - ex[0] * ey[2],
        ex[0] * ey[1] - ex[1] * ey[0],
      ];
      /* Depth order, so the target stack matches the paint order and the
         nearest sample claims the click — hitTest takes the LAST match. */
      const order = state.pts.map((p, i) => [dot(p, eye), i]).sort((a, b) => a[0] - b[0]);
      const rr = R_DOT + 3;
      for (const [, i] of order) {
        const px = cx + dot(state.pts[i], ex) * S;
        const py = cy - dot(state.pts[i], ey) * S;
        out.push({ set: { pick: i }, x: px - rr, y: py - rr, w: rr * 2, h: rr * 2, label: `sample ${i + 1}` });
      }
    }

    if (!open) return out;

    const { x, y, w: pw, h: ph } = L.descent;
    const total = state.path.length - 1;
    const a = chartArea(x, y, pw, ph);
    for (let k = 0; k <= total; k += 1) {
      /* Each step owns the strip around its own x, so the nearest step to the
         pointer takes the click — half a step of slack each side, and the two
         ends keep their outer half rather than being unreachable at the edge. */
      const cx = a.x + (total > 0 ? (k / total) * a.w : 0);
      const half = total > 0 ? a.w / total / 2 : a.w / 2;
      const x0 = Math.max(a.x, cx - half);
      const x1 = Math.min(a.x + a.w, cx + half);
      out.push({
        set: { step: k },
        x: x0, y: a.y, w: Math.max(1, x1 - x0), h: a.h,
        label: `step ${k * PER_STEP}`,
      });
    }
    return out;
  },

  animation: {
    stepLabel: "Optimise",
    stepTitle: `Run ${PER_STEP} more gradient steps`,
    runLabel: "Play",
    runTitle: "Run to the end of the optimisation",

    /* TWO GATES, AND CORE ONLY KNOWS ABOUT THE FIRST. `GATE_PARAM` is
       `Object.entries(spec).find(f => f.type === "gate")` — so core hides the
       whole drive row while `graph` is shut, and shows it the moment `graph`
       opens. But there is still nothing to drive then: the arrangement does not
       exist until `flatten` opens, and Settle would run a descent nobody can
       see.

       That is the shape core's own comment warns about — `maximum-likelihood`
       shipped with four dead buttons for exactly this reason — and `anim.inert`
       is the answer it points to. Core takes step and run out of the row, and
       the bordered group with them, rather than leaving them live and useless.
       Set in BOTH `init` and `rebuild`, because `flatten` is a display
       parameter: opening it never re-runs `init`. */
    init: ({ params, state, fromScratch }) => {
      const total = state.path.length - 1;
      const pre = fromScratch ? 0 : clamp(params.step | 0, 0, total);
      return {
        k: pre, t: 1, moving: false, done: pre >= total,
        inert: !params.flatten,
        /* 1 WHEN THE GATE IS ALREADY OPEN ON LOAD, so a shared link opens on the
           figure rather than replaying into it — widget 19's rule, and the same
           reasoning as `shown`: an authored head start describes how the figure
           arrives, not something it keeps. */
        enter: params.flatten ? 1 : 0,
        others: otherDisplay(params),
      };
    },

    /* WHICH DISPLAY PARAMETER MOVED, deduced rather than told. Core calls
       rebuild once per display-parameter write and does not say which one. So
       the widget watches every display parameter EXCEPT `step`: if none of them
       moved, the write must have been `step`, and only then does the reader's
       position jump. Widget 21's comment records the two wrong versions built
       before this one, and both failures are SILENT — they throw the reader's
       position away rather than erroring. */
    rebuild: (anim, { params, state }) => {
      const total = state.path.length - 1;
      const others = otherDisplay(params);
      if (others === anim.others) {
        anim.k = clamp(params.step | 0, 0, total);
        anim.moving = false;
        anim.t = 1;
      }
      anim.others = others;
      if (anim.k > total) { anim.k = total; anim.moving = false; anim.t = 1; }
      anim.done = anim.k >= total;
      anim.inert = !params.flatten;

      /* THE FLATTENING ASKS FOR FRAMES. `anim.easing` is core's word for "this
         display change wants them", and it is CONSUMED when granted, so it has
         to be asked for each time. Shutting the gate rewinds, so re-opening it
         plays again rather than snapping to the end. */
      if (!params.flatten) anim.enter = 0;
      else if (anim.enter < 1) anim.easing = true;
    },

    advance(anim, { dt, state }) {
      /* CORE'S OWN MODE FOR A DISPLAY TRANSITION. Nothing of the descent moves
         while the cloud is rotating onto its plane — they are two different
         things and overlapping them would read as one. */
      if (anim.mode === "ease") {
        anim.enter = Math.min(1, anim.enter + dt / ENTER_MS);
        return anim.enter < 1;
      }
      /* A STEP INTERRUPTING THE FLATTENING FINISHES IT FIRST. Core stops the
         ease the moment Settle or Play is pressed, which would leave the cloud
         frozen half-rotated with the descent running underneath it — and
         HANDOVER records three shipped bugs that were exactly a mid-animation
         state one action left another in. */
      anim.enter = 1;
      const total = state.path.length - 1;
      const dur = anim.mode === "step" ? STEP_MS : RUN_MS;
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
    const open = !!params.flatten;
    const joined = !!params.graph;
    const L = layout(w, open);
    const { n, gs, pts, mu, rho, sigma, a, b } = state;
    const Y = shownAt(state, anim);
    /* LABELS OFF IS THE DEFAULT, and the colour is `--c-unknown`, which the
       tokens file defines as "not measured yet" — absence of information rather
       than a third category, which is exactly what a withheld label is. */
    const told = params.labels === "on";
    const col = (i) => (told ? sampleCol(colors, gs[i]) : colors.unknown);
    const picked = clamp(params.pick | 0, 0, n - 1);
    const total = state.path.length - 1;
    /* The halo fades as the descent runs: at the start it is the whole story,
       by the end the reader is looking at the arrangement. It never reaches
       zero, because it is what the picture was built out of. */
    const started = total > 0 ? anim.k / total : 0;
    const haloA = (joined ? 1 : 0) * (1 - 0.45 * started);

    /* ---- the samples, on the manifold, wearing their neighbourhoods ------- */
    {
      const { x, y, w: pw, h: ph } = L.space;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 16) / state.span3;
      const { ex, ey } = camera(params.turn, params.tilt);
      const P = (p) => [cx + dot(p, ex) * S, cy - dot(p, ey) * S];
      const eye = [
        ex[1] * ey[2] - ex[2] * ey[1],
        ex[2] * ey[0] - ex[0] * ey[2],
        ex[0] * ey[1] - ex[1] * ey[0],
      ];

      text(ctx, colors, "3-D space", x, y - 10, colors.ink2, colors.fsSm);
      if (joined) {
        text(ctx, colors, "membership in the data", x + pw, y - 10,
          colors.ink3, colors.fsXs, "right");
      }

      globe(ctx, colors, P, eye, R, 0.7);

      const order = pts.map((p, i) => [dot(p, eye), i]).sort((a2, b2) => a2[0] - b2[0]);
      const at = (i) => P(pts[i]);

      if (joined) {
        for (const [depth, i] of order) {
          const [px, py] = P(pts[i]);
          const fade = 0.55 + 0.45 * clamp01((depth / state.span3 + 1) / 2);
          /* mu(d) = exp(-max(0, d - rho)/sigma), so height h is reached at
             d = rho + sigma * ln(1/h). The flat top out to rho is the core. */
          const rs = [0.75, 0.5, 0.25].map((h) => (rho[i] + sigma[i] * Math.log(1 / h)) * S);
          halo(ctx, col(i), px, py, rs, haloA * fade, rho[i] * S);
        }
        edges(ctx, colors, mu, at, n, 0.9);
      }

      for (const [depth, i] of order) {
        const [px, py] = P(pts[i]);
        const fade = 0.55 + 0.45 * clamp01((depth / state.span3 + 1) / 2);
        sampleDot(ctx, colors, px, py, col(i), i === picked ? R_DOT + 1.5 : R_DOT, fade);
        if (i === picked && joined) ring(ctx, colors, px, py, R_DOT + 5);
      }

      if (!open) {
        text(ctx, colors, joined ? "drag to turn, click a sample" : "drag to turn",
          x, y + ph + 8, colors.ink3, colors.fsXs, "left", "top");
      }
    }

    if (!open) return;

    arrow(ctx, colors, L.arrow, 0.9);

    /* ---- the same graph, flattened ---------------------------------------- *
     *
     * THE FLATTENING IS A REAL ROTATION, and that is why the start is the PCA
     * plane rather than noise. While `anim.enter` runs 0 to 1 this panel shows
     * the SAME cloud the panel on the left does, turning onto its two
     * most-spread directions and landing flat — and where it lands is exactly
     * frame 0 of the descent, because that frame IS this projection.
     *
     * Slerping each basis vector and squaring the second up against the first
     * keeps every frame orthonormal, so the cloud rotates rather than shears —
     * widget 19's note, and its helpers.
     *
     * The graph comes with it. The edges are drawn through the whole turn,
     * because carrying them across is the claim the arrow makes.
     */
    {
      const { x, y, w: pw, h: ph } = L.flat;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S2 = (L.side / 2 - 16) / state.span2;
      const turning = anim.enter < 1;
      const te = easeCubic(clamp01(anim.enter));

      let at;
      if (turning) {
        const base = camera(params.turn, params.tilt);
        const ux = slerp(base.ex, state.pc1, te);
        let uy = slerp(base.ey, state.pc2, te);
        uy = unit3(sub3(uy, scale3(ux, dot(ux, uy))));
        const S3 = (L.side / 2 - 16) / state.span3;
        const S = lerp(S3, S2, te);
        at = (i) => [cx + dot(state.Z[i], ux) * S, cy - dot(state.Z[i], uy) * S];
      } else {
        at = (i) => [cx + Y[i][0] * S2, cy - Y[i][1] * S2];
      }

      text(ctx, colors, "2-D space", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, turning ? "projecting onto PC1, PC2" : "membership in the layout",
        x + pw, y - 10, colors.ink3, colors.fsXs, "right");

      /* The axes are named UMAP1 and UMAP2 and carry NO ticks, deliberately.
         They have no units: the arrangement's size is arbitrary, and a scale
         would invite exactly the reading — "these two clusters are three
         apart" — that this widget exists to break. `03-5` cell 41 lists
         "Interpretation of axes is not straightforward" among UMAP's
         limitations; this is that, drawn. */
      /* The axes arrive with the landing. Mid-rotation they would be naming
         directions the picture does not have yet. */
      const axesIn = clamp01((anim.enter - 0.72) / 0.28);
      if (axesIn > 0.01) {
        ctx.save();
        ctx.globalAlpha = axesIn;
        ctx.strokeStyle = colors.axis;
        ctx.lineWidth = 1;
        const ax = Math.round(x + 12) + 0.5, ay = Math.round(y + ph - 14) + 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, y + 8);
        ctx.lineTo(ax, ay);
        ctx.lineTo(x + pw - 8, ay);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = axesIn;
        text(ctx, colors, "UMAP1", x + pw - 8, ay + 10, colors.ink3, colors.fsXs, "right", "top");
        ctx.restore();
      }

      /* THE LOW-D HALO IS IN THE ARRANGEMENT'S OWN UNITS, which is a thing
         widget 21 could not do: t-SNE's kernel and its output scale are
         unrelated, so its 2-D halo used an invented unit. Here the membership
         1/(1 + a d^2b) is a function of a distance IN THIS PANEL, so the rings
         can be drawn at their true radii and `minDist` visibly moves them.
         There is no flat top — w = 1 only at d = 0 — and that asymmetry with
         the panel on the left is the rho subtraction, drawn. */
      /* The low-D halos arrive with the landing too: 1/(1 + a d^2b) is a
         function of a distance IN THIS PANEL, and mid-rotation there is no such
         distance yet. */
      for (let i = 0; i < n; i += 1) {
        const [px, py] = at(i);
        const rs = [0.75, 0.5, 0.25].map((h) => dStar(h, a, b) * S2);
        halo(ctx, col(i), px, py, rs, haloA * 0.85 * axesIn);
      }
      edges(ctx, colors, mu, at, n, 0.9);
      for (let i = 0; i < n; i += 1) {
        const [px, py] = at(i);
        sampleDot(ctx, colors, px, py, col(i), i === picked ? R_DOT + 1.5 : R_DOT);
        /* THE PICKED SAMPLE IS MARKED IN BOTH SPACES, which is what ties the
           curves below to a sample rather than to an index. */
        if (i === picked) ring(ctx, colors, px, py, R_DOT + 5);
      }
    }

    /* ---- bottom left: what each pair's cross-entropy wants ---------------- */
    {
      const { x, y, w: pw, h: ph } = L.kernel;
      const ar = chartArea(x, y, pw, ph);
      const px = (d) => ar.x + (d / KERN_D) * ar.w;
      const py = (v) => ar.y + ar.h - clamp01(v / KERN_CE) * ar.h;

      /* THE TITLE NAMES ONE PAIR, not the objective. Kenneth read this panel
         and asked what the axes were and why there were several lines — which
         is the panel failing, not the reader. It had been titled "Cross-entropy,
         against distance in the picture", which is true of the WHOLE
         arrangement and is what the panel on the right actually plots. What
         this one shows is a single pair's share of it, as a function of how far
         apart that pair is drawn, for three of the picked sample's links.
         The legend carries the rest, because it is DOM and wraps. */
      text(ctx, colors, "Cross-entropy, one pair", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "vs distance", x + pw, y - 10,
        colors.ink3, colors.fsXs, "right");

      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g += 1) {
        const gy = Math.round(ar.y + (ar.h * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(ar.x, gy);
        ctx.lineTo(ar.x + ar.w, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(ar.x + 0.5, ar.y);
      ctx.lineTo(ar.x + 0.5, ar.y + ar.h + 0.5);
      ctx.lineTo(ar.x + ar.w, ar.y + ar.h + 0.5);
      ctx.stroke();
      ctx.restore();
      text(ctx, colors, "0", ar.x - 5, ar.y + ar.h, colors.ink3, colors.fsXs, "right");
      text(ctx, colors, String(KERN_CE), ar.x - 5, ar.y + 1, colors.ink3, colors.fsXs, "right", "top");
      /* THE AXIS MAXIMUM SITS INSIDE THE FRAME, not on the line below it, and
         that is by construction rather than by measuring. On the line below it
         printed straight through the caption at 550px — which is the width the
         fingerprint harness records at — and widget 21's descent chart carries
         the same note about the same collision. The bottom-right corner of this
         panel is always empty: every curve is climbing by d = 4. */
      text(ctx, colors, String(KERN_D), ar.x + ar.w - 2, ar.y + ar.h - 3,
        colors.ink3, colors.fsXs, "right", "bottom");

      /* THREE CURVES, FOR THE PICKED SAMPLE'S OWN STRONGEST, MIDDLING AND
         WEAKEST LINK. Drawing one curve at an invented mu would be the
         notebook's figure — which is illustrative rather than computed: fitting
         its digitised curve needs a = 0.653 with b = 1.930, and no min_dist
         pairs those. Drawing the reader's own sample's links instead ties the
         panel to the data.

         IT DEGENERATES AT LOW `neighbours` AND THAT IS THE POINT SHOWING, not a
         defect: at n_neighbors = 3 the stage's mu is effectively binary, 0.585
         or 1.000, so the three curves nearly coincide. The reader sees that a
         small neighbourhood makes every link the same strength. */
      /* BOTH ENDS OF THE RANGE ARE DEGENERATE AND BOTH WERE DRAWN BEFORE THIS
         GUARD, which is what a screenshot caught and no assertion would have.

         EVERY sample has a link at mu = 1 — its own nearest neighbour, where
         d <= rho puts the membership on the kernel's flat top, and the fuzzy
         union keeps it there. d*(1) = 0 for any a and b, so that curve has its
         minimum at the origin, rises monotonically, and is the ONE link
         `minDist` cannot move. Drawn as the strongest of three it read as the
         headline and said the opposite of the panel's point.

         At the other end a link of mu ~ 0.00 has its minimum off the right of
         the frame, so only the middle curve showed a minimum at all, and the
         caption printed "μ 1.00, 0.30, 0.00".

         So the window is the range whose minimum FITS: d*(mu) <= KERN_D bounds
         mu below, and mu < 1 bounds it above. */
      const muLo = 1 / (1 + a * KERN_D ** (2 * b));
      const links = [];
      for (let j = 0; j < n; j += 1) {
        const m = mu[picked][j];
        if (j !== picked && m > muLo && m < 0.999) links.push(m);
      }
      links.sort((p, q) => q - p);
      const chosen = links.length
        ? [...new Set([links[0], links[links.length >> 1], links[links.length - 1]])]
        : [];

      for (const m of chosen) {
        const strong = m === chosen[0] && chosen.length > 1;
        ctx.save();
        ctx.strokeStyle = strong ? colors.highlight : colors.ink3;
        ctx.lineWidth = strong ? 1.8 : 1.2;
        ctx.globalAlpha = strong ? 1 : 0.75;
        ctx.beginPath();
        let drawing = false;
        for (let s = 1; s <= 260; s += 1) {
          const d = (s / 260) * KERN_D;
          const v = ceTerm(m, d, a, b);
          if (v > KERN_CE) { drawing = false; continue; }
          if (drawing) ctx.lineTo(px(d), py(v)); else { ctx.moveTo(px(d), py(v)); drawing = true; }
        }
        ctx.stroke();
        /* The minimum, which is exactly where the picture's membership equals
           the data's. It is the distance this pair is being pulled toward, and
           `minDist` is the only thing that moves it. */
        const ds = dStar(m, a, b);
        if (ds <= KERN_D) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = strong ? colors.highlight : colors.ink3;
          ctx.beginPath();
          ctx.arc(px(ds), py(ceTerm(m, ds, a, b)), 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          /* EACH MINIMUM CARRIES ITS OWN mu, rather than the three being listed
             in a caption. The list did not fit — 38 characters in a 192px cell —
             and a label on the dot is the better reading anyway: it names the
             link whose ideal distance that dot IS, so moving `minDist` shows a
             labelled dot sliding rather than a number changing somewhere else.
             The three are well separated by construction: d* is monotone in mu,
             and these are the largest, middle and smallest the sample has. */
          text(ctx, colors, `μ ${m.toFixed(2)}`, px(ds),
            py(ceTerm(m, ds, a, b)) - 7,
            strong ? colors.highlight : colors.ink3, colors.fsXs, "center", "bottom");
        } else {
          ctx.restore();
        }
      }

      text(ctx, colors,
        chosen.length
          ? `sample ${picked + 1} — click another`
          : `sample ${picked + 1}: every link is at μ = 1`,
        ar.x, ar.y + ar.h + 5, colors.ink3, colors.fsXs, "left", "top");
    }

    /* ---- bottom right: the cross-entropy falling -------------------------- */
    {
      const { x, y, w: pw, h: ph } = L.descent;
      const ar = chartArea(x, y, pw, ph);
      const top = Math.max(...state.curve, 1e-9);
      const px = (k) => ar.x + (total > 0 ? (k / total) * ar.w : 0);
      const py = (v) => ar.y + ar.h - clamp01(v / top) * ar.h;

      /* PAIRED WITH THE PANEL ON ITS LEFT, deliberately: "one link" against
         "every link" is what says the two are the same quantity at two scales,
         and not two different things called cross-entropy. EVERY label pair in
         this widget was measured against the narrowest column the layout
         produces — 203px at a 520px viewport — rather than chosen and hoped
         for; four of the first five overflowed it. */
      text(ctx, colors, "Cross-entropy, all pairs", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "vs steps", x + pw, y - 10, colors.ink3, colors.fsXs, "right");

      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g += 1) {
        const gy = Math.round(ar.y + (ar.h * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(ar.x, gy);
        ctx.lineTo(ar.x + ar.w, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(ar.x + 0.5, ar.y);
      ctx.lineTo(ar.x + 0.5, ar.y + ar.h + 0.5);
      ctx.lineTo(ar.x + ar.w, ar.y + ar.h + 0.5);
      ctx.stroke();
      ctx.restore();

      text(ctx, colors, "0", ar.x - 5, ar.y + ar.h, colors.ink3, colors.fsXs, "right");
      text(ctx, colors, Math.round(top).toString(), ar.x - 5, ar.y + 1,
        colors.ink3, colors.fsXs, "right", "top");

      /* THE FLOOR, drawn because the curve lands on it and a reader is owed the
         reason. It is the entropy of the graph — the part of the cross-entropy
         that is a property of the DATA and not of the picture — and the descent
         cannot go under it however well it fits. Drawn from the start rather
         than revealed, because it is a property of the frame and not of the
         reader's progress. */
      const fy = py(state.floor);
      ctx.save();
      ctx.strokeStyle = colors.reference;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ar.x, fy);
      ctx.lineTo(ar.x + ar.w, fy);
      ctx.stroke();
      ctx.restore();
      text(ctx, colors, "lower bound", ar.x + ar.w - 2, fy - 3,
        colors.ink3, colors.fsXs, "right", "bottom");

      /* THROUGH THE COMPLETED STEPS ONLY, so the chart starts empty and grows —
         the same reveal widgets 20 and 21 use, and what keeps the widget from
         opening on its own answer (non-negotiable 4). The frame is drawn from
         the start, which gives a scrub something to aim at without showing
         where the curve goes. */
      const live = lerp(state.curve[anim.k], state.curve[Math.min(anim.k + 1, total)],
        anim.moving ? easeIO(anim.t) : 0);
      ctx.save();
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(px(0), py(state.curve[0]));
      for (let k = 1; k <= anim.k; k += 1) ctx.lineTo(px(k), py(state.curve[k]));
      if (anim.moving) ctx.lineTo(px(anim.k + easeIO(anim.t)), py(live));
      ctx.stroke();
      ctx.restore();

      const hx = px(anim.k + (anim.moving ? easeIO(anim.t) : 0));
      ctx.save();
      ctx.fillStyle = colors.empirical;
      ctx.beginPath();
      ctx.arc(hx, py(live), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* THE HINT AND THE TOTAL NEVER SHARE THE LINE, by construction rather
         than by measuring — widget 21 found they print through each other in a
         half-width cell at 550 and 640px, which is the width the fingerprint
         harness records at. */
      if (anim.k === 0) {
        text(ctx, colors, "click to jump", ar.x, ar.y + ar.h + 5,
          colors.ink3, colors.fsXs, "left", "top");
      } else {
        text(ctx, colors, `${anim.k * PER_STEP} steps`, ar.x, ar.y + ar.h + 5,
          colors.ink3, colors.fsXs, "left", "top");
        text(ctx, colors, `of ${total * PER_STEP}`, ar.x + ar.w, ar.y + ar.h + 5,
          colors.ink3, colors.fsXs, "right", "top");
      }
    }
  },

  readout({ params, state, anim }) {
    const { pts, curve, n, gs, groups, neighbours, clamped, legal, edgeCount, meanMu } = state;
    const Y = shownAt(state, anim);
    const total = state.path.length - 1;
    const out = [];

    if (!params.graph) {
      return [{
        label: "Samples",
        value: String(n),
        note: `${groups} groups of ${state.per}, on a sphere in three dimensions`,
      }];
    }

    out.push({
      label: "Edges",
      value: String(edgeCount),
      note: `of ${(n * (n - 1)) / 2} possible pairs, mean membership ${meanMu.toFixed(2)}`,
    });

    if (!params.flatten) {
      out.push({
        label: "Neighbours",
        value: String(neighbours),
        note: "nearest neighbours per sample — n_neighbors",
      });
      return out;
    }

    out.push({
      label: "Cross-entropy",
      value: curve[anim.k].toFixed(1),
      note: anim.k === 0
        ? `after the projection, before any gradient step; lower bound ${state.floor.toFixed(1)}`
        : `after ${anim.k * PER_STEP} of ${total * PER_STEP} steps; lower bound ${state.floor.toFixed(1)}`,
    });

    /* THE TWO HALVES OF THE SENTENCE, side by side, so moving `minDist` shows
       one move and the other stay still. That is the whole widget in two
       tiles. */
    /* THE NUMBER THAT SAYS WHAT UMAP ADDS, and nothing else in the arc states
       it. The flattening alone — widget 19's plane, which is where this one
       starts — already keeps about two thirds of every sample's neighbourhood.
       What the descent buys is the rest, and a reader who has just watched the
       cloud rotate flat can see the tile move as they press Settle. */
    const kept = neighboursKept(pts, Y);
    out.push({
      label: "Neighbours kept",
      value: `${Math.round(kept * 100)}%`,
      note: `of each sample's 3 nearest in 3-D, still nearest here; `
        + `${Math.round(state.keptFlat * 100)}% after the projection alone`,
    });
    out.push({
      label: "Spread over gap",
      value: tightness(Y, gs, groups).toFixed(3),
      note: "mean cluster radius over the mean distance between cluster centres",
    });

    if (clamped) {
      out.push({
        label: "Neighbours",
        value: String(neighbours),
        note: `${n} samples allow at most ${legal}; umap-learn clamps silently`,
      });
    }
    return out;
  },

  summary({ params, state, anim }) {
    const { n, groups, per, neighbours, curve, gs } = state;
    const told = params.labels === "on";
    const stock = `${n} samples in ${groups} groups of ${per}, on a sphere in three dimensions, `
      + (told ? "coloured by group" : "all one colour so the grouping is not given away")
      + `, turned ${params.turn} degrees and tilted ${params.tilt}.`;
    if (!params.graph) return `${stock} No neighbour graph has been built yet.`;
    const base = `${stock} Each sample is joined to its ${neighbours} nearest neighbours, `
      + `${state.edgeCount} weighted edges in all.`;
    if (!params.flatten) return `${base} The graph has not been laid out in two dimensions yet.`;
    const total = state.path.length - 1;
    const where = anim.k === 0
      ? "projected onto its two most-spread directions and not yet optimised"
      : `after ${anim.k * PER_STEP} of ${total * PER_STEP} gradient steps`;
    const Y = shownAt(state, anim);
    return `${base} Beside it the same graph in two dimensions, ${where}. Below, the `
      + `cross-entropy of a single pair against the distance it is drawn at, and the `
      + `cross-entropy over all pairs against steps: ${curve[anim.k].toFixed(1)} now, `
      + `against a lower bound of ${state.floor.toFixed(1)}. `
      + `${Math.round(neighboursKept(state.pts, Y) * 100)}% of each sample's three nearest `
      + `neighbours in three dimensions are still its nearest here, and the clusters have a `
      + `mean radius ${tightness(Y, gs, groups).toFixed(3)} of the mean gap between them.`;
  },
});
