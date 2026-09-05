/* ============================================================================
   Widget 27 · Least Squares — the line, the sum, the surface.

   PHM5003 05-01 (Modeling — Single Covariate). The misconception: the fitted
   line is a formula's output. The notebook's own cure is the widget: pick b0
   and b1 by hand, watch the sum of squares, then see the fitted line as the
   MINIMUM of a surface over every line you could have drawn.

   THE DATA IS THE NOTEBOOK'S OWN and never changes — data.js is generated
   from framingham.csv with 05-01 cell 2's exact frame (BPMeds==0, complete
   cases, n = 3547), and model.js reproduces every stored output to the digit
   (`node widgets/_lab/lm-measure.mjs`, 18 checks). There is no seed and no
   rng: nothing here is random.

   Kenneth's six picks, 2026-08-28, from `_lab/lm-stage.html`: the surface
   sits BELOW the scatter behind a gate (C-behind-a-gate); the line is held by
   b0/b1 SLIDERS (the notebook's own `c(b0, b1)`); Fit reveals THE WALK — a
   descent path, not a snap; the surface is CAPPED AT 3x the minimum (a linear
   scale washes the whole teaching range into one band — the flat mean line is
   only 10.6% above the minimum, and that gap IS R2); the misfit is EVERY
   RESIDUAL, faint; axes hold the FULL data range (every patient on stage).

   The walk is coordinate descent from the reader's own line — exact 1-D
   minimisations, b0 then b1 — because its two opening moves are legible and
   its long crawl along the 13:1 trench is itself the teaching: many lines are
   nearly as good, which is why the slider can never quite find the bottom.

   THE WALK IS NOT WHAT R RUNS, AND THE COPY MUST NEVER SAY IT IS (Kenneth's
   round-3 question). 05-01's `optim` is Nelder-Mead — a tumbling simplex,
   illegible at widget scale — and `lm()` walks nowhere: it solves the normal
   equations in closed form. Nothing takes the shortest route (a straight
   line to the minimum needs the answer first). Coordinate descent is drawn
   because each move is statable in one sentence — "hold one, move the other
   to its best value" — and the on-screen copy claims exactly that and only
   that. The teaching (the fit is the surface's minimum, findable by walking
   downhill) is algorithm-independent.

   Round 3 also KEPT THE ROW LAYOUT (surface beside the scatter, height
   constant, the surface nearly square — which helps the trench read) and
   deleted the A/B param, and reframed the widget as LINEAR MODEL + FITTING:
   the model is the arc's central theme, this widget is its fitting chapter.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import { ols, ssQuad } from "./model.js";
import { N, BMI, SYSBP } from "./data.js";

/* The data never changes, so the fit and the SS quadratic are module facts.
   ssQuad is the O(1) closed form of 05-01's sum_squares — spot-checked
   against the loop form by lm-measure.mjs, not trusted. */
const FIT = ols(SYSBP, BMI);
const Q = ssQuad(BMI, SYSBP);
const SS_MIN = FIT.ssRes;
const [FIT_B0, FIT_B1] = FIT.b;

/* Fixed axes: the full data range, padded to round numbers (BMI 15.5-56.8,
   sysBP 83.5-295). Fixed rather than data-driven because the data is fixed —
   and a frame that never moves is what lets the reader watch only the line. */
const X_DOM = [14, 58];
const Y_DOM = [80, 300];
const SURF_B0 = [0, 150];   // the notebook's own grid, cell 15
const SURF_B1 = [0, 5];

/* Stage geometry, one place. The scatter always shows; opening the gate
   splits the width with the surface BESIDE it (Kenneth's round-3 pick over
   the stack: height never moves, and the near-square surface panel is the
   aspect the trench reads best at). Round 8 added the RESIDUAL STRIP under
   the scatter — permanent, Kenneth's pick B — so the page grew once, for
   every state. The strip shares the scatter's BMI axis (each patient's
   residual directly below its dot; the notebook's residual-vs-fitted axes
   are affine-identical for one covariate) and carries the x-axis for both. */
const SCATTER_H = 240;
const STRIP_TOP = 30 + SCATTER_H + 14;
const STRIP_H = 80;
const HEIGHT = STRIP_TOP + STRIP_H + 62;

/* The walk: coordinate descent from (b0, b1), each vertex one exact 1-D
   minimisation. Stops when a full cycle moves less than a pixel could show.
   The exact minimum is appended so the walk ENDS at the answer rather than
   epsilon short of it. */
function descentPath(b0, b1) {
  const path = [[b0, b1]];
  for (let i = 0; i < 400; i += 1) {
    const nb0 = (Q.Sy - b1 * Q.Sx) / Q.n;
    if (Math.abs(nb0 - b0) > 0.01) path.push([nb0, b1]);
    const nb1 = (Q.Sxy - nb0 * Q.Sx) / Q.Sxx;
    if (Math.abs(nb1 - b1) > 0.0005) path.push([nb0, nb1]);
    if (Math.abs(nb0 - b0) <= 0.01 && Math.abs(nb1 - b1) <= 0.0005) break;
    b0 = nb0;
    b1 = nb1;
  }
  path.push([FIT_B0, FIT_B1]);
  return path;
}

/* Per-segment durations: the two opening moves get a beat each, the crawl
   shares a fixed budget — so a long crawl decelerates (equal time, shrinking
   moves) and the whole walk is bounded near four seconds from any start. */
function walkSchedule(path) {
  const durs = [];
  const rest = Math.max(1, path.length - 3);
  for (let i = 0; i < path.length - 1; i += 1) {
    durs.push(i < 2 ? 700 : 2600 / rest);
  }
  const cum = [0];
  for (const d of durs) cum.push(cum[cum.length - 1] + d);
  return { durs, cum, total: cum[cum.length - 1] };
}

/* Where the walk currently stands: fractional position along the path. */
function walkAt(state, t) {
  const { cum, durs } = state.sched;
  const { path } = state;
  if (t <= 0) return { pt: path[0], seg: 0 };
  if (t >= state.sched.total) return { pt: path[path.length - 1], seg: path.length - 1 };
  let k = 0;
  while (k < durs.length - 1 && cum[k + 1] <= t) k += 1;
  const f = (t - cum[k]) / durs[k];
  const [a0, a1] = path[k];
  const [b0, b1] = path[k + 1];
  return { pt: [a0 + (b0 - a0) * f, a1 + (b1 - a1) * f], seg: k };
}

/* --- the equation, over the figure, in the lesson's own notation ----------
   Kenneth's round-2 ask: the formula should be WRITTEN the way 05-01 writes
   the lm equation, not painted as caption text. Widget 14's machinery,
   verbatim: probe that MathML actually lays out (an interface test lies),
   mount `.w-math` lazily from draw() because module scope runs before the
   shell exists, and memoise on the numbers. */
const MATHML = mathmlRenders();

const eqMathML = (b0, b1) =>
  `<math><mrow><mi>sysBP</mi><mo>=</mo><mn>${Number(b0).toFixed(b0 === Math.round(b0) ? 0 : 2)}</mn>`
  + `<mo>+</mo><mn>${Number(b1).toFixed(2)}</mn><mo>&#xD7;</mo><mi>BMI</mi></mrow></math>`;
const eqPlain = (b0, b1) =>
  `sysBP = ${Number(b0).toFixed(b0 === Math.round(b0) ? 0 : 2)} + ${Number(b1).toFixed(2)} × BMI`;

/* The generic form leads the card — 05-01's own order (cell 5 states
   y = b0 + b1 x before any numbers exist), and it is what names b0 and b1
   for a reader who arrives without the lesson (Kenneth, round 6). */
const GENERIC_MATHML =
  "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
  + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><mi>x</mi></mrow></math>";
const GENERIC_PLAIN = "y = b₀ + b₁x";

let mathHost = null;
let mathKey = null;
function renderEquation(b0, b1, done) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = `${b0},${b1},${done}`;
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const generic = `<span style="color:var(--ink-2)">${MATHML ? GENERIC_MATHML : GENERIC_PLAIN}</span>`;
  const yours = MATHML ? eqMathML(b0, b1) : eqPlain(b0, b1);
  const fit = MATHML ? eqMathML(FIT_B0, FIT_B1) : eqPlain(FIT_B0, FIT_B1);
  mathHost.innerHTML = done
    ? row("the model", generic) + row("your model", yours)
      + row("least-squares fit", `<span style="color:var(--c-empirical)">${fit}</span>`)
    : row("the model", generic) + row("your model", yours);
}

const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/* The surface, painted once per size and theme and blitted every frame —
   ~10k O(1) evaluations, but not 10k fillRects per animation frame. Capped
   at 3x the minimum: the whole ramp spent inside the range a held line
   actually visits (measured: the notebook grid spans 44.5x, and everything a
   reader would keep sits under 3x). */
let surfCache = null;
function surfaceBitmap(wpx, hpx, colors) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}`;
  if (surfCache && surfCache.key === key) return surfCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const b0 = SURF_B0[0] + (px / wpx) * (SURF_B0[1] - SURF_B0[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const b1 = SURF_B1[1] - (py / hpx) * (SURF_B1[1] - SURF_B1[0]);
      const t = (Q.ss(b0, b1) / SS_MIN - 1) / 2;
      c.fillStyle = hexLerp(colors.costLow, colors.costHigh, Math.max(0, Math.min(1, t)));
      c.fillRect(px, py, CELL, CELL);
    }
  }
  surfCache = { key, canvas: cv };
  return cv;
}

const ssOf = (b0, b1) => Q.ss(b0, b1);
const ssFmt = (v) => Math.round(v).toLocaleString("en-US");

defineWidget({
  slug: "lm-least-squares",
  title: "Fitting a Linear Model",
  status: "shipped",
  subtitle:
    "A linear model describes the outcome as an intercept plus a slope " +
    "times the covariate: y = b₀ + b₁x. Fitting it is a search: score any " +
    "candidate line by its sum of squared vertical differences, and take " +
    "the choice that makes the sum smallest over a grid of every line you " +
    "could draw.",
  layout: "side",
  height: HEIGHT,

  params: {
    /* The rail is flat: there is no choice of data to head a section with —
       the sample is 05-01's own and nothing here is random. Both sliders are
       DATA parameters: they change what the sum is, and moving one abandons
       a walk in progress, which is the honest reading (it was a walk from a
       line the reader no longer holds). */
    b0: {
      type: "float",
      label: "Intercept b₀",
      min: 0,
      max: 150,
      step: 1,
      default: 70,
      detail: "where the line meets BMI = 0",
    },
    b1: {
      type: "float",
      label: "Slope b₁",
      min: 0,
      max: 5,
      step: 0.05,
      default: 2,
      detail: "mmHg of sysBP per unit of BMI",
    },
    /* The gate: the widget opens as a scatter and a held line, and the grid
       arrives when asked for. "Grid" is 05-01's own word for this object
       (cell 14: "a grid of b0 and b1 values" — the notebook never says
       surface; Kenneth, round 5). `display: true` — everything the grid
       shows is already computed; the gate only reveals it. */
    grid: {
      type: "gate",
      label: "Show every line at once",
      labelOff: "Hide the grid",
      detail: "a grid of every (b₀, b₁) pair, coloured by its sum of squares",
      /* Open by default — Kenneth's round-8 call. The minimum is still
         unmarked until the walk finds it, so the widget does not open on
         its answer; the gate remains for a reader who wants the scatter
         alone at full width. */
      default: true,
      display: true,
    },
    /* Authoring escape hatch: segments of the walk already taken, first
       render only. A large value publishes the finished fit. */
    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study", mark: "dot" },
    { token: "highlight", label: "Your model's line, and its differences from the data", mark: "line" },
    { token: "empirical", label: "The colour the line takes when the walk reaches the least-squares fit", mark: "line" },
  ],

  compute({ params }) {
    const b0 = params.b0;
    const b1 = params.b1;
    const path = descentPath(b0, b1);
    return {
      b0,
      b1,
      ssYour: ssOf(b0, b1),
      path,
      sched: walkSchedule(path),
    };
  },

  animation: {
    stepLabel: "Step downhill",
    stepTitle: "hold one of b₀ and b₁, and move the other to its best value",
    runLabel: "Fit",
    runTitle: "walk downhill until no move improves the sum",
    init: ({ state, params, fromScratch }) => {
      const t = !fromScratch && params.shown > 0
        ? state.sched.cum[Math.min(params.shown, state.sched.cum.length - 1)]
        : 0;
      return { t, done: t >= state.sched.total };
    },
    advance: (anim, { dt, state }) => {
      if (anim.mode === "step") {
        /* One exact minimisation per press: jump to the next vertex. */
        const { seg } = walkAt(state, anim.t);
        const next = anim.t <= 0 ? 1 : seg + (anim.t > state.sched.cum[seg] ? 2 : 1);
        anim.t = state.sched.cum[Math.min(next, state.sched.cum.length - 1)];
        anim.done = anim.t >= state.sched.total;
        return false;
      }
      anim.t += dt;
      if (anim.t >= state.sched.total) {
        anim.t = state.sched.total;
        anim.done = true;
        return false;
      }
      return true;
    },
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const walked = (anim?.t ?? 0) > 0;
    const done = Boolean(anim?.done);
    /* ONE LINE, and the walk moves IT (Kenneth's round 2): before the walk it
       is the reader's line; during, it travels; at the end it IS the fit and
       says so by changing colour. The wash and the surface dot ride along —
       the wash visibly thinning as the line descends is the sum falling. */
    /* The finished line wears --c-empirical — the audited role for a FIT the
       reader built from the data. It was --c-reference first, which aliases
       the same ink-3 grey as the 3547 --c-unknown dots, so the one line the
       whole widget walks toward arrived invisible (Kenneth, round 4). */
    const cur = walked ? walkAt(state, anim.t).pt : [state.b0, state.b1];
    const lineColor = done ? colors.empirical : colors.highlight;
    renderEquation(state.b0, state.b1, done);

    /* --- the scatter and the line -------------------------------------- */
    /* Gate shut: the scatter has the whole width. Gate open: it cedes the
       right half to the surface and the height never moves. */
    const rect = params.grid
      ? { x: 56, y: 30, w: Math.round((w - 70) * 0.52), h: SCATTER_H }
      : { x: 56, y: 30, w: w - 56 - 14, h: SCATTER_H };
    const plot = makePlot({ ctx, colors, rect, xDomain: X_DOM, yDomain: Y_DOM });
    /* No x-axis here: the residual strip below shares this BMI axis and
       carries the ticks and label for both panels. */
    plot.axisY({ label: "sysBP (mmHg)" });

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    /* Every residual, faint: per-segment strokes so overlaps deepen — the
       wash's depth is where the misfit lives (Kenneth's pick over squares:
       nothing invented, every patient counted). Drawn under the dots. */
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i += 1) {
      const px = plot.sx(BMI[i]);
      ctx.beginPath();
      ctx.moveTo(px, plot.sy(SYSBP[i]));
      ctx.lineTo(px, plot.sy(cur[0] + cur[1] * BMI[i]));
      ctx.stroke();
    }
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = colors.unknown;
    for (let i = 0; i < N; i += 1) {
      ctx.beginPath();
      ctx.arc(plot.sx(BMI[i]), plot.sy(SYSBP[i]), 1.7, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(plot.sx(X_DOM[0]), plot.sy(cur[0] + cur[1] * X_DOM[0]));
    ctx.lineTo(plot.sx(X_DOM[1]), plot.sy(cur[0] + cur[1] * X_DOM[1]));
    ctx.stroke();
    ctx.restore();

    /* --- the residual strip, permanent (round 8, Kenneth's pick B) -------
       The DOTS are the whole story (round 9: no trend line — Kenneth wants
       the cloud itself seen settling around the centre): each dot is that
       patient's residual from the current line, so the band sits OFF ZERO
       when b₀ is wrong, TILTS when b₁ is wrong, and settles around the
       ruled zero as the walk lands. The y-window is deliberately tight —
       at ±(50..70) a 10 mmHg offset is ~7px of visible drift; the wide
       window that fit every absurd line made the motion invisible, which
       defeated the strip. Dots a bad line pushes past the frame are
       clipped, and that is an honest reading. */
    const strip = { x: rect.x, y: STRIP_TOP, w: rect.w, h: STRIP_H };
    const rplot = makePlot({ ctx, colors, rect: strip, xDomain: X_DOM, yDomain: [-50, 70] });
    rplot.axisX({ label: "BMI" });
    rplot.axisY({ label: "residual", ticks: [-40, 0, 40] });
    ctx.strokeStyle = colors.ink3;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(strip.x, rplot.sy(0));
    ctx.lineTo(strip.x + strip.w, rplot.sy(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(strip.x, strip.y, strip.w, strip.h);
    ctx.clip();
    ctx.fillStyle = colors.unknown;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < N; i += 1) {
      ctx.beginPath();
      ctx.arc(rplot.sx(BMI[i]), rplot.sy(SYSBP[i] - cur[0] - cur[1] * BMI[i]), 1.4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* --- the surface, behind the gate ---------------------------------- */
    if (!params.grid) return;

    const srect = { x: rect.x + rect.w + 56, y: 30, w: w - (rect.x + rect.w + 56) - 14, h: SCATTER_H };
    const splot = makePlot({ ctx, colors, rect: srect, xDomain: SURF_B0, yDomain: SURF_B1 });
    splot.caption("every line at once");
    splot.axisX({ label: "intercept b₀" });
    splot.axisY({ label: "slope b₁" });

    const dpr = window.devicePixelRatio || 1;
    ctx.drawImage(
      surfaceBitmap(Math.round(srect.w * dpr), Math.round(srect.h * dpr), colors),
      srect.x, srect.y, srect.w, srect.h,
    );
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(srect.x, srect.y, srect.w, srect.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(srect.x, srect.y, srect.w, srect.h);
    ctx.clip();

    /* The walk so far: the path already taken behind the travelling dot. */
    if (walked) {
      const { seg } = walkAt(state, anim.t);
      ctx.strokeStyle = colors.ink1;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(splot.sx(state.path[0][0]), splot.sy(state.path[0][1]));
      for (let k = 1; k <= seg; k += 1) {
        ctx.lineTo(splot.sx(state.path[k][0]), splot.sy(state.path[k][1]));
      }
      ctx.lineTo(splot.sx(cur[0]), splot.sy(cur[1]));
      ctx.stroke();
    }

    /* The minimum is MARKED only once the walk has found it — the widget
       does not open on its own answer (non-negotiable 4). */
    if (done) {
      ctx.strokeStyle = colors.ink1;
      ctx.lineWidth = 1.5;
      const cx = splot.sx(FIT_B0);
      const cy = splot.sy(FIT_B1);
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy);
      ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx, cy + 7);
      ctx.stroke();
    }

    /* The line as a point among every line — the same dot the scatter's line
       is, so it travels with the walk and lands wearing the fit's colour.
       The ring is heavy because the landed dot is empirical blue on the
       trench's cost-low blue: the ring is what separates them. */
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(splot.sx(cur[0]), splot.sy(cur[1]), 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    /* The colour scale, in place of any sentence about the ramp (Kenneth,
       round 4): a bar under the surface from 1x to 3x the least sum, the
       cap shown rather than said. */
    const bar = { x: srect.x, y: srect.y + srect.h + 46, w: srect.w, h: 8 };
    const STEPS = 48;
    for (let i = 0; i < STEPS; i += 1) {
      ctx.fillStyle = hexLerp(colors.costLow, colors.costHigh, i / (STEPS - 1));
      ctx.fillRect(bar.x + (i / STEPS) * bar.w, bar.y, bar.w / STEPS + 1, bar.h);
    }
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText("1×", bar.x, bar.y + bar.h + 13);
    ctx.textAlign = "right";
    ctx.fillText("≥3×", bar.x + bar.w, bar.y + bar.h + 13);
    if (bar.w >= 220) {
      ctx.textAlign = "center";
      ctx.fillText("sum of squares, × the least possible", bar.x + bar.w / 2, bar.y + bar.h + 13);
    }
  },

  readout({ state, anim }) {
    const done = Boolean(anim?.done);
    const walked = (anim?.t ?? 0) > 0;
    const cur = walked ? walkAt(state, anim.t).pt : null;
    return [
      {
        label: "Sum of squares — your model",
        value: ssFmt(state.ssYour),
        note: `b₀ ${fmt(state.b0, 0)}, b₁ ${fmt(state.b1, 2)}`,
      },
      {
        label: "Sum of squares — the fit",
        value: done ? ssFmt(SS_MIN) : walked ? ssFmt(ssOf(cur[0], cur[1])) : "—",
        note: done
          ? `b₀ ${fmt(FIT_B0, 2)}, b₁ ${fmt(FIT_B1, 2)} — the least possible`
          : walked
            ? `walking — b₀ ${fmt(cur[0], 1)}, b₁ ${fmt(cur[1], 2)}`
            : "press Fit to walk down to it",
      },
      /* R² from the two sums already on stage: SS at the fit is the residual
         sum, SS at the flat mean line (b₁ = 0) is the total — so the tile is
         05-01's goodness-of-fit section computed from what the reader has
         watched. Kenneth's round 7; the note is widget 26's R² wording. */
      {
        label: "R²",
        value: done ? fmt(FIT.r2, 2) : "—",
        note: done
          ? "variance explained by the model — 1 − fit ⁄ flat-line sums"
          : "revealed with the fit",
      },
    ];
  },

  summary({ params, state, anim }) {
    const parts = [
      `A scatter of systolic blood pressure against BMI for 3547 Framingham patients, with the linear model sysBP = ${fmt(state.b0, 0)} + ${fmt(state.b1, 2)} × BMI drawn through it.`,
      `Its sum of squared differences is ${ssFmt(state.ssYour)}.`,
      "Below the scatter, each patient's residual from the line, around a ruled zero.",
    ];
    if (params.grid) {
      parts.push("Beside it, the sum of squares is painted over every (b₀, b₁) pair.");
    }
    if (anim?.done) {
      parts.push(`The walk downhill stopped at b₀ ${fmt(FIT_B0, 2)}, b₁ ${fmt(FIT_B1, 2)}, the least-squares fit.`);
    }
    return parts.join(" ");
  },
});
