/* ============================================================================
   Widget 94 · Graphs: Representation (`graph-representation`) — PHM5005 09-1
   cells 1–4 and 25 (a graph as nodes and edges; the adjacency matrix and the
   edge list; node features; PyG's `x` and `edge_index`), 09-2 cells 1 and
   6–17 (SMILES, caffeine, `x`, `edge_index`, `edge_attr`).

   The prerequisite for 95 (message passing): a graph as the tables a GNN
   reads — `x`, A, `edge_index` — and a molecule as one of them. Planned
   around 09-2 cell 1's claim that SMILES strings "lose some of the spatial
   and relational information" (they do not: every bond is in the string,
   `_lab/graph-arc-measure.py`); his call in round 3 (2026-10-09) was that
   the caveat is not important at this point, so the subtitle, the SMILES
   control (Original · Canonical · Random — neither notebook uses canonical
   or random strings) and the "Furthest apart" tile went, and the string
   stays as the way the atoms are numbered and the rings written.

   Three pages under Step (his picks from `_lab/graph-arc-mock.html`, all
   the recommendation, 2026-10-09; Patients added in round 4 from
   `_lab/graph-third-page-mock.html`):

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
     PATIENTS  a graph whose edges are BUILT, not given: twelve tumours
               (simulated) at their log2 expression of ESR1 and ERBB2, two
               subtypes, the drawing being the feature space; each joined to
               its k nearest (k 1–4), `edge_weight` a similarity — the one
               number an edge carries that GCNConv reads, the term 95 uses.
               `y` and `train_mask` as PyG stores them: Labels Training only
               draws `y` where `train_mask` is True (four patients), the
               node-level task of 09-1 cell 24 and the transductive setting
               GCN was introduced for (Kipf & Welling 2017); Labels All draws
               every `y`, the edges joining two subtypes, and the edge
               homophily (k 2: 0.81; k 4: 0.70). `test_mask` (round 7, his
               pick B): four of the eight unlabelled are held out, ringed in
               --c-holdout as the held-out interactions are drawn, and keep
               their x and every edge; beside Interactions, a held-out node
               stays in the graph with its y hidden, a held-out edge leaves
               it. The Edges tile gave way to Held out (the status line
               keeps the count). Round 5 (2026-10-09): the
               control was Subtypes Some known · True and its tile still said
               "predict" under True; one control mixed the labels a model
               trains on with the truth, and PyG keeps those as two fields.
               Real instances: similarity network fusion (Wang et al. 2014),
               population graphs (Parisot et al. 2018), single-cell kNN
               graphs; they use many genes, usually after PCA, and k 10–30.
     INTERACTIONS  the edge-level task (round 6, 2026-10-09, his picks
               from `_lab/graph-edge-page-mock.html`, all the recommendation):
               ten DNA-damage-response proteins and twelve interactions well
               established in the literature (STRING's sense, physical or
               functional; TP53–CDKN1A is a transcription factor and its
               target), illustrative, not a download. Split All · Held out ·
               Negatives is RandomLinkSplit's two moves, one a step: two
               interactions leave `edge_index` and become the label-1 pairs of
               `edge_label_index`; two pairs with no edge join as label 0,
               fixed here where PyG samples them (positives first, as PyG
               concatenates them). The leak — a held-out edge left in
               `edge_index` — is a tile note, not a setting (his call 3).
     MOLECULE  six molecules from the lesson's file in a table on top
               (round 9, 2026-10-09, his picks from
               `_lab/graph-split-parity-mock.html`): the SMILES, y (Activity)
               and the split the lesson's scaffold split gives each, train or
               test, test rows in --c-holdout; a click on a row (or the
               Molecule control, a DATA parameter, so the press starts again
               from bond 1) builds that molecule below. Caffeine is the
               default, written as the file writes it, not as 09-2 cell 6
               does. Then, as before: the string above the drawing, each
               atom's number under its character; `x` (cell 11's five
               features), then `edge_index` and `edge_attr` with one column a
               directed edge, so a bond's two columns sit under each other in
               both. A press adds the next bond in mol.GetBonds() order (cell
               12's loop) and brackets its two atoms in the string; a bond's
               own characters light (a "=", both ring-closure digits). The
               `y` tile is the graph-level label against Patients' one a
               node: caffeine is row 438 of the lesson's training file,
               Activity 0 (2,335 molecules screened against E. coli).

   THE SPLIT, A VIEW OF THE EXAMPLE ON SCREEN (rounds 10–12, 2026-10-09,
   his picks from `_lab/graph-split-separation-mock.html`,
   `_lab/graph-split-details-mock.html` and `_lab/graph-task-view-mock.html`).
   Round 9's strip under each example read as part of the figure; round
   10 made the split a page; round 11 moved every trace of it there, so
   the example pages are representation only; round 12 made it a VIEW of
   the selected example — Show Representation · Split under the examples —
   because a page with its own Example control showed whichever example
   was set last, not the one the reader came from ("there is no concept of
   parent–child"). The split view opens with one band for that example's
   level — its small picture, "node-level split · a node's y hidden …", the
   fields that store it (round 13, his pick A: with the split following the
   example, three panels competed with the split below them) — then that
   example in full: Patients with
   train_mask and test_mask, Interactions with edge_label_index and
   edge_label (Split All · Held out · Negatives, here only), Molecule's
   table with its split column. Hidden on Graph, which has no task.

   THE TASK, MARKED (round 12): one query each in --c-unknown with a "?",
   not the split — patient 1 (between the two groups) with its subtype
   unknown, the pair MDM2–ATM with no edge on record (ATM does phosphorylate
   MDM2: a real interaction this graph lacks) — and a Task tile
   naming the level. Proteins carry x too (round 12, his note that
   students may think an edge task needs no node features): length in
   thousands of amino acids and kinase, from UniProt.

   The pages: Basics over Graph, Examples over Patients · Interactions ·
   Molecule (node · edge · graph) (core's `group` with `groupHeads`, widget
   85's form; rounds 5, 6, 8 and 12). Each example names its label's tensor
   in a tile: y · [12], edge_label · [n], y · [1].

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
import { MOLECULES, FILE } from "./data.js";

const PAGES = [{ value: "graph", label: "Graph", group: "Basics" }, { value: "patients", label: "Patients", group: "Examples" }, { value: "interactions", label: "Interactions", group: "Examples" }, { value: "molecule", label: "Molecule", group: "Examples" }];
const EDGES = [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }];
const ORDERS = [{ value: "abc", label: "In order" }, { value: "shuffled", label: "Shuffled" }];
const COUNTS = ["3", "4", "5", "6"].map((v) => ({ value: v, label: v }));
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

/* THE PATIENTS, fixed: twelve tumours, log2 expression of ESR1 and ERBB2 and
   a subtype (0 luminal, 1 HER2-like). Simulated once in
   `_lab/graph-third-page-mock.html` (two Gaussians, seed 9; patient 11 moved
   0.3 so its node clears patient 10's) and written here as data, so nothing
   is drawn at random. The four in train_mask are two of each. */
const PATIENTS = [[8.2, 4.39, 0], [5.98, 5.5, 0], [8.6, 4.61, 0], [5.52, 3.61, 0], [4.7, 2.58, 0], [6.2, 5.21, 0],
  [4.72, 5.21, 1], [4.31, 5.76, 1], [5.88, 7.56, 1], [3.23, 8.35, 1], [5.13, 7.03, 1], [5.45, 7.62, 1]];
const TRAIN = new Set([0, 2, 6, 9]);
/* held out to score, two of each subtype; the other four have neither mask */
const TEST = new Set([1, 4, 7, 10]);
/* the node-level query on the representation view: a patient between the two groups */
const QUERY = 1;
const KS = ["1", "2", "3", "4"].map((v) => ({ value: v, label: v }));
const EXAMPLES = [{ value: "patients", label: "Patients" }, { value: "interactions", label: "Interactions" }, { value: "molecule", label: "Molecule" }];
const SHOWS = [{ value: "representation", label: "Representation" }, { value: "split", label: "Split" }];
const isSplit = (params) => params.show === "split" && params.page !== "graph";

/* THE INTERACTIONS, fixed: ten DNA-damage-response proteins and twelve
   interactions well established in the literature, as pairs of node numbers.
   Where each sits is a fraction of the drawing box (from the mock). */
const PROTEINS = ["TP53", "MDM2", "CDKN1A", "ATM", "CHEK2", "BRCA1", "BARD1", "RAD51", "BRCA2", "PALB2"];
const PROT_AT = [[0.138, 0.5], [0, 0.077], [0, 0.923], [0.368, 0], [0.368, 1], [0.612, 0.5], [0.799, 0.077], [0.799, 1], [1, 0.731], [1, 0.192]];
const INTERACTIONS = [[0, 1], [0, 2], [0, 3], [0, 4], [3, 4], [3, 5], [4, 5], [5, 6], [5, 7], [5, 9], [7, 8], [8, 9]];
/* held out: ATM–CHEK2 and BRCA2–PALB2; the negatives: MDM2–RAD51 and CDKN1A–BARD1 */
const HELD = [[3, 4], [8, 9]];
/* each protein's x: length in thousands of amino acids (UniProt canonical) and kinase */
const PROT_X = [[0.393, 0], [0.491, 0], [0.164, 0], [3.056, 1], [0.543, 1], [1.863, 0], [0.777, 0], [0.339, 0], [3.418, 0], [1.186, 0]];
/* the edge-level query on the representation view: a pair with no edge on record */
const QUERY_PAIR = [1, 3];
const NEGATIVES = [[1, 7], [2, 6]];
const SPLITS = [{ value: "all", label: "All" }, { value: "held", label: "Held out" }, { value: "negatives", label: "Negatives" }];
/* the six molecules, by name: the Molecule control's options */
const MOLS = MOLECULES.map((m) => ({ value: m.name, label: m.name }));
/* RDKit's numbers for hybridization, as 09-2 cell 11 stores them */
const HYB = { 2: "sp", 3: "sp2", 4: "sp3" };

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A graph is a set of nodes joined by edges, stored as a node feature matrix and an edge list. Renumbering the nodes permutes these tables without changing the graph, " +
    "which is why models of graphs are built to be permutation invariant. Nodes can be patients, proteins or atoms, and a model can predict a label for each node, each edge or the whole graph.",
  pageLabel: "",
  nodesLabel: "Nodes",
  nodesDetail: "how many nodes the graph has; the feature values of E and F are illustrative",
  edgesLabel: "Edges",
  edgesDetail: "an edge that goes both ways, as a protein binding another, or one way, from a source to a target",
  orderLabel: "Order",
  orderDetail: "which node is numbered 0, 1, 2, …; the graph is the same either way",
  graphLabel: "Edge list",
  graphDetail: "pairs of nodes, source then target, as A-B, B-C; in an undirected graph A-B and B-A are one edge",

  kLabel: "Neighbours k",
  kDetail: "each patient is joined to the k patients nearest to it in expression; a pair joined either way is one edge. With two genes the plot is the feature space; studies use many, usually reduced by PCA first",
  showLabel: "Show",
  showDetail: "the example above as data, or how it is split for training and testing",

  splitLabel: "Split",
  splitDetail: "All keeps every interaction on record in edge_index; Held out takes two out to be scored, labelled 1; Negatives adds two pairs with no edge, labelled 0",

  molLabel: "Molecule",
  molDetail: "one of six molecules from a screen for growth inhibition of E. coli; a click on a row of the table picks one too; a new molecule starts again from its first bond",

  stepLabel: "Next bond",
  stepTitle: "Add the next bond to edge_index and edge_attr",
  runLabel: "Play",
  runTitle: "Add the remaining bonds in turn",

  /* Graph */
  capGraph: "the graph",
  capGraphHint: "click two nodes to add or remove an edge",
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
  graphPick: (name) => `${name} picked · click another node to add or remove the edge, or ${name} again to cancel`,
  graphHover: (name, i, dir, d) => `${name} · node ${i}, row ${i} of x · ${dir ? "out-degree" : "degree"} ${d}, the sum of row ${i} of A`,
  graphNodeLabel: (name, i, dir, d) => `${name} · node ${i} · ${dir ? "out-degree" : "degree"} ${d}`,
  graphEdgeLabel: (a, b, dir) => `${a} ${dir ? "→" : "–"} ${b}`,
  graphEdgeHover: (a, b, dir, i, j, ks) => (dir
    ? `${a} → ${b} · A[${i}][${j}] · column ${ks[0]} of edge_index`
    : `${a} – ${b} · A[${i}][${j}] and A[${j}][${i}] · columns ${ks[0]} and ${ks[1]} of edge_index`),
  graphCellHover: (i, j, v, a, b, dir) => `A[${i}][${j}] = ${v} · click to ${v ? "remove" : "add"} the edge ${a} ${dir ? "→" : "–"} ${b}`,

  /* Patients */
  capPatients: "the patients",
  capPatientsHint: "each joined to its k nearest in expression",
  axisX: "ESR1 expression (log2)",
  axisY: "ERBB2 expression (log2)",
  capPX: "x · [12, 2] · ESR1, ERBB2",
  capPY: "y",
  capPMask: "train_mask",
  capPTest: "test_mask",
  yName: ["luminal", "HER2-like"],
  capPEI: (k, shown) => `edge_index · [2, ${k}]${shown < k ? ` · the first ${shown} columns` : ""} · edge_weight · [${k}]: the similarity, exp(−d² / 2)`,
  rowAttr: "edge_weight",
  patStatus: (k, m, kc) => `12 patients · k ${k} · ${m} edges · ${kc} columns of edge_index`,
  patNote: {
    split: "red ring: test_mask True, held out to score; its x and every edge stay in the graph, only its y is hidden",
    plain: "?: patient 1, whose subtype a node-level model predicts · red line: an edge joining two subtypes",
  },
  patNodeLabel: (i, sub, d) => `patient ${i} · ${sub} · ${d} neighbour${d === 1 ? "" : "s"}`,
  patNodeHover: (i, e, b, sub, d) => `patient ${i} · ESR1 ${e.toFixed(1)}, ERBB2 ${b.toFixed(1)} · ${sub} · ${d} neighbour${d === 1 ? "" : "s"}`,
  patEdgeLabel: (i, j, sim) => `${i} – ${j} · similarity ${sim.toFixed(2)}`,
  patEdgeHover: (i, j, sim, cols) => `patients ${i} and ${j} · similarity ${sim.toFixed(2)} · ${cols.length ? `columns ${cols.join(" and ")} of edge_index` : "its columns are past the ones drawn"}`,
  heldSub: "held out, y hidden",
  unknownSub: "no mask",
  querySub: "subtype to predict",

  /* Interactions */
  capInt: "the interactions",
  capIntHint: { plain: "edges: interactions on record · ?: a pair to predict", split: "edges: interactions on record" },
  capIX: "x · [10, 2]",
  capIXHint: "length (k aa) · kinase",
  ixHeads: ["k aa", "kinase"],
  ixNote: "in practice, a learned vector per protein",
  capIEI: (k) => `edge_index · [2, ${k}] · the edges a model passes messages along`,
  capILI: (k) => `edge_label_index · [2, ${k}] and edge_label · [${k}] · the pairs a model scores`,
  iliEmpty: "no pair yet: every interaction on record is in edge_index",
  rowNode: "node",
  rowLabel: "label",
  intStatus: (m, k, l) => `10 proteins · ${m} edges in edge_index · ${k} columns${l == null ? "" : ` · ${l} pair${l === 1 ? "" : "s"} scored`}`,
  intNote: {
    plain: "every interaction on record is in edge_index, stored both ways · ?: MDM2 and ATM, a pair with no edge",
    all: "every interaction on record is in edge_index, stored both ways; no pair is set aside to score",
    held: "dashed: held out · each leaves edge_index and becomes a pair of edge_label_index labelled 1",
    negatives: "dotted: a pair with no edge, labelled 0 · such a pair can be an interaction not yet found",
  },
  intNodeLabel: (name, i, d) => `${name} · node ${i} · degree ${d}`,
  intNodeHover: (name, i, x, d, held) => `${name} · node ${i} · ${Math.round(x[0] * 1000).toLocaleString("en")} amino acids${x[1] ? ", a kinase" : ""} · ${d} edge${d === 1 ? "" : "s"} in edge_index${held ? ` · in ${held} held-out pair${held === 1 ? "" : "s"}` : ""}`,
  intEdgeLabel: (a, b, kind) => `${a} – ${b}${kind === "held" ? " · label 1" : kind === "neg" ? " · label 0" : kind === "query" ? " · ?" : ""}`,
  intEdgeHover: {
    train: (a, b, ks) => `${a} – ${b} · columns ${ks[0]} and ${ks[1]} of edge_index`,
    held: (a, b, k) => `${a} – ${b} · held out: in no column of edge_index · column ${k} of edge_label_index, label 1`,
    neg: (a, b, k) => `${a} – ${b} · no edge on record · column ${k} of edge_label_index, label 0`,
    query: (a, b) => `${a} – ${b} · no edge on record: whether these two interact is what an edge-level model predicts`,
  },

  /* Splits */
  splitHeads: ["node-level split", "edge-level split", "graph-level split"],
  splitLines: ["a node's y hidden; the node and its edges stay", "the edge taken out of the graph, then scored", "whole graphs set aside; nothing inside one changes"],
  splitFields: ["train_mask · test_mask", "edge_label_index · edge_label", "train_set · test_set"],
  splitMolNote: "train_set and test_set: two lists of graphs",
  splitMolStatus: (tr, te) => `6 molecules · ${tr} in train_set, ${te} in test_set`,

  /* Molecule */
  capTable: (n, a, click) => `the molecules · 6 of the ${n.toLocaleString("en")} in the screen, ${a} of them active${click ? " · click a row" : ""}`,
  tableHeads: ["", "molecule", "SMILES", "y", "split"],
  rowHover: (name, na, nb) => `${name} · ${na} atoms, ${nb} bonds · click to build its graph`,
  capString: "the string · each character in a cell, each atom's number under it",
  capMol: "the graph",
  capMolX: (n) => `x · [${n}, 5] · one row an atom`,
  capMolEI: (k) => `edge_index · [2, ${k}]`,
  capAttr: (k) => `edge_attr · [${k}, 4] · each row drawn under its column of edge_index, one-hot by bond type`,
  attrRows: ["single", "double", "triple", "aromatic"],
  molStart: "no bond yet · the atoms, numbered in the order they are written in the string",
  molStatus: (n, N, i, j, ei, ej, type) => `bond ${n} of ${N} · atoms ${i} and ${j}, ${ei}–${ej}, ${type.toLowerCase()}`,
  molNote: "the rows are in the string's order · a digit marks each end of a ring-closure bond",
  molHover: (i, x) => `atom ${i} · x row ${i}: atomic number ${x[0]}, ${x[1] ? "aromatic" : "not aromatic"}, hybridization ${x[2]} (${HYB[x[2]] ?? "other"}), ${x[3]} hydrogen${x[3] === 1 ? "" : "s"}, charge ${x[4]}`,
  molKey: "solid and dashed: aromatic · two lines: double",
  molAtomLabel: (i, el) => `${el} · atom ${i}`,
  molBondLabel: (k, ei, ej, type) => `${ei}–${ej} · ${type.toLowerCase()} · bond ${k}`,
  molBondHover: (k, i, j, type, added, cols, chars) => `bond ${k} · atoms ${i}–${j}, ${type.toLowerCase()} · ${chars.length ? `written ${chars.join(" … ")}` : "no character of its own"} · ${added ? `columns ${cols[0]}, ${cols[1]}` : "not added yet"}`,

  /* tiles */
  tileEdges: "Edges",
  tileEdgesNote: { undirected: "two columns of edge_index each, one each way", directed: "one column of edge_index each, source then target" },
  tileDensity: "Density",
  tileDensityNote: { undirected: "2M / N(N − 1): edges present over all possible edges", directed: "M / N(N − 1): edges present over all possible edges" },
  tileA: "A",
  tileAValue: (sym) => (sym ? "symmetric" : "not symmetric"),
  tileANote: "A[i][j] is 1 when an edge runs from node i to node j",
  tilePEdges: "Edges",
  tilePEdgesNote: "each patient to its k nearest, a pair counted once; two columns of edge_index each",
  tileHomo: "Edge homophily",
  tileHomoNote: (same, m) => `${same} of the ${m} edges between two known patients join one subtype`,
  tileTask: "Task",
  tilePTaskValue: "node-level",
  tilePTaskNote: "y · [12], one label a node: predict a patient's subtype, as for patient 1",
  tileTaskValue: "edge-level",
  tileTaskNote: "a label on a pair of nodes: predict whether two proteins interact, as for MDM2 and ATM",
  tileOpen: "Pairs with no edge",
  tileOpenNote: "pairs of the ten proteins with no interaction on record: the candidates a model scores",
  tileTrainMask: "train_mask",
  tileTrainMaskNote: "the patients whose y a model trains on, two of each subtype",
  tileTestMask: "test_mask",
  tileTestMaskNote: "held out, scored once; unlike a held-out edge, a held-out node stays in x and edge_index, with only its y hidden",
  tileNoMask: "Neither",
  tileNoMaskNote: "in the graph but in neither set: messages still pass along their edges, and a model predicts their y too",
  tileIEdges: "Edges",
  tileIEdgesNote: "interactions in edge_index, two columns each",
  tileLabel: (k) => `edge_label · [${k}]`,
  tileLabelNote: "an edge-level label, one a pair of nodes: 1 for a held-out interaction, 0 for a pair with no edge",
  tileHeld: "Held out",
  tileHeldNote: "interactions taken out of edge_index to be scored; left in, a model would pass messages along the edges it is scored on",
  tileTrainSet: "train_set",
  tileTrainSetNote: "the molecules a model is trained on, whole",
  tileTestSet: "test_set",
  tileTestSetNote: "molecules held out whole and scored once",
  tileLesson: "The whole screen",
  tileLessonNote: "train · validation · test over all 2,335 molecules, each held out whole",
  tileY: "y · [1]",
  tileYNote: (y, name) => `a graph-level label, one for the whole molecule (Patients has one a node, Interactions one a pair): ${y}, as ${name} ${y ? "stopped" : "did not stop"} E. coli growing in the screen`,
  tileBonds: "Bonds",
  tileBondsNote: "two columns of edge_index each, one each way, and a row of edge_attr per column",
  tileTypes: "Bond types",
  tileTypesNote: "single · double · triple · aromatic among the bonds added: the four rows of edge_attr, each bond counted once",
  tileWait: "—",

  sumGraph: (n, m, dir) => `a ${dir ? "directed" : "undirected"} graph of ${n} nodes and ${m} edge${m === 1 ? "" : "s"}, with its feature matrix, adjacency matrix and edge list`,
  sumPat: (k, m) => `twelve patients placed by their ESR1 and ERBB2 expression, each joined to its ${k} nearest: ${m} edges`,
  sumSplits: (ex) => `the ${ex} split: what is held out, and the fields that store it`,
  sumIntPlain: (m) => `ten proteins joined by the interactions on record: ${m} edges in edge_index; MDM2 and ATM, a pair with no edge, is the one to predict`,
  sumPatQuery: "; patient 1's subtype is the one to predict",
  sumMol: (name, n, N) => `${name}, its atoms as nodes, with x, edge_index and edge_attr; ${n === 0 ? "no bond added yet" : n < N ? `${n} of ${N} bonds added` : "every bond added"}`,
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
/** distance from a point to the segment a–b */
function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
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

function moleculeTables(name) {
  const v = MOLECULES.find((m) => m.name === name) ?? MOLECULES.find((m) => m.name === "caffeine");
  const cols = [], attr = [];
  v.bonds.forEach(([i, j, type]) => {
    const oh = BOND_TYPES.map((t) => (t === type ? 1 : 0));
    cols.push([i, j]); cols.push([j, i]);           // cell 12: [[i, j], [j, i]]
    attr.push(oh); attr.push(oh);                    // cell 13: both directions
  });
  const chars = bondChars(v.smiles);
  return { kind: "molecule", ...v, cols, attr, bondChar: v.bonds.map(([i, j]) => chars(i, j)), steps: v.bonds.length };
}
/* each patient to its k nearest, a pair joined either way kept once; the
   edge weight a similarity, exp(−d² / 2) on the two log2 values */
function patientTables(k) {
  const d = (a, b) => Math.hypot(PATIENTS[a][0] - PATIENTS[b][0], PATIENTS[a][1] - PATIENTS[b][1]);
  const set = new Set();
  PATIENTS.forEach((_, i) => PATIENTS.map((__, j) => j).filter((j) => j !== i).sort((a, b) => d(i, a) - d(i, b)).slice(0, k)
    .forEach((j) => set.add(i < j ? `${i},${j}` : `${j},${i}`)));
  const edges = [...set].map((e) => e.split(",").map(Number)).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const cols = [];
  for (const [i, j] of edges) { cols.push([i, j]); cols.push([j, i]); }
  cols.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const sim = (i, j) => Math.exp(-(d(i, j) ** 2) / 2);
  const deg = PATIENTS.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
  const cross = edges.filter(([i, j]) => PATIENTS[i][2] !== PATIENTS[j][2]).length;
  return { k, edges, cols, sim, deg, cross };
}

/* RandomLinkSplit's two moves: the held-out interactions leave edge_index
   and become the label-1 pairs; the negatives follow them as label 0 */
function interactionTables(split) {
  const held = split === "all" ? [] : HELD;
  const isHeld = ([i, j]) => held.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  const edges = INTERACTIONS.filter((e) => !isHeld(e));
  const cols = edges.flatMap(([i, j]) => [[i, j], [j, i]]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const pairs = split === "negatives" ? [...held, ...NEGATIVES] : held;
  const labels = pairs.map((_, k) => (k < held.length ? 1 : 0));
  const deg = PROTEINS.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
  return { split, edges, cols, pairs, labels, nHeld: held.length, deg };
}

function compute({ params }) {
  return {
    graph: graphTables(params),
    patients: patientTables(Number(params.k)),
    interactions: interactionTables("all"),
    interactionSplit: interactionTables(params.split),
    molecule: moleculeTables(params.mol),

  };
}

/* ============================================================ animation */

/* the split view is a stage of its own, so a switch to it ends a press like a page switch does */
const stageOf = (params) => (isSplit(params) ? `${params.page}-split` : params.page);
/** the press whose numbers are shown */
const shownStep = (anim) => anim.n[anim.stage] ?? 0;
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
  const g = tablesGeom(w, n), K = cols.length, eiCellW = K ? Math.min(30, (w - 64 - 20) / K) : 0;
  const deg = (p) => A[index[p]].reduce((a, v) => a + v, 0);
  const same = (e, a, b) => (directed ? e[0] === a && e[1] === b : (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));

  /* WHAT THE POINTER IS ON: a node, else a cell of A, else an edge — in the
     drawing, or as a column of edge_index. One thing at a time, and every
     table that stores it lights with it. */
  let hov = null, hovCell = null, hovEdge = null;
  if (pointer) {
    for (let p = 0; p < n; p++) { const [px, py] = nodeAt(w, p); if (Math.hypot(pointer.x - px, pointer.y - py) <= 15) hov = p; }
    const cx = g.aX + 12 + 3;
    if (hov == null && pointer.x >= cx && pointer.x < cx + n * g.cell && pointer.y >= G.tableTop && pointer.y < G.tableTop + n * G.cellH) {
      const i = Math.floor((pointer.y - G.tableTop) / G.cellH), j = Math.floor((pointer.x - cx) / g.cell);
      if (i !== j) hovCell = [i, j];
    }
    if (hov == null && !hovCell) {
      let best = 6;
      edges.forEach((e, k) => { const d = segDist(pointer.x, pointer.y, nodeAt(w, e[0]), nodeAt(w, e[1])); if (d < best) { best = d; hovEdge = k; } });
      if (hovEdge == null && K && pointer.y >= G.eiTop && pointer.y < G.eiTop + 2 * G.cellH && pointer.x >= 67 && pointer.x < 67 + K * eiCellW) {
        const c = cols[Math.floor((pointer.x - 67) / eiCellW)], a = at[c[0]], b = at[c[1]];
        hovEdge = edges.findIndex((e) => same(e, a, b));
        if (hovEdge < 0) hovEdge = null;
      }
    }
  }
  const he = hovEdge != null ? edges[hovEdge] : null;
  const lit = new Set(hov != null ? [hov] : he ? [he[0], he[1]] : []);
  const edgeCell = (i, j) => he && same(he, at[i], at[j]) && (directed ? at[i] === he[0] : true);
  const edgeCol = (k) => he && same(he, at[cols[k][0]], at[cols[k][1]]);

  txt(ctx, colors, S.capGraph, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: leftW(w) - 12 });
  /* the instruction on its own line: beside the caption it ran past the drawing's 246 px at the narrowest layout */
  txt(ctx, colors, S.capGraphHint, 12, 30, { fill: colors.ink3, maxW: leftW(w) - 12 });

  /* the edge a click would toggle, dashed: from the pick to the hovered node, or a hovered cell's pair */
  const preview = pick != null && hov != null && hov !== pick ? [pick, hov] : hovCell ? [at[hovCell[0]], at[hovCell[1]]] : null;
  if (preview) { const [xa, ya] = nodeAt(w, preview[0]), [xb, yb] = nodeAt(w, preview[1]); line(ctx, xa, ya, xb, yb, colors.highlight, 1.4, [4, 4]); }

  /* edges; a pair joined both ways when directed is two arrows side by side */
  edges.forEach(([a, c], k) => {
    const [xa, ya] = nodeAt(w, a), [xb, yb] = nodeAt(w, c), L = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / L, uy = (yb - ya) / L;
    const off = directed && edges.some(([s2, t2]) => s2 === c && t2 === a) ? 3.5 : 0, nx = -uy * off, ny = ux * off;
    const end = NODE_R + (directed ? 3 : 0), col = k === hovEdge ? colors.groupA : colors.ink1;
    line(ctx, xa + ux * NODE_R + nx, ya + uy * NODE_R + ny, xb - ux * end + nx, yb - uy * end + ny, col, k === hovEdge ? 3.5 : 2);
    if (directed) arrowHead(ctx, xb - ux * NODE_R + nx, yb - uy * NODE_R + ny, Math.atan2(uy, ux), col);
  });
  /* nodes: the features above as two cells, the number at the lower right */
  for (let p = 0; p < n; p++) {
    const [px, py] = nodeAt(w, p), f = FEATURES[p];
    for (let c = 0; c < 2; c++) rect(ctx, px - 14 + c * 14, py - 38, 14, 14, ramp(colors, f[c] / 1.3), colors.ink2);
    node(ctx, colors, px, py, NODE_R, NAMES[p], {
      fill: p === pick ? wash(colors.highlight, 0.45) : lit.has(p) ? wash(colors.groupA, 0.35) : null,
      stroke: p === pick ? colors.highlight : null, lw: p === pick ? 2.4 : 1.4,
    });
    txt(ctx, colors, String(index[p]), px + 17, py + 14, { font: boldMono(colors), fill: colors.ink2 });
  }

  /* x and A at the right */
  const hi = (i) => lit.has(at[i]);
  txt(ctx, colors, S.capX(n), g.xX, 14, { font: capFont(colors), fill: colors.ink1 });
  x.forEach((_, i) => txt(ctx, colors, `${i} ${NAMES[at[i]]}`, g.xX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: hi(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, g.xX + 28, G.tableTop, x, { cellW: 28, cellH: G.cellH, fmt: (v) => v.toFixed(1), hl: (i) => (hi(i) ? wash(colors.groupA, 0.3) : null) });
  txt(ctx, colors, S.capA(n), g.aX, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - g.aX - 8 });
  for (let j = 0; j < n; j++) txt(ctx, colors, String(j), g.aX + 12 + 3 + j * g.cell + g.cell / 2, G.tableTop - 6, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  for (let i = 0; i < n; i++) txt(ctx, colors, String(i), g.aX, G.tableTop + i * G.cellH + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  matrix(ctx, colors, g.aX + 12, G.tableTop, A.map((row, i) => row.map((v, j) => (i === j ? "·" : v))), {
    cellW: g.cell, cellH: G.cellH,
    hl: (i, j) => (hovCell && hovCell[0] === i && hovCell[1] === j ? wash(colors.highlight, 0.32)
      : edgeCell(i, j) ? wash(colors.groupA, 0.4) : hov != null && (hi(i) || hi(j)) ? wash(colors.groupA, 0.22) : null),
  });
  txt(ctx, colors, S.capAHint, g.aX, G.tableTop + n * G.cellH + 14, { fill: colors.ink3, maxW: w - g.aX - 8 });

  /* the edge list, full width under the drawing */
  txt(ctx, colors, S.capEI(K, directed), 12, G.eiTop - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.rowSrc, 12, G.eiTop + G.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, S.rowTgt, 12, G.eiTop + G.cellH * 1.5 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  if (K) {
    matrix(ctx, colors, 64, G.eiTop, [cols.map((c) => c[0]), cols.map((c) => c[1])], {
      cellW: eiCellW, cellH: G.cellH,
      hl: (i, k) => (edgeCol(k) ? wash(colors.groupA, 0.4) : hov != null && at[cols[k][i]] === hov ? wash(colors.groupA, 0.25) : null),
    });
  } else txt(ctx, colors, S.eiEmpty, 70, G.eiTop + G.cellH + 4, { fill: colors.ink3 });

  /* the label beside what the pointer is on */
  if (hov != null) { const [px, py] = nodeAt(w, hov); hoverLabel(ctx, colors, S.graphNodeLabel(NAMES[hov], index[hov], directed, deg(hov)), px, py, w); }
  else if (he) { const [xa, ya] = nodeAt(w, he[0]), [xb, yb] = nodeAt(w, he[1]); hoverLabel(ctx, colors, S.graphEdgeLabel(NAMES[he[0]], NAMES[he[1]], directed), (xa + xb) / 2, (ya + yb) / 2, w); }

  /* the status line and the note: what the pointer is on, a pick, or the rule */
  txt(ctx, colors, S.graphStatus(n, edges.length, K), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  let note;
  if (hov != null) note = S.graphHover(NAMES[hov], index[hov], directed, deg(hov));
  else if (hovCell) { const [i, j] = hovCell; note = S.graphCellHover(i, j, A[i][j], NAMES[at[i]], NAMES[at[j]], directed); }
  else if (he) {
    const i = index[he[0]], j = index[he[1]], ks = cols.map((c, k) => (edgeCol(k) ? k : -1)).filter((k) => k >= 0);
    note = S.graphEdgeHover(NAMES[he[0]], NAMES[he[1]], directed, i, j, ks);
  } else note = pick != null ? S.graphPick(NAMES[pick]) : S.graphNote[directed ? "directed" : "undirected"];
  const active = hov != null || hovCell || he || pick != null;
  txt(ctx, colors, note, 12, h - 11, { fill: active ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* ============================================================= Patients */

const PT = { top: 26, plotTop: 44, plotH: 236, eiTop: 344, cellH: 16 };
const H_PAT = PT.eiTop + 3 * PT.cellH + 46;
const plotBox = (w) => ({ x0: 46, y0: PT.plotTop, w: Math.min(w * 0.5, 380) - 56, h: PT.plotH });
const LO = [3.23 - 0.45, 2.58 - 0.45], HI = [8.6 + 0.45, 8.35 + 0.45];
const patAt = (w, i) => { const b = plotBox(w); return [b.x0 + ((PATIENTS[i][0] - LO[0]) / (HI[0] - LO[0])) * b.w, b.y0 + b.h - ((PATIENTS[i][1] - LO[1]) / (HI[1] - LO[1])) * b.h]; };

function drawPatients(ctx, colors, w, h, st, split, pointer) {
  /* the representation view hides one subtype, the query; the split view hides the ones not in train_mask */
  const b = plotBox(w), { edges, cols, sim, deg, cross } = st;
  const tx = b.x0 + b.w + 22, x0 = 12 + 66, K = cols.length;
  const cw = 30, nShown = Math.min(K, Math.floor((w - x0 - 16) / cw));
  const shownSub = (i) => (split ? TRAIN.has(i) : i !== QUERY);
  const subName = (i) => (shownSub(i) ? S.yName[PATIENTS[i][2]] : !split ? S.querySub : TEST.has(i) ? S.heldSub : S.unknownSub);

  /* WHAT THE POINTER IS ON: a patient (in the plot or a row of x), else an
     edge (in the plot or a column of edge_index) */
  let hov = null, hovEdge = null;
  if (pointer) {
    PATIENTS.forEach((_, i) => { const [x, y] = patAt(w, i); if (Math.hypot(pointer.x - x, pointer.y - y) <= 11) hov = i; });
    if (pointer.x >= tx && pointer.x < w - 8 && pointer.y >= PT.plotTop + 4 && pointer.y < PT.plotTop + 4 + 12 * 18) hov = Math.floor((pointer.y - PT.plotTop - 4) / 18);
    if (hov == null) {
      let best = 6;
      edges.forEach(([i, j], k) => { const dd = segDist(pointer.x, pointer.y, patAt(w, i), patAt(w, j)); if (dd < best) { best = dd; hovEdge = k; } });
      if (hovEdge == null && pointer.y >= PT.eiTop && pointer.y < PT.eiTop + 3 * PT.cellH && pointer.x >= x0 && pointer.x < x0 + nShown * cw) {
        const c = cols[Math.floor((pointer.x - x0) / cw)];
        hovEdge = edges.findIndex(([i, j]) => (i === c[0] && j === c[1]) || (i === c[1] && j === c[0]));
        if (hovEdge < 0) hovEdge = null;
      }
    }
  }
  const he = hovEdge != null ? edges[hovEdge] : null;
  const lit = new Set(hov != null ? [hov] : he ? he : []);
  const onEdge = (i, j) => (hov != null && (i === hov || j === hov)) || (he && ((he[0] === i && he[1] === j) || (he[0] === j && he[1] === i)));

  txt(ctx, colors, S.capPatients, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: b.x0 + b.w - 12 });
  txt(ctx, colors, S.capPatientsHint, 12, 30, { fill: colors.ink3, maxW: b.x0 + b.w - 12 });

  /* the axes */
  line(ctx, b.x0, b.y0 + b.h, b.x0 + b.w, b.y0 + b.h, colors.axis);
  line(ctx, b.x0, b.y0, b.x0, b.y0 + b.h, colors.axis);
  for (const v of [4, 6, 8]) {
    const x = b.x0 + ((v - LO[0]) / (HI[0] - LO[0])) * b.w, y = b.y0 + b.h - ((v - LO[1]) / (HI[1] - LO[1])) * b.h;
    line(ctx, x, b.y0 + b.h, x, b.y0 + b.h + 4, colors.axis); txt(ctx, colors, String(v), x, b.y0 + b.h + 15, { fill: colors.ink3, align: "center" });
    line(ctx, b.x0 - 4, y, b.x0, y, colors.axis); txt(ctx, colors, String(v), b.x0 - 7, y + 3, { fill: colors.ink3, align: "right" });
  }
  txt(ctx, colors, S.axisX, b.x0 + b.w / 2, b.y0 + b.h + 30, { fill: colors.ink3, align: "center" });
  ctx.save(); ctx.translate(14, b.y0 + b.h / 2); ctx.rotate(-Math.PI / 2); txt(ctx, colors, S.axisY, 0, 0, { fill: colors.ink3, align: "center" }); ctx.restore();

  /* edges: the hovered ones thick; by the true subtypes, the ones joining two in red */
  edges.forEach(([i, j], k) => {
    const [xa, ya] = patAt(w, i), [xb, yb] = patAt(w, j), crossing = !split && shownSub(i) && shownSub(j) && PATIENTS[i][2] !== PATIENTS[j][2];
    const on = onEdge(i, j);
    line(ctx, xa, ya, xb, yb, on ? colors.groupA : crossing ? colors.extreme : colors.ink3, on ? 3 : crossing ? 2 : 1.3);
  });
  /* patients: filled by subtype where it is shown, open where it is not;
     a held-out patient ringed in the held-out colour either way */
  PATIENTS.forEach((p, i) => {
    const [x, y] = patAt(w, i), known = shownSub(i), held = split && TEST.has(i);
    const ring = lit.has(i) ? colors.groupA : held ? colors.holdout : known ? colors.ink1 : colors.unknown;
    dot(ctx, x, y, 10, known ? colors.clusters[p[2]] : colors.surface, ring, lit.has(i) ? 3 : held ? 2.6 : known ? 1.2 : 2);
    txt(ctx, colors, !split && i === QUERY ? "?" : String(i), x, y + 0.5, { font: nodeFont(colors), fill: known ? colors.surface : colors.ink1, align: "center", baseline: "middle" });
  });

  /* x, y, train_mask and test_mask at the right, one row a patient; y is
     drawn where the labels shown include it, "?" elsewhere, as a model sees it */
  txt(ctx, colors, S.capPX, tx, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - tx - 8 });
  const yX = tx + 18 + 2 * 28 + 14, mX = yX + 18, tX = mX + 72;
  txt(ctx, colors, S.capPY, yX, PT.plotTop - 4, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  if (split) {
    txt(ctx, colors, S.capPMask, mX, PT.plotTop - 4, { font: monoFont(colors), fill: colors.ink3 });
    txt(ctx, colors, S.capPTest, tX, PT.plotTop - 4, { font: monoFont(colors), fill: colors.ink3, maxW: w - tX - 6 });
  }
  const tf = (v, x, y) => txt(ctx, colors, v ? "True" : "False", x, y, { font: v ? boldMono(colors) : monoFont(colors), fill: v ? colors.ink1 : colors.ink3, baseline: "middle" });
  PATIENTS.forEach((p, i) => {
    const y = PT.plotTop + 4 + i * 18 + 9, on = lit.has(i);
    if (on) rect(ctx, tx - 4, y - 9, w - tx - 2, 18, wash(colors.groupA, 0.22));
    txt(ctx, colors, String(i), tx, y + 1, { font: monoFont(colors), fill: on ? colors.ink1 : colors.ink3, baseline: "middle" });
    txt(ctx, colors, p[0].toFixed(1), tx + 18 + 14, y + 1, { font: monoFont(colors), fill: colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, p[1].toFixed(1), tx + 18 + 42, y + 1, { font: monoFont(colors), fill: colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, shownSub(i) ? String(p[2]) : "?", yX, y + 1, { font: shownSub(i) ? boldMono(colors) : monoFont(colors), fill: shownSub(i) ? colors.ink1 : colors.ink3, align: "center", baseline: "middle" });
    if (split) { tf(TRAIN.has(i), mX, y + 1); tf(TEST.has(i), tX, y + 1); }
  });

  /* edge_index, as many columns as fit, and the similarity under each */
  txt(ctx, colors, S.capPEI(K, nShown), 12, PT.eiTop - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  [S.rowSrc, S.rowTgt, S.rowAttr].forEach((r, t) => txt(ctx, colors, r, 12, PT.eiTop + t * PT.cellH + PT.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  for (let k = 0; k < nShown; k++) {
    const [i, j] = cols[k], x = x0 + k * cw, on = onEdge(i, j);
    if (on) rect(ctx, x + 1, PT.eiTop + 1, cw - 2, 3 * PT.cellH - 2, wash(colors.groupA, 0.3));
    txt(ctx, colors, String(i), x + cw / 2, PT.eiTop + PT.cellH / 2 + 1, { font: on ? boldMono(colors) : monoFont(colors), fill: on ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, String(j), x + cw / 2, PT.eiTop + 1.5 * PT.cellH + 1, { font: on ? boldMono(colors) : monoFont(colors), fill: on ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, sim(i, j).toFixed(2).replace(/^0/, ""), x + cw / 2, PT.eiTop + 2.5 * PT.cellH + 1, { font: monoFont(colors), fill: colors.ink3, align: "center", baseline: "middle" });
  }
  rect(ctx, x0, PT.eiTop, nShown * cw, 3 * PT.cellH, null, colors.grid);

  /* the label beside what the pointer is on */
  if (hov != null) { const [x, y] = patAt(w, hov); hoverLabel(ctx, colors, S.patNodeLabel(hov, subName(hov), deg[hov]), x, y, w); }
  else if (he) { const [xa, ya] = patAt(w, he[0]), [xb, yb] = patAt(w, he[1]); hoverLabel(ctx, colors, S.patEdgeLabel(he[0], he[1], sim(he[0], he[1])), (xa + xb) / 2, (ya + yb) / 2, w); }

  /* the status line and the note */
  txt(ctx, colors, S.patStatus(st.k, edges.length, K), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  let note = S.patNote[split ? "split" : "plain"];
  if (hov != null) note = S.patNodeHover(hov, PATIENTS[hov][0], PATIENTS[hov][1], subName(hov), deg[hov]);
  else if (he) note = S.patEdgeHover(he[0], he[1], sim(he[0], he[1]), cols.map((c, k) => (k < nShown && ((c[0] === he[0] && c[1] === he[1]) || (c[0] === he[1] && c[1] === he[0])) ? k : -1)).filter((k) => k >= 0));
  txt(ctx, colors, note, 12, h - 11, { fill: hov != null || he ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* ========================================================= Interactions */

const IT = { top: 46, gH: 172, eiTop: 270, lblTop: 334, cellH: 15 };
const H_INT = IT.lblTop - 20 + 46;
const H_INT_SPLIT = IT.lblTop + 3 * IT.cellH + 46;
const PILL_W = 70;
/* the network at the left, x at the right, as on Patients */
const intBox = (w) => { const bw = Math.min(w * 0.62, 420) - 92; return { L: 46, bw, tx: 46 + bw + PILL_W / 2 + 16 }; };
const protAt = (w, i) => {
  const { L, bw } = intBox(w);
  return [L + PROT_AT[i][0] * bw, IT.top + 12 + PROT_AT[i][1] * (IT.gH - 24)];
};
const IX = { rowTop: IT.top + 4, rowH: 16 };

function drawInteractions(ctx, colors, w, h, st, pointer, split) {
  const { edges, cols, pairs, labels, nHeld, deg } = st;
  const K = cols.length, x0 = 12 + 52, cw = Math.min(22, (w - x0 - 12) / Math.max(K, 1));
  const lw = 32;
  /* every drawn line: an edge of edge_index, a held-out pair, a negative pair */
  const lines = [...edges.map((e) => ({ e, kind: "train" })), ...pairs.map((e, k) => ({ e, kind: k < nHeld ? "held" : "neg", k })),
    ...(split ? [] : [{ e: QUERY_PAIR, kind: "query" }])];
  const { tx } = intBox(w);
  const sameP = (a, b) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

  /* WHAT THE POINTER IS ON: a protein, else a line (in the drawing, a column
     of edge_index or a column of edge_label_index) */
  let hov = null, hovLine = null;
  if (pointer) {
    PROTEINS.forEach((_, i) => { const [x, y] = protAt(w, i); if (Math.abs(pointer.x - x) <= PILL_W / 2 && Math.abs(pointer.y - y) <= 11) hov = i; });
    if (pointer.x >= tx - 4 && pointer.x < w - 8 && pointer.y >= IX.rowTop && pointer.y < IX.rowTop + PROTEINS.length * IX.rowH) hov = Math.floor((pointer.y - IX.rowTop) / IX.rowH);
    if (hov == null) {
      let best = 6;
      lines.forEach((l, n) => { const dd = segDist(pointer.x, pointer.y, protAt(w, l.e[0]), protAt(w, l.e[1])); if (dd < best) { best = dd; hovLine = n; } });
      if (hovLine == null && pointer.y >= IT.eiTop && pointer.y < IT.eiTop + 2 * IT.cellH && pointer.x >= x0 && pointer.x < x0 + K * cw) {
        const c = cols[Math.floor((pointer.x - x0) / cw)];
        hovLine = lines.findIndex((l) => l.kind === "train" && sameP(l.e, c));
      }
      if (split && (hovLine == null || hovLine < 0) && pointer.y >= IT.lblTop && pointer.y < IT.lblTop + 3 * IT.cellH && pointer.x >= x0 && pointer.x < x0 + pairs.length * lw) {
        const k = Math.floor((pointer.x - x0) / lw);
        hovLine = lines.findIndex((l) => l.kind !== "train" && l.k === k);
      }
      if (hovLine != null && hovLine < 0) hovLine = null;
    }
  }
  const hl = hovLine != null ? lines[hovLine] : null;
  const lit = new Set(hov != null ? [hov] : hl ? hl.e : []);
  const onLine = (l) => (hov != null && (l.e[0] === hov || l.e[1] === hov)) || (hl && hl === l);

  txt(ctx, colors, S.capInt, 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: tx - 24 });
  txt(ctx, colors, S.capIntHint[split ? "split" : "plain"], 12, 30, { fill: colors.ink3, maxW: tx - 24 });

  /* x at the right, one row a protein */
  txt(ctx, colors, S.capIX, tx, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - tx - 8 });
  txt(ctx, colors, S.capIXHint, tx, 30, { fill: colors.ink3, maxW: w - tx - 8 });
  const lenX = tx + 96, kinX = tx + 140;
  txt(ctx, colors, S.ixHeads[0], lenX, IX.rowTop - 4, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  txt(ctx, colors, S.ixHeads[1], kinX, IX.rowTop - 4, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  PROTEINS.forEach((name, i) => {
    const y = IX.rowTop + i * IX.rowH + IX.rowH / 2 + 4, on = lit.has(i);
    if (on) rect(ctx, tx - 4, y - IX.rowH / 2 - 1, Math.min(w - tx - 4, 170), IX.rowH, wash(colors.groupA, 0.22));
    txt(ctx, colors, `${i} ${name}`, tx, y + 1, { font: monoFont(colors), fill: on ? colors.ink1 : colors.ink3, baseline: "middle" });
    txt(ctx, colors, PROT_X[i][0].toFixed(2), lenX, y + 1, { font: monoFont(colors), fill: colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, String(PROT_X[i][1]), kinX, y + 1, { font: PROT_X[i][1] ? boldMono(colors) : monoFont(colors), fill: PROT_X[i][1] ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  });
  txt(ctx, colors, S.ixNote, tx, IX.rowTop + PROTEINS.length * IX.rowH + 18, { fill: colors.ink3, maxW: w - tx - 8 });

  /* the lines: an edge solid, a held-out pair dashed, a negative pair dotted */
  for (const l of lines) {
    const [xa, ya] = protAt(w, l.e[0]), [xb, yb] = protAt(w, l.e[1]), on = onLine(l);
    if (l.kind === "train") line(ctx, xa, ya, xb, yb, on ? colors.groupA : colors.ink3, on ? 3 : 1.5);
    else if (l.kind === "held") line(ctx, xa, ya, xb, yb, on ? colors.groupA : colors.holdout, on ? 3 : 2.2, [6, 4]);
    else if (l.kind === "neg") line(ctx, xa, ya, xb, yb, on ? colors.groupA : colors.nonevent, on ? 3 : 2, [2, 4]);
    else {
      /* the query: dashed in the unknown colour, its "?" midway between the two pills (MDM2–ATM, round 12: TP53–BRCA1 put it behind a pill and on ATM–CHEK2) */
      line(ctx, xa, ya, xb, yb, on ? colors.groupA : colors.unknown, on ? 3 : 2, [5, 4]);
      const qx = (xa + xb) / 2, qy = (ya + yb) / 2;
      dot(ctx, qx, qy, 9, colors.surface, on ? colors.groupA : colors.unknown, 2);
      txt(ctx, colors, "?", qx, qy + 0.5, { font: nodeFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    }
  }
  /* the proteins, a pill each with its node number */
  PROTEINS.forEach((name, i) => {
    const [x, y] = protAt(w, i), on = lit.has(i);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - PILL_W / 2, y - 10, PILL_W, 20, 10);
    ctx.fillStyle = on ? colors.surface2 : colors.surface; ctx.fill();
    ctx.strokeStyle = on ? colors.groupA : colors.ink1; ctx.lineWidth = on ? 2.5 : 1.3; ctx.stroke(); ctx.restore();
    txt(ctx, colors, `${i} ${name}`, x, y + 0.5, { font: nodeFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  });

  /* edge_index, one column a direction */
  txt(ctx, colors, S.capIEI(K), 12, IT.eiTop - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  [S.rowSrc, S.rowTgt].forEach((r, t) => txt(ctx, colors, r, 12, IT.eiTop + t * IT.cellH + IT.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  cols.forEach(([i, j], k) => {
    const x = x0 + k * cw, l = lines.find((q) => q.kind === "train" && sameP(q.e, [i, j])), on = l && onLine(l);
    if (on) rect(ctx, x + 1, IT.eiTop + 1, cw - 2, 2 * IT.cellH - 2, wash(colors.groupA, 0.3));
    txt(ctx, colors, String(i), x + cw / 2, IT.eiTop + IT.cellH / 2 + 1, { font: on ? boldMono(colors) : monoFont(colors), fill: on ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, colors, String(j), x + cw / 2, IT.eiTop + 1.5 * IT.cellH + 1, { font: on ? boldMono(colors) : monoFont(colors), fill: on ? colors.ink1 : colors.ink2, align: "center", baseline: "middle" });
  });
  rect(ctx, x0, IT.eiTop, K * cw, 2 * IT.cellH, null, colors.grid);

  /* edge_label_index and edge_label, one column a pair; on the Splits page only */
  if (split) {
  txt(ctx, colors, S.capILI(pairs.length), 12, IT.lblTop - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  [S.rowNode, S.rowNode, S.rowLabel].forEach((r, t) => txt(ctx, colors, r, 12, IT.lblTop + t * IT.cellH + IT.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  if (!pairs.length) txt(ctx, colors, S.iliEmpty, x0, IT.lblTop + 1.5 * IT.cellH + 1, { fill: colors.ink3, baseline: "middle", maxW: w - x0 - 12 });
  pairs.forEach(([i, j], k) => {
    const x = x0 + k * lw, l = lines.find((q) => q.kind !== "train" && q.k === k), on = onLine(l);
    rect(ctx, x + 1, IT.lblTop + 1, lw - 2, 3 * IT.cellH - 2, wash(on ? colors.groupA : k < nHeld ? colors.holdout : colors.nonevent, on ? 0.4 : 0.25));
    txt(ctx, colors, String(i), x + lw / 2, IT.lblTop + IT.cellH / 2 + 1, { font: monoFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    txt(ctx, colors, String(j), x + lw / 2, IT.lblTop + 1.5 * IT.cellH + 1, { font: monoFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    txt(ctx, colors, String(labels[k]), x + lw / 2, IT.lblTop + 2.5 * IT.cellH + 1, { font: boldMono(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  });
  if (pairs.length) rect(ctx, x0, IT.lblTop, pairs.length * lw, 3 * IT.cellH, null, colors.grid);
  }

  /* the label beside what the pointer is on */
  if (hov != null) { const [x, y] = protAt(w, hov); hoverLabel(ctx, colors, S.intNodeLabel(PROTEINS[hov], hov, deg[hov]), x, y, w); }
  else if (hl) { const [xa, ya] = protAt(w, hl.e[0]), [xb, yb] = protAt(w, hl.e[1]); hoverLabel(ctx, colors, S.intEdgeLabel(PROTEINS[hl.e[0]], PROTEINS[hl.e[1]], hl.kind), (xa + xb) / 2, (ya + yb) / 2, w); }

  /* the status line and the note */
  txt(ctx, colors, S.intStatus(edges.length, K, split ? pairs.length : null), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  let note = S.intNote[split ? st.split : "plain"];
  if (hov != null) note = S.intNodeHover(PROTEINS[hov], hov, PROT_X[hov], deg[hov], pairs.slice(0, nHeld).filter((e) => e.includes(hov)).length);
  else if (hl) {
    const a = PROTEINS[hl.e[0]], b = PROTEINS[hl.e[1]];
    if (hl.kind === "train") note = S.intEdgeHover.train(a, b, cols.map((c, k) => (sameP(c, hl.e) ? k : -1)).filter((k) => k >= 0));
    else note = S.intEdgeHover[hl.kind](a, b, hl.k);
  }
  txt(ctx, colors, note, 12, h - 11, { fill: hov != null || hl ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* =============================================================== Splits */

/* the band for the example's level, then the example drawn below it, translated down by DIAG_H */
const DIAG = { top: 6, h: 62 };
const DIAG_H = DIAG.top + DIAG.h + 16;
const MINI = { nodes: [[0.15, 0.25], [0.5, 0.1], [0.85, 0.3], [0.2, 0.8], [0.55, 0.62], [0.88, 0.85]], edges: [[0, 1], [1, 2], [0, 3], [1, 4], [3, 4], [4, 5], [2, 5], [2, 4]] };
function miniGraph(ctx, colors, x0, y0, w, h, heldNodes, heldEdges) {
  const P = MINI.nodes.map(([u, v]) => [x0 + u * w, y0 + v * h]);
  MINI.edges.forEach(([i, j], k) => {
    const held = heldEdges.includes(k);
    line(ctx, ...P[i], ...P[j], held ? colors.holdout : colors.ink3, held ? 2 : 1.3, held ? [5, 3] : null);
  });
  P.forEach(([x, y], i) => {
    const held = heldNodes.includes(i);
    dot(ctx, x, y, 6.5, colors.surface2, held ? colors.holdout : colors.ink1, held ? 2.4 : 1.2);
    if (held) txt(ctx, colors, "?", x, y + 0.5, { font: nodeFont(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  });
}
/* a small molecule: a ring, a ring with a tail, or a chain */
function glyph(ctx, colors, cx, cy, kind) {
  const r = 8, pts = [...Array(6).keys()].map((k) => [cx + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), cy + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
  if (kind !== "chain") for (let k = 0; k < 6; k++) line(ctx, ...pts[k], ...pts[(k + 1) % 6], colors.ink1, 1.3);
  if (kind === "tail") line(ctx, ...pts[0], pts[0][0] + 8, pts[0][1] + 4, colors.ink1, 1.3);
  if (kind === "chain") {
    const c = [[cx - 12, cy + 3], [cx - 4, cy - 3], [cx + 4, cy + 3], [cx + 12, cy - 3]];
    for (let k = 0; k < 3; k++) line(ctx, ...c[k], ...c[k + 1], colors.ink1, 1.3);
    c.forEach(([x, y]) => dot(ctx, x, y, 1.8, colors.ink1));
  }
}
function drawDiagram(ctx, colors, w, page) {
  const k = EXAMPLES.findIndex((e) => e.value === page), y = DIAG.top;
  rect(ctx, 12, y, w - 24, DIAG.h, colors.surface2, colors.grid);
  /* the level's small picture at the left */
  if (k === 0) miniGraph(ctx, colors, 30, y + 10, 120, DIAG.h - 20, [1, 3], []);
  if (k === 1) miniGraph(ctx, colors, 30, y + 10, 120, DIAG.h - 20, [], [1, 4]);
  if (k === 2) {
    const gx = 22, gy = y + 18, tw = 86;
    rect(ctx, gx, gy, tw, 26, null, colors.ink3);
    ["ring", "tail", "chain"].forEach((kind, i) => glyph(ctx, colors, gx + tw * (0.18 + i * 0.32), gy + 13, kind));
    rect(ctx, gx + tw + 6, gy, 56, 26, wash(colors.holdout, 0.15), colors.holdout, 1.6);
    ["tail", "ring"].forEach((kind, i) => glyph(ctx, colors, gx + tw + 6 + 56 * (0.28 + i * 0.44), gy + 13, kind));
  }
  const tx = 184;
  txt(ctx, colors, S.splitHeads[k], tx, y + 19, { font: capFont(colors), fill: colors.ink1, maxW: w - tx - 20 });
  txt(ctx, colors, S.splitLines[k], tx, y + 36, { fill: colors.ink1, maxW: w - tx - 20 });
  txt(ctx, colors, S.splitFields[k], tx, y + 52, { font: monoFont(colors), fill: colors.ink3, maxW: w - tx - 20 });
}
/* the Molecule example's split: the table with its split column, test rows in the held-out colour */
const H_MOL_SPLIT = molTableEnd() + 30 + 46;
function molTableEnd() { return 38 + 6 * 17; }
function drawMoleculeSplit(ctx, colors, w, h) {
  drawMolTable(ctx, colors, w, null, null, true);
  txt(ctx, colors, S.splitMolNote, 12, molTableEnd() + 20, { fill: colors.ink3, maxW: w - 24 });
  const tr = MOLECULES.filter((m) => m.split === "train").length;
  txt(ctx, colors, S.splitMolStatus(tr, MOLECULES.length - tr), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
}
function drawSplits(ctx, colors, w, h, state, page, pointer) {
  drawDiagram(ctx, colors, w, page);
  const below = pointer && pointer.y >= DIAG_H ? { x: pointer.x, y: pointer.y - DIAG_H } : null;
  ctx.save(); ctx.translate(0, DIAG_H);
  if (page === "interactions") drawInteractions(ctx, colors, w, h - DIAG_H, state.interactionSplit, below, true);
  else if (page === "molecule") drawMoleculeSplit(ctx, colors, w, h - DIAG_H);
  else drawPatients(ctx, colors, w, h - DIAG_H, state.patients, true, below);
  ctx.restore();
}
const splitsHeight = (page) => DIAG_H + (page === "interactions" ? H_INT_SPLIT : page === "molecule" ? H_MOL_SPLIT : H_PAT);

/* ============================================================= Molecule */

/* the table of molecules on top; everything below it moved down by its height */
const TB = { head: 32, top: 38, rowH: 17 };
const TB_END = TB.top + 6 * TB.rowH;
const SHIFT = TB_END + 8;
const M = { strTop: 30 + SHIFT, strH: 22, molTop: 92 + SHIFT, molH: 250, xRow: 17, eiGap: 34, eiCellH: 16, attrCellH: 13, labelW: 62 };
const tableCols = (w) => [12, 34, 136, w - 120, w - 84];
/** the table row under a point, or null */
const rowAt = (y) => (y >= TB.top && y < TB_END ? Math.floor((y - TB.top) / TB.rowH) : null);
const molBottom = () => M.molTop + M.molH;
const eiTop = () => molBottom() + M.eiGap;
const attrTop = () => eiTop() + 2 * M.eiCellH + 30;
const H_MOL = attrTop() + 4 * M.attrCellH + 46;

/** a molecule's drawing, fitted into a box */
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

/* the table of the six; with `split`, its split column and the test rows in the held-out colour */
function drawMolTable(ctx, colors, w, current, hovRow, split) {
  const tc = tableCols(w);
  txt(ctx, colors, S.capTable(FILE.n, FILE.active, !split), 12, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  S.tableHeads.forEach((hd, k) => { if (k < 4 || split) txt(ctx, colors, hd, tc[k], TB.head, { font: k >= 2 ? monoFont(colors) : null, fill: colors.ink3 }); });
  MOLECULES.forEach((m, i) => {
    const y = TB.top + i * TB.rowH, mid = y + TB.rowH / 2 + 1, sel = m.name === current, test = split && m.split === "test";
    if (test) rect(ctx, 6, y, w - 12, TB.rowH - 1, wash(colors.holdout, 0.22));
    if (hovRow === i) rect(ctx, 6, y, w - 12, TB.rowH - 1, wash(colors.groupA, 0.22));
    if (sel) rect(ctx, 6, y - 1, w - 12, TB.rowH + 1, null, colors.ink1, 1.4);
    txt(ctx, colors, String(i), tc[0], mid, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
    txt(ctx, colors, m.name, tc[1], mid, { font: sel ? nodeFont(colors) : null, fill: colors.ink1, baseline: "middle", maxW: tc[2] - tc[1] - 6 });
    txt(ctx, colors, m.smiles, tc[2], mid, { font: monoFont(colors), fill: colors.ink2, baseline: "middle", maxW: tc[3] - tc[2] - 10 });
    txt(ctx, colors, String(m.y), tc[3] + 4, mid, { font: boldMono(colors), fill: colors.ink1, baseline: "middle", align: "center" });
    if (split) txt(ctx, colors, m.split, tc[4], mid, { font: test ? boldMono(colors) : monoFont(colors), fill: colors.ink1, baseline: "middle" });
  });
}

function drawMolecule(ctx, colors, w, h, st, anim, pointer, current) {
  const n = shownStep(anim), N = st.steps, s = st.smiles;
  const lastBond = n > 0 ? st.bonds[n - 1] : null;
  const molW = Math.min(w * 0.5, 360);
  const P = molPoints(st, 24, M.molTop + 10, molW - 36, M.molH - 40);
  const xX = molW + 18, xCellW = Math.min(30, (w - xX - 44) / 5);
  const cw = Math.min(17, (w - 24) / s.length), sx = (w - s.length * cw) / 2;
  const K = st.cols.length, shown = 2 * n, x0 = 12 + M.labelW, cellW = (w - x0 - 20) / K;

  /* WHAT THE POINTER IS ON: an atom (in the drawing, the string or a row of
     x), else a bond (in the drawing, or as a column of edge_index or
     edge_attr). Every table that stores it lights with it. */
  let hov = null, hovBond = null, hovRow = null;
  if (pointer) {
    hovRow = rowAt(pointer.y);
    P.forEach(([x, y], i) => { if (Math.hypot(pointer.x - x, pointer.y - y) <= 13) hov = i; });
    if (pointer.y >= M.strTop && pointer.y <= M.strTop + M.strH + 14) {
      const k = Math.floor((pointer.x - sx) / cw);
      st.atoms.forEach((a, i) => { if (k >= a.char[0] && k < a.char[0] + a.char[1]) hov = i; });
    }
    if (pointer.x >= xX && pointer.x < w - 8 && pointer.y >= M.molTop + 4 && pointer.y < M.molTop + 4 + st.atoms.length * M.xRow) hov = Math.floor((pointer.y - M.molTop - 4) / M.xRow);
    if (hov == null) {
      let best = 6;
      st.bonds.forEach(([i, j], k) => { const d = segDist(pointer.x, pointer.y, P[i], P[j]); if (d < best) { best = d; hovBond = k; } });
      const inEI = pointer.y >= eiTop() && pointer.y < eiTop() + 2 * M.eiCellH;
      const inAttr = pointer.y >= attrTop() && pointer.y < attrTop() + 4 * M.attrCellH;
      if (hovBond == null && (inEI || inAttr) && pointer.x >= x0 && pointer.x < x0 + K * cellW) hovBond = Math.floor(Math.floor((pointer.x - x0) / cellW) / 2);
    }
  }
  const hb = hovBond != null ? st.bonds[hovBond] : null;
  const lastAtoms = lastBond ? new Set([lastBond[0], lastBond[1]]) : new Set();
  const litAtoms = new Set(hov != null ? [hov] : hb ? [hb[0], hb[1]] : []);
  const litChars = new Set(hb ? st.bondChar[hovBond] : []);
  const ownChars = new Set(n > 0 ? st.bondChar[n - 1] : []);

  /* 0 · the table of the six, the current one framed */
  drawMolTable(ctx, colors, w, current, hovRow, false);

  /* 1 · the string, one character a cell */
  txt(ctx, colors, S.capString, 12, M.strTop - 16, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  const owner = new Array(s.length).fill(null);
  st.atoms.forEach((a, i) => { for (let k = 0; k < a.char[1]; k++) owner[a.char[0] + k] = i; });
  for (let k = 0; k < s.length; k++) {
    const i = owner[k];
    const fill = litChars.has(k) ? colors.groupA : i != null && litAtoms.has(i) ? wash(colors.groupA, 0.32)
      : ownChars.has(k) ? colors.highlight : i != null && lastAtoms.has(i) ? wash(colors.highlight, 0.32) : colors.surface2;
    const solid = litChars.has(k) || (ownChars.has(k) && !litAtoms.size);
    rect(ctx, sx + k * cw, M.strTop, cw, M.strH, fill, colors.grid);
    txt(ctx, colors, s[k], sx + k * cw + cw / 2, M.strTop + M.strH / 2 + 1, { font: i != null || solid ? boldMono(colors) : monoFont(colors), fill: solid ? colors.surface : i != null ? colors.ink1 : colors.ink3, align: "center", baseline: "middle" });
  }
  st.atoms.forEach((a, i) => txt(ctx, colors, String(i), sx + (a.char[0] + a.char[1] / 2) * cw, M.strTop + M.strH + 12, { font: monoFont(colors), fill: lastAtoms.has(i) || litAtoms.has(i) ? colors.ink1 : colors.ink3, align: "center" }));
  /* the latest bond's two atoms bracketed under the numbers; the hovered bond's instead while the pointer is on one */
  const br = hb ?? lastBond;
  if (br) {
    const [i, j] = br, xa = sx + (st.atoms[i].char[0] + 0.5) * cw, xb = sx + (st.atoms[j].char[0] + 0.5) * cw, yb = M.strTop + M.strH + 18, col = hb ? colors.groupA : colors.highlight;
    line(ctx, xa, yb, xa, yb + 6, col, 1.6); line(ctx, xb, yb, xb, yb + 6, col, 1.6); line(ctx, xa, yb + 6, xb, yb + 6, col, 1.6);
  }

  /* 2 · the drawing: added bonds in ink, the latest in the highlight, the rest faint; the hovered one thick */
  txt(ctx, colors, S.capMol, 12, M.molTop, { font: capFont(colors), fill: colors.ink1 });
  st.bonds.forEach(([i, j, type], k) => {
    const added = k < n, latest = k === n - 1, on = k === hovBond;
    bond(ctx, P[i], P[j], type, on ? colors.groupA : latest ? colors.highlight : added ? colors.ink1 : colors.grid, on ? 3 : latest ? 2.2 : 1.5, !added);
  });
  st.atoms.forEach((a, i) => {
    node(ctx, colors, P[i][0], P[i][1], 11, a.el, { fill: litAtoms.has(i) ? wash(colors.groupA, 0.35) : lastAtoms.has(i) ? wash(colors.highlight, 0.3) : null });
    txt(ctx, colors, String(i), P[i][0] + 12, P[i][1] - 9, { font: monoFont(colors), fill: colors.ink3, halo: true });
  });
  txt(ctx, colors, S.molKey, 12, molBottom() - 2, { fill: colors.ink3, maxW: molW - 12 });

  /* 3 · x, at the right, one row an atom */
  txt(ctx, colors, S.capMolX(st.atoms.length), xX, M.molTop, { font: capFont(colors), fill: colors.ink1, maxW: w - xX - 12 });
  st.atoms.forEach((a, i) => txt(ctx, colors, `${i} ${a.el}`, xX, M.molTop + 4 + i * M.xRow + M.xRow / 2 + 1, { font: monoFont(colors), fill: litAtoms.has(i) || lastAtoms.has(i) ? colors.ink1 : colors.ink3, baseline: "middle" }));
  matrix(ctx, colors, xX + 36, M.molTop + 4, st.atoms.map((a) => a.x), {
    cellW: xCellW, cellH: M.xRow,
    hl: (i) => (litAtoms.has(i) ? wash(colors.groupA, 0.3) : lastAtoms.has(i) ? wash(colors.highlight, 0.28) : null),
  });

  /* 4 · edge_index and, under each of its columns, that column's row of edge_attr */
  const isLast = (k) => lastBond && (k === shown - 1 || k === shown - 2);
  const isHov = (k) => hovBond != null && Math.floor(k / 2) === hovBond;
  const touches = (k) => hov != null && (st.cols[k][0] === hov || st.cols[k][1] === hov);
  txt(ctx, colors, S.capMolEI(shown), 12, eiTop() - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  txt(ctx, colors, S.rowSrc, 12, eiTop() + M.eiCellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  txt(ctx, colors, S.rowTgt, 12, eiTop() + M.eiCellH * 1.5 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" });
  matrix(ctx, colors, x0 - 3, eiTop(), [st.cols.map((c, k) => (k < shown ? c[0] : null)), st.cols.map((c, k) => (k < shown ? c[1] : null))], {
    cellW, cellH: M.eiCellH,
    hl: (i, k) => (k >= shown ? null : isHov(k) ? wash(colors.groupA, 0.4) : touches(k) ? wash(colors.groupA, 0.25) : isLast(k) ? wash(colors.highlight, 0.32) : null),
  });
  txt(ctx, colors, S.capAttr(shown), 12, attrTop() - 8, { font: capFont(colors), fill: colors.ink1, maxW: w - 24 });
  S.attrRows.forEach((r, t) => txt(ctx, colors, r, 12, attrTop() + t * M.attrCellH + M.attrCellH / 2 + 1, { font: monoFont(colors), fill: colors.ink3, baseline: "middle" }));
  for (let k = 0; k < K; k++) for (let t = 0; t < 4; t++) {
    const x = x0 + k * cellW, y = attrTop() + t * M.attrCellH, on = k < shown && st.attr[k][t] === 1;
    rect(ctx, x + 1, y + 1, cellW - 2, M.attrCellH - 2, on ? (isHov(k) || touches(k) ? colors.groupA : isLast(k) ? colors.highlight : colors.ink2) : k < shown ? colors.surface2 : null);
  }
  rect(ctx, x0, attrTop(), K * cellW, 4 * M.attrCellH, null, colors.grid);

  /* the label beside what the pointer is on */
  if (hov != null) hoverLabel(ctx, colors, S.molAtomLabel(hov, st.atoms[hov].el), P[hov][0], P[hov][1], w);
  else if (hb) hoverLabel(ctx, colors, S.molBondLabel(hovBond + 1, st.atoms[hb[0]].el, st.atoms[hb[1]].el, hb[2]), (P[hb[0]][0] + P[hb[1]][0]) / 2, (P[hb[0]][1] + P[hb[1]][1]) / 2, w);

  /* the status line and the note */
  txt(ctx, colors, n === 0 ? S.molStart : S.molStatus(n, N, lastBond[0], lastBond[1], st.atoms[lastBond[0]].el, st.atoms[lastBond[1]].el, lastBond[2]), 12, h - 26, { font: `600 ${colors.fsXs} ${colors.font}`, fill: colors.ink1, maxW: w - 24 });
  let note = S.molNote;
  if (hovRow != null) { const m = MOLECULES[hovRow]; note = S.rowHover(m.name, m.atoms.length, m.bonds.length); }
  else if (hov != null) note = S.molHover(hov, st.atoms[hov].x);
  else if (hb) note = S.molBondHover(hovBond + 1, hb[0], hb[1], hb[2], hovBond < n, [2 * hovBond, 2 * hovBond + 1], st.bondChar[hovBond].map((p) => `"${s[p]}"`));
  txt(ctx, colors, note, 12, h - 11, { fill: hov != null || hb || hovRow != null ? colors.ink1 : colors.ink3, maxW: w - 24 });
}

/* ================================================================ widget */

defineWidget({
  slug: "graph-representation",
  status: "shipped",
  title: "Deep Learning - Graphs: Representation",
  subtitle: S.subtitle,
  layout: "side",
  height: (params) => (isSplit(params) ? splitsHeight(params.page) : params.page === "molecule" ? H_MOL : params.page === "patients" ? H_PAT : params.page === "interactions" ? H_INT : H_GRAPH),
  pointer: true,

  params: {
    /* Basics over Graph, Examples over the three (core's group, widget 85's form); no field label,
       since the buttons are not steps and the two headings name them (round 8) */
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, groupHeads: true, default: "graph", display: true },
    /* every Graph-page control is display: none may reset the Molecule page's press */
    nodes: { type: "choice", label: S.nodesLabel, detail: S.nodesDetail, options: COUNTS, default: "4", display: true, when: ON("graph") },
    edges: { type: "segmented", label: S.edgesLabel, detail: S.edgesDetail, options: EDGES, default: "undirected", display: true, when: ON("graph") },
    order: { type: "segmented", label: S.orderLabel, detail: S.orderDetail, options: ORDERS, default: "abc", display: true, when: ON("graph") },
    graph: {
      type: "text", label: S.graphLabel, detail: S.graphDetail, maxLength: 120, default: "", display: true, when: ON("graph"),
      parse: parseGraph,
      show: (v) => pairsOf(v).map((pq) => `${pq[0]}-${pq[1]}`).join(", "),
    },
    /* the Patients page's controls are display too, for the same reason */
    k: { type: "choice", label: S.kLabel, detail: S.kDetail, options: KS, default: "2", display: true, when: ON("patients") },
    /* the example as data, or its split: a view of whichever example is selected, so it follows the example */
    show: { type: "segmented", label: S.showLabel, detail: S.showDetail, options: SHOWS, default: "representation", display: true, when: { param: "page", oneOf: ["patients", "interactions", "molecule"] } },
    split: { type: "segmented", label: S.splitLabel, detail: S.splitDetail, options: SPLITS, default: "all", display: true, when: { all: [ON("interactions"), { param: "show", equals: "split" }] } },
    /* a DATA parameter: a new molecule starts its bonds again from the first */
    mol: { type: "select", label: S.molLabel, detail: S.molDetail, options: MOLS, default: "caffeine", when: { all: [ON("molecule"), { param: "show", equals: "representation" }] } },
    /* authoring escape hatch, first render only: bonds already added on the Molecule page */
    shown: { type: "int", min: 0, max: 15, default: 0, hidden: true },
  },

  /* the subtypes' colours on Patients; on Splits, what is held out in the example shown */
  legend: ({ params }) => {
    const subtypes = [{ token: "cluster-a", label: "Luminal", mark: "dot" }, { token: "cluster-b", label: "HER2-like", mark: "dot" }];
    if (!isSplit(params)) {
      if (params.page === "patients") return [...subtypes, { token: "unknown", label: "Subtype to predict", mark: "hollow" }, { token: "extreme", label: "An edge joining two subtypes", mark: "line" }];
      if (params.page === "interactions") return [{ token: "unknown", label: "A pair to predict", mark: "dash" }];
      return [];
    }
    if (params.page === "patients") return [...subtypes, { token: "holdout", label: "Held out, test_mask", mark: "hollow" }, { token: "unknown", label: "No mask", mark: "hollow" }];
    if (params.page === "molecule") return [{ token: "holdout", label: "Test: held out whole", mark: "bar" }];
    return [
      ...(params.split !== "all" ? [{ token: "holdout", label: "Held out, label 1", mark: "dash" }] : []),
      ...(params.split === "negatives" ? [{ token: "nonevent", label: "No edge, label 0", mark: "dash" }] : []),
    ];
  },

  compute,

  regions: ({ w, params, state }) => (params.page === "graph" ? graphRegions(w, params, state?.graph ?? graphTables(params))
    /* a row of the table picks its molecule */
    : isSplit(params) ? []
    : params.page === "molecule" ? MOLECULES.map((m, i) => ({ x: 6, y: TB.top + i * TB.rowH, w: w - 12, h: TB.rowH, set: { mol: m.name }, label: m.name }))
    : []),

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const stage = stageOf(params);
      const anim = { stage, n: { graph: 0, patients: 0, interactions: 0, molecule: 0 }, t: 1, moving: false, halt: false };
      anim.n.molecule = fromScratch ? 0 : Math.max(0, Math.min(state.molecule.steps, Number(params.shown) || 0));
      anim.done = anim.n[stage] >= stepsOf(state, stage);
      /* only the Molecule page has a press: core takes Step and Play out of the row elsewhere */
      anim.inert = stage !== "molecule";
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
      anim.n[stage] = Math.min(anim.n[stage] ?? 0, stepsOf(state, stage));
      anim.done = anim.n[stage] >= stepsOf(state, stage);
      anim.inert = stage !== "molecule";
    },
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    if (isSplit(params)) drawSplits(ctx, colors, w, h, state, params.page, pointer);
    else if (params.page === "molecule") drawMolecule(ctx, colors, w, h, state.molecule, anim, pointer, params.mol);
    else if (params.page === "interactions") drawInteractions(ctx, colors, w, h, state.interactions, pointer, false);
    else if (params.page === "patients") drawPatients(ctx, colors, w, h, state.patients, false, pointer);
    else drawGraph(ctx, colors, w, h, state.graph, pointer);
  },

  readout({ params, state, anim }) {
    if (params.page === "molecule" && !isSplit(params)) {
      const st = state.molecule, n = anim.n.molecule;
      const types = ["SINGLE", "DOUBLE", "TRIPLE", "AROMATIC"].map((t) => st.bonds.slice(0, n).filter((b) => b[2] === t).length);
      return [
        { label: S.tileY, value: String(st.y), note: S.tileYNote(st.y, st.name) },
        { label: S.tileBonds, value: `${n} of ${st.steps}`, note: S.tileBondsNote },
        { label: S.tileTypes, value: n === 0 ? S.tileWait : types.join(" · "), note: S.tileTypesNote },
      ];
    }
    if (isSplit(params)) {
      if (params.page === "patients") return [
        { label: S.tileTrainMask, value: `${TRAIN.size} of 12`, note: S.tileTrainMaskNote },
        { label: S.tileTestMask, value: `${TEST.size} of 12`, note: S.tileTestMaskNote },
        { label: S.tileNoMask, value: `${12 - TRAIN.size - TEST.size} of 12`, note: S.tileNoMaskNote },
      ];
      if (params.page === "molecule") {
        const tr = MOLECULES.filter((m) => m.split === "train").length;
        return [
          { label: S.tileTrainSet, value: `${tr} of ${MOLECULES.length}`, note: S.tileTrainSetNote },
          { label: S.tileTestSet, value: `${MOLECULES.length - tr} of ${MOLECULES.length}`, note: S.tileTestSetNote },
          { label: S.tileLesson, value: [FILE.train, FILE.val, FILE.test].map((v) => v.toLocaleString("en")).join(" · "), note: S.tileLessonNote },
        ];
      }
      const st = state.interactionSplit;
      return [
        { label: S.tileIEdges, value: `${st.edges.length} of ${INTERACTIONS.length}`, note: S.tileIEdgesNote },
        { label: S.tileLabel(st.pairs.length), value: st.labels.length ? st.labels.join(" ") : S.tileWait, note: S.tileLabelNote },
        { label: S.tileHeld, value: String(st.nHeld), note: S.tileHeldNote },
      ];
    }
    if (params.page === "interactions") {
      const n = PROTEINS.length, pairs = (n * (n - 1)) / 2;
      return [
        { label: S.tileTask, value: S.tileTaskValue, note: S.tileTaskNote },
        { label: S.tileIEdges, value: String(INTERACTIONS.length), note: S.tileIEdgesNote },
        { label: S.tileOpen, value: `${pairs - INTERACTIONS.length} of ${pairs}`, note: S.tileOpenNote },
      ];
    }
    if (params.page === "patients") {
      /* homophily over the edges between two known patients: the query's subtype is not shown */
      const st = state.patients, known = st.edges.filter(([i, j]) => i !== QUERY && j !== QUERY);
      const same = known.filter(([i, j]) => PATIENTS[i][2] === PATIENTS[j][2]).length;
      return [
        { label: S.tileTask, value: S.tilePTaskValue, note: S.tilePTaskNote },
        { label: S.tilePEdges, value: String(st.edges.length), note: S.tilePEdgesNote },
        { label: S.tileHomo, value: (same / known.length).toFixed(2), note: S.tileHomoNote(same, known.length) },
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
    if (isSplit(params)) return S.sumSplits(params.page);
    if (params.page === "molecule") return S.sumMol(state.molecule.name, anim.n.molecule, state.molecule.steps);
    if (params.page === "interactions") return S.sumIntPlain(state.interactions.edges.length);
    if (params.page === "patients") return S.sumPat(state.patients.k, state.patients.edges.length) + S.sumPatQuery;
    return S.sumGraph(state.graph.n, state.graph.edges.length, state.graph.directed);
  },
});
