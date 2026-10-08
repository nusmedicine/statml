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

     GRAPH     09-1 cell 25's four proteins, A – B – C – D, two features each.
               A press adds the next edge: its cells in A and its column(s) in
               `edge_index` fill. Undirected stores an edge both ways (A is
               symmetric), directed once. ORDER numbers the same four nodes
               another way: every table changes, the drawing does not.
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
   compute() is the tables; the press reveals them (invariant 2). Each stage
   keeps its own count, so a page switch and back finds it where it was.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { CAFFEINE } from "./data.js";

const PAGES = [{ value: "graph", label: "Graph" }, { value: "molecule", label: "Molecule" }];
const EDGES = [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }];
/* the node numbered 0, 1, 2, 3 in turn */
const ORDERS = [{ value: "abcd", label: "A, B, C, D" }, { value: "cadb", label: "C, A, D, B" }];
const STRINGS = [{ value: "first", label: "Original" }, { value: "canonical", label: "Canonical" }, { value: "other", label: "Random" }];
const STEP_MS = 240, RUN_MS = 520;
const ON = (page) => ({ param: "page", equals: page });

/* 09-1 cell 25: four proteins, two features each, a chain */
const PROTEINS = ["A", "B", "C", "D"];
const FEATURES = [[1.2, 0.3], [0.8, 0.9], [1.1, 0.4], [0.5, 1.2]];
const CHAIN = [[0, 1], [1, 2], [2, 3]];
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
  edgesLabel: "Edges",
  edgesDetail: "an edge that goes both ways, as a protein binding another, or one way, from a source to a target",
  orderLabel: "Order",
  orderDetail: "which node is numbered 0, 1, 2 and 3; the graph is the same either way",
  stringLabel: "SMILES",
  stringDetail: "caffeine written three ways: as first given, in RDKit's canonical form, and from an oxygen in a random order; each numbers the atoms in its own order",

  stepLabel: { param: "page", labels: { molecule: "Next bond" }, default: "Next edge" },
  stepTitle: { param: "page", labels: { graph: "Add the next edge to A and edge_index", molecule: "Add the next bond to edge_index and edge_attr" }, default: "Next edge" },
  runLabel: "Play",
  runTitle: { param: "page", labels: { graph: "Add the remaining edges in turn", molecule: "Add the remaining bonds in turn" }, default: "Play" },

  /* Graph */
  capGraph: "the graph · four proteins, two features each",
  capX: "x · [4, 2]",
  capA: "A · [4, 4]",
  capAHint: "row: source · column: target",
  capEI: (k) => `edge_index · [2, ${k}]`,
  rowSrc: "source",
  rowTgt: "target",
  graphStart: "no edge yet · the nodes, their features and their numbers",
  graphStatus: (n, N, a, b, dir, cols) => `edge ${n} of ${N} · ${a} ${dir ? "→" : "–"} ${b} · ${cols}`,
  colsOne: (k) => `column ${k} of edge_index`,
  colsTwo: (k) => `columns ${k} and ${k + 1} of edge_index, one each way`,
  graphNote: {
    undirected: "an undirected edge is stored both ways, so A is symmetric and edge_index has two columns an edge",
    directed: "a directed edge is stored once, source then target, so A need not be symmetric",
  },
  graphHover: (name, i, f) => `${name} · node ${i} · row ${i} of x · features ${f[0].toFixed(1)}, ${f[1].toFixed(1)}`,

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
  tileNodes: "Nodes",
  tileNodesNote: "rows of x, one a node, in the order numbered",
  tileEdges: "Edges",
  tileEdgesNote: { undirected: "two columns of edge_index each, one each way", directed: "one column of edge_index each, source then target" },
  tileA: "A",
  tileAValue: { undirected: "symmetric", directed: "not symmetric" },
  tileANote: "A[i][j] is 1 when an edge runs from node i to node j",
  tileAtoms: "Atoms",
  tileAtomsNote: "rows of x, in the order the string names them; its columns: atomic number, aromatic, hybridization (RDKit's number for it), hydrogens, charge",
  tileBonds: "Bonds",
  tileBondsNote: "two columns of edge_index each, one each way, and a row of edge_attr per column",
  tileFar: "Furthest apart",
  tileFarNote: "the widest gap in the string between two bonded atoms, counted in atoms, over the bonds added; 1 is next to each other",
  tileWait: "—",

  sumGraph: (dir, n, N) => `four proteins in a chain, ${dir ? "directed" : "undirected"}, with their feature matrix, adjacency matrix and edge list; ${n === 0 ? "no edge added yet" : n < N ? `${n} of ${N} edges added` : "every edge added"}`,
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

/* Nothing here is random and nothing trains: the tables, in full, for the
   stage the parameters name. The press decides how much of them is shown. */
function graphTables(directed, order) {
  /* index[name] = the number the node gets; at[i] = the node numbered i */
  const at = order === "cadb" ? [2, 0, 3, 1] : [0, 1, 2, 3];
  const index = []; at.forEach((p, i) => (index[p] = i));
  const x = at.map((p) => FEATURES[p]);
  const cols = [], perEdge = [];
  for (const [a, b] of CHAIN) {
    const k = cols.length;
    cols.push([index[a], index[b]]);
    if (!directed) cols.push([index[b], index[a]]);
    perEdge.push({ a, b, first: k, count: directed ? 1 : 2 });
  }
  return { kind: "graph", directed, at, index, x, cols, perEdge, steps: CHAIN.length };
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
    graph: graphTables(params.edges === "directed", params.order),
    molecule: moleculeTables(params.smiles),
  };
}

/* ============================================================ animation */

const stageOf = (params) => params.page;
/** the press whose numbers are shown */
const shownStep = (anim) => anim.n[anim.stage];
const stepsOf = (state, stage) => state[stage].steps;

/* ================================================================ Graph */

const G = { top: 24, drawH: 150, tableTop: 44, cellH: 20, eiTop: 214, statusFromBottom: 24 };
const H_GRAPH = 300;
/** the four nodes' places in the drawing, a zigzag like his figures */
function graphPoints(w) {
  const x0 = 24, x1 = Math.min(w * 0.46, 330), y0 = G.top + 58, y1 = G.top + 128;
  return [0, 1, 2, 3].map((p) => [x0 + (p + 0.5) * ((x1 - x0) / 4), p % 2 ? y0 : y1]);
}

function drawGraph(ctx, colors, w, h, st, anim, pointer) {
  const n = shownStep(anim), dir = st.directed, P = graphPoints(w);
  const last = n > 0 ? st.perEdge[n - 1] : null;
  const shownCols = n > 0 ? st.perEdge[n - 1].first + st.perEdge[n - 1].count : 0;

  /* the hovered node, by name position */
  let hov = null;
  if (pointer) P.forEach(([x, y], p) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 16) hov = p; });

  txt(ctx, colors, S.capGraph, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: Math.min(w * 0.46, 330) - 12 });
  /* edges: added in ink, the latest in the highlight; the rest of the chain faint, so the shape reads before it is built */
  CHAIN.forEach(([a, b], k) => {
    const [xa, ya] = P[a], [xb, yb] = P[b], added = k < n, latest = k === n - 1;
    const col = latest ? colors.highlight : added ? colors.ink1 : colors.grid;
    const L = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / L, uy = (yb - ya) / L, r = 15;
    line(ctx, xa + ux * r, ya + uy * r, xb - ux * (r + (dir && added ? 2 : 0)), yb - uy * (r + (dir && added ? 2 : 0)), col, added ? 2.2 : 1.2, added ? null : [4, 4]);
    if (dir && added) arrowHead(ctx, xb - ux * r, yb - uy * r, Math.atan2(uy, ux), col);
  });
  /* nodes: features above as two cells, the number below */
  P.forEach(([x, y], p) => {
    const f = FEATURES[p], isLast = last && (last.a === p || last.b === p);
    for (let c = 0; c < 2; c++) rect(ctx, x - 14 + c * 14, y - 40, 14, 14, ramp(colors, f[c] / 1.3), colors.ink2);
    node(ctx, colors, x, y, 14, PROTEINS[p], { fill: hov === p ? wash(colors.groupA, 0.35) : isLast ? wash(colors.highlight, 0.3) : null });
    txt(ctx, colors, String(st.index[p]), x, y + 30, { font: boldMono(colors), fill: colors.ink2, align: "center" });
  });

  /* the tables at the right: x, then A */
  const hi = (i) => (hov != null && st.at[i] === hov);
  const xX = Math.min(w * 0.46, 330) + 24;
  txt(ctx, colors, S.capX, xX, 14, { font: capFont(colors), fill: colors.ink1 });
  st.x.forEach((_, i) => txt(ctx, colors, `${i} ${PROTEINS[st.at[i]]}`, xX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: hi(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  const xEnd = matrix(ctx, colors, xX + 30, G.tableTop, st.x, { cellW: 30, cellH: G.cellH, fmt: (v) => v.toFixed(1), hl: (i) => (hi(i) ? wash(colors.groupA, 0.3) : null) });

  const aX = xEnd + 34;
  const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (let c = 0; c < shownCols; c++) A[st.cols[c][0]][st.cols[c][1]] = 1;
  const lastCells = new Set();
  if (last) for (let c = last.first; c < last.first + last.count; c++) lastCells.add(`${st.cols[c][0]},${st.cols[c][1]}`);
  txt(ctx, colors, S.capA, aX, 14, { font: capFont(colors), fill: colors.ink1 });
  [0, 1, 2, 3].forEach((j) => txt(ctx, colors, String(j), aX + 3 + 11 + j * 22 + 12, G.tableTop - 6, { font: monoFont(colors), fill: colors.ink3, align: "center" }));
  [0, 1, 2, 3].forEach((i) => txt(ctx, colors, String(i), aX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, aX + 12, G.tableTop, A, {
    cellW: 22, cellH: G.cellH,
    hl: (i, j) => (lastCells.has(`${i},${j}`) ? wash(colors.highlight, 0.32) : hi(i) || hi(j) ? wash(colors.groupA, 0.22) : null),
  });
  txt(ctx, colors, S.capAHint, aX, G.tableTop + 4 * G.cellH + 16, { fill: colors.ink3, maxW: w - aX - 12 });

  /* the edge list, full width under the drawing */
  const K = st.cols.length;
  txt(ctx, colors, S.capEI(shownCols), 12, G.eiTop - 8, { font: capFont(colors), fill: colors.ink1 });
  txt(ctx, colors, S.rowSrc, 12, G.eiTop + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, S.rowTgt, 12, G.eiTop + G.cellH * 1.5 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  const EI = [st.cols.map((c, k) => (k < shownCols ? c[0] : null)), st.cols.map((c, k) => (k < shownCols ? c[1] : null))];
  matrix(ctx, colors, 64, G.eiTop, EI, {
    cellW: Math.min(30, (w - 64 - 20) / K), cellH: G.cellH,
    hl: (i, k) => (k >= shownCols ? null : last && k >= last.first && k < last.first + last.count ? wash(colors.highlight, 0.32) : hov != null && st.at[EI[i][k]] === hov ? wash(colors.groupA, 0.22) : null),
  });

  /* the status line and the note */
  const cols = last ? (last.count === 1 ? S.colsOne(last.first) : S.colsTwo(last.first)) : "";
  txt(ctx, colors, n === 0 ? S.graphStart : S.graphStatus(n, st.steps, PROTEINS[last.a], PROTEINS[last.b], dir, cols), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, hov != null ? S.graphHover(PROTEINS[hov], st.index[hov], FEATURES[hov]) : S.graphNote[dir ? "directed" : "undirected"], 12, h - 11, { fill: hov != null ? colors.ink1 : colors.ink3, maxW: w - 24 });
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
    edges: { type: "segmented", label: S.edgesLabel, detail: S.edgesDetail, options: EDGES, default: "undirected", when: ON("graph") },
    order: { type: "segmented", label: S.orderLabel, detail: S.orderDetail, options: ORDERS, default: "abcd", display: true, when: ON("graph") },
    smiles: { type: "segmented", label: S.stringLabel, detail: S.stringDetail, options: STRINGS, default: "first", display: true, when: ON("molecule") },
    /* authoring escape hatch, first render only: presses already taken on the page it opens with */
    shown: { type: "int", min: 0, max: 15, default: 0, hidden: true },
  },

  compute,

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const stage = stageOf(params);
      const anim = { stage, n: { graph: 0, molecule: 0 }, t: 1, moving: false, halt: false };
      anim.n[stage] = fromScratch ? 0 : Math.max(0, Math.min(stepsOf(state, stage), Number(params.shown) || 0));
      anim.done = anim.n[stage] >= stepsOf(state, stage);
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
    },
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    if (params.page === "molecule") drawMolecule(ctx, colors, w, h, state.molecule, anim, pointer);
    else drawGraph(ctx, colors, w, h, state.graph, anim, pointer);
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
    const st = state.graph, n = anim.n.graph, key = st.directed ? "directed" : "undirected";
    return [
      { label: S.tileNodes, value: "4", note: S.tileNodesNote },
      { label: S.tileEdges, value: `${n} of ${st.steps}`, note: S.tileEdgesNote[key] },
      { label: S.tileA, value: S.tileAValue[key], note: S.tileANote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "molecule") return S.sumMol(state.molecule.smiles, anim.n.molecule, state.molecule.steps);
    return S.sumGraph(state.graph.directed, anim.n.graph, state.graph.steps);
  },
});
