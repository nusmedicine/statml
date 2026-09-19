/* ============================================================================
   Assertions on widget 70's engine, stage, contract and geometry.

       node widgets/_lab/mutational-signatures-verify.mjs

   Imports `widgets/mutational-signatures/model.js` — the shipping code, not a
   copy (5.8) — and drives `main.js` in node by stubbing its one core import,
   so `compute`, `animation`, `readout` and `draw` are the page's own.

   What needs a reader most:

   THE ENGINE IS NMF'S BRUNET. `_lab/mutational-signatures-reference.tsv` holds
   a synthetic 96 × 24 matrix from the widget's own cohort, a fixed start, and
   what R's NMF 0.28 returns after exactly 200 brunet iterations from it
   (`_lab/mutational-signatures-reference.R`). Widget 41's `updateKL` with
   brunet's floor must land on the same W and H. The lesson's own run (cells
   21, 24, 30) was reproduced against the MAF itself
   (`_lab/mutational-signatures-nmf.R`), which the repo does not carry.

   THE PAGE'S CLAIMS AT ITS DEFAULT SEED, which its captions and tiles print:
   one signature is the hypermutated tumor's own, the flat signature is named
   after the process that built less of it, APOBEC is named by its C>T
   outcome, and page 1's largest tumor is the APOBEC signature's largest
   holder.

   THE GEOMETRY. `height` and `draw` share one layout, so this script checks
   that nothing is painted outside the canvas on every page, at every stage and
   halfway through every press, at the narrowest and widest side-layout
   canvases, and that the height does not read the width.

   THE PRESSES THAT OPEN THE SIGNATURES (rounds 1 and 2): each starts on the
   last one's final frame op for op, one column leaves S at a time, and — his
   ask of round 2 — nothing moves over a finished signature, swept every 5 ms
   as rotated rectangles at three widths and ranks 2 to 6.

   ROUND 3: page 3's comparison is a scan of the chosen row and its numbers
   wait for the scan; a later click eases the panel, starting and ending on
   the exact frames either side of it; page 1's square stands clear of the
   bars, whose stage-1 labels still clear each other at 535px.

   THE STATUS. The manifest and `main.js` both say `draft`, and this says so.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "../mutational-signatures/model.js";
import { resolveParams, optionKeys } from "../core/params.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const abs = (rel) => JSON.stringify(pathToFileURL(join(here, rel)).href);

let failed = 0;
let ran = 0;
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(name).padEnd(84)} ${detail}`);
}

/* --- the widget's own config, with core stubbed ------------------------------ */
let cardNode = null;
globalThis.document = {
  createElement: () => ({ className: "", innerHTML: "", hidden: false }),
  querySelector: () => ({ parentNode: { insertBefore: (node) => { cardNode = node; } } }),
};
const cardText = () => (cardNode && !cardNode.hidden ? cardNode.innerHTML.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

async function widget() {
  let text = read("widgets/mutational-signatures/main.js");
  const coreImport = /^import \{ defineWidget, mathmlRenders \} from "\.\.\/core\/index\.js";$/m;
  if (!coreImport.test(text)) throw new Error("main.js's core import changed; update the verify's stub");
  text = text.replace(coreImport,
    "const __cfg = {}; const defineWidget = (c) => { Object.assign(__cfg, c); return c; }; const mathmlRenders = () => false;");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m, `import * as M from ${abs("../mutational-signatures/model.js")};`);
  text += "\nexport { __cfg };\n";
  return (await import(`data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`)).__cfg;
}

/** A canvas context that records the extent of everything painted, through a
    full affine transform, so page 3's names set on end are measured where
    they are drawn. Text is 6px a character, wider than the canvas's own. */
function recorder({ record = false } = {}) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, bad: false };
  const seen = [];
  /* every mark with its corners through the transform, its colour and its
     alpha, so two frames can be compared op for op; and every colour used */
  const ops = [];
  const styles = new Set();
  const stack = [];
  let T = [1, 0, 0, 1, 0, 0];
  const apply = (x, y) => [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]];
  const mark = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { box.bad = true; return; }
    const [px, py] = apply(x, y);
    box.x0 = Math.min(box.x0, px); box.y0 = Math.min(box.y0, py);
    box.x1 = Math.max(box.x1, px); box.y1 = Math.max(box.y1, py);
  };
  const log = (kind, style, alpha, pts) => record && ops.push(`${kind} ${style} ${alpha.toFixed(4)} ${pts.map(([x, y]) => apply(x, y).map((v) => v.toFixed(4)).join(",")).join(" ")}`);
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const ctx = {
    save() { stack.push({ T: T.slice(), a: this.globalAlpha, f: this.fillStyle, s: this.strokeStyle, lw: this.lineWidth }); },
    restore() {
      const s = stack.pop();
      if (s) { T = s.T; this.globalAlpha = s.a; this.fillStyle = s.f; this.strokeStyle = s.s; this.lineWidth = s.lw; }
    },
    translate(dx, dy) { T = mul(T, [1, 0, 0, 1, dx, dy]); },
    scale(x, y) { T = mul(T, [x, 0, 0, y, 0, 0]); },
    rotate(r) { T = mul(T, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]); },
    beginPath() {}, closePath() {}, setLineDash() {}, clip() {}, rect() {},
    stroke() { styles.add(this.strokeStyle); },
    fill() { styles.add(this.fillStyle); },
    measureText: (s) => ({ width: String(s).length * 6 }),
    fillRect(x, y, w, h) {
      mark(x, y); mark(x + w, y + h); mark(x + w, y); mark(x, y + h);
      styles.add(this.fillStyle);
      log("F", this.fillStyle, this.globalAlpha, [[x, y], [x + w, y + h]]);
    },
    strokeRect(x, y, w, h) {
      mark(x, y); mark(x + w, y + h);
      styles.add(this.strokeStyle);
      log("S", this.strokeStyle, this.globalAlpha, [[x, y], [x + w, y + h]]);
    },
    clearRect: () => {},
    moveTo: mark, lineTo: mark,
    arc: (x, y, r) => { mark(x - r, y - r); mark(x + r, y + r); },
    fillText(s, x, y) {
      seen.push(String(s));
      styles.add(this.fillStyle);
      const w = String(s).length * 6;
      const left = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" ? x - w : x;
      mark(left, y - 11); mark(left + w, y + 3); mark(left, y + 3); mark(left + w, y - 11);
      log(`T ${s}`, this.fillStyle, this.globalAlpha, [[x, y]]);
    },
    strokeText() {},
    textAlign: "left", textBaseline: "alphabetic", font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  };
  return { ctx, box, seen, ops, styles };
}

/* Distinct stand-ins for the two violets, so a use of either can be found. */
const COLORS = Object.fromEntries([
  "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "highlight", "reference", "magnitude",
].map((k) => [k, "#123456"]));
Object.assign(COLORS, { highlight: "#aa00aa", magnitude: "#5500ff",
  subs: ["#101010", "#202020", "#303030", "#404040", "#505050", "#606060"],
  font: "sans-serif", mono: "monospace", fsXs: "11px", fsSm: "13px", fsMd: "15px" });

/* --- 1 · the engine against R's NMF, from one start ----------------------------- */
console.log("§1 the engine against R's NMF 0.28 brunet");
{
  const lines = read("widgets/_lab/mutational-signatures-reference.tsv").split("\n")
    .map((l) => l.replace(/\r$/, "")).filter((l) => l && !l.startsWith("#")).slice(1);
  const B = {};
  for (const l of lines) {
    const [b, i, j, v] = l.split("\t");
    (B[b] ??= [])[+i - 1] ??= [];
    B[b][+i - 1][+j - 1] = +v;
  }
  const r = B.W0[0].length;
  const V = B.V.map((row) => Float64Array.from(row, (x) => x + M.P_CONSTANT));
  const W = B.W0.map((row) => Float64Array.from(row));
  const H = B.H0.map((row) => Float64Array.from(row));
  const kls = [M.klDivergence(V, W, H)];
  for (let i = 1; i <= 200; i += 1) { M.brunetStep(V, W, H, r, i); kls.push(M.klDivergence(V, W, H)); }
  let worst = 0;
  const cmp = (A, R) => A.forEach((row, i) => row.forEach((x, j) => {
    if (Math.abs(R[i][j]) > 1e-8) worst = Math.max(worst, Math.abs(x - R[i][j]) / Math.abs(R[i][j]));
  }));
  cmp(W, B.W);
  cmp(H, B.H);
  check("200 iterations from the reference's start land on NMF's own W and H", worst < 1e-6, `largest relative difference ${worst.toExponential(1)}`);
  check("the KL divergence never rises over those 200 iterations", kls.every((d, i) => i === 0 || d <= kls[i - 1] + 1e-9),
    `${kls[0].toFixed(1)} → ${kls[200].toFixed(1)}`);
  check("the reference is synthetic: 96 × 24 counts, the widget's own cohort at seed 1",
    B.V.length === 96 && B.V[0].length === 24 && B.V.every((row, i) => row.every((v, j) => v === M.cohortFor(1).M[i][j])));
}

/* --- 2 · the stage ------------------------------------------------------------- */
console.log("\n§2 the stage");
{
  check("96 types in maftools' order", M.CHANNELS.length === 96 && M.CHANNELS[0] === "A[C>A]A" && M.CHANNELS[16] === "A[C>G]A"
    && M.CHANNELS[95] === "T[T>G]T" && M.CHANNELS[34] === "A[C>T]G");
  const g = M.channelOf("AGC", "G", "A");
  check("a G>A in AGC is read as C>T in GCT, type G[C>T]T", M.CHANNELS[g.index] === "G[C>T]T" && g.swapped);
  const t = M.channelOf("TCA", "C", "T");
  check("a C>T in TCA stays as written, type T[C>T]A", M.CHANNELS[t.index] === "T[C>T]A" && !t.swapped);
  check("every reference is a profile: 96 non-negative values summing to one",
    M.REFERENCES.every((r) => r.profile.length === 96 && r.profile.every((x) => x >= 0) && Math.abs(M.sum(r.profile) - 1) < 1e-12));
  const c = (a, b) => M.cosine(M.REF[a].profile, M.REF[b].profile);
  const flats = [c("clock", "hr"), c("clock", "flat"), c("hr", "flat")];
  check("the three flat references sit 0.7 to 0.9 apart, as COSMIC's three do", flats.every((x) => x > 0.7 && x < 0.9), flats.map((x) => x.toFixed(3)).join(" "));
  check("deamination at CpG and mismatch repair sit 0.7 to 0.9 apart", c("cpg", "mmr") > 0.7 && c("cpg", "mmr") < 0.9, c("cpg", "mmr").toFixed(3));
  check("the two APOBEC references share almost nothing", c("apobecT", "apobecG") < 0.1, c("apobecT", "apobecG").toFixed(3));
  const counts = [];
  for (let seed = 1; seed <= 10; seed += 1) counts.push(...M.cohortFor(seed).counts.slice(0, M.TUMORS));
  counts.sort((a, b) => a - b);
  const median = counts[counts.length >> 1];
  check("the cohort's median tumor has within 20% of the lesson's 42 substitutions", Math.abs(median / 42 - 1) < 0.2, `${median} over ten seeds`);
  const co = M.cohortFor(1);
  const share = co.counts[co.hyperIndex] / M.sum(co.counts);
  check("the hypermutated tumor holds TCGA-AN-A046's share of the mutations", Math.abs(share - M.LESSON_HYPER_SHARE) < 0.01, `${(100 * share).toFixed(1)}%`);
  check("the cohort, the extraction and page 1's tumors are cached", M.cohortFor(1) === M.cohortFor(1)
    && M.fitFor(1, "in", 4) === M.fitFor(1, "in", 4) && M.tumorFor(1, "largest") === M.tumorFor(1, "largest"));
}

/* --- 3 · what the page prints at its default ------------------------------------- */
console.log("\n§3 the page's claims at seed 1, rank 4");
{
  const co = M.cohortFor(1);
  const fit = M.fitFor(1, "in", 4);
  const own = fit.sigs.findIndex((s) => s.own);
  check("one signature is the hypermutated tumor's own profile, and it alone holds half of it",
    own >= 0 && fit.sigs[own].hold.half === 1 && fit.sigs[own].hold.top === co.hyperIndex,
    own >= 0 ? `signature ${own + 1}, ${M.pct(fit.sigs[own].hold.topShare)}` : "none");
  check("its best match is polymerase epsilon", own >= 0 && fit.sigs[own].match[0].key === "pole", own >= 0 ? M.cos3(fit.sigs[own].match[0].cos) : "");
  const out = M.fitFor(1, "out", 4);
  const hyperCol = co.M.map((row) => row[co.hyperIndex]);
  const closest = Math.max(...out.sigs.map((s) => M.cosine(s.profile, hyperCol)));
  check("left out, no signature comes within cosine 0.6 of that tumor", closest < 0.6, M.cos3(closest));
  const flat = [...fit.sigs].sort((a, b) => (b.mix[1] + b.mix[3]) - (a.mix[1] + a.mix[3]))[0];
  check("the flat signature is named after the process that built less of it",
    flat.match[0].key === (flat.mix[1] < flat.mix[3] ? "clock" : "hr") && ["clock", "hr"].includes(flat.match[1].key),
    `${flat.match[0].name} ${M.cos3(flat.match[0].cos)} over ${flat.match[1].name} ${M.cos3(flat.match[1].cos)}; built ${M.builtText(flat.mix)}`);
  const apo = [...fit.sigs].sort((a, b) => b.mix[2] - a.mix[2])[0];
  check("the APOBEC signature is named C>T, with C>G second", apo.match[0].key === "apobecT" && apo.match[1].key === "apobecG");
  const big = M.tumorFor(1, "largest");
  check("page 1's largest tumor is the APOBEC signature's largest holder", apo.hold.top === big.index, `tumor ${big.index + 1}, ${M.pct(apo.exposure[big.index] / apo.total)}`);
  check("page 1's two tumors are column 101 and the largest of the other 100",
    M.tumorFor(1, "hypermutated").index === co.hyperIndex && big.index === co.largest && co.counts[big.index] === Math.max(...co.counts.slice(0, M.TUMORS)));
  const t = M.tumorFor(1, "hypermutated");
  check("page 1's mutations are the tumor's column, each written from one strand", M.sum(t.counts) === t.n
    && t.mutations.every((m) => m.written === (m.purine ? M.PURINE_FORM[m.cls] : m.cls)), `${t.n} substitutions`);
  const pur = t.mutations.filter((m) => m.purine).length / t.n;
  check("about half are written from a purine, as in the lesson's file", Math.abs(pur - 0.5) < 0.05, M.pct(pur));
}

/* --- 4 · the contract, by name -------------------------------------------------- */
console.log("\n§4 the contract");
const W = await widget();
{
  const spec = W.params;
  const keys = ["page", "tumorSec", "tumor", "cohortSec", "hypermutated", "rank", "lookSec", "signature", "dataSec", "seed", "truth", "shown"];
  check("the spec's parameters, in order", Object.keys(spec).join() === keys.join(), Object.keys(spec).join());
  check("page, tumor, signature and truth are display; hypermutated, rank and seed are data",
    spec.page.display && spec.tumor.display && spec.signature.display && spec.truth.display
    && !spec.hypermutated.display && !spec.rank.display && !spec.seed.display);
  check("the cohort opens with the hypermutated tumor in, at rank 4, truth on",
    spec.hypermutated.default === "in" && spec.rank.default === 4 && spec.truth.default === "1");
  check("the signature control offers one button a signature, following the rank",
    optionKeys(spec.signature, { rank: 6 }).join() === "1,2,3,4,5,6" && optionKeys(spec.signature, { rank: 2 }).join() === "1,2");
  check("shown is hidden and runs 0 to 3", spec.shown.hidden === true && spec.shown.max === 3);
  const labels = W.animation.stepLabel.labels;
  check("the step label follows the drive's own counter, a label for every press",
    W.animation.stepLabel.anim === "labelAt" && ["k0", "k1", "k2", "s0", "s1", "mX", "m0"].every((k) => typeof labels[k] === "string"));
  check("the page declines Play", W.animation.runLabel === null);
  const manifest = JSON.parse(read("widgets/manifest.json")).widgets.find((w) => w.slug === "mutational-signatures");
  check("the manifest and main.js both say draft", manifest?.status === "draft" && W.status === "draft");
  check("the blurb is the page's meta description",
    read("widgets/mutational-signatures/index.html").includes(`content="${manifest.blurb}"`) && manifest.blurb.length <= 120, `${manifest.blurb.length} chars`);
  check("the lab's model re-exports the widget's", /from "\.\.\/mutational-signatures\/model\.js"/.test(read("widgets/_lab/mutational-signatures-model.js")));
}

/* --- 5 · the presses, driven ------------------------------------------------------ */
console.log("\n§5 the presses");
const defaults = resolveParams(W.params, new URLSearchParams(""));
const paramsOf = (o) => ({ ...defaults, ...o });
function press(anim, params, state, { dt = 32, frames = 6000 } = {}) {
  anim.mode = "step";
  let f = 0;
  while (W.animation.advance(anim, { dt, params, state }) && f < frames) f += 1;
  return f;
}
{
  const p1 = paramsOf({});
  const s1 = W.compute({ params: p1 });
  const a1 = W.animation.init({ params: p1, state: s1, fromScratch: true });
  check("page 1 opens empty: no mutation added", a1.cat === 0 && a1.landed === 0 && a1.done === false);
  check("page 1 draws no extraction, so it runs none", s1.fit === null);
  const seen = [], labels = [], frames = [];
  for (let i = 0; i < 4; i += 1) {
    labels.push(a1.labelAt);
    frames.push(press(a1, p1, s1));
    seen.push(a1.cat);
  }
  check("three presses: the mutations, the pyrimidine, the neighbours; then done", seen.join() === "1,2,3,3" && a1.done, seen.join());
  check("each press is labelled with the step it takes", labels.slice(0, 3).join() === "k0,k1,k2" && a1.labelAt === "k2", labels.join());
  check("the arrival, the fold and the split each take frames", frames[0] > 4 && frames[1] > 4 && frames[2] > 4 && frames[3] === 0, frames.join());

  const p2 = paramsOf({ page: "signatures" });
  const s2 = W.compute({ params: p2 });
  const a2 = W.animation.init({ params: p2, state: s2, fromScratch: true });
  const seen2 = [], labels2 = [], frames2 = [];
  for (let i = 0; i < 4; i += 1) { labels2.push(a2.labelAt); frames2.push(press(a2, p2, s2)); seen2.push(a2.sig); }
  check("page 2: Extract, the signatures beside W, then each opened out; then done", seen2.join() === "1,2,3,3" && a2.done, seen2.join());
  check("page 2's presses are labelled s0, s1, s2", labels2.slice(0, 3).join() === "s0,s1,s2", labels2.join());
  check("the descent and the two presses each play over their own clock",
    Math.abs(frames2[0] - M.DESCENT_MS / 32) <= 2 && Math.abs(frames2[1] - M.showTiming(4).total / 32) <= 2
      && Math.abs(frames2[2] - M.openTiming().total / 32) <= 2 && frames2[3] === 0,
    `${frames2.join()} frames of 32 ms; ${M.showTiming(4).total} and ${M.openTiming().total} ms at rank 4`);

  const p3 = paramsOf({ page: "matching" });
  const s3 = W.compute({ params: p3 });
  const a3 = W.animation.init({ params: p3, state: s3, fromScratch: true });
  const labels3 = [a3.labelAt];
  const f3a = press(a3, p3, s3);
  labels3.push(a3.labelAt);
  const f3b = press(a3, p3, s3);
  check("page 3 before page 2: the first press extracts, at once, and the second compares",
    labels3.join() === "mX,m0" && f3a === 0 && f3b > 4 && a3.sig === 1 && a3.match === 1 && a3.done, `${labels3.join()} frames ${f3a},${f3b}`);

  /* invariant 3: each page keeps its place */
  W.animation.rebuild(a2, { params: paramsOf({ page: "matching" }), state: s3 });
  check("switching from page 2 to page 3 keeps the extraction, with nothing compared", a2.sig === M.SIG_STAGES && a2.match === 0 && a2.labelAt === "m0" && !a2.done);
  W.animation.rebuild(a2, { params: paramsOf({ page: "catalogue" }), state: s1 });
  check("and page 1 is where it was left, empty", a2.cat === 0 && a2.sig === M.SIG_STAGES && a2.labelAt === "k0");
  W.animation.rebuild(a1, { params: paramsOf({ tumor: "hypermutated" }), state: W.compute({ params: paramsOf({ tumor: "hypermutated" }) }) });
  check("another tumor starts page 1 over and leaves the rest", a1.cat === 0 && a1.landed === 0 && a1.tumor === "hypermutated");

  const sh = (o) => {
    const params = paramsOf(o);
    return W.animation.init({ params, state: W.compute({ params }), fromScratch: false });
  };
  check("?shown=2 opens page 1 read from the pyrimidine", sh({ shown: 2 }).cat === 2);
  check("?page=signatures&shown=2 opens the signatures beside W, and shown=3 each opened out",
    sh({ page: "signatures", shown: 2 }).sig === 2 && sh({ page: "signatures", shown: 3 }).sig === 3);
  const m1 = sh({ page: "matching", shown: 1 });
  check("?page=matching&shown=1 opens compared, the extraction taken", m1.sig === 1 && m1.match === 1 && m1.done);
  check("a replay starts over whatever shown says", W.animation.init({ params: paramsOf({ shown: 3 }), state: s1, fromScratch: true }).cat === 0);
}

/* --- 6 · the geometry, the tiles and the text -------------------------------------- */
console.log("\n§6 the geometry");
{
  const widths = [535, 550, 755, 770];
  let heightsVary = false;
  for (const page of ["catalogue", "signatures", "matching"]) {
    for (const rank of [2, 4, 6]) {
      const hs = widths.map((w) => W.height({ w, ...paramsOf({ page, rank }) }));
      if (new Set(hs).size !== 1) heightsVary = true;
    }
  }
  check("the height does not read the width, on any page at any rank", !heightsVary);

  const out = [];
  const texts = [];
  const tiles = [];
  const paint = (params, anim, w) => {
    const state = W.compute({ params });
    const h = W.height({ w, ...params });
    const { ctx, box, seen } = recorder();
    W.draw({ ctx, colors: COLORS, w, h, params, state, anim });
    texts.push(...seen, cardText());
    tiles.push(...W.readout({ params, state, anim }), { label: "summary", value: W.summary({ params, state, anim }), note: "" });
    if (box.bad || box.x0 < -0.5 || box.y0 < -0.5 || box.x1 > w + 0.5 || box.y1 > h + 0.5) {
      out.push(`${params.page} ${JSON.stringify(anim).slice(0, 70)} at ${w}: [${box.x0.toFixed(0)}, ${box.y0.toFixed(0)}]–[${box.x1.toFixed(0)}, ${box.y1.toFixed(0)}] in ${w}×${h}`);
    }
  };
  const blank = (page, tumor) => ({ page, tumor, cat: 0, catT: 1, landed: 0, clock: 0, sig: 0, sigT: 1, match: 0, matchT: 1 });
  for (const w of [535, 770]) {
    for (const tumor of ["largest", "hypermutated"]) {
      for (const seed of [1, 2]) {
        const params = paramsOf({ tumor, seed });
        const n = M.tumorFor(seed, tumor).n;
        for (const [cat, catT, landed] of [[0, 1, 0], [1, 1, Math.round(n / 2)], [1, 1, n], [2, 0.5, n], [2, 1, n], [3, 0.5, n], [3, 1, n]]) {
          paint(params, { ...blank("catalogue", tumor), cat, catT, landed }, w);
        }
      }
    }
    for (const rank of [2, 4, 6]) {
      for (const hypermutated of ["in", "out"]) {
        const p2 = paramsOf({ page: "signatures", rank, hypermutated });
        const along = [0, 0.04, 0.08, 0.12, 0.2, 0.3, 0.45, 0.6, 0.75, 0.85, 0.95, 1];
        for (const [sig, sigT] of [[0, 1], [1, 0.3], [1, 1], ...along.map((t) => [2, t]), ...along.map((t) => [3, t])]) {
          paint(p2, { ...blank("signatures", "largest"), sig, sigT }, w);
        }
        for (const truth of ["0", "1"]) {
          for (const signature of ["1", String(rank)]) {
            const p3 = paramsOf({ page: "matching", rank, hypermutated, truth, signature });
            for (const [sig, match, matchT] of [[0, 0, 1], [1, 0, 1], [1, 1, 0.05], [1, 1, 0.3], [1, 1, 0.5], [1, 1, 0.62], [1, 1, 0.7], [1, 1, 0.85], [1, 1, 1]]) {
              paint(p3, { ...blank("matching", "largest"), sig, match, matchT }, w);
            }
            paint(p3, { ...blank("matching", "largest"), sig: 1, match: 1, matchT: 1, shownRow: rank - 1, fromRow: 0, easeT: 0.5 }, w);
          }
        }
      }
    }
  }
  check("nothing is painted outside the canvas, on any page, stage or press, at 535 and 770", out.length === 0, out.slice(0, 3).join(" | "));
  const badText = texts.filter((s) => /NaN|undefined|Infinity|\[object/.test(s));
  check(`${texts.length} painted and card strings carry no NaN or undefined`, badText.length === 0, badText.slice(0, 2).join(" | "));
  const badTiles = tiles.filter((r) => /NaN|undefined|Infinity|\[object/.test(`${r.label} ${r.value} ${r.note}`));
  check(`${tiles.length} tiles and summaries carry no NaN or undefined`, badTiles.length === 0, badTiles.slice(0, 2).map((r) => `${r.label}: ${r.value}`).join(" | "));

  /* 2.4: a number waits for its step */
  const params = paramsOf({});
  const state = W.compute({ params });
  const empty = W.readout({ params, state, anim: blank("catalogue", "largest") });
  check("before any press on page 1, every tile is empty", empty.every((t) => t.value === "—"), empty.map((t) => t.value).join(" "));
  const p3 = paramsOf({ page: "matching" });
  const s3 = W.compute({ params: p3 });
  const before = W.readout({ params: p3, state: s3, anim: { ...blank("matching", "largest"), sig: 1 } });
  check("page 3's tiles wait for the comparison", before.every((t) => t.value === "—"));

  /* the regions: one a row, each setting a real option, inside the canvas */
  for (const rank of [2, 6]) {
    const pr = paramsOf({ page: "matching", rank });
    const st = W.compute({ params: pr });
    const regs = W.regions({ w: 535, h: W.height({ w: 535, ...pr }), params: pr, state: st });
    const keys = optionKeys(W.params.signature, pr);
    check(`at rank ${rank}, page 3 has one clickable row a signature, each a real option`,
      regs.length === rank && regs.every((r, k) => r.set.signature === String(k + 1) && keys.includes(r.set.signature)
        && r.y >= 0 && r.y + r.h <= W.height({ w: 535, ...pr })));
  }
  check("no page but the third has a clickable region", ["catalogue", "signatures"].every((page) =>
    W.regions({ w: 535, h: 400, params: paramsOf({ page }), state: W.compute({ params: paramsOf({ page }) }) }).length === 0));
}

/* --- 6b · the presses that open the signatures (rounds 1 and 2, 2026-09-19) ------ */
console.log("\n§6b the presses that open the signatures, and the ramp");
{
  const blank = (page) => ({ page, tumor: "largest", cat: 0, catT: 1, landed: 0, clock: 0, sig: 0, sigT: 1, match: 0, matchT: 1 });
  const frame = (params, anim, w) => {
    const state = W.compute({ params });
    const { ctx, ops, styles, seen } = recorder({ record: true });
    W.draw({ ctx, colors: COLORS, w, h: W.height({ w, ...params }), params, state, anim });
    return { ops, styles, seen, state };
  };

  /* each press starts on the last one's final frame, op for op */
  const seams = [];
  for (const w of [535, 770]) {
    for (const rank of [2, 4, 6]) {
      for (const hypermutated of ["in", "out"]) {
        const p = paramsOf({ page: "signatures", rank, hypermutated });
        for (const [from, to] of [[1, 2], [2, 3]]) {
          const a = frame(p, { ...blank("signatures"), sig: from, sigT: 1 }, w).ops;
          const b = frame(p, { ...blank("signatures"), sig: to, sigT: 0 }, w).ops;
          if (a.length !== b.length || a.some((x, i) => x !== b[i])) seams.push(`${w} r${rank} ${hypermutated} ${from}→${to}: ${a.length} ops against ${b.length}`);
        }
      }
    }
  }
  check("each press's first frame is the last one's final frame, op for op, at ranks 2, 4, 6 and both widths", seams.length === 0, seams.slice(0, 2).join(" | "));

  /* press 3 ends on bars where plotSignatures draws them */
  {
    const w = 626, p = paramsOf({ page: "signatures" });
    const L = M.layout(w, p);
    const fit = M.fitFor(1, "in", 4);
    let worst = 0;
    fit.sigs.forEach((s, k) => {
      const strip = M.widened(L, k, 1);
      const R = L.rows[k], bw = (L.x1 - L.x0) / 96, pmax = M.niceMax(Math.max(...s.profile));
      for (let i = 0; i < 96; i += 1) {
        const barH = Math.min(1, s.profile[i] / pmax) * (R.profile.base - R.profile.top);
        const c = M.stripCell(strip, i, false, 1, barH);
        /* a quarter turn anticlockwise takes (x, y) in the strip's frame to (px + y, py - x) */
        const x = strip.px + c.y, y = strip.py - (c.x + c.w);
        const want = { x: L.x0 + i * bw + 0.5, y: R.profile.base - barH, w: bw - 1, h: barH };
        worst = Math.max(worst, Math.abs(x - want.x), Math.abs(y - want.y), Math.abs(c.h - want.w), Math.abs(c.w - want.h));
      }
    });
    check("press 3 ends with each signature's bars where the profile's bars stand", worst < 1e-9, `largest miss ${worst.toExponential(1)} px`);
  }

  /* one column leaves S at a time, and every column leaves */
  const clash = [];
  for (let rank = 2; rank <= 6; rank += 1) {
    const T = M.showTiming(rank);
    const left = new Set();
    for (let now = 0; now <= T.total; now += 2) {
      const leaving = M.showAt(rank, now).u.map((u, k) => [u, k]).filter(([u]) => u > 0 && u < M.TURN);
      leaving.forEach(([, k]) => left.add(k));
      if (leaving.length > 1) { clash.push(`rank ${rank} at ${now} ms`); break; }
    }
    if (left.size !== rank) clash.push(`rank ${rank}: ${left.size} of ${rank} left`);
  }
  check("one column leaves S at a time, and every column leaves, at ranks 2 to 6", clash.length === 0, clash.join(" | "));
  const totals = [2, 3, 4, 5, 6].map((r) => M.showTiming(r).total);
  check("press 2 runs under 4 s at every rank, press 3 under 2.5 s", totals.every((t) => t < 4000) && M.openTiming().total < 2500,
    `${totals.map((t) => t.toFixed(0)).join(" · ")} ms; ${M.openTiming().total} ms`);

  /* NOTHING MOVES OVER A FINISHED SIGNATURE (round 2, his ask), nor over W,
     another moving strip, a column still waiting, or off the canvas: every
     moving strip as a rotated rectangle, every 5 ms, separating axes */
  const quad = (strip) => {
    const cs = Math.cos(strip.ang), sn = Math.sin(strip.ang);
    const lo = -strip.p * strip.len, hi = (1 - strip.p) * strip.len;
    return [[-strip.th / 2, lo], [strip.th / 2, lo], [strip.th / 2, hi], [-strip.th / 2, hi]]
      .map(([x, y]) => [strip.px + cs * x - sn * y, strip.py + sn * x + cs * y]);
  };
  const box = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const meet = (P, Q) => {
    for (const poly of [P, Q]) {
      for (let i = 0; i < poly.length; i += 1) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        const nx = y2 - y1, ny = x1 - x2;
        const a = P.map(([x, y]) => x * nx + y * ny), b = Q.map(([x, y]) => x * nx + y * ny);
        if (Math.max(...a) <= Math.min(...b) + 1e-6 || Math.max(...b) <= Math.min(...a) + 1e-6) return false;
      }
    }
    return true;
  };
  const hits = { finished: [], moving: [], waiting: [], w: [], edge: [] };
  let frames = 0;
  for (const w of [535, 626, 770]) {
    for (let rank = 2; rank <= 6; rank += 1) {
      const p = paramsOf({ page: "signatures", rank });
      const L = M.layout(w, p), H = L.heat, h = W.height({ w, ...p });
      const sigBox = (j) => box({ x: L.x0, y: L.rows[j].title - 12, w: M.shortRight(L) - L.x0, h: L.rows[j].profile.base + 6 - (L.rows[j].title - 12) });
      const wBlock = box({ x: H.W.x, y: M.wTop(L, rank), w: H.W.w, h: rank * (M.W_ROW + 1) });
      const T = M.showTiming(rank);
      for (let now = 0; now <= T.total; now += 5) {
        frames += 1;
        const us = M.showAt(rank, now).u;
        const qs = us.map((u, k) => quad(M.column(L, rank, k, u).strip));
        us.forEach((u, k) => {
          if (qs[k].some(([x, y]) => x < -0.5 || y < -0.5 || x > w + 0.5 || y > h + 0.5)) hits.edge.push(`${w} r${rank} ${k + 1} ${now}`);
          if (!(u > 0 && u < 1)) return;
          us.forEach((o, j) => {
            if (j === k) return;
            if (o >= 1 && meet(qs[k], sigBox(j))) hits.finished.push(`${w} r${rank}: column ${k + 1} over signature ${j + 1} at ${now} ms`);
            else if (o > 0 && o < 1 && meet(qs[k], qs[j])) hits.moving.push(`${w} r${rank}: ${k + 1} and ${j + 1} at ${now} ms`);
            else if (o <= 0 && meet(qs[k], qs[j])) hits.waiting.push(`${w} r${rank}: ${k + 1} over column ${j + 1} at ${now} ms`);
          });
          if (meet(qs[k], wBlock)) hits.w.push(`${w} r${rank}: column ${k + 1} over W at ${now} ms`);
        });
      }
      const T3 = M.openTiming();
      for (let now = 0; now <= T3.total; now += 5) {
        frames += 1;
        const at = M.openAt(now);
        for (let k = 0; k < rank; k += 1) {
          const row = box(M.wRow(L, rank, k, at.e, at.f));
          for (let j = 0; j < rank; j += 1) {
            const st = M.widened(L, j, at.f), R = L.rows[j];
            if (meet(row, box({ x: st.px - st.len, y: R.profile.top, w: st.len, h: R.profile.base + 6 - R.profile.top }))) {
              hits.finished.push(`${w} r${rank}: W's row ${k + 1} over signature ${j + 1} at ${now} ms of press 3`);
            }
            if (j !== k && meet(row, box(M.wRow(L, rank, j, at.e, at.f)))) hits.moving.push(`${w} r${rank}: W's rows ${k + 1} and ${j + 1}`);
          }
        }
      }
    }
  }
  check(`nothing moves over a finished signature, at 535, 626 and 770 and ranks 2 to 6 (${frames} frames)`, hits.finished.length === 0, hits.finished.slice(0, 2).join(" | "));
  check("no two moving strips meet, and none passes over W or a column of S still waiting",
    hits.moving.length + hits.w.length + hits.waiting.length === 0, [...hits.moving, ...hits.w, ...hits.waiting].slice(0, 2).join(" | "));
  check("every moving strip stays on the canvas", hits.edge.length === 0, hits.edge.slice(0, 2).join(" | "));

  /* the page rests after press 2: the signatures beside W, M and S gone */
  {
    const p = paramsOf({ page: "signatures" });
    const { seen } = frame(p, { ...blank("signatures"), sig: 2, sigT: 1 }, 626);
    const fit = M.fitFor(1, "in", 4);
    check("after press 2 the page rests with each signature titled beside W, and M and S gone",
      seen.includes(M.STRINGS.shownCaption) && fit.sigs.every((_, k) => seen.includes(M.STRINGS.sigTitle(k + 1)))
        && seen.includes(M.STRINGS.heatW) && !seen.includes(M.STRINGS.heatM) && !seen.includes(M.STRINGS.heatS)
        && !seen.includes(M.STRINGS.openedCaption), seen.slice(0, 4).join(" · "));
    const done = frame(p, { ...blank("signatures"), sig: 3, sigT: 1 }, 626).seen;
    check("after press 3 the opened view: its caption, and W and the resting caption gone",
      done.includes(M.STRINGS.openedCaption) && !done.includes(M.STRINGS.heatW) && !done.includes(M.STRINGS.shownCaption));
  }

  /* tumor 101 */
  const fit = M.fitFor(1, "in", 4), co = M.cohortFor(1);
  const own = fit.sigs.findIndex((s) => s.own);
  check("each strip's order is its exposures largest first, and each tumor's place is its index in that order",
    fit.sigs.every((s) => s.sorted.every((j, i) => s.place[j] === i && (i === 0 || s.exposure[s.sorted[i - 1]] >= s.exposure[j]))));
  check("tumor 101's bar lands first in its own signature's strip", own >= 0 && fit.sigs[own].place[co.hyperIndex] === 0,
    `signature ${own + 1}; ${fit.sigs.map((s) => s.place[co.hyperIndex] + 1).join(", ")} of ${fit.cols} across the four`);

  /* violet means one thing a page: the ramp's, never the highlight's */
  const lit = [];
  let rampSeen = false;
  for (const page of ["signatures", "matching"]) {
    for (const hypermutated of ["in", "out"]) {
      const p = paramsOf({ page, hypermutated });
      const stages = page === "signatures"
        ? [[0, 1], [1, 1], [2, 0.1], [2, 0.5], [2, 1], [3, 0.3], [3, 0.7], [3, 1]].map(([sig, sigT]) => ({ ...blank(page), sig, sigT }))
        : [{ ...blank(page), sig: 1, match: 1, matchT: 1 }];
      for (const anim of stages) {
        const { styles } = frame(p, anim, 626);
        if (styles.has(COLORS.highlight)) lit.push(`${page} ${JSON.stringify(anim).slice(0, 40)}`);
        if (styles.has(COLORS.magnitude)) rampSeen = true;
      }
    }
  }
  check("pages 2 and 3 never use the highlight colour, which the ramp shares", lit.length === 0, lit.slice(0, 2).join(" | "));
  check("the heatmaps reach the ramp's full end, --c-magnitude", rampSeen);
  const lg = (o) => W.legend({ params: paramsOf(o) });
  check("the legend's shade swatch is --c-magnitude on pages 2 and 3",
    lg({ page: "signatures" })[0].token === "magnitude" && lg({ page: "matching" })[0].token === "magnitude");
  check("page 2's legend names tumor 101 while it is in, and not once left out",
    lg({ page: "signatures" }).some((e) => e.mark === "tri") && !lg({ page: "signatures", hypermutated: "out" }).some((e) => e.mark === "tri"));
}

/* --- 6c · round 3 (2026-09-19): the scan, the eased row switch, the square ------ */
console.log("\n§6c the comparison's scan, the eased row switch, and page 1's square");
{
  const blank = (page) => ({ page, tumor: "largest", cat: 0, catT: 1, landed: 0, clock: 0, sig: 0, sigT: 1, match: 0, matchT: 1 });
  const frame = (params, anim, w = 626) => {
    const state = W.compute({ params });
    const { ctx, ops, seen, box } = recorder({ record: true });
    const h = W.height({ w, ...params });
    W.draw({ ctx, colors: COLORS, w, h, params, state, anim });
    return { ops, seen, box, h, state };
  };
  const T = M.compareTiming();

  /* the scan */
  for (const k of [0, 2]) {
    const at = M.compareAt(1000, 4, k);
    check(`the scan fills row ${k + 1}, when it is the one chosen, a reference at a time before any other row`,
      at.cell[k].slice(0, 5).every((a) => a > 0.99) && at.cell[k].slice(6).every((a) => a === 0)
        && at.cell.every((row, r) => r === k || row.every((a) => a === 0)),
      at.cell[k].map((a) => a.toFixed(1)).join(" "));
  }
  {
    const before = M.compareAt(T.settleAt - 1, 4, 0), after = M.compareAt(T.total, 4, 0);
    check("every row has filled before any best is outlined, and every best is outlined at the end",
      before.cell.every((row) => row.every((a) => a > 0.99)) && before.outline === 0 && after.outline === 1 && after.runner === 1,
      `rows by ${T.settleAt} ms, the press ${T.total} ms`);
  }
  {
    const p = paramsOf({ page: "matching" });
    const fit = M.fitFor(1, "in", 4);
    const laid = M.REFERENCES.filter((r, j) => frame(p, { ...blank("matching"), sig: 1, match: 1, matchT: (j * M.SCAN.each + 100) / T.total, scanRow: 0 }).seen
      .includes(M.STRINGS.comparedLabel(r.name)));
    const settled = frame(p, { ...blank("matching"), sig: 1, match: 1, matchT: (T.rowsAt + 50) / T.total, scanRow: 0 }).seen;
    check("the panel lays each of the ten references under the signature in turn, then settles on the best match",
      laid.length === M.REFERENCES.length && settled.includes(M.STRINGS.bestLabel(fit.sigs[0].match[0])),
      `${laid.length} of ${M.REFERENCES.length} laid`);
    const mid = { ...blank("matching"), sig: 1, match: 1, matchT: 0.5, scanRow: 0 };
    const state = W.compute({ params: p });
    const tiles = W.readout({ params: p, state, anim: mid });
    check("the tiles, the card and the summary wait for the scan to finish",
      tiles.every((t) => t.value === "—") && W.summary({ params: p, state, anim: mid }) === M.STRINGS.sumNotCompared(4)
        && !(frame(p, mid), cardText()).includes("cos(signature"));
  }

  /* the eased row switch */
  {
    const p1 = paramsOf({ page: "matching", shown: 1 });
    const a = W.animation.init({ params: p1, state: W.compute({ params: p1 }), fromScratch: false });
    const p3 = paramsOf({ page: "matching", shown: 1, signature: "3" });
    W.animation.rebuild(a, { params: p3, state: W.compute({ params: p3 }) });
    const asked = a.easing === true && a.fromRow === 0 && a.shownRow === 2 && a.easeT === 0;
    a.mode = "ease";
    let frames = 0;
    while (W.animation.advance(a, { dt: 32, params: p3, state: W.compute({ params: p3 }) }) && frames < 200) frames += 1;
    check("once compared, a click on another row asks core for an ease, which runs its clock and lands",
      asked && a.easeT === 1 && Math.abs(frames - M.EASE_MS / 32) <= 2, `${frames} frames of 32 ms`);
    const p0 = paramsOf({ page: "matching" });
    const b = W.animation.init({ params: p0, state: W.compute({ params: p0 }), fromScratch: true });
    W.animation.rebuild(b, { params: paramsOf({ page: "matching", signature: "3" }), state: W.compute({ params: p0 }) });
    check("before the comparison, a click on another row changes it without an ease", !b.easing && b.shownRow === 2 && b.easeT === 1);
  }
  {
    const done = { ...blank("matching"), sig: 1, match: 1, matchT: 1 };
    const same = (x, y) => x.length === y.length && x.every((o, i) => o === y[i]);
    const seams = [];
    for (const w of [535, 770]) {
      const pa = paramsOf({ page: "matching" }), pb = paramsOf({ page: "matching", signature: "3" });
      if (!same(frame(pa, { ...done, shownRow: 0, fromRow: 0, easeT: 1 }, w).ops, frame(pb, { ...done, shownRow: 2, fromRow: 0, easeT: 0 }, w).ops)) seams.push(`${w} start`);
      if (!same(frame(pb, { ...done, shownRow: 2, fromRow: 0, easeT: 1 }, w).ops, frame(pb, { ...done, shownRow: 2, fromRow: 2, easeT: 1 }, w).ops)) seams.push(`${w} end`);
    }
    check("the ease starts on the old signature's panel and ends on the new one's, op for op", seams.length === 0, seams.join(" | "));
  }

  /* page 1's square */
  {
    const out = [];
    let tight = Infinity;
    for (const w of [535, 626, 770]) {
      const L = M.layout(w, { page: "catalogue" });
      const N = M.squareNodes(L);
      if (L.square.x < L.x1 + 12 || L.square.x + L.square.w > w || N.y1 + 64 >= L.base + 40 || N.y0 - 16 - 11 < 0) out.push(`${w}px`);
      /* stage 1's two labels a class, measured in a mono face 0.6 em wide, wider than the canvas's own */
      M.CLASSES.forEach((s, k) => {
        const a = M.writtenRect(L, k, false, 0, 1), b = M.writtenRect(L, k, true, 0, 1);
        tight = Math.min(tight, (b.x + b.w / 2 - 1.5 * 6.6) - (a.x + a.w / 2 + 1.5 * 6.6));
      });
    }
    check("the square stands beside the bars at 535, 626 and 770px: clear of them, inside the canvas, above the lines under them", out.length === 0, out.join(" "));
    check("stage 1's two labels a class clear each other at every width, even in a mono face 0.6 em wide", tight >= 0, `${tight.toFixed(1)}px at the tightest`);
    const pyr = M.ARROWS.filter((a) => !a.purine);
    check("twelve arrows, one a written change; the six left after the fold start at C or T",
      M.ARROWS.length === 12 && new Set(M.ARROWS.map((a) => a.from + a.to)).size === 12 && pyr.length === 6 && pyr.every((a) => a.from === "C" || a.from === "T"));
    check("the two transitions left are C→T and T→C, and each pale arrow is the purine form of the arrow its colour matches",
      pyr.filter((a) => a.ti).map((a) => a.from + a.to).sort().join() === "CT,TC"
        && M.ARROWS.filter((a) => a.purine).every((a) => M.PURINE_FORM[M.CLASSES[a.k]] === a.written));
    const p = paramsOf({});
    const early = frame(p, { ...blank("catalogue"), cat: 1, catT: 1, landed: 10 }).seen;
    const late = frame(p, { ...blank("catalogue"), cat: 3, catT: 1, landed: M.tumorFor(1, "largest").n }).seen;
    check("the square names its two kinds once the changes are read from the pyrimidine, and not before",
      !early.includes(M.STRINGS.squareTiKey) && late.includes(M.STRINGS.squareTiKey) && late.includes(M.STRINGS.squareTvKey)
        && early.includes(M.STRINGS.squarePurines) && early.includes(M.STRINGS.squarePyrimidines));
  }
}

/* --- 7 · the copy, against the words this collection has struck ----------------- */
console.log("\n§7 the copy");
{
  const src = [read("widgets/mutational-signatures/main.js"), read("widgets/mutational-signatures/model.js")]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
    .map((m) => m[2].replace(/\$\{[^}]*\}/g, " "))
    .filter((t) => /[a-z]{3}/i.test(t) && !/^<|var\(--|^\([a-z-]+:/.test(t) && t.trim().length >= 12);
  const struck = [
    ["a physical verb for a value", /\b(sits?|sitting|sat|lies|lying|falls?|falling|fell|walks?|walking|lands?|landing)\b/i],
    ["a model acting", /\b(keeps?|wants?|thinks?|believes?|decides?|chooses?|chose|knows?|tries|refuses?|prefers?|gathers?)\b/i],
    ["our own shorthand", /\b(card|rung|trench|the plain|look-alike)\b/i],
    ["a lesson reference", /\b(notebook|lesson|cell \d|chapter)\b/i],
    ["the other spelling", /\btumour/i],
    ["the reader addressed", /\b(you|your|yours)\b/i],
    ["a shade named for one theme", /\b(darker|lighter|darkest|lightest)\b/i],
  ];
  const hits = [];
  for (const t of strings) for (const [why, re] of struck) if (re.test(t)) hits.push(`${why}: "${t.slice(0, 56)}"`);
  check(`${strings.length} reader-facing strings carry no struck word`, hits.length === 0, hits.join(" | "));
  const S = M.STRINGS;
  const details = [S.pageDetail, S.tumorDetail, S.hyperDetail, S.rankDetail, S.openDetail, S.seedDetail, S.truthDetail];
  const outcome = /\b(is named|are named|takes? a signature|becomes?|wins?|misses|matches best)\b/i;
  check("no control detail announces an outcome", !details.some((s) => outcome.test(s)), details.filter((s) => outcome.test(s)).join(" | "));
}

console.log(`\n${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
