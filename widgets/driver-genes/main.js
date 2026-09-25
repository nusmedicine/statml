/* ============================================================================
   Widget 69 · Cancer Driver Genes — PHM5003 07 / 01-3 cells 12–25.

   `model.js` carries the engine, the stage and the copy, and the decisions
   taken while building; this file draws them. Two pages, from Kenneth's picks
   of 2026-09-17: One gene · The cohort.

   The drawing rules this file keeps to:

     · On page 1 a residue's head is ROUND for missense and SQUARE for
       truncating, so colour is left for the one thing to look at: the
       residues at or above the threshold, in `--c-highlight` (cells 19–25's
       classes, without spending a hue on them).
     · The background a score is judged against is `--c-reference`, and the
       tail past the gene's score is `--c-extreme`, what a p-value counts.
     · On page 2 a RING is a call and COLOUR is the kind the simulation gave,
       so colour carries one grouping (§ *Widget 42*): oncogenes `--c-group-a`,
       tumor suppressors `--c-group-b`, passengers in ink.
   ========================================================================= */

import { defineWidget, makePlot, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

const S = M.STRINGS;

const reducedMotion = () => (typeof matchMedia === "function"
  && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---- the formula card ------------------------------------------------------
   Widget 67's machinery, as Kenneth asked of that widget: the general form in
   the lesson's terms, then this figure's own numbers, each read from the state
   the figure drew (5.8). A number appears only once its step has been taken
   (2.4), so the card does not state what the figure has not yet shown. */
const MATHML = mathmlRenders();
const mi = (s) => `<mi>${s}</mi>`;
const mn = (x) => `<mn>${x}</mn>`;
const mo = (s) => `<mo>${s}</mo>`;
const sub = (a, b) => `<msub>${a}${b}</msub>`;

const row = (label, ...parts) =>
  `<div class="w-math-eq" style="min-height:0;padding-left:0;text-indent:0;margin:0;`
  + `display:flex;align-items:baseline;gap:10px;line-height:2.4">`
  + `<span style="color:var(--ink-3);font-size:var(--fs-xs);white-space:nowrap;`
  + `line-height:1.4;flex:0 0 7.5em;text-align:right">${label}</span>`
  + `<span style="display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px">`
  + parts.filter(Boolean).map((p) => `<span>${p}</span>`).join("")
  + `</span></div>`;

/* th = min{x ≥ 2 : P(X = x) < 0.01}, X ~ Binomial(n, 1/L) — get_threshold */
const THRESHOLD_MATH = `<math><mrow>${mi("th")}${mo("=")}<munder>${mi("min")}<mrow>${mi("x")}${mo("&#x2265;")}${mn(2)}</mrow></munder>`
  + `${mo("{")}${mi("x")}${mo(":")}${mi("P")}${mo("(")}${mi("X")}${mo("=")}${mi("x")}${mo(")")}${mo("&lt;")}${mn("0.01")}${mo("}")}`
  + `${mo(",")}<mspace width="0.8em"/>${mi("X")}${mo("&#x223C;")}<mtext>Binomial</mtext>${mo("(")}${mi("n")}${mo(",")}`
  + `<mfrac>${mn(1)}${mi("L")}</mfrac>${mo(")")}</mrow></math>`;
const THRESHOLD_PLAIN = "th = min{x ≥ 2 : P(X = x) < 0.01}, X ~ Binomial(n, 1/L)";

/* s = Σᵢ (nᵢ / n) / √2^dᵢ — cluster_prot's score */
const CLUSTER_MATH = `<math><mrow>${mi("s")}${mo("=")}<munder>${mo("&#x2211;")}${mi("i")}</munder><mfrac>`
  + `<mrow>${sub(mi("n"), mi("i"))}${mo("/")}${mi("n")}</mrow>`
  + `<msup><msqrt>${mn(2)}</msqrt>${sub(mi("d"), mi("i"))}</msup></mfrac></mrow></math>`;
const CLUSTER_PLAIN = "s = Σᵢ (nᵢ / n) / √2^dᵢ";

/* S = Σ s, z = (S − 0.279) / 0.13 — oncodrive's gene score and z */
const GENE_MATH = `<math><mrow>${mi("S")}${mo("=")}${mo("&#x2211;")}${mi("s")}${mo(",")}<mspace width="0.8em"/>`
  + `${mi("z")}${mo("=")}<mfrac><mrow>${mi("S")}${mo("&#x2212;")}${mn("0.279")}</mrow>${mn("0.13")}</mfrac></mrow></math>`;
const GENE_PLAIN = "S = Σ s, z = (S − 0.279) / 0.13";

/* z and its one-sided p, then Benjamini-Hochberg over the table */
const ZP_MATH = `<math><mrow>${mi("z")}${mo("=")}<mfrac><mrow>${mi("S")}${mo("&#x2212;")}${mn("0.279")}</mrow>${mn("0.13")}</mfrac>`
  + `${mo(",")}<mspace width="0.8em"/>${mi("p")}${mo("=")}${mi("P")}${mo("(")}${mi("Z")}${mo("&#x2265;")}${mi("z")}${mo(")")}</mrow></math>`;
const ZP_PLAIN = "z = (S − 0.279) / 0.13, p = P(Z ≥ z)";
const FDR_MATH = `<math><mrow>${sub(mi("q"), `<mrow>${mo("(")}${mi("i")}${mo(")")}</mrow>`)}${mo("=")}`
  + `<munder>${mi("min")}<mrow>${mi("j")}${mo("&#x2265;")}${mi("i")}</mrow></munder>`
  + `<mfrac><mrow>${sub(mi("p"), `<mrow>${mo("(")}${mi("j")}${mo(")")}</mrow>`)}${mo("&#x2062;")}${mi("m")}</mrow>${mi("j")}</mfrac></mrow></math>`;
const FDR_PLAIN = "q(i) = min over j ≥ i of p(j) m / j";

const numbers = (s) => (MATHML
  ? `<math><mrow><mtext>${s}</mtext></mrow></math>`
  : `<span style="font-family:var(--font-mono)">${s}</span>`);

let mathHost = null;
let mathKey = null;
function renderCard(rows, note) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = `${rows.map((r) => r.join("~")).join("|")}|${note}`;
  if (key === mathKey) return;
  mathKey = key;
  mathHost.innerHTML = rows.map(([label, ...parts]) => row(label, ...parts)).join("")
    + `<p class="w-math-note">${note}</p>`;
}

/** A sum of terms, the largest first, shortened past `max` terms. */
function sumText(values, max = 6) {
  const shown = values.slice(0, max).map(M.part3);
  return `${shown.join(" + ")}${values.length > max ? " + …" : ""}`;
}

function cardFor(params, state, anim) {
  if (params.page === "cohort") {
    const c = state.cohort;
    const stage = anim?.cohort ?? M.COHORT_STAGES;
    const called = c.table.filter((g) => g.called).length;
    const first = c.byP[0];
    return {
      rows: [
        [S.labelGene, MATHML ? ZP_MATH : ZP_PLAIN,
          stage >= M.COHORT_UP && first
            ? numbers(`the smallest p in the table is ${M.pText(first.p)}, at S = ${M.n3(first.score)}`) : null],
        [S.labelFdr, MATHML ? FDR_MATH : FDR_PLAIN,
          stage >= M.COHORT_CORRECT
            ? numbers(`m = ${M.intText(c.table.length)} genes in the table`
              + `${stage >= M.COHORT_STAGES ? `; ${called} with q ≤ ${M.FDR_LINE}` : ""}`) : null],
      ],
      note: S.noteCohort,
    };
  }
  const a = state.one;
  const stage = anim?.stage ?? 0;
  const rows = [];
  rows.push([S.labelThreshold, MATHML ? THRESHOLD_MATH : THRESHOLD_PLAIN,
    stage >= 2 ? numbers(`P(X = ${a.th}) = ${M.probText(M.dbinom(a.th, a.n, 1 / a.gene.L))}`
      + `${a.th > 2 ? `, P(X = ${a.th - 1}) = ${M.probText(M.dbinom(a.th - 1, a.n, 1 / a.gene.L))}` : ""}`
      + ` at n = ${M.intText(a.n)}, L = ${M.intText(a.gene.L)}`) : null]);
  const cl = a.focus;
  rows.push([S.labelCluster, MATHML ? CLUSTER_MATH : CLUSTER_PLAIN,
    stage >= 4 && cl ? numbers(`${sumText([...cl.parts].sort((x, y) => y.part - x.part).map((p) => p.part))} = ${M.n3(cl.score)}`
      + ` for residues ${cl.start}–${cl.end}`) : null]);
  rows.push([S.labelGene, MATHML ? GENE_MATH : GENE_PLAIN,
    stage >= 5 && a.res ? numbers(`S = ${sumText(a.res.clusters.map((c) => c.score).sort((x, y) => y - x))} = ${M.n3(a.res.score)}`) : null,
    stage >= 6 && a.res ? numbers(`z = (${M.n3(a.res.score)} − 0.279) / 0.13 = ${M.n2(a.z)}, p = ${M.pText(a.p)}`) : null]);
  return { rows, note: S.noteGene };
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

function wash(color, a) {
  const m = String(color).match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const p = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
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

/** A residue's head: round for missense, square for truncating. */
function head(ctx, x, y, r, truncating, fill) {
  ctx.fillStyle = fill;
  if (truncating) { ctx.fillRect(x - r, y - r, 2 * r, 2 * r); return; }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* ---- page 1: the protein ------------------------------------------------------ */

function drawProtein(ctx, colors, L, a, stage, landed) {
  const { x0, x1 } = L;
  const { top, base } = L.protein;
  const X = (p) => x0 + ((p - 0.5) / a.gene.L) * (x1 - x0);
  /* STEMS ON A SQUARE-ROOT SCALE, fixed to the finished gene: a residue hit once
     stays visible beside one hit 131 times, the threshold is a line above the
     baseline rather than on it, and arrivals grow into a frame that does not
     rescale under them (2.5). */
  const Y = (n) => base - Math.sqrt(n / a.scaleTop) * (base - top);

  text(ctx, S.proteinCaption, x0, 24, { font: capFont(colors), fill: colors.ink1 });
  text(ctx, stage >= 1 ? `${M.intText(landed)} mutations on ${M.intText(a.gene.L)} residues` : `${M.intText(a.gene.L)} residues`,
    x1, 24, { font: noteFont(colors), fill: colors.ink2, align: "right" });

  if (stage >= 1) {
    const wanted = [a.maxN, ...(stage >= 2 ? [a.th] : []), 1, 10, 50, 100].filter((t) => Number.isFinite(t) && t <= a.scaleTop);
    const ticks = [];
    for (const t of wanted) if (!ticks.some((k) => Math.abs(Y(k) - Y(t)) < 12)) ticks.push(t);
    for (const t of ticks) {
      rule(ctx, x0 - 4, Y(t), x0, Y(t), colors.axis);
      text(ctx, String(t), x0 - 7, Y(t) + 4, { font: monoFont(colors), fill: colors.ink3, align: "right" });
    }
  }
  if (stage >= 2 && Number.isFinite(a.th)) rule(ctx, x0, Y(a.th), x1, Y(a.th), colors.highlight, 1, [4, 3]);

  const residues = stage >= 2 ? a.residues : M.tallyOf(a.gene.mutations, landed);
  for (const r of residues) rule(ctx, X(r.pos), base, X(r.pos), Y(r.n), wash(colors.ink3, 0.8));
  for (const r of residues) {
    const marked = stage >= 2 && r.n >= a.th;
    const fill = marked ? colors.highlight : stage >= 2 ? wash(colors.ink2, 0.45) : colors.ink2;
    head(ctx, X(r.pos), Y(r.n), marked ? 3.4 : 2.5, r.truncating > r.missense, fill);
  }
  /* The label goes over the stems, not under them, with core's caption halo:
     at the left end it crosses the heads of every residue hit once or twice. */
  if (stage >= 2 && Number.isFinite(a.th)) {
    ctx.save();
    ctx.font = noteFont(colors);
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(S.threshold(a.th), x0 + 4, Y(a.th) - 5);
    ctx.restore();
    text(ctx, S.threshold(a.th), x0 + 4, Y(a.th) - 5, { font: noteFont(colors), fill: colors.highlight });
  }

  ctx.fillStyle = colors.surface3;
  ctx.fillRect(x0, base + 3, x1 - x0, 8);
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, base + 3.5, x1 - x0 - 1, 7);
  const tickAt = [...new Set([1, ...[0.25, 0.5, 0.75].map((f) => Math.round((f * a.gene.L) / 50) * 50), a.gene.L])];
  for (const t of tickAt) {
    text(ctx, M.intText(t), X(t), base + 27, { font: monoFont(colors), fill: colors.ink3, align: t === 1 ? "left" : t === a.gene.L ? "right" : "center" });
  }

  if (stage >= 2 && a.focus) {
    const box = locatorRect(L, a);
    ctx.save();
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  }
  if (stage >= 3 && a.res) {
    for (const c of a.res.clusters) {
      const ca = X(c.start) - 1, cb = Math.max(X(c.end) + 1, ca + 3);
      rule(ctx, ca, base + 40, cb, base + 40, colors.ink1, 3);
    }
    text(ctx, `${a.res.count} cluster${a.res.count === 1 ? "" : "s"}`, x1, base + 56, { font: noteFont(colors), fill: colors.ink2, align: "right" });
  }
}

/** The close-up's residues: the focus cluster's span with four either side. */
function closeWindow(a) {
  const c = a.focus;
  return { lo: Math.max(1, Math.min(c.start, c.coreStart) - 4), hi: Math.min(a.gene.L, Math.max(c.end, c.coreEnd) + 4) };
}

/* THE BOX ON THE PROTEIN AND THE PANEL ARE ONE GEOMETRY, because the panel
   grows out of the box on the press that opens it (his call, 2026-09-18), and a
   journey that starts anywhere else teaches the wrong place. */
function locatorRect(L, a) {
  const win = closeWindow(a);
  const X = (pos) => L.x0 + ((pos - 0.5) / a.gene.L) * (L.x1 - L.x0);
  const wa = X(win.lo), wb = X(win.hi);
  return { x: wa - 2, y: L.protein.base + 1, w: Math.max(4, wb - wa + 4), h: 12 };
}
const closeRect = (L) => ({ x: L.x0, y: L.lower.top - 14, w: L.x1 - L.x0, h: 176 });

/** The close-up, or the close-up on its way out of the box. */
function drawCloseUpAt(ctx, colors, L, a, stage, t) {
  if (t >= 1) { drawCloseUp(ctx, colors, L, a, stage); return; }
  const to = closeRect(L);
  const r = M.lerpRect(locatorRect(L, a), to, M.easeInOut(t));
  ctx.save();
  /* Clipped to the window: the panel is drawn at its own size into whatever
     rectangle the window has reached, so what is outside it has not arrived. */
  ctx.beginPath();
  ctx.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.clip();
  ctx.globalAlpha = 0.3 + 0.7 * t;
  ctx.translate(r.x, r.y);
  ctx.scale(r.w / to.w, r.h / to.h);
  ctx.translate(-to.x, -to.y);
  drawCloseUp(ctx, colors, L, a, stage);
  ctx.restore();
}

function drawCloseUp(ctx, colors, L, a, stage) {
  const { x0, x1 } = L;
  const top = L.lower.top;
  const c = a.focus;
  const win = closeWindow(a);
  const cols = win.hi - win.lo + 1;
  const cw = (x1 - x0) / cols;
  const CX = (p) => x0 + (p - win.lo) * cw;
  const at = new Map(a.residues.map((r) => [r.pos, r]));
  let maxN = 1;
  for (let p = win.lo; p <= win.hi; p += 1) maxN = Math.max(maxN, at.get(p)?.n ?? 0);
  const barTop = top + 40, barBase = top + 108;
  const Y = (n) => barBase - Math.sqrt(n / maxN) * (barBase - barTop);

  text(ctx, S.closeCaption(win.lo, win.hi), x0, top, { font: capFont(colors), fill: colors.ink1 });
  if (stage >= 3) {
    ctx.fillStyle = colors.surface3;
    ctx.fillRect(CX(c.start), top + 12, (c.end - c.start + 1) * cw, barBase - top - 12);
    text(ctx, S.clusterSpan(c.start, c.end), CX(c.start) + 4, top + 26, { font: noteFont(colors), fill: colors.ink1 });
  }
  if (stage >= 2) rule(ctx, x0, Y(a.th), x1, Y(a.th), colors.highlight, 1, [4, 3]);
  for (let p = win.lo; p <= win.hi; p += 1) {
    const r = at.get(p);
    if (!r) continue;
    const marked = stage >= 2 && r.n >= a.th;
    ctx.fillStyle = marked ? colors.highlight : stage >= 2 ? wash(colors.ink3, 0.6) : colors.ink3;
    ctx.fillRect(CX(p) + Math.min(3, cw * 0.15), Y(r.n), cw - 2 * Math.min(3, cw * 0.15), barBase - Y(r.n));
    text(ctx, String(r.n), CX(p) + cw / 2, Y(r.n) - 4, { font: monoFont(colors), fill: colors.ink2, align: "center" });
  }
  rule(ctx, x0, barBase + 0.5, x1, barBase + 0.5, colors.axis);
  for (let p = win.lo; p <= win.hi; p += 1) {
    if (p % 5 !== 0) continue;
    text(ctx, String(p), CX(p) + cw / 2, barBase + 14, { font: monoFont(colors), fill: colors.ink3, align: "center" });
  }
  if (stage >= 4) {
    text(ctx, S.distance, x0 - 6, barBase + 30, { font: noteFont(colors), fill: colors.ink3, align: "right" });
    text(ctx, S.term, x0 - 6, barBase + 46, { font: noteFont(colors), fill: colors.ink3, align: "right" });
    /* Two rows of parts where the columns are narrower than a part, so
       neighbours do not print through each other. */
    const stagger = cw < 30;
    [...c.parts].sort((p, q) => p.pos - q.pos).forEach((part, i) => {
      const cx = CX(part.pos) + cw / 2;
      if (part.distance === 0) text(ctx, S.peak, cx, Y(part.N) - 18, { font: capFont(colors), fill: colors.ink1, align: "center" });
      text(ctx, String(part.distance), cx, barBase + 30, { font: monoFont(colors), fill: colors.ink2, align: "center" });
      text(ctx, M.part3(part.part), cx, barBase + 46 + (stagger && i % 2 ? 14 : 0), { font: monoFont(colors), fill: colors.ink1, align: "center" });
    });
  }
}

/** Where the S marker stands on the score bar: the start of its walk. */
function scoreMark(L, a) {
  const y = L.lower.top + 36, h = 26;
  return { x: L.x0 + a.res.score * (L.x1 - L.x0), y0: y - 8, y1: y + h + 8 };
}

/** Step 4: the gene's score as its clusters' scores laid end to end. */
function drawGeneScore(ctx, colors, L, a, withMark = true) {
  const { x0, x1 } = L;
  const top = L.lower.top;
  const X = (v) => x0 + v * (x1 - x0);
  text(ctx, S.geneScoreCaption, x0, top, { font: capFont(colors), fill: colors.ink1 });
  const y = top + 36, h = 26;
  ctx.fillStyle = colors.surface3;
  ctx.fillRect(x0, y, x1 - x0, h);
  let at = 0;
  const scores = a.res.clusters.map((c) => c.score).sort((p, q) => q - p);
  scores.forEach((s, i) => {
    ctx.fillStyle = wash(colors.highlight, i % 2 ? 0.55 : 0.9);
    ctx.fillRect(X(at), y, Math.max(1, X(at + s) - X(at) - 1), h);
    if (X(at + s) - X(at) > 34) {
      text(ctx, M.part3(s), (X(at) + X(at + s)) / 2, y + h / 2 + 4, { font: monoFont(colors), fill: colors.surface, align: "center" });
    }
    at += s;
  });
  if (withMark) {
    rule(ctx, X(a.res.score), y - 8, X(a.res.score), y + h + 8, colors.ink1, 2);
    text(ctx, `S = ${M.n3(a.res.score)}`, X(a.res.score) + (a.res.score > 0.8 ? -6 : 6), y - 10,
      { font: capFont(colors), fill: colors.ink1, align: a.res.score > 0.8 ? "right" : "left" });
  }
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    text(ctx, String(t), X(t), y + h + 22, { font: monoFont(colors), fill: colors.ink3, align: t === 0 ? "left" : t === 1 ? "right" : "center" });
  }
  /* The fraction the cell 18 plot draws, under the score it tests, so the
     discount for distance from each peak is a visible difference. */
  const fraction = a.res.inClusters / a.n;
  const fy = y + h + 48;
  ctx.fillStyle = colors.surface3;
  ctx.fillRect(x0, fy, x1 - x0, 10);
  ctx.fillStyle = wash(colors.ink2, 0.55);
  ctx.fillRect(x0, fy, X(fraction) - x0, 10);
  text(ctx, `${M.intText(a.res.inClusters)} of ${M.intText(a.n)} mutations are in clusters: a fraction of ${M.n2(fraction)}`,
    x0, fy + 28, { font: noteFont(colors), fill: colors.ink2 });
}

/** Step 5: the score against the fixed background. Below t = 1 the curve is
    arriving and the S marker is still walking down from the score bar, so one
    number takes its place on the other panel instead of two panels replacing
    each other (his call, 2026-09-18). */
function drawBackground(ctx, colors, L, a, t = 1) {
  const { x0, x1 } = L;
  const top = L.lower.top;
  const rect = { x: x0, y: top + 24, w: x1 - x0, h: 112 };
  const plot = makePlot({ ctx, colors, rect, xDomain: [-0.1, 1.1], yDomain: [0, 1.1] });
  const e = M.easeInOut(t);
  /* A HANDOFF, NOT A CROSSFADE. Both panels head their own caption at the same
     point, so fading one out under the other printed the two through each
     other; the bar is gone by the halfway point and the curve starts there,
     and the marker on its way down is what carries the frame between them. */
  ctx.save();
  ctx.globalAlpha = Math.max(0, 2 * e - 1);
  text(ctx, S.backgroundCaption, x0, top, { font: capFont(colors), fill: colors.ink1 });
  text(ctx, S.backgroundNote, x1, top, { font: noteFont(colors), fill: colors.ink2, align: "right" });
  const pdf = (s) => Math.exp(-0.5 * ((s - M.BACKGROUND.mean) / M.BACKGROUND.sd) ** 2);
  const pts = [];
  for (let s = -0.1; s <= 1.1 + 1e-9; s += 0.005) pts.push([s, pdf(s)]);
  plot.area(pts, { fill: colors.reference, opacity: 0.22 });
  plot.area(pts.filter(([s]) => s >= a.res.score), { fill: colors.extreme, opacity: 0.6 });
  plot.curve(pts, { stroke: colors.reference, width: 1.5 });
  plot.axisX({ ticks: [0, 0.25, 0.5, 0.75, 1], format: (tick) => String(tick) });
  ctx.restore();
  if (t >= 1) {
    plot.vline(a.res.score, { stroke: colors.highlight, width: 2, label: `S = ${M.n3(a.res.score)}`, align: a.res.score > 0.8 ? "left" : "right" });
    text(ctx, `z = (${M.n3(a.res.score)} − 0.279) / 0.13 = ${M.n2(a.z)}      p = ${M.pText(a.p)}`,
      x0, top + 178, { font: `${colors.fsSm} ${colors.mono}`, fill: colors.ink1 });
    return;
  }
  const from = scoreMark(L, a);
  const to = { x: plot.sx(a.res.score), y0: rect.y, y1: rect.y + rect.h };
  const mx = from.x + (to.x - from.x) * e;
  const y0 = from.y0 + (to.y0 - from.y0) * e;
  const y1 = from.y1 + (to.y1 - from.y1) * e;
  rule(ctx, mx, y0, mx, y1, colors.highlight, 2);
  text(ctx, `S = ${M.n3(a.res.score)}`, mx + (a.res.score > 0.8 ? -6 : 6), y0 - 6,
    { font: capFont(colors), fill: colors.ink1, align: a.res.score > 0.8 ? "right" : "left" });
}

function drawGenePage(ctx, colors, w, params, state, anim) {
  const L = M.layout(w, params);
  const a = state.one;
  const stage = anim?.stage ?? 0;
  const landed = stage >= 2 ? a.n : stage === 1 ? Math.min(a.n, anim.landed ?? a.n) : 0;
  drawProtein(ctx, colors, L, a, stage, landed);
  if (stage < 2) return;
  if (!a.res) {
    text(ctx, S.noCluster(a.th, a.n, M.intText(a.gene.L)), L.x0, L.lower.top + 8, { font: noteFont(colors), fill: colors.ink1 });
    text(ctx, S.notTested, L.x0, L.lower.top + 28, { font: noteFont(colors), fill: colors.ink1 });
    return;
  }
  const t = anim?.tween ?? 1;
  if (stage <= 4) { drawCloseUpAt(ctx, colors, L, a, stage, stage === 2 ? t : 1); return; }
  if (stage === 5) { drawGeneScore(ctx, colors, L, a); return; }
  /* The bar the score came from stays while the marker leaves it, and is gone
     by the halfway point, where the background starts to arrive. */
  if (t < 1) {
    const out = Math.max(0, 1 - 2 * M.easeInOut(t));
    if (out > 0.01) {
      ctx.save();
      ctx.globalAlpha = out;
      drawGeneScore(ctx, colors, L, a, false);
      ctx.restore();
    }
  }
  drawBackground(ctx, colors, L, a, t);
}

/* ---- page 2: the cohort --------------------------------------------------------- */

const KIND_FILL = (colors, kind) => (kind === "oncogene" ? colors.groupA : kind === "suppressor" ? colors.groupB : colors.ink3);

/** The names `M.labelPlacements` placed, each with the surface halo core gives
    a caption, and a leader line to the point's rim where a name moved out. */
function drawNames(ctx, colors, placements) {
  for (const p of placements) {
    if (p.leader) {
      const fromX = p.lx < p.mark.x ? p.lx + p.w + 2 : p.lx - 2;
      const fromY = p.ly - 4;
      const rim = p.mark.r + (p.mark.g.called ? M.RING : 0) + 1;
      const dx = fromX - p.mark.x, dy = fromY - p.mark.y, len = Math.hypot(dx, dy) || 1;
      rule(ctx, fromX, fromY, p.mark.x + (dx / len) * rim, p.mark.y + (dy / len) * rim, colors.ink3, 0.75);
    }
    ctx.save();
    ctx.font = noteFont(colors);
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.lx, p.ly);
    ctx.restore();
    text(ctx, p.text, p.lx, p.ly, { font: noteFont(colors), fill: colors.ink1 });
  }
}

/** The table, while the list is still on screen: twelve rows a reader can
    read, over a column holding one mark per candidate gene, so the rows sit in
    a depth that is drawn rather than claimed. */
function drawList(ctx, colors, L, c, alpha, dropT) {
  if (alpha <= 0.01) return;
  const { list } = L;
  const cols = [list.x + 26, list.x + list.w * 0.62, list.x + list.w * 0.82, list.x + list.w];
  ctx.save();
  ctx.globalAlpha = alpha;
  text(ctx, S.listGene, cols[0], list.y + 14, { font: monoFont(colors), fill: colors.ink3 });
  text(ctx, S.listMutations, cols[1], list.y + 14, { font: monoFont(colors), fill: colors.ink3, align: "right" });
  text(ctx, S.listClusters, cols[2], list.y + 14, { font: monoFont(colors), fill: colors.ink3, align: "right" });
  text(ctx, S.listScore, cols[3], list.y + 14, { font: monoFont(colors), fill: colors.ink3, align: "right" });
  rule(ctx, list.x + 20, list.y + 20, list.x + list.w, list.y + 20, colors.grid);
  let y = list.y + 38;
  for (const g of c.rows) {
    const a = g.tested ? 1 : 1 - dropT;
    if (a > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha * a;
      const dx = g.tested ? 0 : -18 * dropT;
      const ink = g.tested ? colors.ink1 : colors.ink3;
      text(ctx, M.listName(c, g), cols[0] + dx, y, { font: noteFont(colors), fill: ink });
      text(ctx, M.intText(g.mutations.length), cols[1] + dx, y, { font: monoFont(colors), fill: colors.ink2, align: "right" });
      text(ctx, g.tested ? String(g.clusters) : S.listNone, cols[2] + dx, y, { font: monoFont(colors), fill: ink, align: "right" });
      text(ctx, g.tested ? M.n3(g.score) : "—", cols[3] + dx, y, { font: monoFont(colors), fill: ink, align: "right" });
      ctx.restore();
    }
    y += g.tested ? 19 : 19 * (1 - dropT);
  }
  text(ctx, S.listRows(M.intText(Math.round(c.atMin + (c.table.length - c.atMin) * dropT))), cols[0], list.y + list.h - 6,
    { font: monoFont(colors), fill: colors.ink2 });
  ctx.restore();
}

function drawCohortPage(ctx, colors, w, params, state, anim) {
  const L = M.layout(w, params);
  const c = state.cohort;
  /* Without an animation the page is its last stage: that is what `?shown=5`
     and a settled figure are. */
  const stage = anim?.cohort ?? M.COHORT_STAGES;
  const e = M.easeOut(anim?.cohortT ?? 1);
  /* THE EASE IS READ HERE, not stored: `mix` counts the ease's time and the
     points are placed on its curve, as widget 60 reads its two views. */
  const mix = M.easeOut(anim?.mix ?? (params.across === "score" ? 1 : 0));
  const at = (s) => (stage > s ? 1 : stage === s ? e : 0);
  const spread = at(M.COHORT_ACROSS);
  const rect = M.lerpRect(L.narrow, L.plot, spread);
  const yTop = M.cohortTop(c.table);
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, 1], yDomain: [0, yTop] });

  text(ctx, stage < M.COHORT_ACROSS ? S.candidateCaption : S.cohortCaption,
    stage < M.COHORT_ACROSS ? L.list.x : rect.x, 24, { font: capFont(colors), fill: colors.ink1 });

  if (spread > 0.01) {
    ctx.save();
    ctx.globalAlpha = spread;
    const yTicks = [];
    for (let t = 0; t <= yTop; t += yTop > 8 ? 2 : 1) yTicks.push(t);
    plot.grid(yTicks);
    plot.axisY({ ticks: yTicks, format: String, label: stage < M.COHORT_CORRECT ? S.axisP : S.axisFdr });
    plot.axisX({ ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (t) => String(t), label: mix < 0.5 ? S.axisFraction : S.axisScore });
    ctx.restore();
  }

  /* Where each gene was before the correction. It stays after the fall, so the
     settled figure carries the arithmetic and not only the answer. */
  const ghosts = at(M.COHORT_CORRECT);
  if (ghosts > 0.01) {
    ctx.save();
    ctx.globalAlpha = M.GHOST * ghosts;
    for (const g of c.table) {
      ctx.beginPath();
      ctx.arc(plot.sx(M.lerp(g.fraction, g.score, mix)), plot.sy(-Math.log10(g.p)), M.markRadius(g), 0, Math.PI * 2);
      ctx.fillStyle = colors.ink3;
      ctx.fill();
    }
    ctx.restore();
    text(ctx, S.ghostNote, rect.x + rect.w, 24, { font: noteFont(colors), fill: colors.ink3, align: "right" });
  }

  const calls = at(M.COHORT_STAGES);
  if (calls > 0.01) {
    ctx.save();
    ctx.globalAlpha = calls;
    const lineY = plot.sy(-Math.log10(M.FDR_LINE));
    rule(ctx, rect.x, lineY, rect.x + rect.w, lineY, colors.ink2, 1, [5, 4]);
    text(ctx, S.fdrLine, rect.x + rect.w, lineY - 5, { font: noteFont(colors), fill: colors.ink2, align: "right" });
    ctx.restore();
  }

  drawList(ctx, colors, L, c, stage < M.COHORT_ACROSS ? 1 : stage === M.COHORT_ACROSS ? 1 - e : 0, at(1));

  /* Both ends of this press, read through the rectangle the plot is at THIS
     frame: a point placed against a rectangle that is still moving would chase
     a target rather than travel to one. */
  const from = M.buildPlaces(c, L.list, rect, mix, Math.max(0, stage - 1));
  const to = M.buildPlaces(c, L.list, rect, mix, stage);
  const kinds = params.kinds && calls > 0;
  for (const pass of [0, 1]) {
    for (let i = 0; i < to.length; i += 1) {
      const g = to[i].g;
      if ((g.kind === "passenger" ? 0 : 1) !== pass) continue;
      const a = M.lerp(from[i].a, to[i].a, e);
      if (a <= 0.01) continue;
      const x = M.lerp(from[i].x, to[i].x, e);
      const y = M.lerp(from[i].y, to[i].y, e);
      const r = Math.max(1, M.lerp(from[i].r, to[i].r, e));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = kinds && g.kind !== "passenger" ? wash(KIND_FILL(colors, g.kind), 0.9) : wash(colors.ink3, 0.5);
      ctx.fill();
      if (calls > 0.5 && g.called) {
        ctx.beginPath();
        ctx.arc(x, y, r + M.RING, 0, Math.PI * 2);
        ctx.strokeStyle = colors.ink1;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  if (params.kinds && calls > 0.5) {
    const measure = (str) => { ctx.save(); ctx.font = noteFont(colors); const width = ctx.measureText(str).width; ctx.restore(); return width; };
    const marks = M.cohortMarks(c.table, plot.sx, plot.sy, mix, stage);
    drawNames(ctx, colors, M.labelPlacements(marks, M.namedGenes(c), rect, measure));
  }

  if (stage >= 1) {
    const base = L.plot.y + L.plot.h;
    text(ctx, S.notInTable(M.intText(c.untested.length), M.intText(c.atMin)), L.plot.x, base + 56,
      { font: noteFont(colors), fill: colors.ink1 });
    text(ctx, S.notInTableWhy, L.plot.x, base + 73, { font: noteFont(colors), fill: colors.ink2 });
    const suppressorsOut = c.untested.filter((g) => g.kind === "suppressor").length;
    if (params.kinds && suppressorsOut) {
      text(ctx, S.driversNotInTable(suppressorsOut), L.plot.x, base + 90, { font: noteFont(colors), fill: colors.ink2 });
    }
  }
}

/* ---- the steps ------------------------------------------------------------------ */

/** One frame of the drive. One press is one step, and it ends there: with Play
    declined (below) nothing chains the steps together. */
function takeStep(anim, dt, a) {
  const last = M.lastStage(a);
  /* A step that carries a panel somewhere keeps its frames until it lands. */
  if (anim.tween < 1) {
    anim.tween = Math.min(1, anim.tween + dt / M.TWEEN_MS);
    return anim.tween < 1;
  }
  if (anim.stage >= last) { anim.done = true; return false; }
  anim.clock += dt;
  /* The first step is an arrival: the mutations land over LAND_MS whatever
     their number, so seven and 359 take the same time (4.1). */
  if (anim.stage === 0) { anim.stage = 1; anim.landed = 0; anim.clock = dt; }
  if (anim.stage === 1 && anim.landed < a.n) {
    anim.landed = Math.min(a.n, Math.ceil(a.n * Math.min(1, anim.clock / M.LAND_MS)));
    if (anim.landed < a.n) return true;
    anim.clock = 0;
    return false;
  }
  anim.stage += 1;
  anim.clock = 0;
  anim.tween = M.TWEENED.has(anim.stage) ? 0 : 1;
  anim.done = anim.stage >= last;
  return anim.tween < 1;
}

/** One frame of page 2's build. Every press moves something, so every press
    takes its own frames; there is no arrival to pace separately. */
function takeCohortStep(anim, dt) {
  if (anim.cohortT < 1) {
    anim.cohortT = Math.min(1, anim.cohortT + dt / M.COHORT_MS);
    return anim.cohortT < 1;
  }
  if (anim.cohort >= M.COHORT_STAGES) { anim.done = true; return false; }
  anim.cohort += 1;
  anim.cohortT = Math.min(1, dt / M.COHORT_MS);
  anim.done = anim.cohort >= M.COHORT_STAGES;
  return anim.cohortT < 1;
}

/** The press in flight, finished as if its frames had run: the arrival with
    every mutation landed, a carried panel at its destination, a cohort press at
    its end. For `rebuild`, when a page or axis switch takes the loop away. */
function finishPress(anim, a) {
  if (anim.stage === 1 && anim.landed < a.n) { anim.landed = a.n; anim.clock = 0; }
  anim.tween = 1;
  anim.cohortT = 1;
}

/* ---- the widget ----------------------------------------------------------------- */

defineWidget({
  slug: "driver-genes",
  title: "Cancer Driver Genes",
  status: "shipped",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ w, ...values }) => M.stageHeight(w, values),

  params: {
    /* Decision 2: the page is display, so the steps survive a visit to the
       cohort and back. */
    page: {
      role: "page",
      type: "segmented",
      label: S.pageLabel,
      detail: S.pageDetail,
      options: M.PAGES,
      default: "gene",
      display: true,
    },

    geneSec: { type: "section", label: S.geneSection, when: { param: "page", equals: "gene" } },
    /* His pick 3: named by kind, with the gene each is shaped on in the detail. */
    gene: {
      type: "segmented",
      style: "grid",
      label: S.geneLabel,
      detail: S.geneDetail,
      options: M.KINDS.map((k) => ({ value: k.value, label: k.label })),
      default: "oncogene",
      when: { param: "page", equals: "gene" },
    },

    lookSec: { type: "section", label: S.lookSection, when: { param: "page", equals: "cohort" } },
    /* His pick 4: the fraction cell 18 draws, and the score one press away,
       eased, because it is the same genes read on another axis (4.4). */
    across: {
      type: "segmented",
      label: S.acrossLabel,
      detail: S.acrossDetail,
      options: M.ACROSS,
      default: "fraction",
      display: true,
      when: { param: "page", equals: "cohort" },
    },
    /* Decision 5: on at first, his call on the draft (2026-09-18). */
    kinds: {
      type: "bool",
      label: S.kindsLabel,
      detail: S.kindsDetail,
      default: true,
      display: true,
      when: { param: "page", equals: "cohort" },
    },

    /* Kenneth's ruling on 59: the seed sits in its own section under the drive
       row. */
    dataSec: { type: "section", label: S.dataSection, afterDrive: true },
    seed: {
      type: "int",
      label: S.seedLabel,
      detail: S.seedDetail,
      min: 1,
      max: 200,
      default: 1,
      afterDrive: true,
    },

    /* Authoring escape hatch, first render only: the steps already taken. */
    shown: { type: "int", min: 0, max: M.STAGES, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "cohort") {
      return [
        ...(params.kinds ? [
          { token: "group-a", label: "Oncogene", mark: "dot" },
          { token: "group-b", label: "Tumor suppressor", mark: "dot" },
          { token: "ink-3", label: "Passenger", mark: "dot" },
        ] : [
          { token: "ink-3", label: "A gene in the table, sized by its number of clusters", mark: "dot" },
        ]),
        { token: "ink-1", label: "Called at FDR 0.05: a ring", mark: "line" },
      ];
    }
    return [
      { token: "ink-2", label: "Missense mutations at a residue: a circle", mark: "dot" },
      { token: "ink-2", label: "Truncating mutations at a residue: a square", mark: "bar" },
      { token: "highlight", label: "Residues at or above the threshold, and the gene's score", mark: "bar" },
      { token: "reference", label: "The background the score is compared with", mark: "line" },
      { token: "extreme", label: "Scores at least as high under the background: the p-value", mark: "bar" },
    ];
  },

  compute({ params }) {
    const cohort = M.cohortFor(params.seed);
    const one = M.analyse(M.geneFor(params.gene, params.seed));
    return { cohort, one };
  },

  animation: {
    /* The button names what this press does (4.4b): the next of cell 12's
       steps, keyed on the animation's own counter, as widget 60's is. */
    /* One button, two pages: page 1's steps are keyed 0…5 on the counter and
       page 2's `c0`…`c4`, so the label always names the next press of the page
       on screen (4.4b). */
    stepLabel: { anim: "labelAt", labels: { ...S.stepLabels, ...S.cohortLabels }, default: S.stepLabels[0] },
    stepTitle: S.stepTitle,
    /* NO PLAY (4.5), Kenneth's call on the draft (2026-09-18). The five steps
       are not motion: each press puts 12 to 80 words on screen that were not
       there before — 3.6 to 24 seconds of reading at 200 wpm, measured from the
       canvas, the card and the tiles — and Play gave each of them 1.1 s,
       replacing the lower panel twice on the way. The arrival is the one thing
       that moves and Step plays it in full, so what Play added was a pace
       nobody can read at (4.1) and a second way to start over beside Reset.
       Sharing the row cost the step button its width too: "Test against the
       background" needs 198px of the 149 the pair left it, so the drive row
       grew 20px twice a walk and moved the seed slider under it. */
    runLabel: null,

    init: ({ params, state, fromScratch }) => {
      const last = M.lastStage(state.one);
      /* `shown` opens the page it is given with, and the other page stays
         empty: a widget opens on no answer it was not asked for (invariant 4). */
      const shown = fromScratch ? 0 : Math.max(0, params.shown ?? 0);
      const cohort = params.page === "cohort" ? Math.min(M.COHORT_STAGES, shown) : 0;
      const stage = params.page === "cohort" ? 0 : Math.min(last, shown);
      const anim = {
        page: params.page,
        stage,
        cohort,
        landed: stage >= 1 ? state.one.n : 0,
        clock: 0,
        tween: 1,
        cohortT: 1,
        done: params.page === "cohort" ? cohort >= M.COHORT_STAGES : stage >= last,
        mix: params.across === "score" ? 1 : 0,
        across: params.across,
      };
      anim.labelAt = M.labelStage(anim);
      return anim;
    },

    advance: (anim, { dt, state }) => {
      if (anim.mode === "ease") {
        const target = anim.across === "score" ? 1 : 0;
        const step = dt / M.EASE_MS;
        anim.mix = target > anim.mix ? Math.min(target, anim.mix + step) : Math.max(target, anim.mix - step);
        return anim.mix !== target;
      }
      /* the loop left running for a press a page switch finished (`rebuild`)
         ends here, before it takes the new page's press */
      if (anim.halt) {
        anim.halt = false;
        anim.moving = false;
        return false;
      }
      const more = anim.page === "cohort" ? takeCohortStep(anim, dt) : takeStep(anim, dt, state.one);
      anim.moving = more;
      anim.labelAt = M.labelStage(anim);
      return more;
    },

    rebuild: (anim, { params, state }) => {
      /* A PRESS BELONGS TO THE PAGE IT STARTED ON. Core keeps a running loop
         going through a display change, and `advance` steps whichever page
         `anim.page` names, so a switch mid-press used to take the new page's
         next press unasked: "Add the mutations" interrupted by a visit to The
         cohort dropped the genes with no cluster, 29 frames, the button then
         naming the press after; a cohort press interrupted by a visit to One
         gene landed the mutations. Found from widget 70's ship (2026-09-19),
         which has the same fix. The press finishes here, as if its frames had
         run, and `halt` ends the loop at its next frame. Only while a press
         moves (`advance` records it): set otherwise, it would swallow the
         first frame of the reader's next press. */
      if (anim.moving && params.page !== anim.page) {
        finishPress(anim, state.one);
        anim.halt = true;
      }
      /* Both pages keep their own place in their own walk, because the page is
         a display parameter and a display change resets nothing (invariant 3). */
      anim.page = params.page;
      const last = M.lastStage(state.one);
      anim.stage = Math.min(anim.stage, last);
      anim.done = params.page === "cohort" ? anim.cohort >= M.COHORT_STAGES : anim.stage >= last;
      anim.labelAt = M.labelStage(anim);
      /* The axis moved: ease on page 2, land anywhere else, and leave from
         where the points are if a second change comes mid-ease. */
      if (params.across !== anim.across) {
        anim.across = params.across;
        if (params.page === "cohort" && !reducedMotion()) {
          /* Core stops the step loop to hand the frames to the ease, and it
             fast-forwards nothing, so a press in flight stayed where it
             stopped: a half-fallen cloud under a label naming the next step,
             and the reader's next press spent on finishing it. The press
             finishes first, and the ease plays over the finished figure. The
             stopped loop needs no halt, and a pending one would end the ease. */
          if (anim.moving) { finishPress(anim, state.one); anim.moving = false; anim.halt = false; }
          anim.easing = true;
        } else anim.mix = params.across === "score" ? 1 : 0;
      }
      if (params.page !== "cohort" && !anim.easing) anim.mix = params.across === "score" ? 1 : 0;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    /* The card is mounted from here, never at module scope: `buildShell`
       creates `.w-figure` inside `defineWidget`. */
    const card = cardFor(params, state, anim);
    renderCard(card.rows, card.note);
    if (params.page === "cohort") { drawCohortPage(ctx, colors, w, params, state, anim); return; }
    drawGenePage(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.page === "cohort") {
      const c = state.cohort;
      /* A number appears with the step that produces it (2.4), so the tiles
         walk with the build and do not answer it in advance. */
      const stage = anim?.cohort ?? M.COHORT_STAGES;
      const done = stage >= M.COHORT_STAGES;
      const called = c.table.filter((g) => g.called);
      const inTable = { oncogene: 0, suppressor: 0, passenger: 0 };
      const hits = { oncogene: 0, suppressor: 0, passenger: 0 };
      for (const g of c.table) { inTable[g.kind] += 1; if (g.called) hits[g.kind] += 1; }
      const planted = (kind) => M.DRIVERS.filter((d) => M.SHAPES[d].kind === kind).length;
      const tiles = [
        {
          label: "Genes in the table",
          value: stage >= 1 ? M.intText(c.table.length) : "—",
          note: `of ${M.intText(c.atMin)} with 5 or more mutations`,
        },
      ];
      if (!params.kinds) {
        return [
          ...tiles,
          { label: "Called", value: done ? M.intText(called.length) : "—", note: done ? `at FDR ${M.FDR_LINE}` : `none tested yet` },
          {
            label: "Lowest score called",
            value: done && called.length ? M.n3(Math.min(...called.map((g) => g.score))) : "—",
            note: !done ? "once the correction is made" : called.length ? "among the called genes" : "no gene is called",
          },
        ];
      }
      return [
        ...tiles,
        { label: "Oncogenes called", value: done ? `${hits.oncogene} of ${planted("oncogene")}` : "—", note: stage >= 1 ? `${inTable.oncogene} in the table` : "none tested yet" },
        { label: "Tumor suppressors called", value: done ? `${hits.suppressor} of ${planted("suppressor")}` : "—", note: stage >= 1 ? `${inTable.suppressor} in the table` : "none tested yet" },
        { label: "Passengers called", value: done ? M.intText(hits.passenger) : "—", note: stage >= 1 ? `of ${M.intText(inTable.passenger)} in the table` : "none tested yet" },
      ];
    }
    const a = state.one;
    const stage = anim?.stage ?? 0;
    const landed = stage >= 2 ? a.n : stage === 1 ? Math.min(a.n, anim.landed ?? a.n) : 0;
    return [
      { label: "Mutations", value: stage >= 1 ? M.intText(landed) : "—", note: `on ${M.intText(a.gene.L)} residues` },
      {
        label: "Threshold",
        value: stage >= 2 ? String(a.th) : "—",
        note: stage >= 2 ? "mutations at one residue" : "the smallest count with binomial P below 0.01",
      },
      {
        label: "Clusters",
        value: stage >= 3 || (stage >= 2 && !a.res) ? (a.res ? String(a.res.count) : "None") : "—",
        note: a.res && stage >= 3 ? `${M.intText(a.res.inClusters)} of ${M.intText(a.n)} mutations in them`
          : !a.res && stage >= 2 ? "not in the table, so not tested" : "marked residues fewer than 5 apart",
      },
      {
        label: "Score",
        value: a.res && stage >= 5 ? M.n3(a.res.score) : "—",
        note: a.res && stage >= 6 ? `z ${M.n2(a.z)}, p ${M.pText(a.p)}` : "the cluster scores added",
      },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "cohort") {
      const c = state.cohort;
      const stage = anim?.cohort ?? M.COHORT_STAGES;
      const across = params.across === "score" ? "score" : "fraction of mutations in clusters";
      const rows = `${M.intText(c.table.length)} genes with a cluster, of ${M.intText(c.atMin)} with five or more mutations`;
      if (stage < 1) return `A list of ${M.intText(c.atMin)} genes with five or more mutations, none of them tested yet.`;
      if (stage < M.COHORT_ACROSS) return `A table of ${rows}.`;
      if (stage < M.COHORT_UP) return `A table of ${rows}, each placed by its ${across}, before any p-value is drawn.`;
      if (stage < M.COHORT_CORRECT) return `A scatter of ${rows}, by ${across} and −log10 p, before any correction.`;
      const called = c.table.filter((g) => g.called).length;
      if (stage < M.COHORT_STAGES) {
        return `A scatter of ${rows}, by ${across} and −log10 FDR, after Benjamini-Hochberg over the table's rows.`;
      }
      return `A scatter of ${rows}, by ${across} and −log10 FDR; ${called} are called at FDR ${M.FDR_LINE}.`;
    }
    const a = state.one;
    const stage = anim?.stage ?? 0;
    const kind = M.kindOf(params.gene).label.toLowerCase();
    /* The article reads the word: "A oncogene" was what a fixed one gave. */
    const an = /^[aeiou]/i.test(kind) ? "An" : "A";
    if (stage === 0) return `A protein of ${M.intText(a.gene.L)} residues, with no mutations added yet.`;
    if (!a.res && stage >= 2) {
      return `${an} ${kind} with ${a.n} mutations on ${M.intText(a.gene.L)} residues; no residue reaches the threshold of `
        + `${a.th}, so the gene has no cluster and is not tested.`;
    }
    return `${an} ${kind} with ${a.n} mutations on ${M.intText(a.gene.L)} residues, at step ${Math.max(0, stage - 1)} of 5`
      + `${a.res && stage >= 5 ? `; its clusters score ${M.n3(a.res.score)}` : ""}`
      + `${a.res && stage >= 6 ? `, z ${M.n2(a.z)} and p ${M.pText(a.p)}` : ""}.`;
  },
});
