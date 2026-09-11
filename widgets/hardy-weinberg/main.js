/* ============================================================================
   Widget 56 · Hardy-Weinberg — one allele frequency against three genotype
   frequencies, and what moves a sample off the prediction.

   PHM5003 week 6 QC. `model.js` carries the test, the samplers, the geometry
   and the copy; this file draws them.

   The de Finetti triangle is the picture the whole argument fits in: a genotype
   table is one point, the Hardy-Weinberg prediction is a curve, a table's
   horizontal position IS its allele frequency, so the prediction sits directly
   above the observation and the heterozygote deficit is the length of the drop
   between them.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD. `_lab/hardy-weinberg-mock.html` drew
       nine sections and Kenneth picked eight (catalogue § Slot 56, 2026-09-12):
       subtitle A, the triangle with the genotype bars beside it, four sources
       with the pooled panel drawing both populations' points and the line
       between them, five sample sizes with a detail window, core's readout
       tiles and the threshold as three rungs, individuals arriving one at a
       time, the Many-SNPs page, and rail C.

    2. TWO PAGES, ONE RAIL, AND `page` IS A DISPLAY PARAMETER. Switching to the
       2,000 SNPs and back must not throw away the sample the reader has been
       accumulating (3.2, non-negotiable 3), so both pages are built by one
       `compute()` on every data change and the page control only chooses which
       is drawn.

    3. WHICH FORCES THE MANY-SNPS PAGE TO DRAW FROM COUNTS. 2,000 tables at
       50,000 individuals is 200 million Bernoulli draws per compute; a
       multinomial over the three genotypes is four. `model.js` says where the
       exact branch ends and why, and the verify checks the fast sampler
       against the survey's own exact one.

    4. THE THRESHOLD IS A DISPLAY PARAMETER TOO. It changes no sample: only the
       line on the histogram, the count beside it, and which side of the line
       the P tile's own number is on. Under 3.2 that is a display change, and
       moving it mid-arrival keeps the arrival.

    5. THE SAMPLE SIZE AND THE SOURCE ARE DATA. They make the sample a
       different sample, so the arrival starts over (invariant 3).

    6. DRAW IS NOT A DRIVE BUTTON, and that is core's contract rather than a
       preference. Core's one once-only button is the LEAD, and a lead DISABLES
       step and run until it has been pressed — which is right for bootstrap's
       single sample and exactly wrong here, where landing the finished sample
       is the END of the loop Step and Play walk. Gating them behind it would
       open the widget on its own answer (2.1). So the fourth button is a rail
       action under the drive row — the `Initialize weights` shape (widget 37) —
       and it is momentary: it fills the sample and clears itself, the way
       widget 55's `Default view` does, so no link carries it by accident.

    7. ONE CLOCK, AND THE FRACTION KEPT ACROSS FRAMES (widget 55's pacing, not
       widget 48's one-step floor). A unit of the reveal is a fixed number of
       individuals — 1 at 100, 500 at 50,000 — so every sample size builds in
       about six seconds and the step label says how many it adds.

    8. THE TWO POPULATIONS' OWN POINTS ARE SETUP, NOT ANSWER. They are drawn
       from the start, before any individual has arrived, because they are what
       the frequency difference SETS — the same reading the CLT widget's
       population panel gets. The pooled sample is the average of their two
       tables, so it lies on the line between them, and that line lies under the
       curve. That is the whole Wahlund argument, without a sentence.

    9. THE CAPTION AND ITS NOTE ARE BOTH MEASURED. `plot.caption` draws 8px
       above the plot area, which on a triangle is exactly where the apex label
       sits, so both are drawn here instead — and when the caption reaches where
       the note would start, the note drops to the row above the apex, which is
       outside the triangle. The mock found this by printing them over each
       other.

   10. THE P VALUE'S COLOUR IS ON THE CANVAS, NOT ON THE TILE. Core's readout
       tiles render a label, a value and a note and have nowhere to carry a
       tone, so the reading past the threshold is the χ² and P note beside the
       bars, in `--c-extreme`. Named here rather than worked around silently.

   11. THE THRESHOLD'S LINE ON THE HISTOGRAM IS EXACT. χ² = n·F² for any
       two-allele table, so a SNP is past the threshold exactly when
       |F| > √(χ²crit / n) — the line is the test, not a summary of it, and it
       has a mirror on the excess side because a heterozygote EXCESS fails the
       same test.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

/* Set by `defineWidget` below, read only by `clearWhole` — decision 6. */
let widgetApi = null;

/* ---- small drawing helpers ----------------------------------------------- */

const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const noteFont = (colors) => `${colors.fsXs} ${colors.font}`;

/** The width one string takes in the font it is about to be drawn in. */
function widthOf(ctx, s, font) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

/** Shorten a string to fit, ending in an ellipsis. Captions are measured,
    never clipped. */
function fit(ctx, s, font, maxW) {
  if (widthOf(ctx, s, font) <= maxW) return s;
  let out = s;
  while (out.length > 1 && widthOf(ctx, `${out}…`, font) > maxW) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/** A caption on its own row, haloed so a curve behind it stays readable. */
function capAt(ctx, colors, x, y, text, maxW) {
  const s = fit(ctx, text, capFont(colors), maxW);
  ctx.save();
  ctx.font = capFont(colors);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = colors.ink2;
  ctx.fillText(s, x, y);
  ctx.restore();
  return widthOf(ctx, s, capFont(colors));
}

/** A short right-aligned note on a caption's own row. */
function noteAt(ctx, colors, xRight, y, text, maxW, tone) {
  const s = fit(ctx, text, noteFont(colors), maxW);
  ctx.save();
  ctx.font = noteFont(colors);
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, xRight, y);
  ctx.fillStyle = tone ?? colors.ink2;
  ctx.fillText(s, xRight, y);
  ctx.restore();
}

/** A plain haloed label at a point on the figure. */
function markLabel(ctx, colors, s, x, y, tone, align = "left") {
  ctx.save();
  ctx.font = noteFont(colors);
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = tone ?? colors.ink3;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** An expected count, read the way a count of that size is read. */
const expText = (v) => (v >= 1000 ? M.intText(Math.round(v)) : v.toFixed(1));

/* ---- the point's path ----------------------------------------------------
 * From the third individual, which is the first that can be off a corner, and
 * sampled down to a few hundred points: at 50,000 individuals a point per
 * individual is 50,000 line segments a frame and the same picture. */
function trailPoints(arrival, k, max = 240) {
  if (k < 4) return null;
  const from = 3;
  const by = Math.max(1, Math.ceil((k - from) / max));
  const pts = [];
  for (let i = from; i < k; i += by) pts.push(M.uv(M.countsAt(arrival, i)));
  pts.push(M.uv(M.countsAt(arrival, k)));
  return pts.length > 1 ? pts : null;
}

/* ---- the de Finetti triangle --------------------------------------------- */

/**
 * One triangle, whole or as a magnified window on the same coordinates.
 *
 * `win` is the detail view's window in triangle coordinates, so the detail is a
 * REGION of this figure rather than a second kind of plot: the marks, the
 * curve and the scales are the same, and only the domain changes.
 */
function drawTriangle(ctx, colors, L, params, state, anim) {
  const { tri, panel } = L;
  const win = params.view === "sample" ? M.zoomWindow(params.p) : null;
  const rect = { x: tri.x, y: tri.y, w: tri.side, h: tri.h };
  const plot = makePlot({
    ctx,
    colors,
    rect,
    xDomain: win ? win.x : [0, 1],
    yDomain: win ? win.y : [0, M.S3 / 2],
  });

  const arrival = state.one;
  const k = Math.min(anim?.k ?? 0, arrival.n);
  const counts = M.countsAt(arrival, k);
  const src = M.sourceOf(params.source);

  /* the caption row, and the note beside it when both fit (decision 9) */
  const capText = k >= arrival.n
    ? `${M.intText(arrival.n)} individuals, ${src.caption}`
    : `${M.intText(k)} of ${M.intText(arrival.n)} individuals, ${src.caption}`;
  const capW = capAt(ctx, colors, panel.x, rect.y - 22, capText, panel.w);
  if (k > 0) {
    const t = M.hweTest(counts);
    /* Named as A's, because the triangle's horizontal position is a's: the two
       are one number read from either end, and the corners say which is which. */
    const note = `frequency of A ${M.n2(t.p)}`;
    const right = rect.x + rect.w;
    const wide = rect.w * 0.5;
    const room = right - (panel.x + capW) - 12;
    const fits = widthOf(ctx, note, noteFont(colors)) <= Math.min(room, wide);
    noteAt(ctx, colors, right, fits ? rect.y - 22 : rect.y - 7, note, wide - (fits ? 0 : 12));
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
  ctx.clip();

  if (!win) {
    /* the three edges, in the recessive grid ink: they are the frame of the
       figure, not a mark in it */
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(plot.sx(0), plot.sy(0));
    ctx.lineTo(plot.sx(1), plot.sy(0));
    ctx.lineTo(plot.sx(0.5), plot.sy(M.S3 / 2));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  plot.curve(M.CURVE, { stroke: colors.theory, width: 2 });
  if (!win) {
    /* On the curve's left shoulder, inside the edge: at q = 0.23 the left edge
       is at height 0.398 in triangle units and the curve at 0.307, so a line of
       text 14px above the curve clears the edge. In the detail view the legend
       names the curve instead — a label pinned to one place on the curve is
       usually outside a 0.22-wide window. */
    /* Which shoulder: the one farther from every point that sits on the
       curve — the two populations at p ± gap/2 and the prediction at the
       control's p. At the default (0.5 ± 0.25) the left shoulder's label ran
       into population 1's point and the chord (read in the browser
       2026-09-12); the right shoulder is clear there, and the choice follows
       the parameters, so it is the same picture at the same URL. */
    /* The two shoulders are equally close at the default (0.5 ± 0.25), so the
       test is on the TEXT's own extent, not a point: the label occupies an
       interval of x, and no point on the curve may fall in it. Candidates run
       from the outside in on each flank; the first clear one wins, and if
       none is clear the legend carries the name, as it already does in the
       detail view. */
    const avoid = [params.p, ...(params.source === "pooled" ? state.cfg.subs : [])]
      .map((q) => 1 - q);
    ctx.save();
    ctx.font = noteFont(colors);
    const tw = ctx.measureText(M.STRINGS.curveLabel).width / rect.w + 0.03;
    ctx.restore();
    const clear = (lo, hi) => avoid.every((x) => x < lo - 0.03 || x > hi + 0.03);
    let placed = null;
    for (const x0 of [0.14, 0.2, 0.26]) {
      if (!placed && clear(x0, x0 + tw)) placed = { x0, align: "left" };
      if (!placed && clear(1 - x0 - tw, 1 - x0)) placed = { x0: 1 - x0, align: "right" };
    }
    if (placed) {
      const [lx, ly] = M.curvePoint(1 - placed.x0);
      const dx = placed.align === "left" ? 4 : -4;
      markLabel(ctx, colors, M.STRINGS.curveLabel, plot.sx(lx) + dx, plot.sy(ly) - 8, colors.theory, placed.align);
    }
  }

  /* DECISION 8: the two populations, drawn from the start. */
  if (params.source === "pooled") {
    const a = M.curvePoint(state.cfg.subs[0]);
    const b = M.curvePoint(state.cfg.subs[1]);
    plot.curve([a, b], { stroke: colors.ink3, width: 1, dash: [4, 3] });
    plot.dot(a[0], a[1], { fill: colors.groupA, r: 4 });
    plot.dot(b[0], b[1], { fill: colors.groupB, r: 4 });
  }

  if (k > 0) {
    const t = M.hweTest(counts);
    /* The path exists only if the point WALKED. A sample landed at once —
       "Draw the whole sample", or `?shown=N` / `?whole=1` on first render —
       never moved, and a path drawn for it would be a walk that did not
       happen (read in the browser 2026-09-12: `?whole=1` drew the zigzag). */
    const path = anim?.walked ? trailPoints(arrival, k) : null;
    if (path) plot.curve(path, { stroke: colors.empirical, width: 1.2, opacity: 0.45 });

    const [ux, uy] = M.uv(counts);
    const [, uyExp] = M.curvePoint(t.p);
    ctx.save();
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.sx(ux), plot.sy(uy));
    ctx.lineTo(plot.sx(ux), plot.sy(uyExp));
    ctx.stroke();
    ctx.restore();
    plot.dot(ux, uyExp, { fill: colors.theory, r: 4 });
    plot.dot(ux, uy, { fill: colors.empirical, r: 5 });
  }
  ctx.restore();

  if (win) {
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.restore();
    const mid = (win.x[0] + win.x[1]) / 2;
    plot.axisX({
      ticks: [win.x[0] + 0.02, mid, win.x[1] - 0.02],
      format: (v) => M.n2(v),
      label: M.STRINGS.zoomX,
    });
    plot.axisY({
      ticks: [0.25, 0.5, 0.75].map((f) => win.y[0] + f * (win.y[1] - win.y[0])),
      format: (v) => M.n2((v * 2) / M.S3),
      label: M.STRINGS.zoomY,
    });
  } else {
    ctx.save();
    ctx.font = noteFont(colors);
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("AA", plot.sx(0), plot.sy(0) + 7);
    ctx.fillText("aa", plot.sx(1), plot.sy(0) + 7);
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Aa", plot.sx(0.5), plot.sy(M.S3 / 2) - 7);
    ctx.restore();
  }
}

/* ---- the three genotypes as bars ----------------------------------------- */

/**
 * Six bands over [0, 6]: each genotype's observed count and then its
 * prediction, so the pair the reader is asked to compare is the pair that
 * touches (2.7).
 */
function drawBars(ctx, colors, L, params, state, anim) {
  const rect = L.bars;
  const arrival = state.one;
  const k = Math.min(anim?.k ?? 0, arrival.n);
  const counts = M.countsAt(arrival, k);
  const t = k > 0 ? M.hweTest(counts) : null;
  const exp = t ? t.exp : [0, 0, 0];
  const top = Math.max(1, ...counts, ...exp) * 1.15;
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, 6], yDomain: [0, top] });

  plot.caption(fit(ctx, M.STRINGS.barsCaption, capFont(colors), rect.w * 0.8));
  if (t) {
    /* DECISION 10: the reading past the threshold lives here, because a tile
       cannot carry a colour. */
    const past = t.P < state.cfg.alpha;
    plot.note(`χ² ${M.n2(t.chi)}`, { tone: past ? colors.extreme : colors.ink2 });
  }

  plot.bars([counts[0], 0, counts[1], 0, counts[2], 0], { lo: 0, width: 1, fill: colors.empirical });
  plot.bars([0, exp[0], 0, exp[1], 0, exp[2]], { lo: 0, width: 1, fill: colors.theory });

  /* What the last unit of the reveal added, on each bar it landed on. One
     individual is under a pixel at 323, so a band is at least 3px: it marks
     WHERE the arrivals landed, and the bar's own height is what counts them.
     Cleared once the sample is complete — a frozen cue reads as a marked bar
     rather than a recent arrival (4.3). */
  if (k > 0 && k < arrival.n) {
    const prev = M.countsAt(arrival, Math.max(0, k - state.cfg.batch));
    const band = rect.w / 6;
    const bw = Math.max(1, Math.min(24, band - 2));
    ctx.save();
    ctx.fillStyle = colors.highlight;
    for (let g = 0; g < 3; g += 1) {
      if (counts[g] <= prev[g]) continue;
      const bx = plot.sx(g * 2) + (band - bw) / 2;
      const yTop = plot.sy(counts[g]);
      const h = Math.max(3, plot.sy(prev[g]) - yTop);
      ctx.fillRect(bx, yTop, bw, h);
    }
    ctx.restore();
  }

  plot.axisX({ ticks: [1, 3, 5], format: (v) => ["AA", "Aa", "aa"][(v - 1) / 2] });
  plot.axisY({ label: M.STRINGS.barsAxis });
}

/* ---- the Many-SNPs page --------------------------------------------------- */

function drawHistogram(ctx, colors, L, params, state) {
  const rect = L.hist;
  const many = state.many;
  const line = M.fLine(state.cfg.crit, state.cfg.n);
  const H = M.fHistogram(many.F, line);
  const top = Math.max(1, ...H.inside, ...H.beyond) * 1.12;
  const plot = makePlot({ ctx, colors, rect, xDomain: [H.lo, H.hi], yDomain: [0, top] });

  plot.caption(`${M.intText(many.count)} SNPs, ${M.intText(state.cfg.n)} individuals each`);
  plot.note(`${M.intText(many.past)} past the threshold`,
    { tone: many.past ? colors.extreme : colors.ink2 });

  plot.bars(H.inside, { lo: H.lo, width: H.width, fill: colors.empirical });
  plot.bars(H.beyond, { lo: H.lo, width: H.width, fill: colors.extreme });

  plot.vline(0, { stroke: colors.theory, width: 1, label: M.STRINGS.noDeficit, align: "left", labelDy: 14 });
  /* DECISION 11: both sides of the test, the deficit side labelled. */
  if (-line > H.lo) plot.vline(-line, { stroke: colors.reference, width: 2 });
  if (line < H.hi) {
    plot.vline(line, {
      stroke: colors.reference,
      width: 2,
      label: M.thresholdOf(params.threshold).label,
      align: "right",
    });
  }
  plot.axisX({ label: M.STRINGS.histX });
  plot.axisY({ label: M.STRINGS.histY });
}

/* ---- the momentary action button (decision 6) ----------------------------- */

function clearWhole() {
  if (widgetApi && widgetApi.params.whole) widgetApi.setParam("whole", false);
}

/* ============================== the widget ================================= */

widgetApi = defineWidget({
  slug: "hardy-weinberg",
  title: "Hardy-Weinberg Equilibrium",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* one geometry function, for the height the page reserves and for every rect
     the figure draws in (5.8) */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* DECISION 2: the page is display, so the arrival survives a visit to the
       2,000 SNPs and back. */
    page: {
      type: "segmented",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "one",
      display: true,
    },

    sampleSec: { type: "section", label: M.STRINGS.sampleSection },
    /* Two short names share a row; the two long ones take a row each, which is
       the mock's rail C without a name reaching the edge of its face. */
    source: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.sourceLabel,
      detail: M.STRINGS.sourceDetail,
      options: M.SOURCES,
      default: "pooled",
    },
    /* On Many SNPs every SNP has its own frequency, drawn uniform on 0.1–0.9,
       so this control has nothing to set there and the page's caption says so. */
    p: {
      type: "float",
      label: M.STRINGS.pLabel,
      detail: M.STRINGS.pDetail,
      min: 0.05,
      max: 0.95,
      step: 0.01,
      default: 0.5,
      when: { param: "page", equals: "one" },
    },
    gap: {
      type: "float",
      label: M.STRINGS.gapLabel,
      detail: M.STRINGS.gapDetail,
      min: 0,
      max: 0.8,
      step: 0.01,
      default: 0.5,
      when: { param: "source", equals: "pooled" },
    },
    error: {
      type: "float",
      label: M.STRINGS.errorLabel,
      detail: M.STRINGS.errorDetail,
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.3,
      when: { param: "source", oneOf: ["heterozygotes", "homozygotes"] },
    },
    n: {
      type: "choice",
      label: M.STRINGS.nLabel,
      detail: M.STRINGS.nDetail,
      options: M.N_OPTIONS,
      default: "323",
    },

    testSec: { type: "section", label: M.STRINGS.testSection },
    /* DECISION 4: the threshold changes no sample. */
    threshold: {
      type: "segmented",
      label: M.STRINGS.thresholdLabel,
      detail: M.STRINGS.thresholdDetail,
      options: M.THRESHOLDS,
      default: "1e-6",
      display: true,
    },

    figureSec: {
      type: "section",
      label: M.STRINGS.figureSection,
      when: { param: "page", equals: "one" },
    },
    view: {
      type: "segmented",
      label: M.STRINGS.viewLabel,
      detail: M.STRINGS.viewDetail,
      options: M.VIEWS,
      default: "whole",
      display: true,
      when: { param: "page", equals: "one" },
    },

    /* DECISION 6: momentary, and it clears itself. */
    whole: {
      type: "bool",
      style: "action",
      label: M.STRINGS.wholeLabel,
      detail: M.STRINGS.wholeDetail,
      default: false,
      display: true,
      afterDrive: true,
      when: { param: "page", equals: "one" },
    },
    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      detail: M.STRINGS.seedDetail,
      min: 1,
      max: 200,
      default: 1,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: individuals already genotyped. */
    shown: { type: "int", min: 0, max: 50000, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "many"
    ? [
      { token: "empirical", label: "Number of SNPs at each deficit", mark: "bar" },
      { token: "extreme", label: "SNPs past the threshold", mark: "bar" },
      { token: "reference", label: "The threshold, at F = √(χ² critical / n)", mark: "line" },
      { token: "theory", label: "No deficit", mark: "line" },
    ]
    : [
      { token: "empirical", label: "The observed sample", mark: "dot" },
      { token: "theory", label: "The Hardy-Weinberg prediction at the sample's allele frequency", mark: "dot" },
      { token: "theory", label: "The Hardy-Weinberg curve", mark: "line" },
      { token: "empirical", label: "The path of the observed sample as individuals were added", mark: "line" },
      { token: "highlight", label: "The individuals added in the last step", mark: "bar" },
      ...(params.source === "pooled"
        ? [
          { token: "group-a", label: "Population 1", mark: "dot" },
          { token: "group-b", label: "Population 2", mark: "dot" },
          { token: "ink-3", label: "The line between the two populations", mark: "line" },
        ]
        : []),
    ]),

  /* DECISION 2: both pages, one seeded stream, in a fixed order. */
  compute({ params, rng }) {
    const cfg = M.configFor(params);
    const one = M.buildArrival(rng, cfg);
    const many = M.buildMany(rng, cfg);
    return { cfg, one, many };
  },

  animation: {
    /* DECISION 7: a unit is a different number of individuals at each sample
       size, so the label names the number and the title names the noun (3.4c). */
    stepLabel: { param: "n", labels: M.STEP_LABELS, default: M.STEP_LABELS["323"] },
    stepTitle: { param: "n", labels: M.STEP_TITLES, default: M.STEP_TITLES["323"] },
    runTitle: M.STRINGS.runTitle,

    init: ({ params, state, fromScratch }) => {
      /* An authored head start applies on the first render only — `?shown=200`
         for a lesson link, and `?whole=1` for the finished sample. */
      const authored = params.whole ? state.cfg.n : Math.max(0, params.shown ?? 0);
      const k = fromScratch ? 0 : Math.min(state.cfg.n, authored);
      return {
        k,
        beat: 0,
        /* true once a step or a run has moved the point; an authored head
           start has not, so it draws no path */
        walked: false,
        done: k >= state.cfg.n,
        /* DECISION 2: the Many-SNPs page lands finished, so there is nothing
           to step or play and core takes both buttons out of the row (4.5). */
        inert: params.page === "many",
      };
    },

    advance: (anim, { dt, params, state }) => {
      const end = state.cfg.n;
      if (anim.k >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.UNIT_MS;
      if (anim.beat < 1) return true;
      const units = anim.mode === "step" ? 1 : Math.floor(anim.beat);
      anim.beat = anim.mode === "step" ? 0 : anim.beat - units;
      anim.k = Math.min(end, anim.k + units * state.cfg.batch);
      anim.walked = true;
      if (anim.k >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    rebuild: (anim, { params, state }) => {
      if (params.whole) {
        anim.k = state.cfg.n;
        anim.beat = 0;
        anim.walked = false;
        clearWhole();
      }
      anim.k = Math.min(anim.k, state.cfg.n);
      anim.inert = params.page === "many";
      anim.done = anim.k >= state.cfg.n;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = M.layout(w, params);
    if (L.page === "many") {
      drawHistogram(ctx, colors, L, params, state);
      return;
    }
    drawTriangle(ctx, colors, L, params, state, anim);
    drawBars(ctx, colors, L, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.page === "many") {
      const many = state.many;
      return [
        {
          label: "SNPs past the threshold",
          value: M.intText(many.past),
          note: `of ${M.intText(many.count)}`,
        },
        {
          label: "Mean deficit",
          value: M.n3(many.meanF),
          note: "F = 1 − observed heterozygotes / expected",
        },
        {
          label: "Fewer heterozygotes",
          value: M.pctText(many.deficits / many.count),
          note: "share of SNPs with fewer heterozygotes than expected",
        },
      ];
    }
    /* The tiles are blank until the first individual lands, and during the
       arrival they read the partial table (2.4, 2.8). */
    const k = Math.min(anim?.k ?? 0, state.one.n);
    const counts = M.countsAt(state.one, k);
    const t = k > 0 ? M.hweTest(counts) : null;
    const label = M.thresholdOf(params.threshold).label;
    return [
      { label: "Allele frequency", value: t ? M.n2(t.p) : "—", note: "of A in the sample" },
      {
        label: "Heterozygotes",
        value: t ? `${M.intText(counts[1])} / ${expText(t.exp[1])}` : "—",
        note: "observed / expected",
      },
      { label: "χ²", value: t ? M.n2(t.chi) : "—", note: "1 degree of freedom" },
      { label: "P", value: t ? M.pfmt(t.P) : "—", note: `threshold ${label}` },
    ];
  },

  summary({ params, state, anim }) {
    const src = M.sourceOf(params.source);
    if (params.page === "many") {
      const many = state.many;
      return `A histogram of the heterozygote deficit F over ${M.intText(many.count)} SNPs, `
        + `${src.caption}, at ${M.intText(state.cfg.n)} individuals each. The mean deficit is `
        + `${M.n3(many.meanF)}, ${M.pctText(many.deficits / many.count)} of the SNPs have fewer `
        + `heterozygotes than expected, and ${M.intText(many.past)} are past the `
        + `${M.thresholdOf(params.threshold).label} threshold.`;
    }
    const k = Math.min(anim?.k ?? 0, state.one.n);
    const counts = M.countsAt(state.one, k);
    if (k === 0) {
      return `An empty de Finetti triangle with the Hardy-Weinberg curve across it, and empty `
        + `genotype bars beside it, before any of the ${M.intText(state.one.n)} individuals is added, ${src.caption}.`;
    }
    const t = M.hweTest(counts);
    return `A de Finetti triangle with the Hardy-Weinberg curve across it. `
      + `${M.intText(k)} of ${M.intText(state.one.n)} individuals, ${src.caption}: `
      + `${M.intText(counts[0])} AA, ${M.intText(counts[1])} Aa and ${M.intText(counts[2])} aa, `
      + `against ${expText(t.exp[1])} heterozygotes predicted at an allele frequency of `
      + `${M.n2(t.p)}. χ² is ${M.n2(t.chi)} on 1 degree of freedom and P is ${M.pfmt(t.P)}; `
      + `the threshold is ${M.thresholdOf(params.threshold).label}.`;
  },
});
