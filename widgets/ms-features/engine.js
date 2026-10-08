/* ms-features — the engine. Pure functions over the lesson's numbers.
 *
 * `data.js` holds what MTBLS6038's MAF records (the file 02-2 downloads): the
 * 26 metabolites' formula, reported m/z, retention time and zero counts, and
 * six real samples' areas (three cancer, three hyperplasia; glutaric acid
 * detected in three). The MAF holds no raw traces, so the trace at one m/z is
 * simulated around those numbers: a Gaussian peak at each metabolite's RT
 * whose AREA is the MAF's value, over smoothed noise. The noise is set so a
 * peak at glutaric acid's smallest detected area (10,670, where its detected
 * values start sharply: the assay's limit, by the look of it) stands exactly
 * at S/N 3, the study's limit-of-detection rule.
 *
 * Measured for the mock (catalogue § Slot 93): 40 · 5 · 1 CHNOS formulas fit
 * m/z 131.035 at ±0.5 Da · ±0.01 Da · ±5 ppm — mass accuracy reaches the
 * formula, and glutaric and ethylmalonic acid share it exactly.
 */
import DATA from "./data.js";

export const SAMPLES = DATA.samples;
export const METS = DATA.metabolites;
export const GLU = METS.find((m) => m.name === "Glutaric acid");
export const ETH = METS.find((m) => m.name === "Ethylmalonic acid");
export const SLICE = [GLU, ETH];                     // the two compounds at m/z 131.035

/* ------------------------------------------------------------ masses */
const AM = { C: 12, H: 1.00782503207, N: 14.0030740048, O: 15.99491461956, S: 31.97207100 };
export const PROTON = 1.00727646688;
export const PPM = 5;
/* the feature's measured m/z: the exact [M−H]⁻ plus a 1.6 ppm error, inside an
   Orbitrap's or a TOF's usual 5 ppm */
export const FEATURE_MZ = ETH.exact * (1 + 1.6e-6);
export const tolDa = (tol, mz) => (tol === "unit" ? 0.5 : (mz * PPM) / 1e6);
export const ppmOf = (obs, exact) => ((obs - exact) / exact) * 1e6;

/* Every CHNOS formula whose [M−H]⁻ lies within `tol` Da of `target`: a neutral
   molecule, RDBE whole and ≥ 0, H at most 3C + N + 2. Elements and counts as in
   Kind & Fiehn 2007's rules, loosened; S kept to one. */
export function formulas(target, tol) {
  const out = [];
  for (let C = 1; C <= 14; C++) for (let N = 0; N <= 4; N++) for (let O = 0; O <= 10; O++) for (let S = 0; S <= 1; S++) {
    const H = Math.round((target + PROTON - C * AM.C - N * AM.N - O * AM.O - S * AM.S) / AM.H);
    if (H < 0 || H > 3 * C + N + 2) continue;
    const mz = C * AM.C + H * AM.H + N * AM.N + O * AM.O + S * AM.S - PROTON;
    const rdbe = C - H / 2 + N / 2 + 1;
    if (Math.abs(mz - target) <= tol && rdbe >= 0 && rdbe === Math.floor(rdbe)) {
      const n = (k, e) => (k ? e + (k > 1 ? k : "") : "");
      out.push({ f: `C${C}H${H}${n(N, "N")}${n(O, "O")}${n(S, "S")}`, mz });
    }
  }
  return out.sort((a, b) => a.mz - b.mz);
}

/* the database is the lesson's 26: every metabolite within the tolerance of the feature */
export const candidates = (mz, tol) => METS.filter((m) => Math.abs(m.exact - mz) <= tolDa(tol, mz));
export const RT_TOL = 0.1;                           // min, against a standard

/* ------------------------------------------------------------ the traces */
export const SIG = 0.035;                            // a peak's SD in min (FWHM about 5 s)
const NORM = SIG * Math.sqrt(2 * Math.PI);
export const NOISE = GLU.minNz / NORM / 3;           // S/N 3 at glutaric's floor
export const BASE = 3 * NOISE;                       // the baseline under the noise
export const THRESHOLD = BASE + 3 * NOISE;           // S/N 3
/* run-to-run RT shifts, one per sample, fixed: what alignment has to absorb */
export const SHIFT = [-0.10, 0.06, 0.03, -0.05, 0.11, -0.12];
export const RT0 = 1.0, RT1 = 4.5, DT = 0.01;
export const MAP_RT = 10;                            // the map's RT axis, min

export const heightOf = (area) => area / NORM;
/* a spot's signal-to-noise at the one noise level the page draws: its peak height over the noise SD */
export const snOf = (area) => heightOf(area) / NOISE;

function traceOf(rng, j) {
  const n = Math.round((RT1 - RT0) / DT) + 1;
  const white = Array.from({ length: n + 4 }, () => rng.normal());
  let sm = Array.from({ length: n }, (_, i) => (white[i] + white[i + 1] + white[i + 2] + white[i + 3] + white[i + 4]) / 5);
  const sd = Math.sqrt(sm.reduce((s, v) => s + v * v, 0) / n);
  sm = sm.map((v) => (v / sd) * NOISE);
  const rt = Array.from({ length: n }, (_, i) => RT0 + i * DT);
  const truth = SLICE.map((m) => ({ m, rt: m.rt + SHIFT[j], area: m.at[j] }));
  const y = rt.map((t, i) => BASE + sm[i] + truth.reduce((s, p) => s + heightOf(p.area) * Math.exp(-0.5 * ((t - p.rt) / SIG) ** 2), 0));
  return { rt, y, truth };
}

/* Detection: a local maximum (over ±3 points) at or above S/N 3. Integration:
   the area over the baseline within ±3 SD of the apex. */
export function detect(tr) {
  const out = [], half = Math.round((3 * SIG) / DT);
  for (let i = 3; i < tr.y.length - 3; i++) {
    if (tr.y[i] < THRESHOLD) continue;
    let top = true;
    for (let k = -3; k <= 3; k++) if (tr.y[i + k] > tr.y[i]) top = false;
    if (!top) continue;
    const lo = Math.max(0, i - half), hi = Math.min(tr.y.length - 1, i + half);
    let area = 0;
    for (let k = lo; k <= hi; k++) area += (tr.y[k] - BASE) * DT;
    out.push({ i, rt: tr.rt[i], h: tr.y[i] - BASE, sn: (tr.y[i] - BASE) / NOISE, area, lo, hi });
  }
  return out;
}

/* Smoothed noise at S/N 3 passes a bump now and then. The trace for a sample is
   drawn again until its detections are exactly the MAF's non-zero peaks, so the
   page is about the two compounds, not the bumps; every draw is from `rng`. */
export function simulate(rng) {
  return SAMPLES.map((_, j) => {
    for (let tries = 0; tries < 400; tries += 1) {
      const tr = traceOf(rng, j), det = detect(tr), want = tr.truth.filter((p) => p.area > 0);
      if (det.length === want.length && want.every((p) => det.some((d) => Math.abs(d.rt - p.rt) < 0.05))) {
        det.forEach((d) => { d.j = j; d.who = tr.truth.reduce((a, b) => (Math.abs(b.rt - d.rt) < Math.abs(a.rt - d.rt) ? b : a)).m; });
        return { ...tr, det };
      }
    }
    throw new Error(`ms-features: no clean trace for sample ${j}`);
  });
}

/* ------------------------------------------------------------ the raw run, as a map */
/* Intensity on an m/z × RT grid for one sample (round 1, his pick: the page
   opens on the raw run, so Detect has something to find). Noise in every cell;
   a spot at each metabolite the file records as non-zero, its height the
   trace's. A spot is drawn 1.8× wider in RT than the trace's peak, so a peak a
   few seconds wide is visible on a 10-minute axis. */
export const GRID = { nRt: 500, nMz: 150, rt1: MAP_RT, mz0: 80, mz1: 230 };
export function rawGrid(rng, j) {
  const { nRt, nMz, rt1, mz0, mz1 } = GRID, I = new Float32Array(nRt * nMz);
  for (let i = 0; i < I.length; i++) I[i] = Math.abs(rng.normal()) * NOISE;
  const sRt = (1.8 * SIG) / (rt1 / nRt), sMz = 1.4 * (nMz / (mz1 - mz0));
  for (const m of METS) {
    const a = m.at[j];
    if (a <= 0) continue;
    const cx = ((m.rt + SHIFT[j]) / rt1) * nRt, cy = ((m.exact - mz0) / (mz1 - mz0)) * nMz;
    for (let x = Math.floor(cx - 4 * sRt); x <= cx + 4 * sRt; x++) for (let y = Math.floor(cy - 3 * sMz); y <= cy + 3 * sMz; y++) {
      if (x < 0 || y < 0 || x >= nRt || y >= nMz) continue;
      I[y * nRt + x] += heightOf(a) * Math.exp(-0.5 * ((x - cx) / sRt) ** 2) * Math.exp(-0.5 * ((y - cy) / sMz) ** 2);
    }
  }
  return I;
}

/* ------------------------------------------------------------ alignment */
export const WINDOWS = ["0.05", "0.3", "1.5"];
/* Peaks are sorted by RT and chained: a peak within the window of the previous
   one joins its feature. A feature's m/z is the slice's; its RT the mean. */
export function group(traces, window) {
  const all = traces.flatMap((t) => t.det).sort((a, b) => a.rt - b.rt);
  const gs = [];
  for (const p of all) {
    const g = gs.at(-1);
    if (g && p.rt - g.at(-1).rt <= window) g.push(p); else gs.push([p]);
  }
  return gs.map((peaks, k) => ({
    k, peaks, lo: peaks[0].rt, hi: peaks.at(-1).rt,
    rt: peaks.reduce((s, p) => s + p.rt, 0) / peaks.length,
    total: peaks.reduce((s, p) => s + p.area, 0),
    area: SAMPLES.map((_, j) => peaks.filter((p) => p.j === j).reduce((s, p) => s + p.area, 0)),
    who: [...new Set(peaks.map((p) => p.who.name))],
  }));
}
export const largest = (features) => features.reduce((a, b) => (b.total > a.total ? b : a));

/* ------------------------------------------------------------ identification */
export function identify(feature, tol) {
  const cands = candidates(FEATURE_MZ, tol);
  const byRt = cands.filter((m) => Math.abs(feature.rt - m.rt) <= RT_TOL);
  return { cands, byRt };
}
