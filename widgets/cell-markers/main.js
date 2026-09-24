/* cell-markers — slot 81, "Single-Cell RNA-seq: Clusters and Markers". DRAFT.
 *
 * Planned 2026-09-24 (catalogue § Slot 81): every method rewritten as
 * published before a number was read (`engine.js`; the arc's stand-ins were
 * wrong the way slot 80's were), measured in `_lab/cell-markers-measure.mjs`
 * and on the lesson's own cells in `_lab/cell-markers-real.mjs`, mocked in
 * `_lab/cell-markers-mock.html`, eight picks:
 *
 *   Clusters   — a UMAP computed on the page (his pick; `umap.js`, verified
 *                against umap-learn 0.5.12), a resolution control, and a
 *                zonation on/off: on, 0.8 splits the hepatocytes along the
 *                lobule; off, the same resolution splits them where nothing
 *                differs — the page's failing case.
 *   Markers    — significant is not specific: a dot plot (size the share
 *                detecting, shade the mean) and FindMarkers' table, the genes
 *                that pass p_val_adj < 0.05 and are detected in most other
 *                cells set apart. The arc's "p ranks markers wrongly" was
 *                struck by the measurement and is not claimed.
 *   Conditions — Kupffer cells, tumour against liver, NO condition effect:
 *                a Wilcoxon over cells against DESeq2 on the four samples'
 *                summed counts (his pick; widget 78's engine, ~ tissue, 2
 *                against 2), under a sample effect and a patient effect
 *                (his pick: both). The patient effect is shared by both of
 *                a patient's samples and cancels in tumour against liver;
 *                the readout says so rather than leave the reader waiting.
 *
 * compute() does the heavy steps once per input and keeps them in module
 * caches keyed by exactly the parameters they read, so a resolution change
 * reclusters without redrawing the UMAP and a Conditions change touches only
 * Conditions. The output depends on the parameters alone, as compute must.
 */
import { defineWidget, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";
import { analyse } from "../deseq2/engine.js";
import { simulate, simulateType, normalise, pcaScaled, knn, snn, findClusters, findMarkers, geneKind, geneName, isConditionGene, TYPES, SAMPLES, G, G_MARK, G_ZONE } from "./engine.js";
import { umapSgd } from "./umap.js";

const PAGES = [
  { value: "clusters", label: "Clusters" },
  { value: "markers", label: "Markers" },
  { value: "conditions", label: "Conditions" },
  { value: "composition", label: "Composition" },
];
const ON = (page) => ({ param: "page", equals: page });
const CELLS_PAGES = { param: "page", oneOf: ["clusters", "markers"] };
const HEIGHTS = { clusters: 580, markers: 890, conditions: 520, composition: 380 };
const RESOLUTIONS = ["0.1", "0.3", "0.5", "0.8", "1.2", "2"];
const SAMPLE_SD = ["0", "0.1", "0.2", "0.4", "0.65"];
const PATIENT_SD = ["0", "0.3", "0.65"];
const CHANGES = ["0", "0.5", "1", "2"];
const COMP_SD = ["0", "0.3", "0.6"];
const COMP_CELLS = 400;
const CELLS_PER_SAMPLE = 250, KUPFFER_PER_SAMPLE = 120, MAX_ROWS = 12;
/* which --c-cluster-* slot each type wears, as widget 80: hepatocyte a (blue), tumour c (red), … */
const TYPE_SLOT = [0, 2, 1, 3, 4, 5];
const pct = (v) => `${Math.round(100 * v)}%`;
const LOG05 = Math.log10(0.05);

/* ------------------------------------------------------------ the caches */
const cache = { stage: new Map(), clusters: new Map(), cond: new Map() };
const remember = (map, key, make) => { if (!map.has(key)) { if (map.size > 8) map.delete(map.keys().next().value); map.set(key, make()); } return map.get(key); };

function stageFor(seed, zonation) {
  return remember(cache.stage, `${seed}|${zonation}`, () => {
    const rng = makeRng(seed);
    const cells = simulate(makeRng(Math.floor(rng.next() * 2 ** 31)), { cells: CELLS_PER_SAMPLE, patientSd: 0, zonation: zonation === "on" ? 3 : 0, interaction: 1 });
    /* `interaction`: 10 genes raised in patient 1's hepatocytes only, which a
       pooled test lists and a conserved one does not (compare-measure C4) */
    const Y = normalise(cells);
    const P = pcaScaled(Y, 20, makeRng(Math.floor(rng.next() * 2 ** 31)));
    const adj = snn(knn(P, 20));
    const { Y: U } = umapSgd(P, { nEpochs: 200, rng: makeRng(Math.floor(rng.next() * 2 ** 31)) });
    return { cells, Y, adj, U, clusterRng: Math.floor(rng.next() * 2 ** 31) };
  });
}

/** The clusters at a resolution, annotated by the type most of their cells
    are, with every cluster's FindMarkers against all other cells. */
function clustersFor(seed, zonation, res) {
  return remember(cache.clusters, `${seed}|${zonation}|${res}`, () => {
    const S = stageFor(seed, zonation);
    const r = findClusters(S.adj, Number(res), makeRng(S.clusterRng));
    const k = r.k;
    const ann = Array.from({ length: k }, (_, c) => {
      const idx = []; r.clusters.forEach((v, i) => { if (v === c) idx.push(i); });
      const counts = new Array(TYPES.length).fill(0); idx.forEach((i) => { counts[S.cells[i].type] += 1; });
      const type = counts.indexOf(Math.max(...counts));
      const zs = idx.filter((i) => S.cells[i].type === 0).map((i) => S.cells[i].z);
      return { c, idx, n: idx.length, type, share: counts[type] / idx.length, zMean: zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : null, zs };
    });
    /* a type's clusters take its hue, lighter to darker in lobule order */
    ann.forEach((a) => {
      const sib = ann.filter((q) => q.type === a.type).sort((p, q) => (p.zMean ?? 0) - (q.zMean ?? 0) || p.c - q.c);
      const j = sib.indexOf(a);
      a.alpha = sib.length === 1 ? 0.9 : 0.4 + 0.55 * (j / (sib.length - 1));
    });
    return { clusters: r.clusters, q: r.q, k, ann };
  });
}

/** FindMarkers for the comparison on screen only: the tested cluster against
    all other cells or against one cluster, and the same test within each
    patient, for conserved markers (FindConservedMarkers: up in both, each at
    p_val_adj < 0.05). */
const cache2 = new Map();
function markersFor(params, cl) {
  const k = cl.k, tested = Math.min(Number(params.cluster), k - 1);   // the list holds only clusters that exist; the min guards a URL typed by hand
  /* the comparison is ONE parameter, "rest" or a cluster's number, so a click
     on the map sets it the way the dropdown does (a region sets one parameter) */
  const vsRest = params.against === "rest";
  let otherC = vsRest ? 0 : Math.min(Number(params.against), k - 1);
  if (!vsRest && otherC === tested) otherC = tested === 0 ? Math.min(1, k - 1) : 0;
  return remember(cache2, `${params.seed}|${params.zonation}|${params.res}|${tested}|${vsRest ? "rest" : otherC}`, () => {
    const S = stageFor(params.seed, params.zonation);
    const inA = (i) => cl.clusters[i] === tested, inB = vsRest ? (i) => cl.clusters[i] !== tested : (i) => cl.clusters[i] === otherC;
    const fm = findMarkers(S.Y, inA, inB, { nGenes: 33538 });
    const per = [1, 2].map((pt) => new Map(findMarkers(S.Y, (i) => S.cells[i].patient === pt && inA(i), (i) => S.cells[i].patient === pt && inB(i), { nGenes: 33538, logfc: 0, minPct: 0 }).res.map((x) => [x.g, x])));
    const conserved = new Set(fm.res.filter((x) => { const a = per[0].get(x.g), b = per[1].get(x.g); return x.lfc > 0 && a && b && a.lfc > 0 && b.lfc > 0 && Math.max(a.lpAdj, b.lpAdj) < LOG05; }).map((x) => x.g));
    return { fm, tested, otherC, vsRest, conserved, per };
  });
}

/* Kupffer cells only, tumour against liver, no condition effect: both tests
   on the same cells, and the null gene with the smallest p over cells as the
   one drawn cell by cell */
function conditionsFor(seed, sampleSd, patientSd, change) {
  return remember(cache.cond, `${seed}|${sampleSd}|${patientSd}|${change}`, () => {
    const cells = simulateType(makeRng(seed * 7919 + 17), "kupffer", { perSample: KUPFFER_PER_SAMPLE, patientSd: Number(patientSd), sampleSd: Number(sampleSd), condition: Number(change) });
    const Y = normalise(cells);
    const fm = findMarkers(Y, (i) => cells[i].tissue === "tumour", (i) => cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    /* the unchanged genes: the spread genes the true change does not touch */
    const isNull = (g) => geneKind(g).kind === "spread" && !(Number(change) > 0 && isConditionGene(g));
    const cellsP = fm.res.filter((x) => isNull(x.g)).map((x) => ({ g: x.g, p: 10 ** x.lp, lp: x.lp, lpAdj: x.lpAdj }));
    const volC = fm.res.map((x) => ({ g: x.g, lfc: x.lfc, nl: -x.lp, call: x.lpAdj < LOG05, truth: Number(change) > 0 && isConditionGene(x.g) }));
    const order = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
    const counts = Array.from({ length: G }, (_, g) => order.map((sk) => cells.reduce((s, c) => s + (c.sample === sk ? c.x[g] : 0), 0)));
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    const pbP = an.expressed.filter(isNull).map((g) => ({ g, p: an.resMAP[g].p, padj: an.resMAP[g].padj }));
    const volD = an.expressed.map((g) => ({ g, lfc: an.resMAP[g].lfc, nl: -Math.log10(Math.max(1e-300, an.resMAP[g].p)), call: an.resMAP[g].padj < 0.05, truth: Number(change) > 0 && isConditionGene(g) }));
    const ex = cellsP.slice().sort((a, b) => a.lp - b.lp)[0];
    const exVals = order.map((sk) => cells.map((c, i) => (c.sample === sk ? Y[i][ex.g] : null)).filter((v) => v !== null));
    return { n: cells.length, cellsP, pbP, ex, exVals, order, volC, volD };
  });
}

/* each sample's share of each type, and a test per type of liver against
   tumour over CELLS (the pooled 2x2 counts, a chi-square) and over SAMPLES
   (the four shares, arcsine square root, a t-test on 2 against 2 — the logit
   failed on tumour cells, 1% to 50%, in 8 of 8 seeds: compare-measure C3) */
const cache3 = new Map();
function compositionFor(seed, compSd) {
  return remember(cache3, `${seed}|${compSd}`, () => {
    const cells = simulate(makeRng(seed * 104729 + 7), { cells: COMP_CELLS, patientSd: 0, compSd: Number(compSd) });
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

/** The clusters at the current seed, zonation and resolution, as options:
    "Cluster 0 · Hepatocyte". The first 12 are offered, as the dot plot rows. */
function clusterOptions(v) {
  const cl = clustersFor(v.seed, v.zonation, v.res);
  return cl.ann.slice(0, MAX_ROWS).map((a) => ({ value: String(a.c), label: `Cluster ${a.c} · ${TYPES[a.type].name}` }));
}

/* ------------------------------------------------------------ geometry (5.8) */
const TOP = 26;
function clustersLayout(w) {
  const S = Math.min(340, Math.floor((w - 24) / 2));
  const x0 = Math.floor((w - (2 * S + 24)) / 2);
  /* under the maps: the hepatocytes magnified (a square of MAG), and beside it
     the strip of their places along the lobule */
  const stripTop = TOP + S + 44, MAG = Math.min(150, HEIGHTS.clusters - stripTop - 12);
  return { S, panels: [{ x: x0, y: TOP }, { x: x0 + S + 24, y: TOP }], stripTop, mag: { x: x0, y: stripTop, S: MAG } };
}
function umapView(U) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of U) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const half = (Math.max(x1 - x0, y1 - y0) / 2) * 1.06, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return (p, P, S) => [P.x + S / 2 + ((p[0] - mx) / half) * (S / 2 - 6), P.y + S / 2 - ((p[1] - my) / half) * (S / 2 - 6)];
}
function markersLayout(w) {
  const labelW = 118, top = TOP + 58, rowH = 22;
  /* the column heads lean up and to the right, so the last needs room past its dot */
  const mapTop = top + MAX_ROWS * rowH + 34, MAP = 210;
  return { labelW, top, rowH, mapTop, map: { x: 8, y: mapTop, S: MAP }, chipX: 8 + MAP + 28, tableTop: mapTop + MAP + 46, x0: labelW, x1: w - 56 };
}
/* the chips beside the map: which side a click picks, and "All other cells" */
function markerChips(L) {
  const x = L.chipX, y = L.mapTop + 30;
  return [
    { key: "tested", x, y, w: 150, h: 26, label: "The cluster tested", set: { pick: "tested" } },
    { key: "against", x: x + 158, y, w: 150, h: 26, label: "The comparison", set: { pick: "against" } },
    { key: "rest", x, y: y + 64, w: 150, h: 26, label: "All other cells", set: { against: "rest" } },
  ];
}
/* the map's view: the Clusters page's UMAP in a square */
function mapView(U, M) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of U) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const half = (Math.max(x1 - x0, y1 - y0) / 2) * 1.06, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return (p) => [M.x + M.S / 2 + ((p[0] - mx) / half) * (M.S / 2 - 6), M.y + M.S / 2 - ((p[1] - my) / half) * (M.S / 2 - 6)];
}
/* the map tiled into TILE-pixel squares, each the cluster of the nearest cell
   within reach, so a click on a cluster's cells picks it and empty space picks
   nothing (core's hit test takes rectangles) */
const TILE = 8;
function mapTiles(state, L) {
  const at = mapView(state.stage.U, L.map), pts = state.stage.U.map(at), cl = state.cl.clusters, M = L.map, out = [];
  for (let ty = M.y; ty < M.y + M.S; ty += TILE) for (let tx = M.x; tx < M.x + M.S; tx += TILE) {
    const cx = tx + TILE / 2, cy = ty + TILE / 2;
    let best = -1, bd = (2 * TILE) ** 2;
    for (let i = 0; i < pts.length; i += 1) { const d = (pts[i][0] - cx) ** 2 + (pts[i][1] - cy) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best >= 0) out.push({ x: tx, y: ty, w: TILE, h: TILE, c: cl[best] });
  }
  return out;
}
function dotGenes(mk) {
  /* three markers of each type, two portal and two central zonation genes,
     one common gene, and the tested cluster's three most significant genes
     among those detected in most other cells */
  const genes = [];
  TYPES.forEach((_, t) => { for (let j = 0; j < 3; j += 1) genes.push(t * G_MARK + j); });
  [0, 1].forEach((j) => genes.push(G - G_ZONE + j));
  [0, 1].forEach((j) => genes.push(G - G_ZONE / 2 + j));
  genes.push(TYPES.length * G_MARK);
  broadOf(mk).slice(0, 3).forEach((x) => { if (!genes.includes(x.g)) genes.push(x.g); });
  return genes;
}
const isOwn = (g, type) => { const k = geneKind(g); return (k.kind === "marker" && k.type === type) || (type === 0 && k.kind === "zone"); };
/* significant, up, and detected in more than half of the other cells */
function broadOf(mk) {
  return mk.fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05 && x.p2 > 0.5 && !isOwn(x.g, mk.type)).sort((a, b) => a.lp - b.lp);
}
const pFmt = (lp) => (lp < -300 ? "0" : lp > -2 ? (10 ** lp).toFixed(3) : `1e${Math.round(lp)}`);

/* ------------------------------------------------------------ drawing */
function drawClusters(ctx, colors, w, params, state) {
  const { S, panels, stripTop } = clustersLayout(w);
  const st = state.stage, cl = state.cl, view = umapView(st.U);
  const heads = [`Coloured by cluster, resolution ${params.res}: ${cl.k} clusters`, "Coloured by cell type"];
  panels.forEach((P, r) => {
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(heads[r], P.x, P.y - 9);
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(P.x + 0.5, P.y + 0.5, S - 1, S - 1);
    st.cells.forEach((c, i) => {
      const q = view(st.U[i], P, S);
      if (r === 0) { const a = cl.ann[cl.clusters[i]]; ctx.fillStyle = colors.clusters[TYPE_SLOT[a.type]]; ctx.globalAlpha = a.alpha; }
      else { ctx.fillStyle = colors.clusters[TYPE_SLOT[c.type]]; ctx.globalAlpha = 0.85; }
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (r === 0) {
      ctx.font = `600 ${colors.fsSm} ${colors.mono}`;
      cl.ann.forEach((a) => {
        const cx = a.idx.reduce((s, i) => s + st.U[i][0], 0) / a.n, cy = a.idx.reduce((s, i) => s + st.U[i][1], 0) / a.n;
        const q = view([cx, cy], P, S);
        ctx.fillStyle = colors.surface; ctx.globalAlpha = 0.8; ctx.fillRect(q[0] - 9, q[1] - 8, 18, 16); ctx.globalAlpha = 1;
        ctx.fillStyle = colors.ink1; ctx.fillText(String(a.c), q[0], q[1] + 1);
      });
    } else {
      ctx.font = `${colors.fsXs} ${colors.font}`;
      TYPES.forEach((t, ti) => {
        const idx = st.cells.map((c, i) => (c.type === ti ? i : -1)).filter((i) => i >= 0);
        if (!idx.length) return;
        const cx = idx.reduce((s, i) => s + st.U[i][0], 0) / idx.length, cy = idx.reduce((s, i) => s + st.U[i][1], 0) / idx.length;
        const q = view([cx, cy], P, S);
        const tw = ctx.measureText(t.name).width;
        ctx.fillStyle = colors.surface; ctx.globalAlpha = 0.8; ctx.fillRect(q[0] - tw / 2 - 3, q[1] - 8, tw + 6, 16); ctx.globalAlpha = 1;
        ctx.fillStyle = colors.ink1; ctx.fillText(t.name, q[0], q[1] + 1);
      });
    }
    ctx.textBaseline = "alphabetic";
  });
  /* the hepatocytes magnified: the same map, the square around their cells
     enlarged, so a split among them can be seen at all — UMAP puts six
     separated types far apart and a type's cells in a small region, which
     is the method, not a setting (measured: the hepatocytes span 16–20% of
     the map at umap-learn's and at Seurat's defaults) */
  const { mag } = clustersLayout(w);
  const hepIdx = st.cells.map((c, i) => (c.type === 0 ? i : -1)).filter((i) => i >= 0);
  if (hepIdx.length) {
    let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity;
    hepIdx.forEach((i) => { const [x, y] = st.U[i]; hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y); });
    const half = (Math.max(hx1 - hx0, hy1 - hy0) / 2) * 1.1, mx = (hx0 + hx1) / 2, my = (hy0 + hy1) / 2;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
    ctx.fillText("The hepatocytes, magnified", mag.x, mag.y - 12);
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(mag.x + 0.5, mag.y + 0.5, mag.S - 1, mag.S - 1);
    hepIdx.forEach((i) => {
      const a = cl.ann[cl.clusters[i]];
      ctx.fillStyle = colors.clusters[TYPE_SLOT[a.type]]; ctx.globalAlpha = a.alpha;
      const px = mag.x + mag.S / 2 + ((st.U[i][0] - mx) / half) * (mag.S / 2 - 4), py = mag.y + mag.S / 2 - ((st.U[i][1] - my) / half) * (mag.S / 2 - 4);
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  /* the strip: where along the lobule each hepatocyte cluster's cells lie */
  const hep = cl.ann.filter((a) => a.type === 0).sort((a, b) => (a.zMean ?? 0) - (b.zMean ?? 0));
  const x0 = mag.x + mag.S + 90, x1 = panels[1].x + S - 10, rowH = Math.min(26, Math.floor((HEIGHTS.clusters - stripTop - 44) / Math.max(1, hep.length)));
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText("Their place along the lobule, by cluster", mag.x + mag.S + 24, stripTop - 12);
  hep.forEach((a, j) => {
    const y = stripTop + j * rowH + rowH / 2;
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "right";
    ctx.fillText(`cluster ${a.c}`, x0 - 10, y + 4);
    ctx.fillStyle = colors.clusters[TYPE_SLOT[0]]; ctx.globalAlpha = a.alpha;
    a.zs.forEach((z, k) => { const jit = (((k * 7919) % 97) / 97 - 0.5) * (rowH - 8); ctx.beginPath(); ctx.arc(x0 + z * (x1 - x0), y + jit, 1.8, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
    const mx = x0 + a.zMean * (x1 - x0); ctx.beginPath(); ctx.moveTo(mx, y - rowH / 2 + 2); ctx.lineTo(mx, y + rowH / 2 - 2); ctx.stroke();
  });
  const yAx = stripTop + hep.length * rowH + 6;
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, yAx + 0.5); ctx.lineTo(x1, yAx + 0.5); ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left"; ctx.fillText("portal", x0, yAx + 16);
  ctx.textAlign = "right"; ctx.fillText("central", x1, yAx + 16);
  ctx.textAlign = "left"; ctx.fillText(params.zonation === "on" ? "each dot a hepatocyte; the bar, the cluster's mean" : "zonation off: the hepatocytes do not differ along the lobule", x0, yAx + 34);
  ctx.textAlign = "left";
}

function drawMarkers(ctx, colors, w, params, state) {
  const cl = state.cl, st = state.stage, L = markersLayout(w), mk = state.mk;
  const tested = mk.tested;
  const genes = dotGenes(mk);
  const cw = Math.min(28, (L.x1 - L.x0) / genes.length);
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText("Each cluster and gene: the share of the cluster's cells detecting it, and its mean", 8, TOP - 9);
  /* column heads, rotated */
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  genes.forEach((g, j) => {
    ctx.save(); ctx.translate(L.x0 + j * cw + cw / 2 - 3, L.top - 12); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = geneKind(g).kind === "marker" || geneKind(g).kind === "zone" ? colors.ink1 : colors.ink3; ctx.fillText(geneName(g), 0, 0); ctx.restore();
  });
  const rows = cl.ann.slice(0, MAX_ROWS);
  const stats = rows.map((a) => genes.map((g) => { let det = 0, s = 0; a.idx.forEach((i) => { const v = st.Y[i][g]; if (v > 0) det += 1; s += v; }); return { pct: det / a.n, mean: s / a.n }; }));
  const maxMean = genes.map((_, j) => Math.max(...stats.map((r) => r[j].mean)) || 1);
  rows.forEach((a, ri) => {
    const y = L.top + ri * L.rowH + L.rowH / 2;
    if (a.c === tested) { ctx.fillStyle = colors.surface2; ctx.fillRect(4, y - L.rowH / 2, L.x1 - 4, L.rowH); }
    if (!mk.vsRest && a.c === mk.otherC) { ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(4.5, y - L.rowH / 2 + 0.5, L.x1 - 5, L.rowH - 1); ctx.setLineDash([]); }
    ctx.font = `${a.c === tested ? "600 " : ""}${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "right";
    ctx.fillText(`${a.c} · ${TYPES[a.type].name}`, L.x0 - 8, y + 4);
    genes.forEach((g, j) => {
      const s = stats[ri][j];
      ctx.fillStyle = colors.magnitude; ctx.globalAlpha = 0.15 + 0.85 * (s.mean / maxMean[j]);
      ctx.beginPath(); ctx.arc(L.x0 + j * cw + cw / 2, y, 1.5 + 8 * Math.sqrt(s.pct), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  });
  /* the map: the tested cluster in its hue, the comparison in its hue with
     an outlined number, every other cell faint (in its hue when the
     comparison is all other cells) */
  const M = L.map, at = mapView(st.U, M);
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText("Click a cluster on the map", M.x, M.y - 10);
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(M.x + 0.5, M.y + 0.5, M.S - 1, M.S - 1);
  st.cells.forEach((c, i) => {
    const k = cl.clusters[i], a = cl.ann[k], q = at(st.U[i]);
    const on = k === tested || (!mk.vsRest && k === mk.otherC);
    ctx.fillStyle = on || mk.vsRest ? colors.clusters[TYPE_SLOT[a.type]] : colors.ink3;
    ctx.globalAlpha = on ? 0.95 : mk.vsRest ? 0.3 : 0.18;
    ctx.beginPath(); ctx.arc(q[0], q[1], 1.9, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `600 ${colors.fsXs} ${colors.mono}`;
  cl.ann.forEach((a) => {
    const q = at([a.idx.reduce((s2, i) => s2 + st.U[i][0], 0) / a.n, a.idx.reduce((s2, i) => s2 + st.U[i][1], 0) / a.n]);
    const isT = a.c === tested, isO = !mk.vsRest && a.c === mk.otherC;
    ctx.fillStyle = isT ? colors.ink1 : colors.surface; ctx.globalAlpha = isT || isO ? 1 : 0.8; ctx.fillRect(q[0] - 8, q[1] - 7, 16, 14);
    ctx.globalAlpha = 1;
    if (isO) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.strokeRect(q[0] - 8, q[1] - 7, 16, 14); }
    ctx.fillStyle = isT ? colors.surface : colors.ink1; ctx.fillText(String(a.c), q[0], q[1] + 1);
  });
  ctx.textBaseline = "alphabetic";
  /* the chips */
  const chips = markerChips(L);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
  ctx.fillText("A click picks", L.chipX, chips[0].y - 8);
  ctx.fillText("Or compare against", L.chipX, chips[2].y - 8);
  chips.forEach((ch) => {
    const active = ch.key === "rest" ? mk.vsRest : params.pick === ch.key;
    ctx.fillStyle = active ? colors.ink1 : colors.surface2; ctx.fillRect(ch.x, ch.y, ch.w, ch.h);
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(ch.x + 0.5, ch.y + 0.5, ch.w - 1, ch.h - 1);
    ctx.fillStyle = active ? colors.surface : colors.ink2; ctx.textAlign = "center"; ctx.fillText(ch.label, ch.x + ch.w / 2, ch.y + ch.h / 2 + 4);
  });
  ctx.textAlign = "left"; ctx.fillStyle = colors.ink2; ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillText(`Tested: cluster ${tested} · ${TYPES[mk.type].name} (filled number)`, L.chipX, chips[2].y + 50);
  ctx.fillText(mk.vsRest ? "Against: all other cells" : `Against: cluster ${mk.otherC} · ${TYPES[cl.ann[mk.otherC].type].name} (outlined number)`, L.chipX, chips[2].y + 68);
  /* the table: FindMarkers for the comparison on screen; conserved markers
     list only the genes up in both patients, then the pooled ones that are not */
  const fm = mk.fm, own = (g) => isOwn(g, mk.type), cons = params.markers === "conserved";
  const up = fm.res.filter((x) => x.lfc > 0 && (!cons || mk.conserved.has(x.g))).sort((a, b) => a.lp - b.lp || b.lfc - a.lfc);
  const top = up.slice(0, 8);
  const extra = cons
    ? fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05 && !mk.conserved.has(x.g)).sort((a, b) => a.lp - b.lp).slice(0, 3)
    : broadOf(mk).filter((x) => !top.includes(x)).slice(0, 3);
  /* the table's columns in proportion to the width, the note last */
  const cx = (f) => Math.round(8 + f * (w - 16));
  const cols = [["gene", cx(0), "left"], ["p_val", cx(0.2), "right"], ["avg_log2FC", cx(0.34), "right"], ["pct.1", cx(0.43), "right"], ["pct.2", cx(0.52), "right"], ["p_val_adj", cx(0.64), "right"], ["", cx(0.67), "left"]];
  let y = L.tableTop;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText(`${cons ? "Conserved in both patients: " : "FindMarkers: "}cluster ${tested} against ${mk.vsRest ? `the other ${fm.n2} cells` : `cluster ${mk.otherC} (${fm.n2} cells)`}, first 8 by p`, 8, y - 10);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, y + 8); });
  y += 24;
  const row = (x, grey) => {
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = grey ? colors.ink3 : colors.ink1;
    const v = [geneName(x.g), pFmt(x.lp), x.lfc.toFixed(2), x.p1.toFixed(2), x.p2.toFixed(2), pFmt(x.lpAdj), ""];
    cols.forEach(([, cx, al], k) => { ctx.textAlign = al; ctx.fillText(v[k], cx, y); });
    ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillText(cons && !mk.conserved.has(x.g) ? `not in both patients: ${pFmt(mk.per[0].get(x.g)?.lpAdj ?? 0)} / ${pFmt(mk.per[1].get(x.g)?.lpAdj ?? 0)}` : own(x.g) ? "" : mk.vsRest ? "detected in most other cells" : `detected in most of cluster ${mk.otherC}`, cx(0.67), y);
    y += 18;
  };
  top.forEach((x) => row(x, !own(x.g)));
  if (extra.length) {
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
    ctx.fillText(cons ? "significant pooled, and not in both patients:" : "further down the same list, also p_val_adj < 0.05:", 8, y + 2); y += 20;
    extra.forEach((x) => row(x, true));
  }
  ctx.textAlign = "left";
}

function drawConditions(ctx, colors, w, params, state) {
  const C = state.cond;
  const PW = Math.floor((w - 64) / 2), xs = [24, 24 + PW + 40], top = TOP + 10, bh = 220;
  const sets = [[C.volC, `Over cells: ${C.n} cells (Wilcoxon)`], [C.volD, "Over samples: 4 summed (DESeq2)"]];
  sets.forEach(([pts, title], k) => {
    const X = xs[k], yMax = Math.max(5, ...pts.map((q) => Math.min(60, q.nl))) * 1.05, xr = 3.5;
    const sx = (v) => X + PW / 2 + (Math.max(-xr, Math.min(xr, v)) / xr) * (PW / 2), sy = (v) => top + bh - (Math.min(60, v) / yMax) * bh;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
    ctx.fillText(title, X, TOP - 9);
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
  /* one unchanged gene, cell by cell: the null gene with the smallest p over cells */
  const sTop = top + bh + 56, sH = HEIGHTS.conditions - sTop - 30, colW = (w - 140) / 4;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText(`${geneName(C.ex.g)}, unchanged, the smallest p over cells: every cell's value, by sample`, 24, sTop - 12);
  const all = C.exVals.flat(), vMax = Math.max(...all, 0.1);
  const names = ["Patient 1 · liver", "Patient 2 · liver", "Patient 1 · tumour", "Patient 2 · tumour"];
  C.exVals.forEach((vals, k) => {
    const cx = 110 + k * colW + colW / 2;
    /* neutral ink: each column is named by its sample under it, and blue is
       the volcanos' "called and truly changed" on the same page */
    ctx.fillStyle = colors.ink2; ctx.globalAlpha = 0.5;
    vals.forEach((v, i) => { const jit = (((i * 7919) % 101) / 101 - 0.5) * colW * 0.6; ctx.beginPath(); ctx.arc(cx + jit, sTop + sH - (v / vMax) * sH, 1.8, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length, my = sTop + sH - (m / vMax) * sH;
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - colW * 0.35, my); ctx.lineTo(cx + colW * 0.35, my); ctx.stroke();
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(names[k], cx, sTop + sH + 16);
  });
  ctx.save(); ctx.translate(40, sTop + sH / 2); ctx.rotate(-Math.PI / 2); ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "center"; ctx.fillText("log(1 + per 10,000)", 0, 0); ctx.restore();
  ctx.textAlign = "left";
}

function drawComposition(ctx, colors, w, params, state) {
  const P = state.comp, order = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"], names = [["Patient 1", "liver"], ["Patient 2", "liver"], ["Patient 1", "tumour"], ["Patient 2", "tumour"]];
  const barW = Math.min(64, Math.floor((w * 0.42 - 20) / 4) - 14), bh = HEIGHTS.composition - TOP - 50;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText(`Each sample's ${COMP_CELLS} cells, by type`, 8, TOP - 9);
  order.forEach((k, j) => {
    const x = 16 + j * (barW + 14); let y = TOP + bh;
    TYPES.forEach((_, t) => { const h = (P.n[k][t] / COMP_CELLS) * bh; ctx.fillStyle = colors.clusters[TYPE_SLOT[t]]; ctx.fillRect(x, y - h, barW, h); y -= h; });
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "center";
    ctx.fillText(names[j][0], x + barW / 2, TOP + bh + 14); ctx.fillText(names[j][1], x + barW / 2, TOP + bh + 28);
  });
  const X = Math.round(w * 0.45), cx = (f) => Math.round(X + f * (w - X - 8));
  const cols = [["type", cx(0), "left"], ["liver", cx(0.45), "right"], ["tumour", cx(0.6), "right"], ["p, cells", cx(0.8), "right"], ["p, samples", cx(1), "right"]];
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText("Each type's share, liver against tumour; bold, p < 0.05", X, TOP - 9);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, TOP + 12); });
  const f = (q) => (q < 1e-4 ? q.toExponential(0) : q.toFixed(3));
  P.types.forEach((r, j) => {
    const y = TOP + 40 + j * 26;
    ctx.fillStyle = colors.clusters[TYPE_SLOT[r.ti]]; ctx.fillRect(cx(0), y - 9, 10, 10);
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
    "Clusters are communities in a graph of shared nearest neighbours, and the resolution sets how many "
    + "are found; a cluster may follow a real gradient or divide cells that do not differ. A marker is "
    + "a gene detected in a cluster and rarely elsewhere, which a p-value over hundreds of cells does not "
    + "establish. Within one cell type across conditions, the samples, not the cells, are the replicates.",
  layout: "side",
  status: "draft",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.clusters,

  params: {
    page: { type: "segmented", label: "Page", options: PAGES, default: "clusters", display: true },

    dataSec: { type: "section", label: "The cells", when: CELLS_PAGES },
    zonation: {
      type: "segmented", label: "Hepatocyte zonation",
      detail: "whether hepatocytes differ along the liver lobule, from the portal to the central vein, in 30 genes",
      options: [{ value: "on", label: "On" }, { value: "off", label: "Off" }], default: "on", when: CELLS_PAGES,
    },
    res: {
      type: "choice", label: "Resolution",
      detail: "FindClusters' resolution: the weight on the expected number of links within a community",
      options: RESOLUTIONS.map((v) => ({ value: v, label: v })), default: "0.3", when: CELLS_PAGES,
    },
    markSec: { type: "section", label: "The comparison", when: ON("markers") },
    /* THE LISTS ARE THE CLUSTERS THAT EXIST (his round: "why are there 11
       clusters and 5 to compare?" — the controls were fixed at 0–11 while the
       resolution found 6, and a missing number was quietly swapped for the
       last). They are read from the same cached clustering the figure draws,
       so the list and the figure cannot disagree; a value the new list no
       longer holds returns to the default (core, `optionsFrom`). */
    cluster: {
      type: "select", label: "Cluster tested",
      detail: "numbered by size, 0 the largest; a click on the map or the dot plot picks one too",
      options: (v) => clusterOptions(v),
      optionsFrom: ["seed", "zonation", "res"],
      default: "0", when: ON("markers"),
    },
    against: {
      type: "select", label: "Compared against",
      detail: "all other cells, or one cluster; a click on the map picks one too",
      options: (v) => [{ value: "rest", label: "All other cells" }, ...clusterOptions(v).filter((o) => o.value !== String(v.cluster))],
      optionsFrom: ["seed", "zonation", "res", "cluster"],
      default: "rest", when: ON("markers"),
    },
    pick: {
      type: "segmented", label: "A click on the map picks",
      options: [{ value: "tested", label: "The cluster tested" }, { value: "against", label: "The comparison" }],
      default: "tested", display: true, when: ON("markers"),
    },
    markers: {
      type: "segmented", label: "Markers",
      detail: "pooled: one test over every cell; conserved: up in each patient tested separately, as FindConservedMarkers does",
      options: [{ value: "pooled", label: "Pooled" }, { value: "conserved", label: "Conserved in both patients" }], default: "pooled",
      when: ON("markers"),
    },

    condSec: { type: "section", label: "The samples", when: ON("conditions") },
    change: {
      type: "choice", label: "True change",
      detail: "the log2 fold change of 20 genes in the tumour samples' Kupffer cells, half up and half down; every other gene is unchanged",
      options: CHANGES.map((v) => ({ value: v, label: v })), default: "0", when: ON("conditions"),
    },
    sampleSd: {
      type: "choice", label: "Sample effect",
      detail: "the SD, in log, of each gene's level in one sample's preparation: ambient RNA, dissociation, handling",
      options: SAMPLE_SD.map((v) => ({ value: v, label: v })), default: "0", when: ON("conditions"),
    },
    patientSd: {
      type: "choice", label: "Patient effect",
      detail: "the SD, in log, of each gene's level in one patient, shared by that patient's liver and tumour samples",
      options: PATIENT_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("conditions"),
    },
    compSec: { type: "section", label: "The samples", when: ON("composition") },
    compSd: {
      type: "choice", label: "Spread between samples",
      detail: "the SD, in log, by which each sample's share of each type moves around its tissue's",
      options: COMP_SD.map((v) => ({ value: v, label: v })), default: "0.3", when: ON("composition"),
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
  },

  legend: ({ params }) => {
    if (params.page === "conditions") return [
      { token: "ink-3", label: "A gene not called", mark: "dot" },
      { token: "empirical", label: "Called at adjusted p < 0.05, and truly changed", mark: "dot" },
      { token: "extreme", label: "Called, and unchanged", mark: "dot" },
      { token: "reference", label: "A ring: truly changed", mark: "line" },
      { token: "ink-2", label: "Below: a cell, in its sample's column", mark: "dot" },
    ];
    if (params.page === "composition") return [
      ...TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: t.name, mark: "bar" })),
    ];
    if (params.page === "markers") return [
      { token: "magnitude", label: "Dot size: share of the cluster's cells detecting the gene; shade: its mean", mark: "dot" },
    ];
    return TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: `${t.name}; its clusters lighter to darker along the lobule`, mark: "dot" })).slice(0, 1)
      .concat(TYPES.slice(1).map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i + 1]]}`, label: t.name, mark: "dot" })));
  },

  compute: ({ params }) => {
    const cl = clustersFor(params.seed, params.zonation, params.res);
    const mk = markersFor(params, cl);
    return {
      stage: stageFor(params.seed, params.zonation), cl,
      mk: { ...mk, type: cl.ann[mk.tested].type },
      cond: conditionsFor(params.seed, params.sampleSd, params.patientSd, params.change),
      comp: compositionFor(params.seed, params.compSd),
    };
  },

  regions: ({ w, params, state }) => {
    /* core probes the table at load, before compute has run */
    if (params.page !== "markers" || !state) return [];
    const L = markersLayout(w);
    const setFor = (c) => (params.pick === "against" ? { against: String(c) } : { cluster: String(c) });
    return [
      /* in comparison mode the tested cluster is not a comparison it can have */
      ...state.cl.ann.slice(0, MAX_ROWS).filter((a) => !(params.pick === "against" && a.c === state.mk.tested)).map((a, ri) => ({ x: 4, y: L.top + state.cl.ann.indexOf(a) * L.rowH, w: L.x1 - 4, h: L.rowH, set: setFor(a.c), label: `cluster ${a.c}` })),
      ...mapTiles(state, L).filter((t) => t.c < MAX_ROWS && !(params.pick === "against" && t.c === state.mk.tested)).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h, set: setFor(t.c), label: `cluster ${t.c} on the map` })),
      ...markerChips(L).map((ch) => ({ x: ch.x, y: ch.y, w: ch.w, h: ch.h, set: ch.set, label: ch.label })),
    ];
  },

  draw: ({ ctx, colors, w, params, state }) => {
    if (params.page === "clusters") drawClusters(ctx, colors, w, params, state);
    else if (params.page === "markers") drawMarkers(ctx, colors, w, params, state);
    else if (params.page === "conditions") drawConditions(ctx, colors, w, params, state);
    else drawComposition(ctx, colors, w, params, state);
  },

  readout: ({ params, state }) => {
    const cl = state.cl;
    if (params.page === "clusters") {
      const hep = cl.ann.filter((a) => a.type === 0).sort((a, b) => a.zMean - b.zMean);
      return [
        { label: "Clusters found", value: String(cl.k), note: `six cell types; modularity ${fmt(cl.q, 3)}, the best of 10 random starts` },
        { label: "Clusters that are mostly hepatocytes", value: String(hep.length), note: hep.length > 1 ? `their hepatocytes' mean place along the lobule, portal 0 to central 1: ${hep.map((a) => a.zMean.toFixed(2)).join(" · ")}` : "one cluster holds the hepatocytes" },
      ];
    }
    if (params.page === "markers") {
      const mk = state.mk, fm = mk.fm, tested = mk.tested;
      const up = fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05), broad = broadOf(mk);
      const against = mk.vsRest ? `the other ${fm.n2} cells` : `cluster ${mk.otherC}'s ${fm.n2}`;
      return [
        { label: `Genes up in cluster ${tested} at p_val_adj < 0.05`, value: String(up.length), note: `${fm.n1} cells against ${against}; ${state.cl.k} clusters at resolution ${params.res}` },
        params.markers === "conserved"
          ? { label: "Of those, up in both patients", value: String(up.filter((x) => mk.conserved.has(x.g)).length), note: "each patient tested separately, each at p_val_adj < 0.05" }
          : { label: "Of those, detected in more than half of the other group", value: String(broad.length), note: "significant, and not specific to the cluster" },
      ];
    }
    if (params.page === "composition") {
      const T = state.comp.types;
      const names = (k) => T.filter((r) => r[k] < 0.05).map((r) => TYPES[r.ti].name.toLowerCase()).join(", ") || "none";
      return [
        { label: "Types whose share differs, over cells", value: String(T.filter((r) => r.pCells < 0.05).length), note: `p < 0.05: ${names("pCells")}` },
        { label: "Types whose share differs, over samples", value: String(T.filter((r) => r.pSamples < 0.05).length), note: `p < 0.05: ${names("pSamples")}` },
      ];
    }
    const C = state.cond;
    const at = (ps) => ps.filter((x) => x.p < 0.05).length / ps.length;
    if (Number(params.change) > 0) {
      const tp = (v) => v.filter((q) => q.call && q.truth).length, fp = (v) => v.filter((q) => q.call && !q.truth).length;
      return [
        { label: "Over cells: truly changed genes called", value: `${tp(C.volC)} of 20`, note: `and ${fp(C.volC)} unchanged genes called besides, at p_val_adj < 0.05` },
        { label: "Over samples: truly changed genes called", value: `${tp(C.volD)} of 20`, note: `and ${fp(C.volD)} unchanged genes called besides, at padj < 0.05; the patient effect is shared by both of a patient's samples, so it cancels between tumour and liver` },
      ];
    }
    return [
      { label: "Unchanged genes at p < 0.05, over cells", value: pct(at(C.cellsP)), note: `${C.cellsP.filter((x) => x.lpAdj < LOG05).length} of ${C.cellsP.length} at p_val_adj < 0.05; a valid test gives 5% at p < 0.05` },
      { label: "Unchanged genes at p < 0.05, over samples", value: pct(at(C.pbP)), note: `${C.pbP.filter((x) => x.padj < 0.05).length} of ${C.pbP.length} at padj < 0.05; the patient effect is shared by both of a patient's samples, so it cancels between tumour and liver` },
    ];
  },
});
