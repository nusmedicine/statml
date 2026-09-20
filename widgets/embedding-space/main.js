/* ============================================================================
   Widget 74 · Embedding Space — PHM5005 07-1 cell 3's "Vector space" panel,
   and 08-1 cell 1 §2's position encoding.

   A token is a row of a table. Drawn as a point, a trained table is a space,
   and the tokens the task treats alike become neighbours — a geometry nobody
   typed in. Four pages on that stage, in the order he set (2026-09-21): the
   four bases (continuity with the sequence widget; four points, two pairs),
   sixty-one codons with a three-amino-acid motif written in random synonyms,
   twenty amino acids in four roles, and forty clinical words in four roles
   (the plain-language page, his ask, on tokens everyone reads). His figure's
   two panels: the table as a heatmap at the left, the space at the right,
   both moving as the table trains, from the N(0, 1) rows `nn.Embedding`
   starts with.

   A FIFTH PAGE, POSITION, for the language lessons: the same clinical words
   through one attention head, with nothing, a learned table, the sinusoid
   or a rotation telling it where a token sits. The lesson's own example is
   the task — aspirin before pain, or after — and the head with no position
   sits at chance on it (measured; model.js has the numbers). The stage is
   again two panels: the position table at the left (what is added), the
   attention scores of one held-out sequence at the right (what it changes),
   and a Positions control that moves the same words along by the whole
   length, which leaves the rotation's scores alone and breaks the others.

   THE PRESS IS AN EPOCH. compute() trains all forty epochs on the click
   (about a second) and records the table after each; Step moves the points
   from one epoch's frame to the next, Play runs the forty. Nothing is
   computed per frame: the tween interpolates two recorded frames
   (invariant 2).

   THE FRAME IS HELD STILL. Each epoch's own two components would reflect and
   spin from frame to frame (measured, `_lab/embedding-space-align-measure.mjs`);
   model.js lays every frame over the final epoch's by the orthogonal map
   that fits best. The picture is a projection and says so: purity in two
   dimensions beside purity in E, on the figure and in the readout.

   Colour is the TRUE role or amino acid, which nobody typed in; the position
   is what training put there (colour carries the truth, never the finding).
   The accuracy-by-epoch track under the panels was drawn and cut on his
   word (clutter, 2026-09-21); the epoch line carries the number.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import * as M from "./model.js";

const PAGES = [
  { value: "dna", label: "DNA" }, { value: "codon", label: "Codons" }, { value: "aa", label: "Amino acids" }, { value: "words", label: "Words" },
  { value: "position", label: "Position" },
];
const ENCODINGS = [{ value: "none", label: "None" }, { value: "learned", label: "Learned" }, { value: "sinusoidal", label: "Sinusoidal" }, { value: "rope", label: "Rotary" }];
const STEP_MS = 420;   // one epoch's move on Step
const RUN_MS = 240;    // one epoch's move under Play: forty in under ten seconds
const HEIGHT = 384;
const ON = (page) => ({ param: "page", equals: page });
const ON_TABLES = { param: "page", oneOf: ["dna", "codon", "aa", "words"] };

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A token is a row of a table, and a trained table is a space: tokens the task treats alike become neighbours, a geometry nobody typed in. " +
    "Four bases, sixty-one codons, twenty amino acids, forty clinical words; the rows drawn as points that move as the table trains. " +
    "Then position: what an attention head is told about where a token sits, and what a shift does to it.",
  pageLabel: "Page",
  dataSection: "The table",
  eLabel: "Embedding size E",
  eDetail: "how many numbers a token's row holds; the picture projects them to two",
  seedLabel: "Seed",
  seedDetail: "the starting rows and the training sequences, reproducibly",
  posSection: "The head",
  encodingLabel: "Encoding",
  encodingDetail: "what tells the head where a token sits: nothing, a table trained with the rest, the fixed sine and cosine table, or a rotation of q and k by the position",
  lookSection: "Look at",
  shiftLabel: "Positions",
  shiftDetail: "the same sixteen words at positions 0 to 15, or moved along to 16 to 31; the trained head is read, not retrained",

  stepLabel: "Train one",
  stepTitle: "Train one epoch of 300 sequences and move each row to where it leaves it",
  runLabel: "Play",
  runTitle: "Train the remaining epochs in turn",

  legend: {
    dna: [
      { token: "cluster-a", label: "Purine · A G", mark: "dot" },
      { token: "cluster-b", label: "Pyrimidine · C T", mark: "dot" },
    ],
    words: [
      { token: "cluster-a", label: "Action · admitted, treated, discharged …", mark: "dot" },
      { token: "cluster-b", label: "Drug · aspirin, metformin, insulin …", mark: "dot" },
      { token: "cluster-c", label: "Symptom · pain, fever, cough …", mark: "dot" },
      { token: "cluster-d", label: "Site · chest, head, abdomen …", mark: "dot" },
      { token: "ink-3", label: "Fillers · the, patient, was, with …, which the task never rewards", mark: "dot" },
    ],
    aa: [
      { token: "cluster-a", label: "Hydrophobic · A V L I M F W Y", mark: "dot" },
      { token: "cluster-b", label: "Polar · S T N Q C G P", mark: "dot" },
      { token: "cluster-c", label: "Positive · K R H", mark: "dot" },
      { token: "cluster-d", label: "Negative · D E", mark: "dot" },
    ],
    codon: [
      { token: "cluster-a", label: "Leucine (L) · six codons", mark: "dot" },
      { token: "cluster-b", label: "Arginine (R) · six codons", mark: "dot" },
      { token: "cluster-c", label: "Serine (S) · six codons", mark: "dot" },
      { token: "ink-3", label: "The other 43 codons, which the task never rewards", mark: "dot" },
    ],
    position: [
      { token: "group-a", label: "aspirin · first in class 1", mark: "dot" },
      { token: "group-b", label: "pain · second in class 1", mark: "dot" },
    ],
  },

  capTable: (V, E) => `the table · Embedding(${V}, ${E}) · one row a token`,
  capSpace: {
    dna: "the space · each row on the table's top two components",
    words: "the space · the axes from the thirty-two role words",
    aa: "the space · each row on the table's top two components",
    codon: "the space · the axes from the eighteen rewarded rows",
  },
  capStart: "epoch 0 · the rows as initialised, N(0, 1)",
  capEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}%`,
  capDrawn: (p2, p, E) => `purity drawn ${Math.round(100 * p2)}% · in ${E}-D ${Math.round(100 * p)}%`,
  capTask: {
    dna: "class 1 carries purine · purine · pyrimidine · pyrimidine, each a random base of that class",
    words: "class 1 carries action · drug · symptom · site, each a random word of that role",
    aa: "class 1 carries hydrophobic · hydrophobic · positive · negative, each a random residue of that role",
    codon: "class 1 carries L · R · S, each a random one of its six codons",
    position: "class 1 has aspirin before pain, class 0 the reverse; both words in every sequence of sixteen",
  },

  /* the Position page */
  capPos: {
    none: "no position · the token rows alone",
    learned: (Lmax, D) => `position table · Embedding(${Lmax}, ${D}), trained`,
    sinusoidal: (Lmax, D) => `position table · sin and cos [${Lmax}, ${D}], fixed`,
    rope: "rotary · q and k turned by the position",
  },
  capPosNone: "nothing is added to a token's row, so the head has no way to tell which came first",
  capPosRope: (m, th) => `pair ${m} · ${th} rad a position`,
  capScores: (lo, hi) => `scores q·k/√dk · one held-out sequence at positions ${lo} to ${hi}`,
  capPosStart: "epoch 0 · the head as initialised",
  capPosEpoch: (e, n, acc, accS) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}% · at the shifted positions ${Math.round(100 * accS)}%`,
  hoverScore: (a, b, v) => `${a} → ${b} · ${v.toFixed(2)}`,
  hoverTable: (p, d, v) => `position ${p} · dimension ${d} · ${v.toFixed(2)}`,

  tileAcc: "Held-out accuracy",
  tileAccNote: "300 sequences outside the training set, after the epochs trained so far",
  tileAccNotePos: "200 sequences outside the training set, at the positions trained on",
  tileWait: "—",
  tiles: {
    dna: {
      main: "Class purity", mainNote: (E) => `bases whose nearest row in ${E}-D is of their class, purine or pyrimidine; chance 33%`,
      rest: "Within / between", restNote: "mean distance within a class over mean distance between classes; 1 is no structure",
    },
    words: {
      main: "Role purity", mainNote: (E) => `role words whose nearest row in ${E}-D shares their role; chance 23%`,
      rest: "Purity, the fillers", restNote: "fillers whose nearest of all forty rows is a filler; the task treats them alike, and alike is a role too",
    },
    aa: {
      main: "Role purity", mainNote: (E) => `tokens whose nearest row in ${E}-D shares their role; chance 28%`,
      rest: "Within / between", restNote: "mean distance within a role over mean distance between roles; 1 is no structure",
    },
    codon: {
      main: "Purity, the eighteen", mainNote: (E) => `motif codons whose nearest of the eighteen in ${E}-D is a synonym; chance 29%`,
      rest: "Purity, the other 43", restNote: "codons whose nearest of all sixty-one rows is a synonym; they move too, and at chance they have landed nowhere",
    },
  },
  tileShift: "At the shifted positions",
  tileShiftNote: "the same sequences with every position moved along by sixteen; the trained head read, not retrained",
  tilePresence: "Presence, no position",
  tilePresenceNote: "the same head with no position on a presence task, aspirin in or out: it learns, so the failure is order",
  tileParams: "Parameters",
  tileParamsNote: {
    learned: "the position table adds 32 × 16 = 512 to the head's 1,202",
    sinusoidal: "the fixed table adds none",
    rope: "the rotation adds none",
  },

  hover: {
    dna: (c) => `${c} · ${M.BASE_NAMES[c]} · ${M.baseClass(c)}`,
    words: (t) => `${t} · ${M.wordRole(t)}`,
    aa: (c) => `${c} · ${M.NAMES[c]} · ${M.roleOf(c)}`,
    codon: (c) => `${c} · ${M.NAMES[M.AA_OF[c]] ?? M.AA_OF[c]} (${M.AA_OF[c]})`,
  },

  sum: (page, e, n) => `${{ dna: "four bases", words: "forty clinical words", aa: "twenty amino acids", codon: "sixty-one codons" }[page]} as rows of an embedding table and as points; ${e === 0 ? "the rows as initialised" : e < n ? `${e} of ${n} epochs trained` : "all epochs trained"}`,
  sumPos: (pe, e, n) => `one attention head over sixteen words with ${{ none: "no position", learned: "a learned position table", sinusoidal: "the sinusoidal position table", rope: "a rotary position encoding" }[pe]}; ${e === 0 ? "as initialised" : e < n ? `${e} of ${n} epochs trained` : "all epochs trained"}`,
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

/* the truth's colours: a page's groups in the cluster hues, in the legend's order; a group with no slot is unrewarded */
const SLOTS = {
  dna: { purine: 0, pyrimidine: 1 },
  words: { action: 0, drug: 1, symptom: 2, site: 3 },
  aa: { hydrophobic: 0, polar: 1, positive: 2, negative: 3 },
  codon: { L: 0, R: 1, S: 2 },
};
function colourOf(colors, page, i) {
  const slot = SLOTS[page][M.PAGES[page].group(i)];
  return slot == null ? wash(colors.ink3, 0.55) : colors.clusters[slot];
}

/* ----------------------------------------------------------- the layout */

const PAD_R = 14, TOP = 24, GAP = 26, TABLE_X = 12;
const BELOW = 40;   // under the panels: the epoch line and the task
/** the two panels: the table at the left, the space a square at the right */
function layout(w) {
  const bottom = HEIGHT - BELOW;
  const side = bottom - TOP;
  const spaceX = w - PAD_R - side;
  return { top: TOP, bottom, side, spaceX, tableX: TABLE_X, tableW: spaceX - GAP - TABLE_X };
}

/* ================================================================ compute */

/* Trained runs, cached by the parameters that shape them: a page switch is a
   display change that re-runs compute, and without the cache every visit to
   another page would retrain for a second. */
const cache = new Map();
function compute({ params }) {
  const pos = params.page === "position";
  const key = pos ? ["position", params.encoding, params.seed].join("|") : [params.page, params.E, params.seed].join("|");
  if (cache.has(key)) return cache.get(key);
  const run = pos ? M.trainPosition(params.encoding, params.seed) : M.trainPage(params.page, Number(params.E), params.seed);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(key, run);
  return run;
}

/* ============================================================== animation */

/** the epoch whose numbers are shown: the target once its move has landed, else the one before */
const shownEpoch = (anim) => (anim.t >= 1 ? anim.n[anim.page] : Math.max(0, anim.n[anim.page] - 1));
const isDone = (anim) => anim.n[anim.page] >= M.EPOCHS && anim.t >= 1;

/* ==================================================================== draw */

/* EVERY ROW IS NAMED (his ask, 2026-09-21). Sixty-one codon names at one row
   each would need a table twice the canvas at the smallest face, so the rows
   break into columns — as many as keep a row at ROW_H — read down each
   column in turn; a codon table is three stacks, a word table two. */
const ROW_H = 13;
function drawTable(ctx, colors, L, params, state, anim) {
  const P = M.PAGES[params.page], page = params.page, n = anim.n[page], t = ease(anim.t);
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
    const rewarded = SLOTS[page][P.group(i)] != null;
    txt(ctx, colors, P.tokens[i], x0 + labelW - 4, y + ROW_H / 2, { font: monoFont(colors), fill: rewarded ? colourOf(colors, page, i) : colors.ink3, align: "right", baseline: "middle" });
  }
  for (let c = 0; c < cols; c++) {
    const inCol = Math.min(per, rows - c * per);
    rect(ctx, L.tableX + c * colW + labelW, L.top, E * cellW, inCol * ROW_H, null, colors.grid);
  }
}

/** where row i sits in the picture at this frame, in drawing coordinates */
function pointAt(L, state, anim, i) {
  const n = anim.n[anim.page], t = ease(anim.t);
  const a = state.frames[Math.max(0, n - 1)][i], b = state.frames[n][i];
  const sc = (L.side / 2 - 10) / state.lim, cx = L.spaceX + L.side / 2, cy = L.top + L.side / 2;
  return [cx + lerp(a[0], b[0], t) * sc, cy - lerp(a[1], b[1], t) * sc];
}

function drawSpace(ctx, colors, L, params, state, anim, pointer) {
  const P = M.PAGES[params.page], page = params.page;
  txt(ctx, colors, S.capSpace[page], L.spaceX, 14, { font: capFont(colors), fill: colors.ink1 });
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
    dot(ctx, x, y, main ? (page === "aa" ? 5 : 4.5) : 3, colourOf(colors, page, i));
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
      txt(ctx, colors, S.hover[page](P.tokens[bi]), left ? x - 10 : x + 10, y - 12, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
    }
  }

  const e = shownEpoch(anim);
  const g = state.geo[e], g2 = state.geo2[e];
  txt(ctx, colors, S.capDrawn(g2.purity, g.purity, state.E), L.spaceX + L.side, L.bottom + 14, { fill: colors.ink2, align: "right" });
}

/* ------------------------------------------------------ the Position page */

/** the scores matrix shown at this frame: the chosen positions, tweened between the two recorded epochs */
function scoresAt(state, anim, shift) {
  const n = anim.n.position, t = ease(anim.t), src = shift ? state.scoresShift : state.scores;
  const a = src[Math.max(0, n - 1)], b = src[n];
  return a.map((row, i) => row.map((v, j) => lerp(v, b[i][j], t)));
}

function drawPosition(ctx, colors, w, params, state, anim, pointer) {
  const { L: T, Lmax, D, dk } = M.POS, pe = state.pe, shift = Number(params.shift), n = anim.n.position, t = ease(anim.t);
  const L = layout(w);
  const cs = L.side / T;                       // a score cell
  const scX = L.spaceX, scY = L.top;

  /* the left panel: what the encoding adds */
  ctx.save(); ctx.font = monoFont(colors);
  const wordW = Math.max(...state.words.map((s) => ctx.measureText(s).width)) + 10;
  ctx.restore();
  const tblX = TABLE_X + 26, tblW = scX - wordW - GAP - tblX, cell = Math.max(4, Math.min(12, tblW / D));
  const capLeft = pe === "none" ? S.capPos.none : pe === "rope" ? S.capPos.rope : S.capPos[pe](Lmax, D);
  txt(ctx, colors, capLeft, TABLE_X, 14, { font: capFont(colors), fill: colors.ink1 });
  let tableHover = null;
  if (pe === "learned" || pe === "sinusoidal") {
    const prev = pe === "learned" ? state.tables[Math.max(0, n - 1)] : state.fixed, cur = pe === "learned" ? state.tables[n] : state.fixed;
    for (let r = 0; r < T; r++) {
      const p = shift + r, y = L.top + r * cell * 1.0;
      for (let d = 0; d < D; d++) rect(ctx, tblX + d * cell, y, Math.ceil(cell), Math.ceil(cell), signed(colors, lerp(prev[p][d], cur[p][d], t), 2.5));
      txt(ctx, colors, String(p), tblX - 4, y + cell / 2, { font: monoFont(colors), fill: colors.ink3, align: "right", baseline: "middle" });
    }
    rect(ctx, tblX, L.top, D * cell, T * cell, null, colors.grid);
    if (pointer && pointer.x >= tblX && pointer.x < tblX + D * cell && pointer.y >= L.top && pointer.y < L.top + T * cell) {
      const d = Math.floor((pointer.x - tblX) / cell), r = Math.floor((pointer.y - L.top) / cell);
      tableHover = [tblX + (d + 0.5) * cell, L.top + r * cell, S.hoverTable(shift + r, d, lerp(prev[shift + r][d], cur[shift + r][d], t))];
    }
  } else if (pe === "rope") {
    const pitch = Math.min(16, tblW / T), rad = pitch * 0.4;
    for (let m = 0; m < dk / 2; m++) {
      const th = Math.pow(10000, -(2 * m) / dk), y = L.top + 30 + m * 46;
      for (let r = 0; r < T; r++) {
        const cx = tblX + (r + 0.5) * pitch, a = (shift + r) * th;
        dot(ctx, cx, y, rad, colors.surface2, colors.grid);
        line(ctx, cx, y, cx + rad * Math.cos(a), y - rad * Math.sin(a), colors.groupA, 1.6);
      }
      txt(ctx, colors, S.capPosRope(m, th >= 0.01 ? String(th) : th.toFixed(3)), tblX, y + rad + 12, { fill: colors.ink3 });
    }
    txt(ctx, colors, `positions ${shift} to ${shift + T - 1}`, tblX, L.top + 8, { fill: colors.ink3 });
  } else {
    rect(ctx, tblX, L.top, D * cell, T * cell, null, colors.grid);
    txt(ctx, colors, S.capPosNone, tblX + 6, L.top + 16, { fill: colors.ink3 });
  }

  /* the right panel: the scores of one held-out sequence, one row a query */
  txt(ctx, colors, S.capScores(shift, shift + T - 1), scX - wordW, 14, { font: capFont(colors), fill: colors.ink1 });
  const Sc = scoresAt(state, anim, shift);
  let mx = 1e-6; for (const row of Sc) for (const v of row) mx = Math.max(mx, Math.abs(v));
  const first = state.words.indexOf(M.POS.first), second = state.words.indexOf(M.POS.second);
  const wordColour = (i) => (i === first ? colors.groupA : i === second ? colors.groupB : colors.ink2);
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < T; j++) rect(ctx, scX + j * cs, scY + i * cs, Math.ceil(cs), Math.ceil(cs), signed(colors, Sc[i][j], mx));
    txt(ctx, colors, state.words[i], scX - 6, scY + (i + 0.5) * cs, { font: monoFont(colors), fill: wordColour(i), align: "right", baseline: "middle" });
  }
  rect(ctx, scX, scY, L.side, L.side, null, colors.grid);
  /* the two words' columns, marked above the matrix */
  for (const [i, col] of [[first, colors.groupA], [second, colors.groupB]]) rect(ctx, scX + i * cs + 2, scY - 5, cs - 4, 3, col);
  if (pointer && pointer.x >= scX && pointer.x < scX + L.side && pointer.y >= scY && pointer.y < scY + L.side) {
    const j = Math.floor((pointer.x - scX) / cs), i = Math.floor((pointer.y - scY) / cs);
    rect(ctx, scX + j * cs, scY + i * cs, cs, cs, null, colors.highlight, 1.5);
    const left = j > T / 2;
    txt(ctx, colors, S.hoverScore(state.words[i], state.words[j], Sc[i][j]), left ? scX + j * cs - 6 : scX + (j + 1) * cs + 6, scY + i * cs - 6, { fill: colors.ink1, align: left ? "right" : "left", halo: true });
  }
  if (tableHover) txt(ctx, colors, tableHover[2], tableHover[0], tableHover[1] - 6, { fill: colors.ink1, halo: true });

  const e = shownEpoch(anim);
  txt(ctx, colors, e === 0 ? S.capPosStart : S.capPosEpoch(e, M.EPOCHS, state.accs[e], state.accsShift[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
  txt(ctx, colors, S.capTask.position, TABLE_X, L.bottom + 28, { fill: colors.ink3 });
}

/* ================================================================ widget */

defineWidget({
  slug: "embedding-space",
  status: "draft",
  title: "Deep Learning - Embedding Space",
  subtitle: S.subtitle,
  layout: "side",
  height: HEIGHT,
  pointer: true,

  params: {
    /* two by two: in one row "Amino acids" truncates at the rail's width */
    page: { type: "segmented", style: "grid", label: S.pageLabel, options: PAGES, default: "dna", display: true },
    dataSec: { type: "section", label: S.dataSection, when: ON_TABLES },
    E: {
      type: "choice", label: S.eLabel, detail: S.eDetail,
      options: M.SIZES.map((e) => ({ value: String(e), label: String(e) })), default: "8", when: ON_TABLES,
    },
    posSec: { type: "section", label: S.posSection, when: ON("position") },
    encoding: { type: "segmented", style: "grid", label: S.encodingLabel, detail: S.encodingDetail, options: ENCODINGS, default: "learned", when: ON("position") },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },
    lookPos: { type: "section", label: S.lookSection, afterDrive: true, when: ON("position") },
    shift: {
      type: "segmented", label: S.shiftLabel, detail: S.shiftDetail,
      options: [{ value: "0", label: "0 to 15" }, { value: "16", label: "16 to 31" }], default: "0", display: true, afterDrive: true, when: ON("position"),
    },
    /* authoring escape hatch, first render only: epochs already trained on the page it opens with */
    shown: { type: "int", min: 0, max: M.EPOCHS, default: 0, hidden: true },
  },

  legend: ({ params }) => S.legend[params.page] ?? S.legend.dna,

  compute,

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, fromScratch }) => {
      const shown = fromScratch ? 0 : Math.max(0, Math.min(M.EPOCHS, Number(params.shown) || 0));
      const anim = { page: params.page, n: { dna: 0, codon: 0, aa: 0, words: 0, position: 0 }, t: 1, moving: false, halt: false };
      anim.n[params.page] = shown;
      anim.done = isDone(anim);
      return anim;
    },

    advance: (anim, { dt }) => {
      /* a press a page switch finished (`rebuild`) ends here, before it takes the new page's press */
      if (anim.halt) { anim.halt = false; anim.moving = false; return false; }
      const page = anim.page, ms = anim.mode === "run" ? RUN_MS : STEP_MS;
      let more;
      if (anim.t < 1) {
        anim.t = Math.min(1, anim.t + dt / ms);
        more = anim.t < 1 || (anim.mode === "run" && anim.n[page] < M.EPOCHS);
      } else if (anim.n[page] < M.EPOCHS) {
        anim.n[page] += 1; anim.t = 0; more = true;
      } else more = false;
      anim.done = isDone(anim);
      anim.moving = more;
      return more;
    },

    rebuild: (anim, { params }) => {
      /* a press belongs to the page it started on: core keeps a running loop
         through a display change, so a switch mid-press would run the other
         page's press (the 2026-09-20 sweep) */
      if (anim.moving && params.page !== anim.page) { anim.t = 1; anim.halt = true; }
      anim.page = params.page;
      anim.done = isDone(anim);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    if (params.page === "position") { drawPosition(ctx, colors, w, params, state, anim, pointer); return; }
    const L = layout(w);
    drawTable(ctx, colors, L, params, state, anim);
    drawSpace(ctx, colors, L, params, state, anim, pointer);
    const e = shownEpoch(anim);
    txt(ctx, colors, e === 0 ? S.capStart : S.capEpoch(e, M.EPOCHS, state.accs[e]), TABLE_X, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
    txt(ctx, colors, S.capTask[params.page], TABLE_X, L.bottom + 28, { fill: colors.ink3 });
  },

  readout({ params, state, anim }) {
    const e = shownEpoch(anim);
    const pct = (v) => `${Math.round(100 * v)}%`;
    if (params.page === "position") {
      const third = state.pe === "none"
        ? { label: S.tilePresence, value: pct(state.presence), note: S.tilePresenceNote }
        : { label: S.tileParams, value: state.params.toLocaleString("en"), note: S.tileParamsNote[state.pe] };
      return [
        { label: S.tileAcc, value: e >= 1 ? pct(state.accs[e]) : S.tileWait, note: S.tileAccNotePos },
        { label: S.tileShift, value: e >= 1 ? pct(state.accsShift[e]) : S.tileWait, note: S.tileShiftNote },
        third,
      ];
    }
    const E = state.E, T = S.tiles[params.page];
    const rest = state.geoRest == null ? state.geo[e].ratio.toFixed(2) : pct(state.geoRest[e].purity);
    return [
      { label: S.tileAcc, value: e >= 1 ? pct(state.accs[e]) : S.tileWait, note: S.tileAccNote },
      { label: T.main, value: pct(state.geo[e].purity), note: T.mainNote(E) },
      { label: T.rest, value: rest, note: T.restNote },
    ];
  },

  summary({ params, state, anim }) {
    return params.page === "position" ? S.sumPos(state.pe, shownEpoch(anim), M.EPOCHS) : S.sum(params.page, shownEpoch(anim), M.EPOCHS);
  },
});
