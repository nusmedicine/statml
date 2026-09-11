/* ============================================================================
   Widget 55 · Optimizers — the engine, the landscape, the geometry and the
   copy. `main.js` draws what is here; nothing here touches the DOM, so
   `_lab/optimizers-verify.mjs` can assert all of it in node.

   PHM5005 05-4 cells 41-44 (the optimizer table and the `optim.SGD`,
   `optim.Adam`, `optim.AdamW` syntax cells) and 82-86 (the scheduler table,
   with StepLR and ReduceLROnPlateau).

   THE UPDATE RULES, THE SCHEDULERS, THE `wells` FACTORY AND `polish` ARE
   `_lab/dl-optim-measure.mjs`'s OWN CODE, comments and all. That script's
   numbers chose this landscape, and `_lab/dl-optim-torch.py` ran the same two
   surfaces through torch 2.14 and printed 60 trace lines that agree with them
   to 1e-6. Copying the rules rather than re-deriving them is what keeps the
   widget's walk and the survey's table the same walk; the verify script
   re-runs the 60 lines against `_lab/dl-optim-torch.txt` on every `npm test`.

   The one change to `run` is that it records the step's PARTS as well as its
   position — the gradient it read, the displacement it made, and the rate it
   used — because the rescale panel draws them. No arithmetic moved: `before`
   is read off `theta` and `rateUsed` off `opt.lr`, both before `opt.step`.

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. ONE SURFACE, NO `landscape` CONTROL (catalogue § Slot 55, PICKED
       2026-09-11): the trench — a faint bowl with a global well stretched
       along x at (1.6, 0) and a round local well 0.35 deep at (-1.6, 0.4).
       It is the only candidate that carries the plain, the trap, the narrow
       valley and the overshoot at once.

    2. THE GEOMETRY IS ONE FUNCTION. `M.layout(w, hasRate)` returns every rect
       the page draws in and its own height; `height`, `draw` and the verify
       script all ask it (5.8). The rate strip is drawn only under a scheduler,
       so the stage is taller then — a height that is a function of the
       parameters, as `bayesian`'s is.

    3. THE WHOLE TRAJECTORY OF EVERY METHOD IS COMPUTED ONCE. `compute` walks
       all four rules for 500 steps from the same start and the animation
       reveals index `k` of the arrays (non-negotiable 2). That is what lets
       `compare` be a display parameter: the other three walks are already
       there, so toggling them draws nothing new and resets nothing.

    4. THE RAMP IS log10(1 + (f - fmin)/0.05), CAPPED AT THE FRAME'S OWN RANGE.
       The loss here is a difference and not a ratio, so there is no "times the
       least loss" to take a log of; 0.05 is the scale at which a well stops
       reading as flat. A linear ramp paints both wells as one dot. The mock
       (`_lab/optimizers-mock.html`) drew it and it is the picture Kenneth
       picked from.

    5. THE `lr` DETAILS ARE COMPUTED FROM THE ENGINE AT LOAD, never typed.
       A rung's line is a claim about what happens on this landscape at that
       rate, and a typed one goes stale the moment a constant moves. They are
       built from the default start, and each names the start it is about,
       because a `detail` is shown in every state of the other controls and a
       claim on a shared surface has to be true in all of them (2.11).

    6. THE START IS A FACE OR A DRAG, AND THE RAIL CANNOT LIE ABOUT WHICH.
       `x0` and `y0` are hidden data floats, unset (`null`) until the marker is
       dragged. The drag writes all three of `start`, `x0` and `y0` in one
       transaction, and `start` then reads `dragged`, a fourth face labelled
       *Where the marker is* that the option list offers only while the two
       coordinates are set. Picking a named face clears them again, so the four
       faces collapse back to three and the link carries a sentence rather than
       a pair of numbers (3.6, 5.9).
   ========================================================================= */

/* ---- torch.optim's update rules ------------------------------------------ */

export function makeOptimizer(kind, lr0) {
  const s = { t: 0, buf: [0, 0], m: [0, 0], v: [0, 0], sq: [0, 0] };
  const EPS = 1e-8;
  return {
    kind,
    lr: lr0,
    /* theta and g are [x, y]; mutates theta, as torch does */
    step(theta, g) {
      s.t += 1;
      const lr = this.lr;
      for (let i = 0; i < 2; i += 1) {
        switch (kind) {
          case "sgd":
            theta[i] -= lr * g[i];
            break;
          case "momentum": {
            /* torch.optim.SGD(momentum=0.9, dampening=0): buf = g on the first
               step, then buf = mu*buf + g; theta -= lr*buf. The lr multiplies
               the buffer, so it is not folded into it as in the classical
               (and netlify) form v = mu*v + lr*g. */
            s.buf[i] = s.t === 1 ? g[i] : 0.9 * s.buf[i] + g[i];
            theta[i] -= lr * s.buf[i];
            break;
          }
          case "rmsprop": {
            /* torch.optim.RMSprop(alpha=0.99, eps=1e-8): eps OUTSIDE the root */
            s.sq[i] = 0.99 * s.sq[i] + 0.01 * g[i] * g[i];
            theta[i] -= (lr * g[i]) / (Math.sqrt(s.sq[i]) + EPS);
            break;
          }
          case "adam":
          case "adamw": {
            /* torch.optim.Adam(betas=(0.9, 0.999), eps=1e-8); AdamW applies
               the decoupled decay theta *= 1 - lr*wd BEFORE the Adam step,
               wd = 0.01 its default. */
            if (kind === "adamw") theta[i] *= 1 - lr * 0.01;
            s.m[i] = 0.9 * s.m[i] + 0.1 * g[i];
            s.v[i] = 0.999 * s.v[i] + 0.001 * g[i] * g[i];
            const bc1 = 1 - 0.9 ** s.t;
            const bc2 = 1 - 0.999 ** s.t;
            const denom = Math.sqrt(s.v[i]) / Math.sqrt(bc2) + EPS;
            theta[i] -= ((lr / bc1) * s.m[i]) / denom;
            break;
          }
          default:
            throw new Error(kind);
        }
      }
    },
  };
}

/* ---- torch.optim.lr_scheduler, the two the notebook gives syntax for ----- */

export function makeScheduler(kind, opt) {
  const base = opt.lr;
  let best = Infinity;
  let bad = 0;
  let n = 0;
  return {
    /* called once per step with that step's loss, as the notebook's loop calls
       scheduler.step() (StepLR) or scheduler.step(avg_val_loss) at the end of
       each epoch */
    step(loss) {
      n += 1;
      if (kind === "step") {
        /* StepLR(step_size=100, gamma=0.1) */
        opt.lr = base * 0.1 ** Math.floor(n / 100);
      } else if (kind === "plateau") {
        /* ReduceLROnPlateau(mode="min", factor=0.1, patience=10,
           threshold=1e-4 rel, cooldown=0), torch's defaults */
        if (loss < best * (1 - 1e-4)) {
          best = loss;
          bad = 0;
        } else {
          bad += 1;
        }
        if (bad > 10) {
          opt.lr *= 0.1;
          bad = 0;
        }
      }
    },
  };
}

/* ---- candidate landscapes -------------------------------------------------- */

/* Two Gaussian wells on a faint bowl. Outside the wells the bowl's gradient is
   ~0.02|theta|: a plain SGD walks it at lr * that, Adam at ~lr a step, which
   is the plateau claim. One well is deeper (global), one shallower (local),
   and the `aniso` variant stretches the global well into a trench so widget
   48's curvature story is also present inside it. */
export function wells({ name, global, local, c = 0.01, range }) {
  const terms = [global, local];
  const f = (x, y) => {
    let v = c * (x * x + y * y);
    for (const w of terms) v -= w.d * Math.exp(-((x - w.x) ** 2 / w.sx + (y - w.y) ** 2 / w.sy));
    return v;
  };
  const grad = (x, y) => {
    let gx = 2 * c * x;
    let gy = 2 * c * y;
    for (const w of terms) {
      const e = w.d * Math.exp(-((x - w.x) ** 2 / w.sx + (y - w.y) ** 2 / w.sy));
      gx += (e * 2 * (x - w.x)) / w.sx;
      gy += (e * 2 * (y - w.y)) / w.sy;
    }
    return [gx, gy];
  };
  return { name, f, grad, range, seeds: [[global.x, global.y], [local.x, local.y]] };
}

/* polish a seed into the exact minimum with a long, small-step descent */
export function polish(S, [x0, y0]) {
  let x = x0;
  let y = y0;
  for (let k = 0; k < 20000; k += 1) {
    const [gx, gy] = S.grad(x, y);
    x -= 0.01 * gx;
    y -= 0.01 * gy;
  }
  return { x, y, f: S.f(x, y) };
}

/**
 * The survey's top-level polish loop as a function, plus the two numbers the
 * colour ramp needs. `fmax` is the largest value on the frame, taken on a
 * 48 x 48 grid — the ramp's cap and nothing the engine reads (decision 4).
 */
export function prepare(S) {
  S.minima = S.seeds.map((p) => polish(S, p));
  const fmin = Math.min(...S.minima.map((m) => m.f));
  for (const m of S.minima) m.kind = Math.abs(m.f - fmin) < 1e-9 ? "G" : "L";
  S.fmin = fmin;
  let hi = -Infinity;
  for (let i = 0; i <= 48; i += 1) {
    for (let j = 0; j <= 48; j += 1) {
      const x = S.range[0][0] + (i / 48) * (S.range[0][1] - S.range[0][0]);
      const y = S.range[1][0] + (j / 48) * (S.range[1][1] - S.range[1][0]);
      hi = Math.max(hi, S.f(x, y));
    }
  }
  S.fmax = hi;
  S.cap = Math.log10(1 + (hi - fmin) / 0.05);
  S.G = S.minima.find((m) => m.kind === "G");
  S.L = S.minima.find((m) => m.kind === "L");
  return S;
}

/** THE STAGE (decision 1). The global well is a trench along x; the local well
    sits 0.35 deep on the way to it from the left. */
export const TRENCH = prepare(wells({
  name: "trench",
  global: { x: 1.6, y: 0, d: 1.2, sx: 2.5, sy: 0.25 },
  local: { x: -1.6, y: 0.4, d: 0.35, sx: 0.7, sy: 0.7 },
  range: [[-4, 4], [-3, 3]],
}));

/* The two surfaces `_lab/dl-optim-torch.py` ran through torch 2.14. The widget
   draws neither — its local well is 0.35 deep and theirs is 0.7 — and they are
   here so the verify script can reproduce all 60 printed lines through the
   shipping engine rather than through a copy of it (5.8). */
export const TORCH_SURFACES = {
  wells: prepare(wells({
    name: "wells",
    global: { x: 1.6, y: 0, d: 1.2, sx: 0.9, sy: 0.9 },
    local: { x: -1.6, y: 0.4, d: 0.7, sx: 0.7, sy: 0.7 },
    range: [[-4, 4], [-3, 3]],
  })),
  camel3: prepare({
    /* the three-hump camel: one global minimum at the origin, two local ones
       at about (+-1.75, -+0.87), a classic test function */
    name: "camel3",
    f: (x, y) => 2 * x * x - 1.05 * x ** 4 + x ** 6 / 6 + x * y + y * y,
    grad: (x, y) => [4 * x - 4.2 * x ** 3 + x ** 5 + y, x + 2 * y],
    range: [[-2.2, 2.2], [-2.2, 2.2]],
    seeds: [[0, 0], [1.75, -0.87], [-1.75, 0.87]],
  }),
};

/* ---- one run --------------------------------------------------------------- */

/* The survey's budget is 800 and the widget's is 500: the slowest arrival on
   this ladder from any of the three starts is under 400 (catalogue § Slot 55),
   so the last hundred steps hold nothing a reader has not already seen. */
export const BUDGET = 500;
export const NEAR = 0.15;      // "arrived": within this of a minimum at the budget
export const REACH = 0.1;      // "reached the global": first step within this

/**
 * One walk, recorded. Same loop as the survey's `run`, with the step's parts
 * kept: position after the step, the loss there, the gradient it read, the
 * displacement it made, and the rate it used.
 *
 * Index 0 of every array is the START — no step has been taken, so its
 * gradient and displacement are the ones the FIRST step will use and make, and
 * the animation's index `k` is therefore "steps taken" on every array at once.
 */
export function trace(S, kind, lr, start, scheduler = null, budget = BUDGET) {
  const theta = [start[0], start[1]];
  const opt = makeOptimizer(kind, lr);
  const sch = scheduler ? makeScheduler(scheduler, opt) : null;
  const G = S.G;
  const far = 3 * Math.max(...S.range.flat().map(Math.abs));
  const xs = [theta[0]];
  const ys = [theta[1]];
  const loss = [S.f(theta[0], theta[1])];
  const gx = [];
  const gy = [];
  const dx = [];
  const dy = [];
  const rate = [];
  let reached = null;
  let gone = null;
  for (let t = 1; t <= budget; t += 1) {
    const before = [theta[0], theta[1]];
    const rateUsed = opt.lr;
    const g = S.grad(theta[0], theta[1]);
    opt.step(theta, g);
    if (sch) sch.step(S.f(theta[0], theta[1]));
    gx.push(g[0]);
    gy.push(g[1]);
    dx.push(theta[0] - before[0]);
    dy.push(theta[1] - before[1]);
    rate.push(rateUsed);
    if (!Number.isFinite(theta[0]) || !Number.isFinite(theta[1])
      || Math.hypot(theta[0], theta[1]) > far) {
      gone = t;
      /* The walk stops where it left: an unbounded position has nowhere to be
         drawn, and the panel says so instead. Every array is then shorter than
         the budget, which `len` below is what the animation reads. */
      break;
    }
    xs.push(theta[0]);
    ys.push(theta[1]);
    loss.push(S.f(theta[0], theta[1]));
    if (reached === null && Math.hypot(theta[0] - G.x, theta[1] - G.y) < REACH) reached = t;
  }
  /* the step arrays are one longer than the position arrays at the budget,
     because the last step's parts are recorded and its landing is the last
     position; `at(k)` below is the only reader and it clamps */
  const last = xs.length - 1;
  let where = "plain";
  let dist = Infinity;
  for (const m of S.minima) {
    const d = Math.hypot(xs[last] - m.x, ys[last] - m.y);
    if (d < NEAR && d < dist) {
      dist = d;
      where = m.kind === "G" ? "global" : "local";
    }
  }
  if (gone !== null) where = "gone";
  return {
    kind,
    xs,
    ys,
    loss,
    gx,
    gy,
    dx,
    dy,
    rate,
    len: last,             // the highest index the animation can stand at
    steps: gx.length,      // steps actually taken, gone or not
    reached,
    gone,
    where,
    dG: Math.hypot(xs[last] - G.x, ys[last] - G.y),
  };
}

/** Position at a fractional step index, for the choreographed move. */
export function posAt(w, fi) {
  const clamped = Math.max(0, Math.min(w.len, fi));
  const a = Math.floor(clamped);
  const b = Math.min(w.len, a + 1);
  const f = clamped - a;
  return [w.xs[a] + (w.xs[b] - w.xs[a]) * f, w.ys[a] + (w.ys[b] - w.ys[a]) * f];
}

/* ---- the four methods, the three starts, the ladder ----------------------- */

/* momentum is a parameter of `optim.SGD` and not a different optimizer, so the
   rail has three faces and a `momentum` field under the first (catalogue §7,
   pick A). These four keys are the engine's, and `kindOf` is the one place the
   two vocabularies meet. */
export const METHODS = [
  { key: "sgd", name: "SGD", short: "SGD" },
  { key: "momentum", name: "SGD, momentum 0.9", short: "momentum 0.9" },
  { key: "rmsprop", name: "RMSprop", short: "RMSprop" },
  { key: "adam", name: "Adam", short: "Adam" },
];
export const METHOD_KEYS = METHODS.map((m) => m.key);
export const methodName = (key) => METHODS.find((m) => m.key === key)?.name ?? key;
export const methodShort = (key) => METHODS.find((m) => m.key === key)?.short ?? key;

/** The rail's two controls resolved into one engine key. */
export const kindOf = (params) =>
  (params.optimizer === "sgd"
    ? (String(params.momentum ?? "0") === "0.9" ? "momentum" : "sgd")
    : params.optimizer);

export const STARTS = [
  { value: "beyond", label: "Beyond the local minimum", at: [-3.6, 0.6] },
  { value: "plateau", label: "On the plateau", at: [3.5, 2.5] },
  { value: "edge", label: "At the edge of the global basin", at: [0.7, 0.6] },
];
export const DRAGGED = "dragged";
export const DRAGGED_LABEL = "Where the marker is";

export const LR_LADDER = [0.01, 0.03, 0.1, 0.3, 1];
/* Kenneth's pick, round 1 (2026-09-11): open at 0.1, where all three rules
   descend cleanly into the local well; at 0.3 Adam rocks in it and RMSprop
   is flung across the map, which read as a fault rather than a claim. */
export const LR_DEFAULT = "0.1";
export const SCHEDULERS = ["none", "steplr", "plateau"];
/** the rail's scheduler value as the engine's kind */
export const schedKind = (v) => (v === "steplr" ? "step" : v === "plateau" ? "plateau" : null);

/** Where the walk begins: the dragged marker if there is one, else the face. */
export function startPoint(params) {
  if (params.start === DRAGGED && params.x0 !== null && params.x0 !== undefined
    && params.y0 !== null && params.y0 !== undefined) {
    return [clampX(params.x0), clampY(params.y0)];
  }
  const s = STARTS.find((o) => o.value === params.start) ?? STARTS[0];
  return s.at;
}
export const clampX = (v) => Math.max(TRENCH.range[0][0] + 0.1, Math.min(TRENCH.range[0][1] - 0.1, v));
export const clampY = (v) => Math.max(TRENCH.range[1][0] + 0.1, Math.min(TRENCH.range[1][1] - 0.1, v));
/** The marker has been dragged, so the fourth face exists and is lit. */
export const isDragged = (values) =>
  values.x0 !== null && values.x0 !== undefined
  && values.y0 !== null && values.y0 !== undefined;

/* ---- the state ------------------------------------------------------------ */

/**
 * One door for the state, so `height`, `draw` and the verify script cannot
 * each measure a different walk (5.8). Pure and unseeded: nothing here is
 * random, and the four walks are computed whatever `compare` says, so the
 * toggle draws what is already there (decision 3).
 */
export function computeFor(params) {
  const start = startPoint(params);
  const lr = Number(params.lr);
  const sched = schedKind(params.scheduler);
  const kind = kindOf(params);
  const walks = {};
  for (const key of METHOD_KEYS) walks[key] = trace(TRENCH, key, lr, start, sched);
  const mine = walks[kind];
  const rates = mine.rate.map((v) => Math.max(RATE_FLOOR, v));
  const rateLo = Math.min(...rates);
  return {
    S: TRENCH,
    start,
    lr,
    kind,
    sched,
    hasRate: sched !== null,
    walks,
    mine,
    others: METHOD_KEYS.filter((k) => k !== kind).map((k) => walks[k]),
    units: mine.len,
    /* the rate strip's own frame, fixed over the whole walk (2.5) */
    rateLo,
    rateFloored: mine.rate.some((v) => v < RATE_FLOOR),
    /* what the relief's hidden/visible split is keyed on: everything that
       decides where the chosen walk goes */
    sig: `${start.join()}:${kind}:${params.lr}:${params.scheduler}`,
  };
}

export const RATE_FLOOR = 1e-8;

/* ---- the colour ramp ------------------------------------------------------ */

/** Where a loss sits on the ramp, 0 at the least loss and 1 at the cap. */
export const rampT = (S, v) =>
  Math.max(0, Math.min(1, Math.log10(1 + Math.max(0, v - S.fmin) / 0.05) / S.cap));

/** The field the relief is built over. NOT the colour ramp: the log ramp makes
    each well a needle so narrow that a 44-quad mesh misses its floor, and a
    walk lifted with the exact field then hangs below the drawn surface (round
    1, 2026-09-11: the walk left the mesh). Height is the loss itself, 0 at the
    least loss and 1 at the frame's highest, so a well is the Gaussian it is;
    the faces still take their colour from the ramp, through `heightToRampT`. */
export const heightField = (S) => (x, y) =>
  Math.max(0, Math.min(1, (S.f(x, y) - S.fmin) / (S.fmax - S.fmin)));

/** The ramp position of the loss a height stands for, so the relief's colours
    are the map's. */
export const heightToRampT = (S, u) => rampT(S, S.fmin + u * (S.fmax - S.fmin));

/** A field sampled once on a (G + 1)² grid and read back by bilinear
    interpolation. The mesh samples its field at exactly these points, so a
    walk lifted with the sampled field sits on the drawn faces, and the
    hidden-line march tests the surface that is actually painted. */
export function sampledField(field, xd, yd, G) {
  const grid = [];
  for (let i = 0; i <= G; i += 1) {
    const col = new Float64Array(G + 1);
    const x = xd[0] + (i / G) * (xd[1] - xd[0]);
    for (let j = 0; j <= G; j += 1) col[j] = field(x, yd[0] + (j / G) * (yd[1] - yd[0]));
    grid.push(col);
  }
  return (x, y) => {
    const u = Math.max(0, Math.min(G - 1e-9, ((x - xd[0]) / (xd[1] - xd[0])) * G));
    const v = Math.max(0, Math.min(G - 1e-9, ((y - yd[0]) / (yd[1] - yd[0])) * G));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    return (grid[i][j] * (1 - fu) + grid[i + 1][j] * fu) * (1 - fv)
      + (grid[i][j + 1] * (1 - fu) + grid[i + 1][j + 1] * fu) * fv;
  };
}

/* Contours at even steps of the ramp, inverted back into loss units, so the
   lines are where the colour changes rather than where the arithmetic is
   round. */
export const contourLevels = (S) => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  .map((t) => S.fmin + 0.05 * (10 ** (t * S.cap) - 1));

/* ---- pacing ---------------------------------------------------------------
 * One step is one update, so a pace is how long a step takes, and all three
 * paces run on the same clock: `anim.beat` fills over `stepMs` and the walk
 * advances by whatever whole steps have accumulated. Slow is the only one that
 * CHOREOGRAPHS — the gradient, then the step, then the move — and that is
 * declared here and never decided mid-run (4.1). At 0.4 s a step the three
 * beats would be 120 ms each, which is a flicker rather than a reading; at 40
 * steps a second there is no room for them at all.
 *
 * A PACE SLOWER THAN THE FRAME CLOCK NEEDS THE FRACTION KEPT. Widget 48's
 * arrivals-only branch takes `max(1, round(dt / stepMs))` steps a frame, which
 * is right for 60 or 250 epochs a second and wrong for 2.5: it floors at one
 * step per FRAME, so Medium ran at 60 steps a second and Fast at 60 rather
 * than 40. Measured by driving 60 frames of 16 ms through a synthetic clock
 * and reading the step count — both came back 60. */
export const STEP_MS = { slow: 2500, medium: 400, fast: 25 };
export const stepMs = (speed) => STEP_MS[speed] ?? STEP_MS.medium;
export const choreographs = (speed) => speed === "slow";

/* The three beats of a Slow step, as shares of the clock: the gradient at the
   point, then the step the rule makes out of it, then the move. */
export const BEATS = { gradient: 0.3, step: 0.55 };

/* ---- the geometry (decision 2) -------------------------------------------- */

export const PAD_L = 52;        // a rotated y-axis label plus its tick numbers
export const PAD_R = 14;
export const TOP = 30;          // the caption line above the map
export const GAP = 40;          // between the map and the step panel
export const PANEL_W = 182;     // the rescale panel: a label column, the bars, a number column
export const PANEL_LBL = 58;    // "gradient 1" right-aligned, at --fs-xs
export const PANEL_NUM = 52;    // the number beside a bar that runs the full width
/* THE BAR AXIS HAS A FLOOR (2.5). At a minimum the gradient is 1e-9 and the
   step 1e-10, and an axis fitted to them draws four full-width bars of
   numerical noise — a picture of a large step where nothing is moving. Below
   this the bars are hairlines and the numbers beside them carry the reading,
   which is what arriving looks like. */
export const PANEL_FLOOR = 1e-3;
export const STRIP_H = 74;
export const RATE_H = 58;
export const MAP_MIN = 170;
export const MAP_MAX = 380;

/**
 * Every rect the page draws in, and its own height. `hasRate` is the only
 * parameter the layout depends on — the rate strip exists under a scheduler
 * and not otherwise — so the stage is taller there and nowhere else.
 *
 * The map keeps the window's own 8 x 6 aspect: it is a picture of the
 * parameter plane and a walk across it must not be sheared by the panel.
 */
export function layout(w, hasRate) {
  const usable = w - PAD_L - PAD_R;
  /* THE WINDOW'S ASPECT IS KEPT AT BOTH ENDS. Capping the HEIGHT alone left a
     482 x 330 map at a 770px figure — an 8 x 6 window drawn 1.46 wide, which
     shears every path across it. The cap is applied to the width, and the
     slack goes to the step panel, which has bars to spend it on. */
  const mapW = Math.round(Math.max(180, Math.min(MAP_MAX / 0.75, usable - GAP - PANEL_W)));
  const mapH = Math.round(Math.max(MAP_MIN, mapW * 0.75));
  const map = { x: PAD_L, y: TOP, w: mapW, h: mapH };
  const panelX = PAD_L + mapW + GAP;
  const panel = { x: panelX, y: TOP + 16, w: Math.max(PANEL_W, w - PAD_R - panelX), h: 150 };
  /* under the map: its x-axis label at +22, the colour bar at +46 with its own
     labels at +67, then the line saying what this step is doing */
  const beatY = TOP + mapH + 92;
  const loss = { x: PAD_L, y: TOP + mapH + 124, w: usable, h: STRIP_H };
  const rate = { x: PAD_L, y: loss.y + STRIP_H + 62, w: usable, h: RATE_H };
  const bottom = hasRate ? rate.y + RATE_H : loss.y + STRIP_H;
  return { map, panel, beatY, loss, rate, hasRate, height: bottom + 44 };
}

/** The stage height, from the parameters and the width alone. */
export const stageHeight = (w, values) => layout(w, schedKind(values.scheduler) !== null).height;

/* ---- numbers on screen ---------------------------------------------------- */

export const n1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
export const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
export const n4 = (v) => (Number.isFinite(v) ? v.toFixed(4) : "—");
/** three significant figures, without a trailing run of zeros */
export const sig = (v) => (!Number.isFinite(v) ? "—" : v === 0 ? "0" : Number(v.toPrecision(3)).toString());
/** a learning rate, which spans 1 to 1e-8 under a scheduler */
export const rateText = (v) => (!Number.isFinite(v) ? "—" : v >= 1e-4 ? sig(v) : v.toExponential(0));

/* ---- the copy (5.9) ------------------------------------------------------- */

export const WHERE = {
  global: "at the global minimum",
  local: "at the local minimum",
  plain: "away from both minima",
  gone: "outside the plotted region",
};

export const STRINGS = {
  /* Kenneth's picks from the copy audit (2026-09-11): the subtitle states the
     principles and names no method ("don't need to name specific methods"),
     the blurb states the concept rather than what the figure shows (2.10). */
  subtitle:
    "An optimizer turns the gradient into a parameter update: at a fixed learning "
    + "rate, with momentum from past gradients, or with a step size adapted to each "
    + "parameter's recent gradients. A learning-rate scheduler reduces that step "
    + "size as training proceeds.",

  /* his pick A, trimmed of its landscape clause to the gallery card's 120 */
  blurb:
    "How an optimizer turns the gradient into an update: momentum, adaptive step "
    + "sizes and learning-rate schedules.",

  stepLabel: "Take a step",
  stepTitle: "Take one update and redraw the path",
  runLabel: "Play",
  runTitle: "Take every remaining update, to step 500",

  startLabel: "Start",
  startDetail: "where the path begins; drag the marker on the map to move it",
  optimizerLabel: "Optimizer",
  momentumLabel: "Momentum",
  lrLabel: "Learning rate",
  /* THE RUNG'S LINE NAMES NO START AND THE FIELD'S DOES, because the two are
     rendered one above the other (3.4f) and a qualifier repeated on five lines
     is five copies of one fact. Naming it here is also what keeps every rung's
     claim true in every state of the Start control (2.11): it is a statement
     about that start, whichever start the reader is on. */
  schedulerLabel: "Scheduler",
  surfaceLabel: "Surface",
  compareLabel: "Compare",
  compareDetail: "the other three optimizers' paths from the same start, dimmed",
  speedLabel: "Play speed",
  homeLabel: "Default view",
  homeDetail: "turns the surface back to the viewpoint the figure opens at",

  mapCaption: "the loss over the two parameters",
  reliefCaption: "the loss as height over the two parameters",
  panelCaption: "This step",
  lossCaption: "loss after each step",
  rateCaption: "the learning rate at each step",
  rampMiddle: "loss, log scale",
  atRest: "the gradient at this point, and the update step made from it",
  gone: "outside the plotted region",
};

export const OPTIMIZER_OPTIONS = [
  /* no option details: the explanation of each rule is the card's, under the
     rule itself (Kenneth's pick, audit round 3, 2026-09-11) */
  { value: "sgd", label: "SGD" },
  { value: "adam", label: "Adam" },
  { value: "rmsprop", label: "RMSprop" },
];

/** The sentence under the update rule on the card, keyed by the rule the
    card shows (`kindOf`): what its symbols are, in the reading colour. */
export const DESCRIPTORS = {
  sgd: "The update step is the learning rate times the gradient.",
  momentum: "b is a running sum of past gradients: μ = 0.9 of the last sum is kept and the new gradient added, so the step keeps its direction from one update to the next.",
  rmsprop: "v is a running mean of the squared gradient, one per parameter (ρ = 0.99); dividing by its root gives every parameter a step of about the learning rate, whatever its gradient.",
  adam: "m is a running mean of the gradient (β₁ = 0.9) and v of its square (β₂ = 0.999), each corrected for the first steps; the step is their ratio times the learning rate.",
};

/** The sentence under a scheduler's call on the card. */
export const SCHEDULER_DESCRIPTORS = {
  steplr: "The learning rate falls tenfold every hundred steps.",
  plateau: "The learning rate falls tenfold after ten steps without a lower loss.",
};

export const MOMENTUM_OPTIONS = [
  { value: "0", label: "0" },
  { value: "0.9", label: "0.9" },
];

export const SCHEDULER_OPTIONS = [
  { value: "none", label: "None", span: true },
  { value: "steplr", label: "StepLR" },
  { value: "plateau", label: "ReduceLROnPlateau" },
];

export const SURFACE_OPTIONS = [
  { value: "map", label: "Map" },
  {
    value: "relief",
    label: "Relief",
    detail: "height as well as colour, seen from an angle; drag the surface to turn it",
  },
];

export const SPEEDS = [
  { value: "slow", label: "Slow", detail: "2.5 seconds a step, with the gradient and the step drawn first" },
  { value: "medium", label: "Medium", detail: "0.4 seconds a step" },
  { value: "fast", label: "Fast", detail: "40 steps a second, the path alone" },
];

/* ---- the rate ladder --------------------------------------------------------
 * No line under a value. The draft computed one per value from the engine
 * ("momentum 0.9 reaches the global minimum at step 45, Adam ends at the local
 * minimum") and Kenneth struck them (2026-09-11): a control's line says what
 * the control is, and a line that says what will happen is the widget
 * announcing its own answer before the first step (2.9, 4.4). The reader
 * finds out by pressing Play. */
export const LR_OPTIONS = LR_LADDER.map((v) => ({ value: String(v), label: String(v) }));
