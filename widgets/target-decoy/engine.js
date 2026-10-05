/* target-decoy's engine — a database search from first principles, and
 * protein inference by parsimony. Measured in `_lab/proteomics-arc-measure.mjs`
 * and mocked in `_lab/target-decoy-mock.html` (catalogue § Slot 88), which
 * import this file through `_lab/proteomics-arc-model.js`.
 *
 * 01-1 cell 2's figure is a chain — protein sequences concatenated with their
 * reversed sequences, each spectrum matched, target and decoy PSMs, a
 * histogram with the FDR threshold — so the score is computed, not drawn from
 * two curves (his pick, 2026-10-05). The decoy works here for the reason the
 * lesson gives: a reversed protein has a target's composition and masses, so
 * a spectrum with no correct candidate is as likely to land on a decoy as on
 * a wrong target. Measured over 10 seeds at a score of 7 or more: 271 decoys,
 * 284 wrong targets.
 */

/* Monoisotopic residue masses (Da); C carbamidomethylated, as most searches fix it. */
export const RESIDUE = {
  G: 57.02146, A: 71.03711, S: 87.03203, P: 97.05276, V: 99.06841, T: 101.04768, C: 160.03065, L: 113.08406,
  I: 113.08406, N: 114.04293, D: 115.02694, Q: 128.05858, K: 128.09496, E: 129.04259, M: 131.04049,
  H: 137.05891, F: 147.06841, R: 156.10111, Y: 163.06333, W: 186.07931,
};
export const WATER = 18.01056;
export const PROTON = 1.00728;
/* Amino-acid frequencies in vertebrate proteins (percent), close enough for a toy proteome. */
const AA_FREQ = { A: 7.4, R: 4.2, N: 4.4, D: 5.9, C: 3.3, Q: 3.7, E: 5.8, G: 7.4, H: 2.9, I: 3.8, L: 7.6, K: 7.2,
  M: 1.8, F: 4.0, P: 5.0, S: 8.1, T: 6.2, W: 1.3, Y: 3.3, V: 6.8 };
const AA_TOTAL = Object.values(AA_FREQ).reduce((s, v) => s + v, 0);

function aaDraw(rng) {
  let u = rng.next() * AA_TOTAL;
  for (const [a, w] of Object.entries(AA_FREQ)) { u -= w; if (u <= 0) return a; }
  return "A";
}
export function randomProtein(rng, len) { let s = "M"; for (let i = 1; i < len; i += 1) s += aaDraw(rng); return s; }

/** Trypsin: cut after K or R, not before P; keep peptides of 7–25 residues. */
export function digest(seq, { min = 7, max = 25 } = {}) {
  const out = [];
  let start = 0;
  for (let i = 0; i < seq.length; i += 1) {
    if ((seq[i] === "K" || seq[i] === "R") && seq[i + 1] !== "P") {
      const p = seq.slice(start, i + 1);
      if (p.length >= min && p.length <= max) out.push(p);
      start = i + 1;
    }
  }
  const last = seq.slice(start);
  if (last.length >= min && last.length <= max) out.push(last);
  return out;
}
export const reverse = (s) => [...s].reverse().join("");
export const peptideMass = (p) => [...p].reduce((s, a) => s + RESIDUE[a], 0) + WATER;

/** Singly charged b and y ions, in m/z order within each series. */
export function fragments(p) {
  const b = [], y = [];
  let s = 0;
  for (let i = 0; i < p.length - 1; i += 1) { s += RESIDUE[p[i]]; b.push(s + PROTON); }
  s = 0;
  for (let i = p.length - 1; i > 0; i -= 1) { s += RESIDUE[p[i]]; y.push(s + WATER + PROTON); }
  return { b, y };
}
/** Is there a peak within `tol` of m? `peaks` sorted. */
export function onPeak(peaks, m, tol) {
  let lo = 0, hi = peaks.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (peaks[mid] < m - tol) lo = mid + 1; else hi = mid; }
  return Math.abs(peaks[lo] - m) <= tol;
}
/** The score: how many of a peptide's b and y ions land within `tol` of a peak. */
export function matchCount(peaks, p, tol) {
  const { b, y } = fragments(p);
  let n = 0;
  for (const m of b) if (onPeak(peaks, m, tol)) n += 1;
  for (const m of y) if (onPeak(peaks, m, tol)) n += 1;
  return n;
}

export const SEARCH = { proteins: 400, absentProteins: 300, spectra: 3000, window: 0.5, tol: 0.5, noise: 120, qualityLo: 0.08, qualityHi: 0.7 };

/**
 * The search. A random proteome is the target database; the decoy database is
 * every protein reversed and digested the same way, so a decoy peptide has a
 * target's composition and mass range and is never the answer. Each spectrum
 * comes from one peptide — in the database (share `inDb`) or from a protein
 * that is not — and shows each of its fragments with a probability that
 * varies spectrum to spectrum (its quality), among noise peaks. Every target
 * and decoy peptide within the precursor window is scored by matched
 * fragments; the best is the PSM. The best target and the best decoy are kept
 * so the figure can draw both ladders.
 */
export function search(rng, opts = {}) {
  const o = { ...SEARCH, inDb: 0.6, ...opts };
  const rand = () => randomProtein(rng, 150 + Math.floor(rng.next() * 450));
  const prot = Array.from({ length: o.proteins }, rand);
  const absent = Array.from({ length: o.absentProteins }, rand);
  const tPeps = [...new Set(prot.flatMap((s) => digest(s)))];
  const tSet = new Set(tPeps);
  const dPeps = [...new Set(prot.flatMap((s) => digest(reverse(s))))].filter((p) => !tSet.has(p));
  const aPeps = [...new Set(absent.flatMap((s) => digest(s)))];
  const db = [...tPeps.map((p) => ({ p, decoy: false })), ...dPeps.map((p) => ({ p, decoy: true }))]
    .map((e) => ({ ...e, m: peptideMass(e.p) })).sort((a, b) => a.m - b.m);
  const masses = db.map((e) => e.m);
  const psms = [];
  for (let s = 0; s < o.spectra; s += 1) {
    const inDatabase = rng.next() < o.inDb;
    const src = inDatabase ? tPeps[Math.floor(rng.next() * tPeps.length)] : aPeps[Math.floor(rng.next() * aPeps.length)];
    const q = rng.uniform(o.qualityLo, o.qualityHi);
    const { b, y } = fragments(src);
    const peaks = [];
    for (const m of [...b, ...y]) if (rng.next() < q) peaks.push(m + rng.normal(0, 0.1));
    for (let k = 0; k < o.noise; k += 1) peaks.push(rng.uniform(100, 2000));
    peaks.sort((u, v) => u - v);
    const M0 = peptideMass(src);
    let lo = 0, hi = masses.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (masses[mid] < M0 - o.window) lo = mid + 1; else hi = mid; }
    let best = null, bestT = null, bestD = null, nCand = 0;
    for (let i = lo; i < masses.length && masses[i] <= M0 + o.window; i += 1) {
      nCand += 1;
      const sc = matchCount(peaks, db[i].p, o.tol) + rng.next() * 1e-3; // a hair of jitter breaks ties at random
      const e = { score: sc, ...db[i] };
      if (!best || sc > best.score) best = e;
      if (db[i].decoy) { if (!bestD || sc > bestD.score) bestD = e; } else if (!bestT || sc > bestT.score) bestT = e;
    }
    if (!best) continue;
    const kind = best.decoy ? "decoy" : best.p === src ? "correct" : "wrong";
    psms.push({ score: best.score, ions: Math.floor(best.score), kind, hasCorrect: inDatabase, peptide: best.p, source: src,
      quality: q, peaks, candidates: nCand, mass: M0, bestT, bestD });
  }
  return { psms, prot, targets: tPeps.length, decoys: dPeps.length, absent: aPeps.length };
}

/* ------------------------------------------------- whole-score thresholds */

/** Counts per whole score 0..max (the last bin holds max and above). */
export function binCounts(psms, k = psms.length, max = 30) {
  const c = Array.from({ length: max + 1 }, () => ({ correct: 0, wrong: 0, decoy: 0 }));
  for (let i = 0; i < k; i += 1) c[Math.min(max, psms[i].ions)][psms[i].kind] += 1;
  return c;
}
/** At or above whole score t: targets, decoys, wrong targets, and the two FDRs. */
export function aboveFrom(c, t) {
  let T = 0, D = 0, W = 0;
  for (let s = Math.max(0, t); s < c.length; s += 1) { T += c[s].correct + c[s].wrong; D += c[s].decoy; W += c[s].wrong; }
  return { T, D, W, est: T ? D / T : 0, tru: T ? W / T : 0 };
}
/**
 * The lowest whole score from which every higher threshold also estimates at
 * most `level` — the q-value on whole scores. Scores are whole ions, so no
 * threshold lands exactly on a level: on the default search the 5% point is a
 * score that estimates 2.6%.
 */
export function levelThreshold(c, level) {
  let t = c.length;
  for (let s = c.length - 1; s >= 0; s -= 1) {
    const a = aboveFrom(c, s);
    if (a.T > 0 && a.est <= level) t = s; else if (a.T > 0) break;
  }
  return t;
}

/* ------------------------------------------------------ protein inference */

/** 01-1 cell 2's protein figure, its own case. */
export const FIGURE = {
  proteins: [
    { id: "I", peptides: ["A", "B"] }, { id: "II", peptides: ["B"] }, { id: "III", peptides: ["C", "D", "E"] },
    { id: "IV", peptides: ["E", "F"] }, { id: "V", peptides: ["F", "G"] }, { id: "VI", peptides: ["F", "G"] },
  ],
  peptides: ["A", "B", "C", "D", "E", "F", "G"],
};

/**
 * Protein inference by parsimony, the three rules 01-1 cell 2 lists:
 * proteins with identical peptide sets are one group; a protein whose
 * peptides are a subset of another's is eliminated; a protein with no unique
 * peptide that is not a subset is subsumable. Then the minimal set: a greedy
 * cover of the observed peptides, largest new coverage first, among the
 * groups that are not subsets.
 */
export function inferProteins(proteins, observed) {
  const obs = new Set(observed);
  const sets = proteins.map((p) => ({ id: p.id, peps: p.peptides.filter((x) => obs.has(x)) })).filter((p) => p.peps.length);
  const groups = new Map();
  for (const p of sets) {
    const k = [...p.peps].sort().join(",");
    if (!groups.has(k)) groups.set(k, { ids: [], peps: new Set(p.peps) });
    groups.get(k).ids.push(p.id);
  }
  const g = [...groups.values()];
  const isSubset = (a, b) => a !== b && a.peps.size < b.peps.size && [...a.peps].every((x) => b.peps.has(x));
  for (const a of g) a.subset = g.some((b) => isSubset(a, b));
  const count = new Map();
  for (const a of g) for (const x of a.peps) count.set(x, (count.get(x) || 0) + 1);
  for (const a of g) a.unique = [...a.peps].some((x) => count.get(x) === 1);
  for (const a of g) a.subsumable = !a.subset && !a.unique;
  const left = new Set(observed);
  const chosen = [];
  const pool = g.filter((a) => !a.subset);
  while (left.size) {
    let best = null, bestN = 0;
    for (const a of pool) {
      if (chosen.includes(a)) continue;
      const nn = [...a.peps].filter((x) => left.has(x)).length;
      if (nn > bestN || (nn === bestN && best && a.unique && !best.unique)) { best = a; bestN = nn; }
    }
    if (!best) break;
    chosen.push(best);
    for (const x of best.peps) left.delete(x);
  }
  for (const a of g) a.reported = chosen.includes(a);
  return g;
}
