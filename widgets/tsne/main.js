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

/* THE GROUPS ARE ALWAYS REAL, and whether the reader is TOLD is the `labels`
   control. That replaced a stage selector — groups against one structureless
   cloud — on Kenneth's call, because the selector never said what it was for
   and only read to someone who already knew the answer. Turning labels off and
   asking "how many clusters?" puts the question to the reader instead, and it
   is what the notebook itself does: every method is plotted twice, once bare
   and once coloured by type.

   WHAT THAT COSTS, recorded rather than quietly dropped: the structureless
   cloud was this widget's principle-2.6 failing case, and it was measured —
   over 40 seeds the best two-way split a reader could see in the t-SNE picture
   scored 0.634 +- 0.104 against the same cloud's 0.447 +- 0.057 under a plain
   projection, higher on 38 of 40, and worst at low perplexity. That is the
   distill.pub demonstration cell 41 links to, and it is not reachable now.
   Bringing it back is one option on `labels`, not a rebuild. */
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

/* ONE SAMPLE'S TWO DISTRIBUTIONS, which is what the method actually matches.
   Not distances — for sample i, a probability over WHICH OTHER SAMPLE is its
   neighbour: 47 numbers that sum to 1, from the 3-D data, and the same 47 from
   the picture. The descent moves the picture until the second looks like the
   first, and KL is how far apart they are.

   Both rows are renormalised over j so each reads as a distribution over i's
   neighbours. The objective is the symmetrised JOINT over pairs rather than
   these rows, and this is a slice of it — the sum runs over every sample's
   row, which is what the panel's note says. */
function neighbourRows(P0, Y, i) {
  const n = Y.length;
  const p = [], q = [];
  let sp = 0, sq = 0;
  for (let j = 0; j < n; j += 1) {
    if (j === i) continue;
    const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
    const w = 1 / (1 + dx * dx + dy * dy);
    p.push({ j, v: P0[i][j] });
    q.push({ j, v: w });
    sp += P0[i][j];
    sq += w;
  }
  if (sp <= 0) sp = 1e-12;
  if (sq <= 0) sq = 1e-12;
  /* Sorted by p, so the shape is legible and the tall bars are i's real
     neighbours. q keeps the same order, which is what lets the two be read
     against each other bar for bar. */
  const order = p.map((_, k) => k).sort((a, b) => p[b].v - p[a].v);
  return order.map((k) => ({ j: p[k].j, p: p[k].v / sp, q: q[k].v / sq }));
}

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
  /* THE BOTTOM ROW GREW when the neighbour panel took on the KL's own terms.
     It carries three things stacked now — the two distributions, the signed
     per-neighbour term under them, and a kernel inset in the corner — where it
     used to carry one pair of curves. 0.62 of the row above left the terms
     strip 30px tall, which is not a strip, it is a smudge. */
  const curveH = Math.max(150, rowH * 0.95);
  return {
    side: Math.min(colW, rowH),
    space: { x: x0, y: TOP, w: colW, h: rowH },
    flat: { x: x1, y: TOP, w: colW, h: rowH },
    arrow: { x: x0 + colW, y: TOP + rowH / 2, w: GAP },
    /* THE BOTTOM ROW IS THE DIAGRAM'S, WITH ONE CELL REPAID. Kenneth's mock-up
       has two probability panels side by side, and overlaying them on one axis
       — which is the correction to the notebook's two y-scales — frees the
       second cell. It goes to the KL, which is cell 40's THIRD formula and
       third figure and was missing from the first build: the widget reported
       convergence as a number in the readout and never drew it. */
    curves: { x: x0, y: y1, w: colW, h: curveH },
    descent: { x: x1, y: y1, w: colW, h: curveH },
    height: TOP + rowH + ROW_GAP + curveH + BOT,
  };
}

/* The KL panel's plot area, inset from its cell. Shared by `draw` and
   `regions` so the curve and the click targets cannot drift apart — the one
   piece of geometry no pixel hash can see, since the picture is identical
   whether a target sits where it is drawn or six columns away. */
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

/* The mark that says "this is the one the bars are about". A ring rather than
   a colour change, so it reads the same whether labels are on or off. */
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

/* Every display parameter EXCEPT `step`, as one string. `rebuild` compares it
   against the last one to work out whether the write it is reacting to was a
   scrub of the KL curve or something else. ADD TO THIS WHENEVER A DISPLAY
   PARAMETER IS ADDED — an omission here does not throw, it silently throws the
   reader's position away on that control. */
const otherDisplay = (p) => `${p.turn},${p.tilt},${p.labels},${p.pick}`;

defineWidget({
  slug: "tsne",
  title: "t-SNE",
  subtitle: "Every sample carries a neighbourhood, and perplexity is how many others fit inside it. Drag the cloud to turn it, then run the descent: what survives into the picture is who is near whom, and nothing else.",
  status: "draft",
  layout: "side",
  height: ({ w }) => layout(w).height,

  /* THE KEY IS `token`, NOT `swatch`, and getting that wrong fails SILENTLY:
     core writes `var(--c-${item.token}, var(--${item.token}))`, so an unknown
     key leaves it resolving `var(--c-undefined, var(--undefined))` and every
     swatch renders the same default grey. The legend looked present and said
     nothing. Kenneth spotted it on screen; no check in the repo would have.
     `mark` picks the shape, so a bar reads as a bar and a line as a line.

     These have to be true with the labels BOTH off and on, because core takes
     the legend once at build time rather than per render. */
  legend: [
    { token: "ink-2", label: "what the data says", mark: "line" },
    { token: "empirical", label: "what the picture says", mark: "bar" },
    { token: "reference", label: "perplexity — how many neighbours count", mark: "line" },
  ],

  params: {
    /* OFF BY DEFAULT, so the reader reads the clusters off the picture before
       being told what they are — the notebook's own order, and non-negotiable 4
       applied to knowledge rather than to the figure. */
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

    /* WHERE THE READER IS IN THE RUN, and it is a PARAMETER because clicking the
       KL curve has to go through the same door every other write does
       (non-negotiable 1). A region resolves a pixel to one parameter, core
       syncs it and writes the URL, and the arrangement above jumps there — so a
       scrubbed position is shareable in a way `anim.k` alone could never be.

       `display: true`, so a scrub keeps the run rather than resetting it, and
       0 by default so the widget still starts empty (non-negotiable 4).
       `?step=40` publishes the finished figure the way `?shown=N` does
       elsewhere.

       Step and Play move `anim.k` and do NOT write back here, which is the
       other half of invariant 1. `rebuild` below is what reconciles the two,
       and it only honours this when the PARAMETER moved — otherwise turning
       the cloud would snap the reader back to wherever they last clicked. */
    step: {
      type: "int",
      label: "Step",
      min: 0,
      max: ITERS / PER_STEP,
      default: 0,
      display: true,
      hidden: true,
    },

    /* WHICH SAMPLE THE NEIGHBOUR PANEL IS ABOUT. A parameter for the same
       reason `step` is: clicking a sample goes through the one door, so the
       chosen sample lands in the URL and a link can point at it. */
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

  /* THE KL CURVE IS CLICKABLE, one region per step. A region resolves a pixel
     to an identity and sets exactly one parameter, which is the contract core
     enforces at load — so a click here is the same transaction as a slider
     move, and lands in the URL.

     Regions win over `drag` where the two overlap, which is what stops a click
     on the chart also swinging the cloud. They do not overlap here — different
     quadrants — but the ordering is core's and worth not relying on by luck. */
  regions({ w, params, state }) {
    /* STATE IS NULL ON THE FIRST CALL, and that is core's load-time validation
       probe rather than a click: `recompute()` runs from `render()`, which is
       after the probe at widget.js:516. This widget is the first to declare
       `regions` at all, so nothing had met it before.

       The cost is real and is named rather than waved past: returning nothing
       means the probe validates nothing, so a bad region table would not throw
       at load the way core intends. What covers it instead is an assertion —
       _lab checks the strips resolve to their own step, tile without a gap,
       reach both ends, and sit where the curve DRAWS each step. That last one
       is the check core's probe could not have made anyway.

       The proper fix is in core, moving the probe after the first render, and
       that is a `widgets/core/` change which owes a full fingerprint run. */
    if (!state) return [];
    const L = layout(w);
    const out = [];

    /* THE SAMPLES ARE CLICKABLE IN THE 3-D PANEL ONLY, and that is a
       correctness limit rather than a preference: a region is resolved from
       `params` and `state`, and core hands it no `anim`. The 3-D positions
       depend only on turn and tilt, both parameters, so they can be hit-tested
       exactly. The 2-D positions depend on where the descent has got to, which
       lives in `anim` — a target computed from `params.step` would sit
       wherever the reader last CLICKED rather than where the sample is drawn
       the moment they aim at it, and that is exactly the silent mismatch no
       pixel hash can see. So the pick happens in the data, and the picture
       shows what became of it. */
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

    const { x, y, w: pw, h: ph } = L.descent;
    const total = state.path.length - 1;
    const a = chartArea(x, y, pw, ph);
    for (let k = 0; k <= total; k += 1) {
      /* Each step owns the strip around its own x, so the nearest step to the
         pointer is the one that takes the click — half a step of slack on each
         side, and the two ends keep their outer half rather than being
         unreachable at the frame edge. */
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

    /* RTSNE'S OWN RULE, AND THE WIDGET REFUSES RATHER THAN WARNS. `Rtsne` errors
       unless 3 * perplexity < n - 1; sklearn only warns. Refusing is the right
       side to be on — a control that silently produces nonsense past a
       threshold is the failure this project exists to show, not to commit — and
       a reader who meets the limit has just learned why the lesson's cell 42
       reads `perplexity_value <- min(2, ncol(scaledData) / 3)`. */
    const legal = Math.max(2, Math.floor((n - 2) / 3));
    const perplexity = clamp(params.perplexity, 2, legal);
    const clamped = perplexity !== params.perplexity;

    const { path, kl, sigmas, P0 } = descend(pts, perplexity, rng);

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
      n, groups, per, gs, pts, path, kl, sigmas, P0, perplexity, clamped, legal,
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
      const pre = fromScratch ? 0 : clamp(params.step | 0, 0, total);
      /* `others` is how rebuild tells a scrub from every other display change
         — see there. */
      return {
        k: pre, t: 1, moving: false, done: pre >= total,
        others: otherDisplay(params),
      };
    },

    /* WHICH DISPLAY PARAMETER MOVED, deduced rather than told. Core calls
       rebuild once per display-parameter write and does not say which one. So
       the widget watches every display parameter EXCEPT `step`: if none of them
       moved, the write must have been `step`, and only then does the reader's
       position jump.

       Two wrong versions were built first and both are worth recording, because
       they are the same mistake at different sizes.

       Comparing `step` against its own last-applied value fails on a click BACK
       to a step the reader has already stepped away from: the value is one the
       guard has seen, so nothing happens and the figure sits still under a
       click aimed straight at it.

       Watching only `turn` and `tilt` fails the moment another display
       parameter exists — and two arrived the same afternoon. Clicking a SAMPLE
       leaves the angles alone, so the widget read it as a scrub and threw away
       however far the reader had run the descent. Watching all of them is the
       version that does not need revisiting when the next one is added. */
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
    /* LABELS OFF IS THE DEFAULT, and the colour it uses is `--c-unknown`,
       which the tokens file defines as "not measured yet" — absence of
       information rather than a third category. That is exactly what a
       withheld label is. */
    const told = params.labels === "on";
    const col = (i) => (told ? sampleCol(colors, gs[i]) : colors.unknown);
    const picked = clamp(params.pick | 0, 0, n - 1);
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

      globe(ctx, colors, P, eye, R, 0.7);

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
        sampleDot(ctx, colors, px, py, col(i), i === picked ? R_DOT + 1.5 : R_DOT, fade);
        if (i === picked) ring(ctx, colors, px, py, R_DOT + 5);
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
        const px = cx + Y[i][0] * S, py = cy - Y[i][1] * S;
        sampleDot(ctx, colors, px, py, col(i), i === picked ? R_DOT + 1.5 : R_DOT);
        /* THE PICKED SAMPLE IS MARKED IN BOTH SPACES, which is what ties the
           bars below to a sample rather than to an index. It is the same
           sample, so it wears the same ring. */
        if (i === picked) ring(ctx, colors, px, py, R_DOT + 5);
      }
    }

    /* ---- bottom left: WHAT IS ACTUALLY BEING MATCHED ---------------------- *
     * The two kernels used to be here, drawn as shapes. They were a reference
     * figure: nothing moved them, and — worse — they showed the wrong object.
     * A kernel is similarity against DISTANCE; the thing t-SNE matches is a
     * probability distribution over WHICH OTHER SAMPLE is a neighbour.
     *
     * So this panel is one sample's two distributions, with the KL's own terms
     * beneath them and the kernels demoted to an inset. Click any sample in the
     * 3-D panel to change which. Settled from `_lab/tsne-kernels.html`, which
     * drew four candidates live and is kept: Kenneth's call was "B as inset and
     * C in the panel".
     *
     * PERPLEXITY IS VISIBLE HERE AS A COUNT, which is the whole reason the
     * panel earns its place: at perplexity 5 about five bars stand up, because
     * sigma was chosen for this sample to make exactly that true. A radius
     * would not have shown it; a count does.                                  */
    {
      const { x, y, w: pw, h: ph } = L.curves;
      const rows = neighbourRows(state.P0, Y, picked);
      const cell = chartArea(x, y, pw, ph);
      /* Three bands: the distributions, the terms that add up to the KL, and a
         line of type. The terms get a third of the height because they are read
         for SIGN and for which few bars dominate, not for a value. */
      const termH = Math.max(44, cell.h * 0.30);
      const a = { x: cell.x, y: cell.y, w: cell.w, h: cell.h - termH - 16 };
      const tb = { x: cell.x, y: cell.y + a.h + 16, w: cell.w, h: termH };
      const top = Math.max(...rows.map((r) => Math.max(r.p, r.q)), 1e-9);

      text(ctx, colors, "Who is a neighbour of this sample", x, y - 10, colors.ink2, colors.fsSm);

      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g += 1) {
        const gy = Math.round(a.y + (a.h * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, gy);
        ctx.lineTo(a.x + a.w, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(a.x + 0.5, a.y);
      ctx.lineTo(a.x + 0.5, a.y + a.h + 0.5);
      ctx.lineTo(a.x + a.w, a.y + a.h + 0.5);
      ctx.stroke();
      ctx.restore();

      const bw = a.w / rows.length;
      /* In the data: an outline, because it is the target and does not move.
         In the picture: filled, because it is what the descent is changing. */
      ctx.save();
      for (let k = 0; k < rows.length; k += 1) {
        const bx = a.x + k * bw;
        const hq = clamp01(rows[k].q / top) * a.h;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = colors.empirical;
        ctx.fillRect(bx + 0.5, a.y + a.h - hq, Math.max(0.8, bw - 1), hq);
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < rows.length; k += 1) {
        const bx = a.x + k * bw, hp = clamp01(rows[k].p / top) * a.h;
        const py = a.y + a.h - hp;
        if (k === 0) ctx.moveTo(bx, py); else ctx.lineTo(bx, py);
        ctx.lineTo(bx + bw, py);
      }
      ctx.stroke();
      ctx.restore();

      /* WHERE PERPLEXITY LANDS. The bars are sorted by p, so the perplexity-th
         bar is the edge of the neighbourhood the reader asked for — and the
         line falls exactly where the outline stops being tall. Unlabelled on
         the canvas: the figure's legend names it, and a label here rode the
         dashed line, whose position moves with the control. */
      const pp = state.perplexity;
      if (pp < rows.length) {
        const lx = a.x + pp * bw;
        ctx.save();
        ctx.strokeStyle = colors.reference;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, a.y);
        ctx.lineTo(lx, a.y + a.h + termH + 16);
        ctx.stroke();
        ctx.restore();
      }

      /* ---- the KL's own terms, signed --------------------------------------
       * p·log(p/q) per neighbour, and the KL is EXACTLY their sum — no proxy.
       * Shading the gap between outline and bar was the obvious alternative and
       * is wrong: the gap is |p−q|, but the terms are signed and log-weighted,
       * so a pair the picture over-weights points DOWNWARDS. Shading would draw
       * a cost where the truth is a credit.
       *
       * Measured on the default stage, at the end of the run: pairs the picture
       * under-weights carry 137% of the KL, pairs it over-weights carry −37%,
       * and the worst 2% of pairs carry 77% of the total. That asymmetry is why
       * t-SNE keeps neighbourhoods and throws away everything else. */
      const terms = rows.map((r) => (r.p > 0 ? r.p * Math.log(r.p / Math.max(r.q, 1e-12)) : 0));
      const mag = Math.max(...terms.map(Math.abs), 1e-12);
      const zero = tb.y + tb.h / 2;
      ctx.save();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tb.x, zero + 0.5);
      ctx.lineTo(tb.x + tb.w, zero + 0.5);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      for (let k = 0; k < terms.length; k += 1) {
        const h = (terms[k] / mag) * (tb.h / 2 - 3);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = terms[k] >= 0 ? colors.extreme : colors.smoothed;
        ctx.fillRect(tb.x + k * bw + 0.5, h >= 0 ? zero - h : zero,
          Math.max(0.8, bw - 1), Math.abs(h));
      }
      ctx.restore();
      /* BOTH LABELS ON THE RIGHT, one per row, and nothing else on either
         baseline. Left-aligned they sat under the tallest term bars, and the
         second one printed through "these add up to the KL" at 550px — where
         the cell is 192px wide and two labels do not fit on one line however
         they are worded. The claim they carried is a readout tile now, which
         has the room for a sentence. The far-neighbour terms are always tiny,
         so the right of this strip is always clear. */
      text(ctx, colors, "costs the fit", tb.x + tb.w - 2, tb.y + 1, colors.extreme, colors.fsXs, "right", "top");
      /* Just UNDER the zero line rather than at the strip's bottom edge, which
         is the cell's bottom edge too — six pixels from the line of type below
         it, and at 550px the two spanned the same width. Here it is a clear
         half-strip from both. */
      text(ctx, colors, "pays it back", tb.x + tb.w - 2, zero + 3, colors.smoothed, colors.fsXs, "right", "top");

      /* ---- the two kernels, demoted to an inset ---------------------------
       * They cannot show the KL — that belongs to the distributions above —
       * but they are the only thing that explains WHY the tail is cheap, and
       * therefore why the strip below is so lopsided. Variant B from the lab
       * page: each kernel against distance in units of its OWN width, which
       * invents no shared axis. The rugs are this sample's real neighbours. */
      const iw = Math.min(150, a.w * 0.42), ih = Math.min(62, a.h * 0.46);
      const ix = a.x + a.w - iw, iy = a.y + 2;
      const isx = (u) => ix + (Math.min(u, 6) / 6) * iw;
      const isy = (v) => iy + ih - v * (ih - 12);
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(ix + 0.5, iy + 0.5, iw, ih);
      ctx.restore();
      const kcurve = (f, col, dash) => {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let q = 0; q <= 60; q += 1) {
          const u = (q / 60) * 6, px = isx(u), py = isy(f(u));
          if (q === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      };
      kcurve((u) => Math.exp(-(u * u) / 2), colors.ink2, [4, 3]);
      kcurve((u) => 1 / (1 + u * u), colors.theory, null);
      /* This sample's neighbours, in each kernel's own units: the 3-D distances
         divided by its own sigma, and the 2-D distances as they stand, since
         the t's width is fixed at 1. Where the data's rug piles up past the
         right edge and the picture's does not IS the crowding problem. */
      const sig = state.sigmas[picked] || 1;
      const rug = (vals, col, y0) => {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for (const v of vals) {
          ctx.beginPath();
          ctx.moveTo(isx(v), y0);
          ctx.lineTo(isx(v), y0 + 5);
          ctx.stroke();
        }
        ctx.restore();
      };
      const uData = [], uPic = [];
      for (let j = 0; j < n; j += 1) {
        if (j === picked) continue;
        uData.push(dist3(pts[picked], pts[j]) / sig);
        uPic.push(dist2(Y[picked], Y[j]));
      }
      rug(uData, colors.ink2, iy + ih - 12);
      rug(uPic, colors.theory, iy + ih - 6);
      text(ctx, colors, "the two kernels, each in its own units",
        ix + iw, iy - 3, colors.ink3, colors.fsXs, "right", "bottom");

      text(ctx, colors, `sample ${picked + 1} — click another`, cell.x,
        cell.y + cell.h + 5, colors.ink3, colors.fsXs, "left", "top");
    }
    /* ---- bottom right: the KL divergence falling ------------------------- */
    {
      const { x, y, w: pw, h: ph } = L.descent;
      const a = chartArea(x, y, pw, ph);
      const total = state.path.length - 1;
      /* The ceiling is the whole trajectory's maximum rather than its first
         value, because the curve RISES before it falls: measured at n = 48 it
         goes 2.14 up to 2.59 by step 50 and does not pass its start again until
         step 200. Anchored on kl[0] the exaggerated stretch would draw off the
         top of the frame. */
      const top = Math.max(...state.kl, 1e-9);
      const px = (k) => a.x + (total > 0 ? (k / total) * a.w : 0);
      const py = (v) => a.y + a.h - clamp01(v / top) * a.h;

      text(ctx, colors, "KL divergence, as it descends", x, y - 10, colors.ink2, colors.fsSm);

      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g += 1) {
        const gy = Math.round(a.y + (a.h * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, gy);
        ctx.lineTo(a.x + a.w, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(a.x + 0.5, a.y);
      ctx.lineTo(a.x + 0.5, a.y + a.h + 0.5);
      ctx.lineTo(a.x + a.w, a.y + a.h + 0.5);
      ctx.stroke();
      ctx.restore();

      text(ctx, colors, "0", a.x - 5, a.y + a.h, colors.ink3, colors.fsXs, "right");
      text(ctx, colors, top.toFixed(1), a.x - 5, a.y + 1, colors.ink3, colors.fsXs, "right", "top");

      /* WHERE EARLY EXAGGERATION IS RELEASED, drawn only once the reader has
         reached it — before that it would announce a stage they have not met.
         It is the explanation for the shape they are looking at: for the first
         250 gradient steps t-SNE is minimising a P multiplied by twelve, so the
         number plotted here is not the one it is working on, and it wanders. */
      const rel = EXAG_UNTIL / PER_STEP;
      if (anim.k > rel) {
        ctx.save();
        ctx.strokeStyle = colors.ink3;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px(rel), a.y);
        ctx.lineTo(px(rel), a.y + a.h);
        ctx.stroke();
        ctx.restore();
        text(ctx, colors, "exaggeration off", px(rel) + 4, a.y + 2,
          colors.ink3, colors.fsXs, "left", "top");
      }

      /* THROUGH THE COMPLETED STEPS ONLY, so the chart starts empty and grows —
         the same reveal widget 20's stress chart uses, and what keeps the
         widget from opening on its own answer (non-negotiable 4). The frame is
         drawn from the start, which is what gives a scrub something to aim at
         without showing where the curve goes. */
      const live = lerp(state.kl[anim.k], state.kl[Math.min(anim.k + 1, total)],
        anim.moving ? easeIO(anim.t) : 0);
      ctx.save();
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(px(0), py(state.kl[0]));
      for (let k = 1; k <= anim.k; k += 1) ctx.lineTo(px(k), py(state.kl[k]));
      if (anim.moving) ctx.lineTo(px(anim.k + easeIO(anim.t)), py(live));
      ctx.stroke();
      ctx.restore();

      /* The reader's own position, which is what a click moves. */
      const hx = px(anim.k + (anim.moving ? easeIO(anim.t) : 0));
      ctx.save();
      ctx.fillStyle = colors.empirical;
      ctx.beginPath();
      ctx.arc(hx, py(live), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* THE HINT AND THE TOTAL NEVER SHARE THE LINE, and that is by
         construction rather than by measuring. Side by side they printed
         through each other in a half-width cell at 550 and 640px — which is the
         width the fingerprint harness records at — and picking shorter wording
         would only have moved the threshold rather than removed it. */
      if (anim.k === 0) {
        text(ctx, colors, "click to jump", a.x, a.y + a.h + 5,
          colors.ink3, colors.fsXs, "left", "top");
      } else {
        text(ctx, colors, `${anim.k * PER_STEP} steps`, a.x, a.y + a.h + 5,
          colors.ink3, colors.fsXs, "left", "top");
        text(ctx, colors, `of ${total * PER_STEP}`, a.x + a.w, a.y + a.h + 5,
          colors.ink3, colors.fsXs, "right", "top");
      }
    }
  },

  readout({ params, state, anim }) {
    const { pts, kl, n, perplexity, clamped, legal } = state;
    const picked = clamp(params.pick | 0, 0, n - 1);
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
      /* THE STRIP'S OWN CLAIM, in a tile because it is a sentence and the strip
         is 192px wide at the narrowest. It also says which way the asymmetry
         runs, which is the whole point of drawing the terms signed: pulling a
         true neighbour apart is what costs, and drawing a stranger close pays
         some of it back. */
      (() => {
        const rows = neighbourRows(state.P0, Y, picked);
        let up = 0, down = 0;
        for (const r of rows) {
          if (r.p <= 0) continue;
          const t = r.p * Math.log(r.p / Math.max(r.q, 1e-12));
          if (t >= 0) up += t; else down += t;
        }
        return {
          label: `Sample ${picked + 1}'s share`,
          value: (up + down).toFixed(3),
          note: `+${up.toFixed(3)} from neighbours pulled apart, ${down.toFixed(3)} back from strangers drawn close`,
        };
      })(),
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
    const told = params.labels === "on";
    const stock = `${n} samples in ${groups} groups of ${per}`;
    const shown = told
      ? "coloured by the group each really came from"
      : "all drawn the same colour, so the grouping is not given away";
    const picked = clamp(params.pick | 0, 0, n - 1);
    const steps = state.path.length - 1;
    const where = anim.k === 0
      ? "the random start, before any gradient step"
      : `after ${anim.k * PER_STEP} of ${steps * PER_STEP} gradient steps`;
    return `${stock}, in three genes, ${shown}, each drawn with the Gaussian neighbourhood `
      + `perplexity ${perplexity} gives it. ${view} Beside it the same samples arranged in `
      + `two dimensions by t-SNE, ${where}, each wearing the Student's t neighbourhood the `
      + `picture uses instead. Underneath, sample ${picked + 1}'s two neighbour `
      + `distributions — how likely every other sample is to be its neighbour in the data, `
      + `and in the picture — which is the pair t-SNE is matching. `
      + `KL divergence ${kl[anim.k].toFixed(3)}, and `
      + `${Math.round(neighboursKept(state.pts, shownAt(state, anim)) * 100)}% of each sample's `
      + `three nearest neighbours survived the mapping.`;
  },
});
