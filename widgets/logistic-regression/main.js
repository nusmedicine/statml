/* ============================================================================
   Widget 15 · Logistic Regression — what goes wrong with a straight line, what
   the link does about it, and why that makes the coefficient an odds ratio.

   Hosts at PHM5003 05-05 and matches its cell 4:
   `log( p(Y) / (1 − p(Y)) ) = b0 + b1 x`, one covariate.

   `prevalentHyp ~ sysBP` is the one pair in the file whose fitted p spans
   the axis (0.0003 to 1.000), so the sigmoid saturates at both ends on
   screen, the straight line makes 794 of 4240 people impossible, and the
   fitted 50% lands at 141.6 mmHg against the clinical 140. The design
   history — including the two-covariate version this replaced on 2026-08-29
   — is catalogue § Widget 15.

   AGGREGATES, NOT ROWS: for a binomial GLM the counts at each distinct x
   are a sufficient statistic — fit from aggregate ≡ fit from rows, verified
   to 1e-8 in `_lab/logistic-1cov-measure.py`. 234 distinct sysBP values.
   ========================================================================= */

import { defineWidget, makePlot, mathmlRenders } from "../core/index.js";

/* Coefficients are fixed rather than fitted in the browser; both fits are on
   the same 4240 rows. OLS is least squares on the 0/1 outcome — the "linear
   probability model", which is what step 1 exists to discredit. */
const LOGIT = { b0: -19.97908154, b1: 0.14110315 };
const OLS = { b0: -1.626123, b1: 0.01463293 };

const HYP_BY_SYSBP = "83.5,2,0;85,1,0;85.5,1,0;90,2,0;92,1,0;92.5,2,0;93,2,0;93.5,2,0;94,3,0;95,7,0;95.5,3,0;96,12,0;96.5,4,0;97,9,0;97.5,4,0;98,14,1;98.5,1,0;99,8,0;99.5,1,0;100,26,0;100.5,6,0;101,21,0;101.5,1,0;102,31,0;102.5,11,0;103,19,0;103.5,2,0;104,21,0;104.5,2,0;105,43,0;105.5,5,0;106,28,0;106.5,2,0;107,38,0;107.5,30,0;108,49,0;108.5,10,0;109,37,1;109.5,7,0;110,96,1;110.5,3,0;111,55,4;111.5,8,0;112,55,0;112.5,44,0;113,52,0;113.5,14,0;114,65,3;114.5,8,0;115,89,1;115.5,8,0;116,71,0;116.5,9,0;117,38,0;117.5,39,2;118,62,1;118.5,19,0;119,68,1;119.5,8,0;120,107,3;120.5,12,1;121,60,3;121.5,16,0;122,80,7;122.5,32,2;123,72,7;123.5,12,0;124,84,4;124.5,10,2;125,88,11;125.5,9,0;126,73,6;126.5,21,2;127,61,7;127.5,50,2;128,73,14;128.5,13,1;129,63,7;129.5,11,2;130,102,11;130.5,8,2;131,62,5;131.5,19,2;132,69,20;132.5,28,4;133,54,12;133.5,13,1;134,58,11;134.5,10,2;135,69,19;135.5,3,1;136,36,12;136.5,25,4;137,44,11;137.5,20,5;138,50,15;138.5,12,5;139,45,17;139.5,3,1;140,53,39;140.5,6,6;141,50,30;141.5,11,9;142,45,21;142.5,18,16;143,26,19;143.5,13,7;144,43,31;144.5,5,2;145,49,34;145.5,8,7;146,40,25;146.5,12,6;147,25,19;147.5,18,13;148,42,32;148.5,5,4;149,23,20;149.5,6,3;150,45,34;150.5,7,5;151,20,19;151.5,8,7;152,21,18;152.5,12,10;153,19,16;153.5,6,5;154,24,22;154.5,4,3;155,37,29;155.5,3,3;156,15,11;156.5,5,3;157,17,14;157.5,5,5;158,28,27;158.5,4,3;159,24,23;159.5,4,4;160,27,25;160.5,6,6;161,10,7;161.5,3,3;162,12,12;162.5,7,7;163,14,13;163.5,5,5;164,17,17;164.5,3,2;165,26,24;166,14,13;166.5,2,2;167,12,12;167.5,8,7;168,11,10;168.5,3,3;169,6,5;169.5,1,0;170,20,19;170.5,1,1;171,9,9;171.5,1,1;172,6,6;172.5,7,7;173,12,11;174,10,10;174.5,2,2;175,12,12;175.5,1,1;176,11,11;176.5,2,2;177,8,8;177.5,6,6;178,5,5;179,6,6;179.5,2,2;180,12,12;180.5,1,1;181,7,7;181.5,1,1;182,9,9;182.5,4,4;183,4,4;184,4,4;184.5,2,2;185,8,8;185.5,2,2;186,2,1;186.5,2,2;187,4,3;187.5,1,1;188,5,5;188.5,1,1;189,6,6;190,9,9;191,4,3;191.5,1,1;192,2,2;192.5,3,3;193,4,4;194,1,1;195,8,8;196,6,6;197,4,4;197.5,2,2;198,3,3;199,3,3;199.5,1,0;200,5,4;201,1,1;202,2,2;202.5,1,1;204,3,3;205,2,2;205.5,1,1;206,4,4;207,1,1;207.5,1,1;208,1,1;209,1,1;210,4,4;212,1,1;213,2,2;214,1,1;215,3,3;217,1,1;220,2,2;230,1,1;232,1,1;235,1,1;243,1,1;244,1,1;248,1,1;295,1,1";

const parse = (s) => s.split(";").map((t) => t.split(",").map(Number));

/* The axis stops at 215 mmHg; the 6 patients above it are in the fit and
   off the display. */
const AXIS = {
  label: "systolic blood pressure (mmHg)",
  rows: parse(HYP_BY_SYSBP), lo: 85, hi: 215, slot: 0.5,
  ticks: [90, 110, 130, 150, 170, 190, 210], ticksWide: [100, 140, 180],
  stepName: "one mmHg", coefName: "sysBP",
};

/* The probability axis runs past 0 and 1 on purpose: an axis stopping at the
   boundary clips away exactly what step 1 exists to show. The line spans
   −0.40 to 1.45 over the visible axis, so both exits are on screen. */
const P_LO = -0.45, P_HI = 1.45;

/* --- the three rungs -------------------------------------------------------
   `of` maps a probability onto the rung. A non-finite or out-of-range result
   is a point the panel cannot draw, and that is the lesson: a prediction
   outside (0, 1) has no odds and no log-odds, so the straight line is absent
   from the other two panels wherever it has left the box — and an all-1 bin
   has no log-odds either, so it wears a caret at the panel edge. */
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
    lo: -0.6, hi: 12,
    ticks: [0, 4, 8, 12], fmt: (v) => v.toFixed(0), raw: false,
    of: (p) => p / (1 - p),
    say: (a, b) => `+${(b - a).toFixed(3)}`,
    delta: "Δ odds", scale: (v) => v.toFixed(3),
  },
  {
    key: "logit", title: "log-odds", axis: "log( p / (1 − p) )", range: "−∞ to +∞", bounds: [],
    lo: -8.2, hi: 10.5,
    ticks: [-8, -4, 0, 4, 8], fmt: (v) => v.toFixed(0), raw: false,
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

const P_OLS = (x) => OLS.b0 + OLS.b1 * x;
const P_LOGIT = (x) => 1 / (1 + Math.exp(-(LOGIT.b0 + LOGIT.b1 * x)));
/* The eased fit: t = 0 is the identity link, t = 1 the logit, and every
   drawn curve, step bar and printed number comes from the SAME blended
   p — no label is false mid-frame. */
const pMix = (t) => (x) => (1 - t) * P_OLS(x) + t * P_LOGIT(x);

function stepsFor(p) {
  const out = [];
  for (let x = Math.ceil(AXIS.lo); x + 1 <= AXIS.hi + 1e-9; x += 1) {
    out.push({ from: x, to: x + 1, p1: p(x), p2: p(x + 1) });
  }
  return out;
}
const curFor = (p, at) => ({ from: at, to: at + 1, p1: p(at), p2: p(at + 1) });

/* --- compute --------------------------------------------------------------
   Pure and parameter-only; nothing here is random, so `rng` is unused. */
function computeAll({ params }) {
  const A = AXIS;
  const pLogit = P_LOGIT;
  const pOls = P_OLS;

  /* Bins of five mmHg, anchored on multiples of the width — 130-134,
     135-139 — the way a person bins. */
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
        /* The binomial family is what says how far a dot should sit from the
           curve: the link picks the scale the mean is linear on, the family
           how each observation scatters around it. */
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

  /* Where the straight line leaves the box, as a property of the line. */
  const zeroAt = (0 - OLS.b0) / OLS.b1;
  const oneAt = (1 - OLS.b0) / OLS.b1;
  const outside = [];
  if (zeroAt > A.lo && zeroAt < A.hi) outside.push(`below ${zeroAt.toFixed(0)}`);
  if (oneAt > A.lo && oneAt < A.hi) outside.push(`above ${oneAt.toFixed(0)} mmHg`);

  return {
    A, bins, curveL, curveO, n, events, outside,
    at: Math.min(params.at, A.hi - 1),
    half: -LOGIT.b0 / LOGIT.b1,
    slope: LOGIT.b1,
    or: Math.exp(LOGIT.b1),
  };
}

/* --- the raw outcomes, laid out once -----------------------------------------
   Not jittered — spread deterministically, which is what stops the cloud
   shimmering every time a parameter moves: x is even inside the value's own
   slot; y walks a golden-ratio sequence across a thin band. The bands are
   centred on 0 and 1, not tucked inside them — the axis runs past both, so
   the two bounds can be ruled through the data. */
const STRIP_PTS = (() => {
  const yes = [], no = [];
  for (const [x, n, e] of AXIS.rows) {
    if (x < AXIS.lo || x > AXIS.hi) continue;
    for (let j = 0; j < n; j += 1) {
      const ev = j < e;
      (ev ? yes : no).push([
        x + AXIS.slot * 0.9 * ((j + 0.5) / n - 0.5),
        (ev ? 1 : 0) + 0.09 * (((j * 0.6180339887) % 1) - 0.5),
      ]);
    }
  }
  return { yes, no };
})();

/* --- the framework row, in the DOM -----------------------------------------
   MOUNTED LAZILY FROM INSIDE draw(). `buildShell` creates `.w-figure` inside
   `defineWidget`, so this module's scope runs before it exists; querying there
   returns null and the reader gets a blank page rather than a missing row. */

const MATHML = mathmlRenders();

/* The equation is 05-05's cell 4 with this widget's fitted numbers in it.
   ONE <math> PER TERM: a single <math> does not line-break (MathML Core
   treats white-space as nowrap and no engine implements linebreaking), so a
   multi-term equation in one <math> overflows rather than wraps; separate
   inline elements break at the seams authored here. Every sign carries
   form="infix" because, first in its own <math>, a leading + would otherwise
   be set as a prefix operator — unary and unspaced. */
const mi = (t) => `<mi mathvariant="normal">${t}</mi>`;
const sub = (v, s) => `<msub><mn>${v}</mn>${mi(s)}</msub>`;
const LHS_LOGIT = `<math><mrow>${mi("log")}<mo>(</mo><mfrac>`
  + "<mrow><mi>p</mi><mo>(</mo><mi>Y</mi><mo>)</mo></mrow>"
  + "<mrow><mn>1</mn><mo>−</mo><mi>p</mi><mo>(</mo><mi>Y</mi><mo>)</mo></mrow>"
  + "</mfrac><mo>)</mo><mo>=</mo></mrow></math>";
const LHS_ID = "<math><mrow><mi>p</mi><mo>(</mo><mi>Y</mi><mo>)</mo><mo>=</mo></mrow></math>";
/* The equation follows the chosen link: each shows ITS OWN fitted numbers,
   because the two links fit different coefficients and printing the logit's
   beside an identity fit would be a claim the figure does not make. */
const EQ = {
  logit: {
    html: `${LHS_LOGIT} <math><mrow><mo form="infix">−</mo>${sub("19.98", "intercept")}</mrow></math> `
      + `<math><mrow><mo form="infix">+</mo>${mi("sysBP")}<mo>×</mo>${sub("0.141", "sysBP")}</mrow></math>`,
    plain: "log( p(Y) / (1 − p(Y)) ) = −19.98 + sysBP × 0.141",
  },
  identity: {
    html: `${LHS_ID} <math><mrow><mo form="infix">−</mo>${sub("1.63", "intercept")}</mrow></math> `
      + `<math><mrow><mo form="infix">+</mo>${mi("sysBP")}<mo>×</mo>${sub("0.0146", "sysBP")}</mrow></math>`,
    plain: "p(Y) = −1.63 + sysBP × 0.0146",
  },
};

/* The link, drawn, oriented the way the figure below is: p runs up the side
   (the convention puts it across, but a 90-degree disagreement inside one
   figure costs more than departing from a convention in a 132px inset). The
   reader's own two probabilities are marked on it. */
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

let cardHost = null;
let eqKey = null;

function renderFramework(cur, link) {
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
      + "</svg></div>";
    figure.parentNode.insertBefore(cardHost, figure);
  }

  /* Memoised on the link: draw() runs per frame and rebuilding the <math>
     elements costs ~0.7ms against the 0.004ms of a fillText line. */
  if (eqKey !== link) {
    eqKey = link;
    const eq = cardHost.querySelector(".w-link-eq");
    if (MATHML) eq.innerHTML = EQ[link].html;
    else eq.textContent = EQ[link].plain;
  }

  /* The two dots move on every frame, so they are MOVED rather than rebuilt:
     two attribute writes against re-parsing the whole figure. */
  for (const [sel, p] of [[".fig-a", cur?.p1], [".fig-b", cur?.p2]]) {
    const dot = cardHost.querySelector(sel);
    if (p == null || !(p > 0) || !(p < 1)) { dot.style.display = "none"; continue; }
    dot.style.display = "";
    dot.setAttribute("cx", figX(Math.log(p / (1 - p))).toFixed(1));
    dot.setAttribute("cy", figY(p).toFixed(1));
  }
}

/* --- draw ----------------------------------------------------------------- */

/* THE CAPTION NARRATES, and its first job is to say what is on screen — "what
   is the dataset?" was a fair question once, and stays answered. */
function caption(ctx, colors, w, state, t) {
  /* Keyed on the EASED side, not the target, so the sentence flips as the
     curve passes halfway rather than announcing a destination. */
  const logit = t >= 0.5;
  const warn = !logit && state.outside.length;
  /* The two bounds come off one at a time — the answer to "why log it";
     and least squares on a 0/1 outcome fits E[Y|X], which for a binary Y IS
     the probability, so a fitted value outside 0 and 1 is a defect, not a
     curiosity. */
  const say = logit
      ? [`Odds removes the ceiling at 1; the log removes the floor at 0. Only then is the scale unbounded both ways.`,
        `Odds removes the ceiling; the log removes the floor.`]
      : [`Least squares on a 0/1 outcome fits the probability itself — and here it leaves 0 and 1 ${state.outside.join(" and ")}.`,
        `Predictions ${state.outside.join(" and ")}.`];
  const first = [
    `Framingham · ${state.n} people · do they have high blood pressure? A single 0 or 1 has no odds — the link transforms the PROPORTION`,
    `Framingham · ${state.n} people · the link transforms the proportion, not the 0 or the 1`,
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

function panel(ctx, colors, box, rung, state, t, blend, isMiddle) {
  const { A } = state;
  const rect = { x: box.x + PAD_L, y: NOTE_H + PAD_T, w: box.w - PAD_L - PAD_R, h: MAIN_H };
  const stripRect = { x: rect.x, y: rect.y + MAIN_H + STRIP_GAP, w: rect.w, h: STRIP_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [A.lo, A.hi], yDomain: [rung.lo, rung.hi] });
  const strip = makePlot({ ctx, colors, rect: stripRect, xDomain: [A.lo, A.hi], yDomain: [0, 1] });
  const on = (v) => Number.isFinite(v) && v >= rung.lo - 1e-9 && v <= rung.hi + 1e-9;

  plot.grid(rung.ticks);
  plot.axisY({ ticks: rung.ticks, format: rung.fmt });

  /* What bounds this scale, ruled — and the count of rules is the argument:
     probability has two, odds has one (dividing by 1 − p removes only the
     ceiling), log-odds has none — the only scale of the three an unbounded
     straight line can live on. */
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

  /* The row names the quantity, and full height carries its value once, so
     every other bar can be read off it. Each strip is scaled to its own
     largest because the three quantities have no common unit. */
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
  /* When only one fits, the range outranks the expression: the range is what
     the three panels are compared on. */
  const room = rect.w - titleW - 10;
  const head = [`${rung.axis} · ${rung.range}`, rung.range, rung.axis]
    .find((t) => ctx.measureText(t).width < room);
  if (head) ctx.fillText(head, rect.x + rect.w, NOTE_H + 9);
  ctx.restore();

  if (rung.raw) {
    ctx.save();
    ctx.globalAlpha = 0.13;
    for (const [pts, fill] of [[STRIP_PTS.no, colors.nonevent], [STRIP_PTS.yes, colors.event]]) {
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
    /* off this axis, and wholly inside the plot: an up-caret straddling the
       top edge once ran into the panel's own header, which no text check can
       see. The all-1 bins above 170 mmHg wear these on odds and log-odds. */
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

  /* The straight line: drawn whole on the probability panel, outside parts
     included, because those parts are the point; on the other two it stops
     wherever its prediction has left (0, 1). */
  const olsPts = state.curveO.map(([x, p]) => [x, rung.of(p)]).filter(([, v]) => on(v));
  if (olsPts.length > 1) {
    plot.curve(olsPts, {
      stroke: colors.reference,
      dash: [5, 3],
      opacity: rung.raw ? 1 : 0.5,
    });
  }

  /* The eased fit: at t = 0 it lies exactly on the straight line and is not
     drawn twice; between, it is the one curve bending from the identity fit
     into the sigmoid — the same data read two ways, watched changing hands. */
  if (t > 0.001) {
    const curveM = state.curveO.map(([x, po], i) =>
      [x, rung.of((1 - t) * po + t * state.curveL[i][1])]);
    plot.curve(curveM.filter(([, v]) => on(v)), { stroke: colors.theory });
  }

  /* Each bar is what one mmHg is worth at that pressure, in this panel's own
     units. Only log-odds is flat, and that is the whole reason the model is
     fitted on that scale. */
  /* Only steps whose values are ON this panel: the odds curve reaches ~20 000
     at the right edge, and one runaway Δ there flattened every visible bar
     into the floor with a scale line nobody could use. */
  const visible = (s) => on(rung.of(s.p1)) && on(rung.of(s.p2));
  let maxD = 0;
  for (const s of blend.steps) {
    if (!visible(s)) continue;
    const d = Math.abs(rung.of(s.p2) - rung.of(s.p1));
    if (Number.isFinite(d) && d > maxD) maxD = d;
  }
  const barW = Math.max(1, stripRect.w / (A.hi - A.lo) - 0.4);
  ctx.save();
  ctx.fillStyle = colors.highlight;
  for (const s of blend.steps) {
    if (!visible(s)) continue;
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

  const { cur } = blend;
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
    "We can use a linear model to predict a categorical outcome, but fitted "
    + "directly it predicts probabilities below 0 and above 1. Modelling the "
    + "log(odds) instead keeps predictions in range, and the coefficient "
    + "becomes an odds ratio.",
  layout: "side",

  height: CANVAS_H,

  params: {
    /* A GLM is a choice of link, and the control says so: identity is the
       straight line (lm), logit is logistic regression. Toggling between
       them eases the fitted curve from one to the other — the same data
       read two ways, not a second model. */
    link: {
      type: "segmented",
      label: "Link function",
      options: [
        { value: "identity", label: "Identity", detail: "fit the probability itself — a straight line (lm)" },
        { value: "logit", label: "Logit", detail: "fit the log(odds) — logistic regression (glm)" },
      ],
      default: "identity",
      display: true,
    },
    at: {
      type: "int",
      label: "Read one step at",
      detail: "where the one-mmHg step is read",
      min: 85, max: 214, default: 140,
      display: true,
    },
  },

  legend: [
    { token: "event", label: "Hypertensive (y = 1)", mark: "dot" },
    { token: "nonevent", label: "Not hypertensive (y = 0)", mark: "dot" },
    { token: "smoothed", label: "Observed proportion, binned · 95% binomial", mark: "dot" },
    { token: "reference", label: "Straight line (lm)", mark: "line" },
    { token: "theory", label: "With the link (glm)", mark: "line" },
    { token: "highlight", label: "One step", mark: "line" },
  ],

  compute: computeAll,

  /* No Step and no Play — the one motion is the ease between the two links,
     on core's ease-request door: toggling the segmented control bends the
     fitted curve from one reading into the other. */
  animation: {
    stepLabel: null,
    runLabel: null,
    init: ({ params }) => {
      const t = params.link === "logit" ? 1 : 0;
      return { t, target: t };
    },
    advance: (anim, { dt }) => {
      const dir = Math.sign(anim.target - anim.t);
      if (dir === 0) return false;
      anim.t = Math.max(0, Math.min(1, anim.t + (dir * dt) / 600));
      if ((dir > 0 && anim.t >= anim.target) || (dir < 0 && anim.t <= anim.target)) {
        anim.t = anim.target;
        return false;
      }
      return true;
    },
    rebuild: (anim, { params }) => {
      const target = params.link === "logit" ? 1 : 0;
      if (target !== anim.target) {
        anim.target = target;
        anim.easing = true;
      }
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const t = anim?.t ?? (params.link === "logit" ? 1 : 0);
    const p = pMix(t);
    const blend = { steps: stepsFor(p), cur: curFor(p, state.at) };
    renderFramework(blend.cur, params.link);
    caption(ctx, colors, w, state, t);
    const cw = (w - GAP * 2) / 3;
    RUNGS.forEach((rung, i) => {
      panel(ctx, colors, { x: i * (cw + GAP), w: cw }, rung, state, t, blend, i === 1);
    });
  },

  readout: ({ params, state, anim }) => {
    const t = anim?.t ?? (params.link === "logit" ? 1 : 0);
    const cur = curFor(pMix(t), state.at);
    const logit = t >= 0.5;
    return [
      {
        label: "Identity link",
        value: "leaves 0–1",
        note: `${state.outside.join(", ")} — 794 of ${state.n} people made impossible`,
      },
      {
        label: "Logit link",
        value: t >= 1 ? "always 0–1" : "—",
        note: t >= 1
          ? `50% at ${state.half.toFixed(1)} mmHg — the clinical threshold is 140`
          : "log(odds) is unbounded, so p never has to leave (0, 1)",
      },
      {
        label: "Risk difference, one mmHg",
        value: `${cur.p2 - cur.p1 >= 0 ? "+" : "−"}${(Math.abs(cur.p2 - cur.p1) * 100).toFixed(2)} pp`,
        note: `sysBP ${cur.from} → ${cur.to}, ${logit ? "logit" : "identity"} link`,
      },
      {
        /* The odds ratio is the logit link's number and nobody else's: a
           straight line has no constant one — it has a constant risk
           difference instead — so exp(b) prints only once the eased fit has
           landed on the logit. */
        label: "Odds ratio, one mmHg",
        value: t >= 1 ? state.or.toFixed(4) : "—",
        note: t >= 1
          ? `exp(${state.slope.toFixed(5)}) — the sysBP coefficient, and the same everywhere`
          : "a straight line has no constant one; it has a constant risk difference",
      },
    ];
  },
});
