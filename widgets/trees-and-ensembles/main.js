/* =========================================================================
   Trees and Ensembles — PHM5005 arc 17, hosting 04-3's tree sections.
   -------------------------------------------------------------------------
   Two pages. THE TREE builds one CART a split at a time, with the SEARCH
   animated rather than asserted: a candidate line glides across the node,
   the score curve traces out behind it, and a running minimum descends until
   the winner commits. THE BAG draws the same samples with replacement, fits
   a tree to each, and pools the votes.

   Why twelve samples and not the rings widget's 180: the rings stage answers
   "what shape can a tree draw", which is a different question from "how does
   a tree get built". At 180 the candidate list is ~179 per feature and the
   search can only be asserted; at twelve it fits on the panel, the thresholds
   are midpoints a reader can verify, and the arithmetic can be checked by
   hand. Cross-checked against scikit-learn 1.9.0 (criterion="gini",
   min_samples_leaf=1): same features x1/x2/x1, same thresholds 5.5/5.5/9.0,
   4 leaves, depth 3, 0 training errors.

   WHAT THE BAGGING PAGE IS FOR, because it is not what "averaging smooths the
   boundary" suggests. Over 2000 resamples of the designed twelve, 79.2% choose
   a different first split than the full-data tree, there are 166 distinct
   structures, and the most common appears 6.5% of the time — yet the pooled
   vote differs from that single tree on only 3.7% of the plane (0.00% at
   n = 24). The structure is nearly meaningless; the prediction is stable. That
   3.7% is still worth +2.30 points of accuracy at n = 12 (0.8852 -> 0.9082,
   300 training seeds, 20000 fresh test points), and the gain SHRINKS as n
   grows: +1.13 at 24, +0.71 at 40. So the claim is about stability, with
   accuracy as its consequence — not the other way round.

   minLeaf is 1, not the rings widget's 2: a twelve-point set grown fully is
   the honest demonstration of "keep splitting until pure", and a floor of 2
   would stop the third split — the one that shows a feature used twice.
   ========================================================================= */

import { defineWidget, makePlot, makeRng } from "../core/index.js";

/* ---- the samples ------------------------------------------------------- */

/* Integer coordinates so every threshold is a midpoint a reader can verify:
   5.5, 5.5, 9. Chosen so the tree is three splits deep and its SHAPE matches
   the lecture slide — the root's low child is a leaf, the second split's high
   child is a leaf, the third split's children are both leaves.

   Margins are deliberately clear rather than tied (0.0212, 0.0476, 0.3333): a
   tie at the root would teach the tie-break before it had taught the search.
   A tie does occur further down the root's own candidate list, which is where
   the readout points at it instead. */
const DESIGNED = [
  { x1: 1,  x2: 2, y: -1 }, { x1: 2,  x2: 6, y: -1 }, { x1: 3,  x2: 3, y: -1 },
  { x1: 2,  x2: 9, y: -1 }, { x1: 4,  x2: 5, y: -1 }, { x1: 7,  x2: 2, y: -1 },
  { x1: 8,  x2: 4, y: -1 }, { x1: 7,  x2: 8, y: +1 }, { x1: 8,  x2: 9, y: +1 },
  { x1: 9,  x2: 7, y: +1 }, { x1: 10, x2: 8, y: +1 }, { x1: 10, x2: 3, y: +1 },
];

/* The larger sets keep the SAME four regions as the designed twelve, so the
   lesson does not change when the sample count does — only the number of
   candidates to sweep, which is the point of offering them.

   Rounded to 0.1 rather than to integers: integers on an 11 x 11 grid put two
   points of OPPOSITE class on the same coordinate at n = 40, which no
   threshold can separate, and "every leaf is pure" quietly stops being true. */
const REGIONS = [
  { cx: 2.6, cy: 5.2, sx: 1.25, sy: 2.45, y: -1, w: 0.38 },
  { cx: 8.6, cy: 8.1, sx: 1.15, sy: 1.00, y: +1, w: 0.30 },
  { cx: 7.1, cy: 2.7, sx: 0.75, sy: 0.95, y: -1, w: 0.17 },
  { cx: 9.9, cy: 2.9, sx: 0.60, sy: 1.05, y: +1, w: 0.15 },
];

const DOM = [0, 11];
const MIN_LEAF = 1;
const BAG_B = 50;
const FEAT = ["x₁", "x₂"];
const SAMPLE_COUNTS = [12, 24, 40];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const valueOf = (p, j) => (j === 0 ? p.x1 : p.x2);

/**
 * The samples for a given count.
 *
 * Twelve is the designed set and is returned verbatim; the larger counts are
 * generated from `rng`, which is core's seeded one, so the whole figure stays
 * reproducible from the URL.
 */
function makeSamples(n, rng) {
  if (n === 12) return DESIGNED.slice();
  const out = [];
  REGIONS.forEach((r, i) => {
    const want = i === REGIONS.length - 1 ? n - out.length : Math.max(2, Math.round(n * r.w));
    for (let k = 0; k < want; k += 1) {
      out.push({
        x1: Math.round(clamp(rng.normal(r.cx, r.sx), 0.4, 10.6) * 10) / 10,
        x2: Math.round(clamp(rng.normal(r.cy, r.sy), 0.4, 10.6) * 10) / 10,
        y: r.y,
      });
    }
  });
  return out;
}

/* ---- the protocol ------------------------------------------------------
   Candidate thresholds are midpoints of consecutive DISTINCT values, the
   score is the weighted Gini of the two children, ties go to the lower
   feature index then the lower threshold, `x[j] <= t` goes left, and a leaf
   ties to -1. Every clause is observable on screen, which is why they are
   written out rather than left to the code.
   ----------------------------------------------------------------------- */

function gini(n0, n1) {
  const n = n0 + n1;
  if (n <= 0) return 0;
  const p0 = n0 / n, p1 = n1 / n;
  return 1 - p0 * p0 - p1 * p1;
}

const countsOf = (pts, idx) => {
  let n0 = 0, n1 = 0;
  for (const i of idx) { if (pts[i].y > 0) n1 += 1; else n0 += 1; }
  return { n0, n1 };
};

/**
 * EVERY valid candidate split of a node, each with its weighted child Gini.
 *
 * Returned in the rule's own order — feature index ascending, then threshold
 * ascending — so "the first minimum wins" IS the tie-break, with no second
 * pass that could disagree with it. The animation sweeps this array in order,
 * so what the reader watches is literally the rule executing.
 */
function scanNode(pts, idx) {
  const { n0: T0, n1: T1 } = countsOf(pts, idx);
  const n = idx.length;
  const out = [];

  for (let j = 0; j < 2; j += 1) {
    const order = idx.slice().sort((a, b) => valueOf(pts[a], j) - valueOf(pts[b], j));
    let L0 = 0, L1 = 0;
    for (let k = 1; k < n; k += 1) {
      const prev = order[k - 1];
      if (pts[prev].y > 0) L1 += 1; else L0 += 1;
      /* A threshold can only sit BETWEEN distinct values; splitting inside a
         run of equal values is not representable by `x[j] <= t`. */
      if (valueOf(pts[order[k]], j) === valueOf(pts[prev], j)) continue;
      if (k < MIN_LEAF || n - k < MIN_LEAF) continue;
      const R0 = T0 - L0, R1 = T1 - L1;
      out.push({
        feature: j,
        threshold: (valueOf(pts[prev], j) + valueOf(pts[order[k]], j)) / 2,
        score: (k * gini(L0, L1) + (n - k) * gini(R0, R1)) / n,
        nL: k, nR: n - k, giniL: gini(L0, L1), giniR: gini(R0, R1),
      });
    }
  }
  return out;
}

/** Strictly-less accepted, so scan order IS the tie-break. */
function winnerOf(cands) {
  let best = null;
  for (const c of cands) if (best === null || c.score < best.score) best = c;
  return best;
}

const newNode = (idx, depth, rect) => ({
  idx, depth, rect, counts: null, gini: 0,
  feature: null, threshold: null, left: null, right: null, leaf: null,
});

const cutRect = (r, feature, side, threshold) => {
  const q = { ...r };
  if (feature === 0) { if (side === "lo") q.x1 = threshold; else q.x0 = threshold; }
  else { if (side === "lo") q.y1 = threshold; else q.y0 = threshold; }
  return q;
};

/** Grow a prepared node in place. Used by both pages. */
function growInto(pts, node) {
  const { n0, n1 } = countsOf(pts, node.idx);
  node.counts = { n0, n1 };
  node.gini = gini(n0, n1);
  if (n0 === 0 || n1 === 0 || node.idx.length < 2 * MIN_LEAF) {
    node.leaf = n1 > n0 ? +1 : -1;
    return;
  }
  const win = winnerOf(scanNode(pts, node.idx));
  if (!win) { node.leaf = n1 > n0 ? +1 : -1; return; }
  const lo = [], hi = [];
  for (const i of node.idx) {
    if (valueOf(pts[i], win.feature) <= win.threshold) lo.push(i); else hi.push(i);
  }
  node.feature = win.feature;
  node.threshold = win.threshold;
  node.left = newNode(lo, node.depth + 1, cutRect(node.rect, win.feature, "lo", win.threshold));
  node.right = newNode(hi, node.depth + 1, cutRect(node.rect, win.feature, "hi", win.threshold));
  growInto(pts, node.left);
  growInto(pts, node.right);
}

const FULL_RECT = { x0: DOM[0], x1: DOM[1], y0: DOM[0], y1: DOM[1] };
const rootOver = (pts) => newNode(pts.map((_, i) => i), 0, { ...FULL_RECT });

/**
 * The tree, plus the ordered list of steps that built it.
 *
 * Breadth-first, so the reader watches a level complete before the next
 * begins. Depth-first would jump from the root to a great-grandchild and back,
 * which reads as the tree being built twice.
 */
function buildStepwise(pts) {
  const root = rootOver(pts);
  const steps = [];
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    const { n0, n1 } = countsOf(pts, node.idx);
    node.counts = { n0, n1 };
    node.gini = gini(n0, n1);
    if (n0 === 0 || n1 === 0 || node.idx.length < 2 * MIN_LEAF) {
      node.leaf = n1 > n0 ? +1 : -1;
      continue;
    }
    const cands = scanNode(pts, node.idx);
    const win = winnerOf(cands);
    if (!win) { node.leaf = n1 > n0 ? +1 : -1; continue; }
    const lo = [], hi = [];
    for (const i of node.idx) {
      if (valueOf(pts[i], win.feature) <= win.threshold) lo.push(i); else hi.push(i);
    }
    node.feature = win.feature;
    node.threshold = win.threshold;
    node.left = newNode(lo, node.depth + 1, cutRect(node.rect, win.feature, "lo", win.threshold));
    node.right = newNode(hi, node.depth + 1, cutRect(node.rect, win.feature, "hi", win.threshold));
    steps.push({ node, cands, win });
    queue.push(node.left, node.right);
  }
  return { root, steps };
}

const isLeafNode = (n) => n.feature === null;
const cutsOf = (n, out = []) => {
  if (!isLeafNode(n)) { out.push(n); cutsOf(n.left, out); cutsOf(n.right, out); }
  return out;
};
const leavesOf = (n, out = []) => {
  if (isLeafNode(n)) out.push(n); else { leavesOf(n.left, out); leavesOf(n.right, out); }
  return out;
};
const signatureOf = (n) =>
  isLeafNode(n) ? `L${n.leaf}` : `(${n.feature}<=${n.threshold}${signatureOf(n.left)}${signatureOf(n.right)})`;
const predictAt = (n, x1, x2) =>
  isLeafNode(n) ? n.leaf : ((n.feature === 0 ? x1 : x2) <= n.threshold ? predictAt(n.left, x1, x2) : predictAt(n.right, x1, x2));

const ordinal = (n) => {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/* ---- the bag ------------------------------------------------------------ */

const VOTE_GRID = 110;
const voteCell = (g) => DOM[0] + ((g + 0.5) / VOTE_GRID) * (DOM[1] - DOM[0]);

function buildBag(pts, rng) {
  const n = pts.length;
  const trees = [];
  for (let b = 0; b < BAG_B; b += 1) {
    /* Multiplicity, not a shuffled index list: the panel draws each sample at
       a size set by how many times it was drawn, and 0 is the out-of-bag case
       the reader is meant to notice. */
    const count = new Array(n).fill(0);
    const idx = [];
    for (let i = 0; i < n; i += 1) {
      const r = Math.floor(rng.next() * n);
      count[r] += 1;
      idx.push(r);
    }
    const root = newNode(idx, 0, { ...FULL_RECT });
    growInto(pts, root);
    trees.push({
      root, count,
      oob: count.filter((c) => c === 0).length,
      cuts: cutsOf(root),
      sig: signatureOf(root),
    });
  }

  /* Cumulative vote after each tree, rasterised once. 50 x 110 x 110 Int8 is
     605 KB and removes every per-frame fit — invariant 2 is the reason this is
     built here and not in `draw`. */
  const cum = [];
  const run = new Float32Array(VOTE_GRID * VOTE_GRID);
  for (let b = 0; b < BAG_B; b += 1) {
    for (let gy = 0; gy < VOTE_GRID; gy += 1) {
      const y = voteCell(gy);
      for (let gx = 0; gx < VOTE_GRID; gx += 1) {
        run[gy * VOTE_GRID + gx] += predictAt(trees[b].root, voteCell(gx), y);
      }
    }
    cum.push(Float32Array.from(run));
  }
  return { trees, cum };
}

/* ---- geometry -----------------------------------------------------------
   Core hands a widget ONE canvas, so the three panels are regions inside it
   rather than separate elements. Every size is derived from `w` so the figure
   holds together at any stage width, in an iframe as well as full screen.
   ----------------------------------------------------------------------- */

const PAD_L = 30, PAD_B = 14, GAP = 14;
const TITLE_H = 18;     /* a panel title, drawn above its rect */
const AXIS_H = 20;      /* tick labels, drawn below it */
const SHELF_INNER = 96;

/**
 * Every rectangle in the figure, from the width and the page.
 *
 * ONE function, called by both `height` and `draw` — principle 8. They were
 * briefly separate constants and the shelf's title landed on top of the
 * resample panel's tick labels, because only one of the two knew that an axis
 * needs room under it.
 */
function layoutOf(w, page) {
  const side = clamp(Math.floor((w - 2 * GAP) * 0.30), 176, 300);
  const treeW = Math.max(210, w - 2 * side - 2 * GAP);
  const panelTop = TITLE_H;
  const panelH = side - 22;
  const panelBottom = panelTop + panelH;
  const shelfTop = panelBottom + AXIS_H + TITLE_H + 8;

  const P1 = { x: PAD_L, y: panelTop, w: side - PAD_L, h: panelH };
  const P2 = { x: P1.x + P1.w + GAP + PAD_L, y: panelTop, w: side - PAD_L, h: panelH };
  const P3 = { x: P2.x + P2.w + GAP, y: panelTop, w: treeW, h: panelH };
  const shelf = { x: PAD_L, y: shelfTop, w: w - PAD_L - 8, h: SHELF_INNER };

  return {
    side, treeW, P1, P2, P3, shelf,
    height: page === "bag"
      ? shelfTop + SHELF_INNER + PAD_B
      : panelBottom + AXIS_H + PAD_B,
  };
}

const canvasHeight = ({ page, w }) => layoutOf(w, page).height;

/* ---- the animation ------------------------------------------------------
   Core owns the clock, the buttons and reduced motion; this supplies `init`
   and `advance` only. Both pages keep their OWN cursor inside `anim`, because
   `page` is a display parameter and switching it must not discard the work on
   the page being left (invariant 4).

   THE TREE page runs scan -> commit -> rest per split. Resting has no clock:
   `advance` returns false and leaves `anim` in place, so the finished score
   curve stays up until the reader asks for the next split. Under Play core
   calls again immediately, which is what makes Play continuous and Step
   deliberate without either needing a second code path.

   THE BAG page runs draw -> fit per tree. Page one's candidate sweep is NOT
   replayed: fifty sweeps is not something anyone would watch, and by this page
   the reader already knows how one tree is built.

   Pace is per CANDIDATE, not per step, so a 14-candidate search visibly takes
   longer than a 4-candidate one. More work does take longer, and a fixed
   per-step duration would flatten that away.
   ----------------------------------------------------------------------- */

/* Past the top rung the per-tree choreography switches off and only the
   arrivals are shown — a declared property of the chosen speed, not something
   the animation decides about itself mid-run (README, "Pacing is chosen"). */
const SPEEDS = [
  { key: "slow", label: "Slow", mult: 0.5, flip: false, detail: "every candidate, unhurried" },
  { key: "steady", label: "Steady", mult: 1, flip: false, detail: "the default pace" },
  { key: "brisk", label: "Brisk", mult: 2, flip: false, detail: "twice as fast, still drawn in full" },
  { key: "flip", label: "Flipbook", mult: 4, flip: true, detail: "trees arrive whole — for watching the pool settle" },
];
const speedOf = (params) => SPEEDS[Number(params.speed)] ?? SPEEDS[1];

const MS_PER_CAND = 300, COMMIT_MS = 750;
const DRAW_MS = 220, FIT_MS = 300, FLIP_MS = 150;

const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

/* ---- drawing ------------------------------------------------------------ */

function planeFrame(ctx, colors, R) {
  const sx = (v) => R.x + ((v - DOM[0]) / (DOM[1] - DOM[0])) * R.w;
  const sy = (v) => R.y + R.h - ((v - DOM[0]) / (DOM[1] - DOM[0])) * R.h;

  /* No gridlines. A line at every integer put 24 of them behind 12 samples and
     competed with the cut lines, which are the thing being looked at. Ticks
     and their labels carry the scale on their own. */
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R.x, Math.round(R.y + R.h) + 0.5);
  ctx.lineTo(R.x + R.w, Math.round(R.y + R.h) + 0.5);
  ctx.moveTo(Math.round(R.x) + 0.5, R.y);
  ctx.lineTo(Math.round(R.x) + 0.5, R.y + R.h);
  ctx.stroke();

  ctx.fillStyle = colors.ink3;
  ctx.font = `10px ${colors.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let v = 0; v <= 10; v += 2) {
    ctx.beginPath();
    ctx.moveTo(Math.round(sx(v)) + 0.5, R.y + R.h);
    ctx.lineTo(Math.round(sx(v)) + 0.5, R.y + R.h + 4);
    ctx.stroke();
    ctx.fillText(String(v), sx(v), R.y + R.h + 6);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let v = 2; v <= 10; v += 2) {
    ctx.beginPath();
    ctx.moveTo(R.x - 4, Math.round(sy(v)) + 0.5);
    ctx.lineTo(R.x, Math.round(sy(v)) + 0.5);
    ctx.stroke();
    ctx.fillText(String(v), R.x - 6, sy(v));
  }
  return { sx, sy };
}

function panelTitle(ctx, colors, R, text) {
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 11px ${colors.font}`;
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText(text, R.x, R.y - 6);
}

function drawSamples(ctx, colors, S, pts, focus) {
  const on = focus ? new Set(focus) : null;
  const r = pts.length > 30 ? 4 : pts.length > 16 ? 4.8 : 5.6;
  pts.forEach((p, i) => {
    ctx.globalAlpha = on && !on.has(i) ? 0.2 : 1;
    ctx.fillStyle = p.y > 0 ? colors.event : colors.nonevent;
    ctx.beginPath(); ctx.arc(S.sx(p.x1), S.sy(p.x2), r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.surface; ctx.lineWidth = 1.4; ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function cutLine(ctx, S, rect, feature, threshold) {
  ctx.beginPath();
  if (feature === 0) {
    ctx.moveTo(S.sx(threshold), S.sy(rect.y0));
    ctx.lineTo(S.sx(threshold), S.sy(rect.y1));
  } else {
    ctx.moveTo(S.sx(rect.x0), S.sy(threshold));
    ctx.lineTo(S.sx(rect.x1), S.sy(threshold));
  }
  ctx.stroke();
}

/* The sweep as a CONTINUOUS position in candidate-index space, so the line
   glides between thresholds instead of stepping. The one place it cannot glide
   is the crossing from x₁ to x₂, where the line changes orientation — it fades
   through zero there instead, which also marks the moment the search changes
   feature, and that is worth marking. */
function sweepAt(cands, u) {
  const p = clamp(u, 0, 1) * (cands.length - 1);
  const i0 = Math.floor(p), i1 = Math.min(cands.length - 1, i0 + 1), frac = p - i0;
  const a = cands[i0], b = cands[i1];
  const same = a.feature === b.feature;
  return {
    scored: i0 + 1,
    feature: same || frac < 0.5 ? a.feature : b.feature,
    threshold: same ? a.threshold + (b.threshold - a.threshold) * frac : (frac < 0.5 ? a.threshold : b.threshold),
    score: same ? a.score + (b.score - a.score) * frac : (frac < 0.5 ? a.score : b.score),
    alpha: same ? 1 : Math.abs(frac - 0.5) * 2,
  };
}

/** The score summary: one point per candidate, and a minimum that only falls. */
function drawScan(ctx, colors, R, step, sweep, settled) {
  if (!step) return;
  const L = 34, TOP = 10, B = 22;
  const cands = step.cands;
  const hi = Math.max(...cands.map((c) => c.score)) * 1.1 || 1;
  const px = (t) => R.x + L + ((t - DOM[0]) / (DOM[1] - DOM[0])) * (R.w - L);
  const py = (s) => R.y + R.h - B - (s / hi) * (R.h - B - TOP);

  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.fillStyle = colors.ink3; ctx.font = `10px ${colors.font}`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let g = 0; g <= 2; g += 1) {
    const v = (hi * g) / 2, y = Math.round(py(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(R.x + L, y); ctx.lineTo(R.x + R.w, y); ctx.stroke();
    ctx.fillText(v.toFixed(2), R.x + L - 4, py(v));
  }

  const upTo = settled ? cands.length : (sweep ? sweep.scored : 0);
  const seen = cands.slice(0, upTo);
  const dot = cands.length > 40 ? 1.7 : 2.4;

  [0, 1].forEach((j) => {
    const s = seen.filter((c) => c.feature === j).sort((a, b) => a.threshold - b.threshold);
    if (!s.length) return;
    ctx.strokeStyle = j === 0 ? colors.theory : colors.smoothed;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    s.forEach((c, i) => (i ? ctx.lineTo(px(c.threshold), py(c.score)) : ctx.moveTo(px(c.threshold), py(c.score))));
    /* Extended to where the sweep actually IS, so the curve does not lag a
       whole candidate behind the plane's cut line. */
    if (!settled && sweep && sweep.feature === j) ctx.lineTo(px(sweep.threshold), py(sweep.score));
    ctx.stroke();
    ctx.fillStyle = j === 0 ? colors.theory : colors.smoothed;
    s.forEach((c) => { ctx.beginPath(); ctx.arc(px(c.threshold), py(c.score), dot, 0, Math.PI * 2); ctx.fill(); });
  });

  if (seen.length) {
    const best = winnerOf(seen);
    ctx.strokeStyle = colors.highlight;
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R.x + L, Math.round(py(best.score)) + 0.5);
    ctx.lineTo(R.x + R.w, Math.round(py(best.score)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = settled ? 2.2 : 1.8;
    ctx.beginPath(); ctx.arc(px(best.threshold), py(best.score), settled ? 5.5 : 4.5, 0, Math.PI * 2); ctx.stroke();
  }

  if (sweep && !settled) {
    ctx.globalAlpha = sweep.alpha;
    ctx.fillStyle = colors.highlight;
    ctx.beginPath(); ctx.arc(px(sweep.threshold), py(sweep.score), 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.ink3; ctx.font = `10px ${colors.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let v = 0; v <= 10; v += 2) ctx.fillText(String(v), px(v), R.y + R.h - B + 4);
  ctx.fillText("threshold t", (R.x + L + R.x + R.w) / 2, R.y + R.h - 10);
}

/* Connector endpoints taken RADIALLY — along the line joining the two centres
   — so an edge meets each circle perpendicular to its tangent. Running them
   from the parent's bottom-centre to the child's top-centre leaves the line
   detached at one end and buried in the circle at the other on any diagonal. */
function treeLayout(root, R, useFinal) {
  let slot = 0, maxD = 0;
  (function pos(n) {
    maxD = Math.max(maxD, n.depth);
    if (!isLeafNode(n)) { pos(n.left); pos(n.right); n._c = (n.left._c + n.right._c) / 2; }
    else n._c = slot++;
  })(root);
  const padX = Math.min(34, R.w * 0.12), padY = 24;
  return {
    slot, maxD,
    gx: (c) => R.x + padX + (slot <= 1 ? (R.w - 2 * padX) / 2 : (c / (slot - 1)) * (R.w - 2 * padX)),
    gy: (d) => R.y + padY + (maxD === 0 ? 0 : (d / maxD) * (R.h - 2 * padY - 10)),
  };
}

function drawTreeDiagram(ctx, colors, R, root, opts) {
  const { committed = null, active = null, arriving = 1, labels = true } = opts ?? {};
  const live = committed ? new Set(committed) : null;
  const shown = (n) => (live ? live.has(n) : !isLeafNode(n));

  /* Laid out over the FINAL tree, not the visible one: laying out what is
     currently on screen re-columns everything each time a split lands, so
     nodes the reader is already watching slide sideways to make room. */
  const L = treeLayout(root, R);
  const visible = [];
  (function collect(n) { visible.push(n); if (shown(n)) { collect(n.left); collect(n.right); } })(root);

  const R_SPLIT = 13, R_LEAF = 11;
  const at = new Map();
  visible.forEach((n) => at.set(n, { x: L.gx(n._c), y: L.gy(n.depth), r: shown(n) ? R_SPLIT : R_LEAF }));

  if (active && arriving < 1) {
    const p = at.get(active);
    [active.left, active.right].forEach((kid) => {
      const q = at.get(kid);
      if (!q || !p) return;
      at.set(kid, { x: p.x + (q.x - p.x) * arriving, y: p.y + (q.y - p.y) * arriving, r: q.r * (0.3 + 0.7 * arriving) });
    });
    at.set(active, { ...p, r: R_LEAF + (R_SPLIT - R_LEAF) * arriving });
  }

  ctx.font = `10px ${colors.font}`;
  visible.filter(shown).forEach((n) => {
    const u = n === active ? arriving : 1;
    [[n.left, "≤"], [n.right, ">"]].forEach(([kid, rel]) => {
      const a = at.get(n), b = at.get(kid);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      if (len <= a.r + b.r + 1) return;
      const ux = dx / len, uy = dy / len;
      const x1 = a.x + ux * a.r, y1 = a.y + uy * a.r;
      const x2 = b.x - ux * b.r, y2 = b.y - uy * b.r;
      ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (!labels) return;
      ctx.globalAlpha = u * u;
      ctx.fillStyle = colors.ink3;
      ctx.textAlign = rel === "≤" ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rel} ${n.threshold}`, (x1 + x2) / 2 + (rel === "≤" ? -5 : 5), (y1 + y2) / 2);
      ctx.globalAlpha = 1;
    });
  });

  visible.forEach((n) => {
    const { x, y, r } = at.get(n);
    const isNew = active && (n === active.left || n === active.right);
    const u = isNew ? arriving : 1;
    ctx.globalAlpha = u;
    if (shown(n)) {
      ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = n === active ? arriving : 1;
      ctx.fillStyle = colors.ink1; ctx.font = `11px ${colors.font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(FEAT[n.feature], x, y + 0.5);
    } else if (isLeafNode(n)) {
      /* A leaf carries its predicted class as a filled disc — the lecture
         slide's own convention, and why the diagram needs no legend row. */
      ctx.fillStyle = n.leaf > 0 ? colors.event : colors.nonevent;
      ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (labels && u > 0.75) {
        ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`n = ${n.idx.length}`, x, y + r + 4);
      }
    } else {
      const searching = n === active;
      ctx.fillStyle = colors.surface;
      ctx.strokeStyle = searching ? colors.highlight : colors.ink3;
      ctx.lineWidth = searching ? 2.5 : 1.4;
      ctx.setLineDash(searching ? [] : [3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      if (labels && u > 0.75 && r > 8) {
        ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${n.counts.n0}:${n.counts.n1}`, x, y + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  });
}

/* ---- the shelf: every tree in the bag, as silhouettes -------------------
   Chosen from three mock-ups (widgets/_lab/bag-trees.html). A shelf under the
   row leaves all three panels intact and gives each tree ~46 px, against 38 px
   for a grid replacing the tree panel and 26 px for a strip squeezed under it.

   A miniature carries NO labels: at this size nothing readable survives, and
   the point is not any one tree but that the shapes differ. Leaf colour is the
   only information worth keeping, and it survives.
   ----------------------------------------------------------------------- */
function miniature(ctx, colors, root, x0, y0, s, fresh) {
  const pad = s * 0.16, w = s - 2 * pad, h = s - 2 * pad;
  let slot = 0, maxD = 0;
  (function pos(n) {
    maxD = Math.max(maxD, n.depth);
    if (!isLeafNode(n)) { pos(n.left); pos(n.right); n._m = (n.left._m + n.right._m) / 2; }
    else n._m = slot++;
  })(root);
  const gx = (c) => x0 + pad + (slot <= 1 ? w / 2 : (c / (slot - 1)) * w);
  const gy = (d) => y0 + pad + (maxD === 0 ? 0 : (d / maxD) * h);

  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = Math.max(0.7, s * 0.022);
  (function edges(n) {
    if (isLeafNode(n)) return;
    for (const kid of [n.left, n.right]) {
      ctx.beginPath(); ctx.moveTo(gx(n._m), gy(n.depth)); ctx.lineTo(gx(kid._m), gy(kid.depth)); ctx.stroke();
      edges(kid);
    }
  })(root);
  (function dots(n) {
    const leaf = isLeafNode(n);
    ctx.fillStyle = leaf ? (n.leaf > 0 ? colors.event : colors.nonevent) : colors.ink2;
    ctx.beginPath();
    ctx.arc(gx(n._m), gy(n.depth), leaf ? Math.max(1.3, s * 0.055) : Math.max(1, s * 0.035), 0, Math.PI * 2);
    ctx.fill();
    if (!leaf) { dots(n.left); dots(n.right); }
  })(root);

  if (fresh) {
    ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1.4;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, s - 1, s - 1);
  }
}

function drawShelf(ctx, colors, R, bag, k) {
  const cols = Math.ceil(BAG_B / 2);
  const s = Math.min(R.w / cols, R.h / 2);
  const ox = R.x + (R.w - s * cols) / 2, oy = R.y + (R.h - s * 2) / 2;
  for (let i = 0; i < BAG_B; i += 1) {
    const cx = ox + (i % cols) * s, cy = oy + Math.floor(i / cols) * s;
    if (i < k) miniature(ctx, colors, bag.trees[i].root, cx, cy, s, i === k - 1);
    else {
      /* An empty slot, so how much bag is still to come is visible too. */
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(cx + s * 0.18 + 0.5, cy + s * 0.18 + 0.5, s * 0.64, s * 0.64);
      ctx.setLineDash([]);
    }
  }
}

/* Pooled vote as a fill: where the trees disagree, the colour sits between.
   ONE blit of a cached raster, not 12100 fillRects.

   The per-cell version froze the renderer outright — 110 x 110 rectangles and
   as many colour strings, on every animation frame. The raster only changes
   when the tree count or the theme does, so it is built then and reused. */
const voteBuf = document.createElement("canvas").getContext("2d");
voteBuf.canvas.width = VOTE_GRID;
voteBuf.canvas.height = VOTE_GRID;
let voteCache = { bag: null, k: -1, ink: "" };

function drawVote(ctx, colors, R, bag, k) {
  if (k === 0) return;
  const ink = `${colors.event}|${colors.nonevent}`;
  if (voteCache.bag !== bag || voteCache.k !== k || voteCache.ink !== ink) {
    const sum = bag.cum[k - 1];
    const img = voteBuf.createImageData(VOTE_GRID, VOTE_GRID);
    const A = colors._rgbNonevent, B = colors._rgbEvent;
    for (let gy = 0; gy < VOTE_GRID; gy += 1) {
      for (let gx = 0; gx < VOTE_GRID; gx += 1) {
        const f = (sum[gy * VOTE_GRID + gx] / k + 1) / 2;
        const o = ((VOTE_GRID - 1 - gy) * VOTE_GRID + gx) * 4;
        img.data[o] = A[0] + (B[0] - A[0]) * f;
        img.data[o + 1] = A[1] + (B[1] - A[1]) * f;
        img.data[o + 2] = A[2] + (B[2] - A[2]) * f;
        img.data[o + 3] = 140;
      }
    }
    voteBuf.putImageData(img, 0, 0);
    voteCache = { bag, k, ink };
  }
  ctx.drawImage(voteBuf.canvas, R.x, R.y, R.w, R.h);
}

/* Resolve a token to [r, g, b] by letting the BROWSER parse it. Hand-parsing
   was tried and shipped a green decision region: tokens.css writes colours as
   hex, and `"#3b82f6".match(/\d+/g)` yields [3, 82, 6] — a plausible-looking
   triple that is not the colour. */
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
probe.canvas.width = 1; probe.canvas.height = 1;
function resolveRGB(css) {
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/* ========================================================================= */

defineWidget({
  slug: "trees-and-ensembles",
  title: "Trees and Ensembles",
  status: "draft",
  layout: "side",
  height: canvasHeight,

  subtitle:
    "A decision tree splits the plane one axis-aligned cut at a time, choosing at each step the "
    + "feature and the threshold that leave the two sides purest. A bag is many such trees, each "
    + "fitted to a resample of the same data, and their votes pooled.",

  params: {
    /* Reading order is the instruction (3.1): which page, then what it is
       looking at, then the dial that paces it. */
    page: {
      type: "segmented",
      label: "Show",
      options: [
        { value: "tree", label: "One tree", detail: "How a single tree chooses each split." },
        { value: "bag", label: "A bag of trees", detail: "The same samples resampled, one tree each, votes pooled." },
      ],
      default: "tree",
      /* Display, not data: the samples and both fits are unchanged by it, so
         switching pages must not discard the work on the page being left. */
      display: true,
    },
    samples: {
      type: "choice",
      label: "Samples",
      options: SAMPLE_COUNTS.map((n, i) => ({
        value: String(i),
        label: String(n),
        detail: n === 12
          ? "12 — the designed set, small enough to check by hand"
          : `${n} — same four regions, more candidates to sweep`,
      })),
      default: "0",
    },
    speed: {
      type: "choice",
      label: "Pace",
      options: SPEEDS.map((s, i) => ({ value: String(i), label: s.label, detail: s.detail })),
      default: "1",
      display: true,
    },
    /* Authored head start, applied on first render only, so a lesson can link
       to a finished figure without the widget opening on its own answer
       (invariant 5). Reads as splits on page one and trees on page two. */
    shown: { type: "int", label: "Shown", min: 0, max: BAG_B, default: 0, hidden: true },
  },

  legend: [
    { token: "nonevent", label: "Class y = −1", mark: "dot" },
    { token: "event", label: "Class y = +1", mark: "dot" },
    { token: "highlight", label: "The cut being scored, and the one chosen", mark: "line" },
    { token: "theory", label: "Score of every x₁ threshold", mark: "line" },
    { token: "smoothed", label: "Score of every x₂ threshold", mark: "line" },
  ],

  compute({ params, rng }) {
    const n = SAMPLE_COUNTS[Number(params.samples)];
    const pts = makeSamples(n, rng);
    const { root, steps } = buildStepwise(pts);
    const bag = buildBag(pts, rng);
    return { pts, root, steps, bag, leaves: leavesOf(root) };
  },

  animation: {
    /* `stepLabel` takes the per-parameter map because the step verb genuinely
       differs by page — a split is not a resample. `runLabel` does NOT: core
       reads it as a plain string, because the run button relabels itself at
       runtime (Play -> Pause -> Resume -> Replay) and a per-page map would
       collide with that. Both pages want "Play", which is the default, so it
       is omitted rather than restated. */
    stepLabel: { param: "page", labels: { bag: "Draw one resample" }, default: "Find the next split" },

    init: ({ params, state, fromScratch }) => {
      const head = fromScratch ? 0 : Math.max(0, Number(params.shown) || 0);
      return {
        tree: { k: Math.min(head, state.steps.length), phase: "idle", t: 0 },
        bag: { k: Math.min(head, BAG_B), phase: "idle", t: 0 },
        done: false,
      };
    },

    /* ONE UNIT IS ONE SPLIT, or one resample. When a unit finishes, `advance`
       returns false under Step and true under Play — core's contract, and the
       whole of the difference between the two buttons.

       Returning false STOPS and leaves `anim` in place, so the finished score
       curve stays on screen for as long as the reader wants it. A "rest" phase
       was written to do that before reading the contract properly; it was
       core's existing behaviour with extra state bolted on. */
    advance(anim, { dt, params, state }) {
      const sp = speedOf(params);
      const running = anim.mode === "run";

      if (params.page === "bag") {
        const b = anim.bag;
        if (b.k >= BAG_B) { anim.done = true; return false; }
        if (b.phase === "idle") { b.phase = sp.flip ? "fit" : "draw"; b.t = 0; }
        b.t += dt;
        const drawMs = sp.flip ? 0 : DRAW_MS / sp.mult;
        const fitMs = sp.flip ? FLIP_MS * (2 / sp.mult) : FIT_MS / sp.mult;
        if (b.phase === "draw" && b.t >= drawMs) { b.phase = "fit"; b.t = 0; }
        else if (b.phase === "fit" && b.t >= fitMs) {
          b.k += 1; b.phase = "idle"; b.t = 0;
          anim.done = b.k >= BAG_B;
          return running && !anim.done;
        }
        return true;
      }

      const a = anim.tree;
      const step = state.steps[a.k];
      if (!step) { anim.done = true; return false; }
      if (a.phase === "idle") { a.phase = "scan"; a.t = 0; }
      a.t += dt;
      const scanMs = Math.pow(step.cands.length, 0.72) * MS_PER_CAND / sp.mult;
      if (a.phase === "scan" && a.t >= scanMs) { a.phase = "commit"; a.t = 0; }
      else if (a.phase === "commit" && a.t >= COMMIT_MS / sp.mult) {
        a.k += 1; a.phase = "idle"; a.t = 0;
        anim.done = a.k >= state.steps.length;
        return running && !anim.done;
      }
      return true;
    },

    /* `samples` is a data parameter so core re-inits from empty; `page` and
       `speed` are display, and both cursors survive them untouched. */
    rebuild: (anim, { state }) => ({
      tree: { ...anim.tree, k: Math.min(anim.tree.k, state.steps.length) },
      bag: { ...anim.bag, k: Math.min(anim.bag.k, BAG_B) },
      done: anim.done,
    }),
  },

  draw({ ctx, colors, w, params, state, anim }) {
    if (!colors._rgbEvent) {
      colors._rgbEvent = resolveRGB(colors.event);
      colors._rgbNonevent = resolveRGB(colors.nonevent);
    }
    const L = layoutOf(w, params.page);
    if (params.page === "bag") drawBagPage(ctx, colors, L, params, state, anim);
    else drawTreePage(ctx, colors, L, params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    if (params.page === "bag") {
      const b = anim?.bag ?? { k: 0, phase: "idle" };
      const shown = b.k + (b.phase === "fit" ? 1 : 0);
      const drawn = state.bag.trees.slice(0, Math.max(1, shown));
      const distinct = new Set(state.bag.trees.slice(0, shown).map((t) => t.sig)).size;
      const rootSig = `${FEAT[state.steps[0].win.feature]} ≤ ${state.steps[0].win.threshold}`;
      const differing = state.bag.trees.slice(0, shown)
        .filter((t) => t.root.feature !== state.steps[0].win.feature
          || t.root.threshold !== state.steps[0].win.threshold).length;
      const cur = state.bag.trees[Math.min(Math.max(0, shown - 1), BAG_B - 1)];
      return [
        { label: "Trees pooled", value: `${shown} of ${BAG_B}`,
          note: shown ? `${cur.oob} of ${state.pts.length} left out of this one` : "none drawn yet" },
        { label: "Distinct shapes", value: shown ? String(distinct) : "—",
          note: shown ? `of ${shown} drawn` : "" },
        { label: "Chose a different first split", value: shown ? `${differing} of ${shown}` : "—",
          note: `the single tree chose ${rootSig}` },
      ];
    }

    const a = anim?.tree ?? { k: 0, phase: "idle" };
    const settled = a.phase === "commit";
    const live = a.phase === "scan" || settled;
    /* Same rule as the figure: at rest, report the search just finished. */
    const step = live ? state.steps[a.k] : (a.k > 0 ? state.steps[a.k - 1] : state.steps[0]);
    const splits = a.k + (settled ? 1 : 0);
    const known = settled || (!live && a.k > 0);
    const leaves = state.leaves.length;
    if (!step) {
      return [
        { label: "Splits", value: `${state.steps.length} of ${state.steps.length}`, note: "the tree is grown" },
        { label: "Regions", value: String(leaves), note: "each one class" },
        { label: "Misclassified", value: `0 of ${state.pts.length}`, note: "grown fully, not necessarily right" },
      ];
    }
    const sorted = step.cands.slice().sort((x, y) => x.score - y.score);
    const best = sorted[0];
    return [
      { label: "Splits", value: `${splits} of ${state.steps.length}`,
        note: `this node holds ${step.node.idx.length} of ${state.pts.length}` },
      { label: "Candidates", value: known ? `${step.cands.length} scored` : `${step.cands.length} to score`,
        note: `node Gini ${step.node.gini.toFixed(4)}` },
      { label: known ? "Lowest" : "Best so far",
        value: known ? best.score.toFixed(4) : "—",
        note: known ? `${FEAT[best.feature]} ≤ ${best.threshold}` : "press to search" },
    ];
  },
});

/* ---- the two pages ------------------------------------------------------ */

function drawTreePage(ctx, colors, R, params, state, anim) {
  const a = anim?.tree ?? { k: 0, phase: "idle", t: 0 };
  const sp = speedOf(params);
  const step = state.steps[a.k];
  const committed = state.steps.slice(0, a.k).map((s) => s.node);
  const scanning = a.phase === "scan";
  const settled = a.phase === "commit";
  const live = scanning || settled;

  /* At rest the phase is `idle` and `k` has already advanced, so the search
     worth looking at is the one just FINISHED. Reading `steps[k]` there showed
     an empty chart the moment a split landed — the panel the reader most wants
     to inspect, blanked at exactly the wrong moment. */
  const scanStep = live ? step : (a.k > 0 ? state.steps[a.k - 1] : null);
  const scanSettled = !live || settled;

  const scanMs = step ? Math.pow(step.cands.length, 0.72) * MS_PER_CAND / sp.mult : 1;
  const sweep = step && scanning ? sweepAt(step.cands, a.t / scanMs) : null;

  panelTitle(ctx, colors, R.P1, "the samples, and the cuts so far");
  const S = planeFrame(ctx, colors, R.P1);
  committed.forEach((n) => {
    ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2.2;
    cutLine(ctx, S, n.rect, n.feature, n.threshold);
  });

  if (step && live) {
    const r = step.node.rect;
    /* Only outline a node that is a PROPER sub-region: at the root the rect is
       the whole domain, so the dashed box traced the panel's own border and
       read as a frame rather than as "these samples". */
    if (r.x0 > DOM[0] || r.x1 < DOM[1] || r.y0 > DOM[0] || r.y1 < DOM[1]) {
      ctx.strokeStyle = colors.ink3; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4;
      ctx.strokeRect(S.sx(r.x0), S.sy(r.y1), S.sx(r.x1) - S.sx(r.x0), S.sy(r.y0) - S.sy(r.y1));
      ctx.setLineDash([]);
    }

    /* A short TRAIL behind the sweep, not every candidate scored so far.
       Drawing them all put a dozen faint axis-aligned lines across the panel,
       indistinguishable from gridlines — which had just been removed for being
       distracting, making the fix pointless. */
    if (scanning && sweep.scored > 1) {
      const TRAIL = 6;
      for (let i = Math.max(0, sweep.scored - 1 - TRAIL); i < sweep.scored - 1; i += 1) {
        const c = step.cands[i];
        if (c.feature !== sweep.feature) continue;
        ctx.globalAlpha = 0.3 * (1 - (sweep.scored - 1 - i) / TRAIL) * sweep.alpha;
        ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1;
        cutLine(ctx, S, r, c.feature, c.threshold);
      }
      ctx.globalAlpha = 1;
    }
    if (scanning) {
      ctx.globalAlpha = sweep.alpha;
      ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1.8;
      cutLine(ctx, S, r, sweep.feature, sweep.threshold);
      ctx.globalAlpha = 1;
    }
    if (settled) {
      const u = a.phase === "commit" ? easeOut(a.t / (COMMIT_MS / sp.mult)) : 1;
      ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1.3 + 1.3 * u;
      cutLine(ctx, S, r, step.win.feature, step.win.threshold);
    }
  }
  drawSamples(ctx, colors, S, state.pts, step && live ? step.node.idx : null);

  panelTitle(ctx, colors, R.P2, "weighted child Gini, every candidate");
  drawScan(ctx, colors, R.P2, scanStep, sweep, scanSettled);

  panelTitle(ctx, colors, R.P3, "the tree");
  drawTreeDiagram(ctx, colors, R.P3, state.root, {
    committed: settled ? [...committed, step.node] : committed,
    active: step && live ? step.node : null,
    arriving: a.phase === "commit" ? easeOut(a.t / (COMMIT_MS / sp.mult)) : 1,
  });
}

function drawBagPage(ctx, colors, R, params, state, anim) {
  const b = anim?.bag ?? { k: 0, phase: "idle", t: 0 };
  const sp = speedOf(params);
  const drawing = b.phase === "draw", fitting = b.phase === "fit";
  const inFlight = drawing || fitting;
  const shown = b.k + (fitting ? 1 : 0);

  /* The tree ON SCREEN is the one being added while a unit is in flight, and
     the LAST one added at rest. Showing only the in-flight tree blanked the
     resample and its diagram between presses and after the fiftieth — two
     thirds of the row emptying at exactly the moment a reader wants to compare
     the last tree against the pooled vote. */
  const showTree = inFlight || b.k > 0;
  const t = state.bag.trees[clamp(inFlight ? b.k : b.k - 1, 0, BAG_B - 1)];

  const drawU = sp.flip ? 1 : (drawing ? easeOut(b.t / (DRAW_MS / sp.mult)) : (showTree ? 1 : 0));
  const fitU = sp.flip ? 1 : (fitting ? easeOut(b.t / (FIT_MS / sp.mult)) : (showTree ? 1 : 0));

  panelTitle(ctx, colors, R.P1, "this resample");
  const S1 = planeFrame(ctx, colors, R.P1);
  if (t && showTree) {
    ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1.8; ctx.globalAlpha = fitU;
    t.cuts.forEach((n) => cutLine(ctx, S1, n.rect, n.feature, n.threshold));
    ctx.globalAlpha = 1;
    const base = state.pts.length > 30 ? 4 : state.pts.length > 16 ? 4.8 : 5.6;
    state.pts.forEach((p, i) => {
      const c = t.count[i], x = S1.sx(p.x1), y = S1.sy(p.x2);
      if (c === 0) {
        /* Out of bag: hollow, so "left out" is a different MARK and not just a
           paler version of "in". About a third are in this state at any moment,
           and that is the fact worth noticing. */
        ctx.globalAlpha = 0.3 + 0.25 * (1 - drawU);
        ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, base * 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      const rr = base * (1 + 0.3 * (c - 1) * drawU);
      ctx.fillStyle = p.y > 0 ? colors.event : colors.nonevent;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.surface; ctx.lineWidth = 1.4; ctx.stroke();
      if (c > 1) {
        ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.15; ctx.globalAlpha = drawU;
        ctx.beginPath(); ctx.arc(x, y, rr + 2.2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  } else {
    drawSamples(ctx, colors, S1, state.pts, null);
  }

  panelTitle(ctx, colors, R.P2, "the bag so far");
  const S2 = planeFrame(ctx, colors, R.P2);
  drawVote(ctx, colors, R.P2, state.bag, shown);
  drawSamples(ctx, colors, S2, state.pts, null);

  panelTitle(ctx, colors, R.P3, "the tree it grows");
  if (t && showTree) drawTreeDiagram(ctx, colors, R.P3, t.root, { arriving: fitU });

  panelTitle(ctx, colors, R.shelf, "every tree in the bag");
  drawShelf(ctx, colors, R.shelf, state.bag, shown);
}
