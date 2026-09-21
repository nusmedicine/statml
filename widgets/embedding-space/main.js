/* ============================================================================
   Widget 74 · Embedding Space — PHM5005 07-1 cell 3 (tokens, one-hot,
   embedding, the "Vector space" panel) and 08-1 cell 1 §2 (position).

   Three pages, one step each, in the pipeline's order (his shape of
   2026-09-21: "we're getting ahead of ourselves"):

     TOKENIZE  a raw sequence → tokens → ids, and nothing else. Bases one
               by one, or the same DNA string as codons three at a time with
               the leftover base dropped; residues; words, with <unk> for a
               word outside the vocabulary and <pad> to a fixed length.
     ENCODE    a token as a vector: ONE-HOT, the identity table, every pair
               of tokens √2 apart so no similarity can be expressed; or an
               EMBEDDING, a table of E numbers a token that trains with the
               task — its rows drawn as points, moving epoch by epoch, and
               the tokens the task treats alike become neighbours, a
               geometry nobody typed in.
     POSITION  the tokenised sequence's embedding rows, plus a position row
               each, equals what the network reads: x̃ᵢ = xᵢ + pᵢ. Learned
               rows as initialised, the sinusoid, or a rotation that adds
               nothing and turns each pair of a row instead. No attention,
               no training: the arithmetic alone.

   A Vocabulary under all three: four bases, sixty-one codons, twenty amino
   acids, forty clinical words (the plain-language one, so the same stage is
   seen on tokens everyone reads).

   THE PRESS. On Encode it is an epoch: compute() trains all forty on the
   click (under a second) and records the table after each; Step moves the
   points from one epoch's frame to the next. On Tokenize and Position it is
   a token: the next box, or the next column of all three matrices. Nothing
   is computed per frame (invariant 2). Each stage keeps its own count, so a
   switch of page or vocabulary and back finds it where it was.

   THE FRAME IS HELD STILL. Each epoch's own two components would reflect and
   spin (measured, `_lab/embedding-space-align-measure.mjs`); model.js lays
   every frame over the final epoch's by the orthogonal map that fits best.
   The picture is a projection and says so: purity drawn beside purity in E.

   Colour is the TRUE role or amino acid, which nobody typed in; the position
   is what training put there (colour carries the truth, never the finding).
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import * as M from "./model.js";

const PAGES = [{ value: "tokenize", label: "Tokenize" }, { value: "encode", label: "Encode" }, { value: "position", label: "Position" }];
const VOCABS = [{ value: "dna", label: "DNA" }, { value: "codon", label: "Codons" }, { value: "aa", label: "Amino acids" }, { value: "words", label: "Words" }];
const ENCODINGS = [{ value: "onehot", label: "One-hot" }, { value: "embedding", label: "Embedding" }];
const POS_ENC = [{ value: "learned", label: "Learned" }, { value: "sinusoidal", label: "Sinusoidal" }, { value: "rope", label: "Rotary" }];
const STEP_MS = 420, RUN_MS = 240;   // an epoch's move on Step, and under Play
const TOK_STEP_MS = 220, TOK_RUN_MS = 110; // a token's arrival
const HEIGHT = 384, HEIGHT_TOK = 204;
const ON = (page) => ({ param: "page", equals: page });
const ON_E = { any: [{ all: [ON("encode"), { param: "encoding", equals: "embedding" }] }, ON("position")] };

/** which of the stages a parameter set shows; the animation keeps a counter per stage */
const stageOf = (params) => (params.page === "tokenize" ? `tok-${params.vocab}` : params.page === "position" ? `pos-${params.vocab}` : params.vocab);
const isTokenStage = (stage) => stage.startsWith("tok-") || stage.startsWith("pos-");
const stepMs = (anim) => (isTokenStage(anim.stage) ? (anim.mode === "run" ? TOK_RUN_MS : TOK_STEP_MS) : anim.mode === "run" ? RUN_MS : STEP_MS);

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A sequence becomes tokens, a token becomes a vector, and a position is added to it. " +
    "One-hot puts every token the same distance from every other; an embedding trained with the task is a space in which the tokens the task treats alike become neighbours, a geometry nobody typed in. " +
    "Four bases, sixty-one codons, twenty amino acids, forty clinical words.",
  pageLabel: "Page",
  vocabLabel: "Vocabulary",
  vocabDetail: "which tokens the table holds a row for: the four bases, the sixty-one sense codons, the twenty amino acids, or forty clinical words",
  dataSection: "The vector",
  encodingLabel: "Encoding",
  encodingDetail: "a token as a vector: a 1 in its own column and 0 elsewhere, or a row of E numbers trained with the task",
  eLabel: "Embedding size E",
  eDetail: "how many numbers a token's row holds; the picture projects them to two",
  seedLabel: "Seed",
  seedDetail: "the sequence, the starting rows and the training sequences, reproducibly",
  posSection: "The position",
  posEncLabel: "Position encoding",
  posEncDetail: "the row added for a token's place in the sequence: one trained with the rest, the fixed sine and cosine table, or a rotation of the row by its position",

  stepLabel: { param: "page", labels: { encode: "Train one" }, default: "Next token" },
  stepTitle: { param: "page", labels: { tokenize: "Cut the next token and give it its id", encode: "Train one epoch of 300 sequences and move each row to where it leaves it", position: "Add the next token's position row to its embedding row" }, default: "Next token" },
  runLabel: "Play",
  runTitle: { param: "page", labels: { encode: "Train the remaining epochs in turn" }, default: "Take the remaining tokens in turn" },

  legend: {
    dna: [
      { token: "cluster-a", label: "Purine · A G", mark: "dot" },
      { token: "cluster-b", label: "Pyrimidine · C T", mark: "dot" },
    ],
    codon: [
      { token: "cluster-a", label: "Leucine (L) · six codons", mark: "dot" },
      { token: "cluster-b", label: "Arginine (R) · six codons", mark: "dot" },
      { token: "cluster-c", label: "Serine (S) · six codons", mark: "dot" },
      { token: "ink-3", label: "The other 43 codons, which the task never rewards", mark: "dot" },
    ],
    aa: [
      { token: "cluster-a", label: "Hydrophobic · A V L I M F W Y", mark: "dot" },
      { token: "cluster-b", label: "Polar · S T N Q C G P", mark: "dot" },
      { token: "cluster-c", label: "Positive · K R H", mark: "dot" },
      { token: "cluster-d", label: "Negative · D E", mark: "dot" },
    ],
    words: [
      { token: "cluster-a", label: "Action · admitted, treated, discharged …", mark: "dot" },
      { token: "cluster-b", label: "Drug · aspirin, metformin, insulin …", mark: "dot" },
      { token: "cluster-c", label: "Symptom · pain, fever, cough …", mark: "dot" },
      { token: "cluster-d", label: "Site · chest, head, abdomen …", mark: "dot" },
      { token: "ink-3", label: "Fillers · the, patient, was, with …, which the task never rewards", mark: "dot" },
    ],
  },

  /* Tokenize */
  tokCapRaw: {
    dna: (raw) => `the sequence · ${raw.length} bases`,
    codon: (raw) => `the sequence · ${raw.length} bases, the same string as the base page`,
    aa: (raw) => `the sequence · ${raw.length} residues`,
    words: () => "the sentence",
  },
  tokCapTokens: {
    base: () => "tokens · one a base, character by character",
    codon: (d) => `tokens · one a codon, three bases at a time in frame 1${d ? `; the base${d.length > 1 ? "s" : ""} left over dropped` : ""}`,
    residue: () => "tokens · one a residue, character by character",
    word: () => `tokens · one a word; ${M.UNK} for a word outside the vocabulary, ${M.PAD} to ${M.PAD_TO}`,
  },
  tokCapIds: (V) => `ids · the integer each token becomes, 1 to ${V - 1}; ${M.PAD} is 0`,
  tokStart: "no token yet · the sequence as text",
  tokStatus: (i, T, tok, id) => `token ${i} of ${T} · ${tok} → id ${id}`,
  tokHover: (tok, name, id) => `${tok} · ${name} · id ${id}`,
  tokNote: {
    base: "four ids to choose from; the network reads one base at a time",
    codon: "sixty-four ids to choose from, a third as many tokens as bases; a codon that is a stop has an id too",
    residue: "twenty ids to choose from, one a residue",
    word: `one id is shared by every word the vocabulary lacks; ${M.PAD} fills the sequence to a fixed length and is ignored downstream`,
  },
  tileTokens: "Tokens",
  tileTokensNote: { base: "one a base", codon: "one a codon; a third as many as bases", residue: "one a residue", word: `one a word, padded to ${M.PAD_TO}` },
  tileVocab: "Vocabulary",
  tileVocabNote: `ids in use, counting ${M.PAD}; the words count ${M.UNK} too`,
  tileIds: "Ids",
  tileIdsNote: "integers in sequence order: what the next page turns into vectors",

  /* Encode · embedding */
  capTable: (V, E) => `the table · Embedding(${V}, ${E}) · one row a token`,
  capSpace: {
    dna: "the space · each row on the table's top two components",
    codon: "the space · the axes from the eighteen rewarded rows",
    aa: "the space · each row on the table's top two components",
    words: "the space · the axes from the thirty-two role words",
  },
  capStart: "epoch 0 · the rows as initialised, N(0, 1)",
  capEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}%`,
  capDrawn: (p2, p, E) => `purity drawn ${Math.round(100 * p2)}% · in ${E}-D ${Math.round(100 * p)}%`,
  capTask: {
    dna: "class 1 carries purine · purine · pyrimidine · pyrimidine, each a random base of that class",
    codon: "class 1 carries L · R · S, each a random one of its six codons",
    aa: "class 1 carries hydrophobic · hydrophobic · positive · negative, each a random residue of that role",
    words: "class 1 carries action · drug · symptom · site, each a random word of that role",
  },
  tileAcc: "Held-out accuracy",
  tileAccNote: "300 sequences outside the training set, after the epochs trained so far",
  tileWait: "—",
  tiles: {
    dna: {
      main: "Class purity", mainNote: (E) => `bases whose nearest row in ${E}-D is of their class, purine or pyrimidine; chance 33%`,
      rest: "Within / between", restNote: "mean distance within a class over mean distance between classes; 1 is no structure",
    },
    codon: {
      main: "Purity, the eighteen", mainNote: (E) => `motif codons whose nearest of the eighteen in ${E}-D is a synonym; chance 29%`,
      rest: "Purity, the other 43", restNote: "codons whose nearest of all sixty-one rows is a synonym; they move too, and at chance they have landed nowhere",
    },
    aa: {
      main: "Role purity", mainNote: (E) => `tokens whose nearest row in ${E}-D shares their role; chance 28%`,
      rest: "Within / between", restNote: "mean distance within a role over mean distance between roles; 1 is no structure",
    },
    words: {
      main: "Role purity", mainNote: (E) => `role words whose nearest row in ${E}-D shares their role; chance 23%`,
      rest: "Purity, the fillers", restNote: "fillers whose nearest of all forty rows is a filler; the task treats them alike, and alike is a role too",
    },
  },

  /* Encode · one-hot */
  capOneHot: (V) => `the table · one-hot · [${V}, ${V}], the identity: a 1 in the token's own column`,
  capOneHotDist: "the distances · every pair of tokens √2 apart · nothing to draw as neighbours",
  capOneHotEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}% · the table is fixed, so nothing here moves`,
  capOneHotStart: "epoch 0 · the table is the identity, and stays so",
  tileDist: "Distance, any two tokens",
  tileDistNote: "√2 between every pair of rows: one-hot expresses no similarity, whatever the task",
  tileParams: "Parameters",
  tileParamsNoteOneHot: (V) => `the table holds none; the first layer reads ${V} channels instead of E`,

  /* Position */
  posCapTokens: "the tokens, as the Tokenize page cut them",
  posCapEmb: (L, E) => `x · the embedding row of each token, from the table Encode trained · [${L}, ${E}]`,
  posCapPos: {
    learned: (L, E) => `+ p · position rows · Embedding(${L}, ${E}) as initialised; in a transformer they train with the rest`,
    sinusoidal: (L, E) => `+ p · position rows · sin on even columns, cos on odd, one frequency a pair · [${L}, ${E}], fixed`,
    rope: () => "rotary · nothing added: each pair of a row is turned by its position, a slower turn each pair",
  },
  posCapFinal: { learned: "= x̃ · what the network reads", sinusoidal: "= x̃ · what the network reads", rope: "= x̃ · the rows turned · what the network reads" },
  posStart: "no token yet",
  posStatus: { add: (i, tok) => `token ${i} · ${tok} at position ${i - 1} · row ${i - 1} of the position table added`, rope: (i, tok) => `token ${i} · ${tok} at position ${i - 1} · each pair of its row turned by ${i - 1} · θ` },
  posHover: { add: (tok, e, a, b, c) => `${tok} · column ${e} · ${a.toFixed(2)} + ${b.toFixed(2)} = ${c.toFixed(2)}`, rope: (tok, e, a, c) => `${tok} · column ${e} · ${a.toFixed(2)} → ${c.toFixed(2)}` },
  posNote: {
    learned: "the same token at two positions gets two different rows; a position never seen in training has a row that never trained",
    sinusoidal: "the same token at two positions gets two different rows; any position has a row, the formula makes it",
    rope: "the same token at two positions gets two different rows; a rotation keeps each row's length",
  },
  tilePosRows: "Position rows",
  tilePosRowsValue: { learned: (L, E) => `${L} × ${E}`, sinusoidal: () => "fixed", rope: () => "none" },
  tilePosRowsNote: { learned: "parameters the position table adds; here as initialised", sinusoidal: "no parameters: sine and cosine of the position at one frequency a pair", rope: "no parameters, nothing added: a rotation of each pair by the position" },
  tileFinal: "Final",
  tileFinalNote: "one row a token, in sequence order, position included: what attention reads",

  hover: {
    dna: (c) => `${c} · ${M.BASE_NAMES[c]} · ${M.baseClass(c)}`,
    codon: (c) => `${c} · ${M.NAMES[M.AA_OF[c]] ?? M.AA_OF[c]} (${M.AA_OF[c]})`,
    aa: (c) => `${c} · ${M.NAMES[c]} · ${M.roleOf(c)}`,
    words: (t) => `${t} · ${M.wordRole(t)}`,
  },

  sumTok: (vocab, n, T) => `a ${{ dna: "DNA sequence", codon: "DNA sequence", aa: "protein sequence", words: "clinical sentence" }[vocab]} cut into tokens with their ids; ${n === 0 ? "no token cut yet" : n < T ? `${n} of ${T} tokens cut` : "every token cut"}`,
  sum: (vocab, e, n) => `${{ dna: "four bases", codon: "sixty-one codons", aa: "twenty amino acids", words: "forty clinical words" }[vocab]} as rows of an embedding table and as points; ${e === 0 ? "the rows as initialised" : e < n ? `${e} of ${n} epochs trained` : "all epochs trained"}`,
  sumOneHot: (vocab, e, n) => `${{ dna: "four bases", codon: "sixty-one codons", aa: "twenty amino acids", words: "forty clinical words" }[vocab]} one-hot encoded, every pair the same distance apart; ${e === 0 ? "untrained" : `${e} of ${n} epochs trained on the fixed table`}`,
  sumPos: (vocab, pe, n, T) => `the tokenised ${{ dna: "DNA sequence", codon: "DNA sequence", aa: "protein sequence", words: "clinical sentence" }[vocab]}: embedding rows, ${pe === "rope" ? "a rotation by position" : `${pe} position rows`}, and their sum; ${n === 0 ? "no token yet" : n < T ? `${n} of ${T} tokens` : "every token"}`,
};

/* ------------------------------------------------------ drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ramp = (colors, t, to) => { const a = rgb(colors.surface3), b = rgb(to); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };
const signed = (colors, v, scale) => (v >= 0 ? ramp(colors, v / scale, colors.valueHigh) : ramp(colors, -v / scale, colors.valueLow));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic", halo = false } = {}) {
  ctx.save();
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if (halo) { ctx.strokeStyle = colors.surface; ctx.lineWidth = 3; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill ?? colors.ink2;
  ctx.fillText(s, x, y);
  ctx.restore();
}
const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

/* the truth's colours: a vocabulary's groups in the cluster hues, in the legend's order; a group with no slot is unrewarded */
const SLOTS = {
  dna: { purine: 0, pyrimidine: 1 },
  codon: { L: 0, R: 1, S: 2 },
  aa: { hydrophobic: 0, polar: 1, positive: 2, negative: 3 },
  words: { action: 0, drug: 1, symptom: 2, site: 3 },
};
function colourOf(colors, vocab, i) {
  const slot = SLOTS[vocab][M.PAGES[vocab].group(i)];
  return slot == null ? wash(colors.ink3, 0.55) : colors.clusters[slot];
}
const isSpecial = (tok) => tok === M.PAD || tok === M.UNK;
/** a token's colour by its vocabulary group; the neutral ink for a special token or one with no row */
function tokenColour(colors, vocab, tok) {
  const gi = M.PAGES[vocab].tokens.indexOf(tok);
  return gi >= 0 ? colourOf(colors, vocab, gi) : wash(colors.ink3, 0.55);
}

/* ----------------------------------------------------------- the layout */

const PAD_R = 14, TOP = 24, GAP = 26, TABLE_X = 12;
const BELOW = 40;   // under the panels: the status line and the note
/** the two Encode panels: the table at the left, the space a square at the right */
function layout(w) {
  const bottom = HEIGHT - BELOW;
  const side = bottom - TOP;
  const spaceX = w - PAD_R - side;
  return { top: TOP, bottom, side, spaceX, tableX: TABLE_X, tableW: spaceX - GAP - TABLE_X };
}

/* ================================================================ compute */

/* Trained runs, cached by the parameters that shape them: a page or
   vocabulary switch is a display change that re-runs compute, and without
   the cache every visit back would retrain for a second. */
const cache = new Map();
function cached(key, make) {
  if (cache.has(key)) return cache.get(key);
  const v = make();
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(key, v);
  return v;
}
function compute({ params }) {
  const E = Number(params.E);
  if (params.page === "tokenize") return M.tokenizePage(params.vocab, params.seed);
  if (params.page === "position") {
    const run = cached([params.vocab, E, params.seed].join("|"), () => M.trainPage(params.vocab, E, params.seed));
    return M.positionPage(params.vocab, E, params.seed, params.posenc, run);
  }
  if (params.encoding === "onehot") return cached(["onehot", params.vocab, params.seed].join("|"), () => M.trainPage(params.vocab, E, params.seed, { onehot: true }));
  return cached([params.vocab, E, params.seed].join("|"), () => M.trainPage(params.vocab, E, params.seed));
}

/* ============================================================== animation */

/** the press whose numbers are shown: the target once its move has landed, else the one before */
const shownStep = (anim) => (anim.t >= 1 ? anim.n[anim.stage] : Math.max(0, anim.n[anim.stage] - 1));
const isDone = (anim, state) => anim.n[anim.stage] >= state.steps && anim.t >= 1;

/* ======================================================== the token row */

/** the tokens as boxes across the width: `upto` of them, the last at alpha `a`; returns the hovered index or null */
function tokenRow(ctx, colors, state, X0, bw, top, h, upto, a, pointer) {
  const { tokens, vocab } = state;
  ctx.save(); ctx.font = monoFont(colors); const wide = tokens.map((tk) => ctx.measureText(tk).width + 6 > bw); ctx.restore();
  let hover = null;
  for (let i = 0; i < upto; i++) {
    const x = X0 + i * bw, tok = tokens[i], col = tokenColour(colors, vocab, tok), sp = isSpecial(tok);
    ctx.save(); ctx.globalAlpha = i === upto - 1 ? a : 1;
    rect(ctx, x + 1, top, bw - 2, h, sp ? null : wash(col, 0.28), sp ? colors.ink3 : col, 1);
    /* a label wider than its box goes above or below in turn */
    if (wide[i]) txt(ctx, colors, tok, x + bw / 2, i % 2 ? top + h + 12 : top - 5, { font: monoFont(colors), fill: sp ? colors.ink3 : colors.ink1, align: "center", halo: true });
    else txt(ctx, colors, tok, x + bw / 2, top + h / 2, { font: monoFont(colors), fill: sp ? colors.ink3 : colors.ink1, align: "center", baseline: "middle" });
    ctx.restore();
    if (pointer && pointer.x >= x && pointer.x < x + bw && pointer.y >= top - 14 && pointer.y < top + h + 14) hover = i;
  }
  return hover;
}

/* =============================================================== Tokenize */

const TOK = { rawY: 34, tokCap: 58, boxTop: 80, boxH: 22, idCap: 130, idY: 146, status: 176, note: 190 };
function drawTokenize(ctx, colors, w, params, state, anim, pointer) {
  const { tokens, ids, raw, how, dropped, vocab } = state, T = tokens.length;
  const n = anim.n[anim.stage], t = ease(anim.t), upto = Math.min(n, T);
  const X0 = TABLE_X, X1 = w - PAD_R, bw = (X1 - X0) / T;

  /* 1 · the raw sequence, the part cut so far in the full ink */
  txt(ctx, colors, S.tokCapRaw[vocab](raw), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  ctx.save(); ctx.font = monoFont(colors);
  const consumed = how === "codon" ? 3 * upto : how === "word" ? tokens.slice(0, upto).filter((tk) => tk !== M.PAD).length : upto;
  const units = how === "word" ? raw.split(" ").map((u) => u + " ") : [...raw];
  let cx = X0;
  units.forEach((u, i) => {
    const tail = how === "codon" && i >= raw.length - dropped.length;
    ctx.fillStyle = tail ? colors.ink3 : i < consumed ? colors.ink1 : colors.ink2;
    ctx.fillText(u, cx, TOK.rawY); cx += ctx.measureText(u).width;
  });
  if (dropped) { ctx.fillStyle = colors.ink3; ctx.fillText(`  · ${dropped.length} base${dropped.length > 1 ? "s" : ""} left over, dropped`, cx, TOK.rawY); }
  ctx.restore();

  /* 2 · the tokens · 3 · their ids */
  txt(ctx, colors, S.tokCapTokens[how](dropped), X0, TOK.tokCap, { font: capFont(colors), fill: colors.ink1 });
  const hover = tokenRow(ctx, colors, state, X0, bw, TOK.boxTop, TOK.boxH, upto, anim.t < 1 ? t : 1, pointer);
  txt(ctx, colors, S.tokCapIds(state.V), X0, TOK.idCap, { font: capFont(colors), fill: colors.ink1 });
  for (let i = 0; i < upto; i++) {
    ctx.save(); ctx.globalAlpha = i === upto - 1 && anim.t < 1 ? t : 1;
    txt(ctx, colors, String(ids[i]), X0 + (i + 0.5) * bw, TOK.idY, { font: monoFont(colors), fill: colors.ink2, align: "center" });
    ctx.restore();
  }
  if (hover != null) {
    const x = X0 + (hover + 0.5) * bw, left = x > w * 0.6;
    txt(ctx, colors, S.tokHover(tokens[hover], state.names[hover], ids[hover]), left ? x - 8 : x + 8, TOK.boxTop - 18, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  }
  const shown = shownStep(anim);
  txt(ctx, colors, shown <= 0 ? S.tokStart : S.tokStatus(shown, T, tokens[shown - 1], ids[shown - 1]), X0, TOK.status, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
  txt(ctx, colors, S.tokNote[how], X0, TOK.note, { fill: colors.ink3 });
}

/* ===================================================== Encode · embedding */

/* EVERY ROW IS NAMED (his ask, 2026-09-21). Sixty-one codon names at one row
   each would need a table twice the canvas at the smallest face, so the rows
   break into columns — as many as keep a row at ROW_H — read down each
   column in turn; a codon table is three stacks, a word table two. */
const ROW_H = 13;
function drawTable(ctx, colors, L, params, state, anim) {
  const vocab = params.vocab, P = M.PAGES[vocab], n = anim.n[anim.stage], t = ease(anim.t);
  const prev = state.tables[Math.max(0, n - 1)], cur = state.tables[n];
  const rows = cur.length, E = state.E;
  const cols = Math.max(1, Math.ceil((rows * ROW_H) / L.side)), per = Math.ceil(rows / cols);
  ctx.save(); ctx.font = monoFont(colors);
  const labelW = Math.max(...P.tokens.map((tk) => ctx.measureText(tk).width)) + 8;
  ctx.restore();
  const colW = L.tableW / cols, cellW = Math.max(3, Math.min(26, (colW - labelW - 10) / E));
  txt(ctx, colors, S.capTable(P.V, E), L.tableX, 14, { font: capFont(colors), fill: colors.ink1 });
  for (let i = 0; i < rows; i++) {
    const c = Math.floor(i / per), r = i % per;
    const x0 = L.tableX + c * colW, y = L.top + r * ROW_H;
    for (let e = 0; e < E; e++) {
      const v = lerp(prev[i][e], cur[i][e], t);
      rect(ctx, x0 + labelW + e * cellW, y, Math.ceil(cellW), ROW_H, signed(colors, v, 3));
    }
    /* the row's name, in its group's colour; the neutral ink for a row the task never rewards */
    const rewarded = SLOTS[vocab][P.group(i)] != null;
    txt(ctx, colors, P.tokens[i], x0 + labelW - 4, y + ROW_H / 2, { font: monoFont(colors), fill: rewarded ? colourOf(colors, vocab, i) : colors.ink3, align: "right", baseline: "middle" });
  }
  for (let c = 0; c < cols; c++) {
    const inCol = Math.min(per, rows - c * per);
    rect(ctx, L.tableX + c * colW + labelW, L.top, E * cellW, inCol * ROW_H, null, colors.grid);
  }
}

/** where row i sits in the picture at this frame, in drawing coordinates */
function pointAt(L, state, anim, i) {
  const n = anim.n[anim.stage], t = ease(anim.t);
  const a = state.frames[Math.max(0, n - 1)][i], b = state.frames[n][i];
  const sc = (L.side / 2 - 10) / state.lim, cx = L.spaceX + L.side / 2, cy = L.top + L.side / 2;
  return [cx + lerp(a[0], b[0], t) * sc, cy - lerp(a[1], b[1], t) * sc];
}

function drawSpace(ctx, colors, L, params, state, anim, pointer) {
  const vocab = params.vocab, P = M.PAGES[vocab];
  txt(ctx, colors, S.capSpace[vocab], L.spaceX, 14, { font: capFont(colors), fill: colors.ink1 });
  rect(ctx, L.spaceX, L.top, L.side, L.side, colors.surface2, colors.grid);
  const cx = L.spaceX + L.side / 2, cy = L.top + L.side / 2;
  line(ctx, L.spaceX + 4, cy, L.spaceX + L.side - 4, cy, colors.grid);
  line(ctx, cx, L.top + 4, cx, L.bottom - 4, colors.grid);

  const pts = P.tokens.map((_, i) => pointAt(L, state, anim, i));
  const scored = new Set(P.scored);
  /* the unrewarded rows first, so a rewarded point is never under one */
  const order = [...P.tokens.keys()].sort((a, b) => Number(scored.has(a)) - Number(scored.has(b)));
  for (const i of order) {
    const [x, y] = pts[i], main = scored.has(i);
    dot(ctx, x, y, main ? (vocab === "aa" || vocab === "dna" ? 5 : 4.5) : 3, colourOf(colors, vocab, i));
    if (main) txt(ctx, colors, P.tokens[i], x + 7, y + 1, { font: monoFont(colors), fill: colors.ink1, baseline: "middle", halo: true });
  }

  /* the hover inspector: the nearest point within reach, named */
  if (pointer) {
    let best = 12, bi = -1;
    pts.forEach(([x, y], i) => { const d = Math.hypot(x - pointer.x, y - pointer.y); if (d < best) { best = d; bi = i; } });
    if (bi >= 0) {
      const [x, y] = pts[bi];
      dot(ctx, x, y, 8, "transparent", colors.highlight, 1.5);
      const left = x > L.spaceX + L.side * 0.6;
      txt(ctx, colors, S.hover[vocab](P.tokens[bi]), left ? x - 10 : x + 10, y - 12, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
    }
  }

  const e = shownStep(anim);
  const g = state.geo[e], g2 = state.geo2[e];
  txt(ctx, colors, S.capDrawn(g2.purity, g.purity, state.E), L.spaceX + L.side, L.bottom + 14, { fill: colors.ink2, align: "right" });
}

function drawEmbedding(ctx, colors, w, params, state, anim, pointer) {
  const L = layout(w);
  drawTable(ctx, colors, L, params, state, anim);
  drawSpace(ctx, colors, L, params, state, anim, pointer);
  const e = shownStep(anim);
  txt(ctx, colors, e === 0 ? S.capStart : S.capEpoch(e, state.steps, state.accs[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
  txt(ctx, colors, S.capTask[params.vocab], TABLE_X, L.bottom + 28, { fill: colors.ink3 });
}

/* ======================================================= Encode · one-hot */

function drawOneHot(ctx, colors, w, params, state, anim) {
  const vocab = params.vocab, P = M.PAGES[vocab], V = state.V, L = layout(w);
  const rows = P.tokens.length, rowH = L.side / rows;
  ctx.save(); ctx.font = monoFont(colors);
  const labelW = rowH >= 11 ? Math.max(...P.tokens.map((tk) => ctx.measureText(tk).width)) + 8 : 0;
  ctx.restore();
  const cellW = Math.min(rowH, (L.tableW - labelW) / V);
  txt(ctx, colors, S.capOneHot(V), L.tableX, 14, { font: capFont(colors), fill: colors.ink1 });
  for (let i = 0; i < rows; i++) {
    const y = L.top + i * rowH, id = P.ids[i];
    rect(ctx, L.tableX + labelW, y, V * cellW, Math.ceil(rowH), colors.surface2);
    rect(ctx, L.tableX + labelW + id * cellW, y, Math.max(1, cellW), Math.ceil(rowH), colourOf(colors, vocab, i));
    if (labelW) txt(ctx, colors, P.tokens[i], L.tableX + labelW - 4, y + rowH / 2, { font: monoFont(colors), fill: colourOf(colors, vocab, i), align: "right", baseline: "middle" });
  }
  rect(ctx, L.tableX + labelW, L.top, V * cellW, rows * rowH, null, colors.grid);

  /* the distances: every pair the same */
  txt(ctx, colors, S.capOneHotDist, L.spaceX, 14, { font: capFont(colors), fill: colors.ink1 });
  const cs = L.side / rows;
  for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) rect(ctx, L.spaceX + j * cs, L.top + i * cs, Math.ceil(cs), Math.ceil(cs), i === j ? colors.surface3 : wash(colors.magnitude, 0.55));
  rect(ctx, L.spaceX, L.top, L.side, L.side, null, colors.grid);
  txt(ctx, colors, "√2", L.spaceX + L.side / 2, L.top + L.side / 2, { font: capFont(colors), fill: colors.ink1, align: "center", baseline: "middle", halo: true });

  const e = shownStep(anim);
  txt(ctx, colors, e === 0 ? S.capOneHotStart : S.capOneHotEpoch(e, state.steps, state.accs[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
  txt(ctx, colors, S.capTask[vocab], TABLE_X, L.bottom + 28, { fill: colors.ink3 });
}

/* =============================================================== Position */

const POS = { boxTop: 30, boxH: 18, firstCap: 84 };
function drawPosition(ctx, colors, w, params, state, anim, pointer) {
  const { tokens, emb, pos, final, E: Ed, pe, vocab } = state, T = tokens.length;
  const n = anim.n[anim.stage], t = ease(anim.t), upto = Math.min(n, T), a = anim.t < 1 ? t : 1;
  const X0 = TABLE_X, X1 = w - PAD_R, bw = (X1 - X0) / T, L = layout(w);
  txt(ctx, colors, S.posCapTokens, X0, 14, { font: capFont(colors), fill: colors.ink1 });
  const hoverTok = tokenRow(ctx, colors, state, X0, bw, POS.boxTop, POS.boxH, T, 1, pointer);

  /* three matrices, a column a token: x, + p (or the turning), = x̃ */
  const avail = L.bottom - POS.firstCap - 3 * 8, mh = (avail - 2 * 14) / 3, rH = mh / Ed;
  const panels = [
    { cap: S.posCapEmb(T, Ed), rows: emb },
    { cap: pe === "rope" ? S.posCapPos.rope() : S.posCapPos[pe](T, Ed), rows: pos },
    { cap: S.posCapFinal[pe], rows: final },
  ];
  let hover = null;
  panels.forEach((p, k) => {
    const capY = POS.firstCap + k * (mh + 22), top = capY + 8;
    txt(ctx, colors, p.cap, X0, capY, { font: capFont(colors), fill: colors.ink1 });
    if (p.rows) {
      for (let i = 0; i < upto; i++) {
        ctx.save(); ctx.globalAlpha = i === upto - 1 ? a : 1;
        for (let e = 0; e < Ed; e++) rect(ctx, X0 + i * bw + 1, top + e * rH, bw - 1, Math.ceil(rH), signed(colors, p.rows[i][e], 3));
        ctx.restore();
      }
      rect(ctx, X0, top, T * bw, Ed * rH, null, colors.grid);
      if (pointer && pointer.x >= X0 && pointer.x < X0 + T * bw && pointer.y >= top && pointer.y < top + Ed * rH) {
        const i = Math.floor((pointer.x - X0) / bw), e = Math.floor((pointer.y - top) / rH);
        if (i < upto) hover = { i, e, x: X0 + (i + 0.5) * bw, y: top + e * rH };
      }
    } else {
      /* rotary: the turning, one dial a token for the fastest pair, the angle pos · θ₀ */
      const rad = Math.min(bw * 0.4, mh / 2 - 4), cy = top + mh / 2;
      for (let i = 0; i < upto; i++) {
        const cx = X0 + (i + 0.5) * bw;
        ctx.save(); ctx.globalAlpha = i === upto - 1 ? a : 1;
        dot(ctx, cx, cy, rad, colors.surface2, colors.grid);
        line(ctx, cx, cy, cx + rad * Math.cos(i), cy - rad * Math.sin(i), colors.groupA, 1.6);
        ctx.restore();
      }
    }
  });
  if (hover) {
    const { i, e, x, y } = hover, left = x > w * 0.6;
    const s = pe === "rope" ? S.posHover.rope(tokens[i], e, emb[i][e], final[i][e]) : S.posHover.add(tokens[i], e, emb[i][e], pos[i][e], final[i][e]);
    txt(ctx, colors, s, left ? x - 8 : x + 8, y - 6, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  } else if (hoverTok != null) {
    const x = X0 + (hoverTok + 0.5) * bw, left = x > w * 0.6;
    txt(ctx, colors, S.tokHover(tokens[hoverTok], state.names[hoverTok], state.ids[hoverTok]), left ? x - 8 : x + 8, POS.boxTop - 16, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  }
  const shown = shownStep(anim);
  txt(ctx, colors, shown <= 0 ? S.posStart : (pe === "rope" ? S.posStatus.rope : S.posStatus.add)(shown, tokens[shown - 1]), X0, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
  txt(ctx, colors, S.posNote[pe], X0, L.bottom + 28, { fill: colors.ink3 });
}

/* ================================================================ widget */

defineWidget({
  slug: "embedding-space",
  status: "draft",
  title: "Deep Learning - Embedding Space",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page }) => (page === "tokenize" ? HEIGHT_TOK : HEIGHT),
  pointer: true,

  params: {
    page: { type: "segmented", label: S.pageLabel, options: PAGES, default: "tokenize", display: true },
    /* two by two: in one row "Amino acids" truncates at the rail's width */
    vocab: { type: "segmented", style: "grid", label: S.vocabLabel, detail: S.vocabDetail, options: VOCABS, default: "dna", display: true },
    dataSec: { type: "section", label: S.dataSection, when: ON("encode") },
    encoding: { type: "segmented", label: S.encodingLabel, detail: S.encodingDetail, options: ENCODINGS, default: "embedding", when: ON("encode") },
    posSec: { type: "section", label: S.posSection, when: ON("position") },
    posenc: { type: "segmented", label: S.posEncLabel, detail: S.posEncDetail, options: POS_ENC, default: "learned", when: ON("position") },
    E: {
      type: "choice", label: S.eLabel, detail: S.eDetail,
      options: M.SIZES.map((e) => ({ value: String(e), label: String(e) })), default: "8", when: ON_E,
    },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },
    /* authoring escape hatch, first render only: presses already taken on the stage it opens with */
    shown: { type: "int", min: 0, max: 64, default: 0, hidden: true },
  },

  legend: ({ params }) => S.legend[params.vocab] ?? S.legend.dna,

  compute,

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const shown = fromScratch ? 0 : Math.max(0, Math.min(state.steps, Number(params.shown) || 0));
      const anim = { stage: stageOf(params), n: {}, t: 1, moving: false, halt: false };
      for (const v of VOCABS) for (const pre of ["tok-", "", "pos-"]) anim.n[pre + v.value] = 0;
      anim.n[anim.stage] = shown;
      anim.done = isDone(anim, state);
      return anim;
    },

    advance: (anim, { dt, state }) => {
      /* a press a stage switch finished (`rebuild`) ends here, before it takes the new stage's press */
      if (anim.halt) { anim.halt = false; anim.moving = false; return false; }
      const stage = anim.stage, ms = stepMs(anim), steps = state.steps;
      let more;
      if (anim.t < 1) {
        anim.t = Math.min(1, anim.t + dt / ms);
        more = anim.t < 1 || (anim.mode === "run" && anim.n[stage] < steps);
      } else if (anim.n[stage] < steps) {
        anim.n[stage] += 1; anim.t = 0; more = true;
      } else more = false;
      anim.done = isDone(anim, state);
      anim.moving = more;
      return more;
    },

    rebuild: (anim, { params, state }) => {
      /* a press belongs to the stage it started on: core keeps a running loop
         through a display change, so a switch mid-press would run the other
         stage's press (the 2026-09-20 sweep) */
      const stage = stageOf(params);
      if (anim.moving && stage !== anim.stage) { anim.t = 1; anim.halt = true; }
      anim.stage = stage;
      anim.done = isDone(anim, state);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    if (params.page === "tokenize") drawTokenize(ctx, colors, w, params, state, anim, pointer);
    else if (params.page === "position") drawPosition(ctx, colors, w, params, state, anim, pointer);
    else if (state.onehot) drawOneHot(ctx, colors, w, params, state, anim);
    else drawEmbedding(ctx, colors, w, params, state, anim, pointer);
  },

  readout({ params, state, anim }) {
    const e = shownStep(anim);
    const pct = (v) => `${Math.round(100 * v)}%`;
    if (params.page === "tokenize") {
      return [
        { label: S.tileTokens, value: String(state.tokens.length), note: S.tileTokensNote[state.how] },
        { label: S.tileVocab, value: String(state.V), note: S.tileVocabNote },
        { label: S.tileIds, value: `[${state.tokens.length}]`, note: S.tileIdsNote },
      ];
    }
    if (params.page === "position") {
      const T = state.tokens.length, Ed = state.E;
      return [
        { label: S.tileTokens, value: String(T), note: S.tileTokensNote[state.how] },
        { label: S.tilePosRows, value: S.tilePosRowsValue[state.pe](T, Ed), note: S.tilePosRowsNote[state.pe] },
        { label: S.tileFinal, value: `[${T}, ${Ed}]`, note: S.tileFinalNote },
      ];
    }
    if (state.onehot) {
      return [
        { label: S.tileAcc, value: e >= 1 ? pct(state.accs[e]) : S.tileWait, note: S.tileAccNote },
        { label: S.tileDist, value: "1.41", note: S.tileDistNote },
        { label: S.tileParams, value: state.params.toLocaleString("en"), note: S.tileParamsNoteOneHot(state.V) },
      ];
    }
    const E = state.E, T = S.tiles[params.vocab];
    const rest = state.geoRest == null ? state.geo[e].ratio.toFixed(2) : pct(state.geoRest[e].purity);
    return [
      { label: S.tileAcc, value: e >= 1 ? pct(state.accs[e]) : S.tileWait, note: S.tileAccNote },
      { label: T.main, value: pct(state.geo[e].purity), note: T.mainNote(E) },
      { label: T.rest, value: rest, note: T.restNote },
    ];
  },

  summary({ params, state, anim }) {
    const n = shownStep(anim);
    if (params.page === "tokenize") return S.sumTok(params.vocab, n, state.steps);
    if (params.page === "position") return S.sumPos(params.vocab, state.pe, n, state.steps);
    return state.onehot ? S.sumOneHot(params.vocab, n, state.steps) : S.sum(params.vocab, n, state.steps);
  },
});
