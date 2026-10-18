/* Widget 108's engine: a 1-D GAN trained as 10-3b c42's pseudocode. Each
   round updates D on a batch of real and generated samples, then G on fresh
   noise with the non-saturating loss L_G = -log D(G(z)). G and D are
   1 → 16 → 1 tanh MLPs initialised as torch's nn.Linear, trained by Adam
   (β1 = 0.5, learning rate 0.002 for both). Everything is drawn from the one
   seeded rng, so a seed is one run.

   kD and kG are the steps each half takes in a round: 1 and 1 is the
   notebook's loop; the widget runs 20 and 20 (SCHEDULE, his call 2,
   2026-10-19) so that one press shows one half alone. Measured over 40 seeds
   (`_lab/gan-measure.mjs`, catalogue § 108 MEASURED AND MOCKED): both
   schedules end alike, near the data with no collapse. The mock and the
   measurement import this file through `_lab/gan-engine.js`. */

import { makeRng } from "../core/rng.js";

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

const TARGETS = {
  bi: (r) => (r.next() < 0.5 ? r.normal(-2, 0.5) : r.normal(2, 0.5)),
  uni: (r) => r.normal(3, 0.6),
};

/** the widget's schedule: 150 rounds of 20 D steps then 20 G steps, a snapshot after each half */
export const SCHEDULE = { kD: 20, kG: 20, rounds: 150, every: 1 };

const DEFAULTS = { target: "bi", N: 1000, H: 16, B: 64, lrG: 2e-3, lrD: 2e-3, beta1: 0.5, kD: 1, kG: 1, rounds: 3000, every: 25 };

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

/** the standard normal quantile (Acklam's rational approximation, |error| < 1.2e-9):
    the widget draws G at evenly spaced quantiles of z, so its picture needs no draws */
export function normalQuantile(q) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const tail = (r) => (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  if (q < 0.02425) return tail(Math.sqrt(-2 * Math.log(q)));
  if (q > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - q)));
  const r = q - 0.5, t = r * r;
  return (((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * r / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}
