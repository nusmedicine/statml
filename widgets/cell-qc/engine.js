/* cell-qc/engine.js — the four-sample single-cell stage, as the widget, its
 * mock and `_lab/cell-qc-measure.mjs` all run it (one engine, three readers,
 * so the numbers on the page are the numbers that were measured).
 *
 * The shape is the lesson's (02-2, two patients × tumour and background
 * liver, filtered at nFeature > 500, nCount > 800, mt% < 10), and the four
 * real samples were read first (`_lab/rnaseq-sc-data.mjs` →
 * `_lab/rnaseq-sc-qc.json`, 40,564 cells). Four things that data said, which
 * the simulation has to be able to reproduce:
 *
 *   1. mt% is a SAMPLE property here, not a cell-type one. Inside
 *      HB17_background every marker group sits at 12–15%, and the other
 *      background liver — same tissue, other patient — sits at 0.1%. So the
 *      stage carries a per-sample mitochondrial offset, and a cell type does
 *      not carry one.
 *   2. Inside the three clean samples mt% falls as the count rises
 *      (r = −0.40 to −0.70): that is the dying cell, which loses cytoplasmic
 *      RNA and keeps its mitochondria. In the hot sample the correlation is
 *      +0.20 and flat across every count decile — a whole sample sitting high
 *      is not that mechanism.
 *   3. nCount and nFeature are the same measurement twice: r = 0.95–0.99 on
 *      the log scale, and 1,199 of the ~1,310 cells either rule removes are
 *      removed by both. Here that falls out rather than being imposed —
 *      nFeature is how many genes are seen when nCount molecules are drawn
 *      from the cell's own profile, so a shallow cell is a low-gene cell.
 *   4. nFeature against nCount is sublinear, about nCount^0.6 over the
 *      lesson's range, which is what that draw gives.
 *
 * A cell is one of four states — a good cell, a dying cell, an empty droplet
 * of ambient RNA, and a doublet of two cells in one droplet — because the
 * three thresholds are a claim about which of those a cell is, and the page
 * can only mark a mistake if the stage knows the answer.
 */

/* The lesson's own six populations and its marker for each (02-2 cell 47). */
export const TYPES = [
  { key: "hepatocyte", name: "Hepatocyte", marker: "CYP3A4", size: 1.55 },
  { key: "tumour", name: "Tumour cell", marker: "DLK1", size: 1.30 },
  { key: "immune", name: "Immune cell", marker: "PTPRC", size: 0.55 },
  { key: "endothelial", name: "Endothelial cell", marker: "FLT1", size: 0.80 },
  { key: "stellate", name: "Stellate cell", marker: "COL6A3", size: 0.85 },
  { key: "kupffer", name: "Kupffer cell", marker: "CD163", size: 0.70 },
];

/* Two patients, tumour and background liver each, in the lesson's order. The
   mixes are the marker detection rates of the four real samples, rounded. */
export const SAMPLES = [
  { key: "p1-liver", name: "Patient 1 · liver", patient: 1, tissue: "liver", depth: 2600, mix: { hepatocyte: 0.62, endothelial: 0.14, immune: 0.10, kupffer: 0.07, stellate: 0.05, tumour: 0.02 } },
  { key: "p1-tumour", name: "Patient 1 · tumour", patient: 1, tissue: "tumour", depth: 5500, mix: { tumour: 0.52, endothelial: 0.16, immune: 0.12, kupffer: 0.09, stellate: 0.06, hepatocyte: 0.05 } },
  { key: "p2-liver", name: "Patient 2 · liver", patient: 2, tissue: "liver", depth: 8300, mix: { hepatocyte: 0.58, endothelial: 0.18, immune: 0.11, kupffer: 0.07, stellate: 0.06, tumour: 0 } },
  { key: "p2-tumour", name: "Patient 2 · tumour", patient: 2, tissue: "tumour", depth: 5900, mix: { tumour: 0.47, immune: 0.20, endothelial: 0.12, kupffer: 0.10, stellate: 0.08, hepatocyte: 0.03 } },
];

export const STATES = ["good", "dying", "empty", "doublet"];

export const DEFAULTS = {
  cells: 400,          // per sample; the real samples hold 8,000–13,000
  hot: "p1-liver",     // the sample whose preparation runs hot, or "none"
  hotMt: 15,           // its median mt%, the real one being 14.8
  cleanMt: 1,          // the others', the lesson's three being 0.1, 0.5 and 0.6
  dying: 0.06,         // share of droplets holding a dying cell
  empty: 0.04,         // share holding ambient RNA and no cell
  doublet: 0.05,       // share holding two cells
};

export const THRESHOLDS = { nFeature: 500, nCount: 800, mt: 10 };  // 02-2 cell 24, Commun Biol 2021 4:1049

/* --- the gene profile ------------------------------------------------------
   nFeature is a consequence of nCount rather than a second draw: drawing n
   molecules from an abundance profile, gene g is seen with probability
   1 − exp(−n·p_g), so the genes seen are a sum of Bernoullis — the mean is
   exact and the spread small, which is the real scatter (r = 0.99 inside a
   sample) with no correlation imposed by hand.

   The profile is a power law over 8,000 genes, p ∝ (g + 80)^−0.97, fitted to
   the lesson's own cells by least squares on the log of the genes seen at ten
   count quantiles of its two cleanest samples: it detects 928 genes at 1,242
   molecules against their 925, 2,699 at 5,495 against 2,906, and 5,742 at
   23,000 against 5,408 — every point within a tenth. The 60 genes a type owns
   are raised fourfold, which is what makes a doublet's profile — two types at
   once — detect more genes than either alone. */
const GENES = 8000;

function profileFor(typeIndex) {
  const p = new Float64Array(GENES);
  let s = 0;
  for (let g = 0; g < GENES; g += 1) {
    const own = g >= 300 + typeIndex * 60 && g < 300 + (typeIndex + 1) * 60;
    const v = (g + 80) ** -0.97 * (own ? 4 : 1);
    p[g] = v; s += v;
  }
  for (let g = 0; g < GENES; g += 1) p[g] /= s;
  return p;
}
const PROFILES = TYPES.map((t, i) => profileFor(i));

/** Genes seen when `n` molecules are drawn from `p`: the mean of the sum of
    Bernoullis, with its own binomial spread added. */
function genesSeen(rng, p, n) {
  let mean = 0, varr = 0;
  for (let g = 0; g < GENES; g += 1) {
    const q = 1 - Math.exp(-n * p[g]);
    mean += q; varr += q * (1 - q);
  }
  return Math.max(1, Math.round(mean + Math.sqrt(varr) * rng.normal()));
}

/* --- the cells -------------------------------------------------------------- */

function pickType(rng, mix) {
  const u = rng.next();
  let acc = 0;
  for (const t of TYPES) { acc += mix[t.key] ?? 0; if (u < acc) return t; }
  return TYPES[0];
}

/** One droplet's three numbers and the truth behind them.

    A droplet holds two kinds of molecule and they are drawn separately, which
    is what makes the three metrics agree with each other the way the real
    ones do. The cytoplasmic RNA varies a great deal from cell to cell (a
    lognormal of width 0.55); the mitochondrial RNA varies less (0.3) and sits
    at the SAMPLE's own level. So mt% = mito / total falls as the count rises
    without that being written anywhere, and a cell type carries no mt% of its
    own — both are what the lesson's cells do. A dying cell has lost most of
    its cytoplasm and none of its mitochondria, so one draw moves its count
    down and its mt% up together. Genes are seen out of the cytoplasmic
    molecules alone plus the 13 mitochondrial ones, which is why a dying cell
    is short of genes at the count it still has.

    The two ways a droplet gets a high mt% are separate here because they are
    separate in the lesson's own samples. A dying cell keeps its mitochondria
    and loses everything else — so its mt% rises as its count falls, which is
    the negative correlation in the three clean samples. Ambient mitochondrial
    RNA, released by the cells that lysed during the preparation, lands in
    every droplet in proportion to what it already holds — so it raises the
    whole sample's mt% and leaves it flat across the counts, which is
    HB17_background (median 14.8%, r = +0.20, 13.5% in the lowest count decile
    and 15.8% in the highest). The lesson's rule cannot tell the two apart:
    that is what `hot` is for. */
function drawCell(rng, sample, opts, mtLevel, ambient) {
  const state = (() => {
    const u = rng.next();
    if (u < opts.empty) return "empty";
    if (u < opts.empty + opts.dying) return "dying";
    if (u < opts.empty + opts.dying + opts.doublet) return "doublet";
    return "good";
  })();

  const type = pickType(rng, sample.mix);
  const scale = sample.depth * type.size;
  let cyto = scale * Math.exp(rng.normal() * 0.55);
  let mito = scale * mtLevel * Math.exp(rng.normal() * 0.3);
  let partner = null;
  let pa = PROFILES[TYPES.indexOf(type)];

  if (state === "dying") {
    /* the membrane has gone and the cytoplasm with it, by a factor between 30
       and 3 — so some dying cells fail every rule and some pass all three */
    cyto *= Math.exp(rng.uniform(Math.log(0.033), Math.log(0.33)));
  } else if (state === "empty") {
    /* no cell: ambient RNA from the cells that lysed in the preparation, at
       a few per cent of one cell's worth, in the sample's pooled profile */
    cyto *= rng.uniform(0.015, 0.07);
    mito *= rng.uniform(0.04, 0.14);
    pa = AMBIENT;
  } else if (state === "doublet") {
    partner = pickType(rng, sample.mix);
    const scale2 = sample.depth * partner.size;
    cyto += scale2 * Math.exp(rng.normal() * 0.55);
    mito += scale2 * mtLevel * Math.exp(rng.normal() * 0.3);
    const pb = PROFILES[TYPES.indexOf(partner)];
    const mixp = new Float64Array(GENES);
    for (let g = 0; g < GENES; g += 1) mixp[g] = 0.5 * (pa[g] + pb[g]);
    pa = mixp;
  }

  /* the sample's ambient mitochondrial RNA, in proportion to what the droplet
     already holds, so it moves no droplet's count relative to another's. How
     much a droplet takes up varies (a lognormal of width 0.33, which is the
     spread of the real hot sample: quartiles 11.5% and 18.5% about a median
     of 14.8%), so some of its cells still pass a 10% rule and most do not. */
  if (ambient > 0) {
    const a = Math.min(0.95, ambient * Math.exp(rng.normal() * 0.33));
    mito += a * (cyto + mito) / (1 - a);
  }

  /* how broadly a cell's own transcripts are spread varies a little from cell
     to cell, which is the scatter about the count-to-gene curve: without it
     nFeature is a function of nCount and the lesson's two count rules would
     remove exactly the same cells rather than 84% the same */
  const breadth = Math.exp(rng.normal() * 0.18);

  const nCount = Math.max(20, Math.round(cyto + mito));
  const nFeature = Math.min(GENES, genesSeen(rng, pa, Math.max(1, cyto * breadth)) + Math.min(13, Math.round(mito / 20)));
  const mt = Math.min(95, Math.max(0.02, 100 * mito / (cyto + mito)));

  return { sample: sample.key, type: type.key, partner: partner ? partner.key : null, state, nCount, nFeature, mt };
}

/* the pooled profile of the sample, which is what an empty droplet holds */
const AMBIENT = (() => {
  const p = new Float64Array(GENES);
  for (let g = 0; g < GENES; g += 1) { let s = 0; for (const q of PROFILES) s += q[g]; p[g] = s / PROFILES.length; }
  return p;
})();

/** The whole stage: four samples of `cells` droplets each. Pure and seeded. */
export function simulate(rng, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const cells = [];
  for (const s of SAMPLES) {
    /* every sample's cells carry their own mitochondria at the same level —
       a median mt% of m means mito is m/(100 − m) of the cytoplasm — and the
       hot sample carries ambient mitochondrial RNA on top, which is what
       takes its median from `cleanMt` to `hotMt` */
    const own = opts.cleanMt / (100 - opts.cleanMt);
    const ambient = s.key === opts.hot ? (opts.hotMt - opts.cleanMt) / 100 : 0;
    for (let i = 0; i < opts.cells; i += 1) cells.push(drawCell(rng, s, opts, own, ambient));
  }
  return { cells, opts };
}

/* --- the filter ------------------------------------------------------------ */

/** Which cells pass, and what each rule removed on its own — the tally the
    notebook never prints (it reports 40,564 → 31,014 and stops). */
export function applyFilters(cells, thr = THRESHOLDS) {
  const keep = cells.map((c) => c.nFeature > thr.nFeature && c.nCount > thr.nCount && c.mt < thr.mt);
  const tally = {};
  for (const s of SAMPLES) tally[s.key] = { n: 0, kept: 0, failFeature: 0, failCount: 0, failMt: 0, failBoth: 0, mtAlone: 0 };
  cells.forEach((c, i) => {
    const t = tally[c.sample];
    t.n += 1;
    if (keep[i]) { t.kept += 1; return; }
    const a = !(c.nFeature > thr.nFeature), b = !(c.nCount > thr.nCount), m = !(c.mt < thr.mt);
    if (a) t.failFeature += 1;
    if (b) t.failCount += 1;
    if (m) t.failMt += 1;
    if (a && b) t.failBoth += 1;
    if (m && !a && !b) t.mtAlone += 1;
  });
  return { keep, tally };
}

/* --- where a droplet lands ---------------------------------------------------
   The map is not decoration and it is not a second draw: a droplet is placed
   by what was actually sequenced in it. Each type owns a block of 60 genes, so
   a droplet's six block fractions are its profile, and they are ESTIMATED from
   the molecules it holds — a binomial draw, whose error goes as 1/sqrt(n). The
   consequences are the ones a real embedding shows and none of them is written
   here: a shallow droplet lands far from its type because its profile was
   measured badly; a doublet lands between the two types it holds; an empty
   droplet lands at the middle, because ambient RNA is every type at once.
   The six blocks are put on a hexagon and the fractions read as weights, which
   is the projection a PCA of six equidistant groups gives. */
const HEX = TYPES.map((t, i) => [Math.cos((Math.PI * 2 * i) / TYPES.length), Math.sin((Math.PI * 2 * i) / TYPES.length)]);

/* How wide a cluster is against how far apart two types are. The 1/sqrt(n) is
   the shape and it is the thing being taught; this constant only sets the
   scale. At 9 a good cell of 10,000 molecules sits 0.09 of the way from its
   type's centre to the next type's, one at the lesson's 800-count threshold
   sits 0.21, a dying cell 0.30, a doublet of two types exactly 0.50 — halfway
   between the two it holds — and an empty droplet 1.05, which is the middle
   of the figure, since ambient RNA is every type at once. */
const SPREAD = 9;

export function embed(rng, cells) {
  return cells.map((c) => {
    /* the droplet's true block fractions: one type, two for a doublet, all six
       for ambient. Outside its own block a type still holds the common genes,
       which is the 0.55 floor the marker block sits on. */
    const w = TYPES.map((t) => (c.state === "empty" ? 1 / TYPES.length : 0.07));
    const i = TYPES.findIndex((t) => t.key === c.type);
    if (c.state !== "empty") {
      w[i] += c.state === "doublet" ? 0.3 : 0.6;
      if (c.partner) w[TYPES.findIndex((t) => t.key === c.partner)] += 0.3;
    }
    const s = w.reduce((a, b) => a + b, 0);
    /* read off n molecules: each block's share is estimated with binomial error */
    const n = Math.max(20, c.nCount);
    let x = 0, y = 0, tot = 0;
    const obs = w.map((v) => {
      const p = v / s;
      return Math.max(0, p + rng.normal() * SPREAD * Math.sqrt((p * (1 - p)) / n));
    });
    obs.forEach((v, k) => { tot += v; x += v * HEX[k][0]; y += v * HEX[k][1]; });
    return { x: x / tot, y: y / tot };
  });
}

/** The filter read as the claim it is: of the droplets it removed, how many
    held a cell worth keeping; of those it kept, how many hold two cells. */
export function confusion(cells, keep) {
  const c = { removedGood: 0, removedBad: 0, keptGood: 0, keptBad: 0, keptDoublet: 0, keptDying: 0, keptEmpty: 0, good: 0 };
  cells.forEach((cell, i) => {
    const good = cell.state === "good";
    if (good) c.good += 1;
    if (keep[i]) {
      if (good) c.keptGood += 1; else c.keptBad += 1;
      if (cell.state === "doublet") c.keptDoublet += 1;
      if (cell.state === "dying") c.keptDying += 1;
      if (cell.state === "empty") c.keptEmpty += 1;
    } else if (good) c.removedGood += 1; else c.removedBad += 1;
  });
  return c;
}

export const median = (a) => {
  const s = Float64Array.from(a).sort();
  const m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN;
};
