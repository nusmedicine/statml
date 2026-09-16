/* The stage and the arithmetic behind slot 67 `tumor-heterogeneity`, for the
 * lab: `_lab/vaf-measure.mjs` and `_lab/vaf-mock.html` both import this file.
 *
 * SINCE THE WIDGET EXISTS, THE ARITHMETIC IS THE WIDGET'S. Everything a
 * reader sees is re-exported from `widgets/tumor-heterogeneity/model.js`, so a
 * number the mock draws is a number the page draws (5.8; § *Widget 41*, whose
 * mock computed its own stage and disagreed with the measurement it
 * illustrated). What stays here is what only the lab needs: a standalone
 * generator (the widget's stage runs on core's seeded rng), a tumour built
 * from it, and the tree enumeration at any k, which the widget fixes at three
 * clusters because his figure has three.
 */
import * as W from "../tumor-heterogeneity/model.js";

export {
  vafExpected, ccfFrom, COPY_STATES, stateOf, median, MATH, pickK, fitGMM, DEPTH_SD,
  scenariosFor, configOne, hostsOf, KNOWLEDGE,
} from "../tumor-heterogeneity/model.js";

/* Three arrangements that all read VAF 0.250 — the mock's § 3, and the
   measurement that decided page 1's shape. The widget drew them as rows until
   2026-09-16, when the panel became the lesson's own question instead; the
   trio stays because the CLAIM it makes is still the page's — one reading,
   several tumours — and `_lab/vaf-measure.mjs` still checks the arithmetic. */
export const TRIO = [
  { label: "half the cells in the sample are normal", purity: 0.5, ccf: 1, m: 1, state: "1+1" },
  { label: "half the tumour cells carry it", purity: 1, ccf: 0.5, m: 1, state: "1+1" },
  { label: "it is on one of four copies in every tumour cell", purity: 1, ccf: 1, m: 1, state: "3+1" },
];

/* ---- a standalone generator, for scripts with no core rng ----------------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function binomial(n, p, rng) { let k = 0; for (let i = 0; i < n; i += 1) if (rng() < p) k += 1; return k; }
export const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };

export const DEPTH_MEDIAN = 88;
export const drawDepth = (rng, med = DEPTH_MEDIAN) => Math.max(8, Math.round(Math.exp(Math.log(med) + W.DEPTH_SD * normal(rng))));

/** One tumour's mutations, on the lab's own generator. */
export function tumour({ clones, purity, n, seed, depthMedian = DEPTH_MEDIAN, state = "1+1", m = 1 }) {
  const rng = mulberry32(seed);
  const total = W.stateOf(state).total;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    let u = rng(), pick = clones[0];
    for (const c of clones) { if (u < c.share) { pick = c; break; } u -= c.share; }
    const depth = drawDepth(rng, depthMedian);
    const p = W.vafExpected(purity, pick.ccf, m, total);
    const alt = binomial(depth, p, rng);
    out.push({ vaf: alt / depth, alt, depth, ccf: pick.ccf, clonal: pick.ccf >= 0.999 });
  }
  return out;
}

/* ---- trees at any k, as arrays of parent indices -------------------------- */
/* The widget draws his figure's three clusters and so declares its two shapes
   outright; the lab asks how many shapes k clusters have at all. */
export function trees(k) {
  const out = [];
  const walk = (parents) => {
    if (parents.length === k - 1) { out.push([...parents]); return; }
    for (let p = 0; p <= parents.length; p += 1) walk([...parents, p]);
  };
  walk([]);
  return out;
}
export const childrenOf = (tree, node) => W.childrenOf({ parents: tree }, node);
export const fitsSumRule = (tree, ccf) => W.fitsSumRule({ parents: tree }, ccf);
export const treeName = (tree) => tree.map((p, i) => `${p + 1} → ${i + 2}`).join(", ");

/** 01-2 cell 25's figure, keyed by sample, as the scripts read it. */
export const RETCHER = Object.fromEntries(W.SAMPLES.map((s) => [s.key, s.ccf]));
