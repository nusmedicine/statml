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
 * a share does not. The state where most genes move one way was built (round
 * 11) and CUT on his word (2026-09-22, round 12): every unit fails there, the
 * counts alone cannot tell "most up" from "a few down in a deeper library",
 * and the reader could not tell the method's limit from a broken widget. The
 * lesson rests on most genes being unchanged, and so does this widget.
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
 * depth); below it, THE SAME SIX GENES as a slope chart (his pick, round 15,
 * 2026-09-22): a dot per gene in sample A and in sample B on a log2 axis and
 * a line joining them, so a within reading is the height of the dots in one
 * column (the truth: every unchanged gene at one height, since all six have
 * one expression per kilobase) and a between reading is the slope of a line
 * (the truth: flat, or +3 for gene 5). One data set read three ways. A panel
 * of 2,000 simulated genes stood under the table for fourteen rounds — as a
 * histogram of log2(B ÷ A), then boxes, then the histogram again — and went
 * because it could only show between, and its genes were not the table's;
 * the sources (HBC, StatQuest, Pimentel) all teach on a table's worth of
 * genes. Every ratio carries its log2 (his ask the same day).
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
import { defineWidget, fmt, mathmlRenders } from "../core/index.js";

/* --- the stage ------------------------------------------------------------ */
/* Six genes AT READ SCALE, drawn as the HBC training page draws them: each
   gene a bar of its length, each read a rectangle piled above it, Sample A
   over Sample B. One expression per kilobase everywhere, so a within-sample
   comparison has a truth of 1.00; one gene rises in B. The
   sample's total of reads is FIXED at its depth (the sequencer's capacity), so
   the reads a rising gene takes come from every other gene. Which gene rises
   is the reader's pick (round 16): gene 5 holds 41% of the reads and moves
   every other gene's share; gene 6 holds 3% and moves almost nothing. */
const LEN = [1, 2, 4, 1, 6, 0.5];
const PER_KB = 4;
const READ_KB = 0.25;      // one read, as a fraction of a gene
const changedOf = (change) => (change === "none" ? [] : [Number(change) - 1]);
const FOLD = 8;
const UNITS = {
  raw: { label: "Raw count", short: "raw counts" },
  cpm: { label: "CPM", short: "CPM" },
  fpkm: { label: "FPKM", short: "FPKM" },
  tpm: { label: "TPM", short: "TPM" },
  sf: { label: "Size factor", short: "counts ÷ size factor" },
  /* the one that divides out all three, his call (2026-09-22): edgeR's
     rpkm() on TMM library sizes, GeTMM (Smid et al. 2018). Rare, because a
     DE test needs neither length nor a unit — only the counts and a size
     factor — and a within-sample look needs no composition correction */
  sfkb: { label: "Size factor per kb", short: "counts ÷ size factor ÷ kb" },
};
const DEPTHS = ["1", "2", "3", "10"];
const PILE_H = 190;
const TABLE_H = 180;
const SLOPE_H = 200;
const GAP = 4;
const FIG_H = PILE_H + TABLE_H + SLOPE_H + 2 * GAP;
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
  if (unit === "sfkb") return counts.map((v, i) => v / sf / len[i]);
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
/** The six genes, exactly: counts are expression × length, no noise, so every
    number the table prints is the unit's own arithmetic. */
function toyFor(params) {
  const len = params.lengths === "equal" ? LEN.map(() => 2) : LEN;
  const depth = Number(params.depth);
  const changed = changedOf(params.change);
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
  if (u === "sfkb") return {
    math: M.wrap(`${M.frac(M.sub("x", "gA"), `${M.sub("s", "A")}<mo>&#x22C5;</mo>${Lg}`)}`),
    plain: "x_gA / (s_A · L_g)",
    instMath: M.wrap(`${M.frac(M.num(x), `${M.num(fmt(tsf.sfA, 2))}<mo>&#x22C5;</mo>${M.num(L)}`)}<mo>=</mo>${M.num(fmt(x / tsf.sfA / L, 2))}`),
    inst: `${x} / (${fmt(tsf.sfA, 2)} · ${L}) = ${fmt(x / tsf.sfA / L, 2)}`,
    note: `the size factor, then the length in kilobases: depth, composition and length divided out`,
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

/* The slope chart's geometry, read by the drawing and by the hover test.
   The y scale comes from the values on show, which a unit change eases. */
function slopeLayout(w, y0) {
  const padL = 44, padR = 64, top = y0 + 26, bottom = y0 + SLOPE_H - 32;
  const pw = w - padL - padR;
  return { padL, padR, top, bottom, xA: padL + pw * 0.28, xB: padL + pw * 0.72 };
}
/* everything the axis must hold: the twelve values and gene 5's truth at B */
const slopeValues = (toy, UA, UB) => [...UA, ...UB, ...toy.changed.map((i) => UA[i] * FOLD)];
const slopeRange = (vals) => { const l = vals.map(log2); return { lo: Math.floor(Math.min(...l)) - 0.5, hi: Math.ceil(Math.max(...l)) + 0.5 }; };
const slopeY = (L, R, v) => L.bottom - ((log2(v) - R.lo) / (R.hi - R.lo)) * (L.bottom - L.top);

/* HOVER (his ask, 2026-09-21): pointing at a gene, in the piles, in the
   table or in the slope chart, reads that gene both ways — between the samples (its own row) and
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
  const SL = slopeLayout(w, ty + TABLE_H + GAP), R = slopeRange(slopeValues(toy, state.toyU.A, state.toyU.B));
  if (y >= SL.top - 8 && y <= SL.bottom + 8) {
    const k = Math.abs(x - SL.xA) <= 30 ? 0 : Math.abs(x - SL.xB) <= 30 ? 1 : -1;
    if (k >= 0) {
      const U = k ? state.toyU.B : state.toyU.A;
      let best = -1, d = 9;
      for (let i = 0; i < 6; i += 1) { const dy = Math.abs(y - slopeY(SL, R, U[i])); if (dy < d) { d = dy; best = i; } }
      if (best >= 0) return { gene: best, sample: k };
    }
  }
  return null;
}

/* THE FOCUS: which gene is read both ways. With no pointer it is gene 5 in
   sample A against gene 6 (the readout's own pair); under a pointer it is the
   gene pointed at, in the sample pointed at, against gene 1 (gene 6 when it
   is gene 1). The between reading is that gene's ROW, the within reading two
   cells of its COLUMN, and each is shaded in its own hue — `--c-group-a` and
   `--c-group-b`, the two arms of a comparison the reader chose (his round 6,
   2026-09-21: no brackets, the two shadings different). */
/* The default's two readings are on DIFFERENT genes — between on gene 1
   (unchanged, so its truth is 1.00), within on genes 5 and 6 — and a hover
   puts both on the gene pointed at. One focus carrying both, after the first
   version carried one gene and printed gene 1's number over gene 5's shaded
   row (his catch, 2026-09-22). */
const firstUnchanged = (toy) => (toy.changed.includes(0) ? 1 : 0);
const focusOf = (hover, toy) => (hover
  ? { between: hover.gene, within: hover.gene, other: hover.gene === 0 ? 5 : 0, sample: hover.sample }
  : { between: firstUnchanged(toy), within: 4, other: 5, sample: 0 });
const WASH = 0.22;

/* The two readings the table brackets, which is what a unit change eases:
   the table crossfades because its numbers change with the unit, the slope
   chart's dots slide, and a number sliding is a number the reader can follow. */
const readings = (state) => ({ within: state.within, between: state.between });
const mixReadings = (a, b, e) => ({ within: a.within + (b.within - a.within) * e, between: a.between + (b.between - a.between) * e });

defineWidget({
  slug: "count-normalization",
  title: "Bulk RNA-seq: Normalization",
  /* S1 of three, his pick: concept first, mechanism second (2.10). */
  /* S4, his pick (2026-09-22) over the version that named the methods and
     ended on the test: the approaches, no vocabulary, the names left to the
     unit control; the test is widget 78's. S5 (round 17, the same day) on his
     catch that S4 personified — "a count carries", "what the other genes
     did", "dividing compares" — the same content in literal verbs: depends
     on, removes, are comparable. */
  subtitle:
    "A read count depends on sequencing depth, gene length and library "
    + "composition as well as the gene's expression. Division by the sample's "
    + "reads and by the gene's length removes depth and length, so genes are "
    + "comparable within a sample; division by a size factor estimated from "
    + "the unchanged genes removes depth and composition, so a gene is "
    + "comparable between samples. Both divisions are needed for both "
    + "comparisons.",
  layout: "side",
  status: "shipped",
  pointer: true,
  /* The walkthrough is a stage that has to give its pixels back (3.4b). */
  height: ({ unit, act }) => ((unit === "sf" || unit === "sfkb") && act ? FIG_H + ACT_H : FIG_H),

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
      type: "segmented", label: "Gene that changes in B",
      detail: "8× up, with the sample's total of reads fixed: fewer reads are left for the other genes",
      options: [{ value: "none", label: "None" }, ...LEN.map((l, i) => ({ value: String(i + 1), label: String(i + 1) }))],
      default: "5",
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
        { value: "cpm", label: UNITS.cpm.label, detail: "per million reads: divides out depth" },
        { value: "fpkm", label: UNITS.fpkm.label, detail: "per kilobase per million reads: divides out depth and length; the sums differ between samples" },
        { value: "tpm", label: UNITS.tpm.label, detail: "per kilobase, then per million: divides out depth and length; every sample sums to a million" },
        { value: "sf", label: UNITS.sf.label, detail: "counts ÷ the sample's size factor: divides out depth and composition" },
        { value: "sfkb", label: UNITS.sfkb.label, span: true, detail: "counts ÷ size factor ÷ kilobases: divides out all three (edgeR's TMM-RPKM, GeTMM)" },
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
      when: { param: "unit", oneOf: ["sf", "sfkb"] },
    },
  },

  /* one hue means one thing — a gene's data — and a sample is a row with a
     name (his pick, scheme A) */
  legend: ({ params }) => {
    const L = [{ token: "empirical", label: "A read; an unchanged gene", mark: "bar" }];
    if (params.change !== "none") L.push({ token: "highlight", label: "A gene that changed", mark: "bar" });
    L.push({ token: "between", label: "Between samples: one gene in both", mark: "bar" });
    L.push({ token: "within", label: "Within a sample: two genes in one", mark: "bar" });
    L.push({ token: "reference", label: "Truth for an unchanged gene: one height, level", mark: "line" });
    if (params.change !== "none") L.push({ token: "highlight", label: "Truth for the changed gene in B: 8× its A", mark: "dash" });
    return L;
  },

  /* Pure and seeded; runs on parameter change only. Every number on the
     figure and in the tiles is computed here, once (5.8). */
  compute: ({ params, rng }) => {
    const toy = toyFor(params);
    toy.reads = { A: toy.A.map((n, i) => pileUp(rng, n, toy.len[i])), B: toy.B.map((n, i) => pileUp(rng, n, toy.len[i])) };
    const unit = params.unit;

    const tsf = sizeFactors(toy.A, toy.B);
    const toyU = { A: unitOf(toy.A, toy.len, unit, tsf.sfA), B: unitOf(toy.B, toy.len, unit, tsf.sfB) };

    /* the two readings: within sample A, gene 5 against gene 6 (one expression
       per kilobase, so 1.00 is right); between samples, gene 1 against itself
       (unchanged, so 1.00 is right) */
    const within = toyU.A[4] / toyU.A[5];
    const b = firstUnchanged(toy);
    const between = toyU.B[b] / toyU.A[b];

    /* the unchanged genes' level in sample A: the within truth's height */
    const levelA = median(toy.A.map((v, i) => i).filter((i) => !toy.changed.includes(i)).map((i) => toyU.A[i]));

    return { toy, toyU, tsf, unit, within, between, levelA };
  },

  /* THE ONLY MOTION IS THE UNIT CHANGE (his ask, 2026-09-21). The two bracket
     numbers count to their new values; the table crossfades, because its
     numbers change with the unit; the slope chart's dots slide to their new
     heights. No Step, no Play (4.5): there is nothing to take one of. */
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
      drawSlope(ctx, colors, w, hy, state, hover, anim.fromState, e);
    } else {
      drawTable(ctx, colors, w, ty, state, r, 1, hover);
      drawSlope(ctx, colors, w, hy, state, hover, null, 1);
    }
    if ((params.unit === "sf" || params.unit === "sfkb") && params.act) drawAct(ctx, colors, w, FIG_H, state);
  },

  readout: ({ state }) => {
    const u = UNITS[state.unit].short;
    return [
      /* the log2 beside every ratio (his ask, round 15): a fold change is read in log2 */
      { label: "Within sample A: gene 5 ÷ gene 6", value: fmt(state.within, 2), note: `log2 ${fmt(log2(state.within), 2)} · truth 1.00, log2 0 · the same expression per kilobase, in ${u}` },
      { label: `Between samples: gene ${firstUnchanged(state.toy) + 1}, B ÷ A`, value: fmt(state.between, 2), note: `log2 ${fmt(log2(state.between), 2)} · truth 1.00, log2 0 · unchanged, in ${u}` },
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
    {
      /* between: the focus gene's span in both lanes; within: the two genes'
         spans in the focus lane, each in its own hue */
      const F = focusOf(hover, toy);
      const span = (i) => ctx.fillRect(L.gx[i] - gap / 2, base - laneH + 16, L.gw[i] + gap, laneH - 2);
      ctx.save();
      ctx.globalAlpha = WASH; ctx.fillStyle = colors.between; span(F.between);
      if (k === F.sample) { ctx.fillStyle = colors.within; span(F.within); span(F.other); }
      ctx.restore();
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
  /* the margin where the two readings are named: 24px clear of column B's
     numbers at the narrowest canvas (the longest line still fits), and up to
     60px at a wide one — his screenshot at 960px had the swatch on the numbers */
  const mx = cx.B + 24 + Math.max(0, Math.min(36, (w - 534) / 6));
  ctx.save();
  ctx.globalAlpha = fade;
  const F = focusOf(hover, toy);
  {
    /* between: the focus gene's row across both samples; within: its cell
       and the comparator's in the focus column, each in its own hue */
    ctx.save();
    ctx.globalAlpha = WASH * fade;
    ctx.fillStyle = colors.between;
    ctx.fillRect(cx.A - TABLE.colW, first + F.between * rh - 12, cx.B - cx.A + TABLE.colW + 8, rh);
    const colX = F.sample ? cx.B : cx.A;
    ctx.fillStyle = colors.within;
    ctx.fillRect(colX - TABLE.colW, first + F.within * rh - 12, TABLE.colW + 8, rh);
    ctx.fillRect(colX - TABLE.colW, first + F.other * rh - 12, TABLE.colW + 8, rh);
    ctx.restore();
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
  /* the two readings, named in the margin beside a swatch of their hue: the
     number, then the truth the stage set — 1.00, or the fold for a gene that
     changed in sample B */
  const reading = (hue, title, y, v, truth, why) => {
    ctx.save(); ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = hue; ctx.fillRect(mx - 12, y - 8, 8, 8); ctx.restore();
    /* three lines in one shape (his round 16: "so much truth everywhere"):
       the name of the reading; its value, ratio then log2; the truth, ratio
       then log2. The margin is 182px at the narrowest canvas, which is why
       the value is not on the name's line. */
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2;
    ctx.fillText(title, mx, y);
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = Math.abs(v - truth) > 0.01 * truth ? colors.extreme : colors.ink1;
    ctx.fillText(`${fmt(v, 2)} · log2 ${fmt(log2(v), 2)}`, mx, y + rh);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.fillText(`truth ${fmt(truth, 2)} · log2 ${fmt(Math.log2(truth), 0)} · ${why}`, mx, y + 2 * rh);
  };
  const gb = F.between, gw = F.within, k = F.sample, other = F.other;
  const U = k ? toyU.B : toyU.A, S = k ? "B" : "A";
  const changedIn = (i) => (k === 1 && toy.changed.includes(i) ? FOLD : 1);
  /* with no pointer the numbers are the eased ones, so a unit change counts them along */
  const between = hover ? toyU.B[gb] / toyU.A[gb] : r.between, betweenTruth = toy.changed.includes(gb) ? FOLD : 1;
  const within = hover ? U[gw] / U[other] : r.within, withinTruth = changedIn(gw) / changedIn(other);
  reading(colors.between, `between: gene ${gb + 1}, B ÷ A`, first, between, betweenTruth, toy.changed.includes(gb) ? `up ${FOLD}×` : "unchanged");
  reading(colors.within, `within ${S}: gene ${gw + 1} ÷ gene ${other + 1}`, first + 4 * rh, within, withinTruth, withinTruth !== 1 ? `gene ${gw + 1} up ${FOLD}×` : "same per kb");
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.fillText("point at a gene to read it both ways", mx, first + 7 * rh + 2);
  ctx.restore();
}

/* --- the six genes as a slope chart: within is a column, between is a line -- */
function drawSlope(ctx, colors, w, y0, state, hover, fromState, e) {
  const { toy } = state;
  const u = UNITS[state.unit].short;
  /* a unit change slides every dot from its old height to its new one */
  const mixU = (a, b) => (fromState ? a.map((v, i) => Math.exp(Math.log(v) + (Math.log(b[i]) - Math.log(v)) * e)) : b);
  const UA = mixU(fromState ? fromState.toyU.A : state.toyU.A, state.toyU.A);
  const UB = mixU(fromState ? fromState.toyU.B : state.toyU.B, state.toyU.B);
  const levelA = fromState ? Math.exp(Math.log(fromState.levelA) + (Math.log(state.levelA) - Math.log(fromState.levelA)) * e) : state.levelA;
  /* the axis range eases between the two units' ranges; taken from the mixed
     values it stepped by whole powers of two mid-ease (his round 16: jerky) */
  const Rt = slopeRange(slopeValues(toy, state.toyU.A, state.toyU.B));
  const Rf = fromState ? slopeRange(slopeValues(toy, fromState.toyU.A, fromState.toyU.B)) : Rt;
  const R = { lo: Rf.lo + (Rt.lo - Rf.lo) * e, hi: Rf.hi + (Rt.hi - Rf.hi) * e };
  const L = slopeLayout(w, y0);
  const sy = (v) => slopeY(L, R, v);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
  ctx.fillText(`The six genes in ${u}: a line per gene, sample A to B, on a log2 axis`, 10, y0 + 14);
  /* the grid: one line per power of two, the tick its log2 */
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.font = `${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "right";
  for (let t = Math.ceil(R.lo); t <= Math.floor(R.hi); t += 1) {
    const y = Math.round(sy(2 ** t)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L.padL, y); ctx.lineTo(w - L.padR + 20, y); ctx.stroke();
    ctx.fillText(String(t), L.padL - 6, y + 4);
  }
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center"; ctx.fillStyle = colors.ink2;
  ctx.fillText("sample A", L.xA, L.bottom + 16);
  ctx.fillText("sample B", L.xB, L.bottom + 16);
  /* the washes, as in the table: between along the focus gene's line, within
     around the two dots in the focus column */
  {
    const F = focusOf(hover, toy);
    const xk = F.sample ? L.xB : L.xA;
    ctx.save(); ctx.globalAlpha = WASH;
    ctx.fillStyle = colors.between;
    const yA = sy(UA[F.between]), yB = sy(UB[F.between]);
    ctx.fillRect(L.xA - 12, Math.min(yA, yB) - 8, L.xB - L.xA + 24, Math.abs(yA - yB) + 16);
    ctx.fillStyle = colors.within;
    const U = F.sample ? UB : UA, y1 = sy(U[F.within]), y2 = sy(U[F.other]);
    ctx.fillRect(xk - 12, Math.min(y1, y2) - 8, 24, Math.abs(y1 - y2) + 16);
    ctx.restore();
  }
  /* the truths: the unchanged genes' height in A, level across to B (a
     within reading lands on it when length is out of the unit; a between
     reading is flat when the unit compares between samples); and for gene 5,
     eight times its own A value, at B */
  ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(L.xA - 30, Math.round(sy(levelA)) + 0.5); ctx.lineTo(L.xB + 30, Math.round(sy(levelA)) + 0.5); ctx.stroke();
  for (const i of toy.changed) {
    ctx.save(); ctx.strokeStyle = colors.highlight; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(L.xB - 14, Math.round(sy(UA[i] * FOLD)) + 0.5); ctx.lineTo(L.xB + 14, Math.round(sy(UA[i] * FOLD)) + 0.5); ctx.stroke();
    ctx.restore();
  }
  /* the genes: a line each, a dot at each end, the name at B nudged clear of
     its neighbours (under TPM four unchanged genes share one height) */
  for (let i = 0; i < 6; i += 1) {
    const changed = toy.changed.includes(i), col = changed ? colors.highlight : colors.empirical;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(L.xA, sy(UA[i])); ctx.lineTo(L.xB, sy(UB[i])); ctx.stroke(); ctx.restore();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(L.xA, sy(UA[i]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(L.xB, sy(UB[i]), 3.5, 0, Math.PI * 2); ctx.fill();
  }
  /* the names at B: genes within 3px share one label ("genes 1–4" under TPM,
     where four unchanged genes sit at one height), and a stack of labels is
     pushed apart, then back up off the bottom */
  const order = toy.len.map((v, i) => i).sort((i, j) => sy(UB[i]) - sy(UB[j]));
  const groups = [];
  for (const i of order) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(sy(UB[i]) - g.y) <= 3) g.genes.push(i); else groups.push({ y: sy(UB[i]), genes: [i] });
  }
  let last = -Infinity;
  for (const g of groups) { g.ly = Math.max(g.y + 4, last + 11); last = g.ly; }
  let next = L.bottom + 2;
  for (let k = groups.length - 1; k >= 0; k -= 1) { groups[k].ly = Math.min(groups[k].ly, next - 11); next = groups[k].ly; }
  const runs = (ids) => { const a = ids.map((i) => i + 1).sort((x, y) => x - y); const out = []; let s0 = a[0], p = a[0];
    for (let k = 1; k <= a.length; k += 1) { if (a[k] === p + 1) { p = a[k]; continue; } out.push(s0 === p ? String(s0) : p === s0 + 1 ? `${s0}, ${p}` : `${s0}–${p}`); s0 = a[k]; p = a[k]; }
    return out.join(", "); };
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.textAlign = "left";
  for (const g of groups) {
    const anyChanged = g.genes.some((i) => toy.changed.includes(i));
    ctx.fillStyle = anyChanged ? colors.highlight : colors.ink3;
    ctx.fillText(`${g.genes.length > 1 ? "genes" : "gene"} ${runs(g.genes)}`, L.xB + 10, g.ly);
  }
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
  /* why the median: a changed gene's ratio is one of six, and the middle of
     the other five is the depth */
  ctx.fillText(toy.changed.length
    ? `gene ${toy.changed[0] + 1}'s ratio is one of six; the median is the middle of the other five`
    : "no gene changed: the six ratios are equal, and the median is that value", 34, my + 20);
  ctx.restore();
}
