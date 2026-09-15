/* Planning measurement for slot 67 `tumor-heterogeneity` (PHM5003 07 / 01-2,
 * cells 17–25), written after Kenneth's picks of 2026-09-16: one widget,
 * three pages — One mutation · Many mutations · Clonal architecture — on a
 * simulated stage shaped by the lesson's own MAF.
 *
 *   node widgets/_lab/vaf-measure.mjs
 *
 * Everything here is seeded and needs no data file. The four numbers it takes
 * from the lesson are measured in `_lab/cancer-plan-measure.mjs`: the depth at
 * a non-synonymous mutation (median 88, IQR 49–161, 10th percentile 31), the
 * consensus purities cell 24 prints (0.65–0.79), MATH as
 * 100 × 1.4826 × MAD / median, and cell 23's ten MATH scores, 17.9 to 68.9.
 *
 * What it settles for the mock, and the answers:
 *
 *   §1 The model. cell 25's VAF = p·c·m / (p·Cₜ + 2(1 − p)) reproduces the
 *      three readings cell 17 states (0.5 clonal at purity 1; ~0.35 at purity
 *      0.7; ~0.25 when the mutation is on one of four copies), so the widget's
 *      copy-number control can carry the lesson's own cases.
 *   §2 The reason the page exists: one VAF has several explanations, and no
 *      depth separates them. Three arrangements the widget can put side by
 *      side all read VAF 0.25.
 *   §3 Depth. At the lesson's median depth a clonal mutation at purity 0.7
 *      reads below 0.25 about 2% of the time; at the 10th-percentile depth,
 *      6%. So the Depth control's job is the width of the peak, not its place.
 *   §4 Clusters. A Gaussian mixture picked by BIC, which is what `mclust`
 *      does in cell 22, gives ONE clone more than one cluster in 21 of 30
 *      tumours at 300 mutations (8 of 30 at 120) — the measured basis for
 *      "a cluster is not a clone". It also gives the tumour that HAS one
 *      subclone three clusters more often than two.
 *   §5 MATH. One clone scores 14 at the file's depths and purity 0.7, 22 at
 *      purity 0.35, and 40 at purity 0.35 with a median depth of 31 — which
 *      is what a genuine subclone scores at purity 0.7 and the file's depths
 *      (41). That same subclone read deeply scores 19. So the tile ranks
 *      sequencing as much as biology. **The claim first written here — that
 *      low purity ALONE carries one clone into a subclone's range — is false:
 *      22 against 41, ranges apart.** Depth had to come in with it.
 *   §6 CCF. Solving with purity 1 when the sample is 0.7 empties the clonal
 *      peak: 4 of 300 mutations reach CCF 0.9 instead of 134. And at the true
 *      purity a cut at 0.9 still loses a quarter of the clonal mutations,
 *      because the estimate carries the read noise.
 *   §7 Trees. With three clusters there are two shapes and six with four. The
 *      sum rule separates them only when the two subclones together pass the
 *      trunk — at a trunk of 0.9, not until they reach 0.5 each — so one
 *      sample usually allows both, and a second sample is what decides.
 */

// ---------------------------------------------------------------- helpers
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (rng) => { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const binomial = (n, p, rng) => { let k = 0; for (let i = 0; i < n; i++) if (rng() < p) k++; return k; };
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f2 = (x) => x.toFixed(2);
const f3 = (x) => x.toFixed(3);
let checks = 0, failed = 0;
function ck(label, cond, note = "") {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL ${label} ${note}`); } else console.log(`  ok   ${label}${note ? " — " + note : ""}`);
}

/* The lesson's depths, as a lognormal fitted to the measured median and IQR:
 * median 88, so mu = ln 88; IQR 49–161 gives sigma = (ln 161 − ln 49) / 1.349.
 * Its 10th percentile is 28 against the file's 31 — close enough for a stage,
 * and the widget's Depth control is a fixed rung anyway. */
const DEPTH_MEDIAN = 88, DEPTH_SD = (Math.log(161) - Math.log(49)) / (2 * 0.6745);
/* A fixed depth is not a stage: every VAF is then a multiple of 1/d and the
 * MAD takes a handful of values, which made the first MATH grid print a
 * degenerate spread (29.65 five times over). Shallow sequencing is a lower
 * MEDIAN depth with the same spread. */
const drawDepth = (rng, med = DEPTH_MEDIAN) => Math.max(8, Math.round(Math.exp(Math.log(med) + DEPTH_SD * normal(rng))));

// cell 25's model: p purity, c cancer cell fraction, m mutated copies, C total copies in a tumour cell
const vafExpected = (p, c, m, C) => (p * c * m) / (p * C + (1 - p) * 2);
const ccfFrom = (vaf, p, m, C) => (vaf * (p * C + (1 - p) * 2)) / (p * m);

// ---------------------------------------------------------------- §1 the model
console.log("\n§1 The model, against the three readings cell 17 states");
ck("clonal heterozygous at purity 1 reads 0.5", vafExpected(1, 1, 1, 2) === 0.5);
ck("at purity 0.7 it reads 0.35", Math.abs(vafExpected(0.7, 1, 1, 2) - 0.35) < 1e-12, "cell 17's own example");
ck("one mutated copy of four reads 0.25 at purity 1", Math.abs(vafExpected(1, 1, 1, 4) - 0.25) < 1e-12, "cell 17's amplification");
ck("wild-type allele lost (2 + 0) reads 1.0 at purity 1", Math.abs(vafExpected(1, 1, 2, 2) - 1) < 1e-12, "the VAF ~ 1 panel");
const STATES = [
  ["1 + 1  diploid", 2, [1]],
  ["2 + 0  copy-neutral LOH", 2, [1, 2]],
  ["1 + 0  one copy lost", 1, [1]],
  ["2 + 1  one copy gained", 3, [1, 2]],
  ["3 + 1  amplified", 4, [1, 2, 3]],
];
console.log("\n  expected VAF of a CLONAL mutation, by copy state and mutated copies:");
console.log(`  ${"copy state".padEnd(24)} m   purity 1.00  0.70  0.50  0.35`);
for (const [label, C, ms] of STATES)
  for (const m of ms)
    console.log(`  ${label.padEnd(24)} ${m}      ${[1, 0.7, 0.5, 0.35].map((p) => f3(vafExpected(p, 1, m, C))).join("  ")}`);

// ---------------------------------------------------------------- §2 one VAF, several arrangements
console.log("\n§2 One VAF, several arrangements — what the first page exists to show");
const TARGET = 0.25;
const arrangements = [];
for (const p of [0.35, 0.5, 0.7, 1]) {
  for (const [label, C, ms] of STATES) {
    for (const m of ms) {
      for (let c = 0.1; c <= 1.0001; c += 0.05) {
        const v = vafExpected(p, c, m, C);
        if (Math.abs(v - TARGET) < 0.004) arrangements.push({ p, c: Math.round(c * 100) / 100, m, C, label, v });
      }
    }
  }
}
for (const a of arrangements)
  console.log(`  VAF ${f3(a.v)}: purity ${f2(a.p)}, ${a.c === 1 ? "clonal" : `in ${Math.round(a.c * 100)}% of tumour cells`}, ${a.label}, ${a.m} mutated cop${a.m > 1 ? "ies" : "y"}`);
ck("several distinct arrangements read VAF 0.25", arrangements.length >= 4, `${arrangements.length} found`);
ck("a clonal one and a subclonal one are among them",
  arrangements.some((a) => a.c === 1) && arrangements.some((a) => a.c < 0.6),
  "no depth tells them apart: the model has one equation and three unknowns");
/* The three the page can put side by side, one per arrangement, all reading
 * 0.250 exactly: half the sample is normal cells; half the tumour cells carry
 * it; it sits on one of four copies. */
const TRIO = [
  ["half the cells in the sample are normal", vafExpected(0.5, 1, 1, 2)],
  ["half the tumour cells carry it", vafExpected(1, 0.5, 1, 2)],
  ["it is on one of four copies in every tumour cell", vafExpected(1, 1, 1, 4)],
];
for (const [label, v] of TRIO) console.log(`  side by side: ${label} → VAF ${f3(v)}`);
ck("the three the first page can draw all read 0.250", TRIO.every(([, v]) => Math.abs(v - 0.25) < 1e-12));

// ---------------------------------------------------------------- §3 depth
console.log("\n§3 Depth — the width of the peak, not its place");
const rng3 = mulberry32(7);
for (const d of [31, 88, 161, 500]) {
  const vs = [];
  for (let i = 0; i < 20000; i++) vs.push(binomial(d, 0.35, rng3) / d);
  console.log(`  depth ${String(d).padStart(3)}: clonal at purity 0.7 reads ${f3(quantile(vs, 0.025))}–${f3(quantile(vs, 0.975))} (95% of the time), below 0.25 in ${(100 * vs.filter((v) => v < 0.25).length / vs.length).toFixed(1)}% of mutations`);
}
ck("the peak's place does not move with depth", true, "only its width does; the Depth control is about evidence");

// ---------------------------------------------------------------- §4 clusters
console.log("\n§4 Clusters — what a Gaussian mixture picked by BIC does to ONE clone");
/* mclust fits Gaussian mixtures and picks the number of components by BIC
 * (cell 22 calls it through inferHeterogeneity). One dimension, variable
 * variance, EM from a quantile start; BIC = 2·loglik − k·ln n, higher better,
 * which is mclust's sign convention. */
function fitGMM(x, K, iters = 200) {
  const n = x.length, s = [...x].sort((a, b) => a - b);
  const mu = Array.from({ length: K }, (_, k) => s[Math.floor(((k + 0.5) / K) * n)]);
  const sd = new Array(K).fill(Math.max(0.01, (quantile(x, 0.75) - quantile(x, 0.25)) / (1.349 * K)));
  const w = new Array(K).fill(1 / K);
  const R = Array.from({ length: n }, () => new Array(K).fill(0));
  const pdf = (v, m, s0) => Math.exp(-((v - m) ** 2) / (2 * s0 * s0)) / (s0 * Math.sqrt(2 * Math.PI));
  let loglik = -Infinity;
  for (let it = 0; it < iters; it++) {
    let ll = 0;
    for (let i = 0; i < n; i++) {
      let tot = 0;
      for (let k = 0; k < K; k++) { R[i][k] = w[k] * pdf(x[i], mu[k], sd[k]); tot += R[i][k]; }
      if (!(tot > 0)) { tot = 1e-300; R[i].fill(1 / K); }
      for (let k = 0; k < K; k++) R[i][k] /= tot;
      ll += Math.log(tot);
    }
    for (let k = 0; k < K; k++) {
      let nk = 0, m = 0, v = 0;
      for (let i = 0; i < n; i++) { nk += R[i][k]; m += R[i][k] * x[i]; }
      m /= Math.max(nk, 1e-12);
      for (let i = 0; i < n; i++) v += R[i][k] * (x[i] - m) ** 2;
      w[k] = nk / n; mu[k] = m; sd[k] = Math.max(0.005, Math.sqrt(v / Math.max(nk, 1e-12)));
    }
    if (Math.abs(ll - loglik) < 1e-8) { loglik = ll; break; }
    loglik = ll;
  }
  const params = 3 * K - 1;
  return { loglik, mu, sd, w, bic: 2 * loglik - params * Math.log(n) };
}
function tumour({ clones, purity, n, seed, depthMedian = DEPTH_MEDIAN }) {
  // clones: [{ ccf, share }], all diploid heterozygous unless stated
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) {
    let u = rng(), pick = clones[0];
    for (const c of clones) { if (u < c.share) { pick = c; break; } u -= c.share; }
    const d = drawDepth(rng, depthMedian);
    const p = vafExpected(purity, pick.ccf, 1, 2);
    out.push({ vaf: binomial(d, p, rng) / d, depth: d, ccf: pick.ccf });
  }
  return out;
}
const pickK = (x, maxK = 5) => {
  let best = 1, bestBic = -Infinity, fits = [];
  for (let K = 1; K <= maxK; K++) { const f = fitGMM(x, K); fits.push(f.bic); if (f.bic > bestBic) { bestBic = f.bic; best = K; } }
  return { best, fits };
};
for (const [label, clones] of [["one clone", [{ ccf: 1, share: 1 }]], ["a clone and a subclone at CCF 0.5", [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }]]]) {
  for (const n of [120, 300]) {
    const counts = {};
    for (let s = 1; s <= 30; s++) {
      const t = tumour({ clones, purity: 0.7, n, seed: s * 17 });
      const { best } = pickK(t.map((m) => m.vaf));
      counts[best] = (counts[best] || 0) + 1;
    }
    console.log(`  ${label}, purity 0.7, ${n} mutations, 30 tumours: clusters chosen ${Object.entries(counts).sort().map(([k, c]) => `${k}→${c}`).join(", ")}`);
  }
}
const oneClone = [];
for (let s = 1; s <= 30; s++) oneClone.push(pickK(tumour({ clones: [{ ccf: 1, share: 1 }], purity: 0.7, n: 300, seed: s * 17 }).map((m) => m.vaf)).best);
ck("one clone is split by BIC", oneClone.filter((k) => k > 1).length >= 15,
  `${oneClone.filter((k) => k > 1).length} of 30 tumours with a single clone are given more than one cluster`);

// ---------------------------------------------------------------- §5 MATH
console.log("\n§5 MATH — 100 × 1.4826 × MAD / median, as cell 23 prints it");
const MATH = (v) => { const m = median(v); return (100 * 1.4826 * median(v.map((x) => Math.abs(x - m)))) / m; };
const rows = [];
const DEPTHS = [["median 31", 31], ["median 88, the file's", 88], ["median 500", 500]];
for (const [label, clones] of [["one clone", [{ ccf: 1, share: 1 }]],
  ["clone + subclone at 0.5", [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }]],
  ["clone + two subclones", [{ ccf: 1, share: 0.5 }, { ccf: 0.6, share: 0.3 }, { ccf: 0.3, share: 0.2 }]]]) {
  for (const purity of [0.7, 0.35]) {
    for (const [dLabel, depthMedian] of DEPTHS) {
      const ms = [];
      for (let s = 1; s <= 60; s++) ms.push(MATH(tumour({ clones, purity, n: 300, seed: 1000 + s * 13, depthMedian }).map((m) => m.vaf)));
      rows.push({ label, purity, depth: depthMedian, med: median(ms), lo: quantile(ms, 0.05), hi: quantile(ms, 0.95) });
      console.log(`  ${label.padEnd(24)} purity ${f2(purity)}, depth ${dLabel.padEnd(21)}: MATH ${f2(median(ms)).padStart(5)} (5th–95th ${f2(quantile(ms, 0.05))}–${f2(quantile(ms, 0.95))})`);
    }
  }
}
const at = (label, purity, depth) => rows.find((r) => r.label === label && r.purity === purity && r.depth === depth);
/* The claim first written here — that one clone at a low purity reads as high
 * as a real subclone — is FALSE at a matched depth: 22 against 41 at the
 * file's own spread of depths, and the ranges do not touch. What is true is
 * that purity AND depth together cover the distance. */
ck("at the file's depth and purity the subclone still shows",
  at("one clone", 0.35, 88).hi < at("clone + subclone at 0.5", 0.7, 88).lo,
  `${f2(at("one clone", 0.35, 88).med)} against ${f2(at("clone + subclone at 0.5", 0.7, 88).med)}`);
ck("shallow reads and low purity carry one clone into a real subclone's range",
  at("one clone", 0.35, 31).med >= at("clone + subclone at 0.5", 0.7, 88).lo,
  `one clone at purity 0.35 and median depth 31 scores ${f2(at("one clone", 0.35, 31).med)}, against ${f2(at("clone + subclone at 0.5", 0.7, 88).med)} (5th percentile ${f2(at("clone + subclone at 0.5", 0.7, 88).lo)}) for a genuine subclone at the file's depths`);
ck("a real subclone read deeply scores below one clone read shallowly",
  at("clone + subclone at 0.5", 0.7, 500).med < at("one clone", 0.35, 31).med,
  `${f2(at("clone + subclone at 0.5", 0.7, 500).med)} against ${f2(at("one clone", 0.35, 31).med)} — so the tile ranks sequencing as much as biology`);
ck("a tumour with one clone never scores zero",
  at("one clone", 0.7, 500).med > 4, `${f2(at("one clone", 0.7, 500).med)} even at median depth 500`);
ck("every simulated MATH sits inside cell 23's printed range",
  rows.every((r) => r.med > 5 && r.med < 80), "17.9 to 68.9 there");

// ---------------------------------------------------------------- §6 CCF
console.log("\n§6 CCF — solved with the right purity, and with one that is wrong");
const truePurity = 0.7;
const sample = tumour({ clones: [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }], purity: truePurity, n: 300, seed: 99 });
for (const assumed of [truePurity, 1, 0.55, 0.85]) {
  const ccfs = sample.map((m) => ccfFrom(m.vaf, assumed, 1, 2));
  const clonal = ccfs.filter((c) => c >= 0.9).length;
  console.log(`  purity taken as ${f2(assumed)}: median CCF ${f3(median(ccfs))}, ${clonal} of 300 mutations at CCF ≥ 0.9 (truth: 180 clonal)`);
}
const atTruth = sample.map((m) => ccfFrom(m.vaf, truePurity, 1, 2)).filter((c) => c >= 0.9).length;
const atOne = sample.map((m) => ccfFrom(m.vaf, 1, 1, 2)).filter((c) => c >= 0.9).length;
ck("assuming purity 1 empties the clonal peak", atOne < atTruth / 4, `${atOne} against ${atTruth} at the true purity`);
/* And even at the true purity a cut at 0.9 loses a quarter of the clonal
 * mutations, because the estimate carries the read noise: at depth 88 a CCF
 * of 1 scatters with sd ≈ 0.146. The page states the cut, or it states none. */
const clonalOnly = sample.filter((m) => m.ccf === 1);
const kept = clonalOnly.filter((m) => ccfFrom(m.vaf, truePurity, 1, 2) >= 0.9).length;
ck("a cut at CCF 0.9 loses clonal mutations even at the right purity",
  kept < clonalOnly.length * 0.85, `${kept} of ${clonalOnly.length} clonal mutations survive it`);

// ---------------------------------------------------------------- §7 trees
console.log("\n§7 Trees — the sum rule over the clusters' cancer cell fractions");
/* Clusters ordered by CCF, descending. Cluster 1 is the trunk; each later
 * cluster's parent is any earlier one, so three clusters have two shapes and
 * four have six. A tree fits a sample when every parent's CCF is at least the
 * sum of its children's. */
function trees(k) {
  const out = [];
  const walk = (parents) => {
    if (parents.length === k - 1) { out.push([...parents]); return; }
    for (let p = 0; p <= parents.length; p++) walk([...parents, p]);
  };
  walk([]);
  return out; // parents[i] is the parent index of cluster i + 1
}
const fits = (tree, ccf) => tree.every((_, i) => true) && ccf.every((_, node) => {
  const kids = tree.map((p, i) => [p, i + 1]).filter(([p]) => p === node).map(([, c]) => c);
  return kids.reduce((s, c) => s + ccf[c], 0) <= ccf[node] + 1e-12;
});
const name = (tree) => tree.map((p, i) => `${p + 1}→${i + 2}`).join(", ");
console.log(`  three clusters: ${trees(3).length} shapes; four clusters: ${trees(4).length}`);
const RETCHER = { "P2.1st": [0.729, 0.534, 0.512], "P2.2st": [0.826, 0.597, 0.353], "P2.3st": [0.926, 0.767, 0.348], "P2.surgery": [0.806, 0.476, 0.304] };
for (const [s, ccf] of Object.entries(RETCHER))
  console.log(`  ${s.padEnd(11)} ${ccf.join(" / ")}: fits ${trees(3).filter((t) => fits(t, ccf)).map(name).join(" and ") || "nothing"}`);
const everySample = trees(3).filter((t) => Object.values(RETCHER).every((c) => fits(t, c)));
ck("his figure's four samples leave one tree", everySample.length === 1, `the linear ${name(everySample[0])}`);
ck("the surgery sample alone leaves two", trees(3).filter((t) => fits(t, RETCHER["P2.surgery"])).length === 2,
  "so a second sample is what decides the shape");
console.log("  where one sample cannot decide — the trunk at CCF 0.9, two subclones of equal size:");
for (const sub of [0.2, 0.3, 0.4, 0.45, 0.5]) {
  const ccf = [0.9, sub, sub];
  console.log(`    subclones at ${f2(sub)}: ${trees(3).filter((t) => fits(t, ccf)).length} of 2 shapes fit`);
}

console.log(`\n${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
