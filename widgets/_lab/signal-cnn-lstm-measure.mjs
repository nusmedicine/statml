/* Widget-level measurement for slot 73 `signal-cnn-lstm` (PHM5005 07-2 cells
 * 22–99), on `widgets/signal-cnn-lstm/engine.js` — the arc's engine lifted out
 * of `_lab/dl-seq-measure.mjs`.  Three things the mock needs as numbers:
 *
 *   S1 THE ENGINE STILL PASSES its gradient checks after the move.
 *   S2 THE BUDGET — the lesson's CNN1D at its real length (720 samples, 2 s at
 *      360 Hz) at full width (16 / 32 channels) and at half width (8 / 16),
 *      ms per epoch, so compute() knows whether it can train in a click or the
 *      weights must be trained ahead; and the LSTM forward at 720 steps.
 *   S3 THE STAGE — sinus rhythm against sinus rhythm with planted wide ectopic
 *      beats (the lesson's classes 1–3 are sustained arrhythmias, but a window
 *      the occlusion page can point at needs a beat that is the evidence);
 *      accuracy of the trained net, and whether the k = 32 occlusion peaks on
 *      the ectopic beat with one copy and loses it with two.
 *
 * Run:  node widgets/_lab/signal-cnn-lstm-measure.mjs   (4 s)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-20.
 * S1 — passes: max relative error 9.0e-8 over seven engines after the move.
 * S2 — the lesson's CNN1D on 160 fragments of 720: full width (16/32) 143
 *   ms/epoch → 2.9 s for 20 epochs; HALF WIDTH (8/16) 49 ms/epoch → 1.0 s;
 *   quarter 16 ms.  So compute() trains the half-width net in a click, as 64
 *   did, and the caption says the lesson's is twice as wide.  The BiLSTM at
 *   H = 32 over 720 steps: forward 7.5 ms, forward + backward 24 ms → five
 *   epochs on 160 fragments would be 19 s.  THE LSTM PAGE IS FORWARD-ONLY:
 *   at initialisation, or (a mock question) trained on a decimated trace.
 *   The lesson's H = 64 forward is 16 ms, so drawing the block at H = 64 is
 *   affordable; H = 8 is what fits 550 px.
 * S3 — sinus rhythm against sinus rhythm with one wide ectopic beat: half
 *   width, 200 fragments, 20 epochs, 1.3 s, 100% train and test.  Occlusion
 *   (baseline 0) peaks within 40 samples of the ectopic beat in 88% at
 *   k = 32 / stride 16 with a half-max width of 110 samples (the beat is ~30
 *   wide), 100% and 34 samples at k = 16 / 8, and only 36% at k = 64 / 32
 *   (266 wide) — the window is the resolution, and a window twice the beat
 *   loses it two times in three.  Two ectopic beats: occluding one drops
 *   p(class 1) by 0.018, both by 0.038.  Four of eight first-layer kernels
 *   correlate 0.5–0.7 with a narrow peak: the net learned a QRS detector.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => (100 * x).toFixed(1) + "%";
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const F = (n) => new Float64Array(n);

/* ------------------------------------------------------------ the stage --- */
export const FS = 360, L = 720;

/** One 2 s fragment.  Sinus rhythm: a narrow QRS every 150–180 samples with a
    Q, an S and a T wave; class 1 adds `copies` wide ectopic beats.  z-scored
    per window as the lesson's `normalize` does. */
export function fragment(rng, cls, { copies = 1 } = {}) {
  const x = F(L);
  const period = 150 + Math.floor(rng.next() * 30), phase = Math.floor(rng.next() * period);
  const beats = [];
  for (let t = phase; t < L; t += period) beats.push(t);
  const ectopic = [];
  if (cls === 1) {
    const cands = beats.filter((b) => b > 60 && b < L - 60);
    for (let c = 0; c < copies && cands.length; c++) ectopic.push(cands.splice(Math.floor(rng.next() * cands.length), 1)[0]);
  }
  for (const b of beats) {
    if (ectopic.includes(b)) {
      // a wide, tall, T-less complex: ~30 samples wide, opposite deflection after
      for (let d = -40; d <= 40; d++) if (b + d >= 0 && b + d < L) x[b + d] += 1.3 * Math.exp(-(d * d) / (2 * 11 * 11)) - 0.35 * Math.exp(-((d - 26) ** 2) / (2 * 9 * 9));
      continue;
    }
    for (let d = -3; d <= 3; d++) if (b + d >= 0 && b + d < L) x[b + d] += 1.0 * (1 - Math.abs(d) / 4);
    for (let d = -8; d < -3; d++) if (b + d >= 0) x[b + d] -= 0.12;
    for (let d = 4; d < 12; d++) if (b + d < L) x[b + d] -= 0.18;
    for (let d = 40; d < 90; d++) if (b + d < L) x[b + d] += 0.22 * Math.sin(Math.PI * (d - 40) / 50);
  }
  for (let t = 0; t < L; t++) x[t] += rng.normal(0, 0.03) + 0.08 * Math.sin(2 * Math.PI * t / 500 + rng.next());
  const mu = x.reduce((a, b) => a + b, 0) / L, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / L);
  for (let t = 0; t < L; t++) x[t] = (x[t] - mu) / sd;
  return { x: { d: x, L }, y: cls, beats, ectopic };
}

/** The lesson's CNN1D, at a channel width. */
export function lessonNet(rng, c1 = 16, c2 = 32, { pool = "avg" } = {}) {
  return E.Sequential([
    E.Conv1d(rng, 1, c1, 7, 2, 3), E.ReLU(), E.MaxPool1d(c1, 2),
    E.Conv1d(rng, c1, c2, 5, 2, 2), E.ReLU(), E.GlobalPool(c2, pool),
    E.Linear(rng, c2, 2),
  ]);
}

/* ==================================================================== S1 */
head("S1 · gradient checks on the moved engine");
{
  const rng = makeRng(3);
  const net = E.Sequential([E.Conv1d(rng, 2, 3, 3, 2, 1), E.ReLU(), E.MaxPool1d(3, 2), E.Conv1d(rng, 3, 2, 3, 1, 1), E.ReLU(), E.GlobalPool(2, "avg"), E.Linear(rng, 2, 3)]);
  const x = { d: F(24).map(() => rng.uniform(-1, 1)), L: 12 };
  let r = E.gradCheck(net.params, (back) => { const out = net.forward(x); const { loss, g } = E.softmaxCE(out.d, 1); if (back) net.backward({ d: g, L: 1 }); return loss; }, rng);
  console.log(`CNN: ${r.n} entries, max relative error ${r.worst.toExponential(2)}`);
  if (r.worst > 1e-5) throw new Error("CNN gradient check failed");
  const X = Array.from({ length: 6 }, () => F(3).map(() => rng.uniform(-1, 1)));
  for (const cellKind of ["rnn", "lstm"]) for (const pool of ["last", "mean", "max"]) {
    const m = E.SeqClassifier(rng, { cellKind, D: 3, H: 4, bidirectional: true, pool, classes: 2 });
    r = E.gradCheck(m.params, (back) => { const z = m.forward(X); const { loss, g } = E.softmaxCE(z, 1); if (back) m.backward(g); return loss; }, rng);
    console.log(`${cellKind} bi ${pool}: ${r.n} entries, max relative error ${r.worst.toExponential(2)}`);
    if (r.worst > 1e-5) throw new Error(`${cellKind} ${pool} gradient check failed`);
  }
}

/* ==================================================================== S2 */
head("S2 · the budget: the lesson's CNN1D at 720 samples");
const rngData = makeRng(11);
const train = Array.from({ length: 200 }, (_, i) => fragment(rngData, i % 2)), test = Array.from({ length: 100 }, (_, i) => fragment(rngData, i % 2));
{
  for (const [c1, c2] of [[16, 32], [8, 16], [4, 8]]) {
    const rng = makeRng(5);
    const net = lessonNet(rng, c1, c2);
    const t = Date.now();
    E.train(rng, net, train.slice(0, 160), { epochs: 5, lr: 1e-3 });
    const ms = (Date.now() - t) / 5;
    console.log(`conv(1→${c1}) pool conv(${c1}→${c2}) GAP linear — 160 fragments of 720: ${ms.toFixed(0)} ms/epoch → 20 epochs ${(ms * 20 / 1000).toFixed(1)} s`);
  }
  const rng = makeRng(5);
  const lstm = E.SeqClassifier(rng, { cellKind: "lstm", D: 1, H: 32, bidirectional: true, pool: "max" });
  const X = Array.from({ length: L }, (_, t) => F(1).map(() => train[0].x.d[t]));
  let t = Date.now(); for (let i = 0; i < 10; i++) lstm.forward(X); const fwd = (Date.now() - t) / 10;
  t = Date.now(); for (let i = 0; i < 3; i++) { const z = lstm.forward(X); const { g } = E.softmaxCE(z, 1); lstm.backward(g); } const fb = (Date.now() - t) / 3;
  console.log(`BiLSTM(1→32) over 720 steps: forward ${fwd.toFixed(1)} ms, forward+backward ${fb.toFixed(0)} ms → training 160 fragments for 5 epochs would be ${(fb * 800 / 1000).toFixed(0)} s`);
  const lstm64 = E.SeqClassifier(rng, { cellKind: "lstm", D: 1, H: 64, bidirectional: true, pool: "max" });
  t = Date.now(); for (let i = 0; i < 5; i++) lstm64.forward(X); console.log(`BiLSTM(1→64), the lesson's H, forward over 720 steps: ${((Date.now() - t) / 5).toFixed(1)} ms`);
}

/* ==================================================================== S3 */
head("S3 · the stage: sinus rhythm against sinus rhythm with a wide ectopic beat");
{
  const rng = makeRng(7);
  const net = lessonNet(rng, 8, 16);
  const curve = [];
  const t = Date.now();
  E.train(rng, net, train, { epochs: 20, lr: 1e-3, onEpoch: (e, l) => curve.push(l) });
  console.log(`half width, 200 fragments, 20 epochs in ${((Date.now() - t) / 1000).toFixed(1)} s: train ${pct(E.accuracy(net, train))}, test ${pct(E.accuracy(net, test))}; loss ${curve[0].toFixed(3)} → ${curve[curve.length - 1].toFixed(3)}`);
  const zero = () => 0;
  const pos = test.filter((d) => d.y === 1);
  for (const [k, s] of [[32, 16], [16, 8], [64, 32]]) {
    let hit = 0, width = 0;
    for (const d of pos) {
      const { attr } = E.occlusion(net, d.x, 1, k, s, zero);
      const m = Math.max(...attr); let pk = 0, above = 0;
      for (let i = 0; i < L; i++) { if (attr[i] === m) pk = i; if (attr[i] > m / 2) above++; }
      if (Math.abs(pk - d.ectopic[0]) <= 40) hit++; width += above;
    }
    console.log(`occlusion k=${k} stride=${s}: peak within 40 samples of the ectopic beat in ${pct(hit / pos.length)} of ${pos.length}; half-max width ${(width / pos.length).toFixed(0)} samples (the beat is ~30 wide)`);
  }
  // two copies
  let one = 0, both = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const d = fragment(rng, 1, { copies: 2 }); if (d.ectopic.length < 2) continue;
    const base = E.predict(net, d.x)[1];
    const wipe = (cs) => { const x = d.x.d.slice(); for (const c of cs) for (let t = Math.max(0, c - 40); t < Math.min(L, c + 40); t++) x[t] = 0; return E.predict(net, { d: x, L })[1]; };
    one += base - wipe([d.ectopic[0]]); both += base - wipe(d.ectopic); n++;
  }
  console.log(`two ectopic beats (${n} fragments): occluding one drops p(class 1) by ${(one / n).toFixed(3)}, both by ${(both / n).toFixed(3)}`);
  // the first-layer kernels: do any look like a QRS?  report each kernel's correlation with the narrow-QRS template
  const conv1 = net.layers[0];
  const tmpl = [-0.12, 0.25, 0.5, 0.75, 1, 0.75, 0.5].map((v, i, a) => v - a.reduce((p, q) => p + q, 0) / 7);
  const corr = (w) => { const m = w.reduce((p, q) => p + q, 0) / 7; const wc = w.map((v) => v - m); const n1 = Math.sqrt(wc.reduce((p, q) => p + q * q, 0)), n2 = Math.sqrt(tmpl.reduce((p, q) => p + q * q, 0)); return wc.reduce((p, q, i) => p + q * tmpl[i], 0) / (n1 * n2 || 1); };
  const ks = Array.from({ length: 8 }, (_, o) => corr(Array.from(conv1.W.v.slice(o * 7, o * 7 + 7))));
  console.log(`first-layer kernels' correlation with a narrow-peak template: ${ks.map((v) => v.toFixed(2)).join(" ")}`);
}
console.log(`\ntotal ${secs()} s`);
