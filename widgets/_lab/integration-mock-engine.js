/* _lab/integration-mock-engine.js — slot 80's mock stage, in two dimensions.
 *
 * One engine for the mock page and for `node` checks, so the page's numbers
 * are the numbers that were checked. Slot 79's four samples and six types,
 * placed in a plane: the six types on a hexagon (hepatocyte and tumour cell
 * adjacent, as they are nearest in expression), each patient's chemistry a
 * shift of the whole plane, each sample a small shift of its own.
 *
 * The anchor method, reduced to the steps of the lesson's figure:
 *   1. a shared space — each declared batch centred on its own mean. That is
 *      the part of CCA's per-dataset standardisation that matters here, and
 *      it carries the same assumption: that the two batches hold the same
 *      cells in the same proportions, so their means differ by the batch
 *      effect alone (measured in `integration-measure.mjs`: under the tissue
 *      key the full CCA pairs 55–59% of anchors across types for this reason);
 *   2. anchors — mutual nearest neighbours between the batches in that space;
 *   3. scores — how many neighbours the two cells of an anchor share;
 *   4. correction — each cell of the second batch moved, in the ORIGINAL
 *      space, by the score-weighted mean of the (first − second) vectors of
 *      the anchors nearest it.
 */
import { makeRng } from "../core/rng.js";
import { TYPES, SAMPLES } from "../cell-qc/engine.js";

export { TYPES, SAMPLES };
export const KEYS = {
  patient: { name: "Patient", of: (c) => c.patient - 1, labels: ["Patient 1", "Patient 2"] },
  tissue: { name: "Tissue", of: (c) => (c.tissue === "liver" ? 0 : 1), labels: ["Liver", "Tumour"] },
};

const HEX = TYPES.map((_, i) => [Math.cos((Math.PI * 2 * i) / TYPES.length), Math.sin((Math.PI * 2 * i) / TYPES.length)]);

export function simulate(seed, { cells = 150, batch = 0.9, spread = 0.13, sampleShift = 0.08 } = {}) {
  const rng = makeRng(seed);
  const ang = rng.uniform(0, Math.PI * 2);
  const pShift = [[0, 0], [batch * Math.cos(ang), batch * Math.sin(ang)]];
  const out = [];
  for (const s of SAMPLES) {
    const ss = [rng.normal(0, sampleShift), rng.normal(0, sampleShift)];
    // the tumour cells sit in the tumour samples only — the figure's query-only type
    const mix = s.tissue === "liver" ? { ...s.mix, tumour: 0 } : s.mix;
    const tot = Object.values(mix).reduce((a, b) => a + b, 0);
    for (let i = 0; i < cells; i += 1) {
      const u = rng.next() * tot; let acc = 0, ti = 0;
      for (let k = 0; k < TYPES.length; k += 1) { acc += mix[TYPES[k].key] ?? 0; if (u < acc) { ti = k; break; } }
      const x = HEX[ti][0] + rng.normal(0, spread) + pShift[s.patient - 1][0] + ss[0];
      const y = HEX[ti][1] + rng.normal(0, spread) + pShift[s.patient - 1][1] + ss[1];
      out.push({ sample: s.key, patient: s.patient, tissue: s.tissue, type: ti, x, y });
    }
  }
  return out;
}

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function knn(A, B, k, skipSelf = false) {
  return A.map((a, i) => {
    const best = [];
    B.forEach((b, j) => {
      if (skipSelf && i === j) return;
      const dd = d2(a, b);
      if (best.length < k || dd < best[best.length - 1][0]) { best.push([dd, j]); best.sort((x, y) => x[0] - y[0]); if (best.length > k) best.pop(); }
    });
    return best.map((e) => e[1]);
  });
}

export function integrate(cells, keyName, { k = 5, kScore = 20, kWeight = 30 } = {}) {
  const key = KEYS[keyName];
  const b = cells.map(key.of);
  const idx = [0, 1].map((v) => b.map((bb, i) => (bb === v ? i : -1)).filter((i) => i >= 0));
  const raw = cells.map((c) => [c.x, c.y]);
  const means = idx.map((I) => [0, 1].map((d) => I.reduce((s, i) => s + raw[i][d], 0) / I.length));
  const shared = raw.map((p, i) => [p[0] - means[b[i]][0], p[1] - means[b[i]][1]]);
  const S = idx.map((I) => I.map((i) => shared[i]));
  const nn01 = knn(S[0], S[1], k), nn10 = knn(S[1], S[0], k);
  const pairs = [];
  for (let a = 0; a < S[0].length; a += 1) for (const q of nn01[a]) if (nn10[q].includes(a)) pairs.push([idx[0][a], idx[1][q]]);
  const nnAll = knn(shared, shared, kScore, true);
  const rawScore = pairs.map(([i, j]) => { const A = new Set(nnAll[i]); return nnAll[j].filter((m) => A.has(m)).length; });
  const sorted = rawScore.slice().sort((x, y) => x - y);
  const lo = sorted[Math.floor(0.01 * sorted.length)] ?? 0, hi = sorted[Math.floor(0.9 * sorted.length)] ?? 1;
  const score = rawScore.map((r) => Math.min(1, Math.max(0, (r - lo) / Math.max(1, hi - lo))));
  const vec = pairs.map(([i, j]) => [raw[i][0] - raw[j][0], raw[i][1] - raw[j][1]]);
  const corrected = raw.map((p) => p.slice());
  for (const q of idx[1]) {
    const near = pairs.map(([, j], p) => [d2(shared[q], shared[j]), p]).sort((x, y) => x[0] - y[0]).slice(0, kWeight);
    const dmax = near[near.length - 1]?.[0] || 1;
    let w = 0, dx = 0, dy = 0;
    near.forEach(([dd, p]) => { const ww = (1 - dd / dmax + 1e-6) * score[p]; w += ww; dx += ww * vec[p][0]; dy += ww * vec[p][1]; });
    if (w > 0) corrected[q] = [raw[q][0] + dx / w, raw[q][1] + dy / w];
  }
  return { batch: b, raw, shared, corrected, pairs, score, means };
}

/* what the reader reads off the figure */
export function summary(cells, res, keyName) {
  const across = res.pairs.map(([i, j]) => cells[i].type !== cells[j].type);
  const nAcross = across.filter(Boolean).length;
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const mix = (P, bOf) => {
    const nn = knn(P, P, 15, true);
    const n0 = bOf.filter((v) => v === 0).length / bOf.length;
    const share = nn.map((a, i) => a.filter((j) => bOf[j] !== bOf[i]).length / 15);
    const exp = bOf.map((v) => (v === 0 ? 1 - n0 : n0));
    return mean(share) / mean(exp);
  };
  const tumourNear = (P) => {
    const t = cells.map((c, i) => (c.type === 1 ? i : -1)).filter((i) => i >= 0);
    const nn = knn(t.map((i) => P[i]), P, 15);
    let hep = 0, tot = 0; nn.forEach((a) => a.forEach((j) => { tot += 1; if (cells[j].type === 0) hep += 1; }));
    return hep / tot;
  };
  const patientOf = cells.map(KEYS.patient.of), tissueOf = cells.map(KEYS.tissue.of);
  return {
    anchors: res.pairs.length, across: nAcross,
    scoreSame: mean(res.score.filter((_, p) => !across[p])), scoreAcross: mean(res.score.filter((_, p) => across[p])),
    mixPatient: [mix(res.raw, patientOf), mix(res.corrected, patientOf)],
    mixTissue: [mix(res.raw, tissueOf), mix(res.corrected, tissueOf)],
    tumourHep: [tumourNear(res.raw), tumourNear(res.corrected)],
  };
}
