/* ============================================================================
   Widget 30 · Fitting an Interaction — the main effect that lives at zero.

   PHM5003 05-04 (Modeling — Interactions), catalogue slot 4: main effects
   can be read unconditionally when an interaction is present. Measured
   first (`_lab/lm-int-measure.mjs`, 33 checks, every 05-04 stored output to
   the digit, outcome totChol): with age:sex in the model "the sex effect"
   prints +95.57 — the gap AT AGE ZERO, 32 years left of the youngest
   patient. In the data the gap runs +24.2 (age 35) through zero (the lines
   CROSS at 46.9) to −37.0 (age 65). The independent model is the setup,
   not filler: its two lines are 5 units apart, so the + → × toggle SPLITS
   a near-single line into opposite slopes (2.29 vs 0.25).

   KENNETH'S PICKS (round 1, from _lab/lm-int-stage.html): the PROBE (an
   age slider bracketing the live gap — the "effect" read as the function
   it now is; under + the number refuses to change, which is the contrast),
   the EXTRAPOLATION reveal (extend the axis to age 0 across a shaded
   stretch that holds no patients — the printed coefficient bracketed
   where it actually lives), and TWO TABS: age × sex and diabetes × sex
   (act 1, age × BMI, is OUT — the same lesson with a fan in place of a
   crossing; its one extra fact fits a caption). The 2×2 tab: observed
   cell means stand still while the MODEL'S predictions ease between the
   one-size reading (+10.18 for everyone) and the saturated one (+21.0 in
   women, −0.02 in men — the interaction is a difference of differences).

   THREE EASED VALUES drive everything (widget 28's chase pattern): `a`
   (the fit gate's alpha), `t` (0 = independent, 1 = interacting — lines,
   arrows and labels are computed from the LERPED coefficients, so no
   printed number is false mid-frame, widget 29's counting-label rule),
   and `z` (the axis extension — dots, lines and ticks share one lerped
   x-domain, widget 28's slide machinery). `anim.easing = true` in rebuild
   is core's REQUEST FOR FRAMES (earned twice; do not remove).

   THE DATA IS THE ARC'S SHARED STAGE (n = 3547, 05-04's frame is 05-01's).
   compute() is fully deterministic — no rng, no seed: every position is a
   patient's own (age, totChol), and the 2×2 draws means, not dots.

   TDZ lesson (widget 28's, earned): every module-scope const lives ABOVE
   defineWidget — core calls draw() during the defineWidget call itself.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { ols } from "../lm-least-squares/model.js";
import { N, AGE, SEX, TOTCHOL, DIABETES, BMI } from "../lm-least-squares/data.js";

const X_DATA = [32, 69];
const Y_DOM = [140, 360];
const Y3_DOM = [222, 270];
const EASE_MS = 450;

const STAGE_Y = 30;
const STAGE_H = 280;
const HEIGHT = STAGE_Y + STAGE_H + 46;

const stageRect = (w) => ({ x: 56, y: STAGE_Y, w: w - 70, h: STAGE_H });

const lerp = (a, b, m) => a + (b - a) * m;

/* ---- the equation card, the arc's machinery ----------------------------- */
function mathmlRenders() {
  if (typeof window === "undefined" || typeof window.MathMLElement !== "function") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;font-size:16px";
  probe.innerHTML = '<math id="lmi-frac"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
    + '<math id="lmi-flat"><mn>1</mn></math>';
  document.body.appendChild(probe);
  const h = (id) => probe.querySelector(`#${id}`)?.getBoundingClientRect().height ?? 0;
  const stacked = h("lmi-frac");
  const flat = h("lmi-flat");
  probe.remove();
  return flat > 0 && stacked > flat * 1.4;
}
const MATHML = mathmlRenders();

const GENERIC = {
  plus: {
    math: "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><msub><mi>x</mi><mn>1</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><msub><mi>x</mi><mn>2</mn></msub></mrow></math>",
    plain: "y = b₀ + b₁x₁ + b₂x₂",
  },
  times: {
    math: "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><msub><mi>x</mi><mn>1</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><msub><mi>x</mi><mn>2</mn></msub>"
      + "<mo>+</mo><msub><mi>b</mi><mn>3</mn></msub><msub><mi>x</mi><mn>1</mn></msub><msub><mi>x</mi><mn>2</mn></msub></mrow></math>",
    plain: "y = b₀ + b₁x₁ + b₂x₂ + b₃x₁x₂",
  },
};

function eqHTML(terms) {
  const mag = (v) => fmt(Math.abs(v), 2);
  if (!MATHML) {
    return terms.map((t, i) => (i === 0
      ? `totChol = ${fmt(t.num, 2)}`
      : `${t.num < 0 ? "−" : "+"} ${mag(t.num)} × ${t.name}`)).join(" ");
  }
  return terms.map((t, i) => (i === 0
    ? `<math><mrow><mi>totChol</mi><mo>=</mo><mn>${fmt(t.num, 2)}</mn></mrow></math>`
    : `<math><mrow><mo form="infix">${t.num < 0 ? "&#x2212;" : "+"}</mo><mn>${mag(t.num)}</mn><mo>&#xD7;</mo><mi>${t.name}</mi></mrow></math>`
  )).join(" ");
}

let mathHost = null;
let mathKey = null;
/* ROUND 2 (Kenneth): the card grows ONE ROW PER LINE ON THE GRAPH — the
   notebook's own "rearranging the terms" move (05-04 cell 23), each row
   in its line's group colour with the sum that produced it annotated, so
   the graph and the algebra are the same object. `groups` is
   { f: {b0, b1}, m: {b0, b1}, xname, note } or null while unfitted. */
function renderEquation(kind, terms, groups) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = kind
    + (terms ? terms.map((t) => `${t.num}${t.name ?? ""}`).join(",") : "none")
    + (groups ? (groups.rows
      ? groups.rows.map((r) => `${r.label}${r.b0}${r.b1}`).join(";")
      : `${groups.f.b0}${groups.m.b0}${groups.m.b1}`) : "");
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const g = GENERIC[kind];
  const generic = `<span style="color:var(--ink-2)">${MATHML ? g.math : g.plain}</span>`;
  const model = terms
    ? eqHTML(terms)
    : `<span style="color:var(--ink-3)">no model fitted yet</span>`;
  let groupRows = "";
  if (groups) {
    const lineEq = (b, color) =>
      `<span style="color:${color}">${eqHTML([
        { num: b.b0 },
        { num: b.b1, name: groups.xname },
      ])}</span>`;
    const note = groups.note
      ? ` <span style="color:var(--ink-3);font-size:var(--fs-xs)">— ${groups.note}</span>`
      : "";
    /* `rows` is the general form (act 1's per-BMI-level lines); the f/m
       pair is the legacy shape, output byte-identical to before rows
       existed — the recorded tx hashes depend on it */
    groupRows = groups.rows
      ? groups.rows.map((r, i) =>
        row(r.label, lineEq(r, `var(--c-${r.token})`)
          + (i === groups.rows.length - 1 ? note : ""))).join("")
      : row("women (sex 0)", lineEq(groups.f, "var(--c-group-a)"))
        + row("men (sex 1)", lineEq(groups.m, "var(--c-group-b)") + note);
  }
  mathHost.innerHTML = row("the model", generic) + row("this model", model) + groupRows;
}

defineWidget({
  slug: "lm-interaction",
  title: "Fitting an Interaction",
  status: "shipped",
  subtitle:
    "An interaction term lets one covariate's effect depend on the level " +
    "of another. The main effects are then no longer unconditional: each " +
    "is the effect where the other covariate is zero — which may be far " +
    "from any patient in the data.",
  layout: "side",
  height: HEIGHT,

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      /* the notebook's three acts, in its order (Kenneth 2026-08-29 —
         act 1 was cut in round 1 and revived to match the notebook).
         The default stays agesex: the crossing is the approved opening
         story, and the recorded states carry it. */
      options: [
        { value: "agebmi", label: "Age × BMI", detail: "two continuous covariates — each covariate's slope depends on the other's level" },
        { value: "agesex", label: "Age × sex", detail: "a continuous covariate interacting with a categorical one — two lines that may cross" },
        { value: "diabsex", label: "Diabetes × sex", detail: "two categorical covariates — the interaction is a difference of differences" },
      ],
      default: "agesex",
      display: true,
    },

    model: { type: "section", label: "The model" },

    /* the widget opens as data and a question (widget 26's gate) */
    fit: {
      type: "gate",
      label: "Fit the model",
      labelOff: "Clear the fit",
      detail: "totChol on the two covariates, with or without their interaction",
      display: true,
    },

    /* THE CORE CONTROL — the notebook's own operators. The lines (and the
       2×2's predictions) EASE between the two readings. */
    terms: {
      type: "segmented",
      label: "Terms",
      options: [
        { value: "plus", label: "+ independent", detail: "each covariate has one effect, everywhere" },
        { value: "times", label: "× interacting", detail: "one covariate's effect depends on the other" },
      ],
      default: "plus",
      display: true,
    },

    readingB: { type: "section", label: "Reading the age effect", when: { param: "concept", equals: "agebmi" } },

    /* the two-continuous probe: the AGE SLOPE read at a chosen BMI — under
       + it refuses to change (1.32 per year everywhere), under × it runs
       1.97 → −0.32 and flips sign above BMI ≈ 37 */
    probebmi: {
      type: "int",
      label: "At BMI",
      min: 17,
      max: 45,
      default: 25,
      display: true,
      when: { param: "concept", equals: "agebmi" },
    },

    reading: { type: "section", label: "Reading the sex effect", when: { param: "concept", equals: "agesex" } },

    /* the probe: the "sex effect" read where the reader chooses — under +
       the number refuses to move, under × it sweeps and changes sign */
    probe: {
      type: "int",
      label: "At age",
      min: 33,
      max: 68,
      default: 60,
      display: true,
      when: { param: "concept", equals: "agesex" },
    },

    /* the extrapolation: extend the axis to age 0, where the printed sex
       coefficient actually lives */
    zero: {
      type: "bool",
      label: "Show age zero",
      default: false,
      display: true,
      when: { param: "concept", equals: "agesex" },
    },
  },

  /* generic (Kenneth 2026-08-29, the mixed-model ruling applied): the
     canvas names the groups where they appear — the lines say women and
     men on the sex tabs, the fan lines say their BMI level — and the
     age × BMI tab's neutral cloud claims no group at all */
  legend: [
    { token: "group-a", label: "Group A — its patients, cell mean and model line", mark: "dot" },
    { token: "group-b", label: "Group B — its patients, cell mean and model line", mark: "dot" },
    { token: "empirical", label: "The model drawn at sample BMI levels", mark: "line" },
    { token: "highlight", label: "The effect being read from the model — the probe's reading, or the interaction bracket", mark: "line" },
  ],

  compute() {
    const mul = (a, b) => a.map((v, i) => v * b[i]);
    /* act 1 — two continuous covariates (cells 7 and 11; both fits are in
       lm-int-measure.mjs to the digit). No per-level line table: the fan
       is computed from the lerped coefficients at draw time. */
    const bInd = ols(TOTCHOL, AGE, BMI);
    const bInt = ols(TOTCHOL, AGE, BMI, mul(AGE, BMI));
    /* act 2 — per-sex lines under each reading */
    const aInd = ols(TOTCHOL, AGE, SEX);
    const aInt = ols(TOTCHOL, AGE, SEX, mul(AGE, SEX));
    const asLines = {
      plus: { f: [aInd.b[0], aInd.b[1]], m: [aInd.b[0] + aInd.b[2], aInd.b[1]] },
      times: { f: [aInt.b[0], aInt.b[1]], m: [aInt.b[0] + aInt.b[2], aInt.b[1] + aInt.b[3]] },
    };
    /* act 3 — observed cell means and each model's cell predictions */
    const cells = {};
    for (const d of [0, 1]) {
      for (const s of [0, 1]) {
        const ys = TOTCHOL.filter((_, i) => DIABETES[i] === d && SEX[i] === s);
        cells[`d${d}s${s}`] = { n: ys.length, mean: ys.reduce((x, v) => x + v, 0) / ys.length };
      }
    }
    const dInd = ols(TOTCHOL, DIABETES, SEX);
    const dInt = ols(TOTCHOL, DIABETES, SEX, mul(DIABETES, SEX));
    const pred = (f, d, s, withInt) =>
      f.b[0] + f.b[1] * d + f.b[2] * s + (withInt ? f.b[3] * d * s : 0);
    const dsPred = {
      plus: { d0s0: pred(dInd, 0, 0), d1s0: pred(dInd, 1, 0), d0s1: pred(dInd, 0, 1), d1s1: pred(dInd, 1, 1) },
      times: { d0s0: pred(dInt, 0, 0, 1), d1s0: pred(dInt, 1, 0, 1), d0s1: pred(dInt, 0, 1, 1), d1s1: pred(dInt, 1, 1, 1) },
    };
    return {
      aInd, aInt, asLines, cells, dInd, dInt, dsPred, bInd, bInt,
      r2: {
        agebmi: { plus: bInd.r2, times: bInt.r2 },
        agesex: { plus: aInd.r2, times: aInt.r2 },
        diabsex: { plus: dInd.r2, times: dInt.r2 },
      },
    };
  },

  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => {
      const anim = {
        a: params.fit ? 1 : 0,
        t: params.terms === "times" ? 1 : 0,
        z: params.zero ? 1 : 0,
      };
      anim.aT = anim.a;
      anim.tT = anim.t;
      anim.zT = anim.z;
      return anim;
    },
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      for (const k of ["a", "t", "z"]) {
        const gap = anim[`${k}T`] - anim[k];
        if (Math.abs(gap) < 0.0015) {
          anim[k] = anim[`${k}T`];
        } else {
          anim[k] += gap * rate;
          moving = true;
        }
      }
      return moving;
    },
    rebuild: (anim, { params }) => {
      anim.aT = params.fit ? 1 : 0;
      anim.tT = params.terms === "times" ? 1 : 0;
      anim.zT = params.zero && params.concept === "agesex" ? 1 : 0;
      if (anim.a < 0.02 && anim.aT > 0) anim.t = anim.tT;
      for (const k of ["a", "t", "z"]) {
        if (Math.abs(anim[k] - anim[`${k}T`]) > 0.0015) anim.easing = true;
      }
    },
  },

  /* Click the stage to place the probe at that age — one region per year,
     each setting the one `probe` parameter; the slider is the keyboard
     path. No regions while the model is unfitted (3.6), and none on the
     2×2 tab, which has nothing to probe. */
  regions({ w, params }) {
    if (params.concept !== "agesex" || !params.fit) return [];
    const r = stageRect(w);
    const lo = params.zero ? 0 : X_DATA[0];
    const span = 69 - lo;
    const out = [];
    for (let age = 33; age <= 68; age += 1) {
      out.push({
        x: r.x + ((age - 0.5 - lo) / span) * r.w,
        y: r.y,
        w: r.w / span,
        h: r.h,
        set: { probe: age },
        label: `read the gap at age ${age}`,
      });
    }
    return out;
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const a = anim?.a ?? (params.fit ? 1 : 0);
    const t = anim?.t ?? (params.terms === "times" ? 1 : 0);
    const z = anim?.z ?? (params.zero ? 1 : 0);
    const r = stageRect(w);

    /* the equation card — the CHOSEN model's numbers, not the lerp (the
       card is text, and snaps with the control; the canvas is what
       eases). The per-group rows carry the sums that produced them. */
    if (!params.fit) {
      renderEquation(params.terms, null, null);
    } else if (params.concept === "agebmi") {
      const f = params.terms === "times" ? state.bInt : state.bInd;
      const withInt = params.terms === "times";
      const lvl = (B) => ({
        label: `at BMI ${B}`,
        b0: f.b[0] + f.b[2] * B,
        b1: f.b[1] + (withInt ? f.b[3] * B : 0),
        token: "empirical",
      });
      renderEquation(params.terms, [
        { num: f.b[0] },
        { num: f.b[1], name: "age" },
        { num: f.b[2], name: "BMI" },
      ].concat(withInt ? [{ num: f.b[3], name: "age × BMI" }] : []), {
        xname: "age",
        rows: [lvl(20), lvl(40)],
        note: withInt
          ? `the age slope is ${fmt(f.b[1], 2)} ${f.b[3] < 0 ? "−" : "+"} ${fmt(Math.abs(f.b[3]), 2)} × BMI`
          : "the same age slope at every BMI",
      });
    } else if (params.concept === "agesex") {
      const f = params.terms === "times" ? state.aInt : state.aInd;
      const withInt = params.terms === "times";
      renderEquation(params.terms, [
        { num: f.b[0] },
        { num: f.b[1], name: "age" },
        { num: f.b[2], name: "[sex]" },
      ].concat(withInt ? [{ num: f.b[3], name: "age × [sex]" }] : []), {
        xname: "age",
        f: { b0: f.b[0], b1: f.b[1] },
        m: { b0: f.b[0] + f.b[2], b1: f.b[1] + (withInt ? f.b[3] : 0) },
        note: withInt
          ? `${fmt(f.b[0], 2)} + ${fmt(f.b[2], 2)}, and ${fmt(f.b[1], 2)} ${f.b[3] < 0 ? "−" : "+"} ${fmt(Math.abs(f.b[3]), 2)}`
          : `same slope, ${fmt(Math.abs(f.b[2]), 2)} ${f.b[2] < 0 ? "lower" : "higher"}`,
      });
    } else {
      const f = params.terms === "times" ? state.dInt : state.dInd;
      const withInt = params.terms === "times";
      renderEquation(params.terms, [
        { num: f.b[0] },
        { num: f.b[1], name: "[diabetes]" },
        { num: f.b[2], name: "[sex]" },
      ].concat(withInt ? [{ num: f.b[3], name: "[diabetes] × [sex]" }] : []), {
        xname: "[diabetes]",
        f: { b0: f.b[0], b1: f.b[1] },
        m: { b0: f.b[0] + f.b[2], b1: f.b[1] + (withInt ? f.b[3] : 0) },
        note: withInt
          ? `${fmt(f.b[1], 2)} ${f.b[3] < 0 ? "−" : "+"} ${fmt(Math.abs(f.b[3]), 2)}: the effect is gone`
          : `the same ${f.b[1] >= 0 ? "+" : ""}${fmt(f.b[1], 2)} for both`,
      });
    }

    if (params.concept === "agebmi") {
      drawAgeBmi(ctx, colors, r, params, state, a, t);
    } else if (params.concept === "agesex") {
      drawAgeSex(ctx, colors, r, params, state, a, t, z);
    } else {
      drawTwoByTwo(ctx, colors, r, params, state, a, t);
    }
  },

  readout({ params, state }) {
    if (!params.fit) {
      return [
        { label: "R²", value: "—", note: "fit the model first" },
        { label: "Interaction", value: "—", note: "the coefficient on the product term" },
      ];
    }
    const r2 = state.r2[params.concept][params.terms];
    const tiles = [
      {
        label: "R²",
        value: fmt(r2, 3),
        note: params.terms === "times"
          ? "with the interaction — compare it to the + reading"
          : "independent terms — toggle × to see what the interaction adds",
      },
    ];
    if (params.terms === "times") {
      const f = params.concept === "agebmi" ? state.bInt
        : params.concept === "agesex" ? state.aInt : state.dInt;
      tiles.push({
        label: "Interaction",
        value: fmt(f.b[3], 2),
        note: params.concept === "agebmi"
          ? "per BMI unit, the age slope changes by this much"
          : params.concept === "agesex"
            ? "per year of age, the sex gap changes by this much"
            : "the difference of differences — what one group gets that the other does not",
      });
    } else {
      tiles.push({
        label: "Interaction",
        value: "—",
        note: "no product term in this model",
      });
    }
    return tiles;
  },

  summary({ params, state }) {
    const parts = ["Total cholesterol for 3547 Framingham patients."];
    if (params.concept === "agebmi") {
      parts.push("The stage plots totChol against age, with the model drawn at sample BMI levels.");
      if (params.fit) {
        parts.push(params.terms === "times"
          ? `With the age × BMI interaction the model lines fan and cross: the age slope is ${fmt(state.bInt.b[1], 2)} ${state.bInt.b[3] < 0 ? "−" : "+"} ${fmt(Math.abs(state.bInt.b[3]), 2)} per BMI unit, turning negative above BMI ${fmt(-state.bInt.b[1] / state.bInt.b[3], 0)}.`
          : "With independent terms the BMI levels give parallel lines — one age slope everywhere.");
      } else parts.push("No model fitted yet.");
    } else if (params.concept === "agesex") {
      parts.push("The stage plots totChol against age, patients coloured by sex.");
      if (params.fit) {
        parts.push(params.terms === "times"
          ? `With the age × sex interaction the sexes have different slopes (2.29 and 0.25) and the lines cross at age 46.9; the sex coefficient ${fmt(state.aInt.b[2], 2)} is the gap at age zero.`
          : "With independent terms the sexes share one slope and differ by a constant 5 units.");
      } else parts.push("No model fitted yet.");
    } else {
      parts.push("The stage shows the four diabetes-by-sex cell means.");
      if (params.fit) {
        parts.push(params.terms === "times"
          ? "The saturated model reproduces the cell means: diabetes adds 21.0 in women and nothing in men."
          : "The independent model gives everyone the same diabetes effect, +10.18.");
      } else parts.push("No model fitted yet.");
    }
    return parts.join(" ");
  },
});

/* --- act 2: age × sex ------------------------------------------------------
   One lerped x-domain serves dots, lines, ticks and the shaded no-data
   stretch, so the zero reveal is a slide, not a jump. The lines are drawn
   from coefficients LERPED between the two models, and every printed gap
   is computed from those same lerped lines — honest on every frame. */
function drawAgeSex(ctx, colors, r, params, state, a, t, z) {
  const xLo = X_DATA[0] * (1 - z);
  const plot = makePlot({ ctx, colors, rect: r, xDomain: [xLo, 69], yDomain: Y_DOM });
  plot.axisX({ label: "age" });
  plot.axisY({ label: "totChol (mg/dL)" });
  plot.caption(!params.fit
    ? "3547 patients, coloured by sex — no model yet"
    : params.terms === "times"
      ? "interacting terms — each sex has its own slope"
      : "independent terms — one slope, a constant offset");

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  /* the stretch that holds no patients */
  if (z > 0.004) {
    ctx.fillStyle = colors.grid;
    ctx.globalAlpha = 0.35 * z;
    ctx.fillRect(r.x, r.y, plot.sx(X_DATA[0]) - r.x, r.h);
    ctx.globalAlpha = 1;
    if (z > 0.5) {
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.globalAlpha = (z - 0.5) * 2;
      ctx.fillText("no patients here — the youngest is 32", plot.sx(16), r.y + r.h - 10);
      ctx.globalAlpha = 1;
    }
  }

  ctx.globalAlpha = 0.3;
  for (let i = 0; i < N; i += 1) {
    ctx.fillStyle = SEX[i] === 0 ? colors.groupA : colors.groupB;
    ctx.beginPath();
    ctx.arc(plot.sx(AGE[i]), plot.sy(TOTCHOL[i]), 1.4, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (a > 0.02) {
    const L = state.asLines;
    const bf = [lerp(L.plus.f[0], L.times.f[0], t), lerp(L.plus.f[1], L.times.f[1], t)];
    const bm = [lerp(L.plus.m[0], L.times.m[0], t), lerp(L.plus.m[1], L.times.m[1], t)];
    ctx.globalAlpha = a;
    const lineOf = (b, color, label, below) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plot.sx(xLo), plot.sy(b[0] + b[1] * xLo));
      ctx.lineTo(plot.sx(69), plot.sy(b[0] + b[1] * 69));
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `600 ${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "left";
      ctx.fillText(label, plot.sx(69) - 38, plot.sy(b[0] + b[1] * 69) + (below ? 14 : -6));
    };
    lineOf(bf, colors.groupA, "women", false);
    lineOf(bm, colors.groupB, "men", true);

    /* the probe: the gap read from the lerped lines at the chosen age */
    const gapAt = (age) => (bm[0] + bm[1] * age) - (bf[0] + bf[1] * age);
    const bracket = (age, label, alpha) => {
      const yF = bf[0] + bf[1] * age;
      const yM = bm[0] + bm[1] * age;
      ctx.globalAlpha = a * alpha;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(plot.sx(age), plot.sy(yF));
      ctx.lineTo(plot.sx(age), plot.sy(yM));
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (const y of [yF, yM]) {
        ctx.beginPath();
        ctx.moveTo(plot.sx(age) - 5, plot.sy(y));
        ctx.lineTo(plot.sx(age) + 5, plot.sy(y));
        ctx.stroke();
      }
      ctx.fillStyle = colors.highlight;
      ctx.font = `600 ${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "left";
      const ly = plot.sy((yF + yM) / 2) + 4;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(label, plot.sx(age) + 8, ly);
      ctx.fillText(label, plot.sx(age) + 8, ly);
      ctx.globalAlpha = a;
    };

    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.sx(params.probe), r.y);
    ctx.lineTo(plot.sx(params.probe), r.y + r.h);
    ctx.stroke();
    ctx.setLineDash([]);
    bracket(params.probe, `gap at ${params.probe}: ${fmt(gapAt(params.probe), 1)}`, 1);

    /* the printed coefficient, bracketed where it lives */
    if (z > 0.5) {
      bracket(0.6, `${gapAt(0) >= 0 ? "+" : ""}${fmt(gapAt(0), 2)} — the printed [sex] coefficient`, (z - 0.5) * 2);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* --- act 1: age × BMI — the FAN (revived 2026-08-29 to match the notebook) -
   Two continuous covariates, the notebook's own ggPredict picture (cell
   13): totChol against age with the model drawn at sample BMI levels.
   Under + the levels are parallel lines — one age slope everywhere; under
   × they fan and CROSS (at age 57.2, where the BMI effect passes zero).
   The probe is a BMI slider reading the AGE SLOPE at that level — the
   same lesson as the sex-gap probe with both variables continuous: under
   + the number refuses to move, under × it runs 1.97 → −0.32 per year
   and flips sign above BMI 37. Every line and every printed slope comes
   from the LERPED coefficients, so no label is false mid-frame. The
   patients are one neutral cloud: BMI is on neither axis, which is
   exactly why the model must carry it. */
function drawAgeBmi(ctx, colors, r, params, state, a, t) {
  const plot = makePlot({ ctx, colors, rect: r, xDomain: X_DATA, yDomain: Y_DOM });
  plot.axisX({ label: "age" });
  plot.axisY({ label: "totChol (mg/dL)" });
  plot.caption(!params.fit
    ? "3547 patients — BMI is on neither axis; the model will carry it"
    : params.terms === "times"
      ? "interacting terms — the age slope depends on BMI, and the levels cross"
      : "independent terms — one age slope, BMI only shifts the line");

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = colors.ink3;
  for (let i = 0; i < N; i += 1) {
    ctx.beginPath();
    ctx.arc(plot.sx(AGE[i]), plot.sy(TOTCHOL[i]), 1.4, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (a > 0.02) {
    const bi = state.bInd.b;
    const bx = state.bInt.b;
    const b0 = lerp(bi[0], bx[0], t);
    const b1 = lerp(bi[1], bx[1], t);
    const b2 = lerp(bi[2], bx[2], t);
    const b3 = lerp(0, bx[3], t);
    const yAt = (B, age) => (b0 + b2 * B) + (b1 + b3 * B) * age;
    const halo = (text, x, y, align) => {
      ctx.font = `600 ${colors.fsXs} ${colors.font}`;
      ctx.textAlign = align;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    };
    const lineAt = (B, color, width, alpha) => {
      ctx.globalAlpha = a * alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(plot.sx(X_DATA[0]), plot.sy(yAt(B, X_DATA[0])));
      ctx.lineTo(plot.sx(69), plot.sy(yAt(B, 69)));
      ctx.stroke();
    };
    /* the sample levels, labelled at the left end — that is where the fan
       is widest under BOTH readings, so the labels never collide */
    for (const B of [20, 30, 40]) {
      lineAt(B, colors.empirical, 2, 0.5);
      ctx.fillStyle = colors.empirical;
      halo(`BMI ${B}`, plot.sx(X_DATA[0]) + 4, plot.sy(yAt(B, X_DATA[0])) - 5, "left");
    }
    /* the probed level: the age slope, read where the reader chose, from
       the lerped coefficients — the counting-label rule */
    const slope = b1 + b3 * params.probebmi;
    lineAt(params.probebmi, colors.highlight, 2.5, 1);
    ctx.fillStyle = colors.highlight;
    halo(
      `BMI ${params.probebmi}: ${slope >= 0 ? "+" : ""}${fmt(slope, 2)} per year of age`,
      plot.sx(69) - 6,
      plot.sy(yAt(params.probebmi, 69)) - 8,
      "right",
    );
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* --- act 3: diabetes × sex — the INTERACTION PLOT (round 2) ---------------
   The canonical two-factor display, and the notebook's own (ggPredict,
   cell 36): the x-axis holds the two diabetes positions, each sex is ONE
   LINE joining its model predictions — the same grammar as the age tab
   with the continuum reduced to two positions. PARALLEL lines are the
   independent model's claim (one diabetes effect for everyone); toggling
   × pivots them onto the observed cell means, and the right-edge bracket
   names the nonparallelism against a dotted if-parallel ghost: the
   difference of the two rises IS the printed interaction coefficient.
   The slope labels ride the lerped lines and count (widget 29's rule).
   The observed means are fixed group-coloured ticks the lines land on or
   miss; the four floating bars, per-bar prediction ticks and vertical
   arrows of round 1 are deleted — they were the hard-to-read part. */
function drawTwoByTwo(ctx, colors, r, params, state, a, t) {
  const sy = (v) => r.y + r.h - ((v - Y3_DOM[0]) / (Y3_DOM[1] - Y3_DOM[0])) * r.h;
  const X0 = r.x + r.w * 0.22;
  const X1 = r.x + r.w * 0.72;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  for (let v = 230; v <= 265; v += 10) ctx.fillText(String(v), r.x - 5, sy(v) + 3);
  ctx.save();
  ctx.translate(r.x - 36, r.y + r.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("totChol (cell mean)", 0, 0);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = colors.ink2;
  ctx.fillText("no diabetes", X0, r.y + r.h + 14);
  ctx.fillText("diabetes", X1, r.y + r.h + 14);
  ctx.fillStyle = colors.ink3;
  ctx.fillText(`n = ${state.cells.d0s0.n + state.cells.d0s1.n}`, X0, r.y + r.h + 27);
  ctx.fillText(`n = ${state.cells.d1s0.n + state.cells.d1s1.n}`, X1, r.y + r.h + 27);

  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillText(!params.fit
    ? "the four cell means — no model yet"
    : params.terms === "times"
      ? "not parallel — the interaction is the difference of the two rises"
      : "parallel — one diabetes effect for everyone, and the means disagree",
  r.x, r.y - 8);

  /* the observed cell means: fixed ticks in their group's colour */
  const OBS = [["d0s0", X0, 0], ["d1s0", X1, 0], ["d0s1", X0, 1], ["d1s1", X1, 1]];
  for (const [k, x, s] of OBS) {
    ctx.strokeStyle = s === 0 ? colors.groupA : colors.groupB;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 15, sy(state.cells[k].mean));
    ctx.lineTo(x + 15, sy(state.cells[k].mean));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (a <= 0.02) return;

  /* the model's two lines, from the lerped predictions */
  const P = {};
  for (const k of ["d0s0", "d1s0", "d0s1", "d1s1"]) {
    P[k] = lerp(state.dsPred.plus[k], state.dsPred.times[k], t);
  }
  ctx.globalAlpha = a;
  const lineFor = (s, color, name) => {
    const y0 = P[`d0s${s}`];
    const y1 = P[`d1s${s}`];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(X0, sy(y0));
    ctx.lineTo(X1, sy(y1));
    ctx.stroke();
    ctx.fillStyle = color;
    for (const [x, y] of [[X0, y0], [X1, y1]]) {
      ctx.beginPath();
      ctx.arc(x, sy(y), 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    const rise = y1 - y0;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    const label = `${name}: ${rise >= 0 ? "+" : ""}${fmt(rise, 1)}`;
    const mx = (X0 + X1) / 2;
    const my = sy((y0 + y1) / 2) + (s === 0 ? -8 : 14);
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(label, mx, my);
    ctx.fillStyle = color;
    ctx.fillText(label, mx, my);
    return rise;
  };
  const riseW = lineFor(0, colors.groupA, "women");
  const riseM = lineFor(1, colors.groupB, "men");

  /* the nonparallelism, named: women's actual end against where their
     line WOULD end if parallel to the men's — the bracket length is the
     printed interaction coefficient, counting in with the ease */
  if (t > 0.5) {
    const ghostEnd = P.d0s0 + riseM;
    const bx = X1 + 30;
    ctx.globalAlpha = a * (t - 0.5) * 2;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.ink3;
    ctx.beginPath();
    ctx.moveTo(X0, sy(P.d0s0));
    ctx.lineTo(bx, sy(ghostEnd));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, sy(P.d1s0));
    ctx.lineTo(bx, sy(ghostEnd));
    ctx.stroke();
    for (const y of [P.d1s0, ghostEnd]) {
      ctx.beginPath();
      ctx.moveTo(bx - 4, sy(y));
      ctx.lineTo(bx + 4, sy(y));
      ctx.stroke();
    }
    ctx.fillStyle = colors.highlight;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.fillText("the interaction:", bx + 8, sy((P.d1s0 + ghostEnd) / 2) - 3);
    ctx.fillText(fmt(riseW - riseM, 2), bx + 8, sy((P.d1s0 + ghostEnd) / 2) + 11);
    ctx.globalAlpha = a;
  }
  ctx.globalAlpha = 1;
}
