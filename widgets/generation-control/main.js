/* ============================================================================
   Widget 109 · Controlling Generation (`generation-control`) — PHM5005 10:
   how a decoder's next token is drawn, and how a token at the front of the
   sequence conditions every token after it.

   The idea (catalogue § Slot 109, PROPOSED 2026-10-20; HANDOVER § The
   transformer in 10-3b): 84 generates greedily and conditions by
   cross-attention; neither the decoding rule nor a condition token in the
   same stream is in any widget. Built on 84's clinical notes rather than on
   generated biological sequences: a reader can read a note and judge whether
   a rule or a prefix changed it, and the mechanism is the same whatever the
   alphabet.

   MEASURED 2026-10-20 (`_lab/gen109-mock.html`, `_lab/generation-control-
   measure.json`): mid-clause the model is certain (after "treated with aspirin
   for", chest 0.997), so every rule writes the same word there; the choice is
   at the note's opening (entropy 1.94 nats, 9 of 58 tokens live), which is
   where the page starts every note. From [BOS], 1,000 notes an arm: greedy 1
   distinct note; top-k 7 · 24 · 57 · 77 at k = 2 · 3 · 4 · 5; temperature
   99% of notes in the grammar at T = 1, 86% at 1.6, 60% at 2. The condition
   model: [TREAT] 99.9% of notes start treated/managed, [NEG] 99.9% start no,
   no prefix 50.5% · 49.3%. Its loss is on the note's tokens only: trained to
   predict the condition token too, it wrote one itself after a bare [BOS].

   HIS CALLS (2026-10-20, all five the recommendation): 1A the three rules,
   top-k at small k; 2A the entropy under each token leads; 3A [TREAT] · [NEG];
   4A the dropped prefix shown (No prefix, and the no-prefix outline); 5A one
   widget, two pages. Drafted with: ten notes (the frame), the same u's under
   every arm (each row of the table one set of draws), no separate three-prefix
   panel (the outline carries it). Default seed 10 (12 distinct notes at
   T = 1 of 12, 6 · 6 with no prefix, 3 outside the grammar at T = 1.6, in the
   40-seed sweep at twelve notes; re-measured at ten in the verify).

   compute() draws the u's, one for each token of each note, and nothing else:
   the rules and the prefixes are display parameters, and a note is a pure
   function of its u's, the model and the arm (model.js, memoised). Each arm
   keeps its own place (note i, j tokens drawn): a press draws one token of the
   CHOSEN arm's note, and only that arm's column of the table fills. His
   question after the first draft (2026-10-20, "whether i choose the prefix,
   the list generates all versions? the button has no influence?"): the table
   had filled all three columns whichever arm was chosen; his pick A, on both
   pages. Row n still uses the same u's in every column.
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

const N = 10;                      // notes a seed
const RUN_MS = 110;                // Generate: one token every RUN_MS
const ROWS = 6;                    // the distribution panel's rows before "others"

const PAGES = [{ value: "sampling", label: "Sampling" }, { value: "conditioning", label: "Conditioning" }];
const RULES = [{ value: "greedy", label: "Greedy" }, { value: "temperature", label: "Temperature" }, { value: "topk", label: "Top-k" }];
const TS = ["0.5", "0.7", "1", "1.3", "1.6", "2"];
const KS = ["2", "3", "4", "5"];
const PREFIXES = [{ value: "treat", label: "[TREAT]" }, { value: "neg", label: "[NEG]" }, { value: "none", label: "No prefix" }];
const ON = (page) => ({ param: "page", equals: page });

/* ------------------------------------------------------------- strings */

const f2 = (v) => v.toFixed(2);
const S = {
  subtitle:
    "A decoder generates text one token at a time: the model gives every token in its vocabulary a probability, one token is drawn, and it is added to the sequence the next token is predicted from. " +
    "Sampling: three rules for drawing the token. Conditioning: a token placed before the text that every later token is predicted from.",
  pageLabel: "Control",
  ruleLabel: "Decoding rule",
  ruleDetail: "how the token is chosen from the model's probabilities, and the column of the table Draw and Generate fill",
  tLabel: "Temperature T",
  tDetail: "the log probabilities are divided by T, then renormalised",
  kLabel: "k, for top-k",
  kDetail: "the number of most probable tokens kept",
  prefixLabel: "Prefix",
  prefixDetail: "the condition token placed after [BOS], and the column of the table Draw and Generate fill",
  seedLabel: "Seed",
  seedDetail: `the uniform numbers u, one for each token of the ${N} notes`,
  noteTitle: (i) => `Note ${i + 1}, one token at a time`,
  entNote: "under each token: the entropy of the model's probabilities for it (0 when one token has them all)",
  distFirst: "The probabilities token 1 will be drawn from",
  distAt: (j) => `The probabilities token ${j} was drawn from`,
  others: (n) => `${n} other tokens`,
  uLabel: "u",
  uVal: (u) => `u = ${f2(u)}`,
  tableTitle: { sampling: `${N} notes under each rule: row n uses the same u's in every column`, conditioning: `${N} notes under each prefix: row n uses the same u's in every column` },
  none: "no notes yet",
  armRule: { greedy: "Greedy", temperature: (T) => `Temperature, T = ${T}`, topk: (k) => `Top-k, k = ${k}` },
  armPrefix: { treat: "[TREAT]", neg: "[NEG]", none: "No prefix" },
  headSampling: (d, fw) => `${d} different, ${fw} first word${fw === 1 ? "" : "s"}`,
  headTreat: (n, c) => `${n} of ${c} start treated or managed`,
  headNeg: (n, c) => `${n} of ${c} start no`,
  headNone: (t, n) => `${t} start treated or managed, ${n} no`,
  dagger: "† not a note the training data's grammar can produce",
  legend: {
    model: "the model's probability",
    rule: "the probability under the decoding rule",
    drawn: "the token drawn",
    treat: "after [TREAT]",
    neg: "after [NEG]",
    none: "with no prefix",
  },
  tile: {
    note: "Note",
    noteNote: (j) => (j ? `${j} token${j === 1 ? "" : "s"} drawn` : "no token drawn yet"),
    diff: "Different notes",
    diffNote: "greedy · temperature · top-k",
    first: "Different first words",
    firstNote: "greedy · temperature · top-k",
    treat: "[TREAT]: start treated or managed",
    neg: "[NEG]: start no",
    none: "No prefix: treated or managed · no",
    ofDone: "of the notes generated",
  },
};

const CAP = {
  start: {
    sampling: "Before the first token. The bars are the probabilities the first token is drawn from; Draw picks one with a uniform number u in [0, 1).",
    conditioning: (pre) => (pre === "none"
      ? "Before the first token, with no prefix. The bars are the probabilities the first token is drawn from."
      : `Before the first token, with ${S.armPrefix[pre]} after [BOS]. The bars are the probabilities the first token is drawn from; the outlines are the same model's with no prefix.`),
  },
  rule: {
    greedy: (tok, p) => `Greedy takes the most probable token, ${tok} (${f2(p)}), and does not use u.`,
    temperature: (T, tok) => (T === "1" ? `Temperature 1 leaves the model's probabilities as they are. u falls in the interval of ${tok}.`
      : Number(T) < 1 ? `Temperature ${T}, below 1: the larger probabilities grow and the smaller shrink. u falls in the interval of ${tok}.`
        : `Temperature ${T}, above 1: the probabilities move toward each other. u falls in the interval of ${tok}.`),
    topk: (k, tok) => `Top-k keeps the ${k} most probable tokens and renormalises them; every other token gets 0. u falls in the interval of ${tok}.`,
  },
  cond: (pre, tok) => (pre === "none" ? `u falls in the interval of ${tok}.` : `u falls in the interval of ${tok}. The outlines are the same tokens with no prefix.`),
  ended: (i) => ` The model drew [EOS]: note ${i + 1} is complete.`,
  capped: (i) => ` Note ${i + 1} reached ${M.MAX_TOKENS} tokens without [EOS] and is stopped there.`,
  done: { sampling: ` All ${N} notes under this rule are complete.`, conditioning: ` All ${N} notes with this prefix are complete.` },
};

/* ------------------------------------------------------------- the arms and their notes */

const START = { treat: [M.BOS, M.ID["[TREAT]"]], neg: [M.BOS, M.ID["[NEG]"]], none: [M.BOS] };
/** the three columns of the table, the shown one marked */
function armsOf(params) {
  if (params.page === "conditioning")
    return PREFIXES.map(({ value }) => ({ key: value, which: "cond", start: START[value], rule: "temperature", opts: { T: 1 }, label: S.armPrefix[value], shown: value === params.prefix }));
  const T = params.T, k = params.k;
  return [
    { key: "greedy", which: "causal", start: [M.BOS], rule: "greedy", opts: {}, label: S.armRule.greedy },
    { key: "temperature", which: "causal", start: [M.BOS], rule: "temperature", opts: { T: Number(T) }, label: S.armRule.temperature(T) },
    { key: "topk", which: "causal", start: [M.BOS], rule: "topk", opts: { k: Number(k) }, label: S.armRule.topk(k) },
  ].map((a) => ({ ...a, shown: a.key === params.rule }));
}
const shownArm = (params) => armsOf(params).find((a) => a.shown);
/** the arm's N notes from the seed's u's: a pure function of the state and the arm, kept on the state */
function notesOf(state, arm) {
  const key = `${arm.which}|${arm.start}|${arm.rule}|${JSON.stringify(arm.opts)}`;
  let v = state.notes.get(key);
  if (!v) { v = state.U.map((u) => M.generate(arm.which, arm.start, u, arm.rule, arm.opts)); state.notes.set(key, v); }
  return v;
}

const ARM_KEYS = { sampling: RULES.map((r) => r.value), conditioning: PREFIXES.map((r) => r.value) };
/** every arm's place, at the start: note 1, nothing drawn */
const freshPlaces = () => Object.fromEntries(Object.entries(ARM_KEYS).map(([pg, ks]) => [pg, Object.fromEntries(ks.map((k) => [k, { i: 0, j: 0 }]))]));
/** an arm's place: note i, j tokens drawn in it (clamped to its note, which T or k can shorten); complete = its notes ended */
function placeOf(anim, params, state, arm = shownArm(params)) {
  const at = anim?.at?.[params.page]?.[arm.key] ?? { i: 0, j: 0 }, notes = notesOf(state, arm);
  const len = notes[at.i].steps.length, j = Math.min(at.j, len);
  return { i: at.i, j, len, note: notes[at.i], complete: at.i + (j >= len ? 1 : 0), done: at.i === N - 1 && j >= len };
}
/** what a halt is keyed to: the page and the arm chosen on it */
const stageOf = (params) => `${params.page}|${shownArm(params).key}`;
/** one press: the next token of the chosen arm's note, or the first of the next note */
function pressOnce(anim, params, state) {
  const pl = placeOf(anim, params, state), at = anim.at[params.page][shownArm(params).key];
  if (pl.done) return false;
  if (pl.j < pl.len) at.j = pl.j + 1;
  else { at.i = pl.i + 1; at.j = 1; }
  return true;
}

/* ------------------------------------------------------------- the card */

const MATHML = mathmlRenders();
const mi = (s) => `<mi>${s}</mi>`, mo = (s) => `<mo>${s}</mo>`, mn = (s) => `<mn>${s}</mn>`;
const sub = (b, s) => `<msub>${b}${s}</msub>`;
const xt = sub(mi("x"), mi("t")), xlt = sub(mi("x"), `<mrow>${mo("&lt;")}${mi("t")}</mrow>`);
const P = (arg) => `${mi("p")}${mo("(")}${arg}${mo(")")}`;
const given = (a, ...b) => `${a}${mo("|")}${b.join(mo(","))}`;
const prod = `<munderover>${mo("∏")}<mrow>${mi("t")}${mo("=")}${mn(1)}</mrow>${mi("n")}</munderover>`;
const seq = `${sub(mi("x"), mn(1))}${mo(",")}${mo("…")}${mo(",")}${sub(mi("x"), mi("n"))}`;
const pw = (x) => P(given(x, xlt));
/** a power of a whole p(…): msup takes ONE element as its base, so the call goes in an mrow */
const pow = (x, e) => `<msup><mrow>${pw(x)}</mrow><mrow>${e}</mrow></msup>`;
const sumUnder = (u) => `<munder>${mo("∑")}<mrow>${u}</mrow></munder>`;
const eq = (body) => `<math display="block"><mrow>${body}</mrow></math>`;
const EQ = {
  chain: { math: eq(`${P(seq)}${mo("=")}${prod}${pw(xt)}`), plain: "p(x₁, …, x_n) = ∏ₜ p(x_t | x_<t)" },
  greedy: { math: eq(`${xt}${mo("=")}<munder><mo>argmax</mo>${mi("w")}</munder>${pw(mi("w"))}`), plain: "x_t = argmax_w p(w | x_<t)" },
  temperature: {
    math: eq(`${sub(mi("p"), mi("T"))}${mo("(")}${given(mi("w"), xlt)}${mo(")")}${mo("=")}<mfrac><mrow>${pow(mi("w"), `${mn(1)}${mo("/")}${mi("T")}`)}</mrow><mrow>${sumUnder(mi("v"))}${pow(mi("v"), `${mn(1)}${mo("/")}${mi("T")}`)}</mrow></mfrac>`),
    plain: "p_T(w | x_<t) = p(w | x_<t)^(1/T) / Σ_v p(v | x_<t)^(1/T)",
  },
  topk: {
    math: eq(`${sub(mi("p"), mi("k"))}${mo("(")}${given(mi("w"), xlt)}${mo(")")}${mo("=")}<mfrac><mrow>${pw(mi("w"))}</mrow><mrow>${sumUnder(`${mi("v")}${mo("∈")}<mtext>top&#xA0;</mtext>${mi("k")}`)}${pw(mi("v"))}</mrow></mfrac><mtext>&#xA0;for&#xA0;</mtext>${mi("w")}<mtext>&#xA0;in the top&#xA0;</mtext>${mi("k")}${mo(";")}<mtext>&#xA0;0 otherwise</mtext>`),
    plain: "p_k(w | x_<t) = p(w | x_<t) / Σ_{v in top k} p(v | x_<t) for w in the top k; 0 otherwise",
  },
  cond: {
    math: eq(`${P(given(seq, mi("c")))}${mo("=")}${prod}${P(given(xt, mi("c"), xlt))}`),
    plain: "p(x₁, …, x_n | c) = ∏ₜ p(x_t | c, x_<t)",
  },
};
const LEAD = {
  chain: "Each token is drawn from the model's probabilities given the tokens before it:",
  greedy: "Greedy:",
  temperature: "Temperature:",
  topk: "Top-k:",
  cond: "With a condition token c after [BOS], every token is predicted given c:",
  none: "With no prefix, the same model:",
};
const NOTE = {
  sampling: `u is a uniform number in [0, 1), one for each token. The tokens' intervals are laid end to end, most probable first, each as long as its probability under the rule, and the token drawn is the one whose interval holds u. Each of the ${N} notes has its own u's, the same under every rule.`,
  conditioning: `One model gives all three. It was trained on treatment notes and negated-finding notes, with [TREAT] or [NEG] after [BOS] in 80% of them and no condition token in 20%; the loss is on the note's tokens only, since the condition token is given. Tokens are drawn at temperature 1, with the same u's under each prefix.`,
};
/** one equation and the line that leads into it (`lead` names a LEAD other than the equation's own) */
const mathOf = (k, lead = k) => `<div class="w-math-eq"><span style="color:var(--ink-2)">${LEAD[lead]}</span> ${MATHML ? EQ[k].math : EQ[k].plain}</div>`;

let mathHost = null, mathKey = null;
function renderCard(params) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = params.page === "sampling" ? `s|${params.rule}` : "c";
  if (mathKey === key) return;
  mathKey = key;
  mathHost.innerHTML = params.page === "sampling"
    ? `${mathOf("chain")}${mathOf(params.rule)}<div class="w-math-note">${NOTE.sampling}</div>`
    : `${mathOf("cond")}${mathOf("chain", "none")}<div class="w-math-note">${NOTE.conditioning}</div>`;
}

/* ------------------------------------------------------------- layout */

const PAD = 10, LINE = 13;
function layoutOf(w) {
  const L = PAD, R = w - PAD;
  const noteTitle = 14, noteY = 24, boxH = 22;
  const entBase = noteY + boxH + 6 + 12 + 30, entNote = entBase + 14;
  const distTitle = entNote + 26, rows0 = distTitle + 8, rowH = 17, nRows = ROWS + 3;     // ROWS, a gap, the drawn token, others
  const stripY = rows0 + nRows * rowH + 18, stripH = 12;
  const capTop = stripY + stripH + 34;
  const tableTitle = capTop + 3 * 16 + 8, head = tableTitle + 16, rowsTop = head + 30;
  const foot = rowsTop + N * 2 * LINE + 10;
  const gut = Math.min(130, Math.round(w * 0.24));
  return { L, R, w, noteTitle, noteY, boxH, entBase, entNote, distTitle, rows0, rowH, stripY, stripH, capTop, tableTitle, head, rowsTop, foot, gut, height: foot + 8 };
}

/* ------------------------------------------------------------- drawing helpers */

function txt(ctx, colors, s, x, y, { size = colors.fsXs, fill = colors.ink2, align = "left", weight = "", font = colors.font } = {}) {
  ctx.save(); ctx.font = `${weight ? weight + " " : ""}${size} ${font}`; ctx.textAlign = align;
  ctx.fillStyle = fill; ctx.fillText(s, x, y); ctx.restore();
}
function textW(ctx, s, font) { ctx.save(); ctx.font = font; const v = ctx.measureText(s).width; ctx.restore(); return v; }
function line(ctx, x1, y1, x2, y2, col, w = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function wrapLines(ctx, s, font, maxW) {
  const out = []; let cur = "";
  for (const word of s.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && textW(ctx, t, font) > maxW) { out.push(cur); cur = word; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/* the colour each arm's marks take: on Sampling the rule's bars are --c-empirical; on Conditioning each prefix has its own */
const hueOf = (colors, params) => (params.page === "sampling" ? colors.empirical : { treat: colors.groupA, neg: colors.groupB, none: colors.reference }[params.prefix]);

/* ------------------------------------------------------------- the note, and the entropy under each token */

function drawNote(ctx, colors, Lo, params, pl) {
  const { L, R, noteY, boxH, entBase } = Lo, arm = shownArm(params), V = M.VOCAB[arm.which];
  txt(ctx, colors, S.noteTitle(pl.i), L, Lo.noteTitle, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  const shown = pl.note.steps.slice(0, pl.j);
  const boxes = [...arm.start.map((id) => ({ t: V[id], pre: id !== M.BOS })), ...shown.map((st) => ({ t: V[st.tok], st }))];
  if (pl.j < pl.len) boxes.push({ t: "?", next: true });
  /* the font that fits the row: 11px down to 8px, the boxes' padding with it */
  let size = 11, gap = 4, padX = 5, wsum;
  for (; size >= 8; size--) {
    const font = `${size}px ${colors.mono}`;
    wsum = boxes.reduce((s, b) => s + textW(ctx, b.t, font) + 2 * padX, 0) + gap * (boxes.length - 1);
    if (wsum <= R - L) break;
    padX = Math.max(3, padX - 1); gap = Math.max(2, gap - 1);
  }
  const font = `${size}px ${colors.mono}`;
  let x = L;
  const HMAX = 2.5, BAR = 30;
  line(ctx, L, entBase + 0.5, R, entBase + 0.5, colors.grid);
  boxes.forEach((b, n) => {
    const bw = textW(ctx, b.t, font) + 2 * padX, last = b.st && n === boxes.length - 1 - (boxes.at(-1).next ? 1 : 0);
    ctx.save();
    if (b.next) { ctx.setLineDash([3, 3]); ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, noteY + 0.5, bw - 1, boxH - 1); }
    else {
      ctx.fillStyle = colors.surface2; ctx.fillRect(x, noteY, bw, boxH);
      ctx.strokeStyle = b.pre ? hueOf(colors, params) : last ? colors.highlight : colors.grid;
      ctx.lineWidth = b.pre || last ? 2 : 1;
      ctx.strokeRect(x + 0.5, noteY + 0.5, bw - 1, boxH - 1);
    }
    ctx.restore();
    txt(ctx, colors, b.t, x + bw / 2, noteY + 15, { font: colors.mono, size: `${size}px`, align: "center", fill: b.next ? colors.ink3 : b.pre ? hueOf(colors, params) : colors.ink1, weight: last ? "600" : "" });
    if (b.st) {
      const H = M.entropy(b.st.p), h = Math.max(1, (Math.min(H, HMAX) / HMAX) * BAR), bwid = Math.min(24, bw - 6);
      ctx.save(); ctx.fillStyle = params.page === "sampling" ? colors.reference : hueOf(colors, params); ctx.fillRect(x + (bw - bwid) / 2, entBase - h, bwid, h); ctx.restore();
      txt(ctx, colors, f2(H), x + bw / 2, entBase - h - 3, { align: "center", fill: colors.ink2 });
    }
    x += bw + gap;
  });
  txt(ctx, colors, S.entNote, L, Lo.entNote, { fill: colors.ink3 });
}

/* ------------------------------------------------------------- the draw */

function drawDist(ctx, colors, Lo, params, pl) {
  const { L, R, gut, rows0, rowH, stripY, stripH } = Lo, arm = shownArm(params), V = M.VOCAB[arm.which];
  const st = pl.j > 0 ? pl.note.steps[pl.j - 1] : pl.note.steps[0], drawn = pl.j > 0 ? st.tok : null;
  txt(ctx, colors, pl.j > 0 ? S.distAt(pl.j) : S.distFirst, L, Lo.distTitle, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  const p = st.p, q = st.q, order = M.orderOf(p), hue = hueOf(colors, params);
  /* the outline: on Sampling the model's own probabilities; on Conditioning the same tokens with no prefix */
  const out = params.page === "sampling" ? (params.rule === "temperature" && params.T === "1" ? null : p)
    : params.prefix === "none" ? null : M.nextProbs("cond", [M.BOS, ...st.ctx.slice(2)]);
  const x0 = L + gut + 8, x1 = R - 92, bx = (v) => x0 + v * (x1 - x0);
  const rows = order.slice(0, ROWS).map((id) => ({ id }));
  const rank = drawn === null ? -1 : order.indexOf(drawn);
  if (rank >= ROWS) rows.push({ gap: true }, { id: drawn });
  const listed = new Set(rows.filter((r) => !r.gap).map((r) => r.id));
  const rest = order.filter((id) => !listed.has(id));
  rows.push({ rest, n: rest.length });
  rows.forEach((r, n) => {
    const y = rows0 + n * rowH, mid = y + rowH / 2;
    if (r.gap) { txt(ctx, colors, "⋮", L + gut, mid + 4, { align: "right", fill: colors.ink3 }); return; }
    const pv = r.rest ? r.rest.reduce((s, id) => s + (out ?? p)[id], 0) : (out ?? p)[r.id];
    const qv = r.rest ? r.rest.reduce((s, id) => s + q[id], 0) : q[r.id];
    const isDrawn = !r.rest && r.id === drawn;
    const label = r.rest ? S.others(r.n) : V[r.id];
    txt(ctx, colors, label, L + gut, mid + 4, { align: "right", font: r.rest ? colors.font : colors.mono, fill: isDrawn ? colors.ink1 : r.rest ? colors.ink3 : colors.ink2, weight: isDrawn ? "600" : "" });
    ctx.save(); ctx.fillStyle = isDrawn ? colors.highlight : hue; ctx.fillRect(x0, y + 3, Math.max(qv > 0 ? 1 : 0, bx(qv) - x0), rowH - 6); ctx.restore();
    if (out) { ctx.save(); ctx.strokeStyle = colors.reference; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y + 2.5, Math.max(1, bx(pv) - x0), rowH - 5); ctx.restore(); }
    const nx = R;
    if (out) {
      txt(ctx, colors, f2(qv), nx, mid + 4, { align: "right", fill: isDrawn ? colors.ink1 : colors.ink2, weight: isDrawn ? "600" : "" });
      txt(ctx, colors, `${f2(pv)} →`, nx - 32, mid + 4, { align: "right", fill: colors.ink3 });
    } else txt(ctx, colors, f2(qv), nx, mid + 4, { align: "right", fill: isDrawn ? colors.ink1 : colors.ink2, weight: isDrawn ? "600" : "" });
  });
  /* the intervals, in the model's order, and u */
  txt(ctx, colors, S.uLabel, L + gut, stripY + stripH - 2, { align: "right", fill: colors.ink2, font: colors.mono, size: colors.fsSm });
  let c = 0;
  for (const id of order) {
    if (q[id] <= 0) continue;
    const a = bx(c), b = bx(c + q[id]);
    ctx.save(); ctx.fillStyle = id === drawn ? colors.highlight : hue; ctx.fillRect(a, stripY, Math.max(0.5, b - a), stripH); ctx.restore();
    if (c > 0) line(ctx, a, stripY, a, stripY + stripH, colors.surface, 1.5);
    c += q[id];
  }
  txt(ctx, colors, "0", x0, stripY + stripH + 13, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, "1", x1, stripY + stripH + 13, { align: "center", fill: colors.ink3 });
  if (drawn !== null) {
    const ux = bx(st.u);
    ctx.save(); ctx.fillStyle = colors.ink1; ctx.beginPath(); ctx.moveTo(ux, stripY - 1); ctx.lineTo(ux - 5, stripY - 8); ctx.lineTo(ux + 5, stripY - 8); ctx.closePath(); ctx.fill(); ctx.restore();
    line(ctx, ux, stripY, ux, stripY + stripH, colors.ink1, 1.5);
    txt(ctx, colors, S.uVal(st.u), Math.min(Math.max(ux, x0 + 24), x1 - 24), stripY + stripH + 13, { align: "center", fill: colors.ink1, weight: "600" });
  }
}

/* ------------------------------------------------------------- the caption */

function captionOf(params, pl) {
  const arm = shownArm(params), V = M.VOCAB[arm.which];
  if (pl.j === 0) return params.page === "sampling" ? CAP.start.sampling : CAP.start.conditioning(params.prefix);
  const st = pl.note.steps[pl.j - 1], tok = V[st.tok];
  let s = params.page === "sampling"
    ? params.rule === "greedy" ? CAP.rule.greedy(tok, st.p[st.tok]) : params.rule === "temperature" ? CAP.rule.temperature(params.T, tok) : CAP.rule.topk(params.k, tok)
    : CAP.cond(params.prefix, tok);
  if (pl.j >= pl.len) s += pl.note.ended ? CAP.ended(pl.i) : CAP.capped(pl.i);
  if (pl.done) s += CAP.done[params.page];
  return s;
}
function drawCaption(ctx, colors, Lo, s) {
  const font = `${colors.fsSm} ${colors.font}`;
  wrapLines(ctx, s, font, Lo.R - Lo.L).slice(0, 3).forEach((l, n) => txt(ctx, colors, l, Lo.L, Lo.capTop + n * 16, { size: colors.fsSm, fill: colors.ink1 }));
}

/* ------------------------------------------------------------- the table */

const kindOf = (note) => (["treated", "managed"].includes(note.words[0]) ? "treat" : note.words[0] === "no" ? "neg" : "other");
/** what each column's head says, over the notes complete */
function headOf(params, arm, notes) {
  if (params.page === "sampling") return S.headSampling(new Set(notes.map((n) => n.text)).size, new Set(notes.map((n) => n.words[0])).size);
  const k = notes.map(kindOf);
  if (arm.key === "treat") return S.headTreat(k.filter((v) => v === "treat").length, notes.length);
  if (arm.key === "neg") return S.headNeg(k.filter((v) => v === "neg").length, notes.length);
  return S.headNone(k.filter((v) => v === "treat").length, k.filter((v) => v === "neg").length);
}
function drawTable(ctx, colors, Lo, params, state, anim) {
  const { L, R, tableTitle, head, rowsTop, foot } = Lo, arms = armsOf(params), numW = 18, gapX = 10;
  const colW = (R - L - numW - 2 * gapX) / 3, cx = (c) => L + numW + c * (colW + gapX);
  txt(ctx, colors, S.tableTitle[params.page], L, tableTitle, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  const done = arms.map((a) => notesOf(state, a).slice(0, placeOf(anim, params, state, a).complete));
  const font = `${colors.fsXs} ${colors.font}`;
  let anyOut = false;
  arms.forEach((a, c) => {
    const col = params.page === "sampling" ? colors.ink1 : { treat: colors.groupA, neg: colors.groupB, none: colors.reference }[a.key];
    txt(ctx, colors, a.label, cx(c), head, { size: colors.fsSm, fill: col, weight: a.shown ? "700" : "" });
    if (a.shown) line(ctx, cx(c), head + 4, cx(c) + Math.min(colW, textW(ctx, a.label, `700 ${colors.fsSm} ${colors.font}`)), head + 4, colors.highlight, 2);
    txt(ctx, colors, done[c].length ? headOf(params, a, done[c]) : S.none, cx(c), head + 18, { fill: done[c].length ? colors.ink2 : colors.ink3 });
  });
  line(ctx, L, rowsTop - 8.5, R, rowsTop - 8.5, colors.grid);
  let y = rowsTop;
  const rowsN = Math.max(...done.map((ns) => ns.length));
  for (let i = 0; i < rowsN; i++) {
    const cells = done.map((ns) => {
      const n = ns[i];
      if (!n) return [];
      const out = !M.inGrammar(n.text) || !n.ended;
      if (out) anyOut = true;
      return wrapLines(ctx, (out ? "† " : "") + (n.text || "(empty)"), font, colW).slice(0, 2);
    });
    txt(ctx, colors, String(i + 1), L, y + 9, { fill: colors.ink3 });
    cells.forEach((ls, c) => ls.forEach((l, n) => txt(ctx, colors, l, cx(c), y + 9 + n * LINE, { fill: colors.ink1 })));
    y += Math.max(...cells.map((ls) => ls.length)) * LINE + 3;
  }
  if (anyOut) txt(ctx, colors, S.dagger, L, foot, { fill: colors.ink3 });
}

/* ------------------------------------------------------------- widget */

defineWidget({
  slug: "generation-control",
  status: "draft",
  title: "Deep Learning - Frontiers: Controlling Generation",
  subtitle: S.subtitle,
  layout: "side",
  height: (p) => layoutOf(p.w ?? 550).height,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "sampling", display: true },
    rule: { type: "segmented", label: S.ruleLabel, detail: S.ruleDetail, options: RULES, default: "temperature", display: true, when: ON("sampling") },
    T: { type: "choice", label: S.tLabel, detail: S.tDetail, options: TS.map((v) => ({ value: v, label: v })), default: "1", display: true, when: ON("sampling") },
    k: { type: "choice", label: S.kLabel, detail: S.kDetail, options: KS.map((v) => ({ value: v, label: v })), default: "3", display: true, when: ON("sampling") },
    prefix: { type: "segmented", label: S.prefixLabel, detail: S.prefixDetail, options: PREFIXES, default: "treat", display: true, when: ON("conditioning") },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 40, default: 10 },
    /* authoring escape hatch, first render only: notes already complete on the page the link opens */
    shown: { type: "int", min: 0, max: N, default: 0, hidden: true },
  },

  legend: ({ params }) =>
    params.page === "sampling"
      ? [
          { token: "reference", label: S.legend.model, mark: "hollow" },
          { token: "empirical", label: S.legend.rule, mark: "bar" },
          { token: "highlight", label: S.legend.drawn, mark: "bar" },
        ]
      : [
          { token: "group-a", label: S.legend.treat, mark: "bar" },
          { token: "group-b", label: S.legend.neg, mark: "bar" },
          { token: "reference", label: S.legend.none, mark: "hollow" },
          { token: "highlight", label: S.legend.drawn, mark: "bar" },
        ],

  /* the u's: one for each token of each note, and the only randomness */
  compute: ({ rng }) => ({ U: Array.from({ length: N }, () => Array.from({ length: M.MAX_TOKENS }, () => rng.next())), notes: new Map() }),

  animation: {
    stepLabel: "Draw",
    stepTitle: "Draw the next token of the note",
    runLabel: "Generate",
    runTitle: `Draw every token of all ${N} notes`,

    init: ({ params, state, fromScratch }) => {
      const anim = { at: freshPlaces(), stage: stageOf(params), t: 0, live: false, halt: false };
      /* a link's shown= fills every column of the page it opens */
      const s = fromScratch ? 0 : Math.max(0, Math.min(N, Number(params.shown) || 0));
      if (s > 0) for (const a of armsOf(params)) anim.at[params.page][a.key] = { i: s - 1, j: notesOf(state, a)[s - 1].steps.length };
      anim.done = placeOf(anim, params, state).done;
      return anim;
    },
    advance: (anim, { dt, params, state }) => {
      if (anim.halt) { anim.halt = false; anim.live = false; return false; }
      if (anim.mode !== "run") { pressOnce(anim, params, state); anim.done = placeOf(anim, params, state).done; anim.live = false; return false; }
      anim.t += dt;
      while (anim.t >= RUN_MS) { anim.t -= RUN_MS; if (!pressOnce(anim, params, state)) break; }
      anim.done = placeOf(anim, params, state).done;
      anim.live = !anim.done;
      return anim.live;
    },
    rebuild: (anim, { params, state }) => {
      /* a page or an arm change ends Generate in flight (mid-press-page-switch): each arm has its own presses, so
         running on would fill the newly chosen column unasked. T and k keep it going: they redraw a column, the arm is the same */
      if (stageOf(params) !== anim.stage && anim.live) anim.halt = true;
      anim.stage = stageOf(params);
      anim.done = placeOf(anim, params, state).done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const Lo = layoutOf(w), pl = placeOf(anim, params, state);
    renderCard(params);
    drawNote(ctx, colors, Lo, params, pl);
    drawDist(ctx, colors, Lo, params, pl);
    drawCaption(ctx, colors, Lo, captionOf(params, pl));
    drawTable(ctx, colors, Lo, params, state, anim);
  },

  readout({ params, state, anim }) {
    const pl = placeOf(anim, params, state), T = S.tile, arms = armsOf(params);
    const done = arms.map((a) => notesOf(state, a).slice(0, placeOf(anim, params, state, a).complete));
    const note = { label: T.note, value: `${pl.i + 1} of ${N}`, note: T.noteNote(pl.j) };
    /* a column with no notes yet reads "–" */
    const each = (f) => done.map((ns) => (ns.length ? f(ns) : "–")).join(" · ");
    if (params.page === "sampling")
      return [note,
        { label: T.diff, value: each((ns) => new Set(ns.map((n) => n.text)).size), note: T.diffNote },
        { label: T.first, value: each((ns) => new Set(ns.map((n) => n.words[0])).size), note: T.firstNote }];
    const count = (ns, kind) => ns.filter((n) => kindOf(n) === kind).length, [t, g, z] = done;
    return [note,
      { label: T.treat, value: t.length ? `${count(t, "treat")} of ${t.length}` : "–", note: T.ofDone },
      { label: T.neg, value: g.length ? `${count(g, "neg")} of ${g.length}` : "–", note: T.ofDone },
      { label: T.none, value: z.length ? `${count(z, "treat")} · ${count(z, "neg")}` : "–", note: T.ofDone }];
  },

  summary({ params, state, anim }) {
    const pl = placeOf(anim, params, state);
    return `Note ${pl.i + 1} of ${N}: ${pl.note.words.slice(0, pl.j).join(" ") || "no token drawn yet"}.`;
  },
});
