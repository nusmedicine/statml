/* ============================================================================
   Widget 26 · Causal Structures — fork, pipe, collider.

   PHM5003 06-02 (Modeling for Explanation). One interaction: fit the obvious
   model, then adjust for the third variable, and watch what the STRUCTURE
   does to the estimate — a fork's bias is removed, a pipe's real effect is
   erased, a collider's "effect" is manufactured. The three generative models
   are the notebook's own, verbatim, in model.js; every number on screen is a
   fit of the visible sample.

   n IS FIXED AT 1000 AND HAS NO CONTROL, and that is measured, not taste
   (`_lab/causal-measure.mjs`, 200 seeds): the fork's adjusted effect (+0.1,
   SE ≈ 1/√n) clears significance 32% of the time at n = 200 and 87% at
   n = 1000. A smaller, prettier n would teach "adjusting made it go away" —
   the opposite of the lesson. The sign FLIP is 100% at every n; only the
   star wavers, which is why the readout carries the CI and not a star.

   Stage: DAG on the left, scatter on the right (Kenneth's pick, candidate A
   with the DAG beside it — `_lab/causal-stage.html`). The one animation is
   widget 12's ease, for widget 12's reason: the adjusted line SWINGS from the
   unadjusted slope to its own, so the samples are seen not to move while the
   model changes — a jump would only assert it. No drive buttons; the drive
   row is Reset alone.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { tTailP } from "../core/stats.js";
import { ols, STRUCTURES } from "./model.js";

const N = 1000;
const EASE_MS = 450;

/* Interpolate two token colours for the continuous third variables (age, HR).
   The collider's ICU is binary and gets the endpoints exactly. */
function hexLerp(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* THE DAG'S GEOMETRY, ONCE — draw() paints it and regions() makes the third
   variable's node a click target, and two copies of this arithmetic is how
   the target ends up six columns from the node (the fingerprint section's
   own incident). */
function dagLayout(w, h) {
  const DAG_W = Math.max(168, Math.min(200, w * 0.32));
  const dag = { x: 6, y: 30, w: DAG_W, h: h - 90 };
  const R = 21;
  return {
    dag,
    R,
    P: {
      z: [dag.x + dag.w / 2, dag.y + 26],
      x: [dag.x + 34, dag.y + dag.h - 26],
      y: [dag.x + dag.w - 34, dag.y + dag.h - 26],
    },
  };
}

/* One place for every on-screen name, per structure. */
const NAMES = {
  fork: { x: "smoking", y: "COPD", z: "age" },
  pipe: { x: "exercise", y: "sysBP", z: "HR" },
  collider: { x: "DKA", y: "AMI", z: "ICU" },
};

/* The verdict line under the DAG — the notebook's own diagnosis, one claim
   per state. It names the mechanism, not a moral (2.9). */
const VERDICT = {
  fork: {
    off: "the path through age is open",
    on: "adjusting for age closes it",
  },
  pipe: {
    off: "the effect travels through HR",
    on: "adjusting for HR blocks the effect itself",
  },
  collider: {
    off: "the path through ICU is closed",
    on: "adjusting for ICU opens it",
  },
};

/* Edge status per structure and adjust state. "open" is a non-causal path
   standing open (warning-coloured); "blocked" is faded; "plain" is a causal
   arrow. The pipe's adjusted chain is BLOCKED — the verdict line, not a
   colour, says that blocking it was the mistake. */
function edgeStatus(structure, adjusted) {
  if (structure === "fork") {
    return [
      ["z", "x", adjusted ? "blocked" : "open"],
      ["z", "y", adjusted ? "blocked" : "open"],
      ["x", "y", "plain"],
    ];
  }
  if (structure === "pipe") {
    return [
      ["x", "z", adjusted ? "blocked" : "plain"],
      ["z", "y", adjusted ? "blocked" : "plain"],
    ];
  }
  return [
    ["x", "z", adjusted ? "open" : "plain"],
    ["y", "z", adjusted ? "open" : "plain"],
  ];
}

/* Padded nice domain from data — the axes follow the sample, as the cluster
   widgets' stages do. */
function padDomain(xs) {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const pad = (hi - lo) * 0.06 || 1;
  return [lo - pad, hi + pad];
}

/* The collider's DKA and AMI are squared normals — a heavy right tail, so a
   min-to-max window crushed 95% of the patients into the corner (Kenneth,
   round 3). The frame stops at the 99th percentile instead, and the caption
   counts what is past it; the FITS still use every patient — the window is
   where you look, not what the model saw. */
function tailDomain(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const hi = s[Math.floor(0.99 * (s.length - 1))];
  return [0, hi * 1.08];
}

const meanOf = (xs) => xs.reduce((a, v) => a + v, 0) / xs.length;

defineWidget({
  slug: "fork-pipe-collider",
  title: "Causal Structures",
  subtitle:
    "Whether to adjust for a covariate is a causal question, not a statistical " +
    "one. Drawing the covariates as a graph answers it: adjusting closes the " +
    "open path in a fork, blocks the effect itself in a pipe, and opens a " +
    "closed path in a collider.",
  layout: "side",
  height: 370,
  status: "draft",

  params: {
    /* TWO BLOCKS, the collection's data/algorithm shape. The structure is the
       data choice: it picks which of the notebook's three generative models
       drew the sample. */
    data: { type: "section", label: "The data" },
    structure: {
      type: "segmented",
      label: "Structure",
      options: [
        { value: "fork", label: "Fork", detail: "age drives both smoking and COPD" },
        { value: "pipe", label: "Pipe", detail: "exercise raises heart rate; heart rate raises blood pressure" },
        { value: "collider", label: "Collider", detail: "DKA and AMI each send patients to the ICU" },
      ],
      default: "fork",
    },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "draws a fresh 1000 patients",
    },
    /* The reveal, in the arc's one position: after Seed. The simulation's
       true effect is what the models are checked against, and it is withheld
       until asked for (non-negotiable 4 applied to knowledge). */
    truth: {
      type: "segmented",
      label: "True effect",
      options: [
        { value: "off", label: "Off", detail: "what would you conclude from the fits alone?" },
        { value: "on", label: "On", detail: "the effect the simulation was built with" },
      ],
      default: "off",
      display: true,
    },
    /* The third variable, made visible on the scatter — the clue to WHY
       adjusting moves the fit: in a fork the colour runs along the slope, in
       a collider the two colours hold the two tilted clouds. Kenneth's ask,
       review round 2. */
    colour: {
      type: "segmented",
      label: "Colour by the third variable",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On", detail: "each patient tinted by the variable the model may adjust for" },
      ],
      default: "off",
      display: true,
    },

    model: { type: "section", label: "The model" },
    /* The gate opens the modelling stage: the widget starts as data and a
       question. `display: true` — compute fits both models regardless; the
       gate only reveals them. */
    fit: {
      type: "gate",
      label: "Fit the model",
      labelOff: "Clear the fits",
      detail: "least squares of the outcome on the exposure",
      display: true,
    },
    adjust: {
      type: "segmented",
      label: "Adjust for the third variable",
      options: [
        { value: "off", label: "Off", detail: "the exposure alone" },
        { value: "on", label: "On", detail: "add the third variable to the model" },
      ],
      default: "off",
      display: true,
      when: { param: "fit" },
    },
  },

  /* True with everything off and on — core takes the legend once. */
  legend: [
    { token: "unknown", label: "1000 simulated patients", mark: "dot" },
    { token: "nonevent", label: "Third variable low — for the ICU, not admitted", mark: "dot" },
    { token: "event", label: "Third variable high — for the ICU, admitted", mark: "dot" },
    { token: "empirical", label: "The unadjusted fit", mark: "line" },
    { token: "highlight", label: "The adjusted fit", mark: "line" },
    { token: "reference", label: "The true effect, revealed on request", mark: "line" },
    { token: "extreme", label: "A non-causal path standing open", mark: "line" },
  ],

  compute({ params, rng }) {
    const structure = params.structure;
    const spec = STRUCTURES[structure];
    const d = spec.make(rng, N);
    const unadj = ols(d.y, [d.x], tTailP);
    const adj = ols(d.y, [d.x, d.z], tTailP);
    /* Colour scale for the third variable: 5th to 95th percentile, clamped,
       so one tail draw does not wash every other patient to one end. */
    const zs = [...d.z].sort((a, b) => a - b);
    const zLo = zs[Math.floor(0.05 * (N - 1))];
    const zHi = zs[Math.floor(0.95 * (N - 1))];
    const skewed = structure === "collider";
    const xDom = skewed ? tailDomain(d.x) : padDomain(d.x);
    const yDom = skewed ? tailDomain(d.y) : padDomain(d.y);
    let beyond = 0;
    if (skewed) {
      for (let i = 0; i < N; i += 1) {
        if (d.x[i] > xDom[1] || d.y[i] > yDom[1]) beyond += 1;
      }
    }
    return {
      structure,
      d,
      unadj,
      adj,
      truth: spec.truth,
      meanZ: meanOf(d.z),
      meanX: meanOf(d.x),
      meanY: meanOf(d.y),
      xDom,
      yDom,
      beyond,
      zLo,
      zHi: zHi === zLo ? zLo + 1 : zHi,
    };
  },

  /* WIDGET 12'S EASE, NOT A DRIVE. `stepLabel: null` and `runLabel: null`
     decline the buttons (4.5) — there is nothing to step, and the drive row
     is Reset alone. The one motion is the adjusted line swinging between the
     unadjusted slope and its own when the model changes: two readings of the
     SAME data, and easing between them is what shows the samples not moving
     (widget 12's rationale, verbatim). A data change resets `init` and lands
     instantly — new samples are a new picture, and nothing eases across it. */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => {
      const m = params.fit && params.adjust === "on" ? 1 : 0;
      return { mix: m, mixT: m, easing: false, done: false };
    },
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      const gap = anim.mixT - anim.mix;
      if (Math.abs(gap) < 0.004) {
        anim.mix = anim.mixT;
        return false;
      }
      anim.mix += gap * rate;
      return true;
    },
    rebuild: (anim, { params }) => {
      anim.mixT = params.fit && params.adjust === "on" ? 1 : 0;
      if (Math.abs(anim.mixT - anim.mix) > 0.004) anim.easing = true;
    },
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const names = NAMES[state.structure];
    const adjusted = params.fit && params.adjust === "on";
    const mix = anim?.mix ?? (adjusted ? 1 : 0);

    /* --- DAG panel, left ------------------------------------------------- */
    const { dag, P, R } = dagLayout(w, h);
    const DAG_W = dag.w;

    ctx.save();
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("The structure", dag.x, dag.y - 10);

    const arrow = (from, to, color, width, dash) => {
      const [x1, y1] = P[from];
      const [x2, y2] = P[to];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / L;
      const uy = (y2 - y1) / L;
      const ax = x1 + ux * (R + 3);
      const ay = y1 + uy * (R + 3);
      const bx = x2 - ux * (R + 6);
      const by = y2 - uy * (R + 6);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx + ux * 6, by + uy * 6);
      ctx.lineTo(bx - uy * 4.5, by + ux * 4.5);
      ctx.lineTo(bx + uy * 4.5, by - ux * 4.5);
      ctx.fill();
    };

    for (const [from, to, status] of edgeStatus(state.structure, adjusted)) {
      if (status === "open") arrow(from, to, colors.extreme, 2.5);
      else if (status === "blocked") arrow(from, to, colors.ink3, 1.25, [4, 4]);
      else arrow(from, to, colors.ink2, 1.75);
    }

    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of ["z", "x", "y"]) {
      const [nx, ny] = P[k];
      const isAdj = k === "z" && adjusted;
      ctx.fillStyle = colors.surface;
      ctx.strokeStyle = isAdj ? colors.ink1 : colors.ink3;
      ctx.lineWidth = isAdj ? 2 : 1;
      ctx.beginPath();
      /* ggdag's convention: the adjusted node wears a box. */
      if (isAdj) ctx.rect(nx - R - 2, ny - R + 6, 2 * R + 4, 2 * R - 12);
      else ctx.arc(nx, ny, R, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.ink1;
      ctx.fillText(names[k], nx, ny + 1);
    }

    /* The verdict: what this adjust state does to the paths. LEFT-ALIGNED at
       the DAG's edge, not centred under it — the pipe's line is ~190px and a
       centred draw clips inside the 176px panel at the 550px side canvas;
       left-aligned it runs into the margin before the scatter begins. */
    const verdict = VERDICT[state.structure][adjusted ? "on" : "off"];
    ctx.fillStyle = params.fit && (adjusted !== (state.structure === "fork"))
      ? colors.extreme
      : colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(verdict, dag.x + 2, dag.y + dag.h + 34);
    ctx.restore();

    /* --- Scatter, right -------------------------------------------------- */
    const rect = { x: DAG_W + 58, y: 30, w: w - DAG_W - 58 - 12, h: h - 90 };
    const plot = makePlot({ ctx, colors, rect, xDomain: state.xDom, yDomain: state.yDom });

    plot.axisX({ label: names.x });
    plot.axisY({ label: names.y });
    plot.caption(
      params.fit
        ? `${names.y} ~ ${names.x}${adjusted ? ` + ${names.z}` : ""}`
        : `1000 patients, drawn by the ${state.structure}`,
    );
    if (state.beyond > 0) {
      plot.note(`${state.beyond} of 1000 past the frame — the fits use them all`);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    const tint = (z) => {
      const t = Math.max(0, Math.min(1, (z - state.zLo) / (state.zHi - state.zLo)));
      return hexLerp(colors.nonevent, colors.event, t);
    };
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < N; i += 1) {
      ctx.fillStyle = params.colour === "on" ? tint(state.d.z[i]) : colors.unknown;
      ctx.beginPath();
      ctx.arc(plot.sx(state.d.x[i]), plot.sy(state.d.y[i]), 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Fitted lines, clipped to the frame (the mock-up's known blemish). The
       adjusted line is drawn at the mean of the third variable, which is the
       slice of the fitted plane the scatter can carry. */
    const lineAt = (b0, b1, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      ctx.moveTo(plot.sx(state.xDom[0]), plot.sy(b0 + b1 * state.xDom[0]));
      ctx.lineTo(plot.sx(state.xDom[1]), plot.sy(b0 + b1 * state.xDom[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (params.truth === "on") {
      lineAt(state.meanY - state.truth * state.meanX, state.truth, colors.reference, 1.5, [6, 5]);
    }
    if (params.fit) {
      const ub0 = state.unadj.beta[0];
      const ub1 = state.unadj.beta[1];
      lineAt(ub0, ub1, colors.empirical, 2.5);
      /* The adjusted line grows OUT of the unadjusted one: at mix 0 the two
         coincide, at 1 it has swung to its own slope. Between them the pair
         is visibly the same data read twice. */
      if (mix > 0.004) {
        const ab0 = state.adj.beta[0] + state.adj.beta[2] * state.meanZ;
        const ab1 = state.adj.beta[1];
        lineAt(ub0 + (ab0 - ub0) * mix, ub1 + (ab1 - ub1) * mix, colors.highlight, 2.5);
      }
    }
    ctx.restore();
  },

  /* The third variable's node is a click target that flips `adjust` — the
     same write the segmented control performs, through the same door. Built
     from `dagLayout`, the one copy of the geometry. No region while the model
     is unfitted: `adjust` is hidden then, and a region must keep a visible
     control (3.6). */
  regions({ w, h, params }) {
    if (!params.fit) return [];
    const { P, R } = dagLayout(w, h);
    const [zx, zy] = P.z;
    return [{
      x: zx - R - 4,
      y: zy - R - 4,
      w: 2 * (R + 4),
      h: 2 * (R + 4),
      set: { adjust: params.adjust === "on" ? "off" : "on" },
      label: "Adjust for the third variable",
    }];
  },

  readout({ params, state }) {
    const names = NAMES[state.structure];
    const adjusted = params.fit && params.adjust === "on";
    const f = adjusted ? state.adj : state.unadj;
    const b = f.beta[1];
    const half = 1.96 * f.se[1];
    const digits = state.structure === "pipe" ? 2 : 3;
    return [
      {
        label: `Effect of ${names.x}`,
        value: params.fit ? fmt(b, digits) : "—",
        note: params.fit
          ? `95% CI ${fmt(b - half, digits)} to ${fmt(b + half, digits)}`
          : "fit the model to estimate it",
      },
      {
        label: "True effect",
        value: params.truth === "on" ? fmt(state.truth, state.structure === "pipe" ? 0 : 1) : "—",
        note: params.truth === "on"
          ? "what the simulation was built with"
          : "revealed by the True effect toggle",
      },
      {
        label: "R²",
        value: params.fit ? fmt(f.r2, 2) : "—",
        note: "variance explained by the model",
      },
    ];
  },

  summary({ params, state }) {
    const names = NAMES[state.structure];
    const adjusted = params.fit && params.adjust === "on";
    const parts = [
      `A ${state.structure}: ${VERDICT[state.structure][adjusted ? "on" : "off"]}.`,
      `A scatter of ${names.y} against ${names.x} for 1000 simulated patients.`,
    ];
    if (params.fit) {
      const f = adjusted ? state.adj : state.unadj;
      parts.push(
        `The ${adjusted ? "adjusted" : "unadjusted"} fit estimates the effect of ${names.x} at ${fmt(f.beta[1], 3)}.`,
      );
    }
    return parts.join(" ");
  },
});
