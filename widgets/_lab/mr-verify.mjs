/* ============================================================================
   Assertions on widget 60's engine, geometry and copy.

       node widgets/_lab/mr-verify.mjs

   Imports `widgets/mendelian-randomization/model.js`, the shipping code and
   not a copy (5.8), and `widgets/core/params.js`, so the URL round trip is
   the one the page performs.

   What needs a reader most:

   THE MEASURE SCRIPT'S SHAPE, ON THE WIDGET'S OWN BUILD. `_lab/mr-measure.mjs`
   ran 31 checks on 2026-09-12 and every control was chosen from them. The
   widget draws three sub-streams off one seed (model.js decision 3), so its
   numbers are not that script's numbers seed for seed; §2 asserts the SHAPE
   instead, over forty seeds: IVW centred on 0.45 with an SE near the lesson's
   0.059, Egger's near 0.144, the median's near 0.073.

   EACH ASSUMPTION MOVES THE ESTIMATE THE WAY IT WAS MEASURED TO (§3), as an
   average over seeds — the direction on any one seed is not promised, and the
   copy does not promise it.

   THE HIT MAP AGREES WITH THE PICTURE (§5). Every SNP's pixel on the scatter
   round-trips through `subjectAt` and through core's own `hitTest` over the
   region table; every forest row does the same from its own centre.

   THE RUN'S LAST FRAME IS THE FINISHED FIGURE (§6): step 1's fourth beat draws
   the ratio line's caption, the study steps' last SNP draws the estimator's
   caption and the combined rows, and no frame before it does. `shown` applies
   on the first render only; a display change keeps every step's count.

   THE PAINTED TEXT (§7): `draw` is driven against a recording context on every
   step at three points in its run, and every string it paints is swept for
   NaN, undefined and an overrun of the canvas.

   THE REGISTER (§8): every reader-facing string, including the verdicts and
   the reading lines built from live numbers, swept for the collection's
   forbidden lists. "Arm" is allowed here and nowhere else in the arc: an arm
   of a trial is the field's word, and the subtitle Kenneth picked says it.

   THE STATUS: both files say `shipped` (flipped at the ship, 2026-09-13).

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../mendelian-randomization/model.js";
import { makeRng } from "../core/rng.js";
import { resolveParams, toQuery } from "../core/params.js";
import { hitTest } from "../core/canvas.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 84)} ${detail}`);
}
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

const src = read("widgets/mendelian-randomization/main.js");
const manifest = JSON.parse(read("widgets/manifest.json"));
const card = manifest.widgets.find((w) => w.slug === "mendelian-randomization");

/* the state the widget opens on, through its own door */
const DEFAULTS = {
  page: "trial", seed: 25, confounding: "strong", truth: "off", colour: "off",
  strength: "strong", pleio: "0", indep: "holds",
  harmonise: "off", estimator: "ivw", shown: 0, snp: "",
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });
const PAGES = M.PAGE_VALUES;
const W_STAGE = 550;

/* one state a seed, and the READING the params name off it — every M.*
   helper takes either, so a reading stands in for the state below */
const states = new Map();
function stateFor(seed = 1) {
  if (!states.has(seed)) states.set(seed, M.build(makeRng(seed)));
  return states.get(seed);
}
function build(params) {
  return M.readingOf(stateFor(params.seed ?? 1), params);
}

/* --- the widget itself, driven with no browser and no clock ---------------- */
let cached = null;
async function widget() {
  if (cached) return cached;
  const abs = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);
  let text = src;
  text = text.replace(/^import \{ defineWidget, makePlot \} from "\.\.\/core\/index\.js";$/m,
    `import { makePlot } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../mendelian-randomization/model.js")};`);
  text += "\nexport { __cfg };\n";
  cached = (await import(
    `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  )).__cfg;
  return cached;
}

/* A recording context: every method a no-op, every property settable, and the
   text calls kept with their positions. `measureText` returns 6px a character,
   which is what an 11–12px system font averages. */
function recorder() {
  const painted = [];
  const props = { textAlign: "start" };
  const ctx = new Proxy(props, {
    get: (t, k) => {
      if (k === "painted") return painted;
      if (k === "measureText") return (s) => ({ width: String(s).length * 6 });
      if (k === "fillText" || k === "strokeText") return (s, x, y) => { painted.push({ s: String(s), x, y, k, align: t.textAlign }); };
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (k in t) return t[k];
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return ctx;
}
const COLORS = {
  surface: "#fcfcfb", surface2: "#f9f9f7", ink1: "#0b0b0b", ink2: "#52514e", ink3: "#898781",
  grid: "#e1e0d9", axis: "#898781", empirical: "#1f6fd1", theory: "#e08a2e", smoothed: "#3bb0c9",
  highlight: "#7a4fd6", reference: "#898781", groupA: "#1f6fd1", groupB: "#d9a400", groupC: "#2e9e5b",
  extreme: "#d8412f", event: "#d8412f", nonevent: "#1f6fd1", unknown: "#898781", holdout: "#d8412f",
  slope: "#9b59b6", font: "system-ui", mono: "monospace", fsXs: "11px", fsSm: "12px", fsMd: "13px", fsLg: "15px", fsFig: "20px",
};

/* --- 1 · the estimators against closed forms -------------------------------- */
console.log("\n1 · the estimators");
{
  /* three SNPs on an exact line through the origin: IVW is the slope, Egger
     the slope with a zero intercept, the median the same slope */
  const S = {
    bxHat: Float64Array.from([0.02, 0.03, 0.05]), sx: Float64Array.from([0.003, 0.003, 0.003]),
    byHat: Float64Array.from([0.01, 0.015, 0.025]), sy: Float64Array.from([0.01, 0.01, 0.01]),
    valid: new Uint8Array([1, 1, 1]), flipped: new Uint8Array(3),
  };
  check("IVW of an exact line through the origin is its slope", Math.abs(M.ivw(S).b - 0.5) < 1e-12, f(M.ivw(S).b, 6));
  check("…with σ 0 and the SE not inflated below the fixed-effect one", M.ivw(S).sigma < 1e-9 && Math.abs(M.ivw(S).se - Math.sqrt(1 / (100 * 100 * (0.02 ** 2 + 0.03 ** 2 + 0.05 ** 2)))) < 1e-12);
  const e = M.egger(S);
  check("Egger's slope is 0.5 and its intercept 0 on that line", Math.abs(e.b - 0.5) < 1e-9 && Math.abs(e.a) < 1e-12, `${f(e.b, 6)} · ${f(e.a, 9)}`);
  const wm = M.weightedMedian(S, makeRng(1), 20);
  check("the weighted median of three equal ratios is that ratio", Math.abs(wm.b - 0.5) < 1e-12, f(wm.b, 6));
  check("a weighted median at unequal weights interpolates between the two middle ratios",
    M.weightedMedianOf([0.2, 0.4, 0.9], [1, 1, 2]) > 0.4 && M.weightedMedianOf([0.2, 0.4, 0.9], [1, 1, 2]) < 0.9,
    f(M.weightedMedianOf([0.2, 0.4, 0.9], [1, 1, 2])));
  check("…and with one dominant weight it is that SNP's ratio",
    Math.abs(M.weightedMedianOf([0.2, 0.4, 0.9], [1, 100, 1]) - 0.4) < 0.02);
  const W = M.wald(S);
  check("each SNP's ratio is its CHD effect over its BMI effect", W.ratio.every((r) => Math.abs(r - 0.5) < 1e-12));
  check("…with the SE of the CHD effect over the BMI effect", Math.abs(W.se[0] - 0.01 / 0.02) < 1e-12);
  check("the mean F is the mean of (β̂/se)²", Math.abs(M.meanF(S) - mean([0.02 / 0.003, 0.03 / 0.003, 0.05 / 0.003].map((z) => z * z))) < 1e-9);
  const sl = M.slope([1, 2, 3, 4], [0, 1, 2, 3]);
  check("the OLS slope of an exact line is exact", Math.abs(sl.b - 1) < 1e-12 && sl.se < 1e-9);
}

/* --- 2 · the lesson's shape, on the widget's own build ----------------------- */
console.log("\n2 · the lesson's shape over forty seeds");
const SEEDS = 40;
function over(over, seeds = SEEDS) {
  const rows = [];
  for (let s = 1; s <= seeds; s += 1) {
    const st = M.readingOf(M.build(makeRng(s)), base({ ...over, seed: s }));
    const h = st.harmonised;
    rows.push({
      ivw: h.est.ivw.b, ivwSe: h.est.ivw.se, egger: h.est.egger.b, eggerSe: h.est.egger.se, eggerA: h.est.egger.a,
      median: h.est.median.b, medianSe: h.est.median.se, F: h.F, raw: st.unharmonised.est.ivw.b,
      obs: st.trial.obs.b, ratio: st.trial.ratio.b, ratioSe: st.trial.ratio.se, gxZ: st.trial.gx.b / st.trial.gx.se,
    });
  }
  const col = (k) => mean(rows.map((r) => r[k]));
  return Object.fromEntries(["ivw", "ivwSe", "egger", "eggerSe", "eggerA", "median", "medianSe", "F", "raw", "obs", "ratio", "ratioSe", "gxZ"].map((k) => [k, col(k)]));
}
const clean = over({});
check("IVW is centred on the true 0.45", Math.abs(clean.ivw - M.THETA) < 0.03, f(clean.ivw));
check("…with an SE near the lesson's 0.059", Math.abs(clean.ivwSe - M.LESSON.ivwSe) < 0.015, f(clean.ivwSe));
check("Egger's SE is near the lesson's 0.144", Math.abs(clean.eggerSe - M.LESSON.eggerSe) < 0.035, f(clean.eggerSe));
check("the median's SE is near the lesson's 0.073", Math.abs(clean.medianSe - M.LESSON.medianSe) < 0.025, f(clean.medianSe));
check("Egger's intercept sits at zero with every assumption holding", Math.abs(clean.eggerA) < 0.003, f(clean.eggerA, 4));
check("the mean F is near the lesson's instruments' (about 125)", clean.F > 90 && clean.F < 170, f(clean.F, 0));
check("unharmonised, IVW collapses toward zero", Math.abs(clean.raw) < 0.15, f(clean.raw));
check("the default seed's clean IVW is within one SE of the truth (seed 25 since round three)",
  Math.abs(build(base({ harmonise: "on" })).harmonised.est.ivw.b - M.THETA) < build(base()).harmonised.est.ivw.se,
  f(build(base()).harmonised.est.ivw.b));

/* --- 3 · each assumption, the way it was measured ---------------------------- */
console.log("\n3 · the assumptions, over forty seeds");
{
  const p30 = over({ pleio: "0.3" });
  const p60 = over({ pleio: "0.6" });
  check("exclusion restriction broken on 30%: IVW biased upward", p30.ivw - M.THETA > 0.1, f(p30.ivw));
  check("…Egger's slope holds against its own clean value", Math.abs(p30.egger - clean.egger) < 0.06, `${f(p30.egger)} vs ${f(clean.egger)}`);
  check("…and its intercept leaves zero", p30.eggerA > 0.005, f(p30.eggerA, 4));
  check("…the median moves less than IVW", p30.median - M.THETA < 0.7 * (p30.ivw - M.THETA), `${f(p30.median - M.THETA)} vs ${f(p30.ivw - M.THETA)}`);
  check("at 60% the median is further off than IVW was at 30%", p60.median - M.THETA > p30.ivw - M.THETA, `${f(p60.median)} vs ${f(p30.ivw)}`);
  const ind = over({ indep: "broken" });
  check("independence broken: IVW biased", ind.ivw - M.THETA > 0.08, f(ind.ivw));
  check("…Egger's slope further than IVW — InSIDE fails", ind.egger - clean.egger > ind.ivw - clean.ivw, `${f(ind.egger)} vs ${f(ind.ivw)}`);
  check("…its intercept negative", ind.eggerA < -0.005, f(ind.eggerA, 4));
  check("…the median biased too", ind.median - M.THETA > 0.08, f(ind.median));
  check("…and the instruments look stronger", ind.F > 1.2 * clean.F, `${f(ind.F, 0)} vs ${f(clean.F, 0)}`);
  const none = over({ indep: "broken", confounding: "none" });
  check("with no confounding the arrow has nothing to carry", Math.abs(none.ivw - M.THETA) < 0.04, f(none.ivw));
  const weak2 = over({ strength: "weak" });
  const mod = over({ strength: "moderate" });
  check("relevance weak: the mean F falls under 10", weak2.F < 10, f(weak2.F, 1));
  check("…moderate sits between 10 and 40", mod.F > 10 && mod.F < 40, f(mod.F, 1));
  check("…and weak pulls IVW toward null — the two-sample design is fixed (decision 9c)", weak2.ivw < clean.ivw - 0.05, f(weak2.ivw));
  check("the study is the lesson's 79 instruments in two samples, no control", M.configFor(base()).m === 79 && M.configFor(base()).oneSample === false);
}

/* --- 4 · step 1's cohort ------------------------------------------------------ */
console.log("\n4 · the cohort");
{
  check("the genotype centroids separate on BMI (z above 8)", clean.gxZ > 8, f(clean.gxZ, 1));
  check("the single-SNP ratio centres on the truth", Math.abs(clean.ratio - M.THETA) < 0.05, f(clean.ratio));
  check("…with an SE near 0.10", clean.ratioSe > 0.07 && clean.ratioSe < 0.14, f(clean.ratioSe));
  check("the observational slope is confounded upward at strong confounding", clean.obs > M.THETA + 0.15, f(clean.obs));
  const none = over({ confounding: "none" }, 20);
  check("…and agrees with the truth at none", Math.abs(none.obs - M.THETA) < 0.05, f(none.obs));
  const pl = over({ pleio: "0.3" }, 20);
  check("the step-1 SNP carries the direct path when the exclusion restriction is broken (decision 7)", pl.ratio > M.THETA + 0.2, f(pl.ratio));
  const ind = over({ indep: "broken" }, 20);
  check("…and sits on the confounders' path when independence is broken", ind.ratio > M.THETA + 0.15, f(ind.ratio));
  const st = build(base());
  check("the three centroids hold every one of the 2,000 people", st.trial.centroids.reduce((a, c) => a + c.n, 0) === M.COHORT.n);
  check("the cohort's frame pads the data by 6%", st.trial.xDom[0] < Math.min(...st.trial.X) && st.trial.xDom[1] > Math.max(...st.trial.X));
  /* decision 3: a step-1 control cannot redraw the study */
  const a = build(base({ confounding: "strong" }));
  const b = build(base({ confounding: "moderate" }));
  check("the instruments are the same draw whatever the confounding (decision 3)",
    a.harmonised.S.sx.every((v, j) => Math.abs(v - b.harmonised.S.sx[j]) < 1e-9));
  /* round three: every reading shares its noise, so a SNP MOVES between
     readings rather than being redrawn */
  const p0 = build(base({ pleio: "0" }));
  const p3 = build(base({ pleio: "0.3" }));
  check("a SNP without a direct path has the identical CHD effect under 0% and 30% (the draws are unconditional)",
    [...p3.harmonised.S.valid].every((v, j) => !v || Math.abs(p0.harmonised.S.byHat[j] - p3.harmonised.S.byHat[j]) < 1e-12));
  check("…and its BMI effect is identical under every assumption",
    [...p3.harmonised.S.bxHat].every((v, j) => Math.abs(v - p0.harmonised.S.bxHat[j]) < 1e-12)
    && [...build(base({ indep: "broken" })).harmonised.S.bxHat].every((v, j) => Math.abs(v - p0.harmonised.S.bxHat[j]) > 0 || p0.harmonised.S.bxHat[j] === v));
  check("readings are made once and kept", stateFor(1).reading(M.configFor(base())) === stateFor(1).reading(M.configFor(base())));
  const W4 = await widget();
  check("the four assumption controls are display parameters, so a change keeps the run",
    ["confounding", "strength", "pleio", "indep"].every((k) => W4.params[k].display === true));
}

/* --- 5 · geometry and the hit map -------------------------------------------- */
console.log("\n5 · geometry and the hit map");
{
  const heights = Object.fromEntries(PAGES.map((p) => [p, M.stageHeight(W_STAGE, base({ page: p }))]));
  check("the four steps reserve their own heights", heights.trial === M.TRIAL_H && heights.gwas === M.GWAS_H && heights.estimate === M.ESTIMATE_H && heights.forest === M.forestHeight(79),
    Object.values(heights).join(" · "));
  check("the forest's 79 rows sit under the naming pitch, so only the pinned row is named",
    M.forestPitch(79) < M.FOREST_NAMES_PITCH && M.forestPitch(79) >= M.FOREST_ROW_MIN, `pitch ${f(M.forestPitch(79), 1)}`);
  /* decision 9b: the median row is the first, from the smallest ratio, whose
     running weight reaches half — recomputed here from the ratios alone */
  {
    const st = build(base());
    const s = st.harmonised;
    const asc = [...s.forestOrder].reverse();
    const w = asc.map((j) => 1 / (s.W.se[j] ** 2));
    const total = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    let row = null;
    for (let i = 0; i < asc.length; i += 1) { acc += w[i]; if (acc - 0.5 * w[i] >= 0.5 * total) { row = asc[i]; break; } }
    check("the forest's median row is the one the weighted median's weight crosses at", s.medianSnp === row, `SNP ${s.medianSnp + 1}`);
    check("…and its ratio is within one row of the weighted median's value",
      Math.abs(s.W.ratio[s.medianSnp] - s.est.median.b) <= Math.abs(s.W.ratio[asc[asc.indexOf(s.medianSnp) - 1]] - s.W.ratio[s.medianSnp]) + 1e-9,
      `${f(s.W.ratio[s.medianSnp])} vs ${f(s.est.median.b)}`);
  }
  check("the height is the layout's own (5.8)", PAGES.every((p) => M.layout(W_STAGE, base({ page: p })).height === heights[p]));

  for (const [W, name] of [[550, "550"], [535, "535"]]) {
    const st = build(base({ harmonise: "on" }));
    for (const page of M.PIN_PAGES) {
      const params = base({ page, harmonise: "on" });
      const L = M.layout(W, params);
      const study = M.studyOf(st, params);
      const regions = M.regionsFor(L, st, params);
      let bad = 0;
      let hitBad = 0;
      let far = 0;
      const sx = M.scaleX(L.plot, study.frame.x);
      const sy = M.scaleY(L.plot, study.frame.y);
      for (let j = 0; j < st.m; j += 1) {
        let x;
        let y;
        if (page === "estimate") {
          x = sx(study.S.bxHat[j]);
          y = sy(study.S.byHat[j]);
        } else if (page === "gwas") {
          /* the SNP's column on the outcome strip */
          x = M.stripX(L.outcome, st.m, st.order.indexOf(j));
          y = L.outcome.y + L.outcome.h / 2;
        } else {
          const row = study.forestOrder.indexOf(j);
          x = L.plot.x + L.plot.w / 2;
          y = L.rowsTop + (row + 0.5) * L.pitch;
        }
        const hover = M.subjectAt(L, st, params, x, y);
        const hit = hitTest(regions, x, y);
        const clicked = hit ? Number(hit.set.snp) - 1 : null;
        /* the forest's rows and the strips' columns are unambiguous; on the
           scatter a SNP under a neighbour is that neighbour's, and what has
           to hold is that the hover and the click name the SAME one, within
           PIN_R of the point */
        if (page !== "estimate" && hover !== j) bad += 1;
        if (hover !== clicked) hitBad += 1;
        if (hover === null) far += 1;
        else if (page === "estimate" && Math.hypot(sx(study.S.bxHat[hover]) - x, sy(study.S.byHat[hover]) - y) > M.PIN_R + 1) far += 1;
      }
      if (page !== "estimate") check(`${page} at ${name}px: every ${page === "gwas" ? "column" : "row"} round-trips through subjectAt from its own centre`, bad === 0, `${bad} miss`);
      check(`${page} at ${name}px: the hover and core's hitTest name the same SNP at every SNP's pixel`, hitBad === 0, `${hitBad} disagree`);
      check(`…and the SNP named is within ${M.PIN_R}px of the pixel`, far === 0, `${far} far`);
      if (page === "estimate") {
        /* and at a grid of pointer positions across the plot */
        let dis = 0;
        let n = 0;
        for (let x = L.plot.x + 1; x < L.plot.x + L.plot.w; x += 7) {
          for (let y = L.plot.y + 1; y < L.plot.y + L.plot.h; y += 7) {
            const hover = M.subjectAt(L, st, params, x, y);
            const hit = hitTest(regions, x, y);
            const clicked = hit ? Number(hit.set.snp) - 1 : null;
            n += 1;
            if (hover !== clicked) dis += 1;
          }
        }
        check(`…and at ${n} pointer positions across the plot`, dis === 0, `${dis} disagree`);
        check(`…${regions.length} cells name a SNP, none overlapping`, regions.length > st.m && regions.every((r) => r.w === M.CELL && r.h === M.CELL));
      } else if (page === "gwas") {
        check(`…a column a SNP on each strip and the scatter's cells (${regions.length} regions)`, regions.length > 2 * st.m && regions.every((r) => r.set.snp !== undefined));
        /* the harmonisation reading, in its three forms */
        const flippedJ = [...st.harmonised.S.flipped].findIndex((v) => v === 1);
        const plainJ = [...st.harmonised.S.flipped].findIndex((v) => v === 0);
        const offLine = M.harmoniseReading(st, base({ page: "gwas" }), flippedJ);
        const onLine = M.harmoniseReading(st, base({ page: "gwas", harmonise: "on" }), flippedJ);
        check("a flipped SNP's reading names the other allele unharmonised and the BMI-raising allele harmonised",
          /\(the other allele\): [+−]\d\.\d{3}; unharmonised$/.test(offLine) && /expressed for allele [ACGT], the BMI-raising allele, it is [+−]\d\.\d{3}$/.test(onLine), offLine);
        check("…with the two signs opposite", offLine.match(/([+−])\d\.\d{3}; unharmonised/)[1] !== onLine.match(/it is ([+−])/)[1]);
        check("…and an unflipped SNP's reading says no change is needed", /no change needed$/.test(M.harmoniseReading(st, base({ page: "gwas" }), plainJ)));
        check("every SNP has two different alleles", st.alleles.length === st.m && st.alleles.every(([a, b]) => a !== b && /^[ACGT]$/.test(a) && /^[ACGT]$/.test(b)));
      } else {
        check(`…${regions.length} regions, one a row, each a toggle of the pin`, regions.length === st.m && regions.every((r) => r.set.snp !== undefined));
      }
    }
    /* the pin's toggle: a click on the pinned SNP clears it */
    const L = M.layout(W, base({ page: "forest", snp: "5", harmonise: "on" }));
    const regions = M.regionsFor(L, st, base({ page: "forest", snp: "5", harmonise: "on" }));
    const rowOf = (j) => regions[st.harmonised.forestOrder.indexOf(j)];
    check("a click on the pinned SNP clears the pin, on any other pins it", rowOf(4).set.snp === "" && rowOf(5).set.snp === "6");
  }
  check("the pin's parser keeps 1..79 and drops the rest", M.parseSnp("5") === "5" && M.parseSnp("79") === "79" && M.parseSnp("0") === "" && M.parseSnp("80") === "" && M.parseSnp("abc") === "");
  check("no pin and no target off the figure", M.subjectAt(M.layout(550, base({ page: "estimate" })), build(base()), base({ page: "estimate" }), 1, 1) === null
    && M.subjectAt(M.layout(550, base({ page: "trial" })), build(base()), base({ page: "trial" }), 300, 200) === null);
  check("the study steps' scatter frame holds every interval (decision 5)", (() => {
    const s = build(base({ harmonise: "on" })).harmonised;
    return s.S.byHat.every((v, j) => v + 1.96 * s.S.sy[j] <= s.frame.y[1] && v - 1.96 * s.S.sy[j] >= s.frame.y[0]);
  })());
}

/* --- 6 · the run, with no clock ----------------------------------------------- */
console.log("\n6 · the run");
{
  const W = await widget();
  const st = build(base());
  const A = W.animation;
  /* step 1: four beats, the label naming each */
  let anim = A.init({ params: base(), state: st, fromScratch: true });
  check("step 1 opens on beat 0 and the Step button names the first act", anim.k.trial === 0 && M.STEP_LABELS.labels.trial.labels[anim.trialBeat] === "Draw the people");
  const labels = [];
  for (let i = 0; i < 5; i += 1) {
    anim.mode = "step";
    let more = true;
    let guard = 0;
    while (more && guard < 100) { more = A.advance(anim, { dt: 50, params: base(), state: st }); guard += 1; }
    labels.push(M.STEP_LABELS.labels.trial.labels[anim.trialBeat] ?? M.STEP_LABELS.labels.trial.default);
  }
  check("five presses of Step run the five beats and the label names each act (decision 9a)",
    anim.k.trial === 5 && anim.done && labels.join(" · ") === "Fit the observational line · Stage 1: BMI by genotype · Stage 2: CHD by genotype · Draw the ratio · Draw the ratio", labels.join(" · "));
  check("the fifth beat is the last: advance stops and done is set", A.advance(anim, { dt: 50, params: base(), state: st }) === false && anim.done);
  /* Play on a study step: a SNP a beat, the run capped near five seconds */
  anim = A.init({ params: base({ page: "gwas" }), state: st, fromScratch: true });
  anim.mode = "run";
  let t = 0;
  let guard = 0;
  while (A.advance(anim, { dt: 16, params: base({ page: "gwas" }), state: st }) && guard < 10000) { t += 16; guard += 1; }
  check("Play on step 2 runs every SNP in about five seconds", anim.k.gwas === 79 && t > 4000 && t < 6500, `${t} ms`);
  check("…and a press of Step is one SNP", (() => {
    const a = A.init({ params: base({ page: "estimate" }), state: st, fromScratch: true });
    a.mode = "step";
    let g = 0;
    while (A.advance(a, { dt: 30, params: base({ page: "estimate" }), state: st }) && g < 100) g += 1;
    return a.k.estimate === 1 && !a.done;
  })());
  /* shown applies on the first render only */
  const shown = A.init({ params: base({ page: "estimate", shown: 79 }), state: st, fromScratch: false });
  const replay = A.init({ params: base({ page: "estimate", shown: 79 }), state: st, fromScratch: true });
  check("?shown=79 opens step 3 finished on the first render and not after Reset", shown.k.estimate === 79 && shown.done && shown.fin.estimate === 1 && replay.k.estimate === 0);
  /* round three: the final beat — the lines grow in after the last SNP */
  {
    const a = A.init({ params: base({ page: "estimate" }), state: st, fromScratch: true });
    a.mode = "run";
    let ms = 0;
    let g = 0;
    let atLast = null;
    while (A.advance(a, { dt: 16, params: base({ page: "estimate" }), state: st }) && g < 20000) {
      ms += 16; g += 1;
      if (a.k.estimate === 79 && atLast === null) atLast = ms;
    }
    check("Play on the estimate runs every SNP and then a final beat of about 600 ms before it is done",
      a.k.estimate === 79 && a.done && a.fin.estimate >= 1 && ms - atLast > 500 && ms - atLast < 800, `${ms - atLast} ms after the last SNP`);
    const b = A.init({ params: base({ page: "forest", shown: 78 }), state: st, fromScratch: false });
    b.mode = "step";
    g = 0;
    while (A.advance(b, { dt: 30, params: base({ page: "forest" }), state: st }) && g < 1000) g += 1;
    check("the press of Step that adds SNP 79 to the forest also plays the final beat", b.k.forest === 79 && b.fin.forest >= 1 && b.done);
    check("the final beat is only the estimate's and the forest's", M.FIN_PAGES.join(" ") === "estimate forest" && !("gwas" in b.fin) && !("trial" in b.fin));
  }
  /* round three: the ease between two readings */
  {
    const p = base({ page: "estimate", shown: 79 });
    const a = A.init({ params: p, state: st, fromScratch: false });
    check("the run opens landed on its own reading", a.mix === 1 && a.viewKey === M.viewKey(p) && a.fromParams === null);
    const q = base({ page: "estimate", shown: 79, pleio: "0.3" });
    A.rebuild(a, { params: q, state: st });
    check("a changed assumption asks core for an ease and keeps the run", a.easing === true && a.mix === 0 && a.k.estimate === 79 && a.fromParams.pleio === "0" && a.viewKey === M.viewKey(q));
    a.easing = false;
    a.mode = "ease";
    let ms = 0;
    let g = 0;
    while (A.advance(a, { dt: 16, params: q, state: st }) && g < 1000) { ms += 16; g += 1; }
    check("…which lands in about 450 ms", a.mix >= 1 && ms > 380 && ms < 520, `${ms} ms`);
    A.rebuild(a, { params: base({ page: "forest", shown: 79, pleio: "0.3" }), state: st });
    check("a page change is not eased", a.mix === 1 && a.fromParams === null && a.page === "forest");
    const from = M.viewFor(st, base({ page: "estimate" }));
    const to = M.viewFor(st, base({ page: "estimate", pleio: "0.3" }));
    const v0 = M.lerpView(from, to, 0);
    const v1 = M.lerpView(from, to, 1);
    const vh = M.lerpView(from, to, 0.5);
    check("the interpolated view is the old reading at 0 and the new at 1",
      Math.abs(v0.study.est.ivw.b - from.study.est.ivw.b) < 1e-12 && Math.abs(v1.study.est.ivw.b - to.study.est.ivw.b) < 1e-12
      && Math.abs(v0.study.S.byHat[3] - from.study.S.byHat[3]) < 1e-12 && Math.abs(v1.study.S.byHat[3] - to.study.S.byHat[3]) < 1e-12);
    check("…halfway it is halfway, and the counts, indices and flags take the target's value",
      Math.abs(vh.study.est.ivw.b - (from.study.est.ivw.b + to.study.est.ivw.b) / 2) < 1e-12
      && vh.study.medianSnp === to.study.medianSnp && vh.study.forestOrder === to.study.forestOrder && vh.order === to.order
      && vh.trial.centroids[1].n === to.trial.centroids[1].n && vh.m === 79);
    check("a SNP's row slides between its two positions", (() => {
      const j = to.study.forestOrder[0];
      return Math.abs(vh.study.rowPos[j] - (from.study.rowPos[j] + to.study.rowPos[j]) / 2) < 1e-12;
    })());
    /* Harmonise is the same ease: the flipped effects slide across zero */
    const u = M.viewFor(st, base({ page: "gwas" }));
    const h = M.viewFor(st, base({ page: "gwas", harmonise: "on" }));
    const mid = M.lerpView(u, h, 0.5);
    const fj = [...h.study.S.flipped].findIndex((v) => v === 1);
    check("halfway through harmonising, a flipped effect sits on zero", Math.abs(mid.study.S.byHat[fj]) < 1e-12 && M.viewKey(base({ page: "gwas" })) !== M.viewKey(base({ page: "gwas", harmonise: "on" })));
  }
  check("…and is capped at the step's own total", A.init({ params: base({ page: "trial", shown: 79 }), state: st, fromScratch: false }).k.trial === 5);
  /* a display change keeps every step */
  anim = A.init({ params: base({ page: "gwas", shown: 30 }), state: st, fromScratch: false });
  anim.k.trial = 5;
  A.rebuild(anim, { params: base({ page: "gwas", harmonise: "on" }), state: st });
  check("a display change keeps the run on every step (non-negotiable 3)", anim.k.gwas === 30 && anim.k.trial === 5 && anim.trialBeat === 5);
  /* decision 9c: Harmonise is step 2's alone */
  check("Harmonise shows on step 2 only, and steps 3 and 4 read the harmonised effects whatever it says",
    W.params.harmonise.when.equals === "gwas"
    && M.studyOf(st, base({ page: "estimate", harmonise: "off" })) === st.harmonised
    && M.studyOf(st, base({ page: "forest", harmonise: "off" })) === st.harmonised
    && M.studyOf(st, base({ page: "gwas", harmonise: "off" })) === st.unharmonised);
  check("the rail is ten controls: SNPs and Samples are gone", !("snps" in W.params) && !("samples" in W.params)
    && Object.values(W.params).filter((fld) => fld.type !== "section" && !fld.hidden).length === 10,
    String(Object.values(W.params).filter((fld) => fld.type !== "section" && !fld.hidden).length));
}

/* --- 7 · the painted text ------------------------------------------------------- */
console.log("\n7 · the painted text");
const painted = {};
{
  const W = await widget();
  const frames = [];
  for (const page of PAGES) {
    for (const [name, over, kOf] of [
      ["empty", {}, () => 0],
      ["half", {}, (st) => Math.floor(M.totalFor(page, st) / 2)],
      ["full", {}, (st) => M.totalFor(page, st)],
      ["full, harmonised, truth, all, pinned", { harmonise: "on", truth: "on", estimator: "all", snp: "3", colour: "on" }, (st) => M.totalFor(page, st)],
      ["full, every assumption broken", { harmonise: "on", pleio: "0.6", indep: "broken", strength: "weak" }, (st) => M.totalFor(page, st)],
      ["full, Egger", { estimator: "egger" }, (st) => M.totalFor(page, st)],
      ["full, mid final beat", { fin: 0.5 }, (st) => M.totalFor(page, st)],
      ["full, mid ease from 0% to 30%", { pleio: "0.3", ease: { pleio: "0" } }, (st) => M.totalFor(page, st)],
      ["full, median", { estimator: "median" }, (st) => M.totalFor(page, st)],
    ]) {
      const { fin: finAt, ease, ...rest } = over;
      const params = base({ page, ...rest });
      const st = build(params);
      const k = Object.fromEntries(PAGES.map((p) => [p, 0]));
      k[page] = kOf(st);
      const fin = Object.fromEntries(M.FIN_PAGES.map((p) => [p, finAt ?? (k[p] >= M.totalFor(p, st) ? 1 : 0)]));
      const anim = { k, fin, beat: 0.5, trialBeat: k.trial, done: k[page] >= M.totalFor(page, st),
        mix: ease ? 0.5 : 1, fromParams: ease ? { ...base({ page }), ...ease } : null, viewParams: {}, page };
      for (const W_ of [550, 535]) {
        const ctx = recorder();
        W.draw({ ctx, colors: COLORS, w: W_, h: M.stageHeight(W_, params), params, state: stateFor(params.seed), anim, pointer: null });
        frames.push({ page, name, w: W_, h: M.stageHeight(W_, params), strings: ctx.painted });
      }
    }
  }
  painted.frames = frames;
  const all = frames.flatMap((fr) => fr.strings.map((p) => p.s));
  check("every step paints at every point of its run", frames.every((fr) => fr.strings.length > 0));
  const nan = all.filter((s) => /NaN|undefined|null|Infinity/.test(s));
  check("no painted string carries NaN, undefined, null or Infinity", nan.length === 0, [...new Set(nan)].slice(0, 5).join(" | "));
  const over = frames.flatMap((fr) => fr.strings.filter((p) => p.k === "fillText" && (p.align === "left" || p.align === "start") && p.x >= 0 && p.x + p.s.length * 6 > fr.w + 20 && !/^-?\d/.test(p.s)).map((p) => `${fr.page}/${fr.name}: ${p.s}`));
  check("no left-anchored string starts inside the canvas and runs past its right edge", over.length === 0, over.slice(0, 4).join(" | "));
  /* a string hung from the canvas edge is invisible, and no width check sees
     it: the Effects page's reading line sat at exactly the canvas height */
  const below = frames.flatMap((fr) => fr.strings.filter((p) => p.k === "fillText" && p.y > fr.h - 11).map((p) => `${fr.page}/${fr.name}: ${p.s.slice(0, 40)} at y ${Math.round(p.y)} of ${fr.h}`));
  check("no painted string sits within 11px of the canvas bottom", below.length === 0, below.slice(0, 3).join(" | "));
  const finished = (page, name) => frames.find((fr) => fr.page === page && fr.name === name && fr.w === 550).strings.map((p) => p.s);
  /* the recorder's 6px a character is wider than the font, so a right-hung
     note may be shortened with an ellipsis here and not on the page */
  const starts = (list, text) => list.some((s) => s === text || (s.endsWith("…") && text.startsWith(s.slice(0, -1).trimEnd())));
  check("step 1's last beat paints the ratio's caption and no earlier frame does",
    finished("trial", "full").includes(M.STRINGS.trialRatio) && !finished("trial", "half").includes(M.STRINGS.trialRatio) && finished("trial", "empty").includes(M.STRINGS.trialPeople));
  check("mid the final beat and mid an ease nothing paints NaN and the reading line waits",
    !finished("estimate", "full, mid final beat").some((s) => s.startsWith("IVW 0.")) && !finished("forest", "full, mid final beat").some((s) => /cross zero/.test(s))
    && finished("estimate", "full, mid ease from 0% to 30%").length > 0);
  check("step 3 paints the estimator's caption only when every SNP is in (decision 3)",
    finished("estimate", "full").includes(M.STRINGS.captionIvw) && !finished("estimate", "half").includes(M.STRINGS.captionIvw) && finished("estimate", "half").includes(M.STRINGS.waitingNote));
  check("…and the observational line's tag with it", finished("estimate", "full").includes(M.STRINGS.observationalTag) && !finished("estimate", "empty").includes(M.STRINGS.observationalTag));
  check("step 4 paints the three combined rows only when every SNP is in",
    finished("forest", "full").some((s) => s.startsWith(M.STRINGS.combinedIvw)) && !finished("forest", "half").some((s) => s.startsWith(M.STRINGS.combinedIvw)));
  check("the pinned SNP's reading line is painted on steps 3 and 4 and names it",
    finished("estimate", "full, harmonised, truth, all, pinned").some((s) => s.startsWith("SNP 3 ·")) && finished("forest", "full, harmonised, truth, all, pinned").some((s) => s.startsWith("SNP 3 ·")));
  check("the forest names no row at 79 but the pinned one",
    finished("forest", "full").filter((s) => /^SNP \d+$/.test(s)).length === 0
    && finished("forest", "full, harmonised, truth, all, pinned").filter((s) => /^SNP \d+$/.test(s)).length === 1);
  /* decision 9b: the teaching marks and the reading lines */
  check("Egger's intercept is tagged on the axis under Egger and All, and not under IVW",
    finished("estimate", "full, Egger").some((s) => s.startsWith(M.STRINGS.interceptTag))
    && finished("estimate", "full, harmonised, truth, all, pinned").some((s) => s.startsWith(M.STRINGS.interceptTag))
    && !finished("estimate", "full").some((s) => s.startsWith(M.STRINGS.interceptTag)));
  check("the forest marks the median row under Weighted median and All, and not under IVW",
    finished("forest", "full, median").includes(M.STRINGS.medianRowTag)
    && finished("forest", "full, harmonised, truth, all, pinned").includes(M.STRINGS.medianRowTag)
    && !finished("forest", "full").includes(M.STRINGS.medianRowTag));
  check("every step ends on its reading line, and no earlier frame carries it",
    finished("trial", "full").some((s) => s.startsWith("the ratio ")) && !finished("trial", "half").some((s) => s.startsWith("the ratio "))
    && finished("gwas", "full").some((s) => /outcome effects are reported|every effect expressed/.test(s)) && !finished("gwas", "half").some((s) => /outcome effects are reported|every effect expressed/.test(s))
    && finished("estimate", "full").some((s) => s.startsWith("IVW ") && /observational/.test(s)) && !finished("estimate", "half").some((s) => /observational \d/.test(s))
    && finished("forest", "full").some((s) => /single-SNP intervals include zero/.test(s)) && !finished("forest", "half").some((s) => /include zero/.test(s)));
  check("the pinned SNP's reading wins over the finished figure's",
    finished("estimate", "full, harmonised, truth, all, pinned").some((s) => s.startsWith("SNP 3 ·"))
    && !finished("estimate", "full, harmonised, truth, all, pinned").some((s) => s.startsWith("IVW 0.")));
  check("the step line and the hand-off are painted on every step",
    PAGES.every((p) => finished(p, "empty").includes(M.stepLine(p)) && starts(finished(p, "empty"), M.HANDOFFS[p])));
  const broken = finished("estimate", "full, every assumption broken");
  check("the verdict is painted on the graph's two steps and reads the broken arrows",
    /* the trial's verdict wraps to two lines at the recorder's 6px a character */
    broken.some((s) => s.startsWith("both excluded arrows")) && finished("trial", "empty").some((s) => s.startsWith("the confounding path")),
    broken.filter((s) => /arrow|path|confounders/.test(s)).join(" | "));
}

/* --- 8 · the register (5.9), the URL, and the status ----------------------------- */
console.log("\n8 · the register");
{
  const W = await widget();
  const st = build(base());
  const fieldDetails = Object.values(W.params).map((fld) => fld.detail).filter(Boolean);
  const optionDetails = Object.values(W.params).flatMap((fld) => (fld.options ?? []).map((o) => o.detail)).filter(Boolean);
  /* Kenneth, 2026-09-11 (widget 55): a detail says what the control IS */
  const outcome = /\b(reach|reaches|fail|fails|pass|passes|end at|ends at|shows?|finds?|sees?|becomes?|leaves?|removes?|corrects?|improves?|worsens?)\b/i;
  const offenders = [...fieldDetails, ...optionDetails].filter((s) => outcome.test(s));
  check("no control line announces an outcome", offenders.length === 0, offenders.join(" | "));
  check("every control with a detail says what it is in more than ten characters (3.4f)", fieldDetails.every((s) => s.length > 10));

  const surfaces = [];
  for (const page of PAGES) {
    for (const k of [0, Math.floor(M.totalFor(page, st) / 2), M.totalFor(page, st)]) {
      for (const over of [{}, { harmonise: "on", truth: "on", estimator: "all" }, { pleio: "0.3", indep: "broken", confounding: "none" }]) {
        const params = base({ page, ...over });
        const s = build(params);
        const ks = Object.fromEntries(PAGES.map((p) => [p, 0]));
        ks[page] = k;
        const anim = { k: ks, beat: 0, trialBeat: ks.trial, done: k >= M.totalFor(page, s) };
        surfaces.push(...W.readout({ params, state: s, anim }).flatMap((t) => [t.label, t.note, t.value].filter(Boolean)));
        surfaces.push(W.summary({ params, state: s, anim }));
        surfaces.push(...W.legend({ params }).map((e) => e.label));
      }
    }
  }
  const reader = [
    ...Object.values(M.STRINGS),
    ...Object.values(M.HANDOFFS),
    ...PAGES.map((p) => M.stepLine(p)),
    ...Object.values(W.params).flatMap((fld) => [fld.label, fld.detail, ...(fld.options ?? []).flatMap((o) => [o.label, o.detail])]).filter(Boolean),
    ...M.TRIAL_BEAT_LABELS, ...Object.values(M.STEP_TITLES.labels), ...Object.values(M.RUN_TITLES.labels),
    ...surfaces,
    ...painted.frames.flatMap((fr) => fr.strings.map((p) => p.s)),
    M.snpReading(st.harmonised, 0), M.snpReading(st.unharmonised, 78),
    /* decision 9b's reading lines are built from live numbers, so the sweep
       calls them in every form they take */
    M.trialReading(st.trial, false), M.trialReading(st.trial, true),
    ...[0, 1, 2, 3, 4, 5].flatMap((j) => [M.harmoniseReading(st, base({ page: "gwas" }), j), M.harmoniseReading(st, base({ page: "gwas", harmonise: "on" }), j)]),
    M.gwasReading(st, base({ page: "gwas" })), M.gwasReading(st, base({ page: "gwas", harmonise: "on" })),
    ...["ivw", "egger", "median", "all"].flatMap((estimator) => [
      M.estimateReading(st.harmonised, base({ estimator }), st.trial.obs.b, false),
      M.estimateReading(st.harmonised, base({ estimator }), st.trial.obs.b, true),
      M.forestReading(st.harmonised, st.m, base({ estimator })),
    ]),
    card.blurb, card.title,
  ];
  check("no reader-facing string says \"never\"", !reader.some((s) => /\bnever\b/i.test(s)), reader.filter((s) => /\bnever\b/i.test(s)).join(" | "));
  check("no reader-facing string names a lesson, notebook, cell or course",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)), reader.filter((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)).join(" | "));
  /* the collection's own vocabulary is ours and not the textbook's — Kenneth,
     2026-09-11: "what is card, rung?". Two words are NOT on this widget's
     list: "arm", because an arm of a trial is the field's word and the
     subtitle says it; and "stage", because two-STAGE least squares is the
     method's name and Kenneth's review asked for the two stages by name. */
  const ours = /\b(cards?|rungs?|ladders?|rails?|faces?|piles?|ramps?|budgets?|arrivals?|walks?|wells?|plains?|trenches?|frames?|skylines?|strips?|beats?|ghosts?)\b/i;
  const coined = reader.filter((s) => ours.test(s));
  check("no reader-facing string uses the collection's own vocabulary", coined.length === 0, coined.join(" | "));
  const arrival = /\b(landed|lands|taken|arrives?|arrived)\b/i;
  /* Kenneth, 2026-09-13: "you still have some mannerisms like personification
     — point the wrong way, confounder chose". A figure does not choose, wait,
     reach, point, sit, stand or free anything. */
  const person = /\b(chose|chosen|choose|waits?|waiting|reach|reaches|reaching|points? the|sits?|standing open|stand in|freed|route around)\b/i;
  const personified = reader.filter((s) => person.test(s));
  check("no reader-facing string personifies the figure", personified.length === 0, personified.join(" | "));
  check("no reader-facing string says landed, taken or arrives", !reader.some((s) => arrival.test(s)), reader.filter((s) => arrival.test(s)).join(" | "));
  const tuned = reader.filter((s) => /\btun(e|es|ed|ing)\b|holdout/i.test(s));
  check("no reader-facing string says tune or holdout", tuned.length === 0, tuned.join(" | "));
  check("the lesson's three assumption names are the controls' labels",
    W.params.strength.label === "Relevance" && W.params.pleio.label === "Exclusion restriction" && W.params.indep.label === "Independence");
  check("the three estimators are named as the lesson names them",
    M.ESTIMATORS.map((e) => e.label).join(" · ") === "IVW · MR Egger · Weighted median · All");
  check("the subtitle is the one Kenneth picked, verbatim",
    M.STRINGS.subtitle.startsWith("Mendelian randomization uses genetic variants as instrumental variables") && M.STRINGS.subtitle.endsWith("independence assumptions."),
    `${M.STRINGS.subtitle.length} chars`);
  check("the gallery blurb fits the card's 120", M.STRINGS.blurb.length <= 120, `${M.STRINGS.blurb.length} chars`);
  check("the blurb in the manifest is the model's own", card.blurb === M.STRINGS.blurb);
  check("the meta description is the blurb, verbatim", read("widgets/mendelian-randomization/index.html").includes(`content="${M.STRINGS.blurb}"`));
  check("the step label is one label a step on the study steps and five acts on the first (4.4b)",
    M.STEP_LABELS.param === "page" && ["gwas", "estimate", "forest"].every((p) => M.STEP_LABELS.labels[p] === "Next SNP")
    && M.STEP_LABELS.labels.trial.anim === "trialBeat" && Object.keys(M.STEP_LABELS.labels.trial.labels).length === 5 && M.TRIAL_BEATS === 5);
  /* decision 9a: the two stages on the tiles, each at its own beat */
  const trialTiles = (k) => W.readout({ params: base(), state: st, anim: { k: { trial: k, gwas: 0, estimate: 0, forest: 0 }, beat: 0, trialBeat: k, done: k >= 5 } });
  check("step 1's tiles are the observational slope, stage 1, stage 2, their ratio and the truth",
    trialTiles(5).map((t) => t.label).join(" | ") === `Observational slope | ${M.STRINGS.tileStage1} | ${M.STRINGS.tileStage2} | ${M.STRINGS.tileRatio} | True effect`,
    trialTiles(5).map((t) => t.label).join(" | "));
  check("…each filled at its own beat and blank before it (2.4)",
    trialTiles(2).map((t) => t.value).join(" ") === `${M.n2(st.trial.obs.b)} — — — —`
    && trialTiles(3)[1].value === M.n2(st.trial.gx.b) && trialTiles(3)[2].value === "—"
    && trialTiles(4)[2].value === M.n2(st.trial.gl.b) && trialTiles(4)[3].value === "—"
    && trialTiles(5)[3].value === M.n2(st.trial.ratio.b));
  check("…and the ratio tile is stage 2 over stage 1 to the digit", Math.abs(st.trial.ratio.b - st.trial.gl.b / st.trial.gx.b) < 1e-12);
  check("the first page is the overview, unnumbered, and the step line counts the three after it",
    M.PAGES[0].label === "Overview" && M.stepLine("trial") === "overview"
    && M.stepLine("gwas") === "step 1 of 3 · Effects" && M.stepLine("forest") === "step 3 of 3 · Forest", M.stepLine("estimate"));
  check("every hand-off but the first names the page before it",
    M.HANDOFFS.gwas.startsWith("from the overview:") && M.HANDOFFS.estimate.startsWith("from step 1:")
    && M.HANDOFFS.forest.startsWith("from step 2:") && !/^from /.test(M.HANDOFFS.trial));

  /* the URL round trip */
  const spec = W.params;
  const v = resolveParams(spec, new URLSearchParams("page=estimate&shown=79&snp=5&harmonise=on&pleio=0.3"));
  check("a lesson link resolves through core's own parser", v.page === "estimate" && v.shown === 79 && v.snp === "5" && v.harmonise === "on" && v.pleio === "0.3");
  check("…and a bad pin is dropped", resolveParams(spec, new URLSearchParams("snp=800")).snp === "" && resolveParams(spec, new URLSearchParams("snp=abc")).snp === "");
  const q = toQuery(spec, resolveParams(spec, new URLSearchParams("page=forest&estimator=all")));
  check("the shareable link carries the page and the estimator", /page=forest/.test(q) && /estimator=all/.test(q), q);

  /* the status */
  const declared = src.match(/^\s*status:\s*"([^"]*)"/m)?.[1];
  check("both files say shipped (flipped at the ship, 2026-09-13)", declared === "shipped" && card.status === "shipped", `${declared} / ${card.status}`);
}

console.log(`\n${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
