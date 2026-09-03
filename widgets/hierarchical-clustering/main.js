/* ============================================================================
   `hierarchical-clustering` — Finding Groups

   THE CLAIM. A dendrogram is built by a rule and cut by a choice, and the cut
   answers whether or not there is anything to answer. Ask Ward for two
   clusters in twenty points drawn from ONE Gaussian and 56% of the time it
   hands back a balanced split that looks exactly like a finding.

   "Noise produces a handsome dendrogram" is the version of that claim which
   does NOT hold: on this stage real groups score a final-merge gap of 4.20 and
   noise 1.39, with 0 of 400 noise runs reaching the 10th percentile of the
   real ones. The TREE is honest. It is the CUT that is not, and the gap is the
   evidence the cut discards — which is why `shown` builds the tree and `k`
   cuts it, as two controls and not one.

   `model.js` carries the engine, verified against R's `hclust`.
   ========================================================================= */

import { defineWidget, makeRng, fmt } from "../core/index.js";
import {
  cluster, cut, gapAt, cutHeight, canonical, witness,
  distanceMatrix, mds,
  heatStage, noiseBoxes, DISTANCES, HEAT_GENES, HEAT_SAMPLES,
} from "./model.js";

const OFFERED = ["average", "complete", "ward.D2"];

/* The scatter's extent is FIXED, not fitted to the data. Fitting it would
   rescale the picture as the Structure dial moves and hide the very thing the
   dial does — the groups would look equally far apart at every setting.

   PER METRIC, because they are not on the same scale. Measured over 40 seeds
   x 4 structure settings x both axes: Euclidean MDS coordinates reach 9.46,
   Manhattan 33.69 — three and a half times further. One shared extent of 9.8
   put every Manhattan point outside the panel and over the dendrogram beside
   it, which is what "the scatter goes full width and collides" was. The panel
   is also clipped now, so a future metric cannot do the same thing quietly. */
const EXTENT = { euclidean: 9.8, manhattan: 35 };

/* What a real pair of groups scores on this stage, as the 10th to 90th
   percentile over 400 seeds at separation 3.

   Keyed by linkage AND distance, because it is a property of both. An
   average-linkage tree on real groups scores about 2.2 where Ward scores 4.2,
   so one range for all three would call a true finding noise; and Manhattan is
   a different metric rather than a rescaling of Euclidean, so it moves the
   ratio again — Ward reads 3.3-5.2 under one and 2.9-4.6 under the other.
   `node widgets/_lab/hc-measure.mjs` reprints the whole table. */
const GAP_REFERENCE = {
  "average|euclidean": [1.8, 2.8],
  "average|manhattan": [1.7, 2.5],
  "complete|euclidean": [1.8, 2.7],
  "complete|manhattan": [1.6, 2.4],
  "ward.D2|euclidean": [3.3, 5.2],
  "ward.D2|manhattan": [2.9, 4.6],
};

/* ONE DIAL FOR BOTH TABS: how much structure is really in the data. Gated to
   one tab it left the Heatmap a fixed demo that could only ever show the
   method working, which is the half of the lesson that needs no widget. */
const SEPARATIONS = [
  { value: "3", label: "Clear", detail: "groups a reader can see without any of this" },
  { value: "2", label: "Slight", detail: "overlapping, but they are really there" },
  { value: "1", label: "Faint", detail: "barely a signal — and mostly not recovered" },
  { value: "0", label: "None", detail: "nothing was planted at all. There is nothing to find" },
];

/* The matrix's planted effect, from the shared dial: at the top setting a
   block shifts by 2, at the bottom nothing is added to any gene. Measured
   across it, the blocks go from 93% kept whole to 0% and the columns from
   recovering both conditions to neither — while the cut returns exactly what
   it is asked for throughout. */
const liftFor = (separation) => (Number(separation) * 2) / 3;

const LINKAGE_LABEL = { average: "Average", complete: "Complete", "ward.D2": "Ward" };

/* Past a certain speed there is nothing left to see in a single merge, so the
   per-merge choreography switches off — but as a declared property of the
   chosen speed, never something the animation decides mid-run. */
const SPEEDS = {
  slow: { label: "Slow", detail: "every merge drawn as it happens", ms: 1100, choreo: true },
  medium: { label: "Medium", detail: "every merge drawn as it happens", ms: 420, choreo: true },
  fast: { label: "Fast", detail: "merges only, no reaching", ms: 120, choreo: false },
  fastest: { label: "Fastest", detail: "the whole tree at once", ms: 0, choreo: false },
};

/* "Merge one" always runs the full choreography at this pace whatever Play is
   set to: its entire job is to show the mechanism, and a fast single step
   shows nothing. */
const STEP_MS = 1100;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const transpose = (m) => m[0].map((_, j) => m.map((row) => row[j]));
const easeInOut = (t) => t * t * (3 - 2 * t);

/**
 * THE MERGE BEING SHOWN, decided ONCE and handed to both panels.
 *
 * While something is moving it is the merge in flight, at the fraction the
 * clock has reached. At rest it is the merge just made, complete — so the
 * marks stay on screen to be read rather than vanishing the instant motion
 * stops, and nothing is ever left half-drawn.
 *
 * Both panels take this same object: computing it twice is how the scatter
 * would come to mark one merge while the dendrogram highlighted another.
 *
 * Exported so `_lab/hc-anim.mjs` can assert on the SAME predicate the figure
 * draws with. A driver that re-derived "is it tweening?" would be testing its
 * own copy of the rule, which is how a test comes to agree with a bug.
 */
export function flightFor({ anim, params, tree, shown, built }) {
  if (built) return null;
  const sp = SPEEDS[params.speed] ?? SPEEDS.medium;
  const moving = sp.choreo && sp.ms > 0
    && (anim?.acc ?? 0) > 0 && shown < tree.height.length;
  if (moving) {
    return { node: tree.nodes[shown], t: easeInOut(clamp(anim.acc / sp.ms, 0, 1)) };
  }
  return shown > 0 ? { node: tree.nodes[shown - 1], t: 1 } : null;
}

/* ---------------------------------------------------------------------------
   Dendrogram geometry, in ONE place.

   The tree is drawn three times — this tab's, and the heatmap's row and column
   trees — and the cut line has to land between the same two merges the
   colouring uses. Two copies of that arithmetic is how the halves of a figure
   come to disagree.
   ------------------------------------------------------------------------ */
function dendroLayout(tree) {
  const rank = new Map();
  tree.order.forEach((leaf, i) => rank.set(leaf, i));
  const nodeX = [];
  tree.nodes.forEach((nd, m) => {
    const xOf = (c) => (c.a ? nodeX[c.id - 1] : rank.get(c.leaves[0]));
    nodeX[m] = (xOf(nd.a) + xOf(nd.b)) / 2;
  });
  return { rank, nodeX };
}

defineWidget({
  slug: "hierarchical-clustering",
  /* `check` asserts this agrees with manifest.json, so the gallery and the
     draft bar cannot disagree. */
  status: "draft",
  title: "Finding Groups",
  subtitle:
    "Hierarchical clustering merges the closest pair, over and over, and the "
    + "tree records every join. Cutting that tree is a separate decision — and "
    + "it returns the number of groups you asked for, whether or not they exist.",
  layout: "side",

  /* Core calls this with the values SPREAD, plus `w` — not `{ params }`, which
     is what `legend` gets.

     Both numbers are measured against the rail, which runs to 942px. At 470
     the stage column left 337px of headroom unused and the panels were
     squeezed into half the width they could have had. */
  height: ({ view }) => (view === "heatmap" ? 690 : 790),

  params: {
    /* TWO TABS: the idea, then the thing people actually run.

       It was one figure with the matrix behind an action button, which put
       three cut controls and two stacked dendrograms on screen at once — and
       there the columns control looked broken, because a reader moving it was
       watching the OTHER tree. Tabs make the question each view answers
       explicit and give the matrix the whole canvas.

       `display: true` so a reader can build the tree, look at the matrix and
       come back to a tree still built. */
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "cluster", label: "Cluster",
          detail: "twenty points: what a distance and a linkage do, and what a cut decides" },
        { value: "heatmap", label: "Heatmap",
          detail: "the same operation on a real matrix — pheatmap's own figure" },
      ],
      default: "cluster",
      display: true,
    },

    data: { type: "section", label: "The data" },

    /* The whole argument on one control. Measured over 400 seeds per setting:
       as this falls the Ward gap goes 4.20 -> 1.39 and the three linkages'
       agreement 94% -> 16%, while the cut still returns a balanced split 56%
       of the time at the bottom. */
    separation: {
      type: "choice",
      label: "Structure really in the data",
      options: SEPARATIONS,
      default: "3",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    /* The reader asks for the truth rather than the widget asserting it. At
       separation 0 the honest answer is that there is none, so the overlay
       says so instead of colouring points that came from one distribution. */
    truth: {
      type: "bool",
      label: "Show what was really there",
      default: false,
      display: true,
    },

    algo: { type: "section", label: "The clustering" },

    /* `single` was implemented, measured and left out: at n = 20 its failure
       is an isolate — a 19/1 split — rather than the textbook chain, so it
       teaches nothing this stage can show. */
    linkage: {
      type: "segmented",
      label: "Linkage",
      options: OFFERED.map((k) => ({
        value: k,
        label: LINKAGE_LABEL[k],
        detail: {
          average: "the mean distance between all pairs across the two clusters",
          complete: "the distance between their two furthest members",
          "ward.D2": "whichever merge adds least to the within-cluster spread",
        }[k],
      })),
      default: "ward.D2",
    },

    /* TWO OF R's FIVE. Pearson is degenerate on a plane of points — a
       correlation between two 2-vectors is always ±1, so it takes three
       distinct values across all 190 pairs — and cosine measures the angle
       from the origin, so it separates this stage only because the groups
       straddle zero. Euclidean and Manhattan are the two that do not care
       where the origin is. */
    distance: {
      type: "segmented",
      label: "Distance",
      options: Object.entries(DISTANCES).map(([value, d]) => ({
        value, label: d.label, detail: d.detail,
      })),
      default: "euclidean",
    },

    /* BELOW the buttons it governs: `afterDrive` puts it under the drive row,
       which is where a speed control belongs, since it means nothing until
       something is playing. */
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({
        value, label: s.label, detail: s.detail,
      })),
      default: "medium",
      display: true,
      afterDrive: true,
      when: { param: "view", equals: "cluster" },
    },

    /* WHICH WAY ARE WE CLUSTERING? It decides what the distance matrix is
       between, and so what the tree is a tree OF. */
    axis: {
      type: "segmented",
      label: "Cluster the",
      options: [
        { value: "rows", label: "Rows",
          detail: "each gene is one object, its twenty sample readings" },
        { value: "columns", label: "Columns",
          detail: "each sample is one object, its twenty gene readings" },
      ],
      default: "rows",
      when: { param: "view", equals: "cluster" },
    },

    /* AFTER the axis toggle, which is what decides WHICH tree this cuts:
       reading it first asked for a number of groups of something not yet
       chosen.

       ONE VERB, THREE TREES. Every cut here is "cut tree", because every one
       is the same operation — `cutree` — applied to a different tree: this
       tab's twenty objects, the heatmap's twenty genes, its twenty samples.
       Naming them alike is what makes them comparable. One shared control
       instead conflated three datasets into one number.

       `display` on purpose: the cut does not change the tree, so moving it
       must not discard a tree the reader has just watched being built. That
       is the widget's claim, made by the control's own behaviour. */
    k: {
      type: "int",
      label: "Cut tree into k clusters",
      detail: "the tree above — `cutree(hclust(...), k)`",
      min: 2,
      max: 6,
      default: 2,
      display: true,
      when: { param: "view", equals: "cluster" },
    },

    /* COLUMNS BEFORE ROWS, and both spelled out. A student meets these as
       `cutree_cols` and `cutree_rows` in a `pheatmap` call, so the label says
       what the control does and the detail names the argument it is. */
    cutCols: {
      type: "int",
      label: "Cut tree (columns)",
      detail: "the 20 samples — pheatmap's `cutree_cols`",
      min: 2,
      max: 6,
      default: 2,
      display: true,
      when: { param: "view", equals: "heatmap" },
    },

    cutRows: {
      type: "int",
      label: "Cut tree (rows)",
      detail: "the 20 genes — pheatmap's `cutree_rows`",
      min: 2,
      max: 8,
      default: 5,
      display: true,
      when: { param: "view", equals: "heatmap" },
    },

    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  /* `legend` is handed `{ params }`, where `height` is handed the values
     SPREAD. Destructuring this one the way `height` destructures its own
     argument read three undefineds and silently dropped the heatmap's
     entries, so the legend went on describing the other tab. */
  legend: ({ params }) => {
    const { truth, separation } = params;

    /* ONE TAB'S MARKS AT A TIME. Sharing a legend across both put the linkage
       marks beside a matrix that draws none. */
    if (params.view === "heatmap") {
      const entries = [
        { token: "value-high", label: "above this gene's baseline", mark: "bar" },
        { token: "value-low", label: "below it — pale is neither", mark: "bar" },
        { token: "cluster-a", label: "the column cut's groups", mark: "bar" },
        { token: "highlight", label: "where each tree is cut", mark: "dash" },
        { token: "extreme", label: "a box holding no structured gene at all", mark: "line" },
      ];
      if (truth) {
        entries.push(
          { token: "cluster-a", label: "the two real conditions — the `condition` strip", mark: "bar" },
          { token: "cluster-a", label: "the four real gene blocks — the strip left of the matrix", mark: "bar" },
          { token: "unknown", label: "a gene with nothing added to it", mark: "bar" },
        );
      }
      return entries;
    }

    /* The highlight mark IS the linkage, so the legend names the linkage the
       reader has chosen. A single "what the linkage measures" would be true of
       all three and describe none. */
    const measures = {
      average: "every pair across the two clusters — average takes their mean",
      complete: "the two furthest members — the only pair complete looks at",
      "ward.D2": "each member to the centre they would form — Ward's spread",
    }[params.linkage];

    /* THE TOGGLE CHANGES WHAT COLOUR MEANS, so the legend has to say which
       reading is on screen. Colour is the clustering's answer until the reader
       asks for the truth, and then it is the truth and the clustering's answer
       becomes the ink ring round it. Two partitions of twenty objects, one
       ramp: the alternative is a second ramp of five more hues nobody can tell
       apart from the first. */
    if (truth && Number(separation) === 0) {
      return [
        { token: "cluster-a", label: "the two clusters being merged, and the cut's groups", mark: "dot" },
        { token: "highlight", label: measures, mark: "line" },
        { token: "unknown", label: "one population — there were no real groups to show", mark: "dot" },
        { token: "highlight", label: "where the tree is cut", mark: "dash" },
      ];
    }

    if (truth) {
      const real = params.axis === "columns"
        ? "which of the two conditions a sample really came from"
        : "which of the four blocks was really planted in a gene";
      return [
        { token: "cluster-a", label: real, mark: "dot" },
        { token: "unknown", label: params.axis === "columns"
          ? "a sample from neither" : "a gene with nothing added to it", mark: "dot" },
        { token: "reference", label: "what the clustering found — one ring per cluster", mark: "area" },
        { token: "highlight", label: measures, mark: "line" },
        { token: "highlight", label: "where the tree is cut", mark: "dash" },
      ];
    }

    return [
      { token: "cluster-a", label: "the two clusters being merged, and the cut's groups", mark: "dot" },
      { token: "highlight", label: measures, mark: "line" },
      { token: "unknown", label: "a cluster already formed", mark: "area" },
      { token: "highlight", label: "where the tree is cut", mark: "dash" },
    ];
  },

  compute: ({ params, rng }) => {
    /* ONE SQUARE TABLE, read two ways. 20 genes by 20 samples, so its rows are
       20 objects of twenty numbers and so are its columns: the rows/columns
       toggle is symmetric, and gives 20 objects and a 20 x 20 distance matrix
       whichever way it points. A 20 x 2 table made the columns side two
       objects and one merge, which is no clustering at all.

       The same generator feeds both tabs, at the same settings. */
    const lift = liftFor(params.separation);
    const heat = heatStage({ lift }, rng);
    const cols = params.axis === "columns";
    const objects = cols ? heat.cols : heat.rows;

    /* An object with twenty numbers is not a point, so it is placed by
       classical scaling on the very distance matrix the tree is built from:
       plotted separation approximates real separation, and the scatter and the
       distance matrix agree by construction rather than by coincidence.

       THE WHOLE TRUTH, not a yes/no. Clustering the rows, an object is a gene
       and the truth is WHICH of the four planted blocks it belongs to, or none
       — five readings. Clustering the columns it is one of two conditions.
       Collapsing the rows case to planted/unplanted threw away three quarters
       of what there was to check the clustering against. */
    const pts = mds(objects, params.distance).map((p, i) => ({
      ...p,
      truth: cols ? heat.condition[i] : heat.planted[i],
    }));

    const trees = {};
    for (const m of OFFERED) trees[m] = cluster(objects, m, params.distance);

    const state = {
      heat, objects, pts, cols, lift,
      separation: Number(params.separation),
      trees,
      tree: trees[params.linkage],
      rowTree: cluster(heat.rows, params.linkage, params.distance),
      colTree: cluster(heat.cols, params.linkage, params.distance),
    };
    return state;
  },

  animation: {
    stepLabel: "Merge one",
    stepTitle: "Merge the closest pair",
    runLabel: "Cluster",
    runTitle: "Build the whole tree",

    init: ({ params, state, fromScratch }) => ({
      /* Honoured on first render only, which is what publishes a finished
         figure as `?shown=19`. */
      shown: fromScratch ? 0 : clamp(params.shown, 0, state.tree.height.length),
      acc: 0,          // milliseconds into the merge now in flight
      done: false,
      /* Core takes step and run out of the row when a widget declares there is
         nothing to drive. The heatmap tab draws no merge sequence, so a live
         Cluster button there would build a tree the reader cannot see. */
      inert: params.view !== "cluster",
    }),

    /* `anim.shown` counts merges FULLY made; `anim.acc / ms` is how far into
       the next one we are, and that fraction is the whole of the tweening. A
       merge is not an instant on the figure: the two clusters are marked, the
       linkage's own lines reach across between them, and the dendrogram's join
       rises to the height it lands at. All three read off the same fraction,
       so they cannot drift apart. */
    advance: (anim, { dt, params, state }) => {
      const total = state.tree.height.length;
      if (anim.shown >= total) { anim.done = true; anim.acc = 0; return false; }

      const step = anim.mode === "step";
      const sp = SPEEDS[params.speed] ?? SPEEDS.medium;
      const ms = step ? STEP_MS : sp.ms;

      /* Fastest declines the choreography outright rather than running it
         imperceptibly — the whole tree arrives in one frame. */
      if (ms <= 0) { anim.shown = total; anim.acc = 0; anim.done = true; return false; }

      anim.acc += dt;
      let landed = false;
      while (anim.acc >= ms && anim.shown < total) {
        anim.acc -= ms;
        anim.shown += 1;
        landed = true;
        if (step) break;               // a press is one merge, not a run
      }

      if (anim.shown >= total) { anim.acc = 0; anim.done = true; return false; }
      /* A step ends ON the merge, not part-way into the next one. Otherwise
         the figure rests holding a half-drawn join, which reads as a mark
         rather than as motion. */
      if (step && landed) { anim.acc = 0; return false; }
      return true;
    },

    /* Changing `k`, the speed or the matrix must leave the built tree alone.
       `acc` is clamped too: a speed change mid-merge would otherwise leave a
       fraction measured against the OLD duration, and the join would jump. */
    rebuild: (anim, { params, state }) => {
      anim.shown = clamp(anim.shown, 0, state.tree.height.length);
      anim.inert = params.view !== "cluster";
      const sp = SPEEDS[params.speed] ?? SPEEDS.medium;
      anim.acc = clamp(anim.acc, 0, Math.max(0, sp.ms));
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const shown = clamp(anim?.shown ?? 0, 0, state.tree.height.length);
    const built = shown >= state.tree.height.length;
    const k = Math.min(params.k, state.objects.length);
    const labels = built ? cut(state.tree, k) : null;

    const flight = flightFor({ anim, params, tree: state.tree, shown, built });

    const PAD = 10;
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "left";

    /* ------------------------------------------------------------------ */
    if (params.view === "heatmap") {
      /* JUST THE HEATMAP. It carried a distance matrix and a schematic until
         the Cluster tab became the place the pipeline is explained. By the
         time a reader is here they know a matrix can be clustered either way,
         and the figure should show the thing they came for. */
      ctx.fillText(`${HEAT_GENES} genes by ${HEAT_SAMPLES} samples, clustered both ways`, PAD, PAD + 11);
      ctx.restore();
      if (state.heat) {
        drawHeatmap(ctx, colors, {
          x: PAD, y: PAD + 20, w: w - 2 * PAD, h: h - PAD - 20 - PAD,
        }, { state, params });
      }
      return;
    }

    /* ------------------------------------------------------------------
       THE CLUSTER TAB.

         data matrix   --dist()-->   distance matrix
         scatter                     tree

       Three of these four are square by nature — a 20 x 20 table, its 20 x 20
       distances, and a plane of 20 points — and only the tree wants width. So
       the squares are sized to the row and the tree takes what is left. The
       figure is tall enough that "sized to the row" is 340px; at a 470px
       canvas it was 202. */
    const cols = params.axis === "columns";
    const n = state.objects.length;

    ctx.fillText(cols
      ? `a ${HEAT_GENES} x ${HEAT_SAMPLES} table — clustering its ${HEAT_SAMPLES} columns (samples)`
      : `a ${HEAT_GENES} x ${HEAT_SAMPLES} table — clustering its ${HEAT_GENES} rows (genes)`,
    PAD, PAD + 11);
    ctx.restore();

    const CAP = 22;                       // room under a panel for its caption
    const ARROW = 62;
    const top = PAD + 20;
    const rowH = Math.floor((h - top - PAD - 2 * CAP) / 2);
    const row1 = top;
    const row2 = row1 + rowH + CAP + 6;

    /* Row 1: two squares as large as the row, the arrow between them. */
    const sq1 = Math.min(rowH, Math.floor((w - 2 * PAD - ARROW) / 2));
    const dataX = PAD;
    const distX = dataX + sq1 + ARROW;

    const wt = flight
      ? witness(state.objects, flight.node.a.leaves, flight.node.b.leaves,
        params.linkage, params.distance)
      : null;

    /* WHAT THE DATA MATRIX MARKS: the two clusters, at their real size, and an
       outline only where the linkage names two objects. `extreme` is complete
       linkage, whose value IS one pair's distance; `all` is average and
       `spokes` is Ward, and neither has a pair to point at. Nothing in flight
       marks nothing: falling back to `[0, 1]` left the first two rows of the
       table outlined at rest, for no reason a reader could recover. */
    const marks = flight ? {
      a: flight.node.a.leaves,
      b: flight.node.b.leaves,
      pair: wt && wt.kind === "extreme" && wt.pairs[0] ? wt.pairs[0] : null,
    } : null;

    drawDataMatrix(ctx, colors, { x: dataX, y: row1, w: sq1, h: sq1 }, {
      vecs: state.heat.rows, cols, marks,
    });
    arrow(ctx, colors, dataX + sq1 + 10, row1 + sq1 / 2, distX - 10, "dist()");

    /* THE MATRIX DOES NOT MOVE. Re-ordering it on every merge made the blocks
       assemble themselves on the diagonal, but the cells jumped about while
       the reader was trying to follow one comparison. It is fixed in the
       FINISHED tree's leaf order instead: every cluster the build ever forms
       is a subtree, and a subtree is a contiguous run in that order, so the
       boxes are still drawable and are the only thing that changes. */
    const groups = clustersAfter(state.tree, shown);
    drawDistance(ctx, colors, { x: distX, y: row1, w: sq1, h: sq1 }, {
      rows: state.objects,
      distance: params.distance,
      order: state.tree.order,
      groups,
      cells: wt && wt.kind !== "spokes" ? wt.pairs : null,
      truth: params.truth && params.separation !== "0"
        ? state.pts.map((p) => p.truth) : null,
      caption: `${n} x ${n} — every pair of ${cols ? "samples" : "genes"}, `
        + `${shown} merge${shown === 1 ? "" : "s"} boxed`,
    });

    /* Row 2: the scatter square, the tree taking every pixel that is left. */
    const sq2 = Math.min(rowH, Math.floor(w * 0.42));
    drawScatter(ctx, colors, { x: PAD, y: row2, w: sq2, h: sq2 },
      { pts: state.pts, objects: state.objects, tree: state.tree, shown, labels, params, flight });

    const treeX = PAD + sq2 + 18;
    drawDendrogram(ctx, colors,
      { x: treeX, y: row2, w: w - PAD - treeX, h: sq2 - 8 },
      { tree: state.tree, shown, labels, k: built ? Math.min(k, n) : null, flight,
        truth: params.truth && params.separation !== "0"
          ? state.pts.map((p) => p.truth) : null });
  },

  readout: ({ params, state, anim }) => {
    /* THE HEATMAP TAB HAS ITS OWN NUMBERS. Sharing the Cluster tab's tiles put
       "press Cluster" beside a matrix with no Cluster button, and a height gap
       measured on a tree that tab does not draw. */
    if (params.view === "heatmap") {
      if (!state.heat) return [];
      const rowLab = cut(state.rowTree, params.cutRows);
      const colLab = cut(state.colTree, params.cutCols);
      const empty = noiseBoxes(rowLab, state.heat.planted);
      const genes = empty.reduce((a, b) => a + b.size, 0);
      /* Does any column box straddle the two conditions? The column side of
         the same claim: the cut carves two real groups into as many as you ask
         for, and every piece still looks clean. */
      const straddling = [...new Set(colLab)].filter((c) => {
        const inBox = state.heat.condition.filter((_, i) => colLab[i] === c);
        return new Set(inBox).size > 1;
      }).length;
      return [
        { label: `Columns cut into ${params.cutCols}`,
          value: countsOf(colLab).join(" / "),
          note: straddling === 0
            ? "every box sits inside one condition — and there are only two"
            : `${straddling} box(es) mix the two conditions` },
        { label: `Rows cut into ${params.cutRows}`,
          value: countsOf(rowLab).join(" / "),
          note: "pheatmap draws each of these as a box" },
        { label: "Gene boxes holding no structure",
          value: `${empty.length} of ${params.cutRows}`,
          note: empty.length
            ? `${genes} genes with nothing added, boxed and named a module`
            : `all ${params.cutRows} boxes contain planted genes` },
      ];
    }

    const total = state.tree.height.length;
    const shown = clamp(anim?.shown ?? 0, 0, total);
    const built = shown >= total;

    if (!built) {
      return [
        /* "left to join" was wrong and read as a countdown: after 17 merges
           there are 3 clusters REMAINING, which is 2 more joins, not 3. */
        { label: "Merges made", value: `${shown}`,
          note: shown === 0 ? "press Cluster" : `${state.objects.length - shown} clusters remain` },
        { label: "Cut", value: "not yet",
          note: "the tree has to be finished before it can be cut" },
      ];
    }

    /* Clustering 2 columns cannot be cut into 6. The control keeps its range —
       it belongs to the rows case — and the figure clamps. */
    const k = Math.min(params.k, state.objects.length);
    const gap = gapAt(state.tree, k);
    const [lo, hi] = GAP_REFERENCE[`${params.linkage}|${params.distance}`];
    const parts = OFFERED.map((m) => canonical(cut(state.trees[m], k)));
    const agree = parts.every((p) => p === parts[0]);
    const labels = cut(state.tree, k);

    return [
      { label: `Points cut into ${k}`, value: countsOf(labels).join(" / "),
        note: "the sizes it returned — it returns k of them either way" },
      /* THE DIAGNOSTIC, printed as a comparison and never as a verdict. The
         reference range is checkable on this very figure: move the separation
         dial and watch the gap cross it. */
      { label: "Height gap at the cut", value: gap === null ? "—" : fmt(gap, 2),
        note: `real groups here score ${lo}-${hi} on this linkage` },
      { label: "The three linkages", value: agree ? "agree" : "disagree",
        note: agree
          ? "average, complete and Ward return the same split"
          : "the same points, three different answers" },
    ];
  },
});

/* ---------------------------------------------------------------------------
   The scatter.
   ------------------------------------------------------------------------ */
function drawScatter(ctx, colors, box, { pts, objects, tree, shown, labels, params, flight }) {
  const { x, y, w, h } = box;
  const ex = EXTENT[params.distance] ?? EXTENT.euclidean;
  const px = (v) => x + w * (0.5 + v / (2 * ex));
  const py = (v) => y + h * (0.5 - v / (2 * ex));

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();                     // nothing leaves this panel

  /* THE MERGE IN FLIGHT: a pale blob round each of the two clusters, their
     points coloured, and THE LINES THE LINKAGE ACTUALLY MEASURED between them.

     Drawing one line between the two cluster CENTRES instead is what centroid
     linkage measures and none of the three on offer, so average, complete and
     Ward produced an identical picture and the linkage control looked inert. */
  const inFlight = flight ? flight.node : null;
  const t = flight ? flight.t : 1;

  /* WHICH PARTITION GETS THE COLOUR.

     Two partitions of the same twenty objects are on this panel — the one the
     clustering found and the one that is real — and only one can have the
     cluster ramp.

     Toggle off, the dots are the clusters. Toggle on, the dots are the TRUTH
     and the clusters become ink rings: the truth needs the hues and a found
     cluster does not, since it is already visible as a group of dots sitting
     together. On the row axis the truth is FIVE readings — four planted blocks
     and the genes with nothing added — so a stroke could not carry it either
     way. "Does each ring hold one colour?" is then the whole question the
     toggle exists to ask.

     While the tree is still building, the blobs are the clusters formed so
     far, faint, so the whole partition shows and not only the pair being
     joined. */
  const showTruth = Boolean(params.truth) && params.separation !== "0";

  if (labels) {
    const byLabel = new Map();
    labels.forEach((l, i) => {
      if (!byLabel.has(l)) byLabel.set(l, []);
      byLabel.get(l).push(i);
    });
    for (const [l, g] of byLabel) {
      if (g.length < 2) continue;
      blob(ctx, pts, g, showTruth ? colors.reference
        : colors.clusters[(l - 1) % colors.clusters.length], box, showTruth ? 0.2 : 0.12, ex);
    }
  } else {
    for (const g of clustersAfter(tree, shown)) {
      if (g.length < 2) continue;
      if (inFlight && (g === inFlight.a.leaves || g === inFlight.b.leaves)) continue;
      blob(ctx, pts, g, colors.unknown, box, 0.13, ex);
    }
  }

  if (inFlight) {
    /* The two blobs come UP as the merge runs, so a reader watching at Slow
       sees the pair being considered before the lines reach across them. Ink
       when the dots carry the truth, so the pair is still marked and the mark
       cannot be read as a group. */
    const cA = showTruth ? colors.reference : colors.clusters[0];
    const cB = showTruth ? colors.reference : colors.clusters[1];
    blob(ctx, pts, inFlight.a.leaves, cA, box, 0.06 + 0.14 * t, ex);
    blob(ctx, pts, inFlight.b.leaves, cB, box, 0.06 + 0.14 * t, ex);
    drawWitness(ctx, colors, pts, objects, inFlight, params, box, t);
  }

  const inA = inFlight ? new Set(inFlight.a.leaves) : null;
  const inB = inFlight ? new Set(inFlight.b.leaves) : null;

  pts.forEach((p, i) => {
    ctx.fillStyle = showTruth
      ? truthColour(colors, p.truth)
      : labels
        ? colors.clusters[(labels[i] - 1) % colors.clusters.length]
        : inA && inA.has(i) ? colors.clusters[0]
          : inB && inB.has(i) ? colors.clusters[1]
            : colors.unknown;
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.y), showTruth ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * Renumber a labelling by FIRST APPEARANCE along a display order.
 *
 * Two labellings of the same twenty samples sit stacked on the heatmap — the
 * cut's groups and the real conditions — and they are numbered independently:
 * `cut` numbers by input index, and a condition is 0 or 1 by which half of the
 * shuffled table a sample came from. Nothing ties the two origins together, so
 * a PERFECT recovery came out with the strips in opposite colours: measured
 * over five seeds, 0 of 20 positions shared a hue on four of them and 20 of 20
 * on the fifth. A reader comparing the strips would read a perfect result as a
 * total failure four times out of five.
 *
 * Renumbering both by first appearance across the displayed columns ties them
 * to the one thing they share — the order the figure draws them in — so the
 * leftmost group is the first colour in each. A perfect recovery now looks
 * identical and a real mismatch is the only thing that shows as one.
 */
function byAppearance(labels, order) {
  const rank = new Map();
  for (const i of order) if (!rank.has(labels[i])) rank.set(labels[i], rank.size);
  return labels.map((l) => rank.get(l));
}

/**
 * The colour of a true group.
 *
 * `null` means a gene with nothing added to it, which is not a fifth group —
 * --c-unknown is the role for "not measured", and here it reads as "there was
 * nothing here to find".
 */
function truthColour(colors, t) {
  if (t === null || t === undefined) return colors.unknown;
  return colors.clusters[t % colors.clusters.length];
}

/** The clusters standing after `shown` merges, as arrays of point indices. */
function clustersAfter(tree, shown) {
  const live = new Map();
  for (let i = 0; i < tree.n; i += 1) live.set(`-${i + 1}`, [i]);
  tree.nodes.slice(0, shown).forEach((nd, m) => {
    live.delete(String(nd.a.id));
    live.delete(String(nd.b.id));
    live.set(String(m + 1), nd.leaves);
  });
  return [...live.values()];
}

/**
 * A cluster as a soft disc.
 *
 * A circle round the members rather than a convex hull: at two or three points
 * a hull is a line or a sliver and reads as a stray mark, where a disc reads as
 * a group at every size.
 */
function blob(ctx, pts, leaves, colour, box, alpha, ex = EXTENT.euclidean) {
  const { x, y, w, h } = box;
  const P = (i) => [
    x + w * (0.5 + pts[i].x / (2 * ex)),
    y + h * (0.5 - pts[i].y / (2 * ex)),
  ];
  const xy = leaves.map(P);
  const cx = xy.reduce((a, p) => a + p[0], 0) / xy.length;
  const cy = xy.reduce((a, p) => a + p[1], 0) / xy.length;
  let r = 0;
  for (const [qx, qy] of xy) r = Math.max(r, Math.hypot(qx - cx, qy - cy));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r + 12, r + 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The pairs the linkage actually measured, for the merge in flight.
 *
 * Complete gets one line between the two furthest members, average gets every
 * cross pair, and Ward gets spokes from each member to the centre it would
 * form. `witness()` in the model decides WHICH pairs; this only paints them.
 */
function drawWitness(ctx, colors, pts, objects, node, params, box, t = 1) {
  const { x, y, w, h } = box;
  const ex = EXTENT[params.distance] ?? EXTENT.euclidean;
  const P = (i) => [
    x + w * (0.5 + pts[i].x / (2 * ex)),
    y + h * (0.5 - pts[i].y / (2 * ex)),
  ];
  const wt = witness(objects, node.a.leaves, node.b.leaves, params.linkage, params.distance);

  ctx.save();
  ctx.strokeStyle = colors.highlight;

  if (wt.kind === "spokes") {
    /* THE CENTRE IS COMPUTED IN THE PLANE, from the plotted points.

       Two bugs here once kept Ward's marks from drawing at all. `2 * EXTENT`
       multiplied by the per-metric TABLE rather than by the metric's number,
       so both coordinates were NaN and canvas discards a NaN path silently —
       no spokes, no centre, no error. And `witness().centres[0]` is the
       centroid in DATA space, twenty gene values, so its first two entries are
       two expression levels rather than a position on this stage. */
    const xy = wt.members.map(P);
    const cx = xy.reduce((a, q) => a + q[0], 0) / xy.length;
    const cy = xy.reduce((a, q) => a + q[1], 0) / xy.length;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75 * t;
    /* Each spoke REACHES from its member toward the centre as the merge runs,
       so Ward's "how far is everything from where this would put it" is a
       motion rather than a static star. */
    for (const [i] of wt.pairs) {
      const [ax, ay] = P(i);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (cx - ax) * t, ay + (cy - ay) * t); ctx.stroke();
    }
    ctx.globalAlpha = t;
    ctx.fillStyle = colors.highlight;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5 * t, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (wt.kind === "all") {
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3 * t;
    for (const [i, j] of wt.pairs) {
      const [ax, ay] = P(i); const [bx, by] = P(j);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.lineWidth = 2;
    ctx.globalAlpha = t;
    const [[i, j]] = wt.pairs;
    const [ax, ay] = P(i); const [bx, by] = P(j);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------------
   The dendrogram — drawn THREE times, in two orientations.

   The Cluster tab's tree grows upward from a row of leaves. The Heatmap tab's
   row tree grows leftward from the matrix's left edge and its column tree
   upward from the top, which is where `pheatmap` puts them. All three are this
   function: a merge is the same shape in every orientation once the two axes
   are named, and the cut line is the same line. Writing the rotated one
   separately is how the two tabs would come to disagree about where a cut sits.

   `place(rank, height)` is the whole difference between them.
   ------------------------------------------------------------------------ */
function drawDendrogram(ctx, colors, box, {
  tree, shown, labels, k, orient = "up", flight = null, truth = null,
}) {
  const { x, y, w, h } = box;
  const { rank, nodeX } = dendroLayout(tree);
  const hmax = Math.max(...tree.height) * 1.08;
  const n = tree.n;

  const place = orient === "up"
    ? (r, hv) => [x + (w * (r + 0.5)) / n, y + h - (h * hv) / hmax]
    : (r, hv) => [x + w - (w * hv) / hmax, y + (h * (r + 0.5)) / n];

  const rOf = (c) => (c.a ? nodeX[c.id - 1] : rank.get(c.leaves[0]));
  const hOf = (c) => (c.a ? c.height : 0);

  /* WHICH BRANCHES BELONG TO THE TWO CLUSTERS BEING MERGED. Without this the
     dendrogram gave no clue which of its branches the scatter was marking, so
     the reader had to find them by eye. The same colours run down the same two
     subtrees and the join between them is the highlighted one, so the two
     panels answer the same question at the same moment.

     Ink when the truth has the ramp, matching the scatter's blobs. */
  const branchOf = new Map();
  if (flight) {
    const paint = (cluster, colour) => {
      const walk = (c) => {
        if (!c.a) return;
        branchOf.set(c.id, colour);
        walk(c.a);
        walk(c.b);
      };
      walk(cluster);
    };
    paint(flight.node.a, truth ? colors.reference : colors.clusters[0]);
    paint(flight.node.b, truth ? colors.reference : colors.clusters[1]);
  }

  const stroke = (nd, H, colour, width) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    const p = [
      place(rOf(nd.a), hOf(nd.a)),
      place(rOf(nd.a), H),
      place(rOf(nd.b), H),
      place(rOf(nd.b), hOf(nd.b)),
    ];
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(p[i][0], p[i][1]);
    ctx.stroke();
  };

  ctx.save();
  const base = orient === "up" ? 1.5 : 1;
  for (let m = 0; m < Math.min(shown, tree.height.length); m += 1) {
    const nd = tree.nodes[m];
    /* The join the scatter is marking gets the highlight even once it is
       complete — at rest that IS the merge just made, and without this the
       dendrogram coloured the two subtrees but left the join between them
       looking like any other, which is the one part the reader is being asked
       to look at. */
    const colour = (flight && nd === flight.node)
      ? colors.highlight
      : branchOf.get(nd.id) ?? colors.empirical;
    stroke(nd, nd.height, colour, colour === colors.empirical ? base : base + 0.5);
  }

  /* THE JOIN IN FLIGHT, rising to the height it lands at. Drawn from the taller
     of its two children up to `t` of the way, so the bar climbs and settles —
     which is the same fraction the scatter's lines are reaching across on, and
     is why a merge between two far-apart clusters visibly takes the bar higher
     than one between neighbours. */
  if (flight && shown < tree.height.length && flight.node === tree.nodes[shown]) {
    const nd = flight.node;
    const from = Math.max(hOf(nd.a), hOf(nd.b));
    stroke(nd, from + (nd.height - from) * flight.t, colors.highlight, base + 0.5);
  }

  /* THE CUT, drawn across the whole tree at the height it acts on, so a cut
     landing in a flat run of merges LOOKS like it landed in one — the argument
     stated in geometry rather than in a caption. */
  if (k !== null && k >= 2 && k <= n - 1) {
    const [ax, ay] = place(-0.5, cutHeight(tree, k));
    const [bx, by] = place(n - 0.5, cutHeight(tree, k));
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  /* A TICK UNDER EVERY LEAF, and it carries whatever the dots carry.

     The cut's groups until the reader asks for the truth, and then the truth —
     otherwise the ticks would be cut colours from the same ramp as the dots
     beside them, and a reader matching a tick to a dot of the same hue would
     be matching a found cluster to a real block. That is the confusion the
     coloured truth exists to remove, one panel over.

     Read against the truth it is the widget's sharpest picture: a subtree
     whose ticks are all one colour recovered a real group. */
  if (labels && orient === "up") {
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    tree.order.forEach((leaf, r) => {
      ctx.fillStyle = truth
        ? truthColour(colors, truth[leaf])
        : colors.clusters[(labels[leaf] - 1) % colors.clusters.length];
      ctx.fillRect(place(r, 0)[0] - 2, y + h + 2, 4, 5);
    });
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------------
   The distance matrix — `dist()`, drawn.
   ------------------------------------------------------------------------ */
function drawDistance(ctx, colors, outer, {
  rows, distance, order = null, cells = null, groups = null, caption = "",
  truth = null,
}) {
  /* THE TRUTH STRIP, and why it belongs on THIS panel.

     The matrix is held in the finished tree's leaf order, so every cluster the
     build forms is a contiguous run and its box sits on the diagonal. A strip
     of true groups down the same rows therefore lines up with those boxes, and
     the comparison the toggle exists for becomes one glance: a box whose rows
     are all one colour found a real group, and a box holding two colours cut
     one in half or welded two together.

     A left gutter rather than the empty upper triangle: a strip up there would
     be a staircase, and it would not sit against the boxes. */
  const GUT = truth ? 12 : 0;
  const box = { x: outer.x + GUT, y: outer.y, w: outer.w - GUT, h: outer.h };
  const { D, n, max } = distanceMatrix(rows, distance);
  const idx = order ?? Array.from({ length: n }, (_, i) => i);
  const pos = new Map();
  idx.forEach((leaf, r) => pos.set(leaf, r));
  /* A CELL HAS A MAXIMUM SIZE, so a small matrix looks small. Filling a 200px
     panel with a 2 x 2 drew two enormous blocks that read as a picture of
     something rather than as the whole of a very small matrix. */
  const cell = Math.min(Math.min(box.w, box.h) / n, 22);

  ctx.save();
  /* LOWER TRIANGLE ONLY. The matrix is symmetric with a zero diagonal, so the
     upper half repeats the lower one. Dropping it lets the panel be a third
     larger in the same footprint. */
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      ctx.fillStyle = i === j
        ? colors.surface3
        : mixColour(ctx, colors.empirical, colors.surface, D[idx[i]][idx[j]] / (max || 1));
      ctx.fillRect(box.x + j * cell, box.y + i * cell, cell + 0.5, cell + 0.5);
    }
  }

  /* A BOX ROUND EACH CLUSTER FORMED SO FAR. Drawn in the same order the matrix
     is, so a cluster is always a contiguous run and its box sits on the
     diagonal. Watching them grow is watching the algorithm sort the table. */
  if (groups) {
    ctx.strokeStyle = colors.unknown;
    ctx.lineWidth = 1;
    for (const g of groups) {
      if (g.length < 2) continue;
      const rs = g.map((leaf) => pos.get(leaf)).sort((a, b) => a - b);
      if (rs[rs.length - 1] - rs[0] !== rs.length - 1) continue;   // not contiguous
      ctx.strokeRect(box.x + rs[0] * cell + 0.5, box.y + rs[0] * cell + 0.5,
        rs.length * cell - 1, rs.length * cell - 1);
    }
  }

  /* THE CELLS THE LINKAGE READ for the merge in flight — the same pairs the
     scatter draws its marks from, so the two panels light the same comparison.
     Ward names no pair, since it reads a spread, so nothing lights up for it.
     The absence is the honest picture rather than a gap. */
  if (cells) {
    ctx.fillStyle = colors.highlight;
    for (const [a, b] of cells) {
      const ra = pos.get(a);
      const rb = pos.get(b);
      if (ra === undefined || rb === undefined) continue;
      const r = Math.max(ra, rb);
      const c = Math.min(ra, rb);
      ctx.fillRect(box.x + c * cell, box.y + r * cell, cell + 0.5, cell + 0.5);
    }
  }

  if (truth) {
    for (let i = 0; i < n; i += 1) {
      ctx.fillStyle = truthColour(colors, truth[idx[i]]);
      ctx.fillRect(outer.x, box.y + i * cell + 0.5, 6, cell - 1);
    }
  }

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, n * cell - 1, n * cell - 1);
  if (caption) {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "left";
    ctx.fillText(caption, outer.x, box.y + n * cell + 13);
  }
  ctx.restore();
  return cell;
}

/* ---------------------------------------------------------------------------
   The data matrix — the table the whole pipeline starts from.

   BOTH AXES ARE NAMED: a row is a gene and a column is a sample whichever way
   the clustering is pointed, and the axis being clustered is the one written
   bright. Without those two words the rows/columns toggle asked the reader to
   hold in their head which of the table's two directions the distances were
   between.

   What is marked on it is the merge in flight, AT THE SIZE THE MERGE IS.
   Outlining `witness().pairs[0]` marks exactly two lines, which for average is
   an arbitrary cross pair out of all of them and for Ward is nothing at all —
   so it fell back to a hardcoded `[0, 1]` and the figure sat there outlining
   the first two rows of the table however large the two clusters were.

   Instead: a TICK PER MEMBER in the gutter, in the two cluster colours the
   scatter uses, so a 4-against-6 merge looks like four against six. The
   outline is kept for the one linkage that names a pair — complete, whose
   value IS the distance between the two objects outlined. Average measures
   every cross pair, which the distance matrix lights, and Ward measures a
   spread, so neither has two lines to outline and neither pretends to.
   ------------------------------------------------------------------------ */
function drawDataMatrix(ctx, colors, box, { vecs, cols, marks = null }) {
  /* The gutter holds TWO things and they must not share pixels: the axis name,
     then the membership ticks against the matrix edge. At 15 and 13 the
     rotated "genes" ran straight through its own ticks. */
  const GUT = 21;                      // 0-10 the rotated row label, 14-19 ticks
  const TOP = 19;                      // baseline at 9, ticks 12-17
  const x = box.x + GUT;
  const y = box.y + TOP;
  const w = box.w - GUT;
  const h = box.h - TOP;
  const nR = vecs.length;
  const nC = vecs[0].length;
  const cw = w / nC;
  const ch = h / nR;

  let max = 0;
  for (const r of vecs) for (const v of r) max = Math.max(max, Math.abs(v));

  ctx.save();
  for (let i = 0; i < nR; i += 1) {
    for (let j = 0; j < nC; j += 1) {
      const t = vecs[i][j] / (max || 1);
      ctx.fillStyle = t >= 0
        ? mixColour(ctx, colors.surface3, colors.valueHigh, t)
        : mixColour(ctx, colors.surface3, colors.valueLow, -t);
      ctx.fillRect(x + j * cw, y + i * ch, cw + 0.5, ch + 0.5);
    }
  }

  /* THE TWO CLUSTERS BEING MERGED, at their real size. Along the clustered
     axis, because that is the axis whose entries are the objects. */
  if (marks) {
    const band = (i, colour) => {
      ctx.fillStyle = colour;
      if (cols) ctx.fillRect(x + i * cw + 0.5, box.y + TOP - 7, cw - 1, 5);
      else ctx.fillRect(box.x + GUT - 7, y + i * ch + 0.5, 5, ch - 1);
    };
    for (const i of marks.a) band(i, colors.clusters[0]);
    for (const i of marks.b) band(i, colors.clusters[1]);

    if (marks.pair) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      for (const p of marks.pair) {
        if (cols) ctx.strokeRect(x + p * cw, y, cw, h);
        else ctx.strokeRect(x, y + p * ch, w, ch);
      }
    }
  }

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  /* The axis being clustered reads bright, the other one stays quiet. */
  ctx.textAlign = "center";
  ctx.fillStyle = cols ? colors.ink1 : colors.ink3;
  ctx.fillText(`${nC} samples (columns)`, x + w / 2, box.y + 9);
  ctx.save();
  ctx.translate(box.x + 6, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = cols ? colors.ink3 : colors.ink1;
  ctx.fillText(`${nR} genes (rows)`, 0, 0);
  ctx.restore();

  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.fillText(marks
    ? (cols ? "the two groups of columns being merged" : "the two groups of rows being merged")
    : (cols ? "each column is one object" : "each row is one object"),
  box.x, box.y + box.h + 13);
  ctx.restore();
}

/** A labelled arrow from one panel to the next. */
function arrow(ctx, colors, x0, y, x1, label) {
  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.fillStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x1 - 6, y - 4);
  ctx.lineTo(x1 - 6, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillText(label, (x0 + x1) / 2, y - 7);
  ctx.restore();
}

/* ---------------------------------------------------------------------------
   The Heatmap tab.
   ------------------------------------------------------------------------ */
function drawHeatmap(ctx, colors, box, { state, params }) {
  const { heat, rowTree, colTree } = state;
  const { x, y, w, h } = box;

  const rowOrder = rowTree.order;
  const colOrder = colTree.order;
  const rowLab = cut(rowTree, params.cutRows);
  const colLab = cut(colTree, params.cutCols);
  const empty = new Set(noiseBoxes(rowLab, heat.planted).map((b) => b.label));

  /* `pheatmap`'s arrangement: the row tree down the left, the column tree
     across the top, the matrix between them. The trees are not decoration —
     the tab's whole claim is that the boxes discard what the merge heights
     say, so the merge heights have to be on the figure for the claim to be
     checkable rather than asserted. */
  /* TWO SIZES, NOT ONE. Both trees were 42 off a single constant, and 42px is
     enough for the row tree — which has 76px of labels beside it and only has
     to show where the cut falls — but not for the column tree, whose whole job
     here is the merge heights the boxes discard. At 42 its nineteen joins
     stacked into a band and the reader could not see which pair joined last.
     The tab's height pays for the extra rather than the matrix: 640 -> 690,
     so the cells stay the size they were. */
  const TREE_ROW = 42;             // the row tree's width
  const TREE_COL = 92;             // the column tree's height
  const LABEL = 76;                // between the row tree and the matrix
  const ANNO = 9;                  // one annotation row, as pheatmap draws them
  const ANNO_GAP = 3;
  /* CLUSTERING IS UNSUPERVISED, so by default the only strip is the one the
     cut produced. The true condition ships behind the `truth` toggle — the
     same control that reveals the planted groups on the scatter, and for the
     same reason: the reader asks for the answer rather than meeting it beside
     the question. */
  const showTruth = Boolean(params.truth);
  const annoH = showTruth ? ANNO * 2 + ANNO_GAP : ANNO;
  const gx = x + TREE_ROW + LABEL;
  const gw = w - TREE_ROW - LABEL;
  const annoY = y + TREE_COL + 5;
  const gy = annoY + annoH + 5;
  const gh = h - (gy - y);
  const cellH = gh / heat.rows.length;
  const cellW = gw / HEAT_SAMPLES;

  drawDendrogram(ctx, colors, { x, y: gy, w: TREE_ROW, h: gh },
    { tree: rowTree, shown: rowTree.height.length, labels: null,
      k: params.cutRows, orient: "left" });

  drawDendrogram(ctx, colors, { x: gx, y, w: gw, h: TREE_COL },
    { tree: colTree, shown: colTree.height.length, labels: null,
      k: params.cutCols, orient: "up" });

  /* THE COLUMN ANNOTATION, the way `annotation_col` draws it: strips above the
     matrix, one cell per column, in the column tree's own order.

     Two rows, and the pairing is the argument. One is what `cutree_cols`
     decided; the other is what the samples REALLY are. They are
     column-aligned with the matrix and with the tree above them, so a reader
     can run a finger down and see a cut boundary land inside a condition — or
     see the cut carve two real groups into six tidy ones, which it will do the
     moment you ask it for six.

     This replaced a row of "H"/"D" letters under the columns. Letters could
     only be drawn every other column before they collided, so half the samples
     went unlabelled, and they sat at the far end of the matrix from the tree
     that ordered them. */
  const annoRow = (yy, colourOf) => {
    colOrder.forEach((s, ci) => {
      ctx.fillStyle = colourOf(s);
      ctx.fillRect(gx + ci * cellW, yy, cellW + 0.5, ANNO);
    });
  };
  const cutRank = byAppearance(colLab, colOrder);
  const condRank = byAppearance(heat.condition, colOrder);
  annoRow(annoY, (s) => colors.clusters[cutRank[s] % colors.clusters.length]);
  /* THE TWO TRUTHS, BOTH COLOURED: two conditions across the columns and four
     planted blocks down the rows. Ink and two intensities were tried first, to
     keep the cluster ramp for the cut strip alone; two greys cannot carry four
     blocks, and the strip read as one thing shading into another rather than
     as two categories. */
  if (showTruth) {
    annoRow(annoY + ANNO + ANNO_GAP, (s) => truthColour(colors, condRank[s]));
  }

  /* The strip is named for the call that produced it, not for what it might
     mean. "Column cut" beside "Condition" read as two findings of equal
     standing, where `cutree_cols` names the control in the rail and the
     argument a student would write, and claims nothing. */
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "right";
  ctx.fillText("cutree_cols", gx - 8, annoY + ANNO - 1);
  if (showTruth) ctx.fillText("condition", gx - 8, annoY + ANNO + ANNO_GAP + ANNO - 1);
  ctx.textAlign = "left";

  /* THE GENE SIDE OF THE SAME QUESTION: which of the four blocks a gene really
     belongs to, or none, as one column of cells against the matrix's left edge
     in the row tree's order. It reads against the `cutree_rows` boxes the way
     the condition strip reads against the column ones, and it is what makes
     "a box holding no structured gene at all" checkable rather than asserted
     by a caption. */
  const labelRight = gx - (showTruth ? ANNO + ANNO_GAP + 8 : 8);
  if (showTruth) {
    rowOrder.forEach((g, ri) => {
      ctx.fillStyle = truthColour(colors, heat.planted[g]);
      ctx.fillRect(gx - ANNO - ANNO_GAP, gy + ri * cellH, ANNO, cellH + 0.5);
    });
  }

  const scale = heatScale(heat.rows);

  ctx.save();
  rowOrder.forEach((g, ri) => {
    colOrder.forEach((s, ci) => {
      const t = heat.rows[g][s] / scale;
      ctx.fillStyle = t >= 0
        ? mixColour(ctx, colors.surface3, colors.valueHigh, t)
        : mixColour(ctx, colors.surface3, colors.valueLow, -t);
      ctx.fillRect(gx + ci * cellW, gy + ri * cellH, cellW + 0.5, cellH + 0.5);
    });
  });

  /* The boxes. A run of adjacent rows sharing a cut label is one box, which is
     what `cutree_rows` draws — and the point is that a box around nothing is
     drawn identically to a box around a real gene module. So it is drawn
     identically, and then named. */
  ctx.lineWidth = 1.5;
  for (const [from, to, label] of runs(rowOrder.map((g) => rowLab[g]))) {
    const isEmpty = empty.has(label);
    ctx.strokeStyle = isEmpty ? colors.extreme : colors.ink3;
    ctx.strokeRect(gx + 0.5, gy + from * cellH + 0.5, gw - 1, (to - from) * cellH - 1);
    const mid = gy + ((from + to) / 2) * cellH + 4;
    if ((to - from) * cellH >= 13) {
      ctx.fillStyle = isEmpty ? colors.extreme : colors.ink2;
      ctx.textAlign = "right";
      // a box can be one gene wide at cutree_rows = 8, and "1 genes" is wrong
      const nGenes = to - from;
      const noun = `${nGenes} gene${nGenes === 1 ? "" : "s"}`;
      ctx.fillText(isEmpty ? `${noun}, no real pattern` : noun, labelRight, mid);
    }
  }

  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1.5;
  for (const [from, to] of runs(colOrder.map((s) => colLab[s]))) {
    ctx.strokeRect(gx + from * cellW + 0.5, gy + 0.5, (to - from) * cellW - 1, gh - 1);
  }

  ctx.restore();
}

/** Maximal runs of equal values: [[from, toExclusive, value], …]. */
function runs(seq) {
  const out = [];
  let from = 0;
  for (let i = 1; i <= seq.length; i += 1) {
    if (i === seq.length || seq[i] !== seq[from]) { out.push([from, i, seq[from]]); from = i; }
  }
  return out;
}

/* Canvas has no `color-mix`, so the ramp is interpolated by hand. This is not
   a style preference: `ctx.fillStyle` silently REFUSES an unsupported value and
   keeps the previous one, so on a browser without it the whole heatmap paints
   in whichever colour was last valid — and it renders correctly in Chrome,
   which is exactly how a portability bug reaches a site nobody tests on Safari.

   Both ends still come from tokens, so the ramp has no hardcoded colour. Two
   other widgets carry their own copy of this; it belongs in core, which is a
   core change and a separate commit. */
function mixColour(ctx, lo, hi, t) {
  const parse = (c) => {
    ctx.fillStyle = c;
    const s = ctx.fillStyle;
    if (s[0] === "#") {
      return s.length === 4
        ? [1, 2, 3].map((i) => parseInt(s[i] + s[i], 16))
        : [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    }
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const a = parse(lo);
  const b = parse(hi);
  const u = clamp(t, 0, 1);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(",")})`;
}

/* The matrix carries SIGNS — a gene is above or below its baseline — so zero
   sits in the middle and the ramp runs two ways out of it. Scaling
   low-to-high across the raw range instead put the baseline at mid-ramp and
   the ±2 blocks barely either side of it, washing the planted structure out
   of the picture.

   The scale is the 98th percentile of |value|, not the maximum: one extreme
   cell would otherwise flatten every other cell towards the middle. */
function heatScale(rows) {
  const flat = rows.flat().map(Math.abs).sort((a, b) => a - b);
  return flat[Math.floor(0.98 * (flat.length - 1))] || 1;
}

function countsOf(labels) {
  const t = new Map();
  for (const l of labels) t.set(l, (t.get(l) || 0) + 1);
  return [...t.values()].sort((a, b) => b - a);
}
