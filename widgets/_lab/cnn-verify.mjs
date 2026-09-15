/* ============================================================================
   Assertions on widget 61's arithmetic, geometry, maps and copy.

       node widgets/_lab/cnn-verify.mjs

   Imports `widgets/cnn-architecture/model.js` and `depict.js` — the shipping
   code and not a copy (5.8) — so the parameter counts the tiles print, the fit
   the stage is laid out with and the fit asserted here are one function.

   What needs a reader most:

   THE MEASURED NUMBERS (§1), catalogue § Slot 61 MEASURED 2026-09-13. The whole
   page rests on two of them — 19,977 against 47,625, and 10 px of 28 — and both
   are arithmetic no picture can settle.

   THE TWO RECEPTIVE FIELDS ARE ONE NUMBER (§2). The chain forward,
   r + (k − 1)·jump, and the window walked backward from one unit, lo·s − p, are
   two derivations of the same quantity; the figure PRINTS the first and DRAWS
   the second, so a disagreement would put a correct number under a wrong
   square. Asserted at every stage of every combination.

   THE MAPS ARE REAL (§3). Round 3 replaced a drawing of shapes with a drawing
   of results, so the results have to be checked: the horizontal-edge kernel is
   zero on a flat field, its answer on the cell's own boundaries is measured
   against a flat patch and the ratio printed at both image sizes (round 5's
   pick, and the number the image was chosen on), pooling halves, global average
   pooling is the mean, and the nine untrained scores reproduce from the seed
   over every value the head produces.

   THE SECOND BLOCK'S KERNELS ARE NAMED ON A MEASUREMENT (§3b, round 6). Until
   round 6 conv2 ran the first block's four operators over one channel each,
   and the check here said so — *"the second block runs the same four operators
   rotated"*. That is gone, because the arithmetic is gone: a conv2 kernel is
   now a 4 × 3 × 3 weight and a bias over every input channel, and what each
   answers to is MEASURED against the parts of the cell rather than asserted
   from its name. §3b copies the round-6 mock's own region method, so what
   named the four is what checks them.

   THE TWO WALKS WERE ONE WALK (§2, §8, round 6). The kernel's window on its
   immediate source and the innermost window of a unit's receptive field are
   the same two numbers at every cell of every network — which is why the
   figure now walks once, and why that identity is asserted before the phases
   are driven.

   NO TWO STRINGS ON ONE BASELINE OVERLAP (§6, §9). The depiction mock had two
   collisions — `Input [28, 28]` against `Window [3, 3]`, and the output map's
   name against the output value's index — and both were one baseline shared by
   two labels 80px apart. Rather than nudge an x, the band puts a MAP's lines
   below its map and a CELL BLOCK's line above its cells, and this file asserts
   the general property over every string the figure paints: same baseline, no
   overlap, nothing off either edge.

   THE LIMITS OF THAT MEASUREMENT, stated rather than discovered later. The stub
   below returns 6px a character for every glyph at every size. That is close to
   what an 11–12px system font averages and it is deliberately blunt: it is a
   BOUND, not the browser's metric, so a string that clears by two pixels here
   may not clear in the browser, a run of narrow digits is over-counted and a
   run of capitals under-counted. It catches a label twice its box; it does not
   certify kerning.

   ONE WALK, IN TWO STAGES (§8). Before the gate Step and Play run the layers
   and stop; behind it they move the marked unit over every cell of the chosen
   map, the map filling up to the cell the unit is on. Asserted on two clocks:
   one press a call says every cell is visited exactly once in reading order —
   read off the figure's own printed line, not off the counter that drives it —
   and the harness's 32ms says each stage takes the wall time `model.js`
   declares. THE FILL IS CHECKED BY COUNTING RECTANGLES, because a progressive
   fill paints one rectangle a cell and no string at all, so nothing in the
   painted list can say how far it has got.

   Exits non-zero on failure. Timings are recorded and gate nothing.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../cnn-architecture/model.js";
import * as D from "../cnn-architecture/depict.js";
import { makeRng } from "../core/rng.js";
import { resolveParams, toQuery } from "../core/params.js";
/* core's own hit-test, so a click resolves exactly as the browser resolves it */
globalThis.document ??= { querySelector: () => null };
const { hitTest } = await import("../core/canvas.js");

const T0 = performance.now();
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 76)} ${detail}`);
}
const timings = [];
const timed = (label, fn) => {
  const t = performance.now();
  const v = fn();
  timings.push(`${label} ${Math.round(performance.now() - t)}ms`);
  return v;
};

const src = read("widgets/cnn-architecture/main.js");
const depictSrc = read("widgets/cnn-architecture/depict.js");
const manifest = JSON.parse(read("widgets/manifest.json"));
const card = manifest.widgets.find((w) => w.slug === "cnn-architecture");

const DEFAULT = M.buildNet();
const FLATTEN = M.buildNet({ head: "flatten" });
const B3 = M.buildNet({ blocks: 3 });
const K5B3 = M.buildNet({ blocks: 3, k: 5 });
const IN64 = M.buildNet({ input: 64 });
const IN64F = M.buildNet({ input: 64, head: "flatten" });

const EVERY = [];
for (const blocks of [1, 2, 3]) {
  for (const base of [16, 32]) {
    for (const k of [3, 5]) {
      for (const head of ["flatten", "gap"]) {
        for (const input of [28, 64]) EVERY.push({ blocks, base, k, head, input });
      }
    }
  }
}
const HARNESS_W = 535;   // the width the fingerprint's side layout draws at

/* --- 1 · the measured numbers ---------------------------------------------- */
console.log("\n1 · the measured numbers (catalogue § Slot 61)");
{
  check("conv1 costs 896", DEFAULT.stages[1].params === 896, DEFAULT.stages[1].params);
  check("conv2 costs 18,496", DEFAULT.stages[3].params === 18496, DEFAULT.stages[3].params);
  /* ROUND 6: the drawn kernels carry a bias, and the count on screen already
     paid for it — `C · out · k · k + out`, one term an output channel. */
  check("a convolution's count is its weights plus one bias an output channel",
    EVERY.every((cfg) => {
      const net = M.buildNet(cfg);
      let C = 3;
      return net.stages.slice(1).filter((s) => s.kind === "conv").every((s, b) => {
        const out = cfg.base * 2 ** b;
        const ok = s.params === C * out * cfg.k * cfg.k + out;
        C = out;
        return ok;
      });
    }),
    `conv1 ${DEFAULT.stages[1].params} = 3 × 32 × 9 + 32, conv2 ${DEFAULT.stages[3].params} `
      + "= 32 × 64 × 9 + 64 — the 32 and the 64 are the biases");
  check("the Flatten head costs 28,233", FLATTEN.headParams === 28233, FLATTEN.headParams);
  check("…for 47,625 in all", FLATTEN.total === 47625, FLATTEN.total);
  check("the global average pooling head costs 585", DEFAULT.headParams === 585, DEFAULT.headParams);
  check("…for 19,977 in all", DEFAULT.total === 19977, DEFAULT.total);
  check("the head is 59% of the Flatten model and 3% of the other",
    Math.round((FLATTEN.headParams / FLATTEN.total) * 100) === 59
    && Math.round((DEFAULT.headParams / DEFAULT.total) * 100) === 3);
  check("the receptive field of the last feature map is 10 px", DEFAULT.r === 10, DEFAULT.r);
  check("…reached as 1 → 3 → 4 → 8 → 10 at jump 4",
    DEFAULT.rf.map((v) => v.r).join(" ") === "1 3 4 8 10" && DEFAULT.jump === 4,
    `${DEFAULT.rf.map((v) => v.r).join(" → ")} jump ${DEFAULT.jump}`);
  check("a dense layer from 28 × 28 × 3 to 1,000 units costs 2,353,000",
    DEFAULT.dense === 2353000, DEFAULT.dense);
  check("…and from 256 × 256 × 3, 196,609,000",
    256 * 256 * 3 * M.DENSE_UNITS + M.DENSE_UNITS === 196609000);
  check("the last feature map is [64, 7, 7], so Flatten's input is 3,136",
    DEFAULT.C === 64 && DEFAULT.H === 7 && FLATTEN.headIn === 3136, FLATTEN.headIn);
  check("Flatten's head grows 5.22× from image 28 to 64 and the other does not move",
    Math.abs(IN64F.headParams / FLATTEN.headParams - 5.22) < 0.01
    && IN64.headParams === DEFAULT.headParams,
    (IN64F.headParams / FLATTEN.headParams).toFixed(2));
  check("a column a press: the layers, then the head, then the linear layer",
    DEFAULT.units === DEFAULT.layers.length + 2 && DEFAULT.units === 6
    && B3.units === 7 && M.buildNet({ blocks: 1 }).units === 4,
    `${M.buildNet({ blocks: 1 }).units} / ${DEFAULT.units} / ${B3.units} presses`);
}

/* --- 2 · the receptive field, forward and backward -------------------------- */
console.log("\n2 · the receptive field, forward and backward");
{
  check("three blocks at kernel 3 reach 18 px, not cell 25's 26", B3.r === 18, B3.r);
  check("…and cell 25's own third block of two convolutions would reach 26",
    DEFAULT.r + 2 * (3 - 1) * DEFAULT.jump === 26);
  check("kernel 5 at three blocks reaches 32 px, wider than the 28 px image",
    K5B3.r === 32, `${K5B3.r} of ${K5B3.cfg.input}`);
  check("…and the window on the image leaves it on both sides", (() => {
    const st = M.stagesFor(K5B3);
    const last = D.lastSpatial(st);
    const c = M.centreUnit(K5B3, last);
    const span = D.receptiveField(st, last, c, c).cols[0];
    return span[0] < 0 && span[1] > K5B3.cfg.input - 1;
  })());

  let worst = null;
  for (const cfg of EVERY) {
    const net = M.buildNet(cfg);
    const st = M.stagesFor(net);
    for (let stage = 1; stage <= net.layerUnits; stage += 1) {
      const c = M.centreUnit(net, stage);
      const span = D.receptiveField(st, stage, c, c).cols[0];
      const back = span[1] - span[0] + 1;
      if (back !== net.rf[stage].r) worst = `${JSON.stringify(cfg)} stage ${stage}: ${back} ≠ ${net.rf[stage].r}`;
    }
  }
  check("the backward window equals the forward r at every stage of every network",
    worst === null, worst ?? `${EVERY.length} networks`);
  check("a unit of the image reads one pixel",
    D.receptiveField(M.stagesFor(DEFAULT), 0, 3, 3).cols[0].join() === "3,3");
  check("the chain is monotone and the jump doubles at every pool", EVERY.every((cfg) => {
    const net = M.buildNet(cfg);
    return net.rf.every((v, i) => i === 0 || v.r >= net.rf[i - 1].r)
      && net.jump === 2 ** net.layers.filter((L) => L.s === 2).length;
  }));

  /* the window at the two ends of a row clips on the side it should */
  const wrong = [];
  for (const cfg of EVERY) {
    const net = M.buildNet(cfg);
    const st = M.stagesFor(net);
    const n = net.cfg.input;
    for (let stage = 1; stage <= net.layerUnits; stage += 1) {
      const H = net.stages[stage].H;
      const first = D.receptiveField(st, stage, 0, 0).cols[0];
      const last = D.receptiveField(st, stage, H - 1, H - 1).cols[0];
      const r = first[1] - first[0] + 1;
      if (!(first[0] < 0)) wrong.push(`${JSON.stringify(cfg)} ${stage}: first ${first}`);
      if (!(last[1] > n - 1)) wrong.push(`${JSON.stringify(cfg)} ${stage}: last ${last}`);
      if (r <= n && (first[1] > n - 1 || last[0] < 0)) {
        wrong.push(`${JSON.stringify(cfg)} ${stage}: clipped at both ends`);
      }
    }
  }
  check("the first cell of a row runs off the left of the image and the last off the right",
    wrong.length === 0, wrong.slice(0, 3).join(" | "));

  /* ROUND 6's MERGE RESTS ON THIS ONE IDENTITY. The kernel's own window on the
     immediate source and the innermost window of the unit's receptive field
     are the same two numbers, because one step of the backward recursion
     `lo → lo·s − p` IS the kernel's window. That is why the two walks the
     widget used to run were one walk drawn twice, and why one walk now carries
     both readings. */
  let agree = 0;
  let checked = 0;
  const off = [];
  for (const cfg of EVERY) {
    const net = M.buildNet(cfg);
    const st = M.stagesFor(net);
    for (let stage = 1; stage <= net.layerUnits; stage += 1) {
      const H = net.stages[stage].H;
      const op = st[stage].op;
      for (let r = 0; r < H; r += 1) {
        for (let c = 0; c < H; c += 1) {
          const rf = D.receptiveField(st, stage, r, c);
          const want = [
            [r * op.s - op.p, r * op.s - op.p + op.k - 1],
            [c * op.s - op.p, c * op.s - op.p + op.k - 1],
          ];
          checked += 1;
          if (rf.rows[stage - 1].join() === want[0].join()
            && rf.cols[stage - 1].join() === want[1].join()) agree += 1;
          else if (off.length < 3) off.push(`${JSON.stringify(cfg)} ${stage} [${r}, ${c}]`);
        }
      }
    }
  }
  check("the kernel's window on its input is the innermost window of the receptive field",
    agree === checked, `${agree} of ${checked} cells over ${EVERY.length} networks`
      + (off.length ? ` | ${off.join(" | ")}` : ""));
  check("…and on the default network that is every cell of conv1, pool1, conv2 and pool2",
    (() => {
      const st = M.stagesFor(DEFAULT);
      let n = 0;
      for (let stage = 1; stage <= DEFAULT.layerUnits; stage += 1) n += DEFAULT.stages[stage].H ** 2;
      return n === 1225 && st.length === 7;
    })(), "1,225 of 1,225 — the round-6 mock's own count");
}

/* --- 3 · the maps the figure draws ----------------------------------------- */
console.log("\n3 · the maps");
const MAPS = timed("compute, every combination", () => EVERY.map((cfg) => {
  const net = M.buildNet(cfg);
  return { cfg, net, maps: M.computeMaps(net, makeRng(1)) };
}));
{
  const def = MAPS.find((m) => m.cfg.blocks === 2 && m.cfg.base === 32 && m.cfg.k === 3
    && m.cfg.head === "gap" && m.cfg.input === 28);
  check("the horizontal-edge kernel is zero inside a constant field",
    M.flatResponse(28) === 0, M.flatResponse(28).toFixed(12));
  /* ROUND 5's IMAGE, on the measurement it was picked on: the mean |response|
     of a kernel on the cell's own boundaries against a flat patch, at both
     image sizes. The blob it replaces managed 2.1 × here. */
  const con = M.edgeContrast(def.maps.tex, 28);
  const con64 = M.edgeContrast(M.texture(64, makeRng(1)), 64);
  check("the horizontal-edge kernel answers 27 × louder on the cell's boundaries than on a flat patch",
    con.ratio > 20 && con.ratio < 35,
    `boundary ${con.edge.toFixed(4)} · flat ${con.flat.toFixed(4)} · `
      + `${con.ratio.toFixed(2)} × over ${con.nb} boundary pixels and ${con.nf} flat, at noise ${M.NOISE}`);
  check("…and 28 × at 64 px, because the same picture is drawn at both sizes",
    con64.ratio > 20 && con64.ratio < 35,
    `boundary ${con64.edge.toFixed(4)} · flat ${con64.flat.toFixed(4)} · ${con64.ratio.toFixed(2)} ×`);
  check("…and the other three named operators separate the same two sets", (() => {
    const r = [1, 2, 3].map((i) => M.edgeContrast(def.maps.tex, 28, i).ratio);
    return r.every((v) => Number.isFinite(v) && v > 1.5);
  })(), [1, 2, 3].map((i) => `${M.KERNELS[i].short} ${M.edgeContrast(def.maps.tex, 28, i).ratio.toFixed(1)} ×`).join(" · "));
  check("the cell is written in coordinates of n / 28, so 64 is the same picture sampled finer",
    (() => {
      const g28 = M.cellGeom(28);
      const g64 = M.cellGeom(64);
      const k = 64 / 28;
      return Math.abs(g64.R - g28.R * k) < 1e-9 && Math.abs(g64.cx - g28.cx * k) < 1e-9
        && M.cellParts(28).length === 784 && M.cellParts(64).length === 4096;
    })());
  check("every part of the cell is drawn at both sizes",
    new Set(M.cellParts(28)).size === 7 && new Set(M.cellParts(64)).size === 7,
    `${new Set(M.cellParts(28)).size} parts: the field, the body, the membrane, the nucleus and three granules`);
  check("the image is seeded, reproducible and inside [0, 1]", (() => {
    const a = M.texture(28, makeRng(1));
    const b = M.texture(28, makeRng(1));
    return a.length === 784 && a.every((v, i) => v === b[i] && v >= 0 && v <= 1);
  })());
  check("every map of every combination is finite",
    MAPS.every((m) => m.maps.stages.every((s) => s.every((a) => a.every(Number.isFinite))))
    && MAPS.every((m) => m.maps.head.every(Number.isFinite) && m.maps.scores.every(Number.isFinite)));
  check("four channels are drawn at every layer, one at the image",
    MAPS.every((m) => m.maps.stages[0].length === 1
      && m.maps.stages.slice(1).every((s) => s.length === D.SHOWN)));
  check("every map is the size its stage's shape says",
    MAPS.every((m) => m.maps.stages.every((s, i) =>
      s.every((a) => a.length === m.net.stages[i].H ** 2))));
  check("ReLU leaves no negative value in a convolution's map",
    MAPS.every((m) => m.net.stages.every((s, i) =>
      s.kind !== "conv" || m.maps.stages[i].every((a) => a.every((v) => v >= 0)))));
  check("a pooling stage halves its input and is its 2 × 2 maxima",
    MAPS.every((m) => m.net.stages.every((s, i) => {
      if (s.kind !== "pool") return true;
      const n = m.net.stages[i - 1].H;
      return m.maps.stages[i].every((a, c) => a.every((v, j) => {
        const r = Math.floor(j / s.H);
        const q = j % s.H;
        return Math.abs(v - Math.max(...M.poolWindowAt(m.maps.stages[i - 1][c], n, r, q).flat())) < 1e-12;
      }));
    })));
  check("global average pooling is the mean of each drawn channel",
    MAPS.filter((m) => m.cfg.head === "gap").every((m) => {
      const last = m.maps.stages[m.maps.stages.length - 1];
      return m.maps.headAll.length === D.SHOWN
        && m.maps.headAll.every((v, c) => Math.abs(v - M.meanOf(last[c])) < 1e-12);
    }));
  check("Flatten hands the linear layer every cell of every drawn channel, in order",
    MAPS.filter((m) => m.cfg.head === "flatten").every((m) => {
      const last = m.maps.stages[m.maps.stages.length - 1];
      const cells = last[0].length;
      return m.maps.headAll.length === D.SHOWN * cells
        && m.maps.headAll.every((v, i) => v === last[Math.floor(i / cells)][i % cells]);
    }), `${MAPS.find((m) => m.cfg.head === "flatten" && m.cfg.blocks === 2 && m.cfg.input === 28
      && m.cfg.base === 32 && m.cfg.k === 3).maps.headAll.length} values drawn, of `
      + `${FLATTEN.headIn} the network holds`);
  check("…and the head column draws the first 49 of one channel",
    MAPS.filter((m) => m.cfg.head === "flatten").every((m) => {
      const last = m.maps.stages[m.maps.stages.length - 1];
      return m.maps.head.length === D.STRIP && m.maps.head.every((v, i) => v === last[0][i]);
    }), `${D.STRIP} of ${FLATTEN.headIn}`);
  check("the nine scores come from the seeded rng and reproduce",
    (() => {
      const a = M.computeMaps(DEFAULT, makeRng(1)).scores;
      const b = M.computeMaps(DEFAULT, makeRng(1)).scores;
      return a.length === M.CLASSES && a.every((v, i) => v === b[i])
        && M.computeMaps(DEFAULT, makeRng(2)).scores.some((v, i) => v !== a[i]);
    })());
  check("every score is the weights against EVERY value the head produced (round 5, point 3)",
    MAPS.every((m) => m.maps.scores.every((v, c) =>
      Math.abs(v - m.maps.weights[c].reduce((a, wv, i) => a + wv * m.maps.headAll[i], 0)) < 1e-12)
      && m.maps.weights.every((r) => r.length === m.maps.headAll.length)),
    `${MAPS.filter((m) => m.cfg.head === "flatten")[0].maps.headAll.length} inputs under Flatten, `
      + `${MAPS.filter((m) => m.cfg.head === "gap")[0].maps.headAll.length} under the other head`);
  check("…so the two heads do not reach the linear layer with the same numbers", (() => {
    const a = M.computeMaps(M.buildNet({ head: "flatten" }), makeRng(1));
    const b = M.computeMaps(M.buildNet({ head: "gap" }), makeRng(1));
    return a.headAll.length !== b.headAll.length && a.scores.some((v, i) => v !== b.scores[i]);
  })());
  check("every score is finite under every combination",
    MAPS.every((m) => m.maps.scores.every(Number.isFinite) && m.maps.scores.length === M.CLASSES));
  check("…at torch's own bound for a linear layer of the head's real width",
    MAPS.every((m) => {
      const b = 1 / Math.sqrt(m.net.headIn);
      return m.maps.weights.every((r) => r.every((v) => Math.abs(v) <= b + 1e-12));
    }));
  check("a kernel of 5 is the same operator with a ring of zeros",
    (() => {
      const k5 = M.kernelAt(M.KERNELS[0].k, 5);
      const ring = k5[0].concat(k5[4], k5.map((r) => r[0]), k5.map((r) => r[4]));
      return k5.length === 5 && ring.every((v) => v === 0)
        && k5[1].slice(1, 4).join() === M.KERNELS[0].k[0].join();
    })());
  check("…so the map at kernel 5 is the map at kernel 3", (() => {
    const a = M.computeMaps(M.buildNet({ k: 3 }), makeRng(1)).stages[1][0];
    const b = M.computeMaps(M.buildNet({ k: 5 }), makeRng(1)).stages[1][0];
    return a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
  })());
  check("a pooling column keeps the name of the operator above it",
    MAPS.every((m) => m.net.stages.every((s, i) =>
      s.kind !== "pool" || m.maps.kernels[i] === m.maps.kernels[i - 1])));
}

/* --- 3b · the second block's four cross-channel kernels --------------------- */
/* ROUND 6, Kenneth: *"the second conv2 should have different kernels? for
   higher order features?"* The four are named on a MEASUREMENT, so the
   measurement is the check — and the method is the round-6 mock's, copied here
   so what named them is what asserts them.

   `cellParts` gives the part each image pixel belongs to. The nucleus is split
   into its rim and its inside, because a kernel that finds a dark region
   inside a bright one answers at the rim; the three boundary classes are
   dilated by one pixel, because a 3 × 3 operator answers a boundary one pixel
   wide of it on both sides and without the dilation every edge kernel is
   counted as having missed; and at the 14 × 14 grid a cell takes the label its
   four image pixels hold in majority. ENRICHMENT is the share of the map's
   response mass in a part over that part's share of the area, so 1.00 is no
   preference and the largest it can be is one over the area share. */
console.log("\n3b · the second block's kernels, and what they are measured to find");
const REGIONS = ["field", "cell body", "membrane", "nucleus rim", "nucleus", "granules"];
{
  const N0 = 28;
  const BOUNDARY = [5, 2, 3];
  const PRIORITY = [5, 2, 3, 4, 1, 0];
  const labels28 = () => {
    const p = M.cellParts(N0);
    const out = new Int8Array(N0 * N0);
    for (let i = 0; i < N0 * N0; i += 1) {
      const v = p[i];
      if (v >= 4) out[i] = 5;
      else if (v === 2) out[i] = 2;
      else if (v === 3) {
        out[i] = [i - 1, i + 1, i - N0, i + N0]
          .some((q) => q >= 0 && q < N0 * N0 && p[q] !== 3) ? 3 : 4;
      } else out[i] = v === 1 ? 1 : 0;
    }
    const dil = Int8Array.from(out);
    for (let i = 0; i < N0 * N0; i += 1) {
      if (out[i] !== 0 && out[i] !== 1 && out[i] !== 4) continue;
      for (const q of [i - 1, i + 1, i - N0, i + N0]) {
        if (q >= 0 && q < N0 * N0 && BOUNDARY.includes(out[q])) dil[i] = out[q];
      }
    }
    return dil;
  };
  const labelsAt = (n) => {
    const src = labels28();
    const f = N0 / n;
    const out = new Int8Array(n * n);
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const c = new Array(REGIONS.length).fill(0);
        for (let j = 0; j < f; j += 1) {
          for (let i = 0; i < f; i += 1) c[src[(y * f + j) * N0 + (x * f + i)]] += 1;
        }
        let bestN = -1;
        let best = 0;
        for (const p of PRIORITY) if (c[p] > bestN) { bestN = c[p]; best = p; }
        out[y * n + x] = best;
      }
    }
    return out;
  };
  const areaShares = (lab, n) => REGIONS.map((_, r) => {
    let a = 0;
    for (let i = 0; i < n * n; i += 1) if (lab[i] === r) a += 1;
    return a / (n * n);
  });
  const enrich = (map, lab, n) => {
    const area = areaShares(lab, n);
    const mass = new Array(REGIONS.length).fill(0);
    let total = 0;
    for (let i = 0; i < n * n; i += 1) { mass[lab[i]] += map[i]; total += map[i]; }
    const rows = REGIONS.map((name, r) => ({
      name,
      enr: total > 0 && area[r] > 0 ? (mass[r] / total) / area[r] : 0,
      ceiling: area[r] > 0 ? 1 / area[r] : 0,
    }));
    return { rows, best: rows.reduce((a, b) => (b.enr > a.enr ? b : a), rows[0]) };
  };

  const maps2 = M.computeMaps(DEFAULT, makeRng(1));
  const LAB = labelsAt(14);
  const AREA = areaShares(LAB, 14);
  const WANT = { Membrane: "membrane", Granule: "granules", Body: "cell body", Nucleus: "nucleus" };
  const measured = M.CONV2_KERNELS.map((K, c) => ({ K, e: enrich(maps2.stages[3][c], LAB, 14) }));

  check("conv2 carries four kernels, each a 3 × 3 slice over every drawn input channel plus a bias",
    M.CONV2_KERNELS.length === D.SHOWN
    && M.CONV2_KERNELS.every((K) => K.W.length === D.SHOWN && Number.isFinite(K.bias)
      && K.W.every((s) => s === null || (s.length === 3 && s.every((r) => r.length === 3)))),
    M.CONV2_KERNELS.map((K) => `${K.short} bias ${K.bias}`).join(" · "));
  check("…and two of the four read only two input channels, which the slice picture draws",
    M.CONV2_KERNELS.filter((K) => K.W.filter(Boolean).length === 2).length === 2
    && M.CONV2_KERNELS.every((K) => K.W.some(Boolean)),
    M.CONV2_KERNELS.map((K) => `${K.short} reads ${K.W.filter(Boolean).length}`).join(" · "));
  check("every conv2 map is the four slices over the four pool1 channels, the bias, then ReLU",
    (() => {
      const wrongCell = [];
      for (let c = 0; c < D.SHOWN; c += 1) {
        const K = M.CONV2_KERNELS[c];
        for (let r = 0; r < 14; r += 1) {
          for (let q = 0; q < 14; q += 1) {
            let a = K.bias;
            K.W.forEach((slice, ci) => {
              if (!slice) return;
              const win = M.windowAt(maps2.stages[2][ci], 14, r, q, 3);
              for (let j = 0; j < 3; j += 1) for (let i = 0; i < 3; i += 1) a += win[j][i] * slice[j][i];
            });
            if (Math.abs(Math.max(0, a) - maps2.stages[3][c][r * 14 + q]) > 1e-12) {
              wrongCell.push(`${K.short} [${r}, ${q}]`);
            }
          }
        }
      }
      return wrongCell.length === 0;
    })(), "784 cells, recomputed from the slices");
  check("each of the four is most enriched in the part it is named for, at 3 × or more",
    measured.every(({ K, e }) => e.best.name === WANT[K.short] && e.best.enr >= 3),
    measured.map(({ K, e }) =>
      `${K.short} ${e.best.name} ${e.best.enr.toFixed(2)} × (ceiling ${e.best.ceiling.toFixed(1)})`)
      .join(" · "));
  check("…measured against the parts the image is drawn from, not against an intention",
    Math.abs(AREA[2] - 0.219) < 0.002 && Math.abs(AREA[5] - 0.051) < 0.002,
    REGIONS.map((n, i) => `${n} ${(100 * AREA[i]).toFixed(1)}%`).join(" · "));
  /* THE ROUND'S OWN FINDING, restated as an experiment on the shipped four:
     drop the bias and the same weights stop selecting. Every input channel is
     non-negative after ReLU, so a sum of positive weights is a brightness, and
     the threshold is what turns a brightness into a feature. */
  const unbiased = M.CONV2_KERNELS.map((K) => {
    const map = new Float64Array(196);
    for (let r = 0; r < 14; r += 1) {
      for (let q = 0; q < 14; q += 1) {
        let a = 0;
        K.W.forEach((slice, ci) => {
          if (!slice) return;
          const win = M.windowAt(maps2.stages[2][ci], 14, r, q, 3);
          for (let j = 0; j < 3; j += 1) for (let i = 0; i < 3; i += 1) a += win[j][i] * slice[j][i];
        });
        map[r * 14 + q] = Math.max(0, a);
      }
    }
    return enrich(map, LAB, 14);
  });
  check("…and the three that carry a bias fall under 3 × without it, while the one at 0 does not move",
    M.CONV2_KERNELS.every((K, i) => {
      const own = unbiased[i].rows.find((r) => r.name === WANT[K.short]).enr;
      return K.bias === 0
        ? Math.abs(own - measured[i].e.best.enr) < 1e-9
        : own < 3 && own < measured[i].e.best.enr;
    }),
    M.CONV2_KERNELS.map((K, i) =>
      `${K.short} ${unbiased[i].best.name} ${unbiased[i].best.enr.toFixed(2)} × `
      + `(with the bias ${measured[i].e.best.enr.toFixed(2)} ×)`).join(" · "));

  /* THE THIRD BLOCK: the same four, over inputs scaled to the range the second
     block read. The biases are thresholds and the second block's own output
     runs to 0.12 against the first block's 2.82, so unscaled inputs would
     leave whole maps at zero. */
  const B3M = M.computeMaps(B3, makeRng(1));
  check("conv3 is conv2's four kernels, by identity and not by a copy",
    B3M.kernels[5] === M.CONV2_KERNELS && B3M.kernels[3] === M.CONV2_KERNELS
    && B3M.kernels[1] === M.KERNELS,
    B3M.kernels[5].map((K) => K.short).join(" · "));
  check("…over pool2's channels, each scaled to the largest value pool1 held",
    (() => {
      const ref = Math.max(...B3M.stages[2].map(M.maxOf));
      return B3M.reads[5].every((m, c) => Math.abs(M.maxOf(m) - ref) < 1e-9
        && m.every((v, i) => Math.abs(v - (B3M.stages[4][c][i] * ref) / M.maxOf(B3M.stages[4][c])) < 1e-12));
    })(),
    `pool1 to ${Math.max(...B3M.stages[2].map(M.maxOf)).toFixed(2)}, `
      + `pool2 to ${B3M.stages[4].map((m) => M.maxOf(m).toFixed(2)).join(" / ")}`);
  check("…and the first two blocks read their input as it is",
    B3M.reads[1] === B3M.stages[0] && B3M.reads[3] === B3M.stages[2]);
  check("…so every conv3 map has something in it, which unscaled inputs do not give",
    B3M.stages[5].every((m) => m.some((v) => v > 1e-9)),
    B3M.stages[5].map((m, c) => `${M.CONV2_KERNELS[c].short} ${m.filter((v) => v > 1e-9).length}/49`)
      .join(" · "));
  check("a cross-channel kernel at k = 5 is the 3 × 3 slices with a ring of zeros, the bias unmoved",
    (() => {
      const s5 = M.slicesAt(M.CONV2_KERNELS[0].W, 5);
      const filled = s5.filter(Boolean);
      return filled.length === M.CONV2_KERNELS[0].W.filter(Boolean).length
        && s5[2] === null
        && filled.every((K) => K.length === 5
          && K[0].concat(K[4], K.map((r) => r[0]), K.map((r) => r[4])).every((v) => v === 0))
        && filled[0][2].slice(1, 4).join() === M.CONV2_KERNELS[0].W[0][1].join();
    })());
  check("…so conv2's maps at kernel 5 are its maps at kernel 3", (() => {
    const a = M.computeMaps(M.buildNet({ k: 3 }), makeRng(1)).stages[3];
    const b = M.computeMaps(M.buildNet({ k: 5 }), makeRng(1)).stages[3];
    return a.every((m, c) => m.every((v, i) => Math.abs(v - b[c][i]) < 1e-12));
  })());
}

/* --- 4 · the register (5.9), the URL and the status ------------------------- */
console.log("\n4 · the register");

/* every string a reader can see, with the comments stripped first — a comment
   naming the cell a decision came from is exempt (2.9). Template literals are
   read too, with their placeholders removed, because most of this figure's
   copy is built at paint time. */
const stringsIn = (text) => {
  const bare = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const out = [];
  for (const m of bare.matchAll(/"((?:\\.|[^"\\])*)"/g)) out.push(m[1]);
  for (const m of bare.matchAll(/`((?:\\.|[^`\\])*)`/g)) out.push(m[1].replace(/\$\{[^}]*\}/g, " "));
  return out;
};
const OURS = /\b(cards?|rungs?|ladders?|rails?|bands?|stacks?|cones?|slabs?|faces?|piles?|walks?|wells?|plains?|trenches?|frames?|strips?|beats?|ghosts?|sweeps?|phases?|rasters?|galler(y|ies)|thumbnails?)\b/i;
const PERSON = /\b(chose|chosen by|waits?|waiting|sees?|looks?|wants?|decides?|knows?|points? the|sits?|sitting|lies?|lying|falls?|falling)\b/i;
{
  const reader = stringsIn(src)
    .filter((s) => /[a-z]{3}/.test(s) && !/^[a-z-]+$/.test(s) && !/^--/.test(s)
      && !/^(system-ui|monospace|alphabetic|middle|center|source-over)$/.test(s))
    .concat([card.blurb, card.title]);
  check(`${reader.length} reader-facing strings use none of the collection's own vocabulary`,
    !reader.some((s) => OURS.test(s)), reader.filter((s) => OURS.test(s)).join(" | "));
  check("…and none personifies the figure",
    !reader.some((s) => PERSON.test(s)), reader.filter((s) => PERSON.test(s)).join(" | "));
  check("…and none says never",
    !reader.some((s) => /\bnever\b/i.test(s)), reader.filter((s) => /\bnever\b/i.test(s)).join(" | "));
  check("…and none says landed, taken or arrives",
    !reader.some((s) => /\b(landed|lands|taken|arrives?|arrived)\b/i.test(s)),
    reader.filter((s) => /\b(landed|lands|taken|arrives?|arrived)\b/i.test(s)).join(" | "));
  check("…and none names a lesson, notebook, cell or course",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)),
    reader.filter((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)).join(" | "));
  check("`depict.js` carries no reader-facing copy at all (5.9)",
    stringsIn(depictSrc).filter((s) => /\s[a-z]{3,}\s/.test(s)).length === 0,
    stringsIn(depictSrc).filter((s) => /\s[a-z]{3,}\s/.test(s)).join(" | "));
  check("…and no colour, font or token name either (5.8)",
    !/--c-|colors\.|ctx\./.test(depictSrc.replace(/\/\*[\s\S]*?\*\//g, " ")));

  const details = [...src.matchAll(/detail:\s*"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]);
  const outcome = /\b(reach|reaches|grows?|shrinks?|explodes?|fails?|shows?|finds?|becomes?|improves?|worsens?|moves? the)\b/i;
  check("no control line announces an outcome", !details.some((s) => outcome.test(s)),
    details.filter((s) => outcome.test(s)).join(" | "));
  check("every detail line says what its control is, in more than ten characters (3.4f)",
    details.length === 8 && details.every((s) => s.length > 10), `${details.length} lines`);

  check("the subtitle is the one Kenneth picked, verbatim",
    /A convolutional layer applies the same small kernel at every position, so its parameter count does not grow with the image\. Each output unit is computed from a square patch of the input, its receptive field, which widens with every layer\./
      .test(src.replace(/"\s*\+\s*"/g, "")));
  check("the gallery blurb fits the card's 120", card.blurb.length <= 120, `${card.blurb.length} chars`);
  check("the meta description is the blurb, verbatim",
    read("widgets/cnn-architecture/index.html").includes(`content="${card.blurb}"`));
  check("the title is the arc's own form", card.title === "Deep Learning - CNN Architecture");
  /* ROUND 6 MERGED THE TWO WALKS, so there are two labels where there were
     three: the stage before the gate adds a layer, the stage behind it moves
     the marked unit, and there is no press that does anything else (4.4b). */
  check("the step label keys on the animation's own counter, one label a phase (3.4c, 4.4b)",
    /stepLabel:\s*\{\s*\n\s*anim:\s*"phase"/.test(src)
    && /labels:\s*\{ layers: "Next layer", units: "Next unit" \}/.test(src)
    && /default:\s*"Next layer"/.test(src));
  check("…and no reader-facing string names a walk the merge removed",
    !stringsIn(src).some((s) => /Next position|positions then units|two walks/i.test(s)),
    stringsIn(src).filter((s) => /Next position/i.test(s)).join(" | "));

  /* THE RAIL, AS DECLARED (round 5). The gate is a real parameter so a link
     reproduces the stage it was copied in; it is `display` so opening and
     closing it keeps the columns the reader built (3.4b, non-negotiable 3);
     and the Layer control exists only behind it. */
  check("the gate is a parameter, a full-width button, and display-only", (() => {
    const f = /patch: \{([\s\S]*?)\n    \},/.exec(src)?.[1] ?? "";
    return /type: "bool"/.test(f) && /style: "action"/.test(f)
      && /default: false/.test(f) && /display: true/.test(f)
      && /label: "Show the receptive field"/.test(f);
  })());
  check("…and the Layer control is shown only while it is open",
    /layer: \{[\s\S]*?when: \{ param: "patch" \}/.test(src)
    && /fieldSec: \{ type: "section", label: "The receptive field", when: \{ param: "patch" \} \}/.test(src));
  check("…over the feature maps of the network, the last one named relatively",
    M.layerNames({ blocks: "2" }).join(" ") === "conv1 pool1 conv2 pool2"
    && M.layerNames({ blocks: "3" }).join(" ") === "conv1 pool1 conv2 pool2 conv3"
    && M.layerNames({ blocks: "1" }).join(" ") === "conv1 pool1"
    && M.LAYER_LAST === "last");
  check("…and `unit` is gone, so one control and one click name the column",
    !/\bunit: \{ type:/.test(src) && !/params\.unit/.test(src));
  const declared = src.match(/^\s*status:\s*"([^"]*)"/m)?.[1];
  check("both files say shipped", declared === "shipped" && card.status === "shipped", `${declared} / ${card.status}`);

  /* the URL round trip, through core's own parser */
  const spec = {
    blocks: { type: "choice", options: ["1", "2", "3"], default: "2" },
    base: { type: "choice", options: ["16", "32"], default: "32" },
    k: { type: "choice", options: ["3", "5"], default: "3" },
    head: { type: "segmented", options: ["flatten", "gap"], default: "gap" },
    input: { type: "choice", options: ["28", "64"], default: "28" },
    patch: { type: "bool", default: false },
    layer: {
      type: "choice",
      options: (values) => {
        const names = M.layerNames(values);
        return names.map((name, i) => ({ value: i === names.length - 1 ? M.LAYER_LAST : name, label: name }));
      },
      optionsFrom: "blocks",
      default: M.LAYER_LAST,
    },
    pos: { type: "int", min: M.POS_MIN, max: M.POS_MAX, default: M.POS_DEFAULT },
    shown: { type: "int", min: 0, max: 7 + 4096, default: 0 },
  };
  const v = resolveParams(spec, new URLSearchParams("blocks=3&k=5&head=flatten&input=64&shown=5&patch=1&layer=conv2"));
  check("a link resolves to the network it names, and to the stage it was copied in",
    v.blocks === "3" && v.k === "5" && v.head === "flatten" && v.input === "64" && v.shown === 5
    && v.patch === true && v.layer === "conv2" && v.pos === M.POS_DEFAULT);
  check("…and every value in it is a word the control shows or the number on its tick (5.9)",
    toQuery(spec, v) === "blocks=3&k=5&head=flatten&input=64&patch=1&layer=conv2&shown=5", toQuery(spec, v));
  check("a layer the network does not have falls back to the last one",
    resolveParams(spec, new URLSearchParams("blocks=1&layer=conv2")).layer === M.LAYER_LAST
    && resolveParams(spec, new URLSearchParams("layer=pool1")).layer === "pool1");
  check("a link past the layers carries the presses and not the cell it reached (1.1)",
    resolveParams(spec, new URLSearchParams("shown=12")).shown === 12
    && resolveParams(spec, new URLSearchParams("shown=12")).pos === M.POS_DEFAULT);
  /* ROUND 6: one walk, so the longest press count is the columns plus the
     cells of the largest map any control reaches, not twice the cells. */
  check("the spec's own maximum reaches a 64 × 64 map walked once",
    spec.shown.max === 7 + 4096 && /SHOWN_MAX = 7 \+ 4096/.test(src));

  /* the one number a click writes, and the three things it names */
  check("a column, a channel and a cell encode into one parameter and read back",
    M.readPos(M.posOf(3, 2, 27)).stage === 3
    && M.readPos(M.posOf(3, 2, 27)).channel === 2
    && M.readPos(M.posOf(3, 2, 27)).idx === 27
    && M.readPos(M.posOfColumn(4, 1)).idx === null
    && M.readPos(M.posOfColumn(4, 1)).channel === 1
    && M.readPos(M.POS_DEFAULT).stage === null);
  check("…with room for the largest map any control reaches",
    M.POS_CELLS === 64 * 64 && M.buildNet({ input: 64 }).stages[1].H ** 2 === M.POS_CELLS
    && M.posOf(M.STAGE_LAST, 3, M.POS_CELLS - 1) <= M.POS_MAX);
  check("the default is a value no click writes, so Reset still empties the figure",
    M.POS_DEFAULT === 0
    && EVERY.every((cfg) => {
      const st = M.stagesFor(M.buildNet(cfg));
      return st.slice(1).every((s, i) => [0, 1, 2, 3].every((c) =>
        M.posOf(i + 1, c, M.POS_CENTRE_IDX) !== M.POS_DEFAULT
        && M.posOf(i + 1, c, 0) !== M.POS_DEFAULT));
    }));
}

/* --- the shipping module, driven ------------------------------------------- */
/* `main.js` imported with `defineWidget` stubbed, the way the arc's other
   drivers do it: the module is the SHIPPING file, with its three imports
   rewritten to absolute URLs and MathML declared absent so the card takes its
   plain-text branch. */
const abs = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);
let text = src
  .replace(/^import \{ defineWidget, mathmlRenders, shapeText, outSize \} from "\.\.\/core\/index\.js";$/m,
    `import { shapeText, outSize } from ${abs("../core/torch.js")};`
    + " const mathmlRenders = () => false;"
    + " const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);")
  .replace(/^import \* as M from "\.\/model\.js";$/m, `import * as M from ${abs("../cnn-architecture/model.js")};`)
  .replace(/^import \* as D from "\.\/depict\.js";$/m, `import * as D from ${abs("../cnn-architecture/depict.js")};`);
text += "\nexport { __cfg };\n";
globalThis.document = { querySelector: () => null };
const W = (await import(`data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`)).__cfg;

/** 6px a character, at every size and every glyph — see the header's limits. */
const CHAR = 6;
const painted = [];
const segments = [];
/* every filled rectangle, which is how a MAP is read: a progressive fill draws
   one rectangle a cell and no string at all, so nothing in `painted` can say
   how far the fill has got (round 6's own check, §8) */
const rects = [];
let pen = null;
const props = { textAlign: "start" };
const ctx = new Proxy(props, {
  get: (t, k) => {
    if (k === "measureText") return (s) => ({ width: String(s).length * CHAR });
    if (k === "fillRect") return (x, y, w, h) => { rects.push({ x, y, w, h }); };
    if (k === "fillText" || k === "strokeText") {
      return (s, x, y) => { painted.push({ s: String(s), x, y, align: props.textAlign }); };
    }
    if (k === "moveTo") return (x, y) => { pen = [x, y]; };
    if (k === "lineTo") {
      return (x, y) => {
        if (pen) segments.push([pen[0], pen[1], x, y]);
        pen = [x, y];
      };
    }
    if (k in t) return t[k];
    return () => {};
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
const COLORS = {
  surface: "#fcfcfb", surface2: "#f9f9f7", ink1: "#0b0b0b", ink2: "#52514e", ink3: "#898781",
  grid: "#e1e0d9", axis: "#898781", empirical: "#1f6fd1", highlight: "#7a4fd6", reference: "#898781",
  groupA: "#1f6fd1", groupB: "#d9a400", extreme: "#d8412f", dims: ["#1f6fd1", "#d9a400", "#2e9e5b", "#7a4fd6"],
  font: "system-ui", mono: "monospace", fsXs: "11px", fsSm: "12px", fsMd: "13px", fsLg: "15px",
};
const BASE = {
  blocks: "2", base: "32", k: "3", head: "gap", input: "28",
  patch: false, layer: M.LAYER_LAST, pos: M.POS_DEFAULT, shown: 0,
};
const paramsFor = (cfg, extra = {}) => ({
  ...BASE,
  blocks: String(cfg.blocks ?? 2), base: String(cfg.base ?? 32), k: String(cfg.k ?? 3),
  head: cfg.head ?? "gap", input: String(cfg.input ?? 28),
  ...extra,
});
const finished = (state) => ({ n: state.units, s: 0, beat: 0, acc: 0, phase: "layers", done: true });
/** the same figure with the gate open: every column in, nothing walked yet */
const opened = (state) => ({ n: state.units, s: 0, beat: 0, acc: 0, phase: "units", done: false });
const paintOf = (params, state, anim, w = M.STAGE_REF) => {
  painted.length = 0;
  segments.length = 0;
  rects.length = 0;
  pen = null;
  W.draw({ ctx, colors: COLORS, w, h: W.height({ ...params, w }), params, state, anim });
  return painted.map((p) => p.s);
};
const lineKey = (l) => l.map((v) => Math.round(v * 1000) / 1000).join();
const leftOf = (p) => (p.align === "center" ? p.x - p.s.length * CHAR / 2
  : (p.align === "right" || p.align === "end") ? p.x - p.s.length * CHAR : p.x);
/** Every pair of strings on one baseline that overlap, and every string off an edge. */
function textFaults(w) {
  const rows = new Map();
  const faults = [];
  for (const p of painted) {
    const l = leftOf(p);
    const r = l + p.s.length * CHAR;
    if (l < -0.5 || r > w + 0.5) faults.push(`off the edge: "${p.s}" ${l.toFixed(0)}…${r.toFixed(0)} of ${w}`);
    const key = Math.round(p.y * 2) / 2;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ s: p.s, l, r });
  }
  for (const [y, list] of rows) {
    list.sort((a, b) => a.l - b.l);
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].l < list[i - 1].r - 0.01) {
        faults.push(`overlap at y ${y}: "${list[i - 1].s}" then "${list[i].s}"`);
      }
    }
  }
  return faults;
}

console.log("\n5 · the module, and the columns");
{
  check("the module registered one widget with every part of the contract",
    Boolean(W.draw && W.readout && W.regions && W.animation && W.compute && W.height && W.legend));
  const params = paramsFor({});
  const state = timed("compute, the default", () => W.compute({ params, rng: makeRng(1) }));
  check("compute builds the network, the maps and the columns once a parameter change",
    state.stages.length === state.net.units + 1
    && state.stages.map((s) => s.name).join(" ") === "Input conv1 pool1 conv2 pool2 GAP Linear",
    state.stages.map((s) => s.name).join(" "));
  check("the head column is named for the head the reader picked", (() => {
    const p = paramsFor({ head: "flatten" });
    return W.compute({ params: p, rng: makeRng(1) }).stages.at(-2).name === "Flatten";
  })());
  check("the last column carrying a feature map is the one the default marks",
    D.lastSpatial(state.stages) === state.net.layerUnits
    && state.stages[D.lastSpatial(state.stages)].name === "pool2");
  check("the chain is one edge a consecutive pair",
    D.edgesOf(state.stages).length === state.stages.length - 1
    && D.edgesOf(state.stages)[0].from === "Input");
}

/* --- 6 · the geometry, at 550 and at 770 ----------------------------------- */
console.log("\n6 · the geometry");
{
  const bad = [];
  const tight = [];
  for (const cfg of EVERY) {
    const net = M.buildNet(cfg);
    const st = M.stagesFor(net);
    for (const w of [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W]) {
      const lay = D.galleryLayout(w, st);
      if (lay.right > w - D.PAD + 0.5) bad.push(`${JSON.stringify(cfg)} @${w}: right ${lay.right.toFixed(1)}`);
      if (lay.cols[0].x < D.PAD - 1e-9) bad.push(`${JSON.stringify(cfg)} @${w}: left`);
      if (lay.gap < 4) tight.push(`${JSON.stringify(cfg)} @${w}: gap ${lay.gap.toFixed(1)}`);
      for (const col of lay.cols) {
        for (const t of col.thumbs) {
          if (t.x < D.PAD - 1e-9 || t.x + t.size > w - D.PAD + 0.5
            || t.y < 0 || t.y + t.size > lay.top + lay.colH + 0.5) {
            bad.push(`${JSON.stringify(cfg)} @${w}: ${col.name} thumbnail`);
          }
        }
      }
    }
  }
  check("every column of every combination is inside the stage, at 550, 770 and 535",
    bad.length === 0, bad.slice(0, 3).join(" | ") || `${EVERY.length} networks × 3 widths`);
  check("…with room between the columns at all three", tight.length === 0,
    tight.slice(0, 3).join(" | ")
      || `narrowest gap ${Math.min(...EVERY.map((c) => D.galleryLayout(HARNESS_W, M.stagesFor(M.buildNet(c))).gap)).toFixed(1)}px`);

  const st = M.stagesFor(DEFAULT);
  const lay = D.galleryLayout(M.STAGE_REF, st);
  check("a pooling column's thumbnail is half the one before it",
    lay.cols[2].size === lay.cols[1].size / 2 && lay.cols[4].size === lay.cols[3].size / 2,
    lay.cols.map((c) => c.size.toFixed(0)).join(" / "));
  check("…and a 64 px image draws the same picture with the shapes moved",
    D.galleryLayout(M.STAGE_REF, M.stagesFor(IN64)).cols.map((c) => c.size).join()
    === lay.cols.map((c) => c.size).join(),
    `${D.galleryLayout(M.STAGE_REF, M.stagesFor(IN64)).cols[1].cellPx.toFixed(2)}px a cell at 64`);
  check("the kernel's name is reserved beside every feature-map column",
    lay.showNames && D.galleryLayout(M.STAGE_REF, M.stagesFor(K5B3)).showNames
    && D.galleryLayout(HARNESS_W, M.stagesFor(B3)).showNames,
    `${lay.nameW.toFixed(0)}px at two blocks, `
      + `${D.galleryLayout(M.STAGE_REF, M.stagesFor(B3)).nameW.toFixed(0)}px at three`);
  check("the columns' printed lines alternate between two rows",
    lay.cols.every((c, i) => c.labelRow === i % 2)
    && lay.lineY(1, 0) > lay.lineY(0, 1));

  /* the detail band reserves its tallest case, so a click never moves the head */
  const shrunk = [];
  let reserved = true;
  for (const cfg of EVERY) {
    const net = M.buildNet(cfg);
    const s2 = M.stagesFor(net);
    for (const w of [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W]) {
      const ls = s2.slice(1).map((_, i) => D.detailLayout(w, s2, i + 1));
      const over = ls.filter((l) => l.right > w - D.PAD + 0.5);
      if (over.length) bad.push(`${JSON.stringify(cfg)} @${w} detail right ${over[0].right.toFixed(0)}`);
      if (M.detailHeight(w, s2) !== Math.max(...ls.map((l) => l.height))) reserved = false;
      if (M.bands(w, net, s2).two !== M.detailHeight(w, s2)) reserved = false;
      const small = ls.filter((l) => l.mapS && l.mapS < 66);
      if (small.length) shrunk.push(`@${w} k${cfg.k}: ${small[0].mapS.toFixed(1)}px`);
    }
  }
  check("every detail band is inside the stage at all three widths",
    bad.length === 0, bad.slice(0, 3).join(" | ")
      || `the 5 × 5 case gives its maps back ${(66 - D.detailLayout(HARNESS_W, M.stagesFor(K5B3), 1).mapS).toFixed(1)}px at 535`);
  check("…and the band reserves the tallest column of the network, so a click moves nothing below it",
    reserved, `${Math.round(M.detailHeight(M.STAGE_REF, M.stagesFor(DEFAULT)))}px at 550, `
      + `${Math.round(M.detailHeight(M.STAGE_WIDE, M.stagesFor(DEFAULT)))}px at 770`);

  /* THE CROSS-CHANNEL BAND (round 6, the mock's own shape): four windows as a
     2 × 2 and four slices as a 2 × 2 at the value cell the band already uses
     at k = 5, the sum, the output map, and no separate input thumbnail —
     because the four windows ARE the four input maps. */
  {
    const s3 = M.stagesFor(B3);
    const at = (w) => D.detailLayout(w, s3, 3);
    check("the cross-channel band draws four windows 2 × 2 and four slices 2 × 2, and no input map",
      [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W].every((w) => {
        const l = at(w);
        return l.multi === true && l.across === 2 && l.wins.length === D.SHOWN
          && l.slices.length === D.SHOWN && l.inMap === undefined
          && l.wins.every((b) => b.k === 3) && l.slices.every((b) => b.k === 3);
      }),
      `windows ${at(M.STAGE_REF).wins.map((b) => b.x).join("/")} · `
        + `slices ${at(M.STAGE_REF).slices.map((b) => b.x).join("/")}`);
    check("…and it is 534px of 550 and of the 535 the fingerprint frame draws at",
      Math.round(at(M.STAGE_REF).right + D.PAD) === 534
      && Math.round(at(HARNESS_W).right + D.PAD) === 534
      && at(M.STAGE_REF).right <= M.STAGE_REF - D.PAD + 0.5
      && at(HARNESS_W).right <= HARNESS_W - D.PAD + 0.5,
      `right ${at(M.STAGE_REF).right} at 550 · ${at(HARNESS_W).right} at 535 · `
        + `${at(M.STAGE_WIDE).right} at 770`);
    check("…and it takes band 2 from the 193px single-channel case to 239px (225 before round 7's block headers)",
      Math.round(at(M.STAGE_REF).height) === 239
      && Math.round(D.detailLayout(M.STAGE_REF, s3, 1).height) === 193
      && Math.round(M.detailHeight(M.STAGE_REF, s3)) === 239,
      `conv1 ${Math.round(D.detailLayout(M.STAGE_REF, s3, 1).height)}px · `
        + `conv2 ${Math.round(at(M.STAGE_REF).height)}px · `
        + `pool1 ${Math.round(D.detailLayout(M.STAGE_REF, s3, 2).height)}px`);
    check("…and every block of values sits on its own label baseline, two rows of two",
      (() => {
        const l = at(M.STAGE_REF);
        const rows = new Set([...l.wins, ...l.slices].map((b) => b.labelY));
        return rows.size === 2
          && l.wins.every((b, i) => (i < 2 ? b.labelY === l.wins[0].labelY
            : b.labelY > l.wins[0].labelY))
          && l.wins[1].x > l.wins[0].x + 3 * l.wins[0].cw
          && l.slices[0].x > l.wins[1].x + 3 * l.wins[1].cw;
      })());
    check("…at every kernel size, because a 5 × 5 slice is a 3 × 3 with a ring of zeros",
      [3, 5].every((k) => {
        const st5 = M.stagesFor(M.buildNet({ blocks: 3, k }));
        return [M.STAGE_REF, HARNESS_W].every((w) =>
          D.detailLayout(w, st5, 3).wins[0].k === 3
          && Math.round(D.detailLayout(w, st5, 3).height) === 239);
      }),
      "twenty value cells a row need about 22px each where a printed weight is 30px");
  }

  const b550 = M.bands(M.STAGE_REF, K5B3, M.stagesFor(K5B3));
  const b770 = M.bands(M.STAGE_WIDE, K5B3, M.stagesFor(K5B3));
  /* ROUND 6 TOOK BAND 2 FROM 193 TO 225 at 550: the cross-channel band draws
     four windows and four slices where the single-channel one draws one of
     each, which is two rows of blocks rather than one. 837 → 869 at 550 and
     901 → 917 at 770; before round 5 cut the head figure to one head it was
     927 / 991. */
  check("the stage is 883px at 550 and 931px at 770 for the tallest network (869 / 917 before round 7's block headers; 837 / 901 before the cross-channel band)",
    Math.round(b550.height) === 883 && Math.round(b770.height) === 931,
    `${Math.round(b550.one)} + ${Math.round(b550.two)} + ${b550.three} = ${Math.round(b550.height)} at 550 · `
      + `${Math.round(b770.one)} + ${Math.round(b770.two)} + ${b770.three} = ${Math.round(b770.height)} at 770`);
  /* ONE HEIGHT A NETWORK, and it moves only with `blocks` (decision 3). A
     one-block network has no cross-channel convolution to draw, so its band 2
     is the 193px single-channel case and its stage is the 837px round 5 left;
     every network that has a second block reserves the 225px one for every
     column, which is what keeps a CLICK from moving the head figure. */
  check("the stage measures one height a network, and only `blocks` moves it",
    new Set(EVERY.filter((c) => c.blocks > 1)
      .map((c) => Math.round(M.stageHeight(M.STAGE_REF, paramsFor(c))))).size === 1
    && new Set(EVERY.filter((c) => c.blocks === 1)
      .map((c) => Math.round(M.stageHeight(M.STAGE_REF, paramsFor(c))))).size === 1,
    `${Math.round(M.stageHeight(M.STAGE_REF, paramsFor({ blocks: 1 })))}px at one block, `
      + `${Math.round(M.stageHeight(M.STAGE_REF, paramsFor({ blocks: 2 })))}px at two and three`);
  check("the height core asks for is the same function the bands are drawn from",
    M.stageHeight(M.STAGE_REF, { blocks: "3", base: "32", k: "5", head: "flatten", input: "64" })
    === M.bands(M.STAGE_REF, M.buildNet({ blocks: 3, base: 32, k: 5, head: "flatten", input: 64 })).height);

  /* BAND 3 DRAWS ONE HEAD (round 5, pick B). One bar carries no ratio, so it
     takes the room it has and the comparison is the two printed counts; the
     pair it replaces needed a 26px floor for the short bar, which drew 11 : 1
     where the counts said 48 : 1 (2.11). */
  const head = M.headLayout(M.STAGE_REF, DEFAULT);
  check("the head bar is 288px at 550 and the band is 210px tall",
    Math.abs(head.barMax - 288) < 0.5 && head.height === 210 && M.bands(M.STAGE_REF, DEFAULT).three === 210,
    `${head.barMax}px of bar, rows at ${head.rowY} / ${head.otherY} / ${head.denseY}`);
  check("…and there is no floor left to state a ratio the counts do not",
    M.BAR_MIN === undefined && !/BAR_MIN/.test(read("widgets/cnn-architecture/model.js")));
  check("the head bar and its printed count are inside the stage at all three widths",
    EVERY.every((cfg) => {
      const net = M.buildNet(cfg);
      return [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W].every((w) => {
        const h = M.headLayout(w, net);
        return h.barX + h.barMax <= w - D.PAD - 60;
      });
    }));
  check("both heads are still measured, so the band can print the one it does not draw",
    EVERY.every((cfg) => {
      const h = M.headLayout(M.STAGE_REF, M.buildNet(cfg));
      return h.rows.length === 2 && h.rows[0].head === "flatten" && h.rows[1].head === "gap"
        && h.rows.every((r) => Number.isFinite(r.net.total));
    }));

  /* THE FLATTEN HEAD COLUMN IS A STRIP (round 5, pick A) */
  const stF = M.stagesFor(FLATTEN, M.computeMaps(FLATTEN, makeRng(1)),
    { head: "Flatten", linear: "Linear" });
  const layF = D.galleryLayout(M.STAGE_REF, stF);
  const strip = layF.cols[5];
  check("Flatten draws 49 values in a 12px column and global average pooling draws four cells",
    strip.strip === true && strip.thumbs.length === D.STRIP && strip.thumbs[0].size === 12
    && lay.cols[5].thumbs.length === D.SHOWN && lay.cols[5].strip === false,
    `${strip.thumbs.length} cells of ${strip.thumbs[0].size} × ${strip.thumbs[0].h.toFixed(2)}px`);
  check("…and every one of them is above the 2px floor, so it can be its own target",
    strip.thumbs[0].h >= D.CELL_MIN
    && EVERY.filter((c) => c.head === "flatten").every((cfg) => {
      const net = M.buildNet(cfg);
      const st2 = M.stagesFor(net, M.computeMaps(net, makeRng(1)), { head: "Flatten", linear: "Linear" });
      return [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W].every((w) =>
        D.galleryLayout(w, st2).cols.at(-2).thumbs.every((t) => t.h >= D.CELL_MIN));
    }),
    `${strip.thumbs[0].h.toFixed(2)}px a cell at 550`);
  check("…and the strip costs the figure no width and no height",
    layF.height === lay.height && layF.cols.every((c, i) => Math.abs(c.x - lay.cols[i].x) < 1e-9)
    && layF.right === lay.right,
    `${Math.round(layF.height)}px either way`);
  check("…and the strip sits inside the column block it was given",
    strip.thumbs[0].y >= layF.top && strip.thumbs.at(-1).y + strip.thumbs.at(-1).h
      <= layF.top + layF.colH + 0.5);
  check("the two heads print two different shapes and two different counts not drawn",
    stF[5].C === 3136 && stF[5].shown === D.STRIP && stF[5].C - stF[5].shown === 3087
    && st[5].C === 64 && st[5].shown === 4 && st[5].C - st[5].shown === 60,
    `[3136] and +3,087 more against [64] and +60 more`);
  check("Flatten's four detail cells are laid out as a square, the other head's as a column",
    D.detailLayout(M.STAGE_REF, stF, 5).across === 2
    && D.detailLayout(M.STAGE_REF, st, 5).across === 1);
}

/* --- 7 · the click, the relative column, and the lines ---------------------- */
console.log("\n7 · the marked unit, and what connects the columns");
{
  const params = paramsFor({});
  const state = W.compute({ params, rng: makeRng(1) });
  const st = state.stages;
  const lay = D.galleryLayout(M.STAGE_REF, st);
  const regions = timed("the region table, default at 550",
    () => W.regions({ w: M.STAGE_REF, h: 927, params, state }));

  const cells = st.slice(1).reduce((a, s, i) => a
    + (s.spatial && lay.cols[i + 1].cellPx >= D.CELL_MIN
      ? s.shown * s.H * s.H : s.shown), 0);
  check("two targets a column's own name, plus one a drawn cell",
    regions.length === 2 * (st.length - 1) + cells, `${regions.length} targets`);
  check("every target sets exactly one parameter, and it is `pos`",
    regions.every((r) => Object.keys(r.set).length === 1 && "pos" in r.set));
  const columnOf = (stage) => (stage === M.STAGE_LAST ? D.lastSpatial(st)
    : stage === M.STAGE_HEAD ? st.length - 2
      : stage === M.STAGE_LINEAR ? st.length - 1 : stage);
  check("a cell target is the rectangle the drawing paints", (() => {
    const off = [];
    for (const r of regions) {
      const p = M.readPos(r.set.pos);
      if (p.idx === null) continue;
      const i = columnOf(p.stage);
      if (!st[i].spatial) {
        /* a head or a linear cell is named by its index, and its rectangle is
           the drawn cell — a strip's is 12px wide and taller than it is wide */
        const t = lay.cols[i].thumbs[p.idx];
        if (!t || Math.abs(r.x - t.x) > 1e-9 || Math.abs(r.y - t.y) > 1e-9
          || Math.abs(r.w - t.size) > 1e-9 || Math.abs(r.h - t.h) > 1e-9) off.push(r.label);
        continue;
      }
      const want = D.cellRect(lay, i, p.channel, Math.floor(p.idx / st[i].H), p.idx % st[i].H);
      if (["x", "y", "w", "h"].some((k) => Math.abs(r[k] - want[k]) > 1e-9)) off.push(r.label);
    }
    return off.length === 0;
  })(), `${regions.filter((r) => M.readPos(r.set.pos).idx !== null).length} cells`);
  check("the nine scores are nine targets, named by their index rather than by a channel",
    (() => {
      const linear = regions.filter((r) => r.label?.startsWith("Linear value"));
      return linear.length === M.CLASSES
        && linear.every((r, i) => M.readPos(r.set.pos).stage === M.STAGE_LINEAR
          && M.readPos(r.set.pos).channel === 0 && M.readPos(r.set.pos).idx === i);
    })(), "a channel past the fourth would read as another column");
  check("every value of the Flatten head column is a target of its own", (() => {
    const pf = paramsFor({ head: "flatten" });
    const sf = W.compute({ params: pf, rng: makeRng(1) });
    const rs = W.regions({ w: M.STAGE_REF, h: 837, params: pf, state: sf });
    return rs.filter((r) => r.label?.startsWith("Flatten value")).length === D.STRIP;
  })(), `${D.STRIP} values`);
  check("a click at a cell's centre resolves to that cell and no other", (() => {
    const missed = regions.filter((r) => {
      const hit = hitTest(regions, r.x + r.w / 2, r.y + r.h / 2);
      return !hit || hit.set.pos !== r.set.pos;
    });
    return missed.length === 0;
  })(), `${regions.length} targets`);
  check("a cell under 2px is one target a channel, not one a cell", (() => {
    const big = W.compute({ params: paramsFor({ input: 64 }), rng: makeRng(1) });
    const rs = W.regions({ w: M.STAGE_REF, h: 927, params: paramsFor({ input: 64 }), state: big });
    const l2 = D.galleryLayout(M.STAGE_REF, big.stages);
    return rs.length === 2 * (big.stages.length - 1)
      + big.stages.slice(1).reduce((a, s) => a + s.shown, 0)
      && l2.cols[1].cellPx < D.CELL_MIN;
  })(), `${D.galleryLayout(M.STAGE_REF, M.stagesFor(IN64)).cols[1].cellPx.toFixed(2)}px a cell at a 64px image`);

  /* the relative form, which is round 3's bug */
  const last = D.lastSpatial(st);
  const onLast = regions.find((r) => r.label?.startsWith("pool2") && M.readPos(r.set.pos).idx !== null);
  check("a click on the last feature map writes the relative form",
    M.readPos(onLast.set.pos).stage === M.STAGE_LAST && last === 4);
  check("…and a click on an earlier column writes that column's own index",
    M.readPos(regions.find((r) => r.label?.startsWith("conv1")).set.pos).stage === 1);
  check("a block added carries the unit to the new last column, at the cell it was on", (() => {
    const p3 = paramsFor({ blocks: 3 }, { pos: M.posOf(M.STAGE_LAST, 2, 3 * 7 + 6) });
    const s3 = W.compute({ params: p3, rng: makeRng(1) });
    const said = paintOf(p3, s3, finished(s3));
    return said.some((s) => /^conv3, one output value$/.test(s))
      && said.some((s) => /at row 3, column 6$/.test(s));
  })());
  check("…and clamped to its map where the new one is smaller", (() => {
    const p1 = paramsFor({ blocks: 1 }, { pos: M.posOf(M.STAGE_LAST, 0, 13 * 14 + 13) });
    const s1 = W.compute({ params: p1, rng: makeRng(1) });
    return paintOf(p1, s1, finished(s1)).some((s) => /pool1, one output value/.test(s));
  })());
  check("a unit pinned on an earlier column survives a change to the network", (() => {
    const pin = paramsFor({ blocks: 3 }, { pos: M.posOf(1, 0, 5 * 28 + 5) });
    const sp = W.compute({ params: pin, rng: makeRng(1) });
    const said = paintOf(pin, sp, finished(sp));
    return said.some((s) => /^conv1, one output value$/.test(s))
      && said.some((s) => /at row 5, column 5$/.test(s));
  })());
  check("the head and the linear layer are named relatively too, so they follow a block", (() => {
    const p3 = paramsFor({ blocks: 3 }, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const s3 = W.compute({ params: p3, rng: makeRng(1) });
    return paintOf(p3, s3, finished(s3)).some((s) => /9 class scores/.test(s));
  })());
  /* BEHIND THE GATE THE TABLE SPLITS (decision 15): the chosen layer's cells
     write `pos`, every other feature map writes `layer`, and the control the
     reader sees can therefore never name a column the figure is not drawing. */
  {
    const pg = paramsFor({}, { patch: true });
    const sg = W.compute({ params: pg, rng: makeRng(1) });
    const rg = W.regions({ w: M.STAGE_REF, h: 837, params: pg, state: sg });
    const layers = rg.filter((r) => "layer" in r.set);
    const cells = rg.filter((r) => "pos" in r.set);
    check("behind the gate a click on another column moves the Layer control",
      layers.length === 9 && layers.every((r) => ["conv1", "pool1", "conv2"].includes(r.set.layer)),
      `${layers.length} targets over three columns`);
    check("…and every one of them names a value the control offers",
      layers.every((r) => M.layerNames(pg).includes(r.set.layer) || r.set.layer === M.LAYER_LAST));
    check("…while the chosen layer's own cells still write `pos`",
      cells.length === 2 + D.SHOWN * 49
      && cells.every((r) => M.readPos(r.set.pos).stage === M.STAGE_LAST
        || r.set.pos === M.posOfColumn(M.STAGE_LAST)),
      `${cells.length} targets on pool2`);
    check("…and the head and the linear layer carry none, having no receptive field",
      !rg.some((r) => /^(GAP|Linear)/.test(r.label ?? "")));
    check("a click at a cell's centre still resolves to that cell and no other",
      rg.every((r) => {
        const hit = hitTest(rg, r.x + r.w / 2, r.y + r.h / 2);
        return hit && JSON.stringify(hit.set) === JSON.stringify(r.set);
      }), `${rg.length} targets`);
    check("the Layer control names the column the figure draws, whichever way it was set",
      ["conv1", "pool1", "conv2", M.LAYER_LAST].every((L) => {
        const p2 = paramsFor({}, { patch: true, layer: L });
        const said = paintOf(p2, sg, opened(sg));
        const want = L === M.LAYER_LAST ? "pool2" : L;
        return said.some((t) => t === `${want}, one output value`);
      }));
    check("…and a `pos` left on another column is ignored rather than obeyed", (() => {
      const p2 = paramsFor({}, { patch: true, layer: "conv1", pos: M.posOf(M.STAGE_LAST, 2, 10) });
      const said = paintOf(p2, sg, opened(sg));
      return said.some((t) => t === "conv1, one output value")
        && said.some((t) => /at row 14, column 14$/.test(t));
    })());
  }

  check("a column ahead of the reveal is clamped to the last one revealed", (() => {
    const p2 = paramsFor({}, { pos: M.posOfColumn(4) });
    const anim = { n: 1, s: 0, beat: 0, acc: 0, phase: "layers", done: false };
    return paintOf(p2, state, anim).some((s) => /^conv1, one output value$/.test(s));
  })());

  /* the lines into the chosen map, and the windows back to the image */
  const mid = M.centreUnit(DEFAULT, last);
  const cone = D.coneOf(lay, st, last, 0, mid, mid);
  check("one set of lines a consecutive pair of columns, four lines each",
    cone.length === last && cone.every((c) => D.coneLines(c).length === 4));
  check("…and the shipping draw lays those lines down", (() => {
    paintOf({ ...params, patch: true }, state, opened(state));
    const drawn = new Set(segments.map(lineKey));
    return cone.every((c) => D.coneLines(c).every((l) => drawn.has(lineKey(l))));
  })(), `${cone.length * 4} lines among ${segments.length} segments`);
  check("…recomputed from the layout and the backward spans, not read back", (() => {
    const rf = D.receptiveField(st, last, mid, mid);
    const wrong = [];
    cone.forEach((c, i) => {
      const want = i + 1 === last
        ? D.unitRect(lay, i + 1, 0, mid, mid)
        : D.windowRect(lay, i + 1, 0, rf.rows[i + 1], rf.cols[i + 1]);
      const from = D.windowRect(lay, i, 0, rf.rows[i], rf.cols[i]);
      if (["x", "y", "w", "h"].some((k) => Math.abs(c.to[k] - want[k]) > 1e-9
        || Math.abs(c.from[k] - from[k]) > 1e-9)) wrong.push(i);
    });
    return wrong.length === 0;
  })());
  check("a patch wider than the whole image is the source in whole", (() => {
    const stW = M.stagesFor(K5B3);
    const layW = D.galleryLayout(M.STAGE_REF, stW);
    const l = D.lastSpatial(stW);
    const c = M.centreUnit(K5B3, l);
    const cn = D.coneOf(layW, stW, l, 0, c, c)[0];
    const rf = D.receptiveField(stW, l, c, c);
    return cn.wide === true
      && Math.abs(cn.from.w - D.fullRect(layW, 0, 0, rf.rows[0], rf.cols[0]).w) < 1e-9
      && cn.from.w > layW.cols[0].size;
  })());
  check("…and a patch clipped by the border starts at the clipped corners", (() => {
    const cn = D.coneOf(lay, st, last, 0, 6, 6)[0];
    const rf = D.receptiveField(st, last, 6, 6);
    return cn.wide === false
      && Math.abs(cn.from.w - D.clipRect(lay, 0, 0, rf.rows[0], rf.cols[0]).w) < 1e-9
      && cn.from.w < D.fullRect(lay, 0, 0, rf.rows[0], rf.cols[0]).w;
  })());
  check("the lines into a convolution's map come from four channels, a pool's from one",
    D.fanIn(lay, 3, 1).length === 4 && D.fanIn(lay, 3, 1).filter((l) => l.lit).length === 1
    && D.fanIn(lay, 2, 1).length === 1 && D.fanIn(lay, 1, 0).length === 1);
  check("…and each ends on the chosen thumbnail's own left edge",
    D.fanIn(lay, 3, 1).every((l) => Math.abs(l.to[0] - lay.cols[3].thumbs[1].x) < 1e-9
      && Math.abs(l.to[1] - (lay.cols[3].thumbs[1].y + lay.cols[3].thumbs[1].size / 2)) < 1e-9));
  check("a GAP cell reads one map (one line, lit) and a Linear score reads every GAP value (every line lit)",
    D.fanIn(lay, 5, 1).length === 1 && D.fanIn(lay, 5, 1)[0].lit
    && D.fanIn(lay, 6, 4).length === 4 && D.fanIn(lay, 6, 4).every((l) => l.lit),
    `GAP ${D.fanIn(lay, 5, 1).length} · Linear ${D.fanIn(lay, 6, 4).length}`);
}

/* --- 8 · the one walk, in two stages --------------------------------------- */
/* ROUND 6 MERGED TWO PHASES INTO ONE. Before the gate Step and Play add the
   columns and stop; behind it they move the marked unit over every cell of the
   chosen map, the map filling up to the cell the unit is on. What used to be a
   walk of the kernel and then a walk of the unit is one walk, because the
   kernel's window IS the innermost window of the receptive field (§2), and one
   clock, because two paces for one walk is a choice with no question in it. */
console.log("\n8 · the one walk, in two stages");
const CLOCK = 32;
/**
 * Run the shipping animation from empty to its stop, one `dt` a call.
 *
 * THE PRIMING `init` IS NOT CEREMONY. `init` keeps the columns already built
 * whenever the network is unchanged and the pick is off its default — which is
 * the whole point of a click — so a second run in this process would inherit
 * the first one's columns exactly as a click does in the browser.
 */
const drive = (params, state, dt, cap = 40000, mode = "run") => {
  W.animation.init({ params: { ...params, pos: M.POS_DEFAULT }, state, fromScratch: true });
  const anim = W.animation.init({ params, state, fromScratch: true });
  anim.mode = mode;
  const phases = [anim.phase];
  const marks = [];
  let calls = 0;
  const at = { layers: 0, units: 0 };
  for (let i = 0; i < cap; i += 1) {
    const before = anim.phase;
    const more = W.animation.advance(anim, { dt, params, state });
    calls += 1;
    at[before] += 1;
    phases.push(anim.phase);
    marks.push({ n: anim.n, s: anim.s });
    if (!more) break;
  }
  return { anim, calls, phases, marks, at };
};
{
  const params = paramsFor({});
  const state = W.compute({ params, rng: makeRng(1) });
  /* BEHIND THE GATE the same figure runs the walk, which is what a reader has
     pressed for before there is anything of theirs to walk over. */
  const walk = paramsFor({}, { patch: true });
  const run = timed("Play, the layers, at 32ms", () => drive(params, state, CLOCK));
  const run2 = timed("Play, the walk, at 32ms", () => drive(walk, state, CLOCK));
  check("before the gate Play runs the layers and stops, with nothing walked",
    run.anim.n === state.units && run.anim.s === 0 && run.anim.done === true
    && [...new Set(run.phases)].join() === "layers",
    `${run.anim.n} columns, ${run.anim.s} cells`);
  check("behind it Play walks every cell of the chosen map once and stops",
    run2.anim.n === state.units && run2.anim.s === 49
    && run2.anim.done === true && run2.at.layers === 0,
    `${run2.anim.n} columns, ${run2.anim.s} of 49 cells`);
  check("…each stage taking the wall time `model.js` declares",
    Math.abs(run.at.layers * CLOCK - state.units * M.UNIT_MS) <= CLOCK
    && Math.abs(run2.at.units * CLOCK - M.slidePlan(49).total) <= 2 * CLOCK,
    `${run.at.layers * CLOCK}ms of layers · ${run2.at.units * CLOCK}ms of walking, `
      + `against the ${Math.round(M.slidePlan(49).total)}ms the plan asks for`);
  check("…and the longest map any control reaches finishes inside the budget at that clock",
    (() => {
      const big = paramsFor({ input: 64 }, { patch: true, layer: "conv1" });
      const sb = W.compute({ params: big, rng: makeRng(1) });
      const r = drive(big, sb, CLOCK);
      return r.anim.s === 4096 && r.at.units * CLOCK <= M.SLIDE_BUDGET + 2 * CLOCK;
    })(),
    `conv1 on a 64px image is 4,096 cells in ${Math.round(M.slidePlan(4096).total)}ms of plan`);
  check("the step label reads one noun a stage, and there is no third",
    (() => {
      const L = W.animation.stepLabel;
      return L.anim === "phase" && L.labels.layers === "Next layer"
        && L.labels.units === "Next unit" && Object.keys(L.labels).length === 2
        && L.default === "Next layer" && W.animation.runLabel === "Play";
    })());
  check("…and the counter it keys on says layers before the gate and units throughout behind it",
    run.phases.every((p) => p === "layers")
    && run2.phases.every((p) => p === "units"),
    `${run.at.layers} layer calls · ${run2.at.units} walking calls`);
  check("…so Next unit is the label at the first press, mid walk and at the last",
    [0, 1, 25, 49].every((n) => {
      const a = W.animation.init({
        params: paramsFor({}, { shown: n, patch: true }), state, fromScratch: false,
      });
      return a.phase === "units" && W.animation.stepLabel.labels[a.phase] === "Next unit";
    }));
  check("opening the gate puts every column in and starts the walk at the beginning",
    (() => {
      const a = W.animation.init({ params: paramsFor({}, { shown: 3 }), state, fromScratch: false });
      W.animation.rebuild(a, { params: walk, state });
      const opened2 = { n: a.n, s: a.s, phase: a.phase };
      W.animation.rebuild(a, { params, state });
      return opened2.n === state.units && opened2.s === 0 && opened2.phase === "units"
        && a.n === state.units && a.phase === "layers";
    })(), "and closing it leaves the columns where they are (3.4b)");

  /* one press a call, so every cell is visited once */
  const slow = drive(walk, state, M.SLIDE_MS0, 40000);
  const seq = slow.marks.filter((m) => m.n >= state.units).map((m) => m.s);
  const seen = [...new Set(seq)].filter((v) => v > 0);
  check("the marked unit visits every cell of the chosen map exactly once",
    seen.length === 49 && seen.every((v, i) => v === i + 1),
    `${seen.length} cells`);

  /* read off the figure's own line rather than the counter that drives it */
  const order = [];
  const fills = [];
  {
    W.animation.init({ params: { ...walk, pos: M.POS_DEFAULT }, state, fromScratch: true });
    const anim = W.animation.init({ params: walk, state, fromScratch: false });
    anim.mode = "step";
    const lay = D.galleryLayout(M.STAGE_REF, state.stages);
    const thumb = lay.cols[4].thumbs[0];
    for (let i = 0; i < 200; i += 1) {
      if (anim.s >= 49) break;
      W.animation.advance(anim, { dt: M.SLIDE_MS0, params: walk, state });
      const said = paintOf(walk, state, anim);
      const m = /row (\d+), column (\d+)/.exec(said.find((t) => /at row \d+, column \d+/.test(t)) ?? "");
      if (m) order.push(`${m[1]},${m[2]}`);
      /* THE FILL AND THE WALK ARE ONE COUNTER, which is what the merge bought.
         The rectangles inside the marked channel's thumbnail are the cells the
         unit has reached, plus the unit's own mark over the last of them. */
      fills.push(rects.filter((r) => r.x >= thumb.x - 0.01 && r.y >= thumb.y - 0.01
        && r.x + r.w <= thumb.x + thumb.size + 1.01 && r.y + r.h <= thumb.y + thumb.size + 1.01
        && r.w < thumb.size - 0.5).length);
    }
  }
  const want = [];
  for (let r = 0; r < 7; r += 1) for (let c = 0; c < 7; c += 1) want.push(`${r},${c}`);
  check("the figure names every cell of the map once, top left to bottom right",
    order.length === 49 && order.join(" ") === want.join(" "),
    `${order.length} cells, ${order[0]} → ${order.at(-1)}`);
  check("…and the map behind it is drawn exactly as far as the unit has walked",
    fills.length === 49 && fills.every((v, i) => v === i + 2),
    `${fills[0]} rectangles at the first cell, ${fills[24]} at the twenty-fifth, `
      + `${fills.at(-1)} at the last — one a cell reached, plus the unit's own mark`);

  /* the pace ramps, and the whole map still finishes inside the budget */
  check("a 7 × 7 map stays at 60ms a cell throughout",
    M.slidePlan(49).speedup === 1 && Math.abs(M.slideMsAt(M.slidePlan(49), 48) - 60) < 1e-9);
  check("…a 28 × 28 map ends about fourteen times faster than it starts",
    Math.abs(M.slidePlan(784).speedup - 13.2) < 0.3,
    `${M.slidePlan(784).speedup.toFixed(1)} ×, ${M.slideMsAt(M.slidePlan(784), 783).toFixed(1)}ms at the last`);
  check("…and every map finishes inside the ten seconds the budget declares",
    [49, 196, 784, 1024, 4096].every((n) => M.slidePlan(n).total <= M.SLIDE_BUDGET + 1),
    [49, 196, 784, 1024, 4096].map((n) => `${n}:${Math.round(M.slidePlan(n).total)}ms`).join(" "));
  check("…and the fixed six seconds the second walk ran on is gone with it",
    M.SWEEP_MS === undefined && M.cellMsOf === undefined
    && !/SWEEP_MS|cellMsOf/.test(read("widgets/cnn-architecture/model.js")));

  /* one press is one, whatever the map */
  check("one press is one cell, whatever the map's size",
    EVERY.every((cfg) => {
      const p = paramsFor(cfg, { patch: true });
      const s = W.compute({ params: p, rng: makeRng(1) });
      const a = W.animation.init({ params: { ...p, shown: 0 }, state: s, fromScratch: false });
      a.mode = "step";
      let g = 0;
      while (W.animation.advance(a, { dt: CLOCK, params: p, state: s }) && g++ < 500);
      return a.s === 1;
    }));

  /* `shown` opens at any press */
  check("`shown` counts columns before the gate and cells of the chosen map behind it", (() => {
    const at2 = (n, extra) => W.animation.init({
      params: paramsFor({}, { shown: n, ...extra }), state, fromScratch: false,
    });
    const a0 = at2(3);
    const a1 = at2(state.units);
    const b0 = at2(0, { patch: true });
    const b1 = at2(1, { patch: true });
    const b2 = at2(20, { patch: true });
    const b3 = at2(48, { patch: true });
    const b4 = at2(49, { patch: true });
    return a0.n === 3 && a0.s === 0 && a0.phase === "layers" && a0.done === false
      && a1.n === state.units && a1.done === true && a1.phase === "layers"
      && b0.n === state.units && b0.s === 0 && b0.phase === "units" && b0.done === false
      && b1.s === 1 && b2.s === 20 && b3.s === 48 && b3.done === false
      && b4.s === 49 && b4.done === true;
  })());
  check("…and `?patch=1&shown=N` opens at cell N − 1, with the map drawn to it", (() => {
    const cellOf = (n) => {
      const p = paramsFor({}, { shown: n, patch: true });
      const a = W.animation.init({ params: p, state, fromScratch: false });
      const said = paintOf(p, state, a);
      const m = /row (\d+), column (\d+)/.exec(said.find((t) => /at row \d+, column \d+/.test(t)) ?? "");
      return m ? Number(m[1]) * 7 + Number(m[2]) : null;
    };
    return [1, 8, 20, 49].every((n) => cellOf(n) === n - 1);
  })(), "one cell a press, counted from the first");
  check("…and a link past the end is clamped rather than run off the map", (() => {
    const a = W.animation.init({ params: paramsFor({}, { shown: 9000, patch: true }), state, fromScratch: false });
    const b = W.animation.init({ params: paramsFor({}, { shown: 9000 }), state, fromScratch: false });
    return a.n === state.units && a.s === 49 && a.done === true
      && b.n === state.units && b.s === 0 && b.done === true;
  })());
  check("a click on a cell leaves the walk the cells after it", (() => {
    const p = paramsFor({}, { patch: true, pos: M.posOf(M.STAGE_LAST, 0, 2 * 7 + 1) });
    const s = W.compute({ params: p, rng: makeRng(1) });
    return drive(p, s, M.SLIDE_MS0).anim.s === 49 - (2 * 7 + 1) - 1;
  })());
  check("…and from the last cell there is nothing left to run", (() => {
    const p = paramsFor({}, { patch: true, pos: M.posOf(M.STAGE_LAST, 0, 48) });
    const s = W.compute({ params: p, rng: makeRng(1) });
    const r = drive(p, s, M.SLIDE_MS0);
    return r.anim.s === 0 && r.anim.done === true;
  })());
  check("a column with no map to walk finishes after the layers", (() => {
    const p = paramsFor({}, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const s = W.compute({ params: p, rng: makeRng(1) });
    const r = drive(p, s, CLOCK);
    return r.anim.n === s.units && r.anim.done === true && r.anim.s === 0;
  })());
  check("Play at 32ms reaches the same end as Play one press a call",
    drive(walk, state, CLOCK).anim.s === drive(walk, state, M.SLIDE_MS0).anim.s);
  check("a Replay starts from empty with the same pick", (() => {
    const p = paramsFor({}, { pos: M.posOf(1, 2, 30) });
    const s = W.compute({ params: p, rng: makeRng(1) });
    const first = W.animation.init({ params: p, state: s, fromScratch: true });
    first.n = s.units;
    const again = W.animation.init({ params: p, state: s, fromScratch: true });
    return again.n === 0 && again.s === 0;
  })());
}
/* --- 9 · the painted figure ------------------------------------------------ */
console.log("\n9 · the painted figure");
const SWEPT = [];
{
  const empty = paintOf(paramsFor({}), W.compute({ params: paramsFor({}), rng: makeRng(1) }),
    { n: 0, s: 0, beat: 0, acc: 0, phase: "layers", done: false });
  const tiles = W.readout({
    params: paramsFor({}), state: W.compute({ params: paramsFor({}), rng: makeRng(1) }),
    anim: { n: 0, s: 0, beat: 0, acc: 0, phase: "layers", done: false },
  });
  check("the figure starts empty: every tile an em dash, no answer on screen (2.1)",
    tiles.filter((t) => t.value === "—").length === 3
    && !empty.some((s) => /19,977|2,353,000|585/.test(s)),
    tiles.map((t) => t.value).join(" | "));

  const params = paramsFor({});
  const state = W.compute({ params, rng: makeRng(1) });
  const full = W.readout({ params, state, anim: finished(state) });
  check("the finished default prints the three tiles Kenneth picked, verbatim",
    full[0].label === "Parameters in this network" && full[0].value === "19,977"
    && full[0].note === "convolutions 19,392 · head 585"
    && full[1].label === "Receptive field" && full[1].value === "10 of 28 px"
    && full[2].value === "2,353,000",
    full.map((t) => `${t.label} ${t.value}`).join(" | "));

  /* every column, every combination, at three widths */
  const faults = [];
  const nan = [];
  timed("every column of every combination, painted at three widths", () => {
    for (const cfg of EVERY) {
      const p = paramsFor(cfg);
      const s = W.compute({ params: p, rng: makeRng(1) });
      for (let i = 1; i < s.stages.length; i += 1) {
        const rel = i === D.lastSpatial(s.stages) ? M.STAGE_LAST
          : i === s.stages.length - 2 ? M.STAGE_HEAD
            : i === s.stages.length - 1 ? M.STAGE_LINEAR : i;
        for (const w of [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W]) {
          for (const ch of [0, 3]) {
            const pp = paramsFor(cfg, { pos: M.posOfColumn(rel, ch) });
            const said = paintOf(pp, s, finished(s), w);
            SWEPT.push(...said);
            if (said.some((t) => /NaN|undefined|null/.test(t))) {
              nan.push(`${JSON.stringify(cfg)} @${w} column ${i}: ${said.find((t) => /NaN|undefined|null/.test(t))}`);
            }
            for (const f of textFaults(w)) faults.push(`${JSON.stringify(cfg)} @${w} column ${i}: ${f}`);
          }
        }
      }
    }
  });
  check("no painted string carries NaN, undefined or null", nan.length === 0, nan.slice(0, 3).join(" | "));
  check("no two strings share a baseline and overlap, and none runs off an edge",
    faults.length === 0, faults.slice(0, 3).join(" | ") || `${SWEPT.length} strings`);

  /* every press of every phase, for the default and for the two extremes */
  const badBeat = [];
  timed("every press of three networks, painted", () => {
    for (const cfg of [{}, { blocks: 3, k: 5 }, { blocks: 1, base: 16, input: 64, head: "flatten" }]) {
      const p = paramsFor(cfg);
      const s = W.compute({ params: p, rng: makeRng(1) });
      W.animation.init({ params: { ...p, unit: 0, pos: M.POS_DEFAULT }, state: s, fromScratch: true });
      const anim = W.animation.init({ params: p, state: s, fromScratch: true });
      anim.mode = "run";
      const cells = s.stages[D.lastSpatial(s.stages)].H ** 2;
      for (let i = 0; i < 20000; i += 1) {
        const layers = anim.n < s.units;
        const look = layers || anim.p < 3 || anim.u < 3 || (anim.p + anim.u) % 11 === 0;
        if (look) {
          for (const beat of layers ? [0, 0.5] : [0]) {
            const said = paintOf(p, s, { ...anim, beat });
            SWEPT.push(...said);
            if (said.some((t) => /NaN|undefined|null/.test(t))) {
              badBeat.push(`${JSON.stringify(cfg)} ${anim.n}/${anim.p}/${anim.u}`);
            }
            const f = textFaults(M.STAGE_REF);
            if (f.length) badBeat.push(`${JSON.stringify(cfg)} ${anim.n}/${anim.p}/${anim.u}: ${f[0]}`);
          }
        }
        if (!W.animation.advance(anim, {
          dt: layers ? 4 * M.UNIT_MS : Math.max(M.SLIDE_MS0, M.cellMsOf(cells)), params: p, state: s,
        })) break;
      }
    }
  });
  check("every press paints without a NaN and without a collision",
    badBeat.length === 0, badBeat.slice(0, 3).join(" | "));

  check("the map the marked unit is walking is drawn only as far as it has reached", (() => {
    const a = { n: state.units, s: 10, beat: 0, acc: 0, phase: "units", done: false };
    const said = paintOf(paramsFor({}, { patch: true }), state, a);
    const lay = D.galleryLayout(M.STAGE_REF, state.stages);
    const thumb = lay.cols[4].thumbs[0];
    const drawn = rects.filter((r) => r.x >= thumb.x - 0.01 && r.y >= thumb.y - 0.01
      && r.x + r.w <= thumb.x + thumb.size + 1.01 && r.y + r.h <= thumb.y + thumb.size + 1.01
      && r.w < thumb.size - 0.5).length;
    /* ten presses is cell 9, which is row 1 column 2 of a 7 × 7 map, and the
       thumbnail carries those ten cells and the mark on the last of them */
    return said.some((t) => /at row 1, column 2/.test(t)) && drawn === 11;
  })());
  check("a convolution prints its products, its sum and what ReLU did with it", (() => {
    const p = paramsFor({}, { pos: M.posOf(1, 0, 14 * 28 + 14) });
    const said = paintOf(p, state, finished(state));
    return said.some((t) => /^H edge \[3, 3\]$/.test(t))
      && said.some((t) => /=\s-?[\d.−]+$/.test(t) || /products add to/.test(t))
      && said.some((t) => /^ReLU (keeps|sets)/.test(t));
  })());
  check("…and a 5 × 5 kernel prints a sum rather than twenty-five products", (() => {
    const p = paramsFor({ k: 5 }, { pos: M.posOf(1, 0, 14 * 28 + 14) });
    const s = W.compute({ params: p, rng: makeRng(1) });
    return paintOf(p, s, finished(s)).some((t) => /^25 products add to/.test(t));
  })());
  /* ---- round 6's own band: four windows, four slices, the bias, ReLU ------ */
  check("the cross-channel band names the four input maps beside the windows and beside the slices",
    (() => {
      const p = paramsFor({}, { pos: M.posOf(3, 0, 3 * 14 + 6) });
      const said = paintOf(p, state, finished(state));
      return M.KERNELS.every((K) => said.filter((t) => t === K.short).length >= 4)
        && said.some((t) => t === "conv2, one output value")
        && said.some((t) => t === "the membrane kernel over the four channels of pool1 drawn here, "
          + "at row 3, column 6");
    })(), "twice over: once beside pool1's four windows, once beside the four slices");
  check("…and prints the sum, the bias and ReLU in one line, at every cell of every channel",
    (() => {
      const bad = [];
      for (const cfg of [{}, { blocks: 3 }, { blocks: 3, k: 5 }, { input: 64 }]) {
        const p0 = paramsFor(cfg);
        const s0 = W.compute({ params: p0, rng: makeRng(1) });
        const conv = s0.stages.findIndex((st2) => st2.multi);
        for (const ch of [0, 1, 2, 3]) {
          const H = s0.stages[conv].H;
          const idx = Math.floor(H / 2) * H + Math.floor(H / 2);
          const pp = paramsFor(cfg, { pos: M.posOf(conv, ch, idx) });
          const said = paintOf(pp, s0, finished(s0));
          const line = said.find((t) => /^four dot products, then the bias /.test(t));
          const want = s0.maps.stages[conv][ch][idx];
          if (!line || !line.endsWith(`then ReLU: ${want.toFixed(2)}`)) {
            bad.push(`${JSON.stringify(cfg)} ch${ch}: ${line}`);
          }
        }
      }
      return bad.length === 0;
    })(), "the products the band draws add to the value the map holds, at k = 3 and at k = 5");
  check("…and the four are named Membrane, Granule, Body and Nucleus, drawn beside their maps",
    (() => {
      const said = paintOf(params, state, finished(state));
      return ["Membrane", "Granule", "Body", "Nucleus"].every((n) =>
        said.filter((t) => t === n).length === 2)
        && !said.some((t) => /Cell body/.test(t));
    })(), "conv2 and pool2, four names each");
  check("…and the third block says what it repeats and what it scales", (() => {
    const p3 = paramsFor({ blocks: 3 }, { pos: M.posOf(5, 0, 3 * 7 + 3) });
    const s3 = W.compute({ params: p3, rng: makeRng(1) });
    const said = paintOf(p3, s3, finished(s3));
    const p5 = paramsFor({ blocks: 3, k: 5 }, { pos: M.posOf(5, 0, 3 * 7 + 3) });
    const s5 = W.compute({ params: p5, rng: makeRng(1) });
    const at5 = paintOf(p5, s5, finished(s5));
    return said.includes("the third block repeats the second's four, over inputs scaled to its range")
      && at5.includes("the second block's four again, scaled to its range, at their 3 × 3 centre");
  })());
  check("…and conv2 at kernel 5 says the ring it does not draw is zero", (() => {
    const p5 = paramsFor({ k: 5 }, { pos: M.posOf(3, 0, 3 * 14 + 6) });
    const s5 = W.compute({ params: p5, rng: makeRng(1) });
    return paintOf(p5, s5, finished(s5))
      .includes("the 3 × 3 centre of each 5 × 5 slice, whose ring of zeros adds nothing");
  })());

  check("a pooling column prints its maximum and that it has no weights", (() => {
    const p = paramsFor({}, { pos: M.posOfColumn(2) });
    const said = paintOf(p, state, finished(state));
    return said.some((t) => /^max\(/.test(t)) && said.includes("pooling has no weights");
  })());
  check("the head column prints how many channels are not drawn", (() => {
    const p = paramsFor({}, { pos: M.posOfColumn(M.STAGE_HEAD) });
    const said = paintOf(p, state, finished(state));
    return said.some((t) => /^64 channels in all, four drawn$/.test(t))
      && said.some((t) => /^all of them are inputs to Linear\(64, 9\)$/.test(t));
  })());
  check("the linear column prints nine scores, one a class", (() => {
    const p = paramsFor({}, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const said = paintOf(p, state, finished(state));
    return said.some((t) => /^9 class scores$/.test(t))
      && said.some((t) => /^scores /.test(t));
  })());
  check("every column prints its shape and how many channels are not drawn",
    (() => {
      const said = paintOf(params, state, finished(state));
      return said.includes("[32, 28, 28]") && said.includes("+28 more")
        && said.includes("[64, 7, 7]") && said.includes("+60 more")
        && said.includes("[3, 28, 28]") && !said.includes("+2 more");
    })());
  check("…and a three-block network prints the third block's own count", (() => {
    const p = paramsFor({ blocks: 3 });
    const s = W.compute({ params: p, rng: makeRng(1) });
    return paintOf(p, s, finished(s)).includes("+124 more");
  })());
  check("the figure says the kernels are named operators and the image is one square", (() => {
    const said = paintOf(params, state, finished(state));
    return said.includes("the kernels are named image operators, not learned filters")
      && said.includes("The three colour channels of the image are drawn as one grey square.");
  })());
  check("the overrun sentence appears where the patch is wider than the image, and only there",
    EVERY.every((cfg) => {
      const p = paramsFor(cfg);
      const s = W.compute({ params: p, rng: makeRng(1) });
      const net = s.net;
      const l = D.lastSpatial(s.stages);
      const c = M.centreUnit(net, l);
      const span = D.receptiveField(s.stages, l, c, c).cols[0];
      const tile = W.readout({ params: p, state: s, anim: finished(s) })[1];
      return tile.value === `${span[1] - span[0] + 1} of ${net.cfg.input} px`;
    }));


  /* ---- round 5's own figure: the second stage, the strip, the head band --- */
  const faults2 = [];
  timed("the second stage, painted at three widths", () => {
    for (const cfg of EVERY) {
      const pg = paramsFor(cfg, { patch: true });
      const sg = W.compute({ params: pg, rng: makeRng(1) });
      for (const L of ["conv1", M.LAYER_LAST]) {
        for (const w of [M.STAGE_REF, M.STAGE_WIDE, HARNESS_W]) {
          const said = paintOf({ ...pg, layer: L }, sg, opened(sg), w);
          SWEPT.push(...said);
          if (said.some((t) => /NaN|undefined|null/.test(t))) {
            faults2.push(`${JSON.stringify(cfg)} @${w} ${L}: ${said.find((t) => /NaN/.test(t))}`);
          }
          for (const f of textFaults(w)) faults2.push(`${JSON.stringify(cfg)} @${w} ${L}: ${f}`);
        }
      }
    }
  });
  check("behind the gate every combination paints without a NaN and without a collision",
    faults2.length === 0, faults2.slice(0, 3).join(" | ") || `${EVERY.length} networks, three widths, two layers`);

  check("the head figure draws the chosen head and prints the other one's total", (() => {
    const gap = paintOf(params, state, finished(state));
    const pf = paramsFor({ head: "flatten" });
    const sf = W.compute({ params: pf, rng: makeRng(1) });
    const flat = paintOf(pf, sf, finished(sf));
    return gap.includes("Global average pooling") && !gap.includes("Flatten")
      && gap.some((t) => /^Flatten instead:/.test(t))
      && flat.includes("Flatten") && !flat.includes("Global average pooling")
      && flat.some((t) => /^Global average pooling instead:/.test(t));
  })(), "one head drawn, the other printed (round 5, pick B)");
  check("…with both totals and the dense-layer benchmark on screen either way", (() => {
    const gap = paintOf(params, state, finished(state));
    return gap.includes("585") && gap.some((t) => /47,625/.test(t))
      && gap.some((t) => /^One dense layer from this image to 1,000 units:  2,353,000$/.test(t));
  })());
  check("the Flatten head column prints its own shape and what it does not draw", (() => {
    const pf = paramsFor({ head: "flatten" });
    const sf = W.compute({ params: pf, rng: makeRng(1) });
    const said = paintOf(pf, sf, finished(sf));
    return said.includes("[3136]") && said.includes("+3,087 more")
      && !said.includes("[64]");
  })());
  check("the Flatten detail draws the centre of the map rather than four values from nowhere", (() => {
    const pf = paramsFor({ head: "flatten" }, { pos: M.posOfColumn(M.STAGE_HEAD) });
    const sf = W.compute({ params: pf, rng: makeRng(1) });
    const said = paintOf(pf, sf, finished(sf));
    const cells = sf.maps.stages.at(-1)[0];
    const mid = Math.floor(7 / 2) - 1;
    const want = [[mid, mid], [mid, mid + 1], [mid + 1, mid], [mid + 1, mid + 1]]
      .map(([r, c]) => cells[r * 7 + c].toFixed(2));
    return said.some((t) => t === "Flatten, the four values at the centre of this channel")
      && want.every((v) => said.includes(v))
      && said.some((t) => /^3,136 values in all, and these four are at rows 2 and 3 of the map$/.test(t));
  })());
  check("the linear layer's scores are over every value the head produced, and printed", (() => {
    const pl = paramsFor({ head: "flatten" }, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const sl = W.compute({ params: pl, rng: makeRng(1) });
    const said = paintOf(pl, sl, finished(sl));
    const best = sl.maps.scores.reduce((b, v, c) => (Math.abs(v) > Math.abs(sl.maps.scores[b]) ? c : b), 0);
    return said.some((t) => /^Linear\(3136, 9\) over the 196 values of the four channels drawn, before softmax$/.test(t))
      && said.some((t) => /^scores /.test(t) && t.split(/\s+/).length === 10)
      && said.some((t) => t === `class ${best + 1} has the largest score  ·  the weights are one draw before training`);
  })());
  check("the two heads print different scores, from different numbers of inputs", (() => {
    const pf = paramsFor({ head: "flatten" }, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const pg = paramsFor({ head: "gap" }, { pos: M.posOfColumn(M.STAGE_LINEAR) });
    const sf = W.compute({ params: pf, rng: makeRng(1) });
    const sg = W.compute({ params: pg, rng: makeRng(1) });
    const a = paintOf(pf, sf, finished(sf)).find((t) => /^scores /.test(t));
    const b = paintOf(pg, sg, finished(sg)).find((t) => /^scores /.test(t));
    return a !== b;
  })());
  check("before the gate the figure draws no window back to the image, and behind it does", (() => {
    const before = paintOf(params, state, finished(state));
    const after = paintOf(paramsFor({}, { patch: true }), state, opened(state));
    /* the printed lines are the same either way; the windows are geometry, so
       the segment list is what says whether they were drawn */
    paintOf(params, state, finished(state));
    const dry = segments.length;
    paintOf(paramsFor({}, { patch: true }), state, opened(state));
    return segments.length > dry && before.length === after.length;
  })(), "the cone and the windows belong to the second stage (decision 14)");

  /* 5.9 again, over the strings the phases INTRODUCED: they are built at paint
     time, so §4's read of the source literals cannot see all of them */
  const unique = [...new Set(SWEPT)];
  const prose = unique.filter((s) => /\s[a-z]{3,}/.test(s));
  check(`${prose.length} painted sentences use none of the collection's own vocabulary`,
    !prose.some((s) => OURS.test(s)), prose.filter((s) => OURS.test(s)).slice(0, 3).join(" | "));
  check("…and none personifies the figure, or says never",
    !prose.some((s) => PERSON.test(s) || /\bnever\b/i.test(s)),
    prose.filter((s) => PERSON.test(s) || /\bnever\b/i.test(s)).slice(0, 3).join(" | "));
  const said = [W.animation.runTitle, ...Object.values(W.animation.stepTitle.labels),
    ...W.legend.map((l) => l.label)];
  check("the drive titles and the legend read the same way",
    !said.some((s) => OURS.test(s) || PERSON.test(s) || /\bnever\b/i.test(s)),
    said.filter((s) => OURS.test(s) || PERSON.test(s)).join(" | "));
  check("the legend names the marks the figure draws",
    W.legend.length === 8
    && W.legend.map((l) => l.token).join() === "empirical,group-a,group-b,highlight,extreme,reference,dim-a,dim-b");
}

console.log(`\n${ran} checks, ${failed} failed · ${Math.round(performance.now() - T0)} ms`);
console.log(`timings (gating nothing): ${timings.join(" · ")}`);
process.exitCode = failed ? 1 : 0;
