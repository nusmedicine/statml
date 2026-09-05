/* ============================================================================
   Widget 38 · Explaining a Prediction. PHM5005 04-5 Model Explanation. DRAFT.

   TWO PAGES, ONE MACHINE. Page 1 "the game" has no patients, no model and no
   features: three players and a payout, exactly as `04-5` introduces the
   Shapley value. The players are Kenneth's own notebook figure — coloured
   circles in a dashed enclosure — and the thing his two figures cannot show is
   the part that moves. Page 2 "the model" runs the identical figure on the
   heart-failure data, with three features as the players and one held-out
   patient's prediction as the payout. Everything below the page switch is
   shared: same walk, same path diagram, same six rows, same bars. Only where
   the game COMES FROM changes, which is the whole claim.

   THE MISCONCEPTION: that a feature's contribution is a single well-defined
   number, so averaging over orderings is bookkeeping. It is not — a player's
   marginal contribution depends on who is already inside, and the notebook's
   own worked example (a linear model read on its own margin) is the one case
   where every ordering agrees, so the formula can be printed and never needed.
   The grid's LEFT COLUMN is that case; every other column is not.

   TWO HALVES, ONE FIGURE (2.7). Left: the coalition filling up, one player at
   a time. Right: the path diagram DRAWN BY THE WALKING — each arrival adds one
   node and one edge, so the reader builds the lattice rather than being shown
   one. Six walks, six routes, and the score is a column average.

   PAGE 2 IS THE FOREST 04-5 DECLARES AND NEVER FITS. Cell 6 builds a 300-tree
   `RandomForestClassifier` and then calls `lr.fit` and only `lr.fit`, so the
   notebook demonstrates SHAP on a logistic regression — the one model its own
   §1 calls inherently explainable. Fit that forest and the machinery finally
   has something to do: the six orders disagree by a median of 17 percentage
   points and by 43 at worst, against Shapley values in the low tens.

   ONE MODEL SHIPS (Kenneth, 2026-09-01). The logistic regression is measured in
   `_lab/shap-page2-ref.py` and deliberately not shipped: on the notebook's own
   scale the six orders agree EXACTLY for all 60 patients, and page 1 already
   lets a reader reach that case by hand — set the three pair sliders to zero
   and every walk gives the same answer. That IS a linear model. A second engine
   here would be a second demonstration of a lesson page 1 already owns.

   THE GAME IS THE GROUND TRUTH AND THE READER SETS IT, which is what page 2
   takes away. Any three-player game is what each player brings ALONE plus what
   each PAIR creates on top (the Harsanyi dividends), and the Shapley value in
   those terms is one line — every dividend split equally among whoever made it:

       phi_i = solo_i + (1/2) * sum of the pair dividends i belongs to

   FOUR SLIDERS SET THE GAME AND NOTHING ELSE DOES. Two earlier drafts made the
   nine kinds a CHOOSER — first a row of named buttons, then a 3x3 matrix — and
   both read as a summary of the game you were already in, which is why nine
   rows showing while one was set looked wrong rather than informative. The nine
   are a `readback` now: they name what the sliders produced and set nothing.

   The one control that is not a dividend is WHICH PAIR works together, and it
   is three different lessons rather than three repetitions:
     A&C   the pair's dividend is shared by A and C
     B&C   the same game with B in A's place — C's score does not move at all
     A&B   C is in no pair, so its share is zero whatever the pair is worth
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";
import { DATA } from "./model.js";

/* Everything draw() touches lives ABOVE defineWidget: core paints during the
   defineWidget call itself, and a binding below it is still in its temporal
   dead zone on the first frame — the trap that has struck three widgets. */

/* THE THREE PLAYERS ARE THE SAME THREE CIRCLES ON BOTH PAGES, in the same three
   colours, so A/B/C and Age/EF/Cr are visibly the same slots — which is the
   bridge the two pages are for. Only what is written inside them changes. */
const L = ["A", "B", "C"];
const CODES = DATA.short;                       // ["Age", "EF", "Cr"]
/** `+30` / `-30` / `+8.9`, in the decimals the page is working to. */
const signed = (v, dp) => `${v >= 0 ? "+" : ""}${fmt(v, dp)}`;
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const SUBSETS = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
const key = (S) => (S.length ? S.slice().sort().join("") : "-");

/* THE GRID OWNS TWO OF THE SIX DIVIDENDS — C's solo and the chosen pair's — and
   the sliders own two more, A's solo and B's. No quantity has two controls, so
   the two halves of the rail compose instead of fighting: moving A's slider
   changes A's score and leaves the grid alone, because phi_C does not depend on
   it. That is "a dividend you are not in is not yours", as a thing to do rather
   than a thing to read.

   The last two dividends — the pairs C is NOT in — are deliberately not exposed.
   They would slide the whole grid by half themselves without bending it, which
   is a real demonstration of additivity and a second thing for the shade to
   mean; the lab page carries it (`_lab/shap-explainer.html`) and the widget
   does not, because a chooser whose numbers move for a reason off-screen is
   what made the digits confusing in the first place. */
/* SIX DIVIDENDS, SIX SLIDERS, and between them they ARE the game — Kenneth,
   2026-08-31: "we should have the paired sliders individually, as the segmented
   design doesn't let me see the whole picture."

   THE NINE-KIND TABLE WENT WITH THE SEGMENTED CONTROL, and not because it was
   cramped. Its two axes were "what C brings alone" against "what share C takes
   from THE pair" — which only reads while exactly one pair is live. With all
   three pair dividends on their own sliders a game can be two things at once
   (A&B complementary while A&C duplicate), so it has no single kind and the
   table had nothing true to say. Naming kinds needed the toggle; seeing the
   whole game needed the sliders; they were never both available.

   What replaces it is a DECOMPOSITION, on the stage rather than the rail: for
   each player, what it brought alone, what it took as its share of the pairs it
   belongs to, and the score those add up to. That is the one-line rule made
   visible — every dividend split equally among whoever made it — and unlike a
   kind it is well defined for any setting of the six. */
const PAIR_FIELDS = [
  { name: "pairAB", key: "01", label: "A & B together", members: [0, 1] },
  { name: "pairAC", key: "02", label: "A & C together", members: [0, 2] },
  { name: "pairBC", key: "12", label: "B & C together", members: [1, 2] },
];

/* --- the game, and its scores -------------------------------------------- */

function gameOf(params) {
  const pair = {};
  for (const P of PAIR_FIELDS) pair[P.key] = params[P.name];
  return { solo: [params.soloA, params.soloB, params.soloC], pair };
}
/* WHERE EACH SCORE CAME FROM. A player keeps its own dividend whole and takes
   half of every pair dividend it belongs to, so these two columns must sum to
   the Shapley value — and `compute` asserts exactly that against the slow
   subset enumeration, since two routes to one number is how the halves of a
   figure come to disagree. */
function splitOf(solo, pair) {
  return [0, 1, 2].map((i) => {
    const share = PAIR_FIELDS
      .filter((P) => P.members.includes(i))
      .reduce((a, P) => a + pair[P.key] / 2, 0);
    return { alone: solo[i], share, total: solo[i] + share };
  });
}
function vTable(solo, pair) {
  const out = {};
  for (const S of SUBSETS) {
    let s = 0;
    for (const i of S) s += solo[i];
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++)
      if (S.includes(a) && S.includes(b)) s += pair["" + a + b];
    out[key(S)] = s;
  }
  return out;
}
/* THE DEFINITION, enumerated over subsets — the readout must be the notebook's
   own formula and not the one-line dividend shortcut, or the widget would be
   checking its own arithmetic against itself. The shortcut is asserted equal in
   `_lab/shap-explainer.html`; here the slow form is the source of truth. */
function shapley(V) {
  const phi = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const rest = [0, 1, 2].filter((k) => k !== i);
    const sets = [[], [rest[0]], [rest[1]], rest], w = [1 / 3, 1 / 6, 1 / 6, 1 / 3];
    sets.forEach((S, q) => { phi[i] += w[q] * (V[key(S.concat([i]))] - V[key(S)]); });
  }
  /* the weights are thirds and sixths, so a score that should be 50 arrives as
     49.999999999999993 and any "is the fraction near zero" test then reads its
     fraction as 0.99999. Every score here is a multiple of 2.5. */
  return phi.map((v) => Math.round(v * 1e6) / 1e6);
}
function rowOf(V, perm) {
  let cur = V["-"]; const S = []; const d = [0, 0, 0];
  for (const i of perm) { S.push(i); const n = V[key(S)]; d[i] = n - cur; cur = n; }
  return d;
}

/* --- the GLOBAL explanation ------------------------------------------------ *
 * IT LIVES HERE, ABOVE THE GEOMETRY, and that is load bearing rather than
 * tidy: `G_ORDER` ranks the swarm's rows from `GLOBAL.runMean` at module-eval
 * time, so a `const GLOBAL` declared further down is still in its temporal dead
 * zone when that line runs — the exact trap the file header names, hit for
 * real. `gameFromModel` below is a FUNCTION DECLARATION and hoists, which is
 * why calling it from here works; turning it into a `const` arrow would break
 * this file at load.                                                          *
 * `shap.plots.beeswarm` and `shap.plots.bar` are the library's two global
 * pictures, and both are just every patient's individual explanation stacked
 * up. So this is computed once at load from the same pinned v(S) — 60 games of
 * eight coalitions is nothing — and the widget never has to choose between
 * showing one patient and showing the model: it shows the one INSIDE the other,
 * on one axis, which is the only way the two can be compared.
 *
 * `mean` is mean |phi| per feature, which IS the number `shap.plots.bar` ranks
 * features by. `lo`/`hi` are the extremes over all 180 values, and they fix the
 * swarm's axis so that sweeping the patient slider moves the dots against a
 * scale that does not move with them.                                        */
const GLOBAL = (() => {
  const phis = DATA.patients.map((_, i) => shapley(gameFromModel(i + 1)));
  const flat = phis.flat();

  /* MEAN |CONTRIBUTION| AFTER n PATIENTS, for n = 0..60. The global page is the
     pile being built, so the number beside each row has to be the mean SO FAR —
     and a running mean recomputed every frame would be per-frame work painting
     the same 183 numbers over and over. Computed once, revealed by the
     animation, which is the contract every widget here keeps. */
  const runMean = [[0, 0, 0]];
  for (let q = 1; q <= phis.length; q++) {
    runMean.push([0, 1, 2].map((i) =>
      (runMean[q - 1][i] * (q - 1) + Math.abs(phis[q - 1][i])) / q));
  }

  /* WHERE EACH PATIENT'S VALUE FALLS IN ITS OWN FEATURE'S RANGE, 0..1, clipped
     at the 5th and 95th percentiles — which is what the SHAP library does, for
     the reason it does it: one creatinine of 9.4 against a median of 1.1 would
     otherwise put every other patient inside the same tenth of the ramp and the
     colour would carry nothing. Clipping costs the extremes their distinction
     and buys everyone else theirs. */
  const norm = DATA.patients.map(() => [0, 0, 0]);
  for (let j = 0; j < 3; j++) {
    const col = DATA.patients.map((pt) => pt.raw[j]).sort((a, b) => a - b);
    const lo5 = col[Math.floor(0.05 * (col.length - 1))];
    const hi95 = col[Math.ceil(0.95 * (col.length - 1))];
    const span = hi95 - lo5 || 1;
    DATA.patients.forEach((pt, k) => {
      norm[k][j] = Math.max(0, Math.min(1, (pt.raw[j] - lo5) / span));
    });
  }

  return { phis, runMean, norm, lo: Math.min(...flat), hi: Math.max(...flat) };
})();

/* Local on purpose: `lm-least-squares` has the same five lines for its cost
   surface, and two copies is not yet a reason to put a colour helper in core —
   the third one would be. Extracting it now would also mean a full fingerprint
   run to prove a five-line pure function changed nothing. */
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/* --- geometry, shared by draw() and nothing else -------------------------- */

/* FOUR UNITS PER WALK, NOT THREE: three arrivals and then a CLEAR-OUT, in which
   the players ease back to the queue and the finished route fades into the pile
   behind it. Without that beat a walk ended at the far right and the next one
   began, one frame later, with an empty ring and a route restarting at the
   origin — which reads as a jump cut rather than a new attempt (Kenneth,
   2026-08-31). The sixth walk has no clear-out, so the figure ends full. */
const UNITS_PER_WALK = 4;
const TOTAL_STEPS = 6 * UNITS_PER_WALK - 1;   // 23
const MS_PER_STEP = 780;
const HOLD = 0.72;                 // the tween lands at 72% and holds — so the
                                   // completed coalition is a frame the reader
                                   // sees rather than one the next arrival eats

const R = 20, CX = 92, CY = 118, PAD = 12;
const TRI = 26, STACK = 25;
const QY = 226, QX = 36, QGAP = 58;
/* the two lower blocks share one baseline so they read as one band, and it
   clears the path plot's own x-axis labels at PY1 + 28 */
const TABLE_Y = 344, TABLE_ROW = 17;
const SPLIT_Y = 348;

/* THE TWO LOWER BLOCKS SIT SIDE BY SIDE ONLY WHILE THERE IS ROOM FOR BOTH.
   Candidate 3 (Kenneth's pick) gives the walks table the left half and the score
   bars the right, which trebles the bars' travel — at 770px. At 550, the width
   every fingerprint state is hashed at, the same rule leaves the bars 13px of
   half-span on page 1 and 4px on page 2, with page 2's sublabel 42px off the
   right edge. A figure that is correct at one width and collapsed at another is
   not a layout, so below 700 the blocks stack instead and the canvas grows by
   the height that costs. The wide reading is untouched. */
const STACK_W = 700;
const STACK_Y = TABLE_Y + 6 * TABLE_ROW + 12 + 46;   // clear of the average row

/* --- the global page has a stage of its own ------------------------------- *
 * It was a fourth block under the individual page for one round and Kenneth cut
 * it: "it's confusing when both are presented together." He was right, and the
 * reason is that the two pictures answer different questions and were competing
 * for one axis — the bars rescale to whoever is selected, the swarm cannot. One
 * page each, and the global one BUILDS: a global explanation is nothing but the
 * pile of individual ones, so the honest way to show it is to add them.        */
const GSTEPS = DATA.patients.length;             // one step, one patient
const G_MS = 150;
const G_CAP = 26, G_LIVE = 46, G_TICK = 86;
const G_ROW0 = 136, G_ROW = 100, G_BAND = 34, G_DOT = 3.4;
const G_HEIGHT = G_ROW0 + 2 * G_ROW + G_BAND + 46;

/* ONE READING OF THE TWO TABS, used by every branch below so they cannot drift.
   The model page has two sub-views and the game page has none, so "is this the
   pile?" is a question about both parameters and never about one. */
const isPile = (v) => v.page === "model" && v.view === "all";

const canvasHeight = (v) =>
  (isPile(v) ? G_HEIGHT : (v.w && v.w < STACK_W ? STACK_Y + 116 : 530));

/* ROWS RANKED BY THE FINISHED PILE, which is how `shap.plots.beeswarm` orders
   its own, and fixed for the whole build so a dot never changes row under the
   reader. The number beside each row is the mean SO FAR, so early in the build
   the ranking and the numbers can disagree — that is the ranking settling, and
   it is worth watching rather than worth hiding. */
const G_ORDER = [0, 1, 2].sort((a, b) => GLOBAL.runMean[GSTEPS][b] - GLOBAL.runMean[GSTEPS][a]);

/* --- the global page ------------------------------------------------------ *
 * Sixty individual explanations, added one at a time. Nothing here is a new
 * quantity: every dot is a number the other page would print as a bar for that
 * patient, and the mean beside each row is those dots with their signs thrown
 * away. What the page adds is that you can watch the pile become an answer.
 *
 * COLOUR MEANS VALUE HERE AND NOTHING ELSE. The other page paints Age blue, EF
 * amber and Cr red because there the question is WHICH feature; here the row
 * already says which, and the open question is which DIRECTION — so the dots
 * take --c-value-low/high and the row labels go to ink. Two colour meanings in
 * one panel is how a figure stops being readable.                             */
function drawGlobal(ctx, colors, w, anim) {
  const shown = Math.min(GSTEPS, Math.floor(anim ? anim.k : 0));
  const glo = Math.min(0, GLOBAL.lo), ghi = Math.max(0, GLOBAL.hi);
  const MEAN_W = 76;
  const L0 = 76, L1 = w - 24 - MEAN_W;
  const sx = (v) => L0 + ((v - glo) / (ghi - glo)) * (L1 - L0);
  const lastRow = G_ROW0 + 2 * G_ROW;
  const hue = (k, j) => hexLerp(colors.valueLow, colors.valueHigh, GLOBAL.norm[k][j]);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `11px ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText(`trained on ${DATA.nTrain} patients · inspected here on all ${GSTEPS} held out, one at a time`, 24, G_CAP);

  /* WHO JUST ARRIVED, with the values coloured the way that patient's dots are
     — which is the whole key to the ramp, done by example rather than by
     legend. */
  if (shown === 0) {
    ctx.font = `12px ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    ctx.fillText("nobody added yet", 24, G_LIVE);
  } else {
    const k = shown - 1, pt = DATA.patients[k];
    ctx.font = `12px ${colors.font}`;
    ctx.fillStyle = colors.ink1;
    const head = `patient ${shown} of ${GSTEPS}`;
    ctx.fillText(head, 24, G_LIVE);
    let x = 24 + ctx.measureText(head).width + 18;
    ctx.font = `11px ${colors.font}`;
    for (let j = 0; j < 3; j++) {
      const t = `${DATA.short[j]} ${fmt(pt.raw[j], j === 2 ? 1 : 0)} ${DATA.units[j]}`;
      ctx.fillStyle = hue(k, j);
      ctx.fillText(t, x, G_LIVE);
      x += ctx.measureText(t).width + 16;
    }
  }

  /* the one axis every dot on the page is read against */
  ctx.font = `10px ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("each dot is one patient's contribution", (L0 + L1) / 2, G_TICK - 22);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  /* counted in integer multiples of the step, never accumulated: 0.2 added five
     times is not 0, and a tick that misses `=== 0` by 5e-17 draws the zero rule
     dashed and labels it "+0.0" */
  const STEP = 0.2;
  for (let m = Math.ceil(glo / STEP); m * STEP <= ghi; m++) {
    const t = m * STEP;
    const tx = Math.round(sx(t)) + 0.5;
    ctx.save();
    if (m !== 0) ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, G_TICK + 9);
    ctx.lineTo(tx, lastRow + G_BAND + 8);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = colors.ink3;
    ctx.fillText(m === 0 ? "0" : signed(t, 1), tx, G_TICK);
  }
  ctx.textAlign = "right";
  ctx.fillText("mean size", w - 24, G_TICK);
  ctx.textAlign = "left";

  G_ORDER.forEach((i, row) => {
    const y = G_ROW0 + row * G_ROW;
    ctx.fillStyle = colors.ink1;
    ctx.font = `600 13px ${colors.font}`;
    ctx.textAlign = "right";
    ctx.fillText(DATA.short[i], 62, y);

    /* LANES OVER ALL SIXTY, drawn for the first `shown` — so the swarm's shape
       is settled from the first dot and nothing rearranges under a reader who
       is watching one patient land. Deterministic, because `rng` belongs to
       compute and a swarm that resettled per frame would be a different figure
       every repaint. */
    const vals = GLOBAL.phis.map((q) => q[i]);
    const seq = vals.map((_, k) => k).sort((a, b) => vals[a] - vals[b]);
    const used = new Map(), off = new Array(vals.length).fill(0);
    for (const k of seq) {
      const b = Math.round(sx(vals[k]) / 7);
      const c = used.get(b) ?? 0;
      used.set(b, c + 1);
      const lane = c === 0 ? 0 : (c % 2 ? 1 : -1) * Math.ceil(c / 2);
      off[k] = Math.max(-4, Math.min(4, lane)) * 8;
    }
    for (let k = 0; k < shown; k++) {
      const isNew = k === shown - 1;
      ctx.fillStyle = hue(k, i);
      ctx.globalAlpha = isNew ? 1 : 0.7;
      ctx.beginPath();
      ctx.arc(sx(vals[k]), y + off[k], isNew ? G_DOT + 1.2 : G_DOT, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isNew) {
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx(vals[k]), y + off[k], G_DOT + 4.5, 0, 7);
        ctx.stroke();
      }
    }

    ctx.fillStyle = shown ? colors.ink1 : colors.ink3;
    ctx.font = `600 13px ${colors.font}`;
    ctx.textAlign = "right";
    ctx.fillText(shown ? fmt(GLOBAL.runMean[shown][i], 3) : "—", w - 24, y);
    ctx.textAlign = "left";
  });

  /* the ramp, spelled out once */
  const KY = lastRow + G_BAND + 28, KX = 76, KW = 110;
  for (let q = 0; q < KW; q++) {
    ctx.fillStyle = hexLerp(colors.valueLow, colors.valueHigh, q / (KW - 1));
    ctx.fillRect(KX + q, KY - 5, 1.2, 10);
  }
  ctx.font = `9px ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.fillText("low", KX - 8, KY);
  ctx.textAlign = "left";
  ctx.fillText("high", KX + KW + 8, KY);
  /* the words are the legend's job; the canvas keeps the RAMP, which two
     legend swatches cannot show, and the shortest label that makes it a scale */
  ctx.fillText("value of the feature on this row", KX + KW + 40, KY);
}

/* THE SEATS ARE EQUIDISTANT FROM THE CENTRE — 120 degrees apart, at one radius.
   The earlier arrangement put two players on a diagonal and one on the axis, so
   the odd one sat 23 from the middle where the others sat 32, and the ring was
   plainly not centred on them (Kenneth, 2026-08-31). The angles are 120 / 0 /
   240 so the shape still reads as the notebook figure's: upper-left, right,
   lower-left.

   The outline is then the SMALLEST SHAPE HOLDING THE SEATS, which is a circle
   whenever they are equidistant (one player, or three at one radius) and the
   notebook's capsule for a stacked pair. An equilateral triangle has no square
   bounding box, so a single box rule cannot give both a centred ring and this
   arrangement; two cases and a reason beats one rule and an off-centre ring. */
function seats(n) {
  if (n <= 1) return [[CX, CY]];
  if (n === 2) return [[CX, CY - STACK], [CX, CY + STACK]];
  return [120, 0, 240].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [CX + TRI * Math.cos(a), CY - TRI * Math.sin(a)];
  });
}
function outlineOf(n) {
  const hw = n === 2 ? R + PAD : (n >= 3 ? TRI : 0) + R + PAD;
  const hh = n === 2 ? STACK + R + PAD : (n >= 3 ? TRI : 0) + R + PAD;
  return { x: CX - hw, y: CY - hh, w: 2 * hw, h: 2 * hh };
}
const lerpBox = (a, b, f) => ({
  x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
  w: a.w + (b.w - a.w) * f, h: a.h + (b.h - a.h) * f,
});
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Where the walk has got to, from anim.k alone — ONE reading, used by both
   halves of the figure so they cannot disagree about who is inside.

   The end state is the case worth naming: at k = 18 the sixth walk has just
   finished, so the coalition is FULL. Deriving `settled` as `done - 3*walksDone`
   gives 0 there and left `?shown=18` showing a complete table beside an empty
   ring — the two halves of the figure contradicting each other. */
function phase(k) {
  const u = Math.min(TOTAL_STEPS, Math.floor(k));
  const f = Math.min(1, (k - Math.floor(k)) / HOLD);
  const atEnd = k >= TOTAL_STEPS;
  const walk = atEnd ? 5 : Math.floor(u / UNITS_PER_WALK);
  const sub = atEnd ? 2 : u % UNITS_PER_WALK;      // 0,1,2 arrive · 3 clears out
  const clearing = !atEnd && sub === 3;
  const landed = atEnd ? 3 : (clearing ? 3 : Math.min(3, sub + (f >= 1 ? 1 : 0)));
  const flying = !atEnd && !clearing && f < 1 ? sub : -1;
  const leaving = clearing ? f : 0;
  const walksDone = atEnd
    ? 6
    : Math.floor(u / UNITS_PER_WALK) + (sub === 3 || (sub === 2 && f >= 1) ? 1 : 0);
  return { u, f, walk, sub, clearing, settled: landed, flying, leaving, walksDone };
}

/* `lab` rather than `L[i]`, because page 2 writes `Age` where page 1 writes `A`
   and a three-character code needs two thirds of the type size to fit the same
   circle. Nothing else about the circle changes between the pages. */
function circle(ctx, colors, x, y, i, dim, lab, r = R) {
  ctx.save();
  ctx.globalAlpha = dim ? 0.28 : 1;
  ctx.fillStyle = colors.clusters[i];
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = colors.surface;
  ctx.font = `600 ${Math.round(r * (lab.length > 1 ? 0.62 : 0.95))}px ${colors.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(lab, x, y + 1);
  ctx.restore();
}

/* --- page 2: the game comes from a pinned value function ------------------ *
 * `model.js` holds v(S) for all eight coalitions x 60 held-out patients under
 * the notebook's own 300-tree forest — the forest itself is 798 KB of JSON and
 * its value function is 7. Read in PERCENTAGE POINTS, which is not cosmetic:
 * it puts page 2's numbers in the same range as page 1's tens and units, so a
 * reader crossing the tabs is reading one figure at one scale, and a
 * contribution of "+13.6" is a sentence a clinician can finish.
 *
 * ON THE MODEL'S OWN 0 TO 1 SCALE, not in percentage points. Points read better
 * and put page 2's numbers in page 1's range, which is why they were tried
 * first — but a SHAP value has the UNITS OF THE MODEL OUTPUT, and a summary
 * that prints a prediction of 0.542 beside a contribution of +13.6 makes the
 * reader convert before they can add up (Kenneth, 2026-09-01: "I was expecting
 * what is the prediction, like 0-1, then followed by the shap scores"). It is
 * also what `shap_values` actually holds, so the widget and the notebook now
 * print the same numbers.
 *
 * ROUNDED ONCE, AT THE SOURCE, and everything downstream derives from the
 * rounded table — so the edge labels the walk prints sum exactly to the score
 * the bars print. Rounding for display instead would let the halves of the
 * figure disagree in the last digit, which is this repo's oldest defect. */
function gameFromModel(patient) {
  const row = DATA.v[patient - 1];
  const V = {};
  DATA.keys.forEach((k, q) => { V[k] = Math.round(row[q] * 1000) / 1000; });
  return V;
}


defineWidget({
  slug: "shap",
  title: "Explaining a Prediction",
  subtitle:
    "We can divide a payout among the players who produced it by asking what each "
    + "one adds when it joins. A player's contribution depends on who is already "
    + "inside, so the Shapley value averages it over every order of arrival. SHAP "
    + "is that division applied to one prediction, with the features as the players.",
  layout: "side",
  status: "shipped",
  height: canvasHeight,

  /* THE LEGEND IS WHERE PAGE 2 NAMES ITS PLAYERS. Three circles reading Age /
     EF / Cr say which feature but not which VALUE, and the patient's values are
     what makes the walk this patient's rather than anyone's. They could have
     gone on the canvas under the queue; at 9px, three units side by side at a
     58px pitch collide. The legend already carries a swatch in the right colour
     next to a name, which is exactly the shape wanted — and it costs the figure
     no space at all. (lm-interaction, 2026-08-29: the legend must match the
     graph, which here means it changes with the page.) */
  legend: ({ params }) => {
    const shared = [
      { token: "highlight", label: "the route being walked", mark: "line" },
      { token: "empirical", label: "a coalition reached", mark: "dot" },
    ];
    /* THE GLOBAL PAGE'S LEGEND IS A DIFFERENT LEGEND, because its colour means
       a different thing: value, not identity. Naming Age blue there would be
       describing marks that are not on it. */
    if (isPile(params)) {
      return [
        { token: "value-low", label: "a low value of the feature on that row", mark: "dot" },
        { token: "value-high", label: "a high value of it", mark: "dot" },
        { token: "highlight", label: "the patient just added", mark: "dot" },
      ];
    }
    if (params.page !== "model") {
      return [...shared, { token: "reference", label: "nobody in · everybody in", mark: "dot" }];
    }
    const pt = DATA.patients[params.patient - 1];
    return [
      ...[0, 1, 2].map((i) => ({
        token: `cluster-${"abc"[i]}`,
        label: `${DATA.labels[i]} — ${fmt(pt.raw[i], i === 2 ? 1 : 0)} ${DATA.units[i]}`,
        mark: "dot",
      })),
      ...shared,
      { token: "reference", label: "average prediction · this patient", mark: "dot" },
    ];
  },

  params: {
    /* TWO LEVELS, BECAUSE THERE ARE TWO LEVELS. The notebook's own headings are
       the game and the model, and the individual and global explanations are
       both readings OF the model — three peers would assert a flatness the
       material does not have. Gating a segmented on a segmented is the house
       pattern (metrics, mixed-model, lm-diagnostics, odds-and-risk,
       lm-adjustment all do it).

       It was briefly flat for one round, over a real defect: drive labels are
       chosen by a PARAMETER NAME, `view` keeps its value while hidden, and a
       reader who visited "all sixty" and came back to the game met a Step
       button offering to "Add one patient". That is fixed where it belonged —
       core now refuses to let a hidden control choose a label — rather than by
       flattening a hierarchy to dodge it.

       DISPLAY, NOT DATA, both of them: the walk's whole state is one index and
       it means the identical thing on the game and on one patient, so changing
       tab mid-walk leaves the same walk halfway through against a different
       game. The pile is a DIFFERENT animation, and `rebuild` below empties it
       when the kind changes rather than reading a walk index as a patient
       count. */
    page: {
      type: "segmented",
      label: "Show",
      options: [
        { value: "game", label: "The game", detail: "three players, a payout, and you set what each one is worth" },
        { value: "model", label: "The model", detail: "a random forest trained on 239 patients, inspected on the 60 held out" },
      ],
      default: "game",
      display: true,
    },

    /* THE NOTEBOOK'S OWN WORDS: 04-5 §1 contrasts "Global explanations: which
       features are most influential across the entire dataset" with "Local
       explanations: why a specific prediction was made for one individual", and
       its cells are commented "# Plot global explanation" and "# Plot individual
       explanation". Individual and Global it is. */
    view: {
      type: "segmented",
      label: "Explain",
      options: [
        { value: "one", label: "Individual", detail: "why this one prediction came out where it did" },
        { value: "all", label: "Global", detail: "the same explanation for all 60, built one patient at a time" },
      ],
      default: "one",
      display: true,
      when: { param: "page", equals: "model" },
    },

    alone: { type: "section", label: "What each brings alone", when: { param: "page", equals: "game" } },

    soloA: { type: "int", label: "A", min: -40, max: 60, step: 5, default: 30, when: { param: "page", equals: "game" } },
    soloB: { type: "int", label: "B", min: -40, max: 60, step: 5, default: 20, when: { param: "page", equals: "game" } },
    soloC: { type: "int", label: "C", min: -40, max: 60, step: 5, default: 30, when: { param: "page", equals: "game" } },

    /* THE THREE PAIRS ARE THREE SLIDERS, not one slider and a toggle. A toggle
       let one interaction exist at a time, which made the whole game a thing
       you had to hold in your head across three presses — and the reader must
       be able to see it at once, because two interactions at once is the case
       that shows the score is LINEAR in the dividends. */
    /* ONE DESCRIPTOR, ON THE SECTION. Each slider used to carry its own —
       "A and B split this between them", and twice more with the letters
       changed — which is three copies of one sentence pretending to be three
       facts. A `detail` is static text, so it can only ever say what the
       control IS; when that is the same for a whole group, the group is where
       it belongs. */
    together: {
      type: "section",
      label: "What each pair creates together",
      detail: "Value that appears only when both are in the coalition, on top of what "
        + "each brings alone. The two split it equally, and the third player gets none "
        + "of it. Negative means they get in each other's way.",
      when: { param: "page", equals: "game" },
    },

    pairAB: { type: "int", label: "A & B", min: -40, max: 60, step: 5, default: 0, when: { param: "page", equals: "game" } },
    pairAC: { type: "int", label: "A & C", min: -40, max: 60, step: 5, default: 0, when: { param: "page", equals: "game" } },
    pairBC: { type: "int", label: "B & C", min: -40, max: 60, step: 5, default: 0, when: { param: "page", equals: "game" } },

    /* PAGE 2 HAS EXACTLY ONE CONTROL, and that is the trade the pinned value
       function bought. A reader cannot invent a patient — v(S) for an arbitrary
       one would need the 798 KB forest — so they pick one of the 60 the model
       never saw. Which is the honest constraint anyway: every walk on this page
       is a real person's prediction being taken apart.

       A slider rather than a dropdown, because sweeping it is the second
       lesson: the bars reorder, change sign, and change how far the six orders
       disagree, all within one model. Patient 11 is 48 years old with an
       ejection fraction of 30% and creatinine 1.6 — young, which pulls the risk
       down, against two findings that push it up, and its two bad features are
       far worse together than apart (each alone barely moves the prediction;
       the pair takes it from 38.6% to 70.3%). That interaction is why the six
       orders disagree by 29 points on one feature, and it is the reason the
       notebook's own linear example could never show this. */
    who: {
      type: "section", label: "Whose prediction",
      when: { all: [{ param: "page", equals: "model" }, { param: "view", equals: "one" }] },
    },
    patient: {
      type: "int", label: "Patient", min: 1, max: DATA.patients.length, default: 11,
      detail: `one of the ${DATA.patients.length} held out of training`,
      when: { all: [{ param: "page", equals: "model" }, { param: "view", equals: "one" }] },
    },

    /* one hidden authoring hatch for two animation lengths: 23 walk units and
       60 patients. `init` clamps to whichever the tab is running. */
    shown: { type: "int", min: 0, max: Math.max(TOTAL_STEPS, GSTEPS), default: 0, hidden: true },
  },

  /* ONE GAME OBJECT, TWO SOURCES. Everything after `V` is identical for both
     pages, which is the structural claim the widget is making: the machinery
     does not know whether its payouts came from six sliders or from a forest. */
  compute: ({ params }) => {
    /* The global page needs no game at all: every number on it was computed
       once at load, from the same pinned v(S) the other pages read. */
    if (isPile(params)) return { global: true, model: true, lab: CODES, dp: 1 };
    const model = params.page === "model";
    let solo = null, pair = null, split = null;
    let V;
    if (model) {
      V = gameFromModel(params.patient);
    } else {
      ({ solo, pair } = gameOf(params));
      V = vTable(solo, pair);
    }
    const phi = shapley(V);
    const rows = PERMS.map((p) => rowOf(V, p));

    /* HOW FAR THE SIX ORDERS DISAGREE ABOUT ONE PLAYER — the misconception,
       as two numbers. On page 2 it is what sits under each bar, because a
       Shapley value of +13.6 that ranged from +2.5 to +31.5 depending on who
       arrived first is not a measurement with a bit of noise on it; the average
       is the only thing that was ever well defined. */
    const range = [0, 1, 2].map((i) => {
      const col = rows.map((r) => r[i]);
      return [Math.min(...col), Math.max(...col)];
    });

    /* EFFICIENCY, ASSERTED ON BOTH PAGES: the scores divide the whole payout and
       leave nothing over. It is the axiom the readout prints, so it is checked
       rather than trusted. */
    const gap = Math.abs(phi.reduce((a, b) => a + b, 0) - (V["012"] - V["-"]));
    if (gap > 1e-5) throw new Error(`shap: the scores miss the payout by ${gap}`);

    if (!model) {
      /* TWO ROUTES TO ONE NUMBER on page 1, so they are checked against each
         other rather than trusted: the subset enumeration is the definition,
         the split is the reading the stage prints. A drift between them would
         be a figure whose halves disagree, which is the defect this repo keeps
         re-earning. Page 2's game has a three-way dividend as well, so the
         two-column split is not a complete account of it and is not shown. */
      split = splitOf(solo, pair);
      const drift = Math.max(...phi.map((v, i) => Math.abs(v - split[i].total)));
      if (drift > 1e-9) throw new Error(`shap: the split disagrees with the definition by ${drift}`);
    }

    return {
      model, solo, pair, V, phi, split, rows, range,
      lab: model ? CODES : L,
      dp: model ? 3 : 0,                       // v(S) and the marginal steps
      dpS: model ? 3 : 1,                      // a score, on a bar
      dpA: model ? 3 : 2,                      // the column average under the table
      suffix: "",
      noun: model ? "features" : "players",
      yLab: model ? "predicted risk v(S)" : "payout v(S)",
      ends: model ? ["average prediction", "this patient"] : ["nobody in", "everybody in"],
      caption: model ? `patient ${params.patient} of ${DATA.patients.length}` : "",
      pIdx: model ? params.patient - 1 : -1,
      /* WHAT THE MODEL IS AND WHAT A SCORE IS MADE OF, said on the stage.
         Kenneth, 2026-09-01: "it would be good to show the model and prediction.
         at the moment i see +/- a number but don't know what it means." He was
         right, and the omission was structural rather than cosmetic: a score
         here is a DIFFERENCE OF TWO PROBABILITIES. v(S) is the model's average
         output over the training set with the features in S pinned to this
         patient, so v(none) is what it predicts knowing nothing about anyone and
         v(all) is what it predicts for this person. The three scores are
         percentage points, and they add to exactly the distance between those
         two. That identity is the whole of what SHAP promises and it was
         previously visible only in the note under one readout tile. */
      lines: model ? [
        `random forest, ${DATA.rf.trees} trees, trained on ${DATA.nTrain} patients — scored here on the ${DATA.patients.length} held out, 0 to 1 for death`,
        `average prediction ${fmt(V["-"], 3)}  →  this patient ${fmt(V["012"], 3)}`
        + `   ·   the three features explain the ${signed(V["012"] - V["-"], 3)} between them`,
      ] : [],
    };
  },

  /* TWO ANIMATIONS BEHIND ONE PAIR OF BUTTONS, so both labels are chosen by the
     tab (3.4c: a button has to name its own verb, and "Walk every order" is
     simply false where sixty patients are being piled up). */
  animation: {
    /* Keyed on `view`, which is HIDDEN on the game page — and core reads a
       hidden control's label as the default, so the game page cannot inherit
       the pile's verbs. */
    stepLabel: { param: "view", labels: { all: "Add one patient" }, default: "Let one in" },
    stepTitle: {
      param: "view",
      labels: { all: "Add one more patient's explanation to the pile" },
      default: "Let the next player into the coalition",
    },
    runLabel: { param: "view", labels: { all: "Add all 60" }, default: "Walk every order" },
    runTitle: {
      param: "view",
      labels: { all: "Add every held-out patient, one after another" },
      default: "Walk all six orders of arrival, one after another",
    },

    init: ({ params, fromScratch }) => {
      const pile = isPile(params);
      const total = pile ? GSTEPS : TOTAL_STEPS;
      return {
        kind: pile ? "pile" : "walk",
        k: fromScratch ? 0 : Math.min(total, params.shown || 0),
        done: !fromScratch && (params.shown || 0) >= total,
      };
    },

    /* THE TAB IS A DISPLAY PARAMETER, so core keeps the animation across it and
       hands it here to re-derive. `game` and `one` run the same walk and keep
       their place; `all` runs a different thing entirely, and a walk index
       reinterpreted as a patient count would put the reader two thirds of the
       way through a pile they never built. It empties instead — which is also
       what "widgets start empty" asks for, since the build IS the lesson. */
    rebuild: (anim, { params }) => {
      const kind = isPile(params) ? "pile" : "walk";
      if (anim.kind === kind) return;
      anim.kind = kind;
      anim.k = 0;
      anim.done = false;
    },

    advance: (anim, { dt, params }) => {
      if (anim.done) return false;
      const pile = isPile(params);
      const total = pile ? GSTEPS : TOTAL_STEPS;
      const ms = pile ? G_MS : MS_PER_STEP;
      const target = anim.mode === "step" ? Math.min(total, Math.floor(anim.k) + 1) : total;
      anim.k = Math.min(target, anim.k + dt / ms);
      if (anim.k >= total) { anim.k = total; anim.done = true; return false; }
      return anim.k < target;
    },
  },

  draw: ({ ctx, colors, w, h, state, anim }) => {
    if (state.global) { drawGlobal(ctx, colors, w, anim); void h; return; }
    const { V, rows, phi, split, range, model, lab, dp, dpS, dpA, suffix } = state;
    const k = anim ? anim.k : 0;
    const p = phase(k);
    const perm = PERMS[p.walk];
    const f = ease(p.f);
    const settled = p.settled, flying = p.flying, leaving = p.leaving;

    /* ---- left: the coalition, filling ---- */
    const from = seats(settled), to = seats(Math.min(3, settled + 1));
    const box = leaving > 0
      ? lerpBox(outlineOf(3), outlineOf(0), ease(leaving))
      : lerpBox(outlineOf(settled), outlineOf(flying >= 0 ? settled + 1 : settled), flying >= 0 ? f : 0);
    ctx.save();
    ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = colors.ink1;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, Math.min(box.w, box.h) / 2);
    ctx.stroke(); ctx.restore();

    ctx.fillStyle = colors.ink3; ctx.font = `11px ${colors.font}`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("the coalition S", 30, 40);
    /* WHOSE PREDICTION, on the stage and not only in the rail — a figure
       published at `?page=model&patient=41&shown=23` has to say who it is
       about. The true outcome is deliberately absent: SHAP explains the model's
       output, and printing "this one died" beside it invites the reading that a
       wrong prediction has a wrong explanation. */
    if (model) ctx.fillText(state.caption, 24, 20);

    for (let r = 0; r < 3; r++) {
      const i = perm[r];
      let x, y, dim = false;
      if (leaving > 0) {                       /* easing back out to the queue */
        const a = seats(3)[r], qx = QX + r * QGAP;
        const g = ease(leaving);
        x = a[0] + (qx - a[0]) * g; y = a[1] + (QY - a[1]) * g;
        dim = g > 0.5;
      } else if (r < settled) {
        const a = from[r], b = to[r] || a;
        x = a[0] + (b[0] - a[0]) * (flying >= 0 ? f : 0);
        y = a[1] + (b[1] - a[1]) * (flying >= 0 ? f : 0);
      } else if (r === flying) {
        const qx = QX + r * QGAP;
        x = qx + (to[r][0] - qx) * f; y = QY + (to[r][1] - QY) * f;
      } else { x = QX + r * QGAP; y = QY; dim = true; }
      circle(ctx, colors, x, y, i, dim, lab[i]);
    }
    if (settled + Math.max(0, flying >= 0 ? 1 : 0) < 3) {
      ctx.fillStyle = colors.ink3; ctx.font = `11px ${colors.font}`; ctx.textAlign = "left";
      ctx.fillText("waiting, in this order", QX - 8, QY + 38);
    }
    /* the notebook's own notation for what is in the box — SETTLED only, since
       a label reading v({A,B}) while B is mid-air is a false claim on screen */
    const inside = perm.slice(0, settled);
    ctx.fillStyle = colors.ink1; ctx.font = `14px ${colors.font}`; ctx.textAlign = "left";
    const vTxt = `v({${inside.map((i) => lab[i]).join(",")}})`;
    ctx.fillText(vTxt, 24, 190);
    /* measured, not a fixed 130: `v({Age,EF,Cr})` is twice the width of
       `v({A,B,C})` and the reading has to follow it */
    ctx.fillStyle = colors.highlight;
    ctx.fillText(`= ${fmt(V[key(inside)], dp)}${suffix}`, 24 + ctx.measureText(vTxt).width + 10, 190);

    /* ---- right: the path diagram, drawn by the walking ---- */
    const vals = SUBSETS.map((S) => V[key(S)]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.2 || 10; lo -= pad; hi += pad;
    /* THE COALITION COLUMN GIVES BACK 48px WHEN THERE IS NOT MUCH TO GIVE. Its
       widest content is the ring (150px) and the v({...}) reading (~165px), so
       262 was generous; on a 535px canvas it left the plot 76px per rank, and a
       three-decimal node label is 55px of that. "+0.007" on an edge then ran
       into "Age+Cr 0.394" on the node beside it. Only below 640 — the wide
       reading, which Kenneth has reviewed, does not move. */
    const PX0 = w < 640 ? 214 : 262, PX1 = w - 44;
    const PXs = [0, 1, 2, 3].map((q) => PX0 + (q / 3) * (PX1 - PX0));
    const PY0 = 40;
    /* PAGE 2 GIVES THE PLOT 16px BACK to the two sentences below it. Without
       that the first sentence sits 10px under "0 features in" and the axis label
       reads as part of it — legal by the collision check, unreadable in the
       picture. Page 1 has nothing to put there and keeps the taller plot. */
    const PY1 = model ? 234 : 250;
    const ay = (v) => PY1 - ((v - lo) / (hi - lo)) * (PY1 - PY0);

    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.save(); ctx.setLineDash([2, 3]);
    for (const x of PXs) { ctx.beginPath(); ctx.moveTo(x + 0.5, PY0 - 14); ctx.lineTo(x + 0.5, PY1 + 12); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = colors.ink3; ctx.font = `10px ${colors.font}`; ctx.textAlign = "center";
    [`0 ${state.noun} in`, "1", "2", "3 — all in"].forEach((t, i) => ctx.fillText(t, PXs[i], PY1 + 28));
    ctx.save(); ctx.translate(PX0 - 34, (PY0 + PY1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(state.yLab, 0, 0); ctx.restore();
    ctx.textAlign = "left";

    /* every route walked so far, faint; the one in progress lit */
    const seen = new Set(["-"]);
    const routes = [];
    for (let q = 0; q < p.walksDone; q++) routes.push({ perm: PERMS[q], upto: 3, live: false, frac: 1 });
    /* the walk in progress, lit — and at the end the SIXTH stays lit rather
       than joining the faint pile, or the legend's "route being walked" would
       name a mark no longer on the figure */
    if (p.walksDone < 6) {
      routes.push({
        perm, upto: settled + (flying >= 0 ? 1 : 0), live: true,
        frac: flying >= 0 ? f : 1,
        fade: leaving > 0 ? ease(leaving) : 0,   /* 0 lit · 1 fully in the pile */
      });
    } else routes[5] = { perm: PERMS[5], upto: 3, live: true, frac: 1, fade: 0 };
    for (const rt of routes) {
      const S = [];
      let prev = { x: PXs[0], y: ay(V["-"]) };
      for (let r = 0; r < rt.upto; r++) {
        const i = rt.perm[r]; S.push(i);
        const node = { x: PXs[S.length], y: ay(V[key(S)]) };
        const ff = rt.live && r === rt.upto - 1 ? rt.frac : 1;
        const nx = prev.x + (node.x - prev.x) * ff, ny = prev.y + (node.y - prev.y) * ff;
        const fade = rt.fade ?? 0;
        ctx.strokeStyle = rt.live && fade < 0.5 ? colors.highlight : colors.ink3;
        ctx.lineWidth = rt.live ? 2.6 - 1.4 * fade : 1.2;
        ctx.globalAlpha = rt.live ? 1 - 0.68 * fade : 0.32;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.globalAlpha = 1;
        if (rt.live && ff > 0.03 && fade < 0.3) {
          const d = (V[key(S)] - V[key(S.slice(0, -1))]) * ff;
          ctx.fillStyle = colors.highlight; ctx.font = `10px ${colors.font}`;
          ctx.textAlign = "center";
          ctx.fillText(signed(d, dp), (prev.x + nx) / 2, (prev.y + ny) / 2 - 10);
          ctx.textAlign = "left";
        }
        if (ff >= 1) seen.add(key(S));
        prev = { x: nx, y: ny };
        if (ff < 1) break;
      }
    }
    /* COALITIONS THAT PAY THE SAME SHARE A POINT, SO THEY SHARE A LABEL.
       Staggering them above and below was tried and moved the collision rather
       than removing it — a label pushed down lands on the next node's. Grouping
       by value draws one dot and one reading, "A C 30", which is also the truer
       statement: at this rank those two coalitions are worth the same. */
    for (let rank = 0; rank <= 3; rank++) {
      const byVal = new Map();
      for (const S of SUBSETS) {
        if (S.length !== rank || !seen.has(key(S))) continue;
        const v = V[key(S)];
        if (!byVal.has(v)) byVal.set(v, []);
        byVal.get(v).push(S);
      }
      /* COALITIONS TOO CLOSE TO TELL APART SHARE A LABEL. Equal ones already
         did — "A C 30", one dot and one reading, because staggering the second
         label only moved the collision onto the next node. NEARLY equal ones
         are the same problem and page 2 makes them constantly: this patient's
         {EF} is 38.8 and {Age} is 36.9, nine pixels apart, and no leader line
         can distinguish two dots in the same column at the same height. So the
         rule generalises from "equal value" to "indistinguishable on this
         axis", and the label then has to carry a number PER member rather than
         one for the group. An exact tie keeps the short form, because there the
         one number is true of both. */
      const nodes = [...byVal].map(([v, group]) => ({ v, group, y: ay(v) }))
        .sort((a, b) => a.y - b.y);
      /* THE TEST IS WHETHER A LABEL FITS BETWEEN THE DOTS, which is a question
         about the dots and not about the other labels. A 9px reading needs
         about 10px of clear band between the marker above it and its own; below
         that there is nowhere to put it, and the two coalitions share a label
         instead. Measuring the gap between LABELS was the earlier rule and it
         let "B 20" sit 2px into the dot above it on page 1's own default. */
      /* CLEAR is how far a label's centre must sit from a dot's centre for the
         two not to touch: the dot's radius plus half the 9px ink. Two dots can
         therefore hold separate labels only if they are 2 x CLEAR apart, since
         the lower one's label has to live in the gap between them. */
      const DOT_R = 4, HALF_TX = 4.5, CLEAR = DOT_R + HALF_TX, LINE = 11;
      const clusters = [];
      for (const nd of nodes) {
        const last = clusters[clusters.length - 1];
        if (last && nd.y - last.yBot < 2 * CLEAR) { last.members.push(nd); last.yBot = nd.y; }
        else clusters.push({ members: [nd], yTop: nd.y, yBot: nd.y });
      }
      /* PLACE, THEN MERGE WHAT DID NOT FIT, and repeat. Bottom up, so a block
         keeps its clearance above the dots it names and the crowding is pushed
         into empty sky; top down does the opposite, and the lowest label
         inherits every push from above and lands on a marker.
         The pairwise rule above is not enough on its own, because a two-line
         block reaches 11px further up than the single line it was sized for and
         can land on the dot of the cluster above — three of the sixty patients
         did exactly that. So the floor clears the WHOLE block, and a block that
         then has nowhere left to go joins the cluster above instead. Each pass
         removes a cluster, so with at most three nodes at a rank this runs at
         most twice. */
      for (;;) {
        let ceil = Infinity;
        for (let q = clusters.length - 1; q >= 0; q--) {
          const cl = clusters[q], above = clusters[q - 1];
          const lines = cl.members.length;
          const floorY = above ? above.yBot + CLEAR + (lines - 1) * LINE : -Infinity;
          cl.ly = Math.max(floorY, Math.min(cl.yTop - 13, ceil - LINE));   // bottom line
          ceil = cl.ly - (lines - 1) * LINE;                               // top line
        }
        const q = clusters.findIndex((cl) => cl.ly > cl.yTop - CLEAR);
        if (q <= 0) break;
        clusters[q - 1].members.push(...clusters[q].members);
        clusters[q - 1].yBot = clusters[q].yBot;
        clusters.splice(q, 1);
      }
      const x = PXs[rank];
      const end = rank === 0 || rank === 3;
      /* one-letter players concatenate — "AC"; three-letter codes must not, or
         "AgeCr" reads as one thing */
      const nameOf = (nd) =>
        nd.group.map((S) => S.map((i) => lab[i]).join(model ? "+" : "")).join("  ");
      for (const cl of clusters) {
        for (const nd of cl.members) {
          ctx.fillStyle = end ? colors.reference : colors.empirical;
          ctx.beginPath(); ctx.arc(x, nd.y, end ? 5.5 : 4, 0, 7); ctx.fill();
        }
        ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
        if (rank === 0 || rank === 3) {
          for (const nd of cl.members) {
            const vTx = fmt(nd.v, dp);
            if (rank === 0) { ctx.textAlign = "right"; ctx.fillText(vTx, x - 9, nd.y); ctx.textAlign = "left"; }
            else ctx.fillText(vTx, x + 9, nd.y);
          }
          continue;
        }
        /* a label that had to move gets a hairline back to the dots it names */
        if (cl.yTop - cl.ly > 16) {
          ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, cl.ly + 4); ctx.lineTo(x, cl.yTop - 5); ctx.stroke();
        }
        /* A MERGED CLUSTER IS ONE LINE PER MEMBER, STACKED — not one long line.
           Joining them read fine for two and broke for three: patient 1 puts all
           three pairs within 10px of each other, and
           "Age+EF 31.8 · Age+Cr 29.3 · EF+Cr 28.7" is 250px of label across a
           155px column, straight through the marginal contribution printed on
           the edge beside it. Stacked, each line is a third of that and the
           block still reads top to bottom in the order the dots do. */
        ctx.textAlign = "center";
        const m = cl.members.length;
        cl.members.forEach((nd, k) => {
          ctx.fillText(`${nameOf(nd)} ${fmt(nd.v, dp)}`, x, cl.ly - (m - 1 - k) * LINE);
        });
        ctx.textAlign = "left";
      }
    }
    ctx.fillStyle = colors.reference; ctx.font = `9px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.fillText(state.ends[0], PXs[0], PY0 - 24);
    ctx.fillText(state.ends[1], PXs[3], PY0 - 24);
    ctx.textAlign = "left";

    /* THE MODEL AND THE PREDICTION, in the gap between the path plot's own axis
       labels and the table below them — full width, because they are a
       statement about the whole figure rather than about either column. */
    if (model) {
      ctx.font = `9px ${colors.font}`;
      ctx.fillStyle = colors.ink3; ctx.fillText(state.lines[0], 24, 279);
      ctx.fillStyle = colors.ink1; ctx.fillText(state.lines[1], 24, 292);
    }

    /* ---- below: the walks recorded so far, and the column average ---- */
    /* CANDIDATE 3 (Kenneth's pick, `_lab/shap-bars.html`): the walks table takes
       the left half and the score bars the right, so the bars roughly treble
       their travel without the canvas growing. The table sits under the
       coalition it records and the bars under the path plot they conclude, so
       each column of the figure reads top to bottom as one thought. */
    const ORD_X = 24;
    const CW = Math.max(84, Math.min(112, (w * 0.34 - 62) / 3));
    /* the order column holds "A B C" on page 1 and "Age EF Cr" on page 2 */
    const CXt = ORD_X + (model ? 78 : 62);
    const DIV = CXt + 3 * CW + 22;
    ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
    ctx.fillText("walks you have taken", ORD_X, TABLE_Y - 30);
    ctx.fillText("order", ORD_X, TABLE_Y - 14);
    for (let c = 0; c < 3; c++) {
      ctx.textAlign = "center";
      ctx.fillStyle = colors.clusters[c];
      ctx.font = `600 11px ${colors.font}`;
      ctx.fillText(model ? lab[c] : `player ${L[c]}`, CXt + c * CW + CW / 2, TABLE_Y - 14);
    }
    ctx.textAlign = "left";
    for (let q = 0; q < 6; q++) {
      const y = TABLE_Y + q * TABLE_ROW, isDone = q < p.walksDone;
      ctx.globalAlpha = isDone ? 1 : (q === p.walksDone ? 0.8 : 0.26);
      ctx.fillStyle = q === p.walksDone && !isDone ? colors.highlight : colors.ink3;
      ctx.font = `10px ${colors.font}`;
      ctx.fillText(PERMS[q].map((i) => lab[i]).join(" "), ORD_X, y);
      if (isDone) for (let c = 0; c < 3; c++) {
        ctx.fillStyle = colors.ink1; ctx.textAlign = "center";
        ctx.fillText(signed(rows[q][c], dp), CXt + c * CW + CW / 2, y);
        ctx.textAlign = "left";
      }
      ctx.globalAlpha = 1;
    }
    /* WHERE EACH SCORE CAME FROM, and it is deliberately the SHAPE the library's
       own bar plot uses: sorted by magnitude, signed against a zero line, the
       biggest at the top. So page 1 ends on the picture page 2 opens with, and
       a reader who has met `shap.plots.bar` recognises it before being told.
       The two numbers on each row are what the bar is made of — a player keeps
       its own dividend whole and takes half of every pair it is in.

       Held back until the six walks are done, for the same reason the readout
       is: it is the answer, and the answer is what the walking builds. */
    if (p.walksDone === 6) {
      const order = [0, 1, 2].slice().sort((a, b) => Math.abs(phi[b]) - Math.abs(phi[a]));
      /* side by side while there is room, stacked under the table when there is
         not — one origin, so nothing below here knows which it got */
      const narrow = w < STACK_W;
      const TOP = narrow ? STACK_Y : SPLIT_Y;
      const BX0 = narrow ? ORD_X : DIV + 40, BX1 = w - 24;
      /* THE BADGE GETS ITS OWN GUTTER, and the bars start after it. Sharing one
         lane worked while the badge held a single letter: a long negative bar
         puts its number just left of the bar's end, and on page 1 that ended
         4px clear of an 18px badge. A three-letter badge is 24px and the number
         landed on top of it for any patient whose risk the model pushes down —
         which is most of them. Two lanes, so the clearance is structural rather
         than a coincidence of two constants. */
      const CR = model ? 12 : 9;             // "Age" needs a wider badge than "A"
      const BAR0 = BX0 + 2 * CR + 8;
      /* the zero rule sits left of centre because a negative score is the rarer
         case and the labels hang off the positive end. It does NOT move with the
         scores: a rule that shifted as the patient slider swept would make every
         comparison a re-reading. */
      const ZERO = BAR0 + (BX1 - BAR0) * 0.42;
      /* NOT `Math.max(1, ...)`. That floor was a divide-by-zero guard written
         when a score was tens of points, and it is a no-op there — but on the
         model's own 0 to 1 scale every |phi| is below 1, so the floor became the
         scale, every bar shrank to a stub, and both end reserves divided by a
         fraction and blew past the canvas. A guard must not be a bound. */
      const mx = Math.max(1e-9, ...phi.map((v) => Math.abs(v)));
      /* THE END LABELS ARE RESERVED FOR WHERE THE BARS ACTUALLY REACH, not for
         where they could. Reserving both ends unconditionally cost a third of
         the travel Kenneth picked this layout to get; one of these two fractions
         is always exactly 1 (whichever sign owns the largest score), so only the
         end a bar really reaches pays for its label. */
      const negF = Math.max(0, -Math.min(...phi)) / mx;
      const posF = Math.max(0, Math.max(...phi)) / mx;
      /* the last two are backstops rather than reserves: with every score zero
         both fractions are zero, every reserve is Infinity, and the +/- ticks at
         ZERO +/- HALF +/- 8 would be drawn off both edges. */
      const HALF = Math.min(
        negF > 0 ? (ZERO - BAR0 - 46) / negF : Infinity,
        posF > 0 ? (BX1 - ZERO - 60) / posF : Infinity,
        ZERO - 16,
        BX1 - ZERO - 16,
      );
      const at = (v) => ZERO + (v / mx) * HALF;
      const ROW_H = 34;
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
      /* the rule between the two blocks is what MAKES them two columns, so it
         goes when they stop being two columns */
      if (!narrow) {
        ctx.beginPath(); ctx.moveTo(DIV + 0.5, TOP - 40); ctx.lineTo(DIV + 0.5, TOP + 3 * ROW_H - 12); ctx.stroke();
      }
      ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
      ctx.fillText(model ? "what each feature contributed" : "what each player scored", BX0, TOP - 32);
      ctx.textAlign = "center";
      ctx.fillText("−", ZERO - HALF - 8, TOP - 18);
      ctx.fillText("0", ZERO, TOP - 18);
      ctx.fillText("+", ZERO + HALF + 8, TOP - 18);
      ctx.textAlign = "left";
      ctx.beginPath(); ctx.moveTo(ZERO + 0.5, TOP - 12); ctx.lineTo(ZERO + 0.5, TOP + 3 * ROW_H - 18); ctx.stroke();
      order.forEach((i, row) => {
        const y = TOP + row * ROW_H;
        const x0 = Math.min(ZERO, at(phi[i])), bw = Math.abs(at(phi[i]) - ZERO);
        ctx.fillStyle = colors.clusters[i]; ctx.globalAlpha = 0.85;
        ctx.fillRect(x0, y - 10, Math.max(1.5, bw), 20);
        ctx.globalAlpha = 1;
        circle(ctx, colors, BX0 + CR, y, i, false, lab[i], CR);
        ctx.textAlign = phi[i] >= 0 ? "left" : "right";
        ctx.fillStyle = colors.ink1; ctx.font = `600 13px ${colors.font}`;
        ctx.fillText(signed(phi[i], dpS), phi[i] >= 0 ? at(phi[i]) + 8 : at(phi[i]) - 8, y);
        ctx.textAlign = "left";
        /* WHAT THE BAR IS MADE OF, and the two pages have different answers.
           Page 1 can decompose it — a player keeps its own dividend whole and
           takes half of every pair it is in. Page 2's forest has a three-way
           dividend as well, so no two-column split accounts for it; what it
           prints instead is the SPREAD, which is the thing worth knowing about
           a number that only exists as an average. */
        ctx.fillStyle = colors.ink3; ctx.font = `9px ${colors.font}`;
        ctx.fillText(model
          ? `over the six orders ${signed(range[i][0], dpS)} to ${signed(range[i][1], dpS)}`
          : `alone ${fmt(split[i].alone, 0)} · shares ${signed(split[i].share, dpS)}`,
          BAR0, y + 19);
      });

      const y = TABLE_Y + 6 * TABLE_ROW + 12;
      ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(CXt, y - 12.5); ctx.lineTo(CXt + 3 * CW, y - 12.5); ctx.stroke();
      ctx.fillStyle = colors.ink1; ctx.font = `11px ${colors.font}`;
      ctx.fillText("the average", ORD_X, y);
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = colors.highlight;
        ctx.font = `600 12px ${colors.font}`; ctx.textAlign = "center";
        ctx.fillText(signed(phi[c], dpA), CXt + c * CW + CW / 2, y);
        ctx.textAlign = "left";
      }
    }
    void h;
  },

  /* THE SCORES ARE THE RESULT, so they sit here and not in a cell of the
     chooser (2.7). `together` is adjacent to them because efficiency is a
     claim about the three of them at once. */
  readout: ({ state, anim }) => {
    if (state.global) {
      const shown = Math.min(GSTEPS, Math.floor(anim ? anim.k : 0));
      return [
        ...G_ORDER.map((i) => ({
          label: DATA.labels[i],
          value: shown ? fmt(GLOBAL.runMean[shown][i], 3) : "—",
          note: shown
            ? `average contribution ignoring sign, over ${shown} patient${shown === 1 ? "" : "s"}`
            : "add a patient first",
        })),
        {
          label: "Patients",
          value: `${shown} of ${GSTEPS}`,
          note: "each adds one dot to every row",
        },
      ];
    }
    const { phi, V, model, dp, suffix } = state;
    const p = phase(anim ? anim.k : 0);
    const built = p.walksDone === 6;
    const note = built ? "averaged over all six orders" : `after ${p.walksDone} of 6 orders`;
    return [
      /* THE PREDICTION FIRST, because it is the thing the rest explains
         (Kenneth, 2026-09-01: the summary "reports the different contributions,
         but I was expecting what is the prediction, then followed by the shap
         scores"). It carries the baseline and the total in its note, so
         efficiency — the scores divide exactly the distance between those two —
         is one tile rather than a fifth: five tiles wrap at the 535px canvas
         every fingerprint state is hashed at. */
      ...(model ? [{
        label: "Predicted risk",
        value: fmt(V["012"], 3),
        note: built
          ? `${fmt(V["-"], 3)} before any feature · the three add ${signed(V["012"] - V["-"], 3)}`
          : `${fmt(V["-"], 3)} before any feature`,
      }] : []),
      /* the FULL feature names here, not the three-letter codes the circles
         carry: the tiles are the figure's accessible reading, and "Cr" is a
         label that only works once you have seen the legend */
      ...[0, 1, 2].map((i) => ({
        label: model ? DATA.labels[i] : `Player ${L[i]}`,
        value: built ? signed(phi[i], model ? 3 : 2) : "—",
        note: built ? note : "walk every order first",
      })),
      /* EFFICIENCY on the game page, where there is no prediction tile to carry
         it: the three scores divide the whole payout and leave nothing over. */
      ...(model ? [] : [{
        label: "Together",
        value: built ? signed(phi.reduce((a, b) => a + b, 0), 2) : "—",
        note: `v({A,B,C}) = ${fmt(V["012"], dp)}${suffix}`,
      }]),
    ];
  },
});
