/* ============================================================================
   Widget 44 · Experimental Design — every number in main.js's header, measured
   against the widget's OWN engine so the comment and the figure cannot drift.

       node widgets/_lab/design-measure.mjs

   The population is the notebook's (PHM5003 HTD 05/01, cells 8 and 29):
   N(1, 0.5), carriers +1, and no true difference between the arms unless the
   effect argument asks for one. Every p under 0.05 at effect 0 is a WRONG
   ANSWER, which is what the rate columns count.
   ========================================================================= */
import { makeRng } from "../core/rng.js";
import { studentTPdf, tTailP } from "../core/stats.js";
import {
  allocateStudy, budgetStudy, welch, NOISE_SD,
} from "../experimental-design/model.js";

const DRAWS = 4000;
const rngAt = (d) => makeRng(1 + d * 7919);
const pct = (k, n) => `${((k / n) * 100).toFixed(1)}%`;

function overAllocations(n, scheme, effect, draws = DRAWS) {
  let sig = 0, sum = 0, sq = 0, imb = 0, worst = 0;
  for (let d = 0; d < draws; d += 1) {
    const s = allocateStudy(rngAt(d), { n, scheme, effect });
    if (s.p < 0.05) sig += 1;
    sum += s.diff; sq += s.diff ** 2;
    imb += s.imbalance; worst = Math.max(worst, s.imbalance);
  }
  return {
    rate: sig / draws,
    centre: sum / draws,
    spread: Math.sqrt(sq / draws - (sum / draws) ** 2),
    imb: imb / draws,
    worst,
  };
}

console.log("\n§1  ALLOCATION — no true effect, so every p < 0.05 is a wrong answer\n");
console.log("  n/arm | convenience | randomized | blocked | mean |imbalance| under randomization");
/* the widget's own range. Above 24 a Convenience draw can run short of carriers
   in a 96-strong coin-flip population, and the study would silently shrink —
   which is why `n` is capped there and why this table stops there too. */
for (const n of [4, 10, 20, 24]) {
  const c = overAllocations(n, "convenience", 0);
  const r = overAllocations(n, "random", 0);
  const b = overAllocations(n, "blocked", 0);
  console.log(`  ${String(n).padStart(5)} | ${pct(c.rate, 1).padStart(11)} | ${pct(r.rate, 1).padStart(10)}`
    + ` | ${pct(b.rate, 1).padStart(7)} | ${r.imb.toFixed(2)} of ${n} (worst ${r.worst})`);
}

console.log("\n§2  THE ESTIMATE ITSELF, at n = 24 per arm — centre, and how far it moves\n");
console.log("  scheme      |  centre |  spread | wrong answers");
for (const k of ["convenience", "random", "blocked"]) {
  const s = overAllocations(24, k, 0);
  console.log(`  ${k.padEnd(12)}| ${s.centre.toFixed(3).padStart(7)} | ${s.spread.toFixed(3).padStart(7)}`
    + ` | ${pct(s.rate, 1).padStart(13)}`);
}
console.log("  -> convenience recovers the CONFOUNDER, 1.000 against a planted 1.000;");
console.log("     block's estimates are 30% tighter than randomization's (0.145 against");
console.log("     0.207) and its unadjusted test is CONSERVATIVE, not merely better.");

console.log("\n§3  THE BUDGET — people against repeats of the same person\n");
const budgetRate = (people, reps, effect, draws = 3000) => {
  let row = 0, per = 0;
  for (let d = 0; d < draws; d += 1) {
    const s = budgetStudy(rngAt(d), { people, reps, effect });
    if (s.p < 0.05) row += 1;
    if (s.meanTest && s.meanTest.p < 0.05) per += 1;
  }
  return { row: row / draws, per: per / draws };
};
console.log("  false positives, no true effect          power at a true effect of 0.5");
process.stdout.write("  people / reps |");
for (const t of [1, 2, 3, 10]) process.stdout.write(`x${t}`.padStart(8));
process.stdout.write("   |");
for (const t of [1, 2, 3, 10]) process.stdout.write(`x${t}`.padStart(8));
console.log("");
for (const p of [3, 10, 30]) {
  process.stdout.write(String(p).padStart(12) + " |");
  for (const t of [1, 2, 3, 10]) process.stdout.write(pct(budgetRate(p, t, 0).row, 1).padStart(8));
  process.stdout.write("   |");
  for (const t of [1, 2, 3, 10]) process.stdout.write(pct(budgetRate(p, t, 0.5).row, 1).padStart(8));
  console.log("");
}
console.log("  -> the x10 column is FLAT. Ten times the people does not touch it,");
console.log("     which is why the tab needs two dials and not one.");

console.log("\n§4  ONE BUDGET, 30 measurements per arm, spent five ways\n");
console.log("  split          | rows: wrong / power | per person: wrong / power");
for (const [p, t] of [[30, 1], [15, 2], [10, 3], [6, 5], [3, 10]]) {
  const a = budgetRate(p, t, 0);
  const b = budgetRate(p, t, 0.5);
  console.log(`  ${String(p).padStart(2)} people x ${String(t).padStart(2)} |`
    + ` ${pct(a.row, 1).padStart(9)} / ${pct(b.row, 1).padStart(6)} |`
    + ` ${pct(a.per, 1).padStart(15)} / ${pct(b.per, 1)}`);
}
console.log("  -> the row test's power barely moves, 76% to 69%, which is why");
console.log("     pseudoreplication is tempting. The honest power collapses to 11%.");

console.log("\n§5  THE NOTEBOOK'S OWN CELL 85 — 3 people x 10 reps, a REAL effect of 0.5");
console.log("    it prints ONE seed and concludes there is no significant difference\n");
{
  let sig = 0, backwards = 0;
  for (let d = 0; d < 3000; d += 1) {
    const s = budgetStudy(rngAt(d), { people: 3, reps: 10, effect: 0.5 });
    if (s.p < 0.05) { sig += 1; if (s.diff < 0) backwards += 1; }
  }
  console.log(`    significant in ${pct(sig, 3000)} of studies`);
  console.log(`    of those, the sign is BACKWARDS in ${pct(backwards, sig)}`);
  console.log("    -> the stated hazard is a lost finding; the measured one is an");
  console.log("       invented finding at ~44% when nothing is there (§3, top right).");
}

console.log("\n§6  WELCH, CHECKED BY HAND AND AGAINST AN INDEPENDENT INTEGRAL\n");
{
  /* NO R OUTPUT IS QUOTED HERE. An R number recalled from memory once flagged a
     correct Benjamini-Hochberg implementation as wrong (HANDOVER, 2026-09-05),
     and a first draft of this very block did it again — a remembered t of
     1.8074 against a hand-derived 1.8974. So this checks the closed form.

       x = 1..5          mean 3, var 2.5,  n 5
       y = 2,4,6,8,10    mean 6, var 10,   n 5
       se^2 = 2.5/5 + 10/5 = 2.5,  se = 1.5811388
       t    = (6 - 3) / 1.5811388 = 1.8973666
       df   = 2.5^2 / (0.5^2/4 + 2^2/4) = 6.25 / 1.0625 = 5.8823529            */
  const r = welch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  const want = { diff: 3, se: Math.sqrt(2.5), t: 3 / Math.sqrt(2.5), df: 6.25 / 1.0625 };
  for (const k of ["diff", "se", "t", "df"]) {
    const ok = Math.abs(r[k] - want[k]) < 1e-9;
    console.log(`    ${k.padEnd(4)} ${r[k].toFixed(7).padStart(12)}   hand ${want[k].toFixed(7).padStart(12)}   ${ok ? "ok" : "MISMATCH"}`);
  }
  /* the tail, integrated from the same t density rather than through the
     incomplete beta tTailP uses, so the two cannot share a mistake */
  const integrate = (t, df) => {
    const hi = t + 2000, n = 400000, h = (hi - t) / n;
    let acc = studentTPdf(t, df) + studentTPdf(hi, df);
    for (let i = 1; i < n; i += 1) acc += studentTPdf(t + i * h, df) * (i % 2 ? 4 : 2);
    return 2 * ((acc * h) / 3);
  };
  const num = integrate(r.t, r.df);
  console.log(`    p    ${r.p.toFixed(7).padStart(12)}   Simpson ${num.toFixed(7).padStart(12)}   ${Math.abs(r.p - num) < 1e-7 ? "ok" : "MISMATCH"}`);
}
console.log("");

/* ------------------------------------------------------------------------- */
console.log("§7  THE PILE'S WINDOW — main.js's closed form against the studies\n");
{
  const NOISE = 0.5;
  const DELTA = 1.0;
  const SDS = 4;
  const winAllocate = (n, effect) => {
    const plain = Math.sqrt((2 * NOISE ** 2) / n);
    const drawn = Math.sqrt((2 * NOISE ** 2) / n + DELTA ** 2 / (2 * n));
    const c = [DELTA + effect, effect, effect];
    const s = [plain, drawn, plain];
    let lo = Infinity; let hi = -Infinity;
    c.forEach((v, i) => { lo = Math.min(lo, v - SDS * s[i]); hi = Math.max(hi, v + SDS * s[i]); });
    return [Math.floor(lo * 10) / 10, Math.ceil(hi * 10) / 10];
  };
  const winBudget = (people, effect) => {
    const s = Math.sqrt((2 * (NOISE ** 2 + NOISE ** 2)) / people);
    return [Math.floor((effect - SDS * s) * 10) / 10, Math.ceil((effect + SDS * s) * 10) / 10];
  };

  /* the closed form against the simulation, at n = 50 */
  console.log("    SD of the estimate, closed form against 4000 draws at n = 24:");
  for (const k of ["convenience", "random", "blocked"]) {
    const m = overAllocations(24, k, 0);
    const want = k === "random"
      ? Math.sqrt((2 * NOISE ** 2) / 24 + DELTA ** 2 / 48)
      : Math.sqrt((2 * NOISE ** 2) / 24);
    console.log(`      ${k.padEnd(12)} closed ${want.toFixed(3)}   measured ${m.spread.toFixed(3)}`);
  }

  /* and that nothing falls off the panel, at every setting the widget offers */
  let worst = 0; let worstAt = "";
  for (const n of [4, 8, 12, 16, 20, 24]) {
    for (const effect of [0, 0.25, 0.5, 1]) {
      const [lo, hi] = winAllocate(n, effect);
      for (const scheme of ["convenience", "random", "blocked"]) {
        let out = 0;
        for (let d = 0; d < 300; d += 1) {
          const s = allocateStudy(makeRng(1 + d * 31), { n, scheme, effect });
          if (s.diff < lo || s.diff > hi) out += 1;
        }
        if (out > worst) { worst = out; worstAt = `${scheme} n=${n} effect=${effect}`; }
      }
    }
  }
  console.log(`\n    allocate: worst off-panel count ${worst} of 300  ${worstAt || "(never)"}`);

  worst = 0; worstAt = "";
  for (const people of [2, 3, 5, 10, 20, 30]) {
    for (const effect of [0, 0.25, 0.5, 1]) {
      const [lo, hi] = winBudget(people, effect);
      for (const reps of [1, 2, 3, 5, 10]) {
        let out = 0;
        for (let d = 0; d < 300; d += 1) {
          const s = budgetStudy(makeRng(1 + d * 31), { people, reps, effect });
          if (s.diff < lo || s.diff > hi) out += 1;
        }
        if (out > worst) { worst = out; worstAt = `people=${people} reps=${reps} effect=${effect}`; }
      }
    }
  }
  console.log(`    budget:   worst off-panel count ${worst} of 300  ${worstAt || "(never)"}`);
}
console.log("");

/* ------------------------------------------------------------------------- */
console.log("§8  WHY BLOCK LOOKS WEAKER THAN RANDOMIZE, AND WHY THAT IS CORRECT\n");
console.log("    Kenneth read 25% against 8% at a true effect of 0.25 and asked whether");
console.log("    randomization and blocking should not help similarly. They do not, and");
console.log("    the unadjusted numbers are not a bug:\n");
{
  /* OLS of y on [1, arm, carrier] — the adjusted analysis. Returns the arm
     coefficient's p. A singular design (complete confounding) returns null:
     the effect is then not estimable by any method, which is the honest
     answer rather than a number. */
  function adjusted(rows) {
    const k = 3;
    const X = rows.map((r) => [1, r.g, r.f]);
    const y = rows.map((r) => r.y);
    const A = Array.from({ length: k }, () => new Array(k).fill(0));
    const b = new Array(k).fill(0);
    for (let i = 0; i < rows.length; i += 1) {
      for (let a = 0; a < k; a += 1) {
        b[a] += X[i][a] * y[i];
        for (let c = 0; c < k; c += 1) A[a][c] += X[i][a] * X[i][c];
      }
    }
    const M = A.map((row, i) => [...row,
      ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < k; c += 1) {
      let piv = c;
      for (let r = c + 1; r < k; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-9) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      const dv = M[c][c];
      for (let j = 0; j < 2 * k; j += 1) M[c][j] /= dv;
      for (let r = 0; r < k; r += 1) {
        if (r === c) continue;
        const f = M[r][c];
        for (let j = 0; j < 2 * k; j += 1) M[r][j] -= f * M[c][j];
      }
    }
    const inv = M.map((row) => row.slice(k));
    const beta = inv.map((row) => row.reduce((acc, v, j) => acc + v * b[j], 0));
    let rss = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const fit = X[i].reduce((acc, v, j) => acc + v * beta[j], 0);
      rss += (y[i] - fit) ** 2;
    }
    const df = rows.length - k;
    const se = Math.sqrt((rss / df) * inv[1][1]);
    return tTailP(Math.abs(beta[1] / se), df);
  }

  const N = 20;
  const rate = (scheme, effect, draws = 4000) => {
    let plain = 0;
    let adj = 0;
    let singular = 0;
    for (let d = 0; d < draws; d += 1) {
      const st = allocateStudy(rngAt(d), { n: N, scheme, effect });
      if (st.p < 0.05) plain += 1;
      const rows = [];
      st.arms.forEach((arm, g) =>
        arm.forEach((s) => rows.push({ g, f: s.carrier ? 1 : 0, y: s.y })));
      const pa = adjusted(rows);
      if (pa === null) singular += 1;
      else if (pa < 0.05) adj += 1;
    }
    return { plain: plain / draws, adj: adj / draws, singular: singular / draws };
  };

  console.log(`    n = ${N} per arm. "wrong" at effect 0 is a false positive; above it, power.\n`);
  console.log("    effect | scheme      | t-test on the two arms | adjusted for the confounder");
  for (const effect of [0, 0.25, 0.5]) {
    for (const scheme of ["random", "blocked"]) {
      const r = rate(scheme, effect);
      console.log(`    ${effect.toFixed(2).padStart(6)} | ${scheme.padEnd(11)} |`
        + ` ${pct(r.plain, 1).padStart(22)} | ${pct(r.adj, 1).padStart(27)}`);
    }
  }
  const conv = rate("convenience", 0.25);
  console.log(`      0.25 | convenience | ${pct(conv.plain, 1).padStart(22)} |`
    + ` ${(conv.singular > 0.9 ? "not estimable" : pct(conv.adj, 1)).padStart(27)}`);

  console.log("\n    THE MECHANISM. Blocking pins each arm at exactly half carriers, so the");
  console.log("    confounder cancels out of the DIFFERENCE — its estimate is tighter than");
  console.log("    randomization's. But the t-test reads its SD off the WITHIN-arm spread,");
  console.log("    and each blocked arm is a half-and-half mix, which is the widest that");
  console.log("    spread can be. So the test divides a good estimate by a standard error");
  console.log("    meant for a worse one.\n");
  for (const scheme of ["random", "blocked"]) {
    const m = overAllocations(N, scheme, 0);
    console.log(`      ${scheme.padEnd(11)} SD of the estimate ${m.spread.toFixed(3)}`
      + `   false positives ${pct(m.rate, 1)}`);
  }
  console.log("\n    -> Block is not weaker. It is testing at an effective alpha near 0.005");
  console.log("       when you asked for 0.05. Put the block in the MODEL and the ordering");
  console.log("       reverses, which is the column on the right.");
}
console.log("");

/* ------------------------------------------------------------------------- */
console.log("§9  THE CONFOUNDER AS A DIAL — the evidence for option B in");
console.log("    `_lab/design-confounder.html`, and the other half of §8's answer.\n");
console.log("    n = 20 per arm, no true effect, so every rejection is a wrong answer:\n");
console.log("    confounder | convenience | randomize | block");
for (const shift of [0, 0.25, 0.5, 1, 2]) {
  const r = ["convenience", "random", "blocked"].map((k) => {
    let sig = 0;
    for (let d = 0; d < 4000; d += 1) {
      if (allocateStudy(rngAt(d), { n: 20, scheme: k, effect: 0, shift }).p < 0.05) sig += 1;
    }
    return pct(sig, 4000);
  });
  console.log(`    ${shift.toFixed(2).padStart(10)} | ${r[0].padStart(11)} | ${r[1].padStart(9)} | ${r[2].padStart(6)}`);
}
console.log("\n    AT ZERO ALL THREE AGREE, which is the cleanest statement there is that");
console.log("    the allocation exists to protect against this and nothing else. And the");
console.log("    right-hand column is §8's problem made visible: block's rate FALLS as");
console.log("    the confounder grows, because the within-arm spread it reads its SD");
console.log("    from grows with the confounder while the estimate it divides does not.");
console.log("");
console.log("§10  THE PSEUDOREPLICATION ARITHMETIC — why the Replicate tab's two dials");
console.log("     are not interchangeable, in a form the widget could print.\n");
{
  /* The widget gives a subject and a measurement the SAME spread, so half of
     what one measurement shows is the person. That ratio is the intraclass
     correlation, and it is the whole of the tab's argument: it decides how much
     a repeat is worth. */
  const s2b = NOISE_SD ** 2;
  const s2w = NOISE_SD ** 2;
  const icc = s2b / (s2b + s2w);
  const deff = (m) => 1 + (m - 1) * icc;
  console.log(`     between-subject SD ${NOISE_SD}, measurement SD ${NOISE_SD} -> ICC ${icc.toFixed(2)}\n`);
  console.log("     reps | predicted t inflation sqrt(1+(m-1)ICC) | measured |t_row|/|t_person|");
  for (const m of [1, 2, 3, 5, 10]) {
    let sum = 0, k = 0;
    for (let d = 0; d < DRAWS; d += 1) {
      const s = budgetStudy(rngAt(d), { people: 10, reps: m, effect: 0 });
      if (s.meanTest && Math.abs(s.meanTest.t) > 1e-9) {
        sum += Math.abs(s.t) / Math.abs(s.meanTest.t); k += 1;
      }
    }
    console.log(`     ${String(m).padStart(4)} |${Math.sqrt(deff(m)).toFixed(3).padStart(39)} |`
      + `${(sum / k).toFixed(3).padStart(28)}`);
  }
  console.log("\n     -> the row test's t is too big by exactly that factor, to three decimals.");
  console.log("        So its effective sample size is people*reps/(1+(reps-1)ICC), and the");
  console.log("        ceiling as reps grows is people/ICC:\n");
  console.log("     design         | rows claimed | effective | ceiling | measured false positives");
  for (const [p, m] of [[10, 1], [5, 2], [2, 5], [2, 10], [30, 1], [30, 10]]) {
    let fp = 0;
    for (let d = 0; d < DRAWS; d += 1) {
      if (budgetStudy(rngAt(d), { people: p, reps: m, effect: 0 }).p < 0.05) fp += 1;
    }
    console.log(`     ${String(p).padStart(2)} people x ${String(m).padStart(2)} |${String(p * m).padStart(13)} |`
      + `${((p * m) / deff(m)).toFixed(2).padStart(10)} |${(p / icc).toFixed(1).padStart(8)} |`
      + `${pct(fp, DRAWS).padStart(25)}`);
  }
  console.log("\n     TWO PEOPLE CAN NEVER BE WORTH MORE THAN FOUR MEASUREMENTS, however many");
  console.log("     times they are measured. That is why the x10 column of §3 is flat.");
}
console.log("");

console.log("§11  ONE BUDGET, SPENT EVERY WAY A LINKED SLIDER WOULD OFFER\n");
{
  console.log("     at a fixed number of measurements the estimate's variance is");
  console.log("     2(reps*s2B + s2W)/budget, which RISES with reps — so every repeat is a loss\n");
  for (const B of [10, 20, 30]) {
    console.log(`     budget ${B} per group | predicted SD | honest power at 0.5 | the rows claim`);
    for (const m of [1, 2, 5, 10]) {
      const n = B / m;
      if (!Number.isInteger(n) || n < 1) continue;
      const pred = Math.sqrt((2 * (m * NOISE_SD ** 2 + NOISE_SD ** 2)) / B);
      let honest = 0, rows = 0;
      for (let d = 0; d < DRAWS; d += 1) {
        const s = budgetStudy(rngAt(d), { people: n, reps: m, effect: 0.5 });
        if (s.meanTest && s.meanTest.p < 0.05) honest += 1;
        if (s.p < 0.05) rows += 1;
      }
      console.log(`       ${String(n).padStart(2)} people x ${String(m).padStart(2)}    |`
        + `${pred.toFixed(3).padStart(13)} |${pct(honest, DRAWS).padStart(20)} |${pct(rows, DRAWS).padStart(15)}`);
    }
    console.log("");
  }
  console.log("     -> read the last two columns of the budget-30 block against each other:");
  console.log("        the rows barely notice, and the honest power collapses. A repeat pays");
  console.log("        only when a SUBJECT costs more than a measurement, at the optimum");
  console.log("        reps* = sqrt(s2W/s2B * cSubject/cMeasurement).");
}
console.log("");

console.log("§12  THE COST OF PINNING THE REPLICATE PILE'S FRAME (main.js `pileWindow`)\n");
{
  const widest = Math.sqrt((2 * (NOISE_SD ** 2 + NOISE_SD ** 2)) / 2);   /* PEOPLE_MIN */
  const lo = Math.floor(-4 * widest * 10) / 10;
  const hi = Math.ceil(4 * widest * 10) / 10;
  console.log(`     pinned at people = 2, reps = 1: ${lo} to ${hi}, 57 bins of ${((hi - lo) / 57).toFixed(3)}\n`);
  console.log("     people | estimate SD | the bulk (+-2SD) covers");
  for (const p of [2, 3, 5, 10, 20, 30]) {
    const s = Math.sqrt((2 * (NOISE_SD ** 2 + NOISE_SD ** 2)) / p);
    console.log(`     ${String(p).padStart(6)} |${s.toFixed(3).padStart(12)} |`
      + `${String(Math.round(((4 * s) / (hi - lo)) * 57)).padStart(17)} bins of 57`);
  }
  console.log("\n     A 7-bin spike beside a 28-bin smear IS the comparison. On the frame this");
  console.log("     replaced — one computed at the current `people` — both read the same width.");
}
console.log("");
