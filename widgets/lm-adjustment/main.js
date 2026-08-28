/* ============================================================================
   Widget 28 · Adjusting a Linear Model — the coefficient that moves.

   PHM5003 05-02 (Modeling — Multiple Covariates). The misconception is the
   Table 2 fallacy (Westreich & Greenland 2013): a coefficient read as THE
   effect of its variable, when it is the effect IN THIS MODEL — BMI's is
   1.721 alone and 1.499 with age beside it. Measured first
   (`_lab/lm-adjust-measure.mjs`, 21 checks): as two slopes that move is
   1.8–3.1px, so the COEFFICIENT IS A MARK on a fixed axis, where it is ~37px.

   ROUND 3 built a three-tab CONCEPT strip (Fit · Adjust · Collinearity).
   ROUND 8 MERGED FIT AND ADJUST (mocked in _lab/lm-adjust5.html; Kenneth's
   pick, with the table, with the FWL view). The seam between them failed
   twice — round 5 moved the table off Fit to stop an overlap, round 7's
   band families recreated it — because a band family IS the adjusted
   slope, drawn: fitting and adjusting are one act seen in two spaces. The
   move 1.72 → 1.50 is 1.8–3.1px in data space (measured), so only the
   forest can carry it; the panels carry the conditional reading; one page
   holds both, and a pill click moves everything at once. The fit-quality
   bars died with the merge — they duplicated the R² and spread tiles. The
   reader's model — the covariate PILLS, and the DAG whose covariate nodes
   are click targets — persists across both tabs.

     Fit and adjust   BMI + age ONLY (round 9: weight acts on its own tab
                      — this page demonstrates adjustment undistracted).
                      DAG + the forest (eased marks, the alone-reading as
                      a ghost, the move annotated) · both marginals, the
                      model as a FAMILY OF LINES (the plane seen from each
                      side) · the three-model table, the notebook's own
                      closer · View: the FWL slide on BOTH panels (widget
                      26's motion) — each covariate and sysBP with the
                      OTHER removed; each residual slope IS its adjusted
                      coefficient, drawn only where FWL is exact
     Collinearity     the twin act: weight simulated from BMI (seeded; the
                      notebook's own cell is unseeded), the twins splitting
                      one effect, CIs ×2.5. ROUND 11 (candidate A, mocked
                      in _lab/lm-adjust6.html): the twins' marginals are
                      PERSISTENT (weight's flat line under a rising cloud —
                      attribution broken in data space), and the VIF check
                      is its own SECTION below — the notebook's own
                      fit-then-check order — with the formula concrete
                      (subject ~ the others → R² → VIF) and the bars
                      clickable to choose the subject (`vifvar`, hidden;
                      the bars are the control)

   The residual strip (widget 27's) rides under the Fit-and-adjust page
   only (round 12 — on Collinearity its message would be a non-event).
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

   ROUND 5 (Kenneth's review): the TABLE MOVED TO ADJUST — it is a
   comparison across models, and parking it on Fit spoiled Adjust's
   punchline; Fit's right panel now shows fit-quality bars (R², and the
   residual spread against the no-model 21.1). The forest ANNOTATES the
   move ("1.72 → 1.50 when age enters"). And the twin became WEIGHT — the
   realistic story: BMI is weight/height², and a data scientist includes
   both without noticing they carry one piece of information. The file has
   no weight column, so each patient's weight is SIMULATED as
   BMI × height² with height ~ N(1.68, 0.05) — UNISEX AND TIGHT ON
   PURPOSE, and that is a measured ruling, not a shortcut: sex-specific
   heights made weight a proxy FOR SEX (the weight/BMI ratio identifies
   it), which handed weight a real, significantly negative coefficient in
   86% of seeds — the widget would have taught that weight lowers blood
   pressure. Unisex at sd 0.05: r(BMI, weight) = 0.93, VIF 7.7 ± 0.2,
   weight n.s. in 187/200 seeds, b(BMI) unbiased (1.502 ± 0.208 vs 1.499),
   CI ×2.76 — and R² and residual sd IDENTICAL to 4 decimals with or
   without it: prediction untouched, attribution broken. The screen says
   the weight is simulated (the honesty note on its panel). The Seed
   control is HIDDEN (Kenneth: nothing on screen should need "seed"
   explained; the parameter remains for the URL and the harness), and the
   wandering-split panel (three seeds side by side) was drawn in
   `_lab/lm-adjust3.html` §2C and DECLINED for the same reason.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { ols } from "../lm-least-squares/model.js";
import { N, BMI, SYSBP, AGE } from "../lm-least-squares/data.js";

const TQ = 1.960633;

const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const MEAN_AGE = meanOf(AGE);
const MEAN_BMI = meanOf(BMI);
const R_BMI_AGE = 0.12; // measured; the DAG's association label

/* --- stage geometry, one place ------------------------------------------- */
const FOREST_DOM = [-0.6, 2];
const F_ROW = 52;
const DAG_W = 218;
const DAG_H = 170;
const row1H = (wide) => (wide ? 220 : 170);
const scatterTop = (wide) => 30 + row1H(wide) + 26;
const SCATTER_H = 230;
const STRIP_H = 78;
/* 44px between scatter and strip: unlike widget 27 the two do NOT share an
   x-axis (the strip's is fitted sysBP, a different variable), so the scatter
   keeps its own BMI axis and the gap holds it. */
const STRIP_GAP = 44;
/* The Model tab stacks a fourth row — the three-model table — between the
   marginals and the strip; Collinearity keeps the three-row stack. Every
   top is derived from the row above, so nothing is counted twice. */
const TABLE_H = 104;
/* +56, not +40: the panels' x-axis labels reach ~48px below the frame, and
   at +40 the table's title sat 8px under them — caught on screen */
const tableTop = (wide) => scatterTop(wide) + SCATTER_H + 56;
/* The Collinearity tab (round 11, candidate A — mocked in
   _lab/lm-adjust6.html): the twins' panels stay on screen and the VIF
   check is its own SECTION below them, the notebook's own fit-then-check
   order (05-02 § "Using a VIF to detect collinearity"). 48 after the
   panels holds their x-axis labels; the section head is three lines
   (title, recipe, formula) before its panel row. */
const TWIN_H = 210;
const DIAG_H = 190;
const diagTop = () => scatterTop(true) + TWIN_H + 48;
/* The residual strip is the FIT TAB'S only (round 12, reversing round 3's
   every-tab ruling on Kenneth's call): on Collinearity its message would
   be "the residuals did not change", a non-event no reader can see
   without comparing states from memory — the residual-spread tile says
   it as a number, and the section is the tab's closer. */
const stripTop = (wide) => tableTop(wide) + TABLE_H + 24;
const HEIGHT = (concept, wide) => (concept === "fit"
  ? stripTop(wide) + STRIP_H + 60
  : diagTop() + 48 + DIAG_H + 80);

const X_DOM = [14, 58];
const W_DOM = [40, 120]; // the simulated weight's window, kg
const Y_DOM = [80, 300];
const RX_DOM = [-12, 26];
const RY_DOM = [-70, 120];
/* the right panel's FWL window, measured: age|BMI spans −18.4..20.9, and
   sysBP|BMI spans the same window as sysBP|age, so RY_DOM serves both */
const R2X_DOM = [-20, 22];
const FIT_DOM = [90, 200];
const RES_DOM = [-50, 70];

const EASE_MS = 450;

/* THE DAG'S GEOMETRY, ONCE — draw() paints it and regions() makes the two
   covariate nodes click targets; two copies of this arithmetic is how a
   target ends up six columns from its node (the fingerprint's own incident,
   widget 26's own comment). The Collinearity tab's DAG holds a fourth node
   (weight), so the layout is per shape and regions() uses the same one. */
function dagLayout(wide) {
  if (wide) {
    const d = { x: 8, y: 30, w: DAG_W, h: 190 };
    const R = 22;
    return {
      d,
      R,
      P: {
        bmi: [d.x + 50, d.y + 30],
        twin: [d.x + 50, d.y + 96],
        age: [d.x + 50, d.y + 162],
        y: [d.x + DAG_W - 48, d.y + 96],
      },
    };
  }
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

/* Weight is a REAL member of the model (round 7: the twins are clickable
   APART — each is fine alone; only both together break) — but it acts ON
   THE COLLINEARITY TAB ONLY. Round 9 reversed round 7's cross-tab
   persistence (Kenneth: the Fit-and-adjust page demonstrates BMI + age
   adjustment and nothing else — don't overcomplicate). The `weight`
   parameter survives a tab switch, so returning to Collinearity restores
   the reader's composition; the fit-adjust tab simply never reads it. */
const twinActive = (p) => Boolean(p.weight) && p.concept === "collinear";
const keyOf = (p) => (p.bmi ? "b" : "") + (p.age ? "a" : "") + (twinActive(p) ? "t" : "");
const dagWide = (p) => p.concept === "collinear";

defineWidget({
  slug: "lm-adjustment",
  title: "Fitting Multiple Covariates",
  status: "draft",
  subtitle:
    "A linear model can hold several covariates at once, and fitting it " +
    "estimates their coefficients together. Each coefficient is then read " +
    "with the others held constant — a property of the model it sits in, " +
    "not of the variable, so it moves when the model changes.",
  layout: "side",
  height: ({ concept }) => HEIGHT(concept, concept === "collinear"),

  params: {
    /* THE CONCEPT STRIP — round 8 merged Fit and Adjust into Model (they
       were one act split over two tabs); the reader's model (the pills,
       the DAG) persists underneath. All display: the fits are all computed
       regardless, and a tab change must never reset an ease. */
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "fit", label: "Fit and adjust", detail: "covariates fit a plane, and each coefficient is read with the others held constant" },
        { value: "collinear", label: "Collinearity", detail: "add weight beside BMI — two covariates, one piece of information" },
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
    /* The third pill, visible on the Collinearity tab — a covariate like
       any other, which is the point: nothing about weight is broken, and
       the reader discovers that weight ALONE predicts fine; only both
       twins together split the credit. Membership persists off-tab. */
    weight: {
      type: "bool",
      style: "pill",
      label: "weight",
      default: false,
      display: true,
      when: { param: "concept", equals: "collinear" },
    },

    /* WHERE THE ADJUSTED NUMBERS COME FROM — widget 26's added-variable
       view, on BOTH panels at once (round 8): each covariate and sysBP
       with the OTHER covariate regressed out, so each residual slope IS
       its adjusted coefficient. Exact only for the two-covariate model,
       which is why retarget guards the slide to exactly BMI + age; the
       panel note names the missing ingredient otherwise. */
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "data", label: "Data", detail: "the measurements as recorded" },
        { value: "resid", label: "Other removed", detail: "what the other covariate explains is taken out of both axes" },
      ],
      default: "data",
      display: true,
      when: { param: "concept", equals: "fit" },
    },

    /* Weight needs no gate: the Collinearity tab IS the act — entering it
       adds weight beside BMI (when BMI is in the model). The seed draws
       the simulated heights and is HIDDEN (round 5, Kenneth: nothing on
       screen should need "seed" explained); it stays a parameter so the
       URL and the harness can still pin it. */
    seed: { type: "int", min: 1, max: 200, default: 1, hidden: true },

    /* Which covariate the VIF section regresses on the others — set by
       CLICKING A VIF BAR (regions): the bars are the control, the way the
       DAG's nodes are, so the rail carries no extra control for it. A
       value naming a covariate not in the current model falls back to the
       largest VIF, which is also what a fresh reader should see first. */
    vifvar: {
      type: "segmented",
      options: [
        { value: "bmi", label: "BMI" },
        { value: "weight", label: "weight" },
        { value: "age", label: "age" },
      ],
      default: "weight",
      display: true,
      hidden: true,
    },
  },

  /* No VIF entry (round 10, Kenneth): the legend is static core-side, so
     an entry here would put "VIF" on the Fit-and-adjust page too; the
     Collinearity tile's note names the threshold instead. */
  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study", mark: "dot" },
    { token: "highlight", label: "The current model — its coefficients, and its line(s) on the data", mark: "line" },
    { token: "empirical", label: "The same coefficient read from its covariate alone", mark: "line" },
  ],

  compute({ params }) {
    /* Weight, simulated: BMI × height², height ~ N(1.68, 0.05) UNISEX —
       the measured ruling in the header (sex-specific heights made weight
       a sex proxy with a real negative coefficient). Internally the weight
       covariate keeps the `twin`/`t` keys — it IS the twin act, renamed
       on every reader-facing surface. */
    const rng = makeRng(params.seed);
    const gauss = () => {
      const u = Math.max(rng.next(), 1e-12);
      const v = rng.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const wgt = BMI.map((b) => {
      const ht = 1.68 + 0.05 * gauss();
      return b * ht * ht;
    });
    const fits = {
      "": pack(ols(SYSBP), []),
      b: pack(ols(SYSBP, BMI), ["bmi"]),
      a: pack(ols(SYSBP, AGE), ["age"]),
      t: pack(ols(SYSBP, wgt), ["twin"]),
      ba: pack(ols(SYSBP, BMI, AGE), ["bmi", "age"]),
      bt: pack(ols(SYSBP, BMI, wgt), ["bmi", "twin"]),
      at: pack(ols(SYSBP, wgt, AGE), ["twin", "age"]),
      bat: pack(ols(SYSBP, BMI, wgt, AGE), ["bmi", "twin", "age"]),
    };
    const vif = (t, ...o) => 1 / (1 - ols(t, ...o).r2);
    const corrBW = (() => {
      const mb = meanOf(BMI);
      const mw = meanOf(wgt);
      let sab = 0;
      let saa = 0;
      let sbb = 0;
      for (let i = 0; i < N; i += 1) {
        sab += (BMI[i] - mb) * (wgt[i] - mw);
        saa += (BMI[i] - mb) ** 2;
        sbb += (wgt[i] - mw) ** 2;
      }
      return sab / Math.sqrt(saa * sbb);
    })();
    return {
      wgt,
      corrBW,
      fits,
      meanWgt: meanOf(wgt),
      rx: residOn(BMI, AGE),
      ry: residOn(SYSBP, AGE),
      rx2: residOn(AGE, BMI),
      ry2: residOn(SYSBP, BMI),
      /* VIFs for every ≥2-covariate model, keyed like the fits — the
         Collinearity tab's bars work for ANY composition, so bmi + age's
         quiet ~1.02 pair is on screen too, the contrast that makes 7.7
         mean something. */
      vifs: {
        ba: [["BMI", vif(BMI, AGE)], ["age", vif(AGE, BMI)]],
        bt: [["BMI", vif(BMI, wgt)], ["weight", vif(wgt, BMI)]],
        at: [["weight", vif(wgt, AGE)], ["age", vif(AGE, wgt)]],
        bat: [["BMI", vif(BMI, wgt, AGE)], ["weight", vif(wgt, BMI, AGE)], ["age", vif(AGE, BMI, wgt)]],
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
     perform, through the same door; the pills stay as the keyboard path.
     On the Collinearity tab the VIF BARS are targets too (round 11),
     setting which covariate the section regresses on the others; their
     rects come from vifLayout, the same arithmetic draw() paints with. */
  regions({ w, params }) {
    const wide = dagWide(params);
    const { P, R } = dagLayout(wide);
    const keys = wide ? ["bmi", "twin", "age"] : ["bmi", "age"];
    const PARAM = { bmi: "bmi", twin: "weight", age: "age" };
    const LABEL = { bmi: "BMI in the model", twin: "weight in the model", age: "age in the model" };
    const out = keys.map((k) => ({
      x: P[k][0] - R - 4,
      y: P[k][1] - R - 4,
      w: 2 * (R + 4),
      h: 2 * (R + 4),
      set: { [PARAM[k]]: !params[PARAM[k]] },
      label: LABEL[k],
    }));
    if (params.concept === "collinear") {
      const members = [
        params.bmi && ["BMI", "bmi"],
        params.weight && ["weight", "weight"],
        params.age && ["age", "age"],
      ].filter(Boolean);
      if (members.length >= 2) {
        const { bars } = vifLayout(w);
        members.forEach(([name, value], i) => {
          const { x, w: bw } = vifBarRect(bars, i, members.length);
          out.push({
            x: x - 6,
            y: bars.y - 4,
            w: bw + 12,
            h: bars.h + 22,
            set: { vifvar: value },
            label: `VIF of ${name}`,
          });
        });
      }
    }
    return out;
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const twinOn = twinActive(params);
    const key = keyOf(params);
    const fit = state.fits[key];
    const concept = params.concept;

    /* the equation card */
    const terms = [{ num: fit.b0 }];
    if (params.bmi) terms.push({ num: fit.coefs.bmi.b, name: "BMI", plain: "BMI" });
    if (twinOn) terms.push({ num: fit.coefs.twin.b, name: "weight", plain: "weight" });
    if (params.age) terms.push({ num: fit.coefs.age.b, name: "age", plain: "age" });
    renderEquation(terms);

    /* --- the DAG, every tab -------------------------------------------- */
    const wide = dagWide(params);
    const { d, R, P } = dagLayout(wide);
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
    if (wide) arrow("twin", params.weight);

    /* the associations — dashed and directionless on purpose: "these are
       correlated" is measured; a direction would be a causal claim that
       belongs to fork-pipe-collider. On the Collinearity tab the BMI–weight
       link carries the measured r ≈ 0.93 in the warning colour — the
       problem as a picture. */
    const assoc = (a, b, label, strong) => {
      ctx.strokeStyle = strong ? colors.extreme : colors.ink3;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = strong ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(P[a][0], P[a][1] + R + 4);
      ctx.lineTo(P[b][0], P[b][1] - R - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = strong ? colors.extreme : colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "left";
      ctx.fillText(label, P[a][0] + 9, (P[a][1] + P[b][1]) / 2 + 4);
    };
    if (wide) assoc("bmi", "twin", "r = " + fmt(state.corrBW, 2), true);
    else assoc("bmi", "age", "r = " + fmt(R_BMI_AGE, 2), false);

    const NODE = { bmi: "BMI", twin: "weight", age: "age", y: "sysBP" };
    const nodes = wide ? ["bmi", "twin", "age", "y"] : ["bmi", "age", "y"];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of nodes) {
      const [nx, ny] = P[k];
      const on = k === "y" || (k === "twin" ? params.weight : params[k]);
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

    /* --- right of the DAG: the forest, both tabs (round 8 — the merge
       put the coefficient axis on the Model tab; the fit-quality bars it
       displaced duplicated the R² and spread tiles and are gone) -------- */
    const rp = { x: d.x + DAG_W + 40, y: 30, w: w - (d.x + DAG_W + 40) - 14 };
    drawForest(ctx, colors, { ...rp, h: 34 + F_ROW * (twinOn ? 3 : 2) }, params, state, anim, twinOn);

    /* --- the scatter row ----------------------------------------------- */
    const sTop = scatterTop(wide);

    if (concept === "fit") {
      /* Round 7, Kenneth's pick A: BOTH marginals at once — 05-02's own
         ggpairs move — now carrying the FWL slide on both panels. */
      drawMarginals(ctx, colors, { x: 56, y: sTop, w: w - 70, h: SCATTER_H },
        params, state, fit, key, twinOn, anim?.vmix ?? 0);
    } else {
      /* Round 11 (candidate A, _lab/lm-adjust6.html): the twins' panels
         are PERSISTENT — no pill click ever swaps the data view for a
         diagnostic — and the VIF check is its own section below. */
      drawTwins(ctx, colors, { x: 56, y: sTop, w: w - 70, h: TWIN_H }, params, state, fit, key, twinOn);
      drawVifSection(ctx, colors, w, params, state, key);
    }

    /* --- the three-model table, full width (Fit and adjust tab) --------- */
    if (concept === "fit") {
      drawTable(ctx, colors, { x: 56, y: tableTop(wide), w: w - 70 }, state, key);
    }

    /* --- the residual strip, Fit and adjust only (round 12) ------------- */
    if (concept !== "fit") return;
    const strip = { x: 56, y: stripTop(wide), w: w - 70, h: STRIP_H };
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
        + (twinOn ? fit.coefs.twin.b * state.wgt[i] : 0)
        + (params.age ? fit.coefs.age.b * AGE[i] : 0);
      ctx.beginPath();
      ctx.arc(rplot.sx(f), rplot.sy(SYSBP[i] - f), 1.4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
    /* the VIF tile is the Collinearity tab's — on Fit and adjust the
       bmi + age pair's quiet ~1.0 would only add a number the tab does
       not teach (round 9: don't overcomplicate) */
    const vifRows = state.vifs[key];
    if (vifRows && params.concept === "collinear") {
      const worst = Math.max(...vifRows.map(([, v]) => v));
      tiles.push({
        label: "Largest VIF",
        value: fmt(worst, 1),
        note: "above 5 flags collinearity — one covariate predicted by the rest",
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
      const names = [params.bmi ? "BMI" : null, twinActive(params) ? "a simulated weight" : null, params.age ? "age" : null].filter(Boolean);
      parts.push(`A linear model of systolic blood pressure on ${names.join(" and ")} for 3547 Framingham patients.`);
      if (params.bmi) parts.push(`The BMI coefficient reads ${fmt(fit.coefs.bmi.b, 2)} in this model.`);
    }
    parts.push(`R² is ${fmt(fit.r2, 2)}, and the residual spread is ${fmt(fit.sd, 1)} mmHg.`);
    return parts.join(" ");
  },
});

/* --- the forest (both tabs — round 8 put it beside the DAG everywhere) --- */
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
  const NAMES = { bmi: "BMI", twin: "weight", age: "age" };
  const GHOST = {
    bmi: { v: state.fits.b.coefs.bmi.b, h: state.fits.b.coefs.bmi.half, show: params.bmi && (params.age || twinOn) },
    age: { v: state.fits.a.coefs.age.b, h: state.fits.a.coefs.age.half, show: params.age && (params.bmi || twinOn) },
    twin: { v: state.fits.t.coefs.twin.b, h: state.fits.t.coefs.twin.half, show: twinOn && (params.bmi || params.age) },
  };
  const fitNow = state.fits[keyOf(params)];
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

      /* THE MOVE, ANNOTATED (round 5; round 10 made it symmetric): every
         moved row carries the sentence, naming the covariate whose
         arrival moved it. Click order is NOT a parameter — the same URL
         must always draw the same figure — so the text cannot depend on
         which pill was pressed first; instead BOTH rows are annotated,
         and the contextual reading comes free: whichever covariate the
         reader adds second, the row that eases is the one whose sentence
         just appeared. */
      const target = fitNow.coefs[k]?.b;
      if (target !== undefined && Math.abs(target - g.v) > 0.02) {
        ctx.strokeStyle = colors.ink2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx(g.v), y - 15);
        ctx.lineTo(fx(target), y - 15);
        ctx.stroke();
        const dir = target < g.v ? -1 : 1;
        ctx.fillStyle = colors.ink2;
        ctx.beginPath();
        ctx.moveTo(fx(target), y - 15);
        ctx.lineTo(fx(target) - dir * 6, y - 18.5);
        ctx.lineTo(fx(target) - dir * 6, y - 11.5);
        ctx.fill();
        const IN = ROWS.filter((r) => r !== k && (r === "twin" ? twinOn : params[r]));
        const cause = IN.length === 1 ? NAMES[IN[0]] : "the others";
        ctx.fillStyle = colors.ink1;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        /* Centred in the axis' quiet left half, above the arrow — to the
           right of the pair it overran the frame at the 550px canvas. */
        ctx.textAlign = "center";
        ctx.fillText(
          `${fmt(g.v, 2)} → ${fmt(target, 2)} when ${cause} ${IN.length === 1 ? "is" : "are"} added`,
          fx(0.7),
          y - 26,
        );
      }
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
      /* Below the whisker: above it the label sat on the round-5 move
         arrows. */
      ctx.fillText(fmt(m.v, 2), fx(m.v), y + 19);
      ctx.globalAlpha = 1;
    } else if (!g.show) {
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText("not in the model", fx(0.7), y + 4);
    }
  });
}

/* --- the three-model table, full width (Model tab) -----------------------
   The notebook's own closer — the literal "Table 2" the fallacy is named
   after. Round 8 transposed it to models-as-rows and gave it its own
   full-width row under the marginals (the merge's price, ~120px of
   height, drawn and accepted in _lab/lm-adjust5.html): a formula label
   reads at every stage width where three formula COLUMN heads did not.
   The current model's row is outlined when it is one of the three; a
   model holding weight has no row here — its story is the forest's and
   the Collinearity tab's. */
function drawTable(ctx, colors, rp, state, key) {
  const F = state.fits;
  const rows = [
    { key: "b", label: "~ BMI", cells: [F.b.coefs.bmi.b, null, F.b.r2] },
    { key: "a", label: "~ age", cells: [null, F.a.coefs.age.b, F.a.r2] },
    { key: "ba", label: "~ BMI + age", cells: [F.ba.coefs.bmi.b, F.ba.coefs.age.b, F.ba.r2] },
  ];
  const heads = ["b(BMI)", "b(age)", "R²"];
  const labW = Math.min(120, Math.round(rp.w * 0.34));
  const colW = (rp.w - labW) / heads.length;
  const rowH = 22;
  const top = rp.y + 14;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Three models of sysBP", rp.x, rp.y);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  heads.forEach((hd, j) => {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.fillText(hd, rp.x + labW + j * colW + colW / 2, top + 12);
  });
  rows.forEach((r, i) => {
    const ry = top + 30 + i * rowH;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rp.x, ry - rowH + 7);
    ctx.lineTo(rp.x + rp.w, ry - rowH + 7);
    ctx.stroke();
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText(r.label, rp.x + 4, ry);
    r.cells.forEach((v, j) => {
      ctx.fillStyle = colors.ink1;
      ctx.textAlign = "center";
      ctx.fillText(v === null ? "—" : fmt(v, 2), rp.x + labW + j * colW + colW / 2, ry);
    });
    if (r.key === key) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rp.x, ry - rowH + 7, rp.w, rowH);
    }
  });
}

/* --- both marginals at once (Model tab; round 7's pick A) ----------------
   05-02's own ggpairs move: sysBP against BMI and against age, side by
   side. Each panel draws the model's reading of ITS covariate with the
   other members held constant — at three bands when the other continuous
   covariate is in (the plane, seen from each side), else at means.

   ROUND 8: the FWL slide rides on BOTH panels — View: Other removed sends
   each panel to residual space, the OTHER covariate regressed out of both
   axes, and each residual slope IS its adjusted coefficient (1.50 left,
   0.84 right), exact only for the BMI + age model — retarget guards the
   slide to exactly that model, and the note here names what is missing. */
function drawMarginals(ctx, colors, slot, params, state, fit, key, twinOn, vmix) {
  const gap = 60;
  const pw = Math.round((slot.w - gap) / 2);
  const AGE_DOM = [30, 71];
  const AGE_BANDS = [35, 50, 65];
  const BMI_BANDS = [20, 27, 34];
  const inResid = vmix >= 0.5;

  const panelSpec = [
    { xs: BMI, dom: X_DOM, label: "BMI", self: "bmi", other: "age", bands: AGE_BANDS,
      rx: state.rx, ry: state.ry, rdom: RX_DOM,
      rXL: "BMI — age removed", rYL: "sysBP — age removed", x: slot.x },
    { xs: AGE, dom: AGE_DOM, label: "age", self: "age", other: "bmi", bands: BMI_BANDS,
      rx: state.rx2, ry: state.ry2, rdom: R2X_DOM,
      rXL: "age — BMI removed", rYL: "sysBP — BMI removed", x: slot.x + pw + gap },
  ];

  panelSpec.forEach((p, pi) => {
    const rect = { x: p.x, y: slot.y, w: pw, h: slot.h };
    const plotD = makePlot({ ctx, colors, rect, xDomain: p.dom, yDomain: Y_DOM });
    const plotR = makePlot({ ctx, colors, rect, xDomain: p.rdom, yDomain: RY_DOM });
    const front = inResid ? plotR : plotD;
    if (inResid) {
      /* both y-axes are labelled here: unlike the data view the two panels
         no longer share a y variable — each removed a different covariate */
      front.axisX({ label: p.rXL });
      front.axisY({ label: p.rYL });
      if (pi === 0) front.caption("what the other covariate does not explain");
    } else {
      front.axisX({ label: p.label });
      if (pi === 0) {
        front.axisY({ label: "sysBP (mmHg)" });
        front.caption(key === "" ? "3547 patients — no model yet"
          : params.bmi && params.age ? "the model, the other covariate held constant"
            : "the data, and the model's line");
        if (params.view === "resid" && !(params.bmi && params.age)) {
          front.note("put BMI and age in the model to remove the other");
        }
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
      const px = plotD.sx(p.xs[i]) + (plotR.sx(p.rx[i]) - plotD.sx(p.xs[i])) * vmix;
      const py = plotD.sy(SYSBP[i]) + (plotR.sy(p.ry[i]) - plotD.sy(SYSBP[i])) * vmix;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* data space: the model's family, fading out as the slide leaves */
    if (vmix < 0.996 && params[p.self]) {
      const fade = 1 - vmix;
      const slope = fit.coefs[p.self].b;
      const otherIn = params[p.other];
      const line = (b0, alpha, label) => {
        ctx.strokeStyle = colors.highlight;
        ctx.globalAlpha = alpha * fade;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plotD.sx(p.dom[0]), plotD.sy(b0 + slope * p.dom[0]));
        ctx.lineTo(plotD.sx(p.dom[1]), plotD.sy(b0 + slope * p.dom[1]));
        ctx.stroke();
        if (label) {
          ctx.globalAlpha = fade;
          ctx.fillStyle = colors.ink2;
          ctx.font = `${colors.fsXs} ${colors.font}`;
          /* Right-aligned inside the frame — left-anchored at 0.9 the label
             ran into the clip and lost its last digit. */
          ctx.textAlign = "right";
          ctx.fillText(label, plotD.sx(p.dom[1]) - 4, plotD.sy(b0 + slope * p.dom[1]) - 4);
        }
        ctx.globalAlpha = 1;
      };
      const twinPart = twinOn ? fit.coefs.twin.b * state.meanWgt : 0;
      if (otherIn) {
        const oc = fit.coefs[p.other].b;
        p.bands.forEach((bv, i) => {
          line(fit.b0 + oc * bv + twinPart,
            0.45 + (0.55 * i) / (p.bands.length - 1),
            `${p.other === "age" ? "age" : "BMI"} ${bv}`);
        });
      } else {
        line(fit.b0 + twinPart + (p.other === "age" && params.age ? fit.coefs.age.b * MEAN_AGE : 0), 1);
      }
    }

    /* residual space: the adjusted slope, drawn only for the exact model */
    if (vmix > 0.004 && key === "ba") {
      const slope = state.fits.ba.coefs[p.self].b;
      ctx.globalAlpha = vmix;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plotR.sx(p.rdom[0]), plotR.sy(slope * p.rdom[0]));
      ctx.lineTo(plotR.sx(p.rdom[1]), plotR.sy(slope * p.rdom[1]));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });
}

/* --- the twins' marginals (Collinearity tab, round 11) -------------------
   sysBP against BMI and against the simulated weight, side by side and
   PERSISTENT — no pill click ever swaps the data view for a diagnostic
   (the round-11 complaint; the tab's fixed pair is the TWINS, its
   subject). Each panel carries the model's reading of its covariate when
   it is in, the other members held at their means: with both twins in,
   weight's line goes flat (≈ 0.01/kg) under a cloud that plainly rises —
   attribution broken where the reader can see it, while R² and the strip
   barely move (prediction untouched). */
function drawTwins(ctx, colors, slot, params, state, fit, key, twinOn) {
  const gap = 60;
  const pw = Math.round((slot.w - gap) / 2);
  const spec = [
    {
      xs: BMI, dom: X_DOM, label: "BMI", on: params.bmi,
      slope: params.bmi ? fit.coefs.bmi.b : 0,
      rest: (params.age ? fit.coefs.age.b * MEAN_AGE : 0)
        + (twinOn ? fit.coefs.twin.b * state.meanWgt : 0),
      x: slot.x,
    },
    {
      xs: state.wgt, dom: W_DOM, label: "weight (kg)", on: twinOn,
      slope: twinOn ? fit.coefs.twin.b : 0,
      rest: (params.bmi ? fit.coefs.bmi.b * MEAN_BMI : 0)
        + (params.age ? fit.coefs.age.b * MEAN_AGE : 0),
      x: slot.x + pw + gap,
    },
  ];
  spec.forEach((p, pi) => {
    const rect = { x: p.x, y: slot.y, w: pw, h: slot.h };
    const plot = makePlot({ ctx, colors, rect, xDomain: p.dom, yDomain: Y_DOM });
    plot.axisX({ label: p.label });
    if (pi === 0) {
      plot.axisY({ label: "sysBP (mmHg)" });
      plot.caption(key === ""
        ? "the twins — no model yet"
        : "the twins — the model's reading of each, others at their means");
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.fillStyle = colors.unknown;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < N; i += 1) {
      ctx.beginPath();
      ctx.arc(plot.sx(p.xs[i]), plot.sy(SYSBP[i]), 1.6, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (p.on) {
      const b0 = fit.b0 + p.rest;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plot.sx(p.dom[0]), plot.sy(b0 + p.slope * p.dom[0]));
      ctx.lineTo(plot.sx(p.dom[1]), plot.sy(b0 + p.slope * p.dom[1]));
      ctx.stroke();
    }
    ctx.restore();
    if (pi === 1 && p.on) {
      ctx.fillStyle = colors.ink2;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`the model's line: ${fmt(p.slope, 2)} per kg`, rect.x + rect.w - 6, rect.y + 16);
    }
  });
}

/* --- the VIF section's geometry, ONE place -------------------------------
   regions() must put the bar hit targets exactly where draw() paints the
   bars — two copies of this arithmetic is how a target ends up six
   columns from its node (widget 26's lesson, the harness's own
   incident). */
function vifLayout(w) {
  const top = diagTop();
  const pw = Math.round((w - 70) * 0.55);
  return {
    top,
    panel: { x: 56, y: top + 48, w: pw, h: DIAG_H },
    bars: { x: 56 + pw + 56, y: top + 48, w: w - (56 + pw + 56) - 14, h: DIAG_H },
  };
}
function vifBarRect(bars, i, n) {
  return {
    x: bars.x + 12 + i * ((bars.w - 20) / n),
    w: Math.min(44, (bars.w - 16) / n - 10),
  };
}

/* --- the VIF section (Collinearity tab, round 11) ------------------------
   The notebook's own detection subsection as a page section (05-02 §
   "Using a VIF to detect collinearity"): the recipe, then the formula
   CONCRETE for one covariate — subject ~ the others → R² → VIF — beside
   the bars for every member. "Regress the covariate on the rest" IS a
   picture: weight's cloud hugs the diagonal (R² 0.87 → VIF 7.7); age's
   is a blob at VIF ≈ 1 — the contrast that defines the quantity.
   Clicking a bar (regions) sets which regression the panel and formula
   show — the notebook computes VIF for each covariate one cell at a time
   (cells 44–49), and the click is that walk. With fewer than two
   covariates the section stays and says what it needs: it fills in,
   never appears or vanishes. */
function drawVifSection(ctx, colors, w, params, state, key) {
  /* declared here, not at module scope below defineWidget — core calls
     draw() during the defineWidget call itself, and a const after that
     call is still in its temporal dead zone at first paint */
  const SUBJ_OF = { bmi: "BMI", weight: "weight", age: "age" };
  const { top, panel, bars } = vifLayout(w);
  const rows = state.vifs[key];
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Detecting collinearity — VIF", 14, top);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText("regress each covariate on the others — what they explain inflates its variance", 14, top + 16);

  if (!rows) {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeRect(bars.x, bars.y, bars.w, bars.h);
    ctx.textAlign = "center";
    ctx.fillText(
      "put two covariates in the model to test for collinearity",
      panel.x + panel.w / 2,
      panel.y + panel.h / 2,
    );
    ctx.restore();
    return;
  }

  /* the subject: the clicked bar's covariate if it is in the model,
     else the largest VIF — what a fresh reader should meet first */
  const names = rows.map(([n]) => n);
  const wanted = SUBJ_OF[params.vifvar];
  const [subjName, subjVif] = names.includes(wanted)
    ? rows[names.indexOf(wanted)]
    : rows.reduce((a, b) => (b[1] > a[1] ? b : a));
  const NAMED = { BMI: { arr: BMI, dom: X_DOM }, weight: { arr: state.wgt, dom: W_DOM }, age: { arr: AGE, dom: [30, 71] } };
  const others = names.filter((n) => n !== subjName);
  const f = ols(NAMED[subjName].arr, ...others.map((n) => NAMED[n].arr));
  ctx.fillStyle = colors.ink2;
  ctx.fillText(
    `${subjName} ~ ${others.join(" + ")}  →  R² ${fmt(f.r2, 2)}  →  VIF = 1 ⁄ (1 − R²) = ${fmt(subjVif, 1)}`,
    14,
    top + 32,
  );

  /* the regression panel */
  const dom = NAMED[subjName].dom;
  const sub = NAMED[subjName].arr;
  const pred = sub.map((_, i) => others.reduce((s, n, j) => s + f.b[j + 1] * NAMED[n].arr[i], f.b[0]));
  const plot = makePlot({ ctx, colors, rect: panel, xDomain: dom, yDomain: dom });
  plot.axisX({ label: `${subjName}, predicted from the others` });
  plot.axisY({ label: `${subjName}, actual` });
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.strokeStyle = colors.ink3;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.sx(dom[0]), plot.sy(dom[0]));
  ctx.lineTo(plot.sx(dom[1]), plot.sy(dom[1]));
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = colors.unknown;
  for (let i = 0; i < N; i += 1) {
    ctx.beginPath();
    ctx.arc(plot.sx(pred[i]), plot.sy(sub[i]), 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  /* the honesty note (round 5's ruling rides here): a high VIF on this
     stage is always the simulated twin's doing; a low one means the
     others carry no real information about the subject */
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillText(
    subjVif < 2
      ? "the others know almost nothing about it"
      : "weight is simulated from BMI and a plausible height",
    panel.x,
    panel.y + panel.h + 44,
  );

  /* the bars — click targets (regions), the chosen one emphasised */
  const vy = (v) => bars.y + bars.h - (Math.min(v, 8) / 8) * bars.h;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(bars.x, bars.y, bars.w, bars.h);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  for (const v of [0, 4, 8]) ctx.fillText(String(v), bars.x - 4, vy(v) + 3);
  rows.forEach(([name, v], i) => {
    const { x: bx, w: bw } = vifBarRect(bars, i, rows.length);
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = name === subjName ? 1 : 0.45;
    ctx.fillRect(bx, vy(v), bw, vy(0) - vy(v));
    ctx.globalAlpha = 1;
    if (name === subjName) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 2.5, vy(v) - 2.5, bw + 5, vy(0) - vy(v) + 2.5);
    }
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "center";
    ctx.fillText(name, bx + bw / 2, bars.y + bars.h + 13);
    ctx.fillText(fmt(v, 1), bx + bw / 2, vy(v) - 5);
  });
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("click a bar to inspect it", bars.x + bars.w / 2, bars.y + bars.h + 28);
  ctx.strokeStyle = colors.extreme;
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bars.x, vy(5));
  ctx.lineTo(bars.x + bars.w, vy(5));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
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
  anim.vmixT = params.concept === "fit" && params.view === "resid"
    && params.bmi && params.age ? 1 : 0;
  for (const k of ["bmi", "age", "twin"]) {
    const m = anim[k];
    const t = anim[`${k}T`];
    if (Math.abs(m.v - t.v) > 0.0015 || Math.abs(m.h - t.h) > 0.0015 || Math.abs(m.a - t.a) > 0.0015) {
      anim.easing = true;
    }
  }
  if (Math.abs(anim.vmix - anim.vmixT) > 0.0015) anim.easing = true;
}
