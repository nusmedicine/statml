/* Widget 84's checks, run by `npm test`.

   1. The JS forward against torch: `_lab/transformer-reference.json` is what
      torch computes (in float64) from the same float32 weights
      (`transformer-weights.py` writes both): the base model's every stage and
      weight on the Encoder page's pair; the causal model's next-token
      probabilities and weights at every step of every prompt's generation; the
      two models' predictions along the lesson's clause and their top token on
      every treat clause; the DNA model's self- and cross-attention and its top
      token on each gene.
   2. The claims the pages print: the pair's two x~ rows are one row (cos 1),
      and part after block 1's attention; greedy from the lesson's prompt gives
      "chest pain ." and every prompt stops at the first "."; a generated token
      leaves the rows before it unchanged; MLM puts the lesson's [MASK] on the
      two chest-pain drugs and the causal model spreads "treated with" over
      all ten; the drug is the one position where the two part; each amino
      acid's cross-attention lands on its own codon.

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
ok(JSON.stringify(M.PAIR) === JSON.stringify(REF.pair), "the pair is the reference's");
ok(JSON.stringify(M.PROMPTS) === JSON.stringify(REF.prompts), "the prompts are the reference's");
const pair = M.encoderPair();
pair.forEach((p, s) => { diff(p.stages, REF.encoder[s].stages); diff(p.alpha, REF.encoder[s].alpha); });
REF.generate.forEach((g) => {
  const js = M.generate(g.prompt);
  ok(JSON.stringify(js.tokens) === JSON.stringify(g.tokens), `${g.prompt}: generates ${js.tokens.join(" ")}`);
  js.steps.forEach((st, k) => { diff(st.probs, g.steps[k].probs); diff(st.alpha, g.steps[k].alpha); });
});
const cl = M.clauseSteps();
cl.forEach((st, j) => { diff(st.mlm, REF.pretrain.mlm[j]); diff(st.causal, REF.pretrain.causal[j]); });
const argmax = (p) => p.indexOf(Math.max(...p));
REF.pretrain.treats.forEach((t) => {
  const toks = t.clause.split(" ");
  toks.forEach((_, j) => {
    ok(argmax(M.mlmAt(toks, j)) === t.mlm[j], `${t.clause} ${j}: MLM's top token`);
    ok(argmax(M.causalAt(toks, j)) === t.causal[j], `${t.clause} ${j}: causal's top token`);
  });
});
REF.dna.forEach((r, g) => {
  ok(M.GENES[g] === r.dna, `gene ${g + 1} is the reference's`);
  const t = M.translate(r.dna);
  diff(t.cross, r.cross); diff(t.self, r.self);
  ok(t.top.slice(0, 6).join("") === r.protein.join("") && t.top[6] === "[EOS]", `gene ${g + 1}: the decoder reads ${t.top.join(" ")}`);
});
ok(worst < 1e-9, `the forward against torch (both float64 on float32 weights): largest difference ${worst.toExponential(2)}`);

/* 2 · the printed claims */
const cosAt = (k) => M.cosine(pair[0].stages[k][M.PAIR_AT], pair[1].stages[k][M.PAIR_AT]);
ok(pair.every((p) => p.tokens[M.PAIR_AT] === "discharge"), "the pair's position 2 is discharge");
ok(Math.abs(cosAt(0) - 1) < 1e-12, `x~: one row (${cosAt(0)})`);
ok(cosAt(1) < 0.9 && cosAt(4) < 0.6, `apart after the blocks: ${[0, 1, 2, 3, 4].map((k) => cosAt(k).toFixed(3)).join(" → ")}`);
ok(M.nearestToken(pair[0].stages[0][M.PAIR_AT]) === "discharge", "x~ reads as its own table row");
const lesson = M.generate(M.PROMPTS[0]);
ok(lesson.tokens.slice(5).join(" ") === "chest pain .", `the lesson's prompt: ${lesson.tokens.join(" ")}`);
ok(lesson.steps[0].probs[M.VOCAB.indexOf("chest")] > 0.99, "chest after the lesson's prompt, above 0.99");
for (const p of M.PROMPTS) {
  const g = M.generate(p);
  ok(M.STOP.has(g.tokens.at(-1)) && g.tokens.slice(0, -1).every((t) => !M.STOP.has(t)), `${p}: stops at the first "."`);
  for (let k = 1; k < g.steps.length; k++) for (let b = 0; b < 2; b++) for (let h = 0; h < M.H; h++)
    ok(M.earlierRowChange(g, k, b, h) === 0, `${p} step ${k + 1}, block ${b + 1} head ${h + 1}: earlier rows unchanged`);
}
const drugAt = cl[2], V = M.VOCAB;
const mass = (p, words) => words.reduce((s, w) => s + p[V.indexOf(w)], 0);
ok(mass(drugAt.mlm, ["aspirin", "nitrate"]) > 0.99, `MLM's [MASK]: ${mass(drugAt.mlm, ["aspirin", "nitrate"]).toFixed(3)} on the chest-pain drugs`);
const drugs = Object.values(M.SYM_DRUG).flat();
ok(drugs.every((d) => drugAt.causal[V.indexOf(d)] > 0.05 && drugAt.causal[V.indexOf(d)] < 0.2), "causal after 'treated with': every drug 0.05–0.2");
const tab = M.treatTable();
ok(tab.every((c, j) => c.mlm === c.n), `MLM right at every position: ${tab.map((c) => `${c.mlm}/${c.n}`).join(" ")}`);
ok(tab.every((c, j) => (j === 0 || j === 2 ? c.causal < c.n : c.causal === c.n)), `causal right except the first word and the drug: ${tab.map((c) => `${c.causal}/${c.n}`).join(" ")}`);
for (const dna of M.GENES) {
  const t = M.translate(dna), A = M.crossMean(t);
  for (let r = 0; r < 6; r++) {
    const on = A[r][3 * r] + A[r][3 * r + 1] + A[r][3 * r + 2];
    ok(on > 0.8, `${dna} amino acid ${r + 1}: ${on.toFixed(2)} of its cross-attention on its codon`);
  }
}

console.log(`${checks - fails} of ${checks} checks pass · forward within ${worst.toExponential(1)} of torch · causal by position ${tab.map((c) => `${c.causal}/${c.n}`).join(" ")}`);
process.exit(fails ? 1 : 0);
