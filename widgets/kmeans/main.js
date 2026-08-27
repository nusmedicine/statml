/* ============================================================================
   K-Means.

   Host: PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 51-59. The
   plan and every measurement behind the constants here are in
   docs/catalogue.md § NEXT · K-Means.

   THE LAYOUT IS CELL 52'S OWN DIAGRAM: samples are dots and centroids are
   crosses; the dots are colourless until something assigns them; a centroid
   that has just moved leaves a ghost at where it was with a dotted line to
   where it went; and the arrow looping from Update back to Assign is what the
   Iterate button is.

   The algorithm is `./model.js`, checked against sklearn 1.9.0 exactly — same
   labels, inertia to 7.1e-15 (`_lab/kmeans-verify.mjs`). NOTHING ITERATES ON
   SCREEN: `compute` runs Lloyd to convergence before the first frame is drawn
   and the animation walks the recorded run, which is invariant 2.
   ========================================================================= */

import { defineWidget, makeRng, fmt } from "../core/index.js";
import {
  lloyd, forgy, silhouette, adjustedRand, blobs, spreadFor,
} from "./model.js";

/* K STOPS AT SIX BECAUSE THE TOKENS FILE DEFINES SIX CLUSTER COLOURS and a
   seventh cluster would have to borrow one, which would say two clusters are
   the same thing. Widget 22 took the same ceiling for the same reason. */
const K_MAX = 6;

const PLACE_MS = 520;      /* the centroids appearing */

/* PACING IS CHOSEN, NOT AUTOMATIC, and whether the spokes are drawn is a
   declared property of the chosen speed rather than something the animation
   decides mid-run. `web` is the assignment being WORKED OUT — each centroid
   reaching for the points it is about to claim — and past a certain pace there
   is no time to read it, so it is dropped rather than flickered. */
const SPEEDS = {
  slow: { label: "Slow", detail: "each centroid reaches for the points it claims", assign: 1800, update: 1300, web: true },
  medium: { label: "Medium", detail: "the same, quicker", assign: 900, update: 750, web: true },
  fast: { label: "Fast", detail: "no spokes — colours and centroids only", assign: 280, update: 400, web: false },
};

/* ONE PRESS OF ITERATE ALWAYS RUNS THE FULL CHOREOGRAPHY, whatever Play is set
   to: its whole job is to show the mechanism, and a fast single step is
   useless. `bootstrap` settled the same question the same way. */
const STEP_PACE = { assign: 1500, update: 1050, web: true };
const paceFor = (params, anim) =>
  (anim.mode === "step" ? STEP_PACE : SPEEDS[params.speed] ?? SPEEDS.medium);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
/* K = 1 is a legal setting and "1 clusters" reached the accessible label. */
const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/* --- layout ----------------------------------------------------------------
   One function, read by both `height` and `draw`, so the two cannot drift.

   ONE PANEL, AND A SECOND ONE WAS BUILT TWICE AND CUT TWICE. First a strip
   plotting the objective and the silhouette against every K at once, which
   handed over the answer to the widget's own question; then one that plotted
   only the K the reader had taken to convergence, which fixed that and was
   still cut — **it asks the reader to hold two things at once, and reading a
   number off a tile after each run is the same lesson with less to carry.**
   docs/catalogue.md § REVIEW ROUND 2 has the argument and keeps the
   measurements, which stand whatever the panel does. */
const PAD = 16, TOP = 30, BOT = 16;
const STAGE_MAX = 400;

function layout(w) {
  const side = Math.max(140, Math.min(STAGE_MAX, w - 2 * PAD));
  const x0 = Math.max(PAD, (w - side) / 2);
  return { stage: { x: x0, y: TOP, w: side, h: side }, height: TOP + side + BOT };
}

/* --- marks -----------------------------------------------------------------
   Local rather than in `core/canvas.js`. `plot.dot` saves and restores per
   point, which every scatter widget here has found too slow at this density,
   and NOTHING ELSE IN THE COLLECTION DRAWS A CENTROID — `canvas.js` says a
   single consumer does not decide a seam, so the cross stays here until a
   second widget wants one. Promoting it later costs a full fingerprint run. */

function sampleDot(ctx, colors, x, y, col, r = 4.6) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
}

/** A centroid. Drawn twice — a thick stroke in the surface colour underneath,
    so it stays a cross where it sits on top of its own points. */
function centroidCross(ctx, colors, x, y, col, { r = 9, width = 3.4 } = {}) {
  ctx.save();
  ctx.lineCap = "round";
  for (const [stroke, lw] of [[colors.surface, width + 3.4], [col, width]]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();
  }
  ctx.restore();
}

function text(ctx, colors, s, x, y, col, size, align = "left", base = "middle") {
  ctx.save();
  ctx.fillStyle = col;
  ctx.font = `${size} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** The bare L of cell 52's diagram: no ticks and no numbers, because the
    coordinates are not what K-Means is about — distances between points are. */
function axesL(ctx, colors, r) {
  const x0 = r.x + 0.5, y1 = r.y + r.h - 0.5, x1 = r.x + r.w - 0.5, y0 = r.y + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.fillStyle = colors.axis;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0 + 6); ctx.lineTo(x0, y1); ctx.lineTo(x1 - 6, y1);
  ctx.stroke();
  for (const [hx, hy, dx, dy] of [[x0, y0, 0, 1], [x1, y1, 1, 0]]) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - dy * 4 - dx * 7, hy - dx * 4 - dy * 7);
    ctx.lineTo(hx + dy * 4 - dx * 7, hy + dx * 4 - dy * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const groupCol = (colors, g) => colors.clusters[g % colors.clusters.length];

/** The last assignment made strictly before frame `idx`, or null if none has
    been made yet. What a dot is coloured by, and what "changed cluster" is
    measured against. */
function labelsBefore(steps, idx) {
  for (let j = idx - 1; j >= 0; j -= 1) if (steps[j].kind === "assign") return steps[j].labels;
  return null;
}

defineWidget({
  slug: "kmeans",
  title: "K-Means",
  subtitle: "Say how many clusters to look for. Each cross is a centroid: it claims the points nearest it, then moves to their mean, and the two steps repeat until no point changes hands.",
  status: "shipped",
  layout: "side",
  height: ({ w }) => layout(w).height,

  /* The ring that marked a point as having changed hands is gone — reported as
     clutter, and rightly: on the FIRST assignment every point has changed, so
     it drew a ring on all 48 at once. The spokes say the same thing while the
     assignment is being made, and the caption counts them. */
  legend: [
    { token: "unknown", label: "Not assigned yet", mark: "dot" },
    { token: "cluster-a", label: "The cluster it was given", mark: "dot" },
  ],

  params: {
    /* THREE BLOCKS, AND THE FIRST TWO EARN THEIR DIVIDER. `seed` and `start`
       are both "roll it again" dials and the widget is unreadable if they look
       like one thing: one changes the DATA and the other changes only where
       the centroids begin. That distinction is the third limitation the lesson
       names, and a reader who cannot see which dial they turned cannot learn
       it. Measured on the default stage, 15 of 60 starts on IDENTICAL points
       converge somewhere else. */
    data: { type: "section", label: "The data" },

    /* FOUR BY DEFAULT, AND IT USED TO BE SIX. Six makes the `start` lesson
       loudest — 33 of 60 starts on identical points land somewhere else,
       against 15 at four — but it puts the truth AT the top of the K slider,
       so a reader walking K sees both scores improve all the way to the end
       and learns the opposite of the lesson. Four leaves room above it:

              K        1     2     3     4     5     6
              SS    49.2  27.0  13.2   3.8   3.2   2.5     never rises
              sil      —  0.45  0.57  0.70  0.61  0.57     turns over at 4
              ARI   0.00  0.48  0.70  1.00  0.91  0.84

       That divergence past K = 4 is the whole sentence, and it is on the
       slider rather than in a caption. Six is one click away for anyone who
       wants the start lesson at full strength. */
    /* PAIRED ONTO ONE ROW WITH `samples`, and the pair is not arbitrary: both
       describe the stage, so a flex row saying they are siblings is true. The
       rail was 776px of controls against a 446px figure, which put Play 808px
       down a column beside a stage that ended at 446 — measured, drawn and
       chosen from in `_lab/kmeans-rail.html`.

       THE LABELS ARE UNTOUCHED, and that is a measurement rather than an
       oversight. Cutting them to fit the half-width was built and dropped: at
       144px every full-length label already sits on one 18px line, so the
       shortened rail came out identical to the pixel. A real cost — a detail
       is read less than a label — for a saving of zero. */
    groups: {
      type: "choice",
      label: "Groups in the data",
      options: [2, 3, 4, 6].map((v) => ({ value: String(v), label: String(v) })),
      default: "4",
      row: { key: "stage" },
    },
    /* Twelve, so the default stage is 48 samples whatever `groups` says about
       how they are split — the scale every other widget in the arc uses. */
    samples: {
      type: "choice",
      label: "Samples per group",
      options: [4, 8, 12].map((v) => ({ value: String(v), label: String(v) })),
      default: "12",
      row: { key: "stage" },
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1, detail: "draws different samples" },

    /* OFF BY DEFAULT, so the reader reads the clusters off the picture before
       being told what was really there — the notebook's own order, and
       non-negotiable 4 applied to knowledge rather than to the figure. It is
       also what gates the ARI tile: scoring an answer against the truth is not
       available to someone who has not asked to see the truth.

       IT SITS WITH THE DATA rather than with the playback controls, which is
       where it started. What the groups really were is a fact about the
       samples, not a way of looking at them — the only thing display-ish about
       it is that revealing it must not throw the run away. */
    labels: {
      type: "segmented",
      label: "True groups",
      options: [
        { value: "off", label: "Off", detail: "can you tell how many there were?" },
        { value: "on", label: "On", detail: "colour ring shows the group each sample came from" },
      ],
      default: "off",
      display: true,
    },

    fit: { type: "section", label: "K-Means" },

    /* THE ONE NUMBER THE METHOD CANNOT WORK OUT FOR ITSELF, and the reader has
       to supply it before anything happens. It opens MATCHING the stage, so
       the first run shows the mechanism working — a widget rigged to fail on
       the first press teaches distrust of the widget, not of the method. The
       lesson is what happens when the reader moves it, in either direction.
       One is a legal setting and is the left end: the whole data as one
       cluster, which is where the objective starts. */
    /* A DATA PARAMETER, and it was briefly a display one. The tracked graph
       needed it to be display — the record lived in `anim`, which a data change
       re-inits — and when the graph went, so did the reason. Data is what it
       should be: a new K is a new model, and starting the run over is honest. */
    k: {
      type: "int",
      label: "Clusters to look for (K)",
      min: 1,
      max: K_MAX,
      default: 4,
      detail: "n_clusters",
      row: { key: "fitrow" },
    },

    /* SEPARATE FROM `seed` ON PURPOSE, and this was found by building rather
       than by planning: one seed feeding both the samples and the starting
       centroids moves two things at once, so a reader who presses it and gets
       a different clustering cannot tell whether the data changed or the start
       did — on a control whose entire job is to show that the START matters.

       TWO, AND THE VALUE IS CHOSEN RATHER THAN INCIDENTAL. At the defaults it
       takes four iterations and lands on the true groups, so the first run has
       a loop worth watching AND is right; start 1 takes two, and start 4 is one
       of the fifteen in sixty that converge somewhere else. Two nudges from the
       default finds the lesson, which is the distance the reconnaissance asked
       for: something a reader discovers by pressing a button twice. */
    start: {
      type: "int",
      label: "Centroid start",
      min: 1,
      max: 60,
      default: 2,
      detail: "same samples, different random placement",
      row: { key: "fitrow" },
    },

    /* `n_init`, AND IT IS THE CURE FOR THE CONTROL ABOVE IT. Lloyd's algorithm
       lands in a local optimum decided by where it started; running it again
       from a fresh start and keeping the lowest sum of squares is the standard
       defence, and it is what `sklearn` does for you — `n_init="auto"`, the
       default since 1.4, resolves to 10 for `init="random"`, which is the init
       this widget runs. (It resolves to 1 for k-means++, so the notebook's own
       `KMeans(n_clusters=2, random_state=42)` gets a single start.)

       ONE BY DEFAULT, because ten hides the lesson the control above teaches.
       Measured on the default stage over 60 starts: at one, 15 land somewhere
       else and the silhouette peaks at the wrong K on 15 of 60 walks; at ten,
       0 and 0.

       Both values draw from the SAME stream, so the ten starts BEGIN with the
       one start — switching to ten can improve the answer or leave it exactly
       where it was, never move it somewhere unrelated. A reader whose picture
       does not change has learnt something true: their start was already the
       best of ten. */
    restarts: {
      type: "segmented",
      label: "Starts to try",
      options: [
        { value: "1", label: "1", detail: "n_init = 1 — you keep whatever that one start gives you" },
        { value: "10", label: "10", detail: "n_init = 10 — ten starts, and only the lowest sum of squares is kept" },
      ],
      default: "1",
    },

    /* GOVERNS PLAY, NOT ITERATE. See `STEP_PACE`: one press of Iterate always
       runs the full choreography, so a reader can study the mechanism at any
       setting and the speed only decides how much of it survives a run to
       convergence.

       BELOW THE DRIVE ROW, on `afterDrive`, and it is the same argument: this
       is the one control here that means nothing until you have pressed
       something, so it belongs under the button it governs rather than above
       it. 3.4e fixes the drive row as the last thing you SET before pressing;
       a pace is not that. It also takes 160px out from between the reader and
       Play, which is what the whole change is for — the "Watching" divider
       went with it, since a heading over one control below the buttons is
       furniture. */
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 200, default: 0, hidden: true },
  },

  /* THE WHOLE RUN, to convergence, before a single frame is drawn — invariant
     2, and here it is nearly free: one fit at n = 48 is about 20 microseconds.

     The start comes from its OWN stream rather than from `rng`, which the stage
     has already drawn from. That is what lets `seed` and `start` be two
     separate controls: the same `seed` gives the same 48 points whatever
     `start` is, so a reader who changes the start knows the data did not move
     under them. `+ K` in the seed keeps each K's start independent, so moving K
     is not also a re-roll. */
  compute({ params, rng }) {
    const groups = Number(params.groups);
    const per = Number(params.samples);
    const stage = blobs(rng, { groups, per });
    const X = stage.map((s) => s.p);
    const y = stage.map((s) => s.g);

    /* FORGY — K of the observations, uniformly at random — and NOT k-means++,
       which is what sklearn runs by default. Two reasons, and they agree:

       It is cell 52's own step 1, verbatim: "Choose K cluster centres
       (centroids) randomly". The lead button says the centroids are placed at
       random and k-means++ would make that a half-truth, since it deliberately
       spreads them apart. The widget draws the algorithm the lesson writes;
       `sklearn`'s own `init="random"` is this.

       And k-means++ starts so well on separated blobs that it converges in ONE
       iteration at these defaults — the loop the whole widget is about would be
       over before the reader saw it. Forgy averages 3 iterations here against
       1.8, and it makes the start matter: 15 of 60 starts land somewhere else
       against k-means++'s 10. */
    /* `+ params.k` inside the seed keeps each K's start independent, so moving
       K is not also a re-roll — two readers comparing K = 3 with K = 4 are
       comparing the models and not two different rolls of the dice.

       ONE STREAM FOR ALL THE RESTARTS, which is what makes `restarts` legible:
       the ten starts BEGIN with the one start, so switching from 1 to 10 can
       lower the sum of squares or leave the picture exactly where it was, and
       can never land somewhere unrelated. `sklearn` keeps the lowest inertia
       and discards the rest; so does this. */
    const irng = makeRng(params.start * 1000 + params.k);
    let run = null;
    for (let t = 0; t < Number(params.restarts); t += 1) {
      const attempt = lloyd(X, params.k, { init: forgy(X, params.k, irng) });
      if (!run || attempt.inertia < run.inertia) run = attempt;
    }

    /* A square window, so a round cluster is drawn round. The stage is built on
       a circle of radius 1 with a spread that scales with the gap between
       neighbours (`spreadFor`), so three standard deviations of margin covers
       every draw without the picture breathing as the seed changes. */
    const span = 1 + 3 * spreadFor(groups);

    return { X, y, run, span, groups, per, tries: Number(params.restarts) };
  },

  animation: {
    /* CELL 52'S FOUR NUMBERED STEPS, one per button. Step 1 happens once, so it
       is the lead action and greys itself out; steps 2 and 3 are the pair that
       repeats, so they are one press of Iterate; step 4 is the loop, which is
       Play. Splitting Iterate into two buttons was considered and dropped: the
       diagram's arrow loops around BOTH, and the two beats are named on the
       figure as they happen. */
    leadLabel: "Place the centroids",
    leadTitle: "Step 1 — put K centroids on the data at random",
    stepLabel: "Iterate",
    stepTitle: "Steps 2 and 3 — give every point to its nearest centroid, then move each centroid to the mean of the points it got",
    runLabel: "Play",
    runTitle: "Step 4 — repeat until no point changes hands",

    init: ({ params, state, fromScratch, leadDone }) => {
      const total = state.run.steps.length - 1;
      const pre = fromScratch ? 0 : Math.max(0, Math.min(params.shown | 0, total));
      const placed = Boolean(leadDone) || pre > 0;
      return {
        leadDone: placed,
        place: placed ? 1 : 0,
        i: pre,
        t: 1,
        moving: false,
        done: placed && pre >= total,
      };
    },

    /* No `rebuild`. The display parameters are `labels` and `speed`, and
       neither changes anything the animation derives — core keeps `anim` as it
       is, which is what a display change is supposed to do. `k` is data, so it
       re-inits, which is right: a new K is a new model. */

    advance(anim, { dt, params, state }) {
      const steps = state.run.steps;
      const total = steps.length - 1;
      const pace = paceFor(params, anim);

      /* The lead: the crosses fade up on the data that was already there. */
      if (!anim.leadDone) {
        anim.place = clamp01(anim.place + dt / PLACE_MS);
        if (anim.place < 1) return true;
        anim.leadDone = true;
        anim.done = total === 0;
        return false;
      }

      /* A beat in flight finishes before the mode decides whether another one
         starts — `moving` is what separates "settled on frame i" from "on the
         way to i + 1", and without it the last frame of one beat and the first
         of the next are the same picture and every step gains a stutter. In
         step mode the pair stops after an UPDATE, so one press is always
         assign-then-move rather than half of one and half of the next. */
      if (anim.moving) {
        anim.t = clamp01(anim.t + dt / (steps[anim.i + 1].kind === "assign" ? pace.assign : pace.update));
        if (anim.t < 1) return true;
        anim.moving = false;
        anim.i += 1;
        if (anim.i >= total) { anim.done = true; return false; }
        if (anim.mode === "step" && steps[anim.i].kind === "update") return false;
      }
      if (anim.i >= total) { anim.done = true; return false; }
      anim.moving = true;
      anim.t = 0;
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const steps = state.run.steps;
    const told = params.labels === "on";
    const pace = paceFor(params, anim);

    const i = Math.min(anim.i, steps.length - 1);
    const from = steps[i];
    const to = anim.moving ? steps[i + 1] : null;
    const t = anim.moving ? easeIO(anim.t) : 0;

    /* WHAT IS ON SCREEN, as one description both halves of the figure read.
       Two copies of "which assignment is showing" is how the dots and the
       caption come to disagree. */
    const settledAssign = from.kind === "assign" ? from : null;
    const arriving = to?.kind === "assign" ? to : null;
    const oldLabels = arriving ? labelsBefore(steps, i + 1) : labelsBefore(steps, i + 1);
    const newLabels = arriving ? arriving.labels : from.labels ?? labelsBefore(steps, i);
    const showLabels = settledAssign ? settledAssign.labels : newLabels;

    /* How many points changed hands on the assignment being shown. Cell 52's
       stopping rule is "until assignments no longer change", so the count is
       the algorithm's own convergence test — and it is printed rather than
       drawn, which is the whole of the clutter fix. */
    const against = settledAssign ? labelsBefore(steps, i) : arriving ? oldLabels : null;
    const shownAssign = settledAssign ?? arriving;
    const changed = !shownAssign ? 0
      : !against ? shownAssign.labels.length
        : shownAssign.labels.reduce((n, v, idx) => n + (v === against[idx] ? 0 : 1), 0);

    /* THE ASSIGNMENT IS TWO THINGS AND THEY HAPPEN IN ORDER: each centroid
       reaches out to the points it is claiming, and only then do the colours
       change. One tween carried both and the recolour looked like a cause
       rather than a consequence.

         0.00 - 0.55   spokes grow, from the centroid outward
         0.45 - 1.00   the dots cross-fade to their new colour
         0.72 - 1.00   the spokes fade out

       With no web the recolour has the whole tween to itself, which is what
       Fast is: the same states, none of the working. */
    const web = arriving && pace.web;
    const reach = web ? clamp01(t / 0.55) : 0;
    const webFade = web ? 1 - clamp01((t - 0.72) / 0.28) : 0;
    const tint = web ? clamp01((t - 0.45) / 0.55) : t;

    /* ---- the stage ------------------------------------------------------- */
    const S = L.stage;
    const inset = 26;
    const sc = (S.w - 2 * inset) / (2 * state.span);
    const px = (v) => S.x + inset + (v + state.span) * sc;
    const py = (v) => S.y + S.h - inset - (v + state.span) * sc;

    axesL(ctx, colors, S);

    /* Centroids first in position, so the dots can be drawn over them and the
       cross's surface halo keeps it legible either way. */
    const moving = to?.kind === "update";
    const cs = (moving ? to.centroids : from.centroids).map((c, kk) => {
      if (!moving) return c;
      const a = to.from[kk];
      return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
    });

    if (moving) {
      ctx.save();
      ctx.globalAlpha = 0.42 * (1 - t);
      for (let kk = 0; kk < to.from.length; kk += 1) {
        centroidCross(ctx, colors, px(to.from[kk][0]), py(to.from[kk][1]), groupCol(colors, kk),
          { r: 8, width: 2.4 });
      }
      ctx.restore();
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.4;
      for (let kk = 0; kk < to.from.length; kk += 1) {
        ctx.strokeStyle = groupCol(colors, kk);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(px(to.from[kk][0]), py(to.from[kk][1]));
        ctx.lineTo(px(cs[kk][0]), py(cs[kk][1]));
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---- the web: what "nearest centroid" LOOKS like ----------------------
       A spoke from each centroid out to every point it is claiming, growing
       from the centroid so it reads as the centroid reaching rather than the
       points jumping. Under the dots, so it never crosses a mark it is about
       to explain. Only the winning centroid draws — a line from every point to
       every centroid is the comparison itself, but at K = 6 and 48 points it
       is 288 lines and reads as a hairball. */
    if (web && reach > 0.01) {
      ctx.save();
      ctx.setLineDash([2.5, 3.5]);
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      for (let idx = 0; idx < state.X.length; idx += 1) {
        const kk = arriving.labels[idx];
        const cx = px(arriving.centroids[kk][0]);
        const cy = py(arriving.centroids[kk][1]);
        const dx = px(state.X[idx][0]) - cx;
        const dy = py(state.X[idx][1]) - cy;
        ctx.strokeStyle = groupCol(colors, kk);
        ctx.globalAlpha = 0.6 * webFade;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx * reach, cy + dy * reach);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---- the samples ------------------------------------------------------ */
    for (let idx = 0; idx < state.X.length; idx += 1) {
      const x = px(state.X[idx][0]);
      const yy = py(state.X[idx][1]);

      /* The true group, drawn as a ring OUTSIDE the dot rather than as its
         fill: the fill is what K-Means decided and the ring is what was really
         there, so the two never occupy the same mark and a disagreement is
         visible as a mismatch rather than inferred. */
      if (told) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, yy, 7.4, 0, Math.PI * 2);
        ctx.strokeStyle = groupCol(colors, state.y[idx]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      const before = oldLabels ? groupCol(colors, oldLabels[idx]) : colors.unknown;
      const after = showLabels ? groupCol(colors, showLabels[idx]) : colors.unknown;
      sampleDot(ctx, colors, x, yy, arriving ? before : after);
      if (arriving && tint > 0) {
        ctx.save();
        ctx.globalAlpha = tint;
        sampleDot(ctx, colors, x, yy, after);
        ctx.restore();
      }
    }

    /* ---- the centroids ---------------------------------------------------- */
    if (anim.place > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, anim.place);
      for (let kk = 0; kk < cs.length; kk += 1) {
        centroidCross(ctx, colors, px(cs[kk][0]), py(cs[kk][1]), groupCol(colors, kk));
      }
      ctx.restore();
    }

    /* ---- what beat this is ------------------------------------------------ */
    const iter = steps.slice(0, i + (to ? 2 : 1)).filter((s) => s.kind === "update").length
      + (arriving ? 1 : 0);
    let beat;
    if (!anim.leadDone) beat = `${state.X.length} samples, no centroids yet`;
    /* AT TEN STARTS THE FIGURE REPLAYS THE WINNER and the other nine are never
       drawn — which is exactly what `sklearn` reports, and exactly the kind of
       thing a widget has to say out loud rather than let a reader assume. */
    else if (from.kind === "init" && !to) {
      beat = state.tries > 1
        ? `${plural(params.k, "centroid")} — the best of ${state.tries} random starts`
        : `${plural(params.k, "centroid")} placed at random`;
    }
    else if (shownAssign) {
      beat = changed
        ? `Assign — ${plural(changed, "point")} changed cluster`
        : "Assign — no point changed, so this is the answer";
    } else beat = "Update — every centroid moves to the mean of its points";
    text(ctx, colors, beat, S.x, S.y - 11, colors.ink2, colors.fsSm);
    if (anim.leadDone && iter > 0) {
      text(ctx, colors, `Iteration ${Math.min(iter, state.run.iters)}`, S.x + S.w, S.y - 11,
        colors.ink3, colors.fsXs, "right");
    }

  },

  readout({ params, state, anim }) {
    const steps = state.run.steps;
    const i = Math.min(anim.i, steps.length - 1);
    /* The numbers describe the assignment ON SCREEN, not the answer the run
       ends on. A tile that ran ahead of the picture would be telling the reader
       where this is going, which is the whole thing they are here to build. */
    const shown = steps[i].kind === "assign" ? steps[i] : steps.slice(0, i + 1).reverse().find((s) => s.kind === "assign");
    if (!shown) {
      return [
        { label: "Within-cluster SS", value: "—", note: "what K-Means minimises" },
        { label: "Silhouette", value: "—", note: "no true labels needed" },
      ];
    }
    const sil = params.k > 1 ? silhouette(state.X, shown.labels) : null;
    const tiles = [
      { label: "Within-cluster SS", value: fmt(shown.inertia), note: "what K-Means minimises" },
      { label: "Silhouette", value: sil === null ? "—" : fmt(sil), note: sil === null ? "needs at least two clusters" : "no true labels needed" },
    ];
    /* ARI ONLY ONCE THE TRUE GROUPS ARE ON SCREEN. It scores the answer against
       the truth, and printing it while the truth is hidden would hand over the
       verdict the reader was asked to reach from the picture. */
    if (params.labels === "on") {
      tiles.push({
        label: "ARI",
        value: fmt(adjustedRand(state.y, shown.labels)),
        note: `against the ${state.groups} true groups`,
      });
    }
    return tiles;
  },

  summary({ params, state, anim }) {
    const steps = state.run.steps;
    const i = Math.min(anim.i, steps.length - 1);
    const iters = steps.slice(0, i + 1).filter((s) => s.kind === "update").length;
    const where = !anim.leadDone
      ? "no centroids placed yet"
      : steps[i].kind === "init"
        ? `${plural(params.k, "centroid")} placed at random, nothing assigned`
        : `${plural(iters, "iteration")} done`;
    return `${plural(state.X.length, "sample")} in ${plural(state.groups, "group")}, with K-Means `
      + `looking for ${plural(params.k, "cluster")}`
      + (state.tries > 1 ? `, from the best of ${state.tries} random starts` : "")
      + `: ${where}. Samples are dots and centroids are crosses.`
      + (params.labels === "on" ? " The ring on each sample shows the group it really came from." : "");
  },
});
