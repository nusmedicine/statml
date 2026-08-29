/* mixed-drive.mjs — the mixed-model widget's contract, driven in node.
 *
 *   node widgets/_lab/mixed-drive.mjs
 *
 * Stubs the defineWidget import (the HANDOVER recipe), then asserts what the
 * widget must HAVE — capabilities by name, so a rewrite that deletes one is
 * noticed — and drives compute/animation/readout across the corners: both
 * tabs, both views, the syntax intents, and the dial extremes. EDIT THIS
 * FILE; do not regenerate it.
 *
 * Round 3 contract: Step and Play are DECLINED (stepLabel/runLabel null),
 * the repeat-study gate is GONE (Kenneth's call), the Measurements toggle
 * lives on both data tabs, and the Syntax tab builds the formula from
 * intent while the real fitted lines pivot on the easing-request door.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mainPath = join(here, "..", "mixed-model", "main.js");

let src = readFileSync(mainPath, "utf8");
src = src.replace(
  /^import \{ defineWidget, fmt \} from "\.\.\/core\/index\.js";$/m,
  "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);\n"
  + "const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? \"—\" : (+x).toFixed(d));",
);
src += "\nexport { __cfg };\n";
const modUrl = "data:text/javascript;base64," + Buffer.from(
  src.replace(/from "\.\.\/core\//g, `from "${pathToFileURL(join(here, "..", "core")).href.replace(/\\/g, "/")}/`)
     .replace(/from "\.\/model\.js"/g, `from "${pathToFileURL(join(here, "..", "mixed-model", "model.js")).href.replace(/\\/g, "/")}"`),
).toString("base64");
const { __cfg: W } = await import(modUrl);
const { makeRng } = await import(pathToFileURL(join(here, "..", "core", "rng.js")).href);

let pass = 0;
let fail = 0;
const ck = (label, ok) => {
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`FAIL  ${label}`);
  }
};

/* --- capabilities, by name -------------------------------------------------- */
for (const key of ["slug", "title", "status", "subtitle", "layout", "height",
  "params", "legend", "compute", "animation", "draw", "readout"])
  ck(`declares \`${key}\``, W[key] != null);
ck("slug is mixed-model", W.slug === "mixed-model");
const WANT = {
  concept: "segmented", dataV: "section", patients: "choice", visits: "choice",
  differ: "choice", effect: "choice", dataF: "section", famdiff: "choice",
  causal: "int", reading: "section", view: "segmented", model: "section",
  ranef: "segmented", seed: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("tabs are repeated · nested · syntax",
  W.params.concept.options.map((o) => o.value).join() === "repeated,nested,syntax");
ck("view is independent · related",
  W.params.view.options.map((o) => o.value).join() === "independent,related");
ck("view, ranef and concept are display", W.params.view.display === true
  && W.params.ranef.display === true && W.params.concept.display === true);
ck("causal wears bits", W.params.causal.style === "bits" && W.params.causal.bits === 10);
ck("step and run are DECLINED",
  W.animation.stepLabel === null && W.animation.runLabel === null);

const DEF = {};
for (const [n, f] of Object.entries(W.params))
  if (f.type !== "section") DEF[n] = f.default;

const compute = (over = {}) => {
  const params = { ...DEF, ...over };
  return { params, state: W.compute({ params, rng: makeRng(Number(params.seed)) }) };
};
const tilesOf = (params, state, anim) => W.readout({ params, state, anim });
const clean = (tiles) => tiles.every((t) =>
  !/NaN|undefined|null/.test(String(t.value)) && !/NaN|undefined/.test(String(t.note ?? "")));

/* --- the default story ------------------------------------------------------ */
{
  const { params, state } = compute();
  ck("defaults: lm claims the false effect",
    state.lm.ci[3][1] < 0 || state.lm.ci[3][0] > 0);
  ck("defaults: lmer spans zero",
    state.mm.ci[3][0] < 0 && state.mm.ci[3][1] > 0);
  ck("defaults: 500 rows", state.nRows === 500);
  const anim = W.animation.init({ params, state, fromScratch: true });
  ck("opens on independent (mix 0)", anim.mix === 0);
  ck("nothing to drive — figures open finished", anim.done === true);
  ck("readout clean at mix 0", clean(tilesOf(params, state, anim)));
  ck("lmer tile withheld at mix 0",
    tilesOf(params, state, anim)[2].value === "—");
  anim.mix = 1;
  ck("readout clean at mix 1", clean(tilesOf(params, state, anim)));
  ck("lmer tile printed at mix 1",
    tilesOf(params, state, anim)[2].value !== "—");
}

/* --- the ease --------------------------------------------------------------- */
{
  const { params, state } = compute();
  const anim = W.animation.init({ params, state, fromScratch: true });
  W.animation.rebuild(anim, { params: { ...params, view: "related" }, state });
  ck("view flip requests the ease", anim.easing === true && anim.mixT === 1);
  let guard = 0;
  while (W.animation.advance(anim, { dt: 16, state }) && guard < 400) guard += 1;
  ck("ease lands at 1", Math.abs(anim.mix - 1) < 0.01);
  ck("ease clears its request", anim.easing === false);
  ck("ease lands within budget", guard < 200);
}

/* --- the syntax tab --------------------------------------------------------- */
{
  const { params, state } = compute({ concept: "syntax" });
  ck("syntax: 16 points, two groups", state.synPts.length === 16
    && new Set(state.synPts.map((pt) => pt.g)).size === 2);
  const L = state.synLines;
  ck("syntax: None is one shared line",
    L.none[0][0] === L.none[1][0] && L.none[0][1] === L.none[1][1]);
  ck("syntax: Intercept separates levels, shares the trend",
    Math.abs(L.intercept[0][0] - L.intercept[1][0]) > 1
    && L.intercept[0][1] === L.intercept[1][1]);
  ck("syntax: Both separates levels and trends",
    Math.abs(L.slope[0][0] - L.slope[1][0]) > 0.5
    && Math.abs(L.slope[0][1] - L.slope[1][1]) > 0.05);
  const anim = W.animation.init({ params, state, fromScratch: true });
  ck("syntax opens on the pooled line", anim.syn[0][0] === L.none[0][0]);
  for (const r of ["none", "intercept", "slope"]) {
    const pr = { ...params, ranef: r };
    const a2 = W.animation.init({ params: pr, state, fromScratch: true });
    ck(`syntax readout clean at ${r}`, clean(tilesOf(pr, state, a2)));
  }
  /* an intent flip retargets the lines and requests the ease */
  W.animation.rebuild(anim, { params: { ...params, ranef: "slope" }, state });
  ck("intent flip requests the ease", anim.easing === true
    && anim.synT[0][1] === L.slope[0][1]);
  let guard = 0;
  while (W.animation.advance(anim, { dt: 16, state }) && guard < 400) guard += 1;
  ck("lines land on the slope fit",
    Math.abs(anim.syn[1][0] - L.slope[1][0]) < 0.01
    && Math.abs(anim.syn[1][1] - L.slope[1][1]) < 0.01);
}

/* --- the nested tab --------------------------------------------------------- */
{
  const { params, state } = compute({ concept: "nested" });
  const flagged = (key) => state.snps.filter((s) => s[key].sig).map((s) => s.j);
  ck("nested: lmer keeps exactly the causal SNP",
    flagged("mm").join() === "5");
  ck("nested: lm flags the truth plus extras",
    flagged("lm").includes(5) && flagged("lm").length > 1);
  ck("nested: chips mark the truth",
    state.snps.filter((s) => s.causal).map((s) => s.j).join() === "5");
  const anim = W.animation.init({ params, state, fromScratch: true });
  ck("nested readout clean", clean(tilesOf(params, state, anim)));
  /* the reveal mirrors Repeated (round 3): lmer withheld at Independent */
  ck("nested lmer tile withheld at Independent",
    tilesOf(params, state, anim)[1].value === "—");
  anim.mix = 1;
  ck("nested lmer tile printed at Related",
    tilesOf(params, state, anim)[1].value === "SNP 5");
  ck("nested readout clean at Related", clean(tilesOf(params, state, anim)));
  /* the family strip: sorted, complete, spanning the frame, and every dot
     carrying both addresses for the travel ease */
  ck("strip covers every individual",
    state.famStrip.reduce((s, f) => s + f.ys.length, 0) === 1000);
  ck("every dot has both addresses",
    state.famDots.length === 1000
    && state.famDots.every((d) => Number.isFinite(d.y) && d.ii >= 0 && d.fi >= 0));
  ck("strip is sorted by family mean",
    state.famStrip.every((f, i, a) => i === 0 || a[i - 1].mean <= f.mean));
  ck("strip frame holds the data",
    state.cholLo < state.famStrip[0].lo && state.cholHi > state.famStrip.at(-1).hi);
  /* at family differences none the ramp flattens: the spread of family
     means collapses toward the residual scale */
  const { state: flat } = compute({ concept: "nested", famdiff: "none" });
  const spread = (st) => st.famStrip.at(-1).mean - st.famStrip[0].mean;
  ck("famdiff none flattens the ramp", spread(flat) < spread(state) / 3);
}

/* --- corners ---------------------------------------------------------------- */
for (const over of [
  { visits: "1" },
  { visits: "20", patients: "25" },
  { differ: "none" },
  { effect: "large" },
  { concept: "nested", famdiff: "none" },
  { concept: "nested", causal: 0 },
  { concept: "nested", causal: 1023 },
  { patients: "200", visits: "20" },
  { concept: "syntax", ranef: "intercept", seed: 23 },
  { concept: "syntax", ranef: "slope", seed: 44 },
]) {
  const label = JSON.stringify(over);
  try {
    const { params, state } = compute(over);
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.mix = params.view === "related" ? 1 : 0;
    ck(`corner ${label} readout clean`, clean(tilesOf(params, state, anim)));
    const h = W.height({ ...DEF, ...over, w: 900 });
    ck(`corner ${label} height finite`, Number.isFinite(h) && h > 200 && h < 900);
  } catch (e) {
    ck(`corner ${label} throws: ${e.message}`, false);
  }
}

/* at differ none the two fits agree — the mixed model costs nothing when
   rows carry no patient signal */
{
  const { state } = compute({ differ: "none" });
  const gap = Math.abs(
    (state.lm.ci[3][1] - state.lm.ci[3][0]) - (state.mm.ci[3][1] - state.mm.ci[3][0]),
  );
  ck("differ none: interval widths within 20%",
    gap < 0.2 * (state.lm.ci[3][1] - state.lm.ci[3][0]));
}

/* the tally's fast fits reach the full fits' decisions — re-pinned here so a
   later fast-mode tweak cannot silently change what the tally counts */
{
  const { fitLM, fitLMM, simulateBP, designBP } = await import(
    pathToFileURL(join(here, "..", "mixed-model", "model.js")).href
  );
  const rngA = makeRng(5007);
  const rngB = makeRng(5007);
  let theta = null;
  let flips = 0;
  for (let s = 0; s < 40; s += 1) {
    const dA = simulateBP(rngA, {});
    const dB = simulateBP(rngB, {});
    const XA = designBP(dA);
    const slow = fitLMM(dA.bp, XA, dA.patientId, dA.time);
    const fast = fitLMM(dB.bp, designBP(dB), dB.patientId, dB.time, { start: theta, fast: true });
    theta = fast.theta;
    const c = (f) => f.ci[3][1] < 0 || f.ci[3][0] > 0;
    if (c(slow) !== c(fast)) flips += 1;
  }
  ck("fast tally decisions match full fits (40 studies)", flips === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
