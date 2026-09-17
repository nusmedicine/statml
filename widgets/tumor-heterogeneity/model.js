/* ============================================================================
   Widget 67 · Tumor Heterogeneity — the stage, the arithmetic and the copy.
   `main.js` draws them; `_lab/vaf-model.js` re-exports this file so the mock
   and `_lab/vaf-measure.mjs` cannot drift from what the widget runs.

   PHM5003 07 / 01-2 cells 17–25. Three pages, from Kenneth's picks of
   2026-09-16 (catalogue § *The cancer mutation arc*, slot 67):

     One mutation          a sample of cells, the reads drawn from it, and the
                           other arrangements that read the same VAF
     Many mutations        one tumour's mutations on the VAF axis or the
                           cancer cell fraction axis, with the clusters a
                           Gaussian mixture returns
     Clonal architecture   his RETCHER figure: four samples, three clusters,
                           and which trees their fractions allow

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE PAGE IS A DISPLAY PARAMETER, as widget 56's is: one `compute()`
       builds all three pages, so a visit to the clusters and back does not
       throw away the reads the reader has been adding (3.2, invariant 3).

    2. THE READS ARE THE ANIMATION, and only on page 1. Pages 2 and 3 land
       finished, so `anim.inert` takes Step and Play out of the row there
       (4.5, widget 56's Many SNPs page).

    3. SIXTY CELLS, because purity is a proportion. Ten cells cannot draw 0.35
       or 0.75, and his figure's four cannot draw 0.70 (mock § 1).

    4. PAGE 1 ASKS THE LESSON'S OWN QUESTION, and how much the analysis is
       told is a control. Cell 25 §3 fits c and m with p and Cₜ given, and cell
       24 — "Refining Estimates (Optional)" — treats those two as information
       you bring. So the panel lists the scenarios a reading leaves standing at
       the reader's level of knowledge, and marks the cell they actually built.
       It asked which SINGLE cause could explain the reading until 2026-09-16;
       `_lab/vaf-rows-measure.mjs` carries that version and the catalogue says
       why it went.

    5. THE MIXTURE IS FITTED ON THE VAF AXIS AND DRAWN ON WHICHEVER AXIS IS
       SHOWN. `mclust` in cell 22 clusters VAFs; switching the axis is a
       display change (3.2), and refitting on the corrected values would make
       the axis control a data control.

    6. A CLUSTER IS DRAWN AS ENCLOSURE AND THE TRUTH AS COLOUR (§ *Widget 42*).
       The bracket is the component's mean ± one standard deviation, not the
       range of the points assigned to it: assigned ranges overlap, and at one
       level they read as a single rule (found in the mock).

    7. PAGE 3'S NUMBERS ARE HIS FIGURE'S. `cancer-retcher.png` prints four
       samples' cluster mean CCFs; nothing there is simulated, so nothing on
       that page is a data parameter.
   ========================================================================= */

/* ---- the lesson's own numbers -------------------------------------------- */

/* `_lab/cancer-plan-measure.mjs`, on brca_maf.rda: the depth at a
   non-synonymous mutation is median 88 with IQR 49–161. A FIXED depth is not a
   stage — every VAF is then a multiple of 1/d — so a depth setting is the
   MEDIAN of a lognormal with the file's own spread.

   WHERE THE FOUR OPTIONS COME FROM, which nothing recorded until Kenneth asked
   on 2026-09-16. Re-measured in `_lab/vaf-depth-check.R` against the lesson's
   own file, under the lesson's own filter — depth is ref + alt, which is what
   `plotVaf` divides, and the first twenty maftools FLAG genes are left out as
   `rmFlags = 20` does — over 68,625 mutations:

     31   the 10.7th percentile      88   the 50.2nd
     161  the 75.0th                500   the 97.7th

   So three are exact landmarks of the file and the fourth is a round number a
   quarter of a percentile off one (p97.5 is 488). It spans an order of
   magnitude, which is what the control has to do: depth sets the width of the
   peak, not its place. The landmarks it passes over are p25 (49), p90 (274)
   and p95 (372). The log-sd it draws with, 0.882 from the IQR, is the robust
   estimate of the file's own 0.850. */
export const DEPTH_SD = (Math.log(161) - Math.log(49)) / (2 * 0.6745);
export const DEPTH_OPTIONS = ["31", "88", "161", "500"];
export const DEPTH_DEFAULT = "88";

/* 01-2 cell 24's six printed consensus purities run 0.65 to 0.79. */
export const PURITY_OPTIONS = ["0.35", "0.50", "0.70", "1.00"];

export const CELLS = 60;

/* HOW BIG A CELL IS, and it is measured rather than chosen. The first build
   fixed ten columns and drew each cell at 42% of the pitch, which on a
   522 × 150 field is a 21px cell in a 52px column — mostly gap (Kenneth,
   2026-09-16: "can the cells be drawn larger … you can reduce spacing").
   The grid is now whichever column count makes the cell biggest, with a fixed
   3px gap: 15 columns of 4 rows there, and a 29px cell. */
export const CELL_GAP = 3;

/* WHAT A CELL HOLDS, MEASURED FROM THE WORST STATE FIRST. The mark sits ON a
   copy, so the copy spacing and the mark size are one constraint, and sizing
   them per state made the mark change size as the copy number changed — at one
   copy it read as a nucleus rather than as a mutation, and at four the outer
   copies touched the cell's own border (Kenneth, 2026-09-16).

   So: solve the four-copy case, which is the tightest, and use that mark
   everywhere. With N copies at spacing g inside a radius rIn, the outermost
   mark reaches ((N − 1)/2)·g + mark, and two marks clear each other when
   g ≥ 2·mark + CLEARANCE. Both bind at once when

       mark = (rIn − (N − 1)·CLEARANCE/2) / N

   and every state then spreads its own copies as far as that mark allows, up
   to a cap so two copies do not sit at opposite poles of the cell. Each line
   is clipped to the chord of rIn at its own height, so nothing reaches the
   border. */
export const CELL_RIM = (r) => Math.max(2, r * 0.13);
export const MARK_CLEARANCE = 2;
export const MAX_COPIES = 4; // 3 + 1, the largest state in COPY_STATES

export function cellMarks(r, copies) {
  const rIn = r - CELL_RIM(r);
  const mark = Math.max(1.4, (rIn - ((MAX_COPIES - 1) * MARK_CLEARANCE) / 2) / MAX_COPIES);
  const room = copies > 1 ? (rIn - mark) / ((copies - 1) / 2) : 0;
  const gap = Math.min(room, r * 0.62);
  const lines = [];
  for (let c = 0; c < copies; c += 1) {
    const dy = (c - (copies - 1) / 2) * gap;
    const chord = 2 * Math.sqrt(Math.max(1, rIn * rIn - dy * dy));
    lines.push({ dy, len: Math.min(copies > 2 ? r * 1.15 : r * 1.35, chord) });
  }
  return { mark, gap, lines, rIn };
}
export function cellGrid(rect, n = CELLS) {
  let best = null;
  for (let cols = 3; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    const px = rect.w / cols;
    const py = rect.h / rows;
    const r = Math.min(px, py) / 2 - CELL_GAP;
    if (!best || r > best.r) best = { cols, rows, px, py, r };
  }
  return best;
}

/* 01-2 cell 24's allele-specific states, major + minor as ASCAT reports them:
   the copies of ONE inherited chromosome and the copies of the other. 2 + 0 is
   copy-neutral loss of heterozygosity — two copies of one chromosome and the
   other gone — which is a different cell from 1 + 1 even though both hold two
   copies (Kenneth, 2026-09-16).

   A SOMATIC MUTATION ARISES ON ONE CHROMOSOME, so the copies carrying it are
   copies of that chromosome: at most `major` of them, and never a copy of the
   other one as well. That is why 1 + 1 cannot have two mutated copies — it
   would be the same mutation arising twice — and why 2 + 1 stops at two. */
export const COPY_STATES = [
  { key: "1+1", label: "1 + 1", major: 1, minor: 1 },
  { key: "2+0", label: "2 + 0", major: 2, minor: 0 },
  { key: "1+0", label: "1 + 0", major: 1, minor: 0 },
  { key: "2+1", label: "2 + 1", major: 2, minor: 1 },
  { key: "3+1", label: "3 + 1", major: 3, minor: 1 },
].map((s) => ({ ...s, total: s.major + s.minor, copies: Array.from({ length: s.major }, (_, i) => i + 1) }));
export const stateOf = (key) => COPY_STATES.find((s) => s.key === key) ?? COPY_STATES[0];
/** How many copies may carry the mutation in this state: one per copy of the
    chromosome it arose on, so the list is 1…major. */
export const copyOptions = (key) => stateOf(key).copies.map(String);

/* 01-2 cell 25, the model the whole widget is built on:
     VAF = p·c·m / (p·Cₜ + 2(1 − p))     and     c = VAF·(p·Cₜ + 2(1 − p)) / (p·m)
   p purity, c cancer cell fraction, m mutated copies, Cₜ copies per tumour cell. */
export const vafExpected = (p, c, m, C) => (p * c * m) / (p * C + (1 - p) * 2);
export const ccfFrom = (vaf, p, m, C) => (vaf * (p * C + (1 - p) * 2)) / (p * m);

/* ---- small numbers ------------------------------------------------------- */

export const n2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
export const n3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
export const intText = (x) => Math.round(x).toLocaleString("en-US");
export const pctText = (x) => `${Math.round(x * 100)}%`;
export const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
/* Mroz & Rocco's MATH, as maftools prints it in cell 23's titles: all ten
   reproduce to the digit (`_lab/cancer-plan-measure.mjs`). */
export const MATH = (v) => {
  const m = median(v);
  return (100 * 1.4826 * median(v.map((x) => Math.abs(x - m)))) / m;
};

/* ---- page 1: the sample, and the reads drawn from it ---------------------- */

export function configOne(params) {
  const purity = Number(params.purity);
  const ccf = Number(params.ccf);
  const st = stateOf(params.state);
  /* Capped by `major`, not by the total: the mutation sits on copies of one
     chromosome. A link carrying more comes back to what the state allows. */
  const copies = Math.min(Math.max(1, Number(params.copies) || 1), st.major);
  const depth = Number(params.depth);
  return { purity, ccf, state: st, copies, depth, expected: vafExpected(purity, ccf, copies, st.total) };
}

/** One read at a time, each an allele drawn from the sample. */
export function buildReads(rng, cfg) {
  const reads = [];
  for (let i = 0; i < cfg.depth; i += 1) reads.push(rng.next() < cfg.expected ? 1 : 0);
  let alt = 0;
  const running = reads.map((r) => { alt += r; return alt; });
  return { reads, running, alt, depth: cfg.depth };
}
export const altAt = (one, k) => (k <= 0 ? 0 : one.running[Math.min(k, one.depth) - 1]);
export const vafAt = (one, k) => (k <= 0 ? NaN : altAt(one, k) / Math.min(k, one.depth));
/* One unit of the reveal, so that every depth fills in a few seconds. The
   animation adds this many reads a beat and the figure fades this many in. */
export const batchFor = (depth) => Math.max(1, Math.ceil(depth / 66));
export const UNIT_MS = 90;

/* How many of the drawn cells are tumour cells, and how many carry it. Both
   the figure and the note under it read this one function (5.8). */
export const cellCounts = (cfg, n = CELLS) => {
  const tumour = Math.round(n * cfg.purity);
  return { tumour, carrying: Math.round(tumour * cfg.ccf) };
};

/* DECISION 4, REBUILT 2026-09-16 on his round. The panel used to ask which
   SINGLE cause could explain the reading, with nothing measured. It now asks
   the lesson's own question — cell 25 §3 fits c and m with p and Cₜ given —
   and HOW MUCH IT IS GIVEN IS A CONTROL, his own idea, because cell 24 is
   titled "Refining Estimates (Optional)" and opens: "So far, we have
   interpreted VAFs under simple assumptions: 100% tumor purity, diploid genome
   with no amplifications or deletions".

   THE MEASUREMENT SETTLED THREE LEVELS RATHER THAN TWO
   (`_lab/vaf-scenarios-measure.mjs`, over every clonal mutation page 1 can
   build, by how often the analysis calls it subclonal):

                       a diploid region      an altered region
     knowing nothing        75.0%                  81.3%
     knowing purity          0.0%                  62.5%
     knowing both            0.0%                   0.0%

   PURITY SETTLES A DIPLOID REGION COMPLETELY AND DOES NOT SETTLE AN ALTERED
   ONE — 75.0% wrong becomes 0.0%, while 81.3% becomes 62.5%, still wrong more
   often than not. So the levels are not bad/better/best with a redundant
   middle: each fixes a different thing, and the middle one is where the reader
   finds out which. Pooling the copy states hides it, reading as "purity helps
   a bit everywhere", which is the wrong lesson. */
export const KNOWLEDGE = [
  { key: "nothing", label: "Nothing" },
  { key: "purity", label: "Purity" },
  { key: "both", label: "Purity and copy number" },
];
export const knowsOf = (key) => KNOWLEDGE.find((k) => k.key === key) ?? KNOWLEDGE[KNOWLEDGE.length - 1];

/* WHICH CHROMOSOME THE MUTATION AROSE ON. It is not in the equation at all —
   `vafExpected` takes the TOTAL — so it changes the picture and never the
   number, which makes it the one parameter on this page a reading can never
   see. Only a state whose counts differ and whose minor survives offers a
   choice: 2 + 1 and 3 + 1, and there only while one copy carries it. His pick
   of 2026-09-16 was that it belongs in the panel and not in the rail, because
   it is an explanation of the reading rather than a knob for building a
   sample. */
export function hostsOf(state) {
  const out = [{ host: "major", copies: state.major }];
  if (state.minor > 0 && state.minor !== state.major) out.push({ host: "minor", copies: state.minor });
  return out;
}

/* A TOTAL OF 2 IS NOT AN ALLELE-SPECIFIC CALL. Cell 24 names two routes to copy
   number: GISTIC2, which gives a segment's total, and ASCAT, which gives major
   and minor. Told only "diploid", an analysis cannot tell 1 + 1 from 2 + 0, so
   one mutated copy and two are both open to it — which is why the assumed
   levels enumerate over the TOTAL and only the allele-specific level caps the
   count at the chromosome the mutation arose on. */
const ASSUMED_DIPLOID = [
  { m: 1, key: "1+1" },
  { m: 2, key: "2+0" },
];

/**
 * What the analysis concludes from a reading, knowing what its level says.
 * ONE method throughout — enumerate the multiplicity, solve the fraction, and
 * keep the fractions that are fractions — with an assumed value wherever it was
 * not told one, so no level is a straw man. A row is marked when it is the
 * reader's own cell, which is how the figure shows that knowing nothing can
 * leave the truth out of its own candidates.
 */
/**
 * The one scenario the analysis would report if pressed for a single answer:
 * the reader's own cell where the level can reach it, else the first that fits.
 * THE CARD, THE READOUT AND THE PANEL ALL READ THIS, because three numbers on
 * one screen solved at three different purities is what the level control
 * otherwise produces — the card said 0.78 under a note saying it was solved at
 * purity 1, while the panel said 52% (found in the browser, 2026-09-16).
 */
/* THE CALL, which is what the analysis is FOR. Cell 17: "VAFs can be used to
   infer tumor heterogeneity indicating whether mutations are present in all
   cancer cells (clonal) or only a subset (subclonal)", and cell 25 puts the
   line at a cancer cell fraction near 1 — `CUT`, the same 0.9 page 2 draws.

   IT HAS THREE ANSWERS, NOT TWO. The scenarios that fit can straddle the cut,
   and then the reading genuinely cannot choose; a tile that said "clonal"
   there would be a claim the data does not carry (§ *Widget 59*, a tile's
   label is a claim). Measured over the 144 samples page 1 can build:

                        right    WRONG    cannot tell
     knowing nothing    73.6%    20.1%        6.3%
     knowing purity     72.2%    13.9%       13.2%
     knowing both       80.6%     0.0%       19.4%

   Told nothing the call is confident and wrong one time in five; told both it
   is right or honestly unsure and NEVER wrong. And "cannot tell" RISES with
   knowledge, because what goes is the confident wrong answer.

   Kenneth's question of 2026-09-16 was whether a reading that cannot fit the
   assumption means the mutation is subclonal. It is the other way round: a
   scenario is ruled out when its fraction passes 1, which means the reading is
   too HIGH for that multiplicity and more copies carry it — an early event.
   What is true, and is why the call is worth stating, is that told nothing the
   reported fraction is LOWER than the truth 69.4% of the time: an uncorrected
   analysis manufactures the subclonal look. */
export function verdictFor(vaf, cfg, level) {
  const fits = scenariosFor(vaf, cfg, level).rows.filter((r) => r.ok);
  if (!fits.length) return "none";
  if (fits.every((r) => r.c >= CUT)) return "clonal";
  if (fits.every((r) => r.c < CUT)) return "subclonal";
  return "split";
}

/**
 * WHICH ASSUMPTION IS ACTUALLY WRONG, so the figure can name it instead of
 * saying "the assumption" and leaving the reader to work out which (Kenneth,
 * 2026-09-16: "is this diploid assumption only?"). It is checkable rather than
 * inferred: an assumed purity of 1 is wrong when the sample is not pure, and an
 * assumed diploid genome is wrong when the copies do not come to two.
 */
export function assumptionsWrong(cfg, level) {
  const known = knowsOf(level).key;
  const out = [];
  if (known === "nothing" && cfg.purity < 1) out.push("pure");
  if (known !== "both" && cfg.state.total !== 2) out.push("diploid");
  return out;
}

/** The span of the fractions that fit — one number when one scenario does, a
    range when several do. What the tile reports, since a single number where
    the reading supports several is a claim the reading does not make. */
export function fractionSpan(vaf, cfg, level) {
  const { fits } = scenariosFor(vaf, cfg, level);
  if (!fits.length) return null;
  const cs = fits.map((r) => r.c);
  return { lo: Math.min(...cs), hi: Math.max(...cs), n: fits.length };
}

export function scenariosFor(vaf, cfg, level) {
  const known = knowsOf(level).key;
  const purity = known === "nothing" ? 1 : cfg.purity;
  const rows = [];
  const push = (state, host, m) => {
    const c = ccfFrom(vaf, purity, m, state.total);
    rows.push({
      state, host, m, c, purity,
      ok: c > 0 && c <= 1 + 1e-9,
      truth: state.total === cfg.state.total && m === cfg.copies && Math.abs(c - cfg.ccf) < 1e-9,
    });
  };
  if (known === "both") {
    for (const h of hostsOf(cfg.state)) for (let m = 1; m <= h.copies; m += 1) push(cfg.state, h.host, m);
    /* ORDERED BY MULTIPLICITY, the major chromosome first, so the two rows that
       differ ONLY in which chromosome the mutation arose on sit next to each
       other with the same fraction printed twice. That adjacency is the whole
       argument for drawing the minor case at all. */
    rows.sort((a, b) => a.m - b.m || (a.host === "major" ? -1 : 1));
  } else {
    for (const g of ASSUMED_DIPLOID) push(stateOf(g.key), "major", g.m);
  }
  /* ONLY WHAT FITS REACHES THE FIGURE. The caption says "Scenarios that fit"
     and the panel listed the ones that do not as well, each with a fraction
     past 1 and a line underneath explaining what that meant — three hops from
     "1.18" to "more than every tumor cell" (Kenneth, 2026-09-16: "still
     confusing … it's information overload for me"). `rows` is what could be
     considered; `fits` is what the figure draws. */
  return { rows, fits: rows.filter((r) => r.ok), purity, known };
}

/* ---- page 2: many mutations ---------------------------------------------- */

/* The label is the COUNT, because a segmented option is read on its own face:
   "And a subclone" beside "One" reads as a sentence with its subject missing. */
export const CLONE_SETS = [
  { key: "one", label: "One", clones: [{ ccf: 1, share: 1 }] },
  { key: "two", label: "Two", clones: [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }] },
  { key: "three", label: "Three", clones: [{ ccf: 1, share: 0.5 }, { ccf: 0.6, share: 0.3 }, { ccf: 0.3, share: 0.2 }] },
];
export const clonesOf = (key) => CLONE_SETS.find((c) => c.key === key) ?? CLONE_SETS[1];
export const MUTATION_OPTIONS = ["120", "300", "1000"];

export function configMany(params) {
  return {
    clones: clonesOf(params.clones).clones,
    n: Number(params.mutations),
    purity: Number(params.purity2),
    depthMedian: Number(params.depth2),
    assumed: params.assumed === "nothing" ? 1 : Number(params.purity2),
  };
}

const drawDepth = (rng, med) => Math.max(8, Math.round(Math.exp(Math.log(med) + DEPTH_SD * rng.normal())));

export function buildMany(rng, cfg) {
  const muts = [];
  for (let i = 0; i < cfg.n; i += 1) {
    let u = rng.next();
    let pick = cfg.clones[0];
    for (const c of cfg.clones) { if (u < c.share) { pick = c; break; } u -= c.share; }
    const depth = drawDepth(rng, cfg.depthMedian);
    const p = vafExpected(cfg.purity, pick.ccf, 1, 2);
    let alt = 0;
    for (let r = 0; r < depth; r += 1) if (rng.next() < p) alt += 1;
    muts.push({ vaf: alt / depth, depth, ccfTrue: pick.ccf, clonal: pick.ccf >= 0.999 });
  }
  const fit = pickK(muts.map((m) => m.vaf));
  return { muts, fit, math: MATH(muts.map((m) => m.vaf)) };
}

/* One-dimensional Gaussian mixture by EM, the number of components chosen by
   BIC — `mclust`'s rule, which cell 22 calls through inferHeterogeneity.
   BIC = 2·loglik − k·ln n, higher better, mclust's sign convention.
   Measured: at 300 mutations it gives a tumour with ONE clone two components
   in 21 of 30 runs, which is what page 2 exists to show. */
export function fitGMM(x, K, iters = 200) {
  const n = x.length;
  const s = [...x].sort((a, b) => a - b);
  const q = (p) => { const h = (n - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
  const mu = Array.from({ length: K }, (_, k) => s[Math.floor(((k + 0.5) / K) * n)]);
  const sd = new Array(K).fill(Math.max(0.01, (q(0.75) - q(0.25)) / (1.349 * K)));
  const w = new Array(K).fill(1 / K);
  const R = Array.from({ length: n }, () => new Array(K).fill(0));
  const pdf = (v, m0, s0) => Math.exp(-((v - m0) ** 2) / (2 * s0 * s0)) / (s0 * Math.sqrt(2 * Math.PI));
  let loglik = -Infinity;
  for (let it = 0; it < iters; it += 1) {
    let ll = 0;
    for (let i = 0; i < n; i += 1) {
      let tot = 0;
      for (let k = 0; k < K; k += 1) { R[i][k] = w[k] * pdf(x[i], mu[k], sd[k]); tot += R[i][k]; }
      if (!(tot > 0)) { tot = 1e-300; R[i].fill(1 / K); }
      for (let k = 0; k < K; k += 1) R[i][k] /= tot;
      ll += Math.log(tot);
    }
    for (let k = 0; k < K; k += 1) {
      let nk = 0, m0 = 0, v0 = 0;
      for (let i = 0; i < n; i += 1) { nk += R[i][k]; m0 += R[i][k] * x[i]; }
      m0 /= Math.max(nk, 1e-12);
      for (let i = 0; i < n; i += 1) v0 += R[i][k] * (x[i] - m0) ** 2;
      w[k] = nk / n; mu[k] = m0; sd[k] = Math.max(0.005, Math.sqrt(v0 / Math.max(nk, 1e-12)));
    }
    if (Math.abs(ll - loglik) < 1e-8) { loglik = ll; break; }
    loglik = ll;
  }
  const assign = x.map((v) => {
    let best = 0, bv = -Infinity;
    for (let k = 0; k < K; k += 1) { const p = w[k] * pdf(v, mu[k], sd[k]); if (p > bv) { bv = p; best = k; } }
    return best;
  });
  return { loglik, mu, sd, w, assign, bic: 2 * loglik - (3 * K - 1) * Math.log(n) };
}
export function pickK(x, maxK = 5) {
  let best = null;
  let bestK = 1;
  for (let K = 1; K <= maxK; K += 1) {
    const f = fitGMM(x, K);
    if (!best || f.bic > best.bic) { best = f; bestK = K; }
  }
  /* DECISION 6: a component's bracket is its mean ± one standard deviation. */
  const spans = [];
  for (let k = 0; k < bestK; k += 1) {
    const n = best.assign.filter((a) => a === k).length;
    if (n) spans.push({ mu: best.mu[k], sd: best.sd[k], lo: best.mu[k] - best.sd[k], hi: best.mu[k] + best.sd[k], n });
  }
  spans.sort((a, b) => a.mu - b.mu);
  return { K: bestK, fit: best, spans };
}

/* WHERE THE LINE BETWEEN CLONAL AND SUBCLONAL IS DRAWN, and it had no note
   until Kenneth asked on 2026-09-16. THE LESSON GIVES NO NUMBER: cell 25 says
   only that a cancer cell fraction "≈ 1" is read as clonal and below it as
   subclonal. 0.9 is this widget's, used in two places — the line page 2 draws
   on the fraction axis, and the call page 1 makes.

   IT IS NOT A SENSITIVE CHOICE HERE, which is the thing worth knowing. Swept
   over the 144 samples page 1 can build, the call comes out identically at
   0.80, 0.85, 0.90 and 0.95 — 80.6% right and none wrong when the analysis is
   told both — because the cancer cell fraction control offers 0.25, 0.50, 0.75
   and 1.00, and only 1.00 is clonal at any line in that range. At exactly 1.00
   it breaks (1.4% wrong), since a fraction of one then has to clear a bar set
   at one.

   The cost of that insensitivity is that the reader cannot build a mutation
   sitting ON the line and watch the call teeter; the page argues about what is
   measured rather than about where the convention sits. */
export const CUT = 0.9;
/** The mutations on whichever axis is shown, and the cut that reads them. */
export function onAxis(many, cfg, axis) {
  if (axis === "vaf") return { values: many.muts.map((m) => m.vaf), max: 1, cut: null, label: "Variant allele frequency", ticks: [0, 0.25, 0.5, 0.75, 1] };
  const values = many.muts.map((m) => ccfFrom(m.vaf, cfg.assumed, 1, 2));
  return { values, max: 1.4, cut: CUT, label: "Cancer cell fraction", ticks: [0, 0.5, CUT, 1.4] };
}

/* THE AXIS IS EASED BECAUSE IT IS ONE SET OF MUTATIONS READ TWICE. 4.4 says a
   display change almost never deserves a transition; this is the exception the
   page exists for — dividing by purity and copy number moves every mutation
   along the axis, and a jump reads as a different set of mutations. Widget 60's
   pattern: two readings of one draw, interpolated, with core's ease mode
   supplying the frames (`anim.easing`, set in `rebuild`). */
export const EASE_MS = 420;
export const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const lerp = (a, b, t) => a + (b - a) * t;

/* THE HISTOGRAM IS BUILT HERE, not in the drawing, because page 2's data
   morph interpolates it and the verify has to hold both of its ends (Kenneth,
   2026-09-16: "page 2 when changing sample parameters"). A bin is two counts,
   clonal and subclonal, so the truth stays in colour through the morph. */
export const HIST_BINS = 50;
export function histOf(values, muts, max, bins = HIST_BINS) {
  const counts = Array.from({ length: bins }, () => [0, 0]);
  values.forEach((v, i) => {
    const b = Math.min(bins - 1, Math.max(0, Math.floor((v / max) * bins)));
    counts[b][muts[i].clonal ? 0 : 1] += 1;
  });
  return counts;
}
export const histTop = (counts) => Math.max(1, ...counts.map((c) => c[0] + c[1])) * 1.1;
export const lerpHist = (a, b, t) => a.map((c, i) => [lerp(c[0], b[i][0], t), lerp(c[1], b[i][1], t)]);

/* WHY THE BARS AND NOT THE MUTATIONS. Purity and the mutation count keep every
   mutation's identity — mutation i is the same mutation, re-read — but READ
   DEPTH does not: a mutation's depth decides how many values it draws from the
   stream, so changing it re-deals everything after the first (measured: 158 of
   300 keep their clone, which is chance). Sliding mutations under a depth
   change would therefore assert an identity that is not there. The bar heights
   carry no such claim: they say the distribution went from this shape to that
   one, which is what happened under all three. Widget 53's round-27 rule, read
   the other way round.

   The tiles and the arithmetic do NOT interpolate. They report the data the
   reader has just asked for, and the picture catches up — the same ruling that
   keeps the VAF bar on page 1 un-eased. */

/** The view at a mix: 0 is the reads as they came, 1 is the fraction. */
export function axisAt(many, cfg, mix) {
  const a = onAxis(many, cfg, "vaf");
  if (mix <= 0) return { ...a, mix: 0 };
  const b = onAxis(many, cfg, "ccf");
  if (mix >= 1) return { ...b, mix: 1 };
  return {
    values: a.values.map((v, i) => lerp(v, b.values[i], mix)),
    max: lerp(a.max, b.max, mix),
    cut: b.cut,
    label: mix < 0.5 ? a.label : b.label,
    ticks: mix < 0.5 ? a.ticks : b.ticks,
    mix,
  };
}

/* ---- page 3: his RETCHER figure ------------------------------------------ */

/* 01-2 cell 25's figure: four samples of one patient, three clusters' mean
   cancer cell fraction. DECISION 7: measured from the figure, not simulated. */
/* THE ERROR BARS ARE HIS FIGURE'S TOO, read off `cancer-retcher.png` the way
   the means were (Kenneth's pick, 2026-09-17), so nothing on page 3 becomes
   invented. Calibrated on the figure's own gridlines — CCF 0 at y 665.5 and 1
   at y 72.5, so one pixel is 0.0017 — and each bar measured as the extent of
   its cluster's hue in a 5px band through the point. `lo` and `hi` are the
   bar's ends. Three are not a clean reading, and say so:

     P2.1st cluster 1 and P2.surgery cluster 3 reach only about as far as the
       figure's own dot (radius 12px, 0.020): their bars are at most that long.
     P2.1st cluster 2's lower half is hidden under cluster 3, drawn on top of
       it; its upper half is 0.039 and the other three blue bars are symmetric
       to within 0.002, so the lower end is taken as the mirror.

   The bars bear on the sum rule itself. P2.1st's violation survives them —
   even the children's lower ends (0.495 + 0.444) pass the trunk's upper end,
   0.750 — while P2.2st's is within 0.016 of closing, so the figure's own bars
   are what say that sample's evidence is weak. */
export const SAMPLES = [
  { key: "P2.1st", ccf: [0.729, 0.534, 0.512], lo: [0.706, 0.495, 0.444], hi: [0.750, 0.573, 0.579] },
  { key: "P2.2st", ccf: [0.826, 0.597, 0.353], lo: [0.793, 0.549, 0.325], hi: [0.858, 0.647, 0.382] },
  { key: "P2.3st", ccf: [0.926, 0.767, 0.348], lo: [0.896, 0.716, 0.294], hi: [0.959, 0.819, 0.402] },
  { key: "P2.surgery", ccf: [0.806, 0.476, 0.304], lo: [0.770, 0.424, 0.281], hi: [0.844, 0.529, 0.328] },
];
/* The three genes his figure names beside each cluster. */
export const CLUSTER_GENES = [
  ["SPEN", "CA3", "HRH2"],
  ["TP53", "PDGFRB", "USH2A"],
  ["NWD1", "USP54", "NCL"],
];

/* WHICH SAMPLES JOIN FIRST. Page 3 exists to show that more biopsies narrow the
   tree, and in the figure's own order it could not: P2.1st on its own already
   rules out branching (0.534 + 0.512 = 1.05 past 0.729) and it was always the
   first used, so the trees that fit read 1 of 2 at every setting
   (`_lab/vaf-trees-mock.html` § 0). Only P2.surgery on its own leaves both
   open, so it joins first — his pick, 2026-09-17 — and the count reads 2 of 2,
   then 1 of 2. The samples still DRAW in the figure's time order; only which
   of them are included changes. */
export const JOIN_ORDER = [3, 0, 1, 2];
export const TAKEN_OPTIONS = [
  { key: "1", n: 1 },
  { key: "2", n: 2 },
  { key: "4", n: 4 },
];
export const takenOf = (key) => TAKEN_OPTIONS.find((t) => t.key === key) ?? TAKEN_OPTIONS[2];
/** The samples in use, back in the figure's time order. */
export const usedSamples = (taken) => {
  const n = takenOf(taken).n;
  const picked = new Set(JOIN_ORDER.slice(0, n));
  return SAMPLES.filter((_, i) => picked.has(i));
};

/* Clusters ordered by cancer cell fraction, descending; cluster 1 is the trunk
   and every later cluster's parent is an earlier one, so three clusters have
   two shapes. A shape fits a sample when no parent's children sum past it —
   the pigeonhole principle (Nik-Zainal et al. 2012). */
export const SHAPES = [
  { key: "linear", label: "1 → 2 → 3", parents: [0, 1] },
  { key: "branching", label: "2 and 3 under 1", parents: [0, 0] },
];
export const shapeOf = (key) => SHAPES.find((s) => s.key === key) ?? SHAPES[0];
/** Where a shape sits on the glide's one scalar. Two shapes, so it is 0 or 1;
    a third would need a different mechanism, and the verify says so. */
export const shapeIndex = (key) => Math.max(0, SHAPES.findIndex((s) => s.key === key));
export const childrenOf = (shape, node) => shape.parents
  .map((p, i) => [p, i + 1])
  .filter(([p]) => p === node)
  .map(([, c]) => c);
export const fitsSumRule = (shape, ccf) => ccf.every((_, node) => childrenOf(shape, node)
  .reduce((s, c) => s + ccf[c], 0) <= ccf[node] + 1e-12);
/* PAGE 3'S BARS AS ONE RECT PER CLUSTER, so the shape switch can glide
   between two layouts rather than cut (Kenneth, 2026-09-16: "do the tween for
   page 3"). Cluster 1 is the trunk at full height; the shape decides where 2
   and 3 go. Only cluster 3 actually moves — under 1 → 2 → 3 it is nested
   inside cluster 2, and under 2 and 3 under 1 it is beside it, the same width
   in both — so the glide IS his "cluster 3 sliding out of cluster 2". */
export function barRects(shape, ccf, { x, y, w, h }) {
  const rects = [{ x, y, w: w * ccf[0], h }];
  let cx = x;
  for (const kid of childrenOf(shape, 0)) {
    const kw = w * ccf[kid];
    rects[kid] = { x: cx, y: y + 3, w: kw, h: h - 6 };
    for (const g of childrenOf(shape, kid)) rects[g] = { x: cx, y: y + 6, w: w * ccf[g], h: h - 12 };
    cx += kw;
  }
  return rects;
}
/* WHERE A CONNECTOR MEETS ITS TWO NODES: on each circle's edge, along the line
   between the two centres, so the connector points at both. It stepped a fixed
   11px straight down from the parent and straight up into the child, which is
   right only when the two are stacked; on a diagonal it left each end off to the
   side of the centre it should aim at (Kenneth, 2026-09-17: "the nodes should be
   radially aligned to the connectors"). A vertical connector comes out exactly
   as it was. */
export const NODE_R = 11;
export function connectorEnds([x0, y0], [x1, y1], r = NODE_R) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / d;
  const uy = (y1 - y0) / d;
  return { from: [x0 + ux * r, y0 + uy * r], to: [x1 - ux * r, y1 - uy * r] };
}

export const lerpRect = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t),
});
export const lerpRects = (a, b, t) => a.map((r, i) => lerpRect(r, b[i], t));
/** How far the children reach past the trunk, read off whatever is DRAWN — so
    the overflow grows as cluster 3 slides out, which is the moment the rule is
    about, rather than appearing whole at the end. */
export const overflowOf = (rects) => Math.max(
  0,
  Math.max(rects[1].x + rects[1].w, rects[2].x + rects[2].w) - (rects[0].x + rects[0].w),
);

/** The node whose children come closest to passing it: the one constraint
    worth printing beside a sample, since the others are slacker. */
export function tightestNode(shape, ccf) {
  let best = null;
  ccf.forEach((_, node) => {
    const kids = childrenOf(shape, node);
    if (!kids.length) return;
    const sum = kids.reduce((s, c) => s + ccf[c], 0);
    const ratio = sum / ccf[node];
    if (!best || ratio > best.ratio) best = { node, kids, sum, parent: ccf[node], ratio };
  });
  return best;
}
export const shapesFitting = (ccf) => SHAPES.filter((s) => fitsSumRule(s, ccf));

/* ---- layout -------------------------------------------------------------- */

const PAD = 14;

const ROW_H = 44;
/** How many scenarios the panel will list, without building them: the height
    is computed before `compute` runs, so it can only read the parameters. */
/** Whether the panel draws a line under its rows — nothing fits, or the
    reader's own sample is left out by an assumption that is wrong. Read by
    the height, so only the space a line needs is reserved, and by `draw`, so
    the two cannot disagree about whether it is there. */
export function scenarioNote(params) {
  const cfg = configOne(params);
  const { fits } = scenariosFor(cfg.expected, cfg, params.knows);
  if (!fits.length) return "nothing";
  if (!fits.some((r) => r.truth) && assumptionsWrong(cfg, params.knows).length) return "notHere";
  return null;
}

export function scenarioRows(params) {
  /* The panel draws only the scenarios that FIT, and how many that is depends
     on the reading — which is itself a pure function of the parameters, so the
     height can still be computed before `compute` runs. */
  const cfg = configOne(params);
  return scenariosFor(cfg.expected, cfg, params.knows).fits.length;
}

export function layout(w, params) {
  const page = params.page;
  const inner = w - 2 * PAD;
  /* Every row below is measured, not guessed: the first build drew the note
     under the cells on top of the reads' caption and the VAF's own reading on
     top of the arrangements' (the browser found both). ROW_H is the height one
     arrangement takes, and the page's height follows from it (5.8). */
  if (page === "one") {
    /* 190px of field rather than 150: at 150 the grid that fits sixty cells is
       15 columns of 4 and a 29px cell, at 190 it is 12 of 5 and a 32px cell —
       and what has to be legible inside one is up to four copies with a mark
       on them (Kenneth, 2026-09-16). */
    const cells = { x: PAD, y: 26, w: inner, h: 190 };
    const reads = { x: PAD, y: 270, w: inner, h: 56 };
    const bar = { x: PAD, y: 346, w: inner, h: 16 };
    /* HOW MANY SCENARIO ROWS THERE ARE FOLLOWS THE STATE AND THE LEVEL — one
       per multiplicity the analysis can consider, plus the minor chromosome
       where it survives. An assumed diploid gives two; 3 + 1 with an
       allele-specific call gives four. The height reads the count rather than a
       fixed three, and the extra line is the room the "not among them" note
       needs when a level misses the reader's own cell. */
    const n = scenarioRows(params);
    const rows = { x: PAD, y: 430, w: inner, h: n * ROW_H };
    return {
      page, cells, reads, bar, rows, rowH: ROW_H, cellR: 15,
      /* ROOM FOR A NOTE ONLY WHEN THERE IS ONE. It reserved 42px under the rows
         always — two lines, from when the panel explained ruled-out rows — and
         once only the fits were drawn that left 56px of empty canvas under a
         panel with nothing to add (Kenneth, 2026-09-16: "compact"). The last
         row already carries its own space below the cell, so without a note the
         page ends a margin after it. */
      height: rows.y + rows.h + (scenarioNote(params) ? 22 : 6),
    };
  }
  if (page === "many") {
    /* The clusters are brackets ABOVE the bars, one level each, so the stage
       reserves three levels between the caption and the plot. The left gutter
       is 44px because core draws a y-axis LABEL rotated about x − 40, and at
       the first build it was painted off the canvas (the verify caught it). */
    const hist = { x: PAD + 44, y: 86, w: inner - 56, h: 190 };
    return { page, hist, height: hist.y + hist.h + 60 };
  }
  const lines = { x: PAD + 30, y: 34, w: Math.round(inner * 0.56), h: 150 };
  const trees = { x: lines.x + lines.w + 26, y: 34, w: inner - lines.w - 52, h: 150 };
  const bars = { x: PAD, y: lines.y + lines.h + 54, w: inner, h: 4 * 34 };
  return { page, lines, trees, bars, height: bars.y + bars.h + 12 };
}
export const stageHeight = (w, values) => layout(w, values).height;

/* ---- copy ---------------------------------------------------------------- */

export const STRINGS = {
  /* His pick, 2026-09-16, subtitle B, rephrased on his "sequencing reads from"
     the same day: "falls" is on the struck list of the sit/fall/lie pass, and
     what replaces it says what the frequency is a fraction OF. Page 1 exists to
     correct that a VAF is a share of READS and not a share of cells, so the
     subtitle states it before the figure does. */
  subtitle: "A tumor is a mixture of cell populations, and its mutations are read as variant "
    + "allele frequencies — the fraction of sequencing reads from a sample that carry them. "
    + "Purity and copy number set that fraction for a mutation carried by every tumor cell, "
    + "sequencing depth sets how wide its peak is, and the cancer cell fraction is what is left "
    + "once both are divided out.",

  pageLabel: "Page",
  pageDetail: "one mutation, a tumor's mutations together, or several samples of one patient",
  sampleSection: "The sample",
  purityLabel: "Tumor purity",
  purityDetail: "the fraction of cells in the sample that are tumor cells",
  /* The same quantity page 1's own tile reads out as "Cancer cell fraction",
     so it is set under that name too (the terminology pass of 2026-09-17). */
  ccfLabel: "Cancer cell fraction",
  ccfDetail: "the fraction of tumor cells that carry the mutation",
  stateLabel: "Copy number",
  stateDetail: "copies of one inherited chromosome + copies of the other, as an allele-specific caller reports them",
  copiesLabel: "Mutated copies",
  /* THE COUNT IS A TIMING, and saying only what it counts is what confused
     Kenneth on 2026-09-16: "there is 1 mutated copy but copy number is 2 + 0?
     isn't the mutation copied when the copy number increases?" Both orders are
     real cells. 2 + 0 with two mutated copies is his reading — the mutation was
     already there and the duplication carried it — and 2 + 0 with one is the
     other order, the chromosome lost and the survivor duplicated first, the
     mutation arising afterwards on one of the two copies. 01-2 cell 25 states
     it of m and calls one the usual case, which is why the control opens there. */
  copiesDetail: "copies of that chromosome carrying it: one if the mutation arose after the copy number changed, more if it arose before and was copied with it",
  depthLabel: "Read depth",
  depthDetail: "reads covering the position",
  readsSection: "The reads",
  seedLabel: "Seed",
  seedDetail: "draws different reads",
  allLabel: "Draw every read",
  allDetail: "fills the pileup at the current depth",

  tumourSection: "The tumor",
  clonesLabel: "Populations",
  clonesDetail: "the cell populations the mutations come from",
  mutationsLabel: "Mutations",
  mutationsDetail: "somatic mutations called in the tumor",
  lookSection: "How to read it",
  axisLabel: "Axis",
  axisDetail: "the variant allele frequency, or the cancer cell fraction with purity and copy number divided out",
  assumedLabel: "Given",
  assumedDetail: "what the correction is given; without purity it assumes a pure sample",
  clustersLabel: "Clusters found",
  clustersDetail: "a Gaussian mixture, the number of components chosen by BIC",

  samplesSection: "The samples",
  takenLabel: "Samples used",
  takenDetail: "biopsies of one patient, counted from the surgery sample",
  shapeLabel: "Tree",
  shapeDetail: "which cluster is inside which",
  cellsLabel: "Draw the cells",
  cellsDetail: "each sample's tumor cells under its fractions",

  cellsCaption: "The sample",
  readsCaption: "The reads",
  /* ONE LINE ON THE CARD PER LEVEL, his pick of 2026-09-16 — the long
     walkthrough belongs in the lesson, and this is what the card can carry.
     Each says what the fraction is solved WITH, because that is the step the
     level changes and the panel's rows are its answers. */
  /* Literal, one fact each. "Here it is solved", "what the reading is worth on
     its own" and "comes back as" narrated the arithmetic instead of stating it
     (the audit of 2026-09-16). */
  levelNote: {
    nothing: "The fraction is solved at purity 1 and two copies, so reads from normal cells count "
      + "as tumor reads and lower it.",
    purity: "The fraction is solved at the sample's purity, which removes the dilution, and at two "
      + "copies, which holds only where the genome is diploid.",
    both: "The fraction is solved at the sample's purity and copy number, which leaves m as the "
      + "only unknown: each value of m gives one fraction.",
  },
  knowsLabel: "Given",
  knowsDetail: "what the analysis is given; the rest is assumed",
  /* PLAIN NOUNS, the collection's register: "The data" 18 times across the
     shipped widgets, "The model" 10, "The inference", "The truth". These were
     "The sample you built", "How you sequenced it" and "What you bring to the
     analysis" for one afternoon — second-person narration, which Kenneth struck
     as a mannerism (2026-09-16). The three nouns still keep the truth, the
     assay and the analysis apart, which was the reason for three groups. */
  truthSection: "The sample",
  seqSection: "The sequencing",
  analysisSection: "The analysis",
  scenariosCaption: "Scenarios that fit",
  /* One shape at all three levels: what the analysis was GIVEN, then what it
     had to assume. At "Purity" this said only "assuming a diploid genome" and
     never named the purity it had been handed — the audit of 2026-09-16. */
  assumingPure: "assuming a pure sample and a diploid genome",
  assumingDiploid: (p) => `purity ${p}, assuming a diploid genome`,
  givenBoth: (p, state) => `purity ${p}, copy number ${state}`,
  callLabel: "Clonal or subclonal",
  callValue: { clonal: "Clonal", subclonal: "Subclonal", split: "Cannot tell", none: "—" },
  callNote: {
    clonal: `every scenario that fits is at ${CUT} or more`,
    subclonal: `no scenario that fits reaches ${CUT}`,
    split: `the scenarios that fit straddle ${CUT}`,
    none: "no scenario fits this reading",
  },
  /* The rule marks the one scenario that is true — `--c-reference` is the token
     for the truth where one exists — so it is named for what it marks. */
  truthLegend: "The true scenario",
  /* IT HAS TO NAME THE READER'S OWN NUMBER. "The sample you built is not among
     them" points at an absence — no row is marked, and the reader has to notice
     that the row which WOULD have been marked is missing. Kenneth read it and
     asked what it referred to (2026-09-16), which is the whole answer: it means
     the analysis has ruled out the very sample he made, and saying his fraction
     beside the ones it does offer is what makes that land. */
  /* Named rather than "the assumption", and only the ones that are actually
     wrong. The reader's own sample is the one thing on the figure they already
     know, so what it needs to say is why it is not there. */
  /* THE CARD'S OWN WORDS, and short enough to fit. With both assumptions wrong
     "a pure sample and a diploid genome were assumed" measured 539px against a
     528px line, and ran 52px off the canvas under the recorder — found only
     once the extent sweep began painting a note at all (2026-09-16). "purity 1
     and two copies" is what the card already says the fraction is solved at,
     so the note and the card now name the assumption the same way. The verb
     follows the PHRASE, not the count: "two copies" alone still takes "were". */
  assumedPure: "purity 1",
  assumedDiploid: "two copies",
  nothingFits: (what, verb) => `No scenario fits this reading — ${what} ${verb} assumed`,
  notHere: (pct, what, verb) => `The true scenario — ${pct} of tumor cells — is not listed: ${what} ${verb} assumed`,
  /* The formula card's notes. Each names its letters and then says what the
     line divides by what — the general logic, in the lesson's own terms. */
  noteOne: "p is the fraction of cells in the sample that are tumor cells, c the fraction of those "
    + "cells carrying the mutation, m the copies carrying it in such a cell, and Cₜ all the copies "
    + "there. The reading divides variant reads by reads; the model divides the mutated copies in "
    + "the sample by every copy at that position, normal cells included. m is one when the "
    + "mutation arose after the copy number changed and more when it arose before and was copied "
    + "with it, which is how a mutation is timed against a gain.",
  noteMany: "The same model, solved for c: at a fixed purity and copy number it is the reading "
    + "multiplied by one number. Each cluster is one component of a Gaussian mixture, the number of "
    + "them chosen by BIC — mutations at similar frequencies. MAD is the median absolute deviation, "
    + "and 1.4826 scales it to a standard deviation.",
  /* A CLUSTER IS A GROUP OF MUTATIONS, NOT OF CELLS. Page 2 teaches exactly that
     — the populations are the truth, the clusters are what a mixture finds —
     so page 3 cannot then give a cluster cells of its own (the terminology pass
     of 2026-09-17). The rule is about the cells that carry the mutations. */
  noteTree: "The cells carrying a cluster's mutations are a subset of those carrying its parent's, "
    + "so a cluster's children cannot need more cells than their parent has. Two clusters that "
    + "would are one inside the other rather than side by side.",
  labelReading: "the reading",
  labelModel: "the model",
  labelSample: "this sample",
  labelFraction: "cancer cell fraction",
  labelAtPurity: "at this purity",
  labelMath: "MATH",
  labelThese: "these mutations",
  labelRule: "the rule",

  linesCaption: "Cluster mean cancer cell fraction",
  rulePrefix: "No parent's children may sum past it",
  /* Both are read on the face of a 100px tree, so both are short enough to
     sit there: the first build overran into its neighbour. */
  fits: "Fits",
  ruledOut: "Ruled out",
};

/* TWO COLUMNS AND A SPANNING THIRD, because three page names do not fit one
   rail row: at a 300px rail a segmented row gives each 99px, and "Clonal
   architecture" needs 114 and "Many mutations" 101 when it is the selected one
   (measured in the pane, 2026-09-16). Shortening the names was the other way
   out, and the names are the lesson's own order; the grid keeps them. */
export const PAGES = [
  { value: "one", label: "One mutation" },
  { value: "many", label: "Many mutations" },
  { value: "clonal", label: "Clonal architecture", span: true },
];
/* ONE ROW EACH. Named in full so the two options match the tiles, and neither
   fits half a rail: at a narrow rail "Variant allele frequency" measured 135px
   and "Cancer cell fraction" 116px against 106px buttons — the second had been
   clipping before its partner was spelled out. A two-column grid gains nothing
   for two options, so each takes the full width. */
export const AXES = [
  { value: "vaf", label: "Variant allele frequency", span: true },
  { value: "ccf", label: "Cancer cell fraction", span: true },
];
export const ASSUMED = [
  /* Page 1's "Given", on page 2's one correction. Nothing first, as there. */
  { value: "nothing", label: "Nothing" },
  { value: "purity", label: "Purity" },
];
