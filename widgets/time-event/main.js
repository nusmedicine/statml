/* ============================================================================
   Widget 31 · Modeling Time-to-Event Data — the censored are not missing.

   PHM5003 05-06. The misconception: censored patients are missing data to
   discard. Measured first (`_lab/time-event-measure.mjs`, 30 checks): the
   five-patient KM reproduces cell 8's stored plot to the digit, and the Cox
   engine is verified against an independent naive likelihood plus the
   tie-free log-rank ≡ score identity, because cell 16 stored NO output.

   ROUND 2 RESTRUCTURED TO THREE CONCEPTS (Kenneth, 2026-08-29): one tab per
   question, labels option B, and each tab got an adversarial fix:

     Censoring         how time-to-event data is recorded. The notebook's
                       five patients as lanes over a building KM curve, the
                       hazard strip (pick H1 — bars d/n at events, none at a
                       censoring), and the `censored` control: kept (KM) ·
                       dropped · counted as events. FIXES: the two censored
                       lanes name their reasons ("study ended", "dropped
                       out") because an unlabelled open circle reads as
                       "survived" — the misconception wearing a costume —
                       and each wrong treatment states its MECHANISM in a
                       panel note (2.9: mechanism, never a verdict).
     Comparing groups  are the groups different? Two KM curves at n = 200,
                       censor ticks, the log-rank p, truth/bands overlays —
                       and pick H4 moved HERE as the introduction of the
                       hazard ratio: per-bin event rates with the dashed
                       claim, no-disease × exp(b), ONE number at every
                       time. It sat beside the 12-covariate forest before,
                       where its marginal HR contradicted the forest's
                       adjusted row on the same card.
     Finding factors   which factors are associated with the hazard? The
                       cohort named on screen, the group curves kept in
                       view (Play still has something to sweep), and the
                       forest built BY THE READER with three pills —
                       disease → + age → + SNPs — the lm-adjustment move
                       two lessons back, rows easing in, the disease HR's
                       shift annotated. The SNPs stop coming out of
                       nowhere because the reader adds them.

   One motion throughout: a time cursor sweeps right and curves build under
   it. The `censored` control is display: true — three readings of ONE
   dataset, so toggling never resets the sweep. `anim.done` is re-read
   against the new tab's end in `rebuild`, so a curve finished on Censoring
   keeps building on Comparing groups.

   THE DATA: the five patients are the notebook's own; the 200 keep the
   notebook's event process but NOT its censoring — cell 11 draws Status
   independently of time, and under that design discarding the censored is
   UNBIASED while KM lies high (+0.13): the opposite lesson. model.js's
   simulate() censors by study end instead (min(T, C), doors close at 20);
   the ruling and its measurements are docs/catalogue.md § Widget 31.
   R's seeded draw does not reproduce in JS, so nothing here claims R's
   numbers: the deterministic cells are verified to the digit, the
   simulated arm across this widget's own seeds (log-rank p < 1e-4 on
   100/100). Seed 3 is the default — the lowest seed where the full Cox fit
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
/* the lesson's two causes of censoring, named on the lanes — an unlabelled
   open circle reads as "survived", which is the misconception itself */
const CENSOR_WHY = { 1: "study ended", 4: "dropped out" };

const T1MAX = 11;
const T2MAX = 22;

const SPEEDS = {
  slow: { label: "Slow", rate: 1.2, detail: "about a year per second" },
  medium: { label: "Medium", rate: 3.5, detail: "the curve builds in a few seconds" },
  fast: { label: "Fast", rate: 9, detail: "straight to the finished curve" },
};

/* --- stage geometry, one place -------------------------------------------- */
/* Censoring tab: lanes / curve / hazard strip. 26px lanes leave room for the
   censoring reason under a lane's end mark. */
const LANE_GAP = 26;
const LANES_Y = 30;
const LANES_H = LANE_GAP * 4 + 14;
const CURVE1_Y = LANES_Y + LANES_H + 40;
const CURVE1_H = 180;
/* 78, not 64: the strip's header is TWO lines — the title, then the
   direction line (wrong treatments) beside the formula chip (round 4) */
const HAZ_Y = CURVE1_Y + CURVE1_H + 78;
const HAZ_H = 80;
const PAT_HEIGHT = HAZ_Y + HAZ_H + 48;

/* Comparing groups tab: the curves, then the hazard-ratio section (pick H4) */
const KM2_Y = 30;
const KM2_H = 230;
const HR_TOP = KM2_Y + KM2_H + 56;
const HR_HEAD = 36;
const HR_H = 130;
const GRP_HEIGHT = HR_TOP + HR_HEAD + HR_H + 74;

/* Finding factors tab: the question, compact curves, then the forest card */
const FQ_Y = 22;
const FCURVE_Y = 40;
const FCURVE_H = 120;
const CARD_TOP = FCURVE_Y + FCURVE_H + 50;
const CARD_HEAD = 50;
/* Disease and Age rows are tall enough to carry the ghost-and-move
   annotation (lm-adjustment's F_ROW); SNP rows are plain and tight */
const ROW_BIG = 46;
const ROW_SNP = 20;
const forestTop = () => CARD_TOP + CARD_HEAD;
const FACT_HEIGHT = (snps) =>
  forestTop() + 2 * ROW_BIG + (snps ? 10 * ROW_SNP : ROW_SNP) + 34 + 40;

/* H4's bins: [10,16) only — [6,10) has zero baseline events on clean seeds
   and [16,20) ~0 person-time in the disease arm (measured; catalogue). */
const H4_BINS = [[10, 12], [12, 14], [14, 16]];

/* S(t) read off a km() step list. */
function readS(steps, t) {
  let S = 1;
  for (const s of steps) {
    if (s.t <= t) S = s.S;
    else break;
  }
  return S;
}

/* events per person-time in [lo, hi) — the rate the hazard-ratio bars carry */
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

/* which distinct-time list and sweep end a tab uses */
const timeKey = (concept) => (concept === "censoring" ? "censoring" : "groups");

/* the model key the pills spell, in the fixed order d, a, s */
const keyOf = (p) => (p.disease ? "d" : "") + (p.age ? "a" : "") + (p.snps ? "s" : "");

/* The forest's row identities and display names, in display order — ABOVE
   defineWidget on purpose: core calls draw() during the defineWidget call
   itself, so a const declared below it is still in its temporal dead zone
   on a page that loads straight onto the Finding-factors tab (the
   lm-adjustment incident, reproduced here before this comment existed). */
const ROW_KEYS = ["disease", "age", ...Array.from({ length: 10 }, (_, j) => `snp${j + 1}`)];
const ROW_NAMES = {
  disease: "Disease",
  age: "Age",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, j) => [`snp${j + 1}`, `SNP_${j + 1}`])),
};

const EASE_MS = 450;

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
  height: ({ concept, snps }) => (concept === "censoring" ? PAT_HEIGHT
    : concept === "groups" ? GRP_HEIGHT : FACT_HEIGHT(snps)),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "censoring", label: "Censoring", detail: "how time-to-event data is recorded — five patients, one curve" },
        { value: "groups", label: "Comparing groups", detail: "are the groups different? two Kaplan–Meier curves and the log-rank test" },
        { value: "factors", label: "Finding factors", detail: "which factors are associated with the hazard? Cox regression, built a covariate at a time" },
      ],
      default: "censoring",
      display: true,
    },

    reading: {
      type: "section",
      label: "Reading the data",
      when: { param: "concept", equals: "censoring" },
    },
    /* The misconception as a control. Three readings of the SAME dataset,
       so display: true — toggling compares, and must never reset the sweep. */
    censored: {
      type: "segmented",
      /* "(B and E)" ties the control to the two lanes it acts on — the
         abstraction gets names, and "Kept" inherits its meaning from the
         stage (round 4, P1) */
      label: "Censored patients (B and E)",
      options: [
        { value: "kept", label: "Kept", detail: "in the risk set until they leave — the Kaplan–Meier estimate" },
        { value: "dropped", label: "Dropped", detail: "removed from the data entirely" },
        { value: "asevents", label: "As events", detail: "their last-seen time counted as the event" },
      ],
      default: "kept",
      display: true,
      when: { param: "concept", equals: "censoring" },
    },

    curves: {
      type: "section",
      label: "The curves",
      when: { param: "concept", equals: "groups" },
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

    /* THE MODEL — three pills, lm-adjustment's move: the reader builds the
       Cox model a covariate at a time, and the SNPs arrive because the
       reader adds them. All display: every fit is computed regardless, and
       a pill click must never reset the sweep. */
    model: {
      type: "section",
      label: "The model",
      when: { param: "concept", equals: "factors" },
    },
    disease: {
      type: "bool",
      style: "pill",
      label: "disease",
      default: false,
      display: true,
      when: { param: "concept", equals: "factors" },
    },
    age: {
      type: "bool",
      style: "pill",
      label: "age",
      default: false,
      display: true,
      when: { param: "concept", equals: "factors" },
    },
    snps: {
      type: "bool",
      style: "pill",
      label: "SNPs",
      default: false,
      display: true,
      when: { param: "concept", equals: "factors" },
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
       figure on any tab */
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
        kept: km(t, s),
        truth: km(tt, tt.map(() => 1)),
        rates: H4_BINS.map(([lo, hi]) => binRate(t, s, lo, hi)),
        n: t.length,
      };
    };
    const groups = [per(0), per(1)];
    const lr = logrank(sim.time, sim.status, sim.disease);

    /* Every pill combination is fit here, once per data change, so a pill
       click (display) costs nothing and an ease always has its target. */
    const COLS = {
      disease: [sim.disease, "disease"],
      age: [sim.age, "age"],
    };
    for (let j = 0; j < 10; j += 1) {
      COLS[`snp${j + 1}`] = [sim.snps.map((row) => row[j]), `SNP_${j + 1}`];
    }
    const MEMBERS = {
      d: ["disease"],
      a: ["age"],
      s: ROW_KEYS.slice(2),
      da: ["disease", "age"],
      ds: ["disease", ...ROW_KEYS.slice(2)],
      as: ["age", ...ROW_KEYS.slice(2)],
      das: ["disease", "age", ...ROW_KEYS.slice(2)],
    };
    const fits = {};
    for (const [key, members] of Object.entries(MEMBERS)) {
      const X = sim.time.map((_, i) => members.map((m) => COLS[m][0][i]));
      const f = coxph(sim.time, sim.status, X);
      const byName = {};
      members.forEach((m, k) => {
        byName[m] = {
          hr: f.hr[k],
          lo: Math.exp(f.beta[k] - 1.959964 * f.se[k]),
          hi: Math.exp(f.beta[k] + 1.959964 * f.se[k]),
          p: f.p[k],
        };
      });
      fits[key] = { converged: f.converged, byName, members };
    }

    const stepTimes = {
      censoring: [...new Set(T5)].sort((a, b) => a - b),
      groups: [...new Set(sim.time)].sort((a, b) => a - b),
    };
    const tEnd = {
      censoring: stepTimes.censoring[stepTimes.censoring.length - 1],
      groups: stepTimes.groups[stepTimes.groups.length - 1],
    };
    return {
      five,
      groups,
      lr,
      fits,
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
      const anim = { t, done: t >= state.tEnd[timeKey(params.concept)], rows: {} };
      for (const k of ROW_KEYS) anim.rows[k] = { v: 0, lo: 0, hi: 0, a: 0 };
      retargetForest(anim, params, state);
      for (const k of ROW_KEYS) anim.rows[k] = { ...anim.rowsT[k] };
      return anim;
    },
    advance: (anim, { dt, params, state }) => {
      /* the forest's ease, chased on every mode so a pill click mid-sweep
         still lands; `easing` cleared once everything arrives */
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      for (const k of ROW_KEYS) {
        const m = anim.rows[k];
        const g = anim.rowsT[k];
        /* a row entering from nothing appears AT its value rather than
           sliding in from log(1) = 0 */
        if (m.a < 0.02 && g.a > 0) {
          m.v = g.v;
          m.lo = g.lo;
          m.hi = g.hi;
        }
        for (const f of ["v", "lo", "hi", "a"]) {
          const gap = g[f] - m[f];
          if (Math.abs(gap) < 0.002) m[f] = g[f];
          else {
            m[f] += gap * rate;
            moving = true;
          }
        }
      }
      if (!moving) anim.easing = false;
      if (anim.mode === "ease") return moving;

      const tEnd = state.tEnd[timeKey(params.concept)];
      if (anim.mode === "step") {
        const next = state.stepTimes[timeKey(params.concept)].find((t) => t > anim.t + 1e-9);
        anim.t = next !== undefined ? next : tEnd;
        anim.done = anim.t >= tEnd;
        return false;
      }
      anim.t = Math.min(tEnd, anim.t + (SPEEDS[params.speed].rate * dt) / 1000);
      if (anim.t >= tEnd) {
        anim.done = true;
        return moving;
      }
      return true;
    },
    /* Display changes keep the sweep where it is; `done` is re-read against
       the NEW tab's end, so a curve finished on Censoring keeps building on
       Comparing groups; and a pill click retargets the forest's ease. */
    rebuild: (anim, { params, state }) => {
      anim.done = anim.t >= state.tEnd[timeKey(params.concept)];
      retargetForest(anim, params, state);
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "censoring") drawCensoring(ctx, colors, w, params, state, t);
    else if (params.concept === "groups") drawGroups(ctx, colors, w, params, state, t);
    else drawFactors(ctx, colors, w, params, state, t, anim);
  },

  readout({ params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "censoring") {
      const treatment = params.censored;
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
    if (params.concept === "groups") {
      return [
        { label: "Events", value: `${state.events} of 200`, note: "the rest are censored — the study ends before their event" },
        {
          label: "Log-rank p",
          value: state.lr.p < 1e-4 ? "< 0.0001" : fmt(state.lr.p, 4),
          note: "the two curves compared over every event time, censored kept in",
        },
        {
          label: "Hazard ratio",
          value: fmt(state.fits.d.byName.disease.hr, 2),
          note: "the disease group's event rate multiplied — the same factor at every time",
        },
      ];
    }
    const key = keyOf(params);
    const kIn = (params.disease ? 1 : 0) + (params.age ? 1 : 0) + (params.snps ? 10 : 0);
    const tiles = [
      { label: "Covariates", value: `${kIn} of 12`, note: "disease, age, and the ten SNPs available to the model" },
    ];
    if (params.disease) {
      tiles.push({
        label: "HR (disease)",
        value: fmt(state.fits[key].byName.disease.hr, 2),
        note: kIn > 1 ? "with the other covariates held constant" : "the two-group comparison alone",
      });
    }
    if (kIn > 0) {
      const nSig = state.fits[key].members
        .filter((m) => state.fits[key].byName[m].p < 0.05).length;
      tiles.push({
        label: "Significant",
        value: String(nSig),
        note: "covariates in this model with p below 0.05",
      });
    }
    return tiles;
  },

  summary({ params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "censoring") {
      const S = readS(state.five[params.censored].steps, t);
      return `Five patients followed over time: three events, two censored (one dropped out, one reached the end of the study). A Kaplan–Meier curve built to time ${fmt(t, 1)}, survival ${fmt(S, 2)}, with a hazard bar at each event time showing the share of those at risk who had the event.`;
    }
    if (params.concept === "groups") {
      return `Kaplan–Meier curves for 200 simulated patients by disease group, ${state.events} events, log-rank p ${state.lr.p < 1e-4 ? "below 0.0001" : fmt(state.lr.p, 4)}, and the hazard ratio ${fmt(state.fits.d.byName.disease.hr, 2)} shown as one factor scaling the event rate in every interval.`;
    }
    const key = keyOf(params);
    if (!key) {
      return "Two hundred simulated patients with age, disease group and ten SNP genotypes; a Cox model with no covariates chosen yet.";
    }
    const names = state.fits[key].members.map((m) => (m.startsWith("snp") ? null : m)).filter(Boolean);
    const label = [
      names.includes("disease") ? "disease" : null,
      names.includes("age") ? "age" : null,
      params.snps ? "the ten SNPs" : null,
    ].filter(Boolean).join(" and ");
    return `A Cox model of the 200 simulated patients on ${label}, drawn as a forest of hazard ratios with the reference line at 1.`;
  },
});

/* --- the forest's ease targets, from the pills ---------------------------- */
function retargetForest(anim, params, state) {
  const key = keyOf(params);
  const fit = key ? state.fits[key] : null;
  anim.rowsT = {};
  for (const k of ROW_KEYS) {
    const c = fit?.byName[k];
    anim.rowsT[k] = c
      ? { v: Math.log(c.hr), lo: Math.log(c.lo), hi: Math.log(c.hi), a: 1 }
      : { ...(anim.rows?.[k] ?? { v: 0, lo: 0, hi: 0 }), a: 0 };
    const m = anim.rows?.[k];
    if (m && ["v", "lo", "hi", "a"].some((f) => Math.abs(m[f] - anim.rowsT[k][f]) > 0.002)) {
      anim.easing = true;
    }
  }
}

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

/* --- tab 1: Censoring ------------------------------------------------------ */
function drawCensoring(ctx, colors, w, params, state, t) {
  const left = 56;
  const right = w - 14;
  const X = (v) => left + (v / T1MAX) * (right - left);
  const treatment = params.censored;

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
    /* name the censoring, on the lane — the open circle alone reads as
       "survived", which is the misconception this widget exists to break */
    if (CENSOR_WHY[i]) {
      ctx.fillStyle = colors.unknown;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText(CENSOR_WHY[i], X(T5[i]), y + 13);
      ctx.font = `${colors.fsSm} ${colors.font}`;
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* the curve */
  const rect = { x: left, y: CURVE1_Y, w: right - left, h: CURVE1_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T1MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 2.5, 5, 7.5, 10] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });
  /* every treatment names its MECHANISM — what happens to B and E in the
     numerator and the denominator — never a verdict (2.9) */
  if (treatment === "dropped") plot.note("B and E leave both the event count and the risk set — as if never enrolled");
  else if (treatment === "asevents") plot.note("B and E enter the event count at their last visit");
  else plot.note("B and E stay in the risk set until they leave, and never enter the events");

  const R = state.five;
  if (treatment !== "kept") {
    drawCurve(ctx, plot, R.kept.steps, R.kept.censors, t, colors.empirical, { alpha: 0.4, surface: colors.surface });
    drawCurve(ctx, plot, R[treatment].steps, R[treatment].censors, t, colors.highlight, { width: 2.5, ticks: false });
  } else {
    drawCurve(ctx, plot, R.kept.steps, R.kept.censors, t, colors.empirical, { width: 2.5, surface: colors.surface });
  }

  /* The hazard strip — pick H1: of those still at risk, the share who go
     now. No bar at a censoring; the censor tick on the strip's axis marks
     where the DENOMINATOR changed. THE STRIP FOLLOWS THE CHOSEN TREATMENT
     (round 3): the treatments are operations on the numerator and the
     denominator, so the hazard is exactly where they differ — dropping the
     censored inflates every bar (1/3 for 1/5, and the last patient always
     "dies" at 1/1), and counting them as events grows bars at 7 and 10
     that never happened. The kept bars stay behind as ghosts. */
  const hy = (v) => HAZ_Y + HAZ_H - v * HAZ_H;
  const bars = R[treatment].steps;
  const ghostBars = treatment === "kept" ? null : R.kept.steps;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("Hazard at each event — of those still at risk, the share who go now", left, HAZ_Y - 24);
  /* the formula chip (round 4, F1): the words above, the letter here —
     the same h the product line multiplies */
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.fillText("h = events ÷ at risk", right, HAZ_Y - 10);
  /* the direction line (F3) — a comparison against the visible kept bars,
     never a claim about the unknowable truth (2.11) */
  if (treatment !== "kept") {
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText(
      treatment === "dropped"
        ? "smaller risk sets: bars higher than kept, survival lower"
        : "extra events: bars higher than kept, survival lower",
      left,
      HAZ_Y - 10,
    );
  }
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
  if (ghostBars) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = colors.event;
    for (const s of ghostBars) {
      if (s.events === 0 || s.t > t) continue;
      ctx.fillRect(X(s.t) - 9, hy(s.events / s.atRisk), 8, hy(0) - hy(s.events / s.atRisk));
    }
    ctx.globalAlpha = 1;
  }
  for (const s of bars) {
    if (s.events === 0 || s.t > t) continue;
    const hVal = s.events / s.atRisk;
    const bx = ghostBars ? X(s.t) + 1 : X(s.t) - 7;
    const bw = ghostBars ? 8 : 14;
    ctx.fillStyle = ghostBars ? colors.highlight : colors.event;
    ctx.fillRect(bx, hy(hVal), bw, hy(0) - hy(hVal));
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "center";
    /* a 1/1 bar reaches the strip's top rail — its label goes inside */
    const inside = hy(hVal) - 5 < HAZ_Y + 8;
    if (inside) ctx.fillStyle = colors.surface;
    ctx.fillText(`${s.events}/${s.atRisk}`, bx + bw / 2, inside ? hy(hVal) + 13 : hy(hVal) - 5);
  }
  for (const c of R[treatment].censors) {
    if (c.t > t) continue;
    ctx.strokeStyle = colors.unknown;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(c.t), hy(0) - 5);
    ctx.lineTo(X(c.t), hy(0) + 5);
    ctx.stroke();
  }
  /* the product line (round 3): the bars ARE the curve's factors, and the
     identity is printed as the sweep collects them — it always equals the
     Survival tile, because it is the same arithmetic */
  const passed = bars.filter((s) => s.events > 0 && s.t <= t);
  if (passed.length) {
    const terms = passed.map((s) => `(1−${s.events}/${s.atRisk})`).join("");
    const S = passed.reduce((acc, s) => acc * (1 - s.events / s.atRisk), 1);
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText(`survival = product of (1 − h): ${terms} = ${fmt(S, 2)}`, left, hy(0) + 24);
  }
  ctx.restore();

  drawCursor(ctx, colors, X(Math.min(t, T1MAX)), LANES_Y - 12, hy(0), t, state.tEnd.censoring);
}

/* --- shared: the two group curves, clipped to the cursor ------------------- */
function drawGroupCurves(ctx, colors, plot, state, t, { bands = false, truth = false, labels = true, ticks = true } = {}) {
  const groupColor = [colors.groupA, colors.groupB];
  state.groups.forEach((g, i) => {
    if (bands) drawBand(ctx, plot, g.kept.steps, t, groupColor[i]);
    drawCurve(ctx, plot, g.kept.steps, g.kept.censors, t, groupColor[i], { width: 2.5, ticks, surface: colors.surface });
    if (truth) {
      drawCurve(ctx, plot, g.truth.steps, [], t, colors.reference, { dash: [5, 4], width: 1.5, ticks: false });
    }
  });
  if (!labels) return;
  /* labels pinned where each curve crosses S ≈ 0.6, drawn once the sweep
     has reached that point — labels that followed the curves' ends stacked
     in the corner when both finished near zero. The disease curve is the
     left one, so its label sits left of its crossing. */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "alphabetic";
  state.groups.forEach((g, i) => {
    const cross = g.kept.steps.find((s) => s.S <= 0.6);
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
}

/* --- tab 2: Comparing groups ----------------------------------------------- */
function drawGroups(ctx, colors, w, params, state, t) {
  const left = 56;
  const right = w - 14;
  const rect = { x: left, y: KM2_Y, w: right - left, h: KM2_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T2MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 5, 10, 15, 20] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });
  plot.caption("200 simulated patients, followed for up to 20 years");
  drawGroupCurves(ctx, colors, plot, state, t, { bands: params.bands, truth: params.truth });
  drawCursor(ctx, colors, plot.sx(Math.min(t, T2MAX)), KM2_Y - 12, plot.sy(0), t, state.tEnd.groups);

  /* pick H4, moved here from the Cox card: the hazard ratio INTRODUCED as
     what it claims — one number scaling the event rate in every interval.
     The HR is the disease-only model's, the same comparison the two curves
     make; beside the 12-covariate forest its marginal number contradicted
     the adjusted row on the same card. */
  const HR = state.fits.d.byName.disease.hr;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("The hazard ratio", left, HR_TOP);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText("event rates per year at risk, by interval — the dashed claim is the no-disease rate", left, HR_TOP + 16);
  ctx.fillText(`× ${fmt(HR, 2)}: one number, at every time. Cox regression estimates this number.`, left, HR_TOP + 30);

  const rates0 = state.groups[0].rates;
  const rates1 = state.groups[1].rates;
  const rMax = Math.max(...rates1, ...rates0.map((r) => r * HR)) * 1.2;
  const bTop = HR_TOP + HR_HEAD + 14;
  const bx = (v) => left + 30 + ((v - 10) / 6) * (right - left - 30);
  const by = (r) => bTop + HR_H - (r / rMax) * HR_H;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx(10), by(0));
  ctx.lineTo(bx(16), by(0));
  ctx.stroke();
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  for (const v of [10, 12, 14, 16]) ctx.fillText(String(v), bx(v), by(0) + 14);
  ctx.fillText("time (years)", (bx(10) + bx(16)) / 2, by(0) + 28);
  H4_BINS.forEach(([lo, hi], k) => {
    const bw = Math.min(44, (bx(hi) - bx(lo)) / 2 - 10);
    const x0 = (bx(lo) + bx(hi)) / 2 - bw - 4;
    const x1 = (bx(lo) + bx(hi)) / 2 + 4;
    ctx.fillStyle = colors.groupA;
    ctx.fillRect(x0, by(rates0[k]), bw, by(0) - by(rates0[k]));
    ctx.fillStyle = colors.groupB;
    ctx.fillRect(x1, by(rates1[k]), bw, by(0) - by(rates1[k]));
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x1, by(rates0[k] * HR), bw, by(0) - by(rates0[k] * HR));
    ctx.setLineDash([]);
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "center";
    ctx.fillText(`×${fmt(rates1[k] / rates0[k], 1)}`, x1 + bw / 2, by(Math.max(rates1[k], rates0[k] * HR)) - 6);
  });
  ctx.restore();
}

/* --- tab 3: Finding factors ------------------------------------------------ */
function drawFactors(ctx, colors, w, params, state, t, anim) {
  const left = 56;
  const right = w - 14;

  /* the cohort, named — the SNPs must not come out of nowhere */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillText("Each patient carries an age, a disease group, and ten SNP genotypes.", left, FQ_Y);
  ctx.restore();

  /* the curves being modelled stay in view, compact */
  const rect = { x: left, y: FCURVE_Y, w: right - left, h: FCURVE_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T2MAX], yDomain: [0, 1] });
  plot.axisX({ ticks: [0, 5, 10, 15, 20] });
  plot.axisY({ ticks: [0, 0.5, 1] });
  drawGroupCurves(ctx, colors, plot, state, t, { labels: false, ticks: false });
  drawCursor(ctx, colors, plot.sx(Math.min(t, T2MAX)), FCURVE_Y - 10, plot.sy(0), t, state.tEnd.groups);

  /* the card */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Cox proportional hazards", 14, CARD_TOP);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink3;
  ctx.fillText("h(t) = h₀(t) × exp(b₁x₁ + … )", 14, CARD_TOP + 16);
  ctx.fillText("each exp(b) multiplies the hazard by a constant factor, at every time", 14, CARD_TOP + 30);
  ctx.restore();

  drawForest(ctx, colors, { x: 78, y: forestTop(), w: right - 78 - 6 }, params, state, anim);
}

/* --- the forest, built a pill at a time ------------------------------------ */
function drawForest(ctx, colors, rp, params, state, anim) {
  const DOM = [0.4, 10];
  const fx = (hr) => rp.x
    + ((Math.log(Math.min(Math.max(hr, DOM[0]), DOM[1])) - Math.log(DOM[0]))
      / (Math.log(DOM[1]) - Math.log(DOM[0]))) * rp.w;
  const fxLog = (v) => fx(Math.exp(v));
  const snpsIn = Boolean(params.snps);
  const H = 2 * ROW_BIG + (snpsIn ? 10 * ROW_SNP : ROW_SNP);

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  for (const v of [0.5, 1, 2, 4, 8]) {
    ctx.beginPath();
    ctx.moveTo(fx(v), rp.y);
    ctx.lineTo(fx(v), rp.y + H);
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
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

  const key = keyOf(params);
  if (!key) {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "center";
    ctx.fillText("choose covariates to fit the model", rp.x + rp.w / 2, rp.y + H / 2);
    ctx.restore();
    return;
  }
  const fit = state.fits[key];

  /* row slots: Disease and Age tall (they carry the ghost-and-move
     annotation), the SNPs tight — or one quiet line when they are out */
  const rowY = { disease: rp.y + ROW_BIG * 0.62, age: rp.y + ROW_BIG * 1.62 };
  const drawRow = (k, y, withValue) => {
    const name = ROW_NAMES[k];
    const c = fit.byName[k];
    const m = anim?.rows?.[k];
    ctx.font = `${colors.fsXs} ${colors.font}`;
    if (!c) {
      ctx.fillStyle = colors.ink3;
      ctx.textAlign = "right";
      ctx.fillText(name, rp.x - 6, y + 3);
      ctx.textAlign = "left";
      ctx.fillText("not in the model", fx(0.55), y + 3);
      return;
    }
    const sig = c.p < 0.05;
    ctx.fillStyle = sig ? colors.ink1 : colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText(name, rp.x - 6, y + 3);

    /* the ghost: this covariate's HR fitted ALONE, with the move annotated —
       the coefficient is a property of the model it sits in (lm-adjustment's
       lesson, returning). Drawn only when other covariates are in. */
    const aloneKey = k === "disease" ? "d" : k === "age" ? "a" : null;
    if (aloneKey && fit.members.length > 1) {
      const g = state.fits[aloneKey].byName[k];
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = colors.empirical;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx(g.lo), y);
      ctx.lineTo(fx(g.hi), y);
      ctx.stroke();
      ctx.fillStyle = colors.empirical;
      ctx.beginPath();
      ctx.arc(fx(g.hr), y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.abs(Math.log(c.hr / g.hr)) > 0.03) {
        ctx.strokeStyle = colors.ink2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx(g.hr), y - 13);
        ctx.lineTo(fx(c.hr), y - 13);
        ctx.stroke();
        const dir = c.hr > g.hr ? 1 : -1;
        ctx.fillStyle = colors.ink2;
        ctx.beginPath();
        ctx.moveTo(fx(c.hr), y - 13);
        ctx.lineTo(fx(c.hr) - dir * 6, y - 16.5);
        ctx.lineTo(fx(c.hr) - dir * 6, y - 9.5);
        ctx.fill();
        ctx.fillStyle = colors.ink1;
        ctx.textAlign = "left";
        ctx.fillText(
          `${fmt(g.hr, 2)} → ${fmt(c.hr, 2)} with the others held constant`,
          rp.x + 4,
          y - 20,
        );
      }
    }

    /* the eased mark — position from the LERPED values, so no mark is
       false mid-frame */
    if (m && m.a > 0.02) {
      ctx.globalAlpha = m.a;
      ctx.strokeStyle = sig ? colors.highlight : colors.ink3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fxLog(m.lo), y);
      ctx.lineTo(fxLog(m.hi), y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fxLog(m.v), y, 4, 0, 2 * Math.PI);
      if (sig) {
        ctx.fillStyle = colors.highlight;
        ctx.fill();
      } else {
        ctx.fillStyle = colors.surface;
        ctx.fill();
        ctx.stroke();
      }
      if (withValue) {
        ctx.fillStyle = colors.ink2;
        ctx.textAlign = "center";
        ctx.fillText(fmt(Math.exp(m.v), 2), fxLog(m.v), y + 17);
      }
      ctx.globalAlpha = 1;
    }
  };

  drawRow("disease", rowY.disease, true);
  drawRow("age", rowY.age, true);
  const snpTop = rp.y + 2 * ROW_BIG;
  if (!snpsIn) {
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.fillStyle = colors.ink3;
    /* "SNPs", not "SNP_1 … SNP_10" — the long form overran the label column
       at the 550px canvas (left edge −9) */
    ctx.textAlign = "right";
    ctx.fillText("SNPs", rp.x - 6, snpTop + ROW_SNP * 0.5 + 3);
    ctx.textAlign = "left";
    ctx.fillText("the ten SNPs — not in the model", fx(0.55), snpTop + ROW_SNP * 0.5 + 3);
  } else {
    for (let j = 0; j < 10; j += 1) {
      drawRow(`snp${j + 1}`, snpTop + ROW_SNP * (j + 0.5), false);
    }
  }
  ctx.restore();
}
