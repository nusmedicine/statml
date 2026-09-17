/* Research for Kenneth, 2026-09-17: "do you have other scenarios with additional
   branching patterns? mock it to see if appropriate".

       node widgets/_lab/vaf-trees-measure.mjs

   Page 3 draws his RETCHER figure: three clusters, four samples. With the trunk
   fixed and every later cluster's parent an earlier one, three clusters have
   exactly two trees — so the page already shows every pattern HIS data can
   have. More patterns need more clusters. This asks whether that is worth it:
   how many trees there are, whether they stay legible, and — the part that
   could teach something new — whether adding samples narrows them. */
import { trees, fitsSumRule, childrenOf } from "./vaf-model.js";
import * as M from "../tumor-heterogeneity/model.js";

const line = (s) => console.log(`\n${"=".repeat(76)}\n${s}\n${"=".repeat(76)}`);
const name = (t) => t.map((p, i) => `${p + 1}→${i + 2}`).join(" ");

line("1 · HOW MANY TREES k CLUSTERS HAVE (trunk fixed, parents ordered)");
for (const k of [2, 3, 4, 5, 6]) {
  const n = trees(k).length;
  console.log(`  ${k} clusters: ${String(n).padStart(4)} trees   (${k - 1}! = ${[...Array(k - 1)].reduce((a, _, i) => a * (i + 1), 1)})`);
}

line("2 · HIS DATA: three clusters, four samples");
{
  const all = trees(3);
  for (let used = 1; used <= 4; used += 1) {
    const samples = M.SAMPLES.slice(0, used);
    const fit = all.filter((t) => samples.every((s) => fitsSumRule(t, s.ccf)));
    console.log(`  first ${used} sample(s): ${fit.length} of ${all.length} trees fit — ${fit.map(name).join(" | ")}`);
  }
  const surgery = M.SAMPLES.find((s) => s.key === "P2.surgery");
  const alone = all.filter((t) => fitsSumRule(t, surgery.ccf));
  console.log(`  the surgery sample alone: ${alone.length} of ${all.length}`);
  console.log(`  -> the lesson it can teach: one sample leaves both, four leave the linear tree.`);
}

line("3 · A FOUR-CLUSTER PATIENT, built from a known tree");
/* No lesson data has four clusters, so this one is BUILT, and says so. The true
   tree is a mixed one — 1 is the trunk, 2 and 3 branch from it, 4 sits under 3 —
   the pattern three clusters cannot draw. Each sample holds its own share of
   each subclone; a CCF is the share of tumour cells carrying that cluster's
   mutations, which is its own share plus every descendant's. */
const TRUE = [0, 0, 2]; // parents of clusters 2, 3, 4 (0-indexed): 2 under 1, 3 under 1, 4 under 3
const sharesPerSample = [
  // [own share of 1, 2, 3, 4] — shares sum to 1 across a sample's tumour cells
  { key: "S1", own: [0.30, 0.30, 0.15, 0.25] },
  { key: "S2", own: [0.20, 0.10, 0.30, 0.40] },
  { key: "S3", own: [0.35, 0.40, 0.20, 0.05] },
  { key: "S4", own: [0.25, 0.05, 0.10, 0.60] },
];
const ccfOf = (parents, own) => {
  const k = own.length;
  const ccf = [...own];
  for (let node = k - 1; node >= 1; node -= 1) ccf[parents[node - 1]] += ccf[node];
  return ccf;
};
const built = sharesPerSample.map((s) => ({ key: s.key, ccf: ccfOf(TRUE, s.own) }));
for (const s of built) console.log(`  ${s.key}: CCF ${s.ccf.map((c) => c.toFixed(2)).join("  ")}`);
{
  const all = trees(4);
  console.log(`\n  the true tree: ${name(TRUE)}`);
  for (let used = 1; used <= 4; used += 1) {
    const samples = built.slice(0, used);
    const fit = all.filter((t) => samples.every((s) => fitsSumRule(t, s.ccf)));
    const hasTruth = fit.some((t) => t.join() === TRUE.join());
    console.log(`  ${used} sample(s): ${fit.length} of ${all.length} fit${hasTruth ? ", the true tree among them" : " — TRUE TREE MISSING"}`);
    if (fit.length <= 3) console.log(`      ${fit.map(name).join(" | ")}`);
  }
}

line("4 · IS THE NARROWING TYPICAL, OR DID I PICK IT? — random patients");
/* Random own-shares per sample (Dirichlet-ish via normalised uniforms) on a
   random true tree, many times: how many trees survive at 1, 2, 3, 4 samples. */
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (const k of [3, 4]) {
    const all = trees(k);
    const tally = [0, 0, 0, 0, 0];
    const RUNS = 2000;
    for (let run = 0; run < RUNS; run += 1) {
      const truth = all[Math.floor(rnd() * all.length)];
      const samples = [];
      for (let s = 0; s < 4; s += 1) {
        const raw = [...Array(k)].map(() => rnd() + 0.05);
        const sum = raw.reduce((a, b) => a + b, 0);
        samples.push({ ccf: ccfOf(truth, raw.map((x) => x / sum)) });
      }
      for (let used = 1; used <= 4; used += 1) {
        const fit = all.filter((t) => samples.slice(0, used).every((s) => fitsSumRule(t, s.ccf)));
        tally[used] += fit.length;
      }
    }
    console.log(`  ${k} clusters, ${all.length} trees: mean surviving at 1 → 4 samples: `
      + [1, 2, 3, 4].map((u) => (tally[u] / RUNS).toFixed(2)).join("  →  "));
  }
  console.log(`\n  -> with 3 clusters there is little room to narrow (2 trees). With 4 the`);
  console.log(`     sampling lesson — MORE BIOPSIES, FEWER TREES — has room to show.`);
}

line("5 · WHAT THE FIGURE DRAWS THAT THE PAGE DOES NOT");
console.log(`  his cancer-retcher.png has:
    arrowheads on the edges (1 → 2 → 3, directed)   the page draws plain lines
    an error bar on every cluster mean CCF           the page draws points only
    three driver genes named per cluster             the page names none
  The error bars matter to the sum rule: 1.05 > 0.73 is a violation no error bar
  closes; 0.95 > 0.83 is closer, and the figure's own bars are what say whether
  it is real.`);
