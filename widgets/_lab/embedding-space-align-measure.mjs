/* Planning measurement for slot 74 `embedding-space`, the one the handover
 * asked for BEFORE the first mock is shown (2026-09-21): the widget draws the
 * trained table's twenty rows projected onto their top two principal
 * components, epoch by epoch, and a PCA recomputed each epoch has no fixed
 * orientation: the picture would rotate, flip and jump as it trains while
 * the geometry underneath moves smoothly. Four ways of holding the frame
 * still are measured on the same trajectory (E = 8, 40 epochs, three seeds):
 *
 *   A OWN BASIS, RAW: each epoch's own PCA, signs as the power method
 *     leaves them. What a naive page would draw.
 *   B OWN BASIS + PROCRUSTES CHAIN: each epoch's own PCA, then the
 *     orthogonal map (a rotation, or a reflection and a rotation) that best
 *     lays it over the previous drawn frame. What the handover proposed.
 *   C FINAL BASIS: every epoch's rows projected onto the FINAL table's two
 *     components. Possible because compute() trains all epochs before the
 *     first frame is drawn, so the end is known at the start.
 *   D OWN BASIS + PROCRUSTES TO FINAL: each epoch's own PCA laid over the
 *     final frame rather than the previous one (no chain, so no drift).
 *
 * For each: the mean step a point takes between consecutive frames, the
 * largest step, the total path each point walks, the raw rotation between
 * frames (A only, what B, C and D remove), and the nearest-neighbour role
 * purity in 2-D at epochs 0, 10, 20, 30, 40 (C can lose early structure by
 * looking along the wrong axes; A, B and D cannot, a rotation keeps
 * distances). Also the RMS radius of the cloud per epoch, for the axes, and
 * the table at epoch 0: N(0, 1) rows as torch initialises them, which is
 * where the points start. NOT an equidistant one-hot arrangement, which
 * cannot exist in eight dimensions for twenty tokens.
 *
 * Run:  node widgets/_lab/embedding-space-align-measure.mjs   (~3 s)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-21.  THE RAW PICTURE SPINS; ANY OF THE THREE HOLDS IT.
 *
 * A — raw own-basis PCA: on seed 2 four of forty frames are REFLECTIONS of
 *   the previous and four rotate by more than 22.5°; the largest single step
 *   a point takes is 2.0–2.7 (the whole cloud flipping) against a cloud
 *   radius of about 2; each point walks 4.8 / 14.2 / 7.4 in all.
 * B — own basis + Procrustes chain: largest step 0.15–0.28, path 3.5–5.5.
 * C — the FINAL table's basis, fixed: the smoothest, largest step 0.12–0.20,
 *   path 2.7–3.8, and the structure shows EARLIER (purity 60% at epoch 20
 *   on seed 2 against 45% in the epoch's own basis; 70% at epoch 0 on
 *   seed 3) — because the axes are chosen with hindsight from the end, and
 *   the init already has some spread along them. Honest only with the
 *   axes named on the figure as the trained table's.
 * D — own basis laid over the final frame: as still as B (largest step
 *   0.15–0.28, path 3.6–5.6) with no chain to drift, and every frame is
 *   that epoch's own best two-dimensional view. RECOMMENDED: compute()
 *   trains every epoch before the first frame, so the final frame is
 *   known at the start.
 * The cloud's RMS radius grows 1.9–2.0 → 2.1–2.5 over training (the 8-D row
 *   norm 2.9 → 3.1–3.7), so fixed axes at ±3 hold every frame. At epoch 0
 *   the rows are N(0, 1) and the 2-D purity is 15–35% (chance 28%): the
 *   points START AS NOISE, not as an equidistant one-hot arrangement — a
 *   one-hot code is a distance matrix with every off-diagonal entry √2, and
 *   that is the honest way to draw it beside the trained table's matrix.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const f = (v, d = 2) => Number(v).toFixed(d);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);

/* -------------------------------------------- the task, as the first script */
const AA = "AVLIMFWYSTNQCGPKRHDE";
const ROLE_OF = {};
for (const c of "AVLIMFWY") ROLE_OF[c] = "hydrophobic";
for (const c of "STNQCGP") ROLE_OF[c] = "polar";
for (const c of "KRH") ROLE_OF[c] = "positive";
for (const c of "DE") ROLE_OF[c] = "negative";
const aaTok = (c) => AA.indexOf(c) + 1;
const byRole = (role) => [...AA].filter((c) => ROLE_OF[c] === role);
const AA_IDS = [...AA].map(aaTok), roleOf = (i) => ROLE_OF[AA[i]];
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
function build(rng, Edim = 8, k = 4) {
  const emb = E.Embedding(rng, 21, Edim, 0);
  const net = E.Sequential([emb, E.Conv1d(rng, Edim, 8, k, 1, 0, true), E.ReLU(), E.GlobalPool(8, "max"), E.Linear(rng, 8, 2)]);
  net.emb = emb;
  return net;
}
const rowsOf = (emb) => AA_IDS.map((id) => Array.from(emb.W.v.slice(id * emb.E, (id + 1) * emb.E)));

/* ------------------------------------------------------------------ PCA */
/** the top two unit components of centred rows, by the power method with deflation; signs as it leaves them */
function basis(R) {
  const Ed = R[0].length, mu = Array.from({ length: Ed }, (_, e) => mean(R.map((r) => r[e])));
  let Xr = R.map((r) => r.map((v, e) => v - mu[e]));
  const B = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: Ed }, (_, e) => Math.sin(e + 1 + c));
    for (let it = 0; it < 300; it++) { const w = new Array(Ed).fill(0); for (const r of Xr) { const s = r.reduce((p, q, e) => p + q * v[e], 0); for (let e = 0; e < Ed; e++) w[e] += s * r[e]; } const nrm = Math.sqrt(w.reduce((p, q) => p + q * q, 0)) || 1; v = w.map((q) => q / nrm); }
    Xr = Xr.map((r) => { const s = r.reduce((p, q, e) => p + q * v[e], 0); return r.map((q, e) => q - s * v[e]); });
    B.push(v);
  }
  return { mu, B };
}
const project = (R, { mu, B }) => R.map((r) => B.map((v) => r.reduce((p, q, e) => p + (q - mu[e]) * v[e], 0)));

/* ------------------------------------------------------------ Procrustes */
/** the orthogonal 2-D map (rotation, reflection allowed) laying P over A; both centred */
function procrustes(P, A) {
  let best = null;
  for (const refl of [1, -1]) {
    const Q = P.map(([x, y]) => [x, refl * y]);
    let sc = 0, ss = 0;
    for (let i = 0; i < Q.length; i++) { const [ax, ay] = A[i], [bx, by] = Q[i]; sc += ax * bx + ay * by; ss += ay * bx - ax * by; }
    const th = Math.atan2(ss, sc), c = Math.cos(th), s = Math.sin(th);
    const R = Q.map(([x, y]) => [c * x - s * y, s * x + c * y]);
    const resid = R.reduce((p, [x, y], i) => p + (x - A[i][0]) ** 2 + (y - A[i][1]) ** 2, 0);
    if (!best || resid < best.resid) best = { R, resid, angle: th, refl: refl < 0 };
  }
  return best;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const purity2 = (P) => { let pure = 0; for (let i = 0; i < P.length; i++) { let bd = Infinity, bj = -1; for (let j = 0; j < P.length; j++) { if (i === j) continue; const d = dist(P[i], P[j]); if (d < bd) { bd = d; bj = j; } } if (roleOf(bj) === roleOf(i)) pure++; } return pure / P.length; };
const rms = (P) => Math.sqrt(mean(P.map(([x, y]) => x * x + y * y)));

/** steps between consecutive frames: mean, max, and each point's total path */
function motion(frames) {
  const steps = [], paths = new Array(frames[0].length).fill(0);
  for (let t = 1; t < frames.length; t++) {
    const d = frames[t].map((p, i) => dist(p, frames[t - 1][i]));
    steps.push(mean(d)); d.forEach((v, i) => { paths[i] += v; });
  }
  return { mean: mean(steps), max: Math.max(...steps), path: mean(paths), steps };
}

/* ================================================================== run */
const EPOCHS = 40;
const summary = [];
for (const seed of [1, 2, 3]) {
  head(`seed ${seed} · E = 8, k = 4, 300 × ${EPOCHS} epochs, Adam 1e-2`);
  const rng = makeRng(seed), net = build(makeRng(seed + 100));
  const tables = [rowsOf(net.emb)], accs = [];
  const test = aaTask(makeRng(seed + 200), 300);
  const t1 = performance.now();
  E.train(rng, net, (e) => aaTask(makeRng(seed * 1000 + e), 300), { epochs: EPOCHS, lr: 1e-2, onEpoch: () => { tables.push(rowsOf(net.emb)); accs.push(E.accuracy(net, test)); } });
  const ms = performance.now() - t1;
  console.log(`held-out ${accs.filter((a, i) => i % 10 === 9).map(pct).join(" → ")} at epochs 10 · 20 · 30 · 40 · ${f(ms / 1000, 1)} s`);

  /* A: own basis, raw */
  const own = tables.map((R) => project(R, basis(R)));
  /* raw rotation between frames: the Procrustes angle that WOULD align them */
  const angles = own.slice(1).map((P, t) => procrustes(P, own[t]));
  /* B: chain */
  const chain = [own[0]];
  for (let t = 1; t < own.length; t++) chain.push(procrustes(own[t], chain[t - 1]).R);
  /* C: final basis */
  const bF = basis(tables[tables.length - 1]);
  const fin = tables.map((R) => project(R, bF));
  /* D: own basis laid over the final frame */
  const toFinal = own.map((P) => procrustes(P, own[own.length - 1]).R);

  const mA = motion(own), mB = motion(chain), mC = motion(fin), mD = motion(toFinal);
  const flips = angles.filter((a) => a.refl).length, big = angles.filter((a) => Math.abs(a.angle) > Math.PI / 8).length;
  console.log(`A own basis, raw:            mean step ${f(mA.mean)} · largest ${f(mA.max)} · path ${f(mA.path)} · ${flips} of ${angles.length} frames REFLECT the previous, ${big} rotate by more than 22.5°`);
  console.log(`B own + Procrustes chain:    mean step ${f(mB.mean)} · largest ${f(mB.max)} · path ${f(mB.path)}`);
  console.log(`C final basis, fixed:        mean step ${f(mC.mean)} · largest ${f(mC.max)} · path ${f(mC.path)}`);
  console.log(`D own + Procrustes to final: mean step ${f(mD.mean)} · largest ${f(mD.max)} · path ${f(mD.path)}`);
  const at = [0, 10, 20, 30, 40];
  console.log(`2-D purity at epochs ${at.join(" · ")}: own basis (A, B, D) ${at.map((t) => pct(purity2(own[t]))).join(" · ")} · final basis (C) ${at.map((t) => pct(purity2(fin[t]))).join(" · ")}`);
  const norm = (R) => f(Math.sqrt(mean(R.map((r) => r.reduce((p, q) => p + q * q, 0)))), 1);
  console.log(`RMS radius of the cloud, own basis: ${at.map((t) => f(rms(own[t]), 1)).join(" · ")} · final basis ${at.map((t) => f(rms(fin[t]), 1)).join(" · ")} · the 8-D row norm at start ${norm(tables[0])}, at the end ${norm(tables[EPOCHS])}`);
  console.log(`the largest single step under B falls at epoch ${mB.steps.indexOf(mB.max) + 1}, under C at ${mC.steps.indexOf(mC.max) + 1}; per-epoch steps under C: ${mC.steps.map((s) => f(s, 1)).join(" ")}`);
  summary.push({ seed, A: mA, B: mB, C: mC, D: mD, flips, big, p20own: purity2(own[20]), p20fin: purity2(fin[20]) });
}

head("summary");
for (const s of summary) console.log(`seed ${s.seed}: path A ${f(s.A.path)} · B ${f(s.B.path)} · C ${f(s.C.path)} · D ${f(s.D.path)}; largest step A ${f(s.A.max)} · B ${f(s.B.max)} · C ${f(s.C.max)} · D ${f(s.D.max)}; purity at 20 own ${pct(s.p20own)} final ${pct(s.p20fin)}`);
console.log(`\ntotal ${secs()} s`);
