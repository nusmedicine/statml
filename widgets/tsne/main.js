/* ============================================================================
   t-SNE — t-distributed stochastic neighbour embedding.

   TWO HOSTS, ONE IN EACH COURSE, the second widget with that after widget 20:
     PHM5003 `05 / 04 - Dimensionality Reduction.ipynb`, heading `## 4`,
       cells 39-45 — R, `Rtsne`, and the source of this widget's shape. Its
       cell 40 gives three formulas and three figures, and they are the four
       panels below. Cell 41 links distill.pub's "How to Use t-SNE Effectively".
     PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 31-40 — Python,
       `sklearn.manifold.TSNE`.

   THE LAYOUT IS KENNETH'S DIAGRAM, quadrant for quadrant: the two spaces on
   top with an arrow between them, the two probability curves underneath. That
   puts the cloud BESIDE the arrangement, which widget 20 forbids — there the
   diagonal was what stopped a reader taking the 2-D panel for a projection of
   the 3-D one. Here the arrow does that work instead, and the diagram is the
   agreed mock-up. Widget 19 was rebuilt twice for drifting from one.

   THE HALO IS THE MECHANISM. Every sample wears one: a Gaussian in 3-D whose
   width is the sigma perplexity picks for that point, and a Student-t in 2-D
   with its heavier tail. Moving `perplexity` moves every 3-D halo, and that is
   the whole of what the control does.

   Design record, and every constant here, in docs/catalogue.md under NEXT.
   The solver is `_lab/tsne-engine.js`, verified against scikit-learn 1.9.0 —
   P to 5.6e-9, KL to 3e-9, the gradient identical.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { makePlot } from "../core/canvas.js";

/* The stage: `groups` centres on a sphere of radius R, `per` samples scattered
   around each by SIGMA. Four times MDS's sample count, and Rtsne forced it —
   the library refuses to run at 3 * perplexity >= n - 1, so at twelve samples
   there are two legal perplexities and they differ by 0.06. At forty-eight the
   same measurement swings 0.09 -> 0.66 -> 0.58 across the legal range. */
const R = 2;
const SIGMA = 0.62;
const JITTER = 0.12;

/* Iterations, and the full thousand is needed rather than tidy: at n = 48 the
   silhouette of the true groups reads 0.21 at 250 steps, 0.02 at 300, 0.23 at
   400, 0.50 at 600 and 0.66 at 1000. A step of the animation is 25 of them, so
   forty steps cross the run — one gradient step per press would need a thousand
   presses and every early one would show a picture the method disowns. */
const ITERS = 1000;
const PER_STEP = 25;
/* Early exaggeration, released at 250 — what both libraries do. It is worth
   keeping at this size and would not have been at MDS's: at n <= 12 it moves
   the silhouette from 0.980 to 0.972, i.e. nothing, but at n = 48 it is 0.574
   with against 0.484 without and helps on 13 of 20 seeds. */
const EXAG = 12;
const EXAG_UNTIL = 250;
const ETA = 200;

/* --- 3-vector arithmetic, as widgets 19 and 20 have -------------------------- */
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

/* `shape` decides whether there is anything to find. "groups" is the honest
   stage; "cloud" is one round Gaussian with NO groups in it, and it is the
   failing case — measured over 40 seeds, the best two-way split a reader could
   see in the t-SNE picture scores 0.634 +- 0.104 against the same cloud's
   0.447 +- 0.057 under a plain projection, higher on 38 of 40. It is worst at
   low perplexity and decays toward the projection's value as perplexity rises,
   which is exactly what the distill.pub article cell 41 links is about. */
function stage(shapeName, groups, per, rng) {
  const out = [];
  if (shapeName === "cloud") {
    const n = groups * per;
    for (let i = 0; i < n; i += 1) {
      out.push({ g: 0, p: [0, 1, 2].map(() => gauss(rng) * R * 0.62) });
    }
    return out;
  }
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

/* --- the method, and it is the notebook's cell 40 in order ------------------ */

function sqDists(X) {
  const n = X.length;
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < X[i].length; k += 1) { const d = X[i][k] - X[j][k]; s += d * d; }
      D[i][j] = s; D[j][i] = s;
    }
  }
  return D;
}

/* p(j|i), the first formula: a Gaussian around each sample, and its width is
   chosen per sample so that the neighbour distribution has exactly the
   requested perplexity. That is why perplexity is a COUNT OF NEIGHBOURS rather
   than a distance — a sample in a crowd gets a tight sigma and one out on its
   own gets a wide one, and both end up caring about the same NUMBER of others.
   The panel draws these sigmas as the halos.

   The tolerance is 1e-5 because that is sklearn's. Verified: our P agrees with
   the library's to between 1.6e-10 and 5.6e-9, and tightening this PAST 1e-5
   makes agreement WORSE (2.0e-7), because it walks us off sklearn's own
   truncation and onto the exact answer. _lab/tsne-verify.mjs carries the sweep. */
function condP(D, perplexity) {
  const n = D.length, target = Math.log(perplexity);
  const P = Array.from({ length: n }, () => new Float64Array(n));
  const sigmas = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let lo = -Infinity, hi = Infinity, beta = 1;
    for (let it = 0; it < 50; it += 1) {
      let sum = 0, num = 0;
      for (let j = 0; j < n; j += 1) {
        if (j === i) { P[i][j] = 0; continue; }
        const p = Math.exp(-beta * D[i][j]);
        P[i][j] = p; sum += p; num += beta * D[i][j] * p;
      }
      if (sum === 0) sum = 1e-12;
      const H = Math.log(sum) + num / sum;
      if (Math.abs(H - target) < 1e-5) break;
      if (H > target) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; }
      else { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
    }
    /* THE ROW SUM IS TAKEN ONCE, BEFORE ANY DIVISION. Recomputing it inside the
       divide loop shrinks it as it goes, so P never sums to 1 — and the
       gradient below is derived assuming it does. A wrong P is consistent
       between an analytic gradient and a numerical one, so only a numerical
       check catches it, and one did. */
    let rs = 0;
    for (let k = 0; k < n; k += 1) rs += P[i][k];
    if (rs === 0) rs = 1e-12;
    for (let j = 0; j < n; j += 1) P[i][j] /= rs;
    sigmas[i] = Math.sqrt(1 / (2 * beta));
  }
  return { P, sigmas };
}

const joint = (Pc) => {
  const n = Pc.length, P = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) P[i][j] = (Pc[i][j] + Pc[j][i]) / (2 * n);
  return P;
};

/* q(ij), the second formula, and the gradient of the third. The Student-t with
   one degree of freedom is (1 + d^2)^-1: same shape as a Gaussian near zero,
   far heavier in the tail, which is what lets the picture push unlike points
   apart without paying for it. */
function qAndGrad(Y, P) {
  const n = Y.length;
  const W = Array.from({ length: n }, () => new Float64Array(n));
  let Z = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
      const w = 1 / (1 + dx * dx + dy * dy);
      W[i][j] = w; W[j][i] = w; Z += 2 * w;
    }
  }
  if (Z === 0) Z = 1e-12;
  const G = Array.from({ length: n }, () => [0, 0]);
  let kl = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const q = Math.max(W[i][j] / Z, 1e-12);
      const m = 4 * (P[i][j] - q) * W[i][j];
      G[i][0] += m * (Y[i][0] - Y[j][0]);
      G[i][1] += m * (Y[i][1] - Y[j][1]);
      if (P[i][j] > 0) kl += P[i][j] * Math.log(P[i][j] / q);
    }
  }
  return { G, kl };
}

/* The descent both libraries run. Every iterate is kept, so the animation is a
   reveal of already-computed data (invariant 2) — nothing here runs per frame.
   1000 iterations at n = 48 cost 55ms, which is why this widget computes rather
   than replaying a table, and why perplexity can be a live control at all. */
function descend(pts, perplexity, rng) {
  const n = pts.length;
  const { P: Pc, sigmas } = condP(sqDists(pts), perplexity);
  const P0 = joint(Pc);
  let Y = Array.from({ length: n }, () => [gauss(rng) * 1e-4, gauss(rng) * 1e-4]);
  const up = Array.from({ length: n }, () => [0, 0]);
  const gains = Array.from({ length: n }, () => [1, 1]);
  const path = [Y.map((p) => p.slice())];
  const kl = [qAndGrad(Y, P0).kl];
  for (let it = 0; it < ITERS; it += 1) {
    const ex = it < EXAG_UNTIL ? EXAG : 1;
    const P = ex === 1 ? P0 : P0.map((r) => r.map((v) => v * ex));
    const { G } = qAndGrad(Y, P);
    const mom = it < EXAG_UNTIL ? 0.5 : 0.8;
    for (let i = 0; i < n; i += 1) {
      for (let d = 0; d < 2; d += 1) {
        gains[i][d] = Math.sign(G[i][d]) !== Math.sign(up[i][d])
          ? gains[i][d] + 0.2 : Math.max(gains[i][d] * 0.8, 0.01);
        up[i][d] = mom * up[i][d] - ETA * gains[i][d] * G[i][d];
        Y[i][d] += up[i][d];
      }
    }
    const mx = Y.reduce((s, p) => s + p[0], 0) / n, my = Y.reduce((s, p) => s + p[1], 0) / n;
    for (const p of Y) { p[0] -= mx; p[1] -= my; }
    if ((it + 1) % PER_STEP === 0) {
      path.push(Y.map((p) => p.slice()));
      /* ALWAYS AGAINST THE PLAIN P, never against the exaggerated one the step
         was actually minimising. That number is ~45 during exaggeration and ~2
         after, and one axis cannot hold both — the same reason widget 20 had to
         choose between raw stress and stress-1. The consequence is honest and
         visible: the curve WANDERS for the first quarter, because for 250 steps
         t-SNE is deliberately not minimising the thing it reports. */
      kl.push(qAndGrad(Y, P0).kl);
    }
  }
  return { path, kl, sigmas, P0 };
}

/* How much of each sample's neighbourhood survived into the picture: of its
   three nearest in three dimensions, how many are still among its three nearest
   in two. This is the one number a t-SNE plot can honestly be judged on. */
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

/* --- layout ---------------------------------------------------------------- *
 * One function, read by both `height` and `draw`, so the two cannot drift.
 *
 * KENNETH'S DIAGRAM, quadrant for quadrant:
 *
 *      3D space   --->   2D space
 *      Gaussian          Student's t
 *
 * The bottom row is ONE plot spanning both columns rather than two side by
 * side, and that is a deliberate correction to the notebook's own figures:
 * `tsne-high.png` peaks at 0.4 and `tsne-low.png` at 1.0, so drawn apart the
 * t-distribution reads as taller as well as heavier-tailed. Only the tail is
 * the point. On one axis, with the Gaussian dashed underneath, the comparison
 * is the picture rather than something the reader has to do in their head. */
const PAD_L = 14, PAD_R = 14, GAP = 34, TOP = 26, ROW_GAP = 40, BOT = 34;
const CELL_MAX = 340;

function layout(w) {
  const colW = Math.min(CELL_MAX, Math.max(40, (w - PAD_L - PAD_R - GAP) / 2));
  const rowH = colW * 0.82;
  const x0 = Math.max(PAD_L, (w - (colW * 2 + GAP)) / 2);
  const x1 = x0 + colW + GAP;
  const y1 = TOP + rowH + ROW_GAP;
  /* The curve row is shorter than the spaces row: it carries two lines and an
     axis, where the panels above carry a whole cloud. */
  const curveH = Math.max(96, rowH * 0.62);
  return {
    side: Math.min(colW, rowH),
    space: { x: x0, y: TOP, w: colW, h: rowH },
    flat: { x: x1, y: TOP, w: colW, h: rowH },
    arrow: { x: x0 + colW, y: TOP + rowH / 2, w: GAP },
    curves: { x: x0, y: y1, w: colW * 2 + GAP, h: curveH },
    height: TOP + rowH + ROW_GAP + curveH + BOT,
  };
}

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

/* THE HALO, and it is the same object in both panels drawn from two different
   kernels — which is the whole of what t-SNE does. Three rings at the quarter,
   half and three-quarter heights of the kernel, so the SHAPE of the falloff is
   visible rather than just a radius: the Gaussian's rings crowd together and
   the t's spread out, because the t has the heavier tail. */
function halo(ctx, col, cx, cy, radii, alpha) {
  ctx.save();
  for (let k = radii.length - 1; k >= 0; k -= 1) {
    ctx.globalAlpha = alpha * (0.10 + 0.05 * (radii.length - 1 - k));
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, radii[k], 0, Math.PI * 2);
    ctx.fill();
  }
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

/* The red arrow of the diagram. It is load-bearing rather than decoration: it
   is what says the right panel was BUILT from the left rather than being a view
   of it, which is the job widget 20 gave to a diagonal. */
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

defineWidget({
  slug: "tsne",
  title: "t-SNE",
  subtitle: "Every sample carries a neighbourhood, and perplexity is how many others fit inside it. Drag the cloud to turn it, then run the descent: what survives into the picture is who is near whom, and nothing else.",
  status: "draft",
  layout: "side",
  height: ({ w }) => layout(w).height,

  legend: [
    { label: "in three genes", swatch: "--c-cluster-a" },
    { label: "the neighbourhood each sample is given", swatch: "--c-ink3" },
  ],

  params: {
    /* THE FAILING CASE IS A STAGE, not an extra panel — the same move widgets
       19 and 20 made, and the reconnaissance said it would have to be: on the
       real 194 samples every method separates the classes and nothing fails. */
    shape: {
      type: "segmented",
      label: "The samples",
      options: [
        { value: "groups", label: "In groups", detail: "clusters that genuinely exist" },
        { value: "cloud", label: "One cloud", detail: "no groups at all — one round spread" },
      ],
      default: "groups",
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
    /* Twelve per group is the default because that is where perplexity starts
       carrying an idea. Rtsne refuses to run at 3 * perplexity >= n - 1, so the
       count decides how much of the control is even reachable: at n = 12 there
       are two legal settings, at n = 48 there are fourteen. */
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [
        { value: "3", label: "3", detail: "the lesson's own scale — and too few to choose a perplexity in" },
        { value: "6", label: "6", detail: "enough for perplexity to start mattering" },
        { value: "12", label: "12", detail: "the whole legal range of perplexity is reachable" },
      ],
      default: "12",
    },
    /* THE CONTROL THAT CARRIES THE IDEA, and the only one the R lesson names.
       Its legal range is set by the sample count, not by taste: `compute`
       clamps to Rtsne's own rule and the readout says when it has. */
    perplexity: {
      type: "int",
      label: "Perplexity",
      min: 2,
      max: 15,
      default: 5,
      detail: "how many neighbours each sample is asked to care about",
    },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "moves every sample, and where the descent starts from",
    },
    /* `display: true`, for the reason widget 20 records: as a data gate this
       would be the one gate core animates, but shutting it would throw away a
       descent the reader had stepped through. */
    turn: { type: "int", label: "Turn", min: -180, max: 180, default: TURN0, display: true, hidden: true },
    tilt: { type: "int", label: "Tilt", min: -80, max: 80, default: TILT0, display: true, hidden: true },
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
    const groups = params.shape === "cloud" ? 4 : +params.groups;
    const per = +params.samples;
    const st = stage(params.shape, groups, per, rng);
    const pts = st.map((s) => s.p);
    const gs = st.map((s) => s.g);
    const n = pts.length;

    /* RTSNE'S OWN RULE, AND THE WIDGET REFUSES RATHER THAN WARNS. `Rtsne` errors
       unless 3 * perplexity < n - 1; sklearn only warns. Refusing is the right
       side to be on — a control that silently produces nonsense past a
       threshold is the failure this project exists to show, not to commit — and
       a reader who meets the limit has just learned why the lesson's cell 42
       reads `perplexity_value <- min(2, ncol(scaledData) / 3)`. */
    const legal = Math.max(2, Math.floor((n - 2) / 3));
    const perplexity = clamp(params.perplexity, 2, legal);
    const clamped = perplexity !== params.perplexity;

    const { path, kl, sigmas } = descend(pts, perplexity, rng);

    /* ONE SCALE FOR THE 2-D PANEL, covering the whole trajectory, so the frame
       never moves under the reader (2.5) and a sample never crosses an edge.
       t-SNE's output scale is arbitrary and large — a true gap of 5.2 units can
       draw as 1568 — so nothing may be read off this panel in absolute terms,
       and normalising is what keeps that honest rather than hiding it. */
    let span2 = 0;
    for (const Y of path) for (const p of Y) span2 = Math.max(span2, Math.hypot(p[0], p[1]));
    let span3 = 0;
    for (const p of pts) span3 = Math.max(span3, Math.hypot(p[0], p[1], p[2]));

    return {
      n, groups, per, gs, pts, path, kl, sigmas, perplexity, clamped, legal,
      span2: span2 * 1.08 || 1, span3: span3 * 1.1 || 1,
      klMax: Math.max(...kl) * 1.05 || 1,
    };
  },

  animation: {
    stepLabel: "Descend",
    stepTitle: `Run ${PER_STEP} more gradient steps`,
    runLabel: "Play",
    runTitle: "Keep going until the picture settles",

    init: ({ params, state, fromScratch }) => {
      const total = state.path.length - 1;
      const pre = fromScratch ? 0 : clamp(params.shown | 0, 0, total);
      return { k: pre, t: 1, moving: false, done: pre >= total };
    },

    rebuild: (anim, { state }) => {
      const total = state.path.length - 1;
      if (anim.k > total) { anim.k = total; anim.moving = false; anim.t = 1; }
      anim.done = anim.k >= total;
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
    const L = layout(w);
    const { n, gs, pts, sigmas } = state;
    const Y = shownAt(state, anim);
    const col = (i) => sampleCol(colors, gs[i]);
    /* The halo fades as the descent runs: at the start it is the whole story,
       by the end the reader is looking at the arrangement. It never goes to
       zero, because it is what the picture was built out of. */
    const started = anim.k / Math.max(1, state.path.length - 1);
    const haloA = 1 - 0.45 * started;

    /* ---- top left: the samples, in three genes, wearing Gaussian halos ---- */
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
      text(ctx, colors, "Gaussian", x + pw, y - 10, colors.ink3, colors.fsXs, "right");

      if (params.shape !== "cloud") globe(ctx, colors, P, eye, R, 0.7);

      /* Depth-sorted so a near sample covers a far one, and the halo is drawn
         with its own dot so the two cannot separate. */
      const order = pts.map((p, i) => [dot(p, eye), i]).sort((a, b) => a[0] - b[0]);
      for (const [depth, i] of order) {
        const [px, py] = P(pts[i]);
        const fade = 0.55 + 0.45 * clamp01((depth / state.span3 + 1) / 2);
        /* The three rings are the quarter, half and three-quarter heights of a
           Gaussian of this sample's own sigma: r = sigma * sqrt(-2 ln h). */
        const rs = [0.75, 0.5, 0.25].map((h) => sigmas[i] * Math.sqrt(-2 * Math.log(h)) * S);
        halo(ctx, col(i), px, py, rs, haloA * fade);
      }
      for (const [depth, i] of order) {
        const [px, py] = P(pts[i]);
        const fade = 0.55 + 0.45 * clamp01((depth / state.span3 + 1) / 2);
        sampleDot(ctx, colors, px, py, col(i), R_DOT, fade);
      }
    }

    arrow(ctx, colors, L.arrow, 0.9);

    /* ---- top right: the picture, wearing Student-t halos ------------------ */
    {
      const { x, y, w: pw, h: ph } = L.flat;
      const cx = x + pw / 2, cy = y + ph / 2;
      const S = (L.side / 2 - 16) / state.span2;

      text(ctx, colors, "2-D space", x, y - 10, colors.ink2, colors.fsSm);
      text(ctx, colors, "Student's t", x + pw, y - 10, colors.ink3, colors.fsXs, "right");

      /* The axes are named TSNE1 and TSNE2 and carry NO ticks, deliberately.
         They have no units: the arrangement's size is arbitrary, and a scale on
         them would invite exactly the reading — "these two clusters are three
         apart" — that this widget exists to break. */
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
      text(ctx, colors, "TSNE1", x + pw - 8, ay + 10, colors.ink3, colors.fsXs, "right", "top");

      /* Same three heights as the 3-D halo, from the t kernel instead:
         (1 + r^2)^-1 = h  =>  r = sqrt(1/h - 1). The rings come out further
         apart than the Gaussian's, which is the heavier tail, drawn. */
      const unit = S * (state.span2 / 3);
      for (let i = 0; i < n; i += 1) {
        const px = cx + Y[i][0] * S, py = cy - Y[i][1] * S;
        const rs = [0.75, 0.5, 0.25].map((h) => Math.sqrt(1 / h - 1) * unit);
        halo(ctx, col(i), px, py, rs, haloA * 0.85);
      }
      for (let i = 0; i < n; i += 1) {
        sampleDot(ctx, colors, cx + Y[i][0] * S, cy - Y[i][1] * S, col(i));
      }
    }

    /* ---- bottom: the two kernels on ONE axis ------------------------------ */
    {
      const { x, y, w: pw, h: ph } = L.curves;
      const plot = makePlot({
        ctx, colors,
        rect: { x: x + 34, y, w: pw - 44, h: ph - 24 },
        xDomain: [0, 3.2],
        yDomain: [0, 1.05],
      });
      plot.grid([0.25, 0.5, 0.75, 1]);
      plot.axisX({ ticks: [0, 1, 2, 3], label: "Distance between two samples" });
      plot.axisY({ ticks: [0, 0.5, 1], label: "Similarity" });

      /* BOTH NORMALISED TO 1 AT ZERO, which is the correction to the notebook's
         own pair of figures: drawn from their own formulas the Gaussian peaks
         at 0.4 and the t at 1.0, so the t reads as taller as well as
         heavier-tailed. Only the tail is the point, and scaling both to the
         same height is what makes the tail the only visible difference. */
      const gaussCurve = [], tCurve = [];
      for (let k = 0; k <= 120; k += 1) {
        const d = (k / 120) * 3.2;
        gaussCurve.push([d, Math.exp(-(d * d) / 2)]);
        tCurve.push([d, 1 / (1 + d * d)]);
      }
      plot.curve(gaussCurve, { stroke: colors.ink3, dash: [5, 4], width: 1.6 });
      plot.curve(tCurve, { stroke: colors.theory, width: 2 });

      /* The caption and its note go through the plot API rather than being
         placed by hand. A hand-placed note under the axis printed through the
         axis LABEL — four pixels apart at the default width — which is exactly
         the collision note() exists to avoid, and which the text sweep found
         before any screenshot could have. */
      plot.caption("The same neighbourhood, drawn two ways");
      plot.note("the heavier tail is the whole difference");

      /* Both keys sit in the empty top-right of the plot: past a distance of
         1.5 neither curve rises above 0.32, so neither key is drawn over. */
      text(ctx, colors, "Gaussian — the neighbourhood in 3-D",
        plot.sx(1.5), plot.sy(0.88), colors.ink3, colors.fsXs);
      text(ctx, colors, "Student's t — the same one in the picture",
        plot.sx(1.5), plot.sy(0.72), colors.theory, colors.fsXs);
    }
  },

  readout({ state, anim }) {
    const { pts, kl, n, perplexity, clamped, legal } = state;
    const Y = shownAt(state, anim);
    const steps = state.path.length - 1;
    const out = [
      {
        label: "KL divergence",
        value: kl[anim.k].toFixed(3),
        /* The wobble is named rather than smoothed away. For the first quarter
           of the run t-SNE is minimising an exaggerated P, so the number it
           reports here is not the one it is working on — and that is the
           mechanism, not a defect. */
        note: anim.k === 0
          ? "the random start, before any step"
          : anim.k * PER_STEP < EXAG_UNTIL
            ? `after ${anim.k * PER_STEP} steps — still exaggerating, so this can rise`
            : `after ${anim.k * PER_STEP} of ${steps * PER_STEP} steps`,
      },
      {
        label: "Neighbours kept",
        value: `${Math.round(neighboursKept(pts, Y) * 100)}%`,
        note: "of each sample's three nearest in 3-D, how many are still nearest here",
      },
    ];
    if (clamped) {
      out.push({
        label: "Perplexity",
        value: String(perplexity),
        note: `${n} samples allow at most ${legal} — Rtsne refuses above it`,
      });
    }
    return out;
  },

  summary({ params, state, anim }) {
    const { n, groups, per, perplexity, kl } = state;
    const view = `Turned ${params.turn} degrees, tilted ${params.tilt}.`;
    const stock = params.shape === "cloud"
      ? `${n} samples in one round cloud with no groups in it`
      : `${n} samples in ${groups} groups of ${per}`;
    const steps = state.path.length - 1;
    const where = anim.k === 0
      ? "the random start, before any gradient step"
      : `after ${anim.k * PER_STEP} of ${steps * PER_STEP} gradient steps`;
    return `${stock}, in three genes, each drawn with the Gaussian neighbourhood `
      + `perplexity ${perplexity} gives it. ${view} Beside it the same samples arranged in `
      + `two dimensions by t-SNE, ${where}, each wearing the Student's t neighbourhood the `
      + `picture uses instead. Underneath, the two kernels on one axis. `
      + `KL divergence ${kl[anim.k].toFixed(3)}, and `
      + `${Math.round(neighboursKept(state.pts, shownAt(state, anim)) * 100)}% of each sample's `
      + `three nearest neighbours survived the mapping.`;
  },
});
