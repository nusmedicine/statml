/* ============================================================================
   Widget 31 · Modeling Time-to-Event Data — the censored are not missing.

   PHM5003 05-06. The misconception: censored patients are missing data to
   discard. Measured first (`_lab/time-event-measure.mjs`, 30 checks): the
   five-patient KM reproduces cell 8's stored plot to the digit, and the Cox
   engine is verified against an independent naive likelihood plus the
   tie-free log-rank ≡ score identity, because cell 16 stored NO output.

   TWO TABS (Kenneth's pick, 2026-08-29), one motion — a time cursor sweeps
   right and the curve builds under it:

     Five patients   the notebook's own opening table (A–E) as lanes above
                     a building KM curve; an event steps the curve down by
                     1/(at risk), a censoring ends a lane with an open mark
                     and shrinks the risk set WITHOUT a step — the t = 8
                     drop is a halving, one of two still at risk. Below,
                     the HAZARD STRIP (pick H1 — Singer & Willett's paired
                     profile at human scale): bars d/n at each event time,
                     no bar at a censoring; a censoring moves the strip's
                     DENOMINATOR, which is the cell-2 bullet drawn.
     Two groups      200 simulated patients, KM by disease group with the
                     log-rank p; the Cox model behind a gate, as a CARD —
                     the 12-covariate forest (the arc's exp(b) reading,
                     back from lm-adjustment) beside pick H4: per-bin event
                     rates with the one-covariate Cox claim as dashed
                     outlines, every baseline bin × the same exp(b) — what
                     "proportional" says, drawn.

   The `censored` control is the misconception itself, on both tabs: kept
   (KM) · dropped · counted as events. Dropped on five patients reads
   "everyone dies by 8"; the honest curve holds 0.30. It is display: true —
   three readings of ONE dataset, so toggling must never reset the sweep.

   THE DATA: the five patients are the notebook's own; the 200 keep the
   notebook's event process but NOT its censoring — cell 11 draws Status
   independently of time, and under that design discarding the censored is
   UNBIASED while KM lies high (+0.13): the opposite lesson. model.js's
   simulate() censors by study end instead (min(T, C), doors close at 20);
   the ruling and its measurements are docs/catalogue.md § Widget 31.
   R's seeded draw does not reproduce in JS, so nothing here claims R's
   numbers: the deterministic cells are verified to the digit, the
   simulated arm across this widget's own seeds (log-rank p < 1e-4 on
   100/100). Seed 3 is the default — the lowest seed where the Cox fit
   tells cell 17's exact story: Age, Disease, SNP_1–3 significant and all
   seven null SNPs quiet (seeds 1 and 2 each flag a null SNP at the 5%
   floor).
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { km, logrank, coxph, simulate } from "./model.js";

/* --- the five patients — the notebook's own table ------------------------- */
const IDS = ["A", "B", "C", "D", "E"];
const T5 = [5, 10, 6, 8, 7];
const S5 = [1, 0, 1, 1, 0];

const T1MAX = 11;
const T2MAX = 22;

const SPEEDS = {
  slow: { label: "Slow", rate: 1.2, detail: "about a year per second" },
  medium: { label: "Medium", rate: 3.5, detail: "the curve builds in a few seconds" },
  fast: { label: "Fast", rate: 9, detail: "straight to the finished curve" },
};

/* --- stage geometry, one place -------------------------------------------- */
const LANE_GAP = 24;
const LANES_Y = 30;
const LANES_H = LANE_GAP * 4 + 12;
const CURVE1_Y = LANES_Y + LANES_H + 40;
const CURVE1_H = 180;
const HAZ_Y = CURVE1_Y + CURVE1_H + 64;
const HAZ_H = 80;
const PAT_HEIGHT = HAZ_Y + HAZ_H + 48;

const KM2_Y = 30;
const KM2_H = 230;
const COX_TOP = KM2_Y + KM2_H + 56;
const FOREST_ROW = 20;
/* 50 above the forest: the card's header is a title and TWO fsXs lines —
   one line overran the 550px canvas, the width every state is hashed at */
const CARD_HEAD = 50;
const CARD_H = CARD_HEAD + 12 * FOREST_ROW + 46;
const GRP_HEIGHT = (cox) => (cox ? COX_TOP + CARD_H + 36 : COX_TOP - 14);

/* H4's bins: [10,16) only — [6,10) has zero baseline events on clean seeds
   and [16,20) ~0 person-time in the disease arm (measured; catalogue). */
const H4_BINS = [[10, 12], [12, 14], [14, 16]];

const treatmentOf = (p) => p.censored;

/* S(t) read off a km() step list. */
function readS(steps, t) {
  let S = 1;
  for (const s of steps) {
    if (s.t <= t) S = s.S;
    else break;
  }
  return S;
}

/* events per person-time in [lo, hi) — the rate H4's bars carry */
function binRate(times, status, lo, hi) {
  let d = 0;
  let pt = 0;
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (t >= lo && t < hi && status[i] === 1) d += 1;
    if (t >= lo) pt += Math.min(t, hi) - lo;
  }
  return pt > 0 ? d / pt : NaN;
}

/* the three readings of one dataset — what the `censored` control chooses */
function readings(times, status) {
  const keptT = times.filter((_, i) => status[i] === 1);
  return {
    kept: km(times, status),
    dropped: keptT.length ? km(keptT, keptT.map(() => 1)) : { steps: [], censors: [] },
    asevents: km(times, times.map(() => 1)),
  };
}

defineWidget({
  slug: "time-event",
  title: "Modeling Time-to-Event Data",
  status: "draft",
  subtitle:
    "We can follow each patient until the event occurs, or until observation " +
    "ends without it — a censored patient. The Kaplan–Meier estimate keeps " +
    "the censored in the risk set until they leave, so the curve uses " +
    "everything that was seen.",
  layout: "side",
  height: ({ concept, cox }) => (concept === "patients" ? PAT_HEIGHT : GRP_HEIGHT(cox)),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "patients", label: "Five patients", detail: "the censoring mechanics at human scale — one curve, built one time point at a time" },
        { value: "groups", label: "Two groups", detail: "200 simulated patients — compare survival by disease group, then fit the Cox model" },
      ],
      default: "patients",
      display: true,
    },

    reading: { type: "section", label: "Reading the data" },
    /* The misconception as a control. Three readings of the SAME dataset,
       so display: true — toggling compares, and must never reset the sweep. */
    censored: {
      type: "segmented",
      label: "Censored patients",
      options: [
        { value: "kept", label: "Kept", detail: "in the risk set until they leave — the Kaplan–Meier estimate" },
        { value: "dropped", label: "Dropped", detail: "removed from the data entirely" },
        { value: "asevents", label: "As events", detail: "their last-seen time counted as the event" },
      ],
      default: "kept",
      display: true,
    },
    truth: {
      type: "bool",
      label: "True curves",
      detail: "the same patients with nobody censored — never seen in practice",
      default: false,
      display: true,
      when: { param: "concept", equals: "groups" },
    },
    bands: {
      type: "bool",
      label: "Confidence bands",
      detail: "95% Greenwood bands around each Kaplan–Meier curve",
      default: false,
      display: true,
      when: { param: "concept", equals: "groups" },
    },

    /* A bool, NOT a `gate`: core hides the entire drive row while any gate
       is shut (right for pca, whose gate opens the only thing to drive), and
       this widget's sweep must keep its Play with the card closed. */
    cox: {
      type: "bool",
      label: "Cox model",
      detail: "the fitted hazard ratios for age, disease and all ten SNPs",
      default: false,
      display: true,
      when: { param: "concept", equals: "groups" },
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
      afterDrive: true,
    },

    /* Seed 3, hidden (the arc's ruling: nothing on screen should need "seed"
       explained) — the lowest seed telling cell 17's exact story; see header. */
    seed: { type: "int", min: 1, max: 200, default: 3, hidden: true },
    /* the authoring escape hatch: cursor time × 2, so ?shown=44 is a finished
       figure on either tab */
    shown: { type: "int", min: 0, max: 44, default: 0, hidden: true },
  },

  legend: [
    { token: "event", label: "The event occurred", mark: "dot" },
    { token: "unknown", label: "Censored — followed this far, then unseen", mark: "dot" },
    { token: "empirical", label: "The Kaplan–Meier curve, censored kept in the risk set", mark: "line" },
    { token: "highlight", label: "The same data with the censored dropped or counted as events", mark: "line" },
    { token: "reference", label: "The true curves with nobody censored", mark: "line" },
    { token: "group-a", label: "No disease", mark: "line" },
    { token: "group-b", label: "Disease", mark: "line" },
  ],

  compute({ params, rng }) {
    const five = readings(T5, S5);
    const sim = simulate(rng, 200);
    const per = (grp) => {
      const t = sim.time.filter((_, i) => sim.disease[i] === grp);
      const s = sim.status.filter((_, i) => sim.disease[i] === grp);
      const tt = sim.trueT.filter((_, i) => sim.disease[i] === grp);
      return {
        ...readings(t, s),
        truth: km(tt, tt.map(() => 1)),
        rates: H4_BINS.map(([lo, hi]) => binRate(t, s, lo, hi)),
        n: t.length,
      };
    };
    const groups = [per(0), per(1)];
    const lr = logrank(sim.time, sim.status, sim.disease);
    const X = sim.age.map((a, i) => [a, sim.disease[i], ...sim.snps[i]]);
    const cox12 = coxph(sim.time, sim.status, X);
    const cox1 = coxph(sim.time, sim.status, sim.disease.map((v) => [v]));
    /* every distinct recorded time — what one Step advances to; a censoring
       is a step of its own, because the risk set moving IS the lesson */
    const stepTimes = {
      patients: [...new Set(T5)].sort((a, b) => a - b),
      groups: [...new Set(sim.time)].sort((a, b) => a - b),
    };
    /* where the sweep ends: the last recorded time on each tab */
    const tEnd = {
      patients: stepTimes.patients[stepTimes.patients.length - 1],
      groups: stepTimes.groups[stepTimes.groups.length - 1],
    };
    return {
      five,
      groups,
      lr,
      cox12,
      cox1,
      stepTimes,
      tEnd,
      events: sim.status.reduce((a, b) => a + b, 0),
    };
  },

  animation: {
    stepLabel: "Next time point",
    stepTitle: "Advance to the next event or censoring",
    runLabel: "Play",
    runTitle: "Sweep time forward at the chosen speed",
    init: ({ params, state, fromScratch }) => {
      const t = fromScratch ? 0 : Math.min(params.shown / 2, T2MAX);
      return { t, done: t >= state.tEnd[params.concept] };
    },
    advance: (anim, { dt, params, state }) => {
      const tEnd = state.tEnd[params.concept];
      if (anim.mode === "step") {
        const next = state.stepTimes[params.concept].find((t) => t > anim.t + 1e-9);
        anim.t = next !== undefined ? next : tEnd;
        anim.done = anim.t >= tEnd;
        return false;
      }
      anim.t = Math.min(tEnd, anim.t + (SPEEDS[params.speed].rate * dt) / 1000);
      if (anim.t >= tEnd) {
        anim.done = true;
        return false;
      }
      return true;
    },
    /* Display changes (tab, treatment, overlays) keep the sweep where it is;
       `done` is re-read against the NEW tab's end, so a curve finished on
       Five patients keeps building when the reader moves to Two groups. */
    rebuild: (anim, { params, state }) => {
      anim.done = anim.t >= state.tEnd[params.concept];
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "patients") drawPatients(ctx, colors, w, params, state, t);
    else drawGroups(ctx, colors, w, params, state, t);
  },

  readout({ params, state, anim }) {
    const t = anim?.t ?? 0;
    const treatment = treatmentOf(params);
    if (params.concept === "patients") {
      const atRisk = T5.filter((v) => v > t).length;
      const events = T5.filter((v, i) => S5[i] === 1 && v <= t).length;
      const S = readS(state.five[treatment].steps, t);
      return [
        { label: "At risk", value: String(atRisk), note: "patients still being followed" },
        { label: "Events", value: String(events), note: "each steps the curve down by 1 over the number at risk" },
        {
          label: "Survival",
          value: fmt(S, 2),
          note: treatment === "kept"
            ? "the Kaplan–Meier estimate at the cursor"
            : treatment === "dropped"
              ? "with the censored removed — compare the kept curve"
              : "with censoring times counted as events",
        },
      ];
    }
    const tiles = [
      { label: "Events", value: `${state.events} of 200`, note: "the rest are censored — the study ends before their event" },
      {
        label: "Log-rank p",
        value: state.lr.p < 1e-4 ? "< 0.0001" : fmt(state.lr.p, 4),
        note: "the group curves compared, censored kept in the risk sets",
      },
    ];
    if (params.cox) {
      tiles.push({
        label: "HR (disease)",
        value: fmt(state.cox12.hr[1], 2),
        note: "hazard multiplied, adjusted for age and all ten SNPs",
      });
    }
    return tiles;
  },

  summary({ params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "patients") {
      const S = readS(state.five[treatmentOf(params)].steps, t);
      return `Five patients followed over time: three events, two censored. A Kaplan–Meier curve built to time ${fmt(t, 1)}, survival ${fmt(S, 2)}, with a hazard bar at each event time showing the share of those at risk who had the event.`;
    }
    return `Kaplan–Meier curves for 200 simulated patients by disease group, ${state.events} events, log-rank p ${state.lr.p < 1e-4 ? "below 0.0001" : fmt(state.lr.p, 4)}${params.cox ? `, and a Cox model whose adjusted hazard ratio for disease is ${fmt(state.cox12.hr[1], 2)}` : ""}.`;
  },
});

/* --- one KM curve, clipped to the cursor ---------------------------------- */
function drawCurve(ctx, plot, steps, censors, tCut, color, {
  dash = [], width = 2, alpha = 1, ticks = true, surface = null,
} = {}) {
  if (!steps.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let S = 1;
  ctx.moveTo(plot.sx(0), plot.sy(1));
  for (const s of steps) {
    if (s.t > tCut) break;
    ctx.lineTo(plot.sx(s.t), plot.sy(S));
    ctx.lineTo(plot.sx(s.t), plot.sy(s.S));
    S = s.S;
  }
  const tLast = Math.min(tCut, steps[steps.length - 1].t);
  ctx.lineTo(plot.sx(Math.max(tLast, 0)), plot.sy(S));
  ctx.stroke();
  ctx.setLineDash([]);
  if (ticks) {
    /* open circles, surface-filled so the mark masks the line under it */
    for (const c of censors) {
      if (c.t > tCut) continue;
      ctx.beginPath();
      ctx.arc(plot.sx(c.t), plot.sy(c.S), 3.5, 0, 2 * Math.PI);
      if (surface) {
        ctx.fillStyle = surface;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* --- the Greenwood band, kept reading only -------------------------------- */
function drawBand(ctx, plot, steps, tCut, color) {
  if (!steps.length) return;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = color;
  let prevLo = 1;
  let prevHi = 1;
  let prevT = 0;
  for (const s of steps) {
    if (s.t > tCut) break;
    const lo = Number.isNaN(s.lo) ? 0 : s.lo;
    const hi = Number.isNaN(s.hi) ? 0 : s.hi;
    ctx.fillRect(
      plot.sx(prevT),
      plot.sy(prevHi),
      plot.sx(s.t) - plot.sx(prevT),
      plot.sy(prevLo) - plot.sy(prevHi),
    );
    prevLo = lo;
    prevHi = hi;
    prevT = s.t;
  }
  ctx.fillRect(
    plot.sx(prevT),
    plot.sy(prevHi),
    plot.sx(Math.min(tCut, T2MAX)) - plot.sx(prevT),
    plot.sy(prevLo) - plot.sy(prevHi),
  );
  ctx.restore();
}

/* --- the time cursor, hidden once the sweep is over ----------------------- */
function drawCursor(ctx, colors, x, yTop, yBot, t, tMax) {
  if (t <= 0 || t >= tMax) return;
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x, yBot);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colors.highlight;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`t = ${fmt(t, 1)}`, x, yTop - 4);
  ctx.restore();
}

/* --- tab 1: five patients -------------------------------------------------- */
function drawPatients(ctx, colors, w, params, state, t) {
  const left = 56;
  const right = w - 14;
  const X = (v) => left + (v / T1MAX) * (right - left);
  const treatment = treatmentOf(params);

  /* the lanes — the notebook's table, drawn. Under "dropped" the censored
     lanes fade: removed from the data is something you can SEE. */
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  for (let i = 0; i < 5; i += 1) {
    const y = LANES_Y + i * LANE_GAP;
    const gone = treatment === "dropped" && S5[i] === 0;
    ctx.globalAlpha = gone ? 0.25 : 1;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(IDS[i], left - 12, y);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), y);
    ctx.lineTo(X(T5[i]), y);
    ctx.stroke();
    if (S5[i] === 1 || treatment === "asevents") {
      ctx.fillStyle = S5[i] === 1 ? colors.event : colors.unknown;
      ctx.beginPath();
      ctx.arc(X(T5[i]), y, 4, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillStyle = colors.surface;
      ctx.strokeStyle = colors.unknown;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(T5[i]), y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* the curve */
  const rect = { x: left, y: CURVE1_Y, w: right - left, h: CURVE1_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T1MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 2.5, 5, 7.5, 10] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });

  const R = state.five;
  if (treatment !== "kept") {
    drawCurve(ctx, plot, R.kept.steps, R.kept.censors, t, colors.empirical, { alpha: 0.4, surface: colors.surface });
    drawCurve(ctx, plot, R[treatment].steps, R[treatment].censors, t, colors.highlight, { width: 2.5, ticks: false });
  } else {
    drawCurve(ctx, plot, R.kept.steps, R.kept.censors, t, colors.empirical, { width: 2.5, surface: colors.surface });
  }

  /* the hazard strip — pick H1: of those still at risk, the share who go
     now. No bar at a censoring; the censor tick on the strip's axis marks
     where the DENOMINATOR changed. */
  const hy = (v) => HAZ_Y + HAZ_H - v * HAZ_H;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("Hazard at each event — of those still at risk, the share who go now", left, HAZ_Y - 10);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(left, hy(v));
    ctx.lineTo(right, hy(v));
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText(fmt(v, 1), left - 6, hy(v) + 3);
  }
  for (const s of R.kept.steps) {
    if (s.events === 0 || s.t > t) continue;
    const hVal = s.events / s.atRisk;
    ctx.fillStyle = colors.event;
    ctx.fillRect(X(s.t) - 7, hy(hVal), 14, hy(0) - hy(hVal));
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "center";
    ctx.fillText(`${s.events}/${s.atRisk}`, X(s.t), hy(hVal) - 5);
  }
  for (const c of R.kept.censors) {
    if (c.t > t) continue;
    ctx.strokeStyle = colors.unknown;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(c.t), hy(0) - 5);
    ctx.lineTo(X(c.t), hy(0) + 5);
    ctx.stroke();
  }
  ctx.restore();

  drawCursor(ctx, colors, X(Math.min(t, T1MAX)), LANES_Y - 12, hy(0), t, state.tEnd.patients);
}

/* --- tab 2: two groups ----------------------------------------------------- */
function drawGroups(ctx, colors, w, params, state, t) {
  const left = 56;
  const right = w - 14;
  const treatment = treatmentOf(params);
  const rect = { x: left, y: KM2_Y, w: right - left, h: KM2_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T2MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 5, 10, 15, 20] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });

  const groupColor = [colors.groupA, colors.groupB];
  state.groups.forEach((g, i) => {
    if (params.bands && treatment === "kept") drawBand(ctx, plot, g.kept.steps, t, groupColor[i]);
    if (treatment !== "kept") {
      drawCurve(ctx, plot, g.kept.steps, g.kept.censors, t, groupColor[i], { alpha: 0.35, surface: colors.surface });
      drawCurve(ctx, plot, g[treatment].steps, [], t, groupColor[i], { width: 2.5, ticks: false });
    } else {
      drawCurve(ctx, plot, g.kept.steps, g.kept.censors, t, groupColor[i], { width: 2.5, surface: colors.surface });
    }
    if (params.truth) {
      drawCurve(ctx, plot, g.truth.steps, [], t, colors.reference, { dash: [5, 4], width: 1.5, ticks: false });
    }
  });
  /* Group labels pinned where each curve crosses S ≈ 0.6, drawn once the
     sweep has reached that point — labels that followed the curves' current
     ends stacked in the corner when both curves finished near zero. The
     disease curve is the left one, so its label sits left of its crossing
     (under its own flat early stretch); no-disease right of its crossing. */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "alphabetic";
  state.groups.forEach((g, i) => {
    const cross = g[treatment].steps.find((s) => s.S <= 0.6);
    if (!cross || t < cross.t) return;
    ctx.fillStyle = groupColor[i];
    ctx.textAlign = i === 0 ? "left" : "right";
    ctx.fillText(
      i === 0 ? "no disease" : "disease",
      plot.sx(cross.t) + (i === 0 ? 8 : -8),
      plot.sy(cross.S) + 4,
    );
  });
  ctx.restore();
  drawCursor(ctx, colors, plot.sx(Math.min(t, T2MAX)), KM2_Y - 12, plot.sy(0), t, state.tEnd.groups);

  if (!params.cox) return;
  drawCoxCard(ctx, colors, w, state);
}

/* --- the Cox card: the forest, and pick H4 --------------------------------- */
function drawCoxCard(ctx, colors, w, state) {
  const left = 14;
  const right = w - 14;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Cox proportional hazards", left, COX_TOP);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText("h(t) = h₀(t) × exp(b₁x₁ + … )", left, COX_TOP + 16);
  ctx.fillText("each exp(b) multiplies the hazard by a constant factor, at every time", left, COX_TOP + 30);

  const top = COX_TOP + CARD_HEAD;
  const forestW = Math.round((right - left) * 0.52);
  drawForest(ctx, colors, { x: left + 58, y: top, w: forestW - 58 }, state.cox12);
  drawH4(ctx, colors, { x: left + forestW + 64, y: top, w: right - (left + forestW + 64) }, state);
  ctx.restore();
}

function drawForest(ctx, colors, rp, fit) {
  const names = ["Age", "Disease", ...Array.from({ length: 10 }, (_, j) => `SNP_${j + 1}`)];
  const DOM = [0.4, 10];
  const fx = (hr) => rp.x
    + ((Math.log(Math.max(hr, DOM[0])) - Math.log(DOM[0])) / (Math.log(DOM[1]) - Math.log(DOM[0]))) * rp.w;
  const H = 12 * FOREST_ROW;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const v of [0.5, 1, 2, 4, 8]) {
    ctx.beginPath();
    ctx.moveTo(fx(v), rp.y);
    ctx.lineTo(fx(v), rp.y + H);
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.fillText(String(v), fx(v), rp.y + H + 13);
  }
  ctx.fillText("hazard ratio, exp(b)", rp.x + rp.w / 2, rp.y + H + 27);
  ctx.strokeStyle = colors.reference;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fx(1), rp.y);
  ctx.lineTo(fx(1), rp.y + H);
  ctx.stroke();
  names.forEach((nm, k) => {
    const y = rp.y + FOREST_ROW * (k + 0.5);
    const sig = fit.p[k] < 0.05;
    ctx.fillStyle = sig ? colors.ink1 : colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.fillText(nm, rp.x - 6, y + 3);
    const lo = Math.exp(fit.beta[k] - 1.959964 * fit.se[k]);
    const hi = Math.exp(fit.beta[k] + 1.959964 * fit.se[k]);
    ctx.strokeStyle = sig ? colors.empirical : colors.ink3;
    ctx.globalAlpha = sig ? 1 : 0.55;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx(Math.max(lo, DOM[0])), y);
    ctx.lineTo(fx(Math.min(hi, DOM[1])), y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx(fit.hr[k]), y, 3.5, 0, 2 * Math.PI);
    if (sig) {
      ctx.fillStyle = colors.empirical;
      ctx.fill();
    } else {
      ctx.fillStyle = colors.surface;
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/* pick H4: the proportional-hazards claim on the hazard scale — every
   baseline bin × the SAME exp(b), drawn as dashed outlines over the
   disease bars. HR from coxph(~ disease) ALONE: the marginal claim the
   two curves make, not the adjusted forest row (which holds the SNPs
   fixed). */
function drawH4(ctx, colors, rp, state) {
  const rates0 = state.groups[0].rates;
  const rates1 = state.groups[1].rates;
  const HR = state.cox1.hr[0];
  const rMax = Math.max(...rates1, ...rates0.map((r) => r * HR)) * 1.2;
  const H = 12 * FOREST_ROW;
  const bx = (t) => rp.x + ((t - 10) / 6) * rp.w;
  const by = (r) => rp.y + H - (r / rMax) * (H - 26);
  ctx.fillStyle = colors.ink2;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  /* two lines — one overran the 550px canvas from this column's x */
  ctx.fillText("events per year at risk", rp.x, rp.y - 6);
  ctx.fillText("dashed: no-disease × " + fmt(HR, 2), rp.x, rp.y + 8);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx(10), by(0));
  ctx.lineTo(bx(16), by(0));
  ctx.stroke();
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  for (const v of [10, 12, 14, 16]) ctx.fillText(String(v), bx(v), rp.y + H + 13);
  ctx.fillText("time (years)", (bx(10) + bx(16)) / 2, rp.y + H + 27);
  H4_BINS.forEach(([lo, hi], k) => {
    const bw = (bx(hi) - bx(lo)) / 2 - 8;
    ctx.fillStyle = colors.groupA;
    ctx.fillRect(bx(lo) + 5, by(rates0[k]), bw, by(0) - by(rates0[k]));
    ctx.fillStyle = colors.groupB;
    ctx.fillRect(bx(lo) + 5 + bw + 6, by(rates1[k]), bw, by(0) - by(rates1[k]));
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(bx(lo) + 5 + bw + 6, by(rates0[k] * HR), bw, by(0) - by(rates0[k] * HR));
    ctx.setLineDash([]);
  });
}
