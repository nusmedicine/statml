/* cell-markers — slot 81, "Single-Cell RNA-seq: Clusters and Markers". DRAFT.
 *
 * REORGANISED 2026-09-25 into the notebook's order, on his word ("summarize
 * what we covered in the notebook … how can we organize the widget so that
 * it's aligned?"), with Composition kept as a fourth page. 02-4:
 *
 *   1 · Clusters        cells 4–14  FindNeighbors + FindClusters on the
 *                        integrated embedding, then canonical markers
 *                        (FeaturePlot, DoHeatmap) to name each cluster —
 *                        here the UMAP by cluster and by type, a resolution
 *                        control, and the dot plot of each type's markers
 *   2 · Two clusters     cells 15–16  FindMarkers(ident.1, ident.2) — the
 *                        comparator against a baseline (one cluster or all
 *                        other cells), picked on the map; significant is not
 *                        specific
 *   3 · Tumour vs liver  cells 17–21  FindMarkers(tumor_5, background_5) —
 *                        one cluster's cells split by the samples' tissue,
 *                        tested over cells (the lesson's call) and over
 *                        samples (pseudobulk: each sample's cells summed,
 *                        then widget 78's DESeq2), under a true change and
 *                        the sample and patient effects
 *   4 · Composition      a type's share per sample, liver against tumour,
 *                        over cells and over samples (arcsine square root)
 *
 * Zonation, conserved markers, the magnified hepatocytes and the lobule strip
 * are gone as clutter (his word: "we are going deep into liver architecture
 * but using it as an illustration").
 *
 * THE MAP AND THE CLUSTERS ARE BUILT ON INTEGRATED COUNTS, THE TESTS ON THE
 * UNCORRECTED ONES, as the lesson does (it clusters on integrated.cca and its
 * FindMarkers reads the RNA assay) and as OSCA recommends. Measured
 * (`_lab/cell-markers-page3-measure.txt`): clustered on counts that carry the
 * patient effect, every type split by patient (11–13 clusters for 6 types,
 * ARI 0.6); on the integrated counts, 6 clusters, ARI 1.00, every cluster
 * drawing on all four samples. Each cell carries both (`engine.js`,
 * `integrated`), drawn from separate streams, so moving the sample, patient
 * or condition effect leaves the map where it is.
 *
 * compute() does the heavy steps once per input, kept in module caches keyed
 * by exactly the parameters they read; the output depends on the parameters
 * alone, as compute must.
 */
import { defineWidget, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";
import { analyse } from "../deseq2/engine.js";
import { simulate, normalise, pcaScaled, knn, snn, findClusters, findMarkers, geneKind, geneName, isConditionGene, TYPES, SAMPLES, G, G_MARK } from "./engine.js";
import { umapSgd } from "./umap.js";

const PAGES = [
  { value: "clusters", label: "Clusters" },
  { value: "two-clusters", label: "Two clusters" },
  { value: "tumour-liver", label: "Tumour vs liver" },
  { value: "composition", label: "Composition" },
];
const ON = (page) => ({ param: "page", equals: page });
const CELL_PAGES = { param: "page", oneOf: ["clusters", "two-clusters", "tumour-liver"] };
const HEIGHTS = { clusters: 760, "two-clusters": 770, "tumour-liver": 760, composition: 380 };
const RESOLUTIONS = ["0.1", "0.3", "0.5", "0.8", "1.2", "2"];
const SAMPLE_SD = ["0", "0.1", "0.2", "0.4", "0.65"];
const PATIENT_SD = ["0", "0.3", "0.65"];
const CHANGES = ["0", "0.5", "1", "2"];
const COMP_SD = ["0", "0.3", "0.6"];
const CELLS_PER_SAMPLE = 300, COMP_CELLS = 400, MAX_ROWS = 12;
/* a cluster is tested by tissue only if every sample holds this many of its
   cells: tumour cells are absent from one liver sample and hepatocytes rare
   in the tumour samples (page3-measure) */
const MIN_PER_SAMPLE = 5;
const ORDER = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
const ORDER_NAMES = [["Patient 1", "liver"], ["Patient 2", "liver"], ["Patient 1", "tumour"], ["Patient 2", "tumour"]];
const ALL_TYPES = TYPES.map((t) => t.key);
/* which --c-cluster-* slot each type wears, as widget 80: hepatocyte a (blue), tumour c (red), … */
const TYPE_SLOT = [0, 2, 1, 3, 4, 5];
const pct = (v) => `${Math.round(100 * v)}%`;
const LOG05 = Math.log10(0.05);
const pFmt = (lp) => (lp < -300 ? "0" : lp > -2 ? (10 ** lp).toFixed(3) : `1e${Math.round(lp)}`);

/* ------------------------------------------------------------ the caches */
const caches = { stage: new Map(), embed: new Map(), clusters: new Map(), markers: new Map(), cond: new Map(), comp: new Map() };
const remember = (map, key, make) => { if (!map.has(key)) { if (map.size > 8) map.delete(map.keys().next().value); map.set(key, make()); } return map.get(key); };
const derived = (seed, salt) => (seed * 7919 + salt) % 2147483647;

/** The cells, with the sample, patient and condition effects in their
    uncorrected counts (the ones tested) and not in their integrated counts
    (the ones mapped and clustered). A true change, when set, is in every
    type's tumour-sample cells, so whichever cluster is picked carries one. */
function stageFor(seed, sampleSd, patientSd, change) {
  return remember(caches.stage, `${seed}|${sampleSd}|${patientSd}|${change}`, () => {
    const cells = simulate(makeRng(derived(seed, 1)), {
      cells: CELLS_PER_SAMPLE, patientSd: Number(patientSd), sampleSd: Number(sampleSd),
      condition: Number(change), conditionTypes: ALL_TYPES, integrated: true,
    });
    return { cells, Y: normalise(cells) };
  });
}
/** The map and the graph, from the integrated counts — the same at every
    setting of the effects, so it is keyed by the seed alone. */
function embedFor(seed) {
  return remember(caches.embed, String(seed), () => {
    const { cells } = stageFor(seed, "0", "0.3", "0");
    const Yi = normalise(cells.map((c) => ({ x: c.xi })));
    const P = pcaScaled(Yi, 20, makeRng(derived(seed, 2)));
    const adj = snn(knn(P, 20));
    const { Y: U } = umapSgd(P, { nEpochs: 200, rng: makeRng(derived(seed, 3)) });
    return { adj, U };
  });
}
/** The clusters at a resolution, each named by the type most of its cells
    are, with its cells in each of the four samples. */
function clustersFor(seed, res) {
  return remember(caches.clusters, `${seed}|${res}`, () => {
    const E = embedFor(seed), { cells } = stageFor(seed, "0", "0.3", "0");
    const r = findClusters(E.adj, Number(res), makeRng(derived(seed, 4)));
    const ann = Array.from({ length: r.k }, (_, c) => {
      const idx = []; r.clusters.forEach((v, i) => { if (v === c) idx.push(i); });
      const counts = new Array(TYPES.length).fill(0); idx.forEach((i) => { counts[cells[i].type] += 1; });
      const type = counts.indexOf(Math.max(...counts));
      const perSample = Object.fromEntries(ORDER.map((k) => [k, idx.filter((i) => cells[i].sample === k).length]));
      return { c, idx, n: idx.length, type, perSample, testable: ORDER.every((k) => perSample[k] >= MIN_PER_SAMPLE) };
    });
    /* a type's clusters take its hue, lighter to darker by size */
    ann.forEach((a) => { const sib = ann.filter((q) => q.type === a.type); const j = sib.indexOf(a); a.alpha = sib.length === 1 ? 0.9 : 0.95 - 0.5 * (j / (sib.length - 1)); });
    return { clusters: r.clusters, q: r.q, k: r.k, ann };
  });
}
const clusterLabel = (a) => `Cluster ${a.c} · ${TYPES[a.type].name}`;
/* a cluster as a button: its type's name and its number, with its type's dot */
const clusterOption = (a) => ({ value: String(a.c), label: `${TYPES[a.type].name} · ${a.c}`, token: `cluster-${"abcdef"[TYPE_SLOT[a.type]]}` });
function clusterOptions(v) { return clustersFor(v.seed, v.res).ann.slice(0, MAX_ROWS).map(clusterOption); }
/* the testable clusters, the Kupffer ones first: the lesson's own example is
   its Kupffer cluster (02-4 cell 21), and the page opens on the first */
function testableOptions(v) {
  const kup = TYPES.findIndex((t) => t.key === "kupffer");
  return clustersFor(v.seed, v.res).ann.slice(0, MAX_ROWS).filter((a) => a.testable)
    .sort((a, b) => (b.type === kup) - (a.type === kup) || a.c - b.c)
    .map(clusterOption);
}

/** FindMarkers for the comparison on screen, on the uncorrected counts. */
function markersFor(params, cl) {
  const tested = Math.min(Number(params.comparator), cl.k - 1);
  const vsRest = params.baseline === "rest";
  let otherC = vsRest ? 0 : Math.min(Number(params.baseline), cl.k - 1);
  if (!vsRest && otherC === tested) otherC = tested === 0 ? Math.min(1, cl.k - 1) : 0;
  return remember(caches.markers, `${params.seed}|${params.res}|${params.sampleSd}|${params.patientSd}|${params.change}|${tested}|${vsRest ? "rest" : otherC}`, () => {
    const S = stageFor(params.seed, params.sampleSd, params.patientSd, params.change);
    const inA = (i) => cl.clusters[i] === tested, inB = vsRest ? (i) => cl.clusters[i] !== tested : (i) => cl.clusters[i] === otherC;
    return { fm: findMarkers(S.Y, inA, inB, { nGenes: 33538 }), tested, otherC, vsRest, type: cl.ann[tested].type };
  });
}

/** One cluster's cells, tumour samples against liver samples: over cells
    (the lesson's FindMarkers), and over the four samples (pseudobulk: each
    sample's cells of the cluster summed, then widget 78's DESeq2). */
function conditionFor(params, cl) {
  const within = Math.min(Number(params.within), cl.k - 1);
  return remember(caches.cond, `${params.seed}|${params.res}|${params.sampleSd}|${params.patientSd}|${params.change}|${within}`, () => {
    const S = stageFor(params.seed, params.sampleSd, params.patientSd, params.change);
    const a = cl.ann[within];
    if (!a.testable) return { within, a, testable: false };
    const inC = (i) => cl.clusters[i] === within;
    const fm = findMarkers(S.Y, (i) => inC(i) && S.cells[i].tissue === "tumour", (i) => inC(i) && S.cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    const truthOf = (g) => Number(params.change) > 0 && isConditionGene(g);
    const volC = fm.res.map((x) => ({ g: x.g, lfc: x.lfc, nl: -x.lp, call: x.lpAdj < LOG05, truth: truthOf(x.g) }));
    const counts = Array.from({ length: G }, (_, g) => ORDER.map((k) => a.idx.reduce((s, i) => s + (S.cells[i].sample === k ? S.cells[i].x[g] : 0), 0)));
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    const volD = an.expressed.map((g) => ({ g, lfc: an.resMAP[g].lfc, nl: -Math.log10(Math.max(1e-300, an.resMAP[g].p)), call: an.resMAP[g].padj < 0.05, truth: truthOf(g) }));
    /* the unchanged gene with the smallest p over cells, drawn cell by cell */
    const nullG = fm.res.filter((x) => geneKind(x.g).kind === "spread" && !truthOf(x.g)).sort((p, q) => p.lp - q.lp)[0];
    const exVals = ORDER.map((k) => a.idx.filter((i) => S.cells[i].sample === k).map((i) => S.Y[i][nullG.g]));
    return { within, a, testable: true, volC, volD, ex: nullG, exVals, n: fm.n1 + fm.n2 };
  });
}

/* each sample's share of each type, and a test per type of liver against
   tumour over CELLS (the pooled 2x2 counts, a chi-square) and over SAMPLES
   (the four shares, arcsine square root, a t-test on 2 against 2 — the logit
   failed on tumour cells, 1% to 50%, in 8 of 8 seeds: compare-measure C3) */
function compositionFor(seed, compSd) {
  return remember(caches.comp, `${seed}|${compSd}`, () => {
    const cells = simulate(makeRng(derived(seed, 5)), { cells: COMP_CELLS, patientSd: 0, compSd: Number(compSd) });
    const n = {}; SAMPLES.forEach((sm) => { n[sm.key] = new Array(TYPES.length).fill(0); }); cells.forEach((c) => { n[c.sample][c.type] += 1; });
    const types = TYPES.map((t, ti) => {
      const a = n["p1-liver"][ti] + n["p2-liver"][ti], c2 = n["p1-tumour"][ti] + n["p2-tumour"][ti], b = 2 * COMP_CELLS - a, d = 2 * COMP_CELLS - c2, N = 4 * COMP_CELLS;
      const x2 = (N * (a * d - b * c2) ** 2) / ((a + b) * (c2 + d) * (a + c2) * (b + d) || 1);
      const tr = (k) => Math.asin(Math.sqrt(n[k][ti] / COMP_CELLS));
      const L = [tr("p1-liver"), tr("p2-liver")], T = [tr("p1-tumour"), tr("p2-tumour")], m1 = (L[0] + L[1]) / 2, m2 = (T[0] + T[1]) / 2;
      const v = ((L[0] - m1) ** 2 + (L[1] - m1) ** 2 + (T[0] - m2) ** 2 + (T[1] - m2) ** 2) / 2, tt = (m2 - m1) / Math.sqrt(v || 1e-12);
      return { ti, liver: a / (2 * COMP_CELLS), tumour: c2 / (2 * COMP_CELLS), pCells: chi2P(x2), pSamples: tP(tt, 2) };
    });
    return { n, types };
  });
}
function chi2P(x2) { // df 1: p = erfc(sqrt(x2 / 2))
  const z = Math.sqrt(x2 / 2), t = 1 / (1 + 0.5 * z);
  return t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
}
function tP(t, df) { return ibeta(df / (df + t * t), df / 2, 0.5); }
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d; for (let m = 1; m <= 300; m += 1) { const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c; aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/* ------------------------------------------------------------ geometry (5.8) */
const TOP = 26;
/* the view keeps a margin, so a cluster's disc and name fit inside the box */
function mapView(U, M, margin = 1.06) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of U) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const half = (Math.max(x1 - x0, y1 - y0) / 2) * margin, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return (p) => [M.x + M.S / 2 + ((p[0] - mx) / half) * (M.S / 2 - 6), M.y + M.S / 2 - ((p[1] - my) / half) * (M.S / 2 - 6)];
}
/* EACH CLUSTER A NAMED, SHADED DISC (his round: "umap with larger clusters,
   with names of cell types, then clickable"; `_lab/cell-markers-picker-mock`).
   UMAP draws separated types as small dense blobs; the disc is centred on the
   cluster's cells and reaches past 95% of them, never smaller than a fixed
   share of the map, so every cluster is a target of a readable size. */
const discCache = new WeakMap();
function discsFor(state, M) {
  const key = `${M.x},${M.y},${M.S}`, per = discCache.get(state) ?? new Map();
  if (per.has(key)) return per.get(key);
  const at = mapView(state.embed.U, M, 1.25);
  const discs = state.cl.ann.map((a) => {
    const pts = a.idx.map((i) => at(state.embed.U[i]));
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const ds = pts.map((q) => Math.hypot(q[0] - cx, q[1] - cy)).sort((p, q) => p - q);
    return { a, cx, cy, r: Math.max(M.S * 0.07, ds[Math.floor(0.95 * (ds.length - 1))] * 1.35 + 6), pts };
  });
  per.set(key, discs); discCache.set(state, per);
  return discs;
}
/* the discs as TILE-pixel squares for core's rectangle hit test, each the
   disc it lies deepest inside; kept per state, since regions are rebuilt on
   every pointer move */
const TILE = 6, tileCache = new WeakMap();
function discTiles(state, M) {
  const key = `${M.x},${M.y},${M.S}`, per = tileCache.get(state) ?? new Map();
  if (per.has(key)) return per.get(key);
  const discs = discsFor(state, M), tiles = [];
  for (let ty = M.y; ty < M.y + M.S; ty += TILE) for (let tx = M.x; tx < M.x + M.S; tx += TILE) {
    let best = null, bd = 1;
    for (const d of discs) { const dd = Math.hypot(tx + TILE / 2 - d.cx, ty + TILE / 2 - d.cy) / d.r; if (dd < bd) { bd = dd; best = d.a.c; } }
    if (best !== null) tiles.push({ x: tx, y: ty, w: TILE, h: TILE, c: best });
  }
  per.set(key, tiles); tileCache.set(state, per);
  return tiles;
}
function clustersLayout(w) {
  const S = Math.min(340, Math.floor((w - 24) / 2)), x0 = Math.floor((w - (2 * S + 24)) / 2);
  return { maps: [{ x: x0, y: TOP, S }, { x: x0 + S + 24, y: TOP, S }], dotTop: TOP + 340 + 96, rowH: 22, labelW: 150 };
}
/* Two clusters: the comparator's map and the baseline's, side by side, and
   "All other cells" under the baseline's (his pick A from the picker mock:
   each map sets one thing, so no switch says what a click does) */
const MAP_MAX = 360;
function twoLayout(w) {
  const S = Math.min(MAP_MAX, Math.floor((w - 24) / 2)), x0 = Math.floor((w - (2 * S + 24)) / 2);
  const maps = [{ x: x0, y: TOP, S }, { x: x0 + S + 24, y: TOP, S }];
  return { maps, rest: { x: maps[1].x, y: TOP + S + 10, w: S, h: 28 }, tableTop: TOP + MAP_MAX + 10 + 28 + 50 };
}
function tlLayout(w) {
  const S = Math.min(260, Math.floor(w * 0.45));
  return { map: { x: 8, y: TOP, S }, tableX: 8 + S + 28, volTop: TOP + 260 + 50, stripTop: TOP + 260 + 50 + 250 + 50 };
}

/* ------------------------------------------------------------ drawing */
function heading(ctx, colors, text, x, y) {
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}
function centroid(state, a) {
  const U = state.embed.U;
  return [a.idx.reduce((s, i) => s + U[i][0], 0) / a.n, a.idx.reduce((s, i) => s + U[i][1], 0) / a.n];
}
/** The map: `style(a, c)` returns { col, alpha } for a cell of cluster a;
    numbered badges at each cluster's centre, filled for `filled`, outlined
    for `outlined`; or the type names, for the map coloured by type. */
function drawMap(ctx, colors, state, M, style, { filled = -1, outlined = -1, typeLabels = false } = {}) {
  const at = mapView(state.embed.U, M), cl = state.cl;
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(M.x + 0.5, M.y + 0.5, M.S - 1, M.S - 1);
  state.stage.cells.forEach((c, i) => {
    const s = style(cl.ann[cl.clusters[i]], c);
    const q = at(state.embed.U[i]);
    ctx.fillStyle = s.col; ctx.globalAlpha = s.alpha;
    ctx.beginPath(); ctx.arc(q[0], q[1], 2.3, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (typeLabels) {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    TYPES.forEach((t, ti) => {
      const idx = state.stage.cells.map((c, i) => (c.type === ti ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      const q = at([idx.reduce((s, i) => s + state.embed.U[i][0], 0) / idx.length, idx.reduce((s, i) => s + state.embed.U[i][1], 0) / idx.length]);
      const tw = ctx.measureText(t.name).width;
      /* kept inside the box, as the disc maps' names */
      const lx = Math.max(M.x + tw / 2 + 4, Math.min(M.x + M.S - tw / 2 - 4, q[0]));
      ctx.fillStyle = colors.surface; ctx.globalAlpha = 0.85; ctx.fillRect(lx - tw / 2 - 3, q[1] - 8, tw + 6, 16); ctx.globalAlpha = 1;
      ctx.fillStyle = colors.ink1; ctx.fillText(t.name, lx, q[1] + 1);
    });
  } else {
    ctx.font = `600 ${colors.fsXs} ${colors.mono}`;
    cl.ann.forEach((a) => {
      const q = at(centroid(state, a)), isF = a.c === filled, isO = a.c === outlined;
      ctx.fillStyle = isF ? colors.ink1 : colors.surface; ctx.globalAlpha = isF || isO ? 1 : 0.85; ctx.fillRect(q[0] - 9, q[1] - 8, 18, 16); ctx.globalAlpha = 1;
      if (isO) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.strokeRect(q[0] - 9, q[1] - 8, 18, 16); }
      ctx.fillStyle = isF ? colors.surface : colors.ink1; ctx.fillText(String(a.c), q[0], q[1] + 1);
    });
  }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
}
const hueOf = (colors, type) => colors.clusters[TYPE_SLOT[type]];
/** A map of named, shaded discs. `solid` gets a solid ring, `dashed` a dashed
    one; `muted(a)` fades a disc (on a map where it cannot be picked). */
function drawDiscMap(ctx, colors, state, M, { solid = -1, dashed = -1, muted = () => false, title = null } = {}) {
  if (title) heading(ctx, colors, title, M.x, M.y - 9);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(M.x + 0.5, M.y + 0.5, M.S - 1, M.S - 1);
  const discs = discsFor(state, M);
  discs.forEach((d) => {
    const isS = d.a.c === solid, isD = d.a.c === dashed, off = muted(d.a);
    ctx.fillStyle = hueOf(colors, d.a.type); ctx.globalAlpha = isS ? 0.3 : isD ? 0.22 : off ? 0.04 : 0.12;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (isS) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (isD) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = hueOf(colors, d.a.type); ctx.globalAlpha = off ? 0.25 : 0.9;
    d.pts.forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    ctx.font = `${isS || isD ? "600 " : ""}${colors.fsXs} ${colors.font}`; ctx.textAlign = "center"; ctx.fillStyle = off ? colors.ink3 : colors.ink1;
    const below = d.cy + d.r + 14 <= M.y + M.S - 4, text = `${TYPES[d.a.type].name} · ${d.a.c}`, half = ctx.measureText(text).width / 2;
    /* kept inside the box: a disc near the edge would print its name past it */
    ctx.fillText(text, Math.max(M.x + half + 3, Math.min(M.x + M.S - half - 3, d.cx)), below ? d.cy + d.r + 14 : d.cy - d.r - 6);
  });
  ctx.textAlign = "left";
}

function drawClusters(ctx, colors, w, params, state) {
  const L = clustersLayout(w), cl = state.cl;
  heading(ctx, colors, `Coloured by cluster, resolution ${params.res}: ${cl.k} clusters`, L.maps[0].x, TOP - 9);
  heading(ctx, colors, "Coloured by cell type", L.maps[1].x, TOP - 9);
  drawDiscMap(ctx, colors, state, L.maps[0]);
  drawMap(ctx, colors, state, L.maps[1], (a, c) => ({ col: hueOf(colors, c.type), alpha: 0.85 }), { typeLabels: true });
  /* the dot plot of each type's markers: how each cluster is named */
  const genes = []; TYPES.forEach((_, t) => { for (let j = 0; j < 3; j += 1) genes.push(t * G_MARK + j); });
  genes.push(TYPES.length * G_MARK);
  const x0 = L.labelW, x1 = w - 56, cw = Math.min(30, (x1 - x0) / genes.length), top = L.dotTop;
  heading(ctx, colors, "Canonical markers of each type, by cluster: how each cluster is annotated", 8, top - 62);
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  genes.forEach((g, j) => {
    ctx.save(); ctx.translate(x0 + j * cw + cw / 2 - 3, top - 12); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = geneKind(g).kind === "marker" ? colors.ink1 : colors.ink3; ctx.fillText(geneName(g), 0, 0); ctx.restore();
  });
  const Y = state.stage.Y, rows = cl.ann.slice(0, MAX_ROWS);
  const stats = rows.map((a) => genes.map((g) => { let det = 0, s = 0; a.idx.forEach((i) => { const v = Y[i][g]; if (v > 0) det += 1; s += v; }); return { pct: det / a.n, mean: s / a.n }; }));
  const maxMean = genes.map((_, j) => Math.max(...stats.map((r) => r[j].mean)) || 1);
  rows.forEach((a, ri) => {
    const y = top + ri * L.rowH + L.rowH / 2;
    ctx.fillStyle = hueOf(colors, a.type); ctx.globalAlpha = a.alpha; ctx.fillRect(8, y - 5, 10, 10); ctx.globalAlpha = 1;
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
    ctx.fillText(`${a.c} · ${TYPES[a.type].name}`, 24, y + 4);
    genes.forEach((g, j) => {
      const s = stats[ri][j];
      ctx.fillStyle = colors.magnitude; ctx.globalAlpha = 0.15 + 0.85 * (s.mean / maxMean[j]);
      ctx.beginPath(); ctx.arc(x0 + j * cw + cw / 2, y, 1.5 + 8 * Math.sqrt(s.pct), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  });
}

function drawTwo(ctx, colors, w, params, state) {
  const L = twoLayout(w), cl = state.cl, mk = state.mk;
  drawDiscMap(ctx, colors, state, L.maps[0], { solid: mk.tested, title: "Comparator: click a cluster" });
  drawDiscMap(ctx, colors, state, L.maps[1], { dashed: mk.vsRest ? -1 : mk.otherC, muted: (a) => a.c === mk.tested, title: "Baseline: click a cluster, or all other cells" });
  const R = L.rest;
  ctx.fillStyle = mk.vsRest ? colors.ink1 : colors.surface2; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
  ctx.font = `${colors.fsSm} ${colors.font}`; ctx.fillStyle = mk.vsRest ? colors.surface : colors.ink2; ctx.textAlign = "center";
  ctx.fillText("All other cells", R.x + R.w / 2, R.y + R.h / 2 + 5); ctx.textAlign = "left";
  /* FindMarkers' table: first 8 by p, then significant genes detected in most of the baseline */
  const fm = mk.fm, own = (g) => { const k = geneKind(g); return k.kind === "marker" && k.type === mk.type; };
  const top = fm.res.filter((x) => x.lfc > 0).sort((a, b) => a.lp - b.lp || b.lfc - a.lfc).slice(0, 8);
  const extra = broadOf(mk).filter((x) => !top.includes(x)).slice(0, 3);
  const cx = (f) => Math.round(8 + f * (w - 16));
  const cols = [["gene", cx(0), "left"], ["p_val", cx(0.2), "right"], ["avg_log2FC", cx(0.34), "right"], ["pct.1", cx(0.43), "right"], ["pct.2", cx(0.52), "right"], ["p_val_adj", cx(0.64), "right"]];
  let y = L.tableTop;
  heading(ctx, colors, `FindMarkers: comparator cluster ${mk.tested}, baseline ${mk.vsRest ? `the other ${fm.n2} cells` : `cluster ${mk.otherC} (${fm.n2} cells)`}; first 8 by p`, 8, y - 10);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, y + 8); });
  ctx.textAlign = "left"; ctx.fillText("pct.1: the share of the comparator's cells detecting the gene; pct.2: the baseline's", 8, y + 24);
  y += 42;
  const row = (x, grey) => {
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = grey ? colors.ink3 : colors.ink1;
    const v = [geneName(x.g), pFmt(x.lp), x.lfc.toFixed(2), x.p1.toFixed(2), x.p2.toFixed(2), pFmt(x.lpAdj)];
    cols.forEach(([, px, al], k) => { ctx.textAlign = al; ctx.fillText(v[k], px, y); });
    ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillText(own(x.g) ? "" : "detected in most of the baseline", cx(0.67), y);
    y += 18;
  };
  top.forEach((x) => row(x, !own(x.g)));
  if (extra.length) {
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
    ctx.fillText("further down the same list, also p_val_adj < 0.05:", 8, y + 2); y += 20;
    extra.forEach((x) => row(x, true));
  }
  ctx.textAlign = "left";
}
/* significant, up, detected in more than half of the baseline, and not a marker of the comparator's type */
function broadOf(mk) {
  return mk.fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05 && x.p2 > 0.5 && !(geneKind(x.g).kind === "marker" && geneKind(x.g).type === mk.type)).sort((a, b) => a.lp - b.lp);
}

function drawTumourLiver(ctx, colors, w, params, state) {
  const L = tlLayout(w), C = state.cond, M = L.map;
  drawDiscMap(ctx, colors, state, M, { solid: C.within, muted: (a) => !a.testable, title: "Click a cluster: its cells, tumour against liver samples" });
  /* the cluster's cells in each sample */
  heading(ctx, colors, `${clusterLabel(C.a)}: its cells in each sample`, L.tableX, M.y + 14);
  ORDER.forEach((k, j) => {
    const y = M.y + 42 + j * 22;
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left"; ctx.fillText(ORDER_NAMES[j].join(" · "), L.tableX, y);
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "right"; ctx.fillText(String(C.a.perSample[k]), L.tableX + 190, y);
  });
  ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  [
    "Over cells: each cell a replicate,",
    "as FindMarkers treats them",
    "Over samples (pseudobulk): each sample's",
    "cells summed, then DESeq2 as for bulk",
    "RNA-seq; the four samples are the replicates",
  ].forEach((t, j) => ctx.fillText(t, L.tableX, M.y + 140 + j * 16 + (j >= 2 ? 6 : 0)));
  if (!C.testable) {
    ctx.fillStyle = colors.ink1; ctx.fillText(`Fewer than ${MIN_PER_SAMPLE} of this cluster's cells in a sample: it cannot be compared by tissue.`, 8, L.volTop);
    return;
  }
  const PW = Math.floor((w - 64) / 2), xs = [24, 24 + PW + 40], top = L.volTop, bh = 210;
  [[C.volC, `Over cells: ${C.n} cells (Wilcoxon)`], [C.volD, "Over samples: 4 pseudobulk samples (DESeq2)"]].forEach(([pts, title], k) => {
    const X = xs[k], yMax = Math.max(5, ...pts.map((q) => Math.min(60, q.nl))) * 1.05, xr = 3.5;
    const sx = (v) => X + PW / 2 + (Math.max(-xr, Math.min(xr, v)) / xr) * (PW / 2), sy = (v) => top + bh - (Math.min(60, v) / yMax) * bh;
    heading(ctx, colors, title, X, top - 12);
    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, top + bh + 0.5); ctx.lineTo(X + PW, top + bh + 0.5); ctx.moveTo(sx(0) + 0.5, top); ctx.lineTo(sx(0) + 0.5, top + bh); ctx.stroke();
    /* uncalled first, then the calls, then the rings, so nothing hides a call */
    pts.filter((q) => !q.call).forEach((q) => { ctx.fillStyle = colors.ink3; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 2.6, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    pts.filter((q) => q.call).forEach((q) => { ctx.fillStyle = q.truth ? colors.empirical : colors.extreme; ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.2;
    pts.filter((q) => q.truth).forEach((q) => { ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 6, 0, Math.PI * 2); ctx.stroke(); });
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center"; ctx.fillText("log2 fold change, tumour against liver", X + PW / 2, top + bh + 15);
    ctx.textAlign = "left"; ctx.fillText("−log10 p", X + 4, top + 10);
  });
  /* one unchanged gene, cell by cell: why cells are not replicates */
  const sTop = L.stripTop, sH = HEIGHTS["tumour-liver"] - sTop - 30, colW = (w - 140) / 4;
  heading(ctx, colors, `${geneName(C.ex.g)}: unchanged, with the smallest p over cells. Each cell's value by sample; bar, the sample's mean`, 8, sTop - 12);
  const vMax = Math.max(...C.exVals.flat(), 0.1);
  C.exVals.forEach((vals, k) => {
    const cx = 110 + k * colW + colW / 2;
    ctx.fillStyle = colors.ink2; ctx.globalAlpha = 0.5;
    vals.forEach((v, i) => { const jit = (((i * 7919) % 101) / 101 - 0.5) * colW * 0.6; ctx.beginPath(); ctx.arc(cx + jit, sTop + sH - (v / vMax) * sH, 1.8, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    const m = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length), my = sTop + sH - (m / vMax) * sH;
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - colW * 0.35, my); ctx.lineTo(cx + colW * 0.35, my); ctx.stroke();
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(ORDER_NAMES[k].join(" · "), cx, sTop + sH + 16);
  });
  ctx.save(); ctx.translate(40, sTop + sH / 2); ctx.rotate(-Math.PI / 2); ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "center"; ctx.fillText("log(1 + per 10,000)", 0, 0); ctx.restore();
  ctx.textAlign = "left";
}

function drawComposition(ctx, colors, w, params, state) {
  const P = state.comp;
  const barW = Math.min(64, Math.floor((w * 0.42 - 20) / 4) - 14), bh = HEIGHTS.composition - TOP - 50;
  heading(ctx, colors, `Each sample's ${COMP_CELLS} cells, by type`, 8, TOP - 9);
  ORDER.forEach((k, j) => {
    const x = 16 + j * (barW + 14); let y = TOP + bh;
    TYPES.forEach((_, t) => { const h = (P.n[k][t] / COMP_CELLS) * bh; ctx.fillStyle = hueOf(colors, t); ctx.fillRect(x, y - h, barW, h); y -= h; });
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(ORDER_NAMES[j][0], x + barW / 2, TOP + bh + 14); ctx.fillText(ORDER_NAMES[j][1], x + barW / 2, TOP + bh + 28);
  });
  const X = Math.round(w * 0.45), cx = (f) => Math.round(X + f * (w - X - 8));
  const cols = [["type", cx(0), "left"], ["liver", cx(0.45), "right"], ["tumour", cx(0.6), "right"], ["p, cells", cx(0.8), "right"], ["p, samples", cx(1), "right"]];
  heading(ctx, colors, "Each type's share, liver against tumour; bold, p < 0.05", X, TOP - 9);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, TOP + 12); });
  const f = (q) => (q < 1e-4 ? q.toExponential(0) : q < 0.001 ? "<0.001" : q.toFixed(3));
  P.types.forEach((r, j) => {
    const y = TOP + 40 + j * 26;
    ctx.fillStyle = hueOf(colors, r.ti); ctx.fillRect(cx(0), y - 9, 10, 10);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.fillText(TYPES[r.ti].name, cx(0) + 16, y);
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.textAlign = "right";
    ctx.fillText(`${Math.round(100 * r.liver)}%`, cx(0.45), y); ctx.fillText(`${Math.round(100 * r.tumour)}%`, cx(0.6), y);
    /* p < 0.05 in bold ink, not --c-extreme: red is the tumour cells' hue on this page */
    const cell = (q, x) => { ctx.font = `${q < 0.05 ? "700 " : ""}${colors.fsXs} ${colors.mono}`; ctx.fillStyle = q < 0.05 ? colors.ink1 : colors.ink3; ctx.fillText(f(q), x, y); };
    cell(r.pCells, cx(0.8)); cell(r.pSamples, cx(1));
  });
  ctx.textAlign = "left";
}

defineWidget({
  slug: "cell-markers",
  title: "Single-Cell RNA-seq: Clusters and Markers",
  subtitle:
    "Cells are clustered by modularity in a graph of shared nearest neighbours and annotated by the "
    + "canonical markers they express; the resolution sets how many clusters are found. Between clusters, "
    + "marker genes are ranked by a Wilcoxon test over cells, and a gene detected in most cells of both "
    + "clusters can still be significant. Between conditions within a cell type, the replicates are the "
    + "samples: each sample's cells are summed into a pseudobulk profile and tested as bulk RNA-seq, as is "
    + "each type's share of the samples.",
  layout: "side",
  status: "draft",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.clusters,

  /* ORDER MATTERS: an option list that follows other parameters reads them
     resolved, so the seed and the resolution come before the lists that read
     them (core params.js) — the seed sat last until 2026-09-25, and every
     list was built for the default seed */
  params: {
    page: { type: "segmented", label: "Page", options: PAGES, default: "clusters", display: true },

    dataSec: { type: "section", label: "The data" },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    res: {
      type: "choice", label: "Resolution",
      detail: "FindClusters' resolution: the weight on the expected number of links within a community",
      options: RESOLUTIONS.map((v) => ({ value: v, label: v })), default: "0.3", when: CELL_PAGES,
    },

    twoSec: { type: "section", label: "The comparison", when: ON("two-clusters") },
    comparator: {
      type: "segmented", style: "grid", label: "Comparator",
      detail: "the cluster whose markers are found: FindMarkers' ident.1, whose share detecting a gene is pct.1; clusters are numbered by size, 0 the largest",
      options: (v) => clusterOptions(v), optionsFrom: ["seed", "res"],
      default: "0", when: ON("two-clusters"),
    },
    baseline: {
      type: "segmented", style: "grid", label: "Baseline",
      detail: "the reference the comparator is measured against: FindMarkers' ident.2, whose share is pct.2; all other cells, or one cluster",
      options: (v) => [{ value: "rest", label: "All other cells", span: true }, ...clusterOptions(v).filter((o) => o.value !== String(v.comparator))],
      optionsFrom: ["seed", "res", "comparator"],
      default: "rest", when: ON("two-clusters"),
    },
    tlSec: { type: "section", label: "The comparison", when: ON("tumour-liver") },
    within: {
      type: "segmented", style: "grid", label: "Cluster",
      detail: `the cluster whose cells are compared, tumour samples against liver samples; only clusters with at least ${MIN_PER_SAMPLE} cells in every sample are listed`,
      options: (v) => testableOptions(v), optionsFrom: ["seed", "res"],
      default: "", when: ON("tumour-liver"),
    },
    tlSampSec: { type: "section", label: "The samples", when: ON("tumour-liver") },
    change: {
      type: "choice", label: "True change",
      detail: "the log2 fold change of 20 genes in every cell type's tumour-sample cells, half up and half down; every other gene is unchanged",
      options: CHANGES.map((v) => ({ value: v, label: v })), default: "0", when: ON("tumour-liver"),
    },
    sampleSd: {
      type: "choice", label: "Sample effect",
      detail: "the SD, in log, of each gene's level in one sample's preparation: ambient RNA, dissociation, handling",
      options: SAMPLE_SD.map((v) => ({ value: v, label: v })), default: "0", when: ON("tumour-liver"),
    },
    patientSd: {
      type: "choice", label: "Patient effect",
      detail: "the SD, in log, of each gene's level in one patient, shared by that patient's liver and tumour samples",
      options: PATIENT_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("tumour-liver"),
    },

    compSec: { type: "section", label: "The samples", when: ON("composition") },
    compSd: {
      type: "choice", label: "Spread between samples",
      detail: "the SD, in log, by which each sample's share of each type varies about its tissue's mean share",
      options: COMP_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("composition"),
    },
  },

  legend: ({ params }) => {
    const types = TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: t.name, mark: params.page === "composition" ? "bar" : "dot" }));
    if (params.page === "clusters") return [...types, { token: "magnitude", label: "Dot plot: size, the share of the cluster's cells detecting the gene; shade, its mean", mark: "dot" }];
    if (params.page === "tumour-liver") return [
      { token: "ink-3", label: "A gene not called", mark: "dot" },
      { token: "empirical", label: "Called at adjusted p < 0.05, and truly changed", mark: "dot" },
      { token: "extreme", label: "Called, and unchanged", mark: "dot" },
      { token: "reference", label: "A ring: truly changed", mark: "line" },
    ];
    return types;
  },

  compute: ({ params }) => {
    const cl = clustersFor(params.seed, params.res);
    return {
      stage: stageFor(params.seed, params.sampleSd, params.patientSd, params.change),
      embed: embedFor(params.seed), cl,
      mk: markersFor(params, cl),
      cond: conditionFor(params, cl),
      comp: compositionFor(params.seed, params.compSd),
    };
  },

  regions: ({ w, params, state }) => {
    /* core probes the table at load, before compute has run */
    if (!state) return [];
    if (params.page === "two-clusters") {
      const L = twoLayout(w), tested = state.mk.tested;
      return [
        ...discTiles(state, L.maps[0]).filter((t) => t.c < MAX_ROWS).map((t) => ({ ...t, set: { comparator: String(t.c) }, label: `comparator cluster ${t.c}` })),
        /* the comparator is not a baseline it can have */
        ...discTiles(state, L.maps[1]).filter((t) => t.c < MAX_ROWS && t.c !== tested).map((t) => ({ ...t, set: { baseline: String(t.c) }, label: `baseline cluster ${t.c}` })),
        { ...L.rest, set: { baseline: "rest" }, label: "All other cells" },
      ];
    }
    if (params.page === "tumour-liver") {
      const L = tlLayout(w), ok = new Set(state.cl.ann.filter((a) => a.testable).map((a) => a.c));
      return discTiles(state, L.map).filter((t) => ok.has(t.c) && t.c < MAX_ROWS).map((t) => ({ ...t, set: { within: String(t.c) }, label: `cluster ${t.c}` }));
    }
    return [];
  },

  draw: ({ ctx, colors, w, params, state }) => {
    if (params.page === "clusters") drawClusters(ctx, colors, w, params, state);
    else if (params.page === "two-clusters") drawTwo(ctx, colors, w, params, state);
    else if (params.page === "tumour-liver") drawTumourLiver(ctx, colors, w, params, state);
    else drawComposition(ctx, colors, w, params, state);
  },

  readout: ({ params, state }) => {
    const cl = state.cl;
    if (params.page === "clusters") {
      const byType = TYPES.map((t, ti) => cl.ann.filter((a) => a.type === ti).length);
      const split = TYPES.filter((_, ti) => byType[ti] > 1).map((t) => t.name);
      return [
        { label: "Clusters found", value: String(cl.k), note: `the data hold 6 cell types; modularity ${fmt(cl.q, 3)}, the best of 10 random starts` },
        { label: "Cell types split over more than one cluster", value: String(split.length), note: split.length ? `${split.join(", ")}: each of its clusters expresses the same type's markers` : "each type is one cluster" },
      ];
    }
    if (params.page === "two-clusters") {
      const mk = state.mk, fm = mk.fm;
      const up = fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05);
      return [
        { label: `Genes up in the comparator, cluster ${mk.tested}, at p_val_adj < 0.05`, value: String(up.length), note: `${fm.n1} cells; baseline ${mk.vsRest ? `the other ${fm.n2} cells` : `cluster ${mk.otherC}'s ${fm.n2}`}` },
        { label: "Of those, detected in more than half of the baseline", value: String(broadOf(mk).length), note: "significant, and not specific to the comparator" },
      ];
    }
    if (params.page === "composition") {
      const T = state.comp.types;
      const names = (k) => T.filter((r) => r[k] < 0.05).map((r) => TYPES[r.ti].name).join(", ") || "none";
      return [
        { label: "Types whose share differs, over cells", value: String(T.filter((r) => r.pCells < 0.05).length), note: `p < 0.05: ${names("pCells")}` },
        { label: "Types whose share differs, over samples", value: String(T.filter((r) => r.pSamples < 0.05).length), note: `p < 0.05: ${names("pSamples")}` },
      ];
    }
    const C = state.cond;
    if (!C.testable) return [{ label: "Cluster", value: String(C.within), note: "too few cells in a sample to compare by tissue" }];
    const tp = (v) => v.filter((q) => q.call && q.truth).length, fp = (v) => v.filter((q) => q.call && !q.truth).length;
    const truth = Number(params.change) > 0;
    return [
      { label: "Over cells: genes called", value: truth ? `${tp(C.volC)} of 20 true` : `${fp(C.volC)}`, note: truth ? `and ${fp(C.volC)} unchanged genes called besides, at p_val_adj < 0.05` : "unchanged genes called at p_val_adj < 0.05; no gene truly changes" },
      { label: "Over samples: genes called", value: truth ? `${tp(C.volD)} of 20 true` : `${fp(C.volD)}`, note: truth ? `and ${fp(C.volD)} unchanged genes called besides, at padj < 0.05` : "unchanged genes called at padj < 0.05; no gene truly changes" },
    ];
  },
});
