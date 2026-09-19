/* ============================================================================
   Widget 70 · Mutational Signatures — PHM5003 07 / 01-4, end to end.

   `model.js` carries the engine, the stage and the copy, and the decisions
   taken while building; this file draws them. Three pages, from Kenneth's picks
   of 2026-09-18 and 2026-09-19: Catalogue · Signatures · Matching.

   The drawing rules this file keeps to:

     · The six substitution classes wear the field's colours, `--c-sub-*`
       (his pick 5), on bars, bands and swatches and never on text.
     · A heatmap runs from the well colour to `--c-magnitude`, violet, a
       stronger shade for more: his pick of round 1 (2026-09-19) over the
       draft's grey. A panel coloured by value must not also colour by
       identity with the same hue, and the classes already use red, so it is
       not widget 41's red ramp.
     · Violet therefore means "larger" on pages 2 and 3, and `--c-highlight`,
       the same violet, is on neither: the rule at half of a signature's
       exposure is ink.
     · Tumor 101, the hypermutated one, is outlined in M and in W, and marked
       under its bar once the signatures open (round 1).
     · NOTHING MOVES OVER A FINISHED SIGNATURE (round 2, his ask): the
       signatures form in the space M leaves, and each moving strip keeps to
       its own lane, its own row, or the free space left of S.
     · On page 1 a change written from a purine is its class colour, paler, so
       it can be seen joining its partner.
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

const S = M.STRINGS;
const SUB_TOKENS = ["sub-ca", "sub-cg", "sub-ct", "sub-ta", "sub-tc", "sub-tg"];

/* ---- the formula card --------------------------------------------------------
   Widget 69's machinery: the general form, then this figure's own numbers,
   each appearing once its step has been taken (2.4). Page 1 has none. */
const MATHML = mathmlRenders();
const mi = (s) => `<mi>${s}</mi>`;
const mo = (s) => `<mo>${s}</mo>`;

const row = (label, ...parts) =>
  `<div class="w-math-eq" style="min-height:0;padding-left:0;text-indent:0;margin:0;`
  + `display:flex;align-items:baseline;gap:10px;line-height:2.4">`
  + `<span style="color:var(--ink-3);font-size:var(--fs-xs);white-space:nowrap;`
  + `line-height:1.4;flex:0 0 7.5em;text-align:right">${label}</span>`
  + `<span style="display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px">`
  + parts.filter(Boolean).map((p) => `<span>${p}</span>`).join("")
  + `</span></div>`;

const FACTOR_MATH = `<math><mrow>${mi("M")}${mo("&#x2248;")}${mi("S")}${mo("&#x00D7;")}${mi("W")}</mrow></math>`;
const FACTOR_PLAIN = "M ≈ S × W";
const COSINE_MATH = `<math><mrow>${mi("cos")}${mo("(")}${mi("A")}${mo(",")}${mi("B")}${mo(")")}${mo("=")}<mfrac>`
  + `<mrow>${mi("A")}${mo("&#x00B7;")}${mi("B")}</mrow>`
  + `<mrow>${mo("&#x2016;")}${mi("A")}${mo("&#x2016;")}${mo("&#x2016;")}${mi("B")}${mo("&#x2016;")}</mrow></mfrac></mrow></math>`;
const COSINE_PLAIN = "cos(A, B) = A · B / (‖A‖ ‖B‖)";

const numbers = (s) => (MATHML
  ? `<math><mrow><mtext>${s}</mtext></mrow></math>`
  : `<span style="font-family:var(--font-mono)">${s}</span>`);

let mathHost = null;
let mathKey = null;
function renderCard(card) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = card ? `${card.rows.map((r) => r.join("~")).join("|")}|${card.note}` : "";
  if (key === mathKey) return;
  mathKey = key;
  mathHost.hidden = !card;
  mathHost.innerHTML = card
    ? card.rows.map(([label, ...parts]) => row(label, ...parts)).join("") + `<p class="w-math-note">${card.note}</p>`
    : "";
}

function openIndex(params) {
  return Math.min(params.rank, Math.max(1, Number(params.signature) || 1)) - 1;
}

function cardFor(params, state, anim) {
  if (params.page === "signatures" && state.fit) {
    const f = state.fit;
    return {
      rows: [[S.labelFactor, MATHML ? FACTOR_MATH : FACTOR_PLAIN,
        numbers(`96 × ${f.cols} ≈ (96 × ${f.rank})(${f.rank} × ${f.cols})`)]],
      note: S.noteSignatures,
    };
  }
  if (params.page === "matching" && state.fit) {
    const k = openIndex(params);
    const s = state.fit.sigs[k];
    const compared = (anim?.match ?? 0) >= 1 && (anim?.matchT ?? 1) >= 1;
    return {
      rows: [[S.labelCosine, MATHML ? COSINE_MATH : COSINE_PLAIN,
        compared && s ? numbers(`cos(signature ${k + 1}, ${s.match[0].name}) = ${M.cos3(s.match[0].cos)}`) : null]],
      note: S.noteMatching,
    };
  }
  return null;
}

/* ---- small drawing helpers -------------------------------------------------- */

const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const noteFont = (colors) => `${colors.fsXs} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;

function text(ctx, s, x, y, { font, fill, align = "left", baseline = "alphabetic" }) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function rule(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

const rgbOf = (c) => {
  const m = String(c).trim().match(/^#([0-9a-f]{6})$/i);
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
function wash(color, a) {
  const p = rgbOf(color);
  return p ? `rgba(${p[0]},${p[1]},${p[2]},${a})` : color;
}
const hexOf = (p) => `#${p.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
/** Token colour `a` moved `t` of the way to token colour `b`. */
function mixHex(a, b, t) {
  const p = rgbOf(a), q = rgbOf(b);
  const u = Math.max(0, Math.min(1, t));
  if (!p || !q) return u < 0.5 ? a : b;
  return hexOf(p.map((x, i) => x + (q[i] - x) * u));
}
/** The ramp: the well colour for nothing, `--c-magnitude` for the most. */
const shade = (colors, v) => mixHex(colors.surface3, colors.magnitude, v);

/** Whichever ink reads better on a shaded cell. The ramp ends dark on the
    light theme and pale on the dark, so no one ink reads on all of it. */
function inkOn(colors, fill) {
  const lum = (c) => {
    const p = rgbOf(c);
    if (!p) return 0.5;
    const [r, g, b] = p.map((x) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return contrast(fill, colors.ink1) >= contrast(fill, colors.surface) ? colors.ink1 : colors.surface;
}

function withAlpha(ctx, a, paint) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  paint();
  ctx.restore();
}

/** 96 bars in maftools' order, each its class's colour, with the class bands
    under them, as `plotSignatures` draws a signature. */
function profileBars(ctx, colors, v, { x0, x1, top, base, max = null, bands = true }) {
  const bw = (x1 - x0) / 96;
  const m = max ?? M.niceMax(Math.max(...v));
  for (let i = 0; i < 96; i += 1) {
    const h = Math.min(1, v[i] / m) * (base - top);
    if (h <= 0) continue;
    ctx.fillStyle = colors.subs[i >> 4];
    ctx.fillRect(x0 + i * bw + 0.5, base - h, Math.max(1, bw - 1), h);
  }
  rule(ctx, x0, base + 0.5, x1, base + 0.5, colors.axis);
  if (bands) {
    for (let k = 0; k < 6; k += 1) {
      ctx.fillStyle = colors.subs[k];
      ctx.fillRect(x0 + 16 * k * bw + 1, base + 3, 16 * bw - 2, 3);
    }
  }
}

function fillRect(ctx, r, fill) {
  if (r.h <= 0 || r.w <= 0) return;
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/* ---- page 1: the catalogue ------------------------------------------------------- */

function yTicks(ctx, colors, L, yMax, alpha, reach = L.x1) {
  withAlpha(ctx, alpha, () => {
    for (const v of [0, yMax / 2, yMax]) {
      const y = L.base - (v / yMax) * (L.base - L.top);
      if (v > 0) rule(ctx, L.x0, y, reach, y, colors.grid);
      text(ctx, M.intText(v), L.x0 - 7, y + 4, { font: monoFont(colors), fill: colors.ink3, align: "right" });
    }
  });
}

function writtenLabels(ctx, colors, L, alpha) {
  withAlpha(ctx, alpha, () => {
    M.CLASSES.forEach((s, k) => {
      const a = M.writtenRect(L, k, false, 0, 1), b = M.writtenRect(L, k, true, 0, 1);
      text(ctx, s, a.x + a.w / 2, L.base + 15, { font: monoFont(colors), fill: colors.ink1, align: "center" });
      text(ctx, M.PURINE_FORM[s], b.x + b.w / 2, L.base + 15, { font: monoFont(colors), fill: colors.ink3, align: "center" });
    });
  });
}

function classLabels(ctx, colors, L, alpha) {
  withAlpha(ctx, alpha, () => {
    M.CLASSES.forEach((s, k) => {
      const cx = L.x0 + L.slot * (k + 0.5);
      text(ctx, s, cx, L.base + 15, { font: monoFont(colors), fill: colors.ink1, align: "center" });
      const ti = M.TRANSITIONS.has(s);
      text(ctx, ti ? "Ti" : "Tv", cx, L.base + 29, { font: ti ? `600 ${colors.fsXs} ${colors.mono}` : monoFont(colors), fill: ti ? colors.ink1 : colors.ink3, align: "center" });
    });
  });
}

function bandLabels(ctx, colors, L, alpha) {
  withAlpha(ctx, alpha, () => {
    for (let k = 0; k < 6; k += 1) {
      const x = L.x0 + L.slot * k + 3;
      ctx.fillStyle = colors.subs[k];
      ctx.fillRect(x, L.base + 4, L.slot - 6, 4);
      text(ctx, M.CLASSES[k], x + (L.slot - 6) / 2, L.base + 21, { font: monoFont(colors), fill: colors.ink1, align: "center" });
    }
  });
}

/** One written change as an arrow of the square, set beside its reverse. */
function squareArrow(ctx, [ax, ay], [bx, by], colour) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const nx = -uy * 3, ny = ux * 3, r = M.NODE_R;
  const sx = ax + ux * (r + 3) + nx, sy = ay + uy * (r + 3) + ny;
  const ex = bx - ux * (r + 4) + nx, ey = by - uy * (r + 4) + ny;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex - ux * 4, ey - uy * 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ux * 6 - uy * 3.2, ey - uy * 6 + ux * 3.2);
  ctx.lineTo(ex - ux * 6 + uy * 3.2, ey - uy * 6 - ux * 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The square at `fold`: 0, all twelve written changes, those from a purine
    paler; 1, the six read from the pyrimidine, with Ti and Tv labelled. */
function drawSquare(ctx, colors, L, fold) {
  const N = M.squareNodes(L);
  const mid = (N.x0 + N.x1) / 2;
  text(ctx, S.squarePurines, mid, N.y0 - 16, { font: noteFont(colors), fill: colors.ink2, align: "center" });
  text(ctx, S.squarePyrimidines, mid, N.y1 + 30, { font: noteFont(colors), fill: colors.ink2, align: "center" });
  for (const a of M.ARROWS) {
    const colour = colors.subs[a.k];
    withAlpha(ctx, a.purine ? 1 - fold : 1, () => squareArrow(ctx, N[a.from], N[a.to], a.purine ? wash(colour, 0.45) : colour));
  }
  for (const b of ["A", "G", "C", "T"]) {
    const [x, y] = N[b];
    ctx.save();
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.ink2;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, M.NODE_R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, b, x, y + 4, { font: capFont(colors), fill: colors.ink1, align: "center" });
  }
  withAlpha(ctx, fold, () => {
    const bold = `600 ${colors.fsXs} ${colors.mono}`;
    text(ctx, S.squareTi, mid, N.y1 + 16, { font: bold, fill: colors.ink1, align: "center" });
    text(ctx, S.squareTv, N.x0 - 16, (N.y0 + N.y1) / 2 + 4, { font: monoFont(colors), fill: colors.ink2, align: "center" });
    text(ctx, S.squareTv, N.x1 + 16, (N.y0 + N.y1) / 2 + 4, { font: monoFont(colors), fill: colors.ink2, align: "center" });
    const x = L.square.x + 6;
    text(ctx, S.squareTi, x, N.y1 + 50, { font: bold, fill: colors.ink1 });
    text(ctx, S.squareTiKey, x + 22, N.y1 + 50, { font: noteFont(colors), fill: colors.ink1 });
    text(ctx, S.squareTv, x, N.y1 + 64, { font: monoFont(colors), fill: colors.ink2 });
    text(ctx, S.squareTvKey, x + 22, N.y1 + 64, { font: noteFont(colors), fill: colors.ink2 });
  });
}

/** The two written counts above each class's stack (round 4): the solid
    part's in the ink of its written label, then the pale part's in the paler
    ink of its own, so 101 + 87 reads as the C>T bar's two parts. */
function drawCounts(ctx, colors, L, t, alpha) {
  withAlpha(ctx, alpha, () => t.byClass.forEach(({ pyr, pur }, k) => {
    const top = M.foldedRect(L, k, true, pyr, pur, t.yClass).y;
    const a = String(pyr), b = ` + ${pur}`;
    ctx.save();
    ctx.font = monoFont(colors);
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    ctx.restore();
    const x = L.x0 + L.slot * (k + 0.5) - (wa + wb) / 2;
    text(ctx, a, x, top - 5, { font: `600 ${colors.fsXs} ${colors.mono}`, fill: colors.ink1 });
    text(ctx, b, x + wa, top - 5, { font: monoFont(colors), fill: colors.ink3 });
  }));
}

/** One mutation from both strands (round 4): the pair G:C becoming A:T, which
    the file writes G>A on the + strand and which reads C>T on the − strand,
    5′ to 3′, in the pale and the solid red of the C>T bar's two parts. */
function drawStrands(ctx, colors, L, alpha) {
  const y0 = L.strands.y;
  withAlpha(ctx, alpha, () => {
    text(ctx, S.strandsTitle, L.x0, y0, { font: capFont(colors), fill: colors.ink1 });
    const box = 17;
    const bold = `600 ${colors.fsXs} ${colors.mono}`;
    const seq = (x, y, ends, bases, mark) => {
      text(ctx, ends[0], x, y + 12, { font: monoFont(colors), fill: colors.ink3 });
      let bx = x + 16;
      bases.forEach((b, i) => {
        ctx.save();
        ctx.fillStyle = i === 1 ? mark : colors.surface;
        ctx.fillRect(bx, y, box, box);
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, y + 0.5, box - 1, box - 1);
        ctx.restore();
        text(ctx, b, bx + box / 2, y + 12.5, { font: bold, fill: colors.ink1, align: "center" });
        bx += box + 2;
      });
      text(ctx, ends[1], bx + 2, y + 12, { font: monoFont(colors), fill: colors.ink3 });
      return bx + 18;
    };
    const row = (y, label, ends, before, after, mark, words, wordsFill) => {
      text(ctx, label, L.x0, y + 12, { font: noteFont(colors), fill: colors.ink2 });
      /* room for "reference strand", the captions' own words (the copy audit) */
      let x = seq(L.x0 + 104, y, ends, before, mark);
      text(ctx, "→", x + 6, y + 12, { font: noteFont(colors), fill: colors.ink2, align: "center" });
      x = seq(x + 16, y, ends, after, mark);
      text(ctx, words, x + 8, y + 12, { font: noteFont(colors), fill: wordsFill });
    };
    row(y0 + 10, S.strandPlus, ["5′", "3′"], ["A", "G", "C"], ["A", "A", "C"], wash(colors.subs[2], 0.45), S.strandWritten, colors.ink3);
    row(y0 + 32, S.strandMinus, ["3′", "5′"], ["T", "C", "G"], ["T", "T", "G"], colors.subs[2], S.strandRead, colors.ink1);
  });
}

/** The six grids' frames and letters (round 4): the 3′ base over each
    column, the 5′ base beside the first grid's rows, and each class's band and
    name under its grid. Empty cells keep their frame, so a type with no
    mutation is still a place. */
function gridFrames(ctx, colors, L, alpha) {
  const G = M.gridOf(L);
  withAlpha(ctx, alpha, () => {
    for (let k = 0; k < 6; k += 1) {
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let l = 0; l < 4; l += 1) {
        for (let r = 0; r < 4; r += 1) ctx.strokeRect(G.x(k) + r * G.cell + 0.5, G.y + l * G.cell + 0.5, G.cell - 1, G.cell - 1);
      }
      ctx.restore();
      M.BASES.forEach((b, r) => text(ctx, b, G.x(k) + (r + 0.5) * G.cell, G.y - 4, { font: monoFont(colors), fill: colors.ink3, align: "center" }));
      ctx.fillStyle = colors.subs[k];
      ctx.fillRect(G.x(k), L.base + 4, 4 * G.cell, 4);
      text(ctx, M.CLASSES[k], G.x(k) + 2 * G.cell, L.base + 21, { font: monoFont(colors), fill: colors.ink1, align: "center" });
    }
    M.BASES.forEach((b, l) => text(ctx, b, G.x(0) - 5, G.y + (l + 0.5) * G.cell + 4, { font: monoFont(colors), fill: colors.ink3, align: "right" }));
    text(ctx, S.fivePrime, G.x(0) - 5, G.y - 4, { font: monoFont(colors), fill: colors.ink2, align: "right" });
    text(ctx, S.threePrime, G.x(5) + 4 * G.cell, G.y - 16, { font: monoFont(colors), fill: colors.ink2, align: "right" });
  });
}

/** Type ch's target in the view stage `cat` shows (round 4): its grid cell
    after the split, its bar's column once lined up. One geometry for the
    click (regions), the pointer and the outline. */
function typeTarget(Lw, cat, ch) {
  if (cat === 3) return M.gridCell(Lw, ch);
  const cw = (Lw.slot - 6) / 16;
  return { x: Lw.x0 + Lw.slot * (ch >> 4) + 3 + (ch % 16) * cw, y: Lw.top, w: cw, h: Lw.base - Lw.top };
}
function typeAt(Lw, cat, p) {
  if (!p || cat < 3) return -1;
  for (let ch = 0; ch < 96; ch += 1) {
    const r = typeTarget(Lw, cat, ch);
    if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return ch;
  }
  return -1;
}

function drawCatalogue(ctx, colors, w, params, state, anim, pointer) {
  const L = M.layout(w, params), Lw = M.wideOf(L);
  const t = state.tumor;
  const cat = anim?.cat ?? 0;
  const tt = anim?.catT ?? 1;
  const f = tt < 1 ? M.easeInOut(tt) : 1;

  text(ctx, S.tumorCaption(t), L.x0, 22, { font: capFont(colors), fill: colors.ink1 });
  text(ctx, [S.catEmpty, S.catWritten, S.catFolded, S.catGrid, S.catLined][cat], L.x0, 40, { font: noteFont(colors), fill: colors.ink2 });

  /* THE FRAME IS FIXED to the finished figure of each step (2.5): the written
     and folded bars share the class scale, so twelve bars fold into six
     without the axis moving. The grids read counts as areas, so the axis
     leaves with the split and returns, on the type scale, with the row; the
     frame widens as the square steps aside, a camera move. */
  const reach = cat < 3 ? L.x1 : cat === 3 ? M.lerp(L.x1, Lw.x1, f) : Lw.x1;
  const axis = cat < 3 ? 1 : cat === 3 ? 1 - f : f;
  withAlpha(ctx, axis, () => text(ctx, S.axisCount, L.x0 - 7, L.top - 10, { font: noteFont(colors), fill: colors.ink3, align: "left" }));
  yTicks(ctx, colors, L, cat === 4 ? t.yChannel : t.yClass, axis, reach);
  withAlpha(ctx, axis, () => rule(ctx, L.x0, L.base + 0.5, reach, L.base + 0.5, colors.axis));

  /* the square beside the bars: twelve written changes until the fold, the
     six read from the pyrimidine after it (round 3); aside at the split (4) */
  withAlpha(ctx, cat < 3 ? 1 : cat === 3 ? 1 - f : 0, () => drawSquare(ctx, colors, L, cat < 2 ? 0 : cat === 2 ? f : 1));
  if (cat >= 2) drawStrands(ctx, colors, L, cat === 2 ? f : 1);

  if (cat === 0) { writtenLabels(ctx, colors, L, 0.5); return; }

  if (cat === 1) {
    const written = M.writtenCounts(t, anim?.landed ?? t.n);
    M.CLASSES.forEach((s, k) => {
      fillRect(ctx, M.writtenRect(L, k, false, written[s], t.yClass), colors.subs[k]);
      fillRect(ctx, M.writtenRect(L, k, true, written[M.PURINE_FORM[s]], t.yClass), wash(colors.subs[k], 0.45));
    });
    writtenLabels(ctx, colors, L, 1);
    return;
  }

  if (cat === 2) {
    t.byClass.forEach(({ pyr, pur }, k) => {
      const a0 = M.writtenRect(L, k, false, pyr, t.yClass), a1 = M.foldedRect(L, k, false, pyr, pur, t.yClass);
      const b0 = M.writtenRect(L, k, true, pur, t.yClass), b1 = M.foldedRect(L, k, true, pyr, pur, t.yClass);
      fillRect(ctx, M.lerpRect(a0, a1, f), colors.subs[k]);
      fillRect(ctx, M.lerpRect(b0, b1, f), wash(colors.subs[k], 0.45));
    });
    writtenLabels(ctx, colors, L, 1 - f);
    classLabels(ctx, colors, L, f);
    drawCounts(ctx, colors, L, t, f);
    if (f >= 1) text(ctx, S.tiLine(t.ti), L.x0, L.base + 52, { font: noteFont(colors), fill: colors.ink1 });
    return;
  }

  /* 3: each class's bar comes apart into its grid; 4: each grid is read row
     by row into the 96-bar row every signature is drawn in */
  const largest = Math.max(...t.counts);
  for (let ch = 0; ch < 96; ch += 1) {
    const square = M.gridSquare(Lw, ch, t.counts[ch], largest);
    const r = cat === 3
      ? M.lerpRect(M.stackedRect(L, ch, t.counts, t.yClass), square, f)
      : M.lerpRect(square, M.channelRect(Lw, ch, t.counts[ch], t.yChannel), f);
    fillRect(ctx, r, colors.subs[ch >> 4]);
  }
  if (cat === 3) {
    classLabels(ctx, colors, L, 1 - f);
    drawCounts(ctx, colors, L, t, 1 - M.easeInOut(Math.min(1, tt * 3)));
    gridFrames(ctx, colors, Lw, f);
  } else {
    gridFrames(ctx, colors, Lw, 1 - f);
    bandLabels(ctx, colors, Lw, f);
  }
  text(ctx, S.tiLine(t.ti), L.x0, L.base + 52, { font: noteFont(colors), fill: colors.ink1 });
  if (f < 1) return;
  const top = [...t.counts.keys()].sort((a, b) => t.counts[b] - t.counts[a]).slice(0, 3);
  text(ctx, S.topLine(top.map((i) => `${M.CHANNELS[i]} ${t.counts[i]}`).join(" · ")), L.x0, L.base + 70, { font: noteFont(colors), fill: colors.ink1 });
  /* the named type: the one under the pointer, else the one chosen (round 4) */
  const hovered = typeAt(Lw, cat, pointer);
  const ch = hovered >= 0 ? hovered : M.CHANNELS.indexOf(params.type);
  if (ch < 0) return;
  text(ctx, S.typeLine(M.CHANNELS[ch], t.counts[ch]), L.x0, L.base + 88, { font: noteFont(colors), fill: colors.ink1 });
  const r = cat === 3 ? M.gridCell(Lw, ch) : M.channelRect(Lw, ch, t.counts[ch], t.yChannel);
  const h = Math.max(3, r.h);
  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x - 1.25, r.y + r.h - h - 1.25, r.w + 2.5, h + 2.5);
  ctx.restore();
}

/* ---- page 2: the factorization --------------------------------------------------- */

/** The snapshot of the descent shown `t` of the way through the press. */
function snapshotAt(fit, t) {
  const i = Math.min(fit.trace.length - 1, Math.floor(Math.max(0, t) * fit.trace.length));
  return fit.trace[i];
}

/* Page 2 is ONE SCENE at every stage: what is left of M, S's and W's frames,
   each column of S and each row of W, and the words. The extraction, both
   presses and the opened view differ only in where the scene is (`sceneOf`),
   so each press starts on the last one's final frame, op for op (the verify's
   seams), and press 3 ends on the opened view. */

/** Where page 2's scene is, at stage `sig` and `t` of the way through it. */
function sceneOf(state, sig, t) {
  const f = state.fit, r = f.rank;
  const last = f.trace[f.trace.length - 1];
  const rest = { u: Array(r).fill(0), m: 1, s: 1, w: 1, caption: 0, e: 0, f: 0, v: 0, words: 0, wide: false };
  if (sig <= 0) return { ...rest, snap: null };
  if (sig === 1) return { ...rest, snap: snapshotAt(f, t) };
  if (sig === 2) {
    const at = M.showAt(r, t * M.showTiming(r).total);
    return { ...rest, snap: last, u: at.u, m: at.m, s: at.s, caption: at.caption };
  }
  const at = M.openAt(t * M.openTiming().total);
  return {
    ...rest, snap: last, u: Array(r).fill(1), m: 0, s: 0, w: 1 - at.e, caption: 1 - at.f,
    e: at.e, f: at.f, v: at.v, words: at.words, wide: true,
  };
}

/** M and everything that goes with it: the class bands, the letters, the axis
    labels, tumor 101's outline and, once extracted, the iteration's line. */
function drawM(ctx, colors, L, params, state, snap) {
  const H = L.heat;
  const f = state.fit;
  const n = f.cols;
  const cw = H.M.w / n;
  for (let i = 0; i < 96; i += 1) {
    for (let j = 0; j < n; j += 1) {
      ctx.fillStyle = shade(colors, f.M[i][j] / f.cap);
      ctx.fillRect(H.M.x + j * cw, H.top + i * H.rowH, Math.ceil(cw), Math.ceil(H.rowH));
    }
  }
  for (let k = 0; k < 6; k += 1) {
    ctx.fillStyle = colors.subs[k];
    ctx.fillRect(H.M.x - 8, H.top + 16 * k * H.rowH + 1, 4, 16 * H.rowH - 2);
  }
  const mid = H.top + 48 * H.rowH;
  text(ctx, S.heatM, H.M.x + H.M.w / 2, 40, { font: `600 22px ${colors.font}`, fill: colors.ink1, align: "center" });
  text(ctx, "≈", H.S.x - 15, mid + 7, { font: `20px ${colors.font}`, fill: colors.ink1, align: "center" });
  text(ctx, "×", H.W.x - 13, mid + 7, { font: `18px ${colors.font}`, fill: colors.ink1, align: "center" });
  ctx.save();
  ctx.translate(16, mid);
  ctx.rotate(-Math.PI / 2);
  text(ctx, S.typesAxis, 0, 0, { font: noteFont(colors), fill: colors.ink2, align: "center" });
  ctx.restore();
  text(ctx, S.tumorsAxis(n), H.M.x + H.M.w / 2, H.base + 18, { font: noteFont(colors), fill: colors.ink2, align: "center" });
  if (params.hypermutated !== "out") {
    const x = H.M.x + (n - 1) * cw;
    ctx.save();
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, H.top - 2, Math.ceil(cw) + 2, 96 * H.rowH + 4);
    ctx.restore();
    text(ctx, S.hyperTag, x + cw, H.base + 32, { font: noteFont(colors), fill: colors.ink1, align: "right" });
  }
  if (!snap) return;
  text(ctx, S.iterLine(snap.iter, snap.kl), H.M.x, H.base + 48, { font: noteFont(colors), fill: colors.ink1 });
  text(ctx, S.heatNote(M.intText(f.cap)), H.M.x, H.base + 66, { font: noteFont(colors), fill: colors.ink3 });
}

/** S's letter, label and frame; its cells are the columns. */
function drawSFrame(ctx, colors, L, state) {
  const H = L.heat;
  text(ctx, S.heatS, H.S.x + H.S.w / 2, 40, { font: `600 22px ${colors.font}`, fill: colors.ink1, align: "center" });
  text(ctx, S.sigAxis(state.fit.rank), H.S.x + H.S.w / 2, H.base + 18, { font: noteFont(colors), fill: colors.ink2, align: "center" });
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(H.S.x - 0.5, H.top - 0.5, H.S.w, 96 * H.rowH + 1);
  ctx.restore();
}

/** W's letter, label and frame; its cells are the rows. */
function drawWFrame(ctx, colors, L, state) {
  const H = L.heat, r = state.fit.rank, top = M.wTop(L, r);
  text(ctx, S.heatW, H.W.x + H.W.w / 2, top - 12, { font: `600 22px ${colors.font}`, fill: colors.ink1, align: "center" });
  text(ctx, S.tumorsAxis(state.fit.cols), H.W.x + H.W.w / 2, top + r * (M.W_ROW + 1) + 16,
    { font: noteFont(colors), fill: colors.ink2, align: "center" });
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(H.W.x - 0.5, top - 0.5, H.W.w + 1, r * (M.W_ROW + 1));
  ctx.restore();
}

/** Tumor 101's mark on its cell of W: the outline it wears in M, and once the
    cell has stood up as a bar, a mark under it. A mark under the bar rather
    than a box round it, because in the tumor's own signature it is the first
    bar and the half rule stands right beside it. */
function markTumor(ctx, colors, c, base, stand) {
  withAlpha(ctx, 1 - stand, () => {
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
  });
  withAlpha(ctx, stand, () => {
    const cx = c.x + c.w / 2;
    ctx.fillStyle = colors.ink1;
    ctx.beginPath();
    ctx.moveTo(cx, base + 2);
    ctx.lineTo(cx + 3, base + 6);
    ctx.lineTo(cx - 3, base + 6);
    ctx.closePath();
    ctx.fill();
  });
}

/** Column k of S as the strip `strip`, its cells shaded from `vals` and
    standing `stand` of the way up as bars in the class colours, so the value
    moves from the shade to the height; its baseline, class bands and title
    arrive as they stand. */
function drawColumn(ctx, colors, L, state, k, vals, strip, stand, moving) {
  const f = state.fit, s = f.sigs[k], R = L.rows[k];
  const pmax = M.niceMax(Math.max(...s.profile));
  const pH = R.profile.base - R.profile.top;
  ctx.save();
  ctx.translate(strip.px, strip.py);
  ctx.rotate(strip.ang);
  for (let i = 0; i < 96; i += 1) {
    const c = M.stripCell(strip, i, moving, stand, Math.min(1, s.profile[i] / pmax) * pH);
    if (c.w <= 0) continue;
    const tone = shade(colors, Math.sqrt(vals[i] / f.sigMax));
    ctx.fillStyle = stand > 0 ? mixHex(tone, colors.subs[i >> 4], stand) : tone;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  ctx.restore();
  withAlpha(ctx, stand, () => {
    const x0 = strip.px - strip.len, bw = strip.len / 96;
    rule(ctx, x0, R.profile.base + 0.5, strip.px, R.profile.base + 0.5, colors.axis);
    for (let c = 0; c < 6; c += 1) {
      ctx.fillStyle = colors.subs[c];
      ctx.fillRect(x0 + 16 * c * bw + 1, R.profile.base + 3, 16 * bw - 2, 3);
    }
    text(ctx, S.sigTitle(k + 1), L.x0, R.title, { font: capFont(colors), fill: colors.ink1 });
    text(ctx, S.sigShare(s.share), L.x0 + 86, R.title, { font: noteFont(colors), fill: colors.ink2 });
  });
}

/** W's row k as the rect `row`: each tumor one cell, then one bar in M's column
    order, until the sort (`v`) sends each to its place, largest first; the
    tumors holding half of the exposure stay dark once sorted. */
function drawWRow(ctx, colors, L, params, state, k, vals, row, stand, v) {
  const f = state.fit, s = f.sigs[k], R = L.rows[k], n = f.cols;
  const hyperJ = params.hypermutated === "out" ? -1 : state.cohort.hyperIndex;
  const stripH = R.strip.base - R.strip.top;
  const top = s.exposure[s.sorted[0]] || 1;
  for (let j = 0; j < n; j += 1) {
    const e = Math.max(0, s.exposure[j]);
    const c = M.rowCell(row, n, M.lerp(j, s.place[j], v), stand, (e / top) * stripH);
    const tone = shade(colors, Math.sqrt(Math.max(0, vals[j]) / f.expoMax));
    const bar = v >= 1 ? (s.place[j] < s.hold.half ? colors.ink2 : wash(colors.ink3, 0.55)) : colors.ink2;
    if (c.h > 0) {
      ctx.fillStyle = stand <= 0 ? tone : stand >= 1 ? bar : mixHex(tone, colors.ink2, stand);
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }
    if (j === hyperJ) markTumor(ctx, colors, c, row.y + row.h, stand);
  }
  withAlpha(ctx, stand, () => rule(ctx, L.x0, R.strip.base + 0.5, L.x1, R.strip.base + 0.5, colors.axis));
}

/** The opened view's words and its half rules, which arrive last. */
function drawOpenedWords(ctx, colors, L, state) {
  const f = state.fit;
  text(ctx, S.openedCaption, L.x0, 22, { font: capFont(colors), fill: colors.ink1 });
  f.sigs.forEach((s, k) => {
    const R = L.rows[k];
    /* after the tumors that hold half of it: in ink, as violet means "larger"
       on this page, and down to the baseline only, clear of tumor 101's mark */
    const xh = L.x0 + s.hold.half * ((L.x1 - L.x0) / f.cols);
    rule(ctx, xh, R.strip.top - 3, xh, R.strip.base, colors.ink1, 1.5);
    text(ctx, S.halfLine(s.hold.half), L.x0, R.stripLabel, { font: noteFont(colors), fill: colors.ink1 });
    text(ctx, S.topTumor(s.hold.top, s.hold.top === state.cohort.hyperIndex, s.hold.topShare), L.x1, R.stripLabel,
      { font: noteFont(colors), fill: colors.ink2, align: "right" });
  });
}

function drawSignatures(ctx, colors, w, params, state, anim) {
  const f = state.fit, r = f.rank;
  const L = M.layout(w, params);
  const sc = sceneOf(state, anim?.sig ?? 0, anim?.sigT ?? 1);
  withAlpha(ctx, sc.m, () => drawM(ctx, colors, L, params, state, sc.snap));
  withAlpha(ctx, sc.s, () => drawSFrame(ctx, colors, L, state));
  withAlpha(ctx, sc.w, () => drawWFrame(ctx, colors, L, state));
  withAlpha(ctx, sc.caption, () => text(ctx, S.shownCaption, L.x0, 22, { font: capFont(colors), fill: colors.ink1 }));
  if (!sc.snap) return;
  /* the columns still waiting first, so a moving one passes over them */
  const order = [...sc.u.keys()].sort((a, b) => (sc.u[a] > 0) - (sc.u[b] > 0));
  for (const k of order) {
    const J = M.column(L, r, k, sc.u[k]);
    drawColumn(ctx, colors, L, state, k, sc.snap.sigs[k], sc.wide ? M.widened(L, k, sc.f) : J.strip,
      sc.wide ? 1 : J.stand, sc.u[k] > 0);
  }
  for (let k = 0; k < r; k += 1) {
    drawWRow(ctx, colors, L, params, state, k, sc.snap.expo[k], M.wRow(L, r, k, sc.e, sc.f), sc.f, sc.v);
  }
  withAlpha(ctx, sc.words, () => drawOpenedWords(ctx, colors, L, state));
}

/* ---- page 3: matching ------------------------------------------------------------- */

/* The comparison is a scan, and a click on another row afterwards eases the
   panel below into the new signature's (round 3). */

/** A profile's bar heights in a panel, so two can be eased between. */
function barHeights(v, top, base) {
  const m = M.niceMax(Math.max(...v));
  return Array.from(v, (x) => Math.min(1, x / m) * (base - top));
}

function drawMatching(ctx, colors, w, params, state, anim) {
  const L = M.layout(w, params);
  const f = state.fit;
  const sig = anim?.sig ?? 0;
  const match = anim?.match ?? 0;
  const mt = anim?.matchT ?? 1;
  text(ctx, S.matchCaption, L.x0 - 36, 18, { font: capFont(colors), fill: colors.ink1 });

  M.REFERENCES.forEach((r, j) => {
    ctx.save();
    ctx.translate(L.cellX + (j + 0.5) * L.cellW + 4, L.heatTop - 8);
    ctx.rotate(-Math.PI / 2);
    text(ctx, r.name, 0, 0, { font: noteFont(colors), fill: colors.ink1 });
    ctx.restore();
  });

  if (sig === 0) {
    text(ctx, S.noSignatures, L.cellX, L.heatTop + 20, { font: noteFont(colors), fill: colors.ink2 });
    text(ctx, S.referencesNote, L.x0 - 36, L.height - 10, { font: noteFont(colors), fill: colors.ink3 });
    return;
  }
  const shown = anim?.shownRow ?? openIndex(params);
  const from = anim?.fromRow ?? shown;
  const e = M.easeInOut(anim?.easeT ?? 1);
  const scanRow = anim?.scanRow ?? shown;
  const at = match >= 1 ? M.compareAt(mt * M.compareTiming().total, f.rank, scanRow) : null;
  const pressing = at && mt < 1;
  /* the row the panel is about: the scanned one while the press runs, then the
     chosen one, its label turning bold halfway through an ease */
  const marked = !at ? -1 : pressing ? scanRow : e < 0.5 ? from : shown;
  const rowMid = (k) => L.heatTop + (k + 0.5) * M.MATCH_ROW;

  f.sigs.forEach((s, k) => {
    const y = L.heatTop + k * M.MATCH_ROW;
    text(ctx, S.sigTitle(k + 1), L.labelX, y + M.MATCH_ROW / 2 + 4,
      { font: k === marked ? capFont(colors) : noteFont(colors), fill: colors.ink1, align: "right" });
    M.REFERENCES.forEach((r, j) => {
      const x = L.cellX + j * L.cellW;
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, L.cellW - 1, M.MATCH_ROW - 1);
      ctx.restore();
      if (!at) return;
      const c = s.match.find((m) => m.key === r.key).cos;
      withAlpha(ctx, at.cell[k][j], () => {
        const fill = shade(colors, (c - 0.1) / 0.9);
        ctx.fillStyle = fill;
        ctx.fillRect(x + 1, y + 1, L.cellW - 2, M.MATCH_ROW - 2);
        text(ctx, M.cell2(c), x + L.cellW / 2, y + M.MATCH_ROW / 2 + 4,
          { font: monoFont(colors), fill: inkOn(colors, fill), align: "center" });
      });
      if (s.match[0].key === r.key) {
        /* cased by a line of the surface inside it, so it reads on the
           strongest violet in either theme */
        withAlpha(ctx, at.outline, () => {
          ctx.save();
          ctx.strokeStyle = colors.ink1;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1.5, y + 1.5, L.cellW - 3, M.MATCH_ROW - 3);
          ctx.strokeStyle = colors.surface;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3, y + 3, L.cellW - 6, M.MATCH_ROW - 6);
          ctx.restore();
        });
      }
    });
  });
  if (!at) {
    text(ctx, S.referencesNote, L.x0 - 36, L.height - 10, { font: noteFont(colors), fill: colors.ink3 });
    return;
  }

  /* the cell being filled, outlined while its reference is laid below */
  if (at.comparing >= 0) {
    const x = L.cellX + at.comparing * L.cellW, y = L.heatTop + scanRow * M.MATCH_ROW;
    ctx.save();
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, L.cellW - 1.5, M.MATCH_ROW - 1.5);
    ctx.restore();
  }
  /* the mark beside the row the panel is about, moving with an ease */
  withAlpha(ctx, at.own, () => {
    const ym = pressing ? rowMid(scanRow) : M.lerp(rowMid(from), rowMid(shown), e);
    ctx.fillStyle = colors.ink1;
    ctx.beginPath();
    ctx.moveTo(10, ym - 4);
    ctx.lineTo(16, ym);
    ctx.lineTo(10, ym + 4);
    ctx.closePath();
    ctx.fill();
  });
  if (params.truth === "on") {
    withAlpha(ctx, at.built, () => f.sigs.forEach((s, k) => {
      text(ctx, S.builtLine(k + 1, M.builtText(s.mix)), L.x0 - 36, L.builtTop + k * M.BUILT_ROW, { font: noteFont(colors), fill: colors.ink2 });
    }));
  }

  /* the panel: the signature, then the reference laid under it */
  const B = L.b;
  const heads = (s, which, alpha) => withAlpha(ctx, alpha, () => {
    const m = which === "best" ? s.match[0] : s.match[1];
    const P = B[which];
    text(ctx, which === "best" ? S.bestLabel(m) : S.runnerLabel(m), L.x0, P.label,
      { font: which === "best" ? capFont(colors) : noteFont(colors), fill: colors.ink1 });
    text(ctx, `${S.cosLabel(m.cos)} · ${S.modelledOn(m)}`, L.x1, P.label, { font: noteFont(colors), fill: colors.ink2, align: "right" });
  });
  const bars = (va, vb, P) => {
    const a = barHeights(va, P.top, P.base), b = barHeights(vb, P.top, P.base);
    profileBars(ctx, colors, a.map((h, i) => M.lerp(h, b[i], e)), { x0: L.x0, x1: L.x1, top: P.top, base: P.base, max: P.base - P.top });
  };
  if (pressing) {
    const s = f.sigs[scanRow];
    withAlpha(ctx, at.own, () => {
      text(ctx, S.sigTitle(scanRow + 1), L.x0, B.top + 12, { font: capFont(colors), fill: colors.ink1 });
      text(ctx, S.sigShare(s.share), L.x0 + 86, B.top + 12, { font: noteFont(colors), fill: colors.ink2 });
      profileBars(ctx, colors, s.profile, { x0: L.x0, x1: L.x1, top: B.own.top, base: B.own.base });
    });
    if (at.comparing >= 0) {
      const r = M.REFERENCES[at.comparing];
      const m = s.match.find((x) => x.key === r.key);
      withAlpha(ctx, at.comparingIn, () => {
        text(ctx, S.comparedLabel(r.name), L.x0, B.best.label, { font: capFont(colors), fill: colors.ink1 });
        text(ctx, `${S.cosLabel(m.cos)} · ${S.modelledOn(m)}`, L.x1, B.best.label, { font: noteFont(colors), fill: colors.ink2, align: "right" });
        profileBars(ctx, colors, r.profile, { x0: L.x0, x1: L.x1, top: B.best.top, base: B.best.base });
      });
    } else {
      heads(s, "best", 1);
      profileBars(ctx, colors, M.REF[s.match[0].key].profile, { x0: L.x0, x1: L.x1, top: B.best.top, base: B.best.base });
      heads(s, "runner", at.runner);
      withAlpha(ctx, at.runner, () => profileBars(ctx, colors, M.REF[s.match[1].key].profile, { x0: L.x0, x1: L.x1, top: B.runner.top, base: B.runner.base }));
    }
  } else {
    const sa = f.sigs[from], sb = f.sigs[shown];
    withAlpha(ctx, 1 - e, () => {
      text(ctx, S.sigTitle(from + 1), L.x0, B.top + 12, { font: capFont(colors), fill: colors.ink1 });
      text(ctx, S.sigShare(sa.share), L.x0 + 86, B.top + 12, { font: noteFont(colors), fill: colors.ink2 });
    });
    withAlpha(ctx, e, () => {
      text(ctx, S.sigTitle(shown + 1), L.x0, B.top + 12, { font: capFont(colors), fill: colors.ink1 });
      text(ctx, S.sigShare(sb.share), L.x0 + 86, B.top + 12, { font: noteFont(colors), fill: colors.ink2 });
    });
    bars(sa.profile, sb.profile, B.own);
    heads(sa, "best", 1 - e);
    heads(sb, "best", e);
    bars(M.REF[sa.match[0].key].profile, M.REF[sb.match[0].key].profile, B.best);
    heads(sa, "runner", 1 - e);
    heads(sb, "runner", e);
    bars(M.REF[sa.match[1].key].profile, M.REF[sb.match[1].key].profile, B.runner);
  }
  text(ctx, S.referencesNote, L.x0 - 36, L.height - 10, { font: noteFont(colors), fill: colors.ink3 });
}

/* ---- the drives ------------------------------------------------------------------- */

/** One frame of page 1's press: the arrival, the fold, the split into grids
    or the line-up. */
const catSpan = (cat) => (cat === 2 ? M.FOLD_MS : cat === 3 ? M.SPLIT_MS : M.LINE_MS);
function takeCatStep(anim, dt, t) {
  if (anim.catT < 1) {
    anim.catT = Math.min(1, anim.catT + dt / catSpan(anim.cat));
    return anim.catT < 1;
  }
  if (anim.cat === 1 && anim.landed < t.n) {
    anim.clock += dt;
    anim.landed = Math.min(t.n, Math.ceil((t.n * anim.clock) / M.LAND_MS));
    return anim.landed < t.n;
  }
  if (anim.cat >= M.CAT_STAGES) return false;
  anim.cat += 1;
  if (anim.cat === 1) {
    anim.clock = dt;
    anim.landed = Math.min(t.n, Math.ceil((t.n * anim.clock) / M.LAND_MS));
    return anim.landed < t.n;
  }
  anim.catT = Math.min(1, dt / catSpan(anim.cat));
  return anim.catT < 1;
}

/** One frame of page 2's press: the descent, the signatures drawn beside W, or
    each opened out with its exposures. */
function takeSigStep(anim, dt, rank) {
  const span = () => (anim.sig === 1 ? M.DESCENT_MS : anim.sig === 2 ? M.showTiming(rank).total : M.openTiming().total);
  if (anim.sigT < 1) {
    anim.sigT = Math.min(1, anim.sigT + dt / span());
    return anim.sigT < 1;
  }
  if (anim.sig >= M.SIG_STAGES) return false;
  anim.sig += 1;
  anim.sigT = Math.min(1, dt / span());
  return anim.sigT < 1;
}

/** One frame of page 3's press: the extraction if page 2 has not run it, which
    lands at once (its descent is page 2's to draw), then the comparison, a
    scan of the chosen row. */
function takeMatchStep(anim, dt) {
  const total = M.compareTiming().total;
  if (anim.matchT < 1) {
    anim.matchT = Math.min(1, anim.matchT + dt / total);
    return anim.matchT < 1;
  }
  if (anim.sig === 0) { anim.sig = 1; anim.sigT = 1; return false; }
  if (anim.match >= M.MATCH_STAGES) return false;
  anim.match += 1;
  anim.scanRow = anim.shownRow ?? 0;
  anim.matchT = Math.min(1, dt / total);
  return anim.matchT < 1;
}

function settle(anim) {
  if (anim.page === "signatures") anim.done = anim.sig >= M.SIG_STAGES && anim.sigT >= 1;
  else if (anim.page === "matching") anim.done = anim.match >= M.MATCH_STAGES && anim.matchT >= 1;
  else anim.done = anim.cat >= M.CAT_STAGES && anim.catT >= 1;
  anim.labelAt = M.labelStage(anim);
}

/* ---- the widget ------------------------------------------------------------------- */

const classLegend = () => M.CLASSES.map((c, k) => ({ token: SUB_TOKENS[k], label: c, mark: "bar" }));
const ON_PAGES_2_3 = { param: "page", oneOf: ["signatures", "matching"] };

defineWidget({
  slug: "mutational-signatures",
  title: "Mutational Signatures",
  status: "draft",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* Decision 5: display, so the extraction survives a visit to page 1. */
    page: { type: "segmented", label: S.pageLabel, detail: S.pageDetail, options: M.PAGES, default: "catalogue", display: true },

    tumorSec: { type: "section", label: S.tumorSection, when: { param: "page", equals: "catalogue" } },
    /* Decision 4 and 5: two of page 2's tumors, and display, so choosing one
       starts page 1 over without undoing the extraction. */
    tumor: {
      type: "segmented", label: S.tumorLabel, detail: S.tumorDetail, options: M.TUMOR_OPTIONS, default: "largest",
      display: true, when: { param: "page", equals: "catalogue" },
    },

    cohortSec: { type: "section", label: S.cohortSection, when: ON_PAGES_2_3 },
    /* His pick 3: in, as the lesson's cohort has one, and a switch to leave it out. */
    hypermutated: {
      type: "segmented", label: S.hyperLabel, detail: S.hyperDetail, options: M.HYPER_OPTIONS, default: "in",
      when: ON_PAGES_2_3,
    },
    rank: {
      type: "int", label: S.rankLabel, detail: S.rankDetail, min: M.RANK_MIN, max: M.RANK_MAX, default: M.RANK_DEFAULT,
      when: ON_PAGES_2_3,
    },

    lookSec: { type: "section", label: S.lookSection, when: { param: "page", equals: "matching" } },
    /* The signature page 3 opens beside its matches. A row of the heatmap sets
       it too (3.6), so the control is the keyboard's way to the same place. */
    signature: {
      type: "segmented", label: S.openLabel, detail: S.openDetail,
      options: (v) => Array.from({ length: v.rank }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      optionsFrom: "rank", default: "1", display: true, when: { param: "page", equals: "matching" },
    },

    /* Round 4, his pick: a click on a grid's square or on a bar names its type
       in the line under the figure; this is the keyboard's way to the same
       (3.6), the 96 grouped by class. BELOW THE BUTTONS (3.4j): it names a
       type once the bars are split and changes nothing before, and declared
       under Tumor it read as a choice of which mutations to add (his question,
       2026-09-19). Page 3's Signature stays above Compare: it picks the row
       the scan runs over, so it means something before the press. */
    typeSec: { type: "section", label: S.lookSection, afterDrive: true, when: { param: "page", equals: "catalogue" } },
    type: {
      type: "select", label: S.typeLabel, detail: S.typeDetail, options: M.TYPE_OPTIONS, default: M.TYPE_DEFAULT,
      display: true, afterDrive: true, when: { param: "page", equals: "catalogue" },
    },

    dataSec: { type: "section", label: S.dataSection, afterDrive: true },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1, afterDrive: true },
    /* 3.7: a reveal is "True <noun>", Off/On, directly after Seed. On by
       default, his pick 4: what built each signature is printed. The link
       carries the words the control shows, off/on, as every True-X switch in
       the collection does (5.9; the copy audit, 2026-09-19). */
    truth: {
      type: "segmented", label: S.truthLabel, detail: S.truthDetail,
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }], default: "on",
      display: true, afterDrive: true, when: { param: "page", equals: "matching" },
    },

    /* Authoring escape hatch, first render only: the presses already taken on
       the page it opens with. */
    shown: { type: "int", min: 0, max: M.CAT_STAGES, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "signatures") {
      return [
        { token: "magnitude", label: S.legendHeat, mark: "bar" },
        ...classLegend(),
        ...(params.hypermutated === "out" ? [] : [{ token: "ink-1", label: S.legendHyper, mark: "tri" }]),
      ];
    }
    if (params.page === "matching") {
      return [
        { token: "magnitude", label: S.legendCosine, mark: "bar" },
        { token: "ink-1", label: S.legendBest, mark: "line" },
        ...classLegend(),
      ];
    }
    return [...classLegend(), { token: "ink-3", label: S.legendPurine, mark: "bar" }];
  },

  compute({ params }) {
    const cohort = M.cohortFor(params.seed);
    const tumor = M.tumorFor(params.seed, params.tumor);
    /* Page 1 draws no extraction, so it waits for a page that does (decision 7). */
    const fit = params.page === "catalogue" ? null : M.fitFor(params.seed, params.hypermutated, params.rank);
    return { cohort, tumor, fit };
  },

  /* Round 4: the pointer names the type under it on page 1, and a click pins
     it. Core hands regions the stage (`anim`) for this alone: the targets are
     a grid's cells after the split and the bars' columns once lined up. */
  pointer: true,
  regions: ({ w, params, state, anim }) => {
    if (params.page === "catalogue") {
      const cat = anim?.cat ?? 0;
      if (!state || cat < 3) return [];
      const Lw = M.wideOf(M.layout(w, params));
      return M.CHANNELS.map((c, ch) => ({ ...typeTarget(Lw, cat, ch), set: { type: c }, label: c }));
    }
    if (params.page !== "matching" || !state?.fit) return [];
    const L = M.layout(w, params);
    return state.fit.sigs.map((_, k) => ({
      x: 0, y: L.heatTop + k * M.MATCH_ROW, w, h: M.MATCH_ROW,
      set: { signature: String(k + 1) }, label: S.sigTitle(k + 1),
    }));
  },

  animation: {
    /* The button names the next press of the page on screen (4.4b), keyed on
       the drive's own counter as widget 69's is. */
    stepLabel: { anim: "labelAt", labels: S.stepLabels, default: S.stepLabels.k0 },
    stepTitle: S.stepTitle,
    /* Decision 6: no Play. */
    runLabel: null,

    init: ({ params, state, fromScratch }) => {
      /* `shown` opens the page it is given with, and the others stay empty. */
      const shown = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      /* shownRow is the signature page 3's panel shows; fromRow and easeT ease
         it into another after a click (round 3); scanRow is the one scanned. */
      const row = openIndex(params);
      const anim = {
        page: params.page, tumor: params.tumor, cat: 0, catT: 1, landed: 0, clock: 0, sig: 0, sigT: 1, match: 0, matchT: 1,
        shownRow: row, fromRow: row, easeT: 1, scanRow: row,
      };
      if (params.page === "catalogue") {
        anim.cat = Math.min(M.CAT_STAGES, shown);
        anim.landed = anim.cat >= 1 ? state.tumor.n : 0;
      } else if (params.page === "signatures") {
        anim.sig = Math.min(M.SIG_STAGES, shown);
      } else {
        anim.sig = shown >= 1 ? 1 : 0;
        anim.match = Math.min(M.MATCH_STAGES, shown);
      }
      settle(anim);
      return anim;
    },

    advance: (anim, { dt, state }) => {
      /* core's display ease: page 3's panel into the signature just chosen */
      if (anim.mode === "ease") {
        anim.easeT = Math.min(1, anim.easeT + dt / M.EASE_MS);
        return anim.easeT < 1;
      }
      const more = anim.page === "signatures" ? takeSigStep(anim, dt, state.fit.rank)
        : anim.page === "matching" ? takeMatchStep(anim, dt)
          : takeCatStep(anim, dt, state.tumor);
      settle(anim);
      return more;
    },

    rebuild: (anim, { params }) => {
      /* Each page keeps its place, because the page is a display parameter
         (invariant 3). Another tumor starts page 1's own walk over. */
      anim.page = params.page;
      if (params.tumor !== anim.tumor) {
        anim.tumor = params.tumor;
        anim.cat = 0;
        anim.catT = 1;
        anim.landed = 0;
        anim.clock = 0;
      }
      /* Another signature on page 3: once compared, the panel eases into it
         (round 3); before, or while the scan runs, it is simply the one shown. */
      const row = openIndex(params);
      if (row !== anim.shownRow) {
        const compared = params.page === "matching" && anim.match >= M.MATCH_STAGES && anim.matchT >= 1;
        anim.fromRow = compared ? anim.shownRow : row;
        anim.shownRow = row;
        anim.easeT = compared ? 0 : 1;
        if (compared) anim.easing = true;
      }
      settle(anim);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    /* The card is mounted from here, never at module scope: `buildShell`
       creates `.w-figure` inside `defineWidget`. */
    renderCard(cardFor(params, state, anim));
    if (params.page === "signatures") { drawSignatures(ctx, colors, w, params, state, anim); return; }
    if (params.page === "matching") { drawMatching(ctx, colors, w, params, state, anim); return; }
    drawCatalogue(ctx, colors, w, params, state, anim, pointer);
  },

  readout({ params, state, anim }) {
    if (params.page === "signatures") {
      const f = state.fit;
      const sig = anim?.sig ?? 0;
      const extracted = sig >= 2 || (sig === 1 && (anim?.sigT ?? 1) >= 1);
      const opened = sig >= M.SIG_STAGES && (anim?.sigT ?? 1) >= 1;
      const widest = f.sigs.map((s, k) => ({ s, k })).sort((a, b) => b.s.hold.topShare - a.s.hold.topShare)[0];
      return [
        { label: S.tileTumors, value: M.intText(f.cols), note: S.tileTumorsNote(f.total) },
        { label: S.tileSignatures, value: extracted ? String(f.rank) : "—", note: extracted ? S.tileIterations(f.iterations) : S.tileToExtract(f.rank) },
        {
          label: S.tileLargest,
          value: opened ? M.pct(widest.s.hold.topShare) : "—",
          note: opened ? S.tileLargestNote(widest.k + 1, widest.s.hold.top) : S.tileLargestWait,
        },
      ];
    }
    if (params.page === "matching") {
      const f = state.fit;
      const k = openIndex(params);
      const s = f.sigs[k];
      const compared = (anim?.match ?? 0) >= 1 && (anim?.matchT ?? 1) >= 1;
      return [
        { label: S.tileBest, value: compared ? M.cos3(s.match[0].cos) : "—", note: compared ? s.match[0].name : S.tileFor(k + 1) },
        { label: S.tileRunner, value: compared ? M.cos3(s.match[1].cos) : "—", note: compared ? s.match[1].name : S.tileFor(k + 1) },
        { label: S.tileMargin, value: compared ? M.cos3(s.match[0].cos - s.match[1].cos) : "—", note: S.tileMarginNote },
      ];
    }
    const t = state.tumor;
    const cat = anim?.cat ?? 0;
    const landed = cat >= 2 ? t.n : cat === 1 ? Math.min(t.n, anim?.landed ?? t.n) : 0;
    return [
      { label: S.tileSubstitutions, value: cat >= 1 ? M.intText(landed) : "—", note: S.tileInTumor(t.index + 1) },
      { label: S.tileTransitions, value: cat >= 2 ? M.pct(t.ti) : "—", note: S.tileTransitionsNote },
      { label: S.tileTypes, value: cat >= 3 && (anim?.catT ?? 1) >= 1 ? String(t.typesHit) : "—", note: S.tileTypesNote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "signatures") {
      const f = state.fit;
      const sig = anim?.sig ?? 0;
      if (sig === 0) return S.sumM(f.cols);
      if (sig === 1) return S.sumExtracted(f.cols, f.rank, f.iterations);
      if (sig === 2) return S.sumShown(f.rank);
      const own = f.sigs.findIndex((s) => s.own);
      return S.sumOpened(f.rank, own >= 0 ? own + 1 : null);
    }
    if (params.page === "matching") {
      const f = state.fit;
      if ((anim?.sig ?? 0) === 0) return S.sumNoSignatures;
      if ((anim?.match ?? 0) < 1 || (anim?.matchT ?? 1) < 1) return S.sumNotCompared(f.rank);
      const k = openIndex(params);
      const s = f.sigs[k];
      return S.sumCompared(f.rank, k + 1, s.match[0], s.match[1]);
    }
    const t = state.tumor;
    const cat = anim?.cat ?? 0;
    return S.sumCatalogue(cat, t);
  },
});
