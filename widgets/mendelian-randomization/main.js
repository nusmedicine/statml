/* ============================================================================
   Widget 60 · Mendelian randomization — one SNP as a trial, the two GWAS, the
   estimate, the forest.

   PHM5003 week 6 (03 - MR). `model.js` holds the engine, the geometry and the
   copy; this file draws them.

   The one claim: each SNP gives a ratio — its effect on the outcome over its
   effect on the exposure — and the causal estimate is those ratios combined;
   the assumptions are the three arrows the graph must not have.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE MOCK IS THE PICTURE OF RECORD (`_lab/mr-mock.html`, Kenneth's picks
       2026-09-12, catalogue § Slot 60). The graph is widget 26's drawing —
       nodes, arrows, a red open path, a verdict line, a click target built
       from one geometry function — with four nodes and two GHOST arrows: the
       two the graph must not have, drawn faint until a control or a click
       turns one on.

    2. STEP 1 IS THE CAUSAL-STRUCTURES STAGE. The graph on the left, the cohort
       on the right; the observational fit through every person, then the
       three genotype groups' centroids and the line through them — one SNP's
       ratio. Four beats, and the Step button names the next one.

    3. NOTHING IS DRAWN BEFORE THE RUN REACHES IT (non-negotiable 4). Each step
       opens on its axes; the people, the SNPs, the lines and the combined rows
       arrive. The estimate and its tiles wait for the last SNP (model.js
       decision 6).

    4. THE OBSERVATIONAL ESTIMATE IS THE REFERENCE, dotted in ink and named at
       the right edge; the truth is dashed in the reference grey when revealed.
       Two lines the MR estimate is read against.

    5. A HOVER IS AN INSPECTOR AND A CLICK IS A PARAMETER (polygenic-score's
       decision 15). `pointer: true` repaints on movement with nothing written;
       `regions` writes the one hidden `snp` parameter; the overlay is one
       function called with whichever subject is present, the pointer winning
       while it is on a target. One SNP, on the scatter and in the forest.

    6. THE FOREST'S HEIGHT FOLLOWS THE COUNT: 79 rows at 4.4px unnamed, the
       pinned or hovered row named; 20 rows at 12px, every one named.

    7. HETEROGENEITY IS NAMED IN THE LEGEND, NOT DRAWN (Kenneth's call): every
       SNP's outcome effect carries a small direct effect of either sign, which
       is what gives the lesson its intervals. The graph draws only the
       one-signed arrow the Exclusion restriction control turns on.
   ========================================================================= */

import { defineWidget, makePlot } from "../core/index.js";
import * as M from "./model.js";

/* ---- small drawing helpers ----------------------------------------------- */

const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const noteFont = (colors) => `${colors.fsXs} ${colors.font}`;

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

/** A short note, with the edge it hangs from and its baseline named. */
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
function mixRgb(a, b, t) {
  const pa = rgbOf(a);
  const pb = rgbOf(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* ---- the step line and the hand-off --------------------------------------- */

function drawHead(ctx, colors, head, page) {
  const line = M.stepLine(page);
  tinyAt(ctx, colors, head.x, head.y, line, "left", colors.highlight);
  const used = widthOf(ctx, line, noteFont(colors));
  noteAt(ctx, colors, head.x + head.w, head.y, M.HANDOFFS[page],
    Math.max(40, head.w - used - 14), { baseline: "top", tone: colors.ink3 });
}

/* ---- the graph (decision 1) ------------------------------------------------ */

function arrowHead(ctx, bx, by, ux, uy, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx + ux * 6, by + uy * 6);
  ctx.lineTo(bx - uy * 4.5, by + ux * 4.5);
  ctx.lineTo(bx + uy * 4.5, by - ux * 4.5);
  ctx.fill();
}

function arrow(ctx, D, from, to, color, width, dash, alpha = 1) {
  const [x1, y1] = D.P[from];
  const [x2, y2] = D.P[to];
  const L = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const ax = x1 + ux * (D.R + 3);
  const ay = y1 + uy * (D.R + 3);
  const bx = x2 - ux * (D.R + 6);
  const by = y2 - uy * (D.R + 6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  arrowHead(ctx, bx, by, ux, uy, color);
  ctx.restore();
}

/* The direct path from the SNPs to CHD bows under the bottom row, so it does
   not run through BMI's node. */
function arcArrow(ctx, D, color, width, dash, alpha = 1) {
  const [x1, y1] = D.P.g;
  const [x2, y2] = D.P.y;
  /* Kenneth, round three: the arc's belly sat on the verdict's first line.
     A control point 30 below the row puts the apex 15 below it, and the
     verdict moved down 8 to meet it halfway. */
  const cx = (x1 + x2) / 2;
  const cy = y1 + 30;
  const ax = x1 + 6;
  const ay = y1 + D.R + 2;
  const bx = x2 - 8;
  const by = y2 + D.R + 3;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  const tx = bx - cx;
  const ty = by - cy;
  const L = Math.hypot(tx, ty);
  arrowHead(ctx, bx - (tx / L) * 6, by - (ty / L) * 6, tx / L, ty / L, color);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawDag(ctx, colors, D, { page, cfg, strength }) {
  const one = page === "trial";
  const names = { g: one ? M.STRINGS.nodeSnp : M.STRINGS.nodeSnps, x: M.STRINGS.nodeBmi, y: M.STRINGS.nodeChd, u: M.STRINGS.nodeConfounders };
  const pleio = cfg.share > 0;
  const indep = cfg.indep;
  ctx.save();
  ctx.font = capFont(colors);
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(M.STRINGS.graphCaption, D.box.x, D.box.y - 8);

  /* the fork: open, red, unless there is no confounding */
  if (cfg.confounding === "none") {
    arrow(ctx, D, "u", "x", colors.ink3, 1.25, [4, 4], 0.6);
    arrow(ctx, D, "u", "y", colors.ink3, 1.25, [4, 4], 0.6);
  } else {
    const wf = cfg.confounding === "moderate" ? 1.75 : 2.5;
    arrow(ctx, D, "u", "x", colors.extreme, wf);
    arrow(ctx, D, "u", "y", colors.extreme, wf);
  }
  /* the pipe: relevance is the first arrow's weight */
  const ws = strength === "weak" ? 1 : strength === "moderate" ? 1.75 : 2.5;
  arrow(ctx, D, "g", "x", colors.ink2, ws, strength === "weak" ? [3, 3] : null);
  arrow(ctx, D, "x", "y", colors.ink2, 1.75);
  /* the two forbidden arrows: ghosts until turned on */
  if (pleio) arcArrow(ctx, D, colors.extreme, 2.5);
  else arcArrow(ctx, D, colors.ink3, 1.25, [3, 4], 0.45);
  if (indep) arrow(ctx, D, "u", "g", colors.extreme, 2.5);
  else arrow(ctx, D, "u", "g", colors.ink3, 1.25, [3, 4], 0.45);

  /* the nodes */
  ctx.font = noteFont(colors);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const k of ["u", "g", "x", "y"]) {
    const [nx, ny] = D.P[k];
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (k === "u") ctx.roundRect(nx - D.pill.hw, ny - D.pill.hh, 2 * D.pill.hw, 2 * D.pill.hh, D.pill.hh);
    else ctx.arc(nx, ny, D.R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.ink1;
    ctx.fillText(names[k], nx, ny + 1);
  }

  /* the verdict, left-aligned at the panel's edge (26's lesson about clipping) */
  const v = M.verdict({ page, confounding: cfg.confounding, pleio, indep });
  ctx.font = noteFont(colors);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = pleio || indep ? colors.extreme : colors.ink2;
  wrapText(ctx, v, D.box.x + 2, D.box.y + D.box.h + 24, M.DAG_W + 30, 14);
  ctx.restore();
}

/* ---- step 1: one SNP as a trial (decision 2) ------------------------------ */

function drawTrial(ctx, colors, L, state, params, anim) {
  const T = state.trial;
  const k = anim?.k?.trial ?? 0;
  const frac = anim?.beat ?? 0;
  drawDag(ctx, colors, L.dag, { page: "trial", cfg: state.cfg, strength: params.strength });

  const plot = makePlot({ ctx, colors, rect: L.plot, xDomain: T.xDom, yDomain: T.yDom });
  plot.axisX({ label: M.STRINGS.trialX });
  plot.axisY({ label: M.STRINGS.trialY });
  /* decision 9a: the beats are the two stages */
  const caption = k >= 5 ? M.STRINGS.trialRatio : k >= 4 ? M.STRINGS.trialStage2 : k >= 3 ? M.STRINGS.trialStage1 : k >= 2 ? M.STRINGS.trialFit : M.STRINGS.trialPeople;
  plot.caption(caption);
  if (k >= 3) {
    plot.note(`0 · 1 · 2 copies of the BMI-raising allele: ${T.centroids.map((c) => M.intText(c.n)).join(" · ")} people`);
  } else if (k >= 1) {
    plot.note(M.STRINGS.trialSnpNote);
  }
  if (k >= 5) {
    noteAt(ctx, colors, L.head.x + L.head.w, L.plot.y + L.plot.h + 40, M.trialReading(T, params.truth === "on", state.cfg), L.head.w, { baseline: "top", tone: colors.ink1 });
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(L.plot.x, L.plot.y, L.plot.w, L.plot.h);
  ctx.clip();

  /* beat 1: the people fall in over the beat */
  const n = T.X.length;
  const shown = k >= 1 ? n : Math.floor(frac * n);
  const tint = (u) => {
    const t = Math.max(0, Math.min(1, (u - T.uLo) / (T.uHi - T.uLo)));
    return mixRgb(colors.nonevent, colors.event, t);
  };
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < shown; i += 1) {
    ctx.fillStyle = params.colour === "on" ? tint(T.U[i]) : colors.unknown;
    ctx.beginPath();
    ctx.arc(plot.sx(T.X[i]), plot.sy(T.L[i]), 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* a line drawn from the left edge to a share of the frame */
  const lineAt = (b0, b1, color, width, dash, share = 1) => {
    const x0 = T.xDom[0];
    const x1 = T.xDom[0] + (T.xDom[1] - T.xDom[0]) * share;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(plot.sx(x0), plot.sy(b0 + b1 * x0));
    ctx.lineTo(plot.sx(x1), plot.sy(b0 + b1 * x1));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  /* the truth, revealed on request, once there is a fit to read it against */
  if (params.truth === "on" && k >= 2) {
    lineAt(T.obs.my - M.THETA * T.obs.mx, M.THETA, colors.reference, 1.5, [6, 5]);
  }
  /* beat 2: the observational fit */
  if (k >= 1) {
    lineAt(T.obs.my - T.obs.b * T.obs.mx, T.obs.b, colors.empirical, 2.5, null, k >= 2 ? 1 : frac);
  }
  /* beat 3, stage 1: each group's mean BMI as a vertical guide; beat 4,
     stage 2: each group's mean CHD risk as a horizontal guide, the centroid
     at the crossing; beat 5: the line through the three, whose slope is
     stage 2 over stage 1 */
  const guide = (x0, y0, x1, y1, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  };
  if (k >= 2) {
    const a1 = k >= 3 ? 1 : frac;
    T.centroids.forEach((c) => guide(plot.sx(c.mx), L.plot.y, plot.sx(c.mx), L.plot.y + L.plot.h, a1));
  }
  if (k >= 3) {
    const a2 = k >= 4 ? 1 : frac;
    T.centroids.forEach((c) => guide(L.plot.x, plot.sy(c.my), L.plot.x + L.plot.w, plot.sy(c.my), a2));
  }
  if (k >= 4) {
    lineAt(T.obs.my - T.ratio.b * T.obs.mx, T.ratio.b, colors.highlight, 2.5, null, k >= 5 ? 1 : frac);
  }
  if (k >= 2) {
    ctx.globalAlpha = k >= 3 ? 1 : frac;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    T.centroids.forEach((c, g) => {
      /* at stage 1 the group sits on the observational line at its own mean
         BMI; at stage 2 it rises or falls to its own mean CHD risk */
      const yStage1 = T.obs.my + T.obs.b * (c.mx - T.obs.mx);
      const t = k >= 4 ? 1 : k >= 3 ? frac : 0;
      const y = yStage1 + (c.my - yStage1) * t;
      plot.dot(c.mx, y, { fill: colors.highlight, r: 7 });
      ctx.fillStyle = colors.surface;
      ctx.fillText(String(g), plot.sx(c.mx), plot.sy(y) + 0.5);
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---- the scatter shared by steps 2 and 3 ----------------------------------- */

/**
 * `arrived` is the run's order up to where it has got; `subject` the SNP the
 * pointer or the pin names (decision 5).
 */
function drawScatter(ctx, colors, rect, study, o) {
  const S = study.S;
  const plot = makePlot({ ctx, colors, rect, xDomain: study.frame.x, yDomain: study.frame.y });
  plot.axisX({ format: (v) => v.toFixed(2), label: M.STRINGS.scatterX });
  plot.axisY({ format: (v) => v.toFixed(2), label: o.small ? M.STRINGS.scatterYShort : M.STRINGS.scatterY });
  if (o.caption) plot.caption(o.caption);
  if (o.note) plot.note(o.note, o.noteTone ? { tone: o.noteTone } : {});

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
  ctx.clip();
  /* the zero line */
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x, Math.round(plot.sy(0)) + 0.5);
  ctx.lineTo(rect.x + rect.w, Math.round(plot.sy(0)) + 0.5);
  ctx.stroke();

  /* the SNPs: crosses, as the lesson draws them */
  o.arrived.forEach((j, k) => {
    const x = plot.sx(S.bxHat[j]);
    const y = plot.sy(S.byHat[j]);
    const last = o.last === j;
    const isSubject = o.subject === j;
    const inval = o.markInvalid && !S.valid[j];
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(plot.sx(S.bxHat[j] - 1.96 * S.sx[j]), y);
    ctx.lineTo(plot.sx(S.bxHat[j] + 1.96 * S.sx[j]), y);
    ctx.moveTo(x, plot.sy(S.byHat[j] - 1.96 * S.sy[j]));
    ctx.lineTo(x, plot.sy(S.byHat[j] + 1.96 * S.sy[j]));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, last || isSubject ? 4 : 2.6, 0, 2 * Math.PI);
    if (o.raw && S.flipped[j]) {
      ctx.fillStyle = colors.surface;
      ctx.fill();
      ctx.strokeStyle = colors.extreme;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    } else if (inval) {
      ctx.fillStyle = colors.extreme;
      ctx.fill();
    } else {
      ctx.fillStyle = last || isSubject ? colors.highlight : colors.ink1;
      ctx.fill();
    }
    if (isSubject) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.stroke();
      /* decision 9b: the SNP's own ratio is the slope of the line from the
         origin through its point — drawn to the frame's edge */
      if (o.ownSlope && S.bxHat[j] > 0) {
        const r = S.byHat[j] / S.bxHat[j];
        const xEnd = study.frame.x[1];
        ctx.save();
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(plot.sx(0), plot.sy(0));
        ctx.lineTo(plot.sx(xEnd), plot.sy(r * xEnd));
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  /* the lines, once the estimate exists (decision 3) */
  if (o.lines) {
    const bxMax = study.frame.x[1];
    const lineAt = (b0, b1, color, width, dash, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      ctx.moveTo(plot.sx(0), plot.sy(b0));
      ctx.lineTo(plot.sx(bxMax), plot.sy(b0 + b1 * bxMax));
      ctx.stroke();
      ctx.restore();
    };
    const sel = o.estimator;
    const a = (k) => (M.estimatorShows(sel, k) ? 1 : 0.28);
    const wd = (k) => (M.estimatorShows(sel, k) ? 2.5 : 1.5);
    lineAt(0, o.observational, colors.ink1, 1.5, [2, 4]);
    if (o.truth) lineAt(0, M.THETA, colors.reference, 1.5, [6, 5]);
    lineAt(0, study.est.ivw.b, colors.empirical, wd("ivw"), null, a("ivw"));
    lineAt(study.est.egger.a, study.est.egger.b, colors.groupB, wd("egger"), null, a("egger"));
    lineAt(0, study.est.median.b, colors.groupC, wd("median"), null, a("median"));
    /* the two reference lines named at the right edge */
    ctx.font = noteFont(colors);
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const tag = (text, yv, color) => {
      ctx.save();
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      const px = plot.sx(bxMax) - 4;
      const py = plot.sy(yv) - 3;
      ctx.strokeText(text, px, py);
      ctx.fillStyle = color;
      ctx.fillText(text, px, py);
      ctx.restore();
    };
    tag(M.STRINGS.observationalTag, o.observational * bxMax, colors.ink1);
    if (o.truth) tag(M.STRINGS.truthTag, M.THETA * bxMax, colors.ink2);
    /* decision 9b: Egger's intercept marked where it lives, on the axis at
       zero effect on BMI — the average direct effect the slope is freed from */
    if (M.estimatorShows(sel, "egger")) {
      const a = study.est.egger.a;
      const px = plot.sx(0) + 4;
      const y0 = plot.sy(0);
      const y1 = plot.sy(a);
      ctx.save();
      ctx.strokeStyle = colors.groupB;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.lineTo(px, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 4, y1);
      ctx.lineTo(px + 4, y1);
      ctx.stroke();
      ctx.font = noteFont(colors);
      ctx.textAlign = "left";
      ctx.textBaseline = a >= 0 ? "bottom" : "top";
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      const label = `${M.STRINGS.interceptTag} ${M.n3(a)}`;
      ctx.strokeText(label, px + 8, y1 + (a >= 0 ? -2 : 2));
      ctx.fillStyle = colors.groupB;
      ctx.fillText(label, px + 8, y1 + (a >= 0 ? -2 : 2));
      ctx.restore();
    }
  }
  ctx.restore();
  return plot;
}

/* ---- step 2: the two GWAS ------------------------------------------------- */

function drawGwas(ctx, colors, L, state, params, anim) {
  const study = M.studyOf(state, params);
  const S = study.S;
  const raw = params.harmonise !== "on";
  const upTo = anim?.k?.gwas ?? 0;
  const arrived = state.order.slice(0, upTo);
  const last = upTo > 0 && upTo < state.m ? state.order[upTo - 1] : null;
  const m = state.m;

  /* the exposure strip */
  let bxMax = 0;
  for (let j = 0; j < m; j += 1) bxMax = Math.max(bxMax, S.bxHat[j] + 1.96 * S.sx[j]);
  const pE = makePlot({ ctx, colors, rect: L.exposure, xDomain: [0, m], yDomain: [0, bxMax * 1.1] });
  pE.axisY({ ticks: [0, 0.04, 0.08], format: (v) => v.toFixed(2), label: M.STRINGS.exposureY });
  pE.axisX({ ticks: [] });
  pE.caption(M.STRINGS.exposureCaption);
  pE.note(`${upTo} of ${m} SNPs`);

  /* the outcome strip */
  let byAbs = 0;
  for (let j = 0; j < m; j += 1) byAbs = Math.max(byAbs, Math.abs(S.byHat[j]) + 1.96 * S.sy[j]);
  const pO = makePlot({ ctx, colors, rect: L.outcome, xDomain: [0, m], yDomain: [-byAbs * 1.05, byAbs * 1.05] });
  pO.axisY({ ticks: [-0.05, 0, 0.05], format: (v) => v.toFixed(2), label: M.STRINGS.outcomeY });
  pO.axisX({ ticks: [], label: M.STRINGS.stripsX });
  pO.caption(M.STRINGS.outcomeCaption.replace("Outcome GWAS", `Outcome GWAS · n ${M.intText(M.LESSON.nY)}`));
  if (raw) pO.note(M.STRINGS.flippedNote, { tone: colors.extreme });
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.outcome.x, Math.round(pO.sy(0)) + 0.5);
  ctx.lineTo(L.outcome.x + L.outcome.w, Math.round(pO.sy(0)) + 0.5);
  ctx.stroke();
  ctx.restore();

  arrived.forEach((j, k) => {
    const x = M.stripX(L.exposure, m, k);
    const color = j === last ? colors.highlight : colors.unknown;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, pE.sy(S.bxHat[j] - 1.96 * S.sx[j]));
    ctx.lineTo(x, pE.sy(S.bxHat[j] + 1.96 * S.sx[j]));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, pE.sy(S.bxHat[j]), 2.2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, pO.sy(S.byHat[j] - 1.96 * S.sy[j]));
    ctx.lineTo(x, pO.sy(S.byHat[j] + 1.96 * S.sy[j]));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, pO.sy(S.byHat[j]), 2.4, 0, 2 * Math.PI);
    if (raw && S.flipped[j]) {
      ctx.fillStyle = colors.surface;
      ctx.fill();
      ctx.strokeStyle = colors.extreme;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  });

  /* the scatter forming under them */
  drawScatter(ctx, colors, L.plot, study, {
    arrived, last, raw, small: true, lines: false,
    caption: raw ? M.STRINGS.gwasScatterRaw : M.STRINGS.gwasScatterCaption,
  });
  if (upTo >= m) {
    noteAt(ctx, colors, L.head.x + L.head.w, L.plot.y + L.plot.h + 40, M.gwasReading(state, params), L.head.w, { baseline: "top", tone: raw ? colors.extreme : colors.ink1 });
  }
}

/* ---- step 3: the estimate ------------------------------------------------- */

function captionFor(estimator) {
  if (estimator === "all") return M.STRINGS.captionAll;
  if (estimator === "egger") return M.STRINGS.captionEgger;
  if (estimator === "median") return M.STRINGS.captionMedian;
  return M.STRINGS.captionIvw;
}

function drawEstimate(ctx, colors, L, state, params, anim, subject) {
  /* decision 9c: step 3 always reads the harmonised effects */
  const study = M.studyOf(state, params);
  const upTo = anim?.k?.estimate ?? 0;
  const done = upTo >= state.m;
  const arrived = state.order.slice(0, upTo);
  const last = upTo > 0 && !done ? state.order[upTo - 1] : null;
  drawDag(ctx, colors, L.dag, { page: "estimate", cfg: state.cfg, strength: params.strength });
  const nInvalid = state.m - Array.from(study.S.valid).reduce((a, b) => a + b, 0);
  let note;
  if (!done) note = M.STRINGS.waitingNote;
  else if (nInvalid) note = `${nInvalid} SNPs with a direct path, in red`;
  else if (params.strength === "weak") note = `exposure GWAS n ${M.intText(state.cfg.nX)}`;
  const shown = subject != null && arrived.includes(subject) ? subject : null;
  drawScatter(ctx, colors, L.plot, study, {
    arrived, last, raw: false, lines: done, estimator: params.estimator, truth: params.truth === "on",
    observational: state.trial.obs.b, markInvalid: nInvalid > 0, subject: shown, ownSlope: true,
    caption: done ? captionFor(params.estimator) : M.STRINGS.gwasScatterCaption, note,
  });
  /* the reading line spans the canvas: the plot beside the graph is 276px
     and the line is not. The pointer's SNP wins; the finished figure's
     reading holds otherwise (decision 9b). */
  const y = L.plot.y + L.plot.h + 40;
  if (shown != null) {
    noteAt(ctx, colors, L.head.x + L.head.w, y, M.snpReading(study, shown), L.head.w, { baseline: "top", tone: colors.highlight });
  } else if (done) {
    noteAt(ctx, colors, L.head.x + L.head.w, y, M.estimateReading(study, params, state.trial.obs.b, params.truth === "on"), L.head.w, { baseline: "top", tone: colors.ink1 });
  }
}

/* ---- step 4: the forest (decision 6) ---------------------------------------- */

function drawForest(ctx, colors, L, state, params, anim, subject) {
  const study = M.studyOf(state, params);
  const m = state.m;
  const upTo = anim?.k?.forest ?? 0;
  const done = upTo >= m;
  const LIM = M.FOREST_LIM;
  const plot = makePlot({ ctx, colors, rect: L.plot, xDomain: [-LIM, LIM], yDomain: [0, 1] });
  plot.axisX({ ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => v.toFixed(0), label: M.STRINGS.forestX });
  plot.caption(`${M.STRINGS.forestCaption}, ${upTo} of ${m} SNPs`);
  let clipped = 0;
  ctx.save();
  /* the zero line */
  ctx.strokeStyle = colors.ink3;
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(plot.sx(0)) + 0.5, L.rowsTop);
  ctx.lineTo(Math.round(plot.sx(0)) + 0.5, L.plot.y + L.plot.h);
  ctx.stroke();
  ctx.setLineDash([]);
  const named = L.pitch >= M.FOREST_NAMES_PITCH;
  ctx.font = `${Math.min(11, Math.max(8, L.pitch - 1))}px ${colors.font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let row = 0; row < upTo; row += 1) {
    const j = study.forestOrder[row];
    const y = L.rowsTop + (row + 0.5) * L.pitch;
    const r = study.W.ratio[j];
    const lo = r - 1.96 * study.W.se[j];
    const hi = r + 1.96 * study.W.se[j];
    if (lo < -LIM || hi > LIM) clipped += 1;
    const isSubject = subject === j;
    const last = row === upTo - 1 && !done;
    const color = isSubject || last ? colors.highlight : colors.ink3;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSubject ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(plot.sx(Math.max(-LIM, lo)), y);
    ctx.lineTo(plot.sx(Math.min(LIM, hi)), y);
    ctx.stroke();
    ctx.fillStyle = isSubject || last ? colors.highlight : colors.ink1;
    ctx.beginPath();
    ctx.arc(plot.sx(Math.max(-LIM, Math.min(LIM, r))), y, isSubject ? 3.5 : Math.min(2.6, L.pitch / 2 - 0.5), 0, 2 * Math.PI);
    ctx.fill();
    if (named || isSubject) {
      ctx.fillStyle = isSubject ? colors.highlight : colors.ink2;
      ctx.fillText(`SNP ${j + 1}`, L.L - 6, y);
    }
    /* decision 9b: the row the weighted median takes, marked once every
       row is in and the median is on show */
    if (done && j === study.medianSnp && M.estimatorShows(params.estimator, "median")) {
      ctx.save();
      ctx.strokeStyle = colors.groupC;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(L.plot.x + L.plot.w - 2, y - Math.max(3, L.pitch / 2));
      ctx.lineTo(L.plot.x + L.plot.w - 2, y + Math.max(3, L.pitch / 2));
      ctx.stroke();
      ctx.font = noteFont(colors);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(M.STRINGS.medianRowTag, L.plot.x + L.plot.w - 8, y);
      ctx.fillStyle = colors.groupC;
      ctx.fillText(M.STRINGS.medianRowTag, L.plot.x + L.plot.w - 8, y);
      ctx.restore();
    }
  }
  /* the rule and the combined rows, once every SNP is in (decision 3) */
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.L, Math.round(L.ruleY) + 0.5);
  ctx.lineTo(L.plot.x + L.plot.w, Math.round(L.ruleY) + 0.5);
  ctx.stroke();
  if (done) {
    const comb = [
      ["ivw", M.STRINGS.combinedIvw, study.est.ivw.b, study.est.ivw.se],
      ["egger", M.STRINGS.combinedEgger, study.est.egger.b, study.est.egger.se],
      ["median", M.STRINGS.combinedMedian, study.est.median.b, study.est.median.se],
    ];
    ctx.font = noteFont(colors);
    comb.forEach(([k, label, b, se], i) => {
      const y = L.ruleY + 10 + i * M.COMBINED_ROW_H;
      const sel = M.estimatorShows(params.estimator, k);
      const color = sel ? colors.highlight : colors.ink2;
      ctx.strokeStyle = color;
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(plot.sx(Math.max(-LIM, b - 1.96 * se)), y);
      ctx.lineTo(plot.sx(Math.min(LIM, b + 1.96 * se)), y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(plot.sx(b), y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = sel ? colors.ink1 : colors.ink2;
      const text = `${label}  ${M.n2(b)} (${M.n2(b - 1.96 * se)} to ${M.n2(b + 1.96 * se)})`;
      const rx = plot.sx(b + 1.96 * se) + 8;
      /* to the right of the interval where it fits, else to the left of it */
      if (rx + ctx.measureText(text).width <= L.plot.x + L.plot.w) {
        ctx.textAlign = "left";
        ctx.fillText(text, rx, y);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(text, plot.sx(b - 1.96 * se) - 8, y);
      }
    });
  }
  ctx.restore();
  if (clipped) plot.note(`${clipped} interval${clipped > 1 ? "s" : ""} past ±3, cut at the edge`);
  const ry = L.plot.y + L.plot.h + 40;
  if (subject != null && study.forestOrder.indexOf(subject) < upTo) {
    noteAt(ctx, colors, L.head.x + L.head.w, ry, M.snpReading(study, subject), L.head.w, { baseline: "top", tone: colors.highlight });
  } else if (done) {
    noteAt(ctx, colors, L.head.x + L.head.w, ry, M.forestReading(study, m, params), L.head.w, { baseline: "top", tone: colors.ink1 });
  }
}

/* ========================================================================== */

const ALL_STEPS = M.PAGE_VALUES;

defineWidget({
  slug: "mendelian-randomization",
  title: "Mendelian Randomization",
  status: "draft",
  subtitle: M.STRINGS.subtitle,
  layout: "side",
  /* one geometry function, for the height the page reserves and for every rect
     the figure draws in (5.8) */
  height: ({ w, ...values }) => M.stageHeight(w, values),

  /* decision 5: the scatter and the forest answer the pointer, and a click pins */
  pointer: true,
  regions({ w, params, state }) {
    /* state is null on core's load-time probe, which runs before the first
       render; nothing is validated by it here either */
    if (!state) return [];
    return M.regionsFor(M.layout(w, params), state, params);
  },

  params: {
    /* decision 2: the step is display, and the run is per step */
    page: {
      type: "segmented",
      label: M.STRINGS.pageLabel,
      detail: M.STRINGS.pageDetail,
      options: M.PAGES,
      groupHeads: true,
      default: "trial",
      display: true,
    },

    dataSec: { type: "section", label: M.STRINGS.dataSection },
    seed: {
      type: "int",
      label: M.STRINGS.seedLabel,
      min: 1,
      max: 200,
      default: 1,
      detail: M.STRINGS.seedDetail,
    },
    confounding: {
      type: "segmented",
      label: M.STRINGS.confoundingLabel,
      detail: M.STRINGS.confoundingDetail,
      options: M.CONFOUNDING.map((c) => ({ value: c.value, label: c.label })),
      default: "strong",
    },
    /* the reveal, in the arc's one position: after Seed (widget 26) */
    truth: {
      type: "segmented",
      label: M.STRINGS.truthLabel,
      options: [
        { value: "off", label: "Off", detail: M.STRINGS.truthOff },
        { value: "on", label: "On", detail: M.STRINGS.truthOn },
      ],
      default: "off",
      display: true,
    },
    /* the control keeps widget 26's name (3.7) */
    colour: {
      type: "segmented",
      label: M.STRINGS.colourLabel,
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On", detail: M.STRINGS.colourOn },
      ],
      default: "off",
      display: true,
      when: { param: "page", equals: "trial" },
    },

    /* the three assumptions, by the lesson's names (Kenneth's pick) */
    assumptionsSec: { type: "section", label: M.STRINGS.assumptionsSection },
    strength: {
      type: "segmented",
      label: M.STRINGS.relevanceLabel,
      detail: M.STRINGS.relevanceDetail,
      options: M.STRENGTH.map((s) => ({ value: s.value, label: s.label })),
      default: "strong",
    },
    pleio: {
      type: "segmented",
      label: M.STRINGS.exclusionLabel,
      detail: M.STRINGS.exclusionDetail,
      options: M.PLEIO.map((p) => ({ value: p.value, label: p.label })),
      default: "0",
    },
    indep: {
      type: "segmented",
      label: M.STRINGS.independenceLabel,
      options: [
        { value: "holds", label: "Holds", detail: M.STRINGS.independenceHolds },
        { value: "broken", label: "Broken", detail: M.STRINGS.independenceBroken },
      ],
      default: "holds",
    },

    /* model.js decisions 4 and 9c: the same two GWAS, read on the same allele
       or not — on step 2 alone; the steps after always read them harmonised */
    studySec: { type: "section", label: M.STRINGS.studySection, when: { param: "page", equals: "gwas" } },
    harmonise: {
      type: "segmented",
      label: M.STRINGS.harmoniseLabel,
      options: [
        { value: "off", label: "Off", detail: M.STRINGS.harmoniseOff },
        { value: "on", label: "On", detail: M.STRINGS.harmoniseOn },
      ],
      default: "off",
      display: true,
      when: { param: "page", equals: "gwas" },
    },
    estimator: {
      type: "segmented",
      label: M.STRINGS.estimatorLabel,
      options: M.ESTIMATORS,
      default: "ivw",
      display: true,
      when: { param: "page", oneOf: M.PIN_PAGES },
    },

    shown: { type: "int", min: 0, max: 100, default: 0, hidden: true },

    /* decision 5: the pin — one SNP number. Hidden, because the figure is its
       control; display, so a click keeps the run. */
    snp: {
      type: "text",
      hidden: true,
      display: true,
      default: "",
      maxLength: M.SNP_MAX_LENGTH,
      parse: M.parseSnp,
    },
  },

  legend: ({ params }) => {
    const page = M.pageOf(params);
    if (page === "trial") {
      return [
        { token: "unknown", label: "A person: their BMI, and the CHD risk the simulation gives them", mark: "dot" },
        { token: "nonevent", label: "Confounders low, when coloured", mark: "dot" },
        { token: "event", label: "Confounders high, when coloured", mark: "dot" },
        { token: "empirical", label: "CHD risk on BMI, every person: the observational fit", mark: "line" },
        { token: "highlight", label: "Stage 1, each genotype group's mean BMI; stage 2, its mean CHD risk; the line through the three, whose slope is this SNP's ratio", mark: "line" },
        { token: "reference", label: "The true effect, revealed on request", mark: "dash" },
        { token: "extreme", label: "A non-causal path standing open", mark: "line" },
      ];
    }
    if (page === "gwas") {
      return [
        { token: "unknown", label: "A SNP's effect with its 95% interval, in each GWAS and on the scatter", mark: "dot" },
        { token: "highlight", label: "The SNP just added", mark: "dot" },
        { token: "extreme", label: "An effect reported on the other allele, until harmonised", mark: "dot" },
      ];
    }
    const shared = [
      { token: "empirical", label: "IVW: the precision-weighted slope through the origin", mark: "line" },
      { token: "group-b", label: "MR Egger: the same slope freed from the origin, its intercept the average direct effect", mark: "line" },
      { token: "group-c", label: "Weighted median: the middle single-SNP ratio by weight", mark: "line" },
      { token: "ink-1", label: "The observational estimate: CHD risk on BMI in the cohort, confounded", mark: "dash" },
      { token: "reference", label: "The true effect, revealed on request", mark: "dash" },
    ];
    if (page === "estimate") {
      return [
        { token: "unknown", label: "A SNP's two effects with their intervals; every SNP also carries a small direct effect of either sign", mark: "dot" },
        { token: "extreme", label: "A SNP with a direct path to CHD, when the exclusion restriction is broken", mark: "dot" },
        ...shared,
        { token: "highlight", label: "The SNP under the pointer or pinned by a click, and its own ratio as the slope from the origin", mark: "dot" },
      ];
    }
    return [
      { token: "unknown", label: "A SNP's ratio with its 95% interval", mark: "dot" },
      ...shared,
      { token: "highlight", label: "The SNP under the pointer or pinned by a click, here and on the scatter", mark: "dot" },
    ];
  },

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
         the link names — `?page=estimate&shown=79` for a lesson link. */
      const authored = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      const page = M.pageOf(params);
      k[page] = Math.min(M.totalFor(page, state), authored);
      return { k, beat: 0, trialBeat: k.trial, done: k[page] >= M.totalFor(page, state) };
    },

    advance: (anim, { dt, params, state }) => {
      const page = M.pageOf(params);
      const total = M.totalFor(page, state);
      if (anim.k[page] >= total) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      anim.beat += dt / M.beatMs(page, state, anim.k[page]);
      if (anim.beat < 1) return true;
      if (anim.mode === "step") {
        anim.beat = 0;
        anim.k[page] = Math.min(total, anim.k[page] + 1);
      } else {
        const units = Math.floor(anim.beat);
        anim.beat -= units;
        anim.k[page] = Math.min(total, anim.k[page] + units);
      }
      anim.trialBeat = anim.k.trial;
      if (anim.k[page] >= total) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* A display change keeps every step's work (non-negotiable 3). */
    rebuild: (anim, { params, state }) => {
      for (const page of ALL_STEPS) anim.k[page] = Math.min(anim.k[page] ?? 0, M.totalFor(page, state));
      anim.trialBeat = anim.k.trial;
      const page = M.pageOf(params);
      anim.done = anim.k[page] >= M.totalFor(page, state);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const L = M.layout(w, params);
    drawHead(ctx, colors, L.head, L.page);
    if (L.page === "trial") return drawTrial(ctx, colors, L, state, params, anim);
    if (L.page === "gwas") return drawGwas(ctx, colors, L, state, params, anim);
    /* decision 5: the pointer wins while it is on a target, the pin holds
       otherwise */
    const subject = (pointer ? M.subjectAt(L, state, params, pointer.x, pointer.y) : null)
      ?? M.pinnedSubject(params);
    if (L.page === "estimate") return drawEstimate(ctx, colors, L, state, params, anim, subject);
    return drawForest(ctx, colors, L, state, params, anim, subject);
  },

  readout({ params, state, anim }) {
    const page = M.pageOf(params);
    const upTo = anim?.k?.[page] ?? 0;
    const truth = params.truth === "on";
    const truthTile = {
      label: M.STRINGS.truthLabel,
      value: truth ? M.n2(M.THETA) : "—",
      note: truth ? M.STRINGS.truthOn : "revealed by the True effect control",
    };
    if (page === "trial") {
      const T = state.trial;
      /* decision 9a: the two stages and their quotient, each at its beat */
      return [
        {
          label: "Observational slope",
          value: upTo >= 2 ? M.n2(T.obs.b) : "—",
          note: upTo >= 2 ? M.ciText(T.obs.b, T.obs.se) : "CHD risk on BMI, every person",
        },
        {
          label: M.STRINGS.tileStage1,
          value: upTo >= 3 ? M.n2(T.gx.b) : "—",
          note: upTo >= 3 ? `SD of BMI per copy of the allele · ${M.ciText(T.gx.b, T.gx.se)}` : "SD of BMI per copy of the allele",
        },
        {
          label: M.STRINGS.tileStage2,
          value: upTo >= 4 ? M.n2(T.gl.b) : "—",
          note: upTo >= 4 ? `log odds per copy of the allele · ${M.ciText(T.gl.b, T.gl.se)}` : "log odds per copy of the allele",
        },
        {
          label: M.STRINGS.tileRatio,
          value: upTo >= 5 ? M.n2(T.ratio.b) : "—",
          note: upTo >= 5 ? `log odds per SD of BMI, ${M.orText(T.ratio.b)} · ${M.ciText(T.ratio.b, T.ratio.se)}` : "log odds per SD of BMI",
        },
        truthTile,
      ];
    }
    const study = M.studyOf(state, params);
    const done = upTo >= state.m;
    if (page === "gwas") {
      return [
        { label: "SNPs", value: String(upTo), note: `of ${state.m} instruments` },
        {
          label: "Reported on the other allele",
          value: params.harmonise === "on" ? "0" : String(state.nFlipped),
          note: params.harmonise === "on" ? "after harmonising" : "outcome effects with the sign of the other allele",
        },
        {
          label: "Mean F statistic",
          value: done ? M.n2(study.F).replace(/\.\d+$/, "") : "—",
          note: done ? "strength of the SNPs on BMI; 10 is the usual floor" : "read once every SNP is in",
        },
      ];
    }
    const e = study.est;
    const on = (k) => M.estimatorShows(params.estimator, k);
    const tile = (label, k, b, se, extra = "") => ({
      label,
      value: done && on(k) ? M.n2(b) : "—",
      note: !done ? "waits for the last SNP" : on(k) ? `${M.ciText(b, se)} · ${M.orText(b)}${extra}` : "select it to read it",
    });
    return [
      tile("IVW", "ivw", e.ivw.b, e.ivw.se),
      tile("MR Egger", "egger", e.egger.b, e.egger.se, ` · intercept ${M.n3(e.egger.a)} ±${M.n3(e.egger.seA)}`),
      tile("Weighted median", "median", e.median.b, e.median.se),
      { label: "Observational", value: M.n2(state.trial.obs.b), note: "CHD risk on BMI in the cohort, confounded" },
      truthTile,
      { label: "Mean F statistic", value: done ? String(Math.round(study.F)) : "—", note: done ? "10 is the usual floor" : "read once every SNP is in" },
    ];
  },

  summary({ params, state, anim }) {
    const page = M.pageOf(params);
    const upTo = anim?.k?.[page] ?? 0;
    const cfg = state.cfg;
    const graph = M.verdict({ page, confounding: cfg.confounding, pleio: cfg.share > 0, indep: cfg.indep });
    if (page === "trial") {
      const T = state.trial;
      const parts = [`The graph: ${graph}.`];
      if (upTo === 0) parts.push("A scatter of CHD risk against BMI, waiting for its 2,000 people.");
      else parts.push(`A scatter of CHD risk against BMI for 2,000 people; the observational slope is ${M.n2(T.obs.b)}.`);
      if (upTo >= 3) parts.push(`Stage 1: ${M.n2(T.gx.b)} SD of BMI per copy of the allele.`);
      if (upTo >= 4) parts.push(`Stage 2: ${M.n2(T.gl.b)} log odds of CHD per copy.`);
      if (upTo >= 5) parts.push(`The ratio, stage 2 over stage 1, is ${M.n2(T.ratio.b)}.`);
      return parts.join(" ");
    }
    const study = M.studyOf(state, params);
    const done = upTo >= state.m;
    if (page === "gwas") {
      return `Two GWAS, ${upTo} of ${state.m} SNPs in: each SNP's effect on BMI and its effect on CHD, and the scatter of one against the other${params.harmonise === "on" ? "" : ", unharmonised"}.`;
    }
    const est = done
      ? ` IVW ${M.n2(study.est.ivw.b)}, MR Egger ${M.n2(study.est.egger.b)}, weighted median ${M.n2(study.est.median.b)}; the observational slope is ${M.n2(state.trial.obs.b)}.`
      : ` The estimate waits for the last SNP.`;
    if (page === "estimate") return `The graph: ${graph}. The scatter of ${upTo} of ${state.m} SNPs' two effects.${est}`;
    return `A forest of ${upTo} of ${state.m} single-SNP ratios, sorted, with the combined estimates under the rule.${est}`;
  },
});
