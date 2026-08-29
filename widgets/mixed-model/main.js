/* ============================================================================
   Widget 32 · Modeling Hierarchical Data — 500 rows are not 500 observations.

   PHM5003 05-07. The misconception (Hurlbert 1984, the catalogue's slot 6):
   rows are observations. The notebook's own story, regenerated exactly and
   verified to the printed digit (`_lab/mixed-measure.mjs`, 89 checks — the
   REML engine matches lme4's criterion to ~1e-10 on both examples): the
   medication does NOTHING, yet lm on 500 rows reports −3.4 [−5.3, −1.5];
   lmer with the patient as a random effect reads −3.6 [−7.5, 0.2].

   Two tabs, Kenneth's picks 2026-08-29 (all four options taken as
   recommended from `_lab/mixed-stage.html`):

     Visits    the longitudinal BP study. The stage opens as lm sees it —
               a cloud of rows in two arms — and the reveal is the reader
               joining each patient's visits (an eased display flip, not a
               Step): the cloud becomes trajectories, and the honest
               interval widens in beside the narrow one. Behind a gate,
               the study repeats: 100 fresh no-effect studies, counting
               what each model claims (measured: lm 38%, lmer 8% at the
               notebook design).
     Families  the SNP panel. Ten effects as a paired forest, lm beside
               lmer; the causal SNPs are chips (widget 31's move — the
               reader sets the truth, then sees which fit recovers it);
               the family-differences dial takes the confounding from
               zero (the fits agree) to the notebook's strength (lm
               sprouts false SNPs, lmer keeps the truth).

   Design measurements behind every dial are in `_lab/mixed-design.mjs`:
   visits 1→20 takes lm's false-positive rate 5%→57% while lmer holds 4–9%;
   500×1 / 100×5 / 25×20 all print n = 500 while the honest interval reads
   2.0 / 4.1 / 8.4; at family SD 5 the flat fit averages 2.5 false SNPs of 9
   AND misses the real one 22% of the time (lmer: 0.64, never).

   Draw 7 is the measured default: lm rejects and lmer spans zero on the
   Visits tab, and on Families lm flags 1, 2, 5, 9 while lmer keeps exactly
   the causal SNP 5.
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import {
  simulateBP, simulateSNP, designBP, designSNP, fitLM, fitLMM, BP_MED_COL,
} from "./model.js";

/* the two ladders, measured in _lab/mixed-design.mjs (§3, §4): the SD ladder
   is where the two fits pull apart (agree at none, diverge monotonically);
   the effect ladder spans "lmer sees nothing" to "lmer sees it almost
   always" (17% → 96%) */
const DIFFER = { none: 0, small: 2.5, moderate: 5, large: 10 };
const EFFECTS = { none: 0, small: -2, moderate: -4, large: -8 };
/* family ladder (§5): at none both fits are clean; at large — the
   notebook's SD 5 — lm averages 2.5 false SNPs of 9 and misses the causal
   one 22% of the time while lmer stays at 0.64 and never misses */
const FAMDIFF = { none: 0, small: 1, moderate: 2.5, large: 5 };

const N_STUDIES = 100;
const STUDY_MS = 55; // Play reveals ~18 studies a second, the whole tally in ~6 s
const EASE_MS = 450;

/* independent stream per surface, so opening the gate or flipping the tab
   can never shift the data on the other one — three sims off one Draw
   would otherwise share a stream and reorder each other's draws */
/* 900 is measured, not arbitrary: at Draw 7 it gives the canonical story
   (lm flags 2, 5 and 6; lmer keeps exactly 5) and lmer is exact on 8 of the
   10 neighbouring draws — and it is far above Draw's 1..50, so the streams
   cannot collide */
const FAM_SEED_OFFSET = 900;
const TALLY_SEED_OFFSET = 5000;

/* --- stage geometry -------------------------------------------------------- */
const SC_TOP = 22;
const SC_H = 238;
const INT_GAP = 46;
const INT_H = 116;
const TALLY_GAP = 20;
const TALLY_H = 150;
const V_BOT = 16;
const visitsHeight = (studies) =>
  SC_TOP + SC_H + INT_GAP + INT_H + (studies ? TALLY_GAP + TALLY_H : 0) + V_BOT;

const F_TOP = 18;
const F_ROW = 27;
const F_AXIS = 44;
const famHeight = () => F_TOP + 10 * F_ROW + F_AXIS + 14;
/* the forest's frame — ABOVE defineWidget on purpose: core calls draw()
   during the defineWidget call itself, so a const declared below it is
   still in its temporal dead zone on a page that opens straight onto the
   Families tab (the lm-adjustment incident, reproduced here before this
   comment existed) */
const F_LO = -1.8;
const F_HI = 2.6;

const LPAD = 46; // scatter's y-axis gutter
const IPAD = 168; // interval and tally rows: room for the model labels

/* the interval frame is a function of the DIALS, never of the fits — a frame
   conditioned on live estimates drifts under the reader (the coefficient-
   plane incident). Between-patient variance of a patient's mean:
   sd_b² + slope-spread + noise/m, and the two-arm difference divides by
   n/4. 4.6 SEs plus margin holds every CI the dials can produce. */
function intervalHalf(params) {
  const m = Number(params.visits);
  const np = Number(params.patients);
  const sb = DIFFER[params.differ];
  const tbar = (m + 1) / 2;
  const vB = sb * sb + 0.25 * tbar * tbar + 25 / m;
  return Math.ceil(Math.abs(EFFECTS[params.effect]) + 4.6 * Math.sqrt((4 * vB) / np) + 1.5);
}

/* deterministic per-patient jitter, so a dot never moves between renders */
const jitterOf = (id) => (((id * 2654435761) % 97) / 97 - 0.5) * 0.55;

const claims = (fit, col) => fit.ci[col][1] < 0 || fit.ci[col][0] > 0;
const ciText = (est, lo, hi) => `${fmt(est, 1)} [${fmt(lo, 1)}, ${fmt(hi, 1)}]`;

defineWidget({
  slug: "mixed-model",
  title: "Modeling Hierarchical Data",
  status: "draft",
  subtitle:
    "We can measure the same patient many times, but repeated measurements " +
    "are not independent. A linear mixed model gives each patient a random " +
    "effect, so the evidence is counted in patients rather than rows.",
  layout: "side",
  height: ({ concept, studies }) =>
    concept === "families" ? famHeight() : visitsHeight(studies),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "visits", label: "Visits", detail: "one study, the same patients measured again and again" },
        { value: "families", label: "Families", detail: "which SNPs move cholesterol, when the individuals come in families" },
      ],
      default: "visits",
      display: true,
    },

    /* THE DATA — the Visits tab's study design. Every control is a data
       parameter: moving one draws a new study. */
    dataV: {
      type: "section",
      label: "The data",
      when: { param: "concept", equals: "visits" },
    },
    patients: {
      type: "choice",
      label: "Patients",
      options: [
        { value: "25", label: "25" },
        { value: "50", label: "50" },
        { value: "100", label: "100" },
        { value: "200", label: "200" },
      ],
      default: "100",
      when: { param: "concept", equals: "visits" },
    },
    visits: {
      type: "choice",
      label: "Visits each",
      detail: "more visits add rows, not patients",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "5", label: "5" },
        { value: "10", label: "10" },
        { value: "20", label: "20" },
      ],
      default: "5",
      when: { param: "concept", equals: "visits" },
    },
    differ: {
      type: "choice",
      label: "Patient differences",
      detail: "how far patients' own blood pressures sit apart",
      options: [
        { value: "none", label: "None", detail: "every patient shares one level — rows really are independent" },
        { value: "small", label: "Small" },
        { value: "moderate", label: "Moderate" },
        { value: "large", label: "Large", detail: "the notebook's setting — most variation is between patients" },
      ],
      default: "large",
      when: { param: "concept", equals: "visits" },
    },
    effect: {
      type: "choice",
      label: "Medication effect",
      detail: "the true effect — set here, never seen by the models",
      options: [
        { value: "none", label: "None", detail: "the medication does nothing — any claim is false" },
        { value: "small", label: "Small" },
        { value: "moderate", label: "Moderate" },
        { value: "large", label: "Large" },
      ],
      default: "none",
      when: { param: "concept", equals: "visits" },
    },

    reading: {
      type: "section",
      label: "Reading the data",
      when: { param: "concept", equals: "visits" },
    },
    /* THE REVEAL. Two readings of the SAME rows, so display: true — the ease
       between them is what shows it is the same data (the widget-12 rule),
       and the honest interval widens in as the patients join up. */
    view: {
      type: "segmented",
      label: "See the rows as",
      options: [
        { value: "rows", label: "Rows", detail: "every measurement its own point — what lm assumes" },
        { value: "patients", label: "Patients", detail: "each patient's visits joined — what the data actually is" },
      ],
      default: "rows",
      display: true,
      when: { param: "concept", equals: "visits" },
    },

    /* THE SECOND STAGE — one seed is an anecdote; the gate makes it a rate.
       display: true so closing it never destroys the reader's view state. */
    studies: {
      type: "gate",
      label: "Repeat the study",
      labelOff: "Back to one study",
      detail: "draw new studies from these same settings, counting what each model claims",
      default: false,
      display: true,
      when: { param: "concept", equals: "visits" },
    },

    /* THE DATA — the Families tab's. The causal chips are widget 31's move:
       the reader sets the ground truth, then sees which fit recovers it. */
    dataF: {
      type: "section",
      label: "The data",
      when: { param: "concept", equals: "families" },
    },
    famdiff: {
      type: "choice",
      label: "Family differences",
      detail: "how far families' cholesterol levels sit apart",
      options: [
        { value: "none", label: "None", detail: "families share nothing — the two fits agree" },
        { value: "small", label: "Small" },
        { value: "moderate", label: "Moderate" },
        { value: "large", label: "Large", detail: "the notebook's setting" },
      ],
      default: "large",
      when: { param: "concept", equals: "families" },
    },
    causal: {
      type: "int",
      style: "bits",
      bits: 10,
      label: "Causal SNPs",
      detail: "press to choose which SNPs truly raise cholesterol — they wear a dot in the forest",
      min: 0,
      max: 1023,
      default: 16,
      when: { param: "concept", equals: "families" },
    },

    seed: {
      type: "int",
      label: "Draw",
      detail: "another study from the same population",
      min: 1,
      max: 50,
      default: 7,
    },

    /* authoring hatch: how many repeated studies stand revealed on first
       render (with the gate open in the URL) */
    shown: { type: "int", min: 0, max: N_STUDIES, default: 0, hidden: true },
  },

  legend: [
    { token: "group-a", label: "Control group", mark: "dot" },
    { token: "group-b", label: "Medication group", mark: "dot" },
    { token: "highlight", label: "lm — every row treated as independent", mark: "line" },
    { token: "empirical", label: "lmer — patients as random effects", mark: "line" },
    { token: "reference", label: "The true effect, set by the dial", mark: "line" },
    { token: "extreme", label: "A repeated study that claimed an effect", mark: "dot" },
  ],

  compute({ params, rng }) {
    const m = Number(params.visits);
    const np = Number(params.patients);
    const seed = Number(params.seed);

    /* --- the Visits study --------------------------------------------------- */
    const sim = simulateBP(rng, {
      patients: np,
      perPatient: m,
      effect: EFFECTS[params.effect],
      sdPatient: DIFFER[params.differ],
    });
    const X = designBP(sim);
    const lm = fitLM(sim.bp, X);
    /* the notebook's own formula needs two rows per patient for a random
       slope; at one visit the random intercept is the honest model — and
       with independent rows it agrees with lm, which is the lesson's own
       corner case */
    const mm = m >= 2
      ? fitLMM(sim.bp, X, sim.patientId, sim.time)
      : fitLMM(sim.bp, X, sim.patientId, null);

    /* the tally, only while the gate is open: 100 fresh studies from the
       same settings on their own stream, each fit warm-started (fast mode
       reaches the same reject/keep decision as the full fit on every study
       of the drive script's tallies) */
    let tally = null;
    if (params.studies) {
      const rngT = makeRng(seed + TALLY_SEED_OFFSET);
      tally = [];
      let theta = null;
      for (let s = 0; s < N_STUDIES; s += 1) {
        const d = simulateBP(rngT, {
          patients: np,
          perPatient: m,
          effect: EFFECTS[params.effect],
          sdPatient: DIFFER[params.differ],
        });
        const Xs = designBP(d);
        const l = fitLM(d.bp, Xs);
        const r = m >= 2
          ? fitLMM(d.bp, Xs, d.patientId, d.time, { start: theta, fast: true })
          : fitLMM(d.bp, Xs, d.patientId, null, { start: theta, fast: true });
        theta = r.theta;
        tally.push({ lm: claims(l, BP_MED_COL), mm: claims(r, BP_MED_COL) });
      }
    }

    /* --- the Families study ------------------------------------------------- */
    const simF = simulateSNP(makeRng(seed + FAM_SEED_OFFSET), {
      sdFamily: FAMDIFF[params.famdiff],
      causal: Number(params.causal),
    });
    const XF = designSNP(simF);
    const lmF = fitLM(simF.chol, XF);
    const mmF = fitLMM(simF.chol, XF, simF.familyId, null);
    const snps = Array.from({ length: 10 }, (_, j) => ({
      j: j + 1,
      causal: (Number(params.causal) >> j) & 1,
      lm: { est: lmF.coef[j + 1], lo: lmF.ci[j + 1][0], hi: lmF.ci[j + 1][1], sig: claims(lmF, j + 1) },
      mm: { est: mmF.coef[j + 1], lo: mmF.ci[j + 1][0], hi: mmF.ci[j + 1][1], sig: claims(mmF, j + 1) },
    }));

    /* the scatter's frame, from the data of THIS draw — recomputed with the
       data, never per frame */
    let yLo = Infinity;
    let yHi = -Infinity;
    for (const v of sim.bp) {
      if (v < yLo) yLo = v;
      if (v > yHi) yHi = v;
    }
    yLo = Math.floor((yLo - 2) / 10) * 10;
    yHi = Math.ceil((yHi + 2) / 10) * 10;

    return {
      sim, lm, mm, tally, snps,
      famSD: mmF.sdInt,
      famResid: mmF.sigma,
      famICC: mmF.icc,
      yLo, yHi,
      nRows: np * m,
      trueEffect: EFFECTS[params.effect],
    };
  },

  animation: {
    stepLabel: "Another study",
    stepTitle: "Draw one more study from the same settings and fit both models",
    runLabel: "Play",
    runTitle: "Keep drawing studies",
    init: ({ params, state, fromScratch }) => {
      const N = state.tally ? state.tally.length : 0;
      const anim = {
        mix: params.view === "patients" ? 1 : 0,
        mixT: params.view === "patients" ? 1 : 0,
        k: !fromScratch ? Math.min(params.shown, N) : 0,
        acc: 0,
        inert: params.concept === "families",
        easing: false,
      };
      anim.done = !state.tally || anim.k >= N;
      return anim;
    },
    advance: (anim, { dt, state }) => {
      let moving = false;
      const gap = anim.mixT - anim.mix;
      if (Math.abs(gap) > 0.004) {
        anim.mix += gap * Math.min(1, (dt / EASE_MS) * 2.6);
        moving = true;
      } else {
        anim.mix = anim.mixT;
      }
      const N = state.tally ? state.tally.length : 0;
      if (state.tally && anim.k < N) {
        if (anim.mode === "step") {
          anim.k += 1;
        } else if (anim.mode === "run") {
          anim.acc += dt;
          while (anim.acc >= STUDY_MS && anim.k < N) {
            anim.k += 1;
            anim.acc -= STUDY_MS;
          }
          if (anim.k < N) moving = true;
        }
      }
      anim.done = !state.tally || anim.k >= N;
      if (!moving) anim.easing = false;
      return moving;
    },
    /* display changes: tab flip re-reads inert, a view flip requests the
       ease, the gate re-clamps the tally cursor */
    rebuild: (anim, { params, state }) => {
      anim.inert = params.concept === "families";
      const t = params.view === "patients" ? 1 : 0;
      if (t !== anim.mixT) {
        anim.mixT = t;
        anim.easing = true;
      }
      const N = state.tally ? state.tally.length : 0;
      anim.k = Math.min(anim.k, N);
      anim.done = !state.tally || anim.k >= N;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    if (params.concept === "families") drawFamilies(ctx, colors, w, params, state);
    else drawVisits(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.concept === "families") {
      const list = (key) => {
        const hit = state.snps.filter((s) => s[key].sig).map((s) => s.j);
        return hit.length ? `SNP ${hit.join(", ")}` : "none";
      };
      return [
        {
          label: "lm flags",
          value: list("lm"),
          note: "intervals excluding zero, with the families ignored",
        },
        {
          label: "lmer flags",
          value: list("mm"),
          note: "with the families as random effects — the dotted SNPs are the truth you set",
        },
        {
          label: "Family SD",
          value: fmt(state.famSD, 1),
          note: `between families, against ${fmt(state.famResid, 1)} within — ICC ${fmt(state.famICC, 2)}`,
        },
      ];
    }
    const mix = anim?.mix ?? 0;
    const lmCI = state.lm.ci[BP_MED_COL];
    const mmCI = state.mm.ci[BP_MED_COL];
    const lerp = (a, b) => a + (b - a) * mix;
    const tiles = [
      {
        label: "Rows",
        value: String(state.nRows),
        note: `${params.patients} patients × ${params.visits} visit${Number(params.visits) > 1 ? "s" : ""} — what lm counts as n`,
      },
      {
        label: "lm — medication",
        value: ciText(state.lm.coef[BP_MED_COL], lmCI[0], lmCI[1]),
        note: "every row treated as an independent observation",
      },
      {
        label: "lmer — medication",
        value: mix < 0.02
          ? "—"
          : ciText(
            lerp(state.lm.coef[BP_MED_COL], state.mm.coef[BP_MED_COL]),
            lerp(lmCI[0], mmCI[0]),
            lerp(lmCI[1], mmCI[1]),
          ),
        note: mix < 0.02
          ? "see the rows as patients to fit it"
          : Number(params.visits) === 1
            ? "one visit each — the rows really are independent, and the fits agree"
            : "patients as random effects — the evidence counted in patients",
      },
    ];
    if (state.tally) {
      const k = Math.min(anim?.k ?? 0, state.tally.length);
      const a = state.tally.slice(0, k).filter((s) => s.lm).length;
      const b = state.tally.slice(0, k).filter((s) => s.mm).length;
      tiles.push({
        label: "Claimed an effect",
        value: k === 0 ? "—" : `lm ${a} · lmer ${b} of ${k}`,
        note: k === 0
          ? "press Another study"
          : state.trueEffect === 0
            ? "the medication does nothing here — every claim is false"
            : `the true effect is ${state.trueEffect} — a claim here is a detection`,
      });
    }
    return tiles;
  },
});

/* --- the Visits stage ------------------------------------------------------ */

function drawVisits(ctx, colors, w, params, state, anim) {
  const mix = anim?.mix ?? 0;
  const m = Number(params.visits);
  const { sim, yLo, yHi } = state;
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const fontSm = `${colors.fsSm}px ${colors.font}`;

  /* faceted scatter: control | medication, the notebook's own figure */
  const gap = 18;
  const facetW = (w - LPAD - gap - 10) / 2;
  const Y = (v) => SC_TOP + ((yHi - v) / (yHi - yLo)) * SC_H;
  const XP = (arm, t, jit) =>
    LPAD + arm * (facetW + gap) + (((t - 1) + 0.5 + jit) / m) * facetW;

  ctx.font = fontXs;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("control", LPAD + facetW / 2, SC_TOP - 8);
  ctx.fillText("medication", LPAD + facetW + gap + facetW / 2, SC_TOP - 8);
  ctx.textAlign = "right";
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let v = yLo; v <= yHi; v += 20) {
    const y = Y(v);
    ctx.fillText(String(v), LPAD - 6, y + 3);
    ctx.beginPath();
    ctx.moveTo(LPAD, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
  }

  /* the joins, grown by the ease — each patient's visits in time order */
  if (m > 1 && mix > 0.004) {
    ctx.lineWidth = 1;
    for (let p0 = 0; p0 < sim.bp.length; p0 += m) {
      const arm = sim.med[p0];
      const jit = jitterOf(sim.patientId[p0]);
      ctx.strokeStyle = arm ? colors.groupB : colors.groupA;
      ctx.globalAlpha = 0.4 * mix;
      ctx.beginPath();
      const segs = mix * (m - 1);
      const whole = Math.floor(segs);
      for (let s = 0; s <= whole && s < m; s += 1) {
        const x = XP(arm, sim.time[p0 + s], jit);
        const y = Y(sim.bp[p0 + s]);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const fracSeg = segs - whole;
      if (whole < m - 1 && fracSeg > 0) {
        const xa = XP(arm, sim.time[p0 + whole], jit);
        const ya = Y(sim.bp[p0 + whole]);
        const xb = XP(arm, sim.time[p0 + whole + 1], jit);
        const yb = Y(sim.bp[p0 + whole + 1]);
        ctx.lineTo(xa + (xb - xa) * fracSeg, ya + (yb - ya) * fracSeg);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < sim.bp.length; i += 1) {
    const arm = sim.med[i];
    ctx.fillStyle = arm ? colors.groupB : colors.groupA;
    ctx.globalAlpha = 0.55 + 0.2 * mix;
    ctx.beginPath();
    ctx.arc(XP(arm, sim.time[i], jitterOf(sim.patientId[i])), Y(sim.bp[i]), 2, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* the interval pair — the standing readout */
  const iy = SC_TOP + SC_H + INT_GAP;
  drawIntervalPanel(ctx, colors, w, params, state, mix, iy);

  /* the tally, while the gate is open */
  if (state.tally) {
    drawTally(ctx, colors, w, state, anim, iy + INT_H + TALLY_GAP);
  }
}

function drawIntervalPanel(ctx, colors, w, params, state, mix, top) {
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const half = intervalHalf(params);
  const sc = (v) => IPAD + ((v + half) / (2 * half)) * (w - IPAD - 14);
  const lmCI = state.lm.ci[BP_MED_COL];
  const mmCI = state.mm.ci[BP_MED_COL];
  const lmEst = state.lm.coef[BP_MED_COL];
  const mmEst = state.mm.coef[BP_MED_COL];
  const lerp = (a, b) => a + (b - a) * mix;

  ctx.font = fontXs;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("The medication effect", IPAD, top - 8);

  /* zero, and the truth the dial set */
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sc(0), top - 2);
  ctx.lineTo(sc(0), top + INT_H - 34);
  ctx.stroke();
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("0", sc(0), top + INT_H - 22);
  const tv = state.trueEffect;
  ctx.strokeStyle = colors.reference;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(sc(tv), top - 2);
  ctx.lineTo(sc(tv), top + INT_H - 34);
  ctx.stroke();
  ctx.setLineDash([]);
  if (tv !== 0) {
    ctx.fillStyle = colors.reference;
    ctx.fillText("truth", sc(tv), top + INT_H - 22);
  }

  const row = (y, est, lo, hi, color, alpha, label, printed) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(label, IPAD - 10, y + 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sc(lo), y);
    ctx.lineTo(sc(hi), y);
    ctx.stroke();
    const sig = hi < 0 || lo > 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sc(est), y, 3.5, 0, 7);
    if (sig) ctx.fill();
    else {
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (printed) {
      ctx.fillStyle = colors.ink3;
      ctx.textAlign = "left";
      ctx.fillText(printed, IPAD, y + 16);
    }
    ctx.globalAlpha = 1;
  };

  const y1 = top + 16;
  const y2 = top + 54;
  row(y1, lmEst, lmCI[0], lmCI[1], colors.highlight, 1,
    "lm — rows independent", ciText(lmEst, lmCI[0], lmCI[1]));
  if (mix > 0.004) {
    const lo = lerp(lmCI[0], mmCI[0]);
    const hi = lerp(lmCI[1], mmCI[1]);
    const est = lerp(lmEst, mmEst);
    /* printed from the LERPED endpoints — the arc's rule: no label is
       false mid-frame, the number is the bar it sits under */
    row(y2, est, lo, hi, colors.empirical, Math.min(1, mix * 1.6),
      "lmer — patients modeled", ciText(est, lo, hi));
  } else {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText("lmer — patients modeled", IPAD - 10, y2 + 3);
    ctx.textAlign = "left";
    ctx.fillText("see the rows as patients to fit it", IPAD, y2 + 3);
  }
}

function drawTally(ctx, colors, w, state, anim, top) {
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const N = state.tally.length;
  const k = Math.min(anim?.k ?? 0, N);
  ctx.font = fontXs;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("The study, repeated from the same settings", IPAD, top + 2);

  const slotW = (w - IPAD - 14) / N;
  const row = (y, key, color, label) => {
    const hits = state.tally.slice(0, k).filter((s) => s[key]).length;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(label, IPAD - 10, y + 10);
    for (let i = 0; i < k; i += 1) {
      const x = IPAD + i * slotW;
      ctx.fillStyle = state.tally[i][key] ? colors.extreme : colors.grid;
      ctx.fillRect(x, y, Math.max(1.5, slotW - 1.2), 14);
    }
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(
      k === 0 ? "" : `claimed an effect in ${hits} of ${k}`,
      IPAD, y + 30,
    );
  };
  row(top + 16, "lm", colors.highlight, "lm");
  row(top + 66, "mm", colors.empirical, "lmer");

  if (k === 0) {
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "left";
    ctx.fillText("each press draws a fresh study and fits both models", IPAD, top + 26);
  }
}

/* --- the Families stage ---------------------------------------------------- */

function drawFamilies(ctx, colors, w, params, state) {
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const lpad = 74;
  const sc = (v) => lpad + ((Math.min(Math.max(v, F_LO), F_HI) - F_LO) / (F_HI - F_LO)) * (w - lpad - 14);
  const bottom = F_TOP + 10 * F_ROW;

  ctx.font = fontXs;
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sc(0), F_TOP - 4);
  ctx.lineTo(sc(0), bottom + 6);
  ctx.stroke();
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "center";
  ctx.fillText("0", sc(0), bottom + 18);
  for (const v of [-1, 1, 2]) {
    ctx.fillText(fmt(v, 0), sc(v), bottom + 18);
  }
  ctx.textAlign = "left";
  ctx.fillText("effect on cholesterol →", sc(0.15), F_TOP - 8);

  for (const s of state.snps) {
    const y = F_TOP + (s.j - 1) * F_ROW + F_ROW / 2;
    ctx.fillStyle = s.causal ? colors.ink1 : colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText(`SNP ${s.j}`, lpad - 18, y + 3);
    if (s.causal) {
      /* the truth the chips set, worn in the forest — widget 31's dot */
      ctx.fillStyle = colors.reference;
      ctx.beginPath();
      ctx.arc(lpad - 10, y, 2.5, 0, 7);
      ctx.fill();
    }
    for (const [fit, color, dy] of [[s.lm, colors.highlight, -4.5], [s.mm, colors.empirical, 4.5]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fit.sig ? 1 : 0.45;
      ctx.beginPath();
      ctx.moveTo(sc(fit.lo), y + dy);
      ctx.lineTo(sc(fit.hi), y + dy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sc(fit.est), y + dy, 3, 0, 7);
      if (fit.sig) ctx.fill();
      else {
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
