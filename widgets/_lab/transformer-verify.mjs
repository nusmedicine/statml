/* Widget 84's checks, run by `npm test`.

   1. The JS forward against torch: `_lab/transformer-reference.json` is what
      torch computes (in float64) from the same float32 weights
      (`transformer-weights.py` writes both): the base (encoder) model's every
      stage and weight on two sentences; the causal (decoder) model's
      next-token probabilities and weights at every step of five prompts'
      generation; the DNA model's self- and cross-attention and its top token
      on each gene. (The reference also carries a Pre-training page's numbers;
      that page left 84 in the replan of 2026-09-27 and is not checked here.)
   2. The claims the pages print: as each token of the sentence enters, every
      earlier encoder token's final vector moves and every decoder token's stays
      exactly, its weights the same numbers; greedy from the lesson's prompt
      gives "chest pain ." and every prompt stops at the first "."; each amino
      acid's cross-attention lands on its own codon; the rows of the mean of
      heads sum to 1, and the decoder's are 0 past the diagonal.

   Run:  node widgets/_lab/transformer-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(here, "..", "transformer", "model.js")).href);
const REF = JSON.parse(readFileSync(join(here, "transformer-reference.json"), "utf8"));

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
let worst = 0;
const diff = (a, b) => {
  if (Array.isArray(a)) { ok(a.length === b.length, `shape ${a.length} against ${b.length}`); a.forEach((x, i) => diff(x, b[i])); return; }
  worst = Math.max(worst, Math.abs(a - b));
};

/* 1 · against torch */
REF.encoder.forEach((r) => { const js = M.forward("base", r.tokens); diff(js.stages, r.stages); diff(js.alpha, r.alpha); });
REF.generate.forEach((g) => {
  const js = M.generate(g.prompt);
  ok(JSON.stringify(js.tokens) === JSON.stringify(g.tokens), `${g.prompt}: generates ${js.tokens.join(" ")}`);
  js.steps.forEach((st, k) => { diff(st.probs, g.steps[k].probs); diff(st.alpha, g.steps[k].alpha); });
});
REF.dna.forEach((r, g) => {
  ok(M.GENES[g] === r.dna, `gene ${g + 1} is the reference's`);
  const t = M.translate(r.dna);
  diff(t.cross, r.cross); diff(t.self, r.self);
  ok(t.top.slice(0, 6).join("") === r.protein.join("") && t.top[6] === "[EOS]", `gene ${g + 1}: the decoder reads ${t.top.join(" ")}`);
});
ok(worst < 1e-9, `the forward against torch (both float64 on float32 weights): largest difference ${worst.toExponential(2)}`);

/* 2 · the printed claims */
const moves = [];
for (const which of ["base", "causal"]) {
  const E = M.entering(which), N = E.tokens.length;
  ok(E.tokens.join(" ") === "[CLS] treated with aspirin for chest pain [SEP]", `${which}: the sentence's tokens`);
  for (let k = 2; k <= N; k++) {
    const mv = E.move[k];
    if (which === "base") { ok(mv.every((v) => v > 1), `encoder, ${E.tokens[k - 1]} enters: every earlier token moves (${mv.map((v) => v.toFixed(2)).join(" ")})`); moves.push(...mv); }
    else {
      ok(mv.every((v) => v === 0), `decoder, ${E.tokens[k - 1]} enters: every earlier token stays exactly`);
      const a = E.runs[k - 1].alpha, b = E.runs[k].alpha;
      ok(a.every((row, i) => row.every((w, j) => w === b[i][j])) && b[k - 1].every((w, j) => j <= k - 1), `decoder, ${E.tokens[k - 1]} enters: the earlier rows' weights are the same numbers`);
    }
    E.runs[k].alpha.forEach((row, i) => {
      ok(Math.abs(row.reduce((x, y) => x + y, 0) - 1) < 1e-12, `${which} ${k} tokens, row ${i}: sums to 1`);
      if (which === "causal") ok(row.every((w, j) => j <= i || w === 0), `causal ${k} tokens, row ${i}: 0 past the diagonal`);
    });
  }
}
/* training against generation (the Phase control, 2026-09-29): one pass over the whole sequence
   gives what building it a token at a time gives, exactly — the mask is why training runs in parallel */
{
  const toks = M.tokensOf(M.SENTENCE), full = M.forward("causal", toks);
  let worst = 0;
  for (let k = 1; k <= toks.length; k++) {
    const pre = M.forward("causal", toks.slice(0, k)), a = M.nextTokens("causal", pre.h[k - 1]), b = M.nextTokens("causal", full.h[k - 1]);
    a.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - b[i])); });
  }
  ok(worst === 0, `decoder: one pass's next-token distributions are the prefixes' own (${worst})`);
  for (const dna of M.GENES) {
    const T = M.translate(dna);
    let w2 = 0;
    for (let k = 1; k <= 7; k++) {
      const P = M.translate(dna, k);
      for (let b = 0; b < 2; b++) for (let h = 0; h < M.H; h++) P.cross[b][h].forEach((row, i) => row.forEach((v, j) => { w2 = Math.max(w2, Math.abs(v - T.cross[b][h][i][j])); }));
    }
    ok(w2 === 0, `${dna}: the whole protein at once gives a prefix's cross-attention rows (${w2})`);
  }
}
const lesson = M.generate("treated with aspirin for");
ok(lesson.tokens.slice(5).join(" ") === "chest pain .", `the lesson's prompt: ${lesson.tokens.join(" ")}`);
ok(lesson.steps[0].probs[M.VOCAB.indexOf("chest")] > 0.99, "chest after the lesson's prompt, above 0.99");
for (const g of REF.generate) {
  const js = M.generate(g.prompt);
  ok(M.STOP.has(js.tokens.at(-1)) && js.tokens.slice(0, -1).every((t) => !M.STOP.has(t)), `${g.prompt}: stops at the first "."`);
}
for (const dna of M.GENES) {
  const t = M.translate(dna), A = M.crossMean(t);
  for (let r = 0; r < 6; r++) {
    const on = A[r][3 * r] + A[r][3 * r + 1] + A[r][3 * r + 2];
    ok(on > 0.8, `${dna} amino acid ${r + 1}: ${on.toFixed(2)} of its cross-attention on its codon`);
  }
}

console.log(`${checks - fails} of ${checks} checks pass · forward within ${worst.toExponential(1)} of torch · encoder tokens move ${Math.min(...moves).toFixed(2)}–${Math.max(...moves).toFixed(2)} as each token enters, decoder tokens 0`);
process.exit(fails ? 1 : 0);
