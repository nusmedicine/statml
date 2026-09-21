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
 * a share does not — until more than half the genes move one way, which the
 * share control reaches (2.6).
 *
 * THREE PAGES ON ONE FIGURE SHAPE, his pick from `_lab/count-normalization-mock.html`
 * (2026-09-21): six genes with lengths as paired bars in the chosen unit above,
 * 2,000 genes as a scatter below. Each page's data differ in ONE thing:
 *   Depth        sample B sequenced deeper, equal lengths, nothing changes
 *   Length       every gene at one expression, lengths differ, one depth
 *   Composition  some genes change in B; the page ends on the size factor
 * The unit control is the reader's move on every page; the widget opens on raw
 * counts (2.1). No animation: the figure is a table of numbers in a unit, and
 * the walkthrough is a table too, gated as widget 39's quantile one is.
 *
 * THE NUMBERS, measured before the mock (`_lab/rnaseq-measure.mjs` M1, and
 * the scratch `mor-fail.mjs` recorded in the catalogue): with 5% of genes up
 * 8× the unchanged genes shift −0.57 log2 under TPM and −0.02 under the size
 * factor; the size factor drifts from 40% of genes up one way and fails past
 * half; when the movers go both ways it holds to half.
 */
import { defineWidget, makePlot, fmt } from "../core/index.js";

/* --- the stage ------------------------------------------------------------ */
const TOY = {
  /* six genes: length in kb, expression in transcripts per cell. The
     10 kb gene at 300 is the one that carries most of the reads, so its
     change is the composition case the six can show. */
  len: [1, 2, 4, 1, 10, 0.5],
  expr: [100, 100, 100, 20, 300, 50],
  changedUp: 4,       // gene 5 rises on the Composition page
  changedDown: 2,     // gene 3 falls when the direction is "both"
};
const GENES = 2000;
const PAGES = [
  { value: "depth", label: "Depth" },
  { value: "length", label: "Length" },
  { value: "composition", label: "Composition" },
];
const UNITS = {
  raw: { label: "Raw count", short: "raw counts" },
  cpm: { label: "CPM", short: "CPM" },
  fpkm: { label: "FPKM", short: "FPKM" },
  tpm: { label: "TPM", short: "TPM" },
  sf: { label: "Size factor", short: "counts ÷ size factor" },
};
const DEPTHS = ["1", "2", "3", "10"];
const SHARES = ["5", "20", "40", "50", "60", "80"];
const FOLDS = ["2", "4", "8"];
const CUTOFF = Math.log2(1.5);
const MIN_COUNT = 20;        // an unchanged gene counts toward the shift only with counts over this in both samples
const TOY_H = 186;
const SC_H = 272;
const GAP = 8;
const FIG_H = TOY_H + GAP + SC_H;
const ACT_H = 236;

const ON = (page) => ({ param: "page", equals: page });

/* --- the units ------------------------------------------------------------ */
const total = (c) => c.reduce((s, v) => s + v, 0);
const median = (a) => { const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const log2 = (x) => Math.log(x) / Math.LN2;

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
    ratio the panel prints is the unit's own arithmetic. */
function toyFor(params) {
  const page = params.page;
  const len = page === "depth" ? TOY.len.map(() => 2) : TOY.len;
  const expr = page === "length" ? TOY.expr.map(() => 100) : TOY.expr;
  const depth = page === "depth" ? Number(params.depth) : 1;
  const fold = Number(params.fold);
  const changed = [];
  if (page === "composition") { changed.push(TOY.changedUp); if (params.direction === "both") changed.push(TOY.changedDown); }
  const factor = (i) => (i === TOY.changedUp && changed.includes(i) ? fold : i === TOY.changedDown && changed.includes(i) ? 1 / fold : 1);
  const A = expr.map((e, i) => Math.round(e * len[i]));
  const B = expr.map((e, i) => Math.round(e * len[i] * depth * factor(i)));
  return { len, A, B, changed };
}

/** 2,000 genes with Poisson counts. On the Length page every gene has one
    expression so the unit can be read against the length alone. */
function panelFor(params, rng) {
  const page = params.page;
  const len = Array.from({ length: GENES }, () => Math.exp(rng.normal(Math.log(2), 0.7)));
  /* the Length page's one expression is high enough that the shortest tenth
     of genes (about 0.5 kb) still counts in the tens — at 30 their median count
     was 0 and the tile printed a dash */
  const expr = Array.from({ length: GENES }, () => (page === "length" ? 2000 : Math.exp(rng.normal(Math.log(30), 1.6))));
  const changed = new Set();
  if (page === "composition") { const n = Math.round((Number(params.share) / 100) * GENES); while (changed.size < n) changed.add(Math.floor(rng.next() * GENES)); }
  const fold = Number(params.fold);
  const list = [...changed];
  const exprB = expr.map((v, i) => (changed.has(i) ? (params.direction === "both" && list.indexOf(i) % 2 ? v / fold : v * fold) : v));
  const depth = page === "depth" ? Number(params.depth) : 1;
  const A = expr.map((v, i) => poisson(rng, v * len[i] * 0.02));
  const B = exprB.map((v, i) => poisson(rng, v * len[i] * 0.02 * depth));
  return { len, A, B, changed };
}

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
  /* The walkthrough is a stage that has to give its pixels back (3.4b). */
  height: ({ page, unit, act }) => (page === "composition" && unit === "sf" && act ? FIG_H + ACT_H : FIG_H),

  params: {
    /* Step, not Page (his pick): raw → CPM → TPM → size factor is one
       pipeline and the units accumulate left to right. */
    page: { type: "segmented", label: "Step", options: PAGES, default: "depth", display: true },

    data: { type: "section", label: "The data" },

    depth: {
      type: "choice", label: "Depth of sample B",
      detail: "reads sequenced, relative to sample A",
      options: DEPTHS.map((d) => ({ value: d, label: `${d}×` })), default: "1",
      when: ON("depth"),
    },
    lengths: {
      type: "segmented", label: "Gene lengths",
      detail: "every gene at the same expression",
      options: [{ value: "equal", label: "Equal" }, { value: "differ", label: "Differ" }], default: "equal",
      when: ON("length"),
    },
    share: {
      type: "choice", label: "Genes that change in B",
      detail: "of the 2,000; one of the six",
      options: SHARES.map((s) => ({ value: s, label: `${s}%` })), default: "5",
      when: ON("composition"),
    },
    fold: {
      type: "segmented", label: "By how much",
      options: FOLDS.map((f) => ({ value: f, label: `${f}×` })), default: "8",
      when: ON("composition"),
    },
    direction: {
      type: "segmented", label: "Direction",
      options: [{ value: "up", label: "Up" }, { value: "both", label: "Half up, half down" }], default: "up",
      when: ON("composition"),
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
      when: { all: [ON("composition"), { param: "unit", equals: "sf" }] },
    },

    /* authoring escape hatch, first render only */
    shown: { type: "int", min: 0, max: 1, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const L = [
      { token: "groupA", label: "Sample A", mark: "bar" },
      { token: "groupB", label: "Sample B", mark: "bar" },
    ];
    if (params.page === "composition") L.push({ token: "highlight", label: "A gene that changed", mark: "bar" });
    L.push({ token: "empirical", label: params.page === "length" ? "One gene" : "One unchanged gene", mark: "dot" });
    L.push({ token: "reference", label: params.page === "length" ? "Every gene the same" : "Equal in A and B", mark: "line" });
    return L;
  },

  /* Pure and seeded; runs on parameter change only. Every number on the
     figure and in the tiles is computed here, once (5.8). */
  compute: ({ params, rng }) => {
    const p = { ...params };
    if (p.page === "length" && p.lengths === "equal") p.lengthsEqual = true;
    const toy = toyFor(p);
    if (p.lengthsEqual) toy.len = toy.len.map(() => 2), toy.A = toy.A.map(() => 200), toy.B = toy.B.map(() => 200);
    const panel = panelFor(p, rng);
    if (p.lengthsEqual) panel.len = panel.len.map(() => 2);
    const unit = params.unit;

    const tsf = sizeFactors(toy.A, toy.B);
    const psf = sizeFactors(panel.A, panel.B);
    const toyU = { A: unitOf(toy.A, toy.len, unit, tsf.sfA), B: unitOf(toy.B, toy.len, unit, tsf.sfB) };
    const panU = { A: unitOf(panel.A, panel.len, unit, psf.sfA), B: unitOf(panel.B, panel.len, unit, psf.sfB) };

    /* the unchanged genes' shift: counts over MIN_COUNT in both samples, so a
       Poisson zero cannot print as a fold change */
    const unch = [];
    for (let i = 0; i < GENES; i += 1) if (!panel.changed.has(i) && panel.A[i] > MIN_COUNT && panel.B[i] > MIN_COUNT) unch.push(i);
    const shifts = unch.map((i) => log2(panU.B[i] / panU.A[i]));
    const medianShift = shifts.length ? median(shifts) : 0;
    const calledDown = shifts.filter((s) => s < -CUTOFF).length;
    const calledUp = shifts.filter((s) => s > CUTOFF).length;

    /* the Length page's number: the longest tenth of genes against the
       shortest tenth, in the unit, at one expression */
    const order = [...Array(GENES).keys()].sort((a, b) => panel.len[a] - panel.len[b]);
    const tenth = Math.floor(GENES / 10);
    const shortMed = median(order.slice(0, tenth).map((i) => panU.A[i]));
    const longMed = median(order.slice(GENES - tenth).map((i) => panU.A[i]));

    /* the Depth page's number: the reads behind one TPM of 50 at A's depth
       (taken as one million reads) and B's */
    const depth = Number(params.depth);
    const readsA = 50, readsB = 50 * depth;

    return {
      toy, panel, toyU, panU, tsf, psf, unit,
      sums: { fpkmA: total(unitOf(panel.A, panel.len, "fpkm")), fpkmB: total(unitOf(panel.B, panel.len, "fpkm")) },
      medianShift, calledDown, calledUp, nUnch: unch.length,
      lengthRatio: shortMed > 0 ? longMed / shortMed : NaN,
      readsA, readsB,
    };
  },

  draw: ({ ctx, colors, w, params, state }) => {
    const unit = state.unit;
    drawToy(ctx, colors, w, 0, state, params);
    drawScatter(ctx, colors, w, TOY_H + GAP, state, params);
    if (params.page === "composition" && unit === "sf" && params.act) drawAct(ctx, colors, w, FIG_H, state);
  },

  readout: ({ params, state }) => {
    const u = UNITS[state.unit].short;
    const t = state.toy;
    if (params.page === "depth") {
      const g = 0;
      return [
        { label: "Sample B ÷ sample A, one gene", value: fmt(state.toyU.B[g] / state.toyU.A[g], 2), note: `gene 1, in ${u}; 1.00 is equal expression` },
        { label: "Reads behind a TPM of 50", value: `${state.readsA} · ${state.readsB.toLocaleString("en")}`, note: `A at 1M reads, B at ${params.depth}M; Poisson CV ${fmt(100 / Math.sqrt(state.readsA), 0)}% and ${fmt(100 / Math.sqrt(state.readsB), 0)}%` },
      ];
    }
    if (params.page === "length") {
      return [
        { label: "10 kb gene ÷ 0.5 kb gene", value: fmt(state.toyU.A[4] / state.toyU.A[5], 2), note: `genes 5 and 6 in sample A, in ${u}; 1.00 is equal expression` },
        { label: "Longest tenth ÷ shortest tenth", value: fmt(state.lengthRatio, 2), note: `median over 2,000 genes at one expression, in ${u}` },
      ];
    }
    const third = state.unit === "sf"
      ? { label: "Size factors", value: `A ${fmt(state.psf.sfA, 2)} · B ${fmt(state.psf.sfB, 2)}`, note: "median ratio to the geometric mean, over the 2,000" }
      : state.unit === "fpkm"
        ? { label: "Sum over genes", value: `A ${fmt(state.sums.fpkmA / 1e6, 1)}M · B ${fmt(state.sums.fpkmB / 1e6, 1)}M`, note: "FPKM sums differ between samples; TPM sums to 1M in each" }
        : { label: "Unchanged gene in the six", value: fmt(state.toyU.B[0] / state.toyU.A[0], 2), note: `gene 1, B ÷ A in ${u}` };
    return [
      { label: "Unchanged genes, median log2(B ÷ A)", value: fmt(state.medianShift, 2), note: `${state.nUnch.toLocaleString("en")} genes with counts over ${MIN_COUNT} in both; 0 is right` },
      { label: `Unchanged genes past 1.5×`, value: `${state.calledDown} down · ${state.calledUp} up`, note: `of ${state.nUnch.toLocaleString("en")}, in ${u}` },
      third,
    ];
  },
});

/* --- the six genes, as paired bars --------------------------------------- */
function drawToy(ctx, colors, w, y0, state, params) {
  const { toy, toyU } = state;
  const n = toy.A.length;
  const padL = 34, padR = 10;
  const slot = (w - padL - padR) / n;
  const bw = Math.min(16, slot * 0.28);
  const base = y0 + TOY_H - 30;
  const top = Math.max(...toyU.A, ...toyU.B) || 1;
  const hOf = (v) => (v / top) * (TOY_H - 70);

  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText(`Six genes, in ${UNITS[state.unit].short}`, padL, y0 + 16);

  ctx.strokeStyle = colors.axis ?? colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, Math.round(base) + 0.5); ctx.lineTo(w - padR, Math.round(base) + 0.5); ctx.stroke();

  ctx.font = `${colors.fsXs} ${colors.font}`;
  for (let i = 0; i < n; i += 1) {
    const cx = padL + slot * (i + 0.5);
    const hA = hOf(toyU.A[i]), hB = hOf(toyU.B[i]);
    const changed = toy.changed.includes(i);
    const col = changed ? colors.highlight : null;
    ctx.fillStyle = col ?? colors.groupA;
    ctx.fillRect(cx - bw - 1, base - hA, bw, hA);
    ctx.strokeStyle = col ?? colors.groupB;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx + 1.5, base - hB + 0.5, bw - 1, Math.max(0, hB - 1));
    /* the ratio B/A over each pair, in the unit — the number the page argues about */
    const r = toyU.B[i] / toyU.A[i];
    ctx.textAlign = "center";
    ctx.fillStyle = changed ? colors.highlight : Math.abs(r - 1) > 0.005 ? colors.extreme : colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.mono}`;
    ctx.fillText(fmt(r, r >= 10 ? 0 : 2), cx, base - Math.max(hA, hB) - 5);
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.fillText(`gene ${i + 1}`, cx, base + 13);
    ctx.fillText(`${toy.len[i]} kb`, cx, base + 25);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink3;
  ctx.fillText("B ÷ A over each pair", w - padR - 118, y0 + 16);
  ctx.restore();
}

/* --- the 2,000 genes ------------------------------------------------------- */
function drawScatter(ctx, colors, w, y0, state, params) {
  const { panel, panU } = state;
  const u = UNITS[state.unit].short;
  const padL = 52, padR = 12, top = y0 + 24, bottom = y0 + SC_H - 34;
  const isLength = params.page === "length";
  /* log axes: the values span three decades in every unit, and the fold
     change the page argues about is a distance on a log axis */
  const xs = [], ys = [];
  for (let i = 0; i < GENES; i += 1) {
    const x = isLength ? panel.len[i] : panU.A[i], y = isLength ? panU.A[i] : panU.B[i];
    if (x > 0 && y > 0) { xs.push(Math.log10(x)); ys.push(Math.log10(y)); }
  }
  const lo = Math.min(...xs, ...(isLength ? ys : ys)), hi = Math.max(...xs, ...ys);
  const xlo = isLength ? Math.min(...xs) : lo, xhi = isLength ? Math.max(...xs) : hi;
  const ylo = isLength ? Math.min(...ys) : lo, yhi = isLength ? Math.max(...ys) : hi;
  const pad = 0.15;
  const plot = makePlot({
    ctx, colors,
    rect: { x: padL, y: top, w: w - padL - padR, h: bottom - top },
    xDomain: [xlo - pad, xhi + pad], yDomain: [ylo - pad, yhi + pad],
  });
  const powTicks = (a, b) => { const t = []; for (let k = Math.ceil(a); k <= Math.floor(b); k += 1) t.push(k); return t; };
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const powFmt = (v) => (v === 0 ? "1" : v > 0 && v < 4 ? String(10 ** v) : `10${String(v).split("").map((c) => SUP[c] ?? c).join("")}`);
  plot.grid(powTicks(ylo - pad, yhi + pad));
  plot.axisY({ ticks: powTicks(ylo - pad, yhi + pad), format: powFmt });
  plot.axisX({ ticks: powTicks(xlo - pad, xhi + pad), format: powFmt, label: isLength ? "gene length, kb" : `sample A, ${u}` });
  plot.caption(isLength ? `2,000 genes at one expression, ${u} against length` : `2,000 genes, sample B against sample A, in ${u}`);
  /* cell 16's fact, on the page whose last unit is the one DESeq2 computes
     for itself: the raw counts go in, and the size factor sits inside the model */
  if (params.page === "composition") plot.note("DESeq2 takes the raw counts and fits the size factor inside its model", { inside: true });

  /* the reference: equal in A and B, or every gene the same */
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.5;
  if (isLength) {
    const m = median(ys);
    ctx.beginPath(); ctx.moveTo(plot.sx(xlo - pad), plot.sy(m)); ctx.lineTo(plot.sx(xhi + pad), plot.sy(m)); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(plot.sx(lo - pad), plot.sy(lo - pad)); ctx.lineTo(plot.sx(hi + pad), plot.sy(hi + pad)); ctx.stroke();
    /* the 1.5× band, dashed: past it an unchanged gene is called changed */
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    const d = Math.log10(1.5);
    for (const s of [d, -d]) { ctx.beginPath(); ctx.moveTo(plot.sx(lo - pad), plot.sy(lo - pad + s)); ctx.lineTo(plot.sx(hi + pad), plot.sy(hi + pad + s)); ctx.stroke(); }
  }
  ctx.restore();

  /* the genes: unchanged in the empirical hue, changed in the highlight, drawn last */
  ctx.save();
  const draw = (set, fill, alpha, r) => {
    ctx.fillStyle = fill; ctx.globalAlpha = alpha;
    for (const i of set) {
      const x = isLength ? panel.len[i] : panU.A[i], y = isLength ? panU.A[i] : panU.B[i];
      if (!(x > 0 && y > 0)) continue;
      ctx.beginPath(); ctx.arc(plot.sx(Math.log10(x)), plot.sy(Math.log10(y)), r, 0, Math.PI * 2); ctx.fill();
    }
  };
  const unchanged = [], changed = [];
  for (let i = 0; i < GENES; i += 1) (panel.changed.has(i) ? changed : unchanged).push(i);
  draw(unchanged, colors.empirical, 0.4, 1.6);
  draw(changed, colors.highlight, 0.85, 1.8);
  ctx.restore();

  ctx.save();
  ctx.translate(14, (top + bottom) / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = `${colors.fsXs} ${colors.font}`; ctx.fillStyle = colors.ink3; ctx.textAlign = "center";
  ctx.fillText(isLength ? `sample A, ${u}` : `sample B, ${u}`, 0, 0);
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
  ctx.fillText("a changed gene's ratio is one value among six; the median takes the middle of the others", 34, my + 20);
  ctx.restore();
}
