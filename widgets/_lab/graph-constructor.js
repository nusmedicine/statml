/* ============================================================================
   LAB · a graph constructor for widget 94's Graph page — NOT DEPLOYED.

   His question, 2026-10-09: "is it worthwhile or feasible to have a drag and
   drop graph constructor? maybe limited to like 6 nodes?" This is the answer
   built on core as it stands, so the mock proves the feasibility claim rather
   than asserting it: no core change, every edit through core's region door.

   THE GRAPH IS ONE PARAMETER, `graph`, a `text` field: pairs of node names,
   source then target, "AB,BC" — so the URL carries the graph and the field is
   the keyboard path to the same edges. A region computes its value from the
   current parameters (regions are handed `params`), so a click that toggles
   A–C is one write to one parameter, inside core's one-parameter rule; a
   `text` value is not checked against an option list.

   Two ways to click, `?mode=`:
     nodes    click a node, then another: the edge between them toggles.
              The first click is a PENDING pick, and a pick needs a home: a
              second parameter would make the second click write two (the
              edge and the cleared pick), which core forbids. So the pick
              rides in the same string after a bar, "AB,BC|C", and the field's
              `show` hides it. Directed: the first click is the source.
     handles  a dot on every pair the nodes can form (15 for six); a click
              toggles that pair. Directed: two dots a pair, the one nearer
              the target. The six slots were searched so that no two pairs'
              dots fall within 15 px at 300 × 150.
   Both modes also toggle an edge from a cell of A.

   Nodes 3–6; E and F have made-up features (cell 25 gives four). Edges
   whose node is switched off are kept in the string and not drawn, so
   switching it back restores them. Nothing animates: there is no press.
   ========================================================================= */

import { defineWidget } from "../core/index.js";

const NAMES = ["A", "B", "C", "D", "E", "F"];
const FEATURES = [[1.2, 0.3], [0.8, 0.9], [1.1, 0.4], [0.5, 1.2], [0.9, 0.6], [1.3, 0.2]];
/* the searched slots, as fractions of a 250 × 175 drawing box; A–D left to
   right. Searched (600,000 draws) so that, with 3.5 px to spare: no two
   pairs' midpoints within 15 px of each other or of a node, nodes 40 px
   apart, no node's feature cells over another node or its cells, and no
   node lying on the edge between two others */
const SLOTS = [[0.156, 0.557], [0.425, 0.311], [0.696, 0.865], [0.883, 0.564], [0.711, 0.315], [0.137, 0.875]];
const SHUFFLE = [2, 0, 3, 1, 5, 4];   // the node numbered 0, 1, … when shuffled; filtered to the nodes on
const MODE = new URLSearchParams(location.search).get("mode") === "handles" ? "handles" : "nodes";

/* ---------------------------------------------------------- the string */

function parseGraph(t) {
  const [body, pickRaw = ""] = String(t).toUpperCase().split("|");
  const pairs = [];
  for (const m of body.matchAll(/([A-F])\s*[-–>→]?\s*([A-F])/g)) {
    const p = m[1] + m[2];
    if (m[1] !== m[2] && !pairs.includes(p)) pairs.push(p);
  }
  const pick = /^[A-F]$/.test(pickRaw.trim()) ? pickRaw.trim() : "";
  return pairs.join(",") + (pick ? `|${pick}` : "");
}
const pairsOf = (v) => (String(v).split("|")[0] ? String(v).split("|")[0].split(",").filter(Boolean) : []);
const pickOf = (v) => String(v).split("|")[1] ?? "";
const joinPairs = (pairs, pick = "") => pairs.join(",") + (pick ? `|${pick}` : "");
/** toggle the edge p–q (undirected) or p→q (directed), dropping any pick */
function toggled(v, p, q, directed) {
  let pairs = pairsOf(v);
  const has = directed ? pairs.includes(p + q) : pairs.includes(p + q) || pairs.includes(q + p);
  if (has) pairs = pairs.filter((x) => (directed ? x !== p + q : x !== p + q && x !== q + p));
  else pairs.push(directed ? p + q : [p, q].sort().join(""));
  return joinPairs(pairs);
}
/** a click on node X in nodes mode: start a pick, finish one, or cancel it */
function nodeClick(v, X, directed) {
  const pick = pickOf(v);
  if (!pick) return joinPairs(pairsOf(v), X);
  if (pick === X) return joinPairs(pairsOf(v));
  return toggled(v, pick, X, directed);
}

/* ------------------------------------------------------- the tables */

function compute({ params }) {
  const n = Number(params.nodes), directed = params.edges === "directed";
  const at = params.order === "shuffled" ? SHUFFLE.filter((p) => p < n) : [...Array(n).keys()];
  const index = []; at.forEach((p, i) => (index[p] = i));
  const on = (c) => NAMES.indexOf(c) < n;
  /* the edges as node pairs, canonical for the mode */
  const set = new Set();
  for (const pq of pairsOf(params.graph)) {
    if (!on(pq[0]) || !on(pq[1])) continue;
    set.add(directed ? pq : [pq[0], pq[1]].sort().join(""));
  }
  const edges = [...set].map((pq) => [NAMES.indexOf(pq[0]), NAMES.indexOf(pq[1])]);
  /* edge_index sorted by source then target under this numbering, as PyG keeps it */
  const cols = [];
  for (const [a, b] of edges) { cols.push([index[a], index[b]]); if (!directed) cols.push([index[b], index[a]]); }
  cols.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const A = at.map(() => at.map(() => 0));
  for (const [s, t] of cols) A[s][t] = 1;
  const pick = pickOf(params.graph);
  return { n, directed, at, index, edges, cols, A, x: at.map((p) => FEATURES[p]), pick: pick && on(pick) ? NAMES.indexOf(pick) : null };
}

/* ------------------------------------------------------------ helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ramp = (colors, t) => { const a = rgb(colors.surface3), b = rgb(colors.magnitude); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };
function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic", halo = false } = {}) {
  ctx.save(); ctx.font = font ?? `${colors.fsXs} ${colors.font}`; ctx.textAlign = align; ctx.textBaseline = baseline;
  if (halo) { ctx.strokeStyle = colors.surface; ctx.lineWidth = 3; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill ?? colors.ink2; ctx.fillText(s, x, y); ctx.restore();
}
const capFont = (c) => `600 ${c.fsSm} ${c.font}`, mono = (c) => `${c.fsXs} ${c.mono}`, boldMono = (c) => `600 ${c.fsXs} ${c.mono}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) { ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); }
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1) { ctx.save(); if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); } ctx.restore(); }
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } ctx.restore(); }
function head(ctx, x, y, a, colour) { ctx.save(); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8 * Math.cos(a - 0.4), y - 8 * Math.sin(a - 0.4)); ctx.lineTo(x - 8 * Math.cos(a + 0.4), y - 8 * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill(); ctx.restore(); }
function matrix(ctx, colors, x, y, M, { cellW = 22, cellH = 18, hl = () => null, fmt = String } = {}) {
  const rows = M.length, cols = rows ? M[0].length : 0, x1 = x + cols * cellW + 6, y1 = y + rows * cellH;
  if (!rows || !cols) return x1;
  for (const [bx, d] of [[x, 1], [x1, -1]]) { line(ctx, bx, y, bx, y1, colors.ink2, 1.2); line(ctx, bx, y, bx + 4 * d, y, colors.ink2, 1.2); line(ctx, bx, y1, bx + 4 * d, y1, colors.ink2, 1.2); }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const cx = x + 3 + j * cellW, cy = y + i * cellH, h = hl(i, j);
    if (h) rect(ctx, cx + 1, cy + 1, cellW - 2, cellH - 2, h);
    txt(ctx, colors, M[i][j] == null ? "" : fmt(M[i][j]), cx + cellW / 2, cy + cellH / 2 + 0.5, { font: h ? boldMono(colors) : mono(colors), fill: h ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  }
  return x1;
}

/* ------------------------------------------------------------ geometry */

const H = 330, TOP = 34, CELL = 20, EI_TOP = 246;
const drawBox = (w) => ({ x0: 12, y0: 26, w: Math.min(w * 0.48, 340) - 24, h: 175 });
const point = (w, p) => { const b = drawBox(w); return [b.x0 + SLOTS[p][0] * b.w, b.y0 + SLOTS[p][1] * b.h]; };
const tablesX = (w) => Math.min(w * 0.48, 340) + 20;
const aGeom = (w, n) => { const xEnd = tablesX(w) + 30 + 2 * 30 + 6; return { x: xEnd + 40, y: TOP + 20, cell: 22 }; };
/** the handle for a pair: the midpoint undirected; nearer the target directed */
function handle(w, p, q, directed) {
  const [xa, ya] = point(w, p), [xb, yb] = point(w, q), t = directed ? 0.66 : 0.5;
  return [xa + (xb - xa) * t, ya + (yb - ya) * t];
}

/* ------------------------------------------------------------- regions */

function regions({ w, params, state }) {
  /* core validates the region table at load, before the first compute */
  const out = [], { n, directed, at } = state ?? compute({ params }), v = params.graph;
  if (MODE === "nodes") {
    for (let p = 0; p < n; p++) { const [x, y] = point(w, p); out.push({ x: x - 15, y: y - 15, w: 30, h: 30, label: NAMES[p], set: { graph: nodeClick(v, NAMES[p], directed) } }); }
  } else {
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) {
      if (p === q || (!directed && q < p)) continue;
      const [x, y] = handle(w, p, q, directed);
      out.push({ x: x - 7, y: y - 7, w: 14, h: 14, label: `${NAMES[p]}${NAMES[q]}`, set: { graph: toggled(v, NAMES[p], NAMES[q], directed) } });
    }
  }
  const g = aGeom(w, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    out.push({ x: g.x + 3 + j * g.cell, y: g.y + i * CELL, w: g.cell, h: CELL, label: `A[${i}][${j}]`, set: { graph: toggled(v, NAMES[at[i]], NAMES[at[j]], directed) } });
  }
  return out;
}

/* ---------------------------------------------------------------- draw */

function draw({ ctx, colors, w, h, state, pointer }) {
  const { n, directed, at, index, edges, cols, A, x, pick } = state;
  let hov = null, hovHandle = null;
  if (pointer) {
    for (let p = 0; p < n; p++) { const [px, py] = point(w, p); if (Math.hypot(pointer.x - px, pointer.y - py) <= 15) hov = p; }
    if (MODE === "handles") for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) {
      if (p === q || (!directed && q < p)) continue;
      const [hx, hy] = handle(w, p, q, directed);
      if (Math.abs(pointer.x - hx) <= 7 && Math.abs(pointer.y - hy) <= 7) hovHandle = [p, q];
    }
  }
  const b = drawBox(w);
  txt(ctx, colors, MODE === "nodes" ? "the graph · click two nodes to join them" : "the graph · click a pair's dot to join it", 12, 16, { font: capFont(colors), fill: colors.ink1 });

  /* candidate edge under the pointer, dashed */
  if (hovHandle) { const [p, q] = hovHandle, [xa, ya] = point(w, p), [xb, yb] = point(w, q); line(ctx, xa, ya, xb, yb, colors.highlight, 1.4, [4, 4]); }
  if (MODE === "nodes" && pick != null && hov != null && hov !== pick) { const [xa, ya] = point(w, pick), [xb, yb] = point(w, hov); line(ctx, xa, ya, xb, yb, colors.highlight, 1.4, [4, 4]); }

  /* edges */
  const r = 14;
  for (const [a, c] of edges) {
    const [xa, ya] = point(w, a), [xb, yb] = point(w, c), L = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / L, uy = (yb - ya) / L;
    const both = directed && edges.some(([s, t]) => s === c && t === a);
    const off = both ? 3.5 : 0, nx = -uy * off, ny = ux * off;
    line(ctx, xa + ux * r + nx, ya + uy * r + ny, xb - ux * (r + (directed ? 3 : 0)) + nx, yb - uy * (r + (directed ? 3 : 0)) + ny, colors.ink1, 2);
    if (directed) head(ctx, xb - ux * r + nx, yb - uy * r + ny, Math.atan2(uy, ux), colors.ink1);
  }
  /* handles */
  if (MODE === "handles") for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) {
    if (p === q || (!directed && q < p)) continue;
    const [hx, hy] = handle(w, p, q, directed);
    const present = edges.some(([s, t]) => (directed ? s === p && t === q : (s === p && t === q) || (s === q && t === p)));
    const isHov = hovHandle && hovHandle[0] === p && hovHandle[1] === q;
    dot(ctx, hx, hy, isHov ? 5 : 3.5, present ? colors.ink1 : isHov ? colors.highlight : colors.surface2, present ? null : colors.ink3, 1);
  }
  /* nodes */
  for (let p = 0; p < n; p++) {
    const [px, py] = point(w, p), f = FEATURES[p];
    for (let c = 0; c < 2; c++) rect(ctx, px - 14 + c * 14, py - 38, 14, 14, ramp(colors, f[c] / 1.3), colors.ink2);
    dot(ctx, px, py, r, p === pick ? wash(colors.highlight, 0.45) : p === hov ? wash(colors.groupA, 0.35) : colors.surface2, p === pick ? colors.highlight : colors.ink1, p === pick ? 2.4 : 1.4);
    txt(ctx, colors, NAMES[p], px, py + 0.5, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, align: "center", baseline: "middle" });
    txt(ctx, colors, String(index[p]), px + 17, py + 14, { font: boldMono(colors), fill: colors.ink2 });
  }

  /* x and A */
  const xX = tablesX(w), hi = (i) => hov != null && at[i] === hov;
  txt(ctx, colors, `x · [${n}, 2]`, xX, 16, { font: capFont(colors), fill: colors.ink1 });
  x.forEach((_, i) => txt(ctx, colors, `${i} ${NAMES[at[i]]}`, xX, TOP + 20 + i * CELL + CELL / 2 + 1, { font: mono(colors), fill: hi(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, xX + 30, TOP + 20, x, { cellW: 30, cellH: CELL, fmt: (v) => v.toFixed(1), hl: (i) => (hi(i) ? wash(colors.groupA, 0.3) : null) });
  const g = aGeom(w, n);
  txt(ctx, colors, `A · [${n}, ${n}] · click a cell`, g.x - 12, 16, { font: capFont(colors), fill: colors.ink1 });
  for (let j = 0; j < n; j++) txt(ctx, colors, String(j), g.x + 3 + j * g.cell + g.cell / 2, g.y - 5, { font: mono(colors), fill: colors.ink3, align: "center" });
  for (let i = 0; i < n; i++) txt(ctx, colors, String(i), g.x - 12, g.y + i * CELL + CELL / 2 + 1, { font: mono(colors), fill: colors.ink3, baseline: "middle" });
  let hovCell = null;
  if (pointer && pointer.x >= g.x + 3 && pointer.x < g.x + 3 + n * g.cell && pointer.y >= g.y && pointer.y < g.y + n * CELL) hovCell = [Math.floor((pointer.y - g.y) / CELL), Math.floor((pointer.x - g.x - 3) / g.cell)];
  matrix(ctx, colors, g.x, g.y, A.map((row, i) => row.map((v, j) => (i === j ? "·" : v))), {
    cellW: g.cell, cellH: CELL,
    hl: (i, j) => (hovCell && hovCell[0] === i && hovCell[1] === j && i !== j ? wash(colors.highlight, 0.32) : hi(i) || hi(j) ? wash(colors.groupA, 0.22) : null),
  });
  txt(ctx, colors, "row: source · column: target", g.x - 12, g.y + n * CELL + 14, { fill: colors.ink3 });

  /* edge_index */
  const K = cols.length;
  txt(ctx, colors, `edge_index · [2, ${K}]${directed ? "" : " · each edge both ways"} · sorted by source, then target`, 12, EI_TOP - 8, { font: capFont(colors), fill: colors.ink1 });
  txt(ctx, colors, "source", 12, EI_TOP + CELL / 2 + 1, { font: mono(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, "target", 12, EI_TOP + CELL * 1.5 + 1, { font: mono(colors), fill: colors.ink3, baseline: "middle" });
  if (K) matrix(ctx, colors, 64, EI_TOP, [cols.map((c) => c[0]), cols.map((c) => c[1])], {
    cellW: Math.min(30, (w - 64 - 20) / K), cellH: CELL,
    hl: (i, k) => (hov != null && at[cols[k][i]] === hov ? wash(colors.groupA, 0.25) : null),
  });
  else txt(ctx, colors, "empty · no edge yet", 70, EI_TOP + CELL + 4, { fill: colors.ink3 });

  /* the note */
  const deg = hov != null ? A[index[hov]].reduce((s, v) => s + v, 0) : null;
  const note = hov != null ? `${NAMES[hov]} · node ${index[hov]} · ${directed ? "out-degree" : "degree"} ${deg} = the sum of row ${index[hov]} of A`
    : pick != null ? `${NAMES[pick]} picked · click another node to join it, or ${NAMES[pick]} again to let go`
    : directed ? "a directed edge is stored once, source then target" : "an undirected edge is stored both ways, so A is symmetric";
  txt(ctx, colors, note, 12, h - 11, { fill: hov != null || pick != null ? colors.ink1 : colors.ink3 });
}

/* -------------------------------------------------------------- widget */

defineWidget({
  slug: "graph-constructor-lab",
  status: "draft",
  title: MODE === "nodes" ? "Lab · graph constructor, click two nodes" : "Lab · graph constructor, click a pair's dot",
  subtitle: "A prototype of the Graph page with the press replaced by construction. Every edit, from the drawing, from A or typed, goes through one parameter, the edge list, so the link carries the graph.",
  layout: "side",
  height: H,
  pointer: true,
  params: {
    nodes: { type: "choice", label: "Nodes", detail: "how many nodes the graph has; E and F's features are made up", options: ["3", "4", "5", "6"].map((v) => ({ value: v, label: v })), default: "4" },
    edges: { type: "segmented", label: "Edges", detail: "an edge that goes both ways, or one way from a source to a target", options: [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }], default: "undirected" },
    order: { type: "segmented", label: "Order", detail: "which node is numbered 0, 1, 2, …; the graph is the same either way", options: [{ value: "abc", label: "In order" }, { value: "shuffled", label: "Shuffled" }], default: "abc", display: true },
    graph: {
      type: "text", label: "Edge list", maxLength: 120,
      detail: "pairs of nodes, source then target, as A-B, B-C; an undirected edge needs only one of A-B or B-A",
      default: "", display: true,
      parse: parseGraph,
      show: (v) => pairsOf(v).map((p) => `${p[0]}-${p[1]}`).join(", "),
    },
  },
  compute,
  regions,
  draw,
  readout({ state }) {
    const { n, directed, edges, A } = state, m = edges.length;
    const sym = A.every((row, i) => row.every((v, j) => v === A[j][i]));
    return [
      { label: "Edges", value: String(m), note: directed ? "one column of edge_index each" : "two columns of edge_index each, one each way" },
      { label: "Density", value: (directed ? m / (n * (n - 1)) : (2 * m) / (n * (n - 1))).toFixed(2), note: directed ? "M / N(N − 1): edges over the possible ones" : "2M / N(N − 1): edges over the possible ones" },
      { label: "A", value: sym ? "symmetric" : "not symmetric", note: "A[i][j] is 1 when an edge runs from node i to node j" },
    ];
  },
  summary: ({ state }) => `a graph of ${state.n} nodes and ${state.edges.length} edges, with x, A and edge_index`,
});
