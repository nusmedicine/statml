/* ============================================================================
   Seeded pseudo-random number generation.

   Every widget draws from a generator seeded by the `seed` parameter, and the
   generator is re-created before each render. Two consequences that matter for
   teaching:

     1. The same URL always produces the same picture. "Everyone look at the
        third bar" actually works, and a link you paste into a notebook in
        March shows the same thing in September.
     2. Changing `seed` is a first-class pedagogical move: it is how you show
        that a pattern is sampling noise rather than signal.

   mulberry32 — small, fast, good enough for teaching visuals (not crypto).
   ========================================================================= */

export function makeRng(seed = 1) {
  let a = (Math.floor(seed) >>> 0) || 0x9e3779b9;

  /** Uniform on [0, 1). */
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let spare = null;

  return {
    next,

    /** Uniform on [lo, hi). */
    uniform(lo = 0, hi = 1) {
      return lo + (hi - lo) * next();
    },

    /** Standard-normal via Box–Muller, caching the second variate. */
    normal(mu = 0, sigma = 1) {
      if (spare !== null) {
        const z = spare;
        spare = null;
        return mu + sigma * z;
      }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      const theta = 2 * Math.PI * v;
      spare = r * Math.sin(theta);
      return mu + sigma * (r * Math.cos(theta));
    },

    /** Exponential with the given rate. */
    exponential(rate = 1) {
      let u = 0;
      while (u === 0) u = next();
      return -Math.log(u) / rate;
    },

    bernoulli(p = 0.5) {
      return next() < p ? 1 : 0;
    },

    /** Uniform integer on [lo, hi]. */
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },

    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },

    /**
     * `len` draws with replacement from a collection of `len` items, returned as
     * INDICES.
     *
     * Indices and not values, because the entire content of a bootstrap resample
     * is *which* observations were picked: some appear twice, some not at all.
     * That is the mechanism rather than a detail of it, and a list of values has
     * already thrown away the identity the choreography needs in order to show a
     * duplicate as a duplicate rather than as a second observation.
     *
     * A method on the generator rather than the free `resample(arr, rng)` the
     * plan called for — it needs only a length, and every other draw in this file
     * is a method on the seeded stream.
     */
    resample(len) {
      const out = new Array(len);
      for (let i = 0; i < len; i += 1) out[i] = Math.floor(next() * len);
      return out;
    },
  };
}
