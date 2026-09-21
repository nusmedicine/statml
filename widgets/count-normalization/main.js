/* count-normalization — Expression Units (PHM5003 08 / 01-2 cells 16 and 22)
 *
 * THE MISCONCEPTION: a normalised unit is comparable everywhere, and FPKM and
 * TPM differ only in name. A read count depends on three things that are not
 * expression — the sample's depth, the gene's length, and what the other genes
 * did — and each unit divides out some of them. CPM divides out depth; FPKM
 * and TPM divide out depth and length; all three are shares of the sample's
 * total, so when some genes rise every unchanged gene's share falls. The size
 * factor (DESeq2's median of ratios) assumes most genes are unchanged and
 * reads the scale off them, which is why it survives a composition change and
 * a share does not — until most genes move one way, which the change control
 * reaches (2.6).
 *
 * ONE STAGE, his shape after three review rounds on 2026-09-21 (the record is
 * the catalogue's § Slot 77): the three confounds are three live data controls
 * and the unit is the reader's move. The figure is the sources' own device —
 * the HBC training page, StatQuest, Pimentel — a small table of genes × samples
 * where a WITHIN-sample comparison is reading down a column (gene 5 against
 * gene 6, the same expression per kilobase) and a BETWEEN-samples comparison is
 * reading across a row (gene 1 against itself, unchanged). No unit gets both
 * right, which is why a DE test takes counts and a size factor and a
 * gene-against-gene look takes TPM. Above the table, the six genes and their
 * reads as pile-ups (the count is the rectangles, the coverage is the pile's
 * depth); below it, 2,000 genes as a histogram of log2(B ÷ A), the HBC page's
 * DESeq2 figure, where the bulk of unchanged genes should sit at 0.
 *
 * THE NUMBERS, measured before the mock (`_lab/rnaseq-measure.mjs` M1, the
 * scratch `mor-fail.mjs` recorded in the catalogue): with 5% of genes up 8×
 * the unchanged genes shift −0.57 log2 under TPM and −0.02 under the size
 * factor; the size factor drifts from 40% of genes up one way and fails past
 * half. Zhao, Ye & Stanton 2020 (RNA 26:903) measured the misuse on real
 * samples: the top three genes hold 4.2% of transcripts under one library
 * protocol and 75% under another, so every other gene's TPM differs with
 * nothing changed.
 */
import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";

/* --- the stage ------------------------------------------------------------ */
/* Six genes AT READ SCALE, drawn as the HBC training page draws them: each
   gene a bar of its length, each read a rectangle piled above it, Sample A
   over Sample B. One expression per kilobase everywhere, so a within-sample
   comparison has a truth of 1.00; gene 5 (6 kb) is the one that rises. The
   sample's total of reads is FIXED at its depth (the sequencer's capacity), so
   the reads a rising gene takes come from every other gene. */
const LEN = [1, 2, 4, 1, 6, 0.5];
const PER_KB = 4;
const READ_KB = 0.25;      // one read, as a fraction of a gene
const CHANGED = { none: [], one: [4], most: [1, 2, 3, 4] };
const FOLD = 8;
const GENES = 2000;
const SHARE = { none: 0, one: 0.05, most: 0.6 };
/* reads per unit of expression × length in the 2,000-gene panel */
const PANEL_DEPTH = 0.1;
const UNITS = {
  raw: { label: "Raw count", short: "raw counts" },
  cpm: { label: "CPM", short: "CPM" },
  fpkm: { label: "FPKM", short: "FPKM" },
  tpm: { label: "TPM", short: "TPM" },
  sf: { label: "Size factor", short: "counts ÷ size factor" },
};
const DEPTHS = ["1", "2", "3", "10"];
const MIN_COUNT = 20;      // a gene counts toward the histogram only with counts over this in both samples
const PILE_H = 190;
const TABLE_H = 180;
const HIST_H = 156;
const GAP = 4;
const FIG_H = PILE_H + TABLE_H + HIST_H + 2 * GAP;
const ACT_H = 236;
const EASE_MS = 450;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/* --- the units ------------------------------------------------------------ */
const total = (c) => c.reduce((s, v) => s + v, 0);
const median = (a) => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const log2 = (x) => Math.log(x) / Math.LN2;
const big = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : fmt(v, v >= 100 ? 0 : 2));

/** One sample's counts in a unit. `sf` is that sample's size factor. */
function unitOf(counts, len, unit, sf = 1) {
  if (unit === "raw") return counts.slice();
  if (unit === "cpm") { const t = total(counts); return counts.map((v) => (1e6 * v) / t); }
  if (unit === "fpkm") { const t = total(counts); return counts.map((v, i) => (1e9 * v) / (t * len[i])); }
  if (unit === "tpm") { const r = counts.map((v, i) => v / len[i]); const t = total(r); return r.map((v) => (1e6 * v) / t); }
  return counts.map((v) => v / sf);
}

/** DESeq2's median of ratios for two samples: the geometric mean per gene over
    the genes counted in both, each sample's ratio to it, the median. Returns
    the two size factors and the per-gene table the walkthrough prints. */
function sizeFactors(A, B) {
  const rows = A.map((a, i) => ({ a, b: B[i], gm: a > 0 && B[i] > 0 ? Math.sqrt(a * B[i]) : NaN }));
  const kept = rows.filter((r) => Number.isFinite(r.gm));
  const sfA = median(kept.map((r) => r.a / r.gm));
  const sfB = median(kept.map((r) => r.b / r.gm));
  return { sfA, sfB, rows };
}

/* --- the data ------------------------------------------------------------- */
function poisson(rng, mu) {
  if (mu <= 0) return 0;
  if (mu < 40) { const L = Math.exp(-mu); let k = 0, p = 1; do { k += 1; p *= rng.next(); } while (p > L); return k - 1; }
  return Math.max(0, Math.round(mu + Math.sqrt(mu) * rng.normal()));
}

/** The six genes, exactly: counts are expression × length, no noise, so every
    number the table prints is the unit's own arithmetic. */
function toyFor(params) {
  const len = params.lengths === "equal" ? LEN.map(() => 2) : LEN;
  const depth = Number(params.depth);
  const changed = CHANGED[params.change];
  const A = len.map((l) => Math.round(PER_KB * l));
  let B = len.map((l, i) => PER_KB * l * depth * (changed.includes(i) ? FOLD : 1));
  const scale = (total(A) * depth) / total(B);   // the capacity: B's total is A's at B's depth
  B = B.map((v) => Math.max(1, Math.round(v * scale)));
  return { len, A, B, changed };
}

/* Read positions along each gene, packed into rows as a genome browser packs
   them: a read goes in the first row whose last read ends before it starts.
   Seeded, and computed once in compute(), so a pile is the same every frame. */
function pileUp(rng, n, lenKb) {
  const rows = [], placed = [];
  const starts = Array.from({ length: n }, () => rng.next() * Math.max(0.0001, lenKb - READ_KB)).sort((a, b) => a - b);
  for (const start of starts) {
    let r = 0;
    while (rows[r] !== undefined && rows[r] > start - 0.02) r += 1;
    rows[r] = start + READ_KB;
    placed.push([start, r]);
  }
  return placed;
}

/** 2,000 genes with Poisson counts, the same three confounds as the six. */
function panelFor(params, rng) {
  const len = Array.from({ length: GENES }, () => (params.lengths === "equal" ? 2 : Math.exp(rng.normal(Math.log(2), 0.7))));
  const expr = Array.from({ length: GENES }, () => Math.exp(rng.normal(Math.log(30), 1.6)));
  const changed = new Set();
  const n = Math.round(SHARE[params.change] * GENES);
  while (changed.size < n) changed.add(Math.floor(rng.next() * GENES));
  const exprB = expr.map((v, i) => (changed.has(i) ? v * FOLD : v));
  const depth = Number(params.depth);
  const scale = total(expr.map((v, i) => v * len[i])) / total(exprB.map((v, i) => v * len[i]));
  const A = expr.map((v, i) => poisson(rng, v * len[i] * PANEL_DEPTH));
  const B = exprB.map((v, i) => poisson(rng, v * len[i] * PANEL_DEPTH * depth * scale));
  return { len, A, B, changed };
}

/* --- the formula card (his ask, 2026-09-21: the formulas in MathML) -------- *
 * Two rows above the figure: the unit's definition, and the same definition
 * with gene 1 of sample A's numbers in it, so the reader can check one
 * rectangle count against one printed value. Rendered as MathML where the
 * browser draws it and as plain text where it does not, the way widget 33's
 * equation card is; the host is the same `.w-math` card, whose text the
 * fingerprint's `tx` hash covers. */
const MATHML = mathmlRenders();
const M = {
  sub: (b, i) => `<msub><mi>${b}</mi><mi>${i}</mi></msub>`,
  frac: (a, b) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`,
  num: (v) => `<mn>${v}</mn>`,
  wrap: (inner) => `<math><mrow>${inner}</mrow></math>`,
  pow10: (k) => `<mo>&#xD7;</mo><msup><mn>10</mn><mn>${k}</mn></msup>`,
};

/** the unit's definition and its instance for gene 1 of sample A, both as MathML and as text */
function formulaFor(state) {
  const { toy, tsf } = state;
  const x = toy.A[0], N = total(toy.A), L = toy.len[0];
  const perKb = total(toy.A.map((v, i) => v / toy.len[i]));
  const gm = Math.sqrt(toy.A[0] * toy.B[0]);
  const u = state.unit;
  const xg = M.sub("x", "g"), Lg = M.sub("L", "g"), N_ = "<mi>N</mi>";
  const sum = (inner) => `<munder><mo>&#x2211;</mo><mi>j</mi></munder>${inner}`;
  if (u === "raw") return {
    math: M.wrap(`${xg}<mo>=</mo><mtext>reads mapped to gene g</mtext>`),
    plain: "x_g = reads mapped to gene g",
    instMath: M.wrap(`${M.sub("x", "1")}<mo>=</mo>${M.num(x)}`),
    inst: `x_1 = ${x}`,
    note: `N = ${N} reads in sample A`,
  };
  if (u === "cpm") return {
    math: M.wrap(`${M.sub("CPM", "g")}<mo>=</mo>${M.frac(xg, N_)}${M.pow10(6)}`),
    plain: "CPM_g = x_g / N × 10⁶",
    instMath: M.wrap(`${M.frac(M.num(x), M.num(N))}${M.pow10(6)}<mo>=</mo>${M.num(big((x / N) * 1e6))}`),
    inst: `${x} / ${N} × 10⁶ = ${big((x / N) * 1e6)}`,
    note: `N = Σ x_j, the reads in the sample: depth divided out`,
  };
  if (u === "fpkm") return {
    math: M.wrap(`${M.sub("FPKM", "g")}<mo>=</mo>${M.frac(xg, `${N_}<mo>/</mo><msup><mn>10</mn><mn>6</mn></msup><mo>&#x22C5;</mo>${Lg}`)}`),
    plain: "FPKM_g = x_g / (N / 10⁶ · L_g)",
    instMath: M.wrap(`${M.frac(M.num(x), `${M.num(N)}<mo>/</mo><msup><mn>10</mn><mn>6</mn></msup><mo>&#x22C5;</mo>${M.num(L)}`)}<mo>=</mo>${M.num(big(x / ((N / 1e6) * L)))}`),
    inst: `${x} / (${N} / 10⁶ · ${L}) = ${big(x / ((N / 1e6) * L))}`,
    note: `L_g in kilobases: depth and length divided out, in that order`,
  };
  if (u === "tpm") return {
    math: M.wrap(`${M.sub("TPM", "g")}<mo>=</mo>${M.frac(`${xg}<mo>/</mo>${Lg}`, sum(`<mrow>${M.sub("x", "j")}<mo>/</mo>${M.sub("L", "j")}</mrow>`))}${M.pow10(6)}`),
    plain: "TPM_g = (x_g / L_g) / Σ_j (x_j / L_j) × 10⁶",
    instMath: M.wrap(`${M.frac(`${M.num(x)}<mo>/</mo>${M.num(L)}`, M.num(fmt(perKb, 1)))}${M.pow10(6)}<mo>=</mo>${M.num(big(((x / L) / perKb) * 1e6))}`),
    inst: `(${x} / ${L}) / ${fmt(perKb, 1)} × 10⁶ = ${big(((x / L) / perKb) * 1e6)}`,
    note: `length divided out first, then the sample's total of the result: every sample sums to a million`,
  };
  return {
    math: M.wrap(`${M.sub("s", "A")}<mo>=</mo><munder><mi>median</mi><mi>g</mi></munder><mo>(</mo>${M.frac(M.sub("x", "gA"), `<msqrt>${M.sub("x", "gA")}<mo>&#x22C5;</mo>${M.sub("x", "gB")}</msqrt>`)}<mo>)</mo><mo>,</mo><mspace width="0.6em"></mspace>${M.frac(M.sub("x", "gA"), M.sub("s", "A"))}`),
    plain: "s_A = median_g ( x_gA / √(x_gA · x_gB) ), then x_gA / s_A",
    instMath: M.wrap(`${M.frac(M.num(x), `<msqrt>${M.num(x)}<mo>&#x22C5;</mo>${M.num(toy.B[0])}</msqrt>`)}<mo>=</mo>${M.num(fmt(x / gm, 2))}<mo>,</mo><mspace width="0.6em"></mspace>${M.sub("s", "A")}<mo>=</mo>${M.num(fmt(tsf.sfA, 2))}<mo>,</mo><mspace width="0.6em"></mspace>${M.frac(M.num(x), M.num(fmt(tsf.sfA, 2)))}<mo>=</mo>${M.num(fmt(x / tsf.sfA, 2))}`),
    inst: `${x} / √(${x} · ${toy.B[0]}) = ${fmt(x / gm, 2)}, s_A = ${fmt(tsf.sfA, 2)}, ${x} / ${fmt(tsf.sfA, 2)} = ${fmt(x / tsf.sfA, 2)}`,
    note: `the geometric mean over the two samples; the median over the six genes is the size factor`,
  };
}

let mathHost = null, mathKey = null;
function renderFormula(state) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const F = formulaFor(state);
  const key = `${state.unit}|${F.inst}`;
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) => `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  mathHost.innerHTML = row("the unit", `<span style="color:var(--ink-2)">${MATHML ? F.math : F.plain}</span>`)
    + row("gene 1, sample A", `<span style="color:var(--c-empirical)">${MATHML ? F.instMath : F.inst}</span>`)
    + `<div class="w-math-note">${F.note}</div>`;
}

/* --- one geometry, read by the drawing and by the hover test (5.8) -------- */
const TABLE = { cx: { gene: 44, len: 108, A: 208, B: 328 }, rh: 17, headDy: 32, colW: 64 };
function pileLayout(w, toy) {
  const padL = 74, padR = 10, gap = 14, n = toy.len.length;
  const pxPerKb = (w - padL - padR - gap * (n - 1)) / total(toy.len);
  const laneH = (PILE_H - 30) / 2;
  const gx = [], gw = [];
  let x = padL;
  for (let i = 0; i < n; i += 1) { gx.push(x); gw.push(toy.len[i] * pxPerKb); x += toy.len[i] * pxPerKb + gap; }
  const base = (k) => 22 + laneH * (k + 1) - 14;
  return { padL, padR, gap, pxPerKb, laneH, gx, gw, base };
}

/* HOVER (his ask, 2026-09-21): pointing at a gene, in the piles or in the
   table, reads that gene both ways — between the samples (its own row) and
   within the sample pointed at (against gene 1, or gene 6 when it is gene 1).
   Nothing is written; with no pointer the figure is exactly as before. */
function hoverAt(pointer, w, state) {
  if (!pointer) return null;
  const { toy } = state;
  const { x, y } = pointer;
  const L = pileLayout(w, toy);
  for (let k = 0; k < 2; k += 1) {
    const base = L.base(k);
    if (y >= base - L.laneH + 14 && y <= base + 14) {
      for (let i = 0; i < toy.len.length; i += 1) if (x >= L.gx[i] - L.gap / 2 && x <= L.gx[i] + L.gw[i] + L.gap / 2) return { gene: i, sample: k };
    }
  }
  const ty = PILE_H + GAP, first = ty + TABLE.headDy + 18;
  for (let i = 0; i < 6; i += 1) {
    const rowTop = first + i * TABLE.rh - 12, rowBot = rowTop + TABLE.rh;
    if (y < rowTop || y > rowBot) continue;
    if (x >= TABLE.cx.A - TABLE.colW && x <= TABLE.cx.A + 8) return { gene: i, sample: 0 };
    if (x >= TABLE.cx.B - TABLE.colW && x <= TABLE.cx.B + 8) return { gene: i, sample: 1 };
    if (x >= 10 && x < TABLE.cx.A - TABLE.colW) return { gene: i, sample: 0 };
  }
  return null;
}

/* The two readings the table brackets, which is what a unit change eases:
   the table and the histogram crossfade because their numbers and axes change
   with the unit, and a number sliding is a number the reader can follow. */
const readings = (state) => ({ within: state.within, between: state.between });
const mixReadings = (a, b, e) => ({ within: a.within + (b.within - a.within) * e, between: a.between + (b.between - a.between) * e });

defineWidget({
  slug: "count-normalization",
  title: "Expression Units",
  /* S1 of three, his pick: concept first, mechanism second (2.10). */
  subtitle:
    "A read count depends on the sample's depth and the gene's length as well "
    + "as its expression. CPM, FPKM and TPM divide these out, but each is a "
    + "share of the sample's total, so when some genes rise every other gene's "
    + "share falls. A size factor takes the scale from the genes that did not change.",
  layout: "side",
  status: "draft",
  pointer: true,
  /* The walkthrough is a stage that has to give its pixels back (3.4b). */
  height: ({ unit, act }) => (unit === "sf" && act ? FIG_H + ACT_H : FIG_H),

  params: {
    data: { type: "section", label: "The data" },

    /* All three confounds live at once, his shape: the widget opens with
       every one of them on and the unit as the reader's move. */
    depth: {
      type: "choice", label: "Depth of sample B",
      detail: "reads sequenced, relative to sample A",
      options: DEPTHS.map((d) => ({ value: d, label: `${d}×` })), default: "3",
    },
    lengths: {
      type: "segmented", label: "Gene lengths",
      detail: "every gene at one expression per kilobase",
      options: [{ value: "equal", label: "Equal" }, { value: "differ", label: "Differ" }], default: "differ",
    },
    change: {
      type: "segmented", label: "Genes that change in B",
      detail: "8× up; the sample's total of reads is fixed",
      options: [
        { value: "none", label: "None" },
        { value: "one", label: "Gene 5", detail: "one of the six; 5% of the 2,000" },
        { value: "most", label: "Genes 2–5", detail: "four of the six; 60% of the 2,000" },
      ],
      default: "one",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* --- THE UNIT ------------------------------------------------------- *
     * Two columns, as widget 39's method picker: five labels in one row get
     * 45px each and "Size factor" needs more. Raw spans, the four units form
     * a 2×2 under it. */
    unitSec: { type: "section", label: "The unit", detail: "what one number in the table means" },
    unit: {
      type: "segmented", style: "grid", label: "Unit",
      options: [
        /* each detail names what the unit divides out, which is the HBC
           training table's column and the thing his question turned on */
        { value: "raw", label: UNITS.raw.label, span: true, detail: "reads mapped to the gene; what DESeq2 takes" },
        { value: "cpm", label: UNITS.cpm.label, detail: "per million reads in the sample: depth" },
        { value: "fpkm", label: UNITS.fpkm.label, detail: "per kilobase per million reads: depth and length; the sums differ between samples" },
        { value: "tpm", label: UNITS.tpm.label, detail: "per kilobase, then per million of the result: depth and length; sums to a million" },
        { value: "sf", label: UNITS.sf.label, detail: "counts ÷ the sample's median ratio to the geometric mean: depth and composition" },
      ],
      default: "raw",
      /* Display: the counts are the data and the unit is how they are read, so
         a unit change eases the figure between two readings of the same table
         instead of resetting anything (core's display ease, as widget 12). */
      display: true,
    },

    /* The walkthrough belongs to the one unit with a procedure, and sits under
       the control that chose it (2.7); behind a gate because it is a stage the
       reader has not entered (3.4b). */
    act: {
      type: "gate",
      label: "Show how the size factor is computed",
      labelOff: "Hide the table",
      detail: "the six genes: geometric mean, ratio, median",
      default: false,
      display: true,
      when: { param: "unit", equals: "sf" },
    },
  },

  /* one hue means one thing — a gene's data — and a sample is a row with a
     name (his pick, scheme A) */
  legend: ({ params }) => {
    const L = [{ token: "empirical", label: "A read; a gene of the 2,000", mark: "bar" }];
    if (params.change !== "none") L.push({ token: "highlight", label: "A gene that changed", mark: "bar" });
    L.push({ token: "reference", label: "Equal in A and B", mark: "line" });
    L.push({ token: "reference", label: "Median over all 2,000 genes", mark: "dash" });
    return L;
  },

  /* Pure and seeded; runs on parameter change only. Every number on the
     figure and in the tiles is computed here, once (5.8). */
  compute: ({ params, rng }) => {
    const toy = toyFor(params);
    toy.reads = { A: toy.A.map((n, i) => pileUp(rng, n, toy.len[i])), B: toy.B.map((n, i) => pileUp(rng, n, toy.len[i])) };
    const panel = panelFor(params, rng);
    const unit = params.unit;

    const tsf = sizeFactors(toy.A, toy.B);
    const psf = sizeFactors(panel.A, panel.B);
    const toyU = { A: unitOf(toy.A, toy.len, unit, tsf.sfA), B: unitOf(toy.B, toy.len, unit, tsf.sfB) };
    const panU = { A: unitOf(panel.A, panel.len, unit, psf.sfA), B: unitOf(panel.B, panel.len, unit, psf.sfB) };

    /* the two readings: within sample A, gene 5 against gene 6 (one expression
       per kilobase, so 1.00 is right); between samples, gene 1 against itself
       (unchanged, so 1.00 is right) */
    const within = toyU.A[4] / toyU.A[5];
    const between = toyU.B[0] / toyU.A[0];

    /* the histogram of log2(B ÷ A) over the 2,000, genes counted in both */
    const shifts = [], changedShifts = [];
    for (let i = 0; i < GENES; i += 1) {
      if (!(panel.A[i] > MIN_COUNT && panel.B[i] > MIN_COUNT)) continue;
      const v = log2(panU.B[i] / panU.A[i]);
      (panel.changed.has(i) ? changedShifts : shifts).push(v);
    }
    const medianAll = median([...shifts, ...changedShifts]);

    return {
      toy, panel, toyU, panU, tsf, psf, unit,
      within, between,
      shifts, changedShifts, medianAll,
      medianUnchanged: shifts.length ? median(shifts) : 0,
    };
  },

  /* THE ONLY MOTION IS THE UNIT CHANGE (his ask, 2026-09-21). The two bracket
     numbers count to their new values; the table and the histogram crossfade,
     because their numbers and axes change with the unit. No Step, no Play
     (4.5): there is nothing to take one of. */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => ({ unit: params.unit, easeT: 1, from: null, fromState: null, easing: false }),
    advance: (anim, { dt }) => {
      if (anim.mode !== "ease") return false;
      anim.easeT = Math.min(1, anim.easeT + dt / EASE_MS);
      if (anim.easeT >= 1) { anim.from = null; anim.fromState = null; }
      return anim.easeT < 1;
    },
    rebuild: (anim, { params, state }) => {
      if (params.unit !== anim.unit) {
        /* start from wherever the numbers are now, so a unit chosen mid-ease
           continues rather than jumping back */
        anim.from = anim.from && anim.easeT < 1 ? mixReadings(anim.from, readings(anim.lastState), easeInOut(anim.easeT)) : readings(anim.lastState);
        anim.fromState = anim.lastState;
        anim.unit = params.unit;
        anim.easeT = 0;
        anim.easing = true;
      }
      anim.lastState = state;
    },
  },

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    renderFormula(state);
    if (anim) anim.lastState = state;
    const e = anim && anim.easeT < 1 ? easeInOut(anim.easeT) : 1;
    const r = e < 1 && anim.from ? mixReadings(anim.from, readings(state), e) : readings(state);
    const hover = hoverAt(pointer, w, state);
    drawPiles(ctx, colors, w, 0, state, hover);
    const ty = PILE_H + GAP, hy = ty + TABLE_H + GAP;
    if (e < 1 && anim.fromState) {
      drawTable(ctx, colors, w, ty, anim.fromState, r, 1 - e, hover);
      drawTable(ctx, colors, w, ty, state, r, e, hover);
      drawHist(ctx, colors, w, hy, anim.fromState, 1 - e);
      drawHist(ctx, colors, w, hy, state, e);
    } else {
      drawTable(ctx, colors, w, ty, state, r, 1, hover);
      drawHist(ctx, colors, w, hy, state, 1);
    }
    if (params.unit === "sf" && params.act) drawAct(ctx, colors, w, FIG_H, state);
  },

  readout: ({ state }) => {
    const u = UNITS[state.unit].short;
    return [
      { label: "Within sample A: gene 5 ÷ gene 6", value: fmt(state.within, 2), note: `the same expression per kilobase, in ${u}; 1.00 is right` },
      { label: "Between samples: gene 1, B ÷ A", value: fmt(state.between, 2), note: `unchanged, in ${u}; 1.00 is right` },
      { label: "2,000 unchanged genes, median log2(B ÷ A)", value: fmt(state.medianUnchanged, 2), note: `${state.shifts.length.toLocaleString("en")} genes with counts over ${MIN_COUNT} in both; 0 is right` },
    ];
  },
});

/* --- the six genes and their reads --------------------------------------- */
function drawPiles(ctx, colors, w, y0, state, hover) {
  const { toy } = state;
  const n = toy.len.length;
  const L = pileLayout(w, toy);
  const { padL, padR, gap, pxPerKb, laneH } = L;
  /* rows shrink so the deepest pile fits its lane under the count label */
  const deepest = 1 + Math.max(0, ...toy.reads.A.flat().map(([, r]) => r), ...toy.reads.B.flat().map(([, r]) => r));
  const rowH = Math.min(5, (laneH - 30) / deepest);
  const readH = Math.max(1.5, rowH - 1);
  const clampX = (x) => Math.min(Math.max(x, padL + 16), w - padR - 16);

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
  ctx.fillText("Six genes and their reads", padL, y0 + 14);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3; ctx.textAlign = "right";
  ctx.fillText("a read is one rectangle; a pile's depth is the coverage", w - padR, y0 + 14);

  [["A", toy.A, toy.reads.A, 0], ["B", toy.B, toy.reads.B, 1]].forEach(([name, counts, reads, k]) => {
    const base = y0 + L.base(k);
    if (hover) {
      /* the hovered gene's span in both lanes (between), and its lane (within) */
      ctx.fillStyle = colors.surface3;
      ctx.fillRect(L.gx[hover.gene] - gap / 2, base - laneH + 16, L.gw[hover.gene] + gap, laneH - 2);
      if (k === hover.sample) ctx.fillRect(padL - gap / 2, base - laneH + 16, w - padL - padR + gap, 3);
    }
    ctx.textAlign = "left";
    ctx.font = `600 ${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2;
    ctx.fillText(`Sample ${name}`, 4, base - 12);
    ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3;
    ctx.fillText(`${total(counts)} reads`, 4, base);
    let gx = padL;
    for (let i = 0; i < n; i += 1) {
      const gw = toy.len[i] * pxPerKb;
      const changed = toy.changed.includes(i);
      ctx.fillStyle = colors.ink3;
      ctx.fillRect(gx, base, gw, 3);
      ctx.fillStyle = changed ? colors.highlight : colors.empirical;
      let top = -1;
      for (const [start, r] of reads[i]) {
        top = Math.max(top, r);
        ctx.fillRect(gx + start * pxPerKb, base - 2 - (r + 1) * rowH, Math.max(2, READ_KB * pxPerKb - 1), readH);
      }
      ctx.textAlign = "center";
      const cx = clampX(gx + gw / 2);
      ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3;
      ctx.fillText(String(counts[i]), cx, base - 6 - (top + 1) * rowH);
      if (k === 1) {
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.fillText(`gene ${i + 1}`, cx, base + 13);
      }
      gx += gw + gap;
    }
  });
  ctx.restore();
}

/* --- the table: within is a column, between is a row ---------------------- */
function drawTable(ctx, colors, w, y0, state, r, fade, hover) {
  const { toy, toyU } = state;
  const u = UNITS[state.unit].short;
  const cx = TABLE.cx;
  const rh = TABLE.rh, head = y0 + TABLE.headDy, first = head + 18;
  const mx = cx.B + 14;   // the margin where the two readings are named
  ctx.save();
  ctx.globalAlpha = fade;
  if (hover) {
    /* the row is the between reading, the column the within one */
    ctx.fillStyle = colors.surface3;
    ctx.fillRect(10, first + hover.gene * rh - 12, cx.B - 2, rh);
    const colX = hover.sample ? cx.B : cx.A;
    ctx.fillRect(colX - TABLE.colW, first - 12, TABLE.colW + 8, 6 * rh);
  }
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
  ctx.fillText(`The six genes in ${u}`, 10, y0 + 14);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "right";
  [["gene", cx.gene], ["length", cx.len], ["sample A", cx.A], ["sample B", cx.B]].forEach(([s, x]) => ctx.fillText(s, x, head));
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, head + 5.5); ctx.lineTo(cx.B + 8, head + 5.5); ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  for (let i = 0; i < 6; i += 1) {
    const y = first + i * rh, changed = toy.changed.includes(i);
    ctx.fillStyle = changed ? colors.highlight : colors.ink1;
    ctx.fillText(String(i + 1), cx.gene, y);
    ctx.fillStyle = colors.ink2; ctx.fillText(`${toy.len[i]} kb`, cx.len, y);
    ctx.fillStyle = changed ? colors.highlight : colors.ink1;
    ctx.fillText(big(toyU.A[i]), cx.A, y);
    ctx.fillText(big(toyU.B[i]), cx.B, y);
  }
  const ty = first + 6 * rh;
  ctx.beginPath(); ctx.moveTo(10, ty - 12.5); ctx.lineTo(cx.B + 8, ty - 12.5); ctx.stroke();
  ctx.fillStyle = colors.ink3; ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillText("total", cx.gene, ty);
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  ctx.fillText(big(total(toyU.A)), cx.A, ty);
  ctx.fillText(big(total(toyU.B)), cx.B, ty);

  ctx.textAlign = "left";
  const name = (s, y, v, right) => {
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = Math.abs(v - right) > 0.01 * right ? colors.extreme : colors.ink1;
    ctx.fillText(`${s} = ${fmt(v, 2)}`, mx, y);
  };
  const note = (s, y) => { ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.fillText(s, mx, y); };
  ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1.2;
  if (hover) {
    /* the hovered gene, both ways: its row between the samples, and its
       column against gene 1 (gene 6 when it is gene 1). "Right" is what the
       stage set: 1.00, or the fold for a gene that changed, in sample B */
    const g = hover.gene, k = hover.sample, other = g === 0 ? 5 : 0;
    const U = k ? toyU.B : toyU.A, S = k ? "B" : "A";
    const changedIn = (i) => (k === 1 && toy.changed.includes(i) ? FOLD : 1);
    const between = toyU.B[g] / toyU.A[g], betweenRight = toy.changed.includes(g) ? FOLD : 1;
    const within = U[g] / U[other], withinRight = changedIn(g) / changedIn(other);
    name(`between: gene ${g + 1}, B ÷ A`, first, between, betweenRight);
    note(`${toy.changed.includes(g) ? `up ${FOLD}×` : "unchanged"}: ${fmt(betweenRight, 2)} is right`, first + rh);
    name(`within ${S}: gene ${g + 1} ÷ gene ${other + 1}`, first + 4 * rh, within, withinRight);
    note(`one expression per kb${withinRight !== 1 ? `, gene ${g + 1} up ${FOLD}×` : ""}: ${fmt(withinRight, 2)} is right`, first + 5 * rh);
  } else {
    /* the within bracket: down column A between rows 5 and 6 */
    const bx = cx.A + 10, y5 = first + 4 * rh - 4, y6 = first + 5 * rh - 4;
    ctx.beginPath(); ctx.moveTo(bx - 4, y5 - 7); ctx.lineTo(bx, y5 - 7); ctx.lineTo(bx, y6 + 4); ctx.lineTo(bx - 4, y6 + 4); ctx.stroke();
    /* the between bracket: across gene 1's row, above it */
    const by = first - 13, bx1 = cx.A - 44, bx2 = cx.B + 6;
    ctx.beginPath(); ctx.moveTo(bx1, by + 4); ctx.lineTo(bx1, by); ctx.lineTo(bx2, by); ctx.lineTo(bx2, by + 4); ctx.stroke();
    /* the two readings, named in the margin; the numbers are the eased ones */
    name("between: gene 1, B ÷ A", first, r.between, 1);
    note("unchanged: 1.00 is right", first + rh);
    name("within A: gene 5 ÷ gene 6", first + 4 * rh, r.within, 1);
    note("one expression per kb: 1.00 is right", first + 5 * rh);
  }
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.fillText("point at a gene to read it both ways", mx, first + 6 * rh + 2);
  ctx.restore();
}

/* --- the 2,000 genes as a histogram of ratios ------------------------------ */
function drawHist(ctx, colors, w, y0, state, fade) {
  const u = UNITS[state.unit].short;
  const lo = -3, hi = 4, nb = 42;
  const hU = new Array(nb).fill(0), hC = new Array(nb).fill(0);
  const bin = (v) => Math.floor(((v - lo) / (hi - lo)) * nb);
  for (const v of state.shifts) { const k = bin(v); if (k >= 0 && k < nb) hU[k] += 1; }
  for (const v of state.changedShifts) { const k = bin(v); if (k >= 0 && k < nb) hC[k] += 1; }
  const hmax = Math.max(1, ...hU, ...hC);
  /* 36 below the baseline: the axis label sits 26px under it and the sweep
     found it 4px past the canvas at 30 */
  const padL = 44, padR = 12, top = y0 + 22, bottom = y0 + HIST_H - 36;
  ctx.save();
  ctx.globalAlpha = fade;
  const plot = makePlot({ ctx, colors, rect: { x: padL, y: top, w: w - padL - padR, h: bottom - top }, xDomain: [lo, hi], yDomain: [0, hmax] });
  plot.axisX({ ticks: [-3, -2, -1, 0, 1, 2, 3, 4], format: (v) => String(v), label: "log2(B ÷ A) per gene; 0 is equal" });
  plot.caption(`2,000 genes in ${u}: sample B against sample A`);
  const bw = (w - padL - padR) / nb;
  ctx.fillStyle = colors.empirical; ctx.globalAlpha = 0.8 * fade;
  hU.forEach((v, k) => { if (v) ctx.fillRect(plot.sx(lo + (k / nb) * (hi - lo)), plot.sy(v), bw - 1, plot.sy(0) - plot.sy(v)); });
  ctx.fillStyle = colors.highlight; ctx.globalAlpha = 0.85 * fade;
  hC.forEach((v, k) => { if (v) ctx.fillRect(plot.sx(lo + (k / nb) * (hi - lo)), plot.sy(v), bw - 1, plot.sy(0) - plot.sy(v)); });
  ctx.globalAlpha = fade;
  plot.vline(0, { stroke: colors.reference, width: 1.5 });
  ctx.save(); ctx.setLineDash([4, 3]); plot.vline(state.medianAll, { stroke: colors.ink1, width: 1 }); ctx.restore();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right";
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = Math.abs(state.medianUnchanged) > 0.05 ? colors.extreme : colors.ink1;
  ctx.fillText(`unchanged genes' median ${fmt(state.medianUnchanged, 2)}`, w - padR - 4, top + 12);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.fillText(`median over all, dashed: ${fmt(state.medianAll, 2)}`, w - padR - 4, top + 24);
  ctx.restore();
}

/* --- the size factor, as the notebook prints it -------------------------- */
function drawAct(ctx, colors, w, y0, state) {
  const { toy, tsf } = state;
  const cols = ["gene", "A", "B", "geometric mean", "A ÷ mean", "B ÷ mean"];
  const cx = [34, 96, 158, 244, 350, 440].map((x) => Math.min(x, w - 60));
  const rh = 22, headY = y0 + 40, rowY = headY + 22;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink1; ctx.textAlign = "left";
  ctx.fillText("The size factor: each sample's median ratio to the geometric mean", 34, y0 + 20);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  cols.forEach((c, k) => ctx.fillText(c, cx[k], headY));
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, headY + 6.5); ctx.lineTo(w - 30, headY + 6.5); ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  tsf.rows.forEach((r, i) => {
    const y = rowY + i * rh;
    ctx.fillStyle = toy.changed.includes(i) ? colors.highlight : colors.ink1;
    [String(i + 1), String(r.a), String(r.b), fmt(r.gm, 0), fmt(r.a / r.gm, 2), fmt(r.b / r.gm, 2)].forEach((s, k) => ctx.fillText(s, cx[k], y));
  });
  const my = rowY + tsf.rows.length * rh;
  ctx.beginPath(); ctx.moveTo(30, my - 14.5); ctx.lineTo(w - 30, my - 14.5); ctx.stroke();
  ctx.font = `600 ${colors.fsXs} ${colors.mono}`;
  ctx.fillStyle = colors.ink1;
  ctx.fillText("median", cx[0], my);
  ctx.fillText(fmt(tsf.sfA, 2), cx[4], my);
  ctx.fillText(fmt(tsf.sfB, 2), cx[5], my);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  /* the failing case in words: the median holds while the changed genes are
     the few, and moves with them once they are the many */
  const most = toy.changed.length >= 4;
  ctx.fillText(most
    ? "four of the six changed: the median sits among them, and the size factor moves with them"
    : "a changed gene's ratio is one value among six; the median takes the middle of the others", 34, my + 20);
  ctx.restore();
}
