/* Measurement for the tumor-heterogeneity restructure, 2026-09-26.

   Kenneth's ask: page 1 teaches the VAF readings (~1, ~0.5, < 0.5) and how
   copy number and purity move them, with no CCF; the CCF is taught as an
   inference (01-2 cells 24–25) before clonal architecture. This measures the
   inference the new CCF page would draw — cell 25 §3's binomial likelihood of
   the alt reads over c, for each multiplicity m — over every sample page 1 can
   build, before anything is mocked.

   Run: node widgets/_lab/ccf-measure.mjs */
import * as M from "../tumor-heterogeneity/model.js";
import { makeRng } from "../core/rng.js";

const PURITIES = [0.35, 0.5, 0.7, 1.0];
const CARRY = [0.25, 0.5, 0.75, 1.0];
const DEPTHS = [31, 88, 161, 500];
const GRID = Array.from({ length: 200 }, (_, i) => (i + 1) / 200); // c in (0, 1]
const CHI = 1.92; // half of chi-square(1) at 95%

const ll = (k, n, v) => {
  const e = Math.min(1 - 1e-9, Math.max(1e-9, v));
  return k * Math.log(e) + (n - k) * Math.log(1 - e);
};

/* What the analysis is told, cell 24's refinement:
   nothing — purity 1 and two copies assumed, m 1 or 2 over the total;
   purity — the sample's purity, two copies assumed;
   both   — purity and the allele-specific state, m up to major. */
function hypotheses(truth, level) {
  if (level === "nothing") return { p: 1, C: 2, ms: [1, 2] };
  if (level === "purity") return { p: truth.p, C: 2, ms: [1, 2] };
  return { p: truth.p, C: truth.state.total, ms: truth.state.copies };
}

function infer(k, n, h) {
  const curves = h.ms.map((m) => {
    const ys = GRID.map((c) => ll(k, n, M.vafExpected(h.p, c, m, h.C)));
    let best = 0;
    ys.forEach((y, i) => { if (y > ys[best]) best = i; });
    return { m, ys, cHat: GRID[best], max: ys[best] };
  });
  const top = Math.max(...curves.map((c) => c.max));
  const plausible = [];
  for (const cv of curves) cv.ys.forEach((y, i) => { if (y >= top - CHI) plausible.push({ m: cv.m, c: GRID[i] }); });
  const ms = [...new Set(plausible.map((q) => q.m))];
  const lo = Math.min(...plausible.map((q) => q.c));
  const hi = Math.max(...plausible.map((q) => q.c));
  const mle = curves.reduce((a, b) => (b.max > a.max ? b : a));
  return { curves, top, ms, lo, hi, mle };
}

const call = (r) => (r.lo >= 0.9 ? "clonal" : r.hi < 0.9 ? "subclonal" : "cannot tell");

/* 1 · exact ties: two (c, m) with one expected VAF have one likelihood. */
console.log("1 · ties in the expected VAF, given purity and copy number");
for (const st of M.COPY_STATES.filter((s) => s.major > 1)) {
  const p = 0.7;
  const rows = st.copies.map((m) => `m=${m}: c=${(1 / m).toFixed(2)} reads ${M.vafExpected(p, 1 / m, m, st.total).toFixed(3)}`);
  console.log(`  ${st.label} at p 0.70 — ${rows.join(" · ")}`);
}

/* 2 · over every sample page 1 can build, the call by level and depth. */
console.log("\n2 · the call over page 1's samples (truth clonal = every tumor cell carries it), 40 draws each");
for (const level of ["nothing", "purity", "both"]) {
  for (const depth of DEPTHS) {
    const t = { right: 0, wrong: 0, cannot: 0, n: 0, width: 0, cover: 0, mUnique: 0 };
    for (const p of PURITIES) for (const st of M.COPY_STATES) for (const m of st.copies) for (const c of CARRY) {
      const rng = makeRng(1000 + depth);
      const truth = { p, state: st, m, c };
      const v = M.vafExpected(p, c, m, st.total);
      const h = hypotheses(truth, level);
      for (let d = 0; d < 40; d += 1) {
        let k = 0;
        for (let i = 0; i < depth; i += 1) if (rng.next() < v) k += 1;
        const r = infer(k, depth, h);
        const said = call(r);
        const was = c >= 0.999 ? "clonal" : "subclonal";
        t.n += 1;
        if (said === "cannot tell") t.cannot += 1; else if (said === was) t.right += 1; else t.wrong += 1;
        t.width += r.hi - r.lo;
        if (c >= r.lo - 1e-9 && c <= r.hi + 1e-9) t.cover += 1;
        if (r.ms.length === 1) t.mUnique += 1;
      }
    }
    const pc = (x) => `${((100 * x) / t.n).toFixed(1)}%`;
    console.log(`  ${level.padEnd(7)} depth ${String(depth).padStart(3)}: right ${pc(t.right)}  wrong ${pc(t.wrong)}  cannot tell ${pc(t.cannot)}  · interval width ${(t.width / t.n).toFixed(2)}  · truth inside ${pc(t.cover)}  · one m ${pc(t.mUnique)}`);
  }
}

/* 3 · the widget's default for the new page, drawn: purity 0.70, 1 + 1, every cell. */
console.log("\n3 · one mutation, purity 0.70, 1 + 1, every tumor cell, told both — interval by depth (seed 1)");
for (const depth of DEPTHS) {
  const rng = makeRng(1);
  const v = M.vafExpected(0.7, 1, 1, 2);
  let k = 0;
  for (let i = 0; i < depth; i += 1) if (rng.next() < v) k += 1;
  const r = infer(k, depth, { p: 0.7, C: 2, ms: [1] });
  console.log(`  depth ${depth}: k ${k}, VAF ${(k / depth).toFixed(3)}, ĉ ${r.mle.cHat.toFixed(3)}, interval ${r.lo.toFixed(3)}–${r.hi.toFixed(3)}, call ${call(r)}`);
}

/* 4 · the MLE's own call (ĉ ≥ 0.9), which ignores the width. */
console.log("\n4 · calling on ĉ alone (≥ 0.9 clonal), told both, 40 draws each");
for (const depth of DEPTHS) {
  let right = 0, n = 0;
  for (const p of PURITIES) for (const st of M.COPY_STATES) for (const m of st.copies) for (const c of CARRY) {
    const rng = makeRng(2000 + depth);
    const v = M.vafExpected(p, c, m, st.total);
    for (let d = 0; d < 40; d += 1) {
      let k = 0;
      for (let i = 0; i < depth; i += 1) if (rng.next() < v) k += 1;
      const r = infer(k, depth, { p, C: st.total, ms: st.copies });
      const said = r.mle.cHat >= 0.9 ? "clonal" : "subclonal";
      if (said === (c >= 0.999 ? "clonal" : "subclonal")) right += 1;
      n += 1;
    }
  }
  console.log(`  depth ${depth}: right ${((100 * right) / n).toFixed(1)}%`);
}

/* 6 · three call rules on the same likelihood, by level and depth.
   interval ≥ 0.9  — clonal when the whole plausible set is at 0.9 or more;
   overlaps 1      — clonal when every plausible m's interval reaches 1, subclonal
                     when none does, cannot tell when the m's disagree (the
                     95%-interval-overlaps-1 rule; source to re-read before copy);
   ĉ alone         — the best-fitting (c, m), ≥ 0.9 clonal, never cannot tell. */
console.log("\n6 · three call rules — right / wrong / cannot tell");
const rules = {
  "interval ≥ 0.9": (r) => call(r),
  "overlaps 1": (r) => {
    const reach = r.curves.filter((cv) => cv.max >= r.top - CHI).map((cv) => cv.ys[cv.ys.length - 1] >= r.top - CHI);
    return reach.every(Boolean) ? "clonal" : reach.some(Boolean) ? "cannot tell" : "subclonal";
  },
  "ĉ alone": (r) => (r.mle.cHat >= 0.9 ? "clonal" : "subclonal"),
};
for (const level of ["nothing", "both"]) for (const depth of DEPTHS) {
  const line = [];
  for (const [name, rule] of Object.entries(rules)) {
    const t = { right: 0, wrong: 0, cannot: 0, n: 0 };
    for (const p of PURITIES) for (const st of M.COPY_STATES) for (const m of st.copies) for (const c of CARRY) {
      const rng = makeRng(3000 + depth);
      const v = M.vafExpected(p, c, m, st.total);
      const h = hypotheses({ p, state: st }, level);
      for (let d = 0; d < 40; d += 1) {
        let k = 0;
        for (let i = 0; i < depth; i += 1) if (rng.next() < v) k += 1;
        const said = rule(infer(k, depth, h));
        const was = c >= 0.999 ? "clonal" : "subclonal";
        t.n += 1;
        if (said === "cannot tell") t.cannot += 1; else if (said === was) t.right += 1; else t.wrong += 1;
      }
    }
    const pc = (x) => `${((100 * x) / t.n).toFixed(0)}`.padStart(3);
    line.push(`${name}: ${pc(t.right)} /${pc(t.wrong)} /${pc(t.cannot)}`);
  }
  console.log(`  ${level.padEnd(7)} ${String(depth).padStart(3)} · ${line.join("   ")}`);
}

/* 5 · page 1's readings, the table the new page 1 would make visible: a
   mutation in every tumor cell, by copy state and purity. */
console.log("\n5 · expected VAF, every tumor cell carrying it");
console.log("  state   m   " + PURITIES.map((p) => `p ${p.toFixed(2)}`).join("   "));
for (const st of M.COPY_STATES) for (const m of st.copies) {
  console.log(`  ${st.label.padEnd(6)} ${m}   ` + PURITIES.map((p) => M.vafExpected(p, 1, m, st.total).toFixed(3).padStart(6)).join("   "));
}
