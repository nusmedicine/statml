/* ============================================================================
   Assertions on widget 55's engine, geometry and copy.

       node widgets/_lab/optimizers-verify.mjs

   Imports `widgets/optimizers/model.js`, the shipping code and not a copy
   (5.8), and `widgets/core/params.js`, so the URL round trip is the one the
   page performs.

   Five of these need a reader most.

   THE 60 TORCH LINES. `_lab/dl-optim-torch.py` ran the same two surfaces
   through torch 2.14 and printed x and y at steps 1, 2, 5, 10, 20 and 40 for
   all five rules; `_lab/dl-optim-torch.txt` holds what it printed. If the
   widget's walk is not `optimizer.step()`'s walk, nothing on the figure is
   worth reading, and no picture can tell.

   THE FOUR OUTCOMES THE STAGE EXISTS FOR. The whole argument for offering a
   choice of methods is that each one wins somewhere (widget 43's lesson): at
   lr 0.3 from Beyond the local minimum, momentum crosses the local well at
   step 45 while SGD and Adam settle in it, and at lr 1 Adam crosses at step
   30. Those four facts are the stage; a constant that moved them would leave
   a widget teaching nothing in particular.

   THE GEOMETRY. `height` and `draw` share one function precisely so this
   script can measure what the widget draws, and a rate strip that overlapped
   the loss strip would still hash consistently for ever.

   THE LADDER'S OWN LINES are computed from the engine at load, so they are
   asserted as copy: each names a method and fits the rail.

   THE START ROUND TRIP. `x0` and `y0` are written by a drag and read back from
   a link, and the fourth face exists only while they are set — which is a
   claim about `resolveParams`, not about anything drawn.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../optimizers/model.js";
import { reliefHidden } from "../gradients/model.js";
import { resolveParams, toQuery, optionKeys } from "../core/params.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 76)} ${detail}`);
}

const src = read("widgets/optimizers/main.js");
const modelSrc = read("widgets/optimizers/model.js");

/* the state the widget opens on, through its own door */
const DEFAULTS = {
  start: "beyond", x0: null, y0: null, optimizer: "sgd", momentum: "0",
  lr: "0.1", scheduler: "none", surface: "map", compare: false, speed: "medium",
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });

/* --- 1 · the engine is torch's, to 1e-6 ------------------------------------ */
{
  const want = read("widgets/_lab/dl-optim-torch.txt").trim().split(/\r?\n/);
  check("dl-optim-torch.txt holds 60 trace lines", want.length === 60, `${want.length}`);
  const AT = [1, 2, 5, 10, 20, 40];
  let worst = 0;
  let lines = 0;
  for (const [name, start] of [["wells", [3.5, 2.5]], ["camel3", [-1.5, 1.5]]]) {
    const S = M.TORCH_SURFACES[name];
    for (const kind of ["sgd", "momentum", "rmsprop", "adam", "adamw"]) {
      const w = M.trace(S, kind, 0.1, start, null, 40);
      for (const t of AT) {
        const row = want[lines];
        lines += 1;
        const [, , , wx, wy] = row.split(" ");
        worst = Math.max(worst, Math.abs(Number(wx) - w.xs[t]), Math.abs(Number(wy) - w.ys[t]));
      }
    }
  }
  check("all 60 lines reproduce through the shipping engine", lines === 60, `${lines} read`);
  check("every printed coordinate agrees with torch 2.14 to 1e-6", worst < 1e-6, `worst ${worst.toExponential(2)}`);

  /* the two surfaces the check runs on are NOT the stage: their local well is
     0.7 deep, the widget's is 0.35 */
  check("the torch surfaces are not the widget's stage",
    M.TORCH_SURFACES.wells.L.f !== M.TRENCH.L.f);
  /* the well is CENTRED at (1.6, 0) and its minimum is not there: the faint
     bowl pulls it 0.033 toward the origin, which is why every minimum on this
     surface is polished rather than declared */
  check("the stage's global minimum is the trench's floor, polished off its centre",
    Math.abs(M.TRENCH.G.x - 1.6) < 0.05 && Math.abs(M.TRENCH.G.y) < 1e-6,
    `(${M.n3(M.TRENCH.G.x)}, ${M.n3(M.TRENCH.G.y)})`);
  check("the stage's local minimum is 0.35 deep and to the left",
    M.TRENCH.L.x < 0 && M.TRENCH.L.f > M.TRENCH.G.f,
    `local ${M.n3(M.TRENCH.L.f)} against global ${M.n3(M.TRENCH.G.f)}`);
}

/* --- 2 · the four outcomes the stage exists for ---------------------------- */
{
  const from = M.STARTS[0].at;
  const at = (kind, lr) => M.trace(M.TRENCH, kind, lr, from);
  const sgd3 = at("sgd", 0.3);
  const mom3 = at("momentum", 0.3);
  const adam3 = at("adam", 0.3);
  const adam1 = at("adam", 1);
  check("Beyond the local minimum is (-3.6, 0.6)", from.join() === "-3.6,0.6", from.join());
  check("at lr 0.3 SGD ends in the local well", sgd3.where === "local", sgd3.where);
  check("at lr 0.3 momentum 0.9 reaches the global minimum at step 45",
    mom3.reached === 45, `step ${mom3.reached}`);
  check("at lr 0.3 Adam ends in the local well", adam3.where === "local", adam3.where);
  check("at lr 1 Adam reaches the global minimum at step 30",
    adam1.reached === 30, `step ${adam1.reached}`);
  check("momentum is the only arm that crosses at lr 0.3",
    [sgd3, adam3, at("rmsprop", 0.3)].every((w) => w.reached === null));

  /* the plain, which is Adam's claim, and the rim, which is SGD's */
  const plain = M.STARTS[1].at;
  const g = Math.hypot(...M.TRENCH.grad(plain[0], plain[1]));
  check("the gradient On the plateau is 0.09", M.n2(g) === "0.09", M.n3(g));
  const slowSGD = M.trace(M.TRENCH, "sgd", 0.01, plain);
  const fastAdam = M.trace(M.TRENCH, "adam", 0.01, plain);
  check("On the plateau at lr 0.01 Adam gets closer than SGD",
    fastAdam.dG < slowSGD.dG, `Adam ${M.n2(fastAdam.dG)} against SGD ${M.n2(slowSGD.dG)}`);

  /* a scheduler settles a rate that cannot settle itself */
  const none = M.trace(M.TRENCH, "sgd", 1, plain);
  const step = M.trace(M.TRENCH, "sgd", 1, plain, "step");
  check("StepLR takes the rate down by ten every hundred steps",
    M.n4(step.rate[99]) === M.n4(1) && M.n4(step.rate[100]) === M.n4(0.1),
    `${step.rate[99]} then ${step.rate[100]}`);
  check("a schedule leaves SGD at lr 1 no further from the global minimum",
    step.dG <= none.dG + 1e-9, `${M.n3(step.dG)} against ${M.n3(none.dG)}`);
  const plateau = M.trace(M.TRENCH, "sgd", 1, plain, "plateau");
  check("ReduceLROnPlateau lowers the rate at some point in the walk",
    plateau.rate.at(-1) < 1, plateau.rate.at(-1).toExponential(0));
  check("the rate never rises", plateau.rate.every((v, i) => i === 0 || v <= plateau.rate[i - 1]));
}

/* --- 3 · compute is pure, and the four walks are always there -------------- */
{
  const a = M.computeFor(base());
  const b = M.computeFor(base());
  check("two calls give the same walk",
    a.mine.xs.join() === b.mine.xs.join() && a.mine.loss.join() === b.mine.loss.join());
  check("two calls give the same rate track", a.mine.rate.join() === b.mine.rate.join());
  check("no randomness reaches the model", !/Math\.random/.test(modelSrc));
  check("no randomness reaches the widget", !/Math\.random/.test(src));

  const off = M.computeFor(base({ compare: false }));
  const on = M.computeFor(base({ compare: true }));
  check("all four walks are computed with Compare off",
    M.METHOD_KEYS.every((k) => off.walks[k].xs.length > 1), Object.keys(off.walks).join());
  check("Compare changes no walk at all",
    M.METHOD_KEYS.every((k) => off.walks[k].xs.join() === on.walks[k].xs.join()));
  check("the other three are the ones not chosen",
    off.others.map((w) => w.kind).join() === "momentum,rmsprop,adam",
    off.others.map((w) => w.kind).join());
  check("compare is a display parameter, so it keeps the walk",
    /compare: \{[\s\S]{0,240}?display: true/.test(src));

  /* the two rail controls resolve into one engine key */
  check("SGD with momentum 0 is the plain rule", M.kindOf(base()) === "sgd");
  check("SGD with momentum 0.9 is the momentum rule",
    M.kindOf(base({ momentum: "0.9" })) === "momentum");
  check("momentum is ignored under Adam",
    M.kindOf(base({ optimizer: "adam", momentum: "0.9" })) === "adam");
  check("the budget is 500 steps", M.BUDGET === 500);
  check("the walk index never runs past the walk", off.units === off.mine.len);
}

/* --- 4 · the geometry is one function -------------------------------------- */
{
  const WIDTHS = [550, 620, 690, 776];
  let monotone = true;
  let inside = true;
  for (const w of WIDTHS) {
    const flat = M.layout(w, false);
    const tall = M.layout(w, true);
    if (!(tall.height > flat.height)) monotone = false;
    for (const L of [flat, tall]) {
      const rects = [L.map, L.panel, L.loss, ...(L.hasRate ? [L.rate] : [])];
      for (const r of rects) {
        if (r.x < 0 || r.x + r.w > w + 0.5 || r.y + r.h > L.height) inside = false;
      }
      if (L.panel.x < L.map.x + L.map.w) inside = false;
      if (L.loss.y < L.map.y + L.map.h) inside = false;
      if (L.hasRate && L.rate.y < L.loss.y + L.loss.h) inside = false;
      if (L.beatY < L.map.y + L.map.h || L.beatY > L.loss.y) inside = false;
    }
  }
  check("the stage is taller with the rate strip than without, at every width", monotone,
    WIDTHS.map((w) => `${M.layout(w, false).height}/${M.layout(w, true).height}`).join(" "));
  check("every panel sits inside the stage and below the one before it", inside);
  check("the map keeps the window's 8 x 6 aspect",
    WIDTHS.every((w) => Math.abs(M.layout(w, false).map.h / M.layout(w, false).map.w - 0.75) < 0.01),
    WIDTHS.map((w) => { const L = M.layout(w, false); return `${L.map.w}x${L.map.h}`; }).join(" "));
  check("stageHeight reads the scheduler and nothing else",
    M.stageHeight(690, base()) === M.layout(690, false).height
    && M.stageHeight(690, base({ scheduler: "steplr" })) === M.layout(690, true).height);
  check("the widget asks layout() for every rect and builds none of its own",
    (src.match(/M\.layout\(/g) ?? []).length >= 3
    && !/\{ x: PAD|const map = \{|const panel = \{/.test(src),
    `${(src.match(/M\.layout\(/g) ?? []).length} call sites`);
  check("the height is a function of the parameters and the width",
    /height: \(\{ w, \.\.\.values \}\) => M\.stageHeight\(w, values\)/.test(src));
}

/* --- 5 · the ladder's own lines, and the register (5.9) -------------------- */
{
  const names = [...M.METHODS.map((m) => m.short), "SGD", "Adam", "RMSprop"];
  let longest = 0;
  let allNamed = true;
  for (const o of M.LR_OPTIONS) {
    longest = Math.max(longest, o.detail.length);
    if (!names.some((n) => o.detail.includes(n))) allNamed = false;
  }
  check("every rate's line names at least one method", allNamed);
  check("no rate's line is longer than 110 characters", longest <= 110, `longest ${longest}`);
  check("the five rungs are the ones the mock measured",
    M.LR_LADDER.join() === "0.01,0.03,0.1,0.3,1", M.LR_LADDER.join());
  check("the lines are computed from the engine, not typed",
    /LR_DETAILS = ladderDetails\(\)/.test(modelSrc));
  check("the lines say which start they are about, once, on the field",
    M.STRINGS.lrDetail.includes("Beyond the local minimum")
    && M.LR_OPTIONS.every((o) => !o.detail.includes("Beyond the local minimum")));

  /* every reader-facing string in the model, swept for the register */
  const reader = [
    M.STRINGS.subtitle, M.STRINGS.blurb,
    ...Object.values(M.STRINGS),
    ...Object.values(M.WHERE),
    ...[...M.OPTIMIZER_OPTIONS, ...M.MOMENTUM_OPTIONS, ...M.SCHEDULER_OPTIONS,
      ...M.SURFACE_OPTIONS, ...M.SPEEDS, ...M.LR_OPTIONS]
      .flatMap((o) => [o.label, o.detail].filter(Boolean)),
  ];
  check("no reader-facing string says \"never\"", !reader.some((s) => /\bnever\b/i.test(s)));
  check("no reader-facing string names a lesson, notebook or cell",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter)\b/i.test(s)));
  check("the subtitle is two or three claims, not a paragraph",
    M.STRINGS.subtitle.length <= 300, `${M.STRINGS.subtitle.length} chars`);
  check("the gallery blurb fits the card's 120", M.STRINGS.blurb.length <= 120,
    `${M.STRINGS.blurb.length} chars`);
  check("the blurb in the manifest is the model's own",
    JSON.parse(read("widgets/manifest.json")).widgets
      .find((w) => w.slug === "optimizers").blurb === M.STRINGS.blurb);
  check("the widget is a draft in both files",
    /status: "draft"/.test(src)
    && JSON.parse(read("widgets/manifest.json")).widgets
      .find((w) => w.slug === "optimizers").status === "draft");
}

/* --- 6 · the start: the face, the drag, and the round trip ----------------- */
{
  /* the spec as the page declares it, reduced to what `resolveParams` reads */
  const spec = {
    x0: { type: "float", min: -4, max: 4, default: null },
    y0: { type: "float", min: -3, max: 3, default: null },
    start: {
      type: "segmented",
      options: (values) => [
        ...M.STARTS.map((s) => ({ value: s.value, label: s.label })),
        ...(M.isDragged(values) ? [{ value: M.DRAGGED, label: M.DRAGGED_LABEL }] : []),
      ],
      optionsFrom: ["x0", "y0"],
      default: "beyond",
    },
  };
  const resolve = (qs) => resolveParams(spec, new URLSearchParams(qs));

  check("a bare page starts Beyond the local minimum",
    M.startPoint(resolve("")).join() === "-3.6,0.6", M.startPoint(resolve("")).join());
  check("a named face names a point",
    M.startPoint(resolve("start=plateau")).join() === "3.5,2.5");
  check("the fourth face is not offered until the marker is dragged",
    optionKeys(spec.start, resolve("")).join() === "beyond,plateau,edge",
    optionKeys(spec.start, resolve("")).join());

  const dragged = resolve("x0=-2.25&y0=1.5&start=dragged");
  check("a dragged link offers the fourth face",
    optionKeys(spec.start, dragged).includes(M.DRAGGED));
  check("a dragged link selects it", dragged.start === M.DRAGGED, dragged.start);
  check("x0 and y0 set puts the start marker at them",
    M.startPoint(dragged).join() === "-2.25,1.5", M.startPoint(dragged).join());
  check("the walk begins where the marker is",
    M.computeFor(base({ start: "dragged", x0: -2.25, y0: 1.5 })).mine.xs[0] === -2.25);

  const named = resolve("x0=-2.25&y0=1.5&start=plateau");
  check("a named face wins over a stale pair of coordinates",
    M.startPoint(named).join() === "3.5,2.5", M.startPoint(named).join());
  check("the widget clears the pair on the frame after a named face is picked",
    /function syncStart\(params\)/.test(src) && /setParam\("x0", null\)/.test(src));
  check("a marker drag re-enters through the data door, so the walk restarts",
    /widgetApi\.setParam\("x0", now\.x0\)/.test(src));
  check("the first draw is exempt, so an authored link keeps its head start",
    /if \(settled === null\)/.test(src));
  check("the cleared pair leaves the URL",
    toQuery(spec, { start: "plateau", x0: null, y0: null }) === "start=plateau",
    toQuery(spec, { start: "plateau", x0: null, y0: null }));
  check("a dragged start is a link that reproduces it (3.6)",
    toQuery(spec, { start: "dragged", x0: -2.25, y0: 1.5 })
      === "x0=-2.25&y0=1.5&start=dragged",
    toQuery(spec, { start: "dragged", x0: -2.25, y0: 1.5 }));
  check("the drag is a data change, so x0 and y0 are not display parameters",
    !/x0: \{[^}]*display: true/.test(src) && !/y0: \{[^}]*display: true/.test(src));
  check("the drag writes all five parameters it declares",
    /params: \["start", "x0", "y0", "turn", "tilt"\]/.test(src));
  check("the drag names a hit-test, so a click off the marker turns nothing",
    /hit: \(\{ x, y, w, params, state \}\)/.test(src));
  check("a dragged start is clamped inside the frame",
    M.clampX(-99) > -4 && M.clampX(99) < 4 && M.clampY(-99) > -3 && M.clampY(99) < 3,
    `${M.clampX(-99)} ${M.clampX(99)} ${M.clampY(-99)} ${M.clampY(99)}`);
}

/* --- 7 · the pace, the reveal and the contract ----------------------------- */
{
  check("Slow is the only pace that choreographs (4.1)",
    M.choreographs("slow") && !M.choreographs("medium") && !M.choreographs("fast"));
  check("the paces are 2.5 s, 0.4 s and 40 steps a second",
    M.stepMs("slow") === 2500 && M.stepMs("medium") === 400 && M.stepMs("fast") === 25);
  check("all three paces run on one clock, so a pace is a rate",
    !("beatMs" in M) && M.stepMs("fast") * 40 === 1000);
  check("a beat in flight is cleared when the clock changes",
    /if \(ms !== anim\.clock\)/.test(src));
  check("the widget opens empty, with the head start hidden (2.1, 4.4)",
    /shown: \{ type: "int", min: 0, max: M\.BUDGET, default: 0, hidden: true \}/.test(src));
  check("the animation reveals index k and never recomputes (non-negotiable 2)",
    !/computeFor/.test(src.split("animation:")[1] ?? ""));
  check("the relief renderer is imported from widget 48, not copied",
    /from "\.\.\/gradients\/model\.js"/.test(src) && !/function reliefMesh/.test(src));
  /* the viewpoint is MEASURED (decision 7, `_lab/dl-optim-view.mjs`): rather
     than pin two numbers, prove the property they were chosen for, that the
     walk the widget exists to show is in view from where it opens */
  {
    const az = Number((src.match(/RELIEF_AZ = (\d+)/) ?? [])[1]);
    const el = Number((src.match(/RELIEF_EL = (\d+)/) ?? [])[1]);
    const [xd, yd] = M.TRENCH.range;
    const field = M.sampledField(M.heightField(M.TRENCH), xd, yd, 66);
    const w = M.trace(M.TRENCH, "momentum", 0.3, M.STARTS[0].at);
    let seen = 0;
    for (let k = 0; k < 60; k += 1) {
      if (!reliefHidden(field, xd, yd, (w.xs[k] + w.xs[k + 1]) / 2, (w.ys[k] + w.ys[k + 1]) / 2, az, el)) seen += 1;
    }
    check(`the viewpoint is this widget's own and measured: ${seen} of the crossing walk's first 60 segments in view from ${az}/${el} (at least 50)`,
      Number.isFinite(az) && Number.isFinite(el) && !/RELIEF_DEFAULT_AZ/.test(src) && seen >= 50);
  }
  check("the legend is a function of the parameters, so it matches the figure",
    /legend: \(\{ params \}\) =>/.test(src));
  check("the gradient mark is in the legend exactly where it is drawn",
    /M\.choreographs\(params\.speed\)\s*\?\s*\[\{ token: "slope"/.test(src));
  check("Play speed sits below the drive row (3.4j)",
    /speed: \{[\s\S]{0,220}?afterDrive: true/.test(src));
  check("every colour is a token, never a literal",
    !/#[0-9a-fA-F]{3,6}\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, " ")));
  check("posAt interpolates between two recorded positions and invents none",
    M.posAt(M.computeFor(base()).mine, 0).join() === "-3.6,0.6");
}

/* --- 8 · the widget driven in node, with no browser and no clock ----------
 * `main.js` imports three things from core and two modules of its own, so
 * stubbing the core import captures the whole config object — and `compute`,
 * `animation.init/advance`, `legend`, `readout`, `summary` and `drag.value`
 * are then all callable with no DOM. What this catches that nothing above
 * does: that the animation reaches its last step at all, that a display
 * change keeps the walk where a data change resets it, that the drag turns
 * pixels into the coordinates it claims, and — cheapest of the lot — that no
 * readout tile or summary anywhere along the rail carries a NaN or an
 * undefined. `draw` wants a real canvas and is not called here.
 *
 * AND THE CONTRACT IS LISTED BY NAME, so a deletion is noticed: a rewrite
 * that dropped a whole `drag` block once left every existing assertion
 * passing, because all of them tested behaviour that was still there.
 */
{
  const abs = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);
  let text = read("widgets/optimizers/main.js");
  text = text.replace(/^import \{ defineWidget, makePlot, mathmlRenders \} from "\.\.\/core\/index\.js";$/m,
    "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);"
    + " const mathmlRenders = () => false;"
    + " const makePlot = () => { const p = new Proxy({}, { get: (t, k) => (k === 'sx' || k === 'sy' ? (v) => v : () => p) }); return p; };");
  text = text.replace(/from "\.\.\/gradients\/model\.js"/, `from ${abs("../gradients/model.js")}`);
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../optimizers/model.js")};`);
  text += "\nexport { __cfg };\n";
  const W = (await import(
    `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  )).__cfg;

  for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
    "params", "legend", "compute", "draw", "readout", "summary", "animation", "drag"]) {
    check(`the widget declares \`${key}\``, W[key] != null);
  }
  const WANT = {
    x0: "float", y0: "float", start: "segmented", optimizer: "segmented",
    momentum: "choice", lr: "choice", scheduler: "segmented", surface: "segmented",
    homeView: "bool", turn: "int", tilt: "int", compare: "bool", speed: "choice",
    shown: "int",
  };
  for (const [n, t] of Object.entries(WANT)) {
    check(`${n} is a ${t}`, W.params[n]?.type === t, W.params[n]?.type);
  }
  const declared = Object.entries(W.params)
    .filter(([, f]) => f.type !== "section").map(([n]) => n).sort().join();
  check("no parameters beyond those", declared === Object.keys(WANT).sort().join(), declared);
  check("the display parameters are the view, the comparison and the pace",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join()
      === "compare,homeView,speed,surface,tilt,turn",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join());
  check("the start, the rule, the rate and the schedule are DATA",
    ["start", "x0", "y0", "optimizer", "momentum", "lr", "scheduler"]
      .every((n) => !W.params[n].display));
  check("momentum shows under SGD alone",
    W.params.momentum.when?.param === "optimizer" && W.params.momentum.when?.equals === "sgd");
  check("Default view shows only where there is a surface to turn",
    W.params.homeView.when?.param === "surface" && W.params.homeView.when?.equals === "relief");

  const bad = (s) => /NaN|undefined|Infinity/.test(String(s));
  const defaults = Object.fromEntries(Object.entries(W.params)
    .filter(([, f]) => f.type !== "section").map(([n, f]) => [n, f.default]));
  const optionsOf = (f) => (f.type === "int" ? [f.min, f.default, f.max]
    : f.type === "float" ? [f.default]
      : f.type === "bool" ? [false, true]
        : (typeof f.options === "function" ? f.options(defaults) : f.options)
          .map((o) => (typeof o === "string" ? o : o.value)));

  /* every option of every parameter, at the start, mid-walk and finished */
  let tiles = 0;
  let offenders = [];
  for (const [name, field] of Object.entries(W.params)) {
    if (field.type === "section") continue;
    for (const v of optionsOf(field)) {
      const params = { ...defaults, [name]: v };
      const state = W.compute({ params });
      for (const k of [0, 1, 37, state.units]) {
        const anim = { k: Math.min(k, state.units), beat: 0, clock: 0, done: false };
        const say = [
          ...W.readout({ params, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
          W.summary({ params, state, anim }),
          ...W.legend({ params }).map((e) => e.label),
        ];
        tiles += say.length;
        for (const s of say) if (bad(s)) offenders.push(`${name}=${v} k=${k}: ${s}`);
      }
    }
  }
  check(`no readout, summary or legend string carries a NaN (${tiles} strings)`,
    offenders.length === 0, offenders.slice(0, 3).join(" | "));

  /* the animation reaches its end, in both modes */
  {
    const params = { ...defaults };
    const state = W.compute({ params });
    const anim = W.animation.init({ params, state, fromScratch: true });
    check("the walk opens empty (2.1)", anim.k === 0 && anim.done === false);
    /* A STEP TAKES THE PACE'S OWN TIME, as every other beat does, and then
       stops: `advance` returns true while the beat fills and false the frame it
       lands, so core re-queues until then and no further. */
    anim.mode = "step";
    let more = true;
    let n = 0;
    while (more && n < 100) { more = W.animation.advance(anim, { dt: 16, params, state }); n += 1; }
    check("one press of Step takes exactly one update", anim.k === 1, `${anim.k} after ${n} frames`);
    check("a press at 0.4 s a step lands in 25 frames of 16 ms", n === 25, String(n));
    anim.mode = "run";
    let frames = 0;
    while (!anim.done && frames < 20000) {
      W.animation.advance(anim, { dt: 16, params, state });
      frames += 1;
    }
    check("Play reaches step 500 and stops", anim.done && anim.k === state.units,
      `${anim.k} after ${frames} frames`);
    /* the pace each face promises, driven through a synthetic clock */
    for (const [speed, want] of [["medium", 2.5], ["fast", 40]]) {
      const p2 = { ...defaults, speed };
      const a = W.animation.init({ params: p2, state, fromScratch: true });
      a.mode = "run";
      /* ten seconds of frames, not one: a step count is an integer, and at
         2.5 a second one second of frames can only ever read 2 or 3 */
      for (let i = 0; i < 625; i += 1) W.animation.advance(a, { dt: 16, params: p2, state });
      const perSecond = a.k / 10;
      check(`${speed} takes ${want} steps a second`, Math.abs(perSecond - want) < want * 0.05,
        `${perSecond.toFixed(2)} a second`);
    }
    /* 500 steps at 0.4 s a step is 200 seconds, which is 12 500 frames of 16 ms
       — the number that catches the arrivals-only branch, where 60 frames took
       the whole walk 60 steps and Medium ran at 60 a second */
    check("Play at Medium takes 0.4 s a step, not one step a frame",
      frames > 12000 && frames < 13000, `${frames} frames`);

    /* Slow choreographs: three beats to one step */
    const slow = { ...defaults, speed: "slow" };
    const a2 = W.animation.init({ params: slow, state, fromScratch: true });
    a2.mode = "step";
    W.animation.advance(a2, { dt: 1000, params: slow, state });
    check("a Slow step is still in flight after one second", a2.k === 0 && a2.beat > 0,
      `k ${a2.k} beat ${M.n2(a2.beat)}`);
    W.animation.advance(a2, { dt: 1600, params: slow, state });
    check("a Slow step lands after 2.5 seconds", a2.k === 1, String(a2.k));

    /* a display change keeps the walk; the beat is cleared when the clock moves */
    const mid = { ...defaults, speed: "slow" };
    const a3 = W.animation.init({ params: mid, state, fromScratch: true });
    a3.k = 40;
    a3.beat = 0.6;
    W.animation.rebuild(a3, { params: { ...mid, compare: true }, state });
    check("toggling Compare keeps the walk and its beat", a3.k === 40 && a3.beat === 0.6);
    W.animation.rebuild(a3, { params: { ...mid, speed: "fast" }, state });
    check("changing the pace keeps the walk and clears the beat in flight",
      a3.k === 40 && a3.beat === 0);

    /* an authored head start applies, and is clamped to the walk */
    const short = W.compute({ params: { ...defaults, lr: "1", optimizer: "rmsprop" } });
    const a4 = W.animation.init({
      params: { ...defaults, lr: "1", optimizer: "rmsprop", shown: 500 },
      state: short,
      fromScratch: false,
    });
    check("shown= lands on the walk's own last step", a4.k === short.units, String(a4.k));
  }

  /* the drag turns pixels into coordinates, on both surfaces */
  {
    const params = { ...defaults };
    const state = W.compute({ params });
    const L = M.layout(690, false);
    const was = { start: "beyond", x0: null, y0: null, turn: 270, tilt: 42 };
    const right = W.drag.value({ dx: L.map.w / 8, dy: 0, start: was, params, state, w: 690 });
    check("a drag of an eighth of the map moves the start one unit right",
      right.x0 === -2.6 && right.y0 === 0.6, `(${right.x0}, ${right.y0})`);
    check("a marker drag lights the fourth face", right.start === M.DRAGGED);
    const up = W.drag.value({ dx: 0, dy: -L.map.h / 6, start: was, params, state, w: 690 });
    check("a drag up the map raises the second parameter", up.y0 === 1.6, String(up.y0));
    const far = W.drag.value({ dx: 9999, dy: 9999, start: was, params, state, w: 690 });
    check("a drag off the panel stops at the frame", far.x0 === 3.9 && far.y0 === -2.9,
      `(${far.x0}, ${far.y0})`);
    const turned = W.drag.value({
      dx: 100, dy: 20, start: was, params: { ...params, surface: "relief" }, state, w: 690,
    });
    check("on the relief the same gesture turns the camera",
      turned.turn === 220 && turned.tilt === 52 && turned.x0 === null,
      `az ${turned.turn} el ${turned.tilt}`);
    check("the camera's elevation stops short of straight down",
      W.drag.value({ dx: 0, dy: 9999, start: was, params: { ...params, surface: "relief" }, state, w: 690 }).tilt === 85);
  }

  /* the height the page reserves is the geometry's own */
  check("the widget's height is the layout's",
    W.height({ ...defaults, w: 690 }) === M.layout(690, false).height
    && W.height({ ...defaults, scheduler: "plateau", w: 690 }) === M.layout(690, true).height);
  check("the legend names the other paths only where they are drawn",
    !W.legend({ ...{ params: { ...defaults } } }).some((e) => e.label.includes("other optimizers"))
    && W.legend({ params: { ...defaults, compare: true } }).some((e) => e.label.includes("other optimizers")));
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
