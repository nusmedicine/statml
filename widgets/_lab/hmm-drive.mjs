/* ============================================================================
   Widget 45 · hmm — drive the widget in node, no browser.

     node widgets/_lab/hmm-drive.mjs

   Stubs defineWidget to capture the config, then asserts the CONTRACT (what
   the widget must HAVE, so a deletion is noticed), the engine across every
   tab and option, the animation reaching its end in both modes, `shown`
   landing where it claims, and a NaN/undefined sweep over every readout tile
   and legend label along the whole rail. `draw` wants a real canvas and is
   not called here; the text sweep and the fingerprint cover it.
   ========================================================================= */

import { readFile } from "node:fs/promises";
import { makeRng } from "../core/rng.js";
import { fmt } from "../core/stats.js";

let src = await readFile(new URL("../hmm/main.js", import.meta.url), "utf8");
src = src.replace(/^import \{ defineWidget, fmt \} from "\.\.\/core\/index\.js";$/m,
  'const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);');
src = src.replace(/^import \* as M from "\.\/model\.js";$/m,
  `import * as M from ${JSON.stringify(new URL("../hmm/model.js", import.meta.url).href)};`);
src += "\nexport { __cfg };\n";
const W = (await import(`data:text/javascript;base64,${Buffer.from(
  src.replace("const __cfg = {};", `const fmt = ${fmt.toString()}; const __cfg = {};`),
).toString("base64")}`)).__cfg;

let pass = 0, fails = 0;
const ck = (name, ok, extra = "") => {
  if (ok) pass += 1; else { fails += 1; console.log(`  FAIL ${name} ${extra}`); }
};

/* 1. The contract — by name. */
for (const key of ["slug", "title", "subtitle", "status", "layout", "height", "params", "legend", "compute", "draw", "readout", "animation"])
  ck(`declares \`${key}\``, W[key] != null);
const WANT = { view: "segmented", days: "int", missing: "int", happy: "choice", K: "choice", every: "choice",
  switches: "int", seed: "int", truth: "bool", rho: "choice", speed: "choice", shown: "int" };
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
const declared = Object.entries(W.params).filter(([, f]) => f.type !== "section").map(([n]) => n).sort().join();
ck("no parameters beyond those", declared === Object.keys(WANT).sort().join(), declared);
ck("truth and speed are display", W.params.truth.display === true && W.params.speed.display === true);
ck("view is a DATA parameter", !W.params.view.display);
ck("the mood controls are gated on view=mood", ["days", "missing", "happy"].every((n) => W.params[n].when?.equals === "mood"));
ck("the genotype controls are gated on view=genotype", ["K", "every", "switches"].every((n) => W.params[n].when?.equals === "genotype"));
ck("step label depends on view", W.animation.stepLabel?.param === "view" && Object.keys(W.animation.stepLabel.labels).sort().join() === "genotype,mood");

/* 2. Defaults, and a walk over every option of every parameter. */
const defaults = Object.fromEntries(Object.entries(W.params).filter(([, f]) => f.type !== "section").map(([n, f]) => [n, f.default]));
const optionsOf = (f) => (f.type === "int" ? [f.min, f.default, f.max] : f.type === "bool" ? [false, true] : f.options.map((o) => o.value));
const bad = (s) => /NaN|undefined|null|Infinity/.test(String(s));

function run(params, mode = "run", dt = 16) {
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = mode;
  let guard = 0;
  if (mode === "step") {
    while (!anim.done && guard < 5000) { while (W.animation.advance(anim, { dt, params, state }) && guard < 5000) guard += 1; guard += 1; }
  } else {
    while (W.animation.advance(anim, { dt, params, state }) && guard < 20000) guard += 1;
  }
  return { state, anim, guard };
}

let combos = 0;
for (const [name, f] of Object.entries(W.params)) {
  if (f.type === "section" || name === "shown") continue;
  for (const v of optionsOf(f)) {
    for (const view of ["mood", "genotype"]) {
      const params = { ...defaults, view, [name]: v };
      if (name === "view") params.view = v;
      const { state, anim } = run(params);
      combos += 1;
      ck(`${view} ${name}=${v}: animation ends`, anim.done && anim.idx === state.order.length);
      for (const st of state.stages) for (const g of st.gamma) {
        const s = g.reduce((a, b) => a + b, 0);
        if (Math.abs(s - 1) > 1e-9 || g.some((x) => !Number.isFinite(x))) { ck(`${view} ${name}=${v}: posterior rows sum to 1`, false, String(s)); break; }
      }
      /* Every tile and legend label, at every stage of the rail. */
      for (let idx = 0; idx <= state.order.length; idx += 1) {
        const tiles = W.readout({ params, state, anim: { idx } });
        for (const t of tiles) if (bad(t.label) || bad(t.value) || bad(t.note)) ck(`${view} ${name}=${v} idx ${idx}: tile clean`, false, JSON.stringify(t));
      }
      for (const truth of [false, true]) {
        const leg = W.legend({ params: { ...params, truth } });
        ck(`${view} ${name}=${v} truth=${truth}: legend entries clean`, leg.every((e) => e.token && e.label && !bad(e.label)));
        for (const w of [550, 690, 770]) {
          const h = W.height({ ...params, truth, w });
          ck(`${view} ${name}=${v} w=${w}: height finite`, Number.isFinite(h) && h > 100 && h < 1200, String(h));
        }
      }
    }
  }
}
console.log(`  walked ${combos} parameter settings`);

/* 3. `shown` lands where it claims, and Replay starts over. */
{
  const params = { ...defaults, view: "genotype", shown: 4 };
  const state = W.compute({ params, rng: makeRng(1) });
  const a = W.animation.init({ params, state, fromScratch: false });
  ck("shown=4 opens at stage 4", a.idx === 4 && !a.done);
  const b = W.animation.init({ params, state, fromScratch: true });
  ck("Replay opens at stage 0", b.idx === 0);
  const c = W.animation.init({ params: { ...params, shown: 99 }, state, fromScratch: false });
  ck("shown past the end clamps and is done", c.idx === state.order.length && c.done);
}

/* 4. Step mode: one press is one observation, and the beat clears. */
{
  const params = { ...defaults, view: "mood" };
  const state = W.compute({ params, rng: makeRng(1) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "step";
  let frames = 0;
  while (W.animation.advance(anim, { dt: 50, params, state })) frames += 1;
  ck("one step reveals exactly one observation", anim.idx === 1, String(anim.idx));
  ck("the beat is cleared when the step lands", anim.beatOn === false && anim.beatP === 1);
  ck("a step spans frames", frames >= 10, String(frames));
  const { anim: z } = run(params, "step", 50);
  ck("stepping reaches the end", z.done && z.idx === state.order.length);
}

/* 5. Fast declares no choreography. */
{
  const params = { ...defaults, view: "genotype", speed: "fast" };
  const state = W.compute({ params, rng: makeRng(1) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "run";
  let sawBeat = false;
  while (W.animation.advance(anim, { dt: 16, params, state })) if (anim.beatOn) sawBeat = true;
  ck("fast never sets a beat", !sawBeat);
}

/* 6. Determinism: same params, same numbers. */
{
  const params = { ...defaults, view: "genotype" };
  const a = W.compute({ params, rng: makeRng(7) }), b = W.compute({ params, rng: makeRng(7) });
  ck("compute is deterministic", JSON.stringify(a.stages.at(-1).sites) === JSON.stringify(b.stages.at(-1).sites));
}

console.log(`\n${pass} passed, ${fails} failed`);
if (fails) process.exit(1);
