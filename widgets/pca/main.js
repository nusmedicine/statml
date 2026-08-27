/* ============================================================================
   Principal component analysis.

   Host: PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 7-19.
   Design history and the measurements behind every constant here are in
   docs/catalogue.md under Widget 19.

   Set the groups, the samples per group and the seed; turn the cloud by
   dragging it; press PCA and the two components are drawn with the plane they
   span; press Project and the samples land on that plane, which then turns to
   face the reader and becomes the 2-D plot.

   Nothing iterates on screen. The components come from an exact
   eigendecomposition and are simply drawn.
   ========================================================================= */

import { defineWidget } from "../core/index.js";

const SEP = 2.6;        /* how far the group centres sit from the middle */
const SIGMA = 0.42;     /* within-group spread */
const GENES = ["Gene 1", "Gene 2", "Gene 3"];

/* --- 3-vector arithmetic -------------------------------------------------- */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return scale(a, 1 / n); };
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const easeCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Shorter arc between two unit vectors. Interpolating the components and
   renormalising instead cuts through the inside of the sphere on a wide turn,
   which reads as the plane shrinking rather than turning. */
function slerp(a, b, t) {
  const d = clamp(dot(a, b), -1, 1);
  const th = Math.acos(d);
  if (th < 1e-9) return a.slice();
  /* Antipodal: no shorter arc exists, so turn through any perpendicular.
     Without this the sine below is zero and every coordinate is NaN. */
  if (Math.PI - th < 1e-9) {
    const alt = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const mid = unit(cross(a, alt));
    return t < 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, (t - 0.5) * 2);
  }
  const s = Math.sin(th);
  return add(scale(a, Math.sin((1 - t) * th) / s), scale(b, Math.sin(t * th) / s));
}

/* THE GROUP CENTRES LIE IN A PLANE, NOT ON A LINE, and that is what makes a
   second component worth having. On a line PC1 alone already separates every
   group and PC2 is noise. In a plane, one component separates worse as groups
   are added (100% at two, 51% at six) while two stay at 100%.

   The plane is not axis-aligned, so no component can be read off a gene label
   and mistaken for one gene. */
const PLANE_A = unit([1, 1, 0.35]);
const PLANE_B = (() => {
  const r = [-0.4, 0.5, 1];
  return unit(sub(r, scale(PLANE_A, dot(r, PLANE_A))));
})();

const gauss = (rng) =>
  Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

function makeSamples(nGroups, perGroup, rng) {
  const pts = [];
  for (let g = 0; g < nGroups; g += 1) {
    const a = (2 * Math.PI * g) / nGroups;
    const c = [0, 1, 2].map((k) => SEP * (Math.cos(a) * PLANE_A[k] + Math.sin(a) * PLANE_B[k]));
    for (let i = 0; i < perGroup; i += 1)
      pts.push({ g, raw: c.map((v) => v + gauss(rng) * SIGMA) });
  }
  /* The notebook's StandardScaler, which makes the three genes comparable. It
     also fixes the total variance at exactly 3.00, so the percentages the
     readout prints are shares of a constant rather than of a moving total. */
  const n = pts.length;
  const mu = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p.raw[k], 0) / n);
  const sd = [0, 1, 2].map((k) =>
    Math.sqrt(pts.reduce((s, p) => s + (p.raw[k] - mu[k]) ** 2, 0) / n) || 1);
  for (const p of pts) p.z = p.raw.map((v, k) => (v - mu[k]) / sd[k]);
  return pts;
}

function covariance(pts) {
  const n = pts.length;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts)
    for (let i = 0; i < 3; i += 1)
      for (let j = 0; j < 3; j += 1) C[i][j] += (p.z[i] * p.z[j]) / n;
  return C;
}

/* Exact eigenvectors of a symmetric 3x3, by cyclic Jacobi. Machine precision in
   about six sweeps, and independent of any starting vector — which power
   iteration is not: capped at 14 turns it landed 0.29 from the true PC1 on the
   worst of 360 trajectories, and up to 500 are needed when the top two
   eigenvalues are close. */
function jacobiEig(Cin) {
  const A = Cin.map((r) => r.slice());
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep += 1) {
    let off = 0;
    for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) off += A[i][j] * A[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p += 1) for (let q = p + 1; q < 3; q += 1) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k += 1) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k += 1) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  return order.map((i) => ({ value: A[i][i], vec: unit([V[0][i], V[1][i], V[2][i]]) }));
}

/* An eigenvector has no sign. sklearn pins it with `svd_flip` — largest
   magnitude entry positive — and so does this, or the 2-D plot mirrors itself
   between seeds and a shared link does not reproduce. The components are then
   drawn double-headed, since the convention is a convention. */
function canonical(v) {
  let m = 0;
  for (let i = 1; i < 3; i += 1) if (Math.abs(v[i]) > Math.abs(v[m])) m = i;
  return v[m] < 0 ? scale(v, -1) : v.slice();
}

/* Two screen basis vectors rather than a projection function, so the projection
   can be tweened toward another basis. `cross(ex, ey)` is the view direction. */
const TURN0 = 41, TILT0 = 23;
function camera(turnDeg, tiltDeg) {
  const az = (turnDeg * Math.PI) / 180, el = (tiltDeg * Math.PI) / 180;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return { ex: [-sa, ca, 0], ey: [-ca * se, -sa * se, ce] };
}

/* --- layout --------------------------------------------------------------- *
 * One function, read by both `height` and `draw`, so the two cannot drift.
 * No lower clamp on the panel size: a floor lets the two panels total more than
 * the canvas holds, and at 356px the right one ran 60px off the edge.         */
const PAD_L = 14, PAD_R = 14, GAP = 24, TOP = 24, BOT = 32;
const SIDE_MAX = 360;

function layout(w) {
  const side = Math.min(SIDE_MAX, Math.max(40, (w - PAD_L - PAD_R - GAP) / 2));
  const used = side * 2 + GAP;
  const x0 = Math.max(PAD_L, (w - used) / 2);
  return {
    side,
    left: { x: x0, y: TOP, w: side, h: side },
    right: { x: x0 + side + GAP, y: TOP, w: side, h: side },
    height: TOP + side + BOT,
  };
}

/* --- drawing -------------------------------------------------------------- */
const R_DOT = 4.5;

function arrow(ctx, x0, y0, x1, y1, col, width, head) {
  if (!Number.isFinite(x1) || !Number.isFinite(y1)) return;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42));
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function text(ctx, colors, s, x, y, col, size, align = "left", base = "middle") {
  ctx.save();
  ctx.fillStyle = col; ctx.font = `${size} ${colors.font}`;
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* Local, as every other scatter widget here has one: `plot.dot` saves, strokes
   and restores per point at r = 4.5, which is a blob at this density. */
function sampleDot(ctx, colors, x, y, col, r = R_DOT) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = colors.surface; ctx.stroke();
}

const groupCol = (colors, g) => colors.clusters[g % colors.clusters.length];

defineWidget({
  slug: "pca",
  title: "Principal component analysis",
  subtitle: "Principal component analysis finds the orthogonal directions along which the data varies most. There are as many components as dimensions; projecting onto the first two gives a 2-D view for visualisation.",
  status: "shipped",
  layout: "side",
  height: ({ w }) => layout(w).height,

  legend: [
    { token: "highlight", label: "PC1", mark: "line" },
    { token: "ink-2", label: "PC2", mark: "line" },
  ],

  params: {
    groups: {
      type: "choice",
      label: "Groups",
      options: [2, 3, 4, 5, 6].map((v) => ({ value: String(v), label: String(v) })),
      default: "3",
    },
    /* Per group, so the groups stay balanced whatever the count. */
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [3, 4, 6, 8, 12].map((v) => ({ value: String(v), label: String(v) })),
      default: "4",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
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


    /* Both gates are `display: true`, which is what makes them animate: core
       gives its entry animation to `GATE_PARAM`, the first gate in the spec and
       only that one, so as data gates the second jumped. Neither changes what
       the state is — `compute` finds the components and the projection either
       way — and the display path asks for frames via `anim.easing`. */
    pca: {
      type: "gate",
      label: "Run PCA",
      labelOff: "Clear the components",
      detail: "draw the two directions the samples are most spread along",
      display: true,
    },
    projected: {
      type: "gate",
      label: "Project onto the plane",
      labelOff: "Back to the cloud",
      detail: "flatten every sample onto it, and turn the plane to face you",
      when: { param: "pca" },
      display: true,
    },

    /* Hidden, because the figure is their control — but parameters, so a shared
       link reproduces the angle the reader was looking from. */
    turn: { type: "int", label: "Turn", min: -180, max: 180, step: 3, default: TURN0, display: true, hidden: true },
    tilt: { type: "int", label: "Tilt", min: -80, max: 80, step: 3, default: TILT0, display: true, hidden: true },
  },

  compute({ params, rng }) {
    const nGroups = Number(params.groups);
    const pts = makeSamples(nGroups, Number(params.samples), rng);
    const C = covariance(pts);
    const eig = jacobiEig(C);
    const pc1 = canonical(eig[0].vec);
    const pc2 = canonical(unit(sub(eig[1].vec, scale(pc1, dot(eig[1].vec, pc1)))));

    const proj = pts.map((p) => ({ g: p.g, a: dot(p.z, pc1), b: dot(p.z, pc2) }));
    const span = Math.max(...proj.flatMap((q) => [Math.abs(q.a), Math.abs(q.b)])) * 1.16 || 1;

    return {
      pts, C, pc1, pc2, proj, span, nGroups, perGroup: Number(params.samples),
      pc1Spread: eig[0].value,
      pc2Spread: dot(pc2, [0, 1, 2].map((i) =>
        C[i][0] * pc2[0] + C[i][1] * pc2[1] + C[i][2] * pc2[2])),
      total: C[0][0] + C[1][1] + C[2][2],
    };
  },

  /* Two numbers, one gesture. Core applies them together, so turning the cloud
     is one recompute and one address-bar write however far it is dragged.
     Turn wraps — a cloud has no far side, and a drag that hits a wall reads as
     the figure being broken. Tilt clamps at 80, past which the vertical axis
     collapses to a point. */
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

  /* No Step and no Play: two gates, one thing behind each, nothing to step. */
  animation: {
    stepLabel: null,
    runLabel: null,

    /* Both stages jump to 1 when their gate is already open on load, so a
       shared link opens on the finished figure rather than replaying into it. */
    init: ({ params }) => ({
      pca: params.pca ? 1 : 0,
      flat: params.projected ? 1 : 0,
      done: true,
    }),

    /* `anim.easing` is core's word for "this display change wants frames". It
       is consumed when granted, so it has to be asked for each time. */
    rebuild: (anim, { params }) => {
      if (!params.pca) { anim.pca = 0; anim.flat = 0; return; }
      if (!params.projected && anim.flat > 0) anim.flat = 0;
      if (anim.pca < 1 || (params.projected && anim.flat < 1)) anim.easing = true;
    },

    /* 1800ms for the projection against 900 for the components: the components
       appearing is a reveal, the projection is a move. */
    advance(anim, { dt, params }) {
      let more = false;
      if (params.pca && anim.pca < 1) { anim.pca = Math.min(1, anim.pca + dt / 900); more = true; }
      if (params.projected && anim.pca >= 1 && anim.flat < 1) {
        anim.flat = Math.min(1, anim.flat + dt / 1800); more = true;
      }
      anim.done = !more;
      return more;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const { pts, pc1, pc2 } = state;
    /* Whether the reader has been told which group a sample came from. Off by
       default, so they read the structure off the picture first. */
    const told = params.labels === "on";

    const lines = clamp(anim.pca / 0.55, 0, 1);
    const plane = clamp((anim.pca - 0.5) / 0.5, 0, 1);

    /* The projection is two moves in sequence, not two overlapping ones — the
       samples land, and only then does the plane turn.

         0.00 - 0.42   every sample slides onto the plane
         0.42 - 1.00   the plane turns to face the reader
         0.70 - 1.00   the 2-D panel fades up behind the end of that turn     */
    const drop = easeIO(clamp(anim.flat / 0.42, 0, 1));
    const spin = easeCubic(clamp((anim.flat - 0.42) / 0.58, 0, 1));
    const flat = clamp((anim.flat - 0.70) / 0.30, 0, 1);

    /* THE TURN LANDS ON THE 2-D GRAPH, not merely face-on to the plane. Facing
       the normal leaves the in-plane rotation wherever it was, so the cloud
       settles at an arbitrary roll and the panel beside it shows the same
       samples the other way up. The end state is therefore written down: PC1
       across, PC2 up, at the right panel's scale. Slerping each basis vector
       and squaring ey up against ex keeps every frame orthonormal, so the cloud
       rotates rather than shears. */
    const base = camera(params.turn, params.tilt);
    const cx = L.left.x + L.left.w / 2, cy = L.left.y + L.left.h / 2;

    let ex = base.ex, ey = base.ey;
    if (spin > 0) {
      ex = slerp(base.ex, pc1, spin);
      ey = slerp(base.ey, pc2, spin);
      ey = unit(sub(ey, scale(ex, dot(ex, ey))));
    }
    const panelScale = (L.side / 2 - 16) / state.span;
    const S = lerp(L.side * 0.152, panelScale, spin);
    const P = (p) => [cx + dot(p, ex) * S, cy - dot(p, ey) * S];
    const eye = cross(ex, ey);

    text(ctx, colors, "Three standardised genes", L.left.x, L.left.y - 9, colors.ink2, colors.fsSm);

    /* Once the view is down the plane's normal the gene axes mean nothing, and
       leaving them lit invites reading a component off one of them. */
    if (1 - spin > 0.01) {
      ctx.save(); ctx.globalAlpha = 1 - spin;
      for (let i = 0; i < 3; i += 1) {
        const d = [0, 0, 0]; d[i] = 3.05;
        const o = P([0, 0, 0]), e = P(d);
        arrow(ctx, o[0], o[1], e[0], e[1], colors.ink3, 1.3, 6);
        text(ctx, colors, GENES[i], e[0] + 5, e[1] - 5, colors.ink3, colors.fsXs);
      }
      ctx.restore();
    }

    if (plane > 0.01) {
      const R = 2.75 * plane;
      const cs = [[-R, -R], [R, -R], [R, R], [-R, R]].map(([su, sv]) =>
        P(add(scale(pc1, su), scale(pc2, sv))));
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cs[0][0], cs[0][1]);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(cs[i][0], cs[i][1]);
      ctx.closePath();
      ctx.fillStyle = colors.grid; ctx.globalAlpha = 0.5 * plane; ctx.fill();
      ctx.globalAlpha = plane; ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    if (lines > 0.01) {
      for (const [vec, label, col] of [[pc1, "PC1", colors.highlight], [pc2, "PC2", colors.ink2]]) {
        const R = 2.6 * lines;
        const o = P(scale(vec, -R)), e = P(scale(vec, R));
        arrow(ctx, o[0], o[1], e[0], e[1], col, 1.8, 7);
        arrow(ctx, e[0], e[1], o[0], o[1], col, 1.8, 7);
        if (lines > 0.85) text(ctx, colors, label, e[0] + 6, e[1] - 6, col, colors.fsXs);
      }
    }

    /* Back to front, so near samples occlude far ones. Without it the cloud is
       a flat sticker and turning it tells you nothing. */
    const placed = pts.map((p) => {
      const onPlane = add(scale(pc1, dot(p.z, pc1)), scale(pc2, dot(p.z, pc2)));
      const home = drop > 0 ? lerp3(p.z, onPlane, drop) : p.z;
      return { g: p.g, home, d: dot(home, eye) };
    }).sort((a, b) => a.d - b.d);
    ctx.save();
    for (const q of placed) {
      const [x, y] = P(q.home);
      sampleDot(ctx, colors, x, y, told ? groupCol(colors, q.g) : colors.unknown);
    }
    ctx.restore();

    /* ---- right panel: the 2-D plot ------------------------------------- */
    if (flat > 0.02) {
      const { x: rx, y: ry, w: rw, h: rh } = L.right;
      const sx = (v) => rx + rw / 2 + (v / state.span) * (rw / 2 - 16);
      const sy = (v) => ry + rh / 2 - (v / state.span) * (rh / 2 - 16);
      ctx.save();
      ctx.globalAlpha = flat;
      ctx.strokeStyle = colors.axis; ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      for (const q of state.proj) {
        sampleDot(ctx, colors, sx(q.a), sy(q.b), told ? groupCol(colors, q.g) : colors.unknown);
      }
      text(ctx, colors, "The samples on PC1 and PC2", rx, ry - 9, colors.ink2, colors.fsSm);
      text(ctx, colors, "PC1", rx + rw / 2, ry + rh + 11, colors.ink3, colors.fsXs, "center", "top");
      ctx.translate(rx - 6, ry + rh / 2);
      ctx.rotate(-Math.PI / 2);
      text(ctx, colors, "PC2", 0, 0, colors.ink3, colors.fsXs, "center", "bottom");
      ctx.restore();
    }

  },

  /* Nothing until the components exist, then the two shares of the variance and
     nothing else — which is what `pca.explained_variance_ratio_` returns and
     the only number `03-5` prints. */
  readout({ params, state }) {
    if (!params.pca) {
      return [{
        label: "Samples",
        value: String(state.pts.length),
        note: `${state.nGroups} groups of ${state.perGroup}, three genes each`,
      }];
    }
    const pct = (v) => `${((v / state.total) * 100).toFixed(0)}%`;
    return [
      { label: "PC1", value: pct(state.pc1Spread), note: "of the variance" },
      { label: "PC2", value: pct(state.pc2Spread), note: `${pct(state.pc1Spread + state.pc2Spread)} together` },
    ];
  },

  /* Core hands this to `aria-label`, so it describes what is on screen. */
  summary({ params, state }) {
    const view = `Turned ${params.turn} degrees, tilted ${params.tilt}.`;
    if (!params.pca) {
      return `${state.pts.length} samples in ${state.nGroups} groups, plotted against three `
        + `standardised genes. ${view} No components drawn yet.`;
    }
    if (!params.projected) {
      return `PC1 and PC2 drawn through the cloud, with the plane they span. PC1 holds `
        + `${((state.pc1Spread / state.total) * 100).toFixed(0)}% of the spread and PC2 `
        + `${((state.pc2Spread / state.total) * 100).toFixed(0)}%. ${view}`;
    }
    return `The samples projected onto the plane of PC1 and PC2, drawn beside the cloud they `
      + `came from, with PC1 across and PC2 up. PC1 holds `
      + `${((state.pc1Spread / state.total) * 100).toFixed(0)}% of the variance and PC2 `
      + `${((state.pc2Spread / state.total) * 100).toFixed(0)}%.`;
  },
});
