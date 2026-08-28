/* ============================================================================
   Widget 28 · Adjusting a Linear Model — the coefficient that moves.

   PHM5003 05-02 (Modeling — Multiple Covariates). The misconception is the
   Table 2 fallacy (Westreich & Greenland 2013): a coefficient read as THE
   effect of its variable, when it is the effect IN THIS MODEL — BMI's is
   1.721 alone and 1.499 with age beside it. Measured first
   (`_lab/lm-adjust-measure.mjs`, 21 checks): as two slopes that move is
   1.8–3.1px, so the COEFFICIENT IS A MARK on a fixed axis, where it is ~37px.

   ROUND 3 RESHAPED THE WIDGET AROUND A CONCEPT STRIP (Kenneth's pick over
   one dense page): a segmented control stages ONE idea at a time while the
   reader's model — the two covariate PILLS, and the DAG whose covariate
   nodes are click targets — persists across every tab.

     Fit the model    scatter + the model drawn as a FAMILY OF LINES (two
                      covariates fit a plane; over BMI the plane is parallel
                      lines, one per age) + the three-model table, the
                      notebook's own closer, current column marked
     Adjust           the forest — eased marks with the alone-reading as a
                      faint ghost — and the FWL slide (widget 26's motion):
                      age removed from both axes, the residual slope IS the
                      adjusted 1.499, drawn only where FWL is exact
     Collinearity     the twin act: jitter(BMI, 3) SEEDED (the notebook's own
                      cell is unseeded), the twins splitting one effect,
                      CIs ×2.5, VIF bars against the dashed 5

   The residual strip (widget 27's) rides under the scatter in every tab.
   The DAG draws the age–BMI link as a dashed double-headed ASSOCIATION
   labelled r = 0.12 — an arrow would claim a causal direction this widget
   has no business asserting; that lesson lives in fork-pipe-collider.

   THE DATA IS THE ARC'S SHARED STAGE — ../lm-least-squares/data.js, 05-02's
   frame, n = 3547 — and every deterministic printed number in 05-02 is
   reproduced to the digit by the model.js this file imports.

   `anim.easing = true` in rebuild is core's REQUEST FOR FRAMES — omitted in
   the first build, and every mark stood at alpha 0 for ever while the
   ghosts drew. Earned here; do not remove.

   FOR THE BASELINE, LATER: the pills are <button data-param>, which the
   fingerprint's setParam cannot toggle — drive states by URL, or by `hit`
   on the DAG's regions (which the region rule wants exercised anyway).
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { ols } from "../lm-least-squares/model.js";
import { N, BMI, SYSBP, AGE } from "../lm-least-squares/data.js";

const TQ = 1.960633;

const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const MEAN_AGE = meanOf(AGE);
const R_BMI_AGE = 0.12; // measured; the DAG's association label

/* --- stage geometry, one place ------------------------------------------- */
const FOREST_DOM = [-0.6, 2];
const F_ROW = 52;
const DAG_W = 218;
const DAG_H = 170;
const row1H = (concept) => (concept === "collinear" ? 220 : 170);
const scatterTop = (concept) => 30 + row1H(concept) + 26;
const SCATTER_H = 230;
const STRIP_H = 78;
/* 44px between scatter and strip: unlike widget 27 the two do NOT share an
   x-axis (the strip's is fitted sysBP, a different variable), so the scatter
   keeps its own BMI axis and the gap holds it. */
const STRIP_GAP = 44;
const HEIGHT = (concept) => scatterTop(concept) + SCATTER_H + STRIP_GAP + STRIP_H + 60;

const X_DOM = [14, 58];
const Y_DOM = [80, 300];
const RX_DOM = [-12, 26];
const RY_DOM = [-70, 120];
const FIT_DOM = [90, 200];
const RES_DOM = [-50, 70];
const PLANE_AGES = [35, 45, 55, 65];

const EASE_MS = 450;

/* THE DAG'S GEOMETRY, ONCE — draw() paints it and regions() makes the two
   covariate nodes click targets; two copies of this arithmetic is how a
   target ends up six columns from its node (the fingerprint's own incident,
   widget 26's own comment). */
function dagLayout() {
  const d = { x: 8, y: 30, w: DAG_W, h: DAG_H };
  const R = 24;
  return {
    d,
    R,
    P: {
      bmi: [d.x + 52, d.y + 36],
      age: [d.x + 52, d.y + 134],
      y: [d.x + DAG_W - 50, d.y + 85],
    },
  };
}

/* ---- the equation card, widget 27's machinery -------------------------- */
function mathmlRenders() {
  if (typeof window === "undefined" || typeof window.MathMLElement !== "function") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;font-size:16px";
  probe.innerHTML = '<math id="lma-frac"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
    + '<math id="lma-flat"><mn>1</mn></math>';
  document.body.appendChild(probe);
  const h = (id) => probe.querySelector(`#${id}`)?.getBoundingClientRect().height ?? 0;
  const stacked = h("lma-frac");
  const flat = h("lma-flat");
  probe.remove();
  return flat > 0 && stacked > flat * 1.4;
}
const MATHML = mathmlRenders();

const GENERIC_MATHML =
  "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
  + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><msub><mi>x</mi><mn>1</mn></msub>"
  + "<mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><msub><mi>x</mi><mn>2</mn></msub>"
  + "<mo>+</mo><mi>&#x2026;</mi></mrow></math>";
const GENERIC_PLAIN = "y = b₀ + b₁x₁ + b₂x₂ + …";

/* One <math> per term so the equation wraps (widget 14's lesson); a negative
   coefficient folds its sign into the operator — never "+ -0.03 ×". */
function eqHTML(terms) {
  const mag = (v) => fmt(Math.abs(v), 2);
  if (!MATHML) {
    return terms.map((t, i) => (i === 0
      ? `sysBP = ${fmt(t.num, 2)}`
      : `${t.num < 0 ? "−" : "+"} ${mag(t.num)} × ${t.plain}`)).join(" ");
  }
  return terms.map((t, i) => (i === 0
    ? `<math><mrow><mi>sysBP</mi><mo>=</mo><mn>${fmt(t.num, 2)}</mn></mrow></math>`
    : `<math><mrow><mo form="infix">${t.num < 0 ? "&#x2212;" : "+"}</mo><mn>${mag(t.num)}</mn><mo>&#xD7;</mo><mi>${t.name}</mi></mrow></math>`
  )).join(" ");
}

let mathHost = null;
let mathKey = null;
function renderEquation(terms) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = terms.map((t) => `${t.num}${t.name ?? ""}`).join(",");
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const generic = `<span style="color:var(--ink-2)">${MATHML ? GENERIC_MATHML : GENERIC_PLAIN}</span>`;
  mathHost.innerHTML = row("the model", generic) + row("this model", eqHTML(terms));
}

/* ---- fits, packaged so draw() and readout() read by NAME ---------------- */
function pack(fit, names) {
  const coefs = {};
  names.forEach((n, i) => {
    coefs[n] = { b: fit.b[i + 1], half: TQ * fit.se[i + 1] };
  });
  return { b0: fit.b[0], coefs, r2: fit.r2, sd: Math.sqrt(fit.ssRes / N) };
}

const residOn = (v, z) => {
  const g = ols(v, z);
  return v.map((x, i) => x - g.b[0] - g.b[1] * z[i]);
};

const twinActive = (p) => p.concept === "collinear" && p.bmi;
const keyOf = (p) => (p.bmi ? "b" : "") + (p.age ? "a" : "") + (twinActive(p) ? "t" : "");

defineWidget({
  slug: "lm-adjustment",
  title: "Adjusting a Linear Model",
  status: "draft",
  subtitle:
    "A linear model can hold several covariates, and each coefficient is " +
    "then the effect of its covariate with the others held constant. So a " +
    "coefficient is not a property of the variable — it is a property of " +
    "the model it sits in, and it moves when the model changes.",
  layout: "side",
  height: ({ concept }) => HEIGHT(concept),

  params: {
    /* THE CONCEPT STRIP — one idea per tab, staged; the reader's model (the
       pills, the DAG) persists underneath. All display: the fits are all
       computed regardless, and a tab change must never reset an ease. */
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "fit", label: "Fit", detail: "two covariates fit a plane — drawn as a family of lines" },
        { value: "adjust", label: "Adjust", detail: "each coefficient moves when the model changes" },
        { value: "collinear", label: "Collinearity", detail: "twin covariates split one effect; VIF detects it" },
      ],
      default: "fit",
      display: true,
    },

    model: { type: "section", label: "The model" },
    bmi: {
      type: "bool",
      style: "pill",
      label: "BMI",
      default: false,
      display: true,
    },
    age: {
      type: "bool",
      style: "pill",
      label: "age",
      default: false,
      display: true,
    },

    /* WHERE THE ADJUSTED NUMBER COMES FROM — widget 26's added-variable
       view. Lives on the Adjust tab; its slide is guarded to age being in
       the model (retarget), and the caption says what to add when it is
       not. */
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "data", label: "Data", detail: "the measurements as recorded" },
        { value: "resid", label: "Age removed", detail: "what age explains is taken out of both axes" },
      ],
      default: "data",
      display: true,
      when: { param: "concept", equals: "adjust" },
    },

    /* The twin needs no gate: the Collinearity tab IS the act — entering it
       adds the twin beside BMI (when BMI is in the model). The seed is the
       one data parameter in the widget. */
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "draws the twin's noise afresh",
      when: { param: "concept", equals: "collinear" },
    },
  },

  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study", mark: "dot" },
    { token: "highlight", label: "The current model — its coefficients, and its line(s) on the data", mark: "line" },
    { token: "empirical", label: "The same coefficient read from its covariate alone", mark: "line" },
    { token: "extreme", label: "The VIF threshold — above 5 flags collinearity", mark: "line" },
  ],

  compute({ params }) {
    const rng = makeRng(params.seed);
    const rel = BMI.map((v) => v + (rng.next() * 6 - 3));
    const fits = {
      "": pack(ols(SYSBP), []),
      b: pack(ols(SYSBP, BMI), ["bmi"]),
      a: pack(ols(SYSBP, AGE), ["age"]),
      ba: pack(ols(SYSBP, BMI, AGE), ["bmi", "age"]),
      bt: pack(ols(SYSBP, BMI, rel), ["bmi", "twin"]),
      bat: pack(ols(SYSBP, BMI, rel, AGE), ["bmi", "twin", "age"]),
    };
    const vif = (t, ...o) => 1 / (1 - ols(t, ...o).r2);
    return {
      rel,
      fits,
      meanRel: meanOf(rel),
      rx: residOn(BMI, AGE),
      ry: residOn(SYSBP, AGE),
      vifs: {
        bt: [["BMI", vif(BMI, rel)], ["twin", vif(rel, BMI)]],
        bat: [["BMI", vif(BMI, rel, AGE)], ["twin", vif(rel, BMI, AGE)], ["age", vif(AGE, BMI, rel)]],
      },
    };
  },

  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params, state }) => {
      const anim = { vmix: 0, vmixT: 0 };
      for (const k of ["bmi", "age", "twin"]) {
        anim[k] = { v: 0, h: 0, a: 0 };
        anim[`${k}T`] = { v: 0, h: 0, a: 0 };
      }
      retarget(anim, params, state);
      for (const k of ["bmi", "age", "twin"]) anim[k] = { ...anim[`${k}T`] };
      anim.vmix = anim.vmixT;
      return anim;
    },
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      const chase = (obj, key, target) => {
        const gap = target - obj[key];
        if (Math.abs(gap) < 0.0015) {
          obj[key] = target;
          return;
        }
        obj[key] += gap * rate;
        moving = true;
      };
      for (const k of ["bmi", "age", "twin"]) {
        const m = anim[k];
        const t = anim[`${k}T`];
        if (m.a < 0.02 && t.a > 0) {
          m.v = t.v;
          m.h = t.h;
        }
        chase(m, "v", t.v);
        chase(m, "h", t.h);
        chase(m, "a", t.a);
      }
      chase(anim, "vmix", anim.vmixT);
      return moving;
    },
    rebuild: (anim, { params, state }) => retarget(anim, params, state),
  },

  /* The DAG's covariate nodes toggle membership — the same write the pills
     perform, through the same door; the pills stay as the keyboard path. */
  regions({ params }) {
    const { P, R } = dagLayout();
    return ["bmi", "age"].map((k) => ({
      x: P[k][0] - R - 4,
      y: P[k][1] - R - 4,
      w: 2 * (R + 4),
      h: 2 * (R + 4),
      set: { [k]: !params[k] },
      label: k === "bmi" ? "BMI in the model" : "age in the model",
    }));
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const twinOn = twinActive(params);
    const key = keyOf(params);
    const fit = state.fits[key];
    const concept = params.concept;

    /* the equation card */
    const terms = [{ num: fit.b0 }];
    if (params.bmi) terms.push({ num: fit.coefs.bmi.b, name: "BMI", plain: "BMI" });
    if (twinOn) terms.push({ num: fit.coefs.twin.b, name: "BMI&#x2009;twin", plain: "BMI twin" });
    if (params.age) terms.push({ num: fit.coefs.age.b, name: "age", plain: "age" });
    renderEquation(terms);

    /* --- the DAG, every tab -------------------------------------------- */
    const { d, R, P } = dagLayout();
    ctx.save();
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("The covariates — click to include", d.x, d.y - 10);

    const arrow = (from, on) => {
      const [x1, y1] = P[from];
      const [x2, y2] = P.y;
      const L = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / L;
      const uy = (y2 - y1) / L;
      ctx.strokeStyle = on ? colors.ink2 : colors.grid;
      ctx.fillStyle = on ? colors.ink2 : colors.grid;
      ctx.lineWidth = on ? 2 : 1.25;
      ctx.beginPath();
      ctx.moveTo(x1 + ux * (R + 3), y1 + uy * (R + 3));
      ctx.lineTo(x2 - ux * (R + 6), y2 - uy * (R + 6));
      ctx.stroke();
      const bx = x2 - ux * (R + 5);
      const by = y2 - uy * (R + 5);
      ctx.beginPath();
      ctx.moveTo(bx + ux * 5, by + uy * 5);
      ctx.lineTo(bx - uy * 4.5, by + ux * 4.5);
      ctx.lineTo(bx + uy * 4.5, by - ux * 4.5);
      ctx.fill();
    };
    arrow("bmi", params.bmi);
    arrow("age", params.age);

    /* the association — dashed and double-headless on purpose: "these are
       correlated" is measured (r = 0.12); a direction would be a causal
       claim that belongs to fork-pipe-collider */
    ctx.strokeStyle = colors.ink3;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(P.bmi[0], P.bmi[1] + R + 4);
    ctx.lineTo(P.age[0], P.age[1] - R - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillText("r = " + fmt(R_BMI_AGE, 2), P.bmi[0] + 9, (P.bmi[1] + P.age[1]) / 2 + 4);

    const NODE = { bmi: "BMI", age: "age", y: "sysBP" };
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of ["bmi", "age", "y"]) {
      const [nx, ny] = P[k];
      const on = k === "y" || params[k];
      ctx.fillStyle = colors.surface;
      ctx.strokeStyle = k === "y" ? colors.ink2 : on ? colors.highlight : colors.ink3;
      ctx.lineWidth = on && k !== "y" ? 2 : 1.25;
      ctx.beginPath();
      ctx.arc(nx, ny, R, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = on ? colors.ink1 : colors.ink3;
      ctx.font = `${colors.fsSm} ${colors.font}`;
      ctx.fillText(NODE[k], nx, ny + 1);
    }
    ctx.restore();

    /* --- right of the DAG: the table (Fit) or the forest --------------- */
    const rp = { x: d.x + DAG_W + 40, y: 30, w: w - (d.x + DAG_W + 40) - 14 };
    if (concept === "fit") drawTable(ctx, colors, rp, state, key);
    else drawForest(ctx, colors, { ...rp, h: 34 + F_ROW * (twinOn ? 3 : 2) }, params, state, anim, twinOn);

    /* --- the scatter row ----------------------------------------------- */
    const sTop = scatterTop(concept);
    const rect = {
      x: 56,
      y: sTop,
      w: twinOn ? Math.round((w - 70) * 0.55) : w - 56 - 14,
      h: SCATTER_H,
    };
    const vmix = concept === "adjust" ? anim?.vmix ?? 0 : 0;
    const plotD = makePlot({ ctx, colors, rect, xDomain: X_DOM, yDomain: Y_DOM });
    const plotR = makePlot({ ctx, colors, rect, xDomain: RX_DOM, yDomain: RY_DOM });
    const inResid = vmix >= 0.5;
    const front = inResid ? plotR : plotD;
    if (inResid) {
      front.axisX({ label: "BMI — age removed" });
      front.axisY({ label: "sysBP — age removed" });
      front.caption("what age does not explain");
    } else {
      front.axisX({ label: "BMI" });
      front.axisY({ label: "sysBP (mmHg)" });
      front.caption(
        key === "" ? "3547 patients — no model yet"
          : concept === "fit" && params.bmi && params.age ? "the plane over BMI — one line per age"
            : "the data, and the model's line",
      );
      if (concept === "adjust" && !(params.bmi && params.age)) {
        front.note("put BMI and age in the model to watch a coefficient move");
      } else if (concept === "collinear" && !params.bmi) {
        front.note("put BMI in the model to meet its twin");
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (vmix > 0.004) {
      ctx.strokeStyle = colors.ink3;
      ctx.globalAlpha = vmix * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x, plotR.sy(0));
      ctx.lineTo(rect.x + rect.w, plotR.sy(0));
      ctx.moveTo(plotR.sx(0), rect.y);
      ctx.lineTo(plotR.sx(0), rect.y + rect.h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = colors.unknown;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < N; i += 1) {
      const px = plotD.sx(BMI[i]) + (plotR.sx(state.rx[i]) - plotD.sx(BMI[i])) * vmix;
      const py = plotD.sy(SYSBP[i]) + (plotR.sy(state.ry[i]) - plotD.sy(SYSBP[i])) * vmix;
      ctx.beginPath();
      ctx.arc(px, py, 1.7, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const lineAt = (b0, b1, alpha, width) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(plotD.sx(X_DOM[0]), plotD.sy(b0 + b1 * X_DOM[0]));
      ctx.lineTo(plotD.sx(X_DOM[1]), plotD.sy(b0 + b1 * X_DOM[1]));
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (vmix < 0.996 && key !== "") {
      const slope = params.bmi ? fit.coefs.bmi.b : 0;
      if (concept === "fit" && params.age) {
        /* THE PLANE, drawn: one line per age, same slope, lifted by the age
           coefficient — "held constant" as a picture (ggPredict's own). */
        ctx.globalAlpha = 1 - vmix;
        PLANE_AGES.forEach((a, i) => {
          const b0 = fit.b0 + fit.coefs.age.b * a + (twinOn ? fit.coefs.twin.b * state.meanRel : 0);
          lineAt(b0, slope, (0.45 + (0.55 * i) / (PLANE_AGES.length - 1)) * (1 - vmix), 2);
          ctx.fillStyle = colors.ink2;
          ctx.font = `${colors.fsXs} ${colors.font}`;
          ctx.textAlign = "left";
          const lx = 55.2;
          ctx.fillText(`age ${a}`, plotD.sx(lx) + 3, plotD.sy(b0 + slope * lx) - 3);
        });
        ctx.globalAlpha = 1;
      } else if (params.bmi || params.age) {
        const b0 = fit.b0
          + (params.age ? fit.coefs.age.b * MEAN_AGE : 0)
          + (twinOn ? fit.coefs.twin.b * state.meanRel : 0);
        lineAt(b0, slope, 1 - vmix, 2.5);
      }
    }
    if (vmix > 0.004 && key === "ba") {
      ctx.globalAlpha = vmix;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plotR.sx(RX_DOM[0]), plotR.sy(state.fits.ba.coefs.bmi.b * RX_DOM[0]));
      ctx.lineTo(plotR.sx(RX_DOM[1]), plotR.sy(state.fits.ba.coefs.bmi.b * RX_DOM[1]));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* --- the residual strip, every tab --------------------------------- */
    const strip = { x: rect.x, y: sTop + SCATTER_H + STRIP_GAP, w: rect.w, h: STRIP_H };
    const rplot = makePlot({ ctx, colors, rect: strip, xDomain: FIT_DOM, yDomain: RES_DOM });
    rplot.axisX({ label: "fitted sysBP" });
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
      const f = fit.b0
        + (params.bmi ? fit.coefs.bmi.b * BMI[i] : 0)
        + (twinOn ? fit.coefs.twin.b * state.rel[i] : 0)
        + (params.age ? fit.coefs.age.b * AGE[i] : 0);
      ctx.beginPath();
      ctx.arc(rplot.sx(f), rplot.sy(SYSBP[i] - f), 1.4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* --- the VIF panel, Collinearity tab with the twin in -------------- */
    if (!twinOn) return;
    const vrect = { x: rect.x + rect.w + 56, y: sTop, w: w - (rect.x + rect.w + 56) - 14, h: SCATTER_H };
    const rows = params.age ? state.vifs.bat : state.vifs.bt;
    const vy = (v) => vrect.y + vrect.h - (v / 8) * vrect.h;
    ctx.strokeStyle = colors.grid;
    ctx.strokeRect(vrect.x, vrect.y, vrect.w, vrect.h);
    ctx.fillStyle = colors.ink2;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("VIF", vrect.x, vrect.y - 8);
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    for (const v of [0, 4, 8]) ctx.fillText(String(v), vrect.x - 4, vy(v) + 3);
    const bw = Math.min(44, (vrect.w - 16) / rows.length - 10);
    rows.forEach(([name, v], i) => {
      const bx = vrect.x + 12 + i * ((vrect.w - 20) / rows.length);
      ctx.fillStyle = colors.empirical;
      ctx.fillRect(bx, vy(Math.min(v, 8)), bw, vy(0) - vy(Math.min(v, 8)));
      ctx.fillStyle = colors.ink2;
      ctx.textAlign = "center";
      ctx.fillText(name, bx + bw / 2, vrect.y + vrect.h + 13);
      ctx.fillText(fmt(v, 1), bx + bw / 2, vy(Math.min(v, 8)) - 5);
    });
    ctx.strokeStyle = colors.extreme;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vrect.x, vy(5));
    ctx.lineTo(vrect.x + vrect.w, vy(5));
    ctx.stroke();
    ctx.setLineDash([]);
  },

  readout({ params, state }) {
    const key = keyOf(params);
    const fit = state.fits[key];
    const tiles = [
      {
        label: "R²",
        value: fmt(fit.r2, 2),
        note: key === "" ? "no covariates — nothing explained yet" : "variance explained by the model",
      },
      {
        label: "Residual spread",
        value: fmt(fit.sd, 1),
        note: "mmHg left over per patient — watch it shrink as covariates enter",
      },
    ];
    if (twinActive(params)) {
      const rows = params.age ? state.vifs.bat : state.vifs.bt;
      const worst = Math.max(...rows.map(([, v]) => v));
      tiles.push({
        label: "Largest VIF",
        value: fmt(worst, 1),
        note: "above 5 flags collinearity — the twins explain each other",
      });
    }
    return tiles;
  },

  summary({ params, state }) {
    const key = keyOf(params);
    const fit = state.fits[key];
    const parts = [];
    if (key === "") {
      parts.push("A diagram of the candidate covariates, and a scatter of systolic blood pressure against BMI for 3547 Framingham patients, with no model fitted yet.");
    } else {
      const names = [params.bmi ? "BMI" : null, twinActive(params) ? "a noisy twin of BMI" : null, params.age ? "age" : null].filter(Boolean);
      parts.push(`A linear model of systolic blood pressure on ${names.join(" and ")} for 3547 Framingham patients.`);
      if (params.bmi) parts.push(`The BMI coefficient reads ${fmt(fit.coefs.bmi.b, 2)} in this model.`);
    }
    parts.push(`R² is ${fmt(fit.r2, 2)}, and the residual spread is ${fmt(fit.sd, 1)} mmHg.`);
    return parts.join(" ");
  },
});

/* --- the forest (Adjust and Collinearity tabs) --------------------------- */
function drawForest(ctx, colors, frect, params, state, anim, twinOn) {
  const fx = (v) => frect.x + ((v - FOREST_DOM[0]) / (FOREST_DOM[1] - FOREST_DOM[0])) * frect.w;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(frect.x, frect.y, frect.w, frect.h);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = colors.ink3;
  ctx.beginPath();
  ctx.moveTo(fx(0), frect.y);
  ctx.lineTo(fx(0), frect.y + frect.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const v of [-0.5, 0, 0.5, 1, 1.5, 2]) ctx.fillText(fmt(v, 1), fx(v), frect.y + frect.h + 13);
  ctx.fillText("mmHg per unit of the covariate", frect.x + frect.w / 2, frect.y + frect.h + 27);

  const ROWS = twinOn ? ["bmi", "twin", "age"] : ["bmi", "age"];
  const NAMES = { bmi: "BMI", twin: "BMI twin", age: "age" };
  const GHOST = {
    bmi: { v: state.fits.b.coefs.bmi.b, h: state.fits.b.coefs.bmi.half, show: params.bmi && (params.age || twinOn) },
    age: { v: state.fits.a.coefs.age.b, h: state.fits.a.coefs.age.half, show: params.age && params.bmi },
    twin: { show: false },
  };
  ROWS.forEach((k, i) => {
    const y = frect.y + 34 + i * F_ROW;
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsSm} ${colors.font}`;
    /* Right-aligned against the frame: a left-anchored column here reached
       back into the DAG and sat on its sysBP node. */
    ctx.textAlign = "right";
    ctx.fillText(NAMES[k], frect.x - 8, y + 4);
    const g = GHOST[k];
    if (g.show) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx(g.v - g.h), y);
      ctx.lineTo(fx(g.v + g.h), y);
      ctx.stroke();
      ctx.fillStyle = colors.empirical;
      ctx.beginPath();
      ctx.arc(fx(g.v), y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const m = anim?.[k];
    if (m && m.a > 0.02) {
      ctx.globalAlpha = m.a;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx(m.v - m.h), y);
      ctx.lineTo(fx(m.v + m.h), y);
      ctx.stroke();
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.arc(fx(m.v), y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText(fmt(m.v, 2), fx(m.v), y - 11);
      ctx.globalAlpha = 1;
    } else if (!g.show) {
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText("not in the model", fx(0.7), y + 4);
    }
  });
}

/* --- the three-model table (Fit tab) — the notebook's own closer --------- */
function drawTable(ctx, colors, rp, state, key) {
  const F = state.fits;
  const cols = [
    { key: "b", head: "~ BMI", cells: [F.b.b0, F.b.coefs.bmi.b, null, F.b.r2] },
    { key: "a", head: "~ age", cells: [F.a.b0, null, F.a.coefs.age.b, F.a.r2] },
    { key: "ba", head: "~ BMI + age", cells: [F.ba.b0, F.ba.coefs.bmi.b, F.ba.coefs.age.b, F.ba.r2] },
  ];
  const rows = ["Intercept", "BMI", "age", "R²"];
  const labW = 64;
  const colW = (rp.w - labW) / cols.length;
  const rowH = 30;
  const top = rp.y + 24;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Three models, side by side", rp.x, rp.y + 2);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  cols.forEach((c, j) => {
    const cx = rp.x + labW + j * colW + colW / 2;
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.fillText(c.head, cx, top + 12);
  });
  rows.forEach((r, i) => {
    const ry = top + 34 + i * rowH;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText(r, rp.x, ry);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rp.x, ry - rowH + 12);
    ctx.lineTo(rp.x + rp.w, ry - rowH + 12);
    ctx.stroke();
    cols.forEach((c, j) => {
      const cx = rp.x + labW + j * colW + colW / 2;
      const v = c.cells[i];
      ctx.fillStyle = colors.ink1;
      ctx.textAlign = "center";
      ctx.fillText(v === null ? "—" : fmt(v, i === 3 ? 3 : 2), cx, ry);
    });
  });
  /* the column the pills currently spell, marked — the table and the model
     switches reading each other */
  const j = cols.findIndex((c) => c.key === key);
  if (j >= 0) {
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rp.x + labW + j * colW + 4, top + 2, colW - 8, 34 + rows.length * rowH - 22);
  }
}

function retarget(anim, params, state) {
  const twinOn = twinActive(params);
  const key = keyOf(params);
  const fit = state.fits[key];
  const set = (k, on, coef) => {
    anim[`${k}T`] = on
      ? { v: coef.b, h: coef.half, a: 1 }
      : { ...anim[`${k}T`], a: 0 };
  };
  set("bmi", params.bmi, params.bmi ? fit.coefs.bmi : null);
  set("age", params.age, params.age ? fit.coefs.age : null);
  set("twin", twinOn, twinOn ? fit.coefs.twin : null);
  anim.vmixT = params.concept === "adjust" && params.age && params.view === "resid" ? 1 : 0;
  for (const k of ["bmi", "age", "twin"]) {
    const m = anim[k];
    const t = anim[`${k}T`];
    if (Math.abs(m.v - t.v) > 0.0015 || Math.abs(m.h - t.h) > 0.0015 || Math.abs(m.a - t.a) > 0.0015) {
      anim.easing = true;
    }
  }
  if (Math.abs(anim.vmix - anim.vmixT) > 0.0015) anim.easing = true;
}
