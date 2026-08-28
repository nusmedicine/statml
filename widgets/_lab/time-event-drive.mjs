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
  concept: "segmented", reading: "section", censored: "segmented", truth: "bool",
  bands: "bool", cox: "bool", speed: "choice", seed: "int", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("cox is a bool, NOT a gate (a gate hides the drive row this widget needs)",
  W.params.cox.type === "bool");
ck("censored / truth / bands / cox / concept are display",
  ["censored", "truth", "bands", "cox", "concept"].every((k) => W.params[k].display === true));
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
ck("cox12 converged", state.cox12.converged);
const sig = state.cox12.p.map((p) => p < 0.05);
ck("cell 17's story on the default seed: Age, Disease, SNP_1-3 significant",
  sig[0] && sig[1] && sig[2] && sig[3] && sig[4]);
ck("...and all seven null SNPs quiet", !sig.slice(5).some(Boolean));
ck("H4 rates are finite in all three bins, both groups",
  state.groups.every((g) => g.rates.every(Number.isFinite)));
ck("tEnd.patients is 10", state.tEnd.patients === 10);
ck("tEnd.groups is the last recorded time",
  state.tEnd.groups === Math.max(...state.stepTimes.groups));

console.log("\n== the sweep, pumped by hand ==");
const anim = W.animation.init({ params: { ...values }, state, fromScratch: true });
ck("starts at t = 0, not done", anim.t === 0 && !anim.done);
anim.mode = "step";
const seen = [];
for (let i = 0; i < 10 && !anim.done; i += 1) {
  W.animation.advance(anim, { dt: 16, params: { ...values }, state });
  seen.push(anim.t);
}
ck("step walks the five recorded times exactly: 5, 6, 7, 8, 10",
  seen.join() === "5,6,7,8,10");
ck("done after the last recorded time", anim.done === true);

const run = W.animation.init({ params: { ...values }, state, fromScratch: true });
run.mode = "run";
let frames = 0;
while (!run.done && frames < 5000) {
  W.animation.advance(run, { dt: 16, params: { ...values }, state });
  frames += 1;
}
ck(`run reaches the end (${frames} frames at medium)`, run.done && frames < 1000);

/* the tab hand-off: finished on Five patients, keeps building on Two groups */
const cross = { t: 10, done: true };
W.animation.rebuild(cross, { params: { ...values, concept: "groups" }, state });
ck("done is re-read on tab switch: 10 < tEnd.groups", cross.done === false);
W.animation.rebuild(cross, { params: { ...values, concept: "patients" }, state });
ck("...and back", cross.done === true);

/* shown lands where it claims */
const shown = W.animation.init({
  params: { ...values, shown: 44 }, state, fromScratch: false,
});
ck("?shown=44 opens finished", shown.done === true);

console.log("\n== readout and summary: no NaN, no undefined, anywhere ==");
let dirty = 0;
for (const concept of ["patients", "groups"]) {
  for (const censored of ["kept", "dropped", "asevents"]) {
    for (const cox of [false, true]) {
      for (const t of [0, 5.2, 7, 10, 16, 22]) {
        const p = { ...values, concept, censored, cox };
        const tiles = W.readout({ params: p, state, anim: { t } });
        const text = tiles.map((x) => `${x.label} ${x.value} ${x.note}`).join(" ")
          + " " + W.summary({ params: p, state, anim: { t } });
        if (/NaN|undefined|Infinity/.test(text)) {
          dirty += 1;
          console.log(`    DIRTY at ${concept}/${censored}/cox=${cox}/t=${t}: ${text}`);
        }
      }
    }
  }
}
ck("all 72 readout+summary states clean", dirty === 0);

const h1 = W.height({ concept: "patients", cox: false });
const h2o = W.height({ concept: "groups", cox: true });
const h2s = W.height({ concept: "groups", cox: false });
ck(`heights are finite and ordered (patients ${h1}, groups ${h2s}/${h2o})`,
  [h1, h2o, h2s].every(Number.isFinite) && h2o > h2s);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
