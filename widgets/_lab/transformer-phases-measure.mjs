/* Slot 84, training against inference (his question, 2026-09-29: "for encoder decoder, in
   practice, everything is in parallel? … should we split into training and inference?
   research and mockup"). On the widget's own three models (held to torch by
   transformer-verify.mjs):

   T1 DECODER. One pass over the whole sentence (training) against the sentence built a
      token at a time (inference): is every row's weights and every position's next-token
      distribution the same number? And the training signal: the probability each position
      gives the TRUE next token, all read from the one pass.
   T2 ENCODER. Its training (masked tokens) and its inference (embeddings) are both one pass
      over the whole sentence; the lesson's MLM example, aspirin masked, read from one pass.
   T3 ENCODER–DECODER. The decoder over the whole protein at once (training, the true protein
      given) against a prefix at a time (inference): the same cross-attention rows?
   T4 WORK. Rows computed: one pass computes each row once; generation with the earlier
      rows kept computes one new row a step; generation that recomputes everything each
      step computes 1 + 2 + … + n.

   Run:  node widgets/_lab/transformer-phases-measure.mjs
*/
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(here, "..", "transformer", "model.js")).href);

const toks = M.tokensOf(M.SENTENCE), N = toks.length;
const maxDiff = (a, b) => (Array.isArray(a) ? Math.max(0, ...a.map((x, i) => maxDiff(x, b[i]))) : Math.abs(a - b));

/* T1 */
const full = M.forward("causal", toks);
let worstA = 0;
for (let k = 1; k <= N; k++) {
  const pre = M.forward("causal", toks.slice(0, k));
  for (let b = 0; b < 2; b++) for (let h = 0; h < M.H; h++) worstA = Math.max(worstA, maxDiff(pre.alpha[b][h], full.alpha[b][h].slice(0, k).map((r) => r.slice(0, k))));
}
console.log(`T1 decoder: rows from one pass against prefix by prefix, largest difference ${worstA.toExponential(1)}`);
/* the next-token distributions: from the one pass, and from each prefix's own last position */
let worstP = 0;
for (let k = 1; k <= N; k++) { const pre = M.forward("causal", toks.slice(0, k)); worstP = Math.max(worstP, maxDiff(M.nextTokens("causal", pre.h[k - 1]), M.nextTokens("causal", full.h[k - 1]))); }
console.log(`   next-token probabilities, one pass against prefix by prefix, largest difference ${worstP.toExponential(1)}`);
/* the true next token's probability at every position, from the one pass */
const nextP = [];
for (let i = 0; i < N - 1; i++) {
  const p = M.nextTokens("causal", full.h[i]);
  nextP.push(`${toks[i]} → ${toks[i + 1]} ${p[M.VOCAB.indexOf(toks[i + 1])].toFixed(3)} (top ${M.VOCAB[p.indexOf(Math.max(...p))]})`);
}
console.log(`   training signal, one pass, each position's probability for the true next token:\n     ${nextP.join("\n     ")}`);

/* T2 */
const masked = toks.map((t, i) => (i === 3 ? "[MASK]" : t));
const enc = M.forward("base", masked), pm = M.nextTokens("base", enc.h[3]), top = pm.map((p, i) => [p, M.VOCAB[i]]).sort((a, b) => b[0] - a[0]).slice(0, 3);
console.log(`T2 encoder: one pass over "${masked.join(" ")}": [MASK] → ${top.map(([p, w]) => `${w} ${p.toFixed(2)}`).join(", ")}`);

/* T3 */
let worstX = 0;
const T = M.translate(M.GENES[0]);
for (let k = 1; k <= 7; k++) {
  const P = M.translate(M.GENES[0], k);
  for (let b = 0; b < 2; b++) for (let h = 0; h < M.H; h++) {
    worstX = Math.max(worstX, maxDiff(P.cross[b][h], T.cross[b][h].slice(0, k)), maxDiff(P.self[b][h], T.self[b][h].slice(0, k).map((r) => r.slice(0, k))));
  }
}
console.log(`T3 encoder-decoder: cross- and self-attention rows from the whole protein at once against a prefix at a time, largest difference ${worstX.toExponential(1)}; the decoder's outputs ${T.top.join(" ")}`);

/* T4 */
const n = 7;
console.log(`T4 rows computed for ${n} tokens: one pass ${n}; generation keeping earlier rows ${n} over ${n} steps; generation recomputing ${n * (n + 1) / 2}`);
