/* ============================================================================
   Widget 28 · Adjusting a Linear Model — the coefficient that moves.

   PHM5003 05-02 (Modeling — Multiple Covariates). The misconception is the
   Table 2 fallacy (Westreich & Greenland 2013): a coefficient is read as THE
   effect of its variable, when it is the effect IN THIS MODEL — BMI's is
   1.721 alone and 1.499 with age beside it, and the widget's whole job is to
   make that move watchable. Measured first (`_lab/lm-adjust-measure.mjs`,
   21 checks): drawn as two slopes on the scatter the move is 1.8–3.1px, so
   the COEFFICIENT IS A MARK on a 0-scale axis, where the same move is ~37px.

   Kenneth's picks, 2026-08-28, from `_lab/lm-adjust-stage.html`: B — the
   switches choose the model and each mark EASES to its value in it, the
   alone-reading staying as a faint ghost (widget 12's motion); the FWL
   slide behind a View (widget 26's motion — age removed from both axes, and
   the residual cloud's slope IS the adjusted 1.499, exact by Frisch–Waugh);
   the collinearity act IN, behind an "Add a twin covariate" gate (the twins
   split one effect, CIs ×2.5, VIF against the dashed 5); two bool switches
   so the EMPTY model exists (the flat mean, R² 0); and widget 27's residual
   strip rides along — the current model's residuals against its fitted
   values, the cloud tightening as covariates enter (sd 21.1 → 19.9 → 18.7).

   THE DATA IS THE ARC'S SHARED STAGE — ../lm-least-squares/data.js, 05-02's
   own frame, n = 3547 — and every deterministic printed number in 05-02 is
   reproduced to the digit by the same model.js this file imports. The one
   random thing is the twin (the notebook's jitter(BMI, 3), which it left
   UNSEEDED; here it is seeded, and every claim survives reseeding — the
   twin is n.s. in 186 of 200 seeds).

   The FWL view draws its slope line ONLY for the exact case (both BMI and
   age in, no twin): there the residual slope equals the model's BMI
   coefficient to 1e-9. For any other model the cloud is shown without a
   line rather than with an approximate one.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { ols } from "../lm-least-squares/model.js";
import { N, BMI, SYSBP, AGE } from "../lm-least-squares/data.js";

const TQ = 1.960633; // qt(0.975, df) at these df, to the notebook's own digits

const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const MEAN_BMI = meanOf(BMI);
const MEAN_AGE = meanOf(AGE);

/* --- stage geometry, one place ------------------------------------------- */
const FOREST_DOM = [-0.6, 2];       // fixed: the twin's CI dips below zero, and
                                    // a domain that never moves keeps the eases honest
const F_ROW = 52;
const forestH = (twin) => 34 + F_ROW * (twin ? 3 : 2) + 4;
const scatterTop = (twin) => 30 + forestH(twin) + 44;
const SCATTER_H = 230;
const STRIP_H = 78;
const HEIGHT = (twin) => scatterTop(twin) + SCATTER_H + 14 + STRIP_H + 60;

const X_DOM = [14, 58];             // widget 27's frame, verbatim — one arc, one stage
const Y_DOM = [80, 300];
const RX_DOM = [-12, 26];           // FWL residual windows, 1%-99% padded (measured)
const RY_DOM = [-70, 120];
const FIT_DOM = [90, 200];          // the strip's fitted-value window
const RES_DOM = [-50, 70];          // widget 27's strip window, verbatim

const EASE_MS = 450;

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

/* One <math> per term so the equation wraps at narrow widths — the MathML
   linebreaking lesson from widget 14, applied before it bites. A negative
   coefficient folds its sign into the operator (widget 14's convention):
   "− 0.03 × BMI twin", never "+ -0.03 ×". */
function eqHTML(terms) {
  const sign = (v) => (v < 0 ? "−" : "+");
  const mag = (v) => fmt(Math.abs(v), 2);
  if (!MATHML) {
    return terms.map((t, i) => (i === 0 ? `sysBP = ${fmt(t.num, 2)}` : `${sign(t.num)} ${mag(t.num)} × ${t.plain}`)).join(" ");
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

/* The model key the three switches spell. The twin exists only beside BMI —
   it is a twin OF BMI — and the control is hidden otherwise. */
const keyOf = (p) => (p.bmi ? "b" : "") + (p.age ? "a" : "") + (p.twin && p.bmi ? "t" : "");

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
  height: ({ twin, bmi }) => HEIGHT(Boolean(twin && bmi)),

  params: {
    model: { type: "section", label: "The model" },
    bmi: {
      type: "bool",
      label: "BMI in the model",
      default: false,
      display: true,
      detail: "sysBP gains a BMI term",
    },
    age: {
      type: "bool",
      label: "Age in the model",
      default: false,
      display: true,
      detail: "sysBP gains an age term",
    },
    /* WHERE THE ADJUSTED NUMBER COMES FROM — widget 26's added-variable
       view, verbatim in spirit: age removed from BOTH axes, and what is
       left is the comparison the adjusted coefficient makes. Shown only
       while age is in the model, because it is a reading of that model. */
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "data", label: "Data", detail: "the measurements as recorded" },
        { value: "resid", label: "Age removed", detail: "what age explains is taken out of both axes" },
      ],
      default: "data",
      display: true,
      when: { param: "age" },
    },

    problem: { type: "section", label: "A twin covariate", when: { param: "bmi" } },
    /* The collinearity act, gated. The twin is the notebook's own
       jitter(BMI, 3) — but SEEDED, because the notebook's cells are one
       unseeded draw and a widget must reproduce itself. */
    twin: {
      type: "gate",
      label: "Add a twin covariate",
      labelOff: "Remove the twin",
      detail: "a copy of BMI with noise (±3) — the twins then share one effect",
      default: false,
      display: true,
      when: { param: "bmi" },
    },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "draws the twin's noise afresh",
      when: { param: "twin" },
    },
  },

  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study", mark: "dot" },
    { token: "highlight", label: "The current model — its coefficients, and its line on the data", mark: "line" },
    { token: "empirical", label: "The same coefficient read from its covariate alone", mark: "line" },
    { token: "extreme", label: "The VIF threshold — above 5 flags collinearity", mark: "line" },
  ],

  /* Everything is computed from the one data parameter (the twin's seed);
     the switches only choose what is DISPLAYED, so a toggle re-reads this
     state and the eases stay continuous (widget 26's arrangement). */
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

  /* No drive buttons: the motion is eases chasing the switches, widget 26's
     shape — marks glide to their value in the new model, the view slides,
     and Reset alone sits in the drive row. */
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
        /* A mark entering from nothing rises IN PLACE rather than gliding in
           from wherever it last died. */
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

  draw({ ctx, colors, w, h, params, state, anim }) {
    const twinOn = Boolean(params.twin && params.bmi);
    const key = keyOf(params);
    const fit = state.fits[key];

    /* the equation card */
    const terms = [{ num: fit.b0 }];
    if (params.bmi) terms.push({ num: fit.coefs.bmi.b, name: "BMI", plain: "BMI" });
    if (twinOn) terms.push({ num: fit.coefs.twin.b, name: "BMI&#x2009;twin", plain: "BMI twin" });
    if (params.age) terms.push({ num: fit.coefs.age.b, name: "age", plain: "age" });
    renderEquation(terms);

    /* --- the forest: coefficients as marks ----------------------------- */
    const frect = { x: 96, y: 30, w: w - 96 - 14, h: forestH(twinOn) };
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
    /* The alone-readings, drawn as static ghosts whenever the mark's model
       holds more than that covariate — the comparison IS the lesson, and a
       ghost derived from the params alone keeps the URL the only state. */
    const GHOST = {
      bmi: { v: state.fits.b.coefs.bmi.b, h: state.fits.b.coefs.bmi.half, show: params.bmi && (params.age || twinOn) },
      age: { v: state.fits.a.coefs.age.b, h: state.fits.a.coefs.age.half, show: params.age && params.bmi },
      twin: { show: false },
    };
    ROWS.forEach((k, i) => {
      const y = frect.y + 34 + i * F_ROW;
      ctx.fillStyle = colors.ink2;
      ctx.font = `${colors.fsSm} ${colors.font}`;
      ctx.textAlign = "left";
      ctx.fillText(NAMES[k], 8, y + 4);
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

    /* --- the scatter, with the FWL slide ------------------------------- */
    const sTop = scatterTop(twinOn);
    const rect = {
      x: 56,
      y: sTop,
      w: twinOn ? Math.round((w - 70) * 0.55) : w - 56 - 14,
      h: SCATTER_H,
    };
    const vmix = anim?.vmix ?? 0;
    const plotD = makePlot({ ctx, colors, rect, xDomain: X_DOM, yDomain: Y_DOM });
    const plotR = makePlot({ ctx, colors, rect, xDomain: RX_DOM, yDomain: RY_DOM });
    const inResid = vmix >= 0.5;
    const front = inResid ? plotR : plotD;
    if (inResid) {
      front.axisY({ label: "sysBP — age removed" });
      front.caption("what age does not explain");
    } else {
      front.axisY({ label: "sysBP (mmHg)" });
      front.caption(key === "" ? "3547 patients — no model yet" : "the data, and the model's line");
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

    /* Data view: the model's line against BMI, drawn at the mean of the
       other covariates. The 1.72 -> 1.50 change of slope is 3px here —
       measured — which is exactly why the forest above exists. */
    if (vmix < 0.996 && params.bmi) {
      const slope = fit.coefs.bmi.b;
      const b0 = fit.b0
        + (params.age ? fit.coefs.age.b * MEAN_AGE : 0)
        + (twinOn ? fit.coefs.twin.b * state.meanRel : 0);
      ctx.globalAlpha = 1 - vmix;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plotD.sx(X_DOM[0]), plotD.sy(b0 + slope * X_DOM[0]));
      ctx.lineTo(plotD.sx(X_DOM[1]), plotD.sy(b0 + slope * X_DOM[1]));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* Residual view: the slope through the origin is drawn ONLY for the
       exact model (BMI + age, no twin), where it IS the adjusted
       coefficient by FWL — asserted at 1e-9 by the measure script. */
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

    /* --- the residual strip, widget 27's, against FITTED values --------
       With several covariates the fitted value is the honest x (the
       notebook's own axes). The empty model predicts one number for
       everyone, so its residuals stand in a single column — R² 0, drawn. */
    const strip = { x: rect.x, y: sTop + SCATTER_H + 14, w: rect.w, h: STRIP_H };
    const rplot = makePlot({ ctx, colors, rect: strip, xDomain: FIT_DOM, yDomain: RES_DOM });
    rplot.axisX({ label: inResid ? "fitted sysBP — the model's, unchanged by the view" : "fitted sysBP" });
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

    /* --- the VIF panel, beside the scatter while the twin is in -------- */
    if (!twinOn) return;
    const vrect = { x: rect.x + rect.w + 56, y: sTop, w: w - (rect.x + rect.w + 56) - 14, h: SCATTER_H };
    const rows = params.age ? state.vifs.bat : state.vifs.bt;
    const vy = (v) => vrect.y + vrect.h - (v / 8) * vrect.h;
    ctx.strokeStyle = colors.grid;
    ctx.strokeRect(vrect.x, vrect.y, vrect.w, vrect.h);
    ctx.fillStyle = colors.ink2;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.textAlign = "left";
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
    if (params.twin && params.bmi) {
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
      parts.push("A scatter of systolic blood pressure against BMI for 3547 Framingham patients, with no model fitted yet.");
    } else {
      const names = [params.bmi ? "BMI" : null, params.twin && params.bmi ? "a noisy twin of BMI" : null, params.age ? "age" : null].filter(Boolean);
      parts.push(`A linear model of systolic blood pressure on ${names.join(" and ")} for 3547 Framingham patients; its coefficients are drawn as marks with 95% confidence intervals.`);
      if (params.bmi) parts.push(`The BMI coefficient reads ${fmt(fit.coefs.bmi.b, 2)} in this model.`);
    }
    parts.push(`R² is ${fmt(fit.r2, 2)}, and the residual spread is ${fmt(fit.sd, 1)} mmHg.`);
    return parts.join(" ");
  },
});

/* Targets for every ease, from the params alone — called by init and by
   rebuild, so a display change retargets and never resets. `anim.easing`
   is core's request-for-frames contract (widget.js consumes it after
   rebuild); without it the marks would stand at their old values for ever,
   which is exactly how this file's first build shipped only ghosts. */
function retarget(anim, params, state) {
  const twinOn = Boolean(params.twin && params.bmi);
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
  anim.vmixT = params.age && params.view === "resid" ? 1 : 0;
  for (const k of ["bmi", "age", "twin"]) {
    const m = anim[k];
    const t = anim[`${k}T`];
    if (Math.abs(m.v - t.v) > 0.0015 || Math.abs(m.h - t.h) > 0.0015 || Math.abs(m.a - t.a) > 0.0015) {
      anim.easing = true;
    }
  }
  if (Math.abs(anim.vmix - anim.vmixT) > 0.0015) anim.easing = true;
}
