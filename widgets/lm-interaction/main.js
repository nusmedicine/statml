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
import { N, AGE, SEX, TOTCHOL, DIABETES } from "../lm-least-squares/data.js";

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
function renderEquation(kind, terms) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = kind + (terms ? terms.map((t) => `${t.num}${t.name ?? ""}`).join(",") : "none");
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const g = GENERIC[kind];
  const generic = `<span style="color:var(--ink-2)">${MATHML ? g.math : g.plain}</span>`;
  const model = terms
    ? eqHTML(terms)
    : `<span style="color:var(--ink-3)">no model fitted yet</span>`;
  mathHost.innerHTML = row("the model", generic) + row("this model", model);
}

defineWidget({
  slug: "lm-interaction",
  title: "Fitting an Interaction",
  status: "draft",
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
      options: [
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

  legend: [
    { token: "group-a", label: "Women (sex 0, the reference) — their patients and their model line", mark: "dot" },
    { token: "group-b", label: "Men (sex 1) — their patients and their model line", mark: "dot" },
    { token: "highlight", label: "The effect being read from the model — a gap or a per-group difference", mark: "line" },
    { token: "empirical", label: "Observed cell means (the 2 × 2 tab)", mark: "line" },
  ],

  compute() {
    const mul = (a, b) => a.map((v, i) => v * b[i]);
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
      aInd, aInt, asLines, cells, dInd, dInt, dsPred,
      r2: { agesex: { plus: aInd.r2, times: aInt.r2 }, diabsex: { plus: dInd.r2, times: dInt.r2 } },
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
       card is text, and snaps with the control; the canvas is what eases) */
    if (!params.fit) {
      renderEquation(params.terms, null);
    } else if (params.concept === "agesex") {
      const f = params.terms === "times" ? state.aInt : state.aInd;
      renderEquation(params.terms, [
        { num: f.b[0] },
        { num: f.b[1], name: "age" },
        { num: f.b[2], name: "[sex]" },
      ].concat(params.terms === "times" ? [{ num: f.b[3], name: "age × [sex]" }] : []));
    } else {
      const f = params.terms === "times" ? state.dInt : state.dInd;
      renderEquation(params.terms, [
        { num: f.b[0] },
        { num: f.b[1], name: "[diabetes]" },
        { num: f.b[2], name: "[sex]" },
      ].concat(params.terms === "times" ? [{ num: f.b[3], name: "[diabetes] × [sex]" }] : []));
    }

    if (params.concept === "agesex") {
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
      const f = params.concept === "agesex" ? state.aInt : state.dInt;
      tiles.push({
        label: "Interaction",
        value: fmt(f.b[3], 2),
        note: params.concept === "agesex"
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
    if (params.concept === "agesex") {
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

/* --- act 3: diabetes × sex -------------------------------------------------
   The observed cell means stand still (empirical bars); the MODEL'S four
   predictions (highlight ticks) ease between the one-size reading and the
   saturated one, and the per-group arrows are read from the eased
   predictions — under + both say +10.18, under × they land on +21.0 and
   −0.02. The counting labels are widget 29's rule again. */
function drawTwoByTwo(ctx, colors, r, params, state, a, t) {
  const sy = (v) => r.y + r.h - ((v - Y3_DOM[0]) / (Y3_DOM[1] - Y3_DOM[0])) * r.h;
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

  const keys = ["d0s0", "d1s0", "d0s1", "d1s1"];
  const X = {
    d0s0: r.x + r.w * 0.16,
    d1s0: r.x + r.w * 0.36,
    d0s1: r.x + r.w * 0.62,
    d1s1: r.x + r.w * 0.82,
  };
  const NAME = { d0s0: "no diabetes", d1s0: "diabetes", d0s1: "no diabetes", d1s1: "diabetes" };

  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillText(!params.fit
    ? "the four cells — no model yet"
    : params.terms === "times"
      ? "the saturated model lands on the cell means — +21.0 in women, nothing in men"
      : "the independent model gives every patient the same diabetes effect",
  r.x, r.y - 8);

  for (const k of keys) {
    const col = k.endsWith("s0") ? colors.groupA : colors.groupB;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(X[k] - 30, sy(state.cells[k].mean));
    ctx.lineTo(X[k] + 30, sy(state.cells[k].mean));
    ctx.stroke();
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.fillText(NAME[k], X[k], r.y + r.h + 14);
    ctx.fillStyle = colors.ink3;
    ctx.fillText(`n = ${state.cells[k].n}`, X[k], r.y + r.h + 27);
    ctx.fillStyle = colors.ink1;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.fillText(fmt(state.cells[k].mean, 1), X[k], sy(state.cells[k].mean) - 8);
  }
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.fillText("women", (X.d0s0 + X.d1s0) / 2, r.y + r.h + 42);
  ctx.fillText("men", (X.d0s1 + X.d1s1) / 2, r.y + r.h + 42);

  if (a <= 0.02) return;

  /* the model's predictions, eased between the two readings */
  const P = {};
  for (const k of keys) P[k] = lerp(state.dsPred.plus[k], state.dsPred.times[k], t);
  ctx.globalAlpha = a;
  for (const k of keys) {
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(X[k] - 16, sy(P[k]));
    ctx.lineTo(X[k] + 16, sy(P[k]));
    ctx.stroke();
  }
  const arrow = (x, from, to, label) => {
    ctx.strokeStyle = colors.highlight;
    ctx.fillStyle = colors.highlight;
    ctx.lineWidth = 2;
    const big = Math.abs(sy(to) - sy(from)) > 8;
    if (big) {
      ctx.beginPath();
      ctx.moveTo(x, sy(from));
      ctx.lineTo(x, sy(to));
      ctx.stroke();
      const dir = sy(to) < sy(from) ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, sy(to));
      ctx.lineTo(x - 4, sy(to) - dir * 6);
      ctx.lineTo(x + 4, sy(to) - dir * 6);
      ctx.fill();
    }
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    const ly = big ? (sy(from) + sy(to)) / 2 + 3 : sy(to) + 24;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(label, x + 9, ly);
    ctx.fillStyle = colors.highlight;
    ctx.fillText(label, x + 9, ly);
  };
  const dW = P.d1s0 - P.d0s0;
  const dM = P.d1s1 - P.d0s1;
  arrow((X.d0s0 + X.d1s0) / 2 + 36, P.d0s0, P.d1s0, `${dW >= 0 ? "+" : ""}${fmt(dW, 1)} in women`);
  arrow((X.d0s1 + X.d1s1) / 2 + 36, P.d0s1, P.d1s1, `${dM >= 0 ? "+" : ""}${fmt(dM, 1)} in men`);
  ctx.globalAlpha = 1;
}
