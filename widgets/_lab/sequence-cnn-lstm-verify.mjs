/* ============================================================================
   Widget 75 · sequence-cnn-lstm — what the page claims, held to the engine,
   the table and the stage.

       node widgets/_lab/sequence-cnn-lstm-verify.mjs

   §1 the engine's gradient checks with an embedding in front (the token CNN,
      the packed and unpacked recurrence, the convolution under a recurrence)
   §2 the arithmetic the page prints: the chain at stride 1 and 2, the
      receptive field in bases, the global max's PAD-only positions
   §3 THE TABLE IS THE ENGINE'S OUTPUT: every setting the rail can reach has
      a net of the right size, and one setting of each kind retrained here is
      byte-for-byte the shipped one
   §4 the claims, on the shipped nets: the default CNN finds the motif and
      its best kernel spells it; one direction unpacked scores chance on
      composition and packed does not; the CNN + LSTM's final states fail on
      the motif where max does not; occlusion's top window is on the motif;
      the map has the window's width, not the motif's
   §5 the copy: no struck word in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import * as M from "../sequence-cnn-lstm/model.js";
import { TABLE, SPEC } from "../sequence-cnn-lstm/table.js";
import { trainSetting, keysOf, testSet } from "./sequence-cnn-lstm-table.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const build = {
  cnn: (key) => { const [, , code, k, s, pool] = key.split("|"); return M.buildCnn(makeRng(1), { code, E: SPEC.E, k: Number(k.slice(1)), stride: Number(s.slice(1)), pool, channels: SPEC.channels }); },
  lstm: (key) => { const [, , code, direction, packed] = key.split("|"); return M.buildSeqModel(makeRng(1), { code, E: SPEC.E, direction, pack: packed === "packed", reduce: "last", H: SPEC.H }); },
  combo: (key) => { const [, , , , , , reduce] = key.split("|"); return M.buildFeatureLstm(makeRng(1), { D: SPEC.channels[0], H: SPEC.H, pack: true, reduce }); },
};
const shipped = (key) => M.loadWeights(build[key.split("|")[0]](key), M.decodeWeights(TABLE[key].w));

section("§1 the engine with an embedding in front");
{
  const rng = makeRng(3);
  const d = M.dataset(rng, 2, 1);
  const check = (name, net, x, y) => {
    const lossFn = (back) => { const out = net.forward(x); const { loss, g } = E.softmaxCE(out.d !== undefined ? out.d : out, y); if (back) net.backward(out.d !== undefined ? { d: g, L: 1 } : g); return loss; };
    const { worst } = E.gradCheck(net.params, lossFn, rng, { perParam: 5 });
    /* an entry whose gradient vanished over 250 steps reads 1e-4 relative at 1e-12 absolute; anything real reads 1e-7 */
    assert(worst < 1e-3, `${name}: gradient check ${worst.toExponential(1)}`);
  };
  check("token CNN, learned", M.buildCnn(rng, { E: 8, stride: 1 }), d[1].x, 1);
  check("token CNN, one-hot, avg", M.buildCnn(rng, { code: "onehot", stride: 2, pool: "avg" }), d[0].x, 0);
  check("LSTM packed", M.buildSeqModel(rng, { code: "onehot", pack: true }), d[1].x, 1);
  check("LSTM uni unpacked", M.buildSeqModel(rng, { code: "onehot", pack: false, direction: "uni" }), d[1].x, 1);
  check("CNN + LSTM end to end", M.buildSeqModel(rng, { conv: true, pack: true }), d[1].x, 1);
  console.log(`  ${checks} gradient checks`);
}

section("§2 the arithmetic the page prints");
{
  const s1 = M.chain({ k: 7, stride: 1 }), s2 = M.chain({ k: 7, stride: 2 });
  assert(s1.rows.map((r) => r.L).join(",") === "250,125" && s1.rows[1].rf === 11, `stride 1: 250 → 250 → 125, one Conv2 output reads 11 bases (${s1.rows.map((r) => r.L)}, ${s1.rows[1].rf})`);
  assert(s2.rows.map((r) => r.L).join(",") === "125,63" && s2.rows[1].rf === 15, `stride 2: 250 → 125 → 63, 15 bases (${s2.rows.map((r) => r.L)}, ${s2.rows[1].rf})`);
  assert(s1.padOnly.length === 22 && s2.padOnly.length === 11, `PAD-only max positions: 22 at stride 1, 11 at stride 2 (${s1.padOnly.length}, ${s2.padOnly.length})`);
  for (const k of M.KERNELS) assert(M.chain({ k, stride: 1 }).rows[0].rf === k, `k = ${k}: a first-layer output reads k bases`);
  const hand = M.motifKernel();
  const test = M.dataset(makeRng(5), 60, 1).filter((d) => d.y === 1);
  const arg = (a) => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
  const hit = test.filter((d) => d.motifAt.includes(arg(M.pwmScan(hand, d.x.tok)))).length;
  assert(hit === test.length, `the motif's own matrix scores 7 at the motif and its argmax finds it in every class-1 sequence (${hit} of ${test.length})`);
  assert(M.spellAlign("CTGACTC").match === 6 && M.spellAlign("CTGACTC").offset === -1, "a kernel spelling CTGACTC reads as 6 of 7 at a shift of −1");
  assert(M.spellAlign("TGACTCA").match === 7 && M.spellAlign("TGACTCA").offset === 0, "the motif spelled reads as 7 of 7 at no shift");
}

section("§3 the table is the engine's output");
{
  const keys = [...keysOf("cnn"), ...keysOf("lstm"), ...keysOf("combo")];
  assert(keys.length === 208 && keys.every((k) => TABLE[k]), `every setting the rail can reach has a net: ${keys.filter((k) => TABLE[k]).length} of ${keys.length}`);
  for (const key of keys) { const net = build[key.split("|")[0]](key); const n = net.params.reduce((a, p) => a + p.v.length, 0); if (n !== TABLE[key].n || M.decodeWeights(TABLE[key].w).length !== n) { assert(false, `${key}: ${TABLE[key].n} stored, ${n} in the net`); break; } }
  assert(Object.values(TABLE).every((e) => e.curve.length === (e.probes ? SPEC.cnn.epochs : e.n > 900 ? SPEC.lstm.epochs : SPEC.combo.epochs) || e.curve.length === SPEC.combo.epochs || e.curve.length === SPEC.lstm.epochs), "every entry carries its loss curve");
  /* one setting of each kind retrained here and held to the shipped bytes */
  for (const key of ["cnn|motif|onehot|k7|s1|max", "lstm|composition|onehot|uni|unpacked", "combo|motif|onehot|k7|s1|max|max"]) {
    const t = performance.now();
    const fresh = trainSetting(key, TABLE);
    assert(JSON.stringify(fresh) === JSON.stringify(TABLE[key]), `${key} retrained is the shipped entry (${((performance.now() - t) / 1000).toFixed(1)} s)`);
  }
}

section("§4 the claims, on the shipped nets");
{
  const motifTest = testSet("motif"), compTest = testSet("composition");
  const cnn = shipped("cnn|motif|onehot|k7|s1|max");
  const acc = E.accuracy(cnn, motifTest);
  assert(acc >= 0.9, `the default CNN finds the motif: ${pct(acc)} held out`);
  const ks = M.kernelsSpelled(cnn);
  assert(ks[0].match >= 6, `its best kernel spells the motif at 6 or 7 of 7 columns (${ks[0].spell}, ${ks[0].match} at ${ks[0].offset})`);
  const avg = E.accuracy(shipped("cnn|motif|onehot|k7|s1|avg"), motifTest);
  console.log(`  average pooling on the motif: ${pct(avg)} (max ${pct(acc)}) — the arm that loses`);
  /* the parity readout: every stride-1 max net reads both parities; stride-2 max nets read one on at least half the settings */
  const ones = motifTest.filter((d) => d.y === 1);
  const parity = (key) => [0, 1].map((par) => E.accuracy(shipped(key), ones.filter((d) => d.motifAt[0] % 2 === par)));
  let oneSided = 0;
  for (const code of ["onehot", "learned"]) for (const k of M.KERNELS) {
    const p1 = parity(`cnn|motif|${code}|k${k}|s1|max`), p2 = parity(`cnn|motif|${code}|k${k}|s2|max`);
    console.log(`  ${code} k = ${String(k).padStart(2)}: stride 1 even ${pct(p1[0])} odd ${pct(p1[1])} · stride 2 even ${pct(p2[0])} odd ${pct(p2[1])}`);
    if (Math.min(...p2) <= 0.3 && Math.max(...p2) >= 0.9) oneSided++;
  }
  assert(Math.min(...parity("cnn|motif|onehot|k7|s1|max")) >= 0.85, "the default net reads the motif at both parities");
  assert(oneSided >= 4, `stride 2 reads one parity only on ${oneSided} of 8 max settings`);
  const packed = E.accuracy(shipped("lstm|composition|onehot|uni|packed"), compTest), unpacked = E.accuracy(shipped("lstm|composition|onehot|uni|unpacked"), compTest);
  assert(packed >= 0.9 && unpacked <= 0.6, `one direction on composition: packed ${pct(packed)}, unpacked ${pct(unpacked)}`);
  const biUn = E.accuracy(shipped("lstm|composition|onehot|bi|unpacked"), compTest);
  assert(biUn >= 0.85, `both ways unpacked survives through the reverse pass: ${pct(biUn)}`);
  const onMotif = E.accuracy(shipped("lstm|motif|onehot|uni|packed"), motifTest);
  assert(onMotif <= 0.65, `the recurrence on the motif stays near chance: ${pct(onMotif)}`);
  const drift = M.padDrift(shipped("lstm|composition|onehot|uni|unpacked"), compTest[1].x).move;
  assert(drift > 0.1, `the unpacked forward state moves over the PAD: ${drift.toFixed(2)} of its norm`);
  const feats = (d) => ({ x: M.convFeatures(cnn, d.x), y: d.y });
  const last = E.accuracy(shipped("combo|motif|onehot|k7|s1|max|last"), motifTest.map(feats)), mx = E.accuracy(shipped("combo|motif|onehot|k7|s1|max|max"), motifTest.map(feats));
  assert(last <= 0.65 && mx >= 0.9, `CNN + LSTM on the motif: last ${pct(last)}, max ${pct(mx)}`);
  /* occlusion: the top window on the motif, the map the window's width */
  const pr = (x) => E.predict(cnn, x)[1];
  const twenty = ones.slice(0, 20);
  for (const k of [4, 8, 12]) {
    let top = 0; const widths = [];
    for (const d of twenty) { const o = M.occlusionWalk(pr, d.x, { k, stride: k / 2 }); const best = o.windows.reduce((a, b) => (b.a > a.a ? b : a)); if (d.motifAt.some((m) => best.start < m + 7 && m < best.start + k)) top++; widths.push(M.halfMaxWidth(o.attr)); }
    const width = widths.reduce((a, b) => a + b, 0) / widths.length;
    assert(top >= 18, `k = ${k}: the top window overlaps the motif in ${top} of 20`);
    assert(width >= k - 1, `k = ${k}: the map's half-max width is the window's (${width.toFixed(1)} bases)`);
  }
  const two = M.dataset(makeRng(77), 40, 2).filter((d) => d.y === 1 && d.motifAt.length === 2);
  const wipe = (d, ps) => { const tok = d.x.tok.slice(); for (const s of ps) for (let t = s; t < s + 7; t++) tok[t] = M.PAD; return pr({ tok, L: d.x.L, len: d.x.len }); };
  const one = two.map((d) => pr(d.x) - wipe(d, [d.motifAt[0]])).reduce((a, b) => a + b, 0) / two.length, both = two.map((d) => pr(d.x) - wipe(d, d.motifAt)).reduce((a, b) => a + b, 0) / two.length;
  assert(one < 0.1 && both > 0.8, `two copies: occluding one drops p by ${one.toFixed(3)}, both by ${both.toFixed(3)}`);
}

section("§5 the copy");
{
  const src = readFileSync(join(here, "..", "sequence-cnn-lstm", "main.js"), "utf8");
  const S = src.slice(src.indexOf("const S = {"), src.indexOf("/* --------------------------------------------------------- drawing helpers"));
  const strings = S.match(/"[^"\n]*"|`[^`\n]*`/g) ?? [];
  /* budget · probed · spells · class-1 · half-max · asks: struck in the 2026-09-20 audit (internal vocabulary, a coinage, a model asked) */
  const struck = /\b(never|sticky|folksy|lesson|notebook|chapter|chose|wants|remembers|forgets|trained here|budget|probed|spells|class-1|half-max|asks?|asked)\b|\bcell \d/i;
  const hits = strings.filter((s) => struck.test(s));
  assert(hits.length === 0, `no struck word in a reader-facing string: ${hits.slice(0, 5).join(" · ")}`);
  console.log(`  ${strings.length} strings swept`);
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`} — ${checks} assertions`);
process.exit(fails ? 1 : 0);
