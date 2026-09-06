/* ============================================================================
   Hidden Markov model — widget 45, DRAFT, started 2026-09-06.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   intentional missing data of a SNP array, filled from a reference panel with
   an HMM. Two tabs in the notebook's own order, on ONE decoder (model.js):

     Concept             a Markov model whose states are the tosses of a
                         sticky coin, walked one toss at a time — the arrow
                         taken lights on the graph, the transitions counted
                         so far sit beside T and estimate it — and then a
                         hidden Markov model: the coin, fair or loaded, is
                         the state and is not seen; each toss is emitted by
                         E, and the same counted table is no longer T.
                         Kenneth asked for the tab first, 2026-09-06 —
                         students do not know a Markov model, or how it
                         relates to the matrix — and inverted it to this
                         order the same day to follow the lesson.
     Toy model           the notebook's own narrative: two KNOWN five-day
                         mood patterns, P1 and P2, and a record that follows
                         one of them with some days unrecorded. The hidden
                         state is which pattern the record is following; a
                         missing day is read off the decoded pattern. Seed 1
                         with three days missing is the notebook's exact
                         example. Its animation is THE VITERBI ALGORITHM —
                         the trellis forward one column at a time, then the
                         trace-back.
     Biological example  the reference panel IS the emission table (K
                         haplotypes by L sites), the hidden state is which
                         haplotype the sample is copying, and recombination
                         is the transition. The same Viterbi walk, at K
                         states: no numbers in the nodes and no losing
                         candidates drawn, because 17px cells and K-1 losers
                         per node would not read.

   THE FIGURE, top to bottom, the same on the toy and the biology so the
   second reads as the first grown up: the model (the states as a graph, the
   transition table, the emission at the position being read), the templates
   (two patterns / the panel), the record (blanks where nothing was), the
   Viterbi trellis, the POSTERIOR over hidden states as a strip with the
   Viterbi path drawn through it, and the imputed row, each call with its
   probability. The true states go on the strip as a dashed path and the true
   observations in a final row, only when asked for — the same "reality never
   grants this" move as widget 25's true values.

   Kenneth picked this layout (B) over letters-on-belief (A) and a Viterbi-only
   route (C) from `_lab/hmm-mock.html` on 2026-09-06, asked for the toy tab in
   front of it, renamed the tabs from Mood / Genotype to these (one is the toy
   and one is the biological example, and the names should say so rather than
   name the example), and picked the trellis with scores in its nodes (C) from
   `_lab/hmm-viterbi.html` as the toy's animation.

   The biological tab first revealed one typed site at a time instead, on
   the argument that a K-state trellis is too dense to animate. Kenneth
   asked for the same walk on both (2026-09-06): see the array, walk the
   sequence to see which haplotype fits, then the imputed row against the
   truth. So both tabs run the same animation, and the trellis simply drops
   its numbers and its losing edges where the cells are small.

   THE TOY WAS REBUILT ONCE, THEN SIMPLIFIED. It opened with a stochastic
   emission — a pattern was Happy with probability 0.8, set by a dial that
   also generated the truth — and Kenneth hit both faults at once: turning
   the dials remade the world rather than the model, and a mood drawn from
   its pattern could not be reconstructed, only given a probability. Rebuilt
   2026-09-06 on the notebook's narrative: known patterns, emission read off
   them day by day, the same copying model as the biology at two templates.
   Then, the same day, the degrees of freedom came out: no length, no
   pattern changes, no switch-rate dial on either tab, one recombination
   point on the biology. What is left to set is what is missing, the panel,
   the array density and the seed — and the switch rate is fixed at the
   value that decodes best (model.js, RHO). One extra on the biology, added
   after a measurement: Sample = Recombinant, h1 then h2 with the cut near
   the middle, the one switching scenario that decodes as a switch.

   Every stage of the animation is precomputed in compute(); a beat only
   fades one column in.
   ========================================================================= */

import { defineWidget, fmt, mathmlRenders } from "../core/index.js";
import * as M from "./model.js";

/* Option lists. Choice keys are strings on the wire; Number() them at use. */
const KS = ["2", "3", "4", "6", "8"];
const EVERY = ["2", "3", "4", "6", "9"];

/* Pacing is chosen, not automatic (4.1). Slow and Medium fade each new column
   or posterior in; Fast declares no choreography and shows the stages only. */
const SPEEDS = {
  slow: { label: "Slow", detail: "the draw from T's row, then the token; elsewhere each column faded in", ms: 900, choreo: true, drawBar: true },
  medium: { label: "Medium", detail: "the token walks; a column faded in", ms: 420, choreo: true, drawBar: false },
  fast: { label: "Fast", detail: "the columns only, no motion", ms: 110, choreo: false, drawBar: false },
};
/* One step is one unit WATCHED — a fixed beat whatever Play is set to. On
   the Concept tab a step carries the full choreography (the draw from T's
   row, then the token walk — C of four in `_lab/hmm-walk.html`) and needs
   the longer beat; the trellis tabs fade one column in. */
const STEP_MS = 700;
const STEP_MS_CONCEPT = 900;

/* One layout function read by `height` and `draw`, so the two cannot drift. */
const GUT = 66, GAP = 16, LAB = 15, TOP = 6, BOT = 8;
const MAX_CELL = 40;           // the toy's few days would otherwise balloon
/* THE MODEL BAND, arrangement C of four in `_lab/hmm-layout.html` (Kenneth,
   2026-09-06): the graph takes the band's full height on the left; T sits
   above E on the right, so a transition row and an emission row line up.
   Two-state tables get 40px cells; a K-by-K table shrinks to fit — 22px at
   K = 8 — and the ring needs 230px of height to read at six or eight. */
const modelCell = (K) => (K <= 2 ? 40 : Math.max(22, Math.min(34, Math.floor(176 / K))));
/* Two states: T stacked above E, both two rows. K states: E has K rows too,
   so it sits BESIDE T on the right, row h1 against row h1. */
const bandH = (K) => (K > 2
  ? Math.max(230, LAB + 6 + K * modelCell(K) + 8)
  : LAB + 2 * modelCell(K) + 12 + LAB + 6 + 2 * modelCell(K));
const BAR_H = 6;               // the probability bar under an imputed call

function layout(w, v) {
  if (v.view === "concept") return conceptLayout(w, v);
  const toy = v.view === "toy";
  const L = toy ? M.NOTEBOOK.P1.length : M.L_DEFAULT;
  const K = toy ? 2 : Number(v.K);
  const cell = Math.min(MAX_CELL, Math.floor((w - GUT - 6) / L));
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  /* ORDER 3 of three in `_lab/hmm-layout.html` (Kenneth, 2026-09-06): the
     model first, as the Concept tab has it; then the templates and the
     record together, directly above the trellis that reads them; then the
     posterior, the imputed row and the truth. The record used to open the
     figure and be repeated above the imputed row; with it next to the
     trellis the repeat is gone and all three tabs tell the same story top
     to bottom: model, templates, record, algorithm, answer. */
  const model = add(bandH(K));
  const panel = add(K * cell);
  const obs = add(cell);
  const trellis = add(K * cell);
  const strip = add(K * cell);
  const imp = add(cell + BAR_H);
  const truth = v.truth ? add(cell) : null;
  return { cell, K, L, gx: GUT, obs, model, panel, trellis, strip, imp, truth, height: y - GAP + BOT };
}

const beliefAlpha = (g) => 0.05 + 0.88 * g;

/* THE MODEL BAND on the toy and the biology: the states as a graph on the
   left — two patterns side by side with their self-loops, switches and
   emission arrows, or K haplotypes on a ring, every pair joined because a
   switch can land on any other — and on the right the transition table T
   with the emission table AT ONE POSITION (the column the walk is at): the
   template's own value 1 - eps, the other eps, so it is the templates'
   column read as probabilities.

   THE GRAPH AND THE TABLES ANSWER TO THE POINTER, both ways: hovering an
   edge lights its cell, hovering a cell lights its edge (Kenneth,
   2026-09-06). An inspector, not a control — nothing is written, and with
   no pointer the figure is exactly as before. Geometry is computed once
   per frame by the *Geometry functions and shared by the hit-test and the
   drawing, so a hover cannot light the wrong edge. */
const HIT = 7;                                   // px either side of an edge that counts as on it
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/* An edge under the pointer: { kind: "T" | "E", from, to } or null. */
function edgeAt(edges, p) {
  if (!p) return null;
  for (const e of edges) {
    if (e.loop ? Math.hypot(p.x - e.loop.x, p.y - e.loop.y) <= e.loop.r + HIT
      : distToSeg(p.x, p.y, ...e.seg) <= HIT) return { kind: e.kind, from: e.from, to: e.to };
  }
  return null;
}
/* A table cell under the pointer: { r, c } or null. `x0, y0` is the first cell. */
function cellAt(p, x0, y0, nCols, nRows, cw, ch) {
  if (!p) return null;
  const c = Math.floor((p.x - x0) / cw), r = Math.floor((p.y - y0) / ch);
  return c >= 0 && c < nCols && r >= 0 && r < nRows ? { r, c } : null;
}
const isHot = (hot, kind, from, to, undirected = false) =>
  Boolean(hot) && hot.kind === kind && ((hot.from === from && hot.to === to) || (undirected && hot.from === to && hot.to === from));

/* THE CONCEPT WALK'S CHOREOGRAPHY, one beat: with the draw bar, T's row lights
   and a marker sweeps a bar split in that row's proportions until it stops
   on the outcome; then a token walks the arrow taken (or laps the self-loop);
   then the destination fills and the tile lands, and with the states hidden
   the emitted mood drops down its emission arrow to the record. Kenneth
   picked it (C at Slow, B at Medium) from `_lab/hmm-walk.html`, 2026-09-06.
   Phases are fractions of the beat; without the draw bar the walk starts at
   once. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const phase = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const PHASES = {
  withDraw: { draw: [0.05, 0.4], walk: [0.45, 0.8], land: [0.8, 1] },
  walkOnly: { draw: null, walk: [0.1, 0.75], land: [0.75, 1] },
};
/* A point along the transition from state a to state b at fraction t: along
   the arrow, or a lap of the self-loop. Uses the shared geometry. */
function alongTransition(geom, a, b, t) {
  const { S, R } = geom;
  if (a !== b) {
    const off = a === 0 ? -5 : 5;
    const ax = S[a].x + (a === 0 ? R : -R), bx = S[b].x + (a === 0 ? -R : R);
    return { x: ax + (bx - ax) * t, y: S[a].y + off };
  }
  const side = a === 0 ? -1 : 1, cx = S[a].x + side * (R + 9), cy = S[a].y, r = 9;
  const start = side > 0 ? -2.2 : 0.95 + Math.PI * 2, end = side > 0 ? 2.2 : 0.95;
  const ang = start + (end - start) * t;
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

/* Two states side by side; the geometry the drawing and the hit-test share. */
function twoStateGeometry({ x0, x1, y, h, cell, hidden }) {
  const mid = (x0 + x1) / 2, d = Math.min(90, (x1 - x0) / 4);
  const R = 18, ts = Math.min(Math.max(cell, 20), 26);
  const sy = y + Math.round(h * 0.3), oy = y + h - ts - 16;
  const S = [{ x: mid - d, y: sy }, { x: mid + d, y: sy }];
  const O = [{ x: mid - d, y: oy + ts / 2 }, { x: mid + d, y: oy + ts / 2 }];
  const edges = [];
  for (let s = 0; s < 2; s += 1) {
    const side = s === 0 ? -1 : 1;
    edges.push({ kind: "T", from: s, to: s, loop: { x: S[s].x + side * (R + 9), y: S[s].y, r: 9 } });
  }
  edges.push({ kind: "T", from: 0, to: 1, seg: [S[0].x + R, S[0].y - 5, S[1].x - R, S[1].y - 5] });
  edges.push({ kind: "T", from: 1, to: 0, seg: [S[1].x - R, S[1].y + 5, S[0].x + R, S[0].y + 5] });
  if (hidden) for (let s = 0; s < 2; s += 1) for (let o = 0; o < 2; o += 1) {
    edges.push({ kind: "E", from: s, to: o, seg: [S[s].x, S[s].y, O[o].x, O[o].y] });
  }
  return { mid, R, ts, oy, S, O, edges };
}

/* K states on a ring, every pair joined; one emission arrow per state, to
   the value it carries at this position. */
function ringGeometry({ x0, x1, y, h, K, hap, site, ts }) {
  const mid = (x0 + x1) / 2, R = 12;
  const rad = Math.min((x1 - x0) / 2 - R - 8, (h - 78) / 2 - R);
  const cy0 = y + 4 + rad + R;
  const pos = Array.from({ length: K }, (_, k) => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / K;
    return { x: mid + rad * Math.cos(a), y: cy0 + rad * Math.sin(a), a };
  });
  const ty = cy0 + rad + R + 16;
  const tileX = [mid - 22 - ts / 2, mid + 22 - ts / 2];
  const edges = [];
  for (let a = 0; a < K; a += 1) for (let b = a + 1; b < K; b += 1) edges.push({ kind: "T", from: a, to: b, seg: [pos[a].x, pos[a].y, pos[b].x, pos[b].y] });
  for (let k = 0; k < K; k += 1) edges.push({ kind: "T", from: k, to: k, loop: { x: pos[k].x + Math.cos(pos[k].a) * (R + 7), y: pos[k].y + Math.sin(pos[k].a) * (R + 7), r: 6 } });
  for (let k = 0; k < K; k += 1) {
    const o = hap[k][site];
    edges.push({ kind: "E", from: k, to: o, seg: [pos[k].x, pos[k].y, tileX[o] + ts / 2, ty] });
  }
  return { mid, R, pos, ty, tileX, edges };
}

/* A probability table with a hot cell. `header(c, x, y)` draws a column head;
   `undirected` lights the mirror cell too, for a ring's chords. */
function drawProbTable(ctx, colors, text, border, { x0, y0, cols, rows, cells, cw, ch, hdr, small, kind, hot, undirected, header, rowNames = true, tone, beatRow = null }) {
  for (let c = 0; c < cols; c += 1) header(c, x0 + c * cw + cw / 2, y0 + hdr / 2);
  for (let r = 0; r < rows; r += 1) {
    const y = y0 + hdr + r * ch;
    if (rowNames) text(x0 - 6, y + ch / 2 + 0.5, rowNames === true ? `${r}` : rowNames(r), colors.ink3, "right", small);
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * cw;
      if (isHot(hot, kind, r, c, undirected)) {
        ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = colors.highlight; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); ctx.restore();
      } else if (beatRow && beatRow.r === r) {
        /* The row being drawn from lights; the cell drawn lights harder once the marker has landed. */
        ctx.save(); ctx.globalAlpha = beatRow.c === c ? 0.35 : 0.12; ctx.fillStyle = colors.highlight; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); ctx.restore();
      }
      border(x, y, cw, ch);
      text(x + cw / 2, y + ch / 2 + 0.5, cells[r][c], tone ? tone(r, c) : colors.ink1, "center", small);
    }
  }
}

function drawRingModel(ctx, colors, { Lo, state, stage, site, w, tile, text, border, stateName, pointer }) {
  const { K, gx, cell } = Lo;
  const B = Lo.model;
  const mc = modelCell(K);
  const small = `${mc >= 40 ? 12 : mc >= 28 ? 10 : 9}px ${colors.font}`;
  const rho = state.rho, move = rho / (K - 1);
  const toy = state.kind === "mood";
  const unit = toy ? "day" : "site";
  const known = stage.sites[site].known;
  const ts = Math.min(cell + 4, 18);
  const sideBySide = K > 2;
  const colW = sideBySide ? K * mc + 30 + 2 * mc : 2 * mc;
  const tx = w - colW - 6;
  const tRow0 = B.y + LAB + (sideBySide ? 6 : 0);
  const ex = sideBySide ? tx + K * mc + 30 : tx;
  const eY = sideBySide ? B.y : B.y + LAB + K * mc + 12 + LAB;
  const eRow0 = eY + LAB + 6;
  const x0 = gx, x1 = tx - 30;
  const T2 = [[1 - rho, rho], [rho, 1 - rho]];
  const E2 = K === 2 ? [0, 1].map((h) => [0, 1].map((o) => (state.panel.hap[h][site] === o ? 1 - state.eps : state.eps))) : null;

  /* What is under the pointer: a T cell, an E cell, or an edge of the graph. */
  const geom = K === 2
    ? twoStateGeometry({ x0, x1, y: B.y, h: B.h, cell, hidden: true })
    : ringGeometry({ x0, x1, y: B.y, h: B.h, K, hap: state.panel.hap, site, ts });
  let hot = null;
  const tc = cellAt(pointer, tx, tRow0, K, K, mc, mc);
  const ec = cellAt(pointer, ex, eRow0, 2, K, mc, mc);
  if (tc) hot = { kind: "T", from: tc.r, to: tc.c };
  else if (ec) hot = { kind: "E", from: ec.r, to: ec.c };
  else hot = edgeAt(geom.edges, pointer);

  /* Transition, top right. */
  text(tx, B.y - LAB / 2 - 1, "Transition T", colors.ink2);
  drawProbTable(ctx, colors, text, border, {
    x0: tx, y0: tRow0 - LAB, cols: K, rows: K, cw: mc, ch: mc, hdr: LAB, small, kind: "T", hot, undirected: K > 2,
    header: (c, x, y) => text(x, y, K === 2 ? `to ${stateName(c)}` : stateName(c), colors.ink3, "center", small),
    rowNames: (r) => stateName(r),
    cells: Array.from({ length: K }, (_, r) => Array.from({ length: K }, (_, c) => (r === c ? 1 - rho : move).toFixed(2))),
    tone: (r, c) => (r === c ? colors.ink1 : colors.ink2),
  });

  /* Emission at one position: under T for two states, beside it for K.
     Columns are the two values as tiles. */
  text(ex, eY - LAB / 2 - 1, sideBySide ? `E at ${unit} ${site + 1}` : `Emission E at ${unit} ${site + 1}`, colors.ink2);
  drawProbTable(ctx, colors, text, border, {
    x0: ex, y0: eRow0 - LAB - 6, cols: 2, rows: K, cw: mc, ch: mc, hdr: LAB + 6, small, kind: "E", hot,
    header: (c, x) => {
      tile(x - ts / 2, eY + 1, c, 1, ts, site);
      if (known && state.truthAllele[site] === c) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.strokeRect(x - ts / 2 + 1, eY + 2, ts - 2, ts - 2); }
    },
    rowNames: sideBySide ? false : (r) => stateName(r),
    cells: Array.from({ length: K }, (_, h) => [0, 1].map((c) => (state.panel.hap[h][site] === c ? 1 - state.eps : state.eps).toFixed(2))),
  });

  /* The graph, left, the band's full height. */
  if (K === 2) {
    text(x0, B.y - LAB / 2 - 1, `Hidden states, and the ${toy ? "moods" : "alleles"} they emit at ${unit} ${site + 1}`, colors.ink2);
    drawConceptGraph(ctx, colors, { geom, T: T2, E: E2, hidden: true, lit: null, litAlpha: 1, hot,
      tile: (x, y, o, alpha, size) => tile(x, y, o, alpha, size, site),
      names: [stateName(0), stateName(1)], emitNames: toy ? ["Sad", "Happy"] : [state.panel.letters[site][0], state.panel.letters[site][1]] });
    return;
  }
  text(x0, B.y - LAB / 2 - 1, "Hidden states: which haplotype is copied", colors.ink2);
  const { mid, R, pos, ty, tileX } = geom;
  const strokeFor = (kind, a, b, undirected) => {
    const on = isHot(hot, kind, a, b, undirected);
    ctx.strokeStyle = on ? colors.highlight : colors.ink3; ctx.lineWidth = on ? 2.6 : 1; ctx.globalAlpha = on ? 1 : 0.35;
    return on;
  };
  for (let a = 0; a < K; a += 1) for (let b2 = a + 1; b2 < K; b2 += 1) {
    ctx.save(); strokeFor("T", a, b2, true);
    ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b2].x, pos[b2].y); ctx.stroke(); ctx.restore();
  }
  for (let h = 0; h < K; h += 1) {
    const o = state.panel.hap[h][site];
    const bx = tileX[o] + ts / 2, by = ty;
    const dx = bx - pos[h].x, dy = by - pos[h].y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    ctx.save();
    const on = isHot(hot, "E", h, o);
    ctx.strokeStyle = on ? colors.highlight : colors.ink3; ctx.lineWidth = on ? 2.4 : 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = on ? 1 : 0.8;
    ctx.beginPath(); ctx.moveTo(pos[h].x + ux * (R + 2), pos[h].y + uy * (R + 2)); ctx.lineTo(bx - ux * 4, by - uy * 4); ctx.stroke();
    ctx.restore();
  }
  for (let h = 0; h < K; h += 1) {
    ctx.save();
    ctx.fillStyle = colors.surface; ctx.beginPath(); ctx.arc(pos[h].x, pos[h].y, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke();
    ctx.restore();
    text(pos[h].x, pos[h].y + 0.5, stateName(h), colors.ink1, "center", `600 ${colors.fsXs} ${colors.font}`);
    const lx = pos[h].x + Math.cos(pos[h].a) * (R + 7), ly = pos[h].y + Math.sin(pos[h].a) * (R + 7);
    ctx.save();
    const on = isHot(hot, "T", h, h);
    ctx.strokeStyle = on ? colors.highlight : colors.ink3; ctx.lineWidth = on ? 2.6 : 1.2;
    ctx.beginPath(); ctx.arc(lx, ly, 6, pos[h].a + 2.4, pos[h].a - 2.4 + 2 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  for (let c = 0; c < 2; c += 1) tile(tileX[c], ty, c, 1, ts, site);
  text(mid, ty + ts + 10, `emits its own allele at site ${site + 1}`, colors.ink3, "center");
  text(mid, ty + ts + 24, `stay ${(1 - rho).toFixed(2)} · switch ${move.toFixed(2)} to each of the other ${K - 1}`, colors.ink3, "center");
}

/* THE CONCEPT TAB — a Markov model first, then a hidden one.

   Students meet the transition matrix before they meet a hidden state, and
   the lesson does the same. STAGE 1, `model=markov`: the states are the two
   faces of a sticky coin, Heads and Tails, so the record of tosses IS the
   state sequence. The tab walks it one toss at a time — the arrow taken
   lights on the graph, a tile lands on the record, the transitions counted
   so far sit beside the matrix that made them, and the counted shares
   approach T's rows: counting is how T is learned. STAGE 2,
   `model=hidden`: the state is now the coin in play, fair or loaded, and it
   is not seen; each toss is emitted by E, and the SAME counted table over
   the SAME kind of record is no longer T. The student has just seen
   counting work and now sees why it stops working, which is the reason an
   HMM needs an algorithm.

   IT RAN THE OTHER WAY UNTIL 2026-09-06 — the coins' chain first, visible,
   then hidden — and Kenneth inverted it to follow the notebook he was
   amending, which introduces a simple Markov model as a coin toss with
   states Heads and Tails. He picked two stages over three (the old visible
   coins step, which the ground-truth toggle now covers) and two sliders
   over one, from `_lab/hmm-concept-order.html`. The switch is a DATA
   change: the two records come from different mechanisms, so it resets
   the walk, where the old Visible | Hidden was a display change over one
   walk.

   THE EXAMPLE IS THE OCCASIONALLY DISHONEST CASINO, a fair coin and a loaded
   one, not the notebook's moods — chosen the same day so that each tab owns
   one vocabulary: the toy keeps P1 / P2 and the moods for the notebook's
   own example, where a pattern is a template rather than a tendency. */
const CONCEPT = {
  TOSSES: 20,
  BAND_H: 248,            // the hidden model's band: the graph, with T above E on the right
  BAND_H_MARKOV: 150,     // the Markov band: no emission row, T alone on the right
  TABLE: 40,              // a probability-table cell
};

function conceptLayout(w, v) {
  const L = CONCEPT.TOSSES;
  const cell = Math.min(30, Math.floor((w - GUT - 6) / L));
  const hidden = v.model === "hidden";
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  const model = add(hidden ? CONCEPT.BAND_H : CONCEPT.BAND_H_MARKOV);
  const walk = add((hidden ? 2 : 1) * cell);
  const counts = add(LAB + 2 * CONCEPT.TABLE);
  return { cell, K: 2, L, gx: GUT, model, walk, counts, height: y - GAP + BOT };
}

/* The two-state graph: circles, a self-loop and a switch on each, labelled
   from T; with the states hidden, dashed circles and dashed emission arrows
   down to the two values, labelled from E. `lit` names the
   arrow the walk just took, drawn in the highlight colour while the beat
   runs; `hot` names the edge under the pointer, or the edge of the table
   cell under it, drawn the same way. Takes the shared geometry.

   `tossNodes` is the Markov stage: the states are the tosses, so the nodes
   wear the toss tiles' own convention — Heads filled in --c-theory, Tails
   open — and carry the face's name beneath. The hidden stage's coins are
   plain circles; the change of dress is the change of what a state is. */
function drawConceptGraph(ctx, colors, { geom, T, E, hidden, lit, litAlpha, hot, tile,
  names = ["F", "B"], emitNames = ["Tails", "Heads"], visibleNote = "the state is what you observe", token = null, fillState = null, tossNodes = false }) {
  const font = `${colors.fsXs} ${colors.font}`;
  const { mid, R, ts, oy, S, O } = geom;
  const label = (x, yy, s, align = "center", colour = colors.ink2) => {
    ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.font = font;
    ctx.fillText(s, x, yy);
  };
  const litOn = (kind, from, to, emit) => Boolean(lit) && (kind === "T" ? lit.from === from && lit.to === to : lit.to === from && lit.emit === emit);
  const stroke = (kind, from, to) => {
    const on = isHot(hot, kind, from, to), byBeat = !on && litOn(kind, from, to, to);
    ctx.strokeStyle = on || byBeat ? colors.highlight : colors.ink3;
    ctx.fillStyle = on || byBeat ? colors.highlight : colors.ink3;
    ctx.lineWidth = on || byBeat ? 2.6 : 1.2;
    if (byBeat) ctx.globalAlpha = litAlpha;
  };
  const arrow = (ax, ay, bx, by, shrinkA, shrinkB, dash, kind, from, to) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const sx = ax + ux * shrinkA, sy2 = ay + uy * shrinkA, ex = bx - ux * shrinkB, ey = by - uy * shrinkB;
    ctx.save(); stroke(kind, from, to);
    if (dash) ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 6 - uy * 3.5, ey - uy * 6 + ux * 3.5);
    ctx.lineTo(ex - ux * 6 + uy * 3.5, ey - uy * 6 - ux * 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  for (let h = 0; h < 2; h += 1) {
    /* A visible state is a solid circle; a hidden one is dashed, the
       convention for what is not observed. */
    ctx.save();
    const filled = tossNodes && h === 1;
    ctx.beginPath(); ctx.arc(S[h].x, S[h].y, R, 0, Math.PI * 2);
    ctx.fillStyle = filled ? colors.theory : colors.surface; ctx.fill();
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; if (hidden) ctx.setLineDash([3, 3]); ctx.stroke();
    if (fillState && fillState.h === h && fillState.a > 0) {
      /* The destination fills as the token arrives. */
      ctx.globalAlpha = 0.3 * fillState.a; ctx.fillStyle = colors.highlight; ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = filled ? colors.surface : colors.ink1;
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(names[h], S[h].x, S[h].y + 0.5);
    if (tossNodes) label(S[h].x, S[h].y + R + 11, emitNames[h]);
    /* Self-loop on the outer side, labelled with the stay probability. */
    const side = h === 0 ? -1 : 1;
    const lx = S[h].x + side * (R + 9), ly = S[h].y;
    ctx.save(); stroke("T", h, h);
    ctx.beginPath(); ctx.arc(lx, ly, 9, side > 0 ? -2.2 : 0.95, side > 0 ? 2.2 : 5.35); ctx.stroke();
    const tipX = S[h].x + side * R * 0.75, tipY = S[h].y + R * 0.66;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + side * 6, tipY + 2);
    ctx.lineTo(tipX + side * 2, tipY - 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(S[h].x + side * (R + 22), S[h].y - 12, T[h][h].toFixed(2), side > 0 ? "left" : "right");
  }
  arrow(S[0].x, S[0].y - 5, S[1].x, S[1].y - 5, R + 1, R + 1, false, "T", 0, 1);
  arrow(S[1].x, S[1].y + 5, S[0].x, S[0].y + 5, R + 1, R + 1, false, "T", 1, 0);
  label(mid, S[0].y - 15, T[0][1].toFixed(2));
  label(mid, S[0].y + 16, T[1][0].toFixed(2));
  if (hidden) {
    for (let h = 0; h < 2; h += 1) for (let o = 0; o < 2; o += 1) {
      arrow(S[h].x, S[h].y, O[o].x, O[o].y, R + 2, ts / 2 + 3, true, "E", h, o);
      const f = h === o ? 0.5 : 0.36;
      const lx = S[h].x + (O[o].x - S[h].x) * f, ly = S[h].y + (O[o].y - S[h].y) * f;
      const off = h === o ? (h === 0 ? -8 : 8) : (h === 0 ? -6 : 6);
      label(lx + off, ly, E[h][o].toFixed(2), off > 0 ? "left" : "right");
    }
    for (let o = 0; o < 2; o += 1) {
      tile(O[o].x - ts / 2, oy, o, 1, ts);
      label(O[o].x, oy + ts + 9, emitNames[o]);
    }
  } else if (visibleNote) {
    label(mid, oy + ts / 2, visibleNote, "center", colors.ink3);
  }
  if (token) {
    ctx.save(); ctx.fillStyle = colors.highlight; ctx.beginPath(); ctx.arc(token.x, token.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.surface; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
}

function drawConcept(ctx, colors, { Lo, w, params, state, anim, text, fill, border, tile, unknownCell, pointer }) {
  const { cell, L, gx } = Lo;
  const hidden = params.model === "hidden";
  const idx = anim?.idx ?? 0;                     // tosses walked
  const fading = anim?.beatOn && idx > 0;
  const p = fading ? anim.beatP : 1;
  const T = state.T, E = state.E;
  const mc = CONCEPT.TABLE;
  const caption = (b, s) => text(gx, b.y - LAB / 2 - 1, s, colors.ink2);
  const rowLabel = (y, s) => text(gx - 6, y + cell / 2 + 0.5, s, colors.ink3, "right");
  const small = `${colors.fsSm} ${colors.font}`;
  const table = (x0, y0, title, cols, rows, cells, kind, hot, tone, cw = mc, beatRow = null) => {
    text(x0, y0 - LAB / 2 - 1, title, colors.ink2);
    drawProbTable(ctx, colors, text, border, {
      x0, y0, cols: cols.length, rows: rows.length, cw, ch: mc, hdr: LAB, small, kind, hot, cells, tone, beatRow,
      header: (c, x, y) => text(x, y, cols[c], colors.ink3, "center"),
      rowNames: (r) => rows[r],
    });
  };
  const stateNames = hidden ? ["F", "B"] : ["T", "H"];   // the fair and biased coins; or the two faces

  /* 1. The model: the graph on the left, T above E on the right, the two
     patterns under E once the states are hidden. The pointer lights an edge
     and its cell together. */
  /* THE BEAT. A transition exists from day 2 on; day 1 only lands. */
  const step = fading && idx > 1 ? { from: state.src[idx - 2], to: state.src[idx - 1], emit: state.obs[idx - 1] } : null;
  const PH = anim?.drawBar ? PHASES.withDraw : PHASES.walkOnly;
  const drawU = step && PH.draw ? phase(p, ...PH.draw) : 1;          // the marker's sweep, 0..1
  const walkU = step ? easeInOut(phase(p, ...PH.walk)) : 1;         // the token along the transition
  const landU = fading ? phase(p, ...PH.land) : 1;                  // the tile, the destination fill
  const lit = step && drawU >= 1 && landU < 1 ? step : null;         // the arrow taken, while the token is on it
  const token = step && drawU >= 1 && landU < 1 ? alongTransition(twoStateGeometry({ x0: gx, x1: w - 2 * mc - 6 - 36, y: Lo.model.y, h: Lo.model.h, cell, hidden }), step.from, step.to, walkU) : null;
  const beatRow = step && anim?.drawBar && landU < 1 ? { r: step.from, c: drawU >= 1 ? step.to : -1 } : null;
  const ex = w - 2 * mc - 6;
  const eY = Lo.model.y + LAB + 2 * mc + 12 + LAB;
  const geom = twoStateGeometry({ x0: gx, x1: ex - 36, y: Lo.model.y, h: Lo.model.h, cell, hidden });
  let hot = null;
  const tc = cellAt(pointer, ex, Lo.model.y + LAB, 2, 2, mc, mc);
  const ec = hidden ? cellAt(pointer, ex, eY + LAB, 2, 2, mc, mc) : null;
  if (tc) hot = { kind: "T", from: tc.r, to: tc.c };
  else if (ec) hot = { kind: "E", from: ec.r, to: ec.c };
  else hot = edgeAt(geom.edges, pointer);
  table(ex, Lo.model.y, "Transition T", stateNames.map((n) => `to ${n}`), stateNames, [[T[0][0].toFixed(2), T[0][1].toFixed(2)], [T[1][0].toFixed(2), T[1][1].toFixed(2)]], "T", hot, undefined, mc, beatRow);
  if (hidden) {
    table(ex, eY, "Emission E", ["Tails", "Heads"], ["F", "B"], [[E[0][0].toFixed(2), E[0][1].toFixed(2)], [E[1][0].toFixed(2), E[1][1].toFixed(2)]], "E", hot);
  }
  text(gx, Lo.model.y - LAB / 2 - 1, hidden ? "Hidden coins, F fair and B biased, and the tosses they give" : "A sticky coin: Heads and Tails as the states, and the moves between them", colors.ink2);
  drawConceptGraph(ctx, colors, { geom, T, E, hidden, lit, litAlpha: 1, hot, tile, token, names: stateNames, tossNodes: !hidden,
    visibleNote: null,          // the caption already says the state is the toss; the space is the draw bar's
    fillState: step ? { h: step.to, a: landU > 0 && landU < 1 ? 1 - landU : 0 } : null });
  if (step && anim?.drawBar && landU < 1) {
    /* THE DRAW BAR: T's row for the current state as a bar split in its
       proportions, and a marker that sweeps and slows to a stop on the
       outcome — where the randomness of one step comes from. */
    /* Top right on the hidden band, whose nodes sit lower; under the nodes'
       names on the shorter Markov band, where the top right IS the H node. */
    const bw = 120, bh = 12, bx = ex - 36 - bw, by = Lo.model.y + (hidden ? 22 : 102);
    const pStay = T[step.from][step.from];
    text(bx, by - 10, hidden
      ? `draw from T's row for ${step.from === 1 ? "the biased coin" : "the fair coin"}`
      : `draw from T's row after ${step.from === 1 ? "Heads" : "Tails"}`, colors.ink2, "left", `${colors.fsXs} ${colors.font}`);
    fill(bx, by, bw, bh, colors.surface3); border(bx, by, bw, bh);
    fill(bx, by, bw * pStay, bh, colors.highlight, 0.35);
    text(bx + bw * pStay / 2, by + bh + 9, `${hidden ? "stay" : "repeat"} ${pStay.toFixed(2)}`, colors.ink3, "center", `${colors.fsXs} ${colors.font}`);
    text(bx + bw * (1 + pStay) / 2, by + bh + 9, `${hidden ? "switch" : "change"} ${(1 - pStay).toFixed(2)}`, colors.ink3, "center", `${colors.fsXs} ${colors.font}`);
    const target = step.from === step.to ? pStay * 0.45 : pStay + (1 - pStay) * 0.55;
    const sweep = 1 - Math.pow(1 - drawU, 3);
    const mx = bx + bw * target * sweep;
    ctx.fillStyle = colors.ink1; ctx.beginPath(); ctx.moveTo(mx, by - 2); ctx.lineTo(mx - 4, by - 8); ctx.lineTo(mx + 4, by - 8); ctx.closePath(); ctx.fill();
  }
  if (step && hidden && landU > 0 && landU < 1) {
    /* The toss drops from the new coin down its emission arrow. */
    const from = geom.S[step.to], to = geom.O[step.emit];
    const dx = from.x + (to.x - from.x) * landU, dy = from.y + (to.y - from.y) * landU;
    tile(dx - 10, dy - 10, step.emit, 0.9, 20);
  }

  /* 2. The walk: one tile per toss, the newest fading in. The coin row is
     letters on open tiles — a state, not a value; the toss row is the
     filled / open tiles every other row in the widget uses. */
  caption(Lo.walk, hidden
    ? `The walk, ${idx} of ${L} tosses: the coin is hidden, the toss is seen`
    : `The walk, ${idx} of ${L} tosses: each toss is a state of the chain`);
  const cx = (i) => gx + i * cell;
  const coinTile = (x, y, coin, alpha, washed) => {
    ctx.save(); ctx.globalAlpha = alpha;
    fill(x, y, cell, cell, washed ? colors.reference : colors.surface3, washed ? 0.22 : 1); border(x, y, cell, cell);
    text(x + cell / 2, y + cell / 2 + 0.5, stateNames[coin], colors.ink1, "center", `600 ${Math.max(9, Math.round(cell * 0.45))}px ${colors.font}`);
    ctx.restore();
  };
  const rows = hidden ? [["coin", true], ["toss", false]] : [["toss", false]];
  rows.forEach(([name, isHiddenRow], r) => {
    const y = Lo.walk.y + r * cell;
    rowLabel(y, name);
    for (let i = 0; i < L; i += 1) {
      if (i >= idx) { border(cx(i), y, cell, cell); continue; }
      const alpha = fading && i === idx - 1 ? landU : 1;
      if (name === "toss") { tile(cx(i), y, state.obs[i], alpha, cell); continue; }
      if (isHiddenRow && !params.truth) { unknownCell(cx(i), y, true); continue; }
      coinTile(cx(i), y, state.src[i], alpha, isHiddenRow);   // the truth, asked for, in its wash
    }
  });

  /* 3. What the walk lets you count, beside what made it. The SAME table
     on both stages, over the record of tosses: on the Markov stage it is
     the estimate of T, on the hidden stage it is not T at all. */
  const n = Math.max(0, idx - 1);
  const seq = state.obs;
  const cnt = [[0, 0], [0, 0]];
  for (let i = 1; i < idx; i += 1) cnt[seq[i - 1]][seq[i]] += 1;
  const rowTot = cnt.map((r) => r[0] + r[1]);
  const shown = cnt.map((r, a) => r.map((c) => (rowTot[a] ? `${c} · ${(c / rowTot[a]).toFixed(2)}` : `${c}`)));
  const countNames = ["T", "H"];
  const CW = 62;   // "12 · 0.86" needs the room
  table(gx, Lo.counts.y, `Transitions between tosses, ${n} counted: count · share of row`,
    countNames.map((s) => `to ${s}`), countNames, shown, "counts", null,
    (r, c) => (hidden ? colors.ink2 : (r === c ? colors.ink1 : colors.ink2)), CW);
  const note = hidden
    ? "not T: the tosses are not the coins"
    : "the shares approach T's rows: counting is the estimate";
  text(gx + 2 * CW + 24, Lo.counts.y + LAB + mc - 2, note, colors.ink3, "left");
}


/* The concept tab's worked line: the toss's draw, in T's and E's numbers. */
function conceptCardLines(state, idx, params) {
  const hidden = params.model === "hidden";
  const { T, E, src, obs, stay } = state;
  const tossName = (m) => (m === 1 ? "Heads" : "Tails");
  const name = (h) => (hidden ? (h === 1 ? "the biased coin" : "the fair coin") : tossName(h));
  const Name = (h) => (h === 1 ? "The biased coin" : "The fair coin");
  let stays = 0;
  for (let k = 1; k < idx; k += 1) if (src[k] === src[k - 1]) stays += 1;
  if (idx === 0) {
    const lines = [["Model", `A Markov model is a set of states and a transition table ${MATH.T}, one row per current state, each row summing to 1.`]];
    if (hidden) {
      lines.push(["States", "Here the states are two coins, one fair and one biased, and the coin may be switched between tosses."]);
      lines.push(["Rule", `The next state depends only on the current one, not on earlier tosses. Each toss, the coin in play is drawn from the current coin's row of ${MATH.Tname}.`]);
      lines.push(["Hidden", `The coin is not seen. Each toss shows Heads or Tails by ${MATH.E}: the fair coin lands Heads half the time, the biased coin 0.80. Only the toss is recorded.`]);
    } else {
      lines.push(["States", "Here the states are the two faces of one coin, Heads and Tails: the record of tosses is the sequence of states."]);
      lines.push(["Rule", `The next toss depends only on the current one, not on earlier tosses. The coin is sticky: after Heads, Heads again with ${stay.toFixed(2)}, the diagonal of ${MATH.Tname}.`]);
      lines.push(["Count", `Every state is in the record, so ${MATH.Tname} can be estimated by counting the transitions between tosses.`]);
    }
    return lines;
  }
  const i = idx - 1;
  const lines = [];
  if (i === 0) lines.push(["Toss 1", hidden ? `Start with ${name(src[0])}, each coin equally likely.` : `Start with ${name(src[0])}, each face equally likely.`]);
  else {
    const a = src[i - 1], b = src[i];
    lines.push([`Toss ${i + 1}`, hidden
      ? `From ${name(a)}. T's row: stay ${T[a][a].toFixed(2)}, switch ${T[a][1 - a].toFixed(2)}. Drew ${a === b ? "stay" : "switch"}: ${a === b ? `${name(b)} again` : name(b)}.`
      : `After ${name(a)}. T's row: repeat ${T[a][a].toFixed(2)}, change ${T[a][1 - a].toFixed(2)}. Drew ${a === b ? "repeat" : "change"}: ${name(b)}.`]);
  }
  if (hidden) lines.push(["Emits", `${Name(src[i])} lands Heads with ${E[src[i]][1].toFixed(2)}, Tails with ${E[src[i]][0].toFixed(2)}. Came up ${tossName(obs[i])}. Only the toss is recorded.`]);
  if (idx > 1) lines.push(["So far", hidden
    ? `Stayed with the same coin on ${stays} of ${idx - 1} transitions. These cannot be counted from the record, which shows only tosses.`
    : `Repeated the last toss on ${stays} of ${idx - 1} transitions, ${(stays / (idx - 1)).toFixed(2)}, against T's ${stay.toFixed(2)}. Counted straight off the record.`]);
  return lines;
}

/* THE FORMULAS IN THE CARD. MathML where the engine renders it, with a plain
   fallback where it does not (widget 14's rule: an older engine drops the
   <math> wrapper and runs the symbols together). One <math> per fragment,
   and each short enough not to need a line break inside it. */
const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`, mo = (t) => `<mo>${t}</mo>`, mn = (t) => `<mn>${t}</mn>`;
const msub = (b, x) => `<msub>${b}${x}</msub>`;
const MATH = {
  /* T_ij = P(s_{t+1} = j | s_t = i) */
  T: MATHML
    ? mml(`${msub(mi("T"), "<mrow><mi>i</mi><mi>j</mi></mrow>")}${mo("=")}${mi("P")}${mo("(")}${msub(mi("s"), "<mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow>")}${mo("=")}${mi("j")}${mo("|")}${msub(mi("s"), mi("t"))}${mo("=")}${mi("i")}${mo(")")}`)
    : "T, with T[i, j] = P(next state j | current state i)",
  Tname: MATHML ? mml(mi("T")) : "T",
  /* E_ik = P(o_t = k | s_t = i) */
  E: MATHML
    ? mml(`${msub(mi("E"), "<mrow><mi>i</mi><mi>k</mi></mrow>")}${mo("=")}${mi("P")}${mo("(")}${msub(mi("o"), mi("t"))}${mo("=")}${mi("k")}${mo("|")}${msub(mi("s"), mi("t"))}${mo("=")}${mi("i")}${mo(")")}`)
    : "E, with E[i, k] = P(observation k | state i)",
  /* score_t(s) = P(o_t | s) · max_{s'} score_{t-1}(s') · T_{s' s} */
  recurrence: MATHML
    ? mml(`${msub(mi("score"), mi("t"))}${mo("(")}${mi("s")}${mo(")")}${mo("=")}${mi("P")}${mo("(")}${msub(mi("o"), mi("t"))}${mo("|")}${mi("s")}${mo(")")}${mo("·")}<munder><mo>max</mo><mrow><msup><mi>s</mi><mo>′</mo></msup></mrow></munder>${mo("[")}${msub(mi("score"), "<mrow><mi>t</mi><mo>−</mo><mn>1</mn></mrow>")}${mo("(")}<msup><mi>s</mi><mo>′</mo></msup>${mo(")")}${mo("·")}${msub(mi("T"), "<mrow><msup><mi>s</mi><mo>′</mo></msup><mi>s</mi></mrow>")}${mo("]")}`)
    : "score_t(s) = P(o_t | s) × max over s′ of score_{t−1}(s′) × T[s′, s]",
};

/* THE WORKED LINE — one node's arithmetic, above the figure, for the column
   the walk is at. The tables give E and T and the nodes show 0.20, 0.94,
   0.03, and nothing joined them: a student could not check one cell by
   hand, which is the whole virtue of a dynamic-programming table (the
   review of 2026-09-06). So the card states the recurrence with the actual
   numbers substituted: score(state) = P(observation | state) × the largest
   of (previous score × transition). The previous scores are the previous
   column's relative scores, so the scaled results equal the nodes exactly —
   the driver asserts it. During the trace-back it says which stored winner
   the path just followed. Same DOM route as widget 40's card: a `.w-math`
   inserted above the figure and rewritten only when its key changes.

   Each line is [label, body]. The label sits in a gutter and the body's
   continuation lines start under the body, not under the label. The shared
   `.w-math-eq` rule carries an 8.3em hanging indent written for widget 14's
   sum; on prose it had nothing to hang from, so every wrapped sentence
   restarted a third of the way across (Kenneth's screenshot, 2026-09-06;
   `_lab/hmm-card.html` has the four layouts he chose C from). The gutter
   holds the widest label, "Site 28", at the card's font size. */
const GUTTER = "5.2em";
const CARD_MIN = "12.3em";    // the three resting rows, wrapped, at the narrowest side column (135px in a 535px column); no jog as the walk runs
let cardHost = null, cardKey = null;

function cardLines(state, idx, params) {
  if (state.kind === "concept") return conceptCardLines(state, idx, params);
  const toy = state.kind === "mood";
  const { K, L, rho } = state;
  const TR = state.trellis;
  const pos = toy ? "day" : "site";
  const Pos = toy ? "Day" : "Site";
  const name = (h) => (toy ? `P${h + 1}` : `h${h + 1}`);
  const stay = 1 - rho, move = rho / (K - 1);
  const known = (i) => !state.stages.at(-1).sites[i].blank;
  const obsName = (i) => (toy ? (state.truthAllele[i] === 1 ? "Happy" : "Sad") : state.panel.letters[i][state.truthAllele[i]]);
  const emitAt = (i, h) => (state.panel.hap[h][i] === state.truthAllele[i] ? 1 - state.eps : state.eps);
  const f2 = (x) => x.toFixed(2);
  const fwd = Math.min(idx, L), back = Math.max(0, idx - L);

  if (fwd === 0) {
    return [
      ["Rule", `Each column: ${MATH.recurrence} — the emission at this position times the best of the previous column's scores carried over a transition.`],
      ["Blank", `A blank column has no observation, so its score is that largest product alone.`],
      ["Trace", `The state that gave the largest product is stored; the trace-back follows those stored winners from the best final node.`],
    ];
  }
  if (back === 0) {
    const i = fwd - 1;
    /* Products for every state, from the previous column's relative scores. */
    const prods = [], froms = [];
    for (let h = 0; h < K; h += 1) {
      let best = -1, from = h;
      if (i === 0) best = 1 / K;
      else for (let g = 0; g < K; g += 1) {
        const t = TR.score[i - 1][g] * (g === h ? stay : move);
        if (t > best) { best = t; from = g; }
      }
      prods.push(best * (known(i) ? emitAt(i, h) : 1));
      froms.push(from);
    }
    const tot = prods.reduce((a, b) => a + b, 0);
    const show = toy ? [0, 1] : [...Array(K).keys()].sort((a, b) => prods[b] - prods[a]).slice(0, 2);
    const term = (g, h) => `${name(g)} ${f2(TR.score[i - 1][g])} × ${g === h ? "stay" : "switch"} ${f2(g === h ? stay : move)}`;
    const lines = show.map((h) => {
      const g = froms[h];
      const carried = i === 0 ? 1 / K : TR.score[i - 1][g] * (g === h ? stay : move);
      const how = i === 0 ? `start 1/${K}`
        : toy ? `the larger of ${term(0, h)}, ${term(1, h)}`
          : `the largest, ${term(g, h)}`;
      return [name(h), known(i)
        ? `${Pos} ${i + 1}: ${carried.toFixed(3)} (${how}) × P(${obsName(i)} | ${name(h)}) ${f2(emitAt(i, h))} = ${prods[h].toFixed(3)}`
        : `${Pos} ${i + 1}: ${carried.toFixed(3)} (${how}); no observation to multiply by`];
    });
    lines.push(["Scaled", `The column sums to 1${toy ? "" : `, over all ${K}`}: ${show.map((h) => `${name(h)} ${f2(prods[h] / tot)}`).join(", ")}${toy ? "" : ", …"}`]);
    return lines;
  }
  const i = L - back;                         // the column just traced
  if (i === L - 1) {
    return [
      ["Trace", `Starts at the best final node: ${name(TR.path[i])} at ${pos} ${L}, relative score ${f2(TR.score[i][TR.path[i]])}.`],
      ["Step", `Each step follows the winner stored in the forward pass, one column left.`],
    ];
  }
  const lines = [
    [`${Pos} ${i + 1}`, `${name(TR.path[i + 1])} at ${pos} ${i + 2} stored ${name(TR.path[i])} as its winner, so the path here is ${name(TR.path[i])}.`],
  ];
  if (i > 0) lines.push(["Left", `${i} column${i === 1 ? "" : "s"} to trace.`]);
  else lines.push(["Done", `Traced to ${pos} 1: one state per ${pos}, the single most likely sequence. The imputed values are read off it.`]);
  return lines;
}

function renderCard(state, idx, params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  /* The Concept tab's resting card is four rows with MathML in two of them,
     129px at the usual width and 146px once the rail stacks above the figure;
     reserve the larger so the walk, whose card is three rows, does not jog
     the figure (3.4k). The trellis tabs keep the smaller reserve. */
  cardHost.style.minHeight = state.kind === "concept" ? "13.4em" : CARD_MIN;
  const key = ["view", "idx", "seed", "missing", "K", "every", "sample", "model", "repeat", "stay"]
    .map((k) => (k === "idx" ? idx : params[k])).join("|");
  if (key === cardKey) return;
  cardKey = key;
  cardHost.innerHTML = cardLines(state, idx, params)
    .map(([label, body]) => `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">${label}</span>${body}</div>`).join("");
}

/* The imputed value follows the notebook: read off the decoded template at
   that position — the pattern's mood that day, the copied haplotype's allele
   at that site. Its probability is the posterior's, P(that value | record). */
function imputedCall(state, i) {
  const h = state.trellis.path[i];
  const call = state.panel.hap[h][i];
  const p1 = state.stages.at(-1).sites[i].p1;
  return { call, conf: call === 1 ? p1 : 1 - p1 };
}

defineWidget({
  slug: "hmm",
  title: "Hidden Markov Model",
  subtitle:
    "A hidden Markov model infers hidden states from the observations they produce. " +
    "A missing observation is read off the decoded state, with its probability. " +
    "Genotype imputation fills a SNP array from a reference panel this way.",
  status: "shipped",
  layout: "side",
  /* The model band answers to the pointer: hovering an edge of the graph
     lights its cell in T or E, hovering a cell lights its edge. An
     inspector, not a control — nothing is written, and with no pointer the
     figure is exactly as before. */
  pointer: true,
  height: (v) => layout(v.w, v).height,

  /* One tab's marks at a time — the legend must match the graph. */
  legend: ({ params }) => {
    if (params.view === "concept") {
      if (params.model !== "hidden") {
        return [
          { token: "theory", label: "Heads (filled); Tails is open — the state at each toss", mark: "bar" },
          { token: "highlight", label: "The transition taken this toss", mark: "line" },
        ];
      }
      const entries = [
        { token: "ink-1", label: "F fair coin, B biased coin: the state at each toss", mark: "bar" },
        { token: "highlight", label: "The transition taken this toss, and its emission", mark: "line" },
        { token: "theory", label: "Heads (filled); Tails is open — the toss", mark: "bar" },
        { token: "unknown", label: "The hidden coin", mark: "bar" },
      ];
      if (params.truth) entries.push({ token: "reference", label: "Ground truth: the coin each toss", mark: "bar" });
      return entries;
    }
    const toy = params.view === "toy";
    const entries = toy
      ? [
        { token: "theory", label: "Happy (filled); Sad is open", mark: "bar" },
        { token: "unknown", label: "Not recorded", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor into each node; once traced, the most likely sequence of patterns", mark: "line" },
        { token: "ink-3", label: "The candidate that lost at the current column", mark: "dash" },
        { token: "posterior", label: "Posterior: which pattern the day is in", mark: "bar" },
      ]
      : [
        { token: "theory", label: "The base at each site: the alternate allele filled, the reference allele open", mark: "bar" },
        { token: "unknown", label: "Not typed on the array", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor into each node; once traced, the most likely copied haplotype at each site", mark: "line" },
        { token: "posterior", label: "Posterior: which haplotype is being copied", mark: "bar" },
      ];
    if (params.truth) entries.push({ token: "reference", label: toy ? "Ground truth: the pattern the record follows" : "Ground truth: the segments the sample copies", mark: "bar" });
    return entries;
  },

  params: {
    view: {
      type: "segmented",
      label: "View",
      options: [
        /* Three-up, the labels have to be short or the third truncates in the
           rail: "Biological example" became "Biology" when the Concept tab
           arrived. The detail line carries the rest. */
        { value: "concept", label: "Concept", detail: "a coin toss as a Markov model, then a coin hidden behind the tosses" },
        { value: "toy", label: "Toy model", detail: "two known patterns; a record of moods with days missing" },
        { value: "biological", label: "Biology", detail: "a SNP array imputed from a reference panel" },
      ],
      default: "concept",
    },

    /* THE RAIL IN GROUPS BY KIND. Toy: the sequence, then the model. Biological:
       the design (the two choices a study makes), the truth (simulated, so the
       imputation can be checked), then the model. `seed` and the truth toggle
       are one field each, placed so they fall under The sequence on the toy
       and under The truth on the biological tab. The model sections carry no
       control any more — the switch rate is fixed — and stay for their one
       line: where the numbers on the figure come from. */
    /* THE TWO STAGES OF THE CONCEPT TAB, in the lesson's order. A DATA
       parameter, not a display one: the Markov record is a sticky coin's
       tosses and the hidden record is the casino's, two mechanisms and so
       two sequences, and switching must redraw the world rather than relabel
       it. (Until 2026-09-06 this was Visible | Hidden over ONE walk, and a
       display change; the inversion made the two stages different models.)
       Labels are one word each so the pair fits the rail; the detail line
       carries the full name. */
    model: {
      type: "segmented", label: "The model",
      options: [
        { value: "markov", label: "Markov", detail: "a Markov model: the states are the tosses, Heads and Tails, of one sticky coin" },
        { value: "hidden", label: "Hidden Markov", detail: "a hidden Markov model: the state is the coin, fair or biased, and it is not seen; each toss shows Heads or Tails by E" },
      ],
      default: "markov",
      when: { param: "view", equals: "concept" },
    },
    /* One slider per stage, each shown only in its stage, so a URL says
       which quantity it set: P(repeat) is about the toss, P(stay) about the
       coin. Kenneth's pick, two over one relabelled. */
    coin: {
      type: "section", label: "The coin",
      detail: "one sticky coin: the next toss depends on the last. At 0.5 it has no memory and is an ordinary coin",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "markov" }] },
    },
    repeat: {
      type: "choice", label: "P(next toss repeats the last)",
      options: ["0.5", "0.7", "0.8", "0.9", "0.95"].map((v) => ({ value: v, label: v,
        detail: "model parameter: the diagonal of T; counted straight from the record, because every state is in it" })),
      default: "0.8",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "markov" }] },
    },
    chain: {
      /* "The game", "biased": Kenneth's words, 2026-09-06, over the casino
         and its loaded coin — the lesson says game and biased, and the coin's
         letter follows the word: B, not L. Source comments keep casino and
         loaded, which is where the example came from. */
      type: "section", label: "The game",
      detail: "a fair coin and a biased one, and the transition table for switching between them",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "hidden" }] },
    },
    stay: {
      type: "choice", label: "P(stay with the same coin)",
      options: ["0.5", "0.7", "0.8", "0.9", "0.95"].map((v) => ({ value: v, label: v,
        detail: "model parameter: the diagonal of T; in practice counted from tosses whose coin was known" })),
      default: "0.8",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "hidden" }] },
    },
    seq: {
      type: "section", label: "The sequence",
      detail: "a record that follows one of the two patterns, with days unrecorded. Seed 1 with three missing is the worked example",
      when: { param: "view", equals: "toy" },
    },

    /* EVERY CONTROL SAYS WHAT KIND OF THING IT IS. Three kinds sit in one
       rail and looked alike: SIMULATION dials that make a truth to compare
       against (nobody sets these in practice), MODEL PARAMETERS (learnt from
       data, or derived from a genetic map and the panel), and DESIGN CHOICES
       (the two a study actually makes: panel size, array density). Kenneth's
       review question, 2026-09-06: which are learnt from data, which does a
       user tweak. The detail line answers it where the reader's hand is. */
    missing: {
      type: "int", label: "Days not recorded", min: 0, max: 4, default: 3,
      detail: "simulation: the days left unrecorded, completely at random",
      when: { param: "view", equals: "toy" },
    },

    design: {
      type: "section", label: "The design",
      detail: "the two choices a study makes",
      when: { param: "view", equals: "biological" },
    },
    K: {
      type: "choice", label: "Reference haplotypes",
      options: KS.map((v) => ({ value: v, label: v, detail: "design choice: how many haplotypes were sequenced for the panel" })),
      default: "6",
      when: { param: "view", equals: "biological" },
    },
    every: {
      type: "choice", label: "Sites typed, one in",
      options: EVERY.map((v) => ({ value: v, label: v, detail: "design choice: how densely the array types" })),
      default: "4",
      when: { param: "view", equals: "biological" },
    },
    truthBio: {
      type: "section", label: "The truth",
      detail: "simulated, so the imputation can be checked",
      when: { param: "view", equals: "biological" },
    },
    /* THE ONE SWITCHING SCENARIO THAT DECODES AS A SWITCH. The notebook never
       switches, so the default follows one haplotype; the recombinant is the
       extra, and it works because the two founders differ at nine-tenths of
       sites, so the switch is pinned to the typed sites either side and the
       sites between them are where the posterior is uncertain. */
    sample: {
      type: "segmented", label: "Sample",
      options: [
        { value: "one", label: "One haplotype", detail: "simulation: the sample copies a single haplotype of the panel" },
        { value: "recombinant", label: "Recombinant", detail: "simulation: a past crossover in this region, so the sample copies h1 on one side of it and h2 on the other" },
      ],
      default: "one",
      when: { param: "view", equals: "biological" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1, detail: "simulation: another draw of the same setting" },

    truth: {
      type: "bool", label: "Show the ground truth", default: false, display: true,
      detail: "the true states, and the true values at the blanks",
    },

    /* WHERE THE NUMBERS COME FROM, said once per tab. The toy's E and T are
       set here, as the notebook sets them by hand; the biological tab's are
       derived — T from the switch rate, E read off the panel. */
    modelMarkov: {
      type: "section", label: "The model",
      detail: "T is what you set, and it is all there is: no emission table, because the state is the toss. "
        + "In practice T is counted from the record, one row per state.",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "markov" }] },
    },
    modelConcept: {
      type: "section", label: "The model",
      detail: "T is what you set. E is given by the coins: the fair coin lands Heads half the time, "
        + "the biased coin 0.80. In practice both are counted from tosses whose coin was known, or fitted "
        + "by expectation–maximisation.",
      when: { all: [{ param: "view", equals: "concept" }, { param: "model", equals: "hidden" }] },
    },
    modelToy: {
      type: "section", label: "The model",
      detail: "The record follows one pattern day by day, so E at each day puts 0.9 on that "
        + "pattern's mood. T is fixed at 0.10. In practice both are counted from sequences whose "
        + "patterns are known, or fitted by expectation–maximisation.",
      when: { param: "view", equals: "toy" },
    },
    modelBio: {
      type: "section", label: "The model",
      detail: "T is fixed at a switch rate of 0.10, shared over the other haplotypes; in "
        + "practice it comes from a genetic map. E is read off the reference panel at each "
        + "site, with 0.02 allowed for a mismatch.",
      when: { param: "view", equals: "biological" },
    },


    speed: {
      type: "choice", label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
  },

  compute: ({ params, rng }) => {
    /* Seed 1 with three days missing is the notebook's own case, verbatim;
       the builder recognises it from the seed. */
    if (params.view === "concept") {
      return M.buildConcept({ rng, model: params.model, stay: Number(params.model === "hidden" ? params.stay : params.repeat) });
    }
    if (params.view === "toy") return M.buildToy({ rng, missing: params.missing, seed: params.seed });
    return M.buildGenotype({ rng, K: Number(params.K), every: Number(params.every), sample: params.sample });
  },

  animation: {
    /* Every press handles one column: forward while columns remain, then
       one column of the trace-back. */
    stepLabel: { param: "view", labels: { concept: "Next toss", toy: "Next column", biological: "Next column" }, default: "Next column" },
    stepTitle: "Concept: draw the next toss's coin. Toy and biology: compute the next trellis column; once all are computed, trace back one column",
    runLabel: "Play",
    runTitle: "Run to the end, one unit at a time",

    init: ({ params, state, fromScratch }) => {
      const T = M.animationUnits(state);
      const idx = fromScratch ? 0 : Math.min(params.shown, T);
      /* beatP is how far the newest unit has faded in (0..1); beatOn says a
         unit is genuinely in flight, so nothing half-faded outlives motion. */
      return { idx, t: 0, beatOn: false, beatP: 1, done: idx >= T };
    },

    advance(anim, { dt, params, state }) {
      const T = M.animationUnits(state);
      if (anim.mode === "step") {
        if (!anim.beatOn) {
          if (anim.idx >= T) { anim.done = true; return false; }
          anim.idx += 1;
          anim.beatOn = true;
          anim.beatP = 0;
          anim.drawBar = true;                       // a step shows the whole mechanism
        }
        anim.beatP += dt / (state.kind === "concept" ? STEP_MS_CONCEPT : STEP_MS);
        if (anim.beatP >= 1) {
          anim.beatOn = false; anim.beatP = 1;
          anim.done = anim.idx >= T;
          return false;
        }
        return true;
      }
      const sp = SPEEDS[params.speed] ?? SPEEDS.medium;
      anim.t += dt;
      while (anim.t >= sp.ms && anim.idx < T) { anim.t -= sp.ms; anim.idx += 1; }
      if (anim.idx >= T) {
        anim.beatOn = false; anim.beatP = 1; anim.done = true;
        return false;
      }
      if (sp.choreo && anim.idx > 0) { anim.beatOn = true; anim.beatP = Math.min(1, anim.t / sp.ms); anim.drawBar = Boolean(sp.drawBar); }
      else { anim.beatOn = false; anim.beatP = 1; }
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const Lo = layout(w, { ...params, w });
    const { cell, K, L, gx } = Lo;
    const toy = state.kind === "mood";
    const idx = anim?.idx ?? 0;
    renderCard(state, idx, params);
    const fading = anim?.beatOn && idx > 0;
    const p = fading ? anim.beatP : 1;
    const cx = (i) => gx + i * cell;

    const text = (x, y, s, colour, align = "left", font = `${colors.fsXs} ${colors.font}`) => {
      ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.font = font;
      ctx.fillText(s, x, y);
    };
    const fill = (x, y, cw, ch, colour, alpha = 1) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.fillRect(x, y, cw, ch); ctx.restore();
    };
    const border = (x, y, cw, ch) => {
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    };
    const segment = (x0, y0, x1, y1, colour, width, alpha = 1, dash = null) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = "round";
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
    };
    const caption = (b, s) => text(gx, b.y - LAB / 2 - 1, s, colors.ink2);
    const rowLabel = (y, s) => text(gx - 6, y + cell / 2 + 0.5, s, colors.ink3, "right");
    /* An observation tile: filled for Happy / the alternate allele, open for
       Sad / the reference allele, and its letter — H or S on the toy, the
       base at that site on the biological tab, as the notebook's strings.
       The fill is --c-theory: a known template is the claim the record is
       checked against, and one warm hue against the blue trellis and violet
       posterior reads as data against computation. Kenneth picked it from
       `_lab/hmm-palette.html` (B of four) over ink-and-paper, which he called
       drab, and over two-hue pairs that made every tile compete. */
    const tile = (x, y, a, alpha = 1, size = cell, i = null) => {
      fill(x, y, size, size, a === 1 ? colors.theory : colors.surface3, alpha);
      border(x, y, size, size);
      const genotype = state.kind === "genotype";
      const letter = genotype ? (i === null ? "" : state.panel.letters[i][a]) : state.kind === "concept" ? (a === 1 ? "H" : "T") : (a === 1 ? "H" : "S");
      if (letter) {
        ctx.save(); ctx.globalAlpha = alpha;
        text(x + size / 2, y + size / 2 + 0.5, letter, a === 1 ? colors.surface : colors.ink1, "center",
          `600 ${Math.round(size * (genotype ? 0.6 : 0.5))}px ${colors.font}`);
        ctx.restore();
      }
    };
    const unknownCell = (x, y, mark) => {
      fill(x, y, cell, cell, colors.unknown, 0.16);
      border(x, y, cell, cell);
      if (mark) text(x + cell / 2, y + cell / 2 + 0.5, "?", colors.ink3, "center", `600 ${Math.round(cell * 0.5)}px ${colors.font}`);
    };
    const statePath = (block, path, colour, dash) => {
      ctx.save();
      ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.lineJoin = "round";
      if (dash) ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < L; i += 1) {
        const y = block.y + path[i] * cell + cell / 2;
        if (i === 0) ctx.moveTo(cx(i) + cell / 2, y); else ctx.lineTo(cx(i) + cell / 2, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    const stateName = (h) => (toy ? `P${h + 1}` : `h${h + 1}`);
    const probBar = (x, y, conf) => fill(x + 1, y + cell + 1, (cell - 2) * Math.max(0, (conf - 0.5) / 0.5), BAR_H - 2, colors.posterior);

    if (state.kind === "concept") {
      drawConcept(ctx, colors, { Lo, w, params, state, anim, text, fill, border, tile, unknownCell, pointer });
      return;
    }

    /* The animation counter: forward columns, then columns traced back. The
       posterior is the full record's, drawn from the start. */
    const stage = state.stages.at(-1);
    const fwd = Math.min(idx, L);                 // trellis columns computed
    const back = Math.max(0, idx - L);            // columns traced back
    const traced = back >= L;
    /* The site the walk is at: the column being computed, or being traced. */
    const walkSite = back > 0 ? Math.max(0, L - back) : Math.max(0, fwd - 1);

    /* 1. The record, the whole of it from the start, drawn directly above the
       trellis that reads it. */
    caption(Lo.obs, toy
      ? `Moods on record: ${state.order.length} of ${L} days`
      : `Array: ${state.order.length} of ${L} sites typed`);
    rowLabel(Lo.obs.y, toy ? "mood" : "array");
    for (let i = 0; i < L; i += 1) {
      if (stage.sites[i].blank) unknownCell(cx(i), Lo.obs.y, true);
      else tile(cx(i), Lo.obs.y, state.truthAllele[i], 1, cell, i);
    }
    if (fwd > 0 && back === 0) {
      /* The column being computed, marked on the record it reads. */
      ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
      ctx.strokeRect(cx(fwd - 1) + 1, Lo.obs.y + 1, cell - 2, cell - 2);
    }

    /* 2. The model — emission at the column being read, the states, the
       transition — then the templates it reads from. */
    drawRingModel(ctx, colors, { Lo, state, stage, site: walkSite, w, tile, text, border, stateName, pointer });
    caption(Lo.panel, toy
      ? (params.truth ? "The two patterns; the record follows the marked one" : "The two patterns, known")
      : (params.truth ? `Reference panel, ${K} sequenced haplotypes; the sample copies the marked segments` : `Reference panel: ${K} sequenced haplotypes`));
    for (let h = 0; h < K; h += 1) {
      const y = Lo.panel.y + h * cell;
      rowLabel(y, stateName(h));
      for (let i = 0; i < L; i += 1) tile(cx(i), y, state.panel.hap[h][i], 1, cell, i);
    }
    if (params.truth) {
      /* THE GROUND TRUTH WHERE IT CAN BE READ: a box round each run of the
         template the record actually follows, so a student sees the record
         come out of P2, or out of h2 then h4 (Kenneth, 2026-09-06). */
      /* A light wash over the run and an ink outline (E of five in
         `_lab/hmm-truth-mark.html`; the dashed grey box that shipped first
         vanished against the orange tiles and the grid). */
      ctx.save();
      let start = 0;
      for (let i = 1; i <= L; i += 1) {
        if (i === L || state.src[i] !== state.src[start]) {
          const x = cx(start), y = Lo.panel.y + state.src[start] * cell, wRun = (i - start) * cell;
          ctx.globalAlpha = 0.22; ctx.fillStyle = colors.reference; ctx.fillRect(x, y, wRun, cell);
          ctx.globalAlpha = 1; ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, wRun - 2, cell - 2);
          start = i;
        }
      }
      ctx.restore();
    }
    if (fwd > 0 && back === 0) {
      /* The template column the trellis is reading: the emission at this position. */
      ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
      ctx.strokeRect(cx(fwd - 1) + 1, Lo.panel.y + 1, cell - 2, K * cell - 2);
    }

    /* 3. The Viterbi trellis: forward, the survivor into each node (and on
       the toy the candidate that lost); then the trace-back lighting the
       path. Numbers only where a node can hold them. */
    {
      const TR = state.trellis;
      const B = Lo.trellis;
      const ncx = (i) => cx(i) + cell / 2, ncy = (h) => B.y + h * cell + cell / 2;
      const R = Math.round(cell * (K === 2 ? 0.32 : 0.36));
      const numbers = cell >= 26;
      const numPx = Math.max(9, Math.min(12, Math.round(cell * 0.3)));
      const litFrom = L - back;
      const onPath = (i, h) => back > 0 && i >= litFrom && TR.path[i] === h;
      const colAlpha = (i) => (fading && back === 0 && i === fwd - 1 ? p : 1);   // the newest column fades in
      const litAlpha = (i) => (fading && back > 0 && i === litFrom ? p : 1);     // the newest traced column fades in
      const noun = toy ? "sequence of patterns" : "copied haplotype at every site";
      caption(B, back > 0
        ? (traced ? `Viterbi trellis: the most likely ${noun}, traced back` : `Viterbi trellis: trace-back, ${back} of ${L} columns`)
        : fwd === 0 ? "Viterbi trellis: the best path into each node, column by column"
          : `Viterbi trellis: forward, column ${fwd} of ${L}`);
      for (let h = 0; h < K; h += 1) rowLabel(B.y + h * cell, stateName(h));
      for (let i = 1; i < fwd; i += 1) for (let h = 0; h < K; h += 1) {
        const from = TR.back[i][h];
        const lit = onPath(i, h) && onPath(i - 1, from);
        if (i === fwd - 1 && back === 0) {
          for (let g = 0; g < K; g += 1) {
            if (g === from) segment(ncx(i - 1), ncy(g), ncx(i), ncy(h), colors.empirical, 2.2, colAlpha(i));
            else if (K === 2) segment(ncx(i - 1), ncy(g), ncx(i), ncy(h), colors.ink3, 1, 0.55 * colAlpha(i), [3, 3]);
          }
        } else if (lit) segment(ncx(i - 1), ncy(from), ncx(i), ncy(h), colors.empirical, 3.5, litAlpha(i - 1));
        else segment(ncx(i - 1), ncy(from), ncx(i), ncy(h), back > 0 ? colors.ink3 : colors.empirical, 1.4, back > 0 ? 0.3 : 0.8);
      }
      for (let i = 0; i < L; i += 1) for (let h = 0; h < K; h += 1) {
        const x = ncx(i), y = ncy(h);
        const dim = back > 0 && !onPath(i, h);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
        if (i < fwd) {
          ctx.save(); ctx.globalAlpha = beliefAlpha(TR.score[i][h]) * (dim ? 0.35 : 1) * colAlpha(i);
          ctx.fillStyle = colors.empirical; ctx.fill(); ctx.restore();
          ctx.save(); ctx.globalAlpha = onPath(i, h) ? litAlpha(i) : colAlpha(i);
          ctx.strokeStyle = onPath(i, h) ? colors.empirical : colors.grid; ctx.lineWidth = onPath(i, h) ? 2.5 : 1; ctx.stroke();
          if (numbers) text(x, y + 0.5, TR.score[i][h].toFixed(2), TR.score[i][h] > 0.55 && !dim ? colors.surface : colors.ink1, "center", `${numPx}px ${colors.font}`);
          ctx.restore();
        } else { ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.stroke(); }
        if (i === fwd - 1 && back === 0) {
          ctx.beginPath(); ctx.arc(x, y, R + 3, 0, Math.PI * 2); ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      if (params.truth) statePath(B, state.src, colors.reference, true);
    }

    /* 4. The posterior strip, and the paths through it. EMPTY until the
       trace-back reaches the first position: drawn from the start it gave the
       answer away — which pattern each day was in — before a single press
       (2.1). It arrives with the Viterbi line, so the two readings of the
       same record land together. */
    /* The one sentence that keeps the two grids apart: the trellis kept the
       single best path (a max), the posterior adds up every path (a sum). */
    caption(Lo.strip, (toy ? "Posterior P(pattern | moods on record)" : "Posterior P(copied haplotype | typed sites)")
      + (traced ? ": every path summed, where Viterbi kept one" : ", once the path is traced"));
    for (let h = 0; h < K; h += 1) {
      const y = Lo.strip.y + h * cell;
      rowLabel(y, stateName(h));
      for (let i = 0; i < L; i += 1) {
        if (traced) fill(cx(i), y, cell, cell, colors.posterior, beliefAlpha(stage.gamma[i][h]));
        border(cx(i), y, cell, cell);
      }
    }
    if (params.truth) statePath(Lo.strip, state.src, colors.reference, true);
    if (traced) statePath(Lo.strip, state.trellis.path, colors.empirical, false);

    /* 5. The imputed row — read off the decoded state once the trace-back is
       complete, with the posterior probability of that value, the bar running
       from 0.5 to 1 — then the truth on request. */
    caption(Lo.imp, toy ? "Imputed mood from the decoded pattern, and its posterior probability"
      : "Imputed allele from the decoded haplotype, and its posterior probability");
    rowLabel(Lo.imp.y, "imputed");
    for (let i = 0; i < L; i += 1) {
      const x = cx(i), y = Lo.imp.y;
      if (!stage.sites[i].blank) { tile(x, y, state.truthAllele[i], 1, cell, i); continue; }
      if (!traced) { unknownCell(x, y, true); continue; }
      const c = imputedCall(state, i);
      tile(x, y, c.call, 1, cell, i);
      probBar(x, y, c.conf);
    }

    /* 6. The truth, on request. */
    if (Lo.truth) {
      caption(Lo.truth, toy ? "Ground truth: ringed where the call differs, marked where the day deviates from its pattern"
        : "Ground truth: ringed where the call differs, marked where the panel lacks the variant");
      rowLabel(Lo.truth.y, "truth");
      for (let i = 0; i < L; i += 1) {
        const s = stage.sites[i];
        const a = state.truthAllele[i];
        tile(cx(i), Lo.truth.y, a, 1, cell, i);
        const call = traced ? imputedCall(state, i).call : a;
        if (s.blank && call !== a) {
          ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
          ctx.strokeRect(cx(i) + 1, Lo.truth.y + 1, cell - 2, cell - 2);
        }
        if (state.novel[i]) {
          ctx.fillStyle = colors.ink3; ctx.beginPath();
          ctx.moveTo(cx(i) + cell / 2, Lo.truth.y + cell + 2);
          ctx.lineTo(cx(i) + cell / 2 - 3, Lo.truth.y + cell + 7);
          ctx.lineTo(cx(i) + cell / 2 + 3, Lo.truth.y + cell + 7);
          ctx.fill();
        }
      }
    }
  },

  readout: ({ params, state, anim }) => {
    const idx = anim?.idx ?? 0;
    if (state.kind === "concept") {
      const hidden = params.model === "hidden";
      const share = (seq) => { let st = 0; for (let k = 1; k < idx; k += 1) if (seq[k] === seq[k - 1]) st += 1; return idx > 1 ? fmt(st / (idx - 1), 2) : "—"; };
      const tiles = [
        { label: "Tosses so far", value: `${idx} of ${state.L}`, note: hidden ? "one coin drawn per toss" : "one state drawn per toss" },
        hidden
          ? { label: "P(stay) counted from the tosses", value: share(state.obs), note: `not T: the tosses are not the coins. T's diagonal is ${state.stay.toFixed(2)}` }
          : { label: "P(repeat) counted from the record", value: share(state.src), note: `share of tosses that repeated the last; T's diagonal is ${state.stay.toFixed(2)}` },
      ];
      if (hidden && params.truth) tiles.push({ label: "P(stay) counted from the hidden coins", value: share(state.src), note: "what you could count if the coin were seen" });
      return tiles;
    }
    const L = state.L, toy = state.kind === "mood";
    const traced = idx - L >= L;
    const last = state.stages.at(-1);
    const blanks = [];
    for (let i = 0; i < L; i += 1) if (last.sites[i].blank) blanks.push(i);
    const calls = blanks.map((i) => imputedCall(state, i));
    /* No progress counters here: the trellis caption already says which column
       the walk is at, and the two tiles pushed the findings off the first row. */
    const tiles = [
      { label: toy ? "Days not recorded" : "Sites to impute", value: String(blanks.length),
        note: toy ? "imputed once the path is traced" : "untyped, imputed once the path is traced" },
    ];
    tiles.push({ label: "Imputed with P ≥ 0.9",
      value: traced ? `${calls.filter((c) => c.conf >= 0.9).length} of ${blanks.length}` : "—",
      note: toy ? "posterior probability of the imputed mood" : "posterior probability of the imputed allele" });
    if (params.truth) {
      /* On the biology the path itself is not identifiable where two templates
         agree — measured 2026-09-06, the true recombination point is placed
         between the flanking typed sites in ~10% of seeds while 85% of blanks
         come out right — so the honest count is the sites where the decoded
         template carries the true template's allele. The toy's two patterns
         differ enough that the path is the fair count there. */
      let stateRight = 0;
      for (let i = 0; i < L; i += 1) {
        if (toy ? state.trellis.path[i] === state.src[i]
          : state.panel.hap[state.trellis.path[i]][i] === state.panel.hap[state.src[i]][i]) stateRight += 1;
      }
      tiles.push({ label: toy ? "Pattern decoded correctly" : "Decoded template agrees with the true one",
        value: traced ? `${stateRight} of ${L}` : "—",
        note: toy ? "Viterbi path against the true pattern, all days" : "sites where the two carry the same allele" });
      tiles.push({ label: "Imputed correctly",
        value: traced ? `${blanks.filter((i, k) => calls[k].call === state.truthAllele[i]).length} of ${blanks.length}` : "—",
        note: toy ? "against the true mood" : "against the sequenced allele" });
      if (!toy) tiles.push({ label: "A frequency fill would get", value: `${last.freqCorrect} of ${last.blanks}`,
        note: "the panel's commoner allele at each site" });
    }
    return tiles;
  },
});
