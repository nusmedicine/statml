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
function recorder() {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, bad: false };
  const seen = [];
  const stack = [];
  let T = [1, 0, 0, 1, 0, 0];
  const apply = (x, y) => [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]];
  const mark = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { box.bad = true; return; }
    const [px, py] = apply(x, y);
    box.x0 = Math.min(box.x0, px); box.y0 = Math.min(box.y0, py);
    box.x1 = Math.max(box.x1, px); box.y1 = Math.max(box.y1, py);
  };
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const ctx = {
    save() { stack.push(T.slice()); },
    restore() { const s = stack.pop(); if (s) T = s; },
    translate(dx, dy) { T = mul(T, [1, 0, 0, 1, dx, dy]); },
    scale(x, y) { T = mul(T, [x, 0, 0, y, 0, 0]); },
    rotate(r) { T = mul(T, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]); },
    beginPath() {}, closePath() {}, stroke() {}, fill() {}, setLineDash() {}, clip() {}, rect() {},
    measureText: (s) => ({ width: String(s).length * 6 }),
    fillRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); mark(x + w, y); mark(x, y + h); },
    strokeRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    clearRect: () => {},
    moveTo: mark, lineTo: mark,
    arc: (x, y, r) => { mark(x - r, y - r); mark(x + r, y + r); },
    fillText(s, x, y) {
      seen.push(String(s));
      const w = String(s).length * 6;
      const left = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" ? x - w : x;
      mark(left, y - 11); mark(left + w, y + 3); mark(left, y + 3); mark(left + w, y - 11);
    },
    strokeText() {},
    textAlign: "left", textBaseline: "alphabetic", font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  };
  return { ctx, box, seen };
}

const COLORS = Object.fromEntries([
  "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "highlight", "reference",
].map((k) => [k, "#123456"]));
Object.assign(COLORS, { subs: ["#101010", "#202020", "#303030", "#404040", "#505050", "#606060"],
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
  for (let i = 0; i < 3; i += 1) { labels2.push(a2.labelAt); frames2.push(press(a2, p2, s2)); seen2.push(a2.sig); }
  check("page 2: Extract, then each signature shown; then done", seen2.join() === "1,2,2" && a2.done, seen2.join());
  check("page 2's presses are labelled s0, s1", labels2.slice(0, 2).join() === "s0,s1", labels2.join());
  check("the descent plays over its frames, the handover over fewer", frames2[0] > frames2[1] && frames2[1] > 4, frames2.join());

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
  check("switching from page 2 to page 3 keeps the extraction, with nothing compared", a2.sig === 2 && a2.match === 0 && a2.labelAt === "m0" && !a2.done);
  W.animation.rebuild(a2, { params: paramsOf({ page: "catalogue" }), state: s1 });
  check("and page 1 is where it was left, empty", a2.cat === 0 && a2.sig === 2 && a2.labelAt === "k0");
  W.animation.rebuild(a1, { params: paramsOf({ tumor: "hypermutated" }), state: W.compute({ params: paramsOf({ tumor: "hypermutated" }) }) });
  check("another tumor starts page 1 over and leaves the rest", a1.cat === 0 && a1.landed === 0 && a1.tumor === "hypermutated");

  const sh = (o) => {
    const params = paramsOf(o);
    return W.animation.init({ params, state: W.compute({ params }), fromScratch: false });
  };
  check("?shown=2 opens page 1 read from the pyrimidine", sh({ shown: 2 }).cat === 2);
  check("?page=signatures&shown=2 opens each signature shown", sh({ page: "signatures", shown: 2 }).sig === 2);
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
        for (const [sig, sigT] of [[0, 1], [1, 0.3], [1, 1], [2, 0.5], [2, 1]]) paint(p2, { ...blank("signatures", "largest"), sig, sigT }, w);
        for (const truth of ["0", "1"]) {
          for (const signature of ["1", String(rank)]) {
            const p3 = paramsOf({ page: "matching", rank, hypermutated, truth, signature });
            for (const [sig, match, matchT] of [[0, 0, 1], [1, 0, 1], [1, 1, 0.5], [1, 1, 1]]) paint(p3, { ...blank("matching", "largest"), sig, match, matchT }, w);
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
