/* ============================================================================
   Widget 48 · Gradient Descent — the step, the learning rate, the surface.

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

   THREE DECISIONS THE BRIEF DID NOT SETTLE, recorded because each could
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
      re-measures the claim. The catalogue records the sweep.

      THE HIDDEN PART OF THE PATH IS DASHED AND FAINT, rather than the mesh
      being made transparent. A translucent mesh shows the far wall through the
      near one and the relief stops reading as a surface; the dashed hidden
      line is the drawing convention for exactly this and costs one
      classification per walk.

      BOTH EXPENSIVE PARTS ARE CACHED, on the same terms the map's bitmap
      already is: the mesh (1936 quads, sorted and filled, ~2 ms) into a bitmap
      keyed on size, theme and dataset, and the path's visible/hidden split
      (~1 ms) keyed on the walk. Only the path, the point, the tangents and the
      corner names are painted per frame.

      THE PATH IS SAMPLED, dense over the opening 300 updates and strided after
      it to about 1500 pieces. At batch 1 the walk holds 100 000 positions; the
      map's own path already strides to 1500, and the opening stays dense
      because the first epochs cross most of the frame while the rest crawl.

   The `optimizer` picker (SGD / momentum / Adam, 05-4's table) is a later
   round and unmeasured. The catalogue says not to add it before it is.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  N, EPOCHS, LR_LADDER, BATCHES, LOG_CAP, LEVELS,
  makeData, standardize, quad, domainFor, contourSegments,
  descendFull, descendMini, descendSlope, posAt,
  projector, reliefMesh, reliefPoint, reliefHidden,
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

/* ONE HEIGHT FOR BOTH PAGES. The one-parameter panel is sized to make the loss
   strip land on the same y on either page, so switching pages moves the rail
   and nothing else. */
const stageHeight = (w) => surfSide(w) + 240;

function layout(w) {
  const side = surfSide(w);
  return {
    side,
    data: { x: PAD_L, y: TOP, w: w - PAD_L - PAD_R - SURF_GUTTER - side, h: side },
    surf: { x: w - PAD_R - side, y: TOP, w: side, h: side },
    slice: { x: PAD_L, y: TOP, w: w - PAD_L - PAD_R, h: side },   // the surface's height, so the axis label clears the regime line beneath (measured: at +24 they overlapped by 6px)
    strip: { x: PAD_L, y: TOP + side + 104, w: w - PAD_L - PAD_R, h: LOSS_H },
    regimeY: TOP + side + 60,   // the one-parameter page's line naming the regime
    phaseY: TOP + side + 78,    // what this beat of a Slow step is doing
  };
}

/* One epoch at Slow, in shares of BEAT_MS. Two-parameter page: the partials
   appear, the direction composes, the point moves. One-parameter page: the
   tangent appears, then the step. The move phase interpolates along the stored
   update indices, so at batch 10 or 1 the epoch's ten or hundred updates are
   drawn as they happen rather than as one jump. */
const BEAT_MS = 2000;
const BEATS_TWO = { partials: 0.34, direction: 0.55 };
const BEATS_ONE = { tangent: 0.45 };

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

/* The colour bar, in place of any sentence about the ramp: 1x to 316x the
   least loss, on a log scale, the cap shown rather than said. */
function drawColourBar(ctx, colors, rect) {
  const bar = { x: rect.x, y: rect.y + rect.h + 46, w: rect.w, h: 8 };
  const STEPS = 48;
  for (let i = 0; i < STEPS; i += 1) {
    ctx.fillStyle = hexLerp(colors.costLow, colors.costHigh, i / (STEPS - 1));
    ctx.fillRect(bar.x + (i / STEPS) * bar.w, bar.y, bar.w / STEPS + 1, bar.h);
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
  label(ctx, colors, "1×", bar.x, bar.y + bar.h + 13);
  label(ctx, colors, `≥${Math.round(10 ** LOG_CAP)}×`, bar.x + bar.w, bar.y + bar.h + 13, { align: "right" });
  if (bar.w >= 230) {
    label(ctx, colors, "loss ÷ the least, log scale", bar.x + bar.w / 2, bar.y + bar.h + 13, { align: "center" });
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

/* The mesh, painted once per size, theme and dataset — the map's own cache, on
   the other side of the same panel. The contour rings are baked in with it:
   lifted onto the surface, they move only when the surface does. They are
   painted over the whole mesh rather than hidden-line tested, so a ring on the
   far wall can show through the near one; at 300/35 the trench runs away from
   the reader and the far wall is a sliver. */
let meshCache = null;
function reliefBitmap(wpx, hpx, dpr, colors, state) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${colors.surface}:${state.sig}`;
  if (meshCache && meshCache.key === key) return meshCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const { q, dom } = state;
  const project = projector({ x: 0, y: 0, w: wpx, h: hpx });
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
   a ray march per piece — far too much per frame — and the viewpoint is a
   constant, so the split is a function of the walk alone: ~1 ms for 1500
   pieces, held here rather than in `compute()` so a walk nobody looks in relief
   never pays for it.

   A piece outside the frame is dropped rather than clipped: off the domain
   there is no surface to lie on, and the projection would lay it on the ground
   plane's continuation. The panel says "off the frame" instead. */
let piecesCache = null;
function reliefPieces(state) {
  if (piecesCache && piecesCache.key === state.walkSig) return piecesCache.pieces;
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
      pieces.push({ end: kb, a, b, held, hidden: held && reliefHidden(q, dom, m0, m1) });
    }
  }
  piecesCache = { key: state.walkSig, pieces };
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

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    reliefBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, state),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const project = projector(rect);
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
  for (const pc of reliefPieces(state)) {
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
    const mid = reliefHidden(q, dom, (tail[0] + cur[0]) / 2, (tail[1] + cur[1]) / 2);
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
     viewpoint. Outside the clip: at some viewpoints an edge's midpoint sits on
     the panel's border. */
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

  /* The tangent: its slope IS ∂L/∂b₁, which is the page's whole point. */
  if (opts.tangentMix > 0) {
    const g = opts.grad[1];
    const span = (range[1] - range[0]) * 0.16 * opts.tangentMix;
    const b1 = cur[1];
    const L = f(b1);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.sx(b1 - span), plot.sy(L - g * span));
    ctx.lineTo(plot.sx(b1 + span), plot.sy(L + g * span));
    ctx.stroke();
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
};

const GUTTER = "4.9em";   // the widest label, "∂L/∂b₀", at the card's font size
const CARD_MIN = "10em";  // the four rows of the two-parameter page; the
                          // three-row page keeps the reserve so the figure
                          // does not jog between them (3.4k)
let cardHost = null;
let cardKey = null;

function renderCard(view) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  cardHost.style.minHeight = CARD_MIN;
  if (view === cardKey) return;
  cardKey = view;
  const rows = [["Update", CARD.update], ["Loss", CARD.loss]];
  if (view === "two") rows.push(["∂L/∂b₀", CARD.d0]);
  rows.push(["∂L/∂b₁", CARD.d1]);
  cardHost.innerHTML = rows
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
  const beat = params.speed === "slow" ? (anim?.beat ?? 0) : 0;
  const moveFrom = params.view === "two" ? BEATS_TWO.direction : BEATS_ONE.tangent;
  const a = track.epochAt[ep];
  const b = track.epochAt[Math.min(ep + 1, track.epochsDone)];
  const mix = beat <= moveFrom ? 0 : Math.min(1, (beat - moveFrom) / (1 - moveFrom));
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

/* ---- the widget ---------------------------------------------------------- */

const LR_DETAIL = "α in the update rule: the step is α times the gradient";

defineWidget({
  slug: "gradient-descent",
  title: "Gradient Descent",
  status: "draft",
  subtitle:
    "Gradient descent moves the parameters against the slope of the loss, one "
    + "step at a time. The learning rate sets the size of each step: too small "
    + "and the walk needs thousands of them, above 2 divided by the curvature "
    + "of the loss it diverges.",
  layout: "side",
  height: ({ w }) => stageHeight(w),

  params: {
    lossSec: { type: "section", label: "The loss" },
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
          detail: "the loss as height over the same pairs, from one fixed viewpoint",
        },
      ],
      default: "map",
      display: true,
      when: { param: "view", equals: "two" },
    },

    stepSec: { type: "section", label: "The step" },
    lr: {
      type: "choice",
      label: "Learning rate α",
      options: LR_LADDER.map((v) => ({ value: String(v), label: String(v), detail: LR_DETAIL })),
      default: "0.01",
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
      when: { param: "view", equals: "two" },
    },

    dataSec: { type: "section", label: "The data" },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 30,
      default: 1,
      detail: "redraws the noise added to y = 5 + 2x",
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "Slow", detail: "one epoch at a time, with the partial derivatives drawn before the step" },
        { value: "medium", label: "Medium", detail: "about 60 epochs a second" },
        { value: "fast", label: "Fast", detail: "about 250 epochs a second" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Authoring escape hatch: epochs already walked, first render only. */
    shown: { type: "int", min: 0, max: EPOCHS, default: 0, hidden: true },
  },

  /* The legend has to match the graph, and the two pages draw different marks
     (lm-interaction, 2026-08-29). The loss curve and the path take ink rather
     than a series colour: they are the frame the walk moves on and the trail
     it leaves, not measurements of anything. */
  legend: ({ params }) => (params.view === "two"
    ? [
      { token: "unknown", label: "The 100 rows", mark: "dot" },
      { token: "highlight", label: "The line at this epoch, and the direction of the next step", mark: "line" },
      { token: "reference", label: "The least-squares line, and its (b₀, b₁)", mark: "dash" },
      { token: "ink-1", label: "The path taken so far", mark: "line" },
      /* Only in relief: on the map nothing is in front of the path. */
      ...(params.relief === "relief"
        ? [{ token: "ink-1", label: "The path where the surface hides it", mark: "dash" }]
        : []),
      { token: "empirical", label: "Loss after each epoch", mark: "line" },
    ]
    : [
      { token: "ink-2", label: "The loss over b₁, with b₀ held", mark: "line" },
      { token: "highlight", label: "The tangent at the current b₁, with slope ∂L/∂b₁", mark: "line" },
      { token: "reference", label: "b₁ at the least-squares fit", mark: "dash" },
      { token: "ink-1", label: "The steps taken so far", mark: "line" },
      { token: "empirical", label: "Loss after each epoch", mark: "line" },
    ]),

  compute({ params, rng }) {
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
    /* Two words, not one: with batches of 10 or 1 an epoch holds many steps,
       so "Step" would name the wrong unit. Same noun and same label as the
       other gradient-descent widget in the arc, which is what 3.4c asks for. */
    stepLabel: "Next epoch",
    stepTitle: "Take one epoch of gradient descent and redraw the walk",
    runLabel: "Play",
    runTitle: "Descend to epoch 1000, or to the epoch the walk diverges at",

    init: ({ params, state, fromScratch }) => ({
      ep: fromScratch
        ? 0
        : Math.min(Math.max(0, params.shown ?? 0), state.track.epochsDone),
      beat: 0,
      done: false,
    }),

    advance: (anim, { dt, params, state }) => {
      const end = state.track.epochsDone;
      if (anim.ep >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      /* Slow is the choreographed pace and says so in its own description;
         which pace choreographs is declared, never decided mid-run (4.1). */
      if (params.speed === "slow") {
        anim.beat += dt / BEAT_MS;
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.ep += 1;
        if (anim.ep >= end) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }
      anim.beat = 0;
      const perSec = { medium: 60, fast: 250 }[params.speed] ?? 60;
      const target = anim.mode === "step" ? Math.min(end, anim.ep + 1) : end;
      const rate = anim.mode === "step" ? 1 : Math.max(1, Math.round((perSec * dt) / 1000));
      anim.ep = Math.min(target, anim.ep + rate);
      if (anim.ep >= end) {
        anim.ep = end;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* Leaving Slow with a beat in flight would freeze a half-drawn arrow over
       a point the walk has already left — the shipped bug `before` states
       exist for. Cleared here rather than at the next advance, because a
       paused animation gets no next advance. */
    rebuild: (anim, { params }) => {
      if (params.speed !== "slow") anim.beat = 0;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params.view);
    const L = layout(w);
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
        /* At rest, and at Medium and Fast, both parts of the step show at
           once. Slow builds them: the two components first, then the
           composition, then the move. */
        showStep: !divergedShown,
        tickMix: stepping ? Math.min(1, at.beat / BEATS_TWO.partials) : 1,
        arrowMix: stepping
          ? Math.max(0, Math.min(1, (at.beat - BEATS_TWO.partials) / (BEATS_TWO.direction - BEATS_TWO.partials)))
          : 1,
      });
      drawColourBar(ctx, colors, L.surf);
    } else {
      drawSlice(ctx, colors, L.slice, state, at.cur, {
        upto: at.upto,
        divergedShown,
        grad: at.grad,
        tangentMix: divergedShown ? 0 : stepping ? Math.min(1, at.beat / BEATS_ONE.tangent) : 1,
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
      said = at.beat < BEATS_ONE.tangent
        ? `The tangent at b₁ ${f3(at.cur[1])}: its slope is ∂L/∂b₁ ${fSig(at.grad[1])}`
        : `The step is −α × ∂L/∂b₁ ${fSig(-state.lr * at.grad[1])}`;
    } else {
      /* `state.batch` is the full 100 on the one-parameter page, which takes
         its gradient over every row, so one branch serves both. */
      said = `One epoch is ${epochPhrase(state.batch)}`;
    }
    label(ctx, colors, said, L.slice.x, L.phaseY,
      { color: stepping ? colors.highlight : colors.ink3 });

    drawStrip(ctx, colors, L.strip, state, at.ep);
  },

  readout({ params, state, anim }) {
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
