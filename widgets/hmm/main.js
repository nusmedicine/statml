/* ============================================================================
   Hidden Markov model — widget 45, DRAFT, started 2026-09-06.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   intentional missing data of a SNP array, filled from a reference panel with
   an HMM. Two tabs in the notebook's own order, on ONE decoder (model.js):

     Concept             a two-state Markov chain walked a day at a time —
                         the arrow taken lights on the graph, the transitions
                         counted so far sit beside T — and then the states
                         HIDDEN: the same walk, a mood emitted by E each day,
                         and the counted table no longer T. Kenneth asked for
                         it first, 2026-09-06: students do not know a Markov
                         model, or how it relates to the matrix.
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

   THE FIGURE, top to bottom, the same on both tabs so the second reads as
   the first grown up: the record (blanks where nothing was), the model (the
   emission at the position being read, the states, the transition table),
   the templates (two patterns / the panel), the Viterbi trellis, the
   POSTERIOR over hidden states as a strip with the Viterbi path drawn
   through it, the record again, and the imputed row, each call with its
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

import { defineWidget, fmt } from "../core/index.js";
import * as M from "./model.js";

/* Option lists. Choice keys are strings on the wire; Number() them at use. */
const KS = ["2", "3", "4", "6", "8"];
const EVERY = ["2", "3", "4", "6", "9"];

/* Pacing is chosen, not automatic (4.1). Slow and Medium fade each new column
   or posterior in; Fast declares no choreography and shows the stages only. */
const SPEEDS = {
  slow: { label: "Slow", detail: "each column faded in, slowly", ms: 900, choreo: true },
  medium: { label: "Medium", detail: "each column faded in, at reading pace", ms: 420, choreo: true },
  fast: { label: "Fast", detail: "the columns only, no fade", ms: 110, choreo: false },
};
/* One step is one unit WATCHED — a fixed beat whatever Play is set to. */
const STEP_MS = 700;

/* One layout function read by `height` and `draw`, so the two cannot drift. */
const GUT = 66, GAP = 16, LAB = 15, TOP = 6, BOT = 8;
const MAX_CELL = 40;           // the toy's few days would otherwise balloon
/* The model block: K states on a ring, two values beneath. Two states need
   less height than eight. */
const ringH = (K) => (K === 2 ? 138 : 176);
/* A K-by-K transition table has to fit beside the ring and the emission
   table at the narrowest canvas: 22px cells at K = 8, up to 34px at K <= 5. */
const ringCell = (K) => Math.max(22, Math.min(34, Math.floor(176 / K)));
const BAR_H = 6;               // the probability bar under an imputed call

function layout(w, v) {
  if (v.view === "concept") return conceptLayout(w, v);
  const toy = v.view === "toy";
  const L = toy ? M.NOTEBOOK.P1.length : M.L_DEFAULT;
  const K = toy ? 2 : Number(v.K);
  const cell = Math.min(MAX_CELL, Math.floor((w - GUT - 6) / L));
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  const obs = add(cell);
  const model = add(Math.max(LAB + K * ringCell(K), ringH(K)));
  const panel = add(K * cell);
  const trellis = add(K * cell);
  const strip = add(K * cell);
  /* THE COMPARISON BLOCK: the observations again, directly above the imputed
     row and the truth, so the three read as one stack. Kenneth, 2026-09-06:
     "when I see imputed and ground truth, I don't know what was the original
     SNP array sequence — I have to scroll to the top and it's hard to
     compare." The top row stays: the walk reads it. */
  const again = add(cell);
  const imp = add(cell + BAR_H);
  const truth = v.truth ? add(cell) : null;
  return { cell, K, L, gx: GUT, obs, model, panel, trellis, strip, again, imp, truth, height: y - GAP + BOT };
}

const beliefAlpha = (g) => 0.05 + 0.88 * g;

/* THE MODEL BLOCK, the same three things on both tabs: the emission table AT
   ONE POSITION (the column the walk is at) — the template's own value 1 - eps,
   the other eps, so it is the templates' column read as probabilities; the
   states on a ring, every pair joined because a switch can land on any other
   state, with each state's emission arrow going to the value it carries at
   that position; and the K-by-K transition table, 1 - rho on the diagonal and
   rho over K - 1 off it. Two states on the toy, K on the biology. */
function drawRingModel(ctx, colors, { Lo, state, stage, site, w, tile, text, border, stateName }) {
  const { K, L, gx, cell } = Lo;
  const B = Lo.model;
  const mc = ringCell(K);
  const font = `${colors.fsXs} ${colors.font}`;
  const small = `${Math.max(9, Math.min(11, mc - 13))}px ${colors.font}`;
  const rho = state.rho, move = rho / (K - 1);
  const toy = state.kind === "mood";
  const unit = toy ? "day" : "site";
  const known = stage.sites[site].known;
  const ts = Math.min(cell + 4, 18);

  /* Emission at one position, left. Columns are the two values as tiles. */
  const ex = gx;
  text(ex, B.y - LAB / 2 - 1, `Emission E at ${unit} ${site + 1}`, colors.ink2);
  for (let c = 0; c < 2; c += 1) {
    const x = ex + c * mc + mc / 2 - ts / 2;
    tile(x, B.y + 1, c, 1, ts, site);
    if (known && state.truthAllele[site] === c) {
      ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2; ctx.strokeRect(x + 1, B.y + 2, ts - 2, ts - 2);
    }
  }
  for (let h = 0; h < K; h += 1) {
    const y = B.y + LAB + 6 + h * mc;
    text(ex - 6, y + mc / 2 + 0.5, stateName(h), colors.ink3, "right");
    for (let c = 0; c < 2; c += 1) {
      const x = ex + c * mc;
      border(x, y, mc, mc);
      const pr = state.panel.hap[h][site] === c ? 1 - state.eps : state.eps;
      text(x + mc / 2, y + mc / 2 + 0.5, pr.toFixed(2), colors.ink1, "center", small);
    }
  }

  /* Transition, right. */
  const tx = w - K * mc - 6;
  text(tx, B.y - LAB / 2 - 1, "Transition T", colors.ink2);
  for (let c = 0; c < K; c += 1) text(tx + c * mc + mc / 2, B.y + LAB / 2, stateName(c), colors.ink3, "center", small);
  for (let r = 0; r < K; r += 1) {
    const y = B.y + LAB + 6 + r * mc;
    text(tx - 6, y + mc / 2 + 0.5, stateName(r), colors.ink3, "right");
    for (let c = 0; c < K; c += 1) {
      const x = tx + c * mc;
      border(x, y, mc, mc);
      text(x + mc / 2, y + mc / 2 + 0.5, (r === c ? 1 - rho : move).toFixed(2), r === c ? colors.ink1 : colors.ink2, "center", small);
    }
  }

  /* The ring, between them. */
  const x0 = ex + 2 * mc + 40, x1 = tx - 44;
  const mid = (x0 + x1) / 2;
  const R = 11;
  const rad = Math.min(50, (x1 - x0) / 2 - R - 8);
  /* Two states side by side need no vertical radius; K on a ring do. */
  const cy0 = B.y + LAB + 4 + (K === 2 ? R + 6 : rad + R);
  const pos = Array.from({ length: K }, (_, h) => {
    /* Two states sit side by side, P1 left; more than two go round from the top. */
    const a = (K === 2 ? Math.PI : -Math.PI / 2) + (2 * Math.PI * h) / K;
    return { x: mid + rad * Math.cos(a), y: cy0 + rad * Math.sin(a), a };
  });
  text(mid, B.y - LAB / 2 - 1, "Hidden states", colors.ink2, "center");
  ctx.save();
  ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
  for (let a = 0; a < K; a += 1) for (let b = a + 1; b < K; b += 1) {
    ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b].x, pos[b].y); ctx.stroke();
  }
  ctx.restore();
  /* Two allele tiles beneath the ring; each state's emission arrow goes to
     the allele it carries at this site. */
  const ty = K === 2 ? cy0 + R + 34 : cy0 + rad + R + 14;
  const tileX = [mid - 20 - ts / 2, mid + 20 - ts / 2];
  for (let h = 0; h < K; h += 1) {
    const a = state.panel.hap[h][site];
    const bx = tileX[a] + ts / 2, by = ty;
    const dx = bx - pos[h].x, dy = by - pos[h].y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    ctx.save();
    ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(pos[h].x + ux * (R + 2), pos[h].y + uy * (R + 2)); ctx.lineTo(bx - ux * 4, by - uy * 4); ctx.stroke();
    ctx.restore();
  }
  for (let h = 0; h < K; h += 1) {
    ctx.save();
    ctx.fillStyle = colors.surface; ctx.beginPath(); ctx.arc(pos[h].x, pos[h].y, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke();
    ctx.restore();
    text(pos[h].x, pos[h].y + 0.5, stateName(h), colors.ink1, "center", `600 ${small}`);
    /* Self-loop, outward. */
    const lx = pos[h].x + Math.cos(pos[h].a) * (R + 7), ly = pos[h].y + Math.sin(pos[h].a) * (R + 7);
    ctx.save();
    ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(lx, ly, 6, pos[h].a + 2.4, pos[h].a - 2.4 + 2 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  for (let c = 0; c < 2; c += 1) tile(tileX[c], ty, c, 1, ts, site);
  text(mid, ty + ts + 9, `emits its own ${toy ? "mood" : "allele"} at ${unit} ${site + 1}`, colors.ink3, "center");
  text(mid, ty + ts + 22, K === 2
    ? `stay ${(1 - rho).toFixed(2)} · switch ${move.toFixed(2)}`
    : `stay ${(1 - rho).toFixed(2)} · switch ${move.toFixed(2)} to each of the other ${K - 1}`, colors.ink3, "center");
  void L;
}

/* THE CONCEPT TAB — a Markov model first, then the states hidden.

   Students meet the transition matrix before they meet a hidden state, and
   the notebook's cells 24–25 do the same: states, transitions, the matrix,
   then "hidden". So this tab walks a two-state chain one day at a time — the
   arrow taken lights on the graph, a tile lands on the record, the
   transitions counted so far sit beside the matrix that made them — and
   then a segmented control HIDES the states: the same chain, but what is
   seen is now a mood each state emits by E, and the counted table is no
   longer T. Kenneth asked for the tab on 2026-09-06.

   Visible states are the two moods themselves, Happy and Sad. Hidden, the
   same sequence becomes the pattern sequence P1 / P2 and the moods are
   drawn from E — the notebook's own reading of its example. */
const CONCEPT = {
  DAYS: 20,
  GRAPH_H: 150,           // the graph and the tables
  TABLE: 34,              // a probability-table cell
};

function conceptLayout(w, v) {
  const L = CONCEPT.DAYS;
  const cell = Math.min(30, Math.floor((w - GUT - 6) / L));
  const hidden = v.states === "hidden";
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  const model = add(CONCEPT.GRAPH_H);
  const walk = add((hidden ? 2 : 1) * cell);
  const counts = add(LAB + 2 * CONCEPT.TABLE);
  return { cell, K: 2, L, gx: GUT, model, walk, counts, height: y - GAP + BOT };
}

/* The two-state graph: circles, a self-loop and a switch on each, labelled
   from T; with the states hidden, dashed circles named P1 / P2 and dashed
   emission arrows down to the two moods, labelled from E. `lit` names the
   arrow the walk just took, drawn in the highlight colour while the beat
   runs. */
function drawConceptGraph(ctx, colors, { x0, x1, y, T, E, hidden, lit, litAlpha, tile, cell }) {
  const font = `${colors.fsXs} ${colors.font}`;
  const mid = (x0 + x1) / 2;
  const d = Math.min(70, (x1 - x0) / 4);
  const R = 15, ts = Math.min(cell, 24);
  const sy = y + LAB + 20, oy = y + CONCEPT.GRAPH_H - ts - 4;
  const S = [{ x: mid - d, y: sy }, { x: mid + d, y: sy }];
  const O = [{ x: mid - d, y: oy + ts / 2 }, { x: mid + d, y: oy + ts / 2 }];
  const label = (x, yy, s, align = "center", colour = colors.ink2) => {
    ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.font = font;
    ctx.fillText(s, x, yy);
  };
  const stroke = (isLit) => {
    ctx.strokeStyle = isLit ? colors.highlight : colors.ink3;
    ctx.fillStyle = isLit ? colors.highlight : colors.ink3;
    ctx.lineWidth = isLit ? 2.6 : 1.2;
    if (isLit) ctx.globalAlpha = litAlpha;
  };
  const arrow = (ax, ay, bx, by, shrinkA, shrinkB, dash, isLit) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const sx = ax + ux * shrinkA, sy2 = ay + uy * shrinkA, ex = bx - ux * shrinkB, ey = by - uy * shrinkB;
    ctx.save(); stroke(isLit);
    if (dash) ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 6 - uy * 3.5, ey - uy * 6 + ux * 3.5);
    ctx.lineTo(ex - ux * 6 + uy * 3.5, ey - uy * 6 - ux * 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  label(mid, y - LAB / 2 - 1, hidden ? "Hidden states, and the moods they emit" : "Two states, and the transitions between them");
  for (let h = 0; h < 2; h += 1) {
    /* A visible state IS a mood: drawn as its tile's colours. A hidden one is
       a dashed circle, the convention for what is not observed. */
    ctx.save();
    ctx.beginPath(); ctx.arc(S[h].x, S[h].y, R, 0, Math.PI * 2);
    if (hidden) { ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); }
    else { ctx.fillStyle = h === 1 ? colors.theory : colors.surface3; ctx.fill(); ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = hidden ? colors.ink1 : (h === 1 ? colors.surface : colors.ink1);
    ctx.font = `600 ${colors.fsSm} ${colors.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(hidden ? `P${h + 1}` : (h === 1 ? "H" : "S"), S[h].x, S[h].y + 0.5);
    /* Self-loop on the outer side, labelled with the stay probability. */
    const side = h === 0 ? -1 : 1;
    const isLit = lit && lit.from === h && lit.to === h;
    const lx = S[h].x + side * (R + 9), ly = S[h].y;
    ctx.save(); stroke(isLit);
    ctx.beginPath(); ctx.arc(lx, ly, 9, side > 0 ? -2.2 : 0.95, side > 0 ? 2.2 : 5.35); ctx.stroke();
    const tipX = S[h].x + side * R * 0.75, tipY = S[h].y + R * 0.66;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + side * 6, tipY + 2);
    ctx.lineTo(tipX + side * 2, tipY - 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(S[h].x + side * (R + 22), S[h].y - 12, T[h][h].toFixed(2), side > 0 ? "left" : "right");
  }
  arrow(S[0].x, S[0].y - 5, S[1].x, S[1].y - 5, R + 1, R + 1, false, lit && lit.from === 0 && lit.to === 1);
  arrow(S[1].x, S[1].y + 5, S[0].x, S[0].y + 5, R + 1, R + 1, false, lit && lit.from === 1 && lit.to === 0);
  label(mid, S[0].y - 15, T[0][1].toFixed(2));
  label(mid, S[0].y + 16, T[1][0].toFixed(2));
  if (hidden) {
    for (let h = 0; h < 2; h += 1) for (let o = 0; o < 2; o += 1) {
      const isLit = lit && lit.to === h && lit.emit === o;
      arrow(S[h].x, S[h].y, O[o].x, O[o].y, R + 2, ts / 2 + 3, true, isLit);
      const f = h === o ? 0.5 : 0.36;
      const lx = S[h].x + (O[o].x - S[h].x) * f, ly = S[h].y + (O[o].y - S[h].y) * f;
      const off = h === o ? (h === 0 ? -8 : 8) : (h === 0 ? -6 : 6);
      label(lx + off, ly, E[h][o].toFixed(2), off > 0 ? "left" : "right");
    }
    for (let o = 0; o < 2; o += 1) {
      tile(O[o].x - ts / 2, oy, o, 1, ts);
      label(O[o].x, oy + ts + 9, o === 1 ? "Happy" : "Sad");
    }
  } else {
    label(mid, oy + ts / 2, "the state is what you observe: a mood", "center", colors.ink3);
  }
}

function drawConcept(ctx, colors, { Lo, w, params, state, anim, text, fill, border, tile, unknownCell }) {
  const { cell, L, gx } = Lo;
  const hidden = params.states === "hidden";
  const idx = anim?.idx ?? 0;                     // days walked
  const fading = anim?.beatOn && idx > 0;
  const p = fading ? anim.beatP : 1;
  const T = state.T, E = state.E;
  const mc = CONCEPT.TABLE;
  const caption = (b, s) => text(gx, b.y - LAB / 2 - 1, s, colors.ink2);
  const rowLabel = (y, s) => text(gx - 6, y + cell / 2 + 0.5, s, colors.ink3, "right");
  const table = (x0, y0, title, cols, rows, cells, colour = () => colors.ink1, cw = mc) => {
    text(x0, y0 - LAB / 2 - 1, title, colors.ink2);
    for (let c = 0; c < 2; c += 1) text(x0 + c * cw + cw / 2, y0 + LAB / 2, cols[c], colors.ink3, "center");
    for (let r = 0; r < 2; r += 1) {
      const y = y0 + LAB + r * mc;
      text(x0 - 6, y + mc / 2 + 0.5, rows[r], colors.ink3, "right");
      for (let c = 0; c < 2; c += 1) {
        border(x0 + c * cw, y, cw, mc);
        text(x0 + c * cw + cw / 2, y + mc / 2 + 0.5, cells[r][c], colour(r, c), "center", `${colors.fsSm} ${colors.font}`);
      }
    }
  };
  const stateNames = hidden ? ["P1", "P2"] : ["S", "H"];

  /* 1. The model: T on the left, the graph, and E on the right once hidden. */
  const lit = fading && idx > 1 ? { from: state.src[idx - 2], to: state.src[idx - 1], emit: state.mood[idx - 1] } : null;
  table(gx, Lo.model.y, "Transition T", stateNames.map((n) => `to ${n}`), stateNames, [[T[0][0].toFixed(2), T[0][1].toFixed(2)], [T[1][0].toFixed(2), T[1][1].toFixed(2)]]);
  const ex = w - 2 * mc - 6;
  if (hidden) {
    table(ex, Lo.model.y, "Emission E", ["Sad", "Happy"], ["P1", "P2"], [[E[0][0].toFixed(2), E[0][1].toFixed(2)], [E[1][0].toFixed(2), E[1][1].toFixed(2)]]);
    /* WHAT P1 AND P2 ARE: the two five-day patterns, drawn small under E, so
       the table is seen to be their composition — Happy on 2 of 5 days, on
       4 of 5 — and the Toy tab's patterns are recognised as the same two.
       Kenneth got lost here on 2026-09-06. */
    const pt = 16, px0 = w - 6 - 5 * pt, py = Lo.model.y + LAB + 2 * mc + 6;
    text(px0 + 5 * pt, py + 6, "from the patterns", colors.ink3, "right");
    [M.NOTEBOOK.P1, M.NOTEBOOK.P2].forEach((pat, r) => {
      const y = py + 14 + r * pt;
      text(px0 - 6, y + pt / 2 + 0.5, `P${r + 1}`, colors.ink3, "right");
      pat.forEach((a, i) => tile(px0 + i * pt, y, a, 1, pt));
    });
  }
  drawConceptGraph(ctx, colors, { x0: gx + 2 * mc + 30, x1: (hidden ? ex : w - 6) - 36, y: Lo.model.y, T, E, hidden, lit, litAlpha: 1 - p * 0.6, tile, cell });

  /* 2. The walk: one tile per day, the newest fading in. */
  caption(Lo.walk, hidden
    ? `The walk: ${idx} of ${L} days — the pattern each day is hidden, its mood is seen`
    : `The walk: ${idx} of ${L} days — the state each day, which is the mood`);
  const cx = (i) => gx + i * cell;
  const rows = hidden ? [["pattern", (i) => state.src[i], true], ["mood", (i) => state.mood[i], false]] : [["mood", (i) => state.src[i], false]];
  rows.forEach(([name, valueAt, isHidden], r) => {
    const y = Lo.walk.y + r * cell;
    rowLabel(y, name);
    for (let i = 0; i < L; i += 1) {
      if (i >= idx) { border(cx(i), y, cell, cell); continue; }
      const alpha = fading && i === idx - 1 ? p : 1;
      if (isHidden && !params.truth) { unknownCell(cx(i), y, true); continue; }
      if (isHidden) {
        /* The truth, asked for: the hidden pattern, in the truth's own wash. */
        fill(cx(i), y, cell, cell, colors.reference, 0.22 * alpha); border(cx(i), y, cell, cell);
        text(cx(i) + cell / 2, y + cell / 2 + 0.5, `P${valueAt(i) + 1}`, colors.ink1, "center", `600 ${Math.max(9, Math.round(cell * 0.4))}px ${colors.font}`);
        continue;
      }
      tile(cx(i), y, valueAt(i), alpha, cell);
    }
  });

  /* 3. What the walk lets you count, beside what made it. */
  const n = Math.max(0, idx - 1);
  const seq = hidden ? state.mood : state.src;
  const cnt = [[0, 0], [0, 0]];
  for (let i = 1; i < idx; i += 1) cnt[seq[i - 1]][seq[i]] += 1;
  const rowTot = cnt.map((r) => r[0] + r[1]);
  const shown = cnt.map((r, a) => r.map((c) => (rowTot[a] ? `${c} · ${(c / rowTot[a]).toFixed(2)}` : `${c}`)));
  const moodNames = ["S", "H"];
  const countNames = hidden ? moodNames : stateNames;
  const CW = 62;   // "12 · 0.86" needs the room
  table(gx, Lo.counts.y, hidden
    ? `Transitions counted between the MOODS, ${n} so far: count · share of row`
    : `Transitions counted so far, ${n}: count · share of row`,
  countNames.map((s) => `to ${s}`), countNames, shown,
  (r, c) => (hidden ? colors.ink2 : (r === c ? colors.ink1 : colors.ink2)), CW);
  const note = hidden
    ? "not T: the moods are not the states"
    : "the shares converge on T's rows as the walk lengthens";
  text(gx + 2 * CW + 24, Lo.counts.y + LAB + mc - 2, note, colors.ink3, "left");
}


/* The concept tab's worked line: the day's draw, in T's and E's numbers. */
function conceptCardLines(state, idx, params) {
  const hidden = params.states === "hidden";
  const { T, E, src, mood, stay } = state;
  const name = (h) => (hidden ? `P${h + 1}` : (h === 1 ? "Happy" : "Sad"));
  const moodName = (m) => (m === 1 ? "Happy" : "Sad");
  if (idx === 0) {
    const lines = [
      "A Markov model: a set of states and a transition table T, P(next state | current state) — one row per current state, each row summing to 1.",
      "The next state depends only on the current one, not on the days before it. Walk it: each day the next state is drawn from the current state's row of T.",
    ];
    if (hidden) lines.push("Hidden: the state is now a pattern, P1 or P2, and is not seen. Each day it emits a mood by E — P1 is Happy on 2 of its 5 days, P2 on 4 of 5 — and only the mood is recorded.");
    return lines;
  }
  const i = idx - 1;
  const lines = [];
  if (i === 0) lines.push(`Day 1: start in ${name(src[0])}, each state equally likely.`);
  else {
    const a = src[i - 1], b = src[i];
    lines.push(`Day ${i + 1}: from ${name(a)}. T's row: stay ${T[a][a].toFixed(2)}, switch ${T[a][1 - a].toFixed(2)} — drew ${a === b ? "stay" : "switch"}, so ${name(b)}.`);
  }
  if (hidden) lines.push(`${name(src[i])} emits Happy with ${E[src[i]][1].toFixed(2)}, Sad with ${E[src[i]][0].toFixed(2)} — drew ${moodName(mood[i])}. Only the mood is recorded.`);
  let stays = 0;
  for (let k = 1; k < idx; k += 1) if (src[k] === src[k - 1]) stays += 1;
  if (idx > 1) lines.push(hidden
    ? `Stays among the hidden states so far: ${stays} of ${idx - 1}. You cannot count these from the record — you see only moods.`
    : `Stays so far: ${stays} of ${idx - 1} transitions = ${(stays / (idx - 1)).toFixed(2)}, against T's ${stay.toFixed(2)}.`);
  return lines;
}

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
   inserted above the figure and rewritten only when its key changes. */
const CARD_MIN = "9.6em";     // the three resting lines, wrapped, at the narrowest column; no jog as the walk runs
let cardHost = null, cardKey = null;

function cardLines(state, idx, params) {
  if (state.kind === "concept") return conceptCardLines(state, idx, params);
  const toy = state.kind === "mood";
  const { K, L, rho } = state;
  const TR = state.trellis;
  const pos = toy ? "day" : "site";
  const name = (h) => (toy ? `P${h + 1}` : `h${h + 1}`);
  const stay = 1 - rho, move = rho / (K - 1);
  const known = (i) => !state.stages.at(-1).sites[i].blank;
  const obsName = (i) => (toy ? (state.truthAllele[i] === 1 ? "Happy" : "Sad") : state.panel.letters[i][state.truthAllele[i]]);
  const emitAt = (i, h) => (state.panel.hap[h][i] === state.truthAllele[i] ? 1 - state.eps : state.eps);
  const f2 = (x) => x.toFixed(2);
  const fwd = Math.min(idx, L), back = Math.max(0, idx - L);

  if (fwd === 0) {
    return [
      `Each column: score(state) = P(observation | state) × the largest of (previous score × transition) over the previous column's states.`,
      `A blank column has no observation, so its score is that largest product alone.`,
      `The state that gave the largest product is stored; the trace-back follows those stored winners from the best final node.`,
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
      return known(i)
        ? `${name(h)} at ${pos} ${i + 1}: ${carried.toFixed(3)} (${how}) × P(${obsName(i)} | ${name(h)}) ${f2(emitAt(i, h))} = ${prods[h].toFixed(3)}`
        : `${name(h)} at ${pos} ${i + 1}: ${carried.toFixed(3)} (${how}); no observation to multiply by`;
    });
    lines.push(`Scaled so the column sums to 1${toy ? "" : `, over all ${K}`}: ${show.map((h) => `${name(h)} ${f2(prods[h] / tot)}`).join(", ")}${toy ? "" : ", …"}`);
    return lines;
  }
  const i = L - back;                         // the column just traced
  if (i === L - 1) {
    return [
      `Trace-back starts at the best final node: ${name(TR.path[i])} at ${pos} ${L}, relative score ${f2(TR.score[i][TR.path[i]])}.`,
      `Each step follows the winner stored in the forward pass, one column left.`,
    ];
  }
  const lines = [
    `${name(TR.path[i + 1])} at ${pos} ${i + 2} stored ${name(TR.path[i])} as its winner, so the path at ${pos} ${i + 1} is ${name(TR.path[i])}.`,
  ];
  if (i > 0) lines.push(`${i} column${i === 1 ? "" : "s"} left to trace.`);
  else lines.push(`Traced to ${pos} 1: one state per ${pos}, the single most likely sequence. The imputed values are read off it.`);
  return lines;
}

function renderCard(state, idx, params) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    cardHost.style.minHeight = CARD_MIN;
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const key = ["view", "idx", "seed", "missing", "K", "every", "sample", "stay", "states"]
    .map((k) => (k === "idx" ? idx : params[k])).join("|");
  if (key === cardKey) return;
  cardKey = key;
  cardHost.innerHTML = cardLines(state, idx, params)
    .map((l) => `<div class="w-math-eq" style="min-height:0">${l}</div>`).join("");
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
    "A hidden Markov model infers hidden states from the observations they " +
    "produce, and fills a missing observation from the decoded state with a " +
    "probability attached. Genotype imputation fills a SNP array this way from " +
    "a reference panel.",
  status: "draft",
  layout: "side",
  height: (v) => layout(v.w, v).height,

  /* One tab's marks at a time — the legend must match the graph. */
  legend: ({ params }) => {
    if (params.view === "concept") {
      const hidden = params.states === "hidden";
      const entries = [
        { token: "theory", label: hidden ? "Happy (filled); Sad is open — the mood emitted" : "Happy (filled); Sad is open — the state itself", mark: "bar" },
        { token: "highlight", label: "The transition taken this day, and the mood emitted", mark: "line" },
      ];
      if (hidden) entries.push({ token: "unknown", label: "The hidden state", mark: "bar" });
      if (hidden && params.truth) entries.push({ token: "reference", label: "Ground truth: the hidden pattern each day", mark: "bar" });
      return entries;
    }
    const toy = params.view === "toy";
    const entries = toy
      ? [
        { token: "theory", label: "Happy (filled); Sad is open", mark: "bar" },
        { token: "unknown", label: "Not recorded", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor path into a node; once traced, the most likely sequence of patterns", mark: "line" },
        { token: "ink-3", label: "The candidate that lost at the current column", mark: "dash" },
        { token: "posterior", label: "Posterior: which pattern the day is in", mark: "bar" },
      ]
      : [
        { token: "theory", label: "The base at each site: the alternate allele filled, the reference allele open", mark: "bar" },
        { token: "unknown", label: "Not typed on the array", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor path into a node; once traced, the most likely copied haplotype at every site", mark: "line" },
        { token: "posterior", label: "Posterior: which haplotype is being copied", mark: "bar" },
      ];
    if (params.truth) entries.push({ token: "reference", label: toy ? "Ground truth: the pattern the record follows, washed and outlined" : "Ground truth: the segments the sample copies, washed and outlined", mark: "bar" });
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
        { value: "concept", label: "Concept", detail: "a Markov model walked a day at a time, then its states hidden" },
        { value: "toy", label: "Toy model", detail: "the toy: two known patterns, a mood record with days missing" },
        { value: "biological", label: "Biology", detail: "the biological example: a SNP array imputed from a reference panel" },
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
    chain: {
      type: "section", label: "The chain",
      detail: "two states and a transition table; walk it one day at a time, then hide the states",
      when: { param: "view", equals: "concept" },
    },
    stay: {
      type: "choice", label: "P(stay in the same state)",
      options: ["0.5", "0.7", "0.8", "0.9", "0.95"].map((v) => ({ value: v, label: v,
        detail: "model parameter: the diagonal of T; in practice counted from sequences whose states are known" })),
      default: "0.8",
      when: { param: "view", equals: "concept" },
    },
    /* A display parameter: hiding the states must not throw the walk away —
       the point is that it is the SAME walk, seen differently. */
    states: {
      type: "segmented", label: "States",
      options: [
        { value: "visible", label: "Visible", detail: "a Markov model: the state each day is what you observe, a mood" },
        { value: "hidden", label: "Hidden", detail: "a hidden Markov model: the state is a pattern, P1 or P2, and each day it emits a mood by E" },
      ],
      default: "visible",
      display: true,
      when: { param: "view", equals: "concept" },
    },
    seq: {
      type: "section", label: "The sequence",
      detail: "simulated: the record follows one of the two patterns, with some days unrecorded. Seed 1 with three missing is the worked example; another seed picks the pattern and the days",
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
      detail: "simulation: which days go unrecorded, completely at random",
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
      type: "choice", label: "Array types one site in",
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
        { value: "recombinant", label: "Recombinant", detail: "simulation: a historical crossover falls in this region, so the sample copies h1 on one side of it and h2 on the other; the decoder has to find where" },
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
    modelConcept: {
      type: "section", label: "The model",
      detail: "T is what you set. E is the two patterns' composition — P1 is Happy on 2 of its 5 days, "
        + "P2 on 4 of 5. In practice both are counted from sequences whose states are known, or fitted "
        + "by expectation–maximisation.",
      when: { param: "view", equals: "concept" },
    },
    modelToy: {
      type: "section", label: "The model",
      detail: "The two patterns are known, so E is read off them at each day, with 0.1 "
        + "allowed for a day that deviates. T is fixed at a switch rate of 0.10. In practice "
        + "both are counted from sequences whose patterns are known, or fitted by "
        + "expectation–maximisation.",
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
    if (params.view === "concept") return M.buildConcept({ rng, stay: Number(params.stay) });
    if (params.view === "toy") return M.buildToy({ rng, missing: params.missing, seed: params.seed });
    return M.buildGenotype({ rng, K: Number(params.K), every: Number(params.every), sample: params.sample });
  },

  animation: {
    /* Every press handles one column: forward while columns remain, then
       one column of the trace-back. */
    stepLabel: { param: "view", labels: { concept: "Next day", toy: "Next column", biological: "Next column" }, default: "Next column" },
    stepTitle: "Concept: draw the next day's state. Toy and biology: compute the next trellis column; once all are computed, trace back one column",
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
        }
        anim.beatP += dt / STEP_MS;
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
      if (sp.choreo && anim.idx > 0) { anim.beatOn = true; anim.beatP = Math.min(1, anim.t / sp.ms); }
      else { anim.beatOn = false; anim.beatP = 1; }
      return true;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
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
      const letter = genotype ? (i === null ? "" : state.panel.letters[i][a]) : (a === 1 ? "H" : "S");
      if (letter) text(x + size / 2, y + size / 2 + 0.5, letter, a === 1 ? colors.surface : colors.ink1, "center",
        `600 ${Math.round(size * (genotype ? 0.6 : 0.5))}px ${colors.font}`);
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
      drawConcept(ctx, colors, { Lo, w, params, state, anim, text, fill, border, tile, unknownCell });
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

    /* 1. The observations, the whole record from the start: the algorithm
       runs over it. */
    caption(Lo.obs, toy
      ? `Moods on record: ${state.order.length} of ${L} days`
      : `Array genotypes: ${state.order.length} typed sites of ${L}`);
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
    drawRingModel(ctx, colors, { Lo, state, stage, site: walkSite, w, tile, text, border, stateName });
    caption(Lo.panel, toy
      ? (params.truth ? "The two patterns, known — the record follows the marked one" : "The two patterns, known")
      : (params.truth ? `Reference panel: ${K} sequenced haplotypes — the sample copies the marked segments` : `Reference panel: ${K} sequenced haplotypes`));
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

    /* 5. The comparison block: the observations again, then the imputed row —
       read off the decoded state once the trace-back is complete, with the
       posterior probability of that value, the bar running from 0.5 to 1 —
       then the truth on request. */
    caption(Lo.again, toy ? "Moods on record" : "Array, as typed");
    rowLabel(Lo.again.y, toy ? "mood" : "array");
    for (let i = 0; i < L; i += 1) {
      if (stage.sites[i].blank) unknownCell(cx(i), Lo.again.y, true);
      else tile(cx(i), Lo.again.y, state.truthAllele[i], 1, cell, i);
    }
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
      caption(Lo.truth, toy ? "Ground truth: ringed where the call differs, marked where the day strayed from its pattern"
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
      const hidden = params.states === "hidden";
      const share = (seq) => { let st = 0; for (let k = 1; k < idx; k += 1) if (seq[k] === seq[k - 1]) st += 1; return idx > 1 ? fmt(st / (idx - 1), 2) : "—"; };
      const tiles = [
        { label: "Days walked", value: `${idx} of ${state.L}`, note: "one state drawn per day" },
        hidden
          ? { label: "P(stay) counted from the moods", value: share(state.mood), note: `not T: the moods are not the states. T's diagonal is ${state.stay.toFixed(2)}` }
          : { label: "P(stay) counted from the walk", value: share(state.src), note: `share of transitions that stayed; T's diagonal is ${state.stay.toFixed(2)}` },
      ];
      if (hidden && params.truth) tiles.push({ label: "P(stay) counted from the hidden states", value: share(state.src), note: "what you could count if the states were seen" });
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
        note: toy ? "the ? cells, imputed once traced" : "untyped, imputed once traced" },
    ];
    tiles.push({ label: "Imputed with P ≥ 0.9",
      value: traced ? `${calls.filter((c) => c.conf >= 0.9).length} of ${blanks.length}` : "—",
      note: toy ? "posterior probability of the imputed mood" : "posterior probability of the imputed allele" });
    if (params.truth) {
      let stateRight = 0;
      for (let i = 0; i < L; i += 1) if (state.trellis.path[i] === state.src[i]) stateRight += 1;
      tiles.push({ label: toy ? "Pattern decoded correctly" : "Copied haplotype decoded correctly",
        value: traced ? `${stateRight} of ${L}` : "—",
        note: toy ? "Viterbi path against the true pattern, all days" : "Viterbi path against the true copying path, all sites" });
      tiles.push({ label: "Imputed correctly",
        value: traced ? `${blanks.filter((i, k) => calls[k].call === state.truthAllele[i]).length} of ${blanks.length}` : "—",
        note: toy ? "against the true mood" : "against the sequenced allele" });
      if (!toy) tiles.push({ label: "A frequency fill would get", value: `${last.freqCorrect} of ${last.blanks}`,
        note: "the panel's commoner allele at each site" });
    }
    return tiles;
  },
});
