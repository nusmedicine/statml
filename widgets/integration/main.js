/* integration — slot 80, "Single-Cell RNA-seq: Integration". SHIPPED 2026-09-24.
 *
 * Planned 2026-09-24 (catalogue § Slot 80): measured in
 * `_lab/integration-measure.mjs`, mocked in `_lab/integration-mock.html`,
 * four picks, every one the recommendation —
 *   1. anchors and the correction only; the shared-space step is one clause
 *      of caption, which is how every teaching source read leads (mutual
 *      nearest neighbours; CCA a sentence at most);
 *   2. one page built by Step: the anchors appear, then the cells move along
 *      them — the order is the argument;
 *   3. the control is WHICH VARIABLE IS DECLARED THE BATCH, Patient or Tissue
 *      — the arc's MNN-against-Harmony control had no arm that wins anywhere
 *      once both were written as published, and the merge the measurement
 *      found follows the key (the lesson integrates its four samples as
 *      layers, so tumour against liver is corrected as technical);
 *   4. no anchor score — under Tissue the wrong anchors score HIGHER (0.66
 *      against 0.40), since a whole cluster aligned with a whole cluster is
 *      consistent, and drawing it invites the wrong reading.
 * And by measurement, no batch-effect slider: centring removes the shift at
 * any size, so no setting of it changes the outcome.
 *
 * Two panels, the same cells: coloured by the declared batch and by cell
 * type, which is the lesson's DimPlot(group.by = c("patient", "type")).
 * The batch is in dark and light INK, not --c-group-a/b (his pick, draft
 * round 0): those are the blue and yellow of cluster-a/b, so blue meant
 * Patient 1 on one panel and hepatocyte on the other — colour carrying two
 * groupings on one figure.
 * Anchors are drawn where the cells were SEQUENCED, as bridges across the
 * batch gap — drawn in the shared space the batches overlap and they read as
 * specks (the mock's first version).
 */
import { defineWidget, fmt } from "../core/index.js";
import { simulate, integrate, measures, TYPES, KEYS } from "./engine.js";

const STEP_MS = 900;
const DRAWN = 120;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const pct = (v) => `${Math.round(100 * v)}%`;
/* which --c-cluster-* slot each of the six types wears: hepatocyte a, tumour c, … */
const TYPE_SLOT = [0, 2, 1, 3, 4, 5];

/* The figure's geometry, one place for everything that draws (5.8). Two
   square panels side by side under a line of heading each, a caption line
   beneath. The height is fixed; the panels take the smaller of half the
   width and what the height leaves, so the height never reads the width. */
const HEIGHT = 440, TOP = 26, BOTTOM = 26, GAP = 24;
function layout(w) {
  const S = Math.max(120, Math.min(Math.floor((w - GAP) / 2), HEIGHT - TOP - BOTTOM));
  const x0 = Math.floor((w - (2 * S + GAP)) / 2);
  return { S, panels: [{ x: x0, y: TOP }, { x: x0 + S + GAP, y: TOP }] };
}
/* one view for every stage, so an anchor is a bridge and the correction a movement */
function viewOf(state) {
  const pts = [...state.res.raw, ...state.res.corrected];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const half = (Math.max(x1 - x0, y1 - y0) / 2) * 1.06, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return (p, P, S) => [P.x + S / 2 + ((p[0] - mx) / half) * (S / 2 - 6), P.y + S / 2 - ((p[1] - my) / half) * (S / 2 - 6)];
}

/* the press state: how many presses taken, and what the button says next */
function settle(anim) {
  anim.done = anim.n >= 2 && anim.p >= 1;
  anim.labelAt = anim.done ? "done" : `s${anim.n}`;
}

defineWidget({
  slug: "integration",
  title: "Single-Cell RNA-seq: Integration",
  subtitle:
    "Cells from different samples differ by technical batch effects as well as by biology. "
    + "Anchor-based integration uses pairs of mutual nearest neighbours between a reference batch "
    + "and a query batch as anchors, and shifts each query cell by the weighted mean of the anchor "
    + "vectors near it. The method assumes the batch variable is technical and the batches share "
    + "cell types; a population present in one batch only is anchored to cells of another type and "
    + "corrected onto them.",
  layout: "side",
  status: "shipped",
  height: HEIGHT,

  params: {
    dataSec: { type: "section", label: "The data" },
    batch: {
      type: "segmented", label: "Batch variable",
      detail: "the variable whose differences integration treats as technical and removes. Patient: two batches, each with liver and tumour samples. Tissue: liver samples against tumour samples, with tumour cells in the query batch only. Harmony, FastMNN and scVI correct by other mechanisms and also assume the batches share cell types",
      options: [{ value: "patient", label: "Patient" }, { value: "tissue", label: "Tissue" }],
      default: "patient",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    /* authoring escape hatch, first render only: presses already taken */
    shown: { type: "int", min: 0, max: 2, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const key = KEYS[params.batch];
    return [
      { token: "ink-1", label: `${key.labels[0]}: the reference batch, left unchanged`, mark: "dot" },
      { token: "ink-3", label: `${key.labels[1]}: the query batch, shifted onto the reference`, mark: "dot" },
      ...TYPES.map((t, i) => ({ token: `cluster-${"abcdef"[TYPE_SLOT[i]]}`, label: t.name, mark: "dot" })),
      { token: "reference", label: "An anchor: a pair of cells, one from each batch; a sample of them drawn", mark: "line" },
      { token: "ink-1", label: "On the cell-type panel, an anchor between two different types", mark: "line" },
    ];
  },

  /* Pure and seeded: the cells, then the method under the declared key.
     Both keys see the same cells, so a switch recolours the batches and
     changes only which pairs are found. */
  compute: ({ params, rng }) => {
    const cells = simulate(rng);
    const res = integrate(cells, params.batch);
    const m = measures(cells, res);
    const order = cells.map((_, i) => i).sort((a, b) => ((a * 7919) % 613) - ((b * 7919) % 613));
    const across = res.pairs.map(([i, j]) => cells[i].type !== cells[j].type);
    /* the anchors DRAWN: an even sample of about DRAWN of them, every stride-th
       in the order they were found, so the share joining two types on the
       figure is the share in the method. All of them correct the cells and all
       are counted (his round 1: 878 lines were too busy to read) */
    const stride = Math.max(1, Math.ceil(res.pairs.length / DRAWN));
    const drawn = res.pairs.map((_, p) => p).filter((p) => p % stride === 0);
    const state = { cells, res, m, order, across, drawn, stride };
    state.view = viewOf(state);
    return state;
  },

  /* Step alone, two presses that are read (4.5): the anchors grow from each
     second-batch cell to its partner, then the second batch travels along
     them while each bridge shortens to what is left to travel. */
  animation: {
    stepLabel: { anim: "labelAt", labels: { s0: "Find anchors", s1: "Correct", done: "Step" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      s0: "Find mutual nearest neighbours between the two batches, after centring each batch on its own mean",
      s1: "Shift each query cell by the weighted mean of the anchor vectors near it",
      done: "Both steps are complete",
    }, default: "Step through integration" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: 0, p: 1 };
      if (!fromScratch) anim.n = Math.min(2, Math.max(0, Number(params.shown) || 0));
      settle(anim);
      return anim;
    },
    advance: (anim, { dt }) => {
      if (anim.p >= 1) {
        if (anim.n >= 2) { settle(anim); return false; }
        anim.n += 1; anim.p = 0;
      }
      anim.p = Math.min(1, anim.p + dt / STEP_MS);
      if (anim.p >= 1) { settle(anim); return false; }
      return true;
    },
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    const n = anim ? anim.n : Number(params.shown) || 0;
    const e = anim && anim.p < 1 ? easeInOut(anim.p) : 1;
    const grow = n === 1 ? e : n > 1 ? 1 : 0;       // how far the bridges have grown
    const move = n === 2 ? e : 0;                    // how far the second batch has travelled
    const { S, panels } = layout(w);
    const { cells, res, order, across, view } = state;
    const key = KEYS[params.batch];
    const pos = (i) => {
      if (!move || res.batch[i] === 0) return res.raw[i];
      return [lerp(res.raw[i][0], res.corrected[i][0], move), lerp(res.raw[i][1], res.corrected[i][1], move)];
    };
    const heads = [`Coloured by ${key.name.toLowerCase()}, the batch variable`, "Coloured by cell type"];
    panels.forEach((P, r) => {
      ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink1; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      ctx.fillText(heads[r], P.x, P.y - 9);
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(P.x + 0.5, P.y + 0.5, S - 1, S - 1);
      /* the bridges, under the cells; faded out as the cells arrive */
      if (grow > 0 && move < 1) {
        ctx.save();
        ctx.lineWidth = 1;
        state.drawn.forEach((p) => {
          const [i, j] = res.pairs[p];
          const a = view(res.raw[i], P, S), b = view(pos(j), P, S);
          const end = [lerp(b[0], a[0], grow), lerp(b[1], a[1], grow)];
          /* which anchors join two types is a fact about types, so it is drawn on
             the type panel only; on the batch panel, whose dots are the two inks,
             every anchor is one faint line (draft round 0: white on white merged) */
          const hard = r === 1 && across[p];
          ctx.strokeStyle = hard ? colors.ink1 : colors.reference;
          ctx.globalAlpha = (hard ? 0.7 : r === 0 ? 0.35 : 0.45) * (1 - move);
          ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
        });
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (const i of order) {
        const q = view(pos(i), P, S);
        ctx.fillStyle = r === 0 ? (res.batch[i] === 0 ? colors.ink1 : colors.ink3) : colors.clusters[TYPE_SLOT[cells[i].type]];
        ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    /* the caption: what the figure holds at this press */
    const m = state.m;
    const cap = n === 0 ? "Before integration: no anchors found"
      : n === 1 ? `${m.anchors} anchors, ${m.across} of them between two different cell types${state.stride > 1 ? `; 1 in ${state.stride} drawn` : ""}`
        : "After integration: each query cell shifted by the weighted mean of the anchor vectors near it";
    ctx.font = `${colors.fsSm} ${colors.font}`; ctx.fillStyle = colors.ink2; ctx.textAlign = "left";
    ctx.fillText(cap, panels[0].x, TOP + S + 18);
  },

  readout: ({ params, state, anim }) => {
    const n = anim ? anim.n : Number(params.shown) || 0;
    const m = state.m, key = KEYS[params.batch];
    const done = n >= 2 && (!anim || anim.p >= 1);
    return [
      { label: "Anchors between two different cell types", value: n >= 1 ? `${m.across} of ${m.anchors}` : "–", note: n >= 1 ? `${pct(m.across / Math.max(1, m.anchors))}; an anchor is a pair of mutual nearest neighbours, one cell from each batch` : "found by Find anchors" },
      { label: "Patient mixing, 1 = fully mixed", value: done ? `${fmt(m.mixPatient[0], 2)} → ${fmt(m.mixPatient[1], 2)}` : fmt(m.mixPatient[0], 2), note: "of each cell's 15 nearest neighbours, the share from the other patient, relative to the share if fully mixed" },
      { label: "Tumour cells' neighbours that are hepatocytes", value: done ? `${pct(m.tumourHep[0])} → ${pct(m.tumourHep[1])}` : pct(m.tumourHep[0]), note: key === KEYS.tissue ? "15 nearest neighbours; tumour cells are in the query batch only" : "15 nearest neighbours; tumour cells are in both patients" },
    ];
  },
});
