/* ============================================================================
   Widget 69 · Cancer Driver Genes — the engine, the stage and the copy.
   `main.js` draws them; `_lab/driver-genes-model.js` re-exports this file, so
   the mock and `_lab/driver-genes-measure.mjs` cannot drift from what the
   widget runs.

   PHM5003 07 / 01-3 cells 12–25. Two pages, from Kenneth's picks of
   2026-09-17 (catalogue § Slot 69, *MEASURED, MOCKED AND PICKED*):

     One gene     cell 12's five steps on one simulated gene, after its
                  mutations are added: significant residues, clusters, each
                  cluster's score, the gene's score, and its significance
     The cohort   cell 18's plot over a simulated cohort, with each gene's kind
                  known to the simulation

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE ENGINE IS MAFTOOLS', NOT THE PAPER'S. `oncodrive` from maftools
       2.26.0, ported line for line with its quirks (below), and checked
       against maftools on all 4,655 genes of the lesson's MAF
       (`_lab/driver-genes-measure.mjs`) and on 360 synthetic genes that reach
       every branch (`_lab/driver-genes-verify.mjs`, against
       `_lab/driver-genes-reference.tsv`).

    2. THE PAGE IS A DISPLAY PARAMETER, as widget 67's is: one `compute()`
       builds both pages, so a visit to the cohort does not undo the steps
       taken on page 1 (3.2, invariant 3).

    3. PAGE 1'S GENES ARE PAGE 2'S. The oncogene, the tumor suppressor and the
       small oncogene are the cohort's PIK3CA-, TP53- and AKT1-shaped drivers
       at the same seed, so a gene taken through the steps on page 1 is a point
       on page 2, and page 2 names those three the way page 1 does.

    4. EACH MUTATION ONCE PER TUMOR, his pick 1. The lesson's MAF repeats
       records (catalogue finding 10); that is his notebook's to fix, and it is
       no control here.

    5. PAGE 2 OPENS WITH EACH GENE'S KIND COLOURED, his call on the draft
       (2026-09-18). The draft opened on the calls alone, arguing 2.1 — the kind
       is the answer — and he turned the colours on: the page is where the
       missed tumor suppressors are seen, and they are seen at once. The kinds
       stay a display control, so cell 18's uncoloured plot is one press away.
       The axis opens on the fraction in clusters, with the score one press
       away (his pick 4).

    6. THE COHORT IS CACHED BY SEED. It is 18,251 genes, and core reruns
       `compute()` on a display change too, so drawing it again for every
       toggle would stall the page for no change of data. `compute()` stays
       pure: the cache is keyed on the one parameter the cohort reads.

    7. PAGE 1 HAS NO PLAY, his call on the draft (2026-09-18), measured before
       it was taken: each step puts 12 to 80 words on screen that were not there
       before, and Play gave each 1.1 s. Nothing moves between the steps — the
       arrival is the one animation, and Step plays all of it — and the lower
       panel is replaced twice on the way, so Play discarded a panel a second
       after drawing it. `runLabel: null` in main.js; the step button then has
       the row to itself, which its two longest labels need.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { lgamma } from "../core/stats.js";
import { benjaminiHochberg } from "../enrichment/model.js";

export { benjaminiHochberg };

/* ---- the engine: maftools' oncodrive ---------------------------------------
   The quirks are kept, because a port that tidies them can only be checked
   against the genes the quirks never touch:
     · the residue threshold is a POINT probability, dbinom(x) < 0.01;
     · a residue below the threshold inside a cluster's core is scored but not
       added to its N, and one within 5 of two clusters is added to both;
     · when residues tie for a cluster's peak, R recycles the peaks along the
       residues in row order (`abs(posVector - peak)`), so `residues` keeps
       maftools' order: the order each residue first appears among the gene's
       mutations. On the lesson's MAF this touches 3 genes and no call. */

export const MIN_MUT = 5;       // oncodrive(minMut = 5), cell 15
export const P_RESIDUE = 0.01;  // get_threshold's cutoff
export const MERGE = 5;         // cluster_prot's mergeDist
export const WIDEN = 5;         // how far a cluster extends onto residues below the threshold
export const FDR_LINE = 0.05;   // cell 16's filter and cell 18's fdrCutOff
export const BACKGROUND = { mean: 0.279, sd: 0.13 };   // the values cell 15 used

const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

/** R's dbinom for a whole-number x. */
export function dbinom(x, n, p) {
  if (x < 0 || x > n) return 0;
  return Math.exp(lchoose(n, x) + x * Math.log(p) + (n - x) * Math.log1p(-p));
}

/** get_threshold: the smallest x ≥ 2 with dbinom(x, total, 1/protLen) < 0.01.
    NaN where none is, as R's NA, which makes no residue meaningful. */
export function threshold(total, protLen) {
  if (total < 2) return 2;                        // R's 2:1 is c(2, 1); dbinom(2, 1, p) is 0
  for (let x = 2; x <= total; x += 1) if (dbinom(x, total, 1 / protLen) < P_RESIDUE) return x;
  return NaN;
}

/** cluster_prot for one gene.
 *  residues: [{ pos, N }] in maftools' row order; th from `threshold`;
 *  placed: the gene's mutations that have a residue.
 *  Returns null where no residue reaches th: maftools returns NULL and the
 *  gene is not in the table at all. */
export function clusterGene(residues, th, placed, { mergeDist = MERGE, widen = WIDEN } = {}) {
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
    c.coreStart = c.start;
    c.coreEnd = c.end;
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

function erfc(x) { // Numerical Recipes erfcc, fractional error below 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
/** 1 − pnorm(z), which is how oncodrive writes the p-value. */
export const upperTail = (z) => 0.5 * erfc(z / Math.SQRT2);
export const zOf = (score) => (score - BACKGROUND.mean) / BACKGROUND.sd;

/** Counts per residue in first-appearance order, as data.table's `.N` by pos. */
export function residuesOf(mutations) {
  const at = new Map();
  for (const m of mutations) at.set(m.pos, (at.get(m.pos) || 0) + 1);
  return [...at].map(([pos, N]) => ({ pos, N }));
}

/** oncodrive on one simulated gene. A simulated gene has no splice sites, so
    its total and its placed mutations are one number. */
export function scoreGene(gene) {
  const n = gene.mutations.length;
  if (n < MIN_MUT) return { n, th: NaN, res: null };
  const th = threshold(n, gene.L);
  return { n, th, res: clusterGene(residuesOf(gene.mutations), th, n) };
}

/** oncodrive over a cohort: the table holds the genes that return a cluster,
    each with its z, p and Benjamini-Hochberg FDR over the table's rows. */
export function oncodriveTable(genes) {
  const rows = [];
  for (const g of genes) {
    const s = scoreGene(g);
    Object.assign(g, { n: s.n, th: s.th, res: s.res, tested: Boolean(s.res) });
    if (!s.res) continue;
    g.score = s.res.score;
    g.fraction = s.res.inClusters / s.n;
    g.clusters = s.res.count;
    g.z = zOf(g.score);
    g.p = upperTail(g.z);
    rows.push(g);
  }
  const q = benjaminiHochberg(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.fdr = q[i]; r.called = q[i] <= FDR_LINE; });
  return rows;
}

/* ---- the stage: simulated, and shaped by the lesson's MAF ------------------
   Every number below is measured or fitted in `_lab/driver-genes-measure.mjs`
   §3–§6 on the file counted once per tumor, and asserted there. */

export function poisson(rng, lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 60) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * rng.normal()));
  const floor = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k += 1; p *= rng.next(); } while (p > floor);
  return k - 1;
}

/** Cumulative residue weights, lognormal with mean 1. */
function mutability(rng, L, sd) {
  const cum = new Float64Array(L);
  let s = 0;
  for (let i = 0; i < L; i += 1) { s += Math.exp(sd * rng.normal() - (sd * sd) / 2); cum[i] = s; }
  return cum;
}
/** A residue in [a, b], 1-based, by the cumulative weights. */
function pickIn(cum, a, b, rng) {
  const base = a > 1 ? cum[a - 2] : 0;
  const t = base + rng.next() * (cum[b - 1] - base);
  let lo = a - 1, hi = b - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
  return lo + 1;
}

/* The drivers. A hotspot is [residue, count, class], counted in 01-3's file
   once per tumor; the rest of a gene's mutations are drawn by class over its
   regions, on residues of unequal mutability, the passengers' own. Without
   that mutability MAP3K1's shape scored 0.08 against its gene's 0.25. */
export const SHAPES = {
  PIK3CA: { kind: "oncogene", L: 1068, n: 359, truncating: 0,
    hotspots: [[1047, 131, "missense"], [545, 70, "missense"], [542, 42, "missense"], [345, 19, "missense"], [546, 11, "missense"],
      [726, 8, "missense"], [453, 7, "missense"], [111, 5, "missense"], [118, 5, "missense"], [420, 4, "missense"]] },
  AKT1: { kind: "oncogene", L: 480, n: 26, truncating: 0, hotspots: [[17, 24, "missense"]] },
  KRAS: { kind: "oncogene", L: 189, n: 6, truncating: 0, hotspots: [[12, 5, "missense"]] },
  TP53: { kind: "suppressor", L: 393, n: 313, truncating: 0.4, truncRegion: [40, 360], missRegion: [102, 292],
    hotspots: [[273, 20, "missense"], [175, 19, "missense"], [220, 10, "missense"], [342, 10, "truncating"], [193, 9, "missense"],
      [248, 8, "missense"], [196, 8, "truncating"], [179, 7, "missense"], [176, 6, "missense"], [213, 6, "truncating"]] },
  CDH1: { kind: "suppressor", L: 882, n: 117, truncating: 0.87,
    hotspots: [[23, 8, "truncating"], [63, 4, "truncating"], [127, 4, "truncating"], [243, 3, "truncating"]] },
  GATA3: { kind: "suppressor", L: 444, n: 104, truncating: 0.9, truncRegion: [260, 444], missRegion: [260, 444],
    hotspots: [[408, 13, "truncating"], [335, 11, "truncating"], [330, 4, "truncating"], [293, 4, "truncating"], [426, 4, "truncating"],
      [436, 3, "truncating"], [364, 3, "truncating"], [329, 3, "truncating"], [444, 3, "truncating"]] },
  MAP3K1: { kind: "suppressor", L: 1512, n: 115, truncating: 0.76, hotspots: [] },
  PTEN: { kind: "suppressor", L: 403, n: 51, truncating: 0.65,
    hotspots: [[130, 6, "missense"], [124, 2, "missense"], [73, 2, "truncating"], [48, 2, "truncating"], [319, 2, "truncating"],
      [16, 2, "truncating"], [267, 2, "truncating"], [287, 2, "truncating"]] },
  NF1: { kind: "suppressor", L: 2839, n: 33, truncating: 0.6, hotspots: [] },
};
export const DRIVERS = Object.keys(SHAPES);

/* The passengers: a genome of prot_len's gene count, whose lengths, rates and
   residue mutability are fitted to the file counted once — genes at 5+ (4,566),
   their count quantiles, length by count, the share tested by count, and the
   207 genes a count test calls on the file. */
export const GENOME = {
  genes: 18251,
  lengthMedian: 449, lengthSd: 0.727,
  rateMedian: 0.0053, rateSd: 0.4,
  mutabilitySd: 1.0,
  truncating: 0.15,
};

/** One gene of a shape. */
export function drawShaped(shape, rng, { n = shape.n, name = "", genome = GENOME } = {}) {
  const hot = shape.hotspots ?? [];
  const hotShare = hot.reduce((s, h) => s + h[1], 0) / shape.n;
  const cum = mutability(rng, shape.L, genome.mutabilitySd);
  const mutations = [];
  for (let i = 0; i < n; i += 1) {
    const u = rng.next();
    if (u < hotShare) {
      let v = u * shape.n, k = 0;
      while (k < hot.length - 1 && v >= hot[k][1]) { v -= hot[k][1]; k += 1; }
      mutations.push({ pos: hot[k][0], cls: hot[k][2] });
    } else {
      const trunc = rng.next() < shape.truncating;
      const [a, b] = (trunc ? shape.truncRegion : shape.missRegion) ?? [1, shape.L];
      mutations.push({ pos: pickIn(cum, a, b, rng), cls: trunc ? "truncating" : "missense" });
    }
  }
  return { name, kind: shape.kind, L: shape.L, mutations };
}

function passengerMutations(rng, L, n, genome) {
  const cum = mutability(rng, L, genome.mutabilitySd);
  const mutations = [];
  for (let i = 0; i < n; i += 1) {
    mutations.push({ pos: pickIn(cum, 1, L, rng), cls: rng.next() < genome.truncating ? "truncating" : "missense" });
  }
  return mutations;
}

/** One passenger of a given length and count. */
export function drawPassenger(rng, { L, n, genome = GENOME, name = "passenger" }) {
  return { name, kind: "passenger", L, mutations: passengerMutations(rng, L, n, genome) };
}

/** The passenger genome. Residues are drawn only for genes with at least
    `minKeep` mutations, the fewest that can ever be scored with records
    repeated at the lab's rate (a gene of 3 reaches 5 in about 3 of 10,000). */
export function drawGenome(rng, { genome = GENOME, minKeep = 3, genes = genome.genes } = {}) {
  const out = [];
  let totalMutations = 0, totalResidues = 0;
  for (let g = 0; g < genes; g += 1) {
    const L = Math.max(30, Math.min(9000, Math.round(genome.lengthMedian * Math.exp(genome.lengthSd * rng.normal()))));
    const rate = genome.rateMedian * Math.exp(genome.rateSd * rng.normal());
    const n = poisson(rng, rate * L);
    totalMutations += n;
    totalResidues += L;
    if (n < minKeep) continue;
    out.push({ name: `passenger ${g + 1}`, kind: "passenger", L, mutations: passengerMutations(rng, L, n, genome) });
  }
  out.totalMutations = totalMutations;
  out.totalResidues = totalResidues;
  return out;
}

/** A cohort: the passenger genome, then the nine drivers, on one seed. */
export function drawCohort(seed, { genome = GENOME, drivers = DRIVERS } = {}) {
  const rng = makeRng(seed);
  const genes = drawGenome(rng, { genome });
  for (const name of drivers) {
    const g = drawShaped(SHAPES[name], rng, { name, genome });
    genes.totalMutations += g.mutations.length;
    genes.totalResidues += g.L;
    genes.push(g);
  }
  return genes;
}

/* Decision 6. Keyed on the seed alone, and bounded, since a reader dragging the
   seed slider would otherwise keep every cohort they passed. */
const cohorts = new Map();
export function cohortFor(seed) {
  if (cohorts.has(seed)) return cohorts.get(seed);
  const genes = drawCohort(seed);
  /* Every gene carries the place it was drawn at, because the list names the
     ones page 1 does not by their number and the drivers have no number of
     their own (the page invents no gene symbols). */
  genes.forEach((g, i) => { g.index = i + 1; });
  const table = oncodriveTable(genes);
  const atMin = genes.filter((g) => g.mutations.length >= MIN_MUT);
  /* The order the build walks, worked out once with the cohort: the list is
     printed by p, as the table is, and the column of marks beside it is every
     candidate by its mutation count, so the rows the reader can read sit among
     marks in an order they can see. */
  const byP = [...table].sort((a, b) => a.p - b.p);
  const untested = atMin.filter((g) => !g.tested);
  const value = {
    seed,
    genes,
    table,
    byP,
    rank: new Map(byP.map((g, i) => [g, i])),
    order: [...atMin].sort((a, b) => b.mutations.length - a.mutations.length),
    rows: [...byP.slice(0, 8), ...[...untested].sort((a, b) => b.mutations.length - a.mutations.length).slice(0, 4)]
      .sort((a, b) => b.mutations.length - a.mutations.length),
    atMin: atMin.length,
    untested,
    byName: Object.fromEntries(genes.filter((g) => g.kind !== "passenger").map((g) => [g.name, g])),
  };
  if (cohorts.size >= 6) cohorts.delete(cohorts.keys().next().value);
  cohorts.set(seed, value);
  return value;
}

/* ---- page 1's genes ------------------------------------------------------- */

export const KINDS = [
  { value: "oncogene", label: "Oncogene", shape: "PIK3CA" },
  { value: "suppressor", label: "Tumor suppressor", shape: "TP53" },
  { value: "small", label: "Small oncogene", shape: "AKT1" },
  { value: "passenger", label: "Passenger" },
];
export const kindOf = (key) => KINDS.find((k) => k.value === key) ?? KINDS[0];

/* The passenger is a typical gene with 7 mutations — the file's median count
   at 5 or more, on 749 residues, the median length at 5 to 9 — drawn on its
   own stream, so the seed that draws the cohort draws it too. */
export const PASSENGER = { L: 749, n: 7 };
const passengerSeed = (seed) => 100000 + seed;

/** Everything page 1 draws about one gene, from the gene alone. */
export function analyse(gene) {
  const { n, th, res } = scoreGene(gene);
  const tally = new Map();
  for (const m of gene.mutations) {
    const e = tally.get(m.pos) ?? { pos: m.pos, n: 0, missense: 0, truncating: 0 };
    e.n += 1;
    e[m.cls] += 1;
    tally.set(m.pos, e);
  }
  /* The close-up follows the cluster with the most residues hit, then the most
     mutations, because that is where the √2 discount has neighbours to act on. */
  const focus = res ? [...res.clusters].sort((a, b) => (b.parts.length - a.parts.length) || (b.N - a.N))[0] : null;
  const maxN = Math.max(...[...tally.values()].map((e) => e.n));
  return {
    gene, n, th, res, focus,
    residues: [...tally.values()].sort((a, b) => a.pos - b.pos),
    maxN,
    /* The stems' scale reaches the threshold too. A passenger whose residues
       are each hit once has a threshold of 2 above every stem, and a scale
       topped at its tallest stem drew that line off the canvas (the verify's
       extent sweep, 2026-09-18); the gap between the line and the stems is
       what the step shows. */
    scaleTop: Number.isFinite(th) ? Math.max(maxN, th) : maxN,
    z: res ? zOf(res.score) : NaN,
    p: res ? upperTail(zOf(res.score)) : NaN,
  };
}

export function geneFor(kind, seed) {
  const k = kindOf(kind);
  if (k.shape) return cohortFor(seed).byName[k.shape];
  return drawPassenger(makeRng(passengerSeed(seed)), { ...PASSENGER });
}

/** The arrivals shown so far: the first k mutations, tallied by residue. */
export function tallyOf(mutations, k) {
  const at = new Map();
  for (let i = 0; i < Math.min(k, mutations.length); i += 1) {
    const m = mutations[i];
    const e = at.get(m.pos) ?? { pos: m.pos, n: 0, missense: 0, truncating: 0 };
    e.n += 1;
    e[m.cls] += 1;
    at.set(m.pos, e);
  }
  return [...at.values()];
}

/* ---- page 2's marks --------------------------------------------------------
   Where each gene is drawn, in one place, so the drawing and the verify's
   overlap check read the same geometry (5.8). `sx` and `sy` are core's plot
   scales. */
export const RING = 3;   // a call's ring, this far outside its point
export const markRadius = (g) => 2 + 1.3 * Math.sqrt(g.clusters);
/* THE SCALE REACHES THE UNCORRECTED p, not just the FDR, because the build
   below raises every gene to -log10 p before Benjamini-Hochberg pulls it down
   (COHORT_STEPS). One scale for the whole walk: the ticks stay where they are
   and what the reader sees move is the correction, not the frame. */
export const cohortTop = (table) => Math.max(6, Math.ceil(Math.max(...table.map((g) => -Math.log10(g.p)))));
export function cohortMarks(table, sx, sy, mix, stage = COHORT_STAGES) {
  const up = (g) => (stage >= COHORT_CORRECT ? -Math.log10(g.fdr) : -Math.log10(g.p));
  return table.map((g) => ({ g, x: sx(lerp(g.fraction, g.score, mix)), y: sy(up(g)), r: markRadius(g) }));
}

/** The three genes page 1 walks, named on page 2 as page 1 names them. */
export const namedGenes = (cohort) => KINDS.filter((k) => k.shape)
  .map((k) => ({ text: k.label, g: cohort.byName[k.shape] }))
  .filter(({ g }) => g.tested);

/* A NAME GOES WHERE ITS BOX IS CLEAR OF EVERY POINT, EVERY RING AND EVERY NAME
   ALREADY PLACED: beside the point, then above or below it, then further out
   with a leader line. It checked only other names until 2026-09-18, and
   "Oncogene" printed through the ring of the called passenger beside it
   (Kenneth: "fix the oncogene label overlap"). Where no candidate is clear, the
   one over the fewest points, nearest first. */
export function labelPlacements(marks, names, box, measure) {
  const discs = marks.map((m) => ({ x: m.x, y: m.y, r: m.r + (m.g.called ? RING + 1.5 : 1.5) }));
  const clearOf = (b, d) => {
    const cx = Math.max(b.x, Math.min(d.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(d.y, b.y + b.h));
    return (d.x - cx) ** 2 + (d.y - cy) ** 2 >= d.r ** 2;
  };
  const items = names
    .map(({ text, g }) => ({ text, mark: marks.find((m) => m.g === g) }))
    .filter((it) => it.mark)
    .sort((p, q) => p.mark.y - q.mark.y);
  const placed = [];
  const out = [];
  for (const { text, mark } of items) {
    const w = measure(text);
    const reach = mark.r + (mark.g.called ? RING : 0) + 5;
    const cands = [
      [mark.x - reach - w, mark.y + 4, false],
      [mark.x + reach, mark.y + 4, false],
      [mark.x - w / 2, mark.y - reach - 2, false],
      [mark.x - w / 2, mark.y + reach + 11, false],
    ];
    /* Further out, with a leader. The reach grew on 2026-09-18: the scale now
       climbs to the uncorrected p, which packs the cloud into the bottom of the
       plot, and at 535px a name could no longer find a gap within 62px. */
    for (const dy of [-20, 20, -34, 34, -48, 48, -62, 62, -78, 78, -96, 96]) {
      for (const dx of [8, 30]) {
        cands.push([mark.x - reach - dx - w, mark.y + 4 + dy, true], [mark.x + reach + dx, mark.y + 4 + dy, true]);
      }
    }
    let best = null;
    cands.forEach(([lx, ly, leader], order) => {
      const b = { x: lx - 2, y: ly - 11, w: w + 4, h: 14 };
      const outside = b.x < box.x || b.x + b.w > box.x + box.w || b.y < box.y || b.y + b.h > box.y + box.h;
      const overNames = placed.filter((p) => p.x < b.x + b.w && b.x < p.x + p.w && p.y < b.y + b.h && b.y < p.y + p.h).length;
      const overPoints = discs.filter((d) => !clearOf(b, d)).length;
      const cost = (outside ? 1e6 : 0) + overNames * 1e4 + overPoints * 100 + order;
      if (!best || cost < best.cost) best = { text, lx, ly, w, leader, box: b, cost, outside, overNames, overPoints, mark };
    });
    placed.push(best.box);
    out.push(best);
  }
  return out;
}

/* ---- page 2's build --------------------------------------------------------
   His call of 2026-09-18, from `_lab/driver-genes-tween-mock.html`: the page
   was a finished figure, and the walk that makes it is the one place in the
   widget where a number is CORRECTED rather than computed. Five presses:

     1  the genes with no cluster fall away, leaving the table
     2  each row takes its place across, the fraction in clusters or the score
     3  each rises to -log10 p
     4  Benjamini-Hochberg pulls it down BY ITS RANK: the smallest p is
        multiplied by every row, the largest by one
     5  the line at FDR 0.05, the calls, and the kinds

   The plot takes the width the list gives up, so the last frame is the
   full-width figure the page drew before the walk existed. */
export const COHORT_STAGES = 5;
export const COHORT_ACROSS = 2;    // the stage the points reach the plot
export const COHORT_UP = 3;        // -log10 p
export const COHORT_CORRECT = 4;   // -log10 FDR
export const COHORT_MS = 900;      // one press, whatever it moves
export const GHOST = 0.16;         // where each gene was before the correction

/** The name the list prints. The three genes page 1 walks are named as page 1
    names them (decision 3); the rest carry the number the simulation drew them
    at, because the page invents no gene symbols. */
export function listName(cohort, g) {
  const k = KINDS.find((kind) => kind.shape && cohort.byName[kind.shape] === g);
  return k ? k.label : `gene ${g.index}`;
}

const streamY = (list, i, n) => list.y + 26 + ((i + 0.5) / n) * (list.h - 40);

/** Where every candidate gene sits at the end of `stage`, in pixels: in the
    list, or in whatever rectangle the plot is at this frame. */
export function buildPlaces(cohort, list, rect, mix, stage) {
  const top = cohortTop(cohort.table);
  const sx = (v) => rect.x + v * rect.w;
  const sy = (v) => rect.y + rect.h - (v / top) * rect.h;
  const n = cohort.order.length;
  return cohort.order.map((g, i) => {
    if (stage <= 0) return { g, x: list.x + 8, y: streamY(list, i, n), r: 1.6, a: 1 };
    if (!g.tested) return { g, x: list.x + 8, y: streamY(list, i, n), r: 1.6, a: 0 };
    if (stage === 1) return { g, x: list.x + 8, y: streamY(list, cohort.rank.get(g), cohort.table.length), r: 1.6, a: 1 };
    const up = stage < COHORT_UP ? 0 : stage < COHORT_CORRECT ? -Math.log10(g.p) : -Math.log10(g.fdr);
    return { g, x: sx(lerp(g.fraction, g.score, mix)), y: sy(up), r: markRadius(g), a: 1 };
  });
}

/* ---- the steps ------------------------------------------------------------ */

/* Stage 0 is the empty protein; stage 1 has the mutations; stages 2 to 6 are
   cell 12's five steps, under its own headings. A gene with no residue at its
   threshold ends at stage 2: it has no cluster, so it is not in the table. */
export const STAGES = 6;
export const lastStage = (a) => (a.res ? STAGES : 2);
/** The stage the drive button's label is read at (see STRINGS.stepLabels).
    Page 2 keys the same map with `c0`…`c4`, so one button names the next step
    of whichever page is on screen. */
export function labelStage(anim) {
  if (anim.page === "cohort") {
    const at = anim.done ? Math.max(0, anim.cohort - 1) : anim.cohort;
    return `c${Math.min(at, COHORT_STAGES - 1)}`;
  }
  return anim.done ? Math.max(0, anim.stage - 1) : anim.stage;
}
export const LAND_MS = 1200;   // the mutations arrive over this long, whatever their number
export const EASE_MS = 420;
/* THE TWO STEPS OF PAGE 1 THAT MOVE. A step that only reveals lands at once;
   these two carry a panel from one place to another, and a reader shown the
   destination with no journey is told the two panels are related rather than
   seeing it (his call, 2026-09-18):
     2  the close-up grows out of the locator box on the protein
     6  the gene's score walks from the end of its bar onto the background */
export const TWEENED = new Set([2, 6]);
export const TWEEN_MS = 520;
/** A camera move eases at both ends. `easeOut` leaves at full speed, which is
    right for something that falls into place (4.3) and wrong for a window
    travelling between two places: read at 45% of its time, an easeOut zoom is
    already 83% of the way there. */
export const easeInOut = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
};
export const lerpRect = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t),
});
export const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---- layout --------------------------------------------------------------- */

/* The height never reads the width. A page whose height moved with the canvas
   width between 535 and 770px never settled under the harness's scrollbar
   (widget 62, 2026-09-16), so each page has one height and the drawing spreads
   across whatever width it is given. */
export const GENE_H = 452;
export const COHORT_H = 470;

export function layout(w, params) {
  const x0 = 56, x1 = w - 18;
  if (params.page === "cohort") {
    /* Two rectangles for one plot: the one it has while the list is on screen,
       and the one it grows into when the list is gone. The list is half the
       canvas, capped: four columns and a gene's name need 250px of it, and at
       0.42 of a 550px canvas "mutations" and "clusters" printed into each
       other. */
    const plot = { x: 64, y: 40, w: w - 64 - 20, h: COHORT_H - 40 - 102 };
    const list = { x: 16, y: 40, w: Math.min(320, Math.round(w * 0.5)), h: plot.h };
    const narrow = { x: list.x + list.w + 42, y: plot.y, w: w - (list.x + list.w + 42) - 20, h: plot.h };
    return { page: "cohort", plot, narrow, list, height: COHORT_H };
  }
  return {
    page: "gene",
    x0, x1,
    protein: { top: 50, base: 170 },     // stems between these
    lower: { top: 262 },                  // the close-up, the gene's score or the background
    height: GENE_H,
  };
}
export const stageHeight = (w, values) => layout(w, values).height;

/* ---- numbers ---------------------------------------------------------------- */

export const n2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
export const n3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
export const part3 = (x) => x.toFixed(3).replace(/^0\./, ".");
export const intText = (x) => Math.round(x).toLocaleString("en-US");
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function pText(p) {
  if (!Number.isFinite(p)) return "—";
  if (p >= 0.001) return p.toFixed(3);
  const e = Math.floor(Math.log10(p));
  return `${(p / 10 ** e).toFixed(1)} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
}
/** A binomial point probability for the threshold row: four places while
    they carry a digit, then powers of ten, where 7 mutations on 749 residues
    printed P(X = 2) = 0.0000. */
export const probText = (p) => (p >= 0.0001 ? p.toFixed(4) : pText(p));

/* ---- copy ------------------------------------------------------------------ */

export const PAGES = [
  { value: "gene", label: "One gene" },
  { value: "cohort", label: "The cohort" },
];
export const ACROSS = [
  { value: "fraction", label: "Fraction in clusters" },
  { value: "score", label: "Score" },
];

export const STRINGS = {
  subtitle: "Gain-of-function mutations in an oncogene are found at a few residues that activate the protein, "
    + "and loss-of-function mutations in a tumor suppressor anywhere along it. OncodriveCLUST scores the share "
    + "of a gene's mutations in positional clusters against a fixed background, so it detects the first pattern "
    + "and not the second, and the score does not depend on how many mutations a gene has.",

  pageLabel: "Page",
  pageDetail: "one gene through the five steps, or every gene in a cohort",
  geneSection: "The gene",
  geneLabel: "Gene",
  geneDetail: "simulated with the length, count and hotspot residues of PIK3CA, TP53 or AKT1 in a breast cancer "
    + "cohort, or as a gene with 7 mutations on 749 residues",
  lookSection: "How to read it",
  acrossLabel: "Across",
  acrossDetail: "the fraction of a gene's mutations in clusters, or the score its p-value is computed from",
  kindsLabel: "Colour by kind",
  kindsDetail: "the kind each gene was given in the simulation",
  dataSection: "The data",
  seedLabel: "Seed",
  seedDetail: "draws different mutations and a different cohort",

  /* Keyed on `anim.labelAt`: the stage the next press starts from, or, once
     the analysis is done, the stage the last press started from. A finished
     gene's disabled button then names the step it ended on, where the stage
     alone had it offer "Form clusters" to a gene with no cluster, or the first
     step again to a gene that had taken all five. */
  stepLabels: {
    0: "Add the mutations",
    1: "Identify significant residues",
    2: "Form clusters",
    3: "Score each cluster",
    4: "Score the gene",
    5: "Test against the background",
  },
  /* Page 2's five, keyed `c0`…`c4` on the same counter. The second names the
     quantity the Across control is set to, since that is what the press does. */
  cohortLabels: {
    c0: "Drop the genes with no cluster",
    c1: { param: "across", labels: { fraction: "Place each by its fraction", score: "Place each by its score" },
      default: "Place each by its fraction" },
    c2: "Raise each by its p-value",
    c3: "Correct for every gene tested",
    c4: "Call the genes at FDR 0.05",
  },
  stepTitle: "Take the next step of the analysis",

  proteinCaption: "The protein",
  closeCaption: (a, b) => `Residues ${a}–${b}`,
  geneScoreCaption: "The gene's score: its cluster scores added",
  backgroundCaption: "The score against the background",
  cohortCaption: "Genes in the table",
  candidateCaption: "Genes with 5 or more mutations",
  listGene: "gene",
  listMutations: "mutations",
  listClusters: "clusters",
  listScore: "score",
  listNone: "none",
  listRows: (n) => `${n} rows`,
  axisP: "−log₁₀ p",
  ghostNote: "where each gene was before the correction",
  threshold: (th) => `threshold ${th}`,
  clusterSpan: (a, b) => `cluster ${a}–${b}`,
  peak: "peak",
  distance: "distance",
  part: "part",
  noCluster: (th, n, L) => `No residue has ${th} mutations, the threshold for ${n} mutations on ${L} residues.`,
  notTested: "The gene returns no cluster, so it is not in the table and not tested.",
  fdrLine: "FDR 0.05",
  axisFraction: "Fraction of mutations in clusters",
  axisScore: "Score",
  axisFdr: "−log₁₀ FDR",
  backgroundNote: "a normal curve with mean 0.279 and sd 0.13",
  /* Two lines: as one, it measured past a 535px canvas, the harness's width. */
  notInTable: (out, of) => `Not in the table: ${out} of ${of} genes with 5 or more mutations`,
  notInTableWhy: "Each has no residue at its threshold, so it is not tested.",
  driversNotInTable: (k) => `${k} of the tumor suppressors among them`,

  labelThreshold: "threshold",
  labelCluster: "cluster score",
  labelGene: "gene score",
  labelFdr: "FDR",
  noteGene: "n is the gene's mutations and L its residues, nᵢ the mutations at residue i and dᵢ its distance "
    + "from the cluster's peak. Residues at the threshold fewer than 5 apart form one cluster, which extends "
    + "up to 5 residues onto residues below it. The background mean and sd are fixed values, not estimated "
    + "from the cohort.",
  noteCohort: "Genes are ranked by p, and m counts only genes with a cluster: a gene with no residue at its "
    + "threshold is not in the table and is not tested.",
};
