/* ============================================================================
   Widget 67 · Tumor Heterogeneity — PHM5003 07 / 01-2 cells 17–25.

   `model.js` carries the stage, the arithmetic and the copy, and the decisions
   taken while building; this file draws them. Four pages in the notebook's
   order, from Kenneth's picks of 2026-09-16 and 2026-09-26: One mutation ·
   Many mutations · Cancer cell fraction · Clonal architecture.

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

/* PAGES 1 AND 3'S SAMPLE, AS LAST DRAWN (2026-09-26, his "tweening … including
   responding to slider control changes"). A change to the case, the share of
   cells carrying it or the purity is a data change — the reads start over, as
   they must (invariant 3) — but the sample on screen is the same sixty cells
   read again, so the cells that change fade across and the expected VAF's line
   and the true fraction's tick glide to where the new sample puts them. The
   seed and the depth change only the reads, so they carry nothing. */
let carryOne = null;
const oneKey = (cfg) => `${cfg.purity}|${cfg.ccf}|${cfg.state.key}|${cfg.copies}`;

/* PAGE 3'S CURVES, AS LAST DRAWN: relative likelihood per m, and each band.
   "Given" is a display change, so the reads stay and the curves move from what
   one assumption allows to what the next allows. */
let carryLik = null;

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

/* Page 1's line, in words: cell 17 names no letter for the fraction. */
const SAMPLE_MATH = `<math><mrow>${mi("VAF")}${mo("=")}<mfrac><mtext>mutated copies</mtext>`
  + `<mtext>all copies</mtext></mfrac></mrow></math>`;
const SAMPLE_PLAIN = "VAF = mutated copies / all copies";

/* L(c, m) = Pr(k | n, VAF(c, m)), 01-2 cell 25 §3, for one mutation. */
const LIK_MATH = `<math><mrow>${mi("L")}${mo("(")}${mi("c")}${mo(",")}${mi("m")}${mo(")")}${mo("=")}`
  + `${mi("Pr")}${mo("(")}${mi("k")}${mo("|")}${mi("n")}${mo(",")}${mi("VAF")}${mo("(")}${mi("c")}`
  + `${mo(",")}${mi("m")}${mo(")")}${mo(")")}</mrow></math>`;
const LIK_PLAIN = "L(c, m) = Pr(k | n, VAF(c, m))";

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
    const shape = M.shapeOf(params.tree);
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
  if (M.histPage(params)) {
    const cfg = state.manyCfg;
    const vafs = state.many.muts.map((m) => m.vaf);
    const mid = M.median(vafs);
    const mad = M.median(vafs.map((v) => Math.abs(v - mid)));
    const mathRow = [S.labelMath, MATHML ? MATH_SCORE_MATH : MATH_SCORE_PLAIN,
      numbers(`= 100 × 1.4826 × ${M.n3(mad)} / ${M.n3(mid)} = ${state.many.math.toFixed(1)}`)];
    /* Page 2 is cells 21–23 and reads VAF only (2026-09-26), so its card is
       MATH alone; the fraction's line is page 3's, where the axis is. */
    if (params.page === "many") return { rows: [mathRow], note: S.noteMany };
    const factor = M.ccfFrom(1, cfg.assumed, 1, 2);
    return {
      rows: [
        [S.labelFraction, MATHML ? CCF_MATH : CCF_PLAIN,
          numbers(`= VAF × ${M.n2(factor)}   at purity ${M.n2(cfg.assumed)}, one copy of two`)],
      ],
      note: S.noteAll,
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
  if (params.page === "one") {
    /* NO LETTER FOR THE FRACTION ON PAGE 1 (Kenneth, 2026-09-26: "don't put
       CCF here"). Cell 17 states the readings in words and numbers; the
       letters arrive with cell 25 on page 3. So the sample's line is copies
       counted in words, with this sample's shares in it. */
    return {
      rows: [
        [S.labelReading, reading],
        [S.labelSampleLine, MATHML ? SAMPLE_MATH : SAMPLE_PLAIN, worked(
          `${M.n2(p)} × ${M.n2(cfg.ccf)} × ${cfg.copies}`,
          `${M.n2(p)} × ${cfg.state.total} + ${M.n2(1 - p)} × 2`,
          M.n3(cfg.expected),
        )],
      ],
      note: S.noteOne,
    };
  }
  /* PAGE 3, CELL 25 IN ITS OWN THREE STEPS: the model at what the analysis is
     given, c solved from the reading for each m (§2), and the likelihood (§3).
     The model's line prints the given purity and copies with c and m left as
     letters, because those two are what the page infers. §2 is solved from
     the READING, so it can pass 1 — the shipped page solved it from the
     expected VAF to avoid that, which put a number the analysis does not have
     on the card; the likelihood below it is what keeps c inside 0 to 1. */
  const given = M.givenOf(cfg, params.knows);
  const per = M.vafExpected(given.p, 1, 1, given.C);
  const factor = M.ccfFrom(1, given.p, 1, given.C);
  const lik = k > 0 ? M.likelihoodOf(alt, k, cfg, params.knows) : null;
  const solved = given.ms.map((m) => `${M.n2((vaf * factor) / m)} at m = ${m}`).join(", ");
  const allowed = lik ? lik.allowed.map((cv) => `${M.n2(cv.interval.lo)}–${M.n2(cv.interval.hi)} at m = ${cv.m}`).join(", ") : "";
  return {
    rows: [
      [S.labelModel, MATHML ? MODEL_MATH : MODEL_PLAIN,
        numbers(`= ${M.n2(given.p)} c m / (${M.n2(given.p)} × ${given.C} + 2 × ${M.n2(1 - given.p)}) = ${M.n3(per)} × c × m`)],
      [S.labelFraction, MATHML ? CCF_MATH : CCF_PLAIN,
        numbers(k > 0 ? `= ${M.n3(vaf)} × ${M.n2(factor)} ÷ m = ${solved}` : `= VAF × ${M.n2(factor)} ÷ m`)],
      [S.labelLikelihood, MATHML ? LIK_MATH : LIK_PLAIN,
        numbers(lik ? `k = ${alt}, n = ${k}: c ${allowed}` : "k and n come from the reads")],
    ],
    note: `${S.noteCcf} ${S.levelNote[given.known]}`,
  };
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
 * Sixty cells: normal cells carry two wild-type copies, tumour cells the case's
 * copies, and the ones inside the share carrying it hold the mutation on
 * `copies` of them (model decision 3).
 *
 * A CELL THAT CHANGES FADES OUT, THEN IN (Kenneth, 2026-09-26: "tweening …
 * including responding to slider control changes"). `from` is the sample the
 * last draw showed and `t` how far the change has run; a cell whose look is the
 * same under both is drawn once, still, and a cell whose look differs leaves
 * over the first half and arrives over the second — never both at once, since
 * two cells blended read as a third kind of cell (§ *Widget 62*, a blend reads
 * as a third technique). So a purity change turns cells grey one by one in the
 * grid's own order, and a change of case redraws only the tumour cells.
 */
function cellLook(cfg, i, n) {
  const { tumour, carrying } = M.cellCounts(cfg, n);
  const isTumour = i < tumour;
  const state = isTumour ? cfg.state : M.stateOf("1+1");
  const marks = isTumour && i < carrying ? cfg.copies : 0;
  return { isTumour, state, marks, key: `${isTumour}|${state.total}|${marks}` };
}

function paintCell(ctx, colors, cx, cy, r, look) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = look.isTumour ? wash(colors.groupA, 0.16) : colors.surface3;
  ctx.fill();
  ctx.strokeStyle = look.isTumour ? wash(colors.groupA, 0.75) : wash(colors.ink3, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  /* `cellMarks` solves the four-copy case first and uses that mark in every
     state, so the mutation is one size whatever the copy number is, and no
     copy or mark reaches the cell's border (model, CELL_RIM).

     ONE KIND OF LINE since 2026-09-26, his pick: the solid and dashed parental
     copies (pick D of 2026-09-16, `_lab/vaf-cell-mock.html`) confused more
     than they taught, and the VAF never uses which parent a copy came from.
     The mark sits on the first `marks` copies. */
  const { mark, lines } = M.cellMarks(r, look.state.total);
  lines.forEach(({ dy, len }, c) => {
    const oy = cy + dy;
    ctx.beginPath();
    ctx.moveTo(cx - len / 2, oy);
    ctx.lineTo(cx + len / 2, oy);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (c < look.marks) {
      ctx.beginPath();
      ctx.arc(cx, oy, mark, 0, Math.PI * 2);
      ctx.fillStyle = colors.highlight;
      ctx.fill();
    }
  });
}

function drawCells(ctx, colors, rect, cfg, { n = M.CELLS, from = null, t = 1 } = {}) {
  const { cols, px, py, r } = M.cellGrid(rect, n);
  for (let i = 0; i < n; i += 1) {
    const cx = rect.x + (i % cols) * px + px / 2;
    const cy = rect.y + Math.floor(i / cols) * py + py / 2;
    const look = cellLook(cfg, i, n);
    const was = from && t < 1 ? cellLook(from, i, n) : null;
    if (!was || was.key === look.key) { paintCell(ctx, colors, cx, cy, r, look); continue; }
    ctx.save();
    ctx.globalAlpha = t < 0.5 ? 1 - 2 * t : 2 * t - 1;
    paintCell(ctx, colors, cx, cy, r, t < 0.5 ? was : look);
    ctx.restore();
  }
  return M.cellCounts(cfg, n);
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

/** The sample's cells and its reads, drawn the same on pages 1 and 3 (his pick
    L2, 2026-09-26), so switching pages changes only what is under the reads. */
function drawSampleAndReads(ctx, colors, L, state, anim) {
  const cfg = state.cfg;
  const k = Math.min(anim?.k ?? 0, state.one.depth);
  /* The change in flight, if any: where the sample was and how far it has run. */
  const mo = anim?.oneFrom && (anim.oneT ?? 1) < 1 ? { from: anim.oneFrom, t: anim.oneT, e: M.easeOut(anim.oneT) } : null;
  text(ctx, M.STRINGS.cellsCaption, L.cells.x, L.cells.y - 8, { font: capFont(colors), fill: colors.ink1 });
  const counts = drawCells(ctx, colors, L.cells, cfg, mo ? { from: mo.from.cfg, t: mo.t } : {});
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
  return { k, mo };
}

/* CELL 17'S THREE READINGS, ON THE SCALE THEY ARE READINGS OF — his pick A of
   2026-09-26 (`_lab/tumor-heterogeneity-order-mock.html` § 4). The lesson
   reads a VAF as ≈ 1, ≈ 0.5 or < 0.5 under purity 1, no copy change and the
   mutation on one copy; the marks put those words where each one means, and
   the sample's own expected VAF (the red line) moves off them as copy number
   and purity change — at purity 0.70 it sits inside "< 0.5" while every tumor
   cell above carries the mutation, which is cell 17's "other considerations"
   in one picture. Drawn from the first frame: they are the lesson's scale,
   not a reading of this sample, so there is nothing for them to give away. */
function drawReadings(ctx, colors, rect) {
  const at = (v) => rect.x + rect.w * v;
  const low = rect.y + rect.h - 8;
  const high = rect.y + 10;
  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  /* < 0.5: a bracket from 0 to just short of 0.5, on the lower row */
  ctx.beginPath();
  ctx.moveTo(at(0) + 0.5, low - 5); ctx.lineTo(at(0) + 0.5, low); ctx.lineTo(at(0.49), low); ctx.lineTo(at(0.49), low - 5);
  ctx.stroke();
  /* ≈ 0.5 and ≈ 1: a dotted rule down to the bar, each label on its own row */
  ctx.setLineDash([2, 2]);
  for (const [v, y] of [[0.5, high], [1, low]]) {
    const x = v === 1 ? at(1) - 0.5 : at(v);
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, rect.y + rect.h + 6); ctx.stroke();
  }
  ctx.restore();
  const f = noteFont(colors);
  text(ctx, M.STRINGS.readingLow, at(0.245), low - 4, { font: f, fill: colors.ink2, align: "center" });
  text(ctx, M.STRINGS.readingHalf, at(0.5) + 5, high, { font: f, fill: colors.ink2 });
  text(ctx, M.STRINGS.readingOne, at(1) - 5, low - 4, { font: f, fill: colors.ink2, align: "right" });
}

function drawOne(ctx, colors, L, params, state, anim) {
  const cfg = state.cfg;
  const { k, mo } = drawSampleAndReads(ctx, colors, L, state, anim);
  const vaf = M.vafAt(state.one, k);
  drawReadings(ctx, colors, L.marks);
  /* The line is the sample's claim, so it glides; the printed number beside it
     is the destination at once, since a number that lags the parameters is a
     number they do not support (the same ruling as the VAF bar). */
  const expected = mo ? M.lerp(mo.from.expected, cfg.expected, mo.e) : cfg.expected;
  const tick = mo ? M.lerp(mo.from.ccf, cfg.ccf, mo.e) : cfg.ccf;
  carryOne = { cfg, key: oneKey(cfg), expected, ccf: tick };
  drawVafBar(ctx, colors, L.bar, vaf, expected);
  const readY = L.bar.y + L.bar.h + 32;
  text(ctx, k > 0 ? `VAF ${M.n3(vaf)}` : "VAF —", L.bar.x, readY, {
    font: `${colors.fsSm} ${colors.mono}`, fill: colors.ink1,
  });
  text(ctx, `the sample gives ${M.n3(cfg.expected)}`, L.bar.x + L.bar.w, readY, {
    font: `${colors.fsSm} ${colors.mono}`, fill: colors.theory, align: "right",
  });
}

/* ---- page 3, one mutation: cell 25 §3 ------------------------------------ */

/**
 * One curve per multiplicity the analysis considers, relative likelihood over
 * c in (0, 1], the band each allows shaded under it, the threshold dashed and
 * the true fraction as a tick (his picks B and L2, 2026-09-26). The curves
 * narrow as reads arrive, which is Step and Play doing the inference.
 *
 * m takes the group colours in order — parallel hypotheses about one reading,
 * the role `--c-group-c` was added for (CLAUDE.md, 2026-09-10).
 */
function drawCcfOne(ctx, colors, L, params, state, anim) {
  const cfg = state.cfg;
  const { k, mo } = drawSampleAndReads(ctx, colors, L, state, anim);
  const R = L.lik;
  const given = M.givenOf(cfg, params.knows);
  const what = given.known === "nothing" ? M.STRINGS.assumingPure
    : given.known === "purity" ? M.STRINGS.assumingDiploid(M.n2(cfg.purity))
      : M.STRINGS.givenBoth(M.n2(cfg.purity), cfg.state.label, M.caseOf(cfg.state.key).copiesText);
  text(ctx, `${M.STRINGS.likCaption} — ${what}`, R.x - 8, R.y - 14, { font: capFont(colors), fill: colors.ink1 });

  const plot = makePlot({ ctx, colors, rect: R, xDomain: [0, 1], yDomain: [0, 1.08] });
  const alt = M.altAt(state.one, k);
  const lik = k > 0 ? M.likelihoodOf(alt, k, cfg, params.knows) : null;
  const cols = [colors.groupA, colors.groupB, colors.groupC];

  /* WHAT IS DRAWN, per m: the relative curve and its band, each a blend of
     where "Given" left it and where it is now. An m on both sides moves; an m
     only one side considers fades, out over the first half or in over the
     second (never both at once — the same rule as the cells). */
  const now = lik ? lik.curves.map((cv) => ({
    m: cv.m, rel: cv.ys.map((y) => Math.exp(y - lik.top)), cHat: cv.cHat, peak: Math.exp(cv.max - lik.top), band: cv.interval,
  })) : [];
  const lt = anim?.likFrom && (anim.likT ?? 1) < 1 && lik ? anim.likT : 1;
  const le = M.easeOut(lt);
  const was = lt < 1 ? anim.likFrom : [];
  const shown = [];
  for (const cv of now) {
    const old = was.find((o) => o.m === cv.m);
    if (lt >= 1) { shown.push({ ...cv, alpha: 1 }); continue; }
    if (old) {
      shown.push({
        m: cv.m, alpha: 1,
        rel: cv.rel.map((v, i) => M.lerp(old.rel[i], v, le)),
        cHat: M.lerp(old.cHat, cv.cHat, le), peak: M.lerp(old.peak, cv.peak, le),
        band: old.band && cv.band ? { lo: M.lerp(old.band.lo, cv.band.lo, le), hi: M.lerp(old.band.hi, cv.band.hi, le) } : (lt < 0.5 ? old.band : cv.band),
      });
    } else if (lt >= 0.5) shown.push({ ...cv, alpha: 2 * lt - 1 });
  }
  if (lt < 0.5) for (const old of was) if (!now.some((cv) => cv.m === old.m)) shown.push({ ...old, alpha: 1 - 2 * lt });
  if (lik) carryLik = shown.map(({ alpha, ...cv }) => cv);

  shown.forEach((cv) => {
    if (!cv.band) return;
    ctx.save();
    ctx.globalAlpha = cv.alpha;
    ctx.fillStyle = wash(cols[cv.m - 1], 0.14);
    const x0 = plot.sx(cv.band.lo - 0.0025);
    ctx.fillRect(x0, R.y, plot.sx(cv.band.hi) - x0, R.h);
    ctx.restore();
  });
  /* the threshold, in ink: `--c-reference` is the truth's tick on this page */
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(plot.sx(M.CUT), R.y); ctx.lineTo(plot.sx(M.CUT), R.y + R.h); ctx.stroke();
  ctx.restore();

  if (lik) {
    shown.forEach((cv) => {
      const i = cv.m - 1;
      ctx.save();
      ctx.globalAlpha = cv.alpha;
      ctx.beginPath();
      cv.rel.forEach((v, j) => {
        const X = plot.sx(M.LIK_GRID[j]);
        const Y = plot.sy(v);
        if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = 2;
      ctx.stroke();
      /* The label sits over the curve's peak; labels are stacked by m, so two
         peaks at one place do not print on each other. */
      const px = plot.sx(cv.cHat);
      const py = plot.sy(cv.peak);
      const right = px > R.x + R.w - 28;
      text(ctx, `m = ${cv.m}`, right ? px - 4 : Math.max(R.x + 22, px), Math.max(R.y + 10 + 12 * i, py - 6), {
        font: `600 ${colors.fsXs} ${colors.font}`, fill: cols[i], align: right ? "right" : "center",
      });
      ctx.restore();
    });
  } else {
    text(ctx, M.STRINGS.likNoRead, R.x + R.w / 2, R.y + R.h / 2, { font: noteFont(colors), fill: colors.ink3, align: "center" });
  }

  /* The truth: the fraction of tumor cells carrying it, counted in the cells
     above. Drawn from the first frame, as the cells are. */
  const tick = mo ? M.lerp(mo.from.ccf, cfg.ccf, mo.e) : cfg.ccf;
  carryOne = { cfg, key: oneKey(cfg), expected: mo ? M.lerp(mo.from.expected, cfg.expected, mo.e) : cfg.expected, ccf: tick };
  const tx = plot.sx(tick);
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(tx, R.y + R.h - 9); ctx.lineTo(tx, R.y + R.h + 3); ctx.stroke();
  ctx.restore();

  plot.axisX({ ticks: [0, 0.25, 0.5, 0.75, M.CUT, 1], format: (v) => (v === M.CUT ? String(M.CUT) : M.n2(v)), label: M.STRINGS.likAxis });
}

/* ---- page 2 -------------------------------------------------------------- */

function drawMany(ctx, colors, L, params, state, anim) {
  /* The mix is where the ease has got to: 0 the reads as they came, 1 the
     fraction. At rest it is whichever axis the control names. */
  /* Page 2 reads VAF only (2026-09-26); the axis and its ease are page 3's. */
  const mix = params.page === "many" ? 0 : (anim?.mix ?? (params.axis === "ccf" ? 1 : 0));
  /* "Given" on the fraction axis multiplies every mutation by 2 / purity, so a
     switch between Nothing and Purity is one rescaling — eased through the
     factor, like the axis, so the mutations slide rather than jump (2026-09-26).
     The card and the tiles state the destination at once. */
  let cfgMany = state.manyCfg;
  if (anim?.assumedFrom != null && (anim.assumedT ?? 1) < 1) {
    const f = M.lerp(2 / anim.assumedFrom, 2 / state.manyCfg.assumed, M.easeOut(anim.assumedT));
    cfgMany = { ...state.manyCfg, assumed: 2 / f };
  }
  const axis = M.axisAt(state.many, cfgMany, M.easeOut(mix));
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
  const toAxis = (v) => M.lerp(v, M.ccfFrom(v, cfgMany.assumed, 1, 2), M.easeOut(mix));
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
    axis: M.axisOf(params),
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
  const shape = M.shapeOf(params.tree);
  const cols = [colors.groupA, colors.groupB, colors.groupC];
  /* WHERE THE SHAPE GLIDE HAS GOT TO. 0 is SHAPES[0], 1 is SHAPES[1]; at rest
     it is whichever the control names. Only the PICTURE glides — the caption,
     the arithmetic and the readout tiles state the shape the reader has just
     chosen, immediately, because a printed number that lags the data is a
     number the data does not support (page 1's VAF bar, the same ruling). */
  const sMix = M.easeOut(anim?.shapeMix ?? M.shapeIndex(params.tree));

  /* the CCF lines, his figure's left panel */
  const plot = makePlot({ ctx, colors, rect: L.lines, xDomain: [0, M.SAMPLES.length], yDomain: [0, 1] });
  plot.caption(M.STRINGS.linesCaption);
  /* EACH SAMPLE STAYS AT ITS PLACE ON THE FIGURE'S TIMELINE. Positions came
     from the order of the samples in use, so once the surgery sample joined
     first it would have been drawn at the left, before the biopsies it
     followed. The axis is the figure's four samples; only the ones in use are
     drawn, and joined in time order. */
  const at = (s) => M.SAMPLES.indexOf(s) + 0.5;
  /* SAMPLES JOINING AND LEAVING (2026-09-26, his "tweening where
     appropriate"). While the samples-used control is easing, the figure draws
     every sample in either set, in time order: a sample in both is solid, one
     joining fades in over the second half and one leaving fades out over the
     first, and a line segment is as faint as its fainter end — so a new
     biopsy's points arrive and the lines reach them, rather than the whole
     panel being redrawn. */
  const tt = anim?.takenFrom && (anim.takenT ?? 1) < 1 ? anim.takenT : 1;
  const before = tt < 1 ? anim.takenFrom : used.map((smp) => smp.key);
  const drawn = M.SAMPLES.filter((smp) => used.includes(smp) || before.includes(smp.key));
  const alphaOf = (smp) => {
    const inNew = used.includes(smp);
    const inOld = before.includes(smp.key);
    if (inNew && inOld) return 1;
    if (inNew) return tt < 0.5 ? 0 : 2 * tt - 1;
    return tt < 0.5 ? 1 - 2 * tt : 0;
  };
  for (let c = 0; c < 3; c += 1) {
    for (let i = 1; i < drawn.length; i += 1) {
      const a = Math.min(alphaOf(drawn[i - 1]), alphaOf(drawn[i]));
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(plot.sx(at(drawn[i - 1])), plot.sy(drawn[i - 1].ccf[c]));
      ctx.lineTo(plot.sx(at(drawn[i])), plot.sy(drawn[i].ccf[c]));
      ctx.strokeStyle = cols[c];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    drawn.forEach((smp) => {
      const a = alphaOf(smp);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      /* The figure's error bar, under the point it belongs to. */
      ctx.strokeStyle = wash(cols[c], 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(plot.sx(at(smp)), plot.sy(smp.lo[c]));
      ctx.lineTo(plot.sx(at(smp)), plot.sy(smp.hi[c]));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(plot.sx(at(smp)), plot.sy(smp.ccf[c]), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = cols[c];
      ctx.fill();
      ctx.restore();
    });
  }
  plot.axisY({ ticks: [0, 0.5, 1], format: (v) => M.n2(v) });
  plot.axisX({
    ticks: used.map(at),
    format: (v) => M.SAMPLES[Math.floor(v)].key,
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
      const { from, to } = M.connectorEnds(pos[p], pos[ci + 1]);
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      /* AN ARROWHEAD, as his figure draws: a parent gives rise to a child,
         which a plain line does not say. Its tip is the connector's own end,
         so it lands on the child's edge along the same radial line. */
      const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
      ctx.beginPath();
      ctx.moveTo(to[0], to[1]);
      ctx.lineTo(to[0] - 6 * Math.cos(ang - 0.45), to[1] - 6 * Math.sin(ang - 0.45));
      ctx.lineTo(to[0] - 6 * Math.cos(ang + 0.45), to[1] - 6 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fillStyle = colors.ink3;
      ctx.fill();
    });
    ctx.restore();
    pos.forEach((p, ci) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], M.NODE_R, 0, Math.PI * 2);
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
  /* Each row slides from its old place to its new one as samples join above
     it; a joining row fades in at its new place, a leaving one out at its old. */
  const oldIdx = (smp) => M.SAMPLES.filter((x) => before.includes(x.key)).indexOf(smp);
  const newIdx = (smp) => used.indexOf(smp);
  drawn.forEach((s) => {
    const alpha = alphaOf(s);
    if (alpha <= 0) return;
    const io = oldIdx(s);
    const inew = newIdx(s);
    const slot = io >= 0 && inew >= 0 ? M.lerp(io, inew, M.easeOut(tt)) : (inew >= 0 ? inew : io);
    const y = L.bars.y + slot * rowH;
    const h = 16;
    ctx.save();
    ctx.globalAlpha = alpha;
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
    ctx.restore();
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
  status: "shipped",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* Decision 1: the page is display, so the reads survive a visit to the
       clusters and back. */
    page: {
      role: "page",
      type: "segmented",
      style: "grid",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "one",
      display: true,
    },

    /* Page 3 reads one mutation or the whole tumour, his "One mutation · All
       mutations" of 2026-09-26 — "All", so "Many mutations" is not a page and
       a view at once. Display, as the page is. */
    view: {
      type: "segmented",
      label: M.STRINGS.viewLabel,
      detail: M.STRINGS.viewDetail,
      options: M.VIEWS,
      default: "one",
      display: true,
      when: { param: "page", equals: "ccf" },
    },

    /* THREE GROUPS, his pick of 2026-09-16 over a measured/inferred split:
       the reader SETS purity, so calling it "measured" in the rail says two
       things at once — the truth of the sample, and separately what the
       analysis was told. Naming the truth, the sequencing and the analysis
       keeps those apart, and it is what makes "which are the free parameters"
       answerable.

       ONE SAMPLE FOR PAGES 1 AND 3 (his pick L2, 2026-09-26): the same
       parameters, so page 1 builds the sample and page 3 infers it back, and
       changing the purity on either changes both. The histograms keep their
       own heading. */
    truthSec: { type: "section", label: M.STRINGS.truthSection, when: { any: [{ param: "page", equals: "one" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] }] } },
    sampleSec: { type: "section", label: M.STRINGS.sampleSection, when: { any: [{ param: "page", equals: "many" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] }] } },
    /* THE CASE FIRST, then the share of cells, then purity — cell 17's own
       order: its figure, then its considerations (the mock's rail A). */
    state: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.stateLabel,
      detail: M.STRINGS.stateDetail,
      options: M.CASES.map((c) => ({ value: c.key, label: c.label })),
      default: "1+1",
      when: { any: [{ param: "page", equals: "one" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] }] },
    },
    /* 1.00 by default since 2026-09-26: cell 17's simple case is a pure
       sample, and page 1 opens on it, reading 0.5. */
    purity: {
      type: "choice",
      label: M.STRINGS.purityLabel,
      detail: M.STRINGS.purityDetail,
      options: M.PURITY_OPTIONS,
      default: "1.00",
      when: { param: "page", oneOf: ["one", "many", "ccf"] },
    },
    ccf: {
      type: "choice",
      label: M.STRINGS.ccfLabel,
      detail: M.STRINGS.ccfDetail,
      options: ["0.25", "0.50", "0.75", "1.00"],
      default: "1.00",
      when: { any: [{ param: "page", equals: "one" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] }] },
    },
    seqSec: { type: "section", label: M.STRINGS.seqSection, when: { any: [{ param: "page", equals: "one" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] }] } },
    depth: {
      type: "choice",
      label: M.STRINGS.depthLabel,
      detail: M.STRINGS.depthDetail,
      options: M.DEPTH_OPTIONS,
      default: M.DEPTH_DEFAULT,
      when: { param: "page", oneOf: ["one", "many", "ccf"] },
    },
    /* Cell 24, "Refining Estimates (Optional)", as a control: what the analysis
       is told, and what it therefore has to assume. Display, because it changes
       what is concluded from the reads and never the reads themselves. Page 3's
       since 2026-09-26; page 1 draws no analysis. */
    analysisSec: { type: "section", label: M.STRINGS.analysisSection, when: { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] } },
    knows: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.knowsLabel,
      detail: M.STRINGS.knowsDetail,
      options: M.KNOWLEDGE.map((k) => ({ value: k.key, label: k.label, span: k.key === "both" })),
      default: "both",
      display: true,
      when: { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] },
    },
    clones: {
      type: "segmented",
      label: M.STRINGS.clonesLabel,
      detail: M.STRINGS.clonesDetail,
      options: M.CLONE_SETS.map((c) => ({ value: c.key, label: c.label })),
      default: "two",
      when: { any: [{ param: "page", equals: "many" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] }] },
    },
    mutations: {
      type: "choice",
      label: M.STRINGS.mutationsLabel,
      detail: M.STRINGS.mutationsDetail,
      options: M.MUTATION_OPTIONS,
      default: "300",
      when: { any: [{ param: "page", equals: "many" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] }] },
    },

    /* A section and its fields must agree about the drive row: a section marked
       `afterDrive` whose fields are not renders an empty heading under the
       buttons and the fields above them (read in the browser, 2026-09-16).
       "How to read it" is not a withheld answer, so it stays in place; the
       seed and the momentary action belong below the row. */
    lookSec: { type: "section", label: M.STRINGS.lookSection, when: { any: [{ param: "page", equals: "many" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] }] } },
    /* THE AXIS IS PAGE 3'S since 2026-09-26 — page 2 is cells 21–23 and reads
       VAF only — and opens on the fraction there, which is the view's point;
       Variant allele frequency stays an option so the ease can run both ways
       over one set of mutations. */
    axis: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.axisLabel,
      detail: M.STRINGS.axisDetail,
      options: M.AXES,
      default: "ccf",
      display: true,
      when: { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] },
    },
    assumed: {
      type: "segmented",
      label: M.STRINGS.assumedLabel,
      detail: M.STRINGS.assumedDetail,
      options: M.ASSUMED,
      default: "purity",
      display: true,
      when: { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }, { param: "axis", equals: "ccf" }] },
    },
    clusters: {
      type: "bool",
      label: M.STRINGS.clustersLabel,
      detail: M.STRINGS.clustersDetail,
      default: true,
      display: true,
      when: { any: [{ param: "page", equals: "many" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "all" }] }] },
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
    /* "Tree", not "Shape" — the field's word and what the diagram is
       (Kenneth, 2026-09-17). The link word follows the control. */
    tree: {
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
    dataSec: { type: "section", label: M.STRINGS.readsSection, afterDrive: true, when: { param: "page", oneOf: ["one", "many", "ccf"] } },
    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      detail: M.STRINGS.seedDetail,
      min: 1,
      max: 200,
      default: 1,
      afterDrive: true,
      when: { param: "page", oneOf: ["one", "many", "ccf"] },
    },
    all: {
      type: "bool",
      style: "action",
      label: M.STRINGS.allLabel,
      detail: M.STRINGS.allDetail,
      default: false,
      display: true,
      afterDrive: true,
      when: { any: [{ param: "page", equals: "one" }, { all: [{ param: "page", equals: "ccf" }, { param: "view", equals: "one" }] }] },
    },

    /* Authoring escape hatch, first render only: reads already drawn. */
    shown: { type: "int", min: 0, max: 500, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (M.histPage(params)) {
      return [
        { token: "group-a", label: "Clonal: in every tumor cell", mark: "bar" },
        { token: "group-b", label: "Subclonal: in some tumor cells", mark: "bar" },
        ...(params.clusters ? [{ token: "ink-2", label: "A cluster the mixture found, at its mean ± one standard deviation", mark: "line" }] : []),
        ...(M.axisOf(params) === "ccf" ? [{ token: "reference", label: M.STRINGS.thresholdLegend, mark: "line" }] : []),
      ];
    }
    if (params.page === "clonal") {
      return [
        /* His figure names three genes beside each cluster. They do not fit an
           11px node, so they go where each cluster is named. */
        ...M.CLUSTER_GENES.map((genes, c) => ({
          token: ["group-a", "group-b", "group-c"][c],
          label: `Cluster ${c + 1}: ${genes.join(", ")}`,
          mark: "line",
        })),
        { token: "extreme", label: "Cells the tree would need and the sample does not have", mark: "line" },
      ];
    }
    const sample = [
      { token: "group-a", label: "Tumor cells", mark: "dot" },
      { token: "ink-3", label: "Copies of the chromosome in a cell", mark: "line" },
      { token: "highlight", label: "The mutation, and the reads that carry it", mark: "bar" },
      { token: "ink-3", label: "Reads that carry the reference allele", mark: "bar" },
    ];
    if (params.page === "one") {
      return [...sample, { token: "theory", label: "The variant allele frequency the sample's copies give", mark: "line" }];
    }
    /* Page 3: one entry per multiplicity the analysis considers, so the legend
       names exactly the curves on the figure (§ *Legend must match the graph*). */
    const ms = M.givenOf(M.configOne(params), params.knows).ms;
    return [
      ...sample,
      ...ms.map((m) => ({ token: ["group-a", "group-b", "group-c"][m - 1], label: `The likelihood of c with the mutation on ${m} cop${m > 1 ? "ies" : "y"} (m = ${m})`, mark: "line" })),
      { token: "ink-3", label: M.STRINGS.thresholdLegend, mark: "line" },
      { token: "reference", label: M.STRINGS.truthCcfLegend, mark: "line" },
    ];
  },

  /* Decision 1: every page is built on every data change, in a fixed order. */
  compute({ params, rng }) {
    const cfg = M.configOne(params);
    const one = M.buildReads(rng, cfg);
    const manyCfg = M.configMany({ ...params, purity2: params.purity, depth2: params.depth });
    const many = M.buildMany(rng, manyCfg);
    const used = M.usedSamples(params.taken);
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
      const morph = Boolean(carryMany) && M.histPage(params) && carryMany.page === params.page
        && carryMany.axis === M.axisOf(params) && carryMany.assumed === params.assumed
        && carryMany.seed === params.seed && carryMany.clones === params.clones
        && !reducedMotion();
      /* Pages 1 and 3: the sample changed, so the cells, the line and the tick
         move from the figure on screen (the carry, above). */
      const oneMorph = Boolean(carryOne) && M.readsPage(params) && carryOne.key !== oneKey(state.cfg)
        && !reducedMotion();
      return {
        k,
        beat: 0,
        done: k >= state.one.depth,
        oneFrom: oneMorph ? carryOne : null,
        oneT: oneMorph ? 0 : 1,
        /* The display changes that ease, each remembered so rebuild can tell
           what moved: Given on page 3 (curves), Given on All mutations
           (the rescaling), and the samples used on page 4. */
        knows: params.knows,
        likFrom: null,
        likT: 1,
        assumed: params.assumed,
        assumedFrom: null,
        assumedT: 1,
        taken: params.taken,
        takenFrom: null,
        takenT: 1,
        /* Decision 2: only the reads animate. */
        inert: !M.readsPage(params),
        /* Where page 2's axis has got to, and which axis it is heading for. */
        mix: params.axis === "ccf" ? 1 : 0,
        axis: params.axis,
        /* Page 2's data morph: the bars it starts from, and how far along. */
        histFrom: morph ? carryMany.counts : null,
        topFrom: morph ? carryMany.top : 0,
        spansFrom: morph ? carryMany.spans : null,
        histT: 0,
        easing: morph || oneMorph,
        /* Page 3's shape: 0 is SHAPES[0], 1 is SHAPES[1], and it eases toward
           whichever the control names — one scalar, exactly like `mix`, so a
           switch turned round mid-glide leaves from where the figure is. */
        shapeMix: M.shapeIndex(params.tree),
        tree: params.tree,
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

        const shapeTarget = M.shapeIndex(anim.tree);
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
        /* The four clocks added 2026-09-26, one rule each: run to 1, then
           clear what they moved from, so nothing downstream reads a finished
           transition as a live one. */
        for (const [from, t] of [["oneFrom", "oneT"], ["likFrom", "likT"], ["assumedFrom", "assumedT"], ["takenFrom", "takenT"]]) {
          if (anim[from] == null) continue;
          anim[t] = Math.min(1, anim[t] + step);
          if (anim[t] < 1) moving = true;
          else anim[from] = null;
        }
        return moving;
      }
      /* A read pressed while a change is still fading lands the change first:
         core's frame clock is the reads' now, and a half-faded sample left on
         screen would be a sample of neither setting. */
      anim.oneFrom = null; anim.oneT = 1;
      anim.likFrom = null; anim.likT = 1;
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
      anim.inert = !M.readsPage(params);
      anim.done = anim.k >= state.one.depth;
      /* The axis moved: ask core for frames once, and ease from wherever the
         figure IS — an ease turned round mid-flight starts there, not at the
         end it was heading for. A page change is not eased. */
      const onAxisView = params.page === "ccf" && params.view === "all";
      if (params.axis !== anim.axis) {
        anim.axis = params.axis;
        if (onAxisView && !reducedMotion()) anim.easing = true;
        else anim.mix = params.axis === "ccf" ? 1 : 0;
      }
      if (!onAxisView && !anim.easing) anim.mix = params.axis === "ccf" ? 1 : 0;
      /* Leaving page 2 lands its morph rather than leaving it in flight: a
         transition nobody is watching has nothing to show, and coming back to
         a figure still halfway between two sets of parameters would be a
         figure of neither. The same ruling as the shape, below. */
      if (!M.histPage(params)) { anim.histFrom = null; anim.spansFrom = null; }
      /* GIVEN ON PAGE 3 moves the curves; off that view it lands. */
      if (params.knows !== anim.knows) {
        anim.knows = params.knows;
        if (params.page === "ccf" && params.view !== "all" && carryLik && anim.k > 0 && !reducedMotion()) {
          anim.likFrom = carryLik; anim.likT = 0; anim.easing = true;
        }
      }
      /* GIVEN ON ALL MUTATIONS rescales every mutation; it eases from the
         purity the figure was divided by. */
      if (params.assumed !== anim.assumed) {
        const wasPurity = anim.assumed === "nothing" ? 1 : Number(params.purity);
        anim.assumed = params.assumed;
        if (params.page === "ccf" && params.view === "all" && params.axis === "ccf" && !reducedMotion()) {
          anim.assumedFrom = wasPurity; anim.assumedT = 0; anim.easing = true;
        }
      }
      /* THE SAMPLES USED ON PAGE 4: the samples joining fade in, the ones
         leaving fade out, and the rows below slide to their new places. */
      if (params.taken !== anim.taken) {
        const was = anim.taken;
        anim.taken = params.taken;
        if (params.page === "clonal" && !reducedMotion()) {
          anim.takenFrom = M.usedSamples(was).map((smp) => smp.key); anim.takenT = 0; anim.easing = true;
        }
      }
      /* A page change lands whatever belongs to the page being left. */
      if (!(params.page === "ccf" && params.view !== "all")) { anim.likFrom = null; anim.likT = 1; }
      if (!(params.page === "ccf" && params.view === "all")) { anim.assumedFrom = null; anim.assumedT = 1; }
      if (params.page !== "clonal") { anim.takenFrom = null; anim.takenT = 1; }
      /* The shape moved: the same door as the axis, on the same page-3 terms.
         Off page 3 it lands, so a reader who switches shape from elsewhere and
         then arrives finds the figure already there. */
      if (params.tree !== anim.tree) {
        anim.tree = params.tree;
        if (params.page === "clonal" && !reducedMotion()) anim.easing = true;
        else anim.shapeMix = M.shapeIndex(params.tree);
      }
      if (params.page !== "clonal" && !anim.easing) anim.shapeMix = M.shapeIndex(params.tree);
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
    if (L.page === "ccf") { drawCcfOne(ctx, colors, L, params, state, anim); return; }
    drawOne(ctx, colors, L, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (M.histPage(params)) {
      const axisKey = M.axisOf(params);
      const axis = M.onAxis(state.many, state.manyCfg, axisKey);
      const past = axis.cut == null ? null : axis.values.filter((v) => v >= axis.cut).length;
      return [
        { label: "Clusters found", value: String(state.many.fit.K), note: "components in the mixture with the lowest BIC" },
        { label: "MATH", value: state.many.math.toFixed(1), note: "the width of the VAF distribution over its median" },
        {
          label: axisKey === "ccf" ? "At a fraction of 0.9 or more" : "Populations in the tumor",
          value: past == null ? String(state.manyCfg.clones.length) : M.intText(past),
          note: past == null ? "what the mutations were drawn from" : `of ${M.intText(state.manyCfg.n)} mutations`,
        },
      ];
    }
    if (params.page === "clonal") {
      const shape = M.shapeOf(params.tree);
      const fits = state.used.every((s) => M.fitsSumRule(shape, s.ccf));
      /* A shape fits the evidence when it fits EVERY sample used, so the count
         is the shapes surviving the first sample intersected with the rest. */
      const both = state.used
        .map((s) => M.shapesFitting(s.ccf))
        .reduce((keep, fitting) => keep.filter((s) => fitting.includes(s)), [...M.SHAPES]).length;
      const failing = state.used.find((s) => !M.fitsSumRule(shape, s.ccf));
      return [
        { label: "This tree", value: fits ? "Fits" : "Ruled out", note: failing ? `by ${failing.key}` : `on ${state.used.length} sample${state.used.length > 1 ? "s" : ""}` },
        { label: "Trees that fit", value: `${both} of ${M.SHAPES.length}`, note: "given the samples used" },
        { label: "Samples used", value: String(state.used.length), note: "biopsies of one patient" },
      ];
    }
    const k = Math.min(anim?.k ?? 0, state.one.depth);
    const vaf = M.vafAt(state.one, k);
    const alt = M.altAt(state.one, k);
    const cfg = state.cfg;
    const reads = { label: "Reads carrying it", value: k > 0 ? `${M.intText(alt)} / ${M.intText(k)}` : "—", note: `of ${M.intText(state.one.depth)} at this depth` };
    if (params.page === "one") {
      /* NO FRACTION AND NO CALL ON PAGE 1 (2026-09-26); both are page 3's,
         where cell 25 names them. The third tile is the figure's percentage. */
      return [
        reads,
        { label: "Variant allele frequency", value: k > 0 ? M.n3(vaf) : "—", note: `the sample's copies give ${M.n3(cfg.expected)}` },
        {
          label: M.STRINGS.ccfLabel,
          /* The control's own format, so the tile and the slider say one number. */
          value: M.n2(cfg.ccf),
          note: `on ${cfg.copies} of ${cfg.state.total} cop${cfg.state.total > 1 ? "ies" : "y"} in each`,
        },
      ];
    }
    /* PAGE 3: what the reads allow and the call, both read off the likelihood
       the figure draws (5.8). THE VALUE IS THE SPAN, THE NOTE THE PIECES
       (Kenneth, 2026-09-26: the tile wrapped). With one of four copies three
       multiplicities can fit, and "0.72–1.00 or 0.36–0.78 or 0.24–0.52" ran to
       three lines at a 20px value. The span is a true bound on every c the
       reads allow; where the multiplicities allow separate ranges the note
       lists each one by m, so the tile never claims a c no curve allows. */
    const lik = k > 0 ? M.likelihoodOf(alt, k, cfg, params.knows) : null;
    const piece = (cv) => (cv.interval.hi - cv.interval.lo < 0.005
      ? M.n2(cv.interval.lo) : `${M.n2(cv.interval.lo)}–${M.n2(cv.interval.hi)}`);
    const span = lik ? (lik.hi - lik.lo < 0.005 ? M.n2(lik.lo) : `${M.n2(lik.lo)}–${M.n2(lik.hi)}`) : "—";
    return [
      { ...reads, note: k > 0 ? `VAF ${M.n3(vaf)}` : reads.note },
      {
        label: "Cancer cell fraction",
        value: span,
        note: !lik ? "no read yet"
          : lik.allowed.length === 1 ? `what the reads allow, 95%, at m = ${lik.allowed[0].m}`
            : `what the reads allow, 95%: ${lik.allowed.map((cv) => `${piece(cv)} at m = ${cv.m}`).join(", ")}`,
      },
      {
        label: M.STRINGS.callLabel,
        value: lik ? M.STRINGS.callValue[lik.call] : "—",
        note: lik ? M.STRINGS.callNote[lik.call] : `the threshold is a fraction of ${M.CUT}`,
      },
    ];
  },

  summary({ params, state, anim }) {
    if (M.histPage(params)) {
      const axis = M.onAxis(state.many, state.manyCfg, M.axisOf(params));
      return `A histogram of ${M.intText(state.manyCfg.n)} mutations on the ${axis.label.toLowerCase()} axis, `
        + `from ${state.manyCfg.clones.length} cell population${state.manyCfg.clones.length > 1 ? "s" : ""} at purity `
        + `${M.n2(state.manyCfg.purity)}. A Gaussian mixture of ${state.many.fit.K} component`
        + `${state.many.fit.K > 1 ? "s" : ""} has the lowest BIC, and MATH is ${state.many.math.toFixed(1)}.`;
    }
    if (params.page === "clonal") {
      const shape = M.shapeOf(params.tree);
      const failing = state.used.find((s) => !M.fitsSumRule(shape, s.ccf));
      return `Three clusters' mean cancer cell fraction across ${state.used.length} sample`
        + `${state.used.length > 1 ? "s" : ""} of one patient, against the tree ${shape.label}, which `
        + `${failing ? `is ruled out by ${failing.key}` : "fits every sample used"}.`;
    }
    const k = Math.min(anim?.k ?? 0, state.one.depth);
    const cfg = state.cfg;
    const cells = `${Math.round(M.CELLS * cfg.purity)} of ${M.CELLS} cells are tumor cells, `
      + `${M.pctText(cfg.ccf)} of them carrying the mutation on ${cfg.copies} of ${cfg.state.total} copies`;
    if (k === 0) return `A sample of ${M.CELLS} cells in which ${cells}, with an empty pileup of ${M.intText(state.one.depth)} reads below it.`;
    const reading = `${M.intText(M.altAt(state.one, k))} of the ${M.intText(k)} reads drawn so far carry the mutation, `
      + `a variant allele frequency of ${M.n3(M.vafAt(state.one, k))}`;
    if (params.page === "one") return `A sample of ${M.CELLS} cells in which ${cells}. ${reading} against the ${M.n3(cfg.expected)} the sample's copies give.`;
    const lik = M.likelihoodOf(M.altAt(state.one, k), k, cfg, params.knows);
    return `A sample of ${M.CELLS} cells in which ${cells}. ${reading}. The likelihood of the reads allows a cancer cell `
      + `fraction of ${M.n2(lik.lo)} to ${M.n2(lik.hi)}: ${M.STRINGS.callValue[lik.call].toLowerCase()}.`;
  },
});
