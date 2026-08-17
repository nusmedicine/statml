/* ============================================================================
   Galton board — widget 1 of the statistics arc.

     INCREMENTS → means → one sample → an interval → a null by shuffling → many nulls

   Answers: why does anything go normal? Because a bell curve is what you get from
   adding up independent little pushes, and nothing more exotic than that.

   Its job is to be a PREREQUISITE. It targets no documented misconception; it
   exists so that the central limit theorem is a thing the student has watched
   happen rather than a rule they were handed. (The catalogue's earning rule was
   amended to admit this route in, on condition that a prerequisite widget names
   the widget it is a prerequisite for. This one names `clt`.)

   THE TEACHING DESIGN:

   - The ball's PATH is the subject, not the pile. At Slow speed one ball descends
     one row at a time, and each row is visibly a fresh coin flip. The bin it ends
     in is just a tally of how many times it went right — which is why the axis is
     labelled "steps right", not "position".

   - The pegs and the pile share one x-axis, and the ball lands in the column it
     finished above. Nothing has to explain the connection.

   - "Lean" exists to break the symmetry. At p = 0.5 a student can suspect the
     bell shape comes from something about the middle. At p = 0.25 the pile is
     still bell-shaped, just somewhere else — which is the actual claim.

   - The exact binomial is available as an overlay because here, unlike in `clt`,
     the truth is a known finite thing rather than an asymptotic promise. Seeing
     the pile converge to the binomial, and the binomial itself look normal, keeps
     the two ideas separate.
   ========================================================================= */

import {
  defineWidget, fmt, makePlot, niceTicks, normalPdf, samplePdf,
  createPile, DOT_R,
} from "../core/index.js";

/* Pacing is chosen, not automatic — same contract as every other widget in the
   arc. Below the choreography threshold a ball still lands and still flashes its
   column; you just do not watch it fall. */
const SPEEDS = {
  slow: { label: "Slow", detail: "watch every step", rowMs: 150, choreo: true },
  medium: { label: "Medium", detail: "watch every step", rowMs: 45, choreo: true },
  fast: { label: "Fast", detail: "balls only, no steps", ms: 110, choreo: false },
  fastest: { label: "Fastest", detail: "fills in at once", ms: 0, choreo: false },
};

// "Drop one" always shows the descent, whatever Play is set to.
const STEP_ROW_MS = 190;
const STREAM_MS = 3000;

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

defineWidget({
  slug: "galton-board",
  title: "Where the bell curve comes from",
  subtitle:
    "A ball meets a row of pegs and goes left or right, over and over. Its final " +
    "column is just a count of how many times it went right. Drop enough balls and " +
    "the pile is a bell curve — that is all a bell curve is.",
  height: 460,

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
      let right = 0;
      const keep = b < KEEP_PATHS ? new Array(rows) : null;
      for (let r = 0; r < rows; r += 1) {
        const goRight = rng.next() < lean ? 1 : 0;
        right += goRight;
        if (keep) keep[r] = goRight;
      }
      landings[b] = right;
      if (keep) paths.push(keep);
    }

    // One bin per outcome 0..rows. Integer bins, so lo sits half a step left.
    const bins = rows + 1;
    const pmf = [];
    for (let k = 0; k <= rows; k += 1) pmf.push(binomPmf(rows, k, lean));

    return {
      landings, paths, bins,
      lo: -0.5,
      width: 1,
      domain: [-0.5, rows + 0.5],
      mean: rows * lean,
      sd: Math.sqrt(rows * lean * (1 - lean)),
      pmf,
      pmfPeak: Math.max(...pmf),
    };
  },

  animation: {
    stepLabel: "Drop one",
    runLabel: "Play",

    init({ params, state, fromScratch }) {
      const anim = {
        pile: makePile(params, state),
        row: 0, //     how many rows the falling ball has cleared
        rowT: 0, //    0..1 within the current row; 0 with row 0 means idle
        sinceCommit: 0,
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
      anim.done = anim.pile.shown >= params.balls;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      const hasPath = anim.pile.shown < state.paths.length;
      const choreo = hasPath && (stepping || speed.choreo);

      if (choreo) {
        const budget = stepping ? STEP_ROW_MS : speed.rowMs;
        anim.rowT += dt / Math.max(1, budget);
        if (anim.rowT < 1) return true;

        anim.rowT = 0.001; // stay non-zero: a zero rowT at row 0 means idle
        anim.row += 1;
        if (anim.row < params.rows) return true;

        // Cleared the last row: the ball lands in the column it finished above.
        anim.pile.push(state.landings[anim.pile.shown]);
        anim.row = 0;
        anim.rowT = 0;
        if (anim.pile.shown >= params.balls) return halt(anim, { finished: true });
        if (stepping) return halt(anim); // one ball per click
        return true;
      }

      if (speed.ms > 0) {
        anim.sinceCommit += dt;
        while (anim.sinceCommit >= speed.ms && anim.pile.shown < params.balls) {
          anim.sinceCommit -= speed.ms;
          anim.pile.push(state.landings[anim.pile.shown]);
        }
      } else {
        if (anim.streamFrom < 0) anim.streamFrom = anim.pile.shown;
        anim.streamT = Math.min(1, anim.streamT + dt / STREAM_MS);
        const target = Math.min(
          params.balls,
          anim.streamFrom + Math.round(easeInOut(anim.streamT) * (params.balls - anim.streamFrom))
        );
        while (anim.pile.shown < target) anim.pile.push(state.landings[anim.pile.shown]);
      }

      if (anim.pile.shown >= params.balls) return halt(anim, { finished: true });
      return true;
    },
  },

  /* --- drawing ---------------------------------------------------------- */

  draw({ ctx, colors, w, h, params, state, anim }) {
    const { rows } = params;
    const pile = anim.pile;
    const total = pile.shown;
    const falling = (anim.row > 0 || anim.rowT > 0) && total < params.balls;

    const ML = 50;
    const MR = 14;
    const plotW = w - ML - MR;

    // The peg field gets a fixed slice; the pile takes what is left. Both use the
    // same x-domain, so a ball lands in the column it finished above.
    const pegH = Math.min(180, Math.max(80, rows * 11));
    const top = { x: ML, y: 24, w: plotW, h: pegH };
    const lowerY = top.y + top.h + 46;
    const bottom = { x: ML, y: lowerY, w: plotW, h: Math.max(90, h - lowerY - 40) };

    const pa = makePlot({ ctx, colors, rect: top, xDomain: state.domain, yDomain: [0, rows] });

    pa.caption(
      falling
        ? `${rows} rows of pegs · ball ${total + 1} is at row ${Math.min(anim.row + 1, rows)}`
        : `${rows} rows of pegs · each one an independent left-or-right step`
    );

    /* -- the peg field -------------------------------------------------- *
     * A ball that has cleared r rows having gone right k times sits at
     * x = k + (rows - r)/2, which centres the triangle and lands it on integer
     * columns at the bottom. Pegs are drawn at every reachable position.     */
    const yOf = (r) => pa.sy(rows - r);
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.globalAlpha = 0.55;
    for (let r = 0; r < rows; r += 1) {
      for (let k = 0; k <= r; k += 1) {
        ctx.beginPath();
        ctx.arc(pa.sx(k + (rows - r) / 2), yOf(r), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    /* -- the ball in flight, and its path so far ------------------------- */
    if (falling) drawFallingBall({ ctx, colors, pa, pb: null, params, state, anim, yOf });

    /* -- the pile -------------------------------------------------------- */
    const f = pile.frame();
    const pb = makePlot({ ctx, colors, rect: bottom, xDomain: state.domain, yDomain: [0, f.yMax] });

    pb.caption(
      total === 0
        ? "Where they land — nothing dropped yet"
        : anim.done
          ? `Where they land — ${total} ball${total === 1 ? "" : "s"}, ${rows} rows`
          : `Where they land — ${total} of ${params.balls} balls`
    );

    const ticks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    pb.grid(ticks);

    pile.draw(pb, f, { colors, smooth: params.smooth, maxR: DOT_R });

    // The exact binomial, in expected-count units so it is directly comparable to
    // the bars. Unlike `clt`'s normal curve this is not an approximation — it is
    // what the pile is converging to, which keeps "the pile goes binomial" and
    // "the binomial looks normal" as two separate ideas.
    if (params.exact && f.barMix > 0) {
      const pts = state.pmf.map((p, k) => [k, p * total]);
      pb.curve(pts, { stroke: colors.theory, width: 2, opacity: f.barMix });
      for (const [k, y] of pts) {
        if (y > f.yMax * 0.02) pb.dot(k, y, { fill: colors.theory, r: 2.5 });
      }
    }

    pb.axisY({ ticks, label: "balls" });
    pb.axisX({
      ticks: rows <= 16 ? Array.from({ length: rows + 1 }, (_, k) => k) : undefined,
      label: "steps right  (the column it ended in)",
    });
  },

  /* --- readout ---------------------------------------------------------- *
   * Prediction beside observation, twice. The predicted values are the binomial's
   * own mean and SD, which is what makes this widget's truth exact rather than
   * asymptotic.                                                              */

  readout({ params, state, anim }) {
    const pile = anim.pile;
    const of = `of ${pile.shown} ball${pile.shown === 1 ? "" : "s"}`;
    return [
      { label: "Predicted mean", value: fmt(state.mean, 2), note: `rows × lean` },
      { label: "Observed mean", value: fmt(pile.mean, 2), note: of },
      { label: "Predicted SD", value: fmt(state.sd, 2), note: "√(n p (1−p))" },
      { label: "Observed SD", value: fmt(pile.sd, 2), note: of },
    ];
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
function drawFallingBall({ ctx, colors, pa, params, state, anim, yOf }) {
  const path = state.paths[anim.pile.shown];
  if (!path) return;

  const { rows } = params;
  const at = (r) => {
    let k = 0;
    for (let i = 0; i < r; i += 1) k += path[i];
    return [pa.sx(k + (rows - r) / 2), yOf(r)];
  };

  const t = clamp01(anim.rowT);
  const from = at(anim.row);
  const to = at(Math.min(anim.row + 1, rows));
  // Gravity: a fall accelerates. Sideways drift eases out, as in `clt`'s drop.
  const x = from[0] + (to[0] - from[0]) * (1 - Math.pow(1 - t, 3));
  const y = from[1] + (to[1] - from[1]) * (t * t);

  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  const start = at(0);
  ctx.moveTo(start[0], start[1]);
  for (let r = 1; r <= anim.row; r += 1) {
    const p = at(r);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Which way it just went, named — the step is the idea, not the position.
  if (anim.row < rows) {
    const wentRight = path[anim.row] === 1;
    ctx.globalAlpha = clamp01(t * 2);
    ctx.fillStyle = colors.ink2;
    ctx.font = `600 ${colors.fsXs} ${colors.font}`;
    ctx.textAlign = wentRight ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(wentRight ? "right" : "left", x + (wentRight ? 9 : -9), y);
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = colors.highlight;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
  ctx.restore();
}
