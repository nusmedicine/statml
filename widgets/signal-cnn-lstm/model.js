/* ============================================================================
   Widget 73 · Signals: CNN and LSTM — the arithmetic, and nothing that draws.

   PHM5005 07-2 cells 22–99: the lesson's `CNN1D`, `BiLSTM` and `CNN_LSTM` on
   2 s ECG fragments at 360 Hz, and Captum's `Occlusion` on the trained CNN.
   `engine.js` is the layers, the optimiser and the occlusion loop; this file
   is the STAGE (what a fragment is), the lesson's nets at the width the
   browser affords, the dimension chain a page prints, and the LSTM page's
   forward-only readings. `_lab/signal-cnn-lstm-measure.mjs` measured every
   number a comment here quotes (2026-09-20).

   THE STAGE IS NOT THE LESSON'S DATA. The lesson's fragments are PhysioNet's
   (Dangerous = VF / VT / TdP, sustained arrhythmias; OK = the rest). A widget
   whose occlusion page points a window at the evidence needs a beat that IS
   the evidence, so class 1 is sinus rhythm with `copies` wide ectopic beats
   planted, and class 0 is sinus rhythm. The classes are named by what they
   are, never by the lesson's labels; a caption says what the lesson trains on.

   THE NET IS THE LESSON'S AT HALF WIDTH. `Conv1d(1, 16, 7, s2, p3)` → ReLU →
   `MaxPool1d(2)` → `Conv1d(16, 32, 5, s2, p2)` → ReLU → `AdaptiveAvgPool1d(1)`
   → `Linear(32, 2)` trains in 2.9 s for 20 epochs on 160 fragments; at 8 and
   16 channels it is 1.0 s, which is the click budget widget 64 set. Dropout
   is left out: it changes nothing a page draws and 50 owns it.
   ========================================================================= */

import * as E from "./engine.js";

export const FS = 360;               // Hz, PhysioNet's rate for the fragment database
export const L = 2 * FS;             // 720 samples, the lesson's 2 s fragment
export const C1 = 8, C2 = 16;        // half the lesson's 16 / 32
export const H_LSTM = 8;             // the LSTM page draws H = 8 (the lesson's is 64)

/** kernel sizes the CNN page offers, each read in samples AND milliseconds */
export const KERNELS = [3, 7, 15, 31];
export const ms = (samples) => (1000 * samples) / FS;

/* ------------------------------------------------------------ the stage --- */

const F = (n) => new Float64Array(n);

/**
 * One 2 s fragment. Sinus rhythm: a narrow QRS (a Q dip, a 7-sample R, an S
 * dip) every 150–180 samples with a T wave 40–90 samples after it; class 1
 * replaces `copies` beats, chosen away from the edges, with a wide ectopic
 * complex (~30 samples at half height, taller, T-less, an opposite deflection
 * after). Small noise and a slow baseline wander, then the lesson's per-window
 * z-score (`normalize`). Returns the beat positions so a page can mark them.
 */
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
      for (let d = -40; d <= 40; d++) if (b + d >= 0 && b + d < L) x[b + d] += 1.3 * Math.exp(-(d * d) / (2 * 11 * 11)) - 0.35 * Math.exp(-((d - 26) ** 2) / (2 * 9 * 9));
      continue;
    }
    for (let d = -3; d <= 3; d++) if (b + d >= 0 && b + d < L) x[b + d] += 1.0 * (1 - Math.abs(d) / 4);
    for (let d = -8; d < -3; d++) if (b + d >= 0) x[b + d] -= 0.12;
    for (let d = 4; d < 12; d++) if (b + d < L) x[b + d] -= 0.18;
    for (let d = 40; d < 90; d++) if (b + d < L) x[b + d] += 0.22 * Math.sin(Math.PI * (d - 40) / 50);
  }
  const wanderPhase = rng.next() * 2 * Math.PI;
  for (let t = 0; t < L; t++) x[t] += rng.normal(0, 0.03) + 0.08 * Math.sin(2 * Math.PI * t / 500 + wanderPhase);
  const mu = x.reduce((a, b) => a + b, 0) / L, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / L);
  for (let t = 0; t < L; t++) x[t] = (x[t] - mu) / sd;
  return { x: { d: x, L }, y: cls, beats, ectopic: ectopic.sort((a, b) => a - b) };
}

/** `n` fragments, classes alternating so every batch is balanced. */
export function dataset(rng, n, copies) {
  return Array.from({ length: n }, (_, i) => fragment(rng, i % 2, { copies }));
}

/* -------------------------------------------------------------- the nets --- */

/** torch's padding for "same length at stride 1": ⌊k/2⌋, the lesson's rule */
export const samePad = (k) => Math.floor(k / 2);

/**
 * The lesson's CNN1D at half width, its first kernel `k` / `stride` / `pad`
 * as the page sets them, its head `pool` (avg, the lesson's; max, 07-3's).
 * The second convolution keeps the lesson's 5 / 2 / 2.
 */
export function buildNet(rng, { k = 7, stride = 2, pad = "same", pool = "avg" } = {}) {
  const p = pad === "same" ? samePad(k) : 0;
  return E.Sequential([
    E.Conv1d(rng, 1, C1, k, stride, p), E.ReLU(), E.MaxPool1d(C1, 2),
    E.Conv1d(rng, C1, C2, 5, 2, 2), E.ReLU(), E.GlobalPool(C2, pool),
    E.Linear(rng, C2, 2),
  ]);
}

/** Train in place; returns the per-epoch mean loss. */
export function trainNet(rng, net, data, { epochs = 20, lr = 1e-3 } = {}) {
  const curve = [];
  E.train(rng, net, data, { epochs, lr, onEpoch: (_, l) => curve.push(l) });
  return curve;
}

/**
 * The dimension chain the lesson prints (cell 22 "Dimensions"), for the
 * page's k / stride / pad: each layer's output length, and the receptive
 * field of one output in samples with its jump — `r + (k − 1)·jump`.
 */
export function chain({ k = 7, stride = 2, pad = "same" } = {}) {
  const p = pad === "same" ? samePad(k) : 0;
  const rows = [];
  let l = L, r = 1, j = 1;
  const step = (name, kk, s, pp) => { l = E.convOut(l, kk, s, pp); r += (kk - 1) * j; j *= s; rows.push({ name, L: l, rf: r, jump: j }); };
  step(`Conv1 k${k} s${stride} p${p}`, k, stride, p);
  step("MaxPool1d(2)", 2, 2, 0);
  step("Conv2 k5 s2 p2", 5, 2, 2);
  return rows;
}

/* ------------------------------------------------------------- occlusion --- */

export const BASELINES = {
  zero: () => 0,
  mean: (x, s, k) => { let m = 0; for (let t = s; t < s + k; t++) m += x[t]; return m / k; },
};

/** Captum's recipe on one fragment; the lesson's k = 32, stride = k / 2. */
export function occlude(net, x, { k = 32, stride = 16, baseline = "zero" } = {}) {
  return E.occlusion(net, x, 1, k, stride, BASELINES[baseline]);
}

/**
 * The same recipe kept window by window, so a page can walk it: for each
 * window its start, the probability with the window at the baseline, and
 * |Δp|; and the per-position map Captum would return (overlaps averaged).
 * `predict(x)` is any trained model's p(class 1) for a fragment — occlusion
 * asks the model again and knows nothing about its inside, so the CNN, the
 * LSTM and the CNN + LSTM go through the same walk.
 */
export function occlusionWalk(predict, x, { k = 32, stride = 16, baseline = "zero" } = {}) {
  const L = x.L, base = predict(x), fn = BASELINES[baseline];
  const windows = [];
  const attr = F(L), count = F(L);
  for (let s = 0; s + k <= L; s += stride) {
    const d = x.d.slice();
    for (let t = s; t < s + k; t++) d[t] = fn(x.d, s, k, t);
    const p = predict({ d, L });
    const a = Math.abs(base - p);
    windows.push({ start: s, p, a });
    for (let t = s; t < s + k; t++) { attr[t] += a; count[t]++; }
  }
  for (let t = 0; t < L; t++) attr[t] /= Math.max(1, count[t]);
  return { base, windows, attr, k, stride };
}

/** the half-max width of an attribution map, in samples — the page's one number for resolution */
export function halfMaxWidth(attr) {
  let m = -Infinity; for (const v of attr) if (v > m) m = v;
  let n = 0; for (const v of attr) if (v > m / 2) n++;
  return n;
}

/* ----------------------------------------------------------------- LSTM --- */

/** The fragment as the LSTM reads it after the permute: 720 steps of one feature. */
export const rawSequence = (x) => Array.from({ length: x.L }, (_, t) => F(1).fill(x.d[t]));

/**
 * The lesson's CNN_LSTM front end, from page 1's trained net: the maps after
 * the second convolution and its ReLU, `[C2, L']`, permuted to L' steps of C2
 * features. The convolutions are the trained ones; only the LSTM is new.
 */
export function convFeatures(net, x) {
  const a = net.activations(x)[4];
  const Lp = a.L;
  return Array.from({ length: Lp }, (_, t) => { const v = F(C2); for (let c = 0; c < C2; c++) v[c] = a.d[c * Lp + t]; return v; });
}

/**
 * A BiLSTM trained in the browser, at H = 8. Measured 2026-09-20: on the raw
 * 720 steps, 100 fragments × 6 epochs is 1.6 s and 90% held out with max
 * pooling, 48% with the last states — the reduction is trained into the head,
 * so it is a DATA parameter here; on the CNN's 90 steps of 16 features, 100
 * fragments × 8 epochs is 0.4 s and 100%.
 */
export function trainLstm(rng, seqs, { D, H = H_LSTM, reduce = "max", bidirectional = true, epochs = 6, lr = 1e-2 } = {}) {
  const model = E.SeqClassifier(rng, { cellKind: "lstm", D, H, bidirectional, pool: reduce });
  const curve = [];
  E.train(rng, model, seqs, { epochs, lr, onEpoch: (_, l) => curve.push(l) });
  return { model, curve };
}

/** Everything a page draws of one sequence through a trained LSTM: the block
    of outputs `[T, F]`, the reduced vector, the probability. */
export function lstmReading(model, X) {
  const z = model.forward(X);
  const p = E.softmaxCE(z, 0).p;
  return { feats: model.feats.map((r) => r.slice()), reduced: model.z.slice(), p, arg: Array.from(model.arg) };
}

/**
 * The running prediction: the trained model's probability if the sequence
 * ENDED at step t — the whole model run on the prefix x[0..t], sampled every
 * `every` steps. This is the honest "when does the model know": a bidirectional
 * model has no partial state at t, so the prefix is re-read from its start.
 */
export function prefixCurve(model, X, every) {
  const out = [];
  for (let t = every - 1; t < X.length; t += every) {
    const z = model.forward(X.slice(0, t + 1));
    out.push({ t, p: E.softmaxCE(z, 0).p[1] });
  }
  if (out.length === 0 || out[out.length - 1].t !== X.length - 1) { const z = model.forward(X); out.push({ t: X.length - 1, p: E.softmaxCE(z, 0).p[1] }); }
  return out;
}

/**
 * The LSTM page's forward-only stage: the lesson's BiLSTM over the fragment's
 * 720 steps (one feature per step, `[B, L, C]` after the permute), at
 * initialisation — the browser cannot train it (24 ms a fragment for one
 * forward + backward, measured). Returns the per-step features `[L, 2H]`, the
 * three reductions the lesson tables, and `sensitivity(t)`: how much the
 * forward pass's last state moves when x_t is nudged, relative to nudging
 * x_L — the memory bottleneck, read directly.
 */
export function lstmStage(rng, x, { H = H_LSTM, bidirectional = true } = {}) {
  const model = E.SeqClassifier(rng, { cellKind: "lstm", D: 1, H, bidirectional, pool: "last" });
  const X = Array.from({ length: x.L }, (_, t) => F(1).fill(x.d[t]));
  model.forward(X);
  const feats = model.feats;
  const T = X.length;
  const reduce = {
    last: feats[T - 1].map((v, j) => (j < H ? v : feats[0][j])),
    mean: feats[0].map((_, j) => feats.reduce((a, r) => a + r[j], 0) / T),
    max: feats[0].map((_, j) => Math.max(...feats.map((r) => r[j]))),
  };
  const fwd = model.fwd;
  const base = fwd.forward(X)[T - 1].slice();
  const sensitivity = (t, eps = 1e-4) => {
    const X2 = X.map((v) => v.slice()); X2[t][0] += eps;
    const h = fwd.forward(X2)[T - 1];
    let s = 0; for (let j = 0; j < H; j++) s += (h[j] - base[j]) ** 2;
    return Math.sqrt(s) / eps;
  };
  const ref = sensitivity(T - 1);
  return { model, feats, reduce, sensitivity: (t) => sensitivity(t) / ref, H, T };
}

/** The CNN + LSTM strip's shapes, the lesson's cell 67 (no stride, one pool). */
export function comboShapes({ B = "B", Cc = 64, H = 64 } = {}) {
  const Lp = Math.floor(L / 2);
  return [
    { name: "input", shape: [B, 1, L] },
    { name: "conv · pool · conv", shape: [B, Cc, Lp] },
    { name: "permute(0, 2, 1)", shape: [B, Lp, Cc] },
    { name: "BiLSTM", shape: [B, Lp, 2 * H] },
    { name: "max over time", shape: [B, 2 * H] },
    { name: "Linear", shape: [B, 2] },
  ];
}
