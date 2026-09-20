/* Widget-level measurement for slot 75 `sequence-models` (PHM5005 07-3 cells
 * 26–178), on `widgets/sequence-models/model.js` over the arc's engine
 * `widgets/signal-cnn-lstm/engine.js`, which gains an `Embedding` layer and
 * an input gradient out of `SeqClassifier` for it.  The budgets here were
 * found by `sequence-models-sweep.mjs` and `-sweep2.mjs` (2026-09-20), whose
 * first pass trained NOTHING: the lesson's CNN at half width with a learned
 * table at stride 2, 200 × 20 at Adam 1e-3, sat at chance on a planted
 * 7-mer, and so did every BiLSTM.  What the sweeps found, and this script
 * records on the settled settings.  The rule that settled last (sweeps 5–7):
 * whether a seed finds the motif is decided by its INITIALISATION, so Train
 * is three initialisations probed six epochs on fresh sequences and the best
 * finished — `M.trainRestarts` — and every recurrence trains on fresh draws.
 *
 *   S1 THE ENGINE PASSES its gradient checks with the embedding in front
 *      (one entry of a 250-step unpacked recurrence reads 1e-4 RELATIVE at
 *      an absolute 1e-12 — a vanished gradient, not an error).
 *   S2 ARITHMETIC — the lesson's chain at 250 tokens (cell 28 as run: no
 *      MaxPool), the receptive field in bases, the global max's PAD-only
 *      positions, the parameter counts, at stride 1 and the lesson's 2.
 *   S3 THE CNN ON THE MOTIF — one-hot input, stride 1, 300 × 20 at 1e-2:
 *      accuracy, the click budget, the trained kernels' spelling; the
 *      hand-made kernel before training; the learned table beside it.
 *   S4 STRIDE — the lesson's stride 2 at the same budget: the motif at an
 *      even offset against an odd one, and on composition.  FOUND: under
 *      restarts a stride-2 net reads ONE parity (seed 1 even 100% / odd 4%,
 *      seed 2 even 0% / odd 100%), stride 1 both; the means over seeds that
 *      sweep 4 read as "no effect" were two parities cancelling.
 *   S5 POOL — global max (the lesson's) against average, on both tasks.
 *   S6 BIAS — where a trained channel's max lands with bias on and off.
 *   S7 THE LSTM — on composition (GC-rich against GC-poor): direction ×
 *      pack × reduction at H = 8, 200 × 12; the forward state's move over
 *      the PAD; and on the motif, where it fails; the running prediction.
 *   S8 CNN + LSTM — on page 1's trained convolution, frozen (73's design):
 *      last against max on the motif, and on composition; cell 67's shape
 *      end to end for the record.
 *   S9 OCCLUSION on the trained CNN: k = 4 · 8 · 12 at stride k / 2, the
 *      top window against the planted motif, the map's width, PAD against
 *      N (a quarter of each base) as the baseline, two copies of the motif,
 *      the map through the CNN + LSTM, and the map on composition, where
 *      nothing is local.
 *
 * Run:  node widgets/_lab/sequence-models-measure.mjs
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import * as M from "../sequence-cnn-lstm/model.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => (100 * x).toFixed(0) + "%";
const f = (x, d = 2) => Number(x).toFixed(d);
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const timed = (fn) => { const t = performance.now(); const r = fn(); return { r, ms: performance.now() - t }; };
const p1 = (net) => (x) => E.predict(net, x)[1];
const sec = (ms) => f(mean(ms) / 1000, 1) + " s";

/* the widget's settings, as the sweeps settled them */
const CH = [8, 16];
const CNN = { code: "onehot", stride: 1, channels: CH }, CNN_FIT = { restarts: 3, probe: 6, epochs: 20, lr: 1e-2 }, N_CNN = 300;
const LSTM_FIT = { epochs: 20, lr: 1e-2 }, N_LSTM = { uni: 150, bi: 150 }, N_COMBO = 200;
/** the widget's CNN training: three initialisations probed on fresh sequences, the best finished */
const fitCnn = (rng, opts, task = "motif") => M.trainRestarts(rng, (r) => M.buildCnn(r, { ...CNN, ...opts }), () => M.dataset(rng, N_CNN, 1, task === "motif" ? {} : { task: "composition", gc: GC }), CNN_FIT);
const GC = 0.7;
const motifTrain = M.dataset(makeRng(11), 400, 1), motifTest = M.dataset(makeRng(12), 100, 1);
const compTrain = M.dataset(makeRng(31), 400, 1, { task: "composition", gc: GC }), compTest = M.dataset(makeRng(32), 100, 1, { task: "composition", gc: GC });
const SEEDS = [1, 2, 3];

/* ================================================================== S1 */
head("S1 · gradient checks with the embedding in front");
{
  const rng = makeRng(3);
  const d = M.dataset(rng, 2, 1);
  const check = (name, net, x, y) => {
    const lossFn = (back) => { const out = net.forward(x); const { loss, g } = E.softmaxCE(out.d !== undefined ? out.d : out, y); if (back) net.backward(out.d !== undefined ? { d: g, L: 1 } : g); return loss; };
    const { worst, n } = E.gradCheck(net.params, lossFn, rng, { perParam: 6 });
    console.log(`${name.padEnd(44)} worst rel err ${worst.toExponential(1)} over ${n} entries`);
    return worst;
  };
  const worst = Math.max(
    check("token CNN, learned E = 8, bias, stride 2", M.buildCnn(rng, { E: 8 }), d[1].x, 1),
    check("token CNN, one-hot, stride 1, bias=False, avg", M.buildCnn(rng, { code: "onehot", stride: 1, bias: false, pool: "avg" }), d[0].x, 0),
    check("BiLSTM packed, last", M.buildSeqModel(rng, { pack: true }), d[1].x, 1),
    check("LSTM uni, unpacked, last", M.buildSeqModel(rng, { pack: false, direction: "uni" }), d[1].x, 1),
    check("BiLSTM unpacked, max", M.buildSeqModel(rng, { pack: false, reduce: "max" }), d[0].x, 0),
    check("CNN + LSTM end to end, packed", M.buildSeqModel(rng, { conv: true, pack: true }), d[1].x, 1),
    check("CNN + LSTM end to end, unpacked, mean", M.buildSeqModel(rng, { conv: true, pack: false, reduce: "mean" }), d[0].x, 0),
  );
  console.log(`worst overall ${worst.toExponential(1)} ${worst < 1e-3 ? "— passes (the 1e-4 case, if it shows, is an entry whose gradient vanished over 250 steps: sweep S0)" : "— FAILS"}`);
}

/* ================================================================== S2 */
head("S2 · arithmetic: the lesson's chain at 250 tokens");
{
  for (const stride of [1, 2]) for (const k of M.KERNELS) {
    const ch = M.chain({ k, stride });
    const last = ch.rows[ch.rows.length - 1];
    console.log(`stride ${stride}, k = ${String(k).padStart(2)}: ${ch.rows.map((r) => `${r.name} → L ${r.L}, sees ${r.rf} bases`).join("; ")}; global max over ${last.L}: ${ch.padOnly.length} read PAD only, ${ch.padTouch.length} more touch it`);
  }
  const count = (net) => net.params.reduce((a, p) => a + p.v.length, 0);
  const rng = makeRng(1);
  console.log(`parameters, half width: CNN one-hot ${count(M.buildCnn(rng, CNN))}, learned E = 8 ${count(M.buildCnn(rng, { E: 8 }))}; LSTM uni H = 8 ${count(M.buildSeqModel(rng, { code: "onehot", direction: "uni" }))}, bi ${count(M.buildSeqModel(rng, { code: "onehot" }))}; feature BiLSTM ${count(M.buildFeatureLstm(rng, {}))}`);
  console.log(`the lesson's: CNN E=64 ${6 * 64 + 64 * 16 * 7 + 16 + 16 * 32 * 5 + 32 + 32 * 2 + 2}; BiLSTM E=64 H=128 ${6 * 64 + 2 * 4 * 128 * (64 + 128 + 2) + 256 * 2 + 2}`);
}

/* ================================================================== S3 */
head(`S3 · the CNN on the motif: one-hot, stride 1, ${CH.join("/")} channels, ${CNN_FIT.restarts} restarts × ${CNN_FIT.probe} probe epochs then to ${CNN_FIT.epochs}, fresh ${N_CNN} an epoch at Adam 1e-2`);
{
  const hand = M.motifKernel();
  const rr = makeRng(5);
  const randK = M.BASES.map(() => Float64Array.from({ length: 7 }, () => rr.uniform(-1, 1)));
  const ones = motifTest.filter((d) => d.y === 1);
  const arg = (a) => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
  const hit = ones.filter((d) => d.motifAt.includes(arg(M.pwmScan(hand, d.x.tok)))).length, hitR = ones.filter((d) => d.motifAt.includes(arg(M.pwmScan(randK, d.x.tok)))).length;
  console.log(`before training: the hand-made [4, 7] kernel (+1 on the motif's base, −1/3 elsewhere) scores 7 at a match; its argmax is the planted motif in ${pct(hit / ones.length)} of ${ones.length}; a random [4, 7] kernel ${pct(hitR / ones.length)}`);
  console.log(`class 0 carries the 7-mer by chance in ${pct(motifTrain.concat(motifTest).filter((d) => d.y === 0 && M.motifHits(d.x.tok).length).length / 250)} of 250`);
}
let cnn1 = null;
{
  const accs = [], ms = [], spells = [], peaks = [];
  for (const seed of SEEDS) {
    const rng = makeRng(100 + seed);
    const t = timed(() => fitCnn(rng, {}));
    const net = t.r.net;
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
    const ks = M.kernelsSpelled(net); spells.push(`${ks[0].spell}(${ks[0].match}@${ks[0].offset}) ${ks[1].spell}(${ks[1].match}@${ks[1].offset}) ${ks[2].spell}(${ks[2].match}@${ks[2].offset}) probes ${t.r.probes.map((v) => f(v)).join("/")}`);
    let on = 0; for (const d of motifTest.filter((q) => q.y === 1)) { const tr = M.scoreTrack(net, d.x, ks[0].c); let a = 0; for (let i = 1; i < tr.length; i++) if (tr[i] > tr[a]) a = i; if (d.motifAt.some((m) => Math.abs(a - m) <= 3)) on++; }
    peaks.push(pct(on / 50));
    if (!cnn1 || accs[accs.length - 1] > cnn1.acc) cnn1 = { net, curve: t.r.curve, acc: accs[accs.length - 1], seed };
  }
  console.log(`${sec(ms)}; test ${accs.map(pct).join(" ")}; the three best kernels' spelling by seed: ${spells.join(" | ")}`);
  console.log(`the best kernel's score track peaks within 3 bases of the planted motif in ${peaks.join(" ")} of the class-1 test sequences; loss ${f(cnn1.curve[0])} → ${f(cnn1.curve[cnn1.curve.length - 1])}`);
  console.log(`seed ${cnn1.seed} (the best, kept for occlusion), every kernel: ${M.kernelsSpelled(cnn1.net).map((q) => `k${q.c + 1} ${q.spell} ${q.match}/7@${q.offset}`).join(", ")}`);
}
{
  const accs = [], ms = [], spells = [];
  for (const seed of SEEDS) {
    const rng = makeRng(110 + seed);
    const t = timed(() => fitCnn(rng, { code: "learned", E: 8 }));
    const net = t.r.net;
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
    const ks = M.kernelsSpelled(net); spells.push(`${ks[0].spell}(${ks[0].match})`);
  }
  console.log(`the lesson's learned table at E = 8, same rule: ${sec(ms)}; test ${accs.map(pct).join(" ")}; best kernel read through the table ${spells.join(" ")} (E = 4 was unstable in the sweep: 65 / 48 / 98)`);
}

/* ================================================================== S4 */
head("S4 · stride: the lesson's 2 against 1 at the same budget, by the motif's offset parity (sweep 4 found no parity effect over six seeds), and on composition");
for (const stride of [1, 2]) {
  const even = [], odd = [], zero = [], comp = [];
  for (const seed of SEEDS) {
    const rng = makeRng(120 + seed);
    const net = fitCnn(rng, { stride }).net;
    const ones = motifTest.filter((d) => d.y === 1);
    even.push(E.accuracy(net, ones.filter((d) => d.motifAt[0] % 2 === 0))); odd.push(E.accuracy(net, ones.filter((d) => d.motifAt[0] % 2 === 1)));
    zero.push(E.accuracy(net, motifTest.filter((d) => d.y === 0)));
    const rng2 = makeRng(130 + seed);
    const net2 = fitCnn(rng2, { stride }, "composition").net;
    comp.push(E.accuracy(net2, compTest));
  }
  console.log(`stride ${stride}: motif at an even offset ${even.map(pct).join(" ")}, at an odd offset ${odd.map(pct).join(" ")}, class 0 ${zero.map(pct).join(" ")}; composition ${comp.map(pct).join(" ")}`);
}

/* ================================================================== S5 */
head("S5 · pool: the lesson's global max against average, on both tasks");
for (const pool of ["max", "avg"]) {
  const out = {};
  for (const [task, tr, te] of [["motif", motifTrain, motifTest], ["composition", compTrain, compTest]]) {
    const accs = [], ms = [];
    for (const seed of SEEDS) { const rng = makeRng(140 + seed); const t = timed(() => fitCnn(rng, { pool }, task)); ms.push(t.ms); accs.push(E.accuracy(t.r.net, te)); }
    out[task] = `${accs.map(pct).join(" ")} (${sec(ms)})`;
  }
  console.log(`${pool}: motif ${out.motif}; composition ${out.composition}`);
}

/* ================================================================== S6 */
head("S6 · bias: where a trained channel's global max lands, bias on and off");
for (const bias of [true, false]) {
  let onPad = 0, total = 0;
  const padVals = [];
  for (const seed of SEEDS) {
    const rng = makeRng(150 + seed);
    const net = fitCnn(rng, { bias }).net;
    const ch = M.chain({ k: 7, stride: 1 });
    for (const d of motifTest) {
      net.forward(d.x);
      const arg = net.pool.arg;
      for (let c = 0; c < net.c2; c++) { total++; if (ch.padOnly.includes(arg[c])) onPad++; }
      const a = net.layers[4].forward(net.layers[3].forward(net.layers[2].forward(net.layers[1].forward(net.emb.forward(d.x)))));
      padVals.push(a.d[a.L - 1]);
    }
  }
  console.log(`bias=${bias}: the global max sits on a PAD-only position in ${pct(onPad / total)} of ${total} channel × sequence cases; channel 0's value on the PAD-only outputs ${f(mean(padVals), 3)} (a constant per channel with bias on)`);
}

/* ================================================================== S7 */
head(`S7 · the LSTM on composition (GC ${GC} / ${(1 - GC).toFixed(1)}): direction × pack × reduction, one-hot, H = 8, fresh ${N_LSTM.uni} sequences an epoch × 20 at 1e-2`);
const lstms = {};
for (const direction of ["uni", "bi"]) for (const pack of [true, false]) for (const reduce of ["last", "max"]) {
  const accs = [], ms = [], drift = [];
  for (const seed of SEEDS) {
    const rng = makeRng(160 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction, pack, reduce });
    const t = timed(() => M.trainNet(rng, model, () => M.dataset(rng, N_LSTM[direction], 1, { task: "composition", gc: GC }), LSTM_FIT));
    ms.push(t.ms); accs.push(E.accuracy(model, compTest));
    drift.push(M.padDrift(model, compTest[1].x).move);
    if (seed === 1) lstms[`${direction} ${pack ? "packed" : "unpacked"} ${reduce}`] = model;
  }
  console.log(`${direction.padEnd(3)} ${pack ? "packed  " : "unpacked"} ${reduce.padEnd(4)}: ${sec(ms)}; test ${accs.map(pct).join(" ")}; the forward state's move over the 50 PAD steps ${drift.map((v) => f(v, 2)).join(" ")}`);
}
{
  const accs = [];
  for (const [direction, reduce] of [["uni", "last"], ["bi", "last"], ["bi", "max"]]) {
    const rng = makeRng(170);
    const model = M.buildSeqModel(rng, { code: "onehot", direction, pack: true, reduce });
    M.trainNet(rng, model, () => M.dataset(rng, N_LSTM[direction], 1), LSTM_FIT);
    accs.push(`${direction} ${reduce} ${pct(E.accuracy(model, motifTest))}`);
  }
  console.log(`the same recurrence on the MOTIF, packed: ${accs.join(", ")} — the sweep found no budget up to 400 × 20 at H = 16 (18 s) that beat chance on held-out sequences`);
  const model = lstms["uni packed last"];
  const rows = compTest.slice(0, 4).map((d) => { const c = M.prefixCurve(model, d.x, 20); return `class ${d.y} (GC ${f(M.gcOf(d.x.tok))}): ${c.map((q) => f(q.p, 2)).join(" ")}`; });
  console.log(`running prediction (uni packed last), p(class 1) every 20 bases:\n  ${rows.join("\n  ")}`);
}

/* ================================================================== S8 */
head("S8 · CNN + LSTM on page 1's trained convolution, frozen: last against max, both tasks");
const combos = {};
for (const [task, tr, te] of [["motif", motifTrain, motifTest], ["composition", compTrain, compTest]]) {
  const rng = makeRng(180);
  const cnn = fitCnn(rng, {}, task).net;
  const draw = (r) => () => M.dataset(r, N_COMBO, 1, task === "motif" ? {} : { task: "composition", gc: GC }).map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y }));
  const fTest = te.map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y }));
  for (const reduce of ["last", "max"]) {
    const accs = [], ms = [];
    for (const seed of SEEDS) {
      const rng2 = makeRng(190 + seed);
      const model = M.buildFeatureLstm(rng2, { D: CH[0], pack: true, reduce });
      const t = timed(() => M.trainNet(rng2, model, draw(rng2), { epochs: 8, lr: 1e-2 }));
      ms.push(t.ms); accs.push(E.accuracy(model, fTest));
      if (seed === 1) combos[`${task} ${reduce}`] = { cnn, model };
    }
    console.log(`${task.padEnd(12)} features [250, ${CH[0]}] → BiLSTM H 8, ${reduce}: ${N_COMBO} × 8, ${sec(ms)}; test ${accs.map(pct).join(" ")} (page 1's net ${pct(E.accuracy(cnn, te))})`);
  }
}
{
  const { cnn, model } = combos["motif max"];
  const rows = motifTest.filter((d) => d.y === 1).slice(0, 3).map((d) => {
    const pts = []; for (let t = 19; t < 200; t += 20) { const fx = M.convFeatures(cnn, { tok: d.x.tok.slice(0, t + 1), L: t + 1, len: t + 1 }); pts.push(f(E.predict(model, fx)[1], 2)); }
    return `motif at ${d.motifAt[0]}: ${pts.join(" ")}`;
  });
  console.log(`running prediction (CNN + LSTM, max), every 20 bases:\n  ${rows.join("\n  ")}`);
  const rng = makeRng(199);
  const e2e = M.buildSeqModel(rng, { code: "onehot", conv: true, pack: true, reduce: "last" });
  const t = timed(() => M.trainNet(rng, e2e, () => M.dataset(rng, N_COMBO, 1, { task: "composition", gc: GC }), { epochs: 10, lr: 1e-2 }));
  console.log(`for the record, cell 67's shape END TO END on composition (one-hot → conv k7 → BiLSTM → last): 200 × 10, ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(e2e, compTest))}`);
}

/* ================================================================== S9 */
head("S9 · occlusion on the trained CNN (S3's best seed): k = 4 · 8 · 12, PAD against N, two copies, through the CNN + LSTM, and on composition");
{
  const net = cnn1.net, pr = p1(net);
  console.log(`the net occluded: seed ${cnn1.seed}, held-out ${pct(cnn1.acc)}`);
  const ones = motifTest.filter((d) => d.y === 1).slice(0, 40);
  for (const k of [4, 8, 12]) {
    let top = 0; const widths = [], peaks = [];
    for (const d of ones) {
      const o = M.occlusionWalk(pr, d.x, { k, stride: Math.max(1, k >> 1), baseline: "pad" });
      const best = o.windows.reduce((a, b) => (b.a > a.a ? b : a));
      if (d.motifAt.some((m) => best.start < m + M.MOTIF.length && m < best.start + k)) top++;
      widths.push(M.halfMaxWidth(o.attr)); peaks.push(best.a);
    }
    console.log(`k = ${String(k).padStart(2)}, stride ${k >> 1}: the top window overlaps the planted motif in ${pct(top / ones.length)} of ${ones.length}; half-max width ${f(mean(widths), 1)} bases (the motif is 7); peak |Δp| ${f(mean(peaks), 3)}`);
  }
  const cs = [], pk = [];
  for (const d of ones.slice(0, 20)) {
    const a = M.occlusionWalk(pr, d.x, { k: 8, stride: 4, baseline: "pad" }), b = M.occlusionWalk(pr, d.x, { k: 8, stride: 4, baseline: "unk" });
    cs.push(corr(Array.from(a.attr), Array.from(b.attr))); pk.push([Math.max(...a.attr), Math.max(...b.attr)]);
  }
  console.log(`PAD (zero) against N (a quarter of each base) as the baseline at k = 8: map correlation ${f(mean(cs))}; peak ${f(mean(pk.map((q) => q[0])), 3)} against ${f(mean(pk.map((q) => q[1])), 3)}`);
  const two = M.dataset(makeRng(77), 80, 2).filter((d) => d.y === 1 && d.motifAt.length === 2);
  const wipeWith = (p) => (d, ps) => { const tok = d.x.tok.slice(); for (const s of ps) for (let t = s; t < s + M.MOTIF.length; t++) tok[t] = M.PAD; return p({ tok, L: d.x.L, len: d.x.len }); };
  const w1 = wipeWith(pr);
  console.log(`two copies of the motif (${two.length} sequences), the net trained on one: occluding one copy drops p(class 1) by ${f(mean(two.map((d) => pr(d.x) - w1(d, [d.motifAt[0]]))), 3)}, both by ${f(mean(two.map((d) => pr(d.x) - w1(d, d.motifAt))), 3)}`);
  const rng = makeRng(79);
  const net2 = M.trainRestarts(rng, (r) => M.buildCnn(r, CNN), () => M.dataset(rng, N_CNN, 2), CNN_FIT).net;
  const pr2 = p1(net2), w2 = wipeWith(pr2);
  let top2 = 0; for (const d of two) { const o = M.occlusionWalk(pr2, d.x, { k: 8, stride: 4 }); const best = o.windows.reduce((a, b) => (b.a > a.a ? b : a)); if (d.motifAt.some((m) => best.start < m + 7 && m < best.start + 8)) top2++; }
  console.log(`a net trained on two-copy sequences: occluding one copy drops p by ${f(mean(two.map((d) => pr2(d.x) - w2(d, [d.motifAt[0]]))), 3)}, both by ${f(mean(two.map((d) => pr2(d.x) - w2(d, d.motifAt))), 3)}; the top window is on a copy in ${pct(top2 / two.length)}; its accuracy on one-copy sequences ${pct(E.accuracy(net2, motifTest))}`);
  const { cnn, model } = combos["motif max"];
  const prc = (x) => E.predict(model, M.convFeatures(cnn, x))[1];
  let topc = 0; const wc = [];
  for (const d of ones.slice(0, 20)) { const o = M.occlusionWalk(prc, d.x, { k: 8, stride: 4 }); const best = o.windows.reduce((a, b) => (b.a > a.a ? b : a)); if (d.motifAt.some((m) => best.start < m + 7 && m < best.start + 8)) topc++; wc.push(M.halfMaxWidth(o.attr)); }
  console.log(`through the CNN + LSTM (max) at k = 8: the top window is on the motif in ${pct(topc / 20)}; half-max width ${f(mean(wc), 1)} bases`);
  const { cnn: cnnC } = combos["composition last"];
  const prC = p1(cnnC);
  const wcomp = [], peakC = [];
  for (const d of compTest.slice(0, 20)) { const o = M.occlusionWalk(prC, d.x, { k: 8, stride: 4 }); wcomp.push(M.halfMaxWidth(o.attr)); peakC.push(Math.max(...o.attr)); }
  console.log(`on COMPOSITION (the CNN at ${pct(E.accuracy(cnnC, compTest))}) at k = 8: half-max width ${f(mean(wcomp), 1)} bases, peak |Δp| ${f(mean(peakC), 3)} — nothing local to point at`);
}

console.log(`\ntotal ${secs()} s`);
