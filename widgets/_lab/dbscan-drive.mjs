/* ============================================================================
   Drive widget 24 with no browser and no clock.

   `main.js` imports exactly one thing, so stubbing that import captures the
   whole config object and `compute`, `animation.init/advance`, `readout` and
   `summary` become callable from node. This does NOT see the drawing — the
   canvas text sweep below covers the strings and the fingerprint covers the
   pixels.

   Run: node widgets/_lab/dbscan-drive.mjs

   WRITTEN AFTER THE WIDGET SHIPPED, which is the wrong order and is recorded
   as such. Every check here was run by hand in a browser during the build and
   passed; the point of the file is that the NEXT change gets them for free
   instead of needing a person and a devtools console.

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../core/rng.js";
import { dbscan, rings, blobs, moons, recovered, adjustedRand,
  adjustedRandNoiseAware } from "../dbscan/model.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* THE RELATIVE IMPORTS HAVE TO BECOME ABSOLUTE. A `data:` module has no base
   URL to resolve "../core/index.js" against, and the failure is an
   ERR_UNSUPPORTED_RESOLVE_REQUEST that says nothing about this widget. */
const abs = (rel) => pathToFileURL(join(HERE, "..", "dbscan", rel)).href;
const src = readFileSync(join(HERE, "..", "dbscan", "main.js"), "utf8")
  .replace(
    /^import \{ defineWidget, fmt \} from "\.\.\/core\/index\.js";$/m,
    `import { fmt } from "${abs("../core/index.js")}";\n`
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
  data: "section", shape: "segmented", samples: "choice", groups: "choice",
  seed: "int", labels: "segmented",
  fit: "section", eps: "float", minPts: "int", discs: "segmented",
  speed: "choice", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("the rail keeps the data and the fit apart, and the disc toggle sits with the fit",
  Object.keys(W.params).join()
    === "data,shape,samples,groups,seed,labels,fit,eps,minPts,discs,speed,shown");
ck("`groups` is shown only on the stage that has a group count to change",
  W.params.groups.when?.param === "shape" && W.params.groups.when?.equals === "blobs");
ck("and it is the only gated control",
  Object.values(W.params).filter((f) => f.when).length === 1);
ck("Play speed sits below the drive row, where the button it governs is",
  W.params.speed.afterDrive === true
  && Object.values(W.params).filter((f) => f.afterDrive).length === 1);
ck("eps, min_samples, shape, samples, groups and seed are DATA parameters",
  ["eps", "minPts", "shape", "samples", "groups", "seed"].every((n) => !W.params[n].display));
ck("labels, discs and speed are DISPLAY parameters",
  ["labels", "discs", "speed"].every((n) => W.params[n].display === true));
ck("the animation declares a lead, a step and a run",
  Boolean(W.animation.leadLabel && W.animation.stepLabel && W.animation.runLabel));
ck("every drive button names its noun",
  Boolean(W.animation.leadTitle && W.animation.stepTitle && W.animation.runTitle));
ck("groups stops at the six cluster colours the tokens file defines",
  W.params.groups.options.every((o) => Number(o.value) <= 6));
/* THE DEFAULTS ARE MEASURED, NOT PICKED, and the catalogue says why for each.
   Pinning them here means a casual edit has to argue with a file. */
ck("eps opens at 0.40 — right on rings, and still right on blobs",
  W.params.eps.default === 0.40);
ck("min_samples opens at 5 — cell 60's own value", W.params.minPts.default === 5);
ck("the stage opens on rings, where DBSCAN beats K-Means", W.params.shape.default === "rings");
ck("48 samples, the size every planning number was measured at",
  W.params.samples.default === "48");
ck("and 24 is NOT offered: no eps recovers rings or moons there",
  W.params.samples.options.every((o) => Number(o.value) >= 48));
ck("the discs are off by default — they were reported as distracting",
  W.params.discs.default === "off");
ck("the true groups start hidden, so the picture is read before the answer",
  W.params.labels.default === "off");

const defaults = Object.fromEntries(
  Object.entries(W.params).map(([n, f]) => [n, f.default])
);
const withP = (over = {}) => ({ ...defaults, ...over });

const run = (over = {}, { dt = 40, mode = "run", cap = 8000 } = {}) => {
  const params = withP(over);
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
  anim.mode = "lead";
  let guard = 0;
  while (W.animation.advance(anim, { dt, params, state }) && (guard += 1) < cap);
  anim.mode = mode;
  guard = 0;
  const seen = [];
  while (W.animation.advance(anim, { dt, params, state }) && (guard += 1) < cap) seen.push(anim.i);
  return { params, state, anim, guard, seen };
};

/* --- 2. the run reaches its end -------------------------------------------- */
{
  const { state, anim, guard } = run();
  const total = state.frames.length - 1;
  ck("the default run reaches its last frame", anim.i === total);
  ck("and reports done", anim.done === true);
  ck("and does not spin", guard < 6000);
  ck("the lead ran", anim.leadDone === true && anim.mark === 1);
  ck("every stage runs to the end", ["rings", "moons", "blobs"].every((shape) => {
    const r = run({ shape });
    return r.anim.done === true && r.anim.i === r.state.frames.length - 1;
  }));
}

/* --- 3. the walk is ONE POINT AT A TIME ------------------------------------
   The whole of review round 2. A previous build grew one ring per BFS LAYER,
   which lit four points at once from four rings at once; three separate
   reports came back and they were one fault. These assertions are what would
   have caught it, and they are the reason this file exists at all. */
{
  const { state } = run();
  const visits = state.frames.filter((f) => f.beat === "visit");
  ck("every beat after the core verdict is a single point being examined",
    visits.length === state.frames.length - 1);
  ck("each visit names exactly one point",
    visits.every((f) => Number.isInteger(f.at)));
  ck("and only CORE points are ever examined — a border point cannot extend a cluster",
    visits.every((f) => state.res.core[f.at]));
  ck("there are as many visits as there are core points",
    visits.length === state.res.core.filter(Boolean).length);
  ck("each visit travels from the point examined before it",
    visits.every((f, i) => (i === 0 || f.k !== visits[i - 1].k
      ? f.prev === null : f.prev === visits[i - 1].at)));
  ck("a cluster's first visit has nowhere to travel from",
    visits.filter((f) => f.prev === null).length === state.res.nClusters);
  ck("one cluster is finished before the next is started",
    visits.map((f) => f.k).every((k, i, a) => i === 0 || k >= a[i - 1]));
  ck("the spokes reach every point inside the disc, not only the new ones",
    visits.every((f) => f.links.length === state.res.nb[f.at].length - 1));
  ck("and the caption's count is the disc's own, including the point itself",
    visits.every((f) => f.seen === state.res.nb[f.at].length));
  ck("the progress counter counts within the cluster it is walking",
    visits.every((f) => f.nth >= 1 && f.nth <= f.of));
  ck("every point a cluster owns is claimed by exactly one visit", (() => {
    const seen = new Set();
    for (const f of visits) for (const j of f.joins) { if (seen.has(j)) return false; seen.add(j); }
    return seen.size === state.res.labels.filter((l) => l !== -1).length;
  })());
}

/* --- 4. the recording IS the engine's answer -------------------------------
   The animation may take any route it likes through a cluster, but the last
   frame has to agree with `dbscan()` point for point — otherwise the picture
   ends somewhere the readout does not. */
{
  for (const shape of ["rings", "moons", "blobs"]) {
    for (const eps of [0.18, 0.30, 0.40, 0.60]) {
      const params = withP({ shape, eps });
      const state = W.compute({ params, rng: makeRng(params.seed) });
      const last = state.frames[state.frames.length - 1];
      const same = state.res.labels.every((l, i) => (l === -1 ? last.owner[i] === -1 : last.owner[i] === l));
      ck(`${shape} eps ${eps}: the final frame is the engine's labelling`, same);
    }
  }
}

/* --- 5. `shown` lands where it claims --------------------------------------- */
{
  for (const n of [0, 1, 5, 99]) {
    const params = withP({ shown: n });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: false, leadDone: false });
    const total = state.frames.length - 1;
    ck(`shown=${n} lands on frame ${Math.min(n, total)}`, anim.i === Math.min(n, total));
    ck(`shown=${n} implies the lead has happened`, n === 0 ? true : anim.leadDone === true);
  }
  const fresh = (() => {
    const params = withP({ shown: 40 });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    return W.animation.init({ params, state, fromScratch: true, leadDone: false });
  })();
  ck("and `fromScratch` ignores it — a reset is a reset", fresh.i === 0 && fresh.leadDone === false);
}

/* --- 6. no NaN and no undefined anywhere along either slider ---------------- */
{
  const bad = [];
  for (const shape of ["rings", "moons", "blobs"]) {
    for (let eps = W.params.eps.min; eps <= W.params.eps.max + 1e-9; eps += 0.05) {
      for (const minPts of [W.params.minPts.min, 5, W.params.minPts.max]) {
        for (const labels of ["off", "on"]) {
          const r = run({ shape, eps: Math.round(eps * 100) / 100, minPts, labels });
          const strings = [
            ...W.readout({ params: r.params, state: r.state, anim: r.anim })
              .flatMap((t) => [t.label, String(t.value), t.note ?? ""]),
            W.summary({ params: r.params, state: r.state, anim: r.anim }),
          ];
          for (const s of strings) {
            if (/NaN|undefined|Infinity/.test(s)) bad.push(`${shape} eps=${eps.toFixed(2)} m=${minPts} "${s}"`);
          }
        }
      }
    }
  }
  ck(`no NaN / undefined in the readout or summary, across both sliders and every stage${
    bad.length ? `\n        ${bad.slice(0, 4).join("\n        ")}` : ""}`, bad.length === 0);
}

/* --- 7. THE CLAIM THE WIDGET IS BUILT ON -----------------------------------
   "DBSCAN does not make you choose how many clusters there are. It makes you
   choose a radius, the radius decides how many you get — and the number you
   can compute from the picture prefers a radius that is too small."

   Both clauses, measured through the shipping widget rather than asserted. */
{
  const counts = [];
  for (let eps = 0.10; eps <= 0.80001; eps += 0.02) {
    const params = withP({ eps: Math.round(eps * 100) / 100 });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    counts.push(state.res.nClusters);
  }
  ck(`the radius decides the count: it takes ${new Set(counts).size} different values across the slider`,
    new Set(counts).size >= 4);
  ck("and the count is not monotone in eps — the same count arrives twice from different radii",
    counts.some((c, i) => i > 1 && c < counts[i - 1] && counts[i - 1] > counts[i - 2]));

  /* The second clause. The silhouette is computed from the picture alone, and
     it peaks at a radius that is WRONG — because throwing points away makes
     what is left look tighter. Over three stages. */
  const missed = [];
  for (const shape of ["rings", "moons", "blobs"]) {
    for (let seed = 1; seed <= 8; seed += 1) {
      let bestEps = null, bestSil = -Infinity;
      const working = [];
      for (let e = 0.10; e <= 0.80001; e += 0.01) {
        const eps = Math.round(e * 100) / 100;
        const params = withP({ shape, seed, eps });
        const state = W.compute({ params, rng: makeRng(seed) });
        const tiles = W.readout({
          params, state,
          anim: { leadDone: true, mark: 1, i: state.frames.length - 1, t: 1, moving: false, done: true },
        });
        const sil = tiles.find((t) => t.label === "Silhouette");
        const v = sil && sil.value !== "—" ? Number(sil.value) : null;
        if (v !== null && v > bestSil) { bestSil = v; bestEps = eps; }
        if (recovered(state.y, state.res.labels).all && state.res.nClusters === state.truth) working.push(eps);
      }
      if (working.length && !working.includes(bestEps)) missed.push(`${shape}/${seed}`);
    }
  }
  ck(`the silhouette picks a radius that does NOT work, on ${missed.length}/24 (stage, seed) pairs`,
    missed.length >= 20);
  console.log(`\n  the one sentence: the silhouette's own choice of eps fails on ${missed.length}/24 runs`);
}

/* --- 8. the readout tracks the PICTURE, not the answer ---------------------- */
{
  const params = withP();
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const at = (i, done) => W.readout({
    params, state, anim: { leadDone: true, mark: 1, i, t: 1, moving: false, done },
  });
  const early = at(2, false);
  const end = at(state.frames.length - 1, true);
  ck("the noise count is withheld until the growth has ended",
    early.find((t) => t.label === "Called noise").value === "—");
  ck("and is the engine's once it has",
    end.find((t) => t.label === "Called noise").value === String(state.res.noise.length));
  ck("the silhouette appears only at the end, because a half-grown cluster has no score",
    !early.some((t) => t.label === "Silhouette") && end.some((t) => t.label === "Silhouette"));
  ck("the cluster count grows with the picture rather than reporting the answer",
    Number(at(2, false).find((t) => t.label === "Clusters found").value) < state.res.nClusters);

  /* THE ARI IS GATED ON THE TRUTH BEING VISIBLE, and it is the CORRECTED one.
     `adjusted_rand_score` scores "I declined to cluster this" as "I found
     this": on two groups, a run that clusters one and calls the whole other
     one noise scores 1.000. Counting each noise point as its own singleton
     moves the number only where it was lying. */
  ck("no ARI while the true groups are hidden",
    !end.some((t) => t.label === "ARI"));
  const told = W.readout({
    params: withP({ labels: "on" }), state,
    anim: { leadDone: true, mark: 1, i: state.frames.length - 1, t: 1, moving: false, done: true },
  });
  ck("and an ARI once they are shown", told.some((t) => t.label === "ARI"));

  const truth = [...Array(24).fill(0), ...Array(24).fill(1)];
  const oneFoundOtherNoise = [...Array(24).fill(0), ...Array(24).fill(-1)];
  ck("the trap is real: sklearn's ARI scores 'one group found, the other all noise' as perfect",
    Math.abs(adjustedRand(truth, oneFoundOtherNoise) - 1) < 1e-9);
  ck("and the widget's reading does not",
    adjustedRandNoiseAware(truth, oneFoundOtherNoise) < 0.6);
  const bothFound = [...Array(24).fill(0), ...Array(24).fill(1)];
  ck("while a genuinely perfect answer still scores 1 — it is a correction, not a different metric",
    Math.abs(adjustedRandNoiseAware(truth, bothFound) - 1) < 1e-9);

  /* AND THAT THE TILE ACTUALLY USES IT. The three assertions above test the
     function; none of them tests the widget, and reverting the tile to
     `adjustedRand` passed all of them — found by mutating main.js and watching
     this file stay green. A decision Kenneth took explicitly deserves a guard
     that fails when it is undone. */
  {
     const p = withP({ shape: "blobs", eps: 0.30, labels: "on" });
     const st = W.compute({ params: p, rng: makeRng(p.seed) });
     const done = { leadDone: true, mark: 1, i: st.frames.length - 1, t: 1, moving: false, done: true };
     const shown = Number(W.readout({ params: p, state: st, anim: done }).find((t) => t.label === "ARI").value);
     const corrected = adjustedRandNoiseAware(st.y, st.res.labels);
     const sklearns = adjustedRand(st.y, st.res.labels);
     ck(`the ARI tile prints the corrected reading (${corrected.toFixed(3)}), not sklearn's (${sklearns.toFixed(3)})`,
       st.res.noise.length > 0
       && Math.abs(shown - Number(corrected.toFixed(2))) < 1e-9
       && Math.abs(corrected - sklearns) > 1e-6);
  }
}

/* --- 9. the pacing is the chosen speed's, and one press ignores it ---------- */
{
  const frames = (speed, mode) => {
    const r = run({ speed }, { dt: 16, mode });
    return r.seen.length;
  };
  const slow = frames("slow", "run");
  const medium = frames("medium", "run");
  const fast = frames("fast", "run");
  ck(`Slow takes longer than Medium, which takes longer than Fast (${slow} > ${medium} > ${fast})`,
    slow > medium && medium > fast);

  /* One press of "Next point" always runs the full beat, whatever Play is set
     to: its whole job is to show one hop, and a fast single hop is useless.
     `bootstrap` and widget 23 settled the same question the same way. */
  const stepFrames = (speed) => {
    const params = withP({ speed });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true, leadDone: false });
    anim.mode = "lead";
    let g = 0;
    while (W.animation.advance(anim, { dt: 16, params, state }) && (g += 1) < 4000);
    anim.mode = "step";
    g = 0;
    while (W.animation.advance(anim, { dt: 16, params, state }) && (g += 1) < 4000);
    return g;
  };
  ck(`one press of Next point is the same length at every speed (${stepFrames("slow")} = ${stepFrames("fast")})`,
    stepFrames("slow") === stepFrames("fast"));
}

/* --- 10. the height is a function of the width, and caps -------------------- */
{
  const at = (w) => W.height({ ...withP(), w });
  /* The stage is `min(400, w - 32)` square, so it stops growing at w = 432 —
     well below the 550 every baseline is recorded at. Asserting it still grew
     between 550 and 694 was this file's own first failure, and the widget was
     right. */
  ck("the stage grows with the frame while there is room", at(320) < at(432));
  ck(`and caps at 400 square, so every wider canvas is the same height: ${at(432)} = ${at(900)}`,
    at(432) === at(550) && at(550) === at(900));
  ck("every width gives a usable height",
    [320, 360, 550, 694, 770, 900].every((w) => at(w) > 200));
}

/* --- 11. the canvas text sweep, run offline --------------------------------
   Every string the widget PAINTS, at every beat and both settings of the
   display controls. `draw` wants a 2-D context and nothing else, and a
   recording stub is a context as far as this widget is concerned. It catches
   what no assertion above can: a caption that says one thing while the picture
   does another, and a number printed as NaN at one end of a slider. */
function recorder() {
  const said = [];
  const at = [];
  /* THE TRAP HAS TO PREFER THE TARGET'S OWN PROPERTIES. A version that
     returned a fresh no-op for every read, `fillText` included, recorded
     nothing and reported an empty list rather than a failure — which is the
     exact shape of the defect this check exists to catch. */
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
  surface: "#ffffff", surface2: "#eeeeee", surface3: "#dddddd",
  ink1: "#111111", ink2: "#444444", ink3: "#777777", grid: "#eeeeee", axis: "#999999",
  empirical: "#3388ff", highlight: "#aa55ff", unknown: "#aaaaaa", reference: "#999999",
  clusters: ["#112233", "#223344", "#334455", "#445566", "#556677", "#667788"],
  font: "sans-serif", fsXs: "11px", fsSm: "13px", fsMd: "15px",
};

{
  const bad = [];
  const beats = new Set();
  for (const shape of ["rings", "moons", "blobs"]) {
    for (const eps of [0.16, 0.30, 0.40, 0.62]) {
      for (const labels of ["off", "on"]) {
        for (const [speed, discs] of [["slow", "on"], ["fast", "off"]]) {
          const params = withP({ shape, eps, labels, speed, discs });
          const state = W.compute({ params, rng: makeRng(params.seed) });
          const total = state.frames.length - 1;
          for (let i = 0; i <= total; i += 1) {
            for (const moving of [false, true]) {
              if (moving && i >= total) continue;
              const anim = { leadDone: true, mark: 1, i, t: moving ? 0.5 : 1, moving, done: false, mode: "run" };
              const ctx = recorder();
              W.draw({ ctx, colors: COLORS, w: 770, h: W.height({ ...params, w: 770 }), params, state, anim });
              for (const s of ctx.said) {
                beats.add(s.replace(/\d+\.\d+/g, "#.##").replace(/\d+/g, "#"));
                if (/NaN|undefined|Infinity/.test(s)) bad.push(`${shape} eps=${eps} i=${i} "${s}"`);
              }
            }
          }
          /* And the state before the lead, which no `i` above reaches. */
          const ctx0 = recorder();
          W.draw({
            ctx: ctx0, colors: COLORS, w: 770, h: W.height({ ...params, w: 770 }), params, state,
            anim: { leadDone: false, mark: 0, i: 0, t: 1, moving: false, done: false },
          });
          for (const s of ctx0.said) {
            beats.add(s.replace(/\d+\.\d+/g, "#.##").replace(/\d+/g, "#"));
            if (/NaN|undefined|Infinity/.test(s)) bad.push(`pre-lead ${shape} "${s}"`);
          }
        }
      }
    }
  }
  ck(`no NaN / undefined painted on the canvas${bad.length ? `\n        ${bad.slice(0, 4).join("\n        ")}` : ""}`,
    bad.length === 0);

  /* THE CAPTIONS THEMSELVES, listed. A sweep whose output nobody reads is a
     sweep that catches nothing — widget 14's equation left the list silently
     and no assertion noticed the strings going missing. */
  const captions = [...beats].sort();
  ck("before anything is pressed the figure says what eps is reaching, and counts the core points",
    captions.some((s) => /^# points, each reaching #\.## — # core points?$/.test(s)));
  ck("the core beat names the rule, not just the verdict",
    captions.some((s) => /^# core points? — # or more neighbours inside the disc$/.test(s)));
  ck("a visit says how many are inside the disc, counting the point itself",
    captions.some((s) => /counting itself/.test(s)));
  ck("and says when a disc pulls nothing new in",
    captions.some((s) => /already in cluster #$/.test(s)));
  ck("a cluster's first point says the cluster starts there",
    captions.some((s) => /^Cluster # starts here/.test(s)));
  ck("the noise beat names what noise IS — never reached",
    captions.some((s) => /never reached — that is noise$/.test(s)));
  ck("the progress counter is drawn",
    captions.some((s) => /core point #\/#/.test(s)));
  ck("subject and verb agree on both sides of the join count",
    !captions.some((s) => /# new points joins/.test(s))
    && captions.some((s) => /# new points? joins? cluster #/.test(s)));
  console.log("\n  every string the widget paints:");
  for (const c of captions) console.log(`    ${c}`);
}

/* --- 12. nothing is drawn off the canvas, at any width ---------------------- */
{
  /* 550 is the narrowest the side layout ever produces — the fingerprint's
     900px frame is 20px above the 880px breakpoint where it stacks — so it is
     the width every recorded baseline is taken at and the one an overrun hides
     behind. 320 is a phone. */
  const over = [];
  for (const w of [320, 420, 550, 694, 770, 900]) {
    for (const shape of ["rings", "blobs"]) {
      for (const eps of [0.12, 0.40, 0.78]) {
        const params = withP({ shape, eps, discs: "on" });
        const state = W.compute({ params, rng: makeRng(params.seed) });
        const h = W.height({ ...params, w });
        const total = state.frames.length - 1;
        for (const i of [0, 1, 2, total]) {
          const ctx = recorder();
          W.draw({
            ctx, colors: COLORS, w, h, params, state,
            anim: { leadDone: true, mark: 1, i, t: 0.5, moving: i < total, done: false, mode: "run" },
          });
          for (const [x, y, what] of ctx.at) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) { over.push(`w=${w} ${what} NOT FINITE`); continue; }
            /* THE ALLOWANCE HAS TO COVER AN EPS DISC, which is drawn at the
               live radius on every point and legitimately runs off the stage
               at a wide radius — that is what a reach looks like when it is
               larger than the cloud. Text and dots are what this is guarding,
               so `arc` is measured only for being finite. */
            if (what === "arc") continue;
            if (x < -12 || x > w + 12 || y < -12 || y > h + 12) {
              over.push(`w=${w} ${shape} eps=${eps} i=${i} ${what} at ${Math.round(x)},${Math.round(y)} outside 0..${w} x 0..${h}`);
            }
          }
        }
      }
    }
  }
  ck(`nothing drawn outside the canvas at 320-900px${over.length ? `\n        ${[...new Set(over)].slice(0, 5).join("\n        ")}` : ""}`,
    over.length === 0);
}

/* --- 13. the stages are what the plan says they are ------------------------
   `samples` is a TOTAL here and per-group in widget 23, which is the kind of
   difference that gets "tidied" back into agreement by someone who has not
   read why. The reason is in the generators: `rings` defines its count as a
   total by construction, `blobs` splits its by group, and no single per-group
   number gives 48 on both. */
{
  for (const [shape, want] of [["rings", 48], ["moons", 48], ["blobs", 48]]) {
    const params = withP({ shape });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    ck(`${shape} at the default draws ${want} points`, state.X.length === want);
  }
  for (const n of ["48", "96", "150"]) {
    for (const shape of ["rings", "moons", "blobs"]) {
      const state = W.compute({ params: withP({ shape, samples: n }), rng: makeRng(1) });
      ck(`${shape} at samples=${n} lands within one point of it`,
        Math.abs(state.X.length - Number(n)) <= 2);
    }
  }
  ck("rings is two groups and moons is two, whatever `groups` says",
    ["rings", "moons"].every((shape) =>
      W.compute({ params: withP({ shape, groups: "6" }), rng: makeRng(1) }).truth === 2));
  ck("and blobs honours it", [2, 3, 4, 6].every((g) =>
    W.compute({ params: withP({ shape: "blobs", groups: String(g) }), rng: makeRng(1) }).truth === g));

  /* The stage decision itself: rings is the only place in the arc where the
     new method does something the previous one cannot. */
  const st = rings(makeRng(1), { per: 48 });
  const r = dbscan(st.map((s) => s.p), { eps: 0.40, minPts: 5 });
  ck("DBSCAN recovers both rings at the default settings",
    recovered(st.map((s) => s.g), r.labels).all && r.nClusters === 2);
  ck("and moons at 48 shows all three kinds of point at once, which rings cannot", (() => {
    const m = moons(makeRng(1), { per: 24 });
    const mr = dbscan(m.map((s) => s.p), { eps: 0.40, minPts: 5 });
    return recovered(m.map((s) => s.g), mr.labels).all
      && mr.core.filter(Boolean).length > 0 && mr.border.length > 0 && mr.noise.length > 0;
  })());
  ck("no eps recovers rings at 24 points — which is why 24 is not offered", (() => {
    const small = rings(makeRng(1), { per: 24 });
    const X = small.map((s) => s.p), y = small.map((s) => s.g);
    for (let e = 0.10; e <= 0.80001; e += 0.01) {
      const res = dbscan(X, { eps: Math.round(e * 100) / 100, minPts: 5 });
      if (recovered(y, res.labels).all && res.nClusters === 2) return false;
    }
    return true;
  })());
  /* `blobs` must be widget 23's stage point for point, or the two clustering
     widgets stop being comparable. */
  const a = blobs(makeRng(7), { groups: 4, per: 12 }).map((s) => s.p.join());
  const b = W.compute({ params: withP({ shape: "blobs", seed: 7 }), rng: makeRng(7) }).X.map((p) => p.join());
  ck("blobs is the same points widget 23 draws", a.join("|") === b.join("|"));
}

/* --- 14. a display parameter never discards the run ------------------------- */
{
  const params = withP();
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const mid = { leadDone: true, mark: 1, i: 4, t: 1, moving: false, done: false };
  for (const [name, value] of [["labels", "on"], ["discs", "on"], ["speed", "fast"]]) {
    const after = W.animation.init({
      params: withP({ [name]: value }), state, fromScratch: false, leadDone: mid.leadDone,
      shown: mid.i,
    });
    ck(`changing \`${name}\` keeps the lead`, after.leadDone === true);
  }
  ck("and the widget declares no `rebuild`, so core keeps `anim` untouched",
    W.animation.rebuild === undefined);
}

console.log(`\n${fail === 0 ? "ALL PASS" : `${fail} FAILED`} — ${pass} assertions\n`);
process.exit(fail === 0 ? 0 : 1);
