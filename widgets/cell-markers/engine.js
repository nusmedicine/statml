/* cell-markers/engine.js — slot 81's stage and methods, one module for
 * the measurement, the mock and (once picked) the widget.
 *
 * The stage is slots 79 and 80's: the same four samples (two patients ×
 * liver and tumour) in the same mixes, the same six types. What 81 needs that
 * they did not is GENES, so each cell is a vector of counts:
 *
 *   - 25 marker genes per type, raised in that type (a block, as 79's
 *     profile has); tumour cells also carry 10 of the hepatocyte block,
 *     because hepatoblastoma is a tumour of hepatocyte precursors;
 *   - 40 genes high in every type (ribosomal-like) — expressed, not markers;
 *   - 210 genes whose level differs a little between types (a log-fold
 *     spread of sd 0.25): expressed everywhere, and different enough that
 *     over hundreds of cells a test calls them;
 *   - a patient effect per gene per patient (log sd `patientSd`), the part
 *     of the variation that belongs to the person and not the cell type,
 *     and a sample effect per gene per sample (`sampleSd`), the part that
 *     belongs to one preparation;
 *   - counts negative binomial about each cell's mean, dispersion 0.3, at
 *     the sample's depth.
 *
 * The methods are Seurat's defaults, and each is written as published —
 * slot 80 found the arc's stand-ins wrong, so none of them is reused:
 *   NormalizeData (to 10^4, log1p) → ScaleData → PCA → FindNeighbors
 *   (k = 20, Jaccard SNN pruned at 1/15) → FindClusters (Louvain, multi-level
 *   until nothing moves, best modularity over 10 random starts) → FindMarkers
 *   (Wilcoxon over cells with the tie and continuity corrections, v5's
 *   min.pct 0.01 and logfc.threshold 0.1, Bonferroni over every gene).
 */
import { TYPES, SAMPLES } from "../cell-qc/engine.js";

export { TYPES, SAMPLES };
export const G_MARK = 25, G_HOUSE = 40, G_SPREAD = 210, G_ZONE = 30;
/* the zonation genes sit last: periportal half high at z = 0, pericentral half at z = 1 */
export const G = TYPES.length * G_MARK + G_HOUSE + G_SPREAD + G_ZONE;   // 430
export const KIN = 10;

/* the six types' mean log expression per gene, drawn once per seed */
function profiles(rng) {
  const base = Array.from({ length: G }, (_, g) => (g >= TYPES.length * G_MARK && g < TYPES.length * G_MARK + G_HOUSE ? 3.2 : rng.normal(0.4, 0.8)));
  const spread = TYPES.map(() => Array.from({ length: G }, () => rng.normal(0, 0.25)));
  return TYPES.map((t, ti) => base.map((b, g) => {
    if (g < TYPES.length * G_MARK) {
      const own = Math.floor(g / G_MARK) === ti;
      const kin = ti === 1 && Math.floor(g / G_MARK) === 0 && g % G_MARK < KIN;
      return b + (own ? 2.5 : kin ? 2.0 : -1.5);
    }
    if (g < TYPES.length * G_MARK + G_HOUSE) return b;
    return b + spread[ti][g];
  }));
}

function nbDraw(rng, mu, phi) { // gamma-Poisson; phi is the dispersion
  if (mu <= 0) return 0;
  const shape = 1 / phi, scale = mu * phi;
  return poisson(rng, gamma(rng, shape) * scale);
}
function gamma(rng, k) { // Marsaglia–Tsang
  if (k < 1) return gamma(rng, k + 1) * rng.next() ** (1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = rng.normal(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rng.next(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
function poisson(rng, lam) {
  if (lam < 30) { const L = Math.exp(-lam); let k = 0, p = 1; do { k += 1; p *= rng.next(); } while (p > L); return k - 1; }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * rng.normal()));
}

/** Four samples of `cells` cells. Pure given rng. `condition` is a true
    tumour-against-liver change on the Kupffer cells' first `conditionGenes`
    spread genes (log2 fold), zero by default. */
export function simulate(rng, { cells = 400, patientSd = 0.3, sampleSd = 0, phi = 0.3, depth = 1, condition = 0, conditionGenes = 20, zonation = 0, compSd = 0, interaction = 0, interactionGenes = 10 } = {}) {
  const P = profiles(rng);
  const pat = [0, 1].map(() => Array.from({ length: G }, () => rng.normal(0, patientSd)));
  /* a SAMPLE's own effect, per gene: what one preparation does that the same
     patient's other sample does not — ambient RNA, dissociation, handling.
     A patient's effect is shared by both of that patient's samples, so in a
     tumour-against-liver comparison it cancels; a sample's does not. */
  const samp = SAMPLES.map(() => Array.from({ length: G }, () => rng.normal(0, sampleSd)));
  const out = [];
  /* each sample's own mix of types: its tissue's mix, every share moved by a
     log-normal of sd `compSd` and renormalised — what two livers from two
     people differ by, so a composition test has sample-to-sample noise */
  const mixes = SAMPLES.map((s) => { const m = {}; for (const t of TYPES) m[t.key] = (s.mix[t.key] ?? 0) * Math.exp(rng.normal(0, compSd)); return m; });
  for (const [si, s] of SAMPLES.entries()) {
    const mix = mixes[si];
    const tot = Object.values(mix).reduce((a, b) => a + b, 0);
    for (let i = 0; i < cells; i += 1) {
      const u = rng.next() * tot; let acc = 0, ti = 0;
      for (let k = 0; k < TYPES.length; k += 1) { acc += mix[TYPES[k].key] ?? 0; if (u < acc) { ti = k; break; } }
      const size = Math.exp(rng.normal(0, 0.35)) * depth * (s.depth / 5000);
      /* a hepatocyte's place along the lobule, portal (0) to central (1): its
         zonation genes follow it, the periportal half falling and the
         pericentral half rising by `zonation` in log over the whole span */
      const z = TYPES[ti].key === "hepatocyte" ? rng.next() : null;
      const x = new Float64Array(G);
      for (let g = 0; g < G; g += 1) {
        let lm = P[ti][g] + pat[s.patient - 1][g] + samp[si][g];
        const zg = g - (G - G_ZONE);
        if (zg >= 0) lm = z === null ? P[ti][g] - 1.5 + pat[s.patient - 1][g] + samp[si][g] : lm + zonation * (zg < G_ZONE / 2 ? 0.5 - z : z - 0.5);
        if (condition && TYPES[ti].key === "kupffer" && s.tissue === "tumour" && g >= TYPES.length * G_MARK + G_HOUSE && g < TYPES.length * G_MARK + G_HOUSE + conditionGenes) lm += condition * Math.LN2;
        /* a patient × type interaction: the first `interactionGenes` spread
           genes raised in patient 1's hepatocytes only — a gene one person's
           cells of a type carry and the other's do not */
        if (interaction && ti === 0 && s.patient === 1 && g >= TYPES.length * G_MARK + G_HOUSE && g < TYPES.length * G_MARK + G_HOUSE + interactionGenes) lm += interaction * Math.LN2;
        x[g] = nbDraw(rng, size * Math.exp(lm), phi);
      }
      out.push({ sample: s.key, patient: s.patient, tissue: s.tissue, type: ti, z, x });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Seurat */
export function normalise(cells) {
  return cells.map((c) => { const t = c.x.reduce((a, b) => a + b, 0) || 1; return Float64Array.from(c.x, (v) => Math.log1p((v / t) * 1e4)); });
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]; return s; };
export function pcaScaled(X, k, rng) {
  const n = X.length, D = X[0].length;
  const m = new Float64Array(D), sd = new Float64Array(D);
  X.forEach((x) => x.forEach((v, d) => { m[d] += v / n; }));
  X.forEach((x) => x.forEach((v, d) => { sd[d] += (v - m[d]) ** 2 / (n - 1); }));
  const Z = X.map((x) => Float64Array.from(x, (v, d) => Math.max(-10, Math.min(10, (v - m[d]) / (Math.sqrt(sd[d]) || 1)))));   // ScaleData clips at 10
  let V = Array.from({ length: k }, () => Float64Array.from({ length: D }, () => rng.normal()));
  const orth = () => { for (let i = 0; i < k; i += 1) { for (let j = 0; j < i; j += 1) { const d = dot(V[i], V[j]); for (let t = 0; t < D; t += 1) V[i][t] -= d * V[j][t]; } const nn = Math.sqrt(dot(V[i], V[i])) || 1; for (let t = 0; t < D; t += 1) V[i][t] /= nn; } };
  orth();
  for (let it = 0; it < 40; it += 1) {
    V = V.map((v) => { const u = Z.map((z) => dot(z, v)); const r = new Float64Array(D); Z.forEach((z, i) => { for (let t = 0; t < D; t += 1) r[t] += z[t] * u[i]; }); return r; });
    orth();
  }
  return Z.map((z) => V.map((v) => dot(z, v)));
}
export function knn(X, k) {
  const n = X.length;
  return X.map((a, i) => {
    const best = [];
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      let s = 0; for (let t = 0; t < a.length; t += 1) s += (a[t] - X[j][t]) ** 2;
      if (best.length < k || s < best[best.length - 1][0]) { let q = best.length; best.push([s, j]); while (q > 0 && best[q - 1][0] > s) { best[q] = best[q - 1]; q -= 1; } best[q] = [s, j]; if (best.length > k) best.pop(); }
    }
    return best.map((e) => e[1]);
  });
}
/** Seurat's ComputeSNN: Jaccard over the kNN sets (each includes the cell
    itself), an edge kept when the Jaccard is at least `prune` (1/15). */
export function snn(nn, prune = 1 / 15) {
  const n = nn.length, sets = nn.map((a, i) => new Set([i, ...a])), adj = Array.from({ length: n }, () => new Map());
  for (let i = 0; i < n; i += 1) {
    const cand = new Set(nn[i]); for (const j of nn[i]) for (const l of nn[j]) cand.add(l);
    for (const j of cand) {
      if (j <= i) continue;
      let inter = 0; for (const v of sets[i]) if (sets[j].has(v)) inter += 1;
      const jac = inter / (sets[i].size + sets[j].size - inter);
      if (jac >= prune) { adj[i].set(j, jac); adj[j].set(i, jac); }
    }
  }
  return adj;
}
/** Modularity at resolution gamma of a partition of a weighted graph. */
export function modularity(adj, comm, gamma) {
  const k = adj.map((m) => [...m.values()].reduce((s, w) => s + w, 0));
  const m2 = k.reduce((s, v) => s + v, 0);
  const inW = new Map(), tot = new Map();
  adj.forEach((m, i) => { tot.set(comm[i], (tot.get(comm[i]) ?? 0) + k[i]); for (const [j, w] of m) if (comm[j] === comm[i]) inW.set(comm[i], (inW.get(comm[i]) ?? 0) + w); });
  let q = 0; for (const [c, t] of tot) q += (inW.get(c) ?? 0) / m2 - gamma * (t / m2) ** 2;
  return q;
}
/** Louvain as published: local moving in random order until no node moves,
    then aggregate each community into a node, and repeat on the aggregated
    graph until a level changes nothing. Self-loops carry the within-community
    weight, so modularity is preserved across levels. */
export function louvain(adj0, gamma, rng) {
  const n0 = adj0.length;
  let adj = adj0.map((m) => new Map(m));
  let member = [...Array(n0).keys()];           // original node -> current node
  const m2 = adj0.reduce((s, m) => s + [...m.values()].reduce((a, b) => a + b, 0), 0);
  for (let level = 0; level < 20; level += 1) {
    const n = adj.length;
    const k = adj.map((m) => [...m.values()].reduce((s, w) => s + w, 0));
    const comm = [...Array(n).keys()], tot = k.slice();
    const order = [...Array(n).keys()];
    let movedAny = false;
    for (let pass = 0; pass < 50; pass += 1) {
      for (let t = n - 1; t > 0; t -= 1) { const s = Math.floor(rng.next() * (t + 1)); [order[t], order[s]] = [order[s], order[t]]; }
      let moved = false;
      for (const i of order) {
        const ci = comm[i]; tot[ci] -= k[i];
        const wTo = new Map();
        for (const [j, w] of adj[i]) if (j !== i) wTo.set(comm[j], (wTo.get(comm[j]) ?? 0) + w);
        let best = ci, bestGain = (wTo.get(ci) ?? 0) - (gamma * k[i] * tot[ci]) / m2;
        for (const [c, w] of wTo) { const gain = w - (gamma * k[i] * tot[c]) / m2; if (gain > bestGain + 1e-12) { bestGain = gain; best = c; } }
        tot[best] += k[i];
        if (best !== ci) { comm[i] = best; moved = true; movedAny = true; }
      }
      if (!moved) break;
    }
    const ids = [...new Set(comm)];
    if (!movedAny || ids.length === n) break;
    const map = new Map(ids.map((c, i) => [c, i]));
    const next = Array.from({ length: ids.length }, () => new Map());
    for (let i = 0; i < n; i += 1) for (const [j, w] of adj[i]) { const a = map.get(comm[i]), b = map.get(comm[j]); next[a].set(b, (next[a].get(b) ?? 0) + w); }
    member = member.map((v) => map.get(comm[v]));
    adj = next;
  }
  const ids = [...new Set(member)], map = new Map(ids.map((c, i) => [c, i]));
  return member.map((c) => map.get(c));
}
/** FindClusters: the best modularity over `starts` random starts. */
export function findClusters(adj, gamma, rng, starts = 10) {
  let best = null;
  for (let s = 0; s < starts; s += 1) {
    const c = louvain(adj, gamma, rng), q = modularity(adj, c, gamma);
    if (!best || q > best.q) best = { c, q };
  }
  /* numbered by size, largest first, as Seurat numbers them */
  const size = new Map(); best.c.forEach((v) => size.set(v, (size.get(v) ?? 0) + 1));
  const rank = new Map([...size.entries()].sort((a, b) => b[1] - a[1]).map(([v], i) => [v, i]));
  return { clusters: best.c.map((v) => rank.get(v)), q: best.q, k: size.size };
}
export function ari(a, b) {
  const n = a.length, A = new Map(), B = new Map(), AB = new Map();
  for (let i = 0; i < n; i += 1) { A.set(a[i], (A.get(a[i]) ?? 0) + 1); B.set(b[i], (B.get(b[i]) ?? 0) + 1); const k = `${a[i]}|${b[i]}`; AB.set(k, (AB.get(k) ?? 0) + 1); }
  const c2 = (x) => (x * (x - 1)) / 2;
  const sAB = [...AB.values()].reduce((s, v) => s + c2(v), 0), sA = [...A.values()].reduce((s, v) => s + c2(v), 0), sB = [...B.values()].reduce((s, v) => s + c2(v), 0);
  const exp = (sA * sB) / c2(n), max = (sA + sB) / 2;
  return (sAB - exp) / (max - exp);
}

/* ------------------------------------------------------------- FindMarkers */
function normLogSf(z) {
  if (z < 5) { const t = 1 / (1 + 0.5 * z / Math.SQRT2), x = z / Math.SQRT2; const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return Math.log(0.5 * r); }
  return -0.5 * z * z - Math.log(z) - 0.5 * Math.log(2 * Math.PI) + Math.log(1 - 1 / (z * z) + 3 / z ** 4);
}
/** log10 of the two-sided Wilcoxon p over two arrays of values, with the tie
    and continuity corrections of R's wilcox.test (which presto matches). */
export function wilcoxLog10P(a, b) {
  const na = a.length, nb = b.length, N = na + nb;
  const all = new Array(N); for (let i = 0; i < na; i += 1) all[i] = [a[i], 0]; for (let i = 0; i < nb; i += 1) all[na + i] = [b[i], 1];
  all.sort((x, y) => x[0] - y[0]);
  let R1 = 0, tie = 0, i = 0;
  while (i < N) {
    let j = i; while (j + 1 < N && all[j + 1][0] === all[i][0]) j += 1;
    const r = (i + j) / 2 + 1, t = j - i + 1;
    for (let q = i; q <= j; q += 1) if (all[q][1] === 0) R1 += r;
    if (t > 1) tie += t ** 3 - t;
    i = j + 1;
  }
  const U = R1 - (na * (na + 1)) / 2, mu = (na * nb) / 2;
  const v = (na * nb / 12) * (N + 1 - tie / (N * (N - 1)));
  if (v <= 0) return 0;
  const z = Math.max(0, Math.abs(U - mu) - 0.5) / Math.sqrt(v);
  return Math.min(0, (Math.LN2 + normLogSf(z)) / Math.LN10);
}
/** FindMarkers(ident.1 = in1, ident.2 = in2) over the normalised values Y. */
export function findMarkers(Y, in1, in2, { minPct = 0.01, logfc = 0.1, nGenes = null } = {}) {
  const I1 = [], I2 = [];
  Y.forEach((_, i) => { if (in1(i)) I1.push(i); else if (in2(i)) I2.push(i); });
  const D = Y[0].length, nG = nGenes ?? D, res = [];
  for (let g = 0; g < D; g += 1) {
    const a = I1.map((i) => Y[i][g]), b = I2.map((i) => Y[i][g]);
    const p1 = a.filter((v) => v > 0).length / a.length, p2 = b.filter((v) => v > 0).length / b.length;
    if (Math.max(p1, p2) < minPct) continue;
    const m1 = a.reduce((s, v) => s + Math.expm1(v), 0) / a.length, m2 = b.reduce((s, v) => s + Math.expm1(v), 0) / b.length;
    const lfc = Math.log2(m1 + 1) - Math.log2(m2 + 1);
    if (Math.abs(lfc) < logfc) continue;
    const lp = wilcoxLog10P(a, b);
    res.push({ g, lfc, p1, p2, lp, lpAdj: Math.min(0, lp + Math.log10(nG)) });
  }
  return { n1: I1.length, n2: I2.length, res };
}
/** what kind of gene g is on this stage */
export function geneKind(g) {
  if (g < TYPES.length * G_MARK) return { kind: "marker", type: Math.floor(g / G_MARK) };
  if (g < TYPES.length * G_MARK + G_HOUSE) return { kind: "house" };
  if (g >= G - G_ZONE) return { kind: "zone" };
  return { kind: "spread" };
}

/** One cell type only, `perSample` cells in each of the four samples: the
    Conditions page's stage. The same profiles, patient and sample effects as
    `simulate` draws, in the same order, so a type's cells here are what they
    are there — only the other five types are not drawn. */
export function simulateType(rng, typeKey, { perSample = 120, patientSd = 0.3, sampleSd = 0, phi = 0.3, depth = 1, condition = 0, conditionGenes = 20 } = {}) {
  const P = profiles(rng);
  const pat = [0, 1].map(() => Array.from({ length: G }, () => rng.normal(0, patientSd)));
  const samp = SAMPLES.map(() => Array.from({ length: G }, () => rng.normal(0, sampleSd)));
  const ti = TYPES.findIndex((t) => t.key === typeKey);
  const out = [];
  for (const [si, s] of SAMPLES.entries()) {
    for (let i = 0; i < perSample; i += 1) {
      const size = Math.exp(rng.normal(0, 0.35)) * depth * (s.depth / 5000);
      const x = new Float64Array(G);
      for (let g = 0; g < G; g += 1) {
        const zg = g - (G - G_ZONE);
        let lm = (zg >= 0 ? P[ti][g] - 1.5 : P[ti][g]) + pat[s.patient - 1][g] + samp[si][g];
        /* a real tumour-against-liver change: the first `conditionGenes` spread
           genes, up or down alternately by `condition` log2 */
        const cg = g - (TYPES.length * G_MARK + G_HOUSE);
        if (condition && s.tissue === "tumour" && cg >= 0 && cg < conditionGenes) lm += (cg % 2 ? -1 : 1) * condition * Math.LN2;
        x[g] = nbDraw(rng, size * Math.exp(lm), phi);
      }
      out.push({ sample: s.key, patient: s.patient, tissue: s.tissue, type: ti, z: null, x });
    }
  }
  return out;
}

/* A gene's name on the page: the kind of gene it is on this stage and its
   number within that kind. The stage is simulated, so no real gene symbol is
   borrowed for it. */
const TYPE_ABBR = ["Hep", "Tum", "Imm", "End", "Stel", "Kup"];
export function geneName(g) {
  const k = geneKind(g);
  if (k.kind === "marker") return `${TYPE_ABBR[k.type]}${(g % G_MARK) + 1}`;
  if (k.kind === "house") return `Common${g - TYPES.length * G_MARK + 1}`;
  if (k.kind === "zone") { const zg = g - (G - G_ZONE); return zg < G_ZONE / 2 ? `Portal${zg + 1}` : `Central${zg - G_ZONE / 2 + 1}`; }
  return `Gene${g - TYPES.length * G_MARK - G_HOUSE + 1}`;
}

/** the spread genes that truly change in simulateType's tumour samples */
export const isConditionGene = (g, conditionGenes = 20) => { const cg = g - (TYPES.length * G_MARK + G_HOUSE); return cg >= 0 && cg < conditionGenes; };
