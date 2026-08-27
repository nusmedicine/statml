/* ============================================================================
   Widget 11 · Probability Distributions

   A distribution is chosen by knowing the process, not by looking at the
   histogram — the shape cannot be consulted until the data is already in, by
   which point the choice has been made by whatever function got typed. So the
   widget is a decision tree with eight endings, and each ending is a mechanism
   you can watch and a set of R calls you can read.

   TWO TABS, because there are two different jobs:

     Distributions   which one is my data, and what does that process look like
     R code          what d, p, q and r each return, as the question each asks

   THE WHOLE TREE IS ON SCREEN FROM THE FIRST CLICK, dimmed, with the path
   lighting up as it is walked. A breadcrumb says where you have been; the tree
   says where you are, what the alternatives were, and that there are exactly
   eight endings. That is what stops the flow feeling abstract, and it doubles
   as a revision map once the names have been met.

   IT IS CLICKED ON THE CANVAS, which no widget here had done before. No core
   change was needed: `defineWidget` returns `setParam`, so the module attaches
   its own listener and the tree's boxes are hit-tested against the layout the
   draw pass already computed. `node` stays a real parameter, so the URL carries
   the path and a shared link lands on the same place.

   NORMAL AGAINST LOG-NORMAL is settled by a test that needs no data — could the
   biggest plausible value be TEN TIMES the smallest? Measured on the candidates,
   99th percentile over 1st:

     serum sodium N(140, 2.5)      1.1x  |
     adult height N(160, 10)       1.3x  |  everything normal sits at 1-2x
     birthweight  N(3.2, 0.5)      2.1x  |
     ALT    lognormal(3.1, 0.55)  12.9x  |
     CRP    lognormal(1, 1)      104.9x  |  everything log-normal is 10x+

   Sodium is the case that makes the rule rather than the exception to it: being
   a lab value settles nothing, and an earlier draft that paired birthweight
   against CRP gave a reader no way to tell which was which.
   ========================================================================= */

import {
  defineWidget, makePlot, createPile, niceTicks, fmt, lgamma, nbPmf,
} from "../core/index.js";

/* `tokens.css` has --font-mono but `readTokens` does not carry it — no widget
   before this one printed code. Named once, because the R-code tab measures its
   own value column and has to measure in the stack it draws with. */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const DRAWS = 200;
const STRIP_H = 104;          // the mechanism, once a distribution is chosen
const PATH_H = 34;            // the collapsed tree, once it has been walked

/* --- maths the collection did not already have --------------------------- */

const SQ2PI = Math.sqrt(2 * Math.PI);
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

/* Abramowitz & Stegun 7.1.26. Every widget before this one wanted a density or
   a t tail and never the normal integral. */
function erf(x) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t
      + 0.254829592) * t;
  return s * (1 - poly * Math.exp(-a * a));
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/* Acklam's inverse normal CDF. A bisection over the CDF would do for the normal
   alone; the log-normal needs it too and the tails are where it would be
   slowest, so the closed form earns its twenty constants. */
function probit(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lim = 0.02425;
  if (p < lim) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lim) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/* --- draws --------------------------------------------------------------- */

function poisDraw(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k += 1; p *= rng.next(); } while (p > L);
  return k - 1;
}

/* Marsaglia-Tsang. The negative binomial is drawn AS a gamma-mixed Poisson
   rather than from its pmf, because the mixing rate is the one thing its panel
   exists to show and `nbDraw` would hand back the count with the mechanism
   thrown away. */
function gammaDraw(rng, shape, scale) {
  if (shape < 1) return gammaDraw(rng, shape + 1, scale) * Math.pow(rng.next(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const z = rng.normal();
    const v = (1 + c * z) ** 3;
    if (v <= 0) continue;
    if (Math.log(rng.next()) < 0.5 * z * z + d - d * v + d * Math.log(v)) return d * v * scale;
  }
}

/** Uniform event times in one window, sorted. */
function eventTimes(rng, rate) {
  const n = poisDraw(rng, rate);
  return Array.from({ length: n }, () => rng.next()).sort((a, b) => a - b);
}

/* WHERE THE TARGETS SIT IN THE POOL. Generated once for the largest number of
   targets the slider allows and sliced to the current count, so raising K adds
   targets without moving the ones already there — a pool that reshuffled on
   every notch would look like a different pool rather than a fuller one. */
const POOL_N = 1000;
const TARGET_POS = (() => {
  let a = 4242 >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seen = new Set();
  const out = [];
  /* Enough positions that the smallest pool still has targets to spare after
     filtering, and drawn across the LARGEST pool so shrinking it removes the
     ones off the end rather than reshuffling the rest. */
  while (out.length < 400) {
    const c = Math.floor(next() * POOL_N);
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
})();

/* --- the eight distributions --------------------------------------------- *
 * Each is a BUILDER over its own parameters rather than a frozen table. The
 * first version pinned every number — size 10, lambda 5, sd 0.5 — so a student
 * could watch eight processes and never ask what happens when one of them
 * changes, which is the question the sliders exist to answer. `make` returns
 * everything the figure, the mechanism and the R calls need.
 *
 * `pars` names which sliders belong to it; the params block declares one per
 * entry, gated on `dist`, so only the relevant two or three are ever on screen.
 */

const D = {
  binom: {
    name: "Binomial", plural: "sets of trials", disc: true, prefix: "binom",
    counts: "successes in a fixed number of trials",
    example: "trials that each succeed with the same chance — free throws, treated patients, screened cells",
    pars: ["bn", "bp"],
    mech: "attempts",
    make: (v) => {
      const n = v.bn;
      const p = v.bp;
      return {
        n, p,
        args: `size = ${n}, prob = ${p}`,
        axis: `Successes in ${n} trials`, unit: "successes",
        bins: n + 1, lo: -0.5, width: 1,
        story: `one set of ${n} trials, each with the same chance of success`,
        pmf: (k) => Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)),
        draw: (rng) => {
          const hits = Array.from({ length: n }, () => rng.next() < p);
          return { hits, value: hits.filter(Boolean).length };
        },
      };
    },
  },

  hyper: {
    name: "Hypergeometric", plural: "draws", disc: true, prefix: "hyper",
    counts: "targets found when you draw from a pool without replacement",
    example: "drawing from a finite pool that empties as you go — plots, genes, patients",
    pars: ["hN", "hK", "hpct"],
    mech: "pool",
    make: (v) => {
      const N = Number(v.hN);
      const K = Math.min(v.hK, N - 1);
      /* THE DRAW IS A FRACTION, not a count. What decides whether sampling
         without replacement differs from sampling with it is the SHARE of the
         pool taken, and a slider reading "50" says nothing about that until you
         have also read the pool size. This one reads 25% and means it. */
      const k = Math.max(1, Math.round((N * v.hpct) / 100));
      const targets = TARGET_POS.filter((c) => c < N).slice(0, K);
      const targetSet = new Set(targets);
      const others = [];
      for (let i = 0; i < N; i += 1) if (!targetSet.has(i)) others.push(i);
      return {
        N, K, k, targetSet,
        args: `m = ${K}, n = ${N - K}, k = ${k}`,
        axis: `Targets found in ${k} draws`, unit: "targets",
        bins: Math.min(41, K + 1), lo: -0.5, width: 1,
        story: `a pool of ${N} — ${K} are targets — draw ${k} (${v.hpct}%), without replacement`,
        pmf: (x) => (x > K || k - x > N - K ? 0
          : Math.exp(lchoose(K, x) + lchoose(N - K, k - x) - lchoose(N, k))),
        draw: (rng) => {
          const good = rng.shuffle(targets);
          const bad = rng.shuffle(others);
          let left = N;
          let remaining = K;
          let gi = 0;
          let bi = 0;
          const steps = [];
          for (let i = 0; i < k; i += 1) {
            const hit = rng.next() < remaining / left;
            // the state BEFORE this draw: what "P(next)" meant when it was taken
            steps.push({ hit, left, good: remaining, cell: hit ? good[gi++] : bad[bi++] });
            if (hit) remaining -= 1;
            left -= 1;
          }
          return { steps, value: steps.filter((st) => st.hit).length };
        },
      };
    },
  },

  pois: {
    name: "Poisson", plural: "windows", disc: true, prefix: "pois",
    counts: "events in one window, with no ceiling",
    example: "a steady rate per window — arrivals in an hour, mutations per megabase",
    pars: ["plam"],
    mech: "window",
    make: (v) => {
      const lambda = v.plam;
      return {
        rate: lambda,
        args: `lambda = ${lambda}`,
        axis: "Events in one window", unit: "events",
        bins: Math.max(16, Math.ceil(lambda + 5 * Math.sqrt(lambda)) + 2), lo: -0.5, width: 1,
        story: "one window — a rate that never changes",
        pmf: (k) => Math.exp(-lambda + k * Math.log(lambda) - lgamma(k + 1)),
        draw: (rng) => {
          const times = eventTimes(rng, lambda);
          return { times, rate: lambda, value: times.length };
        },
      };
    },
  },

  nbin: {
    name: "Negative binomial", plural: "windows", disc: true, prefix: "nbinom",
    counts: "events in one window when the rate itself varies",
    example: "windows that run hotter and colder — counts across biological replicates",
    pars: ["nbmu", "nbsize"],
    mech: "window", varies: true,
    make: (v) => {
      const mu = v.nbmu;
      const size = v.nbsize;
      const variance = mu + (mu * mu) / size;
      return {
        mu, size,
        args: `size = ${size}, mu = ${mu}`,
        axis: "Events in one window", unit: "events",
        bins: Math.max(20, Math.ceil(mu + 4 * Math.sqrt(variance)) + 2), lo: -0.5, width: 1,
        story: "one window — the rate is redrawn first",
        pmf: (k) => nbPmf(k, size, mu),
        draw: (rng) => {
          const rate = gammaDraw(rng, size, mu / size);
          const times = eventTimes(rng, rate);
          return { times, rate, value: times.length };
        },
      };
    },
  },

  norm: {
    name: "Normal", plural: "measurements", cont: true, prefix: "norm",
    counts: "a quantity many small effects ADD to",
    example: "height, birthweight, blood pressure, serum sodium",
    pars: ["nmean", "nsd"],
    mech: "measure",
    make: (v) => {
      const mean = v.nmean;
      const sd = v.nsd;
      return {
        args: `mean = ${mean}, sd = ${sd}`,
        axis: "Measured value", unit: "", dens: "per unit", noun: "value",
        bins: 30, lo: mean - 3 * sd, width: (6 * sd) / 30, tick: niceStep(6 * sd),
        story: "one measurement — no events to count, just a number",
        pdf: (x) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * SQ2PI),
        cdf: (x) => Phi((x - mean) / sd),
        quant: (q) => mean + sd * probit(q),
        draw: (rng) => ({ value: rng.normal(mean, sd) }),
      };
    },
  },

  lnorm: {
    name: "Log-normal", plural: "measurements", cont: true, prefix: "lnorm",
    counts: "a quantity many small effects MULTIPLY",
    example: "CRP, viral load, ALT — a few values many times the rest",
    pars: ["lmed", "lsd"],
    mech: "measure",
    make: (v) => {
      const meanlog = Math.log(v.lmed);
      const sdlog = v.lsd;
      const hi = Math.exp(meanlog + 3 * sdlog);
      return {
        /* `meanlog = log(3)` RATHER THAN `meanlog = 1.10`. R's parameter is the
           mean of the LOGS, and the slider is the median because that is the
           number a reader can picture — but printing the two forms side by side,
           a slider saying 3 above a call saying 1.10, just looks like the widget
           losing track. Written as the log of the slider's own value it is
           valid R, it runs, and it says where the number came from. */
        args: `meanlog = log(${v.lmed}), sdlog = ${sdlog}`,
        axis: "Measured value", unit: "", dens: "per unit", noun: "value",
        bins: 30, lo: 0, width: hi / 30, tick: niceStep(hi),
        story: "one measurement — no events to count, just a number",
        pdf: (x) => (x <= 0 ? 0
          : Math.exp(-((Math.log(x) - meanlog) ** 2) / (2 * sdlog ** 2)) / (x * sdlog * SQ2PI)),
        cdf: (x) => (x <= 0 ? 0 : Phi((Math.log(x) - meanlog) / sdlog)),
        quant: (q) => Math.exp(meanlog + sdlog * probit(q)),
        draw: (rng) => ({ value: Math.exp(rng.normal(meanlog, sdlog)) }),
      };
    },
  },

  exp: {
    name: "Exponential", plural: "gaps", cont: true, prefix: "exp",
    counts: "the waiting time until the next event, when the rate is steady",
    example: "the gap between events — time to relapse, to failure",
    pars: ["erate"],
    mech: "gap",
    make: (v) => {
      const rate = v.erate;
      const hi = 5 / rate;
      return {
        rate,
        args: `rate = ${rate}`,
        axis: "Windows until the next event", unit: "windows", dens: "per window", noun: "waiting time",
        bins: 30, lo: 0, width: hi / 30, tick: niceStep(hi),
        story: "the same window — now measuring the gap, not the count",
        pdf: (x) => (x < 0 ? 0 : rate * Math.exp(-rate * x)),
        cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-rate * x)),
        quant: (q) => -Math.log(1 - q) / rate,
        draw: (rng) => {
          const times = eventTimes(rng, rate);
          return { times, rate, gap: rng.exponential(rate), value: rng.exponential(rate) };
        },
      };
    },
  },

  unif: {
    name: "Uniform", plural: "values", cont: true, prefix: "unif",
    counts: "any value in a range, all equally likely",
    example: "a p-value when the null is true — no value favoured over another",
    pars: ["umax"],
    mech: "measure",
    make: (v) => {
      const hi = v.umax;
      return {
        args: `min = 0, max = ${hi}`,
        axis: "Measured value", unit: "", dens: "per unit", noun: "value",
        bins: 30, lo: 0, width: hi / 30, tick: niceStep(hi),
        /* NARROWING THE RANGE DRIVES THE DENSITY ABOVE 1, because it is 1/max.
           That is the cleanest demonstration in the widget that a density is not
           a probability, and it is one slider away. */
        story: `one value — anywhere from 0 to ${hi}, all equally likely`,
        pdf: (x) => (x >= 0 && x <= hi ? 1 / hi : 0),
        cdf: (x) => Math.max(0, Math.min(1, x / hi)),
        quant: (q) => q * hi,
        draw: (rng) => ({ value: rng.next() * hi }),
      };
    },
  },
};

/* EVERY PER-DISTRIBUTION SLIDER, DERIVED FROM THE TABLE ITSELF rather than
   listed again. The hand-written list drifted the moment `hk` was renamed
   `hpct` and `hN` was added — those two sliders then stayed on the Map view
   because nothing was looking for them, which is the whole reason principle 5.8
   says one formula lives in one place. */
const PAR_NAMES = [...new Set(Object.values(D).flatMap((d) => d.pars))];

/** A tick step that lands on 1, 2 or 5 times a power of ten. Every continuous
    axis now moves with its parameters, so a fixed step would print eleven
    labels on one setting and two on the next. */
function niceStep(span) {
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

/** The live spec for the chosen distribution: its static description merged
    with whatever its sliders currently say. */
function build(key, values) {
  const base = D[key];
  return { key, name: base.name, plural: base.plural, disc: base.disc, cont: base.cont,
    prefix: base.prefix, counts: base.counts, example: base.example, mech: base.mech,
    varies: base.varies, ...base.make(values) };
}

/* --- the tree ------------------------------------------------------------ *
 * Labels are short because a tree crowded with examples is unreadable at the
 * size it renders; the question below it carries one line of help and the
 * nameplate carries the rest.                                               */

const ROOT = {
  id: "root",
  q: "Is your data discrete or continuous?",
  hint: "The fork that decides what kind of answer R gives back.",
  kids: [
    {
      id: "count", label: "Discrete — counting",
      q: "Is there a maximum possible count?",
      hint: "A fixed number of tries puts a ceiling on the answer. A window of time or space does not.",
      kids: [
        {
          id: "cap", label: "Has a maximum",
          q: "Does every try have the same chance?",
          hint: "Or does taking one change the odds for the next?",
          kids: [
            { id: "b1", label: "Same chance", leaf: "binom" },
            { id: "b2", label: "Odds change as you go", leaf: "hyper" },
          ],
        },
        {
          id: "nocap", label: "No maximum",
          q: "Is the average rate the same in every window?",
          hint: "Or do some windows simply run hotter than others?",
          kids: [
            { id: "p1", label: "Same rate everywhere", leaf: "pois" },
            { id: "p2", label: "Rate varies", leaf: "nbin" },
          ],
        },
      ],
    },
    {
      id: "meas", label: "Continuous — measuring",
      q: "What kind of measurement?",
      hint: "Three shapes cover almost everything continuous you will meet.",
      kids: [
        {
          id: "qty", label: "A quantity",
          q: "Could the biggest plausible value be ten times the smallest?",
          hint: "Answerable about the quantity itself, with no data. Serum sodium spans 1.1×; CRP spans 105×.",
          kids: [
            { id: "n1", label: "No — within about 2×", leaf: "norm" },
            { id: "n2", label: "Yes — a few far bigger", leaf: "lnorm" },
          ],
        },
        { id: "wait", label: "A waiting time", leaf: "exp" },
        { id: "flat", label: "All values equally likely", leaf: "unif" },
      ],
    },
  ],
};

/* Tidy layout: leaves take consecutive rows, a parent sits at the mean of its
   children. Computed once — the tree never changes shape. */
const NODES = new Map([["root", ROOT]]);
(function layout() {
  let row = 0;
  const walk = (n, depth, parent) => {
    n.depth = depth;
    n.parent = parent;
    NODES.set(n.id, n);
    if (n.leaf) { n.row = row++; return; }
    n.kids.forEach((k) => walk(k, depth + 1, n));
    n.row = (n.kids[0].row + n.kids[n.kids.length - 1].row) / 2;
  };
  ROOT.kids.forEach((k) => walk(k, 0, null));
})();
const LEAF_IDS = [...NODES.values()].filter((n) => n.leaf).map((n) => n.id);
const ancestry = (n) => {
  const out = [];
  for (let a = n; a; a = a.parent) out.unshift(a.id);
  return out;
};

/* --- reading a distribution ---------------------------------------------- *
 * The cursor is a QUANTILE and x follows from it, for three reasons in the
 * order they mattered: x has a different range in every distribution and a
 * slider's bounds cannot depend on another parameter; the control then performs
 * `q` rather than illustrating it; and it puts the discrete-q overshoot on the
 * control — ask 0.50 of the binomial and x = 7, whose cumulative is 0.617.   */
function readAt(dd, prob) {
  if (dd.cont) {
    const x = dd.quant(prob);
    return { x, d: dd.pdf(x), p: dd.cdf(x) };
  }
  const top = dd.bins - 1;
  let acc = 0;
  for (let k = 0; k <= top; k += 1) {
    acc += dd.pmf(k);
    // R's definition: the smallest x whose cumulative reaches q. It overshoots,
    // which is the whole reason the cumulative is printed beside it.
    if (acc >= prob - 1e-12) return { x: k, d: dd.pmf(k), p: acc };
  }
  return { x: top, d: dd.pmf(top), p: 1 };
}
const cdfAt = (dd, x) => {
  if (dd.cont) return dd.cdf(x);
  let acc = 0;
  for (let k = 0; k <= x; k += 1) acc += dd.pmf(k);
  return acc;
};

const SPEEDS = {
  slow: { ms: 1400, choreograph: true },
  brisk: { ms: 520, choreograph: true },
  fast: { ms: 26, choreograph: false },
};
const DROP_FRACTION = 0.28;

/* Hit boxes for the tree, refreshed by every draw pass and read by the click
   handler at the bottom of this file. */
const host = document.getElementById("widget");
let hits = [];
let logicalW = 780;
/* WHERE THE TREE WALK HAS GOT TO, and deliberately not a parameter. Which
   question is on screen mid-walk is transient — nobody shares a half-walked
   tree — so only the landing goes in the URL. */
let cursor = ROOT;

/* The last `dist` the tree cursor was reconciled to. `cursor` and `dist` are
   genuinely independent — you can have chosen the binomial and be browsing the
   continuous branch — so the cursor must NOT track `dist` on every paint, or
   clicking an internal node would snap straight back. It follows only when
   `dist` changes from OUTSIDE the tree: the select, or an R-code chip.

   DECLARED HERE, WITH THE REST OF THE MODULE STATE. Put below `defineWidget`,
   which calls `draw` while it is still initialising, it was a temporal dead zone
   that threw on the first paint and left the canvas blank. */
let lastDist = null;

const handle = defineWidget({
  slug: "probability-mechanisms",
  title: "Probability Distributions",
  subtitle:
    "Common distributions are chosen by the process that generates the " +
    "measurement, not the shape of the data; R's d, p, q and r functions " +
    "compute each one's density, cumulative probability, quantiles and draws.",
  layout: "side",

  /* Taller once a distribution is chosen, because the tree collapses to its
     path and a mechanism and a pile appear underneath it. */
  /* Each view is sized to what it holds. The map was cramped at 372: eight
     rows in 302px left 8px between boxes, which reads as a squeezed list
     rather than a tree. */
  height: (values) => (values.view === "map" ? 438 : values.view === "code" ? 520 : 536),

  params: {
    /* THREE VIEWS, NOT TWO TABS AND A BREADCRUMB. The first build carried a
       "Where you are" select listing all fourteen tree nodes with arrows in the
       labels, which read as debug output and was the only way back to the map.
       Naming the map as a place you can go is the whole workflow: try a
       distribution, press Map, try another. */
    view: {
      type: "segmented",
      label: "Show",
      options: [
        { value: "map", label: "Map", detail: "the decision tree — which distribution is my data" },
        { value: "dist", label: "Distribution", detail: "the process, one draw at a time" },
        { value: "code", label: "R code", detail: "what d, p, q and r each return" },
      ],
      default: "map",
      display: true,
    },

    /* THE LANDING, and the only tree state worth putting in a URL. Which
       question is on screen mid-walk is transient — nobody shares a half-walked
       tree — so the cursor lives in a module variable.

       HIDDEN, because the control for it is the row of eight chips drawn on the
       canvas. It was a `select` and it read badly: on a view with nothing chosen
       it said "— not chosen —" above a figure telling you to go to the Map,
       which is two controls disagreeing about who is in charge. The chips are
       the same picker the R code view already had, so both figure views are
       chosen from the same way. The cost is that the eight names are no longer
       reachable by keyboard; the readout still names what is chosen. */
    dist: { type: "select", hidden: true,
      options: ["none", ...Object.keys(D)], default: "none" },

    /* ONE BLOCK PER DISTRIBUTION, each gated on `dist` — only the two or three
       that belong to the chosen one are ever on screen. This is what `dist`
       being a single flat parameter buys: `when: { equals }` needs one
       condition, where a tree-node parameter would have needed two. */
    bn: { type: "int", label: "trials", min: 2, max: 20, default: 10,
      when: { param: "dist", equals: "binom" } },
    bp: { type: "float", label: "chance of success", min: 0.05, max: 0.95, step: 0.05, default: 0.7,
      format: (v) => v.toFixed(2), when: { param: "dist", equals: "binom" } },

    /* STRING VALUES, not numbers. `params.js` matches a URL parameter against
       the option keys with `includes`, which is strict equality — so numeric
       option values made `?hN=1000` fall back to the default without a word,
       and two pool sizes produced identical figures. */
    hN: { type: "choice", label: "pool size",
      options: [{ value: "100", label: "100" }, { value: "200", label: "200" },
        { value: "500", label: "500" }, { value: "1000", label: "1000" }],
      default: "200", when: { param: "dist", equals: "hyper" } },
    hK: { type: "int", label: "targets in the pool", min: 2, max: 40, default: 10,
      when: { param: "dist", equals: "hyper" } },
    hpct: { type: "int", label: "how much of the pool you draw", min: 5, max: 60, default: 25,
      format: (v) => `${v}%`,
      detail: "take a big share and the chance moves fast; take a sliver and it barely moves",
      when: { param: "dist", equals: "hyper" } },

    plam: { type: "float", label: "rate per window", min: 0.5, max: 20, step: 0.5, default: 5,
      format: (v) => String(v), when: { param: "dist", equals: "pois" } },

    nbmu: { type: "float", label: "mean per window", min: 1, max: 15, step: 0.5, default: 5,
      format: (v) => String(v), when: { param: "dist", equals: "nbin" } },
    nbsize: { type: "float", label: "size", min: 0.5, max: 30, step: 0.5, default: 2,
      format: (v) => String(v),
      detail: "LARGER size means LESS extra spread — at the top it is a Poisson",
      when: { param: "dist", equals: "nbin" } },

    nmean: { type: "float", label: "mean", min: 0, max: 200, step: 1, default: 100,
      format: (v) => String(v), when: { param: "dist", equals: "norm" } },
    nsd: { type: "float", label: "sd", min: 1, max: 40, step: 1, default: 15,
      format: (v) => String(v), when: { param: "dist", equals: "norm" } },

    lmed: { type: "float", label: "median", min: 1, max: 50, step: 1, default: 3,
      format: (v) => String(v),
      detail: "R takes the mean of the logs, so this appears as meanlog = log(median)",
      when: { param: "dist", equals: "lnorm" } },
    lsd: { type: "float", label: "sdlog", min: 0.1, max: 1.5, step: 0.1, default: 1,
      format: (v) => v.toFixed(1),
      detail: "how far the multiplying effects spread it — 0.1 is nearly a normal",
      when: { param: "dist", equals: "lnorm" } },

    erate: { type: "float", label: "rate per window", min: 0.5, max: 20, step: 0.5, default: 5,
      format: (v) => String(v),
      /* The rate and the mean are RECIPROCALS, and the readout below prints the
         mean — so a rate of 5 sitting above a mean of 0.2 looks like the widget
         disagreeing with its own slider until somebody says why. */
      detail: "events per window — so the mean gap is 1/rate",
      when: { param: "dist", equals: "exp" } },

    umax: { type: "float", label: "top of the range", min: 0.2, max: 5, step: 0.1, default: 1,
      format: (v) => v.toFixed(1),
      detail: "the density is 1/this — narrow it and it goes above 1",
      when: { param: "dist", equals: "unif" } },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "one at a time", detail: "every stage of a draw, slowly" },
        { value: "brisk", label: "brisk", detail: "every stage of a draw" },
        { value: "fast", label: "fast", detail: "arrivals only — the process is not drawn" },
      ],
      default: "brisk",
      display: true,
      when: { param: "view", equals: "dist" },
    },

    seed: {
      type: "int", label: "Seed", min: 1, max: 200, default: 1,
      when: { param: "view", equals: "dist" },
    },

    prob: {
      type: "float",
      label: "q",
      min: 0.01, max: 0.99, step: 0.01, default: 0.95,
      format: (v) => v.toFixed(2),
      detail: "the quantile asked for — x is what q returns",
      when: { param: "view", equals: "code" },
      display: true,
    },

    theory: {
      type: "bool", label: "Show the distribution", default: true, display: true,
      when: { param: "view", equals: "dist" },
    },

    shown: { type: "int", min: 0, max: DRAWS, default: 0, hidden: true },
  },

  legend: [
    { token: "empirical", label: "draws so far", mark: "bar" },
    { token: "theory", label: "the distribution", mark: "line" },
    { token: "highlight", label: "this draw", mark: "dot" },
  ],

  compute: ({ params, rng }) => {
    const key = params.dist === "none" ? null : params.dist;
    if (!key) return { key: null, dd: null, draws: [] };
    const dd = build(key, params);
    return { key, dd, draws: Array.from({ length: DRAWS }, () => dd.draw(rng)) };
  },

  animation: {
    stepLabel: {
      param: "dist",
      labels: {
        binom: "One set", hyper: "One draw", pois: "One window",
        nbin: "One window", norm: "One value", lnorm: "One value",
        exp: "One gap", unif: "One value",
      },
      default: "Draw one",
    },
    runLabel: "Play",
    runTitle: "Keep drawing at the chosen speed",

    init: ({ params, state, fromScratch }) => {
      const dd = state.dd;
      if (!dd) return { i: 0, t: 0, pile: null, done: false };
      const pile = createPile({ bins: dd.bins, lo: dd.lo, width: dd.width });
      const anim = { i: 0, t: 0, pile, done: false };
      if (!fromScratch) {
        for (let k = 0; k < Math.min(params.shown, DRAWS); k += 1) {
          pile.push(state.draws[k].value);
          anim.i += 1;
        }
        pile.clearFlash();
      }
      /* Core reads `done` to relabel run as Replay and to disable step. Left for
         the first `advance` to discover, a ?shown=200 link arrived with a full
         pile and a button still saying Play — which then threw the pile away. */
      anim.done = anim.i >= DRAWS;
      return anim;
    },

    advance: (anim, { dt, params, state }) => {
      if (!state.dd || anim.i >= DRAWS) { anim.done = true; return false; }
      const pace = SPEEDS[params.speed];
      anim.pile.tick(dt);

      /* Fast does not draw the process at all, and that is a declared property
         of the speed rather than something the animation decides part way
         through: choreographing a fifty-plot survey at 26ms would show a blur
         and call it a mechanism. */
      if (!pace.choreograph) {
        anim.pile.push(state.draws[anim.i].value);
        anim.i += 1;
        anim.t = 0;
        return anim.mode === "run" ? anim.i < DRAWS : false;
      }

      anim.t += dt;
      if (anim.t < pace.ms) return true;
      anim.pile.push(state.draws[anim.i].value);
      anim.i += 1;
      anim.t = 0;
      return anim.mode === "run" ? anim.i < DRAWS : false;
    },

    rebuild: () => {},
  },

  draw: (ctx0) => {
    const { ctx, colors, w, h, params, state, anim } = ctx0;
    logicalW = w;
    hits = [];

    syncChrome(params, state);

    if (params.view === "map") { drawTree(ctx, colors, w, h); return; }

    if (params.view === "code") { drawCode(ctx, colors, w, h, params, state); return; }

    const pickTop = drawPicker(ctx, colors, w, 2, state.key);
    if (!state.dd) {
      ctx.save();
      ctx.translate(0, pickTop - 20);
      prompt(ctx, colors, "Pick a distribution above",
        "Or open the Map and walk the tree to find the one your data needs.");
      ctx.restore();
      return;
    }

    const stripRect = { x: 0, y: pickTop, w, h: STRIP_H };
    drawProcess(ctx, colors, stripRect, state, anim, SPEEDS[params.speed]);
    const top = pickTop + STRIP_H + 6;
    rule(ctx, colors, 0, w, top);
    if (!anim?.pile) return;

    const dd = state.dd;
    const f = anim.pile.frame();
    const hi = dd.lo + dd.bins * dd.width;
    const plot = makePlot({
      ctx,
      colors,
      rect: { x: 46, y: top + 24, w: w - 66, h: h - top - 66 },
      xDomain: [dd.lo, hi],
      yDomain: [0, f.yMax],
    });
    const yTicks = niceTicks(0, f.yMax, f.yMax <= 6 ? f.yMax : 4);
    plot.grid(yTicks);
    plot.axisY({ ticks: yTicks, label: "Draws" });
    plot.axisX({ ticks: xTicks(dd, hi), label: dd.axis });
    anim.pile.draw(plot, f, { colors, smooth: false });

    /* THE CURVE THE PILE IS CHECKED AGAINST. The legend named it from the first
       build and nothing ever drew it — the overlay was lost when the reading
       moved to its own view. It waits for a draw rather than opening on the
       answer (2.4), and it is scaled to EXPECTED COUNTS because the pile is in
       counts and two units on one panel is not a comparison. */
    if (params.theory && f.total > 0) {
      const n = f.total;
      if (dd.cont) {
        const pts = [];
        for (let i = 0; i <= 200; i += 1) {
          const x = dd.lo + ((hi - dd.lo) * i) / 200;
          pts.push([x, dd.pdf(x) * dd.width * n]);
        }
        plot.curve(pts, { stroke: colors.theory, width: 2 });
      } else {
        /* DOTS ON A LINE, NOT SPIKES. A pmf is conventionally drawn as stems,
           but stems over a histogram give two sets of vertical bars in one panel
           and it read as a mistake. Dots alone read as scattered marks; the line
           through them is what makes the eight of them one distribution, and it
           is the same mark the continuous panels use. */
        const pts = [];
        for (let k = 0; k < dd.bins; k += 1) pts.push([k, dd.pmf(k) * n]);
        plot.curve(pts, { stroke: colors.theory, width: 1.5, opacity: 0.55 });
        for (const [k, y] of pts) {
          if (y < 0.05) continue;
          plot.dot(k, y, { fill: colors.theory, r: 3 });
        }
      }
    }
  },

  readout: ({ params, state, anim }) => {
    const dd = state.dd;

    /* THE MAP HAS NO FIGURE, so it has no figure's numbers. Draws / Mean /
       Variance sitting under the tree with em-dashes in them is a preview of an
       answer the reader has not asked for — and it was reported exactly that
       way. One line saying what is chosen is the honest reading of a map, and
       it keeps the canvas's accessible text rather than hiding it. */
    if (params.view === "map") {
      return [{
        label: "Chosen",
        value: dd ? dd.name : "—",
        note: dd ? "press its name on the map to watch it" : "walk the tree to choose one",
      }];
    }

    if (!dd) {
      return [{ label: "Distributions", value: "8", note: "four discrete, four continuous" }];
    }
    if (params.view === "code") {
      const { x, d, p } = readAt(dd, params.prob);
      const xs = dd.cont
        ? (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2))
        : String(x);
      return [
        { label: `q${dd.prefix}(${params.prob.toFixed(2)}, …)`, value: xs + (dd.unit ? ` ${dd.unit}` : ""), note: "the x this quantile returns" },
        { label: `d${dd.prefix}(${xs}, …)`, value: fmt(d, 4), note: dd.cont ? `a density — ${dd.dens}` : "the chance of exactly this x" },
        { label: `p${dd.prefix}(${xs}, …)`, value: fmt(p, 4), note: dd.cont ? "the shaded area" : `asked for ${params.prob.toFixed(2)}` },
      ];
    }
    const n = anim?.pile?.shown ?? 0;
    const mean = n ? anim.pile.mean : 0;
    const variance = n > 1 ? anim.pile.sd ** 2 : 0;
    return [
      { label: "Draws", value: `${n}`, note: `of ${DRAWS}` },
      { label: "Mean", value: n ? fmt(mean, 2) : "—", note: dd.unit || dd.axis.toLowerCase() },
      {
        label: dd.disc ? "Variance / mean" : "SD",
        value: n > 1 ? fmt(dd.disc ? variance / mean : Math.sqrt(variance), 2) : "—",
        note: dd.disc ? "1.00 means Poisson" : dd.unit,
      },
    ];
  },
});

/* ========================================================================== *
   THE RAIL, per view.

   Core decides which controls EXIST from the spec's `when`, which takes one
   condition. Three of the four rules below need two — a field belongs to a
   distribution AND to a view — so the widget settles them itself, from `draw`,
   which is the one place that runs on every view change without subscribing to
   anything.

   Written as one table rather than four scattered lines because the rule is a
   single idea: THE MAP IS FOR CHOOSING, and a rail full of the last
   distribution's sliders, its outputs and a dropdown naming it is a rail full
   of answers to a question the reader has not asked yet.

     control            map    distribution    r code
     view switcher       yes       yes           yes
     distribution list    -        yes           yes
     its parameters       -        yes           yes
     speed, seed          -        yes            -
     q                    -         -            yes
     drive row            -        yes            -
     legend               -        yes            -
   ========================================================================== */

/* BOTH, and the second one is not belt-and-braces. The `hidden` attribute is
   only a default `display: none` from the user-agent sheet, and any explicit
   rule beats it — `.w-legend` is `display: flex` in tokens.css, so the legend
   stayed on screen with `hidden` set and every check that asked the DOM agreed
   it was hidden. `.w-drive` escapes this only because the side layout happens
   to carry `.w-split .w-drive[hidden] { display: none }`. `hidden` keeps the
   semantics for assistive tech; the inline style is what actually hides it. */
function show(el, on) {
  if (!el) return;
  el.hidden = !on;
  el.style.display = on ? "" : "none";
}

function syncChrome(params, state) {
  if (state.key !== lastDist) {
    lastDist = state.key;
    if (state.key) cursor = [...NODES.values()].find((n) => n.leaf === state.key) ?? cursor;
  }

  const onMap = params.view === "map";
  const onDist = params.view === "dist";
  const chosen = Boolean(state.dd);

  show(host?.querySelector(".w-drive"), onDist && chosen);
  show(host?.querySelector(".w-legend"), onDist && chosen);
  for (const name of PAR_NAMES) {
    show(host?.querySelector(`#f-${name}`)?.closest(".w-field"), !onMap);
  }
}

/* ========================================================================== *
   Text and rules
   ========================================================================== */

function text(ctx, colors, x, y, s, {
  fill = colors.ink2, size = 11, weight = 400, align = "left", mono = false,
} = {}) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${weight} ${size}px ${mono ? MONO : colors.font}`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function rule(ctx, colors, x0, x1, y) {
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, Math.round(y) + 0.5);
  ctx.lineTo(x1, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function xTicks(dd, hi) {
  if (dd.cont) {
    const out = [];
    const st = dd.tick;
    for (let t = Math.ceil(dd.lo / st) * st; t <= hi + 1e-9; t += st) out.push(+t.toFixed(6));
    return out;
  }
  const step = Math.max(1, Math.ceil(dd.bins / 10));
  const out = [];
  for (let k = 0; k < dd.bins; k += step) out.push(k);
  return out;
}

/* ========================================================================== *
   THE TREE. Full while deciding, collapsed to its path once landed.
   ========================================================================== */

function box(ctx, colors, x, y, bw, label, kind, badge) {
  const on = kind === "on";
  const off = kind === "off";
  ctx.save();
  ctx.globalAlpha = off ? 0.3 : 1;
  roundRect(ctx, x, y - 12, bw, 24, 5);
  ctx.fillStyle = on ? colors.surface3 : colors.surface;
  ctx.fill();
  ctx.strokeStyle = on ? colors.empirical : colors.axis;
  ctx.lineWidth = on ? 1.5 : 1;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = off ? 0.3 : 1;
  text(ctx, colors, x + 8, y + 4, label, {
    fill: on ? colors.ink1 : colors.ink2, size: 11, weight: on ? 600 : 400,
  });
  if (badge) {
    text(ctx, colors, x + bw - 9, y + 4, badge, {
      fill: colors.empirical, size: 13, weight: 600, align: "right",
    });
  }
  ctx.restore();
}

function elbow(ctx, colors, x0, y0, x1, y1, on) {
  ctx.save();
  ctx.strokeStyle = on ? colors.empirical : colors.grid;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = on ? 1 : 0.5;
  const mid = x0 + (x1 - x0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(mid, y0);
  ctx.lineTo(mid, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function prompt(ctx, colors, head, body) {
  text(ctx, colors, 4, 26, head, { fill: colors.ink1, size: 15, weight: 600 });
  text(ctx, colors, 4, 46, body, { fill: colors.ink2 });
}

/** The map. Every ending on screen from the first click, dimmed, with the path
    lighting up as it is walked. Clicking a leaf lands on it and switches to the
    Distribution view; the Map button is the way back, which is the whole
    workflow — try one, press Map, try another. */
function drawTree(ctx, colors, w, h) {
  const here = cursor;
  const path = ancestry(here);

  text(ctx, colors, 4, 16, here.leaf ? "Answered" : (here.q ?? ROOT.q), { fill: colors.ink1, size: 15, weight: 600 });
  const hint = here.leaf
    ? `${D[here.leaf].name} — press its name to watch the process, or the R code tab to read it`
    : (here.hint ?? ROOT.hint);
  if (hint) text(ctx, colors, 4, 34, hint, { fill: here.leaf ? colors.ink1 : colors.ink2, size: 11 });

  /* CLEAR, and it lives on the map because the map is where the choice was
     made. Only once there is something to clear — a permanently-present reset
     for a state you have not reached yet is a control carrying no idea (3.5). */
  if (here !== ROOT) {
    const label = "Clear";
    ctx.save();
    ctx.font = `400 11px ${colors.font}`;
    const bw2 = ctx.measureText(label).width + 22;
    ctx.restore();
    const bx = w - bw2 - 4;
    box(ctx, colors, bx, 16, bw2, label, "near");
    hits.push({ x: bx, y: 4, w: bw2, h: 24, clear: true });
  }

  const bw = Math.min(158, (w - 190) / 4 - 14);
  const cols = [4, bw + 26, 2 * bw + 48, 3 * bw + 70];
  /* Eight rows of 24px boxes. At 30 that left 6px between them and read as a
     squeezed list rather than a tree; 44 fills the canvas and makes the boxes
     comfortable click targets. */
  const rowH = Math.min(44, (h - 74) / 8);
  const y0 = 56;
  const yOf = (n) => y0 + n.row * rowH + rowH / 2;
  const kindOf = (n) =>
    (path.includes(n.id) ? "on" : (here.kids?.includes(n) ? "near" : "off"));

  const walk = (n) => {
    const x = cols[n.depth];
    const y = yOf(n);
    if (n.parent) {
      elbow(ctx, colors, cols[n.parent.depth] + bw, yOf(n.parent), x, y,
        path.includes(n.id) && path.includes(n.parent.id));
    }
    box(ctx, colors, x, y, bw, n.label, kindOf(n));
    hits.push({ x, y: y - 12, w: bw, h: 24, id: n.id });
    if (n.leaf) {
      const lx = cols[3];
      elbow(ctx, colors, x + bw, y, lx, y, path.includes(n.id));
      const landed = path.includes(n.id);
      box(ctx, colors, lx, y, w - lx - 6, D[n.leaf].name, kindOf(n), landed ? "→" : null);
      hits.push({ x: lx, y: y - 12, w: w - lx - 6, h: 24, id: n.id, go: true });
    } else n.kids.forEach(walk);
  };
  ROOT.kids.forEach(walk);
}

/* ========================================================================== *
   THE MECHANISM — one draw of the chosen process, mid-flight.
   ========================================================================== */

function drawProcess(ctx, colors, rect, state, anim, pace) {
  const dd = state.dd;
  if (!dd || !anim) return;

  text(ctx, colors, rect.x + 4, rect.y + 13, dd.story, { fill: colors.ink2 });

  if (!pace.choreograph) {
    text(ctx, colors, rect.x + 4, rect.y + 44, "drawing at speed — the process is not shown", {
      fill: colors.ink3,
    });
    return;
  }

  /* WHICH DRAW THE STRIP SHOWS, and it is not always `anim.i`. At rest — after
     a step, or on a settled ?shown= link — `i` has advanced past the draw that
     made the last bar, and showing it renders an untouched window with nothing
     in it, which reads as the widget having broken rather than finished. */
  const inFlight = anim.t > 0 && anim.i < DRAWS;
  const started = anim.i > 0 || anim.t > 0;
  const i = inFlight ? anim.i : Math.max(0, anim.i - 1);
  const frac = !started ? 0
    : inFlight ? Math.min(1, (anim.t / pace.ms) / (1 - DROP_FRACTION))
      : 1;
  const cur = state.draws[i];
  if (!cur) return;

  if (dd.mech === "attempts") drawAttempts(ctx, colors, rect, cur, frac, dd);
  else if (dd.mech === "pool") drawPool(ctx, colors, rect, cur, frac, dd);
  else if (dd.mech === "window") drawWindow(ctx, colors, rect, cur, frac, dd);
  else if (dd.mech === "gap") drawGap(ctx, colors, rect, cur, frac, dd);
  else drawMeasure(ctx, colors, rect, cur, frac, dd);
}

/** Ten attempts resolving one at a time. The fixed chance is printed and never
    moves — it is the reference the pool's moving one is read against. */
function drawAttempts(ctx, colors, rect, cur, frac, dd) {
  const n = dd.n;
  const shown = Math.min(n, Math.floor(frac * n * 1.0001));
  /* The circles shrink to fit: 20 trials at the 32px pitch ten of them wanted
     would run 200px past a 546px canvas. The readout keeps a FIXED column
     rather than following the last circle — trailing it put
     "P(success) = 0.05 — fixed" 16px off the edge at twenty trials. */
  const span = rect.w - 168;
  const gap = Math.min(32, span / n);
  const r = Math.min(11, gap * 0.34);
  const x0 = rect.x + 16;
  const cy = rect.y + 52;
  for (let i = 0; i < n; i += 1) {
    const cx = x0 + r + i * gap;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (i >= shown) { ctx.strokeStyle = colors.grid; ctx.lineWidth = 1.5; ctx.stroke(); continue; }
    if (cur.hits[i]) { ctx.fillStyle = colors.empirical; ctx.fill(); }
    else { ctx.strokeStyle = colors.axis; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (i === shown - 1 && frac < 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  const made = cur.hits.slice(0, shown).filter(Boolean).length;
  const rx = rect.x + rect.w - 148;
  text(ctx, colors, rx, cy - 4, `${made} of ${shown}`, { fill: colors.ink1, size: 15, weight: 600 });
  text(ctx, colors, rx, cy + 14, `P(success) = ${dd.p} — fixed`, { fill: colors.ink3 });
}

/** The pool, emptying. Dimming a drawn plot was invisible — fifty faded dots in
    a thousand is a 5% change in a field of grey. The EVENT is visible even when
    the total is not, so each flashes, throws a ring and goes. */
function drawPool(ctx, colors, rect, cur, frac, dd) {
  const { N, k, targetSet } = dd;
  const shown = Math.min(k, Math.floor(frac * k * 1.0001));
  const x0 = rect.x + 12;
  const READOUT_W = 124;
  /* THE GRID IS LAID OUT FOR THE POOL IT HAS. A thousand dots in this strip are
     2px across and a removal leaves a gap nobody can see, which is why the pool
     size is now a control — at 200 the dots are 4x the area and the pulses read
     without squinting. Sized from the canvas as well as the count: every
     fingerprint baseline is hashed at FRAME_W 900, 20px above the stacking
     breakpoint, so the canvas is 550 — the narrowest this layout produces. */
  const availW = rect.w - 12 - READOUT_W - x0;
  const availH = 58;
  const cols = Math.max(10, Math.round(Math.sqrt((N * availW) / availH)));
  const rows = Math.ceil(N / cols);
  const pitch = Math.min(12, availW / cols, availH / Math.max(1, rows - 1));
  const y0 = rect.y + 30 - ((rows - 1) * pitch) / 2 + 14;
  const rGood = Math.min(4.5, pitch * 0.42);
  const rPlot = Math.min(3, pitch * 0.26);
  const PULSE = 7;

  if (!cur.takenAt) cur.takenAt = new Map(cur.steps.map((st, j) => [st.cell, j]));

  for (let i = 0; i < N; i += 1) {
    const cx = x0 + (i % cols) * pitch + 2;
    const cy = y0 + Math.floor(i / cols) * pitch;
    const isGood = targetSet.has(i);
    const r0 = isGood ? rGood : rPlot;
    const j = cur.takenAt.get(i);
    if (j === undefined || j >= shown) {
      ctx.beginPath();
      ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      // not `grid`: a thousand hairline dots read as an empty rectangle, and the
      // hole a removed plot leaves would open in something never visible
      ctx.fillStyle = isGood ? colors.groupB : colors.axis;
      ctx.fill();
      continue;
    }
    const u = (shown - 1 - j) / PULSE;
    const tone = isGood ? colors.groupB : colors.highlight;
    if (u < 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, r0 * (1 - u) + 0.6, 0, Math.PI * 2);
      ctx.fillStyle = tone;
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.beginPath();
      ctx.arc(cx, cy, pitch * 0.6 + u * pitch * 1.25, 0, Math.PI * 2);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else if (isGood) {
      // a find stays countable; a miss leaves nothing, which is the point
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.strokeStyle = colors.groupB;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }
  const st = cur.steps[Math.min(shown, k - 1)];
  const found = cur.steps.slice(0, shown).filter((s) => s.hit).length;
  const rx = x0 + cols * pitch + 12;
  text(ctx, colors, rx, rect.y + 32, `${found} found`, { fill: colors.ink1, size: 15, weight: 600 });
  text(ctx, colors, rx, rect.y + 52, `P(next) = ${st.good}/${st.left}`, {
    fill: colors.highlight, size: 12, weight: 600,
  });
  text(ctx, colors, rx, rect.y + 68, `= ${(st.good / st.left).toFixed(4)} — moves`, { fill: colors.ink3 });
  text(ctx, colors, rx, rect.y + 84, `${shown} of ${k} drawn`, { fill: colors.ink3 });
}

/** One window with its rate above it. The Poisson's marker is parked; the
    negative binomial's is redrawn every draw, and that marker is the only
    difference between the two panels. */
function drawWindow(ctx, colors, rect, cur, frac, dd) {
  const varies = Boolean(dd.varies);
  const x0 = rect.x + 12;
  const x1 = rect.x + rect.w - 108;
  const y = rect.y + 66;
  const scaleW = 176;
  const sx = x0 + 30;

  text(ctx, colors, x0, rect.y + 38, "rate", { fill: colors.ink3 });
  rule(ctx, colors, sx, sx + scaleW, rect.y + 34.5);
  const top20 = Math.max(1, (dd.varies ? dd.mu * 4 : dd.rate * 2));
  const mx = sx + Math.min(1, cur.rate / top20) * scaleW;
  ctx.beginPath();
  ctx.moveTo(mx, rect.y + 28);
  ctx.lineTo(mx + 5, rect.y + 38);
  ctx.lineTo(mx - 5, rect.y + 38);
  ctx.closePath();
  ctx.fillStyle = varies ? colors.highlight : colors.reference;
  ctx.fill();
  text(ctx, colors, sx + scaleW + 10, rect.y + 38,
    varies ? `${cur.rate.toFixed(2)} — redrawn every window` : `${cur.rate} — fixed`,
    { fill: varies ? colors.highlight : colors.ink3, weight: varies ? 600 : 400 });

  rule(ctx, colors, x0, x1, y + 16);
  const seen = cur.times.filter((t) => t <= frac);
  ctx.save();
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 2;
  for (const t of seen) {
    const tx = x0 + t * (x1 - x0);
    ctx.beginPath();
    ctx.moveTo(tx, y - 8);
    ctx.lineTo(tx, y + 16);
    ctx.stroke();
  }
  ctx.restore();
  if (frac < 1) {
    const cx = x0 + frac * (x1 - x0);
    ctx.save();
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y - 14);
    ctx.lineTo(cx, y + 20);
    ctx.stroke();
    ctx.restore();
  }
  text(ctx, colors, x1 + 20, y, `${seen.length}`, { fill: colors.ink1, size: 17, weight: 600 });
  text(ctx, colors, x1 + 20, y + 16, dd.unit, { fill: colors.ink3 });
}

/** The same window the Poisson panel draws, with the measured gap marked:
    the count in a window and the gap between its events are one process asked
    two questions, and that is the whole reason the exponential is here. */
function drawGap(ctx, colors, rect, cur, frac, dd) {
  const x0 = rect.x + 12;
  const x1 = rect.x + rect.w - 118;
  const y = rect.y + 62;
  const span = 1;

  text(ctx, colors, x0, rect.y + 34,
    `events at ${dd.rate} per window — so gaps average 1/${dd.rate} = ${(1 / dd.rate).toFixed(2)}`,
    { fill: colors.ink3 });
  rule(ctx, colors, x0, x1, y + 16);
  ctx.save();
  ctx.strokeStyle = colors.empirical;
  ctx.lineWidth = 2;
  for (const t of cur.times) {
    const tx = x0 + (t / span) * (x1 - x0);
    ctx.beginPath();
    ctx.moveTo(tx, y - 6);
    ctx.lineTo(tx, y + 16);
    ctx.stroke();
  }
  ctx.restore();

  const gw = Math.min(1, cur.gap) * (x1 - x0) * frac;
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y - 16);
  ctx.lineTo(x0 + gw, y - 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0 + gw, y - 21);
  ctx.lineTo(x0 + gw, y - 11);
  ctx.stroke();
  ctx.restore();

  text(ctx, colors, x1 + 20, y, `${(cur.gap * frac).toFixed(2)}`, {
    fill: colors.ink1, size: 17, weight: 600,
  });
  text(ctx, colors, x1 + 20, y + 16, "of a window", { fill: colors.ink3 });
}

/** A measurement has no events to count. The strip says so by being nearly
    empty: one value on a continuous line, against panels full of things
    happening. That contrast is the discrete/continuous split. */
function drawMeasure(ctx, colors, rect, cur, frac, dd) {
  const x0 = rect.x + 12;
  const x1 = rect.x + rect.w - 118;
  const y = rect.y + 58;
  const hi = dd.lo + dd.bins * dd.width;
  const px = (v) => x0 + ((v - dd.lo) / (hi - dd.lo)) * (x1 - x0);

  rule(ctx, colors, x0, x1, y);
  for (const t of xTicks(dd, hi)) {
    text(ctx, colors, px(t), y + 16, String(+t.toFixed(2)), {
      fill: colors.ink3, size: 10, align: "center",
    });
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, frac * 2);
  ctx.beginPath();
  ctx.arc(px(Math.min(hi, cur.value)), y, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = colors.highlight;
  ctx.fill();
  ctx.restore();
  text(ctx, colors, x1 + 20, y + 2, cur.value.toFixed(2), {
    fill: colors.ink1, size: 17, weight: 600,
  });
  text(ctx, colors, x1 + 20, y + 18, dd.unit || "p", { fill: colors.ink3 });
}

/* ========================================================================== *
   THE R CODE TAB — four cards, each led by the question its function answers.
   ========================================================================== */

/** Eight chips, always on the R code tab. Walking the tree is how you FIND a
    distribution; it must not be the toll for looking one up, and a student who
    already knows they want `rpois` should reach it in one click. */
function drawPicker(ctx, colors, w, y, current) {
  const perRow = 4;
  const gap = 8;
  const cw = (w - gap * (perRow - 1)) / perRow;
  Object.entries(D).forEach(([k, v], i) => {
    const x = (i % perRow) * (cw + gap);
    const cy = y + Math.floor(i / perRow) * 30 + 12;
    const on = k === current;
    ctx.save();
    roundRect(ctx, x, cy - 11, cw, 22, 11);
    ctx.fillStyle = on ? colors.surface3 : colors.surface;
    ctx.fill();
    ctx.strokeStyle = on ? colors.empirical : colors.grid;
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.stroke();
    ctx.restore();
    text(ctx, colors, x + cw / 2, cy + 4, v.name, {
      fill: on ? colors.ink1 : colors.ink2, size: 11, weight: on ? 600 : 400, align: "center",
    });
    hits.push({ x, y: cy - 11, w: cw, h: 22, dist: k });
  });
  return y + 2 * 30 + 6;
}

function drawCode(ctx, colors, w, h, params, state) {
  const dd = state.dd;
  const top = drawPicker(ctx, colors, w, 2, state.key);
  if (!dd) {
    ctx.save(); ctx.translate(0, top - 20); prompt(ctx, colors, "Pick a distribution above",
      "The same four functions work on all eight — the prefix is the question, the rest is which distribution.");
    ctx.restore();
    return;
  }

  const { x: xr, d, p } = readAt(dd, params.prob);
  /* Two decimals on a value of 1638 is false precision and 40px of card width;
     the log-normal reaches four figures at the top of its sliders. */
  const fmtX = (x) => (!dd.cont ? String(x)
    : Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
  const xs = fmtX(xr);
  const qv = xs;

  /* THE QUESTION IS BUILT FROM THE DISTRIBUTION, never written out per card.
     Hardcoded questions named a fixed x while the card's x follows the quantile
     slider, so "how dense is the curve at 5 mg/L" sat above dlnorm(14.08, …). */
  const u = dd.unit ? ` ${dd.unit}` : "";
  const pct = (v) => `${Math.round(v * 100)}%`;
  const asks = {
    d: dd.cont ? `How dense is the curve at ${xs}${u}?` : `The chance of exactly ${xs}?`,
    p: dd.cont ? `The chance of under ${xs}${u}?` : `The chance of ${xs} or fewer?`,
    q: params.prob >= 0.5
      ? `Which value are the top ${pct(1 - params.prob)} above?`
      : `Which value are the bottom ${pct(params.prob)} below?`,
    r: `Simulate ${DRAWS} ${dd.plural}.`,
  };

  const cards = [
    { fn: `d${dd.prefix}`, use: "one exact value", ask: asks.d, kind: "d",
      code: `d${dd.prefix}(${xs}, ${dd.args})`, val: fmt(d, 4),
      unit: dd.cont ? dd.dens : "probability",
      warn: dd.cont ? `a DENSITY, ${dd.dens} — not a probability${d > 1 ? ", and here it is above 1" : ""}` : null },
    { fn: `p${dd.prefix}`, use: "this or less", ask: asks.p, kind: "p",
      code: `p${dd.prefix}(${xs}, ${dd.args})`, val: fmt(p, 4), unit: "probability",
      warn: null },
    { fn: `q${dd.prefix}`, use: "go the other way", ask: asks.q, kind: "q",
      code: `q${dd.prefix}(${params.prob.toFixed(2)}, ${dd.args})`, val: qv,
      unit: dd.unit || dd.axis.toLowerCase(),
      warn: dd.cont ? null
        : `the SMALLEST x reaching ${params.prob.toFixed(2)} — its cumulative is ${cdfAt(dd, xr).toFixed(3)}` },
    { fn: `r${dd.prefix}`, use: "make fake data", ask: asks.r, kind: "r",
      code: `r${dd.prefix}(${DRAWS}, ${dd.args})`, val: String(DRAWS), unit: "simulated values",
      warn: null },
  ];

  text(ctx, colors, 4, top + 12, "the prefix is the question, the rest is which distribution", {
    fill: colors.ink3,
  });

  const gap = 16;
  const cw = (w - gap) / 2;
  const y0 = top + 20;
  const ch = (h - y0 - gap) / 2;
  cards.forEach((c, i) => {
    const cx = (i % 2) * (cw + gap);
    const cy = y0 + Math.floor(i / 2) * (ch + gap);
    drawCard(ctx, colors, cx, cy, cw, ch, c, dd, xr, params);
  });
}

function drawCard(ctx, colors, x, y, w, h, c, dd, xr, params) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 6);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const pad = 10;
  text(ctx, colors, x + pad, y + 18, `${c.fn}()`, {
    fill: colors.ink1, size: 14, weight: 600, mono: true,
  });
  ctx.save();
  ctx.font = `600 14px ${MONO}`;
  const fnW = ctx.measureText(`${c.fn}()`).width;
  ctx.restore();
  text(ctx, colors, x + pad + fnW + 8, y + 18, c.use, { fill: colors.ink3, size: 10 });
  text(ctx, colors, x + pad, y + 36, c.ask, { fill: colors.ink1, size: 12, weight: 600 });

  const figH = h - 112;
  miniFigure(ctx, colors, { x: x + pad, y: y + 42, w: w - 2 * pad, h: figH }, dd, c.kind, xr, params);

  const by = y + h - 42;
  /* THE CODE LINE SHRINKS TO FIT ITS CARD. Half a canvas at the 546px baseline
     is ~245px of usable width, and a fully-wound log-normal writes
     `plnorm(1639, meanlog = 3.91, sdlog = 1.5)` — which ran 36px past the edge,
     where the halo behind it erased what it overran instead of colliding
     visibly. Measured and stepped down rather than truncated: a clipped R call
     is worse than a small one, because a student is meant to be able to copy it. */
  const avail = w - 2 * pad;
  let codeSize = 11;
  ctx.save();
  for (; codeSize > 8; codeSize -= 0.5) {
    ctx.font = `400 ${codeSize}px ${MONO}`;
    if (ctx.measureText(c.code).width <= avail) break;
  }
  ctx.restore();
  text(ctx, colors, x + pad, by, c.code, { fill: colors.ink2, size: codeSize, mono: true });
  text(ctx, colors, x + pad, by + 20, c.val, { fill: colors.ink1, size: 16, weight: 600 });
  ctx.save();
  ctx.font = `600 16px ${colors.font}`;
  const vw = ctx.measureText(c.val).width;
  ctx.restore();
  text(ctx, colors, x + pad + vw + 7, by + 20, c.unit, { fill: colors.ink3, size: 10 });
  if (c.warn) {
    text(ctx, colors, x + pad, by + 34, c.warn, { fill: colors.theory, size: 10 });
  }
}

/** The distribution, with the part this function reads picked out. */
function miniFigure(ctx, colors, r, dd, kind, xr, params) {
  const hi = dd.lo + dd.bins * dd.width;
  const base = r.y + r.h - 14;
  const top = r.y + 4;
  const px = (v) => r.x + ((v - dd.lo) / (hi - dd.lo)) * r.w;

  if (dd.cont) {
    const N = 160;
    const ys = [];
    for (let i = 0; i <= N; i += 1) ys.push(dd.pdf(dd.lo + ((hi - dd.lo) * i) / N));
    const peak = Math.max(...ys, 1e-9);
    const py = (v) => base - (v / peak) * (base - top);

    if (kind === "p" || kind === "q") {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = colors.empirical;
      ctx.beginPath();
      ctx.moveTo(px(dd.lo), base);
      for (let i = 0; i <= N; i += 1) {
        const v = dd.lo + ((hi - dd.lo) * i) / N;
        const inside = kind === "p" ? v <= xr : v >= xr;
        ctx.lineTo(px(v), inside ? py(ys[i]) : base);
      }
      ctx.lineTo(px(hi), base);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= N; i += 1) ctx.lineTo(px(dd.lo + ((hi - dd.lo) * i) / N), py(ys[i]));
    ctx.stroke();
    ctx.restore();
    if (kind === "d") {
      ctx.save();
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(xr), base);
      ctx.lineTo(px(xr), py(dd.pdf(xr)));
      ctx.stroke();
      ctx.fillStyle = colors.highlight;
      ctx.beginPath();
      ctx.arc(px(xr), py(dd.pdf(xr)), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    const bw = r.w / dd.bins;
    const pm = [];
    for (let k = 0; k < dd.bins; k += 1) pm.push(dd.pmf(k));
    const peak = Math.max(...pm);
    const py = (v) => base - (v / peak) * (base - top);
    for (let k = 0; k < dd.bins; k += 1) {
      const bh = (pm[k] / peak) * (base - top);
      let fill = colors.empirical;
      let alpha = 0.85;
      if (kind === "d") { alpha = k === xr ? 1 : 0.25; if (k === xr) fill = colors.highlight; }
      if (kind === "p") alpha = k <= xr ? 0.95 : 0.18;
      if (kind === "q") { alpha = k >= xr ? 0.95 : 0.18; if (k >= xr) fill = colors.highlight; }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(r.x + k * bw + 0.5, base - bh, Math.max(1, bw - 1), bh);
      ctx.restore();
    }
    /* The same connected outline the big panel uses, so a reader who has seen
       one recognises the other. */
    ctx.save();
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let k = 0; k < dd.bins; k += 1) ctx.lineTo(r.x + k * bw + bw / 2, py(pm[k]));
    ctx.stroke();
    ctx.restore();
  }

  rule(ctx, colors, r.x, r.x + r.w, base);

  /* THE MINI FIGURES NEEDED AN AXIS. An exponential's window is 5/rate wide and
     a normal's is mean ± 3sd, so both are SELF-SIMILAR under their own
     parameters: change the rate and the curve is pixel-identical, only the
     scale beneath it has moved. Without labels that reads as a slider doing
     nothing. With them it reads as the thing it is. */
  const ticks = xTicks(dd, hi);
  const step = Math.max(1, Math.ceil(ticks.length / 5));
  for (let i = 0; i < ticks.length; i += step) {
    const t = ticks[i];
    if (px(t) < r.x - 1 || px(t) > r.x + r.w + 1) continue;
    text(ctx, colors, px(t), base + 11, String(+Number(t).toFixed(2)), {
      fill: colors.ink3, size: 9, align: "center",
    });
  }
}

/* ========================================================================== *
   Clicking the tree. `defineWidget` hands back `setParam`, so this needs no
   core change — the boxes were recorded by the draw pass that put them there.
   ========================================================================== */

const canvas = host?.querySelector("canvas");
const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

if (canvas) {
  const at = (ev) => {
    const r = canvas.getBoundingClientRect();
    const scale = logicalW / r.width;
    return [(ev.clientX - r.left) * scale, (ev.clientY - r.top) * scale];
  };
  canvas.addEventListener("pointerdown", (ev) => {
    const [x, y] = at(ev);
    for (const b of hits) {
      if (!inBox(b, x, y)) continue;
      ev.preventDefault();
      if (b.clear) {
        cursor = ROOT;
        lastDist = "none";
        handle.setParam("dist", "none");
        return;
      }
      if (b.dist) { setDist(b.dist); return; }
      const n = NODES.get(b.id);
      if (n.leaf) {
        /* ANSWERING A QUESTION MUST NOT NAVIGATE. Landing used to switch to the
           Distribution view on the spot, and the report was that the last
           answer "jumps" — a click that answers a question and a click that
           changes what you are looking at are two different actions, and one
           button doing both is why it felt jarring. The answer box lands and
           stays; the distribution's NAME, one column further right, is the
           thing you press to go and look at it. */
        setDist(n.leaf);
        if (b.go) handle.setParam("view", "dist");
        return;
      }
      /* An internal node only moves the cursor, which is not a parameter — so
         core has nothing to react to and the repaint has to be asked for. */
      cursor = n;
      handle.render();
      return;
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    const [x, y] = at(ev);
    canvas.style.cursor = hits.some((b) => inBox(b, x, y)) ? "pointer" : "default";
  });
}

/** Landing: the parameter moves, the tree cursor follows it so pressing Map
    reopens where you were, and the select is nudged because `setParam` only
    rebuilds controls for a parameter that GATES another field. */
function setDist(key) {
  /* CURSOR FIRST. `setParam` repaints synchronously, so setting the cursor
     afterwards drew the tree with the PREVIOUS leaf still lit while the rail
     already showed the new one — a dropdown reading Hypergeometric above a tree
     lit through to Binomial. Nothing repainted again to reconcile them. */
  cursor = [...NODES.values()].find((n) => n.leaf === key) ?? ROOT;
  handle.setParam("dist", key);
}
