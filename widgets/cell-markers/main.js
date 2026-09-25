/* cell-markers — slot 81, "Single-Cell RNA-seq: Clustering and Differential Expression".
 * SHIPPED 2026-09-25, with 35 fingerprint states.
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
import { simulate, normalise, pcaScaled, knn, snn, findClusters, louvainTwoPasses, findMarkers, geneKind, geneName, conditionGenesOf, TYPES, SAMPLES, G, G_MARK } from "./engine.js";
import { umapSgd } from "./umap.js";

const PAGES = [
  /* THE ANALYSES IN THE FIELD'S TERMS (his pick, 2026-09-25): each is one
     stage of the standard workflow, as Seurat and OSCA name them — graph-based
     clustering (FindNeighbors, FindClusters), annotation by canonical markers,
     marker genes (FindMarkers between clusters), differential expression
     between conditions, and differential abundance of cell types. They were
     Graph · Clusters · Two clusters · Tumour vs liver · Composition. */
  { value: "clustering", label: "Clustering" },
  { value: "annotation", label: "Annotation" },
  { value: "markers", label: "Marker genes" },
  { value: "differential-expression", label: "Differential expression" },
  { value: "differential-abundance", label: "Differential abundance", span: true },
];
const ON = (page) => ({ param: "page", equals: page });
const CELL_PAGES = { param: "page", oneOf: ["annotation", "markers", "differential-expression"] };
const HEIGHTS = { clustering: 470, markers: 820, "differential-expression": 1544, "differential-abundance": 380 };
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
  { value: "unchanged", label: "Non-DE gene with the smallest cell-level p", group: "Selected by cell-level p" },
  { value: "changed", label: "DE gene with the smallest cell-level p", group: "Selected by cell-level p" },
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
const caches = { graph: new Map(), gstages: new Map(), stage: new Map(), embed: new Map(), clusters: new Map(), markers: new Map(), cond: new Map(), comp: new Map() };
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
    return { adj, U, P, types: cells.map((c) => c.type) };
  });
}
/* THE GRAPH PAGE'S 45 CELLS (his pick A from `_lab/cell-markers-graph-mock`,
   2026-09-25): 30 hepatocytes and 15 tumour cells, the two types that share
   ten markers, so the kNN graph has links between them for the SNN prune to
   remove. Measured in the mock: three distinct types (Kupffer, immune,
   endothelial) gave no link between types at k = 10, nothing to prune and one
   answer at every resolution. k = 15 for 45 cells (20 on the full data); the
   neighbours are found in the page's own 20 principal components. Drawn by a
   seeded force-directed layout of the kNN graph: on PC 1–2 each type was one
   tight clump and its edges one solid mass. */
/* resolution 1 opens the page: there, on seeds 1 and 3, the first pass
   leaves 3 communities and the second merges them to 2, as the lesson's
   figure does; at 1.2 the split hepatocytes stay split (measured
   2026-09-25, seeds 1–3) */
const GRAPH_K = 15, GRAPH_RES = ["0.5", "1", "1.5", "2"];
function graphFor(seed) {
  return remember(caches.graph, String(seed), () => {
    const { cells } = stageFor(seed, "0", "0.3", "0"), { P } = embedFor(seed), rng = makeRng(derived(seed, 6)), pick = [];
    [["hepatocyte", 30], ["tumour", 15]].forEach(([key, count]) => {
      const ti = TYPES.findIndex((t) => t.key === key), idx = cells.map((c, i) => (c.type === ti ? i : -1)).filter((i) => i >= 0);
      for (let n = 0; n < count; n += 1) { const j = Math.floor(rng.next() * idx.length); pick.push(idx.splice(j, 1)[0]); }
    });
    const Ps = pick.map((i) => P[i]), types = pick.map((i) => cells[i].type), nn = knn(Ps, GRAPH_K), n = Ps.length;
    /* every pair sharing a neighbour, with its Jaccard, before the prune (snn's rule) */
    const sets = nn.map((a, i) => new Set([i, ...a])), pairs = [];
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      let inter = 0; for (const v of sets[i]) if (sets[j].has(v)) inter += 1;
      if (inter) pairs.push({ i, j, jac: inter / (sets[i].size + sets[j].size - inter) });
    }
    /* Fruchterman–Reingold on the kNN graph, from PC 1–2, seeded */
    const lr = makeRng(derived(seed, 7));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; Ps.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const pos = Ps.map((q) => [(q[0] - x0) / (x1 - x0 || 1) + 0.05 * lr.normal(), (q[1] - y0) / (y1 - y0 || 1) + 0.05 * lr.normal()]);
    const E = new Set(); nn.forEach((nb, i) => nb.forEach((j) => E.add(i < j ? `${i},${j}` : `${j},${i}`)));
    const edges = [...E].map((e) => e.split(",").map(Number)), kk = Math.sqrt(1 / n);
    for (let it = 0, T = 0.1; it < 400; it += 1, T *= 0.99) {
      const d = pos.map(() => [0, 0]);
      for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
        const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1], r = Math.max(1e-3, Math.hypot(dx, dy)), f = (kk * kk) / r;
        d[i][0] += (dx / r) * f; d[i][1] += (dy / r) * f; d[j][0] -= (dx / r) * f; d[j][1] -= (dy / r) * f;
      }
      for (const [i, j] of edges) {
        const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1], r = Math.max(1e-3, Math.hypot(dx, dy)), f = (r * r) / kk;
        d[i][0] -= (dx / r) * f; d[i][1] -= (dy / r) * f; d[j][0] += (dx / r) * f; d[j][1] += (dy / r) * f;
      }
      pos.forEach((q, i) => { const m = Math.hypot(d[i][0], d[i][1]) || 1, st = Math.min(m, T); q[0] += (d[i][0] / m) * st; q[1] += (d[i][1] / m) * st; });
    }
    return { types, nn, pairs, adj: snn(nn), pos };
  });
}
function graphStagesFor(seed, res) {
  return remember(caches.gstages, `${seed}|${res}`, () => louvainTwoPasses(graphFor(seed).adj, Number(res), makeRng(derived(seed, 8))));
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
  const S = Math.min(260, Math.floor(w * 0.45)), PW = Math.floor((w - 88) / 2);
  const volTop = TOP + 260 + 96, volH = 190, listTop = volTop + volH + 52, geneTop = listTop + 18 + LIST_ROWS * LIST_ROW_H + 52;
  return { map: { x: 8, y: TOP, S }, tableX: 8 + S + 28, PW, cols: [24, 24 + PW + 40], volTop, volH, listTop, geneTop, geneH: 220, keyTop: geneTop + 220 + 26, vennTop: geneTop + 220 + 100 };
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

/* the Graph page: six stages, one a press, tweened (his pick) */
/* the stages in the lesson figure's own terms (Blondel et al. 2008: modularity optimisation, community aggregation) */
const GRAPH_STAGES = ["The cells", "kNN graph", "SNN graph", "Modularity optimisation (pass 1)", "Community aggregation", "Modularity optimisation (pass 2)"];
const GRAPH_TWEEN_MS = 900;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function graphLayout(w) {
  const gw = Math.min(470, Math.floor(w * 0.6));
  return { G: { x: 8, y: 34, w: gw, h: 400 }, sideX: 8 + gw + 22 };
}
function hullOf(pts) {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function drawGraph(ctx, colors, w, params, state, anim) {
  const Gd = state.graph, St = state.gstages, { G, sideX } = graphLayout(w);
  const s = anim?.stage ?? 0, moving = Boolean(anim?.moving), e = moving ? easeInOut(anim.t) : 1;
  /* a quantity per stage, eased from the last stage to this one while a press runs */
  const at = (f) => (moving ? f(s - 1) + (f(s) - f(s - 1)) * e : f(s));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; Gd.pos.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const home = Gd.pos.map(([x, y]) => [G.x + 22 + ((x - x0) / (x1 - x0 || 1)) * (G.w - 44), G.y + 22 + (1 - (y - y0) / (y1 - y0 || 1)) * (G.h - 44)]);
  const k1 = new Set(St.first).size, kf = new Set(St.final).size;
  const cent = [...Array(k1).keys()].map((c) => { const m = home.filter((_, i) => St.first[i] === c); return [m.reduce((a, q) => a + q[0], 0) / m.length, m.reduce((a, q) => a + q[1], 0) / m.length, m.length]; });
  /* stage 4 gathers each cell into its community's node; every other stage leaves it home */
  const posAt = (st, i) => (st === 4 ? cent[St.first[i]] : home[i]);
  const P = home.map((_, i) => { const a = posAt(moving ? s - 1 : s, i), b = posAt(s, i); return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]; });
  heading(ctx, colors, `${s + 1} · ${GRAPH_STAGES[s]}`, G.x, 20);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(G.x + 0.5, G.y + 0.5, G.w, G.h);
  /* LINES LIGHT WHERE DENSE (his round): 675 kNN links and 540 SNN edges on
     45 cells; opacity capped, SNN width and opacity by weight */
  const aKnn = at((q) => (q === 1 ? 1 : 0));
  if (aKnn > 0.01) {
    ctx.strokeStyle = colors.ink3; ctx.lineWidth = 0.8;
    Gd.nn.forEach((nb, i) => nb.forEach((j) => { ctx.globalAlpha = 0.2 * aKnn; ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); }));
  }
  const aSnn = at((q) => (q === 2 || q === 3 ? 1 : 0)), aCut = at((q) => (q === 2 ? 1 : 0));
  if (aSnn > 0.01 || aCut > 0.01) Gd.pairs.forEach((q) => {
    const kept = q.jac >= 1 / 15, a = kept ? aSnn : aCut;
    if (a <= 0.01) return;
    ctx.beginPath(); ctx.moveTo(P[q.i][0], P[q.i][1]); ctx.lineTo(P[q.j][0], P[q.j][1]);
    if (kept) { ctx.strokeStyle = colors.ink2; ctx.globalAlpha = Math.min(0.35, 0.05 + q.jac * 0.45) * a; ctx.lineWidth = 0.4 + 2.2 * q.jac; ctx.setLineDash([]); }
    else { ctx.strokeStyle = colors.extreme; ctx.globalAlpha = 0.22 * a; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]); }
    ctx.stroke(); ctx.setLineDash([]);
  });
  ctx.globalAlpha = 1;
  /* stage 4: the communities as nodes, the edges between them summed */
  const aNode = at((q) => (q === 4 ? 1 : 0));
  if (aNode > 0.01) {
    ctx.globalAlpha = aNode;
    St.agg.forEach((mm, a) => mm.forEach((wt, b) => {
      if (b <= a) return;
      ctx.strokeStyle = colors.ink2; ctx.lineWidth = 0.8 + Math.min(6, wt * 0.8); ctx.beginPath(); ctx.moveTo(cent[a][0], cent[a][1]); ctx.lineTo(cent[b][0], cent[b][1]); ctx.stroke();
      const mx = (cent[a][0] + cent[b][0]) / 2, my = (cent[a][1] + cent[b][1]) / 2;
      ctx.font = `${colors.fsXs} ${colors.mono}`; const tw = ctx.measureText(wt.toFixed(1)).width;
      ctx.fillStyle = colors.surface; ctx.fillRect(mx - tw / 2 - 3, my - 10, tw + 6, 14); ctx.fillStyle = colors.ink1; ctx.textAlign = "center"; ctx.fillText(wt.toFixed(1), mx, my + 1);
    }));
    cent.forEach(([x, y, n], c) => {
      const r = 10 + Math.sqrt(n) * 3.2;
      ctx.fillStyle = colors.surface2; ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "center"; ctx.fillText(`${n} cells`, x, y + 4);
      ctx.fillStyle = colors.ink3; ctx.fillText(`self-loop ${(St.agg[c].get(c) ?? 0).toFixed(1)}`, x, y + r + 13);
    });
    ctx.globalAlpha = 1;
  }
  /* the cells, filled by true type; hidden inside the nodes at stage 4 */
  const aCell = at((q) => (q === 4 ? 0 : 1));
  if (aCell > 0.01) {
    ctx.globalAlpha = aCell;
    P.forEach((q, i) => { ctx.fillStyle = hueOf(colors, Gd.types[i]); ctx.beginPath(); ctx.arc(q[0], q[1], 4.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  /* communities as dashed outlines: the first pass's at stage 3, the final at stage 5 */
  const outline = (comm, a) => {
    if (a <= 0.01) return;
    ctx.globalAlpha = a; ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    [...new Set(comm)].forEach((c) => {
      const h = hullOf(home.filter((_, i) => comm[i] === c)); ctx.beginPath();
      if (h.length < 3) { const q = h[0]; ctx.arc(q[0], q[1], 10, 0, Math.PI * 2); }
      else { const cx = h.reduce((acc, q) => acc + q[0], 0) / h.length, cy = h.reduce((acc, q) => acc + q[1], 0) / h.length; h.forEach((q, i) => { const dx = q[0] - cx, dy = q[1] - cy, d = Math.hypot(dx, dy) || 1, X = q[0] + (dx / d) * 10, Y = q[1] + (dy / d) * 10; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
      ctx.stroke();
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  outline(St.first, at((q) => (q === 3 ? 1 : 0)));
  outline(St.final, at((q) => (q === 5 ? 1 : 0)));
  /* the side: the stages, and this one's numbers */
  const small = (t, y, col = colors.ink2, bold = false) => { ctx.font = `${bold ? "600 " : ""}${colors.fsXs} ${colors.font}`; ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(t, sideX, y); };
  GRAPH_STAGES.forEach((t, i) => small(`${i + 1}  ${t}`, 52 + i * 18, i === s ? colors.ink1 : colors.ink3, i === s));
  const kept = Gd.pairs.filter((q) => q.jac >= 1 / 15), cut = Gd.pairs.length - kept.length;
  const crossKept = kept.filter((q) => Gd.types[q.i] !== Gd.types[q.j]).length, crossCut = Gd.pairs.filter((q) => q.jac < 1 / 15 && Gd.types[q.i] !== Gd.types[q.j]).length;
  const knnCross = Gd.nn.reduce((acc, nb, i) => acc + nb.filter((j) => Gd.types[j] !== Gd.types[i]).length, 0);
  const text = [
    ["45 cells: 30 hepatocytes and", "15 tumour cells. Input: the", "first 20 principal components", "of the integrated data", "(dims = 1:20)."],
    ["Each cell is connected to its", `k = ${GRAPH_K} nearest neighbours by`, `Euclidean distance: ${45 * GRAPH_K} edges,`, `${knnCross} between cell types.`],
    ["Edge weight: Jaccard index of", "the two cells' neighbour sets", `(${Gd.pairs.length} pairs overlap). Edges`, "below 1/15 are pruned", `(prune.SNN): ${cut}, ${crossCut} of them`, `between types; ${crossKept} retained`, "between types."],
    ["Local moving: each node joins", "the neighbouring community", "with the largest modularity", "gain, until no move increases", `Q. ${k1} communities, Q = ${St.q1.toFixed(3)}.`],
    ["Each community becomes one", "node; weights between", "communities are summed, and", "weights within a community", "become a self-loop."],
    ["Modularity optimisation on the", `aggregated graph: ${kf}`, `communities, Q = ${St.q2.toFixed(3)}`, `(resolution ${params.graphRes}).`],
  ];
  text[s].forEach((t, i) => small(t, 180 + i * 16));
  small(`k = ${GRAPH_K} for 45 cells; for all cells,`, G.y + G.h - 20, colors.ink3);
  small("FindNeighbors' default k.param = 20.", G.y + G.h - 4, colors.ink3);
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
  heading(ctx, colors, `Louvain clusters, resolution ${params.res}: ${cl.k}`, L.maps[0].x, TOP - 9);
  heading(ctx, colors, "True cell type (simulated)", L.maps[1].x, TOP - 9);
  /* numbers only: the map beside it names the types (his round) */
  drawDiscMap(ctx, colors, state, L.maps[0], { name: (a) => `Cluster ${a.c}`, ring: (a) => any && isHot(a), muted: (a) => any && !isHot(a) });
  drawDiscMap(ctx, colors, state, L.maps[1], { by: "type", name: (a) => TYPES[a.type].name, ring: (a) => any && a.type === hotT, muted: (a) => any && a.type !== hotT });
  /* the dot plot of each type's markers: how each cluster is named */
  const genes = []; TYPES.forEach((_, t) => { for (let j = 0; j < 3; j += 1) genes.push(t * G_MARK + j); });
  const x0 = L.labelW, x1 = w - 56, cw = Math.min(30, (x1 - x0) / genes.length);
  heading(ctx, colors, "Canonical marker expression by cluster: the basis of annotation", 8, top - 58);
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

function drawTwo(ctx, colors, w, params, state, pointer) {
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
  /* FindMarkers' table, left: first 8 by p, then significant genes detected
     in most of the baseline; on a canvas narrower than 700 px p_val is
     dropped (his pick, 2026-09-25): p_val_adj is the one read. Beside it, every gene tested as pct.1 against pct.2 —
     where "significant but not specific" is a place, right of pct.2 = 0.5
     (his pick from `_lab/cell-markers-pct-mock`; a volcano saturates at
     p ~ 1e-190 and has no axis for specificity). A pointer on a dot or a
     row lights both and names the gene: an inspector, nothing written. */
  const fm = mk.fm, own = (g) => { const k = geneKind(g); return k.kind === "marker" && k.type === mk.type; };
  const top = fm.res.filter((x) => x.lfc > 0).sort((a, b) => a.lp - b.lp || b.lfc - a.lfc).slice(0, 8);
  const extra = broadOf(mk).filter((x) => !top.includes(x)).slice(0, 3);
  const G2 = pctLayout(w, L), TW = G2.tw, cx = (f) => Math.round(8 + f * TW);
  const narrow = w < 700;
  const cols = narrow
    ? [["gene", cx(0), "left"], ["avg_log2FC", cx(0.42), "right"], ["pct.1", cx(0.58), "right"], ["pct.2", cx(0.74), "right"], ["p_val_adj", cx(0.98), "right"]]
    : [["gene", cx(0), "left"], ["p_val", cx(0.3), "right"], ["avg_log2FC", cx(0.5), "right"], ["pct.1", cx(0.64), "right"], ["pct.2", cx(0.78), "right"], ["p_val_adj", cx(0.98), "right"]];
  let y = L.tableTop;
  heading(ctx, colors, `FindMarkers, cluster ${mk.tested} (${fm.n1} cells) vs ${mk.vsRest ? "all other cells" : `cluster ${mk.otherC}`} (${fm.n2}): top 8 by p`, 8, y - 10);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, y + 8); });
  y += 28;
  /* the hovered gene: a dot within 6px, else a row */
  const rowsAt = [];
  let hot = null;
  if (pointer) {
    let best = 6;
    for (const x of fm.res) { const d = Math.hypot(pointer.x - G2.sx(x.p2), pointer.y - G2.sy(x.p1)); if (d < best) { best = d; hot = x.g; } }
  }
  const all = [...top, ...extra];
  all.forEach((x, i) => rowsAt.push({ g: x.g, y: y + i * 18 + (i >= top.length ? 22 : 0) }));
  if (pointer && hot === null && pointer.x < TW + 8) { const r = rowsAt.find((q) => pointer.y >= q.y - 13 && pointer.y < q.y + 5); if (r) hot = r.g; }
  const row = (x, grey) => {
    if (x.g === hot) { ctx.fillStyle = colors.surface2; ctx.fillRect(4, y - 13, TW + 8, 18); }
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = grey ? colors.ink3 : colors.ink1;
    const v = narrow ? [geneName(x.g), x.lfc.toFixed(2), x.p1.toFixed(2), x.p2.toFixed(2), pFmt(x.lpAdj)] : [geneName(x.g), pFmt(x.lp), x.lfc.toFixed(2), x.p1.toFixed(2), x.p2.toFixed(2), pFmt(x.lpAdj)];
    cols.forEach(([, px, al], k) => { ctx.textAlign = al; ctx.fillText(v[k], px, y); });
    y += 18;
  };
  top.forEach((x) => row(x, !own(x.g)));
  if (extra.length) {
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
    ctx.fillText("Further significant genes with pct.2 > 0.5:", 8, y + 2); y += 22;
    extra.forEach((x) => row(x, true));
  }
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
  ctx.fillText("pct.1, pct.2: fraction of cells with nonzero", 8, y + 10); ctx.fillText("expression in ident.1 and in ident.2", 8, y + 24);
  drawPctScatter(ctx, colors, G2, fm, mk, all, hot);
  ctx.textAlign = "left";
}
/* the scatter's square, right of the table; its scales are shared by the drawing and the hover */
function pctLayout(w, L) {
  const S = Math.min(260, Math.floor(w * 0.36)), x0 = w - S - 16, y0 = L.tableTop + 18;
  return { S, x0, y0, tw: x0 - 60, sx: (v) => x0 + v * S, sy: (v) => y0 + S - v * S };
}
function drawPctScatter(ctx, colors, P, fm, mk, listed, hot) {
  const { S, x0, y0, sx, sy } = P, sig = (x) => x.lpAdj < LOG05;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "right"; ctx.fillText("pct.1 against pct.2, every gene tested", x0 + S, y0 - 10);
  ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, S, S);
  ctx.strokeStyle = colors.grid; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(1), sy(1)); ctx.moveTo(sx(0.5), sy(0)); ctx.lineTo(sx(0.5), sy(1)); ctx.stroke(); ctx.setLineDash([]);
  const small = (t, x, y, al = "left", col = colors.ink3) => { ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = col; ctx.textAlign = al; ctx.fillText(t, x, y); };
  const mono = (t, x, y, al) => { ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3; ctx.textAlign = al; ctx.fillText(t, x, y); };
  mono("0", x0, y0 + S + 14, "left"); mono("1", x0 + S, y0 + S + 14, "right"); small("pct.2 (ident.2)", x0 + S / 2, y0 + S + 28, "center");
  mono("1", x0 - 4, y0 + 9, "right"); mono("0", x0 - 4, y0 + S, "right");
  ctx.save(); ctx.translate(x0 - 16, y0 + S / 2); ctx.rotate(-Math.PI / 2); small("pct.1 (ident.1)", 0, 0, "center"); ctx.restore();
  small("specific", x0 + 6, y0 + 14); small("pct.2 > 0.5", sx(0.5) + 4, y0 + S - 6);
  /* not significant, then up in the baseline, then up in the comparator on top */
  fm.res.filter((x) => !sig(x)).forEach((x) => { ctx.fillStyle = colors.ink3; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(sx(x.p2), sy(x.p1), 2, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 0.7; ctx.fillStyle = colors.ink2;
  fm.res.filter((x) => sig(x) && x.lfc < 0).forEach((x) => { ctx.beginPath(); ctx.arc(sx(x.p2), sy(x.p1), 2.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.fillStyle = hueOf(colors, mk.type);
  fm.res.filter((x) => sig(x) && x.lfc > 0).forEach((x) => { ctx.beginPath(); ctx.arc(sx(x.p2), sy(x.p1), 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1;
  listed.forEach((x) => { ctx.beginPath(); ctx.arc(sx(x.p2), sy(x.p1), 5, 0, Math.PI * 2); ctx.stroke(); });
  const h = fm.res.find((x) => x.g === hot);
  if (h) {
    ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(sx(h.p2) - 7, sy(h.p1) - 7, 14, 14);
    ctx.font = `600 ${colors.fsXs} ${colors.mono}`; const t = geneName(h.g), tw = ctx.measureText(t).width;
    const lx = Math.min(x0 + S - tw - 4, sx(h.p2) + 10), ly = Math.max(y0 + 12, sy(h.p1) - 8);
    ctx.fillStyle = colors.surface; ctx.fillRect(lx - 3, ly - 11, tw + 6, 15); ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.fillText(t, lx, ly);
  }
  /* its key */
  const ky = y0 + S + 48;
  [[hueOf(colors, mk.type), "significant, up in ident.1"], [colors.ink2, "significant, up in ident.2"], [colors.ink3, "not significant"]].forEach(([c, t], i) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x0 + 4, ky + i * 16 - 4, 3, 0, Math.PI * 2); ctx.fill(); small(t, x0 + 14, ky + i * 16, "left", colors.ink2);
  });
  ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + 4, ky + 44, 5, 0, Math.PI * 2); ctx.stroke(); small("in the table", x0 + 14, ky + 48, "left", colors.ink2);
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
  const top = B.y, bh = B.h - 88, colW = B.w / 4, sy = (v) => top + bh - (v / vMax) * bh;
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
    /* three short lines, not "P1 tumour": a column is ~52px on a narrow canvas */
    ctx.fillText(ORDER_NAMES[j][1], cx, top + bh + 14); ctx.fillText(`P${(j % 2) + 1}`, cx, top + bh + 27);
    ctx.fillText(mode === "cells" ? `${gv.vals[j].length} cells` : "summed", cx, top + bh + 40);
  });
  const n = gv.vals.reduce((a, v) => a + v.length, 0), c = gv.cells, d = gv.deseq;
  const lines = mode === "cells"
    ? [`n = ${n} cells: ${c.lpAdj < LOG05 ? "significant" : "not significant"}`, `p_val_adj = ${pFmt(c.lpAdj)}`]
    : [`n = 4 samples: ${d && d.padj < 0.05 ? "significant" : "not significant"}`, d ? `padj = ${pFmt(Math.log10(Math.max(1e-300, d.padj)))}` : "filtered by DESeq2: too few counts"];
  ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink1;
  lines.forEach((t, k) => ctx.fillText(t, B.x - 30, top + bh + 60 + k * 15));
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
  heading(ctx, colors, `${TYPES[C.a.type].name} · ${C.a.c}: the replicate unit of each test`, B.x, B.y + 14);
  const rowP = B.y + 44, rowS = B.y + 100, rowC = B.y + 150, colW = B.w / 4, sx = (j) => B.x + colW * (j + 0.5), px = (p) => (sx(p) + sx(p + 2)) / 2;
  const cap = (t, y) => { ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left"; ctx.fillText(t, B.x, y); };
  /* the level each test counts: a shaded band, in the fill of the columns'
     header bands, labelled with the header's own words (his round: the
     dotted lines were "too obvious and jarring") */
  const band = (y0, y1) => { ctx.fillStyle = colors.surface2; ctx.fillRect(B.x, y0, B.w, y1 - y0); };
  /* the bands' labels, last, on the canvas's own surface: the tree's lines pass behind them */
  const bandLabel = (y0, label) => {
    ctx.font = `600 ${colors.fsXs} ${colors.font}`; const tw = ctx.measureText(label).width, x = B.x + B.w - 4;
    ctx.fillStyle = colors.surface; ctx.fillRect(x - tw - 4, y0 - 15, tw + 8, 14);
    ctx.fillStyle = colors.ink1; ctx.textAlign = "right"; ctx.fillText(label, x, y0 - 4);
  };
  band(rowS - 17, rowS + 17); band(rowC - 14, rowC + 26);
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
  bandLabel(rowS - 17, "Pseudobulk: n = 4"); bandLabel(rowC - 14, `Cell-level: n = ${C.n}`);
  ["Variation between patients is shared by a", "patient's two samples and cancels in the tumour–", "liver contrast. Variation between samples is shared", "by all cells of a sample: they are not independent."]
    .forEach((t, i) => cap(t, B.y + 206 + i * 14));
  ctx.textAlign = "left";
}

/** The volcanos' and gene views' key, each mark drawn as it is drawn there
    (a ring, a square, hollow and filled cells), flowing onto a second line
    when the canvas is narrow. The Venn keys its own dots: its blue is truly
    changed whether called or not, where a volcano's blue is a call. */
function drawKey(ctx, colors, L, w) {
  const items = [
    [(x, y) => { ctx.fillStyle = colors.ink3; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }, "Not significant"],
    [(x, y) => { ctx.fillStyle = colors.empirical; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }, "Significant, DE (true positive)"],
    [(x, y) => { ctx.fillStyle = colors.extreme; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }, "Significant, non-DE (false positive)"],
    [(x, y) => { ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.stroke(); }, "Ring: DE gene"],
    [(x, y) => { ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12); }, "Square: selected gene"],
    [(x, y) => { ctx.strokeStyle = colors.ink2; ctx.fillStyle = colors.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x - 4, y, 2.4, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 4, y, 2.4, 0, Math.PI * 2); ctx.fill(); }, "Hollow: liver; filled: tumour"],
  ];
  ctx.font = `${colors.fsXs} ${colors.font}`;
  let x = L.cols[0], y = L.keyTop;
  items.forEach(([mark, label]) => {
    const iw = 18 + ctx.measureText(label).width;
    if (x + iw > w - 8) { x = L.cols[0]; y += 20; }
    mark(x + 6, y - 4);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left"; ctx.fillText(label, x + 16, y);
    x += iw + 18;
  });
}

function drawVenn(ctx, colors, V, L, picked) {
  heading(ctx, colors, "Significant genes against the simulated truth", V.box.x0, L.vennTop - 12);
  const [T, Cc, Sc] = V.circles, R = V.R, B = V.box;
  /* the box: every gene */
  ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.strokeRect(B.x0 + 0.5, B.y0 + 0.5, B.x1 - B.x0 - 1, B.y1 - B.y0 - 1);
  ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left"; ctx.fillText(`All ${G} genes`, B.x0 + 8, B.y0 + 16);
  [[T, colors.reference, []], [Cc, colors.ink1, []], [Sc, colors.ink2, [6, 4]]].forEach(([c, col, dash]) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  });
  ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "center";
  ctx.fillText(`DE genes (${V.nTruth})`, T.x, T.y - R - 8);
  ctx.fillText(`Significant, cell-level (${V.nCells})`, Cc.x - R * 0.3, Cc.y + R + 18);
  ctx.fillText(`Significant, pseudobulk (${V.nSamples})`, Sc.x + R * 0.3, Sc.y + R + 18);
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
  [[colors.empirical, "DE gene"], [colors.extreme, "non-DE gene"]].forEach(([col, t], i) => {
    const y = B.y0 + 34 + i * 18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 4, y - 4, 3.6, 0, Math.PI * 2); ctx.fill(); small(t, x + 14, y);
  });
  count("n", x, B.y0 + 70, "left"); small("genes in the region", x + 20, B.y0 + 70);
  small("click a dot to select the gene", x, B.y0 + 88, colors.ink3);
  const yq = B.y1 - 60;
  ctx.font = `600 ${colors.fsMd} ${colors.mono}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.fillText(String(V.quiet), x, yq);
  small("true negatives: non-DE", x, yq + 17); small("genes significant in", x, yq + 31); small("neither test", x, yq + 45);
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
    ctx.fillText(`Not testable (fewer than ${MIN_PER_SAMPLE} cells in a sample): ${faded.map((a) => `${TYPES[a.type].name} · ${a.c}`).join(", ")}`, M.x, M.y + M.S + 18);
  }
  if (!C.testable) {
    ctx.fillStyle = colors.ink1; ctx.fillText(`Not testable: fewer than ${MIN_PER_SAMPLE} cells of this cluster in at least one sample.`, 8, L.volTop);
    return;
  }
  const gv = state.gene, vMax = Math.max(0.5, ...gv.vals.flat(), ...gv.pb) * 1.08;
  /* EACH TEST ONE COLUMN UNDER A HEADER BAND (his round: "the sample/patient
     diagram has to say right and column … can we visually show this
     instead?"): the band names the level it counts in the words of the tree's
     band for that level, and a faint frame holds its volcano, list and gene
     view together. Dotted and dashed frames matched to the tree were tried
     the same day and struck as jarring. */
  [[C.volC, `Cell-level: n = ${C.n} cells`, "Wilcoxon rank-sum test (FindMarkers); cells as replicates", "p_val_adj", "cells"],
   [C.volD, "Pseudobulk: n = 4 samples", "DESeq2 on summed counts; samples as replicates", "padj", "samples"]].forEach(([pts, title, sub, pName, mode], k) => {
    const V = volGeom(w, L, pts, k), { X, PW, top, bh, sx, sy } = V;
    const F = { x: X - 12, y: top - 62, w: PW + 24, h: L.geneTop + L.geneH - (top - 62) + 6 };
    ctx.fillStyle = colors.surface2; ctx.fillRect(F.x, F.y, F.w, 40);
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(F.x + 0.5, F.y + 0.5, F.w - 1, F.h - 1);
    heading(ctx, colors, title, X, F.y + 17);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left"; ctx.fillText(sub, X, F.y + 32);
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
    heading(ctx, colors, `Top ${LIST_ROWS} genes by p`, X, L.listTop - 12);
    drawList(ctx, colors, X, L.listTop + 6, PW, pts, gv.g, pName);
    heading(ctx, colors, `${geneName(gv.g)} (${gv.truth ? "DE" : "non-DE"}): ${mode === "cells" ? "expression per cell" : "pseudobulk per sample"}`, X, L.geneTop - 12);
    drawGeneHalf(ctx, colors, gv, { x: X + 38, y: L.geneTop, w: PW - 38, h: L.geneH }, mode, vMax);
    ctx.save(); ctx.translate(X + 4, L.geneTop + (L.geneH - 88) / 2); ctx.rotate(-Math.PI / 2); ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "center"; ctx.fillText("log1p(CP10k)", 0, 0); ctx.restore();
  });
  drawKey(ctx, colors, L, w);
  drawVenn(ctx, colors, vennOf(state, w, L), L, gv.g);
  ctx.textAlign = "left";
}

function drawComposition(ctx, colors, w, params, state) {
  const P = state.comp;
  const barW = Math.min(64, Math.floor((w * 0.42 - 20) / 4) - 14), bh = HEIGHTS["differential-abundance"] - TOP - 50;
  heading(ctx, colors, `Composition per sample (${COMP_CELLS} cells)`, 8, TOP - 9);
  ORDER.forEach((k, j) => {
    const x = 16 + j * (barW + 14); let y = TOP + bh;
    TYPES.forEach((_, t) => { const h = (P.n[k][t] / COMP_CELLS) * bh; ctx.fillStyle = hueOf(colors, t); ctx.fillRect(x, y - h, barW, h); y -= h; });
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(ORDER_NAMES[j][0], x + barW / 2, TOP + bh + 14); ctx.fillText(ORDER_NAMES[j][1], x + barW / 2, TOP + bh + 28);
  });
  const X = Math.round(w * 0.45), cx = (f) => Math.round(X + f * (w - X - 8));
  const cols = [["type", cx(0), "left"], ["liver", cx(0.45), "right"], ["tumour", cx(0.6), "right"], ["p, cells", cx(0.8), "right"], ["p, samples", cx(1), "right"]];
  heading(ctx, colors, "Proportions, liver vs tumour (bold: p < 0.05)", X, TOP - 9);
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
  title: "Single-Cell RNA-seq: Clustering and Differential Expression",
  /* S2 of four, his pick with the title (2026-09-25): the reason cells are
     not the replicate, in place of a five-line tour of every analysis; the
     resolution, the pct.1/pct.2 point and the proportions are left to the
     figure. The title was "Clusters and Markers"; it now pairs with widget
     78's "Bulk RNA-seq: Differential Expression". */
  subtitle:
    "Cells are clustered in a graph of shared nearest neighbours and annotated by canonical markers. "
    + "Between conditions, cells from one sample are not independent replicates; summing them into one "
    + "pseudobulk profile per sample and testing across samples controls the false-positive rate.",
  layout: "side",
  status: "shipped",
  height: (params) => (params.page === "annotation" || !HEIGHTS[params.page] ? clustersHeight(params) : HEIGHTS[params.page]),

  /* ORDER MATTERS: an option list that follows other parameters reads them
     resolved, so the seed and the resolution come before the lists that read
     them (core params.js) — the seed sat last until 2026-09-25, and every
     list was built for the default seed */
  params: {
    page: { role: "page", type: "segmented", style: "grid", label: "Analysis", options: PAGES, default: "clustering", display: true },

    dataSec: { type: "section", label: "The data" },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    res: {
      type: "choice", label: "Resolution",
      detail: "the resolution parameter of FindClusters: the weight of the expected-edges term in the modularity",
      options: RESOLUTIONS.map((v) => ({ value: v, label: v })), default: "0.3", when: CELL_PAGES,
    },

    graphRes: {
      type: "choice", label: "Resolution",
      detail: "FindClusters resolution: the weight of the expected-edges term in modularity; here on the 45-cell graph",
      options: GRAPH_RES.map((v) => ({ value: v, label: v })), default: "1", display: true, when: ON("clustering"),
    },
    twoSec: { type: "section", label: "The comparison", when: ON("markers") },
    comparator: {
      type: "segmented", style: "grid", label: "Comparator",
      detail: "ident.1 of FindMarkers: the cluster tested for markers; clusters are numbered by size, 0 the largest",
      options: (v) => clusterOptions(v), optionsFrom: ["seed", "res"],
      default: "0", when: ON("markers"),
    },
    baseline: {
      type: "segmented", style: "grid", label: "Baseline",
      detail: "ident.2 of FindMarkers: the reference group, either one cluster or all other cells",
      options: (v) => [{ value: "rest", label: "All other cells", span: true }, ...clusterOptions(v).filter((o) => o.value !== String(v.comparator))],
      optionsFrom: ["seed", "res", "comparator"],
      default: "rest", when: ON("markers"),
    },
    tlSec: { type: "section", label: "The comparison", when: ON("differential-expression") },
    within: {
      type: "segmented", style: "grid", label: "Cluster",
      detail: `the cluster whose cells are compared between tumour and liver samples; clusters with fewer than ${MIN_PER_SAMPLE} cells in any sample are not testable`,
      options: (v) => testableOptions(v), optionsFrom: ["seed", "res"],
      default: "", when: ON("differential-expression"),
    },
    gene: {
      type: "select", label: "Gene",
      detail: "the gene shown in both expression panels; also selected from the volcano plots, the gene lists and the Venn diagram",
      options: GENE_OPTIONS, default: "unchanged", when: ON("differential-expression"),
    },
    tlSampSec: { type: "section", label: "The samples", when: ON("differential-expression") },
    change: {
      type: "choice", label: "True log2 fold change",
      detail: "the simulated effect: 20 DE genes per cell type, a different set in each, half up and half down in tumour samples; all other genes are non-DE",
      options: CHANGES.map((v) => ({ value: v, label: v })), default: "0", when: ON("differential-expression"),
    },
    sampleSd: {
      /* VARIATION, NOT AN EFFECT (his round: "isn't it variance? I confuse it
         as the true effect"): every sample draws its own shift for every
         gene, and this is the SD of those shifts; True change is the one
         effect size on the page */
      type: "choice", label: "Variation between samples (SD)",
      detail: "SD of a sample-specific shift in each gene's log expression, from sample preparation (ambient RNA, dissociation, handling)",
      options: SAMPLE_SD.map((v) => ({ value: v, label: v })), default: "0", when: ON("differential-expression"),
    },
    patientSd: {
      type: "choice", label: "Variation between patients (SD)",
      detail: "SD of a patient-specific shift in each gene's log expression, shared by that patient's liver and tumour samples",
      options: PATIENT_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("differential-expression"),
    },

    compSec: { type: "section", label: "The samples", when: ON("differential-abundance") },
    compSd: {
      type: "choice", label: "Variation between samples (SD)",
      detail: "SD of a sample-specific shift in each cell type's log proportion, about its tissue's mean",
      options: COMP_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("differential-abundance"),
    },
    /* a finished figure for a lesson: the Graph page opened at stage N (0–5) */
    shown: { type: "int", min: 0, max: 5, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const types = TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: t.name, mark: params.page === "differential-abundance" ? "bar" : "dot" }));
    if (params.page === "clustering") return [
      { token: `cluster-${"abcdef"[TYPE_SLOT[0]]}`, label: "Hepatocyte", mark: "dot" },
      { token: `cluster-${"abcdef"[TYPE_SLOT[1]]}`, label: "Tumour cell", mark: "dot" },
      { token: "ink-2", label: "Edge (width: Jaccard weight)", mark: "line" },
      { token: "extreme", label: "Pruned edge (Jaccard < 1/15)", mark: "dash" },
      { token: "ink-1", label: "Dashed outline: community", mark: "dash" },
      { token: "ink-1", label: "Circle: a community as one node", mark: "ring" },
    ];
    if (params.page === "annotation") return [...types, { token: "magnitude", label: "Dot plot: size, fraction of cells expressing the gene; shade, mean expression", mark: "dot" }];
    /* Tumour vs liver draws its key on the canvas, between the gene views
       and the Venn it does not key (his round: "move these legends above the
       venn diagram closer to volcano and gene views"); drawKey */
    if (params.page === "differential-expression") return [];
    return types;
  },

  compute: ({ params }) => {
    const cl = clustersFor(params.seed, params.res);
    const out = {
      stage: stageFor(params.seed, params.sampleSd, params.patientSd, params.change),
      embed: embedFor(params.seed), cl,
      mk: markersFor(params, cl),
      cond: conditionFor(params, cl),
      graph: graphFor(params.seed),
      gstages: graphStagesFor(params.seed, params.graphRes),
      gene: null,
      comp: compositionFor(params.seed, params.compSd),
    };
    out.gene = geneView(params, out.cond, out.stage);
    return out;
  },

  /* THE GRAPH PAGE'S PRESSES: six stages, each a tween (his pick). Nothing to
     drive on the other pages; leaving mid-press settles the tween, so the
     page is not left half-drawn when it comes back (principle: mid-press
     page switch). The resolution is a display parameter: a new one re-runs
     Louvain and keeps the stage. */
  animation: {
    stepLabel: { anim: "labelAt", labels: { g0: "Build kNN graph", g1: "Build SNN graph", g2: "Optimise modularity", g3: "Aggregate communities", g4: "Optimise again", done: "Step" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      g0: "Connect each cell to its k nearest neighbours in principal-component space",
      g1: "Weight each edge by the Jaccard index of the two neighbour sets, and prune edges below 1/15",
      g2: "Local moving: reassign each node to the neighbouring community with the largest modularity gain",
      g3: "Collapse each community into one node, summing the edge weights",
      g4: "Optimise modularity on the aggregated graph",
      done: "All stages shown; Reset returns to the cells",
    }, default: "Step" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const stage = !fromScratch ? Math.max(0, Math.min(5, Number(params.shown) || 0)) : 0;
      return { stage, t: 1, moving: false, done: stage >= 5, labelAt: stage >= 5 ? "done" : `g${stage}`, inert: params.page !== "clustering" };
    },
    advance: (anim, { dt }) => {
      if (anim.inert) return false;
      if (!anim.moving) {
        if (anim.stage >= 5) { anim.done = true; return false; }
        anim.stage += 1; anim.t = 0; anim.moving = true;
      }
      anim.t = Math.min(1, anim.t + dt / GRAPH_TWEEN_MS);
      if (anim.t >= 1) { anim.moving = false; anim.done = anim.stage >= 5; anim.labelAt = anim.done ? "done" : `g${anim.stage}`; return false; }
      return true;
    },
    rebuild: (anim, { params }) => {
      anim.inert = params.page !== "clustering";
      if (anim.inert && anim.moving) { anim.t = 1; anim.moving = false; anim.done = anim.stage >= 5; anim.labelAt = anim.done ? "done" : `g${anim.stage}`; }
    },
  },

  regions: ({ w, params, state }) => {
    /* core probes the table at load, before compute has run */
    if (!state) return [];
    if (params.page === "markers") {
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
    if (params.page === "differential-expression") {
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
  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    if (params.page === "clustering") drawGraph(ctx, colors, w, params, state, anim);
    else if (params.page === "annotation") drawClusters(ctx, colors, w, params, state, pointer);
    else if (params.page === "markers") drawTwo(ctx, colors, w, params, state, pointer);
    else if (params.page === "differential-expression") drawTumourLiver(ctx, colors, w, params, state);
    else drawComposition(ctx, colors, w, params, state);
  },

  readout: ({ params, state, anim }) => {
    const cl = state.cl;
    if (params.page === "clustering") {
      const s = anim?.stage ?? 0, St = state.gstages, kept = state.graph.pairs.filter((q) => q.jac >= 1 / 15).length;
      return [
        { label: "Edges", value: s >= 2 ? String(kept) : s >= 1 ? String(45 * GRAPH_K) : "–", note: s >= 2 ? "SNN graph, pruned at Jaccard < 1/15" : s >= 1 ? `kNN graph, k = ${GRAPH_K}` : "graph not built" },
        { label: "Communities", value: s >= 5 ? String(new Set(St.final).size) : s >= 3 ? String(new Set(St.first).size) : "–", note: s >= 5 ? `after pass 2; Q = ${St.q2.toFixed(3)}` : s >= 3 ? `after pass 1; Q = ${St.q1.toFixed(3)}` : `resolution ${params.graphRes}` },
      ];
    }
    if (params.page === "annotation") {
      const byType = TYPES.map((t, ti) => cl.ann.filter((a) => a.type === ti).length);
      const split = TYPES.filter((_, ti) => byType[ti] > 1).map((t) => t.name);
      return [
        { label: "Clusters found", value: String(cl.k), note: `6 simulated cell types; modularity ${fmt(cl.q, 3)}, best of 10 random starts` },
        { label: "Cell types split across clusters", value: String(split.length), note: split.length ? `${split.join(", ")}: its clusters share the same canonical markers` : "one cluster per cell type" },
      ];
    }
    if (params.page === "markers") {
      const mk = state.mk, fm = mk.fm;
      const up = fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05);
      return [
        { label: `Genes upregulated in cluster ${mk.tested}, p_val_adj < 0.05`, value: String(up.length), note: `${fm.n1} cells vs ${fm.n2} (${mk.vsRest ? "all other cells" : `cluster ${mk.otherC}`})` },
        { label: "Of those, with pct.2 > 0.5", value: String(broadOf(mk).length), note: "significant, but not specific to the cluster" },
      ];
    }
    if (params.page === "differential-abundance") {
      const T = state.comp.types;
      const names = (k) => T.filter((r) => r[k] < 0.05).map((r) => TYPES[r.ti].name).join(", ") || "none";
      return [
        { label: "Proportions differing, cell-level χ² test", value: String(T.filter((r) => r.pCells < 0.05).length), note: `p < 0.05: ${names("pCells")}` },
        { label: "Proportions differing, sample-level t-test", value: String(T.filter((r) => r.pSamples < 0.05).length), note: `p < 0.05: ${names("pSamples")}` },
      ];
    }
    const C = state.cond;
    if (!C.testable) return [{ label: "Cluster", value: String(C.within), note: "not testable: fewer than 5 cells in at least one sample" }];
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
      const found = { label: `${name}: true positives`, value: `${t} of 20`, note: `sensitivity ${Math.round((100 * t) / 20)}%: DE genes of the cluster's cell type significant at ${cut} < 0.05` };
      const falseCalls = { label: `${name}: false positives`, value: n ? `${f} of ${n} significant` : "none significant", note: `${n ? `false discovery proportion ${Math.round((100 * f) / n)}%; ` : ""}${promise}` };
      return truth ? [found, falseCalls] : [falseCalls];
    };
    return [
      ...tiles(C.volC, "Cell-level", "p_val_adj", "Bonferroni controls the family-wise error rate at 5%"),
      ...tiles(C.volD, "Pseudobulk", "padj", "Benjamini–Hochberg controls the false discovery rate at 5%"),
    ];
  },
});
