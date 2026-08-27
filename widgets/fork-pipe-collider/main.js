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

/* The View control was HIDDEN for the collider between rounds 5 and 8 (a
   syncRail on widget 12's pattern), because the recentred-blocks slide was
   its only adjusted picture and it confused. Once the labelled pair and the
   gap bracket became the collider's primary adjusted view, Kenneth asked for
   the same button everywhere — and the slide earns its place back as the
   second act: in the residual view the two intercepts are REMOVED, so the
   pair collapses into the one line through the origin. */

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
    /* WHERE THE ADJUSTED NUMBER COMES FROM — the added-variable view, gated
       on adjust being ON because the residual cloud IS the adjusted picture
       (a view of it while the model on screen was unadjusted would disagree
       with every tile). Chosen over per-band fit lines by measurement: within
       quartile bands the fork's slope is still −0.38 to −0.30, so the
       "obvious" bridge teaches the opposite (`_lab/causal-measure.mjs`,
       ROUND TWO). This one cannot lie: the residual slope equals the
       adjusted coefficient exactly, by Frisch–Waugh. */
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "data", label: "Data", detail: "the measurements as recorded" },
        { value: "resid", label: "Third variable removed", detail: "what it explains is taken out of both axes — the slope left is the adjusted coefficient" },
      ],
      default: "data",
      display: true,
      when: { param: "adjust", equals: "on" },
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
    /* The added-variable view: both axes regressed on the third variable,
       residuals kept. The residual slope equals adj.beta[1] exactly (FWL) —
       asserted by `_lab/causal-measure.mjs` rather than trusted. */
    const gx = ols(d.x, [d.z], tTailP);
    const gy = ols(d.y, [d.z], tTailP);
    const rx = d.x.map((v, i) => v - gx.beta[0] - gx.beta[1] * d.z[i]);
    const ry = d.y.map((v, i) => v - gy.beta[0] - gy.beta[1] * d.z[i]);
    const rq = (vals, p) => {
      const s = [...vals].sort((a, b) => a - b);
      return s[Math.floor(p * (N - 1))];
    };
    const rxDom = skewed ? [rq(rx, 0.005) * 1.08, rq(rx, 0.995) * 1.08] : padDomain(rx);
    const ryDom = skewed ? [rq(ry, 0.005) * 1.08, rq(ry, 0.995) * 1.08] : padDomain(ry);
    let beyondR = 0;
    if (skewed) {
      for (let i = 0; i < N; i += 1) {
        if (rx[i] < rxDom[0] || rx[i] > rxDom[1] || ry[i] < ryDom[0] || ry[i] > ryDom[1]) beyondR += 1;
      }
    }
    /* The collider's adjusted picture: one slope, two intercepts — the pair
       of parallel lines passes through each ICU group's centroid. The pooled
       within-group slope IS adj.beta[1] to the digit (measured in
       `_lab/causal-stage.html` round three: −0.1799 = −0.1799). */
    const groups = skewed
      ? [0, 1].map((g) => {
          const ix = [];
          for (let i = 0; i < N; i += 1) if (d.z[i] === g) ix.push(i);
          return { mx: meanOf(ix.map((i) => d.x[i])), my: meanOf(ix.map((i) => d.y[i])) };
        })
      : null;
    return {
      groups,
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
      rx,
      ry,
      rxDom,
      ryDom,
      beyondR,
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
      const v = m && params.view === "resid" ? 1 : 0;
      return { mix: m, mixT: m, vmix: v, vmixT: v, easing: false, done: false };
    },
    /* Two independent eases chasing their own targets, odds-and-risk's
       pattern: the adjusted line swinging (`mix`), and every patient sliding
       between the data view and the residual view (`vmix`). Exponential, so
       an interruption resumes from where the figure is. */
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      for (const key of ["mix", "vmix"]) {
        const gap = anim[`${key}T`] - anim[key];
        if (Math.abs(gap) < 0.004) {
          anim[key] = anim[`${key}T`];
          continue;
        }
        anim[key] += gap * rate;
        moving = true;
      }
      return moving;
    },
    rebuild: (anim, { params }) => {
      anim.mixT = params.fit && params.adjust === "on" ? 1 : 0;
      anim.vmixT = anim.mixT && params.view === "resid" ? 1 : 0;
      if (Math.abs(anim.mixT - anim.mix) > 0.004 || Math.abs(anim.vmixT - anim.vmix) > 0.004) {
        anim.easing = true;
      }
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
    const vmix = anim?.vmix ?? (adjusted && params.view === "resid" ? 1 : 0);
    const rect = { x: DAG_W + 58, y: 30, w: w - DAG_W - 58 - 12, h: h - 90 };
    /* TWO COORDINATE FRAMES OVER ONE RECT — the data view and the residual
       view — and each patient's pixel is a lerp between its position in the
       two. The frame, axes and caption belong to whichever view is nearer,
       so mid-slide the picture is honest about being in transit. */
    const plotD = makePlot({ ctx, colors, rect, xDomain: state.xDom, yDomain: state.yDom });
    const plotR = makePlot({ ctx, colors, rect, xDomain: state.rxDom, yDomain: state.ryDom });
    const inResid = vmix >= 0.5;
    const front = inResid ? plotR : plotD;

    if (inResid) {
      front.axisX({ label: `${names.x} — ${names.z} removed` });
      front.axisY({ label: `${names.y} — ${names.z} removed` });
      front.caption(`what ${names.z} does not explain`);
      /* The origin sentence, Kenneth's round 9: negative residuals confused
         until 0 was named. It shares the line with the clipped count where
         the collider has one. */
      front.note(
        state.beyondR > 0
          ? `0 = your group's average — ${state.beyondR} of 1000 past the frame`
          : "0 = the average for the patient's own group",
      );
    } else {
      front.axisX({ label: names.x });
      front.axisY({ label: names.y });
      front.caption(
        params.fit
          ? `${names.y} ~ ${names.x}${adjusted ? ` + ${names.z}` : ""}${state.groups && adjusted ? " — one slope, two intercepts" : ""}`
          : `1000 patients, drawn by the ${state.structure}`,
      );
      if (adjusted) {
        /* The slide is behind the View control, and nothing on the figure
           said so — Kenneth adjusted, saw only the line swing, and read the
           slide as gone (round 7). An instructional note in the drive-hint
           register, for every structure now that all three carry the slide;
           it outranks the frame count here because the count has held the
           slot since Fit and returns the moment Adjust goes off. */
        front.note(`switch View to remove ${names.z}`);
      } else if (state.beyond > 0) {
        front.note(`${state.beyond} of 1000 past the frame — the fits use them all`);
      }
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
      const px = plotD.sx(state.d.x[i]) + (plotR.sx(state.rx[i]) - plotD.sx(state.d.x[i])) * vmix;
      const py = plotD.sy(state.d.y[i]) + (plotR.sy(state.ry[i]) - plotD.sy(state.d.y[i])) * vmix;
      ctx.fillStyle = params.colour === "on" ? tint(state.d.z[i]) : colors.unknown;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Fitted lines, clipped to the frame. Each view's lines fade with its
       share of the slide, so no line claims a cloud that has left it. */
    const lineAt = (plot, dom, b0, b1, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      ctx.moveTo(plot.sx(dom[0]), plot.sy(b0 + b1 * dom[0]));
      ctx.lineTo(plot.sx(dom[1]), plot.sy(b0 + b1 * dom[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (vmix < 0.996) {
      ctx.globalAlpha = 1 - vmix;
      if (params.truth === "on") {
        lineAt(plotD, state.xDom, state.meanY - state.truth * state.meanX, state.truth, colors.reference, 1.5, [6, 5]);
      }
      if (params.fit) {
        const ub0 = state.unadj.beta[0];
        const ub1 = state.unadj.beta[1];
        lineAt(plotD, state.xDom, ub0, ub1, colors.empirical, 2.5);
        /* The adjusted fit grows OUT of the unadjusted line: at mix 0 it
           coincides, at 1 it has swung to its own slope. For the collider —
           binary third variable — the adjusted model is ONE SLOPE WITH TWO
           INTERCEPTS, so the pair of parallel lines splits apart from the
           single line, each landing on its own group's centroid (Kenneth's
           round-5 pick, candidate B in `_lab/causal-stage.html`). */
        if (mix > 0.004) {
          const ab1 = state.adj.beta[1];
          if (state.groups) {
            /* THE PAIR, Kenneth's variant C: the ICU = 1 line solid at full
               weight, the ICU = 0 comparator DOTTED — de-emphasised, kept
               (adjusting removes comparisons across the groups, not the
               patients; both clouds inform the slope). The dot pattern [2,4]
               is deliberately unlike the truth line's [6,5] dashes. */
            const intercepts = [];
            state.groups.forEach((g, gi) => {
              const gb0 = g.my - ab1 * g.mx;
              const cb0 = ub0 + (gb0 - ub0) * mix;
              const cb1 = ub1 + (ab1 - ub1) * mix;
              intercepts[gi] = { cb0, cb1 };
              if (gi === 0) lineAt(plotD, state.xDom, cb0, cb1, colors.highlight, 2, [2, 4]);
              else lineAt(plotD, state.xDom, cb0, cb1, colors.highlight, 2.5);
            });
            /* Labels and the gap bracket fade in with the split, so nothing
               names a line still riding the unadjusted slope. */
            if (mix > 0.6 && vmix < 0.996) {
              ctx.save();
              /* Fades in with the split AND out with the slide — an
                 annotation must not outlive the cloud it describes. */
              ctx.globalAlpha = ((mix - 0.6) / 0.4) * (1 - vmix);
              ctx.font = `${colors.fsXs} ${colors.font}`;
              ctx.textAlign = "left";

              /* Each line named by the group it is drawn for — one model,
                 evaluated at ICU = 0 and ICU = 1. Anchored left of centre
                 because the pair descends out of the frame to the right,
                 and right of the bracket so the two annotations share the
                 edge without colliding. */
              ctx.textBaseline = "bottom";
              const lx = state.xDom[0] + (state.xDom[1] - state.xDom[0]) * 0.12;
              intercepts.forEach(({ cb0, cb1 }, gi) => {
                const text = `${names.z} = ${gi}`;
                ctx.strokeStyle = colors.surface;
                ctx.lineWidth = 3;
                ctx.strokeText(text, plotD.sx(lx) + 2, plotD.sy(cb0 + cb1 * lx) - 4);
                ctx.fillStyle = colors.ink2;
                ctx.fillText(text, plotD.sx(lx) + 2, plotD.sy(cb0 + cb1 * lx) - 4);
              });

              /* THE GAP BRACKET on the intercept axis — the vertical distance
                 between parallel lines is the same at every x, so it sits at
                 the left edge where the intercepts live. Its value is the
                 model's third number: R's printed ICU coefficient. */
              const ax = state.xDom[0] + (state.xDom[1] - state.xDom[0]) * 0.025;
              const px = plotD.sx(ax);
              const y0 = plotD.sy(intercepts[0].cb0 + intercepts[0].cb1 * ax);
              const y1 = plotD.sy(intercepts[1].cb0 + intercepts[1].cb1 * ax);
              ctx.strokeStyle = colors.ink1;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(px, y0);
              ctx.lineTo(px, y1);
              ctx.stroke();
              for (const [ye, dir] of [[y0, y1 > y0 ? 1 : -1], [y1, y0 > y1 ? 1 : -1]]) {
                ctx.fillStyle = colors.ink1;
                ctx.beginPath();
                ctx.moveTo(px, ye);
                ctx.lineTo(px - 4, ye + dir * 6);
                ctx.lineTo(px + 4, ye + dir * 6);
                ctx.fill();
              }
              const gap = state.adj.beta[2];
              const label = `effect of ${names.z} = ${gap >= 0 ? "+" : ""}${fmt(gap, 2)}`;
              ctx.textBaseline = "middle";
              ctx.strokeStyle = colors.surface;
              ctx.lineWidth = 3;
              ctx.strokeText(label, px + 8, (y0 + y1) / 2);
              ctx.fillStyle = colors.ink1;
              ctx.fillText(label, px + 8, (y0 + y1) / 2);
              ctx.restore();
            }
          } else {
            const ab0 = state.adj.beta[0] + state.adj.beta[2] * state.meanZ;
            lineAt(plotD, state.xDom, ub0 + (ab0 - ub0) * mix, ub1 + (ab1 - ub1) * mix, colors.highlight, 2.5);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    if (vmix > 0.004) {
      ctx.globalAlpha = vmix;
      /* THE ORIGIN CROSSHAIR — 0 on each residual axis is "the average for
         the patient's own group", and the crosshair is where every group's
         average patient now sits. Faint on purpose: an anchor to read from,
         not a mark competing with the fits. */
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1;
      ctx.globalAlpha = vmix * 0.5;
      ctx.beginPath();
      ctx.moveTo(rect.x, plotR.sy(0));
      ctx.lineTo(rect.x + rect.w, plotR.sy(0));
      ctx.moveTo(plotR.sx(0), rect.y);
      ctx.lineTo(plotR.sx(0), rect.y + rect.h);
      ctx.stroke();
      ctx.globalAlpha = vmix;
      /* Residual view: both residuals are mean-zero, so the adjusted slope
         passes through the origin exactly — and IS adj.beta[1], by FWL. */
      if (params.truth === "on") {
        lineAt(plotR, state.rxDom, 0, state.truth, colors.reference, 1.5, [6, 5]);
      }
      lineAt(plotR, state.rxDom, 0, state.adj.beta[1], colors.highlight, 2.5);
      ctx.globalAlpha = 1;
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
