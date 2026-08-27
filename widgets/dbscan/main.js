/* ============================================================================
   DBSCAN — density-based clustering.

   Host: PHM5005 `03-5 - ML - Unsupervised Learning.ipynb`, cells 60-67. The
   plan and every measurement behind the constants here are in
   docs/catalogue.md § Widget 24 · DBSCAN.

   THE LAYOUT IS CELL 60'S OWN DIAGRAM. Its panel 1 is black dots — data with no
   verdict on it — and its panel 2 puts a grey disc on EVERY point, not on a
   selected one. That disc is `eps`, and the overlap between discs is the whole
   algorithm: "within eps of each other" is what a reader is looking at when two
   discs touch. The diagram then fans out to two named verdicts, each with its
   rule in parentheses; the widget draws three, because the text names three and
   the diagram's own step 4 is border points.

   The algorithm is `./model.js`, checked against sklearn 1.9.0 point for point
   on 13 fixtures (`_lab/dbscan-verify.mjs`). NOTHING SEARCHES ON SCREEN:
   `compute` runs the whole thing and records every frame before the first one
   is drawn, which is invariant 2. The animation walks that recording.
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";
import {
  dbscan, rings, blobs, moons, spreadFor, silhouetteClustersOnly, adjustedRandNoiseAware,
} from "./model.js";

const MARK_MS = 560;       /* the core points lighting up */

/* PACING. Unlike widget 23 there is no assign/update pair — every beat is one
   hop of one cluster's growth, so a speed is a single number. The slow end is
   where the growth is legible as a chain; the fast end is for a reader who has
   already seen it and wants the answer. */
const SPEEDS = {
  slow: { label: "Slow", detail: "the disc travels, then reaches for what it can see", grow: 620, links: true },
  medium: { label: "Medium", detail: "the same, quicker", grow: 300, links: true },
  fast: { label: "Fast", detail: "no spokes — the disc walks and colours follow", grow: 105, links: false },
};

/* ONE PRESS OF STEP ALWAYS RUNS THE FULL BEAT, whatever Play is set to — the
   same call widget 23 and `bootstrap` made, and for the same reason: Step's
   whole job is to show one hop, and a fast single hop is useless. */
const STEP_PACE = { grow: 900, links: true };
const paceFor = (params, anim) =>
  (anim.mode === "step" ? STEP_PACE : SPEEDS[params.speed] ?? SPEEDS.medium);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
/* ONE BEAT IS ONE POINT BEING EXAMINED, and this is the whole choreography:

     0.00 - 0.44   the disc TRAVELS from the point just examined to this one
     0.38 - 0.74   spokes grow from it to every point inside the disc
     0.62 - 1.00   the ones it pulls in take the cluster colour

   THE ORDER IS THE ARGUMENT. The disc arrives before it can see anything, it
   sees before it claims, and it claims last — which is `dbscan_inner`'s own
   loop: pop a point, look at its neighbourhood, push what is new. A previous
   build grew one ring in place per BFS LAYER, lighting four points at once
   from four rings at once, and it was reported as three separate faults —
   the ring did not travel, several rings were live together, and nothing
   showed the neighbours being counted. They were one fault: a breadth-first
   FRONT is not what the algorithm does, and drawing it as one made the reader
   ask why. */
const MOVE_TO = 0.44, LINK_FROM = 0.38, LINK_SPAN = 0.36, JOIN_FROM = 0.62, JOIN_SPAN = 0.38;
const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/* --- layout ----------------------------------------------------------------
   One function, read by both `height` and `draw`, so the two cannot drift.

   ONE PANEL. The `eps` sweep — cluster count against every radius, 1.62ms a
   render and therefore affordable — is NOT here. It is the panel widget 23
   built twice and cut twice, and the objection that killed it there is weaker
   here but not gone: it would be a second object competing with the mechanism
   for the same screen. docs/catalogue.md § QUESTION 1 keeps the measurement,
   and § REVIEW ROUND 2 of widget 23 keeps the argument. */
const PAD = 16, TOP = 30, BOT = 16;
const STAGE_MAX = 400;

function layout(w) {
  const side = Math.max(140, Math.min(STAGE_MAX, w - 2 * PAD));
  const x0 = Math.max(PAD, (w - side) / 2);
  return { stage: { x: x0, y: TOP, w: side, h: side }, height: TOP + side + BOT };
}

/* --- the marks -------------------------------------------------------------
   GRAMMAR G, chosen from seven candidates drawn at the real 550px canvas in
   `_lab/dbscan-marks.html` with the ink counted rather than estimated. The
   rule a reader learns is one sentence: SOLID BUILT THIS CLUSTER, FAINT ONLY
   JOINED IT, A CROSS BELONGS TO NONE.

   Border is carried by OPACITY and not by a hollow ring, and that is the whole
   finding of the mock-up. Stroke width is not scale-invariant, so a hollow
   mark converges on its filled twin as the figure shrinks: the hollow
   candidates read correctly at 4.6px — 36% distinct from core — and collapse
   to 9% at the 2.6px a lecture screen gives, because a 1.9px stroke on a
   2.6px dot has closed the hole. Opacity holds at 97%, and unlike size it
   costs no area: border keeps 99% of core's ink. */
const R = 4.6;

/* GRAMMAR G'S BORDER WEIGHT — 0.45 — AND IT IS MIXED, NOT ALPHA'D.
   `_lab/dbscan-marks.html` measured G at 97% distinct from core, and it
   measured it on a BARE SURFACE. In the widget a dot sits on the eps wash,
   which at a working radius is ten overlapping discs deep, and `globalAlpha`
   lets that through: the border mark then takes its colour partly from however
   many discs happen to overlap that point. Measured on the shipped figure
   before this was fixed, core read (57,135,229) and border (79,135,202) —
   nothing like 97%, and varying across the stage.

   So the weight is baked into a COLOUR instead. `mix` blends the cluster
   colour toward the surface once, and the dot is drawn opaque, which makes the
   mark identical everywhere and restores what the lab actually measured. A
   mark whose appearance depends on what is behind it is not a mark. */
const BORDER_MIX = 0.45;

const hex = (c) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c.trim());
  return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : null;
};
/** `a` at weight `k` over `b`, resolved to an opaque colour. Falls back to the
    plain colour if either token is not a plain hex — no token here is not, but
    a silent NaN in a fill string paints nothing at all. */
function mix(a, b, k) {
  const p = hex(a), q = hex(b);
  if (!p || !q) return a;
  return `rgb(${p.map((v, i) => Math.round(v * k + q[i] * (1 - k))).join(",")})`;
}
/* 0.09 AND IT WAS 0.17. At eps 0.40 on the default stage a point sits under
   about ten overlapping discs, and 0.17 compounds to opaque long before that
   — the ring band came out a flat grey donut with no disc visible in it.
   Nine hundredths keeps ten overlaps legible as a gradient, which is what
   makes density look like density. */
const DISC_ALPHA = 0.09;

/** The surface halo every scatter widget here draws, so touching marks
    separate — `--surface-gap` is 2px and at this density points do touch. */
function dot(ctx, colors, x, y, col, r = R) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
}

/** Noise. A cross rather than a colour, which is what let grammar G ship
    without a new token: `--c-unknown`'s comment scopes it to "not measured
    yet, not a third outcome", and noise IS that third outcome. Making it a
    SHAPE keeps the comment true. */
function noiseCross(ctx, colors, x, y, r = R) {
  ctx.save();
  ctx.lineCap = "round";
  const a = r * 0.78;
  for (const [stroke, lw] of [[colors.surface, 4.2], [colors.ink3, 1.8]]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - a, y - a); ctx.lineTo(x + a, y + a);
    ctx.moveTo(x + a, y - a); ctx.lineTo(x - a, y + a);
    ctx.stroke();
  }
  ctx.restore();
}

/** `eps`, and the diagram draws it on EVERY point rather than on a chosen one.

    --ink-3 AT LOW ALPHA, NEVER --grid, and this was found by reading pixels in
    `_lab/dbscan-marks.html` rather than by looking at it. `--grid` is a
    hairline colour chosen to be nearly invisible — #e1e0d9 on a #fcfcfb
    surface and #2c2c2a on a #1a1a19 one — and the disc vanished outright in
    dark mode. `--ink-3` is #898781 in BOTH themes, so a low-alpha fill lands
    mid-grey against either. */
function epsDisc(ctx, colors, x, y, rr, alpha) {
  ctx.save();
  ctx.globalAlpha = DISC_ALPHA * alpha;
  ctx.fillStyle = colors.ink3;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The reach of ONE point, outlined.
 *
 * THE FILLED DISCS ALONE DO NOT SURVIVE 48 POINTS, and this was found by
 * drawing it rather than by thinking about it. Cell 60's diagram fills a grey
 * disc on every point and it reads — because the diagram has SEVEN points. At
 * 48 and a working radius the discs merge into one grey field: the reader sees
 * a shaded region, which says the cluster is dense and says nothing at all
 * about reach, and "within eps of each other" stops being visible anywhere.
 *
 * So the fill drops to a wash and the disc that is DOING SOMETHING is
 * outlined: the points a cluster is reaching from on the hop being drawn. One
 * circle against a wash is a reach; forty-eight filled ones are a texture.
 */
function reachRing(ctx, surface, x, y, rr, col, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  /* HALOED, AND IT WAS A 1.5px DASHED LINE. Reported as thin and hard to see,
     and measured in `_lab/dbscan-reach.html`: against the grey disc wash it
     sits on, the dashed ring scores 89 mean channel distance and this one 214
     — 2.4x — because it no longer has to win a contrast fight it did not pick.
     Laying a thick surface-coloured stroke down first is what every other mark
     in this collection already does, and a dashed ring on a grey wash was the
     one place here that did not. A tint-only version was measured too and came
     out at 33, WORSE than the dashed line: filling a region the wash already
     fills adds no edge. */
  ctx.strokeStyle = surface;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();
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

/** The bare L of cell 60's diagram: no ticks and no numbers, because the
    coordinates are not what DBSCAN is about — distances between points are. */
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

/* Per-point state, as one small vocabulary both `draw` and the captions read.
   UNSEEN is before anything has been decided; CORE_LOOSE is the beat cell 60's
   step 2 describes and step 3 has not yet acted on — a point known to be dense
   enough, with no cluster to belong to yet. */
const UNSEEN = 0, CORE_LOOSE = 1, CLAIMED = 2, NOISED = 3;

/* --- the recording ---------------------------------------------------------
   Every frame, built once in `compute`. 17 frames of 48 bytes on the default
   stage — the whole animation is 800 bytes, so there is no reason to derive
   any of it per frame and every reason not to. */
function record(res, X, n) {
  const owner = new Int16Array(n).fill(-1);
  const kindOf = new Uint8Array(n).fill(UNSEEN);
  const frames = [];
  const snap = (meta) => frames.push({
    ...meta, owner: owner.slice(), kind: kindOf.slice(),
  });

  /* 1. Step 2: at least `min_samples` inside the disc makes a CORE POINT. This
        is a verdict that exists BEFORE any cluster does, which is why it gets
        its own mark rather than a cluster colour it has not earned.

        THERE IS NO "DRAW THE DISCS" FRAME, and there was one for a build.
        Making the reach a beat you PERFORM meant `eps` — a data parameter —
        re-initialised the animation on every drag, so the discs vanished and
        the widget's single most important slider moved with nothing on screen
        responding to it. The discs are a picture of the PARAMETER, not of the
        answer, so they are drawn always and cell 60's step 1 needs no press.
        Principle 4 is untouched: no cluster is shown until something is. */
  for (let i = 0; i < n; i += 1) if (res.core[i]) kindOf[i] = CORE_LOOSE;
  snap({ beat: "core" });

  /* 2. Steps 3 and 4, ONE POINT AT A TIME. A core point is examined, it pulls
        in everything inside its disc that no cluster holds yet, and the disc
        then travels to the next point to be examined. Border points are pulled
        in but never examined — they cannot extend a cluster, which is exactly
        what makes them border points, and giving them a beat would say the
        opposite.

        ONE CLUSTER AT A TIME, in index order, because that is what the
        algorithm does: sklearn finishes a cluster before it starts the next,
        and a picture showing them bloom together would be a nicer lie.

        THE ORDER WITHIN A CLUSTER IS THE BFS ORDER, flattened. `dbscan_inner`
        uses a LIFO stack and this uses the layers, and the two agree on the
        answer while disagreeing on the route — `model.js` records why both are
        kept. Flattened, the layers give the reader a disc that crawls outward
        from the seed; the stack would send it jumping back and forth across a
        cluster it has already covered, which is true to the source and useless
        to look at. The labels are the stack's; the walk is the layers'. */
  res.clusters.forEach((cl, k) => {
    const order = cl.layers.flat().filter((i) => res.core[i]);
    let prev = null;
    for (const at of order) {
      /* Everything inside the disc — which is what the spokes draw, and what
         `min_samples` counted. Not just the new ones: a reader watching a
         point be examined is watching it COUNT, and the ones already taken are
         part of that count. */
      const links = res.nb[at].filter((j) => j !== at);
      const joins = [];
      if (owner[at] < 0) joins.push(at);
      for (const j of res.nb[at]) {
        if (j !== at && res.labels[j] === k && owner[j] < 0) joins.push(j);
      }
      for (const j of joins) { owner[j] = k; kindOf[j] = CLAIMED; }
      snap({
        beat: "visit", k, at, prev, links, joins, seen: res.nb[at].length,
        /* WHERE THE READER IS IN THE WALK. A layer-at-a-time growth was 14
           beats and could say "hop 3 of 9"; one point at a time is 36 on the
           default stage, and a walk that long with no progress showing is a
           reader wondering whether it has stalled. */
        nth: order.indexOf(at) + 1, of: order.length,
      });
      prev = at;
    }
  });

  /* 4. Step 5: whatever is left is noise, labelled -1. It is not a decision
        taken at the end — it is what never got taken — so it lands as one
        beat once nothing can reach it any more. */
  if (res.noise.length) {
    for (const i of res.noise) kindOf[i] = NOISED;
    snap({ beat: "noise" });
  }
  return frames;
}

defineWidget({
  slug: "dbscan",
  title: "DBSCAN",
  subtitle: "No K. You choose a radius instead: a point with enough neighbours inside it seeds a cluster, the cluster grows through overlapping discs, and whatever is never reached is noise.",
  status: "shipped",
  layout: "side",
  height: ({ w }) => layout(w).height,

  /* FOUR MARKS, because cell 60 names three kinds of point and the widget has
     to draw the state before any of them too. Chosen from seven candidate
     grammars in `_lab/dbscan-marks.html`; see § the marks above for why border
     is opacity rather than a ring. */
  legend: [
    { token: "unknown", label: "Not decided yet", mark: "dot" },
    { token: "highlight", label: "Core — enough neighbours", mark: "dot" },
    { token: "cluster-a", label: "In a cluster (faint: joined it, did not build it)", mark: "dot" },
  ],

  params: {
    data: { type: "section", label: "The data" },

    /* TWO STAGES, KENNETH'S CALL ON 2026-08-26, and `rings` leads because it is
       the only place in the arc where the new method does something the
       previous one cannot: K-Means scores -0.016 +/- 0.001 on 20 of 20 seeds
       here and DBSCAN 1.000 +/- 0.000. It is also where the growth is best —
       the outer ring crawls around itself in 10 hops while the inner takes 4.
       `blobs` is widget 23's own stage point for point, so the two clustering
       widgets stay comparable.

       `moons` and `varying` are built, verified and measured but held back;
       each is one more option here and no new machinery. */
    shape: {
      type: "segmented",
      label: "Shape",
      options: [
        { value: "rings", label: "Rings", detail: "one ring inside the other" },
        { value: "moons", label: "Moons", detail: "two interleaving crescents" },
        { value: "blobs", label: "Blobs", detail: "round, separated groups" },
      ],
      default: "rings",
    },

    /* A TOTAL, AND NOT "PER GROUP" — which is where this differs from widget
       23, for a reason in the generators rather than in taste. `rings` defines
       its count as a total by construction (`model.js` says why: an equal count
       on rings of different circumference is secretly a varying-DENSITY stage),
       and `blobs` splits its by group. One "per group" number therefore cannot
       give 48 on both, and 48 is the size every measurement in the plan was
       taken at.

       48 IS THE FLOOR, and 24 was offered for one build and withdrawn: at 24
       points there is NO eps anywhere in 0.10-0.80 that recovers `rings` or
       `moons` at all. A stage option that cannot work at any setting is a trap
       rather than a lesson — the reader gets a screen of noise and no way out.
       Density needs points, which is § 48 SAMPLES CARRIES A DENSITY METHOD. */
    samples: {
      type: "choice",
      label: "Samples",
      options: [48, 96, 150].map((v) => ({ value: String(v), label: String(v) })),
      default: "48",
      detail: "in total, split between the groups",
      row: { key: "stage" },
    },

    /* BLOBS ONLY, and `when` is why this is honest rather than convenient: the
       other two stages have their group count fixed by construction — two rings
       are two rings — so a control claiming otherwise would be a lie about the
       data. Widget 22 took six as the ceiling because `tokens.css` defines six
       cluster colours and a seventh would have to borrow one. */
    groups: {
      type: "choice",
      label: "Groups in the data",
      when: { param: "shape", equals: "blobs" },
      options: [2, 3, 4, 6].map((v) => ({ value: String(v), label: String(v) })),
      default: "4",
      row: { key: "stage" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1, detail: "draws different samples" },

    /* OFF BY DEFAULT, so the reader reads the clusters off the picture before
       being told what was really there — the notebook's own order, and
       non-negotiable 4 applied to knowledge rather than to the figure. It also
       gates the ARI tile: scoring an answer against the truth is not available
       to someone who has not asked to see the truth.

       IT KEEPS WIDGET 23'S OUTER RING UNCHANGED, which grammar G was chosen
       partly to afford. Every candidate that spent the ring on border points
       would have forced a second ring further out — measured at 427% of a
       dot's ink at projector size, a blob where a mark should be. */
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

    fit: { type: "section", label: "DBSCAN" },

    /* THE WIDGET. K-Means made you choose K; this makes you choose a radius,
       and the radius decides how many clusters you get.

       0.40 IS MEASURED, not picked. On the default stage it is right — both
       rings recovered as exactly two clusters — and it carries 12 border
       points, so three of the four marks are live on the opening figure. It is
       also right on `blobs` when the reader switches (42 core, 6 border), which
       matters because one slider serves both stages and the alternative default
       0.30 leaves rings as 48 points of noise and no clusters at all.

       THERE IS NO eps ON `rings` THAT IS BOTH RIGHT AND SHOWS NOISE, and that
       is a property of the stage rather than a defect: a ring is a near-uniform
       chain, so every point crosses into core at nearly the same radius.
       Measured over 20 seeds at each `min_samples` from 3 to 8, the best is 5
       of 20 seeds. Dragging eps down to 0.36 produces 9 noise points at once,
       which is the lesson; `blobs` at 0.30 has all four marks on screen
       together (28 core, 13 border, 7 noise). */
    eps: {
      type: "float",
      label: "Radius (eps)",
      min: 0.10,
      max: 0.80,
      step: 0.01,
      default: 0.40,
      row: { key: "fitrow" },
    },

    /* FIVE, AND THREE THINGS AGREE ON IT. It is cell 60's own value —
       `DBSCAN(eps=0.7, min_samples=5)` — it is the setting under which `rings`
       shows border points across the whole working band rather than at a single
       radius, and on `blobs` it puts more of both minority marks on screen than
       4 does (13 border and 7 noise against 11 and 5).

       THE POINT IS ITS OWN NEIGHBOUR and cell 60 says so in as many words:
       "Minimum number of points (including the point itself)". `model.js`
       counts it, and getting that wrong shifts every core/border verdict by
       exactly one — which reads as a tuning difference rather than as a bug. */
    minPts: {
      type: "int",
      label: "Neighbours needed",
      min: 2,
      max: 10,
      default: 5,
      detail: "min_samples — counting the point itself",
      row: { key: "fitrow" },
    },

    /* REPORTED AS DISTRACTING, and it is: at a working radius every point
       carries a disc, so the wash is the largest thing on the figure and it
       competes with the one disc that is actually doing something.

       DEFAULT OFF, WHICH TRADES AGAINST AN EARLIER NOTE and is worth saying
       out loud. The discs were made permanent in review round 1 precisely so
       that dragging `eps` had something to move; with them off, what moves is
       the caption's live core count and the travelling disc once the walk
       starts. If that turns out to be too little, the fix is this default and
       nothing else — the mark, the wash and the toggle all stay as they are. */
    discs: {
      type: "segmented",
      label: "Every point's disc",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On", detail: "eps drawn on all of them — the overlap is what joins a cluster up" },
      ],
      default: "off",
      display: true,
    },

    /* GOVERNS PLAY, NOT STEP — see `STEP_PACE`. Below the drive row for the
       reason 3.4e gives: this is the one control that means nothing until you
       have pressed something, so it belongs under the button it governs. */
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

  /* THE WHOLE SEARCH, before a single frame is drawn — invariant 2, and here
     it is nearly free: one fit at n = 48 is 26 microseconds. */
  compute({ params, rng }) {
    /* `samples` is a total and each generator counts differently, so the
       conversion lives here in one place: `rings` takes the total, `moons`
       makes two points an iteration, and `blobs` takes a per-group count. */
    const total = Number(params.samples);
    const groups = Number(params.groups);
    const stage = params.shape === "rings" ? rings(rng, { per: total })
      : params.shape === "moons" ? moons(rng, { per: Math.round(total / 2) })
        : blobs(rng, { groups, per: Math.round(total / groups) });
    const X = stage.map((s) => s.p);
    const y = stage.map((s) => s.g);
    const truth = new Set(y).size;

    const res = dbscan(X, { eps: params.eps, minPts: params.minPts });
    const frames = record(res, X, X.length);

    /* A square window, so a round cluster is drawn round and — on `rings` — a
       circle is drawn circular, which is the entire point of that stage.
       `blobs` reuses widget 23's own `spreadFor`, so at a shared group count
       the two widgets frame identical points identically. */
    const span = params.shape === "rings" ? 1.14
      : params.shape === "moons" ? 1.35
        : 1 + 3 * spreadFor(groups);

    return { X, y, res, frames, span, truth };
  },

  animation: {
    /* CELL 60'S FIVE STEPS, mapped onto the three things a reader can press.
       Step 1 — count the neighbours — happens once and is the lead. Steps 2
       to 5 are beats: the core verdict, then one hop of one cluster at a time,
       then whatever was never reached. */
    leadLabel: "Mark the core points",
    leadTitle: "Step 2 — a point with at least min_samples inside its disc is a core point",
    stepLabel: "Next point",
    stepTitle: "Steps 3 to 5 — move the disc to the next core point, see what is inside it, and take what no cluster holds yet",
    runLabel: "Play",
    runTitle: "Run the growth to the end",

    init: ({ params, state, fromScratch, leadDone }) => {
      const total = state.frames.length - 1;
      const pre = fromScratch ? 0 : Math.max(0, Math.min(params.shown | 0, total));
      const placed = Boolean(leadDone) || pre > 0;
      return {
        leadDone: placed,
        mark: placed ? 1 : 0,
        i: pre,
        t: 1,
        moving: false,
        done: placed && pre >= total,
      };
    },

    /* No `rebuild`. The display parameters are `labels` and `speed`, and
       neither changes anything the animation derives — core keeps `anim` as it
       is, which is what a display change is supposed to do. `eps` and
       `min_samples` are data, so they re-init: a new radius is a new search,
       and replaying a growth that no longer happened would be a lie. */

    advance(anim, { dt, params, state }) {
      const total = state.frames.length - 1;
      const pace = paceFor(params, anim);

      /* The lead: the core points light up under discs already on screen. */
      if (!anim.leadDone) {
        anim.mark = clamp01(anim.mark + dt / MARK_MS);
        if (anim.mark < 1) return true;
        anim.leadDone = true;
        anim.done = total === 0;
        return false;
      }

      /* A beat in flight finishes before the mode decides whether another one
         starts. `moving` is what separates "settled on frame i" from "on the
         way to i + 1"; without it the last frame of one beat and the first of
         the next are the same picture and every press gains a stutter. */
      if (anim.moving) {
        anim.t = clamp01(anim.t + dt / pace.grow);
        if (anim.t < 1) return true;
        anim.moving = false;
        anim.i += 1;
        if (anim.i >= total) { anim.done = true; return false; }
        if (anim.mode === "step") return false;
      }
      if (anim.i >= total) { anim.done = true; return false; }
      anim.moving = true;
      anim.t = 0;
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = layout(w);
    const { frames } = state;
    const told = params.labels === "on";
    /* The pace decides whether this beat SWEEPS, and it is read here as well as
       in `advance` because the choreography is a property of the speed rather
       than of the clock — widget 23 declares `web` the same way and for the
       same reason: past a certain pace there is no time to read the working, so
       it is dropped rather than flickered. */
    const pace = paceFor(params, anim);

    const i = Math.min(anim.i, frames.length - 1);
    const from = frames[i];
    const to = anim.moving ? frames[i + 1] : null;
    const t = to ? easeIO(anim.t) : 0;

    const nCore = state.res.core.filter(Boolean).length;
    const S = L.stage;
    const inset = 26;
    const sc = (S.w - 2 * inset) / (2 * state.span);
    const px = (v) => S.x + inset + (v + state.span) * sc;
    const py = (v) => S.y + S.h - inset - (v + state.span) * sc;

    axesL(ctx, colors, S);

    /* ---- eps, on every point ---------------------------------------------
       UNDER the dots and translucent, so the overlap reads as overlap. The
       discs are the one mark that answers to the slider directly, and they are
       drawn at the live radius rather than at a recorded one — `eps` is a data
       parameter, so a change re-computes and re-inits, and there is no frame in
       which the discs and the verdicts disagree. */
    const rr = params.eps * sc;
    if (params.discs === "on") {
      for (const p of state.X) epsDisc(ctx, colors, px(p[0]), py(p[1]), rr, 1);
    }

    /* ---- the disc that is doing the work ---------------------------------
       ONE DISC, and it TRAVELS. `visiting` is the point being examined on the
       beat in flight; `moveT` walks the disc from the point examined before it
       to this one, so between two beats there is a disc crossing the gap
       rather than one vanishing and another appearing.

       On the very first point of a cluster there is nowhere to travel from, so
       it fades in where it starts. That is also the only visual difference
       between "a new cluster begins" and "this one continues", and it is the
       right one: a seed has no parent. */
    const visiting = to?.beat === "visit" ? to : (from.beat === "visit" ? from : null);
    const inFlight = to?.beat === "visit" ? to : null;
    const moveT = inFlight ? easeIO(clamp01(anim.t / MOVE_TO)) : 1;

    if (anim.leadDone && visiting) {
      const col = groupCol(colors, visiting.k);
      const ax = px(state.X[visiting.at][0]), ay = py(state.X[visiting.at][1]);
      let cx = ax, cy = ay, appear = 1;
      if (inFlight) {
        if (visiting.prev === null) {
          appear = clamp01(anim.t / MOVE_TO);       /* a seed fades in */
        } else {
          const bx = px(state.X[visiting.prev][0]), by = py(state.X[visiting.prev][1]);
          cx = bx + (ax - bx) * moveT;
          cy = by + (ay - by) * moveT;
        }
      }
      reachRing(ctx, colors.surface, cx, cy, rr, col, 0.95 * appear);

      /* ---- the spokes: what the disc can SEE ----------------------------
         A line from the point being examined to every point inside its disc —
         which is `min_samples` being counted, drawn. They grow FROM the point
         outward, so it reads as the point reaching rather than the neighbours
         arriving, and they are under the dots so a spoke never crosses a mark
         it is about to explain.

         EVERY neighbour, not only the ones it pulls in: a point already taken
         by this cluster still counted toward the verdict that made this one
         core, and drawing only the new ones would show a smaller number than
         the caption says. Dropped entirely at Fast, which is what Fast is —
         the same states, none of the working. Widget 23 settled this exact
         question the same way. */
      if (pace.links && visiting.links.length) {
        const grow = inFlight ? clamp01((anim.t - LINK_FROM) / LINK_SPAN) : 1;
        const fade = inFlight ? 1 : 0.55;
        if (grow > 0.01) {
          ctx.save();
          ctx.setLineDash([2.5, 3]);
          ctx.lineWidth = 1.4;
          ctx.lineCap = "round";
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.7 * grow * fade;
          for (const j of visiting.links) {
            const dx = px(state.X[j][0]) - ax, dy = py(state.X[j][1]) - ay;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + dx * grow, ay + dy * grow);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    } else if (anim.leadDone && (to ?? from).beat === "core") {
      /* The core beat is the one moment every disc is the claim being made —
         "at least min_samples inside this one" is asserted about all of them
         at once — so it is the one moment they are all outlined. */
      const fade = to ? Math.max(0.4, 1 - Math.abs(t - 0.5) * 0.5) : 0.85;
      for (let i = 0; i < state.X.length; i += 1) {
        if (state.res.core[i]) {
          reachRing(ctx, colors.surface, px(state.X[i][0]), py(state.X[i][1]), rr, colors.highlight, 0.34 * fade);
        }
      }
    }

    /* A point the disc pulls in waits for the spokes to reach it. Nothing else
       on the beat does — the noise frame and the core frame use the beat's own
       tween — which is why this is a map rather than a flag. */
    const joinT = new Map();
    if (inFlight && inFlight.beat === "visit") {
      const k = clamp01((anim.t - JOIN_FROM) / JOIN_SPAN);
      for (const j of inFlight.joins) joinT.set(j, k);
    }

    /* ---- the points ------------------------------------------------------- */
    /** What a point looks like in one frame: [colour, alpha, isCross]. */
    const look = (f, idx) => {
      const k = f.kind[idx];
      if (k === NOISED) return [null, 1, true];
      if (k === CLAIMED) {
        const col = groupCol(colors, f.owner[idx]);
        return [state.res.core[idx] ? col : mix(col, colors.surface, BORDER_MIX), 1, false];
      }
      if (k === CORE_LOOSE) return [colors.highlight, 1, false];
      return [colors.unknown, 1, false];
    };

    for (let idx = 0; idx < state.X.length; idx += 1) {
      const x = px(state.X[idx][0]);
      const yy = py(state.X[idx][1]);

      /* The true group, drawn as a ring OUTSIDE the dot rather than as its
         fill — widget 23's mark, unchanged. The fill is what DBSCAN decided
         and the ring is what was really there, so the two never occupy the
         same mark and a disagreement is visible rather than inferred. */
      if (told) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, yy, 7.4, 0, Math.PI * 2);
        ctx.strokeStyle = groupCol(colors, state.y[idx]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      const paint = ([col, alpha, cross], k) => {
        if (k <= 0.001) return;
        ctx.save();
        ctx.globalAlpha = alpha * Math.min(1, k);
        if (cross) noiseCross(ctx, colors, x, yy);
        else dot(ctx, colors, x, yy, col);
        ctx.restore();
      };
      const UNDECIDED = [colors.unknown, 1, false];

      /* Before the lead there is no frame: every point is undecided and the
         discs are the whole picture. The lead cross-fades that into frames[0],
         which is the core verdict. */
      if (!anim.leadDone) {
        paint(UNDECIDED, 1);
        if (anim.mark > 0.001) paint(look(frames[0], idx), anim.mark);
      } else {
        const cur = look(from, idx);
        paint(cur, 1);
        /* A point that changes state cross-fades; one that does not is painted
           once. Both marks land at the same place, so the halo of the arriving
           one covers the leaving one as it takes over. */
        if (to) {
          const next = look(to, idx);
          const same = next[0] === cur[0] && next[1] === cur[1] && next[2] === cur[2];
          /* An arriving point waits for the edge; everything else — the noise
             beat, a non-sweeping speed — uses the beat's own tween. */
          if (!same) paint(next, joinT.has(idx) ? joinT.get(idx) : t);
        }
      }
    }

    /* ---- what beat this is ------------------------------------------------ */
    const shownFrame = to ?? from;
    let beat;
    if (!anim.leadDone) {
      /* THE CAPTION MOVES WITH THE SLIDER, which is the point of drawing the
         discs always: `eps` and the count it produces are both live before
         anything has been pressed, so dragging the radius is a thing you can
         watch rather than a setting you commit to blind. */
      beat = `${state.X.length} points, each reaching ${params.eps.toFixed(2)} — ${plural(nCore, "core point")}`;
    } else if (shownFrame.beat === "core") {
      beat = `${plural(nCore, "core point")} — ${params.minPts} or more neighbours inside the disc`;
    } else if (shownFrame.beat === "visit") {
      /* THE COUNT INCLUDES THE POINT ITSELF and the caption says so, because
         cell 60 says so and because a reader counting the spokes will get one
         fewer than the number printed. `min_samples` counting the point is the
         single easiest thing to get wrong here — it shifts every core/border
         verdict by exactly one — so it is stated rather than assumed. */
      const n = shownFrame.seen;
      beat = shownFrame.prev === null
        ? `Cluster ${shownFrame.k + 1} starts here — ${n} points inside this disc, counting itself`
        : `${n} inside this disc, counting itself` + (shownFrame.joins.length
          ? ` — ${plural(shownFrame.joins.length, "new point")} ${shownFrame.joins.length === 1 ? "joins" : "join"} cluster ${shownFrame.k + 1}`
          : ` — all of them are already in cluster ${shownFrame.k + 1}`);
    } else {
      beat = `${plural(state.res.noise.length, "point")} never reached — that is noise`;
    }
    text(ctx, colors, beat, S.x, S.y - 11, colors.ink2, colors.fsSm);

    if (anim.leadDone && state.res.nClusters > 0) {
      const right = shownFrame.beat === "visit"
        ? (state.res.nClusters > 1
          ? `Cluster ${shownFrame.k + 1}/${state.res.nClusters} · core point ${shownFrame.nth}/${shownFrame.of}`
          : `Core point ${shownFrame.nth} of ${shownFrame.of}`)
        : shownFrame.beat === "noise" ? `${plural(state.res.nClusters, "cluster")} grown` : null;
      if (right) text(ctx, colors, right, S.x + S.w, S.y - 11, colors.ink3, colors.fsXs, "right");
    }
  },

  readout({ params, state, anim }) {
    const { frames } = state;
    const i = Math.min(anim.i, frames.length - 1);
    const f = frames[i];

    /* The numbers describe the frame ON SCREEN, not the answer the run ends
       on. A tile running ahead of the picture would be telling the reader
       where this is going, which is the whole thing they are here to build. */
    const done = i >= frames.length - 1;
    const built = new Set();
    for (let idx = 0; idx < state.X.length; idx += 1) if (f.owner[idx] >= 0) built.add(f.owner[idx]);

    const tiles = [
      {
        label: "Clusters found",
        value: anim.leadDone ? String(built.size) : "—",
        note: built.size === 0 ? "nothing has grown yet" : "no K was given",
      },
      {
        label: "Called noise",
        value: done ? String(state.res.noise.length) : "—",
        note: done ? `of ${state.X.length} points` : "known once the growth ends",
      },
    ];

    /* THE NUMBER THE ONE SENTENCE IS ABOUT, and it is the honest reading of it
       rather than cell 67's. `silhouette_score(X, db_labels)` is handed the raw
       labels with -1 still in them, so every point the algorithm DECLINED to
       cluster is pooled into one "cluster" scattered over the whole plane — the
       gap between the two readings runs from 0.000 to 0.951 with the noise
       count, which is precisely what a reader changes by dragging eps.

       This is also the clause that makes the widget's sentence true: scored
       this way it PREFERS A RADIUS THAT IS TOO SMALL, because throwing points
       away makes what is left look tighter. Measured over 55 runs across three
       stages, the eps it picks is right 0 times. */
    if (done) {
      const sil = silhouetteClustersOnly(state.X, state.res.labels);
      /* THE NOTE SAYS WHAT THE METRIC ASSUMES, and which assumption is doing
         the damage depends on the picture — so it names the live one rather
         than the general one. Neither variant says whether the answer is
         right; both are the diagram's own habit of putting the rule in
         parentheses beside the verdict.

         With noise on screen, the mechanism of the too-small bias is the
         exclusion: throw points away and what is left looks tighter, which is
         why the silhouette peaks at eps 0.20 on blobs (0.847, one group of
         four recovered) against 0.738 at the radius that is right.

         With no noise — the default stage at the default radius — the damage
         is roundness instead, and it is severe enough to be the whole lesson:
         two rings recovered perfectly score -0.025, which is EXACTLY the
         silhouette of the true labels, while the six-cluster mess at eps 0.36
         scores +0.471. The number prefers a wrong answer to the right one. */
      const nNoise = state.res.noise.length;
      tiles.push({
        label: "Silhouette",
        value: sil === null ? "—" : fmt(sil),
        note: sil === null ? "needs at least two clusters"
          : nNoise > 0 ? `the ${nNoise} noise points are not scored`
            : "rewards round, separated clusters",
      });
    }

    /* ARI ONLY ONCE THE TRUE GROUPS ARE ON SCREEN — it scores the answer
       against the truth, and printing it while the truth is hidden would hand
       over the verdict the reader was asked to reach from the picture.

       CORRECTED, AND SILENTLY. Every noise point counts as its own singleton,
       which is what -1 MEANS. `adjusted_rand_score` pools them under one label
       instead, so a run that found one of two groups and declared the entire
       other one noise scores 1.000 — identical to a run that found both. The
       correction moves the number ONLY where the number was lying (1.000 to
       0.505 on that case; 0.759 to 0.765 on a good one), which is what makes it
       a correction rather than a different metric, and why it needs no words on
       screen. Widget 23 prints the uncorrected one and is right to: K-Means
       never returns noise, so both readings agree on everything it can produce. */
    if (done && params.labels === "on") {
      tiles.push({
        label: "ARI",
        value: fmt(adjustedRandNoiseAware(state.y, state.res.labels)),
        note: `against the ${state.truth} true groups`,
      });
    }
    return tiles;
  },

  summary({ params, state, anim }) {
    const { frames } = state;
    const i = Math.min(anim.i, frames.length - 1);
    const f = frames[i];
    const built = new Set();
    for (let idx = 0; idx < state.X.length; idx += 1) if (f.owner[idx] >= 0) built.add(f.owner[idx]);

    const where = !anim.leadDone
      ? `a disc of radius ${params.eps.toFixed(2)} on every point, nothing decided`
      : f.beat === "core" ? `${plural(state.res.core.filter(Boolean).length, "core point")} marked, no cluster grown`
          : f.beat === "noise" ? `all ${plural(state.res.nClusters, "cluster")} grown, ${plural(state.res.noise.length, "point")} left as noise`
            : `${plural(built.size, "cluster")} growing, one point at a time`;

    return `${plural(state.X.length, "point")} in ${plural(state.truth, "group")}, with DBSCAN `
      + `reaching ${params.eps.toFixed(2)} from each one and needing ${params.minPts} neighbours`
      + `: ${where}. Solid dots built a cluster, faint ones only joined it, crosses belong to none.`
      + (params.labels === "on" ? " The ring on each point shows the group it really came from." : "");
  },
});
