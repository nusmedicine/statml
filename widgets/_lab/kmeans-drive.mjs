/* ============================================================================
   Drive widget 23 with no browser and no clock.

   `main.js` imports exactly one thing, so stubbing that import captures the
   whole config object and `compute`, `animation.init/advance`, `readout` and
   `summary` become callable from node. This does NOT see the drawing — use the
   canvas text sweep for the strings and the fingerprint for the pixels.

   Run: node widgets/_lab/kmeans-drive.mjs

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../core/rng.js";
import { adjustedRand } from "../kmeans/model.js";

/** What the run on screen scores against the truth — the widget prints this
    only once the true groups are shown, so the driver computes it directly. */
const adjustedRandOf = (state) => adjustedRand(state.y, state.run.labels);

const HERE = dirname(fileURLToPath(import.meta.url));

/* THE RELATIVE IMPORTS HAVE TO BECOME ABSOLUTE. A `data:` module has no base
   URL to resolve "../core/index.js" against, and the failure is an
   ERR_UNSUPPORTED_RESOLVE_REQUEST that says nothing about this widget. */
const abs = (rel) => pathToFileURL(join(HERE, "..", "kmeans", rel)).href;
const src = readFileSync(join(HERE, "..", "kmeans", "main.js"), "utf8")
  .replace(
    /^import \{ defineWidget, makeRng, fmt \} from "\.\.\/core\/index\.js";$/m,
    `import { makeRng, fmt } from "${abs("../core/index.js")}";\n`
    + "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);"
  )
  .replace(/from "\.\/model\.js";/, `from "${abs("model.js")}";`)
  + "\nexport { __cfg };\n";
const W = (await import(
  `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`
)).__cfg;

let pass = 0;
let fail = 0;
const ck = (what, ok) => { if (ok) { pass += 1; } else { fail += 1; console.log(`  FAIL  ${what}`); } };

/* --- 1. what the widget must HAVE ------------------------------------------
   A driver that only exercises what exists cannot notice what stopped
   existing. A rewrite that silently drops `animation` or a parameter passes
   every behavioural assertion below, because they test what is still there. */
for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
                   "params", "legend", "compute", "draw", "readout", "summary", "animation"]) {
  ck(`declares \`${key}\``, W[key] != null);
}
const WANT = {
  data: "section", groups: "choice", samples: "choice", seed: "int", labels: "segmented",
  fit: "section", k: "int", start: "int", restarts: "segmented",
  speed: "choice", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("the rail keeps the data and the fit apart",
  Object.keys(W.params).join() === "data,groups,samples,seed,labels,fit,k,start,restarts,speed,shown");
ck("the two pairs share a row, and each pair is one kind of thing",
  W.params.groups.row?.key === W.params.samples.row?.key
  && W.params.k.row?.key === W.params.start.row?.key
  && W.params.groups.row.key !== W.params.k.row.key);
ck("Play speed sits below the drive row, where the button it governs is",
  W.params.speed.afterDrive === true
  && Object.values(W.params).filter((f) => f.afterDrive).length === 1);
ck("k, groups, samples, seed, start and restarts are DATA parameters",
  ["k", "groups", "samples", "seed", "start", "restarts"].every((n) => !W.params[n].display));
ck("labels and speed are DISPLAY parameters",
  ["labels", "speed"].every((n) => W.params[n].display === true));
ck("the animation declares a lead, a step and a run",
  Boolean(W.animation.leadLabel && W.animation.stepLabel && W.animation.runLabel));
ck("every drive button names its noun",
  Boolean(W.animation.leadTitle && W.animation.stepTitle && W.animation.runTitle));
ck("k stops at the six cluster colours the tokens file defines", W.params.k.max === 6);

const defaults = Object.fromEntries(
  Object.entries(W.params).map(([n, f]) => [n, f.default])
);
const withP = (over = {}) => ({ ...defaults, ...over });

const run = (over = {}, { dt = 40, mode = "run", cap = 4000 } = {}) => {
  const params = withP(over);
  const state = W.compute({ params, rng: makeRng(params.seed) });
  let anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
  /* The lead first, exactly as core does it: nothing else is available until
     it has run. */
  anim.mode = "lead";
  let guard = 0;
  while (W.animation.advance(anim, { dt, params, state }) && (guard += 1) < cap);
  anim.mode = mode;
  guard = 0;
  const seen = [];
  while (W.animation.advance(anim, { dt, params, state }) && (guard += 1) < cap) {
    seen.push(anim.i);
  }
  return { params, state, anim, guard, seen };
};

/* --- 2. the run reaches its end -------------------------------------------- */
{
  const { state, anim, guard } = run();
  const total = state.run.steps.length - 1;
  ck("the default run reaches its last frame", anim.i === total);
  ck("and reports done", anim.done === true);
  ck("and does not spin", guard < 3000);
  ck("the last frame is an assignment that changed nothing",
    state.run.steps[total].kind === "assign" && state.run.converged);
  ck("the lead ran", anim.leadDone === true && anim.place === 1);
}

/* --- 3. one press of Iterate is one assign AND one update ------------------ */
{
  const params = withP();
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
  anim.mode = "lead";
  while (W.animation.advance(anim, { dt: 40, params, state }));
  ck("after the lead the figure sits on the init frame", anim.i === 0);

  const kinds = [];
  for (let press = 0; press < 3; press += 1) {
    anim.mode = "step";
    let g = 0;
    while (W.animation.advance(anim, { dt: 40, params, state }) && (g += 1) < 500);
    kinds.push(state.run.steps[anim.i].kind);
  }
  ck("every press of Iterate lands on an update, never mid-pair",
    kinds.every((k) => k === "update"), kinds.join(","));
  ck("three presses is three iterations",
    state.run.steps.slice(0, anim.i + 1).filter((s) => s.kind === "update").length === 3);
}

/* --- 4. `shown` lands where it claims -------------------------------------- */
{
  const params = withP({ shown: 4 });
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
  ck("shown=4 opens on frame 4", anim.i === 4);
  ck("shown implies the centroids are already placed", anim.leadDone && anim.place === 1);
  const big = W.animation.init({
    params: withP({ shown: 999 }),
    state,
    fromScratch: false,
    leadDone: false,
  });
  ck("shown past the end clamps to the last frame", big.i === state.run.steps.length - 1);
  const replay = W.animation.init({ params, state, fromScratch: true, leadDone: true });
  ck("Replay keeps the centroids and rewinds the loop",
    replay.i === 0 && replay.leadDone === true);
}

/* --- 5. no NaN and no undefined anywhere along the rail -------------------- */
{
  const bad = [];
  for (const k of [1, 2, 3, 4, 5, 6]) {
    for (const groups of ["2", "3", "4", "6"]) {
      for (const samples of ["4", "8", "12"]) {
        for (const labels of ["off", "on"]) {
          for (const seed of [1, 7, 42]) {
            const over = { k, groups, samples, labels, seed };
            const { params, state, anim } = run(over);
            const tiles = W.readout({ params, state, anim });
            const s = W.summary({ params, state, anim });
            const blob = JSON.stringify(tiles) + s;
            if (/NaN|undefined|Infinity/.test(blob)) bad.push(`${JSON.stringify(over)} -> ${blob}`);
            /* And at the START of the rail, before anything is assigned. */
            const a0 = W.animation.init({ params, state, fromScratch: true, leadDone: false });
            const t0 = JSON.stringify(W.readout({ params, state, anim: a0 }))
              + W.summary({ params, state, anim: a0 });
            if (/NaN|undefined|Infinity/.test(t0)) bad.push(`${JSON.stringify(over)} @start -> ${t0}`);
          }
        }
      }
    }
  }
  ck(`no NaN / undefined over 432 parameter combinations, run and at rest${bad.length ? `\n        ${bad.slice(0, 3).join("\n        ")}` : ""}`,
    bad.length === 0);
}

/* --- 6 & 7. THE CLAIM THE WIDGET IS BUILT ON, walked the way a reader does --
   The sweep panel that plotted all six K at once was cut, so this is no longer
   reading one array: it sets K, runs to convergence, reads the tiles, and does
   it again — which is the path the reader takes and therefore the thing that
   has to hold. */
{
  const tiles = [];
  for (const k of [1, 2, 3, 4, 5, 6]) {
    const { params, state, anim } = run({ k, labels: "on" });
    const r = W.readout({ params, state, anim });
    tiles.push({
      k,
      ss: Number(r[0].value),
      sil: r[1].value === "—" ? null : Number(r[1].value),
      ari: Number(r[2].value),
    });
  }
  const ss = tiles.map((t) => t.ss);
  ck(`the objective never rises with K: ${ss.map((v) => v.toFixed(2)).join(" > ")}`,
    ss.every((v, n) => n === 0 || v < ss[n - 1]));
  ck("the tile is the run on screen, not a separate fit",
    tiles.every((t) => Number.isFinite(t.ss)));
  const sils = tiles.filter((t) => t.sil !== null);
  const best = sils.reduce((a, b) => (b.sil > a.sil ? b : a));
  ck(`and the silhouette turns over where the objective does not — peaks at K = ${best.k}, then falls`
    + ` (${sils.map((t) => `${t.k}:${t.sil.toFixed(2)}`).join(" ")})`,
    best.k === Number(defaults.groups));
  ck(`ARI peaks at the true number of groups: ${tiles.map((t) => `${t.k}:${t.ari.toFixed(2)}`).join(" ")}`,
    tiles.reduce((a, b) => (b.ari > a.ari ? b : a)).k === Number(defaults.groups));

  /* Printed, because this is the walk the widget exists for and a reader
     should be able to check the tiles against it. */
  console.log("\n  what a reader sees moving K, at the defaults:");
  console.log("     K   within-cluster SS   silhouette   ARI");
  for (const t of tiles) {
    console.log(`    ${t.k}   ${t.ss.toFixed(2).padStart(13)}   ${(t.sil === null ? "—" : t.sil.toFixed(2)).padStart(10)}   ${t.ari.toFixed(2)}`);
  }
}

/* --- 7b. `start` moves the answer and NOT the data ------------------------- */
{
  const key = (X) => X.map((p) => p.map((v) => v.toFixed(9)).join()).join("|");
  const at = (start) => run({ start }).state;
  const base = at(1);
  ck("every start sees the same samples",
    [2, 3, 5, 11, 13, 40].every((s) => key(at(s).X) === key(base.X)));
  /* The first divergent start is FOUND, not hardcoded: a change of default
     stage moves it, and an assertion naming a number would then fail for a
     deliberate change instead of reporting the one thing that matters — how
     far the reader has to nudge before the lesson fires. */
  const here = Number(defaults.start);
  const aris = Array.from({ length: 12 }, (_, n) => adjustedRandOf(at(n + 1)));
  ck(`the starts do not all reach the same answer: ${aris.map((v) => v.toFixed(2)).join(" ")}`,
    new Set(aris.map((v) => v.toFixed(2))).size > 1);
  ck("the default start is one that reaches the true groups", aris[here - 1] > 0.999);
  const firstBad = aris.findIndex((v) => v < 0.95) + 1;
  ck(`and one within a few nudges is not — first at start ${firstBad}, ${Math.abs(firstBad - here)} away`,
    firstBad > 0 && Math.abs(firstBad - here) <= 3);
  const iters = at(here).run.iters;
  ck(`the default run has a loop worth watching: ${iters} iterations`, iters >= 3);

  /* THE NUMBER THE CATALOGUE QUOTES. Reported rather than asserted: it is a
     property of the stage, and pinning it in an assertion would fail the build
     for a change to `groups` that was deliberate. */
  console.log("\n  same 48 points, 60 different starts — how many land somewhere else:");
  for (const groups of ["2", "3", "4", "6"]) {
    const per = defaults.samples;   /* what a reader actually meets */
    let miss = 0;
    let first = null;
    for (let s = 1; s <= 60; s += 1) {
      const st = run({ groups, samples: per, k: Number(groups), start: s }).state;
      if (adjustedRandOf(st) < 0.95) { miss += 1; if (first === null) first = s; }
    }
    console.log(`    ${groups} groups of ${per}, K = ${groups}: ${String(miss).padStart(2)}/60`
      + (first ? `   first at start = ${first}` : "   none"));
  }
}

/* --- 8. the readout tracks the PICTURE, not the answer --------------------- */
{
  const params = withP();
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
  anim.mode = "lead";
  while (W.animation.advance(anim, { dt: 40, params, state }));
  const atStart = W.readout({ params, state, anim });
  ck("before the first assignment the objective is not printed",
    atStart[0].value === "—");

  const js = [];
  for (let press = 0; press < 4; press += 1) {
    anim.mode = "step";
    let g = 0;
    while (W.animation.advance(anim, { dt: 40, params, state }) && (g += 1) < 500);
    js.push(Number(W.readout({ params, state, anim })[0].value));
  }
  ck(`the objective falls as the reader iterates: ${js.join(" > ")}`,
    js.every((v, n) => n === 0 || v <= js[n - 1]));
  ck("ARI is withheld until the true groups are shown",
    W.readout({ params, state, anim }).length === 2
    && W.readout({ params: withP({ labels: "on" }), state, anim }).length === 3);
}

/* --- 9. the pacing is the chosen speed's, and Iterate ignores it ------------ */
{
  const timeOf = (over, mode) => {
    const params = withP(over);
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
    anim.mode = "lead";
    while (W.animation.advance(anim, { dt: 16, params, state }));
    anim.mode = mode;
    let ms = 0;
    let g = 0;
    /* One pair — an assign and an update — at 16ms a frame. */
    const stop = mode === "step" ? 1 : 2;
    while (W.animation.advance(anim, { dt: 16, params, state }) && (g += 1) < 4000) {
      ms += 16;
      if (state.run.steps.slice(0, anim.i + 1).filter((s) => s.kind === "update").length >= stop) break;
    }
    return ms;
  };
  const slow = timeOf({ speed: "slow" }, "run");
  const medium = timeOf({ speed: "medium" }, "run");
  const fast = timeOf({ speed: "fast" }, "run");
  ck(`Play speed changes how long a pair takes: slow ${slow}ms > medium ${medium}ms > fast ${fast}ms`,
    slow > medium && medium > fast);
  const stepAt = ["slow", "medium", "fast"].map((s) => timeOf({ speed: s }, "step"));
  ck(`and Iterate runs the full choreography at every setting: ${stepAt.join(", ")}ms`,
    new Set(stepAt).size === 1);
  ck("the height no longer depends on anything but the width",
    new Set(["slow", "fast"].map((s) => W.height({ ...withP({ speed: s }), w: 770 }))).size === 1);
  /* Derived rather than hardcoded: the constants live in `layout()` and a copy
     of them here would be the mirrored-heights defect the README warns about.
     What is asserted is the SHAPE — the stage grows with the canvas until it
     caps, and then the height stops moving. */
  const at = (w) => W.height({ ...withP(), w });
  ck(`the stage grows with a narrow canvas: ${at(300)} < ${at(360)}`, at(300) < at(360));
  ck(`and caps, so a wide canvas is no taller: ${at(694)} = ${at(900)}`, at(694) === at(900));
  ck("and the canvas is a real height at every width it can be given",
    [300, 360, 550, 694, 770, 900].every((w) => at(w) > 200));
}

/* --- 10. the canvas text sweep, run offline --------------------------------
   Every string the widget PAINTS, at every beat of the run and both settings
   of both display controls. The browser version of this needs a compositing
   tab to get frames; `draw` does not — it wants a 2-D context and nothing
   else, and a recording stub is a context as far as this widget is concerned.
   What it catches is what no assertion above can: a caption that says one
   thing while the picture does another, and a number printed as NaN at one end
   of a slider. */
function recorder() {
  const said = [];
  /* THE TRAP HAS TO PREFER THE TARGET'S OWN PROPERTIES. A first version
     returned a fresh no-op for every read, `fillText` included, so the sweep
     recorded nothing and reported an empty list rather than a failure — which
     is the exact shape of the widget-14 defect this check exists to catch. */
  /* Where it drew, as well as what it said. The fingerprint hashes one width
     and `check` asserts nothing about geometry, so an overrun at a width
     nobody looked at is invisible — and this collection has already shipped
     one, a caption and its note printing through each other at 550px. */
  const at = [];
  const target = {
    said,
    at,
    fillText: (s, x, y) => { said.push(String(s)); at.push([x, y, String(s)]); },
    strokeText: (s, x, y) => { said.push(String(s)); at.push([x, y, String(s)]); },
    measureText: (s) => ({ width: String(s).length * 6 }),
    canvas: { width: 770, height: 900 },
    moveTo: (x, y) => at.push([x, y, "path"]),
    lineTo: (x, y) => at.push([x, y, "path"]),
    arc: (x, y, r) => at.push([x - r, y - r, "arc"], [x + r, y + r, "arc"]),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { if (!(k in target)) t[k] = v; return true; },
  });
}

const COLORS = {
  surface: "#fff", surface2: "#eee", surface3: "#ddd",
  ink1: "#111", ink2: "#444", ink3: "#777", grid: "#eee", axis: "#999",
  empirical: "#38f", highlight: "#a5f", unknown: "#aaa", reference: "#999",
  clusters: ["#1", "#2", "#3", "#4", "#5", "#6"],
  font: "sans-serif", fsXs: "11px", fsSm: "13px", fsMd: "15px",
};

{
  const bad = [];
  const beats = new Set();
  for (const k of [1, 2, 3, 6]) {
    for (const groups of ["2", "6"]) {
      for (const labels of ["off", "on"]) {
        for (const [sp, restarts] of [["slow", "1"], ["fast", "10"]]) {
          const params = withP({ k, groups, labels, speed: sp, restarts });
          const state = W.compute({ params, rng: makeRng(params.seed) });
          const total = state.run.steps.length - 1;
          for (let i = 0; i <= total; i += 1) {
            for (const moving of [false, true]) {
              if (moving && i >= total) continue;
              const anim = {
                leadDone: true, place: 1, i, t: moving ? 0.5 : 1, moving, done: false,
              };
              const ctx = recorder();
              const hh = W.height({ ...params, w: 770 });
              W.draw({ ctx, colors: COLORS, w: 770, h: hh, params, state, anim });
              for (const s of ctx.said) {
                beats.add(s.replace(/\d+/g, "#"));
                if (/NaN|undefined|Infinity/.test(s)) bad.push(`k=${k} g=${groups} i=${i} "${s}"`);
              }
            }
          }
          /* And the state before the lead, which no `i` above reaches. */
          const ctx0 = recorder();
          W.draw({
            ctx: ctx0, colors: COLORS, w: 770, h: W.height({ ...params, w: 770 }),
            params, state,
            anim: { leadDone: false, place: 0, i: 0, t: 1, moving: false, done: false },
          });
          for (const s of ctx0.said) beats.add(s.replace(/\d+/g, "#"));
        }
      }
    }
  }
  ck(`no NaN / undefined painted on the canvas${bad.length ? `\n        ${bad.slice(0, 4).join("\n        ")}` : ""}`,
    bad.length === 0);

  /* THE CAPTIONS THEMSELVES, listed. A sweep whose output nobody reads is a
     sweep that catches nothing — widget 14's equation left the list silently
     and no assertion noticed the strings going missing. */
  const captions = [...beats].filter((s) => !/^#$/.test(s) && s !== "K").sort();
  ck("the assign beat names how many points changed",
    captions.some((s) => /^Assign — # points? changed cluster$/.test(s)));
  ck("and says so when none did", captions.includes("Assign — no point changed, so this is the answer"));
  ck("the update beat names what moves",
    captions.includes("Update — every centroid moves to the mean of its points"));
  ck("the lead state says there are no centroids yet",
    captions.includes("# samples, no centroids yet"));
  ck("and at ten starts the figure says the run is the best of them",
    captions.includes("# centroids — the best of # random starts"));
  ck("the iteration counter is drawn", captions.some((s) => /^Iteration #$/.test(s)));
  console.log("\n  every string the widget paints:");
  for (const c of captions) console.log(`    ${c}`);
}

/* --- 11. nothing is drawn off the canvas, at any width --------------------- */
{
  /* 550 is the narrowest the side layout ever produces — the fingerprint's
     900px frame is 20px above the 880px breakpoint where it stacks — so it is
     the width every recorded baseline is taken at and the one an overrun hides
     behind. 320 is a phone. */
  const over = [];
  for (const w of [320, 420, 550, 694, 770, 900]) {
    for (const sp of ["slow", "fast"]) {
      for (const k of [1, 6]) {
        const params = withP({ k, speed: sp });
        const state = W.compute({ params, rng: makeRng(params.seed) });
        const h = W.height({ ...params, w });
        const total = state.run.steps.length - 1;
        for (const i of [0, 1, 2, total]) {
          const ctx = recorder();
          W.draw({
            ctx, colors: COLORS, w, h, params, state,
            anim: { leadDone: true, place: 1, i, t: 0.5, moving: i < total, done: false, mode: "run" },
          });
          for (const [x, y, what] of ctx.at) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) { over.push(`w=${w} ${what} NOT FINITE`); continue; }
            /* A 12px allowance: `axisY`-style tick text is drawn right-aligned
               at its anchor, and a dot's stroke sits outside its radius. */
            if (x < -12 || x > w + 12 || y < -12 || y > h + 12) {
              over.push(`w=${w} speed=${sp} k=${k} i=${i} ${what} at ${Math.round(x)},${Math.round(y)} outside 0..${w} x 0..${h}`);
            }
          }
        }
      }
    }
  }
  ck(`nothing drawn outside the canvas at 320-900px${over.length ? `\n        ${[...new Set(over)].slice(0, 5).join("\n        ")}` : ""}`,
    over.length === 0);
}

/* --- 12. `restarts`, and the property the control rests on -----------------
   Ten starts BEGIN with the one start, because both draw from the same stream.
   So switching to ten can lower the objective or leave the picture exactly
   where it was, and can never land somewhere unrelated. If that ever stops
   being true the control becomes a re-roll wearing a different label, and the
   reader learns the wrong thing from a picture that moved for the wrong
   reason. Nothing else in this file would notice. */
{
  const worse = [];
  const identical = [];
  for (let start = 1; start <= 30; start += 1) {
    for (const k of [2, 4, 6]) {
      const one = run({ start, k, restarts: "1" }).state.run;
      const ten = run({ start, k, restarts: "10" }).state.run;
      if (ten.inertia > one.inertia + 1e-12) worse.push(`start ${start} K ${k}`);
      if (Math.abs(ten.inertia - one.inertia) < 1e-12) identical.push(`${start}/${k}`);
    }
  }
  ck(`ten starts are never worse than one${worse.length ? `: ${worse.slice(0, 4).join(", ")}` : ""}`,
    worse.length === 0);
  ck(`and often identical, which is itself the lesson: ${identical.length}/90 unchanged`,
    identical.length > 20 && identical.length < 90);

  /* The claim the control exists to make: at ten, the start stops mattering. */
  const missAt = (restarts) => {
    let miss = 0;
    for (let start = 1; start <= 30; start += 1) {
      if (adjustedRandOf(run({ start, restarts }).state) < 0.95) miss += 1;
    }
    return miss;
  };
  const one = missAt("1");
  const ten = missAt("10");
  console.log(`
  restarts: ${identical.length}/90 (start x K) pairs unchanged by ten starts; ` +
    `${one}/30 starts land elsewhere at n_init=1, ${ten}/30 at n_init=10`);
  ck(`ten starts fix the failing case: ${one}/30 land elsewhere at one start, ${ten}/30 at ten`,
    ten < one && ten <= 1);

  ck("the figure says when it is showing the best of ten, not one run",
    W.summary({
      params: withP({ restarts: "10" }),
      state: run({ restarts: "10" }).state,
      anim: run({ restarts: "10" }).anim,
    }).includes("best of 10"));
  ck("and says nothing of the sort at one start",
    !W.summary({
      params: withP(),
      state: run().state,
      anim: run().anim,
    }).includes("best of"));
}

console.log(`\n${fail === 0 ? "ALL PASS" : `${fail} FAILED`} — ${pass} assertions\n`);
process.exit(fail === 0 ? 0 : 1);
