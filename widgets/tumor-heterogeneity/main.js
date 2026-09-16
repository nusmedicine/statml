/* ============================================================================
   Widget 67 · Tumor Heterogeneity — PHM5003 07 / 01-2 cells 17–25.

   `model.js` carries the stage, the arithmetic and the copy, and the decisions
   taken while building; this file draws them. Three pages, from Kenneth's
   picks of 2026-09-16: One mutation · Many mutations · Clonal architecture.

   The drawing rules this file keeps to:

     · Colour separates tumour cells from normal cells, and the mutation is a
       MARK inside a cell — colour carries one grouping (§ *Widget 42*).
     · On page 2 the colours are the truth (which population a mutation came
       from) and the mixture's components are drawn as brackets, for the same
       reason.
     · The expected VAF is `--c-theory`: it is the claim the reads are checked
       against. The reads themselves are `--c-highlight` where they carry the
       variant, because that is the one thing to look at.
   ========================================================================= */

import { defineWidget, makePlot, mathmlRenders, niceTicks } from "../core/index.js";
import * as M from "./model.js";

/* Set by `defineWidget`, read only by `clearDrawAll` — the momentary action. */
let widgetApi = null;

const reducedMotion = () => (typeof matchMedia === "function"
  && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* WHAT PAGE 2'S LAST DRAW LEFT, so a data change can move from the figure that
   is on screen to the one the new parameters ask for (widget 53's `carry`).
   It holds what was DRAWN and not the destination, which is what makes a second
   change mid-morph leave from where the figure is rather than jumping to the
   end it was heading for — the same rule the axis ease follows.

   The params beside the counts are the ones the bins depend on: a morph is only
   honest when the bin edges and the mutations are the same population, so the
   axis, the purity the correction divides by, the seed and the clone set must
   all match. That leaves exactly purity, read depth and the mutation count. */
let carryMany = null;

/* ---- the formula card ----------------------------------------------------
   Kenneth's ask, 2026-09-16: "include the MathML formulas so students can see
   how it's calculated and the general logic". Widget 14's machinery, as
   widgets 27 and 64 use it: probe that MathML LAYS OUT (an interface test
   lies), mount `.w-math` lazily from `draw()` because module scope runs before
   the shell exists, and memoise on the numbers so a frame that changes nothing
   rewrites nothing.

   Each page states its own arithmetic: the general form first, in 01-2 cell
   25's own letters, then the same line with this figure's numbers in it. Every
   number here is read from the state the figure drew, never recomputed (5.8).

   `.w-math-eq` reserves 6.93em and hangs an 8.3em indent, both written for
   widget 14's sum; each row overrides them with `min-height:0` and a label
   gutter, which is what widgets 40 and 45 do. */
const MATHML = mathmlRenders();

const mi = (s) => `<mi>${s}</mi>`;
const mn = (x) => `<mn>${x}</mn>`;
const mo = (s) => `<mo>${s}</mo>`;
/* A LINE THAT HOLDS A FRACTION IS TALLER THAN ITS LINE-HEIGHT — `tokens.css`
   says so at `.w-link-eq`, where 1.55 let two wrapped lines close up on each
   other. These rows each hold an `<mfrac>` at 1.45em, so they set their own
   line-height rather than inheriting the card's, and the label sits in a
   gutter instead of under the 8.3em hanging indent written for widget 14. */
/* The label is a gutter of its own, and everything after it wraps INSIDE a
   second box — otherwise a continuation starts under the label rather than
   after it, which is the alignment `.w-math-eq`'s hanging indent exists to
   give widget 14's sum. */
const row = (label, ...parts) =>
  `<div class="w-math-eq" style="min-height:0;padding-left:0;text-indent:0;margin:0;`
  + `display:flex;align-items:baseline;gap:10px;line-height:2.4">`
  + `<span style="color:var(--ink-3);font-size:var(--fs-xs);white-space:nowrap;`
  + `line-height:1.4;flex:0 0 9.5em;text-align:right">${label}</span>`
  + `<span style="display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px">`
  + parts.filter(Boolean).map((p) => `<span>${p}</span>`).join("")
  + `</span></div>`;

/* VAF = p·c·m / (p·Cₜ + 2(1 − p)), 01-2 cell 25 */
const MODEL_MATH = `<math><mrow>${mi("VAF")}${mo("=")}<mfrac>`
  + `<mrow>${mi("p")}${mo("&#x2062;")}${mi("c")}${mo("&#x2062;")}${mi("m")}</mrow>`
  + `<mrow>${mi("p")}${mo("&#x2062;")}<msub>${mi("C")}${mi("t")}</msub>${mo("+")}${mn(2)}`
  + `${mo("(")}${mn(1)}${mo("&#x2212;")}${mi("p")}${mo(")")}</mrow></mfrac></mrow></math>`;
const MODEL_PLAIN = "VAF = p c m / (p Cₜ + 2(1 − p))";

/* c = VAF (p·Cₜ + 2(1 − p)) / (p·m), the same model solved for the fraction */
const CCF_MATH = `<math><mrow>${mi("c")}${mo("=")}${mi("VAF")}${mo("&#xD7;")}<mfrac>`
  + `<mrow>${mi("p")}${mo("&#x2062;")}<msub>${mi("C")}${mi("t")}</msub>${mo("+")}${mn(2)}`
  + `${mo("(")}${mn(1)}${mo("&#x2212;")}${mi("p")}${mo(")")}</mrow>`
  + `<mrow>${mi("p")}${mo("&#x2062;")}${mi("m")}</mrow></mfrac></mrow></math>`;
const CCF_PLAIN = "c = VAF × (p Cₜ + 2(1 − p)) / (p m)";

/* The definition, 01-2 cell 17 — with this reading's own counts in it once a
   read has landed. */
const readingMath = (alt, k, vaf) => `<math><mrow>${mi("VAF")}${mo("=")}`
  + `<mfrac><mtext>variant reads</mtext><mtext>reads</mtext></mfrac>`
  + (k > 0 ? `${mo("=")}<mfrac>${mn(alt)}${mn(k)}</mfrac>${mo("=")}${mn(vaf)}` : "")
  + `</mrow></math>`;
const READING_PLAIN = "VAF = variant reads / reads";

const MATH_SCORE_MATH = `<math><mrow>${mi("MATH")}${mo("=")}${mn(100)}${mo("&#xD7;")}${mn("1.4826")}`
  + `${mo("&#xD7;")}<mfrac><mrow><mi>MAD</mi>${mo("(")}${mi("VAF")}${mo(")")}</mrow>`
  + `<mrow><mi>median</mi>${mo("(")}${mi("VAF")}${mo(")")}</mrow></mfrac></mrow></math>`;
const MATH_SCORE_PLAIN = "MATH = 100 × 1.4826 × MAD(VAF) / median(VAF)";

const RULE_MATH = `<math><mrow><munder>${mo("&#x2211;")}<mtext>children</mtext></munder>`
  + `${mi("c")}${mo("&#x2264;")}<msub>${mi("c")}<mtext>parent</mtext></msub></mrow></math>`;
const RULE_PLAIN = "Σ over the children of a cluster: c ≤ c of the parent";

/** One line of arithmetic with this figure's own numbers in it. */
const numbers = (s) => (MATHML
  ? `<math><mrow><mtext>${s}</mtext></mrow></math>`
  : `<span style="font-family:var(--font-mono)">${s}</span>`);

let mathHost = null;
let mathKey = null;
function renderCard(page, rows, note) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = `${page}|${rows.map((r) => r.join("~")).join("|")}|${note}`;
  if (key === mathKey) return;
  mathKey = key;
  mathHost.innerHTML = rows.map(([label, ...parts]) => row(label, ...parts)).join("")
    + `<p class="w-math-note">${note}</p>`;
}

/** A fraction of this figure's own numbers, and what it comes to. */
const worked = (num, den, result) => (MATHML
  ? `<math><mrow><mfrac><mtext>${num}</mtext><mtext>${den}</mtext></mfrac>${mo("=")}${mn(result)}</mrow></math>`
  : `<span style="font-family:var(--font-mono)">(${num}) / (${den}) = ${result}</span>`);

function cardForPage(params, state, anim) {
  const S = M.STRINGS;
  if (params.page === "clonal") {
    const shape = M.shapeOf(params.shape);
    /* The sample that decides: the one that rules this shape out if any does,
       and otherwise the one whose children come closest to their parent. */
    const decided = state.used.find((s) => !M.fitsSumRule(shape, s.ccf))
      ?? state.used.reduce((a, b) => (M.tightestNode(shape, b.ccf).ratio > M.tightestNode(shape, a.ccf).ratio ? b : a));
    const tight = M.tightestNode(shape, decided.ccf);
    const sum = tight.kids.map((k) => M.n2(decided.ccf[k])).join(" + ");
    const fails = tight.sum > tight.parent + 1e-12;
    const line = `${sum} = ${M.n2(tight.sum)} ${fails ? ">" : "≤"} ${M.n2(tight.parent)}`;
    return {
      rows: [
        [S.labelRule, MATHML ? RULE_MATH : RULE_PLAIN],
        [decided.key, numbers(line)],
      ],
      note: S.noteTree,
    };
  }
  if (params.page === "many") {
    const cfg = state.manyCfg;
    const factor = M.ccfFrom(1, cfg.assumed, 1, 2);
    const vafs = state.many.muts.map((m) => m.vaf);
    const mid = M.median(vafs);
    const mad = M.median(vafs.map((v) => Math.abs(v - mid)));
    return {
      rows: [
        [S.labelFraction, MATHML ? CCF_MATH : CCF_PLAIN,
          numbers(`= VAF × ${M.n2(factor)}   at purity ${M.n2(cfg.assumed)}, one copy of two`)],
        [S.labelMath, MATHML ? MATH_SCORE_MATH : MATH_SCORE_PLAIN,
          numbers(`= 100 × 1.4826 × ${M.n3(mad)} / ${M.n3(mid)} = ${state.many.math.toFixed(1)}`)],
      ],
      note: S.noteMany,
    };
  }
  const cfg = state.cfg;
  const k = Math.min(anim?.k ?? 0, state.one.depth);
  const alt = M.altAt(state.one, k);
  const vaf = M.vafAt(state.one, k);
  const reading = MATHML
    ? readingMath(alt, k, M.n3(vaf))
    : `${READING_PLAIN}${k > 0 ? ` = ${alt} / ${k} = ${M.n3(vaf)}` : ""}`;
  const p = cfg.purity;
  /* The general form and this sample's own numbers share a row, so the card
     stays three lines: two display equations stacked took 265px on widget 64
     and pushed the figure down. */
  const rows = [
    [S.labelReading, reading],
    [S.labelModel, MATHML ? MODEL_MATH : MODEL_PLAIN, worked(
      `${M.n2(p)} × ${M.n2(cfg.ccf)} × ${cfg.copies}`,
      `${M.n2(p)} × ${cfg.state.total} + 2 × ${M.n2(1 - p)}`,
      M.n3(cfg.expected),
    )],
  ];
  const factor = M.ccfFrom(1, p, cfg.copies, cfg.state.total);
  rows.push([S.labelFraction, MATHML ? CCF_MATH : CCF_PLAIN,
    k > 0
      ? numbers(`= ${M.n3(vaf)} × ${M.n2(factor)} = ${M.n2(M.ccfFrom(vaf, p, cfg.copies, cfg.state.total))}`)
      : numbers(`= VAF × ${M.n2(factor)}`)]);
  return { rows, note: S.noteOne };
}

const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const noteFont = (colors) => `${colors.fsXs} ${colors.font}`;

function text(ctx, s, x, y, { font, fill, align = "left", baseline = "alphabetic" }) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** A colour with an alpha, for a wash behind a mark. */
function wash(color, a) {
  const m = String(color).match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const p = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
}

/* ---- the sample, as cells ------------------------------------------------ */

/**
 * Sixty cells: normal cells carry two wild-type copies, tumour cells the copy
 * state's copies, and the ones inside the cancer cell fraction carry the
 * mutation on `copies` of them (model decision 3).
 */
function drawCells(ctx, colors, rect, cfg, { n = M.CELLS } = {}) {
  const { cols, rows, px, py, r } = M.cellGrid(rect, n);
  const { tumour, carrying } = M.cellCounts(cfg, n);
  for (let i = 0; i < n; i += 1) {
    const cx = rect.x + (i % cols) * px + px / 2;
    const cy = rect.y + Math.floor(i / cols) * py + py / 2;
    const isTumour = i < tumour;
    const carries = i < carrying;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isTumour ? wash(colors.groupA, 0.16) : colors.surface3;
    ctx.fill();
    ctx.strokeStyle = isTumour ? wash(colors.groupA, 0.75) : wash(colors.ink3, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    /* `cellMarks` solves the four-copy case first and uses that mark in every
       state, so the mutation is one size whatever the copy number is, and no
       copy or mark reaches the cell's border (model, CELL_RIM).

       THE TWO INHERITED CHROMOSOMES ARE TOLD APART, his pick D from
       `_lab/vaf-cell-mock.html`: the copies the mutation could be on are drawn
       solid and the other chromosome's are open, which keeps the lesson
       figure's horizontal copies while making 2 + 0 — two copies of one
       chromosome — a different picture from 1 + 1. The marks land on the solid
       copies only, because a mutation arises on one chromosome. */
    const state = isTumour ? cfg.state : M.stateOf("1+1");
    const { mark, lines } = M.cellMarks(r, state.total);
    lines.forEach(({ dy, len }, c) => {
      const oy = cy + dy;
      const own = c < state.major;
      ctx.save();
      if (!own) ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, oy);
      ctx.lineTo(cx + len / 2, oy);
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = own ? 1.6 : 1.2;
      ctx.stroke();
      ctx.restore();
      if (isTumour && carries && own && c < cfg.copies) {
        ctx.beginPath();
        ctx.arc(cx, oy, mark, 0, Math.PI * 2);
        ctx.fillStyle = colors.highlight;
        ctx.fill();
      }
    });
  }
  return { tumour, carrying };
}

/* ---- the reads ----------------------------------------------------------- */

/**
 * A pileup: one mark per read, the variant ones filled.
 *
 * THE NEWEST READS FADE IN, AND ONLY WHILE PLAY IS RUNNING. A read is an
 * arrival, so it deserves the pile's own landing cue (4.3) — but a STEP adds
 * its read at full strength, because core stops the frame clock after a step
 * and a cue that cannot finish freezes half-drawn (4.3 again, and the trap
 * `hardy-weinberg` records). The bar underneath is NOT eased: it is a fraction
 * of counted reads, and a count does not slide.
 */
function drawPileup(ctx, colors, rect, one, k, fade = null) {
  const depth = one.depth;
  const perRow = depth <= 40 ? 20 : depth <= 100 ? 22 : depth <= 200 ? 40 : 50;
  const rowsN = Math.ceil(depth / perRow);
  const rh = Math.max(3, Math.min(9, (rect.h - (rowsN - 1) * 3) / rowsN));
  const cw = (rect.w - (perRow - 1) * 2) / perRow;
  for (let i = 0; i < k; i += 1) {
    const rx = rect.x + (i % perRow) * (cw + 2);
    const ry = rect.y + Math.floor(i / perRow) * (rh + 3);
    const variant = one.reads[i] === 1;
    const fresh = fade && i >= fade.from ? fade.t : 1;
    ctx.globalAlpha = (variant ? 1 : 0.45) * fresh;
    ctx.fillStyle = variant ? colors.highlight : colors.ink3;
    ctx.fillRect(rx, ry, cw, rh);
    ctx.globalAlpha = 1;
  }
  /* The empty rows of the pileup are drawn as the space the depth reserves, so
     the picture does not jump as reads arrive (2.5). */
  ctx.save();
  ctx.strokeStyle = wash(colors.grid, 0.8);
  ctx.lineWidth = 1;
  for (let i = k; i < depth; i += 1) {
    const rx = rect.x + (i % perRow) * (cw + 2);
    const ry = rect.y + Math.floor(i / perRow) * (rh + 3);
    ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, cw - 1), Math.max(1, rh - 1));
  }
  ctx.restore();
}

/** The reading itself, with the model's expectation marked on it. */
function drawVafBar(ctx, colors, rect, vaf, expected, { scale = true } = {}) {
  ctx.fillStyle = colors.surface3;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (Number.isFinite(vaf)) {
    ctx.fillStyle = wash(colors.highlight, 0.85);
    ctx.fillRect(rect.x, rect.y, rect.w * vaf, rect.h);
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  if (expected != null) {
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w * expected, rect.y - 4);
    ctx.lineTo(rect.x + rect.w * expected, rect.y + rect.h + 4);
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (scale) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      text(ctx, t.toFixed(2), rect.x + rect.w * t, rect.y + rect.h + 14, {
        font: `${colors.fsXs} ${colors.mono}`,
        fill: colors.ink3,
        align: t === 0 ? "left" : t === 1 ? "right" : "center",
      });
    }
  }
}

/* ---- page 1 -------------------------------------------------------------- */

function drawOne(ctx, colors, L, params, state, anim) {
  const cfg = state.cfg;
  const k = Math.min(anim?.k ?? 0, state.one.depth);
  const vaf = M.vafAt(state.one, k);

  text(ctx, M.STRINGS.cellsCaption, L.cells.x, L.cells.y - 8, { font: capFont(colors), fill: colors.ink1 });
  const counts = drawCells(ctx, colors, L.cells, cfg);
  const cellNote = `${counts.tumour} of ${M.CELLS} cells are tumor cells, ${counts.carrying} of them carrying the mutation`;
  text(ctx, cellNote, L.cells.x, L.cells.y + L.cells.h + 18, { font: noteFont(colors), fill: colors.ink2 });

  text(ctx, M.STRINGS.readsCaption, L.reads.x, L.reads.y - 10, { font: capFont(colors), fill: colors.ink1 });
  text(ctx, `${M.intText(k)} of ${M.intText(state.one.depth)}`, L.reads.x + L.reads.w, L.reads.y - 10, {
    font: noteFont(colors), fill: colors.ink2, align: "right",
  });
  const running = anim?.mode === "run" && !anim?.done && k > 0 && k < state.one.depth;
  const fade = running
    ? { from: Math.max(0, k - M.batchFor(state.one.depth)), t: 0.25 + 0.75 * M.easeOut(anim.beat ?? 0) }
    : null;
  drawPileup(ctx, colors, L.reads, state.one, k, fade);
  drawVafBar(ctx, colors, L.bar, vaf, cfg.expected);
  const readY = L.bar.y + L.bar.h + 32;
  text(ctx, k > 0 ? `VAF ${M.n3(vaf)}` : "VAF —", L.bar.x, readY, {
    font: `${colors.fsSm} ${colors.mono}`, fill: colors.ink1,
  });
  text(ctx, `expected ${M.n3(cfg.expected)}`, L.bar.x + L.bar.w, readY, {
    font: `${colors.fsSm} ${colors.mono}`, fill: colors.theory, align: "right",
  });

  /* DECISION 4: the other arrangements that read what the reader has read.
     Nothing is drawn until a read has landed — the rows are a statement about
     a reading, and there is no reading yet (2.4). Each row is the sample's
     ALLELES rather than its cells: at a row's height the cells are 5px across,
     and the alleles are what the arithmetic divides by anyway. */
  text(ctx, M.STRINGS.rowsCaption, L.rows.x, L.rows.y - 12, { font: capFont(colors), fill: colors.ink1 });
  if (!(k > 0)) {
    text(ctx, "—", L.rows.x, L.rows.y + 14, { font: noteFont(colors), fill: colors.ink3 });
    return;
  }
  const rows = M.arrangementsFor(vaf);
  const labels = { purity: M.STRINGS.purityRow, ccf: M.STRINGS.ccfRow, copies: M.STRINGS.copiesRow };
  const missing = { purity: M.STRINGS.noPurity, ccf: M.STRINGS.noCcf, copies: M.STRINGS.noCopies };
  rows.forEach((row, i) => {
    const y = L.rows.y + i * L.rowH;
    if (!row.ok) {
      text(ctx, missing[row.kind], L.rows.x, y + 16, { font: noteFont(colors), fill: colors.extreme });
      return;
    }
    const alleles = { x: L.rows.x, y, w: L.rows.w * 0.42, h: 14 };
    drawAlleleBar(ctx, colors, alleles, row);
    const barRect = { x: L.rows.x + L.rows.w * 0.52, y, w: L.rows.w * 0.32, h: 14 };
    drawVafBar(ctx, colors, barRect, vaf, null, { scale: false });
    text(ctx, `VAF ${M.n3(vaf)}`, L.rows.x + L.rows.w, y + 11, {
      font: `${colors.fsXs} ${colors.mono}`, fill: colors.ink1, align: "right",
    });
    const desc = row.kind === "purity" ? `purity ${M.n2(row.purity)}`
      : row.kind === "ccf" ? `${M.pctText(row.ccf)} of the tumor cells`
        : `copy number ${row.state.label}`;
    text(ctx, `${labels[row.kind]} — ${desc}`, L.rows.x, y + 30, { font: noteFont(colors), fill: colors.ink2 });
  });
}

/** The sample's alleles in one bar: mutated copies, tumour wild-type copies,
    then the normal cells' two copies each — cell 25's denominator, drawn. */
function drawAlleleBar(ctx, colors, rect, cfg) {
  const tumourCopies = cfg.purity * cfg.state.total;
  const normalCopies = (1 - cfg.purity) * 2;
  const mutated = cfg.purity * cfg.ccf * cfg.copies;
  const total = tumourCopies + normalCopies;
  let x = rect.x;
  for (const [share, fill, stroke] of [
    [mutated, wash(colors.highlight, 0.85), colors.highlight],
    [tumourCopies - mutated, wash(colors.groupA, 0.16), wash(colors.groupA, 0.6)],
    [normalCopies, colors.surface3, colors.grid],
  ]) {
    const w = (share / total) * rect.w;
    if (w <= 0) continue;
    ctx.fillStyle = fill;
    ctx.fillRect(x, rect.y, w, rect.h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, rect.y + 0.5, w - 1, rect.h - 1);
    x += w;
  }
}

/* ---- page 2 -------------------------------------------------------------- */

function drawMany(ctx, colors, L, params, state, anim) {
  /* The mix is where the ease has got to: 0 the reads as they came, 1 the
     fraction. At rest it is whichever axis the control names. */
  const mix = anim?.mix ?? (params.axis === "ccf" ? 1 : 0);
  const axis = M.axisAt(state.many, state.manyCfg, M.easeOut(mix));
  const bins = M.HIST_BINS;

  /* THE DATA MORPH. The bars the new parameters ask for, and — while one is in
     flight — the bars that were on screen when they changed, interpolated. The
     y axis grows with them, but its TICKS are the destination's throughout, so
     a label appears as the axis reaches it instead of the set reshuffling every
     frame. */
  const want = M.histOf(axis.values, state.many.muts, axis.max, bins);
  const wantTop = M.histTop(want);
  const mt = anim?.histFrom ? M.easeOut(anim.histT ?? 1) : 1;
  const counts = anim?.histFrom ? M.lerpHist(anim.histFrom, want, mt) : want;
  const top = anim?.histFrom ? M.lerp(anim.topFrom, wantTop, mt) : wantTop;
  const plot = makePlot({ ctx, colors, rect: L.hist, xDomain: [0, axis.max], yDomain: [0, top] });

  /* The caption is drawn at the top of the canvas rather than through
     `plot.caption`, which sits 8px above the plot — where the clusters'
     brackets are. */
  text(ctx, `${M.intText(state.manyCfg.n)} mutations, purity ${M.n2(state.manyCfg.purity)}`,
    L.hist.x - 6, 20, { font: capFont(colors), fill: colors.ink1 });
  text(ctx, `MATH ${state.many.math.toFixed(1)}`, L.hist.x + L.hist.w + 6, 20, {
    font: `${colors.fsSm} ${colors.mono}`, fill: colors.ink2, align: "right",
  });

  const bw = L.hist.w / bins;
  for (let b = 0; b < bins; b += 1) {
    let base = L.hist.y + L.hist.h;
    for (const [n, fill] of [[counts[b][0], colors.groupA], [counts[b][1], colors.groupB]]) {
      if (n <= 0) continue;
      const h = (n / top) * L.hist.h;
      ctx.fillStyle = wash(fill, 0.85);
      ctx.fillRect(L.hist.x + b * bw + 0.5, base - h, Math.max(1, bw - 1), h);
      base -= h;
    }
  }

  /* The cut belongs to the fraction, so it arrives with it. */
  if (axis.cut != null && axis.mix > 0) {
    ctx.save();
    ctx.globalAlpha = axis.mix;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(plot.sx(axis.cut), L.hist.y);
    ctx.lineTo(plot.sx(axis.cut), L.hist.y + L.hist.h);
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  /* DECISION 6: the mixture's components as enclosure, one level each, fitted
     on the VAF axis and carried onto whichever axis is drawn. */
  const toAxis = (v) => M.lerp(v, M.ccfFrom(v, state.manyCfg.assumed, 1, 2), M.easeOut(mix));
  /* THE BRACKETS THROUGH A MORPH. Re-fitting the same number of components is
     the same clusters moved, so they glide. A different number is not, and two
     sets drawn at once would read as their sum — augmentation's lesson about a
     blend reading as a third thing — so they wipe instead: out over the first
     half, in over the second, never both. */
  const spansWant = state.many.fit.spans;
  const spansFrom = anim?.spansFrom ?? null;
  const paired = Boolean(spansFrom) && spansFrom.length === spansWant.length;
  let spans = spansWant;
  let spanAlpha = 1;
  if (paired) {
    spans = spansWant.map((sp, i) => ({
      lo: M.lerp(spansFrom[i].lo, sp.lo, mt),
      hi: M.lerp(spansFrom[i].hi, sp.hi, mt),
      mu: M.lerp(spansFrom[i].mu, sp.mu, mt),
    }));
  } else if (spansFrom) {
    spans = mt < 0.5 ? spansFrom : spansWant;
    spanAlpha = Math.abs(mt * 2 - 1);
  }
  if (params.clusters && spanAlpha > 0.01) {
    spans.forEach((sp, i) => {
      const x0 = plot.sx(Math.max(0, toAxis(sp.lo)));
      const x1 = plot.sx(Math.min(axis.max, toAxis(sp.hi)));
      const y = L.hist.y - 8 - i * 12;
      ctx.save();
      ctx.globalAlpha = spanAlpha;
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y + 5); ctx.lineTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y + 5);
      /* Held to the axis as `lo` and `hi` are: at purity 0.35 the correction
         multiplies by 5.7 and a mean can land past 1.4, and canvas does not
         clip. Found by the mid-tween extent sweep, 2026-09-16. */
      const xm = plot.sx(Math.min(axis.max, Math.max(0, toAxis(sp.mu))));
      ctx.moveTo(xm, y); ctx.lineTo(xm, y + 5);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = spanAlpha;
      text(ctx, `${i + 1}`, (x0 + x1) / 2, y - 3, {
        font: `${colors.fsXs} ${colors.mono}`, fill: colors.ink2, align: "center",
      });
      ctx.restore();
    });
  }

  plot.axisX({ ticks: axis.ticks, format: (v) => M.n2(v), label: axis.label });
  plot.axisY({ label: "Mutations", ticks: niceTicks(0, wantTop, 4) });

  /* What this draw leaves for the next data change to move from: the bars as
     DRAWN, so an interrupted morph carries on from the figure on screen. */
  carryMany = {
    page: params.page,
    axis: params.axis,
    assumed: params.assumed,
    seed: params.seed,
    clones: params.clones,
    counts,
    top,
    spans,
  };
}

/* ---- page 3 -------------------------------------------------------------- */

function drawTreePage(ctx, colors, L, params, state, anim) {
  const used = state.used;
  const shape = M.shapeOf(params.shape);
  const cols = [colors.groupA, colors.groupB, colors.groupC];
  /* WHERE THE SHAPE GLIDE HAS GOT TO. 0 is SHAPES[0], 1 is SHAPES[1]; at rest
     it is whichever the control names. Only the PICTURE glides — the caption,
     the arithmetic and the readout tiles state the shape the reader has just
     chosen, immediately, because a printed number that lags the data is a
     number the data does not support (page 1's VAF bar, the same ruling). */
  const sMix = M.easeOut(anim?.shapeMix ?? M.shapeIndex(params.shape));

  /* the CCF lines, his figure's left panel */
  const plot = makePlot({ ctx, colors, rect: L.lines, xDomain: [0, M.SAMPLES.length], yDomain: [0, 1] });
  plot.caption(M.STRINGS.linesCaption);
  for (let c = 0; c < 3; c += 1) {
    ctx.beginPath();
    used.forEach((s, i) => {
      const x = plot.sx(i + 0.5);
      const y = plot.sy(s.ccf[c]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = cols[c];
    ctx.lineWidth = 2;
    ctx.stroke();
    used.forEach((s, i) => {
      ctx.beginPath();
      ctx.arc(plot.sx(i + 0.5), plot.sy(s.ccf[c]), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = cols[c];
      ctx.fill();
    });
  }
  plot.axisY({ ticks: [0, 0.5, 1], format: (v) => M.n2(v) });
  plot.axisX({
    ticks: used.map((_, i) => i + 0.5),
    format: (v) => used[Math.floor(v)].key,
  });

  /* the two shapes, the chosen one marked */
  const box = L.trees;
  M.SHAPES.forEach((s, i) => {
    const x = box.x + i * (box.w / 2);
    const w = box.w / 2;
    const cx = x + w / 2;
    const fits = used.every((u) => M.fitsSumRule(s, u.ccf));
    /* One box, slid between the panels rather than two boxes cross-fading: at
       rest it is on the chosen tree, and mid-glide it is between them, which is
       what a reader following it expects to see. Drawn on the first pass only
       so it never lands on top of a tree. */
    if (i === 0) {
      const bx = box.x + sMix * (box.w / 2);
      ctx.save();
      ctx.fillStyle = wash(colors.highlight, 0.1);
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1;
      ctx.fillRect(bx + 2, box.y - 6, w - 4, box.h + 4);
      ctx.strokeRect(bx + 2.5, box.y - 5.5, w - 5, box.h + 3);
      ctx.restore();
    }
    const pos = s.key === "linear"
      ? [[cx, box.y + 22], [cx, box.y + 58], [cx, box.y + 94]]
      : [[cx, box.y + 22], [cx - 22, box.y + 70], [cx + 22, box.y + 70]];
    ctx.save();
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.5;
    s.parents.forEach((p, ci) => {
      ctx.beginPath();
      ctx.moveTo(pos[p][0], pos[p][1] + 11);
      ctx.lineTo(pos[ci + 1][0], pos[ci + 1][1] - 11);
      ctx.stroke();
    });
    ctx.restore();
    pos.forEach((p, ci) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 11, 0, Math.PI * 2);
      ctx.fillStyle = wash(cols[ci], 0.85);
      ctx.fill();
      text(ctx, String(ci + 1), p[0], p[1] + 4, {
        font: `${colors.fsXs} ${colors.mono}`, fill: colors.surface, align: "center",
      });
    });
    /* Both labels sit INSIDE the highlight, which is why the box reaches four
       pixels past them rather than through them. */
    text(ctx, s.label, cx, box.y + box.h - 30, { font: noteFont(colors), fill: colors.ink2, align: "center" });
    text(ctx, fits ? M.STRINGS.fits : M.STRINGS.ruledOut, cx, box.y + box.h - 12, {
      font: capFont(colors), fill: fits ? colors.ink1 : colors.extreme, align: "center",
    });
  });

  /* the cells of each sample under the chosen shape */
  if (!params.showcells) return;
  text(ctx, `${M.STRINGS.rulePrefix} — ${shape.label}`, L.bars.x, L.bars.y - 14, {
    font: capFont(colors), fill: colors.ink1,
  });
  const rowH = L.bars.h / M.SAMPLES.length;
  used.forEach((s, i) => {
    const y = L.bars.y + i * rowH;
    const h = 16;
    /* Two subclones under one trunk can reach 1.1 times the trunk's own width,
       and the overflow is drawn where it would fall — so the bar takes 56% of
       the row and the arithmetic starts at 70%, clear of the widest overflow. */
    const w = L.bars.w * 0.56;
    ctx.fillStyle = colors.surface3;
    ctx.fillRect(L.bars.x, y, w, h);
    /* HIS TWEEN: cluster 3 slides out of cluster 2 to beside it. One rect per
       cluster under each shape, interpolated — the trunk and cluster 2 hold
       still in both, so what moves is cluster 3, and the overflow read off the
       rects as drawn grows under it as it goes. */
    const geom = { x: L.bars.x, y, w, h };
    const rects = M.lerpRects(
      M.barRects(M.SHAPES[0], s.ccf, geom), M.barRects(M.SHAPES[1], s.ccf, geom), sMix,
    );
    const overlap = M.overflowOf(rects);
    /* Painted parent first so a nested child stays on top of it. */
    [0, 1, 2].forEach((c) => {
      ctx.fillStyle = wash(cols[c], c === 0 ? 0.45 : c === 1 ? 0.75 : 0.9);
      ctx.fillRect(rects[c].x, rects[c].y, rects[c].w, rects[c].h);
    });
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(L.bars.x + 0.5, y + 0.5, w - 1, h - 1);
    if (overlap > 0.5) {
      ctx.save();
      ctx.strokeStyle = colors.extreme;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rects[0].x + rects[0].w + 0.5, y - 1.5, overlap, h + 3);
      ctx.restore();
    }
    /* The arithmetic sits to the right of the bar, so it is measured against
       the room it has: the sample, then the ONE constraint that comes closest
       to failing — under 1 → 2 → 3 the root's is slack and cluster 2's is the
       one worth reading. */
    const tight = M.tightestNode(shape, s.ccf);
    const fails = tight.sum > tight.parent + 1e-12;
    text(ctx, `${s.key}  ${M.n2(tight.sum)} ${fails ? ">" : "≤"} ${M.n2(tight.parent)}`, L.bars.x + L.bars.w * 0.7, y + 12, {
      font: `${colors.fsXs} ${colors.mono}`, fill: fails ? colors.extreme : colors.ink2,
    });
  });
}

/* ---- the momentary action ------------------------------------------------ */

function clearDrawAll() {
  if (widgetApi?.setParam) queueMicrotask(() => widgetApi.setParam("all", false));
}

/* ---- the widget ---------------------------------------------------------- */

widgetApi = defineWidget({
  slug: "tumor-heterogeneity",
  title: "Tumor Heterogeneity",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* Decision 1: the page is display, so the reads survive a visit to the
       clusters and back. */
    page: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "one",
      display: true,
    },

    sampleSec: { type: "section", label: M.STRINGS.sampleSection, when: { param: "page", oneOf: ["one", "many"] } },
    purity: {
      type: "choice",
      label: M.STRINGS.purityLabel,
      detail: M.STRINGS.purityDetail,
      options: M.PURITY_OPTIONS,
      default: "0.70",
      when: { param: "page", oneOf: ["one", "many"] },
    },
    ccf: {
      type: "choice",
      label: M.STRINGS.ccfLabel,
      detail: M.STRINGS.ccfDetail,
      options: ["0.25", "0.50", "0.75", "1.00"],
      default: "1.00",
      when: { param: "page", equals: "one" },
    },
    state: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.stateLabel,
      detail: M.STRINGS.stateDetail,
      options: M.COPY_STATES.map((s) => ({ value: s.key, label: s.label })),
      default: "1+1",
      when: { param: "page", equals: "one" },
    },
    /* The list is a function of the copy state — core's `optionsFrom` — because
       how many copies may carry the mutation is a property of the state: one
       per copy of the chromosome it arose on. A slider ran to three in every
       state and let 2 + 1 be asked for three mutated copies, which no cell
       has (Kenneth, 2026-09-16). */
    copies: {
      type: "choice",
      label: M.STRINGS.copiesLabel,
      detail: M.STRINGS.copiesDetail,
      options: (v) => M.copyOptions(v.state),
      optionsFrom: "state",
      default: "1",
      when: { all: [{ param: "page", equals: "one" }, { param: "state", oneOf: ["2+0", "2+1", "3+1"] }] },
    },
    depth: {
      type: "choice",
      label: M.STRINGS.depthLabel,
      detail: M.STRINGS.depthDetail,
      options: M.DEPTH_OPTIONS,
      default: M.DEPTH_DEFAULT,
      when: { param: "page", oneOf: ["one", "many"] },
    },
    clones: {
      type: "segmented",
      label: M.STRINGS.clonesLabel,
      detail: M.STRINGS.clonesDetail,
      options: M.CLONE_SETS.map((c) => ({ value: c.key, label: c.label })),
      default: "two",
      when: { param: "page", equals: "many" },
    },
    mutations: {
      type: "choice",
      label: M.STRINGS.mutationsLabel,
      detail: M.STRINGS.mutationsDetail,
      options: M.MUTATION_OPTIONS,
      default: "300",
      when: { param: "page", equals: "many" },
    },

    /* A section and its fields must agree about the drive row: a section marked
       `afterDrive` whose fields are not renders an empty heading under the
       buttons and the fields above them (read in the browser, 2026-09-16).
       "How to read it" is not a withheld answer, so it stays in place; the
       seed and the momentary action belong below the row. */
    lookSec: { type: "section", label: M.STRINGS.lookSection, when: { param: "page", equals: "many" } },
    axis: {
      type: "segmented",
      label: M.STRINGS.axisLabel,
      detail: M.STRINGS.axisDetail,
      options: M.AXES,
      default: "vaf",
      display: true,
      when: { param: "page", equals: "many" },
    },
    assumed: {
      type: "segmented",
      label: M.STRINGS.assumedLabel,
      detail: M.STRINGS.assumedDetail,
      options: M.ASSUMED,
      default: "sample",
      display: true,
      when: { all: [{ param: "page", equals: "many" }, { param: "axis", equals: "ccf" }] },
    },
    clusters: {
      type: "bool",
      label: M.STRINGS.clustersLabel,
      detail: M.STRINGS.clustersDetail,
      default: true,
      display: true,
      when: { param: "page", equals: "many" },
    },

    samplesSec: { type: "section", label: M.STRINGS.samplesSection, when: { param: "page", equals: "clonal" } },
    taken: {
      type: "choice",
      label: M.STRINGS.takenLabel,
      detail: M.STRINGS.takenDetail,
      options: M.TAKEN_OPTIONS.map((t) => t.key),
      default: "4",
      display: true,
      when: { param: "page", equals: "clonal" },
    },
    shape: {
      type: "segmented",
      label: M.STRINGS.shapeLabel,
      detail: M.STRINGS.shapeDetail,
      options: M.SHAPES.map((s) => ({ value: s.key, label: s.label })),
      default: "linear",
      display: true,
      when: { param: "page", equals: "clonal" },
    },
    /* Named `showcells` and not `cells`: widget 54's grid rail declares a
       `cells` property on a field, and its verify proves no other widget
       has one — a parameter of that name reads as an opt-in to a rail
       shape this widget does not use. */
    showcells: {
      type: "bool",
      label: M.STRINGS.cellsLabel,
      detail: M.STRINGS.cellsDetail,
      default: true,
      display: true,
      when: { param: "page", equals: "clonal" },
    },

    /* Kenneth's ruling on 59: the seed sits in its own section under the drive
       row. The momentary action joins it, as widget 56's does. */
    dataSec: { type: "section", label: M.STRINGS.readsSection, afterDrive: true, when: { param: "page", oneOf: ["one", "many"] } },
    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      detail: M.STRINGS.seedDetail,
      min: 1,
      max: 200,
      default: 1,
      afterDrive: true,
      when: { param: "page", oneOf: ["one", "many"] },
    },
    all: {
      type: "bool",
      style: "action",
      label: M.STRINGS.allLabel,
      detail: M.STRINGS.allDetail,
      default: false,
      display: true,
      afterDrive: true,
      when: { param: "page", equals: "one" },
    },

    /* Authoring escape hatch, first render only: reads already drawn. */
    shown: { type: "int", min: 0, max: 500, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "many") {
      return [
        { token: "group-a", label: "Mutations in every tumor cell", mark: "bar" },
        { token: "group-b", label: "Mutations in some of them", mark: "bar" },
        ...(params.clusters ? [{ token: "ink-2", label: "A cluster the mixture found, at its mean ± one standard deviation", mark: "line" }] : []),
        ...(params.axis === "ccf" ? [{ token: "reference", label: "The threshold at a cancer cell fraction of 0.9", mark: "line" }] : []),
      ];
    }
    if (params.page === "clonal") {
      return [
        { token: "group-a", label: "Cluster 1", mark: "line" },
        { token: "group-b", label: "Cluster 2", mark: "line" },
        { token: "group-c", label: "Cluster 3", mark: "line" },
        { token: "extreme", label: "Cells the shape would need and the sample does not have", mark: "line" },
      ];
    }
    return [
      { token: "group-a", label: "Tumor cells", mark: "dot" },
      { token: "ink-3", label: "Copies of the chromosome the mutation is on, solid; copies of the other, dashed", mark: "line" },
      { token: "highlight", label: "The mutation, and the reads that carry it", mark: "bar" },
      { token: "ink-3", label: "Reads that carry the reference allele", mark: "bar" },
      { token: "theory", label: "The variant allele frequency the model expects", mark: "line" },
    ];
  },

  /* Decision 1: every page is built on every data change, in a fixed order. */
  compute({ params, rng }) {
    const cfg = M.configOne(params);
    const one = M.buildReads(rng, cfg);
    const manyCfg = M.configMany({ ...params, purity2: params.purity, depth2: params.depth });
    const many = M.buildMany(rng, manyCfg);
    const used = M.SAMPLES.slice(0, M.takenOf(params.taken).n);
    return { cfg, one, manyCfg, many, used };
  },

  animation: {
    /* Decision 2: the reads are the animation, and a unit is a fixed number of
       them, so every depth fills in a few seconds (3.4c names the noun). */
    stepLabel: { param: "depth", labels: { 31: "Add one read", 88: "Add two reads", 161: "Add three reads", 500: "Add eight reads" }, default: "Add one read" },
    stepTitle: "Draw one more read from the sample's alleles",
    runTitle: "Draw reads until the pileup is full",

    init: ({ params, state, fromScratch }) => {
      const authored = params.all ? state.one.depth : Math.max(0, params.shown ?? 0);
      const k = fromScratch ? 0 : Math.min(state.one.depth, authored);
      /* A DATA CHANGE ON PAGE 2 MAY DESERVE A TRANSITION — core's second ease
         door, the one widget 53 opened. The new mutations are a re-reading of
         the same tumour when only purity, the read depth or how many mutations
         were called has moved; a different seed or a different set of cell
         populations is a different tumour and lands without one. */
      const morph = Boolean(carryMany) && params.page === "many" && carryMany.page === "many"
        && carryMany.axis === params.axis && carryMany.assumed === params.assumed
        && carryMany.seed === params.seed && carryMany.clones === params.clones
        && !reducedMotion();
      return {
        k,
        beat: 0,
        done: k >= state.one.depth,
        /* Decision 2: pages 2 and 3 land finished. */
        inert: params.page !== "one",
        /* Where page 2's axis has got to, and which axis it is heading for. */
        mix: params.axis === "ccf" ? 1 : 0,
        axis: params.axis,
        /* Page 2's data morph: the bars it starts from, and how far along. */
        histFrom: morph ? carryMany.counts : null,
        topFrom: morph ? carryMany.top : 0,
        spansFrom: morph ? carryMany.spans : null,
        histT: 0,
        easing: morph,
        /* Page 3's shape: 0 is SHAPES[0], 1 is SHAPES[1], and it eases toward
           whichever the control names — one scalar, exactly like `mix`, so a
           switch turned round mid-glide leaves from where the figure is. */
        shapeMix: M.shapeIndex(params.shape),
        shape: params.shape,
      };
    },

    advance: (anim, { dt, state }) => {
      /* Core's ease mode: the frames for the axis, and nothing else moves in
         them (widget 60's shape). */
      if (anim.mode === "ease") {
        const step = dt / M.EASE_MS;
        const toward = (at, target) => (target > at ? Math.min(target, at + step) : Math.max(target, at - step));
        let moving = false;

        const axisTarget = anim.axis === "ccf" ? 1 : 0;
        anim.mix = toward(anim.mix, axisTarget);
        if (anim.mix !== axisTarget) moving = true;

        const shapeTarget = M.shapeIndex(anim.shape);
        anim.shapeMix = toward(anim.shapeMix, shapeTarget);
        if (anim.shapeMix !== shapeTarget) moving = true;

        /* The bars' clock runs one way: `init` sets where it starts from, and a
           change landing mid-morph re-inits from the figure on screen. Cleared
           on landing so nothing downstream reads a finished morph as a live
           one; the value at 1 is the destination either way. */
        if (anim.histFrom) {
          anim.histT = Math.min(1, anim.histT + step);
          if (anim.histT < 1) moving = true;
          else { anim.histFrom = null; anim.spansFrom = null; }
        }
        return moving;
      }
      const end = state.one.depth;
      if (anim.k >= end) { anim.beat = 0; anim.done = true; return false; }
      anim.beat += dt / M.UNIT_MS;
      if (anim.beat < 1) return true;
      const batch = M.batchFor(end);
      const units = anim.mode === "step" ? 1 : Math.floor(anim.beat);
      anim.beat = anim.mode === "step" ? 0 : anim.beat - units;
      anim.k = Math.min(end, anim.k + units * batch);
      if (anim.k >= end) { anim.beat = 0; anim.done = true; return false; }
      return anim.mode !== "step";
    },

    rebuild: (anim, { params, state }) => {
      if (params.all) {
        anim.k = state.one.depth;
        anim.beat = 0;
        clearDrawAll();
      }
      anim.k = Math.min(anim.k, state.one.depth);
      anim.inert = params.page !== "one";
      anim.done = anim.k >= state.one.depth;
      /* The axis moved: ask core for frames once, and ease from wherever the
         figure IS — an ease turned round mid-flight starts there, not at the
         end it was heading for. A page change is not eased. */
      if (params.axis !== anim.axis) {
        anim.axis = params.axis;
        if (params.page === "many") anim.easing = true;
        else anim.mix = params.axis === "ccf" ? 1 : 0;
      }
      if (params.page !== "many" && !anim.easing) anim.mix = params.axis === "ccf" ? 1 : 0;
      /* Leaving page 2 lands its morph rather than leaving it in flight: a
         transition nobody is watching has nothing to show, and coming back to
         a figure still halfway between two sets of parameters would be a
         figure of neither. The same ruling as the shape, below. */
      if (params.page !== "many") { anim.histFrom = null; anim.spansFrom = null; }
      /* The shape moved: the same door as the axis, on the same page-3 terms.
         Off page 3 it lands, so a reader who switches shape from elsewhere and
         then arrives finds the figure already there. */
      if (params.shape !== anim.shape) {
        anim.shape = params.shape;
        if (params.page === "clonal" && !reducedMotion()) anim.easing = true;
        else anim.shapeMix = M.shapeIndex(params.shape);
      }
      if (params.page !== "clonal" && !anim.easing) anim.shapeMix = M.shapeIndex(params.shape);
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    /* The card is mounted from here, never at module scope: `buildShell`
       creates `.w-figure` inside `defineWidget`, so a module-scope query
       returns null and the reader gets a blank page. */
    const card = cardForPage(params, state, anim);
    renderCard(params.page, card.rows, card.note);
    const L = M.layout(w, params);
    if (L.page === "many") { drawMany(ctx, colors, L, params, state, anim); return; }
    if (L.page === "clonal") { drawTreePage(ctx, colors, L, params, state, anim); return; }
    drawOne(ctx, colors, L, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.page === "many") {
      const axis = M.onAxis(state.many, state.manyCfg, params.axis);
      const past = axis.cut == null ? null : axis.values.filter((v) => v >= axis.cut).length;
      return [
        { label: "Clusters found", value: String(state.many.fit.K), note: "components in the mixture with the lowest BIC" },
        { label: "MATH", value: state.many.math.toFixed(1), note: "the width of the VAF distribution over its median" },
        {
          label: params.axis === "ccf" ? "At a fraction of 0.9 or more" : "Populations in the tumor",
          value: past == null ? String(state.manyCfg.clones.length) : M.intText(past),
          note: past == null ? "what the mutations were drawn from" : `of ${M.intText(state.manyCfg.n)} mutations`,
        },
      ];
    }
    if (params.page === "clonal") {
      const shape = M.shapeOf(params.shape);
      const fits = state.used.every((s) => M.fitsSumRule(shape, s.ccf));
      /* A shape fits the evidence when it fits EVERY sample used, so the count
         is the shapes surviving the first sample intersected with the rest. */
      const both = state.used
        .map((s) => M.shapesFitting(s.ccf))
        .reduce((keep, fitting) => keep.filter((s) => fitting.includes(s)), [...M.SHAPES]).length;
      const failing = state.used.find((s) => !M.fitsSumRule(shape, s.ccf));
      return [
        { label: "This shape", value: fits ? "Fits" : "Ruled out", note: failing ? `by ${failing.key}` : `on ${state.used.length} sample${state.used.length > 1 ? "s" : ""}` },
        { label: "Shapes that fit", value: `${both} of ${M.SHAPES.length}`, note: "given the samples used" },
        { label: "Samples used", value: String(state.used.length), note: "biopsies of one patient" },
      ];
    }
    const k = Math.min(anim?.k ?? 0, state.one.depth);
    const vaf = M.vafAt(state.one, k);
    const cfg = state.cfg;
    const ccf = k > 0 ? M.ccfFrom(vaf, cfg.purity, cfg.copies, cfg.state.total) : NaN;
    return [
      { label: "Reads carrying it", value: k > 0 ? `${M.intText(M.altAt(state.one, k))} / ${M.intText(k)}` : "—", note: `of ${M.intText(state.one.depth)} at this depth` },
      { label: "Variant allele frequency", value: k > 0 ? M.n3(vaf) : "—", note: `the model expects ${M.n3(cfg.expected)}` },
      { label: "Cancer cell fraction", value: k > 0 ? M.n2(ccf) : "—", note: "the reading with this purity and copy number divided out" },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "many") {
      const axis = M.onAxis(state.many, state.manyCfg, params.axis);
      return `A histogram of ${M.intText(state.manyCfg.n)} mutations on the ${axis.label.toLowerCase()} axis, `
        + `from ${state.manyCfg.clones.length} cell population${state.manyCfg.clones.length > 1 ? "s" : ""} at purity `
        + `${M.n2(state.manyCfg.purity)}. A Gaussian mixture of ${state.many.fit.K} component`
        + `${state.many.fit.K > 1 ? "s" : ""} has the lowest BIC, and MATH is ${state.many.math.toFixed(1)}.`;
    }
    if (params.page === "clonal") {
      const shape = M.shapeOf(params.shape);
      const failing = state.used.find((s) => !M.fitsSumRule(shape, s.ccf));
      return `Three clusters' mean cancer cell fraction across ${state.used.length} sample`
        + `${state.used.length > 1 ? "s" : ""} of one patient, against the shape ${shape.label}, which `
        + `${failing ? `is ruled out by ${failing.key}` : "fits every sample used"}.`;
    }
    const k = Math.min(anim?.k ?? 0, state.one.depth);
    const cfg = state.cfg;
    const cells = `${Math.round(M.CELLS * cfg.purity)} of ${M.CELLS} cells are tumor cells, `
      + `${M.pctText(cfg.ccf)} of them carrying the mutation on ${cfg.copies} of ${cfg.state.total} copies`;
    if (k === 0) return `A sample of ${M.CELLS} cells in which ${cells}, with an empty pileup of ${M.intText(state.one.depth)} reads below it.`;
    return `A sample of ${M.CELLS} cells in which ${cells}. `
      + `${M.intText(M.altAt(state.one, k))} of the ${M.intText(k)} reads drawn so far carry the mutation, `
      + `a variant allele frequency of ${M.n3(M.vafAt(state.one, k))} against the ${M.n3(cfg.expected)} the model expects.`;
  },
});
