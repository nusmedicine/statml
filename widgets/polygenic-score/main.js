/* ============================================================================
   Widget 59 · Polygenic scores — the haplotypes, the clumping, the sum, the
   threshold, the quantile plot and the risk.

   PHM5003 week 6 (02-1, 02-2), carrying slot 58's LD-and-clumping material as
   steps 1 and 2. `model.js` holds the engine, the geometry and the copy; this
   file draws them.

   The one claim: a score is a weighted count of effect alleles, its weights
   come from another study, how well it predicts is a number that has to be
   read on people it was not chosen on, and a percentile becomes a risk only
   after a model is fitted and checked.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCKS ARE THE PICTURE OF RECORD. `_lab/prs-mock.html` drew eight
       sections and Kenneth picked from all of them; `_lab/prs-round2-mock.html`
       drew eight more after his review and he picked every recommendation
       (catalogue § Slot 59, 2026-09-12). His two nomenclature rulings stand:
       no "tune" and no "holdout" in anything a reader sees.

    2. SIX STEPS, ONE RAIL, AND `page` IS A DISPLAY PARAMETER. The run is per
       step (`model.js` decision 4), so leaving a step and coming back keeps
       what was built on all six (non-negotiable 3).

    3. THE P THRESHOLD AND THE PERSON ARE DISPLAY PARAMETERS TOO. The threshold
       chooses among eleven readings of one base study — the curve, the
       vigintiles AND the risk model, all of them computed (`model.js`
       decisions 3 and 12) — and the person chooses which row of the target
       sample the sum is drawn for. Neither draws a new cohort.

    4. NOTHING IS DRAWN BEFORE THE RUN REACHES IT (non-negotiable 4). Each step
       opens on its axes and its reference lines — the P = 0.05 line, the
       sample's mean trait, the diagonal, the risk threshold — and everything
       else arrives: the haplotypes, then the tests and the clumps, the SNPs of
       the sum, the thresholds, the vigintiles, the deciles.

    5. THE CAUSAL SNP'S POSITION IS A REFERENCE, SO IT ARRIVES WHEN THE FIGURE
       CAN ACCOUNT FOR IT. On step 2 that is the clump that holds it
       (`model.js` computes which beat). On step 1 it is marked from the start,
       because nothing has been tested there yet and the mark gives no answer
       away — and one shape meaning one thing on both steps is worth more than
       the surprise of meeting it early.

    6. THE BEST-FIT MARK IS THE LARGEST AMONG THE THRESHOLDS SWEPT, and it
       needs two of them before it means anything. The reading line under the
       axis names the same two numbers the mark does, so the sentence and the
       figure cannot disagree.

    7. THE STANDARDISED SCORE AND THE PERCENTILE WAIT FOR THE LAST SNP. A
       partial sum has no standing in a distribution of finished scores, so the
       two tiles that place the person read "—" until the sum is complete —
       which is also when the person's line joins the distribution.

    8. STEP 2'S THREE BEATS ARE THE ANSWER TO "CLUMPING IS NOT APPARENT". The
       lead lights, an arc is drawn to every SNP its r² takes with the arc's
       opacity carrying that r², and then those SNPs slide to the baseline and
       stay there as ticks. The draft faded them, which is the weakest channel
       a canvas has, and it showed clumping's result without its cause.

       THE ARCS ARE `--c-highlight`, NOT `--c-value-high`. The first draft of
       the mock used value-high, so that r² kept the colour step 1's triangle
       paints it in — and drawn, the arcs came out the colour of the
       significant SNPs, because `--c-value-high` and `--c-extreme` are the
       same value. The arc belongs to the lead SNP, the lead is
       `--c-highlight`, and the alpha is the r².

    9. STEP 6 DRAWS THE CHECK AND THE CONSEQUENCE SIDE BY SIDE. The calibration
       plot is only worth reading because the stratification cut beside it is
       only worth acting on when the plot sits on the diagonal. Both panels are
       square, because a calibration plot whose diagonal is not a diagonal is
       not one.

   11. STEP 3 IS ONE COLUMN A SNP AT EVERY COUNT — Kenneth's pick, round
       three (2026-09-12), after his note that the batch column "just
       flatlines". Round two drew the forty strongest SNPs one a beat and the
       rest as one batch on one beat, and the sum's last step ran level across
       a quarter of the panel. Now the x axis is the kept count from the first
       frame and every SNP has its own column; the genotype dots become bars
       of whole units below a 4px column (`model.js` SCORE_DOT_MIN) and the
       run is capped at six seconds (its decision 14). At 40 or fewer kept the
       picture is round one's, unchanged.

       THE X AXIS IS ONE COLUMN A SNP, and its label says the order: lowest P
       first, so the big steps come early and the sum settles — step 4's
       plateau met one SNP at a time.

   13. THE BLOCK AND THE TRIANGLE ANSWER THE POINTER, AND A CLICK PINS THE
       ANSWER — `model.js` decision 15. `pointer: true` gives `draw()` the
       pointer, `regions` gives a click the same subject through the hidden
       display parameter `snps`, and the overlay is one function called with
       whichever of the two is present, the pointer winning while it is on a
       target. The causal SNP's V is on the triangle at rest, so the shape of
       "one SNP's row and column" is learnt from the figure before anything
       is touched.

   12. THE DEFAULT SEED IS 41. Of sixteen seeds swept in the round-two mock it
       is the only one that opens with the target sample above the validation
       sample at all three base study sizes AND has the region's lead SNP off
       the causal one — 25 kb away at r² 0.79, which is step 2's whole case.
       It opens step 4 on best-fit R² 0.294 in the target at P < 0.01 against
       0.267 in the validation sample.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

/* ---- small drawing helpers ----------------------------------------------- */

const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const noteFont = (colors) => `${colors.fsXs} ${colors.font}`;
const noteLine = (colors) => Math.round(parseFloat(colors.fsXs) * 1.4) || 15;

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
  return widthOf(ctx, s, capFont(colors));
}

/**
 * A short note, with the edge it hangs from and its baseline named.
 *
 * `plot.note` is the right-aligned, caption-baseline case and most panels here
 * use it. Step 4 needs the identical mark on the other edge: its caption fills
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

/**
 * A caption and its note on one row, with the note dropped to a LINE OF ITS OWN
 * ABOVE when it will not fit beside — the mock's own guard.
 *
 * `plot.note` already refuses to print through a caption: when the line is full
 * it drops the note inside the panel's top right instead. On step 6's
 * calibration panel that is exactly where the tallest interval stands, so the
 * note landed on the data — the same collision, moved six pixels. The line
 * above the caption is the one part of the block nothing else uses.
 */
function captionRow(ctx, colors, rect, caption, note, { lineW = rect.w, gap = 14 } = {}) {
  /* `lineW` is the width the caption ROW may use, which on step 6 is wider than
     the 196px panel under it: the two squares are square because a calibration
     plot's diagonal has to be one, and their captions name quantities that no
     196px line can hold. */
  const capW = capAt(ctx, colors, rect.x, rect.y - 8, caption, lineW);
  if (!note) return;
  const room = lineW - capW - gap;
  const need = widthOf(ctx, note, noteFont(colors));
  if (need <= room) noteAt(ctx, colors, rect.x + lineW, rect.y - 8, note, room);
  else {
    noteAt(ctx, colors, rect.x, rect.y - 8 - noteLine(colors), note, lineW, { align: "left" });
  }
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

/** A token colour at an alpha, for a mark whose strength IS a number. */
function alphaOf(c, a) {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/**
 * The two images step 1 paints, drawn once a region and reused.
 *
 * Both image panels — the haplotype block and the r² triangle — want one cell
 * one pixel and then a scale-up with smoothing off: interpolating 4,950 cells
 * into 490px would blur exactly the structure the panels are for. Round two
 * rebuilt both buffers on every paint; with the pointer repainting on every
 * move (decision 13) that is 9,000 cells a move, so they are cached on the
 * region and rebuilt only when the theme's colours change. Made on the first
 * draw rather than at import, so the figure's text can be swept with no DOM
 * at all (5.6): with no `document` the images are null and the panels draw
 * their frames and text alone.
 */
const IMAGES = new WeakMap();
function imagesFor(region, colors) {
  const key = [colors.empirical, colors.surface3 ?? colors.surface2, colors.surface, colors.valueHigh]
    .join("|");
  const hit = IMAGES.get(region);
  if (hit && hit.key === key) return hit;
  if (typeof document === "undefined") return { key, block: null, tri: null };
  const m = region.hap.m;

  const block = document.createElement("canvas");
  block.width = m;
  block.height = M.HAP_ROWS;
  {
    const o = block.getContext("2d");
    const img = o.createImageData(m, M.HAP_ROWS);
    const one = rgbOf(colors.empirical);
    const zero = rgbOf(colors.surface3 ?? colors.surface2);
    for (let i = 0; i < M.HAP_ROWS; i += 1) {
      for (let j = 0; j < m; j += 1) {
        const c = region.hap.H[j][i] ? one : zero;
        const p = (i * m + j) * 4;
        img.data[p] = c[0];
        img.data[p + 1] = c[1];
        img.data[p + 2] = c[2];
        img.data[p + 3] = 255;
      }
    }
    o.putImageData(img, 0, 0);
  }

  /* THE FULL REGION, NOT THE TESTED COLUMNS. `region.R` holds all 100 SNPs
     whether or not the causal one is on the array: LD is a property of the
     chromosome and not of the genotyping. The ramp runs from the surface to
     `--c-value-high`: r² is non-negative and its zero is "these two SNPs say
     nothing about each other", which has to be the ground rather than a
     colour. Image row v is SNP j, column u is SNP k, and the cells on and
     above the diagonal are written at alpha 0. */
  const tri = document.createElement("canvas");
  tri.width = m;
  tri.height = m;
  {
    const o = tri.getContext("2d");
    const img = o.createImageData(m, m);
    const ground = rgbOf(colors.surface);
    const hi = rgbOf(colors.valueHigh);
    for (let v = 0; v < m; v += 1) {
      for (let u = 0; u < m; u += 1) {
        const p = (v * m + u) * 4;
        if (v <= u) {
          img.data[p + 3] = 0;
          continue;
        }
        const t = Math.max(0, Math.min(1, region.R[v][u]));
        img.data[p] = Math.round(ground[0] + (hi[0] - ground[0]) * t);
        img.data[p + 1] = Math.round(ground[1] + (hi[1] - ground[1]) * t);
        img.data[p + 2] = Math.round(ground[2] + (hi[2] - ground[2]) * t);
        img.data[p + 3] = 255;
      }
    }
    o.putImageData(img, 0, 0);
  }
  const out = { key, block, tri };
  IMAGES.set(region, out);
  return out;
}

/* ---- the step line and the hand-off (model.js decision 8) ---------------- */

function drawHead(ctx, colors, head, page) {
  const line = M.stepLine(page);
  tinyAt(ctx, colors, head.x, head.y, line, "left", colors.highlight);
  const used = widthOf(ctx, line, noteFont(colors));
  noteAt(ctx, colors, head.x + head.w, head.y, M.HANDOFFS[M.pageOf({ page })],
    Math.max(40, head.w - used - 14), { baseline: "top", tone: colors.ink3 });
}

/* ---- step 1: the haplotypes and the r² triangle -------------------------- */

/**
 * `drawn` rows of the pool as rows, the region's SNPs as columns, one allele a
 * tone. The shared stretches are a consequence of where each haplotype last
 * switched ancestor, so they read as vertical bands with nothing drawn to mark
 * them. `foot` replaces the block's own foot line while a subject is on screen
 * (decision 13), so the stage never moves with the pointer.
 */
function drawBlock(ctx, colors, rect, region, drawn, { foot = null, img = null } = {}) {
  const m = region.hap.m;
  const capW = capAt(ctx, colors, rect.x, rect.y - 10, M.STRINGS.blockCaption, rect.w * 0.62);
  noteAt(ctx, colors, rect.x + rect.w, rect.y - 10,
    `${M.intText(drawn)} of ${M.HAP_ROWS} drawn, from a pool of ${M.intText(M.REGION.nHap)}`,
    rect.w - capW - 14);

  if (img && drawn > 0) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, m, drawn, rect.x, rect.y, rect.w, rect.h * (drawn / M.HAP_ROWS));
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.restore();

  /* DECISION 5: the causal SNP's column, with the same hollow mark step 2 uses
     for the same SNP. */
  const x = M.snpCentreX(rect, region.causal);
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, rect.y);
  ctx.lineTo(Math.round(x) + 0.5, rect.y + rect.h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 4, rect.y - 8);
  ctx.lineTo(x + 4, rect.y - 8);
  ctx.lineTo(x, rect.y - 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const line = foot ?? `${M.STRINGS.blockNote} · ${M.REGION.m} SNPs over ${M.intText(region.span)} kb`;
  tinyAt(ctx, colors, rect.x + rect.w / 2, rect.y + rect.h + 6,
    fit(ctx, line, noteFont(colors), rect.w), "center", foot ? colors.ink1 : undefined);
}

/**
 * The half-matrix rotated onto its diagonal, so each pair sits above the
 * midpoint of the two SNPs it joins — the shape every LD figure has — and the
 * whole of it (model.js decision 13), with the clumping window's reach drawn
 * across it as one rule from the first frame, because the rule belongs to the
 * axis and not to the data.
 *
 * The image's own transform is (u, v) → (x0 + s(u+v)/2, yTop + s(v−u)/2) with
 * s the BLOCK'S column pitch, so SNP j's cells hang from its column's centre.
 * It is drawn once the pool is complete: the r² is measured over the whole
 * pool rather than over the rows on screen.
 */
function drawTriangle(ctx, colors, rect, region, { shown, img = null }) {
  capAt(ctx, colors, rect.x, rect.y - 10, M.STRINGS.triCaption, rect.w * 0.7);
  noteAt(ctx, colors, rect.x + rect.w, rect.y - 10, M.STRINGS.triNote, rect.w * 0.28);
  const m = region.R.length;
  const cw = M.snpPitch(rect);
  if (shown && img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(rect.x, rect.y);
    ctx.transform(0.5 * cw, -0.5 * cw, 0.5 * cw, 0.5 * cw, 0, 0);
    ctx.drawImage(img, 0, 0);
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

  /* the window's reach: the cells exactly CLUMP_DEPTH apart lie on one
     horizontal line, and the label sits over the ground to its right, where
     the triangle's sloping edge has already left the panel empty */
  const d = M.CLUMP_DEPTH;
  const y = Math.round(rect.y + (d / 2) * cw) + 0.5;
  ctx.strokeStyle = colors.ink3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(rect.x + ((d + 1) / 2) * cw, y);
  ctx.lineTo(rect.x + ((2 * m - d - 1) / 2) * cw, y);
  ctx.stroke();
  ctx.restore();
  noteAt(ctx, colors, rect.x + rect.w, y - 4, M.STRINGS.windowLabel, 170, { tone: colors.ink3 });
}

/** SNP j's row and column in the triangle: a V hanging from its position. */
function drawV(ctx, colors, tri, j, { stroke, dash = null, width = 1 }) {
  const m = M.REGION.m;
  const cw = M.snpPitch(tri);
  const xj = M.snpCentreX(tri, j);
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  if (j > 0) {
    const a = M.cellCentre(tri, j, 0);
    ctx.moveTo(xj, tri.y);
    ctx.lineTo(a.x - cw / 2, a.y + cw / 2);
  }
  if (j < m - 1) {
    const b = M.cellCentre(tri, m - 1, j);
    ctx.moveTo(xj, tri.y);
    ctx.lineTo(b.x + cw / 2, b.y + cw / 2);
  }
  ctx.stroke();
  ctx.restore();
}

function outlineColumn(ctx, colors, block, j) {
  const cw = M.snpPitch(block);
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(block.x + j * cw, block.y - 1, cw, block.h + 2);
  ctx.restore();
}

/**
 * The subject under the pointer or pinned by a click (decision 13): one SNP's
 * column and its V, or a pair's cell, its two legs to the axis, both columns,
 * and the stretch between them banded in every row where the two alleles
 * travel together. The triangle's part of it waits for the triangle.
 */
function drawSubject(ctx, colors, L, region, subject, { drawn, triShown }) {
  if (subject.kind === "pair") {
    const k = Math.min(...subject.snps);
    const j = Math.max(...subject.snps);
    const st = M.pairStats(region, j, k, drawn);
    const cw = M.snpPitch(L.block);
    const rh = L.block.h / M.HAP_ROWS;
    ctx.save();
    ctx.fillStyle = alphaOf(colors.highlight, 0.38);
    for (let i = 0; i < drawn; i += 1) {
      if (st.flags[i]) ctx.fillRect(L.block.x + k * cw, L.block.y + i * rh, (j - k + 1) * cw, rh);
    }
    ctx.restore();
    outlineColumn(ctx, colors, L.block, k);
    outlineColumn(ctx, colors, L.block, j);
    if (!triShown) return;
    const c = M.cellCentre(L.tri, j, k);
    const h = M.snpPitch(L.tri) / 2 + 1;
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(M.snpCentreX(L.tri, k), L.tri.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(M.snpCentreX(L.tri, j), L.tri.y);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - h);
    ctx.lineTo(c.x + h, c.y);
    ctx.lineTo(c.x, c.y + h);
    ctx.lineTo(c.x - h, c.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }
  const [j] = subject.snps;
  outlineColumn(ctx, colors, L.block, j);
  if (triShown) drawV(ctx, colors, L.tri, j, { stroke: colors.highlight, width: 1.25 });
}

/* ---- step 2: clumping, three beats a clump ------------------------------- */

/**
 * The region's tests, and what clumping has done to them so far.
 *
 * `beats` counts in thirds of a clump (model.js decision 9): after 3c beats
 * clump c−1 has settled and nothing is in flight; at 3c+1 clump c's lead is
 * lit; at 3c+2 its arcs are drawn; and the third beat slides its SNPs to the
 * baseline, tweened by `frac`.
 *
 * `scanDone` is whether the tests are on screen at all, which is the first
 * frame of Play (model.js decision 5).
 */
function drawClump(ctx, colors, rect, region, { beats, frac, scanDone }) {
  const plot = makePlot({
    ctx, colors, rect, xDomain: [0, region.span], yDomain: [0, region.top],
  });

  const nC = region.clumps.length;
  const settled = Math.min(Math.floor(beats / M.CLUMP_BEATS), nC);
  const phase = settled < nC ? beats % M.CLUMP_BEATS : 0;
  const active = phase > 0 ? settled : -1;
  let sigPlaced = 0;
  for (let c = 0; c < settled; c += 1) {
    if (region.clumps[c].p < M.REGION_ALPHA) sigPlaced += 1;
  }

  const caption = active >= 0
    ? M.STRINGS.assocCaptionLead
    : settled === 0 ? M.STRINGS.assocCaption : M.STRINGS.assocCaptionClumped;
  const note = !scanDone
    ? null
    : active >= 0
      ? `${M.intText(region.clumps[active].members.length)} SNPs at r² ≥ ${region.clumpR2}`
      : settled === 0
        ? `${M.intText(region.hits)} of ${M.REGION.m} SNPs under P < 0.05`
        : `${M.intText(sigPlaced)} ${sigPlaced === 1 ? "clump" : "clumps"} under P < 0.05`;
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
    const px = (j) => plot.sx(region.pos[j]);
    const py = (j) => plot.sy(Math.min(region.scan.logp[j], region.top));
    const baseY = rect.y + rect.h;
    /* the third beat's own progress: 0 while the arcs are being drawn, then
       the slide */
    const slide = phase === 2 ? Math.max(0, Math.min(1, frac)) : 0;

    const state = new Array(region.idx.length).fill("open");
    for (let c = 0; c < settled; c += 1) {
      state[region.clumps[c].index] = "lead";
      for (const m of region.clumps[c].members) state[m] = "gone";
    }
    if (active >= 0) {
      state[region.clumps[active].index] = "chosen";
      for (const m of region.clumps[active].members) state[m] = "leaving";
    }

    /* DECISION 8: the arcs, under the points and over the grid. Each one joins
       the lead to a SNP its r² takes, and its opacity IS that r². */
    if (active >= 0) {
      const cl = region.clumps[active];
      const lx = px(cl.index);
      const ly = py(cl.index);
      const strength = phase === 1 ? Math.max(0, Math.min(1, frac)) : 1;
      ctx.save();
      ctx.lineWidth = 1.2;
      for (const m of cl.members) {
        const mx = px(m);
        const my = py(m);
        const r2 = region.Rs[cl.index][m];
        ctx.strokeStyle = alphaOf(colors.highlight,
          strength * (0.18 + 0.72 * Math.max(0, Math.min(1, r2))));
        const cy = Math.max(rect.y + 6, Math.min(ly, my) - 52);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo((lx + mx) / 2, cy, mx, my);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    for (let j = 0; j < region.idx.length; j += 1) {
      const x = px(j);
      const st = state[j];
      if (st === "gone") {
        /* a SNP the score does not carry, still visibly tested: a tick on the
           axis rather than a dot faded out */
        ctx.strokeStyle = alphaOf(colors.empirical, 0.5);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, baseY - 5);
        ctx.lineTo(Math.round(x) + 0.5, baseY);
        ctx.stroke();
        continue;
      }
      if (st === "leaving") {
        const y0 = py(j);
        const y = y0 + (baseY - y0) * slide;
        ctx.fillStyle = alphaOf(colors.empirical, 0.75);
        ctx.beginPath();
        ctx.arc(x, y, 2.6 - 1.0 * slide, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const y = py(j);
      const past = region.scan.P[j] < M.REGION_ALPHA;
      ctx.fillStyle = st === "chosen" ? colors.highlight : past ? colors.extreme : colors.empirical;
      ctx.beginPath();
      ctx.arc(x, y, st === "chosen" ? 4.4 : st === "lead" ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (st === "lead" || st === "chosen") {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = colors.surface;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* DECISION 5: where the causal SNP actually is, and never ahead of the clump
     that accounts for it. */
  if (settled >= region.causalAt && region.causalAt > 0) {
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

/* ---- step 3: the score --------------------------------------------------- */

/**
 * One person's score, as three strips over the same SNP axis with the target
 * sample's own distribution underneath.
 *
 * `beats` is how far step 3's run has got, and model.js decision 14 is what a
 * beat means: one SNP for the first forty, and then one beat for every SNP
 * after them. Past forty the three strips stop being forty-column figures with
 * a hairline each and become forty columns and one column of totals — the
 * countable part first, then the batch.
 */
function drawScore(ctx, colors, L, st, beats) {
  const k = st.n;
  /* A THRESHOLD CAN KEEP NOTHING, and then there is no column to draw however
     far the run says it has got: 5 × 10⁻⁸ over a base study of 1,500 people
     keeps no SNP at all. Clamping here rather than in the caller is what keeps
     `st.beta[i]` from being read past its end — one undefined weight puts a
     NaN into a bar's height and the bar is then drawn nowhere. */
  const ax = M.scoreAxis(L.geno.w, k);
  const cw = ax.cw;
  const shown = Math.max(0, Math.min(beats, k));
  /* 4.3: the SNP just added is lit only while more are coming; on the finished
     sum the one mark in --c-highlight is the person's own line. */
  const newest = shown > 0 && shown < k ? shown - 1 : -1;
  const xDomain = [0, ax.units];
  const colX = (i) => L.geno.x + i * cw;

  /* the genotypes: 0, 1 or 2 marks in a column, so the count is the reading —
     dots while a column can hold two of them, bars of whole units below that
     (model.js decision 14) */
  capAt(ctx, colors, L.geno.x, L.geno.y - 8, M.STRINGS.genoCaption, L.geno.w * 0.72);
  noteAt(ctx, colors, L.geno.x + L.geno.w, L.geno.y - 8, `person ${st.person}`, L.geno.w * 0.25);
  const dots = cw >= M.SCORE_DOT_MIN;
  const r = Math.max(1.6, Math.min(5, cw / 2 - 1.2));
  const unit = (L.geno.h - 4) / 2;
  ctx.save();
  for (let i = 0; i < shown; i += 1) {
    ctx.fillStyle = i === newest ? colors.highlight : colors.groupA;
    if (dots) {
      const x = colX(i) + cw / 2;
      for (let g = 0; g < st.genotype[i]; g += 1) {
        ctx.beginPath();
        ctx.arc(x, L.geno.y + L.geno.h - 4 - g * (2 * r + 2), r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const h = unit * st.genotype[i];
      if (h > 0) ctx.fillRect(colX(i), L.geno.y + L.geno.h - h, Math.max(0.5, cw - 0.5), h);
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
    ctx, colors, rect: L.weights, xDomain, yDomain: [-bMax, bMax],
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
  const bw = Math.max(0.6, cw - Math.min(2, cw * 0.3));
  for (let i = 0; i < shown; i += 1) {
    ctx.fillStyle = i === newest ? colors.highlight : colors.groupB;
    const x = colX(i) + (cw - bw) / 2;
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
    xDomain,
    yDomain: [lo || -0.1, hi || 0.1],
  });
  sPlot.caption(M.STRINGS.sumCaption);
  sPlot.note(`${M.intText(shown)} of ${M.intText(k)} SNPs added`);
  sPlot.grid([0]);
  if (shown > 0) {
    /* a step, not a line: the sum changes at a SNP and holds between them */
    const pts = [[0, 0]];
    for (let i = 0; i < shown; i += 1) pts.push([i + 1, st.cum[i]]);
    const step = [pts[0]];
    for (let i = 1; i < pts.length; i += 1) {
      step.push([pts[i - 1][0], pts[i][1]]);
      step.push(pts[i]);
    }
    sPlot.curve(step, { stroke: colors.empirical, width: k > 400 ? 1.5 : 2 });
    const last = pts[pts.length - 1];
    sPlot.dot(last[0], last[1], { fill: colors.empirical, r: 3.5 });
  }
  sPlot.axisY({ format: (v) => v.toFixed(1) });
  /* past sixty SNPs the quarter ticks end on the kept count itself, which is
     the number the axis is there to say — unless its label, centred on the
     panel's last pixel, would run off the canvas: "1,000" is thirty pixels
     wide against the eight the panel leaves, so at every SNP in the base
     study the axis stops at three quarters and the note above carries the
     count */
  const endTick = widthOf(ctx, M.intText(k), noteFont(colors)) / 2 <= M.AX_R + 1;
  sPlot.axisX({
    label: M.STRINGS.sumX,
    ticks: k > 60
      ? [0, 0.25, 0.5, 0.75, ...(endTick ? [1] : [])].map((f) => Math.round(f * k))
      : undefined,
    format: (v) => M.intText(v),
  });

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
  if (shown > 0) {
    dPlot.bars(counts, { lo: sLo, width: span / nb, fill: colors.empirical, opacity: 0.32 });
  }
  /* DECISION 7: the person's own line joins the distribution with the last SNP
     of the sum. */
  if (k > 0 && shown >= k) {
    dPlot.vline(st.total, {
      stroke: colors.highlight,
      width: 2,
      label: `person ${st.person}`,
      align: st.total > (sLo + sHi) / 2 ? "left" : "right",
    });
  }
  dPlot.axisX({ label: M.STRINGS.distX, format: (v) => v.toFixed(1) });
}

/* ---- step 4: the threshold curve ----------------------------------------- */

const LX = (t) => Math.log10(t);

function drawCurve(ctx, colors, rect, genome, upTo) {
  const rows = genome.rows;
  const top = Math.max(0.12, Math.max(...rows.map((r) => Math.max(r.target, r.validation))) * 1.25);
  const plot = makePlot({
    ctx, colors, rect, xDomain: [LX(5e-8) - 0.4, 0.3], yDomain: [0, top],
  });
  plot.caption(fit(ctx, M.STRINGS.curveCaption, capFont(colors), rect.w + 22));
  plot.grid([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35].filter((v) => v < top));

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

  let best = null;
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
      best = M.bestThreshold(swept, "target");
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
      const line = noteLine(colors);
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

  /* THE READING LINE, under the axis label — the mock's §4. The review found
     step 4 the hardest step with the least support, and the support it was
     missing is one sentence saying which two numbers to compare. It names the
     SAME best fit the mark does (decision 6), so the sentence and the figure
     cannot disagree, and it waits for the second threshold for the same
     reason the mark does. */
  if (best) {
    noteAt(ctx, colors, rect.x - 34, rect.y + rect.h + M.READ_LINE_DY,
      `best-fit R² ${M.n3(best.target)} in the target at P < ${M.tText(best.thresh)}; `
      + `${M.n3(best.validation)} in the validation sample there`,
      rect.w + 92, { align: "left", baseline: "top" });
  }
}

/* ---- step 5: the quantile plot ------------------------------------------- */

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

/* ---- step 6: calibration, and the cut ------------------------------------ */

/**
 * Mean predicted risk against the fraction that has the disease, by decile of
 * predicted risk, with the diagonal as the reference and a 95% interval on
 * every observed fraction.
 */
function drawCalibration(ctx, colors, rect, rm, upTo, lineW) {
  /* THE AXIS LEAVES ROOM FOR THE DIAGONAL'S OWN LABEL, and the amount is
     measured rather than chosen: the label names the reference line at the end
     the deciles do not reach, and at 1.06 × the tallest mark the clear strip
     above the intervals was two pixels short of one line, so the label printed
     over the top decile's interval. The top is set from the label's height. */
  const raw = rm ? Math.max(...rm.bins.map((b) => Math.max(b.pred, b.hi))) : 0.5;
  const labelDrop = (6 * rect.h) / rect.w + 3;
  const strip = labelDrop + (parseFloat(colors.fsXs) || 11) + 6;
  const top = Math.max(raw * 1.06, raw / Math.max(1 - strip / rect.h, 0.5));
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, top], yDomain: [0, top] });
  captionRow(ctx, colors, rect, M.RISK_STRINGS.calCaption,
    rm ? M.RISK_STRINGS.calNote : M.RISK_STRINGS.emptyNote, { lineW });

  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(plot.sx(0), plot.sy(0));
  ctx.lineTo(plot.sx(top), plot.sy(top));
  ctx.stroke();
  ctx.restore();
  /* No label on the diagonal (main session, 2026-09-12, read in the browser):
     a horizontal label beside a diagonal crosses it or the top decile's
     interval bar at some seed whatever corner it takes; the legend's
     reference-line entry names the line. */

  if (rm) {
    const shown = rm.bins.slice(0, Math.min(upTo, rm.bins.length));
    ctx.save();
    ctx.strokeStyle = colors.empirical;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const b of shown) {
      const x = Math.round(plot.sx(b.pred)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, plot.sy(b.lo));
      ctx.lineTo(x, plot.sy(b.hi));
      ctx.stroke();
    }
    ctx.restore();
    for (const b of shown) {
      /* 4.3: the decile that has just landed, and nothing once they all have */
      const newest = b.bin === shown.length && shown.length < rm.bins.length;
      plot.dot(b.pred, b.obs, { fill: newest ? colors.highlight : colors.empirical, r: 3 });
    }
  }

  plot.axisY({ format: (v) => `${Math.round(100 * v)}%` });
  plot.axisX({ format: (v) => `${Math.round(100 * v)}%`, label: M.RISK_STRINGS.calX });
}

/** Absolute predicted risk against the person's score percentile, with the risk
    threshold as the reference and the crossing marked. */
function drawStratification(ctx, colors, rect, rm, threshold, popLabel, upTo, lineW) {
  const top = Math.max((rm ? rm.max : 0.4) * 1.12, threshold * 1.25);
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, 100], yDomain: [0, top] });
  captionRow(ctx, colors, rect, M.RISK_STRINGS.stratCaption, popLabel, { lineW });

  const ty = Math.round(plot.sy(threshold)) + 0.5;
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(rect.x, ty);
  ctx.lineTo(rect.x + rect.w, ty);
  ctx.stroke();
  ctx.restore();
  tinyAt(ctx, colors, rect.x + 2, ty - noteLine(colors) - 2,
    `${Math.round(100 * threshold)}% risk`);

  const reach = (100 * Math.min(upTo, M.RISK_DECILES)) / M.RISK_DECILES;
  const drawn = rm ? rm.curve.filter((p) => p[0] <= reach + 1e-9) : [];
  plot.curve(drawn, { stroke: colors.empirical, width: 2 });

  const cross = rm ? M.crossingPercentile(rm, threshold) : null;
  if (cross !== null && cross <= reach + 1e-9) {
    const cx = Math.round(plot.sx(cross)) + 0.5;
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, ty);
    ctx.lineTo(cx, rect.y + rect.h);
    ctx.stroke();
    ctx.restore();
    plot.dot(cross, threshold, { fill: colors.highlight, r: 4.5 });
    /* the count goes on whichever side of the drop has room for it */
    const text = `${M.intText(M.peopleAbove(rm, threshold))} of ${M.intText(M.N_TARGET)} above`;
    const need = widthOf(ctx, text, noteFont(colors));
    const roomLeft = cx - 8 - rect.x;
    const roomRight = rect.x + rect.w - (cx + 8);
    if (need <= roomLeft) noteAt(ctx, colors, cx - 8, ty - 6, text, roomLeft, { tone: colors.ink2 });
    else {
      noteAt(ctx, colors, cx + 8, ty - 6, text, roomRight, { align: "left", tone: colors.ink2 });
    }
  }

  plot.axisY({ format: (v) => `${Math.round(100 * v)}%` });
  plot.axisX({
    ticks: [0, 25, 50, 75, 100], format: (v) => v.toFixed(0), label: M.RISK_STRINGS.stratX,
  });
}

/* ============================== the widget ================================= */

const REGION_STEPS = ["haplotypes", "clump"];
const GENOME_STEPS = ["score", "threshold", "quantile", "risk"];
const ALL_STEPS = M.PAGE_VALUES;

defineWidget({
  slug: "polygenic-score",
  title: "Polygenic Risk Scores",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* one geometry function, for the height the page reserves and for every rect
     the figure draws in (5.8) */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  /* decision 13: step 1 answers the pointer, and a click pins the answer */
  pointer: true,
  regions({ w, params, state }) {
    /* state is null on core's load-time probe, which runs before the first
       render (t-sne's note); nothing is validated by it here either */
    if (!state || M.pageOf(params) !== "haplotypes") return [];
    return M.regionsFor(M.layout(w, params), params);
  },

  params: {
    /* DECISION 2: the step is display, and the run is per step, so a visit
       elsewhere and back keeps all six. */
    page: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      default: "haplotypes",
      display: true,
    },

    regionSec: {
      type: "section",
      label: M.STRINGS.regionSection,
      when: { param: "page", oneOf: REGION_STEPS },
    },
    /* Recombination is on both region steps: it draws the haplotypes AND it
       decides how much clumping has to do. */
    recomb: {
      type: "segmented",
      label: M.STRINGS.recombLabel,
      detail: M.STRINGS.recombDetail,
      options: M.RECOMB,
      default: "medium",
      when: { param: "page", oneOf: REGION_STEPS },
    },
    clumpR2: {
      type: "segmented",
      label: M.STRINGS.clumpR2Label,
      detail: M.STRINGS.clumpR2Detail,
      options: M.CLUMP_R2,
      default: "0.1",
      when: { param: "page", equals: "clump" },
    },
    causalTyped: {
      type: "segmented",
      label: M.STRINGS.typedLabel,
      detail: M.STRINGS.typedDetail,
      options: M.TYPED,
      default: "typed",
      when: { param: "page", oneOf: REGION_STEPS },
    },

    baseSec: {
      type: "section",
      label: M.STRINGS.baseSection,
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    /* DECISION 6's control, first in the section because it is the first thing
       about a base study a reader asks. */
    baseSize: {
      type: "segmented",
      label: M.STRINGS.baseSizeLabel,
      detail: M.STRINGS.baseSizeDetail,
      options: M.BASE_SIZES,
      default: "15000",
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    causal: {
      type: "segmented",
      label: M.STRINGS.causalLabel,
      detail: M.STRINGS.causalDetail,
      options: M.CAUSAL,
      default: "300",
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    h2: {
      type: "segmented",
      label: M.STRINGS.h2Label,
      detail: M.STRINGS.h2Detail,
      options: M.H2,
      default: "0.3",
      when: { param: "page", oneOf: GENOME_STEPS },
    },

    targetSec: {
      type: "section",
      label: M.STRINGS.targetSection,
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    target: {
      type: "segmented",
      style: "grid",
      label: M.STRINGS.targetLabel,
      detail: M.STRINGS.targetDetail,
      options: M.TARGETS.map((t) => ({ value: t.value, label: t.label, span: true })),
      default: "same",
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    /* DECISION 3: eleven readings of one base study, all of them computed. */
    threshold: {
      type: "choice",
      label: M.STRINGS.thresholdLabel,
      detail: M.STRINGS.thresholdDetail,
      options: M.THRESHOLD_OPTIONS,
      default: "0.01",
      display: true,
      when: { param: "page", oneOf: GENOME_STEPS },
    },
    /* The person is on step 3 and step 6: step 6's tile names one person's
       risk, and a tile that names a person needs the control that picks them. */
    person: {
      type: "int",
      label: M.STRINGS.personLabel,
      detail: M.STRINGS.personDetail,
      min: 1,
      max: 319,
      default: 1,
      display: true,
      when: { param: "page", oneOf: ["score", "risk"] },
    },

    riskSec: {
      type: "section",
      label: M.RISK_STRINGS.riskSection,
      when: { param: "page", equals: "risk" },
    },
    /* model.js decision 11: the prevalence sets who has the disease, so it is
       data; the risk threshold moves one line, so it is display. */
    prevalence: {
      type: "segmented",
      label: M.RISK_STRINGS.prevalenceLabel,
      detail: M.RISK_STRINGS.prevalenceDetail,
      options: M.PREVALENCES,
      default: "20",
      when: { param: "page", equals: "risk" },
    },
    riskThreshold: {
      type: "segmented",
      label: M.RISK_STRINGS.riskThreshLabel,
      detail: M.RISK_STRINGS.riskThreshDetail,
      options: M.RISK_THRESHOLDS,
      default: "30",
      display: true,
      when: { param: "page", equals: "risk" },
    },

    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      detail: M.STRINGS.seedDetail,
      min: 1,
      max: 200,
      default: 41,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only, counted in the unit of the
       step the link names: rows filled, clumping beats, SNPs added, thresholds
       swept, vigintiles added, deciles drawn.

       ON STEP 3 IT COUNTS SNPs ADDED (decision 11), clamped to the step's own
       total, so at the default's 160 kept `?shown=160` and anything past it
       land on the finished sum and `?shown=12` lands on the twelfth SNP. */
    shown: { type: "int", min: 0, max: 1000, default: 0, hidden: true },

    /* DECISION 13: the pin — one SNP number or two, as the reading line prints
       them. Hidden, because the figure is its control; display, so a click
       keeps the run; parsed to its canonical form so `?snps=52,37` and
       `?snps=37,52` are one state. */
    snps: {
      type: "text",
      hidden: true,
      display: true,
      default: "",
      maxLength: M.SNPS_MAX_LENGTH,
      parse: M.parseSnps,
    },
  },

  legend: ({ params }) => {
    const page = M.pageOf(params);
    if (page === "haplotypes") {
      return [
        { token: "empirical", label: "One of the two alleles at a SNP" },
        { token: "value-high", label: "r² between a pair of SNPs" },
        { token: "reference", label: "The causal SNP's position, and its pairs in the triangle", mark: "tri" },
        { token: "highlight", label: "The SNP or pair under the pointer or pinned by a click, and the rows where its alleles travel together" },
      ];
    }
    if (page === "clump") {
      return [
        { token: "empirical", label: "A SNP's test", mark: "dot" },
        { token: "extreme", label: "Under P = 0.05", mark: "dot" },
        { token: "highlight", label: "The lead SNP just chosen", mark: "dot" },
        { token: "highlight", label: "An arc to a SNP it accounts for, darker at higher r²", mark: "line" },
        { token: "empirical", label: "A SNP it accounts for, dropped to the axis", mark: "line" },
        { token: "reference", label: "P = 0.05", mark: "dash" },
        { token: "reference", label: "The causal SNP's position", mark: "tri" },
      ];
    }
    if (page === "score") {
      return [
        { token: "group-a", label: "The person's genotype, in effect alleles", mark: "dot" },
        { token: "group-b", label: "The base study's weight" },
        { token: "empirical", label: "The sum so far, and the sample's scores", mark: "line" },
        { token: "highlight", label: "The SNP just added, and the person's score", mark: "dot" },
      ];
    }
    if (page === "threshold") {
      return [
        { token: "empirical", label: "R² in the target sample", mark: "line" },
        { token: "holdout", label: "R² in the validation sample", mark: "line" },
        { token: "highlight", label: "The best-fit threshold", mark: "dot" },
        { token: "ink-3", label: "SNPs kept, on the right axis", mark: "dash" },
      ];
    }
    if (page === "risk") {
      return [
        { token: "empirical", label: "A decile of the target sample, with its 95% interval", mark: "dot" },
        { token: "empirical", label: "Predicted risk by score percentile", mark: "line" },
        { token: "reference", label: "Predicted equals observed", mark: "dash" },
        { token: "reference", label: "The risk threshold", mark: "dash" },
        { token: "highlight", label: "The percentile that crosses it", mark: "dot" },
      ];
    }
    return [
      { token: "empirical", label: "Mean trait in a vigintile, with its 95% interval", mark: "dot" },
      { token: "highlight", label: "The vigintile just added", mark: "dot" },
      { token: "reference", label: M.STRINGS.meanLine, mark: "dash" },
    ];
  },

  /* One region and one genome, both on every data change (model.js
     decision 2), and every threshold's reading with them (decisions 3 and
     12). */
  compute({ params, rng }) {
    return M.build(rng, M.configFor(params));
  },

  animation: {
    stepLabel: M.STEP_LABELS,
    stepTitle: M.STEP_TITLES,
    runTitle: M.RUN_TITLES,

    init: ({ params, state, fromScratch }) => {
      const k = Object.fromEntries(ALL_STEPS.map((p) => [p, 0]));
      /* An authored head start applies on the first render only, to the step
         the link names — `?page=threshold&shown=11` for a lesson link. */
      const authored = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      const page = M.pageOf(params);
      k[page] = Math.min(M.totalFor(page, state, params), authored);
      return {
        k,
        beat: 0,
        /* model.js decision 5: step 2's tests are the first beat of its run. */
        scanDone: k.clump > 0,
        done: k[page] >= M.totalFor(page, state, params),
      };
    },

    advance: (anim, { dt, params, state }) => {
      const page = M.pageOf(params);
      const total = M.totalFor(page, state, params);
      if (page === "clump" && !anim.scanDone) {
        anim.scanDone = true;
        /* Play spends its first frame on the tests and takes no beat; Step
           goes on to take the clump its label promises. */
        if (anim.mode === "run") return true;
      }
      if (anim.k[page] >= total) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      /* the beat's length can depend on where the run has got: step 3's last
         beat is the batch, and it is longer than a SNP's (model.js 14). */
      anim.beat += dt / M.beatMs(page, state, params, anim.k[page]);
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
      /* model.js decision 9: one press of Step on step 2 runs to the end of
         the clump it started, so the button's label names what it did. */
      if (anim.mode === "step") {
        return page === "clump" && anim.k[page] % M.CLUMP_BEATS !== 0;
      }
      return true;
    },

    /* A display change keeps every step's work and re-derives what follows
       from it: the P threshold changes how many SNPs step 3 has to add, so a
       sum that ran past the new count stops at it. */
    rebuild: (anim, { params, state }) => {
      for (const page of ALL_STEPS) {
        anim.k[page] = Math.min(anim.k[page] ?? 0, M.totalFor(page, state, params));
      }
      anim.scanDone = anim.scanDone || anim.k.clump > 0;
      const page = M.pageOf(params);
      anim.done = anim.k[page] >= M.totalFor(page, state, params);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const L = M.layout(w, params);
    const upTo = anim?.k?.[L.page] ?? 0;
    drawHead(ctx, colors, L.head, L.page);
    if (L.page === "haplotypes") {
      const region = state.region;
      const drawn = Math.min(upTo, M.HAP_ROWS);
      const triShown = upTo >= M.HAP_ROWS;
      /* decision 13: the pointer wins while it is on a target, the pin holds
         when it leaves */
      const subject = (pointer ? M.subjectAt(L, pointer.x, pointer.y) : null)
        ?? M.pinnedSubject(params);
      const images = imagesFor(region, colors);
      drawBlock(ctx, colors, L.block, region, drawn, {
        foot: M.readingFor(region, subject, drawn), img: images.block,
      });
      drawTriangle(ctx, colors, L.tri, region, { shown: triShown, img: images.tri });
      /* the rest indicator: the causal SNP's row and column, once there are
         rows and columns to have */
      if (triShown) drawV(ctx, colors, L.tri, region.causal, { stroke: colors.reference, dash: [3, 3] });
      if (subject) drawSubject(ctx, colors, L, region, subject, { drawn, triShown });
      return;
    }
    if (L.page === "clump") {
      drawClump(ctx, colors, L.assoc, state.region, {
        beats: upTo,
        frac: anim?.beat ?? 0,
        scanDone: Boolean(anim?.scanDone),
      });
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
    if (L.page === "risk") {
      const rm = M.riskFor(state, params);
      const t = M.riskThresholdOf(params.riskThreshold).p;
      drawCalibration(ctx, colors, L.cal, rm, upTo, L.strat.x - L.cal.x - 16);
      drawStratification(ctx, colors, L.strat, rm, t,
        M.targetOf(params.target).label.toLowerCase(), upTo, Math.round(w - 8 - L.strat.x));
      return;
    }
    drawQuantiles(ctx, colors, L.bins, state.genome, M.rowFor(state, params),
      M.targetOf(params.target).label, upTo);
  },

  readout({ params, state, anim }) {
    const page = M.pageOf(params);
    const upTo = anim?.k?.[page] ?? 0;

    if (page === "haplotypes") {
      const R = state.region;
      const full = upTo >= M.HAP_ROWS;
      return [
        {
          label: "Haplotypes drawn",
          value: upTo > 0 ? M.intText(Math.min(upTo, M.HAP_ROWS)) : "—",
          note: `of ${M.HAP_ROWS}, from a pool of ${M.intText(M.REGION.nHap)}`,
        },
        {
          label: `Pairs above r² ${M.R_HIGH}`,
          value: full ? M.intText(R.pairsHigh) : "—",
          note: `of the ${M.intText(R.pairsTotal)} in the region`,
        },
        {
          label: "The furthest of them",
          value: full ? `${M.intText(R.pairReach)} kb` : "—",
          note: "the longest run of shared ancestor between two SNPs",
        },
        {
          label: "SNPs in the first clump",
          value: full ? M.intText(R.firstClump) : "—",
          note: "the lead SNP and the SNPs it accounts for",
        },
      ];
    }

    if (page === "clump") {
      const R = state.region;
      const settled = Math.min(Math.floor(upTo / M.CLUMP_BEATS), R.clumps.length);
      let sig = 0;
      for (let c = 0; c < settled; c += 1) if (R.clumps[c].p < M.REGION_ALPHA) sig += 1;
      return [
        {
          label: "SNPs under P < 0.05",
          value: anim?.scanDone ? M.intText(R.hits) : "—",
          note: "before clumping",
        },
        {
          label: "Clumps kept",
          value: settled > 0 ? M.intText(sig) : "—",
          note: "lead SNPs under P < 0.05",
        },
        {
          label: "r² to the causal SNP",
          value: settled > 0 ? M.n2(R.leadR2) : "—",
          note: R.typed
            ? "from the region's lead SNP"
            : "from the region's lead SNP; the causal variant is not on the array",
        },
      ];
    }

    if (page === "score") {
      const st = M.personScore(state, params);
      const added = Math.min(upTo, st.n);
      const done = st.n > 0 && added >= st.n;
      const partial = added > 0 ? st.cum[added - 1] : 0;
      return [
        {
          label: "Score",
          value: added > 0 ? M.n2(partial) : "—",
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
      /* THE OVERFITTING TILE IS A PAIRED NUMBER, measured in ONE sample. The
         draft printed the best-fit R² minus the validation R², a difference
         between two separate samples of 319 whose spread is ±0.03 — over
         sixteen seeds it came out positive on only six. The best-fit R² minus
         the R² with every SNP kept is the same sample twice, and it is what
         choosing the threshold bought: positive on sixteen of sixteen. */
      const every = upTo >= rows.length ? rows[rows.length - 1] : null;
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
          value: best && every ? M.n3(best.target - every.target) : "—",
          note: "best-fit R² minus R² with every SNP kept",
        },
      ];
    }

    if (page === "risk") {
      const rm = M.riskFor(state, params);
      const t = M.riskThresholdOf(params.riskThreshold).p;
      const landed = Math.min(upTo, M.RISK_DECILES);
      const full = rm && landed >= M.RISK_DECILES;
      const person = M.personRisk(state, params);
      const shownBins = rm ? rm.bins.slice(0, landed) : [];
      const covered = shownBins.filter((b) => b.lo <= b.pred && b.pred <= b.hi).length;
      const cross = rm ? M.crossingPercentile(rm, t) : null;
      const reach = (100 * landed) / M.RISK_DECILES;
      const pct = (v) => `${Math.round(100 * v)}%`;
      return [
        {
          label: "Calibration intercept",
          value: full ? M.n2(rm.inter) : "—",
          note: "0 when the predicted risks are right on average",
        },
        {
          label: "Calibration slope",
          value: full ? M.n2(rm.slope) : "—",
          note: "1 when a rise in predicted risk is the same rise in observed risk",
        },
        {
          label: "Intervals covering the diagonal",
          value: landed > 0 ? `${M.intText(covered)} of ${M.intText(landed)}` : "—",
          note: `by decile of predicted risk, ${Math.round(M.N_TARGET / M.RISK_DECILES)} people each`,
        },
        {
          label: "This person's risk",
          value: rm && person.risk !== null && person.percentile <= reach
            ? pct(person.risk) : "—",
          note: person.percentile === null
            ? "predicted by the model fitted in the base population"
            : `person ${person.person}, at score percentile ${M.intText(person.percentile)}`,
        },
        {
          label: "Percentile crossing the threshold",
          value: full && cross !== null ? M.intText(cross) : "—",
          note: `where predicted risk reaches ${pct(t)}`,
        },
        {
          label: "People above it",
          value: full ? M.intText(M.peopleAbove(rm, t)) : "—",
          note: `of the ${M.intText(M.N_TARGET)} in the target sample`,
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
    const page = M.pageOf(params);
    const upTo = anim?.k?.[page] ?? 0;
    const R = state.region;

    if (page === "haplotypes") {
      if (upTo === 0) {
        return `An empty block of ${M.HAP_ROWS} haplotype rows over the region's `
          + `${M.REGION.m} SNPs, with the causal SNP's column marked and the r² triangle's `
          + "own axis beneath it, before any haplotype is drawn.";
      }
      const drawn = Math.min(upTo, M.HAP_ROWS);
      const pinned = M.readingFor(R, M.pinnedSubject(params), drawn);
      return `${M.intText(drawn)} of ${M.HAP_ROWS} haplotypes drawn over ${M.REGION.m} SNPs in `
        + `${M.intText(R.span)} kb, the shared stretches reading as vertical bands`
        + (drawn >= M.HAP_ROWS
          ? `, with the r² between every pair underneath: ${M.intText(R.pairsHigh)} `
            + `of ${M.intText(R.pairsTotal)} pairs are above r² ${M.R_HIGH}.`
          : ".")
        + (pinned ? ` Pinned: ${pinned}.` : "");
    }

    if (page === "clump") {
      if (!anim?.scanDone) {
        return `An empty plot of −log₁₀P against position over ${M.intText(R.span)} kb, with the `
          + "P = 0.05 line across it, before any of the region's 100 SNPs is tested.";
      }
      const settled = Math.min(Math.floor(upTo / M.CLUMP_BEATS), R.clumps.length);
      return `${M.intText(R.hits)} of 100 SNPs in a ${M.intText(R.span)} kb region are under `
        + `P = 0.05, and ${M.intText(settled)} of ${M.intText(R.clumps.length)} lead SNPs have `
        + "been chosen: each one is kept and the SNPs in LD with it are dropped to the axis.";
    }

    if (page === "score") {
      const st = M.personScore(state, params);
      if (upTo === 0) {
        return "An empty figure of one column a SNP — genotype, weight and running sum — over "
          + `the score distribution of ${M.intText(M.N_TARGET)} people, before any of the `
          + `${M.intText(st.n)} SNPs the P threshold keeps is added.`;
      }
      const added = Math.min(upTo, st.n);
      const partial = st.cum[added - 1];
      return `Person ${st.person}'s score after ${M.intText(added)} of `
        + `${M.intText(st.n)} SNPs is ${M.n2(partial)}, drawn as the genotype, the base study's `
        + "weight and the running sum over each SNP in turn, lowest P first.";
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

    if (page === "risk") {
      const rm = M.riskFor(state, params);
      const t = M.riskThresholdOf(params.riskThreshold).p;
      if (!rm) {
        return "Two empty square plots — predicted against observed risk, and predicted risk by "
          + "score percentile — at a P threshold that keeps no SNP, so no model is fitted.";
      }
      if (upTo === 0) {
        return "An empty calibration plot with the diagonal across it, beside an empty plot of "
          + `predicted risk by score percentile with the ${Math.round(100 * t)}% line across it, `
          + "before any decile is drawn.";
      }
      const landed = Math.min(upTo, M.RISK_DECILES);
      return `${M.intText(landed)} of ${M.RISK_DECILES} deciles of predicted risk drawn against `
        + `the fraction that has the disease, in a target sample of `
        + `${M.targetOf(params.target).sample}; the calibration slope is ${M.n2(rm.slope)} and the intercept `
        + `${M.n2(rm.inter)}, and the curve beside it reaches ${Math.round((100 * landed) / M.RISK_DECILES)} `
        + "on the percentile axis.";
    }

    const row = M.rowFor(state, params);
    if (upTo === 0) {
      return "An empty plot of mean trait against score vigintile, with the sample's own mean "
        + "trait drawn across it, before any vigintile is added.";
    }
    return `Mean trait by score vigintile in a target sample of `
      + `${M.targetOf(params.target).sample}, ${M.intText(Math.min(upTo, 20))} of 20 added, each with a 95% interval `
      + `around it and the sample's mean trait drawn across. The score's R² over them is `
      + `${M.n3(row.binR2[Math.min(upTo, 20)])}.`;
  },
});
