/* ============================================================================
   Widget 57 · Genome-wide association studies — the skyline, the QQ plot, the
   structure underneath them both.

   PHM5003 week 6 (01-3 the scan, 01-4 the PCA, 01-5 the GRM and fastGWA, 01-6
   the Manhattan and QQ plots). `model.js` carries the cohort, the three scans,
   the variance step, the geometry and the copy; this file draws them.

   The one claim: a test of every SNP on a structured sample finds the
   structure at every SNP, and the mixed model is how the structure is taken
   out — principal components for ancestry, the relationship matrix for
   relatedness — before a skyline means anything.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD. `_lab/gwas-mock.html` drew nine
       sections and Kenneth picked eight (catalogue § Slot 57, 2026-09-12):
       title B and subtitle A; the Manhattan plot with the QQ plot beside it
       and one y axis; the no-trait-difference panel reached through the Trait
       difference control rather than drawn beside the stage; a Cohort page
       with the scatter and the relationship matrix as an image; the four
       variance tiles and the fallback line in our own words; Families with a
       Family effect slider defaulting to 1; ten SNPs a frame with Step as one
       SNP; and rail A, every field.

    2. TWO PAGES, ONE RAIL, AND `page` IS A DISPLAY PARAMETER. Visiting the
       cohort and coming back must not throw away the tests the reader has
       walked through (3.2, non-negotiable 3). The Cohort page has nothing to
       drive, so `anim.inert` takes Step and Play out of the row there (4.5).

    3. THE MODEL AND THE PC COUNT ARE DISPLAY PARAMETERS TOO. They change which
       test each SNP gets, not which cohort exists, and the reader's own
       position in the run is what makes the comparison: stop at 800 SNPs under
       SNP only, switch to + PCs, and the same 800 tests come back under the
       other covariates. Core recomputes on a display change and keeps `anim`,
       so `compute` builds the one scan the Model control names rather than all
       three, and the run's position survives the switch.

    4. THE FULL EIGENDECOMPOSITION IS SKIPPED WHERE NO TEST READS IT. Measured
       at n = 300: 67 ms under SNP only, 140 under + PCs, 230 under + PCs + GRM.
       The Cohort page's scatter always comes from subspace iteration, which is
       a deterministic function of the relationship matrix — one source, so a
       control that changes no genotype cannot mirror the picture — and every
       covariate column comes from the full decomposition, so the three models'
       λ are comparable to the last decimal. `model.js` has the measurement.

    5. THE TWO STEPS, AS THE RUN'S OWN SHAPE. Play's first frame is the
       variance step: the tiles fill and no SNP is tested, which is the only
       frame in the run where the expensive part is visibly done once. Step
       lands a SNP on every press, because a control's label names what THIS
       press will do (4.4b) and the button says Next SNP.

    6. THE TRUTH ARRIVES WITH THE TEST. The three causal positions are drawn
       as outline marks only for SNPs the run has reached. Drawn
       unconditionally they print the answer before the first press (2.1) and
       print what the visible data cannot support (2.11).

    7. THE TESTED SNP IS A CURSOR, NOT A READING. A full-height rule in
       --c-highlight on an axis that runs to 19 is the tallest mark on the
       figure — it reads as a test that came back at −log₁₀P 19, at a SNP whose
       own value is about 1. So: the SNP's own point drawn large at its own
       height, and a short tick under the baseline saying which column it is
       in.

    8. THE THRESHOLD LINE CARRIES NO LABEL. Measured in the mock: at SNP only
       every candidate box for a label on the line holds a drawn point, at
       300px and at 496px alike — 96 SNPs above the line and 2,000 below it.
       The panel's own note names the threshold instead, on the caption row,
       which is the one row nothing is ever drawn on.

    9. THE VARIANCE STEP'S LINE IS A RESERVED FOOTER ROW. It is 20px reserved
       whenever the model with a variance step is chosen, in both of that
       model's states (3.4k), so the figure does not move when an estimate
       crosses its own threshold. The line has to read as something that
       happened at THIS cohort: at the default and seed 1 the step finds
       genetic variance and does not fall back, and seed 4 at the same settings
       does.

   10. THE RELATIONSHIP MATRIX IS AN IMAGE, AND ITS BUFFER IS MADE ON DEMAND.
       300 × 300 is 90,000 cells; one pixel each in an off-screen canvas drawn
       up with smoothing off keeps the block structure, where interpolation
       would blur the one thing the panel is for. The buffer is created at the
       first draw rather than at import, so the figure's text can be swept with
       no DOM (5.6: a check is scoped to a medium).

   11. n = 300 AND m = 2000 ARE FIXED. The measured ceiling: a compute at
       n = 600 is 1133 ms against 230.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

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

/** A caption on its own row, haloed so a mark behind it stays readable. */
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

/* ---- the Manhattan plot --------------------------------------------------- */

const chrOf = (j) => Math.floor(j / M.PER_CHR);
const CHR_TICKS = Array.from({ length: M.NCHR }, (_, c) => (c + 0.5) * M.PER_CHR);

/**
 * The skyline of the tests run so far. `upTo` is how many SNPs have been
 * tested, which is the only thing the run changes.
 */
function drawManhattan(ctx, colors, rect, params, state, upTo, testing) {
  const lp = state.lp;
  const top = M.AXIS_TOP;
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, M.M_SNPS], yDomain: [0, top] });

  /* THE CAPTION IS THE ELASTIC ONE, and that is the whole reason the count is
     fitted against the note's own width. `plot.note` drops its line INSIDE the
     plot area when the caption leaves it no room on the caption row, and
     inside this panel's top right is where a causal SNP's mark sits — the note
     strokes the ground before it fills, so a collision would erase the mark
     and leave a line that still looks correct. Measured at the narrowest
     canvas the pair fits with room to spare; the fit is what keeps it true for
     a longer model name or a five-figure count. */
  const name = M.modelCaption(params);
  const caption = upTo === 0
    ? `${name} — ${M.STRINGS.noTest}`
    : upTo >= M.M_SNPS
      ? `${name} — all ${M.intText(M.M_SNPS)} tested`
      : `${name} — ${M.intText(upTo)} of ${M.intText(M.M_SNPS)}`;
  const noteText = upTo > 0
    ? `${M.intText(M.reading(state, upTo).hits)} past ${M.THR_TEXT}`
    : null;
  const noteW = noteText ? widthOf(ctx, noteText, noteFont(colors)) : 0;
  plot.caption(fit(ctx, caption, capFont(colors),
    noteText ? rect.w - noteW - 14 : rect.w + 22));
  if (noteText) plot.note(noteText);

  /* the threshold first, so the points sit over it (decision 8) */
  const ty = Math.round(plot.sy(M.THR_L)) + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(rect.x, ty);
  ctx.lineTo(rect.x + rect.w, ty);
  ctx.stroke();
  ctx.restore();

  /* The points. Two passes of --c-empirical — which chromosome the SNP is on
     decides the weight — then the ones past the line, drawn last in
     --c-extreme so nothing covers them. */
  const past = [];
  const r = 1.6;
  ctx.save();
  for (const band of [0, 1]) {
    ctx.globalAlpha = band ? 0.42 : 0.95;
    ctx.fillStyle = colors.empirical;
    ctx.beginPath();
    for (let j = 0; j < upTo; j += 1) {
      if (chrOf(j) % 2 !== band) continue;
      const y = plot.sy(Math.min(lp[j], top));
      const x = plot.sx(j);
      if (lp[j] >= M.THR_L) {
        past.push([x, y]);
        continue;
      }
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.extreme;
  ctx.beginPath();
  for (const [x, y] of past) {
    ctx.moveTo(x + r + 0.4, y);
    ctx.arc(x, y, r + 0.4, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  /* DECISION 6: where the three causal SNPs actually are, as outline marks
     inside the top edge, pointing down at the column each one is in. Outline
     rather than filled, because the answer is a reference and not one of the
     tests — and never ahead of the test that reaches it. */
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  for (const j of M.CAUSAL) {
    if (j >= upTo) continue;
    const x = plot.sx(j);
    ctx.beginPath();
    ctx.moveTo(x - 4, rect.y + 2);
    ctx.lineTo(x + 4, rect.y + 2);
    ctx.lineTo(x, rect.y + 8);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  plot.axisX({
    ticks: CHR_TICKS,
    format: (v) => String(Math.round(v / M.PER_CHR - 0.5) + 1),
    label: M.STRINGS.manX,
  });
  plot.axisY({ label: M.STRINGS.manY });

  /* DECISION 7: the cursor, drawn after the axes because the chromosome tick
     row starts 6px under the baseline and would otherwise be painted over the
     tick. */
  if (testing != null && testing >= 0 && testing < M.M_SNPS) {
    const x = Math.round(plot.sx(testing)) + 0.5;
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h + 1);
    ctx.lineTo(x, rect.y + rect.h + 9);
    ctx.stroke();
    ctx.restore();
    /* The point only once the test has landed: ahead of `upTo` the SNP has no
       −log₁₀P yet, and drawing one would print a value the run has not
       computed (2.11). */
    if (testing < upTo) {
      plot.dot(testing, Math.min(lp[testing], top), { fill: colors.highlight, r: 4 });
    }
  }
}

/* ---- the QQ plot ---------------------------------------------------------- */

/**
 * Observed against expected −log₁₀P, from the tests run so far.
 *
 * No y-axis label: `axisY`'s rotated label is drawn 40px left of the plot
 * area, which on a QQ plot at x = 376 is x = 336 — inside the Manhattan plot,
 * which ends at 346. Measured. The panel names its y quantity in the caption
 * instead.
 */
function drawQQ(ctx, colors, rect, state, upTo) {
  const hi = M.QQ_TOP;
  const read = M.reading(state, upTo);
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, hi], yDomain: [0, hi] });

  const capText = fit(ctx, M.STRINGS.qqCaption, capFont(colors), rect.w);
  plot.caption(capText);
  const noteText = upTo > 0
    ? fit(ctx, `λ ${M.n2(read.lambda)}`, noteFont(colors), rect.w * 0.6)
    : null;
  if (noteText) plot.note(noteText);

  /* the null: where the points lie when no SNP is associated and nothing is
     confounding the tests */
  plot.curve([[0, 0], [hi, hi]], { stroke: colors.theory, width: 1.5 });

  const r = 1.3;
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.beginPath();
  for (const [ex, ob] of read.points) {
    if (ob > hi) continue;
    const x = plot.sx(ex);
    const y = plot.sy(ob);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  /* The count past the ceiling, inside the panel's top right — the corner the
     identity line reaches only at its very end and no point occupies, because
     the expected −log₁₀P of 2,000 tests stops at 3.6 of the ceiling's 6.
     `plot.note` drops its own line into that corner when the caption leaves it
     no room on the caption row, so the same condition is restated here and
     this line goes under it. */
  if (read.above > 0) {
    const capW = widthOf(ctx, capText, capFont(colors));
    const dropped = noteText
      && rect.w - widthOf(ctx, noteText, noteFont(colors)) < capW + 14;
    noteAt(ctx, colors, rect.x + rect.w - 3, rect.y + (dropped ? 29 : 14),
      `${M.intText(read.above)} above`, rect.w * 0.5, colors.ink3);
  }

  plot.axisX({ label: M.STRINGS.qqX });
  plot.axisY({});
}

/* ---- the Cohort page ------------------------------------------------------ */

function drawScatter(ctx, colors, rect, state) {
  const a = state.view.vectors[0];
  const b = state.view.vectors[1];
  const padded = (v) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < v.length; i += 1) {
      if (v[i] < lo) lo = v[i];
      if (v[i] > hi) hi = v[i];
    }
    const m = (hi - lo) * 0.08;
    return [lo - m, hi + m];
  };
  const plot = makePlot({ ctx, colors, rect, xDomain: padded(a), yDomain: padded(b) });
  plot.caption(fit(ctx, M.STRINGS.scatterCaption, capFont(colors), rect.w + 20));
  /* NO EIGENVALUE NOTE ON THIS PANEL, and that is a measurement. The caption
     takes about 200px of a 224px panel at the narrowest canvas, so `plot.note`
     drops its line inside the plot area — over the points, which is the one
     thing this panel is. The three eigenvalues are a tile beside the figure
     instead, where the reading is the same and nothing is drawn under it. */
  const pop = state.co.pop;
  for (let i = 0; i < pop.length; i += 1) {
    plot.dot(a[i], b[i], { fill: colors.clusters[pop[i]], r: 2.6 });
  }
  /* No tick values: an eigenvector's entries are on no scale the reader has,
     and the reading is which points sit together. */
  plot.axisX({ ticks: [], label: M.STRINGS.scatterX });
  plot.axisY({ ticks: [], label: M.STRINGS.scatterY });
}

/* DECISION 10: one cell one pixel, off screen, then drawn up with smoothing
   off. The buffer is made at the first draw and kept. */
let grmBuf = null;
function grmBuffer() {
  if (grmBuf) return grmBuf;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  grmBuf = cv.getContext("2d", { willReadFrequently: true });
  return grmBuf;
}

function rgbOf(c) {
  const s = String(c).trim();
  if (s.startsWith("#")) {
    const h = s.length === 4 ? s.slice(1).split("").map((x) => x + x).join("") : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = s.match(/-?\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}
function drawGRM(ctx, colors, rect, params, state) {
  const K = state.K;
  const n = K.length;
  capAt(ctx, colors, rect.x, rect.y - 10, M.STRINGS.grmCaption, rect.w + 30);
  noteAt(ctx, colors, rect.x + rect.w, rect.y - 10,
    M.familiesOf(params.families).caption, rect.w * 0.55);

  const buf = grmBuffer();
  if (buf) {
    buf.canvas.width = n;
    buf.canvas.height = n;
    const img = buf.createImageData(n, n);
    const lo = rgbOf(colors.valueLow);
    const hi = rgbOf(colors.valueHigh);
    const base = rgbOf(colors.surface);
    /* 90,000 cells a repaint, so the mix is written out rather than mapped
       over three-element arrays: the same arithmetic, and no allocation. */
    for (let i = 0; i < n; i += 1) {
      const row = K[i];
      for (let j = 0; j < n; j += 1) {
        const v = Math.max(-1, Math.min(1, row[j] / M.GRM_CAP));
        const end = v >= 0 ? hi : lo;
        const t = Math.abs(v);
        const o = (i * n + j) * 4;
        img.data[o] = Math.round(base[0] + (end[0] - base[0]) * t);
        img.data[o + 1] = Math.round(base[1] + (end[1] - base[1]) * t);
        img.data[o + 2] = Math.round(base[2] + (end[2] - base[2]) * t);
        img.data[o + 3] = 255;
      }
    }
    buf.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.canvas, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.font = noteFont(colors);
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(M.STRINGS.grmAxis, rect.x + rect.w / 2, rect.y + rect.h + 6);
  ctx.restore();
}

/* ============================== the widget ================================= */

defineWidget({
  slug: "gwas",
  title: "Genome-Wide Association Studies",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* one geometry function, for the height the page reserves and for every rect
     the figure draws in (5.8) */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* DECISION 2: the page is display, so the tests survive a visit to the
       cohort and back. */
    page: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "association",
      display: true,
    },

    cohortSec: { type: "section", label: M.STRINGS.cohortSection },
    ancestry: {
      type: "segmented",
      label: M.STRINGS.ancestryLabel,
      detail: M.STRINGS.ancestryDetail,
      options: M.ANCESTRY,
      default: "strong",
    },
    shift: {
      type: "segmented",
      label: M.STRINGS.shiftLabel,
      detail: M.STRINGS.shiftDetail,
      options: M.SHIFTS,
      default: "1",
    },
    effect: {
      type: "segmented",
      label: M.STRINGS.effectLabel,
      detail: M.STRINGS.effectDetail,
      options: M.EFFECTS,
      default: "0.12",
    },
    families: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.familiesLabel,
      detail: M.STRINGS.familiesDetail,
      options: M.FAMILIES,
      default: "none",
    },
    /* 3.4b applied to a field: at Families = none there is no slider for an
       effect nothing on screen has. */
    familyEffect: {
      type: "float",
      label: M.STRINGS.familyEffectLabel,
      detail: M.STRINGS.familyEffectDetail,
      min: 0,
      max: 1,
      step: 0.1,
      default: 1,
      when: { param: "families", equals: "sibships" },
    },

    testSec: { type: "section", label: M.STRINGS.testSection },
    /* DECISION 3. The default is SNP only, so the first run is the forest of
       false peaks and the reader adds the covariates that clear it (2.1). */
    model: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.modelLabel,
      detail: M.STRINGS.modelDetail,
      options: M.MODELS.map((m) => ({ ...m, span: true })),
      default: "snp",
      display: true,
    },
    npcs: {
      type: "segmented",
      label: M.STRINGS.npcsLabel,
      detail: M.STRINGS.npcsDetail,
      options: M.NPCS,
      default: "5",
      display: true,
      when: { param: "model", oneOf: ["pcs", "grm"] },
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

    /* Authoring escape hatch, first render only: SNPs already tested. */
    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "cohort"
    ? [
      { token: "cluster-a", label: "Subpopulation 1", mark: "dot" },
      { token: "cluster-b", label: "Subpopulation 2", mark: "dot" },
      { token: "cluster-c", label: "Subpopulation 3", mark: "dot" },
      { token: "value-low", label: "Less related than the sample average" },
      { token: "value-high", label: "More related than the sample average" },
    ]
    : [
      { token: "empirical", label: "A SNP's test, shaded by chromosome", mark: "dot" },
      { token: "extreme", label: "Past the corrected threshold", mark: "dot" },
      { token: "reference", label: "The corrected threshold", mark: "dash" },
      { token: "reference", label: "A causal SNP's position", mark: "tri" },
      { token: "theory", label: "Expected with no association", mark: "line" },
      { token: "highlight", label: "The SNP being tested", mark: "dot" },
    ]),

  /* DECISION 3: one cohort, and the one scan the Model control names. */
  compute({ params, rng }) {
    return M.build(rng, M.configFor(params));
  },

  animation: {
    stepLabel: M.STRINGS.stepLabel,
    stepTitle: M.STRINGS.stepTitle,
    runTitle: M.STRINGS.runTitle,

    init: ({ params, state, fromScratch }) => {
      /* An authored head start applies on the first render only —
         `?shown=800` for a lesson link. */
      const authored = Math.max(0, params.shown ?? 0);
      const k = fromScratch ? 0 : Math.min(M.M_SNPS, authored);
      return {
        k,
        beat: 0,
        /* DECISION 5: the variance step, once, before any SNP is tested. */
        varDone: k > 0,
        done: k >= M.M_SNPS,
        inert: params.page === "cohort",
      };
    },

    advance: (anim, { dt }) => {
      if (!anim.varDone) {
        anim.varDone = true;
        /* Play spends its first frame here and tests nothing; Step goes on to
           land the SNP its label promises. */
        if (anim.mode === "run") return true;
      }
      if (anim.k >= M.M_SNPS) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.UNIT_MS;
      if (anim.beat < 1) return true;
      if (anim.mode === "step") {
        anim.beat = 0;
        anim.k = Math.min(M.M_SNPS, anim.k + 1);
      } else {
        const units = Math.floor(anim.beat);
        anim.beat -= units;
        anim.k = Math.min(M.M_SNPS, anim.k + units * M.PER_UNIT);
      }
      if (anim.k >= M.M_SNPS) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    rebuild: (anim, { params }) => {
      anim.inert = params.page === "cohort";
      anim.done = anim.k >= M.M_SNPS;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = M.layout(w, params);
    if (L.page === "cohort") {
      drawScatter(ctx, colors, L.scatter, state);
      drawGRM(ctx, colors, L.grm, params, state);
      return;
    }
    const upTo = Math.min(anim?.k ?? 0, M.M_SNPS);
    const testing = upTo > 0 && upTo < M.M_SNPS ? upTo - 1 : null;
    drawManhattan(ctx, colors, L.man, params, state, upTo, testing);
    drawQQ(ctx, colors, L.qq, state, upTo);
    /* DECISION 9: what the variance step decided, under the figure it decided
       about, in both of its states. */
    if (L.foot.on && anim?.varDone) {
      ctx.save();
      ctx.font = noteFont(colors);
      ctx.fillStyle = colors.ink2;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(
        fit(ctx, state.fellBack ? M.STRINGS.fellBack : M.STRINGS.usedGrm,
          noteFont(colors), L.foot.w),
        L.foot.x, L.foot.y,
      );
      ctx.restore();
    }
  },

  readout({ params, state, anim }) {
    if (params.page === "cohort") {
      const r = M.grmRange(state.K);
      const sizes = [0, 1, 2].map((k) => [...state.co.pop].filter((p) => p === k).length);
      return [
        {
          label: "Subpopulations",
          value: sizes.join(" · "),
          note: "people in each of the three",
        },
        {
          label: "Top eigenvalues",
          value: state.view.values.map((v) => v.toFixed(1)).join(" · "),
          note: "of the relationship matrix",
        },
        {
          label: "Strongest pair",
          value: M.n2(r.hi),
          note: "the largest relatedness between two people",
        },
        {
          label: "Sibships",
          value: state.co.nFam ? M.intText(state.co.nFam) : "None",
          note: "groups of four who share both parents",
        },
      ];
    }
    const upTo = Math.min(anim?.k ?? 0, M.M_SNPS);
    const read = M.reading(state, upTo);
    /* The tiles are blank until the first test lands, and during the run they
       read the tests so far (2.4, 2.8). */
    const tiles = [
      {
        label: "λ",
        value: upTo > 0 ? M.n2(read.lambda) : "—",
        note: "genomic inflation, median χ² / 0.455",
      },
      {
        label: "Past the threshold",
        value: upTo > 0 ? M.intText(read.hits) : "—",
        note: `of ${M.intText(M.M_SNPS)}, at ${M.THR_TEXT}`,
      },
      {
        label: "Causal SNPs found",
        value: upTo > 0 ? M.intText(read.found) : "—",
        note: `of ${M.CAUSAL.length}`,
      },
    ];
    /* DECISION 5: the variance step's own numbers, on their own row, and they
       are filled by the first frame of the run rather than by the first test.
       A break rather than a fourth column: seven tiles in one row wrap at the
       stage's own width. */
    if (state.reml) {
      const re = state.reml;
      const on = Boolean(anim?.varDone);
      tiles.push({ break: true });
      tiles.push({
        label: "Genetic variance",
        value: on ? M.n3(re.Vg) : "—",
        note: "Vg, shared in proportion to relatedness",
      });
      tiles.push({
        label: "Residual variance",
        value: on ? M.n3(re.Ve) : "—",
        note: "Ve, independent between people",
      });
      tiles.push({
        label: "Heritability",
        value: on ? M.n2(re.h2) : "—",
        note: "Vg / (Vg + Ve)",
      });
      tiles.push({
        label: "P for Vg = 0",
        value: on ? M.pfmt(re.P) : "—",
        note: "likelihood ratio test, halved at the boundary",
      });
    }
    return tiles;
  },

  summary({ params, state, anim }) {
    if (params.page === "cohort") {
      const r = M.grmRange(state.K);
      return `The first two principal components of ${M.intText(M.N)} people in three `
        + `subpopulations, beside their relationship matrix as a ${M.intText(M.N)} × `
        + `${M.intText(M.N)} image, one pixel a pair. The relatedness between two people runs `
        + `from ${M.n3(r.lo)} to ${M.n3(r.hi)}`
        + `${state.co.nFam ? `, and ${M.intText(state.co.nFam)} sibships of four sit on the diagonal` : ""}.`;
    }
    const upTo = Math.min(anim?.k ?? 0, M.M_SNPS);
    const name = M.modelCaption(params);
    if (upTo === 0) {
      return `An empty Manhattan plot with the corrected threshold across it, and an empty QQ `
        + `plot beside it, before any of the ${M.intText(M.M_SNPS)} SNPs is tested under ${name}.`;
    }
    const read = M.reading(state, upTo);
    return `A Manhattan plot of ${M.intText(upTo)} of ${M.intText(M.M_SNPS)} SNPs tested under `
      + `${name}, with the QQ plot of the same tests beside it. ${M.intText(read.hits)} are past `
      + `${M.THR_TEXT}, ${M.intText(read.found)} of the ${M.CAUSAL.length} causal SNPs among them, `
      + `and λ is ${M.n2(read.lambda)}.`;
  },
});
