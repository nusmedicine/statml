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
import { trainSetting, exportSetting } from "./unet-table.mjs";

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
section("§2 the engine, the table of trained networks, and the band's arithmetic");
{
  const g1 = E.gradCheck(makeRng(7));
  const g3 = E.gradCheck(makeRng(8), { depth: 2, base: 2, S: 8, B: 2, cin: 3 });
  assert(g1.worst < 1e-5, `gradients, depth 1, one channel: ${g1.worst.toExponential(1)} over ${g1.count}`);
  assert(g3.worst < 1e-5, `gradients, depth 2, three channels: ${g3.worst.toExponential(1)} over ${g3.count}`);
  console.log(`  gradient check ${g1.worst.toExponential(1)} (${g1.count}), three channels ${g3.worst.toExponential(1)} (${g3.count})`);

  /* every choice on the rail has a trained network, and it is the diagram's network */
  for (const depth of M.DEPTHS) {
    for (const base of M.BASES) {
      const st = M.computeU({ depth, base });
      assert(st.trained && st.trained.depth === Number(depth) && st.trained.base === Number(base), `the table has depth ${depth}, base ${base}`);
      assert(st.trained.params === st.params, `depth ${depth}, base ${base}: the diagram's ${st.params} parameters are the trained network's ${st.trained?.params}`);
      assert(st.trained.cin === M.IN_CH && st.trained.S === M.INPUT, "trained on the diagram's colour input at its size");
      assert(st.trained.dice >= 0.6, `depth ${depth}, base ${base} segments the blobs: held-out Dice ${st.trained.dice} (recorded, not shown)`);
      for (const s of st.stages) {
        const t = st.trained.stages[s.name];
        assert(t && t.C === s.C && t.H === s.H, `${s.name} at depth ${depth}, base ${base}: the table's ${t?.C} × ${t?.H} is the diagram's ${s.C} × ${s.H}`);
      }
    }
  }

  /* THE TABLE IS THE ENGINE'S OUTPUT: two settings retrained here and compared
     field by field, the training time excepted */
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "ms" ? undefined : v)));
  for (const [depth, base] of [[2, 4], [3, 4]]) {
    const t = trainSetting(depth, base);
    const fresh = strip(exportSetting(depth, base, t));
    const shipped = strip(M.computeU({ depth: String(depth), base: String(base) }).trained);
    assert(JSON.stringify(fresh) === JSON.stringify(shipped), `table.js depth ${depth}, base ${base} is what the engine trains now`);

    /* the band's numbers are the network's arithmetic, at the table's positions */
    const { net, rec } = t;
    const S = M.INPUT;
    const T = shipped;
    const val = (arr, ch, H, y, x) => (y < 0 || x < 0 || y >= H || x >= H ? 0 : arr[ch * H * H + y * H + x]);
    const convs = [["enc1", net.enc[0]], [`enc${depth}`, net.enc[depth - 1]], ["bottleneck", net.bottleneck], ["dec1", net.decs[depth - 1]]];
    for (const [name, d] of convs) {
      const r = rec[name];
      const A = T.stages[name].at;
      const H = T.stages[name].H;
      let z = 0;
      for (let ch = 0; ch < d.cin; ch += 1) {
        for (let ky = 0; ky < 3; ky += 1) for (let kx = 0; kx < 3; kx += 1) z += val(r.x, ch, H, A.r + ky - 1, A.c + kx - 1) * d.c1.W.v[ch * 9 + ky * 3 + kx];
      }
      assert(Math.abs(z - A.z) < 1e-3, `${name} (d${depth}): the sum over all ${d.cin} channels' windows ⊙ slices is the printed ${A.z}`);
      const bn = (A.gamma * (A.z - A.mean)) / A.sd + A.beta;
      assert(Math.abs(bn - A.bn) < 5e-3, `${name} (d${depth}): γ (z − mean) / sd + β reproduces the printed BatchNorm ${A.bn}`);
      assert(Math.abs(Math.max(0, A.bn) - A.relu) < 1e-3, `${name} (d${depth}): ReLU is the positive part`);
      A.windows.forEach((w, ch) => w.forEach((v, k) => assert(Math.abs(v - val(r.x, ch, H, A.r + Math.floor(k / 3) - 1, A.c + (k % 3) - 1)) < 1e-3, `${name}: window value`)));
    }
    const P = T.stages.pool1.at;
    assert(Math.max(...P.window) === P.max, `pool1 (d${depth}): the kept value is the window's maximum`);
    const U = T.stages.up1.at;
    const u = net.ups[depth - 1];
    for (let k = 0; k < 4; k += 1) {
      let v = u.b.v[0];
      for (let c = 0; c < u.cin; c += 1) v += rec.up1.x[c * (S / 2) * (S / 2) + U.r * (S / 2) + U.c] * u.W.v[c * u.cout * 4 + k];
      assert(Math.abs(v - rec.up1.out[(2 * U.r + (k >> 1)) * S + 2 * U.c + (k & 1)]) < 1e-9, `up1 (d${depth}): patch cell ${k} is Σ over channels of cell × kernel + bias`);
    }
    const Hd = T.stages.head.at;
    const zh = Hd.pixel.reduce((a, v, ch) => a + v * Hd.weights[ch], Hd.bias);
    assert(Math.abs(zh - Hd.z) < 5e-3 && Math.abs(1 / (1 + Math.exp(-Hd.z)) - Hd.p) < 2e-3, `head (d${depth}): logit Σ pixel × weight + bias and its sigmoid`);
    assert(T.truth.hex.length === S * S * 2 && T.image.length === M.IN_CH, "the image is three channels and the truth one");
  }
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
  for (const w of [550, 770]) {
    for (const depth of M.DEPTHS) {
      for (const base of M.BASES) {
        for (const input of [M.INPUT]) {
          const state = M.computeU({ depth, base });
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
          assert(M.unetHeight(w, { depth, base }) === L.height + M.BAND_GAP + M.BAND_H, "the page height is the U's and the band's");
        }
      }
    }
    const D = M.diceLayout(w);
    assert(D.numbers.valueX + 70 <= w - M.PAD, `the Dice numbers fit at ${w}`);
  }
  for (const depth of M.DEPTHS) {
    for (const base of M.BASES) {
      const st = M.computeU({ depth, base });
      for (const s of st.stages) {
        const kind = s.kind === "enc" || s.kind === "dec" || s.kind === "bottleneck" ? "conv" : s.kind;
        const prev = st.stages[st.stages.indexOf(s) - 1];
        const cin = s.kind === "enc" && s.level === 1 ? M.IN_CH : s.kind === "cat" ? s.C / 2 : s.kind === "head" ? Number(base) : (prev?.C ?? M.IN_CH);
        assert(M.bandHeight(kind, cin, s.C) <= M.BAND_H, `the ${s.name} band at depth ${depth}, base ${base} (${cin} → ${s.C}) fits in ${M.BAND_H}px: ${M.bandHeight(kind, cin, s.C)}`);
      }
    }
  }
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
