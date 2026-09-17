/* The score behind slot 69 `driver-genes`, for the lab: maftools 2.26.0's
 * `oncodrive` ported line for line from the installed package (2026-09-17;
 * `_lab/driver-genes-oncodrive.R`'s header says what each function does).
 * `_lab/driver-genes-measure.mjs` checks this port against every gene maftools
 * scored on the lesson's MAF before any simulated gene is scored with it, so
 * the mock cannot draw a number the library would not produce.
 *
 * Kept faithful, quirks included, because a port that tidies them can only be
 * checked against the genes the quirks never touch:
 *   - the residue threshold is a POINT probability, dbinom(x) < 0.01, over the
 *     gene's `total`, which counts splice sites that are then given no residue;
 *   - a non-meaningful residue inside a cluster's core is scored but not added
 *     to its N, and one within 5 of two clusters is added to both;
 *   - when residues tie for a cluster's peak, R recycles the peaks along the
 *     residues in row order (`abs(posVector - peak)`), so `residues` must keep
 *     maftools' order: the order each residue first appears among the gene's
 *     mutations. The measure counts how often this changes a score.
 */
import { lgamma } from "../core/stats.js";
import { benjaminiHochberg } from "../enrichment/model.js";
export { benjaminiHochberg };

const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

/** R's dbinom for a whole-number x. */
export function dbinom(x, n, p) {
  if (x < 0 || x > n) return 0;
  return Math.exp(lchoose(n, x) + x * Math.log(p) + (n - x) * Math.log1p(-p));
}

/** get_threshold: the smallest x ≥ 2 with dbinom(x, total, 1/protLen) < 0.01.
    NaN where none is, as R's NA, which makes no residue meaningful. */
export function threshold(total, protLen) {
  const hi = Math.max(total, 1);
  if (total < 2) return 2;                        // R's 2:1 is c(2, 1); dbinom(2, 1, p) is 0
  for (let x = 2; x <= hi; x += 1) if (dbinom(x, total, 1 / protLen) < 0.01) return x;
  return NaN;
}

/** cluster_prot for one gene.
 *  residues: [{ pos, N }] in maftools' row order; th from `threshold`;
 *  placed: the gene's mutations that have a residue (splice sites left out).
 *  Returns null where no residue reaches th: maftools returns NULL and the gene
 *  is not in the table at all. */
export function clusterGene(residues, th, placed, { mergeDist = 5, widen = 5 } = {}) {
  const sorted = [...residues].sort((a, b) => a.pos - b.pos);
  const core = sorted.filter((r) => r.N >= th);
  const rest = sorted.filter((r) => !(r.N >= th));
  if (core.length === 0) return null;

  const clusters = [];
  let cur = { start: core[0].pos, end: core[0].pos, N: core[0].N };
  for (let i = 1; i < core.length; i += 1) {
    if (core[i].pos - core[i - 1].pos < mergeDist) { cur.end = core[i].pos; cur.N += core[i].N; }
    else { clusters.push(cur); cur = { start: core[i].pos, end: core[i].pos, N: core[i].N }; }
  }
  clusters.push(cur);

  for (const c of clusters) {
    c.coreStart = c.start; c.coreEnd = c.end;
    const before = rest.filter((r) => r.pos - c.coreStart >= -widen && r.pos - c.coreStart <= 0);
    const after = rest.filter((r) => r.pos - c.coreEnd <= widen && r.pos - c.coreEnd >= 0);
    if (before.length) { c.start = Math.min(...before.map((r) => r.pos)); c.N += before.reduce((s, r) => s + r.N, 0); }
    if (after.length) { c.end = Math.max(...after.map((r) => r.pos)); c.N += after.reduce((s, r) => s + r.N, 0); }
  }

  for (const c of clusters) {
    const span = residues.filter((r) => r.pos >= c.start && r.pos <= c.end);   // row order, as R's .N by pos
    const top = Math.max(...span.map((r) => r.N));
    const peaks = span.filter((r) => r.N === top).map((r) => r.pos);
    c.peaks = peaks;
    c.parts = span.map((r, i) => {
      const d = Math.abs(r.pos - peaks[i % peaks.length]);
      return { pos: r.pos, N: r.N, fraction: r.N / placed, distance: d, part: r.N / placed / Math.SQRT2 ** d };
    });
    c.score = c.parts.reduce((s, p) => s + p.part, 0);
  }
  return {
    clusters,
    count: clusters.length,
    inClusters: clusters.reduce((s, c) => s + c.N, 0),
    score: clusters.reduce((s, c) => s + c.score, 0),
  };
}

/* ---- the comparison with the background ----------------------------------- */
export const BACKGROUND = { mean: 0.279, sd: 0.13 };   // the predefined values cell 15 fell back to

function erfc(x) { // Numerical Recipes erfcc, fractional error below 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const upperTail = (z) => 0.5 * erfc(z / Math.SQRT2);
export const zOf = (score, bg = BACKGROUND) => (score - bg.mean) / bg.sd;

/* ==========================================================================
   THE SIMULATED STAGE — Kenneth's pick of 2026-09-16: simulated, and shaped by
   the lesson's MAF. Every constant below is measured or calibrated in
   `_lab/driver-genes-measure.mjs` §3–§4, which asserts the calibration.
   A simulated gene has no splice sites, so its total and placed counts are one
   number, and every mutation is on a residue.
   ========================================================================== */

/* ---- a standalone generator, for scripts with no core rng ----------------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function poisson(rng, lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 60) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)));
  const floor = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k += 1; p *= rng(); } while (p > floor);
  return k - 1;
}
export function binomialDraw(rng, n, p) { let k = 0; for (let i = 0; i < n; i += 1) if (rng() < p) k += 1; return k; }

/** Counts per residue in first-appearance order, as data.table's `.N` by pos. */
export function residuesOf(mutations) {
  const at = new Map();
  for (const m of mutations) at.set(m.pos, (at.get(m.pos) || 0) + 1);
  return [...at].map(([pos, N]) => ({ pos, N }));
}

/** oncodrive on one simulated gene: its threshold, and its clusters or null. */
export function scoreGene(gene, minMut = 5) {
  const n = gene.mutations.length;
  if (n < minMut) return { n, th: NaN, res: null, reason: "fewer than minMut" };
  const th = threshold(n, gene.L);
  const res = clusterGene(residuesOf(gene.mutations), th, n);
  return { n, th, res, reason: res ? "" : "no residue at the threshold" };
}

/** oncodrive over a cohort: the table (tested genes only) with z, p and BH. */
export function oncodriveTable(genes, minMut = 5) {
  const rows = [];
  for (const g of genes) {
    const s = scoreGene(g, minMut);
    Object.assign(g, { n: s.n, th: s.th, res: s.res, tested: !!s.res, reason: s.reason });
    if (!s.res) continue;
    g.score = s.res.score;
    g.fraction = s.res.inClusters / s.n;
    g.clusters = s.res.count;
    g.z = zOf(g.score);
    g.p = upperTail(g.z);
    rows.push(g);
  }
  const f = benjaminiHochberg(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.fdr = f[i]; r.called = f[i] <= 0.05; });
  return rows;
}

/* ---- the drivers: shaped by genes in the lesson's MAF ---------------------
   A hotspot is [residue, count, class], counted in 01-3's file (§3 prints
   them). The rest of a gene's mutations fall uniformly, by class, in its
   regions; `truncating` is the truncating share among those. */
export const SHAPES = {
  PIK3CA: { kind: "oncogene", L: 1068, n: 359, truncating: 0,
    hotspots: [[1047, 131, "missense"], [545, 70, "missense"], [542, 42, "missense"], [345, 19, "missense"], [546, 11, "missense"],
      [726, 8, "missense"], [453, 7, "missense"], [111, 5, "missense"], [118, 5, "missense"], [420, 4, "missense"]] },
  AKT1: { kind: "oncogene", L: 480, n: 26, truncating: 0, hotspots: [[17, 24, "missense"]] },
  KRAS: { kind: "oncogene", L: 189, n: 6, truncating: 0, hotspots: [[12, 5, "missense"]] },
  TP53: { kind: "suppressor", L: 393, n: 313, truncating: 0.4, truncRegion: [40, 360], missRegion: [102, 292],
    hotspots: [[273, 20, "missense"], [175, 19, "missense"], [220, 10, "missense"], [342, 10, "truncating"], [193, 9, "missense"],
      [248, 8, "missense"], [196, 8, "truncating"], [179, 7, "missense"], [176, 6, "missense"], [213, 6, "truncating"]] },
  CDH1: { kind: "suppressor", L: 882, n: 117, truncating: 0.87, hotspots: [[23, 8, "truncating"], [63, 4, "truncating"], [127, 4, "truncating"], [243, 3, "truncating"]] },
  GATA3: { kind: "suppressor", L: 444, n: 104, truncating: 0.9, truncRegion: [260, 444], missRegion: [260, 444],
    hotspots: [[408, 13, "truncating"], [335, 11, "truncating"], [330, 4, "truncating"], [293, 4, "truncating"], [426, 4, "truncating"],
      [436, 3, "truncating"], [364, 3, "truncating"], [329, 3, "truncating"], [444, 3, "truncating"]] },
  MAP3K1: { kind: "suppressor", L: 1512, n: 115, truncating: 0.76, hotspots: [] },
  PTEN: { kind: "suppressor", L: 403, n: 51, truncating: 0.65,
    hotspots: [[130, 6, "missense"], [124, 2, "missense"], [73, 2, "truncating"], [48, 2, "truncating"], [319, 2, "truncating"],
      [16, 2, "truncating"], [267, 2, "truncating"], [287, 2, "truncating"]] },
  NF1: { kind: "suppressor", L: 2839, n: 33, truncating: 0.6, hotspots: [] },
};

/* The lesson's own scores for the same genes, counted once per tumour and
   two-base changes once (§3), which a simulated gene of each shape is
   measured against in §5. */
export const LESSON_SCORES = { PIK3CA: 0.799, AKT1: 0.923, KRAS: 0.833, TP53: 0.556, CDH1: 0.345, GATA3: 0.596, MAP3K1: 0.253, PTEN: 0.501, NF1: null };

/* The chance each mutation is recorded twice when the cohort keeps repeats as
   the MAF lists them: fitted in §4 so the passenger genome tests about as many
   genes as the file does as listed (799). */
export const REPEAT_RATE = 0.0105;

/** One gene of a shape. The non-hotspot mutations fall on residues of unequal
    mutability, the passengers' (GENOME.mutabilitySd): the same processes act
    on a driver's other residues, and without it MAP3K1's shape scored 0.08
    against the file's 0.25 (§5, 2026-09-17). */
export function drawShaped(shape, rng, { n = shape.n, name = "", genome = GENOME } = {}) {
  const hot = shape.hotspots ?? [];
  const hotCount = hot.reduce((s, h) => s + h[1], 0);
  const hotShare = hotCount / shape.n;
  const cum = lognormalWeights(rng, shape.L, genome.mutabilitySd);
  const mutations = [];
  for (let i = 0; i < n; i += 1) {
    const u = rng();
    let m;
    if (u < hotShare) {
      let v = u * shape.n, k = 0;
      while (k < hot.length - 1 && v >= hot[k][1]) { v -= hot[k][1]; k += 1; }
      m = { pos: hot[k][0], cls: hot[k][2] };
    } else {
      const trunc = rng() < shape.truncating;
      const [a, b] = (trunc ? shape.truncRegion : shape.missRegion) ?? [1, shape.L];
      m = { pos: pickIn(cum, a, b, rng), cls: trunc ? "truncating" : "missense" };
    }
    mutations.push(m);
  }
  return { name, kind: shape.kind, L: shape.L, mutations };
}

/* ---- the passengers: a genome whose counts and residues are calibrated ----
   Lengths are lognormal; each gene's rate per residue is lognormal; each
   residue's mutability is lognormal with mean 1, which is what lets two
   passengers' mutations meet on one residue as often as they do in the
   lesson's file. The numbers are fitted in the measure's §4. */
export const GENOME = {
  genes: 18251,               // prot_len.txt.gz's genes
  lengthMedian: 449, lengthSd: 0.727,   // prot_len.txt.gz, measured
  rateMedian: 0.0053, rateSd: 0.4,      // fitted: genes at 5+, their count quantiles, length by count, and the count test's 207 calls on the file
  mutabilitySd: 1.0,                    // fitted: the share of genes tested at 5–9, 10–19 and 20–49 mutations
  truncating: 0.15,           // the truncating or splice share in genes with 5–19 mutations
};

function lognormalWeights(rng, L, sd) {
  const cum = new Float64Array(L);
  let s = 0;
  for (let i = 0; i < L; i += 1) { s += Math.exp(sd * normal(rng) - (sd * sd) / 2); cum[i] = s; }
  return cum;
}
function pick(cum, rng) { return pickIn(cum, 1, cum.length, rng); }
/** A residue in [a, b] (1-based), by the cumulative weights. */
function pickIn(cum, a, b, rng) {
  const base = a > 1 ? cum[a - 2] : 0;
  const t = base + rng() * (cum[b - 1] - base);
  let lo = a - 1, hi = b - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
  return lo + 1;
}

/** The passenger genome. Positions are drawn only for genes whose recorded
    count reaches minMut, since no other gene is ever scored. */
function passengerMutations(rng, L, n, genome) {
  const cum = lognormalWeights(rng, L, genome.mutabilitySd);
  const mutations = [];
  for (let i = 0; i < n; i += 1) mutations.push({ pos: pick(cum, rng), cls: rng() < genome.truncating ? "truncating" : "missense" });
  return mutations;
}

/** One passenger of a given length and count, for the one-gene page. */
export function drawPassenger(rng, { L = 749, n = 7, genome = GENOME, name = "passenger" } = {}) {
  return { name, kind: "passenger", L, mutations: passengerMutations(rng, L, n, genome) };
}

/** The passenger genome. Positions are drawn only for genes with at least
    `minKeep` mutations: minMut is 5, and a gene of 3 reaches it only if two of
    its mutations are recorded twice, about 3 in 10,000 at REPEAT_RATE. */
export function drawGenome(rng, { genome = GENOME, minKeep = 3, genes = genome.genes } = {}) {
  const out = [];
  let totalMutations = 0, totalResidues = 0;
  for (let g = 0; g < genes; g += 1) {
    const L = Math.max(30, Math.min(9000, Math.round(genome.lengthMedian * Math.exp(genome.lengthSd * normal(rng)))));
    const rate = genome.rateMedian * Math.exp(genome.rateSd * normal(rng));
    const n = poisson(rng, rate * L);
    totalMutations += n;
    totalResidues += L;
    if (n < minKeep) continue;
    out.push({ name: `passenger ${g + 1}`, kind: "passenger", L, rate, mutations: passengerMutations(rng, L, n, genome) });
  }
  out.totalMutations = totalMutations;
  out.totalResidues = totalResidues;
  return out;
}

/** The same cohort with repeated records: each mutation recorded a second time
    with chance `rate`, on its own stream, so every other draw is unchanged and
    the two record options are one cohort read two ways. */
export function withRepeats(genes, rate, seed) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  let added = 0;
  const out = genes.map((g) => {
    const mutations = [];
    for (const m of g.mutations) { mutations.push(m); if (rng() < rate) { mutations.push({ ...m, repeat: true }); added += 1; } }
    return { ...g, mutations };
  });
  out.totalMutations = genes.totalMutations + added;
  out.totalResidues = genes.totalResidues;
  return out;
}

/** A cohort: the passenger genome and the planted drivers, one seed. */
export function drawCohort(seed, { repeats = 0, genome = GENOME, drivers = Object.keys(SHAPES) } = {}) {
  const rng = mulberry32(seed);
  const genes = drawGenome(rng, { genome });
  for (const name of drivers) {
    const g = drawShaped(SHAPES[name], rng, { name, genome });
    genes.totalMutations += g.mutations.length;
    genes.totalResidues += g.L;
    genes.push(g);
  }
  return repeats > 0 ? withRepeats(genes, repeats, seed) : genes;
}

/* ---- a count test, for the mock's question only ---------------------------
   Not in the notebook, and not maftools' `pvalMethod = "poisson"` (two-sided,
   with the cluster count as a covariate). One-sided: is the gene's count above
   what its length predicts at the cohort's rate per residue? */
export function poissonUpper(k, lambda) {    // P(X >= k)
  if (k <= 0) return 1;
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i < k; i += 1) { term *= lambda / i; cdf += term; }
  if (cdf < 1 - 1e-9) return Math.max(0, 1 - cdf);
  let t = Math.exp(-lambda + k * Math.log(lambda) - lgamma(k + 1)), s = t;
  for (let i = k + 1; i < k + 4000; i += 1) { t *= lambda / i; s += t; if (t < s * 1e-15) break; }
  return s;
}
export function countTest(genes, { rate, minMut = 5 }) {
  const rows = genes.filter((g) => g.mutations.length >= minMut);
  for (const g of rows) { g.expected = rate * g.L; g.countP = poissonUpper(g.mutations.length, g.expected); }
  const f = benjaminiHochberg(rows.map((g) => g.countP));
  rows.forEach((g, i) => { g.countFdr = f[i]; g.countCalled = f[i] <= 0.05; });
  return rows;
}
