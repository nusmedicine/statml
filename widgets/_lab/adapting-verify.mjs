/* Widget 85's checks, run by `npm test`.

   The widget trains nothing in the browser: everything it draws is read from
   `widgets/adapting/table.js`, generated in torch by `_lab/adapting-table.py`
   (whose `--check` reruns one run and compares its curve and its maps byte for
   byte). This file holds the table to what the pages print and draw:

   1. What each way trains: the counts the map and the tiles print, by formula
      from the model's shapes (the head 48 x 2 + 2; LoRA r 8 on Q and V of both
      blocks; the backbone, its embeddings and two blocks), and the matrices
      each way's maps store — transfer the head alone; LoRA Q, V and the head;
      scratch and full every matrix. (The generator asserts the rest did not
      move by a single bit, so a hatched "frozen" tile is a fact.)
   2. LoRA's two drawings agree: the map's block-1 Q tile at step 400 is
      |(alpha/r) B A| from the detail's own stored factors, to one byte of the
      map's quantisation; and B is zero at step 0, so the update the detail
      draws starts at zero and W' = W, as its line says.
   3. The table's shape: 41 points a curve, eight snapshots of every stored
      matrix, notes one of each label within a line, base rates.
   4. Every claim a caption or line makes: transfer's head is the only thing
      that moved; full fine-tuning's median relative change is the number the
      caption prints; the curve ends the tiles print.
   5. The struck-word sweep over main.js's reader-facing copy (principle 5.9 and
      the memory notes).

   Run:  node widgets/_lab/adapting-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { TABLE: T } = await import(pathToFileURL(join(here, "..", "adapting", "table.js")).href);
const M = await import(pathToFileURL(join(here, "..", "transformer", "model.js")).href);

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
const bytes = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));
const signed = (u8) => Array.from(u8, (b) => (b > 127 ? b - 256 : b));
const ALL = Object.keys(T.shapes);

/* 1 · what each way trains */
const D = 48, F = 96, V = M.VOCAB.length, L = 64, r = T.r;
const lin = (i, o) => i * o + o;
const block = 4 * lin(D, D) + lin(D, F) + lin(F, D) + 2 * 2 * D;
const backbone = V * D + L * D + 2 * block, head = lin(D, 2), lora = 2 * 2 * (D * r + r * D);
ok(T.trains.backbone === backbone, `backbone ${T.trains.backbone}, by formula ${backbone}`);
ok(T.trains.transfer === head, `transfer trains ${T.trains.transfer}, the head is ${head}`);
ok(T.trains.lora === lora + head, `LoRA trains ${T.trains.lora}, by formula ${lora + head}`);
ok(T.trains.full === backbone + head && T.trains.scratch === backbone + head, "full and scratch train the backbone and the head");
ok(T.alpha / T.r === 4, "alpha / r is the 4 the page prints");
const STORED = { scratch: ALL, full: ALL, transfer: ["head.weight"],
  lora: ["head.weight", "blocks.1.att.q.weight", "blocks.1.att.v.weight", "blocks.0.att.q.weight", "blocks.0.att.v.weight"] };
for (const task of ["outcome", "match"]) for (const way of ["scratch", "transfer", "full", "lora"]) {
  const run = T.runs[task][way];
  ok(JSON.stringify([...run.mats].sort()) === JSON.stringify([...STORED[way]].sort()), `${task} ${way}: stores ${run.mats.length} matrices`);
  const per = run.mats.reduce((a, m) => a + T.shapes[m][0] * T.shapes[m][1], 0);
  ok(bytes(run.maps).length === per * (T.steps / T.snap), `${task} ${way}: ${T.steps / T.snap} snapshots of ${per} weights`);
  ok(run.curve.length === T.steps / T.every + 1 && run.curve.every((v) => v >= 0 && v <= 1), `${task} ${way}: 41 accuracies in [0, 1]`);
  ok(run.scale > 0, `${task} ${way}: a positive scale`);
}

/* 2 · LoRA's map and its detail agree */
for (const task of ["outcome", "match"]) {
  const run = T.runs[task].lora, fac = run.lora, last = fac[fac.length - 1], first = fac[0];
  ok(first.step === 0 && first.B.flat().every((v) => v === 0), `${task}: B is zero at step 0, so the update starts at zero`);
  ok(fac.length === T.steps / T.lsnap + 1 && last.step === T.steps, `${task}: factors every ${T.lsnap} steps to ${T.steps}`);
  ok(first.A.length === r && first.A[0].length === D && first.B.length === D && first.B[0].length === r, `${task}: A is ${r} x ${D}, B ${D} x ${r}`);
  const raw = signed(bytes(run.maps)), per = run.mats.reduce((a, m) => a + T.shapes[m][0] * T.shapes[m][1], 0);
  let off = per * (T.steps / T.snap - 1);
  for (const m of run.mats) { if (m === "blocks.0.att.q.weight") break; off += T.shapes[m][0] * T.shapes[m][1]; }
  let worst = 0;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    let u = 0; for (let t = 0; t < r; t++) u += last.B[i][t] * last.A[t][j];
    const want = Math.max(-127, Math.min(127, Math.round(127 * (4 * u) / run.scale)));
    worst = Math.max(worst, Math.abs(want - raw[off + i * D + j]));
  }
  ok(worst <= 1, `${task}: the map's block-1 Q change is 4 B A from the stored factors, signed (worst ${worst} of 127)`);
}
ok(T.wq.length === D && T.wq[0].length === D, "W_Q is 48 x 48");
/* the starting weights the Weights reading draws: every matrix of both starts, and the base's Q the one LoRA's detail draws */
for (const start of ["base", "scratch"]) {
  const raw = signed(bytes(T.w0[start])), total = T.mats.reduce((a, m) => a + T.shapes[m][0] * T.shapes[m][1], 0);
  ok(raw.length === total, `${start}: ${raw.length} starting weights, ${total} in the model`);
  ok(T.mats.every((m) => T.w0scale[start][m] > 0), `${start}: a scale for every matrix`);
  if (start === "base") {
    let off = 0; for (const m of T.mats) { if (m === "blocks.0.att.q.weight") break; off += T.shapes[m][0] * T.shapes[m][1]; }
    const sc = T.w0scale.base["blocks.0.att.q.weight"]; let worst = 0;
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) worst = Math.max(worst, Math.abs(Math.max(-127, Math.min(127, Math.round(127 * T.wq[i][j] / sc))) - raw[off + i * D + j]));
    ok(worst <= 1, `the base's stored W_Q is the W the LoRA detail draws (worst ${worst} of 127)`);
  }
}
const headStart = (start) => { const raw = signed(bytes(T.w0[start])); return raw.slice(0, 96).map((b) => b * T.w0scale[start]["head.weight"] / 127); };
ok(headStart("base").every((v, i) => Math.abs(v - headStart("scratch")[i]) < 0.02), "the head starts the same on every way");

/* 3 · notes and base rates */
for (const task of ["outcome", "match"]) {
  const n = T.notes[task];
  ok(n.length === 2 && new Set(n.map((x) => x[1])).size === 2, `${task}: two notes, one of each label`);
  ok(n.every(([t]) => t.length <= 60), `${task}: each note fits a line`);
  ok(T.base[task] > 0.4 && T.base[task] < 1, `${task}: base rate ${T.base[task]}`);
}

/* 4 · the claims the lines make, on the data */
for (const task of ["outcome", "match"]) {
  const rel = Object.values(T.runs[task].full.rel).sort((a, b) => a - b), med = rel[Math.floor(rel.length / 2)];
  ok(med > 0.02 && med < 0.3, `${task}: full fine-tuning moves a matrix by ${med} at the median`);
  ok(Object.keys(T.runs[task].transfer.rel).join() === "head.weight", `${task}: transfer moved the head alone`);
}
ok(T.runs.match.transfer.curve.at(-1) < T.base.match + 0.03, "Wrong drug: transfer ends near chance");
ok(T.runs.match.full.curve.at(-1) > T.runs.match.scratch.curve.at(-1) + 0.15, "Wrong drug: full fine-tuning ends well above from scratch");

/* 5 · the struck-word sweep: every string literal in main.js outside comments */
const src = readFileSync(join(here, "..", "adapting", "main.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const strings = [...src.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
const STRUCK = [/\bnever\b/i, /\byou\b/i, /\byour\b/i, /\bcarr(y|ies)\b/i, /\breads\b/i, /\bchose\b/i, /\bknows?\b/i, /\bwants?\b/i,
  /\bcard\b/i, /\brung\b/i, /\btrench\b/i, /\bwalk\b/i, /\bsimply\b/i, /\bjust\b/i, /\bin ink\b/i,
  /\blesson\b/i, /\bnotebook\b/i, /\bcell \d/i, /\b\d\d-\d\b/, /\bwidget \d/i];
for (const s of strings) for (const re of STRUCK) ok(!re.test(s), `struck word ${re} in "${s}"`);
ok(strings.length > 30, `the sweep read ${strings.length} strings`);

console.log(`adapting-verify: ${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
