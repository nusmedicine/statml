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
   +0.026 and cluster tightness by x2.16; `n_neighbors` over its range moves
   retention by +0.490. A nineteenfold difference on the same measure, and the
   two controls sit next to each other so a reader can find out which is which.

   The solver is `./model.js`, a separate module so `_lab/umap-verify.mjs` can
   import it in node — WHAT IS VERIFIED IS WHAT SHIPS. Against umap-learn
   0.5.12: rho bit-exact at float32 on 200 of 200 values, sigma on 199, mu to
   2.4e-5, a and b to 4.7e-6.

   Design record, and every constant here, in docs/catalogue.md § NEXT · UMAP.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { fuzzySet, findAbParams, umap } from "./model.js";

/* The stage is widget 21's, unchanged: `groups` centres on a sphere of radius
   R, `per` samples scattered around each by SIGMA. Nothing in UMAP forces 48
   the way Rtsne's `3 * perplexity < n - 1` forced it for t-SNE — the reason to
   keep it is the ARC. The same cloud under four methods is what makes widgets
   19 to 22 comparable, and the n_neighbors sweep still has room in it: eight
   legal settings differing by 0.50 in retention. */
const R = 2;
const SIGMA = 0.62;
const JITTER = 0.12;

/* 500 iterations, revealed 10 at a time. A step CANNOT be one iteration: at
   n = 48 one iteration gives 5-NN retention 0.116 and silhouette -0.119, a
   picture that puts the groups inside each other. It is honest from about 300
   (0.787 / 0.698), settled by 500 (0.805 / 0.774), and 800 buys 0.006. */
const ITERS = 500;
const PER_STEP = 10;

/* THE LEARNING RATE IS 0.1 AND THAT IS A MEASURED CHOICE WITH A MEASURED COST.
   A full-batch gradient does not need the large steps a stochastic one does, so
   a small eta is the appropriate setting — and the consequence is the first
   clean objective curve in this arc. Widget 20's raw stress and widget 21's KL
   both rose often enough to need explaining away; t-SNE's rises on 139 of 1000
   steps. Six seeds, 500 iterations:

     eta     CE rises    final CE    retention    tightness
     1.0      206/500       186.4        0.822        0.080
     0.25     147/500       187.3        0.826        0.092
     0.1        8/500       190.3        0.803        0.102
     0.05       0/500       208.5        0.794        0.156

   Two per cent of the objective for a chart that descends. 0.05 buys the last
   eight rises for ten per cent and a visibly looser picture, which is too much. */
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

function spread(n) {
  if (n === 2) return [[0, 0, R], [0, 0, -R]];
  if (n === 3) {
    return [0, 1, 2].map((k) => {
      const a = (2 * Math.PI * k) / 3;
      return [R * Math.cos(a), R * Math.sin(a), 0];
    });
  }
  const c = R / Math.sqrt(3);
  return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => scale3(v, c));
}

const gauss = (rng) =>
  Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

function stage(groups, per, rng) {
  const out = [];
  const centres = spread(groups).map((p) => {
    const v = [0, 1, 2].map((k) => p[k] + gauss(rng) * JITTER * R);
    const m = Math.hypot(v[0], v[1], v[2]) || 1;
    return v.map((x) => (x / m) * R);
  });
  for (let g = 0; g < groups; g += 1) {
    for (let i = 0; i < per; i += 1) {
      out.push({ g, p: centres[g].map((x) => x + gauss(rng) * SIGMA) });
    }
  }
  return out;
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
   the half min_dist DOES move — x2.16 across its range on ten seeds. */
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

/* The manifold, and here it is not decoration: cell 41's analogy is a globe
   flattened to a map, so the sphere the samples sit on is the thing being
   flattened. Widget 21 drew the same wireframe for a different reason. */
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
        if ((dot(p, eye) >= 0) !== front) { drawing = false; continue; }
        const [x, y] = P(p);
        if (drawing) ctx.lineTo(x, y); else { ctx.moveTo(x, y); drawing = true; }
      }
      ctx.stroke();
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
  subtitle: "Join every sample to its neighbours, then flatten the graph like a globe onto a map. Two controls: one changes what UMAP knows, the other only how tightly it draws — and telling them apart is the whole of reading a UMAP plot.",
  status: "draft",
  layout: "side",
  height: ({ w, flatten }) => layout(w, !!flatten).height,

  /* THE KEY IS `token`, NOT `swatch`, and getting it wrong fails SILENTLY —
     core writes `var(--c-${item.token}, var(--${item.token}))`, so an unknown
     key leaves every swatch the same default grey. Widget 21 shipped that way
     and a human found it on screen; no check in this repo would have.

     These have to read true with the labels BOTH off and on, because core takes
     the legend once at build time rather than per render. */
  legend: [
    { token: "ink-2", label: "an edge — how strongly two samples are joined", mark: "line" },
    { token: "empirical", label: "the cross-entropy, falling", mark: "line" },
    { token: "highlight", label: "the sample the bottom-left curves are about", mark: "dot" },
    /* THE BOTTOM-LEFT PANEL'S WHOLE EXPLANATION, and it lives here because the
       legend is DOM and wraps where a canvas caption in a 192px cell cannot. */
    { token: "ink-3", label: "each curve is ONE link — what that pair pays at every distance, and the dot is the distance it wants", mark: "line" },
  ],

  params: {
    /* OFF BY DEFAULT, so the reader reads the clusters off the picture before
       being told what they are — the notebook's own order (both hosts plot
       every method twice, once bare and once coloured by type), and
       non-negotiable 4 applied to knowledge rather than to the figure. */
    labels: {
      type: "segmented",
      label: "Labels",
      options: [
        { value: "off", label: "Off", detail: "how many clusters can you see?" },
        { value: "on", label: "On", detail: "colour shows the group each sample really came from" },
      ],
      default: "off",
      display: true,
    },
    groups: {
      type: "choice",
      label: "Groups",
      options: [
        { value: "2", label: "2", detail: "two clusters" },
        { value: "3", label: "3", detail: "three clusters" },
        { value: "4", label: "4", detail: "four clusters, spread through space" },
      ],
      default: "4",
    },
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [
        { value: "3", label: "3", detail: "the R lesson's own scale — 8 samples of airway" },
        { value: "6", label: "6", detail: "enough for n_neighbors to start mattering" },
        { value: "12", label: "12", detail: "the whole useful range of n_neighbors is reachable" },
      ],
      default: "12",
    },

    /* THE FIRST OF THE LESSON'S TWO CONTROLS, and the one that changes what
       UMAP KNOWS. Swept 2 to 40 it moves 5-NN retention by +0.490, up on 10 of
       10 seeds — and NOT monotonically: retention reads 0.332 at 2, 0.677 at 5,
       0.805 at 15, 0.822 at 40, while the silhouette turns over and comes back
       down. There is an optimum in the middle, and PHM5003's own setting of 3
       is at the shattering end because 8 samples leave nowhere else to be. */
    neighbours: {
      type: "int",
      label: "Neighbours",
      min: 2,
      max: 40,
      default: 15,
      detail: "how many others each sample is joined to — the lesson's n_neighbors",
    },

    /* THE SECOND, and the one the widget is about. Over the same sweep it moves
       retention by +0.026 — inside the seed noise on 8 of 10 seeds — while
       moving how tight the clusters LOOK by x2.16, looser on 10 of 10.

       NOT `display: true`, however much it behaves like a presentation control.
       It feeds `compute()`: a and b change, the descent is different, the
       arrangement moves. Marking it display to preserve the reader's position
       would be a widget lying about itself (non-negotiable 1). That it changes
       the picture without changing the knowledge is the LESSON, not a licence
       to skip the recompute. */
    packing: {
      type: "float",
      label: "Packing",
      min: 0,
      max: 0.95,
      step: 0.05,
      default: 0.1,
      detail: "how much room the picture must leave between points — the lesson's min_dist",
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
      label: "Join the neighbours",
      labelOff: "Clear the graph",
      detail: "draw each sample's neighbourhood, and an edge wherever two are joined",
      display: true,
    },
    flatten: {
      type: "gate",
      label: "Flatten it",
      labelOff: "Back to the cloud",
      detail: "lay the same graph out in two dimensions, like a globe onto a map",
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
      max: 47,
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
    const { a, b } = findAbParams(1, params.packing);
    const { frames: path, curve } = umap(pts, {
      nNeighbors: neighbours, iters: ITERS, every: PER_STEP,
      eta: ETA, seed: params.seed, mu, ab: { a, b },
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
    const edgeList = [];
    for (let i = 0; i < n; i += 1)
      for (let j = i + 1; j < n; j += 1) if (mu[i][j] > 1e-9) edgeList.push(mu[i][j]);

    return {
      n, groups, per, gs, pts, path, curve, mu, rho, sigma, a, b,
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
    stepLabel: "Settle",
    stepTitle: `Run ${PER_STEP} more gradient steps`,
    runLabel: "Play",
    runTitle: "Keep going until the arrangement stops moving",

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
    },

    advance(anim, { dt, state }) {
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
        text(ctx, colors, "membership from the data", x + pw, y - 10,
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
        text(ctx, colors,
          joined ? "click a sample, drag to turn — then flatten it"
            : "drag to turn the cloud. How many clusters can you see?",
          x, y + ph + 8, colors.ink3, colors.fsXs, "left", "top");
      }
    }

    if (!open) return;

    arrow(ctx, colors, L.arrow, 0.9);

    /* ---- the same graph, flattened ---------------------------------------- */
    {
      const { x, y, w: pw, h: ph } = L.flat;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 16) / state.span2;

      text(ctx, colors, "2-D space", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "membership in the picture", x + pw, y - 10,
        colors.ink3, colors.fsXs, "right");

      /* The axes are named UMAP1 and UMAP2 and carry NO ticks, deliberately.
         They have no units: the arrangement's size is arbitrary, and a scale
         would invite exactly the reading — "these two clusters are three
         apart" — that this widget exists to break. `03-5` cell 41 lists
         "Interpretation of axes is not straightforward" among UMAP's
         limitations; this is that, drawn. */
      ctx.save();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      const ax = Math.round(x + 12) + 0.5, ay = Math.round(y + ph - 14) + 0.5;
      ctx.beginPath();
      ctx.moveTo(ax, y + 8);
      ctx.lineTo(ax, ay);
      ctx.lineTo(x + pw - 8, ay);
      ctx.stroke();
      ctx.restore();
      text(ctx, colors, "UMAP1", x + pw - 8, ay + 10, colors.ink3, colors.fsXs, "right", "top");

      const at = (i) => [cx + Y[i][0] * S, cy - Y[i][1] * S];

      /* THE LOW-D HALO IS IN THE ARRANGEMENT'S OWN UNITS, which is a thing
         widget 21 could not do: t-SNE's kernel and its output scale are
         unrelated, so its 2-D halo used an invented unit. Here the membership
         1/(1 + a d^2b) is a function of a distance IN THIS PANEL, so the rings
         can be drawn at their true radii and `packing` visibly moves them.
         There is no flat top — w = 1 only at d = 0 — and that asymmetry with
         the panel on the left is the rho subtraction, drawn. */
      for (let i = 0; i < n; i += 1) {
        const [px, py] = at(i);
        const rs = [0.75, 0.5, 0.25].map((h) => dStar(h, a, b) * S);
        halo(ctx, col(i), px, py, rs, haloA * 0.85);
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
      text(ctx, colors, "What one link pays", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "at this distance", x + pw, y - 10,
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
         `packing` cannot move. Drawn as the strongest of three it read as the
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
           `packing` is the only thing that moves it. */
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
             link whose ideal distance that dot IS, so moving `packing` shows a
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
          : `sample ${picked + 1} has only μ = 1 links`,
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
         and not two different things called cross-entropy. Both pairs were
         measured to fit the narrowest column the layout produces — 203px at a
         520px viewport — rather than chosen and hoped for. */
      text(ctx, colors, "What every link pays", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "added up", x + pw, y - 10, colors.ink3, colors.fsXs, "right");

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
        note: `${groups} groups of ${state.per}, in three genes — join them up to start`,
      }];
    }

    out.push({
      label: "Edges",
      value: String(edgeCount),
      note: `of ${(n * (n - 1)) / 2} possible pairs, mean strength ${meanMu.toFixed(2)}`,
    });

    if (!params.flatten) {
      out.push({
        label: "Neighbours",
        value: String(neighbours),
        note: "each sample is joined to this many — flatten the graph to see what survives",
      });
      return out;
    }

    out.push({
      label: "Cross-entropy",
      value: curve[anim.k].toFixed(1),
      note: anim.k === 0
        ? "the random start, before any step"
        : `after ${anim.k * PER_STEP} of ${total * PER_STEP} gradient steps`,
    });

    /* THE TWO HALVES OF THE SENTENCE, side by side, so moving `packing` shows
       one move and the other stay still. That is the whole widget in two
       tiles. */
    out.push({
      label: "Neighbours kept",
      value: `${Math.round(neighboursKept(pts, Y) * 100)}%`,
      note: "of each sample's three nearest in 3-D, how many are still nearest here — what UMAP KNOWS",
    });
    out.push({
      label: "How tight it looks",
      value: tightness(Y, gs, groups).toFixed(3),
      note: "cluster width over the gaps between them — smaller looks more convincing, and packing is what sets it",
    });

    if (clamped) {
      out.push({
        label: "Neighbours",
        value: String(neighbours),
        note: `${n} samples allow at most ${legal} — umap-learn clamps here without saying so`,
      });
    }
    return out;
  },

  summary({ params, state, anim }) {
    const { n, groups, per, neighbours, curve, gs } = state;
    const view = `Turned ${params.turn} degrees, tilted ${params.tilt}.`;
    const told = params.labels === "on";
    const stock = `${n} samples in ${groups} groups of ${per}`;
    const shown = told
      ? "coloured by the group each really came from"
      : "all drawn the same colour, so the grouping is not given away";
    const total = state.path.length - 1;
    if (!params.graph) {
      return `${stock}, in three genes, on a sphere, ${shown}. ${view} Nothing has been `
        + `joined up yet: the neighbour graph is not drawn and there is no arrangement.`;
    }
    const base = `${stock}, in three genes, ${shown}, each wearing the neighbourhood `
      + `${neighbours} neighbours give it and joined to the others by ${state.edgeCount} `
      + `weighted edges. ${view}`;
    if (!params.flatten) {
      return `${base} The graph has not been flattened yet.`;
    }
    const where = anim.k === 0
      ? "the random start, before any gradient step"
      : `after ${anim.k * PER_STEP} of ${total * PER_STEP} gradient steps`;
    const Y = shownAt(state, anim);
    return `${base} Beside it the same graph laid out in two dimensions, ${where}, `
      + `its edges unchanged and its halos drawn from the low-dimensional kernel that `
      + `packing ${params.packing} sets. Underneath, the cross-entropy a single pair pays `
      + `at each distance in the picture, and the cross-entropy of the whole arrangement `
      + `falling — ${curve[anim.k].toFixed(1)} now. `
      + `${Math.round(neighboursKept(state.pts, Y) * 100)}% of each sample's three nearest `
      + `neighbours survived the flattening, and the clusters draw at `
      + `${tightness(Y, gs, groups).toFixed(3)} of the gaps between them.`;
  },
});
