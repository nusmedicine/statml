/* ============================================================================
   Widget 94 · Graphs: Representation (`graph-representation`) — PHM5005 09-1
   cells 1–4 and 25 (a graph as nodes and edges; the adjacency matrix and the
   edge list; node features; PyG's `x` and `edge_index`), 09-2 cells 1 and
   6–17 (SMILES, caffeine, `x`, `edge_index`, `edge_attr`).

   The misconception, from 09-2 cell 1: SMILES strings "lose some of the
   spatial and relational information". They do not — every bond is in the
   string, and all 2,334 molecules of the lesson's file come back identical
   through RDKit (`_lab/graph-arc-measure.py`). What a string lacks is
   locality: 29% of the file's bonds join atoms that are not next to each
   other in it, and caffeine's ring closure joins atoms 1 and 13. An edge list
   holds every bond as a column whichever way the molecule was written.

   Two pages under Step (his picks from `_lab/graph-arc-mock.html`, all the
   recommendation, 2026-10-09):

     GRAPH     a graph the reader builds (his picks from
               `_lab/graph-constructor-mock.html`, all the recommendation,
               2026-10-09): 3–6 nodes, 09-1 cell 25's four proteins and two
               more, each with two features, opening with no edge. A click on
               a node and then another joins or parts them (directed: source
               first); a click on a cell of A does the same; the Edge list
               field takes them typed. `x`, A and `edge_index` (sorted by
               source then target, as PyG keeps it) follow at once, with the
               density, 09-1 cell 13's 2M / N(N − 1). ORDER numbers the same
               nodes another way: every table changes, the drawing does not.
               No press on this page (core's `anim.inert`).
     MOLECULE  caffeine (09-2 cell 6). The string above the drawing, each
               atom's number under its character; `x` (cell 11's five
               features), then `edge_index` and `edge_attr` with one column a
               directed edge, so a bond's two columns sit under each other in
               both. A press adds the next bond in mol.GetBonds() order (cell
               12's loop) and brackets its two atoms in the string. SMILES
               writes caffeine three ways, each numbering the atoms its own
               way; the drawing is one drawing.

   Numbering from 0 everywhere, as PyG (his call 5.3). Atoms drawn as nodes,
   a filled circle with the element, carbon included (5.4). Nothing trains:
   compute() is the tables; on Molecule the press reveals them (invariant 2),
   and its count survives a visit to the Graph page.

   THE GRAPH IS ONE PARAMETER, `graph`, a `text` field of node pairs, source
   then target, "AB,BC": the link carries the graph and the field is the
   keyboard path to it. A region computes its value from the parameters, so
   a click is one write to one parameter, inside core's one-parameter rule.
   The first click of a pair is a pending pick, and a second parameter for it
   would make the second click write two; so the pick rides in the same
   string after a bar, "AB,BC|C", and the field's `show` leaves it out. Every
   Graph-page control is `display`: none of them may reset the Molecule
   page's press.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { CAFFEINE } from "./data.js";

const PAGES = [{ value: "graph", label: "Graph" }, { value: "molecule", label: "Molecule" }];
const EDGES = [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }];
const ORDERS = [{ value: "abc", label: "In order" }, { value: "shuffled", label: "Shuffled" }];
const COUNTS = ["3", "4", "5", "6"].map((v) => ({ value: v, label: v }));
const STRINGS = [{ value: "first", label: "Original" }, { value: "canonical", label: "Canonical" }, { value: "other", label: "Random" }];
const STEP_MS = 240, RUN_MS = 520;
const ON = (page) => ({ param: "page", equals: page });

/* 09-1 cell 25's four proteins, two features each, and E and F, whose
   features are made up for this page */
const NAMES = ["A", "B", "C", "D", "E", "F"];
const FEATURES = [[1.2, 0.3], [0.8, 0.9], [1.1, 0.4], [0.5, 1.2], [0.9, 0.6], [1.3, 0.2]];
/* where each node sits, as fractions of a 250 × 175 drawing box, A–D left to
   right. Searched (600,000 draws, `_lab/graph-constructor.js`) so that, with
   3.5 px to spare, nodes are 40 px apart, no node's feature cells cover
   another node or its cells, and no node lies on the edge between two others */
const SLOTS = [[0.156, 0.557], [0.425, 0.311], [0.696, 0.865], [0.883, 0.564], [0.711, 0.315], [0.137, 0.875]];
/* the node numbered 0, 1, … when shuffled, filtered to the nodes on */
const SHUFFLE = [2, 0, 3, 1, 5, 4];
const BOND_TYPES = ["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"];
/* RDKit's numbers for hybridization, as 09-2 cell 11 stores them */
const HYB = { 2: "sp", 3: "sp2", 4: "sp3" };

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A graph is a set of nodes and the edges between them, held as tables: a feature matrix with one row a node, and an edge list with one column an edge. " +
    "Numbering the nodes in another order changes every table and leaves the graph the same. A molecule is such a graph, and its SMILES string records every bond, " +
    "though two bonded atoms can be written far apart.",
  pageLabel: "Step",
  nodesLabel: "Nodes",
  nodesDetail: "how many nodes the graph has; the features of E and F are made up",
  edgesLabel: "Edges",
  edgesDetail: "an edge that goes both ways, as a protein binding another, or one way, from a source to a target",
  orderLabel: "Order",
  orderDetail: "which node is numbered 0, 1, 2, …; the graph is the same either way",
  graphLabel: "Edge list",
  graphDetail: "pairs of nodes, source then target, as A-B, B-C; in an undirected graph A-B and B-A are one edge",
  stringLabel: "SMILES",
  stringDetail: "caffeine written three ways: as first given, in RDKit's canonical form, and from an oxygen in a random order; each numbers the atoms in its own order",

  stepLabel: "Next bond",
  stepTitle: "Add the next bond to edge_index and edge_attr",
  runLabel: "Play",
  runTitle: "Add the remaining bonds in turn",

  /* Graph */
  capGraph: "the graph · click two nodes to join them",
  capX: (n) => `x · [${n}, 2]`,
  capA: (n) => `A · [${n}, ${n}] · click a cell`,
  capAHint: "row: source · column: target",
  capEI: (k, dir) => `edge_index · [2, ${k}]${dir ? "" : " · each edge both ways"} · sorted by source, then target`,
  eiEmpty: "no edge yet",
  rowSrc: "source",
  rowTgt: "target",
  graphStatus: (n, m, k) => `${n} nodes · ${m} edge${m === 1 ? "" : "s"} · ${k} column${k === 1 ? "" : "s"} of edge_index`,
  graphNote: {
    undirected: "an undirected edge is stored both ways, so A is symmetric and edge_index has two columns an edge",
    directed: "a directed edge is stored once, source then target, so A need not be symmetric",
  },
  graphPick: (name) => `${name} picked · click another node to join it, or ${name} again to let go`,
  graphHover: (name, i, dir, d) => `${name} · node ${i}, row ${i} of x · ${dir ? "out-degree" : "degree"} ${d}, the sum of row ${i} of A`,

  /* Molecule */
  capString: "the string · one character a cell; an atom's number under its character",
  capMol: "the graph",
  capMolX: "x · [14, 5] · one row an atom",
  capMolEI: (k) => `edge_index · [2, ${k}]`,
  capAttr: (k) => `edge_attr · [${k}, 4] · one row a column above, one-hot by bond type`,
  attrRows: ["single", "double", "triple", "aromatic"],
  molStart: "no bond yet · the atoms, numbered in the order the string names them",
  molStatus: (n, N, i, j, ei, ej, type, gap) => `bond ${n} of ${N} · atoms ${i} and ${j}, ${ei}–${ej}, ${type.toLowerCase()} · ${gap === 1 ? "next to each other in the string" : `${gap} atoms apart in the string`}`,
  molNote: "the rows follow the string's order · a bond closed by a ring digit joins atoms written far apart",
  molHover: (i, x) => `atom ${i} · x row ${i}: atomic number ${x[0]}, ${x[1] ? "aromatic" : "not aromatic"}, hybridization ${x[2]} (${HYB[x[2]] ?? "other"}), ${x[3]} hydrogen${x[3] === 1 ? "" : "s"}, charge ${x[4]}`,
  molKey: "solid and dashed: aromatic · two lines: double",

  /* tiles */
  tileEdges: "Edges",
  tileEdgesNote: { undirected: "two columns of edge_index each, one each way", directed: "one column of edge_index each, source then target" },
  tileDensity: "Density",
  tileDensityNote: { undirected: "2M / N(N − 1): the edges there are over the edges there could be", directed: "M / N(N − 1): the edges there are over the edges there could be" },
  tileA: "A",
  tileAValue: (sym) => (sym ? "symmetric" : "not symmetric"),
  tileANote: "A[i][j] is 1 when an edge runs from node i to node j",
  tileAtoms: "Atoms",
  tileAtomsNote: "rows of x, in the order the string names them; its columns: atomic number, aromatic, hybridization (RDKit's number for it), hydrogens, charge",
  tileBonds: "Bonds",
  tileBondsNote: "two columns of edge_index each, one each way, and a row of edge_attr per column",
  tileFar: "Furthest apart",
  tileFarNote: "the widest gap in the string between two bonded atoms, counted in atoms, over the bonds added; 1 is next to each other",
  tileWait: "—",

  sumGraph: (n, m, dir) => `a ${dir ? "directed" : "undirected"} graph of ${n} nodes and ${m} edge${m === 1 ? "" : "s"}, with its feature matrix, adjacency matrix and edge list`,
  sumMol: (smi, n, N) => `caffeine written as ${smi}, its atoms as nodes, with x, edge_index and edge_attr; ${n === 0 ? "no bond added yet" : n < N ? `${n} of ${N} bonds added` : "every bond added"}`,
};

/* ------------------------------------------------------ drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ramp = (colors, t) => { const a = rgb(colors.surface3), b = rgb(colors.magnitude); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };

/* a caption longer than its panel drops trailing clauses (after " · ", "; "
   or ", ") until it fits, as 74 does; the clauses are ordered so the ones
   that go are the ones that can */
function fitText(ctx, s, maxW) {
  let out = s;
  while (ctx.measureText(out).width > maxW) {
    const cut = Math.max(out.lastIndexOf(" · "), out.lastIndexOf("; "), out.lastIndexOf(", "));
    if (cut <= 0) { while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1); return out + "…"; }
    out = out.slice(0, cut);
  }
  return out;
}
function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic", halo = false, maxW = null } = {}) {
  ctx.save();
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  if (maxW != null) s = fitText(ctx, String(s), maxW);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if (halo) { ctx.strokeStyle = colors.surface; ctx.lineWidth = 3; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill ?? colors.ink2;
  ctx.fillText(s, x, y);
  ctx.restore();
}
const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;
const boldMono = (colors) => `600 ${colors.fsXs} ${colors.mono}`;
const nodeFont = (colors) => `600 ${colors.fsXs} ${colors.font}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
function arrowHead(ctx, x, y, angle, colour, size = 8) {
  ctx.save(); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.4), y - size * Math.sin(angle - 0.4));
  ctx.lineTo(x - size * Math.cos(angle + 0.4), y - size * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill(); ctx.restore();
}
/** a node: a filled circle with its name in the middle */
function node(ctx, colors, x, y, r, name, { fill = null, stroke = null, lw = 1.4 } = {}) {
  dot(ctx, x, y, r, fill ?? colors.surface2, stroke ?? colors.ink1, lw);
  txt(ctx, colors, name, x, y + 0.5, { font: nodeFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
}
/** a matrix of numbers, the brackets drawn, a highlight per cell; returns its right edge */
function matrix(ctx, colors, x, y, M, { cellW = 22, cellH = 18, hl = () => null, fmt = String } = {}) {
  const rows = M.length, cols = M[0].length, x1 = x + cols * cellW + 6, y1 = y + rows * cellH;
  for (const [bx, d] of [[x, 1], [x1, -1]]) { line(ctx, bx, y, bx, y1, colors.ink2, 1.2); line(ctx, bx, y, bx + 4 * d, y, colors.ink2, 1.2); line(ctx, bx, y1, bx + 4 * d, y1, colors.ink2, 1.2); }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const cx = x + 3 + j * cellW, cy = y + i * cellH, h = hl(i, j);
    if (h) rect(ctx, cx + 1, cy + 1, cellW - 2, cellH - 2, h);
    const v = M[i][j];
    txt(ctx, colors, v == null ? "" : fmt(v), cx + cellW / 2, cy + cellH / 2 + 0.5, { font: h ? boldMono(colors) : monoFont(colors), fill: h ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  }
  return x1;
}

/* ============================================================== compute */

/* THE EDGE LIST AS A STRING. Pairs of node names, source then target, after
   a bar the pending pick of a two-click join. `parse` canonicalises whatever
   was typed or linked; the region helpers below write the same form. */
function parseGraph(t) {
  const [body, pickRaw = ""] = String(t).toUpperCase().split("|");
  const pairs = [];
  for (const m of body.matchAll(/([A-F])\s*[-–>→]?\s*([A-F])/g)) {
    const pq = m[1] + m[2];
    if (m[1] !== m[2] && !pairs.includes(pq)) pairs.push(pq);
  }
  const pick = /^[A-F]$/.test(pickRaw.trim()) ? pickRaw.trim() : "";
  return pairs.join(",") + (pick ? `|${pick}` : "");
}
const pairsOf = (v) => String(v).split("|")[0].split(",").filter(Boolean);
const pickOf = (v) => String(v).split("|")[1] ?? "";
const joinPairs = (pairs, pick = "") => pairs.join(",") + (pick ? `|${pick}` : "");
/** the edge p–q (undirected) or p→q (directed) toggled, any pick dropped */
function toggled(v, p, q, directed) {
  let pairs = pairsOf(v);
  const has = directed ? pairs.includes(p + q) : pairs.includes(p + q) || pairs.includes(q + p);
  if (has) pairs = pairs.filter((x) => (directed ? x !== p + q : x !== p + q && x !== q + p));
  else pairs.push(directed ? p + q : [p, q].sort().join(""));
  return joinPairs(pairs);
}
/** a click on node X: start a pick, finish one, or let it go */
function nodeClick(v, X, directed) {
  const pick = pickOf(v);
  if (!pick) return joinPairs(pairsOf(v), X);
  if (pick === X) return joinPairs(pairsOf(v));
  return toggled(v, pick, X, directed);
}

/* Nothing here is random and nothing trains. An edge whose node is switched
   off stays in the string and is not drawn, so switching it back restores it. */
function graphTables(params) {
  const n = Number(params.nodes), directed = params.edges === "directed";
  /* at[i] = the node numbered i; index[p] = the number node p gets */
  const at = params.order === "shuffled" ? SHUFFLE.filter((p) => p < n) : [...Array(n).keys()];
  const index = []; at.forEach((p, i) => (index[p] = i));
  const on = (c) => NAMES.indexOf(c) < n;
  const set = new Set();
  for (const pq of pairsOf(params.graph)) if (on(pq[0]) && on(pq[1])) set.add(directed ? pq : [pq[0], pq[1]].sort().join(""));
  const edges = [...set].map((pq) => [NAMES.indexOf(pq[0]), NAMES.indexOf(pq[1])]);
  /* edge_index sorted by source then target under this numbering, as PyG keeps it */
  const cols = [];
  for (const [a, b] of edges) { cols.push([index[a], index[b]]); if (!directed) cols.push([index[b], index[a]]); }
  cols.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const A = at.map(() => at.map(() => 0));
  for (const [i, j] of cols) A[i][j] = 1;
  const pick = pickOf(params.graph);
  return { n, directed, at, index, edges, cols, A, x: at.map((p) => FEATURES[p]), pick: pick && on(pick) ? NAMES.indexOf(pick) : null };
}
/* WHICH CHARACTERS ARE A BOND. A bond between atoms written next to each
   other has no character of its own; a "=" is one, and a ring closure is two
   digits, one where the ring opens and one where it closes. Read off the
   string with the branch stack, for the three strings data.js holds. */
const TOKEN = /(\[[^\]]+]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\(|\)|\.|=|#|-|\+|\\|\/|:|~|@|\?|>|\*|\$|%[0-9]{2}|[0-9])/g;
const ATOMISH = /^(\[.*]|Br|Cl|B|C|N|O|S|P|F|I|b|c|n|o|s|p|\*)$/;
function bondChars(smiles) {
  const out = new Map(), open = new Map(), stack = [];
  let prev = null, atom = -1, pending = [], pos = 0;
  const key = (i, j) => `${Math.min(i, j)},${Math.max(i, j)}`;
  for (const t of smiles.match(TOKEN)) {
    if (ATOMISH.test(t)) {
      atom += 1;
      if (prev != null) out.set(key(prev, atom), pending);
      pending = []; prev = atom;
    } else if (t === "(") stack.push(prev);
    else if (t === ")") prev = stack.pop();
    else if (/^(=|#|-|:)$/.test(t)) pending.push(pos);
    else if (/^(%[0-9]{2}|[0-9])$/.test(t)) {
      if (open.has(t)) { const o = open.get(t); out.set(key(o.atom, prev), [o.pos, pos]); open.delete(t); }
      else open.set(t, { atom: prev, pos });
    }
    pos += t.length;
  }
  return (i, j) => out.get(key(i, j)) ?? [];
}

function moleculeTables(which) {
  const v = CAFFEINE[which];
  const cols = [], attr = [];
  v.bonds.forEach(([i, j, type]) => {
    const oh = BOND_TYPES.map((t) => (t === type ? 1 : 0));
    cols.push([i, j]); cols.push([j, i]);           // cell 12: [[i, j], [j, i]]
    attr.push(oh); attr.push(oh);                    // cell 13: both directions
  });
  const chars = bondChars(v.smiles);
  return { kind: "molecule", ...v, cols, attr, bondChar: v.bonds.map(([i, j]) => chars(i, j)), steps: v.bonds.length };
}
function compute({ params }) {
  return {
    graph: graphTables(params),
    molecule: moleculeTables(params.smiles),
  };
}

/* ============================================================ animation */

const stageOf = (params) => params.page;
/** the press whose numbers are shown */
const shownStep = (anim) => anim.n[anim.stage];
const stepsOf = (state, stage) => (stage === "molecule" ? state.molecule.steps : 0);

/* ================================================================ Graph */

const G = { cellH: 20, tableTop: 54, eiTop: 246 };
const H_GRAPH = 330;
/* the left part holds the drawing, the right part x and A; A's cells narrow
   so six columns fit the narrowest side layout (534 px) */
const leftW = (w) => Math.min(w * 0.47, 330);
const drawBox = (w) => ({ x0: 12, y0: 26, w: leftW(w) - 24, h: 175 });
const nodeAt = (w, p) => { const b = drawBox(w); return [b.x0 + SLOTS[p][0] * b.w, b.y0 + SLOTS[p][1] * b.h]; };
const NODE_R = 14;
function tablesGeom(w, n) {
  const xX = leftW(w) + 8, xEnd = xX + 28 + 2 * 28 + 6, aX = xEnd + 30;
  return { xX, aX, cell: Math.max(16, Math.min(22, (w - aX - 12 - 18) / n)) };
}

/** the clickable targets: each node, and each off-diagonal cell of A */
function graphRegions(w, params, st) {
  const out = [], v = params.graph, { n, directed, at } = st;
  for (let p = 0; p < n; p++) {
    const [x, y] = nodeAt(w, p);
    out.push({ x: x - 15, y: y - 15, w: 30, h: 30, label: NAMES[p], set: { graph: nodeClick(v, NAMES[p], directed) } });
  }
  const g = tablesGeom(w, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    out.push({ x: g.aX + 12 + 3 + j * g.cell, y: G.tableTop + i * G.cellH, w: g.cell, h: G.cellH, label: `A[${i}][${j}]`, set: { graph: toggled(v, NAMES[at[i]], NAMES[at[j]], directed) } });
  }
  return out;
}

function drawGraph(ctx, colors, w, h, st, pointer) {
  const { n, directed, at, index, edges, cols, A, x, pick } = st;
  let hov = null, hovCell = null;
  const g = tablesGeom(w, n);
  if (pointer) {
    for (let p = 0; p < n; p++) { const [px, py] = nodeAt(w, p); if (Math.hypot(pointer.x - px, pointer.y - py) <= 15) hov = p; }
    const cx = g.aX + 12 + 3;
    if (pointer.x >= cx && pointer.x < cx + n * g.cell && pointer.y >= G.tableTop && pointer.y < G.tableTop + n * G.cellH) {
      const i = Math.floor((pointer.y - G.tableTop) / G.cellH), j = Math.floor((pointer.x - cx) / g.cell);
      if (i !== j) hovCell = [i, j];
    }
  }
  txt(ctx, colors, S.capGraph, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: leftW(w) - 12 });

  /* the edge a click would toggle, dashed: from the pick to the hovered node, or a hovered cell's pair */
  const preview = pick != null && hov != null && hov !== pick ? [pick, hov] : hovCell ? [at[hovCell[0]], at[hovCell[1]]] : null;
  if (preview) { const [xa, ya] = nodeAt(w, preview[0]), [xb, yb] = nodeAt(w, preview[1]); line(ctx, xa, ya, xb, yb, colors.highlight, 1.4, [4, 4]); }

  /* edges; a pair joined both ways when directed is two arrows side by side */
  for (const [a, c] of edges) {
    const [xa, ya] = nodeAt(w, a), [xb, yb] = nodeAt(w, c), L = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / L, uy = (yb - ya) / L;
    const off = directed && edges.some(([s2, t2]) => s2 === c && t2 === a) ? 3.5 : 0, nx = -uy * off, ny = ux * off;
    const end = NODE_R + (directed ? 3 : 0);
    line(ctx, xa + ux * NODE_R + nx, ya + uy * NODE_R + ny, xb - ux * end + nx, yb - uy * end + ny, colors.ink1, 2);
    if (directed) arrowHead(ctx, xb - ux * NODE_R + nx, yb - uy * NODE_R + ny, Math.atan2(uy, ux), colors.ink1);
  }
  /* nodes: the features above as two cells, the number at the lower right */
  for (let p = 0; p < n; p++) {
    const [px, py] = nodeAt(w, p), f = FEATURES[p];
    for (let c = 0; c < 2; c++) rect(ctx, px - 14 + c * 14, py - 38, 14, 14, ramp(colors, f[c] / 1.3), colors.ink2);
    node(ctx, colors, px, py, NODE_R, NAMES[p], {
      fill: p === pick ? wash(colors.highlight, 0.45) : p === hov ? wash(colors.groupA, 0.35) : null,
      stroke: p === pick ? colors.highlight : null, lw: p === pick ? 2.4 : 1.4,
    });
    txt(ctx, colors, String(index[p]), px + 17, py + 14, { font: boldMono(colors), fill: colors.ink2 });
  }

  /* x and A at the right */
  const hi = (i) => hov != null && at[i] === hov;
  txt(ctx, colors, S.capX(n), g.xX, 14, { font: capFont(colors), fill: colors.ink1 });
  x.forEach((_, i) => txt(ctx, colors, `${i} ${NAMES[at[i]]}`, g.xX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: hi(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, g.xX + 28, G.tableTop, x, { cellW: 28, cellH: G.cellH, fmt: (v) => v.toFixed(1), hl: (i) => (hi(i) ? wash(colors.groupA, 0.3) : null) });
  txt(ctx, colors, S.capA(n), g.aX, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - g.aX - 8 });
  for (let j = 0; j < n; j++) txt(ctx, colors, String(j), g.aX + 12 + 3 + j * g.cell + g.cell / 2, G.tableTop - 6, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  for (let i = 0; i < n; i++) txt(ctx, colors, String(i), g.aX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  matrix(ctx, colors, g.aX + 12, G.tableTop, A.map((row, i) => row.map((v, j) => (i === j ? "·" : v))), {
    cellW: g.cell, cellH: G.cellH,
    hl: (i, j) => (hovCell && hovCell[0] === i && hovCell[1] === j ? wash(colors.highlight, 0.32) : hi(i) || hi(j) ? wash(colors.groupA, 0.22) : null),
  });
  txt(ctx, colors, S.capAHint, g.aX, G.tableTop + n * G.cellH + 14, { fill: colors.ink3, maxW: w - g.aX - 8 });

  /* the edge list, full width under the drawing */
  const K = cols.length;
  txt(ctx, colors, S.capEI(K, directed), 12, G.eiTop - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.rowSrc, 12, G.eiTop + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, S.rowTgt, 12, G.eiTop + G.cellH * 1.5 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  if (K) {
    matrix(ctx, colors, 64, G.eiTop, [cols.map((c) => c[0]), cols.map((c) => c[1])], {
      cellW: Math.min(30, (w - 64 - 20) / K), cellH: G.cellH,
      hl: (i, k) => (hov != null && at[cols[k][i]] === hov ? wash(colors.groupA, 0.25) : null),
    });
  } else txt(ctx, colors, S.eiEmpty, 70, G.eiTop + G.cellH + 4, { fill: colors.ink3 });

  /* the status line and the note: a pick, a hovered node, or the rule */
  txt(ctx, colors, S.graphStatus(n, edges.length, K), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  const note = hov != null ? S.graphHover(NAMES[hov], index[hov], directed, A[index[hov]].reduce((a, v) => a + v, 0))
    : pick != null ? S.graphPick(NAMES[pick]) : S.graphNote[directed ? "directed" : "undirected"];
  txt(ctx, colors, note, 12, h - 11, { fill: hov != null || pick != null ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* ============================================================= Molecule */

const M = { strTop: 30, strH: 22, molTop: 92, molH: 250, xRow: 17, eiGap: 34, eiCellH: 16, attrCellH: 13, labelW: 62 };
const molBottom = () => M.molTop + M.molH;
const eiTop = () => molBottom() + M.eiGap;
const attrTop = () => eiTop() + 2 * M.eiCellH + 30;
const H_MOL = attrTop() + 4 * M.attrCellH + 46;

/** caffeine's drawing, fitted into a box; one drawing for every string */
function molPoints(st, x0, y0, w, h) {
  const xs = st.atoms.map((a) => a.xy[0]), ys = st.atoms.map((a) => a.xy[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min(w / (maxx - minx), h / (maxy - miny), 64);
  const ox = x0 + (w - (maxx - minx) * s) / 2, oy = y0 + (h - (maxy - miny) * s) / 2;
  return st.atoms.map((a) => [ox + (a.xy[0] - minx) * s, oy + (a.xy[1] - miny) * s]);
}
function bond(ctx, p, q, type, colour, width, pending) {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * 2.6, ny = (dx / L) * 2.6;
  if (pending) { line(ctx, p[0], p[1], q[0], q[1], colour, 1.2, [4, 4]); return; }
  if (type === "DOUBLE") { line(ctx, p[0] + nx, p[1] + ny, q[0] + nx, q[1] + ny, colour, width); line(ctx, p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, colour, width); }
  else if (type === "AROMATIC") { line(ctx, p[0] + nx, p[1] + ny, q[0] + nx, q[1] + ny, colour, width); line(ctx, p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, colour, width, [3, 2.5]); }
  else line(ctx, p[0], p[1], q[0], q[1], colour, width);
}

function drawMolecule(ctx, colors, w, h, st, anim, pointer) {
  const n = shownStep(anim), N = st.steps, s = st.smiles;
  const lastBond = n > 0 ? st.bonds[n - 1] : null;
  const molW = Math.min(w * 0.5, 360);
  const P = molPoints(st, 24, M.molTop + 10, molW - 36, M.molH - 40);

  /* the hovered atom: the drawing, the string or a row of x all reach it */
  const xX = molW + 18, xCellW = Math.min(30, (w - xX - 44) / 5);
  let hov = null;
  if (pointer) {
    P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 13) hov = i; });
    const cw = Math.min(17, (w - 24) / s.length), sx = (w - s.length * cw) / 2;
    if (pointer.y >= M.strTop && pointer.y <= M.strTop + M.strH + 14) {
      const k = Math.floor((pointer.x - sx) / cw);
      st.atoms.forEach((a, i) => { if (k >= a.char[0] && k < a.char[0] + a.char[1]) hov = i; });
    }
    if (pointer.x >= xX && pointer.x < w - 8 && pointer.y >= M.molTop + 4 && pointer.y < M.molTop + 4 + st.atoms.length * M.xRow) hov = Math.floor((pointer.y - M.molTop - 4) / M.xRow);
  }
  const lastAtoms = lastBond ? new Set([lastBond[0], lastBond[1]]) : new Set();

  /* 1 · the string, one character a cell */
  txt(ctx, colors, S.capString, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  const cw = Math.min(17, (w - 24) / s.length), sx = (w - s.length * cw) / 2;
  const owner = new Array(s.length).fill(null);
  st.atoms.forEach((a, i) => { for (let k = 0; k < a.char[1]; k++) owner[a.char[0] + k] = i; });
  const ownChars = new Set(n > 0 ? st.bondChar[n - 1] : []);
  for (let k = 0; k < s.length; k++) {
    const i = owner[k], fill = ownChars.has(k) ? colors.highlight : i != null && lastAtoms.has(i) ? wash(colors.highlight, 0.32) : i != null && i === hov ? wash(colors.groupA, 0.32) : colors.surface2;
    rect(ctx, sx + k * cw, M.strTop, cw, M.strH, fill, colors.grid);
    txt(ctx, colors, s[k], sx + k * cw + cw / 2, M.strTop + M.strH / 2 + 1, { font: i != null || ownChars.has(k) ? boldMono(colors) : monoFont(colors), fill: ownChars.has(k) ? colors.surface : i != null ? colors.ink1 : colors.ink3, align: "center", baseline: "middle" });
  }
  st.atoms.forEach((a, i) => txt(ctx, colors, String(i), sx + (a.char[0] + a.char[1] / 2) * cw, M.strTop + M.strH + 12, { font: monoFont(colors), fill: lastAtoms.has(i) || i === hov ? colors.ink1 : colors.ink3, align: "center" }));
  /* the latest bond's two atoms bracketed under the numbers */
  if (lastBond) {
    const [i, j] = lastBond, xa = sx + (st.atoms[i].char[0] + 0.5) * cw, xb = sx + (st.atoms[j].char[0] + 0.5) * cw, yb = M.strTop + M.strH + 18;
    line(ctx, xa, yb, xa, yb + 6, colors.highlight, 1.6); line(ctx, xb, yb, xb, yb + 6, colors.highlight, 1.6); line(ctx, xa, yb + 6, xb, yb + 6, colors.highlight, 1.6);
  }

  /* 2 · the drawing: added bonds in ink, the latest in the highlight, the rest faint */
  txt(ctx, colors, S.capMol, 12, M.molTop, { font: capFont(colors), fill: colors.ink1 });
  st.bonds.forEach(([i, j, type], k) => {
    const added = k < n, latest = k === n - 1;
    bond(ctx, P[i], P[j], type, latest ? colors.highlight : added ? colors.ink1 : colors.grid, latest ? 2.2 : 1.5, !added);
  });
  st.atoms.forEach((a, i) => {
    node(ctx, colors, P[i][0], P[i][1], 11, a.el, { fill: i === hov ? wash(colors.groupA, 0.35) : lastAtoms.has(i) ? wash(colors.highlight, 0.3) : null });
    txt(ctx, colors, String(i), P[i][0] + 12, P[i][1] - 9, { font: monoFont(colors), fill: colors.ink3, halo: true });
  });
  txt(ctx, colors, S.molKey, 12, molBottom() - 2, { fill: colors.ink3, maxW: molW - 12 });

  /* 3 · x, at the right, one row an atom */
  txt(ctx, colors, S.capMolX, xX, M.molTop, { font: capFont(colors), fill: colors.ink1, maxW: w - xX - 12 });
  st.atoms.forEach((a, i) => txt(ctx, colors, `${i} ${a.el}`, xX, M.molTop + 4 + i * M.xRow + M.xRow / 2 + 1, { font: monoFont(colors), fill: i === hov || lastAtoms.has(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, xX + 36, M.molTop + 4, st.atoms.map((a) => a.x), {
    cellW: xCellW, cellH: M.xRow,
    hl: (i) => (i === hov ? wash(colors.groupA, 0.3) : lastAtoms.has(i) ? wash(colors.highlight, 0.28) : null),
  });

  /* 4 · edge_index and, under each of its columns, that column's row of edge_attr */
  const K = st.cols.length, shown = 2 * n, x0 = 12 + M.labelW, cellW = (w - x0 - 20) / K;
  const isLast = (k) => lastBond && (k === shown - 1 || k === shown - 2);
  const touches = (k) => hov != null && (st.cols[k][0] === hov || st.cols[k][1] === hov);
  txt(ctx, colors, S.capMolEI(shown), 12, eiTop() - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.rowSrc, 12, eiTop() + M.eiCellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, S.rowTgt, 12, eiTop() + M.eiCellH * 1.5 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  matrix(ctx, colors, x0 - 3, eiTop(), [st.cols.map((c, k) => (k < shown ? c[0] : null)), st.cols.map((c, k) => (k < shown ? c[1] : null))], {
    cellW, cellH: M.eiCellH,
    hl: (i, k) => (k >= shown ? null : isLast(k) ? wash(colors.highlight, 0.32) : touches(k) ? wash(colors.groupA, 0.25) : null),
  });
  txt(ctx, colors, S.capAttr(shown), 12, attrTop() - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  S.attrRows.forEach((r, t) => txt(ctx, colors, r, 12, attrTop() + t * M.attrCellH + M.attrCellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  for (let k = 0; k < K; k++) for (let t = 0; t < 4; t++) {
    const x = x0 + k * cellW, y = attrTop() + t * M.attrCellH, on = k < shown && st.attr[k][t] === 1;
    rect(ctx, x + 1, y + 1, cellW - 2, M.attrCellH - 2, on ? (isLast(k) ? colors.highlight : touches(k) ? colors.groupA : colors.ink2) : k < shown ? colors.surface2 : null);
  }
  rect(ctx, x0, attrTop(), K * cellW, 4 * M.attrCellH, null, colors.grid);

  /* the status line and the note */
  const gap = lastBond ? Math.abs(lastBond[0] - lastBond[1]) : 0;
  txt(ctx, colors, n === 0 ? S.molStart : S.molStatus(n, N, lastBond[0], lastBond[1], st.atoms[lastBond[0]].el, st.atoms[lastBond[1]].el, lastBond[2], gap), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, hov != null ? S.molHover(hov, st.atoms[hov].x) : S.molNote, 12, h - 11, { fill: hov != null ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* ================================================================ widget */

defineWidget({
  slug: "graph-representation",
  status: "draft",
  title: "Deep Learning - Graphs: Representation",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page }) => (page === "molecule" ? H_MOL : H_GRAPH),
  pointer: true,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "graph", display: true },
    /* every Graph-page control is display: none may reset the Molecule page's press */
    nodes: { type: "choice", label: S.nodesLabel, detail: S.nodesDetail, options: COUNTS, default: "4", display: true, when: ON("graph") },
    edges: { type: "segmented", label: S.edgesLabel, detail: S.edgesDetail, options: EDGES, default: "undirected", display: true, when: ON("graph") },
    order: { type: "segmented", label: S.orderLabel, detail: S.orderDetail, options: ORDERS, default: "abc", display: true, when: ON("graph") },
    graph: {
      type: "text", label: S.graphLabel, detail: S.graphDetail, maxLength: 120, default: "", display: true, when: ON("graph"),
      parse: parseGraph,
      show: (v) => pairsOf(v).map((pq) => `${pq[0]}-${pq[1]}`).join(", "),
    },
    smiles: { type: "segmented", label: S.stringLabel, detail: S.stringDetail, options: STRINGS, default: "first", display: true, when: ON("molecule") },
    /* authoring escape hatch, first render only: bonds already added on the Molecule page */
    shown: { type: "int", min: 0, max: 15, default: 0, hidden: true },
  },

  compute,

  regions: ({ w, params, state }) => (params.page === "graph" ? graphRegions(w, params, state?.graph ?? graphTables(params)) : []),

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const stage = stageOf(params);
      const anim = { stage, n: { graph: 0, molecule: 0 }, t: 1, moving: false, halt: false };
      anim.n.molecule = fromScratch ? 0 : Math.max(0, Math.min(state.molecule.steps, Number(params.shown) || 0));
      anim.done = anim.n[stage] >= stepsOf(state, stage);
      /* the Graph page is built by clicking: core takes Step and Play out of the row */
      anim.inert = stage === "graph";
      return anim;
    },

    advance: (anim, { dt, state }) => {
      /* a press a page switch finished (`rebuild`) ends here, before it takes the new page's press */
      if (anim.halt) { anim.halt = false; anim.moving = false; return false; }
      const stage = anim.stage, steps = stepsOf(state, stage), ms = anim.mode === "run" ? RUN_MS : STEP_MS;
      let more;
      if (anim.t < 1) {
        anim.t = Math.min(1, anim.t + dt / ms);
        more = anim.t < 1 || (anim.mode === "run" && anim.n[stage] < steps);
      } else if (anim.n[stage] < steps) {
        /* the edge appears at once (no fades); the pause after it paces Play */
        anim.n[stage] += 1; anim.t = 0; more = true;
      } else more = false;
      anim.done = anim.n[stage] >= steps && anim.t >= 1;
      anim.moving = more;
      return more;
    },

    rebuild: (anim, { params, state }) => {
      /* a press belongs to the page it started on: only a PAGE change ends it
         (mid-press-page-switch, 2026-09-20; 91 caught a display change ending one) */
      const stage = stageOf(params);
      if (anim.moving && stage !== anim.stage) { anim.t = 1; anim.halt = true; }
      anim.stage = stage;
      anim.n[stage] = Math.min(anim.n[stage], stepsOf(state, stage));
      anim.done = anim.n[stage] >= stepsOf(state, stage);
      anim.inert = stage === "graph";
    },
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    if (params.page === "molecule") drawMolecule(ctx, colors, w, h, state.molecule, anim, pointer);
    else drawGraph(ctx, colors, w, h, state.graph, pointer);
  },

  readout({ params, state, anim }) {
    if (params.page === "molecule") {
      const st = state.molecule, n = anim.n.molecule;
      const far = n > 0 ? Math.max(...st.bonds.slice(0, n).map(([i, j]) => Math.abs(i - j))) : null;
      return [
        { label: S.tileAtoms, value: String(st.atoms.length), note: S.tileAtomsNote },
        { label: S.tileBonds, value: `${n} of ${st.steps}`, note: S.tileBondsNote },
        { label: S.tileFar, value: far == null ? S.tileWait : String(far), note: S.tileFarNote },
      ];
    }
    const st = state.graph, m = st.edges.length, key = st.directed ? "directed" : "undirected";
    const sym = st.A.every((row, i) => row.every((v, j) => v === st.A[j][i]));
    const density = (st.directed ? m : 2 * m) / (st.n * (st.n - 1));
    return [
      { label: S.tileEdges, value: String(m), note: S.tileEdgesNote[key] },
      { label: S.tileDensity, value: density.toFixed(2), note: S.tileDensityNote[key] },
      { label: S.tileA, value: S.tileAValue(sym), note: S.tileANote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "molecule") return S.sumMol(state.molecule.smiles, anim.n.molecule, state.molecule.steps);
    return S.sumGraph(state.graph.n, state.graph.edges.length, state.graph.directed);
  },
});
