/* ============================================================================
   Widget 65 · the table of trained U-Nets, generated here and shipped as
   `widgets/unet/table.js`.

       node widgets/_lab/unet-table.mjs

   WHY A TABLE AND NOT TRAINING IN THE PAGE (2026-09-15). Kenneth's picks: the
   network is chosen by Depth 2 · 3 · 4 and Base channels 4 · 8 on a 16 × 16
   colour image, and the diagram, the level table and the operation panel are
   one network. Trained in the page, base 8 would freeze it for 4.5–10 s on the
   first pick (core's compute is synchronous, so not even a "training…" line
   could show). At 16 × 16 what the panel draws is small, so the six networks are
   trained HERE, by the widget's own engine at its own seed, and the page reads
   them. `_lab/unet-verify.mjs` retrains two settings and holds the table to them,
   so the table is the engine's output and not a copy of it.

   WHAT IS STORED, a setting at a time: the colour image, the ground truth, the
   sigmoid and the mask; for every stage, its output maps as thumbnails (the
   first four channels, eight for a concatenation; quantised to 0–255 with the
   map's range) and the exact numbers the panel prints at its position; the
   parameter count and the training time as measured when the table was made.
   ========================================================================= */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
export const SPEC = { S: 16, cin: 3, n: 200, nTest: 60, epochs: 5, batch: 8, seed: 1, testSeed: 9000, shownRows: 2 };
export const SETTINGS = [[2, 4], [3, 4], [4, 4], [2, 8], [3, 8], [4, 8]];

const r3 = (v) => Math.round(v * 1000) / 1000;
/* BatchNorm's statistics at 4 decimals: at 3, dividing by a small sd carried the rounding past what the verify can hold */
const r4 = (v) => Math.round(v * 10000) / 10000;
function qmap(arr, off, n) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n * n; i += 1) { lo = Math.min(lo, arr[off + i]); hi = Math.max(hi, arr[off + i]); }
  let hex = "";
  for (let i = 0; i < n * n; i += 1) {
    const q = hi > lo ? Math.round(((arr[off + i] - lo) / (hi - lo)) * 255) : 0;
    hex += q.toString(16).padStart(2, "0");
  }
  return { n, lo: r3(lo), hi: r3(hi), hex };
}
const maps = (arr, C, H, k) => Array.from({ length: Math.min(k, C) }, (_, c) => qmap(arr, c * H * H, H));
/** the value of channel `ch` at (y, x) of a C × H × H array, zero outside (the conv's padding) */
const at = (arr, ch, H, y, x) => (y < 0 || x < 0 || y >= H || x >= H ? 0 : arr[ch * H * H + y * H + x]);
/** a position on a map of side H, scaled from the image's */
const scaled = (v, H, S) => Math.min(H - 1, Math.max(0, Math.floor((v * H) / S)));

/** the object pixel furthest right on the row through the object's centre */
function edgeUnit(mask, S) {
  let sy = 0;
  let n = 0;
  for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) if (mask[y * S + x]) { sy += y; n += 1; }
  const r = Math.min(S - 2, Math.max(1, Math.round(sy / Math.max(1, n))));
  let c = 1;
  for (let x = 0; x < S; x += 1) if (mask[r * S + x]) c = x;
  return { r, c: Math.min(S - 2, Math.max(1, c)) };
}

export function trainSetting(depth, base) {
  const { S, cin } = SPEC;
  const rng = makeRng(SPEC.seed);
  const data = E.makeData(S, SPEC.n, rng, cin);
  const test = E.makeData(S, SPEC.nTest, makeRng(SPEC.testSeed), cin);
  const net = E.makeUNet(depth, base, S, rng, cin);
  const t0 = performance.now();
  E.train(net, data, { epochs: SPEC.epochs, batch: SPEC.batch, rng });
  const ms = performance.now() - t0;
  const dice = E.evaluateDice(net, test);
  const HW = S * S;
  let index = 0;
  for (let i = 0; i < test.n; i += 1) {
    let area = 0;
    for (let k = 0; k < HW; k += 1) area += test.t[i * HW + k];
    if (area >= 24 && area <= 50) { index = i; break; }
  }
  const img = test.x.slice(index * cin * HW, (index + 1) * cin * HW);
  const truth = test.t.slice(index * HW, (index + 1) * HW);
  const rec = E.forward(net, img, 1);
  return { net, rec, img, truth, ms, dice, unit: edgeUnit(truth, S) };
}

export function exportSetting(depth, base, t) {
  const { S, cin, shownRows } = SPEC;
  const { net, rec, img, truth, unit } = t;
  const stages = {};
  const convAt = (d, r, H) => {
    const y = scaled(unit.r, H, S);
    const x = scaled(unit.c, H, S);
    const rows = Math.min(shownRows, d.cin);
    const windows = [];
    const slices = [];
    for (let ch = 0; ch < rows; ch += 1) {
      const w = [];
      const s = [];
      for (let ky = 0; ky < 3; ky += 1) {
        for (let kx = 0; kx < 3; kx += 1) {
          w.push(r3(at(r.x, ch, H, y + ky - 1, x + kx - 1)));
          s.push(r3(d.c1.W.v[ch * 9 + ky * 3 + kx]));
        }
      }
      windows.push(w);
      slices.push(s);
    }
    return {
      r: y, c: x, windows, slices,
      z: r4(r.z1[y * H + x]), bn: r3(r.n1[y * H + x]), relu: r3(r.a1[y * H + x]),
      gamma: r4(d.n1.gamma.v[0]), beta: r4(d.n1.beta.v[0]), mean: r4(d.n1.rm[0]), sd: r4(Math.sqrt(d.n1.rv[0] + E.EPS_BN)),
    };
  };
  let H = S;
  for (let l = 1; l <= depth; l += 1) {
    const d = net.enc[l - 1];
    const r = rec[`enc${l}`];
    stages[`enc${l}`] = { C: d.cout, H, maps: maps(r.out, d.cout, H, 4), at: convAt(d, r, H) };
    const p = rec[`pool${l}`];
    const h = H >> 1;
    const y = scaled(unit.r, h, S);
    const x = scaled(unit.c, h, S);
    const win = [0, 1, 2, 3].map((k) => r3(at(p.x, 0, H, 2 * y + (k >> 1), 2 * x + (k & 1))));
    stages[`pool${l}`] = { C: d.cout, H: h, maps: maps(p.out, d.cout, h, 4), at: { r: y, c: x, window: win, max: r3(p.out[y * h + x]) } };
    H = h;
  }
  const b = net.bottleneck;
  stages.bottleneck = { C: b.cout, H, maps: maps(rec.bottleneck.out, b.cout, H, 4), at: convAt(b, rec.bottleneck, H) };
  for (let i = 0; i < depth; i += 1) {
    const l = depth - i;
    const u = net.ups[i];
    const ur = rec[`up${l}`];
    const h = ur.h;
    /* the largest cell over every input channel and position: channel 0 alone
       was 0 at depth 4, base 8 (a 1 × 1 bottleneck), and a zero cell scatters
       nothing but the bias */
    let bestCh = 0;
    let best = 0;
    for (let ch = 0; ch < u.cin; ch += 1) {
      for (let k = 0; k < h * h; k += 1) if (ur.x[ch * h * h + k] > ur.x[bestCh * h * h + best]) { bestCh = ch; best = k; }
    }
    const y = Math.floor(best / h);
    const x = best % h;
    const Hu = 2 * h;
    stages[`up${l}`] = {
      C: u.cout, H: Hu, maps: maps(ur.out, u.cout, Hu, 4),
      at: {
        r: y, c: x, ch: bestCh, cell: r3(ur.x[bestCh * h * h + best]),
        kernel: [0, 1, 2, 3].map((k) => r3(u.W.v[bestCh * u.cout * 4 + k])), bias: r3(u.b.v[0]), cin: u.cin,
      },
    };
    const cat = rec[`cat${l}`];
    stages[`cat${l}`] = { C: 2 * cat.C, H: cat.H, maps: maps(cat.out, 2 * cat.C, cat.H, 8) };
    const d = net.decs[i];
    stages[`dec${l}`] = { C: d.cout, H: cat.H, maps: maps(rec[`dec${l}`].out, d.cout, cat.H, 4), at: convAt(d, rec[`dec${l}`], cat.H) };
  }
  const hd = rec.head;
  const { r: y, c: x } = unit;
  stages.head = {
    C: 1, H: S, maps: [qmap(hd.p, 0, S)],
    at: {
      r: y, c: x,
      pixel: Array.from({ length: net.base }, (_, ch) => r3(hd.x[ch * S * S + y * S + x])),
      weights: Array.from(net.head.Wh.v, r3), bias: r3(net.head.bh.v[0]),
      z: r3(hd.z[y * S + x]), p: r3(hd.p[y * S + x]),
    },
  };
  return {
    depth, base, S, cin, params: E.parameterCount(net), ms: Math.round(t.ms), dice: r3(t.dice), unit,
    image: maps(img, cin, S, cin), truth: qmap(truth, 0, S),
    mask: qmap(hd.p.map((v) => (v > 0.5 ? 1 : 0)), 0, S),
    stages,
  };
}

/* run as a script: train every setting and write the table */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const table = {};
  for (const [depth, base] of SETTINGS) {
    const t = trainSetting(depth, base);
    table[`d${depth}b${base}`] = exportSetting(depth, base, t);
    console.log(`depth ${depth} base ${base}: ${E.parameterCount(t.net)} parameters, trained in ${(t.ms / 1000).toFixed(1)} s, held-out Dice ${t.dice.toFixed(3)}`);
  }
  const body = JSON.stringify(table);
  const out = "/* GENERATED by widgets/_lab/unet-table.mjs — do not edit. Six U-Nets trained by\n"
    + "   widgets/unet/engine.js on 16 × 16 colour images; what the operation panel draws. */\n"
    + `export const SPEC = ${JSON.stringify(SPEC)};\nexport const TABLE = ${body};\n`;
  writeFileSync(join(here, "..", "unet", "table.js"), out);
  console.log(`wrote widgets/unet/table.js, ${(out.length / 1024).toFixed(0)} KB`);
}
