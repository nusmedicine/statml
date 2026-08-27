/* ============================================================================
   Drive widget 25 with no browser and no clock.

   `main.js` imports defineWidget and makePlot, so stubbing the first and
   supplying the real second captures the whole config object — `compute`,
   `animation.init/advance`, `readout`, `summary` and even `draw` (against a
   recording canvas mock) become callable from node. This does NOT see the
   pixels — the fingerprint covers those.

   Run: node widgets/_lab/missing-drive.mjs

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(join(HERE, "..", "missing-data", rel)).href;

const src = readFileSync(join(HERE, "..", "missing-data", "main.js"), "utf8");
const patched = src
  .replace(
    /import \{ defineWidget, makePlot \} from "\.\.\/core\/index\.js";/,
    `import { makePlot } from "${pathToFileURL(join(HERE, "..", "core", "canvas.js")).href}";\n`
    + "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);",
  )
  .replace(/from "\.\/model\.js"/, `from "${abs("model.js")}"`)
  + "\nexport { __cfg };\n";
const W = (await import(
  `data:text/javascript;base64,${Buffer.from(patched).toString("base64")}`
)).__cfg;
const M = await import(abs("model.js"));
const { makeRng } = await import(pathToFileURL(join(HERE, "..", "core", "rng.js")).href);

let pass = 0;
let fail = 0;
const ck = (what, ok) => { if (ok) { pass += 1; } else { fail += 1; console.log(`  FAIL  ${what}`); } };

/* --- 1. what the widget must HAVE ------------------------------------------
   A driver that only exercises what exists cannot notice what stopped
   existing — a rewrite that drops `animation` or a parameter passes every
   behavioural assertion below, because those test what is still there. */
for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
                   "params", "legend", "compute", "draw", "readout", "summary", "animation"]) {
  ck(`declares \`${key}\``, W[key] != null);
}
const WANT = {
  mechanism: "segmented", rate: "choice", seed: "int",
  truth: "segmented", speed: "choice", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("True values sits directly after Seed, the clustering pair's pattern",
  Object.keys(W.params).join() === "mechanism,rate,seed,truth,speed,shown");
ck("mechanism, rate and seed are DATA parameters",
  ["mechanism", "rate", "seed"].every((n) => !W.params[n].display));
ck("truth and speed are DISPLAY parameters",
  ["truth", "speed"].every((n) => W.params[n].display === true));
ck("Play speed sits below the drive row", W.params.speed.afterDrive === true);
ck("the reveal does not", !W.params.truth.afterDrive);
ck("the drive row names its noun",
  W.animation.stepLabel === "Next patient" && W.animation.runLabel === "Play");
ck("three legend entries, tokens the roles the marks wear",
  W.legend.length === 3
  && W.legend.map((l) => l.token).join() === "empirical,unknown,reference");

/* --- 2. the caller actually calls the model --------------------------------
   Widget 24's mutation test: three assertions proved adjustedRandNoiseAware
   behaves and none proved the widget CALLS it. Testing a function is not
   testing the caller. */
for (const fn of ["M.applyMissing(", "M.checkPanel(", "M.checkVerdict(", "M.fitLine("]) {
  ck(`main.js calls ${fn}`, src.includes(fn));
}

/* --- 3. the engine's two load-bearing properties ---------------------------- */
{
  const rng = makeRng(3);
  const pts = M.cohort(120, rng);
  for (const mech of ["mcar", "mar", "mnar"]) {
    const p = M.missProbs(pts, mech, 0.3);
    const mean = p.reduce((s, x) => s + x, 0) / p.length;
    ck(`${mech} calibrated to the rate (got ${mean.toFixed(4)})`, Math.abs(mean - 0.3) < 1e-6);
  }
  const corr = (a, b) => {
    const ma = a.reduce((s, x) => s + x, 0) / a.length;
    const mb = b.reduce((s, x) => s + x, 0) / b.length;
    let sab = 0, sa = 0, sb = 0;
    for (let i = 0; i < a.length; i += 1) {
      sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2;
    }
    return sab / Math.sqrt(sa * sb);
  };
  const ages = pts.map((p) => p.age);
  const rMar = corr(M.missProbs(pts, "mar", 0.3), ages);
  const rMnar = corr(M.missProbs(pts, "mnar", 0.3), ages);
  ck(`MAR's probabilities track age (r = ${rMar.toFixed(2)})`, rMar < -0.9);
  ck(`MNAR's are orthogonal to age (r = ${rMnar.toFixed(2)})`, Math.abs(rMnar) < 0.15);
}

/* --- 4. compute: pure, seeded, reproducible -------------------------------- */
const VALUES = { mechanism: "mar", rate: "0.3", seed: 1, truth: "off", speed: "medium", shown: 0 };
const stateOf = (over = {}) => {
  const params = { ...VALUES, ...over };
  return W.compute({ params, rng: makeRng(params.seed) });
};
{
  const a = stateOf();
  const b = stateOf();
  ck("same seed, same cohort", JSON.stringify(a.pts) === JSON.stringify(b.pts));
  ck("120 patients", a.pts.length === 120);
  const mechs = ["mcar", "mar", "mnar"].map((m) => stateOf({ mechanism: m }));
  ck("one cohort under every mechanism — only the misses move",
    mechs.every((s) => Math.abs(s.trueMean - mechs[0].trueMean) < 1e-12));
}

/* --- 5. the animation: beats, runs, interruptions --------------------------- */
{
  const state = stateOf();
  const anim = W.animation.init({ params: VALUES, fromScratch: true });
  ck("starts empty, nothing in flight", anim.idx === 0 && anim.beatI === null && !anim.done);

  /* One step is one patient WATCHED: true while the beat is in flight, false
     when it lands, exactly one patient advanced. */
  anim.mode = "step";
  let frames = 0;
  let more = true;
  while (more && frames < 100) { more = W.animation.advance(anim, { dt: 16, params: VALUES }); frames += 1; }
  ck(`a step spans frames (${frames} at 16ms)`, frames >= 15 && frames <= 30);
  ck("and advances exactly one patient, beat cleared", anim.idx === 1 && anim.beatI === null);

  /* Mid-beat, choreography state is live. */
  anim.mode = "step";
  W.animation.advance(anim, { dt: 16, params: VALUES });
  ck("mid-beat: the arriving patient is marked", anim.beatI === 1 && anim.beatP > 0 && anim.beatP < 1);

  /* Play takes over mid-beat — the interrupted case that shipped three bugs
     elsewhere — and runs to the end. */
  anim.mode = "run";
  let guard = 0;
  while (W.animation.advance(anim, { dt: 16, params: VALUES }) && guard++ < 100000);
  ck("interrupted step, then run to completion", anim.done && anim.idx === 120 && anim.beatI === null);

  /* Choreography is a property of the SPEED: fast declares none. */
  const fastAnim = W.animation.init({ params: { ...VALUES, speed: "fast" }, fromScratch: true });
  fastAnim.mode = "run";
  W.animation.advance(fastAnim, { dt: 40, params: { ...VALUES, speed: "fast" } });
  ck("fast run carries no beat", fastAnim.beatI === null);
  const slowAnim = W.animation.init({ params: VALUES, fromScratch: true });
  slowAnim.mode = "run";
  W.animation.advance(slowAnim, { dt: 130, params: VALUES });
  ck("medium run marks the arriving patient", slowAnim.beatI === 0 && slowAnim.beatP < 1);

  /* shown= lands where it claims. */
  const pre = W.animation.init({ params: { ...VALUES, shown: 120 }, fromScratch: false });
  ck("shown=120 opens finished", pre.idx === 120 && pre.done);
}

/* --- 6. readout and summary: no NaN anywhere along the rail ----------------- */
{
  for (const mech of ["mcar", "mar", "mnar"]) {
    const params = { ...VALUES, mechanism: mech };
    const state = stateOf({ mechanism: mech });
    for (const truth of ["off", "on"]) {
      for (let idx = 0; idx <= 120; idx += 24) {
        const tiles = W.readout({ params: { ...params, truth }, state, anim: { idx } });
        const flat = tiles.flatMap((t) => [t.label, String(t.value), t.note ?? ""]).join(" ");
        ck(`no NaN/undefined: ${mech} truth=${truth} idx=${idx}`, !/NaN|undefined/.test(flat));
      }
    }
    const s = W.summary({ params, state, anim: { idx: 120 } });
    ck(`${mech} summary is a sentence`, typeof s === "string" && s.length > 60 && !/NaN|undefined/.test(s));
  }
}

/* --- 7. the verdict, through the model at the widget's own defaults --------- */
{
  const at = (mech, seed = 1) => {
    const rng = makeRng(seed);
    return M.checkVerdict(M.applyMissing(M.cohort(120, rng), mech, 0.3, rng), 0.3);
  };
  ck("seed 1: MAR reads sloped", at("mar") === "sloped");
  ck("seed 1: MCAR reads flat", at("mcar") === "flat");
  ck("seed 1: MNAR reads flat — the widget's claim", at("mnar") === "flat");
}

/* --- 8. draw, against a recording canvas ------------------------------------
   Strings only — the pixel truth is the fingerprint's job. Catches a NaN
   painted onto the canvas, a verdict printed before the clinic ends, and a
   caption that vanished. */
function mockCtx(seen) {
  const noop = () => {};
  return new Proxy({
    fillText: (s) => seen.push(String(s)),
    strokeText: noop,
    measureText: (s) => ({ width: String(s).length * 6.5 }),
  }, {
    get: (t, p) => (p in t ? t[p] : noop),
    set: () => true,
  });
}
const COLORS = new Proxy({
  font: "sans-serif", fsXs: "11px", fsSm: "12px", fsMd: "13px",
}, { get: (t, p) => (p in t ? t[p] : "#888888") });
{
  for (const mech of ["mcar", "mar", "mnar"]) {
    for (const [idx, truth] of [[0, "off"], [60, "off"], [120, "off"], [120, "on"]]) {
      const params = { ...VALUES, mechanism: mech, truth };
      const state = stateOf({ mechanism: mech });
      const seen = [];
      try {
        W.draw({ ctx: mockCtx(seen), colors: COLORS, w: 550, params, state,
          anim: { idx, beatI: null, beatP: 1 } });
      } catch (e) {
        ck(`draw throws at ${mech}/${idx}/${truth}: ${e.message}`, false);
        continue;
      }
      const joined = seen.join(" · ");
      ck(`draw paints no NaN (${mech} idx=${idx} truth=${truth})`, !/NaN|undefined/.test(joined));
      const verdictShown = /pattern in age|associated with age/.test(joined);
      ck(`verdict printed only at the end (${mech} idx=${idx})`,
        verdictShown === (idx === 120));
      ck(`caption present (${mech} idx=${idx})`, /Percentage missing, by age band/.test(joined));
    }
  }
  /* Mid-beat drawing at every speed's phase — the frame class that only the
     hand-pumped clock reached before this driver existed. */
  const state = stateOf();
  for (const beatP of [0.01, 0.5, 0.99]) {
    const seen = [];
    let threw = null;
    try {
      W.draw({ ctx: mockCtx(seen), colors: COLORS, w: 550, params: VALUES, state,
        anim: { idx: 7, beatI: 6, beatP } });
    } catch (e) { threw = e; }
    ck(`mid-beat frame draws clean at phase ${beatP}`, !threw && !/NaN/.test(seen.join(" ")));
  }
}

/* --- 9. height is a function of width and only width ------------------------ */
ck("height at 550 is sane", W.height({ w: 550 }) > 350 && W.height({ w: 550 }) < 520);
ck("height ignores parameters", W.height({ w: 550 }) === W.height({ w: 550, mechanism: "mnar" }));

console.log(`${fail ? "FAILURES" : "ALL PASS"} — ${pass + fail} assertions`);
process.exit(fail ? 1 : 0);
