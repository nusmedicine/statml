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
 * depth); below it, 2,000 genes as four boxes of the values themselves — the
 * unchanged genes in A and in B, the changed genes in A and in B — so B above
 * A, or level with it, is seen rather than read off a ratio (his pick over a
 * histogram of log2(B ÷ A), which showed "up" only as a position on a line).
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
   comparison has a truth of 1.00; gene 5 (6 kb) is the one that rises. The
   sample's total of reads is FIXED at its depth (the sequencer's capacity), so
   the reads a rising gene takes come from every other gene. */
const LEN = [1, 2, 4, 1, 6, 0.5];
const PER_KB = 4;
const READ_KB = 0.25;      // one read, as a fraction of a gene
const CHANGED = { none: [], one: [4] };
const FOLD = 8;
const GENES = 2000;
const SHARE = { none: 0, one: 0.05 };
/* reads per unit of expression × length in the 2,000-gene panel */
const PANEL_DEPTH = 0.1;
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
const MIN_COUNT = 20;      // a gene counts toward the boxes only with counts over this in both samples
const PILE_H = 190;
const TABLE_H = 180;
const BOX_H = 176;   /* three text lines under the axis, none over the boxes (the sweep) */
const GAP = 4;
const FIG_H = PILE_H + TABLE_H + BOX_H + 2 * GAP;
const ACT_H = 236;
const EASE_MS = 450;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/* --- the units ------------------------------------------------------------ */
const total = (c) => c.reduce((s, v) => s + v, 0);
const median = (a) => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const log2 = (x) => Math.log(x) / Math.LN2;
const quantile = (a, p) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
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
const DEFAULT_FOCUS = { between: 0, within: 4, other: 5, sample: 0 };
const focusOf = (hover) => (hover ? { between: hover.gene, within: hover.gene, other: hover.gene === 0 ? 5 : 0, sample: hover.sample } : DEFAULT_FOCUS);
const WASH = 0.22;

/* The two readings the table brackets, which is what a unit change eases:
   the table and the histogram crossfade because their numbers and axes change
   with the unit, and a number sliding is a number the reader can follow. */
const readings = (state) => ({ within: state.within, between: state.between });
const mixReadings = (a, b, e) => ({ within: a.within + (b.within - a.within) * e, between: a.between + (b.between - a.between) * e });

defineWidget({
  slug: "count-normalization",
  title: "Bulk RNA-seq: Normalization",
  /* S1 of three, his pick: concept first, mechanism second (2.10). */
  /* S4, his pick (2026-09-22) over the version that named the methods and
     ended on the test: the approaches, no vocabulary, the names left to the
     unit control; the test is widget 78's, and "what DESeq2 takes" stays as
     the raw count's own detail */
  subtitle:
    "A read count carries the sample's depth, the gene's length and what the "
    + "other genes did. Dividing by the sample's reads and the gene's length "
    + "compares genes within a sample; dividing by a scale read off the genes "
    + "that did not change compares a gene between samples. Dividing by both "
    + "compares both ways.",
  layout: "side",
  status: "draft",
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
      type: "segmented", label: "Genes that change in B",
      detail: "8× up; the sample's total of reads is fixed",
      options: [
        { value: "none", label: "None" },
        { value: "one", label: "Gene 5", detail: "one of the six; 5% of the 2,000" },
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
    const L = [{ token: "empirical", label: "A read; a gene of the 2,000", mark: "bar" }];
    if (params.change !== "none") L.push({ token: "highlight", label: "A gene that changed", mark: "bar" });
    L.push({ token: "between", label: "Between samples: one gene in both", mark: "bar" });
    L.push({ token: "within", label: "Within a sample: two genes in one", mark: "bar" });
    L.push({ token: "reference", label: "Truth for an unchanged gene", mark: "line" });
    if (params.change !== "none") L.push({ token: "highlight", label: "Truth for a changed gene", mark: "line" });
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

    /* the 2,000 as four boxes of the values themselves (his pick, round 11,
       over a histogram of ratios): the unchanged genes in A and in B, the
       changed genes in A and in B, genes counted in both samples. B above A,
       or level with it, is then seen rather than read off a ratio. */
    const keep = [];
    for (let i = 0; i < GENES; i += 1) if (panel.A[i] > MIN_COUNT && panel.B[i] > MIN_COUNT) keep.push(i);
    const unch = keep.filter((i) => !panel.changed.has(i)), ch = keep.filter((i) => panel.changed.has(i));
    const five = (vals) => (vals.length ? [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => quantile(vals, q)) : null);
    const boxes = [
      { name: "unchanged, A", changed: false, sample: 0, q: five(unch.map((i) => panU.A[i])) },
      { name: "unchanged, B", changed: false, sample: 1, q: five(unch.map((i) => panU.B[i])) },
      { name: "changed, A", changed: true, sample: 0, q: five(ch.map((i) => panU.A[i])) },
      { name: "changed, B", changed: true, sample: 1, q: five(ch.map((i) => panU.B[i])) },
    ].filter((b) => b.q);
    const gapUnchanged = boxes[1] ? log2(boxes[1].q[2] / boxes[0].q[2]) : 0;
    const gapChanged = boxes[3] ? log2(boxes[3].q[2] / boxes[2].q[2]) : null;

    return {
      toy, panel, toyU, panU, tsf, psf, unit,
      within, between,
      boxes, gapUnchanged, gapChanged, nUnchanged: unch.length, nChanged: ch.length,
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
      drawBoxes(ctx, colors, w, hy, anim.fromState, 1 - e);
      drawBoxes(ctx, colors, w, hy, state, e);
    } else {
      drawTable(ctx, colors, w, ty, state, r, 1, hover);
      drawBoxes(ctx, colors, w, hy, state, 1);
    }
    if ((params.unit === "sf" || params.unit === "sfkb") && params.act) drawAct(ctx, colors, w, FIG_H, state);
  },

  readout: ({ state }) => {
    const u = UNITS[state.unit].short;
    return [
      { label: "Within sample A: gene 5 ÷ gene 6", value: fmt(state.within, 2), note: `truth 1.00: the same expression per kilobase, in ${u}` },
      { label: "Between samples: gene 1, B ÷ A", value: fmt(state.between, 2), note: `truth 1.00: unchanged, in ${u}` },
      { label: "2,000 unchanged genes: B − A, log2 of the medians", value: fmt(state.gapUnchanged, 2), note: `truth 0; ${state.nUnchanged.toLocaleString("en")} genes with counts over ${MIN_COUNT} in both` },
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
      const F = focusOf(hover);
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
  const F = focusOf(hover);
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
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = Math.abs(v - truth) > 0.01 * truth ? colors.extreme : colors.ink1;
    ctx.fillText(`${title} = ${fmt(v, 2)}`, mx, y);
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.fillText(`truth ${fmt(truth, 2)}: ${why}`, mx, y + rh);
  };
  const gb = F.between, gw = F.within, k = F.sample, other = F.other;
  const U = k ? toyU.B : toyU.A, S = k ? "B" : "A";
  const changedIn = (i) => (k === 1 && toy.changed.includes(i) ? FOLD : 1);
  /* with no pointer the numbers are the eased ones, so a unit change counts them along */
  const between = hover ? toyU.B[gb] / toyU.A[gb] : r.between, betweenTruth = toy.changed.includes(gb) ? FOLD : 1;
  const within = hover ? U[gw] / U[other] : r.within, withinTruth = changedIn(gw) / changedIn(other);
  reading(colors.between, `between: gene ${gb + 1}, B ÷ A`, first, between, betweenTruth, toy.changed.includes(gb) ? `up ${FOLD}×` : "unchanged");
  reading(colors.within, `within ${S}: gene ${gw + 1} ÷ gene ${other + 1}`, first + 4 * rh, within, withinTruth, withinTruth !== 1 ? `one expression per kb, gene ${gw + 1} up ${FOLD}×` : "one expression per kb");
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.fillText("point at a gene to read it both ways", mx, first + 6 * rh + 2);
  ctx.restore();
}

/* --- the 2,000 genes as four boxes ------------------------------------------ */
function drawBoxes(ctx, colors, w, y0, state, fade) {
  const u = UNITS[state.unit].short;
  const { boxes } = state;
  const all = boxes.flatMap((b) => [b.q[0], b.q[4]]).filter((v) => v > 0).map(log2);
  const lo = Math.min(...all) - 0.3, hi = Math.max(...all) + 0.3;
  const padL = 44, padR = 12, top = y0 + 22, bottom = y0 + BOX_H - 46;
  const pw = w - padL - padR, ph = bottom - top;
  const sy = (v) => top + ph - ((log2(v) - lo) / (hi - lo)) * ph;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
  ctx.fillText(`2,000 genes in ${u}: the unchanged and the changed genes, in each sample`, padL, y0 + 12);
  ctx.strokeStyle = colors.axis ?? colors.ink3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, Math.round(bottom) + 0.5); ctx.lineTo(padL + pw, Math.round(bottom) + 0.5); ctx.stroke();
  /* the truths: the unchanged genes' level in A, which B's unchanged box should
     sit on; and 8× the changed genes' level in A, for the changed pair */
  const mUA = boxes[0].q[2];
  ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padL, sy(mUA)); ctx.lineTo(padL + pw, sy(mUA)); ctx.stroke();
  if (boxes[3]) {
    ctx.strokeStyle = colors.highlight;
    ctx.beginPath(); ctx.moveTo(padL + pw / 2, sy(boxes[2].q[2] * FOLD)); ctx.lineTo(padL + pw, sy(boxes[2].q[2] * FOLD)); ctx.stroke();
  }
  const slots = boxes.length;
  boxes.forEach((b, k) => {
    const cx = padL + (pw * (k + 0.5)) / slots, half = Math.min(34, pw / slots / 3);
    const col = b.changed ? colors.highlight : colors.empirical;
    const [w1, q1, med, q3, w9] = b.q;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, sy(w1)); ctx.lineTo(cx, sy(w9)); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.18 * fade; ctx.fillStyle = col; ctx.fillRect(cx - half, sy(q3), 2 * half, sy(q1) - sy(q3)); ctx.restore();
    ctx.strokeRect(cx - half + 0.5, sy(q3) + 0.5, 2 * half - 1, Math.max(1, sy(q1) - sy(q3)) - 1);
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - half, sy(med)); ctx.lineTo(cx + half, sy(med)); ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
    ctx.fillText(b.name, cx, bottom + 13);
    ctx.font = `600 ${colors.fsXs} ${colors.mono}`; ctx.fillStyle = colors.ink1;
    ctx.fillText(fmt(log2(med), 2), cx, sy(med) - 5);
  });
  /* every line of text sits under the axis, where no box can reach it (the
     sweep found the corner text on the tallest box's median): the two gaps
     with their truths on one line, then the caption */
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = Math.abs(state.gapUnchanged) > 0.05 ? colors.extreme : colors.ink1;
  ctx.fillText(`unchanged, B − A ${fmt(state.gapUnchanged, 2)} · truth 0`, padL, bottom + 26);
  if (state.gapChanged !== null) {
    ctx.textAlign = "right";
    ctx.fillStyle = Math.abs(state.gapChanged - Math.log2(FOLD)) > 0.1 ? colors.extreme : colors.ink1;
    ctx.fillText(`changed, B − A ${fmt(state.gapChanged, 2)} · truth ${fmt(Math.log2(FOLD), 2)}`, padL + pw, bottom + 26);
  }
  ctx.textAlign = "center"; ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3;
  ctx.fillText("log2 of the value; a box is the middle half, the line its median", padL + pw / 2, bottom + 39);
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
    ? "gene 5's ratio is one of six; the median is the middle of the other five"
    : "no gene changed: the six ratios are equal, and the median is that value", 34, my + 20);
  ctx.restore();
}
