/* ============================================================================
   Widget 32 · Modeling Hierarchical Data — 500 rows are not 500 observations.

   PHM5003 05-07. The misconception (Hurlbert 1984, the catalogue's slot 6):
   rows are observations. The notebook's own story, regenerated exactly and
   verified to the printed digit (`_lab/mixed-measure.mjs`, 89 checks — the
   REML engine matches lme4's criterion to ~1e-10 on both examples): the
   medication does NOTHING, yet lm on 500 rows reports −3.4 [−5.3, −1.5];
   lmer with the patient as a random effect reads −3.6 [−7.5, 0.2].

   Three tabs, settled over rounds 1–3 of Kenneth's review (the full record
   is catalogue § Widget 32):

     Repeated  the longitudinal BP study. The stage opens as lm sees it —
               a cloud of rows in two arms — and the reveal is the reader
               flipping Measurements to Related (an eased display flip,
               not a Step): the cloud becomes trajectories, and the honest
               interval widens in beside the narrow one.
     Nested    the SNP panel. The DATA first — 1000 cholesterol values
               travelling from collection order into family columns on the
               same flip — then the paired forest, the lmer rows easing in
               with the grouping; the causal SNPs are chips (widget 31's
               move — the reader sets the truth, then sees which fit
               recovers it).
     Syntax    the notebook's random-effects block made live: say what
               each group gets — nothing, its own intercept, its own
               intercept and slope — and the formula assembles while the
               real fitted lines pivot between the three readings.

   Design measurements behind every dial are in `_lab/mixed-design.mjs`:
   visits 1→20 takes lm's false-positive rate 5%→57% while lmer holds 4–9%;
   500×1 / 100×5 / 25×20 all print n = 500 while the honest interval reads
   2.0 / 4.1 / 8.4; at family SD 5 the flat fit averages 2.5 false SNPs of 9
   AND misses the real one 22% of the time (lmer: 0.64, never).

   Draw 7 is the measured default: lm rejects and lmer spans zero on the
   Repeated tab, and on Nested lm flags 2, 5, 6 while lmer keeps exactly
   the causal SNP 5.

   ROUND 3 CUT THE REPEAT-STUDY STAGE (Kenneth's call, made knowing the
   measured counter-argument — the tally was the one instrument showing
   that ~70% agreement under the null coexists with lm false-claiming
   34–44% at ANY sample size; those numbers live in the catalogue and the
   design script, and the rate story now belongs to the lesson prose).
   The same round put the Measurements toggle on Nested and added Syntax.
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

const EASE_MS = 450;

/* independent stream per surface, so opening the gate or flipping the tab
   can never shift the data on the other one — three sims off one Draw
   would otherwise share a stream and reorder each other's draws */
/* 900 is measured, not arbitrary: at Draw 7 it gives the canonical story
   (lm flags 2, 5 and 6; lmer keeps exactly 5) and lmer is exact on 8 of the
   10 neighbouring draws — and it is far above Draw's 1..50, so the streams
   cannot collide */
const FAM_SEED_OFFSET = 900;
const SYN_SEED_OFFSET = 2000;

/* --- stage geometry -------------------------------------------------------- */
const SC_TOP = 22;
const SC_H = 238;
const INT_GAP = 46;
const INT_H = 116;
const V_BOT = 16;
const repeatedHeight = () => SC_TOP + SC_H + INT_GAP + INT_H + V_BOT;

/* the Syntax stage: one panel, the notebook's diagram made live */
const SYN_TOP = 24;
const SYN_H = 300;
const syntaxHeight = () => SYN_TOP + SYN_H + 52;

/* the Nested stage: the family strip — the DATA, above — then the forest */
const STRIP_TOP = 22;
const STRIP_H = 132;
const STRIP_GAP = 46;
const F_TOP = STRIP_TOP + STRIP_H + STRIP_GAP;
const F_ROW = 27;
const F_AXIS = 44;
const nestedHeight = () => F_TOP + 10 * F_ROW + F_AXIS + 14;
/* the forest's frame — ABOVE defineWidget on purpose: core calls draw()
   during the defineWidget call itself, so a const declared below it is
   still in its temporal dead zone on a page that opens straight onto the
   Families tab (the lm-adjustment incident, reproduced here before this
   comment existed) */
const F_LO = -1.8;
const F_HI = 2.6;

const LPAD = 46; // scatter's y-axis gutter
const IPAD = 168; // interval rows: room for the model labels

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

/* --- the R formula card ---------------------------------------------------- *
 * Round 2, Kenneth: "good to have the formula stated — the R code is
 * confusing for lm and lmer". One `.w-math` card above the figure, both
 * calls written out, the ACTIVE model at full strength and the other
 * dimmed; the random-effect term wears the mixed-model colour, because it
 * is the whole difference between the two lines. DOM, so it lands in the
 * text hash. These bindings sit ABOVE defineWidget — core calls draw()
 * during the defineWidget call itself, and this file has now hit that
 * temporal dead zone twice (F_LO was the first). */
let formulaHost = null;
let formulaKey = null;

defineWidget({
  slug: "mixed-model",
  title: "Modeling Hierarchical Data",
  status: "draft",
  subtitle:
    "We can measure the same patient many times, but repeated measurements " +
    "are not independent. A linear mixed model gives each patient a random " +
    "effect, so the evidence is counted in patients rather than rows.",
  layout: "side",
  height: ({ concept }) =>
    concept === "nested" ? nestedHeight()
      : concept === "syntax" ? syntaxHeight() : repeatedHeight(),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      /* the notebook's two hierarchy types, in its own words (round 2):
         repeated measurements from the same subject over time, and
         individuals nested within families */
      options: [
        { value: "repeated", label: "Repeated", detail: "the same patients measured over time — repeated measurements" },
        { value: "nested", label: "Nested", detail: "individuals nested in families, sharing genetics and environment" },
        { value: "syntax", label: "Syntax", detail: "how the random-effects formula is written, built from what you intend" },
      ],
      default: "repeated",
      display: true,
    },

    /* THE DATA — the Visits tab's study design. Every control is a data
       parameter: moving one draws a new study. */
    dataV: {
      type: "section",
      label: "The data",
      when: { param: "concept", equals: "repeated" },
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
      when: { param: "concept", equals: "repeated" },
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
      when: { param: "concept", equals: "repeated" },
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
      when: { param: "concept", equals: "repeated" },
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
      when: { param: "concept", equals: "repeated" },
    },

    /* THE DATA — the Nested tab's. Declared BEFORE the shared reading
       section so its rail order is data first, reading second, same as
       Repeated's. The causal chips are widget 31's move: the reader sets
       the ground truth, then sees which fit recovers it. */
    dataF: {
      type: "section",
      label: "The data",
      when: { param: "concept", equals: "nested" },
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
      when: { param: "concept", equals: "nested" },
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
      when: { param: "concept", equals: "nested" },
    },

    reading: {
      type: "section",
      label: "Reading the data",
      when: { param: "concept", oneOf: ["repeated", "nested"] },
    },
    /* THE REVEAL, on the two data tabs (round 3 — Kenneth: the Nested page
       should carry the same contrast). Two readings of the SAME rows, so
       display: true — the ease between them is what shows it is the same
       data (the widget-12 rule). On Repeated the measurements join into
       patients; on Nested the individuals travel to their family columns.
       (The repeat-the-study gate lived here until round 3 — cut on
       Kenneth's call; its measurements survive in the catalogue.) */
    view: {
      type: "segmented",
      label: "Measurements",
      options: [
        { value: "independent", label: "Independent", detail: "every row its own observation — what lm assumes" },
        { value: "related", label: "Related", detail: "rows share a patient or a family — the correlation lmer models" },
      ],
      default: "independent",
      display: true,
      when: { param: "concept", oneOf: ["repeated", "nested"] },
    },

    /* THE INTENT — the Syntax tab's one control, the notebook's own block
       made live: say what each group gets, and the formula assembles. A
       display parameter: the data holds still while the fitted lines ease
       between the three readings. */
    model: {
      type: "section",
      label: "The model",
      when: { param: "concept", equals: "syntax" },
    },
    ranef: {
      type: "segmented",
      label: "Random effects",
      options: [
        { value: "none", label: "None", detail: "one line for everyone — plain lm" },
        { value: "intercept", label: "Intercept", detail: "each group its own level — (1 | G)" },
        { value: "slope", label: "Both", detail: "each group its own level and trend — (1 + X | G)" },
      ],
      default: "none",
      display: true,
      when: { param: "concept", equals: "syntax" },
    },

    seed: {
      type: "int",
      label: "Draw",
      detail: "another study from the same population",
      min: 1,
      max: 50,
      default: 7,
    },
  },

  legend: [
    { token: "group-a", label: "Control group", mark: "dot" },
    { token: "group-b", label: "Medication group", mark: "dot" },
    { token: "highlight", label: "lm — every row treated as independent", mark: "line" },
    { token: "empirical", label: "lmer — patients as random effects", mark: "line" },
    { token: "reference", label: "The true effect, set by the dial", mark: "line" },
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

    /* --- the Syntax diagram's data ---------------------------------------- *
     * The notebook's Y-vs-X-by-G figure made live: two groups whose level
     * and trend offsets are FIXED (this page is a diagram brought to life,
     * not an inference demo — a draw where the groups happened to agree
     * would teach nothing), only the points jitter with Draw. All three
     * fits are the real engine, so the lines are earned, not sketched. */
    const rngS = makeRng(seed + SYN_SEED_OFFSET);
    const SYN_U0 = [-3.5, 3.5];
    const SYN_U1 = [-0.22, 0.22];
    const synPts = [];
    for (let g = 0; g < 2; g += 1) {
      for (let i = 0; i < 8; i += 1) {
        const x = 0.5 + rngS.next() * 9;
        const y = 5 + SYN_U0[g] + (0.55 + SYN_U1[g]) * x + rngS.normal(0, 1.2);
        synPts.push({ x, y, g });
      }
    }
    const synX = synPts.map((p) => [1, p.x]);
    const synY = synPts.map((p) => p.y);
    const synG = synPts.map((p) => p.g);
    const sLM = fitLM(synY, synX);
    const sInt = fitLMM(synY, synX, synG, null);
    const sSlp = fitLMM(synY, synX, synG, synPts.map((p) => p.x));
    const synLines = {
      none: [[sLM.coef[0], sLM.coef[1]], [sLM.coef[0], sLM.coef[1]]],
      intercept: sInt.blups.map((u) => [sInt.coef[0] + u[0], sInt.coef[1]]),
      slope: sSlp.blups.map((u) => [sSlp.coef[0] + u[0], sSlp.coef[1] + u[1]]),
    };
    let sLo = Infinity;
    let sHi = -Infinity;
    for (const p of synPts) {
      if (p.y < sLo) sLo = p.y;
      if (p.y > sHi) sHi = p.y;
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

    /* the family strip — every individual's cholesterol, families sorted by
       their mean, so the nesting is the picture: tight vertical clusters on
       a ramp when families differ, one flat band when they do not. Each dot
       keeps BOTH addresses — its collection-order index and its family
       column — so the Independent → Related ease can move it between them
       (round 3: the same reveal grammar as the Repeated tab). */
    const byFam = new Map();
    simF.familyId.forEach((f, i) => {
      if (!byFam.has(f)) byFam.set(f, []);
      byFam.get(f).push(i);
    });
    const famStrip = [...byFam.values()]
      .map((idxs) => {
        const ys = idxs.map((i) => simF.chol[i]);
        return {
          idxs,
          ys,
          mean: ys.reduce((a, b) => a + b, 0) / ys.length,
          lo: Math.min(...ys),
          hi: Math.max(...ys),
        };
      })
      .sort((a, b) => a.mean - b.mean);
    const famDots = [];
    famStrip.forEach((fam, fi) => {
      for (const i of fam.idxs) famDots.push({ y: simF.chol[i], ii: i, fi });
    });
    let cLo = Infinity;
    let cHi = -Infinity;
    for (const v of simF.chol) {
      if (v < cLo) cLo = v;
      if (v > cHi) cHi = v;
    }

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
      sim, lm, mm, snps, famStrip, famDots,
      synPts, synLines,
      synLo: Math.floor(sLo - 1),
      synHi: Math.ceil(sHi + 1),
      cholLo: Math.floor(cLo - 1),
      cholHi: Math.ceil(cHi + 1),
      famSD: mmF.sdInt,
      famResid: mmF.sigma,
      famICC: mmF.icc,
      yLo, yHi,
      nRows: np * m,
      trueEffect: EFFECTS[params.effect],
    };
  },

  animation: {
    /* STEP AND PLAY ARE DECLINED (round 2; round 3 cut the repeat-study
       gate itself — Kenneth's call, against the tally's own evidence,
       recorded in the catalogue). Every figure opens FINISHED. The two
       animations left — the Independent → Related ease and the Syntax
       tab's line pivots — run on core's easing-request door, no buttons
       involved. */
    stepLabel: null,
    runLabel: null,
    init: ({ params, state }) => {
      const t = params.view === "related" ? 1 : 0;
      const lines = state.synLines[params.ranef].map((l) => l.slice());
      return {
        mix: t, mixT: t,
        syn: lines, synT: lines.map((l) => l.slice()),
        done: true, easing: false,
      };
    },
    advance: (anim, { dt }) => {
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      const gap = anim.mixT - anim.mix;
      if (Math.abs(gap) > 0.004) {
        anim.mix += gap * rate;
        moving = true;
      } else {
        anim.mix = anim.mixT;
      }
      for (let g = 0; g < 2; g += 1) {
        for (let k = 0; k < 2; k += 1) {
          const d = anim.synT[g][k] - anim.syn[g][k];
          if (Math.abs(d) > 0.002) {
            anim.syn[g][k] += d * rate;
            moving = true;
          } else {
            anim.syn[g][k] = anim.synT[g][k];
          }
        }
      }
      if (!moving) anim.easing = false;
      return moving;
    },
    /* a view flip or an intent flip requests the ease; every other display
       change repaints finished */
    rebuild: (anim, { params, state }) => {
      const t = params.view === "related" ? 1 : 0;
      if (t !== anim.mixT) {
        anim.mixT = t;
        anim.easing = true;
      }
      const target = state.synLines[params.ranef];
      if (target.some((l, g) => l.some((v, k) => v !== anim.synT[g][k]))) {
        anim.synT = target.map((l) => l.slice());
        anim.easing = true;
      }
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderFormulas(params);
    if (params.concept === "nested") drawNested(ctx, colors, w, params, state, anim);
    else if (params.concept === "syntax") drawSyntax(ctx, colors, w, params, state, anim);
    else drawRepeated(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.concept === "nested") {
      const mixN = anim?.mix ?? 0;
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
          value: mixN < 0.02 ? "—" : list("mm"),
          note: mixN < 0.02
            ? "set Measurements to Related to fit it"
            : "with the families as random effects — the dotted SNPs are the truth you set",
        },
        {
          label: "Family SD",
          value: fmt(state.famSD, 1),
          note: `between families, against ${fmt(state.famResid, 1)} within — ICC ${fmt(state.famICC, 2)}`,
        },
      ];
    }
    if (params.concept === "syntax") {
      /* printed from the EASED lines — the numbers are the lines drawn */
      const L = anim?.syn ?? state.synLines[params.ranef];
      const same = params.ranef === "none";
      const tiles = [
        {
          label: "Intercepts",
          value: same ? fmt(L[0][0], 1) : `${fmt(L[0][0], 1)} · ${fmt(L[1][0], 1)}`,
          note: same
            ? "one level for everyone"
            : `one level per group — the 1 in ${params.ranef === "slope" ? "(1 + X | G)" : "(1 | G)"}`,
        },
        {
          label: "Slopes",
          value: params.ranef === "slope" ? `${fmt(L[0][1], 2)} · ${fmt(L[1][1], 2)}` : fmt(L[0][1], 2),
          note: params.ranef === "slope"
            ? "one trend per group — the X in (1 + X | G)"
            : "one trend, shared by the groups",
        },
      ];
      return tiles;
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
          ? "set Measurements to Related to fit it"
          : Number(params.visits) === 1
            ? "one visit each — the measurements really are independent, and the fits agree"
            : "patients as random effects — the evidence counted in patients",
      },
    ];
    return tiles;
  },
});

function renderFormulas(params) {
  if (typeof document === "undefined") return;
  if (!formulaHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    formulaHost = document.createElement("div");
    formulaHost.className = "w-math";
    figure.parentNode.insertBefore(formulaHost, figure);
  }
  /* the card follows the toggle on the data tabs, and the intent on the
     Syntax tab (round 3) */
  const active = params.concept === "syntax"
    ? (params.ranef === "none" ? "lm" : "mm")
    : (params.view === "related" ? "mm" : "lm");
  const key = `${params.concept}|${active}|${params.ranef}`;
  if (key === formulaKey) return;
  formulaKey = key;
  const mono = "font-family:var(--font-mono);font-size:var(--fs-xs)";
  const dim = (on) => (on ? "" : "opacity:.45");
  const re = (t) => `<span style="color:var(--c-empirical)">${t}</span>`;
  const line = (label, body, on) =>
    `<div class="w-math-eq" style="min-height:0;${mono};${dim(on)}">${label}( ${body} )</div>`;
  const [lmLine, mmLine] = params.concept === "nested"
    ? [
      line("lm", "cholesterol ~ SNP1 + … + SNP10", active === "lm"),
      line("lmer", `cholesterol ~ SNP1 + … + SNP10 + ${re("(1 | family)")}`, active === "mm"),
    ]
    : params.concept === "syntax"
      ? [
        line("lm", "Y ~ X", active === "lm"),
        line("lmer", `Y ~ X + ${re(params.ranef === "slope" ? "(1 + X | G)" : "(1 | G)")}`, active === "mm"),
      ]
      : [
        line("lm", "bp ~ age + gender + medication", active === "lm"),
        line("lmer", `bp ~ age + gender + medication + ${re("(1 + time | patient)")}`, active === "mm"),
      ];
  const note = params.concept === "nested"
    ? "(1 | family) is the random effect — which rows share a family"
    : params.concept === "syntax"
      ? "the pattern: (1 + ⟨variable for the slopes⟩ | ⟨grouping variable for the intercepts⟩) — the 1 is the baseline intercept"
      : "(1 + time | patient) is the random effect — which rows share a patient, each with its own level and trend";
  formulaHost.innerHTML = lmLine + mmLine
    + `<div class="w-math-note" style="font-size:var(--fs-xs)">${note}</div>`;
}

/* --- the Repeated stage ---------------------------------------------------- */

function drawRepeated(ctx, colors, w, params, state, anim) {
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
  drawIntervalPanel(ctx, colors, w, params, state, mix, SC_TOP + SC_H + INT_GAP);
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
    ctx.fillText("set Measurements to Related to fit it", IPAD, y2 + 3);
  }
}

/* --- the Syntax stage ------------------------------------------------------- *
 * The notebook's random-effects diagram, live: two groups of points, the
 * pooled lm line always present (dashed, the naive fit's own colour), and
 * the per-group lines easing between the three intents. The lines are the
 * real engine's fits on this draw, so the picture is earned. */
function drawSyntax(ctx, colors, w, params, state, anim) {
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const lpad = 46;
  const rpad = 64; // room for the on-canvas group labels at the line ends
  const XMAX = 10;
  const X = (v) => lpad + (v / XMAX) * (w - lpad - rpad);
  const Y = (v) => SYN_TOP
    + ((state.synHi - v) / (state.synHi - state.synLo)) * SYN_H;
  ctx.font = fontXs;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let v = Math.ceil(state.synLo / 4) * 4; v <= state.synHi; v += 4) {
    const y = Y(v);
    ctx.fillText(String(v), lpad - 6, y + 3);
    ctx.beginPath();
    ctx.moveTo(lpad, y);
    ctx.lineTo(w - rpad, y);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillText("X", (lpad + w - rpad) / 2, SYN_TOP + SYN_H + 28);
  ctx.textAlign = "left";
  ctx.fillText("Y — one point per observation, colour is the group G", lpad, SYN_TOP - 10);

  /* the pooled lm line, always on stage — the reading every random effect
     is a departure from */
  const pooled = state.synLines.none[0];
  ctx.strokeStyle = colors.highlight;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(pooled[0]));
  ctx.lineTo(X(XMAX), Y(pooled[0] + pooled[1] * XMAX));
  ctx.stroke();
  ctx.setLineDash([]);

  /* the per-group lines, eased between the intents; at None they sit ON
     the pooled line and fade out */
  const L = anim?.syn ?? state.synLines[params.ranef];
  const groupColor = [colors.groupA, colors.groupB];
  const apart = Math.abs(L[0][0] - L[1][0]) + Math.abs(L[0][1] - L[1][1]) * XMAX;
  const alpha = Math.min(1, apart / 2.5);
  for (let g = 0; g < 2; g += 1) {
    ctx.strokeStyle = groupColor[g];
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(L[g][0]));
    ctx.lineTo(X(XMAX), Y(L[g][0] + L[g][1] * XMAX));
    ctx.stroke();
    if (alpha > 0.3) {
      ctx.fillStyle = groupColor[g];
      ctx.textAlign = "left";
      ctx.fillText(`group ${g + 1}`, X(XMAX) + 6, Y(L[g][0] + L[g][1] * XMAX) + 3);
    }
    ctx.globalAlpha = 1;
  }

  for (const p of state.synPts) {
    ctx.fillStyle = groupColor[p.g];
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 3, 0, 7);
    ctx.fill();
  }
}

/* --- the Nested stage ------------------------------------------------------ */

function drawNested(ctx, colors, w, params, state, anim) {
  const mix = anim?.mix ?? 0;
  const fontXs = `${colors.fsXs}px ${colors.font}`;
  const lpad = 74;
  const sc = (v) => lpad + ((Math.min(Math.max(v, F_LO), F_HI) - F_LO) / (F_HI - F_LO)) * (w - lpad - 14);
  const bottom = F_TOP + 10 * F_ROW;

  /* THE DATA FIRST (round 2), and THE REVEAL on it (round 3): the same
     1000 cholesterol values, drawn in collection order at Independent — no
     visible structure — and travelling to their family columns at Related,
     where the nesting IS the picture: a ramp of tight vertical clusters at
     the notebook's family strength, one flat band at none. */
  const strip = state.famStrip;
  const nFam = strip.length;
  const nInd = state.famDots.length;
  const colW = (w - lpad - 14) / nFam;
  const SY = (v) => STRIP_TOP
    + ((state.cholHi - v) / (state.cholHi - state.cholLo)) * STRIP_H;
  const xIndep = (ii) => lpad + ((ii + 0.5) / nInd) * (w - lpad - 14);
  const xFam = (fi) => lpad + (fi + 0.5) * colW;
  ctx.font = fontXs;
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.fillText(
    mix > 0.5
      ? "cholesterol, one column per family — families sorted by their mean"
      : "cholesterol, one dot per individual — in collection order",
    lpad, STRIP_TOP - 8,
  );
  ctx.textAlign = "right";
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  const tick = Math.ceil((state.cholHi - state.cholLo) / 40) * 10;
  for (let v = Math.ceil(state.cholLo / tick) * tick; v <= state.cholHi; v += tick) {
    const y = SY(v);
    ctx.fillText(String(v), lpad - 6, y + 3);
    ctx.beginPath();
    ctx.moveTo(lpad, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }
  if (mix > 0.004) {
    /* the family's span — the bar under the dots is what "these rows share
       a family" looks like; it fades in with the grouping */
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = Math.max(1, colW * 0.5);
    ctx.globalAlpha = mix;
    for (let f = 0; f < nFam; f += 1) {
      const x = xFam(f);
      ctx.beginPath();
      ctx.moveTo(x, SY(strip[f].lo));
      ctx.lineTo(x, SY(strip[f].hi));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = colors.ink2;
  ctx.globalAlpha = 0.6;
  for (const d of state.famDots) {
    const x = xIndep(d.ii) + (xFam(d.fi) - xIndep(d.ii)) * mix;
    ctx.beginPath();
    ctx.arc(x, SY(d.y), 1.3, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

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
    /* lm sits centred while alone; the lmer row eases in below it as the
       grouping arrives (round 3 — the same reveal the Repeated tab makes) */
    const rows = [[s.lm, colors.highlight, -4.5 * mix, 1]];
    if (mix > 0.02) rows.push([s.mm, colors.empirical, 4.5, mix]);
    for (const [fit, color, dy, a] of rows) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = (fit.sig ? 1 : 0.45) * a;
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
