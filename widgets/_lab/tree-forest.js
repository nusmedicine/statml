/* ============================================================================
   Lab — how widget 17 draws its forest, and three questions the tree stage
   raises. NOT DEPLOYED: `scripts/build.mjs` filters `widgets/_lab`.

   The page has ONE job, section A: put the three candidate drawings of a
   random forest side by side, at the size the shipped widget will actually
   draw them, with the numbers that separate them underneath. Sections B, C and
   D are evidence for decisions that follow from it and are behind the section
   switcher so they cannot push A below the fold.

   WHAT IS COPIED AND WHAT IS IMPORTED, because a mock-up that re-implements
   the model is a mock-up of a different model:

     - the CART, the forest, AdaBoost, the four generators, the rasters and the
       boundary geometry all come from `./tree-forest-engine.js`, which is
       verified line by line against `./tree-forest-reference.json`. Nothing
       statistical is written twice in this file.
     - the axes come from `../core/canvas.js` `makePlot`, and the colours from
       `../core/env.js` `readTokens` — the same two calls a shipped widget
       makes, so the frame is widget 16's frame rather than a lookalike.
     - the SVM in section C is widget 16's own solver, imported from the frozen
       `./svm-stage-core.js`, at widget 16's own default dials. Only the
       marching squares are copied in (below), because they live inside
       `widgets/support-vector-machine/main.js`, which calls `defineWidget` at
       module scope and would mount a whole widget if imported.

   NOT ADDED TO `_lab/index.html`: that index lists 13 of the 32 pages here and
   knows about neither SVM page. HANDOVER records catching it up as its own
   single change.

   SCREENSHOT SAFETY. HANDOVER, "a screenshot of a long page": the browser pane
   paints the top of the document, so a scrolled capture comes back black with
   no error. Every section here is therefore an independent view — one at a
   time, at scroll 0, addressable as `?s=a|b|c|d`, with `?b=50` narrowing
   section A to a single row. Nothing on this page needs to be scrolled to to
   be photographed.
   ========================================================================= */

import { makePlot } from "../core/canvas.js";
import { readTokens, themeMode } from "../core/env.js";
import { solveSVM } from "./svm-stage-core.js";
import {
  DOM, PAD_L, PAD_R, PAD_T, PAD_B, planeSide, SEED, N,
  makeData, fitTree, fitForest, fitBoost,
  levelRects, levelSummary, isLeaf, rectPx,
  rasteriseTree, boundaryStats, repaintPct, treeSize, treeDepth,
} from "./tree-forest-engine.js";

/* --- constants ----------------------------------------------------------- */

/* The reference table's resolution. Run COUNTS are a property of the raster,
   not of the panel, so measuring at 560 is what makes the numbers on this page
   comparable with `tree-forest-reference.json` at every panel width. Run
   LENGTHS are then reported in whatever the current panel's pixels are. */
const RASTER = 560;

/* The B ladder, and the reference table's ladder. */
const LADDER = [1, 5, 15, 50];

/* Widget 16's RBF defaults: `C` option "2" of [0.01, 0.1, 1, 10, 100] and
   `gamma` option "2" of [0.1, 0.3, 1, 3, 10, 30]. Both are 1. */
const RBF_C = 1;
const RBF_G = 1;

/* Strongest tint a class region is allowed. Region shading has to stay under
   the samples drawn on top of it, which are themselves at alpha 0.45. */
const TINT = 0.30;

/* Widget 16's contour grid, copied with the code that reads it. */
const GRID = 120;
const gridAt = (i) => DOM[0] + ((DOM[1] - DOM[0]) * i) / (GRID - 1);

const TICKS = [-2, -1, 0, 1, 2];

/* From `tree-forest-reference.json`, forestByB, the rings rows — the numbers
   this page checks itself against. `mean` is at sidePx 560. */
const REF_RINGS = {
  1: { cuts: 4, runs: 4, mean: 256.5, wrong: 0 },
  5: { cuts: 42, runs: 12, mean: 86.2, wrong: 2 },
  15: { cuts: 127, runs: 60, mean: 18.9, wrong: 0 },
  50: { cuts: 436, runs: 146, mean: 8.5, wrong: 0 },
};
/* Same file, voteDistribution: the share of the panel with 0 < p < 1. */
const REF_CONTESTED = { 1: 0, 5: 18.5, 15: 40.02, 50: 62.21 };
/* Same file, ringsBox, at sidePx 560. */
const REF_BOX = [257.81, 286.59];

/* ============================================================================
   Model runs. Each is computed once and kept: a theme flip or a stage change
   repaints, it does not refit — and it must not, or the picture would be a
   different forest at every width.
   ========================================================================= */

const runs = new Map();
const once = (key, make) => {
  if (!runs.has(key)) runs.set(key, make());
  return runs.get(key);
};

/** One forest, snapshotted at each rung of the B ladder. */
function forestRun(setName) {
  return once(`forest:${setName}`, () => {
    const { points, rng } = makeData(setName);
    const forest = fitForest(points, { B: 50, rng });
    const cells = RASTER * RASTER;
    const votes = new Int16Array(cells);
    const scratch = new Int8Array(cells);
    const at = new Map();

    for (let b = 0; b < forest.B; b += 1) {
      rasteriseTree(forest.members[b], RASTER, scratch);
      for (let k = 0; k < cells; k += 1) if (scratch[k] > 0) votes[k] += 1;
      const B = b + 1;
      if (!LADDER.includes(B)) continue;
      const labels = new Int8Array(cells);
      let contested = 0;
      for (let k = 0; k < cells; k += 1) {
        const p = votes[k] / B;
        /* p == 0.5 goes to -1, the engine's rule and the widget's. */
        labels[k] = p > 0.5 ? 1 : -1;
        if (p > 0 && p < 1) contested += 1;
      }
      at.set(B, {
        labels,
        votes: votes.slice(),
        contested: (100 * contested) / cells,
        cuts: forest.cutsUpTo(B),
        leaves: forest.leavesUpTo(B),
        wrong: forest.wrongAt(B),
      });
    }
    return { points, forest, at };
  });
}

/** One CART, plus the per-level reading section B prints. */
function treeRun(setName) {
  return once(`tree:${setName}`, () => {
    const { points } = makeData(setName);
    const tree = fitTree(points, { minLeaf: 2 });
    const levels = new Map();
    for (const L of [1, 2, 3, 4]) {
      const s = levelSummary(tree, L);
      levels.set(L, { ...s, region: minusOneRegion(s.rects, points) });
    }
    return { points, tree, levels };
  });
}

/**
 * The -1 region of a truncated tree, and how much of its outline is CUT rather
 * than panel edge.
 *
 * That count is section B's whole question in a number: "does four presses
 * read as four walls" is answered by whether each press turns one more side of
 * the box from the edge of the picture into a wall of the model. It is not the
 * leaf count and not the depth — at level 1 the region is already a rectangle,
 * with one wall and three panel edges.
 */
function minusOneRegion(rects, points) {
  const neg = rects.filter((r) => r.pred < 0);
  if (neg.length !== 1) return { single: false, count: neg.length };
  const r = neg[0];
  const walls = [
    r.x1[0] > DOM[0] + 1e-12,
    r.x1[1] < DOM[1] - 1e-12,
    r.x2[0] > DOM[0] + 1e-12,
    r.x2[1] < DOM[1] - 1e-12,
  ];
  let inner = 0, outer = 0;
  for (const p of points) {
    if (p.x1 > r.x1[0] && p.x1 <= r.x1[1] && p.x2 > r.x2[0] && p.x2 <= r.x2[1]) {
      if (p.y < 0) inner += 1; else outer += 1;
    }
  }
  return {
    single: true,
    rect: r,
    walls: walls.filter(Boolean).length,
    closed: walls.every(Boolean),
    inner,
    outer,
  };
}

/**
 * The wave, staged twice: AdaBoost round by round and the forest tree by tree,
 * with the per-round repaint of each.
 *
 * Both are accumulated incrementally — the boosting margin as a running sum of
 * alpha * h, the forest as running vote counts — because the alternative is to
 * re-predict 313,600 cells through m models at every m, which is 50 times the
 * work for the same numbers.
 */
function waveRun() {
  return once("wave", () => {
    const { points, rng } = makeData("wave");
    const boost = fitBoost(points, { rounds: 50, maxDepth: 2, minLeaf: 1 });
    const forest = fitForest(points, { B: 50, rng });
    const cells = RASTER * RASTER;
    const scratch = new Int8Array(cells);

    const stage = (kind) => {
      const M = kind === "boost" ? boost.rounds : forest.B;
      const score = new Float64Array(cells);
      const votes = new Int16Array(cells);
      let cur = new Int8Array(cells);
      let prev = new Int8Array(cells);
      const repaint = new Array(M).fill(NaN);
      const at = new Map();

      for (let m = 0; m < M; m += 1) {
        if (kind === "boost") {
          rasteriseTree(boost.members[m].tree, RASTER, scratch);
          const a = boost.members[m].alpha;
          for (let k = 0; k < cells; k += 1) score[k] += a * scratch[k];
          for (let k = 0; k < cells; k += 1) cur[k] = score[k] > 0 ? 1 : -1;
        } else {
          rasteriseTree(forest.members[m], RASTER, scratch);
          for (let k = 0; k < cells; k += 1) if (scratch[k] > 0) votes[k] += 1;
          for (let k = 0; k < cells; k += 1) cur[k] = votes[k] / (m + 1) > 0.5 ? 1 : -1;
        }
        if (m > 0) repaint[m] = repaintPct(cur, prev);
        if (LADDER.includes(m + 1)) at.set(m + 1, { labels: cur.slice(), repaint: repaint[m] });
        const swap = prev; prev = cur; cur = swap;
      }

      const band = (lo, hi) => {
        let s = 0, n = 0;
        for (let m = lo; m <= Math.min(hi, M); m += 1) {
          if (Number.isNaN(repaint[m - 1])) continue;
          s += repaint[m - 1]; n += 1;
        }
        return n ? s / n : NaN;
      };
      return { at, repaint, band, M };
    };

    let bWrong = 0, fWrong = 0;
    for (const p of points) {
      if (boost.predictAt(p.x1, p.x2) !== p.y) bWrong += 1;
      if (forest.predictAt(p.x1, p.x2) !== p.y) fWrong += 1;
    }
    return {
      points, boost, forest, bWrong, fWrong,
      boosted: stage("boost"),
      bagged: stage("forest"),
    };
  });
}

/** Widget 16's RBF on the rings, at widget 16's defaults. */
function svmRun() {
  return once("svm:rings", () => {
    const { points } = makeData("rings");
    const X = points.map((p) => [p.x1, p.x2]);
    const y = points.map((p) => p.y);
    const kf = (a, b) => Math.exp(-RBF_G * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2));
    const K = X.map((a) => X.map((b) => kf(a, b)));
    /* eps and maxIter are widget 16's, not the frozen copy's defaults: the
       shipped solver runs 1e-6 / 120000 and a cut-off solve is silently wrong
       rather than obviously wrong. */
    const { alpha, b } = solveSVM(K, y, RBF_C, { eps: 1e-6, maxIter: 120000 });

    /* Support vectors off alpha, never off a float test on y f(x) = 1. */
    const sv = [];
    for (let i = 0; i < y.length; i += 1) if (alpha[i] > 1e-8) sv.push(i);
    const decide = (p) => {
      let s = b;
      for (const i of sv) s += alpha[i] * y[i] * kf(X[i], p);
      return s;
    };
    const wrong = y.filter((yi, i) => yi * decide(X[i]) <= 0).length;

    const F = new Float64Array(GRID * GRID);
    for (let j = 0; j < GRID; j += 1) {
      const py = gridAt(j);
      for (let i = 0; i < GRID; i += 1) F[j * GRID + i] = decide([gridAt(i), py]);
    }
    const contours = [0, 1, -1].map((level) => contour(F, level));
    /* Length of the f = 0 curve, in domain units, so the two boundaries in
       section C can be compared as lengths rather than as impressions. */
    let dLen = 0;
    for (const path of contours[0].paths) {
      for (let k = 1; k < path.length; k += 1) {
        dLen += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      }
    }
    return { points, sv, wrong, contours, dLen, paths: contours[0].paths.length };
  });
}

/* ============================================================================
   FROZEN COPY — marching squares, from `widgets/support-vector-machine/
   main.js`, which cannot be imported because it calls `defineWidget` at module
   scope. Copied rather than reinvented so section C's circle is the curve
   widget 16 actually draws, down to the saddle tie-break: a cheaper tracer
   would round corners differently and the comparison it is in is a comparison
   OF shapes. Edit the shipped file, not this one.
   ========================================================================= */

function contour(F, level) {
  const segs = [];
  const at = (i, j) => F[j * GRID + i] - level;
  const mix = (va, vb, a, b) => a + ((b - a) * va) / (va - vb);
  for (let j = 0; j < GRID - 1; j += 1) {
    for (let i = 0; i < GRID - 1; i += 1) {
      const v00 = at(i, j), v10 = at(i + 1, j), v11 = at(i + 1, j + 1), v01 = at(i, j + 1);
      let code = 0;
      if (v00 > 0) code |= 1;
      if (v10 > 0) code |= 2;
      if (v11 > 0) code |= 4;
      if (v01 > 0) code |= 8;
      if (code === 0 || code === 15) continue;
      const x0 = gridAt(i), x1 = gridAt(i + 1), y0 = gridAt(j), y1 = gridAt(j + 1);
      const B = [mix(v00, v10, x0, x1), y0];
      const R = [x1, mix(v10, v11, y0, y1)];
      const T = [mix(v01, v11, x0, x1), y1];
      const L = [x0, mix(v00, v01, y0, y1)];
      const push = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (code) {
        case 1: case 14: push(L, B); break;
        case 2: case 13: push(B, R); break;
        case 3: case 12: push(L, R); break;
        case 4: case 11: push(R, T); break;
        case 6: case 9: push(B, T); break;
        case 7: case 8: push(L, T); break;
        case 5: {
          const mid = (v00 + v10 + v11 + v01) / 4;
          if (mid > 0) { push(L, T); push(B, R); } else { push(L, B); push(R, T); }
          break;
        }
        default: {
          const mid = (v00 + v10 + v11 + v01) / 4;
          if (mid > 0) { push(L, B); push(R, T); } else { push(L, T); push(B, R); }
        }
      }
    }
  }
  return { level, paths: chain(segs) };
}

function chain(segs) {
  const key = (x, y) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const k of [key(s[0], s[1]), key(s[2], s[3])]) {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const used = new Array(segs.length).fill(false);
  const out = [];
  const grow = (path, atKey) => {
    for (;;) {
      const next = (ends.get(atKey) ?? []).find((i) => !used[i]);
      if (next === undefined) return atKey;
      used[next] = true;
      const s = segs[next];
      const head = key(s[0], s[1]) === atKey;
      const px = head ? s[2] : s[0], py = head ? s[3] : s[1];
      path.push([px, py]);
      atKey = key(px, py);
    }
  };
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const s = segs[i];
    const path = [[s[0], s[1]], [s[2], s[3]]];
    grow(path, key(s[2], s[3]));
    const back = [];
    grow(back, key(s[0], s[1]));
    out.push(back.reverse().concat(path));
  }
  return out;
}

/* ============================================================================
   Painting.
   ========================================================================= */

/**
 * Core's dpr rule (`widgets/core/canvas.js`): clamp at 2, round the backing
 * store, and fold the scale into one transform so every drawing call below is
 * written in the panel's own CSS pixels.
 *
 * `k` is the fit-to-window factor. At k = 1 this is exactly core's arithmetic.
 * Below 1 the canvas is genuinely drawn smaller — the honest way to shrink,
 * since keeping the backing store at full size would show the picture at a
 * finer effective dpr than any reader will ever have.
 */
function canvasIn(host, w, h, k) {
  host.textContent = "";
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = w * k, cssH = h * k;
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  return ctx;
}

/** Widget 16's stage geometry, including its centring of the capped panel. */
function stagePlot(ctx, colors, stageW) {
  const side = planeSide(stageW);
  const rect = {
    x: Math.round(PAD_L + (stageW - PAD_L - PAD_R - side) / 2),
    y: PAD_T,
    w: side,
    h: side,
  };
  ctx.save();
  ctx.fillStyle = colors.surface;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  const plot = makePlot({ ctx, colors, rect, xDomain: DOM, yDomain: DOM });
  plot.grid(TICKS);
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const t of TICKS) {
    const px = Math.round(plot.sx(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, rect.y);
    ctx.lineTo(px, rect.y + rect.h);
    ctx.stroke();
  }
  ctx.restore();
  return plot;
}

const finishAxes = (plot) => {
  plot.axisX({ ticks: TICKS, label: "x₁" });
  plot.axisY({ ticks: TICKS, label: "x₂" });
};

const clip = (ctx, plot) => {
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.w, plot.h);
  ctx.clip();
};

/** #rgb / #rrggbb / rgb() -> [r, g, b]. Tokens resolve to hex; rgb() is the
    fallback so a token defined as rgba() cannot silently paint black. */
function rgbOf(v) {
  const s = String(v).trim();
  if (s.startsWith("#")) {
    const h = s.slice(1);
    const x = h.length === 3 ? h.split("").map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return x.map((c) => parseInt(c, 16));
  }
  const m = s.match(/-?\d+(\.\d+)?/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}

/**
 * The class field as an image: one pixel per raster cell, tinted from the
 * surface towards the class colour by `strength` in [-1, +1].
 *
 * An image rather than a fill per leaf, because at B = 50 the vote surface has
 * no rectangles left in it — 486 leaves across the members, overlapping — and
 * an ImageData is one pass over the cells either way.
 */
function fieldImage(strengthAt, colors, maxTint) {
  const off = document.createElement("canvas");
  off.width = RASTER;
  off.height = RASTER;
  const octx = off.getContext("2d");
  const img = octx.createImageData(RASTER, RASTER);
  const d = img.data;
  const bg = rgbOf(colors.surface);
  const pos = rgbOf(colors.event);
  const neg = rgbOf(colors.nonevent);
  for (let j = 0; j < RASTER; j += 1) {
    /* Raster row j is x2 ascending; image row 0 is the top of the panel. */
    const irow = (RASTER - 1 - j) * RASTER;
    const grow = j * RASTER;
    for (let i = 0; i < RASTER; i += 1) {
      const s = strengthAt(grow + i);
      const c = s >= 0 ? pos : neg;
      const a = maxTint * Math.abs(s);
      const o = (irow + i) * 4;
      d[o] = bg[0] + (c[0] - bg[0]) * a;
      d[o + 1] = bg[1] + (c[1] - bg[1]) * a;
      d[o + 2] = bg[2] + (c[2] - bg[2]) * a;
      d[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return off;
}

const drawField = (ctx, plot, off) => {
  ctx.save();
  clip(ctx, plot);
  ctx.drawImage(off, plot.x, plot.y, plot.w, plot.h);
  ctx.restore();
};

/**
 * The boundary of a labelled raster, stroked.
 *
 * The same edge definition `boundaryStats` counts with — a lattice segment
 * between two 4-adjacent cells carrying different labels — so the picture and
 * the number under it cannot disagree about what the boundary is.
 */
function strokeBoundary(ctx, plot, labels, colors, width = 2) {
  const step = plot.w / RASTER;
  const X = (i) => plot.x + i * step;
  const Y = (j) => plot.y + plot.h - j * step;
  ctx.save();
  clip(ctx, plot);
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (let j = 0; j < RASTER; j += 1) {
    const row = j * RASTER;
    for (let i = 0; i + 1 < RASTER; i += 1) {
      if (labels[row + i] !== labels[row + i + 1]) {
        ctx.moveTo(X(i + 1), Y(j));
        ctx.lineTo(X(i + 1), Y(j + 1));
      }
    }
  }
  for (let j = 0; j + 1 < RASTER; j += 1) {
    const row = j * RASTER, next = (j + 1) * RASTER;
    for (let i = 0; i < RASTER; i += 1) {
      if (labels[row + i] !== labels[next + i]) {
        ctx.moveTo(X(i), Y(j + 1));
        ctx.lineTo(X(i + 1), Y(j + 1));
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Every internal node, pre-order, as the NODES.
 *
 * Not the engine's `cutsPreOrder`, which returns a summary row per cut — depth,
 * feature, threshold, counts — and deliberately no rectangle, because it exists
 * to print a table. Drawing needs the rectangle: a child's cut only exists
 * inside its parent's box, and a threshold stroked across the whole panel is a
 * different picture and a wrong one.
 */
function cutNodes(node, out = []) {
  if (isLeaf(node)) return out;
  out.push(node);
  cutNodes(node.left, out);
  cutNodes(node.right, out);
  return out;
}

/** One internal node's cut, across the rectangle that node owns. */
function addCut(ctx, plot, node, snap) {
  const r = node.rect;
  if (node.feature === 0) {
    const x = snap ? Math.round(plot.sx(node.threshold)) + 0.5 : plot.sx(node.threshold);
    ctx.moveTo(x, plot.sy(r.x2[0]));
    ctx.lineTo(x, plot.sy(r.x2[1]));
  } else {
    const y = snap ? Math.round(plot.sy(node.threshold)) + 0.5 : plot.sy(node.threshold);
    ctx.moveTo(plot.sx(r.x1[0]), y);
    ctx.lineTo(plot.sx(r.x1[1]), y);
  }
}

/** Every member's every cut, faint. F2's whole proposition. */
function memberCuts(ctx, plot, forest, k, colors) {
  ctx.save();
  clip(ctx, plot);
  ctx.strokeStyle = colors.ink2;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let b = 0; b < k; b += 1) {
    for (const node of cutNodes(forest.members[b])) addCut(ctx, plot, node, true);
  }
  ctx.stroke();
  ctx.restore();
}

/** Leaf rectangles, filled by predicted class. */
function leafFills(ctx, plot, rects, colors, alpha = TINT) {
  ctx.save();
  clip(ctx, plot);
  ctx.globalAlpha = alpha;
  for (const r of rects) {
    ctx.fillStyle = r.pred > 0 ? colors.event : colors.nonevent;
    const x = plot.sx(r.x1[0]);
    const y = plot.sy(r.x2[1]);
    ctx.fillRect(x, y, plot.sx(r.x1[1]) - x, plot.sy(r.x2[0]) - y);
  }
  ctx.restore();
}

/**
 * The cuts of a tree truncated at `level`, with the newest drawn emphatically.
 *
 * Two tokens rather than two alphas of one: a cut already standing is settled
 * structure (`--ink-2`), the one that just landed is the thing moving right now
 * (`--c-highlight`), which is what that token is for.
 */
function levelCuts(ctx, plot, tree, level, colors) {
  const nodes = cutNodes(tree).filter((n) => n.depth < level);
  for (const fresh of [false, true]) {
    const sel = nodes.filter((n) => (n.depth === level - 1) === fresh);
    if (!sel.length) continue;
    ctx.save();
    clip(ctx, plot);
    ctx.strokeStyle = fresh ? colors.highlight : colors.ink2;
    ctx.globalAlpha = fresh ? 1 : 0.55;
    ctx.lineWidth = fresh ? 2.5 : 1.25;
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const n of sel) addCut(ctx, plot, n, !fresh);
    ctx.stroke();
    ctx.restore();
  }
}

/** Widget 16's plain sample: radius 2.9, alpha 0.45, class colour. */
function dots(ctx, plot, points, colors) {
  ctx.save();
  clip(ctx, plot);
  ctx.globalAlpha = 0.45;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(plot.sx(p.x1), plot.sy(p.x2), 2.9, 0, Math.PI * 2);
    ctx.fillStyle = p.y > 0 ? colors.event : colors.nonevent;
    ctx.fill();
  }
  ctx.restore();
}

/** Widget 16's contours: f = 0 solid at 2px, the margins dashed at 1.25. */
function svmCurves(ctx, plot, contours, colors) {
  ctx.save();
  clip(ctx, plot);
  ctx.strokeStyle = colors.highlight;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const { level, paths } of contours) {
    ctx.setLineDash(level === 0 ? [] : [5, 4]);
    ctx.lineWidth = level === 0 ? 2 : 1.25;
    ctx.globalAlpha = level === 0 ? 1 : 0.55;
    ctx.beginPath();
    for (const path of paths) {
      path.forEach(([px, py], k) => (k
        ? ctx.lineTo(plot.sx(px), plot.sy(py))
        : ctx.moveTo(plot.sx(px), plot.sy(py))));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function caption(ctx, plot, text, note, colors) {
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink2;
  ctx.fillText(text, plot.x, plot.y - 8);
  if (note) {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.fillStyle = colors.ink3;
    ctx.fillText(note, plot.x + plot.w, plot.y - 8);
  }
  ctx.restore();
}

/* ============================================================================
   Cells and grids.
   ========================================================================= */

const $ = (id) => document.getElementById(id);
const fx = (v, n = 1) => v.toFixed(n);

/** A grid cell: heading, canvas host, and one or two measure lines. */
function cell(grid, title, lines) {
  const el = document.createElement("div");
  el.className = "cell";
  const h = document.createElement("h3");
  h.textContent = title;
  const host = document.createElement("div");
  el.append(h, host);
  const meas = lines.map(() => {
    const m = document.createElement("div");
    m.className = "measure";
    el.appendChild(m);
    return m;
  });
  grid.appendChild(el);
  return { host, meas };
}

/**
 * How wide the columns are, and the factor the canvases are drawn at.
 *
 * Chrome and gap are MEASURED off a probe rather than written as numbers: they
 * are `var(--sp-3)` and a token border, and a second copy of either here would
 * be a layout constant that drifts the first time the style block moves.
 *
 * The tracks are FIXED PIXELS, not `max-content`. Under `max-content` a column
 * is as wide as the widest unwrappable thing in it, and the widest thing in a
 * cell is not the canvas — it is the measure line, which is one long sentence
 * with nothing to wrap against. That made section B's grid 841 px wider than
 * its own panels. Fixing the track to the canvas width is what lets the prose
 * wrap under the picture it belongs to.
 */
function metrics(wrap, grid, cols, natW, on) {
  const probe = document.createElement("div");
  probe.className = "cell";
  grid.appendChild(probe);
  const cs = getComputedStyle(probe);
  const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  probe.remove();
  const avail = wrap.clientWidth - cols * chrome - (cols - 1) * gap;
  const k = on ? Math.max(0.3, Math.min(1, avail / (cols * natW))) : 1;
  const lay = { k, chrome, gap, colPx: natW * k + chrome };
  grid.style.gridTemplateColumns = `repeat(${cols}, ${lay.colPx}px)`;
  return lay;
}

/* ============================================================================
   Section A — the decision.
   ========================================================================= */

const CANDIDATES = [
  { key: "F1", name: "the averaged boundary only" },
  { key: "F2", name: "boundary + every member's cuts" },
  { key: "F3", name: "vote shading + boundary" },
];

function drawA(colors, stageW) {
  const grid = $("gridA");
  grid.textContent = "";
  const run = forestRun("rings");
  const rows = $("rows").value === "all" ? LADDER : [Number($("rows").value)];
  const natW = stageW;
  const natH = PAD_T + planeSide(stageW) + PAD_B;
  const lay = metrics(grid.parentElement, grid, CANDIDATES.length, natW, $("fit").checked);

  /* Boundary geometry is a property of the ROW, not of the drawing, so it is
     measured once per B and printed under all three candidates. Measuring it
     per panel was 12 passes over 313,600 cells for four distinct answers. */
  const sidePx = planeSide(stageW);
  const statsAt = new Map(LADDER.map((B) => [B, boundaryStats(run.at.get(B).labels, sidePx)]));

  for (const B of rows) {
    const snap = run.at.get(B);
    const stats = statsAt.get(B);
    for (const cand of CANDIDATES) {
      const extra = cand.key === "F2"
        ? `cut lines drawn <b>${snap.cuts}</b> at alpha 0.18`
        : cand.key === "F3"
          ? `panel with 0 &lt; p &lt; 1 <b>${fx(snap.contested, 2)}%</b>`
            + (B === 1 ? " &mdash; two-tone by construction" : "")
          : "nothing drawn but the line and the samples";
      const c = cell(grid, `${cand.key} · B = ${B} — ${cand.name}`, [0, 1]);
      /* The panel is NAMED here, and that is not decoration. Run counts are a
         property of the raster and read the same at every width; run lengths
         are in the current panel's pixels, so at the 550.4 stage this line says
         226.5 px where the self-check below says 256.5 px for the same four
         rows at the reference's own 560. Unlabelled, those two read as the page
         contradicting itself — which is exactly the misreading a decision page
         cannot afford. Section B already names both scales in one sentence; this
         is the same fix in the shorter slot. */
      c.meas[0].innerHTML = `cuts <b>${snap.cuts}</b> &middot; runs <b>${stats.runs}</b>`
        + ` &middot; mean run <b>${fx(stats.meanRunPx)} px</b> on this ${fx(sidePx)} px panel`
        + ` &middot; wrong <b>${snap.wrong} of ${N}</b>`;
      c.meas[1].innerHTML = extra;

      const ctx = canvasIn(c.host, natW, natH, lay.k);
      const plot = stagePlot(ctx, colors, stageW);
      if (cand.key === "F3") {
        const v = snap.votes;
        drawField(ctx, plot, fieldImage((i) => (2 * v[i]) / B - 1, colors, TINT));
      }
      if (cand.key === "F2") memberCuts(ctx, plot, run.forest, B, colors);
      strokeBoundary(ctx, plot, snap.labels, colors);
      dots(ctx, plot, run.points, colors);
      caption(ctx, plot, `${cand.key} — B = ${B}`, `${fx(sidePx)} px panel`, colors);
      finishAxes(plot);
    }
  }

  /* The claims: one per candidate, each a quantity read off the panels above. */
  const at = (B) => run.at.get(B);
  const s50 = statsAt.get(50);
  $("claimsA").innerHTML = [
    `<b>F1</b> draws one line. At B = 50 it is <b>${s50.runs}`
      + ` straight runs</b> averaging <b>${fx(s50.meanRunPx)} px</b> on this ${fx(sidePx)} px`
      + ` panel, and nothing on the panel`
      + ` reports how many of the 50 trees voted for either side of it.`,
    `<b>F2</b> adds one line per split in the model: <b>${at(1).cuts}</b> at B = 1,`
      + ` <b>${at(5).cuts}</b> at 5, <b>${at(15).cuts}</b> at 15, <b>${at(50).cuts}</b> at 50 &mdash;`
      + ` the last of those inside a ${fx(sidePx)} &times; ${fx(sidePx)} px square.`,
    /* NOT "the same picture as F1", which is the earlier wording and is false
       with the two panels side by side on this very screen: F1 B = 1 is a white
       field with a line on it and F3 B = 1 is solid two-tone. What is equal is
       the INFORMATION — at one tree the shading has only two values, so it can
       say nothing the line has not already said. Name the quantity, not a
       resemblance the reader can see is wrong. */
    `<b>F3</b> shades the vote fraction p. The share of the panel with 0 &lt; p &lt; 1 is`
      + ` <b>${fx(at(1).contested, 2)}%</b> at B = 1 &mdash; p is 0 or 1 by construction, so at`
      + ` one tree the shading takes two values and carries nothing the F1 line has not`
      + ` already drawn &mdash;`
      + ` then <b>${fx(at(5).contested, 2)}%</b>, <b>${fx(at(15).contested, 2)}%</b> and`
      + ` <b>${fx(at(50).contested, 2)}%</b>.`,
    `All three rows are one fitted forest read at a prefix, so a B control is a`
      + ` <b>display</b> parameter over a single fit, not a refit.`,
  ].map((s) => `<li>${s}</li>`).join("");

  /* And the self-check. Run counts are raster properties, so they are compared
     at the reference's own sidePx = 560 whatever the panel is set to. */
  const bad = [];
  for (const B of LADDER) {
    const ref = REF_RINGS[B];
    const got = boundaryStats(run.at.get(B).labels, 560);
    if (run.at.get(B).cuts !== ref.cuts) bad.push(`B=${B} cuts ${run.at.get(B).cuts}≠${ref.cuts}`);
    if (got.runs !== ref.runs) bad.push(`B=${B} runs ${got.runs}≠${ref.runs}`);
    if (Math.abs(got.meanRunPx - ref.mean) > 0.05) bad.push(`B=${B} mean ${fx(got.meanRunPx)}≠${ref.mean}`);
    if (run.at.get(B).wrong !== ref.wrong) bad.push(`B=${B} wrong ${run.at.get(B).wrong}≠${ref.wrong}`);
    if (Math.abs(run.at.get(B).contested - REF_CONTESTED[B]) > 0.02) {
      bad.push(`B=${B} contested ${fx(run.at.get(B).contested, 2)}≠${REF_CONTESTED[B]}`);
    }
  }
  $("checkA").innerHTML = bad.length
    ? `Self-check against <code>tree-forest-reference.json</code>: <span class="no">`
      + `${bad.length} of 20 disagree</span> &mdash; ${bad.join(", ")}`
    : `Self-check against <code>tree-forest-reference.json</code> (rings, seed ${SEED},`
      + ` 560-cell raster, run lengths at its own 560 px panel): <span class="yes">20 of 20 agree</span>`
      + ` &mdash; cuts 4/42/127/436, runs 4/12/60/146, mean run 256.5/86.2/18.9/8.5 px,`
      + ` misclassified 0/2/0/0, contested 0.00/18.50/40.02/62.21%.`;
  return lay;
}

/* ============================================================================
   Section B — four presses, four walls.
   ========================================================================= */

function drawB(colors, stageW) {
  const grid = $("gridB");
  grid.textContent = "";
  const run = treeRun("rings");
  const natW = stageW;
  const natH = PAD_T + planeSide(stageW) + PAD_B;
  const lay = metrics(grid.parentElement, grid, 4, natW, $("fit").checked);
  const sidePx = planeSide(stageW);

  for (const L of [1, 2, 3, 4]) {
    const s = run.levels.get(L);
    const c = cell(grid, `Level ${L}`, [0, 1]);
    c.meas[0].innerHTML = `leaves <b>${s.leaves}</b> &middot; cuts <b>${s.cuts}</b>`
      + ` &middot; wrong <b>${s.wrong} of ${N}</b>`;
    c.meas[1].innerHTML = s.region.single
      ? `the &minus;1 region is one rectangle with <b>${s.region.walls} of 4</b> sides a cut`
        + ` &middot; it holds <b>${s.region.inner}</b> of the 90 inner and`
        + ` <b>${s.region.outer}</b> of the 90 outer samples`
      : `the &minus;1 region is <b>${s.region.count}</b> rectangles`;

    const ctx = canvasIn(c.host, natW, natH, lay.k);
    const plot = stagePlot(ctx, colors, stageW);
    leafFills(ctx, plot, s.rects, colors, 0.12);
    levelCuts(ctx, plot, run.tree, L, colors);
    dots(ctx, plot, run.points, colors);
    caption(ctx, plot, `after ${L} press${L > 1 ? "es" : ""}`,
      s.region.closed ? "the box is shut" : `${4 - s.region.walls} side(s) still panel edge`, colors);
    finishAxes(plot);
  }

  const l4 = run.levels.get(4).region;
  /* The engine's own rect-to-pixels, not a second copy of the same division. */
  const boxPx = rectPx(l4.rect, sidePx);
  $("claimsB").innerHTML = [
    `Each press turns exactly one more side of the &minus;1 rectangle from panel edge into`
      + ` a cut: <b>${[1, 2, 3, 4].map((L) => run.levels.get(L).region.walls).join(", ")}</b>`
      + ` walls after levels 1, 2, 3, 4.`,
    `<b>The box shuts at level 4</b>: ${fx(boxPx.wPx)} &times; ${fx(boxPx.hPx)} px on this`
      + ` ${fx(sidePx)} px panel (${REF_BOX[0]} &times; ${REF_BOX[1]} px at 560), closed on all`
      + ` four sides, holding <b>${l4.inner} of the 90</b> inner samples and`
      + ` <b>${l4.outer} of the 90</b> outer.`,
    `Misclassified falls <b>${[1, 2, 3, 4].map((L) => run.levels.get(L).wrong).join(" &rarr; ")}</b>`
      + ` of ${N} across the four levels; the tree stops at depth ${treeDepth(run.tree)} with`
      + ` ${treeSize(run.tree)[0]} leaves.`,
    /* Provenance, stated exactly. The 200-seed sweep is in the Python reference
       PASS, not in the JSON it emitted — the file holds seed 1 only, and a
       reader who opens it looking for 118 will not find it. A page that leans
       on a self-check against that file must not miscite it. */
    `This is the tidy set. The Python reference pass swept 200 seeds and the box closes`
      + ` cleanly &mdash; one rectangle holding all 90 inner samples and no outer &mdash; in`
      + ` <b>118 of them</b>. <code>tree-forest-reference.json</code> records seed ${SEED}`
      + ` only, and seed ${SEED} &mdash; the one a widget with no seed parameter opens on`
      + ` &mdash; is one of the clean ones.`,
  ].map((s) => `<li>${s}</li>`).join("");
  return lay;
}

/* ============================================================================
   Section C — the box against the circle.
   ========================================================================= */

function drawC(colors, stageW) {
  const grid = $("gridC");
  grid.textContent = "";
  const tree = treeRun("rings");
  const svm = svmRun();
  const natW = stageW;
  const natH = PAD_T + planeSide(stageW) + PAD_B;
  const lay = metrics(grid.parentElement, grid, 2, natW, $("fit").checked);
  const sidePx = planeSide(stageW);
  const scale = sidePx / (DOM[1] - DOM[0]);

  /* LEFT — the tree at full depth. */
  const rects = levelRects(tree.tree);
  const labels = rasteriseTree(tree.tree, RASTER);
  const tStats = boundaryStats(labels, sidePx);
  const [leaves, cuts] = treeSize(tree.tree);
  const cA = cell(grid, "Widget 17 — CART, min_samples_leaf 2, no depth cap", [0, 1]);
  cA.meas[0].innerHTML = `leaves <b>${leaves}</b> &middot; cuts <b>${cuts}</b>`
    + ` &middot; depth <b>${treeDepth(tree.tree)}</b>`
    + ` &middot; wrong <b>${tree.levels.get(4).wrong} of ${N}</b>`;
  /* Named for the same reason section A names it: at the 550.4 stage this reads
     962.3 px where the reference's tree.rings.panel says 1090 px, and the two
     are one measurement at two panel sizes. */
  cA.meas[1].innerHTML = `boundary <b>${tStats.runs} straight runs</b>, ${tStats.corners} corners,`
    + ` <b>${fx(tStats.totalPx)} px</b> long on this ${fx(sidePx)} px panel`;
  const ctxA = canvasIn(cA.host, natW, natH, lay.k);
  const plotA = stagePlot(ctxA, colors, stageW);
  leafFills(ctxA, plotA, rects, colors, 0.12);
  strokeBoundary(ctxA, plotA, labels, colors);
  dots(ctxA, plotA, tree.points, colors);
  caption(ctxA, plotA, "a box", `${cuts} cuts`, colors);
  finishAxes(plotA);

  /* RIGHT — widget 16, unchanged. */
  const cB = cell(grid, "Widget 16 — SVC, RBF kernel, C = 1, γ = 1", [0, 1]);
  cB.meas[0].innerHTML = `support vectors <b>${svm.sv.length} of ${N}</b>`
    + ` &middot; wrong <b>${svm.wrong} of ${N}</b>`;
  cB.meas[1].innerHTML = `boundary <b>${svm.paths} closed curve${svm.paths === 1 ? "" : "s"}</b>,`
    + ` <b>${fx(svm.dLen * scale)} px</b> long on the same panel, traced by widget 16&rsquo;s`
    + ` marching squares at GRID = ${GRID}`;
  const ctxB = canvasIn(cB.host, natW, natH, lay.k);
  const plotB = stagePlot(ctxB, colors, stageW);
  svmCurves(ctxB, plotB, svm.contours, colors);
  dots(ctxB, plotB, svm.points, colors);
  caption(ctxB, plotB, "a circle", `${svm.sv.length} support vectors`, colors);
  finishAxes(plotB);

  $("claimsC").innerHTML = [
    `Both get <b>0 of ${N}</b> training samples wrong on this data, by different geometry:`
      + ` <b>${tStats.runs} axis-aligned runs</b> against <b>${svm.paths} smooth closed curve</b>.`,
    `The tree spends <b>${cuts} numbers</b> &mdash; four thresholds &mdash; where the SVM keeps`
      + ` <b>${svm.sv.length} of the ${N} samples</b> and a kernel evaluation against each.`,
    `The RBF panel is widget 16&rsquo;s model, not a drawing of one: same seeded cloud, its own`
      + ` SMO from <code>svm-stage-core.js</code> at eps 1e-6 / 120 000 iterations, its own`
      + ` default C and &gamma;, its own contour tracer. The margins are its dashed f = &plusmn;1.`,
    `The shared stage is exact &mdash; same domain, same ${N} points, same panel geometry &mdash;`
      + ` so a reader flipping between the two widgets sees one cloud under two models.`,
  ].map((s) => `<li>${s}</li>`).join("");
  return lay;
}

/* ============================================================================
   Section D — boosting.
   ========================================================================= */

const KILLED = [
  ["wave &mdash; sine boundary, freq 6.0", "+2.78 points vs the forest, 98 of 100 seeds",
    "<span class=\"yes\">kept</span> &mdash; beats the strongest forest by more than the hobbled one"],
  ["corridor, thin diagonal w = 0.45", "+5.44 points, 90% of seeds",
    "a <code>class_weight=\"balanced\"</code> forest beats boosting by 6.48 points in 100% of 40 seeds"],
  ["checkerboard 3&times;3", "+3.43 points, 95% of seeds",
    "+0.22 points (p = 0.37) once the forest may use max_features = 2"],
  ["checkerboard 4&times;4 / 5&times;5 / 6&times;6", "repaint 20&ndash;26% per round",
    "&minus;5.36 / &minus;7.53 / &minus;4.15 points against a fair forest"],
  ["xor 2&times;2", "solved exactly",
    "AdaBoost terminates at a mean of 2.5 rounds &mdash; no sequence to watch"],
  ["spirals, 0.75 to 2.0 turns", "repaint 1.7&ndash;2.6&times; the forest",
    "+0.38 to &minus;0.51 points &mdash; indistinguishable from the forest"],
  ["concentric bands, 3 to 6", "&mdash;",
    "&minus;2.46 to &minus;1.29 points at every band count"],
  ["minority pockets, 1 / 3 / 5", "repaint <b>7.5&times;</b> the forest",
    "+0.35 points, p = 0.21 &mdash; repaint and advantage are independent"],
  ["label noise, 8 generators", "&mdash;",
    "&minus;2.2 to &minus;5.9 points, boosting ahead in 0&ndash;10% of seeds"],
  ["imbalanced blobs 20/160, 30/150", "&mdash;",
    "&minus;0.37 / &minus;0.49 points, and repaint BELOW the forest"],
  ["rect-4, four axis-aligned rectangles", "+2.35 points, 90% of seeds",
    "&minus;0.03 points (p = 0.90) against a min_samples_leaf = 1 forest"],
  ["stair-4, piecewise-constant steps", "+0.60 points, survives every control",
    "0.9734 against 0.9674 &mdash; detectable, and invisible in a boundary picture"],
  ["widget 16&rsquo;s blobs / rings / crescents", "the original 0.00% finding",
    "reproduces only with a FULL-DEPTH weak learner, which fits all three at round 1"],
];

function drawD(colors, stageW) {
  const grid = $("gridD");
  grid.textContent = "";
  const run = waveRun();
  const natW = stageW;
  const natH = PAD_T + planeSide(stageW) + PAD_B;
  const lay = metrics(grid.parentElement, grid, 4, natW, $("fit").checked);
  const sidePx = planeSide(stageW);

  for (const [kind, stage, label] of [
    ["boost", run.boosted, "AdaBoost, depth-2 stumps"],
    ["forest", run.bagged, "Forest, max_features 1 of 2"],
  ]) {
    for (const m of LADDER) {
      const snap = stage.at.get(m);
      /* AdaBoost can stop early — err = 0 ends the sequence — and on widget
         16's own three sets it stops at round 1. It runs the full 50 here, but
         a rung with no model behind it must say so rather than throw. */
      if (!snap) {
        cell(grid, `${label} · ${kind === "boost" ? "m" : "B"} = ${m}`, [0])
          .meas[0].innerHTML = `the sequence ended at <b>${stage.M}</b>, so there is no round ${m}`;
        continue;
      }
      const stats = boundaryStats(snap.labels, sidePx);
      const c = cell(grid, `${label} · ${kind === "boost" ? "m" : "B"} = ${m}`, [0, 1]);
      c.meas[0].innerHTML = Number.isNaN(snap.repaint)
        ? "first step &mdash; no previous state to repaint over"
        : `repaint at this step <b>${fx(snap.repaint, 2)}%</b> of the panel`;
      /* Panel named for the same reason as sections A and C — a length in px is
         meaningless without the panel it is a length ON. */
      c.meas[1].innerHTML = `runs <b>${stats.runs}</b> &middot; mean run`
        + ` <b>${fx(stats.meanRunPx)} px</b> on this ${fx(sidePx)} px panel &middot; wrong at 50`
        + ` <b>${kind === "boost" ? run.bWrong : run.fWrong} of ${N}</b>`;

      const ctx = canvasIn(c.host, natW, natH, lay.k);
      const plot = stagePlot(ctx, colors, stageW);
      const lab = snap.labels;
      drawField(ctx, plot, fieldImage((i) => lab[i], colors, 0.16));
      strokeBoundary(ctx, plot, lab, colors);
      dots(ctx, plot, run.points, colors);
      caption(ctx, plot, `${kind === "boost" ? "round" : "tree"} ${m}`,
        Number.isNaN(snap.repaint) ? "first step" : `${fx(snap.repaint, 2)}% repainted`, colors);
      finishAxes(plot);
    }
  }

  const bb = run.boosted.band;
  const fb = run.bagged.band;
  $("claimsD").innerHTML = [
    `Per-round repaint at seed ${SEED}, rounds 2&ndash;10: boosting <b>${fx(bb(2, 10), 2)}%</b>`
      + ` against the forest&rsquo;s <b>${fx(fb(2, 10), 2)}%</b>`
      + ` (${fx(bb(2, 10) / fb(2, 10), 2)}&times;). Rounds 11&ndash;25:`
      + ` <b>${fx(bb(11, 25), 2)}%</b> against <b>${fx(fb(11, 25), 2)}%</b>. Rounds 26&ndash;50:`
      + ` <b>${fx(bb(26, 50), 2)}%</b> against <b>${fx(fb(26, 50), 2)}%</b>.`,
    /* "level on the median" was the earlier wording and it softened the very
       correction this claim exists to make: the engine's 100-seed medians are
       4.82% for boosting against 5.00% for the forest, so at the median boosting
       repaints LESS, not the same. State the direction and both numbers. */
    `<b>One seed is not the finding.</b> Over 100 seeds the engine measures 6.38% against 4.91%`
      + ` for rounds 2&ndash;10 &mdash; <b>1.30&times;</b>, not the 1.9&times; the probe reported,`
      + ` with boosting ahead in <b>50 of 100</b> seeds and <b>below</b> the forest at the`
      + ` median (4.82% against 5.00%). The 1.9&times;`
      + ` came from 8 seeds of a statistic whose sd is 5.19, compared against scikit-learn&rsquo;s`
      + ` soft-vote forest, which repaints 13% less than the hard majority vote specified here.`,
    `<b>The accuracy claim is the one that holds:</b> 0.9044 against the forest&rsquo;s 0.8765 on`
      + ` fresh test points, +2.78 points, boosting ahead in 98 of 100 seeds. Training samples`
      + ` wrong at 50 on this seed: boosting <b>${run.bWrong}</b>, forest <b>${run.fWrong}</b>`
      + ` of ${N}.`,
    `The churn has a <b>shape</b> rather than an amount: 98.8% of boosting&rsquo;s repainted`
      + ` pixels lie inside the strip |x&#8322;| &lt; 1.2, against the forest&rsquo;s 92.2%.`
      + ` Round 1 settles the top and bottom of the panel; every later round works the strip.`,
  ].map((s) => `<li>${s}</li>`).join("");

  const rows = KILLED.map(([gen, headline, killer]) =>
    `<tr><td>${gen}</td><td style="text-align:left">${headline}</td>`
    + `<td style="text-align:left">${killer}</td></tr>`).join("");
  $("tableD").innerHTML = `<table><tr><th>generator</th><th>the headline</th>`
    + `<th>what ended it</th></tr>${rows}</table>`;
  return lay;
}

/* ============================================================================
   Wiring.
   ========================================================================= */

const CLOSING = `<b>1. F2 asks whether the members are the lesson.</b> At B = 50 it draws 436
  cut lines; the forest&rsquo;s claim is that no one of them matters. Whether that is worth
  seeing, or worth being unable to see, is a teaching decision and not a measurement.
  <br><br>
  <b>2. B is a display parameter over one fit.</b> Every row of section A is a prefix of the same
  50 members, so moving B keeps the first tree fixed. Refitting per B would redraw the stream and
  change the tree the reader was already looking at.
  <br><br>
  <b>3. Section D&rsquo;s stage is a fourth generator.</b> Widget 16 offers three; boosting has
  something to show on none of them. Adding the wave to widget 17 means the two widgets no longer
  carry the same data menu &mdash; which is a cost against the shared stage that section C argues
  for.`;

const DRAW = { a: drawA, b: drawB, c: drawC, d: drawD };

function draw() {
  /* Tokens are read INSIDE the render, never hoisted: hoisting keeps the first
     paint's colours across a theme flip. */
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  const colors = readTokens();
  const stageW = Number($("stage").value);
  const sec = $("sec").value;

  for (const el of document.querySelectorAll("section[data-sec]")) {
    el.hidden = el.dataset.sec !== sec;
  }
  $("rowsLab").hidden = sec !== "a";
  $("legendNote").textContent = sec === "d"
    ? `wave, seed ${SEED}, ${N} samples · AdaBoost SAMME, depth-2 stumps, full step · `
      + "forest bootstrap, max_features 1 of 2"
    : `rings, seed ${SEED}, ${N} samples · CART, Gini, min_samples_leaf 2, no depth cap `
      + "· forest bootstrap, max_features 1 of 2";

  /* Each section returns the fit factor it drew at — it depends on how many
     columns that section has, so only the section can know it. */
  const { k } = DRAW[sec](colors, stageW);
  $("fitLab").textContent = k >= 0.999
    ? `1:1 · panel ${fx(planeSide(stageW))} px`
    : `${Math.round(k * 100)}% · panel ${fx(planeSide(stageW))} px drawn at`
      + ` ${fx(planeSide(stageW) * k)} px`;

  $("closing").innerHTML = CLOSING;

  /* The address bar tracks the view, so a section can be linked and reopened
     at scroll 0. Wrapped because `file://` refuses replaceState in some
     browsers and a mock-up must not die of its own URL bookkeeping. */
  try {
    const url = new URL(location.href);
    url.searchParams.set("s", sec);
    if (sec === "a") url.searchParams.set("b", $("rows").value);
    else url.searchParams.delete("b");
    history.replaceState(null, "", url);
  } catch { /* not addressable here; the page is unaffected */ }
}

/* `?theme=light|dark` seeds the checkbox the way core seeds a widget; the
   checkbox then owns the page. `setThemeMode` is deliberately NOT called — it
   writes localStorage, and a mock-up must not re-theme every widget the
   reviewer opens next. */
const q = new URLSearchParams(location.search);
$("dark").checked = themeMode() === "dark";
if (["a", "b", "c", "d"].includes(q.get("s"))) $("sec").value = q.get("s");
if (["all", "1", "5", "15", "50"].includes(q.get("b"))) $("rows").value = q.get("b");

for (const id of ["sec", "rows", "stage", "fit", "dark"]) $(id).addEventListener("change", draw);

/* A resize changes the fit factor and nothing else, so it repaints rather than
   refits — the runs are memoised and a resize must never move the model. */
let pending = 0;
window.addEventListener("resize", () => {
  clearTimeout(pending);
  pending = setTimeout(draw, 150);
});

draw();
