/* ============================================================================
   Widget 53 · Tensors — where a value goes, when two shapes combine, which
   dimension disappears.

   PHM5005 05-2 cells 1-69. `model.js` carries the lesson's tensors, every
   operation and the per-step walk each tab animates; this file draws them and
   nothing else. Six topics in the lesson's own order and its own two halves —
   Tensors for Data: Basics, Shape, Join; Linear Algebra: Broadcast, Multiply,
   Reduce.

   THE DEVICE IS THAT EVERY CELL CARRIES ITS VALUE. That is what lets the
   figure show the thing a shape diagram cannot: 11 goes to [1, 0, 0] under
   both reshape(2, 5, 2) and permute(0, 2, 1) while 2 goes to [0, 0, 1] under
   one and [0, 1, 0] under the other. A picture of empty boxes proves neither.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

   1. THE SHAPE TAB READS TOP TO BOTTOM, the other three left to right, and the
      difference is the arithmetic. `flatten()` is twenty cells in one row: at
      the 550px fingerprint width, a source and a twenty-cell result side by
      side put every cell under 19px with two digits in it. Stacked, the same
      width gives 26px cells on every operation including that one. The other
      three tabs combine two operands with an operator between them, which is
      how the lesson writes them, and none of them is wider than eight cells.

   ROUND 3 (2026-09-08) — TWO DRAWINGS OF ONE TENSOR, AND THE PRINTED TEXT.
   The first draft drew the [2, 2, 5] tensor as stacked grids offset by one
   whole cell, which covers four of the back grid's ten cells and would cover
   fourteen of thirty for cat's [4, 2, 5]. `_lab/tensor-draw.html` measured five
   drawings; two were picked and both are built, on a `view` control:

   7. `view` IS A DISPLAY PARAMETER. It changes how the same tensor is laid
      out, not what the operation does, so switching it keeps every value the
      reader has already moved (3.2). Nothing in `anim` is geometric — `n`,
      `beat` and `clock` are counts and clocks — so `rebuild` needs no case
      for it.

   8. THE CELL SIZE IS NOW FITTED PER OPERATION on the Shape tab, where it was
      one number for the whole widget. The printed text is what forced it: a
      [2, 2, 5] print is 32 mono columns and a [2, 2, 2, 5] print is 34, so
      what fits beside a drawing depends on how wide that drawing is, and
      `stack(dim=0)` draws two exploded stacks where `reshape(2, −1)` draws one
      flat grid. `shapeFit` takes the largest cell from `cellSize(w)` down that
      keeps the whole block inside the stage, preferring the print BESIDE its
      drawing and dropping it below only where beside will not fit. The other
      three tabs still share `cellSize(w)`.

   9. THE STAGE IS TALLER, AND THE PRINT IS WHY: 406 -> 524 at the 550px stage
      width and 442 -> 560 at 770. `stack(dim=0)` prints twelve lines plus its
      shape line and `cat(dim=0)` eleven, and each source tensor carries six
      more of its own. One height across tabs was Kenneth's call (2026-09-08),
      so Broadcast, Multiply and Reduce carry the extra space.

  10. THE DRAWING AND THE PRINT ARE HIT-TESTED AS ONE. Every cell of both
      carries the same `key` — `T|0,1,2`, `result|1,0,3` — so hovering either
      marks both, and the value that just moved is highlighted in both without
      the two ever being asked to agree about anything but that string.

   2. `--c-group-a` AND `--c-empirical` ARE THE SAME BLUE in tokens.css, by
      design there ("Group A deliberately shares its hue with --c-empirical").
      So the tensor read and the result built wear one colour, and the legend
      names it once — naming one colour twice to say two things is the fault
      `gradients` records, not a second application of it. What separates the
      two on screen is position, the arrow between them, and the shape printed
      under each. The SECOND operand is where colour is doing work, and it
      takes `--c-group-b`.

   3. `normalize` IS A SEGMENTED OFF/ON, NOT A `gate`, though the entry in
      docs/catalogue.md calls it a gate. Core's gate is widget-wide: it hides
      the whole drive row while shut, on every tab, so declaring one here would
      take Step and Play off Shape, Broadcast and Multiply as well. The
      segmented Off/On named for what it shows is the arc's settled reveal
      pattern anyway (3.4j's amendment), and it keeps `?normalize=1` readable.

   4. THE HOVER IS AN INSPECTOR AND LIVES IN THE READOUT, which core does not
      hand a pointer. `draw` runs immediately before `readout` in core's paint,
      so the hovered cell resolved during the draw is still current one line
      later; it is stashed in `hovered` below rather than reaching for a core
      change. Nothing lives only on hover — every cell carries its value on the
      canvas, and with no pointer the tile reports the cell the last step
      touched.

   5. ONE GEOMETRY, TWO READERS (5.8). Each tab builds a PLAN — a list of cell
      boxes, texts, arrows and frames in drawing coordinates — and the renderer
      and the hit-test both read it. A hover that lit the wrong cell would be
      worse than no hover, and a second copy of the layout is how that happens.

   6. NO SEED AND NO RANDOMNESS. Every tensor is the lesson's own and every
      result is exact, so `compute` takes no draws; `_lab/tensor-verify.mjs`
      asserts the arithmetic in node.

   ROUND 5 (2026-09-08) — THE TOPIC RAIL IN TWO ROWS, A BASICS TOPIC, AND JOIN
   ON ITS OWN. `_lab/tensor-basics.html` drew three rails at the real 300px and
   the Basics stage; Kenneth picked the two-row rail and the stage as mocked.

  11. THE SIX TOPICS ARE TWO CAPTIONED ROWS, not one row of six. At 300px a row
      of six gives each button 50px, where "Broadcast" and "Multiply" truncate;
      and the two rows are the division the material already has — three topics
      about what a tensor IS, three about arithmetic on two of them (3.4g).

  12. JOIN IS A TOPIC, NOT TWO MORE OPERATIONS. `cat` and `stack` were options
      of the Shape control, grouped under a caption naming the second tensor.
      What they teach is that second tensor, and a topic can say so with its own
      control, its own captions and its own legend entry; a group caption on a
      seven-option control was saying it in the one place a reader looks last.
      The STAGE is unchanged and deliberately so: `compute` hands Join the same
      `kind: "shape"` state, so both topics draw through `planShape` and there is
      still exactly one drawing of a tensor moving into a result (5.8).

  13. BASICS DECLINES STEP AND PLAY (4.5), through `units: 0` rather than
      `stepLabel: null`: core reads that once when the shell is built, so it
      would take the buttons off all six topics. The index controls are the
      interaction, and `speed` is off this topic for the same reason — a pace
      for something that does not move is a control with no idea in it (3.5).

  14. THE LAST DIMENSION HAS ITS OWN INDEX CONTROL. A segmented control's
      options are fixed when the widget is declared; a dimension's size is not.
      Dim 0 is 5 wide at rank 1 and 2 wide at every other rank, so one control
      per dimension number would offer indices the tensor on screen does not
      have. What is constant across all four ranks is that the LAST dimension is
      the feature dimension and is five wide — so `i0`, `i1` and `i2` take the
      leading dimensions with `:` 0 1, and `feature` takes the last with
      `:` 0-4, and every option a reader can press is one the tensor has.

   ROUND 7 (2026-09-08) — THE BASICS STAGE AS FOUR NAMED REGIONS, THE INDEX
   EXPRESSION AS ONE RAIL ROW AND AS THE FIGURE ITSELF, AND RANK 4 IN THE STACK
   VIEW AS THE LESSON'S OWN COLUMN. Kenneth's second look found the stage
   cluttered, the index control cumbersome, and the two views alike at rank 4;
   `_lab/tensor-basics2.html` researched and drew every option and he picked
   B, b + c, and b.

  15. THE BASICS STAGE IS A 2 x 2 OF NAMED REGIONS: the tensor above and the
      selection below, drawn on the left and printed on the right. What that
      buys is the second row — the selection is DRAWN as the sub-tensor it
      makes, with its own edge indices, its own roles line and its own shape, so
      "a colon keeps the dimension" is a picture and not a sentence. The lit
      cells in the top row are those same cells, so the reader watches them
      become the row below. The Basics section carries the rest.

  16. THE FOUR INDEX SLOTS SIT SIDE BY SIDE, in the order they take inside
      `T[ … ]`, through `row` (3.4i). Two rows, not one: `.w-field-row` splits
      the rail evenly and `feature` has six options where the leading dimensions
      have three. Measured in the browser: the rail is 300px and the row gap
      12px, so three slots take 92px each and four would take 66 — six options
      in 66px is 11px a button where a digit and its padding need about 20, and
      every one of them truncates. The leading dimensions share `index-a` and
      the feature dimension takes `index-b`, which at rank 4 gives 30px buttons
      on the first row and 49px on the second, nothing clipped. The live expression is NOT in the rail —
      `readback` is a fixed case table and a `detail` is a string fixed at
      declaration, so it would take a core change; it titles two of the four
      regions and fills the readout's Selection tile instead.

  17. THE INDEX LABELS ON THE FIGURE ARE CONTROLS (3.6). Every frame label, row
      index and column index the drawing writes sets the dimension it names, and
      pressing the one already chosen returns that slot to a colon. Each sits on
      a small plate, because a lecture screen has no pointer and core's cursor
      is the only other thing that says a figure can be pressed. CELLS ARE NOT
      TARGETS: a cell carries a full index, so one click would write two or
      three parameters, which core refuses. The stack view offers dim 0 alone —
      the row and column indices belong to the frames view — and the caption
      under the figure says which of the two is on screen.

  18. RANK 4 IN THE STACK VIEW IS A COLUMN OF EXPLODED STACKS, no frames, one
      dashed arrow down the left for dim 0 and the dim-1 diagonal drawn once on
      the first stack. It replaces a row of FRAMED stacks, which drew the
      leading dimension the frames way in BOTH views and left the two differing
      by a diagonal. Used wherever a rank-4 tensor is drawn in the stack view —
      Basics at rank 4, Shape's `unsqueeze(0)` and Join's `stack`.

  19. THE STAGE IS 38px TALLER AGAIN, 524 -> 562 at the 550px width and
      560 -> 598 at 770, and rank 4 with every slot a colon is why: the
      selection is then the whole tensor, so a [2, 2, 2, 5] is drawn twice, one
      above the other, each with its print beside it. At 524 the fit fell to a
      14px cell and the last caption still ran off the foot. 562 gives 18px
      cells in both views. `_lab/tensor-sweep.html` measures every state's cell
      size, region rectangles, text extents and region map at both widths.

  20. ROUND 8 (Kenneth, 2026-09-09) UNDID 16 AND 19 ON BASICS. The 2 x 2 of
      regions over a fixed height wasted most of the stage at every rank but
      4, crowded the roles line against the drawing, and had no row headers;
      the index control never became the expression he had picked. Now: two
      NAMED BANDS, Tensor and Index, each as tall as its content, drawing left
      of a hairline and print right of it, the expression on the Index band's
      header, 18px under each drawing; the whole-tensor state is a one-line
      Index band. So `height` is a function of the parameters on Basics
      (bayesian's precedent) — 302 at rank 1, 359-416 at rank 3, 576 at rank 4
      — and `basicsGeometry` is the one function `height` and `draw` both ask.
      The index is core's new `expr` entry — `T[ : , 0 , : ]` as one line, a
      <select> per hidden slot parameter — added to controls.js/params.js/
      tokens.css for this and gated on a full fingerprint run.

  21. ROUND 9: COLOUR, TYPE AND MOTION, each measured first (`_lab/tensor-look.html`).
      Text on a wash clears 10:1 in both themes; the one text under the 4.5:1
      floor was ink-3 (moved values, print brackets) — now ink-2. The selection
      is wash .50 with a BOLD digit, so it differs from a plain cell in
      lightness and weight, not hue alone. Each dimension has a hue
      (`--c-dim-a..d`, new in tokens.css) on its frame, its edge rule, its
      arrow and a swatch before its role — never on text. Every canvas string
      is one size up (digits scale with the cell) because a 1080p projector
      shows the 550px stage at ~1.4x and 11px text projected to 1.4% of the
      screen height. Two eases on Basics, 4.4's one allowed case: Stack <->
      Frames moves the same cells (object constancy), and an index change is
      STAGED — light, then glide — per Heer & Robertson 2007.
   ========================================================================= */

import { defineWidget, readTokens } from "../core/index.js";
import * as M from "./model.js";

/* A canvas of this module's own, for the one measurement `regions` needs and
   core does not hand it: `measureText` reads the font and ignores the
   transform, so this gives the same character width the figure was laid out
   with. Created once, on first use, and never painted. */
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  return measureCanvas;
}

/* `tokens.css` has --font-mono but `readTokens` does not carry it — the same
   gap `probability-mechanisms` names. Read off the same custom property rather
   than written out here, so tokens.css stays the single source. */
const MONO = getComputedStyle(document.documentElement)
  .getPropertyValue("--font-mono").trim() || "monospace";

/* --- geometry ------------------------------------------------------------- */

const PAD = 14;
const FRAME_PAD = 7;      // inside a dashed frame round a stacked tensor
const OP_W = 26;          // the +, @, − , ÷ and = between two operands
const GAP = 22;           // between two operands, and between two frames
const INNER_GAP = 12;     // between two frames that sit inside a third

/* The exploded stack (candidate B): each slab steps right by a fraction of a
   cell and down by its own height, so no slab covers any part of another. */
const SLAB_DX = 1.35;
const SLAB_GAP = 8;
const SLAB_LBL = 20;      // the `[i]` written to the left of each slab
const COLUMN_GAP = 16;    // between two exploded stacks of a rank-4 column

/* The framed view (candidate D): a dashed frame per index of the leading
   dimension, and the row and column indices on the edges of the first grid. */
const FRAME_LBL = 15;     // the `dim 0 = i` line inside a frame, along its top
const IDX_ROW = 15;       // the column indices above the first grid
const IDX_COL = 18;       // the row indices to the left of the first grid

/* The printed tensor, in the mono font beside its drawing. */
const PRINT_GAP = 18;     // between a drawing and the print of it
const PRINT_DROP = 8;     // between a drawing and a print that sits under it
const PRINT_LH = 15;      // one printed line

/* The dimension arrows on the source tensor need room outside the grids: the
   width arrow above, the height arrow and its role name to the right, the
   leading dimension's dashed arrow and name to the left and below. */
const ROLE_TOP = 18;
const ROLE_RIGHT = 78;
const ROLE_LEFT = 14;
const ROLE_BOTTOM = 16;

const ARROW_H = 30;       // between the source block and the result block

/* THE CELL SIZE IS SET BY THE WIDEST THING BROADCAST, MULTIPLY AND REDUCE
   DRAW, and it is the same on those three so a cell means one thing across
   them. Floored at 20 so the numbers stay legible, capped at 30 so a wide
   frame does not turn a tensor into wallpaper. The Shape tab fits its own
   cell from this as a ceiling — see `shapeFit` and decision 8. */
const cellSize = (w) => Math.max(20, Math.min(30, Math.floor((w - 2 * PAD) / 20)));
const CELL_MIN = 14;      // below this two digits no longer fit a cell
const CELL_OK = 18;       // a cell worth shrinking to, to keep a print beside

/* --- motion on the Basics stage (4.4) --------------------------------------- *
 * Two eases, both between two readings of the SAME tensor, which is the one
 * case 4.4 allows. Stack <-> Frames moves the same twenty cells to new places,
 * so they travel (object constancy: Heer & Robertson 2007) rather than jump.
 * An index change is STAGED: the selection lights first, then copies of the
 * lit cells glide into the Index band and settle as the sub-tensor — two
 * ideas, one after the other. Durations at the Material / NN/g standard;
 * `prefers-reduced-motion` makes both a jump. Picked in `_lab/tensor-look.html`.
 */
const MORPH_MS = 300;
const LIGHT_MS = 150;
const GLIDE_MS = 300;
const easeOut = (t) => 1 - (1 - t) ** 3;
const c01 = (v) => Math.max(0, Math.min(1, v));
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ROUND 7: BASICS AT RANK 4 IS NOW THE TALLEST TOPIC, and the 2 x 2 of regions
   is why. With every slot a colon the selection IS the tensor, so the stage
   draws a [2, 2, 2, 5] twice, one above the other, each with its print beside
   it. At 524 — the height the printed text won in round 3 — the fit fell all
   the way to a 14px cell and the last caption still ran off the foot. 562 is
   the height that gives rank 4 an 18px cell in the frames view, which is the
   binding one; the stack view's column of exploded stacks fits at 549.
   Measured in `_lab/tensor-sweep.html` at both widths. The other five topics
   carry the extra space under Kenneth's one-height call, and the Shape and
   Join tabs spend it: their rank-4 results are drawn as that same column. */
const stageHeight = (w) => 9 * cellSize(w) + 328;

const CAPTION_H = 17;
const SHAPE_CAPTIONS = 3;

/* THE FRAME IS FIXED BY THE TALLEST TAB, so the three shorter ones would sit
   against its top edge with a third of the stage blank under them. Each block
   is centred instead, in the band between the panel labels' headroom and the
   captions pinned to the foot. `blockH` is measured from the first grid's top
   edge down to the last line under it. */
const blockTop = (h, blockH, capLines, headroom = 20) =>
  Math.round(PAD + headroom
    + Math.max(0, (h - 2 * PAD - capLines * CAPTION_H - headroom - blockH) / 2));

/* --- primitives ----------------------------------------------------------- */

function txt(ctx, colors, s, x, y, opts = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "",
  } = opts;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? MONO : colors.font}`.trim();
  ctx.fillText(s, x, y);
}

function arrow(ctx, x0, y0, x1, y1, color, width = 1.5, dash = []) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 7 * Math.cos(a - 0.45), y1 - 7 * Math.sin(a - 0.45));
  ctx.lineTo(x1 - 7 * Math.cos(a + 0.45), y1 - 7 * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/* Cell fills are translucent washes, and a stacked slab has to cover the one
   behind it — numbers included. So every cell gets an OPAQUE surface base
   before its wash, which the mock-up learned by drawing 16-19 through 2-5. */
const WASH = 0.20;
const FAINT = 0.42;       // the stretched copies a broadcast adds

/* --- the plan: cell boxes, texts, arrows, frames -------------------------- *
 * One list per paint, read by `paintPlan` and by `hitPlan`. A box's `cell(r,c)`
 * returns null where the box paints nothing, so two boxes may share a rect —
 * which is how a broadcast draws b's own values solid and its stretched copies
 * faint over the same five columns.                                          */

/* `bands` are the named strips of the Basics stage — a filled rectangle with a
   header carrying its name and, for the Index band, the expression, and a
   hairline between its drawing and its print — painted under everything.
   `pills` are the small plates behind a clickable index, and `targets` is the
   SAME list of rectangles handed to core's region map, so a target cannot sit
   anywhere but under the label it belongs to (5.8). `mark` is how a drawing
   reports an index label it has just written: whoever set it decides whether
   that label is pressable. */
const newPlan = () => ({
  boxes: [], texts: [], arrows: [], frames: [], hotspots: [],
  bands: [], pills: [], targets: [], mark: null,
  /* round 9: a dimension's hue on a rule or a swatch (never on text); ghost
     cells in flight during an ease; a per-cell shift while a view morphs; and
     the alphas the two eases fade with */
  rules: [], swatches: [], ghosts: [], shift: null, frameAlpha: 1, fadeAlpha: 1, cellPos: null,
});

function pushGrid(plan, x, y, rows, cols, s, cell) {
  const box = { x, y, rows, cols, s, cell };
  plan.boxes.push(box);
  return { x, y, w: cols * s, h: rows * s };
}

function pushText(plan, s, x, y, opts) {
  plan.texts.push({ s, x, y, opts: opts ?? {} });
}

function pushArrow(plan, x0, y0, x1, y1, tone, width, dash) {
  plan.arrows.push({ x0, y0, x1, y1, tone, width, dash });
}

function pushFrame(plan, x, y, w, h, label, tone) {
  plan.frames.push({ x, y, w, h, label, tone });
}

/** A short rule in a dimension's hue along its edge indices. */
function pushRule(plan, x0, y0, x1, y1, tone) {
  plan.rules.push({ x0, y0, x1, y1, tone });
}

/** The roles line as swatch-and-word pairs: the hue on the swatch, the word
    in ink. Widths are measured on the paint context so the pairs abut. */
function pushRoles(plan, ctx, colors, roles, hues, x, y) {
  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.font}`;
  let cx = x;
  roles.forEach((role, k) => {
    plan.swatches.push({ x: cx, y: y - 9, s: 9, tone: hues[k] });
    pushText(plan, role, cx + 13, y, { color: colors.ink2 });
    cx += 13 + ctx.measureText(role).width + 16;
  });
  ctx.restore();
}

function pushBand(plan, x, y, w, h, title, expr, divX) {
  plan.bands.push({ x, y, w, h, title, expr, divX });
}

/** An index label a drawing has just written, offered as a click target. `dim`
    is the dimension the label indexes and `value` its position; the anchor is
    the text's own, so the plate and the target are laid out from where the
    label went rather than from a second copy of the geometry. */
function markIndex(plan, dim, value, anchor) {
  if (plan.mark) plan.mark(dim, value, anchor);
}

/* ONE NAME FOR ONE CELL, SO THE DRAWING AND THE PRINT CANNOT DISAGREE. A cell
   the Shape tab draws twice — once as a box and once as a number in the
   printed text — carries the same `key`, and hovering either marks both. Every
   other tab draws each cell once and gets a key made from where it sits. */
const cellKey = (d, bi, r, c) => d.key ?? `${bi}:${r}:${c}`;

function paintPlan(ctx, colors, plan, hover) {
  /* The named bands first, because everything else sits on them. Enclosure
     groups more strongly than nearness, so a stage carrying two things — the
     tensor, and what an index takes from it — gives each a strip and a name;
     the header strip is the darker surface so the name reads as a heading and
     not as one more line of the figure. */
  for (const r of plan.bands) {
    ctx.fillStyle = colors.surface2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = colors.surface3;
    ctx.fillRect(r.x, r.y, r.w, BAND_HEAD);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    txt(ctx, colors, r.title, r.x + 10, r.y + 15, { color: colors.ink1, size: colors.fsSm, weight: "600" });
    if (r.expr) {
      txt(ctx, colors, r.expr, r.x + r.w - 10, r.y + 15,
        { color: colors.highlight, size: colors.fsSm, mono: true, align: "right" });
    }
    if (r.divX != null) {
      ctx.beginPath();
      ctx.moveTo(r.divX + 0.5, r.y + BAND_HEAD);
      ctx.lineTo(r.divX + 0.5, r.y + r.h);
      ctx.stroke();
    }
  }
  /* The plate behind a clickable index. It is the only thing on the figure that
     says a label can be pressed; core supplies the pointer cursor, and a
     lecture screen has no pointer. */
  for (const p of plan.pills) {
    ctx.save();
    ctx.globalAlpha = p.on ? 0.28 : 1;
    ctx.fillStyle = p.on ? colors.highlight : colors.surface;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  for (const f of plan.frames) {
    ctx.save();
    ctx.globalAlpha = plan.frameAlpha;
    ctx.strokeStyle = f.tone ?? colors.ink3;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w, f.h);
    ctx.restore();
    if (f.label) txt(ctx, colors, f.label, f.x + 2, f.y - 5, { color: colors.ink3 });
  }
  for (const l of plan.rules) {
    ctx.strokeStyle = l.tone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x0, l.y0);
    ctx.lineTo(l.x1, l.y1);
    ctx.stroke();
  }
  for (const sw of plan.swatches) {
    ctx.fillStyle = sw.tone;
    ctx.fillRect(sw.x, sw.y, sw.s, sw.s);
  }
  for (const a of plan.arrows) {
    arrow(ctx, a.x0, a.y0, a.x1, a.y1, a.tone ?? colors.ink3, a.width ?? 1.5, a.dash ?? []);
  }
  plan.boxes.forEach((box, bi) => {
    for (let r = 0; r < box.rows; r += 1) {
      for (let c = 0; c < box.cols; c += 1) {
        const d = box.cell(r, c);
        if (!d) continue;
        const isHover = Boolean(hover) && hover.key === cellKey(d, bi, r, c);
        /* a cell in a view morph is drawn part of the way from where it was */
        const sh = plan.shift && d.morph ? plan.shift.get(d.key) : null;
        paintCell(ctx, colors, box.x + c * box.s + (sh ? sh[0] : 0),
          box.y + r * box.s + (sh ? sh[1] : 0), box.s, d, isHover);
      }
    }
  });
  for (const g of plan.ghosts) paintCell(ctx, colors, g.x, g.y, g.s, g.d, false);
  for (const t of plan.texts) {
    if (t.opts.fade) ctx.globalAlpha = plan.fadeAlpha;
    txt(ctx, colors, t.s, t.x, t.y, t.opts);
    ctx.globalAlpha = 1;
  }
}

function paintCell(ctx, colors, x, y, s, d, isHover) {
  const dim = d.faint ? FAINT : 1;
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, s, s);
  if (!d.empty) {
    ctx.globalAlpha = (d.alpha ?? WASH) * dim;
    ctx.fillStyle = d.fill ?? colors.surface2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = dim;
  ctx.strokeStyle = d.lit ? colors.highlight : isHover ? colors.ink1 : colors.ink3;
  ctx.lineWidth = d.lit ? 2 : isHover ? 1.6 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (d.v != null && !d.empty) {
    txt(ctx, colors, M.num(d.v), x + s / 2, y + s / 2 + 0.5, {
      color: d.ink ?? colors.ink1,
      align: "center",
      baseline: "middle",
      /* one step up from the first draft (round 9): a digit takes the largest
         size that keeps two of them off the cell's edge */
      size: s >= 28 ? colors.fsLg : s >= 22 ? colors.fsMd : colors.fsSm,
      weight: d.bold ? "700" : "",
    });
  }
  ctx.globalAlpha = 1;
}

/** The cell under the pointer, printed text first and then the last box, or
    null. The printed value is checked first because it is drawn over nothing
    and is the smaller target of the two. */
function hitPlan(plan, pointer) {
  if (!pointer) return null;
  for (const h of plan.hotspots) {
    if (pointer.x >= h.x && pointer.x <= h.x + h.w
      && pointer.y >= h.y && pointer.y <= h.y + h.h) return { key: h.key, text: h.name };
  }
  for (let bi = plan.boxes.length - 1; bi >= 0; bi -= 1) {
    const box = plan.boxes[bi];
    const c = Math.floor((pointer.x - box.x) / box.s);
    const r = Math.floor((pointer.y - box.y) / box.s);
    if (r < 0 || c < 0 || r >= box.rows || c >= box.cols) continue;
    const d = box.cell(r, c);
    if (!d || !d.name) continue;
    return { key: cellKey(d, bi, r, c), text: d.name };
  }
  return null;
}

/* --- shared pieces -------------------------------------------------------- */

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);

/** A panel's own caption: its symbol and its shape, in one mono line. */
const panelLine = (name, shape) => `${name}  ${M.shapeText(shape)}`;

function pushCaptions(plan, colors, lines, x, y) {
  lines.forEach((line, i) => {
    pushText(plan, line, x, y + i * CAPTION_H, { color: colors.ink2 });
  });
}

/* --- the Shape tab: one tensor, two drawings and a print ------------------ *
 * The `view` control switches between the two drawings `_lab/tensor-draw.html`
 * measured and Kenneth picked:
 *
 *   stack   the exploded stack — one grid per index of the leading dimension,
 *           spread up the diagonal far enough that no grid covers any part of
 *           another. Keeps the depth the lesson's own figures draw; costs a
 *           slab of height per index.
 *   frames  the grids side by side, each in a dashed frame named by its index
 *           of the leading dimension, with the row and column indices on the
 *           edges of the first grid, so T[1, 0, 2] reads off the figure with
 *           no pointer. Costs width, and two index gutters.
 *
 * Beside each drawing sits the same tensor as PyTorch prints it, and the two
 * are one figure: a value moving out of the source is highlighted in the
 * drawing and in the text at once, a value already moved goes pale in both,
 * and a value the walk has not reached is missing from both. That is what the
 * tab is for — a shape is a claim about brackets as much as about boxes.
 */

/* The mono font's character width, measured off the canvas and cached per
   size: the print is laid out by COLUMN, so every offset inside it is a
   multiple of this one number. */
let charW = 0;
let charWAt = "";
function monoChar(ctx, size) {
  if (charWAt !== size) {
    ctx.save();
    ctx.font = `${size} ${MONO}`;
    charW = ctx.measureText("0000000000").width / 10;
    ctx.restore();
    charWAt = size;
  }
  return charW;
}

/** `T  torch.Size([2, 2, 5])` — the line under a printed tensor. */
const printLabel = (name, shape) => `${name}  ${M.sizeText(shape)}`;

/** One hue per dimension, counted from the LAST backwards so the feature
    dimension keeps `--c-dim-d` at every rank. The hue goes on a frame, a rule
    along the edge indices, an arrow or a swatch — never on text (round 9). */
const dimHues = (colors, rank) => Array.from({ length: rank }, (_, k) => colors.dims[k + (4 - rank)]);

/* --- drawing one tensor --------------------------------------------------- *
 * Each of these returns `{ w, h, centre }`, where `centre` gives the middle of
 * the cell at an index. The animation's flying value reads `centre`, so it
 * cannot disagree with where the cell was drawn (5.8).                       */

/** A stack of slabs, spread up the diagonal so that none covers another.
    `gutter` gives room on the left for an `[i]` on every slab; inside a dashed
    frame there is none, so the frame's label carries the outer index and only
    the raised slabs are named, in the gap the step leaves above the slab in
    front — which is what the mock's rank-4 panel does. */
function pushStack(plan, colors, x, y, [d0, d1, d2], s, cell, gutter) {
  const dx = Math.round(SLAB_DX * s);
  const dy = d1 * s + SLAB_GAP;
  const gx = x + (gutter ? SLAB_LBL : 0);
  const front = y + (d0 - 1) * dy;
  for (let i = d0 - 1; i >= 0; i -= 1) {
    const sx = gx + i * dx;
    const sy = front - i * dy;
    pushGrid(plan, sx, sy, d1, d2, s, (r, c) => cell(i, r, c));
    if (gutter || i > 0) {
      /* Halfway down the slab's left edge, not at its top corner: the dim-0
         arrow climbs the diagonal through exactly that corner, and an arrow
         drawn through a label reads as a strike-through. */
      const anchor = { s: `[${i}]`, x: sx - 5, y: sy + (d1 * s) / 2 + 4, align: "right" };
      pushText(plan, anchor.s, anchor.x, anchor.y,
        { color: colors.ink3, align: "right", mono: true });
      /* Only a gutter'd stack names its leading dimension in full: inside a
         rank-4 column the slabs are dim 1, and the stack view offers dim 0. */
      if (gutter) markIndex(plan, 0, i, anchor);
    }
  }
  return {
    w: (gutter ? SLAB_LBL : 0) + (d0 - 1) * dx + d2 * s,
    h: (d0 - 1) * dy + d1 * s,
    centre: (i, r, c) => ({
      x: gx + i * dx + c * s + s / 2,
      y: front - i * dy + r * s + s / 2,
    }),
  };
}

/** How many frames fit in one row of `room` pixels, in equal rows. Never fewer
    than two: one frame a row would redraw the leading dimension as a column,
    which is the OTHER view's picture. */
function framesPerRow(d0, d2, s, room) {
  const step = d2 * s + 2 * FRAME_PAD + GAP;
  const fits = Math.max(2, Math.min(d0, Math.floor((room - IDX_COL + GAP) / step)));
  return Math.ceil(d0 / Math.ceil(d0 / fits));
}

/** Grids side by side, each framed and named by its index of the leading
    dimension, with the indices on the edges of the first grid. */
function pushFrames(plan, colors, x, y, [d0, d1, d2], s, cell, perRow) {
  const fw = d2 * s + 2 * FRAME_PAD;
  const fh = FRAME_LBL + d1 * s + 2 * FRAME_PAD;
  const cols = Math.min(d0, perRow);
  const rows = Math.ceil(d0 / cols);
  const x0 = x + IDX_COL;
  const y0 = y + IDX_ROW;
  const at = (i) => ({
    fx: x0 + (i % cols) * (fw + GAP),
    fy: y0 + Math.floor(i / cols) * (fh + INNER_GAP),
  });
  const hues = dimHues(colors, 3);
  pushRule(plan, x0 + FRAME_PAD, y0 - 1, x0 + FRAME_PAD + d2 * s, y0 - 1, hues[2]);
  pushRule(plan, x0 - 1, y0 + FRAME_LBL + FRAME_PAD, x0 - 1, y0 + FRAME_LBL + FRAME_PAD + d1 * s, hues[1]);
  for (let i = 0; i < d0; i += 1) {
    const { fx, fy } = at(i);
    pushFrame(plan, fx, fy, fw, fh, null, hues[0]);
    const anchor = { s: `dim 0 = ${i}`, x: fx + 4, y: fy + FRAME_LBL - 3, align: "left" };
    pushText(plan, anchor.s, anchor.x, anchor.y, { color: colors.ink3, mono: true });
    markIndex(plan, 0, i, anchor);
    pushGrid(plan, fx + FRAME_PAD, fy + FRAME_LBL + FRAME_PAD, d1, d2, s, (r, c) => cell(i, r, c));
  }
  for (let c = 0; c < d2; c += 1) {
    const anchor = { s: String(c), x: x0 + FRAME_PAD + c * s + s / 2, y: y0 - 4, align: "center" };
    pushText(plan, anchor.s, anchor.x, anchor.y,
      { color: colors.ink3, align: "center", mono: true });
    markIndex(plan, 2, c, anchor);
  }
  for (let r = 0; r < d1; r += 1) {
    const anchor = {
      s: String(r), x: x0 - 4, y: y0 + FRAME_LBL + FRAME_PAD + r * s + s / 2 + 4, align: "right",
    };
    pushText(plan, anchor.s, anchor.x, anchor.y,
      { color: colors.ink3, align: "right", mono: true });
    markIndex(plan, 1, r, anchor);
  }
  return {
    w: IDX_COL + cols * fw + (cols - 1) * GAP,
    h: IDX_ROW + rows * fh + (rows - 1) * INNER_GAP,
    centre: (i, r, c) => {
      const { fx, fy } = at(i);
      return { x: fx + FRAME_PAD + c * s + s / 2, y: fy + FRAME_LBL + FRAME_PAD + r * s + s / 2 };
    },
  };
}

/** A rank-4 tensor as a COLUMN of exploded stacks — one per index of the
    leading dimension, down the page, with no frames round them.

    ROUND 7: this replaces a row of FRAMED exploded stacks. The two views were
    drawing the leading dimension the same way — a dashed box per index — so at
    rank 4 they differed only by a diagonal, and Kenneth read them as the same
    picture. A column of stacks is the convention his own 4D and 5D figures use
    and it differs from the frames view in kind: depth and no boxes, against
    boxes and edge indices. */
function pushStackColumn(plan, colors, x, y, [d0, d1, d2, d3], s, cell) {
  const dx = Math.round(SLAB_DX * s);
  const dy = d2 * s + SLAB_GAP;
  const stackH = (d1 - 1) * dy + d2 * s;
  const stackW = (d1 - 1) * dx + d3 * s;
  const gx = x + SLAB_LBL;
  const parts = [];
  for (let f = 0; f < d0; f += 1) {
    const sy = y + f * (stackH + COLUMN_GAP);
    parts.push(pushStack(plan, colors, gx, sy, [d1, d2, d3], s,
      (i, r, c) => cell(f, i, r, c), false));
    /* `[f]` beside the FRONT slab, which `pushStack` puts at the bottom of the
       stack: it names the whole stack, where the `[i]` inside it names one
       slab. Halfway down that slab's left edge, clear of the diagonal. */
    const anchor = {
      s: `[${f}]`, x: gx - 5, y: sy + stackH - (d2 * s) / 2 + 4, align: "right",
    };
    pushText(plan, anchor.s, anchor.x, anchor.y,
      { color: colors.ink2, align: "right", mono: true });
    markIndex(plan, 0, f, anchor);
  }
  return {
    w: SLAB_LBL + stackW,
    h: d0 * stackH + (d0 - 1) * COLUMN_GAP,
    centre: (f, i, r, c) => parts[f].centre(i, r, c),
  };
}

/** A rank-4 tensor as frames within frames: the leading index down the page,
    the next across, and the last two the grid you read. */
function pushFrames4(plan, colors, x, y, [d0, d1, d2, d3], s, cell) {
  const iw = d3 * s + 2 * FRAME_PAD;
  const ih = FRAME_LBL + d2 * s + 2 * FRAME_PAD;
  const ow = d1 * iw + (d1 - 1) * INNER_GAP + 2 * FRAME_PAD;
  /* The column indices sit INSIDE the first outer frame, between its label and
     the inner frames, so there is no index row above the block to leave room
     for — unlike the rank-3 drawing, where they sit above the frames. ONLY THE
     FIRST outer frame carries them, so only the first is that much taller: the
     row was reserved in every frame until round 7 measured the stage. */
  const oh0 = FRAME_LBL + IDX_ROW + ih + FRAME_PAD;
  const ohN = FRAME_LBL + ih + FRAME_PAD;
  const x0 = x + IDX_COL;
  const y0 = y;
  const frameTop = (f) => y0 + (f === 0 ? 0 : oh0 + INNER_GAP + (f - 1) * (ohN + INNER_GAP));
  const inner = (f, j) => ({
    ix: x0 + FRAME_PAD + j * (iw + INNER_GAP),
    iy: frameTop(f) + FRAME_LBL + (f === 0 ? IDX_ROW : 0),
  });
  const hues = dimHues(colors, 4);
  for (let f = 0; f < d0; f += 1) {
    const oy = frameTop(f);
    const oh = f === 0 ? oh0 : ohN;
    pushFrame(plan, x0, oy, ow, oh, null, hues[0]);
    const outer = { s: `dim 0 = ${f}`, x: x0 + 4, y: oy + FRAME_LBL - 3, align: "left" };
    pushText(plan, outer.s, outer.x, outer.y, { color: colors.ink3, mono: true });
    markIndex(plan, 0, f, outer);
    for (let j = 0; j < d1; j += 1) {
      const { ix, iy } = inner(f, j);
      pushFrame(plan, ix, iy, iw, ih, null, hues[1]);
      const lbl = { s: `dim 1 = ${j}`, x: ix + 4, y: iy + FRAME_LBL - 3, align: "left" };
      pushText(plan, lbl.s, lbl.x, lbl.y, { color: colors.ink3, mono: true });
      markIndex(plan, 1, j, lbl);
      pushGrid(plan, ix + FRAME_PAD, iy + FRAME_LBL + FRAME_PAD, d2, d3, s,
        (r, c) => cell(f, j, r, c));
    }
  }
  const first = inner(0, 0);
  pushRule(plan, first.ix + FRAME_PAD, first.iy - 1, first.ix + FRAME_PAD + d3 * s, first.iy - 1, hues[3]);
  pushRule(plan, x0 - 1, first.iy + FRAME_LBL + FRAME_PAD, x0 - 1,
    first.iy + FRAME_LBL + FRAME_PAD + d2 * s, hues[2]);
  for (let c = 0; c < d3; c += 1) {
    const anchor = {
      s: String(c), x: first.ix + FRAME_PAD + c * s + s / 2, y: first.iy - 4, align: "center",
    };
    pushText(plan, anchor.s, anchor.x, anchor.y,
      { color: colors.ink3, align: "center", mono: true });
    markIndex(plan, 3, c, anchor);
  }
  for (let r = 0; r < d2; r += 1) {
    const anchor = {
      s: String(r), x: x0 - 4,
      y: first.iy + FRAME_LBL + FRAME_PAD + r * s + s / 2 + 4, align: "right",
    };
    pushText(plan, anchor.s, anchor.x, anchor.y,
      { color: colors.ink3, align: "right", mono: true });
    markIndex(plan, 2, r, anchor);
  }
  return {
    w: IDX_COL + ow,
    h: oh0 + (d0 - 1) * (ohN + INNER_GAP),
    centre: (f, j, r, c) => {
      const { ix, iy } = inner(f, j);
      return { x: ix + FRAME_PAD + c * s + s / 2, y: iy + FRAME_LBL + FRAME_PAD + r * s + s / 2 };
    },
  };
}

/** One tensor of any rank the Shape tab reaches, in the chosen view. `cell`
    takes a full index; ranks 1 and 2 are a plain grid in both views, because
    there is no leading dimension left to draw as anything else. */
function pushTensor(plan, colors, x, y, shape, s, view, cell, perRow, edges = false) {
  /* A scalar: the one cell an index with no colon left reaches. It has no
     dimensions, so it takes no view and no edge indices. */
  if (shape.length === 0) {
    pushGrid(plan, x, y, 1, 1, s, () => cell([]));
    return { w: s, h: s, centre: () => ({ x: x + s / 2, y: y + s / 2 }) };
  }
  if (shape.length <= 2) {
    const rows = shape.length === 1 ? 1 : shape[0];
    const cols = shape[shape.length - 1];
    /* The edge indices are the frames view's device brought down to a bare
       grid: at rank 1 and rank 2 the two views draw the same picture, and
       without them the reader has nothing to read an index off — or to press. */
    const gx = x + (edges && shape.length === 2 ? IDX_COL : 0);
    const gy = y + (edges ? IDX_ROW : 0);
    pushGrid(plan, gx, gy, rows, cols, s,
      (r, c) => cell(shape.length === 1 ? [c] : [r, c]));
    if (edges) {
      const hues = dimHues(colors, shape.length);
      pushRule(plan, gx, gy - 1, gx + cols * s, gy - 1, hues[shape.length - 1]);
      for (let c = 0; c < cols; c += 1) {
        const anchor = { s: String(c), x: gx + c * s + s / 2, y: gy - 4, align: "center" };
        pushText(plan, anchor.s, anchor.x, anchor.y,
          { color: colors.ink3, align: "center", mono: true });
        markIndex(plan, shape.length - 1, c, anchor);
      }
      if (shape.length === 2) {
        pushRule(plan, gx - 1, gy, gx - 1, gy + rows * s, hues[0]);
        for (let r = 0; r < rows; r += 1) {
          const anchor = { s: String(r), x: gx - 4, y: gy + r * s + s / 2 + 4, align: "right" };
          pushText(plan, anchor.s, anchor.x, anchor.y,
            { color: colors.ink3, align: "right", mono: true });
          markIndex(plan, 0, r, anchor);
        }
      }
    }
    return {
      w: (gx - x) + cols * s,
      h: (gy - y) + rows * s,
      centre: (idx) => ({
        x: gx + idx[idx.length - 1] * s + s / 2,
        y: gy + (shape.length === 1 ? 0 : idx[0]) * s + s / 2,
      }),
    };
  }
  if (shape.length === 3) {
    const box = view === "stack"
      ? pushStack(plan, colors, x, y, shape, s, (i, r, c) => cell([i, r, c]), true)
      : pushFrames(plan, colors, x, y, shape, s, (i, r, c) => cell([i, r, c]), perRow);
    return { w: box.w, h: box.h, centre: (idx) => box.centre(idx[0], idx[1], idx[2]) };
  }
  const box = view === "stack"
    ? pushStackColumn(plan, colors, x, y, shape, s, (f, i, r, c) => cell([f, i, r, c]))
    : pushFrames4(plan, colors, x, y, shape, s, (f, i, r, c) => cell([f, i, r, c]));
  return { w: box.w, h: box.h, centre: (idx) => box.centre(idx[0], idx[1], idx[2], idx[3]) };
}

/* The margins the dimension arrows need outside the grids, per view and per
   rank. Only the FIRST source tensor carries them: a result with the same
   arrows on it would say the roles survive a permute, and they do not.

   RANK 4 FRAMES GET NO ARROWS, and the roles go on one line under the drawing
   instead. Four arrows round frames within frames leaves nothing legible at
   550px, and the leading two dimensions are already named on the frames
   themselves — which is exactly how `_lab/tensor-basics.html` drew it.

   ROUND 7: `arrows` is a caller's choice, because the Basics topic drops them
   in the frames view. There the edge indices already run along the first grid
   and a roles line sits under the drawing, so an arrow per dimension is a third
   naming of the same three facts — and the stage has four regions to fit. */
/* The stacked view's left margin holds the dim-0 arrow, and the arrow climbs
   the same diagonal the slabs step along — so it is exactly one slab step wide,
   and it has to clear the `[i]` gutter or it strikes through the labels. */
const NONE = { top: 0, left: 0, right: 0, bottom: 0 };
const DOWN_ARROW = 16;    // the lane a rank-4 column's dim-0 arrow runs down

const roleMargin = (view, s, rank, arrows, rolesLine) => {
  if (!arrows) return rolesLine && rank === 4 ? { ...NONE, bottom: ROLE_BOTTOM } : NONE;
  if (rank === 1) return { top: ROLE_TOP, left: 0, right: 0, bottom: 0 };
  if (rank === 2) return { top: ROLE_TOP, left: ROLE_LEFT, right: 0, bottom: ROLE_BOTTOM };
  if (rank === 4) {
    /* The column of stacks carries two arrows — dim 0 down its left, dim 1 up
       the first stack's diagonal — and the grid's own two dimensions are named
       by the roles line under it. Frames within frames carry none. */
    return view === "stack"
      ? { top: ROLE_TOP, left: DOWN_ARROW, right: 0, bottom: rolesLine ? ROLE_BOTTOM : 0 }
      : { ...NONE, bottom: rolesLine ? ROLE_BOTTOM : 0 };
  }
  return view === "stack"
    ? { top: ROLE_TOP, left: Math.round(SLAB_DX * s) + ROLE_LEFT, right: ROLE_RIGHT, bottom: ROLE_BOTTOM }
    : { top: 28, left: 14, right: 0, bottom: 22 };
};

/** A tensor with its dimensions named by index and role. Rank 3 is the Shape
    topic's source, and the Basics topic passes the shape and roles of whatever
    rank it is on. */
function pushSource(plan, colors, x, y, s, view, cell, perRow,
  shape = M.T3_SHAPE, roles = M.DIM_ROLES, opts = {}) {
  const { arrows = true, rolesLine = true, edges = false } = opts;
  const hues = dimHues(colors, shape.length);
  const m = roleMargin(view, s, shape.length, arrows, rolesLine);
  const box = pushTensor(plan, colors, x + m.left, y + m.top, shape, s, view, cell, perRow, edges);
  const half = s / 2;
  const size = { w: m.left + box.w + m.right, h: m.top + box.h + m.bottom, centre: box.centre };
  if (!arrows) {
    if (rolesLine && shape.length === 4) {
      pushText(plan, roles.join("  ·  "), x, y + m.top + box.h + 12, { color: colors.ink2 });
    }
    return size;
  }

  if (shape.length === 1) {
    const f = box.centre([0]);
    pushArrow(plan, f.x - half, f.y - half - 8, f.x - half + shape[0] * s, f.y - half - 8, hues[0]);
    pushText(plan, roles[0], f.x - half + (shape[0] * s) / 2, f.y - half - 13,
      { color: colors.ink2, align: "center" });
    return size;
  }
  if (shape.length === 2) {
    const f = box.centre([0, 0]);
    const gx = f.x - half;
    const gy = f.y - half;
    pushArrow(plan, gx, gy - 8, gx + shape[1] * s, gy - 8, hues[1]);
    pushText(plan, roles[1], gx + (shape[1] * s) / 2, gy - 13, { color: colors.ink2, align: "center" });
    pushArrow(plan, gx - 9, gy, gx - 9, gy + shape[0] * s, hues[0]);
    pushText(plan, roles[0], gx - ROLE_LEFT, gy + shape[0] * s + 13, { color: colors.ink2 });
    return size;
  }
  if (shape.length === 4) {
    if (view === "stack") {
      /* Dim 0 runs DOWN the page, one exploded stack per index, so its arrow
         runs down the left of the whole column with its name at the head.
         Dim 1 is the diagonal every stack steps along, drawn once on the first
         one — the same anchoring the rank-3 stack uses, so the two figures say
         the same thing about depth. */
      const first = box.centre([0, shape[1] - 1, 0, 0]);
      const last = box.centre([shape[0] - 1, 0, shape[2] - 1, 0]);
      const lane = x + 5;
      pushArrow(plan, lane, first.y - half - 4, lane, last.y + half + 4, hues[0], 1.5, [3, 3]);
      pushText(plan, roles[0], x, y + 8, { color: colors.ink2 });
      const front = box.centre([0, 0, 0, 0]);
      const gut = 12;
      pushArrow(plan, front.x - half - gut, front.y - half - 4,
        first.x - half - gut, first.y - half - 4, hues[1], 1.5, [3, 3]);
      /* Beside the arrow's HEAD, not its foot: the foot sits in the gutter the
         `[f]` labels use, and a role name right-aligned there runs off the
         left edge of the region. */
      pushText(plan, roles[1], first.x - half + 2, first.y - half - 6, { color: colors.ink2 });
    }
    if (rolesLine) {
      pushText(plan, roles.join("  ·  "), x, y + m.top + box.h + 12, { color: colors.ink2 });
    }
    return size;
  }

  const [d0, d1, d2] = shape;
  const back = box.centre([d0 - 1, 0, 0]);
  const first = box.centre([0, 0, 0]);

  if (view === "stack") {
    const bx = back.x - half;
    const by = back.y - half;
    pushArrow(plan, bx, by - 8, bx + d2 * s, by - 8, hues[2]);
    pushText(plan, roles[2], bx + (d2 * s) / 2, by - 13, { color: colors.ink2, align: "center" });
    pushArrow(plan, bx + d2 * s + 9, by, bx + d2 * s + 9, by + d1 * s, hues[1]);
    pushText(plan, roles[1], bx + d2 * s + 15, by + (d1 * s) / 2 + 4, { color: colors.ink2 });
    /* The dim-0 arrow is anchored to the slabs: it runs from beside the front
       slab's top-left corner to beside the back slab's, so it IS the step the
       slabs take, drawn once. A gutter of 12 keeps it clear of the `[1]` label
       at the back slab's mid-height, which a smaller gutter strikes through;
       an arrow drawn at the canvas edge (the first attempt) was parallel to
       the step but read as unrelated to it. */
    const gut = 12;
    const fx0 = first.x - half - gut;
    const fy0 = first.y - half - 4;
    pushArrow(plan, fx0, fy0, back.x - half - gut, back.y - half - 4, hues[0], 1.5, [3, 3]);
    pushText(plan, roles[0], fx0 - 4, fy0 + 8, { color: colors.ink2, align: "right" });
    return size;
  }
  const right = x + m.left + box.w;
  pushArrow(plan, x + m.left + IDX_COL, y + 11, right, y + 11, hues[0], 1.5, [3, 3]);
  pushText(plan, roles[0], right, y + 8, { color: colors.ink2, align: "right" });
  pushText(plan, roles[2], first.x - half + (d2 * s) / 2, y + 25,
    { color: colors.ink2, align: "center" });
  pushArrow(plan, x + 5, first.y - half, x + 5, first.y - half + d1 * s, hues[1]);
  pushText(plan, roles[1], x, first.y - half + d1 * s + 21, { color: colors.ink2 });
  return size;
}

/* --- the printed tensor --------------------------------------------------- */

/** The printed text, one segment at a time. `tone(idx)` returns how a value is
    drawn, or null for a value the walk has not placed yet — which prints as
    nothing, in a slot whose width was measured over every value, so the block
    never shifts under the reader. */
function pushPrint(plan, colors, x, y, print, cw, tone) {
  print.lines.forEach((segs, li) => {
    const ly = y + li * PRINT_LH;
    let col = 0;
    for (const seg of segs) {
      const sx = x + col * cw;
      col += seg.s.length;
      if (!seg.idx) {
        if (seg.s.trim()) {
          pushText(plan, seg.s, sx, ly,
            { color: colors.ink2, mono: true, size: colors.fsSm, baseline: "top", fade: tone.fade });
        }
        continue;
      }
      const t = tone(seg.idx);
      if (!t) continue;
      pushText(plan, seg.s, sx, ly,
        { color: t.color, mono: true, size: colors.fsSm, baseline: "top", fade: t.fade });
      plan.hotspots.push({
        x: sx, y: ly, w: seg.s.length * cw, h: PRINT_LH, key: t.key, name: t.name,
      });
    }
  });
}

/* --- fitting the Shape tab to the stage ----------------------------------- *
 * The print is what makes this a fit rather than a constant. A [2, 2, 5] print
 * is 32 mono columns wide and five lines deep; a [2, 2, 2, 5] print is 34 and
 * twelve. Whether that sits beside a drawing depends on how wide the drawing
 * is, which depends on the cell — so the cell is chosen last, as the largest
 * one from `cellSize(w)` down that leaves the whole block inside the stage.
 *
 * Beside is preferred: the point of the tab is that the two are one figure,
 * and a print under a drawing reads as a footnote. It is preferred down to
 * CELL_OK and no further, because a print beside a 15px cell has won the
 * argument and lost the figure.                                             */

function printOf(shape, valueAt, name, cw) {
  const print = M.torchPrint(shape, valueAt);
  const label = printLabel(name, shape);
  return {
    print,
    label,
    w: Math.max(print.cols, label.length) * cw,
    h: (print.lines.length + 1) * PRINT_LH,
  };
}

const beside = (d, p) => ({ w: d.w + PRINT_GAP + p.w, h: Math.max(d.h, p.h) });
const under = (d, p) => ({ w: Math.max(d.w, p.w), h: d.h + PRINT_DROP + p.h });

/** The drawn size of one tensor at cell `s`, measured by building it into a
    plan nobody paints — so the measurement and the drawing are one function. */
function drawnSize(colors, shape, s, view, perRow, source, roles, opts) {
  const probe = newPlan();
  const cell = () => ({ empty: true });
  return source
    ? pushSource(probe, colors, 0, 0, s, view, cell, perRow, shape, roles, opts)
    : pushTensor(probe, colors, 0, 0, shape, s, view, cell, perRow, opts?.edges);
}

/** The whole Shape block at cell `s`, with the print beside every drawing or
    under every drawing. Returns what it measures, plus the row heights the
    painter needs to stack the source tensors. */
function shapeBlock(colors, op, view, s, avail, prints, mode) {
  const place = mode === "beside" ? beside : under;
  const roomFor = (p) => (mode === "beside" ? avail - PRINT_GAP - p.w : avail);
  const perRow = framesPerRow(op.shape[0], op.shape[op.shape.length - 1], s, roomFor(prints.result));
  const srcRow = framesPerRow(M.T3_SHAPE[0], M.T3_SHAPE[2], s, roomFor(prints.sources[0]));
  /* THE SOURCE PAIR STACKS RATHER THAN SITTING SIDE BY SIDE, in both views.
     Two tensors and two prints in one row do not fit 550px in any view, and
     stacking them lets each print sit beside its own drawing instead of both
     dropping under a pair of drawings. */
  const rows = prints.sources.map((p, t) =>
    place(drawnSize(colors, M.T3_SHAPE, s, view, srcRow, t === 0), p));
  const src = {
    w: Math.max(...rows.map((r) => r.w)),
    h: rows.reduce((a, r) => a + r.h, 0) + (rows.length - 1) * INNER_GAP,
  };
  const out = place(drawnSize(colors, op.shape, s, view, perRow, false), prints.result);
  return {
    mode,
    perRow,
    srcRow,
    w: Math.max(src.w, out.w),
    h: src.h + ARROW_H + out.h,
    srcH: src.h,
    rowH: rows.map((r) => r.h),
  };
}

function shapeFit(colors, w, h, op, view, prints) {
  const avail = w - 2 * PAD;
  const room = h - 2 * PAD - SHAPE_CAPTIONS * CAPTION_H;
  const fits = (b) => b.w <= avail && b.h <= room;
  let dropped = null;    // the largest cell whose print sits UNDER its drawing
  let tight = null;      // the largest cell that keeps the print beside, below CELL_OK
  for (let s = cellSize(w); s >= CELL_MIN; s -= 1) {
    const aside = shapeBlock(colors, op, view, s, avail, prints, "beside");
    if (fits(aside)) {
      if (s >= CELL_OK) return { s, ...aside };
      if (!tight) tight = { s, ...aside };
    }
    if (!dropped) {
      const drop = shapeBlock(colors, op, view, s, avail, prints, "under");
      if (fits(drop)) dropped = { s, ...drop };
    }
  }
  return dropped ?? tight
    ?? { s: CELL_MIN, ...shapeBlock(colors, op, view, CELL_MIN, avail, prints, "under") };
}

/* --- the Shape tab -------------------------------------------------------- */

/**
 * Which move is where. `n` values are placed; while a step is in flight the
 * move at index `n` is between its source cell and its destination.
 */
function shapeStand(state, anim, speed) {
  const flying = anim.beat > 0 && anim.n < state.units && M.choreographs(speed);
  return {
    n: anim.n,
    flying,
    t: flying ? easeInOut(Math.min(1, anim.beat)) : 0,
    moving: flying ? state.moves[anim.n] : null,
    last: anim.n > 0 && !flying ? state.moves[anim.n - 1] : null,
  };
}

const SRC_NAMES = ["T", "T2"];

function planShape(ctx, colors, w, h, params, state, anim) {
  const plan = newPlan();
  const op = state.op;
  const view = params.view;
  const at = shapeStand(state, anim, params.speed);
  const cw = monoChar(ctx, colors.fsSm);
  const tensors = op.second ? [M.T3, M.T3B] : [M.T3];

  /* Where every value stands: consumed, just moved, in flight, or waiting. */
  const consumed = (k) => k < at.n || (at.flying && k === at.n);
  const moving = (k) => at.flying && k === at.n;
  const justMoved = (k) => Boolean(at.last) && k === at.n - 1;
  const flat = (t, [i, r, c]) => t * M.CELLS + i * 10 + r * 5 + c;

  const placed = new Map();
  for (let k = 0; k < at.n; k += 1) {
    const m = state.moves[k];
    placed.set(m.dst.join(","), { v: m.v, last: justMoved(k) });
  }
  const finalAt = new Map(state.moves.map((m) => [m.dst.join(","), m.v]));

  const srcKey = (t, idx) => `${SRC_NAMES[t]}|${idx.join(",")}`;
  const srcName = (t, idx, v) => `${M.indexText(SRC_NAMES[t], idx)} = ${v}`;
  const resKey = (idx) => `result|${idx.join(",")}`;
  const resName = (idx, v) => `${M.indexText("result", idx)} = ${v}`;

  /* The print's column width is measured over the FINISHED tensor, values not
     yet placed included, so nothing under a value shifts when it lands. */
  const prints = {
    sources: tensors.map((tensor, t) =>
      printOf(M.T3_SHAPE, ([i, r, c]) => tensor[i][r][c], SRC_NAMES[t], cw)),
    result: printOf(op.shape, (idx) => finalAt.get(idx.join(",")), "result", cw),
  };

  const fit = shapeFit(colors, w, h, op, view, prints);
  const s = fit.s;
  const x0 = centred(w, fit.w);
  const y0 = Math.round(PAD
    + Math.max(0, (h - 2 * PAD - SHAPE_CAPTIONS * CAPTION_H - fit.h) / 2));

  /* --- the source tensors, each with its own print ------------------------ */
  const srcCentres = [];
  let ty = y0;
  tensors.forEach((tensor, t) => {
    const cell = (idx) => {
      const [i, r, c] = idx;
      const k = flat(t, idx);
      const v = tensor[i][r][c];
      const face = moving(k) || justMoved(k)
        ? { fill: colors.highlight, alpha: 0.34, lit: true }
        : consumed(k)
          ? { fill: colors.surface, alpha: 0, ink: colors.ink2 }
          : { fill: t === 0 ? colors.groupA : colors.groupB };
      return { v, ...face, key: srcKey(t, idx), name: srcName(t, idx, v) };
    };
    const draw = t === 0
      ? pushSource(plan, colors, x0, ty, s, view, cell, fit.srcRow)
      : pushTensor(plan, colors, x0, ty, M.T3_SHAPE, s, view, cell, fit.srcRow);
    srcCentres.push(draw.centre);

    const p = prints.sources[t];
    const px = fit.mode === "beside" ? x0 + draw.w + PRINT_GAP : x0;
    const py = fit.mode === "beside" ? ty : ty + draw.h + PRINT_DROP;
    pushPrint(plan, colors, px, py, p.print, cw, (idx) => {
      const k = flat(t, idx);
      const [i, r, c] = idx;
      return {
        color: moving(k) || justMoved(k) ? colors.highlight
          : consumed(k) ? colors.ink3 : colors.ink1,
        key: srcKey(t, idx),
        name: srcName(t, idx, tensor[i][r][c]),
      };
    });
    pushText(plan, p.label, px, py + p.print.lines.length * PRINT_LH,
      { color: colors.ink2, mono: true, size: colors.fsSm, baseline: "top" });
    ty += fit.rowH[t] + INNER_GAP;
  });

  /* --- the result --------------------------------------------------------- */
  const resY = y0 + fit.srcH + ARROW_H;
  const resDraw = pushTensor(plan, colors, x0, resY, op.shape, s, view, (idx) => {
    const held = placed.get(idx.join(","));
    if (held) {
      const face = held.last
        ? { fill: colors.highlight, alpha: 0.34, lit: true }
        : { fill: colors.empirical };
      return { v: held.v, ...face, key: resKey(idx), name: resName(idx, held.v) };
    }
    if (at.moving && at.moving.dst.join(",") === idx.join(",")) return { empty: true, lit: true };
    return { empty: true };
  }, fit.perRow);

  const rp = prints.result;
  const rpx = fit.mode === "beside" ? x0 + resDraw.w + PRINT_GAP : x0;
  const rpy = fit.mode === "beside" ? resY : resY + resDraw.h + PRINT_DROP;
  pushPrint(plan, colors, rpx, rpy, rp.print, cw, (idx) => {
    const held = placed.get(idx.join(","));
    if (!held) return null;
    return {
      color: held.last ? colors.highlight : colors.ink1,
      key: resKey(idx),
      name: resName(idx, held.v),
    };
  });
  pushText(plan, rp.label, rpx, rpy + rp.print.lines.length * PRINT_LH,
    { color: colors.ink2, mono: true, size: colors.fsSm, baseline: "top" });

  /* The value in flight, between the cell it left and the cell it is going to
     — both read off the same `centre` the boxes were drawn from. */
  if (at.flying) {
    const from = srcCentres[at.moving.t](at.moving.src);
    const to = resDraw.centre(at.moving.dst);
    const cx = from.x + (to.x - from.x) * at.t;
    const cy = from.y + (to.y - from.y) * at.t;
    pushGrid(plan, cx - s / 2, cy - s / 2, 1, 1, s,
      () => ({ v: at.moving.v, fill: colors.highlight, alpha: 0.34, lit: true }));
  }

  pushArrow(plan, x0 + 9, resY - ARROW_H + 4, x0 + 9, resY - 6, colors.ink2, 2);
  pushCaptions(plan, colors, [op.caption, PRINT_RULE, FOURTH_DIM],
    PAD, h - PAD - 2 * CAPTION_H);
  return plan;
}

const PRINT_RULE =
  "The innermost brackets hold the rows, and each outer bracket is one more dimension.";
const FOURTH_DIM = "An image batch adds a fourth dimension: sample, channel, height, width.";

const centred = (w, width) => Math.round(PAD + (w - 2 * PAD - width) / 2);

/* --- the Basics topic ----------------------------------------------------- *
 * ROUND 7: THE STAGE IS A 2 x 2 OF NAMED REGIONS. Rows are the tensor and the
 * selection an index makes of it; columns are the drawing and the printed text.
 * The first draft put all four on one surface with captions under them, and
 * Kenneth read it as cluttered. Three things settled the rebuild:
 *
 *   - enclosure groups more strongly than nearness, so each representation
 *     gets a region and a name rather than a position;
 *   - the selection is DRAWN as the sub-tensor it makes, not only printed —
 *     which is how both of the widely read visual guides to arrays draw an
 *     index, and it is what makes "a colon keeps the dimension" a picture;
 *   - the cells the index selects stay lit in the top row, in the drawing and
 *     in the print, so the reader sees the lit cells become the row below.
 *
 * NOTHING MOVES, so there is no Step and no Play (4.5) — the index controls and
 * the index labels on the figure ARE the interaction. They are display
 * parameters: they change which cells are lit and what the selection prints,
 * never what the tensor holds (3.2).
 *
 * THE ROLES LINE IS UNDER THE DRAWING IN BOTH VIEWS, and in the stack view the
 * arrows name the dimensions as well. That repetition is deliberate: `view` is
 * a display parameter, and a region that changed height when it moved would
 * make the whole stage jump for a change that is meant to cost nothing.
 *
 * AT RANK 1 AND RANK 2 THERE ARE NO ARROWS IN EITHER VIEW. The two views draw
 * the same picture there — a bare grid — so arrows in one and not the other
 * would be a difference with nothing behind it; and the width arrow sat exactly
 * where the column indices go, which is what found this.
 */

/* --- the Basics tab --------------------------------------------------------- *
 * TWO NAMED BANDS, EACH AS TALL AS ITS CONTENT. Round 7 drew this stage as a
 * 2 × 2 of regions over a height fixed by rank 4, and at rank 3 each region
 * was two-thirds air; nothing on the stage said which row was the tensor and
 * which the index. Round 8 (Kenneth, 2026-09-09) is what this is: a TENSOR
 * band and an INDEX band, each a strip across the stage with its name at the
 * left and, on the Index band, the expression it evaluates at the right; the
 * drawing left of a hairline and the print right of it; the band as tall as
 * the taller of the two plus padding. The stage height therefore follows the
 * rank — `height` below is a function of the parameters, bayesian's
 * precedent — and `basicsGeometry` is the ONE function both `height` and
 * `draw` ask, so they cannot disagree (5.8).
 *
 * Enclosure groups more strongly than nearness (Gestalt common region), so
 * each representation has a region and a name; the highlight that lights one
 * value in the drawing and in the print is the link the split-attention
 * remedy asks for; and the selection is DRAWN as the sub-tensor it makes,
 * which is how both NumPy visual guides draw an index. `_lab/tensor-basics3.html`
 * is the mock this was picked from.                                           */
const BASICS_CAPTIONS = 1;
const BAND_GAP = 10;      // between the two bands
const BAND_PAD = 8;       // inside a band, round its content
const BAND_HEAD = 22;     // a band's header strip: its name, and the expression
const LINE_H = 14;        // a roles line, a torch.Size line, a caption inside a band
const UNDER_GAP = 18;     // between a drawing and the lines under it (12 crowded them)
const DIVIDER = 1;        // the hairline between drawing and print
const PILL_PAD = 3;       // round an index label that can be pressed
const PILL_H = 15;

/* "no colon", "1 index", "2 indices" — zero takes the singular noun, which is
   what "no colons" was getting wrong. */
const tally = (n, one, many) => `${n === 0 ? "no" : n} ${n <= 1 ? one : many}`;

const INDEX_RULE = "An index removes the dimension it names, and a colon keeps it.";
const WHOLE_LINE = "every slot is a colon: the selection is the whole tensor";

/** A printed tensor and the `torch.Size(...)` line under it. */
function basicsPrint(shape, valueAt, cw) {
  const print = M.torchPrint(shape, valueAt);
  const label = M.sizeText(shape);
  return {
    print,
    label,
    w: Math.max(print.cols, label.length) * cw,
    h: (print.lines.length + 1) * PRINT_LH,
  };
}

const andList = (xs) => (xs.length <= 1
  ? xs.join("")
  : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Which dimensions the indices removed, and the tally that removed them. */
const goneLine = (sel) => `${sel.gone.length === 1 ? "dim" : "dims"} ${andList(sel.gone)} `
  + `${sel.gone.length === 1 ? "is" : "are"} gone: `
  + `${tally(sel.fixed, "index", "indices")}, ${tally(sel.keep.length, "colon", "colons")}`;

/** What can be pressed, said on the figure, because a lecture screen has no
    pointer and core's cursor is the only other signal it has. */
const clickLine = (rank, view) => (rank >= 3 && view === "stack"
  ? "Click an index on the drawing to set dim 0, and again to return it to a colon."
  : "Click an index on the drawing to set that dimension, and again to return it to a colon.");

/**
 * The stage at one cell size. The print column is set by the widest printed
 * line and does not move with the cell; the drawing column is what is left,
 * and each band is as tall as the taller of its drawing and its print.
 */
function basicsLayout(colors, w, spec, sel, view, prints, s) {
  const { shape, roles } = spec;
  const colR = Math.ceil(Math.max(prints.tensor.w, prints.sel.w)) + 2 * BAND_PAD;
  const colL = w - 2 * PAD - DIVIDER - colR;
  const room = colL - 2 * BAND_PAD;

  const perRow = framesPerRow(shape[0], shape[shape.length - 1], s, room);
  const top = drawnSize(colors, shape, s, view, perRow, true, roles,
    { arrows: view === "stack" && shape.length >= 3, rolesLine: false, edges: true });

  const whole = sel.fixed === 0;
  const sub = sel.shape;
  const selPerRow = sub.length >= 3 ? framesPerRow(sub[0], sub[sub.length - 1], s, room) : 1;
  const bot = whole ? { w: 0, h: 0 }
    : drawnSize(colors, sub, s, view, selPerRow, false, null, { edges: true });

  /* Under the tensor: its roles and its size. Under the selection: the roles
     that survived (none, for a scalar), its size, and which dimensions went.
     The whole-tensor state does not draw the tensor a second time: one line. */
  const topH = BAND_HEAD + BAND_PAD + Math.max(top.h + UNDER_GAP + 2 * LINE_H, prints.tensor.h) + BAND_PAD;
  const botLines = (sel.keep.length > 0 ? 1 : 0) + 2;
  const botH = whole
    ? BAND_HEAD + BAND_PAD + LINE_H + BAND_PAD
    : BAND_HEAD + BAND_PAD + Math.max(bot.h + UNDER_GAP + botLines * LINE_H, prints.sel.h) + BAND_PAD;

  return {
    s, colL, colR, perRow, selPerRow, topH, botH, whole,
    height: PAD + topH + BAND_GAP + botH + 6 + BASICS_CAPTIONS * CAPTION_H + PAD,
    fits: top.w <= room && bot.w <= room,
  };
}

/** The largest cell whose drawings fit beside the print column. */
function basicsFit(colors, w, spec, sel, view, prints) {
  for (let s = cellSize(w); s >= CELL_MIN; s -= 1) {
    const L = basicsLayout(colors, w, spec, sel, view, prints, s);
    if (L.fits) return L;
  }
  return basicsLayout(colors, w, spec, sel, view, prints, CELL_MIN);
}

/** Everything the stage needs, from the parameters alone — so `height` can ask
    before there is a state, and `draw` asks the same function afterwards. */
function basicsGeometry(ctx, colors, w, params) {
  const spec = M.rankSpec(params.rank);
  const sel = M.selectionOf(params.rank, indexParts(params));
  const cw = monoChar(ctx, colors.fsSm);
  const prints = {
    tensor: basicsPrint(spec.shape, spec.at, cw),
    sel: basicsPrint(sel.shape, sel.at, cw),
  };
  return { spec, sel, cw, prints, fit: basicsFit(colors, w, spec, sel, params.view, prints) };
}

const basicsHeight = (w, params) => basicsGeometry(measureCtx(), readTokens(), w, params).fit.height;

/** Every index of a shape, in reading order; `[[]]` for a scalar. */
function allIndices(shape) {
  let out = [[]];
  for (const n of shape) out = out.flatMap((idx) => Array.from({ length: n }, (_, k) => [...idx, k]));
  return out;
}

function planBasics(ctx, colors, w, h, params, anim = null) {
  const plan = newPlan();
  const { spec, sel, cw, prints, fit } = basicsGeometry(ctx, colors, w, params);
  const { shape, roles, at } = spec;
  const rank = shape.length;
  const view = params.view;
  const s = fit.s;
  const hues = dimHues(colors, rank);

  /* The two eases, read off `anim` (4.4). A morph shifts every cell of the
     tensor from where the OTHER view drew it; an extraction lights the
     selection over LIGHT_MS and then glides copies of the lit cells into the
     Index band over GLIDE_MS, the sub-tensor and its print fading in as they
     land. Neither writes a parameter (invariant 1). */
  const morphE = anim?.morph ? easeInOut(anim.morph.t) : 1;
  const split = LIGHT_MS / (LIGHT_MS + GLIDE_MS);
  const lightP = anim?.extract ? c01(anim.extract.t / split) : 1;
  const glideE = anim?.extract ? easeOut(c01((anim.extract.t - split) / (1 - split))) : 1;

  const key = (idx) => `T|${idx.join(",")}`;
  const name = (idx) => `${M.indexText("T", idx)} = ${at(idx)}`;
  const lit = (idx) => sel.fixed > 0 && sel.selects(idx);

  const xL = PAD;
  const bandW = w - 2 * PAD;
  const xDiv = xL + fit.colL;
  const xR = xDiv + DIVIDER;
  const yT = PAD;
  const yB = yT + fit.topH + BAND_GAP;

  pushBand(plan, xL, yT, bandW, fit.topH, "Tensor", null, xDiv);
  pushBand(plan, xL, yB, bandW, fit.botH, "Index", sel.text, fit.whole ? null : xDiv);

  /* --- the tensor, drawn ------------------------------------------------- *
   * Every index label the drawing writes offers itself here, and this is the
   * only place that decides a label is pressable. Pressing the index already
   * chosen returns that slot to a colon, so one target both sets and clears.
   *
   * CELLS ARE NOT TARGETS. A cell carries a full index, so clicking one would
   * set every slot at once — two or three parameters in one transaction, which
   * core refuses and 3.6 explains: the click would be a different act from the
   * one a fingerprint state performs. */
  const parts = indexParts(params);
  const offered = M.indexTargets(rank, view).map((t) => t.dim);
  plan.mark = (dim, value, a) => {
    if (!offered.includes(dim)) return;
    const on = String(parts[dim] ?? M.COLON) === String(value);
    const wpx = a.s.length * cw;
    const left = a.align === "right" ? a.x - wpx : a.align === "center" ? a.x - wpx / 2 : a.x;
    const rect = {
      x: Math.round(left - PILL_PAD),
      y: Math.round(a.y - 11),
      w: Math.round(wpx + 2 * PILL_PAD),
      h: PILL_H,
    };
    plan.pills.push({ ...rect, on });
    plan.targets.push({
      ...rect,
      set: M.indexSet(rank, dim, value, parts),
      label: `${M.indexSlot(rank, dim)} = ${value}`,
    });
    /* The label itself goes to the highlight while its index is the chosen
       one. `markIndex` is called immediately after the `pushText` that wrote
       it, so the last text in the plan IS that label. */
    if (on) {
      const t = plan.texts[plan.texts.length - 1];
      t.opts = { ...t.opts, color: colors.highlight };
    }
  };

  const cx = xL + BAND_PAD;
  const cyT = yT + BAND_HEAD + BAND_PAD;
  const drawTop = pushSource(plan, colors, cx, cyT, s, view, (idx) => {
    const on = lit(idx);
    return {
      v: at(idx),
      fill: on ? colors.highlight : colors.groupA,
      /* round 9: the selection at .50 with a bold digit, so it differs from a
         plain cell in lightness and weight, not only in hue */
      alpha: on ? WASH + (0.50 - WASH) * lightP : undefined,
      lit: on,
      bold: on,
      morph: true,
      key: key(idx),
      name: name(idx),
    };
  }, fit.perRow, shape, roles, { arrows: view === "stack" && shape.length >= 3, rolesLine: false, edges: true });
  plan.mark = null;

  /* Where every cell of the tensor sits now — what a later morph starts from,
     and what an extraction's ghosts start from. */
  plan.cellPos = new Map();
  for (const idx of allIndices(shape)) plan.cellPos.set(key(idx), drawTop.centre(idx));
  if (anim?.morph?.from) {
    plan.shift = new Map();
    for (const [k, to] of plan.cellPos) {
      const from = anim.morph.from.get(k);
      if (from) plan.shift.set(k, [(from.x - to.x) * (1 - morphE), (from.y - to.y) * (1 - morphE)]);
    }
    plan.frameAlpha = morphE;
  }

  const ty = cyT + drawTop.h + UNDER_GAP;
  pushRoles(plan, ctx, colors, roles, hues, cx, ty);
  pushText(plan, prints.tensor.label, cx, ty + LINE_H, { color: colors.ink1, mono: true });

  /* --- the tensor, printed ----------------------------------------------- */
  const px = xR + BAND_PAD;
  pushPrint(plan, colors, px, cyT, prints.tensor.print, cw, (idx) => ({
    color: lit(idx) ? colors.highlight : colors.ink1,
    key: key(idx),
    name: name(idx),
  }));
  pushText(plan, prints.tensor.label, px, cyT + prints.tensor.print.lines.length * PRINT_LH,
    { color: colors.ink1, mono: true, baseline: "top" });

  /* --- the selection ----------------------------------------------------- */
  const cyB = yB + BAND_HEAD + BAND_PAD;
  if (fit.whole) {
    pushText(plan, WHOLE_LINE, cx, cyB + 11, { color: colors.ink2 });
  } else {
    /* Drawn as the sub-tensor it makes, keyed to the SAME cells as the tensor
       above, so hovering a value here marks it in both prints and in the
       tensor's drawing: all four name a cell by its full index (5.8). */
    const landed = glideE >= 1;
    const subCell = (sub) => {
      const idx = sel.full(sub);
      return {
        v: sel.at(sub),
        fill: colors.highlight,
        alpha: 0.50,
        lit: true,
        bold: true,
        key: key(idx),
        name: name(idx),
      };
    };
    const drawBot = pushTensor(plan, colors, cx, cyB, sel.shape, s, view,
      (sub) => (landed ? subCell(sub) : { empty: true }), fit.selPerRow, true);
    /* the copies in flight, from the lit cell in the tensor to its seat */
    if (!landed) {
      for (const sub of allIndices(sel.shape)) {
        const from = plan.cellPos.get(key(sel.full(sub)));
        const to = drawBot.centre(sub);
        if (!from) continue;
        plan.ghosts.push({
          x: from.x + (to.x - from.x) * glideE - s / 2,
          y: from.y + (to.y - from.y) * glideE - s / 2,
          s,
          d: subCell(sub),
        });
      }
      plan.fadeAlpha = glideE;
    }

    let by = cyB + drawBot.h + UNDER_GAP;
    if (sel.keep.length > 0) {
      pushRoles(plan, ctx, colors, sel.roles, sel.keep.map((k) => hues[k]), cx, by);
      by += LINE_H;
    }
    pushText(plan, prints.sel.label, cx, by, { color: colors.ink1, mono: true, fade: true });
    pushText(plan, goneLine(sel), cx, by + LINE_H, { color: colors.ink2, fade: true });

    pushPrint(plan, colors, px, cyB, prints.sel.print, cw, (sub) => {
      const idx = sel.full(sub);
      return { color: colors.highlight, key: key(idx), name: name(idx), fade: true };
    });
    pushText(plan, prints.sel.label, px, cyB + prints.sel.print.lines.length * PRINT_LH,
      { color: colors.ink1, mono: true, baseline: "top", fade: true });
  }

  pushCaptions(plan, colors, [clickLine(rank, view)], PAD, yB + fit.botH + 6 + 13);
  return plan;
}

/* --- the Broadcast tab ---------------------------------------------------- */

function planBroadcast(colors, w, h, params, state, anim) {
  const plan = newPlan();
  const s = cellSize(w);
  const bc = state.bc;
  const bp = state.plan;
  const rows = M.BC_X_SHAPE[0];
  const cols = M.BC_X_SHAPE[1];
  const xW = cols * s;
  /* A shape that combines occupies the whole footprint it stretches into; one
     that does not is drawn at its own size, because there is nothing to stretch
     it to. */
  const bW = bp.ok ? xW : bc.shape[bc.shape.length - 1] * s;
  const bRows = bp.ok ? rows : 1;
  const rW = bp.ok ? xW : ERROR_W;
  const sep = OP_W + GAP;

  const x0 = centred(w, xW + bW + rW + 2 * sep);
  const y0 = blockTop(h, rows * s + 69, 1);
  const mid = y0 + (rows * s) / 2 + 6;

  pushText(plan, panelLine("X", M.BC_X_SHAPE), x0, y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  pushGrid(plan, x0, y0, rows, cols, s, (r, c) => ({
    v: M.BC_X[r][c], fill: colors.groupA, name: `${M.indexText("X", [r, c])} = ${M.BC_X[r][c]}`,
  }));

  const bx = x0 + xW + sep;
  pushText(plan, "+", x0 + xW + sep / 2, mid,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  pushText(plan, panelLine("b", bc.shape), bx, y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  /* b's OWN values solid, its stretched copies faint, over the same rect: the
     stretch is the whole of what broadcasting does and it has to be visible as
     a copy rather than as a value b holds. */
  pushGrid(plan, bx, y0, bRows, Math.max(1, Math.round(bW / s)), s, (r, c) => (bc.real(r, c)
    ? { v: bc.at(r, c), fill: colors.groupB, name: M.bName(bc, r, c) }
    : null));
  /* A STRETCHED COPY IS HOVERABLE AND REPORTS b's OWN INDEX, which is the
     point of it: the copy at [1, 3] is still b[3], and saying so is what tells
     a reader the value was not stored twice. */
  if (bp.ok) {
    pushGrid(plan, bx, y0, rows, cols, s, (r, c) => (bc.real(r, c)
      ? null
      : { v: bc.at(r, c), fill: colors.groupB, faint: true, name: M.bName(bc, r, c) }));
  }

  const rx = bx + bW + sep;
  pushText(plan, "=", bx + bW + sep / 2, mid,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  if (bp.ok) {
    pushText(plan, panelLine("result", bp.shape), rx, y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    const done = anim.n;
    const rising = anim.beat > 0 && done < state.units ? anim.beat : 0;
    pushGrid(plan, rx, y0, rows, cols, s, (r, c) => {
      const v = bp.result[r][c];
      const name = `${M.indexText("result", [r, c])} = ${v}`;
      if (r < done) {
        return r === done - 1 && rising === 0
          ? { v, fill: colors.highlight, alpha: 0.34, lit: true, name }
          : { v, fill: colors.empirical, name };
      }
      if (r === done && rising > 0) {
        return { v, fill: colors.highlight, alpha: 0.34 * rising, lit: true };
      }
      return { empty: true };
    });
  } else {
    pushText(plan, `no result: ${bp.clash}`, rx, y0 + 16,
      { color: colors.extreme, size: colors.fsSm });
    pushText(plan, "cannot broadcast", rx, y0 + 34, { color: colors.extreme, size: colors.fsSm });
  }

  /* The alignment block, exactly as the lesson writes the rule: the two shapes
     right-aligned in mono, and each dimension's verdict beside them. */
  const ay = y0 + rows * s + 48;
  const xText = M.shapeText(M.BC_X_SHAPE);
  const bText = M.shapeText(bc.shape).padStart(xText.length, " ");
  pushText(plan, "Line the shapes up from the right", x0, ay - 16, { color: colors.ink3 });
  pushText(plan, xText, x0, ay, { color: colors.ink1, mono: true, size: colors.fsSm });
  pushText(plan, bText, x0, ay + 17, { color: colors.ink1, mono: true, size: colors.fsSm });
  bp.rows.forEach((row, i) => {
    pushText(plan, `dim ${row.dim} · ${row.x} against ${row.b}: ${row.verdict}`,
      x0 + 84, ay + i * 17, { color: row.verdict === "error" ? colors.extreme : colors.ink2, mono: true });
  });

  pushCaptions(plan, colors, [BC_RULE], PAD, h - PAD - CAPTION_H);
  return plan;
}

const ERROR_W = 150;   // the two lines a shape mismatch prints where a result would go
const BC_RULE = "A missing dimension counts as 1, and equal or 1 passes.";

/* --- the Multiply tab ----------------------------------------------------- */

function planMultiply(colors, w, h, params, state, anim) {
  const plan = newPlan();
  const s = cellSize(w);
  const mm = state.mm;
  const B = mm.matrix;
  const bRows = mm.shape[0];
  const bCols = mm.shape[1];

  const xW = M.MM_X_SHAPE[1] * s;
  const bW = bCols * s;
  const rW = mm.ok ? M.MM_Y_SHAPE[1] * s : ERROR_W;
  const sep = OP_W + GAP;
  const x0 = centred(w, xW + bW + rW + 2 * sep);
  const y0 = blockTop(h, Math.max(M.MM_X_SHAPE[0], bRows) * s + 34, 2);
  const mid = y0 + 1.5 * s + 6;
  /* The tallest operand is Wᵀ at four rows; the sum of products sits under all
     three so it clears whichever is taller. */
  const below = y0 + Math.max(M.MM_X_SHAPE[0], bRows) * s + 30;

  const rising = mm.ok && anim.beat > 0 && anim.n < state.units ? anim.beat : 0;
  const cur = mm.ok ? mmCurrent(anim, state, rising) : null;

  pushText(plan, panelLine("X", M.MM_X_SHAPE), x0, y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  pushGrid(plan, x0, y0, M.MM_X_SHAPE[0], M.MM_X_SHAPE[1], s, (r, c) => ({
    v: M.MM_X[r][c],
    fill: colors.groupA,
    lit: Boolean(cur) && r === cur.r,
    name: `${M.indexText("X", [r, c])} = ${M.MM_X[r][c]}`,
  }));

  const bx = x0 + xW + sep;
  pushText(plan, "@", x0 + xW + sep / 2, mid,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  pushText(plan, panelLine(mm.name, mm.shape), bx, y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  pushGrid(plan, bx, y0, bRows, bCols, s, (r, c) => ({
    v: B[r][c],
    fill: colors.groupB,
    lit: Boolean(cur) && c === cur.c,
    name: `${M.indexText(mm.name, [r, c])} = ${M.num(B[r][c])}`,
  }));

  const rx = bx + bW + sep;
  pushText(plan, "=", bx + bW + sep / 2, mid,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  if (mm.ok) {
    pushText(plan, panelLine("Y", M.MM_Y_SHAPE), rx, y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    pushGrid(plan, rx, y0, M.MM_Y_SHAPE[0], M.MM_Y_SHAPE[1], s, (r, c) => {
      const k = r * 2 + c;
      const v = M.MM_Y[r][c];
      const name = `${M.indexText("Y", [r, c])} = ${M.num(v)}`;
      if (k < anim.n) {
        return k === anim.n - 1 && rising === 0
          ? { v, fill: colors.highlight, alpha: 0.34, lit: true, name }
          : { v, fill: colors.empirical, name };
      }
      if (k === anim.n && rising > 0) return { v, fill: colors.highlight, alpha: 0.34 * rising, lit: true };
      return { empty: true };
    });
    if (cur) {
      const p = M.productTerms(cur.r, cur.c);
      pushText(plan, `${M.indexText("Y", [cur.r, cur.c])} = ${p.text}`, x0, below,
        { color: colors.highlight, mono: true, size: colors.fsSm });
    }
  } else {
    pushText(plan, `no product: ${mm.clash}`, rx, y0 + 16,
      { color: colors.extreme, size: colors.fsSm });
    pushText(plan, "inner dimensions must match", rx, y0 + 34,
      { color: colors.extreme, size: colors.fsSm });
    pushText(plan, `${M.shapeText(M.MM_X_SHAPE)} @ ${M.shapeText(mm.shape)}`, x0, below,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    plan.brackets = { x: x0, y: below + 6 };
  }

  pushCaptions(plan, colors, mm.ok ? MM_CAPTIONS : MM_FAIL_CAPTIONS, PAD, h - PAD - 2 * CAPTION_H);
  return plan;
}

const MM_CAPTIONS = [
  "Rows of X are data points and columns of Wᵀ are neurons.",
  "One cell is a dot product: the sum of products of a row and a column.",
];

/* A CAPTION HAS TO BE TRUE IN THE STATE THAT SHOWS IT (2.11), and neither line
   above is: this state draws no Wᵀ and computes no cell. */
const MM_FAIL_CAPTIONS = [
  "W holds one row per neuron, so its 2 meets the 4 of X on the inside.",
  "Transposing W puts the four inputs on the inside, where they match.",
];

/** The output cell a step is on, in reading order over the [3, 2] product. */
const cellAt = (k, units) => (k < 0 || k >= units ? null : { r: Math.floor(k / 2), c: k % 2 });

/* The cell the figure and the readout are both about: the one being computed
   while a step is in flight, and otherwise the one the last step produced. One
   rule, so the lit row and column cannot disagree with the printed sum (5.8). */
const mmCurrent = (anim, state, rising) =>
  cellAt(rising > 0 ? anim.n : anim.n - 1, state.units);

/* --- the Reduce tab ------------------------------------------------------- */

function planReduce(colors, w, h, params, state, anim) {
  const plan = newPlan();
  if (state.normalize) return planNormalize(plan, colors, w, h, state, anim);

  const s = cellSize(w);
  const dim = params.dim;
  const groups = state.groups;
  const values = state.values;
  const done = anim.n;
  const rising = anim.beat > 0 && done < state.units ? anim.beat : 0;
  const inGroup = (r, c) => {
    const g = groups[done];
    return rising > 0 && g ? g.cells.some(([gr, gc]) => gr === r && gc === c) : false;
  };
  const lastGroup = (r, c) => {
    const g = done > 0 && rising === 0 ? groups[done - 1] : null;
    return g ? g.cells.some(([gr, gc]) => gr === r && gc === c) : false;
  };

  const rowsX = 3;
  const y0 = blockTop(h, (dim === "1" ? rowsX * s + 22 : (rowsX + 1) * s + 56), 1);
  const xw = 4 * s;

  if (dim === "0") {
    const x0 = centred(w, xw);
    pushText(plan, panelLine("X", M.RED_X_SHAPE), x0, y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    pushGrid(plan, x0, y0, rowsX, 4, s, (r, c) => ({
      v: M.RED_X[r][c], fill: colors.groupA,
      lit: inGroup(r, c) || lastGroup(r, c),
      name: `X[${r}, ${c}] = ${M.RED_X[r][c]}`,
    }));
    for (let c = 0; c < 4; c += 1) {
      const on = c < done || (c === done && rising > 0);
      pushArrow(plan, x0 + c * s + s / 2, y0 + rowsX * s + 4, x0 + c * s + s / 2, y0 + rowsX * s + 26,
        c === done - 1 || (c === done && rising > 0) ? colors.highlight : on ? colors.ink2 : colors.ink3);
    }
    pushGrid(plan, x0, y0 + rowsX * s + 34, 1, 4, s, (r, c) => resultCell(colors, c, done, rising, values, "result"));
    pushText(plan, panelLine("result", M.reduceShape(dim)), x0, y0 + rowsX * s + 34 + s + 18,
      { color: colors.ink1, mono: true, size: colors.fsSm });
  } else if (dim === "1") {
    const total = xw + 40 + s;
    const x0 = centred(w, total);
    pushText(plan, panelLine("X", M.RED_X_SHAPE), x0, y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    pushGrid(plan, x0, y0, rowsX, 4, s, (r, c) => ({
      v: M.RED_X[r][c], fill: colors.groupA,
      lit: inGroup(r, c) || lastGroup(r, c),
      name: `X[${r}, ${c}] = ${M.RED_X[r][c]}`,
    }));
    for (let r = 0; r < rowsX; r += 1) {
      const on = r < done || (r === done && rising > 0);
      pushArrow(plan, x0 + xw + 6, y0 + r * s + s / 2, x0 + xw + 34, y0 + r * s + s / 2,
        r === done - 1 || (r === done && rising > 0) ? colors.highlight : on ? colors.ink2 : colors.ink3);
    }
    pushGrid(plan, x0 + xw + 40, y0, rowsX, 1, s, (r) => resultCell(colors, r, done, rising, values, "result"));
    pushText(plan, panelLine("result", M.reduceShape(dim)), x0 + xw + 40, y0 + rowsX * s + 18,
      { color: colors.ink1, mono: true, size: colors.fsSm });
  } else {
    const x0 = centred(w, xw);
    pushText(plan, panelLine("X", M.RED_X_SHAPE), x0, y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    pushGrid(plan, x0, y0, rowsX, 4, s, (r, c) => ({
      v: M.RED_X[r][c], fill: colors.groupA,
      lit: inGroup(r, c) || lastGroup(r, c),
      name: `X[${r}, ${c}] = ${M.RED_X[r][c]}`,
    }));
    pushArrow(plan, x0 + xw / 2, y0 + rowsX * s + 4, x0 + xw / 2, y0 + rowsX * s + 26,
      done > 0 || rising > 0 ? colors.highlight : colors.ink3);
    pushGrid(plan, x0 + xw / 2 - s / 2, y0 + rowsX * s + 34, 1, 1, s,
      () => resultCell(colors, 0, done, rising, values, "result"));
    pushText(plan, "result  []", x0 + xw / 2 - s / 2, y0 + rowsX * s + 34 + s + 18,
      { color: colors.ink1, mono: true, size: colors.fsSm });
  }

  pushCaptions(plan, colors, [RED_CAPTIONS[dim]], PAD, h - PAD - CAPTION_H);
  return plan;
}

const RED_CAPTIONS = {
  0: "The three rows collapse into one row of four: dim 0 is gone.",
  1: "The four columns collapse into one column of three: dim 1 is gone.",
  none: "With no dim named every dimension goes, and the result is a scalar.",
};

function resultCell(colors, k, done, rising, values, name) {
  const v = values[k];
  if (k < done) {
    return k === done - 1 && rising === 0
      ? { v, fill: colors.highlight, alpha: 0.34, lit: true, name: `${name}[${k}] = ${M.num(v)}` }
      : { v, fill: colors.empirical, name: `${name}[${k}] = ${M.num(v)}` };
  }
  if (k === done && rising > 0) return { v, fill: colors.highlight, alpha: 0.34 * rising, lit: true };
  return { empty: true };
}

/* (X − μ) / σ: a reduction and then a broadcast, the two previous tabs
   composed. μ and σ are both [4] and both mean and standard deviation are
   taken over dim 0, which is why the control is offered only there. One step
   still collapses one column, and fills that column of μ, of σ and of the
   result together. */
function planNormalize(plan, colors, w, h, state, anim) {
  /* FOUR GRIDS OF FOUR COLUMNS IN ONE ROW is the widest thing any tab draws
     after flatten, and at 550px the tab's own cell size overflows it by 38px.
     This one panel shrinks its cell rather than wrapping, because the row IS
     the sentence: X minus mu, divided by sigma, equals the result. */
  const sep = OP_W + GAP;
  const s = Math.min(cellSize(w), Math.floor((w - 2 * PAD - 3 * sep) / 16));
  const done = anim.n;
  const rising = anim.beat > 0 && done < state.units ? anim.beat : 0;
  const cw = 4 * s;
  const total = 4 * cw + 3 * sep;
  const x0 = centred(w, total);
  const y0 = blockTop(h, 3 * s + 4, 2);
  const col = (i) => x0 + i * (cw + sep);
  const has = (c) => c < done || (c === done && rising > 0);
  const alphaFor = (c) => (c === done && rising > 0 ? rising : 1);

  pushText(plan, panelLine("X", M.RED_X_SHAPE), col(0), y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  pushGrid(plan, col(0), y0, 3, 4, s, (r, c) => ({
    v: M.RED_X[r][c], fill: colors.groupA,
    lit: has(c) && (c === done || c === done - 1),
    name: `X[${r}, ${c}] = ${M.RED_X[r][c]}`,
  }));

  const band = (i, sym, vals, shape) => {
    pushText(plan, panelLine(sym, shape), col(i), y0 - 8,
      { color: colors.ink1, mono: true, size: colors.fsSm });
    pushGrid(plan, col(i), y0, 1, 4, s, (r, c) => (has(c)
      ? { v: vals[c], fill: colors.groupB, alpha: WASH * alphaFor(c), name: `${sym}[${c}] = ${M.num(vals[c])}` }
      : { empty: true }));
    pushGrid(plan, col(i), y0 + s, 2, 4, s, (r, c) => (has(c)
      ? { v: vals[c], fill: colors.groupB, faint: true, name: `${sym}[${c}] = ${M.num(vals[c])}` }
      : null));
  };
  pushText(plan, "−", col(0) + cw + sep / 2, y0 + 1.5 * s + 6,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  band(1, "μ", M.RED_MU, [4]);
  pushText(plan, "÷", col(1) + cw + sep / 2, y0 + 1.5 * s + 6,
    { color: colors.ink1, size: colors.fsLg, align: "center" });
  band(2, "σ", M.RED_SD, [4]);
  pushText(plan, "=", col(2) + cw + sep / 2, y0 + 1.5 * s + 6,
    { color: colors.ink1, size: colors.fsLg, align: "center" });

  pushText(plan, panelLine("result", M.RED_X_SHAPE), col(3), y0 - 8,
    { color: colors.ink1, mono: true, size: colors.fsSm });
  pushGrid(plan, col(3), y0, 3, 4, s, (r, c) => {
    if (!has(c)) return { empty: true };
    const v = M.RED_Z[r][c];
    return c === done - 1 || (c === done && rising > 0)
      ? { v, fill: colors.highlight, alpha: 0.34 * alphaFor(c), lit: true, name: `result[${r}, ${c}] = ${M.num(v)}` }
      : { v, fill: colors.empirical, name: `result[${r}, ${c}] = ${M.num(v)}` };
  });

  pushCaptions(plan, colors, NORM_CAPTIONS, PAD, h - PAD - 2 * CAPTION_H);
  return plan;
}

const NORM_CAPTIONS = [
  "μ and σ are [4], stretched back across the three rows.",
  "A reduction, and then a broadcast: σ is 1 in every column of this batch.",
];

/* --- the readout's cell tile ---------------------------------------------- *
 * Set during `draw`, read one line later by `readout` — core calls them in that
 * order on every paint. See decision 4 in the header. */
let hovered = null;

/* "1 of 1 groups collapsed" is the shape of sentence a progress note falls
   into, and the Reduce tab reaches it whenever dim is not named. */
const plural = (n, total, one, many) => `${n} of ${total} ${total === 1 ? one : many}`;

/* --- the widget ----------------------------------------------------------- */

const SPEEDS = [
  { value: "slow", label: "Slow", detail: "0.9 seconds a step, with each move drawn as it happens" },
  { value: "medium", label: "Medium", detail: "0.34 seconds a step, with each move drawn as it happens" },
  { value: "fast", label: "Fast", detail: "0.12 seconds a step, with each result appearing in place" },
];

const TAB_UNITS = {
  shape: "value", join: "value", broadcast: "row", multiply: "cell", reduce: "group",
};

/* The two halves the six topics fall into. Consecutive options sharing one of
   these form a row with the caption under it. */
const DATA_HALF = "tensors for data";
const ALGEBRA_HALF = "linear algebra";

/* Every leading dimension is 2 wide at every rank that has it, so one option
   list serves dim 0, dim 1 and dim 2 — see the comment on `i0`. */
const LEAD_INDEX = [
  { value: ":", label: ":", detail: "keeps every position of this dimension" },
  { value: "0", label: "0", detail: "the first position, which removes this dimension" },
  { value: "1", label: "1", detail: "the second position, which removes this dimension" },
];

/** The index entries in dimension order: the leading ones, then the last. */
const indexParts = (params) =>
  [params.i0, params.i1, params.i2].slice(0, Number(params.rank) - 1).concat(params.feature);

defineWidget({
  slug: "tensors",
  title: "Tensors",
  status: "draft",
  subtitle:
    "A tensor is an array with a shape, and the shape decides which values an "
    + "operation combines. An index and a reduction each remove the dimension "
    + "they name; reshaping keeps the reading order, and broadcasting stretches "
    + "a smaller shape.",
  layout: "side",
  /* A function of the WIDTH, because the cell size is: wider cells are taller
     cells, and the six rows of permute's result grow with them. One height for
     all four tabs, so the frame does not jump as the reader moves between them. */
  /* The Basics stage is as tall as its two bands, which depend on the rank,
     the view and the index — bayesian's precedent; every other tab shares one
     height (3.4). */
  height: ({ w, ...values }) => (values.tab === "basics" ? basicsHeight(w, values) : stageHeight(w)),

  /* Hovering any cell prints its index and value. An inspector, not a control:
     nothing is written and with no pointer the figure is exactly as before. */
  pointer: true,

  params: {
    /* TWO CAPTIONED ROWS, NOT ONE ROW OF SIX. Six topics in a 300px rail give
       each 50px, where "Broadcast" and "Multiply" truncate — measured at the
       real rail width in `_lab/tensor-basics.html`. The rows are also the
       division the material has: three topics are about what a tensor IS and
       three are arithmetic on two of them, and a reader wants that before
       choosing rather than after (3.4g). */
    tab: {
      type: "segmented",
      label: "Topic",
      detail: "six topics, each decided by the tensor's shape",
      options: [
        { value: "basics", label: "Basics", group: DATA_HALF, detail: "how many dimensions a tensor has, and what an index selects" },
        { value: "shape", label: "Shape", group: DATA_HALF, detail: "where each value goes when the shape changes" },
        { value: "join", label: "Join", group: DATA_HALF, detail: "two tensors joined along a dimension, or under a new one" },
        { value: "broadcast", label: "Broadcast", group: ALGEBRA_HALF, detail: "when a smaller shape is stretched to meet a larger one" },
        { value: "multiply", label: "Multiply", group: ALGEBRA_HALF, detail: "one cell of a matrix product as a sum of products" },
        { value: "reduce", label: "Reduce", group: ALGEBRA_HALF, detail: "which dimension a mean, a sum or a maximum removes" },
      ],
      default: "basics",
    },
    /* THE RANK IS A DATA PARAMETER: it changes which tensor is on screen, not
       how one tensor is drawn. Nothing on this topic animates, so nothing is
       discarded when it moves. */
    rank: {
      type: "segmented",
      label: "Dimensions",
      detail: "each step adds a dimension in front, or removes the first one",
      options: [
        { value: "1", label: "1", detail: "[5] — the five features of one sample" },
        { value: "2", label: "2", detail: "[2, 5] — two samples of five features" },
        { value: "3", label: "3", detail: "[2, 2, 5] — two samples, two sequence points, five features" },
        { value: "4", label: "4", detail: "[2, 2, 2, 5] — a batch holding two of those" },
      ],
      default: "3",
      when: { param: "tab", equals: "basics" },
    },
    /* TWO COLUMNS, NOT ONE ROW. Five calls in a 300px rail give each 56px and
       every label truncates to `resha…`, which puts the two reshapes five
       characters apart with the arguments — the thing that tells them apart —
       cut off. */
    op: {
      type: "segmented",
      style: "grid",
      label: "Operation",
      detail: "what is done to the [2, 2, 5] tensor",
      options: M.SHAPE_OPS.map((o) => ({
        value: o.value,
        label: o.label,
        span: o.span,
        detail: `${o.detail}. The result is ${M.shapeText(o.shape)}`,
      })),
      default: "reshape-2-10",
      when: { param: "tab", equals: "shape" },
    },
    join: {
      type: "segmented",
      label: "Operation",
      detail: "how the [2, 2, 5] tensor is combined with a second one holding 21–30",
      options: M.JOIN_OPS.map((o) => ({
        value: o.value,
        label: o.label,
        detail: `${o.detail}. The result is ${M.shapeText(o.shape)}`,
      })),
      default: "cat",
      when: { param: "tab", equals: "join" },
    },
    /* TWO DRAWINGS OF ONE TENSOR, and a display parameter because it changes
       only the layout: switching it keeps every value already moved (3.2). */
    view: {
      type: "segmented",
      label: "View",
      detail: "how the dimensions above the last two are laid out",
      options: [
        {
          value: "stack",
          label: "Stack",
          detail: "grids stepped up the diagonal so none covers another; a fourth dimension is a column of those down the page",
        },
        {
          value: "frames",
          label: "Frames",
          detail: "the grids side by side, each framed and named by its index, with the row and column indices on the edges of the first",
        },
      ],
      default: "stack",
      display: true,
      when: { param: "tab", oneOf: ["basics", "shape", "join"] },
    },
    /* --- the index expression, as one control ----------------------------- *
     * ONE LINE OF CODE, `T[ : , 0 , : ]`, through core's `expr` entry: the
     * brackets and commas are text and each slot is one of the four parameters
     * below, declared `hidden` so it renders nowhere else and still keeps its
     * URL key. Round 7 had rendered the four as segmented rows and they never
     * read as one expression (Kenneth, 2026-09-09); the `expr` type was added
     * to core for this, and `_lab/tensor-basics3.html` is the mock.
     *
     * DISPLAY PARAMETERS, ALL FOUR. They change which cells are lit and what
     * the selection prints; the tensor underneath does not move, so nothing
     * they do can discard anything (3.2).
     *
     * THE LAST DIMENSION HAS ITS OWN PARAMETER, and the reason is that a slot's
     * options are fixed when the widget is declared while a dimension's size
     * is not: dim 0 is 5 wide at rank 1 and 2 wide at every other rank, and a
     * slot offering an index the tensor does not have would be a control that
     * lies. What IS constant is that the last dimension is the feature
     * dimension, five wide, at every rank — so the three leading slots take
     * `:` 0 1 and the feature slot takes `:` 0-4, and every option is one the
     * tensor on screen actually has. A slot whose dimension the current rank
     * lacks is gated off by `when`, and the line is rebuilt when `rank` moves.
     */
    i0: {
      type: "segmented",
      label: "dim 0",
      hidden: true,
      options: LEAD_INDEX,
      default: ":",
      display: true,
      when: { all: [{ param: "tab", equals: "basics" }, { param: "rank", oneOf: ["2", "3", "4"] }] },
    },
    i1: {
      type: "segmented",
      label: "dim 1",
      hidden: true,
      options: LEAD_INDEX,
      default: ":",
      display: true,
      when: { all: [{ param: "tab", equals: "basics" }, { param: "rank", oneOf: ["3", "4"] }] },
    },
    i2: {
      type: "segmented",
      label: "dim 2",
      hidden: true,
      options: LEAD_INDEX,
      default: ":",
      display: true,
      when: { all: [{ param: "tab", equals: "basics" }, { param: "rank", equals: "4" }] },
    },
    feature: {
      type: "segmented",
      label: "feature",
      hidden: true,
      options: [
        { value: ":", label: ":", detail: "keeps every position of the last dimension" },
        ...[0, 1, 2, 3, 4].map((k) => ({
          value: String(k),
          label: String(k),
          detail: `feature ${k}, which removes the last dimension`,
        })),
      ],
      default: ":",
      display: true,
      when: { param: "tab", equals: "basics" },
    },
    index: {
      type: "expr",
      label: "Index",
      detail: INDEX_RULE,
      open: "T[",
      join: ",",
      close: "]",
      slots: ["i0", "i1", "i2", "feature"],
      when: { param: "tab", equals: "basics" },
    },
    b: {
      type: "segmented",
      label: "Shape of b",
      detail: "b is added to X, which has shape [2, 5]",
      options: M.BC_CASES.map((c) => ({ value: c.value, label: c.label, detail: c.detail })),
      default: "5",
      when: { param: "tab", equals: "broadcast" },
    },
    weights: {
      type: "segmented",
      label: "Weights",
      detail: "the right operand of @: W transposed, or W itself",
      options: M.MM_CASES.map((c) => ({ value: c.value, label: c.label, detail: c.detail })),
      default: "transposed",
      when: { param: "tab", equals: "multiply" },
    },
    dim: {
      type: "segmented",
      label: "Dimension removed",
      detail: "dim names the dimension that disappears, not the one kept",
      options: [
        { value: "0", label: "0", detail: "collapses the three samples, leaving one number per feature" },
        { value: "1", label: "1", detail: "collapses the four features, leaving one number per sample" },
        { value: "none", label: "none", detail: "collapses everything, leaving a scalar" },
      ],
      default: "0",
      when: { param: "tab", equals: "reduce" },
    },
    fn: {
      type: "segmented",
      label: "Reduction",
      detail: "what each group of values is replaced by",
      options: [
        { value: "mean", label: "mean", detail: "the average of the group" },
        { value: "sum", label: "sum", detail: "the total of the group" },
        { value: "max", label: "max", detail: "the largest value in the group" },
      ],
      default: "mean",
      when: { param: "tab", equals: "reduce" },
    },
    /* OFFERED ONLY WHERE IT IS THE OPERATION IT NAMES. Standardization uses the
       mean AND the standard deviation over dim 0, so under dim 1 or under sum
       and max the panel would be drawing numbers the controls above it do not
       set — a claim on a shared surface has to be true in every state that
       shows it (2.11). Display-only, so opening it keeps the columns already
       collapsed. */
    normalize: {
      type: "segmented",
      label: "Standardized X",
      detail: "divides each centred column by its standard deviation, taken over dim 0",
      options: [
        { value: "0", label: "Off", detail: "the reduction alone: X collapsing into its column means" },
        { value: "1", label: "On", detail: "(X − μ) / σ, with μ and σ stretched back across the rows" },
      ],
      default: "0",
      display: true,
      when: {
        all: [
          { param: "tab", equals: "reduce" },
          { param: "dim", equals: "0" },
          { param: "fn", equals: "mean" },
        ],
      },
    },
    /* ONLY WHERE SOMETHING MOVES. Basics has nothing to walk at all, and two
       further states have nothing to walk — b [2] and W untransposed — where
       core takes Step and Play out of the row, so a pace for any of them would
       be a control with no idea in it at rest (3.5). Said as a disjunction
       because inertness is a fact about a SECOND parameter on two of the six
       topics; the shape of the clause is widget 48's. */
    speed: {
      type: "choice",
      label: "Play speed",
      options: SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
      when: {
        any: [
          { param: "tab", oneOf: ["shape", "join", "reduce"] },
          {
            all: [
              { param: "tab", equals: "broadcast" },
              { param: "b", oneOf: ["5", "1-5", "2-1", "scalar"] },
            ],
          },
          {
            all: [
              { param: "tab", equals: "multiply" },
              { param: "weights", equals: "transposed" },
            ],
          },
        ],
      },
    },
    /* Authoring escape hatch, first render only: values placed, rows added,
       cells computed or groups collapsed, whichever the tab counts. */
    shown: { type: "int", min: 0, max: 2 * M.CELLS, default: 0, hidden: true },
  },

  /* The legend has to match the graph, and the four tabs draw different marks.
     The tensor read and the result built share one blue in tokens.css by
     design (decision 2), so one entry names both. */
  legend: ({ params }) => {
    if (params.tab === "basics") {
      const rank = Number(params.rank);
      const sel = M.selectionOf(params.rank, indexParts(params));
      /* Rank 4 is frames in BOTH views — an exploded stack per leading index in
         one, frames within frames in the other — so the frame entry is not a
         fact about `view` alone. */
      const framed = params.view === "frames" && rank >= 3;
      return [
        { token: "empirical", label: "The tensor, in the drawing and in the printed text" },
        {
          token: "highlight",
          label: sel.fixed > 0
            ? "The cells the index selects, and the sub-tensor they make"
            : "The sub-tensor the index selects",
        },
        ...(framed
          ? [{ token: "ink-3", label: "A dashed frame holds one index of the dimension it names", mark: "ring" }]
          : []),
      ];
    }
    if (params.tab === "broadcast") {
      const plan = M.broadcastPlan(M.bCaseByValue(params.b));
      return [
        { token: "empirical", label: "X, and the result it is added into" },
        {
          token: "group-b",
          label: plan.ok ? "b, with its stretched copies drawn faint" : "b, which does not stretch to [2, 5]",
        },
        ...(plan.ok
          ? [{ token: "highlight", label: "The row just added" }]
          : [{ token: "extreme", label: "The dimensions that do not combine" }]),
      ];
    }
    if (params.tab === "multiply") {
      const mm = M.mmCaseByValue(params.weights);
      return [
        { token: "empirical", label: "X, and the product Y it builds" },
        { token: "group-b", label: mm.ok ? "Wᵀ, one column per neuron" : "W, one row per neuron" },
        ...(mm.ok
          ? [{ token: "highlight", label: "The cell just computed, and the row and column it read" }]
          : [{ token: "extreme", label: "The inner dimensions that do not match" }]),
      ];
    }
    if (params.tab === "reduce") {
      const on = params.normalize === "1" && params.dim === "0" && params.fn === "mean";
      return [
        { token: "empirical", label: "X, and the result the reduction leaves" },
        ...(on ? [{ token: "group-b", label: "μ and σ, with their stretched copies drawn faint" }] : []),
        {
          token: "highlight",
          label: on
            ? "The column just standardized, and the values it became"
            : "The group just collapsed, and the value it became",
        },
      ];
    }
    const op = params.tab === "join" ? M.joinByValue(params.join) : M.opByValue(params.op);
    return [
      { token: "empirical", label: "The tensor the operation reads, and the result it builds" },
      ...(op.second ? [{ token: "group-b", label: "The second tensor" }] : []),
      { token: "highlight", label: "The value that just moved, in the drawing and in the printed text" },
      { token: "ink-3", label: "A value that has already moved out of the source" },
      ...(params.view === "frames"
        ? [{ token: "ink-3", label: "A dashed frame holds one index of the dimension it names", mark: "ring" }]
        : []),
    ];
  },

  /* Pure and exact: every number is the lesson's own, so there is nothing to
     draw and no seed to draw it with. What `compute` produces is the walk the
     animation reveals and the count of units in it. */
  compute({ params }) {
    /* Basics counts no units, which is how core learns there is nothing to
       drive: `init` sets `anim.inert` from it and the drive row goes (4.5). */
    if (params.tab === "basics") {
      return {
        kind: "basics",
        spec: M.rankSpec(params.rank),
        sel: M.selectionOf(params.rank, indexParts(params)),
        units: 0,
      };
    }
    if (params.tab === "shape" || params.tab === "join") {
      const op = params.tab === "join" ? M.joinByValue(params.join) : M.opByValue(params.op);
      const moves = M.shapeWalk(op);
      return { kind: "shape", op, moves, units: moves.length };
    }
    if (params.tab === "broadcast") {
      const bc = M.bCaseByValue(params.b);
      const plan = M.broadcastPlan(bc);
      return { kind: "broadcast", bc, plan, units: plan.ok ? M.BC_X_SHAPE[0] : 0 };
    }
    if (params.tab === "multiply") {
      const mm = M.mmCaseByValue(params.weights);
      return {
        kind: "multiply",
        mm: { ...mm, clash: mm.ok ? null : `4 against ${mm.shape[0]}` },
        units: mm.ok ? 6 : 0,
      };
    }
    const groups = M.reduceGroups(params.dim);
    return {
      kind: "reduce",
      groups,
      values: M.reduceValues(params.fn, params.dim),
      normalize: params.normalize === "1" && params.dim === "0" && params.fn === "mean",
      units: groups.length,
    };
  },

  animation: {
    /* Each tab advances a different noun, so the label takes the map form
       (3.4c). None of the four is a near-synonym of any lead in the arc. */
    stepLabel: {
      param: "tab",
      labels: {
        shape: "Move a value",
        join: "Move a value",
        broadcast: "Add a row",
        multiply: "Compute a cell",
        reduce: "Collapse a group",
      },
      default: "Move a value",
    },
    stepTitle: {
      param: "tab",
      labels: {
        shape: "Move the next value from the tensor to its place in the result",
        join: "Move the next value from one of the two tensors to its place in the result",
        broadcast: "Add the next row of X and b, and draw the row it makes",
        multiply: "Compute the next cell of the product from a row of X and a column of Wᵀ",
        reduce: "Collapse the next group of values into the one it reduces to",
      },
      default: "Move the next value from the tensor to its place in the result",
    },
    runLabel: "Play",
    runTitle: {
      param: "tab",
      labels: {
        shape: "Move every remaining value into the result",
        join: "Move every remaining value of both tensors into the result",
        broadcast: "Add the remaining rows",
        multiply: "Compute the remaining cells of the product",
        reduce: "Collapse the remaining groups",
      },
      default: "Move every remaining value into the result",
    },

    /* A SHAPE THAT DOES NOT COMBINE HAS NOTHING TO DRIVE, so step and run leave
       the row rather than sitting there dead (4.5). `anim.inert` and not
       `stepLabel: null`, because core reads that once when the shell is built
       and it would decline the buttons on all four tabs. */
    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.units);
      return {
        n,
        beat: 0,
        clock: M.unitMs(params.speed),
        inert: state.units === 0,
        done: n >= state.units,
        /* the Basics eases (4.4): what is on screen now, so `rebuild` can tell
           a view change from an index change, and where every cell was drawn */
        view: params.view,
        sel: params.tab === "basics" ? M.selectionOf(params.rank, indexParts(params)).text : null,
        pos: null,
        morph: null,
        extract: null,
      };
    },

    advance: (anim, { dt, params, state }) => {
      /* An ease in flight, on any tab that has one. Basics is inert, so this
         is the only motion it ever runs; on the other tabs `morph` and
         `extract` are never set. */
      if (anim.morph || anim.extract) {
        let moving = false;
        if (anim.morph) {
          anim.morph.t = c01(anim.morph.t + dt / MORPH_MS);
          if (anim.morph.t < 1) moving = true; else anim.morph = null;
        }
        if (anim.extract) {
          anim.extract.t = c01(anim.extract.t + dt / (LIGHT_MS + GLIDE_MS));
          if (anim.extract.t < 1) moving = true; else anim.extract = null;
        }
        if (anim.inert) return moving;
      }
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

    /* A beat in flight is cleared whenever the beat LENGTH changes: the
       fraction of one clock read against another leaves a value stopped
       between two cells. Opening the standardized panel changes no clock, so a
       step in flight keeps running while the two extra grids appear. */
    rebuild: (anim, { params, state }) => {
      anim.inert = state.units === 0;
      anim.n = Math.min(anim.n, state.units);
      const ms = M.unitMs(params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
      /* WHERE THE BASICS EASES ARE DECIDED (4.4): `rebuild` runs on every
         display change and is not told which one, so the view and the
         selection on screen are compared with what the parameters now ask.
         Setting `easing` is the request for frames; core clears it when it
         grants one. Reduced motion asks for nothing and the figure jumps. */
      if (params.tab === "basics") {
        const sel = M.selectionOf(params.rank, indexParts(params));
        const motion = !reducedMotion();
        if (params.view !== anim.view) {
          if (motion && anim.pos) anim.morph = { from: anim.pos, t: 0 };
          anim.view = params.view;
          if (anim.morph) anim.easing = true;
        }
        if (sel.text !== anim.sel) {
          anim.sel = sel.text;
          if (motion && sel.fixed > 0) {
            anim.extract = { t: 0 };
            anim.easing = true;
          }
        }
      } else {
        anim.view = params.view;
      }
    },
  },

  /* --- the figure as a control (3.6) --------------------------------------- *
   * Every index the Basics drawing writes is a target for the dimension it
   * names, and the rail keeps the same four controls as the keyboard and
   * screen-reader path. ONE PARAMETER PER TARGET: a cell would set every slot
   * at once, which is why cells are not targets — `planBasics` says so where
   * the targets are built.
   *
   * BUILT FROM THE SAME PLAN THE DRAW BUILDS, so a target sits exactly under
   * the label it belongs to. Core hands `regions` no `colors` and no canvas —
   * deliberately, since a target that moved with the theme would drift from the
   * picture — but the layout needs the mono font's character width, which is
   * measured off a canvas. So the tokens are read again here and the
   * measurement is taken on a canvas of this module's own: both are pure
   * functions of the stylesheet, and neither can disagree with what `draw`
   * used. Lazily, at click and hover time, never inside `draw`. */
  regions: ({ w, h, params, state }) => {
    /* `state` is null while core probes the table at load to validate the
       parameter names, before the first compute. An empty table is right
       there: nothing is on the canvas to hit yet. */
    if (!state || params.tab !== "basics") return [];
    return planBasics(measureCtx(), readTokens(), w, h, params).targets;
  },

  draw({ ctx, colors, w, h, params, state, anim, pointer }) {
    const plan = params.tab === "basics" ? planBasics(ctx, colors, w, h, params, anim)
      : state.kind === "shape" ? planShape(ctx, colors, w, h, params, state, anim)
        : params.tab === "broadcast" ? planBroadcast(colors, w, h, params, state, anim)
          : params.tab === "multiply" ? planMultiply(colors, w, h, params, state, anim)
            : planReduce(colors, w, h, params, state, anim);
    if (anim && plan.cellPos) anim.pos = plan.cellPos;
    hovered = hitPlan(plan, pointer);
    paintPlan(ctx, colors, plan, hovered);
    /* The hovered cell marked in the PRINT as well as in the drawing. Drawn
       after the plan because the pointer is only resolved once the plan is
       built, and the two share nothing but the cell's key. */
    if (hovered) {
      ctx.strokeStyle = colors.ink1;
      ctx.lineWidth = 1;
      for (const spot of plan.hotspots) {
        if (spot.key !== hovered.key) continue;
        ctx.strokeRect(spot.x - 1.5, spot.y - 0.5, spot.w + 3, spot.h);
      }
    }
    /* The bracket under the inner pair of a product that cannot be taken. Drawn
       after the plan because it is a rule rather than a cell, and it exists in
       exactly one state. */
    if (plan.brackets) {
      ctx.strokeStyle = colors.extreme;
      ctx.lineWidth = 1.5;
      ctx.font = `${colors.fsSm} ${MONO}`;
      const left = plan.brackets.x + ctx.measureText("[3, ").width;
      const right = plan.brackets.x + ctx.measureText(`[3, 4] @ [${state.mm.shape[0]}`).width;
      ctx.beginPath();
      ctx.moveTo(left, plan.brackets.y - 6);
      ctx.lineTo(left, plan.brackets.y + 2);
      ctx.lineTo(right, plan.brackets.y + 2);
      ctx.lineTo(right, plan.brackets.y - 6);
      ctx.stroke();
    }
  },

  readout({ params, state, anim }) {
    const cell = (rest, note) => ({
      label: "Cell",
      value: hovered ? hovered.text : rest,
      note: hovered ? "under the pointer" : note,
    });
    const unit = TAB_UNITS[params.tab];

    if (params.tab === "basics") {
      const { shape, names } = state.spec;
      const sel = state.sel;
      const total = M.shapeSize(shape);
      const one = sel.keep.length === 0;
      return [
        {
          label: "Shape",
          value: M.shapeText(shape),
          note: names.join(", "),
        },
        {
          label: "Selection",
          value: sel.text,
          /* The figure's own caption counts the indices and names the
             dimensions they removed, so the tile carries the other half of
             that fact: what the rank went to. */
          note: sel.fixed === 0
            ? "every position of every dimension"
            : `rank ${shape.length} → rank ${sel.keep.length}`,
        },
        {
          label: "Selection shape",
          value: M.shapeText(sel.shape),
          note: `${sel.size} of ${total} values`,
        },
        cell(one ? `${sel.text} = ${M.num(sel.at([]))}` : "—",
          one ? "the one value the index reaches" : "a cell's index and value"),
      ];
    }

    if (state.kind === "shape") {
      const at = shapeStand(state, anim, params.speed);
      const m = at.last ?? (at.n > 0 ? state.moves[at.n - 1] : null);
      const src = m ? `${m.t === 0 ? "T" : "T2"}[${m.src.join(", ")}]` : null;
      return [
        {
          label: "Source shape",
          value: M.shapeText(M.T3_SHAPE),
          note: state.op.second
            ? "two tensors of this shape, read one after the other"
            : "sample, sequence, feature",
        },
        {
          label: "Result shape",
          value: M.shapeText(state.op.shape),
          note: plural(at.n, state.units, "value placed", "values placed"),
        },
        {
          label: "This move",
          value: m ? M.shapeText(m.dst) : "—",
          note: m ? `the result index; from ${M.shapeText(m.src)} in the source` : `no ${unit} has moved yet`,
        },
        cell(m ? `${src} = ${m.v}` : "—", m ? "the value that moved" : "a cell's index and value"),
      ];
    }

    if (params.tab === "broadcast") {
      const p = state.plan;
      const row = anim.n > 0 && p.ok ? p.result[anim.n - 1] : null;
      return [
        {
          label: "Shapes in",
          value: `${M.shapeText(M.BC_X_SHAPE)} + ${M.shapeText(state.bc.shape)}`,
          note: "lined up from the right",
        },
        {
          label: "Result shape",
          value: p.ok ? M.shapeText(p.shape) : "none",
          note: p.ok ? plural(anim.n, state.units, "row added", "rows added")
            : `${p.clash}: neither equal nor 1`,
        },
        {
          label: "This row",
          value: row ? `row ${anim.n - 1}` : "—",
          note: row ? `${row.map(M.num).join(", ")}: row ${anim.n - 1} of X plus b` : p.ok ? `no ${unit} has been added yet` : "the shapes do not combine",
        },
        cell(row ? `result[${anim.n - 1}, 0] = ${M.num(row[0])}` : "—",
          row ? "the first cell of that row" : "a cell's index and value"),
      ];
    }

    if (params.tab === "multiply") {
      const mm = state.mm;
      const rising = mm.ok && anim.beat > 0 && anim.n < state.units ? anim.beat : 0;
      const at = mm.ok ? mmCurrent(anim, state, rising) : null;
      const p = at ? M.productTerms(at.r, at.c) : null;
      return [
        {
          label: "Shapes in",
          value: `${M.shapeText(M.MM_X_SHAPE)} @ ${M.shapeText(mm.shape)}`,
          note: mm.ok ? "the inner dimensions, 4 and 4, match" : `the inner dimensions are 4 and ${mm.shape[0]}`,
        },
        {
          label: "Result shape",
          value: mm.ok ? M.shapeText(M.MM_Y_SHAPE) : "none",
          note: mm.ok ? plural(anim.n, state.units, "cell computed", "cells computed")
            : "inner dimensions must match",
        },
        {
          label: "This cell",
          value: p ? M.num(p.sum) : "—",
          note: p ? p.text.replace(/ = .*$/, "") : mm.ok ? `no ${unit} has been computed yet` : "there is no product to take",
        },
        cell(at ? `${M.indexText("Y", [at.r, at.c])} = ${M.num(p.sum)}` : "—",
          at ? "the cell this product fills" : "a cell's index and value"),
      ];
    }

    const g = anim.n > 0 ? state.groups[anim.n - 1] : null;
    const k = anim.n - 1;
    const where = g
      ? (params.dim === "0" ? `column ${g.at} of X`
        : params.dim === "1" ? `row ${g.at} of X` : "every value of X")
      : "";
    if (state.normalize) {
      return [
        { label: "Shapes in", value: M.shapeText(M.RED_X_SHAPE), note: "3 samples, 4 features" },
        {
          label: "Result shape",
          value: M.shapeText(M.RED_X_SHAPE),
          note: plural(anim.n, state.units, "column standardized", "columns standardized"),
        },
        {
          label: "This column",
          value: g ? `μ ${M.num(M.RED_MU[k])}, σ ${M.num(M.RED_SD[k])}` : "—",
          note: g ? `the mean and standard deviation of ${g.values.join(", ")}`
            : "no column has been collapsed yet",
        },
        cell(g ? `μ[${k}] = ${M.num(M.RED_MU[k])}` : "—",
          g ? "the mean that column was centred on" : "a cell's index and value"),
      ];
    }
    return [
      { label: "Shapes in", value: M.shapeText(M.RED_X_SHAPE), note: "3 samples, 4 features" },
      {
        label: "Result shape",
        value: M.shapeText(M.reduceShape(params.dim)),
        note: plural(anim.n, state.units, "group collapsed", "groups collapsed"),
      },
      {
        label: "This group",
        value: g ? g.values.join(", ") : "—",
        note: g ? `${where}, reduced by ${params.fn}` : `no ${unit} has been collapsed yet`,
      },
      cell(g ? `result[${k}] = ${M.num(state.values[k])}` : "—",
        g ? "the value the group became" : "a cell's index and value"),
    ];
  },

  summary({ params, state, anim }) {
    if (params.tab === "basics") {
      const { shape, names } = state.spec;
      const sel = state.sel;
      return `The ${M.shapeText(shape)} tensor, its dimensions ${names.join(", ")}, drawn as `
        + (params.view === "stack"
          ? "grids stepped up the diagonal"
          : "framed grids side by side, with the indices on the edges")
        + ` and printed beside the drawing. ${sel.text} selects ${sel.size} of `
        + `${M.shapeSize(shape)} values and has shape ${M.shapeText(sel.shape)}. ${INDEX_RULE}`;
    }
    if (state.kind === "shape") {
      return `The [2, 2, 5] tensor holding 1 to 20, drawn as `
        + (params.view === "stack"
          ? "one grid per sample stepped up the diagonal"
          : "one framed grid per sample side by side, with the indices on the edges")
        + `, and printed beside the drawing as PyTorch prints it. Beneath it the `
        + `${M.shapeText(state.op.shape)} result of ${state.op.label} with `
        + `${anim.n} of ${state.units} values placed in it. ${state.op.caption}`;
    }
    if (params.tab === "broadcast") {
      return `X [2, 5] added to b ${M.shapeText(state.bc.shape)}, with b's stretched copies drawn faint. `
        + (state.plan.ok
          ? `${anim.n} of ${state.units} rows of the result are drawn.`
          : `The shapes do not combine: ${state.plan.clash}.`)
        + " Below, the two shapes lined up from the right with a verdict on each dimension.";
    }
    if (params.tab === "multiply") {
      return `X [3, 4] multiplied by ${state.mm.name} ${M.shapeText(state.mm.shape)}. `
        + (state.mm.ok
          ? `${anim.n} of ${state.units} cells of the [3, 2] product are computed, each from a row of X and a column of Wᵀ.`
          : `There is no product: the inner dimensions are 4 and ${state.mm.shape[0]}.`);
    }
    return `X [3, 4] reduced by ${params.fn} over `
      + (params.dim === "none" ? "every dimension" : `dim ${params.dim}`)
      + `, with ${anim.n} of ${state.units} groups collapsed`
      + (state.normalize ? ", and each collapsed column centred on its mean and divided by its standard deviation." : ".");
  },
});
