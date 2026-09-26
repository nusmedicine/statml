/* ============================================================================
   Widget 83 · Language: Attention (`attention`) — PHM5005 08-1 cell 1
   (step 3, "Computing Self-Attention", and "Extending self-attention"), with
   08-3 cell 4's padding mask. DRAFT, 2026-09-25.

   Four steps in the order the arithmetic runs, each drawn as his figure draws
   it (the control is labelled Step, his call of 2026-09-26):

     PROJECTIONS  where q, k and v come from: X times W_Q, W_K and W_V, the
              whole product and one number of it (added 2026-09-26 on his
              question "they are the embeddings right?"; they are not).
     WEIGHTS  dl-language-attention-weight.png: the query circled in the
              sentence, its bracket to every key, the scores and then the
              row of weights under the keys, and the matrix alpha_ij filling
              a row a press. The sentence carries four [PAD] and the
              tokenizer's attention_mask (08-3 cell 4, 08-1 cell 5): the mask
              acts on the scores before the softmax, so it lives here, not on
              a step of its own (a Mask step was built, moved, and folded in
              on his word the same day, `_lab/attention-mask-fold-mock.html`).
              Switches: the division by sqrt(d_k), the mask passed or not.
     OUTPUT   dl-language-attention-output.png: the query's row lifted out,
              each weight beside that key's value vector, summed into the
              query's new vector z_i. (Its section 1, x~ → W_V → v, moved to
              Projections, his call the same day.)
     HEADS    dl-language-attention-multi.png, bottom to top: x~ into four
              heads side by side, their outputs joined — drawn as the
              concatenation it is, [L, 4 x 12], where his figure draws a + —
              then W_O, then the feed-forward, dimmed (the block's other
              half is the next widget's).

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

const PAGES = [{ value: "projections", label: "Projections" }, { value: "weights", label: "Weights" }, { value: "output", label: "Output" }, { value: "heads", label: "Heads" }];
const ON = (page) => ({ param: "page", equals: page });

/* ================================================================== copy */

const S = {
  title: "Deep Learning - Language: Attention",
  subtitle: "Each token's query is scored against every token's key, the scores are divided by √dₖ, and padded positions are set to −∞; "
    + "a softmax then normalises each row into weights that sum to one. A token's output is the weighted sum of the values, "
    + "and multi-head attention computes this in several heads in parallel.",
  pageLabel: "Step",
  sentenceLabel: "Sentence",
  sentenceDetail: "Synthetic clinical notes, the input to a small model pretrained by masked-word prediction.",
  headLabel: "Head",
  headDetail: "Four heads of 12 numbers each, in the model's first block.",
  scoreLabel: "Scores",
  scoreDetail: "The same trained queries and keys, with the dot product divided by √12 or not.",
  scoreOpts: [{ value: "scaled", label: "q·k / √dₖ" }, { value: "unscaled", label: "q·k" }],
  stepLabel: "Next query",
  stepTitle: "Compute the next token's row of weights, in every head",
  stepLabelTok: "Next token",
  stepTitleTok: "Compute the next token's query, key and value",
  runLabel: "Play",
  runTitle: "Compute the remaining rows",
  query: "Query", keys: "Keys",
  weightsCap: "Attention weights αᵢⱼ",
  rowCap: (q, h, raw) => `α for the query "${q}" · head ${h}${raw ? " · q·k without the division" : ""} · the row sums to 1`,
  rowWait: "Next query computes the first row",
  scoresRow: "Scores", weightsRow: "Weights",
  softmaxArrow: (raw, masked) => `${masked ? "−∞ where the mask is 0, then " : ""}softmax of ${raw ? "q·k" : "q·k / √dₖ"} ↓`,
  maskRow: "Mask", padGroup: (n) => `[PAD] × ${n}`,
  maskLabel: "attention_mask",
  maskDetail: "1 for a token, 0 for padding. Passed, a key with 0 gets the score −∞ before the softmax.",
  maskOpts: [{ value: "passed", label: "Passed" }, { value: "not-passed", label: "Not passed" }],
  projS1: ["1 · Projections", "Q = X W_Qᵀ + b,  K = X W_Kᵀ + b,  V = X W_Vᵀ + b", ""],
  projS2: ["2 · One number of qᵢ", "qₘ = Σₖ x̃ₖ Wₖₘ + bₘ", ""],
  projWhy: "Each column of W is a trained set of 48 weights, applied to every token the same way a convolution kernel "
    + "is applied at every position; each of a vector's 12 numbers is how strongly x̃ matches one column.",
  projX: (L) => `X  [${L} × 48]`, projXNote: "a row per token, its x̃",
  projW: (key) => `W_${key}ᵀ`, projWSize: "[48 × 12]", projR: (key, L) => `${key}  [${L} × 12]`,
  projHead: (h) => `head ${h}: 12 of the 48 columns of each Wᵀ`,
  projXi: "x̃ᵢ", projProd: "x̃ₖ Wₖₘ", projQ: "qᵢ", projCol: (m) => `m = ${m}`,
  projSum: (v) => `Σ + b = ${v.toFixed(2)}`, projWait: "Next token computes the first row",
  tileTok: "Token", tileTokNote: "the row just computed",
  tileCol: "Column of W_Qᵀ", tileColNote: "the number of qᵢ being computed",
  tileRowsTokNote: "one row per token",
  outW: "Weights", outV: "Features vⱼ",
  outS2: ["Output", "zᵢ = Σⱼ αᵢⱼ vⱼ", "the values of all tokens, weighted by the query's αᵢⱼ and summed"], outZcol: ["Features with", "attention zⱼ"], outSum: "Sum", outZ: "Features with attention",
  outSoFar: (k, L, pct) => `${k} of ${L} rows added · ${pct}% of the weight`,
  tileAdded: "Rows added", tileAddedNote: "terms of Σⱼ αᵢⱼvⱼ summed so far",
  tileShare: "Weight added", tileShareNote: "the sum of their αᵢⱼ",
  headsX: (L) => `x̃  [${L} × 48]`, headsZ: (L) => `[${L} × 12]`, headsCat: (L) => `concatenated [${L} × 48]`, headsWo: "× W_Oᵀ + b",
  headsOut: (L) => `output [${L} × 48]`, headsFf: "Feed-forward",
  headsNote: "Rows: queries · α columns: keys · each share measured over 500 notes",
  tileQuery: "Query", tileQueryNote: "the row just computed",
  tileTop: "Largest weight", tileTopNote: "the key with the largest αᵢⱼ in this row",
  tilePad: "On [PAD]", tilePadNote: (masked) => (masked ? "keys with mask 0 get weight 0" : "no mask: [PAD] keys are scored and weighted"),
  tileHeads: "Heads", tileHeadsNote: "48, the model dimension",
  tileRows: "Rows computed", tileRowsNote: "one row per query",
  wait: "—",
  sum: (step, n, L) => `${step}: ${n} of ${L} rows computed.`,
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
  /* the three projections of the one X (the values used to be the Output step's section 1) */
  projections: ["Q", "K", "V"].map((k) => `<math><mrow>${mi(k)}${mo("=")}${mi("X")}<msubsup>${mi("W")}${mi(k)}${mi("T")}</msubsup>${mo("+")}${mi("b")}</mrow></math>`)
    .join(`<span style="margin:0 10px"></span>`),
  output: `<math><mrow>${sub("z", "i")}${mo("=")}<munder>${mo("∑")}${mi("j")}</munder>${sub("α", "ij")}${sub("v", "j")}</mrow></math>`,
  heads: `<math><mrow>${mi("MultiHead")}${mo("=")}${mo("[")}<msub>${mi("head")}<mn>1</mn></msub>${mo(";")}${mo("…")}${mo(";")}<msub>${mi("head")}<mn>4</mn></msub>${mo("]")}<msub>${mi("W")}${mi("O")}</msub></mrow></math>`,
  mask: `<math><mrow>${sub("α", "ij")}${mo("=")}${SOFT(`<mfrac><mrow>${qk}</mrow><msqrt>${sub("d", "k")}</msqrt></mfrac>${mo("+")}${sub("m", "j")}`)}</mrow></math>`,
  maskRaw: `<math><mrow>${sub("α", "ij")}${mo("=")}${SOFT(`${qk}${mo("+")}${sub("m", "j")}`)}</mrow></math>`,
};
const PLAIN = {
  scaled: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ / √dₖ)", raw: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ)", output: "zᵢ = Σⱼ αᵢⱼ vⱼ",
  projections: "Q = X W_Qᵀ + b,  K = X W_Kᵀ + b,  V = X W_Vᵀ + b",
  heads: "MultiHead = [head₁; …; head₄] W_O", mask: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ / √dₖ + mⱼ)", maskRaw: "αᵢⱼ = softmaxⱼ(qᵢ·kⱼ + mⱼ)",
};
const NOTE = {
  scaled: "dₖ = 12", raw: "no division", output: "", heads: "", projections: "each Wᵀ is 48 × 48; a head takes 12 of its columns", mask: "dₖ = 12 · mⱼ = 0, or −∞ where the mask is 0", maskRaw: "no division · mⱼ = 0, or −∞ where the mask is 0",
};
function renderCard(params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  const unscaled = params.scores === "unscaled";
  const which = params.page !== "weights" ? params.page : params.attention_mask !== "not-passed" ? (unscaled ? "maskRaw" : "mask") : unscaled ? "raw" : "scaled";
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

/** how far along each row is: rows before the newest full, the newest at `fresh` (its tween), the rest empty */
const rowAlpha = (anim, i, fresh) => (i < anim.n - 1 ? 1 : i === anim.n - 1 ? fresh : 0);
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
function matrix(ctx, colors, A, toks, x0, y0, cs, anim, { colLabels = true, rowLabels = true, padFrom = -1, box: outline = true, ge = ease(anim.t), fresh = ge, frame = null } = {}) {
  const L = A.length, K = A[0].length, qi = queryOf(anim);
  /* upright: slanted, neighbouring names overlapped even at 24px cells (the text-overlap sweep, 2026-09-26) */
  const steep = true;
  if (colLabels) toks.forEach((t, j) => {
    ctx.save(); ctx.translate(x0 + j * cs + cs / 2 + (steep ? 0 : 3), y0 - 5); ctx.rotate(steep ? -Math.PI / 2 : -Math.PI / 3);
    txt(ctx, t, 0, 0, { font: mono(colors), fill: padFrom >= 0 && j >= padFrom ? colors.ink3 : colors.groupB, baseline: steep ? "middle" : "alphabetic" }); ctx.restore();
  });
  for (let i = 0; i < L; i++) {
    if (rowLabels) txt(ctx, toks[i], x0 - 5, y0 + i * cs + cs / 2, { font: mono(colors), fill: i === qi ? colors.groupA : colors.ink2, align: "right", baseline: "middle" });
    const a = rowAlpha(anim, i, fresh);
    for (let j = 0; j < K; j++) {
      const x = x0 + j * cs, y = y0 + i * cs;
      ctx.fillStyle = colors.surface2; ctx.fillRect(x, y, cs - 1, cs - 1);
      if (a > 0 && A[i][j] !== null) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = css(weightFill(colors, A[i][j])); ctx.fillRect(x, y, cs - 1, cs - 1); ctx.restore(); }
      if (padFrom >= 0 && j >= padFrom) line(ctx, x + 1, y + cs - 2, x + cs - 2, y + 1, colors.ink3, 1);
    }
  }
  if (outline) { ctx.strokeStyle = frame ?? colors.ink2; ctx.lineWidth = frame ? 1.5 : 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, K * cs, L * cs); ctx.lineWidth = 1; }
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

/* ========================================================== Projections */

/* WHERE q, k AND v COME FROM (his question, 2026-09-26: "do we have to explain where q
   and k come from? they are the embeddings right?"). They are not: each is x̃ times its
   own trained matrix, and measured on this model q = k = x̃ would put 1.00 of every
   row's weight on the token itself and score each pair alike in both directions. His
   picks from `_lab/attention-projections-mock.html`: a step of its own ahead of Weights,
   P1 with P2 under it, W1's wording (the kernel reading, his), no comparison panel, and
   the Output step's section 1 removed, since v is drawn here.
     1 · PROJECTIONS  X [L × 48] times each of W_Qᵀ, W_Kᵀ, W_Vᵀ (head h's 12 columns of
                      each) gives Q, K, V [L × 12], laid out as a matrix product is taught:
                      each W above its result, X to the left of the results, so a number
                      sits where its row of X meets its column of W. X's 48 columns and
                      W's 48 rows share one pitch.
     2 · ONE NUMBER   the token's 48 numbers beside one column of W_Qᵀ, the 48 products
                      and their sum plus the bias: one number of qᵢ.
   A press is a token: its row outline glides down X, then the sweep takes W_Qᵀ's twelve
   columns in turn, each filling one number of qᵢ and redrawing section 2 for that column;
   then kᵢ's row and vᵢ's row fill, the same arithmetic with the other two matrices. */
const PJ = { pre: 300, col: 180, kv: 300 }, PJ_RUN = { pre: 150, col: 70, kv: 150 };
const projMs = (mode) => { const P = mode === "run" ? PJ_RUN : PJ; return P.pre + M.DK * P.col + 2 * P.kv; };
/** where a Projections press is: the glide `e`, the column `m` of W_Qᵀ and its fill `u`, then kᵢ's row `k` and vᵢ's `v` */
function projPhase(anim) {
  if (anim.n === 0) return { e: 0, m: -1, u: 0, k: 0, v: 0 };
  if (anim.t >= 1) return { e: 1, m: M.DK - 1, u: 1, k: 1, v: 1 };
  const P = anim.mode === "run" ? PJ_RUN : PJ, tau = anim.t * projMs(anim.mode);
  if (tau < P.pre) return { e: ease(tau / P.pre), m: -1, u: 0, k: 0, v: 0 };
  const r = tau - P.pre;
  if (r < M.DK * P.col) return { e: 1, m: Math.floor(r / P.col), u: ease(Math.min(1, (r % P.col) / (0.6 * P.col))), k: 0, v: 0 };
  const s = r - M.DK * P.col;
  return { e: 1, m: M.DK - 1, u: 1, k: ease(Math.min(1, s / P.kv)), v: ease(Math.max(0, Math.min(1, (s - P.kv) / P.kv))) };
}
/* the pitches depend on the width alone, so the height can be known without a context;
   LABEL_W is the widest token label's room ("presented", "discharge" in the mono face) */
const PL = { wLab: 40, wTop: 64, gap: 44, rh: 14, s2Gap: 50, lineH: 15, LABEL_W: 64 };
const projPitch = (w) => ({ xc: w >= 600 ? 3 : 2, ch: w >= 600 ? 4 : 3 });
/** section 1's geometry: X's cells `xc` (and W's rows), the results' cells `wc`, the results' x `ox(k)` */
function projLayout(w, L) {
  const { xc } = projPitch(w), xx = PAD_L + PL.LABEL_W + 8, x1 = xx + 48 * xc + 24;
  const room = w - PAD_R - x1;
  const wc = Math.max(5, Math.min(9, Math.floor((room - 2 * 16) / (3 * M.DK))));
  const gap = Math.min(34, Math.floor((room - 3 * M.DK * wc) / 2));
  const oTop = PL.wTop + 48 * xc + PL.gap;
  return { xx, xc, wc, ox: (k) => x1 + k * (M.DK * wc + gap), oTop, s2: oTop + L * PL.rh + PL.s2Gap };
}
/* W1's sentence wraps; the line count is estimated from the width at 6 px a character,
   generously, so the height is known before any text is measured */
const projLines = (w) => Math.ceil((S.projWhy.length * 6) / (w - PAD_L - PAD_R));
const heightProjections = (w, L) => projLayout(w, L).s2 + 22 + projLines(w) * PL.lineH + 30 + 48 * projPitch(w).ch + 40;

function wrapLines(ctx, font, text, maxW) {
  ctx.save(); ctx.font = font;
  const lines = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

function drawProjections(ctx, colors, w, params, state, anim) {
  const toks = state.tokens, L = state.L, h = Number(params.head) - 1, hd = state.run.heads[h], qi = queryOf(anim);
  const ph = projPhase(anim), lay = projLayout(w, L), { xx, xc, wc, ox, oTop } = lay, rh = PL.rh;
  const X = state.run.X, xmax = Math.max(...X.flat().map(Math.abs));
  const Wt = { Q: M.headWeights("q", h), K: M.headWeights("k", h), V: M.headWeights("v", h) };
  const R = { Q: hd.q, K: hd.k, V: hd.v };
  const wmax = Math.max(...Object.values(Wt).flatMap((p) => p.WT.flat()).map(Math.abs));
  const omax = Math.max(...Object.values(R).flatMap((A) => A.flat()).map(Math.abs));
  const gap = (c) => (c > 4 ? 1 : 0);
  const cell = (x, y, cw, chh, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, cw - gap(cw), chh - gap(chh)); };
  const frame = (x, y, wid, hgt, stroke = colors.ink2) => { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, y - 1, wid + 1, hgt + 1); ctx.lineWidth = 1; };
  const mark = (x, y, wid, hgt) => { ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(x - 1.5, y - 1.5, wid + 2, hgt + 2); ctx.lineWidth = 1; };
  const m = qi >= 0 ? ph.m : -1;

  /* ---- 1 · Projections: X to the left, each W above its result */
  sectionHead(ctx, colors, 16, S.projS1);
  txt(ctx, S.projX(L), xx, oTop - 30, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  txt(ctx, S.projXNote, xx, oTop - 15, { font: small(colors), fill: colors.ink2, baseline: "middle" });
  toks.forEach((t, i) => txt(ctx, t, xx - 7, oTop + i * rh + rh / 2, { font: mono(colors), fill: i === qi ? colors.groupA : colors.ink2, align: "right", baseline: "middle" }));
  X.forEach((row, i) => row.forEach((v, d) => cell(xx + d * xc, oTop + i * rh, xc, rh, css(signedFill(colors, v, xmax)))));
  frame(xx, oTop, 48 * xc, L * rh);
  queryOutline(ctx, colors, xx, oTop, 48 * xc, rh, anim, ph.e);
  ["Q", "K", "V"].forEach((key, k) => {
    const x0 = ox(k), cw = M.DK * wc, WT = Wt[key].WT;
    txt(ctx, S.projW(key), x0 + cw / 2, PL.wLab, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    txt(ctx, S.projWSize, x0 + cw / 2, PL.wLab + 14, { font: small(colors), fill: colors.ink2, align: "center", baseline: "middle" });
    WT.forEach((row, i) => row.forEach((v, d) => cell(x0 + d * wc, PL.wTop + i * xc, wc, xc, css(signedFill(colors, v, wmax)))));
    frame(x0, PL.wTop, cw, 48 * xc);
    /* the result: rows before the token full; the token's row by the sweep (q) or its beat (k, v) */
    for (let i = 0; i < L; i++) for (let d = 0; d < M.DK; d++) {
      const a = i < qi ? 1 : i > qi ? 0 : key === "Q" ? (d < m ? 1 : d === m ? ph.u : 0) : key === "K" ? ph.k : ph.v;
      cell(x0 + d * wc, oTop + i * rh, wc, rh, colors.surface2);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; cell(x0 + d * wc, oTop + i * rh, wc, rh, css(signedFill(colors, R[key][i][d], omax))); ctx.restore(); }
    }
    frame(x0, oTop, cw, L * rh);
    queryOutline(ctx, colors, x0, oTop, cw, rh, anim, ph.e);
    txt(ctx, S.projR(key, L), x0 + cw / 2, oTop + L * rh + 14, { font: small(colors), fill: colors.ink1, align: "center", baseline: "middle" });
    if (key === "Q" && m >= 0) { mark(x0 + m * wc, PL.wTop, wc, 48 * xc); mark(x0 + m * wc, oTop + qi * rh, wc, rh); }
  });
  txt(ctx, S.projHead(h + 1), ox(0), oTop + L * rh + 30, { font: small(colors), fill: colors.ink3, baseline: "middle" });

  /* ---- 2 · One number: x̃ᵢ, column m of W_Qᵀ, the 48 products, their sum plus the bias */
  const s2 = lay.s2, { ch } = projPitch(w);
  sectionHead(ctx, colors, s2, S.projS2);
  const lines = wrapLines(ctx, small(colors), S.projWhy, w - PAD_L - PAD_R);
  lines.forEach((ln, k) => txt(ctx, ln, PAD_L, s2 + 22 + k * PL.lineH, { font: small(colors), fill: colors.ink2, baseline: "middle" }));
  const fy = s2 + 22 + projLines(w) * PL.lineH + 30, fh = 48 * ch, mid = fy + fh / 2;
  const cx = xx, wx = cx + 14 + 26, px = wx + M.DK * wc + 44, qx = px + 14 + 116;
  const on = qi >= 0 && m >= 0, WQ = Wt.Q.WT, x = on ? X[qi] : null;
  const prod = on ? x.map((v, k) => v * WQ[k][m]) : null, pmax = on ? Math.max(...prod.map(Math.abs)) : 1;
  txt(ctx, S.projXi, cx + 7, fy - 12, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  if (qi >= 0) txt(ctx, toks[qi], cx - 7, mid, { font: mono(colors), fill: colors.groupA, align: "right", baseline: "middle" });
  for (let k = 0; k < 48; k++) cell(cx, fy + k * ch, 14, ch, on ? css(signedFill(colors, x[k], xmax)) : colors.surface2);
  frame(cx, fy, 14, fh, qi >= 0 ? colors.groupA : colors.ink2);
  txt(ctx, "×", cx + 14 + 13, mid, { font: cap(colors), fill: colors.ink3, align: "center", baseline: "middle" });
  txt(ctx, S.projW("Q"), wx + (M.DK * wc) / 2, fy - 12, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  WQ.forEach((row, k) => row.forEach((v, d) => cell(wx + d * wc, fy + k * ch, wc, ch, css(signedFill(colors, v, wmax)))));
  frame(wx, fy, M.DK * wc, fh);
  if (on) {
    mark(wx + m * wc, fy, wc, fh);
    txt(ctx, S.projCol(m + 1), wx + m * wc + wc / 2, fy + fh + 14, { font: small(colors), fill: colors.ink2, align: "center", baseline: "middle" });
  }
  arrow(ctx, wx + M.DK * wc + 8, mid, px - 8, mid, colors.ink3);
  txt(ctx, S.projProd, px + 7, fy - 12, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  for (let k = 0; k < 48; k++) cell(px, fy + k * ch, 14, ch, on ? css(signedFill(colors, prod[k], pmax)) : colors.surface2);
  frame(px, fy, 14, fh);
  arrow(ctx, px + 22, mid, qx - 8, mid, colors.ink3);
  if (on) txt(ctx, S.projSum(hd.q[qi][m]), (px + 22 + qx - 8) / 2, mid - 10, { font: mono(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  txt(ctx, S.projQ, qx + (M.DK * wc) / 2, mid - 24, { font: cap(colors), fill: colors.ink1, align: "center", baseline: "middle" });
  for (let d = 0; d < M.DK; d++) {
    const a = !on ? 0 : d < m ? 1 : d === m ? ph.u : 0;
    cell(qx + d * wc, mid - 9, wc, 18, colors.surface2);
    if (a > 0) { ctx.save(); ctx.globalAlpha = a; cell(qx + d * wc, mid - 9, wc, 18, css(signedFill(colors, hd.q[qi][d], omax))); ctx.restore(); }
  }
  frame(qx, mid - 9, M.DK * wc, 18);
  if (on) mark(qx + m * wc, mid - 9, wc, 18);
  if (qi < 0) txt(ctx, S.projWait, qx + (M.DK * wc) / 2, mid + 26, { font: small(colors), fill: colors.ink3, align: "center", baseline: "middle" });
}

/* ============================================================== Weights */

/* A PRESS IS THE FORMULA'S STEPS (his picks, 2026-09-26: C from
   `_lab/attention-weights-motion-mock.html`, then the mask folded in, B from
   `_lab/attention-mask-fold-mock.html`). The sentence carries four [PAD] and the
   tokenizer's attention_mask under the keys, 1 for a token and 0 for padding.
   The query glides to its token; an outline steps along every key, [PAD] too, and
   each score qᵢ·kⱼ/√dₖ prints in the Scores strip; with the mask passed, one beat
   turns the scores over its 0s to −∞; then the softmax fills the Weights strip and
   the matrix gets the row. Both strips stay after the press, so the Scores and
   Mask switches move rows the reader can read. A score has no colour — it is not
   yet a weight. */
const WP = { pre: 260, key: 240, cut: 420, soft: 700 }, WP_RUN = { pre: 160, key: 120, cut: 220, soft: 350 };
const weightsMs = (K, mode, masked) => { const P = mode === "run" ? WP_RUN : WP; return P.pre + K * P.key + (masked ? P.cut : 0) + P.soft; };
/** where a press is on the Weights page: the glide `e`, the key `k` being scored and its progress `u`, the mask beat `cut`, the softmax `soft` */
function weightsPhase(anim, K, masked) {
  if (anim.n === 0) return { e: 0, k: -1, u: 0, cut: 0, soft: 0 };
  if (anim.t >= 1) return { e: 1, k: K, u: 1, cut: 1, soft: 1 };
  const P = anim.mode === "run" ? WP_RUN : WP, tau = anim.t * weightsMs(K, anim.mode, masked);
  if (tau < P.pre) return { e: ease(tau / P.pre), k: -1, u: 0, cut: 0, soft: 0 };
  let r = tau - P.pre;
  if (r < K * P.key) return { e: 1, k: Math.floor(r / P.key), u: (r % P.key) / P.key, cut: 0, soft: 0 };
  r -= K * P.key;
  const cutMs = masked ? P.cut : 0;
  if (r < cutMs) return { e: 1, k: K, u: 1, cut: ease(r / cutMs), soft: 0 };
  return { e: 1, k: K, u: 1, cut: 1, soft: ease(Math.min(1, (r - cutMs) / P.soft)) };
}

const WT = { qY: 34, keyY: 96, maskY: 108, maskH: 22, scoreY: 140, stripH: 28, softY: 184, weightY: 198, capY: 242, arrowTo: 262, matTop: 336, cs: 24 };
const weightsCs = (w, K) => Math.min(WT.cs, Math.floor((w - PAD_L - PAD_R - 150) / K));
const heightWeights = (w, L, K) => WT.matTop + L * weightsCs(w, K) + 34;

/** the keys as columns: the words sized to the words, the [PAD] narrower; the whole row
    scaled to fit the narrowest canvas */
function keyColumns(ctx, colors, toks, L, x0, avail) {
  ctx.save(); ctx.font = mono(colors);
  const word = (t) => Math.max(ctx.measureText(t).width + 10, ctx.measureText("−0.00").width + 8);
  const want = toks.map((t, j) => (j < L ? word(t) : ctx.measureText("−0.0").width + 8));
  ctx.restore();
  const s = Math.min(1, avail / want.reduce((a, b) => a + b, 0));
  const xs = []; let x = x0;
  for (const c of want) { xs.push([x, c * s]); x += c * s; }
  return xs;
}
/** a score to two places, one where the column is narrower, with a true minus sign */
function scoreText(ctx, colors, v, room) {
  ctx.save(); ctx.font = mono(colors);
  const f = (p) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(p);
  const s = ctx.measureText(f(2)).width <= room ? f(2) : ctx.measureText(f(1)).width <= room ? f(1) : f(0);
  ctx.restore();
  return s;
}

/** the numbers the Weights page draws, for the switches as set */
function weightsView(state, params) {
  const h = Number(params.head) - 1, raw = params.scores === "unscaled", masked = params.attention_mask !== "not-passed";
  const P = state.padded, run = (masked ? P.masked : P.open).heads[h];
  return { raw, masked, toks: P.tokens, K: P.tokens.length, Sc: raw ? P.open.heads[h].scoreRaw : P.open.heads[h].score, A: raw ? run.alphaRaw : run.alpha };
}

function drawWeights(ctx, colors, w, params, state, anim) {
  const L = state.L, h = Number(params.head) - 1, qi = queryOf(anim);
  const { raw, masked, toks, K, Sc, A } = weightsView(state, params);
  const ph = weightsPhase(anim, K, masked), g = qi >= 0 ? glide(anim, ph.e) : null;
  const cols = keyColumns(ctx, colors, toks, L, PAD_L + 50, w - PAD_L - PAD_R - 50), cx = (j) => cols[j][0] + cols[j][1] / 2;
  const x0 = cols[0][0], x1 = cols[K - 1][0] + cols[K - 1][1];
  /* where the row is squeezed below the words' own widths (the longest sentence on the
     narrowest canvas), alternate words stand one line higher, so each stays readable
     and in its column (the text-overlap sweep, 2026-09-26) */
  ctx.save(); ctx.font = mono(colors);
  const crowded = toks.slice(0, L).some((t, j) => ctx.measureText(t).width + 2 > cols[j][1]);
  ctx.restore();
  const lift = (j) => (crowded && j % 2 ? 12 : 0), qy = (j) => WT.qY - lift(j), ky = (j) => WT.keyY - 8 - lift(j);
  const arrowEnd = crowded ? 64 : 74;
  txt(ctx, S.query, PAD_L, WT.qY, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  txt(ctx, S.keys, PAD_L, WT.keyY - 8, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  for (let j = 0; j < L; j++) {
    txt(ctx, toks[j], cx(j), qy(j), { font: mono(colors), fill: j === qi ? colors.groupA : colors.ink3, align: "center", baseline: "middle" });
    txt(ctx, toks[j], cx(j), ky(j), { font: mono(colors), fill: colors.groupB, align: "center", baseline: "middle" });
  }
  /* the [PAD] keys share one label, over a bracket */
  txt(ctx, S.padGroup(K - L), (cols[L][0] + x1) / 2, WT.keyY - 8, { font: mono(colors), fill: colors.ink3, align: "center", baseline: "middle" });
  line(ctx, cols[L][0] + 2, WT.keyY + 1, x1 - 2, WT.keyY + 1, colors.ink3, 1);
  /* the attention_mask row: 1 over a token, 0 over a [PAD]; grey when not passed */
  txt(ctx, S.maskRow, x0 - 6, WT.maskY + WT.maskH / 2, { font: small(colors), fill: masked ? colors.ink2 : colors.ink3, align: "right", baseline: "middle" });
  for (let j = 0; j < K; j++) {
    ctx.fillStyle = colors.surface2; ctx.fillRect(cols[j][0], WT.maskY, cols[j][1], WT.maskH);
    const zero = j >= L, hot = masked && zero && ph.cut > 0 && ph.cut < 1;
    txt(ctx, zero ? "0" : "1", cx(j), WT.maskY + WT.maskH / 2, { font: mono(colors), fill: !masked ? colors.ink3 : zero ? colors.extreme : colors.ink1, align: "center", baseline: "middle" });
    if (hot) { ctx.strokeStyle = colors.extreme; ctx.lineWidth = 1.5; ctx.strokeRect(cols[j][0] + 1, WT.maskY + 1, cols[j][1] - 2, WT.maskH - 2); ctx.lineWidth = 1; }
  }
  ctx.strokeStyle = masked ? colors.ink2 : colors.ink3; ctx.strokeRect(x0 + 0.5, WT.maskY + 0.5, x1 - x0 - 1, WT.maskH - 1);
  txt(ctx, S.scoresRow, x0 - 6, WT.scoreY + WT.stripH / 2, { font: small(colors), fill: colors.ink2, align: "right", baseline: "middle" });
  txt(ctx, S.weightsRow, x0 - 6, WT.weightY + WT.stripH / 2, { font: small(colors), fill: colors.ink2, align: "right", baseline: "middle" });
  for (const y of [WT.scoreY, WT.weightY]) { ctx.fillStyle = colors.surface2; ctx.fillRect(x0, y, x1 - x0, WT.stripH); }
  if (g) {
    const qx = g.first ? cx(g.to) : lerp(cx(g.from), cx(g.to), g.e), qyy = g.first ? qy(g.to) : lerp(qy(g.from), qy(g.to), g.e);
    ctx.save(); ctx.font = mono(colors);
    const tw = (i) => ctx.measureText(toks[i]).width + 10;
    const rx = (g.first ? tw(g.to) : lerp(tw(g.from), tw(g.to), g.e)) / 2;
    ctx.restore();
    ctx.save(); ctx.globalAlpha = g.first ? g.e : 1; ctx.strokeStyle = colors.groupA; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.ellipse(qx, qyy, rx, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    line(ctx, qx, qyy + 12, qx, 52, colors.ink2, 1.2);
    line(ctx, cx(0), 52, cx(K - 1), 52, colors.ink2, 1.2);
    for (let j = 0; j < K; j++) arrow(ctx, cx(j), 52, cx(j), arrowEnd, colors.ink2);
    /* on the glide the last query's rows fade out; then this query's scores print key by key */
    const out = g.first ? 0 : 1 - ph.e;
    for (let j = 0; j < K; j++) {
      const room = cols[j][1] - 4, ty = WT.scoreY + WT.stripH / 2, cut = masked && j >= L;
      const scoreOf = (row) => scoreText(ctx, colors, Sc[row][j], room);
      if (out > 0) txt(ctx, cut ? "−∞" : scoreOf(g.from), cx(j), ty, { font: mono(colors), fill: cut ? colors.extreme : colors.ink1, align: "center", baseline: "middle", alpha: out });
      const on = ph.k < 0 ? 0 : j < ph.k ? 1 : j === ph.k ? beat(ph.u, 0, 0.4) : 0;
      /* a masked key's score prints like any other, then the mask beat turns it to −∞ */
      txt(ctx, scoreOf(g.to), cx(j), ty, { font: mono(colors), fill: colors.ink1, align: "center", baseline: "middle", alpha: on * (cut ? 1 - ph.cut : 1) });
      if (cut) txt(ctx, "−∞", cx(j), ty, { font: mono(colors), fill: colors.extreme, align: "center", baseline: "middle", alpha: on * ph.cut });
      /* the weights: the last query's fading out, this query's arriving with the softmax */
      for (const [row, a] of [[g.from, out], [g.to, ph.soft]]) {
        if (row === null || a <= 0) continue;
        const fill = weightFill(colors, A[row][j]);
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = css(fill); ctx.fillRect(cols[j][0], WT.weightY, cols[j][1], WT.stripH); ctx.restore();
        txt(ctx, digits(ctx, colors, A[row][j], room), cx(j), WT.weightY + WT.stripH / 2, { font: mono(colors), fill: inkOn(colors, fill), align: "center", baseline: "middle", alpha: a });
      }
    }
  }
  for (const y of [WT.scoreY, WT.weightY]) {
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, WT.stripH - 1);
    for (let j = 1; j < K; j++) line(ctx, cols[j][0] + 0.5, y, cols[j][0] + 0.5, y + WT.stripH, colors.grid, 1);
  }
  /* the key being scored: one outline stepping along the scores */
  if (g && ph.k >= 0 && ph.k < K) {
    const m = ph.k === 0 ? 1 : beat(ph.u, 0, 0.3), from = cols[Math.max(0, ph.k - 1)], to = cols[ph.k];
    ctx.strokeStyle = colors.groupA; ctx.lineWidth = 2; ctx.strokeRect(lerp(from[0], to[0], m) - 1, WT.scoreY - 1, lerp(from[1], to[1], m) + 2, WT.stripH + 2); ctx.lineWidth = 1;
  }
  txt(ctx, S.softmaxArrow(raw, masked), x0, WT.softY, { font: small(colors), fill: g && (ph.soft > 0 || ph.cut > 0) ? colors.ink1 : colors.ink3, baseline: "middle" });
  txt(ctx, qi >= 0 ? S.rowCap(toks[qi], h + 1, raw) : S.rowWait, x0, WT.capY, { font: small(colors), fill: colors.ink3 });
  if (qi >= 0) arrow(ctx, w / 2, WT.capY + 8, w / 2, WT.arrowTo, colors.ink3);
  /* the matrix, his figure's lower half: rows the sentence's tokens, columns every key, [PAD] hatched */
  const cs = weightsCs(w, K), lw = labelWidth(ctx, colors, toks.slice(0, L));
  const mx = Math.round(Math.max(PAD_L + lw + 8, w / 2 - (K * cs) / 2 + 40));
  /* the matrix's name beside it, or under it where the matrix is wide enough to reach it */
  ctx.save(); ctx.font = cap(colors); const capW = ctx.measureText(S.weightsCap).width; ctx.restore();
  const beside = PAD_L + capW + 8 <= mx - lw - 6;
  txt(ctx, S.weightsCap, PAD_L, beside ? WT.matTop + (L * cs) / 2 : WT.matTop + L * cs + 16, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  matrix(ctx, colors, A.slice(0, L), toks, mx, WT.matTop, cs, anim, { ge: ph.e, fresh: ph.soft, padFrom: L });
  txt(ctx, "i", mx + K * cs + 12, WT.matTop + (L * cs) / 2, { font: small(colors), fill: colors.ink2, baseline: "middle" });
  txt(ctx, "j", mx + (K * cs) / 2, WT.matTop + L * cs + 16, { font: small(colors), fill: colors.ink2, align: "center" });
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
/* ONE SECTION (it was two, his ask and pick, 2026-09-26, `_lab/attention-two-sections-mock.html`:
   1 · Values, x̃ⱼ → W_V → vⱼ, above 2 · Output). The values section moved to the
   Projections step the same day, his call, where v is drawn beside q and k from the one
   X. What stays: zᵢ = Σⱼ αᵢⱼ vⱼ, the query's attention weights mixing the values across
   tokens, read down the column into the sum; the press animates it. The α matrix stands
   beside it where the strips keep at least 9 px a value cell and drops below that (his
   call: keep it where there is room); the Weights column carries the query's row of α
   either way. */
const OT = { rh: 24, cs: 12, lane: 22, head: 16, top: 62, matDrop: 62 };
const OX = { vcMin: 9, vcMax: 14 };
const heightOutput = (L) => OT.top + L * OT.rh + 124;
/** (α matrix) · weights · key · vⱼ · zⱼ */
function s2Layout(w, L, lw, withMatrix) {
  const mx = PAD_L + lw + 6;
  const wx = withMatrix ? mx + L * OT.cs + 18 : PAD_L, kx = wx + 42, vx = kx + lw + 16;
  const vc = Math.min(OX.vcMax, Math.floor((w - PAD_R - vx - OT.lane) / (2 * M.DK)));
  return { withMatrix, mx, wx, kx, vx, vc, zx: vx + M.DK * vc + OT.lane, fits: vc >= OX.vcMin };
}
function sectionHead(ctx, colors, y, [title, formula, note]) {
  txt(ctx, title, PAD_L, y, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  ctx.save(); ctx.font = cap(colors); const tw = ctx.measureText(title).width; ctx.restore();
  txt(ctx, formula, PAD_L + tw + 14, y, { font: `italic ${colors.fsSm} ${colors.font}`, fill: colors.ink1, baseline: "middle" });
  ctx.save(); ctx.font = `italic ${colors.fsSm} ${colors.font}`; const fw = ctx.measureText(formula).width; ctx.restore();
  txt(ctx, note, PAD_L + tw + 14 + fw + 14, y, { font: small(colors), fill: colors.ink3, baseline: "middle" });
}

function drawOutput(ctx, colors, w, params, state, anim) {
  const toks = state.tokens, L = state.L, h = Number(params.head) - 1, hd = state.run.heads[h], qi = queryOf(anim);
  const ph = outPhase(anim, L), g = qi >= 0 ? glide(anim, ph.e) : null;
  const lw = labelWidth(ctx, colors, toks);
  const vmax = Math.max(...hd.v.flat().map(Math.abs), ...hd.z.flat().map(Math.abs));
  const blank = rgb(colors.surface2);
  const valueStrip = (x, y, vals, vc, stroke = colors.ink2, lwid = 1) => {
    for (let d = 0; d < M.DK; d++) { ctx.fillStyle = css(signedFill(colors, vals[d], vmax)); ctx.fillRect(x + d * vc, y, vc - 1, OT.rh - 5); }
    ctx.strokeStyle = stroke; ctx.lineWidth = lwid; ctx.strokeRect(x - 0.5, y - 0.5, M.DK * vc, OT.rh - 4); ctx.lineWidth = 1;
  };

  /* ---- down the column into the sum, one query a press */
  const top = OT.top, headY = OT.head;
  sectionHead(ctx, colors, headY, S.outS2);
  let lay = s2Layout(w, L, lw, true);
  if (!lay.fits) lay = s2Layout(w, L, lw, false);
  const { wx, kx, vx, vc, zx } = lay, right = vx + M.DK * vc;
  if (lay.withMatrix) {
    txt(ctx, S.weightsCap, PAD_L, headY + 22, { font: small(colors), fill: colors.ink2, baseline: "middle" });
    matrix(ctx, colors, hd.alpha, toks, lay.mx, top + OT.matDrop, OT.cs, anim, { ge: ph.e });
  }
  txt(ctx, S.outW, wx, top - 26, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  txt(ctx, S.outV, vx, top - 26, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  /* the column header pulled in from the canvas edge where the strips are narrower than it */
  ctx.save(); ctx.font = cap(colors); const zhw = Math.max(ctx.measureText(S.outZcol[0]).width, ctx.measureText(S.outZcol[1]).width); ctx.restore();
  const zhx = Math.min(zx, w - PAD_R - zhw);
  txt(ctx, S.outZcol[0], zhx, top - 26, { font: cap(colors), fill: colors.ink1, baseline: "middle" });
  txt(ctx, S.outZcol[1], zhx, top - 12, { font: small(colors), fill: colors.ink2, baseline: "middle" });
  for (let j = 0; j < L; j++) {
    const y = top + j * OT.rh, ty = y + (OT.rh - 5) / 2;
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
    valueStrip(vx, y, hd.v[j], vc);
    /* zⱼ beside vⱼ: token j's features after attention, once its own query is done */
    const za = j < qi ? 1 : j === qi ? ph.drop : 0;
    for (let d = 0; d < M.DK; d++) {
      ctx.fillStyle = colors.surface2; ctx.fillRect(zx + d * vc, y, vc - 1, OT.rh - 5);
      if (za > 0) { ctx.save(); ctx.globalAlpha = za; ctx.fillStyle = css(signedFill(colors, hd.z[j][d], vmax)); ctx.fillRect(zx + d * vc, y, vc - 1, OT.rh - 5); ctx.restore(); }
    }
    ctx.lineWidth = 1; ctx.strokeStyle = j === qi ? colors.groupA : colors.ink2; ctx.strokeRect(zx - 0.5, y - 0.5, M.DK * vc, OT.rh - 4);
  }
  const yb = top + L * OT.rh + 2;
  /* the bracket over the values, the terms of the sum */
  line(ctx, vx, yb, vx, yb + 8, colors.ink2); line(ctx, vx, yb + 8, right, yb + 8, colors.ink2); line(ctx, right, yb, right, yb + 8, colors.ink2);
  /* the key being added: one outline stepping row to row, and a line down the lane
     right of the strips carrying it to the sum */
  if (g && ph.e >= 1 && ph.k < L) {
    const at = ph.k === 0 ? 0 : ph.k - 1 + moveOf(ph.u), y = top + at * OT.rh;
    ctx.strokeStyle = colors.groupA; ctx.lineWidth = 2; ctx.strokeRect(vx - 1.5, y - 1.5, M.DK * vc + 2, OT.rh - 2); ctx.lineWidth = 1;
    const y0 = y + (OT.rh - 5) / 2;
    line(ctx, right + 1, y0, right + 8, y0, colors.groupA, 1.5);
    arrow(ctx, right + 8, y0, right + 8, yb + 6, colors.groupA);
  }
  txt(ctx, S.outSum, (vx + right) / 2, yb + 26, { font: cap(colors), fill: colors.ink1, align: "center" });
  arrow(ctx, (vx + right) / 2, yb + 32, (vx + right) / 2, yb + 50, colors.ink2);
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

/* HIS FIGURE WITH THE NUMBERS (his pick A, 2026-09-26, `_lab/attention-heads-mock.html`),
   bottom to top: x̃ into the four heads' α matrices; each head's output Zₕ = Aₕ Vₕ; the
   four side by side; × W_Oᵀ + b; the feed-forward, dimmed (the block's other half is the
   next widget's). EVERY ONE AT ITS REAL SIZE, [L × 12], [L × 48], [L × 48], blank until
   its row is computed: the first build drew one query's row of each as a strip, and he
   asked "is it done one by one? or are head1-4 actually matrices?" (2026-09-26). They
   are matrices, computed in one pass; the rows do not depend on each other, so a press
   filling the query's row in all of them gives the same numbers and shows the shapes
   (`_lab/attention-heads-matrix-mock.html`, his pick A stacked over B side by side).
   A press is four beats: the row glides into all four α, the four Zₕ rows fill, the same
   row of the concatenation, then of the output (his pick: in beats, not all at once).
   Each head wears one dimension hue on its frames (the head is a dimension of
   [L, 4, 12]; his pick), the cells keep the value ramp, no text is coloured by it. */
const HP = { step: 1200, run: 600 };
/** the beats of a Heads press: glide `e`, the Zₕ rows `zf`, the concatenation's row `cat`, the output's `out` */
function headsPhase(anim) {
  if (anim.n === 0) return { e: 0, zf: 0, cat: 0, out: 0 };
  const u = anim.t;
  return { e: beat(u, 0, 0.35), zf: beat(u, 0.35, 0.55), cat: beat(u, 0.55, 0.75), out: beat(u, 0.75, 1) };
}
/* every y from the row height: a matrix of L rows takes L × rh */
const HD = { ff: 8, bh: 26, rh: 12, outY: 64 };
function headsY(L) {
  const cat = HD.outY + L * HD.rh + 40, z = cat + L * HD.rh + 56, dim = z + L * HD.rh + 12;
  return { cat, z, dim, title: dim + 18, habit: dim + 32, matTop: dim + 46 };
}
const headsCs = (w, L) => Math.max(6, Math.min(14, Math.floor(((w - PAD_L - PAD_R) / 4 - 16) / L)));
const heightHeads = (w, L) => headsY(L).matTop + L * headsCs(w, L) + 88;

/** a matrix of values at its real size: rows before the query full, the query's row at
    `fresh`, the rest blank; the query's row outlined, gliding with `ge` as in matrix() */
function valueGrid(ctx, colors, A, x0, y0, cw, ch, anim, { fresh, ge, frame, scale, toks = null, outline = true }) {
  const R = A.length, K = A[0].length, qi = queryOf(anim), gap = cw > 4 ? 1 : 0;
  for (let i = 0; i < R; i++) {
    if (toks) txt(ctx, toks[i], x0 - 7, y0 + i * ch + ch / 2, { font: mono(colors), fill: i === qi ? colors.groupA : colors.ink2, align: "right", baseline: "middle" });
    const a = rowAlpha(anim, i, fresh);
    for (let j = 0; j < K; j++) {
      const x = x0 + j * cw, y = y0 + i * ch;
      ctx.fillStyle = colors.surface2; ctx.fillRect(x, y, cw - gap, ch - 1);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = css(signedFill(colors, A[i][j], scale)); ctx.fillRect(x, y, cw - gap, ch - 1); ctx.restore(); }
    }
  }
  ctx.strokeStyle = frame; ctx.lineWidth = 1.5; ctx.strokeRect(x0 - 1, y0 - 1, K * cw + 1, R * ch + 1); ctx.lineWidth = 1;
  if (outline) queryOutline(ctx, colors, x0, y0, K * cw, ch, anim, ge);
}
function queryOutline(ctx, colors, x0, y0, wid, ch, anim, ge) {
  if (queryOf(anim) < 0) return;
  const g = glide(anim, ge);
  ctx.save(); ctx.globalAlpha = g.first ? g.e : 1; ctx.strokeStyle = colors.groupA; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
  ctx.strokeRect(x0 - 2.5, y0 + g.pos * ch - 2, wid + 4, ch + 3); ctx.restore();
}

function drawHeads(ctx, colors, w, params, state, anim) {
  const L = state.L, cs = headsCs(w, L), colW = (w - PAD_L - PAD_R) / 4, mid = w / 2, Y = headsY(L), rh = HD.rh;
  const hx = (k) => PAD_L + k * colW + colW / 2, ph = headsPhase(anim), run = state.run;
  const zmax = Math.max(...run.heads.flatMap((hd) => hd.z.flat()).map(Math.abs)), omax = Math.max(...run.out.flat().map(Math.abs));
  const zc = Math.max(4, Math.min(8, Math.floor((colW - 14) / M.DK))), cc = Math.max(3, Math.min(5, Math.floor((w * 0.5) / 48)));
  const cx0 = Math.round(mid - (48 * cc) / 2), right = cx0 + 48 * cc + 10;

  /* the feed-forward, then W_O's output [L × 48] */
  box(ctx, colors, mid - 80, HD.ff, 160, HD.bh, S.headsFf, { alpha: 0.45 });
  arrow(ctx, mid, HD.outY - 6, mid, HD.ff + HD.bh + 2, colors.ink3);
  valueGrid(ctx, colors, run.out, cx0, HD.outY, cc, rh, anim, { fresh: ph.out, ge: ph.e, frame: colors.ink1, scale: omax, toks: state.tokens });
  txt(ctx, S.headsOut(L), right, HD.outY + (L * rh) / 2, { font: small(colors), fill: colors.ink1, baseline: "middle" });
  arrow(ctx, mid, Y.cat - 5, mid, HD.outY + L * rh + 5, colors.ink3);
  txt(ctx, S.headsWo, mid + 10, (Y.cat + HD.outY + L * rh) / 2, { font: small(colors), fill: colors.ink2, baseline: "middle" });
  /* the four Zₕ side by side [L × 48], each 12 columns in its head's hue */
  run.heads.forEach((hd, k) => valueGrid(ctx, colors, hd.z, cx0 + k * M.DK * cc, Y.cat, cc, rh, anim,
    { fresh: ph.cat, ge: ph.e, frame: colors.dims[k], scale: zmax, toks: k === 0 ? state.tokens : null, outline: false }));
  queryOutline(ctx, colors, cx0, Y.cat, 48 * cc, rh, anim, ph.e);
  txt(ctx, S.headsCat(L), right, Y.cat + (L * rh) / 2, { font: small(colors), fill: colors.ink1, baseline: "middle" });
  /* each head: Zₕ [L × 12], its size, its title and habit, its α matrix, the bus from x̃ below */
  const matBottom = Y.matTop + L * cs;
  run.heads.forEach((hd, k) => {
    arrow(ctx, hx(k), Y.z - 5, cx0 + k * M.DK * cc + (M.DK * cc) / 2, Y.cat + L * rh + 5, colors.ink3);
    valueGrid(ctx, colors, hd.z, Math.round(hx(k) - (M.DK * zc) / 2), Y.z, zc, rh, anim, { fresh: ph.zf, ge: ph.e, frame: colors.dims[k], scale: zmax });
    txt(ctx, S.headsZ(L), hx(k), Y.dim, { font: small(colors), fill: colors.ink2, align: "center", baseline: "middle" });
    txt(ctx, `${S.headLabel} ${k + 1}`, hx(k), Y.title, { font: cap(colors), fill: colors.ink1, align: "center" });
    txt(ctx, `${M.HABIT[k].what} ${M.HABIT[k].share.toFixed(2)}`, hx(k), Y.habit, { font: small(colors), fill: colors.ink2, align: "center" });
    matrix(ctx, colors, hd.alpha, state.tokens, Math.round(hx(k) - (L * cs) / 2), Y.matTop, cs, anim,
      { colLabels: false, rowLabels: false, ge: ph.e, frame: colors.dims[k] });
    arrow(ctx, hx(k), matBottom + 26, hx(k), matBottom + 6, colors.ink3);
  });
  const xb = matBottom + 26;
  line(ctx, hx(0), xb, hx(3), xb, colors.ink3, 1.2);
  line(ctx, mid, xb, mid, xb + 10, colors.ink3, 1.2);
  box(ctx, colors, mid - 70, xb + 10, 140, HD.bh, S.headsX(L));
  txt(ctx, S.headsNote, PAD_L, xb + HD.bh + 30, { font: small(colors), fill: colors.ink3 });
}

/* ============================================================ the widget */

const heightOf = ({ page, sentence, w }) => {
  const L = M.tokensOf(sentence).length;
  return page === "projections" ? heightProjections(w, L) : page === "output" ? heightOutput(L) : page === "heads" ? heightHeads(w, L)
    : heightWeights(w, L, L + M.NPAD);
};

defineWidget({
  slug: "attention",
  status: "draft",
  title: S.title,
  subtitle: S.subtitle,
  layout: "side",
  height: heightOf,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "projections", display: true },
    sentence: {
      type: "select", label: S.sentenceLabel, detail: S.sentenceDetail,
      options: Object.entries(M.SENTENCES).map(([value, label]) => ({ value, label })), default: "aspirin",
    },
    head: {
      type: "segmented", label: S.headLabel, detail: S.headDetail,
      options: ["1", "2", "3", "4"].map((v) => ({ value: v, label: v })), default: "4", display: true,
      when: { any: [ON("projections"), ON("weights"), ON("output")] },
    },
    scores: { type: "segmented", label: S.scoreLabel, detail: S.scoreDetail, options: S.scoreOpts, default: "scaled", display: true, when: ON("weights") },
    attention_mask: { type: "segmented", label: S.maskLabel, detail: S.maskDetail, options: S.maskOpts, default: "passed", display: true, when: ON("weights") },
    /* authoring escape hatch, first render only: rows already computed */
    shown: { type: "int", min: 0, max: 16, default: 0, hidden: true },
  },

  legend: [],

  compute: ({ params }) => M.stage(params.sentence),

  animation: {
    /* a Projections press computes a token's q, k and v, not a query's row of weights */
    stepLabel: { param: "page", labels: { projections: S.stepLabelTok }, default: S.stepLabel },
    stepTitle: { param: "page", labels: { projections: S.stepTitleTok }, default: S.stepTitle },
    runLabel: S.runLabel,
    runTitle: S.runTitle,
    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.max(0, Math.min(state.L, Number(params.shown) || 0));
      return { n, t: 1, done: n >= state.L };
    },
    advance: (anim, { dt, params, state }) => {
      /* the Output page's press takes its keys one at a time, so it runs longer */
      const ms = params.page === "projections" ? projMs(anim.mode) : params.page === "output" ? outMs(state.L, anim.mode) : params.page === "weights" ? weightsMs(state.padded.tokens.length, anim.mode, params.attention_mask !== "not-passed")
        : anim.mode === "run" ? HP.run : HP.step;
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
    if (params.page === "projections") drawProjections(ctx, colors, w, params, state, anim);
    else if (params.page === "output") drawOutput(ctx, colors, w, params, state, anim);
    else if (params.page === "heads") drawHeads(ctx, colors, w, params, state, anim);
    else drawWeights(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    const qi = queryOf(anim), h = Number(params.head) - 1, L = state.L;
    const pct = (v) => `${Math.round(100 * v)}%`;
    if (params.page === "projections") {
      const m = qi >= 0 ? projPhase(anim).m : -1;
      return [
        { label: S.tileTok, value: qi >= 0 ? state.tokens[qi] : S.wait, note: S.tileTokNote },
        { label: S.tileCol, value: m >= 0 ? `${m + 1} of ${M.DK}` : S.wait, note: S.tileColNote },
        { label: S.tileRows, value: `${anim.n} of ${L}`, note: S.tileRowsTokNote },
      ];
    }
    if (params.page === "heads") {
      return [
        { label: S.tileQuery, value: qi >= 0 ? state.tokens[qi] : S.wait, note: S.tileQueryNote },
        { label: S.tileHeads, value: "4 × 12", note: S.tileHeadsNote },
        { label: S.tileRows, value: `${anim.n} of ${L}`, note: S.tileRowsNote },
      ];
    }
    const view = params.page === "weights" ? weightsView(state, params) : null;
    const A = view ? view.A : state.run.heads[h].alpha;
    /* on the Weights page the row is a weight only once the softmax has run */
    const ready = qi >= 0 && (!view || weightsPhase(anim, view.K, view.masked).soft >= 0.5);
    const row = ready ? A[qi] : null, top = row ? row.indexOf(Math.max(...row)) : -1;
    const first = { label: S.tileQuery, value: qi >= 0 ? state.tokens[qi] : S.wait, note: S.tileQueryNote };
    const keyName = (j) => (view ? view.toks[j] : state.tokens[j]);
    const second = { label: S.tileTop, value: row ? `${keyName(top)} ${row[top].toFixed(2)}` : S.wait, note: S.tileTopNote };
    if (params.page === "output") {
      const ph = outPhase(anim, L), hd = state.run.heads[h];
      const k = qi < 0 || ph.e < 1 ? 0 : Math.min(L, ph.k + (ph.u >= SUM_AT ? 1 : 0));
      return [first,
        { label: S.tileAdded, value: qi >= 0 ? `${k} of ${L}` : S.wait, note: S.tileAddedNote },
        { label: S.tileShare, value: qi >= 0 ? `${Math.round(100 * weightSoFar(hd, qi, k))}%` : S.wait, note: S.tileShareNote }];
    }
    return [first, second, { label: S.tilePad, value: row ? pct(M.tailShare(row, L)) : S.wait, note: S.tilePadNote(view.masked) }];
  },

  summary({ params, state, anim }) {
    return S.sum(PAGES.find((p) => p.value === params.page).label, anim.n, state.L);
  },
});
