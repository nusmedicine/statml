/* ============================================================================
   Assertions on widget 65's engine, arithmetic, geometry and copy.

       node widgets/_lab/unet-verify.mjs

   Imports `widgets/unet/engine.js` and `model.js` — the shipping code, not a
   copy (5.8).

   §1 THE SHAPES AND THE COUNTS against torch: `_lab/unet-torch.py` runs the
   notebook's own `UNet2D`; `_lab/unet-torch.txt` holds what it printed.

   §2 THE ENGINE: every backward pass (BatchNorm in training mode, the
   transposed convolution, the concatenation, DiceCELoss) against central
   differences at two sizes; the trained network the band draws learns the
   blobs (held-out Dice ≥ 0.7); the band's own numbers are the network's
   arithmetic — the first convolution at the chosen position reproduces the
   stored pre-BatchNorm value, BatchNorm uses the running statistics, the pool
   keeps the window's maximum, the transposed patch is cell × kernel + bias,
   the concatenation is the up maps then the skip, and the head's sigmoid is
   its logit's. Training time is RECORDED and gates nothing.

   §3 THE DICE CLAIMS on the widget's own masks.

   §4 THE GEOMETRY: every slab inside the stage at 550 and 770 for every depth
   · base · input, the staircase steps inward, the bottleneck is the widest
   slab, every band of the trained network fits BAND_H, the regions resolve a
   point in each slab to that slab, and the Dice panel's pieces fit.

   §5 THE COPY: every string literal in main.js against the struck words.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";
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
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

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
  for (const base of [4, 8, 16]) {
    assert(M.paramCount(4, base) === params[base], `parameters at depth 4, base ${base}: ${M.paramCount(4, base)} against torch ${params[base]}`);
    for (const s of M.stagesFor(4, base, 64)) {
      const ref = shapes[base][s.name];
      assert(ref && ref.join(",") === M.shapeOf(s).join(","), `shape of ${s.name} at base ${base}: ${M.shapeOf(s)} against torch ${ref}`);
    }
  }
  assert(M.stagesFor(4, 16, 16).find((s) => s.kind === "bottleneck").H === 1, "depth 4 on a 16 × 16 input reaches a 1 × 1 bottleneck");
  console.log(`  parameters ${[4, 8, 16].map((b) => `${b}: ${M.paramCount(4, b)}`).join(", ")}`);
}

/* §2 ---------------------------------------------------------------------- */
section("§2 the engine, and the trained network the band draws");
{
  const g1 = E.gradCheck(makeRng(7));
  const g2 = E.gradCheck(makeRng(8), { depth: 2, base: 2, S: 8, B: 2 });
  assert(g1.worst < 1e-5, `gradients, depth 1: ${g1.worst.toExponential(1)} over ${g1.count}`);
  assert(g2.worst < 1e-5, `gradients, depth 2: ${g2.worst.toExponential(1)} over ${g2.count}`);
  console.log(`  gradient check ${g1.worst.toExponential(1)} (${g1.count}), ${g2.worst.toExponential(1)} (${g2.count})`);

  const T = M.trainedNet();
  console.log(`  trained: held-out Dice ${T.dice.toFixed(3)}, ${T.ms.toFixed(0)} ms (recorded, not gated), ${T.params} parameters, image ${T.index}, unit (${T.unit.r}, ${T.unit.c})`);
  assert(T.dice >= 0.7, `the trained network segments the blobs: held-out Dice ${T.dice.toFixed(3)}`);
  assert(T.truth[T.unit.r * M.TRAIN.S + T.unit.c] === 1, "the band's position is on the object");
  assert(T.unit.r >= 1 && T.unit.r <= M.TRAIN.S - 2 && T.unit.c >= 1 && T.unit.c <= M.TRAIN.S - 2, "a 3 × 3 window fits at the band's position");

  const { net, rec, unit } = T;
  const S = M.TRAIN.S;
  /* the first convolution of enc1 at the position, by hand */
  {
    const d = net.enc[0];
    const r = rec.enc1;
    let z = 0;
    for (let ky = 0; ky < 3; ky += 1) for (let kx = 0; kx < 3; kx += 1) z += r.x[(unit.r + ky - 1) * S + unit.c + kx - 1] * d.c1.W.v[ky * 3 + kx];
    assert(close(z, r.z1[unit.r * S + unit.c]), `enc1's window ⊙ slice reproduces the stored value (${z.toFixed(4)})`);
    const bn = d.n1.gamma.v[0] * (z - d.n1.rm[0]) / Math.sqrt(d.n1.rv[0] + E.EPS_BN) + d.n1.beta.v[0];
    assert(close(bn, r.n1[unit.r * S + unit.c]), "BatchNorm in the band uses the running statistics");
    assert(close(Math.max(0, bn), r.a1[unit.r * S + unit.c]), "ReLU is the positive part");
  }
  /* dec1's first convolution sums over all 8 input channels */
  {
    const d = net.decs[net.depth - 1];
    const r = rec.dec1;
    const cin = r.x.length / (S * S);
    let z = 0;
    for (let ch = 0; ch < cin; ch += 1) {
      for (let ky = 0; ky < 3; ky += 1) for (let kx = 0; kx < 3; kx += 1) z += r.x[ch * S * S + (unit.r + ky - 1) * S + unit.c + kx - 1] * d.c1.W.v[ch * 9 + ky * 3 + kx];
    }
    assert(cin === 8 && close(z, r.z1[unit.r * S + unit.c]), `dec1's first convolution is the sum over ${cin} channels`);
  }
  /* the pool keeps the maximum */
  {
    const p = rec.pool1;
    const h = S >> 1;
    const pr = M.unitAt(unit.r, h);
    const pc = M.unitAt(unit.c, h);
    const win = [0, 1, 2, 3].map((k) => p.x[(2 * pr + (k >> 1)) * S + 2 * pc + (k & 1)]);
    assert(Math.max(...win) === p.out[pr * h + pc], "pool1 keeps the window's maximum");
  }
  /* the transposed patch at one position: the bias plus every input channel's
     cell × kernel, which is why the band says the other channels add theirs */
  {
    const l = 1;
    const u = rec[`up${l}`];
    const layer = net.ups[net.depth - l];
    const h = u.h;
    const H = 2 * h;
    const pr = M.unitAt(unit.r, h);
    const pc = M.unitAt(unit.c, h);
    for (let k = 0; k < 4; k += 1) {
      let v = layer.b.v[0];
      for (let c = 0; c < layer.cin; c += 1) v += u.x[c * h * h + pr * h + pc] * layer.W.v[(c * layer.cout) * 4 + k];
      assert(close(v, u.out[(2 * pr + (k >> 1)) * H + 2 * pc + (k & 1)]), `up1's patch cell ${k} is Σ cell × kernel + bias`);
    }
  }
  /* the concatenation is the up maps, then the skip */
  {
    const c = rec.cat1;
    const HW = c.H * c.H;
    assert(c.out.subarray(0, c.C * HW).every((v, i) => v === c.up[i]), "cat1 starts with the upsampled channels");
    assert(c.out.subarray(c.C * HW).every((v, i) => v === c.enc[i]), "cat1 ends with the encoder's channels, unchanged");
  }
  /* the head */
  {
    const hd = rec.head;
    let z = net.head.bh.v[0];
    for (let ch = 0; ch < net.base; ch += 1) z += hd.x[ch * S * S + unit.r * S + unit.c] * net.head.Wh.v[ch];
    assert(close(z, hd.z[unit.r * S + unit.c]), "the head's logit is Σ channel × weight + bias");
    assert(close(hd.p[unit.r * S + unit.c], 1 / (1 + Math.exp(-z))), "the head's probability is the sigmoid of the logit");
  }
  assert(M.trainedStage("enc4") === "enc2" && M.trainedStage("up3") === "up2" && M.trainedStage("bottleneck") === "bottleneck" && M.trainedStage("head") === "head",
    "a deeper block maps to the trained network's block of the same kind");
}

/* §3 ---------------------------------------------------------------------- */
section("§3 the Dice claims on the widget's own masks");
{
  const read = (size, truth, pred, psize = "same", dx = 0, dy = 0) => M.computeDice({ size, truth, pred, psize, dx, dy }).m;
  assert(Object.keys(M.SIZES).join(",") === "medium,large", "the object sizes are medium and large (round 4)");
  assert(M.SHAPES.join(",") === "disc,rect,tri" && M.PRED_SHAPES.includes("none"), "the shapes are disc, rectangle and triangle, and the prediction may be none (round 5)");
  for (const size of M.SIZE_KEYS) {
    const want = M.SIZES[size].share;
    for (const shape of M.SHAPES) {
      const t = M.shapeMask(shape, want * M.G * M.G);
      const share = t.reduce((a, v) => a + v, 0) / (M.G * M.G);
      /* one shape a size: every shape within 12 % of the area it is drawn at */
      assert(Math.abs(share - want) / want < 0.12, `the ${size} ${shape} covers ${(100 * share).toFixed(2)}% (drawn at ${100 * want}%)`);
      const same = read(size, shape, shape);
      assert(same.dice === 1 && same.acc === 1, `${size} ${shape}, the same shape in place: Dice 1`);
      const none = read(size, shape, "none");
      assert(none.dice === 0 && none.B === 0 && close(none.acc, 1 - share), `${size} ${shape}, no prediction: Dice 0, accuracy ${none.acc.toFixed(3)} = the background's share`);
      const half = read(size, shape, shape, "half");
      const dbl = read(size, shape, shape, "double");
      assert(half.prec === 1 && Math.abs(half.rec - 0.5) < 0.08, `${size} ${shape}, half the area: precision 1, recall ${half.rec.toFixed(2)}`);
      assert(dbl.rec === 1 && Math.abs(dbl.prec - 0.5) < 0.08, `${size} ${shape}, twice the area: recall 1, precision ${dbl.prec.toFixed(2)}`);
    }
    for (const a of M.SHAPES) {
      for (const b of M.SHAPES) {
        if (a !== b) assert(read(size, a, b).dice < 0.9, `${size}: a ${b} predicted for a ${a}, centred, scores under 0.9`);
      }
    }
  }
  const off = read("medium", "disc", "disc", "same", 18, 0);
  assert(off.AB === 0 && off.acc > 0.89, `medium disc dragged clear: accuracy ${off.acc.toFixed(3)} with Dice 0`);
  /* the accuracy sentence's two numbers */
  assert(off.neither + off.AB === Math.round(off.acc * M.G * M.G) && off.A + off.B - 2 * off.AB === M.G * M.G - (off.neither + off.AB),
    "right pixels = both + neither, wrong = |A| + |B| − 2|A ∩ B|");
  for (const m of [off, read("medium", "tri", "rect", "half", 2, 1), read("large", "rect", "disc", "double", -3, 4)]) {
    assert(close(m.dice, m.A + m.B ? (2 * m.AB) / (m.A + m.B) : 0), "Dice is 2|A∩B| / (|A|+|B|)");
    assert(close(m.iou, m.dice / (2 - m.dice)), "IoU = Dice / (2 − Dice)");
  }
  const a = read("medium", "disc", "disc", "same", 1, 0);
  const b = read("medium", "disc", "disc", "same", 3, 0);
  assert(a.B === b.B && b.AB < a.AB, "a drag moves the prediction without changing its size, and the overlap falls");
  console.log(`  medium disc dragged clear: accuracy ${off.acc.toFixed(3)}, Dice 0; triangle for disc ${read("medium", "disc", "tri").dice.toFixed(2)}, rectangle for disc ${read("medium", "disc", "rect").dice.toFixed(2)}`);
}

/* §4 ---------------------------------------------------------------------- */
section("§4 the geometry at 550 and 770");
{
  const T = M.trainedNet();
  for (const w of [550, 770]) {
    for (const depth of M.DEPTHS) {
      for (const base of M.BASES) {
        for (const input of M.INPUTS) {
          const state = M.computeU({ depth, base, input });
          const L = M.uLayout(w, state);
          for (const s of state.stages) {
            const b = L.boxes[s.name];
            assert(b && b.x >= M.PAD && b.x + b.w <= w - M.PAD, `${s.name} inside at ${w} (depth ${depth}, base ${base}, input ${input})`);
          }
          const B = L.boxes;
          const tag = `at ${w} (depth ${depth}, base ${base}, input ${input})`;
          assert(L.right <= w - M.PAD - M.RIGHT_LABEL + 1e-9 && L.x0 - M.LEFT_LABEL >= M.PAD, `the U and its labels fit ${tag}`);
          /* every arrow starts and ends on a slab (round 3, "the connectors seem to float") */
          const within = (x, box) => x >= box.x - 1e-9 && x <= box.x + box.w + 1e-9;
          for (let l = 1; l <= Number(depth); l += 1) {
            const e = B[`enc${l}`];
            const p = B[`pool${l}`];
            assert(p.level === l + 1 && within(p.x + p.w / 2, e), `pool${l}'s arrow drops from enc${l} onto its slab ${tag}`);
            const u = B[`up${l}`];
            const below = l === Number(depth) ? B.bottleneck : B[`dec${l + 1}`];
            assert(within(u.x + u.w / 2, below), `up${l}'s arrow rises from the slab below ${tag}`);
            const c = B[`cat${l}`];
            assert(close(u.x + u.w, c.x + c.w, 1e-9) && close(u.w * 2, c.w, 1e-9), `up${l} is the right half of cat${l} ${tag}`);
            assert(c.x > e.x + e.w, `the skip at level ${l} runs left to right ${tag}`);
            assert(close(c.y, e.y) && close(B[`dec${l}`].y, e.y), `enc${l}, cat${l} and dec${l} share a row ${tag}`);
          }
          /* the bottleneck is centred under the U (round 3) */
          const centre = B.bottleneck.x + B.bottleneck.w / 2;
          assert(Math.abs(centre - (L.x0 + L.right) / 2) <= 6, `the bottleneck is centred: ${centre.toFixed(1)} against ${((L.x0 + L.right) / 2).toFixed(1)} ${tag}`);
          const enc = state.stages.filter((s) => s.kind === "enc").map((s) => B[s.name].x);
          assert(enc.every((x, i) => i === 0 || x > enc[i - 1]), `the encoder steps right going down ${tag}`);
          assert(M.unetHeight(w, { depth, base, input }) === L.height + M.BAND_GAP + M.BAND_H, "the page height is the U's and the band's");
        }
      }
    }
    const D = M.diceLayout(w);
    assert(D.numbers.valueX + 70 <= w - M.PAD, `the Dice numbers fit at ${w}`);
  }
  const net = T.net;
  const S = M.TRAIN.S;
  const kinds = [
    ["conv", 1, net.base], ["conv", 2 * net.base, net.base], ["conv", net.base * 2 ** (net.depth - 1), net.base * 2 ** net.depth],
    ["conv", 2 * net.base * 2, net.base * 2], ["pool", net.base * 2, net.base * 2], ["up", net.base * 4, net.base * 2],
    ["cat", net.base, net.base], ["head", net.base, 1],
  ];
  for (const [k, cin, cout] of kinds) assert(M.bandHeight(k, cin, cout) <= M.BAND_H, `the ${k} band (${cin} → ${cout}) fits in ${M.BAND_H}px: ${M.bandHeight(k, cin, cout)}`);
  void S;
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
    /\bwell\b/i, /\bplain\b/i, /\btrench\b/i, /\bframe\b/i, /\bchose\b/i, /\bwants?\b/i,
  ];
  for (const s of strings) {
    if (s.length < 12 || /^[\w-]+$/.test(s)) continue;
    if (/^<|var\(--/.test(s)) continue;
    for (const re of struck) assert(!re.test(s), `struck word ${re} in "${s.slice(0, 60)}"`);
  }
  console.log(`  ${strings.length} string literals read`);
}

console.log(`\n${checks} checks, ${failed} failed`);
if (failed) process.exit(1);
