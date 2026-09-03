/* Drives widget 41 `nmf` with no browser and no clock, by stubbing the one
   import its main.js makes. Asserts the contract, the numbers, and — cheapest
   of the lot — that no readout tile anywhere along the rail carries a NaN or an
   undefined. HANDOVER § *Driving the animation in node* has the recipe.

   Run:  node widgets/_lab/mf-drive.mjs
*/

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../core/rng.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* THE RELATIVE IMPORT HAS TO BECOME ABSOLUTE. A `data:` module has no base URL
   to resolve "../core/index.js" against, and the failure is an
   ERR_UNSUPPORTED_RESOLVE_REQUEST that says nothing about this widget. */
const abs = (rel) => pathToFileURL(join(HERE, "..", "matrix-factorization", rel)).href;
const src0 = readFileSync(join(HERE, "..", "matrix-factorization", "main.js"), "utf8");
const src = src0
  .replace(
    /^import \{ defineWidget, fmt \} from "\.\.\/core\/index\.js";$/m,
    `import { fmt } from "${abs("../core/index.js")}";\n`
    + "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);",
  )
  /* main.js's model moved to a sibling module, and that import is relative too */
  .replace(/from "\.\/model\.js";/, `from "${abs("model.js")}";`)
  + "\nexport { __cfg };\n";
if (!src.includes("__cfg") || src.includes('from "./model.js"')) {
  throw new Error("an import stub did not match — have main.js's import lines changed?");
}

const W = (await import(
  `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`
)).__cfg;

let pass = 0, fail = 0;
const ck = (name, ok, extra = "") => {
  if (ok) { pass += 1; return; }
  fail += 1;
  console.log(`  FAIL  ${name}${extra ? "  — " + extra : ""}`);
};

/* --- the contract, BY NAME, so a deletion is noticed --------------------- */
for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
  "params", "legend", "compute", "animation", "draw", "readout"])
  ck(`declares \`${key}\``, W[key] != null);

const WANT = {
  how: "section", method: "segmented", rank: "int", components: "int",
  algorithm: "segmented", start: "int",
  data: "section", programmes: "int", seed: "int",
  look: "section", view: "segmented", shown: "int",
};
for (const [n, t] of Object.entries(WANT))
  ck(`${n} is ${t}`, W.params[n]?.type === t, `got ${W.params[n]?.type}`);
/* THE RAIL READS TOP TO BOTTOM IN DECLARATION ORDER, and Kenneth set that order
   in round 3: what you are looking at, then what you do to it, then — below the
   Solve button — how you want to look at the result. Nothing else in the repo
   checks the order of a spec, and reordering is a one-line accident. */
ck("the rail reads data, then factorization, then view",
  Object.keys(W.params).join() ===
  "data,programmes,seed,how,method,rank,components,algorithm,start,look,view,shown",
  Object.keys(W.params).join());

/* `afterDrive` is what puts the view block UNDER Solve. Without it the view
   control climbs back above the button, which is the order this round undid. */
for (const n of ["look", "view"])
  ck(`${n} sits below the drive row`, W.params[n].afterDrive === true);
for (const n of ["data", "programmes", "seed", "how", "method", "rank", "components", "algorithm", "start"])
  ck(`${n} sits above the drive row`, !W.params[n].afterDrive);

ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join(),
  Object.keys(W.params).sort().join());

for (const key of ["init", "advance", "runLabel"])
  ck(`animation declares \`${key}\``, W.animation[key] != null);

/* `stepLabel` must be DECLARED AND NULL, which is what declines the Step button.
   Omitting it is not the same thing — core would fall back to "Draw one" and
   the widget would grow a second button nobody asked for. So the assertion is
   on the presence of the key AND the null, not on truthiness. */
ck("stepLabel is declared", "stepLabel" in W.animation);
ck("stepLabel is null, so Step is declined", W.animation.stepLabel === null);
ck("the run button is Solve", W.animation.runLabel === "Solve");

/* Every display-only parameter must say so, or a change to it discards the
   reader's descent (invariant 3). */
for (const n of ["view"])
  ck(`${n} is display-only`, W.params[n].display === true);
for (const n of ["method", "programmes", "seed", "rank", "components", "algorithm", "start"])
  ck(`${n} is a DATA parameter`, !W.params[n].display);
ck("no speed control", !("speed" in W.params));

/* The four NMF-only controls must be gated on the method, or the PCA tab
   shows a random start it does not have and an objective it never uses. */
for (const n of ["rank", "algorithm", "start"])
  ck(`${n} appears only on the NMF tab`,
    W.params[n].when?.param === "method" && W.params[n].when?.equals === "nmf");
ck("components appears only on the PCA tab",
  W.params.components.when?.param === "method" && W.params.components.when?.equals === "pca");

/* --- compute, over the whole parameter space ----------------------------- */
const defaults = Object.fromEntries(
  Object.entries(W.params).filter(([, f]) => "default" in f).map(([n, f]) => [n, f.default]));

function run(over = {}) {
  const params = { ...defaults, ...over };
  const state = W.compute({ params, rng: makeRng(params.seed) });
  return { params, state };
}

const bad = (v) => v == null || (typeof v === "number" && !Number.isFinite(v))
  || (typeof v === "string" && /NaN|undefined|Infinity/.test(v));

/* The widget's SCHEDULE is not exported, so the sweep asks the widget how long
   its own trace is rather than hardcoding a length that could drift. */
const SCHEDULE_LEN = run().state.snaps.length;

let cells = 0;
for (const method of ["nmf", "pca"]) {
for (const programmes of [2, 3, 4, 5]) {
  for (const rank of [1, 2, 3, 4, 5, 6]) {
    for (const algorithm of ["frobenius", "kl"]) {
      const { params, state } = run({ method, programmes, rank, components: rank, algorithm });
      const tag = `${method} p=${programmes} k=${rank} ${algorithm}`;
      cells += 1;
      ck(`${tag}: snapshots`, state.snaps.length > 0);
      const last = state.snaps[state.snaps.length - 1];
      ck(`${tag}: W is genes x k`, last.W.length === 24 && last.W[0].length === rank);
      ck(`${tag}: H is k x samples`, last.H.length === rank && last.H[0].length === 12);
      /* THE CONSTRAINT, ASSERTED. NMF may not produce a negative entry, and
         PCA on a centred matrix essentially always does — if the PCA tab ever
         came out all-positive the two tabs would be showing the same thing. */
      if (method === "nmf") {
        ck(`${tag}: W has no negative entry`, last.W.every((row) => row.every((v) => v >= 0)));
        ck(`${tag}: H has no negative entry`, last.H.every((row) => row.every((v) => v >= 0)));
      } else {
        ck(`${tag}: PCA does use minus signs`,
          last.W.flat().some((v) => v < 0) && last.H.flat().some((v) => v < 0));
      }
      ck(`${tag}: every snapshot finite`,
        state.snaps.every((s) => Number.isFinite(s.rel)
          && s.W.every((row) => row.every(Number.isFinite))
          && s.H.every((row) => row.every(Number.isFinite))));
      if (method === "nmf") {
        ck(`${tag}: residual falls`, last.rel <= state.snaps[0].rel + 1e-9,
          `${state.snaps[0].rel} -> ${last.rel}`);
        ck(`${tag}: agreement between starts in range`,
          state.betweenStarts <= 1.0000001 && Number.isFinite(state.betweenStarts));
      } else {
        ck(`${tag}: PCA is one snapshot`, state.snaps.length === 1);
        ck(`${tag}: PCA reports no agreement between starts`, state.betweenStarts === null);
      }
      ck(`${tag}: truth match in range`,
        state.toTruth <= 1.0000001 && Number.isFinite(state.toTruth));
      ck(`${tag}: unexplained is a fraction`,
        state.unexplained >= 0 && state.unexplained <= 1.5 && Number.isFinite(state.unexplained));

      /* the readout, at every stage of the animation */
      const anim = W.animation.init({ params, state, fromScratch: true });
      for (let step = 0; step <= state.snaps.length; step += 1) {
        const tiles = W.readout({ params, state, anim });
        for (const t of tiles) {
          if (bad(t.label) || bad(t.value) || bad(t.note))
            ck(`${tag} @${step}: readout clean`, false, JSON.stringify(t));
        }
        anim.mode = "step";
        W.animation.advance(anim, { dt: 0.016, params, state });
      }
      ck(`${tag}: readout clean at every step`, true);
    }
  }
}
}

/* --- the animation reaches its end, on the clock ------------------------- */
for (const method of ["nmf", "pca"]) {
  const { params, state } = run({ method });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "run";
  let frames = 0;
  while (W.animation.advance(anim, { dt: 1 / 60, params, state }) && frames < 100000) frames += 1;
  ck(`${method}: reaches the last snapshot`, anim.shown === state.snaps.length,
    `stopped at ${anim.shown}/${state.snaps.length}`);
  ck(`${method}: marks itself done`, anim.done === true);
  ck(`${method}: terminates`, frames < 100000, `${frames} frames`);
}
/* PCA has a closed form, so its "descent" is one snapshot and Solve lands in
   a single frame. NMF takes the whole schedule. That contrast is on screen in
   the readout, so it is asserted here rather than left to chance. */
ck("PCA solves in one snapshot", run({ method: "pca" }).state.snaps.length === 1);
ck("NMF takes the whole schedule", run({ method: "nmf" }).state.snaps.length > 10);

/* The PCA tab's readout compares itself with NMF's iteration count, and the
   first version read that count off the PCA snapshot — whose own counter is 1 —
   and printed "NMF took 1 updates". A wrong but finite number is invisible to
   the NaN sweep, so it is asserted directly. */
{
  const { params, state } = run({ method: "pca" });
  const anim = W.animation.init({ params, state, fromScratch: false });
  anim.shown = state.snaps.length;
  const note = W.readout({ params, state, anim }).map((t) => t.note).join(" ");
  ck("the PCA tab does not claim NMF took one update", !/NMF (took|needs) 1/.test(note), note);
  ck("the PCA tab names NMF's real iteration count", /NMF needs \d\d+/.test(note), note);
}

/* --- ?shown=N lands where it claims -------------------------------------- */
{
  const { params, state } = run({ shown: 9 });
  const anim = W.animation.init({ params, state, fromScratch: false });
  ck("shown=9 honoured on first render", anim.shown === 9, String(anim.shown));
  const replay = W.animation.init({ params, state, fromScratch: true });
  ck("Replay starts empty", replay.shown === 0);
}

/* --- the legend tracks the view ------------------------------------------ */
{
  const seen = new Set();
  for (const view of ["decomposition", "geometry"]) {
    for (const method of ["nmf", "pca"]) {
      const entries = W.legend({ params: { ...defaults, view, method } });
      ck(`legend for ${method}/${view} is non-empty`, entries.length > 0);
      ck(`legend for ${method}/${view} has labels`, entries.every((e) => e.label && e.token));
      seen.add(entries.map((e) => e.label).join("|"));
    }
  }
  ck("all four method/view pairs get their own legend", seen.size === 4);
  ck("k = 3 geometry drops the flat-region entry",
    W.legend({ params: { ...defaults, view: "geometry", rank: 3 } }).length
    < W.legend({ params: { ...defaults, view: "geometry", rank: 2 } }).length);
}

/* --- THE CLAIM ITSELF, asserted rather than hoped for ---------------------
   The widget exists to say that asking for more parts than the data holds
   costs you reproducibility. If that stops being true of this stage, the
   widget is teaching something false and this is where it should be caught. */
{
  const wellSpecified = [], overSpecified = [];
  for (let seed = 1; seed <= 6; seed += 1) {
    wellSpecified.push(run({ method: "nmf", programmes: 3, rank: 2, seed }).state.betweenStarts);
    overSpecified.push(run({ method: "nmf", programmes: 3, rank: 6, seed }).state.betweenStarts);
  }
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`\n  agreement between starts, median over 6 seeds:`);
  console.log(`    3 real programmes, 2 parts asked for: ${med(wellSpecified).toFixed(3)}`);
  console.log(`    3 real programmes, 6 parts asked for: ${med(overSpecified).toFixed(3)}`);
  ck("asking for too many parts costs agreement",
    med(overSpecified) < med(wellSpecified) - 0.05,
    `${med(overSpecified).toFixed(3)} vs ${med(wellSpecified).toFixed(3)}`);
}

/* --- THE CANVAS TEXT SWEEP, in node -------------------------------------
   This widget's `draw` uses no measureText, no gradient and no makePlot, so a
   recording stub is enough and the sweep needs no browser at all. That matters:
   the browser version of this sweep was written first and was USELESS. The hook
   goes on after the widget has already painted, so something has to force a
   fresh paint — and neither a synthetic `resize` event nor a real width change
   does so reliably when the automation browser throttles rAF to about one frame
   per 300 ms. It reported 24 of 38 states "painted NO text at all" on one run
   and 38 of 38 on the next, in a pattern with no relation to the parameters.
   Here every state is deterministic. */
function stubCtx() {
  const painted = [];
  const stack = [];
  let rotated = false;
  let fill = "#000000";
  const noop = () => {};
  const ctx = {
    painted,
    font: "11px mono",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "#000",
    get fillStyle() { return fill; },
    /* mixColour writes a token into fillStyle and reads the normalised value
       back out, so the stub has to echo rather than swallow it. */
    set fillStyle(v) { fill = v; },
    /* ROTATED TEXT RUNS VERTICALLY, so the horizontal bound below does not
       apply to it — the stub tracks just enough of the transform stack to know.
       Without this the rotated "Measurements" label reported as overrunning at
       every state, which is the kind of false positive that gets a whole check
       switched off. */
    save() { stack.push(rotated); }, restore() { rotated = stack.pop() ?? false; },
    rotate() { rotated = true; },
    fillRect: noop, beginPath: noop, moveTo: noop,
    lineTo: noop, stroke: noop, closePath: noop, fill: noop, arc: noop,
    setLineDash: noop, translate: noop, scale: noop, clearRect: noop,
    /* x and the align matter: a short string starting at x = 640 runs off a
       770px canvas while a long one starting at 40 does not. The first version
       of this sweep recorded only the string, so it passed a note that was
       visibly clipped on screen. */
    fillText(s, x) { painted.push({ s: String(s), x, align: ctx.textAlign, rotated }); },
  };
  return ctx;
}

const COLORS = {
  surface: "#fcfcfb", surface2: "#f9f9f7", surface3: "#f1f1ec",
  ink1: "#0b0b0b", ink2: "#52514e", ink3: "#898781", grid: "#e1e0d9", axis: "#898781",
  empirical: "#3b74d6", theory: "#c8791a", smoothed: "#2aa198", highlight: "#8b5cf6",
  reference: "#898781", groupA: "#3b74d6", groupB: "#d4a017",
  clusters: ["#3b74d6", "#d4a017", "#cc3b2f", "#2aa198", "#3f9142", "#8b5cf6"],
  valueLow: "#3b74d6", valueHigh: "#cc3b2f",
  font: "ui-monospace", fsXs: "11px", fsSm: "12px", fsMd: "13px", fsLg: "15px", fsFig: "20px",
};

/* --- PCA fits better than NMF at every k, which is the trade -------------
   A truncated SVD plus the mean is the best rank-k approximation there is,
   so PCA must win on residual; NMF gives up some of that fit for factors
   that add rather than cancel. If this ever flips, one of the two residuals
   has stopped being scored against V and the tabs are no longer comparable —
   which is exactly the bug that produced a PCA residual of 6.8 rising with k. */
for (const k of [1, 2, 3, 4, 5, 6]) {
  const nmfR = run({ method: "nmf", rank: k, programmes: 3 }).state.unexplained;
  const pcaR = run({ method: "pca", components: k, programmes: 3 }).state.unexplained;
  ck(`k=${k}: PCA reconstructs at least as well as NMF`, pcaR <= nmfR + 1e-9,
    `pca ${pcaR.toFixed(4)} vs nmf ${nmfR.toFixed(4)}`);
}

/* --- the declared height actually fits what is drawn ----------------------
   `height` is a function of the params here, and the PCA view's last strip is
   placed from the rank. Nothing else in the repo checks that the second agrees
   with the first: a pixel hash sees an identical picture whether the bottom
   strip is inside the canvas or clipped off it. So the driver records the
   lowest y any strip reaches and compares it with the height the widget asked
   for. It caught the first version, where `height` was a constant 690 and the
   strips at rank 3 were squeezed to 10px. */
{
  let worst = 0;
  for (const rank of [1, 2, 3, 4, 5, 6]) {
    const { params, state } = run({ view: "decomposition", rank, programmes: 3 });
    /* `height` may be a number or a function of the params (bayesian's door),
       and this widget has been both across two rounds. Handle either. */
    const declared = typeof W.height === "function" ? W.height({ ...params }) : W.height;
    const anim = W.animation.init({ params, state, fromScratch: false });
    anim.shown = state.snaps.length;
    /* re-run draw with a stub that records the lowest painted rectangle */
    let low = 0;
    const ctx = stubCtx();
    ctx.fillRect = (x, y, wd, ht) => { low = Math.max(low, y + ht); };
    W.draw({ ctx, colors: COLORS, w: 770, h: declared, params, state, anim });
    ck(`decomposition at k=${rank}: everything drawn fits in ${declared}px`,
      low <= declared, `lowest mark at ${Math.round(low)}`);
    worst = Math.max(worst, low / declared);
  }
  console.log(`
  the tightest view uses ${(100 * worst).toFixed(0)}% of its declared height`);
}

{
  let swept = 0, dirty = 0, blank = 0, over = 0, longest = "";
  for (const method of ["nmf", "pca"]) {
  for (const view of ["decomposition", "geometry"]) {
    for (const programmes of [2, 3, 5]) {
      for (const rank of [1, 2, 3, 6]) {
        for (const algorithm of ["frobenius", "kl"]) {
          for (const shown of [0, 4, SCHEDULE_LEN]) {
            const { params, state } = run({ method, view, programmes, rank, components: rank, algorithm });
            const anim = W.animation.init({ params, state, fromScratch: false });
            anim.shown = Math.min(shown, state.snaps.length);
            const ctx = stubCtx();
            W.draw({ ctx, colors: COLORS, w: 770, h: W.height, params, state, anim });
            swept += 1;

            const tiles = W.readout({ params, state, anim });
            const blob = ctx.painted.map((t) => t.s).join(" | ") + " || " + JSON.stringify(tiles)
              + " || " + JSON.stringify(W.legend({ params }));
            const tag = `${method} ${view} p=${programmes} k=${rank} ${algorithm} shown=${shown}`;
            if (/NaN|undefined|Infinity|\[object/.test(blob)) {
              dirty += 1;
              console.log(`  FAIL  ${tag}: ${blob.match(/.{0,60}(NaN|undefined|Infinity|\[object).{0,30}/)?.[0]}`);
            }
            if (ctx.painted.length === 0) { blank += 1; console.log(`  FAIL  ${tag}: painted no text`); }
            /* ~6px per character at --fs-xs in the mono face this widget uses */
            for (const t of ctx.painted) {
              if (t.rotated) { if (t.s.length > longest.length) longest = t.s; continue; }
              const wide = t.s.length * 6;
              const left = t.align === "right" ? t.x - wide : t.align === "center" ? t.x - wide / 2 : t.x;
              if (left + wide > 770 + 2 || left < -2) {
                over += 1;
                console.log(`  FAIL  ${tag}: "${t.s}" runs to ${Math.round(left + wide)} on a 770px canvas`);
              }
              if (t.s.length > longest.length) longest = t.s;
            }
          }
        }
      }
    }
  }
  }
  ck("no NaN / undefined / [object] in any painted string, tile or legend", dirty === 0);
  ck("every state paints some text", blank === 0);
  ck("no painted string runs off the canvas", over === 0, `${over} overruns`);
  /* At the ~6px per character this font measures, 78 characters is about 470px
     — comfortably inside the 770px canvas, and past that a caption is at risk
     of running off the panel it belongs to. */
  ck(`the longest painted string fits (${longest.length} chars)`, longest.length <= 78, longest);
  console.log(`\n  text sweep: ${swept} states, longest string ${longest.length} chars`);
  console.log(`    "${longest}"`);
}

console.log(`\n${pass} passed, ${fail} failed  (${cells} parameter cells)`);
process.exit(fail ? 1 : 0);
