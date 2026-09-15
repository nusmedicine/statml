/* ============================================================================
   Widget 65 · engine.js — a small U-Net that trains in the browser, so the
   operation band draws a trained network's own numbers (Kenneth's pick,
   round 2, 2026-09-15: "train 5 epochs in compute").

   The architecture is PHM5005 06-3 cell 33's `UNet2D` at a size the browser
   can train: DoubleConv = (Conv2d 3 × 3 bias=False → BatchNorm2d → ReLU) × 2,
   MaxPool2d(2) down, ConvTranspose2d(2, stride 2) up, torch.cat([up, enc],
   dim=1), a 1 × 1 Conv2d head; the loss is MONAI's DiceCELoss(sigmoid=True)
   — BCEWithLogits mean plus the soft Dice loss per image, averaged — and the
   optimizer torch's Adam. The planning script `_lab/dl-seg-measure.mjs` had
   the same net without BatchNorm; this one has it, because the band draws the
   BatchNorm step and a band must not draw a layer the network lacks.

   BATCHNORM IN BOTH MODES, as torch does: training normalises by the batch's
   own mean and variance and updates running statistics (momentum 0.1, the
   unbiased variance); inference — the band — uses the running statistics.

   All randomness comes from the seeded rng passed in (`next`, `uniform`,
   `normal`, `shuffle`). `gradCheck` holds every backward pass against central
   differences; `_lab/unet-verify.mjs` asserts it.
   ========================================================================= */

const F = (n) => new Float64Array(n);
export const EPS_BN = 1e-5;
export const MOMENTUM = 0.1;
export const SMOOTH = 1e-5;           // MONAI DiceLoss smooth_nr and smooth_dr

/* --- the data ---------------------------------------------------------------- */

/**
 * One to three blobs on a dark field with noise, the planning script's
 * "not small" case: the mask is the blobs, the image a soft rendering of them.
 * `cin` channels (Kenneth, 2026-09-15: "train on 3 channels"): each blob has
 * its own colour, a brightness a channel, so the image is a colour image as the
 * lesson's are, and the mask is the same for every channel. With `cin` 1 the
 * draws are the one-channel images the earlier rounds trained on.
 */
export function makeCase(S, rng, cin = 1) {
  const img = F(cin * S * S);
  const mask = F(S * S);
  const nb = 1 + Math.floor(rng.next() * 3);
  const blobs = [];
  for (let k = 0; k < nb; k += 1) {
    const r = 1.4 + rng.next() * (S / 6 - 1.4);
    const colour = cin === 1 ? [0.6] : Array.from({ length: cin }, () => 0.25 + 0.6 * rng.next());
    blobs.push([r + 1 + rng.next() * (S - 2 * r - 2), r + 1 + rng.next() * (S - 2 * r - 2), r, colour]);
  }
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      let best = Infinity;
      const soft = F(cin);
      for (const [cx, cy, r, colour] of blobs) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
        best = Math.min(best, d);
        const v = 1 / (1 + Math.exp(d / 0.7));
        for (let c = 0; c < cin; c += 1) soft[c] = Math.max(soft[c], colour[c] * v);
      }
      mask[y * S + x] = best <= 0 ? 1 : 0;
      for (let c = 0; c < cin; c += 1) img[c * S * S + y * S + x] = soft[c] + 0.2 * rng.normal();
    }
  }
  return { img, mask };
}
export function makeData(S, n, rng, cin = 1) {
  const x = F(n * cin * S * S);
  const t = F(n * S * S);
  for (let i = 0; i < n; i += 1) {
    const c = makeCase(S, rng, cin);
    x.set(c.img, i * cin * S * S);
    t.set(c.mask, i * S * S);
  }
  return { x, t, n, S, cin };
}

/* --- parameters --------------------------------------------------------------- */

/** torch's default for Conv2d and ConvTranspose2d: U(−1/√fan_in, +1/√fan_in),
    fan_in from weight.size(1) × k × k — for a transposed conv that is the
    OUTPUT channels, torch's own quirk, kept */
const param = (n) => ({ v: F(n), g: F(n), m: F(n), s: F(n) });
function uniform(p, fanIn, rng) {
  const k = 1 / Math.sqrt(fanIn);
  for (let i = 0; i < p.v.length; i += 1) p.v[i] = rng.uniform(-k, k);
}

function convLayer(cin, cout, rng) {
  const W = param(cout * cin * 9);
  uniform(W, cin * 9, rng);
  return { kind: "conv3", cin, cout, W };
}
function bnLayer(c) {
  const gamma = param(c);
  gamma.v.fill(1);
  return { kind: "bn", c, gamma, beta: param(c), rm: F(c), rv: F(c).fill(1) };
}
function doubleConv(cin, cout, rng) {
  return { kind: "dconv", cin, cout, c1: convLayer(cin, cout, rng), n1: bnLayer(cout), c2: convLayer(cout, cout, rng), n2: bnLayer(cout) };
}
function upLayer(cin, cout, rng) {
  const W = param(cin * cout * 4);
  const b = param(cout);
  uniform(W, cout * 4, rng);
  uniform(b, cout * 4, rng);
  return { kind: "up", cin, cout, W, b };
}

/**
 * `depth` encoder levels, `base` channels at the first; one input channel,
 * one output logit a pixel.
 */
export function makeUNet(depth, base, S, rng, inChannels = 1) {
  const enc = [];
  let cin = inChannels;
  for (let l = 1; l <= depth; l += 1) {
    const c = base * 2 ** (l - 1);
    enc.push(doubleConv(cin, c, rng));
    cin = c;
  }
  const bottleneck = doubleConv(cin, base * 2 ** depth, rng);
  const ups = [];
  const decs = [];
  let cur = base * 2 ** depth;
  for (let l = depth; l >= 1; l -= 1) {
    const c = base * 2 ** (l - 1);
    ups.push(upLayer(cur, c, rng));
    decs.push(doubleConv(2 * c, c, rng));
    cur = c;
  }
  const Wh = param(base);
  const bh = param(1);
  uniform(Wh, base, rng);
  uniform(bh, base, rng);
  const net = { depth, base, S, cin: inChannels, enc, bottleneck, ups, decs, head: { Wh, bh } };
  net.params = [];
  const addD = (d) => net.params.push(d.c1.W, d.n1.gamma, d.n1.beta, d.c2.W, d.n2.gamma, d.n2.beta);
  enc.forEach(addD);
  addD(bottleneck);
  ups.forEach((u, i) => { net.params.push(u.W, u.b); addD(decs[i]); });
  net.params.push(Wh, bh);
  return net;
}
export const parameterCount = (net) => net.params.reduce((a, p) => a + p.v.length, 0);

/* --- the operations, over a batch of B square maps ---------------------------------- */

function conv3Fwd(x, B, cin, H, W, cout) {
  const HW = H * H;
  const out = F(B * cout * HW);
  for (let n = 0; n < B; n += 1) {
    for (let o = 0; o < cout; o += 1) {
      const ob = (n * cout + o) * HW;
      for (let c = 0; c < cin; c += 1) {
        const xb = (n * cin + c) * HW;
        const wb = (o * cin + c) * 9;
        for (let ky = 0; ky < 3; ky += 1) {
          const y0 = Math.max(0, 1 - ky);
          const y1 = Math.min(H, H + 1 - ky);
          for (let kx = 0; kx < 3; kx += 1) {
            const wv = W[wb + ky * 3 + kx];
            const x0 = Math.max(0, 1 - kx);
            const x1 = Math.min(H, H + 1 - kx);
            for (let y = y0; y < y1; y += 1) {
              let oi = ob + y * H + x0;
              let xi = xb + (y + ky - 1) * H + (x0 + kx - 1);
              for (let xx = x0; xx < x1; xx += 1, oi += 1, xi += 1) out[oi] += wv * x[xi];
            }
          }
        }
      }
    }
  }
  return out;
}
function conv3Bwd(x, dy, B, cin, H, W, cout, dW, wantDx) {
  const HW = H * H;
  const dx = wantDx ? F(B * cin * HW) : null;
  for (let n = 0; n < B; n += 1) {
    for (let o = 0; o < cout; o += 1) {
      const ob = (n * cout + o) * HW;
      for (let c = 0; c < cin; c += 1) {
        const xb = (n * cin + c) * HW;
        const wb = (o * cin + c) * 9;
        for (let ky = 0; ky < 3; ky += 1) {
          const y0 = Math.max(0, 1 - ky);
          const y1 = Math.min(H, H + 1 - ky);
          for (let kx = 0; kx < 3; kx += 1) {
            const wv = W[wb + ky * 3 + kx];
            const x0 = Math.max(0, 1 - kx);
            const x1 = Math.min(H, H + 1 - kx);
            let acc = 0;
            for (let y = y0; y < y1; y += 1) {
              let oi = ob + y * H + x0;
              let xi = xb + (y + ky - 1) * H + (x0 + kx - 1);
              for (let xx = x0; xx < x1; xx += 1, oi += 1, xi += 1) {
                acc += dy[oi] * x[xi];
                if (dx) dx[xi] += wv * dy[oi];
              }
            }
            dW[wb + ky * 3 + kx] += acc;
          }
        }
      }
    }
  }
  return dx;
}

function bnFwd(layer, x, B, C, HW, train) {
  const out = F(x.length);
  const N = B * HW;
  const cache = { xhat: F(x.length), invstd: F(C) };
  for (let c = 0; c < C; c += 1) {
    let mu;
    let v;
    if (train) {
      mu = 0;
      for (let n = 0; n < B; n += 1) for (let i = 0; i < HW; i += 1) mu += x[(n * C + c) * HW + i];
      mu /= N;
      v = 0;
      for (let n = 0; n < B; n += 1) for (let i = 0; i < HW; i += 1) v += (x[(n * C + c) * HW + i] - mu) ** 2;
      v /= N;
      layer.rm[c] = (1 - MOMENTUM) * layer.rm[c] + MOMENTUM * mu;
      layer.rv[c] = (1 - MOMENTUM) * layer.rv[c] + MOMENTUM * (N > 1 ? (v * N) / (N - 1) : v);
    } else {
      mu = layer.rm[c];
      v = layer.rv[c];
    }
    const inv = 1 / Math.sqrt(v + EPS_BN);
    cache.invstd[c] = inv;
    const g = layer.gamma.v[c];
    const b = layer.beta.v[c];
    for (let n = 0; n < B; n += 1) {
      for (let i = 0; i < HW; i += 1) {
        const k = (n * C + c) * HW + i;
        const xh = (x[k] - mu) * inv;
        cache.xhat[k] = xh;
        out[k] = g * xh + b;
      }
    }
  }
  return { out, cache };
}
/* training-mode backward: the batch statistics depend on every input */
function bnBwd(layer, cache, dy, B, C, HW) {
  const N = B * HW;
  const dx = F(dy.length);
  for (let c = 0; c < C; c += 1) {
    let sdy = 0;
    let sdyx = 0;
    for (let n = 0; n < B; n += 1) {
      for (let i = 0; i < HW; i += 1) {
        const k = (n * C + c) * HW + i;
        sdy += dy[k];
        sdyx += dy[k] * cache.xhat[k];
      }
    }
    layer.beta.g[c] += sdy;
    layer.gamma.g[c] += sdyx;
    const scale = (layer.gamma.v[c] * cache.invstd[c]) / N;
    for (let n = 0; n < B; n += 1) {
      for (let i = 0; i < HW; i += 1) {
        const k = (n * C + c) * HW + i;
        dx[k] = scale * (N * dy[k] - sdy - cache.xhat[k] * sdyx);
      }
    }
  }
  return dx;
}

const reluFwd = (x) => x.map((v) => (v > 0 ? v : 0));
function reluBwd(a, dy) {
  const dx = F(dy.length);
  for (let i = 0; i < dy.length; i += 1) dx[i] = a[i] > 0 ? dy[i] : 0;
  return dx;
}

function poolFwd(x, B, C, H) {
  const h = H >> 1;
  const out = F(B * C * h * h);
  const idx = new Int32Array(out.length);
  for (let n = 0; n < B; n += 1) {
    for (let c = 0; c < C; c += 1) {
      const ib = (n * C + c) * H * H;
      const ob = (n * C + c) * h * h;
      for (let y = 0; y < h; y += 1) {
        for (let xx = 0; xx < h; xx += 1) {
          const i0 = ib + 2 * y * H + 2 * xx;
          let best = x[i0];
          let bi = i0;
          if (x[i0 + 1] > best) { best = x[i0 + 1]; bi = i0 + 1; }
          if (x[i0 + H] > best) { best = x[i0 + H]; bi = i0 + H; }
          if (x[i0 + H + 1] > best) { best = x[i0 + H + 1]; bi = i0 + H + 1; }
          out[ob + y * h + xx] = best;
          idx[ob + y * h + xx] = bi;
        }
      }
    }
  }
  return { out, idx };
}
function poolBwd(idx, dy, size) {
  const dx = F(size);
  for (let i = 0; i < dy.length; i += 1) dx[idx[i]] += dy[i];
  return dx;
}

/* ConvTranspose2d(cin, cout, 2, stride 2): weight [cin, cout, 2, 2] */
function upFwd(layer, x, B, h) {
  const { cin, cout } = layer;
  const H = 2 * h;
  const W = layer.W.v;
  const out = F(B * cout * H * H);
  for (let n = 0; n < B; n += 1) {
    for (let o = 0; o < cout; o += 1) out.fill(layer.b.v[o], (n * cout + o) * H * H, (n * cout + o + 1) * H * H);
    for (let c = 0; c < cin; c += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let xx = 0; xx < h; xx += 1) {
          const v = x[(n * cin + c) * h * h + y * h + xx];
          for (let o = 0; o < cout; o += 1) {
            const wb = (c * cout + o) * 4;
            const ob = (n * cout + o) * H * H;
            out[ob + 2 * y * H + 2 * xx] += W[wb] * v;
            out[ob + 2 * y * H + 2 * xx + 1] += W[wb + 1] * v;
            out[ob + (2 * y + 1) * H + 2 * xx] += W[wb + 2] * v;
            out[ob + (2 * y + 1) * H + 2 * xx + 1] += W[wb + 3] * v;
          }
        }
      }
    }
  }
  return out;
}
function upBwd(layer, x, dy, B, h) {
  const { cin, cout } = layer;
  const H = 2 * h;
  const W = layer.W.v;
  const dx = F(B * cin * h * h);
  for (let n = 0; n < B; n += 1) {
    for (let o = 0; o < cout; o += 1) {
      const ob = (n * cout + o) * H * H;
      let s = 0;
      for (let i = 0; i < H * H; i += 1) s += dy[ob + i];
      layer.b.g[o] += s;
    }
    for (let c = 0; c < cin; c += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let xx = 0; xx < h; xx += 1) {
          const xi = (n * cin + c) * h * h + y * h + xx;
          const v = x[xi];
          let acc = 0;
          for (let o = 0; o < cout; o += 1) {
            const wb = (c * cout + o) * 4;
            const ob = (n * cout + o) * H * H;
            const d0 = dy[ob + 2 * y * H + 2 * xx];
            const d1 = dy[ob + 2 * y * H + 2 * xx + 1];
            const d2 = dy[ob + (2 * y + 1) * H + 2 * xx];
            const d3 = dy[ob + (2 * y + 1) * H + 2 * xx + 1];
            layer.W.g[wb] += d0 * v;
            layer.W.g[wb + 1] += d1 * v;
            layer.W.g[wb + 2] += d2 * v;
            layer.W.g[wb + 3] += d3 * v;
            acc += W[wb] * d0 + W[wb + 1] * d1 + W[wb + 2] * d2 + W[wb + 3] * d3;
          }
          dx[xi] = acc;
        }
      }
    }
  }
  return dx;
}

/* --- the network, forward and backward ------------------------------------------- */

function dconvFwd(d, x, B, H, train) {
  const HW = H * H;
  const z1 = conv3Fwd(x, B, d.cin, H, d.c1.W.v, d.cout);
  const b1 = bnFwd(d.n1, z1, B, d.cout, HW, train);
  const a1 = reluFwd(b1.out);
  const z2 = conv3Fwd(a1, B, d.cout, H, d.c2.W.v, d.cout);
  const b2 = bnFwd(d.n2, z2, B, d.cout, HW, train);
  const a2 = reluFwd(b2.out);
  return { x, H, z1, n1: b1.out, c1: b1.cache, a1, z2, n2: b2.out, c2: b2.cache, out: a2 };
}
function dconvBwd(d, r, dy, B) {
  const HW = r.H * r.H;
  let g = reluBwd(r.out, dy);
  g = bnBwd(d.n2, r.c2, g, B, d.cout, HW);
  g = conv3Bwd(r.a1, g, B, d.cout, r.H, d.c2.W.v, d.cout, d.c2.W.g, true);
  g = reluBwd(r.a1, g);
  g = bnBwd(d.n1, r.c1, g, B, d.cout, HW);
  return conv3Bwd(r.x, g, B, d.cin, r.H, d.c1.W.v, d.cout, d.c1.W.g, true);
}

/**
 * The forward pass over a batch, every intermediate kept by stage name —
 * enc1 · pool1 · … · bottleneck · up_l · cat_l · dec_l · head — which is what
 * both the backward pass and the band read.
 */
export function forward(net, x, B, { train = false } = {}) {
  const { depth, base, S } = net;
  const rec = {};
  let cur = x;
  let H = S;
  for (let l = 1; l <= depth; l += 1) {
    const r = dconvFwd(net.enc[l - 1], cur, B, H, train);
    rec[`enc${l}`] = r;
    const C = base * 2 ** (l - 1);
    const p = poolFwd(r.out, B, C, H);
    rec[`pool${l}`] = { x: r.out, C, H, out: p.out, idx: p.idx };
    cur = p.out;
    H >>= 1;
  }
  rec.bottleneck = dconvFwd(net.bottleneck, cur, B, H, train);
  cur = rec.bottleneck.out;
  for (let i = 0; i < depth; i += 1) {
    const l = depth - i;
    const u = net.ups[i];
    const upOut = upFwd(u, cur, B, H);
    rec[`up${l}`] = { x: cur, h: H, out: upOut };
    H *= 2;
    const C = u.cout;
    const e = rec[`enc${l}`].out;
    const cat = F(B * 2 * C * H * H);
    for (let n = 0; n < B; n += 1) {
      cat.set(upOut.subarray(n * C * H * H, (n + 1) * C * H * H), n * 2 * C * H * H);
      cat.set(e.subarray(n * C * H * H, (n + 1) * C * H * H), (n * 2 * C + C) * H * H);
    }
    rec[`cat${l}`] = { up: upOut, enc: e, C, H, out: cat };
    rec[`dec${l}`] = dconvFwd(net.decs[i], cat, B, H, train);
    cur = rec[`dec${l}`].out;
  }
  const HW = S * S;
  const z = F(B * HW);
  const Wh = net.head.Wh.v;
  for (let n = 0; n < B; n += 1) {
    for (let i = 0; i < HW; i += 1) {
      let s = net.head.bh.v[0];
      for (let c = 0; c < base; c += 1) s += Wh[c] * cur[(n * base + c) * HW + i];
      z[n * HW + i] = s;
    }
  }
  rec.head = { x: cur, z, p: z.map((v) => 1 / (1 + Math.exp(-v))) };
  return rec;
}

/** DiceCELoss(sigmoid=True): BCEWithLogits over every pixel + mean over the
    batch of 1 − (2Σpt + ε)/(Σp + Σt + ε). Returns the loss and dL/dz. */
export function diceCE(z, t, B, HW) {
  const N = B * HW;
  const dz = F(N);
  let bce = 0;
  let dice = 0;
  for (let n = 0; n < B; n += 1) {
    let I = 0;
    let U = 0;
    const p = F(HW);
    for (let i = 0; i < HW; i += 1) {
      const k = n * HW + i;
      const zi = z[k];
      p[i] = 1 / (1 + Math.exp(-zi));
      bce += Math.max(zi, 0) - zi * t[k] + Math.log1p(Math.exp(-Math.abs(zi)));
      dz[k] += (p[i] - t[k]) / N;
      I += p[i] * t[k];
      U += p[i] + t[k];
    }
    const num = 2 * I + SMOOTH;
    const den = U + SMOOTH;
    dice += 1 - num / den;
    for (let i = 0; i < HW; i += 1) {
      const k = n * HW + i;
      const dDdp = -(2 * t[k] * den - num) / (den * den);
      dz[k] += (dDdp * p[i] * (1 - p[i])) / B;
    }
  }
  return { loss: bce / N + dice / B, dz };
}

export function backward(net, rec, x, dz, B) {
  const { depth, base, S } = net;
  const HW = S * S;
  const top = rec[`dec1`].out;
  let g = F(B * base * HW);
  for (let n = 0; n < B; n += 1) {
    for (let i = 0; i < HW; i += 1) {
      const d = dz[n * HW + i];
      net.head.bh.g[0] += d;
      for (let c = 0; c < base; c += 1) {
        net.head.Wh.g[c] += d * top[(n * base + c) * HW + i];
        g[(n * base + c) * HW + i] = d * net.head.Wh.v[c];
      }
    }
  }
  const encGrad = {};
  for (let i = depth - 1; i >= 0; i -= 1) {
    const l = depth - i;
    const cat = rec[`cat${l}`];
    const gc = dconvBwd(net.decs[i], rec[`dec${l}`], g, B);
    const { C, H } = cat;
    const gUp = F(B * C * H * H);
    const gEnc = F(B * C * H * H);
    for (let n = 0; n < B; n += 1) {
      gUp.set(gc.subarray(n * 2 * C * H * H, (n * 2 * C + C) * H * H), n * C * H * H);
      gEnc.set(gc.subarray((n * 2 * C + C) * H * H, (n + 1) * 2 * C * H * H), n * C * H * H);
    }
    encGrad[l] = gEnc;
    g = upBwd(net.ups[i], rec[`up${l}`].x, gUp, B, rec[`up${l}`].h);
  }
  g = dconvBwd(net.bottleneck, rec.bottleneck, g, B);
  for (let l = depth; l >= 1; l -= 1) {
    const p = rec[`pool${l}`];
    const gPool = poolBwd(p.idx, g, B * p.C * p.H * p.H);
    const e = encGrad[l];
    for (let i = 0; i < gPool.length; i += 1) gPool[i] += e[i];
    g = dconvBwd(net.enc[l - 1], rec[`enc${l}`], gPool, B);
  }
  return g;
}

/* --- Adam, and training ------------------------------------------------------------- */

export function adamStep(net, lr, t) {
  const c1 = 1 - 0.9 ** t;
  const c2 = 1 - 0.999 ** t;
  for (const p of net.params) {
    for (let i = 0; i < p.v.length; i += 1) {
      const g = p.g[i];
      p.m[i] = 0.9 * p.m[i] + 0.1 * g;
      p.s[i] = 0.999 * p.s[i] + 0.001 * g * g;
      p.v[i] -= (lr * (p.m[i] / c1)) / (Math.sqrt(p.s[i] / c2) + 1e-8);
      p.g[i] = 0;
    }
  }
}

export function train(net, data, { epochs, batch = 8, lr = 1e-3, rng, step = 0 }) {
  const { S, n } = data;
  const HW = S * S;
  const order = Array.from({ length: n }, (_, i) => i);
  const losses = [];
  let t = step;
  for (let ep = 0; ep < epochs; ep += 1) {
    rng.shuffle(order);
    let L = 0;
    let steps = 0;
    for (let s = 0; s + batch <= n; s += batch) {
      const x = F(batch * net.cin * HW);
      const y = F(batch * HW);
      for (let j = 0; j < batch; j += 1) {
        x.set(data.x.subarray(order[s + j] * net.cin * HW, (order[s + j] + 1) * net.cin * HW), j * net.cin * HW);
        y.set(data.t.subarray(order[s + j] * HW, (order[s + j] + 1) * HW), j * HW);
      }
      const rec = forward(net, x, batch, { train: true });
      const { loss, dz } = diceCE(rec.head.z, y, batch, HW);
      backward(net, rec, x, dz, batch);
      t += 1;
      adamStep(net, lr, t);
      L += loss;
      steps += 1;
    }
    losses.push(L / steps);
  }
  return { losses, steps: t };
}

/** mean hard Dice at 0.5 over a set, in inference mode */
export function evaluateDice(net, data) {
  const { S, n } = data;
  const HW = S * S;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const rec = forward(net, data.x.subarray(i * net.cin * HW, (i + 1) * net.cin * HW), 1);
    let I = 0;
    let A = 0;
    let Bc = 0;
    for (let k = 0; k < HW; k += 1) {
      const p = rec.head.z[k] > 0 ? 1 : 0;
      const tt = data.t[i * HW + k];
      I += p * tt;
      A += tt;
      Bc += p;
    }
    sum += A + Bc ? (2 * I) / (A + Bc) : 1;
  }
  return sum / n;
}

/* --- the gradient check -------------------------------------------------------------- */

/** max relative error of every parameter's analytic gradient, training mode */
export function gradCheck(rng, { depth = 1, base = 2, S = 4, B = 2, cin = 1 } = {}) {
  const net = makeUNet(depth, base, S, rng, cin);
  const data = makeData(S, B, rng, cin);
  const HW = S * S;
  /* BatchNorm's running statistics move on every training forward; the loss
     does not read them, so the check is unaffected, but restore them anyway */
  const snapshot = () => {
    const all = [...net.enc, net.bottleneck, ...net.decs].flatMap((d) => [d.n1, d.n2]);
    return all.map((b) => [b, b.rm.slice(), b.rv.slice()]);
  };
  const lossAt = () => {
    const snap = snapshot();
    const rec = forward(net, data.x, B, { train: true });
    for (const [b, rm, rv] of snap) { b.rm.set(rm); b.rv.set(rv); }
    return diceCE(rec.head.z, data.t, B, HW).loss;
  };
  for (const p of net.params) p.g.fill(0);
  const rec = forward(net, data.x, B, { train: true });
  const { dz } = diceCE(rec.head.z, data.t, B, HW);
  backward(net, rec, data.x, dz, B);
  let worst = 0;
  let count = 0;
  const h = 1e-5;
  for (const p of net.params) {
    const analytic = p.g.slice();
    for (let i = 0; i < p.v.length; i += 1) {
      const o = p.v[i];
      p.v[i] = o + h; const lp = lossAt();
      p.v[i] = o - h; const lm = lossAt();
      p.v[i] = o;
      const num = (lp - lm) / (2 * h);
      const rel = Math.abs(num - analytic[i]) / Math.max(1e-7, Math.abs(num) + Math.abs(analytic[i]));
      if (rel > worst) worst = rel;
      count += 1;
    }
  }
  return { worst, count };
}
