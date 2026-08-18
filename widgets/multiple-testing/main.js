/* ============================================================================
   Multiple testing — widget 6, and the last of the statistics arc.

     increments → means → one sample → an interval → a null by shuffling → MANY NULLS

   MISCONCEPTION TARGETED, and the catalogue calls it the most consequential
   statistical error in omics work: that 50 hits at p < 0.05 out of 20,000 tests
   is a finding. It is not. It is what 20,000 coins look like.

   THE WHOLE ARC IS LOAD-BEARING HERE, which is why this one is last:

     widget 4 gave you t          every gene is tested with a t statistic
     widget 5 gave you the p      and p is the share of chance outcomes past it
     widget 6 runs that 20,000 times

   Nothing is faked. Each gene gets two groups of n drawn from a population, a
   real two-sample t statistic, and a p-value from the same tail expression
   `tCritical` inverts — so the critical value and the p-value cannot disagree
   about what the t distribution is. 20,000 of them take about 60 ms, which is
   what makes honesty affordable here.

   THE TEACHING DESIGN, which is the part worth arguing about:

   - THE HISTOGRAM IS FLAT, AND THAT IS THE WHOLE IDEA. Under the null a p-value
     is UNIFORM — every value equally likely — so a bar chart of 20,000 null
     p-values is a flat carpet, and the leftmost twentieth of it holds 5% of the
     tests BY CONSTRUCTION rather than by discovery. Most students have never
     seen this and it is the single fact that dissolves the misconception. The
     `--c-theory` rule across the top is m/20, what chance alone produces, so the
     carpet is visibly checked against a prediction rather than merely asserted.

   - TWENTY BINS, CHOSEN NOT INHERITED. At 20 bins the first bin is exactly
     [0, 0.05], so the bar a student is looking at IS the set of tests that get
     called significant. Any other bin count puts the threshold inside a bar and
     the picture stops matching the number.

   - SET "REAL EFFECTS" TO ZERO. That is this widget's version of widget 5's
     effect = None, and it is the strongest move available: 20,000 genes, not one
     of them different, and about 1,000 still come back at p < 0.05. Every one is
     a false positive the student watched arrive.

   - THE CORRECTIONS ARE COMPUTED ON THE TESTS RUN SO FAR, not on the final
     total, so the Bonferroni threshold visibly TIGHTENS as more genes are added.
     That is a real property people get wrong — the penalty is not a fixed number,
     it is a function of how much you looked — and revealing it costs nothing
     because the alternative was an animation whose second panel only paid off at
     the very end.

   - THREE RULES AT ONCE, NOT A CONTROL TO SWITCH BETWEEN. Widget 4 already uses
     switch-and-compare, and here the comparison is not "which is right" but
     "what does each cost you". Side by side, Bonferroni is visibly a sliver —
     nearly no false positives and nearly no discoveries either — and BH sits
     between. Seeing all three at once is the answer to "why not just use
     Bonferroni", which a control would make a student discover by accident.

   - RED MEANS THE SAME THING IT MEANT IN WIDGET 5. `--c-extreme` is "past a
     threshold" — there, the shuffles a p-value counts; here, a test called
     significant. A false discovery keeps that red; a true one is `--c-empirical`,
     something really observed.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, EFFECT_SD, fmt,
  tTailP,
  makePlot, niceTicks,
} from "../core/index.js";

const ALPHA = 0.05;

/* Twenty, so the first bin is exactly [0, 0.05] — see the header. Changing this
   without changing ALPHA puts the threshold inside a bar, and the picture stops
   matching the number a student is reading. */
const BINS = 20;

/* Fifty steps whatever m is, so the animation takes the same time to watch
   whether you ran 200 genes or 20,000. */
const STEPS = 50;

const SPEEDS = {
  slow: { label: "Slow", detail: "every batch shown", ms: 900 },
  medium: { label: "Medium", detail: "every batch shown", ms: 380 },
  fast: { label: "Fast", detail: "straight to the end", ms: 60 },
};

/* THIS WIDGET NEEDS ITS OWN TOP RUNG, and the reason is the lesson.
   core/stats.js's shared ladder is calibrated for a SINGLE test, where 1.3 SD is
   a large effect and widget 5 finds it five times in six. Run it twenty thousand
   times and that same "large" effect is invisible to any correction — measured,
   not guessed: at n = 12, Bonferroni finds 2 of 100 and BH finds 10. So the
   lower rungs keep the shared values, meaning exactly what they mean in widgets
   4 and 5, and a fourth is added for the regime where correction can actually
   see something. The gap between the two is the point: what counts as a big
   effect depends on how many times you looked. */
const EFFECTS = {
  none: { label: "None", detail: "not one gene is different — every hit is false", sd: EFFECT_SD.none },
  moderate: { label: "Moderate", detail: "0.9 SD — invisible once you correct", sd: EFFECT_SD.moderate },
  large: { label: "Large", detail: "1.3 SD — large for ONE test, still invisible for 20,000", sd: EFFECT_SD.large },
  strong: { label: "Strong", detail: "2.0 SD — the regime where correction can find something", sd: 2.0 },
};

const RULES = [
  { key: "raw", label: "p < 0.05", note: "no correction at all" },
  { key: "bonf", label: "Bonferroni", note: "p < 0.05 / m" },
  { key: "bh", label: "Benjamini–Hochberg", note: "controls the false discovery rate" },
];

const distOptions = ["normal", "exponential", "counts", "bimodal", "uniform"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** Two-sample t, pooled. One place, so nothing can disagree about the statistic. */
function tTest(a, b, n) {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i += 1) { va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  const df = 2 * n - 2;
  const se = Math.sqrt((va + vb) / df) * Math.sqrt(2 / n);
  return { t: se > 0 ? Math.abs(mb - ma) / se : 0, df };
}

/**
 * What each rule calls significant among the FIRST k tests, and how many of
 * those calls are false. Computed on the prefix on purpose — the correction is a
 * function of how much you looked, and watching it tighten is the point.
 */
function callsFor(state, k) {
  const { p, isReal } = state;
  if (k <= 0) return RULES.map((r) => ({ key: r.key, tp: 0, fp: 0, cut: 0 }));

  const order = Array.from({ length: k }, (_, i) => i).sort((i, j) => p[i] - p[j]);

  // Benjamini–Hochberg: the largest rank whose p is still under (rank/k)·alpha.
  let bhRank = 0;
  for (let r = k; r >= 1; r -= 1) {
    if (p[order[r - 1]] <= (r / k) * ALPHA) { bhRank = r; break; }
  }

  const cuts = { raw: ALPHA, bonf: ALPHA / k, bh: bhRank ? p[order[bhRank - 1]] : -1 };

  return RULES.map((rule) => {
    const cut = cuts[rule.key];
    let tp = 0;
    let fp = 0;
    for (let r = 0; r < k; r += 1) {
      const i = order[r];
      if (p[i] > cut) break; // sorted, so nothing further can qualify
      if (isReal[i]) tp += 1; else fp += 1;
    }
    return { key: rule.key, tp, fp, cut };
  });
}

defineWidget({
  slug: "multiple-testing",
  title: "Multiple Testing",
  status: "draft",
  subtitle:
    "Test twenty thousand genes at p < 0.05 and about a thousand come back " +
    "significant even when not one of them is different. That is not a finding, " +
    "it is arithmetic. Set the real effects to zero and watch it happen.",
  height: 520,

  params: {
    /* The headline number, and the reason the widget exists. 20,000 is a real
       transcriptome rather than a round number chosen for effect. */
    m: { type: "int", label: "Genes tested", min: 200, max: 20000, step: 200, default: 20000 },

    /* THE CONTROL THAT KILLS THE MISCONCEPTION, and its important setting is 0 —
       widget 5's effect = None, in this widget's language. */
    real: { type: "int", label: "Genes with a real effect", min: 0, max: 400, step: 10, default: 100 },

    effect: {
      type: "choice",
      label: "How different those are",
      options: Object.entries(EFFECTS).map(([value, e]) => ({ value, label: e.label, detail: e.detail })),
      default: "strong",
    },

    /* 12 with a Strong effect is the AUTHORED default, chosen by measurement so
       all three rules show something a student can compare: p < 0.05 calls about
       1,100 with 91% of them false, Bonferroni calls 21 with none false, and BH
       calls 75 with 3 false — an FDR of 4% against its nominal 5%. Lower n and
       both corrections return nothing, which teaches "correction destroys
       everything" instead of what BH actually buys. */
    n: { type: "int", label: "Samples per group", min: 3, max: 24, default: 12 },

    dist: { type: "select", label: "Population", options: distOptions, default: "normal" },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
    },

    shown: { type: "int", label: "Pre-tested genes", min: 0, max: 20000, default: 0, hidden: true },
  },

  legend: [
    { token: "extreme", label: "Called significant, but not real", mark: "bar" },
    { token: "empirical", label: "Called significant and real", mark: "bar" },
    { token: "theory", label: "What chance alone produces", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const pop = POPULATIONS[params.dist];
    const shift = EFFECTS[params.effect].sd * pop.sd;
    const m = params.m;
    const n = params.n;

    /* Which genes are real is scattered across the whole set, not the first few.
       Revealing in index order otherwise makes every early batch a real effect,
       and the flat carpet — the entire point — would only appear at the end. */
    const isReal = new Uint8Array(m);
    const wanted = Math.min(params.real, m);
    let placed = 0;
    while (placed < wanted) {
      const i = Math.floor(rng.next() * m);
      if (!isReal[i]) { isReal[i] = 1; placed += 1; }
    }

    const p = new Float64Array(m);
    const a = new Array(n);
    const b = new Array(n);
    for (let g = 0; g < m; g += 1) {
      const lift = isReal[g] ? shift : 0;
      for (let i = 0; i < n; i += 1) {
        a[i] = pop.sample(rng);
        b[i] = pop.sample(rng) + lift;
      }
      const { t, df } = tTest(a, b, n);
      p[g] = tTailP(t, df);
    }

    return { pop, m, p, isReal, realCount: wanted };
  },

  animation: {
    stepLabel: "Test more genes",
    runLabel: "Play",

    /* `tested`, NOT `done`. Core reserves `anim.done` for "nothing left to
       show", and reads it as truthy to mean the next click is Replay — so a
       counter named done makes every step after the first replay instead of
       advancing. Widget 4 shipped with exactly that bug. */
    init: ({ params, state, fromScratch }) => {
      const tested = fromScratch ? 0 : Math.min(params.shown, state.m);
      return { tested, t: 0, done: tested >= state.m, calls: callsFor(state, tested) };
    },

    advance: (anim, { dt, params, state }) => {
      if (anim.tested >= state.m) {
        anim.done = true;
        return false;
      }
      anim.t += dt / SPEEDS[params.speed].ms;
      if (anim.t < 1) return true;

      anim.t = 0;
      anim.tested = Math.min(state.m, anim.tested + Math.max(1, Math.ceil(state.m / STEPS)));
      /* Recomputed here rather than in draw(): `tested` only moves at a batch
         boundary, so this sorts once per batch instead of once per frame. */
      anim.calls = callsFor(state, anim.tested);
      if (anim.tested >= state.m) anim.done = true;
      return anim.tested < state.m && anim.mode === "run";
    },

    rebuild: (anim, { state }) => {
      anim.tested = Math.min(anim.tested, state.m);
      anim.done = anim.tested >= state.m;
      anim.calls = callsFor(state, anim.tested);
    },
  },

  draw: ({ ctx, colors, w, h, state, anim }) => {
    const shown = anim ? anim.tested : 0;
    const calls = anim ? anim.calls : callsFor(state, 0);

    const padL = 54;
    const padR = 16;
    const topInset = 30;
    const topH = Math.round(h * 0.46);
    const gap = 62;

    /* --- the p-value carpet ------------------------------------------- */

    const counts = new Array(BINS).fill(0);
    for (let i = 0; i < shown; i += 1) {
      const k = Math.min(BINS - 1, Math.floor(state.p[i] * BINS));
      counts[k] += 1;
    }
    const expected = shown / BINS; // what a flat carpet would put in every bin
    const peak = Math.max(1, ...counts, expected);

    const hist = makePlot({
      ctx, colors,
      rect: { x: padL, y: topInset, w: w - padL - padR, h: topH },
      xDomain: [0, 1],
      yDomain: [0, peak * 1.18],
    });
    hist.grid(niceTicks(0, peak * 1.18, 4));
    hist.axisY({ ticks: niceTicks(0, peak * 1.18, 4), label: "genes" });
    hist.axisX({ ticks: [0, 0.05, 0.25, 0.5, 0.75, 1], label: "p-value" });
    hist.caption(
      shown
        ? `${fmt(shown, 0)} genes tested — the first bar is p < 0.05`
        : "p-values from every gene — nothing tested yet"
    );

    if (shown) {
      // The first bin IS the significant set, so it wears the threshold colour.
      hist.bars(counts.map((c, i) => (i === 0 ? c : 0)), {
        lo: 0, width: 1 / BINS, fill: colors.extreme, opacity: 0.9,
      });
      hist.bars(counts.map((c, i) => (i === 0 ? 0 : c)), {
        lo: 0, width: 1 / BINS, fill: colors.empirical, opacity: 0.7,
      });

      /* What chance alone produces, drawn flat across the top. The carpet is
         CHECKED against this rather than merely described as flat. */
      hist.curve([[0, expected], [1, expected]], { stroke: colors.theory, width: 2, dash: [5, 4] });
    }

    /* --- what each rule calls ----------------------------------------- */

    const barsY = topInset + topH + gap;
    const barsH = h - barsY - 20;
    const rowH = barsH / RULES.length;
    const widest = Math.max(1, ...calls.map((c) => c.tp + c.fp));

    const bars = makePlot({
      ctx, colors,
      rect: { x: padL, y: barsY, w: w - padL - padR, h: barsH },
      xDomain: [0, widest],
      yDomain: [0, RULES.length],
    });
    bars.caption(
      shown ? "What each rule calls significant, of the genes tested so far" : "What each rule would call significant"
    );

    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textBaseline = "middle";
    for (let r = 0; r < RULES.length; r += 1) {
      const c = calls[r];
      const y = barsY + r * rowH + rowH * 0.5;
      const barH = Math.min(18, rowH * 0.42);
      const x0 = bars.sx(0);

      ctx.fillStyle = colors.ink2;
      ctx.textAlign = "right";
      ctx.fillText(RULES[r].label, x0 - 8, y - barH * 0.1);

      // True discoveries first, then the false ones, so red always sits on the
      // outside edge where its length is what you read.
      const wTp = bars.sx(c.tp) - x0;
      const wFp = bars.sx(c.tp + c.fp) - bars.sx(c.tp);
      ctx.fillStyle = colors.empirical;
      ctx.fillRect(x0, y - barH, Math.max(c.tp > 0 ? 1 : 0, wTp), barH);
      ctx.fillStyle = colors.extreme;
      ctx.fillRect(x0 + wTp, y - barH, Math.max(c.fp > 0 ? 1 : 0, wFp), barH);

      const total = c.tp + c.fp;
      const pct = total ? Math.round((100 * c.fp) / total) : 0;
      ctx.fillStyle = colors.ink2;
      ctx.textAlign = "left";
      ctx.fillText(
        total
          ? `${fmt(total, 0)} called · ${fmt(c.fp, 0)} false (${pct}%)`
          : "nothing called",
        x0 + Math.max(wTp + wFp, 2) + 8,
        y - barH * 0.5
      );
    }
    ctx.restore();
  },

  readout: ({ state, anim }) => {
    const shown = anim ? anim.tested : 0;
    const calls = anim ? anim.calls : callsFor(state, 0);
    const by = (k) => calls.find((c) => c.key === k);
    const tile = (c) => {
      const total = c.tp + c.fp;
      if (!shown) return { value: "—", note: "nothing tested yet" };
      return {
        value: fmt(total, 0),
        note: total ? `${fmt(c.fp, 0)} false · ${Math.round((100 * c.fp) / total)}% of them` : "none survive",
      };
    };

    return [
      {
        label: "Genes tested",
        value: shown ? fmt(shown, 0) : "—",
        note: `${fmt(state.realCount, 0)} of ${fmt(state.m, 0)} have a real effect`,
      },
      { label: "p < 0.05", ...tile(by("raw")) },
      { label: "Bonferroni", ...tile(by("bonf")) },
      { label: "Benjamini–Hochberg", ...tile(by("bh")) },
    ];
  },

  summary: ({ state, anim }) => {
    const shown = anim ? anim.tested : 0;
    if (!shown) return "No genes tested yet. The figure is empty.";
    const raw = (anim.calls || []).find((c) => c.key === "raw") || { tp: 0, fp: 0 };
    return (
      `${shown} genes tested, ${state.realCount} of which have a real effect. ` +
      `At p < 0.05, ${raw.tp + raw.fp} are called significant and ${raw.fp} of those are false.`
    );
  },
});
