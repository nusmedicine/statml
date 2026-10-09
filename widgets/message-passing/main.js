/* ============================================================================
   Widget 95 · Graphs: Message Passing (`message-passing`) — PHM5005 09-1
   cells 22–24 (the GNN layer, Aggregate and Transform; stacking layers;
   readout) and 09-2 cells 39–42 (the lesson's 2-layer GCN, max pooled) and
   62–64 (its 2-layer GAT).

   The misconception (catalogue § Slot 95): a GNN sees the whole molecule,
   and more layers always help. After k layers an atom has gathered from the
   atoms within k bonds, and with depth every atom's vector turns the same
   way (oversmoothing, Li et al. 2018); a readout then keeps only what its
   pooling keeps (Xu et al. 2019).

   Three pages under Step, his picks from `_lab/message-passing-mock.html`
   (2026-10-09, all nine the recommendation):

     AGGREGATE  one node's update. Example Chain · Caffeine: his figure
                (`dl-layer-gnn.png`, numbered from 0 as 94 numbers; its
                feature values illustrative) and then caffeine as 94 draws
                it, its rows 94's five columns of x. A press Aggregates the
                picked node (the weights on its inputs, the weighted rows
                summed), a second Transforms it (× W, then ELU, W seeded and
                untrained). A click picks another node; the presses carry.
                On caffeine, Layer GCN · GAT: GCN's weight 1/√(dᵢ dⱼ) with
                self-loops, fixed by the degrees, against GAT's α. Weights
                Untrained · Trained (GAT only): `_lab/message-passing-
                measure.py` found an untrained GAT's α within a few hundredths
                of 1/(inputs) — a plain average — so the trained α is the
                lesson's GATNet trained on its file
                (`_lab/message-passing-trained.py`, run 42), layer 1, the
                mean of its four heads; three runs agree on caffeine's top
                input for 12 of 14 atoms (layer 2 agrees for 2, so it is not
                drawn). The chain has no Layer control: it is the formula.
     LAYERS     a press adds a layer, 0 to 8. Left, the atoms the picked
                atom has gathered from (within k bonds); right, every atom's
                likeness to it (cosine of their vectors); under them the mean
                cosine distance between atoms, caffeine against the file's
                mean. The layer: GCN + ELU, seeded weights 5 → 16 → 16 …,
                the five columns standardised with the FILE's means and SDs
                (over the molecule's own atoms the curve barely moves for
                four layers: that removes the shared part smoothing grows).
                Opens on atom 9, a methyl at caffeine's diameter (6).
     READOUT    suberic acid against azelaic acid (8 and 9 carbons, both
                inactive in the file): two presses run the lesson's two
                layers, the atoms recoloured after each (one colour, one
                identical vector), a third Pools. Pooling Sum · Mean · Max,
                Max the lesson's. Max keeps which colours occur, so the two
                pool to one vector; mean keeps their shares, sum their counts.
                Measured over the file under the lesson's GCN: max ties 8–9
                pairs, mean and sum none. A third layer would separate this
                pair, so the depth stays the lesson's two.

   ROUND 1 (2026-10-09, his "I can't see the aggregation properly … some
   animation that's less tedious than going thru atom by atom"): Aggregate
   now updates EVERY node, as a layer does — the press sends a message along
   every edge both ways at once, each way in its own lane, sized by the weight
   its receiver gives it (on the chain, the sender's own row of cells, and
   one round each self-loop); they land and every node's row switches to its
   sum. The picked node's table is the close-up, and a click on another node
   after the press shows its sum with no further press. Layers and Readout's
   "Add a layer" send the same messages. Transform and Pool move nothing, so
   they switch at once (tween-only-movement).

   ROUNDS 2–3 (2026-10-09): the chain across the full width with its table
   under it, messages slowed to 1.7 s; then, from `_lab/message-passing-
   motion-mock.html` (his picks, all the recommendation, after a look at
   Distill's two GNN articles, CS224W's computation graph and Kipf &
   Welling's stacked-graph figure), Transform MOVES — on the chain every
   node's sum drops into one stack, crosses the one W a column at a time,
   passes ELU and rises back to its node; on caffeine the picked row crosses
   W inside its table — and Layers is a STACK of sheets with the cone and a
   cloud of the receptive field on layer 0, to three layers, the likeness
   drawing and the curve under it going on to eight.

   Nothing trains in the page: compute() runs the layers on seeded weights
   (core's rng, seed 1) and the trained α is data. Presses reveal what
   compute() holds (invariant 2). Every control is display, so none resets
   another page's presses; Example restarts Aggregate's own (`rebuild`).
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { CAFFEINE, ACIDS, X_MEAN, X_SD, FILE_SPREAD, FILE_N, ALPHA, GAT_RUN } from "./data.js";

const PAGES = [{ value: "aggregate", label: "Aggregate" }, { value: "layers", label: "Layers" }, { value: "readout", label: "Readout" }];
const EXAMPLES = [{ value: "chain", label: "Chain" }, { value: "caffeine", label: "Caffeine" }];
const LAYERS = [{ value: "gcn", label: "GCN" }, { value: "gat", label: "GAT" }];
const WEIGHTS = [{ value: "untrained", label: "Untrained" }, { value: "trained", label: "Trained" }];
const POOLS = [{ value: "sum", label: "Sum" }, { value: "mean", label: "Mean" }, { value: "max", label: "Max" }];
const ON = (page) => ({ param: "page", equals: page });
const ATOM_OPTS = CAFFEINE.atoms.map((a, i) => ({ value: String(i), label: `${i} · ${a.el}` }));
const CHAIN_OPTS = ["0", "1", "2"].map((v) => ({ value: v, label: v }));

/* his figure's chain: three nodes, three features each (illustrative values) */
const CHAIN = {
  name: "chain",
  atoms: [[0.2, 0.8, 0.5], [0.8, 0.4, 0.8], [0.9, 0.2, 0.8]].map((x, i) => ({ el: String(i), x, xy: [i, 0] })),
  bonds: [[0, 1, "SINGLE"], [1, 2, "SINGLE"]],
};
const STEPS = { aggregate: 2, layers: 8, readout: 3 };
const K_MAX = 8, HIDDEN = 16, LESSON_LAYERS = 2;
const COLS5 = ["Z", "ar", "hyb", "H", "q"];

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A graph neural network layer updates each node from its neighbours and itself: GCN weights the neighbours by their degrees, GAT learns the weights. " +
    "After k layers a node has gathered from every node within k edges, and with more layers the nodes' vectors become alike. A readout pools them into one vector for the graph.",
  pageLabel: "Step",
  exampleLabel: "Example",
  exampleDetail: "three nodes in a line, with illustrative features, or caffeine with its atoms' features from the molecule's x",
  nodeLabel: "Node",
  nodeDetail: "the node whose update is drawn; a click on a node picks it too",
  atomLabel: "Atom",
  atomDetail: "the atom whose update is drawn; a click on an atom picks it too",
  layerLabel: "Layer",
  layerDetail: "GCN weights each input by 1/√(dᵢ dⱼ), set by the two degrees; GAT weights it by α, a softmax over the inputs that training sets",
  weightsLabel: "Weights",
  weightsDetail: "GAT's α at initialisation, or after the lesson's GATNet was trained on its 2,335 molecules: layer 1, the mean of its four heads",
  fromLabel: "Atom",
  fromDetail: "the atom whose reach is drawn; a click on an atom picks it too",
  poolLabel: "Pooling",
  poolDetail: "how the atoms' vectors become one: the sum, the mean or the largest value of each number; the lesson pools with max",

  stepLabel: {
    param: "page",
    labels: {
      aggregate: { anim: "beat", labels: { 0: "Aggregate", 1: "Transform" }, default: "Transform" },
      layers: "Add a layer",
      readout: { anim: "beat", labels: { 0: "Add a layer", 1: "Add a layer", 2: "Pool" }, default: "Pool" },
    },
    default: "Add a layer",
  },
  stepTitle: {
    param: "page",
    labels: {
      aggregate: { anim: "beat", labels: { 0: "Weight the picked node's inputs and sum them", 1: "Multiply the sum by W, then apply the activation" }, default: "Multiply the sum by W, then apply the activation" },
      layers: "Run one more layer on every atom",
      readout: { anim: "beat", labels: { 0: "Run one layer on both molecules", 1: "Run one layer on both molecules", 2: "Pool each molecule's atoms into one vector" }, default: "Pool each molecule's atoms into one vector" },
    },
    default: "Run one more layer on every atom",
  },

  /* Aggregate */
  capChain: "the graph · click a node",
  capMol: "the molecule · click an atom",
  capTable: (cols) => (cols === 5 ? "the picked node's inputs · rows of x" : "the picked node's inputs · rows of x"),
  headWeight: { gcn: "1/√(dᵢdⱼ)", gat: "α" },
  selfTag: "self",
  rowSum: "sum",
  rowW: "× W, then ELU",
  rowOut: (i) => `h${i}′`,
  aggStatus: [
    (u, i, d) => `${u} ${i} · ${d} neighbour${d === 1 ? "" : "s"} and itself`,
    (u, i, s) => `${u} ${i} · its inputs weighted and summed · the weights sum to ${s}`,
    (u, i) => `${u} ${i} · the sum × W, then ELU: h${i}′, its vector after one layer`,
  ],
  aggMoving: "every node sends its row along each of its edges, and to itself; each arrives scaled by its weight",
  trMoving: { chain: "every node's sum through the same W, then ELU", caffeine: "the sum times each column of W, then ELU" },
  wLabel: "W · one for every node",
  hwLabel: "= H·W",
  eluLabel: "ELU",
  layMoving: (k) => `layer ${k} · every atom sends its vector to each neighbour`,
  sheet0: "layer 0 · x",
  sheetK: (k) => `layer ${k}`,
  stackStop: (n) => `the stack is drawn to ${n} layers; the count, the likeness and the curve go on`,
  rdMoving: (k) => `layer ${k} · every atom sends its vector to each neighbour`,
  aggNote: {
    chain: "the same sum in any order of the inputs · every node does this at once in a layer",
    gcn: "the weight depends on the two degrees only: a double and a single bond between atoms of the same degrees weigh the same",
    untrained: "untrained, every α is close to 1/(inputs): GAT starts as an average",
    trained: "after training, α weights some inputs more · the lesson's GAT also reads the bond features, which GCN does not",
  },
  aggHover: (i, el, d) => `${el} · atom ${i} · degree ${d} · click to pick`,
  nodeHover: (i, d) => `node ${i} · degree ${d} · click to pick`,

  /* Layers */
  capReach: (n, N) => `gathered from: ${n} of ${N} atoms`,
  capAlike: (i) => `alike to atom ${i}`,
  keyLo: "unrelated",
  keyHi: "same direction",
  curveY: "atoms unlike",
  curveX: "layers",
  curveLesson: "the lesson's 2",
  layStatus: (k, i, n, N) => (k === 0 ? `no layer yet · atom ${i} holds only its own row of x` : `after ${k} layer${k === 1 ? "" : "s"} · atom ${i} has gathered from ${n} of ${N} atoms`),
  layNote: "likeness: the cosine of two atoms' vectors · unlike: 1 minus it, averaged over every pair of atoms",
  layHover: (i, el, hop) => `${el} · atom ${i} · ${hop} bond${hop === 1 ? "" : "s"} away · click to pick`,

  /* Readout */
  capAcid: (m, c) => `${m.name} · ${c} carbons · y ${m.y}`,
  capTally: { sum: "sum keeps how many atoms share each vector", mean: "mean keeps each vector's share of the atoms", max: "max keeps which vectors occur" },
  rdStatus: [
    "no layer yet · atoms with the same row of x share a colour",
    "after 1 layer · atoms with the same vector share a colour",
    "after 2 layers, the lesson's · atoms with the same vector share a colour",
    "pooled · one vector for each molecule",
  ],
  rdVerdict: { same: "the two pooled vectors are identical", differ: (d) => `the two pooled vectors differ, by up to ${d}` },
  rdNote: { same: "a model reading these pooled vectors gives both molecules the same prediction", differ: "a model reading these pooled vectors can tell the two molecules apart", wait: "suberic acid has one CH₂ fewer than azelaic acid; neither stopped E. coli growing in the screen" },

  /* tiles */
  tileInputs: "Inputs",
  tileInputsNote: (d) => `its ${d} neighbour${d === 1 ? "" : "s"} and itself: GCNConv and GATConv add a self-loop to every node`,
  tileSum: "Weights sum to",
  tileSumNote: { gcn: "1/√(dᵢ dⱼ) sums to 1 only when every input has the node's own degree", gat: "a softmax over the inputs, so α sums to 1", chain: "1/√(dᵢ dⱼ) sums to 1 only when every input has the node's own degree" },
  tileTop: "Largest weight",
  tileTopNote: {
    gcn: "GCN favours the input with the fewest bonds",
    untrained: "untrained: the largest α is close to the others",
    trained: (agree) => `learned on the lesson's file; two more training runs give the same top input for ${agree} of caffeine's 14 atoms`,
  },
  tileLayers: "Layers",
  tileLayersNote: "the lesson's GCN and GAT stack 2",
  tileReach: "Gathered from",
  tileReachNote: (d) => `the atoms within k bonds; caffeine's longest shortest path is ${d} bonds`,
  tileUnlike: "Atoms unlike",
  tileUnlikeNote: (v0) => `the mean cosine distance between atoms: ${v0} before any layer, 0 when every vector points the same way`,
  tileRun: "Layers run",
  tileRunNote: "the lesson's GCN runs 2 before it pools",
  tileClasses: "Distinct vectors",
  tileClassesNote: "across both molecules: atoms that have gathered the same neighbourhood carry the same vector",
  tilePooled: "Pooled vectors",
  tilePooledNote: { sum: "sum counts the atoms of each kind", mean: "mean weighs each kind by its share", max: "max takes the largest value of each number" },
  tileWait: "—",

  sumAgg: (ex, i, beat) => `${ex === "chain" ? "a three-node chain, node" : "caffeine, atom"} ${i}'s inputs${beat >= 1 ? ", weighted and summed" : ""}${beat >= 2 ? ", then multiplied by W and passed through ELU" : ""}`,
  sumLay: (k, i, n) => `caffeine after ${k} layer${k === 1 ? "" : "s"}: atom ${i} has gathered from ${n} of 14 atoms, and the atoms' vectors grow alike`,
  sumRd: (beat, pool, same) => (beat < 3 ? `suberic and azelaic acid after ${beat} layer${beat === 1 ? "" : "s"}, atoms coloured by their vectors` : `suberic and azelaic acid, ${pool}-pooled: ${same ? "identical vectors" : "different vectors"}`),
};

/* ------------------------------------------------------ drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ramp = (colors, t) => { const a = rgb(colors.surface3), b = rgb(colors.magnitude); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };

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
/** a node: a filled circle with its name in the middle */
function node(ctx, colors, x, y, r, name, { fill = null, stroke = null, lw = 1.4 } = {}) {
  dot(ctx, x, y, r, fill ?? colors.surface, stroke ?? colors.ink1, lw);
  txt(ctx, colors, name, x, y + 0.5, { font: nodeFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
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
   number order), each one's weight, the weighted sum and the transformed
   row. GAT's α comes from data.js, indexed by where each input came from. */
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

/* THE ACIDS' CLASSES, layer by layer: atoms whose vectors are identical
   share a class. A class that splits passes its colour to the first of its
   children (in atom order, suberic then azelaic) and the others take the
   next free colour, so a press recolours only what it divides. */
function acidClasses(Hs) {
  const out = [];
  let prevClass = null, prevColour = null;
  for (let k = 0; k < Hs[0].length; k++) {
    const reps = [], cls = [[], []];
    Hs.forEach((layers, q) => layers[k].forEach((h) => {
      let c = reps.findIndex((r) => r.every((v, t) => Math.abs(v - h[t]) < 1e-9));
      if (c < 0) { reps.push(h); c = reps.length - 1; }
      cls[q].push(c);
    }));
    const colour = new Array(reps.length).fill(null);
    if (prevClass) {
      const used = new Set(), parentOf = new Array(reps.length);
      cls.forEach((row, q) => row.forEach((c, a) => { parentOf[c] = prevClass[q][a]; }));
      for (let c = 0; c < reps.length; c++) {
        const pc = prevColour[parentOf[c]];
        if (!used.has(pc)) { colour[c] = pc; used.add(pc); }
      }
      let free = 0;
      for (let c = 0; c < reps.length; c++) if (colour[c] == null) { while (used.has(free)) free += 1; colour[c] = free; used.add(free); }
    } else for (let c = 0; c < reps.length; c++) colour[c] = c;
    out.push({ cls, colour, n: reps.length });
    prevClass = cls; prevColour = colour;
  }
  return out;
}
function pool(H, kind) {
  return H[0].map((_, k) => {
    const c = H.map((r) => r[k]);
    return kind === "max" ? Math.max(...c) : kind === "sum" ? c.reduce((s, v) => s + v, 0) : c.reduce((s, v) => s + v, 0) / c.length;
  });
}

function compute({ params, rng }) {
  /* the weights, drawn in one fixed order whatever the parameters, so a
     control never changes a number it does not concern */
  const Wchain = glorot(rng, 3, 3), Wcaf = glorot(rng, 5, 5);
  const Wlay = [...Array(K_MAX).keys()].map((k) => glorot(rng, k === 0 ? 5 : HIDDEN, HIDDEN));
  const Wrd = [0, 1].map((k) => glorot(rng, k === 0 ? 5 : HIDDEN, HIDDEN));

  /* Aggregate */
  const chainP = gcnP(adjacency(CHAIN)), cafA = adjacency(CAFFEINE), cafP = gcnP(cafA);
  const caf = params.example === "caffeine";
  /* EVERY node's update, since a layer updates all of them at once (round 1,
     2026-10-09: his "aggregation of everything"); the picked one is the close-up */
  const all = caf
    ? CAFFEINE.atoms.map((_, i) => aggregateOf(CAFFEINE, i, params.layer, params.weights, cafP, Wcaf))
    : CHAIN.atoms.map((_, i) => aggregateOf(CHAIN, i, "gcn", "untrained", chainP, Wchain));
  const agg = all[Number(caf ? params.atom : params.node)];
  /* the messages: one along each edge each way, weighted as its receiver weighs it */
  const msgs = all.flatMap((u) => u.inputs.slice(1).map((s, k) => ({ s, r: u.i, w: u.w[k + 1] })));

  /* Layers: the five columns standardised with the file's statistics */
  const X = CAFFEINE.atoms.map((a) => a.x.map((v, c) => (v - X_MEAN[c]) / (X_SD[c] || 1)));
  const H = stack(cafP, X, Wlay);
  const from = Number(params.from);
  const hops = hopsFrom(cafA, from);
  const likeness = H.map((Hk) => Hk.map((h) => cosine(h, Hk[from])));
  const unlike = H.map(spread);
  const diameter = Math.max(...CAFFEINE.atoms.map((_, s) => Math.max(...hopsFrom(cafA, s))));

  /* Readout: both acids through the same two layers */
  const acidH = ACIDS.map((m) => stack(gcnP(adjacency(m)), m.atoms.map((a) => a.x), Wrd));
  const classes = acidClasses(acidH);
  const pooled = Object.fromEntries(POOLS.map(({ value }) => {
    const [a, b] = acidH.map((Hs) => pool(Hs[LESSON_LAYERS], value));
    return [value, { a, b, diff: Math.max(...a.map((v, k) => Math.abs(v - b[k]))) }];
  }));

  /* the GCN messages on the Layers and Readout pages, each sized by its weight */
  const gcnMsgs = (A, P) => A.flatMap((row, r) => row.map((v, s) => (v ? { s, r, w: P[r][s] } : null)).filter(Boolean));
  const layMsgs = gcnMsgs(cafA, cafP);
  const acidMsgs = ACIDS.map((m) => { const A = adjacency(m); return gcnMsgs(A, gcnP(A)); });

  /* one colour scale for every row the Aggregate page draws: x, the sums, h·W, h′ —
     so a row keeps its colours as it travels and lands */
  const vals = [...(caf ? [] : CHAIN.atoms.map((a) => a.x)), ...all.flatMap((u) => [u.sum, u.pre, u.out])].flat();
  const aggScale = [Math.min(0, ...vals), Math.max(1, ...vals)];
  const nbrs = cafA.map((r) => r.map((v, j) => (v ? j : -1)).filter((j) => j >= 0));
  return { nbrs, agg, all, msgs, Wagg: caf ? Wcaf : Wchain, aggScale, H, hops, likeness, unlike, diameter, classes, pooled, layMsgs, acidMsgs, agreeTop: GAT_RUN.agree };
}

/* ============================================================ animation */

/* THE MOTION (round 1): a press that runs a layer sends a message along every
   edge, both ways at once, each way in its own lane so no two cross; it lands
   and the figure switches to the new state at once (no fades). Transform and
   Pool change no positions, so they switch without motion. */
const MOVE_MS = 1700;   /* slowed on his word, round 2 */
const stepsOf = (stage) => STEPS[stage] ?? 0;
/* ROUND 3: Transform moves too (every node's row through one W, his pick C),
   and a layer drawn on the stack has three phases (the sheet, the messages,
   the cloud) */
const STACK_MAX = 3;
function durOf(stage, beat, params) {
  if (stage === "aggregate") return beat === 1 ? MOVE_MS : params.example === "chain" ? 5200 : 3600;
  if (stage === "layers") return beat <= STACK_MAX ? 2600 : MOVE_MS;
  return beat <= LESSON_LAYERS ? MOVE_MS : 0;
}
/** the raw progress of the press in flight, for animations with phases; null when settled */
const phase = (anim, stage) => (anim.stage === stage && anim.t < 1 ? anim.t : null);
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
/** the settled beat: while a press is in flight, the state before it */
const shownStep = (anim, stage) => (anim.n[stage] ?? 0) - (anim.stage === stage && anim.t < 1 ? 1 : 0);
/** how far the messages in flight have gone, eased; null when nothing moves */
const flight = (anim, stage) => {
  if (anim.stage !== stage || anim.t >= 1) return null;
  const t = anim.t;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

/* ONE MESSAGE MOVER for the three pages. Straight bonds: the message rides a
   lane 4 px to one side of the bond, the side set by its direction, from the
   sender's rim to the receiver's. `mark` draws it; the default is a dot sized
   by the weight. */
function drawMessages(ctx, colors, P, msgs, u, { r = 11, pick = null, mark = null } = {}) {
  for (const m of msgs) {
    const [ax, ay] = P[m.s], [bx, by] = P[m.r], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, side = m.s < m.r ? 1 : -1, nx = -uy * 4 * side, ny = ux * 4 * side;
    const x0 = ax + ux * r, y0 = ay + uy * r, x1 = bx - ux * r, y1 = by - uy * r;
    const x = x0 + (x1 - x0) * u + nx, y = y0 + (y1 - y0) * u + ny;
    if (mark) mark(x, y, m);
    else dot(ctx, x, y, 2 + 7 * m.w, m.r === pick ? colors.highlight : colors.groupA, colors.surface, 1);
  }
}

/* ------------------------------------------------ Transform's pieces */

/** a row of cells on the page's one scale */
function cellRow(ctx, colors, x, y, row, c, scale, { stroke = null, lw = 1, ch = c } = {}) {
  row.forEach((v, k) => rect(ctx, x + k * c, y, c, ch, ramp(colors, (v - scale[0]) / (scale[1] - scale[0])), stroke ?? colors.ink1, lw));
}
/** the ELU curve in a small box, the activation's own shape */
function eluIcon(ctx, colors, x, y, w = 48, h = 40) {
  rect(ctx, x, y, w, h, colors.surface2, colors.grid);
  const sx = (v) => x + 4 + ((v + 2) / 3.2) * (w - 8), sy = (v) => y + h - 6 - ((v + 1) / 2.2) * (h - 12);
  ctx.save(); ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let q = 0; q <= 30; q++) { const v = -2 + (3.2 * q) / 30, e = v > 0 ? v : Math.expm1(v); q ? ctx.lineTo(sx(v), sy(e)) : ctx.moveTo(sx(v), sy(e)); }
  ctx.stroke(); ctx.restore();
  txt(ctx, colors, S.eluLabel, x + w / 2, y - 5, { fill: colors.ink3, align: "center" });
}

/* THE CHAIN'S TRANSFORM (round 3, his pick C from `_lab/message-passing-
   motion-mock.html`): the band between the drawing and the table holds W and
   the ELU gate. A press drops the three sums into one stack H (0–0.22), W's
   columns light one at a time while H·W fills a column at a time (0.24–0.58),
   H·W slides through ELU (0.60–0.76) and each row rises back to its own
   node, one at a time, node 2 first (0.78–1): rising together, the top row's
   path crossed the bottom one's (tweens-move-in-lanes). */
const BAND = { hy: 240, c: 22, cW: 34 };
function chainBand(w) {
  const hx = 24, wX = hx + 3 * BAND.c + 30;
  return { hx, wX, oX: wX + 3 * BAND.cW + 28, eluX: w - 150, finX: w - 84 };
}
function chainSlot(P, i) { return [P[i][0] - 45, P[i][1] - 78]; }
function drawChainBand(ctx, colors, w, st, P, t) {
  const b = chainBand(w), W = st.Wagg, sc = st.aggScale, c = BAND.c, hy = BAND.hy;
  const col = t != null && t > 0.24 && t < 0.58 ? Math.min(2, Math.floor(seg(t, 0.24, 0.58) * 3)) : -1;
  txt(ctx, colors, S.wLabel, b.wX, hy - 8, { fill: colors.ink3 });
  W.forEach((r, i) => r.forEach((v, k) => {
    rect(ctx, b.wX + k * BAND.cW, hy + i * c, BAND.cW, c, k === col ? wash(colors.highlight, 0.3) : colors.surface2, colors.grid);
    txt(ctx, colors, fmt(v), b.wX + k * BAND.cW + BAND.cW / 2, hy + i * c + c / 2 + 1, { font: monoFont(colors), fill: k === col ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  }));
  eluIcon(ctx, colors, b.eluX, hy + 4);
  if (t == null) return;
  txt(ctx, colors, "H", b.hx + 1.5 * c, hy - 8, { fill: colors.ink3, align: "center" });
  txt(ctx, colors, "×", b.wX - 15, hy + 1.5 * c + 4, { font: capFont(colors), fill: colors.ink2, align: "center" });
  const p1 = ease(seg(t, 0, 0.22)), p2 = seg(t, 0.24, 0.58), p3 = ease(seg(t, 0.6, 0.76));
  for (let i = 0; i < 3; i++) {
    const u = st.all[i], [sx, sy] = chainSlot(P, i), ty = hy + i * c;
    if (t < 0.24) { cellRow(ctx, colors, lerp(sx, b.hx, p1), lerp(sy, ty, p1), u.sum, lerp(30, c, p1), sc); continue; }
    cellRow(ctx, colors, b.hx, ty, u.sum, c, sc, { stroke: colors.grid });
    if (t < 0.78) {
      const done = t < 0.58 ? Math.min(3, Math.floor(p2 * 3 + 1e-9)) : 3;
      const ox = t < 0.6 ? b.oX : lerp(b.oX, b.finX, p3), row = t < 0.68 ? u.pre : u.out;
      row.forEach((v, k) => rect(ctx, ox + k * c, ty, c, c, k < done ? ramp(colors, (v - sc[0]) / (sc[1] - sc[0])) : null, colors.ink2));
    } else {
      const q = ease(seg(t, 0.78 + (2 - i) * 0.073, 0.78 + (3 - i) * 0.073));
      cellRow(ctx, colors, lerp(b.finX, sx, q), lerp(ty, sy, q), u.out, lerp(c, 30, q), sc, { stroke: i === st.agg.i ? colors.highlight : null, lw: i === st.agg.i ? 1.6 : 1 });
    }
  }
  if (t >= 0.24 && t < 0.6) txt(ctx, colors, S.hwLabel, b.oX, hy - 8, { fill: colors.ink3 });
}

/* CAFFEINE'S TRANSFORM: the picked atom's row only (14 rows do not fit a
   stack), inside its table. W sits under the sum row, one column of W under
   each column of the table; a press lights W's columns in turn and fills h·W
   a cell at a time (0–0.6), then the row moves down past the ELU gate into
   the h′ row (0.62–1). */
function drawCafTransform(ctx, colors, st, g, t, beat) {
  const a = st.agg, W = st.Wagg, sc = st.aggScale, cols = W.length;
  const wy = g.yS + 30, rh = 11, preY = wy + cols * rh + 8, outY = preY + 40;
  const col = t != null && t < 0.6 ? Math.min(cols - 1, Math.floor(seg(t, 0, 0.6) * cols)) : -1;
  const wvals = W.flat(), wlo = Math.min(...wvals), whi = Math.max(...wvals);
  txt(ctx, colors, "W", g.x0, wy + (cols * rh) / 2 + 3, { font: boldMono(colors), fill: colors.ink3 });
  W.forEach((r, q) => r.forEach((v, k) => rect(ctx, g.colX(k) + 1, wy + q * rh, g.cw - 2, rh, k === col ? wash(colors.highlight, 0.45) : ramp(colors, (v - wlo) / (whi - wlo)), colors.grid)));
  txt(ctx, colors, S.eluLabel, g.x0, (preY + outY) / 2 + 12, { fill: colors.ink3 });
  if (t != null && beat === 1) {
    const done = Math.min(cols, Math.floor(seg(t, 0, 0.6) * cols + 1e-9));
    const m = ease(seg(t, 0.62, 1)), y = lerp(preY, outY, m), row = m < 0.5 ? a.pre : a.out;
    row.forEach((v, k) => { if (t >= 0.6 || k < done) rect(ctx, g.colX(k) + 1, y, g.cw - 2, 16, ramp(colors, (v - sc[0]) / (sc[1] - sc[0])), colors.highlight, 1.4); });
    return;
  }
  if (beat >= 2) {
    txt(ctx, colors, S.rowOut(a.i), g.x0, outY + 9, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    a.out.forEach((v, k) => txt(ctx, colors, fmt(v, 1), g.colX(k) + g.cw / 2, outY + 9, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" }));
  }
}

/* ============================================================ geometry */

const H_CHAIN = 564, H_CAF = 344, H_LAY = 530, H_RD = 400;
const leftW = (w) => Math.min(w * 0.47, 330);
const AG = { top: 34, boxH: 250, rowH: 24 };
/** where the chain's nodes and caffeine's atoms sit on the Aggregate page */
function aggPoints(params, w) {
  if (params.example === "chain") {
    /* round 2: the chain across the whole width, its table under it */
    return [0, 1, 2].map((i) => [w * (0.17 + 0.33 * i), AG.top + 120]);
  }
  return molPoints(CAFFEINE, 16, AG.top + 8, leftW(w) - 28, AG.boxH);
}
const RD = { top: 18, rowH: 104, boxH: 66, tallyTop: 236 };
/** both acids at one scale, so a bond is one length in each and the extra CH₂ is one more step */
function acidPoints(w) {
  const span = (m, k) => Math.max(...m.atoms.map((a) => a.xy[k])) - Math.min(...m.atoms.map((a) => a.xy[k]));
  const s = Math.min(46, ...ACIDS.map((m) => Math.min((w - 40) / span(m, 0), RD.boxH / span(m, 1))));
  return ACIDS.map((m, q) => molPoints(m, 20, RD.top + 22 + q * RD.rowH, w - 40, RD.boxH, s));
}

/* ============================================================ Aggregate */

function drawAggregate(ctx, colors, w, h, params, st, anim, pointer) {
  const chain = params.example === "chain", mol = chain ? CHAIN : CAFFEINE;
  const beat = shownStep(anim, "aggregate"), a = st.agg, kind = chain ? "gcn" : params.layer;
  /* Transform in flight: its raw progress, for the phases */
  const tr = anim.n.aggregate === 2 ? phase(anim, "aggregate") : null;
  /* the messages move only on the Aggregate press */
  const msgU = anim.n.aggregate === 1 ? flight(anim, "aggregate") : null;
  const P = aggPoints(params, w), A = adjacency(mol);
  const nb = new Set(a.inputs.slice(1));
  let hov = null;
  if (pointer) P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= (chain ? 21 : 13)) hov = i; });

  txt(ctx, colors, chain ? S.capChain : S.capMol, 12, 16, { font: capFont(colors), fill: colors.ink1, maxW: leftW(w) - 16 });
  /* after Aggregate a bond's width is its weight; the numbers are in the table */
  const thick = (j) => (beat >= 1 ? 1 + 12 * a.w[a.inputs.indexOf(j)] : 2);
  if (chain) {
    /* his figure: arcs between the nodes, each node's row of features above it */
    for (const [i, j] of mol.bonds) {
      const into = beat >= 1 && (i === a.i || j === a.i), other = i === a.i ? j : i;
      ctx.save(); ctx.strokeStyle = into ? colors.highlight : colors.ink1; ctx.lineWidth = into ? thick(other) : 1.6;
      ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.quadraticCurveTo((P[i][0] + P[j][0]) / 2, P[i][1] - 28, P[j][0], P[j][1]); ctx.stroke(); ctx.restore();
    }
    /* every node's row: x, then after Aggregate its sum, after Transform its h′ —
       all three nodes at once, as a layer does; one scale for each row of rows */
    const rows = beat === 0 ? mol.atoms.map((at) => at.x) : st.all.map((u) => (beat === 1 ? u.sum : u.out));
    /* while Transform runs, the rows are in the band, not on the nodes */
    if (tr == null) rows.forEach((row, i) => {
      const [x0, y0] = chainSlot(P, i);
      cellRow(ctx, colors, x0, y0, row, 30, st.aggScale);
      txt(ctx, colors, row.map((v) => fmt(v, beat === 0 ? 1 : 2)).join(" "), P[i][0], y0 - 6, { font: monoFont(colors), fill: colors.ink3, align: "center" });
    });
    drawChainBand(ctx, colors, w, st, P, tr);
    const u = msgU;
    if (u != null) {
      /* each node's row travels along its own lane: rightward above the edge,
         leftward below it, and round its own self-loop */
      const mini = (x, y, row, wgt, toPick) => {
        const c = 8 + 10 * wgt;
        row.forEach((v, k) => rect(ctx, x - 1.5 * c + k * c, y - c / 2, c, c, ramp(colors, v), toPick ? colors.highlight : colors.ink1, toPick ? 1.6 : 1));
      };
      for (const m of st.msgs) {
        const [ax, ay] = P[m.s], [bx] = P[m.r], dir = Math.sign(bx - ax);
        const cy = ay + (dir > 0 ? -54 : 40), sx = ax + dir * 22, ex = bx - dir * 22;
        const x = (1 - u) ** 2 * sx + 2 * (1 - u) * u * ((sx + ex) / 2) + u * u * ex;
        const y = (1 - u) ** 2 * ay + 2 * (1 - u) * u * cy + u * u * ay;
        mini(x, y, mol.atoms[m.s].x, m.w, m.r === a.i);
      }
      st.all.forEach((v) => {
        const th = -Math.PI / 2 + 2 * Math.PI * u, [x, y] = P[v.i];
        mini(x + 13 * Math.cos(th), y + 33 + 13 * Math.sin(th), mol.atoms[v.i].x, v.w[0], v.i === a.i);
      });
    }
    if (beat >= 1) {
      /* the self-loop, as his figure draws it */
      ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = thick(a.i);
      ctx.beginPath(); ctx.arc(P[a.i][0], P[a.i][1] + 33, 13, -0.15 * Math.PI, 1.15 * Math.PI); ctx.stroke(); ctx.restore();
      a.inputs.forEach((j, k) => {
        const [x, y] = j === a.i ? [P[j][0], P[j][1] + 64] : [(P[j][0] + P[a.i][0]) / 2, P[j][1] - 30];
        txt(ctx, colors, (j === a.i ? `${S.selfTag} ` : "") + fmt(a.w[k]), x, y, { font: boldMono(colors), fill: colors.ink1, align: "center", halo: true });
      });
    }
  } else {
    mol.bonds.forEach(([i, j, type]) => {
      const into = beat >= 1 && (i === a.i || j === a.i), other = i === a.i ? j : i;
      bond(ctx, P[i], P[j], type, into ? colors.highlight : i === a.i || j === a.i ? colors.ink1 : colors.ink3, into ? thick(other) : 1.4);
    });
  }
  const uMol = chain ? null : msgU;
  mol.atoms.forEach((at, i) => {
    const fill = i === a.i ? wash(colors.highlight, 0.35) : nb.has(i) ? wash(colors.groupA, 0.32) : hov === i ? wash(colors.groupA, 0.15) : null;
    node(ctx, colors, P[i][0], P[i][1], chain ? 20 : 11, chain ? String(i) : at.el, { fill });
    if (!chain) txt(ctx, colors, String(i), P[i][0] + 12, P[i][1] - 9, { font: monoFont(colors), fill: colors.ink3, halo: true });
  });
  ring(ctx, P[a.i][0], P[a.i][1], chain ? 27 : 17, colors.highlight);
  if (uMol != null) drawMessages(ctx, colors, P, st.msgs, uMol, { pick: a.i });

  /* the table: the inputs' rows, their weights, the sum, the transformed row */
  const x0 = chain ? 12 : leftW(w) + 8, ty = chain ? 318 : 0, cols = mol.atoms[0].x.length, labW = 58;
  const cw = Math.min(chain ? 44 : 34, (w - x0 - labW - 70 - 8) / cols), wx = x0 + labW + cols * cw + 8;
  const right = chain ? wx + 64 : w - 4;
  txt(ctx, colors, S.capTable(cols), x0, ty + 16, { font: capFont(colors), fill: colors.ink1, maxW: w - x0 - 8 });
  const heads = chain ? ["0", "1", "2"] : COLS5;
  heads.forEach((hd, c) => txt(ctx, colors, hd, x0 + labW + c * cw + cw / 2, ty + 40, { font: monoFont(colors), fill: colors.ink3, align: "center" }));
  txt(ctx, colors, S.headWeight[kind], wx + 30, ty + 40, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  a.inputs.forEach((j, k) => {
    const y = ty + 48 + k * AG.rowH, mid = y + AG.rowH / 2;
    if (j === a.i) rect(ctx, x0 - 4, y + 1, right - x0, AG.rowH - 2, wash(colors.highlight, 0.14));
    else rect(ctx, x0 - 4, y + 1, right - x0, AG.rowH - 2, wash(colors.groupA, 0.12));
    txt(ctx, colors, `${j}${chain ? "" : " " + mol.atoms[j].el}${j === a.i ? " " + S.selfTag : ""}`, x0, mid, { font: monoFont(colors), fill: colors.ink1, baseline: "middle" });
    mol.atoms[j].x.forEach((v, c) => txt(ctx, colors, chain ? v.toFixed(1) : String(v), x0 + labW + c * cw + cw / 2, mid, { font: monoFont(colors), fill: colors.ink2, align: "center", baseline: "middle" }));
    if (beat >= 1) txt(ctx, colors, `× ${fmt(a.w[k])}`, wx + 30, mid, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  });
  const yS = ty + 48 + a.inputs.length * AG.rowH + 4;
  if (beat >= 1) {
    line(ctx, x0 - 4, yS, right - 4, yS, colors.ink2);
    txt(ctx, colors, S.rowSum, x0, yS + 14, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    a.sum.forEach((v, c) => txt(ctx, colors, fmt(v, chain ? 2 : 1), x0 + labW + c * cw + cw / 2, yS + 14, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" }));
  }
  if (chain && beat >= 2) {
    txt(ctx, colors, S.rowW, x0, yS + 40, { fill: colors.ink3, baseline: "middle" });
    txt(ctx, colors, S.rowOut(a.i), x0, yS + 64, { font: boldMono(colors), fill: colors.ink1, baseline: "middle" });
    a.out.forEach((v, c) => txt(ctx, colors, fmt(v, 2), x0 + labW + c * cw + cw / 2, yS + 64, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" }));
  }
  if (!chain) drawCafTransform(ctx, colors, st, { x0, yS, cw, colX: (k) => x0 + labW + k * cw }, tr, beat);

  if (hov != null) hoverLabel(ctx, colors, chain ? S.nodeHover(hov, A[hov].reduce((s, v) => s + v, 0)) : S.aggHover(hov, mol.atoms[hov].el, A[hov].reduce((s, v) => s + v, 0)), P[hov][0], P[hov][1], w);
  const u = chain ? "node" : "atom";
  const status = tr != null ? S.trMoving[params.example] : msgU != null ? S.aggMoving : beat === 0 ? S.aggStatus[0](u, a.i, a.deg) : beat === 1 ? S.aggStatus[1](u, a.i, fmt(a.w.reduce((s, v) => s + v, 0))) : S.aggStatus[2](u, a.i);
  txt(ctx, colors, status, 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, chain ? S.aggNote.chain : kind === "gcn" ? S.aggNote.gcn : S.aggNote[params.weights], 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
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
   (0.75–1). The stack is drawn to STACK_MAX layers (his pick 3.3 A); past it
   the press goes on in the likeness drawing and the curve under it. */
const ST = { s: 38, gx: 0.55, gy: 0.34, base: 310, gap: 70, pad: 16 };
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
  txt(ctx, colors, level === 0 ? S.sheet0 : S.sheetK(level), cs[0][0] - 6, (cs[0][1] + cs[3][1]) / 2 + 4, { fill: colors.ink3, align: "right" });
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
const LY = { top: 344, boxH: 118, curveTop: 348, curveH: 92 };
const flatPts = (w) => molPoints(CAFFEINE, 12, LY.top + 8, w * 0.46 - 12, LY.boxH - 12, 40);

function drawLayers(ctx, colors, w, h, params, st, anim, pointer) {
  const k = shownStep(anim, "layers"), from = Number(params.from), N = CAFFEINE.atoms.length;
  const t = phase(anim, "layers"), kNew = anim.n.layers, inStack = t != null && kNew <= STACK_MAX;
  const within = (kk) => [...Array(N).keys()].filter((i) => st.hops[i] <= kk);
  const top = Math.min(inStack ? kNew : k, STACK_MAX);
  const drop = inStack ? (1 - ease(seg(t, 0, 0.25))) * 60 : 0;
  const pts = [...Array(top + 1).keys()].map((L) => sheetPts(w, L, L === top && inStack ? drop : 0));
  const PF = flatPts(w);
  let hov = null, hovP = null;
  if (pointer) for (const P of [PF, pts[top]]) P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 9) { hov = i; hovP = P; } });

  /* the sheets, bottom first */
  for (let L = 0; L <= top; L++) sheetOutline(ctx, colors, w, L, L === top && inStack ? drop : 0, L === top);
  /* the cloud on layer 0: the settled field, growing to the new one in the last phase */
  const kCloud = Math.min(inStack ? kNew : k, STACK_MAX), grow = new Map();
  if (inStack) within(kCloud).forEach((i) => { if (st.hops[i] === kCloud) grow.set(i, ease(seg(t, 0.75, 1))); });
  cloud(ctx, colors, pts[0], within(kCloud), 17, grow);
  /* the cone */
  const coneTop = inStack && t < 0.25 ? top - 1 : top;
  for (let L = 1; L <= coneTop; L++) for (const a of within(top - L)) for (const b of [a, ...st.nbrs[a]]) {
    line(ctx, pts[L - 1][b][0], pts[L - 1][b][1], pts[L][a][0], pts[L][a][1], wash(colors.groupA, 0.5), 1);
  }
  for (let L = 0; L <= top; L++) {
    CAFFEINE.bonds.forEach(([i, j]) => line(ctx, pts[L][i][0], pts[L][i][1], pts[L][j][0], pts[L][j][1], colors.grid, 1));
    CAFFEINE.atoms.forEach((_, i) => {
      const isPick = L === top && i === from, inCone = st.hops[i] <= top - L;
      dot(ctx, pts[L][i][0], pts[L][i][1], isPick ? 6 : 4, isPick ? colors.highlight : inCone ? colors.groupA : colors.surface, inCone || isPick ? null : colors.ink3, 1);
    });
  }
  ring(ctx, pts[top][from][0], pts[top][from][1], 10, colors.highlight);
  /* the messages rising through the cone, one sheet after another */
  if (inStack && t > 0.25 && t < 0.75) {
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
  const kSeen = inStack && t < 0.75 ? k : t != null ? kNew : k;
  txt(ctx, colors, S.capReach(within(kSeen).length, N), 12, 16, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  if (k > STACK_MAX || (t != null && kNew > STACK_MAX)) txt(ctx, colors, S.stackStop(STACK_MAX), 12, 32, { fill: colors.ink3, maxW: w - 24 });

  /* under the stack: the likeness drawing at the left */
  const kL = t != null && !inStack ? k : inStack && t < 0.75 ? k : t != null ? kNew : k;
  txt(ctx, colors, S.capAlike(from), 12, LY.top - 6, { font: capFont(colors), fill: colors.ink1, maxW: w * 0.46 });
  CAFFEINE.bonds.forEach(([i, j, type]) => bond(ctx, PF[i], PF[j], type, colors.ink3, 1.2));
  CAFFEINE.atoms.forEach((at, i) => node(ctx, colors, PF[i][0], PF[i][1], 8, at.el, { fill: ramp(colors, st.likeness[kL][i]), stroke: hov === i ? colors.groupA : null, lw: hov === i ? 2.4 : 1.2 }));
  ring(ctx, PF[from][0], PF[from][1], 13, colors.highlight);
  if (t != null && !inStack) drawMessages(ctx, colors, PF, st.layMsgs, ease(t), { r: 8, pick: from });
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
  const endR = kL >= K_MAX - 2;
  txt(ctx, colors, fmt(st.unlike[kL]), sx(kL) + (endR ? -8 : 8), sy(st.unlike[kL]) - 7, { font: boldMono(colors), fill: colors.ink1, halo: true, align: endR ? "right" : "left" });
  /* the two lines are named in the legend: a label on the curve collided with the value at k = 1 */

  if (hov != null) hoverLabel(ctx, colors, S.layHover(hov, CAFFEINE.atoms[hov].el, st.hops[hov]), hovP[hov][0], hovP[hov][1], w);
  txt(ctx, colors, t != null ? S.layMoving(kNew) : S.layStatus(k, from, within(k).length, N), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.layNote, 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
}

/* ============================================================== Readout */

function drawReadout(ctx, colors, w, h, params, st, anim) {
  const beat = shownStep(anim, "readout"), layer = Math.min(beat, LESSON_LAYERS), cl = st.classes[layer];
  const P = acidPoints(w), colour = (c) => colors.clusters[cl.colour[c] % colors.clusters.length];
  ACIDS.forEach((m, q) => {
    txt(ctx, colors, S.capAcid(m, m.atoms.filter((a) => a.el === "C").length), 12, RD.top + 4 + q * RD.rowH, { font: capFont(colors), fill: colors.ink1 });
    m.bonds.forEach(([i, j, type]) => bond(ctx, P[q][i], P[q][j], type, colors.ink2, 1.4));
    m.atoms.forEach((a, i) => node(ctx, colors, P[q][i][0], P[q][i][1], 10, a.el, { fill: wash(colour(cl.cls[q][i]), 0.6) }));
  });
  const uR = flight(anim, "readout");
  if (uR != null && beat < LESSON_LAYERS) P.forEach((Pq, q) => drawMessages(ctx, colors, Pq, st.acidMsgs[q], uR, { r: 10 }));

  const y0 = RD.tallyTop, pk = params.pooling;
  if (beat >= 3) {
    txt(ctx, colors, S.capTally[pk], 12, y0, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
    const tw = w - 110;
    ACIDS.forEach((m, q) => {
      const y = y0 + 14 + q * 40, n = cl.cls[q].length;
      txt(ctx, colors, m.name.split(" ")[0], 12, y + 12, { fill: colors.ink2, baseline: "middle" });
      const counts = [...Array(cl.n).keys()].map((c) => cl.cls[q].filter((v) => v === c).length);
      const total = Math.max(...ACIDS.map((_, r) => cl.cls[r].length));
      let x = 86;
      counts.forEach((c, i) => {
        const v = pk === "max" ? (c > 0 ? 1 : 0) : pk === "mean" ? c / n : c;
        const bw = pk === "max" ? tw / cl.n : pk === "mean" ? v * tw : (v / total) * tw;
        if (bw <= 0) return;
        rect(ctx, x, y, bw - 2, 24, wash(colour(i), 0.7), colors.ink1);
        txt(ctx, colors, pk === "max" ? "✓" : pk === "mean" ? fmt(v) : String(c), x + bw / 2 - 1, y + 12.5, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" });
        x += bw;
      });
    });
    const p = st.pooled[pk], same = p.diff < 1e-9;
    txt(ctx, colors, same ? S.rdVerdict.same : S.rdVerdict.differ(fmt(p.diff, 3)), 12, y0 + 112, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
    txt(ctx, colors, same ? S.rdNote.same : S.rdNote.differ, 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
  } else txt(ctx, colors, S.rdNote.wait, 12, h - 11, { fill: colors.ink3, maxW: w - 24 });
  txt(ctx, colors, uR != null && beat < LESSON_LAYERS ? S.rdMoving(beat + 1) : S.rdStatus[beat], 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
}

/* ================================================================ widget */

defineWidget({
  slug: "message-passing",
  status: "draft",
  title: "Deep Learning - Graphs: Message Passing",
  subtitle: S.subtitle,
  /* caffeine and the two acids are rows of the lesson's file, as 94's six are */
  credit: "Molecule data: Stokes et al., Cell 2020, via FinGAT",
  layout: "side",
  height: (params) => (params.page === "layers" ? H_LAY : params.page === "readout" ? H_RD : params.example === "chain" ? H_CHAIN : H_CAF),
  pointer: true,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "aggregate", display: true },
    example: { type: "segmented", label: S.exampleLabel, detail: S.exampleDetail, options: EXAMPLES, default: "chain", display: true, when: ON("aggregate") },
    node: { type: "segmented", label: S.nodeLabel, detail: S.nodeDetail, options: CHAIN_OPTS, default: "1", display: true, when: { all: [ON("aggregate"), { param: "example", equals: "chain" }] } },
    atom: { type: "select", label: S.atomLabel, detail: S.atomDetail, options: ATOM_OPTS, default: "1", display: true, when: { all: [ON("aggregate"), { param: "example", equals: "caffeine" }] } },
    layer: { type: "segmented", label: S.layerLabel, detail: S.layerDetail, options: LAYERS, default: "gcn", display: true, when: { all: [ON("aggregate"), { param: "example", equals: "caffeine" }] } },
    weights: { type: "segmented", label: S.weightsLabel, detail: S.weightsDetail, options: WEIGHTS, default: "untrained", display: true, when: { all: [ON("aggregate"), { param: "example", equals: "caffeine" }, { param: "layer", equals: "gat" }] } },
    from: { type: "select", label: S.fromLabel, detail: S.fromDetail, options: ATOM_OPTS, default: "9", display: true, when: ON("layers") },
    pooling: { type: "segmented", label: S.poolLabel, detail: S.poolDetail, options: POOLS, default: "max", display: true, when: ON("readout") },
    /* authoring escape hatch, first render only: presses already made on the page the link opens */
    shown: { type: "int", min: 0, max: K_MAX, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "aggregate") return [{ token: "highlight", label: "The node updated", mark: "dot" }, { token: "group-a", label: "Its neighbours", mark: "dot" }];
    if (params.page === "layers") return [{ token: "group-a", label: "Gathered from", mark: "dot" }, { token: "empirical", label: "Caffeine", mark: "line" }, { token: "reference", label: `The file's ${FILE_N.toLocaleString("en")} molecules, mean`, mark: "dash" }];
    return [];
  },

  compute,

  regions: ({ w, params, anim }) => {
    if (params.page === "aggregate") {
      const P = aggPoints(params, w), key = params.example === "chain" ? "node" : "atom";
      const r = params.example === "chain" ? 21 : 13;
      return P.map(([x, y], i) => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r, set: { [key]: String(i) }, label: `${i}` }));
    }
    /* the atoms of the top sheet (its level read from the press counter, settled) and of the likeness drawing */
    if (params.page === "layers") {
      const top = Math.min(anim ? shownStep(anim, "layers") : 0, STACK_MAX);
      return [sheetPts(w, top), flatPts(w)].flatMap((P) => P.map(([x, y], i) => ({ x: x - 9, y: y - 9, w: 18, h: 18, set: { from: String(i) }, label: `${i}` })));
    }
    return [];
  },

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    /* one press, one layer, watched once: Step alone (play-only-for-motion-or-repetition) */
    runLabel: null,

    init: ({ params, fromScratch }) => {
      const stage = params.page;
      const anim = { stage, n: { aggregate: 0, layers: 0, readout: 0 }, t: 1, dur: MOVE_MS, example: params.example, halt: false };
      anim.n[stage] = fromScratch ? 0 : Math.max(0, Math.min(stepsOf(stage), Number(params.shown) || 0));
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage);
      return anim;
    },

    advance: (anim, { dt, params }) => {
      /* a press a page switch interrupted ends here, before the new page's (mid-press-page-switch) */
      if (anim.halt) { anim.halt = false; return false; }
      const stage = anim.stage;
      if (anim.t < 1) anim.t = Math.min(1, anim.t + dt / anim.dur);
      else if (anim.n[stage] < stepsOf(stage)) {
        anim.n[stage] += 1;
        /* a press that moves nothing (Pool) lands at once */
        anim.dur = durOf(stage, anim.n[stage], params);
        anim.t = anim.dur > 0 ? 0 : 1;
      }
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage) && anim.t >= 1;
      return anim.t < 1;
    },

    rebuild: (anim, { params }) => {
      const stage = params.page;
      /* only a page change ends a press in flight (mid-press-page-switch, 2026-09-20) */
      if (stage !== anim.stage) { if (anim.t < 1) { anim.t = 1; anim.halt = true; } }
      anim.stage = stage;
      /* a new example is a new graph: its presses start again */
      if (params.example !== anim.example) {
        anim.n.aggregate = 0; anim.example = params.example;
        if (stage === "aggregate" && anim.t < 1) { anim.t = 1; anim.halt = true; }
      }
      anim.beat = anim.n[stage];
      anim.done = anim.n[stage] >= stepsOf(stage) && anim.t >= 1;
    },
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    if (params.page === "layers") drawLayers(ctx, colors, w, h, params, state, anim, pointer);
    else if (params.page === "readout") drawReadout(ctx, colors, w, h, params, state, anim);
    else drawAggregate(ctx, colors, w, h, params, state, anim, pointer);
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
      const beat = shownStep(anim, "readout"), layer = Math.min(beat, LESSON_LAYERS), p = state.pooled[params.pooling];
      return [
        { label: S.tileRun, value: `${layer} of ${LESSON_LAYERS}`, note: S.tileRunNote },
        { label: S.tileClasses, value: String(state.classes[layer].n), note: S.tileClassesNote },
        { label: S.tilePooled, value: beat < 3 ? S.tileWait : p.diff < 1e-9 ? "identical" : "different", note: S.tilePooledNote[params.pooling] },
      ];
    }
    const a = state.agg, beat = shownStep(anim, "aggregate"), chain = params.example === "chain";
    const kind = chain ? "chain" : params.layer;
    /* every input that ties for the largest weight: the chain's two ends weigh the same */
    const big = Math.max(...a.w), tops = a.inputs.filter((_, k) => a.w[k] > big - 1e-9);
    const name = (j) => (j === a.i ? S.selfTag : String(j));
    const topNote = kind === "gat" ? (params.weights === "trained" ? S.tileTopNote.trained(state.agreeTop) : S.tileTopNote.untrained) : S.tileTopNote.gcn;
    return [
      { label: S.tileInputs, value: String(a.inputs.length), note: S.tileInputsNote(a.deg) },
      { label: S.tileSum, value: beat >= 1 ? fmt(a.w.reduce((s, v) => s + v, 0)) : S.tileWait, note: S.tileSumNote[kind === "gat" ? "gat" : kind] },
      { label: S.tileTop, value: beat >= 1 ? `${fmt(big)} · ${tops.length > 1 ? (chain ? "nodes" : "atoms") : tops[0] === a.i ? "" : chain ? "node" : "atom"} ${tops.map(name).join(" and ")}`.replace(" ·  ", " · ") : S.tileWait, note: topNote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "layers") return S.sumLay(shownStep(anim, "layers"), Number(params.from), state.hops.filter((d) => d <= shownStep(anim, "layers")).length);
    if (params.page === "readout") return S.sumRd(shownStep(anim, "readout"), params.pooling, state.pooled[params.pooling].diff < 1e-9);
    return S.sumAgg(params.example, state.agg.i, shownStep(anim, "aggregate"));
  },
});
