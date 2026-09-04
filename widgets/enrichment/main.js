/* ============================================================================
   Enrichment Analysis — PHM5003 `05 - Introduction to High Throughput Data`,
   notebook `09 - Enrichment Analysis`. Slot 5 of the high-throughput arc.

   TWO TABS, IN THE LESSON'S ORDER, and they are deliberately NOT two views of
   one picture. Each shows what its own method actually looks at.

   TAB 1, OVERREPRESENTATION, HAS NO RANKING ON IT. That is the point of the
   method: ORA is handed a LIST and a PATHWAY, counts the overlap, and never
   learns the order the list came in. Drawing a ranking behind it says
   otherwise. So the tab is two things and nothing else — the overlap, as a
   Venn and as the 2 x 2 it becomes, and what happens when the same test is run
   over a collection and the p-values have to be corrected.

   TAB 2, THE ENRICHMENT SCORE, IS ALL RANKING, because that is what the score
   reads. ORA survives on it as a FOIL — the cutoff drawn ghosted, ORA's
   verdict as one readout tile — which is what carries the result the widget is
   for: a genuinely enriched pathway that ORA scores near 1 and the score at
   0.002.

   HOW THE SHAPE WAS SETTLED, because none of it came from the measurement.
   Three figures were drawn at the real width in `_lab/enr-shape.html` and
   Kenneth picked one; the tabs came back as his pedagogical call; the ranking
   then came off tab 1, and the ORA half was cut back again to a Venn, a table
   of results and eight pathways. Each round was a better answer than the
   drawing it replaced.

   WHAT THE ARC MUST NOT SAY is that sophistication removes arbitrary choices.
   ORA's are the cutoff and the background; the score drops both and picks up
   the ranking metric and the permutation scheme. The choices move, they do not
   disappear — the same shape as widget 42, where the tree is evidence and the
   cut is a choice.

   THE RANKING METRIC IS ON BOTH TABS, and that is the honest placement rather
   than a convenience. It reads as the score's own invisible choice, and it is
   — but ORA's list is the top k of the SAME ranking, so a metric control shown
   only on tab 2 would leave tab 1 quietly computing its p-values under a
   setting the reader could not see. On the default state it changes ORA's
   answer from one pathway to a different one.

   The stage it needs is an experiment rather than one number per gene, and the
   two KINDS of planted pathway that make the choice a real one were forced by
   measurement — `model.js` carries both, and `_lab/enr-metric.mjs` §§ 1-3 is
   the record of the design this replaced.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import {
  makeStage, oraAll, gsea, gseaAll, listPositions, solveD,
  EFFECTS, BACKGROUNDS, METRICS, N_SETS,
} from "./model.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Milliseconds per GENE, not per frame. The walk is 400 genes long, so the
   whole of it at `medium` takes about five seconds — long enough to watch the
   sum climb through the pathway and drain outside it, short enough that nobody
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

/* The permutation null, kept across the recomputes a display change forces.
   Keyed on the parameters it depends on; see `compute`. */
const nullCache = { key: null, value: null };

const isOra = (params) => params.view === "ora";
const setIndex = (params) => clamp(Number(params.pathway) || 0, 0, N_SETS - 1);

/* --- geometry ------------------------------------------------------------- *
 * Everything is derived from `w` and `h`, so a narrow phone gets the same
 * figure rather than a clipped one. The two tabs share no panels at all, which
 * is why the layout is two functions rather than one full of branches. */
const TITLE_H = 26;
const AXIS_H = 20;
const VENN_H = 122;
const TABLE_H = 103;      /* the 2 x 2, heading to the foot of its captions */
const ROW_H = 15;
const RESULTS_H = 16 + N_SETS * ROW_H + 22;
const NULL_H = 112;       /* the histogram, the two regions, and the caption */

/* THE SCORE TAB'S RESULTS TABLE. A heading, then the ORA table's exact shape,
   so the two tabs' tables can be read against each other without the eye
   re-learning the layout — which is the entire reason for having both.

   `GSEA_ROWS_DY` is where row 0 starts inside the block, and it is a constant
   rather than two matching literals because `drawGseaResults` and `regions`
   must agree about it: the picture is identical whether a row's hit box sits
   where it is drawn or a row away, so nothing but this shared number catches
   the drift. */
const GSEA_TABLE_H = 26 + RESULTS_H;
const GSEA_ROWS_DY = 32;

/* THE VENN AND THE 2 x 2 ARE THE SAME FOUR NUMBERS, so they sit side by side
   wherever there is room for both — reading them as one thing is the point,
   and stacked they are two facts a screen apart. Below 620 the table has
   nowhere to go but under the picture. */
const sideBySide = (pw) => pw >= 620;

function layoutOra(w) {
  const padL = w < 460 ? 10 : 14;
  const x0 = padL;
  const pw = w - padL - (w < 460 ? 8 : 14);
  const two = sideBySide(pw);
  const topY = TITLE_H;
  const topH = two ? Math.max(VENN_H, TABLE_H) : VENN_H + 14 + TABLE_H;
  return {
    x0, pw, topY, two,
    vennW: two ? pw * 0.44 : pw,
    tableX: two ? x0 + pw * 0.52 : x0,
    tableY: two ? topY : topY + VENN_H + 14,
    tableW: two ? pw * 0.48 : pw,
    resultsY: topY + topH + 18,
    narrow: pw < 380,
  };
}

function layoutGsea(w, h) {
  const padL = w < 460 ? 34 : 46;
  const x0 = padL;
  const pw = w - padL - (w < 460 ? 8 : 14);
  const strips = h - TITLE_H - AXIS_H - 12 - NULL_H - 8 - GSEA_TABLE_H;
  const profileH = Math.round(strips * 0.42);
  const codeH = Math.max(14, Math.round(strips * 0.09));
  const walkH = strips - profileH - codeH - 10;
  const profileY = TITLE_H;
  const codeY = profileY + profileH + 5;
  const walkY = codeY + codeH + 5;
  const axisY = walkY + walkH;
  return {
    x0, pw, profileY, profileH, codeY, codeH, walkY, walkH, axisY,
    panelY: axisY + AXIS_H + 12,
    tableY: axisY + AXIS_H + 12 + NULL_H + 16,
    narrow: w < 560,
  };
}

function canvasHeight(w, view) {
  if (view !== "ora") return TITLE_H + 250 + AXIS_H + 12 + NULL_H + 8 + GSEA_TABLE_H;
  return layoutOra(w).resultsY + RESULTS_H;
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
/* The same number where a table column has to stay narrow. */
function fmtPShort(p) {
  if (p >= 0.001) return p.toFixed(3);
  const [m, e] = p.toExponential(0).split("e");
  return `${m}e${supMinus(e)}`;
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
    view: {
      type: "segmented",
      label: "Method",
      options: [
        { value: "ora", label: "Overrepresentation",
          detail: "a list, a pathway, and the overlap — no ranking anywhere in it" },
        { value: "gsea", label: "Enrichment score",
          detail: "the whole ranking, walked; no list and no cut" },
      ],
      default: "ora",
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

    /* SEED 174, AND CHOSEN RATHER THAN LEFT AT 1. Searched over 400 seeds for
       a state where four things are true at once, and 12 of them are:

         - the correction KEEPS a genuinely enriched pathway (3, padj 1.5e-5);
         - it REMOVES one that carries nothing and got under 0.05 anyway
           (4, raw p 0.034);
         - it also COSTS a real finding — pathway 8 is planted, comes in at
           raw p 0.035, and goes out at the same adjusted 0.093 as the false
           positive beside it. The two are indistinguishable from the numbers,
           which is the honest thing about BH and the reason this seed beats
           one where the correction only does the flattering half;
         - and flipping the metric moves the answer from pathway 3 to pathway 8
           — two different real pathways, neither of them the wrong answer.

       NOTHING ON IT PRINTS WITHIN 0.004 OF THE LINE, which was a search
       criterion rather than luck: the first candidate had an adjusted p of
       0.050014, and a row reading "0.050" that is not highlighted reads as a
       bug rather than as a threshold. Every other outcome is one drag of this
       control away, which is the point of leaving it reachable. */
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 174 },

    test: { type: "section", label: "The test" },

    /* UPSTREAM OF THE CUTOFF, and placed first for that reason: the list is the
       top k of this ranking, so choosing the metric happens before choosing how
       many. On BOTH tabs, because both methods read the ranking — the score
       walks all of it and ORA cuts it. Hiding it on tab 1 would leave that
       tab's p-values depending on a setting the reader cannot see.

       A DATA PARAMETER, not a display one: a different metric is a different
       ranking, and a walk built along the old one no longer describes the
       figure. Resetting the animation is correct here. */
    metric: {
      /* SEGMENTED, NOT A SLIDER. `choice` draws a two-stop slider, which reads
         as a quantity with a middle — and there is no half-way between ranking
         on a fold change and ranking on a p-value. Two buttons say "one or the
         other", which is what the control is. */
      type: "segmented",
      label: "Rank the genes by",
      /* NO FIELD-LEVEL `detail` HERE, and that is not an omission: a `choice`
         renders one detail line and drives it from the SELECTED OPTION, so a
         field-level one is copy nobody can read. The experiment behind the two
         metrics — four samples per arm, one t-test over the same eight values
         — is in the option details instead, where it reaches the reader. */
      options: Object.entries(METRICS).map(([value, m]) => ({
        value, label: m.label, detail: m.detail,
      })),
      default: "fc",
    },

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
      detail: "how many genes from the top of the ranking you call differentially expressed",
      min: 5,
      max: 200,
      default: 60,
      display: true,
    },

    /* UNDER THE TEST, BELOW THE METRIC AND THE CUTOFF, and last before the
       drive row — which is the order the reader works in. The metric fixes the
       ranking, the cutoff fixes the list, and only then does picking a pathway
       mean anything; it used to sit at the very top, above the data that
       defines it.

       A SELECT rather than a segmented group: eight named options is what
       `select` is for. Both tabs' results tables are the faster route — every
       pathway is there and clicking a row selects it — but the dropdown is the
       keyboard and screen-reader path to the same parameter, so it stays. */
    pathway: {
      type: "select",
      label: "Pathway",
      options: Array.from({ length: N_SETS }, (_, i) => ({
        value: String(i), label: `Pathway ${i + 1}`,
      })),
      default: "0",
      display: true,
    },

    /* The number cell 3 writes as a bare 10000 with no comment. It enters the
       test through one cell of the table and nowhere else, which is exactly why
       nobody sees it move the answer. ORA's tab only: the score reads no
       background at all. */
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
        { token: "highlight", label: `${name}, and where the two overlap`, mark: "bar" },
        { token: "theory", label: "a pathway that survives the correction", mark: "bar" },
      ];
    }
    return [
      { token: "empirical", label: `every gene, ranked by ${METRICS[params.metric].label.toLowerCase()}`, mark: "bar" },
      { token: "highlight", label: `the genes of ${name}`, mark: "bar" },
      { token: "empirical", label: "the running sum: up inside the pathway, down outside", mark: "line" },
      { token: "extreme", label: "the cutoff — where overrepresentation would cut", mark: "dash" },
      { token: "theory", label: `the score ${PERMS.toLocaleString()} random pathways of the same size reach`, mark: "bar" },
    ];
  },

  compute: ({ params, rng }) => {
    const stage = makeStage(rng, {
      scale: EFFECTS[params.effect]?.scale ?? 1,
      metric: params.metric,
    });
    const i = setIndex(params);
    const walk = gsea(stage, i);

    const hits = [];
    stage.rank.forEach((g, j) => { if (stage.sets[i].members.has(g)) hits.push(j); });

    /* CACHED on the parameters it depends on, which is a performance fix rather
       than an optimisation reached for on principle. Core recomputes the whole
       state on every DISPLAY change, so dragging the cutoff on the figure paid
       for a thousand permutations per pointermove: 15.5 ms a frame against a
       16.7 ms budget, now 2.5 ms. It cannot go stale — `compute` is pure and
       seeded, so the same values give the same draws.

       THE PATHWAY IS NO LONGER IN THE KEY, and that is what the results table
       bought back. All eight nulls are computed together — 106 ms against 11 ms
       for one — but selecting a different pathway, from the dropdown or by
       clicking a row, now costs NOTHING rather than a fresh thousand
       permutations: measured in the browser at 2 ms for a pick and 3 ms for a
       cutoff drag, both inside a frame.

       A SEED DRAG COSTS 110 ms A STEP, ABOUT 9 FRAMES A SECOND, AND THAT IS A
       DECISION RATHER THAN AN OVERSIGHT. Kenneth chose it on 2026-09-04 over
       dropping to 400 permutations, which measured ~42 ms a step. The trade is
       resolution: at 400 the finest p a pathway can reach is 1/401, and the
       readout would stop being able to print the 0.001 it prints today. The
       seed still lands on a correct figure at every step — it steps rather
       than slides. Do not "fix" this by cutting PERMS without asking; the
       count is reader-facing, in the legend and the readout note. */
    const key = `${params.seed}|${params.effect}|${params.metric}`;
    if (nullCache.key !== key) {
      nullCache.key = key;
      nullCache.value = gseaAll(stage, rng, PERMS);
    }
    const rows = nullCache.value;

    /* `rows[i]` carries `obs`, `draws`, `p` and `runs`, which is exactly what
       the histogram already expects of `nul`. */
    return { stage, walk, hits, rows, nul: rows[i] };
  },

  /* CLICK A ROW OF THE RESULTS TABLE TO SELECT THAT PATHWAY, which is how
     anyone reads an enrichment result: you look at the collection, then at the
     one that came out. Only on ORA's tab, since that is the tab it is on. */
  regions: ({ w, h, params, state }) => {
    /* `state` is null when core probes the region table at load to validate the
       parameter names, before the first compute. An empty table is correct
       there: nothing is on the canvas to hit yet. */
    if (!state) return [];
    /* BOTH TABLES ARE CLICKABLE, and on the score tab that is worth more than
       on ORA's: picking a row there used to mean a thousand fresh permutations,
       and since the null cache stopped keying on the pathway it is free. */
    const L = isOra(params) ? layoutOra(w) : layoutGsea(w, h);
    const top = isOra(params) ? L.resultsY + 16 : L.tableY + GSEA_ROWS_DY;
    return state.stage.sets.map((s, i) => ({
      x: L.x0,
      y: top + i * ROW_H,
      w: isOra(params) ? L.pw : L.pw,
      h: ROW_H,
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
      return x >= L.x0 && x <= L.x0 + L.pw
        && y >= L.profileY - 6 && y <= L.codeY + L.codeH + 4;
    },
    /* Relative to where the gesture began, which is core's contract and also
       what stops a slow drag accumulating rounding drift. */
    value: ({ dx, start, state, w, h }) => {
      const L = layoutGsea(w, h);
      const perGene = L.pw / state.stage.genes;
      return { cutoff: clamp(Math.round(start.cutoff + dx / perGene), 5, 200) };
    },
  },

  animation: {
    stepLabel: "Walk one",
    stepTitle: "Walk on to the next gene of the pathway, where the sum steps up",
    runLabel: "Walk",
    runTitle: "Walk the whole ranking, first to last",

    init: ({ params, state, fromScratch }) => ({
      shown: fromScratch ? 0 : clamp(params.shown, 0, state.stage.genes),
      acc: 0,
      done: false,
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
    const all = oraAll(stage, params.cutoff, universe);
    const mine = all[i];

    if (isOra(params)) {
      const rawHits = all.filter((r) => r.p < ALPHA).length;
      const adjHits = all.filter((r) => r.padj < ALPHA).length;
      return [
        { label: "Genes in the list", value: `${mine.k}`, note: `of ${stage.genes} measured` },
        { label: "In the list and the pathway", value: `${mine.a}`,
          note: `of ${stage.sets[i].size} in Pathway ${i + 1}` },
        { label: "Overrepresentation", value: fmtP(mine.p),
          note: `Fisher's exact test against ${universe.toLocaleString()} genes` },
        { break: true },
        { label: "After correction", value: fmtP(mine.padj),
          note: `Benjamini–Hochberg over all ${N_SETS} pathways` },
        { label: "Pathways significant", value: `${rawHits} → ${adjHits}`,
          note: "at 0.05, before and after correcting" },
      ];
    }

    const shown = clamp(anim?.shown ?? 0, 0, stage.genes);
    const done = shown >= stage.genes;

    /* ORA AS A FOIL, one tile. This is what the tab split would otherwise cost:
       the result the widget is for — a pathway ORA scores near 1 and the score
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
            ? "press Walk to score it from the whole ranking"
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

function drawOra({ ctx, colors, w, params, state }) {
  const { stage } = state;
  const L = layoutOra(w);
  const i = setIndex(params);
  const all = oraAll(stage, params.cutoff, Number(params.background));
  const o = all[i];
  ctx.__font = colors.font;
  ctx.save();

  text(ctx, "Your gene list, one pathway, and the genes in both",
    L.x0, 12, { fill: colors.ink2, size: 11 });

  drawVenn(ctx, colors, L.x0, L.topY, L.vennW, o, i, METRICS[params.metric].label);
  drawTable(ctx, colors, L.tableX, L.tableY, L.tableW, o);
  drawResults(ctx, colors, L.x0, L.resultsY, L.pw, all, i, L.narrow);

  ctx.restore();
}

/* --- the Venn, and why it is drawn to scale -------------------------------- *
 * Two circles whose AREAS are the two counts, and whose overlap area is exactly
 * the overlap count. The alternative — two circles of a fixed size with the
 * numbers written in — is the familiar textbook diagram, and it draws the same
 * picture whether nine genes overlap or ninety, which is the one thing this
 * figure is for. Fixing it costs a bisection: the lens area of two circles is
 * analytic in the distance between their centres and monotone decreasing in
 * it, so `solveD` inverts it in sixty halvings.
 *
 * The two ends of the range are real states rather than guards against bad
 * input: an overlap of zero is two circles that do not touch, and a pathway
 * wholly inside the gene list is one circle inside the other.
 *
 * `lensArea` and `solveD` live in `model.js` and not here, which is the one
 * exception to that file being the data and this one being the figure: they
 * are pure geometry with an exact answer, and putting them there is what lets
 * `_lab/enr-measure.mjs` § 9 check the inverse over every shape this widget can
 * actually draw. A number this figure asserts should be checkable. */
function drawVenn(ctx, colors, x0, y0, w, o, index, metricLabel) {
  const nList = o.a + o.b;
  const nPath = o.a + o.c;
  const rA = Math.sqrt(nList / Math.PI);
  const rB = Math.sqrt(nPath / Math.PI);
  const dRaw = solveD(rA, rB, o.a);

  const maxH = VENN_H - 36;
  const s = Math.min(maxH / (2 * Math.max(rA, rB)), (w - 20) / (dRaw + rA + rB));
  const r1 = rA * s, r2 = rB * s, d = dRaw * s;
  const cy = y0 + 16 + maxH / 2;
  /* Centre the PAIR, not either circle: the span runs from the left edge of
     one to the right edge of the other. */
  const left = x0 + (w - (d + r1 + r2)) / 2;
  const c1 = left + r1;
  const c2 = c1 + d;

  const disc = (x, r, colour) => {
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(x, cy, r, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, cy, r, 0, 2 * Math.PI); ctx.stroke();
  };
  disc(c1, r1, colors.extreme);
  disc(c2, r2, colors.highlight);

  /* The three counts, each inside its own region. `b` sits in the left lobe,
     `c` in the right, and `a` at the middle of where the two actually meet —
     which is the smaller circle's centre when one contains the other, and the
     midpoint of the shared span when they merely cross. */
  const contained = d <= Math.abs(r1 - r2) + 1e-9;
  const aX = contained
    ? (r1 >= r2 ? c2 : c1)
    : (Math.max(c1 - r1, c2 - r2) + Math.min(c1 + r1, c2 + r2)) / 2;
  if (o.b > 0) {
    text(ctx, String(o.b), c1 - r1 * 0.55, cy,
      { fill: colors.ink1, align: "center", size: 12, weight: "600" });
  }
  if (o.c > 0) {
    text(ctx, String(o.c), c2 + r2 * 0.55, cy,
      { fill: colors.ink1, align: "center", size: 12, weight: "600" });
  }
  if (o.a > 0) {
    text(ctx, String(o.a), aX, cy,
      { fill: colors.highlight, align: "center", size: 13, weight: "600" });
  }

  text(ctx, `your list — top ${nList} by ${metricLabel.toLowerCase()}`, x0, y0 + 8,
    { fill: colors.extreme, size: 10, weight: "600" });
  text(ctx, `Pathway ${index + 1} — ${nPath}`, x0 + w, y0 + 8,
    { fill: colors.highlight, align: "right", size: 10, weight: "600" });
  text(ctx, "areas are gene counts, and so is the overlap",
    x0 + w / 2, y0 + VENN_H - 8, { fill: colors.ink3, align: "center", size: 10 });
}

/* The 2 x 2 Fisher's exact test is handed — the same four numbers as the Venn,
   which is why the two sit side by side wherever the width allows. `d` is
   written as the subtraction it is, because the whole of the background claim
   is that this cell was filled in by a number nobody looked at. */
function drawTable(ctx, colors, x0, y0, w, o) {
  const labW = Math.min(120, w * 0.34);
  const cw = Math.min(140, (w - labW) / 2);
  const ch = 22;
  text(ctx, "The same four numbers, as a 2 × 2", x0, y0 - 2,
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
  text(ctx, `d = ${o.universe.toLocaleString()} − (${o.a} + ${o.b} + ${o.c}) = ${o.d}`,
    x0, y0 + 26 + 2 * ch + 13, { fill: colors.ink3, size: 10 });
  text(ctx, "the background is chosen, not measured",
    x0, y0 + 26 + 2 * ch + 27, { fill: colors.ink3, size: 10 });
}

/* EVERY PATHWAY, TESTED, AND WHAT THE CORRECTION DOES TO THEM — as the table
   an enrichment tool prints, because that is the object a reader will meet
   again. Eight named rows say more than eight anonymous bars, and at eight
   rows there is room to print both p-values side by side, which is the whole
   of the comparison. */
function drawResults(ctx, colors, x0, y0, w, all, index, narrow) {
  const rawHits = all.filter((r) => r.p < ALPHA).length;
  const adjHits = all.filter((r) => r.padj < ALPHA).length;

  const cols = narrow
    ? [{ k: "name", w: 0.40 }, { k: "a", w: 0.16 }, { k: "p", w: 0.22 }, { k: "q", w: 0.22 }]
    : [{ k: "name", w: 0.34 }, { k: "size", w: 0.14 }, { k: "a", w: 0.14 },
      { k: "p", w: 0.19 }, { k: "q", w: 0.19 }];
  const head = { name: "", size: "genes", a: "in list", p: "p", q: "after BH" };
  let acc = 0;
  const right = cols.map((c) => { acc += c.w; return x0 + w * acc; });

  cols.forEach((c, j) => {
    if (!head[c.k]) return;
    text(ctx, head[c.k], right[j] - 4, y0 + 5,
      { fill: colors.ink3, align: "right", size: 10 });
  });

  all.forEach((r, i) => {
    const y = y0 + 16 + i * ROW_H;
    if (i === index) {
      ctx.fillStyle = colors.highlight;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x0, y, w, ROW_H);
      ctx.globalAlpha = 1;
    }
    const survives = r.padj < ALPHA;
    const raw = r.p < ALPHA;
    const my = y + ROW_H / 2;
    text(ctx, r.label, x0 + 4, my,
      { fill: i === index ? colors.ink1 : colors.ink2, size: 10,
        weight: i === index ? "600" : "" });
    const val = { size: String(r.size), a: String(r.a), p: fmtPShort(r.p), q: fmtPShort(r.padj) };
    cols.forEach((c, j) => {
      if (c.k === "name") return;
      const hot = (c.k === "p" && raw) || (c.k === "q" && survives);
      text(ctx, val[c.k], right[j] - 4, my, {
        fill: c.k === "q" && survives ? colors.theory : hot ? colors.ink1 : colors.ink3,
        align: "right", size: 10, weight: hot ? "600" : "",
      });
    });
  });

  const y = y0 + 16 + all.length * ROW_H + 12;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y - 8); ctx.lineTo(x0 + w, y - 8); ctx.stroke();
  text(ctx, `${rawHits} of ${all.length} reach 0.05; `
    + `${adjHits} still ${adjHits === 1 ? "does" : "do"} after correcting for ${all.length} tests`,
    x0, y + 2, { fill: colors.ink2, size: 10 });
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

  text(ctx, `Every gene ranked by ${METRICS[params.metric].label.toLowerCase()}`
    + " — the score reads all of it", L.x0, 12, { fill: colors.ink2, size: 11 });

  const sorted = stage.rank.map((g) => stage.score[g]);
  const span = Math.max(...sorted.map(Math.abs));
  const yFor = (t) => L.profileY + L.profileH / 2 - (L.profileH / 2 - 3) * (t / span);
  const zero = yFor(0);

  /* THE CUTOFF AS A GHOST. Drawing nothing here would be tidier and would lose
     the argument: the score's independence from the cutoff is only visible
     against a cutoff. `listPositions` is asked for it rather than the top-k
     being assumed, so the picture and the test cannot disagree about which
     genes the list holds. */
  const listed = listPositions(stage, params.cutoff).length;
  ctx.fillStyle = colors.extreme;
  ctx.globalAlpha = 0.05;
  ctx.fillRect(L.x0, L.profileY, xAt(listed) - L.x0, L.profileH + 5 + L.codeH);
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
  ctx.beginPath();
  ctx.moveTo(xAt(listed), L.profileY);
  ctx.lineTo(xAt(listed), L.profileY + L.profileH + 5 + L.codeH);
  ctx.stroke();
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

  drawGseaResults(ctx, colors, L.x0, L.tableY, L.pw, state.rows, i, L.narrow);
  drawNull(ctx, colors, L.x0, L.panelY, L.pw,
    shown >= stage.genes ? nul : null, shown >= stage.genes ? walk.es : null);

  ctx.restore();
}

/* What a thousand random pathways of the same size score.
   The null is TWO HUMPS and that is correct — the score is the furthest a walk
   gets from zero, so a walk that stays near zero is the rarest outcome and not
   the commonest. The caption says so, because every reader asks. */
/* EVERY PATHWAY, SCORED AND CORRECTED — the object `gseGO` returns and the one
   cell 11 of the notebook prints. Built to the ORA table's exact shape, because
   the point of having both is that they can be read against each other: at the
   default state Pathway 2 is the top row here and reads p = 0.999 over there,
   which is the arc's whole argument sitting in two tables.

   THE SCORE COLUMN IS NES, NOT ES. A raw ES cannot be compared down a column —
   with nothing planted, a random twelve-gene set scores 0.379 against a
   hundred-and-fifty-gene set's 0.227 — so printing one would invite exactly the
   comparison it cannot support. `model.js` carries the measurement, including
   the 90% of seeds on which normalising reorders these eight rows.

   SURVIVORS ARE MARKED IN WEIGHT, NOT COLOUR, and that is the one place this
   table departs from ORA's. Over there a surviving pathway takes --c-theory.
   Here --c-theory is already the permutation histogram directly above, and a
   colour cannot mean the null distribution and a verdict on the same tab. */
function drawGseaResults(ctx, colors, x0, y0, w, rows, index, narrow) {
  const rawHits = rows.filter((r) => r.p < ALPHA).length;
  const adjHits = rows.filter((r) => r.padj < ALPHA).length;

  text(ctx, "Every pathway, scored and corrected", x0, y0 + 4,
    { fill: colors.ink2, size: 11, weight: "600" });

  const cols = narrow
    ? [{ k: "name", w: 0.34 }, { k: "nes", w: 0.22 },
      { k: "p", w: 0.22 }, { k: "q", w: 0.22 }]
    : [{ k: "name", w: 0.32 }, { k: "size", w: 0.13 }, { k: "nes", w: 0.16 },
      { k: "p", w: 0.195 }, { k: "q", w: 0.195 }];
  const head = { name: "", size: "genes", nes: "NES", p: "p", q: "after BH" };
  let acc = 0;
  const right = cols.map((c) => { acc += c.w; return x0 + w * acc; });

  cols.forEach((c, j) => {
    if (!head[c.k]) return;
    text(ctx, head[c.k], right[j] - 4, y0 + 21,
      { fill: colors.ink3, align: "right", size: 10 });
  });

  rows.forEach((r, i) => {
    const y = y0 + GSEA_ROWS_DY + i * ROW_H;
    if (i === index) {
      ctx.fillStyle = colors.highlight;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x0, y, w, ROW_H);
      ctx.globalAlpha = 1;
    }
    const survives = r.padj < ALPHA;
    const raw = r.p < ALPHA;
    const my = y + ROW_H / 2;
    text(ctx, r.label, x0 + 4, my,
      { fill: i === index ? colors.ink1 : colors.ink2, size: 10,
        weight: i === index ? "600" : "" });
    const val = {
      size: String(r.size),
      nes: Number.isFinite(r.nes) ? signed(r.nes, 2) : "—",
      p: fmtPShort(r.p),
      q: fmtPShort(r.padj),
    };
    cols.forEach((c, j) => {
      if (c.k === "name") return;
      const hot = (c.k === "p" && raw) || (c.k === "q" && survives);
      text(ctx, val[c.k], right[j] - 4, my, {
        fill: hot ? colors.ink1 : colors.ink3,
        align: "right", size: 10, weight: hot ? "600" : "",
      });
    });
  });

  const y = y0 + GSEA_ROWS_DY + rows.length * ROW_H + 12;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y - 8); ctx.lineTo(x0 + w, y - 8); ctx.stroke();
  text(ctx, `${rawHits} of ${rows.length} reach ${ALPHA}; `
    + `${adjHits} still ${adjHits === 1 ? "does" : "do"} after correcting for ${rows.length} tests`,
    x0, y + 2, { fill: colors.ink2, size: 10 });
}

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

  /* THIS AXIS RUNS BACKWARDS ON PURPOSE — POSITIVE ON THE LEFT. Do not "fix"
     it; it disagrees with every GSEA tool's output and it is meant to.

     The three panels above share one x-axis, the ranking, and on it screen-left
     is the top of the list: the most up-regulated genes. A pathway whose genes
     sit over there drives the running sum UP and scores a POSITIVE ES. Drawn
     the conventional way, that positive score then lands on the RIGHT of this
     histogram — so the reader traces "my genes are on the left" into "my score
     is on the right", and the figure mirrors itself halfway down.

     Kenneth caught exactly that on 2026-09-04 and called the flip. What makes
     it affordable is that this panel has NO numeric axis: the only number on it
     is the observed marker's own label, so reversing the direction breaks no
     tick sequence a reader is reading left to right.

     WHAT IT COSTS, so the trade is on the record: fgsea, clusterProfiler and
     the Broad's own plots all put a positive score on the right, and so does
     the lesson's own figure in cell 6 of `09 - Enrichment Analysis.ipynb`,
     whose "Upregulated" null shades its RIGHT tail. A student moving from this
     widget to their own output meets the mirror image. That was judged the
     smaller confusion of the two. */
  const bx = (t) => x0 + (w * (hi - t)) / (hi - lo);

  ctx.fillStyle = colors.theory;
  ctx.globalAlpha = 0.85;
  counts.forEach((c, i) => {
    const bh = (h - 14) * (c / top);
    /* On a reversed axis a bin's UPPER edge is its screen-left edge, so the
       rect starts at bin i + 1 rather than at bin i. */
    ctx.fillRect(bx(lo + ((hi - lo) * (i + 1)) / bins), y0 + 16 + (h - 14 - bh),
      Math.max(1, w / bins - 1), bh);
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  const axisY = y0 + 16 + h - 14;
  ctx.beginPath(); ctx.moveTo(x0, axisY); ctx.lineTo(x0 + w, axisY); ctx.stroke();

  /* ZERO, AND THE TWO DIRECTIONS EITHER SIDE OF IT. The gap between the humps
     is where a score of zero would be, and until it is marked the figure looks
     like a bug rather than the two answers it is: a set enriched among the
     genes that went UP scores positive, one enriched among those that went
     DOWN scores negative, and the walk cannot do both.

     GEOMETRY AND WORDS RATHER THAN COLOUR, deliberately. The obvious move is
     the red/blue of the lesson's own figure, and `--c-value-low` is exactly
     that pair — but it aliases `--series-1`, which is `--c-empirical`, already
     spent in this panel on the observed marker. A blue region behind a blue
     line would say two unrelated things in one hue, which is the trap
     tokens.css names at `--c-value-low` itself.

     `lo` is at most -0.9 and `hi` at least 0.9, so zero is always strictly
     inside the domain and this line always lands on the plot — wherever the
     draws put it, which is why the region labels are anchored to the panel's
     edges rather than tucked either side of it. */
  const zx = bx(0);
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(zx, y0 + 14); ctx.lineTo(zx, axisY); ctx.stroke();
  ctx.setLineDash([]);

  /* AT THE PANEL'S EDGES, not flanking the divider. Zero sits wherever the
     draws put it, so labels tucked either side of it collide with each other
     on a narrow canvas; anchored to the ends they cannot. */
  const regionY = axisY + 12;
  text(ctx, "up-regulated", x0, regionY, { fill: colors.ink2, size: 10 });
  text(ctx, "down-regulated", x0 + w, regionY,
    { fill: colors.ink2, align: "right", size: 10 });

  const ox = bx(obs);
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ox, y0 + 14); ctx.lineTo(ox, y0 + 16 + h - 14); ctx.stroke();
  const right = ox < x0 + w - 64;
  text(ctx, `this pathway, ${signed(obs, 2)}`, ox + (right ? 5 : -5), y0 + 20,
    { fill: colors.empirical, align: right ? "left" : "right", size: 10, weight: "600" });
  text(ctx, "two humps: a random set drifts one way or the other",
    x0, y0 + 16 + h + 22, { fill: colors.ink3, size: 10 });
}

/* ============================================================================
   THE RANKING METRIC, AND WHAT IT COST — built 2026-09-04, and recorded here
   because the version that was NOT built is the more useful half of it.

   THE OBVIOUS DESIGN WAS MEASURED AND DISCARDED. Keeping the shipped stage —
   one constant shift per planted pathway — and adding the control to it makes
   signed significance strictly BETTER, 86% against 92% at moderate noise
   spread and 65% against 98% at high. A constant shift applied to every gene
   regardless of its own noise is exactly the alternative a t-test is built to
   detect, so on that stage ranking on significance is simply the right answer
   and a student would have correctly concluded so. The tab would then have
   taught that sophistication DOES remove the arbitrary choice, which is the
   one thing the arc must not say.

   WHAT REPLACED IT is in `model.js`: an experiment (four samples per arm, a
   gene-specific noise level, a fold change and a t-test p from the same draws)
   and two kinds of planted pathway, loud and quiet, so that each metric wins
   somewhere. Neither is wrong; they answer different questions.

   THE CONTROL THAT PROVES THE MECHANISM is worth keeping in mind before anyone
   simplifies the stage back: with ONE variance for every gene the two metrics
   still disagree about 12 genes of a top-60 list, but the genes each prefers
   have identical mean noise, 1.00 against 1.00. A disagreement with no reading
   is not a teaching control. `_lab/enr-metric.mjs` § 1.

   STILL OPEN, and deliberately not built here:

   THE PERMUTATION SCHEME is the score's OTHER invisible choice, and the widget
   still substitutes one for the other silently. `gseaNull` permutes which genes
   are in the set and holds the ranking still; the real thing permutes sample
   labels and re-ranks, which preserves the correlation between genes that gene
   permutation destroys. The notebook's own step 3 says "permuting the labels of
   the dataset".

   THAT SUBSTITUTION IS NOW BUILDABLE and was not before: sample permutation
   needs an expression matrix, and as of this change the stage HAS one — it
   draws `n` samples per arm per gene. What it does not yet have is those draws
   RETAINED (only the fold change and the p survive the loop) and a per-gene
   correlation structure, without which the two schemes would differ by
   arithmetic and not by the thing that makes them differ in practice. That is
   the next round, and it is a round rather than an addition.
   ========================================================================= */
