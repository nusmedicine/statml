/* ============================================================================
   Widget 54 · Loss functions — what the loss takes in, what it does inside,
   and the one number it hands back.

   PHM5005 05-4 cells 30-40. One page per row of cell 30's table — Regression
   (MSELoss, cells 31-33), Single-label (CrossEntropyLoss, cells 34-36) and
   Multi-label (BCEWithLogitsLoss, cells 37-39) — and a fourth, Binary, where
   the same two-class problem is drawn both ways. `model.js` carries the
   arithmetic, the copy and the geometry; this file draws them.

   THE MISCONCEPTION IS BETWEEN THE TWO CLASSIFICATION PAGES. Kenneth,
   2026-09-11: "students often get confused when to use CrossEntropyLoss and
   BCEWithLogitsLoss". So the contrast is structural rather than captioned —
   softmax over the ROW against sigmoid PER CLASS — and the two pages print
   1.0000 and 2.7476 in the same column, in the same unfilled cell outside the
   tensor, under the same `row sum` head.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE GEOMETRY OF RECORD. `_lab/loss-functions-mock.html` drew
       all six sections to scale at the 550px stage and Kenneth picked four
       (catalogue § Slot 54): the detail line rather than a case table, bars
       rather than cells, the row-sum column kept on Multi-label, and the
       Target dtype control. Every pitch, bar width, row order, label offset
       and caption below is the mock's, and the constants live in `model.js`
       so the verify script measures the same stage.

    2. THE GEOMETRY IS ONE FUNCTION AND IT LIVES IN `model.js`. `M.layout(w,
       state)` returns every y the page draws at; `height`, `draw`, `regions`
       and the drag's hit-test all ask it, and so does the verify script (5.8).
       The three stages are 494, 414 and 524 at 550 — a single height would
       make the two short pages pay for the tallest.

    3. THE SINGLE-LABEL PAGE IS 12px TALLER WHEN THE DTYPE RAISES, and no
       other page moves. Torch's message wraps to two lines in the 300px rows
       column where the loss number takes one, and on Multi-label the loss line
       is the last thing above the caption block, so the second line has the
       caption gap to run into. On Single-label there is a curve beside it and
       nothing below, so the line is reserved. The mock's §5 note prints 426
       for that page while its prose calls it "the same as the settled figure";
       the drawing is what this follows.

    4. THE WALK LANDS ONE ROW A STEP, AND IS ONE ROW AHEAD OF ITSELF.
       Composition's decision 14, shared by the deep-learning pages:
       `M.stageOf` is the rule and `M.pageUnits` the table of which step owns
       which piece. A row that has landed carries its values; the NEXT row
       draws its frame pale — empty cells, empty chips, its name in `--ink-3` —
       and every row after it is absent. The space is reserved either way, so
       at rest, settled and dragged the stage is the same height, and a value
       lands into a frame that is already there.

    5. THE BAR AXIS IS FIXED PER PAGE (2.5), NOT FITTED. Fitted to the values
       on screen, dragging class A from 5.0 to 1.0 leaves A's own bar at 55px
       and takes untouched B from 7px to 34px: the drag moves every bar except
       the one under the cursor. Fixed at −2..6, A goes 55 → 11px and B holds
       at 6px. The cost is the small bars, which carry their printed value and
       are not the thing being read — the p row below is.

    6. THE HELD ELEMENT IS THE COLUMN UNDER THE POINTER. Core does not tell a
       widget that a drag is in flight, and it stops updating `pointer` while
       one is, so the pointer's column is the grabbed column from pointerdown
       to release — which is exactly what "held" means here. One function,
       `M.barColAt`, answers it for the drawing, for the drag's hit-test and
       for the readout's hover tile (5.8). Nothing is lit with no pointer.

    7. A DATA CHANGE ON A FINISHED FIGURE KEEPS IT FINISHED, on the same task
       (4.4's data-path door). That is what makes the drag and the target chips
       move a finished figure instead of emptying it. A change mid-walk resets,
       and a task change always resets. `carry.state !== state` tells a data
       change from a Replay, which is widget 53's own test: a Replay re-inits
       against the SAME state object.

    8. THE LEGEND NAMES `group-a` AND `empirical` ONCE, not twice.
       `tokens.css` makes them one colour on purpose (both mean the reader's
       own data), so two entries would be two identical swatches under two
       names. The figure still draws the scores in `--c-group-a` and every
       computed row in `--c-empirical`, because that is what each one is; what
       tells them apart on screen is the mark, a bar against a cell.

    9. THE CURVE'S POINTS LAND WITH THE ROW THEY READ. On the two
       classification pages the point IS the loss, so it lands with the loss;
       on Regression the three points are the squared gaps, so they land with
       the row that squares them and the mean that follows adds no point.

   10. THE TWO TORCH MESSAGES ARE TORCH'S OWN, printed by
       `_lab/dl-loss-torch.py` (torch 2.14) and checked against its recorded
       output by the verify script. The first draft quoted both from memory
       and both were wrong.

   ---- the second round: one output and several, and binary two ways --------
   Kenneth, 2026-09-11: "can we show examples of 1 class and >1 class? also how
   best to explain that a binary class can be modeled as 1 label or 2 labels".
   `_lab/loss-binary-mock.html` drew every candidate at the real 550 stage and
   he picked §1 A, §2 B and §3 C.

   11. THE COUNT IS THE NUMBER OF COLUMNS, and only Regression has one. The
       tensor field keeps the row AS TYPED and `compute` reads the first k of
       it, padding with 0 — so narrowing to one output and back returns the row
       that was there. No page resizes: the mock measured the one-output stage
       at 494, the same as the three-output one, because the control changes
       columns and not rows. The two `Classes` controls that once did the same
       on the classification pages are gone under structure B (Kenneth,
       2026-09-11): a single-label page is the notebook's three classes and a
       multi-label page its five, the faces say so in their own second lines,
       and the two-class case has a page of its own where both forms of it are
       drawn side by side. So the row-sum column is back on Multi-label
       unconditionally — 2.7476 under the head that prints 1.0000 one face
       away, which is the contrast the widget exists for.

   12. THE FIELD FOLLOWS THE COUNT IN TWO PLACES, because core rebuilds the
       control block BEFORE it recomputes the state. `show` narrows to the
       count `computeFor` stashed, which is right on every path where the count
       did not just move — a rebuild on a task change, a commit, the value a
       drag writes back. The frame where the count itself moves is the one
       `show` cannot see, so `syncTensorFields` repaints the field from the
       state once it exists. Gating the field on the count instead was tried on
       paper and does not help: the rebuild it triggers runs a step too early.

   13. THE BINARY PAGE IS TWO COLUMNS OF ONE FLOW. `binaryLayout` measures the
       vertical flow once and hands each column its own x, column count and
       axis, so the two loss lines land on one line 272px apart — against 350px
       with a whole figure between them when the two forms are stacked, which
       is 2.7 as a measurement rather than a preference. Both axes span eight
       units, so a score of 1.5 is the same length of bar in either column.

   14. THE DERIVED BAR DOES NOT DRAG. It has no parameter, and non-negotiable 1
       says parameters are the only state of record: p_B depends on the
       difference alone, so every position it can take is already reachable by
       dragging B, and the map from a difference back to a pair of scores is
       not unique (both scores +3 leave softmax at 0.1824, 0.8176). Its cursor
       stays the default, and the hit-test is the LEFT column's alone.

   15. THE TASK CONTROL IS TWO OPTION GROUPS. One row of four faces truncates —
       62.0px for text against Single-label's 64.4px at the pressed weight —
       and the 2 × 2 grid that fixes the width pairs Regression with
       Single-label, which is not how the four divide. The groups divide them
       the way the losses do (3.4g).

   ---- the rail: the faces, and the two tensors as columns ------------------
   Kenneth, 2026-09-11: "can you mock the rail input for y_pred? it's not
   aligned to the target? not sure, like a grid to align?" and, on the faces,
   his own ordering — Binary first, by prevalence.
   `_lab/loss-rail-mock.html` drew every candidate at the real 300px rail and
   he picked §1 D and §2 b, both of which needed a small core addition and both
   of which were put to him as core before either was written.

   16. THE TWO TENSORS ARE ONE GRID OF COLUMNS. Core's `text` field takes
       `cells: { count, heads }` and renders the same one parameter as N equal
       cells under a head row, so a value sits over the control that sets the
       same class: 0.4 / 0.6 / 0.2px at three, five and two columns, against
       173 / 79 / 177px when y_pred was one string whose numbers fell where
       their own digits put them. It is still ONE canonical string — the cells
       are joined for `parse` and split from `show` — so `?scores=5,0.5,0.1` is
       unchanged, and a drag on the stage repaints every cell through the same
       setter every other control uses.

   17. THE HEAD NAMES THE COLUMN AND THE CONTROL HOLDS THE VALUE. On
       Single-label the heads are A B C and the buttons under them are 0 · 1 ·
       2, because the target there IS an index: a chip reading B would hide the
       number the tensor holds. On Regression the heads are 1 2 3 — an output
       is not a class, and a letter is this widget's word for a class on the
       other three pages (3.7).

   18. THE FIVE SWITCHES ARE A RUN OF FIVE COLUMNS. `.w-bools` ships as a flex
       line with a `--sp-5` gap, which put the five letters 46px off the five
       columns above them, so the switch under class D's score was not class
       D's. A bool run whose first field declares the same `cells` count takes
       the same N equal columns; every other checkbox row in the collection
       keeps the line it has.
   ========================================================================= */

import { defineWidget, readTokens, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

/* A canvas of this module's own, for the measurements `errorText` needs and
   core hands none. */
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  return measureCanvas;
}

const {
  PAD, GAP, LINE, ROW_LBL, CH, BAR_H, EDGE, CURVE_W, CURVE_H, YMAX,
  GAP_LO, GAP_HI, SQ_MAX,
} = M;

/* --- primitives ------------------------------------------------------------ */

function txt(ctx, colors, s, x, y, o = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "",
  } = o;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? colors.mono : colors.font}`.trim();
  ctx.fillText(s, x, y);
}

/** A token at an alpha, as a fill string. Tokens resolve to hex. */
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};

function arrow(ctx, x0, y0, x1, y1, color, width = 2, head = 9) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The stage header: the page's name left, the loss it computes right, a
    hairline under (processing-layers decision 10). */
function band(ctx, colors, w, name, expr) {
  txt(ctx, colors, name, PAD, 11, { color: colors.ink2, weight: "600" });
  txt(ctx, colors, expr, w - PAD, 11, { color: colors.highlight, align: "right", mono: true });
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 17.5);
  ctx.lineTo(w - PAD, 17.5);
  ctx.stroke();
}

const rowLabel = (ctx, colors, x, y, name, o = {}) =>
  txt(ctx, colors, name, x, y + 11,
    { color: o.color ?? colors.ink2, mono: o.mono !== false, size: colors.fsSm });

/** The shape and dtype under a row — the anchor of the whole widget. */
const dtypeLine = (ctx, colors, x, y, s, color) =>
  txt(ctx, colors, s, x, y + 11, { color: color ?? colors.ink3, mono: true, size: colors.fsXs });

/** Torch's own message, wrapped to `w` and printed in the failure colour. */
function errorText(ctx, colors, x, y, w, msg) {
  const probe = measureCtx();
  probe.font = `${colors.fsSm} ${colors.mono}`;
  const rows = [];
  let cur = "";
  for (const word of msg.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (probe.measureText(t).width > w && cur) { rows.push(cur); cur = word; } else cur = t;
  }
  if (cur) rows.push(cur);
  rows.forEach((r, i) =>
    txt(ctx, colors, r, x, y + i * LINE, { color: colors.extreme, mono: true, size: colors.fsSm }));
  return rows.length;
}

/** One value cell. `plain` draws no fill, which is what the row-sum column is:
    a reading of the row rather than one more value in the tensor. */
function valueCell(ctx, colors, x, y, w, h, text, o = {}) {
  const hue = o.hue ?? colors.groupA;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, w, h);
  if (!o.empty && !o.plain) {
    ctx.fillStyle = wash(hue, o.lit ? 0.4 : 0.15);
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = o.lit ? colors.highlight : (o.empty ? colors.grid : colors.axis);
  ctx.lineWidth = o.lit ? 2.5 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (text != null && text !== "") {
    txt(ctx, colors, text, x + w / 2, y + h / 2 + 0.5,
      { color: colors.ink1, align: "center", baseline: "middle", mono: true, size: colors.fsXs });
  }
}

/** A row of value cells at the column pitch, so every cell sits under its bar. */
function cellRow(ctx, colors, g, y, at) {
  for (let i = 0; i < g.n; i += 1) {
    const s = at(i) ?? {};
    valueCell(ctx, colors, g.x + i * g.pitch, y, g.pitch, CH, s.text, s);
  }
}

/** The target chips: one per class, filled where the target says so. */
function chipRow(ctx, colors, g, y, at) {
  const cw = Math.min(42, g.pitch - 10);
  for (let i = 0; i < g.n; i += 1) {
    const s = at(i) ?? {};
    const bx = g.colX(i) - cw / 2;
    ctx.fillStyle = colors.surface;
    roundRect(ctx, bx, y, cw, CH, 6);
    ctx.fill();
    if (s.on && !s.empty) {
      ctx.fillStyle = colors.reference;
      roundRect(ctx, bx, y, cw, CH, 6);
      ctx.fill();
    }
    ctx.strokeStyle = s.lit ? colors.highlight
      : (s.empty ? colors.grid : (s.on ? colors.reference : colors.axis));
    ctx.lineWidth = s.lit ? 2.5 : 1.5;
    roundRect(ctx, bx + 0.75, y + 0.75, cw - 1.5, CH - 1.5, 6);
    ctx.stroke();
    if (!s.empty && s.text) {
      txt(ctx, colors, s.text, g.colX(i), y + CH / 2 + 0.5,
        { color: s.on ? colors.surface : colors.ink2, align: "center", baseline: "middle",
          mono: true, size: colors.fsSm, weight: s.on ? "600" : "" });
    }
  }
}

/**
 * The scores row: one bar per class under its letter, a zero line, the value at
 * the bar's outer end. `ticks` puts a reference mark on each column at the
 * target's own value, which only the Regression page can do — there the target
 * is measured in the units of the prediction.
 */
function barRow(ctx, colors, g, vals, o = {}) {
  const { colX, py, barW } = g;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(g.x, py(0) + 0.5);
  ctx.lineTo(g.x + g.n * g.pitch, py(0) + 0.5);
  ctx.stroke();
  vals.forEach((v, i) => {
    const cx = colX(i);
    const lit = o.held === i;
    const y0 = py(0);
    const y1 = py(v);
    ctx.fillStyle = wash(colors.groupA, lit ? 0.42 : 0.18);
    ctx.fillRect(cx - barW / 2, Math.min(y0, y1), barW, Math.abs(y1 - y0));
    ctx.strokeStyle = lit ? colors.highlight : colors.groupA;
    ctx.lineWidth = lit ? 2.5 : 1.5;
    ctx.strokeRect(cx - barW / 2 + 0.5, Math.min(y0, y1) + 0.5,
      barW - 1, Math.max(1, Math.abs(y1 - y0) - 1));
    /* the drag handle: a grip ON the bar's top edge, which is the target. Drawn
       on the edge rather than above it because the tallest bar's top is 10px
       from the top of the band and anything above it lands on the class letter */
    if (lit) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 5 - 2, y1);
        ctx.lineTo(cx + k * 5 + 2, y1);
        ctx.stroke();
      }
    }
    /* the value goes outside the bar's end, and inside it where the bar reaches
       the top of the band — a score of 5.0 leaves 10px and the label needs 12 —
       or where the target's tick would run through it, which is where y_true
       3.0 sits above y_pred 2.5 on the Regression page */
    const above = v >= 0;
    const tick = o.ticks?.[i];
    const clash = tick != null && Math.abs(py(tick) - (y1 - 8)) < 9 && Math.abs(y1 - y0) >= 18;
    const tight = (above && y1 - g.barTop < 14) || clash;
    let ty = tight ? y1 + 14 : (above ? y1 - 5 : y1 + 12);
    /* AND ABOVE THE BAR'S END AT THE FOOT OF THE BAND. A score dragged to the
       floor of its own axis puts the label 12px below the band, which is where
       the shape and dtype line is printed — found at `?scores=-2,6,6`. */
    if (ty > g.barTop + BAR_H) ty = y1 - 5;
    txt(ctx, colors, M.n1(v), cx, ty,
      { color: lit ? colors.highlight : colors.ink1, align: "center", mono: true, size: colors.fsXs });
    txt(ctx, colors, (o.letters ?? M.LETTERS)[i], cx, g.barY + 12,
      { color: colors.ink1, align: "center", mono: true, size: colors.fsSm });
  });
  (o.ticks ?? []).forEach((t, i) => {
    const cx = colX(i);
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - barW / 2 - 5, py(t));
    ctx.lineTo(cx + barW / 2 + 5, py(t));
    ctx.stroke();
  });
}

/**
 * An arrow down between two rows, with the function named BESIDE it — the
 * arrow sits on the first column's centre, 51px into the 300px rows column,
 * and `softmax over the row` is 121px of mono, so centred on the arrow it runs
 * off the left edge of the stage.
 */
function fnArrow(ctx, colors, cx, y0, y1, label, live) {
  arrow(ctx, cx, y0, cx, y1, live ? colors.axis : colors.grid, 2);
  if (!label) return;
  txt(ctx, colors, label, cx + 10, (y0 + y1) / 2 + 0.5,
    { color: live ? colors.ink2 : colors.ink3, align: "left", baseline: "middle",
      mono: true, size: colors.fsXs });
}

/**
 * The −log p curve: the loss against the probability given to the true label, p
 * on x from 0 to 1 and the loss clipped at 5, which keeps 4.5184 and 4.9184 on
 * it. Drawn the way `support-layers`' `curvePanel` draws an activation.
 */
function logCurve(ctx, colors, x, y, pts, kind, cw = CURVE_W) {
  const f = curveFrame(ctx, colors, x, y, cw);
  const px = (p) => f.L + p * (f.R - f.L);
  const py = (v) => f.B - (Math.min(v, YMAX) / YMAX) * (f.B - f.T);
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const pLo = Math.exp(-YMAX);
  for (let i = 0; i <= 160; i += 1) {
    const p = pLo + (i / 160) * (1 - pLo);
    const v = -Math.log(p);
    if (i === 0) ctx.moveTo(px(p), py(v)); else ctx.lineTo(px(p), py(v));
  }
  ctx.stroke();
  /* A POINT PAST THE PANEL'S OWN END SITS ON THAT END, the same convention the
     vertical clip at YMAX already uses. The scores are held inside a fixed axis,
     but −2 against two 6s still gives p = 0.00017, which is left of where the
     curve enters the panel at e^−5; drawn at its own p it would float above the
     curve's start rather than on it. */
  for (const pt of pts) {
    const p = Math.max(pLo, Math.min(1, pt.p));
    plotDot(ctx, colors, px(p), py(-Math.log(p)), pt.lit);
  }
  curveAxes(ctx, colors, f, x, y, String(YMAX), M.STRINGS.curveY, "0", "1",
    M.STRINGS.curveTitle, M.STRINGS.curveX[kind], cw);
}

/** gap² against gap, the Regression page's own curve, on the same frame. */
function parabolaPanel(ctx, colors, x, y, gaps, held) {
  const f = curveFrame(ctx, colors, x, y);
  const px = (v) => f.L + ((v - GAP_LO) / (GAP_HI - GAP_LO)) * (f.R - f.L);
  const py = (v) => f.B - (Math.min(v, SQ_MAX) / SQ_MAX) * (f.B - f.T);
  /* the vertical rule sits at gap = 0, where a prediction meets its target */
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(0) + 0.5, f.B);
  ctx.lineTo(px(0) + 0.5, f.T);
  ctx.stroke();
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 160; i += 1) {
    const v = GAP_LO + (i / 160) * (GAP_HI - GAP_LO);
    if (i === 0) ctx.moveTo(px(v), py(v * v)); else ctx.lineTo(px(v), py(v * v));
  }
  ctx.stroke();
  /* the same convention on this axis: y_pred at one end of its own band against
     y_true at the other is a gap of 7, and the point sits on the panel's end,
     where the clip at 9 puts it back on the curve */
  gaps.forEach((v, i) => {
    const g = Math.max(GAP_LO, Math.min(GAP_HI, v));
    plotDot(ctx, colors, px(g), py(g * g), i === held);
  });
  /* NO CORNER TITLE HERE. On the two classification pages the corner names the
     function (−log p) and the vertical axis names what it returns (loss), and
     those are two different words; on this panel they are the same word, so the
     corner would print `gap²` a second time under itself. */
  curveAxes(ctx, colors, f, x, y, String(SQ_MAX), M.STRINGS.parabolaTitle,
    M.STRINGS.gapLo, M.STRINGS.gapHi, "", M.STRINGS.parabolaX);
}

function curveFrame(ctx, colors, x, y, cw = CURVE_W) {
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, cw, CURVE_H);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, CURVE_H - 1);
  const f = { L: x + 26, R: x + cw - 10, B: y + CURVE_H - 20, T: y + 22 };
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(f.L, f.B + 0.5);
  ctx.lineTo(f.R, f.B + 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.L + 0.5, f.B);
  ctx.lineTo(f.L + 0.5, f.T);
  ctx.stroke();
  return f;
}

function curveAxes(ctx, colors, f, x, y, ymax, ylab, xlo, xhi, title, xlab, cw = CURVE_W) {
  const small = { color: colors.ink3, size: colors.fsXs };
  txt(ctx, colors, ylab, f.L - 4, f.T - 9, { ...small, align: "right" });
  txt(ctx, colors, ymax, f.L - 4, f.T + 5, { ...small, align: "right" });
  txt(ctx, colors, "0", f.L - 4, f.B + 4, { ...small, align: "right" });
  txt(ctx, colors, xlo, f.L, f.B + 14, { ...small, align: "center" });
  txt(ctx, colors, xhi, f.R, f.B + 14, { ...small, align: "center" });
  if (title) {
    txt(ctx, colors, title, x + cw - 8, y + 14,
      { color: colors.ink2, align: "right", mono: true, size: colors.fsXs });
  }
  txt(ctx, colors, xlab, (f.L + f.R) / 2, y + CURVE_H - 5, { ...small, align: "center" });
}

function plotDot(ctx, colors, x, y, lit) {
  ctx.fillStyle = lit ? colors.highlight : colors.ink3;
  ctx.beginPath();
  ctx.arc(x, y, lit ? 4.5 : 3, 0, Math.PI * 2);
  ctx.fill();
}

/* --- where the walk stands --------------------------------------------------
 * One function, because the drawing, the region map and the readout must agree
 * about it (5.8). */
const walkDone = (anim, state) => Math.min(Math.max(0, anim?.n ?? 0), state.units);
const landed = (done, unit) => done >= unit;

/** The unit a row waits for, from `model.js`'s own table. */
function unitOf(state, id) {
  const u = M.pageUnits(state).find((e) => e.id === id);
  return u ? u.unit : state.units;
}

/* --- the figure ------------------------------------------------------------- */

/* THE HOVER READING, FOR THE READOUT ALONE. `draw` resolves the pointer to an
   element and stashes it; the readout tile reads the stash. Core paints the
   figure before it renders the readout, so the stash is always this frame's. */
let hovered = null;
/* THE ANIMATION OBJECT, FOR `regions` AND FOR `init`. Core hands a region table
   the parameters and the state and not the walk, and a chip that is not drawn
   is not a target (3.6). `init` reads it to tell a finished figure from an
   unfinished one (decision 7). Its one empty moment is core's load-time region
   probe, which runs before the first frame — so `regions` reads a full walk
   there and hands the probe the whole table to validate. */
let carry = null;
/* WHICH COLUMN THE GESTURE GRABBED. `drag.hit` runs on pointerdown, before
   `drag.value`, and core stops calling it once a gesture is in flight. */
let grabbed = -1;

function drawPage(ctx, colors, w, params, state, anim, pointer) {
  if (state.kind === "binary") return drawBinary(ctx, colors, w, state, anim, pointer);
  const g = M.layout(w, state);
  const done = walkDone(anim, state);
  const held = pointer ? M.barColAt(pointer.x, pointer.y, g) : -1;
  hovered = hoverAt(pointer, g, state, done);

  band(ctx, colors, w, M.HEAD[state.kind], M.HEAD_EXPR[state.kind]);

  /* the scores row, drawn at every walk position */
  const ticks = state.kind === "regression" && landed(done, 1) ? state.target : null;
  rowLabel(ctx, colors, g.x, g.nameY, M.STRINGS.outputRow, { mono: false });
  barRow(ctx, colors, g, state.scores, { held, ticks });
  dtypeLine(ctx, colors, g.x, g.dtypeY, M.scoresDtypeText(state));

  /* the function applied inside the loss */
  fnArrow(ctx, colors, g.colX(0), g.edgeY, g.edgeY + EDGE,
    M.FN_LABEL[state.kind], landed(done, 1));
  if (g.secondEdgeY !== null) {
    fnArrow(ctx, colors, g.colX(0), g.secondEdgeY, g.secondEdgeY + EDGE,
      "y_pred − y_true", landed(done, 2));
  }

  /* the gap bracket, between the bar's top and the target's tick */
  if (state.kind === "regression" && landed(done, 2)) {
    state.gaps.forEach((gap, i) => {
      const cx = g.colX(i) + g.barW / 2 + 9;
      const y0 = g.py(state.scores[i]);
      const y1 = g.py(state.target[i]);
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, y0); ctx.lineTo(cx, y1);
      ctx.moveTo(cx - 3, y0); ctx.lineTo(cx + 3, y0);
      ctx.moveTo(cx - 3, y1); ctx.lineTo(cx + 3, y1);
      ctx.stroke();
      txt(ctx, colors, M.n2(gap), cx + 5, (y0 + y1) / 2 + 3.5,
        { color: colors.empirical, mono: true, size: colors.fsXs });
    });
  }

  /* the computed rows */
  for (const row of g.rows) {
    const st = M.stageOf(done, row.unit);
    if (st === "absent") continue;
    const on = st === "landed";
    rowLabel(ctx, colors, g.x, row.nameY, row.label,
      { mono: row.kind !== "chips", color: on ? colors.ink2 : colors.ink3 });
    if (state.sumCol && row.id === "p") {
      txt(ctx, colors, M.STRINGS.rowSumHead, g.x + g.n * g.pitch + g.pitch / 2, row.nameY + 11,
        { color: colors.ink3, align: "center", size: colors.fsXs });
    }
    if (row.kind === "chips") {
      chipRow(ctx, colors, g, row.cellY, (i) => (on ? chipAt(state, i) : { text: "", empty: true }));
    } else {
      cellRow(ctx, colors, g, row.cellY, (i) => (on
        ? { text: cellText(state, row.id, i), hue: cellHue(colors, state, row.id), lit: cellLit(state, row.id, i, held) }
        : { empty: true }));
    }
    /* the sum column sits OUTSIDE the tensor, with no fill: it is a reading of
       the row rather than one more probability (support-layers, main.js 819) */
    if (state.sumCol && row.id === "p") {
      valueCell(ctx, colors, g.x + g.n * g.pitch, row.cellY, g.pitch, CH,
        on ? M.n4(state.rowSum) : "", { plain: true, empty: !on });
    }
    if (row.dtypeY !== undefined && on) {
      dtypeLine(ctx, colors, g.x, row.dtypeY, M.targetDtypeText(state),
        state.bad ? colors.extreme : colors.ink3);
    }
  }

  /* the answer, which lands last */
  if (landed(done, state.units)) {
    if (state.bad) {
      errorText(ctx, colors, g.x, g.lossY + 11, g.leftW, M.torchDtypeError[state.kind]);
    } else {
      const lead = lossLead(state);
      const probe = measureCtx();
      probe.font = `${colors.fsSm} ${colors.mono}`;
      txt(ctx, colors, lead, g.x, g.lossY + 12, { color: colors.ink2, mono: true });
      txt(ctx, colors, M.n4(state.loss), g.x + probe.measureText(lead).width, g.lossY + 12,
        { color: colors.empirical, mono: true, weight: "600" });
    }
  }

  /* the curve, and the point the reader is moving */
  if (state.kind === "regression") {
    parabolaPanel(ctx, colors, g.curveX, g.curveY,
      landed(done, unitOf(state, "curve points")) ? state.gaps : [], held);
  } else if (state.kind === "single-label") {
    logCurve(ctx, colors, g.curveX, g.curveY,
      landed(done, state.units) && !state.bad ? [{ p: state.p[state.label], lit: true }] : [], state.kind);
  } else {
    logCurve(ctx, colors, g.curveX, g.curveY,
      landed(done, state.units) && !state.bad
        ? state.pTrue.map((p, i) => ({ p, lit: i === held }))
        : [], state.kind);
  }

  /* the caption block: a row waits for the step that makes it true (2.4), and
     its row is reserved either way so the block is the same height empty */
  const caps = M.STRINGS.captions[state.kind];
  caps.forEach((c) => {
    if (!landed(done, c.at)) return;
    const line = state.bad && c.row === caps.length - 1
      ? M.STRINGS.errorCaption[state.kind]
      : c.line;
    txt(ctx, colors, line, PAD, g.capY + 12 + c.row * LINE, { color: colors.ink2 });
  });

  return g;
}

/* ============================ the Binary page =============================
 * Two columns of ONE flow: the same rows at the same y, so the two loss lines
 * sit on one line and the reader compares them without moving their eye
 * (decision 13). Everything below is the same primitive the other three pages
 * draw with, handed one column's geometry instead of the page's.
 */

function binaryColumn(ctx, colors, g, c, state, done, f) {
  rowLabel(ctx, colors, c.x, g.nameY, f.name, { mono: false });
  barRow(ctx, colors, c, f.scores, { held: f.held, letters: f.letters });
  dtypeLine(ctx, colors, c.x, g.dtypeY, f.scoreShape);
  fnArrow(ctx, colors, c.colX(0), g.edgeY, g.edgeY + EDGE, f.fn, landed(done, 1));

  for (const row of g.rows) {
    const st = M.stageOf(done, row.unit);
    if (st === "absent") continue;
    const on = st === "landed";
    rowLabel(ctx, colors, c.x, row.nameY, row.label,
      { mono: row.kind !== "chips", color: on ? colors.ink2 : colors.ink3 });
    if (c.sumCol && row.id === "p") {
      txt(ctx, colors, M.STRINGS.rowSumHead, c.x + c.n * c.pitch + c.pitch / 2, row.nameY + 11,
        { color: colors.ink3, align: "center", size: colors.fsXs });
    }
    if (row.kind === "chips") {
      chipRow(ctx, colors, c, row.cellY, (i) => (on ? f.chipAt(i) : { text: "", empty: true }));
    } else {
      cellRow(ctx, colors, c, row.cellY, (i) => (on ? f.cellAt(i) : { empty: true }));
    }
    if (c.sumCol && row.id === "p") {
      valueCell(ctx, colors, c.x + c.n * c.pitch, row.cellY, c.pitch, CH,
        on ? f.sum : "", { plain: true, empty: !on });
    }
    if (row.dtypeY !== undefined && on) {
      dtypeLine(ctx, colors, c.x, row.dtypeY, f.targetShape);
    }
  }

  if (landed(done, state.units)) {
    const probe = measureCtx();
    probe.font = `${colors.fsSm} ${colors.mono}`;
    txt(ctx, colors, f.lead, c.x, g.lossY + 12, { color: colors.ink2, mono: true });
    txt(ctx, colors, f.loss, c.x + probe.measureText(f.lead).width, g.lossY + 12,
      { color: colors.empirical, mono: true, weight: "600" });
  }
}

function drawBinary(ctx, colors, w, state, anim, pointer) {
  const g = M.layout(w, state);
  const done = walkDone(anim, state);
  const held = pointer ? M.barColAt(pointer.x, pointer.y, g.left) : -1;
  hovered = hoverBinary(pointer, g, state, done);

  band(ctx, colors, w, M.HEAD.binary, M.binaryExpr(state.label));

  /* the rule between the columns, so the two flows read as two forms of one
     model rather than one wide figure */
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(g.ruleX + 0.5, g.top);
  ctx.lineTo(g.ruleX + 0.5, g.top + g.rowsH);
  ctx.stroke();

  binaryColumn(ctx, colors, g, g.left, state, done, {
    name: M.STRINGS.binaryTwoRow,
    scores: state.scores,
    letters: M.LETTERS,
    held,
    fn: M.BIN_FN.two,
    scoreShape: M.BIN_SHAPE.scoresTwo,
    targetShape: M.BIN_SHAPE.targetTwo,
    sum: M.n4(state.rowSum),
    cellAt: (i) => ({ text: M.n4(state.p[i]), hue: colors.empirical, lit: i === state.label }),
    chipAt: (i) => ({ text: M.LETTERS[i], on: i === state.label }),
    lead: `loss = −log ${M.n4(state.p[state.label])} = `,
    loss: M.n4(state.loss),
  });
  /* THE DERIVED BAR CARRIES ITS ALGEBRA ON THE LETTER LINE, where every other
     page prints a class name, and it does not drag (decision 14). */
  binaryColumn(ctx, colors, g, g.right, state, done, {
    name: M.STRINGS.binaryOneRow,
    scores: [state.z],
    letters: [M.STRINGS.binaryDiffName],
    held: -1,
    fn: M.BIN_FN.one,
    scoreShape: M.BIN_SHAPE.scoresOne,
    targetShape: M.BIN_SHAPE.targetOne,
    sum: null,
    cellAt: () => ({ text: M.n4(state.pOne), hue: colors.empirical, lit: true }),
    chipAt: () => ({ text: String(state.label), on: state.label === 1 }),
    lead: `loss = −log ${M.n4(state.pOne)} = `,
    loss: M.n4(state.lossOne),
  });

  /* ONE POINT, WHICH BOTH FORMS READ. The probability is the same number in
     both columns, so there is one dot and not two on top of each other. */
  logCurve(ctx, colors, g.curveX, g.curveY,
    landed(done, state.units) ? [{ p: state.pOne, lit: true }] : [], state.kind, g.curveW);

  M.STRINGS.captions.binary.forEach((c) => {
    if (!landed(done, c.at)) return;
    txt(ctx, colors, c.line, PAD, g.capY + 12 + c.row * LINE, { color: colors.ink2 });
  });
  return g;
}

/** The Binary page's own hover reading, from the same two column geometries. */
function hoverBinary(pointer, g, state, done) {
  if (!pointer) return null;
  const bar = M.barColAt(pointer.x, pointer.y, g.left);
  if (bar >= 0) {
    return {
      name: `y_pred[0, ${bar}]`,
      value: M.n1(state.scores[bar]),
      note: `the model's score for class ${M.LETTERS[bar]}`,
    };
  }
  if (M.barColAt(pointer.x, pointer.y, g.right) === 0) {
    return {
      name: M.STRINGS.binaryDiffName,
      value: M.n1(state.z),
      note: M.STRINGS.binaryDerivedNote,
    };
  }
  const row = g.rows.find((r) => pointer.y >= r.cellY && pointer.y <= r.cellY + CH);
  if (!row || !landed(done, row.unit)) return null;
  const c = pointer.x < g.ruleX ? g.left : g.right;
  const two = c === g.left;
  let col = -1;
  for (let i = 0; i < c.n; i += 1) {
    if (Math.abs(pointer.x - c.colX(i)) <= c.pitch / 2) col = i;
  }
  if (col < 0) {
    const sumX = c.x + c.n * c.pitch + c.pitch / 2;
    if (!c.sumCol || row.id !== "p" || Math.abs(pointer.x - sumX) > c.pitch / 2) return null;
    return { name: M.STRINGS.rowSumHead, value: M.n4(state.rowSum), note: M.SUM_NOTE.binary };
  }
  if (row.kind === "chips") {
    return {
      name: "y_true[0]",
      value: String(state.label),
      note: two ? `the target is class ${M.LETTERS[state.label]}` : M.STRINGS.binaryTargetNote,
    };
  }
  return two
    ? { name: `p[0, ${col}]`, value: M.n4(state.p[col]), note: M.STRINGS.binaryPTwoNote }
    : { name: "p[0]", value: M.n4(state.pOne), note: M.STRINGS.binaryPOneCellNote };
}

/**
 * WHAT THE POINTER IS OVER, for the readout's own tile. Resolved from the same
 * geometry the drawing uses, so a reading cannot name a cell that is somewhere
 * else, and a row that has not landed reads nothing rather than a value the
 * figure is not showing (2.1).
 */
function hoverAt(pointer, g, state, done) {
  if (!pointer) return null;
  const bar = M.barColAt(pointer.x, pointer.y, g);
  if (bar >= 0) {
    return {
      name: `y_pred[0, ${bar}]`,
      value: M.n1(state.scores[bar]),
      note: state.kind === "regression"
        ? `the model's prediction for output ${M.LETTERS[bar]}`
        : `the model's score for class ${M.LETTERS[bar]}`,
    };
  }
  const row = g.rows.find((r) => pointer.y >= r.cellY && pointer.y <= r.cellY + CH);
  if (!row || !landed(done, row.unit)) return null;
  let col = -1;
  for (let i = 0; i < g.n; i += 1) {
    if (Math.abs(pointer.x - g.colX(i)) <= g.pitch / 2) col = i;
  }
  if (col < 0) {
    /* the row-sum column, which sits outside the tensor and is a reading of the
       row rather than one more value in it */
    const sumX = g.x + g.n * g.pitch + g.pitch / 2;
    if (!state.sumCol || row.id !== "p" || Math.abs(pointer.x - sumX) > g.pitch / 2) return null;
    return {
      name: M.STRINGS.rowSumHead,
      value: M.n4(state.rowSum),
      note: M.SUM_NOTE[state.kind],
    };
  }
  if (row.kind === "chips") {
    if (state.kind === "single-label") {
      return {
        name: "y_true[0]",
        value: String(state.label),
        note: `the target is class ${M.LETTERS[state.label]}`,
      };
    }
    return {
      name: `y_true[0, ${col}]`,
      value: String(state.y[col]),
      note: `the target marks class ${M.LETTERS[col]} ${state.y[col] ? "present" : "not present"}`,
    };
  }
  return {
    name: `${M.hoverName(row.id)}[0, ${col}]`,
    value: cellText(state, row.id, col),
    note: rowNote(state, row.id),
  };
}

const lossLead = (state) => (state.kind === "regression"
  ? "loss = mean(gap²) = "
  : state.kind === "single-label"
    ? `loss = −log ${M.n4(state.p[state.label])} = `
    : "loss = mean(−log p) = ");

function cellText(state, id, i) {
  if (id === "target") return M.n2(state.target[i]);
  if (id === "gap") return M.n2(state.gaps[i]);
  if (id === "gap squared") return M.n4(state.sq[i]);
  if (id === "p at the true label") return M.n4(state.pTrue[i]);
  if (id === "-log p") return M.n4(state.terms[i]);
  return M.n4(state.p[i]);
}
const cellHue = (colors, state, id) =>
  (id === "target" ? colors.reference : colors.empirical);
/* on Single-label the lit cell is the TRUE CLASS's probability, which is what
   the loss reads; on the other pages it is the column under the pointer */
const cellLit = (state, id, i, held) =>
  (state.kind === "single-label" && id === "p" ? i === state.label : i === held);

function chipAt(state, i) {
  if (state.kind === "single-label") {
    return { text: M.LETTERS[i], on: i === state.label };
  }
  return { text: String(state.y[i]), on: state.y[i] === 1 };
}

function rowNote(state, id) {
  if (id === "target") return "the target this prediction is measured against";
  if (id === "gap") return "the prediction minus its target";
  if (id === "gap squared") return "the gap multiplied by itself";
  if (id === "p at the true label") return "the probability given to this class's own 0 or 1";
  if (id === "-log p") return "this class's own term of the loss";
  return state.kind === "single-label"
    ? "this class's probability in the row"
    : "the probability this class is present";
}

/* ======================= the field follows the count ======================
 * DECISION 12. A tensor field must show the row the figure is drawing, and a
 * `show` is handed its stored value and nothing else — so the count comes from
 * `M.FIELD_N`, which `computeFor` writes. That covers every path but one: core
 * REBUILDS the control block before it recomputes the state (`widget.js`
 * `setParam` — the gate branch runs, then `render`), so on the frame a count
 * parameter moves, the field's own `show` has already run against the previous
 * count. The field is repainted here instead, once the new state exists.
 *
 * The `input` event is core's own door for a field that has just been written
 * from outside: it re-runs the field's own `check`, and commits nothing — a
 * value commits on `change`. And a cell the reader is typing in is left alone.
 *
 * Only `outputs` can move a count now, so only the Regression pair can be one
 * cell short; the other three pages are fixed and repaint through the setter
 * like any other control. The sweep is kept over all four because a stale cell
 * is a rail that lies about the figure, and the loop costs nothing.
 */
const FIELD_ROWS = {
  regression: [["pred", "scores"], ["target", "target"]],
  "single-label": [["scores", "scores"]],
  "multi-label": [["logits", "scores"]],
  binary: [["binaryScores", "scores"]],
};

function syncTensorFields(state) {
  for (const [name, key] of FIELD_ROWS[state.kind] ?? []) {
    const group = document.querySelector(`#widget .w-cells[data-param="${name}"]`);
    if (!group) continue;
    const cells = [...group.querySelectorAll(".w-cell")];
    const want = M.showVec(M.wire(state[key])).split(",").map((s) => s.trim());
    let moved = false;
    cells.forEach((cell, i) => {
      const text = want[i] ?? "";
      if (cell.value === text || document.activeElement === cell) return;
      cell.value = text;
      moved = true;
    });
    /* one event for the row, so the field's own hint is re-checked against what
       the cells now hold and not against what they held a count ago */
    if (moved) cells[0]?.dispatchEvent(new Event("input"));
  }
}

/* ============================ the formula card ============================= */

const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const msup = (b, s) => `<msup>${b}${s}</msup>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const row = (...xs) => xs.join("");
const mrow = (...xs) => `<mrow>${xs.join("")}</mrow>`;
const eq = (mathml, plain) => (MATHML ? mml(mathml) : plain);

/* `msub`, `msup` and `mfrac` take EXACTLY TWO children, so any argument built
   from several pieces is wrapped in an `mrow` — without it the exponent of
   (ŷᵢ − yᵢ)² rendered as a trailing 2 on the baseline. */
const SUM_I = msub(mo("∑"), mi("i"));
const SUM_C = msub(mo("∑"), mi("c"));
const Z_IC = msub(mi("z"), mrow(mi("i"), mo(","), mi("c")));
const Y_IC = msub(mi("y"), mrow(mi("i"), mo(","), mi("c")));
const SIG = (z) => row(mi("σ"), mo("("), z, mo(")"));
const CARD = {
  regression: eq(
    row(mi("L"), mo("="), frac(mn("1"), mi("N")), mo("∑"),
      msup(mrow(mo("("), msub(mi("ŷ"), mi("i")), mo("−"), msub(mi("y"), mi("i")), mo(")")), mn("2"))),
    "L = (1/N) Σ (ŷᵢ − yᵢ)²"),
  "single-label": eq(
    row(mi("L"), mo("="), mo("−"), frac(mn("1"), mi("N")), SUM_I, mi("log"), mo("("),
      frac(msup(mi("e"), msub(mi("z"), mrow(mi("i"), mo(","), msub(mi("y"), mi("i"))))),
        mrow(SUM_C, msup(mi("e"), Z_IC))),
      mo(")")),
    "L = −(1/N) Σᵢ log( e^{z_{i,yᵢ}} / Σ_c e^{z_{i,c}} )"),
  "multi-label": eq(
    row(mi("L"), mo("="), mo("−"), frac(mn("1"), mi("N")), SUM_I, SUM_C,
      mo("["), Y_IC, mi("log"), SIG(Z_IC), mo("+"),
      mo("("), mn("1"), mo("−"), Y_IC, mo(")"),
      mi("log"), mo("("), mn("1"), mo("−"), SIG(Z_IC), mo(")"), mo("]")),
    "L = −(1/N) Σᵢ Σ_c [ y_{i,c} log σ(z_{i,c}) + (1 − y_{i,c}) log(1 − σ(z_{i,c})) ]"),
  /* THE BINARY CARD IS THE IDENTITY, not a loss: what the page claims is that
     one probability has two expressions, and the losses follow from it. */
  binary: eq(
    row(msub(mi("p"), mi("B")), mo("="),
      frac(msup(mi("e"), msub(mi("z"), mi("B"))),
        mrow(msup(mi("e"), msub(mi("z"), mi("A"))), mo("+"), msup(mi("e"), msub(mi("z"), mi("B"))))),
      mo("="), mi("σ"), mo("("), msub(mi("z"), mi("B")), mo("−"), msub(mi("z"), mi("A")), mo(")")),
    "p_B = e^{z_B} / (e^{z_A} + e^{z_B}) = σ(z_B − z_A)"),
};
const CARD_NAME = {
  regression: "MSE",
  "single-label": "CE",
  "multi-label": "BCE",
  binary: "p_B",
};

const GUTTER = "3.6em";
let cardHost = null;
let cardKey = null;

function renderCard(params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const task = params.task;
  if (task === cardKey) return;
  cardKey = task;
  const note = `${M.STRINGS.cardNote[task]} ${M.STRINGS.cardExtra}`;
  cardHost.innerHTML =
    `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
    + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">`
    + `${CARD_NAME[task]}</span>${CARD[task]}</div>`
    + `<p class="w-math-note">${note}</p>`;
}

/* ============================== the widget ================================= */

const ON = (task) => ({ param: "task", equals: task });
/* DECISION 17: the head row over each page's cells, and the count under it. */
const HEADS = (kind) => M.headsFor(kind);

/** The tensor field each page's bars belong to, for the drag and the field
    sync. `params` is a fixed list, so all four are declared and the three that
    are off this page are returned unchanged. */
const DRAG_KEY = {
  regression: "pred",
  "single-label": "scores",
  "multi-label": "logits",
  binary: "binaryScores",
};

defineWidget({
  slug: "loss-functions",
  title: "Deep Learning - Loss Functions",
  status: "shipped",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* the column under the pointer is lit, and named in the readout (decision 6) */
  pointer: true,
  /* decision 2: every page is as tall as its own rows, its curve and its two
     caption lines */
  height: ({ w, ...values }) => M.pageHeight(w, values),

  params: {
    /* DECISION 15: four faces in two groups, the way the losses divide. */
    task: {
      type: "segmented",
      label: M.STRINGS.taskLabel,
      options: M.TASKS,
      groupHeads: true,
      default: "regression",
    },

    /* --- Regression -------------------------------------------------------- *
     * DECISION 16: both tensors are rows of cells in the same columns, and on
     * this page both rows are numbers — so the heads are 1 2 3 and not A B C
     * (3.7: an output is not a class, and y_true here is float32 in the units
     * of the prediction). The count follows `Outputs`, which is why the field
     * declares `cellsFrom`. */
    pred: {
      type: "text",
      label: "y_pred",
      detail: M.STRINGS.predDetail,
      default: M.MSE_PRED,
      cells: {
        count: (values) => M.countOf(values, "outputs"),
        heads: (values) => M.OUTPUT_HEADS.slice(0, M.countOf(values, "outputs")),
      },
      cellsFrom: "outputs",
      parse: (t) => M.parseRow(t, M.RANGE.regression),
      show: (v) => M.showRow(v, M.FIELD_N.pred, M.RANGE.regression),
      check: (t, values) => M.hintFor(t, M.countOf(values, "outputs"), "output"),
      when: ON("regression"),
    },
    target: {
      type: "text",
      label: "y_true",
      detail: M.STRINGS.targetDetail,
      default: M.MSE_TRUE,
      cells: {
        count: (values) => M.countOf(values, "outputs"),
        heads: (values) => M.OUTPUT_HEADS.slice(0, M.countOf(values, "outputs")),
      },
      cellsFrom: "outputs",
      parse: (t) => M.parseRow(t, M.RANGE.regression),
      show: (v) => M.showRow(v, M.FIELD_N.target, M.RANGE.regression),
      check: (t, values) => M.hintFor(t, M.countOf(values, "outputs"), "output"),
      when: ON("regression"),
    },
    /* DECISION 11: the count is the number of COLUMNS, under the fields it
       resizes and facing the numbers. */
    outputs: {
      type: "segmented",
      label: M.STRINGS.outputsLabel,
      detail: M.STRINGS.outputsDetail,
      options: M.OUTPUT_COUNTS,
      default: M.COUNT_DEFAULT.outputs,
      when: ON("regression"),
    },

    /* --- Single-label ------------------------------------------------------ *
     * DECISION 17: THE HEAD ROW CARRIES THE LETTER AND THE BUTTONS CARRY THE
     * INDEX, because the letter is the column and the index is the value. The
     * page's whole claim is that this target is ONE class index stored as long,
     * so the control shows that index and the head above it says which class
     * the index names. */
    scores: {
      type: "text",
      label: "y_pred",
      detail: M.STRINGS.scoresDetail,
      default: M.CE_SCORES,
      cells: { count: M.PAGE_N["single-label"], heads: HEADS("single-label") },
      parse: (t) => M.parseRow(t, M.RANGE["single-label"]),
      show: (v) => M.showRow(v, M.FIELD_N.scores, M.RANGE["single-label"]),
      check: (t) => M.hintFor(t, M.PAGE_N["single-label"], "class"),
      when: ON("single-label"),
    },
    label: {
      type: "segmented",
      label: "y_true",
      detail: M.STRINGS.labelDetail,
      options: M.LABEL_OPTIONS,
      default: M.CE_LABEL,
      when: ON("single-label"),
    },

    /* --- Multi-label ------------------------------------------------------- */
    logits: {
      type: "text",
      label: "y_pred",
      detail: M.STRINGS.logitsDetail,
      default: M.BCE_SCORES,
      cells: { count: M.PAGE_N["multi-label"], heads: HEADS("multi-label") },
      parse: (t) => M.parseRow(t, M.RANGE["multi-label"]),
      show: (v) => M.showRow(v, M.FIELD_N.logits, M.RANGE["multi-label"]),
      check: (t) => M.hintFor(t, M.PAGE_N["multi-label"], "class"),
      when: ON("multi-label"),
    },
    /* FIVE SWITCHES RATHER THAN ONE FIELD: the target here is a 0 or a 1 per
       class, and a class letter is what the chips on the stage are labelled.
       The row is named by a `section` and not by a `detail` on the first
       switch: `.w-bools` is a flex row and a detail belongs to the switch it
       sits under, so the sentence widened A's column and broke the five
       letters onto three lines.

       DECISION 18: the run declares the same five columns the cells above it
       are laid out in, so each switch sits under the score for its own class.
       Only the first field of a run is read for that, as for a row caption. */
    targetRow: {
      type: "section",
      label: "y_true",
      detail: M.STRINGS.boolsDetail,
      when: ON("multi-label"),
    },
    A: {
      type: "bool",
      label: "A",
      default: M.BCE_Y[0],
      cells: { count: M.PAGE_N["multi-label"] },
      when: ON("multi-label"),
    },
    B: { type: "bool", label: "B", default: M.BCE_Y[1], when: ON("multi-label") },
    C: { type: "bool", label: "C", default: M.BCE_Y[2], when: ON("multi-label") },
    D: { type: "bool", label: "D", default: M.BCE_Y[3], when: ON("multi-label") },
    E: { type: "bool", label: "E", default: M.BCE_Y[4], when: ON("multi-label") },

    /* --- Binary ------------------------------------------------------------ */
    binaryScores: {
      type: "text",
      label: "y_pred",
      detail: M.STRINGS.binaryScoresDetail,
      default: M.BIN_SCORES,
      cells: { count: M.PAGE_N.binary, heads: HEADS("binary") },
      parse: (t) => M.parseRow(t, M.RANGE.binary),
      show: (v) => M.showRow(v, M.FIELD_N.binaryScores, M.RANGE.binary),
      check: (t) => M.hintFor(t, M.PAGE_N.binary, "class"),
      when: ON("binary"),
    },
    binaryLabel: {
      type: "segmented",
      label: "y_true",
      detail: M.STRINGS.binaryLabelDetail,
      options: ["0", "1"],
      default: M.BIN_LABEL,
      when: ON("binary"),
    },

    /* --- the case that fails (2.6) ----------------------------------------- *
     * TWO dtype parameters, because one parameter has one default and each page
     * has to open on its own correct arm. Each is named from the task face and
     * the control's own word. */
    singleDtype: {
      type: "segmented",
      label: M.STRINGS.dtypeLabel,
      detail: M.STRINGS.dtypeDetail,
      options: ["long", "float32"],
      default: "long",
      when: ON("single-label"),
    },
    multiDtype: {
      type: "segmented",
      label: M.STRINGS.dtypeLabel,
      detail: M.STRINGS.dtypeDetail,
      options: ["float32", "long"],
      default: "float32",
      when: ON("multi-label"),
    },

    speed: {
      type: "choice",
      label: M.STRINGS.speedLabel,
      options: M.SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: rows of the loss's
       computation. */
    shown: { type: "int", min: 0, max: 5, default: 0, hidden: true },
  },

  /* DECISION 8: `group-a` and `empirical` are one colour in `tokens.css`, so
     one entry covers the scores and every row computed from them. */
  legend: ({ params }) => {
    const task = params.task;
    const bad = (task === "single-label" && params.singleDtype === "float32")
      || (task === "multi-label" && params.multiDtype === "long");
    const rows = task === "regression"
      ? "The predictions, the gaps and the squared gaps"
      : task === "single-label"
        ? "The scores, the softmax probabilities, and the curve"
        : task === "binary"
          ? "The scores, the probabilities from softmax and from sigmoid, and the curve"
          : "The scores, the sigmoid probabilities, the per-class terms, and the curve";
    return [
      { token: "empirical", label: rows },
      {
        token: "reference",
        label: task === "regression"
          ? "The target for each output"
          : task === "multi-label"
            ? "The target: a 0 or a 1 for each class"
            : "The target: the one class the sample belongs to",
      },
      { token: "highlight", label: "The column under the pointer" },
      ...(bad ? [{ token: "extreme", label: "The message torch raises" }] : []),
    ];
  },

  /* pure and unseeded: nothing on any page is random */
  compute: ({ params }) => M.computeFor(params),

  /* THE TARGET CHIPS ARE THE TARGETS (3.6), one parameter each: the class index
     on Single-label, the class's own switch on Multi-label. Built lazily at
     click time from the same geometry `draw` uses, and only once the target row
     has landed — a chip that is not drawn is not a target. */
  regions: ({ w, params, state }) => {
    if (!state || state.kind === "regression") return [];
    const done = walkDone(carry ?? { n: state.units }, state);
    if (!landed(done, 2)) return [];
    const full = M.layout(w, state);
    /* the Binary page's targets are the two-output form's chips: the class the
       sample belongs to, which is the same `binaryLabel` the one-output form
       reads as a 0 or a 1 */
    const g = state.kind === "binary" ? full.left : full;
    const cw = Math.min(42, g.pitch - 10);
    const row = full.rows.find((r) => r.id === "target");
    if (state.kind === "binary") {
      return [0, 1].map((i) => ({
        x: g.colX(i) - cw / 2,
        y: row.cellY,
        w: cw,
        h: CH,
        set: { binaryLabel: String(i) },
        label: `class ${M.LETTERS[i]}`,
      }));
    }
    return Array.from({ length: g.n }, (_, i) => ({
      x: g.colX(i) - cw / 2,
      y: row.cellY,
      w: cw,
      h: CH,
      set: state.kind === "single-label"
        ? { label: String(i) }
        : { [M.LETTERS[i]]: !params[M.LETTERS[i]] },
      label: `class ${M.LETTERS[i]}`,
    }));
  },

  /* THE BAR'S TOP IS THE HANDLE. `params` is a fixed list, so all three tensor
     fields are declared and the two that are off this page are returned
     unchanged; core writes each straight through the region door with no parse,
     which is why `value` returns the canonical text the field's own `parse`
     would have produced. */
  drag: {
    params: ["pred", "scores", "logits", "binaryScores"],
    cursor: "grab",
    /* DECISION 14: on the Binary page only the two-output form's bars are
       handles. The derived bar has no parameter — p_B depends on the difference
       alone, so every position it can take is already reachable by dragging B,
       and the map from a difference back to a pair of scores is not unique. */
    hit: ({ x, y, w, state }) => {
      const g = M.layout(w, state);
      grabbed = M.barColAt(x, y, state.kind === "binary" ? g.left : g);
      return grabbed >= 0;
    },
    value: ({ dy, start, state }) => {
      const next = { ...start };
      const key = DRAG_KEY[state.kind];
      next[key] = M.dragVec(start[key], grabbed, dy, state.n, state.range);
      return next;
    },
  },

  animation: {
    stepLabel: M.STRINGS.stepLabel,
    stepTitle: M.STRINGS.stepTitle,
    runLabel: M.STRINGS.runLabel,
    runTitle: M.STRINGS.runTitle,

    /* DECISION 7, and 4.4's data-path door. A data change on a FINISHED figure
       on the same task keeps it finished, which is what lets the drag and the
       chips move a finished figure; `carry.state !== state` is what tells a
       data change from a Replay, since a Replay re-inits against the same state
       object. A figure mid-walk resets, as every data change does. */
    init: ({ params, state, fromScratch }) => {
      const kept = Boolean(carry) && carry.state !== state
        && carry.done && carry.task === params.task;
      const n = kept
        ? state.units
        : fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.units);
      return { n, beat: 0, clock: M.unitMs(params.speed), done: n >= state.units };
    },

    advance: (anim, { dt, params, state }) => {
      if (anim.n >= state.units) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.unitMs(params.speed);
      if (anim.beat < 1) return true;
      anim.beat = 0;
      anim.n += 1;
      if (anim.n >= state.units) anim.done = true;
      return anim.mode !== "step" && !anim.done;
    },

    /* A beat in flight is cleared whenever the beat LENGTH changes: a fraction
       of one clock read against another leaves a step stopped between its two
       ends. `speed` is the only display parameter here. */
    rebuild: (anim, { params, state }) => {
      anim.n = Math.min(anim.n, state.units);
      const ms = M.unitMs(params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
      anim.done = anim.n >= state.units;
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    renderCard(params);
    syncTensorFields(state);
    drawPage(ctx, colors, w, params, state, anim, pointer);
    carry = {
      state,
      task: params.task,
      n: anim?.n ?? 0,
      done: Boolean(anim) && anim.n >= state.units,
    };
  },

  readout({ params, state, anim }) {
    const done = walkDone(anim, state);
    const ready = landed(done, state.units) && !state.bad;
    /* THE BINARY PAGE READS ITS TWO LOSSES SIDE BY SIDE HERE TOO, and the
       difference the one-output form is built from is the third tile. */
    const tiles = [
      state.kind === "binary"
        ? {
          label: M.STRINGS.binaryTwoTile,
          value: ready ? M.n4(state.loss) : "—",
          note: M.STRINGS.binaryTwoNote,
        }
        : {
          label: "Loss",
          value: ready ? M.n4(state.loss) : "—",
          note: state.bad ? M.STRINGS.raisedNote : M.STRINGS.lossNote[state.kind],
        },
      pageTile(state, done),
      ...(state.kind === "binary"
        ? [{
          label: M.STRINGS.binaryDiffName,
          value: M.n1(state.z),
          note: M.STRINGS.binaryDiffNote,
        }]
        : []),
      {
        label: "Target",
        value: M.targetDtypeText(state),
        note: M.STRINGS.dtypeRule[state.kind],
      },
      {
        label: "Under the pointer",
        value: hovered ? `${hovered.name} = ${hovered.value}` : "—",
        note: hovered ? hovered.note : "the pointer reads one value off the figure",
      },
      {
        label: "Rows landed",
        value: `${done} of ${state.units}`,
        note: "each step lands one row, and the last the loss",
      },
    ];
    return tiles;
  },
});

/** The second tile, which is the page's own reading of its probability row. */
function pageTile(state, done) {
  if (state.kind === "binary") {
    return {
      label: M.STRINGS.binaryOneTile,
      value: landed(done, state.units) ? M.n4(state.lossOne) : "—",
      note: M.STRINGS.binaryOneNote,
    };
  }
  if (state.kind === "regression") {
    const on = landed(done, 2);
    let top = 0;
    state.gaps.forEach((g, i) => { if (Math.abs(g) > Math.abs(state.gaps[top])) top = i; });
    return {
      label: "Largest gap",
      value: on ? M.n2(Math.abs(state.gaps[top])) : "—",
      note: "the largest distance from a prediction to its target",
    };
  }
  const on = landed(done, 1);
  if (state.kind === "single-label") {
    return {
      label: "p at the true class",
      value: on ? M.n4(state.p[state.label]) : "—",
      note: M.STRINGS.pTrueNote,
    };
  }
  return {
    label: "Row sum of p",
    value: on ? M.n4(state.rowSum) : "—",
    note: M.SUM_NOTE["multi-label"],
  };
}
