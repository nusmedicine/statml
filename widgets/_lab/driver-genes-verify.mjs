/* ============================================================================
   Assertions on widget 69's engine, stage, contract and geometry.

       node widgets/_lab/driver-genes-verify.mjs

   Imports `widgets/driver-genes/model.js` — the shipping code, not a copy
   (5.8) — and drives `main.js` in node by stubbing its one core import, so
   `compute`, `animation`, `readout` and `draw` are the page's own.

   What needs a reader most:

   THE ENGINE IS MAFTOOLS'. `_lab/driver-genes-reference.tsv` holds 360
   synthetic genes scored by maftools 2.26.0's own `get_threshold` and
   `cluster_prot` (`_lab/driver-genes-reference.R`), drawn to reach every
   branch: no cluster, merged residues, widened spans, a residue below the
   threshold inside a cluster, spans that overlap, tied peaks. Every row must
   reproduce. The lesson's own genes were checked the same way against the
   MAF itself (`_lab/driver-genes-measure.mjs`), which the repo does not carry.

   THE STAGE IS CALIBRATED, and a constant moved without the measure would
   leave page 2 drawing a cohort unlike the lesson's. Each driver shape is
   held to its gene, and a cohort to the file's counts.

   THE STEPS. Five presses after the mutations land, in cell 12's order; a gene
   with no cluster ends after the first, and says why.

   THE GEOMETRY. `height` and `draw` share one layout so this script can check
   that nothing is painted outside the canvas, at the narrowest and widest
   side-layout canvases, and that the height does not read the width.

   THE STATUS. The manifest and `main.js` both say `draft`, and this says so.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "../driver-genes/model.js";
import { resolveParams } from "../core/params.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const abs = (rel) => JSON.stringify(pathToFileURL(join(here, rel)).href);

let failed = 0;
let ran = 0;
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(name).padEnd(78)} ${detail}`);
}

/* --- the widget's own config, with core stubbed ------------------------------ */
/* `makePlot` is core's own: it has no imports and needs only a context, so the
   recorder below measures exactly what core draws (a stub of it once drew
   ticks core skips, and reported the widget painting off the canvas). The card
   mounts itself into the page, so node gives it somewhere to mount. */
let cardNode = null;
globalThis.document = {
  createElement: () => ({ className: "", innerHTML: "" }),
  querySelector: () => ({ parentNode: { insertBefore: (node) => { cardNode = node; } } }),
};
const cardText = () => (cardNode ? cardNode.innerHTML.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

let cached = null;
async function widget() {
  if (cached) return cached;
  let text = read("widgets/driver-genes/main.js");
  const coreImport = /^import \{ defineWidget, makePlot, mathmlRenders \} from "\.\.\/core\/index\.js";$/m;
  if (!coreImport.test(text)) throw new Error("main.js's core import changed; update the verify's stub");
  text = text.replace(coreImport,
    `import { makePlot } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => { Object.assign(__cfg, c); return c; };"
    + " const mathmlRenders = () => false;");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m, `import * as M from ${abs("../driver-genes/model.js")};`);
  text += "\nexport { __cfg };\n";
  cached = (await import(`data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`)).__cfg;
  return cached;
}

/** A canvas context that records the extent of everything painted. */
function recorder() {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, bad: false };
  const seen = [];
  const stack = [];
  let tx = 0, ty = 0, rot = 0;
  const mark = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { box.bad = true; return; }
    box.x0 = Math.min(box.x0, x + tx); box.y0 = Math.min(box.y0, y + ty);
    box.x1 = Math.max(box.x1, x + tx); box.y1 = Math.max(box.y1, y + ty);
  };
  const ctx = {
    save() { stack.push([tx, ty, rot, this.textAlign, this.font]); },
    restore() { const s = stack.pop(); if (s) [tx, ty, rot] = s; },
    beginPath() {}, closePath() {}, stroke() {}, fill() {}, setLineDash() {}, clip() {}, scale() {},
    translate(dx, dy) { tx += dx; ty += dy; },
    rotate(r) { rot += r; },
    measureText: (s) => ({ width: String(s).length * 6 }),
    fillRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    strokeRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    clearRect: () => {},
    moveTo: mark, lineTo: mark,
    arc: (x, y, r) => { mark(x - r, y - r); mark(x + r, y + r); },
    fillText(s, x, y) {
      seen.push(String(s));
      const w = String(s).length * 6;
      if (rot) { mark(x - 14, y - w / 2); mark(x + 2, y + w / 2); return; }
      const left = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" ? x - w : x;
      mark(left, y - 11); mark(left + w, y + 3);
    },
    strokeText() {},
    textAlign: "left", textBaseline: "alphabetic", font: "", fillStyle: "", strokeStyle: "", lineWidth: 1,
    globalAlpha: 1, lineJoin: "miter", lineCap: "butt",
  };
  return { ctx, box, seen };
}

const COLORS = Object.fromEntries([
  "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "empirical", "theory",
  "smoothed", "highlight", "reference", "groupA", "groupB", "groupC", "extreme", "unknown",
].map((k) => [k, "#123456"]));
Object.assign(COLORS, { font: "sans-serif", mono: "monospace", fsXs: "11px", fsSm: "13px", fsMd: "15px" });

/* --- 1 · the engine against maftools' own, on the reference ---------------------- */
{
  const lines = read("widgets/_lab/driver-genes-reference.tsv").split("\n")
    .map((l) => l.replace(/\r$/, "")).filter((l) => l && !l.startsWith("#")).slice(1);
  let thOff = 0, nullOff = 0, countOff = 0, worst = 0;
  const reach = { none: 0, ties: 0, widened: 0, inside: 0, overlap: 0, thAbove2: 0 };
  for (const line of lines) {
    const [, L, n, th, clusters, muts, score, positions] = line.split("\t");
    const residues = M.residuesOf(positions.split(",").map((p) => ({ pos: Number(p) })));
    const t = M.threshold(Number(n), Number(L));
    const expectTh = th === "NA" ? NaN : Number(th);
    if (!(t === expectTh || (Number.isNaN(t) && Number.isNaN(expectTh)))) { thOff += 1; continue; }
    if (t > 2) reach.thAbove2 += 1;
    const res = M.clusterGene(residues, t, Number(n));
    if (clusters === "NA") { reach.none += 1; if (res) nullOff += 1; continue; }
    if (!res) { nullOff += 1; continue; }
    if (res.count !== Number(clusters) || res.inClusters !== Number(muts)) countOff += 1;
    worst = Math.max(worst, Math.abs(res.score - Number(score)));
    res.clusters.forEach((c, i) => {
      if (c.peaks.length > 1) reach.ties += 1;
      if (c.start < c.coreStart || c.end > c.coreEnd) reach.widened += 1;
      if (residues.some((r) => r.pos > c.coreStart && r.pos < c.coreEnd && r.N < t)) reach.inside += 1;
      if (i > 0 && c.start <= res.clusters[i - 1].end) reach.overlap += 1;
    });
  }
  check(`the reference holds 360 genes scored by maftools`, lines.length === 360, `${lines.length}`);
  check("every threshold equals get_threshold", thOff === 0, `${thOff} differ`);
  check("a gene returns no cluster exactly where cluster_prot returns NULL", nullOff === 0, `${nullOff} differ; ${reach.none} with none`);
  check("every cluster count and mutations-in-clusters equals maftools'", countOff === 0, `${countOff} differ`);
  check("every score equals maftools' clusterScores", worst < 1e-12, `largest difference ${worst.toExponential(1)}`);
  check("the reference reaches every branch cluster_prot has",
    Object.values(reach).every((v) => v > 0), JSON.stringify(reach));
}

/* --- 2 · the lesson's printed numbers ----------------------------------------- */
{
  /* 01-3 cell 16: z and p for its scores, on the background cell 15 used */
  const rows = [[1, 5.546154, 1.460110e-08], [0.9259259, 4.976353, 3.239667e-07], [0.8043175, 4.040904, 2.662280e-05], [0.8, 4.007692, 3.065747e-05]];
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
  check("cell 16's z-scores are (score − 0.279) / 0.13", rows.every(([s, z]) => rel(M.zOf(s), z) < 1e-6));
  check("cell 16's p-values are 1 − pnorm(z)", rows.every(([s, , p]) => rel(M.upperTail(M.zOf(s)), p) < 1e-5),
    rows.map(([s, , p]) => rel(M.upperTail(M.zOf(s)), p).toExponential(1)).join(" "));
  /* the thresholds the measure traced on the lesson's genes */
  check("PIK3CA's threshold is 3, TP53's 5, GATA3's 3, DPEP1's 2",
    M.threshold(369, 1068) === 3 && M.threshold(348, 393) === 5 && M.threshold(127, 444) === 3 && M.threshold(5, 411) === 2);
  /* p.adjust(c(0.01, 0.04, 0.03, 0.005), "BH") is 0.02 0.04 0.04 0.02 */
  const q = M.benjaminiHochberg([0.01, 0.04, 0.03, 0.005]);
  check("Benjamini-Hochberg matches R's p.adjust", q.map((v) => v.toFixed(6)).join() === "0.020000,0.040000,0.040000,0.020000", q.join(" "));
  const all = M.clusterGene([{ pos: 623, N: 9 }], M.threshold(9, 741), 9);
  check("every mutation at one residue scores 1, whatever the count", all.score === 1
    && M.clusterGene([{ pos: 15, N: 6 }], M.threshold(6, 128), 6).score === 1, "NDUFS1's 9 and RPL22's 6");
}

/* --- 3 · the stage, held to the lesson's file ----------------------------------- */
{
  /* each shape against its gene counted once per tumor (measure §3, §5) */
  const lesson = { PIK3CA: 0.799, AKT1: 0.923, KRAS: 0.833, TP53: 0.556, CDH1: 0.345, GATA3: 0.596, MAP3K1: 0.253, PTEN: 0.501 };
  const { makeRng } = await import("../core/rng.js");
  const far = [];
  for (const [name, target] of Object.entries(lesson)) {
    const scores = [];
    for (let s = 1; s <= 40; s += 1) {
      const r = M.scoreGene(M.drawShaped(M.SHAPES[name], makeRng(3000 + s), { name }));
      if (r.res) scores.push(r.res.score);
    }
    scores.sort((a, b) => a - b);
    const med = scores[scores.length >> 1];
    if (!(Math.abs(med - target) < 0.1)) far.push(`${name} ${med.toFixed(3)} against ${target}`);
  }
  check("each driver shape's median score is within 0.1 of its gene's", far.length === 0, far.join(", "));
  check("the drivers are three oncogenes and six tumor suppressors",
    M.DRIVERS.filter((d) => M.SHAPES[d].kind === "oncogene").length === 3 && M.DRIVERS.filter((d) => M.SHAPES[d].kind === "suppressor").length === 6);

  for (const seed of [1, 2]) {
    const t0 = performance.now();
    const c = M.cohortFor(seed);
    const ms = performance.now() - t0;
    const calledDrivers = c.table.filter((g) => g.called && g.kind !== "passenger").map((g) => g.name);
    check(`seed ${seed}: genes with 5+ mutations within 10% of the file's 4,566`, Math.abs(c.atMin - 4566) / 4566 < 0.1, `${c.atMin} (${ms.toFixed(0)} ms)`);
    check(`seed ${seed}: genes in the table within 20% of the file's 415`, Math.abs(c.table.length - 415) / 415 < 0.2, `${c.table.length}`);
    check(`seed ${seed}: PIK3CA's and AKT1's shapes are called`, calledDrivers.includes("PIK3CA") && calledDrivers.includes("AKT1"), calledDrivers.join(" "));
    check(`seed ${seed}: no tumor suppressor is called but GATA3's shape, which clusters at the C-terminal`,
      calledDrivers.every((d) => M.SHAPES[d].kind === "oncogene" || d === "GATA3"));
  }
  check("the cohort is cached by seed", M.cohortFor(1) === M.cohortFor(1));
  check("page 1's oncogene is page 2's PIK3CA-shaped gene at the same seed",
    M.geneFor("oncogene", 2) === M.cohortFor(2).byName.PIK3CA && M.geneFor("small", 2) === M.cohortFor(2).byName.AKT1);
  check("page 1's passenger is 7 mutations on 749 residues, the same at the same seed",
    M.geneFor("passenger", 3).mutations.length === 7 && M.geneFor("passenger", 3).L === 749
    && JSON.stringify(M.geneFor("passenger", 3).mutations) === JSON.stringify(M.geneFor("passenger", 3).mutations));
}

/* --- 4 · the contract, by name ------------------------------------------------ */
const W = await widget();
{
  const spec = W.params;
  const keys = ["page", "geneSec", "gene", "lookSec", "across", "kinds", "dataSec", "seed", "shown"];
  check("the spec's parameters, in order", Object.keys(spec).join() === keys.join(), Object.keys(spec).join());
  check("page, across and kinds are display; gene and seed are data",
    spec.page.display && spec.across.display && spec.kinds.display && !spec.gene.display && !spec.seed.display);
  check("the gene options are the four kinds, the oncogene first",
    spec.gene.options.map((o) => o.value).join() === "oncogene,suppressor,small,passenger" && spec.gene.default === "oncogene");
  /* the kinds open coloured, Kenneth's call on the draft (2026-09-18) */
  check("the kinds open coloured and the axis on the fraction", spec.kinds.default === true && spec.across.default === "fraction");
  check("shown is hidden and runs 0 to 6", spec.shown.hidden === true && spec.shown.max === 6);
  check("the step label follows the drive's own counter", W.animation.stepLabel.anim === "labelAt"
    && [0, 1, 2, 3, 4, 5].every((k) => typeof W.animation.stepLabel.labels[k] === "string"));
  const manifest = JSON.parse(read("widgets/manifest.json")).widgets.find((w) => w.slug === "driver-genes");
  check("the manifest and main.js both say draft", manifest?.status === "draft" && W.status === "draft");
  check("the blurb is the page's meta description",
    read("widgets/driver-genes/index.html").includes(`content="${manifest.blurb}"`) && manifest.blurb.length <= 120, `${manifest.blurb.length} chars`);
  check("the lab's model re-exports the widget's engine",
    /from "\.\.\/driver-genes\/model\.js"/.test(read("widgets/_lab/driver-genes-model.js")));
}

/* --- 5 · the steps, driven ------------------------------------------------------ */
const defaults = resolveParams(W.params, new URLSearchParams(""));
const paramsOf = (o) => ({ ...defaults, ...o });
function drive(params, mode, { dt = 32, frames = 4000 } = {}) {
  const state = W.compute({ params });
  const anim = W.animation.init({ params, state, fromScratch: true });
  return { state, anim, press: () => { anim.mode = mode; let f = 0; while (W.animation.advance(anim, { dt, params, state }) && f < frames) f += 1; return f; } };
}
{
  const d = drive(paramsOf({ gene: "oncogene" }), "step");
  const seen = [];
  const labels = [];
  for (let i = 0; i < 7; i += 1) {
    labels.push(W.animation.stepLabel.labels[d.anim.labelAt] ?? W.animation.stepLabel.default);
    d.press();
    seen.push(d.anim.stage);
  }
  check("six presses take the oncogene from empty through the five steps", seen.join() === "1,2,3,4,5,6,6", seen.join());
  check("each press is labelled with the step it takes, in cell 12's order",
    labels.slice(0, 6).join(" | ") === Object.values(M.STRINGS.stepLabels).join(" | "), labels.join(" | "));
  check("a finished gene's button names the step it ended on", d.anim.done && d.anim.labelAt === 5);

  /* Play is declined, his call on the draft (2026-09-18): each step is read,
     not watched, and one press takes exactly one of them. */
  check("the page declines Play, and no copy for it is left behind",
    W.animation.runLabel === null && W.animation.runTitle === undefined && M.STRINGS.runTitle === undefined);
  const sup = drive(paramsOf({ gene: "suppressor" }), "step");
  const stages = [];
  for (let i = 0; i < 7; i += 1) { sup.press(); stages.push(sup.anim.stage); }
  check("six presses take the tumor suppressor through every step and stop",
    stages.join() === "1,2,3,4,5,6,6" && sup.anim.done && sup.anim.landed === sup.state.one.n, stages.join());

  const seed = [1, 2, 3, 4, 5, 6].find((s) => !M.analyse(M.geneFor("passenger", s)).res);
  const p = drive(paramsOf({ gene: "passenger", seed }), "step");
  p.press(); p.press(); p.press(); p.press();
  check("a passenger with no cluster ends after the first step, not tested", p.anim.stage === 2 && p.anim.done && p.anim.labelAt === 1,
    `seed ${seed}, stage ${p.anim.stage}`);
  const tiles = W.readout({ params: paramsOf({ gene: "passenger", seed }), state: p.state, anim: p.anim });
  check("its tiles say none, and not in the table", tiles[2].value === "None" && /not in the table/.test(tiles[2].note), tiles[2].note);

  const landing = drive(paramsOf({}), "step");
  landing.anim.mode = "step";
  W.animation.advance(landing.anim, { dt: 32, params: paramsOf({}), state: landing.state });
  check("the first press lands the mutations over time, not at once",
    landing.anim.stage === 1 && landing.anim.landed > 0 && landing.anim.landed < landing.state.one.n, `${landing.anim.landed} after one frame`);

  const authored = paramsOf({ shown: 4 });
  const st = W.compute({ params: authored });
  const a4 = W.animation.init({ params: authored, state: st, fromScratch: false });
  check("?shown=4 opens at step 3 with the mutations in place", a4.stage === 4 && a4.landed === st.one.n);
  const aP = W.animation.init({ params: paramsOf({ shown: 6, gene: "passenger", seed }), state: W.compute({ params: paramsOf({ gene: "passenger", seed }) }), fromScratch: false });
  check("?shown past a gene's last step stops at its last", aP.stage === 2);

  const cohort = paramsOf({ page: "cohort" });
  const sc = W.compute({ params: cohort });
  const ac = W.animation.init({ params: cohort, state: sc, fromScratch: true });
  check("the cohort page has nothing to drive", ac.inert === true);
  const toScore = paramsOf({ page: "cohort", across: "score" });
  W.animation.rebuild(ac, { params: toScore, state: sc });
  check("switching Across on the cohort page asks for an ease", ac.easing === true);
  ac.easing = false;
  ac.mode = "ease";
  let f = 0;
  while (W.animation.advance(ac, { dt: 32, params: toScore, state: sc }) && f < 100) f += 1;
  check("the ease lands on the score", ac.mix === 1, `${f} frames`);
}

/* --- 6 · the geometry, the tiles and the text ------------------------------------ */
{
  const widths = [535, 550, 770];
  const out = [];
  const texts = [];
  let heightsVary = false;
  const readouts = [];
  for (const page of ["gene", "cohort"]) {
    const hs = widths.map((w) => W.height({ w, ...paramsOf({ page }) }));
    if (new Set(hs).size !== 1) heightsVary = true;
  }
  const genes = ["oncogene", "suppressor", "small", "passenger"];
  for (const w of widths) {
    for (const gene of genes) {
      for (const seed of [1, 2]) {
        const params = paramsOf({ gene, seed });
        const state = W.compute({ params });
        const anim = W.animation.init({ params, state, fromScratch: true });
        for (let stage = 0; stage <= 6; stage += 1) {
          anim.stage = Math.min(stage, M.lastStage(state.one));
          anim.landed = anim.stage >= 1 ? state.one.n : 0;
          anim.done = anim.stage >= M.lastStage(state.one);
          anim.labelAt = M.labelStage(anim);
          const h = W.height({ w, ...params });
          const { ctx, box, seen } = recorder();
          W.draw({ ctx, colors: COLORS, w, h, params, state, anim });
          texts.push(...seen, cardText());
          if (box.bad || box.x0 < 0 || box.y0 < 0 || box.x1 > w || box.y1 > h) {
            out.push(`${gene} seed ${seed} stage ${anim.stage} at ${w}: [${box.x0.toFixed(0)}, ${box.y0.toFixed(0)}]–[${box.x1.toFixed(0)}, ${box.y1.toFixed(0)}] in ${w}×${h}`);
          }
          readouts.push(...W.readout({ params, state, anim }), { label: "summary", value: W.summary({ params, state, anim }), note: "" });
        }
      }
    }
    for (const kinds of [false, true]) {
      for (const across of ["fraction", "score"]) {
        const params = paramsOf({ page: "cohort", kinds, across });
        const state = W.compute({ params });
        const anim = W.animation.init({ params, state, fromScratch: true });
        const h = W.height({ w, ...params });
        const { ctx, box, seen } = recorder();
        W.draw({ ctx, colors: COLORS, w, h, params, state, anim });
        texts.push(...seen, cardText());
        if (box.bad || box.x0 < 0 || box.y0 < 0 || box.x1 > w || box.y1 > h) {
          out.push(`cohort kinds ${kinds} ${across} at ${w}: [${box.x0.toFixed(0)}, ${box.y0.toFixed(0)}]–[${box.x1.toFixed(0)}, ${box.y1.toFixed(0)}] in ${w}×${h}`);
        }
        readouts.push(...W.readout({ params, state, anim }), { label: "summary", value: W.summary({ params, state, anim }), note: "" });
      }
    }
  }
  check("the height does not read the width, on either page", !heightsVary);
  check("nothing is painted outside the canvas, at 535, 550 and 770", out.length === 0, out.slice(0, 3).join(" | "));
  const badText = texts.filter((s) => /NaN|undefined|Infinity|\[object/.test(s));
  check(`${texts.length} painted and card strings carry no NaN or undefined`, badText.length === 0, badText.slice(0, 2).join(" | "));
  const badTiles = readouts.filter((r) => /NaN|undefined|Infinity/.test(`${r.label} ${r.value} ${r.note}`));
  check(`${readouts.length} tiles and summaries carry no NaN or undefined`, badTiles.length === 0, badTiles.slice(0, 2).map((r) => `${r.label}: ${r.value}`).join(" | "));

  /* 2.4: a number waits for its step */
  const params = paramsOf({});
  const state = W.compute({ params });
  const anim = W.animation.init({ params, state, fromScratch: true });
  const empty = W.readout({ params, state, anim });
  check("before any press, every tile is empty", empty.every((t) => t.value === "—"), empty.map((t) => t.value).join(" "));
  anim.stage = 4; anim.landed = state.one.n; anim.done = false;
  const at4 = W.readout({ params, state, anim });
  check("the gene's score waits for its own step", at4[3].value === "—" && at4[2].value !== "—");

  /* the card's threshold row prints a digit for every probability it states */
  const zeros = texts.filter((s) => /= 0\.0000\b/.test(s));
  check("the card prints no probability as 0.0000", zeros.length === 0, zeros[0]?.slice(0, 80));
}

/* --- 7 · page 2's names, clear of the points ------------------------------------
   Kenneth, 2026-09-18: "fix the oncogene label overlap". The placement checked
   only other names, and "Oncogene" printed through the ring of the called
   passenger beside it. The drawing and this check read one geometry
   (`cohortMarks`, `labelPlacements`) on core's own plot scales, over seeds,
   the narrowest and widest canvases, and both ends of the Across ease. The
   measure is 6px a character, wider than the canvas's, so a clear box here is
   clear on the page. */
{
  const { makePlot } = await import("../core/canvas.js");
  const bad = [];
  let named = 0;
  for (let seed = 1; seed <= 8; seed += 1) {
    const c = M.cohortFor(seed);
    for (const w of [535, 770]) {
      const L = M.layout(w, paramsOf({ page: "cohort" }));
      const plot = makePlot({ ctx: recorder().ctx, colors: COLORS, rect: L.plot, xDomain: [0, 1], yDomain: [0, M.cohortTop(c.table)] });
      for (const mix of [0, 0.5, 1]) {
        const marks = M.cohortMarks(c.table, plot.sx, plot.sy, mix);
        const placements = M.labelPlacements(marks, M.namedGenes(c), L.plot, (s) => s.length * 6);
        named += placements.length;
        for (const p of placements) {
          if (p.overPoints || p.overNames || p.outside) {
            bad.push(`seed ${seed} at ${w}, across ${mix}: "${p.text}" over ${p.overPoints} point(s), ${p.overNames} name(s)${p.outside ? ", outside" : ""}`);
          }
        }
        if (placements.length !== M.namedGenes(c).length) bad.push(`seed ${seed} at ${w}: a name was not placed`);
      }
    }
  }
  check(`${named} names on page 2 clear every point, ring and other name`, bad.length === 0, bad.slice(0, 3).join(" | "));
}

/* --- 8 · the copy, against the words this collection has struck ----------------- */
{
  const src = [read("widgets/driver-genes/main.js"), read("widgets/driver-genes/model.js")]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
    .map((m) => m[2].replace(/\$\{[^}]*\}/g, " "))
    .filter((t) => /[a-z]{3}/i.test(t) && !/^<|var\(--|^\([a-z-]+:/.test(t) && t.trim().length >= 12);
  const struck = [
    ["a physical verb for a value", /\b(sits?|sitting|sat|lies|lying|falls?|falling|fell|walks?|walking|lands?|landing)\b/i],
    ["a model acting", /\b(keeps?|wants?|thinks?|believes?|decides?|chooses?|chose|knows?|tries|refuses?|prefers?|gathers?)\b/i],
    ["our own shorthand", /\b(cut|card|rung|trench|the plain|hit once)\b/i],
    ["a lesson reference", /\b(notebook|lesson|cell \d|chapter)\b/i],
    ["the other spelling", /\btumour/i],
    ["the reader addressed", /\b(you|your|yours)\b/i],
  ];
  const hits = [];
  for (const t of strings) for (const [why, re] of struck) if (re.test(t)) hits.push(`${why}: "${t.slice(0, 56)}"`);
  check(`${strings.length} reader-facing strings carry no struck word`, hits.length === 0, hits.join(" | "));

  /* a control's detail says what it IS, never what will happen (widget 55) */
  const details = [M.STRINGS.pageDetail, M.STRINGS.geneDetail, M.STRINGS.acrossDetail, M.STRINGS.kindsDetail, M.STRINGS.seedDetail];
  const outcome = /\b(is called|are called|not called|detects?|misses|reaches|ranks?|scores? (higher|lower|above|below))\b/i;
  check("no control detail announces an outcome", !details.some((s) => outcome.test(s)), details.filter((s) => outcome.test(s)).join(" | "));
}

console.log(`\n${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
