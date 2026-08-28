// time-event-drive.mjs — the widget's contract and numbers, no browser, no clock.
//
//   node widgets/_lab/time-event-drive.mjs
//
// The missing-drive pattern: stub the one import, capture the config, then
// call compute / animation / readout / summary from node. Capabilities are
// asserted BY NAME first — a driver that only exercises what exists cannot
// notice what stopped existing.

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { makeRng } from "../core/rng.js";

const here = dirname(fileURLToPath(import.meta.url));
let src = await readFile(join(here, "../time-event/main.js"), "utf8");
src = src.replace(
  /^import \{ defineWidget, makePlot, fmt \} from "\.\.\/core\/index\.js";$/m,
  `const __cfg = {};
const defineWidget = (c) => Object.assign(__cfg, c);
const makePlot = () => { throw new Error("draw() is not driven here"); };
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");`,
);
src = src.replace(
  /^import \{ km, logrank, coxph, simulate \} from "\.\/model\.js";$/m,
  `import { km, logrank, coxph, simulate } from ${JSON.stringify(pathToFileURL(join(here, "../time-event/model.js")).href)};`,
);
src += "\nexport { __cfg };\n";
const { __cfg: W } = await import(
  `data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`
);

let fails = 0;
const ck = (name, ok) => {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}`);
};

console.log("== capabilities, by name ==");
for (const key of ["slug", "title", "status", "subtitle", "layout", "height",
  "params", "legend", "compute", "animation", "draw", "readout", "summary"]) {
  ck(`declares \`${key}\``, W[key] != null);
}
const WANT = {
  concept: "segmented", reading: "section", censored: "segmented",
  curves: "section", truth: "bool", bands: "bool",
  model: "section", disease: "bool", age: "bool", snps: "bool",
  speed: "choice", seed: "int", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("three concepts, option-B labels",
  W.params.concept.options.map((o) => o.label).join("|") === "Censoring|Comparing groups|Finding factors");
ck("the pills are pills",
  ["disease", "age", "snps"].every((k) => W.params[k].style === "pill"));
ck("censored / truth / bands / pills / concept are display",
  ["censored", "truth", "bands", "disease", "age", "snps", "concept"]
    .every((k) => W.params[k].display === true));
ck("each tab's rail section is gated on its concept",
  W.params.reading.when?.equals === "censoring"
  && W.params.curves.when?.equals === "groups"
  && W.params.model.when?.equals === "factors");
ck("no gate anywhere (a gate hides the drive row this widget needs)",
  !Object.values(W.params).some((f) => f.type === "gate"));
ck("seed and shown are hidden", W.params.seed.hidden && W.params.shown.hidden);
ck("default seed is 3 (the measured clean seed)", W.params.seed.default === 3);

console.log("\n== compute, default seed ==");
const values = Object.fromEntries(Object.entries(W.params)
  .filter(([, f]) => f.type !== "section")
  .map(([k, f]) => [k, f.default]));
const state = W.compute({ params: { ...values }, rng: makeRng(values.seed) });
ck("five-patient kept curve: S ends at 0.3",
  Math.abs(state.five.kept.steps[state.five.kept.steps.length - 1].S - 0.3) < 1e-12);
ck("five-patient dropped curve ends at 0", state.five.dropped.steps[2].S === 0);
ck("200 patients split into two groups",
  state.groups[0].n + state.groups[1].n === 200);
ck("log-rank fires (p < 1e-4)", state.lr.p < 1e-4);
ck("all seven pill-combination fits present and converged",
  ["d", "a", "s", "da", "ds", "as", "das"].every((k) => state.fits[k]?.converged));
const full = state.fits.das.byName;
ck("cell 17's story on the default seed: Age, Disease, SNP_1-3 significant",
  full.age.p < 0.05 && full.disease.p < 0.05
  && full.snp1.p < 0.05 && full.snp2.p < 0.05 && full.snp3.p < 0.05);
ck("...and all seven null SNPs quiet",
  [4, 5, 6, 7, 8, 9, 10].every((j) => full[`snp${j}`].p >= 0.05));
ck("the groups tab's HR is the disease-only model's",
  Number.isFinite(state.fits.d.byName.disease.hr) && state.fits.d.members.length === 1);
ck("hazard bins exist and every drawn bin has both groups at 10+ at risk",
  state.hazBins.length >= 4 && state.hazBins.every((b) => Number.isFinite(b.h0) && Number.isFinite(b.h1)));
ck("disease at or above no-disease in every drawn bin (default seed)",
  state.hazBins.every((b) => b.ev0 + b.ev1 === 0 || b.h1 >= b.h0));
ck("the bins stop by 20 years", state.hazBins[state.hazBins.length - 1].hi <= 20);
ck("tEnd.censoring is 10", state.tEnd.censoring === 10);
ck("tEnd.groups is the last recorded time",
  state.tEnd.groups === Math.max(...state.stepTimes.groups));

console.log("\n== the sweep, pumped by hand ==");
const anim = W.animation.init({ params: { ...values }, state, fromScratch: true });
ck("starts at t = 0, not done", anim.t === 0 && !anim.done);
anim.mode = "step";
/* a step is a 350ms GLIDE now (round 6): advance returns true while
   tweening and false when it lands, so one step is pumped to completion */
W.animation.advance(anim, { dt: 16, params: { ...values }, state });
ck("mid-step the cursor is between times (the tween exists)",
  anim.t > 0 && anim.t < 5);
const stepToLanding = () => {
  let guard = 0;
  while (W.animation.advance(anim, { dt: 50, params: { ...values }, state }) && guard < 100) guard += 1;
};
const seen = [];
stepToLanding();
seen.push(anim.t);
for (let i = 0; i < 9 && !anim.done; i += 1) {
  stepToLanding();
  seen.push(anim.t);
}
ck("step lands on the five recorded times exactly: 5, 6, 7, 8, 10",
  seen.join() === "5,6,7,8,10");
ck("done after the last recorded time", anim.done === true);
/* reduced motion is core's fastForward at dt = 400 — one pump must land */
{
  const rm = W.animation.init({ params: { ...values }, state, fromScratch: true });
  rm.mode = "step";
  const more = W.animation.advance(rm, { dt: 400, params: { ...values }, state });
  ck("a dt=400 pump completes a step in one call (reduced motion)",
    more === false && rm.t === 5);
}

const run = W.animation.init({ params: { ...values }, state, fromScratch: true });
run.mode = "run";
let frames = 0;
while (!run.done && frames < 5000) {
  W.animation.advance(run, { dt: 16, params: { ...values }, state });
  frames += 1;
}
ck(`run reaches the end (${frames} frames at medium)`, run.done && frames < 1000);

/* the tab hand-off: finished on Censoring, keeps building on Comparing groups */
const cross = W.animation.init({ params: { ...values }, state, fromScratch: true });
cross.t = 10;
cross.done = true;
W.animation.rebuild(cross, { params: { ...values, concept: "groups" }, state });
ck("done is re-read on tab switch: 10 < tEnd.groups", cross.done === false);
W.animation.rebuild(cross, { params: { ...values, concept: "censoring" }, state });
ck("...and back", cross.done === true);

/* shown lands where it claims */
const shown = W.animation.init({
  params: { ...values, shown: 44 }, state, fromScratch: false,
});
ck("?shown=44 opens finished", shown.done === true);

console.log("\n== the forest's ease, pumped by hand ==");
{
  const pf = { ...values, concept: "factors", disease: true };
  const a = W.animation.init({ params: { ...values, concept: "factors" }, state, fromScratch: true });
  ck("no pills: every row targets alpha 0",
    Object.values(a.rowsT).every((r) => r.a === 0));
  W.animation.rebuild(a, { params: pf, state });
  ck("adding a pill requests frames (anim.easing)", a.easing === true);
  a.mode = "ease";
  let n = 0;
  while (W.animation.advance(a, { dt: 16, params: pf, state }) && n < 500) n += 1;
  const want = Math.log(state.fits.d.byName.disease.hr);
  ck(`the disease row lands on the model's value in ${n} frames`,
    Math.abs(a.rows.disease.v - want) < 1e-3 && Math.abs(a.rows.disease.a - 1) < 1e-3);
  ck("...and easing is cleared", a.easing === false);
  const pf2 = { ...pf, snps: true };
  W.animation.rebuild(a, { params: pf2, state });
  a.mode = "ease";
  n = 0;
  while (W.animation.advance(a, { dt: 16, params: pf2, state }) && n < 500) n += 1;
  const want2 = Math.log(state.fits.ds.byName.disease.hr);
  ck("adding the SNPs moves the disease row to the adjusted value",
    Math.abs(a.rows.disease.v - want2) < 1e-3);
  ck("a SNP row arrived with it", Math.abs(a.rows.snp1.a - 1) < 1e-3);
}

console.log("\n== readout and summary: no NaN, no undefined, anywhere ==");
let dirty = 0;
let states = 0;
const PILLS = [
  {}, { disease: true }, { age: true }, { snps: true },
  { disease: true, age: true, snps: true },
];
for (const concept of ["censoring", "groups", "factors"]) {
  for (const censored of concept === "censoring" ? ["kept", "dropped", "asevents"] : ["kept"]) {
    for (const pills of concept === "factors" ? PILLS : [{}]) {
      for (const t of [0, 5.2, 7, 10, 16, 22]) {
        const p = { ...values, concept, censored, ...pills };
        const tiles = W.readout({ params: p, state, anim: { t } });
        const text = tiles.map((x) => `${x.label} ${x.value} ${x.note}`).join(" ")
          + " " + W.summary({ params: p, state, anim: { t } });
        states += 1;
        if (/NaN|undefined|Infinity/.test(text)) {
          dirty += 1;
          console.log(`    DIRTY at ${concept}/${censored}/${JSON.stringify(pills)}/t=${t}: ${text}`);
        }
      }
    }
  }
}
ck(`all ${states} readout+summary states clean`, dirty === 0);

const h1 = W.height({ concept: "censoring" });
const h2 = W.height({ concept: "groups" });
const h3off = W.height({ concept: "factors", snps: false });
const h3on = W.height({ concept: "factors", snps: true });
ck(`heights finite; SNPs grow the factors tab (${h1}, ${h2}, ${h3off} → ${h3on})`,
  [h1, h2, h3off, h3on].every(Number.isFinite) && h3on > h3off);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
