/* ============================================================================
   Balancing data — widget 18. DRAFT.

   Hosts at PHM5005 `03-4 ML - Data Preprocessing`, section "## Balancing Data",
   cells 62-72.

     cell 62  a classifier can predict the rare outcome away    -> steps 1 and 2
     cell 63  resample vs class weights, as a table             -> step 3
     cell 65  new samples along the lines to k neighbours       -> step 3, Step

   Cell 64's "apply balancing only to the training set" is NOT here. It had a
   page of its own and the page was cut to get the widget down to three steps;
   the leakage it warns about is arc B's `data-leakage` anyway. Recorded so it is
   a decision rather than an omission.

   `03-4` never fits a model, so every score here is this widget's measurement
   and the readout says so.

   ---------------------------------------------------------------------------
   IT IS A NARRATIVE, IN THREE STEPS, REVEALED DOWNWARDS.

     1 the cohort   both classes, and a dial that throws cases away
     2 fit it       the model's boundary, against the whole cohort's
     3 balance it   the four corrections, and the drive row

   Each step is a `gate`: a full-width button sitting in the control flow exactly
   where its stage begins, with the controls it reveals directly beneath it, and
   a divider above. So the rail GROWS DOWNWARD as the reader works, and every
   earlier control stays where it was. An earlier version used horizontal tabs
   and read as five places to be rather than one thing accumulating.

   The order is not a preference. Three findings behind it:

     - PhET's IMPLICIT SCAFFOLDING: guidance belongs in the affordances and
       constraints of the thing itself, so a reader is "guided without feeling
       guided". Hence controls that APPEAR, and no numbered instructions on
       screen.
     - PhET again, on successive stages: each one "adds complexity... and
       sometimes relaxes constraints present in earlier tabs".
     - Schwartz & Bransford, A Time For Telling: instruction lands far better
       when learners have first compared contrasting cases. Sliding 142 of 150
       cases away is that contrast. Being told the class is rare is not.

   THREE ACTIONS, THREE DIFFERENT WORDS, because the usability literature on
   reset controls is blunt that a bare "Reset" is vague and gets pressed by
   mistake:

     Play / Make one sample   run the balancing
     Back to ...              the gate, closing again
     Start over               the Reset button — closes every gate, returns to
                              the cohort. Named, not left as "Reset" (`resetLabel`).

   ---------------------------------------------------------------------------
   RARITY IS A REMOVAL, NOT A REDRAW, AND THE DIAL STARTS AT ALL OF THEM. It
   keeps a PREFIX of the cohort's minority list — 150, 75, 38, 15, 8 cases — so
   each setting is a subset of the one above it and the majority never moves.
   The widget therefore OPENS on a balanced cohort and the reader creates the
   imbalance by sliding down, which is the thing a fixed total could never show.

   THE REFERENCE LINE IS THE WHOLE COHORT'S OWN FIT — the line you get when you
   have every case. An earlier version used a line fitted to 20,000 invisible
   points, which is what every balancing method actually estimates but invited
   exactly the question it got: "is that the ground truth?" It was not, and it
   could not be checked. This one can: it comes from the picture in step 1.

   ---------------------------------------------------------------------------
   THE PANEL IS SQUARE. Distances between minority points are what SMOTE is made
   of, and a distance is only a distance if both axes carry the same units per
   pixel. Height is a function of width, as in widgets 14 and 16.

   ONE UNIT IS ONE SAMPLE — copied, dropped, or made. That is what makes the four
   methods one animation rather than four. Where a method changes no data the
   plan is empty, the widget sets `anim.inert`, and core takes Step and Play out
   of the row entirely (4.5).

   The numerics are in `./model.js`, checked against scikit-learn 1.9.0 and
   imbalanced-learn 0.14.2 in node: worst coefficient disagreement 7.1e-07 over
   96 fits, every synthetic point exactly on its segment, every neighbour
   genuinely among the k nearest.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (v) => `${(100 * v).toFixed(1)}%`;

/* --- the three steps ------------------------------------------------------ */

/* Read off the two gates rather than kept as a number: the gates ARE the state,
   and a step index beside them would be a second copy of it to drift (5.8). */
const stepOf = (params) => (params.balance ? 2 : params.fit ? 1 : 0);

/* Do nothing, change the model, change the data — three times over. `plan` is
   what one Step consumes; `weights` is the only method with none.

   The `detail` lines name the mechanism and nothing else. They used to lead with
   the library function — "RandomOverSampler — minority samples copied at
   random" — which front-loads a word the reader cannot act on before the words
   that say what happens. The mapping to sklearn and imbalanced-learn lives in
   these comments, where a developer needs it and a student does not (2.9). */
const METHODS = {
  none: {
    label: "None",
    detail: "the data as collected, and the model exactly as it comes",
    step: null,
  },
  weights: {
    // class_weight="balanced"
    label: "Class weights",
    detail: "nothing added or dropped — minority samples just count more",
    step: null,
  },
  over: {
    // imblearn RandomOverSampler
    label: "Oversample",
    detail: "minority samples copied at random until the counts are even",
    step: "Copy one sample",
  },
  under: {
    // imblearn RandomUnderSampler
    label: "Undersample",
    detail: "majority samples dropped at random until the counts are even",
    step: "Drop one sample",
  },
  smote: {
    // imblearn SMOTE
    label: "SMOTE",
    detail: "new samples placed between a minority point and a neighbour",
    step: "Make one sample",
  },
};

/* --- geometry ------------------------------------------------------------- */
/* ONE function, read by both `height` and `draw`, so the two cannot drift — the
   defect that left eight of nine widgets 190-310px wrong when the number lived
   somewhere nothing read it.

   PAD_L is 44 and not a pixel less: `axisY({ label })` draws its rotated label
   at `x - 40`, so a 34px left pad puts "x₂" off the canvas — and the text sweep
   cannot see it, because a rotated string's coordinates are in the rotated frame
   and the overrun check skips them by design. */
const PAD_L = 44, PAD_R = 12, PAD_T = 22, PAD_B = 40, SIDE_MAX = 560;
const STRIP_GAP = 18, STRIP_H = 56;

const planeSide = (w) => Math.min(SIDE_MAX, Math.max(200, w - PAD_L - PAD_R));

function layoutOf(w) {
  const side = planeSide(w);
  const plane = { x: PAD_L, y: PAD_T, w: side, h: side };
  const strip = { x: PAD_L, y: PAD_T + side + PAD_B + STRIP_GAP, w: side, h: STRIP_H };
  return { plane, strip, height: strip.y + strip.h + 8 };
}

const heightFor = ({ w }) => layoutOf(w).height;

/* --- pacing --------------------------------------------------------------- */
/* PLAY'S SPEED IS THE READER'S, ON A DIAL. It used to choreograph the first six
   samples and then race — which showed the mechanism to someone who pressed Play
   without stepping, but meant the figure changed its own speed halfway through
   for reasons nothing on screen explained. A rung the reader sets says the same
   thing and says who decided it (4.1).

   Step is always the slow end and always shows every beat, whatever the dial
   says: that is what Step IS, and core's own tooltip for it already promises
   "slowly, showing every stage". */
const SLOW_MS = 1500;
const PACES = [
  { ms: 700, full: true, label: "Slow", detail: "every beat of every sample" },
  { ms: 260, full: true, label: "Steady", detail: "still shows where each sample comes from" },
  { ms: 60, full: false, label: "Quick", detail: "arrivals only — for filling the plane" },
];
const FAST_MS = PACES[PACES.length - 1].ms;

/* A UNIT'S PACE IS FIXED WHEN THE UNIT STARTS, and `draw` reads what `advance`
   stored rather than recomputing it. Widget 17 lost a whole panel to the other
   arrangement: a step left in flight when a non-choreographing speed took over
   froze it, because the two ends disagreed about how long the unit was. */
function paceFor(anim, params) {
  if (anim?.mode === "step") return { ms: SLOW_MS, full: true };
  return PACES[Number(params.pace)] ?? PACES[1];
}

const beatsOf = (ms) => ({ light: 0.30 * ms, slide: 0.75 * ms });
const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

/* --- drawing helpers ------------------------------------------------------ */

function planeFrame(ctx, colors, rect, caption) {
  const P = makePlot({ ctx, colors, rect, xDomain: M.DOMAIN, yDomain: M.DOMAIN });
  P.caption(caption);
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.restore();
  P.axisX({ ticks: [0, 2, 4, 6, 8, 10], label: "x₁" });
  P.axisY({ ticks: [0, 2, 4, 6, 8, 10], label: "x₂" });
  return P;
}

/** A real sample. `alpha` carries held-out; `scale` carries a class weight. */
function dot(ctx, colors, P, p, { alpha = 1, scale = 1, ring = 0 } = {}) {
  const cx = P.sx(p.x1), cy = P.sy(p.x2);
  const r = 3.4 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.y === M.MINORITY ? colors.event : colors.nonevent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  /* Multiplicity as a ring, the mark widget 17's bagging page uses for a
     resampled point. A copy lands EXACTLY on its parent, so without the ring
     random oversampling and doing nothing are the same picture — which is
     precisely the difference between it and SMOTE. */
  if (ring > 0) {
    ctx.strokeStyle = colors.event;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2.2 + 1.6 * Math.min(ring, 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A synthetic sample: hollow, because it is not a patient. */
function hollow(ctx, colors, P, p, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colors.event;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A case that is gone — dropped by rarity, or by undersampling. */
function ghost(ctx, colors, P, p, tone) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = tone;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The 0.5 boundary: b0 + b1 x1 + b2 x2 = 0, clipped to the square. */
function boundary(ctx, colors, P, fit, { stroke, width = 2, dash = null, alpha = 1 }) {
  const [lo, hi] = M.DOMAIN;
  const pts = [];
  if (Math.abs(fit.b2) > 1e-9) {
    for (const x of [lo, hi]) pts.push([x, -(fit.b0 + fit.b1 * x) / fit.b2]);
  } else if (Math.abs(fit.b1) > 1e-9) {
    for (const y of [lo, hi]) pts.push([-(fit.b0 + fit.b2 * y) / fit.b1, y]);
  }
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(P.x, P.y, P.w, P.h);
  ctx.clip();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(P.sx(pts[0][0]), P.sy(pts[0][1]));
  ctx.lineTo(P.sx(pts[1][0]), P.sy(pts[1][1]));
  ctx.stroke();
  ctx.restore();
}

/**
 * The plane the current line and the whole-cohort line label differently.
 *
 * A GROUND, NOT A MARK: 12% alpha, drawn before anything else, so it reads as
 * territory rather than as a shape. Its polygons come from `model.js` beside the
 * number the readout prints, so the picture and the tile cannot disagree about
 * what "the gap" is (5.8).
 */
function band(ctx, colors, P, polys) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = colors.theory;
  for (const poly of polys) {
    ctx.beginPath();
    ctx.moveTo(P.sx(poly[0][0]), P.sy(poly[0][1]));
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(P.sx(poly[i][0]), P.sy(poly[i][1]));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A key for the lines, right-aligned on the caption's own line.
 *
 * `note` and not legend rows: core builds the legend ONCE at shell time, so it
 * cannot vary — and which lines exist changes with the step. Widget 17 hit this
 * exactly, advertising two curve colours on two pages that drew neither.
 *
 * It drops below the caption when the line is full, the same rule `note()`
 * follows: every fingerprint baseline is recorded at the NARROWEST canvas the
 * side layout produces, and a key that assumes a wide one erases the caption
 * underneath while still looking like a short caption.
 */
function lineKey(ctx, colors, P, items, caption) {
  if (!items.length) return;
  const SW = 16, GAP_TEXT = 5, GAP_ITEM = 12;
  ctx.save();
  /* The caption's right edge, measured in the caption's OWN font. Core keeps it
     in a closure for `note()` and does not expose it, and reaching into core for
     one accessor is a change to a file every widget shares. */
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  const captionRight = P.x + ctx.measureText(caption).width;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const widths = items.map((it) => SW + GAP_TEXT + ctx.measureText(it.label).width);
  const total = widths.reduce((a, b) => a + b, 0) + GAP_ITEM * (items.length - 1);
  const drop = P.x + P.w - total < captionRight + 14;
  const y = drop ? P.y + 9 : P.y - 12;
  let x = P.x + P.w - total;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    ctx.strokeStyle = it.colour;
    ctx.lineWidth = it.dash ? 1.4 : 2.2;
    ctx.setLineDash(it.dash ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + SW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = it.colour;
    ctx.fillText(it.label, x + SW + GAP_TEXT, y + 0.5);
    x += widths[i] + GAP_ITEM;
  });
  ctx.restore();
}

/**
 * The counts, as `03-4` cell 71 draws them — two bars, before and after.
 *
 * Drawn rather than left to the readout because the lesson's own figure is this
 * chart, and a student arriving from that cell should recognise what they are
 * looking at before reading a word.
 */
function countStrip(ctx, colors, R, { nMaj, nMin, startMaj, startMin }) {
  const LAB = 62, ROW = 20, GAPY = 8;
  const barW = R.w - LAB - 46;
  const max = Math.max(M.N_MAJ, nMaj, nMin, startMin);
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;

  const row = (i, label, n, start, colour) => {
    const y = R.y + i * (ROW + GAPY);
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, R.x + LAB - 8, y + ROW / 2);

    ctx.fillStyle = colors.surface3;
    ctx.fillRect(R.x + LAB, y, barW, ROW);
    ctx.fillStyle = colour;
    ctx.fillRect(R.x + LAB, y, barW * (n / max), ROW);

    /* Where it started, when it has moved. A tick and not a second bar: the
       question is how far this one has travelled, not what two bars compare. */
    if (start !== n) {
      const tx = R.x + LAB + barW * (start / max);
      ctx.strokeStyle = colors.ink1;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, y - 2);
      ctx.lineTo(tx, y + ROW + 2);
      ctx.stroke();
    }
    ctx.fillStyle = colors.ink1;
    ctx.textAlign = "left";
    ctx.fillText(String(n), R.x + LAB + barW + 8, y + ROW / 2);
  };

  row(0, "majority", nMaj, startMaj, colors.nonevent);
  row(1, "minority", nMin, startMin, colors.event);
  ctx.restore();
}

/* --- how far the plan has run, and what that leaves ----------------------- */

/* `anim.k` entries applied, plus the one in flight. Every part of the figure
   reads the data through this, so the picture, the counts and the readout cannot
   disagree about how many samples exist (5.8). */
function shownState(state, params, anim) {
  const plan = state.plan;
  const k = clamp(anim?.k ?? 0, 0, plan.length);
  const inFlight = anim?.phase === "make" ? plan[k] : null;
  const u = inFlight ? clamp((anim.t ?? 0) / (anim.ms || FAST_MS), 0, 1) : 0;

  const dropped = new Set();
  const copies = new Map();
  const made = [];
  for (let i = 0; i < k; i += 1) {
    const e = plan[i];
    if (e.drop !== undefined) dropped.add(e.drop);
    else if (params.method === "over") copies.set(e.parent, (copies.get(e.parent) ?? 0) + 1);
    else made.push(e);
  }
  return {
    k, plan, inFlight, u, dropped, copies, made,
    full: Boolean(anim?.full),
    ms: anim?.ms ?? FAST_MS,
  };
}

const fitIndex = (state, anim) => clamp(anim?.k ?? 0, 0, state.fits.length - 1);

/* --- the figure ----------------------------------------------------------- */

/* THE RULE IS IN THE CAPTION, NOT BESIDE IT. Everything a method does — copying,
   dropping, inventing — happens to the training data, and every number
   underneath comes from held-out patients no method ever touched. That has to be
   on screen at the step where it can be got wrong.

   It was a `note` first, and the text sweep failed 105 states: `note()` and the
   line key BOTH right-align on the caption's baseline and neither knows the
   other exists, so they overlapped by up to 64 px — and because a note strokes
   surface-coloured before it fills, the collision ERASES what it overruns and
   still looks like a short caption. Folding it into the caption leaves exactly
   one right-aligned thing on that line, so the class of collision is gone rather
   than tuned. */
const CAPTIONS = [
  "the cohort, and the cases we did not collect",
  "the cases we have, and where the model cuts them",
  "the training data — held-out patients are never balanced",
];

function drawFigure(ctx, colors, L, params, state, anim) {
  const at = stepOf(params);
  const S = shownState(state, params, anim);
  const caption = CAPTIONS[at];
  const P = planeFrame(ctx, colors, L.plane, caption);
  const weighted = at === 2 && params.method === "weights";
  const now = state.fits[fitIndex(state, anim)];

  /* No lines on the first step. It is the cohort and what rarity takes from it,
     and a boundary there would answer a question nobody has asked yet — the
     figure would open on its own conclusion (invariant 4). */
  if (at > 0) band(ctx, colors, P, M.disagreementRegion(now, state.whole));

  /* The cases the dial threw away, drawn only where that IS the subject. Kept on
     later steps they would be 142 faint rings behind a band, three lines and a
     hundred synthetic points; the dots simply vanishing is feedback enough once
     the reader has seen it happen. */
  if (at === 0) for (const p of state.lost) ghost(ctx, colors, P, p, colors.event);

  state.pts.forEach((p, i) => {
    if (S.dropped.has(i)) { ghost(ctx, colors, P, p, colors.reference); return; }
    dot(ctx, colors, P, p, {
      scale: weighted ? Math.sqrt(state.weights[p.y]) : 1,
      ring: S.copies.get(i) ?? 0,
    });
  });
  for (const e of S.made) hollow(ctx, colors, P, e);
  if (S.inFlight) drawInFlight(ctx, colors, P, state, S, S.full);

  const key = [];
  if (at > 0) {
    boundary(ctx, colors, P, state.whole, { stroke: colors.theory, width: 2 });
    key.push({ colour: colors.theory, label: "whole cohort" });
    if (at === 2 && params.method !== "none") {
      boundary(ctx, colors, P, state.baseFit, {
        stroke: colors.reference, width: 1.4, dash: [5, 4], alpha: 0.85,
      });
      key.push({ colour: colors.reference, label: "before", dash: true });
    }
    boundary(ctx, colors, P, now, { stroke: colors.highlight, width: 2.4 });
    key.push({ colour: colors.highlight, label: "now" });
  }
  lineKey(ctx, colors, P, key, caption);

  countStrip(ctx, colors, L.strip, countsOf(state, params, S));
}

/**
 * The sample being made, mid-flight.
 *
 * `full` asks for every beat — the k neighbours lit, the chosen segment, the new
 * point sliding along it. At 70 ms a beat is not something anyone can read, so
 * the fast units get only the arrival.
 */
function drawInFlight(ctx, colors, P, state, S, full) {
  const e = S.inFlight;
  /* The unit's OWN duration, stored by `advance`. Recomputing it here from the
     mode is how the two ends of one animation come to disagree. */
  const dur = S.ms;
  const B = beatsOf(dur);
  const t = S.u * dur;

  if (e.drop !== undefined) {
    const p = state.pts[e.drop];
    ctx.save();
    ctx.globalAlpha = 1 - S.u;
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.4 + 6 * S.u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const parent = state.pts[e.parent];
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.fillStyle = colors.highlight;

  if (full) {
    /* Beat one: the parent, and every candidate neighbour. Beat two: only the
       one chosen, as the new point slides along it. */
    const near = state.neighbours.get(e.parent) ?? [];
    const fade = t < B.light ? easeOut(t / B.light) : 1;
    ctx.globalAlpha = 0.45 * fade;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const j of near) {
      if (j === e.neighbour && t >= B.light) continue;
      ctx.beginPath();
      ctx.moveTo(P.sx(parent.x1), P.sy(parent.x2));
      ctx.lineTo(P.sx(state.pts[j].x1), P.sy(state.pts[j].x2));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    /* A RANDOM COPY HAS NO NEIGHBOUR, and this line threw on it. `overPlan`
       entries carry a `parent` and nothing else, so `state.pts[e.neighbour]` was
       `state.pts[undefined]` and reading `.x1` off it killed the frame — only in
       slow motion, only for Oversample, so the settled text sweep could not see
       it. Having no segment to draw IS the difference between a copy and a SMOTE
       sample: one lands on top of a patient, the other between two. */
    const q = e.neighbour === undefined ? null : state.pts[e.neighbour];
    if (q && t >= B.light) {
      ctx.beginPath();
      ctx.moveTo(P.sx(parent.x1), P.sy(parent.x2));
      ctx.lineTo(P.sx(q.x1), P.sy(q.x2));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(P.sx(parent.x1), P.sy(parent.x2), 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* The new point travels from the parent to its place on the segment over the
     same `t` the segment was drawn in, so the dot cannot arrive before its
     line (5.8). */
  const slide = full ? clamp((t - B.light) / (B.slide - B.light), 0, 1) : 1;
  const x1 = parent.x1 + (e.x1 - parent.x1) * (full ? easeOut(slide) : 1);
  const x2 = parent.x2 + (e.x2 - parent.x2) * (full ? easeOut(slide) : 1);
  ctx.globalAlpha = full ? 1 : S.u;
  ctx.beginPath();
  ctx.arc(P.sx(x1), P.sy(x2), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}


/** Counts at the current step, for the strip and the readout. */
function countsOf(state, params, S) {
  const added = params.method === "over" || params.method === "smote" ? S.k : 0;
  const removed = params.method === "under" ? S.k : 0;
  return {
    startMaj: state.startMaj,
    /* On the first step the tick marks where the minority STARTED, so the dial
       reads as a loss. After that the sample is the sample. */
    startMin: stepOf(params) === 0 ? M.N_MIN_POOL : state.startMin,
    nMaj: state.startMaj - removed,
    nMin: state.startMin + added,
  };
}

/* --- the widget ----------------------------------------------------------- */

defineWidget({
  slug: "balancing-data",
  title: "Balancing Data",
  /* THE TASK, IN THE FIRST CLAUSE. The widget scores the model on finding the
     rare outcome, so it has to say that before it says anything else — a reader
     who does not know which class is being detected cannot read a single tile
     below the figure. Shorter than what it replaced. */
  subtitle:
    "The job is to find the minority outcome. Start from a cohort with both, keep only some of "
    + "the cases you managed to collect, and watch four corrections pull the boundary back "
    + "towards where all of them put it.",
  status: "shipped",
  layout: "side",
  height: heightFor,

  /* THE THIRD ACTION NEEDS THE THIRD WORD. Play runs the balancing, a gate says
     "Back to...", and this one closes every gate and returns to the cohort — so
     it says so. A bare "Reset" beside those two is the vague label the usability
     literature warns about. */
  resetLabel: "Start over",
  resetTitle: "Close every step and go back to the whole cohort",

  params: {
    /* THE DIAL STARTS AT ALL OF THEM, so the widget opens on a balanced cohort
       and the reader makes the outcome rare themselves. A `choice` and not a
       slider of its own: the options form a magnitude, so left-to-right carries
       the meaning (3.3). */
    keep: {
      type: "choice",
      label: "Cases kept",
      options: M.KEEPS.map((v, i) => {
        const n = M.keptCount(v);
        return {
          value: String(i),
          label: `${Math.round(v * 100)}%`,
          detail: v === 1
            ? `all ${n} — every case in the cohort was collected`
            : `${n} of ${M.N_MIN_POOL} collected — the training set is now one in `
              + `${Math.round((10 * (M.N_MAJ + n)) / n) / 10}`,
        };
      }),
      default: "0",
    },
    /* EVERY OTHER WIDGET IN THE COLLECTION HAS ONE AND THIS DID NOT, which is
       an oversight worth naming rather than quietly fixing: it is the control
       that turns "how stable is this?" from a claim into something a reader can
       check by pressing a button.

       It earns its place here twice over. Undersampling's cost in this stage is
       NOT a lower average — it is a wider one. Over 60 seeds at 5% collected,
       F1 is 0.806 ± 0.049 for undersampling against 0.814 ± 0.028 for class
       weights: the same answer, arrived at far less reliably. Nothing on a
       single figure can show that, and moving this dial can. */
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 200,
      default: 1,
      detail: "a different draw of the same cohort — how far does the answer move?",
    },
    /* TWO GATES, AND THE RAIL GROWS DOWNWARD. Each sits exactly where its stage
       begins, with a divider above and the controls it reveals beneath — which
       is what makes the sequence read as one thing accumulating rather than as
       three places to be. `labelOff` is the way back out of a step, and it names
       where it goes rather than saying "Hide". */
    fit: {
      type: "gate",
      label: "Fit a model",
      labelOff: "Back to the cohort",
      detail: "and compare it with the line the whole cohort gives",
    },
    balance: {
      type: "gate",
      label: "Try a balancing method",
      labelOff: "Back to the plain fit",
      detail: "four corrections, every one of them on the training data only",
      when: { param: "fit" },
    },
    method: {
      type: "segmented",
      label: "Balancing",
      options: Object.entries(METHODS).map(([value, m]) => ({
        value, label: m.label, detail: m.detail,
      })),
      default: "none",
      when: { param: "balance" },
    },
    /* Gated on the METHOD, because only SMOTE has neighbours to choose from. Its
       documented trade-off, measured: at a 10% minority the share of new samples
       whose nearest real neighbour is a majority patient runs 17.8% at k = 1 to
       31.2% at k = 5. */
    k: {
      type: "choice",
      label: "k — neighbours to choose from",
      options: M.K_OPTIONS.map((v, i) => ({
        value: String(i),
        label: String(v),
        detail: v === 1
          ? "1 — always the nearest, so new samples hug the real ones"
          : v === 3
            ? "3 — a short list, so new samples stay close in"
            : "5 — the usual choice, between close in and far out",
      })),
      default: "2",
      when: { param: "method", equals: "smote" },
    },
    /* A DISPLAY parameter: changing the speed must not throw away the samples
       the reader has already made. It takes effect at the next sample, because
       `advance` fixes a unit's duration when the unit starts. */
    pace: {
      type: "choice",
      label: "Play speed",
      options: PACES.map((p, i) => ({ value: String(i), label: p.label, detail: p.detail })),
      default: "1",
      display: true,
      when: { param: "balance" },
    },
    shown: { type: "int", label: "Shown", min: 0, max: 400, default: 0, hidden: true },
  },

  /* Only what is true at every step. Which LINES exist changes as the story
     runs, so they are named by the panel's own key instead. */
  legend: [
    { token: "nonevent", label: "Majority class", mark: "dot" },
    { token: "event", label: "Minority class — the one to find", mark: "dot" },
  ],

  compute({ params, rng }) {
    const at = stepOf(params);
    const keep = M.KEEPS[Number(params.keep)];
    const k = M.K_OPTIONS[Number(params.k)];
    const kept = M.keptCount(keep);
    const share = M.shareOf(keep);

    const { maj, min } = M.makeCohort(rng);
    const pts = maj.concat(min.slice(0, kept));
    const lost = min.slice(kept);
    /* THE HELD-OUT WORLD DOES NOT MOVE WITH THE DIAL, and that is the whole
       difference between two stories the widget could tell.

       It used to be `makeTest(rng, share)` — the test set got rarer along with
       the training set, as if the disease itself had become uncommon. Then
       balancing recovers the BOUNDARY but can never recover the SCORE, because
       F1's ceiling falls with prevalence: 0.836 at 100% kept down to 0.328 at
       5%. Every method landed exactly on that sliding ceiling and the figure
       still read as "balancing does not work". Reported as exactly that.

       The story the dial actually tells is the other one: the outcome is as
       common as it ever was, and we only managed to COLLECT some of the cases.
       So the world is the cohort's own 50/50, fixed, and the ceiling is one
       number at every rung. Measured, 40 seeds, F1:

         kept   ceiling    none    balanced
         100%    0.836     0.836   0.836
          50%    0.836     0.791   0.835 - 0.836
          25%    0.836     0.688   0.831 - 0.834
          10%    0.836     0.442   0.818 - 0.826
           5%    0.836     0.268   0.802 - 0.810

       Balancing now visibly recovers what the missing cases cost, and the gap
       left at the sparse end is the honest second lesson: it cannot invent cases
       nobody collected.

       THIS IS A SAMPLING IMBALANCE, NOT A PREVALENCE ONE, and the distinction is
       real. When a class is genuinely rare, rebalancing to 50/50 throws away a
       correct prior and the fix is a threshold, not a resample — that belongs to
       arc B's `imbalance-metrics`. The subtitle says "collect" for this reason. */
    const test = M.makeTest(rng, 0.5);

    /* THE LINE THE WHOLE COHORT GIVES — the reference every later step measures
       against, and the answer to "is that the ground truth?": it is not the
       truth, it is the line you get when you have every case, and the reader saw
       that cohort before they moved the dial. */
    const whole = M.fitLogistic(maj.concat(min));

    const method = at === 2 ? params.method : "none";
    let plan = [];
    if (method === "over") plan = M.overPlan(pts, rng);
    else if (method === "under") plan = M.underPlan(pts, rng);
    else if (method === "smote") plan = M.smotePlan(pts, Math.min(k, kept - 1), rng);

    const weights = M.balancedWeights(pts);

    /* A FIT PER STEP, precomputed. `compute` runs on parameter change only
       (invariant 3), so the animation is a reveal of fits that already exist and
       the boundary at step k is the boundary a student would get by stopping
       there. 140 fits of three parameters is a few tens of milliseconds. */
    const fits = [];
    const live = [];
    const drop = new Set();
    const push = () => {
      const set = pts.filter((_, i) => !drop.has(i)).concat(live);
      fits.push(M.fitLogistic(set, { weights: method === "weights" ? weights : null }));
    };
    push();
    for (const e of plan) {
      if (e.drop !== undefined) drop.add(e.drop);
      else live.push({ x1: e.x1, x2: e.x2, y: M.MINORITY });
      push();
    }

    const neighbours = method === "smote"
      ? M.minorityNeighbours(pts, Math.min(k, kept - 1)).neighbours
      : new Map();

    /* Always unweighted, always on the whole sample: the line and the numbers the
       reader compares against. `fits[0]` cannot serve — under class weights it is
       already the weighted fit. */
    const baseFit = M.fitLogistic(pts);

    return {
      pts, test, plan, fits, weights, neighbours, lost, whole, baseFit,
      kept, startMaj: M.N_MAJ, startMin: kept,
      baseScore: M.score(baseFit, test),
      baseGap: M.disagreement(baseFit, whole, test),
      wholeScore: M.score(whole, test),
      scores: fits.map((f) => M.score(f, test)),
      /* Measured over the SAME held-out set as recall and precision. One
         population for every number on the page, so a reader comparing two tiles
         is comparing two readings of one thing (5.8). */
      gaps: fits.map((f) => M.disagreement(f, whole, test)),
    };
  },

  animation: {
    stepLabel: {
      param: "method",
      labels: Object.fromEntries(
        Object.entries(METHODS).filter(([, m]) => m.step).map(([v, m]) => [v, m.step])),
      default: "Nothing to change",
    },

    init: ({ params, state, fromScratch }) => {
      const head = fromScratch ? 0 : Math.max(0, Number(params.shown) || 0);
      const k = Math.min(head, state.plan.length);
      return {
        k, phase: "idle", t: 0, ms: FAST_MS, full: false,
        done: k >= state.plan.length,
        /* THE WIDGET SAYS WHEN THERE IS NOTHING TO DRIVE and core removes Step
           and Play from the row. One rule covers both cases the reader meets:
           the two steps before balancing, and the two methods that change no
           data. */
        inert: state.plan.length === 0,
      };
    },

    advance(anim, { dt, params, state }) {
      if (anim.k >= state.plan.length) { anim.done = true; return false; }
      if (anim.phase === "idle") {
        const pace = paceFor(anim, params);
        anim.phase = "make";
        anim.t = 0;
        anim.ms = pace.ms;
        anim.full = pace.full;
      }
      anim.t += dt;
      if (anim.t >= anim.ms) {
        anim.k += 1;
        anim.phase = "idle";
        anim.t = 0;
        anim.done = anim.k >= state.plan.length;
        return anim.mode === "run" && !anim.done;
      }
      return true;
    },

    /* A shorter plan has to clamp the cursor: one past the end draws nothing and
       reads as a blank figure. */
    rebuild: (anim, { state }) => {
      const k = Math.min(anim.k, state.plan.length);
      return { ...anim, k, done: k >= state.plan.length, inert: state.plan.length === 0 };
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    drawFigure(ctx, colors, layoutOf(w), params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    const at = stepOf(params);
    const S = shownState(state, params, anim);
    const c = countsOf(state, params, S);

    if (at === 0) {
      const whole = state.kept === M.N_MIN_POOL;
      return [
        { label: "Cases kept", value: `${state.kept} of ${M.N_MIN_POOL}`,
          note: whole ? "the cohort as collected" : `${M.N_MIN_POOL - state.kept} thrown away — the dashed outlines` },
        { label: "The cohort is now", value: `${c.nMaj} : ${c.nMin}`,
          note: "the majority never moves" },
        { label: "One patient in", value: String(Math.round((10 * (c.nMaj + c.nMin)) / c.nMin) / 10),
          note: "how often the outcome turns up" },
      ];
    }

    const sc = state.scores[fitIndex(state, anim)];
    const w = state.wholeScore;
    const rare = sc.tp + sc.fn;

    /* THREE TILES, ALL AGAINST ONE FIXED REFERENCE: what the whole cohort
       achieves on the same unchanging world. The accuracy tile went with the
       sliding test set — on a world that stays 50/50 it tracks F1 to within a
       few thousandths and says the same thing twice. Its old job, "99% accuracy
       by predicting the rare outcome away", needs an IMBALANCED test set to
       fire, and that is arc B's `imbalance-metrics`, not this widget's subject.

       Measured, 40 seeds, at 25% of cases collected: F1 0.688 -> 0.831-0.834
       against a ceiling of 0.836, and accuracy 0.749 -> 0.830-0.832 against
       0.834. Two numbers, one story, so the readout keeps one. */
    const tiles = [
      { label: "Minority cases caught", value: `${sc.tp} of ${rare}`,
        note: `${w.tp} of ${rare} if every case had been collected` },
      { label: "False alarms", value: String(sc.fp),
        note: `majority patients flagged; ${w.fp} with every case` },
      { label: "F1", value: sc.f1.toFixed(3),
        note: `for the minority class; ${w.f1.toFixed(3)} with every case collected` },
    ];
    if (at === 2 && params.method !== "none") {
      const drops = params.method === "under";
      tiles.push({
        label: drops ? "Samples dropped" : "Samples added",
        value: params.method === "weights" ? "none" : `${S.k} of ${state.plan.length}`,
        note: params.method === "weights"
          ? "the model reweights instead"
          : `the training counts are ${c.nMaj} : ${c.nMin}`,
      });
    }
    return tiles;
  },
});
