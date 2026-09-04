/* ============================================================================
   Enrichment Analysis — PHM5003 `05 - Introduction to High Throughput Data`,
   notebook `09 - Enrichment Analysis`. Slot 5 of the high-throughput arc.

   ONE RANKED LIST, READ THREE WAYS, ON ONE X AXIS: how much each gene changed,
   which genes are in the set you asked about, and the walk that accumulates
   the second against the first. Overrepresentation cuts the ranking; the
   enrichment score does not cut it at all.

   WHY THE FIGURE IS SHAPED LIKE THIS. Three shapes were drawn at the real
   width against this engine (`_lab/enr-shape.html`): two tabs, one stage with
   both answers drawn on the canvas, and this one — three strips sharing an
   axis with every number in the readout. Kenneth picked this one. What it buys
   is that every stroke on the canvas is the ranked list, so the strips are
   twice as tall as the version that also drew its own answer panels; what it
   costs is that ORA's 2 x 2 and GSEA's null are behind a toggle rather than
   permanently on screen.

   AND WHY THERE IS ONE WIDGET RATHER THAN TWO, which was an open call in the
   catalogue. Every claim that survived measurement is a statement about ONE
   ranked list scored two ways — the cutoff moving one number and not the
   other, the down-regulated set that ORA cannot see and GSEA can. Split across
   two widgets, not one of them can be made.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import {
  makeStage, ora, gsea, gseaNull, listPositions,
  EFFECTS, BACKGROUNDS, SET_KEYS,
} from "./model.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Milliseconds per GENE, not per frame. The walk is 400 genes long, so the
   whole of it at `medium` takes about five seconds — long enough to watch the
   sum climb through the set and drain outside it, short enough that nobody
   waits. `fastest` declines the walk outright rather than running it
   imperceptibly. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every gene, slowly", ms: 26 },
  medium: { label: "Medium", detail: "every gene as the sum takes it", ms: 12 },
  fast: { label: "Fast", detail: "the shape of the walk, quickly", ms: 4 },
  fastest: { label: "Fastest", detail: "the whole walk at once", ms: 0 },
};

/* A STEP IS ONE GENE OF THE SET, not one gene of the ranking. One gene of 400
   is under two pixels wide and a press that moves the figure two pixels reads
   as a broken button. The sum only RISES at a set gene, so stepping to the
   next one is also the only step that shows the mechanism: the line drains
   while the walk crosses genes outside the set, then jumps when it arrives. */
const STEP_MS = 42;

const PERMS = 1000;

/* Set by the drag's hit-test, read by its `value`. See the comment there for
   why a movement-only contract needs this and why one variable is safe. */
let grabbedPastMiddle = false;

/* The permutation null, kept across the recomputes a display change forces.
   Keyed on the parameters it depends on; see `compute`. */
const nullCache = { key: null, value: null };

/* --- geometry ------------------------------------------------------------- *
 * Everything is derived from `w` and `h`, so a narrow phone gets the same
 * figure rather than a clipped one.
 *
 * THE TWO TEST PANELS SIT SIDE BY SIDE WHERE THERE IS ROOM AND STACK WHERE
 * THERE IS NOT, so their height depends on the WIDTH — and `height` reads the
 * same function, which is the point of having one. With the canvas height
 * fixed at a single number, a phone opening the toggle took 210px out of the
 * three strips and left the walk 84px tall. Now the canvas grows instead. */
const STRIPS_H = 266;
const AXIS_H = 20;

/* The 2 x 2 panel is 103px from its heading to the foot of its second caption,
   MEASURED off the fillText boxes rather than counted off the source. Stacked,
   the null panel starts one clear line below that; side by side, both fit in
   the taller of the two plus room for the caption under the histogram. */
const PANEL_H = 103;
const STACK_AT = PANEL_H + 15;
function gateHeight(w, gateOpen) {
  if (!gateOpen) return 0;
  return w < 560 ? STACK_AT + 106 : 132;
}
const canvasHeight = (w, gateOpen) =>
  26 + STRIPS_H + AXIS_H + (gateOpen ? gateHeight(w, gateOpen) + 8 : 0);

function layout(w, h, gateOpen) {
  const padL = w < 460 ? 34 : 46;
  const padR = w < 460 ? 8 : 14;
  const x0 = padL;
  const pw = w - padL - padR;

  const axisH = AXIS_H;
  const gateH = gateHeight(w, gateOpen);
  const strips = h - 26 - axisH - (gateOpen ? gateH + 8 : 0);
  const profileH = Math.round(strips * 0.44);
  const codeH = Math.max(14, Math.round(strips * 0.10));
  const walkH = strips - profileH - codeH - 10;

  const profileY = 26;
  const codeY = profileY + profileH + 5;
  const walkY = codeY + codeH + 5;
  const axisY = walkY + walkH;
  return {
    x0, pw, profileY, profileH, codeY, codeH, walkY, walkH, axisY,
    gateY: axisY + axisH + 8, gateH, narrow: w < 560,
  };
}

/* --- small drawing helpers ------------------------------------------------- */

function text(ctx, s, x, y, { fill, align = "left", size = 11, weight = "" } = {}) {
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px ${ctx.__font}`.trim();
  ctx.fillText(s, x, y);
}

/* A p-value at the sizes this widget reaches: 1e-21 is a real answer here, and
   `toFixed` would print it as 0.0000. */
function fmtP(p) {
  if (p >= 0.001) return p.toFixed(4);
  const [m, e] = p.toExponential(1).split("e");
  return `${m} × 10${supMinus(e)}`;
}
const SUPS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const supMinus = (e) => String(Number(e)).split("").map((c) => SUPS[c] ?? c).join("");

/* A TRUE MINUS, U+2212, because the axis labels beside it use one and a tile
   reading "-0.539" next to an axis reading "−0.53" is two different characters
   for one idea on one figure. */
const signed = (v, digits = 3) => v.toFixed(digits).replace("-", "−");

/* --- the widget ------------------------------------------------------------ */

defineWidget({
  slug: "enrichment",
  status: "draft",
  title: "Enrichment Analysis",
  subtitle:
    "Every gene is ranked by how much it changed. Overrepresentation cuts that "
    + "ranking at a threshold and tests the overlap with a gene set against a "
    + "background of every gene there was. The enrichment score walks the whole "
    + "ranking instead, stepping up inside the set and down outside it, and "
    + "needs neither number.",
  layout: "side",

  /* Core hands `height` the values SPREAD, plus `w` — where `legend` gets
     `{ params }`. Both arguments are load-bearing here: the toggle adds a
     stage, and how tall that stage is depends on whether it fits in two
     columns. */
  height: ({ tests, w }) => canvasHeight(w, Boolean(tests)),

  params: {
    /* THE QUESTION COMES FIRST: which gene set are we asking about. A data
       parameter, because a different set is a different walk — the trace the
       animation reveals is a walk OF this set, not a view of one. */
    setKey: {
      type: "segmented",
      label: "Gene set",
      options: SET_KEYS.map((k) => ({ value: k, label: k.toUpperCase() })),
      detail: "three sets of thirty genes. Which is which is not on the rail",
      default: "a",
    },

    data: { type: "section", label: "The data" },

    /* THE WHOLE OF THE CUTOFF CLAIM SITS ON THIS CONTROL, and the default is
       measured rather than chosen: at `strong` all eight cutoffs find the set
       and there is nothing to see, at `moderate` they disagree on two thirds
       of seeds. § 5 of `_lab/enr-measure.mjs`. */
    effect: {
      type: "choice",
      label: "Differential expression",
      options: Object.entries(EFFECTS).map(([value, e]) => ({
        value, label: e.label, detail: e.detail,
      })),
      default: "moderate",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    test: { type: "section", label: "The test" },

    /* `display: true`, and it is the widget's claim made by the control's own
       behaviour: moving the cutoff must leave a walk the reader has just built
       exactly where it was. Core recomputes the state and keeps the animation,
       so ORA's numbers move under a curve that does not. */
    cutoff: {
      type: "int",
      label: "Gene list: the top k",
      detail: "how far down the ranking counts as differentially expressed",
      min: 5,
      max: 200,
      default: 60,
      display: true,
    },

    /* The fix a reader proposes within a minute of meeting the first one.
       Offered rather than applied, because § 6 measured it making ORA worse:
       it rescues the down-regulated set from 0% to 5-13% and costs the
       up-regulated one 95% -> 20%. */
    listMode: {
      type: "segmented",
      label: "Cut the ranking",
      options: [
        { value: "top", label: "At the top", detail: "the most up-regulated genes, as the lesson does" },
        { value: "both", label: "At both ends", detail: "the most changed genes, either direction" },
      ],
      default: "top",
      display: true,
    },

    /* `d <- 10000 - (a + b + c)`, which is cell 3 of the notebook with no
       comment on it. It enters the test through one cell of the table and
       nowhere else, which is exactly why nobody sees it move the answer. */
    background: {
      type: "choice",
      label: "Background",
      detail: "the genes the overlap is judged against",
      options: Object.entries(BACKGROUNDS).map(([value, b]) => ({
        value, label: b.label, detail: b.detail,
      })),
      default: "400",
      display: true,
    },

    /* ONE TOGGLE FOR BOTH MECHANISMS. The 2 x 2 and the permutation null are
       the same kind of object — how each of the two numbers in the readout was
       arrived at — so they open together or the reader has to find two doors
       to the same room.

       NOT `type: "gate"`, which was tried first and is wrong here: core takes
       step, run and reset out of the rail while a gate is shut, because a gate
       means the animation belongs to the stage behind it. Here the walk IS the
       main stage and these two panels are its footnotes, so gating them hid
       the Walk button behind a door that has nothing to do with it. */
    tests: {
      type: "bool",
      label: "Show how each p-value is computed",
      detail: "the 2 × 2 Fisher's test reads, and the scores a thousand random gene sets reach",
      default: false,
      display: true,
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({
        value, label: s.label, detail: s.detail,
      })),
      default: "medium",
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  /* The legend follows the figure: the null histogram is only drawn when the
     gate is open, so its entry is only in the legend then. */
  legend: ({ params }) => {
    const entries = [
      { token: "empirical", label: "how much each gene changed, ranked", mark: "bar" },
      { token: "highlight", label: `the thirty genes of set ${params.setKey.toUpperCase()}`, mark: "bar" },
      { token: "extreme", label: "the cutoff, and the gene list it makes", mark: "line" },
      { token: "empirical", label: "the running sum: up inside the set, down outside", mark: "line" },
    ];
    if (params.tests) {
      entries.push({
        token: "theory",
        label: `the score ${PERMS.toLocaleString()} random gene sets of the same size reach`,
        mark: "bar",
      });
    }
    return entries;
  },

  compute: ({ params, rng }) => {
    const stage = makeStage(rng, { shift: EFFECTS[params.effect]?.shift ?? 0.6 });
    const walk = gsea(stage, params.setKey);

    /* The positions in the ranking where the sum steps UP. The animation steps
       between these, and `draw` marks them — one array, so the button and the
       barcode cannot disagree about where a set gene is. */
    const hits = [];
    stage.rank.forEach((g, i) => { if (stage.sets[params.setKey].has(g)) hits.push(i); });

    /* The null is drawn from the SAME rng, after the stage, so it is fixed by
       the seed and identical on every recompute — including the recompute a
       display change triggers, which is what stops the histogram flickering
       while the cutoff is dragged.

       AND IT IS CACHED, which is a performance fix and not an optimisation
       reached for on principle. A thousand permutations is a thousand shuffles
       of four hundred genes and a thousand walks over them, and core recomputes
       the whole state on every DISPLAY change — so dragging the cutoff on the
       figure paid for it once per pointermove. Measured at 15.5 ms a frame
       against a 16.7 ms budget: not broken, but with nothing left over, and the
       drag is the one gesture this widget exists for.

       The key is every parameter the null depends on. It cannot go stale
       because `compute` is pure and seeded: the same three values give the same
       stage, and the same stage gives the same thousand draws. */
    const key = `${params.seed}|${params.effect}|${params.setKey}`;
    if (nullCache.key !== key) {
      nullCache.key = key;
      nullCache.value = gseaNull(stage, params.setKey, rng, PERMS);
    }

    return { stage, walk, hits, nul: nullCache.value };
  },

  /* THE CUTOFF IS DRAGGED ON THE FIGURE, and this is the gesture the widget is
     for: take hold of the line, pull it, and watch one number move while the
     curve under it does not. The rail slider stays — it is the keyboard and
     screen-reader route to the same parameter, and principle 5.7's rule for
     regions applies here for the same reason.

     THE STRIP ONLY, not the whole canvas. Widget 34 paid for the ungated
     version: a casual click on another panel nudged its threshold by ~0.02 per
     8px and the reader met the evidence later as a number they never set. Here
     the walk panel sits directly below and is the thing a reader is most likely
     to click on while watching it. */
  drag: {
    params: ["cutoff"],
    cursor: "ew-resize",
    hit: ({ x, y, w, h, params }) => {
      const L = layout(w, h, Boolean(params.tests));
      const on = x >= L.x0 && x <= L.x0 + L.pw
        && y >= L.profileY - 6 && y <= L.codeY + L.codeH + 4;
      /* WHICH HALF THE POINTER IS IN, remembered here because `value` is handed
         a MOVEMENT and never a position — by design, since a movement is what
         makes the gesture pure in `start`. Core calls this on every hover to
         set the cursor, and once more on pointerdown before the gesture opens;
         it is not called again while one is in flight, so what this leaves
         behind is exactly the grab point and it holds still for the drag. */
      if (on) grabbedPastMiddle = x > L.x0 + L.pw / 2;
      return on;
    },
    /* RELATIVE TO WHERE THE GESTURE BEGAN, which is core's contract and also
       what stops a slow drag accumulating rounding drift.

       Two subtleties at "both ends", where the list grows from BOTH edges:

       - each edge carries about half of k, so moving one edge by one gene
         changes k by two. Without the doubling the line tracks the pointer at
         exactly half speed, which reads as a sticky control rather than a
         wrong one — the kind of bug that survives review.
       - dragging INWARD must always mean "a longer list". A gesture that began
         on the right-hand edge therefore reads its dx backwards, or that edge
         runs away from the pointer instead of following it. */
    value: ({ dx, start, params, state, w, h }) => {
      const L = layout(w, h, Boolean(params.tests));
      const perGene = L.pw / state.stage.genes;
      const both = params.listMode === "both";
      const dir = both && grabbedPastMiddle ? -1 : 1;
      const k = start.cutoff + dir * (both ? 2 : 1) * (dx / perGene);
      return { cutoff: clamp(Math.round(k), 5, 200) };
    },
  },

  animation: {
    stepLabel: "Walk one",
    stepTitle: "Walk on to the next gene of the set — where the sum steps up",
    runLabel: "Walk",
    runTitle: "Walk the whole ranking, first to last",

    init: ({ params, state, fromScratch }) => ({
      /* First render honours `?shown=`, which is how a finished figure gets
         published into a lesson. Replay starts from nothing. */
      shown: fromScratch ? 0 : clamp(params.shown, 0, state.stage.genes),
      acc: 0,
      done: false,
    }),

    advance: (anim, { dt, params, state }) => {
      const total = state.stage.genes;
      if (anim.shown >= total) { anim.done = true; anim.acc = 0; return false; }

      const step = anim.mode === "step";
      const ms = step ? STEP_MS : (SPEEDS[params.speed] ?? SPEEDS.medium).ms;
      if (ms <= 0) { anim.shown = total; anim.acc = 0; anim.done = true; return false; }

      /* Where this press stops: the next position at which the sum rises, or
         the end of the ranking if there is none left. */
      const target = step
        ? (state.hits.find((i) => i + 1 > anim.shown) ?? total - 1) + 1
        : total;

      anim.acc += dt;
      while (anim.acc >= ms && anim.shown < target) {
        anim.acc -= ms;
        anim.shown += 1;
      }
      if (anim.shown >= total) { anim.acc = 0; anim.done = true; return false; }
      /* A step ends ON the set gene rather than part-way past it, so what rests
         on screen is the jump the press was about. */
      if (step && anim.shown >= target) { anim.acc = 0; return false; }
      return true;
    },

    /* Nothing downstream of a display change: the trace belongs to the set and
       the seed, and both are data parameters. Only the clamp is real — a seed
       change re-inits, but `shown` is carried across a `rebuild` and the stage
       is always the same length, so this is a guard rather than a fix. */
    rebuild: (anim, { state }) => {
      anim.shown = clamp(anim.shown, 0, state.stage.genes);
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const { stage, walk, nul } = state;
    const L = layout(w, h, params.tests);
    const shown = clamp(anim?.shown ?? 0, 0, stage.genes);
    ctx.__font = colors.font;
    ctx.save();
    ctx.lineJoin = "round";

    const xAt = (i) => L.x0 + (L.pw * i) / stage.genes;
    const inList = new Set(listPositions(stage, params.cutoff, params.listMode));

    /* ---- 1. the ranking ---------------------------------------------------- */

    text(ctx, "Every gene, ranked by how much it changed", L.x0, 12,
      { fill: colors.ink2, size: 11 });

    const sorted = stage.rank.map((g) => stage.score[g]);
    const span = Math.max(...sorted.map(Math.abs));
    const yFor = (t) => L.profileY + L.profileH / 2 - (L.profileH / 2 - 3) * (t / span);
    const zero = yFor(0);

    /* THE GENE LIST, as runs of shaded columns rather than one rectangle. At
       "both ends" the list is two blocks with the middle of the ranking
       between them, and a single rectangle would quietly claim otherwise. */
    ctx.fillStyle = colors.extreme;
    ctx.globalAlpha = 0.13;
    let runFrom = null;
    for (let i = 0; i <= stage.genes; i += 1) {
      const hit = i < stage.genes && inList.has(stage.rank[i]);
      if (hit && runFrom === null) runFrom = i;
      if (!hit && runFrom !== null) {
        ctx.fillRect(xAt(runFrom), L.profileY, xAt(i) - xAt(runFrom), L.profileH + 5 + L.codeH);
        runFrom = null;
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L.x0, zero); ctx.lineTo(L.x0 + L.pw, zero); ctx.stroke();

    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(L.x0, zero);
    sorted.forEach((t, i) => ctx.lineTo(xAt(i), yFor(t)));
    ctx.lineTo(L.x0 + L.pw, zero);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    /* The cutoff edges, drawn on top of the shading they bound, each with a
       grip at the top. The grip is the affordance: an `ew-resize` cursor only
       appears once the pointer is already over the strip, so without a mark
       there is nothing to tell a reader the line can be taken hold of. */
    ctx.strokeStyle = colors.extreme;
    ctx.fillStyle = colors.extreme;
    ctx.lineWidth = 1.5;
    for (let i = 1; i < stage.genes; i += 1) {
      if (inList.has(stage.rank[i - 1]) !== inList.has(stage.rank[i])) {
        const x = xAt(i);
        ctx.beginPath();
        ctx.moveTo(x, L.profileY);
        ctx.lineTo(x, L.profileY + L.profileH + 5 + L.codeH);
        ctx.stroke();
        ctx.fillRect(x - 3, L.profileY - 4, 6, 6);
      }
    }

    text(ctx, `+${span.toFixed(1)}`, L.x0 - 5, L.profileY + 6,
      { fill: colors.ink3, align: "right", size: 10 });
    text(ctx, "0", L.x0 - 5, zero, { fill: colors.ink3, align: "right", size: 10 });
    text(ctx, `−${span.toFixed(1)}`, L.x0 - 5, L.profileY + L.profileH - 6,
      { fill: colors.ink3, align: "right", size: 10 });

    /* ---- 2. who is in the set ---------------------------------------------- */

    ctx.fillStyle = colors.surface2;
    ctx.fillRect(L.x0, L.codeY, L.pw, L.codeH);
    ctx.fillStyle = colors.highlight;
    const tick = Math.max(1.2, L.pw / stage.genes);
    stage.rank.forEach((g, i) => {
      if (stage.sets[params.setKey].has(g)) ctx.fillRect(xAt(i), L.codeY, tick, L.codeH);
    });
    text(ctx, `set ${params.setKey.toUpperCase()}`, L.x0 - 5, L.codeY + L.codeH / 2,
      { fill: colors.ink3, align: "right", size: 10 });

    /* ---- 3. the walk ------------------------------------------------------- */

    const wSpan = Math.max(0.35, Math.abs(walk.es) * 1.2);
    const wFor = (t) => L.walkY + L.walkH / 2 - (L.walkH / 2 - 6) * (t / wSpan);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.x0, wFor(0)); ctx.lineTo(L.x0 + L.pw, wFor(0)); ctx.stroke();
    text(ctx, `+${wSpan.toFixed(2)}`, L.x0 - 5, L.walkY + 6,
      { fill: colors.ink3, align: "right", size: 10 });
    text(ctx, `−${wSpan.toFixed(2)}`, L.x0 - 5, L.walkY + L.walkH - 6,
      { fill: colors.ink3, align: "right", size: 10 });

    if (shown === 0) {
      /* THE WIDGET OPENS ON ITS DATA, NOT ITS ANSWER. The ranking and the set
         are given; the walk is the thing the reader builds. */
      text(ctx, "Press Walk to step through the ranking",
        L.x0 + L.pw / 2, L.walkY + L.walkH / 2,
        { fill: colors.ink3, align: "center", size: 12 });
    } else {
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(L.x0, wFor(0));
      for (let i = 0; i < shown; i += 1) ctx.lineTo(xAt(i + 1), wFor(walk.trace[i]));
      ctx.stroke();

      /* THE PEAK SO FAR, not the peak of the finished walk. A widget that
         printed the final score while the line was still climbing would be
         telling the reader the answer it is asking them to find. */
      let es = 0, esAt = 0;
      for (let i = 0; i < shown; i += 1) {
        if (Math.abs(walk.trace[i]) > Math.abs(es)) { es = walk.trace[i]; esAt = i + 1; }
      }
      const px = xAt(esAt);
      ctx.strokeStyle = colors.empirical;
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, wFor(0)); ctx.lineTo(px, wFor(es)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors.empirical;
      ctx.beginPath(); ctx.arc(px, wFor(es), 3, 0, 2 * Math.PI); ctx.fill();

      /* The label goes on whichever side of the peak has room. */
      const right = px < L.x0 + L.pw - 90;
      text(ctx, `${shown >= stage.genes ? "ES" : "so far"} ${signed(es)}`,
        px + (right ? 7 : -7), wFor(es) + (es > 0 ? -9 : 9),
        { fill: colors.empirical, align: right ? "left" : "right", size: 11, weight: "600" });
    }

    /* ---- the shared axis --------------------------------------------------- */

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L.x0, L.axisY); ctx.lineTo(L.x0 + L.pw, L.axisY); ctx.stroke();
    const every = L.pw < 420 ? 200 : 100;
    for (let r = 0; r < stage.genes; r += every) {
      const x = xAt(r);
      ctx.beginPath(); ctx.moveTo(x, L.axisY); ctx.lineTo(x, L.axisY + 4); ctx.stroke();
      text(ctx, String(r), x, L.axisY + 12, { fill: colors.ink3, align: "center", size: 10 });
    }
    /* THE LAST TICK NAMES THE AXIS. A right-aligned "rank" beside a centred
       "400" put two strings on the same pixel — found by measuring every
       fillText's box rather than by looking, which is the only way that one
       shows up at this size. */
    ctx.beginPath();
    ctx.moveTo(L.x0 + L.pw, L.axisY); ctx.lineTo(L.x0 + L.pw, L.axisY + 4); ctx.stroke();
    text(ctx, `rank ${stage.genes}`, L.x0 + L.pw, L.axisY + 12,
      { fill: colors.ink3, align: "right", size: 10 });

    /* ---- the gate: the two mechanisms -------------------------------------- */

    if (params.tests) {
      const o = ora(stage, params.setKey, params.cutoff, Number(params.background), params.listMode);
      const half = L.narrow ? L.pw : L.pw / 2 - 14;
      const leftX = L.x0;
      const rightX = L.narrow ? L.x0 : L.x0 + L.pw / 2 + 14;
      const rightY = L.narrow ? L.gateY + STACK_AT : L.gateY;
      drawTable(ctx, colors, leftX, L.gateY, half, o);
      drawNull(ctx, colors, rightX, rightY, half, shown >= stage.genes ? nul : null,
        shown >= stage.genes ? walk.es : null);
    }

    ctx.restore();
  },

  readout: ({ params, state, anim }) => {
    const { stage, walk, nul } = state;
    const shown = clamp(anim?.shown ?? 0, 0, stage.genes);
    const done = shown >= stage.genes;
    const o = ora(stage, params.setKey, params.cutoff, Number(params.background), params.listMode);

    const tiles = [
      { label: "Genes in the list", value: `${o.k}`, note: `of ${stage.genes} ranked` },
      { label: "In the list and the set", value: `${o.a}`,
        note: `of ${stage.sets[params.setKey].size} in set ${params.setKey.toUpperCase()}` },
      { label: "Overrepresentation", value: fmtP(o.p),
        note: `Fisher's exact test against ${o.universe.toLocaleString()} genes` },
      { break: true },
    ];

    if (!done) {
      tiles.push({
        label: "Enrichment score",
        value: shown === 0 ? "—" : `${signed(peakSoFar(walk.trace, shown))}…`,
        note: shown === 0
          ? "press Walk — it needs no cutoff and no background"
          : `${shown} of ${stage.genes} genes walked`,
      });
      return tiles;
    }

    tiles.push(
      { label: "Enrichment score", value: signed(walk.es),
        note: `the walk's furthest point from zero, at rank ${walk.esAt}` },
      { label: "Score, permuted", value: nul.p.toFixed(3),
        note: `${PERMS.toLocaleString()} random sets of the same size` },
    );
    return tiles;
  },
});

function peakSoFar(trace, shown) {
  let es = 0;
  for (let i = 0; i < shown; i += 1) if (Math.abs(trace[i]) > Math.abs(es)) es = trace[i];
  return es;
}

/* --- the gate's two panels -------------------------------------------------- */

/* ORA's mechanism: the 2 x 2 Fisher's test reads. `d` is written as the
   subtraction it is, because the whole of the background claim is that this
   cell was filled in by a number nobody looked at. */
function drawTable(ctx, colors, x0, y0, w, o) {
  const labW = Math.min(112, w * 0.42);
  const cw = (w - labW) / 2;
  const ch = 22;
  text(ctx, "Overrepresentation: one 2 × 2", x0, y0 - 2,
    { fill: colors.ink2, size: 11, weight: "600" });
  text(ctx, "in the set", x0 + labW + cw / 2, y0 + 16,
    { fill: colors.ink3, align: "center", size: 10 });
  text(ctx, "not in it", x0 + labW + cw * 1.5, y0 + 16,
    { fill: colors.ink3, align: "center", size: 10 });

  const cells = [[o.a, o.b], [o.c, o.d]];
  const rows = ["in the gene list", "not in the list"];
  for (let r = 0; r < 2; r += 1) {
    const y = y0 + 26 + r * ch;
    text(ctx, rows[r], x0 + labW - 7, y + ch / 2,
      { fill: colors.ink2, align: "right", size: 10 });
    for (let c = 0; c < 2; c += 1) {
      const x = x0 + labW + c * cw;
      const overlap = r === 0 && c === 0;
      if (overlap) {
        ctx.fillStyle = colors.highlight;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x, y, cw, ch);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cw, ch);
      text(ctx, String(cells[r][c]), x + cw / 2, y + ch / 2, {
        fill: overlap ? colors.highlight : colors.ink1,
        align: "center", size: 12, weight: overlap ? "600" : "",
      });
    }
  }
  /* BOTH LINES START AT THE PANEL'S OWN LEFT EDGE, not under the table. Set in
     from `labW` they were 271px long in a 341px half and ran under the
     histogram beside them. Both were shortened again after measuring them
     against a 286px canvas — the narrowest phone — where they ran 8px and 34px
     past its right edge. */
  text(ctx, `d = ${o.universe.toLocaleString()} − (${o.a} + ${o.b} + ${o.c}) = ${o.d}`,
    x0, y0 + 26 + 2 * ch + 13, { fill: colors.ink3, size: 10 });
  text(ctx, "the background is the only number nobody measured",
    x0, y0 + 26 + 2 * ch + 27, { fill: colors.ink3, size: 10 });
}

/* GSEA's mechanism: what a thousand random sets of the same size score.
   The null is TWO HUMPS and that is correct — the score is the furthest a walk
   gets from zero, so a walk that stays near zero is the rarest outcome and not
   the commonest. The caption says so, because every reader asks. */
function drawNull(ctx, colors, x0, y0, w, nul, obs) {
  text(ctx, `Enrichment score: ${PERMS.toLocaleString()} random sets`, x0, y0 - 2,
    { fill: colors.ink2, size: 11, weight: "600" });
  const h = 68;
  if (!nul) {
    text(ctx, "walk the whole ranking to compare against it",
      x0, y0 + h / 2, { fill: colors.ink3, size: 11 });
    return;
  }
  const lo = Math.min(-0.9, ...nul.draws, obs);
  const hi = Math.max(0.9, ...nul.draws, obs);
  const bins = 44;
  const counts = new Array(bins).fill(0);
  for (const d of nul.draws) {
    counts[clamp(Math.floor(((d - lo) / (hi - lo)) * bins), 0, bins - 1)] += 1;
  }
  const top = Math.max(...counts);
  const bx = (t) => x0 + (w * (t - lo)) / (hi - lo);
  ctx.fillStyle = colors.theory;
  ctx.globalAlpha = 0.85;
  counts.forEach((c, i) => {
    const bh = (h - 14) * (c / top);
    ctx.fillRect(bx(lo + ((hi - lo) * i) / bins), y0 + 16 + (h - 14 - bh),
      Math.max(1, w / bins - 1), bh);
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0 + 16 + h - 14); ctx.lineTo(x0 + w, y0 + 16 + h - 14); ctx.stroke();

  const ox = bx(obs);
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ox, y0 + 14); ctx.lineTo(ox, y0 + 16 + h - 14); ctx.stroke();
  const right = ox < x0 + w - 64;
  text(ctx, `this set, ${signed(obs, 2)}`, ox + (right ? 5 : -5), y0 + 20,
    { fill: colors.empirical, align: right ? "left" : "right", size: 10, weight: "600" });
  text(ctx, "two humps: a score is how far a walk gets from zero",
    x0, y0 + 16 + h + 6, { fill: colors.ink3, size: 10 });
}
