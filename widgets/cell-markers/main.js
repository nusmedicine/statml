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
import { analyse } from "../deseq2/engine.js";
import { simulate, simulateType, normalise, pcaScaled, knn, snn, findClusters, findMarkers, geneKind, geneName, TYPES, G, G_MARK, G_ZONE } from "./engine.js";
import { umapSgd } from "./umap.js";

const PAGES = [
  { value: "clusters", label: "Clusters" },
  { value: "markers", label: "Markers" },
  { value: "conditions", label: "Conditions" },
];
const ON = (page) => ({ param: "page", equals: page });
const NOT_CONDITIONS = { param: "page", not: "conditions" };
const HEIGHTS = { clusters: 580, markers: 640, conditions: 460 };
const RESOLUTIONS = ["0.1", "0.3", "0.5", "0.8", "1.2", "2"];
const SAMPLE_SD = ["0", "0.1", "0.2", "0.4", "0.65"];
const PATIENT_SD = ["0", "0.3", "0.65"];
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
    const cells = simulate(makeRng(Math.floor(rng.next() * 2 ** 31)), { cells: CELLS_PER_SAMPLE, patientSd: 0, zonation: zonation === "on" ? 3 : 0 });
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
    const markers = ann.map((a) => findMarkers(S.Y, (i) => r.clusters[i] === a.c, (i) => r.clusters[i] !== a.c, { nGenes: 33538 }));
    return { clusters: r.clusters, q: r.q, k, ann, markers };
  });
}

/* Kupffer cells only, tumour against liver, no condition effect: both tests
   on the same cells, and the null gene with the smallest p over cells as the
   one drawn cell by cell */
function conditionsFor(seed, sampleSd, patientSd) {
  return remember(cache.cond, `${seed}|${sampleSd}|${patientSd}`, () => {
    const cells = simulateType(makeRng(seed * 7919 + 17), "kupffer", { perSample: KUPFFER_PER_SAMPLE, patientSd: Number(patientSd), sampleSd: Number(sampleSd) });
    const Y = normalise(cells);
    const fm = findMarkers(Y, (i) => cells[i].tissue === "tumour", (i) => cells[i].tissue === "liver", { logfc: 0, minPct: 0, nGenes: 33538 });
    const isNull = (g) => geneKind(g).kind === "spread";
    const cellsP = fm.res.filter((x) => isNull(x.g)).map((x) => ({ g: x.g, p: 10 ** x.lp, lp: x.lp, lpAdj: x.lpAdj }));
    const order = ["p1-liver", "p2-liver", "p1-tumour", "p2-tumour"];
    const counts = Array.from({ length: G }, (_, g) => order.map((sk) => cells.reduce((s, c) => s + (c.sample === sk ? c.x[g] : 0), 0)));
    const an = analyse({ counts, grp: [0, 0, 1, 1], reps: 2, genes: G });
    const pbP = an.expressed.filter(isNull).map((g) => ({ g, p: an.resMAP[g].p, padj: an.resMAP[g].padj }));
    const ex = cellsP.slice().sort((a, b) => a.lp - b.lp)[0];
    const exVals = order.map((sk) => cells.map((c, i) => (c.sample === sk ? Y[i][ex.g] : null)).filter((v) => v !== null));
    return { n: cells.length, cellsP, pbP, ex, exVals, order };
  });
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
  return { labelW, top, rowH, tableTop: top + MAX_ROWS * rowH + 34, x0: labelW, x1: w - 56 };
}
function dotGenes(cl, tested) {
  /* three markers of each type, two portal and two central zonation genes,
     one common gene, and the tested cluster's three most significant genes
     among those detected in most other cells */
  const genes = [];
  TYPES.forEach((_, t) => { for (let j = 0; j < 3; j += 1) genes.push(t * G_MARK + j); });
  [0, 1].forEach((j) => genes.push(G - G_ZONE + j));
  [0, 1].forEach((j) => genes.push(G - G_ZONE / 2 + j));
  genes.push(TYPES.length * G_MARK);
  broadOf(cl, tested).slice(0, 3).forEach((x) => { if (!genes.includes(x.g)) genes.push(x.g); });
  return genes;
}
const isOwn = (g, type) => { const k = geneKind(g); return (k.kind === "marker" && k.type === type) || (type === 0 && k.kind === "zone"); };
/* significant, up, and detected in more than half of the other cells */
function broadOf(cl, c) {
  return cl.markers[c].res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05 && x.p2 > 0.5 && !isOwn(x.g, cl.ann[c].type)).sort((a, b) => a.lp - b.lp);
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
  const cl = state.cl, st = state.stage, L = markersLayout(w);
  const tested = Math.min(Number(params.cluster), cl.k - 1);
  const genes = dotGenes(cl, tested);
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
    ctx.font = `${a.c === tested ? "600 " : ""}${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "right";
    ctx.fillText(`${a.c} · ${TYPES[a.type].name}`, L.x0 - 8, y + 4);
    genes.forEach((g, j) => {
      const s = stats[ri][j];
      ctx.fillStyle = colors.magnitude; ctx.globalAlpha = 0.15 + 0.85 * (s.mean / maxMean[j]);
      ctx.beginPath(); ctx.arc(L.x0 + j * cw + cw / 2, y, 1.5 + 8 * Math.sqrt(s.pct), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  });
  /* the table: FindMarkers for the tested cluster against every other cell */
  const fm = cl.markers[tested], own = (g) => isOwn(g, cl.ann[tested].type);
  const top = fm.res.filter((x) => x.lfc > 0).sort((a, b) => a.lp - b.lp || b.lfc - a.lfc).slice(0, 8);
  const broad = broadOf(cl, tested).filter((x) => !top.includes(x)).slice(0, 3);
  /* the table's columns in proportion to the width, the note last */
  const cx = (f) => Math.round(8 + f * (w - 16));
  const cols = [["gene", cx(0), "left"], ["p_val", cx(0.2), "right"], ["avg_log2FC", cx(0.34), "right"], ["pct.1", cx(0.43), "right"], ["pct.2", cx(0.52), "right"], ["p_val_adj", cx(0.64), "right"], ["", cx(0.67), "left"]];
  let y = L.tableTop;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText(`FindMarkers: cluster ${tested} against the other ${fm.n2} cells, first 8 by p`, 8, y - 10);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  cols.forEach(([h, x, al]) => { ctx.textAlign = al; ctx.fillText(h, x, y + 8); });
  y += 24;
  const row = (x, grey) => {
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = grey ? colors.ink3 : colors.ink1;
    const v = [geneName(x.g), pFmt(x.lp), x.lfc.toFixed(2), x.p1.toFixed(2), x.p2.toFixed(2), pFmt(x.lpAdj), ""];
    cols.forEach(([, cx, al], k) => { ctx.textAlign = al; ctx.fillText(v[k], cx, y); });
    ctx.textAlign = "left"; ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillText(own(x.g) ? "" : "detected in most other cells", cx(0.67), y);
    y += 18;
  };
  top.forEach((x) => row(x, !own(x.g)));
  if (broad.length) {
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "left";
    ctx.fillText("further down the same list, also p_val_adj < 0.05:", 8, y + 2); y += 20;
    broad.forEach((x) => row(x, true));
  }
  ctx.textAlign = "left";
}

function drawConditions(ctx, colors, w, params, state) {
  const C = state.cond;
  const PW = Math.floor((w - 64) / 2), xs = [24, 24 + PW + 40], top = TOP + 10, bh = 190;
  const hist = (ps) => { const b = new Array(20).fill(0); ps.forEach((x) => { b[Math.min(19, Math.floor(x.p * 20))] += 1; }); return b; };
  const sets = [[C.cellsP, `Over cells: ${C.n} cells (Wilcoxon)`], [C.pbP, "Over samples: 4 summed (DESeq2)"]];
  const flat = (ps) => ps.length / 20;
  const yMax = Math.max(...sets.flatMap(([ps]) => hist(ps)), ...sets.map(([ps]) => 2 * flat(ps)));
  sets.forEach(([ps, title], k) => {
    const X = xs[k], b = hist(ps);
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
    ctx.fillText(title, X, TOP - 9);
    b.forEach((v, j) => { const h = (v / yMax) * bh; ctx.fillStyle = j === 0 ? colors.extreme : colors.empirical; ctx.fillRect(X + (j * PW) / 20 + 1, top + bh - h, PW / 20 - 2, h); });
    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, top + bh + 0.5); ctx.lineTo(X + PW, top + bh + 0.5); ctx.stroke();
    const fy = top + bh - (flat(ps) / yMax) * bh;
    ctx.strokeStyle = colors.reference; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X, fy); ctx.lineTo(X + PW, fy); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.textAlign = "left"; ctx.fillText("0", X, top + bh + 15);
    ctx.textAlign = "right"; ctx.fillText("1", X + PW, top + bh + 15);
    ctx.textAlign = "center"; ctx.fillText(`p-value, ${ps.length} unchanged genes`, X + PW / 2, top + bh + 15);
  });
  /* one unchanged gene, cell by cell: the null gene with the smallest p over cells */
  const sTop = top + bh + 60, sH = HEIGHTS.conditions - sTop - 30, colW = (w - 140) / 4;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText(`${geneName(C.ex.g)}, unchanged between tumour and liver: every Kupffer cell's value, by sample`, 24, sTop - 12);
  const all = C.exVals.flat(), vMax = Math.max(...all, 0.1);
  const names = ["Patient 1 · liver", "Patient 2 · liver", "Patient 1 · tumour", "Patient 2 · tumour"];
  C.exVals.forEach((vals, k) => {
    const cx = 110 + k * colW + colW / 2;
    ctx.fillStyle = k < 2 ? colors.groupA : colors.groupB; ctx.globalAlpha = 0.55;
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

    dataSec: { type: "section", label: "The cells", when: NOT_CONDITIONS },
    zonation: {
      type: "segmented", label: "Hepatocyte zonation",
      detail: "whether hepatocytes differ along the liver lobule, from the portal to the central vein, in 30 genes",
      options: [{ value: "on", label: "On" }, { value: "off", label: "Off" }], default: "on", when: NOT_CONDITIONS,
    },
    res: {
      type: "choice", label: "Resolution",
      detail: "FindClusters' resolution: the weight on the expected number of links within a community",
      options: RESOLUTIONS.map((v) => ({ value: v, label: v })), default: "0.3", when: NOT_CONDITIONS,
    },
    cluster: {
      type: "int", label: "Cluster tested", min: 0, max: MAX_ROWS - 1, default: 0,
      detail: "clusters are numbered by size, 0 the largest; a row of the dot plot selects one too",
      when: ON("markers"),
    },

    condSec: { type: "section", label: "The samples", when: ON("conditions") },
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
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
  },

  legend: ({ params }) => {
    if (params.page === "conditions") return [
      { token: "empirical", label: "Unchanged genes, by p-value", mark: "bar" },
      { token: "extreme", label: "p < 0.05", mark: "bar" },
      { token: "reference", label: "Flat: what unchanged genes give a valid test", mark: "line" },
      { token: "group-a", label: "A liver sample's cell", mark: "dot" },
      { token: "group-b", label: "A tumour sample's cell", mark: "dot" },
    ];
    if (params.page === "markers") return [
      { token: "magnitude", label: "Dot size: share of the cluster's cells detecting the gene; shade: its mean", mark: "dot" },
    ];
    return TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: `${t.name}; its clusters lighter to darker along the lobule`, mark: "dot" })).slice(0, 1)
      .concat(TYPES.slice(1).map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i + 1]]}`, label: t.name, mark: "dot" })));
  },

  compute: ({ params }) => ({
    stage: stageFor(params.seed, params.zonation),
    cl: clustersFor(params.seed, params.zonation, params.res),
    cond: conditionsFor(params.seed, params.sampleSd, params.patientSd),
  }),

  regions: ({ w, params, state }) => {
    /* core probes the table at load, before compute has run */
    if (params.page !== "markers" || !state) return [];
    const L = markersLayout(w);
    return state.cl.ann.slice(0, MAX_ROWS).map((a, ri) => ({ x: 4, y: L.top + ri * L.rowH, w: L.x1 - 4, h: L.rowH, set: { cluster: a.c }, label: `cluster ${a.c}` }));
  },

  draw: ({ ctx, colors, w, params, state }) => {
    if (params.page === "clusters") drawClusters(ctx, colors, w, params, state);
    else if (params.page === "markers") drawMarkers(ctx, colors, w, params, state);
    else drawConditions(ctx, colors, w, params, state);
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
      const tested = Math.min(Number(params.cluster), cl.k - 1), fm = cl.markers[tested];
      const up = fm.res.filter((x) => x.lfc > 0 && x.lpAdj < LOG05), broad = broadOf(cl, tested);
      return [
        { label: `Genes up in cluster ${tested} at p_val_adj < 0.05`, value: String(up.length), note: `${fm.n1} cells in the cluster against ${fm.n2}${Number(params.cluster) > tested ? `; cluster ${params.cluster} does not exist at this resolution, so the last one is shown` : ""}` },
        { label: "Of those, detected in more than half of the other cells", value: String(broad.length), note: "significant, and not specific to the cluster" },
      ];
    }
    const C = state.cond;
    const at = (ps) => ps.filter((x) => x.p < 0.05).length / ps.length;
    return [
      { label: "Unchanged genes at p < 0.05, over cells", value: pct(at(C.cellsP)), note: `${C.cellsP.filter((x) => x.lpAdj < LOG05).length} of ${C.cellsP.length} at p_val_adj < 0.05; a valid test gives 5% at p < 0.05` },
      { label: "Unchanged genes at p < 0.05, over samples", value: pct(at(C.pbP)), note: `${C.pbP.filter((x) => x.padj < 0.05).length} of ${C.pbP.length} at padj < 0.05; the patient effect is shared by both of a patient's samples, so it cancels between tumour and liver` },
    ];
  },
});
