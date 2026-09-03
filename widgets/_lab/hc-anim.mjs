/* ============================================================================
   Drive `hierarchical-clustering`'s animation with no browser and no clock.

     node widgets/_lab/hc-anim.mjs

   THE BROWSER PANE CANNOT TEST THIS. It throttles requestAnimationFrame to
   roughly one frame per 300 ms, so sampling the canvas on a wall clock reports
   a frozen animation whether or not it is one — measured here, an attempt to
   time the tween that way showed sixteen identical frames while the widget was
   in fact running. HANDOVER's recipe: stub the one import `main.js` makes, take
   the config object, and pump `advance` with a `dt` we choose.

   What this file is FOR is the tweening. `anim.shown` counts whole merges and
   `anim.acc` is how far into the next one the clock has got, so sub-merge
   motion means `acc` taking intermediate values while `shown` stands still.
   Nothing else in the repo can see that.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { cut as cutOf, distanceMatrix as distMat, HEAT_GENES, HEAT_SAMPLES }
  from "../hierarchical-clustering/model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.join(here, "..", "hierarchical-clustering", "main.js");

/* `main.js` imports exactly one thing, so replacing that line captures the
   whole config. The rest of the module is untouched, which is the point: this
   drives the SHIPPING code rather than a copy of its logic. */
let src = fs.readFileSync(MAIN, "utf8");
const IMPORT = /^import \{[^}]*\} from "\.\.\/core\/index\.js";$/m;
if (!IMPORT.test(src)) {
  console.error("main.js no longer imports from ../core/index.js on one line — fix this driver");
  process.exit(1);
}
/* `defineWidget` becomes a collector. `makeRng` is taken from core/rng.js
   directly — `compute` uses it for act 2's matrix, and importing core/index
   instead would pull in canvas.js, which wants a DOM. `fmt` is re-implemented
   for the same reason; it only ever formats a number here. */
src = src.replace(IMPORT,
  'import { makeRng } from "../core/rng.js";\n'
  + 'const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);\n'
  + 'const fmt = (v, d = 2) => Number(v).toFixed(d);');
src += "\nexport { __cfg };\n";

/* NO TEMP FILE. Writing the stub next to main.js works, but Windows keeps a
   loaded .mjs locked and the cleanup fails with EBUSY, leaving a stray module
   inside a widget directory that `check` counts. Rewriting main.js's relative
   specifiers to absolute URLs lets the whole thing be imported from a data:
   URL instead, which touches no disk at all. */
const widgetDir = path.join(here, "..", "hierarchical-clustering");
const asUrl = (p) => new URL(`file:///${path.resolve(p).replace(/\\/g, "/")}`).href;
src = src.replace(/from "(\.\.?\/[^"]+)"/g, (_, spec) => `from "${asUrl(path.join(widgetDir, spec))}"`);

const MOD = await import(
  `data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`
);
const W = MOD.__cfg;
const { flightFor } = MOD;

let checks = 0;
const fails = [];
const ok = (cond, msg) => { checks += 1; if (!cond) fails.push(msg); };

/* -------------------------------------------------------------------------
   WHAT THE WIDGET MUST HAVE. A driver that only exercises what exists cannot
   notice what stopped existing — the `drag` block that was deleted wholesale
   while every assertion still passed.
   ---------------------------------------------------------------------- */
for (const key of ["slug", "status", "title", "subtitle", "layout", "height",
                   "params", "compute", "draw", "readout", "legend", "animation"]) {
  ok(W[key] != null, `declares \`${key}\``);
}
const WANT = {
  view: "segmented",
  data: "section", separation: "choice", seed: "int", truth: "bool",
  algo: "section", linkage: "segmented", distance: "segmented",
  k: "int", speed: "choice", axis: "segmented",
  cutCols: "int", cutRows: "int", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) {
  ok(W.params[n]?.type === t, `param \`${n}\` is ${t}, got ${W.params[n]?.type}`);
}
ok(Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join(),
  `parameters are exactly ${Object.keys(WANT).length}: got ${Object.keys(W.params).join()}`);
for (const p of ["view", "truth", "speed", "k", "cutCols", "cutRows"]) {
  ok(W.params[p]?.display === true, `\`${p}\` is display:true — it must not reset the animation`);
}
for (const p of ["separation", "seed", "linkage", "distance"]) {
  ok(!W.params[p]?.display, `\`${p}\` is a DATA parameter — it must reset the animation`);
}

const defaults = Object.fromEntries(
  Object.entries(W.params).filter(([, d]) => d.default !== undefined).map(([n, d]) => [n, d.default])
);
const build = (over = {}) => {
  const params = { ...defaults, ...over };
  const state = W.compute({ params, rng: makeRng(params.seed), colors: {} });
  return { params, state };
};

/* -------------------------------------------------------------------------
   THE TWEEN. `shown` whole merges, `acc` milliseconds into the next.
   ---------------------------------------------------------------------- */
const SPEEDS = ["slow", "medium", "fast", "fastest"];

for (const speed of SPEEDS) {
  const { params, state } = build({ speed });
  const total = state.tree.height.length;
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "run";

  let frames = 0;
  let tweened = 0;                  // frames the FIGURE draws part-way through a merge
  const fractions = new Set();
  let lastShown = anim.shown;
  const seenShown = new Set([anim.shown]);
  while (W.animation.advance(anim, { dt: 40, params, state, colors: {} })) {
    frames += 1;
    ok(Number.isFinite(anim.acc) && anim.acc >= 0, `${speed}: acc went to ${anim.acc}`);
    ok(anim.shown >= lastShown, `${speed}: shown went backwards ${lastShown} -> ${anim.shown}`);

    /* The same predicate `draw` uses, not a copy of it. `acc` is non-zero
       between merges at EVERY speed, so counting that would have called Fast a
       tweening speed — it was the first version of this assertion and it was
       measuring the clock rather than the picture. */
    const f = flightFor({ anim, params, tree: state.tree, shown: anim.shown, built: false });
    if (f && f.t > 0 && f.t < 1) { tweened += 1; fractions.add(f.t.toFixed(3)); }

    lastShown = anim.shown;
    seenShown.add(anim.shown);
    if (frames > 5000) break;
  }
  /* The final `advance` returns false, so its merge count never reached the
     loop body — record it here. Without this the set was one short and the
     assertion below read as a skipped merge, which it was not. */
  seenShown.add(anim.shown);

  ok(anim.done === true, `${speed}: never finished — done is ${anim.done}`);
  ok(anim.shown === total, `${speed}: stopped at ${anim.shown} of ${total} merges`);

  /* THE POINT. Slow and Medium must spend frames INSIDE a merge; Fast and
     Fastest must not, because they declare no choreography. A tween that
     silently stopped tweening would otherwise look like a fast animation. */
  const choreo = speed === "slow" || speed === "medium";
  if (choreo) {
    ok(tweened > 0, `${speed}: the figure never drew a part-way merge — the tween is not running`);
    ok(fractions.size > 3,
      `${speed}: only ${fractions.size} distinct fractions drawn — that is a jump, not a tween`);
    ok(seenShown.size === total + 1,
      `${speed}: passed through ${seenShown.size} merge counts, expected ${total + 1} — a merge was skipped`);
  } else {
    ok(tweened === 0,
      `${speed}: drew ${tweened} part-way merges, but it declares no choreography`);
  }
  console.log(
    `  ${speed.padEnd(8)} ${String(frames).padStart(4)} frames of 40ms, ` +
    `${String(tweened).padStart(4)} drawn part-way (${fractions.size} distinct fractions), ` +
    `finished at ${anim.shown}/${total}`
  );
}

/* A STEP IS ONE MERGE, at the step pace whatever Play is set to. This is the
   bug that shipped once already: `advance` returning true in step mode ran the
   whole tree, and the third click hit the done-flag and pressed Replay. */
for (const speed of SPEEDS) {
  const { params, state } = build({ speed });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "step";
  let guard = 0;
  while (W.animation.advance(anim, { dt: 40, params, state, colors: {} })) {
    if (guard++ > 200) break;
  }
  ok(anim.shown === 1, `${speed}: one press advanced ${anim.shown} merges, expected 1`);
  ok(anim.acc === 0, `${speed}: a press ended mid-merge with acc ${anim.acc}`);
}

/* `shown=N` lands where it claims, which is what publishes a figure. */
for (const n of [0, 5, 14, 19]) {
  const { params, state } = build({ shown: n });
  const anim = W.animation.init({ params, state, fromScratch: false });
  ok(anim.shown === n, `shown=${n} initialised to ${anim.shown}`);
}

/* -------------------------------------------------------------------------
   THE READOUT, everywhere along the rail. Cheapest assertion in the file and
   the one that catches a wrong-but-finite number becoming an undefined.
   ---------------------------------------------------------------------- */
for (const separation of ["0", "1", "2", "3"]) {
  for (const linkage of ["average", "complete", "ward.D2"]) {
    for (const distance of ["euclidean", "manhattan"]) {
      for (const k of [2, 4, 6]) {
        for (const heatmap of [false, true]) {
          const { params, state } = build({ separation, linkage, distance, k, view: heatmap ? "heatmap" : "cluster" });
          const total = state.tree.height.length;
          for (const shown of [0, 7, total]) {
            const anim = { shown, acc: 0, done: shown >= total };
            const tiles = W.readout({ params, state, anim });
            const tag = `sep=${separation} ${linkage}/${distance} k=${k} heat=${heatmap} shown=${shown}`;
            ok(Array.isArray(tiles) && tiles.length > 0, `${tag}: readout is empty`);
            for (const t of tiles) {
              const s = `${t.label}|${t.value}|${t.note ?? ""}`;
              ok(!/NaN|undefined|null|Infinity/.test(s), `${tag}: readout says "${s}"`);
            }
          }
          const entries = W.legend({ params });
          ok(entries.every((e) => e.token && e.label && !/undefined/.test(e.label)),
            `sep=${separation} ${linkage}: legend entry is malformed`);
        }
      }
    }
  }
}

/* THREE INDEPENDENT CUTS, one per tree, and each control drives ITS OWN.
   `k` cuts the points, `cutCols` the samples, `cutRows` the genes — and the
   assertion is that none of them moves another, which is the state the widget
   was returned to after briefly sharing one number across two datasets. */
{
  for (const k of [2, 4, 6]) {
    for (const cutCols of [2, 3, 5]) {
      for (const cutRows of [3, 5, 8]) {
        const { params, state } = build({ k, cutCols, cutRows, view: "heatmap" });
        ok(new Set(cutOf(state.tree, k)).size === k,
          `k=${k}: the points were cut into ${new Set(cutOf(state.tree, k)).size}`);
        ok(new Set(cutOf(state.colTree, cutCols)).size === cutCols,
          `cutCols=${cutCols}: the samples were cut into ${new Set(cutOf(state.colTree, cutCols)).size}`);
        ok(new Set(cutOf(state.rowTree, cutRows)).size === cutRows,
          `cutRows=${cutRows}: the genes were cut into ${new Set(cutOf(state.rowTree, cutRows)).size}`);
      }
    }
  }
}

/* The three labels share one verb. A student meets `cutree` once and should
   recognise it three times; this fails if one of them drifts to another word. */
{
  for (const p of ["k", "cutCols", "cutRows"]) {
    ok(/^Cut tree/.test(W.params[p].label),
      `\`${p}\` is labelled "${W.params[p].label}" — every cut says "Cut tree"`);
  }
  for (const [p, arg] of [["cutCols", "cutree_cols"], ["cutRows", "cutree_rows"]]) {
    ok(String(W.params[p].detail).includes(arg),
      `\`${p}\` does not name pheatmap's \`${arg}\``);
  }
}

/* THE SHARED DIAL. `separation` drives BOTH stages now, and the matrix's
   `planted` has to follow it — derived from the gene index alone it called
   forty genes planted at every setting, so at "None" the readout reported
   "0 of 5 boxes hold no structure" over a matrix with nothing added to
   anything. Finite, plausible and exactly backwards. */
{
  ok(!W.params.separation.when, "`separation` is gated to one tab — it drives both stages");
  for (const [separation, wantPlanted] of [["3", true], ["2", true], ["1", true], ["0", false]]) {
    const { params, state } = build({ separation, view: "heatmap" });
    const planted = state.heat.planted.filter((v) => v !== null).length;
    ok((planted > 0) === wantPlanted,
      `separation=${separation}: ${planted} genes marked planted, expected ${wantPlanted ? "some" : "none"}`);

    const tiles = W.readout({ params, state, anim: { shown: state.tree.height.length, acc: 0, done: true } });
    const boxes = tiles.find((t) => String(t.label).includes("no structure"));
    if (separation === "0") {
      ok(boxes && String(boxes.value).startsWith(`${params.cutRows} of`),
        `separation=0: reported "${boxes && boxes.value}" — every box holds noise, so it must be all of them`);
    }
  }
}

/* THE AXIS, on a square table. 20 genes by 20 samples means 20 objects and a
   20 x 20 distance matrix whichever way it is pointed — the toggle is
   symmetric, which the 20 x 2 table it replaced could not be. */
{
  for (const axis of ["rows", "columns"]) {
    const { params, state } = build({ axis, view: "cluster" });
    ok(state.objects.length === 20, `axis=${axis}: ${state.objects.length} objects, expected 20`);
    ok(state.tree.height.length === 19, `axis=${axis}: ${state.tree.height.length} merges`);
    ok(state.pts.length === 20, `axis=${axis}: ${state.pts.length} scatter points`);
    ok(state.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      `axis=${axis}: an MDS coordinate is not finite`);

    /* MDS must be deterministic — a random start would rotate the plane on
       every render and the same seed would not draw the same picture. */
    const again = W.compute({ params, rng: makeRng(params.seed), colors: {} });
    ok(JSON.stringify(again.pts) === JSON.stringify(state.pts),
      `axis=${axis}: MDS is not reproducible from the same seed`);

    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.mode = "run";
    let guard = 0;
    while (W.animation.advance(anim, { dt: 40, params, state, colors: {} })) {
      if (guard++ > 3000) break;
    }
    ok(anim.shown === 19, `axis=${axis}: animation stopped at ${anim.shown}`);
  }
}

/* MDS PLACES REAL STRUCTURE APART AND NOISE TOGETHER. If this ever stops
   holding, the scatter has stopped agreeing with the distances beside it. */
{
  /* BY LABEL, not by position. The generator shuffles the columns, so the
     first ten points are no longer one condition — splitting the array in half
     measured a mixture against a mixture and reported no separation where
     there is plenty. */
  const spread = (sep) => {
    const { state } = build({ separation: sep, axis: "columns", view: "cluster" });
    const mean = (c) => {
      const xs = state.pts.filter((_, i) => state.heat.condition[i] === c).map((p) => p.x);
      return xs.reduce((s, v) => s + v, 0) / xs.length;
    };
    return Math.abs(mean(0) - mean(1));
  };
  const clear = spread("3");
  const none = spread("0");
  ok(clear > none * 3,
    `MDS separates the two conditions by ${clear.toFixed(2)} with structure and ` +
    `${none.toFixed(2)} without — it should be far larger with`);
}

/* The distance matrix is symmetric with a zero diagonal, whichever axis. */
{
  const { state } = build({ view: "heatmap" });
  ok(state.heat.rows.length === HEAT_GENES && state.heat.cols.length === HEAT_SAMPLES,
    "the heatmap axes are not the sizes the figure claims");
  for (const dist of ["euclidean", "manhattan"]) {
    const sm = distMat(state.heat.cols, dist);
    ok(sm.n === HEAT_SAMPLES, `sample distance matrix is ${sm.n} x ${sm.n}`);
    ok(sm.max > 0, `${dist}: a distance matrix is entirely zero`);
    for (let i = 0; i < sm.n; i += 1) {
      ok(sm.D[i][i] === 0, `${dist}: the diagonal is not zero at ${i}`);
      for (let j = 0; j < sm.n; j += 1) {
        ok(Math.abs(sm.D[i][j] - sm.D[j][i]) < 1e-12,
          `${dist}: the distance matrix is not symmetric at ${i},${j}`);
      }
    }
  }
}

/* THE TABS. Each must carry its own readout and its own legend: the first
   version shared both, which put "press Cluster" beside a matrix with no
   Cluster button and listed the linkage marks under a figure that draws none.
   And the heatmap tab must declare itself inert, or core leaves a live drive
   row building a tree that tab does not show. */
{
  for (const view of ["cluster", "heatmap"]) {
    const { params, state } = build({ view });
    const anim = W.animation.init({ params, state, fromScratch: true });
    ok(Boolean(anim.inert) === (view === "heatmap"),
      `view=${view}: anim.inert is ${anim.inert}`);

    const tiles = W.readout({ params, state, anim: { shown: state.tree.height.length, acc: 0, done: true } });
    const text = tiles.map((t) => `${t.label}|${t.value}|${t.note ?? ""}`).join(" ");
    ok(tiles.length > 0, `view=${view}: readout is empty`);
    if (view === "heatmap") {
      ok(!/press Cluster|Merges made|Height gap/.test(text),
        `view=heatmap: readout still carries act 1's tiles — "${text.slice(0, 80)}"`);
      ok(state.heat && state.rowTree && state.colTree, "view=heatmap: the matrix was not computed");
    } else {
      ok(!/Gene boxes|Columns cut/.test(text),
        `view=cluster: readout carries the matrix's tiles — "${text.slice(0, 80)}"`);
    }

    const marks = W.legend({ params }).map((e) => e.label).join(" ");
    if (view === "heatmap") {
      ok(!/Ward's spread|furthest members|every pair across/.test(marks),
        "view=heatmap: the legend still names the linkage marks");
      ok(/baseline/.test(marks), "view=heatmap: the legend does not name the value ramp");
    } else {
      ok(!/baseline|no structured gene/.test(marks),
        "view=cluster: the legend names the matrix's marks");
    }
  }
}

/* The legend names the linkage the reader chose — the entry has to MOVE, or it
   is widget 41's defect again: a legend that quietly describes another view. */
{
  const seen = new Set();
  for (const linkage of ["average", "complete", "ward.D2"]) {
    const { params } = build({ linkage });
    const marks = W.legend({ params }).map((e) => e.label).join("|");
    seen.add(marks);
  }
  ok(seen.size === 3, `the legend is the same for ${4 - seen.size} of the three linkages`);
}

console.log(`\n${checks} assertions`);
if (fails.length) {
  console.log(`\nFAIL — ${fails.length}:\n`);
  for (const f of fails.slice(0, 20)) console.log("  " + f);
  if (fails.length > 20) console.log(`  ... and ${fails.length - 20} more`);
  process.exit(1);
}
console.log("all pass");
