/* ============================================================================
   Widget 74 · Embedding Space — PHM5005 07-1 cell 3 (tokens, one-hot,
   embedding, the "Vector space" panel) and 08-1 cell 1 §2 (position).

   Three pages, one step each, in the pipeline's order (his shape of
   2026-09-21: "we're getting ahead of ourselves"):

     TOKENIZE  the vocabulary as the tokenizer holds it, id by id, then a raw
               sequence → tokens → ids. Bases one by one, or the same DNA
               string as codons three at a time with the leftover base
               dropped; residues; words. Every example carries the lesson's
               two special tokens: one symbol outside the vocabulary becomes
               <unk>, and the sequence is padded to a fixed length with <pad>.
               No colour by role here: nothing has been learned yet, and the
               roles are what the next page's training reveals.
     ENCODE    a token as a vector: ONE-HOT, the identity table written as
               1s and 0s with rows and columns named, every pair of rows √2
               apart — the vectors are orthogonal; or an EMBEDDING, a table of E numbers a token that
               trains with the task — its rows drawn as points, moving epoch
               by epoch, and the tokens the task treats alike become
               neighbours, a geometry nobody typed in.
     POSITION  the tokenised sequence's embedding rows, plus a position row
               each, equals what the network reads: x̃ᵢ = xᵢ + pᵢ. Learned
               rows as initialised, the sinusoid (drawn as the curves its rows
               sample), or a rotation that adds nothing and turns the token's
               own pair instead (drawn as the arrow before and after). No attention, no
               training: the arithmetic alone, the formula on the card.

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

import { defineWidget, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

const PAGES = [{ value: "tokenize", label: "Tokenize" }, { value: "encode", label: "Encode" }, { value: "position", label: "Position" }];
const VOCABS = [{ value: "dna", label: "DNA" }, { value: "codon", label: "Codons" }, { value: "aa", label: "Amino acids" }, { value: "words", label: "Words" }];
const ENCODINGS = [{ value: "onehot", label: "One-hot" }, { value: "embedding", label: "Embedding" }];
const POS_ENC = [{ value: "learned", label: "Learned" }, { value: "sinusoidal", label: "Sinusoidal" }, { value: "rope", label: "Rotary" }];
const STEP_MS = 420, RUN_MS = 240;   // an epoch's move on Step, and under Play
const TOK_STEP_MS = 220, TOK_RUN_MS = 110; // a token's arrival
const HEIGHT = 384;
const ON = (page) => ({ param: "page", equals: page });
const ON_EMBEDDING = { all: [ON("encode"), { param: "encoding", equals: "embedding" }] };
const ON_E = { any: [ON_EMBEDDING, ON("position")] };

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
  vocabDetail: "which tokens the table holds a row for: the four bases, the sixty-four codons, the twenty amino acids, or forty clinical words",
  dataSection: "The vector",
  encodingLabel: "Encoding",
  encodingDetail: "a token as a vector: a 1 in its own column and 0 elsewhere, or a row of E numbers trained with the task",
  eLabel: "Embedding size E",
  eDetail: "how many numbers a token's row holds; the space shows the first two principal components",
  seedLabel: "Seed",
  seedDetail: "the sequence, the starting rows and the training sequences, reproducibly",
  lookSection: "Look at",
  viewLabel: "Table",
  viewDetail: "each entry's value, or its change since initialisation",
  posSection: "The position",
  posEncLabel: "Position encoding",
  posEncDetail: "the row added for a token's place in the sequence: one trained with the rest, the fixed sine and cosine table, or a rotation of the row by its position",

  stepLabel: { param: "page", labels: { encode: "Train one" }, default: "Next token" },
  stepTitle: { param: "page", labels: { tokenize: "Split off the next token and look up its id", encode: "Train one epoch of 300 sequences", position: "Add the next token's position row to its embedding row" }, default: "Next token" },
  runLabel: "Play",
  runTitle: { param: "page", labels: { tokenize: "Split off the remaining tokens in turn", encode: "Train the remaining epochs in turn", position: "Add the remaining tokens' position rows in turn" }, default: "Play" },

  legend: {
    dna: [
      { token: "cluster-a", label: "Purine · A G", mark: "dot" },
      { token: "cluster-b", label: "Pyrimidine · C T", mark: "dot" },
    ],
    codon: [
      { token: "cluster-a", label: "Leucine (L) · six codons", mark: "dot" },
      { token: "cluster-b", label: "Arginine (R) · six codons", mark: "dot" },
      { token: "cluster-c", label: "Serine (S) · six codons", mark: "dot" },
      { token: "ink-3", label: "The other 43 codons, outside the motif", mark: "dot" },
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
      { token: "ink-3", label: "Fillers · the, patient, was, with …, in no role", mark: "dot" },
    ],
  },

  /* the formula card */
  card: {
    onehot: { label: "One-hot", plain: "x_i = e(t_i)", note: "a vector of V entries: a 1 in column t_i, 0 elsewhere" },
    embedding: { label: "Embedding", plain: "x_i = E[t_i]", note: "row t_i of the table E, which has V rows of d numbers and trains with the task" },
    add: { label: "Position", plain: "x~_i = x_i + p_i", note: "the token's row, plus the row for position i" },
    rope: { label: "Position", plain: "x~_i = R(iθ) x_i", note: "the token's row, each pair of its entries turned by i · θ; nothing is added" },
  },

  /* Tokenize */
  tokCapVocab: (V, unk) => `the vocabulary · ${V} ids · ${M.PAD} is 0, ${M.UNK} is ${unk}`,
  tokCapRaw: {
    dna: (raw) => `the sequence · ${raw.length} bases, one of them N`,
    codon: (raw) => `the sequence · ${raw.length} bases, the same string as the base page`,
    aa: (raw) => `the sequence · ${raw.length} residues, one of them X`,
    words: () => "the sentence",
  },
  tokCapTokens: {
    base: (d, padTo) => `tokens · one a base · ${M.UNK} for a symbol outside the vocabulary · ${M.PAD} to ${padTo}`,
    codon: (d, padTo) => `tokens · one a codon, three bases at a time · ${M.UNK} for a codon with a symbol outside the vocabulary · ${M.PAD} to ${padTo}${d ? ` · the base${d.length > 1 ? "s" : ""} left over dropped` : ""}`,
    residue: (d, padTo) => `tokens · one a residue · ${M.UNK} for a symbol outside the vocabulary · ${M.PAD} to ${padTo}`,
    word: (d, padTo) => `tokens · one a word · ${M.UNK} for a word outside the vocabulary · ${M.PAD} to ${padTo}`,
  },
  tokCapIds: "ids · the integer each token becomes",
  tokStart: "no token yet · the sequence as a string",
  tokStatus: (i, T, tok, id) => `token ${i} of ${T} · ${tok} → id ${id}`,
  tokHover: (tok, name, id) => `${tok} · ${name} · id ${id}`,
  tokNote: {
    base: "the network reads one base at a time; N is not in the vocabulary, so it becomes <unk>",
    codon: "a third as many tokens as bases; a stop codon has an id, and the codon that contains the N becomes <unk>",
    residue: "one id a residue; X is not in the vocabulary, so it becomes <unk>",
    word: "one id is shared by every word the vocabulary lacks · <pad> fills the sequence to the fixed length and is ignored downstream",
  },
  tileTokens: "Tokens",
  tileTokensNote: { base: "one a base, padded to the fixed length", codon: "one a codon, padded to the fixed length", residue: "one a residue, padded to the fixed length", word: "one a word, padded to the fixed length" },
  tileVocab: "Vocabulary",
  tileVocabNote: `ids in the vocabulary, counting ${M.PAD} and ${M.UNK}`,
  tileIds: "Ids",
  tileIdsNote: "integers in sequence order; the Encode page turns them into vectors",

  /* Encode · embedding */
  capTable: (V, E) => `the table · Embedding(${V}, ${E}) · one row a token`,
  capTableChange: (V, E) => `the table · change since initialisation · Embedding(${V}, ${E})`,
  capSpace: {
    dna: "the space · each row on the table's first two principal components",
    codon: "the space · the axes from the eighteen motif codons' rows",
    aa: "the space · each row on the table's first two principal components",
    words: "the space · the axes from the thirty-two role words' rows",
  },
  capStart: "epoch 0 · the rows as initialised, N(0, 1)",
  capEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}%`,
  capDrawn: (p2, p, E) => `purity in 2-D ${Math.round(100 * p2)}% · in ${E}-D ${Math.round(100 * p)}%`,
  capTask: {
    dna: "class 1 contains purine · purine · pyrimidine · pyrimidine, each a random base of that class",
    codon: "class 1 contains L · R · S, each a random one of its six codons",
    aa: "class 1 contains hydrophobic · hydrophobic · positive · negative, each a random residue of that role",
    words: "class 1 contains action · drug · symptom · site, each a random word of that role",
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
      rest: "Purity, the other 43", restNote: "codons whose nearest of all sixty-one rows is a synonym; at chance, training moved them without grouping them",
    },
    aa: {
      main: "Role purity", mainNote: (E) => `tokens whose nearest row in ${E}-D shares their role; chance 28%`,
      rest: "Within / between", restNote: "mean distance within a role over mean distance between roles; 1 is no structure",
    },
    words: {
      main: "Role purity", mainNote: (E) => `role words whose nearest row in ${E}-D shares their role; chance 23%`,
      rest: "Purity, the fillers", restNote: "fillers whose nearest of all forty rows is a filler; the task treats them alike, so they group together",
    },
  },

  /* Encode · one-hot */
  capOneHot: (V) => `the table · one-hot · [${V}, ${V}] · one row a token, one column an id; a 1 where they meet, 0 elsewhere`,
  capOneHotEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}% · the table is fixed`,
  capOneHotStart: "epoch 0 · the identity table, fixed throughout",
  tileDist: "Distance, any two tokens",
  tileDistNote: "√2 between every pair of rows: the vectors are orthogonal, and no two tokens are nearer than any other two",
  tileParams: "Parameters",
  tileParamsNoteOneHot: (V) => `the table holds none; the first layer reads ${V} channels instead of E`,

  /* Position */
  posCapTokens: "the tokens, from the Tokenize page",
  posCapEmb: (L, E) => `the embedding row of each token, from the table trained on the Encode page · [${L}, ${E}]`,
  posCapPos: {
    learned: (L, E) => `position rows · Embedding(${L}, ${E}) as initialised · in a transformer they train with the rest`,
    sinusoidal: (L, E) => `position rows · the sine and cosine curves each pair samples, a dot at each position · [${L}, ${E}], fixed`,
    rope: () => "nothing added: the token's own first pair as an arrow, turned by its position · a circle magnifies on hover",
  },
  posCapFinal: { learned: "what the network reads", sinusoidal: "what the network reads", rope: "the rows turned · what the network reads" },
  posGlyph: { x: "x", add: "+ p", rope: "⟳", final: "= x̃" },
  posMag: (tok, i, turn, a, b, c, d) => [`${tok} · position ${i}`, `turned by ${i} · θ₀ = ${turn.toFixed(2)} rad`, `(${a.toFixed(2)}, ${b.toFixed(2)}) → (${c.toFixed(2)}, ${d.toFixed(2)})`, "columns 0 and 1; each slower pair turns less"],
  posPairLabel: (m, th) => `pair ${m} · columns ${2 * m} and ${2 * m + 1} · θ = ${th >= 0.01 ? String(Number(th.toFixed(3))) : th.toFixed(3)} rad per position`,
  posStart: "no token yet",
  posStatus: { add: (i, tok) => `token ${i} · ${tok} at position ${i - 1} · row ${i - 1} of the position table added`, rope: (i, tok) => `token ${i} · ${tok} at position ${i - 1} · each pair of its row turned by ${i - 1} · θ` },
  posHover: { add: (tok, e, a, b, c) => `${tok} · column ${e} · ${a.toFixed(2)} + ${b.toFixed(2)} = ${c.toFixed(2)}`, rope: (tok, e, a, c) => `${tok} · column ${e} · ${a.toFixed(2)} → ${c.toFixed(2)}` },
  posNote: {
    learned: "the same token at two positions gets two different rows · a position beyond the training length has an untrained row",
    sinusoidal: "the same token at two positions gets two different rows · the formula gives every position a row",
    rope: "the same token at two positions gets two different rows · a rotation keeps each row's length",
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

  sumTok: (vocab, n, T) => `a ${{ dna: "DNA sequence", codon: "DNA sequence", aa: "protein sequence", words: "clinical sentence" }[vocab]} split into tokens with their ids; ${n === 0 ? "no token yet" : n < T ? `${n} of ${T} tokens` : "every token"}`,
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

/* EVERY CAPTION FITS ITS PANEL (the text-overlap sweep, 2026-09-21: at the
   narrowest side layout eleven captions and notes ran past their panel or
   into the next one's). `maxW` drops trailing clauses — after " · ", "; "
   or ", " — until the string fits, and cuts a lone clause with an ellipsis;
   the clauses are ordered so the ones that go are the ones that can. */
function fitText(ctx, s, maxW) {
  let out = s;
  while (ctx.measureText(out).width > maxW) {
    const cut = Math.max(out.lastIndexOf(" · "), out.lastIndexOf("; "), out.lastIndexOf(", "));
    if (cut <= 0) { while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1); return out + "…"; }
    out = out.slice(0, cut);
  }
  return out;
}
function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic", halo = false, maxW = null } = {}) {
  ctx.save();
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  if (maxW != null) s = fitText(ctx, String(s), maxW);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if (halo) { ctx.strokeStyle = colors.surface; ctx.lineWidth = 3; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill ?? colors.ink2;
  ctx.fillText(s, x, y);
  ctx.restore();
}
const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;
const glyphFont = (colors) => `600 ${colors.fsLg} ${colors.font}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1, dash = null) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
/** an arrow from (x1, y1) to (x2, y2) with a small head */
function arrow(ctx, x1, y1, x2, y2, colour, lw = 1.4) {
  line(ctx, x1, y1, x2, y2, colour, lw);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 5 * Math.cos(a - 0.45), y2 - 5 * Math.sin(a - 0.45)); ctx.lineTo(x2 - 5 * Math.cos(a + 0.45), y2 - 5 * Math.sin(a + 0.45));
  ctx.closePath(); ctx.fill(); ctx.restore();
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

/* the Tokenize page: the vocabulary grid first, its height by the vocabulary, then the sequence */
/* the vocabulary grid's cell must hold its longest token and its id; the
   columns follow the canvas width, and the rows RESERVED follow the narrowest
   canvas the side layout produces (534px), so the page's height, which cannot
   know the width, is never short; a wider canvas leaves a little air under
   the grid */
const VCELL_H = 16, VCHAR_W = 7, NARROW_W = 534;
const vcellMinW = (vocab) => 14 + VCHAR_W * (Math.max(...M.vocabList(vocab).map(({ tok }) => tok.length)) + String(M.PAGES[vocab].V).length);
const vcols = (vocab, gridW) => Math.max(1, Math.floor(gridW / vcellMinW(vocab)));
function tokLayout(vocab) {
  const V = M.PAGES[vocab].V, rows = Math.ceil(V / vcols(vocab, NARROW_W - TABLE_X - PAD_R));
  const gridTop = 22, gridBot = gridTop + rows * VCELL_H;
  const seqCap = gridBot + 26;
  return { rows, gridTop, gridBot, seqCap, rawY: seqCap + 18, tokCap: seqCap + 44, boxTop: seqCap + 66, boxH: 22, idCap: seqCap + 116, idY: seqCap + 132, status: seqCap + 160, note: seqCap + 174, height: seqCap + 186 };
}

/* ======================================================= the formula card */

/* The formula on a card above the figure, as batch-effect and 14 do it: a
   `.w-math` host before `.w-figure`, MathML where it renders and the plain
   form where it does not. His ask (2026-09-21): the operator glyphs on the
   canvas read small, so the equation is set here at the card's size. */
const MATHML = mathmlRenders();
let cardHost = null, cardKey = null;
const SUB = (v, s) => `<msub><mi>${v}</mi><mi>${s}</mi></msub>`;
const MATH = {
  onehot: `<math><mrow>${SUB("x", "i")}<mo>=</mo><msub><mi>e</mi>${SUB("t", "i")}</msub></mrow></math>`,
  embedding: `<math><mrow>${SUB("x", "i")}<mo>=</mo><mi>E</mi><mo>[</mo>${SUB("t", "i")}<mo>]</mo></mrow></math>`,
  add: `<math><mrow><msub><mover><mi>x</mi><mo>~</mo></mover><mi>i</mi></msub><mo>=</mo>${SUB("x", "i")}<mo>+</mo>${SUB("p", "i")}</mrow></math>`,
  rope: `<math><mrow><msub><mover><mi>x</mi><mo>~</mo></mover><mi>i</mi></msub><mo>=</mo><mi>R</mi><mo>(</mo><mi>i</mi><mi>θ</mi><mo>)</mo>${SUB("x", "i")}</mrow></math>`,
};
function renderCard(params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  const which = params.page === "tokenize" ? null : params.page === "encode" ? params.encoding : params.posenc === "rope" ? "rope" : "add";
  if (!which) { if (cardHost) { cardHost.remove(); cardHost = null; cardKey = null; } return; }
  if (!cardHost) { cardHost = document.createElement("div"); cardHost.className = "w-math"; cardHost.style.minHeight = "2.4em"; figure.parentNode.insertBefore(cardHost, figure); cardKey = null; }
  if (which === cardKey) return;
  cardKey = which;
  const c = S.card[which];
  cardHost.innerHTML =
    `<div class="w-math-eq" style="min-height:0">`
    + `<span style="color:var(--ink-3);font-size:var(--fs-xs);margin-right:8px">${c.label}</span>`
    + (MATHML ? MATH[which] : `<span>${c.plain}</span>`)
    + `<span style="color:var(--ink-3);font-size:var(--fs-xs)">&nbsp;&nbsp;${c.note}</span>`
    + `</div>`;
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

/** the tokens as boxes across the width, in the neutral ink (nothing learned yet): `upto` of them, the last at alpha `a`; returns the hovered index or null */
function tokenRow(ctx, colors, state, X0, bw, top, h, upto, pointer) {
  const { tokens } = state;
  ctx.save(); ctx.font = monoFont(colors); const wide = tokens.map((tk) => ctx.measureText(tk).width + 6 > bw); ctx.restore();
  let hover = null;
  for (let i = 0; i < upto; i++) {
    const x = X0 + i * bw, tok = tokens[i], sp = isSpecial(tok);
    ctx.save();
    rect(ctx, x + 1, top, bw - 2, h, sp ? null : colors.surface2, sp ? colors.ink3 : colors.axis, 1, sp ? [3, 3] : null);
    /* a label wider than its box goes above or below in turn */
    if (wide[i]) txt(ctx, colors, tok, x + bw / 2, i % 2 ? top + h + 12 : top - 5, { font: monoFont(colors), fill: sp ? colors.ink3 : colors.ink1, align: "center", halo: true });
    else txt(ctx, colors, tok, x + bw / 2, top + h / 2, { font: monoFont(colors), fill: sp ? colors.ink3 : colors.ink1, align: "center", baseline: "middle" });
    ctx.restore();
    if (pointer && pointer.x >= x && pointer.x < x + bw && pointer.y >= top - 14 && pointer.y < top + h + 14) hover = i;
  }
  return hover;
}

/* =============================================================== Tokenize */

function drawTokenize(ctx, colors, w, params, state, anim, pointer) {
  const { tokens, ids, raw, how, dropped, vocab, vocabList: VL, padTo } = state, T = tokens.length;
  const n = anim.n[anim.stage], upto = Math.min(n, T);
  const X0 = TABLE_X, X1 = w - PAD_R, bw = (X1 - X0) / T, L = tokLayout(vocab);

  /* 0 · the vocabulary, id by id; the token being cut lights its entry, the ones already used are filled */
  txt(ctx, colors, S.tokCapVocab(state.V, state.unk), X0, 14, { font: capFont(colors), fill: colors.ink1, maxW: X1 - X0 });
  const cols = vcols(vocab, X1 - X0), cw = (X1 - X0) / cols, used = new Set(ids.slice(0, upto)), current = upto > 0 ? ids[upto - 1] : -1;
  VL.forEach(({ tok, id }, k) => {
    const x = X0 + (k % cols) * cw, y = L.gridTop + Math.floor(k / cols) * VCELL_H, sp = isSpecial(tok);
    rect(ctx, x, y, cw, VCELL_H, used.has(id) ? wash(colors.highlight, id === current ? 0.22 : 0.1) : null, id === current ? colors.highlight : colors.grid, id === current ? 1.5 : 1);
    txt(ctx, colors, tok, x + 5, y + VCELL_H / 2, { font: monoFont(colors), fill: sp ? colors.ink3 : colors.ink1, baseline: "middle" });
    txt(ctx, colors, String(id), x + cw - 5, y + VCELL_H / 2, { font: monoFont(colors), fill: colors.ink3, align: "right", baseline: "middle" });
  });

  /* 1 · the raw sequence, the part cut so far in the full ink */
  txt(ctx, colors, S.tokCapRaw[vocab](raw), X0, L.seqCap, { font: capFont(colors), fill: colors.ink1, maxW: X1 - X0 });
  ctx.save(); ctx.font = monoFont(colors);
  const consumed = how === "codon" ? 3 * Math.min(upto, tokens.filter((tk) => tk !== M.PAD).length) : how === "word" ? tokens.slice(0, upto).filter((tk) => tk !== M.PAD).length : Math.min(upto, raw.length);
  const units = how === "word" ? raw.split(" ").map((u) => u + " ") : [...raw];
  let cx = X0;
  units.forEach((u, i) => {
    const tail = how === "codon" && i >= raw.length - dropped.length;
    ctx.fillStyle = tail ? colors.ink3 : i < consumed ? colors.ink1 : colors.ink2;
    ctx.fillText(u, cx, L.rawY); cx += ctx.measureText(u).width;
  });
  if (dropped) { ctx.fillStyle = colors.ink3; ctx.fillText(`  · ${dropped.length} base${dropped.length > 1 ? "s" : ""} left over, dropped`, cx, L.rawY); }
  ctx.restore();

  /* 2 · the tokens · 3 · their ids */
  txt(ctx, colors, S.tokCapTokens[how](dropped, padTo), X0, L.tokCap, { font: capFont(colors), fill: colors.ink1, maxW: X1 - X0 });
  const hover = tokenRow(ctx, colors, state, X0, bw, L.boxTop, L.boxH, upto, pointer);
  txt(ctx, colors, S.tokCapIds, X0, L.idCap, { font: capFont(colors), fill: colors.ink1, maxW: X1 - X0 });
  for (let i = 0; i < upto; i++) txt(ctx, colors, String(ids[i]), X0 + (i + 0.5) * bw, L.idY, { font: monoFont(colors), fill: colors.ink2, align: "center" });
  if (hover != null) {
    const x = X0 + (hover + 0.5) * bw, left = x > w * 0.6;
    txt(ctx, colors, S.tokHover(tokens[hover], state.names[hover], ids[hover]), left ? x - 8 : x + 8, L.boxTop - 18, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  }
  const shown = shownStep(anim);
  txt(ctx, colors, shown <= 0 ? S.tokStart : S.tokStatus(shown, T, tokens[shown - 1], ids[shown - 1]), X0, L.status, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}`, maxW: X1 - X0 });
  txt(ctx, colors, S.tokNote[how], X0, L.note, { fill: colors.ink3, maxW: X1 - X0 });
}

/* ===================================================== Encode · embedding */

/* EVERY ROW IS NAMED (his ask, 2026-09-21). Sixty-one codon names at one row
   each would need a table twice the canvas at the smallest face, so the rows
   break into columns — as many as keep a row at ROW_H — read down each
   column in turn; a codon table is three stacks, a word table two. */
const ROW_H = 13;
/** the stacks' geometry, shared by the embedding table and the one-hot identity */
function stacks(ctx, colors, L, vocab, E) {
  const P = M.PAGES[vocab], rows = P.tokens.length;
  const cols = Math.max(1, Math.ceil((rows * ROW_H) / L.side)), per = Math.ceil(rows / cols);
  ctx.save(); ctx.font = monoFont(colors);
  const labelW = Math.max(...P.tokens.map((tk) => ctx.measureText(tk).width)) + 8;
  ctx.restore();
  const colW = L.tableW / cols, cellW = Math.max(2, Math.min(26, (colW - labelW - 10) / E));
  return { P, rows, cols, per, labelW, colW, cellW, at: (i) => ({ x0: L.tableX + Math.floor(i / per) * colW, y: L.top + (i % per) * ROW_H }) };
}
/* THE CHANGE VIEW (his pick, 2026-09-21): the rows start N(0, 1) and move by
   about 0.5 an entry over forty epochs — a fifth of the ±3 ramp, a fortieth
   of it a press — so the values view barely stirs while the space turns.
   "Change" colours each entry by its distance from the row it started as,
   on a ±2 ramp, and the trained structure appears out of a blank table. */
function drawTable(ctx, colors, L, params, state, anim) {
  /* the table shows the epoch reached, with no tween between epochs: the
     fade from one colour to the next read as a distraction (his word,
     2026-09-21); the points in the space still move, which is the motion */
  const vocab = params.vocab, n = anim.n[anim.stage], E = state.E, change = params.view === "change";
  const cur = state.tables[n], base = state.tables[0];
  const G = stacks(ctx, colors, L, vocab, E), { P } = G;
  txt(ctx, colors, change ? S.capTableChange(P.V, E) : S.capTable(P.V, E), L.tableX, 14, { font: capFont(colors), fill: colors.ink1, maxW: L.tableW });
  for (let i = 0; i < G.rows; i++) {
    const { x0, y } = G.at(i);
    for (let e = 0; e < E; e++) {
      const v = cur[i][e];
      rect(ctx, x0 + G.labelW + e * G.cellW, y, Math.ceil(G.cellW), ROW_H, change ? signed(colors, v - base[i][e], 2) : signed(colors, v, 3));
    }
    /* the row's name, in its group's colour; the neutral ink for a row the task never rewards */
    const rewarded = SLOTS[vocab][P.group(i)] != null;
    txt(ctx, colors, P.tokens[i], x0 + G.labelW - 4, y + ROW_H / 2, { font: monoFont(colors), fill: rewarded ? colourOf(colors, vocab, i) : colors.ink3, align: "right", baseline: "middle" });
  }
  for (let c = 0; c < G.cols; c++) rect(ctx, L.tableX + c * G.colW + G.labelW, L.top, E * G.cellW, Math.min(G.per, G.rows - c * G.per) * ROW_H, null, colors.grid);
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
  txt(ctx, colors, S.capSpace[vocab], L.spaceX, 14, { font: capFont(colors), fill: colors.ink1, maxW: L.side });
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
  }
  /* LABELS THAT DO NOT PILE UP (the sweep, 2026-09-21): each label tries the
     right of its point, then the left, above and below, and takes the first
     place that clears every label placed so far and stays in the square; a
     point with no clear place keeps its dot and its hover, and no label. */
  ctx.save(); ctx.font = monoFont(colors);
  const placed = [], fh = Number((colors.fsXs.match(/(\d+)/) || [0, 11])[1]);
  for (const i of order) {
    if (!scored.has(i)) continue;
    const [x, y] = pts[i], tw = ctx.measureText(P.tokens[i]).width;
    const tries = [[x + 7, y - fh / 2, "left"], [x - 7 - tw, y - fh / 2, "left"], [x - tw / 2, y - 8 - fh, "left"], [x - tw / 2, y + 8, "left"]];
    const spot = tries.find(([bx, by]) => bx >= L.spaceX + 2 && bx + tw <= L.spaceX + L.side - 2 && by >= L.top + 2 && by + fh <= L.bottom - 2
      && !placed.some((q) => bx < q.x1 + 2 && bx + tw > q.x0 - 2 && by < q.y1 + 1 && by + fh > q.y0 - 1));
    if (!spot) continue;
    placed.push({ x0: spot[0], x1: spot[0] + tw, y0: spot[1], y1: spot[1] + fh });
    txt(ctx, colors, P.tokens[i], spot[0], spot[1] + fh / 2, { font: monoFont(colors), fill: colors.ink1, baseline: "middle", halo: true });
  }
  ctx.restore();

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
  txt(ctx, colors, S.capDrawn(g2.purity, g.purity, state.E), L.spaceX + L.side, L.bottom + 14, { fill: colors.ink2, align: "right", maxW: L.side });
}

function drawEmbedding(ctx, colors, w, params, state, anim, pointer) {
  const L = layout(w);
  drawTable(ctx, colors, L, params, state, anim);
  drawSpace(ctx, colors, L, params, state, anim, pointer);
  const e = shownStep(anim);
  txt(ctx, colors, e === 0 ? S.capStart : S.capEpoch(e, state.steps, state.accs[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}`, maxW: L.spaceX - GAP - TABLE_X });
  txt(ctx, colors, S.capTask[params.vocab], TABLE_X, L.bottom + 28, { fill: colors.ink3, maxW: w - PAD_R - TABLE_X });
}

/* ======================================================= Encode · one-hot */

/* THE IDENTITY, WHOLE (his word, 2026-09-21): one row a token, one column an
   id, a 1 where they meet and 0 everywhere else, rows and columns both
   named. With both labels in place the rows are plainly independent and
   every pair the same distance apart, so the distance panel went. The
   canvas grows with the vocabulary — sixty-one codon rows at the smallest
   readable face are a tall table, and that is what one-hot costs. */
const OH = { headerTop: 22, charW: 7 };
function oneHotLayout(vocab) {
  const P = M.PAGES[vocab], VL = M.vocabList(vocab);
  const header = 12 + OH.charW * Math.max(...VL.map(({ tok }) => tok.length));
  const top = OH.headerTop + header, bottom = top + P.tokens.length * ROW_H;
  return { P, VL, header, top, bottom, height: bottom + BELOW };
}
function drawOneHot(ctx, colors, w, params, state, anim) {
  const vocab = params.vocab, V = state.V, L = oneHotLayout(vocab), { P, VL } = L;
  ctx.save(); ctx.font = monoFont(colors);
  const labelW = Math.max(...P.tokens.map((tk) => ctx.measureText(tk).width)) + 8;
  ctx.restore();
  const X0 = TABLE_X + labelW, cellW = Math.min(24, (w - PAD_R - X0) / V), digits = cellW >= 9;
  txt(ctx, colors, S.capOneHot(V), TABLE_X, 14, { font: capFont(colors), fill: colors.ink1, maxW: w - PAD_R - TABLE_X });
  /* the columns' names, one an id, turned upright; every k-th where a column is narrower than the face */
  const fh = Number((colors.fsXs.match(/(\d+)/) || [0, 11])[1]), every = Math.max(1, Math.ceil((fh + 1) / cellW));
  VL.forEach(({ tok, id }) => {
    if (id !== V - 1 && (id % every !== 0 || V - 1 - id < every)) return; // the last is always named; its thinned neighbours give way
    ctx.save(); ctx.translate(X0 + (id + 0.5) * cellW, L.top - 4); ctx.rotate(-Math.PI / 2);
    txt(ctx, colors, tok, 0, 0, { font: monoFont(colors), fill: isSpecial(tok) ? colors.ink3 : colors.ink2, baseline: "middle" });
    ctx.restore();
  });
  for (let i = 0; i < P.tokens.length; i++) {
    const y = L.top + i * ROW_H, id = P.ids[i], col = colourOf(colors, vocab, i);
    rect(ctx, X0, y, V * cellW, ROW_H, colors.surface2);
    rect(ctx, X0 + id * cellW, y, Math.max(1, cellW), ROW_H, digits ? wash(col, 0.35) : col);
    if (digits) for (let v = 0; v < V; v++) txt(ctx, colors, v === id ? "1" : "0", X0 + (v + 0.5) * cellW, y + ROW_H / 2, { font: monoFont(colors), fill: v === id ? colors.ink1 : colors.ink3, align: "center", baseline: "middle" });
    txt(ctx, colors, P.tokens[i], X0 - 4, y + ROW_H / 2, { font: monoFont(colors), fill: col, align: "right", baseline: "middle" });
  }
  for (let v = 1; v < V; v++) line(ctx, X0 + v * cellW, L.top, X0 + v * cellW, L.bottom, wash(colors.grid, 0.5));
  rect(ctx, X0, L.top, V * cellW, L.bottom - L.top, null, colors.grid);

  const e = shownStep(anim);
  txt(ctx, colors, e === 0 ? S.capOneHotStart : S.capOneHotEpoch(e, state.steps, state.accs[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}`, maxW: w - PAD_R - TABLE_X });
  txt(ctx, colors, S.capTask[vocab], TABLE_X, L.bottom + 28, { fill: colors.ink3, maxW: w - PAD_R - TABLE_X });
}

/* =============================================================== Position */

/* THE MIDDLE PANEL TELLS THE TWO APART (his pick, 2026-09-21, from
   `_lab/embedding-space-position-mock.html`): the sinusoid's rows are
   samples of sine and cosine curves, so the curves are drawn across the
   token axis, one pair a row, a dot where each token reads them, and the
   heatmap beneath is those readings; the rotation reads nothing off a
   curve — the token's own first pair is an arrow, and its position turns
   it, before in the neutral ink and after in colour, the arc swept. */
const POS = { boxTop: 30, boxH: 18, firstCap: 84, glyphW: 44, curveH: 40, curveLabel: 12, capGap: 8, panelGap: 22, dialMax: 24, magR: 46 };
const pairsDrawn = (E) => Math.min(4, E / 2);
/* the dial radius follows the column width up to a cap; sized from a nominal
   canvas so the panel's height, which cannot know the width, agrees with it */
const NOMINAL_W = 770;
const dialR = (T) => Math.max(5, Math.min(POS.dialMax, 0.46 * (NOMINAL_W - PAD_R - TABLE_X - POS.glyphW) / T));
const posBodies = (pe, E, T) => {
  const mh = Math.min(E * 12, 96);
  return { mh, mid: pe === "sinusoidal" ? mh + POS.curveH * pairsDrawn(E) : pe === "rope" ? 2 * dialR(T) + 8 : mh };
};
const heightPos = (pe, E, T) => { const { mh, mid } = posBodies(pe, E, T); return POS.firstCap + 3 * (POS.capGap + POS.panelGap) + 2 * mh + mid + BELOW; };
const theta = (m, E) => Math.pow(10000, -(2 * m) / E);

/** one token's first pair turned: the arrow before (neutral) and after (colour) inside a circle of radius r, the arc between; heads only where there is room */
function turnDial(ctx, colors, cx, cy, r, ax, ay, turn) {
  const len = Math.min(r - 1, Math.hypot(ax, ay) * r * 0.45), a0 = Math.atan2(ay, ax), a1 = a0 + turn, big = r >= 12;
  dot(ctx, cx, cy, r, colors.surface2, colors.grid);
  if (len < 1) return;
  ctx.save(); ctx.strokeStyle = wash(colors.groupA, 0.5); ctx.lineWidth = big ? 1.2 : 1; ctx.beginPath(); ctx.arc(cx, cy, len * 0.8, -a0, -a1, true); ctx.stroke(); ctx.restore();
  const draw = big ? arrow : (c, x1, y1, x2, y2, col, lw) => line(c, x1, y1, x2, y2, col, lw);
  draw(ctx, cx, cy, cx + len * Math.cos(a0), cy - len * Math.sin(a0), colors.ink3, big ? 1.4 : 1.2);
  draw(ctx, cx, cy, cx + len * Math.cos(a1), cy - len * Math.sin(a1), colors.groupA, big ? 2 : 1.6);
}

function drawPosition(ctx, colors, w, params, state, anim, pointer) {
  const { tokens, emb, pos, final, E: Ed, pe } = state, T = tokens.length;
  const n = anim.n[anim.stage], upto = Math.min(n, T);
  const X0 = TABLE_X + POS.glyphW, X1 = w - PAD_R, bw = (X1 - X0) / T, bottom = heightPos(pe, Ed, T) - BELOW;
  txt(ctx, colors, S.posCapTokens, TABLE_X, 14, { font: capFont(colors), fill: colors.ink1, maxW: X1 - TABLE_X });
  const hoverTok = tokenRow(ctx, colors, state, X0, bw, POS.boxTop, POS.boxH, T, pointer);

  const { mh, mid } = posBodies(pe, Ed, T), rH = mh / Ed;
  const panels = [
    { glyph: S.posGlyph.x, cap: S.posCapEmb(T, Ed), rows: emb, h: mh },
    { glyph: pe === "rope" ? S.posGlyph.rope : S.posGlyph.add, cap: pe === "rope" ? S.posCapPos.rope() : S.posCapPos[pe](T, Ed), rows: pos, h: mid, mid: true },
    { glyph: S.posGlyph.final, cap: S.posCapFinal[pe], rows: final, h: mh },
  ];
  let hover = null, hoverDial = null, y = POS.firstCap;
  for (const p of panels) {
    txt(ctx, colors, p.cap, X0, y, { font: capFont(colors), fill: colors.ink1, maxW: X1 - X0 });
    const top = y + POS.capGap;
    txt(ctx, colors, p.glyph, TABLE_X, top + p.h / 2, { font: glyphFont(colors), fill: colors.ink1, baseline: "middle" });
    let matTop = top;
    if (p.mid && pe === "sinusoidal") {
      /* the curves each pair samples: a label line, then sin and cos of position · θ_m; the fastest pair first */
      const P = pairsDrawn(Ed), curveH = POS.curveH - POS.curveLabel;
      for (let m = 0; m < P; m++) {
        const rowTop = top + m * POS.curveH, cy = rowTop + POS.curveLabel + curveH / 2, amp = curveH * 0.42, th = theta(m, Ed);
        txt(ctx, colors, S.posPairLabel(m, th), X0 + 2, rowTop + 9, { fill: colors.ink3, maxW: X1 - X0 - 44 });
        line(ctx, X0, cy, X1, cy, colors.grid);
        for (const [fn, col] of [[Math.sin, colors.groupA], [Math.cos, colors.groupB]]) {
          ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath();
          for (let k = 0; k <= 240; k++) { const q = (k / 240) * (T - 1), x = X0 + (q + 0.5) * bw, yy = cy - amp * fn(q * th); if (k === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
          ctx.stroke(); ctx.restore();
          for (let i = 0; i < upto; i++) dot(ctx, X0 + (i + 0.5) * bw, cy - amp * fn(i * th), 2.6, col);
        }
      }
      txt(ctx, colors, "sin", X1 - 34, top + 9, { fill: colors.groupA, halo: true }); txt(ctx, colors, "cos", X1 - 14, top + 9, { fill: colors.groupB, halo: true });
      matTop = top + POS.curveH * P;
    } else if (p.mid && pe === "rope") {
      const r = dialR(T), cy = top + r + 4;
      for (let i = 0; i < upto; i++) {
        turnDial(ctx, colors, X0 + (i + 0.5) * bw, cy, r, emb[i][0], emb[i][1], i * theta(0, Ed));
        if (pointer && Math.hypot(pointer.x - X0 - (i + 0.5) * bw, pointer.y - cy) <= Math.max(r, bw / 2)) hoverDial = { i, cx: X0 + (i + 0.5) * bw, cy, r };
      }
    }
    if (p.rows) {
      for (let i = 0; i < upto; i++) for (let e = 0; e < Ed; e++) rect(ctx, X0 + i * bw + 1, matTop + e * rH, bw - 1, Math.ceil(rH), signed(colors, p.rows[i][e], 3));
      rect(ctx, X0, matTop, T * bw, Ed * rH, null, colors.grid);
      if (pointer && pointer.x >= X0 && pointer.x < X0 + T * bw && pointer.y >= matTop && pointer.y < matTop + Ed * rH) {
        const i = Math.floor((pointer.x - X0) / bw), e = Math.floor((pointer.y - matTop) / rH);
        if (i < upto) hover = { i, e, x: X0 + (i + 0.5) * bw, y: matTop + e * rH };
      }
    }
    y = top + p.h + POS.panelGap;
  }
  if (hoverDial) {
    /* the magnifier: the hovered token's turn drawn large, with its numbers, over the panel above */
    const { i, cx, cy, r } = hoverDial, R = POS.magR, turn = i * theta(0, Ed);
    const mx = Math.max(X0 + R + 4, Math.min(X1 - R - 150, cx)), my = cy - r - R - 14;
    dot(ctx, cx, cy, r + 2, "transparent", colors.highlight, 1.5);
    rect(ctx, mx - R - 6, my - R - 6, 2 * R + 12 + 150, 2 * R + 12, colors.surface, colors.grid);
    turnDial(ctx, colors, mx, my, R, emb[i][0], emb[i][1], turn);
    const lines = S.posMag(tokens[i], i, turn, emb[i][0], emb[i][1], final[i][0], final[i][1]);
    lines.forEach((ln, k) => txt(ctx, colors, ln, mx + R + 10, my - 18 + k * 15, { fill: k === 0 ? colors.ink1 : colors.ink2, font: k === 0 ? `600 ${colors.fsXs} ${colors.font}` : null }));
  } else if (hover) {
    const { i, e, x, y: hy } = hover, left = x > w * 0.6;
    const str = pe === "rope" ? S.posHover.rope(tokens[i], e, emb[i][e], final[i][e]) : S.posHover.add(tokens[i], e, emb[i][e], pos[i][e], final[i][e]);
    txt(ctx, colors, str, left ? x - 8 : x + 8, hy - 6, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  } else if (hoverTok != null) {
    const x = X0 + (hoverTok + 0.5) * bw, left = x > w * 0.6;
    txt(ctx, colors, S.tokHover(tokens[hoverTok], state.names[hoverTok], state.ids[hoverTok]), left ? x - 8 : x + 8, POS.boxTop - 16, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  }
  const shown = shownStep(anim);
  txt(ctx, colors, shown <= 0 ? S.posStart : (pe === "rope" ? S.posStatus.rope : S.posStatus.add)(shown, tokens[shown - 1]), TABLE_X, bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}`, maxW: X1 - TABLE_X });
  txt(ctx, colors, S.posNote[pe], TABLE_X, bottom + 28, { fill: colors.ink3, maxW: X1 - TABLE_X });
}

/* ================================================================ widget */

defineWidget({
  slug: "embedding-space",
  status: "draft",
  title: "Deep Learning - Embedding Space",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page, vocab, encoding, posenc, E }) => (page === "tokenize" ? tokLayout(vocab).height : page === "position" ? heightPos(posenc, Number(E), M.PAD_TO[vocab]) : encoding === "onehot" ? oneHotLayout(vocab).height : HEIGHT),
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
    lookSec: { type: "section", label: S.lookSection, afterDrive: true, when: ON_EMBEDDING },
    view: {
      type: "segmented", label: S.viewLabel, detail: S.viewDetail,
      options: [{ value: "values", label: "Values" }, { value: "change", label: "Change since start" }], default: "values", display: true, afterDrive: true, when: ON_EMBEDDING,
    },
    /* authoring escape hatch, first render only: presses already taken on the stage it opens with */
    shown: { type: "int", min: 0, max: 64, default: 0, hidden: true },
  },

  /* colour by role only where the geometry is the subject: the Encode page */
  legend: ({ params }) => (params.page === "encode" ? S.legend[params.vocab] ?? [] : []),

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
    renderCard(params);
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
