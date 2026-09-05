/* ============================================================================
   Does the STUDY-DESIGN TAXONOMY earn a widget of its own?

   Kenneth's two slides — observational (cross-sectional / case-control /
   cohort) and experimental (independent / repeated measures) — are
   classifications. A widget earns its place by showing a MECHANISM a static
   figure cannot, so the test is: run one truth through each design and see
   whether the designs give different answers, and by how much.

       node widgets/_lab/design-taxonomy.mjs
   ========================================================================= */
import { makeRng } from "../core/rng.js";
import { mean, tTailP } from "../core/stats.js";

const DRAWS = 4000;
const rngAt = (d) => makeRng(1 + d * 7919);
const pct = (k, n) => `${((k / n) * 100).toFixed(1)}%`;

function welch(a, b) {
  const ma = mean(a), mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1);
  const se2 = va / a.length + vb / b.length;
  const df = se2 ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: mb - ma, p: tTailP(Math.abs((mb - ma) / Math.sqrt(se2)), df) };
}
function paired(d) {
  const m = mean(d);
  const s = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (d.length - 1));
  const t = m / (s / Math.sqrt(d.length));
  return { diff: m, p: tTailP(Math.abs(t), d.length - 1) };
}

console.log("\n\u00a71  INDEPENDENT AGAINST REPEATED MEASURES — the one design choice");
console.log("    on the experimental slide that is MEASURABLE rather than definitional.");
console.log("    Same n subjects measured, same treatment effect 0.5, same within-subject");
console.log("    noise 0.5. The only thing that moves is how much subjects differ.\n");
console.log("  between-subject SD | n  | independent (2n subjects) | repeated (n subjects, 2 each)");
for (const bsd of [0.25, 0.5, 1, 2, 4]) {
  for (const n of [10]) {
    let ind = 0, rep = 0;
    for (let d = 0; d < DRAWS; d += 1) {
      const rng = rngAt(d);
      /* independent: 2n DIFFERENT people, n per arm */
      const a = [], b = [];
      for (let i = 0; i < n; i += 1) {
        a.push(rng.normal(0, bsd) + rng.normal(0, 0.5));
        b.push(rng.normal(0, bsd) + rng.normal(0, 0.5) + 0.5);
      }
      if (welch(a, b).p < 0.05) ind += 1;
      /* repeated: n people, each measured off and on treatment. The person's
         own level cancels in the difference — that is the whole point. */
      const diffs = [];
      for (let i = 0; i < n; i += 1) {
        const person = rng.normal(0, bsd);
        diffs.push((person + rng.normal(0, 0.5) + 0.5) - (person + rng.normal(0, 0.5)));
      }
      if (paired(diffs).p < 0.05) rep += 1;
    }
    console.log(`  ${bsd.toFixed(2).padStart(18)} | ${String(n).padStart(2)} | ${pct(ind, DRAWS).padStart(25)}`
      + ` | ${pct(rep, DRAWS).padStart(29)}`);
  }
}
console.log("\n  -> repeated measures uses HALF the people and wins everywhere; the gap");
console.log("     widens with between-subject SD, which is the mechanism (the person's");
console.log("     own level cancels). At SD 4 it is the difference between a study");
console.log("     that works and one that cannot.");

console.log("\n§2  THE OBSERVATIONAL SLIDE IS ALREADY HOSTED — and the one draw");
console.log("    that almost said otherwise.\n");
console.log("    Widget 12 `odds-and-risk` has Cohort and Case-control as its two TABS,");
console.log("    and its whole argument is why a risk ratio needs a cohort. A sketch of");
console.log("    the same comparison went in here first and reported a case-control odds");
console.log("    ratio of 4.59 against a truth of 3.35 — which reads as a finding and was");
console.log("    ONE DRAW of one 1000-case sample. The same trap as the notebook's cell");
console.log("    85. Averaged over 400 case-control studies it recovers the truth:\n");
{
  const P_EXPOSED = 0.30;
  const RISK_UNEXP = 0.05;
  const RISK_EXP = 0.15;
  const trueOR = (RISK_EXP / (1 - RISK_EXP)) / (RISK_UNEXP / (1 - RISK_UNEXP));
  /* sampled on the OUTCOME, which is what a case-control study is */
  const pExpGivenCase = (P_EXPOSED * RISK_EXP)
    / (P_EXPOSED * RISK_EXP + (1 - P_EXPOSED) * RISK_UNEXP);
  const pExpGivenCtrl = (P_EXPOSED * (1 - RISK_EXP))
    / (P_EXPOSED * (1 - RISK_EXP) + (1 - P_EXPOSED) * (1 - RISK_UNEXP));
  const REPS = 400;
  let sum = 0;
  for (let d = 0; d < REPS; d += 1) {
    const r = makeRng(101 + d * 7919);
    let a = 0;
    let b = 0;
    for (let i = 0; i < 1000; i += 1) if (r.next() < pExpGivenCase) a += 1;
    for (let i = 0; i < 1000; i += 1) if (r.next() < pExpGivenCtrl) b += 1;
    /* averaged on the log scale, which is where an odds ratio is symmetric */
    sum += Math.log((a * (1000 - b)) / (b * (1000 - a)));
  }
  console.log(`    truth                        OR ${trueOR.toFixed(3)}`);
  console.log(`    mean over ${REPS} studies       OR ${Math.exp(sum / REPS).toFixed(3)}`);
  console.log("\n    -> so the observational taxonomy needs no new widget. The only part of");
  console.log("       it a figure can argue is already widget 12's, and the rest is a");
  console.log("       classification the lecture slide states better than an animation");
  console.log("       would. §1 is the exception: independent against repeated measures");
  console.log("       is a real mechanism with a measured payoff, and nothing hosts it.");
}
console.log("");
