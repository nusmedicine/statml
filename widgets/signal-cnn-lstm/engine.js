/* ============================================================================
   The plain-JS sequence engine for slot 73 `signal-cnn-lstm`, born here and
   imported by 75 `sequence-models` — the way 55 imported 48's relief and 63
   was to import 64's CNN.

   It is `_lab/dl-seq-measure.mjs`'s engine lifted out unchanged in its
   arithmetic: Conv1d (k, stride, pad, bias), ReLU, MaxPool1d, global average
   and global max pooling, Linear, softmax cross-entropy, a tanh RNN and an
   LSTM with backprop through time, a bidirectional sequence classifier with
   the lesson's three reductions (last · mean · max), Adam at torch's defaults
   and torch's U(−1/√fan_in, +) initialisation. Every backward pass was
   checked against central finite differences on 2026-09-20 (max relative
   error 6.9e-7 over fourteen engines); `gradCheck` below repeats the check on
   demand so a later edit cannot drift silently.

   Nothing here reads a token, draws a rectangle or holds a string a reader
   sees. All randomness comes from a seeded rng with the core contract
   (`next`, `uniform`, `normal`) — `widgets/core/rng.js`.

   Tensors are flat Float64Arrays. A 1D activation is `{ d, L }` with `d` laid
   out channel-major (`d[c * L + t]`); a sequence for a recurrence is an array
   of T Float64Array(D). A parameter is `{ v, g, m, s }` — value, gradient and
   Adam's two moments — so an optimiser step never has to know a layer's shape.
   ========================================================================= */

const F = (n) => new Float64Array(n);

/* --------------------------------------------------------------- params --- */

function uniformInit(rng, n, bound) {
  const a = F(n);
  for (let i = 0; i < n; i++) a[i] = rng.uniform(-bound, bound);
  return a;
}

/** A parameter: value, gradient, and Adam's two moments. */
export function param(rng, n, bound) {
  return { v: uniformInit(rng, n, bound), g: F(n), m: F(n), s: F(n) };
}

/** One Adam step over `params` (β 0.9 / 0.999, ε 1e-8, bias-corrected at step t),
    zeroing each gradient as it goes. */
export function adamStep(params, lr, t) {
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

/* --------------------------------------------------------------- layers --- */

/** torch's Conv1d output length. */
export const convOut = (L, k, s, p) => Math.floor((L + 2 * p - k) / s) + 1;

/** `Conv1d(cin, cout, k, stride, padding, bias)`; init U(±1/√(cin·k)). */
export function Conv1d(rng, cin, cout, k, stride = 1, pad = 0, bias = true) {
  const bound = 1 / Math.sqrt(cin * k);
  const W = param(rng, cout * cin * k, bound);
  const b = bias ? param(rng, cout, bound) : null;
  const layer = {
    W, b, cin, cout, k, stride, pad,
    params: bias ? [W, b] : [W],
    forward(x) {
      const L = x.L, Lo = convOut(L, k, stride, pad);
      const y = F(cout * Lo);
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
      const dx = F(cin * L);
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

export function ReLU() {
  const layer = {
    params: [],
    forward(x) {
      const y = F(x.d.length);
      for (let i = 0; i < y.length; i++) y[i] = x.d[i] > 0 ? x.d[i] : 0;
      layer.mask = y;
      return { d: y, L: x.L };
    },
    backward(dy) {
      const dx = F(dy.d.length);
      for (let i = 0; i < dx.length; i++) dx[i] = layer.mask[i] > 0 ? dy.d[i] : 0;
      return { d: dx, L: dy.L };
    },
  };
  return layer;
}

/** `MaxPool1d(k)` with stride k, over C channels; remembers the argmax. */
export function MaxPool1d(C, k = 2) {
  const layer = {
    params: [],
    forward(x) {
      const L = x.L, Lo = Math.floor(L / k);
      const y = F(C * Lo), arg = new Int32Array(C * Lo);
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
      const dx = F(C * layer.L);
      for (let i = 0; i < dy.d.length; i++) dx[layer.arg[i]] += dy.d[i];
      return { d: dx, L: layer.L };
    },
  };
  return layer;
}

/** Global pooling over the length: "avg" is `AdaptiveAvgPool1d(1)`, "max" is
    `AdaptiveMaxPool1d(1)` — the two heads 07-2 and 07-3 choose between. */
export function GlobalPool(C, kind) {
  const layer = {
    params: [], kind,
    forward(x) {
      const L = x.L, y = F(C), arg = new Int32Array(C);
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
      const L = layer.L, dx = F(C * L);
      for (let c = 0; c < C; c++) {
        if (kind === "avg") for (let t = 0; t < L; t++) dx[c * L + t] = dy.d[c] / L;
        else dx[c * L + layer.arg[c]] = dy.d[c];
      }
      return { d: dx, L };
    },
  };
  return layer;
}

/** `Linear(nin, nout)`; init U(±1/√nin). */
export function Linear(rng, nin, nout) {
  const bound = 1 / Math.sqrt(nin);
  const W = param(rng, nout * nin, bound), b = param(rng, nout, bound);
  const layer = {
    W, b, nin, nout, params: [W, b],
    forward(x) {
      const y = F(nout);
      for (let o = 0; o < nout; o++) {
        let acc = b.v[o];
        for (let i = 0; i < nin; i++) acc += W.v[o * nin + i] * x.d[i];
        y[o] = acc;
      }
      layer.x = x;
      return { d: y, L: 1 };
    },
    backward(dy) {
      const dx = F(nin);
      for (let o = 0; o < nout; o++) {
        const g = dy.d[o]; b.g[o] += g;
        for (let i = 0; i < nin; i++) { W.g[o * nin + i] += g * layer.x.d[i]; dx[i] += g * W.v[o * nin + i]; }
      }
      return { d: dx, L: 1 };
    },
  };
  return layer;
}

/**
 * `nn.Embedding(V, E, padding_idx)` for slot 75's token stages (07-3 cells
 * 26, 47, 66): rows N(0, 1) as torch initialises them, the PAD row zero and
 * never updated (no gradient reaches it, torch's `padding_idx`). Reads
 * `x.tok`, an integer array of `x.L` ids, and returns the channel-major
 * `{ d: [E, L], L }` a Conv1d takes — the lesson's `emb(tokens).transpose(1, 2)`
 * in one step, so a token net is a plain `Sequential` with this layer first.
 * `rows`, if given, fixes the table (a one-hot code, say) and the layer holds
 * no parameters. `W.skip` marks the PAD row for `gradCheck`, whose numeric
 * gradient there is not zero while the analytic one is masked, as torch's is.
 */
export function Embedding(rng, V, E, padIdx = 0, rows = null) {
  const W = { v: F(V * E), g: F(V * E), m: F(V * E), s: F(V * E) };
  if (rows) for (let v = 0; v < V; v++) for (let e = 0; e < E; e++) W.v[v * E + e] = rows[v][e];
  else for (let i = 0; i < V * E; i++) W.v[i] = rng.normal(0, 1);
  if (padIdx != null) for (let e = 0; e < E; e++) W.v[padIdx * E + e] = 0;
  W.skip = (i) => Math.floor(i / E) === padIdx;
  const layer = {
    W, V, E, padIdx, params: rows ? [] : [W],
    forward(x) {
      const L = x.L, y = F(E * L);
      for (let t = 0; t < L; t++) { const r = x.tok[t] * E; for (let e = 0; e < E; e++) y[e * L + t] = W.v[r + e]; }
      layer.x = x;
      return { d: y, L };
    },
    backward(dy) {
      const x = layer.x, L = x.L;
      if (rows) return null;
      for (let t = 0; t < L; t++) {
        const id = x.tok[t]; if (id === padIdx) continue;
        const r = id * E; for (let e = 0; e < E; e++) W.g[r + e] += dy.d[e * L + t];
      }
      return null; // tokens carry no gradient
    },
  };
  return layer;
}

/** Softmax cross-entropy on logits: the loss, its gradient on the logits, and
    the probabilities. */
export function softmaxCE(logits, y) {
  let m = -Infinity; for (const z of logits) if (z > m) m = z;
  const e = Array.from(logits, (z) => Math.exp(z - m));
  const Z = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / Z);
  const g = F(p.length);
  for (let i = 0; i < p.length; i++) g[i] = p[i] - (i === y ? 1 : 0);
  return { loss: -Math.log(p[y] + 1e-300), g, p };
}

/** Layers in order, `nn.Sequential`. `forward` returns the last layer's
    `{ d, L }`; `logits(x)` the final vector as a plain array. */
export function Sequential(layers) {
  const net = {
    layers,
    params: layers.flatMap((l) => l.params),
    forward(x) { for (const l of layers) x = l.forward(x); return x; },
    logits(x) { return Array.from(net.forward(x).d); },
    backward(dy) { for (let i = layers.length - 1; i >= 0; i--) dy = layers[i].backward(dy); return dy; },
    /** the activation after layer `upto` (inclusive), for feature-map pages */
    activations(x) { const out = []; for (const l of layers) { x = l.forward(x); out.push(x); } return out; },
  };
  return net;
}

/* ---------------------------------------------------------- recurrences --- */

/** A tanh RNN cell run over a whole sequence: h_t = tanh(W_x x_t + W_h h_{t−1} + b).
    `X` is an array of T Float64Array(D). */
export function RNN(rng, D, H) {
  const bound = 1 / Math.sqrt(H);
  const Wx = param(rng, H * D, bound), Wh = param(rng, H * H, bound), b = param(rng, H, bound);
  const cell = {
    D, H, params: [Wx, Wh, b],
    forward(X, h0 = F(H)) {
      const T = X.length, Hs = new Array(T);
      let h = h0;
      for (let t = 0; t < T; t++) {
        const nh = F(H);
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
    /** dHs: array of T (Float64Array(H) or null); returns dX */
    backward(dHs) {
      const { X, Hs, h0 } = cell, T = X.length;
      const dX = X.map(() => F(D));
      let dnext = F(H);
      for (let t = T - 1; t >= 0; t--) {
        const h = Hs[t], hp = t > 0 ? Hs[t - 1] : h0;
        const da = F(H);
        for (let j = 0; j < H; j++) da[j] = ((dHs[t] ? dHs[t][j] : 0) + dnext[j]) * (1 - h[j] * h[j]);
        const dprev = F(H);
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

/** An LSTM cell over a whole sequence, torch's gate order i f g o, one bias
    per gate drawn as b_ih + b_hh (two U(±1/√H) draws, as torch initialises).
    `forward` keeps the gates and cells so `backward` and the padding page can
    read them: `cell.Gs[t]` holds the four gate activations, `cell.Cs[t]` the
    cell state. */
export function LSTM(rng, D, H) {
  const bound = 1 / Math.sqrt(H);
  const W = param(rng, 4 * H * D, bound), U = param(rng, 4 * H * H, bound);
  const b = param(rng, 4 * H, bound);
  for (let i = 0; i < 4 * H; i++) b.v[i] += rng.uniform(-bound, bound);
  const cell = {
    D, H, params: [W, U, b],
    forward(X, h0 = F(H), c0 = F(H)) {
      const T = X.length, Hs = new Array(T), Cs = new Array(T), Gs = new Array(T);
      let h = h0, c = c0;
      for (let t = 0; t < T; t++) {
        const gates = F(4 * H);
        for (let j = 0; j < 4 * H; j++) {
          let a = b.v[j];
          for (let i = 0; i < D; i++) a += W.v[j * D + i] * X[t][i];
          for (let i = 0; i < H; i++) a += U.v[j * H + i] * h[i];
          gates[j] = a;
        }
        const nc = F(H), nh = F(H);
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
      const dX = X.map(() => F(D));
      let dh_next = F(H), dc_next = F(H);
      for (let t = T - 1; t >= 0; t--) {
        const g = Gs[t], c = Cs[t], cp = t > 0 ? Cs[t - 1] : c0, hp = t > 0 ? Hs[t - 1] : h0;
        const da = F(4 * H), dc = F(H);
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
        const dprev = F(H);
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

/**
 * A sequence classifier as 07-2 cell 44 and 07-3 cell 47 build it: a cell
 * (LSTM or tanh RNN), optionally a second cell over the reversed sequence,
 * then ONE of the lesson's three reductions of `output [L, F]` to `[F]` —
 * `last` (the forward pass's last state beside the reverse pass's last state,
 * which sits at position 0), `mean` over the steps, `max` over the steps —
 * then `Linear(F, classes)`. `forward` returns the logits as a Float64Array;
 * `model.feats` keeps the per-step features so a page can draw the block.
 */
export function SeqClassifier(rng, { cellKind = "lstm", D, H, bidirectional = true, pool = "last", classes = 2 }) {
  const mk = () => (cellKind === "lstm" ? LSTM(rng, D, H) : RNN(rng, D, H));
  const fwd = mk(), bwd = bidirectional ? mk() : null;
  const Fd = bidirectional ? 2 * H : H;
  const head = Linear(rng, Fd, classes);
  const model = {
    fwd, bwd, head, H, F: Fd, pool,
    params: [...fwd.params, ...(bwd ? bwd.params : []), ...head.params],
    forward(X) {
      const T = X.length;
      const Hf = fwd.forward(X);
      const Hb = bwd ? bwd.forward([...X].reverse()) : null; // Hb[i] is the state after reading X[T−1−i]
      const feats = new Array(T);
      for (let t = 0; t < T; t++) {
        const v = F(Fd);
        for (let j = 0; j < H; j++) v[j] = Hf[t][j];
        if (bwd) for (let j = 0; j < H; j++) v[H + j] = Hb[T - 1 - t][j];
        feats[t] = v;
      }
      const z = F(Fd), arg = new Int32Array(Fd);
      if (pool === "last") {
        for (let j = 0; j < H; j++) z[j] = Hf[T - 1][j];
        if (bwd) for (let j = 0; j < H; j++) z[H + j] = Hb[T - 1][j];
      } else if (pool === "mean") {
        for (let t = 0; t < T; t++) for (let j = 0; j < Fd; j++) z[j] += feats[t][j] / T;
      } else {
        for (let j = 0; j < Fd; j++) { let best = -Infinity; for (let t = 0; t < T; t++) if (feats[t][j] > best) { best = feats[t][j]; arg[j] = t; } z[j] = best; }
      }
      Object.assign(model, { T, arg, feats, z });
      return head.forward({ d: z, L: 1 }).d;
    },
    backward(dlogits) {
      const { T, arg } = model;
      const dz = head.backward({ d: dlogits, L: 1 }).d;
      const dHf = new Array(T).fill(null), dHb = bwd ? new Array(T).fill(null) : null;
      const put = (t, j, g) => {
        if (j < H) { (dHf[t] ??= F(H))[j] += g; }
        else { (dHb[T - 1 - t] ??= F(H))[j - H] += g; }
      };
      if (pool === "last") {
        for (let j = 0; j < H; j++) put(T - 1, j, dz[j]);
        if (bwd) for (let j = 0; j < H; j++) put(0, H + j, dz[H + j]);
      } else if (pool === "mean") {
        for (let t = 0; t < T; t++) for (let j = 0; j < Fd; j++) put(t, j, dz[j] / T);
      } else {
        for (let j = 0; j < Fd; j++) put(arg[j], j, dz[j]);
      }
      /* the gradient on the inputs, summed over the two directions, so a front
         end (75's embedding and convolution) can train under the recurrence;
         the reverse cell read X reversed, so its dX[i] belongs to X[T−1−i] */
      const dXf = fwd.backward(dHf);
      if (!bwd) return dXf;
      const dXb = bwd.backward(dHb);
      for (let t = 0; t < T; t++) { const a = dXf[t], b = dXb[T - 1 - t]; for (let i = 0; i < a.length; i++) a[i] += b[i]; }
      return dXf;
    },
  };
  return model;
}

/* ------------------------------------------------------------- training --- */

/**
 * Mini-batch training with Adam. `data` is `[{ x, y }]`; `net.forward(x)`
 * returns logits (a Float64Array, or `{ d }`); `net.backward(g)` takes the
 * gradient on the logits in the same form the forward returned. `onEpoch`
 * gets `(epoch, meanLoss)` so a widget can keep the curve. `data` may instead
 * be a function of the epoch returning that epoch's `[{ x, y }]` — a fresh
 * draw each time, for a synthetic stage where a fixed set of a few hundred
 * random sequences is memorised before its one planted motif is found (75).
 */
export function train(rng, net, source, { epochs, batch = 16, lr = 1e-3, onEpoch = null }) {
  let step = 0;
  const wraps = (out) => out && out.d !== undefined;
  for (let e = 0; e < epochs; e++) {
    const data = typeof source === "function" ? source(e) : source;
    const idx = data.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let lossSum = 0;
    for (let b0 = 0; b0 < idx.length; b0 += batch) {
      const n = Math.min(idx.length, b0 + batch) - b0;
      for (let i = b0; i < b0 + n; i++) {
        const { x, y } = data[idx[i]];
        const out = net.forward(x);
        const { loss, g } = softmaxCE(wraps(out) ? out.d : out, y);
        lossSum += loss;
        for (let q = 0; q < g.length; q++) g[q] /= n;
        net.backward(wraps(out) ? { d: g, L: 1 } : g);
      }
      adamStep(net.params, lr, ++step);
    }
    if (onEpoch) onEpoch(e, lossSum / idx.length);
  }
}

/** Class probabilities for one input. */
export function predict(net, x) {
  const out = net.forward(x);
  return softmaxCE(out.d !== undefined ? out.d : out, 0).p;
}

/** Fraction of `data` whose argmax matches `y`. */
export function accuracy(net, data) {
  let ok = 0;
  for (const { x, y } of data) {
    const p = predict(net, x);
    let bi = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[bi]) bi = i;
    if (bi === y) ok++;
  }
  return ok / data.length;
}

/* ------------------------------------------------------------ occlusion --- */

/**
 * Captum's `Occlusion` on one 1D input, by hand: for every window of `k`
 * starting at multiples of `stride`, replace it by `baseline(x, start, k, t)`
 * and record |p_cls(x) − p_cls(x_occluded)|; positions covered by several
 * windows take the mean, as Captum does. Returns the per-position attribution
 * and the unoccluded probability.
 */
export function occlusion(net, x, cls, k, stride, baseline) {
  const L = x.L, base = predict(net, x)[cls], attr = F(L), count = F(L);
  for (let s = 0; s + k <= L; s += stride) {
    const d = x.d.slice();
    for (let t = s; t < s + k; t++) d[t] = baseline(x.d, s, k, t);
    const a = Math.abs(base - predict(net, { d, L })[cls]);
    for (let t = s; t < s + k; t++) { attr[t] += a; count[t]++; }
  }
  for (let t = 0; t < L; t++) attr[t] /= Math.max(1, count[t]);
  return { attr, base };
}

/* ---------------------------------------------------------- the check --- */

/**
 * Central finite differences against the analytic gradient, on a few entries
 * of every parameter. `lossFn(back)` computes the loss on a fixed input and,
 * when `back` is true, also runs the backward pass. Returns the worst
 * relative error; a caller asserts on it.
 */
export function gradCheck(params, lossFn, rng, { perParam = 4, eps = 1e-5 } = {}) {
  for (const p of params) p.g.fill(0);
  lossFn(true);
  let worst = 0, n = 0;
  for (const p of params) {
    const idx = new Set();
    while (idx.size < Math.min(perParam, p.v.length)) idx.add(Math.floor(rng.next() * p.v.length));
    for (const i of idx) {
      if (p.skip && p.skip(i)) continue; // a masked row (Embedding's PAD)
      const old = p.v[i];
      p.v[i] = old + eps; const lp = lossFn(false);
      p.v[i] = old - eps; const lm = lossFn(false);
      p.v[i] = old;
      const num = (lp - lm) / (2 * eps), an = p.g[i];
      worst = Math.max(worst, Math.abs(num - an) / Math.max(1e-8, Math.abs(num) + Math.abs(an))); n++;
    }
    p.g.fill(0);
  }
  return { worst, n };
}
