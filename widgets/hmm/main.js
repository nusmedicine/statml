/* ============================================================================
   Hidden Markov model — widget 45, DRAFT, started 2026-09-06.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   intentional missing data of a SNP array, filled from a reference panel with
   an HMM. Two tabs in the notebook's own order, on ONE decoder (model.js):

     Toy model           two hidden patterns, Happy/Sad observations, some
                         days unrecorded. The state graph and the emission
                         and transition tables are drawn: they are the model.
                         Its animation is THE VITERBI ALGORITHM — the trellis
                         forward one column at a time, then the trace-back.
     Biological example  the reference panel IS the emission table (K
                         haplotypes by L sites), the hidden state is which
                         haplotype the sample is copying, and recombination
                         is the transition. The same Viterbi walk, at K
                         states: no numbers in the nodes and no losing
                         candidates drawn, because 17px cells and K-1 losers
                         per node would not read.

   THE FIGURE, top to bottom, the same grammar on both tabs so the second
   reads as the first grown up: the observations as recorded (blanks where
   nothing was), the model (graph and two tables / the panel), on the toy the
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

   Every stage of the animation is precomputed in compute(); a beat only
   fades one column in.
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";
import * as M from "./model.js";

/* Option lists. Choice keys are strings on the wire; Number() them at use. */
const RHOS = ["0.005", "0.02", "0.05", "0.1", "0.2", "0.35", "0.5"];
const HAPPY = ["0.6", "0.7", "0.8", "0.9", "0.95"];
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
const MCELL_MIN = 34;          // a probability table cell has to hold "0.95"
const GRAPH_H = 118;           // the toy's state graph: two states over two moods
const RING_H = 176;            // the biological tab's state graph: K states on a ring, two alleles beneath
/* A K-by-K transition table has to fit beside the ring and the emission
   table at the narrowest canvas: 22px cells at K = 8, up to 34px at K <= 5. */
const ringCell = (K) => Math.max(22, Math.min(34, Math.floor(176 / K)));
const BAR_H = 6;               // the probability bar under an imputed call

function layout(w, v) {
  const toy = v.view === "toy";
  const L = toy ? v.days : M.L_DEFAULT;
  const K = toy ? 2 : Number(v.K);
  const cell = Math.min(MAX_CELL, Math.floor((w - GUT - 6) / L));
  const mcell = Math.max(MCELL_MIN, Math.min(MAX_CELL, cell));
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  const obs = add(cell);
  const model = toy ? add(Math.max(LAB + 2 * mcell, GRAPH_H)) : add(Math.max(LAB + K * ringCell(K), RING_H));
  const panel = toy ? null : add(K * cell);
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
  return { cell, mcell, K, L, gx: GUT, obs, model, panel, trellis, strip, again, imp, truth, height: y - GAP + BOT };
}

const beliefAlpha = (g) => 0.05 + 0.88 * g;

/* THE STATE GRAPH — the picture a textbook draws beside the two tables: the
   hidden patterns as circles, a self-loop and a switch on each, and the moods
   they emit as the same tiles the rows use, so the graph's symbols are the
   figure's. Every number on an edge is a cell of E or T, so the graph and the
   tables cannot disagree. */
function drawGraph(ctx, colors, { x0, x1, y, E, rho, tileFn, cell }) {
  const font = `${colors.fsXs} ${colors.font}`;
  const mid = (x0 + x1) / 2;
  const d = Math.min(64, (x1 - x0) / 4);
  const R = 14, ts = Math.min(cell, 26);
  const sy = y + LAB + 18, oy = y + GRAPH_H - ts - 2;
  const S = [{ x: mid - d, y: sy }, { x: mid + d, y: sy }];                 // P1, P2
  const O = [{ x: mid - d, y: oy + ts / 2 }, { x: mid + d, y: oy + ts / 2 }]; // Sad, Happy
  const label = (x, yy, s, align = "center") => {
    ctx.fillStyle = colors.ink2; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.font = font;
    ctx.fillText(s, x, yy);
  };
  const arrow = (ax, ay, bx, by, shrinkA, shrinkB, dash) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const sx = ax + ux * shrinkA, sy2 = ay + uy * shrinkA, ex = bx - ux * shrinkB, ey = by - uy * shrinkB;
    ctx.save();
    ctx.strokeStyle = colors.ink3; ctx.fillStyle = colors.ink3; ctx.lineWidth = 1.2;
    if (dash) ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 6 - uy * 3.5, ey - uy * 6 + ux * 3.5);
    ctx.lineTo(ex - ux * 6 + uy * 3.5, ey - uy * 6 - ux * 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    return { sx, sy: sy2, ex, ey };
  };
  label(mid, y - LAB / 2 - 1, "Hidden patterns, and the moods they emit");
  /* States: dashed circles, the convention for what is not observed. */
  for (let h = 0; h < 2; h += 1) {
    ctx.save();
    ctx.strokeStyle = colors.ink1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(S[h].x, S[h].y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = colors.ink1; ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`P${h + 1}`, S[h].x, S[h].y + 0.5);
    /* Self-loop on the outer side, labelled with the stay probability. */
    const side = h === 0 ? -1 : 1;
    const lx = S[h].x + side * (R + 9), ly = S[h].y;
    ctx.save();
    ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(lx, ly, 9, side > 0 ? -2.2 : 0.95, side > 0 ? 2.2 : 5.35); ctx.stroke();
    ctx.fillStyle = colors.ink3;
    const tipX = S[h].x + side * R * 0.75, tipY = S[h].y + R * 0.66;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + side * 6, tipY + 2);
    ctx.lineTo(tipX + side * 2, tipY - 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(S[h].x + side * (R + 22), S[h].y - 12, (1 - rho).toFixed(2), side > 0 ? "left" : "right");
  }
  /* The switches: two arrows between the states, rho each way. */
  arrow(S[0].x, S[0].y - 5, S[1].x, S[1].y - 5, R + 1, R + 1);
  arrow(S[1].x, S[1].y + 5, S[0].x, S[0].y + 5, R + 1, R + 1);
  label(mid, S[0].y - 15, rho.toFixed(2));
  label(mid, S[0].y + 16, rho.toFixed(2));
  /* Emissions: four arrows down to the mood tiles, labelled from E. */
  for (let h = 0; h < 2; h += 1) for (let o = 0; o < 2; o += 1) {
    const a = arrow(S[h].x, S[h].y, O[o].x, O[o].y, R + 2, ts / 2 + 3, true);
    const f = h === o ? 0.5 : 0.36;          // the crossing pair is labelled off the crossing
    const lx = a.sx + (a.ex - a.sx) * f, ly = a.sy + (a.ey - a.sy) * f;
    const off = h === o ? (h === 0 ? -8 : 8) : (h === 0 ? -6 : 6);   // crossing pair labelled on its outer side
    label(lx + off, ly, E[h][o].toFixed(2), off > 0 ? "left" : "right");
  }
  for (let o = 0; o < 2; o += 1) {
    tileFn(O[o].x - ts / 2, oy, o, 1, ts);
    label(O[o].x, oy + ts + 9, o === 1 ? "Happy" : "Sad");
  }
}

/* THE BIOLOGICAL TAB'S MODEL, the same three things as the toy's at K states:
   the emission table AT ONE SITE (the newest typed site, or the first before
   anything is typed) — the haplotype's own allele 1 - EPS, the other EPS, so
   it is the panel's column read as probabilities; the states on a ring, every
   pair joined because a switch can land on any other haplotype, with each
   state's emission arrow going to the allele it carries at that site; and the
   K-by-K transition table, 1 - rho on the diagonal and rho over K - 1 off it.
   Drawn at K states so the reader sees the toy's picture again, larger. */
function drawRingModel(ctx, colors, { Lo, state, stage, site, w, tile, text, border, stateName }) {
  const { K, L, gx, cell } = Lo;
  const B = Lo.model;
  const mc = ringCell(K);
  const font = `${colors.fsXs} ${colors.font}`;
  const small = `${Math.max(9, Math.min(11, mc - 13))}px ${colors.font}`;
  const rho = state.rho, move = rho / (K - 1);
  const known = stage.sites[site].known;
  const ts = Math.min(cell + 4, 18);

  /* Emission at one site, left. Columns are the two alleles as tiles. */
  const ex = gx;
  text(ex, B.y - LAB / 2 - 1, `Emission E at site ${site + 1}`, colors.ink2);
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
      const pr = state.panel.hap[h][site] === c ? 1 - M.EPS : M.EPS;
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
  const cy0 = B.y + LAB + 4 + rad + R;
  const pos = Array.from({ length: K }, (_, h) => {
    const a = -Math.PI / 2 + (2 * Math.PI * h) / K;
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
  const ty = cy0 + rad + R + 14;
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
  text(mid, ty + ts + 9, `emits its own allele at site ${site + 1}`, colors.ink3, "center");
  text(mid, ty + ts + 22, `stay ${(1 - rho).toFixed(2)} · switch ${move.toFixed(2)} to each of the other ${K - 1}`, colors.ink3, "center");
  void L;
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

function cardLines(state, idx) {
  const toy = state.kind === "mood";
  const { K, L, rho } = state;
  const TR = state.trellis;
  const pos = toy ? "day" : "site";
  const name = (h) => (toy ? `P${h + 1}` : `h${h + 1}`);
  const stay = 1 - rho, move = rho / (K - 1);
  const known = (i) => !state.stages.at(-1).sites[i].blank;
  const obsName = (i) => (toy ? (state.truthAllele[i] === 1 ? "Happy" : "Sad") : state.panel.letters[i][state.truthAllele[i]]);
  const emitAt = (i, h) => (toy ? state.E[h][state.truthAllele[i]]
    : (state.panel.hap[h][i] === state.truthAllele[i] ? 1 - M.EPS : M.EPS));
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
  const key = ["view", "idx", "seed", "days", "missing", "happy", "K", "every", "switches", "rho"]
    .map((k) => (k === "idx" ? idx : params[k])).join("|");
  if (key === cardKey) return;
  cardKey = key;
  cardHost.innerHTML = cardLines(state, idx)
    .map((l) => `<div class="w-math-eq" style="min-height:0">${l}</div>`).join("");
}

/* The imputed value follows the notebook: read off the decoded state — the
   pattern's likelier mood, or the copied haplotype's allele at that site.
   Its probability is the posterior's, P(that value | what was observed). */
function imputedCall(state, i) {
  const h = state.trellis.path[i];
  const call = state.kind === "mood" ? (state.E[h][1] > 0.5 ? 1 : 0) : state.panel.hap[h][i];
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
    const toy = params.view === "toy";
    const entries = toy
      ? [
        { token: "ink-2", label: "Happy (filled); Sad is open", mark: "bar" },
        { token: "unknown", label: "Not recorded", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor path into a node; once traced, the most likely sequence of patterns", mark: "line" },
        { token: "ink-3", label: "The candidate that lost at the current column", mark: "dash" },
        { token: "posterior", label: "Posterior: which pattern the day is in", mark: "bar" },
      ]
      : [
        { token: "ink-2", label: "The base at each site: the alternate allele filled, the reference allele open", mark: "bar" },
        { token: "unknown", label: "Not typed on the array", mark: "bar" },
        { token: "empirical", label: "Viterbi trellis: relative score of the best path ending at each node", mark: "bar" },
        { token: "empirical", label: "Survivor path into a node; once traced, the most likely copied haplotype at every site", mark: "line" },
        { token: "posterior", label: "Posterior: which haplotype is being copied", mark: "bar" },
      ];
    if (params.truth) entries.push({ token: "reference", label: toy ? "True pattern" : "True copying path", mark: "dash" });
    return entries;
  },

  params: {
    view: {
      type: "segmented",
      label: "View",
      options: [
        { value: "toy", label: "Toy model", detail: "two hidden patterns, a mood recorded most days" },
        { value: "biological", label: "Biological example", detail: "a SNP array imputed from a reference panel" },
      ],
      default: "toy",
    },

    /* THE RAIL IN GROUPS BY KIND. Toy: the sequence, then the model. Biological:
       the design (the two choices a study makes), the truth (simulated, so the
       imputation can be checked), then the model. `seed` and the truth toggle
       are one field each, placed so they fall under The sequence on the toy
       and under The truth on the biological tab. */
    seq: {
      type: "section", label: "The sequence",
      detail: "simulated from the model below, so there is a truth to compare against",
      when: { param: "view", equals: "toy" },
    },

    /* EVERY CONTROL SAYS WHAT KIND OF THING IT IS. Three kinds sit in one
       rail and looked alike: SIMULATION dials that make a truth to compare
       against (nobody sets these in practice), MODEL PARAMETERS (learnt from
       data, or derived from a genetic map and the panel), and DESIGN CHOICES
       (the two a study actually makes: panel size, array density). Kenneth's
       review question, 2026-09-06: which are learnt from data, which does a
       user tweak. The detail line answers it where the reader's hand is. */
    days: {
      type: "int", label: "Days", min: 6, max: 20, default: 12,
      detail: "simulation: the length of the record",
      when: { param: "view", equals: "toy" },
    },
    missing: {
      type: "int", label: "Days not recorded", min: 0, max: 8, default: 3,
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
    switches: {
      type: "int", label: "Recombination points", min: 0, max: 4, default: 2,
      detail: "simulation: where the sample's true copied template changes; the decoder has to infer them",
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
    modelToy: {
      type: "section", label: "The model",
      detail: "E and T are set here, and they also generate the pattern and the moods, "
        + "so on the toy the model is never wrong. In practice they are counted from "
        + "sequences whose patterns are known, or fitted by expectation–maximisation.",
      when: { param: "view", equals: "toy" },
    },
    happy: {
      type: "choice", label: "P(Happy) in pattern 2",
      /* A choice control shows the SELECTED OPTION's detail, not the field's,
         so the kind rides on every option. */
      options: HAPPY.map((v) => ({ value: v, label: v,
        detail: "model parameter, learnt from data in practice: pattern 1 is Happy with one minus this" })),
      default: "0.8",
      when: { param: "view", equals: "toy" },
    },
    modelBio: {
      type: "section", label: "The model",
      detail: "T is the switch rate ρ, shared over the other haplotypes. E is read "
        + "off the reference panel at each site, with 0.02 allowed for a mismatch.",
      when: { param: "view", equals: "biological" },
    },

    rho: {
      type: "choice", label: "Switch rate ρ",
      options: RHOS.map((v) => ({ value: v, label: v,
        detail: "model parameter: P(the hidden state changes between neighbours). Learnt from data on the toy; from a genetic map in imputation" })),
      default: "0.1",
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
    const rho = Number(params.rho);
    if (params.view === "toy") {
      return M.buildMood({ rng, days: params.days, missing: params.missing, happy: Number(params.happy), rho });
    }
    return M.buildGenotype({ rng, K: Number(params.K), every: Number(params.every), switches: params.switches, rho });
  },

  animation: {
    /* Every press handles one column: forward while columns remain, then
       one column of the trace-back. */
    stepLabel: "Next column",
    stepTitle: "Compute the next trellis column; once all are computed, trace back one column",
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
    const { cell, mcell, K, L, gx } = Lo;
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
       base at that site on the biological tab, as the notebook's strings. */
    const tile = (x, y, a, alpha = 1, size = cell, i = null) => {
      fill(x, y, size, size, a === 1 ? colors.ink2 : colors.surface3, alpha);
      border(x, y, size, size);
      const letter = toy ? (a === 1 ? "H" : "S") : (i === null ? "" : state.panel.letters[i][a]);
      if (letter) text(x + size / 2, y + size / 2 + 0.5, letter, a === 1 ? colors.surface : colors.ink1, "center",
        `600 ${Math.round(size * (toy ? 0.5 : 0.6))}px ${colors.font}`);
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

    /* 2. The model: the graph and two tables, or the panel. */
    if (toy) {
      const E = state.E, rho = state.rho;
      const table = (x0, title, cols, cells) => {
        text(x0, Lo.model.y - LAB / 2 - 1, title, colors.ink2);
        for (let c = 0; c < 2; c += 1) text(x0 + c * mcell + mcell / 2, Lo.model.y + LAB / 2, cols[c], colors.ink3, "center");
        for (let r = 0; r < 2; r += 1) {
          const y = Lo.model.y + LAB + r * mcell;
          text(x0 - 6, y + mcell / 2 + 0.5, stateName(r), colors.ink3, "right");
          for (let c = 0; c < 2; c += 1) {
            const x = x0 + c * mcell;
            border(x, y, mcell, mcell);
            text(x + mcell / 2, y + mcell / 2 + 0.5, cells[r][c].toFixed(2), colors.ink1, "center", `${colors.fsSm} ${colors.font}`);
          }
        }
      };
      table(gx, "Emission E: P(mood | pattern)", ["Sad", "Happy"], E);
      const tx = w - 2 * mcell - 6;
      table(tx, "Transition T", ["P1", "P2"], [[1 - rho, rho], [rho, 1 - rho]]);
      drawGraph(ctx, colors, { x0: gx + 2 * mcell + 30, x1: tx - 36, y: Lo.model.y, E, rho, tileFn: tile, cell });
    } else {
      drawRingModel(ctx, colors, { Lo, state, stage, site: walkSite, w, tile, text, border, stateName });
      caption(Lo.panel, `Reference panel: ${K} sequenced haplotypes`);
      for (let h = 0; h < K; h += 1) {
        const y = Lo.panel.y + h * cell;
        rowLabel(y, stateName(h));
        for (let i = 0; i < L; i += 1) tile(cx(i), y, state.panel.hap[h][i], 1, cell, i);
      }
      if (fwd > 0 && back === 0) {
        /* The panel column the trellis is reading: the emission at this site. */
        ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
        ctx.strokeRect(cx(fwd - 1) + 1, Lo.panel.y + 1, cell - 2, K * cell - 2);
      }
    }

    /* 3. The Viterbi trellis: forward, the survivor into each node (and on
       the toy the candidate that lost); then the trace-back lighting the
       path. Numbers only where a node can hold them. */
    {
      const TR = state.trellis;
      const B = Lo.trellis;
      const ncx = (i) => cx(i) + cell / 2, ncy = (h) => B.y + h * cell + cell / 2;
      const R = Math.round(cell * (toy ? 0.32 : 0.36));
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
            else if (toy) segment(ncx(i - 1), ncy(g), ncx(i), ncy(h), colors.ink3, 1, 0.55 * colAlpha(i), [3, 3]);
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
      caption(Lo.truth, toy ? "Ground truth: the moods, ringed where the imputed call differs"
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
        if (!toy && state.novel[i]) {
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
    /* On the toy a mean rather than a count at P >= 0.9: a mood's probability
       is capped by the emission itself — a pattern known for certain is Happy
       with probability `happy` — so a count read 0 of 3 at the default and
       taught that the model had failed. On the biological tab the alleles ARE
       the states' emissions, and a count of confident calls is the number an
       imputation report quotes. */
    if (toy) {
      tiles.push({ label: "Mean P(imputed mood)",
        value: traced && calls.length ? fmt(calls.reduce((s, c) => s + c.conf, 0) / calls.length, 2) : "—",
        note: "posterior probability of the imputed mood" });
    } else {
      tiles.push({ label: "Imputed with P ≥ 0.9",
        value: traced ? `${calls.filter((c) => c.conf >= 0.9).length} of ${blanks.length}` : "—",
        note: "posterior probability of the imputed allele" });
    }
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
