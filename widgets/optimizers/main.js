/* ============================================================================
   Widget 55 · Optimizers — what each rule does with one gradient, on one
   landscape with a local minimum in the way of the global one.

   PHM5005 05-4 cells 41-44 and 82-86. `model.js` carries the engine (torch's
   own update rules, checked against torch 2.14 to 1e-6), the landscape, the
   geometry and the copy; this file draws them.

   THE CLAIM IS THAT THE CHOICE IS REAL. Every rule wins somewhere on this
   surface and loses somewhere else — the survey in `_lab/dl-optim-measure.mjs`
   is what established that before any picture was drawn, and the rate ladder's
   own detail lines are computed from it at load so they cannot go stale.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD. `_lab/optimizers-mock.html` drew all
       eight sections and Kenneth picked seven (catalogue § Slot 55, PICKED
       2026-09-11): the trench, three named starts plus the drag, the chosen
       walk with a `compare` toggle, the gradient at a fixed length with the
       step to scale plus Adam's rescale panel, five rungs, both schedulers,
       and three optimizer faces with momentum under SGD. The ramp, the two
       minima markers, the start marker, the bar panel and the two strips are
       the mock's.

    2. THE STEP IS DRAWN TWO WAYS AT ONCE, and that is the whole of §4. The
       GRADIENT is a direction and is drawn at a fixed 44px in `--c-slope`;
       drawing it to scale would make it a second step. The STEP is a
       displacement and is drawn to scale in `--c-empirical`. Under SGD the two
       lie on one line, under momentum they visibly part, and under Adam and
       RMSprop the step is rescaled per parameter — which one arrow cannot
       show, so the panel beside the map draws the gradient's two components
       against the step's two on one axis.

    3. ONE SHARED SCALE IN THAT PANEL, and the small bars are the point. Both
       quantities are in parameter units, so a second axis would be a lie about
       what "divided by" means; at lr 0.01 SGD's step bar is a hairline beside
       its gradient bar, which is what "the step is the rate times the
       gradient" looks like. A nonzero value always gets at least 1px, so no
       bar is absent — the number beside it is the reading either way.

    4. THE DRAG IS A CONTROL (3.6). On the map it moves the start marker and
       writes `start`, `x0` and `y0` in ONE transaction through core's drag
       channel, so a copied link reproduces it; on the relief it turns the
       camera and writes `turn` and `tilt`, exactly as widget 48 does. One
       gesture per surface, decided by the `hit`, because the same pixels
       cannot mean two things. The marker's own handle is 14px: a drag
       anywhere on the panel would move the start on a casual click, which is
       the fault widget 34 shipped.

    5. THE FOURTH FACE EXISTS ONLY WHILE THE MARKER IS DRAGGED. `start`'s
       option list is a function of `x0` and `y0` (`optionsFrom`), so *Where
       the marker is* appears when they are set and the three named faces stand
       alone otherwise. Picking a named face clears them on the next frame,
       which is the one thing core cannot do inside the press: a control writes
       exactly one parameter, and three have to move together. `syncStart`
       below is that deferred write; its own comment carries the second half,
       which is that a drag's tail decides whether the whole gesture is a data
       change or a display one, and this panel needs both.

    6. THE RELIEF IS WIDGET 48's RENDERER, IMPORTED. `projector`,
       `reliefMesh`, `reliefPoint`, `reliefLift` and the hidden-line ray march
       are written against a FIELD — any function of two variables — so this
       surface needs no copy of them and no change to core. Whether they should
       be promoted into `widgets/core/` is a decision for whoever wants a third
       relief, not for this widget.

    7. THE VIEWPOINT IS MEASURED, NOT INHERITED, and it is steep. Height here
       is the loss itself (model.js, `heightField`), so the global well is a
       cut 1.2 deep and about one unit wide in a frame eight by six, and a
       walk inside it is below the rim from any low viewpoint. Sweeping 324
       viewpoints with `reliefHidden` over the two crossing walks (momentum
       0.9 at lr 0.3 from Beyond the local minimum, 60 steps; Adam at lr 1
       from the same start, 40 steps) in `_lab/dl-optim-view.mjs`: at
       elevation 60 azimuth 90 leaves 56 of the 60 and 40 of the 40 in view,
       and azimuth 270 45 and 33; at 55 the best cell falls to 38 and 24, and
       at 42 or 35 every azimuth hides about two thirds of both, because the
       rim is in the way. So the default looks down the trench from its
       local-well end at 60 degrees, most of the way to the map but the only
       elevation at which the walk the widget exists to show is on screen;
       the drag goes lower when the reader wants the depth. The first draft
       used the map's log ramp as height, which made each well a needle,
       and 270/42 was the best of a bad set (23 of 45); the second draft's
       walk hung below that mesh, which is how the field was found wrong.
    8. THE GLOBAL MINIMUM IS OCCLUDED FROM EVERY LOW VIEWPOINT and is drawn
       anyway. It sits on the floor of a trench, so from any elevation much
       below the default the ray march out of it meets the trench's near wall.
       The hidden-line test is for the WALK, which is a line the reader follows;
       a marker is a label for a place, and a label nobody can see is worse than
       one drawn over the rim in front of it.

    9. COLOUR CARRIES ONE GROUPING: the chosen walk against the rest. With
       `compare` on, the other three are `--ink-3` at reduced width with their
       method named at the end — four hues would collide with the ramp and put
       a second grouping on one panel.
   ========================================================================= */

import { defineWidget, makePlot, mathmlRenders } from "../core/index.js";
import {
  projector, reliefMesh, reliefPoint, reliefLift, reliefHidden, isoSegments,
} from "../gradients/model.js";
import * as M from "./model.js";

/* ---- the measured viewpoint (decision 7) --------------------------------- */

export const RELIEF_AZ = 90;
export const RELIEF_EL = 60;

/* ---- small drawing helpers ----------------------------------------------- */

function label(ctx, colors, s, x, y, { color, align = "left", size, halo = false } = {}) {
  ctx.save();
  ctx.font = `${size ?? colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (halo) {
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color ?? colors.ink3;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** A label that cannot leave the panel it belongs to — widget 48's, measured
    with the font it is about to be drawn in so the two cannot disagree. */
function panelLabel(ctx, colors, rect, s, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.size ?? colors.fsXs} ${colors.font}`;
  const tw = ctx.measureText(s).width;
  ctx.restore();
  const left = opts.align === "right" ? x - tw : opts.align === "center" ? x - tw / 2 : x;
  label(ctx, colors, s,
    Math.max(rect.x + 4, Math.min(rect.x + rect.w - 4 - tw, left)),
    Math.max(rect.y + 12, Math.min(rect.y + rect.h - 4, y)),
    { color: opts.color, size: opts.size, halo: opts.halo });
}

/* A slope mark and a step mark both cross a full-bleed ramp along their whole
   length, so both are CASED in the page's own ground — tokens.css's rule for
   `--c-slope`, and the mock's for every walk drawn here. */
function arrow(ctx, colors, x0, y0, x1, y1, color, width = 2) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const head = (cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 8 * Math.cos(a - 0.4), cy - 8 * Math.sin(a - 0.4));
    ctx.lineTo(cx - 8 * Math.cos(a + 0.4), cy - 8 * Math.sin(a + 0.4));
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.surface;
  ctx.fillStyle = colors.surface;
  ctx.lineWidth = width + 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  head(x1, y1);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  head(x1, y1);
  ctx.fill();
  ctx.restore();
}

const mixRGB = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
};
const hexLerp = (a, b, t) => {
  const c = mixRGB(a, b, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);

const ARROW_PX = 44;      // the gradient's fixed length (decision 2)
const HANDLE_PX = 14;     // the start marker's grab radius (decision 4)

/* ---- the surface, painted once ------------------------------------------- */

/* THE LANDSCAPE NEVER CHANGES, so the key is the size and the theme and
   nothing else — unlike widget 48, whose surface follows its data. ~13k O(1)
   loss evaluations and a marching-squares pass, paid once per size instead of
   sixty times a second. */
const CONTOURS = isoSegments(M.TRENCH.f, M.TRENCH.range[0], M.TRENCH.range[1],
  M.contourLevels(M.TRENCH), 96);

let mapCache = null;
function surfaceBitmap(wpx, hpx, dpr, colors) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${colors.surface}`;
  if (mapCache && mapCache.key === key) return mapCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const S = M.TRENCH;
  const [xd, yd] = S.range;
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const x = xd[0] + ((px + CELL / 2) / wpx) * (xd[1] - xd[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const y = yd[1] - ((py + CELL / 2) / hpx) * (yd[1] - yd[0]);
      c.fillStyle = hexLerp(colors.costLow, colors.costHigh, M.rampT(S, S.f(x, y)));
      c.fillRect(px, py, CELL, CELL);
    }
  }
  const bx = (v) => ((v - xd[0]) / (xd[1] - xd[0])) * wpx;
  const by = (v) => hpx - ((v - yd[0]) / (yd[1] - yd[0])) * hpx;
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.5;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of CONTOURS) {
    c.moveTo(bx(ax), by(ay));
    c.lineTo(bx(zx), by(zy));
  }
  c.stroke();
  mapCache = { key, canvas: cv };
  return cv;
}

/* The mesh, painted once per size, theme and viewpoint — widget 48's cache on
   the other side of the same panel. A drag misses it every frame and repaints
   all 1936 quads, which a gesture can afford; what the key buys is keeping the
   mesh out of the frame budget for everything the surface does not depend on,
   which here is every parameter the widget has. */
/* 66 quads a side rather than widget 48's 44: the trench is half a unit wide
   across y, six units over the frame, and at 44 it is three quads across. The
   mesh is cached, so the count is paid once per size, theme and viewpoint. */
const MESH_G = 66;
const FIELD = M.sampledField(M.heightField(M.TRENCH), M.TRENCH.range[0], M.TRENCH.range[1], MESH_G);
let meshCache = null;
function reliefBitmap(wpx, hpx, dpr, colors, az, el) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${colors.surface}:${az}:${el}`;
  if (meshCache && meshCache.key === key) return meshCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const [xd, yd] = M.TRENCH.range;
  const project = projector({ x: 0, y: 0, w: wpx, h: hpx }, az, el);
  c.lineWidth = 0.5 * dpr;
  for (const face of reliefMesh(FIELD, xd, yd, project, MESH_G)) {
    c.beginPath();
    face.pts.forEach((p, k) => (k ? c.lineTo(p.X, p.Y) : c.moveTo(p.X, p.Y)));
    c.closePath();
    const rgb = mixRGB(colors.costLow, colors.costHigh, M.heightToRampT(M.TRENCH, face.t));
    c.fillStyle = `rgb(${rgb.map((v) => Math.round(v * face.shade)).join(", ")})`;
    c.fill();
    /* a hairline of the page's own ground between faces: filled edge to edge
       the quads seam, and the mesh reads as noise rather than as a surface */
    c.strokeStyle = colors.surface;
    c.globalAlpha = 0.18;
    c.stroke();
    c.globalAlpha = 1;
  }
  const lift = (x, y) => project(...reliefPoint(FIELD, xd, yd, x, y));
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.55;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of CONTOURS) {
    const a = lift(ax, ay);
    const b = lift(zx, zy);
    c.moveTo(a.X, a.Y);
    c.lineTo(b.X, b.Y);
  }
  c.stroke();
  meshCache = { key, canvas: cv };
  return cv;
}

/* The chosen walk, split into visible and hidden pieces once per walk and
   viewpoint. The march is far too much per frame, and a turn then pays only
   the march and not the walk. Only the CHOSEN walk is tested: the other three
   are context in `--ink-3` (decision 9), and testing four walks on every frame
   of a turn gesture would cost four times what one does. */
let piecesCache = null;
function reliefPieces(state, az, el) {
  const key = `${state.sig}:${az}:${el}`;
  if (piecesCache && piecesCache.key === key) return piecesCache.pieces;
  const w = state.mine;
  const [xd, yd] = M.TRENCH.range;
  const pieces = [];
  for (let k = 0; k < w.len; k += 1) {
    const mx = (w.xs[k] + w.xs[k + 1]) / 2;
    const my = (w.ys[k] + w.ys[k + 1]) / 2;
    pieces.push({
      a: [w.xs[k], w.ys[k]],
      b: [w.xs[k + 1], w.ys[k + 1]],
      hidden: reliefHidden(FIELD, xd, yd, mx, my, az, el),
    });
  }
  piecesCache = { key, pieces };
  return pieces;
}

/* ---- the map ------------------------------------------------------------- */

const HIDDEN_LINE = { dash: [3, 4], alpha: 0.55, width: 1.3 };
const VISIBLE_LINE = { dash: [], alpha: 1, width: 2 };

function strokeSegments(ctx, colors, list, { dash, alpha, width }, color) {
  if (!list.length) return;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color ?? colors.empirical;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [a, b] of list) {
    ctx.moveTo(a.X, a.Y);
    ctx.lineTo(b.X, b.Y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A walk's polyline up to `upto`, ending at `cur`, cased in the page's own
    ground so it can be found on the hot end of the ramp (the mock's §3). */
function walkLine(ctx, colors, sx, sy, w, upto, cur, { color, width }) {
  if (upto < 1 && !cur) return;
  const stride = Math.max(1, Math.ceil(upto / 900));
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(sx(w.xs[0]), sy(w.ys[0]));
    for (let k = stride; k <= upto; k += stride) ctx.lineTo(sx(w.xs[k]), sy(w.ys[k]));
    if (cur) ctx.lineTo(sx(cur[0]), sy(cur[1]));
    ctx.stroke();
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = width + 2.5;
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  path();
  ctx.restore();
}

/** The two minima and the start, drawn on whatever projection is passed in.
    Global filled, local hollow, both `--c-reference`; the start is a ring in
    `--c-highlight` (decision 8 on why neither is hidden-line tested). */
function marks(ctx, colors, pt, state) {
  for (const m of M.TRENCH.minima) {
    const p = pt(m.x, m.y);
    ctx.beginPath();
    ctx.arc(p.X, p.Y, 5, 0, 2 * Math.PI);
    if (m.kind === "G") {
      ctx.fillStyle = colors.reference;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.surface;
      ctx.stroke();
    } else {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = colors.surface;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.reference;
      ctx.stroke();
    }
  }
  const s = pt(state.start[0], state.start[1]);
  ctx.beginPath();
  ctx.arc(s.X, s.Y, 5.5, 0, 2 * Math.PI);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.highlight;
  ctx.stroke();
}

/** The travelling point: the walk's own colour, ringed in the page's ground so
    it reads on the cost-low blue of the trench floor. */
function walkDot(ctx, colors, px, py) {
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The other three walks' end markers and names, placed so they do not print
    through each other. Three tries, then the label is dropped rather than
    parked where it no longer points at its own end (the mock's rule). */
function endLabels(ctx, colors, rect, sx, sy, ends) {
  const placed = [];
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  for (const e of ends) {
    const px = sx(e.at[0]);
    const py = sy(e.at[1]);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, 2 * Math.PI);
    ctx.fillStyle = colors.ink3;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.surface;
    ctx.stroke();
    const tw = ctx.measureText(e.name).width;
    let lx = px + 7;
    if (lx + tw > rect.x + rect.w - 3) lx = px - 7 - tw;
    const base = Math.min(Math.max(py + 3, rect.y + 11), rect.y + rect.h - 4);
    const clash = (y) => y < rect.y + 10 || y > rect.y + rect.h - 3
      || placed.some((p) => Math.abs(p.y - y) < 12 && lx < p.x + p.w + 5 && p.x < lx + tw + 5);
    const ly = [base, base + 13, base - 13].find((y) => !clash(y));
    if (ly == null) continue;
    placed.push({ x: lx, y: ly, w: tw });
    label(ctx, colors, e.name, lx, ly, { color: colors.ink3, halo: true });
  }
  ctx.restore();
}

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
  label(ctx, colors, M.n2(M.TRENCH.fmin), bar.x, bar.y + bar.h + 13);
  label(ctx, colors, M.n2(M.TRENCH.fmax), bar.x + bar.w, bar.y + bar.h + 13, { align: "right" });
  if (bar.w >= 230) {
    label(ctx, colors, M.STRINGS.rampMiddle, bar.x + bar.w / 2, bar.y + bar.h + 13, { align: "center" });
  }
}

function drawMap(ctx, colors, rect, state, params, at) {
  const [xd, yd] = M.TRENCH.range;
  const plot = makePlot({ ctx, colors, rect, xDomain: xd, yDomain: yd });
  plot.caption(M.STRINGS.mapCaption);
  if (at.gone) plot.note(M.STRINGS.gone, { tone: colors.extreme });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    surfaceBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (params.compare) {
    const ends = [];
    for (const w of state.others) {
      const upto = Math.min(at.k, w.len);
      walkLine(ctx, colors, plot.sx, plot.sy, w, upto, null,
        { color: colors.ink3, width: 1.4 });
      ends.push({ at: [w.xs[upto], w.ys[upto]], name: M.methodShort(w.kind) });
    }
    endLabels(ctx, colors, rect, plot.sx, plot.sy, ends);
  }
  walkLine(ctx, colors, plot.sx, plot.sy, state.mine, at.k, at.cur,
    { color: colors.empirical, width: 2.2 });
  marks(ctx, colors, (x, y) => ({ X: plot.sx(x), Y: plot.sy(y) }), state);

  /* THE STEP, AT THE POINT THE WALK STANDS ON (decision 2). */
  const px = plot.sx(at.cur[0]);
  const py = plot.sy(at.cur[1]);
  if (at.showGradient && at.gLen > 0) {
    const ux = -at.g[0] / at.gLen;
    const uy = -at.g[1] / at.gLen;
    arrow(ctx, colors, px, py, px + ux * ARROW_PX, py - uy * ARROW_PX, colors.slope, 2);
  }
  if (at.showStep) {
    const ex = plot.sx(at.cur[0] + at.d[0]) - px;
    const ey = plot.sy(at.cur[1] + at.d[1]) - py;
    if (Math.hypot(ex, ey) > 2) arrow(ctx, colors, px, py, px + ex, py + ey, colors.empirical, 2.2);
  }
  walkDot(ctx, colors, px, py);
  ctx.restore();

  plot.axisX({ label: "parameter 1" });
  plot.axisY({ label: "parameter 2" });
  drawColourBar(ctx, colors, rect);
}

function drawRelief(ctx, colors, rect, state, params, at) {
  const [xd, yd] = M.TRENCH.range;
  const plot = makePlot({ ctx, colors, rect, xDomain: xd, yDomain: yd });
  plot.caption(M.STRINGS.reliefCaption);
  if (at.gone) plot.note(M.STRINGS.gone, { tone: colors.extreme });

  const az = params.turn;
  const el = params.tilt;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    reliefBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, az, el),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const project = projector(rect, az, el);
  const pt = (x, y) => project(...reliefPoint(FIELD, xd, yd, x, y));
  /* a point held at the height of the surface under `from`, for an arrow that
     lies tangent to the surface rather than diving through it */
  const liftTo = (t, x, y) => project(...reliefLift(t, xd, yd, x, y));

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (params.compare) {
    const ends = [];
    for (const w of state.others) {
      const upto = Math.min(at.k, w.len);
      ctx.save();
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3.4;
      ctx.lineJoin = "round";
      const path = () => {
        ctx.beginPath();
        const stride = Math.max(1, Math.ceil(upto / 400));
        let started = false;
        for (let k = 0; k <= upto; k += stride) {
          const p = pt(w.xs[k], w.ys[k]);
          if (started) ctx.lineTo(p.X, p.Y);
          else { ctx.moveTo(p.X, p.Y); started = true; }
        }
        ctx.stroke();
      };
      path();
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1.4;
      path();
      ctx.restore();
      const e = pt(w.xs[upto], w.ys[upto]);
      ends.push({ at: [w.xs[upto], w.ys[upto]], name: M.methodShort(w.kind), p: e });
    }
    endLabels(ctx, colors, rect, (x) => x, (y) => y,
      ends.map((e) => ({ at: [e.p.X, e.p.Y], name: e.name })));
  }

  /* the chosen walk: solid where the surface leaves it in view, dashed and
     faint where the surface is in front of it */
  const shown = [];
  const buried = [];
  for (const pc of reliefPieces(state, az, el)) {
    if (shown.length + buried.length >= at.k) break;
    (pc.hidden ? buried : shown).push([pt(pc.a[0], pc.a[1]), pt(pc.b[0], pc.b[1])]);
  }
  if (at.k >= 1 || at.cur) {
    const tail = state.mine;
    const seg = [pt(tail.xs[at.k], tail.ys[at.k]), pt(at.cur[0], at.cur[1])];
    shown.push(seg);
  }
  strokeSegments(ctx, colors, buried, HIDDEN_LINE, colors.empirical);
  strokeSegments(ctx, colors, shown, VISIBLE_LINE, colors.empirical);

  marks(ctx, colors, pt, state);

  const c = pt(at.cur[0], at.cur[1]);
  const t = FIELD(at.cur[0], at.cur[1]);
  if (at.showGradient && at.gLen > 0) {
    const s = 0.9;   // the gradient's length in domain units, so the arrow lies flat
    const e = liftTo(t, at.cur[0] - (at.g[0] / at.gLen) * s, at.cur[1] - (at.g[1] / at.gLen) * s);
    arrow(ctx, colors, c.X, c.Y, e.X, e.Y, colors.slope, 2);
  }
  if (at.showStep) {
    const e = liftTo(t, at.cur[0] + at.d[0], at.cur[1] + at.d[1]);
    if (Math.hypot(e.X - c.X, e.Y - c.Y) > 2) {
      arrow(ctx, colors, c.X, c.Y, e.X, e.Y, colors.empirical, 2.2);
    }
  }
  walkDot(ctx, colors, c.X, c.Y);
  ctx.restore();

  /* no axisX/axisY: a projected surface has no rectilinear axes to hang ticks
     on, so the two parameters are named along the edges nearest the reader */
  nameEdges(ctx, colors, pt, xd, yd);
  drawColourBar(ctx, colors, rect);
}

/** Widget 48's edge naming, at this widget's two axis names: whichever edge
    the viewpoint puts nearest the reader carries the name, so the naming
    survives a turn. */
function nameEdges(ctx, colors, pt, xDom, yDom) {
  const nearer = (u, v) => (pt(u[0], u[1]).depth <= pt(v[0], v[1]).depth ? u : v);
  const midX = (xDom[0] + xDom[1]) / 2;
  const midY = (yDom[0] + yDom[1]) / 2;
  const centre = pt(midX, midY);
  for (const [name, at] of [
    ["parameter 1", nearer([midX, yDom[0]], [midX, yDom[1]])],
    ["parameter 2", nearer([xDom[0], midY], [xDom[1], midY])],
  ]) {
    const p = pt(at[0], at[1]);
    const dx = p.X - centre.X;
    const dy = p.Y - centre.Y;
    const len = Math.hypot(dx, dy) || 1;
    label(ctx, colors, name, p.X + (dx / len) * 16, p.Y + (dy / len) * 16 + 4,
      { align: "center", color: colors.ink2, halo: true });
  }
}

/* ---- the step panel (decisions 2 and 3) ---------------------------------- */

function drawPanel(ctx, colors, rect, at) {
  const rows = [
    { y: 3.3, v: at.g[0], c: colors.slope, lab: "gradient 1" },
    { y: 2.6, v: at.d[0], c: colors.empirical, lab: "step 1" },
    { y: 1.4, v: at.g[1], c: colors.slope, lab: "gradient 2" },
    { y: 0.7, v: at.d[1], c: colors.empirical, lab: "step 2" },
  ];
  const lim = Math.max(M.PANEL_FLOOR, ...rows.map((r) => Math.abs(r.v))) * 1.15;
  /* THE NUMBER COLUMN IS RESERVED, not hoped for. A bar that runs the full
     width puts its number past the panel's own right edge, and so does half
     the axis's right-hand tick: both ran 5px off the canvas at 690px until the
     bars were given `PANEL_NUM` to end short of. */
  const bars = {
    x: rect.x + M.PANEL_LBL,
    y: rect.y + 14,
    w: rect.w - M.PANEL_LBL - M.PANEL_NUM,
    h: rect.h - 44,
  };
  const plot = makePlot({ ctx, colors, rect: bars, xDomain: [-lim, lim], yDomain: [0, 4] });
  panelLabel(ctx, colors, { x: rect.x, y: rect.y - 20, w: rect.w, h: 20 },
    M.STRINGS.panelCaption, rect.x, rect.y - 6,
    { size: colors.fsSm, color: colors.ink2 });
  panelLabel(ctx, colors, { x: rect.x, y: rect.y - 20, w: rect.w, h: 20 },
    /* the readout counts steps TAKEN; this panel shows the one the rule makes
       from where the walk stands, so it is the next one until the budget */
    at.last ? `step ${at.k}, the last` : `step ${at.stepNo}, next`,
    rect.x + rect.w, rect.y - 6, { align: "right" });

  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.sx(0), bars.y);
  ctx.lineTo(plot.sx(0), bars.y + bars.h);
  ctx.stroke();
  ctx.textBaseline = "middle";
  for (const r of rows) {
    const y = plot.sy(r.y);
    const x0 = plot.sx(0);
    const x1 = plot.sx(r.v);
    /* DECISION 3: a nonzero value always gets a pixel, so a step a hundred
       times smaller than its gradient is a hairline rather than nothing. */
    const wpx = r.v === 0 ? 0 : Math.max(1, Math.abs(x1 - x0));
    ctx.fillStyle = r.c;
    ctx.fillRect(r.v < 0 ? x0 - wpx : x0, y - 7, wpx, 14);
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(r.lab, rect.x + M.PANEL_LBL - 8, y);
    /* a negative bar runs back toward its row label, so its number sits on the
       empty side of the axis rather than at the bar's tip */
    ctx.textAlign = "left";
    ctx.fillStyle = colors.ink1;
    ctx.fillText(M.sig(r.v), Math.max(x0, x1) + 5, y);
  }
  ctx.restore();
  plot.axisX({
    ticks: [-lim, 0, lim],
    /* two significant figures, not three: the tick is a scale and its width is
       paid for in the number column beside it */
    format: (v) => (v === 0 ? "0" : String(Number(v.toPrecision(2)))),
    label: "parameter units",
  });
}

/* ---- the two strips ------------------------------------------------------ */

function drawLossStrip(ctx, colors, rect, state, at) {
  const S = M.TRENCH;
  const dom = [S.fmin - 0.06, S.fmax + 0.06];
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, M.BUDGET], yDomain: dom });
  plot.caption(M.STRINGS.lossCaption);
  plot.note(`step ${at.k} of ${M.BUDGET}`);
  plot.axisX({ ticks: [0, 100, 200, 300, 400, 500], label: "step" });
  /* the two minima ARE the ticks (2.7): the number beside the rule is what
     the curve is being read against, and a fourth tick at the panel's own
     ceiling would print through the global minimum's at 3px */
  plot.axisY({ ticks: [S.G.f, S.L.f, 0], format: (v) => M.n2(v), label: "loss" });

  /* the two minima as the fixed benchmarks the curve is read against */
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.5;
  for (const m of [S.G, S.L]) {
    const y = Math.round(plot.sy(m.f)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.stroke();
  }
  ctx.restore();
  for (const [m, name] of [[S.G, "global minimum"], [S.L, "local minimum"]]) {
    panelLabel(ctx, colors, rect, name, rect.x + rect.w - 4, plot.sy(m.f) - 4,
      { align: "right", color: colors.reference, halo: true });
  }

  if (at.k < 1) return;
  const stride = Math.max(1, Math.ceil(at.k / 700));
  const pts = [];
  for (let e = 0; e <= at.k; e += stride) pts.push([e, state.mine.loss[e]]);
  if (pts[pts.length - 1][0] !== at.k) pts.push([at.k, state.mine.loss[at.k]]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y - 2, rect.w, rect.h + 4);
  ctx.clip();
  plot.curve(pts, { stroke: colors.empirical, width: 2 });
  ctx.fillStyle = colors.empirical;
  ctx.beginPath();
  ctx.arc(plot.sx(at.k), plot.sy(state.mine.loss[at.k]), 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

function drawRateStrip(ctx, colors, rect, state, at) {
  const hi = Math.log10(state.lr);
  const lo = state.rateLo >= state.lr ? hi - 1 : Math.log10(state.rateLo);
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, M.BUDGET], yDomain: [lo, hi] });
  plot.caption(M.STRINGS.rateCaption);
  if (state.rateFloored) plot.note("the strip floors at 1e-8");
  plot.axisX({ ticks: [0, 100, 200, 300, 400, 500], label: "step" });
  plot.axisY({
    ticks: lo === hi ? [hi] : [lo, hi],
    format: (v) => M.rateText(10 ** v),
    label: "rate",
  });
  if (at.k < 1) return;
  const rates = state.mine.rate;
  const upto = Math.min(at.k, rates.length);
  const pts = [];
  const stride = Math.max(1, Math.ceil(upto / 700));
  for (let e = 1; e <= upto; e += stride) {
    pts.push([e, Math.log10(Math.max(M.RATE_FLOOR, rates[e - 1]))]);
  }
  pts.push([upto, Math.log10(Math.max(M.RATE_FLOOR, rates[upto - 1]))]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y - 2, rect.w, rect.h + 4);
  ctx.clip();
  plot.curve(pts, { stroke: colors.empirical, width: 2 });
  ctx.restore();
}

/* ---- the formula card ---------------------------------------------------- */

const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const msup = (b, s) => `<msup>${b}${s}</msup>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const mrow = (...xs) => `<mrow>${xs.join("")}</mrow>`;
const row = (...xs) => xs.join("");
const sqrt = (x) => `<msqrt>${x}</msqrt>`;
const eq = (mathml, plain) => (MATHML ? mml(mathml) : plain);

/* `msub`, `msup` and `mfrac` take EXACTLY TWO children, so anything built from
   several pieces is wrapped in an `mrow` first. */
const TH = mi("θ");
const LR = mi("lr");
const G = mi("g");
const EPS = mi("ε");
const B1 = msub(mi("β"), mn("1"));
const B2 = msub(mi("β"), mn("2"));

const CARD = {
  sgd: eq(
    row(TH, mo("←"), TH, mo("−"), LR, mo("·"), G),
    "θ ← θ − lr · g"),
  momentum: eq(
    row(mi("b"), mo("←"), mi("μ"), mi("b"), mo("+"), G, mo(",  "),
      TH, mo("←"), TH, mo("−"), LR, mo("·"), mi("b")),
    "b ← μ b + g,   θ ← θ − lr · b"),
  rmsprop: eq(
    row(mi("v"), mo("←"), mi("ρ"), mi("v"), mo("+"), mo("("), mn("1"), mo("−"), mi("ρ"), mo(")"),
      msup(G, mn("2")), mo(",  "),
      TH, mo("←"), TH, mo("−"), LR, mo("·"),
      frac(G, mrow(sqrt(mi("v")), mo("+"), EPS))),
    "v ← ρ v + (1 − ρ) g²,   θ ← θ − lr · g / (√v + ε)"),
  adam: eq(
    row(mi("m"), mo("←"), B1, mi("m"), mo("+"), mo("("), mn("1"), mo("−"), B1, mo(")"), G, mo(",  "),
      mi("v"), mo("←"), B2, mi("v"), mo("+"), mo("("), mn("1"), mo("−"), B2, mo(")"), msup(G, mn("2")), mo(",  "),
      mi("m̂"), mo("="), frac(mi("m"), mrow(mn("1"), mo("−"), msup(B1, mi("t")))), mo(",  "),
      mi("v̂"), mo("="), frac(mi("v"), mrow(mn("1"), mo("−"), msup(B2, mi("t")))), mo(",  "),
      TH, mo("←"), TH, mo("−"), LR, mo("·"),
      frac(mi("m̂"), mrow(sqrt(mi("v̂")), mo("+"), EPS))),
    "m ← β₁ m + (1 − β₁) g,   v ← β₂ v + (1 − β₂) g²,   m̂ = m / (1 − β₁ᵗ),   "
    + "v̂ = v / (1 − β₂ᵗ),   θ ← θ − lr · m̂ / (√v̂ + ε)"),
};
const CARD_NAME = { sgd: "SGD", momentum: "SGD", rmsprop: "RMSprop", adam: "Adam" };

/* AdamW gets a line and not a face: its walk here differs from Adam's by under
   0.03 at every step, so a control for it would be a control with no idea in
   it (3.5). The decay pulls every parameter toward zero, which matters for a
   network's weights and is invisible on two of them. */
const ADAMW_LINE =
  "AdamW first shrinks θ by (1 − lr·λ), λ 0.01; on this surface its walk is Adam's to within 0.03.";

function torchCall(params) {
  const lr = params.lr;
  if (params.optimizer === "sgd") {
    const mu = String(params.momentum) === "0.9" ? ", momentum=0.9" : "";
    return `optim.SGD(model.parameters(), lr=${lr}${mu})`;
  }
  if (params.optimizer === "rmsprop") return `optim.RMSprop(model.parameters(), lr=${lr})`;
  return `optim.Adam(model.parameters(), lr=${lr})`;
}
const SCHED_CALL = {
  steplr: "lr_scheduler.StepLR(optimizer, step_size=100, gamma=0.1)",
  plateau: "lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.1, patience=10)",
};

const GUTTER = "4.4em";
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
  const kind = M.kindOf(params);
  const key = `${kind}:${params.lr}:${params.scheduler}`;
  if (key === cardKey) return;
  cardKey = key;
  const lines = [`<p class="w-math-note">${torchCall(params)}</p>`];
  if (SCHED_CALL[params.scheduler]) {
    lines.push(`<p class="w-math-note">${SCHED_CALL[params.scheduler]}</p>`);
  }
  if (kind === "adam") lines.push(`<p class="w-math-note">${ADAMW_LINE}</p>`);
  cardHost.innerHTML =
    `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
    + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">`
    + `${CARD_NAME[kind]}</span>${CARD[kind]}</div>${lines.join("")}`;
}

/* ---- where the walk stands ----------------------------------------------- */

/**
 * One reading of the animation, so `draw`, `readout` and `summary` cannot each
 * work it out differently (5.8).
 *
 * `k` is steps taken. The step the panel and the arrows describe is the one
 * about to be taken FROM position k — index k of the step arrays — which at
 * the end of the walk is the last one taken instead.
 */
function stand(state, params, anim) {
  const w = state.mine;
  const k = Math.min(anim?.k ?? 0, state.units);
  const beat = anim?.beat ?? 0;
  const choreographed = M.choreographs(params.speed) && beat > 0 && k < state.units;
  const si = Math.min(k, w.gx.length - 1);
  const moving = choreographed && beat >= M.BEATS.step;
  const f = moving ? easeInOut((beat - M.BEATS.step) / (1 - M.BEATS.step)) : 0;
  const cur = moving ? M.posAt(w, k + f) : [w.xs[k], w.ys[k]];
  const g = si >= 0 ? [w.gx[si], w.gy[si]] : [0, 0];
  const d = si >= 0 ? [w.dx[si], w.dy[si]] : [0, 0];
  return {
    k,
    beat,
    cur,
    g,
    d,
    gLen: Math.hypot(g[0], g[1]),
    stepNo: si + 1,
    last: k >= state.units,
    rate: si >= 0 ? w.rate[si] : state.lr,
    /* THE GRADIENT ARROW IS SLOW'S, and the legend says so in the same
       breath. It is a DIRECTION drawn at a fixed length, which is worth a beat
       of its own when there is a beat to spend and is one more mark to rule
       out at 40 steps a second. The step is drawn at every pace, because it is
       what actually happened. Slow builds them: the gradient, then the step,
       then the move (4.1 — the pace declares this, the animation does not
       decide it mid-run). */
    showGradient: M.choreographs(params.speed),
    showStep: !choreographed || beat >= M.BEATS.gradient,
    choreographed,
    gone: w.gone !== null && k >= w.len,
  };
}

/* ---- the way home from a drag, and the way back from one ----------------- */

let widgetApi = null;

/* Widget 48's momentary-pill pattern: the press is a parameter for exactly as
   long as it takes `rebuild` to see it, and the two it writes are the ones the
   link should carry. The release comes FIRST, or each write re-enters this
   function and it never ends. */
function homeTheView() {
  if (!widgetApi || !widgetApi.params.homeView) return;
  widgetApi.setParam("homeView", false);
  widgetApi.setParam("turn", RELIEF_AZ);
  widgetApi.setParam("tilt", RELIEF_EL);
}

/* DECISION 5, AND THE TAIL RULE THAT DECIDES HOW IT IS DONE.
 *
 * Core applies a multi-parameter drag by writing every parameter but the LAST
 * straight into `values` and sending the last through `setParam` — so the
 * WHOLE gesture takes the kind of its tail. One tail cannot be right for both
 * gestures on this panel: the camera must not reset the walk (3.2), so the
 * tail has to be `tilt`, which is display; and the marker's move IS a data
 * change, which must reset it (invariant 3). Found by dragging the marker on a
 * figure at step 60 and watching it stay at step 60 — the URL had moved, the
 * walk had been recomputed from the new start, and 60 steps of it were still
 * on screen.
 *
 * The same press also has to change the CONTROL: picking a named face has to
 * clear `x0` and `y0`, and a marker drag has to bring the fourth face back —
 * and core rebuilds the control block only for a parameter another field is
 * declared against, which `x0` is and `start` is not.
 *
 * One deferred write does both. It goes through `x0`: data, so it restarts the
 * walk, and named in `start`'s `optionsFrom`, so it rebuilds the faces. It
 * runs on the next microtask, after `draw` has returned and the gesture's own
 * write has finished, and `settled` is what stops it asking twice — the write
 * repaints, and the repaint would otherwise schedule another.
 *
 * THE FIRST DRAW IS EXEMPT, and that is the whole of `settled` starting as
 * null. An authored link carries its start and its `shown` together, and a
 * deferred data write on the first frame would reset the figure the link was
 * written to show (4.4).
 */
const startKey = (p) => `${p.start}:${p.x0}:${p.y0}`;
let settled = null;
let pending = false;

function syncStart(params) {
  if (settled === null) {
    settled = startKey(params);
    return;
  }
  if (pending || startKey(params) === settled) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    if (!widgetApi) return;
    const now = widgetApi.params;
    /* WHERE THE START IS GOING TO END UP, recorded before the writes rather
       than after them: each one repaints, and a repaint that did not already
       know the answer would schedule this again. */
    settled = now.start === M.DRAGGED ? startKey(now) : `${now.start}:null:null`;
    if (now.start === M.DRAGGED) {
      /* the marker moved: one write through the data door restarts the walk */
      widgetApi.setParam("x0", now.x0);
      return;
    }
    if (!M.isDragged(now)) return;
    /* a named face was picked over a dragged marker: the pair goes, and the
       fourth face goes with it */
    widgetApi.setParam("y0", null);
    widgetApi.setParam("x0", null);
  });
}

/* The point a marker drag is measured from, captured when the gesture starts:
   `value` is handed pixel deltas and the parameter's own value may be unset
   until the first drag writes it. */
let grabbedFrom = null;

/* ============================== the widget ================================= */

widgetApi = defineWidget({
  slug: "optimizers",
  title: "Deep Learning - Optimizers",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* decision 2 in `model.js`: the rate strip exists under a scheduler, so the
     stage is taller there and the one geometry function says by how much */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* THE TWO HIDDEN COORDINATES COME FIRST, because `start`'s option list is
       a function of them and `resolveParams` reads the values it has resolved
       so far — a list that depends on another parameter needs that parameter
       declared before it. `null` is unset: the marker has not been dragged,
       so the named face decides where the walk begins. */
    x0: { type: "float", min: -4, max: 4, default: null, hidden: true },
    y0: { type: "float", min: -3, max: 3, default: null, hidden: true },

    /* Kenneth's order, round 1 (2026-09-11): the rule first, then where the
       walk starts, then the rate and its schedule. */
    optimizer: {
      type: "segmented",
      label: M.STRINGS.optimizerLabel,
      detail: M.STRINGS.optimizerDetail,
      options: M.OPTIMIZER_OPTIONS,
      default: "sgd",
    },
    /* momentum is a parameter of `optim.SGD` and not a rule of its own, so it
       sits under SGD and nowhere else (catalogue §7, pick A) */
    momentum: {
      type: "choice",
      label: M.STRINGS.momentumLabel,
      detail: M.STRINGS.momentumDetail,
      options: M.MOMENTUM_OPTIONS,
      default: "0",
      when: { param: "optimizer", equals: "sgd" },
    },
    walkSec: { type: "section", label: "The walk" },
    /* DECISION 5. Three named starts, each a claim, and a fourth face that
       exists only while the marker has been dragged off them. A `segmented`
       grid with every option spanning its own row: the mock measured all three
       names at the real 300px rail and two of them do not fit a half-width
       face. */
    start: {
      type: "segmented",
      label: M.STRINGS.startLabel,
      detail: M.STRINGS.startDetail,
      style: "grid",
      options: (values) => [
        ...M.STARTS.map((s) => ({
          value: s.value,
          label: s.label,
          detail: startDetail(s),
          span: true,
        })),
        ...(M.isDragged(values)
          ? [{
            value: M.DRAGGED,
            label: M.DRAGGED_LABEL,
            detail: `(${M.n2(values.x0)}, ${M.n2(values.y0)}); the point the marker was dragged to`,
            span: true,
          }]
          : []),
      ],
      optionsFrom: ["x0", "y0"],
      default: "beyond",
    },

    rateSec: { type: "section", label: "The learning rate" },
    lr: {
      type: "choice",
      label: M.STRINGS.lrLabel,
      detail: M.STRINGS.lrDetail,
      options: M.LR_OPTIONS,
      default: M.LR_DEFAULT,
    },

    scheduler: {
      type: "segmented",
      label: M.STRINGS.schedulerLabel,
      detail: M.STRINGS.schedulerDetail,
      style: "grid",
      options: M.SCHEDULER_OPTIONS,
      default: "none",
    },

    viewSec: { type: "section", label: "The view" },
    /* Display-only: the relief is a second reading of the map's own window, so
       switching mid-walk keeps the walk (3.2). */
    surface: {
      type: "segmented",
      label: M.STRINGS.surfaceLabel,
      options: M.SURFACE_OPTIONS,
      default: "map",
      display: true,
    },
    homeView: {
      type: "bool",
      style: "action",
      label: M.STRINGS.homeLabel,
      detail: M.STRINGS.homeDetail,
      default: false,
      display: true,
      when: { param: "surface", equals: "relief" },
    },
    /* THE VIEWPOINT, AS TWO PARAMETERS, written by the drag and carried in the
       link the way `shown` is. Display-only: turning the camera is a second
       reading of a walk already taken and must not discard it. */
    turn: { type: "int", min: 0, max: 359, default: RELIEF_AZ, hidden: true, display: true },
    tilt: { type: "int", min: 10, max: 85, default: RELIEF_EL, hidden: true, display: true },

    /* Kenneth's pick over drawing all four always (catalogue §3): every walk is
       computed whatever this says, so it draws what is already there and the
       walk does not reset (3.2). */
    compare: {
      type: "bool",
      label: M.STRINGS.compareLabel,
      detail: M.STRINGS.compareDetail,
      default: false,
      display: true,
    },

    speed: {
      type: "choice",
      label: M.STRINGS.speedLabel,
      options: M.SPEEDS,
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: steps already walked. */
    shown: { type: "int", min: 0, max: M.BUDGET, default: 0, hidden: true },
  },

  /* The legend names what is on the panel and nothing else, and the two marks
     that appear only under one setting are added only there (lm-interaction,
     2026-08-29). */
  legend: ({ params }) => [
    { token: "empirical", label: "The walk so far", mark: "line" },
    { token: "empirical", label: "The point the walk stands at", mark: "dot" },
    ...(M.choreographs(params.speed)
      ? [{ token: "slope", label: "The direction against the gradient, at a fixed length", mark: "line" }]
      : []),
    { token: "empirical", label: "The step the rule takes, to scale", mark: "line" },
    { token: "reference", label: "The global minimum", mark: "dot" },
    { token: "reference", label: "The local minimum", mark: "hollow" },
    { token: "highlight", label: "The start", mark: "hollow" },
    ...(params.compare
      ? [{ token: "ink-3", label: "The other methods' walks, from the same start", mark: "line" }]
      : []),
  ],

  /* pure and unseeded: the gradient is exact, so nothing here is random */
  compute: ({ params }) => M.computeFor(params),

  /* DECISION 4. Two gestures on one panel, told apart by which surface is on
     screen: the map moves the start marker, the relief turns the camera. All
     five parameters are returned every time, because core writes every one it
     was declared with and an absent key would write `undefined`. */
  drag: {
    params: ["start", "x0", "y0", "turn", "tilt"],
    cursor: "grab",
    hit: ({ x, y, w, params, state }) => {
      const L = M.layout(w, state.hasRate);
      const r = L.map;
      const inside = x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (!inside) return false;
      if (params.surface === "relief") {
        grabbedFrom = null;
        return true;
      }
      /* the marker's own handle, so a casual drag across the map does not
         move the start the reader chose */
      const [xd, yd] = M.TRENCH.range;
      const px = r.x + ((state.start[0] - xd[0]) / (xd[1] - xd[0])) * r.w;
      const py = r.y + r.h - ((state.start[1] - yd[0]) / (yd[1] - yd[0])) * r.h;
      if (Math.hypot(x - px, y - py) > HANDLE_PX) return false;
      grabbedFrom = [state.start[0], state.start[1]];
      return true;
    },
    value: ({ dx, dy, start: was, params, state, w }) => {
      if (params.surface === "relief") {
        return {
          ...was,
          /* half a degree a pixel, as widget 48: one drag across the panel
             turns the surface through most of a half circle. The azimuth wraps
             and the elevation stops short of straight down, where the painter's
             depth order stops meaning anything. */
          turn: ((Math.round(was.turn - dx * 0.5) % 360) + 360) % 360,
          tilt: Math.max(10, Math.min(85, Math.round(was.tilt + dy * 0.5))),
        };
      }
      const L = M.layout(w, state.hasRate);
      const [xd, yd] = M.TRENCH.range;
      const base = grabbedFrom ?? state.start;
      /* rounded to two decimals, so the link carries a place and not a float */
      const nx = Number(M.clampX(base[0] + (dx * (xd[1] - xd[0])) / L.map.w).toFixed(2));
      const ny = Number(M.clampY(base[1] - (dy * (yd[1] - yd[0])) / L.map.h).toFixed(2));
      return { ...was, start: M.DRAGGED, x0: nx, y0: ny };
    },
  },

  animation: {
    stepLabel: M.STRINGS.stepLabel,
    stepTitle: M.STRINGS.stepTitle,
    runLabel: M.STRINGS.runLabel,
    runTitle: M.STRINGS.runTitle,

    init: ({ params, state, fromScratch }) => {
      const k = fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.units);
      return { k, beat: 0, clock: M.stepMs(params.speed), done: k >= state.units };
    },

    advance: (anim, { dt, params, state }) => {
      const end = state.units;
      if (anim.k >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      /* ONE CLOCK FOR ALL THREE PACES, and the fraction is kept: a pace is a
         RATE, so a step slower than a frame has to carry the remainder into
         the next one. `model.js` says why the arrivals-only branch widget 48
         uses is wrong at 2.5 steps a second. Which pace CHOREOGRAPHS is
         declared there too (4.1), and `stand` is where it is read. */
      anim.beat += dt / M.stepMs(params.speed);
      if (anim.beat < 1) return true;
      const whole = anim.mode === "step" ? 1 : Math.floor(anim.beat);
      anim.beat = anim.mode === "step" ? 0 : anim.beat - whole;
      anim.k = Math.min(end, anim.k + whole);
      if (anim.k >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* A BEAT IN FLIGHT IS CLEARED WHENEVER THE BEAT LENGTH CHANGES. Leaving a
       choreographed speed would otherwise freeze a half-drawn arrow over a
       point the walk has already left — the shipped bug `before` states exist
       for. Cleared here rather than at the next advance, because a paused
       animation gets no next advance. */
    rebuild: (anim, { params, state }) => {
      if (params.homeView) homeTheView();
      anim.k = Math.min(anim.k, state.units);
      const ms = M.stepMs(params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
      anim.done = anim.k >= state.units;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params);
    syncStart(params);
    const L = M.layout(w, state.hasRate);
    const at = stand(state, params, anim);
    if (params.surface === "relief") drawRelief(ctx, colors, L.map, state, params, at);
    else drawMap(ctx, colors, L.map, state, params, at);
    drawPanel(ctx, colors, L.panel, at);

    /* The line under the map: what this beat of a Slow step is doing, or — at
       rest and at the other two paces — what one step is made of. */
    const said = at.choreographed
      ? (at.beat < M.BEATS.gradient
        ? `The gradient at this point is (${M.sig(at.g[0])}, ${M.sig(at.g[1])})`
        : at.beat < M.BEATS.step
          ? `The rule turns it into a step of (${M.sig(at.d[0])}, ${M.sig(at.d[1])})`
          : `The step moves the two parameters by ${M.sig(Math.hypot(at.d[0], at.d[1]))}`)
      : M.STRINGS.atRest;
    label(ctx, colors, said, L.map.x, L.beatY,
      { color: at.choreographed ? colors.highlight : colors.ink3, size: colors.fsSm });

    drawLossStrip(ctx, colors, L.loss, state, at);
    if (L.hasRate) drawRateStrip(ctx, colors, L.rate, state, at);
  },

  readout({ params, state, anim }) {
    const at = stand(state, params, anim);
    const w = state.mine;
    const dG = Math.hypot(at.cur[0] - M.TRENCH.G.x, at.cur[1] - M.TRENCH.G.y);
    const reachedHere = w.reached !== null && at.k >= w.reached;
    return [
      { label: "Step", value: String(at.k), note: `of ${M.BUDGET}` },
      {
        label: "Loss",
        value: M.n3(w.loss[at.k]),
        note: `the global minimum is ${M.n3(M.TRENCH.G.f)}`,
      },
      {
        label: "Learning rate",
        value: M.rateText(at.rate),
        note: state.hasRate ? "what the scheduler has left it at" : "the rate you set, unchanged",
      },
      {
        label: "Distance to the global minimum",
        value: M.n3(dG),
        note: reachedHere
          ? `reached the global minimum at step ${w.reached}`
          : `within ${M.REACH} counts as reached`,
      },
      {
        label: "The walk is",
        value: M.WHERE[whereAt(at.cur, at.gone)],
        note: "the well it is inside, or the plain between them",
      },
    ];
  },

  summary({ params, state, anim }) {
    const at = stand(state, params, anim);
    const w = state.mine;
    return `A ${params.surface === "relief" ? "relief" : "map"} of the loss over two parameters, `
      + `with a global minimum at (${M.n1(M.TRENCH.G.x)}, ${M.n1(M.TRENCH.G.y)}) and a shallower `
      + `local one at (${M.n1(M.TRENCH.L.x)}, ${M.n1(M.TRENCH.L.y)}). `
      + `${M.methodName(state.kind)} at learning rate ${state.lr} has taken ${at.k} of ${M.BUDGET} steps `
      + `from (${M.n1(state.start[0])}, ${M.n1(state.start[1])}) and stands `
      + `${M.WHERE[whereAt(at.cur, at.gone)]}, ${M.n3(Math.hypot(at.cur[0] - M.TRENCH.G.x, at.cur[1] - M.TRENCH.G.y))} `
      + `from the global minimum. Beneath, the loss after each step`
      + `${state.hasRate ? ", and the learning rate under it" : ""}.`
      + (w.reached !== null && at.k >= w.reached ? ` It reached the global minimum at step ${w.reached}.` : "");
  },
});

/** Which of the four places a position is in — the same test the engine's own
    outcome uses, asked at a partial walk rather than at the end (5.8). */
function whereAt(p, gone) {
  if (gone) return "gone";
  let best = null;
  let dist = M.NEAR;
  for (const m of M.TRENCH.minima) {
    const d = Math.hypot(p[0] - m.x, p[1] - m.y);
    if (d < dist) {
      dist = d;
      best = m.kind === "G" ? "global" : "local";
    }
  }
  return best ?? "plain";
}

/** A named start's own line: its coordinates and what it asks of the walk. */
function startDetail(s) {
  const g = Math.hypot(...M.TRENCH.grad(s.at[0], s.at[1]));
  if (s.value === "beyond") {
    return `(${s.at[0]}, ${s.at[1]}); the local well lies between here and the global one`;
  }
  if (s.value === "plain") return `(${s.at[0]}, ${s.at[1]}); the gradient is ${M.n2(g)}, a long flat walk`;
  return `(${s.at[0]}, ${s.at[1]}); the trench is steep across and shallow along`;
}
