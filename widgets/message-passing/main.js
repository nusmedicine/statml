/* ============================================================================
   Widget 95 · Graphs: Message Passing (`message-passing`) — PHM5005 09-1
   cells 22–24 (the GNN layer, Aggregate and Transform; stacking layers;
   readout) and 09-2 cells 39–42 (the lesson's 2-layer GCN, max pooled) and
   62–64 (its 2-layer GAT).

   The misconception (catalogue § Slot 95): a GNN sees the whole molecule,
   and more layers always help. After k layers an atom has gathered from the
   atoms within k bonds, and with depth every atom's vector turns the same
   way (oversmoothing, Li et al. 2018).

   FOUR PAGES IN TWO GROUPS (round 4, 2026-10-09, his picks from
   `_lab/message-passing-structure-mock.html`, asked one by one): the pages
   name their graph, so no control on one page silently changes another's
   (the draft's Step ran Aggregate · Layers · Readout while Example showed on
   Aggregate only, and Layers and Readout switched molecule unannounced).

     BASICS · GRAPH       one layer on his figure's three-node chain
                          (illustrative features; five nodes in round 4, back
                          to three in round 5, "easier to demonstrate").
                          Aggregate sends every node's row along each edge
                          and round its self-loop at once, each sized by the
                          weight its receiver gives it, and every node's row
                          becomes its sum (round 5, his pick A over a focus on
                          node 1 alone and over input/output copies); the
                          weighted edges into the picked node carry an
                          arrowhead into it. Transform drops the sums into one
                          stack H, crosses the one W, passes ELU, and each row
                          rises back to its node. The table is the picked
                          node's close-up. No Layers or Readout here.
     MOLECULE · AGGREGATE caffeine, the same layer at scale: Atom, Layer
                          GCN · GAT, Weights Untrained · Trained (GAT only;
                          an untrained GAT's α is a plain average, measured,
                          so trained is the lesson's GATNet trained on its
                          file, layer 1, the mean of its four heads). Transform
                          runs the picked row across W inside its table.
     MOLECULE · LAYERS    the stack of sheets, caffeine drawn on each, with
                          the cone and a receptive-field cloud on layer 0
                          (after Kipf & Welling 2017, Figure 1), the likeness
                          drawing and the curve under it. Four layers (round
                          6: the stack stopped at three while the curve went
                          on to eight, so presses four to eight changed
                          nothing on the stack and read as dead; at four,
                          atom 9 has gathered from 10 of 14 atoms and the
                          atoms' unlikeness has fallen from 0.82 to 0.12).
     MOLECULE · READOUT   caffeine's atom vectors from the LAYERS PAGE'S OWN
                          network after Layers 1–4 (the lesson's 2 the
                          default; round 5 — the draft pooled a second network
                          after a fixed two, beside Layers' eight), one row of
                          cells an atom (the first 8 of 16 numbers, one scale
                          for every cell, so rows grown alike look alike);
                          Pool collapses them into one row, the vector the
                          classifier reads to predict y; a strip names the
                          pipeline, x → layers → pool → classifier → y.
                          Pooling Sum · Mean · Max, Max the lesson's, framed
                          in the rows it came from. The two acids max cannot
                          tell apart were cut on his call (round 4).

   Earlier rounds the same day: messages on every edge at once (round 1, his
   "less tedious than atom by atom"); slower, bigger (2); Transform through
   one W and Layers as a stack (3, `_lab/message-passing-motion-mock.html`).
   Round 6: Graph's Aggregate lands its rows in an inbox and adds them (his
   "it disappears ... concatenated? summed?"); nodes are opaque, so an edge
   no longer shows through a washed node; every rail control eases (core's
   `anim.easing`): the picked ring slides, values move to their new values.
   Round 7: Graph's Transform is two presses, Multiply by W and Apply ELU,
   the ELU plot the matrix's height and level with it, shown with its press
   (his pick A, `_lab/message-passing-transform-mock.html`); W is labelled
   as learned in training, here its random start; a MathML card above the
   figure gives each page's equation, the part a press reached in
   --c-highlight.

   Nothing trains in the page: compute() runs the layers on seeded weights
   (core's rng, seed 1) and the trained α is data. Presses reveal what
   compute() holds (invariant 2); every control is display, so none resets
   another page's presses.
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import { CAFFEINE, X_MEAN, X_SD, FILE_SPREAD, FILE_N, ALPHA, GAT_RUN } from "./data.js";

const PAGES = [
  { value: "graph", label: "Graph", group: "Basics" },
  { value: "aggregate", label: "Aggregate", group: "Molecule" },
  { value: "layers", label: "Layers", group: "Molecule" },
  { value: "readout", label: "Readout", group: "Molecule" },
];
const LAYERS = [{ value: "gcn", label: "GCN" }, { value: "gat", label: "GAT" }];
const WEIGHTS = [{ value: "untrained", label: "Untrained" }, { value: "trained", label: "Trained" }];
const POOLS = [{ value: "sum", label: "Sum" }, { value: "mean", label: "Mean" }, { value: "max", label: "Max" }];
const ON = (page) => ({ param: "page", equals: page });
const ATOM_OPTS = CAFFEINE.atoms.map((a, i) => ({ value: String(i), label: `${i} · ${a.el}` }));

/* THE BASICS GRAPH: his figure's three-node chain, three illustrative
   features each (round 5: back from five nodes, "easier to demonstrate").
   `at` is a fraction of the width and a y in px. */
const BASIC = {
  atoms: [
    { x: [0.2, 0.8, 0.5], at: [0.17, 180] }, { x: [0.8, 0.4, 0.8], at: [0.5, 180] }, { x: [0.9, 0.2, 0.8], at: [0.83, 180] },
  ].map((a, i) => ({ el: String(i), ...a })),
  bonds: [[0, 1, "SINGLE"], [1, 2, "SINGLE"]],
};
const NODE_OPTS = BASIC.atoms.map((_, i) => ({ value: String(i), label: String(i) }));
const K_MAX = 4, HIDDEN = 16, LESSON_LAYERS = 2, SHOW = 8;
const STEPS = { graph: 3, aggregate: 2, layers: K_MAX, readout: 1 };
const COLS5 = ["Z", "ar", "hyb", "H", "q"];

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A graph neural network layer updates each node from its neighbours and itself: GCN weights the neighbours by their degrees, GAT learns the weights. " +
    "After k layers a node has gathered from every node within k edges, and with more layers the nodes' vectors become alike. A readout pools them into one vector for the graph.",
  pageLabel: "",
  nodeLabel: "Node",
  nodeDetail: "the node whose update the table shows; a click on a node picks it too; the feature values are illustrative",
  atomLabel: "Atom",
  atomDetail: "the atom whose update the table shows; a click on an atom picks it too",
  layerLabel: "Layer",
  layerDetail: "GCN weights each input by 1/√(dᵢ dⱼ), set by the two degrees; GAT weights it by α, a softmax over the inputs that training sets",
  /* round 9: "Weights" read as W too, which every page shows at its random start */
  weightsLabel: "GAT's α",
  weightsDetail: "the attention weights: α at initialisation, or after a 2-layer GAT was trained on 2,335 molecules (layer 1, the mean of its four heads); W stays at its random start",
  fromLabel: "Atom",
  fromDetail: "the atom whose reach is drawn; a click on an atom picks it too",
  poolLabel: "Pooling",
  poolDetail: "how the atoms' vectors become one: the sum, the mean or the largest value of each number; the lesson pools with max",

  stepLabel: {
    param: "page",
    labels: {
      graph: { anim: "beat", labels: { 0: "Aggregate", 1: "Multiply by W", 2: "Apply ELU" }, default: "Apply ELU" },
      aggregate: { anim: "beat", labels: { 0: "Aggregate", 1: "Transform" }, default: "Transform" },
      layers: "Add a layer",
      readout: "Pool",
    },
    default: "Aggregate",
  },
  stepTitle: {
    param: "page",
    labels: {
      graph: { anim: "beat", labels: { 0: "Send every node's row along its edges, weight it and sum", 1: "Multiply every node's sum by the one W", 2: "Pass every number through ELU, the activation" }, default: "Pass every number through ELU, the activation" },
      aggregate: { anim: "beat", labels: { 0: "Send every atom's row along its bonds, weight it and sum", 1: "Multiply the sum by W, then apply the activation" }, default: "Multiply the sum by W, then apply the activation" },
      layers: "Run one more layer on every atom",
      readout: "Pool the atoms' vectors into one",
    },
    default: "Send every node's row along its edges, weight it and sum",
  },

  /* Graph and Aggregate */
  capGraph: "the graph · click a node",
  capMol: "the molecule · click an atom",
  capTable: (u) => `the picked ${u}'s inputs · rows of x`,
  headWeight: { gcn: "1/√(dᵢdⱼ)", gat: "α" },
  selfTag: "self",
  rowSum: "sum",
  rowOut: (i) => `h${i}′`,
  aggStatus: [
    (u, i, d) => `${u} ${i} · ${d} neighbour${d === 1 ? "" : "s"} and itself`,
    (u, i, s) => `${u} ${i} · its inputs weighted and summed · the weights sum to ${s}`,
    (u, i) => `${u} ${i} · the sum × W, then ELU: h${i}′, its vector after one layer`,
  ],
  aggSend: "every node keeps its own row and sends a copy along each of its edges",
  aggWeigh: "each node now holds its inputs, one row each, and a weight for each row",
  aggAdd: "each node adds its weighted rows: one row of 3 numbers, the size of x",
  molMoving: "every atom sends its row along each of its bonds; each arrives scaled by its weight",
  trMoving: { aggregate: "the sum times each column of W, then ELU" },
  mulMoving: "every node's sum into one stack H, then H times each column of W",
  eluMoving: "each number through ELU: a positive one stays, a negative one moves toward −1",
  homeMoving: "each row of h′ back to its node",
  grStatus: [
    (i, d) => `node ${i} · ${d} neighbour${d === 1 ? "" : "s"} and itself`,
    (i, s) => `node ${i} · its inputs weighted and summed · the weights sum to ${s}`,
    (i) => `node ${i} · its sum × W: one row of 3 numbers`,
    (i) => `node ${i} · ELU of its sum × W: h${i}′, its row after one layer`,
  ],
  wLabel: "W",
  wNote: "learned in training · here, its random starting values",
  hLabel: "H",
  hwLabel: "H·W",
  rowOutAll: "h′",
  rowPre: "sum·W",
  eluLabel: "ELU",
  aggNote: {
    graph: "the same sum in any order of the inputs · every node does this at once in a layer",
    gcn: "the weight depends on the two degrees only: a double and a single bond between atoms of the same degrees weigh the same",
    untrained: "untrained, every α is close to 1/(inputs): GAT starts as an average",
    trained: "after training, α weights some inputs more · the lesson's GAT also reads the bond features, which GCN does not",
  },
  aggHover: (i, el, d) => `${el} · atom ${i} · degree ${d} · click to pick`,
  nodeHover: (i, d) => `node ${i} · degree ${d} · click to pick`,

  mathNote: {
    graph: (kind, s) => [
      "one layer: node i's new row hᵢ′ from its neighbours N(i) and itself; hⱼ is node j's row (x before any layer), W a matrix learned in training (here, its random starting values), σ an activation",
      "Aggregate, here GCN's: each input's row times 1/√(dᵢdⱼ), dᵢ the degree counting the self-loop, summed into one row the size of x",
      "Multiply by W: the aggregated row times W, the same W for every node; the figure multiplies rows, H·W, as PyG does",
      "Apply ELU, the σ here: each number v stays if v > 0 and becomes eᵛ − 1 if not; the result is hᵢ′, node i's row after one layer",
    ][s],
    aggregate: (kind, s) => [
      "the same layer on caffeine: hⱼ is atom j's row, W a matrix learned in training (here, its random starting values), σ is ELU",
      kind === "gat"
        ? "Aggregate, here GAT's: each input's row times αᵢⱼ, a softmax over atom i's inputs of a score that training sets, summed into one row"
        : "Aggregate, here GCN's: each input's row times 1/√(dᵢdⱼ), dᵢ the degree counting the self-loop, summed into one row",
      "Transform: the aggregated row times W, then σ, here ELU: hᵢ′, atom i's row after one layer",
    ][s],
    layers: "the layer applied again: layer l + 1 reads layer l's rows, and hᵢ⁽⁰⁾ is xᵢ; each layer has its own W⁽ˡ⁾, learned in training (here, random starting values); Aggregate is GCN's, σ is ELU",
    readout: (pk, k) => `POOL, here ${{ sum: "the sum", mean: "the mean", max: "the largest value" }[pk]} of each number over the atoms' rows after ${k} layer${k === 1 ? "" : "s"}: one vector h<sub>G</sub> for the molecule; MLP is the classifier, ŷ<sub>G</sub> its prediction of y`,
  },

  /* Layers */
  capReach: (n, N) => `gathered from: ${n} of ${N} atoms`,
  capAlike: (i) => `alike to atom ${i}`,
  keyLo: "unrelated",
  keyHi: "same direction",
  curveY: "atoms unlike",
  curveX: "layers",
  curveLesson: "the lesson's 2",
  layMoving: (k) => `layer ${k} · every atom sends its vector to each neighbour`,
  sheet0: "layer 0 · x",
  sheetK: (k) => `layer ${k}`,
  layStatus: (k, i, n, N) => (k === 0 ? `no layer yet · atom ${i} holds only its own row of x` : `after ${k} layer${k === 1 ? "" : "s"} · atom ${i} has gathered from ${n} of ${N} atoms`),
  layNote: "likeness: the cosine of two atoms' vectors · unlike: 1 minus it, averaged over every pair of atoms",
  layHover: (i, el, hop) => `${el} · atom ${i} · ${hop} bond${hop === 1 ? "" : "s"} away · click to pick`,

  /* Readout */
  capRdMol: "caffeine",
  capRows: (k) => `one row an atom · h after ${k} layer${k === 1 ? "" : "s"}`,
  rowsNote: (n) => `the first ${SHOW} of ${n} numbers · one scale for every cell`,
  depthLabel: "Layers",
  depthDetail: "how many layers run before the atoms' vectors are pooled: the same network as the Layers page; the lesson's model runs 2",
  pipeX: "x", pipeLayer: (i) => `layer ${i}`, pipePool: "pool", pipeCls: "classifier", pipeY: "y", pipeGap: "…",
  poolRule: { sum: "Pool: the sum of each column", mean: "Pool: the mean of each column", max: "Pool: the largest of each column" },
  pooledName: { sum: "sum", mean: "mean", max: "max" },
  oneVector: "one vector for the molecule, whatever its size",
  classifier: "classifier",
  rdStatus: ["each atom a vector · Pool turns the 14 into one", "pooled · the one vector the classifier reads"],
  rdMoving: "each column pooled into one number",
  rdNote: (y) => `caffeine's label in the lesson's file: y = ${y}, it did not stop E. coli growing · the lesson trains W and the classifier together`,
  rdHover: (i, el) => `${el} · atom ${i} · its row`,

  /* tiles */
  tileInputs: "Inputs",
  tileInputsNote: (d) => `its ${d} neighbour${d === 1 ? "" : "s"} and itself: GCNConv and GATConv add a self-loop to every node`,
  tileSum: "Weights sum to",
  tileSumNote: { gcn: "1/√(dᵢ dⱼ) sums to 1 only when every input has the node's own degree", gat: "a softmax over the inputs, so α sums to 1" },
  tileTop: "Largest weight",
  tileTopNote: {
    gcn: "GCN favours the input with the fewest neighbours",
    untrained: "untrained: the largest α is close to the others",
    trained: (agree) => `learned on the lesson's file; two more training runs give the same top input for ${agree} of caffeine's 14 atoms`,
  },
  tileLayers: "Layers",
  tileLayersNote: "the lesson's GCN and GAT stack 2",
  tileReach: "Gathered from",
  tileReachNote: (d) => `the atoms within k bonds; caffeine's longest shortest path is ${d} bonds`,
  tileUnlike: "Atoms unlike",
  tileUnlikeNote: (v0) => `the mean cosine distance between atoms: ${v0} before any layer, 0 when every vector points the same way`,
  tileRows: "Atom vectors",
  tileRowsNote: (n, d, k, u) => `${n} rows of ${d} numbers, one an atom, after ${k} layer${k === 1 ? "" : "s"}; how unlike they are: ${u}`,
  tilePooled: "Pooled vector",
  tilePooledNote: {
    sum: "adds the rows: a molecule with more atoms gives larger numbers",
    mean: "averages the rows: the number of atoms drops out",
    max: "keeps the largest value of each number: which atom it came from drops out",
  },
  tileY: "y",
  tileYNote: "caffeine's label in the lesson's file; the classifier is trained to predict it from the pooled vector",
  tileWait: "—",

  sumGraph: (i, beat) => `a three-node chain, node ${i}'s inputs${beat >= 1 ? ", weighted and summed" : ""}${beat >= 2 ? ", then multiplied by W" : ""}${beat >= 3 ? ", then passed through ELU" : ""}`,
  sumAgg: (i, beat) => `caffeine, atom ${i}'s inputs${beat >= 1 ? ", weighted and summed" : ""}${beat >= 2 ? ", then multiplied by W and passed through ELU" : ""}`,
  sumLay: (k, i, n) => `caffeine after ${k} layer${k === 1 ? "" : "s"}: atom ${i} has gathered from ${n} of 14 atoms, and the atoms' vectors grow alike`,
  sumRd: (pooled, kind, k) => (pooled ? `caffeine's 14 atom vectors after ${k} layer${k === 1 ? "" : "s"}, ${kind}-pooled into one vector` : `caffeine's 14 atom vectors after ${k} layer${k === 1 ? "" : "s"}, one row an atom`),
};

/* ------------------------------------------------------ drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
/* A VALUE IS GREY (round 4): every vector, W and the likeness run from
   --surface-3 to --ink-2, so colour on these pages only ever means a role —
   the picked node (--c-highlight), its neighbours (--c-group-a). The draft
   shaded them --c-magnitude, which shares --c-highlight's slot and must not
   meet it on a page (tokens.css): the arrows into the picked node and the
   cells they carried were one violet, and the max frames on Readout vanished
   into the cells they framed. --c-value-low/high would not do either: its
   blue end is --c-group-a's, and its panels take no identity colour. */
const ramp = (colors, t) => { const a = rgb(colors.surface3), b = rgb(colors.ink2); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };

/* a caption longer than its panel drops trailing clauses until it fits, as 94 does */
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
function ring(ctx, x, y, r, colour) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
}
function polyline(ctx, xs, ys, colour, width = 1.6, dash = null) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineJoin = "round"; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i]))); ctx.stroke(); ctx.restore();
}
/** the hover label: a small box beside (x, y), turned to the left near the right edge */
function hoverLabel(ctx, colors, str, x, y, w) {
  ctx.save(); ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  const tw = ctx.measureText(str).width, left = x + 14 + tw + 10 > w - 4;
  const bx = left ? x - 14 - tw - 10 : x + 14, by = y - 26;
  ctx.restore();
  rect(ctx, bx, by, tw + 10, 18, colors.surface, colors.ink3);
  txt(ctx, colors, str, bx + 5, by + 9.5, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, baseline: "middle" });
}
/** a node: a filled circle with its name in the middle. Opaque under its
    wash (round 6, his screenshot): a washed node let the edge under it show
    through, and read as an edge running into the node. */
function node(ctx, colors, x, y, r, name, { fill = null, stroke = null, lw = 1.4, ink = null } = {}) {
  dot(ctx, x, y, r, colors.surface);
  dot(ctx, x, y, r, fill ?? colors.surface, stroke ?? colors.ink1, lw);
  txt(ctx, colors, name, x, y + 0.5, { font: nodeFont(colors), fill: ink ?? colors.ink1, align: "center", baseline: "middle" });
}
function bond(ctx, p, q, type, colour, width) {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * 2.6, ny = (dx / L) * 2.6;
  if (type === "DOUBLE") { line(ctx, p[0] + nx, p[1] + ny, q[0] + nx, q[1] + ny, colour, width); line(ctx, p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, colour, width); }
  else if (type === "AROMATIC") { line(ctx, p[0] + nx, p[1] + ny, q[0] + nx, q[1] + ny, colour, width); line(ctx, p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, colour, width, [3, 2.5]); }
  else line(ctx, p[0], p[1], q[0], q[1], colour, width);
}
/** a molecule's drawing fitted into a box; `scale` caps the bond length */
function molPoints(mol, x0, y0, w, h, scale = 64) {
  const xs = mol.atoms.map((a) => a.xy[0]), ys = mol.atoms.map((a) => a.xy[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min(w / Math.max(maxx - minx, 1e-6), h / Math.max(maxy - miny, 1e-6), scale);
  const ox = x0 + (w - (maxx - minx) * s) / 2, oy = y0 + (h - (maxy - miny) * s) / 2;
  return mol.atoms.map((a) => [ox + (a.xy[0] - minx) * s, oy + (a.xy[1] - miny) * s]);
}
const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d));

/* ============================================================== compute */

function adjacency(mol) {
  const n = mol.atoms.length, A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [i, j] of mol.bonds) { A[i][j] = 1; A[j][i] = 1; }
  return A;
}
/** D^-1/2 (A + I) D^-1/2, what GCNConv propagates with */
function gcnP(A) {
  const d = A.map((r) => r.reduce((s, v) => s + v, 0) + 1);
  return A.map((r, i) => r.map((v, j) => (v || i === j ? 1 / Math.sqrt(d[i] * d[j]) : 0)));
}
const matmul = (X, W) => X.map((r) => W[0].map((_, k) => r.reduce((s, v, q) => s + v * W[q][k], 0)));
const elu = (H) => H.map((r) => r.map((v) => (v > 0 ? v : Math.expm1(v))));
/** glorot uniform, as PyG initialises a layer's W */
function glorot(rng, fin, fout) {
  const b = Math.sqrt(6 / (fin + fout));
  return Array.from({ length: fin }, () => Array.from({ length: fout }, () => rng.uniform(-b, b)));
}
function cosine(a, b) {
  let s = 0, na = 0, nb = 0;
  for (let k = 0; k < a.length; k++) { s += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; }
  return s / (Math.sqrt(na * nb) + 1e-12);
}
function spread(H) {
  let s = 0, c = 0;
  for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) { s += 1 - cosine(H[i], H[j]); c += 1; }
  return s / c;
}
function hopsFrom(A, s) {
  const n = A.length, D = new Array(n).fill(Infinity); D[s] = 0;
  let front = [s], k = 0;
  while (front.length) { k += 1; const next = []; for (const u of front) for (let v = 0; v < n; v++) if (A[u][v] && D[v] === Infinity) { D[v] = k; next.push(v); } front = next; }
  return D;
}
/** layers of GCN + ELU from H, one W each, drawn in order from `Ws` */
function stack(P, H, Ws) {
  const out = [H];
  for (const W of Ws) { H = elu(matmul(P, matmul(H, W))); out.push(H); }
  return out;
}

/* ONE NODE'S UPDATE: its inputs (itself first, then its neighbours in
   number order), each one's weight, the weighted sum, h·W and h′. GAT's α
   comes from data.js, indexed by where each input came from. */
function aggregateOf(mol, i, kind, weights, P, W) {
  const A = adjacency(mol);
  const nbrs = A[i].map((v, j) => (v ? j : -1)).filter((j) => j >= 0);
  const inputs = [i, ...nbrs];
  let w;
  if (kind === "gat") {
    const t = ALPHA[weights][i];
    w = inputs.map((j) => t.alpha[t.from.indexOf(j)]);
  } else w = inputs.map((j) => P[i][j]);
  const cols = mol.atoms[0].x.length;
  const sum = [...Array(cols).keys()].map((c) => inputs.reduce((s, j, k) => s + w[k] * mol.atoms[j].x[c], 0));
  const pre = W[0].map((_, k) => sum.reduce((s, v, q) => s + v * W[q][k], 0));
  const out = elu([pre])[0];
  return { i, inputs, w, sum, pre, out, deg: nbrs.length };
}
function pool(H, kind) {
  return H[0].map((_, k) => {
    const c = H.map((r) => r[k]);
    return kind === "max" ? Math.max(...c) : kind === "sum" ? c.reduce((s, v) => s + v, 0) : c.reduce((s, v) => s + v, 0) / c.length;
  });
}
/** one layer on every node of `mol`: each node's update, the messages, one colour scale */
function layerOn(mol, pick, kind, weights, W) {
  const P = gcnP(adjacency(mol));
  /* EVERY node's update, since a layer updates all of them at once (round 1:
     his "aggregation of everything"); the picked one is the close-up */
  const all = mol.atoms.map((_, i) => aggregateOf(mol, i, kind, weights, P, W));
  /* the messages: one along each edge each way, weighted as its receiver weighs it */
  const msgs = all.flatMap((u) => u.inputs.slice(1).map((s, k) => ({ s, r: u.i, w: u.w[k + 1] })));
  /* one colour scale for every row the page draws: x, the sums, h·W, h′ —
     so a row keeps its colours as it travels and lands */
  const vals = [...mol.atoms.map((a) => a.x), ...all.flatMap((u) => [u.sum, u.pre, u.out])].flat();
  return { all, agg: all[pick], msgs, W, scale: [Math.min(0, ...vals), Math.max(1, ...vals)] };
}

function compute({ params, rng }) {
  /* the weights, drawn in one fixed order whatever the parameters, so a
     control never changes a number it does not concern */
  const Wbasic = glorot(rng, 3, 3), Wcaf = glorot(rng, 5, 5);
  const Wlay = [...Array(K_MAX).keys()].map((k) => glorot(rng, k === 0 ? 5 : HIDDEN, HIDDEN));

  /* Basics and Aggregate: one layer each */
  const g = layerOn(BASIC, Number(params.node), "gcn", "untrained", Wbasic);
  const c = layerOn(CAFFEINE, Number(params.atom), params.layer, params.weights, Wcaf);

  /* Layers: the five columns standardised with the file's statistics */
  const cafA = adjacency(CAFFEINE), cafP = gcnP(cafA);
  const X = CAFFEINE.atoms.map((a) => a.x.map((v, k) => (v - X_MEAN[k]) / (X_SD[k] || 1)));
  const H = stack(cafP, X, Wlay);
  const from = Number(params.from);
  const hops = hopsFrom(cafA, from);
  const likeness = H.map((Hk) => Hk.map((h) => cosine(h, Hk[from])));
  const unlike = H.map(spread);
  const diameter = Math.max(...CAFFEINE.atoms.map((_, s) => Math.max(...hopsFrom(cafA, s))));
  const nbrs = cafA.map((r) => r.map((v, j) => (v ? j : -1)).filter((j) => j >= 0));
  const layMsgs = cafA.flatMap((row, r) => row.map((v, s) => (v ? { s, r, w: cafP[r][s] } : null)).filter(Boolean));

  /* Readout: THE LAYERS PAGE'S OWN VECTORS after `depth` layers (round 5: the
     draft pooled a second network after a fixed two, beside a Layers page that
     ran to eight on another — two answers to "which vectors"). One colour scale
     for every cell (his pick), so rows that have grown alike look alike. */
  const depth = Number(params.depth), rows = H[depth];
  const pooled = Object.fromEntries(POOLS.map(({ value }) => [value, pool(rows, value)]));
  const all = rows.flat(), lo = Math.min(...all), hi = Math.max(...all);
  const colHi = rows[0].map((_, k) => Math.max(...rows.map((r) => r[k])));
  const argmax = rows[0].map((_, k) => rows.findIndex((r) => r[k] === colHi[k]));
  const rd = { depth, rows, pooled, lo, hi, argmax, unlike: unlike[depth] };

  return { g, c, H, hops, likeness, unlike, diameter, nbrs, layMsgs, rd, agreeTop: GAT_RUN.agree };
}

/* ============================================================ animation */

/* THE MOTION: a press that runs a layer sends a message along every edge,
   both ways at once, each way in its own lane so no two cross (round 1); it
   lands and the figure switches to the new state at once (no fades).
   Transform moves the rows through W (round 3); a layer on the stack has
   three phases; Pool drops each column's result into the pooled row. */
const MOVE_MS = 1700;   /* slowed on his word, round 2 */
/* A RAIL CONTROL EASES (round 6, his "tween when responding to rail
   controls"): every control is display, so rebuild keeps the reading it
   leaves and asks core for frames; draw moves what can move — the picked
   ring slides to its new node, a value goes to its new value — and switches
   the rest at once (tween-only-movement). */
const EASE_MS = 700;
const TWEENED = ["node", "atom", "layer", "weights", "from", "depth", "pooling"];
/** the reading a rail change left, while the ease runs; null when settled */
const ezFrom = (anim) => (anim?.ez && anim.ez.t < 1 ? anim.ez : null);
/** how far that ease has gone, eased; 1 when settled */
const ezP = (anim) => (ezFrom(anim) ? ease(anim.ez.t) : 1);
const lerpArr = (a, b, t) => b.map((v, k) => a[k] + (v - a[k]) * t);
const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const stepsOf = (stage) => STEPS[stage] ?? 0;
function durOf(stage, beat) {
  if (stage === "graph") return [0, 5200, 4200, 6000][beat];
  if (stage === "aggregate") return beat === 1 ? MOVE_MS : 3600;
  if (stage === "layers") return 2600;
  return 1600;
}
/** the raw progress of the press in flight, for animations with phases; null when settled */
const phase = (anim, stage) => (anim.stage === stage && anim.t < 1 ? anim.t : null);
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
/** the settled beat: while a press is in flight, the state before it */
const shownStep = (anim, stage) => (anim.n[stage] ?? 0) - (anim.stage === stage && anim.t < 1 ? 1 : 0);
/** how far the messages in flight have gone, eased; null when nothing moves */
const flight = (anim, stage) => (anim.stage === stage && anim.t < 1 ? ease(anim.t) : null);

/* ONE MESSAGE MOVER. Straight edges: the message rides a lane to one side of
   the edge, the side set by its direction, from the sender's rim to the
   receiver's. `mark` draws it; the default is a dot sized by the weight.
   The offset is to the mover's own side (round 6: it flipped with the
   direction as well as the normal did, so both ways shared one lane). */
function drawMessages(ctx, colors, P, msgs, u, { r = 11, pick = null, mark = null, lane = 4 } = {}) {
  for (const m of msgs) {
    const [ax, ay] = P[m.s], [bx, by] = P[m.r], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy * lane, ny = ux * lane;
    const x0 = ax + ux * r, y0 = ay + uy * r, x1 = bx - ux * r, y1 = by - uy * r;
    const x = x0 + (x1 - x0) * u + nx, y = y0 + (y1 - y0) * u + ny;
    if (mark) mark(x, y, m);
    else dot(ctx, x, y, 2 + 7 * m.w, m.r === pick ? colors.highlight : colors.groupA, colors.surface, 1);
  }
}
function arrowHead(ctx, x, y, ang, colour, s = 9) {
  ctx.save(); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x - s * Math.cos(ang - 0.42), y - s * Math.sin(ang - 0.42)); ctx.lineTo(x - s * Math.cos(ang + 0.42), y - s * Math.sin(ang + 0.42));
  ctx.closePath(); ctx.fill(); ctx.restore();
}
/* AN EDGE INTO THE PICKED NODE, after Aggregate (round 4, his red arrows):
   as wide as its weight, an arrowhead at the receiver's rim, the weight above
   the edge nearer the sender. `label` false on caffeine, whose bonds are too
   short for one; its weights are in the table. */
function edgeInto(ctx, colors, from, to, wgt, rTo, { label = true, head = 11 } = {}) {
  const [ax, ay] = from, [bx, by] = to, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  line(ctx, ax + ux * rTo, ay + uy * rTo, bx - ux * (rTo + head - 2), by - uy * (rTo + head - 2), colors.highlight, 1 + 12 * wgt);
  arrowHead(ctx, bx - ux * rTo, by - uy * rTo, Math.atan2(uy, ux), colors.highlight, head);
  if (!label) return;
  const cx = ax + (bx - ax) * 0.42, cy = ay + (by - ay) * 0.42, pA = [cx - uy * 16, cy + ux * 16], pB = [cx + uy * 16, cy - ux * 16];
  const [lx, ly] = pA[1] < pB[1] ? pA : pB;
  txt(ctx, colors, fmt(wgt), lx, ly + 4, { font: boldMono(colors), fill: colors.ink1, align: "center", halo: true });
}

/* ------------------------------------------------ Transform's pieces */

/** a row of cells on the page's one scale */
function cellRow(ctx, colors, x, y, row, c, scale, { stroke = null, lw = 1, ch = c } = {}) {
  row.forEach((v, k) => rect(ctx, x + k * c, y, c, ch, ramp(colors, (v - scale[0]) / (scale[1] - scale[0])), stroke ?? colors.ink1, lw));
}
/* THE GRAPH'S TRANSFORM, TWO PRESSES (round 7, his pick A from
   `_lab/message-passing-transform-mock.html`: one press did both, too fast,
   and the ELU box floated beside W with nothing passing through it). The
   band under the drawing holds H, W, H·W, the ELU plot and h′, every block
   the matrix's height, the plot level with W (his "same height and align
   with the matrix").
   Multiply by W: the sums drop from their nodes into one stack H, one node
   after another (0–0.25); W's columns light one at a time while H·W fills a
   column at a time (0.3–0.95).
   Apply ELU: the plot appears with its press. Each number of H·W leaves its
   row at the row's right end, so it crosses no cell, and drops to its place
   on the plot's axis (0–0.22); it climbs or falls to the curve, a dashed
   guide behind it (0.24–0.5); it crosses to its cell of h′ (0.52–0.72).
   The rows of h′ then rise back to their nodes one at a time, the last
   first (0.76–1): moving together, their paths crossed
   (tweens-move-in-lanes). The plot spans −1.1 to 1.1 on both axes, which
   holds every number of H·W the chain makes (−0.32 to 0.88). */
const BAND_Y = 292, ELU_SPAN = 1.1;
function band(w) {
  const c = Math.max(12, Math.min(28, Math.floor((w - 164) / 17.3))), cW = Math.round(c * 1.43);
  const hx = 24, wX = hx + 3 * c + 34, oX = wX + 3 * cW + 34, pX = oX + 3 * c + 30, finX = w - 12 - 3 * c;
  return { c, cW, hx, wX, oX, pX, pW: finX - 30 - pX, finX, hy: BAND_Y, h: 3 * c };
}
function eluMap(b) {
  const u = (v) => (Math.max(-ELU_SPAN, Math.min(ELU_SPAN, v)) + ELU_SPAN) / (2 * ELU_SPAN);
  return { sx: (v) => b.pX + u(v) * b.pW, sy: (v) => b.hy + b.h - u(v) * b.h };
}
/** the ELU plot: its curve, the axes, the −1 it flattens toward */
function drawEluPlot(ctx, colors, b) {
  const { sx, sy } = eluMap(b), S1 = ELU_SPAN;
  rect(ctx, b.pX, b.hy, b.pW, b.h, colors.surface2, colors.grid);
  line(ctx, sx(-S1), sy(0), sx(S1), sy(0), colors.axis); line(ctx, sx(0), sy(-S1), sx(0), sy(S1), colors.axis);
  line(ctx, sx(-S1), sy(-1), sx(S1), sy(-1), colors.grid, 1, [3, 3]);
  txt(ctx, colors, "−1", sx(-S1) + 3, sy(-1) - 3, { font: monoFont(colors), fill: colors.ink3 });
  const xs = [...Array(41).keys()].map((q) => -S1 + (2 * S1 * q) / 40);
  polyline(ctx, xs.map(sx), xs.map((v) => sy(v > 0 ? v : Math.expm1(v))), colors.ink2, 1.6);
  txt(ctx, colors, S.eluLabel, b.pX, b.hy - 8, { fill: colors.ink3 });
}
/* `tm` is Multiply by W in flight, `ta` Apply ELU; `beat` the settled press count */
function drawBand(ctx, colors, w, g, P, beat, tm, ta) {
  const b = band(w), W = g.W, sc = g.scale, c = b.c, hy = b.hy, n = g.all.length;
  const showH = tm != null || (beat === 2 && ta == null) || (ta != null && ta < 0.76);
  const col = tm != null && tm > 0.3 && tm < 0.95 ? Math.min(2, Math.floor(seg(tm, 0.3, 0.95) * 3)) : -1;
  /* W, and where it comes from */
  txt(ctx, colors, S.wLabel, b.wX, hy - 8, { fill: colors.ink3 });
  W.forEach((r, i) => r.forEach((v, k) => {
    rect(ctx, b.wX + k * b.cW, hy + i * c, b.cW, c, k === col ? wash(colors.highlight, 0.3) : colors.surface2, colors.grid);
    if (b.cW >= 30) txt(ctx, colors, fmt(v), b.wX + k * b.cW + b.cW / 2, hy + i * c + c / 2 + 0.5, { font: monoFont(colors), fill: k === col ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  }));
  txt(ctx, colors, S.wNote, b.wX, hy + b.h + 14, { fill: colors.ink3, maxW: w - b.wX - 12 });
  if (ta != null || beat >= 3) drawEluPlot(ctx, colors, b);
  if (showH) {
    txt(ctx, colors, S.hLabel, b.hx, hy - 8, { fill: colors.ink3 });
    txt(ctx, colors, S.hwLabel, b.oX, hy - 8, { fill: colors.ink3 });
    txt(ctx, colors, "×", b.wX - 17, hy + b.h / 2 + 5, { font: capFont(colors), fill: colors.ink2, align: "center" });
    txt(ctx, colors, "=", b.oX - 17, hy + b.h / 2 + 5, { font: capFont(colors), fill: colors.ink2, align: "center" });
    const done = tm == null || tm >= 0.95 ? 3 : Math.min(3, Math.floor(seg(tm, 0.3, 0.95) * 3 + 1e-9));
    for (let i = 0; i < n; i++) {
      const u = g.all[i], ty = hy + i * c;
      if (tm != null && tm < 0.25) {
        const q = ease(seg(tm, (0.22 * i) / n, (0.22 * (i + 1)) / n)), [sx, sy] = slotOf(P, i);
        cellRow(ctx, colors, lerp(sx, b.hx, q), lerp(sy, ty, q), u.sum, lerp(SLOT_C, c, q), sc);
        continue;
      }
      cellRow(ctx, colors, b.hx, ty, u.sum, c, sc, { stroke: colors.grid });
      u.pre.forEach((v, k) => rect(ctx, b.oX + k * c, ty, c, c, k < done ? ramp(colors, (v - sc[0]) / (sc[1] - sc[0])) : null, colors.grid));
    }
  }
  if (ta == null) return;
  /* Apply ELU: each number to the axis, to the curve, to h′; then the rows home */
  const { sx, sy } = eluMap(b);
  if (ta < 0.76) {
    txt(ctx, colors, S.rowOutAll, b.finX, hy - 8, { fill: colors.ink3 });
    g.all.forEach((u, i) => u.pre.forEach((v, k) => {
      const y = u.out[k], ex = b.oX + 3 * c + 6, ey = hy + i * c + c / 2;
      if (ta >= 0.24) line(ctx, sx(v), sy(0), sx(v), ta < 0.5 ? lerp(sy(0), sy(y), ease(seg(ta, 0.24, 0.5))) : sy(y), colors.ink3, 1, [2, 2]);
      let X, Y;
      if (ta < 0.24) { const q = ease(seg(ta, 0.02, 0.22)); X = lerp(ex, sx(v), q); Y = lerp(ey, sy(0), q); }
      else if (ta < 0.52) { X = sx(v); Y = lerp(sy(0), sy(y), ease(seg(ta, 0.24, 0.5))); }
      else if (ta < 0.72) { const q = ease(seg(ta, 0.52, 0.72)); X = lerp(sx(v), b.finX + k * c + c / 2, q); Y = lerp(sy(y), hy + i * c + c / 2, q); }
      else { rect(ctx, b.finX + k * c, hy + i * c, c, c, ramp(colors, (y - sc[0]) / (sc[1] - sc[0])), colors.grid); return; }
      dot(ctx, X, Y, 3.5, colors.ink1, colors.surface, 1);
    }));
    return;
  }
  for (let i = 0; i < n; i++) {
    const u = g.all[i], [sx0, sy0] = slotOf(P, i), span = 0.24 / n;
    const q = ease(seg(ta, 0.76 + (n - 1 - i) * span, 0.76 + (n - i) * span));
    cellRow(ctx, colors, lerp(b.finX, sx0, q), lerp(hy + i * c, sy0, q), u.out, lerp(c, SLOT_C, q), sc, { stroke: i === g.agg.i ? colors.highlight : null, lw: i === g.agg.i ? 1.6 : 1 });
  }
}

const SLOT_C = 22;
const slotOf = (P, i) => [P[i][0] - 1.5 * SLOT_C, P[i][1] - 62];

/* CAFFEINE'S TRANSFORM: the picked atom's row only (14 rows do not fit a
   stack), inside its table. W sits under the sum row, one column of W under
   each column of the table; a press lights W's columns in turn and fills h·W
   a cell at a time (0–0.6), then the row moves down past the ELU gate into
   the h′ row (0.62–1). */
function drawCafTransform(ctx, colors, c, geo, t, beat) {
  const a = c.agg, W = c.W, sc = c.scale, cols = W.length;
  const wy = geo.yS + 30, rh = 11, preY = wy + cols * rh + 8, outY = preY + 40;
  const col = t != null && t < 0.6 ? Math.min(cols - 1, Math.floor(seg(t, 0, 0.6) * cols)) : -1;
  const wvals = W.flat(), wlo = Math.min(...wvals), whi = Math.max(...wvals);
  txt(ctx, colors, "W", geo.x0, wy + (cols * rh) / 2 + 3, { font: boldMono(colors), fill: colors.ink3 });
  W.forEach((r, q) => r.forEach((v, k) => rect(ctx, geo.colX(k) + 1, wy + q * rh, geo.cw - 2, rh, k === col ? wash(colors.highlight, 0.45) : ramp(colors, (v - wlo) / (whi - wlo)), colors.grid)));
  txt(ctx, colors, S.eluLabel, geo.x0, (preY + outY) / 2 + 12, { fill: colors.ink3 });
  if (t != null && beat === 1) {
    const done = Math.min(cols, Math.floor(seg(t, 0, 0.6) * cols + 1e-9));
    const m = ease(seg(t, 0.62, 1)), y = lerp(preY, outY, m), row = m < 0.5 ? a.pre : a.out;
    row.forEach((v, k) => { if (t >= 0.6 || k < done) rect(ctx, geo.colX(k) + 1, y, geo.cw - 2, 16, ramp(colors, (v - sc[0]) / (sc[1] - sc[0])), colors.highlight, 1.4); });
    return;
  }
  /* h′ stays a row of cells once it lands, its numbers on them (round 9, his
     "h′ should have a heatmap also": the cells the press moved vanished at
     the end and left bare numbers); the number's ink flips on the darker
     half of the ramp, which is the light half in the dark theme */
  if (beat >= 2) {
    txt(ctx, colors, S.rowOut(a.i), geo.x0, outY + 9, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    a.out.forEach((v, k) => {
      const u = (v - sc[0]) / (sc[1] - sc[0]);
      rect(ctx, geo.colX(k) + 1, outY, geo.cw - 2, 18, ramp(colors, u), colors.grid);
      txt(ctx, colors, fmt(v, 1), geo.colX(k) + geo.cw / 2, outY + 9.5, { font: boldMono(colors), fill: u > 0.55 ? colors.surface : colors.ink1, align: "center", baseline: "middle" });
    });
  }
}

/* THE PICKED NODE'S TABLE: its inputs' rows of x, their weights, the sum;
   on the graph also h′ (caffeine draws its h′ under W) */
const ROW_H = 24;
function drawInputTable(ctx, colors, w, { x0, ty, mol, a, kind, beat, graph }) {
  const cols = mol.atoms[0].x.length, labW = 58;
  const cw = Math.min(graph ? 44 : 34, (w - x0 - labW - 70 - 8) / cols), wx = x0 + labW + cols * cw + 8;
  const right = graph ? wx + 64 : w - 4, colX = (k) => x0 + labW + k * cw;
  txt(ctx, colors, S.capTable(graph ? "node" : "atom"), x0, ty + 16, { font: capFont(colors), fill: colors.ink1, maxW: w - x0 - 8 });
  (graph ? ["0", "1", "2"] : COLS5).forEach((hd, k) => txt(ctx, colors, hd, colX(k) + cw / 2, ty + 40, { font: monoFont(colors), fill: colors.ink3, align: "center" }));
  txt(ctx, colors, S.headWeight[kind], wx + 30, ty + 40, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  a.inputs.forEach((j, k) => {
    const y = ty + 48 + k * ROW_H, mid = y + ROW_H / 2;
    rect(ctx, x0 - 4, y + 1, right - x0, ROW_H - 2, j === a.i ? wash(colors.highlight, 0.14) : wash(colors.groupA, 0.12));
    txt(ctx, colors, `${j}${graph ? "" : " " + mol.atoms[j].el}${j === a.i ? " " + S.selfTag : ""}`, x0, mid, { font: monoFont(colors), fill: colors.ink1, baseline: "middle" });
    mol.atoms[j].x.forEach((v, c) => txt(ctx, colors, graph ? v.toFixed(1) : String(v), colX(c) + cw / 2, mid, { font: monoFont(colors), fill: colors.ink2, align: "center", baseline: "middle" }));
    if (beat >= 1) txt(ctx, colors, `× ${fmt(a.w[k])}`, wx + 30, mid, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  });
  const yS = ty + 48 + a.inputs.length * ROW_H + 4;
  if (beat >= 1) {
    line(ctx, x0 - 4, yS, right - 4, yS, colors.ink2);
    txt(ctx, colors, S.rowSum, x0, yS + 14, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    a.sum.forEach((v, c) => txt(ctx, colors, fmt(v, graph ? 2 : 1), colX(c) + cw / 2, yS + 14, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" }));
  }
  if (graph) [[2, S.rowPre, a.pre], [3, S.rowOut(a.i), a.out]].forEach(([at, name, row], q) => {
    if (beat < at) return;
    txt(ctx, colors, name, x0, yS + 38 + 24 * q, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    row.forEach((v, c) => txt(ctx, colors, fmt(v, 2), colX(c) + cw / 2, yS + 38 + 24 * q, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" }));
  });
  return { yS, cw, colX, x0 };
}

/* ============================================================ geometry */

const H_GRAPH = 652, H_CAF = 344, H_LAY = 630, H_RD = 456;
const leftW = (w) => Math.min(w * 0.47, 330);
const basicPoints = (w) => BASIC.atoms.map((a) => [a.at[0] * w, a.at[1]]);
const cafPoints = (w) => molPoints(CAFFEINE, 16, 42, leftW(w) - 28, 250);
const NODE_R = 18, LOOP = { dy: 31, r: 12 };

/* ------------------------------------------------------ the formula card */
/* THE EQUATION OF WHAT THE PAGE BUILDS (round 7, his "include the mathml
   formula for the aggregation and W and activation function so we can see
   what we are trying to achieve"): MathML above the figure, as limma's and
   deseq2's. On Graph and Aggregate the part the last press did (or the one
   in flight) is in --c-highlight, so the equation marks the step reached.
   Symbols only; the numbers are in the figure.
   Round 8, his "use the more generic formula like sigma(W. aggregate...)":
   the lesson's own forms, word for word — 09-1 cell 23's layer, 09-2 cell
   18's layer index, 09-1 cell 24's POOL and MLP. What Aggregate and σ are
   here (GCN's or GAT's weights, ELU) goes in the note under it. The layer
   is written W · Aggregate, as the lesson writes it; the figure multiplies
   rows, H·W, as PyG does — the note at Multiply by W says so. */
const MATHML = mathmlRenders();
const HL = (on, s) => (on ? `<mrow style="color:var(--c-highlight)">${s}</mrow>` : s);
const SUP_L = (v, sub, l) => `<msubsup><mi>${v}</mi>${sub}<mrow><mo>(</mo>${l}<mo>)</mo></mrow></msubsup>`;
const SIGMA = "<mi>σ</mi>", AGG = `<mtext>Aggregate</mtext>`;
/** σ( W · Aggregate( {h_j : j ∈ N(i)} ∪ {h_i} ) ), the parts `on` holds marked; `l` a layer index or null */
function layerMath(on, l = null) {
  const h = (s) => (l ? SUP_L("h", s, l) : `<msub><mi>h</mi>${s}</msub>`);
  const lhs = l ? SUP_L("h", "<mi>i</mi>", `<mi>l</mi><mo>+</mo><mn>1</mn>`) : `<msubsup><mi>h</mi><mi>i</mi><mo>′</mo></msubsup>`;
  const W = l ? `<msup><mi>W</mi><mrow><mo>(</mo>${l}<mo>)</mo></mrow></msup>` : "<mi>W</mi>";
  const set = `<mo>{</mo>${h("<mi>j</mi>")}<mo>:</mo><mi>j</mi><mo>∈</mo><mi>N</mi><mo>(</mo><mi>i</mi><mo>)</mo><mo>}</mo><mo>∪</mo><mo>{</mo>${h("<mi>i</mi>")}<mo>}</mo>`;
  return `<math display="block"><mrow>${lhs}<mo>=</mo>${HL(on.has("act"), SIGMA)}<mrow><mo>(</mo>${HL(on.has("W"), `${W}<mo>·</mo>`)}${HL(on.has("agg"), `${AGG}<mrow><mo>(</mo>${set}<mo>)</mo></mrow>`)}<mo>)</mo></mrow></mrow></math>`;
}
const LAYER_PLAIN = "hᵢ′ = σ( W · Aggregate( {hⱼ : j ∈ N(i)} ∪ {hᵢ} ) )";
function formulaFor(params, anim) {
  const page = params.page;
  if (page === "graph" || page === "aggregate") {
    const kind = page === "graph" ? "gcn" : params.layer;
    const inFlight = anim && anim.stage === page && anim.t < 1;
    const s = anim ? (inFlight ? anim.n[page] : shownStep(anim, page)) : 0;
    /* Graph: Aggregate · Multiply by W · Apply ELU; Aggregate (caffeine): Aggregate · Transform */
    const parts = page === "graph" ? [[], ["agg"], ["W"], ["act"]][s] : [[], ["agg"], ["W", "act"]][s];
    return { key: `${page}-${kind}-${s}`, math: layerMath(new Set(parts)), plain: LAYER_PLAIN, note: S.mathNote[page](kind, s) };
  }
  if (page === "layers") {
    return { key: "layers", math: layerMath(new Set(), "<mi>l</mi>"), plain: "hᵢ⁽ˡ⁺¹⁾ = σ( W⁽ˡ⁾ · Aggregate( {hⱼ⁽ˡ⁾ : j ∈ N(i)} ∪ {hᵢ⁽ˡ⁾} ) )", note: S.mathNote.layers };
  }
  const k = Number(params.depth), pk = params.pooling, hG = "<msub><mi>h</mi><mi>G</mi></msub>";
  const math = `<math display="block"><mrow>${hG}<mo>=</mo><mtext>POOL</mtext><mrow><mo>(</mo><mo>{</mo>${SUP_L("h", "<mi>i</mi>", `<mn>${k}</mn>`)}<mo>|</mo><mi>i</mi><mo>∈</mo><mi>G</mi><mo>}</mo><mo>)</mo></mrow><mo>,</mo><mspace width="1em"></mspace><msub><mover><mi>y</mi><mo>^</mo></mover><mi>G</mi></msub><mo>=</mo><mtext>MLP</mtext><mrow><mo>(</mo>${hG}<mo>)</mo></mrow></mrow></math>`;
  return { key: `readout-${k}-${pk}`, math, plain: `h_G = POOL({hᵢ⁽${k}⁾ | i ∈ G}),   ŷ_G = MLP(h_G)`, note: S.mathNote.readout(pk, k) };
}
let mathHost = null, mathKey = null;
function renderFormula(F) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === F.key) return;
  mathKey = F.key;
  mathHost.innerHTML = `<div class="w-math-eq"><span style="color:var(--ink-2)">${MATHML ? F.math : F.plain}</span></div><div class="w-math-note">${F.note}</div>`;
}

/* ================================================================ Graph */

/* THE INBOX (round 6, his "after nodes exchange information, it disappears
   ... are they concatenated? summed? transformed to 1 node feature?"). Every
   node's row of x leaves its slot: the row itself rises to the top of the
   node's inbox, and a copy rides each edge in its own lane, turns short of
   the receiver and climbs into its inbox, so each node holds its inputs as
   rows stacked in the table's order (0–0.5). They sit with their weights, an
   equation down the column (0.5–0.66); then they move down into the slot as
   one row, the weighted sum, three numbers like x (0.66–0.92). The copies
   climb outside the inbox's column, and the self row has risen past the
   others' places before they arrive (tweens-move-in-lanes). */
const MINI = 14, INBOX = { gap: 4, above: 10, side: 51, lane: 9 };
const AG = { send: 0.5, weigh: 0.66, add: 0.92 };
/** the top-left of row k of node i's inbox, n rows */
const inboxRow = (P, i, k, n) => [P[i][0] - 1.5 * MINI, slotOf(P, i)[1] - INBOX.above - (n - k) * (MINI + INBOX.gap)];
/** the point a fraction u of the way along a polyline, by length */
function along(pts, u) {
  const segs = pts.slice(1).map((q, k) => Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]));
  let d = u * segs.reduce((s, v) => s + v, 0);
  for (let k = 0; k < segs.length; k++) {
    if (d <= segs[k] || k === segs.length - 1) return lerpPt(pts[k], pts[k + 1], segs[k] ? Math.min(1, d / segs[k]) : 1);
    d -= segs[k];
  }
  return pts.at(-1);
}
function drawInbox(ctx, colors, g, P, t, pick) {
  const merge = ease(seg(t, AG.weigh, AG.add)), y0 = P[0][1];
  g.all.forEach((u) => {
    const n = u.inputs.length, hot = u.i === pick, [sx, sy] = slotOf(P, u.i);
    const cells = (x, y, row, c) => cellRow(ctx, colors, x, y, row, c, g.scale, { stroke: hot ? colors.highlight : colors.ink1, lw: hot ? 1.6 : 1 });
    u.inputs.forEach((j, k) => {
      const [rx, ry] = inboxRow(P, u.i, k, n), row = BASIC.atoms[j].x;
      if (t >= AG.weigh) { cells(lerp(rx, sx, merge), lerp(ry, sy, merge), row, lerp(MINI, SLOT_C, merge)); return; }
      if (j === u.i) {
        const q = ease(seg(t, 0, 0.3));
        cells(lerp(sx, rx, q), lerp(sy, ry, q), row, lerp(SLOT_C, MINI, q));
      } else {
        const dir = P[u.i][0] > P[j][0] ? 1 : -1, ly = y0 + dir * INBOX.lane, bx = P[u.i][0] - dir * INBOX.side, my = ry + MINI / 2;
        const [x, y] = along([[P[j][0] + dir * (NODE_R + 4) + dir * 1.5 * MINI, ly], [bx, ly], [bx, my], [P[u.i][0], my]], ease(seg(t, 0.04, AG.send)));
        cells(x - 1.5 * MINI, y - MINI / 2, row, MINI);
      }
      if (t >= AG.send) txt(ctx, colors, `${k ? "+ " : ""}${fmt(u.w[k])} ×`, rx - 6, ry + MINI / 2 + 0.5, { font: monoFont(colors), fill: colors.ink1, align: "right", baseline: "middle" });
    });
  });
}

function drawGraph(ctx, colors, w, h, params, g, anim, pointer) {
  const beat = shownStep(anim, "graph"), a = g.agg, mol = BASIC;
  const tm = anim.n.graph === 2 ? phase(anim, "graph") : null, ta = anim.n.graph === 3 ? phase(anim, "graph") : null;
  const ag = anim.n.graph === 1 ? phase(anim, "graph") : null, landed = ag != null && ag >= AG.add;
  const P = basicPoints(w), A = adjacency(mol), nb = new Set(a.inputs.slice(1));
  /* the ease: a new Node slides the ring from the one it leaves */
  const ez = ezFrom(anim), rp = ez ? lerpPt(P[Number(ez.params.node)], P[a.i], ezP(anim)) : P[a.i];
  let hov = null;
  if (pointer) P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= NODE_R + 3) hov = i; });

  txt(ctx, colors, S.capGraph, 12, 16, { font: capFont(colors), fill: colors.ink1 });
  /* the edges; after Aggregate those into the picked node carry its weights */
  mol.bonds.forEach(([i, j]) => {
    if (beat >= 1 && (i === a.i || j === a.i)) return;
    line(ctx, P[i][0], P[i][1], P[j][0], P[j][1], colors.ink1, 1.6);
  });
  if (beat >= 1) {
    a.inputs.slice(1).forEach((j, k) => edgeInto(ctx, colors, P[j], P[a.i], a.w[k + 1], NODE_R));
    /* the self-loop under the node, its arrowhead back into it */
    const [px, py] = P[a.i];
    ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1 + 12 * a.w[0];
    ctx.beginPath(); ctx.arc(px, py + LOOP.dy, LOOP.r, -0.02 * Math.PI, 1.0 * Math.PI); ctx.stroke(); ctx.restore();
    arrowHead(ctx, px + 8, py + NODE_R + 1, -1.95, colors.highlight, 10);
    txt(ctx, colors, `${S.selfTag} ${fmt(a.w[0])}`, px, py + LOOP.dy + LOOP.r + 18, { font: boldMono(colors), fill: colors.ink1, align: "center", halo: true });
  }
  /* every node's row: x, then after Aggregate its sum, after Transform its h′;
     while Aggregate runs the rows are in the inboxes; from Multiply by W until
     Apply ELU sends them home they are in the band */
  const rows = landed ? g.all.map((u) => u.sum) : beat === 0 ? mol.atoms.map((at) => at.x) : g.all.map((u) => (beat === 1 ? u.sum : u.out));
  if (tm == null && ta == null && beat !== 2 && (ag == null || landed)) rows.forEach((row, i) => {
    const [x0, y0] = slotOf(P, i);
    cellRow(ctx, colors, x0, y0, row, SLOT_C, g.scale);
    txt(ctx, colors, row.map((v) => fmt(v, beat === 0 && !landed ? 1 : 2)).join(" "), P[i][0], y0 - 6, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  });
  if (ag != null && !landed) drawInbox(ctx, colors, g, P, ag, a.i);
  mol.atoms.forEach((at, i) => {
    const fill = i === a.i ? wash(colors.highlight, 0.35) : nb.has(i) ? wash(colors.groupA, 0.32) : hov === i ? wash(colors.groupA, 0.15) : null;
    node(ctx, colors, P[i][0], P[i][1], NODE_R, String(i), { fill });
  });
  ring(ctx, rp[0], rp[1], NODE_R + 7, colors.highlight);

  drawBand(ctx, colors, w, g, P, beat, tm, ta);
  drawInputTable(ctx, colors, w, { x0: 12, ty: 412, mol, a, kind: "gcn", beat, graph: true });

  if (hov != null) hoverLabel(ctx, colors, S.nodeHover(hov, A[hov].reduce((s, v) => s + v, 0)), P[hov][0], P[hov][1], w);
  const status = tm != null ? S.mulMoving : ta != null ? (ta < 0.76 ? S.eluMoving : S.homeMoving) : ag != null ? (ag < AG.send ? S.aggSend : ag < AG.weigh ? S.aggWeigh : S.aggAdd)
    : S.grStatus[beat](a.i, beat === 0 ? a.deg : fmt(a.w.reduce((s, v) => s + v, 0)));
  txt(ctx, colors, status, 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.aggNote.graph, 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
}

/* ============================================================ Aggregate */

function drawAggregate(ctx, colors, w, h, params, c0, anim, pointer) {
  const beat = shownStep(anim, "aggregate"), kind = params.layer, mol = CAFFEINE;
  /* the ease: Layer or Weights on the same atom moves every weight, sum and
     h′ to its new value; a new atom moves the ring */
  const ez = ezFrom(anim), p = ezP(anim), o = ez?.state.c.agg;
  const a = o && o.i === c0.agg.i ? { ...c0.agg, w: lerpArr(o.w, c0.agg.w, p), sum: lerpArr(o.sum, c0.agg.sum, p), pre: lerpArr(o.pre, c0.agg.pre, p), out: lerpArr(o.out, c0.agg.out, p) } : c0.agg;
  const c = { ...c0, agg: a };
  const tr = anim.n.aggregate === 2 ? phase(anim, "aggregate") : null;
  const msgU = anim.n.aggregate === 1 ? flight(anim, "aggregate") : null;
  const P = cafPoints(w), A = adjacency(mol), nb = new Set(a.inputs.slice(1));
  let hov = null;
  if (pointer) P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 13) hov = i; });

  txt(ctx, colors, S.capMol, 12, 16, { font: capFont(colors), fill: colors.ink1, maxW: leftW(w) - 16 });
  mol.bonds.forEach(([i, j, type]) => {
    if (beat >= 1 && (i === a.i || j === a.i)) return;
    bond(ctx, P[i], P[j], type, i === a.i || j === a.i ? colors.ink1 : colors.ink3, 1.4);
  });
  /* after Aggregate a bond into the picked atom is as wide as its weight, an arrowhead into the atom */
  if (beat >= 1) a.inputs.slice(1).forEach((j, k) => edgeInto(ctx, colors, P[j], P[a.i], a.w[k + 1], 11, { label: false, head: 8 }));
  mol.atoms.forEach((at, i) => {
    const fill = i === a.i ? wash(colors.highlight, 0.35) : nb.has(i) ? wash(colors.groupA, 0.32) : hov === i ? wash(colors.groupA, 0.15) : null;
    node(ctx, colors, P[i][0], P[i][1], 11, at.el, { fill });
    txt(ctx, colors, String(i), P[i][0] + 12, P[i][1] - 9, { font: monoFont(colors), fill: colors.ink3, halo: true });
  });
  const rp = o ? lerpPt(P[o.i], P[a.i], p) : P[a.i];
  ring(ctx, rp[0], rp[1], 17, colors.highlight);
  if (msgU != null) drawMessages(ctx, colors, P, c.msgs, msgU, { pick: a.i });

  const geo = drawInputTable(ctx, colors, w, { x0: leftW(w) + 8, ty: 0, mol, a, kind, beat, graph: false });
  drawCafTransform(ctx, colors, c, geo, tr, beat);

  if (hov != null) hoverLabel(ctx, colors, S.aggHover(hov, mol.atoms[hov].el, A[hov].reduce((s, v) => s + v, 0)), P[hov][0], P[hov][1], w);
  const status = tr != null ? S.trMoving.aggregate : msgU != null ? S.molMoving : beat === 0 ? S.aggStatus[0]("atom", a.i, a.deg) : beat === 1 ? S.aggStatus[1]("atom", a.i, fmt(a.w.reduce((s, v) => s + v, 0))) : S.aggStatus[2]("atom", a.i);
  txt(ctx, colors, status, 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, kind === "gcn" ? S.aggNote.gcn : S.aggNote[params.weights], 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
}

/* =============================================================== Layers */

/* THE STACK (round 3, his pick B from `_lab/message-passing-motion-mock.html`,
   after Kipf & Welling 2017's Figure 1, a GCN drawn as copies of the graph):
   one sheet a layer, layer 0 (x) at the bottom, the picked atom on the top
   one. The cone: an atom on sheet L reads itself and its bonded atoms on
   sheet L − 1, so its lines run one bond a sheet. The cloud on layer 0 is
   every atom the picked one has gathered from. A press: the new sheet slides
   down into its own slot from above (0–0.25), the messages rise through the
   cone, the lowest sheet first (0.25–0.75), the cloud grows to the new field
   (0.75–1).
   Round 6 (his "you should use the caffeine molecule"): each sheet is
   caffeine's drawing, every atom named, and the stack holds every layer the
   page runs, K_MAX. The sheets lean left: leaning right put atoms 6 and 7
   12 px apart, too close for two named atoms; at this lean and scale no two
   atoms are nearer than 18 px. */
const ST = { s: 43, gx: -0.4, gy: 0.3, base: 396, gap: 73, pad: 16, drop: 30, r: 7 };
const CAF_SPAN = (() => { const xs = CAFFEINE.atoms.map((a) => a.xy[0]), ys = CAFFEINE.atoms.map((a) => a.xy[1]); return { mx: Math.min(...xs), my: Math.min(...ys), sx: Math.max(...xs) - Math.min(...xs), sy: Math.max(...ys) - Math.min(...ys) }; })();
function stackX0(w) { return (w - (CAF_SPAN.sx * ST.s + CAF_SPAN.sy * ST.s * ST.gx)) / 2 + 20; }
/** caffeine's atoms on sheet `level`, `drop` px above its slot */
function sheetPts(w, level, drop = 0) {
  const x0 = stackX0(w), y0 = ST.base - level * ST.gap - drop - CAF_SPAN.sy * ST.s * ST.gy;
  return CAFFEINE.atoms.map((a) => { const X = a.xy[0] - CAF_SPAN.mx, Y = a.xy[1] - CAF_SPAN.my; return [x0 + X * ST.s + Y * ST.s * ST.gx, y0 + Y * ST.s * ST.gy]; });
}
function sheetOutline(ctx, colors, w, level, drop, top) {
  const x0 = stackX0(w), y0 = ST.base - level * ST.gap - drop - CAF_SPAN.sy * ST.s * ST.gy, p = ST.pad;
  const X1 = CAF_SPAN.sx * ST.s + p, Y1 = CAF_SPAN.sy * ST.s + p;
  const cs = [[-p, -p], [X1, -p], [X1, Y1], [-p, Y1]].map(([X, Y]) => [x0 + X + Y * ST.gx, y0 + Y * ST.gy]);
  ctx.save(); ctx.beginPath(); cs.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = wash(colors.surface3, 0.55); ctx.fill(); ctx.strokeStyle = top ? colors.ink2 : colors.grid; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  txt(ctx, colors, level === 0 ? S.sheet0 : S.sheetK(level), Math.min(cs[0][0], cs[3][0]) - 6, (cs[0][1] + cs[3][1]) / 2 + 4, { fill: colors.ink3, align: "right" });
}
/* the cloud: a disc for every atom in the field, drawn opaque off-screen and
   laid down once at a set opacity, so overlapping discs do not darken */
let OFF = null;
function cloud(ctx, colors, pts, members, r, grow) {
  const cv = ctx.canvas;
  if (!OFF) OFF = document.createElement("canvas");
  if (OFF.width !== cv.width || OFF.height !== cv.height) { OFF.width = cv.width; OFF.height = cv.height; }
  const o = OFF.getContext("2d"); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, OFF.width, OFF.height);
  o.setTransform(ctx.getTransform()); o.fillStyle = colors.groupA;
  members.forEach((i) => { const rr = r * (grow?.get(i) ?? 1); if (rr > 0) { o.beginPath(); o.arc(pts[i][0], pts[i][1], rr, 0, 2 * Math.PI); o.fill(); } });
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.24; ctx.drawImage(OFF, 0, 0); ctx.restore();
}
/** the flat likeness drawing, under the stack at the left */
const LY = { top: 444, boxH: 118, curveTop: 448, curveH: 92 };
const flatPts = (w) => molPoints(CAFFEINE, 12, LY.top + 8, w * 0.46 - 12, LY.boxH - 12, 40);

function drawLayers(ctx, colors, w, h, params, st, anim, pointer) {
  const k = shownStep(anim, "layers"), from = Number(params.from), N = CAFFEINE.atoms.length;
  const t = phase(anim, "layers"), kNew = anim.n.layers, moving = t != null;
  const within = (kk, hops = st.hops) => [...Array(N).keys()].filter((i) => hops[i] <= kk);
  const top = moving ? kNew : k;
  const drop = moving ? (1 - ease(seg(t, 0, 0.25))) * ST.drop : 0;
  const pts = [...Array(top + 1).keys()].map((L) => sheetPts(w, L, L === top && moving ? drop : 0));
  const PF = flatPts(w);
  /* the ease: a new Atom slides the rings, shrinks the atoms the old field
     held and the new one does not, grows those it gains, and moves each
     atom's likeness to its new value */
  const ez = ezFrom(anim), q0 = ezP(anim), o = ez?.state;
  const fromOld = o ? Number(ez.params.from) : from;
  let hov = null, hovP = null;
  if (pointer) for (const P of [PF, pts[top]]) P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 9) { hov = i; hovP = P; } });

  /* the sheets, bottom first */
  for (let L = 0; L <= top; L++) sheetOutline(ctx, colors, w, L, L === top && moving ? drop : 0, L === top);
  /* the cloud on layer 0: the settled field, growing to the new one in the last phase */
  const grow = new Map(), members = new Set(within(top));
  if (moving) within(top).forEach((i) => { if (st.hops[i] === top) grow.set(i, ease(seg(t, 0.75, 1))); });
  if (o) {
    const was = new Set(within(top, o.hops));
    was.forEach((i) => { if (!members.has(i)) { members.add(i); grow.set(i, 1 - q0); } });
    members.forEach((i) => { if (!was.has(i)) grow.set(i, (grow.get(i) ?? 1) * q0); });
  }
  cloud(ctx, colors, pts[0], [...members], 17, grow);
  /* the cone */
  const coneTop = moving && t < 0.25 ? top - 1 : top;
  for (let L = 1; L <= coneTop; L++) for (const a of within(top - L)) for (const b of [a, ...st.nbrs[a]]) {
    line(ctx, pts[L - 1][b][0], pts[L - 1][b][1], pts[L][a][0], pts[L][a][1], wash(colors.groupA, 0.5), 1);
  }
  for (let L = 0; L <= top; L++) {
    CAFFEINE.bonds.forEach(([i, j, type]) => bond(ctx, pts[L][i], pts[L][j], type, colors.ink3, 1));
    CAFFEINE.atoms.forEach((at, i) => {
      const isPick = L === top && i === from, inCone = st.hops[i] <= top - L;
      node(ctx, colors, pts[L][i][0], pts[L][i][1], ST.r, at.el, {
        fill: isPick ? wash(colors.highlight, 0.55) : inCone ? wash(colors.groupA, 0.45) : null,
        stroke: inCone || isPick ? colors.ink1 : colors.ink3, lw: 1, ink: inCone || isPick ? colors.ink1 : colors.ink3,
      });
    });
  }
  const rTop = lerpPt(pts[top][fromOld], pts[top][from], q0);
  ring(ctx, rTop[0], rTop[1], ST.r + 4, colors.highlight);
  /* the messages rising through the cone, one sheet after another */
  if (moving && t > 0.25 && t < 0.75) {
    const m = ease(seg(t, 0.25, 0.75));
    for (let L = 1; L <= top; L++) {
      const ml = seg(m, (L - 1) / top, L / top);
      if (ml <= 0 || ml >= 1) continue;
      for (const a of within(top - L)) for (const b of [a, ...st.nbrs[a]]) {
        const [x0, y0] = pts[L - 1][b], [x1, y1] = pts[L][a];
        dot(ctx, lerp(x0, x1, ml), lerp(y0, y1, ml), 2.6, L === top && a === from ? colors.highlight : colors.groupA);
      }
    }
  }
  const kSeen = moving && t < 0.75 ? k : top;
  txt(ctx, colors, S.capReach(within(kSeen).length, N), 12, 16, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });

  /* under the stack: the likeness drawing at the left */
  const kL = moving && t < 0.75 ? k : top;
  const like = (i) => (o ? lerp(o.likeness[kL][i], st.likeness[kL][i], q0) : st.likeness[kL][i]);
  txt(ctx, colors, S.capAlike(from), 12, LY.top - 6, { font: capFont(colors), fill: colors.ink1, maxW: w * 0.46 });
  CAFFEINE.bonds.forEach(([i, j, type]) => bond(ctx, PF[i], PF[j], type, colors.ink3, 1.2));
  CAFFEINE.atoms.forEach((at, i) => node(ctx, colors, PF[i][0], PF[i][1], 8, at.el, { fill: ramp(colors, like(i)), stroke: hov === i ? colors.groupA : null, lw: hov === i ? 2.4 : 1.2 }));
  const rFlat = lerpPt(PF[fromOld], PF[from], q0);
  ring(ctx, rFlat[0], rFlat[1], 13, colors.highlight);
  const kx = 12 + 64, ky = LY.top + LY.boxH + 8;
  for (let q = 0; q < 60; q++) rect(ctx, kx + q * 1.5, ky, 1.5, 7, ramp(colors, q / 59));
  txt(ctx, colors, S.keyLo, kx - 4, ky + 7, { fill: colors.ink3, align: "right" });
  txt(ctx, colors, S.keyHi, kx + 96, ky + 7, { fill: colors.ink3 });

  /* and the curve at the right, revealed up to the layers landed */
  const x0 = w * 0.46 + 44, y0 = LY.curveTop, cw = w - x0 - 16, ch = LY.curveH;
  const sx = (v) => x0 + (v / K_MAX) * cw, sy = (v) => y0 + ch - Math.max(0, Math.min(1.05, v)) * ch;
  line(ctx, x0, y0, x0, y0 + ch, colors.axis); line(ctx, x0, y0 + ch, x0 + cw, y0 + ch, colors.axis);
  for (let q = 0; q <= K_MAX; q++) { line(ctx, sx(q), y0 + ch, sx(q), y0 + ch + 4, colors.axis); txt(ctx, colors, String(q), sx(q), y0 + ch + 15, { fill: colors.ink3, align: "center" }); }
  for (const v of [0, 0.5, 1]) { line(ctx, x0 - 4, sy(v), x0, sy(v), colors.axis); txt(ctx, colors, v.toFixed(1), x0 - 6, sy(v) + 3, { fill: colors.ink3, align: "right" }); }
  txt(ctx, colors, S.curveX, x0 + cw / 2, y0 + ch + 30, { fill: colors.ink3, align: "center" });
  ctx.save(); ctx.translate(x0 - 32, y0 + ch / 2); ctx.rotate(-Math.PI / 2); txt(ctx, colors, S.curveY, 0, 0, { fill: colors.ink3, align: "center" }); ctx.restore();
  line(ctx, sx(LESSON_LAYERS), y0, sx(LESSON_LAYERS), y0 + ch, colors.grid, 1, [2, 3]);
  txt(ctx, colors, S.curveLesson, sx(LESSON_LAYERS), y0 - 5, { fill: colors.ink3, align: "center" });
  const upto = [...Array(kL + 1).keys()];
  polyline(ctx, upto.map(sx), upto.map((q) => sy(FILE_SPREAD[q])), colors.reference, 1.6, [5, 3]);
  polyline(ctx, upto.map(sx), upto.map((q) => sy(st.unlike[q])), colors.empirical, 2);
  upto.forEach((q) => dot(ctx, sx(q), sy(st.unlike[q]), 2.5, colors.empirical));
  dot(ctx, sx(kL), sy(st.unlike[kL]), 5, colors.highlight, colors.surface, 1.5);
  const endR = kL >= K_MAX - 1;
  txt(ctx, colors, fmt(st.unlike[kL]), sx(kL) + (endR ? -8 : 8), sy(st.unlike[kL]) - 7, { font: boldMono(colors), fill: colors.ink1, halo: true, align: endR ? "right" : "left" });
  /* the two lines are named in the legend: a label on the curve collided with the value at k = 1 */

  if (hov != null) hoverLabel(ctx, colors, S.layHover(hov, CAFFEINE.atoms[hov].el, st.hops[hov]), hovP[hov][0], hovP[hov][1], w);
  txt(ctx, colors, moving ? S.layMoving(kNew) : S.layStatus(k, from, within(k).length, N), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.layNote, 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
}

/* ============================================================== Readout */

/* WHAT IS POOLED (round 4, his pick: caffeine only): the molecule at the
   left, its atom vectors after the lesson's two layers at the right, one row
   of cells an atom (the first SHOW of 16 numbers, each column on its own
   scale, so a column's largest value is its darkest cell). Pool: the max
   cells are framed where they sit (0–0.3), then each column's pooled number
   drops into the pooled row, one column after another, through the gap under
   the rows — its own lane (0.3–1). The pooled row then feeds the classifier
   that predicts y. A hover on an atom or a row lights both. */
const RDG = { molTop: 60, rowTop: 64, rh: 15, stripY: 6 };
function rdGeom(w) {
  const rx = leftW(w) + 44, c = Math.min(26, (w - rx - 12) / SHOW);
  const rowsEnd = RDG.rowTop + CAFFEINE.atoms.length * RDG.rh, poolY = rowsEnd + 36;
  return { rx, c, rowsEnd, poolY, clsY: poolY + 64 };
}
const rdPoints = (w) => molPoints(CAFFEINE, 12, RDG.molTop, leftW(w) - 24, 220, 52);
/* THE PIPELINE the lesson builds, as a strip across the top: x, the layers
   run, pool, the classifier, y; the middle is elided when the strip would not fit
   on one line. The layers wear --c-group-a's wash, the one thing the
   Layers control changes. */
function drawPipeline(ctx, colors, w, k) {
  ctx.save(); ctx.font = `${colors.fsXs} ${colors.font}`;
  const ls = [...Array(k).keys()].map((i) => S.pipeLayer(i + 1)), wide = (xs) => xs.reduce((s, x) => s + ctx.measureText(x).width + 30, 0);
  const full = [S.pipeX, ...ls, S.pipePool, S.pipeCls, S.pipeY];
  /* every layer named while the strip fits (round 6: four at most now), the middle elided when it does not */
  const items = k > 2 && wide(full) > w - 24 ? [S.pipeX, ls[0], S.pipeGap, ls.at(-1), S.pipePool, S.pipeCls, S.pipeY] : full;
  let x = 12;
  items.forEach((s, i) => {
    const bw = ctx.measureText(s).width + 14, layer = s.startsWith("layer") || s === S.pipeGap;
    rect(ctx, x, RDG.stripY, bw, 20, layer ? wash(colors.groupA, 0.18) : colors.surface2, colors.grid);
    txt(ctx, colors, s, x + bw / 2, RDG.stripY + 10.5, { fill: colors.ink1, align: "center", baseline: "middle" });
    x += bw;
    if (i < items.length - 1) { txt(ctx, colors, "→", x + 8, RDG.stripY + 10.5, { fill: colors.ink3, align: "center", baseline: "middle" }); x += 16; }
  });
  ctx.restore();
}

function drawReadout(ctx, colors, w, h, params, rd, anim, pointer) {
  const pooledNow = shownStep(anim, "readout") >= 1, t = phase(anim, "readout"), pk = params.pooling;
  const g = rdGeom(w), P = rdPoints(w), N = CAFFEINE.atoms.length;
  /* the ease: Layers moves every cell to its value after the new count, the
     scale with it; Pooling moves the pooled row; the max frames slide to the
     rows the new maxima sit in */
  const ez = ezFrom(anim), q0 = ezP(anim), o = ez?.state.rd;
  const rows = o ? rd.rows.map((r, i) => lerpArr(o.rows[i], r, q0)) : rd.rows;
  const lo = o ? lerp(o.lo, rd.lo, q0) : rd.lo, hi = o ? lerp(o.hi, rd.hi, q0) : rd.hi;
  const frameRow = (k) => (o && ez.params.pooling === "max" ? lerp(o.argmax[k], rd.argmax[k], q0) : rd.argmax[k]);
  const scaleK = (v) => ramp(colors, (v - lo) / (hi - lo || 1));
  drawPipeline(ctx, colors, w, rd.depth);
  let hov = null;
  if (pointer) {
    P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 12) hov = i; });
    if (pointer.x >= g.rx - 44 && pointer.x < g.rx + 7 + SHOW * g.c && pointer.y >= RDG.rowTop && pointer.y < g.rowsEnd) hov = Math.floor((pointer.y - RDG.rowTop) / RDG.rh);
  }

  /* the molecule */
  txt(ctx, colors, S.capRdMol, 12, RDG.molTop - 14, { font: capFont(colors), fill: colors.ink1 });
  CAFFEINE.bonds.forEach(([i, j, type]) => bond(ctx, P[i], P[j], type, colors.ink2, 1.3));
  CAFFEINE.atoms.forEach((at, i) => {
    node(ctx, colors, P[i][0], P[i][1], 11, at.el, { fill: hov === i ? wash(colors.groupA, 0.4) : null });
    txt(ctx, colors, String(i), P[i][0] + 12, P[i][1] - 9, { font: monoFont(colors), fill: colors.ink3, halo: true });
  });

  /* the rows, one an atom */
  txt(ctx, colors, S.capRows(rd.depth), g.rx - 40, RDG.rowTop - 14, { font: capFont(colors), fill: colors.ink1, maxW: w - g.rx + 28 });
  const framed = pk === "max" && (pooledNow || (t != null && t > 0.02));
  rows.forEach((r, i) => {
    const y = RDG.rowTop + i * RDG.rh;
    if (hov === i) rect(ctx, g.rx - 42, y, 7 + SHOW * g.c + 44, RDG.rh, wash(colors.groupA, 0.22));
    txt(ctx, colors, `${i} ${CAFFEINE.atoms[i].el}`, g.rx - 6, y + RDG.rh / 2 + 1, { font: monoFont(colors), fill: hov === i ? colors.ink1 : colors.ink3, align: "right", baseline: "middle" });
    r.slice(0, SHOW).forEach((v, k) => rect(ctx, g.rx + k * g.c, y, g.c, RDG.rh, scaleK(v), colors.grid));
  });
  if (framed) for (let k = 0; k < SHOW; k++) rect(ctx, g.rx + k * g.c, RDG.rowTop + frameRow(k) * RDG.rh, g.c, RDG.rh, null, colors.highlight, 2);
  txt(ctx, colors, S.rowsNote(rd.rows[0].length), g.rx, g.rowsEnd + 12, { fill: colors.ink3, maxW: w - g.rx - 8 });

  /* Pool: each column's number drops into the pooled row, one column after another */
  const p = o ? lerpArr(o.pooled[ez.params.pooling], rd.pooled[pk], q0) : rd.pooled[pk];
  if (pooledNow || t != null) {
    txt(ctx, colors, S.poolRule[pk], g.rx - 40, g.poolY - 8, { fill: colors.ink2, maxW: w - g.rx + 28 });
    txt(ctx, colors, S.pooledName[pk], g.rx - 6, g.poolY + 9, { font: boldMono(colors), fill: colors.ink1, align: "right", baseline: "middle" });
    for (let k = 0; k < SHOW; k++) {
      const q = pooledNow ? 1 : ease(seg(t, 0.3 + 0.07 * k, 0.44 + 0.07 * k));
      if (q <= 0) continue;
      const y = lerp(g.rowsEnd, g.poolY, q);
      rect(ctx, g.rx + k * g.c, y, g.c, 18, scaleK(p[k]), colors.ink1, 1.2);
      if (q >= 1) txt(ctx, colors, fmt(p[k], 1), g.rx + k * g.c + g.c / 2, g.poolY + 30, { font: monoFont(colors), fill: colors.ink2, align: "center" });
    }
  }
  /* what reads the one vector */
  if (pooledNow) {
    const cx = g.rx + (SHOW * g.c) / 2, bw = 110;
    txt(ctx, colors, S.oneVector, g.rx - 40, g.poolY + 50, { fill: colors.ink3, maxW: w - g.rx + 28 });
    line(ctx, cx, g.poolY + 56, cx, g.clsY - 1, colors.ink2, 1.2);
    arrowHead(ctx, cx, g.clsY, Math.PI / 2, colors.ink2, 7);
    rect(ctx, cx - bw / 2, g.clsY, bw, 26, colors.surface2, colors.ink2);
    txt(ctx, colors, S.classifier, cx, g.clsY + 14, { fill: colors.ink1, align: "center", baseline: "middle" });
    line(ctx, cx + bw / 2, g.clsY + 13, cx + bw / 2 + 24, g.clsY + 13, colors.ink2, 1.2);
    arrowHead(ctx, cx + bw / 2 + 26, g.clsY + 13, 0, colors.ink2, 7);
    txt(ctx, colors, "y", cx + bw / 2 + 32, g.clsY + 14, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
  }

  if (hov != null) hoverLabel(ctx, colors, S.rdHover(hov, CAFFEINE.atoms[hov].el), P[hov][0], P[hov][1], w);
  txt(ctx, colors, t != null ? S.rdMoving : S.rdStatus[pooledNow ? 1 : 0], 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.rdNote(CAFFEINE.y), 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
}

/* ================================================================ widget */

defineWidget({
  slug: "message-passing",
  status: "draft",
  title: "Deep Learning - Graphs: Message Passing",
  subtitle: S.subtitle,
  /* caffeine is a row of the lesson's file, as 94's six are */
  credit: "Molecule data: Stokes et al., Cell 2020, via FinGAT",
  layout: "side",
  height: (params) => (params.page === "graph" ? H_GRAPH : params.page === "layers" ? H_LAY : params.page === "readout" ? H_RD : H_CAF),
  pointer: true,

  params: {
    /* Basics over Graph, Molecule over the three (core's group, 94's form); no field label, the headings name them */
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, groupHeads: true, default: "graph", display: true },
    node: { type: "segmented", label: S.nodeLabel, detail: S.nodeDetail, options: NODE_OPTS, default: "1", display: true, when: ON("graph") },
    atom: { type: "select", label: S.atomLabel, detail: S.atomDetail, options: ATOM_OPTS, default: "1", display: true, when: ON("aggregate") },
    layer: { type: "segmented", label: S.layerLabel, detail: S.layerDetail, options: LAYERS, default: "gcn", display: true, when: ON("aggregate") },
    weights: { type: "segmented", label: S.weightsLabel, detail: S.weightsDetail, options: WEIGHTS, default: "untrained", display: true, when: { all: [ON("aggregate"), { param: "layer", equals: "gat" }] } },
    from: { type: "select", label: S.fromLabel, detail: S.fromDetail, options: ATOM_OPTS, default: "9", display: true, when: ON("layers") },
    depth: { type: "choice", label: S.depthLabel, detail: S.depthDetail, options: [...Array(K_MAX).keys()].map((k) => ({ value: String(k + 1), label: String(k + 1) })), default: String(LESSON_LAYERS), display: true, when: ON("readout") },
    pooling: { type: "segmented", label: S.poolLabel, detail: S.poolDetail, options: POOLS, default: "max", display: true, when: ON("readout") },
    /* authoring escape hatch, first render only: presses already made on the page the link opens */
    shown: { type: "int", min: 0, max: K_MAX, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "graph") return [{ token: "highlight", label: "The node updated", mark: "dot" }, { token: "group-a", label: "Its neighbours", mark: "dot" }];
    if (params.page === "aggregate") return [{ token: "highlight", label: "The atom updated", mark: "dot" }, { token: "group-a", label: "Its neighbours", mark: "dot" }];
    if (params.page === "layers") return [{ token: "group-a", label: "Gathered from", mark: "dot" }, { token: "empirical", label: "Caffeine", mark: "line" }, { token: "reference", label: `The file's ${FILE_N.toLocaleString("en")} molecules, mean`, mark: "dash" }];
    return params.pooling === "max" ? [{ token: "highlight", label: "The largest value of each column", mark: "hollow" }] : [];
  },

  compute,

  regions: ({ w, params, anim }) => {
    if (params.page === "graph") return basicPoints(w).map(([x, y], i) => ({ x: x - NODE_R - 2, y: y - NODE_R - 2, w: 2 * NODE_R + 4, h: 2 * NODE_R + 4, set: { node: String(i) }, label: `${i}` }));
    if (params.page === "aggregate") return cafPoints(w).map(([x, y], i) => ({ x: x - 13, y: y - 13, w: 26, h: 26, set: { atom: String(i) }, label: `${i}` }));
    /* the atoms of the top sheet (its level read from the press counter, settled) and of the likeness drawing */
    if (params.page === "layers") {
      const top = anim ? shownStep(anim, "layers") : 0;
      return [sheetPts(w, top), flatPts(w)].flatMap((P) => P.map(([x, y], i) => ({ x: x - 9, y: y - 9, w: 18, h: 18, set: { from: String(i) }, label: `${i}` })));
    }
    return [];
  },

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    /* one press, one step, watched once: Step alone (play-only-for-motion-or-repetition) */
    runLabel: null,

    init: ({ params, state, fromScratch }) => {
      const stage = params.page;
      const anim = { stage, n: { graph: 0, aggregate: 0, layers: 0, readout: 0 }, t: 1, dur: MOVE_MS, halt: false, ez: null, last: { params: { ...params }, state } };
      anim.n[stage] = fromScratch ? 0 : Math.max(0, Math.min(stepsOf(stage), Number(params.shown) || 0));
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage);
      return anim;
    },

    advance: (anim, { dt }) => {
      /* a press a page switch interrupted ends here, before the new page's (mid-press-page-switch) */
      if (anim.halt) { anim.halt = false; return false; }
      const stage = anim.stage;
      if (ezFrom(anim)) anim.ez.t = Math.min(1, anim.ez.t + dt / EASE_MS);
      /* an ease core started: it runs the press in flight on with it, and
         never starts a new one */
      if (anim.mode === "ease") {
        if (anim.t < 1) anim.t = Math.min(1, anim.t + dt / anim.dur);
        anim.done = anim.n[stage] >= stepsOf(stage) && anim.t >= 1;
        return anim.t < 1 || ezFrom(anim) != null;
      }
      if (anim.t < 1) anim.t = Math.min(1, anim.t + dt / anim.dur);
      else if (anim.n[stage] < stepsOf(stage)) {
        anim.n[stage] += 1;
        anim.dur = durOf(stage, anim.n[stage]);
        anim.t = 0;
      }
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage) && anim.t >= 1;
      /* a press that lands lands the ease with it: the press's loop is the one running */
      if (anim.t >= 1 && anim.ez) anim.ez.t = 1;
      return anim.t < 1;
    },

    rebuild: (anim, { params, state }) => {
      const stage = params.page;
      /* only a page change ends a press in flight (mid-press-page-switch, 2026-09-20) */
      if (stage !== anim.stage && anim.t < 1) { anim.t = 1; anim.halt = true; }
      /* a new node or atom to inspect starts that page's presses again (round 9,
         his "when switching nodes, aggregate -> W -> ELU should reset"). No halt:
         the ease below takes the loop over, and an ease starts no press */
      const pick = { graph: "node", aggregate: "atom" }[stage];
      if (pick && stage === anim.stage && params[pick] !== anim.last.params[pick]) { anim.n[stage] = 0; anim.t = 1; }
      /* a rail control on the same page eases from the reading it leaves; a page change does not */
      if (stage === anim.stage && TWEENED.some((k) => params[k] !== anim.last.params[k])) {
        anim.ez = { params: anim.last.params, state: anim.last.state, t: 0 };
        anim.easing = true;
      } else if (stage !== anim.stage) anim.ez = null;
      anim.last = { params: { ...params }, state };
      anim.stage = stage;
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage) && anim.t >= 1;
    },
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    renderFormula(formulaFor(params, anim));
    if (params.page === "graph") drawGraph(ctx, colors, w, h, params, state.g, anim, pointer);
    else if (params.page === "layers") drawLayers(ctx, colors, w, h, params, state, anim, pointer);
    else if (params.page === "readout") drawReadout(ctx, colors, w, h, params, state.rd, anim, pointer);
    else drawAggregate(ctx, colors, w, h, params, state.c, anim, pointer);
  },

  readout({ params, state, anim }) {
    if (params.page === "layers") {
      const k = shownStep(anim, "layers"), n = state.hops.filter((d) => d <= k).length;
      return [
        { label: S.tileLayers, value: String(k), note: S.tileLayersNote },
        { label: S.tileReach, value: `${n} of ${CAFFEINE.atoms.length}`, note: S.tileReachNote(state.diameter) },
        { label: S.tileUnlike, value: fmt(state.unlike[k]), note: S.tileUnlikeNote(fmt(state.unlike[0])) },
      ];
    }
    if (params.page === "readout") {
      const rd = state.rd, pooled = shownStep(anim, "readout") >= 1;
      return [
        { label: S.tileRows, value: `${rd.rows.length} × ${rd.rows[0].length}`, note: S.tileRowsNote(rd.rows.length, rd.rows[0].length, rd.depth, fmt(rd.unlike)) },
        { label: S.tilePooled, value: pooled ? `1 × ${rd.rows[0].length}` : S.tileWait, note: S.tilePooledNote[params.pooling] },
        { label: S.tileY, value: String(CAFFEINE.y), note: S.tileYNote },
      ];
    }
    const graph = params.page === "graph", L = graph ? state.g : state.c, a = L.agg, beat = shownStep(anim, params.page);
    const kind = graph ? "gcn" : params.layer, unit = graph ? "node" : "atom";
    /* every input that ties for the largest weight */
    const big = Math.max(...a.w), tops = a.inputs.filter((_, k) => a.w[k] > big - 1e-9);
    const others = tops.filter((j) => j !== a.i), self = tops.includes(a.i);
    const who = [...(self ? [S.selfTag] : []), ...(others.length ? [`${unit}${others.length > 1 ? "s" : ""} ${others.join(" and ")}`] : [])].join(" and ");
    const topNote = kind === "gat" ? (params.weights === "trained" ? S.tileTopNote.trained(state.agreeTop) : S.tileTopNote.untrained) : S.tileTopNote.gcn;
    return [
      { label: S.tileInputs, value: String(a.inputs.length), note: S.tileInputsNote(a.deg) },
      { label: S.tileSum, value: beat >= 1 ? fmt(a.w.reduce((s, v) => s + v, 0)) : S.tileWait, note: S.tileSumNote[kind] },
      { label: S.tileTop, value: beat >= 1 ? `${fmt(big)} · ${who}` : S.tileWait, note: topNote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "graph") return S.sumGraph(state.g.agg.i, shownStep(anim, "graph"));
    if (params.page === "layers") return S.sumLay(shownStep(anim, "layers"), Number(params.from), state.hops.filter((d) => d <= shownStep(anim, "layers")).length);
    if (params.page === "readout") return S.sumRd(shownStep(anim, "readout") >= 1, params.pooling, Number(params.depth));
    return S.sumAgg(state.c.agg.i, shownStep(anim, "aggregate"));
  },
});
