/* ============================================================================
   Widget 33 · Checking the Model Fit — lm-diagnostics. DRAFT.

   PHM5003 05-01 cells 53–62 (+ the Application section from 63): goodness
   of fit (R², adjusted R²) and autoplot(which = 1:2) — Residuals vs Fitted
   and the Normal Q-Q — with the notebook's three reading bullets. Measured
   first (`_lab/lm-diag-measure.mjs`): R² 0.1064831 / adjusted 0.106231 to
   the digit against the notebook, and the three rows its stored autoplot
   labels (404, 1003, 1668) are this pipeline's three largest |standardized
   residuals| — residuals, sigma and leverage proven against the notebook's
   own figure in one check.

   KENNETH'S PICKS (2026-08-29, from _lab/lm-diag-stage.html): composition
   B (the data panel ABOVE its two diagnostic panels — the same patient
   traced three times); a segmented Data control naming the scenarios; RvF
   marks = smoothed trend + labelled extremes + ±2 SD band (no envelope
   rails, no clamp); and the SMALL-N ACT for adjusted R² (junk covariates
   0→10: R² climbs on pure noise, adjusted refuses — at n = 3547 the bias
   is invisible, 0.106 → 0.109, measured).

   ROUND 1 (Kenneth, 2026-08-29): THE STAGE IS ALL-SIMULATED. The first
   draft put the real Framingham data beside three simulated violations,
   and both halves of that were wrong: mixing real and simulated data in
   one control risked confusion, and at the real data's noise level the
   curvature was invisible in the cloud ("i don't really see the curve in
   the data" — measured: 1.5 noise SDs of bend, hidden). The simulated
   study keeps the Framingham fit's own line (b₀ 87.07, b₁ 1.72) and the
   real BMI distribution clipped to its dense 18–40 window, at n = 600
   and noise SD 12 — so curve 0.4 bends the cloud 5.2 noise SDs off its
   own best line (VISIBLE), the healthy Linear baseline reads R² ≈ 0.26,
   and there is no sparse outlier tail to dominate the frames. A fourth
   scenario, Linear, is the reference where every assumption holds. The
   notebook's real autoplot stays in the lesson; the widget is the
   controlled reading trainer beside it.

   THE SCOPE BOUNDARY (widget 27 round 8, recorded then): lm-least-squares
   reads a LINE's residuals; this widget reads a MODEL's. Curve/funnel/skew
   as verdicts on the model class live here and only here.

   TWO EASED VALUES drive the plots tab (widget 30's chase pattern): `a`
   (the fit gate's alpha) and `m` (the scenario morph — every dot, the
   fitted line, the smooth, the band and each point's Q-Q position are
   drawn from values LERPED between the outgoing and incoming scenario, so
   the switch reads as the data changing under fixed frames, 2.5). The
   card and the tiles are text and SNAP with the control.

   FRAMES ARE FIXED across scenarios and sized to the measured extents
   over 30 seeds (`lm-diag-measure.mjs` § round 1); a rare seed can still
   exceed them and the clip rect is the honest answer, as everywhere in
   the arc.

   compute() is seeded (the x draw, the four scenario draws and the
   small-n pick come from the one rng, in fixed order) and scenario/junk
   are DISPLAY parameters over precomputed data — the lm-interaction
   `terms` pattern.

   TDZ lesson (the arc's, earned twice): every module-scope const lives
   ABOVE defineWidget — core calls draw() during the defineWidget call.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { BMI } from "../lm-least-squares/data.js";
import { diagnostics, loessAt, makeSynth } from "./model.js";
import { ols } from "../lm-least-squares/model.js";

/* the simulated study — see the header and the measure script's § round 1 */
const POOL = BMI.filter((v) => v >= 18 && v <= 40);
const SIM_N = 600;
const SIGMA = 12;
const CURVE = 0.4;
const FAN = 3;
const B0 = 87.068295; /* the Framingham fit's own line, 05-01 cell 25 */
const B1 = 1.721042;
/* the act's setting and the default seed are MEASURED choices (the
   measure script's § round 1): n = 30 / k = 10 misled on 13 of 60 seeds
   (a lucky junk column lifts ADJUSTED too); n = 60 / k = 20 keeps the
   climb and halves that tail, and seed 6 opens on the typical picture —
   R² 0.25 → 0.51 with adjusted flat at 0.24 */
const SUB_N = 60;
const JUNK_MAX = 20;

/* fixed frames (2.5) — set from the measured 30-seed extents */
const X_BMI = [17, 41];
const DATA_Y = [0, 320];
const RVF_X = [108, 185];
const RVF_Y = [-160, 160];
const QQ_X = [-3.4, 3.4]; /* qnorm((n−0.5)/n) = 3.14 at n = 600 */
const QQ_Y = [-6, 10.5];
const ADJ_X = [0, 20];
const ADJ_Y = [-0.3, 0.9]; /* adjusted R² goes NEGATIVE on junk at n = 30 */

const EASE_MS = 450;

const TOP = 26;
const DATA_H = 186;
const MID = 62; /* the data panel's axis row + the lower row's caption */
const P2_H = 196;
const HEIGHT = TOP + DATA_H + MID + P2_H + 42;

const dataRect = (w) => ({ x: 56, y: TOP, w: w - 70, h: DATA_H });
const panelW = (w) => (w - 56 - 60 - 14) / 2;
const rvfRect = (w) => ({ x: 56, y: TOP + DATA_H + MID, w: panelW(w), h: P2_H });
const qqRect = (w) => ({ x: 56 + panelW(w) + 60, y: TOP + DATA_H + MID, w: panelW(w), h: P2_H });
const adjRect = (w) => ({ x: 60, y: 34, w: Math.min(w - 84, 560), h: HEIGHT - 34 - 44 });

/* label stagger by rank — a const the TDZ rule applies to: draw() runs
   during the defineWidget call, so this cannot live below it (it briefly
   did, and threw exactly the ReferenceError the header warns about) */
const RANK_DY = [3, 14, -8];

const lerp = (a, b, m) => a + (b - a) * m;
const sdOf = (a) => {
  const mu = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / (a.length - 1));
};

const SCEN_CAPTION = {
  linear: "simulated — a straight line with even, normal noise",
  curve: "simulated — the true relationship curves",
  fan: "simulated — the spread grows with BMI",
  skew: "simulated — skewed noise around a straight line",
};

/* ---- the equation card ---------------------------------------------------
   Plain text rows for the draft (the arc's MathML machinery can follow the
   review — the card's CONTENT is what the rounds judge). Rows: the generic
   model, then this fit's numbers, which SNAP with the control. */
let mathHost = null;
let mathKey = null;
function renderEquation(rows) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = rows.map((r) => r.label + r.text).join("|");
  if (key === mathKey) return;
  mathKey = key;
  mathHost.innerHTML = rows.map((r) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${r.label}</span>`
    + `<span style="color:${r.color ?? "var(--ink-2)"}">${r.text}</span></div>`).join("");
}

/* one scenario's precomputed bundle */
function pack(y, d) {
  const len = y.length;
  const qqTh = new Array(len);
  for (let i = 0; i < d.qq.length; i += 1) qqTh[d.qq[i].idx] = d.qq[i].th;
  /* the smooth over the FULL fitted range, as the notebook's own autoplot
     draws it — the dense-window restriction stays on the measure script's
     flatness numbers, where edge wander was the artifact */
  const lo = Math.min(...d.fit.fitted);
  const hi = Math.max(...d.fit.fitted);
  const smoothX = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
  const smoothY = loessAt(d.fit.fitted, d.resid, 0.75, smoothX);
  const top3 = d.std.map((v, i) => i)
    .sort((a, b) => Math.abs(d.std[b]) - Math.abs(d.std[a])).slice(0, 3);
  return {
    y,
    b0: d.fit.b[0],
    b1: d.fit.b[1],
    resid: d.resid,
    std: d.std,
    qqTh,
    line: d.line,
    sd: sdOf(d.resid),
    smoothX,
    smoothY,
    top3,
    maxAbs: Math.max(...d.std.map(Math.abs)),
    r2: d.fit.r2,
    adjR2: d.fit.adjR2,
  };
}

defineWidget({
  slug: "lm-diagnostics",
  title: "Checking the Model Fit",
  status: "draft",
  subtitle:
    "We can check how well a fitted model describes its data. Residuals " +
    "should sit in a level band around zero, their quantiles on the normal " +
    "line; R² reports the variance explained, and adjusted R² allows for " +
    "the covariate count.",
  layout: "side",
  height: HEIGHT,

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "plots", label: "Diagnostic plots", detail: "Residuals vs Fitted and the Normal Q-Q — what each one detects" },
        { value: "adjr2", label: "Model fit", detail: "R² climbs as covariates are added, even useless ones — adjusted R² allows for it" },
      ],
      default: "plots",
      display: true,
    },

    data: { type: "section", label: "The data" },

    /* the generator: a simulated study around the Framingham fit's own
       line, ONE assumption broken at a time, at the measured-visible
       setting — visible in the data, then detected by the plots */
    scenario: {
      type: "segmented",
      label: "Data",
      options: [
        { value: "linear", label: "Linear", detail: "a straight line with even, normal noise — every assumption holds" },
        { value: "curve", label: "Curved", detail: "the true relationship curves, so a straight line is the wrong shape" },
        { value: "fan", label: "Unequal spread", detail: "the spread of the outcome grows with BMI" },
        { value: "skew", label: "Skewed noise", detail: "a straight line with skewed noise around it" },
      ],
      default: "linear",
      display: true,
      when: { param: "concept", equals: "plots" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 6 },

    model: { type: "section", label: "The model" },

    /* the widget opens as data and a question (the arc's gate) */
    fit: {
      type: "gate",
      label: "Fit the model",
      labelOff: "Clear the fit",
      detail: "least squares, sysBP on BMI — the diagnostics are properties of this fit",
      display: true,
    },

    adding: { type: "section", label: "Adding covariates", when: { param: "concept", equals: "adjr2" } },

    junk: {
      type: "int",
      label: "Unrelated covariates",
      min: 0,
      max: JUNK_MAX,
      default: 0,
      detail: "seeded noise columns with no relation to sysBP, added to the model one at a time",
      display: true,
      when: { param: "concept", equals: "adjr2" },
    },
  },

  /* the legend follows the tab and the gate (core's live-legend door):
     no entry may describe a mark the current state does not draw */
  legend: ({ params }) => {
    if (!params.fit) return [];
    return params.concept === "plots"
      ? [
        { token: "unknown", label: "The simulated patients — sysBP against BMI", mark: "dot" },
        { token: "empirical", label: "The fitted line, each point's residual, and its quantile", mark: "dot" },
        { token: "smoothed", label: "Smoothed trend of the residuals", mark: "line" },
        { token: "theory", label: "The normal reference line, through the quartiles", mark: "line" },
        { token: "highlight", label: "The three largest standardized residuals, by row", mark: "dot" },
      ]
      : [
        { token: "group-a", label: "R² as covariates are added", mark: "line" },
        { token: "group-b", label: "Adjusted R²", mark: "line" },
      ];
  },

  compute({ rng }) {
    /* the simulated study's x values, then the four scenarios — drawn
       from the one rng IN FIXED ORDER, so the stream is deterministic
       whatever is displayed */
    const xs = rng.shuffle(POOL).slice(0, SIM_N);
    const synth = makeSynth(xs, B0, B1, SIGMA);
    const sc = {};
    for (const [key, opts] of [
      ["linear", {}],
      ["curve", { curve: CURVE }],
      ["fan", { fan: FAN }],
      ["skew", { skewed: true }],
    ]) {
      const y = synth(rng, opts);
      sc[key] = pack(y, diagnostics(y, xs));
    }

    /* the small-n act: 30 of the simulated patients (the Linear
       scenario's draws — the healthy study), then junk columns
       accumulating one at a time, each k EXTENDING the last */
    const pick = rng.shuffle(Array.from({ length: SIM_N }, (_, i) => i)).slice(0, SUB_N);
    const sxs = pick.map((i) => xs[i]);
    const sys = pick.map((i) => sc.linear.y[i]);
    const junkCols = Array.from({ length: JUNK_MAX }, () => sxs.map(() => rng.normal()));
    const path = Array.from({ length: JUNK_MAX + 1 }, (_, k) => {
      const f = ols(sys, sxs, ...junkCols.slice(0, k));
      return { r2: f.r2, adjR2: f.adjR2, b0: f.b[0], b1: f.b[1] };
    });

    return { xs, sc, path };
  },

  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => ({
      a: params.fit ? 1 : 0,
      aT: params.fit ? 1 : 0,
      from: params.scenario,
      to: params.scenario,
      m: 1,
    }),
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      const gapA = anim.aT - anim.a;
      if (Math.abs(gapA) < 0.0015) anim.a = anim.aT;
      else { anim.a += gapA * rate; moving = true; }
      const gapM = 1 - anim.m;
      if (Math.abs(gapM) < 0.0015) anim.m = 1;
      else { anim.m += gapM * rate; moving = true; }
      return moving;
    },
    rebuild: (anim, { params }) => {
      anim.aT = params.fit ? 1 : 0;
      if (params.scenario !== anim.to) {
        /* a switch mid-ease snaps its origin to the outgoing target — a
           450 ms window nobody re-clicks inside, traded for not
           materialising a 600-value snapshot */
        anim.from = anim.to;
        anim.to = params.scenario;
        anim.m = 0;
      }
      if (Math.abs(anim.a - anim.aT) > 0.0015 || anim.m < 1) anim.easing = true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const a = anim?.a ?? (params.fit ? 1 : 0);
    const m = anim?.m ?? 1;
    const from = state.sc[anim?.from ?? params.scenario];
    const to = state.sc[anim?.to ?? params.scenario];

    if (params.concept === "plots") {
      const S = state.sc[params.scenario];
      renderEquation(!params.fit
        ? [
          { label: "the model", text: "y = b₀ + b₁x" },
          { label: "this fit", text: "no model fitted yet", color: "var(--ink-3)" },
        ]
        : [
          { label: "the model", text: "y = b₀ + b₁x" },
          { label: "this fit", text: `sysBP = ${fmt(S.b0, 2)} + ${fmt(S.b1, 2)} × BMI`, color: "var(--c-empirical)" },
        ]);
      drawPlots(ctx, colors, w, params, state, { from, to, a, m });
    } else {
      const P = state.path[params.junk];
      renderEquation(!params.fit
        ? [
          { label: "the model", text: "y = b₀ + b₁x + noise columns" },
          { label: "this fit", text: "no model fitted yet", color: "var(--ink-3)" },
        ]
        : [
          { label: "the model", text: "y = b₀ + b₁x + noise columns" },
          {
            label: "this fit",
            text: `sysBP = ${fmt(P.b0, 2)} + ${fmt(P.b1, 2)} × BMI`
              + (params.junk ? ` + ${params.junk} noise term${params.junk > 1 ? "s" : ""}` : ""),
            color: "var(--c-empirical)",
          },
        ]);
      drawAdj(ctx, colors, w, params, state, a);
    }
  },

  readout({ params, state }) {
    if (!params.fit) {
      return [
        { label: "R²", value: "—", note: "fit the model first" },
        { label: "Adjusted R²", value: "—", note: "allows for the number of covariates" },
      ];
    }
    if (params.concept === "plots") {
      const S = state.sc[params.scenario];
      return [
        { label: "R²", value: fmt(S.r2, 3), note: "variance explained — 1 − residual ⁄ total sums of squares" },
        { label: "Adjusted R²", value: fmt(S.adjR2, 3), note: "allows for the number of covariates" },
        { label: "Largest |standardized residual|", value: fmt(S.maxAbs, 1), note: "the three largest are labelled on the plots" },
      ];
    }
    const P = state.path[params.junk];
    return [
      { label: "R²", value: fmt(P.r2, 3), note: "cannot fall as covariates are added" },
      { label: "Adjusted R²", value: fmt(P.adjR2, 3), note: "penalised by the covariate count" },
      { label: "Covariates", value: String(1 + params.junk), note: `BMI plus ${params.junk} noise column${params.junk === 1 ? "" : "s"}, on ${SUB_N} simulated patients` },
    ];
  },

  summary({ params, state }) {
    if (params.concept === "plots") {
      const parts = [`A simulated study of ${SIM_N} patients: ${SCEN_CAPTION[params.scenario].replace("simulated — ", "")}.`];
      if (!params.fit) parts.push("No model fitted yet.");
      else {
        const S = state.sc[params.scenario];
        parts.push(`The least-squares fit sysBP = ${fmt(S.b0, 1)} + ${fmt(S.b1, 2)} × BMI, its residuals against fitted values, and their normal Q-Q; R² ${fmt(S.r2, 3)}, largest |standardized residual| ${fmt(S.maxAbs, 1)}.`);
      }
      return parts.join(" ");
    }
    if (!params.fit) return "R² against covariates added — no model fitted yet.";
    const P = state.path[params.junk];
    return `sysBP ~ BMI plus ${params.junk} pure-noise covariates on ${SUB_N} simulated patients: R² ${fmt(P.r2, 3)}, adjusted ${fmt(P.adjR2, 3)}.`;
  },
});

/* --- the plots tab: data above its two diagnostic panels ------------------ */
function drawPlots(ctx, colors, w, params, state, { from, to, a, m }) {
  const xs = state.xs;
  const len = xs.length;
  const clip = (r, fn) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    fn();
    ctx.restore();
  };
  const b0 = lerp(from.b0, to.b0, m);
  const b1 = lerp(from.b1, to.b1, m);
  const fadeIn = Math.max(0, (m - 0.6) / 0.4); /* labels wait for the ease */

  /* --- the data --- */
  const dr = dataRect(w);
  const dp = makePlot({ ctx, colors, rect: dr, xDomain: X_BMI, yDomain: DATA_Y });
  dp.axisX({ ticks: [20, 25, 30, 35, 40], label: "BMI" });
  dp.axisY({ ticks: [100, 200, 300], label: "sysBP (mmHg)" });
  dp.caption(SCEN_CAPTION[params.scenario] + (params.fit ? "" : " — no model yet"));
  clip(dr, () => {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = colors.unknown;
    for (let i = 0; i < len; i += 1) {
      ctx.beginPath();
      ctx.arc(dp.sx(xs[i]), dp.sy(lerp(from.y[i], to.y[i], m)), 1.7, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (a > 0.02) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dp.sx(X_BMI[0]), dp.sy(b0 + b1 * X_BMI[0]));
      ctx.lineTo(dp.sx(X_BMI[1]), dp.sy(b0 + b1 * X_BMI[1]));
      ctx.stroke();
      ringTop3(ctx, colors, dr, to, a * fadeIn, (i) => [dp.sx(xs[i]), dp.sy(to.y[i])]);
      ctx.globalAlpha = 1;
    }
  });

  /* --- residuals vs fitted --- */
  const rr = rvfRect(w);
  const rp = makePlot({ ctx, colors, rect: rr, xDomain: RVF_X, yDomain: RVF_Y });
  rp.axisX({ ticks: [120, 150, 180], label: "fitted values" });
  rp.axisY({ ticks: [-100, 0, 100], label: "residuals" });
  rp.caption(params.fit ? "each residual, against its fitted value" : "no model fitted yet");
  clip(rr, () => {
    if (a <= 0.02) return;
    ctx.globalAlpha = a;
    /* the ±2 SD band: faint fill, dashed edges (a heavier slab drowned
       the dots — judged on the mock) */
    const band = 2 * lerp(from.sd, to.sd, m);
    ctx.fillStyle = colors.grid;
    ctx.globalAlpha = a * 0.12;
    ctx.fillRect(rr.x, rp.sy(band), rr.w, rp.sy(-band) - rp.sy(band));
    ctx.globalAlpha = a;
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    for (const e of [band, -band]) {
      ctx.beginPath();
      ctx.moveTo(rr.x, rp.sy(e));
      ctx.lineTo(rr.x + rr.w, rp.sy(e));
      ctx.stroke();
    }
    /* the zero line the residuals hover around */
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(rr.x, rp.sy(0));
    ctx.lineTo(rr.x + rr.w, rp.sy(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = a * 0.4;
    ctx.fillStyle = colors.empirical;
    for (let i = 0; i < len; i += 1) {
      ctx.beginPath();
      ctx.arc(rp.sx(b0 + b1 * xs[i]), rp.sy(lerp(from.resid[i], to.resid[i], m)), 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = a;
    ctx.strokeStyle = colors.smoothed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < to.smoothX.length; i += 1) {
      const x = rp.sx(lerp(from.smoothX[i], to.smoothX[i], m));
      const y = rp.sy(lerp(from.smoothY[i], to.smoothY[i], m));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    labelTop3(ctx, colors, rr, to, a * fadeIn, (i) => [rp.sx(b0 + b1 * xs[i]), rp.sy(to.resid[i])]);
    ctx.globalAlpha = 1;
  });

  /* --- normal Q-Q --- */
  const qr = qqRect(w);
  const qp = makePlot({ ctx, colors, rect: qr, xDomain: QQ_X, yDomain: QQ_Y });
  qp.axisX({ ticks: [-2, 0, 2], label: "theoretical quantiles" });
  qp.axisY({ ticks: [-4, 0, 4, 8], label: "standardized residuals" });
  if (params.fit) qp.caption("residual quantiles, against normal quantiles");
  clip(qr, () => {
    if (a <= 0.02) return;
    /* the reference line — the normality claim the points are checked
       against, through the quartiles as stats::qqline draws it */
    const slope = lerp(from.line.slope, to.line.slope, m);
    const inter = lerp(from.line.inter, to.line.inter, m);
    ctx.globalAlpha = a;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(qp.sx(QQ_X[0]), qp.sy(inter + slope * QQ_X[0]));
    ctx.lineTo(qp.sx(QQ_X[1]), qp.sy(inter + slope * QQ_X[1]));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = colors.empirical;
    for (let i = 0; i < len; i += 1) {
      ctx.beginPath();
      ctx.arc(qp.sx(lerp(from.qqTh[i], to.qqTh[i], m)), qp.sy(lerp(from.std[i], to.std[i], m)), 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = a;
    labelTop3(ctx, colors, qr, to, a * fadeIn, (i) => [qp.sx(to.qqTh[i]), qp.sy(to.std[i])]);
    ctx.globalAlpha = 1;
  });
}

/* a label near a panel edge flips inward and clamps — a row number half
   outside the clip read as a different number (judged on screen). Ranks
   stagger vertically because two of the three extremes can be
   near-coincident points, and their labels printed through each other.
   RANK_DY lives at the top of the module — the TDZ rule. */
function edgeLabel(ctx, colors, rect, x, y, text, rank) {
  const flip = x > rect.x + rect.w - 34;
  ctx.textAlign = flip ? "right" : "left";
  const lx = flip ? x - 6 : x + 6;
  const ly = Math.max(rect.y + 11, Math.min(rect.y + rect.h - 4, y + RANK_DY[rank]));
  ctx.fillStyle = colors.highlight;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.fillText(text, lx, ly);
}

function ringTop3(ctx, colors, rect, S, alpha, posOf) {
  if (alpha <= 0.02) return;
  ctx.globalAlpha = alpha;
  S.top3.forEach((i, rank) => {
    const [x, y] = posOf(i);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.stroke();
    edgeLabel(ctx, colors, rect, x, y, String(i + 1), rank);
  });
}

function labelTop3(ctx, colors, rect, S, alpha, posOf) {
  if (alpha <= 0.02) return;
  ctx.globalAlpha = alpha;
  S.top3.forEach((i, rank) => {
    const [x, y] = posOf(i);
    edgeLabel(ctx, colors, rect, x, y, String(i + 1), rank);
  });
}

/* --- the adjusted-R² act: R² climbs on pure noise, adjusted refuses ------- */
function drawAdj(ctx, colors, w, params, state, a) {
  const r = adjRect(w);
  const p = makePlot({ ctx, colors, rect: r, xDomain: ADJ_X, yDomain: ADJ_Y });
  p.axisX({ ticks: [0, 5, 10, 15, 20], label: "unrelated covariates added" });
  p.axisY({ ticks: [-0.2, 0, 0.2, 0.4, 0.6, 0.8], label: "R²" });
  p.caption(params.fit
    ? `sysBP ~ BMI plus pure-noise columns, on ${SUB_N} simulated patients`
    : "no model fitted yet");
  if (a <= 0.02) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - 2, r.y, r.w + 4, r.h);
  ctx.clip();
  ctx.globalAlpha = a;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, p.sy(0));
  ctx.lineTo(r.x + r.w, p.sy(0));
  ctx.stroke();
  ctx.setLineDash([]);
  const upto = state.path.slice(0, params.junk + 1);
  const pathLine = (key, color, label) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    upto.forEach((q, k) => {
      if (k === 0) ctx.moveTo(p.sx(k), p.sy(q[key]));
      else ctx.lineTo(p.sx(k), p.sy(q[key]));
    });
    ctx.stroke();
    ctx.fillStyle = color;
    upto.forEach((q, k) => {
      ctx.beginPath();
      ctx.arc(p.sx(k), p.sy(q[key]), 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    /* the label rides the path's end and flips inside the frame near the
       right edge — at k = 10 a left-anchored label fell in the clip */
    const last = upto[upto.length - 1];
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    const atEdge = params.junk >= 16;
    ctx.textAlign = atEdge ? "right" : "left";
    const lx = p.sx(params.junk) + (atEdge ? -8 : 8);
    const ly = p.sy(last[key]) + (key === "r2" ? -8 : 16);
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
  };
  pathLine("r2", colors.groupA, `R² ${fmt(upto[upto.length - 1].r2, 2)}`);
  pathLine("adjR2", colors.groupB, `adjusted ${fmt(upto[upto.length - 1].adjR2, 2)}`);
  ctx.globalAlpha = 1;
  ctx.restore();
}
