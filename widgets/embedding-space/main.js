/* ============================================================================
   Widget 74 · Embedding Space — PHM5005 07-1 cell 3's "Vector space" panel.

   A token is a row of a table. Drawn as a point, a trained table is a space,
   and the tokens the task treats alike become neighbours — a geometry nobody
   typed in. Two pages, the same stage: twenty amino acids in four roles, then
   sixty-one codons with a three-amino-acid motif written in random synonyms.
   His figure's two panels (2026-09-21 picks): the table as a heatmap at the
   left, the space at the right, both moving as the table trains, from the
   N(0, 1) rows `nn.Embedding` starts with.

   THE PRESS IS AN EPOCH. compute() trains all forty epochs on the click
   (0.8 s) and records the table after each; Step moves the points from one
   epoch's frame to the next, Play runs the forty. Nothing is computed per
   frame: the tween interpolates two recorded frames (invariant 2).

   THE FRAME IS HELD STILL. Each epoch's own two components would reflect and
   spin from frame to frame (measured, `_lab/embedding-space-align-measure.mjs`);
   model.js lays every frame over the final epoch's by the orthogonal map
   that fits best. The picture is a projection and says so: purity in two
   dimensions beside purity in E, on the figure and in the readout.

   Colour is the TRUE role or amino acid, which nobody typed in; the position
   is what training put there (colour carries the truth, never the finding).
   The Position page for the language lessons follows once these two settle.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import * as M from "./model.js";

const PAGES = [{ value: "aa", label: "Amino acids" }, { value: "codon", label: "Codons" }];
const STEP_MS = 420;   // one epoch's move on Step
const RUN_MS = 240;    // one epoch's move under Play: forty in under ten seconds
const HEIGHT = 444;

/* -------------------------------------------------------------- strings */

const S = {
  subtitle:
    "A token is a row of a table, and a trained table is a space: tokens the task treats alike become neighbours, a geometry nobody typed in. " +
    "Twenty amino acids in four roles, then sixty-one codons; the rows drawn as points that move as the table trains.",
  pageLabel: "Page",
  dataSection: "The table",
  eLabel: "Embedding size E",
  eDetail: "how many numbers a token's row holds; the picture projects them to two",
  seedLabel: "Seed",
  seedDetail: "the starting rows and the training sequences, reproducibly",

  stepLabel: "Train one",
  stepTitle: "Train one epoch of 300 sequences and move each row to where it leaves it",
  runLabel: "Play",
  runTitle: "Train the remaining epochs in turn",

  legend: {
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
  },

  capTable: (V, E) => `the table · Embedding(${V}, ${E}) · one row a token`,
  capSpace: "the space · each row on the table's top two components",
  capSpaceCodon: "the space · the axes from the eighteen rewarded rows",
  capStart: "epoch 0 · the rows as initialised, N(0, 1)",
  capEpoch: (e, n, acc) => `epoch ${e} of ${n} · held-out ${Math.round(100 * acc)}%`,
  capDrawn: (p2, p, E) => `purity drawn ${Math.round(100 * p2)}% · in ${E}-D ${Math.round(100 * p)}%`,
  capTrack: "held-out accuracy by epoch · 300 sequences outside the training set",
  capTask: {
    aa: "class 1 carries hydrophobic · hydrophobic · positive · negative, each a random residue of that role",
    codon: "class 1 carries L · R · S, each a random one of its six codons",
  },

  tileAcc: "Held-out accuracy",
  tileAccNote: "300 sequences outside the training set, after the epochs trained so far",
  tileWait: "—",
  tilePurity: "Role purity",
  tilePurityNote: (E) => `tokens whose nearest row in ${E}-D shares their role; chance 28%`,
  tileRatio: "Within / between",
  tileRatioNote: "mean distance within a role over mean distance between roles; 1 is no structure",
  tilePurity18: "Purity, the eighteen",
  tilePurity18Note: (E) => `motif codons whose nearest of the eighteen in ${E}-D is a synonym; chance 29%`,
  tilePurityRest: "Purity, the other 43",
  tilePurityRestNote: "the unrewarded codons among themselves; they move too, and at chance they have landed nowhere",

  hover: {
    aa: (c) => `${c} · ${M.NAMES[c]} · ${M.roleOf(c)}`,
    codon: (c) => `${c} · ${M.NAMES[M.AA_OF[c]] ?? M.AA_OF[c]} (${M.AA_OF[c]})`,
  },

  sum: (page, e, n) => `${page === "aa" ? "twenty amino acids" : "sixty-one codons"} as rows of an embedding table and as points; ${e === 0 ? "the rows as initialised" : e < n ? `${e} of ${n} epochs trained` : "all epochs trained"}`,
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

/* the truth's colours: four roles, or the motif's three amino acids */
const ROLE_SLOT = { hydrophobic: 0, polar: 1, positive: 2, negative: 3 };
const MOTIF_SLOT = { L: 0, R: 1, S: 2 };
function colourOf(colors, page, i) {
  const P = M.PAGES[page];
  if (page === "aa") return colors.clusters[ROLE_SLOT[P.group(i)]];
  const slot = MOTIF_SLOT[P.group(i)];
  return slot == null ? wash(colors.ink3, 0.55) : colors.clusters[slot];
}

/* ----------------------------------------------------------- the layout */

const PAD_L = 40, PAD_R = 14, TOP = 24, GAP = 34;
const BELOW = 100;   // under the panels: the epoch line, the task, the accuracy track
/** the two panels: the table at the left, the space a square at the right, the accuracy track beneath both */
function layout(w, E) {
  const bottom = HEIGHT - BELOW;
  const side = bottom - TOP;
  const spaceX = w - PAD_R - side;
  const tableW = Math.min(spaceX - GAP - PAD_L, E * 26);
  return { top: TOP, bottom, side, spaceX, tableX: PAD_L, tableW, cellW: tableW / E, trackTop: bottom + 52, trackBot: HEIGHT - 12 };
}

/* ================================================================ compute */

/* Trained runs, cached by the parameters that shape them: a page switch is a
   display change that re-runs compute, and without the cache every visit to
   the other page would retrain for a second. */
const cache = new Map();
function compute({ params }) {
  const key = [params.page, params.E, params.seed].join("|");
  if (cache.has(key)) return cache.get(key);
  const run = M.trainPage(params.page, Number(params.E), params.seed);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(key, run);
  return run;
}

/* ============================================================== animation */

/** the epoch whose numbers are shown: the target once its move has landed, else the one before */
const shownEpoch = (anim) => (anim.t >= 1 ? anim.n[anim.page] : Math.max(0, anim.n[anim.page] - 1));
const isDone = (anim) => anim.n[anim.page] >= M.EPOCHS && anim.t >= 1;

/* ==================================================================== draw */

function drawTable(ctx, colors, L, params, state, anim) {
  const P = M.PAGES[params.page], n = anim.n[params.page], t = ease(anim.t);
  const prev = state.tables[Math.max(0, n - 1)], cur = state.tables[n];
  const rows = cur.length, E = state.E, rowH = (L.bottom - L.top) / rows;
  txt(ctx, colors, S.capTable(P.V, E), L.tableX, 14, { font: capFont(colors), fill: colors.ink1 });
  for (let i = 0; i < rows; i++) {
    const y = L.top + i * rowH;
    for (let e = 0; e < E; e++) {
      const v = lerp(prev[i][e], cur[i][e], t);
      rect(ctx, L.tableX + e * L.cellW, y, Math.ceil(L.cellW), Math.ceil(rowH), signed(colors, v, 3));
    }
    /* the row's name: a letter for an amino acid; a colour tick for a codon, the eighteen in their amino acid's colour */
    if (params.page === "aa") txt(ctx, colors, P.tokens[i], L.tableX - 5, y + rowH / 2, { font: monoFont(colors), fill: colourOf(colors, "aa", i), align: "right", baseline: "middle" });
    else if (MOTIF_SLOT[P.group(i)] != null) rect(ctx, L.tableX - 6, y, 4, Math.max(1, rowH - 0.5), colourOf(colors, "codon", i));
  }
  rect(ctx, L.tableX, L.top, L.tableW, L.bottom - L.top, null, colors.grid);
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
  txt(ctx, colors, page === "aa" ? S.capSpace : S.capSpaceCodon, L.spaceX, 14, { font: capFont(colors), fill: colors.ink1 });
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

function drawTrack(ctx, colors, L, params, state, anim) {
  const n = anim.n[params.page], upto = anim.t >= 1 ? n : n - 1;
  const x0 = PAD_L, x1 = L.spaceX + L.side, top = L.trackTop, bot = L.trackBot;
  txt(ctx, colors, S.capTrack, x0, top - 7, { font: capFont(colors), fill: colors.ink1 });
  rect(ctx, x0, top, x1 - x0, bot - top, colors.surface2, colors.grid);
  const px = (e) => x0 + ((e - 0.5) / M.EPOCHS) * (x1 - x0);
  const py = (a) => bot - Math.max(0, (a - 0.4) / 0.6) * (bot - top);
  line(ctx, x0, py(0.5), x1, py(0.5), colors.grid, 1, [2, 3]);
  txt(ctx, colors, "50%", x0 - 4, py(0.5), { fill: colors.ink3, align: "right", baseline: "middle" });
  txt(ctx, colors, "100%", x0 - 4, py(1) + 1, { fill: colors.ink3, align: "right", baseline: "top" });
  if (upto >= 1) {
    ctx.save(); ctx.strokeStyle = colors.empirical; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let e = 1; e <= upto; e++) { const x = px(e), y = py(state.accs[e]); if (e === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.restore();
    dot(ctx, px(upto), py(state.accs[upto]), 3, colors.empirical);
  }
  /* the epoch in flight, as a marker sliding along the track */
  if (anim.t < 1 && n >= 1) line(ctx, px(n - 1 + anim.t), top, px(n - 1 + anim.t), bot, colors.highlight, 1);
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
    page: { type: "segmented", label: S.pageLabel, options: PAGES, default: "aa", display: true },
    dataSec: { type: "section", label: S.dataSection },
    E: {
      type: "choice", label: S.eLabel, detail: S.eDetail,
      options: M.SIZES.map((e) => ({ value: String(e), label: String(e) })), default: "8",
    },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },
    /* authoring escape hatch, first render only: epochs already trained on the page it opens with */
    shown: { type: "int", min: 0, max: M.EPOCHS, default: 0, hidden: true },
  },

  legend: ({ params }) => S.legend[params.page] ?? S.legend.aa,

  compute,

  animation: {
    stepLabel: S.stepLabel,
    stepTitle: S.stepTitle,
    runLabel: S.runLabel,
    runTitle: S.runTitle,

    init: ({ params, fromScratch }) => {
      const shown = fromScratch ? 0 : Math.max(0, Math.min(M.EPOCHS, Number(params.shown) || 0));
      const anim = { page: params.page, n: { aa: 0, codon: 0 }, t: 1, moving: false, halt: false };
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
    const L = layout(w, state.E);
    drawTable(ctx, colors, L, params, state, anim);
    drawSpace(ctx, colors, L, params, state, anim, pointer);
    const e = shownEpoch(anim);
    txt(ctx, colors, e === 0 ? S.capStart : S.capEpoch(e, M.EPOCHS, state.accs[e]), PAD_L, L.bottom + 14, { fill: colors.ink1, font: `600 ${colors.fsXs} ${colors.font}` });
    txt(ctx, colors, S.capTask[params.page], PAD_L, L.bottom + 28, { fill: colors.ink3 });
    drawTrack(ctx, colors, L, params, state, anim);
  },

  readout({ params, state, anim }) {
    const e = shownEpoch(anim), E = state.E;
    const acc = e >= 1 ? `${Math.round(100 * state.accs[e])}%` : S.tileWait;
    if (params.page === "codon") {
      return [
        { label: S.tileAcc, value: acc, note: S.tileAccNote },
        { label: S.tilePurity18, value: `${Math.round(100 * state.geo[e].purity)}%`, note: S.tilePurity18Note(E) },
        { label: S.tilePurityRest, value: `${Math.round(100 * state.geoRest[e].purity)}%`, note: S.tilePurityRestNote },
      ];
    }
    return [
      { label: S.tileAcc, value: acc, note: S.tileAccNote },
      { label: S.tilePurity, value: `${Math.round(100 * state.geo[e].purity)}%`, note: S.tilePurityNote(E) },
      { label: S.tileRatio, value: state.geo[e].ratio.toFixed(2), note: S.tileRatioNote },
    ];
  },

  summary({ params, anim }) { return S.sum(params.page, shownEpoch(anim), M.EPOCHS); },
});
