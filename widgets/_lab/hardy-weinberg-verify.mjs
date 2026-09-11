/* ============================================================================
   Assertions on widget 56's engine, geometry and copy.

       node widgets/_lab/hardy-weinberg-verify.mjs

   Imports `widgets/hardy-weinberg/model.js`, the shipping code and not a copy
   (5.8), and `widgets/core/params.js`, so the URL round trip is the one the
   page performs.

   Five of these need a reader most.

   THE SURVEY'S OWN NUMBERS. `_lab/hwe-measure.mjs` ran 28 checks on 2026-09-11
   and every control on this widget was chosen from them: the critical χ² at the
   three thresholds, the identity χ² = n·F², the deficit each source produces,
   and the fact that one population in equilibrium at 323 individuals fails
   nothing at 10⁻⁶. The test and the four samplers were MOVED into the widget,
   so the same numbers are asserted here against the moved copies. If they drift,
   the figure is drawing something the survey never measured.

   THE FAST SAMPLER AGAINST THE EXACT ONE. The Many-SNPs page cannot draw
   individuals — 2,000 tables at 50,000 individuals is 200 million draws — so it
   draws counts. That is a second implementation of the same three samplers, and
   the only thing standing between it and a plausible wrong picture is that its
   mean and variance are the binomial's and its deficit is the exact sampler's.
   The rng is wrapped in a counter, so the branch each call takes is asserted
   rather than assumed.

   THE ARRIVAL'S LAST FRAME IS THE FINISHED TABLE. The walking point and the
   settled point are one figure; if the reveal's last table is not the sample's
   own table, the widget disagrees with itself at exactly the moment nobody is
   watching.

   THE GEOMETRY. `height` and `draw` share one function precisely so this script
   can measure what the widget draws, and bars overlapping the triangle would
   still hash consistently for ever.

   THE STATUS. Both files say `draft` and this assertion says so; it flips at
   ship, in the same commit as the manifest and the widget.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../hardy-weinberg/model.js";
import { makeRng } from "../core/rng.js";
import { resolveParams, toQuery } from "../core/params.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 78)} ${detail}`);
}

const src = read("widgets/hardy-weinberg/main.js");
const modelSrc = read("widgets/hardy-weinberg/model.js");
const manifest = JSON.parse(read("widgets/manifest.json"));
const card = manifest.widgets.find((w) => w.slug === "hardy-weinberg");

/* the state the widget opens on, through its own door */
const DEFAULTS = {
  page: "one", source: "pooled", p: 0.5, gap: 0.5, error: 0.3, n: "323",
  threshold: "1e-6", view: "whole", whole: false, seed: 1, shown: 0,
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });

/** An rng that counts what is drawn from it, for the branch assertions. */
function counting(seed) {
  const rng = makeRng(seed);
  let n = 0;
  return {
    next: () => { n += 1; return rng.next(); },
    normal: (mu, sd) => { n += 1; return rng.normal(mu, sd); },
    get drawn() { return n; },
  };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const variance = (a) => {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};

/* --- the widget itself, driven with no browser and no clock ----------------
 * `main.js` imports two things from core and its own model, so stubbing the
 * core import captures the whole config object — and `compute`,
 * `animation.init/advance/rebuild`, `legend`, `readout` and `summary` are then
 * callable with no DOM. `draw` wants a real canvas and is not called here.
 * Loaded once, and declared up here because §7 reads the widget's own copy. */
let cached = null;
async function widget() {
  if (cached) return cached;
  const abs = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);
  let text = read("widgets/hardy-weinberg/main.js");
  /* THE REAL `makePlot`, not a stub. It is DOM-free — it takes a context and
     does arithmetic — so §9 can drive the widget's own `draw` against a
     recording context and read every string the figure paints, which is the
     cheapest check in the repo and the only one here that sees the picture. */
  text = text.replace(/^import \{ defineWidget, makePlot \} from "\.\.\/core\/index\.js";$/m,
    `import { makePlot } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../hardy-weinberg/model.js")};`);
  text += "\nexport { __cfg };\n";
  cached = (await import(
    `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  )).__cfg;
  return cached;
}

/** `compute`'s own body, called the way the widget calls it. */
function build(params, seed) {
  const rng = makeRng(seed ?? params.seed ?? 1);
  const cfg = M.configFor(params);
  return { cfg, one: M.buildArrival(rng, cfg), many: M.buildMany(rng, cfg) };
}

/* --- 1 · the test, against the survey's numbers ---------------------------- */
{
  check("the critical χ² on 1 df is 23.93 at 10⁻⁶",
    Math.abs(M.CRIT["1e-6"] - 23.93) < 0.05, M.CRIT["1e-6"].toFixed(3));
  check("…10.83 at 10⁻³", Math.abs(M.CRIT["1e-3"] - 10.83) < 0.05, M.CRIT["1e-3"].toFixed(3));
  check("…and 3.84 at 0.05", Math.abs(M.CRIT["0.05"] - 3.84) < 0.05, M.CRIT["0.05"].toFixed(3));
  check("at 323 individuals the 10⁻⁶ line is F ≈ 0.27",
    Math.abs(M.fLine(M.CRIT["1e-6"], 323) - 0.272) < 0.005, M.n3(M.fLine(M.CRIT["1e-6"], 323)));

  /* the identity, on exact pooled tables — the measure script's own case */
  let worstF = 0;
  let worstChi = 0;
  for (const [p1, p2] of [[0.3, 0.7], [0.2, 0.7], [0.45, 0.55]]) {
    const n = 100000;
    const half = n / 2;
    const table = [
      half * p1 * p1 + half * p2 * p2,
      half * 2 * p1 * (1 - p1) + half * 2 * p2 * (1 - p2),
      half * (1 - p1) ** 2 + half * (1 - p2) ** 2,
    ];
    const t = M.hweTest(table);
    worstF = Math.max(worstF, Math.abs(t.F - M.wahlundF([p1, p2])));
    worstChi = Math.max(worstChi, Math.abs(t.chi - n * t.F * t.F) / n);
  }
  check("F from a pooled table is Var(p)/p̄q̄", worstF < 1e-9, worstF.toExponential(2));
  check("χ² = n·F² on an exact pooled table", worstChi < 1e-9, worstChi.toExponential(2));

  /* χ² = n·F² for ANY two-allele table, which is what makes the histogram's
     threshold line the test itself rather than a summary of it (decision 11) */
  const rng = makeRng(7);
  let worstAny = 0;
  for (let i = 0; i < 500; i += 1) {
    const table = [1 + Math.floor(rng.next() * 400), 1 + Math.floor(rng.next() * 400),
      1 + Math.floor(rng.next() * 400)];
    const t = M.hweTest(table);
    worstAny = Math.max(worstAny, Math.abs(t.chi - t.n * t.F * t.F));
  }
  check("χ² = n·F² on any genotype table, so the threshold is one line",
    worstAny < 1e-9, worstAny.toExponential(2));
}

/* --- 2 · what each source does, against the survey ------------------------- */
{
  const rng = makeRng(20260911);
  const meanF = (draw, reps = 150) => {
    let s = 0;
    for (let r = 0; r < reps; r += 1) s += M.hweTest(draw()).F;
    return s / reps;
  };

  const fOne = meanF(() => M.poolSample(rng, 2000, [0.5]));
  check("one population sits on the curve", Math.abs(fOne) < 0.01, M.n3(fOne));

  const fPool = meanF(() => M.poolSample(rng, 2000, [0.25, 0.75]));
  check("a difference of 0.5 pooled gives the Wahlund F of 0.25",
    Math.abs(fPool - M.wahlundF([0.25, 0.75])) < 0.02, M.n3(fPool));

  for (const e of [0.1, 0.2, 0.3]) {
    const f = meanF(() => M.dropoutSample(rng, 2000, 0.5, e));
    check(`heterozygotes miscalled at ${e} give F ≈ ${e}`, Math.abs(f - e) < 0.02, M.n3(f));
  }
  for (const e of [0.1, 0.2, 0.3]) {
    const f = meanF(() => M.overcallSample(rng, 2000, 0.5, e));
    check(`homozygotes miscalled at ${e} give F ≈ −${e}`, Math.abs(f + e) < 0.02, M.n3(f));
  }

  /* the survey's fourth question: sampling alone, at the lesson's own size */
  let f6 = 0;
  let f05 = 0;
  let deficit = 0;
  const SNPS = 2000;
  for (let s = 0; s < SNPS; s += 1) {
    const p = 0.05 + 0.9 * rng.next();
    const t = M.hweTest(M.poolSample(rng, 323, [p]));
    if (t.P < 1e-6) f6 += 1;
    if (t.P < 0.05) f05 += 1;
    if (t.F > 0) deficit += 1;
  }
  check("one population at 323 over 2,000 SNPs fails nothing at 10⁻⁶", f6 === 0, String(f6));
  check("…and about 5% of them at 0.05", f05 / SNPS > 0.03 && f05 / SNPS < 0.07,
    `${((100 * f05) / SNPS).toFixed(1)}%`);
  check("…with the deficit and the excess equally likely",
    deficit / SNPS > 0.42 && deficit / SNPS < 0.58, `${((100 * deficit) / SNPS).toFixed(1)}%`);
}

/* --- 3 · the counts sampler: the branch, the moments, the deficit ---------- */
{
  /* the branch each call takes, read off the rng rather than assumed */
  {
    const c1 = counting(3);
    M.binomial(c1, 100, 0.5);
    check("a small count is an exact Bernoulli sum", c1.drawn === 100, `${c1.drawn} draws`);
    const c2 = counting(3);
    M.binomial(c2, 323, 0.5);
    check("a large one is one normal draw, rounded and clamped", c2.drawn === 1, `${c2.drawn} draws`);
    const c3 = counting(3);
    M.binomial(c3, 50000, 0.02);
    check("a rare allele at 50,000 individuals does not loop", c3.drawn === 1, `${c3.drawn} draws`);
  }

  /* the moments, in both branches, against the binomial's own */
  for (const [n, p] of [[100, 0.5], [323, 0.5], [60, 0.15], [10000, 0.3], [50000, 0.08]]) {
    const rng = makeRng(11);
    const REPS = 4000;
    const draws = new Array(REPS);
    for (let i = 0; i < REPS; i += 1) draws[i] = M.binomial(rng, n, p);
    const m = mean(draws);
    const v = variance(draws);
    const wantM = n * p;
    const wantV = n * p * (1 - p);
    const se = Math.sqrt(wantV / REPS);
    check(`binomial(${n}, ${p}) has the binomial's mean`, Math.abs(m - wantM) < 4 * se,
      `${m.toFixed(2)} against ${wantM}`);
    check(`binomial(${n}, ${p}) has the binomial's variance`,
      Math.abs(v - wantV) / wantV < 0.12, `${v.toFixed(1)} against ${wantV.toFixed(1)}`);
    check(`binomial(${n}, ${p}) stays a whole count inside [0, n]`,
      draws.every((k) => Number.isInteger(k) && k >= 0 && k <= n));
  }

  {
    const rng = makeRng(5);
    let ok = true;
    for (let i = 0; i < 200; i += 1) {
      const t = M.multinomial3(rng, 777, M.hweProbs(0.3));
      if (t[0] + t[1] + t[2] !== 777 || t.some((v) => v < 0)) ok = false;
    }
    check("a table of three counts always adds up to the sample size", ok);
  }

  /* the fast sampler's deficit is the exact sampler's, source by source */
  const REPS = 200;
  const fastF = (source, cfg) => {
    const rng = makeRng(19);
    let s = 0;
    for (let r = 0; r < REPS; r += 1) s += M.hweTest(M.tableFor(rng, source, cfg)).F;
    return s / REPS;
  };
  const n = 2000;
  const pooled = fastF("pooled", { p: 0.5, subs: M.subFreqs(0.5, 0.4), error: 0, n });
  check("the counts sampler reproduces the Wahlund deficit",
    Math.abs(pooled - M.wahlundF(M.subFreqs(0.5, 0.4))) < 0.02, M.n3(pooled));
  const het = fastF("heterozygotes", { p: 0.5, subs: [0.5, 0.5], error: 0.25, n });
  check("the counts sampler reproduces the miscalled-heterozygote deficit",
    Math.abs(het - 0.25) < 0.02, M.n3(het));
  const hom = fastF("homozygotes", { p: 0.5, subs: [0.5, 0.5], error: 0.25, n });
  check("the counts sampler reproduces the miscalled-homozygote excess",
    Math.abs(hom + 0.25) < 0.02, M.n3(hom));
  const alone = fastF("one", { p: 0.35, subs: [0.35, 0.35], error: 0, n });
  check("the counts sampler leaves one population on the curve",
    Math.abs(alone) < 0.01, M.n3(alone));

  /* AND THE WHOLE PAGE IS DRAWN FROM COUNTS — NEVER FROM INDIVIDUALS. The claim
     is not that the draws are few but that they do not follow the sample size:
     per individual, 2,000 tables at 50,000 people is 200 million draws, and the
     page is built on every parameter change. What is left is the exact branch,
     which is capped at a few hundred iterations per call whatever n is. */
  {
    const small = counting(2);
    M.buildMany(small, M.configFor(base({ n: "1000" })));
    const big = counting(2);
    const many = M.buildMany(big, M.configFor(base({ n: "50000" })));
    check("the Many-SNPs page costs no more at 50,000 individuals than at 1,000",
      big.drawn < 3 * small.drawn && big.drawn < 1e6,
      `${M.intText(big.drawn)} draws against ${M.intText(small.drawn)}, `
      + `where one draw per individual would be ${M.intText(2 * 50000 * M.SNP_COUNT)}`);
    check("every SNP gets an F", many.F.length === M.SNP_COUNT && many.F.every(Number.isFinite));
  }

  /* the average difference across the SNPs is the control's own value */
  {
    const cfg = M.configFor(base({ gap: 0.3, n: "1000" }));
    const many = M.buildMany(makeRng(4), cfg);
    /* E[F] = E[(Δ/2)²] / p̄q̄ over the SNPs; at the spread the half-normal has,
       E[Δ²] = (π/2)·E[Δ]², so the mean F is the control's difference squared
       times π/8 divided by the average p̄q̄ — asserted as a band rather than a
       constant, because the frequencies are drawn too. */
    check("the SNPs' deficits sit around the difference the control names",
      many.meanF > 0.04 && many.meanF < 0.16, `mean F ${M.n3(many.meanF)}`);
    const flat = M.buildMany(makeRng(4), M.configFor(base({ gap: 0, n: "1000" })));
    check("no difference leaves the 2,000 SNPs in equilibrium",
      Math.abs(flat.meanF) < 0.01, `mean F ${M.n3(flat.meanF)}`);
    check("…and half of them on each side of it",
      flat.deficits / flat.count > 0.42 && flat.deficits / flat.count < 0.58,
      `${((100 * flat.deficits) / flat.count).toFixed(1)}%`);
  }

  /* the histogram splits at the line and counts exactly what the test counts */
  {
    const cfg = M.configFor(base({ n: "1000", gap: 0.4 }));
    const many = M.buildMany(makeRng(8), cfg);
    const line = M.fLine(cfg.crit, cfg.n);
    const H = M.fHistogram(many.F, line);
    const total = H.inside.reduce((a, b) => a + b, 0) + H.beyond.reduce((a, b) => a + b, 0);
    check("every SNP lands in a bin", total === many.count, `${total} of ${many.count}`);
    const beyond = H.beyond.reduce((a, b) => a + b, 0);
    const past = [...many.F].filter((f) => Math.abs(f) >= line).length;
    /* A bin belongs to one side by its own centre, so the two can differ only
       by SNPs inside the bin the line runs through. */
    const straddle = [...many.F].filter((f) => Math.abs(Math.abs(f) - line) < H.width).length;
    check("the bars past the line are the SNPs past the threshold",
      Math.abs(beyond - past) <= straddle,
      `${beyond} bars against ${past} SNPs, ${straddle} in the line's own bin`);
    check("the SNPs past the line are the SNPs the test fails",
      past === many.past, `${past} against ${many.past}`);
  }
}

/* --- 4 · the arrival: pure, seeded, and its last frame is the table -------- */
{
  const shape = (s) => [
    s.one.counts.join(),
    s.one.order.join(),
    [...s.many.F].join(),
    s.many.past,
    s.many.meanF,
  ].join("|");
  for (const over of [{}, { source: "one" }, { source: "heterozygotes" },
    { source: "homozygotes" }, { n: "10000" }]) {
    const params = base(over);
    const a = build(params);
    const b = build(params);
    check(`compute is pure at source=${params.source}, n=${params.n}`, shape(a) === shape(b));
  }
  check("no randomness reaches the model", !/Math\.random/.test(modelSrc));
  check("no randomness reaches the widget", !/Math\.random/.test(src));

  for (const over of [{}, { source: "one" }, { source: "heterozygotes" },
    { source: "homozygotes" }, { n: "100" }, { n: "50000" }]) {
    const s = build(base(over));
    const last = M.countsAt(s.one, s.one.n);
    check(`the arrival's last frame is the finished table (${over.source ?? "pooled"}, n ${s.one.n})`,
      last.join() === s.one.counts.join(), `${last.join()} against ${s.one.counts.join()}`);
  }


  /* the running table is a running table */
  {
    const s = build(base({ n: "1000" }));
    let ok = true;
    for (const k of [0, 1, 2, 17, 500, 999, 1000]) {
      const c = M.countsAt(s.one, k);
      if (c[0] + c[1] + c[2] !== k) ok = false;
    }
    check("the table after k individuals holds exactly k individuals", ok);
    check("the table is empty before the first individual",
      M.countsAt(s.one, 0).join() === "0,0,0");
  }

  /* the arrival's own deficit is the source's, at the size the survey used */
  {
    let s = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      s += M.hweTest(build(base({ n: "10000", source: "heterozygotes", error: 0.2 }), seed).one.counts).F;
    }
    check("miscalling heterozygotes one at a time gives the same F as the table sampler",
      Math.abs(s / 40 - 0.2) < 0.02, M.n3(s / 40));
  }
}

/* --- 5 · the geometry is one function -------------------------------------- */
{
  const WIDTHS = [550, 620, 690, 776];
  let inside = true;
  let apart = true;
  let aspect = true;
  for (const w of WIDTHS) {
    for (const view of ["whole", "sample"]) {
      const L = M.layout(w, { page: "one", view });
      if (L.tri.x < 0 || L.tri.y + L.tri.h > L.height) inside = false;
      if (L.bars.x + L.bars.w > w - M.PAD_R + 0.5) inside = false;
      if (L.bars.y + L.bars.h > L.height) inside = false;
      /* the bars' own axis label and tick numbers live in the gap, 40px of it */
      if (L.bars.x - (L.tri.x + L.tri.side) < 50) apart = false;
      if (Math.abs(L.tri.h / L.tri.side - M.S3 / 2) > 0.01) aspect = false;
    }
    const many = M.layout(w, { page: "many", view: "whole" });
    if (many.hist.x + many.hist.w > w - M.PAD_R + 0.5) inside = false;
    if (many.hist.y + many.hist.h > many.height) inside = false;
  }
  check("every panel sits inside the stage, at every width", inside,
    WIDTHS.map((w) => `${M.layout(w, { page: "one", view: "whole" }).height}`).join(" "));
  check("the bars never touch the triangle", apart);
  check("the triangle keeps its own aspect at every width", aspect);
  check("the detail view is taller than the whole triangle, and by the axis it adds",
    WIDTHS.every((w) => M.layout(w, { page: "one", view: "sample" }).height
      - M.layout(w, { page: "one", view: "whole" }).height === 22));
  check("the Many-SNPs page has a height of its own",
    M.layout(690, { page: "many", view: "whole" }).height
      !== M.layout(690, { page: "one", view: "whole" }).height,
    `${M.layout(690, { page: "many" }).height} against ${M.layout(690, { page: "one", view: "whole" }).height}`);
  check("the page and the view are all the height reads",
    M.stageHeight(690, base()) === M.layout(690, base()).height
    && M.stageHeight(690, base({ n: "50000" })) === M.stageHeight(690, base()));
  check("the widget asks layout() for every rect and builds none of its own",
    /M\.layout\(/.test(src) && !/const rect = \{ x: \d/.test(src));
  check("the height is a function of the parameters and the width",
    /height: \(\{ w, \.\.\.values \}\) => M\.stageHeight\(w, values\)/.test(src));

  /* the detail window is a magnified REGION of the same triangle */
  {
    const win = M.zoomWindow(0.5);
    check("the detail window is centred on the control's own allele frequency",
      Math.abs((win.x[0] + win.x[1]) / 2 - 0.5) < 1e-9, M.n3((win.x[0] + win.x[1]) / 2));
    check("the detail window keeps the triangle's aspect, so it is a magnification",
      Math.abs((win.y[1] - win.y[0]) / (win.x[1] - win.x[0]) - M.S3 / 2) < 1e-9);
    const edge = M.zoomWindow(0.95);
    check("the window stays inside the triangle at an extreme frequency",
      edge.x[0] >= -1e-9 && edge.x[1] <= 1 + 1e-9 && edge.y[0] >= -1e-9,
      `[${M.n2(edge.x[0])}, ${M.n2(edge.x[1])}]`);
  }
}

/* --- 6 · the pace and the batches ------------------------------------------ */
{
  check("a unit is one individual at 100 and 500 at 50,000",
    M.batchFor(100) === 1 && M.batchFor(50000) === 500,
    M.N_OPTIONS.map((o) => `${o.label}:${M.batchFor(M.nOf(o.value))}`).join(" "));
  const secs = M.N_OPTIONS.map((o) => (M.unitsFor(M.nOf(o.value)) * M.UNIT_MS) / 1000);
  check("every sample size builds in under eight seconds", secs.every((s) => s <= 8),
    secs.map((s) => `${s.toFixed(1)}s`).join(" "));
  check("…and none of them in under two", secs.every((s) => s >= 2),
    secs.map((s) => `${s.toFixed(1)}s`).join(" "));
  /* "Add N individuals" after the copy audit of 2026-09-12 — the noun on the
     button, the number it adds inside it */
  check("every step label names the number of individuals it adds",
    M.N_OPTIONS.every((o) => {
      const b = M.batchFor(M.nOf(o.value));
      return M.STEP_LABELS[o.value] === (b === 1 ? "Add 1 individual" : `Add ${M.intText(b)} individuals`);
    }),
    Object.values(M.STEP_LABELS).join(" · "));
}

/* --- 7 · the register (5.9), the URL, and the status ----------------------- */
{
  const optionLines = [...M.PAGES, ...M.SOURCES, ...M.VIEWS, ...M.THRESHOLDS, ...M.N_OPTIONS]
    .map((o) => o.detail).filter(Boolean);
  const fieldLines = [
    M.STRINGS.pageDetail, M.STRINGS.sourceDetail, M.STRINGS.pDetail, M.STRINGS.gapDetail,
    M.STRINGS.errorDetail, M.STRINGS.nDetail, M.STRINGS.thresholdDetail, M.STRINGS.viewDetail,
    M.STRINGS.wholeDetail, M.STRINGS.seedDetail,
  ];
  /* Kenneth, 2026-09-11 (widget 55): a line under a control that says what will
     happen is the widget announcing its own answer before the first press. A
     detail says what the control IS. */
  const outcome = /\b(reach|reaches|fail|fails|pass|passes|end at|ends at|shows?|finds?|sees?|becomes?|leaves?|moves? off)\b/i;
  const offenders = [...optionLines, ...fieldLines].filter((s) => outcome.test(s));
  check("no control line announces an outcome", offenders.length === 0, offenders.join(" | "));

  /* every reader-facing string, swept for the register */
  const W = await widget();
  const reader = [
    ...Object.values(M.STRINGS),
    ...[...M.PAGES, ...M.SOURCES, ...M.VIEWS, ...M.THRESHOLDS, ...M.N_OPTIONS]
      .flatMap((o) => [o.label, o.detail].filter(Boolean)),
    ...M.SOURCES.map((s) => s.caption),
    ...["one", "many"].flatMap((page) => W.legend({ params: base({ page }) }).map((e) => e.label)),
    ...["one", "many"].flatMap((page) => {
      const params = base({ page });
      const state = W.compute({ params, rng: makeRng(1) });
      return W.readout({ params, state, anim: { k: 40 } })
        .flatMap((t) => [t.label, t.note].filter(Boolean));
    }),
  ];
  check("no reader-facing string says \"never\"", !reader.some((s) => /\bnever\b/i.test(s)));
  check("no reader-facing string names a lesson, notebook, cell or course",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)),
    reader.filter((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)).join(" | "));
  /* the collection's own vocabulary is ours and not the textbook's — Kenneth,
     2026-09-11: "what is card, rung?" */
  const ours = /\b(cards?|rungs?|ladders?|rails?|stages?|faces?|arms?|piles?|ramps?|budgets?|arrivals?|walks?|wells?|plains?|trenches?|frames?)\b/i;
  const coined = reader.filter((s) => ours.test(s));
  check("no reader-facing string uses the collection's own vocabulary",
    coined.length === 0, coined.join(" | "));
  check("the subtitle is three claims, not a paragraph",
    M.STRINGS.subtitle.length <= 300, `${M.STRINGS.subtitle.length} chars`);
  check("the gallery blurb fits the card's 120", M.STRINGS.blurb.length <= 120,
    `${M.STRINGS.blurb.length} chars`);
  check("the blurb in the manifest is the model's own", card.blurb === M.STRINGS.blurb);

  /* THE URL IS READER-FACING COPY (5.9): every value is a word its own control
     shows, or the number on its tick. */
  const shown = (opt) => opt.label.toLowerCase().replace(/,/g, "").split(/[^a-z0-9.]+/);
  const wrong = [...M.PAGES, ...M.SOURCES, ...M.VIEWS].filter((o) => !shown(o).includes(o.value));
  check("every option's URL value is a word its control shows", wrong.length === 0,
    wrong.map((o) => `${o.value} / ${o.label}`).join(" | "));
  check("every sample size's URL value is the number on its tick",
    M.N_OPTIONS.every((o) => o.value === o.label.replace(/,/g, "")));
  check("every threshold's URL value is the number its tick shows",
    M.THRESHOLDS.every((t) => Number(t.value) === t.alpha),
    M.THRESHOLDS.map((t) => `${t.value}=${t.alpha}`).join(" "));

  /* the round trip: a link omits the defaults and reads back what it carries */
  {
    const spec = Object.fromEntries(Object.entries(W.params)
      .filter(([, f]) => f.type !== "section"));
    check("a bare page is the default state",
      toQuery(spec, base()) === "", toQuery(spec, base()));
    const qs = toQuery(spec, base({ page: "many", source: "heterozygotes", n: "10000" }));
    check("a tuned figure is a short link", qs === "page=many&source=heterozygotes&n=10000", qs);
    const back = resolveParams(spec, new URLSearchParams(qs));
    check("and it reads back", back.page === "many" && back.source === "heterozygotes"
      && back.n === "10000" && back.p === 0.5);
    check("an unknown value falls back to the default",
      resolveParams(spec, new URLSearchParams("source=dropout")).source === "pooled");
  }

  /* THIS ASSERTION FLIPS AT SHIP, in the same commit as the manifest and the
     widget: a draft recorded as shipped is what puts unfinished teaching
     material on the front page. */
  /* Flipped with the status on "tested ok", 2026-09-12, in the same commit as
     the manifest and the fingerprint states. */
  check("the widget is declared shipped in both files",
    /^\s*status: "shipped",$/m.test(src) && card.status === "shipped", card.status);
  check("the card carries the slot's course and arc",
    card.course === "PHM5003" && card.arc === 56, `${card.course} ${card.arc}`);
}

/* --- 8 · the widget driven in node, with no browser and no clock ----------
 * `main.js` imports two things from core and its own model, so stubbing the
 * core import captures the whole config object — and `compute`,
 * `animation.init/advance/rebuild`, `legend`, `readout` and `summary` are then
 * callable with no DOM. What this catches that nothing above does: that the
 * arrival reaches the last individual, that a display change keeps it where a
 * data change resets it, and — cheapest of the lot — that no readout tile or
 * summary anywhere along the rail carries a NaN.
 *
 * AND THE CONTRACT IS LISTED BY NAME, so a deletion is noticed: an assertion
 * that tests behaviour still present cannot see a whole block go. `widget()`
 * itself is at the top of this file, because §7 sweeps the widget's own copy.
 */
{
  const W = await widget();
  for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
    "params", "legend", "compute", "draw", "readout", "summary", "animation"]) {
    check(`the widget declares \`${key}\``, W[key] != null);
  }
  const WANT = {
    page: "segmented", source: "segmented", p: "float", gap: "float", error: "float",
    n: "choice", threshold: "segmented", view: "segmented", whole: "bool", seed: "int",
    shown: "int",
  };
  for (const [n, t] of Object.entries(WANT)) {
    check(`${n} is a ${t}`, W.params[n]?.type === t, W.params[n]?.type);
  }
  const declared = Object.entries(W.params)
    .filter(([, f]) => f.type !== "section").map(([n]) => n).sort().join();
  check("no parameters beyond those", declared === Object.keys(WANT).sort().join(), declared);
  check("the display parameters are the page, the threshold, the view and the fill",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join()
      === "page,threshold,view,whole",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join());
  check("the source, the frequencies and the sample size are DATA",
    ["source", "p", "gap", "error", "n", "seed"].every((n) => !W.params[n].display));
  check("the frequency difference shows under two populations alone",
    W.params.gap.when?.param === "source" && W.params.gap.when?.equals === "pooled");
  check("the miscall rate shows under the two miscalling sources alone",
    W.params.error.when?.oneOf?.join() === "heterozygotes,homozygotes");
  check("the allele frequency and the view are One SNP's own",
    W.params.p.when?.equals === "one" && W.params.view.when?.equals === "one");
  check("the seed sits below the drive row (3.4j)", W.params.seed.afterDrive === true);
  check("the widget opens empty, with the head start hidden (2.1)",
    W.params.shown.hidden === true && W.params.shown.default === 0);
  check("the animation reveals k and never recomputes (non-negotiable 2)",
    !/compute/.test(src.split("animation: {")[1]?.split("draw(")[0] ?? ""));
  check("every colour is a token, never a literal",
    !/#[0-9a-fA-F]{3,6}\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, " ")));

  /* no tile, note or sentence carries a NaN, anywhere along the rail */
  const bad = (s) => /NaN|undefined|Infinity/.test(String(s));
  const defaults = Object.fromEntries(Object.entries(W.params)
    .filter(([, f]) => f.type !== "section").map(([n, f]) => [n, f.default]));
  const optionsOf = (f) => (f.type === "int" || f.type === "float"
    ? [f.min, f.default, f.max]
    : f.type === "bool" ? [false, true]
      : f.options.map((o) => (typeof o === "string" ? o : o.value)));
  let strings = 0;
  const nans = [];
  for (const [name, field] of Object.entries(W.params)) {
    if (field.type === "section") continue;
    for (const v of optionsOf(field)) {
      const params = { ...defaults, [name]: v };
      const state = W.compute({ params, rng: makeRng(params.seed ?? 1) });
      for (const k of [0, 1, 37, state.cfg.n]) {
        const anim = { k: Math.min(k, state.cfg.n), beat: 0, done: false };
        const say = [
          ...W.readout({ params, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
          W.summary({ params, state, anim }),
          ...W.legend({ params }).map((e) => e.label),
        ];
        strings += say.length;
        for (const s of say) if (bad(s)) nans.push(`${name}=${v} k=${k}: ${s}`);
      }
    }
  }
  check(`no readout, summary or legend string carries a NaN (${strings} strings)`,
    nans.length === 0, nans.slice(0, 3).join(" | "));

  /* the tiles are blank before the first individual and partial during it */
  {
    const params = { ...defaults };
    const state = W.compute({ params, rng: makeRng(1) });
    const empty = W.readout({ params, state, anim: { k: 0 } });
    check("every tile is blank until the first individual lands (2.4)",
      empty.every((t) => t.value === "—"), empty.map((t) => t.value).join(" "));
    const partial = W.readout({ params, state, anim: { k: 40 } });
    check("the tiles read the partial table during the arrival (2.8)",
      partial[1].value.startsWith(`${M.countsAt(state.one, 40)[1]} /`), partial[1].value);
    const full = W.readout({ params, state, anim: { k: state.cfg.n } });
    check("and the finished one at the end",
      full[1].value.startsWith(`${state.one.counts[1]} /`), full[1].value);
    check("the P tile names the threshold it is read against",
      full[3].note === "threshold 10⁻⁶", full[3].note);
  }

  /* the arrival reaches the last individual, in both modes */
  {
    const params = { ...defaults };
    const state = W.compute({ params, rng: makeRng(1) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    check("the sample opens empty (2.1)", anim.k === 0 && anim.done === false);
    anim.mode = "step";
    let more = true;
    let frames = 0;
    while (more && frames < 100) {
      more = W.animation.advance(anim, { dt: 16, params, state });
      frames += 1;
    }
    check("one press of Step adds one unit of individuals",
      anim.k === state.cfg.batch, `${anim.k} after ${frames} frames`);
    check("…and takes the unit's own time, not one frame",
      frames === Math.ceil(M.UNIT_MS / 16), String(frames));
    anim.mode = "run";
    let played = 0;
    while (!anim.done && played < 20000) {
      W.animation.advance(anim, { dt: 16, params, state });
      played += 1;
    }
    check("Play reaches the last individual and stops",
      anim.done && anim.k === state.cfg.n, `${anim.k} of ${state.cfg.n}`);
    /* the pace is a RATE: 65 units of 60 ms is 3.9 s, which is 244 frames of
       16 ms — the number that catches a floor of one unit per frame */
    check("Play keeps the fraction across frames, so a unit is a rate",
      played > 200 && played < 260, `${played} frames`);
  }

  /* a display change keeps the sample; a data change starts it over */
  {
    const params = { ...defaults };
    const state = W.compute({ params, rng: makeRng(1) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k = 120;
    W.animation.rebuild(anim, { params: { ...params, page: "many" }, state });
    check("visiting the 2,000 SNPs keeps the sample", anim.k === 120);
    check("…and takes Step and Play out of the row there (4.5)", anim.inert === true);
    W.animation.rebuild(anim, { params, state });
    check("coming back leaves them where they were", anim.k === 120 && anim.inert === false);
    W.animation.rebuild(anim, { params: { ...params, threshold: "0.05" }, state });
    check("moving the threshold keeps the sample (decision 4)", anim.k === 120);
    const fresh = W.animation.init({ params, state, fromScratch: true });
    check("a data change starts the sample over (invariant 3)", fresh.k === 0);

    /* the authored head starts, first render only */
    const authored = W.animation.init({ params: { ...params, shown: 100 }, state, fromScratch: false });
    check("shown= lands partway in", authored.k === 100, String(authored.k));
    const filled = W.animation.init({ params: { ...params, whole: true }, state, fromScratch: false });
    check("the whole sample lands finished", filled.k === state.cfg.n && filled.done === true);
    const replayed = W.animation.init({ params: { ...params, shown: 100 }, state, fromScratch: true });
    check("and Replay ignores both", replayed.k === 0);
    const clamped = W.animation.init({ params: { ...params, shown: 99999 }, state, fromScratch: false });
    check("a head start past the sample lands on its last individual",
      clamped.k === state.cfg.n, String(clamped.k));
  }

  /* the height the page reserves is the geometry's own */
  check("the widget's height is the layout's",
    W.height({ ...defaults, w: 690 }) === M.layout(690, defaults).height
    && W.height({ ...defaults, view: "sample", w: 690 })
      === M.layout(690, { ...defaults, view: "sample" }).height);

  /* the legend follows the page and the source, so it names what is drawn */
  {
    const one = W.legend({ params: base() }).map((e) => e.label);
    const alone = W.legend({ params: base({ source: "one" }) }).map((e) => e.label);
    const many = W.legend({ params: base({ page: "many" }) }).map((e) => e.label);
    check("the two populations are in the legend only when they are drawn",
      one.some((l) => l.includes("Population 1")) && !alone.some((l) => l.includes("Population 1")));
    check("the Many-SNPs page has its own legend",
      many.some((l) => l.includes("threshold"))
      && !many.some((l) => l.includes("Hardy-Weinberg curve")),
      many.join(" · "));
  }
}

/* --- 9 · what the figure actually paints ----------------------------------
 * The canvas text sweep, run in node: `draw` is handed a context that records
 * every string and every coordinate, and the REAL `makePlot` does the
 * arithmetic. It catches what no assertion above can — a NaN at one end of a
 * slider, a caption that ran off its panel, a mark drawn nowhere — and it is
 * the only check here that sees the picture at all.
 */
{
  const W = await widget();
  /* tokens as plain strings; only the sizes reach the arithmetic */
  const COLORS = Object.fromEntries([
    "surface", "surface2", "ink1", "ink2", "ink3", "grid", "axis", "empirical", "theory",
    "highlight", "reference", "extreme", "groupA", "groupB",
  ].map((k) => [k, `--${k}`]));
  COLORS.font = "system-ui";
  COLORS.fsXs = "11px";
  COLORS.fsSm = "12px";

  function recorder() {
    const painted = [];
    const placed = [];
    const marks = [];
    const noop = () => {};
    const ctx = {
      save: noop, restore: noop, beginPath: noop, closePath: noop, clip: noop,
      moveTo: (x, y) => marks.push([x, y]),
      lineTo: (x, y) => marks.push([x, y]),
      arc: (x, y) => marks.push([x, y]),
      arcTo: (x, y) => marks.push([x, y]),
      rect: (x, y) => marks.push([x, y]),
      fillRect: (x, y, w, h) => marks.push([x, y, w, h]),
      strokeRect: (x, y, w, h) => marks.push([x, y, w, h]),
      stroke: noop, fill: noop, setLineDash: noop, translate: noop, rotate: noop,
      /* a width per character, so the caption's own collision guard is exercised
         rather than short-circuited by a zero */
      measureText: (s) => ({ width: String(s).length * 6 }),
      fillText: (s, x, y) => {
        painted.push(String(s));
        placed.push({ s: String(s), x, y, w: String(s).length * 6, align: ctx.textAlign });
        marks.push([x, y]);
      },
      strokeText: (s, x, y) => { marks.push([x, y]); },
      textAlign: "left",
    };
    return { ctx, painted, placed, marks };
  }

  const widths = [550, 690];
  let painted = 0;
  const badText = [];
  const badMark = [];
  let threw = null;
  for (const page of ["one", "many"]) {
    for (const source of M.SOURCES.map((s) => s.value)) {
      for (const view of ["whole", "sample"]) {
        for (const nKey of ["100", "323", "50000"]) {
          const params = base({ page, source, view, n: nKey });
          const state = W.compute({ params, rng: makeRng(params.seed) });
          for (const k of [0, 1, 37, state.cfg.n]) {
            for (const w of widths) {
              const r = recorder();
              try {
                W.draw({
                  ctx: r.ctx,
                  colors: COLORS,
                  w,
                  h: W.height({ ...params, w }),
                  params,
                  state,
                  anim: { k: Math.min(k, state.cfg.n), beat: 0, done: false },
                });
              } catch (e) {
                threw ??= `${page}/${source}/${view}/${nKey}/k=${k}/w=${w}: ${e.message}`;
                continue;
              }
              painted += r.painted.length;
              for (const s of r.painted) {
                if (/NaN|undefined|Infinity/.test(s)) {
                  badText.push(`${page}/${source}/${nKey}/k=${k}: ${s}`);
                }
              }
              for (const m of r.marks) {
                if (m.some((v) => !Number.isFinite(v))) {
                  badMark.push(`${page}/${source}/${nKey}/k=${k}: [${m.join(", ")}]`);
                }
              }
            }
          }
        }
      }
    }
  }
  check("the figure draws at every setting without throwing", threw === null, threw ?? "");
  check(`no string the figure paints carries a NaN (${painted} strings)`,
    badText.length === 0, badText.slice(0, 3).join(" | "));
  check("every mark lands at a finite coordinate", badMark.length === 0,
    badMark.slice(0, 3).join(" | "));

  /* THE CAPTION AND ITS NOTE NEVER PRINT THROUGH EACH OTHER (decision 9). The
     mock found them doing exactly that at the narrowest canvas, and the halo is
     what hid it: a note strokes the ground before it fills, so a collision
     ERASES the caption underneath and the result still looks like a caption.
     Measured here at a width per character rather than in a browser, so this
     proves the guard runs and takes the right branch, not the exact pixel. */
  {
    const overlaps = [];
    let dropped = 0;
    for (const w of [550, 620, 690, 776]) {
      for (const source of M.SOURCES.map((s) => s.value)) {
        for (const view of ["whole", "sample"]) {
          const params = base({ source, view, n: "50000" });
          const state = W.compute({ params, rng: makeRng(params.seed) });
          const r = recorder();
          W.draw({
            ctx: r.ctx, colors: COLORS, w, h: W.height({ ...params, w }), params, state,
            anim: { k: 12345, beat: 0, done: false },
          });
          const cap = r.placed.find((t) => t.s.includes("individuals,"));
          const note = r.placed.find((t) => t.s.startsWith("frequency of A"));
          if (!cap || !note) {
            overlaps.push(`${w}/${source}/${view}: a line is missing`);
            continue;
          }
          if (Math.abs(cap.y - note.y) > 1) {
            dropped += 1;                               // the note took the row below
            continue;
          }
          const noteLeft = note.align === "right" ? note.x - note.w : note.x;
          if (noteLeft < cap.x + cap.w + 8) {
            overlaps.push(`${w}/${source}/${view}: "${cap.s}" ends at `
              + `${Math.round(cap.x + cap.w)}, the note starts at ${Math.round(noteLeft)}`);
          }
        }
      }
    }
    check("the caption and its note never share a row they do not both fit on",
      overlaps.length === 0, overlaps.slice(0, 2).join(" | "));
    /* and the guard is not vacuous: the long source names at the narrow canvas
       are what it was written for, so some of these must take the second row */
    check("…and the note does take the second row where it has to", dropped > 0,
      `${dropped} of 32 settings`);
  }

  /* the strings the figure paints are the ones it should be painting */
  const paintedAt = (params, k) => {
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const r = recorder();
    W.draw({
      ctx: r.ctx, colors: COLORS, w: 690, h: 400, params, state,
      anim: { k: Math.min(k, state.cfg.n), beat: 0, done: false },
    });
    return r.painted;
  };
  {
    const empty = paintedAt(base(), 0);
    check("the empty figure names its three genotypes at the corners",
      ["AA", "Aa", "aa"].every((g) => empty.includes(g)), empty.join(" · "));
    /* The curve's label goes where no point on the curve falls under the
       text, and at the default (two populations at 0.5 ± 0.25) neither
       shoulder is clear, so the legend carries the name there (read in the
       browser 2026-09-12: on the left shoulder it ran into population 1's
       point). At one population it is drawn, once. */
    check("the empty figure at the default omits the curve label (no shoulder is clear)",
      empty.filter((s) => s === M.STRINGS.curveLabel).length === 0);
    const onePop = paintedAt({ ...base(), source: "one" }, 0);
    check("…and at one population labels the Hardy-Weinberg curve once",
      onePop.filter((s) => s === M.STRINGS.curveLabel).length === 1);
    /* The label is about 0.31 of the triangle's width, so with two
       populations only a wide difference leaves a shoulder clear. */
    const wide = paintedAt({ ...base(), gap: 0.8 }, 0);
    check("…and at a wide difference (0.5 ± 0.4) labels it once, on a clear shoulder",
      wide.filter((s) => s === M.STRINGS.curveLabel).length === 1);
    check("the empty figure counts no individuals yet",
      empty.some((s) => s.startsWith("0 of 323 individuals")),
      empty.find((s) => s.includes("individuals")) ?? "");
    check("…and prints no allele frequency until one arrives",
      !empty.some((s) => s.startsWith("frequency of A")));

    const mid = paintedAt(base(), 40);
    check("the caption counts the individuals so far (2.8)",
      mid.some((s) => s === "40 of 323 individuals, two populations pooled"),
      mid.find((s) => s.includes("individuals")) ?? "");
    check("…and names the allele frequency it is at",
      mid.some((s) => /^frequency of A 0\.\d\d$/.test(s)),
      mid.find((s) => s.startsWith("frequency of A")) ?? "");

    const done = paintedAt(base(), 323);
    check("the finished caption drops the count of what is left",
      done.some((s) => s === "323 individuals, two populations pooled"),
      done.find((s) => s.includes("individuals")) ?? "");
    for (const s of M.SOURCES) {
      const said = paintedAt(base({ source: s.value }), 100);
      check(`the caption says what produced the sample: ${s.caption}`,
        said.some((t) => t.endsWith(s.caption)), said.find((t) => t.includes("individuals")) ?? "");
    }

    const zoom = paintedAt(base({ view: "sample" }), 200);
    check("the detail view carries the axes the whole triangle does not",
      zoom.includes(M.STRINGS.zoomX) && zoom.includes(M.STRINGS.zoomY),
      zoom.join(" · "));
    /* The corners are off the window, so their names go with them — and the
       count is the test, because the bars' own ticks are the same three
       strings. Whole: once at the apex and once under the bars. Detail: the
       bars alone. */
    const apexes = (list) => list.filter((s) => s === "Aa").length;
    check("…and no corner names, because the corners are off the window",
      apexes(zoom) === 1 && apexes(paintedAt(base(), 200)) === 2,
      `${apexes(zoom)} in the window against ${apexes(paintedAt(base(), 200))} in the whole triangle`);

    const many = paintedAt(base({ page: "many" }), 0);
    check("the Many-SNPs caption names the count and the sample size",
      many.some((s) => s === "2,000 SNPs, 323 individuals each"),
      many.find((s) => s.includes("SNPs")) ?? "");
    check("…the threshold's line is labelled with the threshold",
      many.includes("10⁻⁶"), many.join(" · "));
    check("…and the no-deficit line with what it is",
      many.includes(M.STRINGS.noDeficit));
    check("the Many-SNPs page draws no triangle",
      !many.includes("AA") && !many.includes(M.STRINGS.curveLabel));
  }
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
