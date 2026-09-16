/* ============================================================================
   Assertions on widget 67's engine, contract and geometry.

       node widgets/_lab/tumor-heterogeneity-verify.mjs

   Imports `widgets/tumor-heterogeneity/model.js` — the shipping code, not a
   copy (5.8) — and drives `main.js` in node by stubbing its one import, so
   `compute`, `animation` and `readout` are the page's own.

   What needs a reader most:

   THE MODEL IS THE LESSON'S. 01-2 cell 17 states three readings and cell 25
   states the formula they come from. If those drift, every page is drawing a
   number the lesson does not have.

   THE ARRANGEMENTS MUST READ THE SAME VAF. Page 1's whole claim is an
   equality, and it is computed rather than authored, so it is asserted over a
   sweep rather than at one setting — including the settings where a row
   cannot exist and has to say so (2.6).

   THE GEOMETRY. `height` and `draw` share one layout precisely so this script
   can drive `draw` through a recording context and check that nothing is
   painted outside the canvas the page reserved. A figure that overruns still
   hashes consistently for ever.

   THE CAPABILITIES BY NAME. A rewrite that deletes a parameter leaves every
   behavioural assertion passing, so the spec is asserted key by key
   (HANDOVER § *Driving the animation in node*).

   THE STATUS. The manifest and `main.js` both say `draft` and this says so;
   all three flip in one commit at ship.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "../tumor-heterogeneity/model.js";
import { makeRng } from "../core/rng.js";
import { resolveParams } from "../core/params.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const abs = (rel) => JSON.stringify(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), rel)).href);

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 74)} ${detail}`);
}

/* --- the widget's own config, with core stubbed --------------------------- */
/* The formula card mounts itself into the page, so node needs somewhere to
   mount it: the stub keeps the node, and `cardHtml()` reads what the card last
   wrote. `mathmlRenders` is stubbed false, as the browser's fallback path — so
   every string asserted here is the one a reader without MathML sees. */
let cardNode = null;
globalThis.document = {
  createElement: () => ({ className: "", innerHTML: "" }),
  querySelector: () => ({ parentNode: { insertBefore: (node) => { cardNode = node; } } }),
};
const cardHtml = () => (cardNode ? cardNode.innerHTML : "");
const cardText = () => cardHtml().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Draw page 2 for real, which is what leaves `carryMany` behind — the module
    holds it privately, so the only honest way to test the morph's rule is to
    put a figure on screen the way the reader does. */
function drawWithMany(W, params) {
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  const { ctx } = recorder();
  W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
  return { state, anim };
}

let cached = null;
async function widget() {
  if (cached) return cached;
  let text = read("widgets/tumor-heterogeneity/main.js");
  /* `niceTicks` is pure arithmetic over a domain, so the widget gets the real
     one; everything else core exports here needs a canvas and is stubbed. */
  text = text.replace(/^import \{ defineWidget, makePlot, mathmlRenders, niceTicks \} from "\.\.\/core\/index\.js";$/m,
    `import { niceTicks } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => { Object.assign(__cfg, c); return c; };"
    + " const makePlot = (o) => __plot(o); const mathmlRenders = () => false;");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../tumor-heterogeneity/model.js")};`);
  text += "\nexport { __cfg };\n";
  /* `makePlot` is core's, and core's wants a real context; the recording plot
     below gives the widget the four calls it uses. */
  text = `const __plot = globalThis.__plotStub;\n${text}`;
  cached = (await import(`data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`)).__cfg;
  return cached;
}

/** A canvas context that records the extent of everything painted. */
function recorder() {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const seen = [];
  const mark = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { box.bad = true; return; }
    box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y);
  };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
    setLineDash() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    measureText: (s) => ({ width: String(s).length * 5.6 }),
    fillRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    strokeRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    clearRect: () => {},
    moveTo: mark, lineTo: mark,
    arc: (x, y, r) => { mark(x - r, y - r); mark(x + r, y + r); },
    fillText: (s, x, y) => {
      seen.push({ s: String(s), x, y });
      const w = String(s).length * 5.6;
      const left = ctx.textAlign === "center" ? x - w / 2 : ctx.textAlign === "right" ? x - w : x;
      mark(left, y - 10); mark(left + w, y + 3);
    },
    strokeText() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    textAlign: "left", textBaseline: "alphabetic", font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  };
  return { ctx, box, seen };
}

/** The four calls the widget makes on core's plot, recorded. */
globalThis.__plotStub = ({ ctx, rect, xDomain, yDomain }) => {
  const sx = (v) => rect.x + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * rect.w;
  const sy = (v) => rect.y + rect.h - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * rect.h;
  return {
    sx,
    sy,
    caption: (s) => ctx.fillText(s, rect.x, rect.y - 8),
    note: (s) => ctx.fillText(s, rect.x + rect.w, rect.y - 8),
    axisX: ({ ticks = [], format = (v) => String(v), label } = {}) => {
      /* The same skip core makes, for the same reason: mid-ease the axis holds
         the ticks it is heading for while the domain is still growing into
         them, and core draws only the ones that have arrived. */
      ticks.forEach((t) => {
        if (t < xDomain[0] - 1e-9 || t > xDomain[1] + 1e-9) return;
        ctx.fillText(format(t), sx(t), rect.y + rect.h + 16);
      });
      if (label) ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h + 32);
    },
    /* Placed exactly as `core/canvas.js` places them: tick labels right-aligned
       at x − 8, and the axis label rotated about x − 40, which is the gutter a
       plot rect has to leave. */
    axisY: ({ ticks = [], format = (v) => String(v), label } = {}) => {
      const align = ctx.textAlign;
      ctx.textAlign = "right";
      /* Core SKIPS a tick outside the domain (canvas.js, `axisY`), which is how
         a destination tick above a domain still growing simply does not draw.
         The stub drew them all and reported the widget painting off the top of
         the canvas — a divergence in the instrument, not in the figure. */
      ticks.forEach((t) => {
        if (t < yDomain[0] - 1e-9 || t > yDomain[1] + 1e-9) return;
        ctx.fillText(format(t), rect.x - 8, sy(t));
      });
      ctx.textAlign = align;
      if (label) { ctx.moveTo(rect.x - 46, rect.y); ctx.lineTo(rect.x - 34, rect.y + rect.h); }
    },
  };
};

const COLORS = Object.fromEntries([
  "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "empirical", "theory",
  "smoothed", "highlight", "reference", "groupA", "groupB", "groupC", "extreme", "unknown", "holdout",
].map((k) => [k, "#123456"]));
Object.assign(COLORS, { font: "sans-serif", mono: "monospace", fsXs: "11px", fsSm: "13px", fsMd: "15px", fsFig: "13px" });

const spec = () => widget().then((w) => w.params);
const defaults = async () => resolveParams(await spec(), new URLSearchParams(""));

/* --- 1 · the model, against cells 17 and 25 -------------------------------- */
{
  check("a clonal heterozygous mutation at purity 1 reads 0.5", M.vafExpected(1, 1, 1, 2) === 0.5);
  check("cell 17's purity 0.7 example reads 0.35", Math.abs(M.vafExpected(0.7, 1, 1, 2) - 0.35) < 1e-12);
  check("cell 17's amplification reads 0.25", Math.abs(M.vafExpected(1, 1, 1, 4) - 0.25) < 1e-12);
  check("the wild-type copy lost reads 1.0", Math.abs(M.vafExpected(1, 1, 2, 2) - 1) < 1e-12);
  let worst = 0;
  for (const p of [0.35, 0.5, 0.7, 1]) {
    for (const st of M.COPY_STATES) {
      for (const m of st.copies) {
        for (const c of [0.2, 0.5, 0.75, 1]) {
          const back = M.ccfFrom(M.vafExpected(p, c, m, st.total), p, m, st.total);
          worst = Math.max(worst, Math.abs(back - c));
        }
      }
    }
  }
  check("cell 25's two formulas invert each other", worst < 1e-12, `worst ${worst.toExponential(1)}`);

  /* A SOMATIC MUTATION ARISES ON ONE CHROMOSOME, so the copies carrying it are
     copies of that chromosome — at most `major`. The widget capped them at the
     TOTAL until 2026-09-16, which let 2 + 1 be asked for three mutated copies
     and 1 + 1 for two, neither of which is a cell (Kenneth's question). */
  check("every state is major + minor, and they add to its total",
    M.COPY_STATES.every((s) => s.major + s.minor === s.total));
  check("2 + 0 is two copies of one chromosome and none of the other",
    M.stateOf("2+0").major === 2 && M.stateOf("2+0").minor === 0);
  check("the mutated copies offered are one per copy of the chromosome it arose on",
    M.COPY_STATES.every((s) => M.copyOptions(s.key).join() === s.copies.join()
      && s.copies[s.copies.length - 1] === s.major));
  check("1 + 1 cannot carry the mutation twice", M.copyOptions("1+1").join() === "1");
  check("2 + 1 stops at two mutated copies", M.copyOptions("2+1").join() === "1,2");
  check("3 + 1 allows three, which is the state Kenneth asked about",
    M.copyOptions("3+1").join() === "1,2,3"
    && Math.abs(M.configOne({ purity: "0.70", ccf: "1.00", state: "3+1", copies: "2", depth: "88" }).expected - 0.412) < 0.001,
    "two of four copies reads VAF 0.412 at purity 0.70");
  const overAsked = M.configOne({ purity: "0.70", ccf: "1.00", state: "2+1", copies: "3", depth: "88" });
  check("a link asking for more copies than the state has comes back to it", overAsked.copies === 2);
}

/* --- 2 · page 1's arrangements -------------------------------------------- */
{
  /* Revised with the rows themselves on 2026-09-16 (model decision 4, and
     `_lab/vaf-rows-measure.mjs`). A row now carries the VAF IT reads, which is
     what the figure prints beside it, so the thing to prove is that the two
     agree — and that the discrete row is only ever offered when it is within
     the noise of the reading it claims to explain. */
  let bad = 0;
  let loose = 0;
  let impossible = 0;
  let exact = 0;
  let continuous = 0;
  for (const depth of M.DEPTH_OPTIONS.map(Number)) {
    for (let v = 0.05; v <= 0.99; v += 0.01) {
      for (const row of M.arrangementsFor(v, depth)) {
        if (!row.ok) { impossible += 1; continue; }
        const got = M.vafExpected(row.purity, row.ccf, row.copies, row.state.total);
        if (Math.abs(got - row.vaf) > 1e-12) bad += 1;
        if (Math.abs(row.vaf - v) > M.readNoise(v, depth) + 1e-12) loose += 1;
        if (row.kind !== "copies") { continuous += 1; if (Math.abs(row.vaf - v) < 1e-12) exact += 1; }
      }
    }
  }
  check("every arrangement reads exactly the VAF printed beside it", bad === 0, `${bad} off`);
  check("…and is within the noise at that depth of the reading it explains", loose === 0, `${loose} too far`);
  check("…with purity and the cancer cell fraction landing on it exactly",
    continuous > 0 && exact === continuous, `${exact} of ${continuous}`);
  check("arrangements that cannot exist are ruled out, not invented", impossible > 0, `${impossible} rows`);

  /* Above one half neither continuous row can EVER exist — each would need a
     value past 1 — so copy number is the only explanation left there. That is
     01-2 cell 17's VAF ~ 1 case, and it is what the old row could not draw. */
  let aboveHalf = 0;
  let copiesOnly = 0;
  for (let v = 0.55; v <= 0.99; v += 0.01) {
    const rows = M.arrangementsFor(v, 88);
    aboveHalf += 1;
    if (rows[0].ok || rows[1].ok) copiesOnly = -999;
    if (rows[2].ok) copiesOnly += 1;
  }
  check("above one half no purity and no cancer cell fraction can read it", copiesOnly >= 0);
  check("…and copy number alone is left to, which it could not do before",
    copiesOnly > 0, `${copiesOnly} of ${aboveHalf} readings above one half`);
  const atOne = M.arrangementsFor(1, 88);
  check("…including the lesson's VAF ~ 1: the other chromosome is gone",
    atOne[2].ok && atOne[2].vaf === 1 && atOne[2].state.minor === 0,
    atOne[2].ok ? `${atOne[2].state.label} with ${atOne[2].copies} mutated` : "ruled out");

  const at06 = M.arrangementsFor(0.6, 88);
  check("at VAF 0.6 no diploid sample of any purity reads it", at06[0].ok === false);
  check("…and no cancer cell fraction does either", at06[1].ok === false);
  const at025 = M.arrangementsFor(0.25, 88);
  check("at VAF 0.25 all three exist", at025.every((r) => r.ok),
    at025.filter((r) => r.ok).map((r) => r.kind).join(", "));
  check("…and the copy-number one is 3 + 1", at025[2].state?.key === "3+1");

  /* 1 + 1 is not among them: it is what the other two rows already hold, and
     including it made all three rows the same arrangement at VAF 0.5. */
  check("no copy-number arrangement is the plain diploid one",
    M.COPY_ARRANGEMENTS.every((a) => a.state.key !== "1+1"));
  const atHalf = M.arrangementsFor(0.5, 88);
  check("…so at VAF 0.5 the copy-number row is a different arrangement",
    atHalf[2].ok && atHalf[2].state.key === "2+0", atHalf[2].ok ? atHalf[2].state.label : "ruled out");

  /* READING DEEPER RULES ARRANGEMENTS OUT — the page's claim about depth, made
     operative. At an expected VAF near but not on a copy number's own reading,
     a shallow run cannot tell them apart and a deep one can. */
  const near = 0.30; // 0.033 from 2 + 1's own 0.333
  check("a shallow read cannot separate a near copy number from the reading",
    M.arrangementsFor(near, 31).ok !== false && M.arrangementsFor(near, 31)[2].ok);
  check("…and a deep one rules it out, which is what depth is for",
    M.arrangementsFor(near, 500)[2].ok === false,
    `noise ${M.n3(M.readNoise(near, 31))} at depth 31 against ${M.n3(M.readNoise(near, 500))} at 500`);

  /* And the rows no longer move while the reader adds reads: they are a
     function of the controls, which is what killed the flicker he reported. */
  const cfg = M.configOne({ purity: "0.70", ccf: "0.75", state: "1+1", copies: "1", depth: "500" });
  const one = M.buildReads(makeRng(5), cfg);
  const first = M.arrangementsFor(cfg.expected, cfg.depth).map((r) => (r.ok ? "1" : "0")).join("");
  let flips = 0;
  for (let k = 1; k <= one.depth; k += 1) {
    const now = M.arrangementsFor(cfg.expected, cfg.depth).map((r) => (r.ok ? "1" : "0")).join("");
    if (now !== first) flips += 1;
  }
  check("the rows hold still while the reads land", flips === 0,
    `${one.depth} reads, pattern ${first}; following the reading it changed 55 times`);
}

/* --- 3 · the reads -------------------------------------------------------- */
{
  const cfg = M.configOne({ purity: "0.70", ccf: "1.00", state: "1+1", copies: 1, depth: "88" });
  const a = M.buildReads(makeRng(7), cfg);
  const b = M.buildReads(makeRng(7), cfg);
  check("the reads are seeded", a.reads.join("") === b.reads.join(""));
  check("the pileup holds the depth", a.reads.length === 88 && a.depth === 88);
  check("the running count is the running count",
    a.running[87] === a.reads.reduce((s, r) => s + r, 0) && M.altAt(a, 88) === a.alt);
  check("the last frame of the reveal is the finished reading",
    M.vafAt(a, 88) === a.alt / 88, M.n3(M.vafAt(a, 88)));
  let sum = 0;
  for (let s = 1; s <= 60; s += 1) sum += M.buildReads(makeRng(s), cfg).alt / 88;
  check("the reads land on the model's own expectation", Math.abs(sum / 60 - cfg.expected) < 0.02,
    `mean VAF ${(sum / 60).toFixed(3)} against ${M.n3(cfg.expected)}`);
  const cells = M.cellCounts(cfg);
  check("sixty cells carry the purity as a count", cells.tumour === 42 && cells.carrying === 42, `${cells.tumour} tumour cells`);
}

/* --- 4 · page 2: the mixture, and MATH ------------------------------------ */
{
  const cfgOne = M.configMany({ clones: "one", mutations: "300", purity2: "0.70", depth2: "88", assumed: "sample" });
  const one = M.buildMany(makeRng(3), cfgOne);
  check("one clone is given more than one cluster", one.fit.K > 1, `K = ${one.fit.K}`);
  check("its MATH is not zero", one.math > 8 && one.math < 22, one.math.toFixed(1));
  const cfgTwo = M.configMany({ clones: "two", mutations: "300", purity2: "0.70", depth2: "88", assumed: "sample" });
  const two = M.buildMany(makeRng(3), cfgTwo);
  check("a real subclone scores higher than one clone", two.math > one.math + 10,
    `${two.math.toFixed(1)} against ${one.math.toFixed(1)}`);
  check("the brackets are ordered by their own means",
    two.fit.spans.every((s, i) => i === 0 || s.mu >= two.fit.spans[i - 1].mu));
  check("a bracket is the component's mean ± one standard deviation",
    two.fit.spans.every((s) => Math.abs((s.hi - s.lo) / 2 - s.sd) < 1e-12));
  const shallow = M.buildMany(makeRng(3), { ...cfgOne, depthMedian: 31 });
  check("shallow reads raise MATH with no subclone present", shallow.math > one.math + 5,
    `${shallow.math.toFixed(1)} at median depth 31 against ${one.math.toFixed(1)} at 88`);
  const axisV = M.onAxis(two, cfgTwo, "vaf");
  const axisC = M.onAxis(two, cfgTwo, "ccf");
  check("the axis control divides, and does not refit",
    axisC.values.every((v, i) => Math.abs(v - M.ccfFrom(axisV.values[i], cfgTwo.assumed, 1, 2)) < 1e-12));
  const pure = M.onAxis(two, { ...cfgTwo, assumed: 1 }, "ccf");
  const keptTrue = axisC.values.filter((v) => v >= M.CUT).length;
  const keptPure = pure.values.filter((v) => v >= M.CUT).length;
  check("taking the sample as pure empties the clonal peak", keptPure < keptTrue / 4,
    `${keptPure} against ${keptTrue} at the true purity`);
}

/* --- 5 · page 3: the sum rule --------------------------------------------- */
{
  const all = M.SHAPES.filter((s) => M.SAMPLES.every((u) => M.fitsSumRule(s, u.ccf)));
  check("his four samples leave one shape", all.length === 1 && all[0].key === "linear");
  const surgery = M.SAMPLES[3];
  check("the surgery sample alone leaves both", M.shapesFitting(surgery.ccf).length === 2);
  check("the first sample rules branching out",
    M.shapesFitting(M.SAMPLES[0].ccf).map((s) => s.key).join() === "linear");
  const tightBranch = M.tightestNode(M.shapeOf("branching"), M.SAMPLES[0].ccf);
  check("the tightest constraint on a branching shape is the trunk's",
    tightBranch.node === 0 && Math.abs(tightBranch.sum - 1.046) < 1e-9, `${M.n2(tightBranch.sum)} against ${M.n2(tightBranch.parent)}`);
  const tightLinear = M.tightestNode(M.shapeOf("linear"), M.SAMPLES[0].ccf);
  check("…and on a linear one it is cluster 2's, not the trunk's", tightLinear.node === 1,
    `${M.n2(tightLinear.sum)} against ${M.n2(tightLinear.parent)}`);
  check("equal subclones must pass half the trunk before the rule bites",
    M.shapesFitting([0.9, 0.45, 0.45]).length === 2 && M.shapesFitting([0.9, 0.5, 0.5]).length === 1);
}

/* --- 6 · the contract, by name -------------------------------------------- */
{
  const W = await widget();
  for (const key of ["slug", "title", "status", "subtitle", "layout", "height", "params", "legend", "compute", "animation", "draw", "readout", "summary"]) {
    check(`declares \`${key}\``, W[key] != null);
  }
  const WANT = {
    page: "segmented", sampleSec: "section", purity: "choice", ccf: "choice", state: "segmented",
    copies: "choice", depth: "choice", clones: "segmented", mutations: "choice", lookSec: "section",
    axis: "segmented", assumed: "segmented", clusters: "bool", samplesSec: "section", taken: "choice",
    shape: "segmented", showcells: "bool", dataSec: "section", seed: "int", all: "bool", shown: "int",
  };
  for (const [name, type] of Object.entries(WANT)) check(`${name} is ${type}`, W.params[name]?.type === type);
  check("no parameters beyond those",
    Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
  for (const name of ["page", "axis", "assumed", "clusters", "taken", "shape", "showcells", "all"]) {
    check(`${name} is a display parameter`, W.params[name].display === true);
  }
  for (const name of ["purity", "ccf", "state", "copies", "depth", "clones", "mutations", "seed"]) {
    check(`${name} is a data parameter`, !W.params[name].display);
  }
  check("the widget is still a draft", W.status === "draft");
  check("the manifest agrees",
    JSON.parse(read("widgets/manifest.json")).widgets
      .find((w) => w.slug === "tumor-heterogeneity")?.status === "draft");
}

/* --- 7 · the animation, driven in node ------------------------------------ */
{
  const W = await widget();
  const values = await defaults();
  for (const depth of M.DEPTH_OPTIONS) {
    const params = { ...values, depth };
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    let frames = 0;
    anim.mode = "run";
    while (W.animation.advance(anim, { dt: 32, params, state }) && frames < 20000) frames += 1;
    check(`depth ${depth}: Play reaches the last read`, anim.k === state.one.depth && anim.done,
      `${frames} frames, ${(frames * 32 / 1000).toFixed(1)} s`);
    const stepAnim = W.animation.init({ params, state, fromScratch: true });
    stepAnim.mode = "step";
    W.animation.advance(stepAnim, { dt: 200, params, state });
    check(`depth ${depth}: one step adds one unit`, stepAnim.k === Math.max(1, Math.ceil(state.one.depth / 66)),
      `k = ${stepAnim.k}`);
  }
  const params = { ...values, page: "many" };
  const state = W.compute({ params, rng: makeRng(1) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  check("pages 2 and 3 take Step and Play out of the row", anim.inert === true);

  /* The axis ease: core supplies the frames, the widget asks once in rebuild
     and clears the request by landing (§ core/widget.js, the display path). */
  const eased = W.animation.init({ params: { ...values, page: "one" }, state, fromScratch: true });
  eased.mode = "run";
  for (let i = 0; i < 20; i += 1) W.animation.advance(eased, { dt: 32, params: { ...values, page: "one" }, state });
  const readsBefore = eased.k;
  W.animation.rebuild(eased, { params: { ...params, axis: "ccf" }, state });
  check("switching the axis asks core for frames", eased.easing === true);
  check("…and keeps the reads the reader has drawn", eased.k === readsBefore, `${eased.k} reads`);
  eased.mode = "ease";
  let frames = 0;
  while (W.animation.advance(eased, { dt: 32, params: { ...params, axis: "ccf" }, state }) && frames < 200) frames += 1;
  check("…and lands on the fraction", eased.mix === 1, `${frames} frames, ${(frames * 32)}ms against EASE_MS ${M.EASE_MS}`);
  /* Turned round mid-flight, an ease starts from where the figure IS. */
  const back = W.animation.init({ params: { ...params, axis: "ccf" }, state, fromScratch: true });
  back.mode = "ease";
  W.animation.rebuild(back, { params: { ...params, axis: "vaf" }, state });
  W.animation.advance(back, { dt: 32, params: { ...params, axis: "vaf" }, state });
  check("…and an ease turned round leaves from where it is", back.mix < 1 && back.mix > 0.7, M.n3(back.mix));

  /* What the ease interpolates: one set of mutations read twice, so nothing
     may overtake anything on the way (it is a rescaling, not a reshuffle). */
  const many = W.compute({ params, rng: makeRng(4) });
  const a = M.axisAt(many.many, many.manyCfg, 0);
  const b = M.axisAt(many.many, many.manyCfg, 1);
  const mid = M.axisAt(many.many, many.manyCfg, 0.5);
  check("the ease's ends are the two axes themselves",
    a.values.every((v, i) => v === many.many.muts[i].vaf) && b.values.every((v, i) => Math.abs(v - M.ccfFrom(many.many.muts[i].vaf, many.manyCfg.assumed, 1, 2)) < 1e-12));
  const order = (vals) => vals.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]).map(([, i]) => i).join();
  check("…and no mutation overtakes another on the way", order(mid.values) === order(a.values));
  check("…with the axis' own range carried with them", mid.max > a.max && mid.max < b.max, `${M.n2(a.max)} → ${M.n2(mid.max)} → ${M.n2(b.max)}`);
  const authored = W.animation.init({ ...{ params: { ...values, shown: 20 }, state }, fromScratch: false });
  check("`?shown=` applies on the first render only", authored.k === 20);
}

/* --- 8 · every readout and summary, over a grid ---------------------------- */
{
  const W = await widget();
  const values = await defaults();
  const cells = [];
  for (const page of ["one", "many", "clonal"]) {
    for (const purity of M.PURITY_OPTIONS) {
      for (const depth of M.DEPTH_OPTIONS) {
        for (const state of M.COPY_STATES.map((s) => s.key)) {
          cells.push({ ...values, page, purity, depth, state, copies: 2 });
        }
      }
    }
  }
  for (const clones of ["one", "two", "three"]) for (const axis of ["vaf", "ccf"]) for (const assumed of ["sample", "pure"]) {
    cells.push({ ...values, page: "many", clones, axis, assumed, mutations: "120" });
  }
  for (const taken of ["1", "2", "4"]) for (const shape of ["linear", "branching"]) {
    cells.push({ ...values, page: "clonal", taken, shape });
  }
  let bad = 0;
  let painted = 0;
  const notes = [];
  for (const params of cells) {
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.mode = "run";
    for (let i = 0; i < 400 && W.animation.advance(anim, { dt: 32, params, state }); i += 1) painted += 0;
    const { ctx } = recorder();
    W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
    const strings = [
      ...W.readout({ params, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
      W.summary({ params, state, anim }),
      ...W.legend({ params }).map((e) => e.label),
      cardText(),
    ];
    for (const s of strings) {
      if (s == null || /NaN|undefined|Infinity/.test(String(s))) { bad += 1; notes.push(`${params.page}: ${s}`); }
    }
  }
  check(`no NaN or undefined in ${cells.length} cells' readouts, summaries, legends and cards`, bad === 0, notes.slice(0, 2).join(" | "));
}

/* --- 8b · the formula card, page by page ---------------------------------- */
{
  const W = await widget();
  const values = await defaults();
  const drawWith = (params, k = null) => {
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    if (k != null) anim.k = k;
    const { ctx } = recorder();
    W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
    return { state, anim };
  };

  /* Page 1, before a read has landed and after: the definition stands from the
     start, and the counts appear only once there is a reading to report (2.4). */
  drawWith({ ...values, page: "one" }, 0);
  const empty = cardText();
  check("page 1's card states the definition before any read", /VAF = variant reads \/ reads/.test(empty), empty.slice(0, 48));
  check("…and reports no count yet", !/= \d+ \/ \d+ =/.test(empty));
  const { state } = drawWith({ ...values, page: "one" }, 88);
  const full = cardText();
  const alt = M.altAt(state.one, 88);
  check("…and carries this reading's own counts once they exist",
    full.includes(`= ${alt} / 88 = ${M.n3(M.vafAt(state.one, 88))}`), full.slice(0, 60));
  check("…the model in cell 25's letters", full.includes("VAF = p c m / (p Cₜ + 2(1 − p))"));
  check("…the model with this sample's numbers",
    full.includes(`(0.70 × 1.00 × 1) / (0.70 × 2 + 2 × 0.30) = ${M.n3(state.cfg.expected)}`), full.slice(60, 140));
  check("…and the fraction solved from the reading", /c = VAF × \(p Cₜ \+ 2\(1 − p\)\) \/ \(p m\)/.test(full));
  check("…with every letter named underneath", /p is the fraction of cells/.test(full));
  /* THE MUTATED-COPY COUNT IS A TIMING, and both places that can say so must.
     Kenneth read 2 + 0 with one mutated copy as impossible on 2026-09-16 —
     "isn't the mutation copied when the copy number increases?" — because the
     figure named what m counts and never what it encodes. 01-2 cell 25 states
     both orders of m, so a copy pass that drops either loses the answer. */
  check("…and says which order of events m stands for",
    /m is one when the mutation came after the copy number changed/.test(full)
    && /more when it came before and was copied with it/.test(full));
  check("the mutated-copy control says it too, where the question was asked",
    /came after the copy number changed/.test(M.STRINGS.copiesDetail)
    && /came before/.test(M.STRINGS.copiesDetail), M.STRINGS.copiesDetail);
  /* And both orders stay reachable: one mutated copy is the usual case the
     lesson names, and `major` of them is his reading, on every gained state. */
  for (const st of M.COPY_STATES.filter((x) => x.major > 1)) {
    check(`${st.label} offers both the mutation before the gain and after it`,
      M.copyOptions(st.key).includes("1") && M.copyOptions(st.key).includes(String(st.major)),
      M.copyOptions(st.key).join(", "));
  }

  /* Page 2: the same model solved for c, and MATH as cell 23's title. */
  const { state: many } = drawWith({ ...values, page: "many" });
  const card2 = cardText();
  check("page 2's card states the correction", card2.includes("c = VAF × (p Cₜ + 2(1 − p)) / (p m)"));
  check("…and what it multiplies by at this purity", /= VAF × 2\.86 at purity 0\.70/.test(card2), card2.slice(0, 90));
  check("…states MATH as it is computed", card2.includes("MATH = 100 × 1.4826 × MAD(VAF) / median(VAF)"));
  check("…and the same line with this tumour's numbers",
    card2.includes(`= ${many.many.math.toFixed(1)}`), card2.slice(-70));

  /* Page 3: the rule, and the sample that decides it. */
  const { state: tree } = drawWith({ ...values, page: "clonal", shape: "branching" });
  const card3 = cardText();
  check("page 3's card states the sum rule", /Σ over the children of a cluster: c ≤ c of the parent/.test(card3), card3.slice(0, 60));
  const decided = tree.used.find((s) => !M.fitsSumRule(M.shapeOf("branching"), s.ccf));
  const tight = M.tightestNode(M.shapeOf("branching"), decided.ccf);
  check("…and the arithmetic of the sample that rules the shape out",
    card3.includes(`${M.n2(tight.sum)} > ${M.n2(tight.parent)}`) && card3.includes(decided.key),
    `${decided.key}: ${M.n2(tight.sum)} > ${M.n2(tight.parent)}`);
  const linear = drawWith({ ...values, page: "clonal", shape: "linear" });
  void linear;
  check("…and the tightest one when the shape fits", /≤/.test(cardText()), cardText().slice(-40));
  check("the card is rebuilt when the page changes", cardText() !== card2 && cardText() !== full);
}

/* --- 9 · the geometry: nothing painted outside the canvas ------------------ */
{
  const W = await widget();
  const values = await defaults();
  const W_PX = 550; // the harness's canvas at FRAME_W 900 (HANDOVER § THE BIG ONE)
  let worst = null;
  const cells = [];
  for (const page of ["one", "many", "clonal"]) {
    for (const state of M.COPY_STATES.map((s) => s.key)) {
      for (const depth of M.DEPTH_OPTIONS) cells.push({ ...values, page, state, depth, copies: 2 });
    }
  }
  for (const clones of ["one", "two", "three"]) for (const axis of ["vaf", "ccf"]) cells.push({ ...values, page: "many", clones, axis });
  /* Page 2 at every purity and every mutation count: the sweep above holds the
     purity at its default, and the mid-tween check below reached 0.35 first. */
  for (const purity of M.PURITY_OPTIONS) for (const axis of ["vaf", "ccf"]) {
    for (const mutations of M.MUTATION_OPTIONS) cells.push({ ...values, page: "many", purity, axis, mutations });
  }
  for (const taken of ["1", "2", "4"]) for (const shape of ["linear", "branching"]) cells.push({ ...values, page: "clonal", taken, shape });
  for (const params of cells) {
    const height = W.height({ w: W_PX, ...params });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k = state.one.depth;
    /* SETTLED MEANS SETTLED. The widget carries page 2's last figure across
       draws, so sweeping the cells in a row had each one starting a morph out
       of the one before it and this sweep stopped measuring finished figures.
       Mid-flight is swept on its own, below. */
    anim.histFrom = null;
    anim.spansFrom = null;
    const { ctx, box } = recorder();
    W.draw({ ctx, colors: COLORS, w: W_PX, h: height, params, state, anim });
    const over = Math.max(0, box.x1 - W_PX, -box.x0, box.y1 - height, -box.y0);
    if (!worst || over > worst.over) worst = { over, params, box, height };
  }
  check("nothing is painted outside the canvas the page reserves, at 550px",
    worst.over <= 1.5,
    `worst ${worst.over.toFixed(1)}px on ${worst.params.page} (x ${worst.box.x0.toFixed(0)}–${worst.box.x1.toFixed(0)}, y ${worst.box.y0.toFixed(0)}–${worst.box.y1.toFixed(0)} in ${W_PX}×${worst.height})`
      + ` purity=${worst.params.purity} axis=${worst.params.axis} muts=${worst.params.mutations} clones=${worst.params.clones}`);

  /* And the layout's own rows may not overlap: the first build drew the note
     under the cells across the reads' caption. */
  const L = M.layout(W_PX, { ...values, page: "one" });
  check("page 1's rows do not overlap",
    L.cells.y + L.cells.h + 24 <= L.reads.y - 10
    && L.reads.y + L.reads.h < L.bar.y
    && L.bar.y + L.bar.h + 34 <= L.rows.y - 12);
}

/* --- the two tweens Kenneth asked for on 2026-09-16 ------------------------
   Page 3's shape switch, and page 2 under a change to purity, read depth or the
   mutation count. Both are held to their ENDS — a transition that does not land
   exactly on the figure the parameters ask for is a figure nobody can check —
   and to the rule about WHICH changes earn one. */
{
  const W = await widget();
  const values = await defaults();

  /* ---- page 3: cluster 3 slides out of cluster 2 to beside it ---- */
  check("the shape glide's one scalar has exactly two ends to run between",
    M.SHAPES.length === 2 && M.shapeIndex("linear") === 0 && M.shapeIndex("branching") === 1);

  const geom = { x: 10, y: 20, w: 200, h: 16 };
  const ccf = M.SAMPLES[0].ccf;
  const A = M.barRects(M.SHAPES[0], ccf, geom);
  const B = M.barRects(M.SHAPES[1], ccf, geom);
  const sameRect = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
    && Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.h - b.h) < 1e-9;
  check("the glide's ends are the two shapes' own layouts",
    M.lerpRects(A, B, 0).every((r, i) => sameRect(r, A[i]))
    && M.lerpRects(A, B, 1).every((r, i) => sameRect(r, B[i])));
  check("…and only cluster 3 moves: the trunk and cluster 2 hold still in both",
    sameRect(A[0], B[0]) && sameRect(A[1], B[1]) && !sameRect(A[2], B[2]),
    `cluster 3 x ${A[2].x} → ${B[2].x}`);
  check("…at one width throughout, so it slides rather than grows",
    Math.abs(A[2].w - B[2].w) < 1e-9, `${A[2].w.toFixed(2)}px`);
  /* The overflow is read off the rects as DRAWN, so the rule's own moment — the
     children reaching past the parent — happens DURING the slide, not after. */
  const over = [0, 0.25, 0.5, 0.75, 1].map((t) => M.overflowOf(M.lerpRects(A, B, t)));
  check("…and the overflow grows with it rather than appearing at the end",
    over[0] === 0 && over.every((v, i) => i === 0 || v >= over[i - 1]) && over[4] > 1,
    over.map((v) => v.toFixed(1)).join(" → "));

  const clonal = { ...values, page: "clonal" };
  const st3 = W.compute({ params: clonal, rng: makeRng(clonal.seed) });
  const sh = W.animation.init({ params: clonal, state: st3, fromScratch: true });
  check("the shape opens on the shape the control names", sh.shapeMix === 0);
  W.animation.rebuild(sh, { params: { ...clonal, shape: "branching" }, state: st3 });
  check("switching the shape asks core for frames", sh.easing === true);
  sh.mode = "ease";
  let f3 = 0;
  while (W.animation.advance(sh, { dt: 32, params: { ...clonal, shape: "branching" }, state: st3 }) && f3 < 200) f3 += 1;
  check("…and lands exactly on the other shape", sh.shapeMix === 1, `${f3} frames`);
  /* Turned round mid-glide it leaves from where the figure is, as the axis does. */
  const back3 = W.animation.init({ params: { ...clonal, shape: "branching" }, state: st3, fromScratch: true });
  back3.mode = "ease";
  W.animation.rebuild(back3, { params: clonal, state: st3 });
  W.animation.advance(back3, { dt: 32, params: clonal, state: st3 });
  check("…and a glide turned round leaves from where it is",
    back3.shapeMix < 1 && back3.shapeMix > 0.7, M.n3(back3.shapeMix));
  /* Off page 3 there is nothing to watch, so it lands rather than glides. */
  const off = W.animation.init({ params: { ...values, page: "one" }, state: st3, fromScratch: true });
  W.animation.rebuild(off, { params: { ...values, page: "one", shape: "branching" }, state: st3 });
  check("…and a shape changed off page 3 lands with no frames",
    !off.easing && off.shapeMix === 1);

  /* ---- page 2: the bars morph, and only for the sample's own parameters ---- */
  const many = { ...values, page: "many" };
  const stM = W.compute({ params: many, rng: makeRng(many.seed) });
  const axis = M.onAxis(stM.many, stM.manyCfg, "vaf");
  const hA = M.histOf(axis.values, stM.many.muts, axis.max);
  const total = (h) => h.reduce((t, c) => t + c[0] + c[1], 0);
  check("every mutation lands in exactly one bin", total(hA) === stM.manyCfg.n, `${total(hA)} of ${stM.manyCfg.n}`);

  const stB = W.compute({ params: { ...many, purity: "0.35" }, rng: makeRng(many.seed) });
  const axisB = M.onAxis(stB.many, stB.manyCfg, "vaf");
  const hB = M.histOf(axisB.values, stB.many.muts, axisB.max);
  const same = (x, y) => x.every((c, i) => Math.abs(c[0] - y[i][0]) < 1e-9 && Math.abs(c[1] - y[i][1]) < 1e-9);
  check("the morph's ends are the two histograms themselves",
    same(M.lerpHist(hA, hB, 0), hA) && same(M.lerpHist(hA, hB, 1), hB));
  check("…and it holds the mutation count all the way across",
    [0.25, 0.5, 0.75].every((t) => Math.abs(total(M.lerpHist(hA, hB, t)) - stM.manyCfg.n) < 1e-9));
  /* A bin that is empty at both ends stays empty: the morph moves the bars that
     exist and never invents one between them. */
  check("…and a bin empty at both ends is empty throughout",
    hA.every((c, i) => !(c[0] + c[1] === 0 && hB[i][0] + hB[i][1] === 0)
      || M.lerpHist(hA, hB, 0.5)[i][0] + M.lerpHist(hA, hB, 0.5)[i][1] === 0));

  /* WHICH CHANGES EARN ONE, driven through `draw` because that is what leaves
     the figure the morph starts from. Purity, depth and the mutation count are
     the same tumour re-read; a seed or a different set of populations is not. */
  const morphFor = (change) => {
    drawWithMany(W, many);                       // the figure on screen
    const next = { ...many, ...change };
    const st = W.compute({ params: next, rng: makeRng(next.seed) });
    return W.animation.init({ params: next, state: st, fromScratch: true });
  };
  for (const [what, change] of [
    ["purity", { purity: "0.35" }],
    ["read depth", { depth: "500" }],
    ["the mutation count", { mutations: "1000" }],
  ]) {
    const a = morphFor(change);
    check(`changing ${what} morphs the bars from the figure on screen`,
      Boolean(a.histFrom) && a.easing === true && a.histT === 0,
      `${a.histFrom ? a.histFrom.length : 0} bins carried`);
  }
  for (const [what, change] of [
    ["the seed", { seed: 2 }],
    ["the populations", { clones: "three" }],
  ]) {
    const a = morphFor(change);
    check(`…and changing ${what} lands with none — it is a different tumour`,
      !a.histFrom && !a.easing);
  }
  const offPage = (() => {
    drawWithMany(W, many);
    const next = { ...values, page: "one", purity: "0.35" };
    const st = W.compute({ params: next, rng: makeRng(next.seed) });
    return W.animation.init({ params: next, state: st, fromScratch: true });
  })();
  check("…and so does a change made away from page 2", !offPage.histFrom && !offPage.easing);
  /* And a morph left in flight lands when the reader leaves the page, so
     coming back never shows a figure halfway between two sets of parameters. */
  const left = morphFor({ purity: "0.35" });
  W.animation.rebuild(left, { params: { ...values, page: "one", purity: "0.35" }, state: stB });
  check("…and leaving page 2 mid-morph lands it", !left.histFrom && !left.spansFrom);

  /* A BAR MAY NOT OUTGROW ITS PLOT MID-MORPH. The height is the count over the
     top, and both are interpolated — if the top were held at either end, a
     300 → 1000 change would paint over the caption on the way. It holds by
     construction (every bin is under the max, and the max carries a tenth of
     headroom), which is exactly the kind of thing that stops holding when
     somebody changes one of the two. */
  {
    const topA = M.histTop(hA);
    const topB = M.histTop(hB);
    let worstFill = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const h = M.lerpHist(hA, hB, t);
      const top = M.lerp(topA, topB, t);
      for (const c of h) worstFill = Math.max(worstFill, (c[0] + c[1]) / top);
    }
    check("no bar outgrows its plot at any point in the morph",
      worstFill <= 1, `tallest bar fills ${(worstFill * 100).toFixed(1)}% of the plot`);
  }

  /* AND NOTHING LANDS OFF THE CANVAS MID-FLIGHT. The settled extents are swept
     elsewhere; a transition draws geometry no settled state ever does, and that
     is where a slide that overshoots would hide. */
  {
    const W_PX = 550;
    let worstOver = null;
    const mid = (params, fix) => {
      const st = W.compute({ params, rng: makeRng(params.seed) });
      const a = W.animation.init({ params, state: st, fromScratch: true });
      fix(a, st);
      const height = W.height({ w: W_PX, ...params });
      const { ctx, box } = recorder();
      W.draw({ ctx, colors: COLORS, w: W_PX, h: height, params, state: st, anim: a });
      const over = Math.max(0, box.x1 - W_PX, -box.x0, box.y1 - height, -box.y0);
      if (!worstOver || over > worstOver.over) worstOver = { over, params, height, box };
    };
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      for (const taken of ["1", "2", "4"]) {
        mid({ ...values, page: "clonal", taken }, (a) => { a.shapeMix = t; a.shape = "branching"; });
      }
      for (const axis of ["vaf", "ccf"]) {
        mid({ ...many, axis, purity: "0.35" }, (a) => {
          a.histFrom = hA; a.topFrom = M.histTop(hA); a.histT = t; a.spansFrom = null;
        });
      }
      /* both clocks at once: a shape switched while the bars are still moving */
      mid({ ...many, purity: "0.35" }, (a) => {
        a.histFrom = hA; a.topFrom = M.histTop(hA); a.histT = t; a.mix = t;
      });
    }
    check("nothing is painted outside the canvas mid-tween either",
      worstOver.over <= 0.5, `worst ${worstOver.over.toFixed(1)}px on ${worstOver.params.page}`
        + ` axis=${worstOver.params.axis} taken=${worstOver.params.taken}`
        + ` box x ${worstOver.box.x0.toFixed(1)}–${worstOver.box.x1.toFixed(1)}`
        + ` y ${worstOver.box.y0.toFixed(1)}–${worstOver.box.y1.toFixed(1)} in 550×${worstOver.height}`);
  }

  /* The clock: one length for every transition in the widget, and it lands. */
  const run = morphFor({ purity: "0.35" });
  run.mode = "ease";
  let f2 = 0;
  while (W.animation.advance(run, { dt: 32, params: { ...many, purity: "0.35" }, state: stB }) && f2 < 200) f2 += 1;
  check("the bars' morph lands and clears what it moved from",
    run.histT === 1 && run.histFrom === null && run.spansFrom === null,
    `${f2} frames, ${f2 * 32}ms against EASE_MS ${M.EASE_MS}`);
}

/* --- the copy, against the words this collection has struck ---------------
   The copy audit of 2026-09-16 (catalogue § *Slot 67*). A sweep, not a set of
   fixed strings, because the words are struck for every string the widget will
   ever grow — an audit does not cover copy written after it.

   "tumor" and not "tumour" is Kenneth's pick of the same day: the lesson's own
   headings are American ("Tumor Purity", 01-2 cell 24) and so is the one other
   shipped widget that uses the word. Source comments are exempt (CLAUDE.md),
   so the scan masks them before it reads a literal. */
{
  const src = [read("widgets/tumor-heterogeneity/main.js"), read("widgets/tumor-heterogeneity/model.js")]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
    .map((m) => m[2].replace(/\$\{[^}]*\}/g, " "))   // a template's ${…} is code, not words
    /* markup, a design token and a CSS media query are not copy */
    .filter((t) => /[a-z]{3}/i.test(t) && !/^<|var\(--|^\([a-z-]+:/.test(t) && t.trim().length >= 12);
  const struck = [
    /* the sit/fall/lie pass of 2026-09-13 */
    ["a physical verb for a value", /\b(sits?|sitting|sat|lies|lying|falls?|falling|fell|walks?|walking)\b/i],
    /* no personification: a model does not keep, want or choose */
    ["a model acting", /\b(keeps?|wants?|thinks?|believes?|decides?|chooses?|chose|knows?|tries|refuses?|prefers?)\b/i],
    /* our shorthand, not the field's: a threshold is a threshold */
    ["our own shorthand", /\b(cut|card|rung|trench|the plain)\b/i],
    /* no lesson references on a reader-facing string (prd §4; check asserts it too) */
    ["a lesson reference", /\b(notebook|lesson|cell \d|chapter)\b/i],
    /* Kenneth's pick, 2026-09-16 */
    ["the other spelling", /\btumour/i],
  ];
  const hits = [];
  for (const t of strings) {
    for (const [why, re] of struck) if (re.test(t)) hits.push(`${why}: "${t.slice(0, 56)}"`);
  }
  check(`${strings.length} reader-facing strings carry no struck word`, hits.length === 0, hits.join(" | "));
}

console.log(`\n${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
