/* Widget 87's checks, run by `npm test`.

   The widget runs no model in the browser: everything it draws is read from
   `widgets/explainability/table.js`, generated in torch by
   `_lab/explainability-table.py` on 85's models (rebuilt, and checked there
   against 85's own table). This file holds the table to what the pages draw:

   1. The same models and rows as 85: each way's held-out accuracy is the last
      point of 85's curve, and the four examples a task are 85's.
   2. Integrated gradients: the stored gap is sum(attr) - (f(input) -
      f(baseline)); the path starts at f(baseline) and ends at f(input); the last
      running sum is the final attribution (exactly for the notes, to the bytes'
      resolution for the proteins); the gap shrinks with the steps at the median.
   3. Attention: every row of every head sums to 1 (the notes' matrices; the
      proteins' [CLS] rows and pooled rows, to their bytes' resolution).
   4. Occlusion: the window count is the stride's arithmetic over the words or
      residues alone, so no window covers [CLS] or [SEP] (his pick); the logit it
      starts from is f(input), the same target IG explains.
   5. The struck-word sweep over main.js's reader-facing copy.

   Run:  node widgets/_lab/explainability-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { TABLE: T } = await import(pathToFileURL(join(here, "..", "explainability", "table.js")).href);
const { TABLE: A } = await import(pathToFileURL(join(here, "..", "adapting", "table.js")).href);

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
const bytes = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));
const WAYS = ["scratch", "transfer", "full", "lora"], TASKS = ["outcome", "drug-error", "influenza-host"];
const sum = (v) => v.reduce((a, x) => a + x, 0);
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/* 1 · the same models and rows as 85 */
for (const task of TASKS) {
  ok(JSON.stringify(T.examples[task]) === JSON.stringify(A.examples[task]), `${task}: the four rows are 85's`);
  for (const way of WAYS) ok(Math.abs(T.acc[task][way] - A.runs[task][way].curve.at(-1)) < 1e-3, `${task}/${way}: accuracy ${T.acc[task][way]} is 85's ${A.runs[task][way].curve.at(-1)}`);
}

for (const task of TASKS) {
  const prot = T.model[task] === "proteins";
  const gaps = Object.fromEntries(T.steps.map((s) => [s, []]));
  for (const way of WAYS) T.rows[task][way].forEach((e, i) => {
    const tag = `${task}/${way}/${i + 1}`, L = e.ig["5"].attr.length;
    ok(e.pred === (e.logits[1] > e.logits[0] ? 1 : 0), `${tag}: the prediction is the larger logit`);
    /* 2 · integrated gradients */
    for (const s of T.steps) {
      const g = e.ig[s], C = Math.min(s, T.checks);
      ok(Math.abs(sum(g.attr) - (g.fx - g.fb) - g.delta) < 2e-3, `${tag} ${s} steps: the gap is sum(attr) - (fx - fb)`);
      ok(Math.abs(g.fx - e.logits[e.pred]) < 1e-3, `${tag} ${s} steps: f(input) is the predicted class's logit`);
      gaps[s].push(Math.abs(g.delta));
      if (prot) {
        const raw = bytes(g.part), last = Array.from(raw.subarray((C - 1) * L, C * L), (b) => ((b > 127 ? b - 256 : b) / 127) * g.pscale);
        ok(raw.length === C * L, `${tag} ${s} steps: ${C} checkpoints of ${L}`);
        ok(last.every((v, j) => Math.abs(v - g.attr[j]) <= g.pscale / 127 + 1e-4), `${tag} ${s} steps: the last running sum is the attribution`);
      } else {
        ok(g.part.length === C && g.part.at(-1).every((v, j) => Math.abs(v - g.attr[j]) < 2e-4), `${tag} ${s} steps: the last running sum is the attribution`);
      }
    }
    ok(Math.abs(e.path[0] - e.ig["50"].fb) < 2e-3 && Math.abs(e.path.at(-1) - e.ig["50"].fx) < 2e-3, `${tag}: the path runs from f(baseline) to f(input)`);
    /* 3 · attention rows sum to 1 */
    if (prot) {
      e.att.cls.forEach((b64, h) => { const r = Array.from(bytes(b64), (b) => (b / 255) * e.att.clsScale[h]); ok(r.length === L && Math.abs(sum(r) - 1) < 0.02 * L / 255 + 0.02, `${tag} head ${h}: the [CLS] row sums to ${sum(r).toFixed(3)}`); });
      e.att.pooled.forEach((b64, h) => {
        const n = e.att.bins, m = Array.from(bytes(b64), (b) => (b / 255) * e.att.pooledScale[h]);
        ok(m.length === n * n, `${tag} head ${h}: ${n} x ${n} bins`);
        const worst = Math.max(...Array.from({ length: n }, (_, r) => Math.abs(sum(m.slice(r * n, r * n + n)) - 1)));
        ok(worst < 0.05, `${tag} head ${h}: pooled rows sum to 1 (worst ${worst.toFixed(3)})`);
      });
    } else {
      for (const blk of e.att) for (const hm of blk) {
        ok(hm.length === L * L, `${tag}: a ${L} x ${L} matrix`);
        for (let r = 0; r < L; r++) ok(Math.abs(sum(hm.slice(r * L, r * L + L)) - 1) < 2e-3, `${tag}: row ${r} sums to 1`);
      }
    }
    /* 4 · occlusion over the words or residues only */
    for (const k of T.windows[T.model[task]]) {
      const st = Math.max(1, Math.floor(k / 2)), want = Math.floor((L - 2 - k) / st) + 1, d = e.occ[String(k)];
      ok(d.length === want, `${tag} k ${k}: ${d.length} windows, the stride's arithmetic gives ${want}`);
      ok(1 + (d.length - 1) * st + k <= L - 1, `${tag} k ${k}: the last window ends before [SEP]`);
    }
    ok(Math.abs(e.occ.f0 - e.logits[e.pred]) < 1e-3, `${tag}: occlusion starts from the predicted class's logit`);
    ok(T.occBase === "[MASK]", `${tag}: the occluding token is [MASK], as the page says`);
  });
  for (let i = 1; i < T.steps.length; i++) ok(med(gaps[T.steps[i]]) < med(gaps[T.steps[i - 1]]), `${task}: the median gap shrinks from ${T.steps[i - 1]} to ${T.steps[i]} steps`);
}
/* the measured stage the copy leans on: on Drug error the full model is right far more often than transfer */
ok(T.acc["drug-error"].full > T.acc["drug-error"].transfer + 0.25, "Drug error: full fine-tuning well above transfer");

/* 5 · the struck-word sweep: every string literal in main.js outside comments */
const src = readFileSync(join(here, "..", "explainability", "main.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const strings = [...src.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
const STRUCK = [/\bnever\b/i, /\byou\b/i, /\byour\b/i, /\bcarr(y|ies)\b/i, /\breads\b/i, /\bchose\b/i, /\bknows?\b/i, /\bwants?\b/i,
  /\bcard\b/i, /\brung\b/i, /\btrench\b/i, /\bwalk\b/i, /\bsimply\b/i, /\bjust\b/i, /\bin ink\b/i,
  /\blesson\b/i, /\bnotebook\b/i, /\bcell \d/i, /\b\d\d-\d\b/, /\bwidget \d/i,
  /\bbeside\b/i, /\bnumbers\b/i, /\bcalled\b/i, /\bmoved?\b/i, /\bover \d/i,
  /* his rule from 85 (2026-10-04): a label fact is a fact about the data; a model's reason is not measured here */
  /\bthe model uses\b/i, /\bdecided by\b/i, /\bthe model looks\b/i, /\bfocus(es)? on\b/i,
  /* the copy audit of 2026-10-05: "strip" is our word, a query that "gives" and a block that "takes" personify,
     "read from [CLS]'s row" for its final vector, a legend entry that leans on the one before ("Lowers it") */
  /\bstrip\b/i, /\bgives\b/i, /\btakes\b/i, /\bread from\b/i, /^Lowers it$/];
for (const s of strings) for (const re of STRUCK) ok(!re.test(s), `struck word ${re} in "${s}"`);
ok(strings.length > 30, `the sweep read ${strings.length} strings`);

console.log(`explainability-verify: ${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
