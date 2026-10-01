/* Widget 85's checks, run by `npm test`.

   The widget trains nothing in the browser: everything it draws is read from
   `widgets/adapting/table.js`, generated in torch by `_lab/adapting-table.py`
   (whose `--check` reruns one training run against the table). This file holds
   the table to what the page prints:

   1. Pretraining's last checkpoint IS widget 84's model: the five most likely
      tokens at the lesson's [MASK] equal what 84's JS forward computes from its
      own weights on "[CLS] treated with [MASK] for chest pain [SEP]".
   2. The trainable counts the columns print, by formula from the model's
      shapes: the head 48 x 2 + 2; LoRA r 8 on Q and V of both blocks; the
      backbone (embeddings and two blocks, the MLM head dropped).
   3. Every claim a checkpoint's caption makes (`preLine` in main.js): no drug
      in the top two at 25 and 100 steps, a drug first at 200 that does not
      treat chest pain, aspirin and nitrate first from 500.
   4. The table's shape: thirteen checkpoints including the seven a press
      reaches; 41 points a curve (step 0 and every 10 to 400); accuracies in
      [0, 1]; the notes strip two of each label, each line 60 characters or less.
   5. The struck-word sweep over main.js's reader-facing copy (principle 5.9 and
      the memory notes: no "never", no second person, no personification, none
      of the collection's internal words).

   Run:  node widgets/_lab/adapting-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const url = (p) => pathToFileURL(join(here, "..", p)).href;
const { TABLE: T } = await import(url("adapting/table.js"));
const M = await import(url("transformer/model.js"));

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };

/* 1 · the last checkpoint is 84's model */
const toks = ["[CLS]", "treated", "with", "[MASK]", "for", "chest", "pain", "[SEP]"];
const probs = M.nextTokens("base", M.forward("base", toks).h[3]);
const js = probs.map((p, i) => [M.VOCAB[i], p]).sort((a, b) => b[1] - a[1]).slice(0, 5);
const last = T.pretrain[T.pretrain.length - 1];
ok(last.step === 3000, "the last checkpoint is step 3,000");
last.top.forEach(([t, p], i) => {
  ok(js[i][0] === t, `rank ${i + 1} at [MASK]: table ${t}, widget 84 ${js[i][0]}`);
  ok(Math.abs(js[i][1] - p) < 1e-3, `${t}: table ${p}, widget 84 ${js[i][1].toFixed(4)}`);
});

/* 2 · the counts the columns print */
const D = 48, F = 96, V = M.VOCAB.length, L = 64, r = 8;
const lin = (i, o) => i * o + o;
const block = 4 * lin(D, D) + lin(D, F) + lin(F, D) + 2 * 2 * D;
const backbone = V * D + L * D + 2 * block, head = lin(D, 2), lora = 2 * 2 * (D * r + r * D);
ok(T.trains.transfer === head, `transfer trains ${T.trains.transfer}, the head is ${head}`);
ok(T.trains.lora === lora + head, `LoRA trains ${T.trains.lora}, by formula ${lora + head}`);
ok(T.trains.full === backbone + head, `full trains ${T.trains.full}, by formula ${backbone + head}`);
ok(T.trains.scratch === T.trains.full, "scratch trains what full trains");

/* 3 · the captions' claims */
const DRUGS = ["aspirin", "nitrate", "paracetamol", "ibuprofen", "antibiotics", "cefazolin", "salbutamol", "oxygen", "ondansetron", "metoclopramide"];
const at = (s) => T.pretrain.find((c) => c.step === s);
for (const s of [25, 100]) ok(at(s).top.slice(0, 2).every(([t]) => !DRUGS.includes(t)), `step ${s}: no drug in the top two (${at(s).top.slice(0, 2).map((x) => x[0])})`);
ok(DRUGS.includes(at(200).top[0][0]) && !["aspirin", "nitrate"].includes(at(200).top[0][0]), `step 200: a drug first, not for chest pain (${at(200).top[0][0]})`);
for (const s of [500, 750, 3000]) ok(at(s).top.slice(0, 2).map((x) => x[0]).sort().join() === "aspirin,nitrate", `step ${s}: aspirin and nitrate first`);
ok(at(0).top[0][1] < 0.1, `step 0: the most likely token gets ${at(0).top[0][1]}`);

/* 4 · the shape */
const PRESS = [0, 25, 100, 200, 500, 750, 3000];
ok(T.pretrain.length === 13, "thirteen checkpoints");
for (const s of PRESS) ok(Boolean(at(s)), `checkpoint ${s} present`);
ok(T.pretrain.every((c, i) => i === 0 || c.step > T.pretrain[i - 1].step), "checkpoints in order");
ok(T.pretrain.every((c) => c.mlm >= 0 && c.mlm <= 1 && c.top.length === 5), "accuracies in [0, 1], five tokens a checkpoint");
for (const task of ["outcome", "match"]) {
  for (const n of ["16", "64", "256", "1024"]) for (const s of ["transfer", "full", "lora", "scratch"]) {
    const cv = T.adapt[task][n][s];
    ok(cv.length === T.steps / T.every + 1, `${task} ${n} ${s}: ${cv.length} points`);
    ok(cv.every((v) => v >= 0 && v <= 1), `${task} ${n} ${s}: accuracies in [0, 1]`);
  }
  const notes = T.notes[task];
  ok(notes.length === 4 && notes.filter((x) => x[1] === 1).length === 2, `${task}: four notes, two of each label`);
  ok(notes.every(([t]) => t.length <= 60), `${task}: every note fits a line`);
  ok(T.base[task] > 0.4 && T.base[task] < 1, `${task}: base rate ${T.base[task]}`);
}
for (const m of T.masked) ok(m.hidden.length >= 1 && m.hidden.length <= 2 && m.hidden.every((j) => j < m.tokens.length), `masked note ${m.tokens.join(" ")}`);

/* 5 · the struck-word sweep: every string literal in main.js outside comments */
const src = readFileSync(join(here, "..", "adapting", "main.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const strings = [...src.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
const STRUCK = [/\bnever\b/i, /\byou\b/i, /\byour\b/i, /\bcarr(y|ies)\b/i, /\breads\b/i, /\bchose\b/i, /\bknows?\b/i, /\bwants?\b/i,
  /\bcard\b/i, /\brung\b/i, /\bwell\b(?! )/i, /\btrench\b/i, /\bwalk\b/i, /\bsimply\b/i, /\bjust\b/i, /\bin ink\b/i,
  /\blesson\b/i, /\bnotebook\b/i, /\bcell \d/i, /\b\d\d-\d\b/, /\bwidget \d/i];
for (const s of strings) for (const re of STRUCK) ok(!re.test(s), `struck word ${re} in "${s}"`);
ok(strings.length > 40, `the sweep read ${strings.length} strings`);

console.log(`adapting-verify: ${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
