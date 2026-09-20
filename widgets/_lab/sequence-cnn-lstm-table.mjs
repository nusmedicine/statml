/* ============================================================================
   Widget 75 · the table of trained nets, generated here and shipped as
   `widgets/sequence-cnn-lstm/table.js`.

       node widgets/_lab/sequence-cnn-lstm-table.mjs            (everything, ~7 min)
       node widgets/_lab/sequence-cnn-lstm-table.mjs cnn lstm   (the two the combo stands on)
       node widgets/_lab/sequence-cnn-lstm-table.mjs combo      (then the combo, from table.js)

   WHY A TABLE AND NOT TRAINING IN THE PAGE (his pick, 2026-09-20). Seven
   sweeps found that whether a seed's CNN finds the planted 7-mer is decided
   by its initialisation — three random restarts fix it, at 2.3 s a click —
   and he chose to train everything ahead instead, as 65 did: the CNN per
   task × encoding × k × stride × pool (64 nets, each the best of three
   restarts, with its three probe losses so the page can say one was kept),
   the LSTM per task × encoding × direction × pack (16), the CNN + LSTM per
   task × encoding × k × stride × pool × reduce standing on the CNN table's
   net at the same setting (128). Seed on the page draws the sequence shown
   and nothing else. `_lab/sequence-cnn-lstm-verify.mjs` retrains a setting
   of each kind and holds the table to it, so the table is the engine's
   output and not a copy of it.

   Every setting trains at its own seed, a hash of its key, on fresh
   sequences each epoch (the stage is synthetic), and is scored once on a
   fixed held-out set of 100 per task. Copies is not a training setting: the
   two- and three-copy sequences are shown to the one-copy net, which is the
   failure to include as measured.
   ========================================================================= */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import * as M from "../sequence-cnn-lstm/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "sequence-cnn-lstm", "table.js");

export const SPEC = {
  channels: [M.C1, M.C2], H: M.H_LSTM, E: 8, gc: 0.7,
  /* five restarts, not the sweeps' three: at three the learned table's k = 7 net landed at 75% (2026-09-20) */
  cnn: { restarts: 5, probe: 6, epochs: 20, lr: 1e-2, n: 300 },
  lstm: { epochs: 20, lr: 1e-2, n: 150 },
  combo: { epochs: 8, lr: 1e-2, n: 200 },
  nTest: 100, testSeed: 9000,
};
export const TASKS = ["motif", "composition"], CODES = ["onehot", "learned"], KS = M.KERNELS, STRIDES = [1, 2], POOLS = ["max", "avg"];
export const DIRECTIONS = ["uni", "bi"], PACKS = [true, false], REDUCES = ["last", "max"];

/** a seed from a key: FNV-1a over the string, so a setting retrains alone to the same net */
export function seedOf(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}
const taskOpts = (task) => (task === "motif" ? {} : { task: "composition", gc: SPEC.gc });
export const testSet = (task) => M.dataset(makeRng(SPEC.testSeed + (task === "motif" ? 0 : 1)), SPEC.nTest, 1, taskOpts(task));
const r3 = (v) => Math.round(v * 1000) / 1000;

/** train one setting from its key; returns what the table stores for it */
export function trainSetting(key, table = null) {
  const [kind, task, code, ...rest] = key.split("|");
  const rng = makeRng(seedOf(key));
  const opts = taskOpts(task);
  const test = testSet(task);
  if (kind === "cnn") {
    const [k, s, pool] = [Number(rest[0].slice(1)), Number(rest[1].slice(1)), rest[2]];
    const build = (r) => M.buildCnn(r, { code, E: SPEC.E, k, stride: s, pool, channels: SPEC.channels });
    const t = M.trainRestarts(rng, build, () => M.dataset(rng, SPEC.cnn.n, 1, opts), SPEC.cnn);
    return { w: M.encodeWeights(M.flatWeights(t.net)), n: t.net.params.reduce((a, p) => a + p.v.length, 0), curve: t.curve.map(r3), probes: t.probes.map(r3), best: t.best, acc: E.accuracy(t.net, test) };
  }
  if (kind === "lstm") {
    const [direction, packed] = rest;
    const model = M.buildSeqModel(rng, { code, E: SPEC.E, direction, pack: packed === "packed", reduce: "last", H: SPEC.H });
    const curve = M.trainNet(rng, model, () => M.dataset(rng, SPEC.lstm.n, 1, opts), SPEC.lstm);
    return { w: M.encodeWeights(M.flatWeights(model)), n: model.params.reduce((a, p) => a + p.v.length, 0), curve: curve.map(r3), acc: E.accuracy(model, test) };
  }
  if (kind === "combo") {
    const [k, s, pool, reduce] = [Number(rest[0].slice(1)), Number(rest[1].slice(1)), rest[2], rest[3]];
    const cnnKey = M.keyCnn({ task, code, k, stride: s, pool });
    const entry = table?.[cnnKey];
    if (!entry) throw new Error(`combo ${key}: no CNN in the table at ${cnnKey}`);
    const cnn = M.loadWeights(M.buildCnn(makeRng(1), { code, E: SPEC.E, k, stride: s, pool, channels: SPEC.channels }), M.decodeWeights(entry.w));
    const model = M.buildFeatureLstm(rng, { D: SPEC.channels[0], H: SPEC.H, pack: true, reduce });
    const feats = (d) => ({ x: M.convFeatures(cnn, d.x), y: d.y });
    const curve = M.trainNet(rng, model, () => M.dataset(rng, SPEC.combo.n, 1, opts).map(feats), SPEC.combo);
    return { w: M.encodeWeights(M.flatWeights(model)), n: model.params.reduce((a, p) => a + p.v.length, 0), curve: curve.map(r3), acc: E.accuracy(model, test.map(feats)) };
  }
  throw new Error(`unknown kind in ${key}`);
}

export function keysOf(kind) {
  const out = [];
  for (const task of TASKS) for (const code of CODES) {
    if (kind === "cnn") for (const k of KS) for (const stride of STRIDES) for (const pool of POOLS) out.push(M.keyCnn({ task, code, k, stride, pool }));
    if (kind === "lstm") for (const direction of DIRECTIONS) for (const pack of PACKS) out.push(M.keyLstm({ task, code, direction, pack }));
    if (kind === "combo") for (const k of KS) for (const stride of STRIDES) for (const pool of POOLS) for (const reduce of REDUCES) out.push(M.keyCombo({ task, code, k, stride, pool, reduce }));
  }
  return out;
}

function readTable() {
  if (!existsSync(OUT)) return {};
  const src = readFileSync(OUT, "utf8");
  const m = src.match(/export const TABLE = (\{[\s\S]*\});\s*$/);
  return m ? JSON.parse(m[1]) : {};
}

function writeTable(table) {
  const head = `/* GENERATED by widgets/_lab/sequence-cnn-lstm-table.mjs — do not edit. Every net the page can\n   show, trained by widgets/signal-cnn-lstm/engine.js on the stage in model.js; weights float32 in base64. */\n`;
  writeFileSync(OUT, `${head}export const SPEC = ${JSON.stringify(SPEC)};\nexport const TABLE = ${JSON.stringify(table)};\n`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const kinds = process.argv.slice(2).length ? process.argv.slice(2) : ["cnn", "lstm", "combo"];
  const table = readTable();
  const t0 = Date.now();
  for (const kind of kinds) {
    const keys = keysOf(kind);
    console.log(`${kind}: ${keys.length} settings`);
    for (const key of keys) {
      const t = performance.now();
      table[key] = trainSetting(key, table);
      console.log(`  ${key.padEnd(52)} ${(100 * table[key].acc).toFixed(0).padStart(3)}%  ${((performance.now() - t) / 1000).toFixed(1)} s${table[key].probes ? `  probes ${table[key].probes.join("/")}` : ""}`);
    }
    writeTable(table);
  }
  console.log(`written ${OUT} with ${Object.keys(table).length} nets in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
