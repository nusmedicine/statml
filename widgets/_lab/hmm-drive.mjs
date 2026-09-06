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
import { animationUnits } from "../hmm/model.js";

let src = await readFile(new URL("../hmm/main.js", import.meta.url), "utf8");
src = src.replace(/^import \{ defineWidget \} from "\.\.\/core\/index\.js";$/m,
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
const WANT = { view: "segmented", missing: "int", K: "choice", every: "choice",
  seed: "int", truth: "bool", speed: "choice", shown: "int" };
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
const declared = Object.entries(W.params).filter(([, f]) => f.type !== "section").map(([n]) => n).sort().join();
ck("no parameters beyond those", declared === Object.keys(WANT).sort().join(), declared);
ck("truth and speed are display", W.params.truth.display === true && W.params.speed.display === true);
ck("view is a DATA parameter", !W.params.view.display);
ck("the toy control is gated on view=toy", W.params.missing.when?.equals === "toy");
ck("the biological controls are gated on view=biological", ["K", "every"].every((n) => W.params[n].when?.equals === "biological"));
ck("one step label for both tabs", W.animation.stepLabel === "Next column");

/* 2. Defaults, and a walk over every option of every parameter. */
const defaults = Object.fromEntries(Object.entries(W.params).filter(([, f]) => f.type !== "section").map(([n, f]) => [n, f.default]));
const optionsOf = (f) => (f.type === "int" ? [f.min, f.default, f.max] : f.type === "bool" ? [false, true] : f.options.map((o) => o.value));
const bad = (s) => /NaN|undefined|null|Infinity/.test(String(s));

/* The toy's Viterbi path is the one the posterior strip draws — one trellis, drawn twice. */
{
  for (const view of ["toy", "biological"]) {
    const params = { ...defaults, view };
    const state = W.compute({ params, rng: makeRng(3) });
    ck(`${view}: trellis path equals decode()'s path`, state.trellis.path.join() === state.stages.at(-1).path.join());
    ck(`${view}: 2L animation units`, animationUnits(state) === 2 * state.L);
    for (const col of state.trellis.score) ck(`${view}: relative scores sum to 1`, Math.abs(col.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    /* The worked line's recurrence — previous relative scores × transition,
       the largest, × emission, scaled — must land on the nodes exactly. */
    const TR = state.trellis, K = state.K, stay = 1 - state.rho, move = state.rho / (K - 1);
    const last = state.stages.at(-1);
    const emitAt = (i, h) => (last.sites[i].blank ? 1
      : (state.panel.hap[h][i] === state.truthAllele[i] ? 1 - state.eps : state.eps));
    let worst = 0;
    for (let i = 1; i < state.L; i += 1) {
      const prods = [];
      for (let h = 0; h < K; h += 1) {
        let best = -1;
        for (let g = 0; g < K; g += 1) best = Math.max(best, TR.score[i - 1][g] * (g === h ? stay : move));
        prods.push(best * emitAt(i, h));
      }
      const tot = prods.reduce((a, b) => a + b, 0);
      for (let h = 0; h < K; h += 1) worst = Math.max(worst, Math.abs(prods[h] / tot - TR.score[i][h]));
    }
    ck(`${view}: the worked line reproduces every node`, worst < 1e-9, String(worst));
  }
}

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
    for (const view of ["toy", "biological"]) {
      const params = { ...defaults, view, [name]: v };
      if (name === "view") params.view = v;
      const { state, anim } = run(params);
      combos += 1;
      ck(`${view} ${name}=${v}: animation ends`, anim.done && anim.idx === animationUnits(state));
      for (const st of state.stages) for (const g of st.gamma) {
        const s = g.reduce((a, b) => a + b, 0);
        if (Math.abs(s - 1) > 1e-9 || g.some((x) => !Number.isFinite(x))) { ck(`${view} ${name}=${v}: posterior rows sum to 1`, false, String(s)); break; }
      }
      /* Every tile and legend label, at every stage of the rail. */
      for (let idx = 0; idx <= animationUnits(state); idx += 1) {
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

/* 2b. The notebook's own toy, verbatim at the defaults. */
{
  const params = { ...defaults, view: "toy" };
  const state = W.compute({ params, rng: makeRng(1) });
  ck("notebook: P1 is Sad Happy Sad Sad Happy", state.panel.hap[0].join("") === "01001");
  ck("notebook: P2 is Happy Happy Happy Happy Sad", state.panel.hap[1].join("") === "11110");
  ck("notebook: the record is Happy ? ? Happy ?", state.order.join() === "0,3" && state.truthAllele.join("") === "11110");
  ck("notebook: decoded as P2 throughout", state.trellis.path.every((h) => h === 1));
  const filled = [1, 2, 4].map((i) => state.panel.hap[state.trellis.path[i]][i]).join("");
  ck("notebook: the blanks are filled Happy Happy Sad", filled === "110");
  const other = W.compute({ params: { ...params, seed: 2 }, rng: makeRng(2) });
  ck("seed 2 keeps the notebook's patterns", other.panel.hap[0].join("") === "01001" && other.panel.hap[1].join("") === "11110");
  ck("seed 2 changes the record", other.order.join() !== state.order.join() || other.src[0] !== state.src[0]);
  ck("the biological truth has one recombination point", W.compute({ params: { ...defaults, view: "biological" }, rng: makeRng(1) }).cutSites.length === 1);
  ck("the switch rate is fixed at 0.1 on both tabs", state.rho === 0.1 && W.compute({ params: { ...defaults, view: "biological" }, rng: makeRng(1) }).rho === 0.1);
}

/* 3. `shown` lands where it claims, and Replay starts over. */
{
  const params = { ...defaults, view: "biological", shown: 4 };
  const state = W.compute({ params, rng: makeRng(1) });
  const a = W.animation.init({ params, state, fromScratch: false });
  ck("shown=4 opens at stage 4", a.idx === 4 && !a.done);
  const b = W.animation.init({ params, state, fromScratch: true });
  ck("Replay opens at stage 0", b.idx === 0);
  const c = W.animation.init({ params: { ...params, shown: 99 }, state, fromScratch: false });
  ck("shown past the end clamps and is done", c.idx === animationUnits(state) && c.done);
}

/* 4. Step mode: one press is one observation, and the beat clears. */
{
  const params = { ...defaults, view: "toy" };
  const state = W.compute({ params, rng: makeRng(1) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "step";
  let frames = 0;
  while (W.animation.advance(anim, { dt: 50, params, state })) frames += 1;
  ck("one step advances exactly one unit", anim.idx === 1, String(anim.idx));
  ck("the beat is cleared when the step lands", anim.beatOn === false && anim.beatP === 1);
  ck("a step spans frames", frames >= 10, String(frames));
  const { anim: z } = run(params, "step", 50);
  ck("stepping reaches the end", z.done && z.idx === animationUnits(state));
}

/* 5. Fast declares no choreography. */
{
  const params = { ...defaults, view: "biological", speed: "fast" };
  const state = W.compute({ params, rng: makeRng(1) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = "run";
  let sawBeat = false;
  while (W.animation.advance(anim, { dt: 16, params, state })) if (anim.beatOn) sawBeat = true;
  ck("fast never sets a beat", !sawBeat);
}

/* 6. Determinism: same params, same numbers. */
{
  const params = { ...defaults, view: "biological" };
  const a = W.compute({ params, rng: makeRng(7) }), b = W.compute({ params, rng: makeRng(7) });
  ck("compute is deterministic", JSON.stringify(a.stages.at(-1).sites) === JSON.stringify(b.stages.at(-1).sites));
}

console.log(`\n${pass} passed, ${fails} failed`);
if (fails) process.exit(1);
