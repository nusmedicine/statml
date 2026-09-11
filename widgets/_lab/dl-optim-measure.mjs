/* Planning measurement for the deep learning arc's `optimizers` slot (PHM5005
 * 05-4 cells 41-44, the optimizer table and the SGD / Adam / AdamW syntax
 * cells; 82-86, the scheduler table with StepLR and ReduceLROnPlateau).
 *
 * Kenneth's call, 2026-09-11: a new widget rather than a picker on
 * `gradients`, on a landscape with a local AND a global minimum, so the
 * optimizers can be seen to behave differently. The site the notebook links
 * (gradient-descent-vis.netlify.app) offers six toy surfaces and five
 * optimizers with no data; this script asks the one question that decides
 * whether such a stage is honest here: DOES EACH OPTIMIZER WIN SOMEWHERE?
 * (widget 43's lesson: a choice on a stage where one arm dominates teaches
 * "use that one".) For each candidate landscape, a grid of starts and a
 * learning-rate ladder, it counts where every optimizer ends up (the global
 * minimum, the local one, still wandering at the budget, or gone) and how
 * many steps the global took.
 *
 * The update rules are torch.optim's own at their defaults, not the paper's
 * or the netlify site's (which adds eps inside RMSprop's square root and
 * folds the learning rate into the momentum buffer). `_lab/dl-optim-torch.py`
 * runs the same surfaces through torch and prints the same lines; `--check`
 * here prints ours, and the two must agree to 1e-6.
 *
 * No data, so no batches: every gradient is the exact one. The S in SGD is
 * widget 48's batch control; this stage is about the update rule alone.
 *
 * Run: node widgets/_lab/dl-optim-measure.mjs [--check]
 */

const CHECK = process.argv.includes("--check");

/* ---- torch.optim's update rules ------------------------------------------ */

function makeOptimizer(kind, lr0) {
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

const OPTIMIZERS = ["sgd", "momentum", "rmsprop", "adam", "adamw"];

/* ---- torch.optim.lr_scheduler, the two the notebook gives syntax for ----- */

function makeScheduler(kind, opt) {
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
function wells({ name, global, local, c = 0.01, range }) {
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

const SURFACES = [
  wells({
    name: "wells",
    global: { x: 1.6, y: 0, d: 1.2, sx: 0.9, sy: 0.9 },
    local: { x: -1.6, y: 0.4, d: 0.7, sx: 0.7, sy: 0.7 },
    range: [[-4, 4], [-3, 3]],
  }),
  wells({
    name: "wells-aniso",
    global: { x: 1.6, y: 0, d: 1.2, sx: 2.5, sy: 0.25 },
    local: { x: -1.6, y: 0.4, d: 0.7, sx: 0.6, sy: 0.6 },
    range: [[-4, 4], [-3, 3]],
  }),
  {
    /* the three-hump camel: one global minimum at the origin, two local ones
       at about (+-1.75, -+0.87), a classic test function */
    name: "camel3",
    f: (x, y) => 2 * x * x - 1.05 * x ** 4 + x ** 6 / 6 + x * y + y * y,
    grad: (x, y) => [4 * x - 4.2 * x ** 3 + x ** 5 + y, x + 2 * y],
    range: [[-2.2, 2.2], [-2.2, 2.2]],
    seeds: [[0, 0], [1.75, -0.87], [-1.75, 0.87]],
  },
];

/* polish a seed into the exact minimum with a long, small-step descent */
function polish(S, [x0, y0]) {
  let x = x0;
  let y = y0;
  for (let k = 0; k < 20000; k += 1) {
    const [gx, gy] = S.grad(x, y);
    x -= 0.01 * gx;
    y -= 0.01 * gy;
  }
  return { x, y, f: S.f(x, y) };
}
for (const S of SURFACES) {
  S.minima = S.seeds.map((p) => polish(S, p));
  const fmin = Math.min(...S.minima.map((m) => m.f));
  for (const m of S.minima) m.kind = Math.abs(m.f - fmin) < 1e-9 ? "G" : "L";
}

/* ---- one run --------------------------------------------------------------- */

const BUDGET = 800;
const NEAR = 0.15;      // "arrived": within this of a minimum at the budget
const REACH = 0.1;      // "reached the global": first step within this

function run(S, kind, lr, start, scheduler = null, trace = null) {
  const theta = [start[0], start[1]];
  const opt = makeOptimizer(kind, lr);
  const sch = scheduler ? makeScheduler(scheduler, opt) : null;
  const G = S.minima.find((m) => m.kind === "G");
  const far = 3 * Math.max(...S.range.flat().map(Math.abs));
  let reached = null;
  for (let t = 1; t <= BUDGET; t += 1) {
    const g = S.grad(theta[0], theta[1]);
    opt.step(theta, g);
    if (sch) sch.step(S.f(theta[0], theta[1]));
    if (trace && trace.at.includes(t)) trace.out.push([t, theta[0], theta[1]]);
    if (!Number.isFinite(theta[0]) || !Number.isFinite(theta[1]) || Math.hypot(theta[0], theta[1]) > far) {
      return { outcome: "X", reached, lr: opt.lr, dG: Infinity };
    }
    if (reached === null && Math.hypot(theta[0] - G.x, theta[1] - G.y) < REACH) reached = t;
  }
  let outcome = "W";
  let dist = Infinity;
  for (const m of S.minima) {
    const d = Math.hypot(theta[0] - m.x, theta[1] - m.y);
    if (d < NEAR && d < dist) {
      dist = d;
      outcome = m.kind;
    }
  }
  const dG = Math.hypot(theta[0] - G.x, theta[1] - G.y);
  return { outcome, reached, lr: opt.lr, theta, loss: S.f(theta[0], theta[1]), dG };
}

/* ---- --check: the lines dl-optim-torch.py prints ------------------------- */

if (CHECK) {
  const AT = [1, 2, 5, 10, 20, 40];
  for (const S of SURFACES.filter((s) => s.name === "wells" || s.name === "camel3")) {
    const start = S.name === "wells" ? [3.5, 2.5] : [-1.5, 1.5];
    for (const kind of OPTIMIZERS) {
      const trace = { at: AT, out: [] };
      run(S, kind, 0.1, start, null, trace);
      for (const [t, x, y] of trace.out) console.log(`${S.name} ${kind} ${t} ${x.toFixed(6)} ${y.toFixed(6)}`);
    }
  }
  process.exit(0);
}

/* ---- the survey ------------------------------------------------------------ */

const LRS = [0.003, 0.01, 0.03, 0.1, 0.3, 1];
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "-");

function grid(S, n = 5) {
  const pts = [];
  const [[x0, x1], [y0, y1]] = S.range;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      pts.push([x0 + (x1 - x0) * (0.1 + (0.8 * i) / (n - 1)), y0 + (y1 - y0) * (0.1 + (0.8 * j) / (n - 1))]);
    }
  }
  return pts;
}

function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
}

for (const S of SURFACES) {
  console.log(`\n==== ${S.name}  range x ${S.range[0].join("..")} y ${S.range[1].join("..")}`);
  for (const m of S.minima) console.log(`  minimum ${m.kind} at (${fmt(m.x, 3)}, ${fmt(m.y, 3)})  f = ${fmt(m.f, 4)}`);
  const probe = S.name === "camel3" ? [-1.5, 1.5] : [3.5, 2.5];
  const gp = S.grad(...probe);
  console.log(`  |grad| at the far start (${probe}): ${Math.hypot(...gp).toFixed(4)}`);

  const starts = grid(S);
  console.log(`\n  25 starts x ${BUDGET} steps.  cells: G/L/W/X = ended at global / local / wandering / gone;  (median steps to reach G)`);
  console.log(`  ${"optimizer".padEnd(10)}${LRS.map((l) => String(l).padStart(18)).join("")}`);
  for (const kind of OPTIMIZERS) {
    const cells = LRS.map((lr) => {
      const c = { G: 0, L: 0, W: 0, X: 0 };
      const steps = [];
      for (const st of starts) {
        const r = run(S, kind, lr, st);
        c[r.outcome] += 1;
        if (r.reached) steps.push(r.reached);
      }
      return `${c.G}/${c.L}/${c.W}/${c.X} (${steps.length ? median(steps) : "-"})`.padStart(18);
    });
    console.log(`  ${kind.padEnd(10)}${cells.join("")}`);
  }

  /* the story starts: on the plain far away, inside the local basin, inside
     the global basin near its rim */
  const story = S.name === "camel3"
    ? [["far", [-1.5, 1.5]], ["local basin", [1.6, -0.6]], ["global rim", [0.7, -0.9]]]
    : [["far, on the plain", [3.5, 2.5]], ["local basin", [-2.1, 0.9]], ["global rim", [0.7, 0.6]]];
  for (const [label, st] of story) {
    console.log(`\n  start ${label} (${st}):  outcome (steps to G | final distance to G)`);
    console.log(`  ${"optimizer".padEnd(10)}${LRS.map((l) => String(l).padStart(18)).join("")}`);
    for (const kind of OPTIMIZERS) {
      const cells = LRS.map((lr) => {
        const r = run(S, kind, lr, st);
        return `${r.outcome} (${r.reached ?? "-"} | ${fmt(r.dG)})`.padStart(18);
      });
      console.log(`  ${kind.padEnd(10)}${cells.join("")}`);
    }
  }
}

/* ---- the local well IN THE WAY: how deep a trap does each one roll through?
   The first survey found that from inside the local basin nothing escapes at
   any rate, on any surface: a minimum is a minimum. The claim worth drawing is
   different: a walk that ARRIVES at a local well with speed may cross it. So
   the start goes on the far side of the local well, the global well beyond
   it, and the local well's depth is swept. ---------------------------------- */

console.log("\n==== the local well in the way: start (-3.6, 0.6), local at (-1.6, 0.4), global at (1.6, 0); local depth swept");
for (const aniso of [false, true]) {
  for (const depth of [0.15, 0.25, 0.35, 0.5, 0.7]) {
    const S = wells({
      name: `wells d=${depth}${aniso ? " aniso" : ""}`,
      global: aniso ? { x: 1.6, y: 0, d: 1.2, sx: 2.5, sy: 0.25 } : { x: 1.6, y: 0, d: 1.2, sx: 0.9, sy: 0.9 },
      local: { x: -1.6, y: 0.4, d: depth, sx: 0.7, sy: 0.7 },
      range: [[-4, 4], [-3, 3]],
    });
    S.minima = S.seeds.map((p) => polish(S, p));
    const fmin = Math.min(...S.minima.map((m) => m.f));
    for (const m of S.minima) m.kind = Math.abs(m.f - fmin) < 1e-9 ? "G" : "L";
    const L = S.minima.find((m) => m.kind === "L");
    const isMin = Math.hypot(L.x + 1.6, L.y - 0.4) < 0.3;
    console.log(`\n  ${S.name}  local minimum ${isMin ? `at (${fmt(L.x)}, ${fmt(L.y)}) f ${fmt(L.f, 3)}` : "NONE (the bowl has swallowed it)"}   global f ${fmt(S.minima.find((m) => m.kind === "G").f, 3)}`);
    console.log(`  ${"optimizer".padEnd(10)}${LRS.map((l) => String(l).padStart(18)).join("")}`);
    for (const kind of ["sgd", "momentum", "rmsprop", "adam"]) {
      const cells = LRS.map((lr) => {
        const r = run(S, kind, lr, [-3.6, 0.6]);
        return `${r.outcome} (${r.reached ?? "-"} | ${fmt(r.dG)})`.padStart(18);
      });
      console.log(`  ${kind.padEnd(10)}${cells.join("")}`);
    }
  }
}

/* ---- schedulers: where a large rate orbits, does a schedule settle it? ---- */

console.log("\n==== schedulers on wells from the far start, the two large rates: final distance to G and final lr");
const W = SURFACES[0];
for (const lr of [0.3, 1]) {
  for (const kind of ["sgd", "momentum", "adam"]) {
    const row = ["none", "step", "plateau"].map((sch) => {
      const r = run(W, kind, lr, [3.5, 2.5], sch === "none" ? null : sch);
      return `${sch}: ${r.outcome} d=${fmt(r.dG, 3)} lr=${r.lr.toExponential(0)}`.padEnd(34);
    });
    console.log(`  lr ${String(lr).padEnd(4)} ${kind.padEnd(9)} ${row.join("")}`);
  }
}
