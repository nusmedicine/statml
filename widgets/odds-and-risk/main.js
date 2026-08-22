/* ============================================================================
   Odds ratio and relative risk — widget 12.

   Hosts at `04 / 04-08 — Comparing Counts Between 2x2 Categories`, effect-size
   section and Caution section; and again at `04 / 05-05 — Modeling: Categorical
   Outcome`, which derives exp(b) as an odds ratio and hands students one to
   read.

   MISCONCEPTION TARGETED, documented rather than assumed: that an odds ratio
   reports how much MORE LIKELY an outcome is. Holcomb 2001 found 26% of OB/GYN
   papers asserting an "X-fold risk" from an odds ratio, with the gap over 20% in
   44% of those. Schulman 1999 reported referral 90.6% vs 84.7% as OR 0.60;
   national media printed "40% less likely" when the truth was 6.5%. The host
   lesson's own cell 40 states it wrongly too.

   ---------------------------------------------------------------------------
   REBUILT AFTER REVIEW, and the three things that changed are the design.

   1. YOU SET THE FOUR COUNTS. The first build had a "baseline risk" and a "true
      risk ratio" as inputs — which says there is a population parameter and we
      are sampling from it, and NOTHING HERE SAMPLES ANYTHING. The counts are
      exact. Two sliders now set how many died in each arm, and the risk ratio
      and odds ratio are the only numbers on screen the reader did not set.
      A ratio is the one thing in this topic that must always be an output.

   2. THE TABS ARE STUDY DESIGNS, NOT SECTIONS. They used to read "Two
      denominators" and "Why the odds ratio" — my own section headings leaking
      onto the screen as controls, and the first thing a reader tripped over.
      Cohort and Case-control are things a student already recognises, and
      switching between them is itself the lesson rather than a way to reach it.

   3. THE CONTROL NAMES THE ACT, NOT THE JARGON. "Measure the deaths against
      everyone / the survivors" — and then *risk* and *odds* appear on the
      figure as the RESULT of having done that.

   ---------------------------------------------------------------------------
   WHY A RISK RATIO NEEDS A COHORT, WITHOUT ALGEBRA.

   A cohort starts with the exposure and waits: you pick 100 infected and 100
   not, and you COUNT who dies. A case-control starts with the outcome and looks
   back: you pick the people who died and some who did not, and you COUNT who
   was infected.

   So switch to Case-control and drag the enrolment down. The death rate in your
   study climbs to 81% — not because the disease got worse, but because you
   stopped enrolling survivors. A DEATH RATE YOU SET WITH A BUDGET SLIDER IS NOT
   A FINDING, and the risk ratio built out of two of them goes 2.00 -> 1.22.
   The odds ratio sits at 2.67 the whole way, which is the answer to "then what
   do I report".

   The earlier build argued this with brackets and the regrouping identity
   (a/b)/(c/d) = (a/c)/(b/d). That is the deep reason and it is too much: it
   needs the reader to hold four cells and two groupings at once before the
   point arrives. The death-rate line gets there in one sentence.

   ---------------------------------------------------------------------------
   NOTHING ANIMATES THE STUDY, BECAUSE THE STUDY IS OVER. An earlier build
   followed the cohort up ten patients at a time, which put a stopwatch on the
   part of epidemiology nobody watches. What moves is the READING — and the tab
   switch, where the survivors you did not enrol empty out of the same picture.
   That needed core principles 4.4 (a display change may deserve a transition)
   and 4.5 (a widget may decline a drive button).
   ========================================================================= */

import { defineWidget } from "../core/index.js";

/** People per exposure arm. 100, so every risk is countable as "out of 100". */
const N = 100;

/* HOW MANY CONTROLS YOU ENROL PER CASE — the number epidemiologists actually
   argue about, and they argue about it for statistical power, not because of the
   disease.

   This replaced "thin the survivors 1 in k", which was a real sampling scheme
   and a badly chosen parameterisation: at k = 1 it IS the cohort, so the slider
   made the distinction look like it was about sampling fraction when it is about
   which margin you fixed. It also spoke a language no investigator uses.
   Reported as exactly that confusion — *if I put 100 cases and 100 controls it
   looks like a cohort, am I misunderstanding something?* No. */
const ENROL = {
  "1to1": { label: "1 : 1", r: 1, detail: "as many controls as cases — half your study died, by construction" },
  "1to2": { label: "1 : 2", r: 2, detail: "" },
  "1to4": { label: "1 : 4", r: 4, detail: "past about 1:4 the extra controls buy almost no power" },
};

const EASE_MS = 420;
const STUDY_MS = 2600;   /* one run of the design tab, start to finish */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/* --- the table, derived in ONE place --------------------------------------
   Every ratio anywhere in the widget reads from `ratios()`, so the figure, the
   readout and the accessible summary cannot come to disagree about what an odds
   ratio is (principle 5.8). */
function ratios({ a, b, c, d }) {
  /* PLAIN DIVISION, no zero guards. IEEE already distinguishes the three cases
     and my guards were destroying the distinction: `0/0` is NaN (undefined) and
     `0.4/0` is Infinity, but `riskU === 0 ? Infinity : ...` turned BOTH into
     infinity. Drag both sliders to 0 — nobody dies in either arm — and the
     figure claimed the odds ratio was ∞. It is not; it does not exist. Both
     degenerate corners are two drags from the default. */
  const riskE = a / (a + b);
  const riskU = c / (c + d);
  const oddsE = a / b;
  const oddsU = c / d;
  return {
    a, b, c, d, riskE, riskU, oddsE, oddsU,
    rr: riskE / riskU,
    or: oddsE / oddsU,
    deathRate: (a + c) / (a + b + c + d),
  };
}

/** The full cohort: what actually happened to 200 patients. */
function cohortOf(params) {
  return ratios({ a: params.died1, b: N - params.died1, c: params.died0, d: N - params.died0 });
}

/**
 * What the chosen design let you SEE of the source population.
 *
 * BOTH STUDIES DRAW FROM THE SAME POPULATION and neither is the population. The
 * cohort follows 100 exposed and 100 unexposed, chosen by EXPOSURE, and counts
 * the outcome. The case-control enrols every case and `r` controls per case,
 * chosen by OUTCOME, and looks back at the exposure — so its controls come from
 * the wider population, which is why the ratio can exceed the survivors the
 * cohort happened to follow. That is also why case-control studies exist: you
 * cannot follow everyone when the outcome is rare.
 *
 * The cases carry their exposure split exactly, because every case is enrolled.
 * The controls are split in the population's b : d proportion and rounded — you
 * cannot enrol 25.7 controls, and a printed number that disagrees with the dots
 * above it is the defect principle 2.8 exists to prevent.
 */
function studyOf(params) {
  const a = params.died1;
  const c = params.died0;
  const b = N - a;
  const d = N - c;
  if (params.design !== "case-control") return ratios({ a, b, c, d });

  const controls = (a + c) * ENROL[params.ratio].r;
  const B = b + d === 0 ? 0 : Math.round((controls * b) / (b + d));
  return ratios({ a, b: B, c, d: controls - B });
}

/* --- geometry ------------------------------------------------------------- */
const COLS = 5;
const PITCH = 7.6;
const DOT_R = 2.9;
const COL_W = COLS * PITCH;
const SPLIT_DX = 52;
const FLOOR = 362;

/* The division, written out under each arm: the same people again as the two
   terms of a fraction, packed ten to a row. The numerator is the deaths and is
   IDENTICAL in both readings; the denominator is everyone, and measuring
   against the survivors instead drops its red dots one at a time.

   That drop-out is the whole reason the graphic is here rather than just the
   sentence. It shows something no wording does: risk's numerator sits INSIDE
   its denominator and odds' sits beside it, which is why only one of the two
   can pass 1. Set 90 and 45 and the exposed arm reads 90 over 10 = 9.00 — and
   a risk never could. */
const FR_PER_ROW = 10;
const FR_PITCH = 6.6;
const FR_R = 2.5;
const FR_W = FR_PER_ROW * FR_PITCH;
const RULE_Y = 478;

/**
 * Where person `i` of an arm stands. Deaths fill from the floor upward and
 * NEVER move; survivors sit on top of them when the deaths are measured against
 * everyone, and step aside onto the same floor when they are measured against
 * the survivors. That the numerator does not move is the whole claim the figure
 * makes with motion rather than words.
 */
function personXY(i, died, gx, q) {
  const merged = (() => {
    const row = Math.floor(i / COLS), col = i % COLS;
    return [gx + PITCH / 2 + col * PITCH, FLOOR - PITCH / 2 - row * PITCH];
  })();
  if (i < died) return merged;
  const j = i - died;
  const row = Math.floor(j / COLS), col = j % COLS;
  const split = [gx + SPLIT_DX + PITCH / 2 + col * PITCH, FLOOR - PITCH / 2 - row * PITCH];
  return [lerp(merged[0], split[0], q), lerp(merged[1], split[1], q)];
}

/** One term of the fraction. `dir` -1 grows up from the rule, +1 grows down. */
function fracBlock(ctx, gx, yEdge, list, dir) {
  const rows = Math.ceil(list.length / FR_PER_ROW);
  for (let i = 0; i < list.length; i += 1) {
    const row = Math.floor(i / FR_PER_ROW);
    const col = i % FR_PER_ROW;
    const x = gx + FR_PITCH / 2 + col * FR_PITCH;
    const y = dir < 0
      ? yEdge - FR_PITCH / 2 - (rows - 1 - row) * FR_PITCH
      : yEdge + FR_PITCH / 2 + row * FR_PITCH;
    ctx.beginPath();
    ctx.arc(x, y, FR_R, 0, Math.PI * 2);
    ctx.fillStyle = list[i];
    ctx.fill();
  }
}

function text(ctx, colors, s, x, y, { size = "xs", tone = "ink2", align = "left", bold = false, mono = false } = {}) {
  ctx.save();
  const px = size === "fig" ? colors.fsFig : size === "lg" ? colors.fsLg : size === "md" ? colors.fsMd
    : size === "sm" ? colors.fsSm : colors.fsXs;
  ctx.font = `${bold ? "600 " : ""}${px} ${mono ? "var(--font-mono), monospace" : colors.font}`;
  ctx.fillStyle = tone === "ink1" ? colors.ink1 : tone === "ink3" ? colors.ink3
    : tone === "event" ? colors.event : colors.ink2;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Wrapped prose. A canvas overrun ERASES what it crosses rather than blending,
    so it still looks like text and hashes consistently for ever. */
function wrapText(ctx, colors, s, x, y, maxW, opts = {}) {
  const px = opts.size === "md" ? colors.fsMd : opts.size === "sm" ? colors.fsSm : colors.fsXs;
  ctx.save();
  ctx.font = `${opts.bold ? "600 " : ""}${px} ${colors.font}`;
  const lines = [];
  let line = "";
  for (const word of String(s).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  ctx.restore();
  const lh = Math.round(parseFloat(px) * 1.45);
  lines.forEach((l, i) => text(ctx, colors, l, x, y + i * lh, opts));
  return y + lines.length * lh;
}

/* NaN and Infinity are different failures and must not print the same. Set both
   sliders to 0 and the risk ratio is 0/0 — undefined, not infinite — and a
   figure that says the odds ratio is ∞ when nobody died is telling a lie the
   sliders can reach in two drags. */
/* --- the study-design tab's geometry ---------------------------------------
   DECLARED HERE, ABOVE `defineWidget`. It calls `draw` during its own top-level
   run, so a `const` further down the file is still in its temporal dead zone and
   the widget dies on load with "cannot access before initialization". Function
   declarations hoist; const does not. */
/* The design tab's dot scale is DERIVED from the fullest box in the figure, not
   fixed, and printed once. A case-control enrolling four controls per case can
   hold several hundred people, and a fixed scale either overflows the box there
   or wastes it everywhere else. */
const DOT_STEPS = [1, 2, 5, 10, 20, 25, 50];
const DOTS_MAX = 40;
function dotScale(counts) {
  const most = Math.max(1, ...counts);
  return DOT_STEPS.find((k) => most / k <= DOTS_MAX) ?? 50;
}
/* Sized so TWO panels fit the 550px canvas the side layout bottoms out at: a
   panel is BOX_W + STEP_DX + BOX_W = 222, against the 247 each half gets. The
   first pass used 116-wide boxes and a 74px step gap, which needed 306 and put
   the right-hand boxes 41px off the edge. */
/* Two panels must fit the 550px canvas: BOX_W + STEP_DX + BOX_W = 242 against
   the 247 each half gets. BOX_W is 104 rather than 88 because the LABEL AND ITS
   COUNT now share one line and both have to fit above the box they name. */
const BOX_W = 104, BOX_H = 88, DES_DY = 118, STEP_DX = 34;
/* 7 per row at pitch 11 keeps the fullest box — 200 people, 40 dots, which the
   cohort's "lived" reaches when nobody dies — inside its own border. At 6 per
   row it was 7 rows and spilled 15px out the bottom. */
const DOTS_PER_ROW = 8, DOT_PITCH = 11;

const easeSeg = (t, lo, hi) => {
  const u = clamp01((t - lo) / (hi - lo));
  return u * u * (3 - 2 * u);
};

/**
 * The two chrome rules `when` cannot express, in one place.
 *
 * BOTH `hidden` AND `style.display` ARE SET. `hidden` is only a user-agent
 * default and loses to any explicit display — which is how a legend once stayed
 * on screen while every DOM check agreed it was gone.
 */
function syncRail(params) {
  const off = (el, hide) => {
    if (!el) return;
    el.hidden = hide;
    el.style.display = hide ? "none" : "";
  };
  /* Play belongs to the design tab; the calculation has nothing to run. Core
     decides which BUTTONS exist and cannot know that. */
  off(document.querySelector(".w-drive"), params.view !== "design");
  /* Enrolment drives the case-control panel on the design tab, and the sampled
     table on the calculation tab — but on the calculation tab it means nothing
     while the design is a cohort, and a control that changes nothing is a
     control that should not be there (3.5). */
  off(
    document.getElementById("f-ratio")?.closest(".w-field"),
    params.view === "calculate" && params.design !== "case-control"
  );
}

const fmtRatio = (v) => (Number.isNaN(v) ? "—" : !Number.isFinite(v) ? "∞" : v >= 10 ? v.toFixed(1) : v.toFixed(2));
const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—");

defineWidget({
  slug: "odds-and-risk",
  title: "Odds Ratio and Relative Risk",
  subtitle:
    "The same deaths, divided by two different things. An odds divides them by the "
    + "survivors and a risk divides them by everyone — so the odds ratio is always "
    + "further from 1, and further still the commoner the outcome.",
  layout: "side",
  status: "draft",
  /* 600: the deepest text at the 550px canvas — where the claim wraps worst —
     sits at baseline 586, measured across every corner rather than guessed. */
  /* Measured, not guessed: the deepest text at the 550px canvas — where the claim
     wraps worst — sat at baseline 686 before the strip grew by 40px. */
  height: ({ view }) => (view === "design" ? 506 : 758),

  params: {
    /* THE FIRST TAB IS THE STUDY DESIGN AND IT IS THE DEFAULT. A reader arriving
       at this widget is being asked to hold two ideas that are usually taught
       apart — what kind of study this was, and how you divide its counts — and
       the second one only makes sense after the first. The design was a strip
       above the figure and then a diagram above the figure, and neither was
       enough: it is a whole idea and it gets a whole panel.

       Two tabs, not three. Cohort and case-control live inside the calculation
       as an ordinary control, because there they select a table; on the design
       tab both are on screen at once, because there the whole point is the
       comparison. */
    view: {
      type: "segmented",
      label: "",
      options: [
        { value: "design", label: "Study design" },
        { value: "calculate", label: "The calculation" },
      ],
      default: "design",
      display: true,
    },

    design: {
      type: "segmented",
      label: "Study design",
      options: [
        { value: "cohort", label: "Cohort" },
        { value: "case-control", label: "Case-control" },
      ],
      default: "cohort",
      when: { param: "view", equals: "calculate" },
      display: true,
    },

    /* THE FOUR COUNTS, SET DIRECTLY. Marked `display` for the same reason the
       toggles are: `display: true` means "recompute and keep the student's
       work", and the rule it would otherwise fall under exists because a pile
       built from OTHER SAMPLES is a lie about what was drawn. Nothing here is
       drawn — the table is these two numbers and subtraction. */
    died1: {
      type: "int", label: "Died, with infection", min: 0, max: N, default: 20, display: true,
    },
    died0: {
      type: "int", label: "Died, without infection", min: 0, max: N, default: 20, display: true,
    },

    /* THE BUTTON NAMES THE RESULT; THE DETAIL LINE NAMES THE ACT.

       This was the other way round — "Measure the deaths against · Everyone /
       The survivors" — on the theory that a control should name what it does
       rather than the jargon. It reads well and it does not TEACH, because
       nothing on screen then connects the choice to the two ratio cards at the
       bottom: a reader is left asking which of them they are supposed to be
       looking at. The buttons are the two things the widget exists to
       distinguish, so they should be the two things you press. The denominator
       is one line underneath, and `segmented` renders it as visible copy. */
    against: {
      type: "segmented",
      label: "Which ratio are you building?",
      /* ODDS RATIO FIRST, matching `04-08`, which derives the odds ratio in its
         cell 35 and the relative risk six cells later. A widget that hosts in a
         lesson should meet the reader in the order the lesson does. */
      options: [
        { value: "odds", label: "Odds ratio", detail: "an odds divides the deaths by THE SURVIVORS, so each arm's denominator shrinks" },
        { value: "risk", label: "Relative risk", detail: "a risk divides the deaths by EVERYONE, so each arm is out of 100" },
      ],
      default: "odds",
      when: { param: "view", equals: "calculate" },
      display: true,
    },

    ratio: {
      type: "choice",
      label: "Controls per case",
      options: Object.entries(ENROL).map(([value, o]) => ({ value, label: o.label, detail: o.detail })),
      default: "1to1",
      /* NO `when`. This field belongs on the design tab (where it drives the
         case-control panel and is the argument: change your budget, watch the
         death rate move) AND on the calculation tab, but only there when the
         design is case-control. That is two conditions, and `when` takes one —
         so the widget manages this one field from `draw`, the way widget 11
         manages its rail. The rule is in `syncRail` and nowhere else. */
      display: true,
    },

    /* No seed: nothing is drawn, so there is no random stream to reproduce and a
       seed slider would be a control that changes nothing (principle 3.5).

       No `shown` either. It is the authored head start for a figure that builds
       itself, and this one does not — every state is reachable by URL because
       every state is just four counts and two toggles. */
  },

  legend: [
    { token: "event", label: "Died", mark: "dot" },
    { token: "nonevent", label: "Lived — and this is the odds' denominator", mark: "dot" },
  ],

  compute: ({ params }) => ({ cohort: cohortOf(params), study: studyOf(params) }),

  animation: {
    /* NO DRIVE BUTTONS AT ALL. There was a "Work it out" lead, on the reading of
       non-negotiable #4 that a widget must not open on its own answer — and it
       was the widget's worst piece of friction. Reported directly: change a
       slider, find the button greyed out, and the only way back is Reset, which
       throws away the numbers you had just set.

       #4 exists so a student BUILDS the answer instead of being handed it. Here
       there is nothing to build: the answer is a division of two numbers the
       student typed in themselves, so a button between the input and the
       arithmetic is a toll rather than a stage. What honours #4 instead is
       WHERE IT OPENS — both sliders at 20, no effect, both ratios exactly 1.00.
       The figure opens on the null case, which is the opposite of its answer,
       and the very first drag is what makes the two numbers separate.

       `stepLabel: null` and `runLabel: null` decline the other two (4.5); the
       drive row is Reset alone. */
    /* Play belongs to the DESIGN tab, where two studies get run. Step is
       declined (4.5): a study is not something you take one patient of, and the
       calculation tab has nothing to advance at all — it hides the whole drive
       row from `draw`, the way widget 11 does on the views with nothing to
       drive. */
    stepLabel: null,
    runLabel: "Run both studies",
    runTitle: "Recruit each study's own group, then go and count the other side",

    init: ({ params }) => {
      const q = params.against === "odds" ? 1 : 0;
      const s = params.design === "case-control" ? 1 : 0;
      return { q, qT: q, s, sT: s, easing: false, t: 0, done: false };
    },

    advance: (anim, { dt, params }) => {
      if (anim.mode === "run" && params.view === "design") {
        anim.t = clamp01(anim.t + dt / STUDY_MS);
        anim.done = anim.t >= 1;
        return anim.t < 1;
      }
      /* Two independent eases — the survivors stepping aside, and the study
         design emptying out — each chasing its own target. Exponential rather
         than a normalised t, so an interruption resumes from where the figure
         actually is instead of jumping back to an origin. */
      const rate = Math.min(1, (dt / EASE_MS) * 2.6);
      let moving = false;
      for (const key of ["q", "s"]) {
        const gap = anim[`${key}T`] - anim[key];
        if (Math.abs(gap) < 0.003) { anim[key] = anim[`${key}T`]; continue; }
        anim[key] += gap * rate;
        moving = true;
      }
      return moving;
    },

    /* WHERE THE EASE IS DECIDED. `rebuild` runs on every display change and is
       not told which parameter moved, so the widget compares what it is showing
       against what the parameters now ask for. Setting `easing` is the request
       for frames; core clears it when it grants one (principle 4.4). */
    rebuild: (anim, { params }) => {
      anim.qT = params.against === "odds" ? 1 : 0;
      anim.sT = params.design === "case-control" ? 1 : 0;
      if (Math.abs(anim.qT - anim.q) > 0.003 || Math.abs(anim.sT - anim.s) > 0.003) {
        anim.easing = true;
      }
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    /* THE WIDGET OWNS THE DRIVE ROW, from draw, because core decides which
       BUTTONS exist and cannot know that one of two views has nothing to run.
       Both `hidden` and `display` are set: `hidden` is only a user-agent
       default and loses to any explicit display, which is how a legend once
       stayed on screen while every DOM check agreed it was gone. */
    syncRail(params);

    if (params.view === "design") {
      drawDesignTab(ctx, colors, w, h, params, state, anim?.t ?? 0);
      return;
    }
    drawFigure(ctx, colors, w, h, params, state, {
      q: anim?.q ?? (params.against === "odds" ? 1 : 0),
      s: anim?.s ?? (params.design === "case-control" ? 1 : 0),
    });
  },

  readout: ({ params, state }) => {
    const { cohort, study } = state;
    if (params.view === "design") {
      /* The design tab's own two numbers, and they are the argument: the same
         disease, and only one of the two death rates is a finding. */
      const ccStudy = studyOf({ ...params, design: "case-control" });
      return [
        { label: "Death rate, cohort", value: pct(cohort.deathRate), note: "you counted this" },
        { label: "Death rate, case-control", value: pct(ccStudy.deathRate),
          note: "your controls-per-case ratio, nothing else" },
        { label: "Same population", value: "both", note: "neither study changed anybody's illness" },
      ];
    }
    const cc = params.design === "case-control";
    const rrShift = cohort.rr === 0 || !Number.isFinite(cohort.rr) ? NaN : study.rr / cohort.rr - 1;

    return [
      {
        label: "Odds ratio",
        value: fmtRatio(study.or),
        /* THE CLAIM IS "ESTIMATES", NOT "UNCHANGED". Any case-control sample of a
           finite population rounds, and rounding moves the odds ratio a little —
           measured median 0.7% against the risk ratio's 7.9%. Six rounds of this
           widget claimed an exact invariance it never had, and papered the gap
           over with a footnote about whole people. Naming what the number IS
           retires the footnote by making it the point. */
        note: !cc ? "the two odds divided"
          : `estimates the population's ${fmtRatio(cohort.or)} — this is the one you can report`,
      },
      {
        label: "Relative risk",
        value: fmtRatio(study.rr),
        note: cc
          ? `NOT AN ESTIMATE OF ANYTHING — the population's is ${fmtRatio(cohort.rr)}`
            + (Number.isFinite(rrShift) ? ` (${rrShift >= 0 ? "+" : ""}${Math.round(rrShift * 100)}%)` : "")
          : "the two risks divided",
      },
      {
        label: cc ? "Death rate in your study" : "Read as a risk, the odds ratio adds",
        value: cc
          ? pct(study.deathRate)
          : (Number.isFinite(study.or / study.rr) ? `${Math.round((study.or / study.rr - 1) * 100)}%` : "—"),
        /* `Number.isFinite` is doing real work here: NaN and Infinity both fail
           it, which is what the "—" is for. */
        note: cc
          ? `your ratio, nothing else — the population's is ${pct(cohort.deathRate)}`
          : (study.rr === 1 ? "no effect: the two agree exactly" : "effect that is not there"),
      },
    ];
  },

  summary: ({ params, state }) => {
    const { study } = state;
    if (params.view === "design") {
      return "Two study designs side by side: a cohort recruits by exposure and counts the outcome, "
        + "a case-control recruits by outcome and looks back at the exposure.";
    }
    return `${study.a} of ${study.a + study.b} infected patients died and ${study.c} of ${study.c + study.d} `
      + `who were not. The relative risk is ${fmtRatio(study.rr)}; the odds ratio is ${fmtRatio(study.or)}.`;
  },
});

/* ========================================================================= */

/* ===========================================================================
   THE STUDY DESIGN TAB.

   Ported from `_lab/study-design.html`, which settled two things worth not
   re-deriving. BOTH PANELS READ LEFT TO RIGHT AND WHAT THEY READ OUT IS THE
   ORDER YOU DID THINGS IN: step 1 is the group you recruited, step 2 is what you
   then went and counted. A version faithful to the calendar instead — exposure
   left, outcome right in both, with a shared time arrow — made the two studies
   converge on the middle, and a reader said so. Reading order beat chronology.

   And A GHOST STAYS BEHIND in each recruited box. Letting it empty says the
   patients LEFT the group they were recruited into; the two ends are two
   sortings of the same people, and a person is in one box at each end at once.

   The case-control panel here enrols one survivor in two, fixed. This tab is a
   reminder, not a parameter study — the enrolment slider belongs to the
   calculation, where it changes an answer.
   ========================================================================= */

function desBox(ctx, colors, x, y, mine, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = mine ? colors.ink1 : colors.grid;
  ctx.lineWidth = mine ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(x, y, BOX_W, BOX_H, 5);
  ctx.stroke();
  ctx.restore();
}

function drawDesignPanel(ctx, colors, x0, kind, t, cohort, ccTable, scale, panelW) {
  const cc = kind !== "cohort";
  const st = cc ? ccTable : { a: cohort.a, b: cohort.b, c: cohort.c, d: cohort.d };
  const n = (v) => Math.round(v / scale);

  /* SHORT LABELS, so a count can share their line. "lived — the controls" is
     105px against a 104px box; "controls" is 44 and leaves room for the number
     that belongs to it. What the long labels were explaining is said once, on
     its own line under the panel heading. */
  const step1 = cc
    ? [{ label: "cases", total: st.a + st.c }, { label: "controls", total: st.b + st.d }]
    : [{ label: "infected", total: st.a + st.b }, { label: "not infected", total: st.c + st.d }];
  const step2 = cc
    ? [{ label: "infected", total: st.a + st.b }, { label: "not infected", total: st.c + st.d }]
    : [{ label: "died", total: st.a + st.c }, { label: "lived", total: st.b + st.d }];
  const flows = cc
    ? [{ f: 0, to: 0, n: n(st.a), k: "event" }, { f: 0, to: 1, n: n(st.c), k: "event" },
      { f: 1, to: 0, n: n(st.b), k: "nonevent" }, { f: 1, to: 1, n: n(st.d), k: "nonevent" }]
    : [{ f: 0, to: 0, n: n(st.a), k: "event" }, { f: 0, to: 1, n: n(st.b), k: "nonevent" },
      { f: 1, to: 0, n: n(st.c), k: "event" }, { f: 1, to: 1, n: n(st.d), k: "nonevent" }];

  const recruited = easeSeg(t, 0, 0.18);
  const travel = easeSeg(t, 0.2, 0.74);
  const arrived = easeSeg(t, 0.6, 0.92);

  /* Y0 IS 40 BELOW THE STEP HEADING, not 12. At 12 the heading and the box
     labels read as one block of text sitting on the boxes, and a reader said
     the words were obscuring the graphs. */
  const X1 = x0, X2 = x0 + BOX_W + STEP_DX, Y0 = 118;
  text(ctx, colors, cc ? "CASE-CONTROL" : "COHORT", x0, 30, { size: "sm", tone: "ink1", bold: true });
  text(ctx, colors, cc ? "recruit by outcome, then look back" : "recruit by exposure, then wait",
    x0, 46, { size: "xs", tone: "ink3" });
  if (cc) text(ctx, colors, "cases died · controls lived", x0, 62, { size: "xs", tone: "ink3" });
  text(ctx, colors, cc ? "1  recruit by OUTCOME" : "1  recruit by EXPOSURE", X1, 92,
    { size: "xs", tone: "highlight", bold: true });
  ctx.save();
  ctx.globalAlpha = Math.max(0.4, arrived);
  text(ctx, colors, cc ? "2  count the exposure" : "2  count the outcome", X2, 92,
    { size: "xs", tone: "ink2", bold: true });
  ctx.restore();

  const pos = (col, row) => [col === 0 ? X1 : X2, Y0 + row * DES_DY];
  for (const col of [0, 1]) {
    const group = col === 0 ? step1 : step2;
    for (const row of [0, 1]) {
      const [bx, by] = pos(col, row);
      const mine = col === 0;
      /* BOXES ARE FURNITURE AND ARE ALWAYS DRAWN. Fading them in with the
         animation left the whole left half invisible before Play was pressed,
         with its heading sitting above nothing — and every string was painting
         correctly at alpha 0, so no assertion could see it. */
      desBox(ctx, colors, bx, by, mine, mine ? 1 : 0.45);
      text(ctx, colors, group[row].label, bx, by - 8, { size: "xs", tone: mine ? "ink1" : "ink2", bold: mine });
      /* THE COUNT SHARES THE LABEL'S LINE, right-aligned to the box edge. Below
         the box it sits BETWEEN two boxes and labels neither — reported as
         exactly that confusion. Inside the box the dots reach it. On the label
         line, label and count are one phrase attached to one box, and short
         labels are what make the line fit. */
      const shown = mine ? recruited : arrived;
      if (shown > 0.5) {
        ctx.save();
        ctx.globalAlpha = shown;
        text(ctx, colors, String(group[row].total), bx + BOX_W, by - 8,
          { size: "sm", align: "right", tone: "ink1", bold: true });
        ctx.restore();
      }
    }
  }

  const out = [0, 0], into = [0, 0];
  for (const fl of flows) {
    const [sx0, sy0] = pos(0, fl.f);
    const [dx0, dy0] = pos(1, fl.to);
    const s0 = out[fl.f]; out[fl.f] += fl.n;
    const d0 = into[fl.to]; into[fl.to] += fl.n;
    for (let i = 0; i < fl.n; i += 1) {
      const si = s0 + i, di = d0 + i;
      const sx = sx0 + 9 + (si % DOTS_PER_ROW) * DOT_PITCH;
      const sy = sy0 + 11 + Math.floor(si / DOTS_PER_ROW) * DOT_PITCH;
      const dx = dx0 + 9 + (di % DOTS_PER_ROW) * DOT_PITCH;
      const dy = dy0 + 11 + Math.floor(di / DOTS_PER_ROW) * DOT_PITCH;
      const fill = fl.k === "event" ? colors.event : colors.nonevent;
      ctx.save();
      ctx.globalAlpha = recruited * 0.22;
      ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = recruited;
      ctx.beginPath();
      ctx.arc(lerp(sx, dx, travel), lerp(sy, dy, travel) - Math.sin(Math.PI * travel) * 12, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.restore();
    }
  }

  if (arrived > 0.6) {
    const total = st.a + st.b + st.c + st.d;
    const dead = st.a + st.c;
    ctx.save();
    ctx.globalAlpha = arrived;
    text(ctx, colors, `${dead} of your ${total} participants died`, x0, 366,
      { size: "sm", tone: "ink1", bold: true });
    /* WRAPPED TO THE PANEL, not the canvas. A per-panel note is 247px wide at
       the narrow layout, and "it is your controls-per-case ratio" is longer than
       that — it ran to the canvas edge and out of its own column. */
    wrapText(ctx, colors, cc ? "you chose that — it is your ratio, not the disease's"
      : "you counted that — it is a fact about the disease",
      x0, 384, panelW, { size: "xs", tone: cc ? "event" : "ink2" });
    ctx.restore();
  }
}

function drawDesignTab(ctx, colors, w, h, params, state, t) {
  const { cohort } = state;
  const tx = 28;
  const maxW = w - 2 * tx;
  const half = Math.floor(maxW / 2);

  /* The case-control table here is the one the CALCULATION tab shows, from the
     same `studyOf` — the two tabs must not model a case-control differently
     (5.8). One dot scale serves both panels, derived from the fullest box in
     either, so a 1:4 enrolment cannot overflow its box. */
  const ccTable = studyOf({ ...params, design: "case-control" });
  const scale = dotScale([
    cohort.a + cohort.b, cohort.c + cohort.d, cohort.a + cohort.c, cohort.b + cohort.d,
    ccTable.a + ccTable.c, ccTable.b + ccTable.d, ccTable.a + ccTable.b, ccTable.c + ccTable.d,
  ]);
  drawDesignPanel(ctx, colors, tx, "cohort", t, cohort, ccTable, scale, half - 14);
  drawDesignPanel(ctx, colors, tx + half + 10, "case-control", t, cohort, ccTable, scale, half - 14);
  text(ctx, colors, `1 dot = ${scale} ${scale === 1 ? "person" : "people"}`, tx + maxW, 30,
    { size: "xs", tone: "ink3", align: "right" });

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(tx + half - 4, 22);
  ctx.lineTo(tx + half - 4, 396);
  ctx.stroke();
  ctx.restore();

  if (t <= 0) {
    wrapText(ctx, colors,
      "Two studies of the same source population — and neither of them IS the population. The heavy "
      + "boxes are the groups each investigator recruited, and those numbers are chosen rather than "
      + "measured. Press Run both studies.",
      tx, 366, maxW, { size: "sm", tone: "ink3" });
    return;
  }
  if (t < 1) return;

  /* THE RULE IS STATED IN THE GENERIC WORDS; the boxes stay concrete. That
     split is what the figure-vs-example rule means here: infection and death
     are the instance a reader can hold, and EXPOSURE and OUTCOME are the thing
     they are an instance of. Both are on screen, and neither is asked to do the
     other's job. */
  wrapText(ctx, colors,
    "Both read left to right in the order you did things, not the order they happened. A cohort fixes the "
    + "EXPOSURE and measures the outcome; a case-control fixes the OUTCOME and measures the exposure. "
    + `That is the whole difference — and look what it does to a death rate: ${pct(cohort.deathRate)} in `
    + `the cohort, which nobody chose, against ${pct(ccTable.deathRate)} in the case-control, which is `
    + "nothing but your controls-per-case ratio. A risk divides by a group, and in a case-control every "
    + "group is one you assembled. Now open The calculation.",
    tx, 416, maxW, { size: "sm", tone: "ink2" });
}

/* ---------------------------------------------------------------------------
   THE DESIGN STRIP, above everything.

   Two lines, read top to bottom, and what they read out is THE ORDER YOU DID
   THINGS IN: step 1 is the group you recruited, step 2 is what you then went and
   counted. That is the entire difference between the two designs, and putting it
   in the reading direction means it needs no time arrow to explain — mocked up
   in `_lab/study-design.html`, where a version faithful to the calendar instead
   read as two things converging on the middle.

   The counts you CHOSE are boxed. That is the strip's whole vocabulary, and it
   is what the case-control explanation below points back at: a risk divides by a
   number in a box, and a number in a box is not a measurement.
   ------------------------------------------------------------------------ */
function drawStrip(ctx, colors, w, tx, maxW, params, state) {
  const { study } = state;
  const cc = params.design === "case-control";
  const cases = study.a + study.c;
  const controls = study.b + study.d;

  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  const nameW = ctx.measureText(cc ? "CASE-CONTROL" : "COHORT").width;
  ctx.restore();
  text(ctx, colors, cc ? "CASE-CONTROL" : "COHORT", tx, 24, { size: "sm", tone: "ink1", bold: true });
  text(ctx, colors,
    cc ? "start with the outcome, then look back" : "start with the exposure, then wait",
    tx + nameW + 12, 24, { size: "xs", tone: "ink3" });

  /* FOUR BOXES IN A ROW, which is the mock-up's diagram compressed to one line.
     A two-line text summary went in first and a reader asked what had happened
     to the graphic — fairly, because the point being made is SHAPE (two groups
     you assembled, two you counted) and shape is what a sentence is worst at.

     One row rather than the mock-up's two columns of two: the widget already
     spends 150px on the piles below and cannot afford the mock-up's height, and
     a single row still carries the only thing that matters — which pair is
     boxed. */
  const pairs = cc
    ? [[["cases", cases], ["controls", controls]], [["infected", study.a + study.b], ["not", study.c + study.d]]]
    : [[["infected", N], ["not", N]], [["died", cases], ["lived", controls]]];

  const BW = 92, BH = 34, GAP = 8, ARROW = 26;
  const boxY = 56;
  const x0 = tx;
  const x1 = tx + 2 * BW + GAP + ARROW;

  text(ctx, colors, cc ? "1  you recruit these — your choice" : "1  you recruit these — your choice",
    x0, 46, { size: "xs", tone: "highlight", bold: true });
  text(ctx, colors, "2  then you count these", x1, 46, { size: "xs", tone: "ink3", bold: true });

  const drawPair = (bx, pair, mine) => {
    pair.forEach(([label, n], i) => {
      const x = bx + i * (BW + GAP);
      ctx.save();
      ctx.strokeStyle = mine ? colors.ink1 : colors.grid;
      ctx.lineWidth = mine ? 2 : 1;
      ctx.fillStyle = colors.surface2;
      ctx.beginPath();
      ctx.roundRect(x, boxY, BW, BH, 5);
      if (mine) ctx.fill();
      ctx.stroke();
      ctx.restore();
      text(ctx, colors, label, x + 8, boxY + 14, { size: "xs", tone: "ink3" });
      text(ctx, colors, String(n), x + 8, boxY + 28, { size: "sm", tone: "ink1", bold: true });
    });
  };
  drawPair(x0, pairs[0], true);
  drawPair(x1, pairs[1], false);

  /* The arrow says "and then you", not "and then time passed" — both designs
     read left to right in the order the investigator did things, which is the
     whole distinction and is why neither panel needs a calendar. */
  const ax = x0 + 2 * BW + GAP + 4;
  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax, boxY + BH / 2);
  ctx.lineTo(ax + ARROW - 8, boxY + BH / 2);
  ctx.moveTo(ax + ARROW - 8, boxY + BH / 2);
  ctx.lineTo(ax + ARROW - 13, boxY + BH / 2 - 4);
  ctx.moveTo(ax + ARROW - 8, boxY + BH / 2);
  ctx.lineTo(ax + ARROW - 13, boxY + BH / 2 + 4);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, 110.5);
  ctx.lineTo(tx + maxW, 110.5);
  ctx.stroke();
  ctx.restore();
}

function drawFigure(ctx, colors, w, h, params, state, view) {
  const { q, s } = view;
  const { cohort, study } = state;
  const tx = 28;
  const maxW = w - 2 * tx;

  drawStrip(ctx, colors, w, tx, maxW, params, state);

  /* The block reserved for each arm is the widest it EVER gets, not the width
     it happens to have now — otherwise the figure shifts sideways as the
     survivors step aside, and a reader takes that for the data moving. */
  const block = COL_W + SPLIT_DX;
  const gap = Math.max(56, Math.min(110, (w - 2 * block - 40) / 3));
  const gx = [Math.round(w / 2 - block - gap / 2), Math.round(w / 2 + gap / 2)];

  const arms = [
    { gx: gx[0], title: "With infection", died: cohort.a, lived: cohort.b, kept: study.b },
    { gx: gx[1], title: "No infection", died: cohort.c, lived: cohort.d, kept: study.d },
  ];

  /* One quiet tag naming what the two arms ARE, so the generic word is on the
     figure and not only in the prose below it. */
  text(ctx, colors, "the two exposure groups", gx[0], 118, { size: "xs", tone: "ink3" });

  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx[0] - 16, FLOOR + 0.5);
  ctx.lineTo(gx[1] + block + 16, FLOOR + 0.5);
  ctx.stroke();
  ctx.restore();

  for (const arm of arms) {
    text(ctx, colors, arm.title, arm.gx, 146, { size: "sm", tone: "ink1", bold: true });
    text(ctx, colors, `${N} patients`, arm.gx, 162, { size: "xs", tone: "ink3" });

    /* A SURVIVOR YOU DID NOT ENROL BECOMES A RING and stays on screen. They are
       people the cohort had and your study does not, and a study that silently
       shrinks its own population is the exact thing the case-control tab is
       about. `s` fades them out rather than deleting them, so switching tabs
       reads as the same picture seen through a smaller study. */
    const dropped = arm.lived - arm.kept;
    for (let i = 0; i < N; i += 1) {
      const [x, y] = personXY(i, arm.died, arm.gx, q);
      const isDeath = i < arm.died;
      /* The last `dropped` survivors are the ones you did not enrol. */
      const notEnrolled = !isDeath && i >= arm.died + arm.kept;
      if (isDeath || !notEnrolled) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = isDeath ? colors.event : colors.nonevent;
        ctx.fill();
      } else {
        ctx.save();
        ctx.globalAlpha = 1 - s;
        ctx.beginPath();
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = colors.nonevent;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = s;
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* THE SENTENCE IN WORDS, then THE SAME THING AS A FRACTION. The words are
       what a novice reads without decoding; the fraction is what shows the
       numerator standing still while the denominator changes underneath it. */
    text(ctx, colors,
      q > 0.5 ? `${arm.died} died for every ${arm.kept} who lived` : `${arm.died} died out of ${arm.died + arm.kept}`,
      arm.gx, FLOOR + 24, { size: "sm", tone: "ink2" });

    /* Whole people leave the denominator, ONE AT A TIME, and the printed count
       is read off the block that was just drawn rather than computed beside it.
       A half-faded dot belongs to neither term, so an interpolated denominator
       is a number describing nothing (2.8), and a frozen half-faded mark reads
       as *marked* rather than as leaving (4.3). Survivors are packed FIRST so
       the drop shortens the block from its tail instead of holing it. */
    const shed = Math.round(arm.died * q);
    const num = new Array(arm.died).fill(colors.event);
    const den = [
      ...new Array(arm.kept).fill(colors.nonevent),
      ...new Array(Math.max(0, arm.died - shed)).fill(colors.event),
    ];

    fracBlock(ctx, arm.gx, RULE_Y - 7, num, -1);
    fracBlock(ctx, arm.gx, RULE_Y + 7, den, 1);

    ctx.save();
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(arm.gx - 3, RULE_Y + 0.5);
    ctx.lineTo(arm.gx + FR_W + 3, RULE_Y + 0.5);
    ctx.stroke();
    ctx.restore();

    const dCount = den.length;
    text(ctx, colors, String(num.length), arm.gx + FR_W + 8, RULE_Y - 12, { size: "sm", tone: "ink1", bold: true });
    text(ctx, colors, String(dCount), arm.gx + FR_W + 8, RULE_Y + 22, { size: "sm", tone: "ink1", bold: true });
    text(ctx, colors,
      dCount === 0 ? "= —" : `= ${q > 0.5 ? fmtRatio(arm.died / dCount) : pct(arm.died / dCount)}`,
      arm.gx + FR_W + 38, RULE_Y + 5, { size: "md", tone: "ink1", bold: true });
  }

  /* --- the two ratios, side by side, each showing its own arithmetic ------ */
  const cardY = RULE_Y + 104;
  const half = Math.floor(maxW / 2);
  const cards = [
    {
      x: tx, head: "ODDS RATIO", live: q,
      sum: `${fmtRatio(study.oddsE)}  ÷  ${fmtRatio(study.oddsU)}`,
      value: fmtRatio(study.or), tone: "event",
    },
    {
      x: tx + half, head: "RELATIVE RISK", live: 1 - q,
      sum: `${pct(study.riskE)}  ÷  ${pct(study.riskU)}`,
      value: fmtRatio(study.rr), tone: "ink1",
    },
  ];
  /* THE CARD YOU ARE BUILDING IS LIT AND THE OTHER IS DIMMED, and it crossfades
     on the same `q` as the piles above it. That is the link the figure was
     missing: the button, the denominator under each arm, the fraction and the
     result are now one chain a reader can follow, instead of a toggle at the
     top and two numbers at the bottom with nothing joining them.

     Both stay on screen, because the comparison IS the lesson — dimming says
     "not the one you are building", never "not relevant". */
  for (const card of cards) {
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.7 * card.live;
    text(ctx, colors, card.head, card.x, cardY, { size: "xs", tone: "ink3", bold: true });
    text(ctx, colors, card.sum, card.x, cardY + 20, { size: "sm", tone: "ink2" });
    text(ctx, colors, card.value, card.x, cardY + 50, { size: "fig", tone: card.tone, bold: true });
    ctx.restore();
    /* A rule under the live card, so the link survives greyscale and a
       projector that eats a 30% alpha difference. */
    if (card.live > 0.02) {
      ctx.save();
      ctx.globalAlpha = card.live;
      ctx.strokeStyle = card.tone === "event" ? colors.event : colors.ink1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(card.x, cardY + 62);
      ctx.lineTo(card.x + 96, cardY + 62);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* --- the one line that carries the lesson of the current tab ------------ */
  const cc = params.design === "case-control";
  const over = study.or / study.rr;
  let claim;
  if (!Number.isFinite(over)) {
    /* The corners, named rather than papered over. Both are one drag apart and
       a figure that prints ∞ or NaN at them is worse than one that says why. */
    if (study.a + study.c === 0) {
      claim = "Nobody died in either arm, so there is nothing to divide: 0 out of 100 against 0 out of 100 "
        + "is not a number, and neither ratio exists. Drag a slider up.";
    } else if (study.b + study.d === 0) {
      claim = "Everyone died in both arms. The risks are equal so the risk ratio is 1.00 — but there are no "
        + "survivors to divide by, so both odds are infinite and their ratio does not exist. That is the "
        + "odds scale showing you its edge.";
    } else if (study.c === 0) {
      claim = "Nobody died without the infection, so both ratios are dividing by zero and both come out "
        + "infinite. Every effect looks the same size there, which is why a study with an empty cell "
        + "reports a confidence interval and not a point estimate.";
    } else if (study.b === 0 || study.d === 0) {
      claim = `One arm has no survivors left, so its odds are infinite and the odds ratio does not survive `
        + `it — while the risk ratio is still ${fmtRatio(study.rr)}. Risk has a ceiling at 100%; odds does `
        + `not, and this is where that stops being an abstraction.`;
    } else {
      claim = "One of the two ratios is dividing by zero, so it is infinite rather than large. "
        + "Move a slider off the end.";
    }
  } else if (!cc) {
    claim = study.rr === 1
      ? "No effect, and both ratios say so together: 1.00 and 1.00. Drag either slider and watch which of "
        + "the two moves further."
      /* "OVERSTATES" IS DEFINED HERE, IN NUMBERS, EVERY TIME. It was used as a
         bare verb in the readout and nowhere explained, and a reader said so:
         further from what, and why does that matter? It matters because of the
         sentence people actually write. */
      : `The truth is that infection multiplies the RISK of dying by ${fmtRatio(study.rr)}. `
        + `Someone who reads the odds ratio as if it were a risk ratio would write "${fmtRatio(study.or)} times `
        + `as likely" — ${Math.round((over - 1) * 100)}% more effect than there is. That gap is what "the odds `
        + `ratio overstates" means: it holds for any exposure and any outcome, and it grows as the outcome `
        + `gets commoner.`;
  } else {
    /* WHY THE RISK RATIO IS MISLEADING HERE, AS A MECHANISM RATHER THAN A
       VERDICT. The old line said "you chose this" and stopped, which names the
       crime and not the method. A reader asked outright: why is it different,
       what changed? What changed is the DENOMINATOR, and pointing at the boxed
       number in the strip above is what makes that concrete. */
    /* THE HONEST CLAIM, and it is not the one this widget made for six rounds.
       "The odds ratio is unchanged" was an idealisation: any case-control sample
       of a finite population rounds, and rounding moves it. Measured across the
       sensible slider range the risk ratio's median shift is 7.9% and the odds
       ratio's is 0.7% — and the RR's DIRECTION is the investigator's to choose,
       which is worse than a bias. So the claim is the true one: the odds ratio
       ESTIMATES the population's, and the risk ratio is not estimating
       anything. That also retires the whole-people footnote by making it the
       point rather than the excuse. */
    const rrShift = cohort.rr === 0 || !Number.isFinite(cohort.rr) ? NaN : study.rr / cohort.rr - 1;
    claim = `You enrolled all ${study.a + study.c} cases and ${study.b + study.d} controls, so `
      + `${pct(study.deathRate)} of your study died — that is your ratio, not the disease's `
      + `${pct(cohort.deathRate)}. The risk ratio followed you: ${fmtRatio(cohort.rr)} in the population and `
      + `${fmtRatio(study.rr)} here`
      + (Number.isFinite(rrShift) ? `, ${rrShift >= 0 ? "+" : ""}${Math.round(rrShift * 100)}%` : "")
      + `. Change the ratio and it moves again — above the truth or below it, and you choose which. The odds `
      + `ratio did not follow you: ${fmtRatio(cohort.or)} against ${fmtRatio(study.or)}. It ESTIMATES the `
      + `population's; the risk ratio is not estimating anything.`;
  }
  wrapText(ctx, colors, claim, tx, cardY + 82, maxW, { size: "sm", tone: "ink2" });
}
