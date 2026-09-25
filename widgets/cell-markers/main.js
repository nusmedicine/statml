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
import { simulate, normalise, pcaScaled, knn, snn, findClusters, findMarkers, geneKind, geneName, conditionGenesOf, TYPES, SAMPLES, G, G_MARK } from "./engine.js";
import { umapSgd } from "./umap.js";

const PAGES = [
  { value: "clusters", label: "Clusters" },
  { value: "two-clusters", label: "Two clusters" },
  { value: "tumour-liver", label: "Tumour vs liver" },
  { value: "composition", label: "Composition" },
];
const ON = (page) => ({ param: "page", equals: page });
const CELL_PAGES = { param: "page", oneOf: ["clusters", "two-clusters", "tumour-liver"] };
const HEIGHTS = { "two-clusters": 732, "tumour-liver": 1470, composition: 380 };
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
/* the gene in both columns' gene views: two picked by p, or any gene, as a volcano click
   sets it (a region's value must be one of the options, so every gene is one) */
const GENE_OPTIONS = [
  { value: "unchanged", label: "Unchanged, smallest p over cells", group: "Picked by p over cells" },
  { value: "changed", label: "Truly changed, smallest p over cells", group: "Picked by p over cells" },
  /* a gene's value is its name, so the link reads gene=Kup19 */
  ...Array.from({ length: G }, (_, g) => ({ value: geneName(g), label: geneName(g), group: { marker: "Marker genes", house: "Common genes" }[geneKind(g).kind] ?? "Other genes" })),
];
const GENE_INDEX = new Map(Array.from({ length: G }, (_, g) => [geneName(g), g]));
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
      condition: Number(change), conditionTypes: ALL_TYPES, conditionByType: true, integrated: true,
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
    return { adj, U, types: cells.map((c) => c.type) };
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
    /* the cluster's type's own changed genes (engine, conditionByType) */
    const own = conditionGenesOf(a.type), truthOf = (g) => Number(params.change) > 0 && own(g);
    const volC = fm.res.map((x) => ({ g: x.g, lfc: x.lfc, nl: -x.lp, lpAdj: x.lpAdj, call: x.lpAdj < LOG05, truth: truthOf(x.g) }));
    const counts = Array.from({ length: G }, (_, g) => ORDER.map((k) => a.idx.reduce((s, i) => s + (S.cells[i].sample === k ? S.cells[i].x[g] : 0), 0)));
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    const volD = an.expressed.map((g) => ({ g, lfc: an.resMAP[g].lfc, nl: -Math.log10(Math.max(1e-300, an.resMAP[g].p)), lpAdj: Math.log10(Math.max(1e-300, an.resMAP[g].padj)), call: an.resMAP[g].padj < 0.05, truth: truthOf(g) }));
    /* the two genes the rail offers: the unchanged gene with the smallest p
       over cells, of every kind (the spread genes alone missed the false calls,
       pseudobulk mock), and the truly changed one with the smallest */
    const byP = [...fm.res].sort((p, q) => p.lp - q.lp);
    const nullG = byP.find((x) => !truthOf(x.g)).g, trueG = byP.find((x) => truthOf(x.g))?.g ?? null;
    const byG = new Map(fm.res.map((x) => [x.g, x]));
    const tot = counts[0].map((_, j) => counts.reduce((t, row) => t + row[j], 0));
    return { within, a, testable: true, volC, volD, nullG, trueG, byG, an, counts, tot, truthOf, n: fm.n1 + fm.n2 };
  });
}

/** The gene beside the map: each of the cluster's cells by sample, each
    sample's cells summed (pseudobulk, on the same log(1 + per 10,000) scale),
    and the two tests' results for it. */
function geneView(params, C, S) {
  if (!C.testable) return null;
  const g = params.gene === "changed" && C.trueG !== null ? C.trueG : GENE_INDEX.get(params.gene) ?? C.nullG;
  const vals = ORDER.map((k) => C.a.idx.filter((i) => S.cells[i].sample === k).map((i) => S.Y[i][g]));
  const pb = ORDER.map((_, j) => Math.log1p((C.counts[g][j] / C.tot[j]) * 1e4));
  const r = C.an.resMAP[g], exp = C.an.expressed.includes(g);
  return { g, vals, pb, truth: C.truthOf(g), cells: C.byG.get(g), deseq: exp ? { p: r.p, padj: r.padj } : null };
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
function groupsOf(state, by) {
  if (by !== "type") return state.cl.ann;
  return TYPES.map((_, ti) => ({ c: ti, type: ti, idx: state.embed.types.flatMap((t, i) => (t === ti ? [i] : [])) })).filter((a) => a.idx.length);
}
function discsFor(state, M, by = "cluster") {
  const key = `${M.x},${M.y},${M.S},${by}`, per = discCache.get(state) ?? new Map();
  if (per.has(key)) return per.get(key);
  const at = mapView(state.embed.U, M, 1.25);
  const discs = groupsOf(state, by).map((a) => {
    const pts = a.idx.map((i) => at(state.embed.U[i]));
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const ds = pts.map((q) => Math.hypot(q[0] - cx, q[1] - cy)).sort((p, q) => p - q);
    return { a, cx, cy, r: Math.max(M.S * 0.07, ds[Math.floor(0.95 * (ds.length - 1))] * 1.35 + 6), pts };
  });
  per.set(key, discs); discCache.set(state, per);
  return discs;
}
/** The group (cluster or type) whose disc the pointer is deepest inside, or null. */
function discAt(state, M, by, p) {
  if (!p || p.x < M.x || p.x > M.x + M.S || p.y < M.y || p.y > M.y + M.S) return null;
  let best = null, bd = 1;
  for (const d of discsFor(state, M, by)) { const dd = Math.hypot(p.x - d.cx, p.y - d.cy) / d.r; if (dd < bd) { bd = dd; best = d.a; } }
  return best;
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
/* the dot plot sits under the widest maps (340) with room for its rotated
   gene names; the page is as tall as its rows, whatever the width (a height
   that reads the width is what left widget 62's harness NEVER SETTLED) */
const DOT_TOP = TOP + 340 + 80;
const clustersHeight = (params) => DOT_TOP + Math.min(MAX_ROWS, clustersFor(params.seed, params.res).k) * 22 + 16;
function clustersLayout(w) {
  const S = Math.min(340, Math.floor((w - 24) / 2)), x0 = Math.floor((w - (2 * S + 24)) / 2);
  return { maps: [{ x: x0, y: TOP, S }, { x: x0 + S + 24, y: TOP, S }], dotTop: DOT_TOP - (340 - S), rowH: 22, labelW: 150 };
}
/* Two clusters: the comparator's map and the baseline's, side by side, and
   "All other cells" under the baseline's (his pick A from the picker mock:
   each map sets one thing, so no switch says what a click does) */
const MAP_MAX = 360;
function twoLayout(w) {
  const S = Math.min(MAP_MAX, Math.floor((w - 24) / 2)), x0 = Math.floor((w - (2 * S + 24)) / 2);
  const maps = [{ x: x0, y: TOP, S }, { x: x0 + S + 24, y: TOP, S }];
  /* "All other cells" is a chip at the top of the baseline's map, and the
     map's background picks it too (his round: "if you click on the
     background, it's considered all other cells") */
  const chipW = Math.min(150, S - 16);
  return { maps, rest: { x: maps[1].x + Math.floor((S - chipW) / 2), y: TOP + 8, w: chipW, h: 24 }, tableTop: TOP + S + 50 };   // under the maps as drawn; the page's height is set for the widest (MAP_MAX), so a narrow canvas leaves its spare room at the bottom, not between
}
/* TUMOUR VS LIVER, ONE COLUMN PER TEST (his pick D from
   `_lab/cell-markers-tl-layout-mock`, 2026-09-25): the map and the cluster's
   cells per sample on top; then the test over cells on the left and the test
   over samples on the right, each read down — its volcano, its first genes by
   p, and the picked gene as that test sees it (the cells, or the four sums).
   It replaced the one-press collapse of the cells into their sums: the step
   is two pictures side by side, on one scale. The height is fixed; a narrow
   canvas narrows the columns. */
const LIST_ROWS = 8, LIST_ROW_H = 17;
function tlLayout(w) {
  const S = Math.min(260, Math.floor(w * 0.45)), PW = Math.floor((w - 64) / 2);
  const volTop = TOP + 260 + 52, volH = 190, listTop = volTop + volH + 52, geneTop = listTop + 18 + LIST_ROWS * LIST_ROW_H + 52;
  return { map: { x: 8, y: TOP, S }, tableX: 8 + S + 28, PW, cols: [24, 24 + PW + 40], volTop, volH, listTop, geneTop, geneH: 220, vennTop: geneTop + 220 + 70 };
}
/* THE CALLS AGAINST THE TRUTH, AS A VENN (his pick from
   `_lab/cell-markers-explain-mock`, figure 4A): the truly changed genes and
   each test's calls, three fixed circles with counts — not areas, so no
   area claims a proportion it cannot keep — and a dot per gene, blue truly
   changed, red not, which picks the gene as a volcano point does. The dots
   are laid on a grid of points inside each region, nearest its middle
   first; the middle point carries the region's count. Kept per state, since
   regions are rebuilt on every pointer move. */
const vennCache = new WeakMap();
function vennOf(state, w, L) {
  const per = vennCache.get(state) ?? new Map();
  if (per.has(w)) return per.get(w);
  const C = state.cond, x0 = L.cols[0], x1 = Math.min(w - 2, L.cols[1] + L.PW), lw = x1 - x0 - 200;
  const R = Math.min(96, Math.floor(lw / 3.7)), cx = x0 + Math.round(lw / 2) + 10, top = L.vennTop + 40;
  const circles = [{ x: cx, y: top + R }, { x: cx - Math.round(0.72 * R), y: top + Math.round(2.05 * R) }, { x: cx + Math.round(0.72 * R), y: top + Math.round(2.05 * R) }];
  const truth = new Set(), cells = new Set(C.volC.filter((q) => q.call).map((q) => q.g)), samples = new Set(C.volD.filter((q) => q.call).map((q) => q.g));
  for (let g = 0; g < G; g += 1) if (C.truthOf(g)) truth.add(g);
  const code = (g) => `${+truth.has(g)}${+cells.has(g)}${+samples.has(g)}`;
  const grid = {}, STEP = 10;
  for (let y = top - R; y < top + 3.1 * R; y += STEP) for (let x = cx - 1.8 * R; x < cx + 1.8 * R; x += STEP) {
    const k = circles.map((c) => +(Math.hypot(x - c.x, y - c.y) < R - 6)).join("");
    if (k !== "000") (grid[k] ??= []).push([x, y]);
  }
  Object.values(grid).forEach((pts) => { const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length; pts.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my)); });
  const groups = {};
  [...new Set([...truth, ...cells, ...samples])].sort((a, b) => a - b).forEach((g) => (groups[code(g)] ??= []).push(g));
  /* the middle point and its neighbour are the count's; a region with more
     genes than points stacks the rest on its last (the count stays exact) */
  const dots = [], counts = [];
  Object.entries(groups).forEach(([k, gs]) => {
    const pts = grid[k] ?? [];
    if (pts.length) counts.push({ x: pts[0][0], y: pts[0][1], n: gs.length });
    gs.forEach((g, i) => { const q = pts[Math.min(i + 2, pts.length - 1)]; if (q) dots.push({ g, x: q[0], y: q[1], truth: truth.has(g) }); });
  });
  const out = { R, circles, dots, counts, nTruth: truth.size, nCells: cells.size, nSamples: samples.size, quiet: G - new Set([...truth, ...cells, ...samples]).size,
    /* the box is every gene (his round: "put it in a box … and the number of
       unchanged genes"): the circles sit in its left part, the legend and the
       genes outside every circle in a column on its right */
    box: { x0, y0: L.vennTop + 6, x1, y1: top + Math.round(2.05 * R) + R + 34 }, colX: x1 - 186 };
  per.set(w, out); vennCache.set(state, per);
  return out;
}
/* one volcano's scales, shared by the drawing and the click targets */
function volGeom(w, L, pts, k) {
  const PW = L.PW, X = L.cols[k], top = L.volTop, bh = L.volH;
  const yMax = Math.max(5, ...pts.map((q) => Math.min(60, q.nl))) * 1.05, xr = 3.5;
  return { X, PW, top, bh, sx: (v) => X + PW / 2 + (Math.max(-xr, Math.min(xr, v)) / xr) * (PW / 2), sy: (v) => top + bh - (Math.min(60, v) / yMax) * bh };
}
/* one test's first genes by p: the rows its list draws and a click reaches */
const listRows = (pts) => [...pts].sort((p, q) => q.nl - p.nl).slice(0, LIST_ROWS);

/* ------------------------------------------------------------ drawing */
function heading(ctx, colors, text, x, y) {
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}
const hueOf = (colors, type) => colors.clusters[TYPE_SLOT[type]];
/** A map of named, shaded discs. `solid` gets a solid ring, `dashed` a dashed
    one; `muted(a)` fades a disc (on a map where it cannot be picked). */
function drawDiscMap(ctx, colors, state, M, { solid = -1, dashed = -1, ring = () => false, dash = () => false, muted = () => false, title = null, name = (a) => `${TYPES[a.type].name} · ${a.c}`, by = "cluster", reserve = [] } = {}) {
  if (title) heading(ctx, colors, title, M.x, M.y - 9);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(M.x + 0.5, M.y + 0.5, M.S - 1, M.S - 1);
  const discs = discsFor(state, M, by);
  const solidOf = (a) => a.c === solid || ring(a), dashOf = (a) => !solidOf(a) && (a.c === dashed || dash(a));
  discs.forEach((d) => {
    const isS = solidOf(d.a), isD = dashOf(d.a), off = muted(d.a);
    ctx.fillStyle = hueOf(colors, d.a.type); ctx.globalAlpha = isS ? 0.3 : isD ? 0.22 : off ? 0.04 : 0.12;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (isS) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (isD) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
    /* a type split over clusters: its clusters lighter to darker, as the dot plot's swatches */
    ctx.fillStyle = hueOf(colors, d.a.type); ctx.globalAlpha = off ? 0.25 : (d.a.alpha ?? 0.9);
    d.pts.forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  });
  /* THE NAMES, AFTER EVERY DISC, so no disc paints over a name. Each takes
     the first place, below its disc, then above, then beside, that is inside
     the box and clear of the names already placed; neighbouring clusters
     printed their names into each other (Immune cell · 3 and Stellate
     cell · 5, seed 1). Kept inside the box horizontally, as before. */
  const placed = reserve.map((r) => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }));
  discs.forEach((d) => {
    const isS = solidOf(d.a), isD = dashOf(d.a), off = muted(d.a);
    ctx.font = `${isS || isD ? "600 " : ""}${colors.fsXs} ${colors.font}`; ctx.textAlign = "center"; ctx.fillStyle = off ? colors.ink3 : colors.ink1;
    const text = name(d.a), half = ctx.measureText(text).width / 2, clampX = (x) => Math.max(M.x + half + 3, Math.min(M.x + M.S - half - 3, x));
    const spots = [[d.cx, d.cy + d.r + 14], [d.cx, d.cy - d.r - 6], [d.cx + d.r + half + 4, d.cy + 4], [d.cx - d.r - half - 4, d.cy + 4]].map(([x, y]) => [clampX(x), y]);
    const box = ([x, y]) => ({ x0: x - half - 2, x1: x + half + 2, y0: y - 12, y1: y + 3 });
    const inside = (b) => b.y0 >= M.y + 2 && b.y1 <= M.y + M.S - 2;
    const clear = (b) => placed.every((q) => b.x1 < q.x0 || b.x0 > q.x1 || b.y1 < q.y0 || b.y0 > q.y1);
    const at = spots.find((p) => inside(box(p)) && clear(box(p))) ?? spots.find((p) => inside(box(p))) ?? spots[0];
    placed.push(box(at));
    ctx.fillText(text, at[0], at[1]);
  });
  ctx.textAlign = "left";
}

function drawClusters(ctx, colors, w, params, state, pointer) {
  const L = clustersLayout(w), cl = state.cl, rows = cl.ann.slice(0, MAX_ROWS), top = L.dotTop;
  /* HOVER FOLLOWS ONE CLUSTER (his round): a cluster on the left map or a
     row of the dot plot lights that cluster in all three and its type on the
     right; a type on the right lights its clusters. An inspector only —
     nothing is written, and with no pointer the figure is as before. */
  let hotC = discAt(state, L.maps[0], "cluster", pointer)?.c ?? null;
  const hotType = discAt(state, L.maps[1], "type", pointer)?.type ?? null;
  if (pointer && hotC === null && pointer.y >= top && pointer.y < top + rows.length * L.rowH) hotC = rows[Math.floor((pointer.y - top) / L.rowH)].c;
  const any = hotC !== null || hotType !== null;
  const isHot = (a) => (hotC !== null ? a.c === hotC : a.type === hotType);
  const hotT = hotC !== null ? cl.ann[hotC].type : hotType;
  heading(ctx, colors, `Coloured by cluster, resolution ${params.res}: ${cl.k} clusters`, L.maps[0].x, TOP - 9);
  heading(ctx, colors, "Coloured by cell type", L.maps[1].x, TOP - 9);
  /* numbers only: the map beside it names the types (his round) */
  drawDiscMap(ctx, colors, state, L.maps[0], { name: (a) => `Cluster ${a.c}`, ring: (a) => any && isHot(a), muted: (a) => any && !isHot(a) });
  drawDiscMap(ctx, colors, state, L.maps[1], { by: "type", name: (a) => TYPES[a.type].name, ring: (a) => any && a.type === hotT, muted: (a) => any && a.type !== hotT });
  /* the dot plot of each type's markers: how each cluster is named */
  const genes = []; TYPES.forEach((_, t) => { for (let j = 0; j < 3; j += 1) genes.push(t * G_MARK + j); });
  const x0 = L.labelW, x1 = w - 56, cw = Math.min(30, (x1 - x0) / genes.length);
  heading(ctx, colors, "Canonical markers of each type, by cluster: how each cluster is annotated", 8, top - 58);
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  genes.forEach((g, j) => {
    ctx.save(); ctx.translate(x0 + j * cw + cw / 2 - 3, top - 12); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = geneKind(g).kind === "marker" ? colors.ink1 : colors.ink3; ctx.fillText(geneName(g), 0, 0); ctx.restore();
  });
  const Y = state.stage.Y;
  const stats = rows.map((a) => genes.map((g) => { let det = 0, s = 0; a.idx.forEach((i) => { const v = Y[i][g]; if (v > 0) det += 1; s += v; }); return { pct: det / a.n, mean: s / a.n }; }));
  const maxMean = genes.map((_, j) => Math.max(...stats.map((r) => r[j].mean)) || 1);
  rows.forEach((a, ri) => {
    const y = top + ri * L.rowH + L.rowH / 2;
    if (any && isHot(a)) { ctx.fillStyle = colors.surface2; ctx.fillRect(4, y - L.rowH / 2, x0 + genes.length * cw - 4, L.rowH); }
    ctx.globalAlpha = any && !isHot(a) ? 0.3 : 1;
    ctx.fillStyle = hueOf(colors, a.type); ctx.globalAlpha *= a.alpha; ctx.fillRect(8, y - 5, 10, 10); ctx.globalAlpha = any && !isHot(a) ? 0.3 : 1;
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
    ctx.fillText(`${a.c} · ${TYPES[a.type].name}`, 24, y + 4);
    genes.forEach((g, j) => {
      const s = stats[ri][j];
      ctx.fillStyle = colors.magnitude; ctx.globalAlpha = (0.15 + 0.85 * (s.mean / maxMean[j])) * (any && !isHot(a) ? 0.3 : 1);
      ctx.beginPath(); ctx.arc(x0 + j * cw + cw / 2, y, 1.5 + 8 * Math.sqrt(s.pct), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  });
}

function drawTwo(ctx, colors, w, params, state) {
  const L = twoLayout(w), cl = state.cl, mk = state.mk;
  drawDiscMap(ctx, colors, state, L.maps[0], { solid: mk.tested, title: "Comparator: click a cluster" });
  const R = L.rest;
  /* with all other cells as the baseline, every cluster but the comparator wears the baseline's dashed ring */
  const dash = (a) => (mk.vsRest ? a.c !== mk.tested : a.c === mk.otherC);
  drawDiscMap(ctx, colors, state, L.maps[1], { dash, muted: (a) => a.c === mk.tested, reserve: [R], title: "Baseline: click a cluster, or the background" });
  ctx.fillStyle = mk.vsRest ? colors.ink1 : colors.surface2; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = mk.vsRest ? colors.surface : colors.ink2; ctx.textAlign = "center";
  ctx.fillText("All other cells", R.x + R.w / 2, R.y + R.h / 2 + 4); ctx.textAlign = "left";
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

/** One test's view of the picked gene: `mode` "cells" (each cell by sample,
    hollow liver, filled tumour) or "samples" (each sample's cells summed,
    the pseudobulk point). Both halves take one scale, `vMax`, so the sums
    sit where the cells' levels are. Tissue is drawn by fill, not hue: the
    map above already wears the types' hues. */
function drawGeneHalf(ctx, colors, gv, B, mode, vMax) {
  const top = B.y, bh = B.h - 74, colW = B.w / 4, sy = (v) => top + bh - (v / vMax) * bh;
  ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(B.x + 0.5, top); ctx.lineTo(B.x + 0.5, top + bh + 0.5); ctx.lineTo(B.x + B.w, top + bh + 0.5); ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "right";
  [0, vMax / 2, vMax].forEach((v) => ctx.fillText(v.toFixed(1), B.x - 4, sy(v) + 4));
  ORDER.forEach((k, j) => {
    const cx = B.x + j * colW + colW / 2, liver = j < 2;
    if (mode === "cells") {
      ctx.globalAlpha = 0.7; ctx.strokeStyle = colors.ink2; ctx.fillStyle = colors.ink2; ctx.lineWidth = 1.2;
      gv.vals[j].forEach((v, i) => {
        const jit = (((i * 7919) % 101) / 101 - 0.5) * colW * 0.62;
        ctx.beginPath(); ctx.arc(cx + jit, sy(v), 2.2, 0, Math.PI * 2); if (liver) ctx.stroke(); else ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath(); ctx.arc(cx, sy(gv.pb[j]), 6.5, 0, Math.PI * 2); ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.8;
      if (!liver) { ctx.fillStyle = colors.ink1; ctx.fill(); }
      ctx.stroke();
    }
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(`P${(j % 2) + 1} ${ORDER_NAMES[j][1]}`, cx, top + bh + 14);
    ctx.fillText(mode === "cells" ? `${gv.vals[j].length} cells` : "1 sum", cx, top + bh + 27);
  });
  const n = gv.vals.reduce((a, v) => a + v.length, 0), c = gv.cells, d = gv.deseq;
  const lines = mode === "cells"
    ? [`n = ${n} cells, ${c.lpAdj < LOG05 ? "called" : "not called"}`, `p_val_adj = ${pFmt(c.lpAdj)}`]
    : [`n = 4 samples, ${d && d.padj < 0.05 ? "called" : "not called"}`, d ? `padj = ${pFmt(Math.log10(Math.max(1e-300, d.padj)))}` : "too few counts for DESeq2 to test"];
  ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink1;
  lines.forEach((t, k) => ctx.fillText(t, B.x - 30, top + bh + 50 + k * 15));
}
/** One test's first genes by p, as its tool prints them; the dot is the
    volcano's colour for that gene, the picked gene's row shaded. */
function drawList(ctx, colors, x, y, w, pts, g, pName) {
  const cols = [["gene", x + 12, "left"], ["log2FC", x + w * 0.62, "right"], [pName, x + w, "right"]];
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, cx, al]) => { ctx.textAlign = al; ctx.fillText(h, cx, y); });
  listRows(pts).forEach((q, i) => {
    const ry = y + 18 + i * LIST_ROW_H;
    if (q.g === g) { ctx.fillStyle = colors.surface2; ctx.fillRect(x - 4, ry - 12, w + 8, LIST_ROW_H); }
    ctx.fillStyle = q.call ? (q.truth ? colors.empirical : colors.extreme) : colors.ink3;
    ctx.beginPath(); ctx.arc(x + 3, ry - 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = q.call ? colors.ink1 : colors.ink3;
    ctx.textAlign = "left"; ctx.fillText(geneName(q.g), x + 12, ry);
    ctx.textAlign = "right"; ctx.fillText(q.lfc.toFixed(2), x + w * 0.62, ry); ctx.fillText(pFmt(q.lpAdj), x + w, ry);
  });
  ctx.textAlign = "left";
}

/** The design as a tree: patients, their samples, the cluster's cells, and
    a dashed box round the level each test counts as its n. Patients in ink,
    not a hue: the map beside it wears the types' hues. */
function drawDesignTree(ctx, colors, C, B) {
  heading(ctx, colors, `${TYPES[C.a.type].name} · ${C.a.c}: what each test counts`, B.x, B.y + 14);
  const rowP = B.y + 44, rowS = B.y + 100, rowC = B.y + 150, colW = B.w / 4, sx = (j) => B.x + colW * (j + 0.5), px = (p) => (sx(p) + sx(p + 2)) / 2;
  const cap = (t, y) => { ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left"; ctx.fillText(t, B.x, y); };
  [0, 1].forEach((p) => {
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1.5;
    [p, p + 2].forEach((j) => { ctx.beginPath(); ctx.moveTo(px(p), rowP + 9); ctx.lineTo(sx(j), rowS - 11); ctx.stroke(); });
    ctx.fillStyle = colors.ink1; ctx.beginPath(); ctx.arc(px(p), rowP, 10, 0, Math.PI * 2); ctx.fill();
    ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.surface; ctx.textAlign = "center"; ctx.fillText(`P${p + 1}`, px(p), rowP + 4);
  });
  const bw = Math.min(76, colW - 6);
  ORDER.forEach((k, j) => {
    const x = sx(j), n = Math.min(24, C.a.perSample[k]), liver = j < 2;
    for (let i = 0; i < n; i += 1) {
      const cx = x + ((i % 6) - 2.5) * 8, cy = rowC - 6 + Math.floor(i / 6) * 8;
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, rowS + 11); ctx.lineTo(cx, cy - 3); ctx.stroke();
    }
    for (let i = 0; i < n; i += 1) {
      const cx = x + ((i % 6) - 2.5) * 8, cy = rowC - 6 + Math.floor(i / 6) * 8;
      ctx.beginPath(); ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
      if (liver) { ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1.1; ctx.stroke(); } else { ctx.fillStyle = colors.ink2; ctx.fill(); }
    }
    ctx.fillStyle = colors.surface; ctx.fillRect(x - bw / 2, rowS - 11, bw, 22); ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.2; ctx.strokeRect(x - bw / 2, rowS - 11, bw, 22);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "center"; ctx.fillText(`P${(j % 2) + 1} ${ORDER_NAMES[j][1]}`, x, rowS + 4);
    ctx.fillStyle = colors.ink2; ctx.fillText(`${C.a.perSample[k]} cells`, x, rowC + 38);
  });
  /* the level each test counts */
  const box = (y0, y1, label, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(B.x + 0.5, y0, B.w - 1, y1 - y0); ctx.setLineDash([]);
    ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = col; ctx.textAlign = "right"; ctx.fillText(label, B.x + B.w - 4, y0 - 4);
  };
  box(rowS - 17, rowS + 17, "over samples: n = 4 (right column)", colors.ink1);
  box(rowC - 14, rowC + 26, `over cells: n = ${C.n} (left column)`, colors.ink2);
  ["A patient's effect is in both of its samples, so", "tumour minus liver removes it. A sample's effect", "is in every one of its cells, the same draw: the", "test over cells counts that draw once per cell."]
    .forEach((t, i) => cap(t, B.y + 206 + i * 14));
  ctx.textAlign = "left";
}

function drawVenn(ctx, colors, V, L, picked) {
  heading(ctx, colors, "The calls against the truth", V.box.x0, L.vennTop - 12);
  const [T, Cc, Sc] = V.circles, R = V.R, B = V.box;
  /* the box: every gene */
  ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.strokeRect(B.x0 + 0.5, B.y0 + 0.5, B.x1 - B.x0 - 1, B.y1 - B.y0 - 1);
  ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left"; ctx.fillText(`All ${G} genes`, B.x0 + 8, B.y0 + 16);
  [[T, colors.reference, []], [Cc, colors.ink1, []], [Sc, colors.ink2, [6, 4]]].forEach(([c, col, dash]) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  });
  ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "center";
  ctx.fillText(`Truly changed (${V.nTruth})`, T.x, T.y - R - 8);
  ctx.fillText(`Called over cells (${V.nCells})`, Cc.x - R * 0.3, Cc.y + R + 18);
  ctx.fillText(`Called over samples (${V.nSamples})`, Sc.x + R * 0.3, Sc.y + R + 18);
  V.dots.forEach((d) => {
    ctx.fillStyle = d.truth ? colors.empirical : colors.extreme; ctx.beginPath(); ctx.arc(d.x, d.y, 3.6, 0, Math.PI * 2); ctx.fill();
    if (d.g === picked) { ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(d.x - 7, d.y - 7, 14, 14); }
  });
  const count = (n, x, y, al = "center") => {
    ctx.font = `600 ${colors.fsXs} ${colors.mono}`; const tw = ctx.measureText(String(n)).width, l = al === "center" ? x - tw / 2 : x;
    ctx.fillStyle = colors.surface; ctx.globalAlpha = 0.85; ctx.fillRect(l - 4, y - 12, tw + 8, 16); ctx.globalAlpha = 1;
    ctx.fillStyle = colors.ink1; ctx.textAlign = al; ctx.fillText(String(n), x, y);
  };
  V.counts.forEach((c) => count(c.n, c.x, c.y + 4));
  /* the column: a short legend, then the genes outside every circle */
  const x = V.colX, small = (t, xx, y, col = colors.ink2) => { ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(t, xx, y); };
  [[colors.empirical, "truly changed"], [colors.extreme, "unchanged"]].forEach(([col, t], i) => {
    const y = B.y0 + 34 + i * 18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 4, y - 4, 3.6, 0, Math.PI * 2); ctx.fill(); small(t, x + 14, y);
  });
  count("n", x, B.y0 + 70, "left"); small("genes in the region", x + 20, B.y0 + 70);
  small("a dot picks the gene", x, B.y0 + 88, colors.ink3);
  const yq = B.y1 - 60;
  ctx.font = `600 ${colors.fsMd} ${colors.mono}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.fillText(String(V.quiet), x, yq);
  small("in the box, outside every", x, yq + 17); small("circle: unchanged, and", x, yq + 31); small("called by neither test", x, yq + 45);
  ctx.textAlign = "left";
}

function drawTumourLiver(ctx, colors, w, params, state) {
  const L = tlLayout(w), C = state.cond, M = L.map;
  drawDiscMap(ctx, colors, state, M, { solid: C.within, muted: (a) => !a.testable, title: "Click a cluster" });
  /* WHICH LEVEL EACH TEST COUNTS AS ITS REPLICATES (his pick, figure 3 of
     `_lab/cell-markers-explain-mock`): patients, their liver and tumour
     samples, the cluster's cells in each. A patient's effect reaches both its
     samples, so tumour minus liver subtracts it; a sample's reaches only its
     own cells, all alike, so they are one draw of it, which the cell test
     counts once a cell. Replaced the per-sample table (the tree carries its
     counts) and the four lines saying which column is which test. */
  drawDesignTree(ctx, colors, C, { x: L.tableX, y: M.y, w: w - L.tableX - 8 });
  /* A FADED CLUSTER SAYS WHY (his round: "a tumour cell cluster … doesn't
     exist in control liver samples, so if I click on it, what does it do?").
     Nothing: with no liver cells of its own it has no baseline to be compared
     against by tissue, so it is not offered. */
  const faded = state.cl.ann.filter((a) => !a.testable);
  if (faded.length) {
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
    ctx.fillText(`Faded: fewer than ${MIN_PER_SAMPLE} cells in a sample, so no tissue comparison: ${faded.map((a) => `${TYPES[a.type].name} · ${a.c}`).join(", ")}`, M.x, M.y + M.S + 18);
  }
  if (!C.testable) {
    ctx.fillStyle = colors.ink1; ctx.fillText(`Fewer than ${MIN_PER_SAMPLE} of this cluster's cells in a sample: it cannot be compared by tissue.`, 8, L.volTop);
    return;
  }
  const gv = state.gene, vMax = Math.max(0.5, ...gv.vals.flat(), ...gv.pb) * 1.08;
  [[C.volC, `Over cells: ${C.n} cells (Wilcoxon)`, "p_val_adj", "cells"], [C.volD, "Over samples: 4 pseudobulk samples (DESeq2)", "padj", "samples"]].forEach(([pts, title, pName, mode], k) => {
    const V = volGeom(w, L, pts, k), { X, PW, top, bh, sx, sy } = V;
    heading(ctx, colors, title, X, top - 12);
    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, top + bh + 0.5); ctx.lineTo(X + PW, top + bh + 0.5); ctx.moveTo(sx(0) + 0.5, top); ctx.lineTo(sx(0) + 0.5, top + bh); ctx.stroke();
    /* uncalled first, then the calls, then the rings, so nothing hides a call */
    pts.filter((q) => !q.call).forEach((q) => { ctx.fillStyle = colors.ink3; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 2.6, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    pts.filter((q) => q.call).forEach((q) => { ctx.fillStyle = q.truth ? colors.empirical : colors.extreme; ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.2;
    pts.filter((q) => q.truth).forEach((q) => { ctx.beginPath(); ctx.arc(sx(q.lfc), sy(q.nl), 6, 0, Math.PI * 2); ctx.stroke(); });
    /* the picked gene */
    const sel = pts.find((q) => q.g === gv.g);
    if (sel) { ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(sx(sel.lfc) - 7, sy(sel.nl) - 7, 14, 14); }
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center"; ctx.fillText("log2 fold change, tumour against liver", X + PW / 2, top + bh + 15);
    ctx.textAlign = "left"; ctx.fillText("−log10 p", X + 4, top + 10);
    heading(ctx, colors, `First ${LIST_ROWS} genes by p`, X, L.listTop - 12);
    drawList(ctx, colors, X, L.listTop + 6, PW, pts, gv.g, pName);
    heading(ctx, colors, `${geneName(gv.g)}, ${gv.truth ? "truly changed" : "unchanged"}: ${mode === "cells" ? "each cell" : "each sample's cells summed"}`, X, L.geneTop - 12);
    drawGeneHalf(ctx, colors, gv, { x: X + 30, y: L.geneTop, w: PW - 30, h: L.geneH }, mode, vMax);
  });
  ctx.save(); ctx.translate(12, L.geneTop + (L.geneH - 74) / 2); ctx.rotate(-Math.PI / 2); ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "center"; ctx.fillText("log(1 + per 10,000)", 0, 0); ctx.restore();
  drawVenn(ctx, colors, vennOf(state, w, L), L, gv.g);
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
  height: (params) => (params.page === "clusters" || !HEIGHTS[params.page] ? clustersHeight(params) : HEIGHTS[params.page]),

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
    gene: {
      type: "select", label: "Gene",
      detail: "the gene drawn under both lists, as each test sees it; a click on a volcano's point, a list's row or a dot of the Venn picks one too",
      options: GENE_OPTIONS, default: "unchanged", when: ON("tumour-liver"),
    },
    tlSampSec: { type: "section", label: "The samples", when: ON("tumour-liver") },
    change: {
      type: "choice", label: "True change",
      detail: "the log2 fold change of 20 genes in the tumour-sample cells, a different 20 in each cell type, half up and half down; every other gene is unchanged",
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
      /* the volcanos' and gene views' key, short (his round: "do you need the
         other legend?" — yes: the Venn keys its own dots, and its blue is
         truly changed whether called or not, where the volcanos' blue is a
         call) */
      { token: "ink-3", label: "Not called", mark: "dot" },
      { token: "empirical", label: "Called, truly changed", mark: "dot" },
      { token: "extreme", label: "Called, unchanged", mark: "dot" },
      { token: "reference", label: "Ring: truly changed", mark: "line" },
      { token: "highlight", label: "Square: the picked gene", mark: "line" },
      { token: "ink-2", label: "Cells: hollow liver, filled tumour", mark: "dot" },
    ];
    return types;
  },

  compute: ({ params }) => {
    const cl = clustersFor(params.seed, params.res);
    const out = {
      stage: stageFor(params.seed, params.sampleSd, params.patientSd, params.change),
      embed: embedFor(params.seed), cl,
      mk: markersFor(params, cl),
      cond: conditionFor(params, cl),
      gene: null,
      comp: compositionFor(params.seed, params.compSd),
    };
    out.gene = geneView(params, out.cond, out.stage);
    return out;
  },

  regions: ({ w, params, state }) => {
    /* core probes the table at load, before compute has run */
    if (!state) return [];
    if (params.page === "two-clusters") {
      const L = twoLayout(w), tested = state.mk.tested;
      const M2 = L.maps[1];
      return [
        ...discTiles(state, L.maps[0]).filter((t) => t.c < MAX_ROWS).map((t) => ({ ...t, set: { comparator: String(t.c) }, label: `comparator cluster ${t.c}` })),
        /* the baseline map's background, under its clusters: the last region hit wins */
        { x: M2.x, y: M2.y, w: M2.S, h: M2.S, set: { baseline: "rest" }, label: "All other cells" },
        /* the comparator is not a baseline it can have */
        ...discTiles(state, L.maps[1]).filter((t) => t.c < MAX_ROWS && t.c !== tested).map((t) => ({ ...t, set: { baseline: String(t.c) }, label: `baseline cluster ${t.c}` })),
        { ...L.rest, set: { baseline: "rest" }, label: "All other cells" },
      ];
    }
    if (params.page === "tumour-liver") {
      const L = tlLayout(w), ok = new Set(state.cl.ann.filter((a) => a.testable).map((a) => a.c));
      const out = discTiles(state, L.map).filter((t) => ok.has(t.c) && t.c < MAX_ROWS).map((t) => ({ ...t, set: { within: String(t.c) }, label: `cluster ${t.c}` }));
      /* every point of both volcanos, in drawing order: the last region hit
         wins, so a call drawn over an uncalled gene is the one picked; and
         every row of both lists */
      if (state.cond.testable) [state.cond.volC, state.cond.volD].forEach((pts, k) => {
        const V = volGeom(w, L, pts, k);
        [...pts.filter((q) => !q.call), ...pts.filter((q) => q.call)].forEach((q) => out.push({ x: V.sx(q.lfc) - 5, y: V.sy(q.nl) - 5, w: 10, h: 10, set: { gene: geneName(q.g) }, label: geneName(q.g) }));
        listRows(pts).forEach((q, i) => out.push({ x: L.cols[k] - 4, y: L.listTop + 6 + 18 + i * LIST_ROW_H - 12, w: L.PW + 8, h: LIST_ROW_H, set: { gene: geneName(q.g) }, label: geneName(q.g) }));
      });
      if (state.cond.testable) vennOf(state, w, L).dots.forEach((d) => out.push({ x: d.x - 5, y: d.y - 5, w: 10, h: 10, set: { gene: geneName(d.g) }, label: geneName(d.g) }));
      return out;
    }
    return [];
  },

  /* the Clusters page's hover (drawClusters); the other pages ignore it */
  pointer: true,
  draw: ({ ctx, colors, w, params, state, pointer }) => {
    if (params.page === "clusters") drawClusters(ctx, colors, w, params, state, pointer);
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
    /* EACH TEST LEADS WITH WHAT IT FOUND AND ITS FALSE CALLS (his round,
       2026-09-25: "should we report TP/FP?" — the share of calls that are
       true read 100% for FindMarkers wherever samples do not differ, and a
       test that calls one gene scores 100% too). Power and the false calls
       together, as the DE benchmarks report them, with the promise each cut
       makes, so the page shows when the promise holds. Over 20 seeds the test
       over cells made 6.8 false calls for 3.5 true at sample effect 0.4
       (`_lab/cell-markers-methods-measure.txt`). */
    const tiles = (v, name, cut, promise) => {
      const t = tp(v), f = fp(v), n = t + f;
      const found = { label: `${name}: truly changed genes found`, value: `${t} of 20`, note: `the cluster's type's own changed genes, called at ${cut} < 0.05` };
      const falseCalls = { label: `${name}: false calls`, value: n ? `${f} of its ${n} call${n === 1 ? "" : "s"}` : "no calls", note: `${n ? `${Math.round((100 * f) / n)}% of the genes it called; ` : ""}${promise}` };
      return truth ? [found, falseCalls] : [falseCalls];
    };
    return [
      ...tiles(C.volC, "Over cells", "p_val_adj", "Bonferroni aims for at most a 5% chance of any false call"),
      ...tiles(C.volD, "Over samples", "padj", "Benjamini–Hochberg aims for about 5% of calls false, on average"),
    ];
  },
});
