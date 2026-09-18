/* Planning measurement for slot 70 `mutational-signatures` (PHM5003 07 /
 * 01-4), after NMF 0.28 was installed on Kenneth's approval (2026-09-18).
 *
 *   Rscript widgets/_lab/mutational-signatures-nmf.R "<07 - Cancer Mutation Analysis>" <dir> > widgets/_lab/mutational-signatures-nmf.txt
 *   node widgets/_lab/mutational-signatures-measure.mjs <dir> > widgets/_lab/mutational-signatures-measure.txt
 *
 * The R script reruns 01-4 on the lesson's MAF and checks every number the
 * notebook printed (cells 4, 11, 12, 14, 21, 24, 30: 9 checks). This script
 * reads what it wrote to <dir> — TCGA- and COSMIC-derived, never in the repo —
 * and measures the planning model, `_lab/mutational-signatures-model.js`,
 * against it:
 *
 *   §1 The lesson's five signatures: how many tumours hold each, and how far
 *      each best match is ahead of the runner-up, in both catalogues.
 *   §2 The look-alike references: each against the COSMIC profile it stands
 *      for, the catalogue's geometry against the real one, and the lesson's
 *      signatures ranked against the look-alikes.
 *   §3 The simulated cohort's counts against the lesson's matrix.
 *   §4 Extraction over ten seeds, at ranks 3, 4 and 5, without and with one
 *      hypermutated tumour at TCGA-AN-A046's share (7.1%).
 *   §5 The flat signature: what built it against what it is named.
 *   §6 How large the tumour must be to take a signature.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as M from "./mutational-signatures-model.js";
import { makeRng } from "../core/rng.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node mutational-signatures-measure.mjs <dir written by mutational-signatures-nmf.R>"); process.exit(1); }
function readTsv(file) {
  const L = readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean);
  const h = L[0].replace(/\r$/, "").split("\t");
  return { h, rows: L.slice(1).map((l) => l.replace(/\r$/, "").split("\t")) };
}
/* Columns of a channel-by-name table, aligned to CHANNELS by name: the two
   catalogues list their rows in different orders. */
function byChannel(file) {
  const { h, rows } = readTsv(file);
  const at = M.CHANNELS.map((c) => rows.findIndex((r) => r[0] === c));
  if (at.some((i) => i < 0)) throw new Error(`${file}: a channel is missing`);
  return Object.fromEntries(h.slice(1).map((n, k) => [n, at.map((i) => +rows[i][k + 1])]));
}
let checks = 0, failed = 0;
function ck(label, cond, note = "") {
  checks += 1;
  if (!cond) failed += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${note ? " — " + note : ""}`);
}
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3), pc = (x) => `${(100 * x).toFixed(1)}%`;
const legacy = byChannel("ref_legacy.tsv"), sbs = byChannel("ref_SBS.tsv");
const real = { ...legacy, ...sbs };
const aet = (f) => Object.fromEntries(readTsv(f).rows.map((r) => [r[0], r[1]]));
const aetiology = { ...aet("aet_legacy.tsv"), ...aet("aet_SBS.tsv") };
const lesson = byChannel("lesson_sigs.tsv");
const LS = Object.keys(lesson);

/* ------------------------------------------------------------------ §1 */
console.log("§1 the lesson's five signatures (cell 21), who holds them, and how clear each best match is");
const E = readTsv("lesson_expo.tsv");
const tumours = E.h.slice(1);
const T = readTsv("tnm.tsv");
const tnm = new Map(T.rows.map((r) => [r[0], r.slice(1).map(Number)]));
for (let k = 0; k < 5; k += 1) {
  const w = lesson[LS[k]];
  /* contributions_abs is H with W's columns unscaled; the mutations signature k
     explains in tumour j are H[k][j] times the column sum NMF left in W, the
     same for every j, so shares over tumours read straight off H's row. */
  const h = E.rows[k].slice(1).map(Number);
  const hold = M.holders(h);
  const rank = (cat) => Object.entries(cat).map(([n, v]) => [n, M.cosine(w, v)]).sort((a, b) => b[1] - a[1]);
  const L = rank(legacy), S = rank(sbs);
  console.log(`  ${LS[k]}: largest holder ${tumours[hold.top]} ${pc(hold.topShare)}, tumours holding half ${hold.half}`
    + `\n    legacy ${L[0][0]} ${f3(L[0][1])} ahead of ${L[1][0]} ${f3(L[1][1])} by ${f3(L[0][1] - L[1][1])}; SBS ${S[0][0]} ${f3(S[0][1])} ahead of ${S[1][0]} ${f3(S[1][1])} by ${f3(S[0][1] - S[1][1])}`
    + `\n    named "${aetiology[L[0][0]]}" in legacy, "${aetiology[S[0][0]]}" in SBS`);
}
{
  const s1 = M.holders(E.rows[0].slice(1).map(Number));
  ck("Signature_1: one tumour holds half of it, TCGA-AN-A046", s1.half === 1 && tumours[s1.top] === "TCGA-AN-A046", `${pc(s1.topShare)}`);
  ck("Signature_1 is that tumour's own profile", M.cosine(lesson[LS[0]], tnm.get("TCGA-AN-A046")) > 0.999, f3(M.cosine(lesson[LS[0]], tnm.get("TCGA-AN-A046"))));
  const a046 = M.sum(tnm.get("TCGA-AN-A046")), all = [...tnm.values()].reduce((s, v) => s + M.sum(v), 0);
  ck("TCGA-AN-A046's share of the cohort's SNVs is LESSON_HYPER_SHARE", Math.abs(a046 / all - M.LESSON_HYPER_SHARE) < 1e-12, `${a046} of ${all}, ${pc(a046 / all)}`);
}

/* ------------------------------------------------------------------ §2 */
console.log("\n§2 the look-alike references against the profiles they stand for");
const flat = new Array(96).fill(1);
let worst = 1;
for (const r of M.REFERENCES) {
  const c = r.scored.map((n) => M.cosine(r.profile, real[n]));
  worst = Math.min(worst, ...c);
  const best = Object.entries(real).map(([n, v]) => [n, M.cosine(r.profile, v)]).sort((a, b) => b[1] - a[1])[0];
  console.log(`  ${r.name.padEnd(32)} ${r.scored.map((n, i) => `${n} ${f3(c[i])}`).join(", ")}; nearest real ${best[0]} ${f3(best[1])}; flatness ${f3(M.cosine(r.profile, flat))} against ${f3(M.cosine(real[r.scored[1]], flat))}`);
}
ck("every look-alike is within cosine 0.8 of both profiles it stands for", worst >= 0.8, `lowest ${f3(worst)}`);
console.log("  pairs, look-alike against the real SBS pair (legacy pair):");
const R = M.REFERENCES;
let geomOff = 0;
for (let i = 0; i < R.length; i += 1) for (let j = i + 1; j < R.length; j += 1) {
  const c = M.cosine(R[i].profile, R[j].profile), rs = M.cosine(real[R[i].scored[1]], real[R[j].scored[1]]), rl = M.cosine(real[R[i].scored[0]], real[R[j].scored[0]]);
  geomOff = Math.max(geomOff, Math.abs(c - rs));
  if (c > 0.5 || rs > 0.5) console.log(`    ${R[i].key}~${R[j].key} ${f3(c)} against ${f3(rs)} (${f3(rl)})`);
}
console.log(`  largest difference from the SBS geometry over all ${(R.length * (R.length - 1)) / 2} pairs: ${f3(geomOff)}`);
console.log("  the lesson's signatures ranked against the look-alikes:");
for (const n of LS) {
  const m = M.matches(lesson[n]);
  console.log(`    ${n}: ${m.slice(0, 3).map((x) => `${x.name} ${f3(x.cos)}`).join(", ")}`);
}
ck("the lesson's Signature_1 matches Polymerase epsilon, Signature_2 the two APOBEC look-alikes first and second",
  M.matches(lesson[LS[0]])[0].key === "pole" && M.matches(lesson[LS[1]]).slice(0, 2).map((x) => x.key).join() === "apobecT,apobecG");

/* ------------------------------------------------------------------ §3 */
console.log("\n§3 the simulated cohort's counts against the lesson's matrix");
const lessonCounts = [...tnm.values()].map(M.sum).sort((a, b) => a - b);
const q = (a, p) => a[Math.floor(p * (a.length - 1))];
const simCounts = [];
for (let seed = 1; seed <= 10; seed += 1) simCounts.push(...M.makeCohort(makeRng(seed), { tumours: 100 }).counts);
simCounts.sort((a, b) => a - b);
for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) console.log(`  ${String(p).padEnd(4)} lesson ${String(q(lessonCounts, p)).padStart(4)}   simulated (ten cohorts of 100) ${String(q(simCounts, p)).padStart(4)}`);
ck("the simulated median is within 20% of the lesson's 42", Math.abs(q(simCounts, 0.5) / 42 - 1) < 0.2, String(q(simCounts, 0.5)));
{
  const co = M.makeCohort(makeRng(1), { tumours: 100 });
  const tot = M.PLANTED.map((_, k) => co.expo.reduce((s, e) => s + (e ? e[k] : 0), 0));
  const carriers = M.PLANTED.map((_, k) => co.expo.filter((e) => e && e[k] > 0).length);
  console.log(`  seed 1: planted mutations by process ${M.PLANTED.map((p, k) => `${p.key} ${Math.round(tot[k])} in ${carriers[k]} tumours`).join(", ")}`);
}

/* ------------------------------------------------------------------ §4 */
console.log("\n§4 extraction over seeds 1–10 (100 tumours, pConstant 0.1)");
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function run(seed, r, hyper) {
  const co = M.makeCohort(makeRng(seed), { tumours: 100, hyper });
  const t0 = performance.now();
  const ex = M.extract(co.M, r, makeRng(seed * 7919 + 1));
  const ms = performance.now() - t0;
  const hyperCol = co.hyperIndex >= 0 ? co.M.map((row) => row[co.hyperIndex]) : null;
  const sigs = ex.signatures.map((s, k) => {
    const hold = M.holders(ex.exposures[k]);
    const planted = co.profiles.map((p) => M.cosine(s, p));
    return { s, hold, planted, isTumour: !!hyperCol && M.cosine(s, hyperCol) > 0.99 && hold.top === co.hyperIndex, match: M.matches(s), mix: M.plantedMix(s, co.profiles) };
  });
  const recovery = co.profiles.map((p) => Math.max(...ex.signatures.map((s) => M.cosine(s, p))));
  return { co, ex, ms, sigs, recovery };
}
const results = {};
let msAll = [], itAll = [];
for (const r of [3, 4, 5]) for (const hyper of [0, M.LESSON_HYPER_SHARE]) {
  const runs = SEEDS.map((seed) => run(seed, r, hyper));
  results[`${r}/${hyper ? "in" : "out"}`] = runs;
  msAll.push(...runs.map((x) => x.ms)); itAll.push(...runs.map((x) => x.ex.iterations));
  const tookOne = runs.filter((x) => x.sigs.some((s) => s.isTumour)).length;
  const rec = M.PLANTED.map((p, k) => runs.map((x) => x.recovery[k]).sort((a, b) => a - b));
  console.log(`  rank ${r}, the tumour ${hyper ? "in" : "out"}: ${hyper ? `a signature is the tumour's own in ${tookOne} of 10; ` : ""}recovery (median, lowest) ${M.PLANTED.map((p, k) => `${p.key} ${f3(rec[k][5])} ${f3(rec[k][0])}`).join(", ")}`);
  if (hyper) {
    const own = runs.flatMap((x) => x.sigs.filter((s) => s.isTumour));
    if (own.length) console.log(`    the tumour's signature: largest holder ${pc(Math.min(...own.map((s) => s.hold.topShare)))}–${pc(Math.max(...own.map((s) => s.hold.topShare)))}, tumours holding half ${[...new Set(own.map((s) => s.hold.half))].join("/")}, best match ${[...new Set(own.map((s) => s.match[0].name))].join("/")} ${f3(Math.min(...own.map((s) => s.match[0].cos)))}–${f3(Math.max(...own.map((s) => s.match[0].cos)))}`);
  }
}
{
  const r4 = results["4/in"];
  const took = r4.filter((x) => x.sigs.some((s) => s.isTumour && s.hold.half === 1)).length;
  ck("at rank 4 with the tumour in, one start gives it its own signature, held half by it alone, in at least 9 of 10 seeds", took >= 9, `${took} of 10`);
  /* A miss is a worse fit, not another answer: from three starts a seed, the
     lowest divergence gives the tumour its own signature every time, and each
     start that missed it stopped higher. */
  let bestOwn = 0, missHigher = 0, misses = 0;
  const missLines = [];
  for (const seed of SEEDS) {
    const co = M.makeCohort(makeRng(seed), { tumours: 100, hyper: M.LESSON_HYPER_SHARE });
    const col = co.M.map((row) => row[co.hyperIndex]);
    const starts = [1, 2, 3].map((st) => {
      const ex = M.extract(co.M, 4, makeRng(seed * 7919 + st));
      const own = ex.signatures.some((s, k) => M.cosine(s, col) > 0.99 && M.holders(ex.exposures[k]).top === co.hyperIndex);
      return { kl: ex.kl, own, it: ex.iterations };
    });
    const best = starts.reduce((a, b) => (b.kl < a.kl ? b : a));
    if (best.own) bestOwn += 1;
    for (const s of starts.filter((x) => !x.own)) {
      misses += 1;
      const hit = starts.filter((x) => x.own);
      if (hit.length && s.kl > Math.max(...hit.map((x) => x.kl))) missHigher += 1;
      missLines.push(`seed ${seed}: a start without it stopped at divergence ${s.kl.toFixed(1)} after ${s.it} iterations; with it, ${hit.map((x) => x.kl.toFixed(1)).join(", ") || "none"}`);
    }
  }
  ck("from three starts, the lowest divergence gives the tumour its own signature in all 10 seeds", bestOwn === 10, `${bestOwn} of 10`);
  ck("every start that missed it stopped at a higher divergence than every start that found it", missHigher === misses, `${misses} misses in 30 starts`);
  for (const l of missLines) console.log(`    ${l}`);
  const lost = r4.map((x) => M.PLANTED.filter((p, k) => x.recovery[k] < 0.9).map((p) => p.key).join("+") || "none");
  console.log(`  rank 4, the tumour in — planted processes below cosine 0.9, by seed: ${lost.join(", ")}`);
  const r4o = results["4/out"];
  console.log(`  rank 4, the tumour out — below cosine 0.9, by seed: ${r4o.map((x) => M.PLANTED.filter((p, k) => x.recovery[k] < 0.9).map((p) => p.key).join("+") || "none").join(", ")}`);
  const apo = [...results["4/out"], ...results["4/in"]].map((x) => x.sigs.find((s) => s.planted[2] === Math.max(...x.sigs.map((t) => t.planted[2]))));
  console.log(`  the APOBEC signature (C>T and C>G planted together): best ${[...new Set(apo.map((s) => s.match[0].name))].join("/")} ${f3(Math.min(...apo.map((s) => s.match[0].cos)))}–${f3(Math.max(...apo.map((s) => s.match[0].cos)))}, runner-up ${[...new Set(apo.map((s) => s.match[1].name))].join("/")} ${f3(Math.min(...apo.map((s) => s.match[1].cos)))}–${f3(Math.max(...apo.map((s) => s.match[1].cos)))}`);
}
console.log(`  one extraction: median ${Math.round(msAll.sort((a, b) => a - b)[msAll.length >> 1])} ms, longest ${Math.round(msAll.at(-1))} ms; iterations median ${itAll.sort((a, b) => a - b)[itAll.length >> 1]}, most ${itAll.at(-1)} (Node ${process.version})`);

/* ------------------------------------------------------------------ §5 */
console.log("\n§5 the flat signature: what built it against what it is named");
for (const key of ["3/out", "4/in"]) {
  const runs = results[key];
  let named = 0, n = 0;
  const lines = [];
  for (const x of runs) {
    /* the flat signature: the one the two flat planted processes explain most of */
    const s = [...x.sigs].sort((a, b) => (b.mix[1] + b.mix[3]) - (a.mix[1] + a.mix[3]))[0];
    const clock = s.mix[1], hr = s.mix[3];
    if (clock + hr < 0.6) continue;
    n += 1;
    /* Misnamed: the best match is one of the two flat builders, and it is the
       one that built LESS of the signature. */
    const smaller = clock < hr ? "clock" : "hr";
    const wrong = s.match[0].key === smaller;
    if (wrong) named += 1;
    lines.push(`${s.match[0].key} ${f3(s.match[0].cos)} / ${s.match[1].key} ${f3(s.match[1].cos)} — built ${pc(clock)} clock-like, ${pc(hr)} recombination defect${wrong ? "  ← named after the smaller" : ""}`);
  }
  console.log(`  rank ${key.replace("/", ", the tumour ")}: a flat signature in ${n} of 10; named after the process that built less of it in ${named}`);
  for (const l of lines) console.log(`    ${l}`);
  const flip = lines.filter((l) => l.startsWith("clock")).length;
  console.log(`    named Clock-like in ${flip} and Recombination defect in ${lines.length - flip}; the best match ahead of the runner-up by ${f3(Math.min(...runs.map((x) => { const s = [...x.sigs].sort((a, b) => (b.mix[1] + b.mix[3]) - (a.mix[1] + a.mix[3]))[0]; return s.match[0].cos - s.match[1].cos; })))}–${f3(Math.max(...runs.map((x) => { const s = [...x.sigs].sort((a, b) => (b.mix[1] + b.mix[3]) - (a.mix[1] + a.mix[3]))[0]; return s.match[0].cos - s.match[1].cos; })))}`);
}

/* ------------------------------------------------------------------ §6 */
console.log("\n§6 how large the tumour must be to take a signature (rank 4, seeds 1–10)");
for (const share of [0.01, 0.02, 0.03, 0.05, M.LESSON_HYPER_SHARE, 0.1, 0.15]) {
  const runs = SEEDS.map((seed) => run(seed, 4, share));
  const took = runs.filter((x) => x.sigs.some((s) => s.isTumour)).length;
  const counts = runs.map((x) => x.co.counts[x.co.hyperIndex]).sort((a, b) => a - b);
  console.log(`  ${pc(share).padStart(6)} of the cohort's mutations (${counts[0]}–${counts.at(-1)} mutations): its own signature in ${took} of 10`);
}

console.log(`\n${checks} checks, ${failed} failed`);
