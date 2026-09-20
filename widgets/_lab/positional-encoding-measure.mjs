/* Planning measurement for POSITIONAL ENCODING pages, asked for on
 * 2026-09-21 as a possible extension of slot 74 `embedding-space` for the
 * language lessons (PHM5005 08-1 cell 1 §2, 08-3 cell 4 §2): learned, fixed
 * sinusoidal, and relative (a rotation, RoPE). No widget has a self-attention
 * layer, so one is written here, single head, with its own backward, checked
 * against finite differences. The lesson's claims to test before any page is
 * drawn:
 *
 *   P0 "Without positional encoding the model treats the sequence as an
 *      unordered set." An ORDER task: two three-letter motifs both present in
 *      every sequence, class 1 when the first precedes the second. The bag of
 *      tokens is the same in both classes, so a model with no position must
 *      sit at chance. A PRESENCE task (one motif in or out) is the control:
 *      the same model with no position learns it, so the failure is order,
 *      not capacity.
 *   P1 LEARNED, SINUSOIDAL, ROPE on the order task: do all three learn it,
 *      in how many epochs, at what budget per epoch.
 *   P2 EXTRAPOLATION, the lesson's own note ("limited extrapolation" for
 *      learned, "generalizes to longer unseen sequences" for sinusoidal,
 *      "distances rather than absolute positions" for relative). Trained on
 *      L = 24. Tested (a) in range, (b) the SAME tokens at positions 24..47
 *      (the encoding alone shifted), (c) 24 random tokens prepended, the
 *      motifs in 24..47, (d) L = 48 with the motifs anywhere.
 *   P3 WHAT THE TRAINED POSITION TABLE LOOKS LIKE: the learned rows 0..23
 *      projected to 2-D, are consecutive positions neighbours (nearest
 *      neighbour is i ± 1), and does the first component run along the
 *      index; the sinusoid's table the same way, for the page's comparison.
 *   P4 THE SHIFT ITSELF: the attention scores among the same 24 tokens at
 *      positions 0..23 and at 24..47. RoPE's depend on i − j only, so the
 *      change is zero by construction; how large is it for the other two.
 *
 * Run:  node widgets/_lab/positional-encoding-measure.mjs   (15 s)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-21.  THE LESSON'S ORDER CLAIM HOLDS EXACTLY; ITS
 * EXTRAPOLATION CLAIMS HOLD FOR THE ENCODING, NOT FOR THE MODEL.
 *
 * P-1 — the backward matches finite differences (worst relative error 2e-8).
 * P0 — no position: the order task sits at 48–49% for thirty epochs while the
 *   presence task reaches 77–84% on the same model. The failure is order.
 *   34 ms an epoch of 300 sequences of 24: thirty epochs in about a second.
 * P1 — all three learn the order task in thirty epochs: learned 83–86%,
 *   sinusoidal 86–88%, RoPE 92–93% (single head, mean pool; a page that
 *   wants 100% needs more epochs or a second head — to tune at the draft).
 *   Learned costs 768 more parameters (1,650 against 882).
 * P2 — the SAME tokens at positions 24..47: learned 46–61%, sinusoidal
 *   29–37% (below chance: the shifted encoding INVERTS what it learned),
 *   RoPE 92–93%, unchanged. With 24 real tokens prepended every encoding
 *   falls to 48–60%, RoPE included, and at L = 48 anywhere to 50–69%:
 *   that is the mean pool and one head diluted over twice the tokens, not
 *   the encoding, so the page's shift is of the POSITIONS, and it claims
 *   nothing about longer sequences.
 * P3 — the trained learned table has NO neighbour structure on this task:
 *   the nearest row is i ± 1 for 21% of positions (13% at init), consecutive
 *   rows' cosine 0.07, against the sinusoid's 100% and 0.94. The order task
 *   needs only "which is earlier", so a page must not say learned positions
 *   become ordered. Rows 24..47, never indexed, do not move at all.
 *   The sinusoid's p_i · p_j at offsets 0..8 is 8.0 7.5 6.4 5.5 5.6 6.1 6.4
 *   5.9 4.7, the same from i = 10 and from i = 30 — a function of the offset
 *   alone, not monotone at d = 16 (its fastest pair turns a radian a step).
 * P4 — the attention scores among the same 24 tokens moved by 24 positions:
 *   learned change by 2.6 on average (largest 14) against a mean |score| of
 *   2.5; sinusoidal by 3.1 (largest 14) against 4.3; RoPE by 0.000 —
 *   the relative claim, exact, and drawable as two score matrices.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import { attnModel, sinusoid, nParams } from "./attention-lab.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const f = (v, d = 2) => Number(v).toFixed(d);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const F = (n) => new Float64Array(n);

/* ---------------------------------------------------------- the vocabulary */
const AA = "AVLIMFWYSTNQCGPKRHDE"; // PAD = 0, tokens 1..20
const tokOf = (c) => AA.indexOf(c) + 1;
const M1 = "WKD", M2 = "HPC"; // the two motifs of the order task

/* ---------------------------------------------------------------- tasks */
/** two motifs, both present once, non-overlapping, placed within [lo, lo + span); class 1 when M1 comes first */
function orderTask(rng, n, { Ltot = 24, lo = 0, span = 24 } = {}) {
  const out = [];
  const hasEither = (s) => { const str = s.join(""); return str.includes(M1) || str.includes(M2); };
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let s, a, b;
    do {
      s = Array.from({ length: Ltot }, () => AA[Math.floor(rng.next() * 20)]);
      a = lo + Math.floor(rng.next() * (span - 3)); b = lo + Math.floor(rng.next() * (span - 3));
    } while (hasEither(s) || Math.abs(a - b) < 3);
    const first = y ? M1 : M2, second = y ? M2 : M1;
    const [pa, pb] = a < b ? [a, b] : [b, a];
    for (let j = 0; j < 3; j++) { s[pa + j] = first[j]; s[pb + j] = second[j]; }
    out.push({ x: { tok: Int32Array.from(s.map(tokOf)), L: Ltot }, y });
  }
  return out;
}
/** one motif in (class 1) or out (class 0): the control task */
function presenceTask(rng, n, L = 24) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let s;
    do { s = Array.from({ length: L }, () => AA[Math.floor(rng.next() * 20)]); } while (s.join("").includes(M1));
    if (y) { const at = Math.floor(rng.next() * (L - 3)); for (let j = 0; j < 3; j++) s[at + j] = M1[j]; }
    out.push({ x: { tok: Int32Array.from(s.map(tokOf)), L }, y });
  }
  return out;
}
/** the same sequences with every position moved by `by` (the tokens untouched) */
const shifted = (data, by) => data.map(({ x, y }) => ({ x: { tok: x.tok, L: x.L, pos: Int32Array.from(x.tok, (_, i) => i + by) }, y }));

/* ---------------------------------------------------------- P-1 gradient */
head("P-1 · the head's backward against finite differences (learned, then rope)");
for (const pe of ["learned", "rope", "sinusoidal"]) {
  const rng = makeRng(7), m = attnModel(rng, { pe, Lmax: 12 });
  const [{ x, y }] = orderTask(makeRng(8), 1, { Ltot: 12, span: 12 });
  const loss = () => E.softmaxCE(m.forward(x), y).loss;
  for (const p of m.params) p.g.fill(0);
  const { g } = E.softmaxCE(m.forward(x), y); m.backward(g);
  let worst = 0, checked = 0;
  for (const p of m.params) {
    const idx = [0, Math.floor(p.v.length / 3), p.v.length - 1].filter((i) => !(p === m.tok && i < m.D));
    for (const i of idx) {
      const v0 = p.v[i], eps = 1e-5;
      p.v[i] = v0 + eps; const lp = loss(); p.v[i] = v0 - eps; const lm = loss(); p.v[i] = v0;
      const num = (lp - lm) / (2 * eps), ana = p.g[i];
      const rel = Math.abs(num - ana) / (Math.abs(num) + Math.abs(ana) + 1e-9);
      if (Math.abs(num) + Math.abs(ana) > 1e-7) { worst = Math.max(worst, rel); checked++; }
    }
  }
  console.log(`${pe.padEnd(10)}: ${checked} entries checked, worst relative error ${worst.toExponential(1)}`);
}

/* ------------------------------------------------------------- training */
function fit({ pe, task = "order", seed = 1, epochs = 30, n = 300, lr = 3e-3, Lmax = 48 }) {
  const rng = makeRng(seed), m = attnModel(makeRng(seed + 100), { pe, Lmax });
  const source = (e) => (task === "order" ? orderTask(makeRng(seed * 1000 + e), n) : presenceTask(makeRng(seed * 1000 + e), n));
  const curve = [];
  const test = task === "order" ? orderTask(makeRng(seed + 200), 300) : presenceTask(makeRng(seed + 200), 300);
  const t1 = performance.now();
  E.train(rng, m, source, { epochs, lr, onEpoch: (e) => { if ((e + 1) % 5 === 0) curve.push(E.accuracy(m, test)); } });
  return { m, ms: performance.now() - t1, curve, acc: E.accuracy(m, test), test };
}

/* ================================================================== P0 */
head("P0 · no position: the order task against the presence task (D = 16, dk = 8, 300 × 30 epochs, Adam 3e-3)");
for (const task of ["order", "presence"]) {
  const rs = [1, 2].map((seed) => fit({ pe: "none", task, seed }));
  console.log(`${task.padEnd(8)}, no position: held-out ${rs.map((r) => pct(r.acc)).join(" / ")} · at epochs 5..30: ${rs[0].curve.map(pct).join(" ")} · ${f(rs[0].ms / 30, 0)} ms an epoch · ${nParams(rs[0].m)} parameters`);
}

/* ============================================================ P1 · P2 */
head("P1 · P2 · learned, sinusoidal, RoPE on the order task; then the same model on unseen positions");
const kept = {};
for (const pe of ["learned", "sinusoidal", "rope"]) {
  const lines = [];
  for (const seed of [1, 2, 3]) {
    const r = fit({ pe, seed });
    const inRange = r.acc;
    const shiftPos = E.accuracy(r.m, shifted(r.test, 24));
    const prepended = E.accuracy(r.m, orderTask(makeRng(seed + 300), 300, { Ltot: 48, lo: 24, span: 24 }));
    const longer = E.accuracy(r.m, orderTask(makeRng(seed + 400), 300, { Ltot: 48, lo: 0, span: 48 }));
    lines.push(`seed ${seed}: in range ${pct(inRange)} (epochs 5..30: ${r.curve.map(pct).join(" ")}) · positions +24 ${pct(shiftPos)} · 24 prepended ${pct(prepended)} · L = 48 anywhere ${pct(longer)} · ${f(r.ms / 30, 0)} ms/epoch`);
    if (seed === 1) kept[pe] = r;
  }
  console.log(`${pe} (${nParams(kept[pe].m)} parameters):\n  ${lines.join("\n  ")}`);
}

/* ================================================================== P3 */
head("P3 · the trained position table (rows 0..23), and the sinusoid's: are consecutive positions neighbours?");
function tableStats(rows) {
  const n = rows.length, dist = (a, b) => Math.sqrt(a.reduce((p, v, i) => p + (v - b[i]) ** 2, 0));
  let adj = 0;
  for (let i = 0; i < n; i++) { let bd = Infinity, bj = -1; for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(rows[i], rows[j]); if (d < bd) { bd = d; bj = j; } } if (Math.abs(bj - i) === 1) adj++; }
  /* first principal component by the power method; Spearman of its score against the index */
  const D = rows[0].length, mu = Array.from({ length: D }, (_, e) => mean(rows.map((r) => r[e])));
  const X = rows.map((r) => r.map((v, e) => v - mu[e]));
  let v = Array.from({ length: D }, (_, e) => Math.sin(e + 1));
  for (let it = 0; it < 300; it++) { const w = new Array(D).fill(0); for (const r of X) { const s = r.reduce((p, q, e) => p + q * v[e], 0); for (let e = 0; e < D; e++) w[e] += s * r[e]; } const nrm = Math.sqrt(w.reduce((p, q) => p + q * q, 0)) || 1; v = w.map((q) => q / nrm); }
  const score = X.map((r) => r.reduce((p, q, e) => p + q * v[e], 0));
  const rank = (a) => { const o = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
  const rs = rank(score), ri = rows.map((_, i) => i), mr = mean(rs), mi = mean(ri);
  let num = 0, d1 = 0, d2 = 0; for (let i = 0; i < n; i++) { num += (rs[i] - mr) * (ri[i] - mi); d1 += (rs[i] - mr) ** 2; d2 += (ri[i] - mi) ** 2; }
  const cosAdj = mean(rows.slice(1).map((r, i) => { const a = rows[i]; let d = 0, na = 0, nb = 0; for (let e = 0; e < D; e++) { d += a[e] * r[e]; na += a[e] ** 2; nb += r[e] ** 2; } return d / Math.sqrt(na * nb); }));
  return { adj: adj / n, rho: Math.abs(num / Math.sqrt(d1 * d2)), cosAdj };
}
{
  const m = kept.learned.m, rows = Array.from({ length: 24 }, (_, p) => Array.from(m.pos.v.slice(p * m.D, (p + 1) * m.D)));
  const init = attnModel(makeRng(101), { pe: "learned" }); // seed 1 + 100, the same init
  const rows0 = Array.from({ length: 24 }, (_, p) => Array.from(init.pos.v.slice(p * m.D, (p + 1) * m.D)));
  const s0 = tableStats(rows0), s1 = tableStats(rows), sS = tableStats(sinusoid(24, 16));
  console.log(`learned, at init:  nearest neighbour is i ± 1 for ${pct(s0.adj)} of positions · |Spearman| of PC1 against the index ${f(s0.rho)} · mean cosine of consecutive rows ${f(s0.cosAdj)}`);
  console.log(`learned, trained:  nearest neighbour is i ± 1 for ${pct(s1.adj)} of positions · |Spearman| ${f(s1.rho)} · consecutive cosine ${f(s1.cosAdj)}`);
  console.log(`sinusoidal, fixed: nearest neighbour is i ± 1 for ${pct(sS.adj)} of positions · |Spearman| ${f(sS.rho)} · consecutive cosine ${f(sS.cosAdj)}`);
  const untrained = Array.from({ length: 24 }, (_, p) => Array.from(m.pos.v.slice((24 + p) * m.D, (25 + p) * m.D)));
  const moved = mean(rows.map((r, p) => Math.sqrt(r.reduce((s, v, e) => s + (v - rows0[p][e]) ** 2, 0))));
  const movedU = mean(untrained.map((r, p) => Math.sqrt(r.reduce((s, v, e) => s + (v - init.pos.v[(24 + p) * m.D + e]) ** 2, 0))));
  console.log(`rows 0..23 moved ${f(moved)} from their init on average; rows 24..47, never indexed in training, moved ${f(movedU)} (they stay N(0, 1) noise)`);
  const S = sinusoid(48, 16), dot = (a, b) => a.reduce((p, v, i) => p + v * b[i], 0);
  console.log(`sinusoid p_i · p_j for i = 10 and j = 10..18: ${Array.from({ length: 9 }, (_, k) => f(dot(S[10], S[10 + k]), 1)).join(" ")} · the same offsets from i = 30: ${Array.from({ length: 9 }, (_, k) => f(dot(S[30], S[30 + k]), 1)).join(" ")}`);
}

/* ================================================================== P4 */
head("P4 · the same 24 tokens at positions 0..23 and at 24..47: how much do the attention scores change?");
{
  const [{ x }] = orderTask(makeRng(9), 1);
  for (const pe of ["learned", "sinusoidal", "rope"]) {
    const m = kept[pe].m;
    const S0 = m.scores(x), S1 = m.scores({ tok: x.tok, L: x.L, pos: Int32Array.from(x.tok, (_, i) => i + 24) });
    let sum = 0, mx = 0, n = 0, spread = 0;
    for (let i = 0; i < x.L; i++) for (let j = 0; j < x.L; j++) { const d = Math.abs(S0[i][j] - S1[i][j]); sum += d; mx = Math.max(mx, d); n++; spread += Math.abs(S0[i][j]); }
    console.log(`${pe.padEnd(10)}: mean |Δ score| ${f(sum / n, 3)} · largest ${f(mx, 3)} · against a mean |score| of ${f(spread / n, 3)}`);
  }
}

console.log(`\ntotal ${secs()} s`);
