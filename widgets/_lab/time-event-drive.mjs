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
import { simulate } from "../time-event/model.js";

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
src += "\nexport { __cfg, bridgeHTML, MATHML };\n";
const { __cfg: W, bridgeHTML, MATHML } = await import(
  `data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`
);

let fails = 0;
const ck = (name, ok) => {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}`);
};
const fmtP = (p) => (p < 1e-4 ? "<1e-4" : p.toFixed(3));

console.log("== capabilities, by name ==");
for (const key of ["slug", "title", "status", "subtitle", "layout", "height",
  "params", "legend", "compute", "animation", "draw", "readout", "summary"]) {
  ck(`declares \`${key}\``, W[key] != null);
}
/* onset and truth left this list in round 12 (Early baked in; the truth
   overlay cut as notebook-absent) — their absence is asserted by the
   no-parameters-beyond-those check below */
const WANT = {
  concept: "segmented", people: "section", patients: "int", cens: "int",
  reading: "section", censored: "segmented",
  data: "section", n: "choice", effect: "choice", causal: "int", follow: "choice",
  curves: "section", bands: "bool", shared: "bool",
  model: "section", disease: "bool", age: "bool", snps: "bool",
  speed: "choice", seed: "int", shown: "int",
};
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
  Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
ck("three concepts, the round-14 gerunds, values unchanged",
  W.params.concept.options.map((o) => o.label).join("|") === "Censoring|Comparing|Modeling"
  && W.params.concept.options.map((o) => o.value).join("|") === "censoring|groups|factors");
ck("the pills are pills",
  ["disease", "age", "snps"].every((k) => W.params[k].style === "pill"));
ck("censored / bands / shared / pills / concept are display",
  ["censored", "bands", "shared", "disease", "age", "snps", "concept"]
    .every((k) => W.params[k].display === true));
ck("the censored control offers exactly kept and dropped (round 12)",
  W.params.censored.options.map((o) => o.value).join() === "kept,dropped");
ck("each tab's rail section is gated on its concept",
  W.params.reading.when?.equals === "censoring"
  && W.params.curves.when?.equals === "groups"
  && W.params.model.when?.equals === "factors");
ck("no gate anywhere (a gate hides the drive row this widget needs)",
  !Object.values(W.params).some((f) => f.type === "gate"));
ck("shown is hidden; seed is the visible Draw control",
  W.params.shown.hidden && !W.params.seed.hidden && W.params.seed.label === "Draw");
ck("default draw is 32 (the measured clean cohort at the round-10 defaults)",
  W.params.seed.default === 32);
ck("the shared data controls show on both cohort tabs (oneOf)",
  ["data", "n", "effect", "follow", "seed"].every(
    (k) => W.params[k].when?.oneOf?.join() === "groups,factors"));
ck("the data controls are DATA parameters (moving one restarts the sweep)",
  ["n", "effect", "causal", "follow", "seed", "cens", "patients"].every((k) => !W.params[k].display));
ck("defaults: 200 patients, moderate effect, SNPs 1-3 causal (mask 7), 12-year follow-up, B and E censored (mask 18)",
  W.params.n.default === "200" && W.params.effect.default === "moderate"
  && W.params.causal.default === 7
  && W.params.follow.default === "12" && W.params.cens.default === 18);
ck("the censored picker is chips whose count follows Patients (round 16)",
  W.params.cens.style === "bits" && W.params.cens.bitsFrom === "patients"
  && W.params.cens.bitLabels.join("") === "ABCDEFGHIJ"
  && W.params.cens.when?.equals === "censoring");
ck("the follow ladder is 5/9/12/25 (round 13 — a too-short study must fail)",
  W.params.follow.options.map((o) => o.value).join() === "5,9,12,25");
ck("Causal SNPs is ten chips on the Modeling tab only (round 14)",
  W.params.causal.style === "bits" && W.params.causal.bits === 10
  && W.params.causal.min === 0 && W.params.causal.max === 1023
  && W.params.causal.when?.equals === "factors");
ck("the disease pill starts pressed (round 13)", W.params.disease.default === true);
ck("Play speed shows only where a clock exists (round 15)",
  W.params.speed.when?.oneOf?.join() === "censoring,groups");

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
/* the null, drawn: the pooled curve must sit between the group curves
   where they have separated */
{
  const at = (steps, q) => { let S = 1; for (const s of steps) { if (s.t <= q) S = s.S; else break; } return S; };
  const s0 = at(state.groups[0].kept.steps, 8);
  const s1 = at(state.groups[1].kept.steps, 8);
  const sp = at(state.pooled.steps, 8);
  ck(`pooled curve between the groups at t=8 (${s1.toFixed(2)} < ${sp.toFixed(2)} < ${s0.toFixed(2)})`,
    sp > Math.min(s0, s1) && sp < Math.max(s0, s1));
}
{
  const tiles = W.readout({ params: { ...values, concept: "groups" }, state, anim: { t: 22 } });
  const note = tiles.find((x) => x.label === "Log-rank p").note;
  ck("the p tile's note carries the live observed and expected counts",
    note.includes(String(state.lr.obs[1])) && note.includes(String(Math.round(state.lr.exp[1]))));
}

console.log("\n== the play surface, at its corners ==");
{
  /* the picker teaches WHERE a censoring falls (round 16): swap B's
     censoring (t=10, after everything) for C's (t=6, mid-events) and
     the denominators past 6 shift — S(8) moves 0.30 → 0.40 */
  const sC = W.compute({ params: { ...values, cens: 0b10100 }, rng: makeRng(values.seed) });
  const at8 = (st) => { let S = 1; for (const s of st.steps) { if (s.t <= 8) S = s.S; else break; } return S; };
  ck("censoring C instead of B moves the later denominators (S(8): 0.30 → 0.40)",
    Math.abs(at8(state.five.kept) - 0.3) < 1e-12 && Math.abs(at8(sC.five.kept) - 0.4) < 1e-12);
  /* effect: none — the groups genuinely share a curve on this draw */
  const sNone = W.compute({ params: { ...values, effect: "none" }, rng: makeRng(values.seed) });
  ck(`effect none: log-rank does not fire (p = ${fmtP(sNone.lr.p)})`, sNone.lr.p > 0.01);
  /* a small study computes end to end, including all seven fits */
  const s30 = W.compute({ params: { ...values, n: "30" }, rng: makeRng(values.seed) });
  ck("n = 30: the two groups sum to 30", s30.groups[0].n + s30.groups[1].n === 30);
  ck("n = 30: readout and summary stay clean",
    !/NaN|undefined|Infinity/.test(
      W.readout({ params: { ...values, n: "30", concept: "groups" }, state: s30, anim: { t: 22 } })
        .map((x) => `${x.label} ${x.value} ${x.note}`).join(" ")
      + W.summary({ params: { ...values, n: "30", concept: "groups" }, state: s30, anim: { t: 22 } })));
  /* the follow lever spans the censoring story (round 12: Early is baked
     in, so follow is the one lever left on the doors): at the default 12
     censoring is visible; at 25 it dissolves entirely */
  ck(`follow 12 (default): censoring visible (${state.events} events of 200)`,
    state.events < 200);
  const s25 = W.compute({ params: { ...values, follow: "25" }, rng: makeRng(values.seed) });
  ck(`follow 25: censoring dissolves (${s25.events} events of 200)`, s25.events === 200);
  /* the round-13 corners: a 5-year study fails, honestly and cleanly */
  const s5 = W.compute({ params: { ...values, follow: "5" }, rng: makeRng(values.seed) });
  ck(`follow 5: almost no events (${s5.events} of 200), no time below 0.5`,
    s5.events < 15
    && Math.min(...s5.groups[0].times, ...s5.groups[1].times) >= 0.5);
  ck("follow 5: readout and summary stay clean on every tab",
    ["censoring", "groups", "factors"].every((concept) =>
      !/NaN|undefined|Infinity/.test(
        W.readout({ params: { ...values, follow: "5", concept }, state: s5, anim: { t: 16 } })
          .map((x) => `${x.label} ${x.value} ${x.note}`).join(" ")
        + W.summary({ params: { ...values, follow: "5", concept }, state: s5, anim: { t: 16 } }))));
  /* the causal mask: 7 (SNPs 1-3) IS the notebook's truth and the default */
  ck("the default mask and an explicit 7 are one generator (seed 7)",
    JSON.stringify(simulate(makeRng(7), { n: 50, effect: 2.5, follow: 12, shift: 6 }))
      === JSON.stringify(simulate(makeRng(7), { n: 50, effect: 2.5, follow: 12, shift: 6, causal: 7 })));
  ck("the mask picks WHICH SNPs: masks 7 and 56 differ; 0 and 1023 differ (seed 7)",
    JSON.stringify(simulate(makeRng(7), { n: 50, causal: 7 }).time)
      !== JSON.stringify(simulate(makeRng(7), { n: 50, causal: 56 }).time)
    && JSON.stringify(simulate(makeRng(7), { n: 50, causal: 0 }).time)
      !== JSON.stringify(simulate(makeRng(7), { n: 50, causal: 1023 }).time));
  const s0k = W.compute({ params: { ...values, causal: 0 }, rng: makeRng(values.seed) });
  ck("no causal SNPs and the default draw different cohorts from one seed",
    s0k.events !== state.events || JSON.stringify(s0k.groups[0].times) !== JSON.stringify(state.groups[0].times));
  {
    const tiles = W.readout({
      params: { ...values, causal: 0, concept: "factors", snps: true },
      state: s0k, anim: { t: 16 },
    });
    ck("no causal SNPs + SNPs in: the Significant tile names the false-positive risk",
      tiles.find((x) => x.label === "Significant").note.includes("false positive"));
    const tiles3 = W.readout({
      params: { ...values, concept: "factors", snps: true },
      state, anim: { t: 16 },
    });
    ck("...and at the default mask it does not",
      !tiles3.find((x) => x.label === "Significant").note.includes("false positive"));
  }
  const s5k = W.compute({ params: { ...values, causal: 0b11111 }, rng: makeRng(values.seed) });
  ck("five causal SNPs compute end to end, all seven fits converged",
    ["d", "a", "s", "da", "ds", "as", "das"].every((k) => s5k.fits[k]?.converged));
  /* the patient table (round 9): defaults ARE the notebook; the controls
     extend and flip deterministically */
  ck("defaults reproduce the notebook's table exactly",
    state.fiveT.join() === "5,10,6,8,7" && state.fiveS.join() === "1,0,1,1,0"
    && state.censPhrase === "B and E");
  const s10 = W.compute({ params: { ...values, patients: 10, cens: 0b1110010 }, rng: makeRng(values.seed) });
  ck("ten patients, picks B, E, F, G: the phrase computes from the mask",
    s10.fiveT.length === 10 && s10.nCens === 4 && s10.censPhrase === "B, E, F and G");
  ck("the tied event at t = 6 exists at n = 10 (C and J)",
    s10.five.kept.steps.some((st) => st.t === 6 && st.events === 2));
  const s0c = W.compute({ params: { ...values, cens: 0 }, rng: makeRng(values.seed) });
  ck("zero censored: the two readings are one curve",
    JSON.stringify(s0c.five.kept.steps) === JSON.stringify(s0c.five.dropped.steps));
  /* round 16's new corners: any patient is pressable, high bits beyond
     the roster are ignored, and a fully censored study stays honest */
  const sA = W.compute({ params: { ...values, cens: 1 }, rng: makeRng(values.seed) });
  ck("A is pressable now (the old clamp was a flip-order artefact)",
    sA.censPhrase === "A" && sA.fiveS[0] === 0);
  const sHi = W.compute({ params: { ...values, cens: 512 + 18 }, rng: makeRng(values.seed) });
  ck("a pick beyond the roster is remembered, not applied (J's bit at 5 patients)",
    sHi.nCens === 2 && sHi.censPhrase === "B and E");
  const sAll = W.compute({ params: { ...values, cens: 31 }, rng: makeRng(values.seed) });
  ck("all five censored: zero events, the kept curve holds at 1",
    sAll.fiveS.every((s) => s === 0)
    && sAll.five.kept.steps.every((st) => st.events === 0 && st.S === 1));
  {
    const tiles = W.readout({ params: { ...values, cens: 31, censored: "dropped" }, state: sAll, anim: { t: 10 } });
    ck("...and the dropped reading of nobody says — , not a number",
      tiles.find((x) => x.label === "Survival").value === "—");
    ck("...readout and summary stay clean at the corner",
      !/NaN|undefined|Infinity/.test(
        tiles.map((x) => `${x.label} ${x.value} ${x.note}`).join(" ")
        + W.summary({ params: { ...values, cens: 31, censored: "dropped" }, state: sAll, anim: { t: 10 } })));
  }
  ck("heights grow with the lanes",
    W.height({ concept: "censoring", patients: 10 }) - W.height({ concept: "censoring", patients: 5 })
      === 5 * 26);
}
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
  /* disease defaults ON since round 13, so the empty forest needs it
     explicitly off */
  const a = W.animation.init({ params: { ...values, concept: "factors", disease: false }, state, fromScratch: true });
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

console.log("\n== the pointer channel (round 11) ==");
{
  ck("declares pointer: true (the hover inspector's repaints)", W.pointer === true);
  ck("declares animation.scrub and scrubHit",
    typeof W.animation.scrub === "function" && typeof W.animation.scrubHit === "function");
  const sc = W.animation.init({ params: { ...values }, state, fromScratch: true });
  sc.mode = "step";
  W.animation.advance(sc, { dt: 16, params: { ...values }, state }); // a tween in flight
  const hadTween = sc.stepTarget !== undefined;
  W.animation.scrub(sc, { x: 56 + (900 - 70) / 2, y: 100, w: 900, params: { ...values }, state });
  ck("scrub sets the clock mid-axis and cancels the step tween",
    hadTween && sc.stepTarget === undefined && sc.t > 0 && sc.t < state.tEnd.censoring);
  W.animation.scrub(sc, { x: 5000, y: 100, w: 900, params: { ...values }, state });
  ck("scrub clamps to the sweep's end and reads done", sc.t === state.tEnd.censoring && sc.done === true);
  W.animation.scrub(sc, { x: -5000, y: 100, w: 900, params: { ...values }, state });
  ck("...and to zero", sc.t === 0 && sc.done === false);
  const pf = { ...values, concept: "factors" };
  ck("Modeling never scrubs — its curves are complete (round 14)",
    W.animation.scrubHit({ x: 300, y: 80, w: 900, params: pf }) === false
    && W.animation.scrubHit({ x: 300, y: 400, w: 900, params: pf }) === false);
  ck("the other tabs scrub anywhere on their stages",
    W.animation.scrubHit({ x: 300, y: 500, w: 900, params: { ...values } }) === true);
  /* the clock leaves the Modeling tab (round 14): anim.inert is core's
     widget-18 door, and it must open again on the way back */
  const ia = W.animation.init({ params: pf, state, fromScratch: true });
  ck("Modeling opens inert — Play and Step leave the row", ia.inert === true);
  W.animation.rebuild(ia, { params: { ...values, concept: "groups" }, state });
  ck("...and the clock returns on the cohort tab", ia.inert === false);
  const ic = W.animation.init({ params: { ...values }, state, fromScratch: true });
  ck("Censoring opens with the clock live", ic.inert === false);
}

console.log("\n== the ln(h/h0) bridge row (round 12, pick M1) ==");
{
  /* node has no window, so MATHML is false and bridgeHTML returns the
     plain-text fallback — which is exactly the b-index logic to pin. The
     MathML branch is the same indices in markup, judged in the browser. */
  ck("no window here, so the fallback branch is under test", MATHML === false);
  const at = (pills) => bridgeHTML({ concept: "factors", ...pills });
  ck("resting (no pills): the notebook's symbols",
    at({}) === "ln( h(t) ÷ h₀(t) ) = b₁x₁ + b₂x₂ + …");
  ck("disease alone: b₁·disease",
    at({ disease: true }) === "ln( h(t) ÷ h₀(t) ) = b₁·disease");
  ck("disease + age: the indices follow the model's order",
    at({ disease: true, age: true }) === "ln( h(t) ÷ h₀(t) ) = b₁·disease + b₂·age");
  ck("all pills: the SNPs collapse as b₃·SNP_1 + … + b₁₂·SNP_10",
    at({ disease: true, age: true, snps: true })
      === "ln( h(t) ÷ h₀(t) ) = b₁·disease + b₂·age + b₃·SNP_1 + … + b₁₂·SNP_10");
  ck("SNPs alone: the indices start at 1",
    at({ snps: true }) === "ln( h(t) ÷ h₀(t) ) = b₁·SNP_1 + … + b₁₀·SNP_10");
  /* the dbscan lesson: testing a function is not testing the caller */
  ck("draw() actually calls renderBridge", /renderBridge\(params\);/.test(src));
}

console.log("\n== the vocabulary closes (round 12) ==");
{
  const tiles = W.readout({ params: { ...values, concept: "groups" }, state, anim: { t: 22 } });
  const note = tiles.find((x) => x.label === "Hazard ratio").note;
  ck("the HR tile says hazard, not event rate",
    note.includes("hazard multiplied") && !note.includes("event rate"));
  ck("the summary says hazard too",
    W.summary({ params: { ...values, concept: "groups" }, state, anim: { t: 22 } })
      .includes("scaling the hazard"));
}

console.log("\n== readout and summary: no NaN, no undefined, anywhere ==");
let dirty = 0;
let states = 0;
const PILLS = [
  {}, { disease: false }, { disease: false, age: true }, { snps: true },
  { disease: true, age: true, snps: true },
];
for (const concept of ["censoring", "groups", "factors"]) {
  for (const censored of concept === "censoring" ? ["kept", "dropped"] : ["kept"]) {
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

const h1 = W.height({ concept: "censoring", patients: 5 });
const h2 = W.height({ concept: "groups" });
const h3off = W.height({ concept: "factors", snps: false });
const h3on = W.height({ concept: "factors", snps: true });
ck(`heights finite; SNPs grow the factors tab (${h1}, ${h2}, ${h3off} → ${h3on})`,
  [h1, h2, h3off, h3on].every(Number.isFinite) && h3on > h3off);

console.log(fails ? `\n${fails} FAILURES` : "\nall checks pass");
process.exit(fails ? 1 : 0);
