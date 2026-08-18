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
  tTailP, normalPdf,
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
  const zeros = () => new Array(BINS).fill(0);
  const blank = () => RULES.map((r) => ({ key: r.key, tp: 0, fp: 0, hist: zeros(), called: zeros() }));
  if (k <= 0) return blank();

  const order = Array.from({ length: k }, (_, i) => i).sort((i, j) => p[i] - p[j]);

  /* ADJUSTED p-values, one array per rule, indexed by RANK.
     Adjusting the p-values instead of moving the threshold is what lets all
     three panels keep the SAME 0.05 cut on the SAME linear axis: the
     distribution moves right under correction rather than the threshold moving
     left into a pixel indistinguishable from zero. It is also the column real
     tools hand you — DESeq2 and limma give you padj and you cut it at 0.05. */
  const adj = {
    raw: new Float64Array(k),
    bonf: new Float64Array(k),
    bh: new Float64Array(k),
  };
  for (let r = 0; r < k; r += 1) {
    adj.raw[r] = p[order[r]];
    adj.bonf[r] = Math.min(1, p[order[r]] * k);
  }
  /* BH steps DOWN from the largest p, carrying the running minimum, which is
     what makes the adjusted values monotone — without it a gene could be
     "more significant" than one with a smaller raw p. */
  let running = 1;
  for (let r = k; r >= 1; r -= 1) {
    running = Math.min(running, (k / r) * p[order[r - 1]]);
    adj.bh[r - 1] = Math.min(1, running);
  }

  return RULES.map((rule) => {
    const a = adj[rule.key];
    const hist = zeros();
    const called = zeros();
    let tp = 0;
    let fp = 0;
    for (let r = 0; r < k; r += 1) {
      const bin = Math.min(BINS - 1, Math.floor(a[r] * BINS));
      hist[bin] += 1;
      if (a[r] <= ALPHA) {
        called[bin] += 1;
        if (isReal[order[r]]) tp += 1; else fp += 1;
      }
    }
    return { key: rule.key, tp, fp, hist, called };
  });
}

defineWidget({
  slug: "multiple-testing",
  title: "Multiple Testing",
  subtitle:
    "Test twenty thousand genes at p < 0.05 and about a thousand come back " +
    "significant even when not one of them is different. That is not a finding, " +
    "it is arithmetic. Set the real effects to zero and watch it happen.",
  height: 700,

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
    /* Up to 100, because the ceiling is where a whole lesson lives. At 0.9 SD
       ("Moderate") and 20,000 genes, BH finds 0 of 100 at n = 12, 14 at n = 24,
       50 at n = 40 and 94 at n = 60 — measured, not guessed. A cap of 24 hides
       that entirely and leaves the impression that correction simply destroys
       moderate effects, when what it actually does is price them. */
    n: { type: "int", label: "Samples per group", min: 3, max: 100, default: 12 },

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
    stepLabel: "Test batch",
    stepTitle: "Test the next batch of genes — one fiftieth of them per press",
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

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const shown = anim ? anim.tested : 0;
    const calls = anim ? anim.calls : callsFor(state, 0);

    const padL = 54;
    const padR = 16;

    /* A STRIP, not a panel. Mocked up at three heights in _lab/mt-panels.html:
       two curves and a shaded overlap lose nothing at a third the height. It
       exists because "2.0 SD" is a number students cannot picture, and the
       overlap is the reason detection is hard at all. */
    const stripH = 74;
    drawOverlap(ctx, colors, { x: padL, y: 26, w: w - padL - padR, h: stripH }, params);

    /* ONE SHARED Y-SCALE across all three carpets, taken from the RAW one.
       Scale each to its own peak instead and Bonferroni's axis runs to 20,000 —
       because it sends almost every gene to exactly 1.0 — which turns the
       handful of survivors into a sub-pixel bar and destroys the only
       comparison that matters. Sharing keeps the left-hand side readable and
       lets the pile at 1.0 run off the top, labelled. */
    const expected = shown / BINS;
    const yMax = Math.max(1, expected * 1.35, ...(calls[0] ? calls[0].hist : [1]));

    const top = 26 + stripH + 52;
    const gap = 46;
    const panelH = Math.max(60, (h - top - 24 - gap * 2) / 3);

    for (let r = 0; r < RULES.length; r += 1) {
      const c = calls[r];
      const rect = { x: padL, y: top + r * (panelH + gap), w: w - padL - padR, h: panelH };
      const plot = makePlot({ ctx, colors, rect, xDomain: [0, 1], yDomain: [0, yMax] });

      plot.axisY({ ticks: niceTicks(0, yMax, 3), label: "genes" });
      plot.axisX({ ticks: [0, 0.05, 0.25, 0.5, 0.75, 1], label: r === RULES.length - 1 ? "adjusted p-value" : "" });

      const total = c.tp + c.fp;
      const pct = total ? Math.round((100 * c.fp) / total) : 0;
      plot.caption(
        !shown
          ? RULES[r].label
          : total
            ? `${RULES[r].label} — ${fmt(total, 0)} called, ${fmt(c.fp, 0)} false (${pct}%)`
            : `${RULES[r].label} — nothing called`
      );

      if (!shown) continue;

      /* CLAMPED to the shared ceiling. bars() does not clip to its rect, so
         Bonferroni's pile of ~19,900 at padj = 1 drew eighteen times past the
         top of its panel and straight over the carpet and the overlap strip
         above it. Clamping stops it flush at the ceiling; the arrow label below
         carries the real count, so nothing is hidden, only bounded. */
      const cap = (arr) => arr.map((v) => Math.min(v, yMax));
      plot.bars(cap(c.hist), { lo: 0, width: 1 / BINS, fill: colors.empirical, opacity: 0.7 });
      // What this rule actually calls, at the SAME 0.05 cut in every panel.
      plot.bars(cap(c.called), { lo: 0, width: 1 / BINS, fill: colors.extreme, opacity: 0.95 });

      // Only the raw carpet is flat, so only it gets the flatness prediction.
      if (r === 0) {
        plot.curve([[0, expected], [1, expected]], { stroke: colors.theory, width: 2, dash: [5, 4] });
      }

      /* Anything past the shared ceiling says so in words rather than being
         silently cropped, which would read as a bug. */
      ctx.save();
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillStyle = colors.ink3;
      ctx.textAlign = "right";
      for (let b = 0; b < BINS; b += 1) {
        if (c.hist[b] <= yMax) continue;
        ctx.fillText(`${fmt(c.hist[b], 0)} ↑`, plot.sx((b + 1) / BINS) - 2, rect.y + 10);
      }
      ctx.restore();
    }
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

/* --- the effect, as a picture rather than a number ---------------------- */

function drawOverlap(ctx, colors, rect, params) {
  const d = EFFECTS[params.effect].sd;
  const lo = -3.4;
  const hi = 3.4 + d;
  const plot = makePlot({ ctx, colors, rect, xDomain: [lo, hi], yDomain: [0, 0.46] });
  plot.axisX({ ticks: niceTicks(lo, hi, 7), label: "" });
  plot.caption(
    d === 0
      ? "The two groups are the SAME distribution — every difference you find is chance"
      : `A ${d.toFixed(1)} SD difference — the shaded part is where the two groups overlap`
  );

  const curve = (mu) => {
    const out = [];
    for (let i = 0; i <= 200; i += 1) {
      const x = lo + ((hi - lo) * i) / 200;
      out.push([x, normalPdf(x, mu, 1)]);
    }
    return out;
  };

  /* The overlap is drawn first and in --c-extreme, the same red that means
     "past a threshold" everywhere else in the arc — here, the region where a
     gene from either group is indistinguishable from the other. It is shaded
     under both curves rather than outlined, because the AREA is the argument. */
  const shade = [];
  for (let i = 0; i <= 200; i += 1) {
    const x = lo + ((hi - lo) * i) / 200;
    shade.push([x, Math.min(normalPdf(x, 0, 1), normalPdf(x, d, 1))]);
  }
  plot.area(shade, { fill: colors.extreme, opacity: 0.3 });
  plot.curve(curve(0), { stroke: colors.groupA, width: 2 });
  if (d > 0) plot.curve(curve(d), { stroke: colors.groupB, width: 2 });

  ctx.save();
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.fillStyle = colors.groupA;
  ctx.fillText("control", plot.sx(0), plot.sy(0.43));
  if (d > 0) {
    ctx.fillStyle = colors.groupB;
    ctx.fillText("treated", plot.sx(d), plot.sy(0.43));
  }
  ctx.restore();
}
