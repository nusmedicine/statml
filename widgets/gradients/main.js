/* ============================================================================
   Widget 48 · Gradients — a derivative, the partials, and the descent.

   Three tabs in the lesson's own order: Derivative · Partial derivatives ·
   Descent. Decision blocks 1-6 below are about Descent, which was the whole
   widget until 2026-09-08 and is unchanged apart from the two picks in block 7;
   block 7 is the rename and the two new tabs.

   PHM5005 05-2 cells 73-78 (the worked example), 05-1 cell 4 (the update rule
   over the hill picture), 05-4 cell 41 (too high is unstable, too low is slow)
   and 05-4 cell 5 (batches give less noisy gradients). The misconception, as
   reported: the learning rate is a speed, so larger is faster. Inferred
   alongside it: the gradient points at the minimum.

   KENNETH'S PICKS from `_lab/gd-mock.html`, 2026-09-07 — the build brief:
     §1 C  the data beside the surface, with a loss strip beneath
     §2 C  the two partials as component ticks along the axes, each with its
           number, composing into the direction
     §3    the lr ladder must hold the lesson's 0.01, a value raw x diverges
           at, and a value standardized x diverges at
     §4    `scale` is a data control, raw or standardized x
     §5    the one-parameter parabola is its own page, and it comes first
     §6    a `batch` control, full / 10 / 1
   Routine calls he left to the build: the walk starts at the lesson's (0, 0)
   with no start sliders; Slow choreographs one epoch; the readout is b₀, b₁,
   the loss as a multiple of the least, the two partials and the step length,
   with "diverged at epoch N" replacing the loss once it has.

   MEASURED, and re-asserted by `_lab/gd-verify.mjs` so nothing printed here
   can drift away from the engine (the curvatures the `scale` control states on
   screen are checked there):

     raw x           curvatures 68.5 and 0.50, condition 138; stable lr < 0.029
     standardized x  curvatures 2 and 2;                      stable lr < 1
     raw, lr 0.03    diverges at epoch 274;  lr 0.05 at epoch 17
     raw, lr 0.01    b₀ 5.17, b₁ 1.97 after 1000 epochs (least squares 5.20, 1.97)
     batches, raw, lr 0.01, 20 epochs: full batch ends at 6.0x the least loss,
       batches of 10 at 1.8x, single rows at 1.6x — two thousand small noisy
       updates beat twenty exact ones, and none of the three diverged. So the
       `batch` control has a stage that WINS as well as a path that wobbles.

   THE DECISIONS THE BRIEF DID NOT SETTLE, recorded because each could
   reasonably have gone the other way.

   1. THE COMPOSED ARROW IS BUILT IN SCREEN SPACE, not in parameter space. The
      mock scaled (-g₀, -g₁) directly into pixels, which is right only when the
      two axes have the same units per pixel — and they do not: the b₀ window
      spans 10.2 against b₁'s 4.0 on a square panel. Composed that way the
      arrow points somewhere the dot does not then go, in the one figure whose
      whole claim is where the step goes. So the direction is the SCREEN delta
      of one unit-time step, normalised to a fixed length; the two component
      ticks are that arrow's x and y parts, so they still compose exactly, and
      each still carries its own partial's number. Nothing on screen claims the
      arrow is perpendicular to the contour, because at this aspect it is not.

   2. THE LEAST-SQUARES LINE AND ITS TWO NUMBERS SHOW FROM THE START; the
      minimum ON THE SURFACE is crossed only once the walk is within 1% of the
      least loss. The brief settles both, and they look inconsistent until you
      ask what this widget's answer is: not "what are the fitted values" —
      widget 27 owns that — but "how does the learning rate govern the walk".
      The fitted pair is the reference the walk is judged against (2.7), and
      the cross is the widget saying the walk ARRIVED, which is the thing the
      reader has to build (2.1).

   3. THE LOSS STRIP PLOTS log10(loss ÷ the least loss), not log10(loss). The
      floor is then 0 on both pages and on both scales, so only the top
      ratchets (2.5), and the axis reads in the same units as the surface's
      colour bar and the loss tile. Its top is capped at 6 decades: a divergent
      run reaches 16, and letting it set the window would squash every
      convergent walk into the bottom pixel.

   4. THE RELIEF IS A SECOND READING OF THE SAME PANEL, added 2026-09-07 from
      Kenneth's picks off `_lab/gd-3d.html`: log height, a fixed viewpoint, the
      hidden part of the path dashed, the partials as tangents on the surface.
      Four things it settles.

      THE VIEWPOINT IS A CONSTANT, azimuth 300 and elevation 35, and it was
      swept rather than chosen: with log height the walk lies along the trench,
      and from 215/38 the near wall hides 94% of the lesson's own walk. A
      viewpoint control would hand the reader directions that hide the thing
      the widget is about, so `model.js` holds the pair and `gd-verify.mjs`
      re-measures the claim. The catalogue records the sweep. *Superseded on
      2026-09-08 by decision 5; what survives it is 300/35 as the viewpoint the
      figure OPENS at, and every sweep measurement above is about that.*

      THE HIDDEN PART OF THE PATH IS DASHED AND FAINT, rather than the mesh
      being made transparent. A translucent mesh shows the far wall through the
      near one and the relief stops reading as a surface; the dashed hidden
      line is the drawing convention for exactly this and costs one
      classification per walk.

      BOTH EXPENSIVE PARTS ARE CACHED, on the same terms the map's bitmap
      already is: the mesh (1936 quads, sorted and filled, ~2 ms) into a bitmap
      keyed on size, theme and dataset, and the path's visible/hidden split
      (~1 ms) keyed on the walk. Only the path, the point, the tangents and the
      corner names are painted per frame. Both keys gained the viewpoint with
      decision 5, since both are functions of it.

      THE PATH IS SAMPLED, dense over the opening 300 updates and strided after
      it to about 1500 pieces. At batch 1 the walk holds 100 000 positions; the
      map's own path already strides to 1500, and the opening stays dense
      because the first epochs cross most of the frame while the rest crawl.

   5. THE VIEWPOINT BECAME A DRAGGED PARAMETER on 2026-09-08, at Kenneth's ask:
      the relief turns under the mouse. Decision 4 had it fixed, and the reason
      it gave — a reader has no way to know which directions hide the walk — is
      answered by where the figure OPENS rather than by refusing to move: 300/35
      is still the measured default, `gd-verify.mjs` still re-measures every rung
      on both scales from it, and a reader who turns the surface into its own
      near wall can see that they have.

      IT IS A PARAMETER AND NOT ANIMATION STATE, which is the whole of why it
      goes through core's `drag` channel rather than a pointer handler here. A
      camera held in `anim` would be invisible to the URL, so the reader could
      find the angle that shows their walk and have no way to send it to anyone
      — the figure would be showing one thing and the link claiming another
      (1.1). A drag is a control and obeys a control's rules (3.6), so `turn`
      and `tilt` are ordinary `display: true` parameters: the walk survives the
      turn, and the two are written as one transaction because a camera's turn
      and tilt are one gesture.

      THEY CARRY NO RAIL CONTROL, and that is the one rule bent here. 3.6's
      "keep the control" exists so a figure is not mouse-only; two more sliders
      for a camera would cost the rail more than they buy, and nothing in the
      widget's argument is reachable only by turning — the map is the same
      window, drawn straight down, and every number the widget states is on it.
      The relief is a second reading, and the turn is a second reading of that.

   6. THREE THINGS KENNETH ASKED FOR ON 2026-09-08, after the drag landed.

      A "DEFAULT VIEW" BUTTON, because a dragged viewpoint needs a way home
      that is not another drag. Decision 5 bent 3.6 by giving the camera no rail
      control, and the cost of that only shows once a reader has turned the
      surface into its own near wall: the way back is to drag until it looks
      right again, which is a search rather than a control. The button is the
      one piece of the camera that belongs in the rail — not a number to set,
      an action to take — so it is a momentary `bool` on widgets 34, 35 and
      mlp's pattern: pressed, `rebuild` sees it true, the widget writes `turn`
      and `tilt` back to the measured 300/35 and releases the button, and the
      URL carries the viewpoint and never the press. Display-only throughout,
      so coming home keeps the walk (3.2).

      THE ONE-PARAMETER PAGE DRAWS ITS GRADIENT AS A VECTOR, which is the
      one-dimensional case of the map's composed direction rather than a second
      idea. There θ is (b₀, b₁), the two partials are component ticks and they
      compose into the arrow the step takes (§2 C). Here θ is b₁ alone, so
      −∂L/∂θ has one component and the arrow is horizontal — same fixed pixel
      length, same lettering, same number beside it. Without it the page showed
      the SLOPE and left the reader to infer the DIRECTION, which is the
      misconception this widget was built for.

      EVERY SPEED CHOREOGRAPHS ON THE ONE-PARAMETER PAGE. Kenneth: *"default to
      slow animation, it's currently too fast."* An epoch is a hop on this page
      and a crawl on the other — the parabola is walked in about ten epochs at
      lr 0.01, the surface in a thousand — so one clock cannot serve both, and
      Medium's 60 a second showed a walk that was over before it started. The
      pages now differ in the CLOCK and not in the choreography: the table is
      `EPOCH_MS` in `model.js`, where `gd-verify.mjs` can assert it, and Slow
      still choreographs over the surface exactly as it did. A per-page default
      for `speed` was the obvious smaller change and is not expressible — the
      URL omits a parameter at its default, so the two pages share one.

   7. THE RENAME, AND THE TWO TABS IN FRONT OF THE WALK (2026-09-08). Kenneth,
      round 5: *"consider basics first — a tab for concepts, differentiation and
      partial differentiation. Maybe call it Gradients, with tabs like diff and
      optimization."* Mocked in `_lab/gd-round5.html` §3 and picked from it, with
      the rename to land now rather than at promotion.

      THE ORDER IS THE LESSON'S. A derivative is how much y changes for a small
      change in a; a partial derivative is that with the other variables held,
      and the gradient is the vector of them; descent steps against that vector.
      The slug follows the widget: `gradients`, because descent is now the last
      third of it and a name for the whole is a name for the argument.

      BOTH NEW TABS ARE THE SAME FUNCTION, y = a^2 + 3ab, which 05-1 differentiates
      at (2, 1) and prints 7 and 6 for. One function across two tabs is what
      makes the second tab a reading of the first rather than a fresh example,
      and the numbers are the ones the reader has already seen printed.

      WHAT EACH CLAIMS.
        Derivative — the tangent's slope is dy/da, and a nudge of Δa moves y by
          about that slope times Δa. What the tangent misses is EXACTLY Δa^2 on
          this function (model.js says why), so the ladder from 1 down to 0.01
          takes the gap from 1 to 0.0001 and the approximation is seen to
          improve rather than asserted to.
        Partial derivatives — each partial is the slope along one variable with
          the other held, drawn as a slice beside the map; the gradient is the
          pair, and it points uphill.

      THE PARTIAL DERIVATIVES TAB DECLINES BOTH DRIVE BUTTONS (4.5). Everything
      on it is at rest: two sliders move a point over a fixed function, and
      there is no arrival to wait for. It declines them through `anim.inert`
      rather than `stepLabel: null`, which core reads once when the shell is
      built and could not then give the other two tabs their buttons back —
      `hierarchical-clustering` is the same shape.

      THE DRIVE BUTTON SAYS "SHRINK THE NUDGE" AND NOT "HALVE" IT. The brief
      asked for Halve; the ladder is 1 · 0.5 · 0.25 · 0.1 · 0.05 · 0.01 and two
      of its five rungs are a fifth and a two-and-a-half, so the button would
      have been false on the press that made it (4.4b). What the ladder is for
      is four orders of the gap in six readable numbers, not a halving sequence.

      THE DERIVATIVE PANEL CARRIES EXACTLY ONE LABEL, the slope on the tangent.
      Δa and the gap were labelled on the figure too and both came off: a
      fillText BOX sweep at four widths over the whole window found 44 label
      collisions and 528 escapes past the panel edge between them. Their numbers
      are on the line under the panel and in the readout, which have room; what
      has to sit on a mark is the number that mark IS.

      THE ARROW ON THE (a, b) MAP IS BUILT IN PARAMETER UNITS, which decision 1
      forbids on the loss surface. The difference is that nothing follows it:
      decision 1's trap is an arrow that points somewhere the dot does not then
      go, and on this tab no dot goes anywhere. What the arrow claims is uphill,
      and a monotone pair of scales cannot turn uphill into downhill. The panel
      is square over a 5-by-4 window, so the arrow is 1.25x off perpendicular to
      the rings; nothing on screen says it is perpendicular.

      THE MAP SITS WHERE THE LOSS SURFACE SITS — the right-hand square, same
      rect — rather than on the left as the mock had it, so the two parameter
      maps land in the same place as the reader moves between tabs. The two
      slices take the left column the data panel holds on Descent.

      AND THE TWO PICKS OFF ROUND 5 §1 AND §2, both on Descent.

      THE ANGLE, AND THE STRAIGHT LINE IT IS MEASURED FROM (§1). Kenneth: *"why
      doesn't the gradient go downhill directly? it's descending by one
      parameter then the next — is this what actually happens?"* It is not, and
      the widget drew the answer without saying it. The map now draws the
      straight line from the walk to the least-squares point faint and dashed,
      and a line under the figure states the angle between that line and the
      step: 80 degrees at lr 0.003 and epoch 10 on raw x, 0 on standardized x,
      both re-measured in `gd-verify.mjs`. It is `model.js`'s `stepAngle` and not
      arithmetic in the panel, because the number is a fact about the surface
      and not about the drawing — the equal-aspect mock prints the same 80.

      THE LINE GOT ITS OWN ROW AND THE STAGE GREW 18px FOR IT. There was no gap
      to put it in: the beat line sits at +78 under the panels and the loss
      strip's caption at +96, and a sentence 407px long does not fit beside
      either at the widths this widget is drawn at. Squeezing it under the
      colour bar fits at 900px and collides at 550. So the strip moved down one
      line box and `stageHeight` went from side + 240 to side + 258; the row is
      reserved on every page and filled only on the two-parameter map (3.4k).

      CHOREOGRAPHY A ON THE ONE-PARAMETER PAGE (§2). Kenneth: the tangent *"moves
      then redraws (like expanding out) at each step"*. It did: the segment grew
      from its centre at the start of every epoch. Now it is always at full
      length and rolls with the point; each epoch holds at the point for 40% of
      the beat with the arrow and its number, then moves for the other 60% with
      an ease-in-out. Picked live from five candidates against the current
      behaviour, which was E.

   The `optimizer` picker (SGD / momentum / Adam, 05-4's table) is a later
   round and unmeasured. The catalogue says not to add it before it is.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  N, EPOCHS, LR_LADDER, BATCHES, LOG_CAP, LEVELS,
  makeData, standardize, quad, domainFor, contourSegments, isoSegments,
  descendFull, descendMini, descendSlope, posAt, stepAngle,
  projector, reliefMesh, reliefPoint, reliefHidden,
  RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL,
  gradFn, A_RANGE, B_RANGE, Y_RANGE, Y_LEVELS, NUDGES,
  beatMs, choreographs, epochMs,
} from "./model.js";

/* ---- geometry ------------------------------------------------------------ */

const PAD_L = 52;         // a rotated y-axis label plus its tick numbers
const PAD_R = 14;
const TOP = 30;           // the caption line above the top row of panels
const SURF_GUTTER = 56;   // between the data panel and the surface's own y axis
const LOSS_H = 70;

/* The surface has to be SQUARE — it is a window on the parameter plane and a
   path across it should not be sheared by the panel's aspect — so the data
   panel takes whatever the width leaves. */
const surfSide = (w) =>
  Math.round(Math.max(180, Math.min(300, (w - PAD_L - PAD_R - SURF_GUTTER) * 0.46)));

/* ONE HEIGHT FOR ALL THREE TABS, and for both Descent pages. The one-parameter
   panel is sized to make the loss strip land on the same y on either page, and
   the two concept panels are sized to end where the strip's axis label does, so
   moving between tabs or pages moves the rail and nothing else (3.4).

   side + 258, not + 240: the angle line took a line box of its own under the
   two-parameter map (decision 7) and every page reserves it. */
const stageHeight = (w) => surfSide(w) + 258;

function layout(w) {
  const side = surfSide(w);
  const full = w - PAD_L - PAD_R;
  const left = w - PAD_L - PAD_R - SURF_GUTTER - side;
  /* The two slices of the Partial derivatives tab stack in the column the data
     panel holds on Descent: 30px for each one's ticks and axis label, 24 for
     the lower one's caption. */
  const sliceH = Math.max(60, Math.round((side - 54) / 2));
  return {
    side,
    data: { x: PAD_L, y: TOP, w: left, h: side },
    surf: { x: w - PAD_R - side, y: TOP, w: side, h: side },
    slice: { x: PAD_L, y: TOP, w: full, h: side },   // the surface's height, so the axis label clears the regime line beneath (measured: at +24 they overlapped by 6px)
    strip: { x: PAD_L, y: TOP + side + 122, w: full, h: LOSS_H },
    regimeY: TOP + side + 60,   // the one-parameter page's line naming the regime
    phaseY: TOP + side + 78,    // what this beat of a Slow step is doing
    angleY: TOP + side + 96,    // where the step points, against the straight line
    /* The Derivative tab: one panel over the whole width, with one line under
       it, ending where the strip's own axis label ends on Descent. */
    curve: { x: PAD_L, y: TOP, w: full, h: stageHeight(w) - TOP - 60 },
    curveY: TOP + (stageHeight(w) - TOP - 60) + 46,
    /* The Partial derivatives tab: the map in the surface's own square, the two
       slices in the left column. */
    partA: { x: PAD_L, y: TOP, w: left, h: sliceH },
    partB: { x: PAD_L, y: TOP + side - sliceH, w: left, h: sliceH },
  };
}

/* One choreographed beat, in shares of the clock `model.js` holds — 2 s at Slow
   over the surface, 2.5 / 1.2 / 0.4 s on the one-parameter and Derivative
   pages, which choreograph at every speed (decision 6). Two-parameter page: the
   partials appear, the direction composes, the point moves. One-parameter page:
   the tangent and the gradient vector hold at the point, then the step. The
   move phase interpolates along the stored update indices, so at batch 10 or 1
   the epoch's ten or hundred updates are drawn as they happen rather than as
   one jump.

   `hold` REPLACED A GROWTH RAMP (decision 7). The tangent used to grow from its
   centre over the first 45% of every epoch; it is now always at full length,
   and the first 40% is a pause at the point with the arrow and its number. */
const BEATS_TWO = { partials: 0.34, direction: 0.55 };
const BEATS_ONE = { hold: 0.4 };
const BEATS_NUDGE = { hold: 0.35 };

/* Choreography A's ease: the point leaves slowly, crosses quickly and settles.
   Picked live against four alternatives in `_lab/gd-round5.html` §2. The
   Derivative tab's shrinking nudge uses it for the same reason — the ends of
   the move are where the reader is reading the numbers. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);

const ARROW = 30;         // the composed direction's fixed length, in pixels
const Y_DOM = [0, 30];    // y = 5 + 2x + N(0, 1) over x in [0, 10], both scales

/* The strip's two ratchets: nice steps, upward only (2.5). */
const X_LADDER = [10, 25, 50, 100, 250, 500, 1000];
const Y_LADDER = [1, 2, 3, 4, 6];

/* ---- formatting ---------------------------------------------------------- */

/* Gradients run from ~200 at the start to ~1e-5 in the trench, so a fixed
   number of decimals prints either 0.00 or nine digits nobody reads. */
const fSig = (v) => (v === 0 ? "0" : Number(v.toPrecision(3)).toString());
const f1 = (v) => fmt(v, 1);
const f2 = (v) => fmt(v, 2);
const f3 = (v) => fmt(v, 3);
const xTimes = (r) => (r >= 100 ? `${Math.round(r)}×` : `${fmt(r, r >= 10 ? 1 : 3)}×`);

/* A batch of one is one row, and one update is not "1 updates". */
const nRows = (b) => (b === 1 ? "one row" : `${b} rows`);
const nUpdates = (b) => (N / b === 1 ? "one update" : `${N / b} updates`);
/* What one epoch is made of, in one phrase, so the standing line and the Slow
   step's third beat cannot describe the same thing two ways. */
const epochPhrase = (b) => (b >= N
  ? "one update, over all 100 rows"
  : b === 1
    ? `${N} updates, one row at a time`
    : `${N / b} updates, each over its own ${b} rows`);

/* ---- the colour ramp and the surface bitmap ------------------------------ */

/* Split from `hexLerp` for the relief, which needs the three channels back so
   it can multiply them by a face's shade. */
const mixRGB = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
};

const hexLerp = (a, b, t) => {
  const c = mixRGB(a, b, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/* Where a loss ratio sits on the ramp, 0 at the least loss and 1 at the cap.
   The relief takes its HEIGHT from the same number, so colour and height say
   the same thing and the contour rings land at equal heights. */
const rampT = (ratio) => Math.max(0, Math.min(1, Math.log10(Math.max(1, ratio)) / LOG_CAP));

const ramp = (ratio, colors) => hexLerp(colors.costLow, colors.costHigh, rampT(ratio));

/* Painted once per size, theme and dataset, then blitted every frame — widget
   27's cache, with the contour lines baked in because they move only when the
   surface does. ~20k O(1) loss evaluations and 45k marching-squares cells is
   affordable once and not sixty times a second. */
let surfCache = null;
function surfaceBitmap(wpx, hpx, dpr, colors, state) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${state.sig}`;
  if (surfCache && surfCache.key === key) return surfCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const { q, dom } = state;
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const b0 = dom.b0[0] + (px / wpx) * (dom.b0[1] - dom.b0[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const b1 = dom.b1[1] - (py / hpx) * (dom.b1[1] - dom.b1[0]);
      c.fillStyle = ramp(q.loss(b0, b1) / q.Lmin, colors);
      c.fillRect(px, py, CELL, CELL);
    }
  }
  const bx = (v) => ((v - dom.b0[0]) / (dom.b0[1] - dom.b0[0])) * wpx;
  const by = (v) => hpx - ((v - dom.b1[0]) / (dom.b1[1] - dom.b1[0])) * hpx;
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.55;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of state.contours) {
    c.moveTo(bx(ax), by(ay));
    c.lineTo(bx(zx), by(zy));
  }
  c.stroke();
  surfCache = { key, canvas: cv };
  return cv;
}

/* ---- small drawing helpers ----------------------------------------------- */

function label(ctx, colors, s, x, y, { color, align = "left", size } = {}) {
  ctx.save();
  ctx.fillStyle = color ?? colors.ink3;
  ctx.font = `${size ?? colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

function arrow(ctx, x0, y0, x1, y1, color, width = 2, dash = null) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* The travelling dot, widget 27's: a filled mark with a heavy surface ring,
   because it lands on the trench's own cost-low blue and the ring is what
   separates them. */
function ringedDot(ctx, colors, px, py) {
  ctx.save();
  ctx.fillStyle = colors.highlight;
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/* The path so far. Strided: at batch 1 a finished walk is 100k positions, and
   a polyline of 100k segments per frame buys nothing a 1500-segment one does
   not already show. The final point is always included. */
function drawPath(ctx, colors, sx, sy, track, upto, cur) {
  if (upto < 1) return;
  const stride = Math.max(1, Math.ceil(upto / 1500));
  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx(track.b0[0]), sy(track.b1[0]));
  for (let k = stride; k <= upto; k += stride) ctx.lineTo(sx(track.b0[k]), sy(track.b1[k]));
  ctx.lineTo(sx(cur[0]), sy(cur[1]));
  ctx.stroke();
  /* The opening epochs as separate marks while they can still be counted
     (2.3): on the raw surface the first three cross most of the frame and the
     rest crawl, and one polyline hides that they were three moves. */
  ctx.fillStyle = colors.ink1;
  for (let k = 0; k <= Math.min(upto, 5); k += 1) {
    ctx.beginPath();
    ctx.arc(sx(track.b0[k]), sy(track.b1[k]), 2.2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/* ---- the panels ---------------------------------------------------------- */

function drawData(ctx, colors, rect, state, cur, scale) {
  const { q } = state;
  const lo = Math.min(...q.xs);
  const hi = Math.max(...q.xs);
  const pad = (hi - lo) * 0.04;
  const plot = makePlot({
    ctx, colors, rect, xDomain: [lo - pad, hi + pad], yDomain: Y_DOM,
  });
  plot.caption("the line at this epoch");
  plot.note(`${N} rows`);
  plot.axisX({ label: scale === "raw" ? "x" : "x, standardized" });
  plot.axisY({ label: "y" });

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = colors.unknown;
  for (let i = 0; i < q.n; i += 1) {
    ctx.beginPath();
    ctx.arc(plot.sx(q.xs[i]), plot.sy(q.y[i]), 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const line = (b0, b1, stroke, width, dash) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(plot.sx(lo), plot.sy(b0 + b1 * lo));
    ctx.lineTo(plot.sx(hi), plot.sy(b0 + b1 * hi));
    ctx.stroke();
    ctx.restore();
  };
  line(q.B0, q.B1, colors.reference, 1.5, [6, 4]);
  line(cur[0], cur[1], colors.highlight, 2.5);
  ctx.restore();
}

/* The colour bar, in place of any sentence about the ramp: the ends shown
   rather than said. Both maps in this widget use it — the loss surface's log
   ratios and the Partial derivatives tab's y — so the ends and the middle line
   are the caller's. */
function drawColourBar(ctx, colors, rect, { low, high, left, right, middle }) {
  const bar = { x: rect.x, y: rect.y + rect.h + 46, w: rect.w, h: 8 };
  const STEPS = 48;
  for (let i = 0; i < STEPS; i += 1) {
    ctx.fillStyle = hexLerp(low, high, i / (STEPS - 1));
    ctx.fillRect(bar.x + (i / STEPS) * bar.w, bar.y, bar.w / STEPS + 1, bar.h);
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
  label(ctx, colors, left, bar.x, bar.y + bar.h + 13);
  label(ctx, colors, right, bar.x + bar.w, bar.y + bar.h + 13, { align: "right" });
  if (bar.w >= 230) {
    label(ctx, colors, middle, bar.x + bar.w / 2, bar.y + bar.h + 13, { align: "center" });
  }
}

function drawSurface(ctx, colors, rect, state, cur, opts) {
  const { q, dom, track } = state;
  const plot = makePlot({ ctx, colors, rect, xDomain: dom.b0, yDomain: dom.b1 });
  plot.caption("the loss over every (b₀, b₁)");
  /* The frame is fixed (2.5), so a walk can leave it — and at raw x with a
     learning rate just past the boundary it leaves LONG before it trips the
     divergence test, which is a real state the figure has to name rather than
     leave as an empty panel. */
  const held = cur[0] > dom.b0[0] && cur[0] < dom.b0[1]
    && cur[1] > dom.b1[0] && cur[1] < dom.b1[1];
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (!held) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: "intercept b₀" });
  plot.axisY({ label: "slope b₁" });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    surfaceBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, state),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  /* THE STRAIGHT LINE TO THE MINIMUM (decision 7), under the path so the walk
     reads over it. Faint and dashed: it is not a route anything takes — it is
     the route the reader expects the step to take, and the angle line under the
     panel says how far from it the step actually goes. Drawn only while there
     is a disagreement to see, so it disappears as the walk arrives rather than
     collapsing to a dot on the cross. */
  if (held && opts.showStep && !opts.arrived) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = colors.extreme;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.sx(cur[0]), plot.sy(cur[1]));
    ctx.lineTo(plot.sx(q.B0), plot.sy(q.B1));
    ctx.stroke();
    ctx.restore();
  }
  drawPath(ctx, colors, plot.sx, plot.sy, track, opts.upto, cur);
  /* The minimum is crossed only once the walk is within 1% of the least loss:
     the widget does not open on its own answer (2.1). */
  if (opts.arrived) {
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    const mx = plot.sx(q.B0);
    const my = plot.sy(q.B1);
    ctx.beginPath();
    ctx.moveTo(mx - 7, my);
    ctx.lineTo(mx + 7, my);
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx, my + 7);
    ctx.stroke();
  }
  ctx.restore();

  if (!held) return;
  const px = plot.sx(cur[0]);
  const py = plot.sy(cur[1]);
  ringedDot(ctx, colors, px, py);

  /* THE STEP, DRAWN AS TWO COMPONENTS AND THEIR COMPOSITION (§2 C). The
     direction is the screen delta of a unit-time step normalised to a fixed
     length, so it points where the dot actually goes at this panel's aspect;
     the ticks are that vector's x and y parts, so tick + tick = arrow exactly,
     and each carries its own partial's value. */
  if (!opts.showStep) return;
  const [g0, g1] = opts.grad;
  const dx = plot.sx(cur[0] - g0) - px;
  const dy = plot.sy(cur[1] - g1) - py;
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || !Number.isFinite(len)) return;
  const ex = (ARROW * dx) / len;
  const ey = (ARROW * dy) / len;
  const t = opts.tickMix;
  if (t > 0) {
    /* A component the step barely has is a bare arrowhead sitting on the dot,
       so it is drawn only once it is long enough to read as a tick. */
    if (Math.abs(ex * t) > 3) arrow(ctx, px, py, px + ex * t, py, colors.ink1, 1.5, [3, 3]);
    if (Math.abs(ey * t) > 3) arrow(ctx, px, py, px, py + ey * t, colors.ink1, 1.5, [3, 3]);
    label(ctx, colors, `∂L/∂b₀ ${fSig(g0)}`, px + ex + (ex < 0 ? -5 : 5), py - 7,
      { align: ex < 0 ? "right" : "left", color: colors.ink1 });
    label(ctx, colors, `∂L/∂b₁ ${fSig(g1)}`, px + 7, py + ey + (ey < 0 ? -7 : 13),
      { color: colors.ink1 });
  }
  if (opts.arrowMix > 0) {
    arrow(ctx, px, py, px + ex * opts.arrowMix, py + ey * opts.arrowMix, colors.highlight, 2.5);
  }
}

/* ---- the surface in relief -----------------------------------------------
   The same window, the same colours, the same walk, with the loss as HEIGHT as
   well as colour. The geometry is in `model.js` so it can be asserted without
   a DOM; what is here is the painting and the two caches decision 4 records. */

const DOWNHILL = 0.1;      // the composed arrow's length, in normalised domain units
const TANGENT_HALF = 0.2;  // each partial's chord, ± this share of the domain (the mock's)

/* The mesh, painted once per size, theme, dataset and VIEWPOINT — the map's own
   cache, on the other side of the same panel. The contour rings are baked in
   with it: lifted onto the surface, they move only when the surface does. They
   are painted over the whole mesh rather than hidden-line tested, so a ring on
   the far wall can show through the near one; at the default 300/35 the trench
   runs away from the reader and the far wall is a sliver.

   ONE SLOT, and a drag therefore misses it on every frame and repaints all 1936
   quads. Measured at ~2 ms, which a gesture can afford; a ring buffer of
   viewpoints would spend memory to save nothing, since a turn never comes back
   to the exact degree it left. What the key still does is keep the mesh OUT of
   the frame budget for everything the surface does not depend on — the learning
   rate, the batch and the epoch move the walk over a mesh already painted. */
let meshCache = null;
function reliefBitmap(wpx, hpx, dpr, colors, state, az, el) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${colors.surface}:${state.sig}:${az}:${el}`;
  if (meshCache && meshCache.key === key) return meshCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const { q, dom } = state;
  const project = projector({ x: 0, y: 0, w: wpx, h: hpx }, az, el);
  c.lineWidth = 0.5 * dpr;
  for (const face of reliefMesh(q, dom, project)) {
    c.beginPath();
    face.pts.forEach((p, k) => (k ? c.lineTo(p.X, p.Y) : c.moveTo(p.X, p.Y)));
    c.closePath();
    const rgb = mixRGB(colors.costLow, colors.costHigh, rampT(face.r));
    c.fillStyle = `rgb(${rgb.map((v) => Math.round(v * face.shade)).join(", ")})`;
    c.fill();
    /* A hairline of the page's own ground between faces: filled edge to edge
       the quads seam, and the mesh reads as noise rather than as a surface. */
    c.strokeStyle = colors.surface;
    c.globalAlpha = 0.18;
    c.stroke();
    c.globalAlpha = 1;
  }
  const lift = (b0, b1) => {
    const [x, y, z] = reliefPoint(q, dom, b0, b1);
    return project(x, y, z);
  };
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.6;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of state.contours) {
    const a = lift(ax, ay);
    const b = lift(zx, zy);
    c.moveTo(a.X, a.Y);
    c.lineTo(b.X, b.Y);
  }
  c.stroke();
  meshCache = { key, canvas: cv };
  return cv;
}

/* The path, sampled once and classified once (decision 4). The hidden test is
   a ray march per piece — far too much per frame — so the split is cached on
   the walk AND the viewpoint, which are between them everything it depends on:
   ~1 ms for 1500 pieces on the lesson's own walk, 2.6 ms for the 100 000
   positions batch 1 leaves. Held here rather than in `compute()` so a walk
   nobody looks at in relief never pays for it, and so a turn of the camera pays
   only the march and not the descent.

   A piece outside the frame is dropped rather than clipped: off the domain
   there is no surface to lie on, and the projection would lay it on the ground
   plane's continuation. The panel says "off the frame" instead. */
let piecesCache = null;
function reliefPieces(state, az, el) {
  const key = `${state.walkSig}:${az}:${el}`;
  if (piecesCache && piecesCache.key === key) return piecesCache.pieces;
  const { q, dom, track } = state;
  const last = track.len - 1;
  const w0 = dom.b0[1] - dom.b0[0];
  const w1 = dom.b1[1] - dom.b1[0];
  const dense = Math.min(last, 300);
  const idx = [];
  for (let k = 0; k <= dense; k += 1) idx.push(k);
  const stride = Math.max(1, Math.ceil((last - dense) / 1200));
  for (let k = dense + stride; k <= last; k += stride) idx.push(k);
  if (idx[idx.length - 1] !== last) idx.push(last);

  const inside = (b0, b1) => b0 > dom.b0[0] && b0 < dom.b0[1] && b1 > dom.b1[0] && b1 < dom.b1[1];
  const pieces = [];
  for (let i = 1; i < idx.length; i += 1) {
    const ka = idx[i - 1];
    const kb = idx[i];
    const d0 = track.b0[kb] - track.b0[ka];
    const d1 = track.b1[kb] - track.b1[ka];
    /* A long move is split so it can be part hidden: the opening epochs of a
       raw walk cross most of the frame in one step. */
    const sub = Math.max(1, Math.min(8, Math.ceil(Math.hypot(d0 / w0, d1 / w1) / 0.03)));
    for (let s = 0; s < sub; s += 1) {
      const a = [track.b0[ka] + (d0 * s) / sub, track.b1[ka] + (d1 * s) / sub];
      const b = [track.b0[ka] + (d0 * (s + 1)) / sub, track.b1[ka] + (d1 * (s + 1)) / sub];
      const m0 = (a[0] + b[0]) / 2;
      const m1 = (a[1] + b[1]) / 2;
      const held = inside(a[0], a[1]) && inside(b[0], b[1]);
      pieces.push({ end: kb, a, b, held, hidden: held && reliefHidden(q, dom, m0, m1, az, el) });
    }
  }
  piecesCache = { key, pieces };
  return pieces;
}

function drawRelief(ctx, colors, rect, state, cur, opts) {
  const { q, dom, track } = state;
  const plot = makePlot({ ctx, colors, rect, xDomain: dom.b0, yDomain: dom.b1 });
  plot.caption("the loss as height over every (b₀, b₁)");
  const held = cur[0] > dom.b0[0] && cur[0] < dom.b0[1]
    && cur[1] > dom.b1[0] && cur[1] < dom.b1[1];
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (!held) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  /* No axisX/axisY: a projected surface has no rectilinear axes to hang ticks
     on, so b₀ and b₁ are named along the two edges nearest the reader. */

  const { az, el } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    reliefBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, state, az, el),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const project = projector(rect, az, el);
  const pt = (b0, b1) => {
    const [x, y, z] = reliefPoint(q, dom, b0, b1);
    return project(x, y, z);
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* The path: solid where the surface leaves it in view, dashed and faint
     where the surface is in front of it — the drawing convention for a hidden
     line, and the one treatment of the three mocked that leaves the mesh
     reading as a surface. */
  const stroke = (list, { dash, alpha, width }) => {
    if (!list.length) return;
    ctx.save();
    ctx.setLineDash(dash);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (const [a, b] of list) {
      ctx.moveTo(a.X, a.Y);
      ctx.lineTo(b.X, b.Y);
    }
    ctx.stroke();
    ctx.restore();
  };
  const shown = [];
  const buried = [];
  let tail = null;
  for (const pc of reliefPieces(state, az, el)) {
    if (pc.end > opts.upto) break;
    if (!pc.held) {
      tail = null;
      continue;
    }
    (pc.hidden ? buried : shown).push([pt(pc.a[0], pc.a[1]), pt(pc.b[0], pc.b[1])]);
    tail = pc.b;
  }
  /* The leading edge, from the last sampled position to where the walk stands.
     One ray march a frame, which is what the sampled pieces cost together. */
  if (tail && held) {
    const seg = [pt(tail[0], tail[1]), pt(cur[0], cur[1])];
    const mid = reliefHidden(q, dom, (tail[0] + cur[0]) / 2, (tail[1] + cur[1]) / 2, az, el);
    (mid ? buried : shown).push(seg);
  }
  stroke(buried, { dash: [3, 4], alpha: 0.55, width: 1.2 });
  stroke(shown, { dash: [], alpha: 1, width: 1.5 });

  /* The opening epochs as separate marks while they can still be counted
     (2.3), exactly as the map draws them. */
  ctx.fillStyle = colors.ink1;
  for (let k = 0; k <= Math.min(opts.upto, 5); k += 1) {
    const p = pt(track.b0[k], track.b1[k]);
    ctx.beginPath();
    ctx.arc(p.X, p.Y, 2.2, 0, 2 * Math.PI);
    ctx.fill();
  }

  /* The minimum, crossed on the floor once the walk has arrived — the same
     rule as the map, so the widget does not open on its own answer (2.1). */
  if (opts.arrived) {
    const m = pt(q.B0, q.B1);
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.X - 7, m.Y);
    ctx.lineTo(m.X + 7, m.Y);
    ctx.moveTo(m.X, m.Y - 7);
    ctx.lineTo(m.X, m.Y + 7);
    ctx.stroke();
  }

  if (held) {
    const c = pt(cur[0], cur[1]);
    if (opts.showStep) drawTangents(ctx, colors, pt, dom, c, cur, opts);
    ringedDot(ctx, colors, c.X, c.Y);
  }
  ctx.restore();

  /* b₀ and b₁ along the two edges the viewpoint puts nearest the reader,
     chosen by depth rather than fixed, so the naming survives a change of
     viewpoint — which the drag now exercises on every frame, and which is why
     the two names swap edges as the surface comes round. Outside the clip: at
     some viewpoints an edge's midpoint sits on the panel's border. */
  const nearer = (u, v) => (project(...reliefPoint(q, dom, u[0], u[1])).depth
    <= project(...reliefPoint(q, dom, v[0], v[1])).depth ? u : v);
  const mid0 = (dom.b0[0] + dom.b0[1]) / 2;
  const mid1 = (dom.b1[0] + dom.b1[1]) / 2;
  const centre = pt(mid0, mid1);
  for (const [name, at] of [
    ["b₀", nearer([mid0, dom.b1[0]], [mid0, dom.b1[1]])],
    ["b₁", nearer([dom.b0[0], mid1], [dom.b0[1], mid1])],
  ]) {
    const p = pt(at[0], at[1]);
    const dx = p.X - centre.X;
    const dy = p.Y - centre.Y;
    const len = Math.hypot(dx, dy) || 1;
    label(ctx, colors, name, p.X + (18 * dx) / len, p.Y + (18 * dy) / len + 4,
      { align: dx < -2 ? "right" : dx > 2 ? "left" : "center" });
  }
}

/* THE PARTIALS AS TANGENT SEGMENTS on the surface, which is what a partial
   derivative is: the slope along one axis with the other held. Each is the
   surface's own chord between ±0.2 of the domain, so it lies on the surface
   rather than floating over it, and carries its number. These replace the
   map's component ticks while the relief is on.

   THE COMPOSED DIRECTION IS BUILT IN NORMALISED PARAMETER SPACE, where the two
   axes are the same size — the relief's own coordinates. Scaling (−g₀, −g₁) by
   each axis's span instead, as the mock did, points the arrow the wrong way
   when the spans differ (raw x: 10.2 against 4.0), which is decision 1's trap
   in the relief's coordinates. */
function drawTangents(ctx, colors, pt, dom, c, cur, opts) {
  const [g0, g1] = opts.grad;
  const w0 = dom.b0[1] - dom.b0[0];
  const w1 = dom.b1[1] - dom.b1[0];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const chord = (a0, a1, b0, b1) => {
    const a = pt(clamp(a0, dom.b0[0], dom.b0[1]), clamp(a1, dom.b1[0], dom.b1[1]));
    const b = pt(clamp(b0, dom.b0[0], dom.b0[1]), clamp(b1, dom.b1[0], dom.b1[1]));
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.X, a.Y);
    ctx.lineTo(b.X, b.Y);
    ctx.stroke();
    ctx.restore();
    return b;
  };
  const t = opts.tickMix;
  if (t > 0) {
    const d0 = w0 * TANGENT_HALF * t;
    const d1 = w1 * TANGENT_HALF * t;
    const e0 = chord(cur[0] + d0, cur[1], cur[0] - d0, cur[1]);
    const e1 = chord(cur[0], cur[1] - d1, cur[0], cur[1] + d1);
    label(ctx, colors, `∂L/∂b₀ ${fSig(g0)}`, e0.X - 4, e0.Y - 5,
      { align: "right", color: colors.ink1 });
    label(ctx, colors, `∂L/∂b₁ ${fSig(g1)}`, e1.X + 4, e1.Y + 13, { color: colors.ink1 });
  }
  if (opts.arrowMix > 0) {
    const du = -g0 / w0;
    const dv = -g1 / w1;
    const len = Math.hypot(du, dv);
    if (!(len > 0) || !Number.isFinite(len)) return;
    const f = (DOWNHILL * opts.arrowMix) / len;
    const e = pt(
      clamp(cur[0] + du * f * w0, dom.b0[0], dom.b0[1]),
      clamp(cur[1] + dv * f * w1, dom.b1[0], dom.b1[1]),
    );
    if (Math.hypot(e.X - c.X, e.Y - c.Y) > 3) arrow(ctx, c.X, c.Y, e.X, e.Y, colors.highlight, 2.5);
  }
}

/* The one-parameter page: the loss along b₁ with b₀ held at its fitted value,
   the tangent at the current point, and the steps taken so far. */
function drawSlice(ctx, colors, rect, state, cur, opts) {
  const { q, dom, track } = state;
  const range = dom.b1;
  const f = (v) => q.loss(q.B0, v);
  const pts = [];
  let top = 0;
  for (let k = 0; k <= 160; k += 1) {
    const v = range[0] + (k / 160) * (range[1] - range[0]);
    const L = f(v);
    pts.push([v, L]);
    top = Math.max(top, L);
  }
  const plot = makePlot({ ctx, colors, rect, xDomain: range, yDomain: [0, top * 1.05] });
  /* The curvature rides in the CAPTION, not the note: the note slot is where
     the panel says what state the walk is in, and on this page the interesting
     states are "diverged" and "past the edge of the frame". */
  plot.caption(`the loss over b₁, b₀ held at ${f2(q.B0)}, curvature ${f1(q.curvB1)}`);
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (cur[1] < range[0] || cur[1] > range[1]) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: "slope b₁" });
  plot.axisY({ label: "loss" });
  plot.vline(q.B1, { stroke: colors.reference, label: "least squares", width: 1.5 });
  plot.curve(pts, { stroke: colors.ink2, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (opts.upto >= 1) {
    const stride = Math.max(1, Math.ceil(opts.upto / 1500));
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.sx(track.b1[0]), plot.sy(f(track.b1[0])));
    for (let k = stride; k <= opts.upto; k += stride) {
      ctx.lineTo(plot.sx(track.b1[k]), plot.sy(f(track.b1[k])));
    }
    ctx.lineTo(plot.sx(cur[1]), plot.sy(f(cur[1])));
    ctx.stroke();
    ctx.fillStyle = colors.ink1;
    const dots = Math.min(opts.upto, 40);
    for (let k = 0; k <= dots; k += 1) {
      ctx.beginPath();
      ctx.arc(plot.sx(track.b1[k]), plot.sy(f(track.b1[k])), 2.2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /* THE TANGENT IS RE-EVALUATED AT THE POINT IT TOUCHES, which is the page's
     whole point: its slope IS ∂L/∂b₁ there. It used to be drawn with
     `opts.grad[1]`, the gradient `stand()` floors to the START of the step, so
     through the move beat a line of fixed slope slid along the parabola —
     Kenneth, 2026-09-08: "the tangent animation is not there. it just
     translates without following the curve." Evaluated here it rolls with the
     curve and arrives as the tangent at the new point.

     AND IT IS ALWAYS AT FULL LENGTH — choreography A, decision 7. It used to
     grow from its centre over the first 45% of every epoch, which Kenneth read
     as the tangent "moving then redrawing, like expanding out"; the growth is
     gone and the beat's first 40% is a pause at the point instead.

     THE READOUT AND THE BEAT CAPTION KEEP THE FLOORED ONE, and the two do not
     disagree: `descendSlope` stores at every index exactly the gradient this
     line recomputes, so at rest and at both unchoreographed speeds the number
     printed is the slope drawn. They part only mid-move, where they are
     answering different questions — what decided this step, against what the
     surface does under the point now. */
  if (opts.showStep) {
    const b1 = cur[1];
    const g = q.grad(q.B0, b1)[1];
    const span = (range[1] - range[0]) * 0.16;
    const L = f(b1);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.sx(b1 - span), plot.sy(L - g * span));
    ctx.lineTo(plot.sx(b1 + span), plot.sy(L + g * span));
    ctx.stroke();
  }

  /* THE GRADIENT AS A VECTOR — the one-dimensional case of the map's composed
     direction (decision 6). θ is b₁ alone here, so −∂L/∂θ has one component:
     a horizontal arrow at the point's height, pointing downhill, at the map's
     own fixed pixel length and carrying the partial's value in the lettering
     the map's component ticks carry theirs in.

     IT RIDES THE MOVING POINT AND KEEPS THE GRADIENT THAT LEFT THE START of the
     step while the tangent above rolls with the curve, and the two are
     answering different questions:
     the arrow is the number that decided this step, the tangent is what the
     surface does under the point now. At rest and at an epoch boundary they
     agree, because `descendSlope` stores at every index exactly the slope the
     tangent recomputes.

     THE CLEARANCES ARE MEASURED. It starts 9px from the dot's centre, 3.5px of
     air outside the ringed dot's 5.5px edge — a 4.5px disc under a 2px ring,
     half of which lies outside it. Its label sits 7px above the shaft, and on
     the arrow's side the tangent always DESCENDS, since downhill is lower loss
     and lower loss is lower on the screen: at epoch 0 the tangent passes 30 to
     40px below the arrow's tip on raw x and 27 to 35px on standardized x,
     across the 494 to 934px the panel is drawn at, and standardized x is still
     22 to 28px clear at epoch 10. By epoch 3 of the raw walk the tangent has
     flattened onto the arrow's own line, which is the figure saying the slope
     is gone rather than two marks colliding. */
  if (opts.showStep && Number.isFinite(opts.grad) && opts.grad !== 0) {
    const ax = plot.sx(cur[1]);
    const ay = plot.sy(f(cur[1]));
    const dir = opts.grad > 0 ? -1 : 1;
    const x0 = ax + dir * 9;
    const x1 = x0 + dir * ARROW;
    if (Math.abs(x1 - x0) > 3) {
      arrow(ctx, x0, ay, x1, ay, colors.highlight, 2.5);
      label(ctx, colors, `∂L/∂b₁ ${fSig(opts.grad)}`, x1 + dir * 5, ay - 7,
        { align: dir < 0 ? "right" : "left", color: colors.highlight });
    }
  }
  ctx.restore();

  const px = plot.sx(cur[1]);
  const py = plot.sy(f(cur[1]));
  if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
    ringedDot(ctx, colors, px, py);
  }
}

function drawStrip(ctx, colors, rect, state, ep) {
  const { track, q } = state;
  const ratio = (e) => Math.max(1, track.epochLoss[e] / q.Lmin);
  let peak = 0;
  for (let e = 0; e <= ep; e += 1) peak = Math.max(peak, Math.log10(ratio(e)));
  const yMax = Y_LADDER.find((v) => v >= peak) ?? Y_LADDER[Y_LADDER.length - 1];
  const xMax = X_LADDER.find((v) => v >= Math.max(ep, 1)) ?? EPOCHS;
  const ticks = [];
  for (let t = 0; t <= yMax; t += 1) ticks.push(t);

  const plot = makePlot({ ctx, colors, rect, xDomain: [0, xMax], yDomain: [0, yMax] });
  plot.caption("loss after each epoch");
  plot.note(`epoch ${ep} of ${EPOCHS}`);
  plot.grid(ticks);
  plot.axisX({ label: "epoch" });
  plot.axisY({ label: "loss ÷ the least, log₁₀", ticks });

  if (ep < 1) return;
  const stride = Math.max(1, Math.ceil(ep / 900));
  const pts = [];
  for (let e = 0; e <= ep; e += stride) pts.push([e, Math.log10(ratio(e))]);
  if (pts[pts.length - 1][0] !== ep) pts.push([ep, Math.log10(ratio(ep))]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y - 2, rect.w, rect.h + 2);
  ctx.clip();
  plot.curve(pts, { stroke: colors.empirical, width: 2 });
  ctx.restore();
  const py = plot.sy(Math.min(yMax, Math.log10(ratio(ep))));
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.beginPath();
  ctx.arc(plot.sx(ep), py, 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/* ---- the Derivative tab ---------------------------------------------------
   y = a² + 3ab with b held, the tangent at a, and the nudge drawn as a right
   triangle against what y actually does. The gap between the two is Δa², which
   is what the ladder is walked down to show.                                  */

/* b is a constant on this page and not a control: the tab is about ONE
   variable, and a second slider would make it about two a tab early. The
   caption says so where the reader is looking. */
const B_HELD = 1;

/* The window, fixed (2.5): y over a in [-1, 4] with b at 1 runs -2 to 28. A
   nudge can walk its target off the right-hand edge, and the panel says so
   rather than the frame chasing it. */
const DERIV_Y = [-4, 30];

function drawDerivative(ctx, colors, rect, a, da) {
  const plot = makePlot({ ctx, colors, rect, xDomain: A_RANGE, yDomain: DERIV_Y });
  plot.caption(`y = a² + 3ab over a, with b held at ${B_HELD}`);

  const y0 = gradFn.y(a, B_HELD);
  const slope = gradFn.da(a, B_HELD);
  const aT = a + da;
  const yTrue = gradFn.y(aT, B_HELD);
  const yPred = y0 + slope * da;
  if (aT > A_RANGE[1] || Math.max(yTrue, yPred) > DERIV_Y[1]) {
    plot.note("the nudge leaves the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: "a" });
  plot.axisY({ label: "y" });

  const pts = [];
  for (let k = 0; k <= 160; k += 1) {
    const v = A_RANGE[0] + (k / 160) * (A_RANGE[1] - A_RANGE[0]);
    pts.push([v, gradFn.y(v, B_HELD)]);
  }
  plot.curve(pts, { stroke: colors.ink2, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  const span = (A_RANGE[1] - A_RANGE[0]) * 0.24;
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.sx(a - span), plot.sy(y0 - slope * span));
  ctx.lineTo(plot.sx(a + span), plot.sy(y0 + slope * span));
  ctx.stroke();

  /* THE NUDGE AS A RIGHT TRIANGLE: Δa along, and the rise the tangent's slope
     predicts over it. Dashed, because neither leg is a thing the function does
     — they are the linear guess, and the solid mark beside them is the error in
     it. */
  const px0 = plot.sx(a);
  const pxT = plot.sx(aT);
  const py0 = plot.sy(y0);
  const pyPred = plot.sy(yPred);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px0, py0);
  ctx.lineTo(pxT, py0);
  ctx.lineTo(pxT, pyPred);
  ctx.stroke();
  ctx.restore();

  const pyTrue = plot.sy(yTrue);
  ctx.strokeStyle = colors.extreme;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pxT, pyPred);
  ctx.lineTo(pxT, pyTrue);
  ctx.stroke();
  ctx.fillStyle = colors.extreme;
  ctx.beginPath();
  ctx.arc(pxT, pyTrue, 3, 0, 2 * Math.PI);
  ctx.fill();

  ringedDot(ctx, colors, px0, py0);
  ctx.restore();

  /* ONE LABEL ON THIS PANEL, AND IT IS THE SLOPE. Δa and the gap were labelled
     too and both had to go: at the top rung with a shallow slope their boxes
     ran into this one, and at a past 2.5 this one ran off the right edge into
     the clip and lost its digits — a box sweep at four widths over the whole
     (a, b) window found 44 collisions and 528 escapes between them. The nudge's
     two numbers are one line below the panel and again in the readout, where
     they have room; what has to sit ON the tangent is the number the tangent
     IS. Drawn outside the clip and clamped by its own measured width, so it can
     be neither cut nor pushed out. */
  const slopeText = `dy/da ${f2(slope)}`;
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const tw = ctx.measureText(slopeText).width;
  ctx.restore();
  label(ctx, colors, slopeText,
    Math.max(rect.x + 4, Math.min(rect.x + rect.w - 4 - tw, plot.sx(a + span) + 5)),
    Math.max(rect.y + 12, Math.min(rect.y + rect.h - 4, plot.sy(y0 + slope * span) - 6)),
    { color: colors.highlight });
}

/* ---- the Partial derivatives tab ------------------------------------------
   The same function over both variables: the map on the right where the loss
   surface sits, the two slices stacked in the column the data panel holds, and
   the gradient as one arrow carrying both numbers.                            */

/* Painted once per size and theme — the function is fixed, so unlike the loss
   surface there is nothing else for the key to carry. The rings are baked in
   with it for the same reason the loss surface's are. */
let valueCache = null;
function valueBitmap(wpx, hpx, dpr, colors) {
  const key = `${wpx}x${hpx}:${colors.valueLow}:${colors.valueHigh}:${colors.surface}`;
  if (valueCache && valueCache.key === key) return valueCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const [lo, hi] = Y_RANGE;
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const a = A_RANGE[0] + (px / wpx) * (A_RANGE[1] - A_RANGE[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const b = B_RANGE[1] - (py / hpx) * (B_RANGE[1] - B_RANGE[0]);
      c.fillStyle = hexLerp(colors.valueLow, colors.valueHigh, (gradFn.y(a, b) - lo) / (hi - lo));
      c.fillRect(px, py, CELL, CELL);
    }
  }
  const ax = (v) => ((v - A_RANGE[0]) / (A_RANGE[1] - A_RANGE[0])) * wpx;
  const by = (v) => hpx - ((v - B_RANGE[0]) / (B_RANGE[1] - B_RANGE[0])) * hpx;
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.55;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [x0, y0, x1, y1] of isoSegments(gradFn.y, A_RANGE, B_RANGE, Y_LEVELS)) {
    c.moveTo(ax(x0), by(y0));
    c.lineTo(ax(x1), by(y1));
  }
  c.stroke();
  valueCache = { key, canvas: cv };
  return cv;
}

function drawValueMap(ctx, colors, rect, a, b) {
  const plot = makePlot({ ctx, colors, rect, xDomain: A_RANGE, yDomain: B_RANGE });
  plot.caption("y over every (a, b)");
  plot.axisX({ label: "a" });
  plot.axisY({ label: "b" });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    valueBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const px = plot.sx(a);
  const py = plot.sy(b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* The two slices, as the lines they are cut along: each partial derivative
     varies one of these and holds the other, and the panels beside the map are
     what the function does along them. */
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.sx(A_RANGE[0]), py);
  ctx.lineTo(plot.sx(A_RANGE[1]), py);
  ctx.moveTo(px, plot.sy(B_RANGE[0]));
  ctx.lineTo(px, plot.sy(B_RANGE[1]));
  ctx.stroke();
  ctx.restore();

  /* THE GRADIENT, POINTING UPHILL. Its direction is the parameter-space pair
     mapped through the panel's own scales and then normalised to the map's
     fixed pixel length, so the arrow is the same size wherever it stands and
     still points where (∂y/∂a, ∂y/∂b) points. Decision 7 says why this is
     allowed here where decision 1 forbids it on the loss surface. */
  const ga = gradFn.da(a, b);
  const gb = gradFn.db(a);
  const gl = Math.hypot(ga, gb);
  let tip = null;
  if (gl > 0) {
    const dx = plot.sx(a + ga / gl) - px;
    const dy = plot.sy(b + gb / gl) - py;
    const len = Math.hypot(dx, dy);
    tip = [px + (ARROW * dx) / len, py + (ARROW * dy) / len];
    arrow(ctx, px, py, tip[0], tip[1], colors.highlight, 2.5);
  }
  ringedDot(ctx, colors, px, py);
  ctx.restore();

  /* Outside the clip and clamped into the panel BY ITS OWN WIDTH: at the
     top-right corner the arrow itself runs off the frame, and the two numbers
     the tab exists for would go with it. Clamping the anchor is not enough — a
     left-aligned label anchored one pixel inside the edge still hangs 80px out,
     which is what a box sweep at 550px caught. Measured with the font `label`
     is about to set, so the two cannot disagree. */
  const text = tip ? `∇y = (${f1(ga)}, ${f1(gb)})` : "∇y = (0, 0)";
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const tw = ctx.measureText(text).width;
  ctx.restore();
  if (tip) {
    const lx = Math.max(rect.x + 4,
      Math.min(rect.x + rect.w - 4 - tw, tip[0] + (tip[0] < px ? -5 - tw : 5)));
    const ly = Math.max(rect.y + 12, Math.min(rect.y + rect.h - 4, tip[1] + (tip[1] < py ? -7 : 14)));
    label(ctx, colors, text, lx, ly, { color: colors.highlight });
  } else {
    label(ctx, colors, text, rect.x + 6, rect.y + 14, { color: colors.highlight });
  }
}

/* One slice: y along one variable with the other held, its tangent, and the
   slope that tangent has. Both panels share a y window — the function's own
   range over the map — so the two slices are read against each other and
   against the colour bar under the map. */
const SLICE_PAD = (Y_RANGE[1] - Y_RANGE[0]) * 0.06;
const SLICE_Y = [Y_RANGE[0] - SLICE_PAD, Y_RANGE[1] + SLICE_PAD];

function drawValueSlice(ctx, colors, rect, opts) {
  const plot = makePlot({ ctx, colors, rect, xDomain: opts.xDomain, yDomain: SLICE_Y });
  plot.caption(opts.caption);
  plot.note(opts.note, { tone: colors.highlight });
  plot.axisX({ label: opts.xLabel });
  plot.axisY({});
  const pts = [];
  for (let k = 0; k <= 80; k += 1) {
    const v = opts.xDomain[0] + (k / 80) * (opts.xDomain[1] - opts.xDomain[0]);
    pts.push([v, opts.f(v)]);
  }
  plot.curve(pts, { stroke: colors.ink2, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const span = (opts.xDomain[1] - opts.xDomain[0]) * 0.18;
  const y0 = opts.f(opts.at);
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.sx(opts.at - span), plot.sy(y0 - opts.slope * span));
  ctx.lineTo(plot.sx(opts.at + span), plot.sy(y0 + opts.slope * span));
  ctx.stroke();
  ringedDot(ctx, colors, plot.sx(opts.at), plot.sy(y0));
  ctx.restore();
}

/* ---- the formula card ----------------------------------------------------
   MathML where the engine renders it, with a plain fallback where it does not
   (widget 14's rule: an older engine drops the <math> wrapper and runs the
   symbols together). Each line is [label, body]; the label sits in a gutter
   and any wrapped body line starts under the body rather than under the label,
   which is what the shared `.w-math-eq` hanging indent — written for widget
   14's thirteen-term sum — does not give a short equation. Widgets 40 and 45
   override it the same way. */
const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const msup = (b, s) => `<msup>${b}${s}</msup>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const MB0 = msub(mi("b"), mn("0"));
const MB1 = msub(mi("b"), mn("1"));
const RESID = `${mo("(")}${MB0}${mo("+")}${MB1}${msub(mi("x"), mi("i"))}${mo("−")}${msub(mi("y"), mi("i"))}${mo(")")}`;
const SUM = `<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>${mi("n")}</munderover>`;

const CARD = {
  update: MATHML
    ? mml(`${mi("θ")}${mo("←")}${mi("θ")}${mo("−")}${mi("α")}${frac(`<mrow>${mo("∂")}${mi("L")}</mrow>`, `<mrow>${mo("∂")}${mi("θ")}</mrow>`)}`)
    : "θ ← θ − α ∂L/∂θ",
  loss: MATHML
    ? mml(`${mi("L")}${mo("(")}${MB0}${mo(",")}${MB1}${mo(")")}${mo("=")}${frac(mn("1"), mi("n"))}${SUM}<msup><mrow>${RESID}</mrow>${mn("2")}</msup>`)
    : "L(b₀, b₁) = (1/n) Σ (b₀ + b₁xᵢ − yᵢ)²",
  d0: MATHML
    ? mml(`${frac(mn("2"), mi("n"))}${SUM}${RESID}`)
    : "(2/n) Σ (b₀ + b₁xᵢ − yᵢ)",
  d1: MATHML
    ? mml(`${frac(mn("2"), mi("n"))}${SUM}${RESID}${msub(mi("x"), mi("i"))}`)
    : "(2/n) Σ (b₀ + b₁xᵢ − yᵢ) xᵢ",
  /* The two concept tabs' function and its derivatives. Same shape as the rows
     above: the label in the gutter names the quantity, the body is only the
     expression. */
  fn: MATHML
    ? mml(`${mi("y")}${mo("=")}${msup(mi("a"), mn("2"))}${mo("+")}${mn("3")}${mi("a")}${mi("b")}`)
    : "y = a² + 3ab",
  fa: MATHML
    ? mml(`${mn("2")}${mi("a")}${mo("+")}${mn("3")}${mi("b")}`)
    : "2a + 3b",
  fb: MATHML ? mml(`${mn("3")}${mi("a")}`) : "3a",
};

const GUTTER = "4.9em";   // the widest label, "∂L/∂b₀", at the card's font size
const CARD_MIN = "10em";  // the four rows of the two-parameter page; every
                          // shorter card keeps the reserve so the figure does
                          // not jog between tabs or pages (3.4k)
let cardHost = null;
let cardKey = null;

function cardRows(tab, view) {
  if (tab === "derivative") return [["y", CARD.fn], ["dy/da", CARD.fa]];
  if (tab === "partial") return [["y", CARD.fn], ["∂y/∂a", CARD.fa], ["∂y/∂b", CARD.fb]];
  const rows = [["Update", CARD.update], ["Loss", CARD.loss]];
  if (view === "two") rows.push(["∂L/∂b₀", CARD.d0]);
  rows.push(["∂L/∂b₁", CARD.d1]);
  return rows;
}

function renderCard(tab, view) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  cardHost.style.minHeight = CARD_MIN;
  const key = `${tab}:${view}`;
  if (key === cardKey) return;
  cardKey = key;
  cardHost.innerHTML = cardRows(tab, view)
    .map(([name, body]) =>
      `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">${name}</span>${body}</div>`)
    .join("");
}

/* ---- where the walk stands ----------------------------------------------- *
 * One function, because the drawing, the readout and the summary must agree
 * about it (5.8). At Slow the epoch in flight is a fractional index between
 * the two epoch marks; everywhere else the position is an epoch boundary.    */
function stand(state, params, anim) {
  const { track } = state;
  const ep = Math.min(anim?.ep ?? 0, track.epochsDone);
  const beat = choreographs(params.view, params.speed) ? (anim?.beat ?? 0) : 0;
  const two = params.view === "two";
  const moveFrom = two ? BEATS_TWO.direction : BEATS_ONE.hold;
  const a = track.epochAt[ep];
  const b = track.epochAt[Math.min(ep + 1, track.epochsDone)];
  const raw = beat <= moveFrom ? 0 : Math.min(1, (beat - moveFrom) / (1 - moveFrom));
  /* Choreography A eases the one-parameter move (decision 7). The surface's
     move stays linear: there the reader is watching the shape of a path, and
     an ease would put an acceleration into it that the walk does not have. */
  const mix = two ? raw : easeInOut(raw);
  const fi = a + (b - a) * mix;
  /* floor, not round: during the move the arrow and the beat line must keep
     the gradient that LEFT the start of this step — rounding flipped the
     printed distance halfway through the move (seen 0.0237 -> 0.0229). */
  const k = Math.min(track.len - 1, Math.max(0, Math.floor(fi)));
  return {
    ep,
    beat,
    fi,
    cur: posAt(track, fi),
    /* the partials that leave THIS point — the pair the arrow draws and the
       readout prints. At full batch they are the gradient over all n rows; at
       batch 10 or 1 they are the gradient of the batch about to be used, which
       is what actually moves the walk. */
    grad: [track.g0[k], track.g1[k]],
    upto: Math.floor(fi),
  };
}

/* Where the Derivative tab's nudge stands — the same shape as `stand`, and here
   for the same reason: the panel, the readout and the summary must agree about
   one number (5.8).
 *
 * THE READER'S CHOICE IS THE START AND THE ANIMATION ONLY GOES DOWN. `anim.rung`
 * counts rungs taken from whichever tick the `nudge` control is on, so the walk
 * is an authored reveal in the shape `shown` already has: a display change
 * cannot reset it, and moving the control is a data change that starts a new
 * one from the new tick. During a beat Δa eases from the rung it is leaving to
 * the one it is arriving at, so the triangle contracts rather than jumping. */
function standNudge(state, params, anim) {
  const rung = Math.min(anim?.rung ?? 0, state.rungs);
  const beat = anim?.beat ?? 0;
  const here = NUDGES[state.start + rung];
  const next = NUDGES[Math.min(NUDGES.length - 1, state.start + rung + 1)];
  const mix = beat <= BEATS_NUDGE.hold
    ? 0
    : easeInOut(Math.min(1, (beat - BEATS_NUDGE.hold) / (1 - BEATS_NUDGE.hold)));
  return { rung, beat, next, da: here + (next - here) * mix };
}

/* ---- the two concept tabs, composed --------------------------------------
   One function each, so `draw` reads as three tabs and not as one branch with
   three tails.                                                               */

function drawDerivativeTab(ctx, colors, L, params, state, anim) {
  const at = standNudge(state, params, anim);
  drawDerivative(ctx, colors, L.curve, params.a, at.da);
  const slope = gradFn.da(params.a, B_HELD);
  const moved = gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD);
  /* The same slot the Descent tab's beat line takes: what this beat is doing
     while one is running, and the standing comparison the rest of the time. */
  const said = at.beat > 0
    ? `Δa is shrinking to ${fSig(at.next)}, and the gap to its square`
    : `Δa ${fSig(at.da)}: the tangent predicts Δy ${fSig(slope * at.da)}, `
      + `y moves ${fSig(moved)}, the gap ${fSig(moved - slope * at.da)} = Δa²`;
  label(ctx, colors, said, L.curve.x, L.curveY,
    { color: at.beat > 0 ? colors.highlight : colors.ink3 });
}

function drawPartialTab(ctx, colors, L, params) {
  const { a, b } = params;
  const ga = gradFn.da(a, b);
  const gb = gradFn.db(a);
  drawValueSlice(ctx, colors, L.partA, {
    caption: `y over a, b held at ${f1(b)}`,
    note: `∂y/∂a ${f1(ga)}`,
    xDomain: A_RANGE,
    xLabel: "a",
    f: (v) => gradFn.y(v, b),
    at: a,
    slope: ga,
  });
  drawValueSlice(ctx, colors, L.partB, {
    caption: `y over b, a held at ${f1(a)}`,
    note: `∂y/∂b ${f1(gb)}`,
    xDomain: B_RANGE,
    xLabel: "b",
    f: (v) => gradFn.y(a, v),
    at: b,
    slope: gb,
  });
  drawValueMap(ctx, colors, L.surf, a, b);
  drawColourBar(ctx, colors, L.surf, {
    low: colors.valueLow,
    high: colors.valueHigh,
    left: String(Y_RANGE[0]),
    right: String(Y_RANGE[1]),
    middle: "y over the (a, b) plane",
  });
}

/* ---- the widget ---------------------------------------------------------- */

const LR_DETAIL = "α in the update rule: the step is α times the gradient";

/* THE WAY HOME FROM A DRAG (decision 6), on mlp's momentary-pill pattern: the
   press is a parameter for exactly as long as it takes `rebuild` to see it, and
   the two it writes are the ones the link should carry. Display-only, all
   three, so the walk survives the trip home (3.2). */
let widgetApi = null;

/* THE BUTTON IS RELEASED BEFORE THE VIEWPOINT IS WRITTEN, and the order is
   load-bearing here in a way it is not in mlp — whose reroll writes a DATA
   parameter and so never re-enters. `turn` and `tilt` are `display: true`, so
   each write runs `rebuild` again; with the release last, `homeView` would
   still be true on the way back in and the second write would call this
   function once more, for ever. Released first, every re-entry meets the guard
   above and stops. */
function homeTheView() {
  if (!widgetApi || !widgetApi.params.homeView) return;
  widgetApi.setParam("homeView", false);
  widgetApi.setParam("turn", RELIEF_DEFAULT_AZ);
  widgetApi.setParam("tilt", RELIEF_DEFAULT_EL);
}

/* Which clock a page runs on. The Derivative tab has its own row in
   `EPOCH_MS`, and on the other two tabs the page is the `view`. */
const clockView = (params) => (params.tab === "derivative" ? "derivative" : params.view);

widgetApi = defineWidget({
  slug: "gradients",
  title: "Gradients",
  status: "draft",
  subtitle:
    "A derivative is how much y changes for a small change in x. A partial "
    + "derivative holds the other variables still, and the gradient is the "
    + "vector of them. Gradient descent steps against that vector.",
  layout: "side",
  height: ({ w }) => stageHeight(w),

  params: {
    /* THE THREE IDEAS IN ORDER, and the widget's only structural control, so it
       comes before everything a page of it sets (3.1). Data, not display: each
       tab computes a different thing, and there is no work to preserve across
       them. */
    tab: {
      type: "segmented",
      label: "Topic",
      options: [
        {
          value: "derivative",
          label: "Derivative",
          detail: "how much y changes for a small change in a",
        },
        {
          value: "partial",
          label: "Partial derivatives",
          detail: "the slope along each variable with the other held, and the vector of the two",
        },
        {
          value: "descent",
          label: "Descent",
          detail: "steps against the gradient of a loss, at a size the learning rate sets",
        },
      ],
      default: "derivative",
    },
    a: {
      type: "float",
      label: "a",
      min: -1,
      max: 4,
      step: 0.1,
      default: 2,
      detail: "the point the derivatives are taken at",
      when: { param: "tab", oneOf: ["derivative", "partial"] },
    },
    b: {
      type: "float",
      label: "b",
      min: -1,
      max: 3,
      step: 0.1,
      default: 1,
      detail: "held still while ∂y/∂a is taken, and varied for ∂y/∂b",
      when: { param: "tab", equals: "partial" },
    },
    nudge: {
      type: "choice",
      label: "Nudge Δa",
      options: NUDGES.map((v) => ({
        value: String(v),
        label: String(v),
        detail: `a change of ${v} in a, over which the tangent misses y by Δa² = ${Number((v * v).toPrecision(4))}`,
      })),
      default: "0.5",
      when: { param: "tab", equals: "derivative" },
    },

    lossSec: { type: "section", label: "The loss", when: { param: "tab", equals: "descent" } },
    view: {
      type: "segmented",
      label: "Parameters",
      options: [
        {
          value: "one",
          label: "One parameter",
          detail: "b₁ descends alone, with b₀ held at its least-squares value",
        },
        {
          value: "two",
          label: "Two parameters",
          detail: "b₀ and b₁ descend together over the loss surface",
        },
      ],
      default: "one",
      when: { param: "tab", equals: "descent" },
    },
    scale: {
      type: "segmented",
      label: "Covariate",
      options: [
        {
          value: "raw",
          label: "Raw x",
          detail: "x from 0 to 10. The surface's two curvatures are 68.5 and 0.50",
        },
        {
          value: "std",
          label: "Standardized x",
          detail: "x centred and divided by its standard deviation. Both curvatures are then 2",
        },
      ],
      default: "raw",
      when: { param: "tab", equals: "descent" },
    },
    /* How to look at the loss, after what it is made of. Display-only: the
       relief is a second reading of the surface the map already holds, so
       switching mid-walk keeps the walk (3.2). Only where there is a surface
       to look at — the one-parameter page draws a curve. */
    relief: {
      type: "segmented",
      label: "Surface",
      options: [
        {
          value: "map",
          label: "Map",
          detail: "the loss as colour over every (b₀, b₁)",
        },
        {
          value: "relief",
          label: "Relief",
          detail: "the loss as height over the same pairs; drag the surface to turn it",
        },
      ],
      default: "map",
      display: true,
      when: { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "two" }] },
    },
    /* THE WAY HOME FROM A DRAG, and the one piece of the camera that belongs
       in the rail: not a number to set but an action to take (decision 6).
       Momentary — pressed, `rebuild` writes the two viewpoint parameters and
       releases it — so the URL carries the angle and never the press. Beside
       the surface it turns, and only while there is a surface to turn. */
    homeView: {
      type: "bool",
      style: "action",
      label: "Default view",
      detail: "turns the surface back to the viewpoint the figure opens at",
      default: false,
      display: true,
      when: {
        all: [
          { param: "tab", equals: "descent" },
          { param: "view", equals: "two" },
          { param: "relief", equals: "relief" },
        ],
      },
    },
    /* THE VIEWPOINT, AS TWO PARAMETERS. Decision 5 in the header says why they
       are parameters and not animation state. No rail control: the drag is the
       control, so both are hidden and travel in the URL the way `shown` does.
       Display-only, because turning the camera is a second reading of a walk
       already taken and must not discard it (3.2). */
    turn: {
      type: "int", min: 0, max: 359, default: RELIEF_DEFAULT_AZ, hidden: true, display: true,
    },
    tilt: {
      type: "int", min: 10, max: 85, default: RELIEF_DEFAULT_EL, hidden: true, display: true,
    },

    stepSec: { type: "section", label: "The step", when: { param: "tab", equals: "descent" } },
    lr: {
      type: "choice",
      label: "Learning rate α",
      options: LR_LADDER.map((v) => ({ value: String(v), label: String(v), detail: LR_DETAIL })),
      default: "0.01",
      when: { param: "tab", equals: "descent" },
    },
    /* Only on the two-parameter page: the one-parameter walk takes the
       gradient over all 100 rows, and a control that changed nothing there
       would be a control with no idea in it (3.5). */
    batch: {
      type: "choice",
      label: "Batch",
      options: BATCHES.map((b) => ({
        value: String(b),
        label: String(b),
        detail: `${b === N ? "all " : ""}${nRows(b)} in each update, so one epoch is ${nUpdates(b)}`,
      })),
      default: "100",
      when: { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "two" }] },
    },

    dataSec: { type: "section", label: "The data", when: { param: "tab", equals: "descent" } },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 30,
      default: 1,
      detail: "redraws the noise added to y = 5 + 2x",
      when: { param: "tab", equals: "descent" },
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        /* Both paces on every option: the pages run on different clocks
           (decision 6), and a description that named one of them would be
           right on one page and wrong on the other. The Derivative tab and the
           one-parameter page share the step clock, so one clause covers both. */
        { value: "slow", label: "Slow", detail: "2.5 seconds a step, or 2 seconds an epoch over the loss surface with the partial derivatives drawn first" },
        { value: "medium", label: "Medium", detail: "1.2 seconds a step, or 60 epochs a second over the loss surface" },
        { value: "fast", label: "Fast", detail: "0.4 seconds a step, or 250 epochs a second over the loss surface" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
      /* Only where something moves. The Partial derivatives tab is at rest and
         declines both drive buttons, so a pace for them would be a control with
         no idea in it (3.5). */
      when: { param: "tab", oneOf: ["derivative", "descent"] },
    },

    /* Authoring escape hatch, first render only: epochs already walked on
       Descent, rungs already taken down the ladder on Derivative. */
    shown: { type: "int", min: 0, max: EPOCHS, default: 0, hidden: true },
  },

  /* The legend has to match the graph, and the two pages draw different marks
     (lm-interaction, 2026-08-29). The loss curve and the path take ink rather
     than a series colour: they are the frame the walk moves on and the trail
     it leaves, not measurements of anything. */
  legend: ({ params }) => (params.tab === "derivative"
    ? [
      { token: "ink-2", label: "y = a² + 3ab, with b held at 1", mark: "line" },
      { token: "highlight", label: "The tangent at a, whose slope is dy/da", mark: "line" },
      { token: "ink-1", label: "The nudge Δa, and the change the tangent predicts over it", mark: "dash" },
      { token: "extreme", label: "The gap between that prediction and the change in y", mark: "line" },
    ]
    : params.tab === "partial"
      ? [
        { token: "ink-2", label: "y along one variable, with the other held", mark: "line" },
        { token: "highlight", label: "The tangent on each slice, and the gradient on the map", mark: "line" },
        { token: "ink-1", label: "The two lines the slices are cut along", mark: "dash" },
      ]
      : params.view === "two"
        ? [
          { token: "unknown", label: "The 100 rows", mark: "dot" },
          { token: "highlight", label: "The line at this epoch, and the direction of the next step", mark: "line" },
          { token: "reference", label: "The least-squares line, and its (b₀, b₁)", mark: "dash" },
          { token: "ink-1", label: "The path taken so far", mark: "line" },
          /* Only on the map: the straight line the step does NOT take, which
             the angle line under the panel measures the step against. */
          ...(params.relief === "map"
            ? [{ token: "extreme", label: "The straight line from here to the least-squares point", mark: "dash" }]
            : []),
          /* Only in relief: on the map nothing is in front of the path. */
          ...(params.relief === "relief"
            ? [{ token: "ink-1", label: "The path where the surface hides it", mark: "dash" }]
            : []),
          { token: "empirical", label: "Loss after each epoch", mark: "line" },
        ]
        : [
          { token: "ink-2", label: "The loss over b₁, with b₀ held", mark: "line" },
          /* One entry for two highlight marks, as the two-parameter page does
             with its line and its arrow: the tangent IS the slope and the arrow
             is the direction that slope sends the step. */
          { token: "highlight", label: "The tangent at the current b₁ with slope ∂L/∂b₁, and the direction of the next step", mark: "line" },
          { token: "reference", label: "b₁ at the least-squares fit", mark: "dash" },
          { token: "ink-1", label: "The steps taken so far", mark: "line" },
          { token: "empirical", label: "Loss after each epoch", mark: "line" },
        ]),

  compute({ params, rng }) {
    /* THE TWO CONCEPT TABS HAVE NO DATA AND NO RNG. y = a² + 3ab is the whole
       of what they draw, so what `compute` produces is where the Derivative
       tab's ladder starts and how many rungs are left below it — the only thing
       its animation reveals. */
    if (params.tab !== "descent") {
      const start = Math.max(0, NUDGES.map(String).indexOf(params.nudge));
      return { kind: params.tab, start, rungs: NUDGES.length - 1 - start };
    }
    const { x, y } = makeData(rng);
    const xs = params.scale === "std" ? standardize(x) : x;
    const q = quad(xs, y);
    const dom = domainFor(q);
    const lr = Number(params.lr);
    const batch = Number(params.batch);
    const track = params.view === "one"
      ? descendSlope(q, lr, EPOCHS)
      : batch >= q.n
        ? descendFull(q, lr, EPOCHS)
        : descendMini(q, lr, EPOCHS, batch, rng);
    return {
      kind: "descent",
      q,
      dom,
      track,
      lr,
      batch: params.view === "one" ? q.n : batch,
      contours: contourSegments(q, dom, LEVELS),
      /* what the surface bitmap is keyed on: the data and the scale are the
         only things that move it */
      sig: `${params.scale}:${params.seed}`,
      /* and what the relief's visible/hidden split is keyed on — the surface,
         plus everything that decides where the walk goes on it */
      walkSig: `${params.scale}:${params.seed}:${params.view}:${params.lr}:${params.batch}`,
    };
  },

  animation: {
    /* THE TWO TABS THAT DRIVE NAME DIFFERENT NOUNS (3.4c), so the labels take
       the map form. "Next epoch" is two words and not one: with batches of 10
       or 1 an epoch holds many steps, so "Step" would name the wrong unit; it
       is also the label the other gradient descent widget in the arc uses.

       "SHRINK", NOT "HALVE". The ladder is 1 · 0.5 · 0.25 · 0.1 · 0.05 · 0.01
       and two of its five rungs are not halvings, so a button promising one
       would be false on the very press that made it (4.4b). */
    stepLabel: {
      param: "tab",
      labels: { derivative: "Shrink the nudge", descent: "Next epoch" },
      default: "Next epoch",
    },
    stepTitle: {
      param: "tab",
      labels: {
        derivative: "Take Δa one rung down the ladder, toward 0.01",
        descent: "Take one epoch of gradient descent and redraw the walk",
      },
      default: "Take one epoch of gradient descent and redraw the walk",
    },
    runLabel: "Play",
    runTitle: {
      param: "tab",
      labels: {
        derivative: "Take Δa down to 0.01, one rung at a time",
        descent: "Descend to epoch 1000, or to the epoch the walk diverges at",
      },
      default: "Descend to epoch 1000, or to the epoch the walk diverges at",
    },

    /* THE PARTIAL DERIVATIVES TAB SAYS THERE IS NOTHING TO DRIVE, and core
       takes step and run out of the row (4.5). `stepLabel: null` cannot do it:
       core reads that once when the shell is built, so it would decline the
       button on all three tabs. `anim.inert` is the parameter-dependent form,
       and `hierarchical-clustering` uses it for exactly this. */
    init: ({ params, state, fromScratch }) => {
      const clock = beatMs(clockView(params), params.speed);
      if (params.tab === "partial") {
        return { inert: true, done: true, beat: 0, clock, ep: 0, rung: 0 };
      }
      if (params.tab === "derivative") {
        /* Already on the bottom rung and there is nothing to shrink, so the
           buttons go rather than greying out on the first press (4.5). */
        return {
          inert: state.rungs === 0,
          rung: fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.rungs),
          beat: 0,
          clock,
          done: false,
        };
      }
      return {
        inert: false,
        ep: fromScratch
          ? 0
          : Math.min(Math.max(0, params.shown ?? 0), state.track.epochsDone),
        beat: 0,
        /* The clock the beat in `anim.beat` is a share of. Held so `rebuild` can
           see it move; see the guard below. */
        clock,
        done: false,
      };
    },

    advance: (anim, { dt, params, state }) => {
      if (params.tab === "partial") return false;
      /* THE DERIVATIVE TAB'S UNIT IS ONE RUNG DOWN THE LADDER. Same shape as a
         choreographed epoch below — a beat that fills, then the index moves —
         so the two tabs share one clock table and one pause-then-move reading.
         It always choreographs: five rungs is the whole animation, and a pace
         that showed arrivals only would show nothing. */
      if (params.tab === "derivative") {
        if (anim.rung >= state.rungs) {
          anim.beat = 0;
          anim.done = true;
          return false;
        }
        anim.beat += dt / beatMs("derivative", params.speed);
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.rung += 1;
        if (anim.rung >= state.rungs) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }
      const end = state.track.epochsDone;
      if (anim.ep >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      /* WHICH PACE CHOREOGRAPHS IS DECLARED, never decided mid-run (4.1), and
         `model.js` declares it: Slow over the surface, every speed on the
         one-parameter page, where an epoch is a single visible hop and 60 a
         second would show none of them (decision 6). */
      const ms = beatMs(clockView(params), params.speed);
      if (ms > 0) {
        anim.beat += dt / ms;
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.ep += 1;
        if (anim.ep >= end) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }
      anim.beat = 0;
      const target = anim.mode === "step" ? Math.min(end, anim.ep + 1) : end;
      const rate = anim.mode === "step"
        ? 1
        : Math.max(1, Math.round(dt / epochMs(clockView(params), params.speed)));
      anim.ep = Math.min(target, anim.ep + rate);
      if (anim.ep >= end) {
        anim.ep = end;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* A BEAT IN FLIGHT IS CLEARED WHENEVER THE BEAT LENGTH CHANGES. Leaving a
       choreographed speed would otherwise freeze a half-drawn arrow over a
       point the walk has already left — the shipped bug `before` states exist
       for — and changing between two choreographed speeds would leave the
       fraction of one clock being read against another. Cleared here rather
       than at the next advance, because a paused animation gets no next
       advance. The guard used to name Slow, which stopped being the only
       choreographed pace with decision 6.

       The press of "Default view" arrives here too, and leaves the beat alone:
       the clock does not move, so a step in flight keeps running while the
       camera returns. */
    rebuild: (anim, { params, state }) => {
      anim.inert = params.tab === "partial"
        || (params.tab === "derivative" && state.rungs === 0);
      if (params.homeView) homeTheView();
      const ms = beatMs(clockView(params), params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
    },
  },

  /* TURNING THE RELIEF. A gesture rather than two sliders, because a camera is
     one movement and the reader is looking for a direction, not setting a
     number — and through core's `drag` channel rather than a pointer of its
     own, so the viewpoint lands in `values` and a link carries the angle the
     reader stopped at (1.1, 3.6). */
  drag: {
    params: ["turn", "tilt"],
    cursor: "grab",
    /* The surface panel only, and only where there is a surface to turn: on
       the map and on the one-parameter page the same pixels hold a figure with
       no camera, and a drag across them would rotate something nobody can see
       and write two parameters into the link for it. */
    hit: ({ x, y, w, params }) => {
      if (params.tab !== "descent" || params.view !== "two" || params.relief !== "relief") return false;
      const r = layout(w).surf;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },
    /* Half a degree a pixel: the panel is 180-300px wide, so one drag across it
       turns the surface through 90-150 degrees and a second finishes the
       circle. Rounded to whole degrees so the link stays short, and the azimuth
       wraps rather than clamping — turning past due north is a turn, not a wall.

       ELEVATION STOPS AT 85 AND 10. At 90 the projection IS the map with the
       height flattened out of it, and the depth every quad sorts on collapses
       to its own height, so the painter's order stops meaning anything; below
       10 the mesh is edge-on. The panel holds the whole surface up to 70 —
       measured over both scales and every 5 degrees of azimuth — and clips at
       most 20px of 300 off the near corner at 85, from the diagonal azimuths. */
    value: ({ dx, dy, start }) => ({
      turn: ((Math.round(start.turn - dx * 0.5) % 360) + 360) % 360,
      tilt: Math.max(10, Math.min(85, Math.round(start.tilt + dy * 0.5))),
    }),
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params.tab, params.view);
    const L = layout(w);
    if (params.tab === "derivative") return drawDerivativeTab(ctx, colors, L, params, state, anim);
    if (params.tab === "partial") return drawPartialTab(ctx, colors, L, params);
    const { track, q } = state;
    const at = stand(state, params, anim);
    const two = params.view === "two";
    const ratio = Math.max(1, track.epochLoss[at.ep] / q.Lmin);
    const divergedShown = track.diverged !== null && at.ep >= track.diverged;
    const arrived = !divergedShown && ratio < 1.01;
    const stepping = at.beat > 0;

    if (two) {
      drawData(ctx, colors, L.data, state, at.cur, params.scale);
      /* The same panel, the same rect, the same options: the relief is a
         reading of the surface the map already holds, not a second figure. */
      const drawPanel = params.relief === "relief" ? drawRelief : drawSurface;
      drawPanel(ctx, colors, L.surf, state, at.cur, {
        upto: at.upto,
        arrived,
        divergedShown,
        grad: at.grad,
        /* Where the relief is looked at from. The map ignores them, and that is
           the point: they name a camera, and looking straight down needs none. */
        az: params.turn,
        el: params.tilt,
        /* At rest, and at Medium and Fast, both parts of the step show at
           once. Slow builds them: the two components first, then the
           composition, then the move. */
        showStep: !divergedShown,
        tickMix: stepping ? Math.min(1, at.beat / BEATS_TWO.partials) : 1,
        arrowMix: stepping
          ? Math.max(0, Math.min(1, (at.beat - BEATS_TWO.partials) / (BEATS_TWO.direction - BEATS_TWO.partials)))
          : 1,
      });
      drawColourBar(ctx, colors, L.surf, {
        low: colors.costLow,
        high: colors.costHigh,
        left: "1×",
        right: `≥${Math.round(10 ** LOG_CAP)}×`,
        middle: "loss ÷ the least, log scale",
      });
    } else {
      /* CHOREOGRAPHY A (decision 7): the tangent and the arrow are simply
         there, at full length, from the first frame to the last. What the beat
         does is hold the point still for its first 40% and then move it, and
         `stand` above is where that lives — nothing here ramps.

         The tangent takes its slope from the point it touches so that it rolls
         with the curve; `grad` is the floored one the readout, the beat line
         and the gradient VECTOR keep. `drawSlice` says why they can differ. */
      drawSlice(ctx, colors, L.slice, state, at.cur, {
        upto: at.upto,
        divergedShown,
        showStep: !divergedShown,
        grad: at.grad[1],
      });
      /* Which of the three regimes this learning rate is in, stated as the
         arithmetic that decides it rather than as a label. */
      const r = 1 - state.lr * q.curvB1;
      const a = Math.abs(r);
      const regime = a > 1
        ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and the distance to it grows.`
        : a === 1
          ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and keeps the whole distance.`
          : r < 0
            ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and keeps ${f3(a)} of the distance.`
            : `1 − α × curvature = ${f3(r)}: each step keeps ${f3(r)} of the distance to the fit.`;
      label(ctx, colors, regime, L.slice.x, L.regimeY, { color: colors.ink2 });
    }

    /* The beat line: what this part of a Slow epoch is doing, or — at rest and
       at the other two speeds — what one epoch is made of. */
    let said;
    if (stepping && two) {
      said = at.beat < BEATS_TWO.partials
        ? `The two partial derivatives at this point: ∂L/∂b₀ ${fSig(at.grad[0])} and ∂L/∂b₁ ${fSig(at.grad[1])}`
        : at.beat < BEATS_TWO.direction
          ? "They compose into −∇L, the direction the step takes"
          : state.batch >= q.n
            ? `The step moves (b₀, b₁) by α × ∇L, a distance of ${fSig(state.lr * Math.hypot(at.grad[0], at.grad[1]))}`
            : epochPhrase(state.batch);
    } else if (stepping) {
      /* The slope's number is on the vector's own label now, so the line names
         the two marks rather than printing one of them twice. */
      said = at.beat < BEATS_ONE.hold
        ? `The tangent at b₁ ${f3(at.cur[1])}, and −∂L/∂b₁, the direction the step takes`
        : `The step is −α × ∂L/∂b₁ ${fSig(-state.lr * at.grad[1])}`;
    } else {
      /* `state.batch` is the full 100 on the one-parameter page, which takes
         its gradient over every row, so one branch serves both. */
      said = `One epoch is ${epochPhrase(state.batch)}`;
    }
    label(ctx, colors, said, L.slice.x, L.phaseY,
      { color: stepping ? colors.highlight : colors.ink3 });

    /* THE ANGLE BETWEEN THE STEP AND THE STRAIGHT LINE TO THE MINIMUM
       (decision 7). Its own row, filled only where the two directions are both
       drawn: the relief has no room for the straight line under the mesh, and
       once the walk has diverged the panel is already saying so. The batch's
       name goes in where the gradient is a batch's, because at batch 10 or 1
       the step follows the steepest slope of ten rows or one and not of all
       hundred, and a sentence on a shared surface has to be true in every state
       that shows it (2.11). */
    if (two && params.relief === "map" && !divergedShown) {
      const deg = stepAngle(q, at.cur[0], at.cur[1], at.grad[0], at.grad[1]);
      label(ctx, colors, arrived || deg === null
        ? "The walk is at the minimum"
        : `The step follows the ${state.batch >= q.n ? "" : "batch's "}steepest slope, `
          + `${Math.round(deg)}° from the straight line to the minimum`,
      L.slice.x, L.angleY, { color: colors.ink2 });
    }

    drawStrip(ctx, colors, L.strip, state, at.ep);
  },

  readout({ params, state, anim }) {
    /* THE DERIVATIVE TAB'S FOUR NUMBERS ARE ONE ARGUMENT: the slope, the nudge,
       what the tangent predicts against what y does, and what is left over. The
       last is Δa² exactly, on this function and at every a and b, which is the
       claim the ladder walks down. */
    if (params.tab === "derivative") {
      const at = standNudge(state, params, anim);
      const slope = gradFn.da(params.a, B_HELD);
      const moved = gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD);
      return [
        { label: "dy/da", value: f2(slope), note: `2a + 3b, with b held at ${B_HELD}` },
        { label: "Δa", value: fSig(at.da), note: "the change in a the tangent is checked over" },
        {
          label: "Δy predicted, actual",
          value: `${fSig(slope * at.da)}, ${fSig(moved)}`,
          note: "the tangent's rise over Δa, and the change in y",
        },
        { label: "The gap", value: fSig(moved - slope * at.da), note: "Δa², whatever a is" },
      ];
    }
    if (params.tab === "partial") {
      const { a, b } = params;
      return [
        { label: "a, b", value: `${f1(a)}, ${f1(b)}`, note: "the point on the map" },
        { label: "y", value: f2(gradFn.y(a, b)), note: "a² + 3ab at that point" },
        {
          label: "∂y/∂a, ∂y/∂b",
          value: `${f1(gradFn.da(a, b))}, ${f1(gradFn.db(a))}`,
          note: "2a + 3b along a, 3a along b — the gradient",
        },
        {
          label: "Steepest rise",
          value: fSig(Math.hypot(gradFn.da(a, b), gradFn.db(a))),
          note: "the length of the gradient, in y per unit of (a, b)",
        },
      ];
    }
    const { track, q } = state;
    const at = stand(state, params, anim);
    const two = params.view === "two";
    const divergedShown = track.diverged !== null && at.ep >= track.diverged;
    const ratio = Math.max(1, track.epochLoss[at.ep] / q.Lmin);
    const step = state.lr * Math.hypot(two ? at.grad[0] : 0, at.grad[1]);
    return [
      {
        label: "Epoch",
        value: String(at.ep),
        note: `of ${EPOCHS}`,
      },
      two
        ? {
          label: "b₀, b₁",
          value: `${f2(at.cur[0])}, ${f2(at.cur[1])}`,
          note: `least squares ${f2(q.B0)}, ${f2(q.B1)}`,
        }
        : {
          label: "b₁",
          value: f3(at.cur[1]),
          note: `least squares ${f3(q.B1)}, with b₀ held at ${f2(q.B0)}`,
        },
      {
        label: "Loss",
        value: divergedShown ? "diverged" : xTimes(ratio),
        note: divergedShown
          ? `at epoch ${track.diverged}`
          : "the least possible loss is 1×",
      },
      two
        ? {
          label: "∂L/∂b₀, ∂L/∂b₁",
          value: `${fSig(at.grad[0])}, ${fSig(at.grad[1])}`,
          note: state.batch >= q.n
            ? "over all 100 rows"
            : `over the next ${state.batch === 1 ? "row" : `${state.batch} rows`}`,
        }
        : {
          label: "∂L/∂b₁",
          value: fSig(at.grad[1]),
          note: "the tangent's slope at this b₁",
        },
      {
        label: "Step length",
        value: fSig(step),
        note: "α × the gradient, in parameter units",
      },
    ];
  },

  summary({ params, state, anim }) {
    if (params.tab === "derivative") {
      const at = standNudge(state, params, anim);
      const slope = gradFn.da(params.a, B_HELD);
      const moved = gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD);
      return `The curve y = a² + 3ab over a, with b held at ${B_HELD}, and the tangent at a = ${f1(params.a)} `
        + `whose slope is ${f2(slope)}. Over a nudge of ${fSig(at.da)} the tangent predicts a rise of `
        + `${fSig(slope * at.da)}; y moves ${fSig(moved)}, and the gap is ${fSig(moved - slope * at.da)}.`;
    }
    if (params.tab === "partial") {
      const { a, b } = params;
      return `A map of y = a² + 3ab over a and b with contour rings, the point (${f1(a)}, ${f1(b)}) on it, `
        + `and the gradient (${f1(gradFn.da(a, b))}, ${f1(gradFn.db(a))}) drawn from it as an arrow uphill. `
        + `Beside the map, the two slices through that point, each with its tangent.`;
    }
    const { track, q } = state;
    const at = stand(state, params, anim);
    const parts = params.view === "two"
      ? [
        `A scatter of y against x for ${N} rows with the line b₀ ${f2(at.cur[0])}, b₁ ${f2(at.cur[1])} drawn through it, beside the loss ${params.relief === "relief" ? "raised as a surface" : "painted"} over every (b₀, b₁) pair.`,
        `The walk has taken ${at.ep} of ${EPOCHS} epochs from (0, 0) at learning rate ${state.lr}.`,
      ]
      : [
        `The loss as a curve over b₁ with b₀ held at ${f2(q.B0)}, and the steps taken from b₁ = 0 at learning rate ${state.lr}.`,
        `The walk has taken ${at.ep} of ${EPOCHS} epochs and stands at b₁ ${f3(at.cur[1])}.`,
      ];
    parts.push(track.diverged !== null && at.ep >= track.diverged
      ? `It diverged at epoch ${track.diverged}.`
      : `The loss is ${xTimes(Math.max(1, track.epochLoss[at.ep] / q.Lmin))} the least possible.`);
    parts.push("Beneath, the loss after each epoch on a log scale.");
    return parts.join(" ");
  },
});
