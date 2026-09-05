/* ============================================================================
   Widget 29 · Fitting a Categorical Covariate — the coefficient that is a
   difference of means, and the reference that is a choice.

   PHM5003 05-03 (Modeling — Categorical Covariates). The misconception
   (catalogue slot 3): dummy coefficients are group means, and the reference
   level is a finding rather than a choice. Measured first
   (`_lab/lm-cat-measure.mjs`, 25 checks, every 05-03 stored output to the
   digit): the identity GROUP MEAN = INTERCEPT + COEFFICIENT holds to 1e-9,
   so a coefficient IS a difference of means — drawn here as an ARROW from
   the reference's ruled mean to each group's mean (the offsets are
   7.7–18.5px at panel scale, alive in data space, which widget 28's moves
   never were). Releveling moves every coefficient while the four means and
   R² are identical to machine precision — the widget's punchline, played
   by easing the RULE to the new reference's mean while the mean bars
   refuse to move. R's own default reference (healthy) is the alphabet's
   choice, which the control's detail says out loud.

   KENNETH'S PICKS (round 1, from _lab/lm-cat-stage.html): stage C — the
   four jittered category columns with coefficient arrows, beside a zoomed
   means ladder (108–152) as a magnifier, guide lines connecting the two.
   SEX IS OUT OF SCOPE: its offset is 2.4px at panel scale (the mock's §4
   draws the notebook's parallel lines failing), and its marginal-vs-
   adjusted story is widget 28's lesson.

   The coding table (the notebook's own model.matrix move, printed twice in
   05-03) rides full-width under the stage while the model is fitted: the
   reference row is all zeros, which is WHY its mean is the intercept, and
   releveling visibly moves the zero row. Term order everywhere is BMI
   order (underweight → obese), the notebook's own cell-36 order — R's
   printed output is alphabetical only by accident, the same accident the
   reference teaches.

   THE DATA IS THE ARC'S SHARED STAGE — ../lm-least-squares/data.js, 05-03's
   frame is 05-01's exactly (filter(BPMeds==0) + drop_na, n = 3547). The
   only randomness is the dots' horizontal jitter, seeded.

   TDZ lesson (widget 28's, earned): every module-scope const lives ABOVE
   defineWidget — core calls draw() during the defineWidget call itself.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { ols } from "../lm-least-squares/model.js";
import { N, BMI, SYSBP } from "../lm-least-squares/data.js";

/* the notebook's case_when, verbatim thresholds */
const GROUPS = ["underweight", "healthy", "overweight", "obese"];
const CAT = BMI.map((b) => (b < 18.5 ? 0 : b < 25 ? 1 : b < 30 ? 2 : 3));

const Y_DOM = [80, 300];
const ZOOM_DOM = [108, 152];
const EASE_MS = 450;

/* --- stage geometry, one place (regions shares it) ----------------------- */
const STAGE_Y = 30;
const STAGE_H = 260;
const TABLE_TOP = STAGE_Y + STAGE_H + 44;
const TABLE_H = 160;
const HEIGHT = (fit) => (fit ? TABLE_TOP + TABLE_H + 26 : STAGE_Y + STAGE_H + 44);

/* The ladder is the magnifier; below ~400px of stage there is no room to
   magnify into, and the columns keep the whole width. */
function stageRects(w, fit) {
  const full = { x: 56, y: STAGE_Y, w: w - 70, h: STAGE_H };
  if (!fit || w - 70 < 400) return { cols: full, ladder: null };
  const colsW = Math.round((w - 70) * 0.585);
  return {
    cols: { x: 56, y: STAGE_Y, w: colsW, h: STAGE_H },
    ladder: { x: 56 + colsW + 44, y: STAGE_Y, w: w - (56 + colsW + 44) - 14, h: STAGE_H },
  };
}
const colCenter = (r, gi) => r.x + gi * (r.w / 4) + r.w / 8;

/* ---- the equation card, widget 27/28's machinery ------------------------ */
const MATHML = mathmlRenders();

const GENERIC_MATHML =
  "<math><mrow><mi>y</mi><mo>=</mo><msub><mi>b</mi><mn>0</mn></msub>"
  + "<mo>+</mo><msub><mi>b</mi><mn>1</mn></msub><msub><mi>x</mi><mn>1</mn></msub>"
  + "<mo>+</mo><msub><mi>b</mi><mn>2</mn></msub><msub><mi>x</mi><mn>2</mn></msub>"
  + "<mo>+</mo><mi>&#x2026;</mi></mrow></math>";
const GENERIC_PLAIN = "y = b₀ + b₁x₁ + b₂x₂ + …";

/* One <math> per term so the equation wraps (widget 14's lesson); a negative
   coefficient folds its sign into the operator. The indicator terms wear
   their category name in brackets — the 0/1 column, named. */
function eqHTML(terms) {
  const mag = (v) => fmt(Math.abs(v), 2);
  if (!MATHML) {
    return terms.map((t, i) => (i === 0
      ? `sysBP = ${fmt(t.num, 2)}`
      : `${t.num < 0 ? "−" : "+"} ${mag(t.num)} × [${t.name}]`)).join(" ");
  }
  return terms.map((t, i) => (i === 0
    ? `<math><mrow><mi>sysBP</mi><mo>=</mo><mn>${fmt(t.num, 2)}</mn></mrow></math>`
    : `<math><mrow><mo form="infix">${t.num < 0 ? "&#x2212;" : "+"}</mo><mn>${mag(t.num)}</mn><mo>&#xD7;</mo><mi>[${t.name}]</mi></mrow></math>`
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
  const key = terms ? terms.map((t) => `${t.num}${t.name ?? ""}`).join(",") : "none";
  if (key === mathKey) return;
  mathKey = key;
  const row = (label, html) =>
    `<div class="w-math-eq" style="min-height:0"><span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${label}</span>${html}</div>`;
  const generic = `<span style="color:var(--ink-2)">${MATHML ? GENERIC_MATHML : GENERIC_PLAIN}</span>`;
  const model = terms
    ? eqHTML(terms)
    : `<span style="color:var(--ink-3)">no model fitted yet</span>`;
  mathHost.innerHTML = row("the model", generic) + row("this model", model);
}

defineWidget({
  slug: "lm-categorical",
  title: "Fitting a Categorical Covariate",
  status: "shipped",
  subtitle:
    "A categorical covariate enters the model as indicator columns, one " +
    "per category beyond a reference level. Each coefficient is then the " +
    "difference between that category's mean and the reference's — so " +
    "changing the reference rewrites every coefficient without changing " +
    "the model.",
  layout: "side",
  height: ({ fit }) => HEIGHT(Boolean(fit)),

  params: {
    model: { type: "section", label: "The model" },

    /* Widget 26's gate: the widget opens as data and a question — four
       columns of patients, no means, no arrows. `display: true` — compute
       derives everything regardless; the gate only reveals it. */
    fit: {
      type: "gate",
      label: "Fit the model",
      labelOff: "Clear the fit",
      detail: "sysBP on the four BMI categories — each patient's prediction is their category's mean",
      display: true,
    },

    /* THE PUNCHLINE CONTROL: pick the reference and every coefficient
       rewrites while the means stand still. The columns are click regions
       for the same parameter; this segmented is the keyboard path. */
    ref: {
      type: "segmented",
      label: "Reference level",
      options: [
        { value: "underweight", label: "under", detail: "BMI below 18.5 — 48 patients" },
        { value: "healthy", label: "healthy", detail: "R's own default — first in the alphabet, not a medical choice" },
        { value: "overweight", label: "over", detail: "BMI 25 to 30 — 1480 patients" },
        { value: "obese", label: "obese", detail: "BMI 30 and above — 424 patients" },
      ],
      default: "healthy",
      display: true,
      when: { param: "fit" },
    },

    /* the dots' horizontal jitter, and nothing else */
    seed: { type: "int", min: 1, max: 200, default: 1, hidden: true },
  },

  legend: [
    { token: "unknown", label: "3547 patients from the Framingham study, one column per BMI category", mark: "dot" },
    { token: "empirical", label: "Each category's mean sysBP", mark: "line" },
    { token: "highlight", label: "The coefficients — each an offset from the reference's mean", mark: "line" },
    { token: "ink-2", label: "The reference level's mean — the model's intercept", mark: "line" },
  ],

  compute({ params }) {
    const rng = makeRng(params.seed);
    const jit = CAT.map(() => rng.next());
    const sums = [0, 0, 0, 0];
    const ns = [0, 0, 0, 0];
    for (let i = 0; i < N; i += 1) {
      sums[CAT[i]] += SYSBP[i];
      ns[CAT[i]] += 1;
    }
    const means = sums.map((s, g) => s / ns[g]);
    /* one parameterization suffices for R² and spread — both are properties
       of the MODEL, which every reference level shares (the identity the
       measure script asserts at 1e-12) */
    const d = (g) => CAT.map((c) => (c === g ? 1 : 0));
    const f = ols(SYSBP, d(3), d(2), d(0));
    return { jit, means, ns, r2: f.r2, sd: Math.sqrt(f.ssRes / N) };
  },

  /* WIDGET 12'S EASE, NOT A DRIVE: the drive row is Reset alone. On
     relevel the RULE eases to the new reference's mean and every arrow —
     drawn live from the eased rule to the fixed means — re-anchors with
     it; the labels count along (each is the signed distance from the
     EASED rule, so no printed number is ever false mid-frame).
     `anim.easing = true` in rebuild is core's REQUEST FOR FRAMES (widget
     28's earned comment — omit it and the marks stand still for ever). */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params, state }) => {
      const gi = GROUPS.indexOf(params.ref);
      const on = params.fit ? 1 : 0;
      return {
        rule: { v: state.means[gi], a: on },
        ruleT: { v: state.means[gi], a: on },
      };
    },
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      const chase = (key) => {
        const gap = anim.ruleT[key] - anim.rule[key];
        if (Math.abs(gap) < 0.0015) {
          anim.rule[key] = anim.ruleT[key];
          return;
        }
        anim.rule[key] += gap * rate;
        moving = true;
      };
      chase("v");
      chase("a");
      return moving;
    },
    rebuild: (anim, { params, state }) => {
      const gi = GROUPS.indexOf(params.ref);
      anim.ruleT.v = state.means[gi];
      anim.ruleT.a = params.fit ? 1 : 0;
      if (anim.rule.a < 0.02 && anim.ruleT.a > 0) anim.rule.v = anim.ruleT.v;
      if (Math.abs(anim.rule.v - anim.ruleT.v) > 0.0015
        || Math.abs(anim.rule.a - anim.ruleT.a) > 0.0015) {
        anim.easing = true;
      }
    },
  },

  /* The category columns set the reference — the same write the segmented
     performs, through the same door; no regions while the model is
     unfitted (3.6: the control this shortcuts must be visible). */
  regions({ w, params }) {
    if (!params.fit) return [];
    const { cols } = stageRects(w, true);
    return GROUPS.map((g, gi) => ({
      x: cols.x + gi * (cols.w / 4),
      y: cols.y,
      w: cols.w / 4,
      h: cols.h,
      set: { ref: g },
      label: `reference: ${g}`,
    }));
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const refI = GROUPS.indexOf(params.ref);
    const a = anim?.rule.a ?? (params.fit ? 1 : 0);
    const ruleV = anim?.rule.v ?? state.means[refI];

    renderEquation(params.fit
      ? [{ num: state.means[refI] }].concat(
        GROUPS.map((g, gi) => ({ gi, g }))
          .filter(({ gi }) => gi !== refI)
          .map(({ g, gi }) => ({ num: state.means[gi] - state.means[refI], name: g })),
      )
      : null);

    const { cols, ladder } = stageRects(w, params.fit);

    /* --- the four category columns ------------------------------------- */
    const plot = makePlot({ ctx, colors, rect: cols, xDomain: [0, 4], yDomain: Y_DOM });
    plot.axisY({ label: "sysBP (mmHg)" });
    plot.caption(params.fit
      ? `the model — every prediction is a category's mean; reference = ${params.ref}`
      : "3547 patients in four BMI categories — no model yet");

    ctx.save();
    ctx.beginPath();
    ctx.rect(cols.x, cols.y, cols.w, cols.h);
    ctx.clip();
    ctx.fillStyle = colors.unknown;
    ctx.globalAlpha = 0.3;
    const colW = cols.w / 4;
    for (let i = 0; i < N; i += 1) {
      const px = colCenter(cols, CAT[i]) + (state.jit[i] - 0.5) * (colW - 26);
      ctx.beginPath();
      ctx.arc(px, plot.sy(SYSBP[i]), 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (a > 0.02) {
      const refY = plot.sy(ruleV);
      ctx.globalAlpha = a;
      ctx.strokeStyle = colors.ink2;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cols.x, refY);
      ctx.lineTo(cols.x + cols.w, refY);
      ctx.stroke();
      ctx.setLineDash([]);

      GROUPS.forEach((g, gi) => {
        const my = plot.sy(state.means[gi]);
        ctx.strokeStyle = colors.empirical;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(colCenter(cols, gi) - colW / 2 + 12, my);
        ctx.lineTo(colCenter(cols, gi) + colW / 2 - 12, my);
        ctx.stroke();
        if (gi !== refI) {
          /* the arrow IS the coefficient: from the (eased) rule to this
             group's mean, its label the signed distance from the eased
             rule so the number is honest on every frame */
          const ax = colCenter(cols, gi) + colW / 2 - 24;
          const d = state.means[gi] - ruleV;
          if (Math.abs(my - refY) > 3) {
            ctx.strokeStyle = colors.highlight;
            ctx.fillStyle = colors.highlight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ax, refY);
            ctx.lineTo(ax, my);
            ctx.stroke();
            const dir = my < refY ? -1 : 1;
            ctx.beginPath();
            ctx.moveTo(ax, my);
            ctx.lineTo(ax - 4, my - dir * 6);
            ctx.lineTo(ax + 4, my - dir * 6);
            ctx.fill();
          }
          ctx.fillStyle = colors.highlight;
          ctx.font = `600 ${colors.fsXs} ${colors.font}`;
          /* the last column's label sits LEFT of its arrow — right of it
             the clip ate the digits (mock lesson) */
          ctx.textAlign = gi === GROUPS.length - 1 ? "right" : "left";
          ctx.fillText(`${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), 2)}`,
            ax + (gi === GROUPS.length - 1 ? -7 : 7), (refY + my) / 2 + 3);
        }
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* category names and group sizes under the axis */
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    GROUPS.forEach((g, gi) => {
      ctx.fillText(g, colCenter(cols, gi), cols.y + cols.h + 14);
      ctx.fillStyle = colors.ink3;
      ctx.fillText(`n = ${state.ns[gi]}`, colCenter(cols, gi), cols.y + cols.h + 27);
      ctx.fillStyle = colors.ink2;
    });

    /* --- the zoomed means ladder (stage C's magnifier) ------------------ */
    if (ladder && a > 0.02) {
      const lsy = (v) => ladder.y + ladder.h - ((v - ZOOM_DOM[0]) / (ZOOM_DOM[1] - ZOOM_DOM[0])) * ladder.h;
      ctx.globalAlpha = a;

      /* guide lines: each mean carried from the columns into the zoom */
      ctx.strokeStyle = colors.ink3;
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = 1;
      for (let gi = 0; gi < 4; gi += 1) {
        ctx.beginPath();
        ctx.moveTo(cols.x + cols.w, plot.sy(state.means[gi]));
        ctx.lineTo(ladder.x, lsy(state.means[gi]));
        ctx.stroke();
      }
      ctx.globalAlpha = a;

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(ladder.x, ladder.y, ladder.w, ladder.h);
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      for (let v = 110; v <= 150; v += 10) ctx.fillText(String(v), ladder.x - 4, lsy(v) + 3);

      const refY = lsy(ruleV);
      ctx.strokeStyle = colors.ink2;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ladder.x, refY);
      ctx.lineTo(ladder.x + ladder.w, refY);
      ctx.stroke();
      ctx.setLineDash([]);

      GROUPS.forEach((g, gi) => {
        const my = lsy(state.means[gi]);
        ctx.strokeStyle = colors.empirical;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ladder.x + 6, my);
        ctx.lineTo(ladder.x + 40, my);
        ctx.stroke();
        if (gi !== refI && Math.abs(my - refY) > 3) {
          ctx.strokeStyle = colors.highlight;
          ctx.fillStyle = colors.highlight;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ladder.x + 23, refY);
          ctx.lineTo(ladder.x + 23, my);
          ctx.stroke();
          const dir = my < refY ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(ladder.x + 23, my);
          ctx.lineTo(ladder.x + 19, my - dir * 6);
          ctx.lineTo(ladder.x + 27, my - dir * 6);
          ctx.fill();
        }
        /* surface halo so the rule's dashes never strike a label */
        const label = `${g}  ${fmt(state.means[gi], 2)}`;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.textAlign = "left";
        ctx.strokeStyle = colors.surface;
        ctx.lineWidth = 3;
        ctx.strokeText(label, ladder.x + 46, my + 3);
        ctx.fillStyle = colors.ink2;
        ctx.fillText(label, ladder.x + 46, my + 3);
      });
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText("the means, magnified", ladder.x + ladder.w / 2, ladder.y + ladder.h + 14);
      ctx.globalAlpha = 1;
    }

    /* --- the coding table, the notebook's model.matrix move -------------- */
    if (params.fit) drawCoding(ctx, colors, { x: 56, w: w - 70 }, refI);
  },

  readout({ params, state }) {
    if (!params.fit) {
      return [
        { label: "R²", value: "—", note: "fit the model first" },
        { label: "Residual spread", value: "—", note: "what one mean per category leaves over" },
      ];
    }
    return [
      {
        label: "R²",
        value: fmt(state.r2, 2),
        note: "identical for every reference level — the model never changed",
      },
      {
        label: "Residual spread",
        value: fmt(state.sd, 1),
        note: "mmHg left over per patient around their category's mean",
      },
    ];
  },

  summary({ params, state }) {
    const parts = [
      "Systolic blood pressure for 3547 Framingham patients in four BMI categories"
      + ` (n = ${state.ns.join(", ")}).`,
    ];
    if (params.fit) {
      const refI = GROUPS.indexOf(params.ref);
      parts.push(`A linear model on the category indicators, reference ${params.ref}:`
        + ` intercept ${fmt(state.means[refI], 2)},`
        + " each other coefficient the difference between that category's mean and the reference's.");
      parts.push(`R² is ${fmt(state.r2, 2)} for every choice of reference.`);
    } else {
      parts.push("No model fitted yet.");
    }
    return parts.join(" ");
  },
});

/* --- the coding table (below defineWidget is safe: FUNCTIONS hoist) ------
   k categories become k − 1 indicator columns, and the reference row is
   ALL ZEROS — which is why its mean is the intercept. Releveling moves
   the zero row, so the table and the segmented read each other. Category
   rows, not patient rows: four patterns teach more than six patients. */
function drawCoding(ctx, colors, rp, refI) {
  const dummies = GROUPS.filter((_, gi) => gi !== refI);
  const labW = Math.min(150, Math.round(rp.w * 0.32));
  const colW = (rp.w - labW) / dummies.length;
  const rowH = 26;
  const top = TABLE_TOP;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("How the categories are coded", rp.x, top);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  dummies.forEach((d, j) => {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.fillText(`[${d}]`, rp.x + labW + j * colW + colW / 2, top + 16);
  });
  GROUPS.forEach((g, gi) => {
    const ry = top + 34 + gi * rowH;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rp.x, ry - rowH + 9);
    ctx.lineTo(rp.x + rp.w, ry - rowH + 9);
    ctx.stroke();
    ctx.fillStyle = gi === refI ? colors.ink1 : colors.ink2;
    ctx.textAlign = "left";
    ctx.font = `${gi === refI ? "600 " : ""}${colors.fsXs} ${colors.font}`;
    ctx.fillText(g + (gi === refI ? "  (reference)" : ""), rp.x + 4, ry);
    dummies.forEach((d, j) => {
      ctx.fillStyle = colors.ink1;
      ctx.textAlign = "center";
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillText(g === d ? "1" : "0", rp.x + labW + j * colW + colW / 2, ry);
    });
    if (gi === refI) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rp.x, ry - rowH + 9, rp.w, rowH);
    }
  });
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.fillText("the reference row is all zeros — its mean is the intercept",
    rp.x, top + 34 + 4 * rowH + 12);
  ctx.restore();
}
