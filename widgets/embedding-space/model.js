/* ============================================================================
   Widget 74 · Embedding Space — the arithmetic, and nothing that draws.

   PHM5005 07-1 cell 3's "Vector space" panel, over 07-3's amino-acid
   vocabulary (cells 101–105) and the genetic code. One-hot puts every pair of
   tokens at the same distance; an embedding trained on a task learns a
   geometry in which the tokens the task treats alike become neighbours. For
   DNA's four tokens the picture is four points (measured: A lands near G
   and C near T under a purine · pyrimidine pattern), so the vocabularies
   run from there to the sixty-one sense codons, the twenty amino acids in
   four roles, and a clinical one of forty words.
   `_lab/embedding-space-measure.mjs` and `-align-measure.mjs` measured every
   number a comment here quotes (2026-09-21); `_lab/embedding-space-mock.html`
   drew them.

   THE TASKS. Amino acids: class 1 carries hydrophobic · hydrophobic ·
   positive · negative somewhere, each slot a RANDOM residue of that role, so
   no single letter is the cue and the table can only learn the roles. Codons:
   class 1 carries L · R · S, each written as a random one of its synonymous
   codons. Both on 73's engine: Embedding → Conv1d → ReLU → global max →
   Linear, E = 8 by default, 40 epochs of 300 fresh sequences (0.8 s).

   THE PICTURE IS A PROJECTION. E = 2 and 4 do not learn the four-role task,
   so the rows are drawn on their top two principal components — EACH
   EPOCH'S OWN, laid over the final epoch's frame by the orthogonal map that
   fits best. Measured: a PCA recomputed per epoch reflects and spins (four
   reflections in forty frames on one seed, the whole cloud flipping); this
   holds it still with every frame that epoch's best two-dimensional view,
   and the end is known at the start because compute() trains every epoch
   before the first is drawn. For the codons the axes come from the eighteen
   rows the task rewards: on the axes of all sixty-one the eighteen read 44%
   pure in two dimensions, on their own 100% — the forty-three noise rows
   otherwise choose the axes.

   THE START IS NOISE. At epoch 0 the rows are N(0, 1), as `nn.Embedding`
   initialises them: twenty equidistant points cannot be drawn in two
   dimensions, and a one-hot code is drawable only as a distance matrix.

   THE REST MOVE TOO. Every sense codon is in the background, so every row
   gets a gradient: the forty-three unrewarded rows move about as far as the
   eighteen (1.50 against 2.01 in eight dimensions) and land nowhere — their
   nearest neighbours stay at chance. The caption says the task gives a
   geometry only to the tokens it rewards, never that the rest stay put.
   ========================================================================= */

import { makeRng } from "../core/index.js";
import * as E from "../signal-cnn-lstm/engine.js";

export const EPOCHS = 40;
export const SIZES = [4, 8, 16];

/* ------------------------------------------------------- the vocabularies */

export const AA = "AVLIMFWYSTNQCGPKRHDE"; // PAD = 0, tokens 1..20
export const ROLES = ["hydrophobic", "polar", "positive", "negative"];
const ROLE_OF = {};
for (const c of "AVLIMFWY") ROLE_OF[c] = "hydrophobic";
for (const c of "STNQCGP") ROLE_OF[c] = "polar";
for (const c of "KRH") ROLE_OF[c] = "positive";
for (const c of "DE") ROLE_OF[c] = "negative";
export const roleOf = (c) => ROLE_OF[c];
export const NAMES = {
  A: "alanine", V: "valine", L: "leucine", I: "isoleucine", M: "methionine", F: "phenylalanine", W: "tryptophan", Y: "tyrosine",
  S: "serine", T: "threonine", N: "asparagine", Q: "glutamine", C: "cysteine", G: "glycine", P: "proline",
  K: "lysine", R: "arginine", H: "histidine", D: "aspartate", E: "glutamate",
};
const aaTok = (c) => AA.indexOf(c) + 1;

/* THE FOUR BASES, on his ask (2026-09-21) for continuity with the sequence
   widget: four points, but measured to land as two pairs — A near G and C
   near T — under a purine · purine · pyrimidine · pyrimidine pattern. */
export const DNA = "ACGT"; // PAD = 0, tokens 1..4
export const BASE_NAMES = { A: "adenine", C: "cytosine", G: "guanine", T: "thymine" };
export const baseClass = (c) => ("AG".includes(c) ? "purine" : "pyrimidine");

const BASES = "TCAG";
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"; // TCAG order
export const CODONS = [], AA_OF = {};
for (let i = 0; i < 64; i++) { const c = BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3]; CODONS.push(c); AA_OF[c] = CODE[i]; }
const codonTok = (c) => CODONS.indexOf(c) + 1;
export const SENSE = CODONS.filter((c) => AA_OF[c] !== "*"); // 61
export const MOTIF = ["L", "R", "S"];
const synonyms = (aa) => CODONS.filter((c) => AA_OF[c] === aa);

/* A CLINICAL VOCABULARY, the plain-language page (his ask, 2026-09-21): the
   same stage over words, so the space is seen first on tokens everyone
   reads. Four roles of eight words, and eight fillers the task never
   rewards — they take the codon page's part, tokens that move and land
   nowhere. The sentence is 08-1's own ("the patient was treated with
   aspirin for chest pain"), as roles: an action, a drug, a symptom, a site. */
export const WORD_ROLES = {
  action: ["admitted", "treated", "discharged", "examined", "referred", "monitored", "reviewed", "prescribed"],
  drug: ["aspirin", "metformin", "insulin", "warfarin", "statin", "morphine", "antibiotic", "steroid"],
  symptom: ["pain", "fever", "cough", "nausea", "fatigue", "dyspnoea", "dizziness", "rash"],
  site: ["chest", "head", "abdomen", "knee", "back", "throat", "skin", "leg"],
};
export const FILLERS = ["the", "patient", "was", "with", "for", "and", "on", "then"];
export const WORDS = [...Object.values(WORD_ROLES).flat(), ...FILLERS]; // 40, tokens 1..40
const WORD_ROLE = {};
for (const [role, list] of Object.entries(WORD_ROLES)) for (const w of list) WORD_ROLE[w] = role;
export const wordRole = (w) => WORD_ROLE[w] ?? "filler";

/* ---------------------------------------------------------------- tasks */

/**
 * A role pattern written in random members: class 1 carries `pattern` (a
 * role a slot) somewhere, each slot a random token of that role, so no
 * single token is the cue and the table can only learn the roles; class 0
 * carries the pattern nowhere. `tokens` is the alphabet drawn uniformly,
 * `roleOf` names a token's role, `tok` its id.
 */
function roleTask({ tokens, roleOf, tok, pattern, L }) {
  const pools = {}; for (const r of pattern) pools[r] = tokens.filter((t) => roleOf(t) === r);
  const hasPattern = (s) => { for (let i = 0; i + pattern.length <= s.length; i++) if (pattern.every((r, j) => roleOf(s[i + j]) === r)) return true; return false; };
  return (rng, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = i % 2;
      let s;
      do { s = Array.from({ length: L }, () => tokens[Math.floor(rng.next() * tokens.length)]); } while (hasPattern(s));
      if (y) { const at = Math.floor(rng.next() * (L - pattern.length)); pattern.forEach((r, j) => { const pool = pools[r]; s[at + j] = pool[Math.floor(rng.next() * pool.length)]; }); }
      out.push({ x: { tok: Int32Array.from(s.map(tok)), L }, y });
    }
    return out;
  };
}
const dnaTask = roleTask({ tokens: [...DNA], roleOf: baseClass, tok: (c) => DNA.indexOf(c) + 1, pattern: ["purine", "purine", "pyrimidine", "pyrimidine"], L: 40 });
const aaTask = roleTask({ tokens: [...AA], roleOf: (c) => ROLE_OF[c], tok: aaTok, pattern: ["hydrophobic", "hydrophobic", "positive", "negative"], L: 60 });
const wordTask = roleTask({ tokens: WORDS, roleOf: wordRole, tok: (w) => WORDS.indexOf(w) + 1, pattern: ["action", "drug", "symptom", "site"], L: 16 });

function codonTask(rng, n, L = 30) {
  const hasMotif = (aas) => { for (let i = 0; i + 3 <= aas.length; i++) if (MOTIF.every((a, j) => aas[i + j] === a)) return true; return false; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let s;
    do { s = Array.from({ length: L }, () => SENSE[Math.floor(rng.next() * SENSE.length)]); } while (hasMotif(s.map((c) => AA_OF[c])));
    if (y) { const at = Math.floor(rng.next() * (L - 3)); MOTIF.forEach((a, j) => { const pool = synonyms(a); s[at + j] = pool[Math.floor(rng.next() * pool.length)]; }); }
    out.push({ x: { tok: Int32Array.from(s.map(codonTok)), L }, y });
  }
  return out;
}

/* ------------------------------------------------------------ the pages */

/** what a page is: its vocabulary, its task, and which rows the picture is about */
export const PAGES = {
  dna: {
    V: 5, k: 4, task: dnaTask,
    tokens: [...DNA], ids: [1, 2, 3, 4],
    group: (i) => baseClass(DNA[i]),
    scored: [0, 1, 2, 3],
    chance: 1 / 3, // one base of the same class among three others
  },
  words: {
    V: 42, k: 4, task: wordTask, // PAD, the forty, and <unk> for the Tokenize page
    tokens: WORDS, ids: WORDS.map((_, i) => i + 1),
    group: (i) => wordRole(WORDS[i]),
    /* the rows that get a geometry: the thirty-two role words; the fillers are the rest */
    scored: WORDS.map((w, i) => (WORD_ROLE[w] ? i : -1)).filter((i) => i >= 0),
    chance: 7 / 31, // seven of the same role among the thirty-one other role words
  },
  aa: {
    V: 21, k: 4, task: aaTask,
    tokens: [...AA], ids: [...AA].map(aaTok),
    group: (i) => ROLE_OF[AA[i]],
    /* the rows that get a geometry: all twenty; the axes come from them */
    scored: [...AA].map((_, i) => i),
    chance: 0.28, // the mean over residues of (role size − 1) / 19, measured
  },
  codon: {
    V: 65, k: 3, task: codonTask,
    tokens: SENSE, ids: SENSE.map(codonTok),
    group: (i) => AA_OF[SENSE[i]],
    scored: SENSE.map((c, i) => (MOTIF.includes(AA_OF[c]) ? i : -1)).filter((i) => i >= 0), // the motif's eighteen
    chance: 5 / 17, // among the eighteen: five synonyms of seventeen others
  },
};

/* ------------------------------------------------------------ geometry */

const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };

/** nearest-neighbour purity (the neighbour, sought among `among`, shares the group) and the within/between distance ratio, over `idx` rows of R */
export function geometry(R, idx, group, among = idx) {
  const n = idx.length; let win = [], btw = [], pure = 0;
  for (const i of idx) {
    let best = Infinity, bj = -1;
    for (const j of among) { if (i === j) continue; const d = dist(R[i], R[j]); (group(i) === group(j) ? win : btw).push(d); if (d < best) { best = d; bj = j; } }
    if (group(bj) === group(i)) pure++;
  }
  return { purity: pure / n, ratio: btw.length && win.length ? mean(win) / mean(btw) : 1 };
}

/** the top two unit components of the centred rows `idx` of R, by the power method with deflation */
function basis(R, idx) {
  const rows = idx.map((i) => R[i]), Ed = rows[0].length;
  const mu = Array.from({ length: Ed }, (_, e) => mean(rows.map((r) => r[e])));
  let Xr = rows.map((r) => r.map((v, e) => v - mu[e]));
  const B = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: Ed }, (_, e) => Math.sin(e + 1 + c));
    for (let it = 0; it < 300; it++) {
      const w = new Array(Ed).fill(0);
      for (const r of Xr) { let s = 0; for (let e = 0; e < Ed; e++) s += r[e] * v[e]; for (let e = 0; e < Ed; e++) w[e] += s * r[e]; }
      const nrm = Math.sqrt(w.reduce((p, q) => p + q * q, 0)) || 1; v = w.map((q) => q / nrm);
    }
    Xr = Xr.map((r) => { let s = 0; for (let e = 0; e < Ed; e++) s += r[e] * v[e]; return r.map((q, e) => q - s * v[e]); });
    B.push(v);
  }
  return { mu, B };
}
const project = (R, { mu, B }) => R.map((r) => B.map((v) => { let s = 0; for (let e = 0; e < r.length; e++) s += (r[e] - mu[e]) * v[e]; return s; }));

/** the orthogonal 2-D map (a rotation, or a reflection and a rotation) laying P over A, fitted on the rows `idx` */
function procrustes(P, A, idx) {
  let best = null;
  for (const refl of [1, -1]) {
    let sc = 0, ss = 0;
    for (const i of idx) { const [ax, ay] = A[i], bx = P[i][0], by = refl * P[i][1]; sc += ax * bx + ay * by; ss += ay * bx - ax * by; }
    const th = Math.atan2(ss, sc), c = Math.cos(th), s = Math.sin(th);
    const R = P.map(([x, y0]) => { const y = refl * y0; return [c * x - s * y, s * x + c * y]; });
    let resid = 0; for (const i of idx) resid += (R[i][0] - A[i][0]) ** 2 + (R[i][1] - A[i][1]) ** 2;
    if (!best || resid < best.resid) best = { R, resid };
  }
  return best.R;
}

/* ------------------------------------------------------------- training */

const rowsOf = (emb, ids) => ids.map((id) => Array.from(emb.W.v.slice(id * emb.E, (id + 1) * emb.E)));

/**
 * The whole run for one page: the table after every epoch (rows in the page's
 * token order), the held-out accuracy after every epoch, the geometry in E
 * dimensions and in the picture, and the picture's frames — each epoch's own
 * two components laid over the final epoch's. Seeds derive from `seed`, so a
 * cache hit and a miss consume nothing differently downstream.
 */
export function trainPage(pageKey, Edim, seed, { onehot = false } = {}) {
  const P = PAGES[pageKey];
  /* ONE-HOT (07-1 cell 3's first encoding, his ask 2026-09-21): the table is
     the identity, fixed — row v has a 1 in column v, the PAD row is zero —
     so the network reads V channels and the table holds no parameters.
     Measured: it learns these tasks as well as the embedding (100%); what
     it cannot do is put two tokens nearer than any other two. */
  const rows = onehot ? Array.from({ length: P.V }, (_, v) => Array.from({ length: P.V }, (_, e) => (e === v && v > 0 ? 1 : 0))) : null;
  const emb = E.Embedding(makeRng(seed * 11 + 1), P.V, onehot ? P.V : Edim, 0, rows);
  const net = E.Sequential([emb, E.Conv1d(makeRng(seed * 11 + 2), emb.E, 8, P.k, 1, 0, true), E.ReLU(), E.GlobalPool(8, "max"), E.Linear(makeRng(seed * 11 + 3), 8, 2)]);
  const test = P.task(makeRng(seed * 11 + 5), 300);
  const accs = [null];
  if (onehot) {
    E.train(makeRng(seed * 11 + 7), net, (e) => P.task(makeRng(seed * 1000 + e + 13), 300), { epochs: EPOCHS, lr: 1e-2, onEpoch: () => accs.push(E.accuracy(net, test)) });
    const params = net.params.reduce((p, q) => p + q.v.length, 0);
    return { page: pageKey, onehot: true, V: P.V, E: P.V, seed, accs, params, epochs: EPOCHS, steps: EPOCHS };
  }
  const tables = [rowsOf(emb, P.ids)];
  E.train(makeRng(seed * 11 + 7), net, (e) => P.task(makeRng(seed * 1000 + e + 13), 300), {
    epochs: EPOCHS, lr: 1e-2,
    onEpoch: () => { tables.push(rowsOf(emb, P.ids)); accs.push(E.accuracy(net, test)); },
  });
  const params = net.params.reduce((p, q) => p + q.v.length, 0);

  const all = P.tokens.map((_, i) => i);
  const own = tables.map((R) => project(R, basis(R, P.scored)));
  const final = own[own.length - 1];
  const frames = own.map((Q) => procrustes(Q, final, P.scored));
  const geo = tables.map((R) => geometry(R, P.scored, P.group));
  const geo2 = frames.map((F) => geometry(F, P.scored, P.group));
  /* the codon and word pages report the unrewarded rows as well, their neighbours sought among EVERY row:
     among themselves the fillers would be trivially pure, being one group */
  const rest = all.filter((i) => !P.scored.includes(i));
  const geoRest = rest.length ? tables.map((R) => geometry(R, rest, P.group, all)) : null;

  /* the axes for the picture: the cloud's radius stays under 2.5 over training (measured), so ±3 holds every frame */
  let radius = 0; for (const F of frames) for (const i of P.scored) radius = Math.max(radius, Math.hypot(F[i][0], F[i][1]));
  const lim = Math.max(3, Math.ceil(radius * 1.05 * 2) / 2);

  return { page: pageKey, E: Edim, seed, tables, accs, frames, geo, geo2, geoRest, lim, params, epochs: EPOCHS, steps: EPOCHS };
}

/* ------------------------------------------------------ the Tokenize page */

/* TOKENIZATION (his ask, 2026-09-21; 08-3 cell 2 §1, 07-1 cell 3): the step
   before the table. One raw sequence a vocabulary, cut into tokens the way
   the lesson names — character by character for bases and residues, 3-mers
   for codons (the same DNA string as the base page, 46 long so a base is
   left over and dropped), words for the sentence, with the lesson's two
   special tokens: a word outside the forty becomes <unk>, and the sentence
   is padded to sixteen with <pad>. Each token's id is the row it picks in
   the table, which the Encode and Position pages read. */
export const PAD = "<pad>", UNK = "<unk>";
export const SENTENCE = "the patient was admitted with chest pain and treated with ibuprofen then discharged";
export const PAD_TO = 16;

export function tokenizePage(vocab, seed) {
  const P = PAGES[vocab], rng = makeRng(seed * 11 + 21);
  let raw, tokens, ids, dropped = "", padded = 0, how, names;
  if (vocab === "dna" || vocab === "codon") {
    raw = Array.from({ length: 46 }, () => DNA[Math.floor(rng.next() * 4)]).join("");
    if (vocab === "dna") { tokens = [...raw]; ids = tokens.map((c) => DNA.indexOf(c) + 1); how = "base"; names = tokens.map((c) => BASE_NAMES[c]); }
    else {
      const n = Math.floor(raw.length / 3);
      tokens = Array.from({ length: n }, (_, i) => raw.slice(3 * i, 3 * i + 3)); ids = tokens.map((c) => CODONS.indexOf(c) + 1); dropped = raw.slice(3 * n); how = "codon";
      names = tokens.map((c) => (AA_OF[c] === "*" ? "stop" : `${NAMES[AA_OF[c]]} (${AA_OF[c]})`));
    }
  } else if (vocab === "aa") {
    raw = Array.from({ length: 24 }, () => AA[Math.floor(rng.next() * 20)]).join("");
    tokens = [...raw]; ids = tokens.map((c) => AA.indexOf(c) + 1); how = "residue"; names = tokens.map((c) => `${NAMES[c]} · ${ROLE_OF[c]}`);
  } else {
    raw = SENTENCE;
    tokens = SENTENCE.split(" ").map((w) => (WORDS.includes(w) ? w : UNK));
    ids = tokens.map((w) => (w === UNK ? WORDS.length + 1 : WORDS.indexOf(w) + 1));
    while (tokens.length < PAD_TO) { tokens.push(PAD); ids.push(0); padded++; }
    how = "word"; names = tokens.map((w) => (w === UNK ? "a word outside the vocabulary" : w === PAD ? "padding" : wordRole(w)));
  }
  return { page: "tokenize", vocab, seed, raw, tokens, ids, names, dropped, padded, how, V: P.V, steps: tokens.length };
}

/* ------------------------------------------------------ the Position page */

/* POSITION (08-1 cell 1 §2, 08-3 cell 4 §2), on his word of 2026-09-21: no
   attention, no training — the tokenised sequence's embedding rows, the
   position rows, and their sum, x̃ᵢ = xᵢ + pᵢ. The embedding is the table
   the Encode page trained for this vocabulary and seed (cached there), so
   what the reader saw learned is what position is added to. Learned rows
   are `nn.Embedding(L, E)` as initialised, N(0, 1) — in a transformer they
   train with the rest; the sinusoid is the lesson's formula at d = E; the
   rotation adds nothing and turns each pair of a row by pos · θ_m instead,
   so its "final" is the rotated row and the caption says so. */
/** `run` is the Encode page's trained run for this vocabulary, E and seed, handed over from its cache */
export function positionPage(vocab, Edim, seed, pe, run) {
  const tok = tokenizePage(vocab, seed);
  const P = PAGES[vocab], L = tok.tokens.length, table = run.tables[EPOCHS];
  const rowOf = (id) => (id === 0 ? new Array(Edim).fill(0) : table[P.ids.indexOf(id)] ?? new Array(Edim).fill(0)); // PAD and <unk> have no trained row: zeros
  const emb = tok.ids.map(rowOf);
  let pos = null, final;
  if (pe === "rope") {
    final = emb.map((r, i) => Array.from(E.rope(Float64Array.from(r), i, Edim)));
  } else {
    const rng = makeRng(seed * 11 + 31);
    pos = pe === "learned" ? Array.from({ length: L }, () => Array.from({ length: Edim }, () => rng.normal(0, 1))) : E.sinusoid(L, Edim).map((r) => Array.from(r));
    final = emb.map((r, i) => r.map((v, e) => v + pos[i][e]));
  }
  return { page: "position", vocab, E: Edim, seed, pe, tokens: tok.tokens, ids: tok.ids, names: tok.names, how: tok.how, emb, pos, final, steps: L };
}
