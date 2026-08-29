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
                       dropped. FIXES: the two censored
                       lanes name their reasons ("study ended", "dropped
                       out") because an unlabelled open circle reads as
                       "survived" — the misconception wearing a costume —
                       and each wrong treatment states its MECHANISM in a
                       panel note (2.9: mechanism, never a verdict).
     Comparing groups  are the groups different? Two KM curves at n = 200,
                       censor ticks, the log-rank p, bands/shared overlays —
                       and the hazard BY INTERVAL below, in tab 1's own
                       vocabulary (h = events ÷ at risk, per group, 2-year
                       bins) drawn with the curve's own sx so the axes
                       cannot disagree. Round 5 replaced pick H4 here: the
                       person-time rates, dashed ×HR claim boxes and
                       per-bin ratio labels were three new ideas at once
                       and confused Kenneth's own review ("what are the
                       bars? the x axis is not aligned"). The hazard ratio
                       survives as one computed sentence and the tile.
     Finding factors   which factors are associated with the hazard? The
                       cohort named on screen, the group curves kept in
                       view (Play still has something to sweep), and the
                       forest built BY THE READER with three pills —
                       disease → + age → + SNPs — the lm-adjustment move
                       two lessons back, rows easing in, the disease HR's
                       shift annotated. The SNPs stop coming out of
                       nowhere because the reader adds them.

   ROUND 12 CONSOLIDATED TO THE NOTEBOOK (Kenneth's picks, 2026-08-29,
   mocked first in `_lab/time-event-round12.html`): CUT "as events" (the
   notebook names ONE tempting mistake — dropping), CUT the Onset control
   (Early baked in: shift 6 in compute, axis fixed at 16), CUT the truth
   overlay on Comparing groups (notebook-absent; the misconception's
   home is the Censoring tab). ADDED the ln(h/h₀) bridge as a MathML row
   above the Finding-factors figure — pick M1: ONE row that follows the
   pills, resting at the notebook's symbols, in the lm arc's own position
   and per-term wrap pattern — and the forest axis end labels
   ("← hazard lower · hazard higher →", pick L1, flanking the caption).
   The HR tile and summary now say "hazard" where they said "event rate"
   — one quantity, one word, closing the loop with the two hazard panels.

   One motion throughout: a time cursor sweeps right and curves build under
   it. The `censored` control is display: true — three readings of ONE
   dataset, so toggling never resets the sweep. `anim.done` is re-read
   against the new tab's end in `rebuild`, so a curve finished on Censoring
   keeps building on Comparing groups.

   THE DATA (round 8 made it a PLAY SURFACE — Kenneth: fixed curves were
   "thin cosmetics"): the five patients are the notebook's own, except E's
   time, which is the Censoring tab's lever. The cohort tabs share a data
   section — Patients (30–200), Disease effect (the None/Small/Moderate/
   Large ladder, values measured per cell), Follow-up (doors close at
   12–25) and Draw — every one a DATA parameter, so moving it draws a new
   study and the sweep starts over, which is the point. The generator keeps
   the notebook's event process with two measured amendments (model.js
   header): censoring by study end, not the Status coin; and SNPs BALANCED
   across groups, because a clean "Disease effect: none" must silence every
   channel. Draw 1 at the defaults is the measured clean cohort: cell 17's
   exact story, all null SNPs quiet, every hazard bin ordered. R's seeded
   draw does not reproduce in JS; the deterministic cells are verified to
   the digit and the simulated arm across this widget's own seeds.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";
import { km, logrank, coxph, simulate } from "./model.js";

/* --- the patients — the notebook's five, extendable (round 9) ------------- *
 * The first five ARE the notebook's table (A–E, times 5/10/6/8/7), and the
 * defaults reproduce it exactly: 5 patients, 2 censored. The Patients
 * control extends the table with five more hand-fixed lanes (F–J — J ties
 * C at t = 6, so ten patients include a tied event, d/n = 2/n), and the
 * Censored control flips statuses in a FIXED order, E and B first, so the
 * notebook's pair goes first and A is always an event. Deterministic on
 * purpose — no draw on this tab: the human scale stays a table you can
 * point at. E's time stays the round-8 lever. */
const P_IDS = "ABCDEFGHIJ";
const P_TIMES = [5, 10, 6, 8, 7, 3, 9, 4, 2, 6]; // slot 4 (E) overridden by etime
const CENSOR_ORDER = [4, 1, 5, 6, 7, 2, 3]; // E, B, F, G, H, C, D
function patientTable(nPat, cWant, etime) {
  const times = P_TIMES.slice(0, nPat);
  times[4] = etime;
  const status = new Array(nPat).fill(1);
  const order = CENSOR_ORDER.filter((i) => i < nPat);
  const censoredIdx = order.slice(0, Math.min(cWant, order.length));
  for (const i of censoredIdx) status[i] = 0;
  return { times, status, censoredIdx };
}
/* "B and E", "E", "B, C and E" — the names the mechanism notes speak in */
function namePhrase(idx) {
  const names = [...idx].map((i) => P_IDS[i]).sort();
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
/* the lesson's two causes of censoring, named on the lanes when they apply */
const CENSOR_WHY = { 1: "study ended", 4: "dropped out" };

/* the Disease-effect ladder, in time units — values measured over 100 seeds
   per cell (model.js header has the grid): none sits on the 5% floor at
   every n, small is the power story (24% → 89% as n grows), moderate fires
   at every n, large saturates */
const EFFECTS = { none: 0, small: 1.2, moderate: 2.5, large: 4.5 };
/* Early onset is BAKED IN (round 12 cut the control): shift 6 moves the
   whole event process earlier so the curves never idle through a flat
   head, and every measured number (the effect ladder, the follow-up
   span, draw 32) was taken at early. Max event time at shift 6 is 16
   (20 − 0.1·30 − 6 + runif 5 at age 30), so the axis is fixed there. */
const SHIFT = 6;

const T1MAX = 11;
const T2MAX = 16;

const SPEEDS = {
  slow: { label: "Slow", rate: 1.2, detail: "about a year per second" },
  medium: { label: "Medium", rate: 3.5, detail: "the curve builds in a few seconds" },
  fast: { label: "Fast", rate: 9, detail: "straight to the finished curve" },
};

/* --- stage geometry, one place -------------------------------------------- */
/* Censoring tab: lanes / curve / hazard strip, all functions of the patient
   count now that it is a control. 26px lanes leave room for the censoring
   reason under a lane's end mark. */
const LANE_GAP = 26;
const LANES_Y = 30;
const lanesH = (nPat) => LANE_GAP * (nPat - 1) + 14;
const curve1Y = (nPat) => LANES_Y + lanesH(nPat) + 40;
const CURVE1_H = 180;
/* 78, not 64: the strip's header is TWO lines — the title, then the
   direction line (wrong treatments) beside the formula chip (round 4) */
const hazY = (nPat) => curve1Y(nPat) + CURVE1_H + 78;
const HAZ_H = 80;
const patHeight = (nPat) => hazY(nPat) + HAZ_H + 48;

/* Comparing groups tab: the curves, then the interval-hazard panel on the
   SAME time axis (round 5 — tab 1's stacked-panels-share-an-axis contract) */
const KM2_Y = 30;
const KM2_H = 230;
const HR_TOP = KM2_Y + KM2_H + 56;
const HR_HEAD = 36; // title, then the claim line beside the formula chip
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

/* S(t) read off a km() step list. */
function readS(steps, t) {
  let S = 1;
  for (const s of steps) {
    if (s.t <= t) S = s.S;
    else break;
  }
  return S;
}

/* interval hazard in [lo, hi) — TAB 1'S OWN QUANTITY, h = events ÷ at risk
   at the interval's start. One hazard definition, met twice (round 5). */
function intervalHaz(times, status, lo, hi) {
  let n = 0;
  let ev = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] >= lo) {
      n += 1;
      if (status[i] === 1 && times[i] < hi) ev += 1;
    }
  }
  return { n, ev, h: n ? ev / n : NaN };
}

/* the two readings of one dataset — what the `censored` control chooses.
   "As events" was the third and was cut in round 12: the notebook names
   ONE tempting mistake (dropping), and the second wrong treatment pushed
   the same way while doubling the notes. */
function readings(times, status) {
  const keptT = times.filter((_, i) => status[i] === 1);
  return {
    kept: km(times, status),
    dropped: keptT.length ? km(keptT, keptT.map(() => 1)) : { steps: [], censors: [] },
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

/* --- the ln(h/h₀) bridge row (round 12, Kenneth's pick M1) ----------------- *
 * The notebook's own move: take ln of the Cox model and the right side is
 * the linear predictor the lm arc taught. ONE `.w-math` row above the
 * Finding-factors figure — the position and machinery every lm-arc widget
 * uses (lm-interaction's: a MathML probe with a plain-text fallback, one
 * <math> per term so the row wraps at narrow widths instead of
 * overflowing — a single <math> never line-breaks). The row FOLLOWS THE
 * PILLS: every name in it is a covariate the reader added, resting at the
 * notebook's symbols while no pill is in. Factors tab only; hidden and
 * emptied elsewhere so the text hash reads nothing on the other tabs. */
function mathmlRenders() {
  if (typeof window === "undefined" || typeof window.MathMLElement !== "function") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;font-size:16px";
  probe.innerHTML = '<math id="te-frac"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
    + '<math id="te-flat"><mn>1</mn></math>';
  document.body.appendChild(probe);
  const h = (id) => probe.querySelector(`#${id}`)?.getBoundingClientRect().height ?? 0;
  const stacked = h("te-frac");
  const flat = h("te-flat");
  probe.remove();
  return flat > 0 && stacked > flat * 1.4;
}
const MATHML = mathmlRenders();

/* ln( h(t) / h₀(t) ) = — the notebook's left side, the fraction real */
const LN_LEAD_MATH =
  "<math><mrow><mi>ln</mi><mo>(</mo>"
  + "<mfrac><mrow><mi>h</mi><mo>(</mo><mi>t</mi><mo>)</mo></mrow>"
  + "<mrow><msub><mi>h</mi><mn>0</mn></msub><mo>(</mo><mi>t</mi><mo>)</mo></mrow></mfrac>"
  + "<mo>)</mo><mo>=</mo></mrow></math>";
/* one term = one <math>: bᵢ·name, or the symbolic bᵢxᵢ when name is null */
const mathTerm = (i, name, first) =>
  `<math><mrow>${first ? "" : '<mo form="infix">+</mo>'}`
  + `<msub><mi>b</mi><mn>${i}</mn></msub>`
  + `${name ? `<mo>&#xB7;</mo><mi>${name}</mi>` : `<msub><mi>x</mi><mn>${i}</mn></msub>`}</mrow></math>`;
const MATH_ELLIPSIS = '<math><mrow><mo form="infix">+</mo><mi>&#x2026;</mi></mrow></math>';
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((d) => SUBS[+d]).join("");

/* the row's terms from the pills, in the model's own order (d, a, s) —
   the b-indices are positions in the CURRENT model, matching the fit */
function bridgeHTML(params) {
  const named = [];
  if (params.disease) named.push("disease");
  if (params.age) named.push("age");
  const snpAt = named.length + 1;
  if (!named.length && !params.snps) {
    return MATHML
      ? `${LN_LEAD_MATH} ${mathTerm(1, null, true)} ${mathTerm(2, null)} ${MATH_ELLIPSIS}`
      : "ln( h(t) ÷ h₀(t) ) = b₁x₁ + b₂x₂ + …";
  }
  if (!MATHML) {
    const parts = named.map((nm, i) => `b${sub(i + 1)}·${nm}`);
    if (params.snps) parts.push(`b${sub(snpAt)}·SNP_1 + … + b${sub(snpAt + 9)}·SNP_10`);
    return `ln( h(t) ÷ h₀(t) ) = ${parts.join(" + ")}`;
  }
  const terms = named.map((nm, i) => mathTerm(i + 1, nm, i === 0));
  if (params.snps) {
    terms.push(mathTerm(snpAt, "SNP_1", terms.length === 0));
    terms.push(MATH_ELLIPSIS);
    terms.push(mathTerm(snpAt + 9, "SNP_10", false));
  }
  return `${LN_LEAD_MATH} ${terms.join(" ")}`;
}

let bridgeHost = null;
let bridgeKey = null;
function renderBridge(params) {
  if (typeof document === "undefined") return;
  if (params.concept !== "factors") {
    if (bridgeHost) {
      bridgeHost.style.display = "none";
      bridgeHost.innerHTML = "";
      bridgeKey = null;
    }
    return;
  }
  if (!bridgeHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    bridgeHost = document.createElement("div");
    bridgeHost.className = "w-math";
    figure.parentNode.insertBefore(bridgeHost, figure);
  }
  bridgeHost.style.display = "";
  const key = `${params.disease ? 1 : 0}${params.age ? 1 : 0}${params.snps ? 1 : 0}`;
  if (key === bridgeKey) return;
  bridgeKey = key;
  bridgeHost.innerHTML = `<div class="w-math-eq" style="min-height:0">${bridgeHTML(params)}</div>`;
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
  /* round 11: the hover inspector (a guide line and one reading of the
     figure at the hovered year) and the scrub (drag the clock) */
  pointer: true,
  height: ({ concept, patients, snps }) => (concept === "censoring" ? patHeight(patients)
    : concept === "groups" ? GRP_HEIGHT : FACT_HEIGHT(snps)),

  params: {
    concept: {
      type: "segmented",
      label: "Concept",
      options: [
        { value: "censoring", label: "Censoring", detail: "how time-to-event data is recorded, and what censoring is" },
        { value: "groups", label: "Comparing groups", detail: "are the groups different? two Kaplan–Meier curves and the log-rank test" },
        { value: "factors", label: "Finding factors", detail: "which factors are associated with the hazard? Cox regression, built a covariate at a time" },
      ],
      default: "censoring",
      display: true,
    },

    /* THE PATIENTS — the Censoring tab's own data section (round 9).
       Defaults reproduce the notebook's table exactly; the controls extend
       it. Deterministic — no draw at human scale. */
    people: {
      type: "section",
      label: "The patients",
      when: { param: "concept", equals: "censoring" },
    },
    patients: {
      type: "int",
      label: "Patients",
      min: 5,
      max: 10,
      default: 5,
      when: { param: "concept", equals: "censoring" },
    },
    ncens: {
      type: "int",
      label: "Censored",
      detail: "how many never show their event",
      min: 0,
      max: 7,
      default: 2,
      when: { param: "concept", equals: "censoring" },
    },
    /* the round-8 lever: when E leaves, relative to the events, decides
       every later denominator */
    etime: {
      type: "int",
      label: "Patient E's time",
      min: 1,
      max: 10,
      default: 7,
      when: { param: "concept", equals: "censoring" },
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
      /* round 4 tied this label to "(B and E)"; round 9 made the censored
         SET a control, so the names moved to the lanes and the mechanism
         notes, which compute them */
      label: "Censored patients",
      options: [
        { value: "kept", label: "Kept", detail: "in the risk set until they leave — the Kaplan–Meier estimate" },
        { value: "dropped", label: "Dropped" },
      ],
      default: "kept",
      display: true,
      when: { param: "concept", equals: "censoring" },
    },

    /* THE DATA — the play surface (round 8), shared by the two cohort tabs.
       Every control is a DATA parameter: moving one draws a new study and
       the sweep starts over, which is the point — the reader watches the
       new study build. The five patients stay fixed: their tab teaches
       mechanics at human scale. */
    data: {
      type: "section",
      label: "The data",
      when: { param: "concept", oneOf: ["groups", "factors"] },
    },
    n: {
      type: "choice",
      label: "Patients",
      options: [
        { value: "30", label: "30" },
        { value: "60", label: "60" },
        { value: "100", label: "100" },
        { value: "200", label: "200" },
      ],
      default: "200",
      when: { param: "concept", oneOf: ["groups", "factors"] },
    },
    effect: {
      type: "choice",
      label: "Disease effect",
      options: [
        { value: "none", label: "None", detail: "no real difference between the groups" },
        { value: "small", label: "Small" },
        { value: "moderate", label: "Moderate" },
        { value: "large", label: "Large" },
      ],
      default: "moderate",
      when: { param: "concept", oneOf: ["groups", "factors"] },
    },
    follow: {
      type: "choice",
      label: "Follow-up",
      options: [
        { value: "12", label: "12 y" },
        { value: "15", label: "15 y" },
        { value: "20", label: "20 y" },
        { value: "25", label: "25 y" },
      ],
      default: "12",
      when: { param: "concept", oneOf: ["groups", "factors"] },
    },
    /* "Draw", not "seed" (the arc's ruling: nothing on screen should need
       "seed" explained) — another cohort from the same population. Draw 1
       is the measured clean default: cell 17's exact story, all null SNPs
       quiet, every hazard bin ordered. */
    seed: {
      type: "int",
      label: "Draw",
      detail: "another cohort from the same population",
      min: 1,
      max: 50,
      default: 32,
      when: { param: "concept", oneOf: ["groups", "factors"] },
    },

    curves: {
      type: "section",
      label: "The curves",
      when: { param: "concept", equals: "groups" },
    },
    bands: {
      type: "bool",
      label: "Confidence bands",
      detail: "95% confidence bands — wider where fewer remain at risk",
      default: false,
      display: true,
      when: { param: "concept", equals: "groups" },
    },
    /* THE NULL, DRAWN (round 7): "if the groups shared one curve" is the
       pooled Kaplan–Meier of all 200 — the curve the log-rank test splits
       each event along, by the risk sets. The literature says this sentence
       everywhere and draws it nowhere (Bland & Altman's BMJ note, PSU 509);
       drawing the claim being tested is this repo's own move, and
       --c-theory is the token that means exactly that. */
    shared: {
      type: "bool",
      label: "One shared curve",
      detail: "all patients pooled — the one curve both groups would follow if the disease made no difference",
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
    /* the authoring escape hatch: cursor time × 2, so ?shown=44 is a finished
       figure on any tab */
    shown: { type: "int", min: 0, max: 44, default: 0, hidden: true },
  },

  legend: [
    { token: "event", label: "The event occurred", mark: "dot" },
    { token: "unknown", label: "Censored — followed this far, then unseen", mark: "dot" },
    { token: "empirical", label: "The Kaplan–Meier curve, censored kept in the risk set", mark: "line" },
    { token: "highlight", label: "The same data with the censored dropped", mark: "line" },
    { token: "theory", label: "One shared curve — what the log-rank test compares against", mark: "line" },
    { token: "group-a", label: "No disease", mark: "line" },
    { token: "group-b", label: "Disease", mark: "line" },
  ],

  compute({ params, rng }) {
    const table = patientTable(params.patients, params.ncens, params.etime);
    const fiveT = table.times;
    const five = readings(fiveT, table.status);
    const sim = simulate(rng, {
      n: Number(params.n),
      effect: EFFECTS[params.effect],
      follow: Number(params.follow),
      shift: SHIFT,
    });
    const per = (grp) => {
      const t = sim.time.filter((_, i) => sim.disease[i] === grp);
      const s = sim.status.filter((_, i) => sim.disease[i] === grp);
      return {
        kept: km(t, s),
        times: t,
        status: s,
        n: t.length,
      };
    };
    const groups = [per(0), per(1)];
    const lr = logrank(sim.time, sim.status, sim.disease);
    /* the null hypothesis as a curve: all 200 patients pooled */
    const pooled = km(sim.time, sim.status);

    /* the groups tab's hazard panel: 2-year intervals on the curve's own
       axis, stopping once EITHER group has fewer than 10 at risk — past
       that the bars are denominators of 5 and 2, i.e. noise (measured;
       catalogue round 5) */
    const hazBins = [];
    for (let lo = 0; lo < 20; lo += 2) {
      const b0 = intervalHaz(groups[0].times, groups[0].status, lo, lo + 2);
      const b1 = intervalHaz(groups[1].times, groups[1].status, lo, lo + 2);
      if (b0.n < 10 || b1.n < 10) break;
      /* the event times inside the bin, sorted — the bars GROW as the sweep
         passes each one (round 6), so a bar mid-frame reads "events so far
         this interval ÷ at risk at its start", true at every t */
      const evTimes = (g) => groups[g].times
        .filter((tt, i) => groups[g].status[i] === 1 && tt >= lo && tt < lo + 2)
        .sort((a, b) => a - b);
      hazBins.push({
        lo,
        hi: lo + 2,
        h0: b0.h,
        h1: b1.h,
        ev0: b0.ev,
        ev1: b1.ev,
        n0: b0.n,
        n1: b1.n,
        ev0T: evTimes(0),
        ev1T: evTimes(1),
      });
    }

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
      censoring: [...new Set(fiveT)].sort((a, b) => a - b),
      groups: [...new Set(sim.time)].sort((a, b) => a - b),
    };
    const tEnd = {
      censoring: stepTimes.censoring[stepTimes.censoring.length - 1],
      groups: stepTimes.groups[stepTimes.groups.length - 1],
    };
    return {
      five,
      fiveT,
      fiveS: table.status,
      nPat: params.patients,
      censPhrase: namePhrase(table.censoredIdx),
      nCens: table.censoredIdx.length,
      groups,
      pooled,
      hazBins,
      lr,
      fits,
      stepTimes,
      tEnd,
      nTotal: Number(params.n),
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
        /* One step = a 350ms GLIDE to the next recorded time (round 6 —
           the cursor used to teleport and every curve snapped). Returning
           true buys the frames; the glide stops at ONE time point, which
           is what keeps this inside the step contract (the widget-15
           walk-the-whole-axis bug was stopping nowhere). Reduced motion
           is core's fastForward at dt = 400 — one pump completes it. */
        if (anim.stepTarget === undefined) {
          const next = state.stepTimes[timeKey(params.concept)].find((t) => t > anim.t + 1e-9);
          anim.stepTarget = next !== undefined ? next : tEnd;
          anim.stepFrom = anim.t;
          anim.stepMs = 0;
        }
        anim.stepTarget = Math.min(anim.stepTarget, tEnd);
        anim.stepMs += dt;
        const p = Math.min(1, anim.stepMs / 350);
        anim.t = anim.stepFrom + (anim.stepTarget - anim.stepFrom) * p;
        if (p >= 1) {
          anim.t = anim.stepTarget;
          delete anim.stepTarget;
          delete anim.stepFrom;
          anim.done = anim.t >= tEnd;
          return false;
        }
        return true;
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
    /* THE SCRUB (round 11): dragging on a time panel hands the reader the
       clock. anim only — no parameter is written; a playhead was never in
       the URL. On Finding factors only the compact curves scrub — a drag
       on the forest must not move time. */
    scrubHit: ({ x, y, w, params }) => {
      const left = 56;
      const right = w - 14;
      if (x < left - 8 || x > right + 8) return false;
      if (params.concept === "factors") {
        return y > FCURVE_Y - 14 && y < FCURVE_Y + FCURVE_H + 30;
      }
      return true;
    },
    scrub: (anim, { x, w, params, state }) => {
      const left = 56;
      const right = w - 14;
      const axis = params.concept === "censoring" ? T1MAX : T2MAX;
      const tEnd = state.tEnd[timeKey(params.concept)];
      const tt = Math.max(0, Math.min(((x - left) / (right - left)) * axis, tEnd));
      delete anim.stepTarget;
      delete anim.stepFrom;
      anim.t = tt;
      anim.done = tt >= tEnd - 1e-9;
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    renderBridge(params);
    const t = anim?.t ?? 0;
    if (params.concept === "censoring") drawCensoring(ctx, colors, w, params, state, t, pointer);
    else if (params.concept === "groups") drawGroups(ctx, colors, w, params, state, t, pointer);
    else drawFactors(ctx, colors, w, params, state, t, anim);
  },

  readout({ params, state, anim }) {
    const t = anim?.t ?? 0;
    if (params.concept === "censoring") {
      const treatment = params.censored;
      const atRisk = state.fiveT.filter((v) => v > t).length;
      const events = state.fiveT.filter((v, i) => state.fiveS[i] === 1 && v <= t).length;
      const S = readS(state.five[treatment].steps, t);
      return [
        { label: "At risk", value: String(atRisk), note: "patients still being followed" },
        { label: "Events", value: String(events), note: "each steps the curve down by 1 over the number at risk" },
        {
          label: "Survival",
          value: fmt(S, 2),
          note: treatment === "kept"
            ? "the Kaplan–Meier estimate at the cursor"
            : "with the censored removed — compare the kept curve",
        },
      ];
    }
    if (params.concept === "groups") {
      return [
        { label: "Events", value: `${state.events} of ${state.nTotal}`, note: "the rest are censored — the study ends before their event" },
        {
          label: "Log-rank p",
          value: state.lr.p < 1e-4 ? "< 0.0001" : fmt(state.lr.p, 4),
          /* the derivation, in the literature's own sentence (Bland &
             Altman), with the numbers computed from the test itself */
          note: `if the groups shared one curve, each event would fall by the risk sets — about ${Math.round(state.lr.exp[1])} in the disease group; ${state.lr.obs[1]} happened`,
        },
        {
          label: "Hazard ratio",
          value: fmt(state.fits.d.byName.disease.hr, 2),
          /* "hazard", not "event rate" (round 12) — the two panels above
             this tile both label the quantity hazard; one word */
          note: "the disease group's hazard multiplied — the same factor at every time",
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
      return `${state.nPat} patients followed over time: ${state.nPat - state.nCens} events, ${state.nCens} censored. A Kaplan–Meier curve built to time ${fmt(t, 1)}, survival ${fmt(S, 2)}, with a hazard bar at each event time showing the share of those at risk who had the event.`;
    }
    if (params.concept === "groups") {
      return `Kaplan–Meier curves for ${state.nTotal} simulated patients by disease group, ${state.events} events, log-rank p ${state.lr.p < 1e-4 ? "below 0.0001" : fmt(state.lr.p, 4)}, and the hazard ratio ${fmt(state.fits.d.byName.disease.hr, 2)} shown as one factor scaling the hazard in every interval.`;
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
    return `A Cox model of the ${state.nTotal} simulated patients on ${label}, drawn as a forest of hazard ratios with the reference line at 1.`;
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

/* --- the hover inspector (round 11) ---------------------------------------- *
 * A guide line at the hovered year and ONE reading of the figure, composed
 * of coloured segments. Clamped to the built portion of the curve — hovering
 * ahead of the cursor must not leak the future. Everything it shows also
 * lives in the tiles or on the marks: the lecture screen has no hover, so
 * the inspector is a convenience, never the carrier. */
function drawInspector(ctx, colors, { pointer, left, right, axis, tCap, yTop, yBot, textY, segsAt }) {
  if (!pointer) return;
  if (pointer.x < left - 4 || pointer.x > right + 4 || pointer.y < yTop || pointer.y > yBot) return;
  const tt = Math.max(0, Math.min(((pointer.x - left) / (right - left)) * axis, tCap));
  const gx = left + (tt / axis) * (right - left);
  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(gx, yTop);
  ctx.lineTo(gx, yBot);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "alphabetic";
  const segs = segsAt(tt);
  const total = segs.reduce((sum, [, txt]) => sum + ctx.measureText(txt).width, 0);
  let sx = right - total;
  ctx.textAlign = "left";
  for (const [color, txt] of segs) {
    ctx.fillStyle = color;
    ctx.fillText(txt, sx, textY);
    sx += ctx.measureText(txt).width;
  }
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
function drawCensoring(ctx, colors, w, params, state, t, pointer) {
  const left = 56;
  const right = w - 14;
  const X = (v) => left + (v / T1MAX) * (right - left);
  const treatment = params.censored;

  /* the lanes — the notebook's table, drawn. Under "dropped" the censored
     lanes fade: removed from the data is something you can SEE. */
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `${colors.fsSm} ${colors.font}`;
  for (let i = 0; i < state.nPat; i += 1) {
    const y = LANES_Y + i * LANE_GAP;
    const gone = treatment === "dropped" && state.fiveS[i] === 0;
    ctx.globalAlpha = gone ? 0.25 : 1;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "right";
    ctx.fillText(P_IDS[i], left - 12, y);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), y);
    ctx.lineTo(X(state.fiveT[i]), y);
    ctx.stroke();
    if (state.fiveS[i] === 1) {
      ctx.fillStyle = colors.event;
      ctx.beginPath();
      ctx.arc(X(state.fiveT[i]), y, 4, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillStyle = colors.surface;
      ctx.strokeStyle = colors.unknown;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(state.fiveT[i]), y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    /* name the censoring, on the lane — the open circle alone reads as
       "survived", which is the misconception this widget exists to break */
    if (CENSOR_WHY[i] && state.fiveS[i] === 0) {
      ctx.fillStyle = colors.unknown;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText(CENSOR_WHY[i], X(state.fiveT[i]), y + 13);
      ctx.font = `${colors.fsSm} ${colors.font}`;
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* the curve */
  const rect = { x: left, y: curve1Y(state.nPat), w: right - left, h: CURVE1_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T1MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 2.5, 5, 7.5, 10] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });
  /* every treatment names its MECHANISM — what happens to the censored,
     BY NAME (computed: the censored set is a control now), in the
     numerator and the denominator — never a verdict (2.9) */
  if (state.nCens === 0) plot.note("no patient is censored — the two readings agree");
  else if (treatment === "dropped") plot.note(`${state.censPhrase} leave both the event count and the risk set — as if never enrolled`);
  else plot.note(`${state.censPhrase} stay in the risk set until they leave, and never enter the events`);

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
  const HY = hazY(state.nPat);
  const hy = (v) => HY + HAZ_H - v * HAZ_H;
  const bars = R[treatment].steps;
  const ghostBars = treatment === "kept" ? null : R.kept.steps;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("Hazard at each event — of those still at risk, the share who go now", left, HY - 24);
  /* the formula chip (round 4, F1): the words above, the letter here —
     the same h the product line multiplies */
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.fillText("h = events ÷ at risk", right, HY - 10);
  /* the direction line (F3) — a comparison against the visible kept bars,
     never a claim about the unknowable truth (2.11) */
  if (treatment === "dropped") {
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText("smaller risk sets: bars higher than kept, survival lower", left, HY - 10);
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
    const inside = hy(hVal) - 5 < HY + 8;
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
    const S = passed.reduce((acc, s) => acc * (1 - s.events / s.atRisk), 1);
    /* expanded while it fits the 550px panel (measured: six factors is the
       edge); past that the identity stays and the expansion goes */
    const line = passed.length <= 5
      ? `survival = product of (1 − h): ${passed.map((s) => `(1−${s.events}/${s.atRisk})`).join("")} = ${fmt(S, 2)}`
      : `survival = product of (1 − h) over ${passed.length} events = ${fmt(S, 2)}`;
    ctx.fillStyle = colors.ink2;
    ctx.textAlign = "left";
    ctx.fillText(line, left, hy(0) + 24);
  }
  ctx.restore();

  drawCursor(ctx, colors, X(Math.min(t, T1MAX)), LANES_Y - 12, hy(0), t, state.tEnd.censoring);

  drawInspector(ctx, colors, {
    pointer,
    left,
    right,
    axis: T1MAX,
    tCap: Math.min(t, state.tEnd.censoring),
    yTop: LANES_Y - 6,
    yBot: hy(0),
    textY: curve1Y(state.nPat) + 14,
    segsAt: (tt) => {
      const inData = treatment === "dropped"
        ? state.fiveT.filter((v, i) => state.fiveS[i] === 1)
        : state.fiveT;
      const risk = inData.filter((v) => v >= tt).length;
      const S = readS(state.five[treatment].steps, tt);
      return [[colors.ink2, `year ${fmt(tt, 1)} · at risk ${risk} · survival ${fmt(S, 2)}`]];
    },
  });
}

/* --- shared: the two group curves, clipped to the cursor ------------------- */
function drawGroupCurves(ctx, colors, plot, state, t, { bands = false, labels = true, ticks = true } = {}) {
  const groupColor = [colors.groupA, colors.groupB];
  state.groups.forEach((g, i) => {
    if (bands) drawBand(ctx, plot, g.kept.steps, t, groupColor[i]);
    drawCurve(ctx, plot, g.kept.steps, g.kept.censors, t, groupColor[i], { width: 2.5, ticks, surface: colors.surface });
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
function drawGroups(ctx, colors, w, params, state, t, pointer) {
  const left = 56;
  const right = w - 14;
  const rect = { x: left, y: KM2_Y, w: right - left, h: KM2_H };
  const plot = makePlot({ ctx, colors, rect, xDomain: [0, T2MAX], yDomain: [0, 1] });
  plot.axisX({ label: "time (years)", ticks: [0, 5, 10, 15] });
  plot.axisY({ label: "survival probability", ticks: [0, 0.25, 0.5, 0.75, 1] });
  plot.caption(`${state.nTotal} simulated patients, followed for up to ${params.follow} years`);
  /* the CI's derivation intuition, one sentence (round 7) — the band is
     the same shrinking risk sets, expressed as doubt */
  if (params.bands) plot.note("each share is estimated from those still at risk — fewer patients, wider band");
  /* the null, under the group curves: both groups leave it, in opposite
     directions, and the p is about how far */
  if (params.shared) {
    drawCurve(ctx, plot, state.pooled.steps, [], t, colors.theory, { dash: [6, 4], width: 1.5, ticks: false });
  }
  drawGroupCurves(ctx, colors, plot, state, t, { bands: params.bands });
  drawCursor(ctx, colors, plot.sx(Math.min(t, T2MAX)), KM2_Y - 12, plot.sy(0), t, state.tEnd.groups);

  drawInspector(ctx, colors, {
    pointer,
    left,
    right,
    axis: T2MAX,
    tCap: Math.min(t, state.tEnd.groups),
    yTop: KM2_Y - 6,
    yBot: HR_TOP + HR_HEAD + 8 + HR_H,
    textY: KM2_Y + 14,
    segsAt: (tt) => {
      const risk = (g) => state.groups[g].times.filter((v) => v >= tt).length;
      const S = (g) => readS(state.groups[g].kept.steps, tt);
      return [
        [colors.ink2, `year ${fmt(tt, 1)} · at risk `],
        [colors.groupA, String(risk(0))],
        [colors.ink2, " / "],
        [colors.groupB, String(risk(1))],
        [colors.ink2, ` · survival `],
        [colors.groupA, fmt(S(0), 2)],
        [colors.ink2, " / "],
        [colors.groupB, fmt(S(1), 2)],
      ];
    },
  });

  /* THE HAZARD BY INTERVAL (round 5, replacing the H4 rates panel on
     Kenneth's review — "what are the bars? the x axis is not aligned").
     Tab 1's own quantity, h = events ÷ at risk, per group per 2-year
     interval, drawn with THE CURVE'S OWN sx SO THE AXES CANNOT DISAGREE —
     the stacked-panels-share-an-axis contract tab 1 established. The
     person-time rates, the dashed ×HR claim boxes and the per-bin ratio
     labels are gone: three simultaneous new ideas that confused more than
     they taught. The hazard ratio survives as one sentence and the tile. */
  const bins = state.hazBins;
  const withEvents = bins.filter((b) => b.ev0 + b.ev1 > 0);
  const above = withEvents.filter((b) => b.h1 >= b.h0).length;
  const binsDone = bins.length && t >= bins[bins.length - 1].hi;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillText("Hazard by interval — of those still at risk, the share who go now", left, HR_TOP);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  /* the claim is COUNTED from the drawn bins, so it cannot be false on any
     draw or effect setting (at None the count can honestly read "3 of 7")
     — and it waits for the sweep to finish the bins, so it never describes
     bars not yet on screen */
  if (binsDone && withEvents.length) {
    ctx.fillText(
      above === withEvents.length
        ? "disease sits above no-disease in every interval"
        : `disease sits above no-disease in ${above} of ${withEvents.length} intervals`,
      left,
      HR_TOP + 16,
    );
  }
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "right";
  ctx.fillText("h = events ÷ at risk", right, HR_TOP + 16);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink2;

  const bTop = HR_TOP + HR_HEAD + 8;
  const by = (v) => bTop + HR_H - v * HR_H;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(left, by(v));
    ctx.lineTo(right, by(v));
    ctx.stroke();
    ctx.fillStyle = colors.ink3;
    ctx.textAlign = "right";
    ctx.fillText(fmt(v, 1), left - 6, by(v) + 3);
  }
  ctx.textAlign = "center";
  /* [0..15], not [0..20] — the axis is fixed at 16 now (round 12); the 20
     used to paint off-plot, right of the panel */
  for (const v of [0, 5, 10, 15]) ctx.fillText(String(v), plot.sx(v), by(0) + 14);
  /* the bars grow WITH the sweep: height = events seen so far in the
     interval ÷ at risk at its start — true at every frame, and equal to
     the final h once the cursor clears the interval */
  for (const b of bins) {
    if (t <= b.lo) continue;
    const w2 = plot.sx(b.hi) - plot.sx(b.lo);
    const bw = Math.min(18, w2 / 2 - 4);
    const mid = (plot.sx(b.lo) + plot.sx(b.hi)) / 2;
    const h0 = b.ev0T.filter((et) => et <= t).length / b.n0;
    const h1 = b.ev1T.filter((et) => et <= t).length / b.n1;
    ctx.fillStyle = colors.groupA;
    ctx.fillRect(mid - bw - 2, by(h0), bw, by(0) - by(h0));
    ctx.fillStyle = colors.groupB;
    ctx.fillRect(mid + 2, by(h1), bw, by(0) - by(h1));
  }
  ctx.fillStyle = colors.ink3;
  ctx.textAlign = "left";
  ctx.fillText(
    bins.length
      ? `intervals end at ${bins[bins.length - 1].hi} years — beyond, fewer than 10 remain at risk in a group`
      : "too few still at risk for interval bars — a group starts below 10",
    left,
    by(0) + 28,
  );
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
  plot.axisX({ ticks: [0, 5, 10, 15] });
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
  /* small studies break a 12-coefficient fit (measured: 24/50 draws at
     n = 30 give a runaway HR) — when it happens here, say so rather than
     letting an off-axis whisker pass for a finding */
  const keyNow = keyOf(params);
  if (keyNow && Object.values(state.fits[keyNow].byName).some((c) => c.hr > 50 || c.hr < 0.02)) {
    ctx.fillStyle = colors.extreme;
    ctx.fillText("too few patients to pin this many coefficients — some intervals run off the axis", 14, CARD_TOP + 44);
  }
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
  /* the HR > 1 / HR < 1 reading, drawn (round 12, pick L1): the axis says
     which way is worse, flanking the caption the eye already reads */
  ctx.textAlign = "left";
  ctx.fillText("← hazard lower", rp.x, rp.y + H + 27);
  ctx.textAlign = "right";
  ctx.fillText("hazard higher →", rp.x + rp.w, rp.y + H + 27);
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
