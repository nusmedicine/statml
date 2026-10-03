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

   THE PROTEINS (2026-10-03): Influenza host has its own model, so the counts,
   shapes, W_Q and starting weights are checked per MODEL (notes: 84's
   vocabulary and 64 positions; proteins: 25 tokens and 600 positions), and the
   claims the header makes for it are asserted on its runs.

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
const WAYS = ["scratch", "transfer", "full", "lora"], TASKS = ["outcome", "drug-error", "influenza-host"];

/* 1 · what each way trains, per model */
const D = 48, F = 96, r = T.r;
const lin = (i, o) => i * o + o;
const block = 4 * lin(D, D) + lin(D, F) + lin(F, D) + 2 * 2 * D, head = lin(D, 2), lora = 2 * 2 * (D * r + r * D);
const MODEL = { notes: { V: M.VOCAB.length, L: 64 }, proteins: { V: 25, L: 600 } };
ok(JSON.stringify(T.model) === JSON.stringify({ outcome: "notes", "drug-error": "notes", "influenza-host": "proteins" }), "each task's model");
for (const [name, { V, L }] of Object.entries(MODEL)) {
  const Md = T.models[name], t = Md.trains, backbone = V * D + L * D + 2 * block;
  ok(t.backbone === backbone, `${name}: backbone ${t.backbone}, by formula ${backbone}`);
  ok(t.transfer === head, `${name}: transfer trains ${t.transfer}, the head is ${head}`);
  ok(t.lora === lora + head, `${name}: LoRA trains ${t.lora}, by formula ${lora + head}`);
  ok(t.full === backbone + head && t.scratch === backbone + head, `${name}: full and scratch train the backbone and the head`);
  ok(JSON.stringify(Md.shapes["pos.weight"]) === JSON.stringify([L, D]) && Md.shapes["tok.weight"][0] === V, `${name}: ${V} tokens and ${L} positions`);
  ok(Md.used > 2 && Md.used <= L, `${name}: a sequence reaches ${Md.used} of ${L} positions`);
}
ok(T.models.proteins.used < 600, "the dashed line sits inside the proteins' position tile");
ok(T.alpha / T.r === 4, "alpha / r is the 4 the page prints");
const shapes = (task) => T.models[T.model[task]].shapes;
const size = (task, m) => shapes(task)[m][0] * shapes(task)[m][1];
const STORED = { scratch: T.mats, full: T.mats, transfer: ["head.weight"],
  lora: ["head.weight", "blocks.1.att.q.weight", "blocks.1.att.v.weight", "blocks.0.att.q.weight", "blocks.0.att.v.weight"] };
for (const task of TASKS) for (const way of WAYS) {
  const run = T.runs[task][way];
  ok(JSON.stringify([...run.mats].sort()) === JSON.stringify([...STORED[way]].sort()), `${task} ${way}: stores ${run.mats.length} matrices`);
  const per = run.mats.reduce((a, m) => a + size(task, m), 0);
  ok(bytes(run.maps).length === per * (T.steps / T.snap), `${task} ${way}: ${T.steps / T.snap} snapshots of ${per} weights`);
  ok(run.curve.length === T.steps / T.every + 1 && run.curve.every((v) => v >= 0 && v <= 1), `${task} ${way}: 41 accuracies in [0, 1]`);
  ok(run.scale > 0, `${task} ${way}: a positive scale`);
}

/* 2 · LoRA's map and its detail agree */
for (const task of TASKS) {
  const run = T.runs[task].lora, fac = run.lora, last = fac[fac.length - 1], first = fac[0];
  ok(first.step === 0 && first.B.flat().every((v) => v === 0), `${task}: B is zero at step 0, so the update starts at zero`);
  ok(fac.length === T.steps / T.lsnap + 1 && last.step === T.steps, `${task}: factors every ${T.lsnap} steps to ${T.steps}`);
  ok(first.A.length === r && first.A[0].length === D && first.B.length === D && first.B[0].length === r, `${task}: A is ${r} x ${D}, B ${D} x ${r}`);
  const raw = signed(bytes(run.maps)), per = run.mats.reduce((a, m) => a + size(task, m), 0);
  let off = per * (T.steps / T.snap - 1);
  for (const m of run.mats) { if (m === "blocks.0.att.q.weight") break; off += size(task, m); }
  let worst = 0;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    let u = 0; for (let t = 0; t < r; t++) u += last.B[i][t] * last.A[t][j];
    const want = Math.max(-127, Math.min(127, Math.round(127 * (4 * u) / run.scale)));
    worst = Math.max(worst, Math.abs(want - raw[off + i * D + j]));
  }
  ok(worst <= 1, `${task}: the map's block-1 Q change is 4 B A from the stored factors, signed (worst ${worst} of 127)`);
}
/* the starting weights the Weights reading draws: every matrix of both starts of both models, and each base's Q the one LoRA's detail draws */
for (const [name, Md] of Object.entries(T.models)) {
  ok(Md.wq.length === D && Md.wq[0].length === D, `${name}: W_Q is 48 x 48`);
  for (const start of ["base", "scratch"]) {
    const raw = signed(bytes(Md.w0[start])), total = T.mats.reduce((a, m) => a + Md.shapes[m][0] * Md.shapes[m][1], 0);
    ok(raw.length === total, `${name} ${start}: ${raw.length} starting weights, ${total} in the model`);
    ok(T.mats.every((m) => Md.w0scale[start][m] > 0), `${name} ${start}: a scale for every matrix`);
    if (start === "base") {
      let off = 0; for (const m of T.mats) { if (m === "blocks.0.att.q.weight") break; off += Md.shapes[m][0] * Md.shapes[m][1]; }
      const sc = Md.w0scale.base["blocks.0.att.q.weight"]; let worst = 0;
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) worst = Math.max(worst, Math.abs(Math.max(-127, Math.min(127, Math.round(127 * Md.wq[i][j] / sc))) - raw[off + i * D + j]));
      ok(worst <= 1, `${name}: the base's stored W_Q is the W the LoRA detail draws (worst ${worst} of 127)`);
    }
  }
  const headStart = (start) => { const raw = signed(bytes(Md.w0[start])); return raw.slice(0, 96).map((b) => b * Md.w0scale[start]["head.weight"] / 127); };
  ok(headStart("base").every((v, i) => Math.abs(v - headStart("scratch")[i]) < 0.02), `${name}: the head starts the same on every way`);
}

/* 2b · the blink (round 2): 5% of the page's largest change, exact because the scale IS the largest change */
for (const task of TASKS) for (const way of WAYS) {
  const run = T.runs[task][way], raw = signed(bytes(run.maps)), per = raw.length / (T.steps / T.snap);
  ok(raw.slice(per * (T.steps / T.snap - 1)).some((b) => Math.abs(b) === 127), `${task} ${way}: the scale is the largest final change (some weight reaches 127)`);
  let blinks = 0; for (let k = 1; k <= T.steps / T.snap; k++) for (let i = 0; i < per; i++) if (Math.abs(raw[(k - 1) * per + i] - (k >= 2 ? raw[(k - 2) * per + i] : 0)) / 127 > 0.05) blinks++;
  ok(blinks > 0, `${task} ${way}: ${blinks} blinks over the run`);
}

/* 3 · the held-out examples (round 4) and base rates: four a task, two of each label, a note within a line and a
   protein whole (the row prints its length); every run's P(label 1) on them at step 0 and every 50 steps */
for (const task of TASKS) {
  const ex = T.examples[task];
  ok(ex.length === 4 && ex.filter((x) => x[1] === 1).length === 2, `${task}: four held-out examples, two of each label`);
  if (T.model[task] === "notes") ok(ex.every(([t]) => t.length <= 60), `${task}: each note fits a line`);
  else ok(ex.every(([t]) => /^[A-Z]+$/.test(t) && t.length > 500), `${task}: four whole proteins`);
  for (const way of WAYS) {
    const P = T.runs[task][way].pred;
    ok(P.length === T.steps / T.snap + 1 && P.every((row) => row.length === 4 && row.every((v) => v >= 0 && v <= 1)), `${task} ${way}: 9 snapshots of 4 probabilities`);
  }
  ok(T.base[task] > 0.4 && T.base[task] < 1, `${task}: base rate ${T.base[task]}`);
}
/* what the rows show at the end, as the catalogue records it: full fine-tuning right on all four notes under both
   labels; transfer under drug error gives one answer to all four; every way right on all four proteins */
const rightAll = (task, way) => T.runs[task][way].pred.at(-1).every((p, i) => (p > 0.5 ? 1 : 0) === T.examples[task][i][1]);
ok(rightAll("outcome", "full") && rightAll("drug-error", "full"), "full fine-tuning ends right on all four held-out notes under both labels");
ok(new Set(T.runs["drug-error"].transfer.pred.at(-1).map((p) => p > 0.5)).size === 1, "transfer gives every held-out note the same answer under drug error");
ok(WAYS.every((way) => rightAll("influenza-host", way)), "every way ends right on all four held-out proteins");

/* 4 · the claims the lines make, on the data */
for (const task of TASKS) {
  const rel = Object.values(T.runs[task].full.rel).sort((a, b) => a - b), med = rel[Math.floor(rel.length / 2)];
  ok(med > 0.02 && med < 0.3, `${task}: full fine-tuning moves a matrix by ${med} at the median`);
  ok(Object.keys(T.runs[task].transfer.rel).join() === "head.weight", `${task}: transfer moved the head alone`);
}
const end = (task, way) => T.runs[task][way].curve.at(-1);
ok(end("drug-error", "transfer") < T.base["drug-error"] + 0.03, "Drug error: transfer ends near chance");
ok(end("drug-error", "full") > end("drug-error", "scratch") + 0.15, "Drug error: full fine-tuning ends well above from scratch");
/* the header's claims for the proteins: with 1,024 labels from scratch matches the adapted models, frozen transfer falls short */
ok(Math.abs(end("influenza-host", "scratch") - end("influenza-host", "full")) < 0.01, `Influenza host: from scratch ${end("influenza-host", "scratch")} within a point of full ${end("influenza-host", "full")}`);
ok(end("influenza-host", "transfer") < end("influenza-host", "full") - 0.005, `Influenza host: transfer ${end("influenza-host", "transfer")} below full`);
ok(T.base["influenza-host"] > 0.55 && T.base["influenza-host"] < 0.7, `Influenza host: majority class ${T.base["influenza-host"]}`);

/* 5 · the struck-word sweep: every string literal in main.js outside comments */
const src = readFileSync(join(here, "..", "adapting", "main.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const strings = [...src.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
const STRUCK = [/\bnever\b/i, /\byou\b/i, /\byour\b/i, /\bcarr(y|ies)\b/i, /\breads\b/i, /\bchose\b/i, /\bknows?\b/i, /\bwants?\b/i,
  /\bcard\b/i, /\brung\b/i, /\btrench\b/i, /\bwalk\b/i, /\bsimply\b/i, /\bjust\b/i, /\bin ink\b/i,
  /\blesson\b/i, /\bnotebook\b/i, /\bcell \d/i, /\b\d\d-\d\b/, /\bwidget \d/i,
  /* the copy audit of 2026-10-02: "beside" for an added update, "numbers" for parameters, the head training on
     every page, "called", "moved" for a changed weight, the matrix the model "uses", "over" for "more than" */
  /\bbeside\b/i, /\bnumbers\b/i, /\bthe head trains\b/i, /\bcalled\b/i, /\bmoved?\b/i, /\bthe model uses\b/i, /\bover \d/i];
for (const s of strings) for (const re of STRUCK) ok(!re.test(s), `struck word ${re} in "${s}"`);
ok(strings.length > 30, `the sweep read ${strings.length} strings`);

console.log(`adapting-verify: ${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
