/* ============================================================================
   Galton board — widget 1 of the statistics arc.

     INCREMENTS → means → one sample → an interval → a null by shuffling → many nulls

   Answers: why does anything go normal? Because a bell curve is what you get from
   adding up independent little pushes, and nothing more exotic than that.

   THE AXIS IS A DEVIATION, NOT A COUNT. Each row nudges the ball one step, −1 or
   +1, and the plotted value is the SUM of those nudges: zero in the middle, −1 −2
   −3 to the left, +1 +2 +3 to the right. That is deliberate and it is what makes
   this widget the start of the arc rather than a probability curiosity — the
   picture the student ends up with is *how far a total of many small independent
   errors strays from zero*, which is the shape every later widget reuses.

   A consequence worth not hiding: after an even number of rows only even totals
   are reachable, after an odd number only odd ones. The bins sit two apart for
   exactly that reason. A ball cannot be one step from centre after twelve steps.

   Its job is to be a PREREQUISITE. It targets no documented misconception; it
   exists so that the central limit theorem is a thing the student has watched
   happen rather than a rule they were handed. (The catalogue's earning rule was
   amended to admit this route in, on condition that a prerequisite widget names
   the widget it is a prerequisite for. This one names `clt`.)

   THE TEACHING DESIGN:

   - The ball's PATH is the subject, not the pile. At Slow speed one ball descends
     one row at a time, and each row is visibly a fresh coin flip.

   - The pegs and the pile share one x-axis, and a ball's horizontal position IS its
     running deviation, so it lands in the column it finished above. Nothing has to
     explain the connection — and `deviationAfter()` is the single function both the
     board and the histogram get their geometry from, which is not optional: when
     they each had their own copy of the formula, the falling ball silently sat six
     columns off-centre while every settled test still passed.

   - "Lean" exists to break the symmetry. At p = 0.5 a student can suspect the
     bell shape comes from something about the middle. At p = 0.25 the pile is
     still bell-shaped, just somewhere else — which is the actual claim.

   - The exact binomial is available as an overlay because here, unlike in `clt`,
     the truth is a known finite thing rather than an asymptotic promise. Seeing
     the pile converge to the binomial, and the binomial itself look normal, keeps
     the two ideas separate.
   ========================================================================= */

import {
  defineWidget, fmt, makePlot, niceTicks, spanningRule,
  createPile, DOT_R,
} from "../core/index.js";

/* Pacing is chosen, not automatic — same contract as every other widget in the
   arc. Each tier must show something the tier below it does not, or it is not a
   speed, just a wait:

     Slow     one ball, slowly enough to read each left-or-right step
     Medium   one ball at a time, quick but still a whole descent
     Fast     a CASCADE — several balls in the air at once, like a real board
     Fastest  no descent at all, the pile just fills

   `releaseMs: null` means release the next ball only when the last has landed, so
   exactly one is ever falling. A number smaller than the whole descent
   (rows × rowMs) puts several in the air.

   Fast used to run at 110 ms per ball with the descent switched off, which made it
   slower than Fastest while showing strictly less — a tier that cost time and
   bought nothing. */
const SPEEDS = {
  slow: { label: "Slow", detail: "one ball, every step", rowMs: 150, releaseMs: null, choreo: true },
  medium: { label: "Medium", detail: "one ball at a time", rowMs: 45, releaseMs: null, choreo: true },
  fast: { label: "Fast", detail: "a cascade of balls", rowMs: 14, releaseMs: 30, choreo: true },
  fastest: { label: "Fastest", detail: "fills in at once", rowMs: 0, releaseMs: 0, choreo: false },
};

// "Drop one" always shows one whole descent, whatever Play is set to.
const STEP_ROW_MS = 190;
const STREAM_MS = 3000;

// Past this many trails the board is scribble rather than mechanism, so a cascade
// shows the balls without their paths — the flow is the point there, not one route.
const TRAIL_LIMIT = 2;

// Guard against an unbounded flight list if a frame is pathologically long.
const MAX_IN_FLIGHT = 32;

// Paths retained for the reveal. Past this the descent is too fast to read.
const KEEP_PATHS = 96;

const easeInOut = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** log C(n,k), via lgamma, so the binomial stays exact at n = 30. */
function logChoose(n, k) {
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}

/** Lanczos approximation — plenty for drawing a pmf. */
function lgamma(z) {
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

const binomPmf = (n, k, p) =>
  Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));

/**
 * Running deviation after `r` of a path's nudges: rights minus lefts.
 *
 * THE ONLY PLACE THIS GEOMETRY IS WRITTEN. `compute` uses it for the landing value
 * and `drawFallingBall` uses it for the ball's position at every depth, so the
 * board and the histogram cannot disagree about where a ball is.
 *
 * They did once: the landing moved to deviation units and the falling ball kept the
 * old peg-lattice formula, which put every path six columns to the right and made
 * balls start off-centre. Two call sites, one formula each, is how that happens.
 */
function deviationAfter(path, r) {
  let rights = 0;
  for (let i = 0; i < r; i += 1) rights += path[i];
  return 2 * rights - r;
}

defineWidget({
  slug: "galton-board",
  title: "The Normal Distribution",
  subtitle:
    "Each row of pegs nudges the ball one step left or right. Where it lands is the " +
    "sum of those independent nudges, so the pile shows how far many small random " +
    "errors, added together, stray from zero. That is all a bell curve is.",
  height: 520,

  params: {
    rows: { type: "int", label: "Rows of pegs", min: 2, max: 30, default: 12 },
    lean: {
      type: "float", label: "Lean (chance of going right)",
      min: 0.1, max: 0.9, step: 0.05, default: 0.5,
      format: (v) => v.toFixed(2),
    },
    balls: {
      type: "int", label: "Balls to drop", min: 1, max: 2000, step: 1, default: 300,
      // Extending the plan does not invalidate what has landed.
      display: true,
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },
    speed: {
      type: "choice", label: "Play speed",
      options: Object.entries(SPEEDS).map(([value, s]) => ({ value, label: s.label, detail: s.detail })),
      default: "medium",
      display: true,
    },
    smooth: { type: "bool", label: "Smoothed density", default: true, display: true },
    exact: { type: "bool", label: "Exact binomial", default: true, display: true },
    shown: { type: "int", label: "Pre-dropped balls", min: 0, max: 2000, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "Balls landed", mark: "bar" },
    { token: "smoothed", label: "Smoothed density of the pile", mark: "line" },
    { token: "theory", label: "Exact binomial, expected count", mark: "line" },
    { token: "highlight", label: "The ball falling now", mark: "dot" },
  ],

  /* --- data ------------------------------------------------------------- *
   * Every ball's whole path is decided up front, so the animation is a reveal of
   * fixed data and Play lands exactly where the seed says it will.           */

  compute({ params, rng }) {
    const { rows, lean, balls } = params;
    const landings = new Array(balls);
    const paths = [];

    for (let b = 0; b < balls; b += 1) {
      // Always build the path, so the landing comes from deviationAfter() and not
      // from a second copy of the formula. Only the first few are retained for the
      // reveal; the rest is a transient array of at most `rows` entries.
      const path = new Array(rows);
      for (let r = 0; r < rows; r += 1) path[r] = rng.next() < lean ? 1 : 0;
      landings[b] = deviationAfter(path, rows);
      if (b < KEEP_PATHS) paths.push(path);
    }

    /* One bin per reachable total. Reachable totals are -rows, -rows+2, … +rows —
       two apart, because a step is ±1 and parity is fixed by the number of rows.
       Bin width 2 makes the bars tile continuously with centres on those totals. */
    const bins = rows + 1;
    const pmf = [];
    for (let k = 0; k <= rows; k += 1) pmf.push(binomPmf(rows, k, lean));

    return {
      landings, paths, bins,
      lo: -(rows + 1),
      width: 2,
      domain: [-(rows + 1), rows + 1],
      // A step is +1 with probability p and −1 otherwise, so the total has
      // mean n(2p − 1) and variance 4np(1 − p).
      mean: rows * (2 * lean - 1),
      sd: 2 * Math.sqrt(rows * lean * (1 - lean)),
      pmf,
      // pmf[k] is the probability of the total 2k − rows.
      totalFor: (k) => 2 * k - rows,
      pmfPeak: Math.max(...pmf),
    };
  },

  animation: {
    stepLabel: "Drop one",
    runLabel: "Play",

    init({ params, state, fromScratch }) {
      const anim = {
        pile: makePile(params, state),
        /* Balls currently in the air, oldest first: [{ i, fall }].
           `fall` is rows fallen as one continuous quantity rather than a row index
           plus a fraction — a frame long enough to span two rows must advance two
           rows, or the descent is frame-rate-bound and slower than its own budget.
           They fall at the same rate, so they land in release order and can be
           folded into the pile from the front. */
        flight: [],
        sinceRelease: 0,
        streamFrom: -1,
        streamT: 0,
        done: false,
      };

      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), params.balls);
      for (let i = 0; i < pre; i += 1) anim.pile.push(state.landings[i]);
      anim.pile.clearFlash();
      if (anim.pile.shown >= params.balls) anim.done = true;

      return anim;
    },

    rebuild(anim, { params, state }) {
      const dropped = Math.min(anim.pile.shown, params.balls);
      anim.pile = makePile(params, state);
      anim.pile.rebuild(state.landings.slice(0, dropped));
      // Balls in the air keep falling. No display parameter here alters the binning
      // or the paths — bins are rows + 1, and with the seed and rows fixed the first
      // k paths are the same k paths — so discarding them would lose balls the
      // student is watching. Drop only those whose path or slot is gone.
      anim.flight = anim.flight.filter((b) => b.i < state.paths.length && b.i < params.balls);
      anim.done = anim.pile.shown >= params.balls;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const rowMs = stepping ? STEP_ROW_MS : speed.rowMs;
      // Next ball not yet landed and not yet released.
      const nextIndex = () => anim.pile.shown + anim.flight.length;
      const hasPath = nextIndex() < state.paths.length;
      const choreo = hasPath && (stepping || speed.choreo);

      if (choreo) {
        // Release. `null` means strictly one at a time; a smaller interval than the
        // whole descent is what makes Fast a cascade rather than a queue.
        const releaseMs = speed.releaseMs ?? params.rows * rowMs;
        if (anim.flight.length === 0) {
          anim.flight.push({ i: nextIndex(), fall: 0 });
          anim.sinceRelease = 0;
        } else if (!stepping) {
          anim.sinceRelease += dt;
          while (
            anim.sinceRelease >= releaseMs &&
            anim.flight.length < MAX_IN_FLIGHT &&
            nextIndex() < params.balls &&
            nextIndex() < state.paths.length
          ) {
            anim.sinceRelease -= releaseMs;
            anim.flight.push({ i: nextIndex(), fall: 0 });
          }
        }

        for (const b of anim.flight) b.fall += dt / Math.max(1, rowMs);

        // Land from the front: same fall rate means release order is landing order.
        let landed = 0;
        while (anim.flight.length && anim.flight[0].fall >= params.rows) {
          anim.pile.push(state.landings[anim.flight[0].i]);
          anim.flight.shift();
          landed += 1;
        }

        if (anim.pile.shown >= params.balls) return halt(anim, { finished: true });
        if (stepping && landed) return halt(anim); // one ball per click
        return true;
      }

      /* Balls part-way down must not simply be abandoned. Switching to a
         non-choreographed speed used to leave a half-drawn path frozen over the
         board while other balls streamed into the pile. Land them first. */
      while (anim.flight.length) {
        anim.pile.push(state.landings[anim.flight[0].i]);
        anim.flight.shift();
      }
      if (anim.pile.shown >= params.balls) return halt(anim, { finished: true });

      if (anim.streamFrom < 0) anim.streamFrom = anim.pile.shown;
      anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
      const target = Math.min(
        params.balls,
        anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.balls - anim.streamFrom))
      );
      while (anim.pile.shown < target) anim.pile.push(state.landings[anim.pile.shown]);

      if (anim.pile.shown >= params.balls) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { rows } = params;
    const pile = anim.pile;
    const total = pile.shown;
    const inAir = anim.flight.length;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    // The peg field gets a fixed slice; the pile takes what is left. Both use the
    // same x-domain, so a ball lands in the column it finished above. The board
    // wants real vertical room — a squashed triangle makes the descent read as a
    // sideways drift rather than a fall.
    const pegH = Math.min(250, Math.max(110, rows * 15));
    const top = { x: ML, y: 24, w: plotW, h: pegH };
    const lowerY = top.y + top.h + 46;
    const bottom = { x: ML, y: lowerY, w: plotW, h: Math.max(90, h - lowerY - 40) };

    const pa = makePlot({ ctx, colors, rect: top, xDomain: state.domain, yDomain: [0, rows] });

    /* One rule at zero for the whole figure — the value a ball would land on if
       every nudge cancelled. It is the point of the deviation framing: the pile is
       symmetric about no-error, and when Lean is off 0.5 you watch the pile drift
       off this line, which is what bias looks like. */
    spanningRule(ctx, colors, {
      x: pa.sx(0),
      y0: top.y,
      y1: bottom.y + bottom.h,
      label: "0",
    });

    pa.caption(
      inAir === 1
        ? `${rows} rows of pegs · ball ${total + 1} is at row ${Math.min(Math.floor(anim.flight[0].fall) + 1, rows)}`
        : inAir > 1
          ? `${rows} rows of pegs · ${inAir} balls falling`
          : `${rows} rows of pegs · each one an independent left-or-right step`
    );

    /* -- the peg field -------------------------------------------------- *
     * In deviation units a ball that has cleared r rows having gone right k times
     * sits at 2k − r. So the lattice is every reachable total at every depth, and
     * the ball's horizontal position IS its running deviation — the board and the
     * histogram below are literally the same axis.                            */
    const yOf = (r) => pa.sy(rows - r);
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.globalAlpha = 0.55;
    for (let r = 0; r < rows; r += 1) {
      for (let k = 0; k <= r; k += 1) {
        ctx.beginPath();
        ctx.arc(pa.sx(2 * k - r), yOf(r), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    /* -- the balls in flight, and their paths so far ---------------------- */
    for (const ball of anim.flight) {
      drawFallingBall({ ctx, colors, pa, params, state, ball, yOf, trail: inAir <= TRAIL_LIMIT });
    }

    /* -- the pile -------------------------------------------------------- */
    const f = pile.frame();
    const pb = makePlot({ ctx, colors, rect: bottom, xDomain: state.domain, yDomain: [0, f.yMax] });

    pb.caption(
      total === 0
        ? "Total deviation from centre — nothing dropped yet"
        : anim.done
          ? `Total deviation from centre — ${total} ball${total === 1 ? "" : "s"}, ${rows} nudges each`
          : `Total deviation from centre — ${total} of ${params.balls} balls`
    );

    const ticks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    pb.grid(ticks);

    pile.draw(pb, f, { colors, smooth: params.smooth, maxR: DOT_R });

    // The exact binomial, in expected-count units so it is directly comparable to
    // the bars. Unlike `clt`'s normal curve this is not an approximation — it is
    // what the pile is converging to, which keeps "the pile goes binomial" and
    // "the binomial looks normal" as two separate ideas.
    if (params.exact && f.barMix > 0) {
      const pts = state.pmf.map((p, k) => [state.totalFor(k), p * total]);
      pb.curve(pts, { stroke: colors.theory, width: 2, opacity: f.barMix });
      for (const [x, y] of pts) {
        if (y > f.yMax * 0.02) pb.dot(x, y, { fill: colors.theory, r: 2.5 });
      }
    }

    pb.axisY({ ticks, label: "balls" });
    // Symmetric, even-numbered ticks that always include 0 — the axis has to read
    // as a deviation scale, so zero must be a labelled tick and not an inference.
    const tickStep = Math.max(2, 2 * Math.ceil(rows / 6));
    const xTicks = [];
    for (let v = -Math.floor(rows / tickStep) * tickStep; v <= rows; v += tickStep) xTicks.push(v);
    pb.axisX({
      ticks: xTicks,
      format: (v) => (v > 0 ? `+${v}` : String(v)),
      label: "total deviation  (each row is one step: −1 left, +1 right)",
    });
  },

  /* --- no readout ------------------------------------------------------- *
   * Deliberately no stat tiles. This widget's job is qualitative: a bell shape
   * emerging from accumulated randomness. Printing predicted-versus-observed mean
   * and SD invites the student to check arithmetic instead of watching a shape
   * appear, and the quantitative argument belongs to `clt`, where σ/√n is the
   * actual claim.
   *
   * Canvas is not screen-readable, so the reading of the figure is carried in
   * text by `summary` instead — same obligation, no numbers on screen.        */

  summary({ params, state, anim }) {
    const total = anim.pile.shown;
    if (total === 0) {
      return (
        `A Galton board with ${params.rows} rows of pegs, each nudging a ball one step ` +
        `left or right. The chart below plots the total deviation from centre, zero in ` +
        `the middle. Nothing dropped yet — press Drop one.`
      );
    }
    const peak = state.totalFor(anim.pile.counts.indexOf(Math.max(...anim.pile.counts)));
    return (
      `${params.rows} nudges per ball, each going right with probability ${fmt(params.lean, 2)}. ` +
      `${total} ball${total === 1 ? "" : "s"} dropped. Deviations run from ${-params.rows} to ` +
      `+${params.rows}; the tallest column is at ${peak > 0 ? "+" : ""}${peak}, and the pile ` +
      `${total < 20 ? "is still sparse" : "tapers away symmetrically, close to the binomial"}. ` +
      `Mean deviation ${fmt(anim.pile.mean, 2)}, against ${fmt(state.mean, 2)} expected.`
    );
  },
});

/* --- helpers ------------------------------------------------------------ */

function makePile(params, state) {
  return createPile({
    bins: state.bins,
    lo: state.lo,
    width: state.width,
    headroomFor: (total) => (params.exact ? state.pmfPeak * total : 0),
  });
}

function halt(anim, { finished = false } = {}) {
  if (finished) anim.done = true;
  anim.pile.clearFlash();
  return false;
}

/**
 * The descent. A ball's position after clearing r of `rows` rows, having gone
 * right k times, is x = k + (rows - r)/2 — so the triangle stays centred and the
 * final position is the column index itself.
 *
 * The path travelled so far is drawn behind the ball, because the whole point is
 * that the landing column is an accumulation of steps rather than a destination.
 */
function drawFallingBall({ ctx, colors, pa, params, state, ball, yOf, trail }) {
  const path = state.paths[ball.i];
  if (!path) return;

  const { rows } = params;
  // Same geometry as the landing value, from the same function. At r = 0 this is
  // 0, so every ball starts on the zero rule; at r = rows it is the landing.
  const at = (r) => [pa.sx(deviationAfter(path, r)), yOf(r)];

  const row = Math.min(Math.floor(ball.fall), rows - 1);
  const t = clamp01(ball.fall - row);
  const from = at(row);
  const to = at(row + 1);
  // Gravity: a fall accelerates. Sideways drift eases out, as in `clt`'s drop.
  const x = from[0] + (to[0] - from[0]) * (1 - Math.pow(1 - t, 3));
  const y = from[1] + (to[1] - from[1]) * (t * t);

  ctx.save();

  if (trail) {
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    const start = at(0);
    ctx.moveTo(start[0], start[1]);
    for (let r = 1; r <= row; r += 1) {
      const p = at(r);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Which way it just went, named — the step is the idea, not the position.
    // Only worth saying when a single ball is being followed.
    const wentRight = path[row] === 1;
    ctx.globalAlpha = clamp01(t * 2);
    ctx.fillStyle = colors.ink2;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = wentRight ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(wentRight ? "right" : "left", x + (wentRight ? 9 : -9), y);
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(x, y, trail ? 5 : 4, 0, Math.PI * 2);
  ctx.fillStyle = colors.highlight;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.restore();
}
