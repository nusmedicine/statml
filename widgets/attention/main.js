/* ============================================================================
   Widget 83 · Language: Attention (`attention`) — PHM5005 08-1 cell 1
   (step 3, "Computing Self-Attention", and "Extending self-attention"), with
   08-3 cell 4's padding mask. DRAFT, 2026-09-25.

   Four pages in the lesson's order, each drawn as his figure draws it:

     WEIGHTS  dl-language-attention-weight.png: the query circled in the
              sentence, its bracket to every key, the row of weights under
              the keys, and the matrix alpha_ij filling a row a press. A
              Scores switch reads the same trained q and k with and without
              the division by sqrt(d_k).
     OUTPUT   dl-language-attention-output.png: the query's row lifted out,
              each weight beside that key's value vector, summed into the
              query's new vector z_i.
     HEADS    dl-language-attention-multi.png, bottom to top: x~ into four
              heads side by side, their outputs joined — drawn as the
              concatenation it is, [L, 4 x 12], where his figure draws a + —
              then W_O, then the feed-forward, dimmed (the block's other
              half is the next widget's).
     MASK     08-3 cell 4's src_key_padding_mask: the same sentence padded
              to 16, without the mask and with it, side by side.

   THE MODEL IS TRAINED AND ONLY READ. Block 1 of the language arc's tiny
   BERT, pretrained by masked-token prediction on synthetic clinical notes;
   its input is x~, where widget 74 stops. Widget 49 steps one head at
   initialisation, where the weights are flat; these have learned something
   (measured, `_lab/attention-measure.py`): head 4's "aspirin" row puts 0.79
   on "chest pain", heads 1 and 3 read the next and the previous token.

   THE PRESS is a query: Step computes the next token's row, on every page,
   so a page switch finds the same rows computed. Nothing is computed per
   frame (invariant 2): compute() runs the whole block once per sentence and
   the press reveals it.

   NO COPY SAYS A HEAD "FINDS" ANYTHING. Zeroing heads in the measurement
   showed a head's weights are not how much the model needs it: in a
   one-block model the head with 0.00 on the symptom cost the drug the most.
   The Heads page prints what each head's weight falls on, measured, and
   nothing about what it is for.
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

const PAGES = [{ value: "weights", label: "Weights" }, { value: "output", label: "Output" }, { value: "heads", label: "Heads" }, { value: "mask", label: "Mask" }];
const ON = (page) => ({ param: "page", equals: page });
const STEP_MS = 600, RUN_MS = 320;   // a press's glide on Step, and under Play

/* ================================================================== copy */

const S = {
  title: "Deep Learning - Language: Attention",
  subtitle: "Each token's query is scored against every token's key; a softmax makes each row of scores into weights that sum to one, "
    + "and the token's new vector is the weighted sum of the values. Several heads do this side by side, and a padding mask gives padded positions no weight.",
  pageLabel: "Page",
  sentenceLabel: "Sentence",
  sentenceDetail: "Synthetic clinical notes, read by a small model pretrained to fill in masked words.",
  headLabel: "Head",
  headDetail: "Four heads of 12 numbers each, in the model's first block.",
  scoreLabel: "Scores",
  scoreDetail: "The same trained queries and keys, with the dot product divided by √12 or not.",
  scoreOpts: [{ value: "scaled", label: "q·k / √dₖ" }, { value: "raw", label: "q·k" }],
  stepLabel: "Next query",
  stepTitle: "Compute the next token's row of weights, in every head",
  runLabel: "Play",
  runTitle: "Compute the remaining rows",
  query: "Query", keys: "Keys",
  weightsCap: "Attention weights αᵢⱼ",
  rowCap: (q, h, raw) => `α for the query "${q}" · head ${h}${raw ? " · q·k without the division" : ""} · the row sums to 1`,
  rowWait: "Next query computes the first row",
  outW: "Weights", outV: ["Features vⱼ"], outZcol: ["With attention", "zⱼ, row by row"], outSum: "Sum", outZ: "Features with attention",
  outSoFar: (k, L, pct) => `${k} of ${L} rows added · ${pct}% of the weight`,
  tileAdded: "Rows added", tileAddedNote: "αᵢⱼvⱼ taken into zᵢ so far",
  tileShare: "Weight added", tileShareNote: "the share of this row's weights",
  headsX: "x̃  [L, 48]", headsCat: "concatenate  [L, 4 × 12]", headsWo: "W_O  →  [L, 48]", headsFf: "Feed-forward",
  headsNote: "Rows: queries · columns: keys · each share measured over 500 notes",
  maskOpen: "No mask", maskShut: "attention_mask",
  maskNote: "[PAD] columns hatched · with the mask each real row is the unpadded sentence's row",
  onPad: (v) => `weight on [PAD]: ${v}`,
  tileQuery: "Query", tileQueryNote: "the row just computed",
  tileTop: "Largest weight", tileTopNote: "the key this row weighs most",
  tileSum: "Row sum", tileSumNote: (L) => `a softmax over ${L} keys`,
  tileZ: "zᵢ", tileZNote: "this head's 12 of the block's 48",
  tileHeads: "Heads", tileHeadsNote: "4 × 12 = 48, the model's width",
  tileCat: "Joined", tileCatNote: "every head's z side by side",
  tileRows: "Rows computed", tileRowsNote: "one query a press",
  tilePads: "[PAD] positions", tilePadsNote: "padded to 16",
  tileOpen: "No mask", tileOpenNote: "the rows' weight on [PAD]",
  tileShut: "attention_mask", tileShutNote: "a masked key's score is −∞",
  wait: "—",
  sum: (page, n, L) => `${page} page: ${n} of ${L} rows computed.`,
};

/* ============================================================ the card */

const MATHML = mathmlRenders();
let cardHost = null, cardKey = null;
const mi = (s) => `<mi>${s}</mi>`, mo = (s) => `<mo>${s}</mo>`;
const sub = (v, s) => `<msub>${mi(v)}${mi(s)}</msub>`;
const qk = `${sub("q", "i")}${mo("·")}${sub("k", "j")}`;
const SOFT = (inner) => `<msub>${mi("softmax")}${mi("j")}</msub>${mo("(")}${inner}${mo(")")}`;
const MATH = {
  scaled: `<math><mrow>${sub("α", "ij")}${mo("=")}${SOFT(`<mfrac><mrow>${qk}</mrow><msqrt>${sub("d", "k")}</msqrt></mfrac>`)}</mrow></math>`,
  raw: `<math><mrow>${sub("α", "ij")}${mo("=")}${SOFT(qk)}</mrow></math>`,
  output: `<math><mrow>${sub("z", "i")}${mo("=")}<munder>${mo("∑")}${mi("j")}</munder>${sub("α", "ij")}${sub("v", "j")}</mrow></math>`,
  heads: `<math><mrow>${mi("MultiHead")}${mo("=")}${mo("[")}<msub>${mi("head")}<mn>1</mn></msub>${mo(";")}${mo("…")}${mo(";")}<msub>${mi("head")}<mn>4</mn></msub>${mo("]")}<msub>${mi("W")}${mi("O")}</msub></mrow></math>`,
  mask: `<math><mrow>${sub("α", "ij")}${mo("=")}${SOFT(`<mfrac><mrow>${qk}</mrow><msqrt>${sub("d", "k")}</msqrt></mfrac>${mo("+")}${sub("m", "j")}`)}</mrow></math>`,
};
const PLAIN = {
  scaled: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ / √dₖ)", raw: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ)", output: "zᵢ = Σⱼ αᵢⱼ vⱼ",
  heads: "MultiHead = [head₁; …; head₄] W_O", mask: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ / √dₖ + mⱼ)",
};
const NOTE = {
  scaled: "dₖ = 12", raw: "no division", output: "", heads: "", mask: "mⱼ = 0, or −∞ where key j is [PAD]",
};
function renderCard(params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  const which = params.page === "weights" ? params.scores : params.page;
  if (!cardHost) { cardHost = document.createElement("div"); cardHost.className = "w-math"; cardHost.style.minHeight = "2.4em"; figure.parentNode.insertBefore(cardHost, figure); cardKey = null; }
  if (which === cardKey) return;
  cardKey = which;
  cardHost.innerHTML = `<div class="w-math-eq" style="min-height:0">${MATHML ? MATH[which] : `<span>${PLAIN[which]}</span>`}`
    + (NOTE[which] ? `<span style="color:var(--ink-3);font-size:var(--fs-xs)">&nbsp;&nbsp;${NOTE[which]}</span>` : "") + `</div>`;
}

/* ============================================================ drawing kit */

const PAD_L = 12, PAD_R = 12;
const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const mixRgb = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))));
const css = (p) => `rgb(${p.join(",")})`;
/* a weight on one ramp from --surface-3 to --c-magnitude; √ so small weights still show */
const weightFill = (colors, w) => mixRgb(rgb(colors.surface3), rgb(colors.magnitude), Math.sqrt(w));
const signedFill = (colors, v, s) => mixRgb(rgb(colors.surface3), rgb(v >= 0 ? colors.valueHigh : colors.valueLow), Math.abs(v) / s);
const lum = (p) => (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
const inkOn = (colors, p) => (Math.abs(lum(p) - lum(rgb(colors.ink1))) > Math.abs(lum(p) - lum(rgb(colors.surface))) ? colors.ink1 : colors.surface);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const mono = (colors) => `${colors.fsXs} ${colors.mono}`;
const cap = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const small = (colors) => `${colors.fsXs} ${colors.font}`;

function txt(ctx, s, x, y, { font, fill, align = "left", baseline = "alphabetic", alpha = 1 }) {
  if (alpha <= 0) return;   // a faded-out label is not painted: under the new one it is an overlap nobody sees
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(s, x, y); ctx.restore();
}
function line(ctx, x1, y1, x2, y2, stroke, lw = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function arrow(ctx, x1, y1, x2, y2, stroke) {
  line(ctx, x1, y1, x2, y2, stroke, 1.2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.fillStyle = stroke; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4)); ctx.fill(); ctx.restore();
}
function box(ctx, colors, x, y, w, h, label, { alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = colors.surface2; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
  txt(ctx, label, x + w / 2, y + h / 2, { font: small(colors), fill: colors.ink1, align: "center", baseline: "middle", alpha });
}

/** how far along each row is: rows before the newest full, the newest at its tween, the rest empty */
const rowAlpha = (anim, i) => (i < anim.n - 1 ? 1 : i === anim.n - 1 ? ease(anim.t) : 0);
const queryOf = (anim) => anim.n - 1;
/* THE GLIDE. A press moves the query from the last row to the next: the circle, the
   dashed row outline and every colour ride `e` from the old row to the new, so the
   eye follows one thing moving rather than a row blinking out and another in. No
   in-between NUMBER is ever printed: the old digits fade out over the first half,
   the new ones in over the second. */
function glide(anim, e = ease(anim.t)) {
  const to = anim.n - 1, from = anim.n >= 2 ? anim.n - 2 : null;
  return { from, to, e, pos: from === null ? to : from + (to - from) * e, first: from === null };
}
const lerp = (a, b, t) => a + (b - a) * t;
const oldInk = (g) => (g.first ? 0 : Math.max(0, 1 - 2 * g.e)), newInk = (g) => (g.first ? g.e : Math.max(0, 2 * g.e - 1));

/** α_ij as a grid: `A` rows over keys, PAD columns hatched, a null cell blank */
function matrix(ctx, colors, A, toks, x0, y0, cs, anim, { colLabels = true, rowLabels = true, padFrom = -1, box: outline = true, ge = ease(anim.t) } = {}) {
  const L = A.length, K = A[0].length, qi = queryOf(anim);
  /* upright: slanted, neighbouring names overlapped even at 24px cells (the text-overlap sweep, 2026-09-26) */
  const steep = true;
  if (colLabels) toks.forEach((t, j) => {
    ctx.save(); ctx.translate(x0 + j * cs + cs / 2 + (steep ? 0 : 3), y0 - 5); ctx.rotate(steep ? -Math.PI / 2 : -Math.PI / 3);
    txt(ctx, t, 0, 0, { font: mono(colors), fill: padFrom >= 0 && j >= padFrom ? colors.ink3 : colors.groupB, baseline: steep ? "middle" : "alphabetic" }); ctx.restore();
  });
  for (let i = 0; i < L; i++) {
    if (rowLabels) txt(ctx, toks[i], x0 - 5, y0 + i * cs + cs / 2, { font: mono(colors), fill: i === qi ? colors.groupA : colors.ink2, align: "right", baseline: "middle" });
    const a = rowAlpha(anim, i);
    for (let j = 0; j < K; j++) {
      const x = x0 + j * cs, y = y0 + i * cs;
      ctx.fillStyle = colors.surface2; ctx.fillRect(x, y, cs - 1, cs - 1);
      if (a > 0 && A[i][j] !== null) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = css(weightFill(colors, A[i][j])); ctx.fillRect(x, y, cs - 1, cs - 1); ctx.restore(); }
      if (padFrom >= 0 && j >= padFrom) line(ctx, x + 1, y + cs - 2, x + cs - 2, y + 1, colors.ink3, 1);
    }
  }
  if (outline) { ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, K * cs, L * cs); }
  /* the query's row outlined with its label, as his figure boxes "M" with its row */
  if (qi >= 0) {
    const g = glide(anim, ge), lab = (i) => (rowLabels ? labelWidth(ctx, colors, [toks[i]]) + 9 : 2.5);
    const lx = g.first ? lab(g.to) : lerp(lab(g.from), lab(g.to), g.e);
    ctx.save(); ctx.globalAlpha = g.first ? g.e : 1; ctx.strokeStyle = colors.groupA; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.strokeRect(x0 - lx, y0 + g.pos * cs - 2, K * cs + lx + 2, cs + 3); ctx.restore();
  }
}

/** a weight to two places, without its leading zero where the column is narrower than "0.00" */
function digits(ctx, colors, v, room) {
  ctx.save(); ctx.font = mono(colors); const full = ctx.measureText("0.00").width; ctx.restore();
  const s = v.toFixed(2);
  return full <= room ? s : s.replace(/^0/, "");
}

/** the longest token's width in the mono face (for row labels) */
function labelWidth(ctx, colors, toks) { ctx.save(); ctx.font = mono(colors); const w = Math.max(...toks.map((t) => ctx.measureText(t).width)); ctx.restore(); return w; }

/* ============================================================== Weights */

const WT = { qY: 34, keyY: 96, stripY: 106, stripH: 28, capY: 150, arrowTo: 170, matTop: 244, cs: 24 };
const weightsCs = (w, L) => Math.min(WT.cs, Math.floor((w - PAD_L - PAD_R - 150) / L));
const heightWeights = (w, L) => WT.matTop + L * weightsCs(w, L) + 34;

/** the sentence as columns sized to the words, so the longest sentence fits the narrowest canvas */
function wordColumns(ctx, colors, toks, x0, avail) {
  ctx.save(); ctx.font = mono(colors);
  const want = toks.map((t) => Math.max(ctx.measureText(t).width + 10, ctx.measureText("0.00").width + 8));
  ctx.restore();
  const s = Math.min(1, avail / want.reduce((a, b) => a + b, 0));
  const xs = []; let x = x0;
  for (const c of want) { xs.push([x, c * s]); x += c * s; }
  return xs;
}

function drawWeights(ctx, colors, w, params, state, anim) {
  const toks = state.tokens, L = state.L, h = Number(params.head) - 1, raw = params.scores === "raw";
  const A = raw ? state.run.heads[h].alphaRaw : state.run.heads[h].alpha, qi = queryOf(anim);
  const cols = wordColumns(ctx, colors, toks, PAD_L + 44, w - PAD_L - PAD_R - 44), cx = (j) => cols[j][0] + cols[j][1] / 2;
  txt(ctx, S.query, PAD_L, WT.qY, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  txt(ctx, S.keys, PAD_L, WT.keyY, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  toks.forEach((t, j) => {
    txt(ctx, t, cx(j), WT.qY, { font: mono(colors), fill: j === qi ? colors.groupA : colors.ink3, align: "center", baseline: "middle" });
    txt(ctx, t, cx(j), WT.keyY, { font: mono(colors), fill: colors.groupB, align: "center", baseline: "middle" });
  });
  const x0 = cols[0][0], x1 = cols[L - 1][0] + cols[L - 1][1];
  if (qi >= 0) {
    const g = glide(anim), qx = g.first ? cx(g.to) : lerp(cx(g.from), cx(g.to), g.e);
    const rx = (g.first ? cols[g.to][1] : lerp(cols[g.from][1], cols[g.to][1], g.e)) / 2;
    ctx.save(); ctx.globalAlpha = g.first ? g.e : 1; ctx.strokeStyle = colors.groupA; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.ellipse(qx, WT.qY, rx, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    line(ctx, qx, WT.qY + 13, qx, 58, colors.ink2, 1.2);
    line(ctx, cx(0), 58, cx(L - 1), 58, colors.ink2, 1.2);
    for (let j = 0; j < L; j++) arrow(ctx, cx(j), 58, cx(j), 80, colors.ink2);
    for (let j = 0; j < L; j++) {
      const to = weightFill(colors, A[g.to][j]);
      const fill = g.first ? mixRgb(rgb(colors.surface2), to, g.e) : mixRgb(weightFill(colors, A[g.from][j]), to, g.e);
      ctx.fillStyle = css(fill); ctx.fillRect(cols[j][0], WT.stripY, cols[j][1], WT.stripH);
      const ty = WT.stripY + WT.stripH / 2, room = cols[j][1] - 4;
      if (!g.first) txt(ctx, digits(ctx, colors, A[g.from][j], room), cx(j), ty, { font: mono(colors), fill: inkOn(colors, fill), align: "center", baseline: "middle", alpha: oldInk(g) });
      txt(ctx, digits(ctx, colors, A[g.to][j], room), cx(j), ty, { font: mono(colors), fill: inkOn(colors, fill), align: "center", baseline: "middle", alpha: newInk(g) });
    }
  }
  ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, WT.stripY + 0.5, x1 - x0 - 1, WT.stripH - 1);
  for (let j = 1; j < L; j++) line(ctx, cols[j][0] + 0.5, WT.stripY, cols[j][0] + 0.5, WT.stripY + WT.stripH, colors.grid, 1);
  txt(ctx, qi >= 0 ? S.rowCap(toks[qi], h + 1, raw) : S.rowWait, x0, WT.capY, { font: small(colors), fill: colors.ink3 });
  if (qi >= 0) arrow(ctx, w / 2, WT.capY + 8, w / 2, WT.arrowTo, colors.ink3);
  /* the matrix, his figure's lower half */
  const cs = weightsCs(w, L), lw = labelWidth(ctx, colors, toks);
  const mx = Math.round(Math.max(PAD_L + lw + 8, w / 2 - (L * cs) / 2 + 40));
  txt(ctx, S.weightsCap, PAD_L, WT.matTop + (L * cs) / 2, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  matrix(ctx, colors, A, toks, mx, WT.matTop, cs, anim);
  txt(ctx, "i", mx + L * cs + 12, WT.matTop + (L * cs) / 2, { font: small(colors), fill: colors.ink2, baseline: "middle" });
  txt(ctx, "j", mx + (L * cs) / 2, WT.matTop + L * cs + 16, { font: small(colors), fill: colors.ink2, align: "center" });
}

/* =============================================================== Output */

/* ONE PRESS, IN STAGES (his ask, 2026-09-26: "animate rows added sequentially"; mock
   `_lab/attention-output-mock.html`, his pick C). The press glides to the next query,
   then takes its keys one at a time: an outline steps to the key and zᵢ eases to
   the next partial sum, one term of Σⱼ αᵢⱼvⱼ a step; then the finished zᵢ fades into the
   column right of the strips, on its own token's row, so every token's features
   before and after attention sit side by side (his ask, the same day: "move and
   align to rows of original features").
   Nothing travels over marks already in place (tweens move in lanes): the key being
   added is outlined, and a line down the right edge carries it to the sum. */
const OUT = { pre: 260, key: 360, drop: 360 }, OUT_RUN = { pre: 160, key: 200, drop: 220 };
/* ONE KEY'S SLOT (his pick B, 2026-09-26, from the live mock
   `_lab/attention-sum-motion-mock.html`): the outline moves to the key over the
   first 30%, then zᵢ eases to the next partial sum. The strips keep their own vⱼ
   throughout. Dimming each strip to αᵢⱼvⱼ in place was built first and read as a
   flicker ("it flickers a bit and can be distracting"), and dimming them all left
   nothing to compare zⱼ with. */
const beat = (u, a, b) => ease(Math.max(0, Math.min(1, (u - a) / (b - a))));
const moveOf = (u) => beat(u, 0, 0.3), sumOf = (u) => beat(u, 0.3, 0.8);
const SUM_AT = 0.55;   // where in a slot the count of rows added ticks over
const outMs = (L, mode) => { const P = mode === "run" ? OUT_RUN : OUT; return P.pre + L * P.key + P.drop; };
/** where a press is on the Output page: the glide `e`, the key `k` being added and its progress `u`, the table's fade `drop` */
function outPhase(anim, L) {
  if (anim.n === 0) return { e: 0, k: 0, u: 0, drop: 0 };
  if (anim.t >= 1) return { e: 1, k: L, u: 1, drop: 1 };
  const P = anim.mode === "run" ? OUT_RUN : OUT, tau = anim.t * outMs(L, anim.mode);
  if (tau < P.pre) return { e: ease(tau / P.pre), k: 0, u: 0, drop: 0 };
  const r = tau - P.pre;
  if (r < L * P.key) return { e: 1, k: Math.floor(r / P.key), u: (r % P.key) / P.key, drop: 0 };
  return { e: 1, k: L, u: 1, drop: ease(Math.min(1, (r - L * P.key) / P.drop)) };
}
/** Σ over the first k keys of αᵢⱼ vⱼ, for query i */
const partialZ = (hd, i, k) => Array.from({ length: M.DK }, (_, d) => { let s = 0; for (let j = 0; j < k; j++) s += hd.alpha[i][j] * hd.v[j][d]; return s; });
/** the share of query i's weight on its first k keys */
const weightSoFar = (hd, i, k) => hd.alpha[i].slice(0, k).reduce((a, b) => a + b, 0);

/* cs 12: the smallest pitch the row labels' face clears; the strips take what is left,
   two of them, v and z, with the lane for the key being added between */
const OT = { top: 52, rh: 24, cs: 12, matTop: 114, lane: 22 };
const heightOutput = (L) => OT.top + L * OT.rh + 124;

function drawOutput(ctx, colors, w, params, state, anim) {
  const toks = state.tokens, L = state.L, h = Number(params.head) - 1, hd = state.run.heads[h], qi = queryOf(anim);
  const ph = outPhase(anim, L), g = qi >= 0 ? glide(anim, ph.e) : null;
  const lw = labelWidth(ctx, colors, toks), mx = PAD_L + lw + 6;
  txt(ctx, S.weightsCap, PAD_L, 18, { font: cap(colors), fill: colors.ink1 });
  matrix(ctx, colors, hd.alpha, toks, mx, OT.matTop, OT.cs, anim, { ge: ph.e });
  const wx = mx + L * OT.cs + 18, kx = wx + 42, vx = kx + lw + 16;
  const vc = Math.max(4, Math.min(14, Math.floor((w - PAD_R - vx - OT.lane) / (2 * M.DK))));
  const zx = vx + M.DK * vc + OT.lane;
  txt(ctx, S.outW, wx, 18, { font: cap(colors), fill: colors.ink1 });
  txt(ctx, S.outV[0], vx, 18, { font: cap(colors), fill: colors.ink1 });
  /* the column header pulled in from the canvas edge where the strips are narrower than it */
  ctx.save(); ctx.font = cap(colors); const zhw = Math.max(ctx.measureText(S.outZcol[0]).width, ctx.measureText(S.outZcol[1]).width); ctx.restore();
  const zhx = Math.min(zx, w - PAD_R - zhw);
  txt(ctx, S.outZcol[0], zhx, 18, { font: cap(colors), fill: colors.ink1 });
  txt(ctx, S.outZcol[1], zhx, 34, { font: small(colors), fill: colors.ink2 });
  const vmax = Math.max(...hd.v.flat().map(Math.abs), ...hd.z.flat().map(Math.abs));
  const blank = rgb(colors.surface2), right = vx + M.DK * vc;
  for (let j = 0; j < L; j++) {
    const y = OT.top + j * OT.rh, ty = y + (OT.rh - 5) / 2;
    ctx.fillStyle = colors.surface2; ctx.fillRect(wx, y, 34, OT.rh - 5);
    if (g) {
      const to = weightFill(colors, hd.alpha[g.to][j]);
      const f = g.first ? mixRgb(blank, to, g.e) : mixRgb(weightFill(colors, hd.alpha[g.from][j]), to, g.e);
      ctx.fillStyle = css(f); ctx.fillRect(wx, y, 34, OT.rh - 5);
      if (!g.first) txt(ctx, hd.alpha[g.from][j].toFixed(2), wx + 17, ty, { font: mono(colors), fill: inkOn(colors, f), align: "center", baseline: "middle", alpha: oldInk(g) });
      txt(ctx, hd.alpha[g.to][j].toFixed(2), wx + 17, ty, { font: mono(colors), fill: inkOn(colors, f), align: "center", baseline: "middle", alpha: newInk(g) });
    }
    ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1; ctx.strokeRect(wx + 0.5, y + 0.5, 33, OT.rh - 6);
    txt(ctx, toks[j], kx, ty, { font: mono(colors), fill: colors.groupB, baseline: "middle" });
    txt(ctx, "·", vx - 9, ty, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    for (let d = 0; d < M.DK; d++) { ctx.fillStyle = css(signedFill(colors, hd.v[j][d], vmax)); ctx.fillRect(vx + d * vc, y, vc - 1, OT.rh - 5); }
    ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1; ctx.strokeRect(vx - 0.5, y - 0.5, M.DK * vc, OT.rh - 4);
    /* zⱼ beside vⱼ: token j's features after attention, once its own query is done */
    const za = j < qi ? 1 : j === qi ? ph.drop : 0;
    for (let d = 0; d < M.DK; d++) {
      ctx.fillStyle = colors.surface2; ctx.fillRect(zx + d * vc, y, vc - 1, OT.rh - 5);
      if (za > 0) { ctx.save(); ctx.globalAlpha = za; ctx.fillStyle = css(signedFill(colors, hd.z[j][d], vmax)); ctx.fillRect(zx + d * vc, y, vc - 1, OT.rh - 5); ctx.restore(); }
    }
    ctx.lineWidth = 1; ctx.strokeStyle = j === qi ? colors.groupA : colors.ink2; ctx.strokeRect(zx - 0.5, y - 0.5, M.DK * vc, OT.rh - 4);
  }
  ctx.lineWidth = 1;
  const yb = OT.top + L * OT.rh + 2;
  line(ctx, wx, yb, wx, yb + 8, colors.ink2); line(ctx, wx, yb + 8, right, yb + 8, colors.ink2); line(ctx, right, yb, right, yb + 8, colors.ink2);
  /* the key being added: one outline stepping row to row, and a line down the lane
     right of the strips carrying it to the sum */
  if (g && ph.e >= 1 && ph.k < L) {
    const at = ph.k === 0 ? 0 : ph.k - 1 + moveOf(ph.u), y = OT.top + at * OT.rh;
    ctx.strokeStyle = colors.groupA; ctx.lineWidth = 2; ctx.strokeRect(vx - 1.5, y - 1.5, M.DK * vc + 2, OT.rh - 2); ctx.lineWidth = 1;
    const y0 = y + (OT.rh - 5) / 2;
    line(ctx, right + 1, y0, right + 8, y0, colors.groupA, 1.5);
    arrow(ctx, right + 8, y0, right + 8, yb + 6, colors.groupA);
  }
  txt(ctx, S.outSum, (wx + right) / 2, yb + 26, { font: cap(colors), fill: colors.ink1, align: "center" });
  arrow(ctx, (wx + right) / 2, yb + 32, (wx + right) / 2, yb + 50, colors.ink2);
  const zy = yb + 56;
  /* zᵢ's running total: the last query's z fading out on the glide, then key by key */
  let zNow = null;
  if (g) {
    if (ph.e < 1) zNow = (d) => (g.first ? blank : mixRgb(signedFill(colors, hd.z[g.from][d], vmax), blank, ph.e));
    else if (ph.k >= L) zNow = (d) => signedFill(colors, hd.z[g.to][d], vmax);
    else {
      const a = partialZ(hd, g.to, ph.k), b = partialZ(hd, g.to, ph.k + 1), s = sumOf(ph.u);
      zNow = (d) => mixRgb(ph.k === 0 ? blank : signedFill(colors, a[d], vmax), signedFill(colors, b[d], vmax), s);
    }
  }
  for (let d = 0; d < M.DK; d++) { ctx.fillStyle = zNow ? css(zNow(d)) : colors.surface2; ctx.fillRect(vx + d * vc, zy, vc - 1, 24); }
  ctx.strokeStyle = colors.ink1; ctx.strokeRect(vx - 0.5, zy - 0.5, M.DK * vc, 25);
  if (g) {
    if (!g.first) txt(ctx, toks[g.from], vx - 10, zy + 12, { font: mono(colors), fill: colors.groupA, align: "right", baseline: "middle", alpha: oldInk(g) });
    txt(ctx, toks[g.to], vx - 10, zy + 12, { font: mono(colors), fill: colors.groupA, align: "right", baseline: "middle", alpha: newInk(g) });
  }
  const added = g ? (ph.e < 1 ? 0 : Math.min(L, ph.k + (ph.u >= SUM_AT ? 1 : 0))) : 0;
  txt(ctx, g && added < L ? S.outSoFar(added, L, Math.round(100 * weightSoFar(hd, g.to, added))) : S.outZ, (vx + right) / 2, zy + 44,
    { font: small(colors), fill: colors.ink2, align: "center" });
}

/* ================================================================ Heads */

const HD = { ff: 8, wo: 52, cat: 96, title: 150, habit: 164, matTop: 176, bh: 26 };
const headsCs = (w, L) => Math.max(6, Math.min(14, Math.floor(((w - PAD_L - PAD_R) / 4 - 16) / L)));
const heightHeads = (w, L) => HD.matTop + L * headsCs(w, L) + 88;

function drawHeads(ctx, colors, w, params, state, anim) {
  const L = state.L, cs = headsCs(w, L), colW = (w - PAD_L - PAD_R) / 4, mid = w / 2;
  const hx = (k) => PAD_L + k * colW + colW / 2, bw = Math.min(230, w * 0.46);
  box(ctx, colors, mid - bw / 2 + 30, HD.ff, bw - 60, HD.bh, S.headsFf, { alpha: 0.45 });
  arrow(ctx, mid, HD.wo, mid, HD.ff + HD.bh + 2, colors.ink3);
  box(ctx, colors, mid - bw / 2, HD.wo, bw, HD.bh, S.headsWo);
  arrow(ctx, mid, HD.cat, mid, HD.wo + HD.bh + 2, colors.ink3);
  box(ctx, colors, mid - bw / 2, HD.cat, bw, HD.bh, S.headsCat);
  const bus = HD.cat + HD.bh + 16;
  line(ctx, mid, HD.cat + HD.bh, mid, bus, colors.ink3, 1.2);
  line(ctx, hx(0), bus, hx(3), bus, colors.ink3, 1.2);
  const matBottom = HD.matTop + L * cs;
  state.run.heads.forEach((hd, k) => {
    line(ctx, hx(k), bus, hx(k), HD.title - 14, colors.ink3, 1.2);
    txt(ctx, `${S.headLabel} ${k + 1}`, hx(k), HD.title, { font: cap(colors), fill: colors.ink1, align: "center" });
    txt(ctx, `${M.HABIT[k].what} ${M.HABIT[k].share.toFixed(2)}`, hx(k), HD.habit, { font: small(colors), fill: colors.ink2, align: "center" });
    matrix(ctx, colors, hd.alpha, state.tokens, Math.round(hx(k) - (L * cs) / 2), HD.matTop, cs, anim, { colLabels: false, rowLabels: false });
    arrow(ctx, hx(k), matBottom + 26, hx(k), matBottom + 6, colors.ink3);
  });
  const xb = matBottom + 26;
  line(ctx, hx(0), xb, hx(3), xb, colors.ink3, 1.2);
  line(ctx, mid, xb, mid, xb + 10, colors.ink3, 1.2);
  box(ctx, colors, mid - 70, xb + 10, 140, HD.bh, S.headsX);
  txt(ctx, S.headsNote, PAD_L, xb + HD.bh + 30, { font: small(colors), fill: colors.ink3 });
}

/* ================================================================= Mask */

const MK = { title: 18, matTop: 96 };
/* two 16-column matrices and one set of row labels (the longest, "discharge", is 9 characters of the mono face) */
const MASK_LABEL_W = 66, MASK_GAP = 24;
const maskCs = (w) => Math.max(8, Math.min(16, Math.floor((w - PAD_L - PAD_R - MASK_LABEL_W - MASK_GAP) / (2 * M.LMAX))));
const heightMask = (w, L) => MK.matTop + L * maskCs(w) + 66;
const padShare = (A, L, n) => (n ? A.slice(0, n).reduce((s, r) => s + M.tailShare(r, L), 0) / n : null);

function drawMask(ctx, colors, w, params, state, anim) {
  const L = state.L, h = Number(params.head) - 1, cs = maskCs(w), P = state.padded;
  const toks = P.tokens, lw = labelWidth(ctx, colors, toks);
  const open = P.open.heads[h].alpha.slice(0, L);
  const shut = P.masked.heads[h].alpha.slice(0, L).map((r) => r.map((v, j) => (j < L ? v : null)));
  const x0 = PAD_L + lw + 6, x1 = Math.max(x0 + M.LMAX * cs + MASK_GAP, w - PAD_R - M.LMAX * cs);
  const shares = [padShare(open, L, anim.n), anim.n ? 0 : null];
  [[x0, open, S.maskOpen, true], [x1, shut, S.maskShut, false]].forEach(([x, A, title, rows], k) => {
    txt(ctx, title, x + (M.LMAX * cs) / 2, MK.title, { font: cap(colors), fill: colors.ink1, align: "center" });
    matrix(ctx, colors, A, toks, x, MK.matTop, cs, anim, { rowLabels: rows, padFrom: L });
    const v = shares[k];
    txt(ctx, S.onPad(v === null ? S.wait : `${Math.round(100 * v)}%`), x + (M.LMAX * cs) / 2, MK.matTop + L * cs + 22,
      { font: cap(colors), fill: k === 0 ? colors.extreme : colors.empirical, align: "center" });
  });
  txt(ctx, S.maskNote, PAD_L, MK.matTop + L * cs + 48, { font: small(colors), fill: colors.ink3 });
}

/* ============================================================ the widget */

const heightOf = ({ page, sentence, w }) => {
  const L = M.tokensOf(sentence).length;
  return page === "output" ? heightOutput(L) : page === "heads" ? heightHeads(w, L) : page === "mask" ? heightMask(w, L) : heightWeights(w, L);
};

defineWidget({
  slug: "attention",
  status: "draft",
  title: S.title,
  subtitle: S.subtitle,
  layout: "side",
  height: heightOf,

  params: {
    page: { role: "page", type: "segmented", style: "grid", label: S.pageLabel, options: PAGES, default: "weights", display: true },
    sentence: {
      type: "select", label: S.sentenceLabel, detail: S.sentenceDetail,
      options: Object.entries(M.SENTENCES).map(([value, label]) => ({ value, label })), default: "aspirin",
    },
    head: {
      type: "segmented", label: S.headLabel, detail: S.headDetail,
      options: ["1", "2", "3", "4"].map((v) => ({ value: v, label: v })), default: "4", display: true,
      when: { any: [ON("weights"), ON("output"), ON("mask")] },
    },
    scores: { type: "segmented", label: S.scoreLabel, detail: S.scoreDetail, options: S.scoreOpts, default: "scaled", display: true, when: ON("weights") },
    /* authoring escape hatch, first render only: rows already computed */
    shown: { type: "int", min: 0, max: 16, default: 0, hidden: true },
  },

  legend: [],

  compute: ({ params }) => M.stage(params.sentence),

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,
    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.max(0, Math.min(state.L, Number(params.shown) || 0));
      return { n, t: 1, done: n >= state.L };
    },
    advance: (anim, { dt, params, state }) => {
      /* the Output page's press takes its keys one at a time, so it runs longer */
      const ms = params.page === "output" ? outMs(state.L, anim.mode) : anim.mode === "run" ? RUN_MS : STEP_MS;
      let more;
      if (anim.t < 1) { anim.t = Math.min(1, anim.t + dt / ms); more = anim.t < 1 || (anim.mode === "run" && anim.n < state.L); }
      else if (anim.n < state.L) { anim.n += 1; anim.t = 0; more = true; }
      else more = false;
      anim.done = anim.n >= state.L && anim.t >= 1;
      return more;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params);
    if (params.page === "output") drawOutput(ctx, colors, w, params, state, anim);
    else if (params.page === "heads") drawHeads(ctx, colors, w, params, state, anim);
    else if (params.page === "mask") drawMask(ctx, colors, w, params, state, anim);
    else drawWeights(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    const qi = queryOf(anim), h = Number(params.head) - 1, L = state.L;
    const pct = (v) => `${Math.round(100 * v)}%`;
    if (params.page === "heads") {
      return [
        { label: S.tileHeads, value: "4 × 12", note: S.tileHeadsNote },
        { label: S.tileCat, value: `[${L}, 48]`, note: S.tileCatNote },
        { label: S.tileRows, value: `${anim.n} of ${L}`, note: S.tileRowsNote },
      ];
    }
    if (params.page === "mask") {
      const open = state.padded.open.heads[h].alpha;
      const v = padShare(open, L, anim.n);
      return [
        { label: S.tilePads, value: String(M.LMAX - L), note: S.tilePadsNote },
        { label: S.tileOpen, value: v === null ? S.wait : pct(v), note: S.tileOpenNote },
        { label: S.tileShut, value: anim.n ? "0%" : S.wait, note: S.tileShutNote },
      ];
    }
    const A = params.page === "weights" && params.scores === "raw" ? state.run.heads[h].alphaRaw : state.run.heads[h].alpha;
    const row = qi >= 0 ? A[qi] : null, top = row ? row.indexOf(Math.max(...row)) : -1;
    const first = { label: S.tileQuery, value: qi >= 0 ? state.tokens[qi] : S.wait, note: S.tileQueryNote };
    const second = { label: S.tileTop, value: row ? `${state.tokens[top]} ${row[top].toFixed(2)}` : S.wait, note: S.tileTopNote };
    if (params.page === "output") {
      const ph = outPhase(anim, L), hd = state.run.heads[h];
      const k = qi < 0 || ph.e < 1 ? 0 : Math.min(L, ph.k + (ph.u >= SUM_AT ? 1 : 0));
      return [first,
        { label: S.tileAdded, value: qi >= 0 ? `${k} of ${L}` : S.wait, note: S.tileAddedNote },
        { label: S.tileShare, value: qi >= 0 ? `${Math.round(100 * weightSoFar(hd, qi, k))}%` : S.wait, note: S.tileShareNote }];
    }
    return [first, second, { label: S.tileSum, value: row ? row.reduce((a, b) => a + b, 0).toFixed(2) : S.wait, note: S.tileSumNote(L) }];
  },

  summary({ params, state, anim }) {
    return S.sum(PAGES.find((p) => p.value === params.page).label, anim.n, state.L);
  },
});
