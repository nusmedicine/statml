/* ============================================================================
   Widget 51 · Composition — a model is layers composed in an order, and the
   four connections that send the data somewhere other than straight on.

   PHM5005 05-3 cells 61-101, seven pages under the notebook's own two
   headings: Composing layers (Ordering, Building, Dimensions) and Controlling
   flow (Skip, Gating, Branching, Routing). `model.js` carries the arithmetic;
   this file draws it and nothing else.

   THE MISCONCEPTION IS THAT A MODEL IS A LIST. It is a graph, and the four
   flow pages are the four edges that are not a straight line: an input added
   back, a gate multiplied in, a split that merges, and a choice of path. So
   the device on every page is the same — STEP RUNS ONE LINE OF `forward()`
   AND LIGHTS WHAT THAT LINE PRODUCED — and what changes from page to page is
   the shape of the connection.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE GEOMETRY OF RECORD. `_lab/composition-mock.html` drew
       all eight sections to scale at the 550px stage and the pages that change
       with the frame at 770, and Kenneth took the recommendation on every one
       (2026-09-10). Every box size, column centre, band placement, elbow and
       label offset below is the mock's, and the constants live in `model.js`
       so the verify script measures the same numbers.

    2. THE DRAWING IS NOT SHARED WITH THE TWO SIBLINGS. `txt`, `arrow`,
       `elbow`, `edge`, `layerBox` and `shadedBand` are the same idiom written
       again here, deliberately: drawing is geometry and belongs to the file
       that lays out the stage. What IS shared is `core/torch.js` — the
       output-size rule and the three error strings — because those are one
       formula each (5.8).

    3. THE STAGE HEIGHT IS A FUNCTION OF THE PARAMETERS AND THE WIDTH.
       Dimensions is a 366px page and Ordering three of 286, 243 and 394,
       and Routing loses
       138px when the code moves beside the diagram at 770, so a single height
       would make every short page pay for the tallest. `pageHeight` and `draw`
       ask the same geometry functions (5.8), and both build the state from the
       same `computeFor`, so neither can measure a figure the other did not
       draw.

    4. THE FIT PASS IS ONE RULE FOR TWO PAGES. Routing and Building each carry
       a text column, and each puts it UNDER the diagram where beside would
       leave the diagram too narrow to draw and BESIDE it where it would not.
       Skip, Gating and Branching keep theirs beside at both widths, which the
       same rule answers without a second one. Ordering was the third until
       decision 15 took its print away, and it carries no text column now.

    5. THE `forward()` BODY IS DRAWN WITH ITS INDENT REMOVED, as the mock drew
       it: the `def` line as written and the body flush under it. Every "it
       fits" number in the catalogue and the mock is measured on that form, and
       restoring the four spaces costs 26px on a page whose slack is 41.

    6. A DIMENSIONS SLOT'S MENU IS PER STEP AS WELL AS PER DATA TYPE. The page
       needs every option to be either legal where it sits or to fail with one
       of core's two messages, and one menu across all four positions cannot
       keep that promise: `MaxPool2d(2)` after `Flatten` is a rank error, which
       torch words a third way and this widget does not draw. Per-step menus
       also give each step a losing option of its own.

    7. THE STEP LABEL ON DIMENSIONS IS `Next layer`, not `Next line`. The page
       has no `forward()` at all — its chain IS the code — and 3.4c asks the
       label to name the widget's own noun. Ordering and Building at
       `api: sequential` take the same label for the same reason, through
       core's nested label map.

    8. AT `mode: hard` THE ROUTER STILL COMPUTES ITS WEIGHTS. Cell 99 gives
       hard routing as a two-branch `if / else` schematic and this diagram has
       three branches, so the two lines that differ are written out rather than
       transcribed, and the readout says what the difference costs: the argmax
       is discrete, so no gradient reaches the router.

    9. THE SECOND BRANCH'S EDGE ELBOWS INTO THE MERGED BAND. The mock leaves it
       landing at its own column centre while the band is centred in the
       diagram, so at `add` the arrowhead sits beside the stacked band rather
       than on it. Both edges now turn at a right angle into the band they
       feed, which is what every one of Kenneth's six figures does.

   10. THE MASK IS THE ONE DRAW, and it comes from the rng `compute` is handed.
       Everything else is a fixed draw at a seed `model.js` names, so no page's
       figure moves under a control that is not on it.

   11. NO PAGE DRAWS `--c-group-a` AND `--c-empirical` AS A CONTRAST, and no
       legend lists both. They are ONE COLOUR in `tokens.css` on purpose
       (`:80`, both mean the reader's own data), so a figure that used them to
       tell two things apart would tell them apart in the legend and nowhere
       else. Where a page needs a second hue against the reader's tensor it
       takes `--c-group-b`, which is what the second operand already is.
       Ordering read its non-Transform steps as `--ink-2` until decision 17,
       which gives its four steps three hues on the job each one does.

   12. THE GATE'S WEIGHTS ARE DRAWN AS THE [4, 3] TENSOR THEY ARE. The mock
       drew the chosen sample's row alone, which leaves the four rows the plan
       makes `regions` with nothing on the canvas to hit, and a target that is
       not drawn is exactly what no pixel hash can catch (3.6). Four 16px rows
       cost Routing 34px of height.

   13. AND THE WEIGHTED-SUM BOX HOLDS THE WHOLE TENSOR, for the same reason.
       `_lab/composition-routing-sum.html` candidate C was built first and drew
       the chosen sample's row from each branch as one strip of 20 cells;
       Kenneth then asked why a `[4, 20]` branch showed one row, and picked D,
       the mock's §4 — three bands of 4 rows by 20 cells, the combined band
       under them, the chosen sample lit in all four. The rows of all four
       bands join the weight grid as `regions` that set `sample`. It costs
       Routing 144px of height at 550 and 192 at 770, and no width at all.

   14. THE WALK IS ONE LINE AHEAD OF ITSELF, ON EVERY PAGE. The draft drew the
       whole diagram pale at rest and let the walk light it, and Kenneth on
       Gating and Branching (2026-09-10, round 1, comment 3): "some of
       downstream processes shouldn't be shown at the beginning but revealed
       with the animation". His pick, for all seven pages, is ONE LINE AHEAD.

       `M.stageOf(done, unit)` is the whole rule and `M.pageUnits` is the table
       of which line owns which piece, both in `model.js` so the verify script
       reads them too (5.8). A unit is:

         absent   nothing at all — no box, no arrow, no edge label, no
                  operator, no band, no value grid, no output edge
         preview  the LAYERS of the next line, pale: a box in `layerBox`'s own
                  pale form, an operator node in the axis colour, a bus arm
                  that has to reach them, and the unit's own arrow as a grey
                  line with no shape written on it
         landed   the line has run: the box in its path's colour, the arrow
                  with the shape on it, the band, the values

       A BAND IS A VALUE, NOT A LAYER, so a preview never draws one: the whole
       of 2.1 is that a widget does not open on its own answer, and a shaded
       band drawn one line early is the answer. The `gated` band, Branching's
       three bands, Routing's block and its weight grid all wait for the line
       that computes them.

       THE INPUT AND THE BUS ARE NOT A UNIT. `x [4, 10]` and the arm of the
       split that reaches the FIRST line's column are drawn at every walk
       position, because they are what the first line is applied to. A later
       arm belongs to the line whose column it feeds, and appears pale with it
       — which is what Kenneth asked for on Branching ("the second arm of the
       bus and fc2/relu appear pale when line 1 lands").

       `pageHeight` is unchanged and stays the FULL height at every walk
       position. The stage does not grow as the walk runs; the empty space is
       where the reveal will land, and a figure that reflowed under every press
       would move the captions out from under the reader's eye. `pageHeight`
       and `draw` still ask the same geometry functions (decision 3), and the
       geometry functions do not read the walk at all.

       THE CAPTIONS SPLIT THE SAME WAY (2.4). `M.captions` gives every line the
       unit it waits for, `at: 0` meaning a definition that is true before the
       walk starts. A held line's row is measured and reserved, so the caption
       block is the same height empty as full. `regions` reads the walk through
       the same `M.stageOf`, because a band that is not drawn is not a target
       (3.6) — and the walk reaches it through the `anim` object `draw` stashes,
       since core hands `regions` the parameters and the state and not the
       animation.

   15. ORDERING NAMES NO ARCHITECTURE. The page drew cell 62's three example
       blocks — MLP, ResNet, the transformer feed-forward path — with a `block`
       control, a print and a shape on every edge, until Kenneth on 2026-09-10:
       "maybe we don't go into details for specific architectures i.e. MLP,
       Resnet, transformer", and "we want principles like in the notebook 05-3
       (general pattern, layer combinations, some specific layers at beginning
       and end)". `_lab/composition-ordering-mock.html` drew three ways to
       carry that at the real stage and he picked A: the notebook's three
       perspectives on the one `view` control, `pattern`, `combinations` and
       `position`. Its §A is the geometry of record here, as the eight-section
       mock is for the other six pages.

       WHAT WENT WITH THE BLOCKS. `ORDER_BLOCKS`, `ORDER_PRINT`, the `block`
       control and its URL values, the `changed` count, the print column, and
       the Shape in / Shape out / Steps that change the shape / Parameters
       tiles. NO SHAPE IS DRAWN ON THIS PAGE AT ALL now, which is why the fit
       pass no longer asks whether Ordering's text column sits beside the
       diagram: there is no text column. The shape story is Dimensions'.

       Step's label follows the view through core's nested label map — Next
       step · Next combination · Next position — the same door Building's
       label uses for its two APIs.

   16. A CAPTION ROW CAN BE SHARED. Combinations gives every group a reason of
       its own and the lit group's reason is what prints, so the three rows
       occupy ONE row of stage: `M.captions` marks them `only`, `captionLines`
       lays them at the same row, and the height asks `capRows` rather than
       `caps.length`. The alternative the mock measured is a reason under every
       group, where the widest runs into its neighbour at the 174px group
       pitch; that collision is what the shipped page had.

   17. THE PATTERN'S FOUR STEPS CARRY THREE HUES, from his own subunit figure:
       Transform `--c-group-a`, Normalize and Activate `--c-group-b`,
       Regularize `--c-group-c`. Decision 11's reading of the old page — the
       non-Transform steps as ink, because only Transform changed the shape —
       went with the shapes. What separates the four now is the JOB each does,
       the legend names the three groups by that job, and `--c-group-c` is the
       third parallel role the token was added for.

   18. FC3 IS SIZED FOR THE MERGE. Cell 98 writes `fc3 = nn.Linear(14, 2)` and
       the page held that 14 fixed, so of the six `merge × fc2` combinations
       only the notebook's own — concat on 8 and 6 — reached an output, and add
       and average could not work at any width. Kenneth on 2026-09-10, round 2:
       every merge torch accepts should reach an output. `M.fc3In` is the width
       the merge produces and fc3 is the `Linear(N, 2)` a model written for that
       merge would declare, so five of the six now run to `[4, 2]` and the one
       failure left is the notebook's own — add or average on 8 and 6, which
       raises AT THE MERGE. The matmul path at fc3 went with it: `fcError`, its
       message, its caption row and the geometry rows that reserved space for
       it can no longer occur, so none of them is declared.

   19. SKIP'S ADD IS DRAWN AS THREE BANDS. The page named the add with a `+`
       circle and left the values to the readout, and Kenneth asked for the
       bands the plan carried (2026-09-10, round 2). They are Branching's own
       form at `add`: the two operands stacked, the result under them, every
       cell shaded on the band's own largest magnitude and the chosen sample's
       row lit in all three. What is new here is the `+`, which stays as the
       node the two operand bands feed, in the gap between them and the result.

       THE BLOCK IS CENTRED ON THE SPINE, CLAMPED. Centred in the diagram it
       leaves the `+` standing beside its own bands at width 10; centred on the
       spine it runs off the left edge at width 20, since the spine sits at the
       left of the column and 20 cells are 240px at 550. So the centre is the
       spine clamped into the room the rail leaves, and the width is reserved
       at 20 cells so the block does not move when the width control does.
       `M.bandWidth.skip` now measures the band rather than the boxes alone.

       The bands land with `out = x3 + skip` and not with the lines that
       produced the operands: a band is a value (decision 14), and the value
       the page is about is the sum. Their rows are the `regions` that set
       `sample`, read through the same walk the drawing uses.
   ========================================================================= */

import {
  defineWidget, readTokens, mathmlRenders, makeRng, shapeText, sizeText,
} from "../core/index.js";
import * as M from "./model.js";

/* A canvas of this module's own, for the measurements `height` needs and core
   hands none: `measureText` reads the font and ignores the transform, so this
   gives the same character width the figure is laid out with. */
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  return measureCanvas;
}

const {
  PAD, GAP, COLGAP, BOX_H, BOX_BW, EDGE_H, HEAD, LINE, BAND_HEAD, CAPTION_H,
  CAP_GAP, TEXT_GAP, BOX_W, DIM_BOX_W, XLAB, ORDER_EDGE, SIDE_GAP,
} = M;

const HLW = 2.5;          // the --c-highlight frame
const SPLIT_H = 26;       // the bus that splits x into two columns
const ROUTE_SPLIT = 36;   // the same bus with four columns and their names

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

/** A colour at an alpha, as a fill string. Tokens resolve to hex. */
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};

function arrow(ctx, x0, y0, x1, y1, color, width = 2, dash = [], head = HEAD) {
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
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** A right-angle elbow through `pts`, arrowhead on the last leg. Never
    diagonal: every one of Kenneth's six figures turns at a right angle. */
function elbow(ctx, pts, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  const [ax, ay] = pts[pts.length - 2];
  const [bx, by] = pts[pts.length - 1];
  const a = Math.atan2(by - ay, bx - ax);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - HEAD * Math.cos(a - 0.45), by - HEAD * Math.sin(a - 0.45));
  ctx.lineTo(bx - HEAD * Math.cos(a + 0.45), by - HEAD * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** A band's header: its name left, the expression it performs right, a
    hairline under, and the top of its content returned. */
function band(ctx, colors, y, w, name, expr) {
  txt(ctx, colors, name, PAD, y + 11, { color: colors.ink1, weight: "600" });
  if (expr) {
    txt(ctx, colors, expr, w - PAD, y + 11,
      { color: colors.highlight, align: "right", mono: true });
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 17.5);
  ctx.lineTo(w - PAD, y + 17.5);
  ctx.stroke();
  return y + BAND_HEAD;
}

/** One layer box: 30 tall, a 2px border in the path's colour, the class name
    in mono inside. Kenneth's figures put the name inside and the size on the
    edge, and that convention is what makes four columns fit at 770. */
function layerBox(ctx, colors, x, y, w, label, color, o = {}) {
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, w, BOX_H);
  ctx.fillStyle = wash(color, o.lit ? 0.34 : o.pale ? 0.05 : 0.13);
  ctx.fillRect(x, y, w, BOX_H);
  ctx.strokeStyle = o.lit ? colors.highlight : o.pale ? colors.axis : color;
  ctx.lineWidth = BOX_BW;
  ctx.strokeRect(x + BOX_BW / 2, y + BOX_BW / 2, w - BOX_BW, BOX_H - BOX_BW);
  txt(ctx, colors, label, x + w / 2, y + BOX_H / 2 + 0.5, {
    color: o.pale ? colors.ink3 : colors.ink1, align: "center", baseline: "middle",
    mono: true, size: o.size ?? colors.fsSm,
  });
}

/** The dashed enclosure of his combination figure: layers used as a unit. */
function dashedGroup(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.setLineDash([]);
}

/** Square brackets around the repeated middle, with `× N` beside the right
    one. Brackets rather than a second dashed rectangle: dashes already mean
    "used as a unit" on this page, and a repeat is a different claim. */
function brackets(ctx, colors, x, y, w, h, label, color) {
  const s = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + s, y + h);
  ctx.moveTo(x + w - s, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - s, y + h);
  ctx.stroke();
  if (label) {
    txt(ctx, colors, label, x + w + 6, y + h / 2 + 0.5,
      { color, baseline: "middle" });
  }
}

/** An outlined box with no fill — the `Merge` rectangle of his branch figure.
    A box with something drawn inside it passes no label and captions itself. */
function outlineBox(ctx, colors, x, y, w, h, label, color) {
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = BOX_BW;
  ctx.strokeRect(x + BOX_BW / 2, y + BOX_BW / 2, w - BOX_BW, h - BOX_BW);
  if (!label) return;
  txt(ctx, colors, label, x + w / 2, y + h / 2 + 0.5,
    { color: colors.ink1, align: "center", baseline: "middle", mono: true });
}

/**
 * One edge: an arrow down the column with the shape written ON it, the surface
 * knocked out behind the text.
 *
 * The knockout rather than the shape beside the arrow: at Routing's 770 frame
 * a branch column is 66px and `[4, 20]` is 47 of them, so text beside the
 * arrow lands in the next column. Written on the arrow it reads as one break
 * in the line, which is what "shapes on the edges" looks like in his figures.
 */
function edge(ctx, colors, cx, y0, y1, text, o = {}) {
  arrow(ctx, cx, y0, cx, y1, o.color ?? colors.axis, 2, o.dash ?? []);
  if (!text) return null;
  return edgeLabel(ctx, colors, cx, (y0 + y1) / 2, text, o);
}
/** The shape written ON a vertical line, the surface knocked out behind it. */
function edgeLabel(ctx, colors, cx, mid, text, o = {}) {
  const size = o.size ?? colors.fsSm;
  ctx.font = `${size} ${colors.mono}`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(cx - tw / 2 - 4, mid - 8, tw + 8, 16);
  txt(ctx, colors, text, cx, mid + 0.5,
    { color: o.ink ?? colors.ink1, align: "center", baseline: "middle", mono: true, size });
  return { x: cx - tw / 2, y: mid + 9, w: tw };
}

/** The `+` circle of his skip figure. */
function plusNode(ctx, colors, cx, cy, r, color) {
  ctx.fillStyle = wash(color, 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = BOX_BW;
  ctx.stroke();
  txt(ctx, colors, "+", cx, cy + 0.5,
    { color: colors.ink1, align: "center", baseline: "middle", size: colors.fsLg, weight: "600" });
}

/** The ⊙ ring of his gate figure: a ring with a filled dot inside. */
function ringNode(ctx, colors, cx, cy, r, color) {
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A shaded band: one column per feature, one row per batch sample.
 *
 * Digits never go inside one: at two decimals a cell needs 40px, so a
 * `[4, 20]` with values in it is 800px against a 522px stage, and at torch's
 * own four decimals 1000. The values reach the reader through the readout for
 * the chosen sample, whose row is lit here.
 */
function shadedBand(ctx, colors, x, y, rows, cols, p, fillAt, o = {}) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = colors.surface;
      ctx.fillRect(x + c * p, y + r * p, p, p);
      if (!(o.emptyAt && o.emptyAt(r, c))) {
        ctx.fillStyle = fillAt(r, c);
        ctx.fillRect(x + c * p, y + r * p, p, p);
      }
    }
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * p + 0.25);
    ctx.lineTo(x + cols * p, y + r * p + 0.25);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(x + c * p + 0.25, y);
    ctx.lineTo(x + c * p + 0.25, y + rows * p);
    ctx.stroke();
  }
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cols * p - 1, rows * p - 1);
  if (o.litRow != null) {
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = HLW;
    ctx.strokeRect(x - 1.25, y + o.litRow * p - 1.25, cols * p + 2.5, p + 2.5);
  }
}

/** One value cell, at the size a signed two-decimal float needs. */
function valueCell(ctx, colors, x, y, w, h, text, o = {}) {
  const hue = o.hue ?? colors.groupA;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x, y, w, h);
  if (!o.empty) {
    ctx.fillStyle = wash(hue, o.lit ? 0.4 : 0.15);
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = o.lit ? colors.highlight : colors.axis;
  ctx.lineWidth = o.lit ? HLW : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (text != null && text !== "") {
    txt(ctx, colors, text, x + w / 2, y + h / 2 + 0.5, {
      color: colors.ink1, align: "center", baseline: "middle", mono: true,
      size: o.size ?? colors.fsSm, weight: o.lit ? "600" : "",
    });
  }
}

/** A print, one line to a row, in the mono face. */
function printLines(ctx, colors, x, y, lines, color) {
  lines.forEach((l, i) =>
    txt(ctx, colors, l, x, y + i * LINE, { color: color ?? colors.ink2, mono: true }));
  return lines.length * LINE;
}

/** The notebook's own `forward()`, with the executing line lit and a wash
    behind it. Decision 5: the `def` line as written, the body flush under it. */
function codePanel(ctx, colors, x, y, w, lines, lit) {
  lines.forEach((l, i) => {
    const yy = y + i * LINE;
    if (i === lit) {
      ctx.fillStyle = wash(colors.highlight, 0.14);
      ctx.fillRect(x - 4, yy - 12, w + 8, LINE);
    }
    txt(ctx, colors, l, x, yy,
      { color: i === lit ? colors.highlight : colors.ink2, mono: true });
  });
  return lines.length * LINE;
}

/** Torch's own message, wrapped to `w` and printed in the failure colour. */
function wrapMono(ctx, colors, msg, maxW) {
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  const rows = [];
  let cur = "";
  for (const word of msg.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width > maxW && cur) {
      rows.push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) rows.push(cur);
  return rows;
}

function errorText(ctx, colors, x, y, maxW, msg) {
  const rows = wrapMono(ctx, colors, msg, maxW);
  rows.forEach((r, i) =>
    txt(ctx, colors, r, x, y + i * LINE, { color: colors.extreme, mono: true }));
  return rows.length;
}

/** One line at a time, wrapped to the width it is given. The size is a
    parameter because Ordering's side text falls back to --fs-xs where the
    larger face would take two lines beside a 30px box. */
function wrapLines(ctx, colors, text, maxW, size = colors.fsSm) {
  ctx.font = `${size} ${colors.font}`;
  const out = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** The mono font's width per character at --fs-sm, measured rather than
    assumed: every "it fits" verdict in this file is a multiple of it. */
function monoCW(ctx, colors) {
  ctx.save();
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  const cw = ctx.measureText("0000000000").width / 10;
  ctx.restore();
  return cw;
}

const codeW = (ctx, colors, lines) => M.codeWidth(lines, monoCW(ctx, colors));

/* --- where the walk stands -------------------------------------------------- *
 * One function, because the drawing and the readout must agree about it (5.8).
 * `done` is how many lines have run; `lit` is the display line the last one
 * was, which is the line index in the code panel because the `def` line is
 * index 0 and the body starts at 1. */
function walkAt(anim, state) {
  const done = Math.min(Math.max(0, anim?.n ?? 0), state.units);
  return { done, lit: done > 0 ? done : -1, idx: done - 1 };
}

/* --- one line ahead, decision 14 -------------------------------------------- *
 * Every box, arrow, operator and band on all seven pages goes through these
 * three, so the rule cannot drift from one page to the next. `M.stageOf` is the
 * rule itself and lives in `model.js`, where the verify script can read it.  */

const stageAt = (walk, unit) => M.stageOf(walk.done, unit);
/** The line has run: the shape, the band and the values are true now. */
const landed = (walk, unit) => walk.done >= unit;
/** The unit is on the stage at all — landed, or the next line's preview. */
const onStage = (walk, unit) => walk.done + 1 >= unit;

/** One layer box at its walk position. `dim` is Routing's untaken branch,
    which is pale for a reason of its own and carries no highlight. */
function unitBox(ctx, colors, x, y, w, label, color, walk, unit, o = {}) {
  const st = stageAt(walk, unit);
  if (st === "absent") return;
  layerBox(ctx, colors, x, y, w, label, color, {
    ...o,
    lit: walk.done === unit && !o.dim,
    pale: st === "preview" || Boolean(o.dim),
  });
}

/** One edge at its walk position: absent, a grey line with nothing written on
    it, or the path's own colour carrying the shape the line produced. */
function unitEdge(ctx, colors, cx, y0, y1, text, walk, unit, o = {}) {
  const st = stageAt(walk, unit);
  if (st === "absent") return null;
  if (st === "preview") return edge(ctx, colors, cx, y0, y1, "", { ...o, color: colors.axis });
  return edge(ctx, colors, cx, y0, y1, text, o);
}

/* the shade a band's cell carries, on the band's own largest magnitude. The
   alpha is separate because Routing's strips multiply it by the branch's
   weight, so a smaller weight is a paler row. */
const alphaOf = (v, hi) => 0.06 + 0.84 * Math.min(1, Math.abs(v) / (hi || 1));
const shadeOf = (hue, v, hi) => wash(hue, alphaOf(v, hi));
const maxAbs = (rows) => Math.max(...rows.flat().map(Math.abs));

/* ========================== 1 · Dimensions ================================= *
 * Cell 88, and the strongest losing state on the widget: the menu deliberately
 * holds layers that do not fit the step before them. There is no text column,
 * because the chain IS the code and it lives in the rail.
 */

function dimGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const n = state.steps.length;
  const last = state.steps[n - 1];
  const errRows = last && last.error ? wrapMono(ctx, colors, last.error, usable).length : 0;
  const bodyH = XLAB + 22 + n * BOX_H + (n - 1) * EDGE_H
    + (errRows ? 12 + errRows * LINE : EDGE_H);
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + bodyH + CAP_GAP;
  return { usable, n, errRows, bodyH, capY, caps, height: capY + caps.length * CAPTION_H + PAD };
}

/** The character span of each dimension in a printed shape. */
function shapeSpans(shape) {
  const spans = [];
  let at = 1;
  shape.forEach((v, i) => {
    const len = String(v).length;
    spans.push({ i, from: at, to: at + len });
    at += len + 2;
  });
  return spans;
}

/** Which dimensions the NEXT layer is about to change. */
function changedDims(shape, next) {
  if (!next) return [];
  if (next.kind === "conv2d" || next.kind === "maxpool2d") return [shape.length - 2, shape.length - 1];
  if (next.kind === "flatten") return shape.slice(1).map((_, i) => i + 1);
  if (next.kind === "linear") return [shape.length - 1];
  return [];
}

function drawDim(ctx, colors, w, params, state, anim) {
  const g = dimGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const cx = PAD + g.usable / 2;
  let y = band(ctx, colors, 0, w, "Dimensions", "each layer's output shape is the next one's input shape");

  const inText = `x  ${shapeText(state.set.shape)}`;
  txt(ctx, colors, inText, cx, y + 12, { color: colors.ink1, align: "center", mono: true });
  markDims(ctx, colors, inText, 3, state.set.shape, state.layers[0], cx, y + 16);
  let cy = y + XLAB + 6;
  arrow(ctx, cx, cy, cx, cy + 16, colors.groupA, 2);
  cy += 16;

  state.steps.forEach((s, i) => {
    /* THE FAILING BOX KEEPS ITS OWN HUE and wears the highlight frame instead.
       `--c-extreme` on the box would put the failure colour on the layer and on
       the message torch prints, in one panel, and the legend can then name only
       one of them. */
    const hue = i === state.steps.length - 1 && !state.failed ? colors.empirical
      : s.layer.kind === "relu" || s.layer.kind === "flatten" ? colors.ink2 : colors.groupB;
    const u = i + 1;
    unitBox(ctx, colors, cx - DIM_BOX_W / 2, cy, DIM_BOX_W, s.layer.label, hue, walk, u);
    cy += BOX_H;
    if (s.error) {
      if (landed(walk, u)) errorText(ctx, colors, PAD, cy + 24, g.usable, s.error);
      cy += 12 + g.errRows * LINE;
      return;
    }
    const shown = landed(walk, u);
    const text = shown ? shapeText(s.shape) : "";
    const last = i === state.steps.length - 1;
    unitEdge(ctx, colors, cx, cy, cy + EDGE_H, text, walk, u,
      { color: last ? colors.empirical : colors.groupB });
    if (shown) markDims(ctx, colors, text, 0, s.shape, state.layers[i + 1], cx, cy + EDGE_H / 2 + 9);
    cy += EDGE_H;
  });
  return g;
}

/** The dimension hue as a 2px rule UNDER the sizes the next layer changes,
    never on the text itself (principle 5). `skip` is how many characters of
    the drawn string come before the shape's opening bracket. */
function markDims(ctx, colors, text, skip, shape, next, cx, ruleY) {
  const dims = changedDims(shape, next);
  if (!dims.length) return;
  ctx.font = `${colors.fsSm} ${colors.mono}`;
  const cw = ctx.measureText("0").width;
  const tw = ctx.measureText(text).width;
  const x0 = cx - tw / 2 + skip * cw;
  for (const { i, from, to } of shapeSpans(shape)) {
    if (!dims.includes(i)) continue;
    ctx.fillStyle = colors.dims[(shape.length - 1 - i) % colors.dims.length];
    ctx.fillRect(x0 + from * cw, ruleY, (to - from) * cw, 2);
  }
}

/* ============================== 2 · Skip =================================== *
 * Cells 90-92. `y = x + f(x)`, and the add is where the widths have to agree.
 * The add is drawn as three bands (decision 19): x3 and skip stacked, the `+`
 * on the spine under them, and `out` below it — or torch's message in its row.
 */

const SKIP_BOX = 130;
const SKIP_RAIL = 60;     // the column the skip elbow runs down, from the right

/* the gradient overlay's up-arrow column, left of the spine: far enough that a
   factor label right-aligned beside it clears the widest edge label, `x3  [4, 10]`
   (at 26px the two collided, Kenneth's round 1) */
const GRAD_UX = 60;

function skipGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const cw = codeW(ctx, colors, state.code);
  const s = M.fitSizes(w, (z) => M.bandWidth.skip(z, cw));
  const diagW = usable - cw - TEXT_GAP;
  const grad = params.grad === "1";
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const ow = grad
    ? GRAD_UX + 8 + Math.ceil(Math.max(...M.SKIP_FACTORS.map(([, l]) => ctx.measureText(l).width)))
    : 0;
  const errRows = state.error ? wrapMono(ctx, colors, state.error, diagW).length : 0;
  const bandH = M.BATCH_N * s.band;
  const blockH = M.skipBlockH(bandH, state.match, errRows);
  /* the three bands of the add, and the layers above them: three boxes on
     their edges, then the x3 edge that feeds the first band */
  const bodyH = XLAB + 3 * (EDGE_H + BOX_H) + EDGE_H + blockH
    + (state.match ? EDGE_H + BOX_H + EDGE_H : 0);
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + bodyH + (grad ? 20 : 0) + CAP_GAP;
  const cx = PAD + ow + SKIP_BOX / 2 + 6;
  const railX = PAD + diagW - SKIP_RAIL;
  /* THE BLOCK IS AS CLOSE TO THE SPINE AS THE STAGE ALLOWS. Centred on the
     diagram it would leave the + standing beside its own bands at width 10;
     centred on the spine it would run off the left edge at width 20, where the
     widest band is 240px against a spine 85px from the edge. So the centre is
     the spine clamped into the room the rail leaves, on the widest band the
     page actually draws: at width 10 the block sits under the boxes with the +
     down its middle, and at 20 it opens out to both sides of the spine. */
  const blockW = Math.max(state.width, state.skipShape[1]) * s.band;
  return {
    usable, cw, s, diagW, ow, errRows, bandH, blockH, bodyH, grad, capY, caps, cx, railX,
    blockCx: Math.max(PAD + blockW / 2, Math.min(cx, railX - 10 - blockW / 2)),
    /* the top of the x3 band: the three boxes on their edges, and the x3 edge */
    blockTop: BAND_HEAD + XLAB + 3 * (EDGE_H + BOX_H) + EDGE_H,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

/** Where each band of the add sits, so `draw` and `regions` agree (5.8). The
    two operands stack, the + sits in the gap under them, and the result is the
    band below it — or, where the widths disagree, torch's message in its row. */
function skipBands(g, state) {
  const p = g.s.band;
  const top = g.blockTop;
  const at = (cols, y) => ({ x: g.blockCx - (cols * p) / 2, y, cols });
  const skipY = top + g.bandH + M.SKIP_BAND_GAP;
  const outY = skipY + g.bandH + M.SKIP_PLUS_GAP;
  return {
    x3: at(state.width, top),
    skip: at(state.skipShape[1], skipY),
    out: state.match ? at(state.width, outY) : null,
    plusY: skipY + g.bandH + M.SKIP_PLUS_GAP / 2,
    outY,
  };
}

function drawSkip(ctx, colors, w, params, state, anim) {
  const g = skipGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const { cx, railX } = g;
  const width = state.width;
  let y = band(ctx, colors, 0, w, "Skip", state.proj ? "y = P(x) + f(x)" : "y = x + f(x)");
  const top = y;
  codePanel(ctx, colors, PAD + g.diagW + TEXT_GAP, top + 20, g.cw, state.code, walk.lit);

  const Y = {};
  Y.e1 = y + XLAB;
  Y.fc1 = Y.e1 + EDGE_H;
  Y.e2 = Y.fc1 + BOX_H;
  Y.relu = Y.e2 + EDGE_H;
  Y.e3 = Y.relu + BOX_H;
  Y.fc2 = Y.e3 + EDGE_H;
  Y.e4 = Y.fc2 + BOX_H;
  Y.block = g.blockTop;             // the top of the x3 band, which is Y.e4 + EDGE_H
  Y.e5 = Y.block + g.blockH;
  Y.fcOut = Y.e5 + EDGE_H;
  Y.e6 = Y.fcOut + BOX_H;
  const bands = skipBands(g, state);

  txt(ctx, colors, "x", cx, y + 12, { color: colors.ink1, align: "center", mono: true });
  edge(ctx, colors, cx, Y.e1, Y.e1 + EDGE_H, shapeText([4, 10]), { color: colors.groupA });
  const boxes = [
    ["fc1", Y.fc1, colors.groupA, 2],
    ["relu", Y.relu, colors.groupA, 3],
    ["fc2", Y.fc2, colors.groupA, 4],
  ];
  for (const [label, by, hue, unit] of boxes) {
    unitBox(ctx, colors, cx - SKIP_BOX / 2, by, SKIP_BOX, label, hue, walk, unit);
  }
  unitEdge(ctx, colors, cx, Y.e2, Y.e2 + EDGE_H, shapeText([4, 20]), walk, 2,
    { color: colors.groupA });
  unitEdge(ctx, colors, cx, Y.e3, Y.e3 + EDGE_H, shapeText([4, 20]), walk, 3,
    { color: colors.groupA });
  unitEdge(ctx, colors, cx, Y.e4, Y.e4 + EDGE_H, `x3  ${shapeText([4, width])}`, walk, 4,
    { color: colors.empirical });

  /* DECISION 14 ON THIS PAGE: the rail, the + and the three bands belong to
     `out = x3 + skip`, which is the line where the two paths meet; `skip = x`
     previews the label and nothing else, and a projection box appears with the
     line that applies it. Kenneth's own split, 2026-09-10 round 1.

     A BAND IS A VALUE, NOT A LAYER, so the preview draws the + and the rail
     and leaves the three tensors to the line that computes them. */
  const { plusY } = bands;
  const sample = Number(params.sample);
  const teeY = y + 22;
  /* the skip path takes the second operand's hue where a projection makes it a
     tensor of its own, and the main path's where it is x carried past (11) */
  const skipHue = state.proj ? colors.groupB : colors.groupA;
  if (landed(walk, 5)) {
    const p = g.s.band;
    const hi3 = maxAbs(state.x3);
    shadedBand(ctx, colors, bands.x3.x, bands.x3.y, M.BATCH_N, bands.x3.cols, p,
      (r, c) => shadeOf(colors.groupA, state.x3[r][c], hi3), { litRow: sample });
    const hiS = maxAbs(state.skip);
    shadedBand(ctx, colors, bands.skip.x, bands.skip.y, M.BATCH_N, bands.skip.cols, p,
      (r, c) => shadeOf(skipHue, state.skip[r][c], hiS), { litRow: sample });
    if (bands.out) {
      const hiO = maxAbs(state.out);
      shadedBand(ctx, colors, bands.out.x, bands.out.y, M.BATCH_N, bands.out.cols, p,
        (r, c) => shadeOf(colors.empirical, state.out[r][c], hiO), { litRow: sample });
    }
  }
  if (onStage(walk, 5)) {
    plusNode(ctx, colors, cx, plusY, 14, landed(walk, 5)
      ? (state.match ? colors.empirical : colors.extreme)
      : colors.axis);
  }

  /* the skip path, down the right of the figure, both halves of his figure */
  /* `skip = x` (unit 1) draws the branch OFF x: the tee from x's edge to the
     rail column, with the label under its corner. The rail's descent and the
     + are unit 5's, where the two paths meet. Before this split the label
     stood alone at the rail column at rest, a word with nothing under it. */
  if (onStage(walk, 1)) {
    ctx.strokeStyle = landed(walk, 1) ? skipHue : colors.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, teeY);
    ctx.lineTo(railX + 1, teeY);
    /* with the projection on, the path INTO P is line 1's too, so the tee
       continues down to the proj box; the rail below it is the add line's */
    if (state.proj) {
      ctx.moveTo(railX, teeY);
      ctx.lineTo(railX, Y.relu);
    }
    ctx.stroke();
  }
  /* THE RAIL DELIVERS skip INTO ITS BAND, from the side and at mid-height,
     which is the turn Branching's second branch makes into a band its column
     stands clear of. Until the line runs there is no band to enter, so the
     preview reaches the + instead: a bus arm previews to the layers it feeds,
     and the values wait. */
  const railEndY = landed(walk, 5)
    ? bands.skip.y + g.bandH / 2 : plusY;
  const railEndX = landed(walk, 5)
    ? bands.skip.x + bands.skip.cols * g.s.band + 2 : cx + 18;
  if (onStage(walk, 5)) {
    elbow(ctx, [[railX, teeY], [railX, railEndY], [railEndX, railEndY]],
      landed(walk, 5) ? skipHue : colors.axis);
  }
  /* the label and P(x) are landed-only: a preview carries no labels (Kenneth,
     round 1: the projection read as shown before its line ran) */
  if (landed(walk, 1)) {
    ctx.font = `${colors.fsXs} ${colors.mono}`;
    const label = `skip  ${shapeText(state.skipShape)}`;
    const tw = ctx.measureText(label).width;
    const ly = state.proj ? Y.relu + BOX_H + 16 : teeY + 16;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(railX - tw / 2 - 4, ly - 9, tw + 8, 14);
    txt(ctx, colors, label, railX, ly,
      { color: landed(walk, 1) ? skipHue : colors.ink3, align: "center", mono: true, size: colors.fsXs });
  }
  if (state.proj && onStage(walk, 1)) {
    unitBox(ctx, colors, railX - 55, Y.relu, 110, "proj", colors.groupB, walk, 1);
    if (landed(walk, 1)) {
      txt(ctx, colors, "P(x)", railX, Y.relu - 6,
        { color: colors.groupB, align: "center", size: colors.fsXs });
    }
  }

  /* the message prints where the result band would be, so the two stacked
     operands are what the reader is looking at when it arrives */
  if (!state.match) {
    if (landed(walk, 5)) {
      errorText(ctx, colors, PAD, bands.outY + M.SKIP_ERR_GAP, g.diagW, state.error);
    }
  } else {
    unitEdge(ctx, colors, cx, Y.e5, Y.e5 + EDGE_H, `out  ${shapeText([4, width])}`, walk, 5,
      { color: colors.empirical });
    unitBox(ctx, colors, cx - SKIP_BOX / 2, Y.fcOut, SKIP_BOX, "fc_out", colors.empirical, walk, 6);
    unitEdge(ctx, colors, cx, Y.e6, Y.e6 + EDGE_H, shapeText([4, 2]), walk, 6,
      { color: colors.empirical });
  }

  /* THE LOCAL FACTORS, off by default and conditioned on there being a result
     to lie behind (3.4j): the same edges walked upwards, the two arriving at x
     adding to 1 + f′(x). */
  /* DECISION 14: a factor is written on an edge, so it waits for the edge. The
     leg on the input arrow is the bus's and needs no line to have run. */
  if (g.grad && state.match && walk.done > 0) {
    const ux = cx - GRAD_UX;
    const legs = [[Y.e6, "Wᵀ_out", 6], [Y.e5, "1", 5], [Y.e4, "Wᵀ₂", 4],
      [Y.e3, "f′(x1)", 3], [Y.e2, "Wᵀ₁", 2], [Y.e1, "", 0]];
    for (const [a, label, unit] of legs) {
      if (!landed(walk, unit)) continue;
      arrow(ctx, ux, a + EDGE_H, ux, a, colors.slope, 1.6, [], 7);
      if (label) {
        txt(ctx, colors, label, ux - 6, a + EDGE_H / 2 + 1,
          { color: colors.slope, align: "right", baseline: "middle", size: colors.fsXs });
      }
    }
    if (landed(walk, 5)) {
      /* the leg runs beside the rail, from where the rail ends: the block
         reaches its widest at 20 cells and the rail column is clear of it at
         both widths, so the gutter the arrow uses is empty */
      arrow(ctx, railX + 12, railEndY, railX + 12, teeY + 4, colors.slope, 1.6, [], 7);
      txt(ctx, colors, "1", railX + 18, (teeY + railEndY) / 2, { color: colors.slope, size: colors.fsXs });
    }
    if (landed(walk, state.units)) {
      txt(ctx, colors, "∂y/∂x = 1 + f′(x)", PAD, top + g.bodyH + 14, { color: colors.slope, mono: true });
    }
  }
  return g;
}

/* ============================= 3 · Gating ================================== *
 * Cells 93-95. One shaded band, on the `gated` edge, because that is where the
 * mask's blocked columns are the thing to see. Two bands side by side are
 * 502px against a 282px diagram column, which the mock measured.
 */

function gateGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const cw = codeW(ctx, colors, state.code);
  const s = M.fitSizes(w, (z) => M.bandWidth.gating(z, cw));
  const diagW = usable - cw - TEXT_GAP;
  const colW = Math.floor((diagW - COLGAP) / 2);
  const bandH = 4 * s.band;
  const gatedEdge = EDGE_H + bandH + 12;
  const diagH = XLAB + SPLIT_H + 2 * BOX_H + 2 * EDGE_H + BOX_H + gatedEdge + BOX_H + EDGE_H;
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + diagH + CAP_GAP;
  const c0 = PAD + colW / 2;
  const boxTop = BAND_HEAD + XLAB + SPLIT_H;
  const ringTop = boxTop + 2 * BOX_H + 2 * EDGE_H;
  const bandY = ringTop + BOX_H + EDGE_H + 6;
  return {
    usable, cw, s, diagW, colW, bandH, gatedEdge, diagH, caps, capY,
    c0, c1: PAD + colW + COLGAP + colW / 2, boxTop, ringTop, bandY,
    boxW: Math.min(colW - 8, 110),
    bandX: PAD,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawGate(ctx, colors, w, params, state, anim) {
  const g = gateGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const sample = Number(params.sample);
  const isMask = state.gate === "mask";
  let y = band(ctx, colors, 0, w, "Gating", "gated = h * g");
  codePanel(ctx, colors, PAD + g.diagW + TEXT_GAP, y + 26, g.cw, state.code, walk.lit);

  const cxAll = PAD + (2 * g.colW + COLGAP) / 2;
  txt(ctx, colors, `x  ${shapeText([4, 10])}`, cxAll, y + 12,
    { color: colors.ink1, align: "center", mono: true });
  const busY = y + XLAB + 12;
  /* DECISION 14: the bus reaches the first line's column at every walk
     position, and the gate column's own arm appears with the line that fills
     it — pale as a preview, then in the gate path's colour. */
  ctx.strokeStyle = colors.groupA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxAll, y + XLAB);
  ctx.lineTo(cxAll, busY);
  ctx.lineTo(g.c0, busY);
  ctx.stroke();
  arrow(ctx, g.c0, busY, g.c0, g.boxTop, colors.groupA, 2);
  if (!isMask && onStage(walk, 2)) {
    const arm = landed(walk, 2) ? colors.groupB : colors.axis;
    ctx.strokeStyle = arm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxAll, busY);
    ctx.lineTo(g.c1, busY);
    ctx.stroke();
    arrow(ctx, g.c1, busY, g.c1, g.boxTop, arm, 2);
  }

  /* the main path */
  unitBox(ctx, colors, g.c0 - g.boxW / 2, g.boxTop, g.boxW, "fc1", colors.groupA, walk, 1);
  unitEdge(ctx, colors, g.c0, g.boxTop + BOX_H, g.boxTop + BOX_H + EDGE_H,
    shapeText([4, 20]), walk, 1, { color: colors.groupA });
  unitBox(ctx, colors, g.c0 - g.boxW / 2, g.boxTop + BOX_H + EDGE_H, g.boxW, "relu",
    colors.groupA, walk, 1);
  unitEdge(ctx, colors, g.c0, g.boxTop + 2 * BOX_H + EDGE_H, g.ringTop + 2,
    `h  ${shapeText([4, 20])}`, walk, 1, { color: colors.groupA });

  /* the gate path. A fixed mask is a tensor the reader wrote, so at `mask` the
     column holds one tile, no layers, and nothing flows into it from x. */
  const ringY = g.ringTop + 15;
  if (isMask) {
    unitBox(ctx, colors, g.c1 - g.boxW / 2, g.boxTop + BOX_H + EDGE_H, g.boxW, "mask",
      colors.groupB, walk, 2);
  } else {
    unitBox(ctx, colors, g.c1 - g.boxW / 2, g.boxTop, g.boxW, "gate_fc", colors.groupB, walk, 2);
    unitEdge(ctx, colors, g.c1, g.boxTop + BOX_H, g.boxTop + BOX_H + EDGE_H,
      shapeText([4, 20]), walk, 2, { color: colors.groupB });
    unitBox(ctx, colors, g.c1 - g.boxW / 2, g.boxTop + BOX_H + EDGE_H, g.boxW, "sigmoid",
      colors.groupB, walk, 2);
  }
  if (landed(walk, 2)) {
    txt(ctx, colors, `${isMask ? "mask" : "g"}  ${shapeText([4, 20])}`,
      g.c1, g.boxTop + 2 * BOX_H + EDGE_H + 15,
      { color: colors.ink1, align: "center", baseline: "middle", mono: true });
    elbow(ctx, [[g.c1, g.boxTop + 2 * BOX_H + EDGE_H + 24], [g.c1, ringY], [g.c0 + 18, ringY]],
      colors.groupB);
    txt(ctx, colors, isMask ? "0 or 1" : "0 to 1", (g.c0 + g.c1) / 2 + 10, ringY - 6,
      { color: colors.groupB, align: "center", size: colors.fsXs, mono: true });
  }
  if (onStage(walk, 3)) {
    ringNode(ctx, colors, g.c0, ringY, 13, landed(walk, 3) ? colors.ink1 : colors.axis);
  }

  /* the gated edge, and its band. A BAND IS A VALUE, NOT A LAYER (decision 14),
     so the preview draws the edge and the ⊙ and leaves the band to its line. */
  const gatedTop = g.ringTop + BOX_H;
  const fc2Top = gatedTop + g.gatedEdge;
  unitEdge(ctx, colors, g.c0, gatedTop, gatedTop + EDGE_H,
    `gated  ${shapeText([4, 20])}`, walk, 3, { color: colors.empirical });
  if (landed(walk, 3)) {
    const hi = maxAbs(state.gated);
    shadedBand(ctx, colors, g.bandX, g.bandY, 4, 20, g.s.band,
      (r, c) => shadeOf(colors.empirical, state.gated[r][c], hi), {
        litRow: sample,
        emptyAt: (r, c) => isMask && state.mask[c] === 0,
      });
    const bw = 20 * g.s.band;
    txt(ctx, colors, `sample ${sample}`, g.bandX + bw + 8, g.bandY + sample * g.s.band + g.s.band / 2 + 1,
      { color: colors.highlight, baseline: "middle", size: colors.fsXs });
    txt(ctx, colors, `${20 - state.blocked} of 20 features carry a value`,
      g.bandX + bw + 8, g.bandY + g.bandH - 4, { color: colors.ink3, size: colors.fsXs });
    arrow(ctx, g.c0, gatedTop + g.gatedEdge - 6, g.c0, fc2Top, colors.empirical, 2);
  }
  unitBox(ctx, colors, g.c0 - g.boxW / 2, fc2Top, g.boxW, "fc2", colors.empirical, walk, 4);
  unitEdge(ctx, colors, g.c0, fc2Top + BOX_H, fc2Top + BOX_H + EDGE_H,
    shapeText([4, 2]), walk, 4, { color: colors.empirical });
  return g;
}

/* =========================== 4 · Branching ================================= *
 * Cells 96-98. fc3 is sized for the merge (decision 18), so five of the six
 * combinations run to `[4, 2]` and the one that raises is the notebook's own:
 * `add` or `average` on unequal widths, which raises where the sum band would
 * have been and leaves the two operands stacked above it.
 */

function branchGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const cw = codeW(ctx, colors, state.code);
  const s = M.fitSizes(w, (z) => M.bandWidth.branching(z, cw));
  const diagW = usable - cw - TEXT_GAP;
  const colW = Math.floor((diagW - COLGAP) / 2);
  const bandH = 4 * s.band;
  const elementwise = state.merge !== "concat";
  const mergeErrRows = state.mergeError
    ? wrapMono(ctx, colors, state.mergeError, diagW).length : 0;
  const mergeH = elementwise
    ? (state.mergeError
      ? 2 * bandH + 8 + mergeErrRows * LINE + 18
      : 3 * bandH + 20)
    : bandH;
  const tailH = state.mergeError ? BOX_H : EDGE_H + BOX_H + EDGE_H;
  const diagH = XLAB + SPLIT_H + 2 * BOX_H + 2 * EDGE_H + mergeH + tailH;
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + diagH + CAP_GAP;
  const mergeTop = BAND_HEAD + XLAB + SPLIT_H + 2 * BOX_H + 2 * EDGE_H;
  return {
    usable, cw, s, diagW, colW, bandH, mergeH, mergeErrRows, elementwise, diagH,
    caps, capY, mergeTop,
    c0: PAD + colW / 2,
    c1: PAD + colW + COLGAP + colW / 2,
    boxW: Math.min(colW - 8, 110),
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

/** Where each band of the merge sits, so `draw` and `regions` agree (5.8). */
function branchBands(g, state) {
  const p = g.s.band;
  const w1 = 8 * p;
  const w2 = state.fc2 * p;
  if (g.elementwise) {
    return {
      b1: { x: PAD + (g.diagW - w1) / 2, y: g.mergeTop, cols: 8 },
      b2: { x: PAD + (g.diagW - w2) / 2, y: g.mergeTop + g.bandH + 4, cols: state.fc2 },
      sum: state.mergeError
        ? null
        : { x: PAD + (g.diagW - w1) / 2, y: g.mergeTop + 2 * g.bandH + 12, cols: 8 },
    };
  }
  const total = w1 + w2;
  const x = PAD + (g.diagW - total) / 2;
  return {
    b1: { x, y: g.mergeTop, cols: 8 },
    b2: { x: x + w1, y: g.mergeTop, cols: state.fc2 },
    sum: null,
  };
}

function drawBranch(ctx, colors, w, params, state, anim) {
  const g = branchGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const sample = Number(params.sample);
  const p = g.s.band;
  const EXPR = { concat: "y = concat(f₁(x), f₂(x))", add: "y = f₁(x) + f₂(x)", average: "y = ½(f₁(x) + f₂(x))" };
  let y = band(ctx, colors, 0, w, "Branching", EXPR[state.merge]);
  codePanel(ctx, colors, PAD + g.diagW + TEXT_GAP, y + 26, g.cw, state.code, walk.lit);

  const cxAll = PAD + (2 * g.colW + COLGAP) / 2;
  txt(ctx, colors, `x  ${shapeText([4, 10])}`, cxAll, y + 12,
    { color: colors.ink1, align: "center", mono: true });
  const busY = y + XLAB + 12;
  const boxTop = y + XLAB + SPLIT_H;
  /* DECISION 14, Kenneth's own wording: at rest the bus reaches only the first
     line's column, and the second arm appears pale with fc2 and its relu,
     which are line 2's. */
  ctx.strokeStyle = colors.groupA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxAll, y + XLAB);
  ctx.lineTo(cxAll, busY);
  ctx.lineTo(g.c0, busY);
  ctx.stroke();
  arrow(ctx, g.c0, busY, g.c0, boxTop, colors.groupA, 2);
  if (onStage(walk, 2)) {
    const arm = landed(walk, 2) ? colors.groupB : colors.axis;
    ctx.strokeStyle = arm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxAll, busY);
    ctx.lineTo(g.c1, busY);
    ctx.stroke();
    arrow(ctx, g.c1, busY, g.c1, boxTop, arm, 2);
  }

  const bands = branchBands(g, state);
  const branches = [
    { cx: g.c0, hue: colors.groupA, name: "fc1", n: 8, unit: 1, out: "x1", band: bands.b1 },
    { cx: g.c1, hue: colors.groupB, name: "fc2", n: state.fc2, unit: 2, out: "x2", band: bands.b2 },
  ];
  for (const b of branches) {
    unitBox(ctx, colors, b.cx - g.boxW / 2, boxTop, g.boxW, b.name, b.hue, walk, b.unit);
    unitEdge(ctx, colors, b.cx, boxTop + BOX_H, boxTop + BOX_H + EDGE_H,
      shapeText([4, b.n]), walk, b.unit, { color: b.hue });
    unitBox(ctx, colors, b.cx - g.boxW / 2, boxTop + BOX_H + EDGE_H, g.boxW, "relu",
      b.hue, walk, b.unit);
    /* DECISION 9, AMENDED IN ROUND 1: the edge APPEARS WITH ITS BAND, and it
       enters the band straight from above when its column stands over the
       band (concat lays the two side by side under their own columns) and
       from the SIDE at mid-height when the column stands clear of it (add
       stacks two centred bands, so both columns are beside them). The elbow
       that arrived from the top had its head at the bend, and at add its
       horizontal leg crossed the first band on the way to the second
       (Kenneth, round 1: "the arrows below shouldn't be shown until we reach
       that stage", "some of the arrowheads are too close to the bends"). */
    const from = boxTop + 2 * BOX_H + EDGE_H;
    if (landed(walk, b.unit)) {
      const label = `${b.out}  ${shapeText([4, b.n])}`;
      const bandW = b.band.cols * p;
      const over = b.cx >= b.band.x + 6 && b.cx <= b.band.x + bandW - 6;
      if (over) {
        edge(ctx, colors, b.cx, from, b.band.y - 2, label, { color: b.hue });
      } else {
        const midY = b.band.y + (4 * p) / 2;
        const endX = b.cx < b.band.x ? b.band.x - 2 : b.band.x + bandW + 2;
        elbow(ctx, [[b.cx, from], [b.cx, midY], [endX, midY]], b.hue);
        edgeLabel(ctx, colors, b.cx, from + EDGE_H / 2, label);
      }
    }
  }

  const mid = PAD + g.diagW / 2;
  if (landed(walk, 1)) {
    const hi1 = maxAbs(state.x1);
    shadedBand(ctx, colors, bands.b1.x, bands.b1.y, 4, 8, p,
      (r, c) => shadeOf(colors.groupA, state.x1[r][c], hi1), { litRow: sample });
  }
  if (landed(walk, 2)) {
    const hi2 = maxAbs(state.x2);
    shadedBand(ctx, colors, bands.b2.x, bands.b2.y, 4, state.fc2, p,
      (r, c) => shadeOf(colors.groupB, state.x2[r][c], hi2), { litRow: sample });
  }

  const afterBands = g.mergeTop + (g.elementwise ? 2 * g.bandH + 4 : g.bandH);
  if (state.mergeError) {
    /* what fc3 was built for is read off the failure, so it arrives with it */
    if (landed(walk, 3)) {
      errorText(ctx, colors, PAD, afterBands + 22, g.diagW, state.mergeError);
      txt(ctx, colors, `fc3 expects ${state.fc3In}`, mid, g.mergeTop + g.mergeH + BOX_H / 2,
        { color: colors.ink3, align: "center", baseline: "middle", mono: true });
    }
    return g;
  }

  if (landed(walk, 3) && bands.sum) {
    const hiS = maxAbs(state.merged);
    shadedBand(ctx, colors, bands.sum.x, bands.sum.y, 4, 8, p,
      (r, c) => shadeOf(colors.empirical, state.merged[r][c], hiS), { litRow: sample });
  }
  const outTop = g.mergeTop + g.mergeH;
  unitEdge(ctx, colors, mid, outTop, outTop + EDGE_H,
    `x3  ${shapeText([4, state.feats])}`, walk, 3, { color: colors.empirical });
  unitBox(ctx, colors, mid - g.boxW / 2, outTop + EDGE_H, g.boxW, "fc3",
    colors.empirical, walk, 4);
  unitEdge(ctx, colors, mid, outTop + EDGE_H + BOX_H, outTop + 2 * EDGE_H + BOX_H,
    shapeText([4, 2]), walk, 4, { color: colors.empirical });
  return g;
}

/* ============================= 5 · Routing ================================= *
 * Cells 99-101. Three branch columns and a gate column, and the four fit at
 * 770 only because the layer sizes sit on the edges rather than inside the
 * boxes: `Linear(10, 20)` inside a box is 86px of label and needs a 104px box,
 * where `Linear` alone needs 60.
 *
 * THE BOX UNDER THE BRANCHES HOLDS THE SUM IT IS NAMED FOR. It used to hold
 * its label and nothing else, and Kenneth on review: "is there supposed to be
 * a depiction of weighted sums?" `_lab/composition-routing-sum.html` drew four
 * answers at both widths; C was built first — the chosen sample's row from each
 * branch as one strip of 20 cells — and his next question was why a `[4, 20]`
 * branch showed one row of it, so the block is now D, the mock's §4: THE WHOLE
 * TENSOR. Three bands of 4 rows by 20 cells, one per branch in its hue, each
 * cell shaded as the product `weights[s][i] × outs[i][s][c]` against one
 * maximum over every product and total, the row's alpha then scaled by that
 * row's own weight so paleness IS the multiply; a weight column of four digits
 * beside each band, a rule, and the combined band under it. The block is the
 * mock's geometry, constant for constant.
 *
 * AND IT IS WHY THE CODE SITS UNDER THE DIAGRAM AT BOTH WIDTHS. Twenty cells
 * and their labels need 376px of box at 12px and 456px at 16px; beside the
 * 350px code column at 770 the box is 259px, which draws the cells at 6px. The
 * fit pass finds the width by moving the code. D's width is C's exactly — the
 * right-hand column is reserved at the same measurement — so only the height
 * moved: the box is 263px at 550 and 327 at 770 in both modes, and the page
 * 804px at 550 and 851 at 770.
 */

/* THE GATE'S WEIGHTS ARE DRAWN AS THE [4, 3] TENSOR THEY ARE, four rows of
   three cells, with the chosen sample's row lit. The mock drew the chosen
   sample's row alone, which left the four rows the plan makes `regions` with
   nothing on the canvas to hit — and a target that is not drawn is exactly
   what no pixel hash can catch (3.6). Four rows cost 34px of height. */
const WROW = 16;
const WBLOCK = 4 * WROW;

/** The block's two reserved label columns, measured on the live canvas: the
    branch's name at the left, and the widest thing the right column carries —
    its labels, and the weight cell, which is at its widest on the 770
    geometry. `model.js` holds the same two numbers for the verify script,
    which has no canvas to ask — the arrangement `MONO_SM` already uses. */
function sumLabels(ctx, colors) {
  const at = (s) => {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    return Math.ceil(ctx.measureText(s).width);
  };
  return {
    labL: Math.max(...[1, 2, 3].map((i) => at(`branch ${i}`))),
    labR: Math.max(at("combined"), at("not taken"), at("taken"), at("weights"),
      M.sizesAt(1).wcell),
  };
}

function routeGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  /* the column is reserved at the widest form, so the diagram does not move
     when the reader switches modes (the mock's own decision) */
  const cw = codeW(ctx, colors, state.codeWidest);
  const { labL, labR } = sumLabels(ctx, colors);
  const fixed = M.routeSumFixed(labL, labR);
  const s0 = M.sizesAt(Math.max(0, Math.min(1, (w - 550) / 220)));
  const beside = M.besideFits(w, cw, M.routeDiagMin(s0, fixed));
  const s = M.fitSizes(w, (z) => M.bandWidth.routing(z, cw, beside, fixed));
  const gateW = 3 * s.wcell;
  const roomy = beside ? usable - cw - TEXT_GAP : usable;
  const diagW = Math.max(roomy, M.routeDiagMin(s, fixed));
  const branchW = Math.floor((diagW - gateW - 3 * COLGAP) / 3);
  const boxTop = BAND_HEAD + XLAB + ROUTE_SPLIT;
  const cols = [0, 1, 2].map((i) => PAD + i * (branchW + COLGAP) + branchW / 2);
  /* the box spans the three branch columns, and the block is centred in it:
     at 770 the box is 607px against a 456px block, and a block pinned to the
     left edge reads as a box that lost its right-hand contents */
  const boxL = cols[0] - branchW / 2;
  const boxR = cols[2] + branchW / 2;
  const boxWidth = boxR - boxL;
  const p = Math.min(s.band, Math.floor((boxWidth - fixed) / M.ROUTE_HIDDEN));
  const boxH = Math.max(WBLOCK, M.routeSumH(p));
  /* the printed line's row is reserved whether or not there is a line to put
     in it, so the stage does not move under a pointer */
  const diagH = XLAB + ROUTE_SPLIT + 3 * BOX_H + boxH + M.SUM_ARITH + 4 * EDGE_H;
  const codeH = state.code.length * LINE;
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + diagH + 12 + (beside ? 0 : codeH + 10) + CAP_GAP;
  return {
    usable, cw, s, beside, gateW, roomy, diagW, branchW, diagH, codeH, caps, capY, boxTop, cols,
    labL, labR, fixed, p, boxL, boxR, boxWidth, boxH,
    gateCx: PAD + 3 * (branchW + COLGAP) + gateW / 2,
    boxW: Math.min(branchW, 92),
    weightsY: boxTop + 2 * BOX_H + 2 * EDGE_H,
    blockX: boxL + Math.round((boxWidth - (fixed + M.ROUTE_HIDDEN * p)) / 2),
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

/**
 * WHERE THE BLOCK'S FOUR BANDS SIT. `draw` and `regions` both read this, so a
 * row the reader can click cannot be anywhere but where the row is drawn
 * (5.8) — and that geometry is exactly what no pixel hash can see, since the
 * picture is the same whether the target is on the row or six columns away.
 */
function routeSumGeom(g) {
  const p = g.p;
  const labX = g.blockX + M.SUM_PAD + M.SUM_OPW + M.SUM_OPGAP;
  const cellX = labX + g.labL + M.SUM_LGAP;
  const y0 = g.weightsY + M.SUM_PAD + M.SUM_HEAD;
  const bandH = M.ROUTE_SAMPLES * p;
  const bandY = [0, 1, 2].map((i) => y0 + i * (bandH + M.SUM_GAP));
  return {
    p,
    bandH,
    bandW: M.ROUTE_HIDDEN * p,
    opX: g.blockX + M.SUM_PAD + M.SUM_OPW / 2,
    labX,
    cellX,
    rightX: cellX + M.ROUTE_HIDDEN * p + M.SUM_RGAP,
    bandY,
    sumY: bandY[2] + bandH + M.SUM_RULE,
  };
}

/**
 * The block inside the box: three branch bands, a rule, and the combined band,
 * laid out as an equation. Every band is the whole [4, 20] tensor the edge
 * above it names, so the four rows of a band are the four samples and the
 * chosen one is lit in all four bands. Returns the column it framed, which is
 * the one under the pointer where there is one and `routeRestColumn`'s
 * otherwise.
 */
function drawSumBlock(ctx, colors, g, state, sample, hard, pointer) {
  const HUES = [colors.groupA, colors.groupB, colors.groupC];
  const b = routeSumGeom(g);
  const p = b.p;
  /* at `soft` a cell is the PRODUCT one branch contributes, so the three bands
     are an addition the reader can read down; at `hard` a sample has a row in
     the band it took and nothing at all in the other two, drawn as empty cells.
     ONE maximum over every product and every total, so the three bands are
     comparable with each other and with the combined band under them. */
  const prod = M.routeProducts(state);
  const hi = Math.max(maxAbs(prod.flat().filter(Boolean)), maxAbs(state.combined));

  [0, 1, 2].forEach((i) => {
    if (i > 0) {
      txt(ctx, colors, "+", b.opX, b.bandY[i] + b.bandH / 2 + 0.5,
        { color: colors.ink3, align: "center", baseline: "middle" });
    }
    txt(ctx, colors, `branch ${i + 1}`, b.labX, b.bandY[i] + b.bandH / 2 + 0.5,
      { color: HUES[i], baseline: "middle", size: colors.fsXs });
    /* the weight rides on the row twice — in the product and again in the
       alpha — so a branch a sample barely takes reads as a pale row rather
       than as a digit to look up */
    shadedBand(ctx, colors, b.cellX, b.bandY[i], M.ROUTE_SAMPLES, M.ROUTE_HIDDEN, p,
      (r, c) => wash(HUES[i], alphaOf(prod[i][r] ? prod[i][r][c] : 0, hi)
        * (hard ? 1 : state.weights[r][i])),
      { litRow: sample, emptyAt: (r) => !prod[i][r] });
    for (let r = 0; r < M.ROUTE_SAMPLES; r += 1) {
      if (hard) {
        /* one word per row rather than one per band, because here a row is a
           sample and each sample takes a branch of its own */
        txt(ctx, colors, state.top[r] === i ? "taken" : "not taken",
          b.rightX, b.bandY[i] + r * p + p / 2 + 0.5, {
            color: state.top[r] === i ? colors.ink1 : colors.ink3,
            baseline: "middle", size: colors.fsXs,
          });
      } else {
        valueCell(ctx, colors, b.rightX, b.bandY[i] + r * p, g.s.wcell, p,
          state.weights[r][i].toFixed(2),
          { hue: HUES[i], lit: r === sample, size: colors.fsXs });
      }
    }
  });

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(b.labX, b.sumY - M.SUM_RULE / 2 + 0.5);
  ctx.lineTo(b.rightX + (hard ? g.labR : g.s.wcell), b.sumY - M.SUM_RULE / 2 + 0.5);
  ctx.stroke();
  txt(ctx, colors, "=", b.opX, b.sumY + b.bandH / 2 + 0.5,
    { color: colors.ink3, align: "center", baseline: "middle" });
  shadedBand(ctx, colors, b.cellX, b.sumY, M.ROUTE_SAMPLES, M.ROUTE_HIDDEN, p,
    (r, c) => shadeOf(colors.empirical, state.combined[r][c], hi), { litRow: sample });
  txt(ctx, colors, "combined", b.rightX, b.sumY + b.bandH / 2 + 0.5,
    { color: colors.empirical, baseline: "middle", size: colors.fsXs });
  /* soft only: at hard the column is already words, and a header over it would
     say the same thing twice */
  if (!hard) {
    txt(ctx, colors, "weights", b.rightX, b.bandY[0] - 4,
      { color: colors.ink3, size: colors.fsXs });
  }

  /* THE COLUMN THE POINTER IS OVER, resolved here because the frame has to
     know it before the line under the box is printed. The hit is arithmetic on
     the framed rectangle itself, so the target cannot sit anywhere but where
     it is drawn. */
  const over = pointer
    && pointer.x >= b.cellX && pointer.x < b.cellX + b.bandW
    && pointer.y >= b.bandY[0] && pointer.y < b.sumY + b.bandH
    ? Math.floor((pointer.x - b.cellX) / p)
    : -1;
  const col = over >= 0 ? over : M.routeRestColumn(state, sample);
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = HLW;
  ctx.strokeRect(b.cellX + col * p - 1.25, b.bandY[0] - 1.25,
    p + 2.5, b.sumY + b.bandH - b.bandY[0] + 2.5);
  return col;
}

/** The framed column's arithmetic, one line under the box, each product in the
    hue of the branch it came from. */
function drawSumLine(ctx, colors, g, state, sample, hard, col) {
  const HUES = [colors.groupA, colors.groupB, colors.groupC];
  const n2 = (v) => v.toFixed(2);
  const y = g.weightsY + g.boxH + 16;
  let x = g.blockX + M.SUM_PAD;
  const put = (s, color) => {
    txt(ctx, colors, s, x, y, { color, mono: true });
    x += ctx.measureText(s).width;
  };
  put(`combined[${sample}, ${col}] = `, colors.ink2);
  if (hard) {
    const t = state.top[sample];
    put(n2(state.outs[t][sample][col]), HUES[t]);
    put(`, from branch ${t + 1}`, colors.ink2);
    return;
  }
  [0, 1, 2].forEach((i) => {
    if (i > 0) put(" + ", colors.ink3);
    put(`${n2(state.weights[sample][i])} × ${n2(state.outs[i][sample][col])}`, HUES[i]);
  });
  put(" = ", colors.ink3);
  put(n2(state.combined[sample][col]), colors.empirical);
}

function drawRoute(ctx, colors, w, params, state, anim, pointer) {
  const g = routeGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const sample = Number(params.sample);
  const hard = state.mode === "hard";
  let y = band(ctx, colors, 0, w, "Routing",
    hard ? "y = f₁(x) if condition(x) else f₂(x)" : "y = Σ αᵢ(x) fᵢ(x)");
  const top = y;

  const usedW = 3 * (g.branchW + COLGAP) + g.gateW;
  const cxAll = PAD + usedW / 2;
  txt(ctx, colors, `x  ${shapeText([4, 10])}`, cxAll, y + 12,
    { color: colors.ink1, align: "center", mono: true });
  const busY = y + XLAB + 12;
  /* DECISION 14: line 1 is the router, so at rest the bus reaches the gate
     column alone; the three branch arms are line 2's and arrive with it. */
  ctx.strokeStyle = colors.groupA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxAll, y + XLAB);
  ctx.lineTo(cxAll, busY);
  ctx.lineTo(g.gateCx, busY);
  ctx.stroke();
  arrow(ctx, g.gateCx, busY, g.gateCx, g.boxTop, colors.groupA, 2);
  if (onStage(walk, 2)) {
    const arm = landed(walk, 2) ? colors.groupA : colors.axis;
    ctx.strokeStyle = arm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.cols[0], busY);
    ctx.lineTo(cxAll, busY);
    ctx.stroke();
    for (const cx of g.cols) arrow(ctx, cx, busY, cx, g.boxTop, arm, 2);
  }

  const HUES = [colors.groupA, colors.groupB, colors.groupC];
  const weightsY = g.weightsY;
  const taken = hard ? state.top[sample] : -1;
  g.cols.forEach((cx, i) => {
    const off = hard && walk.done >= 4 && i !== taken;
    unitBox(ctx, colors, cx - g.boxW / 2, g.boxTop, g.boxW, "Linear", HUES[i], walk, 2, { dim: off });
    unitEdge(ctx, colors, cx, g.boxTop + BOX_H, g.boxTop + BOX_H + EDGE_H,
      shapeText([4, 20]), walk, 2, { color: HUES[i] });
    unitBox(ctx, colors, cx - g.boxW / 2, g.boxTop + BOX_H + EDGE_H, g.boxW, "ReLU",
      HUES[i], walk, 2, { dim: off });
    /* the stack is line 3, and it is three edges and nothing else */
    unitEdge(ctx, colors, cx, g.boxTop + 2 * BOX_H + EDGE_H, weightsY,
      shapeText([4, 20]), walk, 3, { color: HUES[i] });
    if (onStage(walk, 2)) {
      txt(ctx, colors, `branch ${i + 1}`, cx, g.boxTop - 6,
        { color: landed(walk, 2) ? HUES[i] : colors.ink3, align: "center", size: colors.fsXs });
    }
  });

  /* the gate column, in ink because it is not a branch */
  unitBox(ctx, colors, g.gateCx - g.gateW / 2 + 8, g.boxTop, g.gateW - 16, "gate",
    colors.ink2, walk, 1);
  unitEdge(ctx, colors, g.gateCx, g.boxTop + BOX_H, g.boxTop + BOX_H + EDGE_H,
    shapeText([4, 3]), walk, 1, { color: colors.ink3 });
  unitBox(ctx, colors, g.gateCx - g.gateW / 2 + 8, g.boxTop + BOX_H + EDGE_H, g.gateW - 16,
    "softmax", colors.ink2, walk, 1);
  unitEdge(ctx, colors, g.gateCx, g.boxTop + 2 * BOX_H + EDGE_H, weightsY,
    shapeText([4, 3]), walk, 1, { color: colors.ink3 });
  txt(ctx, colors, "gate", g.gateCx, g.boxTop - 6,
    { color: colors.ink3, align: "center", size: colors.fsXs });

  const sumL = g.boxL;
  const sumR = g.boxR;
  /* THE BOX IS LINE 5'S, so it arrives pale when line 4 lands and fills when
     line 5 does; the weights are line 1's and are drawn as values or not at
     all, because a value grid is a result and a result waits for its line. */
  if (onStage(walk, 5)) {
    outlineBox(ctx, colors, sumL, weightsY, g.boxWidth, g.boxH, "",
      landed(walk, 5) ? colors.empirical : colors.axis);
  }
  if (landed(walk, 5)) {
    /* the box's name is the block's caption, at its top left, because the
       middle of the box is where the strips go */
    txt(ctx, colors, hard ? `branch ${taken >= 0 ? taken + 1 : "·"} taken` : "weighted sum",
      sumL + M.SUM_PAD, weightsY + M.SUM_PAD + 10, { color: colors.ink3, size: colors.fsXs });
  }
  if (landed(walk, 1)) {
    for (let r = 0; r < 4; r += 1) {
      for (let i = 0; i < 3; i += 1) {
        valueCell(ctx, colors, g.gateCx - g.gateW / 2 + i * g.s.wcell, weightsY + r * WROW,
          g.s.wcell, WROW, state.weights[r][i].toFixed(2), {
            hue: HUES[i],
            lit: r === sample && i === state.top[r],
            size: colors.fsXs,
          });
      }
    }
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = HLW;
    ctx.strokeRect(g.gateCx - g.gateW / 2 - 1.25, weightsY + sample * WROW - 1.25,
      3 * g.s.wcell + 2.5, WROW + 2.5);
  }
  /* the weights reaching the sum is line 4 — the unsqueeze at soft, the argmax
     at hard, which is also what dims the two branches a sample did not take */
  if (landed(walk, 4)) {
    arrow(ctx, g.gateCx - g.gateW / 2 - 2, weightsY + WBLOCK / 2, sumR + 4, weightsY + WBLOCK / 2,
      colors.ink3, 2);
  }

  /* THE BLOCK APPEARS WITH THE LINE THAT COMPUTES IT — unit 5, which is
     `combined = torch.sum(weights * outs, dim=1)` and its hard-routing
     equivalent. */
  if (landed(walk, 5)) {
    const col = drawSumBlock(ctx, colors, g, state, sample, hard, pointer);
    drawSumLine(ctx, colors, g, state, sample, hard, col);
  }

  const fcTop = weightsY + g.boxH + M.SUM_ARITH + EDGE_H;
  const sumCx = (sumL + sumR) / 2;
  unitEdge(ctx, colors, sumCx, weightsY + g.boxH + M.SUM_ARITH, fcTop,
    `combined  ${shapeText([4, 20])}`, walk, 5, { color: colors.empirical });
  unitBox(ctx, colors, sumCx - 46, fcTop, 92, "fc_out", colors.empirical, walk, 6);
  unitEdge(ctx, colors, sumCx, fcTop + BOX_H, fcTop + BOX_H + EDGE_H,
    shapeText([4, 2]), walk, 6, { color: colors.empirical });

  if (g.beside) {
    codePanel(ctx, colors, PAD + g.roomy + TEXT_GAP, top + 26, g.cw, state.code, walk.lit);
  } else {
    codePanel(ctx, colors, PAD, top + g.diagH + 22, g.cw, state.code, walk.lit);
  }
  return g;
}

/* ============================= 6 · Building ================================ *
 * Cells 63-80. MLP1 and MLP2 compute the same function and print differently,
 * and the print is the page's whole argument, so it is the column that gets
 * the fit pass: under the diagram at 550, beside it at 770.
 */

function buildGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const tw = codeW(ctx, colors, state.text);
  const cw = state.code ? codeW(ctx, colors, state.code) : 0;
  const codeGap = state.code ? cw + TEXT_GAP : 0;
  const beside = M.besideFits(w, tw + codeGap, BOX_W);
  const n = state.steps.length;
  const bodyH = XLAB + (n + 1) * EDGE_H + n * BOX_H;
  const textH = state.text.length * LINE;
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + (beside ? Math.max(bodyH, textH + 20) : bodyH + 16 + textH) + CAP_GAP;
  const diagW = usable - codeGap - (beside ? tw + TEXT_GAP : 0);
  return {
    usable, tw, cw, codeGap, beside, n, bodyH, textH, caps, capY, diagW,
    cx: PAD + diagW / 2,
    height: capY + caps.length * CAPTION_H + PAD,
  };
}

function drawBuild(ctx, colors, w, params, state, anim) {
  const g = buildGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  const title = { flat: "Building · Sequential", blocks: "Building · Sequential of blocks", all: "Building · MLP1", learnable: "Building · MLP2" }[state.key];
  let y = band(ctx, colors, 0, w, title,
    params.show === "summary" ? "summary(model, input_size=(10,))" : "print(model)");
  const top = y;

  txt(ctx, colors, "x", g.cx, y + 12, { color: colors.ink1, align: "center", mono: true });
  let cy = y + XLAB;
  edge(ctx, colors, g.cx, cy, cy + EDGE_H, shapeText([4, 10]), { color: colors.groupA });
  cy += EDGE_H;
  state.steps.forEach(([label, out], i) => {
    const last = i === g.n - 1;
    const hue = last ? colors.empirical : colors.groupA;
    unitBox(ctx, colors, g.cx - BOX_W / 2, cy, BOX_W, label, hue, walk, i + 1);
    cy += BOX_H;
    unitEdge(ctx, colors, g.cx, cy, cy + EDGE_H, shapeText([4, out]), walk, i + 1,
      { color: hue });
    cy += EDGE_H;
  });

  if (state.code) {
    codePanel(ctx, colors, PAD + g.diagW + TEXT_GAP, top + 20, g.cw, state.code, walk.lit);
  }
  const textX = PAD + g.usable - g.tw;
  if (g.beside) printLines(ctx, colors, textX, top + 20, state.text);
  else printLines(ctx, colors, PAD, top + g.bodyH + 24, state.text);
  return g;
}

/* ============================= 7 · Ordering ================================ *
 * Cell 62's three perspectives, and no architecture named on any of them
 * (decision 15). One `view` control chooses which figure the stage holds, and
 * Step applies one step of the pattern, lights one combination, or walks one
 * position. `model.js` holds the geometry, because `pageHeight`, `draw` and the
 * verify script all measure the same page (5.8).
 *
 * NO SHAPES ANYWHERE HERE. With the three blocks gone there is no tensor to
 * carry, and every claim a shape made on this page is Dimensions' claim.
 */

function orderGeom(ctx, colors, w, params, state) {
  const usable = w - 2 * PAD;
  const caps = captionLines(ctx, colors, w, params, state);
  const capY = BAND_HEAD + M.orderBodyH(state.view) + CAP_GAP;
  const g = {
    usable,
    caps,
    capY,
    /* Combinations shares one caption slot across its three reasons, so the
       block is shorter than the list of rows (decision 16). */
    height: M.orderHeight(state.view, capRows(caps)),
  };
  if (state.view === "combinations") {
    const gw = M.comboGroupW(usable);
    return { ...g, gw, bw: gw - 20, groupH: M.COMBO_GROUP_H };
  }
  return g;
}

/** The lines of text beside one position box, and how wide they reach. The
    pattern line is mono and breaks at the middle arrow rather than wrapping,
    because a 30px box has room for two lines and no more. */
function sideLines(ctx, colors, p, tx, w) {
  const avail = w - PAD - tx;
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  const raw = p.repeated && ctx.measureText(p.side[0]).width > avail
    ? ["Transform → Normalize →", "Activate → Regularize"]
    : p.side;
  const rows = raw.flatMap((l) => {
    if (l.includes("→")) return [l];
    const a = wrapLines(ctx, colors, l, avail);
    return a.length === 1 ? a : wrapLines(ctx, colors, l, avail, colors.fsXs);
  });
  return rows.slice(0, 2);
}

function drawSide(ctx, colors, p, tx, boxY, w, ink) {
  const lines = sideLines(ctx, colors, p, tx, w);
  const multi = lines.length > 1;
  lines.forEach((line, k) => {
    const mono = line.includes("→");
    const size = multi || mono ? colors.fsXs : colors.fsSm;
    txt(ctx, colors, line, tx, boxY + (multi ? 12 + k * 13 : BOX_H / 2 + 0.5), {
      color: mono ? colors.ink2 : k === 0 ? ink : colors.ink3,
      baseline: multi ? "alphabetic" : "middle",
      mono,
      size,
    });
  });
}

/** The pattern: the four steps of his subunit figure, each with the job it
    does over the layers that fill it. Decision 17 has the colours. */
function drawPatternView(ctx, colors, w, walk) {
  const y0 = band(ctx, colors, 0, w, "Ordering · the pattern", M.PATTERN);
  const cx = PAD + BOX_W / 2;
  const sx = PAD + BOX_W + SIDE_GAP;
  let cy = y0;
  M.ROLES.forEach((r, i) => {
    const unit = i + 1;
    const on = onStage(walk, unit);
    if (i > 0) {
      if (on) arrow(ctx, cx, cy, cx, cy + ORDER_EDGE, colors.axis, 2);
      cy += ORDER_EDGE;
    }
    unitBox(ctx, colors, PAD, cy, BOX_W, r.role, colors[r.hue], walk, unit);
    if (on) {
      const lit = landed(walk, unit);
      txt(ctx, colors, r.job, sx, cy + 12,
        { color: walk.done === unit ? colors.ink1 : lit ? colors.ink2 : colors.ink3 });
      txt(ctx, colors, r.eg, sx, cy + 25,
        { color: colors.ink3, mono: true, size: colors.fsXs });
    }
    cy += BOX_H;
  });
}

/** The combinations: three dashed groups, one lit at a time. The reason for
    the lit one is the caption, which is why no group carries text of its own —
    the mock measured a reason under every group and the widest ran into its
    neighbour. */
function drawCombosView(ctx, colors, w, g, walk) {
  const y = band(ctx, colors, 0, w, "Ordering · combinations", "layers that are used as a unit");
  M.COMBOS.forEach((c, i) => {
    const unit = i + 1;
    const st = stageAt(walk, unit);
    if (st === "absent") return;
    const gx = PAD + i * (g.gw + GAP);
    dashedGroup(ctx, gx, y, g.gw, g.groupH,
      walk.done === unit ? colors.highlight : st === "preview" ? colors.axis : colors.ink3);
    let by = y + M.COMBO_HEAD;
    c.boxes.forEach((label, j) => {
      if (c.or === j) {
        txt(ctx, colors, "or", gx + g.gw / 2, by + 14,
          { color: colors.ink3, align: "center", size: colors.fsXs });
        by += BOX_H + M.COMBO_GAP;
      }
      unitBox(ctx, colors, gx + 10, by, g.bw, label, colors.groupA, walk, unit);
      by += BOX_H + M.COMBO_GAP;
    });
  });
}

/* the count beside the brackets: a repeat, not a size */
const REPEAT_LABEL = "× N";

/** The position: the whole network from the input down, with the repeated
    middle inside brackets so a repeat cannot read as a combination. */
function drawPositionView(ctx, colors, w, walk) {
  const y0 = band(ctx, colors, 0, w, "Ordering · position", "beginning · repeated middle · end");
  const cx = PAD + BOX_W / 2;
  const sx = PAD + BOX_W + SIDE_GAP;
  const last = M.POSITIONS.length;
  ctx.font = `${colors.fsSm} ${colors.font}`;
  const labelW = ctx.measureText(REPEAT_LABEL).width;
  txt(ctx, colors, "input", cx, y0 + 12, { color: colors.ink1, align: "center", mono: true });
  let cy = y0 + XLAB;
  M.POSITIONS.forEach((p, i) => {
    const unit = i + 1;
    const on = onStage(walk, unit);
    if (on) arrow(ctx, cx, cy, cx, cy + ORDER_EDGE, colors.axis, 2);
    cy += ORDER_EDGE;
    const boxY = p.repeated ? cy + 12 : cy;
    unitBox(ctx, colors, PAD, boxY, BOX_W, p.box,
      p.repeated ? colors.groupB : colors.groupA, walk, unit);
    if (p.repeated && on) {
      brackets(ctx, colors, PAD - 8, cy, BOX_W + 16, BOX_H + M.REPEAT_PAD, REPEAT_LABEL,
        walk.done === unit ? colors.highlight : landed(walk, unit) ? colors.ink2 : colors.ink3);
    }
    if (on) {
      /* THE REPEATED ROW'S TEXT STARTS PAST THE `× N` LABEL, MEASURED. The
         mock offset it by a flat 26px, which is where the label ENDS, so the
         pattern line began exactly at its right edge and the two read as one
         string. The bracket closes at BOX_W + 8 from the stage's left and the
         label sits 6px past it. */
      const tx = p.repeated ? sx + 6 + labelW + SIDE_GAP : sx;
      drawSide(ctx, colors, p, tx, boxY, w, landed(walk, unit) ? colors.ink2 : colors.ink3);
    }
    cy += M.positionRowH(p);
  });
  /* the output edge is the last position's, so it waits for it */
  if (landed(walk, last)) {
    arrow(ctx, cx, cy, cx, cy + ORDER_EDGE, colors.axis, 2);
    txt(ctx, colors, "output", cx, cy + ORDER_EDGE + 12,
      { color: colors.ink1, align: "center", mono: true });
  }
}

function drawOrder(ctx, colors, w, params, state, anim) {
  const g = orderGeom(ctx, colors, w, params, state);
  const walk = walkAt(anim, state);
  if (state.view === "combinations") drawCombosView(ctx, colors, w, g, walk);
  else if (state.view === "position") drawPositionView(ctx, colors, w, walk);
  else drawPatternView(ctx, colors, w, walk);
  return g;
}

/* ============================== the captions ===============================
 * The lines themselves, and the unit each one waits for, are `M.captions` —
 * decision 14 and principle 2.4. Here they are only wrapped to the stage, and
 * every row carries its own `at`, so `draw` can leave it blank without the
 * block changing height. `pageHeight` measures the FULL text at every walk
 * position, so a held row is a reserved row rather than a shorter figure.
 *
 * DECISION 16, THE SHARED SLOT. A caption marked `only` belongs to the unit
 * being shown rather than to everything that has landed, and every `only` line
 * of one page starts at the same row. Ordering's Combinations view is the one
 * user: its three groups have a reason each, the lit group's reason is what
 * prints, and the block is one line tall whichever group that is. `capRows`
 * rather than `caps.length` is what the height then asks for, because three
 * rows sharing one slot are one row of stage. */

function captionLines(ctx, colors, w, params, state) {
  const out = [];
  let n = 0;
  for (const { text, at, only } of M.captions(params, state)) {
    const wrapped = wrapLines(ctx, colors, text, w - 2 * PAD);
    const top = only ? 0 : n;
    wrapped.forEach((line, k) => out.push({ line, at, only: Boolean(only), row: top + k }));
    n = Math.max(n, top + wrapped.length);
  }
  return out;
}

/** How many rows of stage a caption block occupies. */
const capRows = (caps) => (caps.length ? Math.max(...caps.map((c) => c.row)) + 1 : 0);

/* ============================ the formula card ============================= */

const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const row = (...xs) => xs.join("");
const eq = (mathml, plain) => (MATHML ? mml(mathml) : plain);

const f1 = msub(mi("f"), mn("1"));
const f2 = msub(mi("f"), mn("2"));
const fx = (f) => row(f, mo("("), mi("x"), mo(")"));

const CARD = {
  skip: eq(row(mi("y"), mo("="), mi("x"), mo("+"), mi("f"), mo("("), mi("x"), mo(")")),
    "y = x + f(x)"),
  skipProj: eq(row(mi("y"), mo("="), mi("P"), mo("("), mi("x"), mo(")"), mo("+"), mi("f"), mo("("), mi("x"), mo(")")),
    "y = P(x) + f(x)"),
  grad: eq(row(frac(row(mo("∂"), mi("y")), row(mo("∂"), mi("x"))), mo("="), mn("1"), mo("+"),
    mi("f′"), mo("("), mi("x"), mo(")")),
  "∂y/∂x = 1 + f′(x)"),
  gate: eq(row(mi("y"), mo("="), mi("g"), mo("⊙"), mi("x")), "y = g ⊙ x"),
  concat: eq(row(mi("y"), mo("="), mi("concat"), mo("("), fx(f1), mo(","), fx(f2), mo(")")),
    "y = concat(f₁(x), f₂(x))"),
  add: eq(row(mi("y"), mo("="), fx(f1), mo("+"), fx(f2)), "y = f₁(x) + f₂(x)"),
  average: eq(row(mi("y"), mo("="), frac(mn("1"), mn("2")), mo("("), fx(f1), mo("+"), fx(f2), mo(")")),
    "y = ½(f₁(x) + f₂(x))"),
  hard: eq(row(mi("y"), mo("="), fx(f1), mo("if"), mi("condition"), mo("("), mi("x"), mo(")"),
    mo("else"), fx(f2)),
  "y = f₁(x) if condition(x) else f₂(x)"),
  soft: eq(row(mi("y"), mo("="), mo("∑"), msub(mi("α"), mi("i")), mo("("), mi("x"), mo(")"),
    msub(mi("f"), mi("i")), mo("("), mi("x"), mo(")")),
  "y = ∑ αᵢ(x) fᵢ(x)"),
};

/** The card's rows and its note, for the page on screen. A row carries the
    name it is known by, the body, and whether it is the one in force. */
function cardFor(params, state) {
  switch (state.kind) {
    case "dimensions": {
      const conv = state.steps.find((s) => s.layer.kind === "conv2d" && !s.error);
      const pool = state.steps.find((s) => s.layer.kind === "maxpool2d" && !s.error);
      const convText = conv
        ? `⌊(${conv.from[2]} + 2·0 − ${conv.layer.k}) / 1⌋ + 1 = ${conv.shape[2]}`
        : "⌊(in + 2·padding − kernel_size) / stride⌋ + 1";
      const poolText = pool
        ? `⌊(${pool.from[2]} − ${pool.layer.k}) / ${pool.layer.k}⌋ + 1 = ${pool.shape[2]}`
        : "⌊(in − kernel_size) / stride⌋ + 1";
      return {
        rowMin: "2.1em",
        rows: [
          ["Convolution", convText, Boolean(conv)],
          ["Pooling", poolText, Boolean(pool)],
        ],
        note: "A Linear, an Embedding and a recurrent layer are told their output size. "
          + "A convolution and a pooling window are not, so their output size is computed from the input.",
      };
    }
    case "skip": {
      const rows = [
        ["y", CARD.skip, !state.proj],
        ["y", CARD.skipProj, state.proj],
      ];
      if (params.grad === "1") rows.push(["∂y/∂x", CARD.grad, true]);
      return {
        rows,
        note: state.proj
          ? `P is a Linear(10, ${state.width}) on the skip path, so both sides of the add have the same shape.`
          : "The add requires the same shape on both sides, and a projection is what aligns them where they differ.",
      };
    }
    case "gating":
      return {
        rows: [["y", CARD.gate, true]],
        note: "g = 0 blocks the signal, g = 1 lets it pass unchanged, and a value in between passes part of it. "
          + "⊙ is elementwise, so there is one gate for each feature of each sample.",
      };
    case "branching":
      return {
        rows: [
          ["y", CARD.concat, state.merge === "concat"],
          ["y", CARD.add, state.merge === "add"],
          ["y", CARD.average, state.merge === "average"],
        ],
        note: "Concatenation joins the features, so the widths add. Addition and averaging combine them "
          + "cell by cell, so both branches have to be the same width.",
      };
    case "routing":
      return {
        rows: [
          ["y", CARD.hard, state.mode === "hard"],
          ["y", CARD.soft, state.mode === "soft"],
        ],
        note: "The softmax weights sum to 1 for each sample, so soft routing is a mixture. "
          + "A discrete choice has no derivative, so hard routing gives the router no gradient.",
      };
    case "ordering":
      return {
        rows: [["block", M.PATTERN, true]],
        note: state.view === "combinations"
          ? "Convolution and pooling, embedding and the layer that relates its vectors, linear and activation: "
            + "the two layers of each pair complete each other, so they are placed together."
          : state.view === "position"
            ? "The beginning is chosen for the data the model takes, the end for the number of outputs the task "
              + "needs, and the block between them is repeated to add depth."
            : "Transform learns new features, Normalize stabilizes the distribution of activations, "
              + "Activate introduces non-linearity, and Regularize reduces overfitting.",
      };
    default:
      return null;
  }
}

const GUTTER = "5.2em";
let cardHost = null;
let cardKey = null;

function renderCard(params, state) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const card = cardFor(params, state);
  const key = [params.topic, params.view, params.data, params.merge,
    params.fc2, params.width, params.proj, params.gate, params.mode, params.grad,
    params.step1, params.step2, params.step3, params.step4].join(":");
  if (key === cardKey) return;
  cardKey = key;
  if (!card) {
    cardHost.hidden = true;
    cardHost.innerHTML = "";
    return;
  }
  cardHost.hidden = false;
  /* 3.4k: a floor bracket descends past the strut, so a row that can carry one
     reserves the taller line box rather than letting the figure jog. */
  const min = card.rowMin ?? "0";
  cardHost.innerHTML = card.rows
    .map(([name, body, on]) =>
      `<div class="w-math-eq" style="min-height:${min};padding-left:${GUTTER};text-indent:-${GUTTER};`
      + `margin:0 0 var(--sp-1);color:var(--${on ? "ink-1" : "ink-3"})">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;`
      + `color:var(--${on ? "c-highlight" : "ink-3"})">${name}</span>${body}</div>`)
    .join("") + `<p class="w-math-note">${card.note}</p>`;
}

/* ============================== the widget ================================= */

const CHAIN = (params) => M.SLOT_KEYS.map((k) => params[k]);

/* THE ANIMATION OBJECT, FOR `regions` ALONE. Core hands a region table the
   parameters and the state, and the walk is in neither — but a band that is
   not drawn is not a target (3.6), so the hit-test has to read the same walk
   the drawing did. `draw` stashes the object rather than the number, so `n` is
   the live position and not the position at the last frame; core builds a new
   one on every rebuild, and `draw` runs before any pointer can reach the
   canvas. Its one empty moment is core's load-time region probe, which runs
   before the first frame — so `regions` reads a full walk there and hands the
   probe the whole table to validate. */
let walkAnim = null;

/** One door for the state, so `height`, `regions` and `compute` cannot each
    measure a different figure (5.8). */
function computeFor(params, rng) {
  switch (params.topic) {
    case "building":
      return M.building(params.api, params.blocks, params.style, params.show);
    case "dimensions":
      return M.dimensions(params.data, CHAIN(params));
    case "skip":
      return M.skip(Number(params.width), params.proj === "on");
    case "gating":
      return M.gating(params.gate, rng);
    case "branching":
      return M.branching(params.merge, Number(params.fc2));
    case "routing":
      return M.routing(params.mode);
    default:
      return M.ordering(params.view);
  }
}

const GEOM = {
  dimensions: dimGeom,
  skip: skipGeom,
  gating: gateGeom,
  branching: branchGeom,
  routing: routeGeom,
  building: buildGeom,
  ordering: orderGeom,
};
const DRAW = {
  dimensions: drawDim,
  skip: drawSkip,
  gating: drawGate,
  branching: drawBranch,
  routing: drawRoute,
  building: drawBuild,
  ordering: drawOrder,
};

/** The stage height for any page, from the parameters and the width alone. */
function pageHeight(w, params) {
  const ctx = measureCtx();
  const colors = readTokens();
  const state = computeFor(params, makeRng(1));
  return (GEOM[params.topic] ?? orderGeom)(ctx, colors, w, params, state).height;
}

/* THE TWO ROW HEADS ARE THE NOTEBOOK'S OWN `##` HEADINGS (cells 61 and 89),
   and they carry the split the seven names do not: the first three compose
   layers into a model, the last four change where the data goes. The grid is
   what makes the seven fit — a button in two columns is 149px against
   Branching's 74, where one row of four would give 72 (the mock, §1). */
const COMPOSING = "Composing layers";
const FLOW = "Controlling flow";

const TOPICS = [
  { value: "ordering", label: "Ordering", group: COMPOSING },
  { value: "building", label: "Building", group: COMPOSING },
  { value: "dimensions", label: "Dimensions", group: COMPOSING, span: true },
  { value: "skip", label: "Skip", group: FLOW },
  { value: "gating", label: "Gating", group: FLOW },
  { value: "branching", label: "Branching", group: FLOW },
  { value: "routing", label: "Routing", group: FLOW },
];

const ON = (topic) => ({ param: "topic", equals: topic });

/* DECISION 7: `Next line` everywhere a `forward()` is on screen, `Next layer`
   on the three pages where the unit is a layer and no `forward()` is drawn.
   Building takes the nested form, because its two APIs differ on exactly that
   (core's `resolveLabel`, added for the sibling on 2026-09-10). */
const STEP_LABELS = {
  /* Ordering's unit is whatever its view holds, so the label follows the view
     through the same nested form (decision 15). */
  ordering: {
    param: "view",
    labels: { pattern: "Next step", combinations: "Next combination", position: "Next position" },
    default: "Next step",
  },
  dimensions: "Next layer",
  building: { param: "api", labels: { sequential: "Next layer", module: "Next line" }, default: "Next line" },
};
const STEP_TITLES = {
  ordering: {
    param: "view",
    labels: {
      pattern: "Apply the next step of the pattern",
      combinations: "Show the next combination",
      position: "Show the next position",
    },
    default: "Apply the next step of the pattern",
  },
  building: "Run the next layer of the forward pass",
  dimensions: "Apply the next layer of the chain",
  skip: "Run the next line of forward()",
  gating: "Run the next line of forward()",
  branching: "Run the next line of forward()",
  routing: "Run the next line of forward()",
};
const RUN_TITLES = {
  ordering: {
    param: "view",
    labels: {
      pattern: "Apply the remaining steps",
      combinations: "Show the remaining combinations",
      position: "Show the remaining positions",
    },
    default: "Apply the remaining steps",
  },
  building: "Run the remaining layers",
  dimensions: "Apply the remaining layers",
  skip: "Run the remaining lines of forward()",
  gating: "Run the remaining lines of forward()",
  branching: "Run the remaining lines of forward()",
  routing: "Run the remaining lines of forward()",
};

const SAMPLE_FIELD = {
  type: "int",
  label: "Sample",
  min: 0,
  max: 3,
  default: 0,
  detail: "which row of the batch the readout takes its values from",
  display: true,
};

defineWidget({
  slug: "composition",
  title: "Deep Learning - Composition",
  status: "draft",
  subtitle:
    "A model is layers composed in an order, each layer's output shape the "
    + "input shape of the next. Connections can also add the input back after a "
    + "layer, multiply it by a gate between 0 and 1, or split it into branches "
    + "that merge again.",
  layout: "side",
  /* Routing frames the feature column under the pointer through its four
     strips and prints that column's arithmetic under the box. With no pointer
     the column with the most non-zero terms is framed and the same line is
     printed, so every number is on the canvas without one and hovering moves
     the frame rather than revealing anything. */
  pointer: true,
  /* Decision 3: every page is as tall as its own diagram, its text column and
     its wrapped captions. */
  height: ({ w, ...values }) => pageHeight(w, values),

  params: {
    topic: {
      type: "segmented",
      label: "Topic",
      style: "grid",
      groupHeads: true,
      detail: "the first three compose layers into a model, the last four change where the data goes",
      options: TOPICS,
      default: "ordering",
    },

    /* --- Ordering ---------------------------------------------------------- */
    view: {
      type: "segmented",
      label: "View",
      detail: "three things the order of a model is decided by",
      options: [
        { value: "pattern", label: "Pattern", detail: "the four steps a block applies, and the job each one does" },
        { value: "combinations", label: "Combinations", detail: "pairs of layers that are placed together, and why" },
        { value: "position", label: "Position", detail: "which layers sit at the beginning, in the middle and at the end" },
      ],
      default: "pattern",
      when: ON("ordering"),
    },

    /* --- Building ---------------------------------------------------------- */
    api: {
      type: "segmented",
      label: "API",
      detail: "two ways to connect the same three layers",
      options: [
        { value: "sequential", label: "Sequential", detail: "nn.Sequential applies the layers in the order they are listed" },
        { value: "module", label: "Module", detail: "a class with a forward() method, which can branch and loop" },
      ],
      default: "sequential",
      when: ON("building"),
    },
    blocks: {
      type: "segmented",
      label: "Grouping",
      detail: "a flat list of layers, or three blocks each a Sequential of its own",
      options: [
        { value: "flat", label: "Flat", detail: "three layers listed one after another" },
        { value: "blocks", label: "Blocks", detail: "an input block, a hidden block and an output block" },
      ],
      default: "flat",
      when: { all: [ON("building"), { param: "api", equals: "sequential" }] },
    },
    style: {
      type: "segmented",
      label: "Declared in __init__",
      detail: "which layers the class declares, and therefore which ones it registers",
      options: [
        { value: "all", label: "All layers", detail: "the activation is an nn.ReLU declared with the rest" },
        { value: "learnable", label: "Learnable only", detail: "the activation is F.relu, called in forward" },
      ],
      default: "all",
      when: { all: [ON("building"), { param: "api", equals: "module" }] },
    },
    show: {
      type: "segmented",
      label: "Inspect with",
      detail: "two readings of one model",
      options: [
        { value: "print", label: "print", detail: "the layers the model declares, in torch's own form" },
        { value: "summary", label: "summary", detail: "the same layers with the output shape and parameter count of each" },
      ],
      default: "print",
      display: true,
      when: ON("building"),
    },

    /* --- Dimensions -------------------------------------------------------- */
    data: {
      type: "segmented",
      label: "Data",
      style: "grid",
      detail: "the shape the batch arrives in, which decides what the first layer can be",
      options: [
        { value: "image", label: "Image", detail: "[4, 3, 32, 32]: 4 images, 3 channels, 32 by 32" },
        { value: "vectors", label: "Vectors", detail: "[4, 10]: 4 samples of 10 features" },
        { value: "sequence", label: "Sequence", detail: "[4, 5]: 4 sequences of 5 residues, as integer ids", span: true },
      ],
      default: "image",
      when: ON("dimensions"),
    },
    step1: {
      type: "select",
      label: "step 1",
      hidden: true,
      options: (v) => M.slotOptions(v.data, 0),
      optionsFrom: "data",
      default: "Conv2d-3-16-3",
      when: ON("dimensions"),
    },
    step2: {
      type: "select",
      label: "step 2",
      hidden: true,
      options: (v) => M.slotOptions(v.data, 1),
      optionsFrom: "data",
      default: "MaxPool2d-2",
      when: ON("dimensions"),
    },
    step3: {
      type: "select",
      label: "step 3",
      hidden: true,
      options: (v) => M.slotOptions(v.data, 2),
      optionsFrom: "data",
      default: "Flatten",
      when: ON("dimensions"),
    },
    step4: {
      type: "select",
      label: "step 4",
      hidden: true,
      options: (v) => M.slotOptions(v.data, 3),
      optionsFrom: "data",
      default: "Linear-3600-10",
      when: ON("dimensions"),
    },
    chain: {
      type: "expr",
      label: "Chain",
      detail: "each menu holds a layer that fits the step before it and one that does not",
      join: " → ",
      slots: M.SLOT_KEYS,
      when: ON("dimensions"),
    },

    /* --- Skip -------------------------------------------------------------- */
    width: {
      type: "choice",
      label: "Width after fc2",
      detail: "the number of features f(x) produces",
      options: [
        { value: "10", label: "10", detail: "the same width as the input, so the add works" },
        { value: "20", label: "20", detail: "a different width from the input, so the add has nothing to line up" },
      ],
      default: "10",
      when: ON("skip"),
    },
    proj: {
      type: "segmented",
      label: "Projection on the skip path",
      detail: "a Linear that maps the input to the width of f(x)",
      options: [
        { value: "off", label: "Off", detail: "the input is added as it is" },
        { value: "on", label: "On", detail: "a Linear(10, width) is applied to the input first" },
      ],
      default: "off",
      when: ON("skip"),
    },
    sample: { ...SAMPLE_FIELD, when: { any: [ON("skip"), ON("gating"), ON("branching"), ON("routing")] } },
    /* 3.4j: the answer goes below the drive row, and it is conditioned on there
       being a result to lie behind, so it returns by itself when the walk is
       empty. The URL carries 0/1, which is the arc's convention for a reveal. */
    grad: {
      type: "segmented",
      label: "Gradient",
      detail: "the local factor on each edge, and the two that arrive at x",
      options: [
        { value: "0", label: "Off" },
        { value: "1", label: "On", detail: "the same edges walked upwards, each with the factor it multiplies by" },
      ],
      default: "0",
      display: true,
      afterDrive: true,
      when: ON("skip"),
    },

    /* --- Gating ------------------------------------------------------------ */
    gate: {
      type: "segmented",
      label: "Gate",
      detail: "a gate the model learns, or one written by hand",
      options: [
        { value: "sigmoid", label: "Sigmoid", detail: "a Linear on the input through a sigmoid, so every gate is between 0 and 1" },
        { value: "mask", label: "Mask", detail: "a fixed tensor of 1s and 0s, so a blocked feature is blocked for every sample" },
      ],
      default: "sigmoid",
      when: ON("gating"),
    },

    /* --- Branching --------------------------------------------------------- */
    merge: {
      type: "segmented",
      label: "Merge",
      style: "grid",
      detail: "three ways to combine two branches",
      options: [
        { value: "concat", label: "Concat", detail: "the features are joined, so the widths add" },
        { value: "add", label: "Add", detail: "the branches are summed cell by cell, which needs the same width" },
        { value: "average", label: "Average", detail: "the same sum halved, so the merged values are on the scale of one branch", span: true },
      ],
      default: "concat",
      when: ON("branching"),
    },
    fc2: {
      type: "choice",
      label: "fc2 output features",
      detail: "the width of the second branch, against a first branch of 8",
      options: [
        { value: "6", label: "6", detail: "8 and 6 concatenate to 14, and neither add nor average can line them up" },
        { value: "8", label: "8", detail: "8 and 8 add and average to 8, and concatenate to 16" },
      ],
      default: "6",
      when: ON("branching"),
    },

    /* --- Routing ----------------------------------------------------------- */
    mode: {
      type: "segmented",
      label: "Routing",
      detail: "one branch chosen, or all three mixed",
      options: [
        { value: "hard", label: "Hard", detail: "the largest weight picks one branch, and the choice has no derivative" },
        { value: "soft", label: "Soft", detail: "the three weights mix the branches, and they are learned with the rest" },
      ],
      default: "soft",
      when: ON("routing"),
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: M.SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: lines, layers or chain steps,
       whichever the page runs. */
    shown: { type: "int", min: 0, max: 40, default: 0, hidden: true },
  },

  /* DECISION 11 AGAIN: no page lists `group-a` and `empirical` together. They
     are one colour in `tokens.css` on purpose — both mean the reader's own
     data — so two entries would be two identical swatches under two different
     names, which is worse than one entry that covers both. */
  legend: ({ params }) => {
    const topic = params.topic;
    if (topic === "ordering") {
      if (params.view === "combinations") {
        return [
          { token: "group-a", label: "A layer of the combination" },
          { token: "highlight", label: "The combination being shown" },
        ];
      }
      if (params.view === "position") {
        return [
          { token: "group-a", label: "A layer with a fixed position" },
          { token: "group-b", label: "The block that is repeated" },
          { token: "highlight", label: "The position being shown" },
        ];
      }
      return [
        { token: "group-a", label: "Transform, which learns new features" },
        { token: "group-b", label: "Normalize and Activate, which condition what Transform produces" },
        { token: "group-c", label: "Regularize, which acts during training" },
        { token: "highlight", label: "The step being applied" },
      ];
    }
    if (topic === "building") {
      return [
        { token: "group-a", label: "The layers of the model, in the order the forward pass runs them" },
        { token: "highlight", label: "The layer being run" },
      ];
    }
    if (topic === "dimensions") {
      const st = M.dimensions(params.data, CHAIN(params));
      return [
        { token: "group-b", label: "A layer with sizes of its own to match" },
        { token: "empirical", label: "The layer that produces the output" },
        { token: "highlight", label: "The layer being applied" },
        ...(st.failed ? [{ token: "extreme", label: "The message torch raises" }] : []),
      ];
    }
    if (topic === "skip") {
      return [
        { token: "group-a", label: "The input, the layers of f(x), and the result of the add" },
        ...(params.proj === "on" ? [{ token: "group-b", label: "The projection on the skip path" }] : []),
        { token: "highlight", label: "The line being run" },
        ...(params.grad === "1" ? [{ token: "slope", label: "The local factor on one edge" }] : []),
      ];
    }
    if (topic === "gating") {
      return [
        { token: "group-a", label: "The main path, and the gated values it produces" },
        { token: "group-b", label: params.gate === "mask" ? "The fixed mask" : "The learned gate" },
        { token: "highlight", label: "The line being run, and the chosen sample" },
      ];
    }
    if (topic === "branching") {
      return [
        { token: "group-a", label: "Branch 1, which is 8 features wide, and the merged result" },
        { token: "group-b", label: `Branch 2, which is ${params.fc2} features wide` },
        { token: "highlight", label: "The line being run, and the chosen sample" },
      ];
    }
    return [
      { token: "group-a", label: "Branch 1, and the combined features it contributes to" },
      { token: "group-b", label: "Branch 2" },
      { token: "group-c", label: "Branch 3" },
      { token: "highlight", label: "The line being run, and the largest weight" },
    ];
  },

  compute: ({ params, rng }) => computeFor(params, rng),

  /* THE BAND ROWS AND THE WEIGHT ROWS ARE THE TARGETS (3.6), and each sets one
     parameter: `sample`, which is display, so a click moves the rail control
     and the URL and leaves the walk where it stood. Built from the same
     geometry `draw` uses, lazily at click time, never inside `draw`. */
  regions: ({ w, params, state }) => {
    if (!state) return [];
    const ctx = measureCtx();
    const colors = readTokens();
    /* DECISION 14: A BAND THAT IS NOT DRAWN IS NOT A TARGET (3.6). The walk
       reaches here through the `anim` object `draw` stashes, because core hands
       `regions` the parameters and the state and not the animation — and the
       object is the live one, so `n` is the position on screen rather than the
       position at the last draw. */
    const walk = walkAt(walkAnim ?? { n: state.units }, state);
    const rows = (x, y, cellW, p) =>
      [0, 1, 2, 3].map((i) => ({
        /* a number, because `sample` is an int: a string would leave `?sample=0`
           in a link that is at the default */
        x, y: y + i * p, w: cellW, h: p, set: { sample: i }, label: `sample ${i}`,
      }));
    if (params.topic === "skip") {
      /* the three bands of the add, which land together with the line that
         adds them: before that there is nothing on the canvas to hit */
      if (!landed(walk, 5)) return [];
      const g = skipGeom(ctx, colors, w, params, state);
      const b = skipBands(g, state);
      return [b.x3, b.skip, ...(b.out ? [b.out] : [])]
        .flatMap((bd) => rows(bd.x, bd.y, bd.cols * g.s.band, g.s.band));
    }
    if (params.topic === "gating") {
      if (!landed(walk, 3)) return [];
      const g = gateGeom(ctx, colors, w, params, state);
      return rows(g.bandX, g.bandY, 20 * g.s.band, g.s.band);
    }
    if (params.topic === "branching") {
      const g = branchGeom(ctx, colors, w, params, state);
      const b = branchBands(g, state);
      return [
        ...(landed(walk, 1) ? rows(b.b1.x, b.b1.y, b.b1.cols * g.s.band, g.s.band) : []),
        ...(landed(walk, 2) ? rows(b.b2.x, b.b2.y, b.b2.cols * g.s.band, g.s.band) : []),
      ];
    }
    if (params.topic === "routing") {
      const g = routeGeom(ctx, colors, w, params, state);
      /* the four rows of the [4, 3] weight tensor, and the four rows of each
         band in the sum block — the three branches and the combined one — read
         from the geometry `drawSumBlock` lays them out with */
      const b = routeSumGeom(g);
      return [
        ...(landed(walk, 1) ? rows(g.gateCx - g.gateW / 2, g.weightsY, 3 * g.s.wcell, WROW) : []),
        ...(landed(walk, 5)
          ? [...b.bandY.flatMap((y) => rows(b.cellX, y, b.bandW, b.p)),
            ...rows(b.cellX, b.sumY, b.bandW, b.p)]
          : []),
      ];
    }
    return [];
  },

  animation: {
    stepLabel: { param: "topic", labels: STEP_LABELS, default: "Next line" },
    stepTitle: { param: "topic", labels: STEP_TITLES, default: STEP_TITLES.skip },
    runLabel: "Play",
    runTitle: { param: "topic", labels: RUN_TITLES, default: RUN_TITLES.skip },

    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.units);
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
       ends. Changing the sample or the print changes no clock, so a step in
       flight keeps running while the figure redraws under it. */
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
    renderCard(params, state);
    walkAnim = anim;
    const walk = walkAt(anim, state);
    const g = (DRAW[params.topic] ?? drawOrder)(ctx, colors, w, params, state, anim, pointer);
    /* 2.4 AND DECISION 14: a row whose claim has not happened yet is reserved
       and left blank, so the block is the same height empty as full. */
    g.caps.forEach((row) => {
      /* DECISION 16: a shared row reads for the unit being shown, not for
         every unit behind it. */
      if (!(row.only ? walk.done === row.at : landed(walk, row.at))) return;
      txt(ctx, colors, row.line, PAD, g.capY + 12 + row.row * CAPTION_H, { color: colors.ink2 });
    });
  },

  readout({ params, state, anim }) {
    const walk = walkAt(anim, state);
    const s = Number(params.sample);
    const ran = { label: "Lines run", value: `${walk.done} of ${state.units}` };

    if (state.kind === "dimensions") {
      const last = state.steps[Math.max(0, walk.done - 1)];
      const next = state.layers[walk.done];
      return [
        {
          label: "Input",
          value: sizeText(state.set.shape),
          note: state.set.note,
        },
        {
          label: walk.done > 0 ? `After step ${walk.done}` : "After step 1",
          value: walk.done === 0 ? "—" : last.error ? "—" : sizeText(last.shape),
          note: walk.done === 0
            ? `${state.units} steps to run, and each one is a layer of the chain`
            : last.error
              ? `${last.layer.label} was given ${shapeText(last.from)}`
              : `${last.layer.label} applied to ${shapeText(last.from)}`,
        },
        {
          label: "Next layer expects",
          value: next ? expectedText(next) : "—",
          note: next
            ? `${next.label} is the next step of the chain`
            : state.failed
              ? "the chain stopped where the sizes disagreed"
              : "the chain has run to the end",
        },
        {
          label: "Parameters",
          value: String(state.params),
          note: paramNote(state),
        },
        ran,
      ];
    }

    if (state.kind === "skip") {
      const rowText = (m) => (m ? m[s].slice(0, 3).map((v) => v.toFixed(2)).join(", ") : "—");
      return [
        {
          label: "f(x)",
          value: shapeText([4, state.width]),
          note: walk.done >= 4
            ? `sample ${s}: ${rowText(state.x3)}, and 3 of ${state.width} values shown`
            : "the output of fc2, which is what the block learns",
        },
        {
          label: "skip",
          value: shapeText(state.skipShape),
          note: walk.done >= 1
            ? `sample ${s}: ${rowText(state.skip)}, and 3 of ${state.skipShape[1]} values shown`
            : state.proj ? "the input through the projection" : "the input, carried past the layers",
        },
        {
          label: "Add",
          /* COMPUTED FROM THE TWO DRAWN SHAPES (2.11), not from the parameter */
          value: state.match ? "shapes match" : "shapes differ",
          note: `${shapeText([4, state.width])} and ${shapeText(state.skipShape)}`,
        },
        {
          label: "Output",
          value: state.y ? sizeText([4, 2]) : "—",
          note: state.y ? "fc_out maps the sum to 2 classes" : "torch raises at the add, so there is no output",
        },
        { label: "Parameters", value: String(state.params), note: "the layers of this block, weights and biases" },
        ran,
      ];
    }

    if (state.kind === "gating") {
      return [
        {
          label: "Gate range",
          value: `${state.lo.toFixed(2)} to ${state.hi.toFixed(2)}`,
          note: state.gate === "mask"
            ? "a fixed mask holds only 0 and 1"
            : "a sigmoid maps any score into the open interval between 0 and 1",
        },
        {
          label: `Gate mean, sample ${s}`,
          value: state.gateMean(s).toFixed(3),
          note: `the mean of the 20 gates applied to sample ${s}`,
        },
        {
          label: "Features blocked",
          value: `${state.blocked} of 20`,
          note: state.gate === "mask"
            ? "counted from the mask that was drawn, and the same features are blocked for every sample"
            : "a sigmoid gate is above 0, so no feature is blocked outright",
        },
        {
          label: "Output",
          value: sizeText([4, 2]),
          note: `gated is ${shapeText([4, 20])}, and fc2 maps it to 2 classes`,
        },
        ran,
      ];
    }

    if (state.kind === "branching") {
      return [
        {
          label: "Branch 1",
          value: shapeText([4, 8]),
          note: walk.done >= 1
            ? `sample ${s}: ${state.x1[s].slice(0, 3).map((v) => v.toFixed(2)).join(", ")}, and 3 of 8 values shown`
            : "fc1 through a relu",
        },
        {
          label: "Branch 2",
          value: shapeText([4, state.fc2]),
          note: walk.done >= 2
            ? `sample ${s}: ${state.x2[s].slice(0, 3).map((v) => v.toFixed(2)).join(", ")}, and 3 of ${state.fc2} values shown`
            : "fc2 through a relu",
        },
        {
          label: "Merged",
          value: state.merged ? shapeText([4, state.feats]) : "—",
          note: state.mergeError
            ? `${state.merge} needs both branches at one width`
            : `${state.merge} on 8 and ${state.fc2} features`,
        },
        {
          label: `fc3 expects ${state.fc3In}`,
          value: state.y ? sizeText([4, 2]) : "—",
          note: state.y
            ? `fc3 is Linear(${state.fc3In}, 2), sized for this merge`
            : "the merge raised, so fc3 has no input to take",
        },
        ran,
      ];
    }

    if (state.kind === "routing") {
      const w = state.weights[s];
      if (state.mode === "hard") {
        return [
          {
            label: "Branch taken",
            value: `branch ${state.top[s] + 1}`,
            note: `sample ${s} has its largest weight there, at ${w[state.top[s]].toFixed(3)}`,
          },
          {
            label: "Gradient to the router",
            value: "none",
            note: "the argmax is a discrete choice, so the gate cannot be trained by backpropagation",
          },
          {
            label: "Largest branch",
            value: `branch ${state.top[s] + 1}`,
            note: `over the 4 samples the branches taken are ${state.top.map((t) => t + 1).join(", ")}`,
          },
          {
            label: "Output",
            value: sizeText([4, 2]),
            note: `combined is ${shapeText([4, 20])}, and fc_out maps it to 2 classes`,
          },
          ran,
        ];
      }
      return [
        {
          label: `Weights, sample ${s}`,
          value: w.map((v) => v.toFixed(3)).join(", "),
          note: "one weight for each branch, from a softmax over the gate's three scores",
        },
        {
          label: "Sum",
          value: w.reduce((a, b) => a + b, 0).toFixed(3),
          note: "a softmax row sums to 1, so the three weights are a mixture",
        },
        {
          label: "Largest branch",
          value: `branch ${state.top[s] + 1}`,
          note: `at ${w[state.top[s]].toFixed(3)}, against ${(1 / 3).toFixed(3)} if the three were equal`,
        },
        {
          label: "Output",
          value: sizeText([4, 2]),
          note: `combined is ${shapeText([4, 20])}, and fc_out maps it to 2 classes`,
        },
        ran,
      ];
    }

    if (state.kind === "building") {
      return [
        {
          label: "Layers printed",
          value: String(state.printed),
          note: state.key === "learnable"
            ? "F.relu is not a submodule, so the print does not name it"
            : "every layer the model declares appears in the print",
        },
        {
          label: "Layers run",
          value: String(state.run),
          note: `${walk.done} of ${state.units} run so far, and the forward pass decides which they are`,
        },
        {
          label: "Parameters",
          value: String(state.params),
          note: "the weights and biases of the Linear layers, which an activation adds none to",
        },
        {
          label: "Output",
          value: sizeText([4, 2]),
          note: `${sizeText([4, 10])} in, 2 classes out`,
        },
        ran,
      ];
    }

    /* ORDERING: the three views take three sets of tiles, and every one of them
       is a word rather than a number, because nothing on this page is measured
       (decision 15). A tile that names the unit being shown reads `—` until
       Step has landed one. */
    const at = walk.done - 1;
    if (state.view === "combinations") {
      const c = at >= 0 ? M.COMBOS[at] : null;
      return [
        {
          label: "Combination",
          value: c ? `${c.boxes[0]} → ${c.follows}` : "—",
          note: c
            ? "the two layers are placed together, and the second one takes what the first produces"
            : "each combination is a pair of layers that are placed together",
        },
        {
          label: "Data it suits",
          value: c ? c.data : "—",
          note: c
            ? `this pair is where a model that takes ${c.data} begins`
            : "the data decides which pair a model starts from",
        },
        {
          label: "Layer that follows",
          value: c ? c.follows : "—",
          note: c
            ? `${c.boxes[0]} hands its output to it`
            : "the second layer of the pair, which the first one hands to",
        },
        {
          label: "Combinations shown",
          value: `${walk.done} of ${state.units}`,
          note: "three pairs, and the same pair appears in many models",
        },
      ];
    }
    if (state.view === "position") {
      const p = at >= 0 ? M.POSITIONS[at] : null;
      return [
        {
          label: "Position",
          value: p ? p.pos : "—",
          note: p
            ? `${p.box} sits at the ${p.pos} of the network`
            : "the beginning, the repeated middle, and the end",
        },
        {
          label: "Layers",
          value: p ? p.tile : "—",
          note: p
            ? "what fills this position"
            : "each position is filled by layers of its own",
        },
        {
          label: "Blocks repeated",
          value: "N",
          note: "the number of repeats is chosen for the depth the model needs",
        },
        {
          label: "Positions shown",
          value: `${walk.done} of ${state.units}`,
          note: "from the input to the output, in the order the data passes through them",
        },
      ];
    }
    const r = at >= 0 ? M.ROLES[at] : null;
    return [
      {
        label: "Role",
        value: r ? r.role : "—",
        note: r ? r.job : "the four steps a block applies, in order",
      },
      {
        label: "Examples",
        value: r ? r.eg : "—",
        note: r
          ? `layers that fill the ${r.role} step`
          : "the layers that fill each step",
      },
      {
        label: "Steps that carry weights",
        value: `${M.ROLES_WITH_WEIGHTS} of ${M.ROLES.length}`,
        note: "an activation and a dropout hold no parameters at all",
      },
      {
        label: "Steps applied",
        value: `${walk.done} of ${state.units}`,
        note: "the order of the last three is an empirical choice",
      },
    ];
  },
});

/** What the next layer of a chain requires of the tensor reaching it. */
function expectedText(L) {
  if (L.kind === "linear") return `${L.inF} features`;
  if (L.kind === "conv2d") return `${L.cin} channels`;
  if (L.kind === "maxpool2d") return "4 dimensions";
  if (L.kind === "embedding") return `ids under ${L.vocab}`;
  return "any shape";
}

/** Which layers of a chain carry weights, and how many each holds. */
function paramNote(state) {
  const withParams = state.steps
    .filter((s) => !s.error && M.layerParams(s.layer) > 0)
    .map((s) => `${s.layer.label} ${M.layerParams(s.layer)}`);
  return withParams.length
    ? withParams.join(", ")
    : "no layer of this chain carries weights";
}
