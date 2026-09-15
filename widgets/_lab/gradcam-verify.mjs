/* ============================================================================
   Assertions on widget 64's engine, its trained claims, Grad-CAM's arithmetic,
   the stage's geometry and its copy.

       node widgets/_lab/gradcam-verify.mjs

   Imports `widgets/grad-cam/engine.js` and `model.js` — the shipping code and
   not a copy (5.8) — so the net the widget trains, the heatmap it draws and
   the numbers it prints are the ones checked here.

   §1 THE ENGINE. The analytic gradient of the cross-entropy against central
   differences over every parameter of a small net, and ∂logit/∂A on the last
   block against differences on the activations; both under 1e-5.

   §2 THE CLAIMS THE STAGE RESTS ON, at the widget's own configuration and the
   default seed: the model learns the cell (held-out ≥ 95 %) with the
   orientation marker on every image, no cell or ghost overlaps the marker's
   corner, and no training image carries a planted square. Timings are
   RECORDED and gate nothing — a wall-clock assertion blocked every deploy for
   a day (2026-09-12).

   §3 GRAD-CAM IS WHAT THE CARD SAYS. αₖ is the mean of the gradient map, the
   sum is Σ αₖ Aᵏ over EVERY channel (the figure draws four and says so), the
   CAM is its positive part scaled to a peak of 1, the upsample is nearest
   neighbour, and the shares are shares. The other class's CAM differs.

   §4 THE STAGE. Kenneth's diagram (his pick B): the forward row's five
   elements clear each other left to right, the backward row's five right to
   left, the heatmap is under the image and the gradient stack under the
   feature-map stack, the score's class lines end inside the right margin at
   550 at a blunt 6px a character (the bound widget 61's verify uses, and a
   bound is what it is), and the height is the diagram's own at every width.

   §5 THE COPY. Every string literal in main.js, comments stripped, against
   the words this collection has struck: the personification verbs, sit /
   fall / lie in their figurative senses, "never", and the internal vocabulary
   (card, rung, well, plain, trench, frame, walk).
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../grad-cam/engine.js";
import * as M from "../grad-cam/model.js";

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
const pct = (v) => `${(100 * v).toFixed(1)}%`;

/* §1 ---------------------------------------------------------------------- */
section("§1 the engine's gradients");
{
  const g = E.gradCheck(makeRng(7));
  assert(g.worst < 1e-5, `cross-entropy gradient: max relative error ${g.worst.toExponential(1)} over ${g.count} parameters`);
  assert(g.worstCam < 1e-5, `∂logit/∂A on the last block: max relative error ${g.worstCam.toExponential(1)}`);
  console.log(`  CE ${g.worst.toExponential(1)} over ${g.count} parameters; ∂logit/∂A ${g.worstCam.toExponential(1)}`);
}

/* §2 ---------------------------------------------------------------------- */
section("§2 the trained claims at the widget's configuration, seed 1");
const model = M.trainModel({ seed: 1 }, makeRng(1));
console.log(`  train ${pct(model.acc.train)}, held-out ${pct(model.acc.clean)}, ${model.ms.toFixed(0)} ms (recorded, not gated)`);
assert(model.acc.clean >= 0.95, `the model learns the cell: held-out ${pct(model.acc.clean)}`);
assert(model.train.n === M.N_TRAIN && model.clean.n === M.N_TEST, "the sets have the sizes the readout names");
{
  const hasL = (set) => {
    for (let i = 0; i < set.n; i += 1) {
      for (const [dy, dx] of E.MARKER_L) if (set.x[i * M.S * M.S + (M.S - 2 - dy) * M.S + 1 + dx] !== E.MARKER_VALUE) return false;
    }
    return true;
  };
  assert(hasL(model.train) && hasL(model.clean), "every image carries the orientation marker in the bottom-left corner");
  /* the cell never reaches the marker's corner */
  let clear = true;
  for (const set of [model.train, model.clean]) {
    for (let i = 0; i < set.n; i += 1) {
      for (let y = M.S - E.MARKER_BOX; y < M.S; y += 1) {
        for (let x = 0; x < E.MARKER_BOX; x += 1) if (set.masks[i][y * M.S + x] > 0) clear = false;
      }
    }
  }
  assert(clear, `no cell or ghost overlaps the marker's ${E.MARKER_BOX} × ${E.MARKER_BOX} corner, in ${model.train.n + model.clean.n} images`);
  let none = 0;
  for (let i = 0; i < model.train.n; i += 1) none += model.train.cued[i];
  assert(none === 0, "no training image carries a planted square");
}

/* §3 ---------------------------------------------------------------------- */
section("§3 Grad-CAM's arithmetic on one reading");
const reads = M.readings(model);
assert(reads.length === M.TEST_SHOWN, `${M.TEST_SHOWN} readings, one a test image`);
{
  const read = reads[0];
  assert(read.cls === 0 && reads[1].cls === 1, "the test images alternate class, so image 1 is a cell and image 2 a ghost");
  for (let b = 0; b < M.CHANS.length; b += 1) {
    const H = model.net.blocks[b].H;
    const area = H * H;
    for (let c = 0; c < 2; c += 1) {
      const cam = read.cams[b][c];
      assert(cam.acts.length === cam.C * area && cam.grads.length === cam.C * area, `block ${b + 1}: ${cam.C} maps of ${H} × ${H}`);
      let okAlpha = true;
      let okSum = true;
      const sum = new Float64Array(area);
      for (let k = 0; k < cam.C; k += 1) {
        let m = 0;
        for (let i = 0; i < area; i += 1) m += cam.grads[k * area + i];
        m /= area;
        if (Math.abs(m - cam.alpha[k]) > 1e-12) okAlpha = false;
        for (let i = 0; i < area; i += 1) sum[i] += m * cam.acts[k * area + i];
      }
      for (let i = 0; i < area; i += 1) if (Math.abs(sum[i] - cam.sum[i]) > 1e-9) okSum = false;
      assert(okAlpha, `block ${b + 1}, class ${c}: αₖ is the mean of the gradient map`);
      assert(okSum, `block ${b + 1}, class ${c}: the sum is Σ αₖ Aᵏ over all ${cam.C} maps`);
      let peak = 0;
      for (let i = 0; i < area; i += 1) peak = Math.max(peak, cam.sum[i]);
      let okRelu = true;
      for (let i = 0; i < area; i += 1) {
        const want = peak > 0 ? Math.max(0, cam.sum[i]) / peak : 0;
        if (Math.abs(want - cam.cam[i]) > 1e-9) okRelu = false;
      }
      assert(okRelu, `block ${b + 1}, class ${c}: the CAM is the positive part scaled to a peak of 1`);
      let okUp = true;
      const f = M.S / H;
      for (let y = 0; y < M.S; y += 1) {
        for (let x = 0; x < M.S; x += 1) {
          if (cam.up[y * M.S + x] !== cam.cam[Math.floor(y / f) * H + Math.floor(x / f)]) okUp = false;
        }
      }
      assert(okUp, `block ${b + 1}, class ${c}: the upsample is nearest neighbour, × ${f}`);
      const sh = cam.share;
      assert(sh.object >= 0 && sh.object <= 1 && sh.corner >= 0 && sh.corner <= 1, `block ${b + 1}, class ${c}: the shares are shares`);
    }
    const a = read.cams[b][0].cam;
    const o = read.cams[b][1].cam;
    let differ = false;
    for (let i = 0; i < area; i += 1) if (Math.abs(a[i] - o[i]) > 1e-9) differ = true;
    assert(differ, `block ${b + 1}: the other class's CAM is a different picture`);
  }
  /* the measured claim the stage rests on, this seed: the cell's heat is on the cell */
  const conv2 = reads[0].cams[1][reads[0].pred];
  console.log(`  image 1 at conv2, predicted ${M.CLASS_NAMES[reads[0].pred]}: ${pct(conv2.share.object)} of the heat on the cell (area ${pct(conv2.share.objectArea)}), ${pct(conv2.marker)} on the marker (area ${pct(M.MARKER_AREA)})`);
  assert(conv2.share.object > conv2.share.objectArea, "image 1's heat at conv2 is enriched on the cell");
  /* the marker is not what the model looks at: over the eight readings at conv2 */
  let onMarker = 0;
  for (const r of reads) onMarker += r.cams[1][r.pred].marker;
  onMarker /= reads.length;
  assert(onMarker <= 2 * M.MARKER_AREA, `the heat on the marker's corner at conv2, mean of ${reads.length} images: ${pct(onMarker)} against its ${pct(M.MARKER_AREA)} of the image`);
}

/* §4 ---------------------------------------------------------------------- */
section("§4 the stage");
{
  const net = model.net;
  const L = M.diagramLayout(550);
  assert(L.height === M.STAGE_H, `the stage is ${M.STAGE_H}px, the diagram's own height`);
  assert(M.diagramLayout(770).height === M.STAGE_H, "a wider stage is not taller: the diagram is pinned left");
  /* forward, left to right, a gap between each pair */
  const fwd = [[L.img.x, M.IMG], [L.box.x, M.BOX_W], [L.stack.x, M.THUMB], [L.head.x, L.headW], [L.score.x, 0]];
  for (let i = 1; i < fwd.length; i += 1) {
    const gap = fwd[i][0] - (fwd[i - 1][0] + fwd[i - 1][1]);
    assert(gap >= 8, `forward: element ${i} clears the one before it by ${gap}px`);
  }
  /* backward, right to left, the same */
  const bwd = [[L.grads.x, M.THUMB], [L.alpha.x, M.ALPHA_W], [L.sum.x, M.BIG], [L.relu.x, M.BIG], [L.heat.x, M.IMG]];
  for (let i = 1; i < bwd.length; i += 1) {
    const gap = bwd[i - 1][0] - (bwd[i][0] + bwd[i][1]);
    assert(gap >= 8, `backward: element ${i} clears the one after it by ${gap}px`);
  }
  assert(L.heat.x === L.img.x, "the heatmap is under the image it came from");
  assert(L.grads.x === L.stack.x, "the gradient stack is under the feature-map stack");
  assert(L.drop.x > L.score.x && L.drop.x > L.grads.x + M.THUMB, "the score's gradient comes down to the right of everything it feeds");
  /* the score's printed class lines stay inside 550 at 6px a character */
  const scoreText = `${M.CLASS_NAMES[1]} 0.00`;
  assert(L.score.x + 6 * scoreText.length <= 550 - M.PAD, `"${scoreText}" ends ${550 - M.PAD - (L.score.x + 6 * scoreText.length)}px inside the right margin at 550`);
  /* the two rows do not meet: the stack's label sits between them */
  assert(L.grads.y - 8 - 12 > L.stack.y + M.STACK_H + 14, "the stack's caption and the gradient stack's label do not meet");
  /* the two pairs of printed lines under the bottom row share baselines and
     must not reach each other, at 6px a character */
  const heatLines = ["the heatmap: 16 × 16, drawn × 1", "100% on the cell · 100% in the corner"];
  for (const line of heatLines) {
    assert(L.heat.x + 6 * line.length <= L.alpha.x - 8, `"${line}" ends ${L.alpha.x - 8 - (L.heat.x + 6 * line.length)}px before the gradient stack's lines`);
  }
  const alphaLines = ["αₖ: the mean over 256 cells", "the sum runs over all 16 maps"];
  for (const line of alphaLines) {
    assert(L.alpha.x + 6 * line.length <= 550 - M.PAD, `"${line}" ends inside the right margin at 550`);
  }
  /* the printed lines under the bottom row are inside the stage */
  assert(L.lineY(1) + 4 <= L.height, `the last printed line is inside the ${L.height}px stage`);
  console.log(`  the stage ${L.height}px; forward row at y ${L.topMid}, backward at ${L.botMid}; the stack at x ${L.stack.x}, the score at ${L.score.x}`);
  void net;
}

/* §5 ---------------------------------------------------------------------- */
section("§5 the copy");
{
  const src = readFileSync(join(here, "../grad-cam/main.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const strings = [...src.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2])
    .filter((s) => /[a-z]{3}/i.test(s));
  const banned = [
    /\bnever\b/i,
    /\b(sits?|sitting|sat|lies|lying|lay|falls?|falling|fell)\b/i,
    /\b(rung|trench|walks?|walking)\b/i,
    /\b(wants?|thinks?|believes?|decides?|chooses?|looks? at|looked|tries|trying|knows?|learns? to)\b/i,
    /\bpoint(s|ing)? the wrong way\b/i,
  ];
  let hits = 0;
  for (const s of strings) {
    for (const re of banned) {
      if (re.test(s)) {
        hits += 1;
        console.log(`  copy: "${s.slice(0, 80)}" matches ${re}`);
      }
    }
  }
  assert(hits === 0, `${strings.length} strings scanned; ${hits} carry a struck word`);
  assert(strings.some((s) => s.startsWith("Grad-CAM weights each feature map")), "the subtitle is the concept, in the register the arc uses");
}

console.log(`\n${checks} checks, ${failed} failed`);
if (failed) process.exit(1);
