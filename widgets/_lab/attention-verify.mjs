/* Widget 83's checks, run by `npm test`.

   1. The JS forward against torch: `_lab/attention-reference.json` is what
      torch computes from the SAME rounded weights (`attention-weights.py`
      writes both), on the four sentences, unpadded and padded to 16 with NO
      mask (the masked case is check 2's: the unpadded rows exactly). Every alpha, unscaled alpha, v and z within 1e-5: torch runs
      in float32 and this in float64 (measured 1.3e-6).
   2. The claims the pages print: the aspirin row's weight on "chest pain"
      in head 4 (the Weights page's example), the [MASK] row's in heads 2 and
      4, [PAD]'s share without the mask (four [PAD]), and that the masked rows equal the
      unpadded ones — the Mask page's whole claim.
   3. The arithmetic every row keeps: each row sums to 1; the scores the
      Weights page prints are q·k / √d_k and their softmax is the row of alpha.

   Run:  node widgets/_lab/attention-verify.mjs
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(here, "..", "attention", "model.js")).href);
const REF = JSON.parse(readFileSync(join(here, "attention-reference.json"), "utf8"));

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} against ${b}`);

/* 1 · against torch */
let worst = 0;
for (const r of REF) {
  const toks = r.tokens.concat(Array(r.L - r.tokens.length).fill(M.PAD));
  const js = M.attend(toks, { mask: false });   // torch's padded reference is the no-mask case
  for (let h = 0; h < M.H; h++) {
    for (const [name, a, b] of [["alpha", js.heads[h].alpha, r.alpha[h]], ["alphaRaw", js.heads[h].alphaRaw, r.alpha_unscaled[h]],
                                ["v", js.heads[h].v, r.v[h]], ["z", js.heads[h].z, r.z[h]]]) {
      for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].length; j++) worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]));
      void name;
    }
  }
}
ok(worst < 1e-5, `the forward against torch (torch float32, here float64): largest difference ${worst.toExponential(2)}`);

/* 2 · the printed claims */
const asp = M.stage("aspirin"), msk = M.stage("mask");
const onChest = (st, h, qi) => st.run.heads[h].alpha[qi][5] + st.run.heads[h].alpha[qi][6];
near(onChest(asp, 3, 3), 0.79, 0.005, "aspirin → chest pain, head 4");
near(onChest(msk, 3, 3), 0.84, 0.005, "[MASK] → chest pain, head 4");
near(onChest(msk, 1, 3), 0.83, 0.005, "[MASK] → chest pain, head 2");
for (const key of Object.keys(M.SENTENCES)) {
  const st = M.stage(key), L = st.L;
  for (let h = 0; h < M.H; h++) {
    const open = st.padded.open.heads[h].alpha, masked = st.padded.masked.heads[h].alpha, bare = st.run.heads[h].alpha;
    let same = 0;
    for (let i = 0; i < L; i++) for (let j = 0; j < st.padded.tokens.length; j++) same = Math.max(same, Math.abs(masked[i][j] - (j < L ? bare[i][j] : 0)));
    ok(same < 1e-12, `${key} head ${h + 1}: masked rows are the unpadded rows (${same})`);
    for (const A of [bare, st.run.heads[h].alphaRaw, open]) for (const row of A) near(row.reduce((a, b) => a + b, 0), 1, 1e-12, `${key}: a row sums to 1`);
    const pad = open.slice(0, L).reduce((s, r) => s + M.tailShare(r, L), 0) / L;
    ok(pad > 0.03, `${key} head ${h + 1}: without the mask [PAD] takes ${(100 * pad).toFixed(0)}%`);
  }
}
/* the Weights page prints the scores: softmax of each score row is that row's alpha,
   and the scaled score is the raw one over √d_k */
for (const key of Object.keys(M.SENTENCES)) {
  for (const hdx of M.stage(key).run.heads) {
    hdx.score.forEach((row, i) => {
      const m = Math.max(...row), e = row.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0);
      e.forEach((v, j) => near(v / z, hdx.alpha[i][j], 1e-12, `${key}: softmax of the scores is alpha`));
      row.forEach((v, j) => near(v, hdx.scoreRaw[i][j] / Math.sqrt(M.DK), 1e-12, `${key}: score = q·k / √d_k`));
    });
  }
}
near(asp.run.heads[3].score[3][5], 5.28, 0.005, "aspirin → chest, the score head 4 prints");

const pad4 = asp.padded.open.heads[3].alpha.slice(0, asp.L).reduce((s, r) => s + M.tailShare(r, asp.L), 0) / asp.L;
near(pad4, 0.24, 0.005, "aspirin, head 4: [PAD]'s share without the mask, over the rows");
const wnd = M.stage("wound"), wq = wnd.tokens.indexOf("wound");
near(M.tailShare(wnd.padded.open.heads[3].alpha[wq], wnd.L), 0.84, 0.005, "wound, head 4: the wound row's weight on [PAD] without the mask");
near(M.tailShare(wnd.padded.masked.heads[3].alpha[wq], wnd.L), 0, 1e-12, "wound, head 4: and with it");

/* 4 · the copy (the audit of 2026-09-26): no struck word in a reader-facing string.
   Comments are exempt — they carry the record of where a decision came from. A
   string with no space is an identifier, a parameter value or a token, not copy. */
{
  const src = ["main.js", "model.js"].map((f) => readFileSync(join(here, "..", "attention", f), "utf8")).join("\n");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const strings = [...stripped.matchAll(/["'`]([^"'`\n]{6,})["'`]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, "…")).filter((t) => /\s/.test(t));
  const STRUCK = [
    [/\bnever\b/i, "say the positive, literal fact"],
    [/\byou\b|\byour\b/i, "no second person"],
    [/\bnotebook\b|\blesson\b|\bcell \d+/i, "no lesson reference in reader-facing copy"],
    [/\bcarr(y|ies)\b|\bdoes\b|\bdid\b|\bcompares?\b|reads? off|comes? from|\bchose\b|\bwaits?\b|\breach(es)?\b|\bweighs\b|\bread by\b/i, "no personification: the thing does not act"],
    [/\bpress(es)?\b|\brung\b|\bcard\b|\bwalk\b|\bjoined\b|taken into|like any other|row by row|\bwidth\b/i, "our own vocabulary or phrasing, not the field's"],
  ];
  for (const [re, why] of STRUCK) {
    const hit = strings.filter((t) => re.test(t));
    ok(hit.length === 0, `${why}: ${hit.slice(0, 3).map((t) => JSON.stringify(t)).join(", ")}`);
  }
  ok(strings.length > 30, `the sweep read ${strings.length} strings`);
}

console.log(fails ? `${fails} of ${checks} checks FAILED` : `${checks} checks passed · the forward within ${worst.toExponential(1)} of torch`);
process.exit(fails ? 1 : 0);
