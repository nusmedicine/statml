/* ============================================================================
   Hidden Markov model — widget 45, DRAFT, started 2026-09-06.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   intentional missing data of a SNP array, filled from a reference panel with
   an HMM. Two tabs in the notebook's own order, on ONE decoder (model.js):

     Toy model           two hidden patterns, Happy/Sad observations, some
                         days unrecorded. The state graph and the emission
                         and transition tables are drawn: they are the model.
     Biological example  the reference panel IS the emission table (K
                         haplotypes by L sites), the hidden state is which
                         haplotype the sample is copying, and recombination
                         is the transition.

   Kenneth renamed the tabs from Mood / Genotype to these on 2026-09-06: one
   is the toy and one is the biological example, and the names should say so
   rather than name the example.

   THE FIGURE, top to bottom, the same on both tabs so the second reads as the
   first grown up: the observations as recorded (blanks where nothing was),
   the model (two 2x2 tables / the panel), the POSTERIOR over hidden states as
   a strip with the Viterbi path drawn through it, and the imputed row, each
   call filled by its confidence. The true states go on the strip as a dashed
   path and the true observations in a final row, only when asked for — the
   same "reality never grants this" move as widget 25's true values.

   Kenneth picked this layout (B) over letters-on-belief (A) and a Viterbi-only
   route (C) from `_lab/hmm-mock.html` on 2026-09-06, and asked for the toy tab
   in front of it.

   THE ANIMATION reveals one recorded observation at a time, left to right,
   and the whole posterior is recomputed from what is known so far — so a
   posterior to the LEFT of the new observation moves too, which is the
   backward pass made visible. Every stage is precomputed in compute(); the
   beat only crossfades between two of them.
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";
import * as M from "./model.js";

/* Option lists. Choice keys are strings on the wire; Number() them at use. */
const RHOS = ["0.005", "0.02", "0.05", "0.1", "0.2", "0.35", "0.5"];
const HAPPY = ["0.6", "0.7", "0.8", "0.9", "0.95"];
const KS = ["2", "3", "4", "6", "8"];
const EVERY = ["2", "3", "4", "6", "9"];

/* Pacing is chosen, not automatic (4.1). Slow and Medium crossfade each new
   posterior in; Fast declares no choreography and shows the stages only. */
const SPEEDS = {
  slow: { label: "Slow", detail: "each new posterior faded in", ms: 900, choreo: true },
  medium: { label: "Medium", detail: "the same, at reading pace", ms: 420, choreo: true },
  fast: { label: "Fast", detail: "the stages only, no fade", ms: 110, choreo: false },
};
/* One step is one observation WATCHED — a fixed beat whatever Play is set to. */
const STEP_MS = 700;

/* One layout function read by `height` and `draw`, so the two cannot drift. */
const GUT = 66, GAP = 16, LAB = 15, TOP = 6, BOT = 8;
const MAX_CELL = 40;           // the Mood tab's few days would otherwise balloon
const MCELL_MIN = 34;          // a probability table cell has to hold "0.95"
const GRAPH_H = 118;           // the toy's state graph: two states over two moods
const BAR_H = 6;               // the confidence bar under an imputed call

function layout(w, v) {
  const mood = v.view === "toy";
  const L = mood ? v.days : M.L_DEFAULT;
  const K = mood ? 2 : Number(v.K);
  const cell = Math.min(MAX_CELL, Math.floor((w - GUT - 6) / L));
  const mcell = Math.max(MCELL_MIN, Math.min(MAX_CELL, cell));
  let y = TOP;
  const add = (h) => { const b = { y: y + LAB, h }; y += LAB + h + GAP; return b; };
  const obs = add(cell);
  const model = mood ? add(Math.max(LAB + 2 * mcell, GRAPH_H)) : add(K * cell);
  const strip = add(K * cell);
  const imp = add(cell + BAR_H);
  const truth = v.truth ? add(cell) : null;
  return { cell, mcell, K, L, gx: GUT, obs, model, strip, imp, truth, height: y - GAP + BOT };
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
    const off = h === o ? (h === 0 ? -8 : 8) : (h === 0 ? 10 : -10);
    label(lx + off, ly, E[h][o].toFixed(2), off > 0 ? "left" : "right");
  }
  for (let o = 0; o < 2; o += 1) {
    tileFn(O[o].x - ts / 2, oy, o, 1, ts);
    label(O[o].x, oy + ts + 9, o === 1 ? "Happy" : "Sad");
  }
}
const meanConf = (st) => {
  let s = 0, n = 0;
  for (const x of st.sites) if (x.blank) { s += x.conf; n += 1; }
  return n ? s / n : 0;
};

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
    const mood = params.view === "toy";
    const entries = [
      mood
        ? { token: "ink-2", label: "Happy (filled); Sad is open", mark: "bar" }
        : { token: "ink-2", label: "Alternate allele (filled); reference allele is open", mark: "bar" },
      { token: "unknown", label: mood ? "Not recorded" : "Not typed on the array", mark: "bar" },
      { token: "posterior", label: mood ? "Posterior: which pattern the day is in" : "Posterior: which haplotype is being copied", mark: "bar" },
      { token: "empirical", label: "Viterbi path: the single most likely sequence of states", mark: "line" },
    ];
    if (params.truth) entries.push({ token: "reference", label: mood ? "True pattern" : "True copying path", mark: "dash" });
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

    seq: { type: "section", label: "The sequence" },

    days: {
      type: "int", label: "Days", min: 6, max: 20, default: 12,
      when: { param: "view", equals: "toy" },
    },
    missing: {
      type: "int", label: "Days not recorded", min: 0, max: 8, default: 3,
      detail: "missing completely at random",
      when: { param: "view", equals: "toy" },
    },
    happy: {
      type: "choice", label: "P(Happy) in pattern 2",
      detail: "pattern 1 is Happy with one minus this",
      options: HAPPY.map((v) => ({ value: v, label: v })),
      default: "0.8",
      when: { param: "view", equals: "toy" },
    },

    K: {
      type: "choice", label: "Reference haplotypes",
      options: KS.map((v) => ({ value: v, label: v })),
      default: "6",
      when: { param: "view", equals: "biological" },
    },
    every: {
      type: "choice", label: "Array types one site in",
      options: EVERY.map((v) => ({ value: v, label: v })),
      default: "4",
      when: { param: "view", equals: "biological" },
    },
    switches: {
      type: "int", label: "Recombination points", min: 0, max: 4, default: 2,
      detail: "where the sample's copied haplotype changes",
      when: { param: "view", equals: "biological" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    truth: {
      type: "bool", label: "Show the hidden states", default: false, display: true,
    },

    model: { type: "section", label: "The model" },

    rho: {
      type: "choice", label: "Switch rate ρ",
      detail: "P(the hidden state changes between neighbours)",
      options: RHOS.map((v) => ({ value: v, label: v })),
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
    stepLabel: { param: "view", labels: { toy: "Observe a day", biological: "Type a site" }, default: "Observe a day" },
    stepTitle: "Reveal the next recorded observation and recompute the posterior",
    runLabel: "Play",
    runTitle: "Reveal the rest, one observation at a time",

    init: ({ params, state, fromScratch }) => {
      const T = state.order.length;
      const idx = fromScratch ? 0 : Math.min(params.shown, T);
      /* beatP is how far the newest stage has faded in (0..1); beatOn says a
         unit is genuinely in flight, so nothing half-faded outlives motion. */
      return { idx, t: 0, beatOn: false, beatP: 1, done: idx >= T };
    },

    advance(anim, { dt, params, state }) {
      const T = state.order.length;
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
    const mood = state.kind === "mood";
    const idx = anim?.idx ?? 0;
    const st = state.stages[idx];
    const fading = anim?.beatOn && idx > 0;
    const prev = fading ? state.stages[idx - 1] : null;
    const p = fading ? anim.beatP : 1;
    const gammaAt = (i, h) => (prev ? prev.gamma[i][h] + (st.gamma[i][h] - prev.gamma[i][h]) * p : st.gamma[i][h]);
    const newest = idx > 0 ? state.order[idx - 1] : -1;
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
    const caption = (b, s) => text(gx, b.y - LAB / 2 - 1, s, colors.ink2);
    const rowLabel = (y, s) => text(gx - 6, y + cell / 2 + 0.5, s, colors.ink3, "right");
    /* An observation tile: filled for Happy / the alternate allele, open for
       Sad / the reference allele; the Mood tab adds its letter. */
    const tile = (x, y, a, alpha = 1, size = cell) => {
      fill(x, y, size, size, a === 1 ? colors.ink2 : colors.surface3, alpha);
      border(x, y, size, size);
      if (mood) text(x + size / 2, y + size / 2 + 0.5, a === 1 ? "H" : "S", a === 1 ? colors.surface : colors.ink1, "center", `600 ${Math.round(size * 0.5)}px ${colors.font}`);
    };
    const unknownCell = (x, y, mark) => {
      fill(x, y, cell, cell, colors.unknown, 0.16);
      border(x, y, cell, cell);
      if (mark) text(x + cell / 2, y + cell / 2 + 0.5, "?", colors.ink3, "center", `600 ${Math.round(cell * 0.5)}px ${colors.font}`);
    };
    const emptyCell = (x, y) => border(x, y, cell, cell);
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
    const stateName = (h) => (mood ? `P${h + 1}` : `h${h + 1}`);

    /* 1. The observations as recorded so far. */
    caption(Lo.obs, mood
      ? `Moods on record: ${st.t} of ${state.order.length} days`
      : `Array genotypes: ${st.t} of ${state.order.length} typed sites`);
    rowLabel(Lo.obs.y, mood ? "mood" : "array");
    for (let i = 0; i < L; i += 1) {
      const s = st.sites[i];
      if (s.blank) unknownCell(cx(i), Lo.obs.y, mood);
      else if (s.known) tile(cx(i), Lo.obs.y, state.truthAllele[i]);
      else emptyCell(cx(i), Lo.obs.y);
    }
    if (fading && newest >= 0) {
      /* The arrival: the newest observation ringed in the highlight colour,
         fading with the beat, so a frozen ring cannot read as a marked cell. */
      ctx.save(); ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2;
      ctx.strokeRect(cx(newest) + 1, Lo.obs.y + 1, cell - 2, cell - 2);
      ctx.restore();
    }

    /* 2. The model: two tables, or the panel. */
    if (mood) {
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
      caption(Lo.model, `Reference panel: ${K} sequenced haplotypes`);
      for (let h = 0; h < K; h += 1) {
        const y = Lo.model.y + h * cell;
        rowLabel(y, stateName(h));
        for (let i = 0; i < L; i += 1) tile(cx(i), y, state.panel.hap[h][i]);
      }
    }

    /* 3. The posterior strip, and the paths through it. */
    caption(Lo.strip, mood
      ? "Posterior P(pattern | moods on record), and the Viterbi path"
      : "Posterior P(copied haplotype | typed sites), and the Viterbi path");
    for (let h = 0; h < K; h += 1) {
      const y = Lo.strip.y + h * cell;
      rowLabel(y, stateName(h));
      for (let i = 0; i < L; i += 1) {
        fill(cx(i), y, cell, cell, colors.posterior, beliefAlpha(gammaAt(i, h)));
        border(cx(i), y, cell, cell);
      }
    }
    if (params.truth) statePath(Lo.strip, state.src, colors.reference, true);
    if (idx > 0) statePath(Lo.strip, st.path, colors.empirical, false);

    /* 4. The imputed row: every position not yet observed, filled by its
       confidence — the bar beneath is P(the call), from 0.5 to 1. */
    caption(Lo.imp, mood ? "Imputed mood, and its confidence" : "Imputed allele, and its confidence");
    rowLabel(Lo.imp.y, "imputed");
    for (let i = 0; i < L; i += 1) {
      const s = st.sites[i];
      const x = cx(i), y = Lo.imp.y;
      if (s.known) { tile(x, y, state.truthAllele[i]); continue; }
      tile(x, y, s.call);
      fill(x + 1, y + cell + 1, (cell - 2) * Math.max(0, (s.conf - 0.5) / 0.5), BAR_H - 2, colors.posterior);
    }

    /* 5. The truth, on request. */
    if (Lo.truth) {
      caption(Lo.truth, mood ? "True moods, a ring where the imputed call differs"
        : "True haplotype, a ring where the imputed call differs, a mark at a variant the panel lacks");
      rowLabel(Lo.truth.y, "truth");
      for (let i = 0; i < L; i += 1) {
        const s = st.sites[i];
        const a = state.truthAllele[i];
        tile(cx(i), Lo.truth.y, a);
        if (s.blank && s.call !== a) {
          ctx.strokeStyle = colors.ink1; ctx.lineWidth = 2;
          ctx.strokeRect(cx(i) + 1, Lo.truth.y + 1, cell - 2, cell - 2);
        }
        if (!mood && state.novel[i]) {
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
    const st = state.stages[anim?.idx ?? 0];
    const T = state.order.length;
    const mood = state.kind === "mood";
    const tiles = [
      { label: mood ? "Days on record" : "Sites typed", value: `${st.t} of ${T}`,
        note: mood ? "revealed so far" : "on the array, revealed so far" },
      { label: mood ? "Days not recorded" : "Sites to impute", value: String(st.blanks),
        note: mood ? "the ? cells" : "untyped, filled from the copied haplotype" },
      /* On the Mood tab a call's confidence is capped by the emission itself:
         even a pattern known for certain is Happy with probability `happy`,
         so a P >= 0.9 count would read 0 of 3 at the default and teach that
         the model failed. The mean is the honest number there; on the
         Genotype tab the alleles ARE the states' emissions and a count of
         confident calls is the number an imputation report quotes. */
      mood
        ? { label: "Mean P(imputed mood)", value: st.blanks ? fmt(meanConf(st), 2) : "—",
          note: "confidence of the call, from the posterior" }
        : { label: "Imputed with P ≥ 0.9", value: `${st.sure} of ${st.blanks}`,
          note: "confidence of the call, from the posterior" },
    ];
    if (params.truth) {
      tiles.push({ label: "Imputed correctly", value: `${st.correct} of ${st.blanks}`,
        note: "against the true value" });
      if (mood) tiles.push({ label: "Pattern decoded correctly", value: `${st.stateRight} of ${state.L}`,
        note: "Viterbi path against the true pattern, all days" });
      else tiles.push({ label: "A frequency fill would get", value: `${st.freqCorrect} of ${st.blanks}`,
        note: "the panel's commoner allele at each site" });
    }
    return tiles;
  },
});
