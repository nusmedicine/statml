/* ============================================================================
   Widget 33 · Checking the Model Fit — lm-diagnostics. DRAFT.

   PHM5003 05-01 cells 53–62 + the Application section: R², adjusted R²,
   and autoplot(which = 1:2) — Residuals vs Fitted and the Normal Q-Q.
   Round-by-round record: catalogue § Widget 33. Every printed number is
   verified in `_lab/lm-diag-measure.mjs` (R²/adjusted to the digit; the
   three rows the notebook's stored autoplot labels are this pipeline's
   three largest |standardized residuals|).

   THE STAGE IS ALL-SIMULATED (round 1): a study around the Framingham
   fit's own line (b₀ 87.07, b₁ 1.72), real BMI values clipped to the
   dense 18–40 window, n = 600, noise SD 12 — settings measured so each
   violation is visible in the CLOUD, not just the plots. Scenario and
   junk are display parameters over precomputed data (the lm-interaction
   `terms` pattern); compute() draws everything from the one rng in
   fixed order. The act's n = 60 / k = 20 and the default seed 6 are
   measured choices — smaller n let a lucky junk column lift ADJUSTED
   R² too, and seed 6 opens on the typical picture (see the measure
   script's § round 1).

   THE `fit` GATE IS NOT display, deliberately: core's entry door lives
   on the data path (em-mixture's arrangement), and this widget has no
   accumulated work for a gate-close to destroy. The entry (round 2, §A)
   builds the residual plot — twelve travelling residual segments, then
   the mass — and its flag follows em-mixture's one-shot contract, so a
   shared ?fit=1 link opens finished. Hover then links the same patient
   across all three panels (pointer channel; an inspector only).

   `claim` (round 2 §D, round 3: a pill) overlays three bells straddling
   the fitted line at the FIT's own residual SD — computed from the fit,
   never from the hidden generator (2.11).

   Residual segments are VERTICAL, not perpendicular: perpendicular
   distance is a different quantity (total least squares).

   EASED VALUES (widget 30's chase): `m` (scenario morph — every mark
   drawn from values lerped between outgoing and incoming scenario,
   under frames fixed across scenarios, 2.5), `c` (the bells' stagger),
   and the entry clock `et`. The card and tiles are text and SNAP.

   TDZ: every module-scope const lives ABOVE defineWidget — core calls
   draw() during the defineWidget call (bitten three times in this arc).
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { BMI } from "../lm-least-squares/data.js";
import { diagnostics, loessAt, makeSynth } from "./model.js";
import { ols } from "../lm-least-squares/model.js";

/* the simulated study — measured in lm-diag-measure.mjs § round 1 */
const POOL = BMI.filter((v) => v >= 18 && v <= 40);
const SIM_N = 600;
const SIGMA = 12;
const CURVE = 0.4;
const FAN = 3;
const B0 = 87.068295; /* the Framingham fit's own line, 05-01 cell 25 */
const B1 = 1.721042;
const SUB_N = 60;
const JUNK_MAX = 20;

/* fixed frames (2.5) — set from the measured 30-seed extents; a rare
   seed can exceed them and the clip rect is the honest answer */
const X_BMI = [17, 41];
const DATA_Y = [0, 320];
const RVF_X = [108, 185];
const RVF_Y = [-160, 160];
const QQ_X = [-3.4, 3.4]; /* qnorm((n−0.5)/n) = 3.14 at n = 600 */
const QQ_Y = [-6, 10.5];
const ADJ_X = [0, 20];
const ADJ_Y = [-0.3, 0.9]; /* adjusted R² goes negative on junk at this n */

const EASE_MS = 450;

/* the entry: SEL_N patients on a conveyor, then the mass fade */
const SEL_N = 12;
const ENTRY_STAG = 250;
const ENTRY_PER = 500;
const ENTRY_MASS = 450;
const SEL_END = (SEL_N - 1) * ENTRY_STAG + ENTRY_PER;
const ENTRY_TOTAL = SEL_END + ENTRY_MASS;

const BELL_AT = [21, 28, 35];

const TOP = 26;
const DATA_H = 186;
const MID = 62;
const P2_H = 196;
const HEIGHT = TOP + DATA_H + MID + P2_H + 42;

const dataRect = (w) => ({ x: 56, y: TOP, w: w - 70, h: DATA_H });
const panelW = (w) => (w - 56 - 60 - 14) / 2;
const rvfRect = (w) => ({ x: 56, y: TOP + DATA_H + MID, w: panelW(w), h: P2_H });
const qqRect = (w) => ({ x: 56 + panelW(w) + 60, y: TOP + DATA_H + MID, w: panelW(w), h: P2_H });
const adjRect = (w) => ({ x: 60, y: 34, w: Math.min(w - 84, 560), h: HEIGHT - 34 - 44 });

/* label stagger by rank — two extremes can be near-coincident points */
const RANK_DY = [3, 14, -8];

const lerp = (a, b, m) => a + (b - a) * m;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
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

/* ---- the equation card, the arc's machinery ----------------------------- */
function mathmlRenders() {
  if (typeof window === "undefined" || typeof window.MathMLElement !== "function") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;font-size:16px";
  probe.innerHTML = '<math id="lmd-frac"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
    + '<math id="lmd-flat"><mn>1</mn></math>';
  document.body.appendChild(probe);
  const h = (id) => probe.querySelector(`#${id}`)?.getBoundingClientRect().height ?? 0;
  const stacked = h("lmd-frac");
  const flat = h("lmd-flat");
  probe.remove();
  return flat > 0 && stacked > flat * 1.4;
}
const MATHML = mathmlRenders();

const GENERIC = {
  plots: {
    math: "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><mi>x</mi></mrow></math>",
    plain: "y = b₀ + b₁x",
  },
  adjr2: {
    math: "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><mi>x</mi>"
      + "<mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><msub><mi>z</mi><mn>1</mn></msub>"
      + "<mo>+</mo><mo>&#x22EF;</mo></mrow></math>",
    plain: "y = b₀ + b₁x + b₂z₁ + ⋯",
  },
};

function eqHTML(terms) {
  const mag = (v) => fmt(Math.abs(v), 2);
  if (!MATHML) {
    return terms.map((t, i) => (i === 0
      ? `sysBP = ${fmt(t.num, 2)}`
      : `${t.num < 0 ? "−" : "+"} ${mag(t.num)} × ${t.name}`)).join(" ");
  }
  return terms.map((t, i) => (i === 0
    ? `<math><mrow><mi>sysBP</mi><mo>=</mo><mn>${fmt(t.num, 2)}</mn></mrow></math>`
    : `<math><mrow><mo form="infix">${t.num < 0 ? "&#x2212;" : "+"}</mo><mn>${mag(t.num)}</mn><mo>&#xD7;</mo><mi>${t.name}</mi></mrow></math>`
  )).join(" ");
}

let mathHost = null;
let mathKey = null;
function renderEquation(kind, terms, note) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = kind + (terms ? terms.map((t) => `${t.num}${t.name ?? ""}`).join(",") : "none") + (note ?? "");
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const g = GENERIC[kind];
  const generic = `<span style="color:var(--ink-2)">${MATHML ? g.math : g.plain}</span>`;
  const model = terms
    ? `<span style="color:var(--c-empirical)">${eqHTML(terms)}</span>`
      + (note ? ` <span style="color:var(--ink-3);font-size:var(--fs-xs)">${note}</span>` : "")
    : `<span style="color:var(--ink-3)">no model fitted yet</span>`;
  mathHost.innerHTML = row("the model", generic) + row("this model", model);
}

/* one scenario's precomputed bundle */
function pack(y, d, xs) {
  const len = y.length;
  const qqTh = new Array(len);
  for (let i = 0; i < d.qq.length; i += 1) qqTh[d.qq[i].idx] = d.qq[i].th;
  /* the smooth over the FULL fitted range, as autoplot draws it */
  const lo = Math.min(...d.fit.fitted);
  const hi = Math.max(...d.fit.fitted);
  const smoothX = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
  const smoothY = loessAt(d.fit.fitted, d.resid, 0.75, smoothX);
  const byAbs = d.std.map((v, i) => i)
    .sort((a, b) => Math.abs(d.std[b]) - Math.abs(d.std[a]));
  const top3 = byAbs.slice(0, 3);
  /* the entry's twelve: quantile-spread across x, the largest |stdres|
     among them */
  const byX = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b]);
  const sel = [];
  for (let q = 0; q < SEL_N - 1; q += 1) sel.push(byX[Math.floor(((q + 0.5) / (SEL_N - 1)) * len)]);
  if (!sel.includes(byAbs[0])) sel.splice(Math.floor(SEL_N / 2), 0, byAbs[0]);
  else sel.push(byX[Math.floor(0.5 * len)]);
  return {
    y,
    b0: d.fit.b[0],
    b1: d.fit.b[1],
    resid: d.resid,
    std: d.std,
    qqTh,
    line: d.line,
    sd: sdOf(d.resid),
    sigma: Math.sqrt(d.fit.sigma2),
    smoothX,
    smoothY,
    top3,
    sel: sel.slice(0, SEL_N),
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
  pointer: true,

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "plots", label: "Diagnostic plots", detail: "Residuals vs Fitted, and the Normal Q-Q" },
        { value: "adjr2", label: "Model fit", detail: "R² and adjusted R² as covariates are added" },
      ],
      default: "plots",
      display: true,
    },

    data: { type: "section", label: "The data" },

    scenario: {
      type: "segmented",
      label: "Data",
      options: [
        { value: "linear", label: "Linear", detail: "a straight line with even, normal noise" },
        { value: "curve", label: "Curved", detail: "the true relationship curves" },
        { value: "fan", label: "Unequal spread", detail: "the spread of the outcome grows with BMI" },
        { value: "skew", label: "Skewed noise", detail: "a straight line with skewed noise around it" },
      ],
      default: "linear",
      display: true,
      when: { param: "concept", equals: "plots" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 6 },

    model: { type: "section", label: "The model" },

    /* NOT display: core's entry door is on the data path, and no
       accumulated work exists for a gate-close to destroy */
    fit: {
      type: "gate",
      label: "Fit the model",
      labelOff: "Clear the fit",
      detail: "least squares, sysBP on BMI",
    },

    claim: {
      type: "bool",
      style: "pill",
      label: "Model's claim",
      detail: "normal around the line at every BMI, with one spread",
      default: false,
      display: true,
      when: { param: "concept", equals: "plots" },
    },

    adding: { type: "section", label: "Adding covariates", when: { param: "concept", equals: "adjr2" } },

    junk: {
      type: "int",
      label: "Unrelated covariates",
      min: 0,
      max: JUNK_MAX,
      default: 0,
      detail: "seeded noise columns with no relation to sysBP",
      display: true,
      when: { param: "concept", equals: "adjr2" },
    },
  },

  /* a live legend: no entry may describe a mark the state does not draw */
  legend: ({ params }) => {
    if (!params.fit) return [];
    if (params.concept !== "plots") {
      return [
        { token: "group-a", label: "R² as covariates are added", mark: "line" },
        { token: "group-b", label: "Adjusted R²", mark: "line" },
      ];
    }
    const entries = [
      { token: "unknown", label: "The simulated patients — sysBP against BMI", mark: "dot" },
      { token: "empirical", label: "The fitted line, each point's residual, and its quantile", mark: "dot" },
      { token: "smoothed", label: "Smoothed trend of the residuals", mark: "line" },
      { token: "theory", label: "The normal reference line, through the quartiles", mark: "line" },
      { token: "highlight", label: "The three largest standardized residuals, by row", mark: "dot" },
    ];
    if (params.claim) {
      entries.splice(4, 0, { token: "theory", label: "The model's claim — normal around the line, one spread", mark: "line" });
    }
    return entries;
  },

  compute({ rng }) {
    /* everything from the one rng IN FIXED ORDER, so the stream is
       deterministic whatever is displayed */
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
      sc[key] = pack(y, diagnostics(y, xs), xs);
    }

    /* the act: SUB_N of the Linear scenario's patients, then junk
       columns accumulating one at a time — each k extends the last */
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
      /* the one-shot entry flag (em-mixture's contract): consumed by
         advance's first 'enter' frame; inert on a shared ?fit=1 link,
         so links and fingerprint states open finished */
      entry: Boolean(params.fit),
      et: ENTRY_TOTAL,
      from: params.scenario,
      to: params.scenario,
      m: 1,
      c: params.claim ? 1 : 0,
      cT: params.claim ? 1 : 0,
    }),
    advance: (anim, { dt }) => {
      if (anim.mode === "enter" && anim.entry) {
        anim.entry = false;
        anim.et = 0;
      }
      let moving = false;
      if (anim.et < ENTRY_TOTAL) {
        anim.et = Math.min(ENTRY_TOTAL, anim.et + dt);
        moving = true;
      }
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      const gapM = 1 - anim.m;
      if (Math.abs(gapM) < 0.0015) anim.m = 1;
      else { anim.m += gapM * rate; moving = true; }
      const gapC = anim.cT - anim.c;
      if (Math.abs(gapC) < 0.0015) anim.c = anim.cT;
      else { anim.c += gapC * rate; moving = true; }
      return moving;
    },
    rebuild: (anim, { params }) => {
      if (params.scenario !== anim.to) {
        /* a switch mid-ease snaps its origin to the outgoing target —
           traded for not materialising a 600-value snapshot */
        anim.from = anim.to;
        anim.to = params.scenario;
        anim.m = 0;
      }
      anim.cT = params.claim ? 1 : 0;
      if (anim.m < 1 || Math.abs(anim.c - anim.cT) > 0.0015) anim.easing = true;
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const m = anim?.m ?? 1;
    const et = anim?.et ?? ENTRY_TOTAL;
    const c = anim?.c ?? (params.claim ? 1 : 0);
    const from = state.sc[anim?.from ?? params.scenario];
    const to = state.sc[anim?.to ?? params.scenario];

    if (params.concept === "plots") {
      const S = state.sc[params.scenario];
      renderEquation("plots", params.fit
        ? [{ num: S.b0 }, { num: S.b1, name: "BMI" }]
        : null);
      drawPlots(ctx, colors, w, params, state, { from, to, m, et, c, pointer });
    } else {
      const P = state.path[params.junk];
      renderEquation("adjr2", params.fit
        ? [{ num: P.b0 }, { num: P.b1, name: "BMI" }]
        : null,
      params.fit && params.junk
        ? `+ ${params.junk} noise term${params.junk > 1 ? "s" : ""}`
        : null);
      drawAdj(ctx, colors, w, params, state);
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
        { label: "R²", value: fmt(S.r2, 3), note: "variance explained by the model" },
        { label: "Adjusted R²", value: fmt(S.adjR2, 3), note: "allows for the number of covariates" },
        { label: "Largest |standardized residual|", value: fmt(S.maxAbs, 1), note: "the three largest are labelled on the plots" },
      ];
    }
    const P = state.path[params.junk];
    return [
      { label: "R²", value: fmt(P.r2, 3), note: "never falls as covariates are added" },
      { label: "Adjusted R²", value: fmt(P.adjR2, 3), note: "allows for the number of covariates" },
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
        if (params.claim) parts.push("Overlaid: normal curves of one spread straddling the line at three BMI values.");
      }
      return parts.join(" ");
    }
    if (!params.fit) return "R² against covariates added — no model fitted yet.";
    const P = state.path[params.junk];
    return `sysBP ~ BMI plus ${params.junk} pure-noise covariates on ${SUB_N} simulated patients: R² ${fmt(P.r2, 3)}, adjusted ${fmt(P.adjR2, 3)}.`;
  },
});

/* --- the plots tab: data above its two diagnostic panels ------------------ */
function drawPlots(ctx, colors, w, params, state, { from, to, m, et, c, pointer }) {
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
  const fitOf = (i) => b0 + b1 * xs[i];
  const yOf = (i) => lerp(from.y[i], to.y[i], m);
  const residOf = (i) => lerp(from.resid[i], to.resid[i], m);
  const on = Boolean(params.fit);
  /* the entry's beats: the line, the travellers, the mass */
  const lineA = on ? clamp01(et / 300) : 0;
  const massA = on ? clamp01((et - SEL_END) / ENTRY_MASS) : 0;
  const entering = on && et < ENTRY_TOTAL;
  const fadeIn = massA * Math.max(0, (m - 0.6) / 0.4);

  const dr = dataRect(w);
  const rr = rvfRect(w);
  const qr = qqRect(w);
  const dp = makePlot({ ctx, colors, rect: dr, xDomain: X_BMI, yDomain: DATA_Y });
  const rp = makePlot({ ctx, colors, rect: rr, xDomain: RVF_X, yDomain: RVF_Y });
  const qp = makePlot({ ctx, colors, rect: qr, xDomain: QQ_X, yDomain: QQ_Y });

  /* the hover link: the nearest patient within reach, in whichever panel
     holds the pointer — inert mid-entry */
  let hot = -1;
  if (pointer && on && !entering) {
    const near = (px, py, posOf) => {
      let best = -1;
      let bd = 90;
      for (let i = 0; i < len; i += 1) {
        const [x, y] = posOf(i);
        const d2 = (x - px) ** 2 + (y - py) ** 2;
        if (d2 < bd) { bd = d2; best = i; }
      }
      return best;
    };
    const inR = (r) => pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h;
    if (inR(dr)) hot = near(pointer.x, pointer.y, (i) => [dp.sx(xs[i]), dp.sy(yOf(i))]);
    else if (inR(rr)) hot = near(pointer.x, pointer.y, (i) => [rp.sx(fitOf(i)), rp.sy(residOf(i))]);
    else if (inR(qr)) hot = near(pointer.x, pointer.y, (i) => [qp.sx(lerp(from.qqTh[i], to.qqTh[i], m)), qp.sy(lerp(from.std[i], to.std[i], m))]);
  }

  /* --- the data --- */
  dp.axisX({ ticks: [20, 25, 30, 35, 40], label: "BMI" });
  dp.axisY({ ticks: [100, 200, 300], label: "sysBP (mmHg)" });
  dp.caption(SCEN_CAPTION[params.scenario] + (on ? "" : " — no model yet"));
  clip(dr, () => {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = colors.unknown;
    for (let i = 0; i < len; i += 1) {
      ctx.beginPath();
      ctx.arc(dp.sx(xs[i]), dp.sy(yOf(i)), 1.7, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (lineA > 0.02) {
      ctx.globalAlpha = lineA;
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dp.sx(X_BMI[0]), dp.sy(b0 + b1 * X_BMI[0]));
      ctx.lineTo(dp.sx(X_BMI[1]), dp.sy(b0 + b1 * X_BMI[1]));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* the claim bells, staggered by c, at the fit's own residual SD */
    if (on && c > 0.02) {
      const sig = lerp(from.sigma, to.sigma, m);
      BELL_AT.forEach((bx, k) => {
        const lt = easeInOut(clamp01(c * 3 - k * 0.85));
        if (lt <= 0.02) return;
        const mu = b0 + b1 * bx;
        const wpx = 46 * lt;
        ctx.globalAlpha = lt;
        ctx.strokeStyle = colors.theory;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(dp.sx(bx), dp.sy(mu - 3 * sig));
        ctx.lineTo(dp.sx(bx), dp.sy(mu + 3 * sig));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let q = 0; q <= 48; q += 1) {
          const v = mu - 3 * sig + (6 * sig * q) / 48;
          const off = Math.exp(-((v - mu) ** 2) / (2 * sig * sig)) * wpx;
          if (q === 0) ctx.moveTo(dp.sx(bx) + off, dp.sy(v));
          else ctx.lineTo(dp.sx(bx) + off, dp.sy(v));
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
    if (on) {
      ringTop3(ctx, colors, dr, to, fadeIn, (i) => [dp.sx(xs[i]), dp.sy(to.y[i])]);
      /* the travellers, part one: the segment grows dot-to-line */
      if (entering) {
        to.sel.forEach((i, k) => {
          const lt = clamp01((et - k * ENTRY_STAG) / ENTRY_PER);
          if (lt <= 0) return;
          const grow = easeInOut(Math.min(1, lt / 0.45));
          const x = dp.sx(xs[i]);
          const yDot = dp.sy(yOf(i));
          const yLine = dp.sy(fitOf(i));
          ctx.globalAlpha = 1 - massA;
          ctx.strokeStyle = colors.highlight;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, yDot);
          ctx.lineTo(x, lerp(yDot, yLine, grow));
          ctx.stroke();
          ctx.fillStyle = colors.highlight;
          ctx.beginPath();
          ctx.arc(x, yDot, 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
      if (hot >= 0) hotMark(ctx, colors, dp.sx(xs[hot]), dp.sy(yOf(hot)), dp.sy(fitOf(hot)));
    }
  });

  /* --- residuals vs fitted --- */
  rp.axisX({ ticks: [120, 150, 180], label: "fitted values" });
  rp.axisY({ ticks: [-100, 0, 100], label: "residuals" });
  rp.caption(on ? "each residual, against its fitted value" : "no model fitted yet");
  clip(rr, () => {
    if (!on) return;
    /* the zero line arrives with the fitted line — it is the same claim */
    ctx.globalAlpha = lineA;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rr.x, rp.sy(0));
    ctx.lineTo(rr.x + rr.w, rp.sy(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (massA > 0.02) {
      /* the ±2 SD band: faint fill, dashed edges */
      const band = 2 * lerp(from.sd, to.sd, m);
      ctx.fillStyle = colors.grid;
      ctx.globalAlpha = massA * 0.12;
      ctx.fillRect(rr.x, rp.sy(band), rr.w, rp.sy(-band) - rp.sy(band));
      ctx.globalAlpha = massA;
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1;
      for (const e of [band, -band]) {
        ctx.beginPath();
        ctx.moveTo(rr.x, rp.sy(e));
        ctx.lineTo(rr.x + rr.w, rp.sy(e));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = massA * 0.4;
      ctx.fillStyle = colors.empirical;
      for (let i = 0; i < len; i += 1) {
        ctx.beginPath();
        ctx.arc(rp.sx(fitOf(i)), rp.sy(residOf(i)), 1.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = massA;
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
      labelTop3(ctx, colors, rr, to, fadeIn, (i) => [rp.sx(b0 + b1 * xs[i]), rp.sy(to.resid[i])]);
      ctx.globalAlpha = 1;
    }
    /* the travellers, part two: dot-and-segment land at (fitted, residual) */
    if (entering) {
      to.sel.forEach((i, k) => {
        const lt = clamp01((et - k * ENTRY_STAG) / ENTRY_PER);
        const travel = easeInOut(Math.max(0, (lt - 0.5) / 0.5));
        if (travel <= 0) return;
        const x = rp.sx(fitOf(i));
        const rv = residOf(i);
        ctx.globalAlpha = (1 - massA) * 0.9 + 0.1;
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, rp.sy(0));
        ctx.lineTo(x, rp.sy(rv * travel));
        ctx.stroke();
        ctx.fillStyle = colors.highlight;
        ctx.beginPath();
        ctx.arc(x, rp.sy(rv * travel), 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    if (hot >= 0) hotMark(ctx, colors, rp.sx(fitOf(hot)), rp.sy(residOf(hot)), rp.sy(0));
  });

  /* --- normal Q-Q --- */
  qp.axisX({ ticks: [-2, 0, 2], label: "theoretical quantiles" });
  qp.axisY({ ticks: [-4, 0, 4, 8], label: "standardized residuals" });
  if (on) qp.caption("residual quantiles, against normal quantiles");
  clip(qr, () => {
    if (!on || massA <= 0.02) return;
    /* the reference line, through the quartiles as stats::qqline draws it */
    const slope = lerp(from.line.slope, to.line.slope, m);
    const inter = lerp(from.line.inter, to.line.inter, m);
    ctx.globalAlpha = massA;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(qp.sx(QQ_X[0]), qp.sy(inter + slope * QQ_X[0]));
    ctx.lineTo(qp.sx(QQ_X[1]), qp.sy(inter + slope * QQ_X[1]));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = massA * 0.45;
    ctx.fillStyle = colors.empirical;
    for (let i = 0; i < len; i += 1) {
      ctx.beginPath();
      ctx.arc(qp.sx(lerp(from.qqTh[i], to.qqTh[i], m)), qp.sy(lerp(from.std[i], to.std[i], m)), 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = massA;
    labelTop3(ctx, colors, qr, to, fadeIn, (i) => [qp.sx(to.qqTh[i]), qp.sy(to.std[i])]);
    ctx.globalAlpha = 1;
    if (hot >= 0) {
      hotMark(ctx, colors, qp.sx(lerp(from.qqTh[hot], to.qqTh[hot], m)), qp.sy(lerp(from.std[hot], to.std[hot], m)), null);
    }
  });
}

/* the hover link's mark: a ring, and a segment to the reference where
   one exists (the line, or zero) */
function hotMark(ctx, colors, x, y, yRef) {
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  if (yRef !== null) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, yRef);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
  ctx.stroke();
}

/* a label near a panel edge flips inward and clamps; ranks stagger
   vertically (RANK_DY, at module top — the TDZ rule) */
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
  ctx.globalAlpha = 1;
}

function labelTop3(ctx, colors, rect, S, alpha, posOf) {
  if (alpha <= 0.02) return;
  const keep = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  S.top3.forEach((i, rank) => {
    const [x, y] = posOf(i);
    edgeLabel(ctx, colors, rect, x, y, String(i + 1), rank);
  });
  ctx.globalAlpha = keep;
}

/* --- the model-fit act: R² climbs on pure noise, adjusted refuses --------- */
function drawAdj(ctx, colors, w, params, state) {
  const r = adjRect(w);
  const p = makePlot({ ctx, colors, rect: r, xDomain: ADJ_X, yDomain: ADJ_Y });
  p.axisX({ ticks: [0, 5, 10, 15, 20], label: "unrelated covariates added" });
  p.axisY({ ticks: [-0.2, 0, 0.2, 0.4, 0.6, 0.8], label: "R²" });
  p.caption(params.fit
    ? `sysBP ~ BMI plus pure-noise columns, on ${SUB_N} simulated patients`
    : "no model fitted yet");
  if (!params.fit) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - 2, r.y, r.w + 4, r.h);
  ctx.clip();
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
    /* the end label flips inside the frame near the right edge */
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
  ctx.restore();
}
