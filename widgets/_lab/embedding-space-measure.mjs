/* Planning measurement for a candidate widget on the EMBEDDING AS A SPACE
 * (PHM5005 07-1 cell 3, `dl-sequential-embedding.png`'s "Vector space" panel),
 * asked for on 2026-09-21 when slot 74 `sequence-encoding` was found to be
 * largely on widget 75's input panel already. The claim to test before any
 * page is drawn: one-hot puts every pair of tokens at the same distance, and
 * an embedding trained on a task LEARNS a geometry in which tokens with the
 * same role become neighbours — a geometry nobody typed in. For DNA's four
 * tokens there is nothing to see; the vocabulary has to be larger.
 *
 *   E1 AMINO ACIDS BY ROLE — 20 residues in four roles (hydrophobic, polar,
 *      positive, negative). A class-1 sequence carries a 4-slot pattern
 *      hydrophobic·hydrophobic·positive·negative, each slot a RANDOM residue
 *      of that role, so no single residue is the cue; class 0 carries none.
 *      Embedding(21, E) → Conv1d(E, 8, k = 4) → ReLU → global max → Linear.
 *      Does the trained table put same-role residues together? Measured as
 *      the within-role against between-role distance ratio in E dimensions,
 *      the nearest-neighbour role purity (chance ≈ 0.28), and the top-two
 *      principal components' share of the variance (what a 2-D picture keeps).
 *   E2 CODONS BY SYNONYMY — 64 codons read through the genetic code; the
 *      planted motif is three amino acids (L, R, S: six codons each) written
 *      each time in random synonymous codons. Do synonymous codons become
 *      neighbours — for the motif's amino acids, and for the rest, which get
 *      no signal?
 *   E3 ONE-HOT ON THE SAME TASKS — a fixed identity table: accuracy, and the
 *      parameter count against the embedding's.
 *   E4 THE EMBEDDING SIZE — E = 2 (drawable with no projection), 4, 8, 16:
 *      purity and accuracy.
 *   E5 THE GEOMETRY PER EPOCH — purity and ratio after each epoch, so a page
 *      could show the points moving as the model trains; and the budget in ms.
 *
 * Run:  node widgets/_lab/embedding-space-measure.mjs   (11 s, node v24)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-21.  THE CLAIM HOLDS, where the model learns the task.
 *
 * E1 — amino acids, E = 8, 20 epochs: on the seed that reaches 99% the
 *   table's nearest-neighbour role purity goes 35% → 100% (chance 28%) and
 *   the within/between distance ratio 1.03 → 0.74; on seeds that stall at
 *   61% and 81% it reaches 75% and 90%.  The geometry is the learning.
 * E2 — codons, E = 8: the motif's eighteen codons (L, R, S) reach 100%
 *   purity (chance 29%) — synonymous codons become neighbours — while the
 *   other 43 codons, which the task never rewards, stay at chance (2.3%).
 *   ONLY THE TOKENS THE TASK USES GET A GEOMETRY.
 * E3 — one-hot reaches 100% on both tasks: the embedding buys no accuracy at
 *   this size, it buys parameters (450 against 698 on amino acids, 450
 *   against 1,586 on codons) and the geometry.  A one-hot table has every
 *   pair at the same distance and nothing to draw.
 * E4 — E = 2 and 4 do not learn the four-role task (54–68%, 57%); E = 8
 *   learns on some seeds in 20 epochs, E = 16 on all.  So the picture is a
 *   PROJECTION, never the table itself.
 * E5 — the geometry moves with the accuracy, epoch by epoch: ratio 1.04 and
 *   purity 35% through epoch 10, then 0.74 and 100% by epoch 20 as the
 *   held-out accuracy climbs 58% → 99%.  21 ms an epoch at E = 8 — a page
 *   can train on the click and draw the points moving.
 * E6 — THE 2-D PICTURE: at E = 8 and 40 epochs every seed reaches 91–100%
 *   with purity 100% in 8-D and 85–95% AFTER projection to the top two
 *   components; at E = 16 the projection keeps less (65–85% in 2-D although
 *   90–100% in 16-D).  The codon motif's eighteen read 100% in 2-D.  So the
 *   widget's setting is E = 8, 40 epochs (0.8 s), a PCA to two dimensions,
 *   and the projection must be aligned frame to frame (Procrustes to the
 *   previous epoch) or the picture will rotate as it trains — to measure at
 *   the draft.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const f = (v, d = 2) => Number(v).toFixed(d);
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;

/* ------------------------------------------------------- the vocabularies */
const AA = "AVLIMFWYSTNQCGPKRHDE"; // 20, PAD = 0, tokens 1..20
const ROLE_OF = {};
for (const c of "AVLIMFWY") ROLE_OF[c] = "hydrophobic";
for (const c of "STNQCGP") ROLE_OF[c] = "polar";
for (const c of "KRH") ROLE_OF[c] = "positive";
for (const c of "DE") ROLE_OF[c] = "negative";
const aaTok = (c) => AA.indexOf(c) + 1;
const byRole = (role) => [...AA].filter((c) => ROLE_OF[c] === role);

const BASES = "TCAG";
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"; // TCAG order
const CODONS = [], AA_OF = {};
for (let i = 0; i < 64; i++) { const c = BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3]; CODONS.push(c); AA_OF[c] = CODE[i]; }
const codonTok = (c) => CODONS.indexOf(c) + 1;
const synonyms = (aa) => CODONS.filter((c) => AA_OF[c] === aa);

/* ------------------------------------------------------------- the tasks */
function aaTask(rng, n, L = 60) {
  const roles = ["hydrophobic", "hydrophobic", "positive", "negative"];
  const hasPattern = (s) => { for (let i = 0; i + 4 <= s.length; i++) if (roles.every((r, j) => ROLE_OF[s[i + j]] === r)) return true; return false; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let s;
    do { s = Array.from({ length: L }, () => AA[Math.floor(rng.next() * 20)]); } while (hasPattern(s));
    if (y) { const at = Math.floor(rng.next() * (L - 4)); roles.forEach((r, j) => { const pool = byRole(r); s[at + j] = pool[Math.floor(rng.next() * pool.length)]; }); }
    out.push({ x: { tok: Int32Array.from(s.map(aaTok)), L }, y });
  }
  return out;
}
function codonTask(rng, n, L = 30) {
  const motif = ["L", "R", "S"];
  const hasMotif = (aas) => { for (let i = 0; i + 3 <= aas.length; i++) if (motif.every((a, j) => aas[i + j] === a)) return true; return false; };
  const sense = CODONS.filter((c) => AA_OF[c] !== "*");
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let s;
    do { s = Array.from({ length: L }, () => sense[Math.floor(rng.next() * sense.length)]); } while (hasMotif(s.map((c) => AA_OF[c])));
    if (y) { const at = Math.floor(rng.next() * (L - 3)); motif.forEach((a, j) => { const pool = synonyms(a); s[at + j] = pool[Math.floor(rng.next() * pool.length)]; }); }
    out.push({ x: { tok: Int32Array.from(s.map(codonTok)), L }, y });
  }
  return out;
}

/* ------------------------------------------------------------- the model */
function build(rng, V, Edim, k, { onehot = false } = {}) {
  const rows = onehot ? Array.from({ length: V }, (_, v) => Array.from({ length: V }, (_, e) => (e === v && v > 0 ? 1 : 0))) : null;
  const emb = E.Embedding(rng, V, onehot ? V : Edim, 0, rows);
  const net = E.Sequential([emb, E.Conv1d(rng, emb.E, 8, k, 1, 0, true), E.ReLU(), E.GlobalPool(8, "max"), E.Linear(rng, 8, 2)]);
  net.emb = emb;
  return net;
}
const paramCount = (net) => net.params.reduce((p, q) => p + q.v.length, 0);

/* ---------------------------------------------------------- the geometry */
function rowsOf(emb, ids) { return ids.map((id) => Array.from(emb.W.v.slice(id * emb.E, (id + 1) * emb.E))); }
const dist = (a, b) => Math.sqrt(a.reduce((p, v, i) => p + (v - b[i]) ** 2, 0));
/** within-group against between-group mean distance, nearest-neighbour purity, and the top-two PCs' variance share */
function geometry(emb, ids, groupOf) {
  const R = rowsOf(emb, ids), n = ids.length;
  let win = [], btw = [], pure = 0;
  for (let i = 0; i < n; i++) {
    let best = Infinity, bj = -1;
    for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(R[i], R[j]); (groupOf(i) === groupOf(j) ? win : btw).push(d); if (d < best) { best = d; bj = j; } }
    if (groupOf(bj) === groupOf(i)) pure++;
  }
  /* PCA by the power method on the covariance, two components */
  const Ed = R[0].length, mu = Array.from({ length: Ed }, (_, e) => mean(R.map((r) => r[e])));
  const X = R.map((r) => r.map((v, e) => v - mu[e]));
  const total = X.reduce((p, r) => p + r.reduce((q, v) => q + v * v, 0), 0);
  let Xr = X.map((r) => r.slice()), kept = 0;
  for (let c = 0; c < 2 && Ed > 1; c++) {
    let v = Array.from({ length: Ed }, (_, e) => Math.sin(e + 1 + c));
    for (let it = 0; it < 200; it++) { const w = new Array(Ed).fill(0); for (const r of Xr) { const s = r.reduce((p, q, e) => p + q * v[e], 0); for (let e = 0; e < Ed; e++) w[e] += s * r[e]; } const nrm = Math.sqrt(w.reduce((p, q) => p + q * q, 0)) || 1; v = w.map((q) => q / nrm); }
    let lam = 0; Xr = Xr.map((r) => { const s = r.reduce((p, q, e) => p + q * v[e], 0); lam += s * s; return r.map((q, e) => q - s * v[e]); });
    kept += lam;
  }
  return { ratio: mean(win) / mean(btw), purity: pure / n, pc2: total ? kept / total : 1 };
}
const chanceAA = mean([...AA].map((c) => (byRole(ROLE_OF[c]).length - 1) / 19));

function run({ task, V, ids, groupOf, Edim = 8, k = 4, epochs = 20, n = 300, lr = 1e-2, seed = 1, onehot = false, perEpoch = false }) {
  const rng = makeRng(seed);
  const net = build(makeRng(seed + 100), V, Edim, k, { onehot });
  const test = task(makeRng(seed + 200), 300);
  const trace = [];
  const g0 = onehot ? null : geometry(net.emb, ids, groupOf);
  const t1 = performance.now();
  E.train(rng, net, (e) => task(makeRng(seed * 1000 + e), n), { epochs, lr, onEpoch: (e) => { if (perEpoch && !onehot) trace.push({ e: e + 1, ...geometry(net.emb, ids, groupOf), acc: E.accuracy(net, test) }); } });
  const ms = performance.now() - t1;
  return { acc: E.accuracy(net, test), g0, g: onehot ? null : geometry(net.emb, ids, groupOf), ms, params: paramCount(net), trace };
}

/* ===================================================================== E1 */
head("E1 · amino acids by role: does the trained table put same-role residues together?  E = 8, k = 4, 300 × 20 epochs, Adam 1e-2");
const AA_IDS = [...AA].map(aaTok), aaGroup = (i) => ROLE_OF[AA[i]];
console.log(`chance nearest-neighbour purity ${pct(chanceAA)}; a random table's within/between ratio is about 1`);
for (const seed of [1, 2, 3]) {
  const r = run({ task: aaTask, V: 21, ids: AA_IDS, groupOf: aaGroup, seed });
  console.log(`seed ${seed}: held-out ${pct(r.acc)} · ratio ${f(r.g0.ratio)} → ${f(r.g.ratio)} · purity ${pct(r.g0.purity)} → ${pct(r.g.purity)} · top-2 PCs keep ${pct(r.g.pc2)} of the variance · ${f(r.ms / 1000, 1)} s · ${r.params} parameters`);
}

/* ===================================================================== E2 */
head("E2 · codons by synonymy: the motif L·R·S in random synonymous codons; E = 8, k = 3, 300 × 20 epochs");
const SENSE = CODONS.filter((c) => AA_OF[c] !== "*"), CODON_IDS = SENSE.map(codonTok), codonGroup = (i) => AA_OF[SENSE[i]];
const motifIdx = SENSE.map((c, i) => ("LRS".includes(AA_OF[c]) ? i : -1)).filter((i) => i >= 0);
const chanceCodon = mean(SENSE.map((c) => (synonyms(AA_OF[c]).length - 1) / (SENSE.length - 1)));
console.log(`chance purity over all 61 sense codons ${pct(chanceCodon)}; the motif's 18 codons among themselves ${pct(5 / 17)}`);
for (const seed of [1, 2]) {
  const r = run({ task: codonTask, V: 65, ids: CODON_IDS, groupOf: codonGroup, k: 3, seed });
  console.log(`seed ${seed}: held-out ${pct(r.acc)} · all sense codons: ratio ${f(r.g0.ratio)} → ${f(r.g.ratio)}, purity ${pct(r.g0.purity)} → ${pct(r.g.purity)} · ${f(r.ms / 1000, 1)} s`);
}
{
  /* the motif's codons alone, from a fresh run whose table is kept */
  const seed = 1, rng = makeRng(seed), net = build(makeRng(seed + 100), 65, 8, 3);
  E.train(rng, net, (e) => codonTask(makeRng(seed * 1000 + e), 300), { epochs: 20, lr: 1e-2 });
  const gm = geometry(net.emb, motifIdx.map((i) => CODON_IDS[i]), (i) => AA_OF[SENSE[motifIdx[i]]]);
  const rest = SENSE.map((_, i) => i).filter((i) => !motifIdx.includes(i));
  const gr = geometry(net.emb, rest.map((i) => CODON_IDS[i]), (i) => AA_OF[SENSE[rest[i]]]);
  console.log(`seed 1, the motif's 18 codons (L, R, S): ratio ${f(gm.ratio)}, purity ${pct(gm.purity)} (chance ${pct(5 / 17)}); the other 43: ratio ${f(gr.ratio)}, purity ${pct(gr.purity)}`);
}

/* ===================================================================== E3 */
head("E3 · one-hot on the same tasks: a fixed identity table");
for (const seed of [1, 2]) {
  const r = run({ task: aaTask, V: 21, ids: AA_IDS, groupOf: aaGroup, seed, onehot: true });
  console.log(`amino acids, seed ${seed}: held-out ${pct(r.acc)} · ${r.params} parameters (one-hot [21] rows into the k = 4 kernel) · ${f(r.ms / 1000, 1)} s`);
}
{
  const r = run({ task: codonTask, V: 65, ids: CODON_IDS, groupOf: codonGroup, k: 3, seed: 1, onehot: true });
  console.log(`codons, seed 1: held-out ${pct(r.acc)} · ${r.params} parameters (one-hot [65] rows into the k = 3 kernel) · ${f(r.ms / 1000, 1)} s`);
}

/* ===================================================================== E4 */
head("E4 · the embedding size on the amino-acid task: E = 2 · 4 · 8 · 16");
for (const Edim of [2, 4, 8, 16]) {
  const rs = [1, 2].map((seed) => run({ task: aaTask, V: 21, ids: AA_IDS, groupOf: aaGroup, Edim, seed }));
  console.log(`E = ${String(Edim).padStart(2)}: held-out ${rs.map((r) => pct(r.acc)).join(" / ")} · ratio ${rs.map((r) => f(r.g.ratio)).join(" / ")} · purity ${rs.map((r) => pct(r.g.purity)).join(" / ")} · top-2 PCs ${rs.map((r) => pct(r.g.pc2)).join(" / ")} · ${rs.map((r) => r.params).join(" / ")} params · ${f(mean(rs.map((r) => r.ms)) / 1000, 1)} s`);
}

/* ===================================================================== E5 */
head("E5 · the geometry per epoch (amino acids, E = 8, seed 1), and the budget");
{
  const r = run({ task: aaTask, V: 21, ids: AA_IDS, groupOf: aaGroup, seed: 1, perEpoch: true });
  for (const t of r.trace) console.log(`  epoch ${String(t.e).padStart(2)}: held-out ${pct(t.acc).padStart(6)} · ratio ${f(t.ratio)} · purity ${pct(t.purity)}`);
  console.log(`${f(r.ms / 20, 0)} ms an epoch of 300 sequences of 60 at E = 8; the geometry read after each epoch costs nothing a page would notice`);
  const r2 = run({ task: aaTask, V: 21, ids: AA_IDS, groupOf: aaGroup, seed: 1, Edim: 2, perEpoch: true });
  console.log(`E = 2, drawable with no projection: ${r2.trace.map((t) => `${t.e}:${pct(t.purity)}`).join(" ")}`);
}

/* ===================================================================== E6 */
head("E6 · the 2-D picture: nearest-neighbour purity AFTER projecting the trained table onto its top two components; E = 8 and 16, 20 and 40 epochs");
{
  const project2 = (emb, ids) => {
    const R = rowsOf(emb, ids), Ed = R[0].length, mu = Array.from({ length: Ed }, (_, e) => mean(R.map((r) => r[e])));
    let Xr = R.map((r) => r.map((v, e) => v - mu[e])); const P = R.map(() => []);
    for (let c = 0; c < 2; c++) {
      let v = Array.from({ length: Ed }, (_, e) => Math.sin(e + 1 + c));
      for (let it = 0; it < 200; it++) { const w = new Array(Ed).fill(0); for (const r of Xr) { const s = r.reduce((p, q, e) => p + q * v[e], 0); for (let e = 0; e < Ed; e++) w[e] += s * r[e]; } const nrm = Math.sqrt(w.reduce((p, q) => p + q * q, 0)) || 1; v = w.map((q) => q / nrm); }
      Xr = Xr.map((r, i) => { const s = r.reduce((p, q, e) => p + q * v[e], 0); P[i].push(s); return r.map((q, e) => q - s * v[e]); });
    }
    return P;
  };
  const purity2 = (P, groupOf) => { let pure = 0; for (let i = 0; i < P.length; i++) { let best = Infinity, bj = -1; for (let j = 0; j < P.length; j++) { if (i === j) continue; const d = dist(P[i], P[j]); if (d < best) { best = d; bj = j; } } if (groupOf(bj) === groupOf(i)) pure++; } return pure / P.length; };
  for (const [Edim, epochs] of [[8, 20], [8, 40], [16, 20], [16, 40]]) {
    const line = [];
    for (const seed of [1, 2, 3]) {
      const rng = makeRng(seed), net = build(makeRng(seed + 100), 21, Edim, 4);
      E.train(rng, net, (e) => aaTask(makeRng(seed * 1000 + e), 300), { epochs, lr: 1e-2 });
      const acc = E.accuracy(net, aaTask(makeRng(seed + 200), 300));
      const g = geometry(net.emb, AA_IDS, aaGroup), p2 = purity2(project2(net.emb, AA_IDS), aaGroup);
      line.push(`seed ${seed}: acc ${pct(acc)}, purity ${pct(g.purity)} in ${Edim}-D, ${pct(p2)} in 2-D`);
    }
    console.log(`E = ${String(Edim).padStart(2)}, ${epochs} epochs — ${line.join(" · ")}`);
  }
  /* the codon table's 2-D picture: the motif's 18 codons */
  const seed = 1, rng = makeRng(seed), net = build(makeRng(seed + 100), 65, 16, 3);
  E.train(rng, net, (e) => codonTask(makeRng(seed * 1000 + e), 300), { epochs: 20, lr: 1e-2 });
  const ids = motifIdx.map((i) => CODON_IDS[i]), grp = (i) => AA_OF[SENSE[motifIdx[i]]];
  console.log(`codons, E = 16, the motif's 18: purity ${pct(geometry(net.emb, ids, grp).purity)} in 16-D, ${pct(purity2(project2(net.emb, ids), grp))} in 2-D; all 61: ${pct(purity2(project2(net.emb, CODON_IDS), codonGroup))} in 2-D (chance ${pct(chanceCodon)})`);
}

console.log(`\ntotal ${secs()} s`);
