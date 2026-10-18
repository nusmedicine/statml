/* Slot 108's engine, for the mock and the measurement (node and browser).

   A 1-D GAN trained as 10-3b c42's pseudocode: each round updates D on a
   batch of real and fake samples, then G on fresh noise with the
   non-saturating loss L_G = -log D(G(z)). G and D are 1 → H → 1 MLPs with
   tanh, initialised as torch's nn.Linear, trained by Adam (β1 = 0.5).
   Everything is drawn from the one seeded rng.

   kD and kG are the number of steps each half takes in a round: 1 and 1 is
   the pseudocode; 20 and 20 is the hand-played schedule the mock offers. */

import { makeRng } from "../core/rng.js";

export const tanh = { f: Math.tanh, d: (y) => 1 - y * y };   // d from the output
export const sig = (s) => 1 / (1 + Math.exp(-s));

function mlp(rng, H) {
  const b2 = 1 / Math.sqrt(H);                 // fan_in 1 for the first layer
  return {
    W1: Array.from({ length: H }, () => rng.uniform(-1, 1)),
    c1: Array.from({ length: H }, () => rng.uniform(-1, 1)),
    w2: Array.from({ length: H }, () => rng.uniform(-b2, b2)),
    c2: rng.uniform(-b2, b2),
  };
}
const zeroLike = (p) => ({ W1: p.W1.map(() => 0), c1: p.c1.map(() => 0), w2: p.w2.map(() => 0), c2: 0 });
const clone = (p) => ({ W1: [...p.W1], c1: [...p.c1], w2: [...p.w2], c2: p.c2 });

export function net(p, u) {
  let o = p.c2;
  for (let k = 0; k < p.W1.length; k++) o += p.w2[k] * Math.tanh(p.W1[k] * u + p.c1[k]);
  return o;
}
/** d net / d u */
export function slope(p, u) {
  let g = 0;
  for (let k = 0; k < p.W1.length; k++) { const h = Math.tanh(p.W1[k] * u + p.c1[k]); g += p.w2[k] * (1 - h * h) * p.W1[k]; }
  return g;
}

function fwd(p, u) {
  const H = p.W1.length, h = new Array(H);
  let o = p.c2;
  for (let k = 0; k < H; k++) { h[k] = Math.tanh(p.W1[k] * u + p.c1[k]); o += p.w2[k] * h[k]; }
  return { h, o };
}
function bwd(p, u, h, gOut, G) {
  let du = 0;
  for (let k = 0; k < p.W1.length; k++) {
    const gh = gOut * p.w2[k] * (1 - h[k] * h[k]);
    if (G) { G.w2[k] += gOut * h[k]; G.W1[k] += gh * u; G.c1[k] += gh; }
    du += gh * p.W1[k];
  }
  if (G) G.c2 += gOut;
  return du;
}

function adam(lr, b1, b2 = 0.999) {
  const st = {};
  let t = 0;
  return (p, g) => {
    t++;
    const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
    for (const key of ["W1", "c1", "w2"]) {
      st[key] ??= { m: p[key].map(() => 0), v: p[key].map(() => 0) };
      const { m, v } = st[key];
      for (let i = 0; i < p[key].length; i++) {
        m[i] = b1 * m[i] + (1 - b1) * g[key][i];
        v[i] = b2 * v[i] + (1 - b2) * g[key][i] ** 2;
        p[key][i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8);
      }
    }
    st.c2 ??= { m: 0, v: 0 };
    st.c2.m = b1 * st.c2.m + (1 - b1) * g.c2;
    st.c2.v = b2 * st.c2.v + (1 - b2) * g.c2 ** 2;
    p.c2 -= lr * (st.c2.m / c1) / (Math.sqrt(st.c2.v / c2) + 1e-8);
  };
}

export const TARGETS = {
  bi: (r) => (r.next() < 0.5 ? r.normal(-2, 0.5) : r.normal(2, 0.5)),
  uni: (r) => r.normal(3, 0.6),
};

export const DEFAULTS = { target: "bi", N: 1000, H: 16, B: 64, lrG: 2e-3, lrD: 2e-3, beta1: 0.5, kD: 1, kG: 1, rounds: 3000, every: 25 };

/** Train, keeping a snapshot of both networks every `every` rounds; with
    kD or kG above 1 a snapshot is also kept between the halves. */
export function train(seed, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const rng = makeRng(seed);
  const sample = TARGETS[cfg.target];
  const real = Array.from({ length: cfg.N }, () => sample(rng));
  const G = mlp(rng, cfg.H), D = mlp(rng, cfg.H);
  const optG = adam(cfg.lrG, cfg.beta1), optD = adam(cfg.lrD, cfg.beta1);
  const B = cfg.B;
  const halves = cfg.kD > 1 || cfg.kG > 1;
  const snaps = [{ round: 0, half: "start", G: clone(G), D: clone(D), LD: NaN, LG: NaN }];
  let sumD = 0, sumG = 0, nD = 0, nG = 0;
  for (let r = 1; r <= cfg.rounds; r++) {
    for (let j = 0; j < cfg.kD; j++) {
      const gD = zeroLike(D);
      let L = 0;
      for (let i = 0; i < B; i++) {
        const xr = real[rng.int(0, cfg.N - 1)];
        const fr = fwd(D, xr), pr = sig(fr.o);
        bwd(D, xr, fr.h, (pr - 1) / B, gD);
        const xf = net(G, rng.normal());
        const ff = fwd(D, xf), pf = sig(ff.o);
        bwd(D, xf, ff.h, pf / B, gD);
        L -= Math.log(pr) + Math.log(1 - pf);
      }
      optD(D, gD);
      sumD += L / B; nD++;
    }
    if (halves && r % cfg.every === 0) snaps.push({ round: r, half: "D", G: clone(G), D: clone(D), LD: sumD / nD, LG: NaN });
    for (let j = 0; j < cfg.kG; j++) {
      const gG = zeroLike(G);
      let L = 0;
      for (let i = 0; i < B; i++) {
        const z = rng.normal();
        const fg = fwd(G, z);
        const ff = fwd(D, fg.o), pf = sig(ff.o);
        const dx = bwd(D, fg.o, ff.h, pf - 1, null);
        bwd(G, z, fg.h, dx / B, gG);
        L -= Math.log(pf);
      }
      optG(G, gG);
      sumG += L / B; nG++;
    }
    if (r % cfg.every === 0) {
      snaps.push({ round: r, half: "G", G: clone(G), D: clone(D), LD: sumD / nD, LG: sumG / nG });
      sumD = sumG = nD = nG = 0;
    }
  }
  return { cfg, real, snaps };
}
