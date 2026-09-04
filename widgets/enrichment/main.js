/* ============================================================================
   Enrichment Analysis — PHM5003 `05 - Introduction to High Throughput Data`,
   notebook `09 - Enrichment Analysis`. Slot 5 of the high-throughput arc.

   TWO TABS, IN THE NOTEBOOK'S OWN ORDER, and they are deliberately NOT two
   views of one picture. The lesson motivates GSEA by ORA's threshold —
   "without needing a predefined threshold for gene selection" is its own
   phrase — so the two are a sequence, and each tab shows what its own method
   actually looks at.

   TAB 1, OVERREPRESENTATION, HAS NO RANKING ON IT. That is the point of the
   method: ORA is handed a LIST and a PATHWAY and counts the overlap, and it
   never learns the order the list came in. Drawing a ranking behind it says
   otherwise. So the tab shows the two groups, the 2 x 2 they make, and what
   happens when the same test is run over a whole collection — which is where
   enrichment analysis really lives and where cell 5's `p.adjust` finally has
   something to do. The notebook admits its own gap there: "in this case, no
   correction as there is only one p-value".

   TAB 2, THE ENRICHMENT SCORE, IS ALL RANKING, because that is what the score
   reads. ORA survives on it as a FOIL — the cutoff drawn ghosted, ORA's
   verdict as one readout tile — which is what carries the result the widget is
   for: a genuinely enriched pathway that ORA scores at p = 0.96 and the score
   at p = 0.002.

   HOW THE SHAPE WAS SETTLED. Three figures were drawn at the real width
   against this engine in `_lab/enr-shape.html` and Kenneth picked one; the
   tabs then came back as his pedagogical call, and the ranking came off tab 1
   as his call after that. Each of those was a better answer than the drawing
   it replaced, and none of them was available from the measurement alone.

   WHAT THE ARC MUST NOT SAY is that sophistication removes arbitrary choices.
   ORA's are the cutoff and the background; GSEA drops both and picks up the
   ranking metric and the permutation scheme. The choices move, they do not
   disappear — the same shape as widget 42, where the tree is evidence and the
   cut is a choice. See NOT YET BUILT at the foot of this file.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import {
  makeStage, ora, oraAll, gsea, gseaNull, listPositions,
  EFFECTS, BACKGROUNDS, N_SETS,
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

/* A STEP IS ONE GENE OF THE PATHWAY, not one gene of the ranking. One gene of
   400 is under two pixels wide and a press that moves the figure two pixels
   reads as a broken button. The sum only RISES at a pathway gene, so stepping
   to the next one is also the only step that shows the mechanism: the line
   drains while the walk crosses genes outside, then jumps when it arrives. */
const STEP_MS = 42;

const PERMS = 1000;
const ALPHA = 0.05;

/* Set by the drag's hit-test, read by its `value`. See the comment there for
   why a movement-only contract needs this and why one variable is safe. */
let grabbedPastMiddle = false;

/* The permutation null, kept across the recomputes a display change forces.
   Keyed on the parameters it depends on; see `compute`. */
const nullCache = { key: null, value: null };

const isOra = (params) => params.view === "ora";
const setIndex = (params) => clamp(Number(params.pathway) || 0, 0, N_SETS - 1);

/* --- geometry ------------------------------------------------------------- *
 * Everything is derived from `w` and `h`, so a narrow phone gets the same
 * figure rather than a clipped one.
 *
 * THE TWO TABS SHARE NO PANELS AT ALL, which is why the layout is two
 * functions rather than one with branches everywhere. */
const TITLE_H = 26;
const AXIS_H = 20;
const GROUPS_H = 88;      /* the two proportional bars and their labels */
const TABLE_H = 103;      /* the 2 x 2, heading to the foot of its captions */
const PANEL_H = 118;      /* every pathway's p-value, and the two thresholds */
const NULL_H = 96;        /* the permutation histogram and its caption */

function canvasHeight(w, view) {
  return view === "ora"
    ? TITLE_H + GROUPS_H + 16 + TABLE_H + 18 + PANEL_H
    : TITLE_H + 250 + AXIS_H + 12 + NULL_H + 8;
}

function layoutOra(w, h) {
  const padL = w < 460 ? 10 : 14;
  const x0 = padL;
  const pw = w - padL - (w < 460 ? 8 : 14);
  const groupsY = TITLE_H;
  const tableY = groupsY + GROUPS_H + 16;
  const panelY = tableY + TABLE_H + 18;
  return { x0, pw, groupsY, tableY, panelY, narrow: w < 560 };
}

function layoutGsea(w, h) {
  const padL = w < 460 ? 34 : 46;
  const x0 = padL;
  const pw = w - padL - (w < 460 ? 8 : 14);
  const strips = h - TITLE_H - AXIS_H - 12 - NULL_H - 8;
  const profileH = Math.round(strips * 0.42);
  const codeH = Math.max(14, Math.round(strips * 0.09));
  const walkH = strips - profileH - codeH - 10;
  const profileY = TITLE_H;
  const codeY = profileY + profileH + 5;
  const walkY = codeY + codeH + 5;
  const axisY = walkY + walkH;
  return {
    x0, pw, profileY, profileH, codeY, codeH, walkY, walkH, axisY,
    panelY: axisY + AXIS_H + 12, narrow: w < 560,
  };
}

const layout = (w, h, view) => (view === "ora" ? layoutOra(w, h) : layoutGsea(w, h));

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

const peakSoFar = (trace, shown) => {
  let es = 0;
  for (let i = 0; i < shown; i += 1) if (Math.abs(trace[i]) > Math.abs(es)) es = trace[i];
  return es;
};

/* --- the widget ------------------------------------------------------------ */

defineWidget({
  slug: "enrichment",
  status: "draft",
  title: "Enrichment Analysis",
  subtitle:
    "Overrepresentation counts how much of your gene list falls in a pathway "
    + "and tests that against a background — once per pathway, so the p-values "
    + "need correcting. The enrichment score cuts no list at all: it walks the "
    + "whole ranking, up inside the pathway and down outside.",
  layout: "side",

  height: ({ view, w }) => canvasHeight(w, view),

  params: {
    /* THE TAB FIRST, and the order of its options is the lesson's order. */
    view: {
      type: "segmented",
      label: "Method",
      options: [
        { value: "ora", label: "Overrepresentation",
          detail: "a list, a pathway, and the overlap between them — no ranking anywhere in it" },
        { value: "gsea", label: "Enrichment score",
          detail: "the whole ranking, walked; no list and no cut" },
      ],
      default: "ora",
      display: true,
    },

    /* A SELECT, NOT A SEGMENTED GROUP: twenty options is what `select` is for.
       The panel on ORA's tab is the faster route — every pathway's result is
       drawn there and clicking one selects it — but the dropdown is the
       keyboard and screen-reader path to the same parameter, so it stays.
       Principle 5.7. */
    pathway: {
      type: "select",
      label: "Pathway",
      options: Array.from({ length: N_SETS }, (_, i) => ({
        value: String(i), label: `Pathway ${i + 1}`,
      })),
      default: "0",
      display: true,
    },

    data: { type: "section", label: "The data" },

    /* Measured rather than chosen: at `strong` every cutoff finds the planted
       pathways and there is nothing to see; at `moderate` the collection comes
       out with a median of two significant results and one surviving the
       correction. §§ 5 and 7 of `_lab/enr-measure.mjs`. */
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

    /* ON BOTH TABS, and deliberately — the one control widget 42's rule about
       hiding an inert control does NOT cover. On the enrichment tab it looks
       like it should do nothing, and that IS the lesson: it moves ORA's verdict
       in the foil tile and leaves the score untouched. A control the reader
       watches fail to matter is not the same as a dead one.

       `display: true`, so moving it leaves a walk the reader has just built
       exactly where it was. */
    cutoff: {
      type: "int",
      label: "Genes in the list",
      detail: "how many of the most changed genes you call differentially expressed",
      min: 5,
      max: 200,
      default: 60,
      display: true,
    },

    /* The fix a reader proposes within a minute of meeting the first one.
       Offered rather than applied, because § 6 measured it making ORA worse.
       ORA'S TAB ONLY: it and the background are how ORA cuts and what ORA
       counts against, and the score reads neither. */
    listMode: {
      type: "segmented",
      label: "Take the genes",
      options: [
        { value: "top", label: "Most up", detail: "the most up-regulated, as the lesson does" },
        { value: "both", label: "Most changed", detail: "the largest changes in either direction" },
      ],
      default: "top",
      display: true,
      when: { param: "view", equals: "ora" },
    },

    /* `d <- 10000 - (a + b + c)`, which is cell 3 with no comment on it. It
       enters the test through one cell of the table and nowhere else, which is
       exactly why nobody sees it move the answer. */
    background: {
      type: "choice",
      label: "Background",
      detail: "the genes the overlap is judged against",
      options: Object.entries(BACKGROUNDS).map(([value, b]) => ({
        value, label: b.label, detail: b.detail,
      })),
      default: "400",
      display: true,
      when: { param: "view", equals: "ora" },
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
      when: { param: "view", equals: "gsea" },
    },

    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  /* ONE TAB'S MARKS AT A TIME. The tabs share no panels, so a shared legend
     would describe a running sum beside a figure that draws none — the rule
     widget 30 earned and widget 42 restated. */
  legend: ({ params }) => {
    const name = `Pathway ${setIndex(params) + 1}`;
    if (isOra(params)) {
      return [
        { token: "extreme", label: "your gene list", mark: "bar" },
        { token: "highlight", label: `${name}, and the genes it shares with the list`, mark: "bar" },
        { token: "theory", label: "a pathway that survives the correction", mark: "bar" },
        { token: "reference", label: "0.05, and the raw p-value the correction ends up demanding", mark: "dash" },
        { token: "highlight", label: "the pathway you have selected", mark: "line" },
      ];
    }
    return [
      { token: "empirical", label: "how much each gene changed, ranked", mark: "bar" },
      { token: "highlight", label: `the genes of ${name}`, mark: "bar" },
      { token: "empirical", label: "the running sum: up inside the pathway, down outside", mark: "line" },
      { token: "extreme", label: "the cutoff — drawn, but the score never reads it", mark: "dash" },
      { token: "theory", label: `the score ${PERMS.toLocaleString()} random pathways of the same size reach`, mark: "bar" },
    ];
  },

  compute: ({ params, rng }) => {
    const stage = makeStage(rng, { shift: EFFECTS[params.effect]?.shift ?? 0.6 });
    const i = setIndex(params);
    const walk = gsea(stage, i);

    /* The positions in the ranking where the sum steps UP. The animation steps
       between these and `draw` marks them — one array, so the button and the
       barcode cannot disagree about where a pathway gene is. */
    const hits = [];
    stage.rank.forEach((g, j) => { if (stage.sets[i].members.has(g)) hits.push(j); });

    /* CACHED on the parameters it depends on, which is a performance fix rather
       than an optimisation reached for on principle. Core recomputes the whole
       state on every DISPLAY change, so dragging the cutoff on the figure paid
       for a thousand permutations per pointermove: 15.5 ms a frame against a
       16.7 ms budget, now 2.5 ms. It cannot go stale — `compute` is pure and
       seeded, so the same three values give the same thousand draws. */
    const key = `${params.seed}|${params.effect}|${i}`;
    if (nullCache.key !== key) {
      nullCache.key = key;
      nullCache.value = gseaNull(stage, i, rng, PERMS);
    }

    return { stage, walk, hits, nul: nullCache.value };
  },

  /* CLICK A PATHWAY IN THE PANEL TO SELECT IT, which is how anyone reads an
     enrichment result: you look at the collection, then at the one that came
     out. Only on ORA's tab, since that is the tab the panel is on. */
  regions: ({ w, h, params, state }) => {
    /* `state` is null when core probes the region table at load to validate the
       parameter names, which happens before the first compute. Returning an
       empty table there is correct: there is nothing on the canvas to hit yet. */
    if (!isOra(params) || !state) return [];
    const L = layoutOra(w, h);
    const n = state.stage.sets.length;
    const bw = L.pw / n;
    return state.stage.sets.map((s, i) => ({
      x: L.x0 + i * bw,
      y: L.panelY + 14,
      w: bw,
      h: PANEL_H - 30,
      set: { pathway: String(i) },
      label: s.label,
    }));
  },

  /* THE CUTOFF IS DRAGGED ON THE RANKING, so the gesture exists on the
     enrichment tab only — ORA's tab has no ranking to drag it along, which is
     the whole point of that tab. The rail slider is the route on both. */
  drag: {
    params: ["cutoff"],
    cursor: "ew-resize",
    hit: ({ x, y, w, h, params }) => {
      if (isOra(params)) return false;
      const L = layoutGsea(w, h);
      const on = x >= L.x0 && x <= L.x0 + L.pw
        && y >= L.profileY - 6 && y <= L.codeY + L.codeH + 4;
      /* WHICH HALF THE POINTER IS IN, remembered here because `value` is handed
         a MOVEMENT and never a position — by design, since a movement is what
         makes the gesture pure in `start`. Core calls this on every hover to
         set the cursor and once more on pointerdown before the gesture opens,
         and not again while one is in flight, so what it leaves behind is
         exactly the grab point and it holds still for the drag. */
      if (on) grabbedPastMiddle = x > L.x0 + L.pw / 2;
      return on;
    },
    value: ({ dx, start, params, state, w, h }) => {
      const L = layoutGsea(w, h);
      const perGene = L.pw / state.stage.genes;
      const k = start.cutoff + dx / perGene;
      return { cutoff: clamp(Math.round(k), 5, 200) };
    },
  },

  animation: {
    stepLabel: "Walk one",
    stepTitle: "Walk on to the next gene of the pathway — where the sum steps up",
    runLabel: "Walk",
    runTitle: "Walk the whole ranking, first to last",

    init: ({ params, state, fromScratch }) => ({
      shown: fromScratch ? 0 : clamp(params.shown, 0, state.stage.genes),
      acc: 0,
      done: false,
      /* Core takes step and run out of the rail when there is nothing to drive.
         ORA's tab draws no walk. */
      inert: isOra(params),
    }),

    advance: (anim, { dt, params, state }) => {
      const total = state.stage.genes;
      if (anim.shown >= total) { anim.done = true; anim.acc = 0; return false; }

      const step = anim.mode === "step";
      const ms = step ? STEP_MS : (SPEEDS[params.speed] ?? SPEEDS.medium).ms;
      if (ms <= 0) { anim.shown = total; anim.acc = 0; anim.done = true; return false; }

      const target = step
        ? (state.hits.find((i) => i + 1 > anim.shown) ?? total - 1) + 1
        : total;

      anim.acc += dt;
      while (anim.acc >= ms && anim.shown < target) {
        anim.acc -= ms;
        anim.shown += 1;
      }
      if (anim.shown >= total) { anim.acc = 0; anim.done = true; return false; }
      if (step && anim.shown >= target) { anim.acc = 0; return false; }
      return true;
    },

    /* Switching tabs must not discard the walk. `view` is a display parameter,
       so core rebuilds rather than re-inits, and the only thing that actually
       changes is whether there is anything to drive. */
    rebuild: (anim, { params, state }) => {
      anim.shown = clamp(anim.shown, 0, state.stage.genes);
      anim.inert = isOra(params);
    },
  },

  draw: (args) => (isOra(args.params) ? drawOra(args) : drawGsea(args)),

  readout: ({ params, state, anim }) => {
    const { stage, walk, nul } = state;
    const i = setIndex(params);
    const universe = Number(params.background);
    const all = oraAll(stage, params.cutoff, universe, params.listMode);
    const mine = all[i];

    if (isOra(params)) {
      const rawHits = all.filter((r) => r.p < ALPHA).length;
      const adjHits = all.filter((r) => r.padj < ALPHA).length;
      return [
        { label: "Genes in the list", value: `${mine.k}`, note: `of ${stage.genes} ranked` },
        { label: "In the list and the pathway", value: `${mine.a}`,
          note: `of ${stage.sets[i].size} in Pathway ${i + 1}` },
        { label: "Overrepresentation", value: fmtP(mine.p),
          note: `Fisher's exact test against ${universe.toLocaleString()} genes` },
        { break: true },
        { label: "After correction", value: fmtP(mine.padj),
          note: `Benjamini–Hochberg over all ${N_SETS} pathways` },
        { label: "Pathways significant", value: `${rawHits} → ${adjHits}`,
          note: `at 0.05, before and after correcting` },
      ];
    }

    const shown = clamp(anim?.shown ?? 0, 0, stage.genes);
    const done = shown >= stage.genes;

    /* ORA AS A FOIL, one tile. This is what the tab split would otherwise cost:
       the result the widget is for — a pathway ORA scores at 0.96 and the score
       at 0.002 — needs both numbers on one screen, and this is the screen where
       the second one is being taught. */
    const foil = {
      label: "Overrepresentation said",
      value: fmtP(mine.p),
      note: `cut at ${mine.k}; ${fmtP(mine.padj)} after correction`,
    };

    if (!done) {
      return [
        foil,
        { break: true },
        { label: "Enrichment score",
          value: shown === 0 ? "—" : `${signed(peakSoFar(walk.trace, shown))}…`,
          note: shown === 0
            ? "press Walk — it reads neither of those numbers"
            : `${shown} of ${stage.genes} genes walked` },
      ];
    }
    return [
      foil,
      { break: true },
      { label: "Enrichment score", value: signed(walk.es),
        note: `the walk's furthest point from zero, at rank ${walk.esAt}` },
      { label: "Score, permuted", value: nul.p.toFixed(3),
        note: `${PERMS.toLocaleString()} random pathways of the same size` },
    ];
  },
});

/* --- tab 1: overrepresentation --------------------------------------------- */

function drawOra({ ctx, colors, w, h, params, state }) {
  const { stage } = state;
  const L = layoutOra(w, h);
  const i = setIndex(params);
  const universe = Number(params.background);
  const all = oraAll(stage, params.cutoff, universe, params.listMode);
  const o = all[i];
  ctx.__font = colors.font;
  ctx.save();

  text(ctx, "Your gene list and one pathway, and the genes in both",
    L.x0, 12, { fill: colors.ink2, size: 11 });

  drawGroups(ctx, colors, L.x0, L.groupsY, L.pw, o, i);
  drawTable(ctx, colors, L.x0, L.tableY, L.pw, o);
  drawPanel(ctx, colors, L.x0, L.panelY, L.pw, all, i);

  ctx.restore();
}

/* THE TWO GROUPS, laid out on ONE scale in genes so the overlap is exact
   rather than suggestive: the union runs [ b | a | c ] across the width, the
   list is the left b + a of it and the pathway the right a + c, and the column
   where they meet is `a` genes wide because that is what `a` means. A Venn of
   two circles would have been the recognisable idiom and could not have been
   drawn to scale — the lens area of two overlapping circles is not something
   you can set to an arbitrary number and keep both radii honest. */
function drawGroups(ctx, colors, x0, y0, w, o, index) {
  const union = o.a + o.b + o.c;
  const per = w / Math.max(1, union);
  const barH = 18;
  const listW = (o.a + o.b) * per;
  const pathX = x0 + o.b * per;
  const pathW = (o.a + o.c) * per;
  const overX = pathX;
  const overW = o.a * per;

  /* THE GAP BETWEEN THE BARS HOLDS THE OVERLAP COUNT, so it is 18px and not 8.
     At 8 the count sat on top of the pathway bar's own label — both of them
     start at the overlap's left edge, because that is where the pathway
     begins. Found by measuring the fillText boxes, not by looking. */
  const rowA = y0 + 14;
  const rowB = rowA + barH + 18;

  /* the shared column, drawn behind both bars so it reads as one region */
  if (o.a > 0) {
    ctx.fillStyle = colors.highlight;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(overX, rowA - 4, overW, rowB + barH + 4 - (rowA - 4));
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.extreme;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(x0, rowA, listW, barH);
  ctx.globalAlpha = 1;
  text(ctx, `your gene list — ${o.a + o.b}`, x0 + 6, rowA + barH / 2,
    { fill: colors.surface, size: 10, weight: "600" });

  ctx.fillStyle = colors.highlight;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(pathX, rowB, pathW, barH);
  ctx.globalAlpha = 1;
  /* THE PATHWAY'S LABEL SITS AT ITS BAR'S RIGHT END, one rule rather than
     three cases. It used to start at the bar's LEFT edge, which is where the
     shared column starts too, so it printed under the overlap count; moving it
     after the overlap then ran it off the canvas whenever the bar was narrow —
     a long gene list pushes the pathway into the last sixth of the width. The
     right end is inside the bar in both of those, and where the bar is too
     narrow for the label at all it goes to the LEFT of it, in ink, where a
     long list always leaves room. */
  ctx.font = `600 10px ${ctx.__font}`;
  const pathLabel = `Pathway ${index + 1} — ${o.a + o.c}`;
  const labelW = ctx.measureText(pathLabel).width;
  const inside = labelW + 12 < pathW;
  text(ctx, pathLabel, inside ? pathX + pathW - 6 : pathX - 6, rowB + barH / 2,
    { fill: inside ? colors.surface : colors.ink2, align: "right", size: 10, weight: "600" });

  if (o.a > 0) {
    text(ctx, String(o.a), overX + overW / 2, rowA + barH + 9,
      { fill: colors.highlight, align: "center", size: 11, weight: "600" });
  }
  /* NAMES THE ENCODING rather than restating the count above it — and fits the
     narrowest canvas, 286px, which the sentence it replaced did not. */
  text(ctx, o.a > 0
    ? "widths are gene counts; the shared column is the overlap"
    : "widths are gene counts; no gene is in both",
    x0, rowB + barH + 12, { fill: colors.ink3, size: 10 });
}

/* The 2 x 2 Fisher's exact test is handed. `d` is written as the subtraction it
   is, because the whole of the background claim is that this cell was filled in
   by a number nobody looked at. */
function drawTable(ctx, colors, x0, y0, w, o) {
  const labW = Math.min(120, w * 0.30);
  const cw = Math.min(150, (w - labW) / 2);
  const ch = 22;
  text(ctx, "What Fisher's exact test is handed", x0, y0 - 2,
    { fill: colors.ink2, size: 11, weight: "600" });
  text(ctx, "in the pathway", x0 + labW + cw / 2, y0 + 16,
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
  /* Both lines start at the panel's own left edge, and both were shortened
     after measuring them against a 286px canvas — the narrowest phone — where
     they ran past its right edge. */
  text(ctx, `d = ${o.universe.toLocaleString()} − (${o.a} + ${o.b} + ${o.c}) = ${o.d}`,
    x0, y0 + 26 + 2 * ch + 13, { fill: colors.ink3, size: 10 });
  text(ctx, "the background is the only number nobody measured",
    x0, y0 + 26 + 2 * ch + 27, { fill: colors.ink3, size: 10 });
}

/* EVERY PATHWAY, TESTED, AND WHAT THE CORRECTION DOES TO THEM. One bar per
   pathway at -log10(p), the 0.05 line, and the raw p-value the Benjamini-
   Hochberg step ends up demanding — which is a LOWER line, and that is the
   whole of what a correction is.

   THE BH THRESHOLD IS DRAWN AS THE LARGEST RAW p THAT SURVIVES, not as a fixed
   number, because BH's cutoff is rank-dependent and there is no single p it
   compares against. Drawing one anyway would be a lie about the method; taking
   the largest survivor is the honest reading of "what it ended up demanding",
   and where nothing survives there is no line to draw. */
function drawPanel(ctx, colors, x0, y0, w, all, index) {
  const n = all.length;
  const barsY = y0 + 14;
  const barsH = PANEL_H - 30;
  const bw = w / n;
  const survivors = all.filter((r) => r.padj < ALPHA);
  const bhP = survivors.length ? Math.max(...survivors.map((r) => r.p)) : null;

  const CAP = 6;                                   /* -log10(p) axis top */
  const top = Math.max(2.2, ...all.map((r) => Math.min(CAP, -Math.log10(Math.max(r.p, 1e-300)))));
  const yFor = (v) => barsY + barsH - (barsH - 4) * (Math.min(v, CAP) / top);

  text(ctx, `All ${n} pathways, each tested the same way`, x0, y0 - 2,
    { fill: colors.ink2, size: 11, weight: "600" });

  for (let i = 0; i < n; i += 1) {
    const r = all[i];
    const v = -Math.log10(Math.max(r.p, 1e-300));
    const x = x0 + i * bw;
    const yTop = yFor(v);
    const survives = r.padj < ALPHA;
    ctx.fillStyle = survives ? colors.theory : colors.ink3;
    ctx.globalAlpha = i === index ? 1 : (survives ? 0.85 : 0.4);
    ctx.fillRect(x + 1.5, yTop, Math.max(2, bw - 3), barsY + barsH - yTop);
    ctx.globalAlpha = 1;
    if (i === index) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, barsY - 3, bw - 1, barsH + 3);
    }
  }

  /* the two thresholds */
  const rule = (p, label, dash) => {
    const y = yFor(-Math.log10(p));
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1;
    ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    ctx.setLineDash([]);
    if (label) text(ctx, label, x0 + w, y - 7, { fill: colors.ink3, align: "right", size: 10 });
    return y;
  };
  const alphaY = rule(ALPHA, "0.05", [4, 3]);
  if (bhP !== null) {
    /* THE SECOND LABEL IS SUPPRESSED BY PIXELS, not by a difference in log
       units. The first guard compared -log10 values and let 0.12 through, which
       is under two pixels on this panel — so the two labels printed on top of
       each other wherever the correction happened to land near 0.05. */
    const bhY = yFor(-Math.log10(bhP));
    rule(bhP, Math.abs(bhY - alphaY) > 13 ? "what the correction demanded" : "", [1, 3]);
  }

  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, barsY + barsH); ctx.lineTo(x0 + w, barsY + barsH); ctx.stroke();
  text(ctx, `Pathway 1`, x0, barsY + barsH + 11, { fill: colors.ink3, size: 10 });
  text(ctx, `${n}`, x0 + w, barsY + barsH + 11,
    { fill: colors.ink3, align: "right", size: 10 });
  text(ctx, "higher is a smaller p-value", x0 + w / 2, barsY + barsH + 11,
    { fill: colors.ink3, align: "center", size: 10 });
}

/* --- tab 2: the enrichment score -------------------------------------------- */

function drawGsea({ ctx, colors, w, h, params, state, anim }) {
  const { stage, walk, nul } = state;
  const L = layoutGsea(w, h);
  const i = setIndex(params);
  const shown = clamp(anim?.shown ?? 0, 0, stage.genes);
  ctx.__font = colors.font;
  ctx.save();
  ctx.lineJoin = "round";

  const xAt = (j) => L.x0 + (L.pw * j) / stage.genes;
  const inList = new Set(listPositions(stage, params.cutoff, params.listMode));

  text(ctx, "Every gene ranked — the score reads all of it",
    L.x0, 12, { fill: colors.ink2, size: 11 });

  const sorted = stage.rank.map((g) => stage.score[g]);
  const span = Math.max(...sorted.map(Math.abs));
  const yFor = (t) => L.profileY + L.profileH / 2 - (L.profileH / 2 - 3) * (t / span);
  const zero = yFor(0);

  /* THE CUTOFF AS A GHOST. Drawing nothing here would be tidier and would lose
     the argument: the score's independence from the cutoff is only visible
     against a cutoff. */
  ctx.fillStyle = colors.extreme;
  ctx.globalAlpha = 0.05;
  let runFrom = null;
  for (let j = 0; j <= stage.genes; j += 1) {
    const hit = j < stage.genes && inList.has(stage.rank[j]);
    if (hit && runFrom === null) runFrom = j;
    if (!hit && runFrom !== null) {
      ctx.fillRect(xAt(runFrom), L.profileY, xAt(j) - xAt(runFrom), L.profileH + 5 + L.codeH);
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
  sorted.forEach((t, j) => ctx.lineTo(xAt(j), yFor(t)));
  ctx.lineTo(L.x0 + L.pw, zero);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.extreme;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([3, 3]);
  for (let j = 1; j < stage.genes; j += 1) {
    if (inList.has(stage.rank[j - 1]) !== inList.has(stage.rank[j])) {
      const x = xAt(j);
      ctx.beginPath();
      ctx.moveTo(x, L.profileY);
      ctx.lineTo(x, L.profileY + L.profileH + 5 + L.codeH);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  text(ctx, `+${span.toFixed(1)}`, L.x0 - 5, L.profileY + 6,
    { fill: colors.ink3, align: "right", size: 10 });
  text(ctx, "0", L.x0 - 5, zero, { fill: colors.ink3, align: "right", size: 10 });
  text(ctx, `−${span.toFixed(1)}`, L.x0 - 5, L.profileY + L.profileH - 6,
    { fill: colors.ink3, align: "right", size: 10 });

  /* who is in the pathway */
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(L.x0, L.codeY, L.pw, L.codeH);
  ctx.fillStyle = colors.highlight;
  const tick = Math.max(1.2, L.pw / stage.genes);
  stage.rank.forEach((g, j) => {
    if (stage.sets[i].members.has(g)) ctx.fillRect(xAt(j), L.codeY, tick, L.codeH);
  });
  text(ctx, `P${i + 1}`, L.x0 - 5, L.codeY + L.codeH / 2,
    { fill: colors.ink3, align: "right", size: 10 });

  /* the walk */
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
    text(ctx, "Press Walk to step through the ranking",
      L.x0 + L.pw / 2, L.walkY + L.walkH / 2,
      { fill: colors.ink3, align: "center", size: 12 });
  } else {
    ctx.strokeStyle = colors.empirical;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(L.x0, wFor(0));
    for (let j = 0; j < shown; j += 1) ctx.lineTo(xAt(j + 1), wFor(walk.trace[j]));
    ctx.stroke();

    /* THE PEAK SO FAR, not the peak of the finished walk. A widget that printed
       the final score while the line was still climbing would be telling the
       reader the answer it is asking them to find. */
    const es = peakSoFar(walk.trace, shown);
    let esAt = 0;
    for (let j = 0; j < shown; j += 1) if (walk.trace[j] === es) { esAt = j + 1; break; }
    const px = xAt(esAt);
    ctx.strokeStyle = colors.empirical;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, wFor(0)); ctx.lineTo(px, wFor(es)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.empirical;
    ctx.beginPath(); ctx.arc(px, wFor(es), 3, 0, 2 * Math.PI); ctx.fill();

    const right = px < L.x0 + L.pw - 90;
    text(ctx, `${shown >= stage.genes ? "ES" : "so far"} ${signed(es)}`,
      px + (right ? 7 : -7), wFor(es) + (es > 0 ? -9 : 9),
      { fill: colors.empirical, align: right ? "left" : "right", size: 11, weight: "600" });
  }

  /* the shared axis */
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(L.x0, L.axisY); ctx.lineTo(L.x0 + L.pw, L.axisY); ctx.stroke();
  const every = L.pw < 420 ? 200 : 100;
  for (let r = 0; r < stage.genes; r += every) {
    const x = xAt(r);
    ctx.beginPath(); ctx.moveTo(x, L.axisY); ctx.lineTo(x, L.axisY + 4); ctx.stroke();
    text(ctx, String(r), x, L.axisY + 12, { fill: colors.ink3, align: "center", size: 10 });
  }
  /* THE LAST TICK NAMES THE AXIS. A right-aligned "rank" beside a centred "400"
     put two strings on the same pixel — found by measuring every fillText's box
     rather than by looking, which is the only way that shows up at this size. */
  ctx.beginPath();
  ctx.moveTo(L.x0 + L.pw, L.axisY); ctx.lineTo(L.x0 + L.pw, L.axisY + 4); ctx.stroke();
  text(ctx, `rank ${stage.genes}`, L.x0 + L.pw, L.axisY + 12,
    { fill: colors.ink3, align: "right", size: 10 });

  drawNull(ctx, colors, L.x0, L.panelY, L.pw,
    shown >= stage.genes ? nul : null, shown >= stage.genes ? walk.es : null);

  ctx.restore();
}

/* What a thousand random pathways of the same size score.
   The null is TWO HUMPS and that is correct — the score is the furthest a walk
   gets from zero, so a walk that stays near zero is the rarest outcome and not
   the commonest. The caption says so, because every reader asks. */
function drawNull(ctx, colors, x0, y0, w, nul, obs) {
  text(ctx, `What ${PERMS.toLocaleString()} random pathways score`, x0, y0 - 2,
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
  text(ctx, `this pathway, ${signed(obs, 2)}`, ox + (right ? 5 : -5), y0 + 20,
    { fill: colors.empirical, align: right ? "left" : "right", size: 10, weight: "600" });
  text(ctx, "two humps: a score is how far a walk gets from zero",
    x0, y0 + 16 + h + 6, { fill: colors.ink3, size: 10 });
}

/* ============================================================================
   NOT YET BUILT, and recorded here because the sequence is incomplete without
   it rather than because it would be nice to have.

   THE RANKING METRIC IS GSEA'S OWN INVISIBLE CHOICE, the one that replaces the
   cutoff rather than abolishing it — and the notebook contains the problem
   already without remarking on it. Cell 6 defines the rank as
   -log10(p) x sign(logFC); cell 9 then ranks by plain log2FoldChange. Two
   metrics, two rankings, two enrichment scores, one lesson.

   Building it means the stage must simulate an experiment rather than hand out
   one number per gene: n samples per arm, a fold change AND a t-test p per
   gene, so both metrics are available and genuinely disagree — logFC favours
   large changes however noisy, signed -log10(p) favours consistent ones however
   small. `makeStage` currently draws `mu + rng.normal()` and stops.

   The qualitative claims in `_lab/enr-measure.mjs` survive that change — the
   background arithmetic is untouched, and ORA's blindness to a down-regulated
   pathway is structural — but every RATE in §§ 4-7 is measured on the present
   stage and would have to be measured again. That is the cost, and it is why
   this is a separate round rather than a quiet addition.
   ========================================================================= */
