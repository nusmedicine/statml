/* ============================================================================
   Permutation test — widget 5 of the statistics arc.

     increments → means → one sample → an interval → A NULL BY SHUFFLING → many nulls

   Answers: could chance alone have produced what I saw? Under the null the
   grouping is meaningless, so any relabelling of the same numbers is equally
   likely. Shuffle the labels, recompute the difference, collect. That pile IS
   the null, and p is the share of it at least as far from zero as what you saw.

   MISCONCEPTION TARGETED — the best-evidenced in the whole arc. That p is
   P(H₀ true), or that 1 − p is the probability the alternative holds. Greenland
   et al. 2016 document it persisting among researchers and professionals, not
   only students, which sets a higher bar than "illustrate the procedure".

   THE TEACHING DESIGN, which is the part worth arguing about:

   - THE OPPOSITE MOVE TO THE BOOTSTRAP, and the pair is the point. Widget 3
     samples WITH replacement, so values repeat and the labels are irrelevant.
     This one permutes, so every value survives exactly once and only the
     ARRANGEMENT changes. Same motor, opposite move — which is why `rng.resample`
     returns indices and `rng.shuffle` returns a permuted array.

   - POOL AND RE-DEAL, NOT SWAP OR RECOLOUR. Every observation lifts out of its
     box into a single pool, then is dealt back. The pooling step is H₀ stated
     physically: there is only one group and the split is a fiction. Mocked up
     against two alternatives in widgets/_lab/shuffle-visuals.html; recolouring
     alone was rejected for reading as decoration rather than mechanism, and it
     is also what the Rossman/Chance applet and the card activity do, so it is an
     established convention rather than a private notation.

   - THE DOTS MOVE VERTICALLY ONLY, so an observation never leaves its value.
     The boxes carry their n, because a permutation holds the group SIZES fixed —
     the thing that separates it from relabelling each observation independently,
     and the thing a swap animation does not say.

   - A DOT THAT LANDS IN A TAIL STAYS LIT. Arrivals are highlighted while falling
     anyway; one landing beyond the observed line keeps that colour. So p is
     "count the lit ones" rather than an abstract tail area. The lit count is
     exactly p's numerator — the tail is counted PER BIN as values arrive rather
     than derived from bin centres at paint time, because quantising the boundary
     bin would let a student count a different number than the readout reports,
     and that would destroy the only reason the idea is worth anything.

   - THE TRUE EFFECT IS A CONTROL, AND IT GOES TO ZERO. That is the widget's
     strongest move against the misconception: set it to zero, so the null is
     TRUE, and re-seed. About one study in twenty still lands under p < 0.05. If
     p were the probability the null is true it would read 1.00 every time.
   ========================================================================= */

import {
  defineWidget, POPULATIONS, histogram, fmt,
  makePlot, samplePdf, niceTicks,
  createPile, binsFor,
} from "../core/index.js";

/* Shuffles whose label arrays are retained for the choreography. Past this the
   animation is too fast for individual dots to read anyway. */
const KEEP = 60;

const SPEEDS = {
  slow: { label: "Slow", detail: "every stage shown", ms: 1800, choreo: true },
  medium: { label: "Medium", detail: "every stage shown", ms: 750, choreo: true },
  fast: { label: "Fast", detail: "differences only", ms: 130, choreo: false },
  fastest: { label: "Fastest", detail: "fills in at once", ms: 0, choreo: false },
};

const STEP_MS = 1900;
const STREAM_MS = 3200;
/* Pool, deal, drop. The pool and the deal get equal time because they are the
   two halves of one claim — everything comes out, everything goes back. */
const PHASE_FRAC = { pool: 0.36, deal: 0.34, drop: 0.30 };

const LEAD_MS = 2000;
const LEAD_ARRIVE = 0.55; // observations land in their boxes over this much

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

const distOptions = ["normal", "exponential", "bimodal", "uniform", "pareto"]
  .map((value) => ({ value, label: POPULATIONS[value].label }));

/** The statistic: how much higher group B's mean is than group A's. */
function gapOf(values, labels, n) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (labels[i]) b += values[i];
    else a += values[i];
  }
  return b / n - a / n;
}

function makeNullPile(state) {
  return createPile({ bins: state.bins, lo: state.hist.lo, width: state.hist.width });
}

defineWidget({
  slug: "permutation-test",
  title: "Could chance alone have done this?",
  subtitle:
    "If the grouping meant nothing, any relabelling of the same numbers would " +
    "be just as likely. So shuffle the labels, recompute the difference, and " +
    "collect. That pile is what chance alone produces — and p is simply the " +
    "share of it at least as far from zero as the difference you actually saw.",
  height: 500,

  params: {
    dist: { type: "select", label: "Population", options: distOptions, default: "normal" },
    n: { type: "int", label: "Group size n", min: 4, max: 40, default: 12 },

    /* The control this widget is really about. At zero the null is TRUE, so
       every small p it then produces is a false positive you watched happen —
       which is the demonstration that p is not the probability the null is
       true. Kept in population SDs so it means the same thing whichever
       population is chosen. Default 0.9σ is about 2.2 standard errors at n = 12:
       a result you would report, and not an overwhelming one. */
    effect: {
      type: "float", label: "True effect (σ)", min: 0, max: 1.6, step: 0.1, default: 0.9,
    },

    reps: {
      type: "int", label: "Shuffles to draw", min: 1, max: 2000, step: 1, default: 400,
      // The first k shuffles are the same k shuffles whatever the target is.
      display: true,
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    speed: {
      type: "choice",
      label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
    },

    shown: { type: "int", label: "Pre-filled shuffles", min: 0, max: 2000, default: 0, hidden: true },
  },

  /* Two entries, not four. The groups are NOT in here: their boxes carry
     "GROUP A · n = 12" on the figure itself, and a label in place beats a
     colour key every time. It also avoids the legend showing two identical
     swatches — group A shares its blue with the pile, deliberately (they never
     appear in the same panel), and side by side in a legend that reads as a
     mistake even though on the figure it never does. The observed difference
     line is labelled where it is drawn, for the same reason. */
  legend: [
    { token: "empirical", label: "Differences chance alone produced", mark: "bar" },
    { token: "highlight", label: "At least as far from zero as observed — these are what p counts", mark: "bar" },
  ],

  /* --- data ------------------------------------------------------------- */

  compute({ params, rng }) {
    const pop = POPULATIONS[params.dist];
    const n = params.n;
    const delta = params.effect * pop.sd;

    /* 1 — the one study. Group B is the same population shifted, so the two
       arms have identical spread and only their centres differ. */
    const values = new Array(2 * n);
    for (let i = 0; i < n; i += 1) values[i] = pop.sample(rng);
    for (let i = 0; i < n; i += 1) values[n + i] = pop.sample(rng) + delta;
    const labels = values.map((_, i) => (i < n ? 0 : 1));
    const observed = gapOf(values, labels, n);

    /* 2 — the null. Each shuffle permutes the ORIGINAL labelling, so the
       shuffles are independent of one another rather than a random walk through
       arrangements. Nothing new is ever drawn from the population here: the
       values are fixed and only their assignment changes. */
    const diffs = new Array(params.reps);
    const perms = [];
    for (let r = 0; r < params.reps; r += 1) {
      const ls = rng.shuffle(labels);
      diffs[r] = gapOf(values, ls, n);
      if (r < KEEP) perms.push(ls);
    }

    /* The window is centred on ZERO, because under H₀ the difference is centred
       on zero by construction — the same "centre on the truth, not on what you
       happened to get" rule the bootstrap window follows. The observed
       difference then sits visibly off to one side, and how far off is the whole
       question.

       Its width comes from the DATA, not from `diffs`: `reps` is a display
       parameter, and a window that shrank or grew when you asked for more
       shuffles would move the picture underneath a student who only changed how
       long to run it for. */
    let ssA = 0;
    let ssB = 0;
    let sumA = 0;
    let sumB = 0;
    for (let i = 0; i < n; i += 1) { sumA += values[i]; sumB += values[n + i]; }
    const barA = sumA / n;
    const barB = sumB / n;
    for (let i = 0; i < n; i += 1) {
      ssA += (values[i] - barA) ** 2;
      ssB += (values[n + i] - barB) ** 2;
    }
    const sPooled = Math.sqrt((ssA + ssB) / (2 * n - 2));
    const nullSd = sPooled * Math.sqrt(2 / n);
    const hw = Math.max(3.6 * nullSd, Math.abs(observed) * 1.18);

    const domain = [-hw, hw];
    const bins = binsFor(params.reps);

    return {
      pop, n, delta, values, labels, observed, diffs, perms, domain, bins, nullSd,
      // Both arms have to fit, so this window is not μ-centred.
      dataDomain: [pop.domain[0], pop.domain[1] + delta],
      hist: histogram(diffs, domain, bins),
    };
  },

  /* --- animation -------------------------------------------------------- *
   * Two stages. "Run the study" happens once and then greys out — you get one
   * study, and no amount of shuffling will get you another. "Shuffle the
   * labels" runs as often as you like, because rearranging costs nothing.    */

  animation: {
    leadLabel: "Run the study",
    stepLabel: "Shuffle the labels",
    runLabel: "Play",

    init({ params, state, fromScratch }) {
      const anim = {
        pile: makeNullPile(state),
        // Lit counts per bin, maintained as values arrive so that the dots a
        // student can count ARE p's numerator. See the header.
        tail: new Array(state.bins).fill(0),
        leadDone: false,
        leadT: 0,
        phase: "pool", // 'pool' | 'deal' | 'drop'
        phaseT: 0,
        sinceCommit: 0,
        streamFrom: -1,
        streamT: 0,
        done: false,
      };

      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.reps);
      if (pre > 0) {
        anim.leadDone = true;
        anim.leadT = 1;
      }
      for (let i = 0; i < pre; i += 1) push(anim, state, i);
      anim.pile.clearFlash();
      if (anim.pile.shown >= params.reps) anim.done = true;

      return anim;
    },

    rebuild(anim, { params, state }) {
      const drawn = Math.min(anim.pile.shown, params.reps);
      anim.pile = makeNullPile(state);
      anim.tail = new Array(state.bins).fill(0);
      for (let i = 0; i < drawn; i += 1) push(anim, state, i);
      anim.pile.clearFlash();
      anim.done = anim.pile.shown >= params.reps;
    },

    advance(anim, { dt, params, state }) {
      if (anim.mode === "lead") {
        if (anim.leadDone) return false;
        anim.leadT = Math.min(1, anim.leadT + dt / LEAD_MS);
        if (anim.leadT < 1) return true;
        anim.leadDone = true;
        return false;
      }
      if (!anim.leadDone || anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const hasDetail = anim.pile.shown < state.perms.length;
      const choreo = hasDetail && (stepping || speed.choreo);

      if (choreo) {
        const budget = (stepping ? STEP_MS : speed.ms) * PHASE_FRAC[anim.phase];
        anim.phaseT += dt / Math.max(1, budget);
        if (anim.phaseT < 1) return true;

        if (anim.phase === "pool") {
          anim.phase = "deal";
          anim.phaseT = 0.001;
          return true;
        }
        if (anim.phase === "deal") {
          anim.phase = "drop";
          anim.phaseT = 0.001;
          return true;
        }

        push(anim, state, anim.pile.shown);
        anim.phase = "pool";
        anim.phaseT = 0;
        if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
        if (stepping) return halt(anim);
        return true;
      }

      if (speed.ms > 0) {
        anim.sinceCommit += dt;
        while (anim.sinceCommit >= speed.ms && anim.pile.shown < params.reps) {
          anim.sinceCommit -= speed.ms;
          push(anim, state, anim.pile.shown);
        }
      } else {
        if (anim.streamFrom < 0) anim.streamFrom = anim.pile.shown;
        anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
        const target = Math.min(
          params.reps,
          anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.reps - anim.streamFrom))
        );
        while (anim.pile.shown < target) push(anim, state, anim.pile.shown);
      }

      if (anim.pile.shown >= params.reps) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- *
   *   the study   two boxes of fixed size, and what is in them right now
   *   the null    every difference the shuffling produced                   */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { n, values, dataDomain, domain, observed } = state;
    const pile = anim.pile;
    const total = pile.shown;
    const inFlight = anim.leadDone && anim.phaseT > 0 && total < params.reps;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    const top = { x: ML, y: 30, w: plotW, h: 150 };
    const bottomY = top.y + top.h + 58;
    const bottom = { x: ML, y: bottomY, w: plotW, h: Math.max(120, h - bottomY - 40) };

    const boxA = top.y + 24;
    const pool = top.y + 66;
    const boxB = top.y + 108;
    const meansY = top.y + 140;
    const BOX_H = 30;

    const ps = makePlot({ ctx, colors, rect: top, xDomain: dataDomain, yDomain: [0, 1] });
    const shown = anim.leadDone ? labelsInView({ state, anim, inFlight }) : null;

    /* -- upper panel: the study ------------------------------------------ */
    ps.caption(
      !anim.leadDone
        ? "Your study — nothing run yet · you get one, and it is the same numbers for every shuffle"
        : inFlight
          ? "Your study — the same numbers, dealt into the groups a different way"
          : shown.real
            ? "Your study — the real grouping"
            : "Your study — the last shuffled grouping"
    );

    // The two containers. Always present, always the same size: a permutation
    // reassigns membership and never the group sizes.
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (const cy of [boxA, boxB]) {
      roundRect(ctx, top.x - 8, cy - BOX_H / 2, top.w + 16, BOX_H, 6);
      ctx.stroke();
    }
    ctx.fillStyle = colors.ink3;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`GROUP A · n = ${n}`, top.x - 8, boxA - BOX_H / 2 - 3);
    ctx.fillText(`GROUP B · n = ${n}`, top.x - 8, boxB - BOX_H / 2 - 3);
    ctx.restore();

    if (anim.leadDone) {
      drawStudy({ ctx, colors, ps, state, anim, shown, geom: { boxA, pool, boxB }, inFlight });
      drawGroupMeans({ ctx, colors, ps, state, labels: shown.settled, y: meansY });
    } else if (anim.leadT > 0) {
      drawLeadInFlight({ ctx, colors, ps, state, anim, geom: { boxA, boxB } });
    }

    ps.axisX({ label: "observation value" });

    /* -- lower panel: the null ------------------------------------------- */
    const f = pile.frame();
    const pn = makePlot({ ctx, colors, rect: bottom, xDomain: domain, yDomain: [0, f.yMax] });

    pn.caption(
      !anim.leadDone
        ? "What chance alone produces — run the study first"
        : total === 0
          ? "What chance alone produces — nothing shuffled yet"
          : `What chance alone produces — ${total} shuffle${total === 1 ? "" : "s"}`
    );

    const ticks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    pn.grid(ticks);

    pile.draw(pn, f, { colors, smooth: false });

    /* The tail bins overdrawn, so the lit marks sit on top of the ordinary
       ones. Same technique the pile itself uses for the landing flash. */
    if (total > 0) {
      const opts = { lo: pile.lo, width: pile.width, fill: colors.highlight };
      if (f.barMix > 0) pn.bars(anim.tail, { ...opts, opacity: f.barMix });
      if (f.barMix < 1) pn.dotColumns(anim.tail, { ...opts, opacity: 1 - f.barMix, maxR: 6 });
    }

    /* The observed difference, and its mirror. Only the observed line is
       labelled: with a small observed difference the two lines sit close
       together, and two labels smear into each other — which is exactly the
       null-is-true case this widget most wants to be readable. */
    if (anim.leadDone) {
      pn.vline(-observed, { stroke: colors.empirical, width: 1 });
      pn.vline(observed, {
        stroke: colors.empirical,
        width: 2,
        label: `observed ${fmt(observed)} · and as far the other way`,
        align: observed > 0 ? "left" : "right",
      });
    }

    pn.axisY({ ticks, label: "count" });
    pn.axisX({ label: "difference in means, after shuffling" });

    if (inFlight && anim.phase === "drop") {
      drawDrop({ ctx, colors, ps, pn, state, anim, y0: top.y + top.h - 12 });
    }
  },

  /* --- readout ---------------------------------------------------------- *
   * p is a count over a count, and the tiles say nothing whatever about the
   * hypothesis being true. "As extreme or more" is the number of lit marks in
   * the panel above, so the two can be checked against each other.           */

  readout({ params, state, anim }) {
    const { observed, delta } = state;
    const total = anim.pile.shown;
    const k = extremeCount(state, total);
    const p = total ? k / total : NaN;
    // Shown alongside k/N rather than instead of it: a permutation p-value can
    // never truly be 0, because the arrangement you observed is always at least
    // as extreme as itself.
    const adj = (k + 1) / (total + 1);

    return [
      {
        label: "Observed difference",
        value: anim.leadDone ? fmt(observed) : "—",
        note: anim.leadDone ? "x̄B − x̄A, from one study" : "study not run yet",
      },
      { label: "True effect", value: fmt(delta), note: "you never see this" },
      {
        label: "As extreme or more",
        value: total ? `${k} of ${total}` : "—",
        note: "the lit marks above",
      },
      {
        label: "p-value",
        value: total ? fmt(p, 3) : "—",
        note: total ? `= ${k}/${total} · never-zero form ${fmt(adj, 3)}` : "",
      },
    ];
  },
});

/* --- helpers ------------------------------------------------------------ */

/** Fold shuffle `i` into the pile, keeping the lit-count in step with it. */
function push(anim, state, i) {
  const d = state.diffs[i];
  const bin = anim.pile.push(d);
  if (bin >= 0 && Math.abs(d) >= Math.abs(state.observed) - 1e-12) anim.tail[bin] += 1;
}

function extremeCount(state, total) {
  let k = 0;
  for (let i = 0; i < total; i += 1) {
    if (Math.abs(state.diffs[i]) >= Math.abs(state.observed) - 1e-12) k += 1;
  }
  return k;
}

function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  anim.pile.clearFlash();
  return false;
}

/**
 * Which labelling is on screen: the one being moved away from, the one being
 * moved to, and the one the group means should be computed from.
 *
 * Between shuffles both are the last arrangement used, so the figure holds
 * still at whatever it just produced.
 */
function labelsInView({ state, anim, inFlight }) {
  const at = anim.pile.shown;
  // Only the first KEEP shuffles retain their labelling, so past that there is
  // no shuffled arrangement to show and the real one is displayed instead. The
  // caption has to say which, or it claims a grouping the figure is not showing.
  const kept = at > 0 ? state.perms[at - 1] : null;
  const prev = kept ?? state.labels;
  const real = !kept;
  const next = state.perms[at] ?? prev;
  if (!inFlight) return { from: prev, to: prev, settled: prev, real };
  // Mid-flight the means belong to whichever end the dots are nearer.
  return { from: prev, to: next, settled: anim.phase === "pool" ? prev : next, real: false };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The study: every observation at its value, in whichever box currently holds
 * it. During a shuffle they rise into a pool and are dealt back — VERTICALLY
 * ONLY, so nothing ever leaves its value. In the pool an observation genuinely
 * belongs to no group, so it is drawn in recessive ink rather than pretending
 * to still belong somewhere.
 */
function drawStudy({ ctx, colors, ps, state, anim, shown, geom, inFlight }) {
  const { boxA, pool, boxB } = geom;
  const rowY = (g) => (g ? boxB : boxA);
  const t = clamp01(anim.phaseT);

  for (let i = 0; i < state.values.length; i += 1) {
    const x = ps.sx(state.values[i]);
    let y;
    let fill;

    if (!inFlight) {
      y = rowY(shown.settled[i]);
      fill = shown.settled[i] ? colors.groupB : colors.groupA;
    } else if (anim.phase === "pool") {
      y = lerp(rowY(shown.from[i]), pool, easeInOut(t));
      fill = t > 0.55 ? colors.ink3 : (shown.from[i] ? colors.groupB : colors.groupA);
    } else if (anim.phase === "deal") {
      y = lerp(pool, rowY(shown.to[i]), easeInOut(t));
      fill = t < 0.45 ? colors.ink3 : (shown.to[i] ? colors.groupB : colors.groupA);
    } else {
      y = rowY(shown.to[i]);
      fill = shown.to[i] ? colors.groupB : colors.groupA;
    }

    pin(ctx, colors, x, y, 5, fill, 1);
  }

  // Naming the pool is most of its value — it is the null hypothesis in words,
  // at the moment the picture is making it.
  if (inFlight && (anim.phase === "pool" || anim.phase === "deal")) {
    const vis = anim.phase === "pool" ? clamp01((t - 0.4) / 0.3) : clamp01((0.6 - t) / 0.3);
    label(ctx, colors, "one pool — under H₀ the split means nothing", ps.x + ps.w, pool - 16, vis, "right");
  }
}

/** The two group means, on the study panel's baseline: the statistic, in place. */
function drawGroupMeans({ ctx, colors, ps, state, labels, y }) {
  const { values, n } = state;
  let a = 0;
  let b = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (labels[i]) b += values[i];
    else a += values[i];
  }
  const mA = a / n;
  const mB = b / n;

  ctx.save();
  ctx.strokeStyle = colors.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ps.sx(mA), y);
  ctx.lineTo(ps.sx(mB), y);
  ctx.stroke();
  ctx.restore();

  /* No "x̄A" / "x̄B" text. The ticks are already in their group's colour, which
     says the same thing without a label — and the labels sat close enough to
     the axis below to collide with its tick numbers, which is worse than
     unlabelled. The only text here is the gap, because the gap is the
     statistic. */
  for (const [m, c] of [[mA, colors.groupA], [mB, colors.groupB]]) {
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ps.sx(m), y - 6);
    ctx.lineTo(ps.sx(m), y + 6);
    ctx.stroke();
    ctx.restore();
  }

  label(ctx, colors, fmt(mB - mA), (ps.sx(mA) + ps.sx(mB)) / 2, y - 8, 1);
}

/** Stage one: the study arriving, then its difference falling into the null. */
function drawLeadInFlight({ ctx, colors, ps, state, anim, geom }) {
  const t = clamp01(anim.leadT);
  const rowY = (g) => (g ? geom.boxB : geom.boxA);

  for (let i = 0; i < state.values.length; i += 1) {
    const at = (i / state.values.length) * LEAD_ARRIVE;
    const grow = clamp01((t - at) / 0.12);
    if (grow <= 0) continue;
    pin(
      ctx, colors,
      ps.sx(state.values[i]),
      rowY(state.labels[i]),
      5 * grow,
      state.labels[i] ? colors.groupB : colors.groupA,
      1
    );
  }
}

/** The shuffled difference falling out of the study and into the null. */
function drawDrop({ ctx, colors, ps, pn, state, anim, y0 }) {
  const value = state.diffs[anim.pile.shown];
  const t = clamp01(anim.phaseT);
  const bin = anim.pile.binOf(value);

  const shown = state.perms[anim.pile.shown] ?? state.labels;
  let a = 0;
  let b = 0;
  for (let i = 0; i < state.values.length; i += 1) {
    if (shown[i]) b += state.values[i];
    else a += state.values[i];
  }
  const geom = {
    x0: (ps.sx(a / state.n) + ps.sx(b / state.n)) / 2,
    y0,
    x1: pn.sx(value),
    y1: bin >= 0 ? pn.sy(anim.pile.counts[bin] + 0.5) : pn.bottom,
  };
  const at = dropPoint(t, geom);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = 0; k <= 20; k += 1) {
    const [px, py] = dropPoint((t * k) / 20, geom);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  label(ctx, colors, fmt(value), at[0], at[1] - 12, 1 - t / 0.3);
  pin(ctx, colors, at[0], at[1], 5, colors.highlight, 1);
}

function dropPoint(t, { x0, x1, y0, y1 }) {
  return [
    x0 + (x1 - x0) * easeOut(clamp01(t / 0.6)),
    y0 + (y1 - y0) * easeIn(clamp01(t)),
  ];
}

function pin(ctx, colors, x, y, r, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.restore();
}

function label(ctx, colors, text, x, y, alpha, align = "center") {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.fillStyle = colors.ink1;
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "bottom";
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}
