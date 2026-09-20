/* Planning measurement for the sequence arc (PHM5005 07-1 "DL for Sequential
 * Data - Overview", 07-2 "Signals", 07-3 "Sequences").  Five candidate slots
 * were read out of the three notebooks, and each rests on a claim that has to
 * be a number before it is a widget:
 *
 *   M0 ARITHMETIC — what the lesson's own nets do to a length: 07-2's CNN1D on
 *     a 2 s fragment (360 Hz, so L = 720), 07-3's on 250 tokens, the receptive
 *     field of one output in samples and in milliseconds and in bases, the
 *     k-mer vocabulary, and the parameter counts the three architectures cost.
 *   M1 THE KERNEL IS A MOTIF — on one-hot DNA a Conv1d kernel [4, k] computes a
 *     position-weight-matrix score, so a kernel tuned to a motif fires where
 *     the motif is.  Does its argmax find a planted 7-mer, and does a random
 *     kernel?  And after TRAINING on motif presence, does a learned kernel's
 *     column-argmax spell the motif (the DeepBind reading)?
 *   M2 PADDING — 07-3 pads 200 bp to 250 and says global max is robust to PAD
 *     and an unpacked LSTM is not.  How far does a recurrence's state move over
 *     50 steps of zero input at torch's initialisation, for a tanh RNN and for
 *     an LSTM?  How much does mean pooling shrink?  And how much of the final
 *     state's sensitivity to x_1 survives at init — the memory bottleneck.
 *   M3 MEMORY AND POOLING — trained.  (a) recall the first token after T
 *     steps: tanh RNN against LSTM, T = 5 … 40.  (b) the notebook's table:
 *     "last states for endpoints, mean for the trend, max for a salient
 *     event" — three synthetic tasks × three poolings on one bidirectional
 *     RNN.  A pooling control is only offered if each arm wins somewhere.
 *   M4 OCCLUSION — trained 1D CNN on a synthetic two-class signal, then
 *     Captum's recipe by hand: |f(x) − f(x with window i set to the baseline)|
 *     at k = 32, stride 16.  Its resolution against the event's width, the
 *     baseline's effect, and the redundancy failure (two copies of the cue).
 *   M5 WINDOWS AND THE SPLIT — no training.  Eight subjects, overlapping
 *     windows, a 1-NN classifier by correlation: accuracy under a window-level
 *     split against a subject-level one, and per-window z-scoring against
 *     between-subject amplitude.
 *
 * Everything is hand-written in double precision: conv1d (k, stride, pad,
 * bias), ReLU, maxpool1d(2), global average and global max pooling, linear,
 * softmax cross-entropy, a tanh RNN and an LSTM with backprop through time,
 * bidirectional by running a second cell on the reversed sequence, Adam at
 * torch's defaults, torch's U(−1/√fan_in, +) init.  No torch on this machine,
 * so every backward pass is checked against central finite differences first.
 *
 * Run:  node widgets/_lab/dl-seq-measure.mjs   (106 s, node v24, this machine;
 * nothing in the repo imports this file)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-20.  Gradient checks first: max relative error 6.9e-7 over
 * fourteen engines (two CNNs; RNN and LSTM × last/mean/max × uni/bi), so the
 * arithmetic below is right.  Two seeds or three per trained cell, so read gaps
 * of five points and more.
 *
 * M0 — 07-2's fragments are 2 s at 360 Hz (PhysioNet's page; 1,015 of them,
 *   577 Dangerous / 438 OK), so L = 720 → 360 → 180 → 90; one Conv2 output
 *   sees 25 samples = 69 ms, most of a QRS, and neighbours sit 22 ms apart.
 *   07-3's 100,000 DNA sequences are ALL exactly 200 bp: MAX_LEN 250 pads every
 *   one by 50 and truncates none; the alphabet is ACGT only, so <UNK> is never
 *   used.  250 → 125 → 63 positions under the global max, 13 of them on PAD;
 *   the receptive field is 15 bases.  The BiLSTM(64→128) costs 199,554
 *   parameters against the DNA CNN's 10,226 (19.5×).  Integer IDs on one
 *   channel are monotone (w, 2w, 3w, 4w), so no linear filter fires on C alone.
 *
 * M1 — HOLDS.  A [4, 7] kernel of +1 on the motif base and −1/3 elsewhere is
 *   the PWM score exactly (7.00 at a perfect match, 0.00 ± 1.53 elsewhere); its
 *   argmax finds a planted TGACTCA in 99.0% of 500 sequences at 0 mismatches,
 *   86.2% at 1, 40.0% at 2; a random kernel in 0.0%.  The 1% it misses is a
 *   second copy occurring by chance (a 7-mer once per 16 kb).  TRAINED (M4b):
 *   conv(4→8, k7, bias=False) → ReLU → global max → linear, 400 sequences, 20
 *   epochs, 97.5% test; the two kernels with the largest class-1 weight spell
 *   TGACTCA 7/7 by column argmax.  The kernel IS the motif.
 *
 * M2 — HOLDS, and it is the padding page.  At init, after 200 real steps and
 *   50 zero steps: the tanh RNN's "last" state is 99–100% of its own norm away
 *   from the state after the real sequence; the LSTM's cell has decayed to
 *   0.29–0.35 of its norm (forget gate 0.50 on zero input) and its hidden
 *   state has moved 95–99%.  Mean pooling over 250 with 50 PAD rows scales
 *   every channel by 0.80.  Sensitivity of h_40 to x_t at init falls to 3.5e-5
 *   (RNN) and 7.1e-5 (LSTM) twenty steps back, 2e-9 / 2e-8 at t = 1.
 *
 * M3a — DOES NOT SEPARATE the cells, and the plan must not claim it does.
 *   Recall "was the first token A" after T steps, H = 16, 40 epochs: at T = 20
 *   the RNN is 100/100/100 and the LSTM 84.5/100/57.5; at T = 40 the RNN is
 *   100/98.5/49.5 and the LSTM 53/50/48; at T = 80 both are chance.  A trained
 *   state carries one early bit for tens of steps in either cell; "the LSTM
 *   remembers further" is not shown on this stage and is not the lesson's
 *   claim (49 already says the cells differ inside f).  The memory page shows
 *   the init decay and what training does to it, with one named cell.
 *
 * M3b — THE LESSON'S POOLING TABLE DOES NOT REPRODUCE AS A THREE-WAY CHOICE.
 *   Bidirectional tanh RNN, H = 16, T = 32, 600 train / 300 test:
 *       endpoints (first AND last purine)   last 100/100   mean 100/98.7   max 100/100
 *       trend (AT-rich at 40% vs 60%)       last 98.3/98   mean 96.7/98.3  max 97.3/95.7
 *       event (GATC anywhere)               last 48.3/53.3 mean 73.7/75.7  max 100/100
 *   Only max wins a row, and only on the localized event; last and mean never
 *   win.  So a Reduce control is not a choice with a claim per arm; it shows
 *   WHAT each reduction computes from [L, 2H] and the one task where it
 *   matters.  (The first endpoint task was "first == last", which no linear
 *   head can read off a concatenation; every pooling sat at chance — that is
 *   the task's fault, and it is why the stage says "first AND last purine".)
 *
 * M4 — HOLDS.  The lesson's net at half width on 240 synthetic 256-sample
 *   signals: 28 ms/epoch, 25 epochs, 100% test (the cue is one wide bump).
 *   Occlusion at the lesson's k = 32, stride 16, zero baseline: the peak lands
 *   on the cue in 97.5% of 40 signals, but the half-max width of the map is 61
 *   samples against the cue's 28 (24 at k = 16, 19 at k = 8) — the window is
 *   the resolution.  The baseline changes the map: correlation 0.48 between a
 *   zero baseline and a window-mean baseline, 0.89 with unit noise; the peak
 *   attribution is 0.086 / 0.011 / 0.144.  Redundancy: with TWO copies of the
 *   cue, occluding one drops p by 0.005 and both by 0.020 — each copy alone
 *   reads as unimportant.  Sign: 1.0% of occlusions raise p by > 0.01, so the
 *   absolute value hides little here; not a claim to draw.  DNA (M4b): with
 *   k = 8, stride 4, PAD's zero column as baseline, the top window overlaps the
 *   planted motif in 100% of 50 sequences.
 *
 * M5 — HOLDS.  Eight subjects × 24 windows of 256 at 50% overlap, class =
 *   irregular rhythm, morphology and rate the subject's own; 1-NN by
 *   correlation of the windows' log power spectra: window-level split 79.5%,
 *   subject-level 33.3% (below chance with six training subjects).  The first
 *   feature tried, raw correlation, gave 69.2% against 40.1%: overlap in
 *   SAMPLES is not similarity at zero lag, the leak is the subject's morphology.
 *   Per-subject RMS amplitude varies with CV 17% before per-window z-scoring
 *   and every window has sd 1 after.  A 60-sample event lies wholly in some
 *   window 100% of the time at stride 128; "any overlap" labels 2.37 windows
 *   with it, "more than half the event" 1.93.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const pct = (x) => (100 * x).toFixed(1) + "%";
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);

/* ------------------------------------------------------------------ tensors */
const zeros = (n) => new Float64Array(n);
function uniformInit(rng, n, bound) {
  const a = zeros(n);
  for (let i = 0; i < n; i++) a[i] = rng.uniform(-bound, bound);
  return a;
}
/** A parameter: value, gradient, and Adam's two moments. */
function param(rng, n, bound) {
  return { v: uniformInit(rng, n, bound), g: zeros(n), m: zeros(n), s: zeros(n) };
}
function adamStep(params, lr, t) {
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
  for (const p of params) {
    const { v, g, m, s } = p;
    for (let i = 0; i < v.length; i++) {
      m[i] = b1 * m[i] + (1 - b1) * g[i];
      s[i] = b2 * s[i] + (1 - b2) * g[i] * g[i];
      v[i] -= lr * (m[i] / c1) / (Math.sqrt(s[i] / c2) + eps);
      g[i] = 0;
    }
  }
}

/* ------------------------------------------------------------------- conv1d */
export const convOut = (L, k, s, p) => Math.floor((L + 2 * p - k) / s) + 1;

function Conv1d(rng, cin, cout, k, stride = 1, pad = 0, bias = true) {
  const bound = 1 / Math.sqrt(cin * k);
  const W = param(rng, cout * cin * k, bound);
  const b = bias ? param(rng, cout, bound) : null;
  const layer = {
    W, b, cin, cout, k, stride, pad,
    params: bias ? [W, b] : [W],
    /** x: {d: Float64Array cin*L, L} → {d: cout*Lout, L: Lout} */
    forward(x) {
      const L = x.L, Lo = convOut(L, k, stride, pad);
      const y = zeros(cout * Lo);
      for (let o = 0; o < cout; o++) {
        for (let t = 0; t < Lo; t++) {
          let acc = b ? b.v[o] : 0;
          const start = t * stride - pad;
          for (let c = 0; c < cin; c++) {
            const xo = c * L, wo = (o * cin + c) * k;
            for (let j = 0; j < k; j++) {
              const pos = start + j;
              if (pos >= 0 && pos < L) acc += x.d[xo + pos] * W.v[wo + j];
            }
          }
          y[o * Lo + t] = acc;
        }
      }
      layer.x = x;
      return { d: y, L: Lo };
    },
    backward(dy) {
      const x = layer.x, L = x.L, Lo = dy.L;
      const dx = zeros(cin * L);
      for (let o = 0; o < cout; o++) {
        for (let t = 0; t < Lo; t++) {
          const g = dy.d[o * Lo + t];
          if (g === 0) continue;
          if (b) b.g[o] += g;
          const start = t * stride - pad;
          for (let c = 0; c < cin; c++) {
            const xo = c * L, wo = (o * cin + c) * k;
            for (let j = 0; j < k; j++) {
              const pos = start + j;
              if (pos >= 0 && pos < L) {
                W.g[wo + j] += g * x.d[xo + pos];
                dx[xo + pos] += g * W.v[wo + j];
              }
            }
          }
        }
      }
      return { d: dx, L };
    },
  };
  return layer;
}

function ReLU() {
  const layer = {
    params: [],
    forward(x) {
      const y = zeros(x.d.length);
      for (let i = 0; i < y.length; i++) y[i] = x.d[i] > 0 ? x.d[i] : 0;
      layer.mask = y;
      return { d: y, L: x.L, C: x.C };
    },
    backward(dy) {
      const dx = zeros(dy.d.length);
      for (let i = 0; i < dx.length; i++) dx[i] = layer.mask[i] > 0 ? dy.d[i] : 0;
      return { d: dx, L: dy.L, C: dy.C };
    },
  };
  return layer;
}

function MaxPool1d(C, k = 2) {
  const layer = {
    params: [],
    forward(x) {
      const L = x.L, Lo = Math.floor(L / k);
      const y = zeros(C * Lo), arg = new Int32Array(C * Lo);
      for (let c = 0; c < C; c++) for (let t = 0; t < Lo; t++) {
        let best = -Infinity, bi = -1;
        for (let j = 0; j < k; j++) {
          const v = x.d[c * L + t * k + j];
          if (v > best) { best = v; bi = c * L + t * k + j; }
        }
        y[c * Lo + t] = best; arg[c * Lo + t] = bi;
      }
      layer.arg = arg; layer.L = L;
      return { d: y, L: Lo };
    },
    backward(dy) {
      const dx = zeros(C * layer.L);
      for (let i = 0; i < dy.d.length; i++) dx[layer.arg[i]] += dy.d[i];
      return { d: dx, L: layer.L };
    },
  };
  return layer;
}

/** Global pooling over the length: "avg" (AdaptiveAvgPool1d(1)) or "max". */
function GlobalPool(C, kind) {
  const layer = {
    params: [],
    forward(x) {
      const L = x.L, y = zeros(C), arg = new Int32Array(C);
      for (let c = 0; c < C; c++) {
        if (kind === "avg") {
          let s = 0; for (let t = 0; t < L; t++) s += x.d[c * L + t];
          y[c] = s / L;
        } else {
          let best = -Infinity, bi = -1;
          for (let t = 0; t < L; t++) if (x.d[c * L + t] > best) { best = x.d[c * L + t]; bi = t; }
          y[c] = best; arg[c] = bi;
        }
      }
      layer.L = L; layer.arg = arg;
      return { d: y, L: 1 };
    },
    backward(dy) {
      const L = layer.L, dx = zeros(C * L);
      for (let c = 0; c < C; c++) {
        if (kind === "avg") for (let t = 0; t < L; t++) dx[c * L + t] = dy.d[c] / L;
        else dx[c * L + layer.arg[c]] = dy.d[c];
      }
      return { d: dx, L };
    },
  };
  return layer;
}

function Linear(rng, nin, nout) {
  const bound = 1 / Math.sqrt(nin);
  const W = param(rng, nout * nin, bound), b = param(rng, nout, bound);
  const layer = {
    W, b, params: [W, b],
    forward(x) {
      const y = zeros(nout);
      for (let o = 0; o < nout; o++) {
        let acc = b.v[o];
        for (let i = 0; i < nin; i++) acc += W.v[o * nin + i] * x.d[i];
        y[o] = acc;
      }
      layer.x = x;
      return { d: y, L: 1 };
    },
    backward(dy) {
      const dx = zeros(nin);
      for (let o = 0; o < nout; o++) {
        const g = dy.d[o]; b.g[o] += g;
        for (let i = 0; i < nin; i++) { W.g[o * nin + i] += g * layer.x.d[i]; dx[i] += g * W.v[o * nin + i]; }
      }
      return { d: dx, L: 1 };
    },
  };
  return layer;
}

/** softmax cross-entropy on logits; returns loss and the gradient on logits */
function softmaxCE(logits, y) {
  const m = Math.max(...logits);
  const e = logits.map((z) => Math.exp(z - m));
  const Z = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / Z);
  const g = zeros(p.length);
  for (let i = 0; i < p.length; i++) g[i] = p[i] - (i === y ? 1 : 0);
  return { loss: -Math.log(p[y] + 1e-300), g, p };
}

function Sequential(layers) {
  return {
    layers,
    params: layers.flatMap((l) => l.params),
    forward(x) { for (const l of layers) x = l.forward(x); return x; },
    backward(dy) { for (let i = layers.length - 1; i >= 0; i--) dy = layers[i].backward(dy); return dy; },
  };
}

/* ------------------------------------------------------------ recurrences */
/** tanh RNN cell over a whole sequence.  X: array of T Float64Array(D). */
function RNN(rng, D, H) {
  const bound = 1 / Math.sqrt(H);
  const Wx = param(rng, H * D, bound), Wh = param(rng, H * H, bound), b = param(rng, H, bound);
  const cell = {
    D, H, params: [Wx, Wh, b],
    forward(X, h0 = zeros(H)) {
      const T = X.length, Hs = new Array(T);
      let h = h0;
      for (let t = 0; t < T; t++) {
        const nh = zeros(H);
        for (let j = 0; j < H; j++) {
          let a = b.v[j];
          for (let i = 0; i < D; i++) a += Wx.v[j * D + i] * X[t][i];
          for (let i = 0; i < H; i++) a += Wh.v[j * H + i] * h[i];
          nh[j] = Math.tanh(a);
        }
        Hs[t] = nh; h = nh;
      }
      cell.X = X; cell.Hs = Hs; cell.h0 = h0;
      return Hs;
    },
    /** dHs: array of T Float64Array(H) or null entries; returns dX */
    backward(dHs) {
      const { X, Hs, h0 } = cell, T = X.length;
      const dX = X.map(() => zeros(D));
      let dnext = zeros(H);
      for (let t = T - 1; t >= 0; t--) {
        const h = Hs[t], hp = t > 0 ? Hs[t - 1] : h0;
        const da = zeros(H);
        for (let j = 0; j < H; j++) {
          const g = (dHs[t] ? dHs[t][j] : 0) + dnext[j];
          da[j] = g * (1 - h[j] * h[j]);
        }
        const dprev = zeros(H);
        for (let j = 0; j < H; j++) {
          const g = da[j]; if (g === 0) continue;
          b.g[j] += g;
          for (let i = 0; i < D; i++) { Wx.g[j * D + i] += g * X[t][i]; dX[t][i] += g * Wx.v[j * D + i]; }
          for (let i = 0; i < H; i++) { Wh.g[j * H + i] += g * hp[i]; dprev[i] += g * Wh.v[j * H + i]; }
        }
        dnext = dprev;
      }
      return dX;
    },
  };
  return cell;
}

const sig = (x) => 1 / (1 + Math.exp(-x));

/** LSTM cell, torch's gate order i f g o, one bias (b_ih + b_hh drawn as two). */
function LSTM(rng, D, H) {
  const bound = 1 / Math.sqrt(H);
  const W = param(rng, 4 * H * D, bound), U = param(rng, 4 * H * H, bound);
  const b = param(rng, 4 * H, bound);
  for (let i = 0; i < 4 * H; i++) b.v[i] += rng.uniform(-bound, bound); // b_ih + b_hh
  const cell = {
    D, H, params: [W, U, b],
    forward(X, h0 = zeros(H), c0 = zeros(H)) {
      const T = X.length, Hs = new Array(T), Cs = new Array(T), Gs = new Array(T);
      let h = h0, c = c0;
      for (let t = 0; t < T; t++) {
        const gates = zeros(4 * H);
        for (let j = 0; j < 4 * H; j++) {
          let a = b.v[j];
          for (let i = 0; i < D; i++) a += W.v[j * D + i] * X[t][i];
          for (let i = 0; i < H; i++) a += U.v[j * H + i] * h[i];
          gates[j] = a;
        }
        const nc = zeros(H), nh = zeros(H);
        for (let j = 0; j < H; j++) {
          const ig = sig(gates[j]), fg = sig(gates[H + j]), gg = Math.tanh(gates[2 * H + j]), og = sig(gates[3 * H + j]);
          gates[j] = ig; gates[H + j] = fg; gates[2 * H + j] = gg; gates[3 * H + j] = og;
          nc[j] = fg * c[j] + ig * gg;
          nh[j] = og * Math.tanh(nc[j]);
        }
        Hs[t] = nh; Cs[t] = nc; Gs[t] = gates; h = nh; c = nc;
      }
      Object.assign(cell, { X, Hs, Cs, Gs, h0, c0 });
      return Hs;
    },
    backward(dHs) {
      const { X, Hs, Cs, Gs, h0, c0 } = cell, T = X.length;
      const dX = X.map(() => zeros(D));
      let dh_next = zeros(H), dc_next = zeros(H);
      for (let t = T - 1; t >= 0; t--) {
        const g = Gs[t], c = Cs[t], cp = t > 0 ? Cs[t - 1] : c0, hp = t > 0 ? Hs[t - 1] : h0;
        const da = zeros(4 * H), dc = zeros(H);
        for (let j = 0; j < H; j++) {
          const dh = (dHs[t] ? dHs[t][j] : 0) + dh_next[j];
          const ig = g[j], fg = g[H + j], gg = g[2 * H + j], og = g[3 * H + j];
          const tc = Math.tanh(c[j]);
          dc[j] = dh * og * (1 - tc * tc) + dc_next[j];
          da[3 * H + j] = dh * tc * og * (1 - og);
          da[j] = dc[j] * gg * ig * (1 - ig);
          da[H + j] = dc[j] * cp[j] * fg * (1 - fg);
          da[2 * H + j] = dc[j] * ig * (1 - gg * gg);
        }
        const dprev = zeros(H);
        for (let j = 0; j < 4 * H; j++) {
          const gj = da[j]; if (gj === 0) continue;
          b.g[j] += gj;
          for (let i = 0; i < D; i++) { W.g[j * D + i] += gj * X[t][i]; dX[t][i] += gj * W.v[j * D + i]; }
          for (let i = 0; i < H; i++) { U.g[j * H + i] += gj * hp[i]; dprev[i] += gj * U.v[j * H + i]; }
        }
        dh_next = dprev;
        for (let j = 0; j < H; j++) dc_next[j] = dc[j] * g[H + j];
      }
      return dX;
    },
  };
  return cell;
}

/** A sequence classifier: (bi)directional cell → pooling → linear. */
function SeqClassifier(rng, { cellKind, D, H, bidirectional, pool, classes }) {
  const mk = () => (cellKind === "lstm" ? LSTM(rng, D, H) : RNN(rng, D, H));
  const fwd = mk(), bwd = bidirectional ? mk() : null;
  const F = bidirectional ? 2 * H : H;
  const head = Linear(rng, F, classes);
  const params = [...fwd.params, ...(bwd ? bwd.params : []), ...head.params];
  const model = {
    params,
    forward(X) {
      const T = X.length;
      const Hf = fwd.forward(X);
      const Hb = bwd ? bwd.forward([...X].reverse()) : null; // Hb[i] is the state after reading X[T-1-i]
      // features per step, in sequence order
      const feats = new Array(T);
      for (let t = 0; t < T; t++) {
        const v = zeros(F);
        for (let j = 0; j < H; j++) v[j] = Hf[t][j];
        if (bwd) for (let j = 0; j < H; j++) v[H + j] = Hb[T - 1 - t][j];
        feats[t] = v;
      }
      const z = zeros(F), arg = new Int32Array(F);
      if (pool === "last") {
        for (let j = 0; j < H; j++) z[j] = Hf[T - 1][j];
        if (bwd) for (let j = 0; j < H; j++) z[H + j] = Hb[T - 1][j]; // the reverse pass's LAST state, at position 0
      } else if (pool === "mean") {
        for (let t = 0; t < T; t++) for (let j = 0; j < F; j++) z[j] += feats[t][j] / T;
      } else {
        for (let j = 0; j < F; j++) { let best = -Infinity; for (let t = 0; t < T; t++) if (feats[t][j] > best) { best = feats[t][j]; arg[j] = t; } z[j] = best; }
      }
      Object.assign(model, { T, arg });
      return head.forward({ d: z, L: 1 }).d;
    },
    backward(dlogits) {
      const { T, arg } = model;
      const dz = head.backward({ d: dlogits, L: 1 }).d;
      const dHf = new Array(T).fill(null), dHb = bwd ? new Array(T).fill(null) : null;
      const put = (t, j, g) => {
        if (j < H) { (dHf[t] ??= zeros(H))[j] += g; }
        else { (dHb[T - 1 - t] ??= zeros(H))[j - H] += g; }
      };
      if (pool === "last") {
        for (let j = 0; j < H; j++) put(T - 1, j, dz[j]);
        if (bwd) for (let j = 0; j < H; j++) put(0, H + j, dz[H + j]);
      } else if (pool === "mean") {
        for (let t = 0; t < T; t++) for (let j = 0; j < F; j++) put(t, j, dz[j] / T);
      } else {
        for (let j = 0; j < F; j++) put(arg[j], j, dz[j]);
      }
      fwd.backward(dHf);
      if (bwd) bwd.backward(dHb);
    },
  };
  return model;
}

/* --------------------------------------------------------- gradient check */
function gradCheck(name, params, lossFn) {
  // analytic
  for (const p of params) p.g.fill(0);
  lossFn(true);
  let worst = 0, n = 0;
  const rng = makeRng(7);
  for (const p of params) {
    const idx = new Set();
    while (idx.size < Math.min(4, p.v.length)) idx.add(Math.floor(rng.next() * p.v.length));
    for (const i of idx) {
      const old = p.v[i], e = 1e-5;
      p.v[i] = old + e; const lp = lossFn(false);
      p.v[i] = old - e; const lm = lossFn(false);
      p.v[i] = old;
      const num = (lp - lm) / (2 * e), an = p.g[i];
      const rel = Math.abs(num - an) / Math.max(1e-8, Math.abs(num) + Math.abs(an));
      worst = Math.max(worst, rel); n++;
    }
    p.g.fill(0);
  }
  console.log(`gradient check ${name}: ${n} entries, max relative error ${worst.toExponential(2)}`);
  if (worst > 1e-5) throw new Error(`gradient check failed: ${name}`);
}

/* ================================================================== M0 */
head("M0 · arithmetic: what the lesson's own nets do to a length");
{
  const FS = 360, L = 2 * FS;
  console.log(`07-2 fragments: 2 s at ${FS} Hz (PhysioNet's record page) → L = ${L}; 1,015 fragments, 577 Dangerous (classes 1–3) / 438 OK (4–6)`);
  const chain = [];
  let l = L, r = 1, j = 1;
  let unit = (r) => `${String(r).padStart(3)} samples = ${f(1000 * r / FS, 0)} ms`;
  const step = (name, k, s) => { l = convOut(l, k, s, name.includes("Conv1") ? 3 : name.includes("Conv2") ? 2 : 0); r = r + (k - 1) * j; j *= s; chain.push(`${name.padEnd(22)} L=${String(l).padStart(4)}  receptive field ${unit(r)}  (jump ${j})`); };
  step("Conv1 k7 s2 p3", 7, 2); step("MaxPool1d(2)", 2, 2); step("Conv2 k5 s2 p2", 5, 2);
  console.log(chain.join("\n"));
  console.log(`AdaptiveAvgPool1d(1) averages the ${l} positions; the QRS complex is 80–100 ms, so one Conv2 output covers most of one QRS and neighbouring outputs sit ${f(1000 * 8 / FS, 0)} ms apart`);
  console.log(`07-1's "k=50 → 100 ms" is at 500 Hz; at ${FS} Hz, 100 ms is ${Math.round(0.1 * FS)} samples, and 07-2's "10–30 samples at 250 Hz" is 40–120 ms`);

  l = 250; r = 1; j = 1; chain.length = 0; unit = (r) => `${String(r).padStart(3)} bases`;
  step("Conv1 k7 s2 p3", 7, 2); step("Conv2 k5 s2 p2", 5, 2);
  console.log(`\n07-3 DNA: every one of the 100,000 lesson sequences is exactly 200 bp (measured from the CSV); MAX_LEN = 250 pads each by 50 (20% PAD) and truncates none; the alphabet is A C G T only, so <UNK> never occurs`);
  console.log(chain.join("\n"));
  console.log(`AdaptiveMaxPool1d(1) over ${l} positions, of which ${convOut(convOut(50, 7, 2, 3), 5, 2, 2)} sit wholly or partly on PAD; TF binding sites are 6–12 bp, so k=7 spans one`);
  console.log(`07-3's CNN+LSTM keeps stride 1 and no pooling, so the LSTM runs 250 steps; 07-2's CNN+LSTM (cell 67) pools once: 720 → 360 steps of 64 features`);

  console.log(`\nk-mer vocabulary 4^k:  ${[1, 2, 3, 4, 5, 6, 8].map((k) => `k=${k}: ${Math.pow(4, k).toLocaleString()}`).join("  ")};  proteins 20^k: ${[1, 2, 3, 4].map((k) => `k=${k}: ${Math.pow(20, k).toLocaleString()}`).join("  ")}`);
  console.log(`a 200 bp sequence holds 200 − k + 1 overlapping k-mers: ${[3, 6].map((k) => `k=${k}: ${200 - k + 1}`).join(", ")}`);

  const conv = (ci, co, k, bias = true) => ci * co * k + (bias ? co : 0);
  const lin = (i, o) => i * o + o;
  const lstm = (D, H, bi) => (bi ? 2 : 1) * 4 * (D * H + H * H + 2 * H);
  console.log(`\nparameters — 07-2 CNN1D: ${(conv(1, 16, 7) + conv(16, 32, 5) + lin(32, 2)).toLocaleString()};  BiLSTM(1→64) + Linear(128,2): ${(lstm(1, 64, true) + lin(128, 2)).toLocaleString()};  CNN_LSTM (cell 67: conv 1→32→64, LSTM 64→64 bi): ${(conv(1, 32, 7) + conv(32, 64, 5) + lstm(64, 64, true) + lin(128, 2)).toLocaleString()}`);
  console.log(`parameters — 07-3 DNA CNN1D: Embedding(6,64) ${6 * 64} + ${conv(64, 16, 7)} + ${conv(16, 32, 5)} + ${lin(32, 2)} = ${(384 + conv(64, 16, 7) + conv(16, 32, 5) + lin(32, 2)).toLocaleString()};  BiLSTM(64→128): ${(384 + lstm(64, 128, true) + lin(256, 2)).toLocaleString()};  ratio ${f((384 + lstm(64, 128, true) + lin(256, 2)) / (384 + conv(64, 16, 7) + conv(16, 32, 5) + lin(32, 2)), 1)}×`);
  console.log(`one-hot against integer IDs: with A C G T = 1 2 3 4 on ONE channel, a length-1 filter w gives w, 2w, 3w, 4w — monotone, so no linear filter can fire on C alone; on four channels a filter is a column of four free weights`);
}

/* ================================================================== M1 */
head("M1 · the kernel is a motif: a Conv1d over one-hot DNA is a PWM score");
const BASES = "ACGT";
function oneHot(seq) {
  const L = seq.length, d = zeros(4 * L);
  for (let t = 0; t < L; t++) d[BASES.indexOf(seq[t]) * L + t] = 1;
  return { d, L };
}
function randomSeq(rng, L) { let s = ""; for (let i = 0; i < L; i++) s += BASES[Math.floor(rng.next() * 4)]; return s; }
function plant(rng, L, motif, mismatches = 0) {
  const s = randomSeq(rng, L).split(""), pos = Math.floor(rng.next() * (L - motif.length + 1));
  let m = motif.split("");
  for (let i = 0; i < mismatches; i++) { const j = Math.floor(rng.next() * m.length); m[j] = BASES[(BASES.indexOf(m[j]) + 1 + Math.floor(rng.next() * 3)) % 4]; }
  for (let i = 0; i < m.length; i++) s[pos + i] = m[i];
  return { seq: s.join(""), pos };
}
{
  const rng = makeRng(11), MOTIF = "TGACTCA", k = MOTIF.length, L = 200, N = 500;
  // a tuned kernel: +1 on the motif's base, −1/3 elsewhere (each column sums to zero)
  const tuned = Conv1d(rng, 4, 1, k, 1, 0, false);
  for (let c = 0; c < 4; c++) for (let j = 0; j < k; j++) tuned.W.v[c * k + j] = BASES[c] === MOTIF[j] ? 1 : -1 / 3;
  const random = Conv1d(makeRng(5), 4, 1, k, 1, 0, false);
  const hit = { tuned: [0, 0, 0], random: [0, 0, 0] };
  const scores = { at: [], elsewhere: [] };
  for (const mm of [0, 1, 2]) for (let n = 0; n < N; n++) {
    const { seq, pos } = plant(rng, L, MOTIF, mm);
    const x = oneHot(seq);
    for (const [name, ker] of [["tuned", tuned], ["random", random]]) {
      const y = ker.forward(x).d;
      let bi = 0; for (let t = 1; t < y.length; t++) if (y[t] > y[bi]) bi = t;
      if (bi === pos) hit[name][mm]++;
      if (name === "tuned" && mm === 0) { scores.at.push(y[pos]); for (let t = 0; t < y.length; t++) if (Math.abs(t - pos) > k) scores.elsewhere.push(y[t]); }
    }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`motif ${MOTIF} planted once in ${N} random ${L}-bp sequences; kernel [4, ${k}] = +1 on the motif base, −1/3 on the other three`);
  console.log(`argmax of the feature map lands on the planted position: tuned kernel ${[0, 1, 2].map((mm) => `${mm} mismatch ${pct(hit.tuned[mm] / N)}`).join(", ")};  random kernel (torch init) ${[0, 1, 2].map((mm) => `${pct(hit.random[mm] / N)}`).join(", ")}  (chance 1/${L - k + 1} = ${pct(1 / (L - k + 1))})`);
  console.log(`tuned kernel's score at the motif ${f(mean(scores.at), 2)} (exactly k − 0 = ${k} on a perfect match) against ${f(mean(scores.elsewhere), 2)} ± ${f(Math.sqrt(mean(scores.elsewhere.map((v) => (v - mean(scores.elsewhere)) ** 2))), 2)} elsewhere; the max elsewhere over all ${scores.elsewhere.length} positions is ${f(Math.max(...scores.elsewhere), 2)}`);
  console.log(`so on one-hot input the convolution IS the PWM score Σ_j W[base_j, j], and a kernel is a detector for exactly one motif of length k — the reading 07-1 cell 2 gives it`);
}

/* =========================================================== gradient checks */
head("gradient checks — the engines, before anything is measured");
{
  const rng = makeRng(3);
  // CNN: conv(2→3,k3,s2,p1) relu pool conv(3→2,k3,s1,p1) relu gap linear(2→3)
  const net = Sequential([Conv1d(rng, 2, 3, 3, 2, 1), ReLU(), MaxPool1d(3, 2), Conv1d(rng, 3, 2, 3, 1, 1), ReLU(), GlobalPool(2, "avg"), Linear(rng, 2, 3)]);
  const x = { d: uniformInit(rng, 2 * 12, 1), L: 12 };
  gradCheck("1D CNN (avg pool)", net.params, (back) => { const out = net.forward(x); const { loss, g } = softmaxCE(Array.from(out.d), 1); if (back) net.backward({ d: g, L: 1 }); return loss; });
  const net2 = Sequential([Conv1d(rng, 4, 3, 5, 1, 2, false), ReLU(), GlobalPool(3, "max"), Linear(rng, 3, 2)]);
  const x2 = oneHot(randomSeq(rng, 16));
  gradCheck("1D CNN (global max, no bias)", net2.params, (back) => { const out = net2.forward(x2); const { loss, g } = softmaxCE(Array.from(out.d), 0); if (back) net2.backward({ d: g, L: 1 }); return loss; });
  const X = Array.from({ length: 6 }, () => uniformInit(rng, 3, 1));
  for (const cellKind of ["rnn", "lstm"]) for (const pool of ["last", "mean", "max"]) for (const bidirectional of [false, true]) {
    const m = SeqClassifier(rng, { cellKind, D: 3, H: 4, bidirectional, pool, classes: 2 });
    gradCheck(`${cellKind}${bidirectional ? " bi" : ""} ${pool}`, m.params, (back) => { const z = m.forward(X); const { loss, g } = softmaxCE(Array.from(z), 1); if (back) m.backward(g); return loss; });
  }
}

/* ================================================================== M2 */
head("M2 · padding: what 50 zero steps do to a recurrence's state, at torch's init");
{
  const norm = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const D = 64, H = 128, REAL = 200, PAD = 50;
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(seed);
    const X = Array.from({ length: REAL + PAD }, (_, t) => (t < REAL ? uniformInit(rng, D, Math.sqrt(3)) : zeros(D))); // Embedding init N(0,1) ≈ U(±√3); PAD row is zero
    const rnn = RNN(rng, D, H), lstm = LSTM(rng, D, H);
    const Hr = rnn.forward(X), Hl = lstm.forward(X);
    const cl = lstm.Cs;
    const fg = lstm.Gs[REAL + PAD - 1].slice(H, 2 * H);
    console.log(`seed ${seed}  tanh RNN: ‖h_${REAL + PAD} − h_${REAL}‖ / ‖h_${REAL}‖ = ${f(dist(Hr[REAL + PAD - 1], Hr[REAL - 1]) / norm(Hr[REAL - 1]), 2)} — the state at "last" is ${f(dist(Hr[REAL + PAD - 1], Hr[REAL - 1]) / norm(Hr[REAL - 1]) * 100, 0)}% away from the state after the real sequence`);
    console.log(`         LSTM: ‖c_${REAL + PAD}‖ / ‖c_${REAL}‖ = ${f(norm(cl[REAL + PAD - 1]) / norm(cl[REAL - 1]), 3)}, ‖h_${REAL + PAD} − h_${REAL}‖ / ‖h_${REAL}‖ = ${f(dist(Hl[REAL + PAD - 1], Hl[REAL - 1]) / norm(Hl[REAL - 1]), 2)}; mean forget gate on zero input ${f(fg.reduce((a, b) => a + b, 0) / H, 2)}`);
  }
  console.log(`(pack_padded_sequence stops at step ${REAL}; without it, "the last hidden state" is the state after ${PAD} steps of PAD, and at init an LSTM's cell has decayed by ~0.5 per step)`);

  // mean pooling under padding: the zero-embedding rows shrink the mean by REAL/L, max pooling is untouched unless a channel's real max is negative
  console.log(`mean pooling over [L=250, C] with 50 PAD rows of near-zero features scales every channel by ${REAL}/${REAL + PAD} = ${f(REAL / (REAL + PAD), 2)} — on ONE sequence; with lengths that vary, the shrink varies per row`);

  // memory bottleneck at init: sensitivity of h_T to a perturbation of x_t, by finite difference
  console.log(`\nsensitivity ‖∂h_T/∂x_t‖ at init (finite difference, T = 40, D = 4 one-hot, H = 64), relative to t = T:`);
  for (const cellKind of ["rnn", "lstm"]) {
    const rng = makeRng(9);
    const cell = cellKind === "rnn" ? RNN(rng, 4, 64) : LSTM(rng, 4, 64);
    const T = 40, X = Array.from({ length: T }, () => { const v = zeros(4); v[Math.floor(rng.next() * 4)] = 1; return v; });
    const base = cell.forward(X)[T - 1].slice();
    const sens = (t) => { const X2 = X.map((v) => v.slice()); X2[t][0] += 1e-4; X2[t][1] -= 1e-4; const h = cell.forward(X2)[T - 1]; return dist(h, base) / 1e-4; };
    const ref = sens(T - 1);
    console.log(`  ${cellKind.padEnd(4)} ${[T - 1, T - 3, T - 6, T - 11, T - 21, 0].map((t) => `t=${t + 1}: ${(sens(t) / ref).toExponential(1)}`).join("  ")}`);
  }
  console.log(`(both forget at init — the RNN geometrically at W_h's spectral radius, the LSTM through a half-open forget gate; whether TRAINING lets either keep a distant input is M3a)`);
}

/* ============================================================ training */
function trainSeq(rng, model, data, { epochs, batch = 16, lr = 1e-2 }) {
  let step = 0;
  const idx = data.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (let b0 = 0; b0 < idx.length; b0 += batch) {
      for (let i = b0; i < Math.min(idx.length, b0 + batch); i++) {
        const { X, y } = data[idx[i]];
        const z = model.forward(X);
        const { g } = softmaxCE(Array.from(z), y);
        for (let q = 0; q < g.length; q++) g[q] /= batch;
        model.backward(g);
      }
      adamStep(model.params, lr, ++step);
    }
  }
}
function accuracy(model, data) {
  let ok = 0;
  for (const { X, y } of data) { const z = model.forward(X); ok += (z[1] > z[0] ? 1 : 0) === y ? 1 : 0; }
  return ok / data.length;
}
const tokOneHot = (s) => s.split("").map((ch) => { const v = zeros(4); v[BASES.indexOf(ch)] = 1; return v; });

/* ================================================================== M3 */
head("M3a · memory, trained: recall whether the FIRST token was A, after T steps (tanh RNN against LSTM, H = 16)");
{
  const rows = [];
  for (const T of [10, 20, 40, 80]) {
    const line = [`T=${String(T).padStart(2)}`];
    for (const cellKind of ["rnn", "lstm"]) {
      const accs = [];
      for (const seed of [1, 2, 3]) {
        const rng = makeRng(100 * T + seed);
        const mk = (n) => Array.from({ length: n }, () => { const s = randomSeq(rng, T); return { X: tokOneHot(s), y: s[0] === "A" ? 1 : 0 }; });
        // balance the classes: half the sequences start with A
        const mkBal = (n) => mk(n).map((d, i) => { if (i % 2 === 0) { d.X[0].fill(0); d.X[0][0] = 1; d.y = 1; } else if (d.y === 1) { d.X[0].fill(0); d.X[0][1 + Math.floor(rng.next() * 3)] = 1; d.y = 0; } return d; });
        const train = mkBal(400), test = mkBal(200);
        const model = SeqClassifier(rng, { cellKind, D: 4, H: 16, bidirectional: false, pool: "last", classes: 2 });
        trainSeq(rng, model, train, { epochs: 40, lr: 3e-3 });
        accs.push(accuracy(model, test));
      }
      line.push(`${cellKind.padEnd(4)} ${accs.map(pct).join(" / ")}`);
    }
    rows.push(line.join("   "));
    console.log(rows[rows.length - 1] + `   [${secs()} s]`);
  }
  console.log(`(forward-only, "last" pooling, 400 train / 200 test, 40 epochs, Adam 3e-3, three seeds; chance is 50%)`);
}

head("M3b · pooling, trained: the notebook's table on one bidirectional tanh RNN (H = 16, T = 32)");
{
  const T = 32;
  const PUR = (c) => c === "A" || c === "G";
  const tasks = {
    endpoints: { desc: "label = the first AND the last base are purines (A/G)", make: (rng) => { const s = randomSeq(rng, T).split(""); const both = rng.next() < 0.5; if (both) { s[0] = rng.next() < 0.5 ? "A" : "G"; s[T - 1] = rng.next() < 0.5 ? "A" : "G"; } else { if (rng.next() < 0.5) s[0] = rng.next() < 0.5 ? "C" : "T"; else s[T - 1] = rng.next() < 0.5 ? "C" : "T"; } return { X: tokOneHot(s.join("")), y: PUR(s[0]) && PUR(s[T - 1]) ? 1 : 0 }; } },
    trend: { desc: "label = more than half the bases are A or T, drawn at 40% or 60% AT (composition)", make: (rng) => { const p = rng.next() < 0.5 ? 0.4 : 0.6; let s = ""; for (let i = 0; i < T; i++) s += rng.next() < p ? (rng.next() < 0.5 ? "A" : "T") : (rng.next() < 0.5 ? "C" : "G"); const at = s.split("").filter((c) => c === "A" || c === "T").length; return { X: tokOneHot(s), y: at > T / 2 ? 1 : 0 }; } },
    event: { desc: "label = the 4-mer GATC occurs somewhere", make: (rng) => { let s = randomSeq(rng, T); while (s.includes("GATC")) s = randomSeq(rng, T); const has = rng.next() < 0.5; if (has) { const pos = Math.floor(rng.next() * (T - 3)); s = s.slice(0, pos) + "GATC" + s.slice(pos + 4); } return { X: tokOneHot(s), y: has ? 1 : 0 }; } },
  };
  console.log(`task            ${["last", "mean", "max"].map((p) => p.padEnd(15)).join("")}   (test accuracy, two seeds)`);
  for (const [name, task] of Object.entries(tasks)) {
    const cells = [];
    for (const pool of ["last", "mean", "max"]) {
      const accs = [];
      for (const seed of [1, 2]) {
        const rng = makeRng(seed * 31 + pool.length);
        const train = Array.from({ length: 600 }, () => task.make(rng)), test = Array.from({ length: 300 }, () => task.make(rng));
        const model = SeqClassifier(rng, { cellKind: "rnn", D: 4, H: 16, bidirectional: true, pool, classes: 2 });
        trainSeq(rng, model, train, { epochs: 30, lr: 3e-3 });
        accs.push(accuracy(model, test));
      }
      cells.push(accs.map(pct).join("/").padEnd(15));
    }
    console.log(`${name.padEnd(15)} ${cells.join("")}   ${task.desc}   [${secs()} s]`);
  }
  console.log(`(a pooling control goes in only if each column wins a row; read gaps of 5+ points only)`);
}

/* ================================================================== M4 */
head("M4 · occlusion on a trained 1D CNN (synthetic two-class signal, L = 256)");
/** class 0: narrow regular spikes; class 1: the same rhythm plus ONE wide bump (the cue), width ~24 samples */
function makeSignal(rng, L, cls, { copies = 1 } = {}) {
  const x = zeros(L);
  const period = 40 + Math.floor(rng.next() * 16), phase = Math.floor(rng.next() * period);
  for (let t = phase; t < L; t += period) { const a = 0.8 + 0.4 * rng.next(); for (let d = -2; d <= 2; d++) if (t + d >= 0 && t + d < L) x[t + d] += a * (1 - Math.abs(d) / 3); }
  const cues = [];
  if (cls === 1) for (let c = 0; c < copies; c++) {
    const centre = 30 + Math.floor(rng.next() * (L - 60)), w = 12;
    for (let t = centre - 2 * w; t <= centre + 2 * w; t++) if (t >= 0 && t < L) x[t] += 0.7 * Math.exp(-((t - centre) ** 2) / (2 * w * w));
    cues.push(centre);
  }
  for (let t = 0; t < L; t++) x[t] += rng.normal(0, 0.08);
  // per-window z-score, as the lesson's `normalize`
  const mu = x.reduce((a, b) => a + b, 0) / L, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / L);
  for (let t = 0; t < L; t++) x[t] = (x[t] - mu) / sd;
  return { X: { d: x, L }, y: cls, cues };
}
function trainCNN(rng, net, data, { epochs, batch = 16, lr = 1e-3 }) {
  let step = 0; const idx = data.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (let b0 = 0; b0 < idx.length; b0 += batch) {
      for (let i = b0; i < Math.min(idx.length, b0 + batch); i++) {
        const { X, y } = data[idx[i]];
        const out = net.forward(X); const { g } = softmaxCE(Array.from(out.d), y);
        for (let q = 0; q < g.length; q++) g[q] /= batch;
        net.backward({ d: g, L: 1 });
      }
      adamStep(net.params, lr, ++step);
    }
  }
}
const probOf = (net, X, cls) => { const out = net.forward(X); return softmaxCE(Array.from(out.d), 0).p[cls]; };
function occlude(net, X, cls, k, stride, baselineFn) {
  const L = X.L, base = probOf(net, X, cls), attr = zeros(L), count = zeros(L);
  for (let s = 0; s + k <= L; s += stride) {
    const d = X.d.slice();
    for (let t = s; t < s + k; t++) d[t] = baselineFn(X.d, s, k, t);
    const a = Math.abs(base - probOf(net, { d, L }, cls));
    for (let t = s; t < s + k; t++) { attr[t] += a; count[t]++; }
  }
  for (let t = 0; t < L; t++) attr[t] /= Math.max(1, count[t]); // Captum averages overlapping windows
  return { attr, base };
}
{
  const rng = makeRng(21), L = 256;
  const train = Array.from({ length: 240 }, (_, i) => makeSignal(rng, L, i % 2)), test = Array.from({ length: 120 }, (_, i) => makeSignal(rng, L, i % 2));
  const net = Sequential([Conv1d(rng, 1, 8, 7, 2, 3), ReLU(), MaxPool1d(8, 2), Conv1d(rng, 8, 16, 5, 2, 2), ReLU(), GlobalPool(16, "avg"), Linear(rng, 16, 2)]);
  const tStart = Date.now();
  trainCNN(rng, net, train, { epochs: 25 });
  const ms = (Date.now() - tStart) / 25;
  const acc = (data) => data.filter(({ X, y }) => { const o = net.forward(X).d; return (o[1] > o[0] ? 1 : 0) === y; }).length / data.length;
  console.log(`net conv(1→8,k7,s2,p3) ReLU pool conv(8→16,k5,s2,p2) ReLU GAP linear(16→2) — the lesson's shape at half width; 240 train, 25 epochs: ${f(ms, 0)} ms/epoch, train ${pct(acc(train))}, test ${pct(acc(test))}   [${secs()} s]`);

  // resolution: attribution mass on the cue against its width, at the lesson's k=32 s=16 and at finer settings
  const zero = () => 0;
  const pos = test.filter((d) => d.y === 1).slice(0, 40);
  for (const [k, s] of [[32, 16], [16, 8], [8, 4]]) {
    let onCue = 0, widthAt = 0, peakHit = 0;
    for (const d of pos) {
      const { attr } = occlude(net, d.X, 1, k, s, zero);
      const c = d.cues[0], total = attr.reduce((a, b) => a + b, 0);
      let inside = 0; for (let t = Math.max(0, c - 24); t <= Math.min(L - 1, c + 24); t++) inside += attr[t];
      onCue += inside / total;
      const mx = Math.max(...attr); let above = 0, pk = 0; for (let t = 0; t < L; t++) { if (attr[t] > mx / 2) above++; if (attr[t] === mx) pk = t; }
      widthAt += above; peakHit += Math.abs(pk - c) <= 24 ? 1 : 0;
    }
    console.log(`k=${String(k).padStart(2)} stride=${String(s).padStart(2)}: peak within the cue's ±24 in ${pct(peakHit / pos.length)} of ${pos.length} class-1 signals; share of attribution mass on the cue ${pct(onCue / pos.length)}; half-max width ${f(widthAt / pos.length, 0)} samples (the cue's is ~28, the spikes' 5)`);
  }
  // baseline: zero against the window's mean against a flat line at the signal's own mean (=0 after z-score), and against noise
  {
    const d = pos[0];
    const a0 = occlude(net, d.X, 1, 32, 16, zero).attr;
    const aMean = occlude(net, d.X, 1, 32, 16, (x, s, k) => { let m = 0; for (let t = s; t < s + k; t++) m += x[t]; return m / k; }).attr;
    const rngN = makeRng(4);
    const aNoise = occlude(net, d.X, 1, 32, 16, () => rngN.normal(0, 1)).attr;
    const corr = (a, b) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
    console.log(`baseline on one signal (k=32, s=16): correlation of the attribution under a zero baseline with the window-mean baseline ${f(corr(a0, aMean), 2)}, with a unit-noise baseline ${f(corr(a0, aNoise), 2)}; max attribution ${f(Math.max(...a0), 3)} / ${f(Math.max(...aMean), 3)} / ${f(Math.max(...aNoise), 3)}`);
  }
  // redundancy: two copies of the cue
  {
    let dropOne = 0, dropBoth = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const d = makeSignal(rng, L, 1, { copies: 2 });
      if (Math.abs(d.cues[0] - d.cues[1]) < 60) continue;
      const base = probOf(net, d.X, 1);
      const wipe = (centres) => { const x = d.X.d.slice(); for (const c of centres) for (let t = Math.max(0, c - 16); t < Math.min(L, c + 16); t++) x[t] = 0; return probOf(net, { d: x, L }, 1); };
      dropOne += base - wipe([d.cues[0]]); dropBoth += base - wipe(d.cues); n++;
    }
    console.log(`redundancy, ${n} signals with TWO copies of the cue: occluding one copy drops p(class 1) by ${f(dropOne / n, 3)} on average, occluding both by ${f(dropBoth / n, 3)} — each copy alone is scored as nearly unimportant`);
  }
  // signed change hidden by |·|
  {
    let neg = 0, tot = 0;
    for (const d of pos.slice(0, 20)) {
      const base = probOf(net, d.X, 1);
      for (let s = 0; s + 32 <= L; s += 16) { const x = d.X.d.slice(); for (let t = s; t < s + 32; t++) x[t] = 0; const p = probOf(net, { d: x, L }, 1); tot++; if (p > base + 0.01) neg++; }
    }
    console.log(`sign: ${pct(neg / tot)} of ${tot} occlusions RAISE p(class 1) by more than 0.01 — the absolute value in a_i = |f(x) − f(x_occluded)| folds those into "important"`);
  }

  // DNA: motif presence, trained; do the kernels spell the motif?
  head("M4b · DNA: train on motif presence, then read the kernels and occlude with the PAD baseline");
  {
    const rng = makeRng(33), MOTIF = "TGACTCA", Lb = 64;
    const mk = (n) => Array.from({ length: n }, (_, i) => { const has = i % 2 === 1; let s = randomSeq(rng, Lb); let pos = -1; if (has) ({ seq: s, pos } = plant(rng, Lb, MOTIF, 0)); return { X: oneHot(s), y: has ? 1 : 0, pos, seq: s }; });
    const train = mk(400), test = mk(200);
    const net = Sequential([Conv1d(rng, 4, 8, 7, 1, 3, false), ReLU(), GlobalPool(8, "max"), Linear(rng, 8, 2)]);
    trainCNN(rng, net, train, { epochs: 20, lr: 3e-3 });
    const acc = (data) => data.filter(({ X, y }) => { const o = net.forward(X).d; return (o[1] > o[0] ? 1 : 0) === y; }).length / data.length;
    console.log(`conv(4→8,k7,p3,bias=False) ReLU global-max linear(8→2), 400 train, 20 epochs: train ${pct(acc(train))}, test ${pct(acc(test))}   [${secs()} s]`);
    const conv = net.layers[0], lin = net.layers[3];
    const spell = [];
    for (let o = 0; o < 8; o++) {
      let s = ""; let match = 0;
      for (let j = 0; j < 7; j++) { let bi = 0; for (let c = 1; c < 4; c++) if (conv.W.v[(o * 4 + c) * 7 + j] > conv.W.v[(o * 4 + bi) * 7 + j]) bi = c; s += BASES[bi]; if (BASES[bi] === MOTIF[j]) match++; }
      spell.push({ o, s, match, w: lin.W.v[1 * 8 + o] - lin.W.v[0 * 8 + o] });
    }
    spell.sort((a, b) => b.w - a.w);
    console.log(`kernels by their weight toward class 1 (column-argmax spelling against ${MOTIF}): ${spell.slice(0, 4).map((k) => `#${k.o} ${k.s} (${k.match}/7, w ${f(k.w, 2)})`).join("; ")}`);
    // occlusion with the PAD baseline (zero one-hot column), k=8 stride 4, as 07-3 cell 174
    let hit = 0; const posSeqs = test.filter((d) => d.y === 1).slice(0, 50);
    for (const d of posSeqs) {
      const base = probOf(net, d.X, 1); let best = -1, bs = -1;
      for (let s = 0; s + 8 <= Lb; s += 4) { const x = d.X.d.slice(); for (let c = 0; c < 4; c++) for (let t = s; t < s + 8; t++) x[c * Lb + t] = 0; const a = Math.abs(base - probOf(net, { d: x, L: Lb }, 1)); if (a > best) { best = a; bs = s; } }
      if (bs <= d.pos + 6 && bs + 8 > d.pos) hit++;
    }
    console.log(`occlusion (k=8, stride 4, baseline = PAD's zero column): the top window overlaps the planted motif in ${pct(hit / posSeqs.length)} of ${posSeqs.length} motif-bearing test sequences`);
  }
}

/* ================================================================== M5 */
head("M5 · windows and the split: overlapping windows from eight subjects, 1-NN by correlation");
{
  const rng = makeRng(44), L = 256, SUBJ = 8, WIN = 24, OVERLAP = 0.5;
  const subjects = Array.from({ length: SUBJ }, (_, s) => ({ s, label: s % 2, period: 44 + 4 * s + Math.floor(rng.next() * 4), amp: 0.6 + 0.15 * s, width: 2 + (s % 3), tw: 0.15 + 0.05 * (s % 4) }));
  const record = (sub) => {
    const T = Math.round(L * (1 + (WIN - 1) * (1 - OVERLAP))), x = zeros(T);
    const jitter = sub.label === 1 ? 0.35 : 0.03; // class 1: irregular rhythm
    for (let t = Math.floor(rng.next() * sub.period); t < T;) {
      for (let d = -sub.width; d <= sub.width; d++) if (t + d >= 0 && t + d < T) x[t + d] += sub.amp * (1 - Math.abs(d) / (sub.width + 1));
      for (let d = 8; d < 20; d++) if (t + d < T) x[t + d] += sub.tw * Math.sin(Math.PI * (d - 8) / 12);
      t += Math.max(20, Math.round(sub.period * (1 + jitter * rng.normal())));
    }
    for (let t = 0; t < T; t++) x[t] += rng.normal(0, 0.05) + 0.2 * Math.sin(2 * Math.PI * t / 700 + sub.s);
    return x;
  };
  const windows = [];
  const step = Math.round(L * (1 - OVERLAP));
  for (const sub of subjects) { const x = record(sub); for (let w = 0; w < WIN; w++) windows.push({ sub: sub.s, y: sub.label, raw: x.slice(w * step, w * step + L) }); }
  const z = (a) => { const m = a.reduce((p, q) => p + q, 0) / a.length, sd = Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length); return a.map((v) => (v - m) / sd); };
  /* the feature a model would learn from a subject's own windows: the window's log power spectrum (phase-free, so
     a window and its overlapping neighbour agree even though the beats sit at different positions in each) */
  const spectrum = (a) => { const n = a.length, out = new Array(n / 2); for (let k = 1; k <= n / 2; k++) { let re = 0, im = 0; for (let t = 0; t < n; t++) { re += a[t] * Math.cos(2 * Math.PI * k * t / n); im -= a[t] * Math.sin(2 * Math.PI * k * t / n); } out[k - 1] = Math.log(1e-6 + re * re + im * im); } return z(out); };
  for (const w of windows) w.z = spectrum(z(w.raw));
  const corr = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length; };
  const knn = (train, test) => test.filter((t) => { let best = -2, by = -1; for (const tr of train) { const c = corr(tr.z, t.z); if (c > best) { best = c; by = tr.y; } } return by === t.y; }).length / test.length;
  // window-level split: every fifth window held out
  const valW = windows.filter((_, i) => i % 5 === 0), trW = windows.filter((_, i) => i % 5 !== 0);
  // subject-level: hold out one subject of each class, all four pairings
  let subjAcc = 0;
  for (const pair of [[0, 1], [2, 3], [4, 5], [6, 7]]) { subjAcc += knn(windows.filter((w) => !pair.includes(w.sub)), windows.filter((w) => pair.includes(w.sub))); }
  console.log(`${SUBJ} subjects × ${WIN} windows of ${L} at ${pct(OVERLAP)} overlap (each held-out window shares ${L * OVERLAP} samples with each of its two neighbours); class = irregular rhythm, morphology and rate are the subject's own`);
  console.log(`1-NN by correlation of the windows' log power spectra: window-level split ${pct(knn(trW, valW))} (${valW.length} held out); subject-level split ${pct(subjAcc / 4)} (mean over four held-out pairs)`);
  // per-window normalisation against between-subject amplitude
  const sdRaw = subjects.map((s) => { const ws = windows.filter((w) => w.sub === s.s); return Math.sqrt(ws.reduce((a, w) => a + w.raw.reduce((p, q) => p + q * q, 0) / L, 0) / ws.length); });
  const spread = (a) => { const m = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length) / m; };
  console.log(`per-subject RMS amplitude before z-scoring: ${sdRaw.map((v) => f(v, 2)).join(" ")} (coefficient of variation ${pct(spread(sdRaw))}); after per-window z-scoring every window has sd 1 exactly`);
  // labels by overlap: an event annotation of width E landing in windows of L at stride step
  {
    const E = 60, trials = 20000; let whole = 0, anyN = 0, majN = 0;
    const T = step * (WIN - 1) + L;
    for (let i = 0; i < trials; i++) {
      const s0 = Math.floor(rng.next() * (T - E)), e0 = s0 + E; let inWhole = false, any = 0, maj = 0;
      for (let w = 0; w < WIN; w++) { const a = w * step, b = a + L; const ov = Math.max(0, Math.min(b, e0) - Math.max(a, s0)); if (ov === E) inWhole = true; if (ov > 0) any++; if (ov > E / 2) maj++; }
      whole += inWhole ? 1 : 0; anyN += any; majN += maj;
    }
    console.log(`label by overlap (simulated, ${trials} placements of a ${E}-sample event): it lies wholly inside at least one window ${pct(whole / trials)} of the time; "any overlap" labels ${f(anyN / trials, 2)} windows with it on average, "more than half the event" labels ${f(majN / trials, 2)}`);
  }
}

console.log(`\ntotal ${secs()} s`);
