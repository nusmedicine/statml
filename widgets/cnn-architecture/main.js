/* ============================================================================
   Widget 61 · CNN Architecture — what a convolutional layer costs, what each
   of its kernels produces, and how far back into the image one output unit can
   see.

   PHM5005 06-1 cell 2 and cell 1, 06-2 cell 23 and cell 25. `model.js` carries
   the arithmetic, `depict.js` carries the drawing of a network, and this file
   carries the colours, the strings and the animation.

   THE MISCONCEPTION IS THAT A CNN IS AN MLP FED PIXELS. The students arrive
   from 05-1 and widget 37, where every input reaches every unit, and the
   corrective is two numbers on one figure: what a 3 × 3 kernel costs against a
   dense layer on the same image, and how far back into the image one output
   unit can see. The second answers a reported misconception of its own —
   *deeper layers see the whole image* — which is false on the notebook's own
   net at 10 px of 28.

   ── ROUND 6 (2026-09-15) answered two questions. *"Why does the patch scan
   twice?"* — because the walk of the kernel and the walk of the marked unit
   were two phases of one press over the same cells of the same map; they are
   now ONE walk. *"The second conv2 should have different kernels? For higher
   order features?"* — yes: conv2 ran the first block's four operators over one
   channel each, which contradicts the wiring the figure draws, so it now
   carries four measured combinations over every input channel.
   `_lab/cnn-round6-mock.html` measured six candidates against the parts of the
   cell and storyboarded the merged walk; Kenneth took both recommendations.

   ── ROUND 5 (2026-09-14) put the receptive field behind a gate, replaced the
   image, drew Flatten as what it is, cut the head figure to one head and gave
   the linear layer every value the figure holds. `_lab/cnn-round5-mock.html`
   drew three shapes of the drive, five candidate images, three depictions of
   the head column and three head figures; Kenneth picked the gated drive with
   ONE step button, the cell, the strip, and the chosen head alone.

   ── ROUNDS 1 AND 2 (2026-09-14) settled the click and the walk; ROUND 3 the
   same day replaced the depiction. Kenneth's three points were (1) a block
   added had no link and no animation to the new last layer — a bug, (2) *"can
   you research any other nicer depiction of the architecture?"* and (3) *"when
   animating, i don't see the results of the operations … even a section before
   to show details (like the blocks widget)"*, under the standing brief *"we
   want to see how to build something that the same motif can be used for other
   lessons later in PHM5005"*. `_lab/cnn-depiction-mock.html` drew four
   depictions, three placements of a detail section and three animations, and
   he picked the feature-map gallery, the detail band under it, Play sliding the
   kernel with Step in three phases, and the motif written here first.

   DECISIONS, so they are not re-argued:

    1. THE MOCK IS THE GEOMETRY OF RECORD, and the geometry lives in
       `depict.js` so `_lab/cnn-verify.mjs` measures the SHIPPING fit rather
       than a copy of it (5.8). Nothing in this file computes a rectangle.

    2. THE MOTIF IS A MODULE, IN THIS WIDGET, NOT IN CORE. Kenneth: *"we'll
       test it here first, when mature, will move to core for deep learning
       widgets"*. Widget 55 imported widget 48's relief the same way.
       `depict.js`'s own header says what 63, 64 and 65 would pass in and what
       moves it to core.

    3. THE STAGE IS THREE BANDS AND ITS HEIGHT IS A FUNCTION OF THE PARAMETERS
       AND THE WIDTH (`bayesian`'s precedent). Band 2 reserves the tallest
       detail any column of this network asks for, so clicking a column never
       moves the figure below it.

    4. EVERY MAP ON THE FIGURE IS REAL, which is what point 3 asked for. Four
       named image operators — horizontal edge, vertical edge, blur,
       centre-surround — run over one drawn image, then ReLU, then max pooling,
       then four cross-channel kernels over what came out. The figure says on
       its face that these are named operators and not learned filters, because
       a student who reads them as trained filters has learned the wrong thing
       about what a convolution finds.

    5. FOUR CHANNELS OF THIRTY-TWO. A layer here draws four maps where the
       network computes 32 or 64, and every column prints how many are not
       drawn. A convolution reads every input channel; four of them are drawn,
       and the faint lines into the chosen map are the ones that are not.

    6. `head` AND `input` ARE DATA PARAMETERS, like the other three. All five
       change what the numbers ARE, so all five recompute and start the figure
       over. There is no display parameter: the widget has no overlay.

    7. THE CHOSEN UNIT IS ONE PARAMETER, `pos`, AND `model.js` HOLDS ITS
       ENCODING. A region may set exactly one parameter (3.6), and a click now
       says three things — which column, which of the four drawn channels,
       which cell — so one number carries all three. `unit` stays as the
       readable form of "which column", read only while `pos` is at its
       default, so the two can never disagree.

    8. THE LAST COLUMN IS NAMED RELATIVELY, WHICH IS ROUND 3'S BUG FIX. A click
       on the last feature map writes a reserved stage number meaning *the last
       one*, so adding a block carries the unit to the new last column, clamped
       to its map. A click on an EARLIER column writes that column's own index,
       and the pin survives a change to the network — which is what pinning
       means. Reset returns `pos` to 0 and empties the figure; no click ever
       writes 0.

    9. TWO PHASES, ONE STEP, ONE PLAY — and round 6 cut the third. Press one
       adds a column; behind the gate, press one moves the marked unit to the
       next cell of the chosen map. The step button names the phase it is in,
       keyed on the animation's own counter (4.4b, widget 60's device), and
       Play runs them in order and stops. Nothing in `anim` writes back to a
       parameter (1.1) and nothing is computed per frame (1.4): every map is
       finished before the first press, and the phases reveal it.

       WHY IT WAS THREE AND IS NOW TWO. The kernel's walk over the chosen
       layer's input and the marked unit's walk over its own map visit the same
       cells of the same map in reading order, and the window the first drew on
       the immediate source is the innermost window of the second's receptive
       field — one step of `depict.js`'s backward recursion IS the kernel's own
       window, asserted at all 1,225 cells of the default network. So the
       second walk redrew the first walk's picture and added the outer windows
       to it. One walk now carries both readings, and what it cost is one pace:
       the two phases could be watched at two speeds and this cannot.

   10. THE PACE OF EACH PHASE IS A MEASURED CONSTANT IN `model.js`. A column is
       700 ms. A cell starts at 60 ms — about what it takes to read a window as
       a window — and the rate ramps so the whole map finishes inside ten
       seconds, which leaves a 7 × 7 map at 60 ms throughout and ends a 28 × 28
       one fourteen times faster than it started.

   11. THE DETAIL BAND RE-DERIVES THE MAP IT IS ABOUT. A column arrives in
       phase 1 with its maps already computed, and the first press of Next unit
       empties the chosen map and fills it in behind the marked cell. That is
       the point of the second phase: the first says what a layer produces, the
       second says where each of those values came from.

   12. THE BORDER IS HIGHLIGHT, THE OVERRUN IS EXTREME. Both draw the same
       device — the window clipped solid, the whole of it dashed beyond the
       edge. A patch at the edge of a map is padding doing its job; a patch
       wider than the whole image is the case that fails (2.6), and only the
       second wears `--c-extreme`.

   13. ONE COLOUR, ONE GROUPING, ON THE WHOLE FIGURE. `--c-group-a` is the
       tensor a layer reads — the image, and the window of values — and
       `--c-group-b` is the layer's weights: the kernel, the linear layer's
       column, and the bar of the head figure. Band 3 compared Flatten and
       global average pooling in those two hues for one round, which made one
       pair carry two groupings; round 5 draws one head, so the hue is free to
       mean one thing everywhere.

   14. TWO STAGES, ONE BUTTON BETWEEN THEM (round 5, Kenneth's pick A). Before
       it: the architecture is built a column a press, and Play stops when the
       last column is in. Behind it: the marked unit over every cell of the
       chosen map. The button is a parameter and not a
       reading of the animation — a gate that opened itself when the last
       column arrived would open in one stage for the author and in the other
       for a reader who had pressed Play, and the same link would be two
       figures (invariant 1). It is pressable from the first frame, and
       pressing it early reveals the columns at once rather than playing them
       in: the receptive field is a fact about a network that exists, and six
       columns of waiting is not what that press asked for. `shown` counts
       columns before the gate and cells of the chosen map behind it, so both
       stages are reachable from a link. Core hides the whole drive row behind
       a `gate` FIELD, which would leave this widget's first stage with no
       buttons at all, so the button is the same shape written as a `bool` with
       `style: "action"`; `.w-btn[aria-pressed]` is what says it is open.

   15. THE LAYER CONTROL AND A CLICK CANNOT DISAGREE, because behind the gate
       they write DIFFERENT parameters and own different things. `Layer` owns
       which feature map; `pos` owns which channel and which cell OF that map,
       and a `pos` naming another column is ignored rather than obeyed. So the
       other columns' targets write `layer` — core syncs the control through
       the same door a region click goes through — and the control always names
       the column on screen. Before the gate there is no Layer control and
       `pos` owns the column as it did in round 3, which is what keeps the head
       and the linear layer clickable. `unit` is gone: it was the readable form
       of "which column" and this is a readable control.

   16. THE IMAGE IS A CELL (round 5, Kenneth's pick A). Measured: the
       horizontal-edge kernel answers 27 × louder on the cell's own boundaries
       than on a flat patch at 28 px and 28 × at 64, where the blob it replaces
       managed 2.1 ×. All four named operators find something different in it,
       which is what four channels of one column have to show.

   17. FLATTEN IS A STRIP AND GLOBAL AVERAGE POOLING IS FOUR CELLS (round 5,
       pick A). Four cells under both said the two heads were the same shape,
       which is the one thing the head choice is about. `depict.js` owns the
       geometry: the column asks the engine how many values it was handed.

   18. THE HEAD FIGURE DRAWS THE CHOSEN HEAD AND PRINTS THE OTHER (round 5,
       pick B). Two bars needed a floor to keep the short one visible, and the
       floor drew 11 : 1 where the counts said 48 : 1 — 2.11. The band is 210px
       where it was 300.

   19. A SECOND-LAYER KERNEL SELECTS WITH ITS BIAS, which is round 6's own
       finding and the reason conv2's four are named what they are. Every input
       channel is non-negative after ReLU, so a sum of positive weights is a
       BRIGHTNESS: four of the six candidates the mock measured came out most
       enriched on the membrane — the brightest structure, and a fifth of the
       picture — whatever combination they were written to be. Subtracting a
       threshold is what separates them, and `buildNet` already counts one per
       output channel, so the parameter count on screen already pays for it.
       The four kept are Membrane, Granule, Body and Nucleus, at 3.67, 12.39,
       7.92 and 4.76 times the enrichment their own part's area allows by
       chance; `model.js` holds the weights and `_lab/cnn-verify.mjs` §3 reruns
       the measurement over the shipping maps.

   20. THE THIRD BLOCK REPEATS THE SECOND'S FOUR, over inputs scaled to the
       range the second block read. At 7 × 7 a part of the cell is between two
       and twelve cells, so every candidate reaches its own ceiling and the
       measurement cannot separate them: the honest picture is the same four
       names at a coarser scale. The scaling is not decoration — the biases are
       thresholds, the first block's maps run to 2.82 and the second block's to
       0.12, and the same four kernels over unscaled inputs answer nowhere at
       all. The detail band prints the scaled values it multiplies and says so.
   ========================================================================= */

import { defineWidget, mathmlRenders, shapeText, outSize } from "../core/index.js";
import * as M from "./model.js";
import * as D from "./depict.js";

/* --- primitives ------------------------------------------------------------ */

const int = (v) => Math.round(v).toLocaleString("en-US");
const n2 = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(2));
const signed = (v) => (v < 0 ? `−${Math.abs(v).toFixed(2)}` : v.toFixed(2));
/* A slice weight, as short as it is exact: the cross-channel band prints three
   of them in 78px and "−0.50" is wider than the cell it would sit in. */
const weight = (v) => `${Math.round(v * 100) / 100}`.replace("-", "−");
const easeOut = (t) => 1 - (1 - t) ** 3;

function txt(ctx, colors, s, x, y, o = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "",
  } = o;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? colors.mono : colors.font}`.trim();
  ctx.fillText(s, x, y);
  ctx.restore();
}

const caption = (ctx, colors, s, x, y) =>
  txt(ctx, colors, s, x, y, { color: colors.ink2, weight: "600" });
const note = (ctx, colors, s, x, y, tone) =>
  txt(ctx, colors, s, x, y, { color: tone ?? colors.ink3, size: colors.fsXs });

/**
 * A printed line that stays inside the stage. A column 12px wide carries a
 * label five times its width, so the x it is drawn at is clamped into the
 * margins rather than being allowed off the edge — the mock drew the last
 * column's name 24px past the right edge, and the first mock's shape labels
 * off the left.
 */
function clamped(ctx, colors, s, x, y, w, o = {}) {
  ctx.save();
  ctx.font = `${o.size ?? colors.fsXs} ${o.mono ? colors.mono : colors.font}`;
  const width = ctx.measureText(s).width;
  ctx.restore();
  const x0 = Math.max(D.PAD, Math.min(x, w - D.PAD - width));
  txt(ctx, colors, s, x0, y, { size: colors.fsXs, ...o });
  return { x: x0, w: width };
}

/** A token colour at an alpha. Tokens resolve to hex. */
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/**
 * A map on the grey ramp, nearest-neighbour, scaled by its own largest value.
 *
 * `cap` bounds how many samples a side are painted, which is what keeps a
 * 64 × 64 map affordable: twenty-four thumbnails of 4,096 cells is 98,000
 * rectangles a frame, and a thumbnail 56px wide cannot show 64 of them anyway.
 * `upto` paints only the cells the kernel has reached, which is phase 2.
 */
function drawMap(ctx, colors, x, y, size, n, arr, o = {}) {
  const cap = o.cap ?? 32;
  const steps = Math.max(1, Math.min(n, cap));
  const hi = o.max ?? 1;
  const c = size / steps;
  const upto = o.upto ?? Infinity;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, size, size);
  for (let j = 0; j < steps; j += 1) {
    const cj = Math.floor((j * n) / steps);
    for (let i = 0; i < steps; i += 1) {
      const ci = Math.floor((i * n) / steps);
      if (cj * n + ci > upto) continue;
      ctx.fillStyle = mix(colors.surface2, colors.ink1, arr[cj * n + ci] / hi);
      ctx.fillRect(x + i * c, y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = o.frame ?? colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.restore();
}

/** A value cell with its number, widget 49's idiom for an arithmetic line. */
function valueCell(ctx, colors, x, y, w, h, text, o = {}) {
  ctx.save();
  ctx.fillStyle = wash(o.hue ?? colors.empirical, o.empty ? 0.14 : 0.42);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = o.hue ?? colors.empirical;
  ctx.lineWidth = o.lit ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
  if (text != null) {
    txt(ctx, colors, text, x + w / 2, y + h / 2 + 0.5,
      { color: colors.ink1, align: "center", baseline: "middle", mono: true, size: colors.fsXs });
  }
}

const opGlyph = (ctx, colors, r, glyph) =>
  txt(ctx, colors, glyph, r.x + r.w / 2, r.y + r.h / 2,
    { color: colors.ink2, align: "center", baseline: "middle", weight: "600" });

/* --- the windows, the cone and the marked unit ----------------------------- */

const outsideOf = ([lo, hi], n) => Math.max(0, -lo) + Math.max(0, hi - (n - 1));
const widerThan = ([lo, hi], n) => hi - lo + 1 > n;

/**
 * The window a unit reads, on one drawn thumbnail: clipped to the map as a
 * solid rule, and if any of it falls outside, the whole of it dashed beyond the
 * edge (decision 12).
 */
function windowBox(ctx, colors, lay, col, channel, rows, cols, o = {}) {
  const n = lay.cols[col].n;
  const over = outsideOf(rows, n) > 0 || outsideOf(cols, n) > 0;
  const wide = widerThan(rows, n) || widerThan(cols, n);
  const tone = wide ? colors.extreme : colors.highlight;
  const solid = D.clipRect(lay, col, channel, rows, cols);
  const full = D.fullRect(lay, col, channel, rows, cols);
  ctx.save();
  if (solid.w > 0 && solid.h > 0) {
    if (o.fill) {
      ctx.fillStyle = wash(colors.highlight, 0.22);
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
    }
    ctx.strokeStyle = tone;
    ctx.lineWidth = o.width ?? 2;
    ctx.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.w - 1, solid.h - 1);
  }
  if (over) {
    ctx.strokeStyle = tone;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(full.x + 0.5, full.y + 0.5, full.w - 1, full.h - 1);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function markUnit(ctx, colors, lay, col, channel, row, column) {
  const m = D.unitRect(lay, col, channel, row, column);
  ctx.save();
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m.x - 2.5, m.y - 2.5, m.w + 5, m.h + 5);
  ctx.restore();
}

const CONE_ALPHA = 0.35;

function drawCone(ctx, colors, cone, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = wash(cone.wide ? colors.extreme : colors.highlight, CONE_ALPHA);
  ctx.lineWidth = 1;
  for (const [x1, y1, x2, y2] of D.coneLines(cone)) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/* --- band 1 · the feature maps --------------------------------------------- */

const GALLERY_CAPTION = "One column a layer, four of its channels drawn";
const GALLERY_NOTE = "the kernels are named image operators, not learned filters";
const INPUT_NOTE = "The three colour channels of the image are drawn as one grey square.";

/**
 * The shape printed under a column, with a 2px rule in the dimension hue under
 * the size that just changed — `--c-dim-a` for H and W together, `--c-dim-b`
 * for C (`model.js`, decision 3 there).
 */
function shapeLine(ctx, colors, shape, x, y, w, changed) {
  const text = shapeText(shape);
  const put = clamped(ctx, colors, text, x, y, w, { color: colors.ink2, mono: true });
  if (!changed || shape.length < 3) return;
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  const before = changed === "C" ? "[" : `[${shape[0]}, `;
  const run = changed === "C" ? `${shape[0]}` : `${shape[1]}, ${shape[2]}`;
  const a = ctx.measureText(before).width;
  const b = ctx.measureText(run).width;
  ctx.strokeStyle = changed === "C" ? colors.dims[1] : colors.dims[0];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(put.x + a, y + 3.5);
  ctx.lineTo(put.x + a + b, y + 3.5);
  ctx.stroke();
  ctx.restore();
}

function drawGallery(ctx, colors, w, state, reveal, bandH) {
  const { net, stages, maps } = state;
  const lay = D.galleryLayout(w, stages);
  caption(ctx, colors, GALLERY_CAPTION, D.PAD, 24);
  note(ctx, colors, GALLERY_NOTE, D.PAD, 40);

  const chosen = reveal.stage;
  /* THE WINDOWS BACK TO THE IMAGE BELONG TO THE SECOND STAGE (decision 14).
     Before the reader asks for them the figure is the architecture: the
     columns, their maps and what reads what. */
  const field = reveal.patch && chosen >= 1 && stages[chosen].spatial
    ? D.receptiveField(stages, chosen, reveal.row, reveal.col)
    : null;

  /* the wiring of every revealed column, faint, and the chosen map's lit — a
     column with no lines into it read as unconnected (Kenneth, 2026-09-14, on
     GAP and Linear); the head columns' rules are in depict.js's fanIn */
  ctx.save();
  for (let c = 1; c < stages.length; c += 1) {
    const ac = reveal.alphaOf(c);
    if (ac <= 0) continue;
    const nCh = lay.cols[c].thumbs.length;
    for (let ch = 0; ch < nCh; ch += 1) {
      const isChosen = c === chosen && ch === reveal.channel;
      if (c === chosen && !isChosen) continue;
      for (const l of D.fanIn(lay, c, ch)) {
        /* a Flatten strip fans 49 lit lines into each score (441 in all); at
           0.95 they were a solid wedge that hid the column (read 2026-09-14),
           so a dense fan from a strip draws at 0.25 */
        const dense = lay.cols[c - 1].thumbs.length > 8;
        ctx.globalAlpha = (isChosen ? (l.lit ? (dense ? 0.25 : 0.95) : 0.16) : (dense ? 0.04 : 0.1)) * ac;
        ctx.strokeStyle = colors.empirical;
        ctx.lineWidth = isChosen && l.lit ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(l.from[0], l.from[1]);
        ctx.lineTo(l.to[0], l.to[1]);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  /* the thumbnails */
  stages.forEach((s, i) => {
    const alpha = reveal.alphaOf(i);
    if (alpha <= 0) return;
    const col = lay.cols[i];
    ctx.save();
    ctx.globalAlpha = alpha;
    col.thumbs.forEach((t) => {
      if (s.spatial) {
        const arr = maps.stages[i][Math.min(t.channel, maps.stages[i].length - 1)];
        const upto = i === chosen && t.channel === reveal.channel && reveal.filled !== null
          ? reveal.filled : Infinity;
        drawMap(ctx, colors, t.x, t.y, t.size, s.H, arr,
          { max: M.maxOf(arr), frame: i === 0 ? colors.groupA : colors.empirical, upto });
      } else {
        const vals = s.values ?? [];
        const hi = M.maxOf(vals);
        const v = vals[t.channel] ?? 0;
        ctx.fillStyle = s.kind === "linear"
          ? wash(colors.groupB, 0.2 + 0.7 * Math.abs(v) / hi)
          : mix(colors.surface2, colors.ink1, Math.abs(v) / hi);
        ctx.fillRect(t.x, t.y, t.size, Math.ceil(t.h));
        /* A STRIP IS ONE COLUMN OF VALUES, NOT 49 BOXES: an outline around each
           4.7px cell reads as a grid of tiny maps, which is the one thing this
           column exists not to say. The values touch and the outline goes
           round the whole of it, below. */
        if (!col.strip) {
          ctx.strokeStyle = s.kind === "linear" ? colors.groupB : colors.empirical;
          ctx.lineWidth = 1;
          ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.size - 1, t.h - 1);
        }
      }
      /* the operator that produced this channel, beside it */
      if (i >= 1 && s.spatial && lay.showNames) {
        note(ctx, colors, maps.kernels[i][t.channel].short,
          col.nameX, t.y + t.size / 2 + 4, colors.ink3);
      }
    });
    if (col.strip && col.thumbs.length) {
      const first = col.thumbs[0];
      const last = col.thumbs[col.thumbs.length - 1];
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1;
      ctx.strokeRect(first.x + 0.5, first.y + 0.5, first.size - 1, last.y + last.h - first.y - 1);
    }
    if (i === chosen) {
      const t = col.thumbs[Math.min(reveal.channel, col.thumbs.length - 1)];
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x - 2.5, t.y - 2.5, t.size + 5, (t.h ?? t.size) + 5);
    }
    ctx.restore();
  });

  /* the windows back to the image, over the thumbnails */
  if (field) {
    for (const cone of D.coneOf(lay, stages, chosen, reveal.channel, reveal.row, reveal.col)) {
      const alpha = reveal.alphaOf(cone.stage);
      if (alpha > 0) drawCone(ctx, colors, cone, alpha);
    }
    windowBox(ctx, colors, lay, 0, 0, field.rows[0], field.cols[0], { fill: true, width: 2 });
    for (let i = 1; i <= chosen; i += 1) {
      const alpha = reveal.alphaOf(i);
      if (alpha <= 0) continue;
      const ch = Math.min(reveal.channel, lay.cols[i].thumbs.length - 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (i < chosen) windowBox(ctx, colors, lay, i, ch, field.rows[i], field.cols[i], { width: 1.5 });
      else markUnit(ctx, colors, lay, i, ch, reveal.row, reveal.col);
      ctx.restore();
    }
  }

  /* the printed lines last, so a line crossing a column does not cross them */
  stages.forEach((s, i) => {
    const alpha = reveal.alphaOf(i);
    if (alpha <= 0) return;
    const col = lay.cols[i];
    ctx.save();
    ctx.globalAlpha = alpha;
    clamped(ctx, colors, s.name, col.x, lay.top - 8, w, { color: colors.ink2, mono: true });
    shapeLine(ctx, colors, s.shape, col.x, lay.lineY(col.labelRow, 0), w, s.changed);
    /* the image's own three channels are counted in its caption instead, so a
       "+2 more" under a square that already says [3, 28, 28] does not read as
       two channels nobody drew */
    if (i > 0 && s.shown < s.C) {
      clamped(ctx, colors, `+${int(s.C - s.shown)} more`, col.x, lay.lineY(col.labelRow, 1), w,
        { color: colors.ink3 });
    }
    ctx.restore();
  });

  note(ctx, colors, INPUT_NOTE, D.PAD, bandH - 12);
}

/* --- band 2 · one output value --------------------------------------------- */

/** How many products the line under a convolution can print before it is cut. */
function productsLine(ctx, colors, win, kern, sum, w) {
  const terms = [];
  for (let j = 0; j < win.length; j += 1) {
    for (let i = 0; i < win.length; i += 1) terms.push(win[j][i] * kern[j][i]);
  }
  const full = terms.map((v) => v.toFixed(2)).join(" + ").replace(/\+ -/g, "− ")
    + ` = ${signed(sum)}`;
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  const fits = ctx.measureText(full).width <= w - 2 * D.PAD;
  ctx.restore();
  return fits ? full : `${terms.length} products add to ${signed(sum)}`;
}

function drawDetail(ctx, colors, w, state, params, reveal, top, bandH) {
  const { net, stages, maps } = state;
  const i = reveal.stage;
  if (i < 1) {
    caption(ctx, colors, "One output value", D.PAD, top + 22);
    note(ctx, colors, "no layer has been added yet", D.PAD, top + 36);
    return;
  }
  const s = stages[i];
  const prev = stages[i - 1];
  const lay = D.detailLayout(w, stages, i);
  const ch = Math.min(reveal.channel, (maps.stages[i]?.length ?? 1) - 1);
  const at = (y) => top + y;
  const mapLbl = (x, name, shape, k) =>
    clamped(ctx, colors, k === 0 ? name : shapeText(shape), x, at(lay.mapLabel[k]), w,
      { color: k === 0 ? colors.ink2 : colors.ink3, mono: true });

  /* A CROSS-CHANNEL CONVOLUTION IS A DIFFERENT ARITHMETIC LINE, so it is a
     different band (decision 19). Four windows, four slices, the sum, the bias
     and ReLU — and no separate input thumbnail, because the four windows ARE
     the four input maps. */
  if (s.kind === "conv" && s.multi) {
    const K = maps.kernels[i][ch];
    const srcs = maps.reads[i];
    const inNames = maps.kernels[i - 1];
    const out = maps.stages[i][ch];
    const row = reveal.row;
    const col = reveal.col;
    const slices = M.slicesAt(K.W, lay.wins[0].k);
    caption(ctx, colors, `${s.name}, one output value`, D.PAD, at(lay.capY));
    note(ctx, colors,
      `the ${K.name.toLowerCase()} kernel over the four channels of ${prev.name} drawn here, `
      + `at row ${row}, column ${col}`, D.PAD, at(lay.subY));

    /* the header over each block names what the block is: the channels read,
       and the kernel whose slices sit on them (round 7) */
    clamped(ctx, colors, `${prev.name}, the four channels drawn`, lay.heads.winsX, at(lay.heads.y), w,
      { color: colors.ink2 });
    clamped(ctx, colors, `${K.name}, one slice per channel`, lay.heads.slicesX, at(lay.heads.y), w,
      { color: colors.ink2 });

    let total = K.bias;
    lay.wins.forEach((b, c) => {
      const win = M.windowAt(srcs[Math.min(c, srcs.length - 1)], prev.H, row, col, b.k);
      const slice = slices[c];
      clamped(ctx, colors, inNames[c].short, b.x, at(b.labelY), w, { color: colors.ink3 });
      clamped(ctx, colors, inNames[c].short, lay.slices[c].x, at(lay.slices[c].labelY), w,
        { color: colors.ink3 });
      for (let j = 0; j < b.k; j += 1) {
        for (let m = 0; m < b.k; m += 1) {
          const v = slice ? slice[j][m] : 0;
          total += v * win[j][m];
          valueCell(ctx, colors, b.x + m * b.cw, at(b.y + j * b.ch), b.cw - 2, b.ch - 2,
            win[j][m].toFixed(2), { hue: colors.groupA });
          const kb = lay.slices[c];
          valueCell(ctx, colors, kb.x + m * kb.cw, at(kb.y + j * kb.ch), kb.cw - 2, kb.ch - 2,
            weight(v), { hue: colors.groupB, empty: v === 0 });
        }
      }
    });
    opGlyph(ctx, colors, { ...lay.opA, y: at(lay.opA.y) }, "∗");
    opGlyph(ctx, colors, { ...lay.opB, y: at(lay.opB.y) }, "=");
    const value = out[row * s.H + col];
    clamped(ctx, colors, `${s.name}[0, ${row}, ${col}]`, lay.sum.x, at(lay.labelY), w,
      { color: colors.ink2, mono: true });
    valueCell(ctx, colors, lay.sum.x, at(lay.sum.y), lay.sum.w, lay.sum.h, signed(value),
      { hue: colors.empirical, lit: true });

    drawMap(ctx, colors, lay.outMap.x, at(lay.outMap.y), lay.outMap.size, s.H, out,
      { max: M.maxOf(out), frame: colors.empirical, cap: 64, upto: reveal.filled ?? Infinity });
    {
      const c = lay.outMap.size / s.H;
      ctx.save();
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(lay.outMap.x + col * c, at(lay.outMap.y) + row * c,
        Math.max(3, c), Math.max(3, c));
      ctx.restore();
    }
    mapLbl(lay.outMap.x, s.name, [s.H, s.H], 0);
    mapLbl(lay.outMap.x, s.name, [s.H, s.H], 1);

    note(ctx, colors,
      `four dot products, then the bias ${signed(K.bias)}, then ReLU: ${Math.max(0, total).toFixed(2)}`,
      D.PAD, at(lay.productsY), colors.ink2);
    /* THE TWO THINGS THIS BAND HAS TO SAY THAT THE PICTURE CANNOT, in the one
       line it has. At k = 5 the slices are the 3 × 3 ones with a ring of zeros
       round them, and twenty value cells will not fit any width this stage
       has, so the band draws the 3 × 3 centre and says the ring adds nothing.
       And the third block's inputs are scaled before the same four kernels run
       over them (decision 20), which is the one fact nothing else on the
       figure carries. Both at once is 129 characters against the 84 the note
       has at 535, so the scaled case says both in short. */
    const kk = lay.wins[0].k;
    const kFull = s.op.k;
    const scaled = maps.reads[i] !== maps.stages[i - 1];
    note(ctx, colors, scaled
      ? (kFull > kk
        ? `the second block's four again, scaled to its range, at their ${kk} × ${kk} centre`
        : "the third block repeats the second's four, over inputs scaled to its range")
      : (kFull > kk
        ? `the ${kk} × ${kk} centre of each ${kFull} × ${kFull} slice, whose ring of zeros adds nothing`
        : "a slice of zeros gives that input channel no weight"),
    D.PAD, at(lay.noteY));
    return;
  }

  if (s.kind === "conv" || s.kind === "pool") {
    const src = maps.stages[i - 1][Math.min(ch, maps.stages[i - 1].length - 1)];
    const out = maps.stages[i][ch];
    const k = s.op.k;
    const row = reveal.row;
    const col = reveal.col;
    const win = s.kind === "conv"
      ? M.windowAt(src, prev.H, row, col, k)
      : M.poolWindowAt(src, prev.H, row, col);
    const kern = s.kind === "conv"
      ? M.kernelAt(maps.kernels[i][ch].k, k) : null;
    const value = out[row * s.H + col];
    const raw = s.kind === "conv"
      ? win.flat().reduce((a, v, n) => a + v * kern.flat()[n], 0) : value;

    /* the image is drawn as one grey square, so a convolution on it reads "the
       image" and not "channel 2 of 3" — there is no second square on screen */
    const from = prev.kind === "input"
      ? "the image" : `${prev.name}, channel ${ch} of ${prev.C}`;
    caption(ctx, colors, `${s.name}, one output value`, D.PAD, at(lay.capY));
    note(ctx, colors, s.kind === "conv"
      ? `the ${maps.kernels[i][ch].name.toLowerCase()} kernel over ${from}, `
        + `at row ${row}, column ${col}`
      : `a ${k} × ${k} window over ${from}, at row ${row}, column ${col}`,
    D.PAD, at(lay.subY));

    /* the input map, with the window on it */
    const srcRow = s.kind === "conv" ? row : 2 * row;
    const srcCol = s.kind === "conv" ? col : 2 * col;
    const p = (k - 1) / 2;
    drawMap(ctx, colors, lay.inMap.x, at(lay.inMap.y), lay.inMap.size, prev.H, src,
      { max: M.maxOf(src), frame: colors.groupA, cap: 64 });
    {
      const c = lay.inMap.size / prev.H;
      const r0 = s.kind === "conv" ? srcRow - p : srcRow;
      const c0 = s.kind === "conv" ? srcCol - p : srcCol;
      ctx.save();
      ctx.fillStyle = wash(colors.highlight, 0.22);
      ctx.fillRect(lay.inMap.x + Math.max(0, c0) * c, at(lay.inMap.y) + Math.max(0, r0) * c,
        Math.min(k, prev.H - Math.max(0, c0)) * c, Math.min(k, prev.H - Math.max(0, r0)) * c);
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.strokeRect(lay.inMap.x + c0 * c + 0.5, at(lay.inMap.y) + r0 * c + 0.5, k * c - 1, k * c - 1);
      ctx.restore();
    }
    mapLbl(lay.inMap.x, prev.name, [prev.H, prev.H], 0);
    mapLbl(lay.inMap.x, prev.name, [prev.H, prev.H], 1);

    /* the window's values */
    clamped(ctx, colors, `Window ${shapeText([k, k])}`, lay.win.x, at(lay.labelY), w,
      { color: colors.ink2, mono: true });
    for (let j = 0; j < k; j += 1) {
      for (let m = 0; m < k; m += 1) {
        valueCell(ctx, colors, lay.win.x + m * lay.win.cw, at(lay.win.y + j * lay.win.ch),
          lay.win.cw, lay.win.ch, win[j][m].toFixed(2), { hue: colors.groupA });
      }
    }
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lay.win.x - 0.5, at(lay.win.y) - 0.5, lay.win.w + 1, lay.win.h + 1);
    ctx.restore();

    if (s.kind === "conv") {
      opGlyph(ctx, colors, { ...lay.opA, y: at(lay.opA.y) }, "∗");
      /* the SHORT name over the cells and the full one in the line above the
         band: "Horizontal edge [3, 3]" is 132px over a 102px block of cells,
         and it ran into the output value's own index */
      clamped(ctx, colors, `${maps.kernels[i][ch].short} ${shapeText([k, k])}`,
        lay.kernel.x, at(lay.labelY), w, { color: colors.ink2, mono: true });
      for (let j = 0; j < k; j += 1) {
        for (let m = 0; m < k; m += 1) {
          valueCell(ctx, colors, lay.kernel.x + m * lay.kernel.cw, at(lay.kernel.y + j * lay.kernel.ch),
            lay.kernel.cw, lay.kernel.ch, n2(kern[j][m]), { hue: colors.groupB });
        }
      }
      opGlyph(ctx, colors, { ...lay.opB, y: at(lay.opB.y) }, "=");
    } else {
      opGlyph(ctx, colors, { ...lay.opA, y: at(lay.opA.y) }, "max");
    }

    clamped(ctx, colors, `${s.name}[0, ${row}, ${col}]`, lay.sum.x, at(lay.labelY), w,
      { color: colors.ink2, mono: true });
    valueCell(ctx, colors, lay.sum.x, at(lay.sum.y), lay.sum.w, lay.sum.h, signed(value),
      { hue: colors.empirical, lit: true });

    /* the map it lands in, filled only as far as the kernel has reached */
    drawMap(ctx, colors, lay.outMap.x, at(lay.outMap.y), lay.outMap.size, s.H, out,
      { max: M.maxOf(out), frame: colors.empirical, cap: 64, upto: reveal.filled ?? Infinity });
    {
      const c = lay.outMap.size / s.H;
      ctx.save();
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(lay.outMap.x + col * c, at(lay.outMap.y) + row * c,
        Math.max(3, c), Math.max(3, c));
      ctx.restore();
    }
    mapLbl(lay.outMap.x, s.name, [s.H, s.H], 0);
    mapLbl(lay.outMap.x, s.name, [s.H, s.H], 1);

    if (s.kind === "conv") {
      note(ctx, colors, productsLine(ctx, colors, win, kern, raw, w),
        D.PAD, at(lay.productsY), colors.ink2);
      note(ctx, colors, raw >= 0
        ? `ReLU keeps ${raw.toFixed(2)}`
        : `ReLU sets ${signed(raw)} to 0`, D.PAD, at(lay.noteY));
    } else {
      note(ctx, colors,
        `max(${win.flat().map((v) => v.toFixed(2)).join(", ")}) = ${value.toFixed(2)}`,
        D.PAD, at(lay.productsY), colors.ink2);
      note(ctx, colors, "pooling has no weights", D.PAD, at(lay.noteY));
    }
    return;
  }

  if (s.kind === "head") {
    const flatten = params.head === "flatten";
    /* WHICH CELL OF THE HEAD COLUMN THE READER PICKED. Under global average
       pooling a cell IS a channel; under Flatten the column draws one channel's
       own values, so the map beside them is that channel whichever cell was
       picked. */
    const chIn = flatten ? 0 : Math.min(reveal.channel, maps.stages[i - 1].length - 1);
    const src = maps.stages[i - 1][chIn];
    /* WHICH FOUR VALUES FLATTEN DRAWS (round 5, point 3). Four cells reading
       the first four entries of the vector said nothing about where they came
       from and were the same four however the reader clicked. These are the
       CENTRE 2 × 2 of the chosen channel, marked on the map beside them, so
       the four numbers have a place on the picture. */
    const mid = Math.max(0, Math.floor(prev.H / 2) - 1);
    const corner = [[mid, mid], [mid, mid + 1], [mid + 1, mid], [mid + 1, mid + 1]]
      .map(([r, c]) => ({ r, c, v: src[r * prev.H + c] ?? 0 }));
    const cellValues = flatten ? corner.map((p) => p.v) : maps.head;
    caption(ctx, colors, flatten
      ? "Flatten, the four values at the centre of this channel"
      : "Global average pooling, four channels",
    D.PAD, at(lay.capY));
    note(ctx, colors, flatten
      ? `every cell of the ${shapeText(prev.shape)} feature map becomes one input to the linear layer`
      : `each channel of the ${shapeText(prev.shape)} feature map is averaged over its `
        + `${prev.H * prev.H} positions`,
    D.PAD, at(lay.subY));
    drawMap(ctx, colors, lay.inMap.x, at(lay.inMap.y), lay.inMap.size, prev.H, src,
      { max: M.maxOf(src), frame: colors.empirical, cap: 64 });
    if (flatten) {
      const c = lay.inMap.size / prev.H;
      ctx.save();
      ctx.fillStyle = wash(colors.highlight, 0.22);
      ctx.fillRect(lay.inMap.x + mid * c, at(lay.inMap.y) + mid * c, 2 * c, 2 * c);
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.strokeRect(lay.inMap.x + mid * c + 0.5, at(lay.inMap.y) + mid * c + 0.5,
        2 * c - 1, 2 * c - 1);
      ctx.restore();
    }
    mapLbl(lay.inMap.x, flatten ? `${prev.name}, channel ${chIn}` : prev.name, prev.shape, 0);
    mapLbl(lay.inMap.x, prev.name, prev.shape, 1);
    opGlyph(ctx, colors, { ...lay.opA, y: at(lay.opA.y) }, flatten ? "→" : "mean");
    clamped(ctx, colors, `${s.name} ${shapeText(s.shape)}`, lay.cells[0].x, at(lay.labelY), w,
      { color: colors.ink2, mono: true });
    lay.cells.forEach((r, c) => {
      valueCell(ctx, colors, r.x, at(r.y), r.w, r.h, signed(cellValues[c] ?? 0),
        { hue: colors.empirical, lit: !flatten && c === chIn });
    });
    note(ctx, colors, flatten
      ? `${int(net.headIn)} values in all, and these four are at rows `
        + `${mid} and ${mid + 1} of the map`
      : `${int(net.headIn)} channels in all, four drawn`, D.PAD, at(lay.productsY), colors.ink2);
    note(ctx, colors, `all of them are inputs to Linear(${net.headIn}, ${M.CLASSES})`, D.PAD, at(lay.noteY));
    return;
  }

  /* THE LINEAR LAYER, OVER EVERY VALUE THE FIGURE HOLDS (round 5, point 3).
     The scores used to be nine numbers over four, whichever head was chosen, so
     the column that is the whole difference between the two heads reached them
     looking the same either way. `computeMaps` now runs the weights over the
     four channels' worth of values Flatten unrolls and over the four averages
     global average pooling produces, so the two heads give different scores
     from different numbers of inputs — which is what the head choice IS. */
  const held = maps.headAll ?? maps.head;
  caption(ctx, colors, `${M.CLASSES} class scores`, D.PAD, at(lay.capY));
  note(ctx, colors,
    `Linear(${net.headIn}, ${M.CLASSES}) over the ${int(held.length)} values of the four channels drawn, `
    + "before softmax",
  D.PAD, at(lay.subY));
  clamped(ctx, colors, `${prev.name} ${shapeText(prev.shape)}`, lay.vec[0].x, at(lay.labelY), w,
    { color: colors.ink2, mono: true });
  lay.vec.forEach((r, c) => {
    valueCell(ctx, colors, r.x, at(r.y), r.w, r.h, signed(held[c] ?? 0), { hue: colors.empirical });
  });
  opGlyph(ctx, colors, { ...lay.opA, y: at(lay.opA.y) }, "×W");
  const hi = M.maxOf(maps.scores);
  const best = maps.scores.reduce((b, v, c) => (Math.abs(v) > Math.abs(maps.scores[b]) ? c : b), 0);
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lay.barX - 6, at(lay.zeroY) + 0.5);
  ctx.lineTo(lay.right, at(lay.zeroY) + 0.5);
  ctx.stroke();
  ctx.restore();
  lay.bars.forEach((b, c) => {
    const h = (Math.abs(maps.scores[c]) / hi) * (lay.half - 6);
    const lit = c === best;
    ctx.save();
    ctx.fillStyle = wash(colors.groupB, lit ? 0.75 : 0.35);
    ctx.fillRect(b.x, at(lay.zeroY) - (maps.scores[c] > 0 ? h : 0), b.w, h);
    ctx.strokeStyle = colors.groupB;
    ctx.lineWidth = lit ? 2 : 1;
    ctx.strokeRect(b.x + 0.5, at(lay.zeroY) - (maps.scores[c] > 0 ? h : 0) + 0.5, b.w - 1, Math.max(1, h - 1));
    ctx.restore();
    txt(ctx, colors, `${c + 1}`, b.x + b.w / 2, at(lay.zeroY + lay.half) - 2,
      { color: lit ? colors.ink1 : colors.ink3, align: "center", size: colors.fsXs, mono: true,
        weight: lit ? "600" : "" });
  });
  note(ctx, colors, `scores ${maps.scores.map((v) => signed(v)).join("  ")}`,
    D.PAD, at(lay.productsY), colors.ink2);
  note(ctx, colors,
    `class ${best + 1} has the largest score  ·  the weights are one draw before training`,
    D.PAD, at(lay.noteY));
}

/* --- band 3 · the head ------------------------------------------------------ */

function drawHead(ctx, colors, w, net, params, top, alpha) {
  if (alpha <= 0) return;
  const lay = M.headLayout(w, net);
  const hr = lay.rows.find((r) => r.head === params.head) ?? lay.rows[0];
  const other = lay.rows.find((r) => r.head !== params.head) ?? lay.rows[1];
  ctx.save();
  ctx.globalAlpha = alpha;
  caption(ctx, colors,
    `The head, on a ${shapeText([lay.flat.C, lay.flat.H, lay.flat.H])} feature map`,
    D.PAD, top + lay.capY);

  const y = top + lay.rowY;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(lay.mapX, y, lay.mapS, lay.mapS);
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 1;
  ctx.strokeRect(lay.mapX + 0.5, y + 0.5, lay.mapS - 1, lay.mapS - 1);
  ctx.restore();
  txt(ctx, colors, shapeText([hr.net.C, hr.net.H, hr.net.H]), lay.mapX, y + lay.mapS + 13,
    { color: colors.ink3, mono: true, size: colors.fsXs });
  txt(ctx, colors, hr.name, lay.mapX, y - 6,
    { color: colors.ink1, size: colors.fsXs, weight: "600" });

  ctx.fillStyle = wash(colors.empirical, 0.5);
  ctx.fillRect(lay.vecX, y + 8, 16, lay.mapS - 16);
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 1;
  ctx.strokeRect(lay.vecX + 0.5, y + 8.5, 15, lay.mapS - 17);
  txt(ctx, colors, shapeText([hr.vec]), lay.vecX - 4, y + lay.mapS + 13,
    { color: colors.ink2, mono: true, size: colors.fsXs });

  /* THE BAR IS ON ONE SCALE FOR BOTH HEADS: full width is the larger head's
     count, so switching Head shows Flatten's bar full and GAP's at 585 / 28,233
     of it — about 6px at 550, drawn at a 4px floor so it exists. Round 5 drew
     the chosen bar to the room it had, and switching heads then drew the same
     bar twice (Kenneth, round 7, 2026-09-15: "can use common scale for linear
     vs gap comparison? now it's autoscaled and hard to visually compare"). */
  const barW = Math.max(4, lay.barMax * hr.net.headParams
    / Math.max(hr.net.headParams, other.net.headParams));
  ctx.fillStyle = wash(colors.groupB, 0.55);
  ctx.fillRect(lay.barX, y + 12, barW, 22);
  ctx.strokeStyle = colors.groupB;
  ctx.lineWidth = 2;
  ctx.strokeRect(lay.barX + 0.5, y + 12.5, barW - 1, 21);
  txt(ctx, colors, int(hr.net.headParams), lay.barX + barW + 8, y + 23,
    { color: colors.ink1, baseline: "middle", weight: "600" });
  note(ctx, colors,
    `Linear(${hr.net.headIn}, ${M.CLASSES})  ·  ${int(hr.net.total)} parameters in the network`,
    lay.barX, y + 48);

  note(ctx, colors,
    `${other.name} instead:  ${int(other.net.total)} parameters in the network, `
    + `${int(other.net.headParams)} in the head`,
    D.PAD, top + lay.otherY, colors.ink2);

  const dy = top + lay.denseY;
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(D.PAD, dy - 14);
  ctx.lineTo(w - D.PAD, dy - 14);
  ctx.stroke();
  ctx.setLineDash([]);
  txt(ctx, colors, `One dense layer from this image to ${int(M.DENSE_UNITS)} units:  ${int(net.dense)}`,
    D.PAD, dy + 4, { color: colors.ink1, weight: "600" });
  /* A foot line here said the two heads are compared by their printed counts;
     it described the drawing, not a quantity (2.9), and went 2026-09-14. */
  ctx.restore();
}

/* ============================ the formula card ============================= */

const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const row = (...xs) => xs.join("");
const RECURSION = MATHML
  ? mml(row(msub(mi("r"), mi("out")), mo("="), msub(mi("r"), mi("in")), mo("+"), mo("("),
    mi("k"), mo("−"), mn("1"), mo(")"), mo("×"), mi("jump")))
  : "r_out = r_in + (k − 1) × jump";

const GUTTER = "3.2em";
let cardHost = null;
let cardKey = null;

function renderCard(params, net) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const key = M.netKey(params);
  if (key === cardKey) return;
  cardKey = key;
  const k = Number(params.k);
  const p = (k - 1) / 2;
  const n = Number(params.input);
  const conv = outSize(n, k, 1, p);
  const rows = [
    ["conv", `⌊(${n} + 2 × ${p} − ${k}) / 1⌋ + 1 = ${conv}`],
    ["pool", `⌊(${conv} − 2) / 2⌋ + 1 = ${outSize(conv, 2, 2, 0)}`],
    ["r", `${RECURSION}<span style="color:var(--ink-3)">&nbsp;&nbsp;${net.rf.map((v) => v.r).join(" → ")}</span>`],
  ];
  const cardNote = "out = ⌊(in + 2 × padding − kernel_size) / stride⌋ + 1. A convolution pads by "
    + "(k − 1) / 2 at stride 1 and keeps the size; pooling is 2 × 2 at stride 2 and halves it. "
    + "jump is the distance in input pixels between neighbouring units, and it doubles at every pool.";
  cardHost.innerHTML = rows
    .map(([name, body]) =>
      `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">${name}</span>${body}</div>`)
    .join("") + `<p class="w-math-note">${cardNote}</p>`;
}

/* ============================== the widget ================================= */

/* What the last `init` was handed, so a click can be told from a Replay and
   from a change to the network (decision 8). A Replay comes back with the same
   state object; every other re-init computes a new one. */
let prev = null;

/** Which column a `pos` names, once the reserved numbers resolve — or none. */
function posColumn(params, stages) {
  const named = M.readPos(params.pos);
  if (named.stage === null) return null;
  if (named.stage === M.STAGE_LAST) return D.lastSpatial(stages);
  if (named.stage === M.STAGE_HEAD) return stages.length - 2;
  if (named.stage === M.STAGE_LINEAR) return stages.length - 1;
  return Math.max(0, Math.min(named.stage, stages.length - 1));
}

/** Which column the `Layer` control names, with its relative value resolved. */
function layerColumn(params, stages) {
  const last = D.lastSpatial(stages);
  if (params.layer === M.LAYER_LAST) return last;
  const i = stages.findIndex((s) => s.spatial && s.name === params.layer);
  return i > 0 ? Math.min(i, last) : last;
}

/**
 * WHICH COLUMN THE FIGURE IS ABOUT, and it has one owner in each stage
 * (decision 15). Behind the gate the `Layer` control owns it, so the control
 * and the figure can never disagree; before the gate `pos` owns it, which is
 * what makes every column of the architecture — the head and the linear layer
 * included — something a click can ask about.
 */
const chosenColumn = (params, stages) => (params.patch
  ? layerColumn(params, stages)
  : (posColumn(params, stages) ?? D.lastSpatial(stages)));

/**
 * WHICH UNIT IS MARKED, before a walk moves it. A column ahead of the reveal is
 * clamped to the last one revealed, and a cell index that clamping moved means
 * nothing in another map, so it falls back to that column's centre — as does a
 * `pos` left on a column the `Layer` control has since moved away from.
 */
function pickOf(params, stages, revealed) {
  const asked = chosenColumn(params, stages);
  const stage = Math.min(asked, revealed);
  const s = stages[stage];
  const named = M.readPos(params.pos);
  const here = stage === asked && posColumn(params, stages) === asked;
  if (stage < 1 || !s.spatial) {
    /* a cell of a head or a linear column is named by its index, not by a
       channel: the linear layer draws nine of them and the encoding carries
       four, so the cell is where the number has room */
    const cells = Math.max(1, s?.shown ?? 1);
    const at = here && named.idx !== null ? Math.min(named.idx, cells - 1) : 0;
    return { stage, channel: at, cell: null, row: 0, col: 0, H: 1 };
  }
  const H = s.H;
  const centre = Math.floor(H / 2);
  const cell = here && named.idx !== null && named.idx < H * H ? named.idx : null;
  return {
    stage,
    channel: here ? Math.min(named.channel, s.shown - 1) : 0,
    cell,
    row: cell === null ? centre : Math.floor(cell / H),
    col: cell === null ? centre : cell % H,
    H,
  };
}

/**
 * WHAT THE WALK HAS TO DO, from the parameters alone: how many cells the chosen
 * map holds, which one it starts at, and its pace. A click on a cell is a pick,
 * so the walk carries on from the cell after it and a reader who stops to look
 * at one unit can start again without going back to the top.
 */
function walkPlan(params, stages, revealed) {
  const pick = pickOf(params, stages, revealed);
  /* there is nothing to walk until the reader asks for the receptive field */
  if (!params.patch || pick.stage < 1 || !stages[pick.stage].spatial) {
    return { pick, cells: 0, start: 0, beats: 0, slide: M.slidePlan(0) };
  }
  const cells = pick.H * pick.H;
  const start = pick.cell === null ? 0 : Math.min(pick.cell + 1, cells);
  return { pick, cells, start, beats: cells - start, slide: M.slidePlan(cells) };
}

/** The columns in, the marked unit, and the alphas, from parameters and `anim`. */
function revealOf(params, state, anim) {
  const { net, stages } = state;
  /* BEHIND THE GATE EVERY COLUMN IS IN, whatever the counter says. The
     receptive field is a fact about a network that exists, so the second stage
     draws the whole of it at once rather than making the reader watch six
     columns arrive before the thing they pressed for (decision 14). */
  const n = params.patch ? net.units : Math.min(anim?.n ?? 0, net.units);
  const beat = anim?.beat ?? 0;
  const arriving = beat > 0 && n < net.units ? n + 1 : 0;
  const grow = easeOut(Math.max(0, Math.min(1, beat)));
  const plan = walkPlan(params, stages, n);
  const pick = plan.pick;
  const walked = Math.min(anim?.s ?? 0, plan.beats);
  /* The walk writes nothing back (1.1): the cell on screen is the start plus
     the presses run, and before the first of them it is what `pos` names. */
  const idx = walked > 0 ? plan.start + walked - 1 : null;
  const H = Math.max(1, pick.H);
  return {
    n,
    stage: pick.stage,
    channel: pick.channel,
    row: idx === null ? pick.row : Math.floor(idx / H),
    col: idx === null ? pick.col : idx % H,
    /** how much of the chosen map is drawn: up to the cell the unit is on,
        which is the whole of it once the walk has been all the way round */
    filled: walked > 0 && walked < plan.beats ? plan.start + walked - 1 : null,
    alphaOf: (i) => (i <= n ? 1 : i === arriving ? grow : 0),
    headAlpha: n >= net.units ? 1 : arriving === net.units ? grow : 0,
    /** whether the reader has asked for the windows back to the image */
    patch: Boolean(params.patch),
  };
}

const PHASES = { layers: "layers", units: "units" };
function settle(anim, plan, units, patch) {
  if (!patch) {
    anim.done = anim.n >= units;
    anim.phase = PHASES.layers;
    return;
  }
  anim.done = anim.s >= plan.beats;
  anim.phase = PHASES.units;
}

const BLOCK_OPTIONS = ["1", "2", "3"].map((v) => ({ value: v, label: v }));
/* five layers, then the head and the linear layer, then a 64 × 64 map walked
   once — the longest press count any combination of the controls reaches */
const SHOWN_MAX = 7 + 4096;

/** One frame of whichever walk the gate names: a unit of the layers, or a
    cell of the receptive field. Was the body of `advance` until 2026-09-20. */
function takeBeat(anim, dt, params, state) {
  const patch = Boolean(params.patch);
  const plan = walkPlan(params, state.stages, Math.min(anim.n, state.units));
  const step = anim.mode === "step";
  if (!patch) {
    if (anim.n >= state.units) {
      anim.beat = 0;
      anim.phase = PHASES.layers;
      anim.done = true;
      return false;
    }
    anim.beat += dt / M.UNIT_MS;
    if (anim.beat < 1) return true;
    anim.beat = 0;
    anim.n += 1;
    anim.acc = 0;
    settle(anim, plan, state.units, patch);
    return !step && !anim.done;
  }
  if (anim.s >= plan.beats) {
    anim.beat = 0;
    anim.phase = PHASES.units;
    anim.done = true;
    return false;
  }
  /* THE PACE RAMPS ACROSS THE MAP (decision 10), so the wait is read one
     cell at a time rather than assumed: the accumulator is spent against
     whatever this cell costs, and on the big maps several cells go by in
     one frame near the end. */
  anim.acc += dt;
  let moved = 0;
  while (anim.s < plan.beats) {
    const ms = M.slideMsAt(plan.slide, plan.start + anim.s);
    if (anim.acc < ms) break;
    anim.acc -= ms;
    anim.s += 1;
    moved += 1;
    if (step) { anim.acc = 0; break; }
  }
  if (moved === 0) return true;
  settle(anim, plan, state.units, patch);
  return !step && !anim.done;
}

defineWidget({
  slug: "cnn-architecture",
  title: "Deep Learning - CNN Architecture",
  status: "shipped",
  subtitle:
    "A convolutional layer applies the same small kernel at every position, so "
    + "its parameter count does not grow with the image. Each output unit is "
    + "computed from a square patch of the input, its receptive field, which "
    + "widens with every layer.",
  layout: "side",
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    netSec: { type: "section", label: "The network" },
    blocks: {
      type: "choice",
      label: "Blocks",
      detail: "how many Conv → ReLU → MaxPool blocks the network has",
      options: BLOCK_OPTIONS,
      default: "2",
    },
    base: {
      type: "choice",
      label: "First channels",
      detail: "output channels of the first convolution; each block doubles the count",
      options: [{ value: "16", label: "16" }, { value: "32", label: "32" }],
      default: "32",
    },
    k: {
      type: "choice",
      label: "Kernel size",
      detail: "the side of the square kernel, with padding (k − 1) / 2",
      options: [{ value: "3", label: "3" }, { value: "5", label: "5" }],
      default: "3",
    },

    headSec: { type: "section", label: "The head" },
    head: {
      type: "segmented",
      label: "Head",
      options: [
        { value: "flatten", label: "Flatten", detail: "every cell of the feature map is one input to the linear layer" },
        { value: "gap", label: "GAP", detail: "each channel is averaged over its positions, one input per channel" },
      ],
      default: "gap",
    },

    imgSec: { type: "section", label: "The image" },
    input: {
      type: "choice",
      label: "Image size",
      detail: "the side of the input image, in pixels",
      options: [{ value: "28", label: "28" }, { value: "64", label: "64" }],
      default: "28",
    },

    /* THE SECOND STAGE, BEHIND ONE BUTTON (3.4b, decision 14). It writes a
       real parameter, so `?patch=1` reproduces the stage a link was copied in;
       it is `display`, so opening and closing it keeps the columns the reader
       has built; and it is pressable from the first frame, because the phases
       are ordered anyway and the layers arrive before the patches either way. */
    patch: {
      type: "bool",
      style: "action",
      label: "Show the receptive field",
      detail: "the patch of the image one unit of a feature map is computed from",
      default: false,
      display: true,
    },
    fieldSec: { type: "section", label: "The receptive field", when: { param: "patch" } },
    /* WHICH FEATURE MAP THE MARKED UNIT BELONGS TO. The last one is named
       relatively, for the reason `pos` names it relatively (decision 8): a
       block added carries the choice to the new last column, and a choice made
       on an earlier column survives. */
    layer: {
      type: "choice",
      label: "Layer",
      detail: "which feature map the marked unit belongs to",
      options: (values) => {
        const names = M.layerNames(values);
        return names.map((name, i) =>
          ({ value: i === names.length - 1 ? M.LAYER_LAST : name, label: name }));
      },
      optionsFrom: "blocks",
      default: M.LAYER_LAST,
      when: { param: "patch" },
    },

    /* WHICH UNIT IS MARKED, as one number: the column, the drawn channel and
       the cell, with three reserved column numbers for the relative form.
       `model.js` holds the encoding and decisions 7, 8 and 15 hold why. */
    pos: { type: "int", min: M.POS_MIN, max: M.POS_MAX, default: M.POS_DEFAULT, hidden: true },
    /* Authoring escape hatch, first render only: how many presses are run —
       columns before the gate, cells of the chosen map behind it. */
    shown: { type: "int", min: 0, max: SHOWN_MAX, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "A feature map the network computed, drawn light to dark", mark: "hollow" },
    { token: "group-a", label: "The image, and the values a window covers" },
    { token: "group-b", label: "The layer's weights: the kernel, and the linear layer" },
    { token: "highlight", label: "The marked unit, its patch of the image, and the windows between" },
    { token: "extreme", label: "A patch wider than the whole image" },
    { token: "reference", label: "A dense layer on the same image", mark: "dash" },
    { token: "dim-a", label: "Height and width changed here", mark: "line" },
    { token: "dim-b", label: "Channels changed here", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const net = M.buildNet(M.paramsToCfg(params));
    const maps = M.computeMaps(net, rng);
    const stages = M.stagesFor(net, maps, {
      head: params.head === "flatten" ? "Flatten" : "GAP",
      linear: "Linear",
    });
    return { net, maps, stages, units: net.units, tex: maps.tex };
  },

  animation: {
    stepLabel: {
      anim: "phase",
      labels: { layers: "Next layer", units: "Next unit" },
      default: "Next layer",
    },
    stepTitle: {
      anim: "phase",
      labels: {
        layers: "Add the next layer: its four channels, and the maps each is computed from",
        units: "Mark the next unit of the chosen feature map: its value, the window it is "
          + "computed from, and its patch of the image",
      },
      default: "Add the next layer: its four channels, and the maps each is computed from",
    },
    runLabel: "Play",
    runTitle: "Add the remaining layers; with the receptive field shown, mark every unit of "
      + "the chosen feature map in turn",

    init: ({ params, state, fromScratch }) => {
      /* Three cases to separate. A Replay hands back the SAME state object, so
         it starts from empty with the same pick; a click computes a new one
         with the network unchanged and `pos` off its default, so it keeps the
         columns the reader has built and starts the walks again from the cell
         they picked; Reset returns every parameter to its default, which takes
         the same path a change to the network does.

         `shown` COUNTS WHAT THIS STAGE HAS TO COUNT: columns before the gate,
         cells of the chosen map behind it. So `?shown=4` is four columns and
         `?patch=1&shown=20` opens with the unit on the map's twentieth cell
         and the map drawn as far as that cell. */
      const patch = Boolean(params.patch);
      const pick = `${patch ? 1 : 0}:${params.layer}:${Number(params.pos)}`;
      const replay = prev !== null && prev.state === state && prev.pick === pick;
      const sameNet = prev !== null && prev.key === M.netKey(params);
      const placed = Number(params.pos) !== M.POS_DEFAULT;
      const kept = !replay && sameNet && placed ? prev.anim.n : null;
      const head = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      const n = patch ? state.units
        : kept !== null ? Math.min(kept, state.units) : Math.min(head, state.units);
      const plan = walkPlan(params, state.stages, n);
      const anim = {
        n,
        s: patch ? Math.min(head, plan.beats) : 0,
        beat: 0,
        acc: 0,
        phase: PHASES.layers,
        done: false,
      };
      settle(anim, plan, state.units, patch);
      prev = { state, key: M.netKey(params), pick, anim };
      return anim;
    },

    /* THE GATE IS A DISPLAY PARAMETER, so core keeps the animation rather than
       starting it over (non-negotiable 3), and this is where the two stages
       hand over. Opening puts every column in and starts the walks at the
       beginning; closing leaves the columns where they are, which is what makes
       stepping out and back in cost nothing (3.4b). */
    rebuild: (anim, { params, state }) => {
      const patch = Boolean(params.patch);
      /* THE FIELD WALK STARTS OVER ON EVERY DISPLAY CHANGE (`s` and `acc`
         below), and core keeps a running loop going through one: the gate
         opened mid-unit left the loop walking the receptive field, a beat
         ahead of the reader's first press, and a control moved mid-walk had
         the loop walking on from the start it had just been given. Found by
         the sweep after widget 70's ship (2026-09-20). Everything is already
         in place — opening lands every unit, closing is core's own stop — so
         the loop only has to end: `halt` does, at its next frame, only while
         a walk moves (`advance` records it). */
      if (patch && anim.moving) anim.halt = true;
      if (patch) {
        anim.n = state.units;
        anim.beat = 0;
      }
      anim.s = 0;
      anim.acc = 0;
      settle(anim, walkPlan(params, state.stages, anim.n), state.units, patch);
    },

    advance: (anim, { dt, params, state }) => {
      /* the loop left running for a walk the gate finished (`rebuild`)
         ends here, before it takes the other's next */
      if (anim.halt) { anim.halt = false; anim.moving = false; return false; }
      const more = takeBeat(anim, dt, params, state);
      anim.moving = more;
      return more;
    },
  },

  /* --- the figure as a control (3.6) --------------------------------------- *
   * ONE PARAMETER, THREE KINDS OF TARGET. A column's own name picks that
   * column and its centre unit; a drawn channel picks that channel; a cell of
   * a drawn channel picks that cell. All three write `pos`, so a click is one
   * transaction whichever it was and the last click is what the URL describes.
   *
   * BEHIND THE GATE THE TABLE SPLITS IN TWO (decision 15), because a click and
   * the `Layer` control have to agree and a region may write exactly one
   * parameter. The chosen layer's own cells write `pos` — that is the unit
   * being marked; every OTHER feature map is one target that writes `layer`,
   * so clicking a column there moves the control with it rather than leaving
   * it naming a column nobody is looking at. The head and the linear layer
   * carry no receptive field and so carry no target in that stage; before the
   * gate every column has its cells back.
   *
   * A CELL UNDER 2px IS NOT A TARGET OF ITS OWN. conv1 on a 64px image draws
   * 4,096 cells in a 56px square, which is 0.875px a cell: the table would
   * hold 65,000 rectangles, core rebuilds it on every pointer move, and no
   * reader can aim at a cell they cannot see. Those channels are one target
   * each and land on the map's centre. At the sizes a 28px image draws, every
   * cell is exactly 2px and every one of them is its own target.
   *
   * Built from `depict.js`'s own layout, so a target is the rectangle the
   * drawing paints — the one fact about a click no pixel hash can see (5.7).  */
  regions: ({ w, params, state }) => {
    if (!state) return [];
    const { stages } = state;
    const lay = D.galleryLayout(w, stages);
    const last = D.lastSpatial(stages);
    const nameOf = (i) => (i === last ? M.STAGE_LAST
      : i === stages.length - 2 ? M.STAGE_HEAD
        : i === stages.length - 1 ? M.STAGE_LINEAR : i);
    const patch = Boolean(params.patch);
    const chosen = chosenColumn(params, stages);
    const out = [];
    for (let i = 1; i < stages.length; i += 1) {
      const s = stages[i];
      const col = lay.cols[i];
      const nameBox = { x: col.x, y: lay.top - 16, w: Math.max(col.w, 30), h: 16 };
      const shapeBox = {
        x: col.x, y: lay.lineY(col.labelRow, 0) - 12, w: Math.max(col.w, 30), h: 30,
      };
      if (patch && i !== chosen) {
        /* one target a column, and it moves the Layer control */
        if (!s.spatial) continue;
        const value = i === last ? M.LAYER_LAST : s.name;
        const block = col.thumbs.length
          ? {
            x: col.x,
            y: col.thumbs[0].y,
            w: Math.max(col.w, 30),
            h: col.thumbs.at(-1).y + col.thumbs.at(-1).h - col.thumbs[0].y,
          }
          : nameBox;
        for (const r of [nameBox, shapeBox, block]) {
          out.push({ ...r, set: { layer: value }, label: s.name });
        }
        continue;
      }
      const centre = M.posOfColumn(nameOf(i));
      out.push({ ...nameBox, set: { pos: centre }, label: s.name });
      out.push({ ...shapeBox, set: { pos: centre }, label: s.name });
      for (const t of col.thumbs) {
        if (!s.spatial) {
          /* a cell of a head or a linear column is named by its INDEX: nine
             scores do not fit the four channels the encoding carries, and a
             channel number past the fourth read as another column entirely */
          out.push({
            x: t.x, y: t.y, w: t.size, h: t.h,
            set: { pos: M.posOf(nameOf(i), 0, t.channel) },
            label: `${s.name} value ${t.channel + 1}`,
          });
          continue;
        }
        if (col.cellPx < D.CELL_MIN) {
          out.push({
            x: t.x, y: t.y, w: t.size, h: t.size,
            set: { pos: M.posOf(nameOf(i), t.channel, M.POS_CENTRE_IDX) },
            label: `${s.name} channel ${t.channel}`,
          });
          continue;
        }
        const c = col.cellPx;
        for (let r = 0; r < s.H; r += 1) {
          for (let q = 0; q < s.H; q += 1) {
            out.push({
              x: t.x + q * c, y: t.y + r * c, w: c, h: c,
              set: { pos: M.posOf(nameOf(i), t.channel, r * s.H + q) },
              label: `${s.name} channel ${t.channel}, row ${r}, column ${q}`,
            });
          }
        }
      }
    }
    return out;
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params, state.net);
    const b = M.bands(w, state.net, state.stages);
    const reveal = revealOf(params, state, anim);
    drawGallery(ctx, colors, w, state, reveal, b.one);
    drawDetail(ctx, colors, w, state, params, reveal, b.topTwo, b.two);
    drawHead(ctx, colors, w, state.net, params, b.topThree, reveal.headAlpha);
  },

  readout({ params, state, anim }) {
    const { net, stages } = state;
    const reveal = revealOf(params, state, anim);
    const started = reveal.n > 0;
    const spatialIn = Math.min(reveal.n, net.layerUnits);
    const conv = M.convParamsTo(net, spatialIn);
    const headDone = reveal.n >= net.units;
    const marked = reveal.stage >= 1 && stages[reveal.stage].spatial ? reveal.stage : null;
    const r = marked === null ? null
      : D.receptiveField(stages, marked, reveal.row, reveal.col).r;
    return [
      {
        label: "Parameters in this network",
        value: started ? int(conv + (headDone ? net.headParams : 0)) : "—",
        note: started
          ? `convolutions ${int(conv)} · head ${headDone ? int(net.headParams) : "—"}`
          : "no layer has been added yet",
      },
      {
        label: "Receptive field",
        value: r === null ? "—" : `${r} of ${net.cfg.input} px`,
        note: marked === null
          ? "what one unit of the last feature map is computed from"
          : `what one unit of ${stages[marked].name} is computed from`,
      },
      {
        label: "A dense layer instead",
        value: started ? int(net.dense) : "—",
        note: `this image to ${int(M.DENSE_UNITS)} units`,
      },
    ];
  },
});
