/* ============================================================================
   Widget 59 · Polygenic scores — the region, the sum, the threshold, the
   quantile plot.

   PHM5003 week 6 (02-1, 02-2), carrying slot 58's LD-and-clumping material as
   page 1. `model.js` holds the engine, the geometry and the copy; this file
   draws them.

   The one claim: a score is a weighted count of effect alleles, its weights
   come from another study, and how well it predicts is a number that has to be
   read on people it was not chosen on.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD. `_lab/prs-mock.html` drew eight
       sections and Kenneth picked from all of them (catalogue § Slot 59,
       2026-09-12): the association plot over the r² triangle clipped to the
       250 kb clumping window; the three strips over the target sample's score
       distribution at P < 0.01, with the weights on `--c-group-b`; the two R²
       curves with the best-fit threshold marked and the kept count on a second
       axis; one vigintile panel under a Target population control; a run on
       every page; the P threshold as a slider over the lesson's eleven values;
       and subtitle C. His two nomenclature rulings came with them: no "tune"
       and no "holdout" in anything a reader sees.

    2. FOUR PAGES, ONE RAIL, AND `page` IS A DISPLAY PARAMETER. The run is per
       page (`model.js` decision 4), so leaving a page and coming back keeps
       what was built on both of them (non-negotiable 3).

    3. THE P THRESHOLD AND THE PERSON ARE DISPLAY PARAMETERS TOO. The threshold
       chooses among eleven readings of one base study, all of them computed
       (`model.js` decision 3), and the person chooses which row of the target
       sample the sum is drawn for. Neither draws a new cohort, so neither
       throws the reader's work away — and the run on page 2 is a position in
       the list of kept SNPs rather than in one person's arithmetic, so moving
       the Person slider mid-run redraws the same SNPs for somebody else.

    4. NOTHING IS DRAWN BEFORE THE RUN REACHES IT (non-negotiable 4). Each page
       opens on its axes and its reference lines — the P = 0.05 line, the
       sample's mean trait — and everything else arrives: the tests and then the
       clumps, the SNPs of the sum, the thresholds, the vigintiles. The mock
       drew page 2's unreached columns faded; they are not drawn at all here,
       because a genotype is data.

    5. THE CAUSAL SNP'S POSITION ARRIVES WITH THE CLUMP THAT ACCOUNTS FOR IT.
       It is the answer to page 1's question, so it is a reference mark and not
       one of the tests, and it is not on screen before the clumping reaches it
       (2.1). `model.js` computes which beat that is.

    6. THE BEST-FIT MARK IS THE LARGEST AMONG THE THRESHOLDS SWEPT, and it
       needs two of them before it means anything. Printing the finished
       maximum from the first frame would be the figure claiming what the
       drawn data cannot support (2.11).

    7. THE STANDARDISED SCORE AND THE PERCENTILE WAIT FOR THE LAST SNP. A
       partial sum has no standing in a distribution of finished scores, so the
       two tiles that place the person read "—" until the sum is complete —
       which is also when the person's line joins the distribution.

    8. THE R² TRIANGLE IS AN IMAGE, AND ITS BUFFER IS MADE ON DEMAND. One cell
       one pixel in an off-screen canvas, drawn up through a 45° rotation with
       smoothing off: interpolating 4,950 cells into 490px would blur exactly
       the block structure the panel is for. The buffer is created at the first
       draw rather than at import, so the figure's text can be swept with no
       DOM (5.6: a check is scoped to a medium).

    9. THE DEFAULT SEED IS 29, and it is chosen the way widget 33's was. It
       opens page 1 on the region the mock drew — 27 SNPs under P < 0.05, eight
       clumps, and a lead SNP 15 kb from the causal one at r² 0.83 — which is
       the case the page exists to show, and it opens page 3 on a curve with an
       interior maximum at 0.05 whose R² is 0.087 in the target sample against
       0.064 in the validation sample. Over 50 seeds the lead is the causal SNP
       56% of the time, so the widget promises neither: every readout is
       computed from the region drawn, and the Seed slider is one press away.
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

/**
 * A short note, with the edge it hangs from and its baseline named.
 *
 * `plot.note` is the right-aligned, caption-baseline case and most panels here
 * use it. Page 3 needs the identical mark on the other edge: its caption fills
 * the caption row, and its top right corner belongs to the kept count and the
 * second axis's tick labels, so its panel note hangs from the top left.
 */
function noteAt(ctx, colors, x, y, text, maxW, { align = "right", baseline = "alphabetic", tone } = {}) {
  const s = fit(ctx, text, noteFont(colors), maxW);
  ctx.save();
  ctx.font = noteFont(colors);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = tone ?? colors.ink2;
  ctx.fillText(s, x, y);
  ctx.restore();
  return widthOf(ctx, s, noteFont(colors));
}

/** A tick-sized label, for the line it names. */
function tinyAt(ctx, colors, x, y, text, align = "left", tone) {
  ctx.save();
  ctx.font = noteFont(colors);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = tone ?? colors.ink3;
  ctx.fillText(text, x, y);
  ctx.restore();
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

/* ---- page 1: the association plot and the r² triangle -------------------- */

/**
 * The region's tests, and what clumping has done to them so far.
 *
 * `shown` is how many clumps have been taken; `scanDone` is whether the tests
 * are on screen at all, which is the first beat of the run (model.js
 * decision 5).
 */
function drawAssoc(ctx, colors, rect, region, { shown, scanDone, finished }) {
  const plot = makePlot({
    ctx, colors, rect, xDomain: [0, region.span], yDomain: [0, region.top],
  });

  const placed = Math.min(shown, region.clumps.length);
  let sigPlaced = 0;
  for (let c = 0; c < placed; c += 1) {
    if (region.clumps[c].p < M.REGION_ALPHA) sigPlaced += 1;
  }
  const caption = placed === 0 ? M.STRINGS.assocCaption : M.STRINGS.assocCaptionClumped;
  const note = !scanDone
    ? null
    : placed === 0
      ? `${region.hits} of ${M.REGION.m} SNPs under P < 0.05`
      : `${sigPlaced} ${sigPlaced === 1 ? "clump" : "clumps"} under P < 0.05`;
  const noteW = note ? widthOf(ctx, note, noteFont(colors)) : 0;
  plot.caption(fit(ctx, caption, capFont(colors), note ? rect.w - noteW - 14 : rect.w + 22));
  if (note) plot.note(note);

  /* the P = 0.05 line first, so the points sit over it; it is a reference and
     is on screen before anything is tested */
  const ty = Math.round(plot.sy(M.ALPHA_L)) + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(rect.x, ty);
  ctx.lineTo(rect.x + rect.w, ty);
  ctx.stroke();
  ctx.restore();
  tinyAt(ctx, colors, rect.x + 2, ty - 13, M.STRINGS.alphaLabel);

  if (scanDone) {
    /* what clumping has done so far: "lead" for an index SNP already taken,
       "dropped" for a SNP one of those clumps absorbed, "open" for the rest */
    const state = new Array(region.idx.length).fill("open");
    for (let c = 0; c < placed; c += 1) {
      state[region.clumps[c].index] = "lead";
      for (const m of region.clumps[c].members) state[m] = "dropped";
    }
    ctx.save();
    for (let j = 0; j < region.idx.length; j += 1) {
      const x = plot.sx(region.pos[j]);
      const y = plot.sy(Math.min(region.scan.logp[j], region.top));
      if (state[j] === "dropped") {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = colors.empirical;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.globalAlpha = 1;
      /* 4.3: the cue for a clump that has JUST been taken is cleared when the
         run stops, or a finished figure carries a highlight that reads as a
         marked SNP rather than as a recent arrival. */
      const isNewest = !finished && placed > 0 && j === region.clumps[placed - 1].index;
      const past = region.scan.P[j] < M.REGION_ALPHA;
      ctx.fillStyle = isNewest ? colors.highlight : past ? colors.extreme : colors.empirical;
      ctx.beginPath();
      ctx.arc(x, y, isNewest ? 4 : state[j] === "lead" ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (state[j] === "lead") {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = colors.surface;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* DECISION 5: where the causal SNP actually is, as a hollow mark inside the
     top edge pointing down at its column — and never ahead of the clump that
     accounts for it. */
  if (placed >= region.causalAt && region.causalAt > 0) {
    const x = plot.sx(region.causalPos);
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 4, rect.y + 2);
    ctx.lineTo(x + 4, rect.y + 2);
    ctx.lineTo(x, rect.y + 8);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  plot.axisY({ label: M.STRINGS.assocY, format: (v) => v.toFixed(0) });
  plot.axisX({ label: M.STRINGS.assocX, format: (v) => v.toFixed(0) });
}

/* DECISION 8: one cell one pixel, off screen, then drawn up with smoothing
   off. The buffer is made at the first draw and kept. */
let triBuf = null;
function triBuffer() {
  if (triBuf) return triBuf;
  if (typeof document === "undefined") return null;
  triBuf = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  return triBuf;
}

/**
 * The half-matrix, rotated onto its diagonal so each pair sits above the
 * midpoint of the two SNPs it joins — the shape every LD figure has, clipped
 * to the clumping window, which is the only distance clumping can act on.
 *
 * The image's own transform is (u, v) → (x0 + s(u+v)/2, yTop + s(v−u)/2), so
 * image row v is SNP j, column u is SNP k, and the cells above the diagonal
 * are written at alpha 0. The ramp runs from the surface to
 * `--c-value-high`: r² is non-negative and its zero is "these two SNPs say
 * nothing about each other", which has to be the ground rather than a colour.
 */
function drawTriangle(ctx, colors, rect, region, { scanDone }) {
  capAt(ctx, colors, rect.x, rect.y - 10, M.STRINGS.triCaption, rect.w * 0.7);
  noteAt(ctx, colors, rect.x + rect.w, rect.y - 10, M.STRINGS.triNote, rect.w * 0.4);

  /* THE FULL REGION, NOT THE TESTED COLUMNS. `region.R` holds all 100 SNPs
     whether or not the causal one is on the array: LD is a property of the
     chromosome and not of the genotyping, and the triangle's columns are then
     evenly spaced, which is what keeps its x aligned with the kb axis of the
     plot above it. */
  const R = region.R;
  const m = R.length;
  const s = rect.w / (m - 1);
  const buf = scanDone ? triBuffer() : null;
  if (buf) {
    buf.canvas.width = m;
    buf.canvas.height = m;
    const img = buf.createImageData(m, m);
    const ground = rgbOf(colors.surface);
    const hi = rgbOf(colors.valueHigh);
    for (let v = 0; v < m; v += 1) {
      for (let u = 0; u < m; u += 1) {
        const o = (v * m + u) * 4;
        if (v <= u || v - u > rect.depth) {
          img.data[o + 3] = 0;
          continue;
        }
        const t = Math.max(0, Math.min(1, R[v][u]));
        img.data[o] = Math.round(ground[0] + (hi[0] - ground[0]) * t);
        img.data[o + 1] = Math.round(ground[1] + (hi[1] - ground[1]) * t);
        img.data[o + 2] = Math.round(ground[2] + (hi[2] - ground[2]) * t);
        img.data[o + 3] = 255;
      }
    }
    buf.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(rect.x, rect.y);
    ctx.transform(0.5 * s, -0.5 * s, 0.5 * s, 0.5 * s, 0, 0);
    ctx.drawImage(buf.canvas, 0, 0);
    ctx.restore();
  }

  /* the line of SNPs the triangle hangs from */
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x, Math.round(rect.y) + 0.5);
  ctx.lineTo(rect.x + rect.w, Math.round(rect.y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

/* ---- page 2: the score --------------------------------------------------- */

/**
 * One person's score, as three strips over the same SNP axis with the target
 * sample's own distribution underneath. `upTo` is how many SNPs the sum has
 * reached, which is the only thing page 2's run changes.
 */
function drawScore(ctx, colors, L, st, upTo) {
  const k = st.n;
  const cw = k > 0 ? L.geno.w / k : L.geno.w;
  /* 4.3: the SNP just added is lit only while more are coming; on the finished
     sum the one mark in --c-highlight is the person's own line. */
  const newest = upTo > 0 && upTo < k ? upTo - 1 : -1;

  /* the genotypes: 0, 1 or 2 marks in a column, so the count is the reading */
  capAt(ctx, colors, L.geno.x, L.geno.y - 8, M.STRINGS.genoCaption, L.geno.w * 0.72);
  noteAt(ctx, colors, L.geno.x + L.geno.w, L.geno.y - 8, `person ${st.person}`, L.geno.w * 0.25);
  const r = Math.max(1.6, Math.min(5, cw / 2 - 1.2));
  ctx.save();
  for (let i = 0; i < upTo; i += 1) {
    const x = L.geno.x + (i + 0.5) * cw;
    ctx.fillStyle = i === newest ? colors.highlight : colors.groupA;
    for (let g = 0; g < st.genotype[i]; g += 1) {
      ctx.beginPath();
      ctx.arc(x, L.geno.y + L.geno.h - 4 - g * (2 * r + 2), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.geno.x, L.geno.y + L.geno.h + 0.5);
  ctx.lineTo(L.geno.x + L.geno.w, L.geno.y + L.geno.h + 0.5);
  ctx.stroke();
  ctx.restore();

  /* the weights: one signed bar a SNP, around a zero line */
  const bMax = k > 0 ? Math.max(...st.beta.map((b) => Math.abs(b))) * 1.12 : 1;
  const wPlot = makePlot({
    ctx, colors, rect: L.weights, xDomain: [0, Math.max(k, 1)], yDomain: [-bMax, bMax],
  });
  wPlot.caption(fit(ctx, M.STRINGS.weightCaption, capFont(colors), L.weights.w * 0.62));
  wPlot.note(M.STRINGS.weightNote);
  const zeroY = Math.round(wPlot.sy(0)) + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.weights.x, zeroY);
  ctx.lineTo(L.weights.x + L.weights.w, zeroY);
  ctx.stroke();
  const bw = Math.max(1.4, cw - 2);
  for (let i = 0; i < upTo; i += 1) {
    ctx.fillStyle = i === newest ? colors.highlight : colors.groupB;
    const x = L.geno.x + (i + 0.5) * cw - bw / 2;
    const y = wPlot.sy(st.beta[i]);
    ctx.fillRect(x, Math.min(y, zeroY), bw, Math.abs(y - zeroY));
  }
  ctx.restore();
  wPlot.axisY({ ticks: [-bMax * 0.75, 0, bMax * 0.75], format: (v) => v.toFixed(2) });

  /* the running sum */
  const lo = Math.min(0, ...st.cum, 0) * 1.1;
  const hi = Math.max(0, ...st.cum, 0) * 1.1;
  const sPlot = makePlot({
    ctx,
    colors,
    rect: L.sum,
    xDomain: [0, Math.max(k, 1)],
    yDomain: [lo || -0.1, hi || 0.1],
  });
  sPlot.caption(M.STRINGS.sumCaption);
  sPlot.note(`${M.intText(Math.min(upTo, k))} of ${M.intText(k)} SNPs added`);
  sPlot.grid([0]);
  if (upTo > 0) {
    /* a step, not a line: the sum changes at a SNP and holds between them */
    const pts = [[0, 0]];
    for (let i = 0; i < Math.min(upTo, k); i += 1) pts.push([i + 1, st.cum[i]]);
    const step = [];
    for (let i = 0; i < pts.length; i += 1) {
      if (i > 0) step.push([pts[i][0] - 1, pts[i][1]]);
      step.push(pts[i]);
    }
    sPlot.curve(step, { stroke: colors.empirical, width: 2 });
    sPlot.dot(Math.min(upTo, k), st.cum[Math.min(upTo, k) - 1], { fill: colors.empirical, r: 3.5 });
  }
  sPlot.axisY({ format: (v) => v.toFixed(1) });
  sPlot.axisX({ label: M.STRINGS.sumX, format: (v) => v.toFixed(0) });

  /* the sample's scores, and where this person sits in them */
  const nb = 34;
  const sLo = st.row.sMin;
  const sHi = st.row.sMax;
  const span = sHi - sLo || 1;
  const counts = new Array(nb).fill(0);
  for (const v of st.row.score) {
    counts[Math.min(nb - 1, Math.max(0, Math.floor(((v - sLo) / span) * nb)))] += 1;
  }
  const dPlot = makePlot({
    ctx,
    colors,
    rect: L.dist,
    xDomain: [sLo, sHi],
    yDomain: [0, Math.max(...counts) * 1.15],
  });
  dPlot.caption(fit(ctx, M.STRINGS.distCaption, capFont(colors), L.dist.w * 0.66));
  dPlot.note(`${M.intText(st.row.score.length)} people`);
  if (upTo > 0) {
    dPlot.bars(counts, { lo: sLo, width: span / nb, fill: colors.empirical, opacity: 0.32 });
  }
  /* DECISION 7: the person's own line lands with the last SNP of the sum */
  if (k > 0 && upTo >= k) {
    dPlot.vline(st.total, {
      stroke: colors.highlight,
      width: 2,
      label: `person ${st.person}`,
      align: st.total > (sLo + sHi) / 2 ? "left" : "right",
    });
  }
  dPlot.axisX({ label: M.STRINGS.distX, format: (v) => v.toFixed(1) });
}

/* ---- page 3: the threshold curve ----------------------------------------- */

const LX = (t) => Math.log10(t);

function drawCurve(ctx, colors, rect, genome, upTo) {
  const rows = genome.rows;
  const top = Math.max(0.12, Math.max(...rows.map((r) => Math.max(r.target, r.validation))) * 1.25);
  const plot = makePlot({
    ctx, colors, rect, xDomain: [LX(5e-8) - 0.4, 0.3], yDomain: [0, top],
  });
  plot.caption(fit(ctx, M.STRINGS.curveCaption, capFont(colors), rect.w + 22));
  plot.grid([0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14].filter((v) => v < top));

  /* THIS PANEL'S NOTE GOES TOP LEFT. `plot.note` right-aligns on the caption's
     own baseline and drops inside the top right corner when the caption has
     filled that line — and the top right is the one corner this panel cannot
     lend: the dashed kept count climbs into it and reaches every SNP in the
     base study at the right edge, with the second axis's tick labels 6px
     further right again. The top left is empty on every curve this panel
     draws, because both R² curves and the count start near zero at 5e−8. */
  noteAt(ctx, colors, rect.x, rect.y + 3, M.STRINGS.curveNote, rect.w - 4,
    { align: "left", baseline: "top" });

  /* the kept count on its own axis, drawn behind both curves: it is not a
     result, it is the x axis restated in SNPs */
  const mTotal = M.GENOME.m;
  if (upTo > 0) {
    const cPts = rows.slice(0, upTo).map((r) => [LX(r.thresh), (r.nSnp / mTotal) * top]);
    plot.curve(cPts, { stroke: colors.ink3, width: 1, dash: [3, 3], opacity: 0.9 });
  }
  ctx.save();
  ctx.font = noteFont(colors);
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.fillText(M.intText(frac * mTotal), rect.x + rect.w + 6, plot.sy(frac * top));
  }
  ctx.translate(rect.x + rect.w + 48, rect.y + rect.h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.fillText(M.STRINGS.keptAxis, 0, 0);
  ctx.restore();

  if (upTo > 0) {
    const swept = rows.slice(0, upTo);
    plot.curve(swept.map((r) => [LX(r.thresh), r.validation]), { stroke: colors.holdout, width: 2 });
    plot.curve(swept.map((r) => [LX(r.thresh), r.target]), { stroke: colors.empirical, width: 2 });
    for (const r of swept) {
      plot.dot(LX(r.thresh), r.target, { fill: colors.empirical, r: 2.6 });
      plot.dot(LX(r.thresh), r.validation, { fill: colors.holdout, r: 2.6 });
    }

    /* DECISION 6: the largest R² among the thresholds swept, once there are
       two of them to be largest among. */
    if (upTo >= 2) {
      const best = M.bestThreshold(swept, "target");
      const bx = plot.sx(LX(best.thresh));
      const byMark = plot.sy(best.target);
      plot.dot(LX(best.thresh), best.target, { fill: colors.highlight, r: 5 });

      /* AND ITS NOTE STAYS WITH THE MARK, on whichever side has the room.
         Pinned to the panel's right edge it sat under the kept count and
         against the second axis; at the mark it reads as a label of that point
         rather than of the panel. */
      const text = `largest in the target: ${M.n3(best.target)} at ${M.tText(best.thresh)}`;
      const need = widthOf(ctx, text, noteFont(colors));
      const roomLeft = bx - 8 - rect.x;
      const roomRight = rect.x + rect.w - (bx + 8);
      let toLeft = (bx - rect.x) / rect.w > 0.6;
      if (toLeft ? need > roomLeft : need > roomRight) toLeft = !toLeft;
      const line = Math.round(parseFloat(colors.fsXs) * 1.4) || 15;
      const by = Math.max(byMark - line, rect.y + 3 + 2 * (parseFloat(colors.fsXs) || 11));
      if (toLeft) noteAt(ctx, colors, bx - 8, by, text, roomLeft, { tone: colors.ink2 });
      else noteAt(ctx, colors, bx + 8, by, text, roomRight, { align: "left", tone: colors.ink2 });
    }
  }

  plot.axisY({ format: (v) => v.toFixed(2), label: M.STRINGS.curveY });
  plot.axisX({
    ticks: [5e-8, 1e-5, 0.001, 0.01, 0.1, 1].map(LX),
    format: (v) => M.tText(Number((10 ** v).toPrecision(1))),
    label: M.STRINGS.curveX,
  });
  /* a small mark at every threshold the sweep visits */
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  for (const r of rows) {
    const x = Math.round(plot.sx(LX(r.thresh))) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x, rect.y + rect.h + 3);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---- page 4: the quantile plot ------------------------------------------- */

function drawQuantiles(ctx, colors, rect, genome, row, popLabel, upTo) {
  /* THE FRAME IS THE FINISHED FIGURE'S, not the arrived vigintiles' (2.5): an
     axis refitted as each bin lands would hold every partial figure at the
     same height and show none of them arriving. */
  const lo = Math.min(...row.bins.map((b) => b.lo));
  const hi = Math.max(...row.bins.map((b) => b.hi));
  const pad = (hi - lo) * 0.08 || 0.1;
  const plot = makePlot({
    ctx, colors, rect, xDomain: [0.3, 20.7], yDomain: [lo - pad, hi + pad],
  });
  plot.caption(fit(ctx, M.STRINGS.quantCaption, capFont(colors), rect.w * 0.62));
  plot.note(fit(ctx, popLabel, noteFont(colors), rect.w * 0.34));

  /* the sample's overall mean — the benchmark every interval is read against.
     NO LABEL ON THE LINE: at 319 people every vigintile's interval is long
     enough to reach it, at either end of the plot, so the legend names it. */
  const my = Math.round(plot.sy(genome.overall)) + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(rect.x, my);
  ctx.lineTo(rect.x + rect.w, my);
  ctx.stroke();
  ctx.restore();

  const shown = row.bins.slice(0, Math.min(upTo, row.bins.length));
  ctx.save();
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const b of shown) {
    const x = Math.round(plot.sx(b.bin)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, plot.sy(b.lo));
    ctx.lineTo(x, plot.sy(b.hi));
    ctx.stroke();
  }
  ctx.restore();
  for (const b of shown) {
    /* 4.3 again: the vigintile that has just landed, and nothing once they all
       have. */
    const newest = b.bin === shown.length && shown.length < row.bins.length;
    plot.dot(b.bin, b.mean, { fill: newest ? colors.highlight : colors.empirical, r: 3.2 });
  }

  plot.axisY({ format: (v) => v.toFixed(1), label: M.STRINGS.quantY });
  plot.axisX({ ticks: [1, 5, 10, 15, 20], format: (v) => v.toFixed(0), label: M.STRINGS.quantX });
}

/* ============================== the widget ================================= */

defineWidget({
  slug: "polygenic-score",
  title: "Polygenic Risk Scores",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* one geometry function, for the height the page reserves and for every rect
     the figure draws in (5.8) */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* DECISION 2: the page is display, and the run is per page, so a visit
       elsewhere and back keeps both. */
    page: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "ld",
      display: true,
    },

    regionSec: { type: "section", label: M.STRINGS.regionSection },
    recomb: {
      type: "segmented",
      label: M.STRINGS.recombLabel,
      detail: M.STRINGS.recombDetail,
      options: M.RECOMB,
      default: "medium",
      when: { param: "page", equals: "ld" },
    },
    clumpR2: {
      type: "segmented",
      label: M.STRINGS.clumpR2Label,
      detail: M.STRINGS.clumpR2Detail,
      options: M.CLUMP_R2,
      default: "0.1",
      when: { param: "page", equals: "ld" },
    },
    causalTyped: {
      type: "segmented",
      label: M.STRINGS.typedLabel,
      detail: M.STRINGS.typedDetail,
      options: M.TYPED,
      default: "typed",
      when: { param: "page", equals: "ld" },
    },

    baseSec: {
      type: "section",
      label: M.STRINGS.baseSection,
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },
    causal: {
      type: "segmented",
      label: M.STRINGS.causalLabel,
      detail: M.STRINGS.causalDetail,
      options: M.CAUSAL,
      default: "300",
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },
    h2: {
      type: "segmented",
      label: M.STRINGS.h2Label,
      detail: M.STRINGS.h2Detail,
      options: M.H2,
      default: "0.3",
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },

    targetSec: {
      type: "section",
      label: M.STRINGS.targetSection,
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },
    target: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.targetLabel,
      detail: M.STRINGS.targetDetail,
      options: M.TARGETS.map((t) => ({ value: t.value, label: t.label, span: true })),
      default: "same",
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },
    /* DECISION 3: eleven readings of one base study, all of them computed. */
    threshold: {
      type: "choice",
      label: M.STRINGS.thresholdLabel,
      detail: M.STRINGS.thresholdDetail,
      options: M.THRESHOLD_OPTIONS,
      default: "0.01",
      display: true,
      when: { param: "page", oneOf: ["score", "threshold", "quantile"] },
    },
    person: {
      type: "int",
      label: M.STRINGS.personLabel,
      detail: M.STRINGS.personDetail,
      min: 1,
      max: 319,
      default: 1,
      display: true,
      when: { param: "page", equals: "score" },
    },

    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      detail: M.STRINGS.seedDetail,
      min: 1,
      max: 200,
      default: 29,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only, counted in the unit of the
       page the link names: clumps taken, SNPs added, thresholds swept,
       vigintiles landed. */
    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "ld") {
      return [
        { token: "empirical", label: "A SNP's test", mark: "dot" },
        { token: "extreme", label: "Under P = 0.05", mark: "dot" },
        { token: "empirical", label: "In LD with a lead SNP, and dropped", mark: "dot" },
        { token: "highlight", label: "The lead SNP just taken", mark: "dot" },
        { token: "reference", label: "P = 0.05", mark: "dash" },
        { token: "reference", label: "The causal SNP's position", mark: "tri" },
        { token: "value-high", label: "r² between a pair of SNPs" },
      ];
    }
    if (params.page === "score") {
      return [
        { token: "group-a", label: "The person's genotype, in effect alleles", mark: "dot" },
        { token: "group-b", label: "The base study's weight" },
        { token: "empirical", label: "The sum so far, and the sample's scores", mark: "line" },
        { token: "highlight", label: "The SNP just added, and the person's score", mark: "dot" },
      ];
    }
    if (params.page === "threshold") {
      return [
        { token: "empirical", label: "R² in the target sample", mark: "line" },
        { token: "holdout", label: "R² in the validation sample", mark: "line" },
        { token: "highlight", label: "The best-fit threshold", mark: "dot" },
        { token: "ink-3", label: "SNPs kept, on the right axis", mark: "dash" },
      ];
    }
    return [
      { token: "empirical", label: "Mean trait in a vigintile, with its 95% interval", mark: "dot" },
      { token: "highlight", label: "The vigintile just landed", mark: "dot" },
      { token: "reference", label: M.STRINGS.meanLine, mark: "dash" },
    ];
  },

  /* One region and one genome, both on every data change (model.js
     decision 2), and every threshold's reading with them (decision 3). */
  compute({ params, rng }) {
    return M.build(rng, M.configFor(params));
  },

  animation: {
    stepLabel: M.STEP_LABELS,
    stepTitle: M.STEP_TITLES,
    runTitle: M.RUN_TITLES,

    init: ({ params, state, fromScratch }) => {
      const k = { ld: 0, score: 0, threshold: 0, quantile: 0 };
      /* An authored head start applies on the first render only, to the page
         the link names — `?page=threshold&shown=11` for a lesson link. */
      const authored = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      const page = params.page ?? "ld";
      k[page] = Math.min(M.totalFor(page, state, params), authored);
      return {
        k,
        beat: 0,
        /* model.js decision 5: page 1's tests are the first beat of its run. */
        scanDone: k.ld > 0,
        done: k[page] >= M.totalFor(page, state, params),
      };
    },

    advance: (anim, { dt, params, state }) => {
      const page = params.page ?? "ld";
      const total = M.totalFor(page, state, params);
      if (page === "ld" && !anim.scanDone) {
        anim.scanDone = true;
        /* Play spends its first frame on the tests and takes no clump; Step
           goes on to take the clump its label promises. */
        if (anim.mode === "run") return true;
      }
      if (anim.k[page] >= total) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.beatMs(page);
      if (anim.beat < 1) return true;
      if (anim.mode === "step") {
        anim.beat = 0;
        anim.k[page] = Math.min(total, anim.k[page] + 1);
      } else {
        const units = Math.floor(anim.beat);
        anim.beat -= units;
        anim.k[page] = Math.min(total, anim.k[page] + units * M.perUnit(page, state, params));
      }
      if (anim.k[page] >= total) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* A display change keeps every page's work and re-derives what follows
       from it: the P threshold changes how many SNPs page 2 has to add, so a
       sum that ran past the new count stops at it. */
    rebuild: (anim, { params, state }) => {
      for (const page of ["ld", "score", "threshold", "quantile"]) {
        anim.k[page] = Math.min(anim.k[page], M.totalFor(page, state, params));
      }
      anim.scanDone = anim.scanDone || anim.k.ld > 0;
      const page = params.page ?? "ld";
      anim.done = anim.k[page] >= M.totalFor(page, state, params);
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const L = M.layout(w, params);
    const upTo = anim?.k?.[L.page] ?? 0;
    if (L.page === "ld") {
      drawAssoc(ctx, colors, L.assoc, state.region, {
        shown: upTo,
        scanDone: Boolean(anim?.scanDone),
        finished: upTo >= state.region.clumps.length,
      });
      drawTriangle(ctx, colors, L.tri, state.region, { scanDone: Boolean(anim?.scanDone) });
      return;
    }
    if (L.page === "score") {
      drawScore(ctx, colors, L, M.personScore(state, params), upTo);
      return;
    }
    if (L.page === "threshold") {
      drawCurve(ctx, colors, L.curve, state.genome, upTo);
      return;
    }
    drawQuantiles(ctx, colors, L.bins, state.genome, M.rowFor(state, params),
      M.targetOf(params.target).label, upTo);
  },

  readout({ params, state, anim }) {
    const page = params.page ?? "ld";
    const upTo = anim?.k?.[page] ?? 0;

    if (page === "ld") {
      const R = state.region;
      const placed = Math.min(upTo, R.clumps.length);
      let sig = 0;
      for (let c = 0; c < placed; c += 1) if (R.clumps[c].p < M.REGION_ALPHA) sig += 1;
      return [
        {
          label: "SNPs under P < 0.05",
          value: anim?.scanDone ? M.intText(R.hits) : "—",
          note: "before clumping",
        },
        {
          label: "Clumps kept",
          value: placed > 0 ? M.intText(sig) : "—",
          note: "lead SNPs under P < 0.05",
        },
        {
          label: "r² to the causal SNP",
          value: placed > 0 ? M.n2(R.leadR2) : "—",
          note: R.typed
            ? "from the region's lead SNP"
            : "from the region's lead SNP; the causal variant is not on the array",
        },
      ];
    }

    if (page === "score") {
      const st = M.personScore(state, params);
      const done = st.n > 0 && upTo >= st.n;
      const partial = upTo > 0 ? st.cum[Math.min(upTo, st.n) - 1] : 0;
      return [
        {
          label: "Score",
          value: upTo > 0 ? M.n2(partial) : "—",
          note: "Σ β̂ⱼ xⱼ over the SNPs kept",
        },
        {
          /* DECISION 7: a partial sum has no place among finished scores. */
          label: "Standardised score",
          value: done && st.row.sSd > 0 ? M.n2(st.z) : "—",
          note: "SD from the sample's mean score",
        },
        {
          label: "Percentile",
          value: done && st.row.sSd > 0 ? M.intText(st.percentile) : "—",
          note: `of the ${M.intText(M.N_TARGET)} people in the target sample`,
        },
      ];
    }

    if (page === "threshold") {
      const rows = state.genome.rows;
      const swept = rows.slice(0, upTo);
      const at = rows.indexOf(M.rowFor(state, params));
      /* The three tiles read the threshold on the slider, and stay blank until
         the sweep has reached it: a number the figure has not drawn is a
         number the visible data cannot support (2.11). */
      const reached = at < upTo ? rows[at] : null;
      const best = swept.length >= 2 ? M.bestThreshold(swept, "target") : null;
      return [
        {
          label: "SNPs kept",
          value: reached ? M.intText(reached.nSnp) : "—",
          note: `P below ${M.tText(Number(params.threshold))} in the base study`,
        },
        {
          label: "R² in the target sample",
          value: reached ? M.n3(reached.target) : "—",
          note: "the sample the threshold is chosen in",
        },
        {
          label: "R² in the validation sample",
          value: reached ? M.n3(reached.validation) : "—",
          note: "scored once, at the same threshold",
        },
        {
          label: "Overfitting",
          value: best ? M.n3(best.target - best.validation) : "—",
          note: "best-fit R² minus the validation R² there",
        },
      ];
    }

    const row = M.rowFor(state, params);
    const landed = Math.min(upTo, 20);
    let excl = 0;
    for (let b = 0; b < landed; b += 1) {
      const bin = row.bins[b];
      if (bin.lo > state.genome.overall || bin.hi < state.genome.overall) excl += 1;
    }
    return [
      {
        label: "R²",
        value: landed > 1 ? M.n3(row.binR2[landed]) : "—",
        note: "of the score in this target sample",
      },
      {
        label: "First to last vigintile",
        value: landed >= 20 ? M.n2(row.range) : "—",
        note: "in SD of the trait",
      },
      {
        label: "Intervals excluding the mean",
        value: landed > 0 ? `${M.intText(excl)} of 20` : "—",
        note: `at about ${Math.round(M.N_TARGET / 20)} people a vigintile`,
      },
    ];
  },

  summary({ params, state, anim }) {
    const page = params.page ?? "ld";
    const upTo = anim?.k?.[page] ?? 0;
    if (page === "ld") {
      const R = state.region;
      if (!anim?.scanDone) {
        return `An empty plot of −log₁₀P against position over ${M.intText(R.span)} kb, with the `
          + "P = 0.05 line across it, before any of the region's 100 SNPs is tested.";
      }
      const placed = Math.min(upTo, R.clumps.length);
      return `${M.intText(R.hits)} of 100 SNPs in a ${M.intText(R.span)} kb region are under `
        + `P = 0.05, and ${M.intText(placed)} of ${M.intText(R.clumps.length)} clumps have been `
        + `taken. The r² between every pair within 250 kb is drawn underneath.`;
    }
    if (page === "score") {
      const st = M.personScore(state, params);
      if (upTo === 0) {
        return `An empty figure of one column a SNP — genotype, weight and running sum — over `
          + `the score distribution of ${M.intText(M.N_TARGET)} people, before any of the `
          + `${M.intText(st.n)} SNPs the P threshold keeps is added.`;
      }
      const partial = st.cum[Math.min(upTo, st.n) - 1];
      return `Person ${st.person}'s score after ${M.intText(Math.min(upTo, st.n))} of `
        + `${M.intText(st.n)} SNPs is ${M.n2(partial)}, drawn as the genotype, the base study's `
        + `weight and the running sum over each SNP in turn.`;
    }
    if (page === "threshold") {
      if (upTo === 0) {
        return "An empty plot of R² against the P threshold on a log axis, with the number of "
          + "SNPs kept on a second axis, before any threshold is scored.";
      }
      const swept = state.genome.rows.slice(0, upTo);
      const last = swept[swept.length - 1];
      return `R² against the P threshold, swept to ${M.tText(last.thresh)}: the target sample `
        + `reads ${M.n3(last.target)} there and the validation sample ${M.n3(last.validation)}, `
        + `over ${M.intText(last.nSnp)} SNPs kept.`;
    }
    const row = M.rowFor(state, params);
    if (upTo === 0) {
      return "An empty plot of mean trait against score vigintile, with the sample's own mean "
        + "trait drawn across it, before any vigintile has landed.";
    }
    return `Mean trait by score vigintile in a ${M.targetOf(params.target).label.toLowerCase()} `
      + `target sample, ${M.intText(Math.min(upTo, 20))} of 20 landed, each with a 95% interval `
      + `around it and the sample's mean trait drawn across.`;
  },
});
