/* The Neural Network widget's engine, in its own module so the lab pages
 * import the SHIPPING code rather than a copy of it (5.8 — two copies of a
 * formula is how the halves of a figure come to disagree).
 *
 * A 2 -> k -> 1 network, seeded uniform init, full-batch gradient descent
 * with momentum. Measurements and the reliability table that set every
 * constant here are in _lab/mlp-design.py; main.js's header carries the
 * table itself.
 */

/* ---- the stage: widget 16's generators, shapes unchanged ---------------- */

export const N_PER_CLASS = 90;
export const DOM = [-2.6, 2.6];

export const SETS = {
  blobs: {
    label: "Two blobs",
    make(rng) {
      const out = [];
      for (const y of [-1, 1]) {
        const cx = y * 0.95;
        const cy = y * 0.8;
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          out.push({ x: [rng.normal(cx, 0.42), rng.normal(cy, 0.42)], y });
        }
      }
      return out;
    },
  },
  rings: {
    label: "Rings",
    make(rng) {
      const out = [];
      for (const [y, r] of [[-1, 0.75], [1, 1.72]]) {
        for (let i = 0; i < N_PER_CLASS; i += 1) {
          const t = rng.uniform(0, Math.PI * 2);
          out.push({
            x: [r * Math.cos(t) + rng.normal(0, 0.12), r * Math.sin(t) + rng.normal(0, 0.12)],
            y,
          });
        }
      }
      return out;
    },
  },
  moons: {
    label: "Crescents",
    /* the upper arc is +1, widget 16's own arrangement */
    make(rng) {
      const out = [];
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x: [1.25 * (Math.cos(t) - 0.5) + rng.normal(0, 0.11),
            1.25 * (Math.sin(t) - 0.25) + rng.normal(0, 0.11)],
          y: 1,
        });
      }
      for (let i = 0; i < N_PER_CLASS; i += 1) {
        const t = rng.uniform(0, Math.PI);
        out.push({
          x: [1.25 * (0.5 - Math.cos(t)) + rng.normal(0, 0.11),
            1.25 * (0.25 - Math.sin(t)) + rng.normal(0, 0.11)],
          y: -1,
        });
      }
      return out;
    },
  },
};

/* ---- the engine ---------------------------------------------------------- */

export const ACTS = {
  identity: { label: "Identity", f: (z) => z, df: () => 1 },
  relu: { label: "ReLU", f: (z) => Math.max(0, z), df: (z) => (z > 0 ? 1 : 0) },
  tanh: { label: "tanh", f: Math.tanh, df: (z) => 1 - Math.tanh(z) ** 2 },
};

export const K_LADDER = [1, 2, 3, 4, 8];
export const EPOCHS = 600;
export const LR = 0.05;
export const MOMENTUM = 0.9;

export function initNet(k, rng) {
  const r1 = 1 / Math.sqrt(2);
  const r2 = 1 / Math.sqrt(k);
  const W1 = [];
  const b1 = [];
  const W2 = [];
  for (let j = 0; j < k; j += 1) {
    W1.push([rng.uniform(-r1, r1), rng.uniform(-r1, r1)]);
    b1.push(rng.uniform(-r1, r1));
    W2.push(rng.uniform(-r2, r2));
  }
  return { W1, b1, W2, b2: rng.uniform(-r2, r2) };
}

const cloneNet = (p) => ({
  W1: p.W1.map((w) => w.slice()), b1: p.b1.slice(), W2: p.W2.slice(), b2: p.b2,
});

/** The network's score at one point: positive predicts the +1 class. */
export function score(p, f, x0, x1) {
  let z = p.b2;
  for (let j = 0; j < p.W2.length; j += 1) {
    z += p.W2[j] * f(p.W1[j][0] * x0 + p.W1[j][1] * x1 + p.b1[j]);
  }
  return z;
}

/**
 * Train, keeping every epoch's weights. The trajectory is the animation's
 * data — nothing is trained per frame (1.4).
 */
export function trainAll(data, k, actKey, rng) {
  const { f, df } = ACTS[actKey];
  const p = initNet(k, rng);
  const v = {
    W1: p.W1.map(() => [0, 0]), b1: p.b1.map(() => 0), W2: p.W2.map(() => 0), b2: 0,
  };
  const n = data.length;
  const frames = [cloneNet(p)];
  const losses = [];
  const errors = [];
  const live = [];

  const measure = (net) => {
    let wrong = 0;
    const fires = new Array(k).fill(0);
    for (const s of data) {
      if ((score(net, f, s.x[0], s.x[1]) > 0) !== (s.y > 0)) wrong += 1;
      for (let j = 0; j < k; j += 1) {
        if (net.W1[j][0] * s.x[0] + net.W1[j][1] * s.x[1] + net.b1[j] > 0) fires[j] += 1;
      }
    }
    return { wrong, fires };
  };
  let m = measure(p);
  errors.push(m.wrong);
  live.push(m.fires);

  for (let ep = 1; ep <= EPOCHS; ep += 1) {
    const gW1 = p.W1.map(() => [0, 0]);
    const gb1 = p.b1.map(() => 0);
    const gW2 = p.W2.map(() => 0);
    let gb2 = 0;
    let loss = 0;
    for (const s of data) {
      const y = s.y > 0 ? 1 : 0;
      const z1 = [];
      const h = [];
      let z2 = p.b2;
      for (let j = 0; j < k; j += 1) {
        const z = p.W1[j][0] * s.x[0] + p.W1[j][1] * s.x[1] + p.b1[j];
        z1.push(z);
        const hv = f(z);
        h.push(hv);
        z2 += p.W2[j] * hv;
      }
      const out = 1 / (1 + Math.exp(-z2));
      loss += -(y * Math.log(out + 1e-12) + (1 - y) * Math.log(1 - out + 1e-12));
      const d2 = (out - y) / n;
      gb2 += d2;
      for (let j = 0; j < k; j += 1) {
        gW2[j] += d2 * h[j];
        const d1 = d2 * p.W2[j] * df(z1[j]);
        gW1[j][0] += d1 * s.x[0];
        gW1[j][1] += d1 * s.x[1];
        gb1[j] += d1;
      }
    }
    losses.push(loss / n);
    for (let j = 0; j < k; j += 1) {
      v.W1[j][0] = MOMENTUM * v.W1[j][0] - LR * gW1[j][0];
      v.W1[j][1] = MOMENTUM * v.W1[j][1] - LR * gW1[j][1];
      v.b1[j] = MOMENTUM * v.b1[j] - LR * gb1[j];
      v.W2[j] = MOMENTUM * v.W2[j] - LR * gW2[j];
      p.W1[j][0] += v.W1[j][0];
      p.W1[j][1] += v.W1[j][1];
      p.b1[j] += v.b1[j];
      p.W2[j] += v.W2[j];
    }
    v.b2 = MOMENTUM * v.b2 - LR * gb2;
    p.b2 += v.b2;

    frames.push(cloneNet(p));
    m = measure(p);
    errors.push(m.wrong);
    live.push(m.fires);
  }
  /* the loss at the final weights, so every epoch index has one */
  losses.push(losses[losses.length - 1]);
  return { frames, losses, errors, live };
}

/* DEADNESS IS A ReLU PHENOMENON AND NOTHING ELSE. A ReLU unit whose input is
   negative on every sample outputs zero on every sample, so it contributes
   nothing and its gradient is zero — it cannot recover. An identity or tanh
   unit is never silent: tanh(z) and z are non-zero for z < 0, so the same
   count would be a fact about a sign rather than about contribution. A state
   sweep caught this claiming "7 of 8 live" under Identity, which was false.
   This is the ONE place the rule lives (5.8). */
export const deadUnits = (fires, actKey) =>
  (actKey === "relu" ? fires.map((c) => c === 0) : fires.map(() => false));

/** Hidden unit j switches on across this line: w·x + b = 0. Under ReLU it is
    exactly the crease the unit contributes to the boundary. */
export function unitLine(net, j) {
  return { a: net.W1[j][0], b: net.W1[j][1], c: net.b1[j] };
}
