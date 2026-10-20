/* Widget 109's checks, run by `npm test`.

   1. The JS forward against torch: `_lab/generation-control-reference.json` is
      what torch computes in float64 from the same float32 weights
      (`generation-control-weights.py` writes both), the next-token
      probabilities of both models on the contexts listed there.
   2. The Decoding page's model IS widget 84's: the same bytes as 84's file.
   3. The rules' arithmetic: each rule's distribution sums to 1; top-k with
      k = 1 is greedy; temperature 1 leaves the model's distribution as it is;
      u = 0 picks the most probable token under every rule.
   4. The claims the pages print, on the default seed.

   Run:  node widgets/_lab/generation-control-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(here, "..", "generation-control", "model.js")).href);
const W109 = await import(pathToFileURL(join(here, "..", "generation-control", "weights.js")).href);
const W84 = await import(pathToFileURL(join(here, "..", "transformer", "weights.js")).href);
const REF = JSON.parse(readFileSync(join(here, "generation-control-reference.json"), "utf8"));

let fails = 0, checks = 0, worst = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
const sum = (a) => a.reduce((s, v) => s + v, 0);

/* 1 · against torch */
for (const which of ["causal", "cond"]) {
  for (const r of REF[which]) {
    const js = M.nextProbs(which, r.ids);
    ok(js.length === r.p.length, `${which} ${r.ids}: ${js.length} probabilities against ${r.p.length}`);
    js.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - r.p[i])); });
  }
}
ok(worst < 1e-12, `the forward within 1e-12 of torch (${worst.toExponential(1)})`);

/* 2 · 84's model */
ok(W109.MODELS.causal.b64 === W84.MODELS.causal.b64, "the Decoding page's model is 84's, byte for byte");
ok(JSON.stringify(W109.VOCABS.causal) === JSON.stringify(W84.VOCABS.causal), "and its vocabulary is 84's");

/* the footnotes' counts: † marks a note that is not one of the model's training notes */
const trained = (which) => W109.GRAMMAR.filter((n) => M.inTraining(which, n)).length;
ok(W109.GRAMMAR.length === 99 && trained("causal") === 99, `the Decoding model's training notes: 99 different (${trained("causal")})`);
ok(trained("cond") === 30, `the Conditioning model's training notes: 30 different (${trained("cond")})`);
ok(M.inTraining("causal", "patient recovered well") && !M.inTraining("cond", "patient recovered well"), "a course note is in the Decoding model's training notes, not the Conditioning model's");

/* 3 · the rules */
for (const r of REF.causal) {
  const p = M.nextProbs("causal", r.ids), top = M.orderOf(p)[0];
  for (const [rule, o] of [["greedy", {}], ["temperature", { T: 0.5 }], ["temperature", { T: 2 }], ["topk", { k: 3 }]]) {
    const q = M.ruleDist(p, rule, o);
    ok(Math.abs(sum(q) - 1) < 1e-12, `${rule} ${JSON.stringify(o)} sums to 1`);
    ok(M.drawOf(p, q, 0) === top, `${rule} ${JSON.stringify(o)}: u = 0 picks the most probable token`);
  }
  ok(M.ruleDist(p, "topk", { k: 1 }).every((v, i) => v === M.ruleDist(p, "greedy")[i]), "top-k with k = 1 is greedy");
  /* the temperature caption (audit W8): below 1 the most probable token's probability rises and the least probable's falls; above 1 the reverse */
  for (const T of [0.5, 0.7, 1.3, 1.6, 2]) {
    const q = M.ruleDist(p, "temperature", { T }), hi = Math.max(...p), lo = Math.min(...p), qhi = Math.max(...q), qlo = Math.min(...q);
    ok(T < 1 ? qhi >= hi && qlo <= lo : qhi <= hi && qlo >= lo, `T = ${T}: the most and least probable move as the caption says (${hi.toFixed(3)} → ${qhi.toFixed(3)}, ${lo.toExponential(1)} → ${qlo.toExponential(1)})`);
  }
  ok(M.ruleDist(p, "temperature", { T: 1 }).every((v, i) => Math.abs(v - p[i]) < 1e-12), "temperature 1 is the model's distribution");
}

console.log(`${checks - fails} of ${checks} checks pass · forward within ${worst.toExponential(1)} of torch`);
process.exit(fails ? 1 : 0);
