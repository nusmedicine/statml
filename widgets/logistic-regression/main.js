/* ============================================================================
   Widget 15 · Logistic Regression — what goes wrong with a straight line, what
   the link does about it, and why that makes the coefficient an odds ratio.

   Hosts at PHM5003 `04 / 05-05 — Modeling: Categorical Outcome`, and is that
   lesson's own model: `glm(TenYearCHD ~ BMI + age, family = "binomial")` on the
   3658 complete cases, with the printed coefficients to the digit.

   The reader arrives from `05-03`, where a 0/1 variable goes on the RIGHT-hand
   side and works perfectly well as a covariate. The obvious next move is to put
   one on the LEFT, and this widget is what happens when you do.

   THREE THINGS, IN ORDER, AND TWO BUTTONS:
     1. Fit a straight line to a 0/1 outcome and watch it leave the box. The
        probability axis runs past 0 and 1 for exactly this reason: a line
        clipped at the boundary hides the thing it is there to show.
     2. Add the link. log(odds) is unbounded, so the straight line lives there
        instead and the probability it implies never has to leave (0, 1).
     3. Read what one step is worth on each scale. Only on log-odds is it a
        constant, and that is what makes exp(b) an odds ratio — not anyone
        choosing odds because they are easy to interpret.

   EITHER COVARIATE GOES ON THE X AXIS, and the other is held. That is one
   control doing two jobs: it is how the reader sees the second coefficient at
   all, and it is "adjusted for" as a picture — holding a covariate at another
   value shifts the intercept and changes nothing else, because the model is
   linear in the link.

   WHERE THE STRAIGHT LINE FAILS IS DRIVEN BY THE HELD SLIDER, and that was
   measured rather than hoped for. Over the whole data the linear probability
   model only makes 37 of 3658 people impossible, which is easy to dismiss. But
   the failure is a property of the LINE, not of the sample: with BMI on x and
   age held at 32 the line is negative below BMI 29.1 — most of the visible axis
   — and reaches −0.063. Pulling the held slider down is what walks it out of
   the box.

   A SECOND DATA SET WAS BUILT AND CUT. `prevalentHyp ~ sysBP` is the only pair
   in the file whose probability spans 0.003 to 0.960, and there the same
   straight line makes 684 people (18.7%) impossible and predicts 269%. It made
   step 1 unmissable and it gave a probability strip that is a HUMP rather than
   a ramp, because hypertension crosses p = 0.5 and CHD never does. It went
   because matching 05-05 matters more, and it is recorded in the catalogue with
   its numbers in case this reads flat.

   AGGREGATES, NOT ROWS. Every panel is determined by (x, n, events), and for a
   binomial GLM that triple is a sufficient statistic — the fit from the
   aggregate is the fit from the rows, exactly. 356 bytes by age and 562 by BMI,
   against 39,868 for three columns of 3658.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";

/* --- the model, which is the notebook's ------------------------------------
   Coefficients are fixed rather than fitted in the browser: preset 1 of the
   lesson's output IS the thing to agree with, and agreeing with it is the
   widget's cheapest self-check. The OLS line is least squares on the 0/1
   outcome — the "linear probability model", which is exactly what step 1
   exists to discredit. Both were obtained on the same 3658 rows. */
const LOGIT = { b0: -6.54292372, bmi: 0.03532089, age: 0.07581313 };
const OLS = { b0: -0.435636, bmi: 0.004494, age: 0.009526 };

const CHD_BY_AGE = "32,1,0;33,5,0;34,14,0;35,33,2;36,77,2;37,80,4;38,124,7;39,147,6;40,167,11;41,145,10;42,161,14;43,137,11;44,143,11;45,140,13;46,166,13;47,114,18;48,149,17;49,116,20;50,123,19;51,123,26;52,129,24;53,116,21;54,119,18;55,123,19;56,105,24;57,108,24;58,97,27;59,100,28;60,98,25;61,91,20;62,91,24;63,96,29;64,80,18;65,46,14;66,34,13;67,38,17;68,16,7;69,5,1;70,1,0";
const CHD_BY_BMI = "15.5,1,0;16,1,1;16.5,6,1;17,6,3;17.5,11,1;18,17,1;18.5,25,2;19,36,4;19.5,44,8;20,71,8;20.5,90,8;21,98,15;21.5,108,11;22,143,19;22.5,152,15;23,173,28;23.5,189,19;24,218,29;24.5,192,20;25,202,27;25.5,184,32;26,200,36;26.5,178,29;27,176,26;27.5,137,17;28,139,24;28.5,145,22;29,116,25;29.5,97,22;30,84,22;30.5,61,10;31,51,11;31.5,50,7;32,35,2;32.5,40,9;33,27,7;33.5,19,6;34,13,3;34.5,13,2;35,22,4;35.5,8,0;36,11,0;36.5,6,2;37,6,2;37.5,6,2;38,4,0;38.5,8,2;39,9,3;39.5,4,2;40,7,3;40.5,2,1;41,1,0;41.5,3,1;42,1,0;42.5,1,0;43.5,4,2;44,1,0;44.5,3,0;46,1,0;51.5,1,0;57,1,1";

const parse = (s) => s.split(";").map((t) => t.split(",").map(Number));

/* Both axes share their y ranges, checked: over every reachable (BMI, age) the
   fitted log-odds stays inside −4 … 0.5 and the odds inside 0 … 1.5. */
const AXES = {
  age: {
    key: "age", label: "Age", other: "bmi", otherLabel: "BMI",
    detail: "Age on x — BMI is held, and one step is one year",
    rows: parse(CHD_BY_AGE), lo: 32, hi: 70, slot: 1,
    ticks: [35, 40, 45, 50, 55, 60, 65, 70], ticksWide: [40, 50, 60, 70],
    stepName: "one year", coefName: "age",
  },
  bmi: {
    key: "bmi", label: "BMI", other: "age", otherLabel: "Age",
    detail: "BMI on x — age is held, and one step is one BMI point",
    rows: parse(CHD_BY_BMI), lo: 15, hi: 45, slot: 0.5,
    ticks: [15, 20, 25, 30, 35, 40, 45], ticksWide: [20, 30, 40],
    stepName: "one BMI point", coefName: "BMI",
  },
};

/* THE PROBABILITY AXIS RUNS PAST 0 AND 1 ON PURPOSE. Step 1 is that a straight
   line predicts probabilities that are not probabilities; an axis stopping at
   the boundary clips exactly that away and leaves a line that merely touches
   the edge. The two bounds are ruled so the box is a thing the line can be
   outside of. */
const P_LO = -0.18, P_HI = 1.18;

/* --- the three rungs -------------------------------------------------------
   `of` maps a probability onto the rung. A non-finite or out-of-range result is
   a point the panel CANNOT DRAW, and at step 1 that is the lesson: a prediction
   outside (0, 1) has no odds and no log-odds, so the straight line is not
   merely wrong on the other two panels — it is absent from them. */
const RUNGS = [
  {
    key: "p", title: "probability", axis: "p", range: "0 to 1", bounds: [0, 1],
    lo: P_LO, hi: P_HI,
    ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => v.toFixed(2), raw: true,
    of: (p) => p,
    say: (a, b) => `${b - a >= 0 ? "+" : "−"}${(Math.abs(b - a) * 100).toFixed(2)} pp`,
    delta: "Δ p", scale: (v) => `${(v * 100).toFixed(2)} pp`,
  },
  {
    key: "odds", title: "odds", axis: "p / (1 − p)", range: "0 to ∞", bounds: [0],
    lo: -0.25, hi: 1.5,
    ticks: [0, 0.5, 1, 1.5], fmt: (v) => v.toFixed(1), raw: false,
    of: (p) => p / (1 - p),
    say: (a, b) => `+${(b - a).toFixed(3)}`,
    delta: "Δ odds", scale: (v) => v.toFixed(3),
  },
  {
    key: "logit", title: "log-odds", axis: "log( p / (1 − p) )", range: "−∞ to +∞", bounds: [],
    lo: -4, hi: 0.5,
    ticks: [-4, -3, -2, -1, 0], fmt: (v) => v.toFixed(0), raw: false,
    of: (p) => Math.log(p / (1 - p)),
    say: (a, b) => `+${(b - a).toFixed(4)}`,
    delta: "Δ log-odds", scale: (v) => v.toFixed(4),
  },
];

/* --- layout ---------------------------------------------------------------
   PAD_R carries the overhang of the last x tick, which is centred on the
   plot's right edge. */
const NOTE_H = 32, GAP = 8;
const PAD_L = 38, PAD_R = 14, PAD_T = 18, PAD_B = 34;
const MAIN_H = 260, STRIP_H = 36, STRIP_GAP = 6;
const CANVAS_H = NOTE_H + PAD_T + MAIN_H + STRIP_GAP + STRIP_H + PAD_B;

/* --- compute --------------------------------------------------------------
   Pure and parameter-only; nothing here is random, so `rng` is unused. */
function computeAll({ params }) {
  const A = AXES[params.xvar];
  const held = params[A.other];

  /* The held covariate folds into the intercept, and that folding IS the
     "adjusted for" fact: holding it somewhere else moves the line up or down
     and changes its slope not at all, because the model is linear in the
     link. */
  const bL = LOGIT.b0 + LOGIT[A.other] * held;
  const bO = OLS.b0 + OLS[A.other] * held;
  const kL = LOGIT[A.key], kO = OLS[A.key];
  const pLogit = (x) => 1 / (1 + Math.exp(-(bL + kL * x)));
  const pOls = (x) => bO + kO * x;

  /* Bins of five units of x, anchored on multiples of the width — 30-34,
     35-39 — which is how a person bins, and which is what leaves a zero-event
     bin at each end. Anchoring on the lowest value present removes them, and
     the ±∞ point with them. */
  const map = new Map();
  let n = 0, events = 0;
  for (const [x, c, e] of A.rows) {
    n += c; events += e;
    const k = Math.floor(x / 5) * 5;
    const b = map.get(k) ?? { k, n: 0, e: 0, sx: 0 };
    b.n += c; b.e += e; b.sx += x * c;
    map.set(k, b);
  }
  const bins = [...map.values()]
    .sort((p, q) => p.k - q.k)
    .map((b) => {
      const rate = b.e / b.n;
      const se = Math.sqrt((rate * (1 - rate)) / b.n);
      return {
        ...b,
        x: b.sx / b.n,
        rate,
        /* THE BINOMIAL FAMILY IS WHAT SAYS HOW FAR A DOT SHOULD BE FROM THE
           CURVE. The link picks the scale the mean is linear on; the family
           picks how each observation scatters around it, and for a 0/1 outcome
           that is one Bernoulli trial per person. 1.96·√(p(1−p)/n) is 4.9px at
           the 461-person bin and 20.9px at the 139-person one, so the sparse
           bins visibly wander and the dense ones do not. */
        lo: Math.max(1e-6, rate - 1.96 * se),
        hi: Math.min(1 - 1e-6, rate + 1.96 * se),
      };
    })
    .filter((b) => b.x >= A.lo && b.x <= A.hi);

  const curveL = [], curveO = [];
  for (let x = A.lo; x <= A.hi + 1e-9; x += (A.hi - A.lo) / 240) {
    curveL.push([x, pLogit(x)]);
    curveO.push([x, pOls(x)]);
  }

  /* WHERE THE STRAIGHT LINE LEAVES THE BOX, as a property of the line rather
     than a count of the sample: the count over these 3658 people is small and
     easy to dismiss, and it is not what is wrong. */
  const zeroAt = (0 - bO) / kO;
  const oneAt = (1 - bO) / kO;
  const outside = [];
  if (zeroAt > A.lo && zeroAt < A.hi) outside.push(`below ${A.label} ${zeroAt.toFixed(1)}`);
  if (oneAt > A.lo && oneAt < A.hi) outside.push(`above ${A.label} ${oneAt.toFixed(1)}`);

  /* THE STEP IS READ WHERE THE READER IS STANDING. Both covariates are live
     sliders again: whichever is on the axis is where the step is read, and the
     other is held. A swept cursor was tried and removed — stepping a marker
     along an axis is a fourth thing to operate on a figure whose point is a
     mapping, and varying the two covariates IS the exploration.

     ONE STEP PER WHOLE UNIT FOR THE STRIP, AND THEY BELONG TO WHICHEVER FIT IS
     SHOWING.
     That is not a saving, it is the comparison: a straight line asserts the
     RISK DIFFERENCE is the same everywhere, so its probability strip is flat
     and its log-odds strip is not. The link asserts the LOG-ODDS difference is
     the same everywhere, so the two silhouettes swap. Which assumption you are
     making is the choice the checkbox makes. */
  const pFit = params.link ? pLogit : pOls;
  const steps = [];
  for (let x = Math.ceil(A.lo); x + 1 <= A.hi + 1e-9; x += 1) {
    steps.push({ from: x, to: x + 1, p1: pFit(x), p2: pFit(x + 1) });
  }
  /* Taken from the slider itself, so a half-unit BMI is a real step rather than
     a lookup into the whole-unit bars that quietly misses. */
  const at = Math.min(params[A.key], A.hi - 1);
  const cur = { from: at, to: at + 1, p1: pFit(at), p2: pFit(at + 1) };

  return {
    A, bins, curveL, curveO, steps, cur, at, n, events, outside, held,
    worstLo: pOls(A.lo), worstHi: pOls(A.hi),
    half: (0 - bL) / kL,
    slope: kL,
    or: Math.exp(kL),
  };
}

/* --- the raw outcomes, laid out once per axis ------------------------------
   Not jittered — SPREAD. A dense band either way, and a deterministic layout is
   what stops the cloud shimmering every time a parameter moves. x is even
   inside the value's own slot; y walks a golden-ratio sequence across a thin
   band, which distributes without repeating and without randomness.

   THE BANDS ARE CENTRED ON 0 AND 1, not tucked inside them. The axis runs past
   both, so the data can sit exactly where it is and the two bounds can be ruled
   through it. */
const STRIPS = {};
for (const [key, A] of Object.entries(AXES)) {
  const yes = [], no = [];
  for (const [x, n, e] of A.rows) {
    if (x < A.lo || x > A.hi) continue;
    for (let j = 0; j < n; j += 1) {
      const ev = j < e;
      (ev ? yes : no).push([
        x + A.slot * 0.9 * ((j + 0.5) / n - 0.5),
        (ev ? 1 : 0) + 0.09 * (((j * 0.6180339887) % 1) - 0.5),
      ]);
    }
  }
  STRIPS[key] = { yes, no };
}

/* --- the framework row, in the DOM -----------------------------------------
   MOUNTED LAZILY FROM INSIDE draw(). `buildShell` creates `.w-figure` inside
   `defineWidget`, so this module's scope runs before it exists; querying there
   returns null and the reader gets a blank page rather than a missing row. */

/* DOES MathML LAY OUT? Compare a <math> against a <math>, never against a
   <span>: a span wrapping a math carries the surrounding line-height, and that
   comparison once reported a browser which sets maths perfectly as one that
   does not — which would have forced the fallback on every reader for ever. */
function mathmlRenders() {
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;visibility:hidden;font-size:16px";
  box.innerHTML = "<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math><math><mn>1</mn></math>";
  document.body.appendChild(box);
  const [frac, plain] = [...box.querySelectorAll("math")].map((m) => m.getBoundingClientRect().height);
  box.remove();
  return frac > plain * 1.3;
}
const MATHML = mathmlRenders();

/* THE EQUATION IS 05-05's OWN LINE, to the digit and to the subscript, so the
   widget and the lesson can sit side by side and be one thing.

   ONE <math> PER TERM. A single <math> does not line-break — MathML Core treats
   `white-space` as nowrap on every element and no engine implements automatic
   linebreaking — so a four-term equation in one <math> overflows rather than
   wraps. Separate inline elements with real whitespace between them are atomic
   inline boxes in an ordinary inline formatting context, so the break
   opportunities are exactly the seams authored here. And that is why every sign
   carries form="infix": first child of its own <math>, MathML would otherwise
   set a leading + as a PREFIX operator, which is unary and unspaced. */
const mi = (t) => `<mi mathvariant="normal">${t}</mi>`;
const sub = (v, s) => `<msub><mn>${v}</mn>${mi(s)}</msub>`;
const LHS = `<math><mrow>${mi("log")}<mo>(</mo><mfrac>`
  + "<mrow><mi>p</mi><mo>(</mo><mi>Y</mi><mo>)</mo></mrow>"
  + "<mrow><mn>1</mn><mo>−</mo><mi>p</mi><mo>(</mo><mi>Y</mi><mo>)</mo></mrow>"
  + "</mfrac><mo>)</mo><mo>=</mo></mrow></math>";

function equationHTML(xvar) {
  /* THE TERM ON THE X AXIS IS LIT. Which covariate is being stepped and which is
     held is a fact about the equation, and 2.7 puts a reading next to what
     produced it. */
  const term = (key, coef) => {
    const name = key === "bmi" ? "BMI" : "age";
    return `<math${key === xvar ? ' class="lit"' : ""}><mrow><mo form="infix">+</mo>`
      + `${mi(name)}<mo>×</mo>${sub(coef, name)}</mrow></math>`;
  };
  return `${LHS} <math><mrow><mo form="infix">−</mo>${sub("6.54", "intercept")}</mrow></math> `
    + `${term("bmi", "0.035")} ${term("age", "0.076")}`;
}
const EQ_PLAIN = "log( p(Y) / (1 − p(Y)) ) = −6.54 + BMI × 0.035 + age × 0.076";

/* THE LINK, DRAWN, ORIENTED THE WAY THE FIGURE BELOW IS.
   The conventional plot puts p on the horizontal axis. Every panel under this
   card puts it on the vertical one, and a 90-degree disagreement inside a single
   figure costs more than departing from a convention in a 132px inset — so p
   runs up the side here too, and the curve reads: for this probability, that is
   the log-odds. The reader's own two probabilities are marked on it, which is
   what turns the card from a definition into a reading. */
const FIG_W = 132, FIG_H = 74;
const figX = (y) => 24 + ((y + 6) / 12) * 102;
const figY = (p) => 62 - p * 52;

function figurePath() {
  const pts = [];
  for (let i = 0; i <= 140; i += 1) {
    const p = 0.0025 + (0.995 * i) / 140;
    pts.push(`${figX(Math.log(p / (1 - p))).toFixed(1)},${figY(p).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

const LINKS = [
  { link: "identity", to: "lm" },
  { link: "logit", to: "this widget", here: true },
  { link: "log", to: "hazards, counts" },
];

let cardHost = null;
let eqKey = null;

function renderFramework(params, cur) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    cardHost.innerHTML =
      '<div class="w-link-row"><div class="w-link-eq"></div>'
      + `<svg class="w-link-fig" width="${FIG_W}" height="${FIG_H}" viewBox="0 0 ${FIG_W} ${FIG_H}"`
      + ' aria-label="the logit function, with probability up the side and log-odds across: the interval 0 to 1 is stretched over the whole line">'
      + `<line x1="24" y1="${figY(1)}" x2="126" y2="${figY(1)}" stroke="var(--axis)" stroke-width="1" stroke-dasharray="2 2"/>`
      + `<line x1="24" y1="${figY(0)}" x2="126" y2="${figY(0)}" stroke="var(--axis)" stroke-width="1" stroke-dasharray="2 2"/>`
      + `<path d="${figurePath()}" fill="none" stroke="var(--c-theory)" stroke-width="1.6"/>`
      + '<circle class="fig-a" r="2.6" fill="var(--c-highlight)" style="display:none"/>'
      + '<circle class="fig-b" r="2.6" fill="var(--c-highlight)" style="display:none"/>'
      + `<text x="20" y="${figY(1)}" font-size="8" fill="var(--ink-3)" text-anchor="end" dominant-baseline="middle">1</text>`
      + `<text x="20" y="${figY(0)}" font-size="8" fill="var(--ink-3)" text-anchor="end" dominant-baseline="middle">0</text>`
      + '<text x="6" y="36" font-size="8" fill="var(--ink-3)" text-anchor="middle" transform="rotate(-90 6 36)">p</text>'
      + '<text x="75" y="72" font-size="8" fill="var(--ink-3)" text-anchor="middle">log(odds)</text>'
      + "</svg></div>"
      + '<ul class="w-links">'
      + LINKS.map((l) => `<li${l.here ? ' aria-current="true"' : ""}>${l.link} &rarr; ${l.to}</li>`).join("")
      + "</ul>";
    figure.parentNode.insertBefore(cardHost, figure);
  }

  /* MEMOISED ON WHAT IT DEPENDS ON. draw() runs per frame and rebuilding four
     <math> elements costs about 0.7ms against the 0.004ms of a fillText line.
     The equation depends on nothing but which term is lit. */
  if (eqKey !== params.xvar) {
    eqKey = params.xvar;
    const eq = cardHost.querySelector(".w-link-eq");
    if (MATHML) eq.innerHTML = equationHTML(params.xvar);
    else eq.textContent = EQ_PLAIN;
  }

  /* The two dots move on every frame of the sweep, so they are MOVED rather
     than rebuilt: two attribute writes against re-parsing the whole figure. */
  for (const [sel, p] of [[".fig-a", cur?.p1], [".fig-b", cur?.p2]]) {
    const dot = cardHost.querySelector(sel);
    if (p == null || !(p > 0) || !(p < 1)) { dot.style.display = "none"; continue; }
    dot.style.display = "";
    dot.setAttribute("cx", figX(Math.log(p / (1 - p))).toFixed(1));
    dot.setAttribute("cy", figY(p).toFixed(1));
  }
}

/* --- draw ----------------------------------------------------------------- */

/* THE CAPTION NARRATES THE THREE STAGES, and at stage 0 its job is to say what
   is on screen. "What is the dataset?" was a fair question about a figure that
   showed 3658 dots and named none of them. */
function caption(ctx, colors, w, state, params) {
  const { A } = state;
  const warn = !params.link && state.outside.length;
  const say = params.link
      /* THE TWO BOUNDS COME OFF ONE AT A TIME, and saying which is which is the
         answer to "why log it — doesn't 0/1 already map to p/(1−p)?". Odds
         alone still cannot go below zero. */
      ? [`Odds removes the ceiling at 1; the log removes the floor at 0. Only then is the scale unbounded both ways.`,
        `Odds removes the ceiling; the log removes the floor.`]
      : [state.outside.length
        /* Least squares on a 0/1 outcome fits E[Y|X], and for a binary Y that
           IS P(Y = 1|X) — which is why a fitted value outside 0 and 1 is a
           defect rather than a curiosity: the model has called it a
           probability. */
        ? `Least squares on a 0/1 outcome fits the probability itself — and here it leaves 0 and 1 ${state.outside.join(" and ")}.`
        : `Least squares on a 0/1 outcome fits the probability itself — pull ${A.otherLabel} down and it will leave 0 and 1.`,
      `Predictions ${state.outside.join(" and ") || "inside 0 and 1"}.`];
  const first = [
    `Framingham · ${state.n} people · a single 0 or 1 has no odds, so what the link transforms is the PROPORTION`,
    `${state.n} people · the link transforms the proportion, not the 0 or the 1`,
    `The link transforms the proportion.`,
  ];
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.ink3;
  ctx.fillText(first.find((t) => ctx.measureText(t).width < w - 8) ?? first[2], 2, 9);
  ctx.fillStyle = warn ? colors.extreme : colors.ink3;
  ctx.fillText(ctx.measureText(say[0]).width < w - 8 ? say[0] : say[1], 2, 23);
  ctx.restore();
}

function panel(ctx, colors, box, rung, state, params, isMiddle) {
  const { A } = state;
  const rect = { x: box.x + PAD_L, y: NOTE_H + PAD_T, w: box.w - PAD_L - PAD_R, h: MAIN_H };
  const stripRect = { x: rect.x, y: rect.y + MAIN_H + STRIP_GAP, w: rect.w, h: STRIP_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [A.lo, A.hi], yDomain: [rung.lo, rung.hi] });
  const strip = makePlot({ ctx, colors, rect: stripRect, xDomain: [A.lo, A.hi], yDomain: [0, 1] });
  const on = (v) => Number.isFinite(v) && v >= rung.lo - 1e-9 && v <= rung.hi + 1e-9;

  plot.grid(rung.ticks);
  plot.axisY({ ticks: rung.ticks, format: rung.fmt });

  /* WHAT BOUNDS THIS SCALE, RULED — and the count of rules is the argument.
     Probability has two, at 0 and at 1. Odds has ONE: dividing by (1 − p)
     removes the ceiling and leaves the floor exactly where it was, which is why
     odds is only half the fix and why this panel is here at all. Log-odds has
     none, and its emptiness is the point: that is the only one of the three an
     unbounded straight line can live on. */
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  for (const b of rung.bounds) {
    if (b < rung.lo || b > rung.hi) continue;
    const y = Math.round(plot.sy(b)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.stroke();
  }
  ctx.restore();

  const xt = rect.w < 170 ? A.ticksWide : A.ticks;
  strip.axisX({ ticks: xt, format: (v) => String(v), label: isMiddle ? A.label : undefined });

  /* S3. `step` named what CAUSED the bars, which left what they MEASURE to
     guesswork — reported as exactly that. The row now names the quantity, and
     full height carries its value once, so every other bar can be read off it.
     Each strip is scaled to its own largest because the three quantities have
     no common unit; the scale line is what makes that legible rather than
     arbitrary. */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(rung.delta, stripRect.x - 8, stripRect.y + stripRect.h / 2);
  ctx.restore();

  /* header */
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink1;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.fillText(rung.title, rect.x, NOTE_H + 9);
  const titleW = ctx.measureText(rung.title).width;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  /* THE RANGE OUTRANKS THE EXPRESSION when only one fits: the expression names
     the scale, which the title already did, and the range is the thing the
     three panels are being compared on. */
  const room = rect.w - titleW - 10;
  const head = [`${rung.axis} · ${rung.range}`, rung.range, rung.axis]
    .find((t) => ctx.measureText(t).width < room);
  if (head) ctx.fillText(head, rect.x + rect.w, NOTE_H + 9);
  ctx.restore();

  if (rung.raw) {
    const S = STRIPS[A.key];
    ctx.save();
    ctx.globalAlpha = 0.13;
    for (const [pts, fill] of [[S.no, colors.nonevent], [S.yes, colors.event]]) {
      ctx.fillStyle = fill;
      for (const [sx, sv] of pts) ctx.fillRect(plot.sx(sx) - 0.75, plot.sy(sv) - 0.75, 1.5, 1.5);
    }
    ctx.restore();
  }

  /* the observed proportions, which are what any line has to pass through */
  for (const b of state.bins) {
    const v = rung.of(b.rate);
    if (on(v)) {
      /* The interval is transformed, not the standard error: on the log-odds
         panel a bar of equal length either side of the dot would be wrong at
         both ends, because the transform is not linear. */
      const vlo = rung.of(b.lo), vhi = rung.of(b.hi);
      if (Number.isFinite(vlo) && Number.isFinite(vhi) && b.e > 0 && b.e < b.n) {
        ctx.save();
        ctx.strokeStyle = colors.smoothed;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        const cx = Math.round(plot.sx(b.x)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, plot.sy(Math.max(rung.lo, Math.min(rung.hi, vlo))));
        ctx.lineTo(cx, plot.sy(Math.max(rung.lo, Math.min(rung.hi, vhi))));
        ctx.stroke();
        ctx.restore();
      }
      plot.dot(b.x, v, { fill: colors.smoothed, r: Math.max(2.5, Math.sqrt(b.n) / 7) });
      continue;
    }
    /* off this axis, and wholly inside the plot: an up-caret straddling the top
       edge ran into the panel's own header, which no text check can see. */
    ctx.save();
    ctx.fillStyle = colors.smoothed;
    ctx.globalAlpha = 0.6;
    const cx = plot.sx(b.x);
    const up = Number.isFinite(v) ? v > rung.hi : b.rate > 0.5;
    const base = up ? rect.y + 7 : rect.y + rect.h - 7;
    ctx.beginPath();
    ctx.moveTo(cx, up ? rect.y + 1 : rect.y + rect.h - 1);
    ctx.lineTo(cx - 4, base);
    ctx.lineTo(cx + 4, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* STAGE 1 — THE STRAIGHT LINE. On the probability panel it is drawn whole,
     including the part outside the box, because that part is the point. On the
     other two it stops wherever its prediction has left (0, 1), since such a
     prediction has no odds to draw at all. */
  const olsPts = state.curveO.map(([x, p]) => [x, rung.of(p)]).filter(([, v]) => on(v));
  if (olsPts.length > 1) {
    plot.curve(olsPts, {
      stroke: colors.reference,
      dash: [5, 3],
      opacity: rung.raw ? 1 : 0.5,
    });
  }

  if (params.link) {
    plot.curve(state.curveL.map(([x, p]) => [x, rung.of(p)]).filter(([, v]) => on(v)),
      { stroke: colors.theory });
  }

  /* THE STEP, EVERYWHERE, ON A COMMON FLOOR. Each bar is what one step is worth
     at that x, in this panel's own units. Only log-odds is flat, and that is
     the whole reason the model is fitted on that scale. The ratio, which is the
     constant thing on the odds scale, is a number rather than a shape and lives
     in the readout.

     Risers standing on the curve were tried first and cut: at the narrow frame
     a step is a few pixels wide, so they read as a slightly thicker curve, and
     each starting at a different height is exactly what makes "these are all
     the same" impossible to see. */
  let maxD = 0;
  for (const s of state.steps) {
    const d = Math.abs(rung.of(s.p2) - rung.of(s.p1));
    if (Number.isFinite(d) && d > maxD) maxD = d;
  }
  const barW = Math.max(1.5, stripRect.w / (A.hi - A.lo) - 1.2);
  ctx.save();
  ctx.fillStyle = colors.highlight;
  for (const s of state.steps) {
    const d = Math.abs(rung.of(s.p2) - rung.of(s.p1));
    if (!Number.isFinite(d) || maxD === 0) continue;
    const bh = (d / maxD) * stripRect.h;
    ctx.globalAlpha = Math.floor(state.at) === s.from ? 1 : 0.4;
    ctx.fillRect(strip.sx(s.from + 0.5) - barW / 2, stripRect.y + stripRect.h - bh, barW, bh);
  }
  ctx.restore();

  /* full height, once, with its value — the scale the other bars are read off */
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(stripRect.x, stripRect.y + 0.5);
  ctx.lineTo(stripRect.x + stripRect.w, stripRect.y + 0.5);
  ctx.stroke();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(rung.scale(maxD), stripRect.x + 3, stripRect.y + 2);
  ctx.restore();

  const { cur } = state;
  const v1 = rung.of(cur.p1), v2 = rung.of(cur.p2);
  if (!on(v1) || !on(v2)) return;
  plot.dot(cur.from, v1, { fill: colors.highlight, r: 3 });
  plot.dot(cur.to, v2, { fill: colors.highlight, r: 3 });
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.5;
  ctx.moveTo(plot.sx(cur.from), plot.sy(v1));
  ctx.lineTo(plot.sx(cur.to), plot.sy(v1));
  ctx.lineTo(plot.sx(cur.to), plot.sy(v2));
  ctx.stroke();
  ctx.restore();

  /* bottom-right, and on a plate: the fitted curve rises to the right on all
     three rungs so that corner is clear of it, but the band of zeros runs
     straight through it on the probability panel. */
  const lab = rung.say(v1, v2);
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.surface;
  ctx.strokeText(lab, rect.x + rect.w - 6, rect.y + rect.h - 8);
  ctx.fillStyle = colors.highlight;
  ctx.fillText(lab, rect.x + rect.w - 6, rect.y + rect.h - 8);
  ctx.restore();
}

/* --- the widget ----------------------------------------------------------- */

defineWidget({
  slug: "logistic-regression",
  title: "Logistic Regression",
  subtitle:
    "A 0/1 outcome works fine as a covariate. Put one on the other side of the equation and a "
    + "straight line starts predicting probabilities below 0 and above 1. The link function is "
    + "what fixes that — and fixing it is what turns the coefficient into an odds ratio. "
    + "The model is 05-05's own: TenYearCHD ~ BMI + age, on 3658 people from Framingham.",
  layout: "side",

  height: CANVAS_H,

  params: {
    /* ONE CONTROL, TWO JOBS. It is how the reader sees the second coefficient
       at all, and it is "adjusted for" as a picture: whichever covariate is not
       on the axis is held, and holding it elsewhere shifts the line without
       touching its slope. */
    xvar: {
      type: "segmented",
      label: "On the x axis",
      options: Object.values(AXES).map((a) => ({ value: a.key, label: a.label, detail: a.detail })),
      default: "age",
      display: true,
    },
    /* REVERSIBLE ON PURPOSE, which a drive button cannot be. Flipping the link
       off and on again is how the reader sees that it is the same data read two
       ways rather than a second model — and it frees the drive row for the
       sweep, which is the thing that actually takes time. */
    link: {
      type: "bool",
      label: "Add the link function",
      detail: "fit log(odds) instead of the probability itself",
      default: false,
      display: true,
    },
    held: {
      type: "section",
      label: "The covariate that is NOT on the x axis is held here, and moving it shifts the whole curve.",
    },
    /* BOTH COVARIATES ARE ALWAYS SET, because the model has both. Whichever is
       on the axis is where the step is read; the other is the held value. Two
       roles, two sliders, and no slider that changes its meaning underneath the
       reader. */
    /* BOTH ARE LIVE, because the model has both and the reader is a person with
       one of each. Whichever is on the axis is where the step is read; the
       other is held, and moving it shifts the whole curve. The figure has no
       stages and nothing to press: varying these two IS the exploration, and a
       swept cursor on top of them was a fourth thing to operate. */
    bmi: {
      type: "float", label: "BMI", min: 15, max: 45, step: 0.5, default: 25.5, display: true,
    },
    age: {
      type: "int", label: "Age", min: 32, max: 69, default: 50, display: true,
    },
  },

  legend: [
    { token: "event", label: "Developed CHD (y = 1)", mark: "dot" },
    { token: "nonevent", label: "Did not (y = 0)", mark: "dot" },
    { token: "smoothed", label: "Observed proportion, binned · 95% binomial", mark: "dot" },
    { token: "reference", label: "Straight line (lm)", mark: "line" },
    { token: "theory", label: "With the link (glm)", mark: "line" },
    { token: "highlight", label: "One step", mark: "line" },
  ],

  compute: computeAll,

  draw({ ctx, colors, w, params, state }) {
    renderFramework(params, state.cur);
    caption(ctx, colors, w, state, params);
    const cw = (w - GAP * 2) / 3;
    RUNGS.forEach((rung, i) => {
      panel(ctx, colors, { x: i * (cw + GAP), w: cw }, rung, state, params, i === 1);
    });
  },

  readout: ({ params, state }) => {
    const { A, cur } = state;
    const which = params.link ? "with the link" : "the straight line";
    return [
      {
        label: "Straight line",
        value: state.outside.length ? "leaves 0–1" : "inside 0–1",
        note: state.outside.length
          ? `${state.outside.join(", ")}, ${A.otherLabel} held at ${state.held}`
          : `least squares fits E[Y] — for a 0/1 outcome that IS the probability`,
      },
      {
        label: "With the link",
        value: params.link ? "always 0–1" : "—",
        note: params.link
          ? `50% at ${A.label} ${state.half.toFixed(1)}`
            + (state.half > A.hi || state.half < A.lo ? " — beyond the data" : "")
          : "log(odds) is unbounded, so p never has to leave (0, 1)",
      },
      {
        label: `Risk difference, ${A.stepName}`,
        value: `${cur.p2 - cur.p1 >= 0 ? "+" : "−"}${(Math.abs(cur.p2 - cur.p1) * 100).toFixed(2)} pp`,
        note: `${A.label} ${cur.from} → ${cur.to}, on ${which}`,
      },
      {
        /* THE ODDS RATIO IS THE LINK'S NUMBER AND NOBODY ELSE'S. A straight line
           has no constant one — it has a constant risk DIFFERENCE instead, which
           is the tile above — so quoting exp(b) while the link is off would be
           quoting a coefficient the model on screen does not have. */
        label: `Odds ratio, ${A.stepName}`,
        value: params.link ? state.or.toFixed(4) : "—",
        note: params.link
          ? `exp(${state.slope.toFixed(5)}) — the ${A.coefName} coefficient, and the same everywhere`
          : "a straight line has no constant one; it has a constant risk difference",
      },
    ];
  },
});
