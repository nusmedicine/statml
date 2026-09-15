/* ============================================================================
   Assertions on widget 65's arithmetic, its geometry and its copy.

       node widgets/_lab/unet-verify.mjs

   Imports `widgets/unet/model.js` — the shipping code, not a copy (5.8).

   §1 THE SHAPES AND THE COUNTS against torch: `_lab/unet-torch.py` runs the
   notebook's own `UNet2D` and `_lab/unet-torch.txt` holds what it printed —
   the parameter count at base 4 / 8 / 16 and every stage's shape on a
   (10, 3, 64, 64) input. The widget's stage list must reproduce both.

   §2 THE DICE CLAIMS the stage rests on, at the widget's own masks: an
   empty prediction on the small object scores Dice 0 and accuracy near 1;
   off the object, no overlap at every size; dilated and eroded give
   near-equal Dice with precision and recall reversed; Dice and IoU are
   monotone in each other; the identities hold exactly.

   §3 THE SPLIT: the stratified test set has every bin at every seed in 1..200;
   the random one leaves a bin empty at some seed in that range, so the case
   the band lights exists.

   §4 THE GEOMETRY: every slab is inside the stage at 550 and 770 for every
   depth · base · input, the U's rows do not overlap, the bottleneck is the
   widest slab, and the Dice panels and tiles fit the width.

   §5 THE COPY. Every string literal in main.js, comments stripped, against
   the words this collection has struck.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as M from "../unet/model.js";

const here = dirname(fileURLToPath(import.meta.url));
let checks = 0;
let failed = 0;
function assert(cond, msg) {
  checks += 1;
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${msg}`);
  }
}
const section = (s) => console.log(`\n${s}`);

/* §1 ---------------------------------------------------------------------- */
section("§1 the shapes and the parameter counts against torch");
{
  const lines = readFileSync(join(here, "unet-torch.txt"), "utf8").split(/\r?\n/);
  const params = {};
  const shapes = {};
  for (const line of lines) {
    let m = line.match(/^base (\d+) params (\d+)$/);
    if (m) { params[m[1]] = Number(m[2]); continue; }
    m = line.match(/^base (\d+) (\w+) \[(.+)\]$/);
    if (m) (shapes[m[1]] = shapes[m[1]] || {})[m[2]] = m[3].split(",").map((v) => Number(v.trim()));
  }
  assert(Object.keys(params).length === 3, "the torch file holds three bases");
  for (const base of [4, 8, 16]) {
    assert(M.paramCount(4, base) === params[base], `parameters at depth 4, base ${base}: ${M.paramCount(4, base)} against torch ${params[base]}`);
    const st = M.stagesFor(4, base, 64);
    for (const s of st) {
      const ref = shapes[base][s.name];
      assert(ref && ref.join(",") === M.shapeOf(s).join(","), `shape of ${s.name} at base ${base}: ${M.shapeOf(s)} against torch ${ref}`);
    }
    assert(st.length === 22, `22 stages at depth 4 (${st.length})`);
  }
  console.log(`  parameters ${[4, 8, 16].map((b) => `${b}: ${M.paramCount(4, b)}`).join(", ")}; 22 stages a net`);
  /* the other depths, by the same arithmetic: the bottleneck's channels and side */
  for (const depth of [2, 3]) {
    const st = M.stagesFor(depth, 8, 64);
    const b = st.find((s) => s.kind === "bottleneck");
    assert(b.C === 8 * 2 ** depth && b.H === 64 >> depth, `depth ${depth}: bottleneck ${b.C} channels, ${b.H} a side`);
    assert(st.length === 5 * depth + 2, `depth ${depth}: ${st.length} stages`);
  }
  const fail = M.stagesFor(4, 16, 16).find((s) => s.kind === "bottleneck");
  assert(fail.H === 1, "depth 4 on a 16 x 16 input reaches a 1 x 1 bottleneck");
}

/* §2 ---------------------------------------------------------------------- */
section("§2 the Dice claims on the widget's own masks");
{
  const rng = makeRng(1);
  const read = (size, pred, dx = 0, dy = 0) => M.computeDice({ size, pred, dx, dy, split: "random", seed: 1 }, rng).m;
  for (const size of M.SIZE_KEYS) {
    const truth = M.disc(M.CENTRE[0], M.CENTRE[1], M.SIZES[size].r);
    const share = truth.reduce((a, v) => a + v, 0) / (M.G * M.G);
    const want = { small: 0.01, medium: 0.05, large: 0.20 }[size];
    assert(Math.abs(share - want) < 0.004, `the ${size} object covers ${(100 * share).toFixed(2)}% of the image (about ${100 * want}%)`);
    const empty = read(size, "empty");
    assert(empty.dice === 0 && empty.iou === 0 && Math.abs(empty.acc - (1 - share)) < 1e-9, `${size}, empty: Dice 0, accuracy ${empty.acc.toFixed(3)} = 1 - share`);
    const off = read(size, "off");
    assert(off.AB === 0, `${size}, off the object: no overlap (${off.AB})`);
    assert(off.B > 0, `${size}, off the object: some of the prediction is still on the image (${off.B} px)`);
  }
  const off = read("small", "off");
  assert(off.acc > 0.975 && off.dice === 0, `small, off: accuracy ${off.acc.toFixed(3)} with Dice 0 — the opening pair`);
  const dil = read("medium", "dilate");
  const ero = read("medium", "erode");
  assert(dil.rec === 1 && dil.prec < 0.8, `dilated: recall 1, precision ${dil.prec.toFixed(2)}`);
  assert(ero.prec === 1 && ero.rec < 0.75, `eroded: precision 1, recall ${ero.rec.toFixed(2)}`);
  assert(Math.abs(dil.dice - ero.dice) < 0.05, `dilated and eroded within 0.05 Dice (${dil.dice.toFixed(3)} · ${ero.dice.toFixed(3)})`);
  for (const m of [dil, ero, off, read("small", "shift"), read("large", "random")]) {
    assert(Math.abs(m.dice - (2 * m.AB) / (m.A + m.B)) < 1e-12, "Dice is 2|A∩B| / (|A|+|B|)");
    assert(Math.abs(m.iou - m.AB / (m.A + m.B - m.AB)) < 1e-12, "IoU is |A∩B| / |A∪B|");
    assert(Math.abs(m.iou - m.dice / (2 - m.dice)) < 1e-12, "IoU = Dice / (2 − Dice)");
  }
  const moved = read("small", "shift", 3, -2);
  const plain = read("small", "shift");
  assert(moved.B === plain.B && moved.AB < plain.AB, "a drag moves the prediction without changing its size, and the overlap falls");
  console.log(`  small off: accuracy ${off.acc.toFixed(3)}, Dice 0; dilated ${dil.dice.toFixed(3)} (P ${dil.prec.toFixed(2)} R ${dil.rec.toFixed(2)}), eroded ${ero.dice.toFixed(3)} (P ${ero.prec.toFixed(2)} R ${ero.rec.toFixed(2)})`);
}

/* §3 ---------------------------------------------------------------------- */
section("§3 the split");
{
  let emptyRandom = 0;
  let emptyStrat = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const r = M.computeDice({ size: "small", pred: "off", dx: 0, dy: 0, split: "random", seed }, makeRng(seed));
    const s = M.computeDice({ size: "small", pred: "off", dx: 0, dy: 0, split: "strat", seed }, makeRng(seed));
    if (r.empty >= 0) emptyRandom += 1;
    if (s.empty >= 0) emptyStrat += 1;
    assert(r.test.length === M.N_TEST, `seed ${seed}: the random test set has ${M.N_TEST} cases`);
    assert(Math.abs(s.test.length - M.N_TEST) <= 2, `seed ${seed}: the stratified test set has about ${M.N_TEST} cases (${s.test.length})`);
    assert(r.cases.length === M.N_CASES, "600 cases");
  }
  assert(emptyStrat === 0, `the stratified split never leaves a bin empty (${emptyStrat} of 200)`);
  assert(emptyRandom > 0, `the random split leaves a bin empty at some seed (${emptyRandom} of 200)`);
  console.log(`  random leaves a bin empty at ${emptyRandom} of 200 seeds; stratified at ${emptyStrat}`);
}

/* §4 ---------------------------------------------------------------------- */
section("§4 the geometry at 550 and 770");
for (const w of [550, 770]) {
  for (const depth of M.DEPTHS) {
    for (const base of M.BASES) {
      for (const input of M.INPUTS) {
        const state = M.computeU({ depth, base, input });
        const L = M.uLayout(w, state);
        for (const [name, b] of Object.entries(L.boxes)) {
          assert(b.x >= M.PAD && b.x + b.w <= w - M.PAD, `${name} inside the stage at ${w} (depth ${depth}, base ${base}, input ${input}): x ${b.x.toFixed(0)}–${(b.x + b.w).toFixed(0)}`);
          assert(b.w >= M.SLAB_MIN && b.h >= M.ROW_MIN, `${name} at least the floors`);
        }
        for (let i = 1; i < L.rows.length; i += 1) {
          assert(L.rows[i].y >= L.rows[i - 1].y + L.rows[i - 1].h + M.ROW_GAP - 1e-9, `rows ${i - 1} and ${i} do not overlap`);
        }
        const widest = Math.max(...Object.values(L.boxes).map((b) => b.w));
        assert(L.boxes.bottleneck.w === widest, "the bottleneck is the widest slab");
        assert(L.height === M.pageHeight(w, { topic: "unet", depth, base, input }), "the page height is the layout's");
      }
    }
  }
  const D = M.diceLayout(w);
  assert(D.panels[2].x + D.panels[2].w <= w - M.PAD + 1e-9, `the three panels fit at ${w}`);
  assert(D.numbers.x + 96 + 60 <= w - M.PAD, `the numbers column fits at ${w}`);
  assert(D.band.dotsX0 + M.N_TEST * D.band.dotStep <= w - M.PAD + 1e-9, `sixty dots fit at ${w}`);
  console.log(`  ${w}: U ${M.pageHeight(w, { topic: "unet", depth: "4", base: "16", input: "512" })}px, Dice ${M.diceHeight(w)}px`);
}

/* §5 ---------------------------------------------------------------------- */
section("§5 the copy");
{
  const src = readFileSync(join(here, "..", "unet", "main.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  const struck = [
    /\bnever\b/i, /\bsits?\b/i, /\bsitting\b/i, /\bfalls?\b/i, /\blies?\b/i, /\bwalk\b/i, /\bcard\b/i, /\brung\b/i,
    /\bwell\b/i, /\bplain\b/i, /\btrench\b/i, /\bframe\b/i, /\bchose\b/i, /\bwants?\b/i, /\bpoints? the wrong way\b/i,
  ];
  for (const s of strings) {
    if (s.length < 12 || /^[\w-]+$/.test(s)) continue;
    if (/^<|^[\s\S]*var\(--/.test(s)) continue;
    for (const re of struck) assert(!re.test(s), `struck word ${re} in "${s.slice(0, 60)}"`);
  }
  console.log(`  ${strings.length} string literals read`);
}

console.log(`\n${checks} checks, ${failed} failed`);
if (failed) process.exit(1);
