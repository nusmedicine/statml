/* =========================================================================
   Lab · tree-based methods, one widget
   -------------------------------------------------------------------------
   Page 1 of 3. A CART built one split at a time, with the SEARCH animated
   rather than asserted: a candidate line GLIDES across the node, the score
   curve traces out behind it, a running minimum tracks the best so far, and
   only then does the winner commit.

   Why a toy set rather than the rings: the rings stage answers "what shape
   can a tree draw", which is a different question from "how does a tree get
   built". At 180 points the candidate list is ~179 per feature and the
   search can only be asserted. At twelve it fits on a page and the
   arithmetic can be checked by hand — which is the point of a baseline.

   Why not import tree-forest-engine.js: its `bestSplit` discards the losing
   candidates, and the losers ARE the lesson. The protocol here is the same
   rule set (midpoints of consecutive distinct values, weighted child Gini,
   ties to the lower feature index then the lower threshold, `<=` goes left),
   differing only in returning the full scan.

   THE INVARIANT THAT SHAPES THIS FILE: every tree, every scan and every
   score is computed ONCE, in rebuild(), and only when a DATA parameter
   changes. The animation only reveals what is already there. Nothing is
   fitted per frame — the widget contract's second non-negotiable, and the
   reason scrubbing back to step 0 costs nothing.

   minLeaf is 1 here, not the rings widget's 2. A twelve-point set fully
   grown is the honest demonstration of "keep splitting until pure", and a
   floor of 2 would stop the third split — the one that shows a feature
   being used twice.
   ========================================================================= */

import { readTokens, themeMode } from "../core/env.js";
import { makeRng } from "../core/rng.js";

/* ---- the samples ------------------------------------------------------ */

/* The designed twelve. Integer coordinates so every threshold is a midpoint
   a reader can verify: 5.5, 5.5, 9. Chosen so the tree is three splits deep
   and its SHAPE matches the lecture slide — the root's low child is a leaf,
   the second split's high child is a leaf, the third split's children are
   both leaves.

   Margins are deliberately clear rather than tied (0.0212, 0.0476, 0.3333):
   a tie at the root would teach the tie-break before it had taught the
   search. A tie does occur further down the root's own candidate list, which
   is where the page points at it instead.

   Cross-checked against sklearn 1.9.0 DecisionTreeClassifier(criterion=
   "gini", min_samples_leaf=1): same features, same thresholds, 4 leaves,
   depth 3, 0 training errors. */
const DESIGNED = [
  { x1: 1,  x2: 2, y: -1 },
  { x1: 2,  x2: 6, y: -1 },
  { x1: 3,  x2: 3, y: -1 },
  { x1: 2,  x2: 9, y: -1 },
  { x1: 4,  x2: 5, y: -1 },
  { x1: 7,  x2: 2, y: -1 },
  { x1: 8,  x2: 4, y: -1 },
  { x1: 7,  x2: 8, y: +1 },
  { x1: 8,  x2: 9, y: +1 },
  { x1: 9,  x2: 7, y: +1 },
  { x1: 10, x2: 8, y: +1 },
  { x1: 10, x2: 3, y: +1 },
];

/* The larger sets keep the SAME four regions as the designed twelve, so the
   lesson does not change when the sample count does — only the number of
   candidates to sweep, which is the point of offering them.

   Coordinates are rounded to 0.1 rather than to integers. Integers on an
   11 x 11 grid put two points of OPPOSITE class on the same coordinate at
   n = 40, which no threshold can separate — the tree then stops with an
   impure leaf and "every leaf is pure" quietly stops being true. */
const REGIONS = [
  { cx: 2.6, cy: 5.2, sx: 1.25, sy: 2.45, y: -1, w: 0.38 },
  { cx: 8.6, cy: 8.1, sx: 1.15, sy: 1.00, y: +1, w: 0.30 },
  { cx: 7.1, cy: 2.7, sx: 0.75, sy: 0.95, y: -1, w: 0.17 },
  { cx: 9.9, cy: 2.9, sx: 0.60, sy: 1.05, y: +1, w: 0.15 },
];

const DOM = [0, 11];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function generate(n, seed = 1) {
  const rng = makeRng(seed);
  const out = [];
  REGIONS.forEach((r, i) => {
    const want = i === REGIONS.length - 1
      ? n - out.length
      : Math.max(2, Math.round(n * r.w));
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

const SAMPLE_SETS = {
  12: { label: "12 (designed)", pts: () => DESIGNED.slice() },
  24: { label: "24", pts: () => generate(24, 7) },
  40: { label: "40", pts: () => generate(40, 7) },
};

const FEAT = ["x₁", "x₂"];
const MIN_LEAF = 1;

/* ---- the protocol ----------------------------------------------------- */

function gini(n0, n1) {
  const n = n0 + n1;
  if (n <= 0) return 0;
  const p0 = n0 / n, p1 = n1 / n;
  return 1 - p0 * p0 - p1 * p1;
}

/* Everything below reads `PTS`, which rebuild() swaps. Kept module-level
   rather than threaded through every call because the scan is hot and the
   whole file is one page's worth of code. */
let PTS = DESIGNED.slice();
const valueOf = (p, j) => (j === 0 ? p.x1 : p.x2);

const countsOf = (idx) => {
  let n0 = 0, n1 = 0;
  for (const i of idx) { if (PTS[i].y > 0) n1 += 1; else n0 += 1; }
  return { n0, n1 };
};

/**
 * EVERY valid candidate split of a node, each with its weighted child Gini.
 *
 * Returned in the rule's own order — feature index ascending, then threshold
 * ascending — so "the first minimum wins" IS the tie-break, with no second
 * pass that could disagree with it. The animation sweeps this array in
 * order, so what the reader watches is literally the rule executing.
 */
function scan(idx) {
  const { n0: T0, n1: T1 } = countsOf(idx);
  const n = idx.length;
  const out = [];

  for (let j = 0; j < 2; j += 1) {
    const order = idx.slice().sort((a, b) => valueOf(PTS[a], j) - valueOf(PTS[b], j));
    let L0 = 0, L1 = 0;

    for (let k = 1; k < n; k += 1) {
      const prev = order[k - 1];
      if (PTS[prev].y > 0) L1 += 1; else L0 += 1;

      /* A threshold can only sit BETWEEN distinct values; splitting inside a
         run of equal values is not representable by `x[j] <= t`. */
      if (valueOf(PTS[order[k]], j) === valueOf(PTS[prev], j)) continue;
      if (k < MIN_LEAF || n - k < MIN_LEAF) continue;

      const R0 = T0 - L0, R1 = T1 - L1;
      out.push({
        feature: j,
        threshold: (valueOf(PTS[prev], j) + valueOf(PTS[order[k]], j)) / 2,
        score: (k * gini(L0, L1) + (n - k) * gini(R0, R1)) / n,
        nL: k, nR: n - k,
        giniL: gini(L0, L1), giniR: gini(R0, R1),
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

/* ---- growing, recorded as an ordered list of steps --------------------- */

/* Breadth-first, so the reader watches a level complete before the next
   begins. Depth-first would jump from the root to a great-grandchild and
   back, which reads as the tree being built twice. */
function build() {
  const root = {
    id: 0, idx: PTS.map((_, i) => i), depth: 0,
    rect: { x0: DOM[0], x1: DOM[1], y0: DOM[0], y1: DOM[1] },
    feature: null, threshold: null, left: null, right: null,
  };
  const steps = [];
  const queue = [root];
  let nextId = 1;

  while (queue.length) {
    const node = queue.shift();
    const { n0, n1 } = countsOf(node.idx);
    node.counts = { n0, n1 };
    node.gini = gini(n0, n1);

    if (n0 === 0 || n1 === 0 || node.idx.length < 2 * MIN_LEAF) {
      node.leaf = n1 > n0 ? +1 : -1;   /* a tie predicts -1, as in the engine */
      continue;
    }

    const cands = scan(node.idx);
    const win = winnerOf(cands);
    if (!win) { node.leaf = n1 > n0 ? +1 : -1; continue; }

    const lo = [], hi = [];
    for (const i of node.idx) {
      if (valueOf(PTS[i], win.feature) <= win.threshold) lo.push(i); else hi.push(i);
    }

    const cut = (r, side) => {
      const q = { ...r };
      if (win.feature === 0) { if (side === "lo") q.x1 = win.threshold; else q.x0 = win.threshold; }
      else { if (side === "lo") q.y1 = win.threshold; else q.y0 = win.threshold; }
      return q;
    };

    node.feature = win.feature;
    node.threshold = win.threshold;
    node.left  = { id: nextId++, idx: lo, depth: node.depth + 1, rect: cut(node.rect, "lo"),
                   feature: null, threshold: null, left: null, right: null };
    node.right = { id: nextId++, idx: hi, depth: node.depth + 1, rect: cut(node.rect, "hi"),
                   feature: null, threshold: null, left: null, right: null };

    steps.push({ node, cands, win });
    queue.push(node.left, node.right);
  }
  return { root, steps };
}

let TREE = build();
let STEPS = TREE.steps;
const splitsUpTo = (k) => STEPS.slice(0, k).map((s) => s.node);

const ordinal = (n) => {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

const leavesOf = (root) => {
  const out = [];
  (function walk(n) { if (n.left && n.feature !== null) { walk(n.left); walk(n.right); } else out.push(n); })(root);
  return out;
};

/* ---- canvas ----------------------------------------------------------- */

/* Core's dpr rule (widgets/core/canvas.js): clamp at 2, round the backing
   store, scale the context once. */
function surface(host, cssW, cssH) {
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* The three panels are sized FROM THE CONTAINER at build time, not fixed.
   Fixed sizes were tried at 340/340/390 and then 300/300/320, and both
   overflowed a 1038-wide viewport — the row got its own scrollbar, so the
   plane and the score curve stopped being visible together, which is the
   entire reason they were put in one row. Measuring is the only version that
   holds at a window size nobody predicted. */
const PAD = 32;
let PLANE = 300, SCAN_W = 300, SCAN_H = 300, TREE_W = 320, TREE_H = 300;

/** Cell padding + border, measured off a real cell rather than assumed. */
function cellChrome(g) {
  const probe = document.createElement("div");
  probe.className = "cell";
  probe.style.visibility = "hidden";
  const c = document.createElement("canvas");
  c.style.width = "100px"; c.style.height = "10px"; c.style.display = "block";
  probe.appendChild(c);
  g.appendChild(probe);
  const chrome = probe.getBoundingClientRect().width - 100;
  const gap = parseFloat(getComputedStyle(g).columnGap) || 12;
  g.removeChild(probe);
  return { chrome, gap };
}

function sizePanels(g, leafCount) {
  const avail = (g.parentElement || g).clientWidth || 1000;
  const { chrome, gap } = cellChrome(g);
  /* 2 gaps between 3 cells, and one spare pixel so a sub-pixel rounding does
     not re-introduce the scrollbar this function exists to remove. */
  const budget = avail - 2 * gap - 3 * chrome - 1;

  const square = Math.max(230, Math.min(330, Math.floor(budget * 0.315)));
  PLANE = square; SCAN_W = square; SCAN_H = square; TREE_H = square;
  TREE_W = Math.max(280, Math.min(470, Math.max(budget - 2 * square, leafCount * 64)));
}

const sx = (v) => PAD + ((v - DOM[0]) / (DOM[1] - DOM[0])) * (PLANE - PAD - 14);
const sy = (v) => (PLANE - PAD) - ((v - DOM[0]) / (DOM[1] - DOM[0])) * (PLANE - PAD - 14);

function planeFrame(ctx, T) {
  ctx.fillStyle = T.surface;
  ctx.fillRect(0, 0, PLANE, PLANE);

  /* No gridlines. A line at every integer put 24 of them behind 12 samples
     and competed with the cut lines, which are the thing being looked at.
     Ticks and their labels carry the scale on their own. */
  ctx.strokeStyle = T.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx(DOM[0]), Math.round(sy(DOM[0])) + 0.5);
  ctx.lineTo(sx(DOM[1]), Math.round(sy(DOM[0])) + 0.5);
  ctx.moveTo(Math.round(sx(DOM[0])) + 0.5, sy(DOM[0]));
  ctx.lineTo(Math.round(sx(DOM[0])) + 0.5, sy(DOM[1]));
  ctx.stroke();

  ctx.strokeStyle = T.axis;
  ctx.fillStyle = T.ink3;
  ctx.font = `11px ${T.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let v = 0; v <= 10; v += 2) {
    ctx.beginPath();
    ctx.moveTo(Math.round(sx(v)) + 0.5, sy(DOM[0]));
    ctx.lineTo(Math.round(sx(v)) + 0.5, sy(DOM[0]) + 4);
    ctx.stroke();
    ctx.fillText(String(v), sx(v), sy(DOM[0]) + 7);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let v = 2; v <= 10; v += 2) {
    ctx.beginPath();
    ctx.moveTo(sx(DOM[0]) - 4, Math.round(sy(v)) + 0.5);
    ctx.lineTo(sx(DOM[0]), Math.round(sy(v)) + 0.5);
    ctx.stroke();
    ctx.fillText(String(v), sx(DOM[0]) - 7, sy(v));
  }

  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("x₁", (sx(DOM[0]) + sx(DOM[1])) / 2, PLANE - 2);
  ctx.save();
  ctx.translate(9, (sy(DOM[0]) + sy(DOM[1])) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("x₂", 0, 0);
  ctx.restore();
}

function drawPoints(ctx, T, focus = null) {
  const on = focus ? new Set(focus) : null;
  const r = PTS.length > 30 ? 4.5 : PTS.length > 16 ? 5.2 : 6;
  PTS.forEach((p, i) => {
    ctx.globalAlpha = on && !on.has(i) ? 0.20 : 1;
    ctx.fillStyle = p.y > 0 ? T.event : T.nonevent;
    ctx.beginPath();
    ctx.arc(sx(p.x1), sy(p.x2), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = T.surface;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/** A line at `threshold`, clipped to the region of the node that owns it. */
function cutLine(ctx, rect, feature, threshold) {
  ctx.beginPath();
  if (feature === 0) {
    ctx.moveTo(sx(threshold), sy(rect.y0));
    ctx.lineTo(sx(threshold), sy(rect.y1));
  } else {
    ctx.moveTo(sx(rect.x0), sy(threshold));
    ctx.lineTo(sx(rect.x1), sy(threshold));
  }
  ctx.stroke();
}

function outline(ctx, T, rect) {
  ctx.strokeStyle = T.ink3;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx(rect.x0), sy(rect.y1), sx(rect.x1) - sx(rect.x0), sy(rect.y0) - sy(rect.y1));
  ctx.setLineDash([]);
}

/* ---- the sweep, as a CONTINUOUS position ------------------------------
   The first version advanced the sweep a whole candidate at a time, so the
   line jumped from threshold to threshold and read as a slideshow. Here the
   sweep has a real-valued position `p` in candidate-index space: the line
   glides between neighbouring thresholds and a candidate is scored as the
   line reaches it.

   The one place it cannot glide is the crossing from the x₁ candidates to
   the x₂ candidates, where the line changes orientation. Interpolating
   across that would rotate a line that has no rotation to make, so it fades
   through zero instead — which also marks the moment the search changes
   feature, and that is worth marking.
   ----------------------------------------------------------------------- */
function sweepAt(cands, u) {
  const p = clamp(u, 0, 1) * (cands.length - 1);
  const i0 = Math.floor(p);
  const i1 = Math.min(cands.length - 1, i0 + 1);
  const frac = p - i0;
  const a = cands[i0], b = cands[i1];
  const same = a.feature === b.feature;

  return {
    scored: i0 + 1,                                   /* candidates passed */
    feature: same || frac < 0.5 ? a.feature : b.feature,
    threshold: same ? a.threshold + (b.threshold - a.threshold) * frac
                    : (frac < 0.5 ? a.threshold : b.threshold),
    score: same ? a.score + (b.score - a.score) * frac
                : (frac < 0.5 ? a.score : b.score),
    alpha: same ? 1 : Math.abs(frac - 0.5) * 2,       /* fade through the turn */
  };
}

/* ---- the score summary (V1) -------------------------------------------
   A SUMMARY, not a table of coefficients. One point per candidate, joined
   within a feature, and a running minimum that descends as the sweep
   proceeds. The descending line is the whole message — it is what "we are
   finding the lowest" looks like.
   ----------------------------------------------------------------------- */

function drawScan(ctx, T, step, sweep, settled) {
  ctx.fillStyle = T.surface;
  ctx.fillRect(0, 0, SCAN_W, SCAN_H);

  if (!step) {
    ctx.fillStyle = T.ink3;
    ctx.font = `12px ${T.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("no node left to split", SCAN_W / 2, SCAN_H / 2);
    return;
  }

  const L = 44, R = 10, TOP = 16, B = 30;
  const cands = step.cands;
  const hi = Math.max(...cands.map((c) => c.score)) * 1.10 || 1;
  const px = (t) => L + ((t - DOM[0]) / (DOM[1] - DOM[0])) * (SCAN_W - L - R);
  const py = (s) => (SCAN_H - B) - (s / hi) * (SCAN_H - B - TOP);

  ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
  ctx.fillStyle = T.ink3; ctx.font = `10px ${T.font}`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let g = 0; g <= 2; g += 1) {
    const v = (hi * g) / 2, y = Math.round(py(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(SCAN_W - R, y); ctx.stroke();
    ctx.fillText(v.toFixed(2), L - 5, py(v));
  }

  const upTo = settled ? cands.length : (sweep ? sweep.scored : 0);
  const seen = cands.slice(0, upTo);
  const dot = cands.length > 40 ? 1.8 : 2.6;

  [0, 1].forEach((j) => {
    const s = seen.filter((c) => c.feature === j).sort((a, b) => a.threshold - b.threshold);
    if (!s.length) return;
    ctx.strokeStyle = j === 0 ? T.theory : T.smoothed;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    s.forEach((c, i) => (i ? ctx.lineTo(px(c.threshold), py(c.score)) : ctx.moveTo(px(c.threshold), py(c.score))));
    /* The partial curve is extended to where the sweep actually IS, so the
       line does not lag a whole candidate behind the plane's cut line. */
    if (!settled && sweep && sweep.feature === j) ctx.lineTo(px(sweep.threshold), py(sweep.score));
    ctx.stroke();
    ctx.fillStyle = j === 0 ? T.theory : T.smoothed;
    s.forEach((c) => { ctx.beginPath(); ctx.arc(px(c.threshold), py(c.score), dot, 0, Math.PI * 2); ctx.fill(); });
  });

  /* The running minimum: a rule that only ever descends. Drawn even mid-sweep,
     because the point of the animation is that the best-so-far is known
     before the search is over. */
  if (seen.length) {
    const best = winnerOf(seen);
    ctx.strokeStyle = T.highlight;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, Math.round(py(best.score)) + 0.5);
    ctx.lineTo(SCAN_W - R, Math.round(py(best.score)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = T.highlight;
    ctx.lineWidth = settled ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(px(best.threshold), py(best.score), settled ? 6 : 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = T.ink2;
    ctx.font = `600 10px ${T.font}`;
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`${settled ? "lowest" : "lowest so far"} ${best.score.toFixed(4)}`, L + 3, py(best.score) - 6);
  }

  /* The sweep's own head, gliding. */
  if (sweep && !settled) {
    ctx.globalAlpha = sweep.alpha;
    ctx.fillStyle = T.highlight;
    ctx.beginPath(); ctx.arc(px(sweep.threshold), py(sweep.score), 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = T.ink3; ctx.font = `10px ${T.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let v = 0; v <= 10; v += 2) ctx.fillText(String(v), px(v), SCAN_H - B + 5);
  ctx.fillText("threshold t", (L + SCAN_W - R) / 2, SCAN_H - 13);

  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = T.theory;   ctx.fillText("x₁", L + 3, 3);
  ctx.fillStyle = T.smoothed; ctx.fillText("x₂", L + 21, 3);
  ctx.fillStyle = T.ink3;     ctx.fillText(`${upTo} of ${cands.length} scored`, L + 44, 3);
}

/* ---- the tree diagram -------------------------------------------------- */

const R_SPLIT = 14, R_LEAF = 12;

function drawTree(ctx, T, { committed, active, arriving = 1 }) {
  ctx.fillStyle = T.surface;
  ctx.fillRect(0, 0, TREE_W, TREE_H);

  const live = new Set(committed);
  const isSplit = (n) => live.has(n);

  const visible = [];
  (function collect(n) {
    visible.push(n);
    if (isSplit(n)) { collect(n.left); collect(n.right); }
  })(TREE.root);

  /* Laid out over the FINAL tree, not the visible one. Laying out what is
     currently on screen re-columns everything each time a split lands, so
     nodes the reader is already watching slide sideways to make room — the
     tree appeared to rearrange itself rather than to grow. Fixed positions
     mean a node is placed once and never moves again. */
  let slot = 0;
  (function pos(n) {
    if (n.feature !== null) { pos(n.left); pos(n.right); n._col = (n.left._col + n.right._col) / 2; }
    else n._col = slot++;
  })(TREE.root);

  let maxDepth = 0;
  (function deep(n) { maxDepth = Math.max(maxDepth, n.depth); if (n.feature !== null) { deep(n.left); deep(n.right); } })(TREE.root);
  const padX = 34, padY = 30;
  const gx = (c) => padX + (slot <= 1 ? (TREE_W - 2 * padX) / 2 : (c / (slot - 1)) * (TREE_W - 2 * padX));
  const gy = (d) => padY + (maxDepth === 0 ? 0 : (d / maxDepth) * (TREE_H - 2 * padY - 14));

  /* Resting positions, then the arriving children are pulled back toward the
     parent they are growing out of. A node that GROWS OUT of its parent
     reads as descent; one that fades in where it will end up reads as two
     unrelated things appearing. */
  const at = new Map();
  visible.forEach((n) => at.set(n, { x: gx(n._col), y: gy(n.depth), r: isSplit(n) ? R_SPLIT : R_LEAF }));

  if (active && arriving < 1) {
    const p = at.get(active);
    [active.left, active.right].forEach((kid) => {
      const q = at.get(kid);
      if (!q || !p) return;
      at.set(kid, {
        x: p.x + (q.x - p.x) * arriving,
        y: p.y + (q.y - p.y) * arriving,
        r: q.r * (0.3 + 0.7 * arriving),
      });
    });
    /* The parent itself eases from open-node size to split-node size. */
    at.set(active, { ...p, r: R_LEAF + (R_SPLIT - R_LEAF) * arriving });
  }

  /* Connector endpoints taken RADIALLY — along the line joining the two
     centres — so an edge meets each circle perpendicular to its tangent.

     The first version ran every edge from the parent's bottom-centre to the
     child's top-centre. On a diagonal that leaves the line detached at one
     end and buried in the circle at the other, which is what "all aligned to
     the vertical midpoint" was describing. Radial endpoints look intended at
     any angle and need no per-angle special-casing. */
  const edgeOf = (n, kid) => {
    const a = at.get(n), b = at.get(kid);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return { x1: a.x + ux * a.r, y1: a.y + uy * a.r,
             x2: b.x - ux * b.r, y2: b.y - uy * b.r,
             /* while the child is still inside the parent there is no edge */
             on: len > a.r + b.r + 1 };
  };

  ctx.font = `11px ${T.font}`;
  visible.filter(isSplit).forEach((n) => {
    const u = n === active ? arriving : 1;
    [[n.left, "≤"], [n.right, ">"]].forEach(([kid, rel]) => {
      const e = edgeOf(n, kid);
      if (!e.on) return;
      ctx.strokeStyle = T.ink2;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();

      ctx.globalAlpha = u * u;          /* the label lands after its edge */
      ctx.fillStyle = T.ink3;
      ctx.textAlign = rel === "≤" ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rel} ${n.threshold}`,
        (e.x1 + e.x2) / 2 + (rel === "≤" ? -6 : 6), (e.y1 + e.y2) / 2);
      ctx.globalAlpha = 1;
    });
  });

  visible.forEach((n) => {
    const { x, y, r } = at.get(n);
    const split = isSplit(n);
    const pure = n.counts && (n.counts.n0 === 0 || n.counts.n1 === 0);
    const isNew = active && (n === active.left || n === active.right);
    const u = isNew ? arriving : 1;

    if (split) {
      ctx.fillStyle = T.surface;
      ctx.strokeStyle = T.ink1;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = n === active ? arriving : 1;
      ctx.fillStyle = T.ink1;
      ctx.font = `12px ${T.font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(FEAT[n.feature], x, y + 0.5);
      ctx.globalAlpha = 1;
    } else if (pure) {
      /* A leaf carries its predicted class as a filled disc — the slide's own
         convention, and the reason the diagram needs no legend. */
      ctx.globalAlpha = u;
      ctx.fillStyle = n.counts.n1 > n.counts.n0 ? T.event : T.nonevent;
      ctx.strokeStyle = T.ink1;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (u > 0.75) {
        ctx.fillStyle = T.ink3;
        ctx.font = `10px ${T.font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`n = ${n.idx.length}`, x, y + r + 5);
      }
      ctx.globalAlpha = 1;
    } else {
      /* Not yet split and not pure: an open node still waiting its turn.
         Ringed while it is the one being searched. */
      const searching = n === active;
      ctx.globalAlpha = u;
      ctx.fillStyle = T.surface;
      ctx.strokeStyle = searching ? T.highlight : T.ink3;
      ctx.lineWidth = searching ? 3 : 1.5;
      ctx.setLineDash(searching ? [] : [3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      if (u > 0.75 && r > 8) {
        ctx.fillStyle = T.ink3;
        ctx.font = `10px ${T.font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${n.counts.n0}:${n.counts.n1}`, x, y + 0.5);
      }
      ctx.globalAlpha = 1;
    }
  });
}

/* ---- the animation ----------------------------------------------------
   Three phases per step, because the lesson has three moments: SCAN (try
   every candidate, watch the minimum descend), COMMIT (the winner lands and
   the tree grows), HOLD (the finished scan stays up long enough to read).

   Without HOLD the score curve was erased the instant the split committed,
   so during Play the finished scan — the whole point of the panel — was
   visible for one frame.

   Pace is per CANDIDATE, not per step, so a 14-candidate search visibly
   takes longer than a 4-candidate one. More work does take longer, and a
   fixed per-step duration would flatten that away. `speed` scales all three
   phases together so the proportions never change.
   ----------------------------------------------------------------------- */

/* 1x is deliberately slow — the previous fixed pace was still being missed.
   Measured at 1x on the designed twelve: root scan 2.0 s, whole tree ~9.8 s.
   The slider spans 0.25x to 2x, so 4 s to 40 s. */
const MS_PER_CAND = 300;
const COMMIT_MS = 750;
const HOLD_MS = 1100;

const state = { n: 12, speed: 1 };
const anim = { k: 0, phase: "idle", t: 0, playing: false };
let raf = null, last = 0;

const stepAt = (k) => (k < STEPS.length ? STEPS[k] : null);
/* Sub-linear in the candidate count: at 40 samples a node can hold 60+
   candidates, and a strictly linear sweep would run for 10 s. The exponent
   keeps a big search visibly longer than a small one without making it
   unwatchable. */
const scanMs = (k) => {
  const s = stepAt(k);
  return s ? Math.pow(s.cands.length, 0.72) * MS_PER_CAND / state.speed : 0;
};
const phaseMs = (p, k) => (
  p === "scan" ? scanMs(k)
  : p === "commit" ? COMMIT_MS / state.speed
  : p === "hold" ? HOLD_MS / state.speed
  : 0);

/* Ease-out cubic. Motion that starts fast and settles reads as a thing
   arriving; linear reads as a thing being dragged. */
const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

function beginScan() {
  if (anim.k >= STEPS.length) { anim.playing = false; return false; }
  anim.phase = "scan";
  anim.t = 0;
  return true;
}

/** One click while something is in flight FINISHES it rather than queuing. */
function fastForward() {
  if (anim.phase !== "idle") anim.t = phaseMs(anim.phase, anim.k);
}

/* RESTING: a finished step that is waiting on the reader, not on a clock.
   `hold` used to be a timer in both modes, so after a manual Step the score
   curve was wiped a second later whether or not it had been read — the one
   panel the reader most wants to sit and inspect. Under Play the timer is
   right (that is what Play means); under Step it is not. */
const resting = () => anim.phase === "hold" && !anim.playing;

/** Retire the finished step and move to the next node. */
function nextNode() {
  anim.k += 1;
  anim.phase = "idle";
  anim.t = 0;
}

function advance(dt) {
  if (anim.phase === "idle" || resting()) return;
  anim.t += dt;
  if (anim.t < phaseMs(anim.phase, anim.k)) return;

  if (anim.phase === "scan") { anim.phase = "commit"; anim.t = 0; }
  else if (anim.phase === "commit") { anim.phase = "hold"; anim.t = 0; }
  else if (anim.phase === "hold") {
    /* k advances only HERE, at the very end of the unit — so every earlier
       frame of the step reads a stable STEPS[k]. */
    nextNode();
    if (anim.playing && anim.k < STEPS.length) beginScan();
    else anim.playing = false;
  }
}

function loop(now) {
  /* Clamped at BOTH ends. The upper bound is the usual one — a backgrounded
     tab returns with a huge gap and would jump the animation. The lower bound
     is not defensive padding: `kick()` sets `last` from performance.now(),
     and a rAF callback is handed the timestamp of the frame that was ALREADY
     in progress, which can be earlier than that. The resulting negative dt
     drove `anim.t` below zero and indexed `cands[-1]`. */
  const dt = Math.max(0, Math.min(64, now - last));
  last = now;
  advance(dt);
  draw();
  /* A resting step is a still frame, so the clock stops with it rather than
     burning frames on a picture that cannot change. */
  if (anim.phase !== "idle" && !resting()) raf = requestAnimationFrame(loop);
  else { raf = null; syncButtons(); }
}

function kick() {
  if (raf === null && anim.phase !== "idle" && !resting()) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  draw();
  syncButtons();
}

/* ---- the page ---------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
let T = null, planeCtx = null, treeCtx = null, scanCtx = null;

/* Three panels in ONE row. The plane and the score curve are read together —
   the sweep line on one IS the moving dot on the other — and stacking them
   put a scroll between them, so at any moment only one was on screen. */
function buildStage() {
  const g = $("stageTree");
  g.innerHTML = "";
  g.style.gridTemplateColumns = "max-content max-content max-content";
  sizePanels(g, leavesOf(TREE.root).length);

  const panel = (title, w, h, measureId) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    const h3 = document.createElement("h3");
    h3.textContent = title;
    cell.appendChild(h3);
    const ctx = surface(cell, w, h);
    const m = document.createElement("p");
    m.className = "measure"; m.id = measureId;
    cell.appendChild(m);
    g.appendChild(cell);
    return ctx;
  };

  planeCtx = panel("the samples, and the cuts so far", PLANE, PLANE, "mPlane");
  scanCtx  = panel("weighted child Gini, every candidate", SCAN_W, SCAN_H, "mScan");
  treeCtx  = panel("the tree", TREE_W, TREE_H, "mTree");
}

function draw() {
  const step = stepAt(anim.k);
  const committed = splitsUpTo(anim.k);
  const scanning = anim.phase === "scan";
  const committing = anim.phase === "commit";
  const holding = anim.phase === "hold";
  const live = scanning || committing || holding;
  const settled = committing || holding;

  /* During commit and hold the split is DRAWN but `k` has not advanced yet —
     it advances only when the step is retired. Everything that counts splits
     has to count this one, or the readout says "0 of 3" under a tree that
     visibly has one. */
  const committedNow = settled ? [...committed, step.node] : committed;
  const shownSplits = committedNow.length;

  const sweep = step && scanning
    ? sweepAt(step.cands, anim.t / Math.max(1, phaseMs("scan", anim.k)))
    : null;

  /* --- plane --- */
  planeFrame(planeCtx, T);
  committed.forEach((n) => {
    planeCtx.strokeStyle = T.highlight;
    planeCtx.lineWidth = 2.5;
    cutLine(planeCtx, n.rect, n.feature, n.threshold);
  });

  if (step && live) {
    /* Only outline a node that is a PROPER sub-region. At the root the rect is
       the whole domain, so the dashed box traced the plane's own border and
       read as a frame around the chart rather than as "these samples". */
    const r = step.node.rect;
    if (r.x0 > DOM[0] || r.x1 < DOM[1] || r.y0 > DOM[0] || r.y1 < DOM[1]) {
      outline(planeCtx, T, r);
    }

    /* A short TRAIL behind the sweep, not every candidate scored so far.
       Drawing them all put a dozen faint axis-aligned lines across the panel
       — visually indistinguishable from the gridlines that were just removed
       for being distracting, which made the fix pointless. The trail shows
       that other cuts were tried, then gets out of the way; the score curve
       beside it is where every loser is actually kept. */
    if (scanning && sweep.scored > 1) {
      const TRAIL = 6;
      const from = Math.max(0, sweep.scored - 1 - TRAIL);
      for (let i = from; i < sweep.scored - 1; i += 1) {
        const c = step.cands[i];
        if (c.feature !== sweep.feature) continue;   /* the turn wipes the trail */
        const age = (sweep.scored - 1 - i) / TRAIL;
        planeCtx.globalAlpha = 0.30 * (1 - age) * sweep.alpha;
        planeCtx.strokeStyle = T.highlight;
        planeCtx.lineWidth = 1;
        cutLine(planeCtx, r, c.feature, c.threshold);
      }
      planeCtx.globalAlpha = 1;
    }

    if (scanning) {
      planeCtx.globalAlpha = sweep.alpha;
      planeCtx.strokeStyle = T.highlight;
      planeCtx.lineWidth = 2;
      cutLine(planeCtx, step.node.rect, sweep.feature, sweep.threshold);
      planeCtx.globalAlpha = 1;
    }

    if (settled) {
      /* The winner landing: it thickens over the commit, so the eye is taken
         from wherever the sweep left it to where the split actually is. */
      const u = committing ? easeOut(anim.t / phaseMs("commit", anim.k)) : 1;
      planeCtx.strokeStyle = T.highlight;
      planeCtx.lineWidth = 1.5 + 1.5 * u;
      cutLine(planeCtx, step.node.rect, step.win.feature, step.win.threshold);
    }
  }
  drawPoints(planeCtx, T, step && live ? step.node.idx : null);

  /* --- scan summary ---
     When the tree is finished there is no next node, and an empty panel
     saying so was a third of the row left blank. Keep the LAST search on
     screen instead: it is the one just watched, and it still answers "why
     that cut". */
  drawScan(scanCtx, T, step ?? STEPS[STEPS.length - 1], sweep, settled || !step);

  /* --- tree --- */
  drawTree(treeCtx, T, {
    committed: committedNow,
    active: step && live ? step.node : null,
    arriving: committing ? easeOut(anim.t / phaseMs("commit", anim.k)) : 1,
  });

  /* --- words --- */
  const open = [];
  (function walk(n) {
    if (committedNow.includes(n)) { walk(n.left); walk(n.right); }
    else if (n.counts && n.counts.n0 > 0 && n.counts.n1 > 0) open.push(n);
  })(TREE.root);

  const leaves = leavesOf(TREE.root);
  const shownStep = step ?? STEPS[STEPS.length - 1];
  $("mPlane").innerHTML = step
    ? `node holds <b>${step.node.idx.length}</b> of ${PTS.length} &middot; ${step.node.counts.n0}:${step.node.counts.n1} &middot; Gini <b>${step.node.gini.toFixed(4)}</b>`
    : `<b>${STEPS.length}</b> cuts &middot; <b>${leaves.length}</b> regions &middot; <b>0</b> of ${PTS.length} misclassified`;
  /* The winner is named only once it has been FOUND. Reporting it at rest
     printed "lowest 0.2381 at x₁ ≤ 5.5" under an empty chart before the
     reader had pressed anything — the widget opening on its own answer,
     which is non-negotiable 4. */
  $("mScan").innerHTML = scanning
    ? `<b>${sweep.scored}</b> of ${shownStep.cands.length} candidates scored`
    : settled || !step
      ? `<b>${shownStep.cands.length}</b> candidates &middot; lowest <b>${shownStep.win.score.toFixed(4)}</b> at ${FEAT[shownStep.win.feature]} ≤ ${shownStep.win.threshold}`
      : `<b>${shownStep.cands.length}</b> candidates, none scored yet`;
  $("mTree").innerHTML = `splits <b>${shownSplits}</b> of ${STEPS.length} &middot; open nodes <b>${open.length}</b>`;
  $("bOf").textContent = `${shownSplits} of ${STEPS.length} splits`;

  if (step && scanning) {
    const best = winnerOf(step.cands.slice(0, sweep.scored));
    $("ruleTree").innerHTML = `Scoring <b>${FEAT[sweep.feature]} ≤ ${sweep.threshold.toFixed(2)}</b> &middot; lowest so far <b>${FEAT[best.feature]} ≤ ${best.threshold}</b> at <b>${best.score.toFixed(4)}</b>`;
  } else if (step && settled) {
    $("ruleTree").innerHTML = `Split on <b>${FEAT[step.win.feature]} ≤ ${step.win.threshold}</b> &mdash; weighted child Gini <b>${step.win.score.toFixed(4)}</b> <span class="dim">= (${step.win.nL}&thinsp;&times;&thinsp;${step.win.giniL.toFixed(3)} + ${step.win.nR}&thinsp;&times;&thinsp;${step.win.giniR.toFixed(3)}) / ${step.node.idx.length}</span>`;
  } else if (step) {
    $("ruleTree").innerHTML = `<span class="dim">${step.cands.length} candidate splits to score on this node.</span>`;
  } else {
    $("ruleTree").innerHTML = `<span class="dim">Every leaf is one class. Nothing left to split.</span>`;
  }
}

function syncButtons() {
  const done = anim.k >= STEPS.length && anim.phase === "idle";
  $("bStep").disabled = done;
  $("bRun").disabled = done;
  $("bRun").textContent = anim.playing ? "Pause" : "Play";
  $("bReset").disabled = anim.k === 0 && anim.phase === "idle";
}

function claims() {
  const root = STEPS[0];
  const sorted = root.cands.slice().sort((a, b) => a.score - b.score);
  const win = sorted[0];
  const bestX2 = sorted.find((c) => c.feature === 1);
  const lead = sorted.findIndex((c) => c.feature !== win.feature);
  const tied = bestX2 ? sorted.filter((c) => c !== bestX2 && Math.abs(c.score - bestX2.score) < 1e-12) : [];
  const order = STEPS.map((s) => FEAT[s.win.feature]);
  const leaves = leavesOf(TREE.root);
  const reused = order.length !== new Set(order).size;

  /* Read off the scan rather than asserted: an earlier draft claimed the
     winner and runner-up were different FEATURES, and they were both x₁. */
  $("claimsTree").innerHTML = [
    bestX2
      ? `<li>At the root the top <b>${lead}</b> candidate${lead === 1 ? "" : "s"} ${lead === 1 ? "is" : "are"} <b>${FEAT[win.feature]}</b>; the best ${FEAT[1]} split is only <b>${ordinal(sorted.indexOf(bestX2) + 1)}</b> at ${bestX2.score.toFixed(4)}. Choosing the feature and choosing the threshold are <b>one search</b>, not two.</li>`
      : ``,
    tied.length
      ? `<li>${FEAT[bestX2.feature]} ≤ ${bestX2.threshold} ties <b>exactly</b> with ${tied.slice(0, 2).map((c) => `${FEAT[c.feature]} ≤ ${c.threshold}`).join(", ")} at ${bestX2.score.toFixed(4)} &mdash; the tie-break rule is not hypothetical.</li>`
      : ``,
    reused
      ? `<li>The splits chose <b>${order.join(", ")}</b> &mdash; a feature is used <b>more than once</b>, which a fixed x₁/x₂/x₃ diagram hides.</li>`
      : `<li>The splits chose <b>${order.join(", ")}</b>.</li>`,
    `<li>Every leaf ends pure, so training error is <b>0 of ${PTS.length}</b>. That is the tree <b>grown fully</b>, not the tree being right &mdash; the smallest leaf holds <b>${Math.min(...leaves.map((l) => l.idx.length))}</b> sample${Math.min(...leaves.map((l) => l.idx.length)) === 1 ? "" : "s"}.</li>`,
  ].filter(Boolean).join("");
}

/** A DATA parameter changed: refit everything and reset the animation. */
function rebuild() {
  PTS = SAMPLE_SETS[state.n].pts();
  TREE = build();
  STEPS = TREE.steps;
  anim.k = 0; anim.phase = "idle"; anim.t = 0; anim.playing = false;
  if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  buildStage();
  claims();
  draw();
  syncButtons();
}

/* ---- wiring ------------------------------------------------------------ */

$("bStep").addEventListener("click", () => {
  /* Mid-flight, a second press FINISHES the unit rather than queuing one. */
  if (anim.phase === "scan" || anim.phase === "commit") { fastForward(); kick(); return; }
  anim.playing = false;
  /* From a resting step this is the press that retires it — which is what
     makes the finished score curve stay up until it is asked to go. */
  if (anim.phase === "hold") nextNode();
  if (!beginScan()) { draw(); syncButtons(); return; }
  kick();
});

$("bRun").addEventListener("click", () => {
  if (anim.playing) { anim.playing = false; syncButtons(); return; }
  anim.playing = true;
  /* Resting is left by the hold timer once `playing` is set, so Play resumes
     from a stepped-through tree without skipping the node it is sitting on. */
  if (anim.phase === "idle" && !beginScan()) anim.playing = false;
  kick();
});

$("bReset").addEventListener("click", () => {
  anim.k = 0; anim.phase = "idle"; anim.t = 0; anim.playing = false;
  if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  draw(); syncButtons();
});

/* Speed is a DISPLAY parameter: it changes how fast the reader watches, not
   what is watched, so it must not reset the animation. Scaling all three
   phases by the same factor keeps their proportions fixed (principle 4.1 —
   a declared pace, not an auto-accelerating one). */
$("speed").addEventListener("input", () => {
  const v = Number($("speed").value);
  const before = anim.phase === "idle" ? 0 : anim.t / phaseMs(anim.phase, anim.k);
  state.speed = v;
  if (anim.phase !== "idle") anim.t = before * phaseMs(anim.phase, anim.k);
  $("speedOut").textContent = `${v.toFixed(2)}×`;
  draw();
});

/* Sample count is a DATA parameter: it changes the tree, so it resets. */
$("samples").addEventListener("change", () => {
  state.n = Number($("samples").value);
  rebuild();
});

document.querySelectorAll(".tabs [data-page]").forEach((b) => {
  b.addEventListener("click", () => {
    const page = b.dataset.page;
    document.querySelectorAll(".tabs [data-page]").forEach((o) =>
      o.setAttribute("aria-selected", String(o === b)));
    $("pageTree").hidden = page !== "tree";
    $("pageBag").hidden = page !== "bag";
    $("pageBoost").hidden = page !== "boost";

    /* A tab is a DISPLAY choice, so it must not discard the reader's progress
       (non-negotiable 3). It suspends the clock and keeps `k`, `phase` and
       `t`, so returning resumes the same unit mid-flight. Stopping only
       `playing` was not enough: the in-flight scan went on running on a
       hidden tab, so coming back showed a different state than you left. */
    if (page !== "tree") {
      anim.playing = false;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      syncButtons();
    } else if (anim.phase !== "idle") {
      kick();
    }
  });
});

$("dark").addEventListener("change", () => {
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  T = readTokens();
  draw();
});

/* `?theme=light|dark` seeds the checkbox the way core seeds a widget, without
   writing localStorage — a mock-up must not re-theme every widget. */
$("dark").checked = themeMode() === "dark";
document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";

T = readTokens();
$("speedOut").textContent = `${state.speed.toFixed(2)}×`;
rebuild();

/* An injectable frame clock, so the animation can be driven without rAF.
   The fingerprint harness already works this way — `drive: { click, frames,
   dt }` supplies the clock rather than waiting on the browser — and a
   headless browser that is not compositing never fires rAF at all, which
   makes a frozen picture and a broken state machine look identical. This is
   the hook that tells them apart. */
window.__anim = {
  get state() { return { ...anim, n: PTS.length, steps: STEPS.length }; },
  tick(dt = 16) { if (anim.phase !== "idle") advance(dt); draw(); syncButtons(); },
  run(frames = 200, dt = 16) {
    for (let i = 0; i < frames && anim.phase !== "idle"; i += 1) this.tick(dt);
    return this.state;
  },
};
