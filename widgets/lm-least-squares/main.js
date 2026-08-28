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
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
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

/* Stage geometry, one place. The scatter always shows; the surface panel
   exists only while the gate is open, and the height function must agree
   with draw() about where everything sits. */
const SCATTER_H = 240;
const SURF_H = 190;
const SURF_TOP = 30 + SCATTER_H + 78;   // scatter, its axis labels, a gap
const H_CLOSED = 30 + SCATTER_H + 88;
const H_OPEN = SURF_TOP + SURF_H + 66;

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
  title: "Least Squares",
  status: "draft",
  subtitle:
    "We can propose a line for the data by choosing an intercept and a slope, " +
    "and score it by the sum of squared vertical differences. The " +
    "least-squares fit is the choice that makes this sum smallest — the " +
    "lowest point of a surface over every line you could draw.",
  layout: "side",
  height: ({ surface }) => (surface ? H_OPEN : H_CLOSED),

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
    /* The gate: the widget opens as a scatter and a held line, and the
       surface arrives when asked for. `display: true` — everything the
       surface shows is already computed; the gate only reveals it. */
    surface: {
      type: "gate",
      label: "Show every line at once",
      labelOff: "Hide the surface",
      detail: "the sum of squares over all (b₀, b₁) pairs — yours is one point on it",
      default: false,
      display: true,
    },
    /* Authoring escape hatch: segments of the walk already taken, first
       render only. A large value publishes the finished fit. */
    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study", mark: "dot" },
    { token: "highlight", label: "Your line, and its differences from the data", mark: "line" },
    { token: "reference", label: "The walk's line — the least-squares fit where it stops", mark: "line" },
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
    const cur = walked ? walkAt(state, anim.t).pt : null;

    /* --- the scatter and the held line --------------------------------- */
    const rect = { x: 56, y: 30, w: w - 56 - 14, h: SCATTER_H };
    const plot = makePlot({ ctx, colors, rect, xDomain: X_DOM, yDomain: Y_DOM });
    plot.axisX({ label: "BMI" });
    plot.axisY({ label: "sysBP (mmHg)" });
    plot.caption(`your line:  sysBP = ${fmt(state.b0, 0)} + ${fmt(state.b1, 2)} × BMI`);
    if (!walked) plot.note("every patient's vertical difference is squared and summed");

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    /* Every residual, faint: per-segment strokes so overlaps deepen — the
       wash's depth is where the misfit lives (Kenneth's pick over squares:
       nothing invented, every patient counted). Drawn under the dots. */
    ctx.strokeStyle = colors.highlight;
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i += 1) {
      const px = plot.sx(BMI[i]);
      ctx.beginPath();
      ctx.moveTo(px, plot.sy(SYSBP[i]));
      ctx.lineTo(px, plot.sy(state.b0 + state.b1 * BMI[i]));
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

    const lineAt = (b0, b1, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(plot.sx(X_DOM[0]), plot.sy(b0 + b1 * X_DOM[0]));
      ctx.lineTo(plot.sx(X_DOM[1]), plot.sy(b0 + b1 * X_DOM[1]));
      ctx.stroke();
    };
    if (cur) lineAt(cur[0], cur[1], colors.reference, 2.5);
    lineAt(state.b0, state.b1, colors.highlight, 2.5);
    ctx.restore();

    /* --- the surface, behind the gate ---------------------------------- */
    if (!params.surface) return;

    const srect = { x: 56, y: SURF_TOP, w: w - 56 - 14, h: SURF_H };
    const splot = makePlot({ ctx, colors, rect: srect, xDomain: SURF_B0, yDomain: SURF_B1 });
    splot.caption("every line at once — colour is its sum of squares");
    splot.axisX({ label: "intercept b₀" });
    splot.axisY({ label: "slope b₁" });
    splot.note(done
      ? "the walk stopped where no move improves the sum"
      : "red saturates at 3× the least possible sum");

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

    /* The walk so far: the path already taken, and the walker. */
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
      ctx.fillStyle = colors.ink1;
      ctx.beginPath();
      ctx.arc(splot.sx(cur[0]), splot.sy(cur[1]), 3.5, 0, 2 * Math.PI);
      ctx.fill();
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

    /* You are here: the reader's own line as a point among every line. */
    ctx.fillStyle = colors.highlight;
    ctx.beginPath();
    ctx.arc(splot.sx(state.b0), splot.sy(state.b1), 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },

  readout({ state, anim }) {
    const done = Boolean(anim?.done);
    return [
      {
        label: "Sum of squares — your line",
        value: ssFmt(state.ssYour),
        note: `b₀ ${fmt(state.b0, 0)}, b₁ ${fmt(state.b1, 2)}`,
      },
      {
        label: "Sum of squares — the fit",
        value: done ? ssFmt(SS_MIN) : "—",
        note: done
          ? `b₀ ${fmt(FIT_B0, 2)}, b₁ ${fmt(FIT_B1, 2)} — the least possible`
          : "press Fit to walk down to it",
      },
    ];
  },

  summary({ params, state, anim }) {
    const parts = [
      `A scatter of systolic blood pressure against BMI for 3547 Framingham patients, with the line sysBP = ${fmt(state.b0, 0)} + ${fmt(state.b1, 2)} × BMI drawn through it.`,
      `Its sum of squared differences is ${ssFmt(state.ssYour)}.`,
    ];
    if (params.surface) {
      parts.push("Below, the sum of squares is painted over every (b₀, b₁) pair.");
    }
    if (anim?.done) {
      parts.push(`The walk downhill stopped at b₀ ${fmt(FIT_B0, 2)}, b₁ ${fmt(FIT_B1, 2)}, the least-squares fit.`);
    }
    return parts.join(" ");
  },
});
