/* =========================================================================
   Lab · showing the collection of trees
   -------------------------------------------------------------------------
   Kenneth's suggestion, mocked up rather than built: put the fifty bagged
   trees on screen as miniatures while the resampling runs, so the reader
   SEES the collection instead of being told its size.

   Three layouts, at real pixel sizes, using the real trees — same twelve
   samples and the same bootstrap seed (4242) as tree-build.js, so what is
   judged here is what the page would actually draw.

   A miniature is a SILHOUETTE. No labels, no thresholds: at 40 px nothing
   can be read, and the thing worth seeing is that the shapes differ. Leaves
   carry their class as colour, which is the one piece of information that
   survives at that size.
   ========================================================================= */

import { readTokens, themeMode } from "../core/env.js";
import { makeRng } from "../core/rng.js";
import { fitTree, isLeaf, treeDepth, treeSize } from "./tree-forest-engine.js";

/* The designed twelve, copied from tree-build.js. Copied and not imported
   because that file runs a whole page on load; twelve literals are the
   cheaper coupling. If they ever disagree, this page is the wrong one. */
const PTS = [
  { x1: 1,  x2: 2, y: -1 }, { x1: 2,  x2: 6, y: -1 }, { x1: 3,  x2: 3, y: -1 },
  { x1: 2,  x2: 9, y: -1 }, { x1: 4,  x2: 5, y: -1 }, { x1: 7,  x2: 2, y: -1 },
  { x1: 8,  x2: 4, y: -1 }, { x1: 7,  x2: 8, y: +1 }, { x1: 8,  x2: 9, y: +1 },
  { x1: 9,  x2: 7, y: +1 }, { x1: 10, x2: 8, y: +1 }, { x1: 10, x2: 3, y: +1 },
];
const B = 50;

/* Same protocol as the bagging page: draw n with replacement, fit fully
   (minLeaf 1), keep the tree. fitTree comes from the committed engine rather
   than being written a third time. */
function buildBag() {
  const rng = makeRng(4242);
  const n = PTS.length;
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const pts = [];
    for (let i = 0; i < n; i += 1) pts.push(PTS[Math.floor(rng.next() * n)]);
    const root = fitTree(pts, { minLeaf: 1 });
    out.push({ root, size: treeSize(root), depth: treeDepth(root), sig: sigOf(root) });
  }
  return out;
}
const sigOf = (n) => (isLeaf(n) ? `L${n.pred}` : `(${n.feature}<=${n.threshold}${sigOf(n.left)}${sigOf(n.right)})`);

const BAG = buildBag();

/* ---- canvas ------------------------------------------------------------ */

function surface(host, w, h) {
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * One tree as a silhouette inside a box.
 *
 * `scale` drives every stroke and dot, so the same routine reads at 28 px and
 * at 60 px without a second set of constants to keep in step.
 */
function miniature(ctx, T, root, x0, y0, s, { fresh = false } = {}) {
  const pad = s * 0.16;
  const w = s - 2 * pad, h = s - 2 * pad;

  let slot = 0, maxD = 0;
  (function pos(n) {
    maxD = Math.max(maxD, n.depth);
    if (!isLeaf(n)) { pos(n.left); pos(n.right); n._c = (n.left._c + n.right._c) / 2; }
    else n._c = slot++;
  })(root);

  const gx = (c) => x0 + pad + (slot <= 1 ? w / 2 : (c / (slot - 1)) * w);
  const gy = (d) => y0 + pad + (maxD === 0 ? 0 : (d / maxD) * h);

  ctx.strokeStyle = T.ink3;
  ctx.lineWidth = Math.max(0.75, s * 0.022);
  (function edges(n) {
    if (isLeaf(n)) return;
    for (const kid of [n.left, n.right]) {
      ctx.beginPath();
      ctx.moveTo(gx(n._c), gy(n.depth));
      ctx.lineTo(gx(kid._c), gy(kid.depth));
      ctx.stroke();
      edges(kid);
    }
  })(root);

  (function dots(n) {
    const r = isLeaf(n) ? Math.max(1.4, s * 0.055) : Math.max(1, s * 0.035);
    ctx.fillStyle = isLeaf(n) ? (n.pred > 0 ? T.event : T.nonevent) : T.ink2;
    ctx.beginPath();
    ctx.arc(gx(n._c), gy(n.depth), r, 0, Math.PI * 2);
    ctx.fill();
    if (!isLeaf(n)) { dots(n.left); dots(n.right); }
  })(root);

  if (fresh) {
    /* The one that just arrived, so the collection has a cursor. */
    ctx.strokeStyle = T.highlight;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, s - 1, s - 1);
  }
}

/** A grid of miniatures filling a box, `k` of them drawn. */
function grid(ctx, T, k, X, Y, W, H, cols) {
  const rows = Math.ceil(B / cols);
  const s = Math.min(W / cols, H / rows);
  const ox = X + (W - s * cols) / 2;
  const oy = Y + (H - s * rows) / 2;
  for (let i = 0; i < B; i += 1) {
    const cx = ox + (i % cols) * s;
    const cy = oy + Math.floor(i / cols) * s;
    if (i < k) {
      miniature(ctx, T, BAG[i].root, cx, cy, s, { fresh: i === k - 1 });
    } else {
      /* An empty slot, so the reader can see how much bag is still to come. */
      ctx.strokeStyle = T.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(cx + s * 0.18 + 0.5, cy + s * 0.18 + 0.5, s * 0.64, s * 0.64);
      ctx.setLineDash([]);
    }
  }
  return s;
}

/** The full-size tree, as the bagging page draws it. */
function fullTree(ctx, T, root, X, Y, W, H) {
  let slot = 0, maxD = 0;
  (function pos(n) {
    maxD = Math.max(maxD, n.depth);
    if (!isLeaf(n)) { pos(n.left); pos(n.right); n._c = (n.left._c + n.right._c) / 2; }
    else n._c = slot++;
  })(root);
  const padX = 30, padY = 22;
  const gx = (c) => X + padX + (slot <= 1 ? (W - 2 * padX) / 2 : (c / (slot - 1)) * (W - 2 * padX));
  const gy = (d) => Y + padY + (maxD === 0 ? 0 : (d / maxD) * (H - 2 * padY - 10));

  ctx.font = `10px ${T.font}`;
  (function edges(n) {
    if (isLeaf(n)) return;
    for (const [kid, rel] of [[n.left, "≤"], [n.right, ">"]]) {
      const a = { x: gx(n._c), y: gy(n.depth), r: 11 };
      const b = { x: gx(kid._c), y: gy(kid.depth), r: 9 };
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      ctx.strokeStyle = T.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x + ux * a.r, a.y + uy * a.r);
      ctx.lineTo(b.x - ux * b.r, b.y - uy * b.r);
      ctx.stroke();
      ctx.fillStyle = T.ink3;
      ctx.textAlign = rel === "≤" ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rel} ${n.threshold}`, (a.x + b.x) / 2 + (rel === "≤" ? -5 : 5), (a.y + b.y) / 2);
      edges(kid);
    }
  })(root);

  (function dots(n) {
    const x = gx(n._c), y = gy(n.depth);
    if (isLeaf(n)) {
      ctx.fillStyle = n.pred > 0 ? T.event : T.nonevent;
      ctx.strokeStyle = T.ink1; ctx.lineWidth = 1.75;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = T.surface; ctx.strokeStyle = T.ink1; ctx.lineWidth = 1.75;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.ink1; ctx.font = `10px ${T.font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n.feature === 0 ? "x₁" : "x₂", x, y + 0.5);
      dots(n.left); dots(n.right);
    }
  })(root);
}

/* ---- the page ---------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
let T = null;
const PANEL = 300;          /* the bagging page's own panel size */
const TREE_W = 390;

function cell(host, title, note) {
  const d = document.createElement("div");
  d.className = "cell";
  const h = document.createElement("h3"); h.textContent = title; d.appendChild(h);
  if (note) { const p = document.createElement("p"); p.textContent = note; d.appendChild(p); }
  host.appendChild(d);
  return d;
}
function measure(host, html) {
  const p = document.createElement("p"); p.className = "measure"; p.innerHTML = html; host.appendChild(p);
}

function render() {
  const k = Number($("k").value);
  $("kOut").textContent = `${k} of ${B}`;
  const cur = BAG[k - 1];

  /* --- M1: grid replaces the tree panel --- */
  const r1 = $("rowM1"); r1.innerHTML = "";
  const c1a = cell(r1, "the tree it grows — replaced", "the middle panel of the bagging page, at its real size");
  const x1 = surface(c1a, PANEL, PANEL);
  x1.fillStyle = T.surface; x1.fillRect(0, 0, PANEL, PANEL);
  const s1 = grid(x1, T, k, 0, 0, PANEL, PANEL, 7);
  measure(c1a, `50 slots in ${PANEL}&times;${PANEL} px &middot; <b>${s1.toFixed(0)} px</b> per tree`);

  const c1b = cell(r1, "what it displaces", "the current tree, at the size the bagging page draws it now");
  const y1 = surface(c1b, TREE_W, PANEL);
  y1.fillStyle = T.surface; y1.fillRect(0, 0, TREE_W, PANEL);
  fullTree(y1, T, cur.root, 0, 0, TREE_W, PANEL);
  measure(c1b, `tree ${k}: <b>${cur.size[1]}</b> cut${cur.size[1] === 1 ? "" : "s"}, ${cur.size[0]} leaves, depth ${cur.depth}`);

  /* --- M2: tree above, strip below --- */
  const r2 = $("rowM2"); r2.innerHTML = "";
  const c2 = cell(r2, "the tree it grows — with a strip", "same panel width, split between the two");
  const x2 = surface(c2, TREE_W, PANEL);
  x2.fillStyle = T.surface; x2.fillRect(0, 0, TREE_W, PANEL);
  const treeH = Math.round(PANEL * 0.62);
  fullTree(x2, T, cur.root, 0, 0, TREE_W, treeH);
  x2.strokeStyle = T.grid; x2.lineWidth = 1;
  x2.beginPath(); x2.moveTo(8, treeH + 0.5); x2.lineTo(TREE_W - 8, treeH + 0.5); x2.stroke();
  const s2 = grid(x2, T, k, 4, treeH + 6, TREE_W - 8, PANEL - treeH - 10, 13);
  measure(c2, `tree at ${treeH} px tall &middot; <b>${s2.toFixed(0)} px</b> per miniature`);

  /* --- M3: a shelf under the whole row --- */
  const r3 = $("rowM3"); r3.innerHTML = "";
  const shelfW = PANEL * 2 + TREE_W + 2 * 74;   /* the row's real width, cells included */
  const c3 = cell(r3, "a shelf under all three panels", "full width of the bagging page's row");
  const x3 = surface(c3, shelfW, 132);
  x3.fillStyle = T.surface; x3.fillRect(0, 0, shelfW, 132);
  const s3 = grid(x3, T, k, 0, 0, shelfW, 132, 25);
  measure(c3, `two rows of 25 across ${shelfW} px &middot; <b>${s3.toFixed(0)} px</b> per miniature`);

  const seen = new Set(BAG.slice(0, k).map((t) => t.sig));
  const stumps = BAG.slice(0, k).filter((t) => t.size[1] === 1).length;
  const deepest = Math.max(...BAG.slice(0, k).map((t) => t.depth));
  $("claims").innerHTML = [
    `<li><b>${seen.size}</b> distinct structures among the first <b>${k}</b> trees &mdash; the fact the collection is meant to make visible.</li>`,
    `<li>Sizes run from <b>${Math.min(...BAG.slice(0, k).map((t) => t.size[1]))}</b> to <b>${Math.max(...BAG.slice(0, k).map((t) => t.size[1]))}</b> cuts, depth up to <b>${deepest}</b>; <b>${stumps}</b> of them ${stumps === 1 ? "is" : "are"} a single stump.</li>`,
    `<li>A miniature is a silhouette. At <b>${s1.toFixed(0)} px</b> (M1) no label survives, so class colour on the leaves is the only information beyond shape.</li>`,
  ].join("");
}

$("k").addEventListener("input", render);
$("dark").addEventListener("change", () => {
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  T = readTokens();
  render();
});

$("dark").checked = themeMode() === "dark";
document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
T = readTokens();
render();
