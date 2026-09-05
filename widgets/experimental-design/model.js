/* ============================================================================
   Widget 44 · Experimental Design — the simulation, kept out of main.js so
   `_lab/design-measure.mjs` can measure the same engine the figure draws.

   PHM5003 HTD `05 / 01`. The population is the notebook's own, cells 8 and 29:

       gene_expression ~ N(1, 0.5), plus 1.0 if the subject carries the
       confounder, and NO true difference between the arms unless asked for.

   So every p under 0.05 at `effect: 0` is a FALSE POSITIVE, and the widget's
   whole argument is which allocations produce them.

   ---------------------------------------------------------------------------
   THERE IS AN EXPLICIT POPULATION, and it is drawn. The first build sampled
   subjects straight into arms, and Kenneth's review said exactly what that
   costs: "I don't know where the confounders are, what are the samples?" The
   notebook does not do that either — its cells 32 and 39 filter a population of
   1000 by gender and group and then `sample_n` from each cell. So the model
   now builds a population per arm, and the study is a SELECTION out of it.

   POP_PER_ARM = 96, AND THAT NUMBER IS MEASURED FROM BOTH SIDES.

   Too small and the statistics break: sampling without replacement from a
   finite population shrinks the estimate's spread, and at 48 per arm that
   alone took randomization's false-positive rate from 5.0% to 2.9% — it would
   have made the widget's central claim false. At 72 the rates hold but 473 of
   12,000 draws run short of subjects at n = 30.

   Too large and the PICTURE breaks: 120 per arm was built first and drawn at a
   9px pitch, where a triangle and a circle are the same blob and the dashed
   selection ring is mush. That is the thing the reader is supposed to read.

   At 96 the spread matches the infinite-population closed form to the third
   decimal at every n the widget offers (0.158 against 0.158 at n = 20, 0.227
   against 0.224 for the randomized arm), the rates read 100% / 5.0-5.2% /
   0.4-0.8%, one draw of 12,000 runs short at n = 30 and none at or below 24 —
   which is where `n` is capped — and the grid draws at a 13px pitch.

   IT IS 8 ROWS OF 12, NOT 6 OF 16, and the reason is the 550px canvas. Every
   fingerprint state is hashed at the narrowest width the side layout allows
   (HANDOVER, `FRAME_W = 900`), and a 16-wide grid left the value axis beside it
   139px across — a strip plot with no strip. Taller and narrower costs 50px of
   height and buys back 100px of axis at the width that actually matters.

   THE CARRIER STATUS IS A COIN FLIP PER SUBJECT, not a fixed half. The
   notebook's `sample(c("Female","Male"), 1000, replace = TRUE)` is a coin flip,
   and the difference matters: pinning the population at exactly half carriers
   makes the draw hypergeometric rather than binomial, which is partially
   balanced by construction, and that was the whole of the 2.9% above.

   ---------------------------------------------------------------------------
   TWO STAGES, because the notebook has two questions and they take different
   pictures. `allocateStudy` answers "who goes in which arm" (its §1 and §2);
   `budgetStudy` answers "what do I spend my measurements on" (its §3 and §4).
   ========================================================================= */

import { mean, tTailP } from "../core/stats.js";

/** The notebook's population. */
export const NOISE_SD = 0.5;      // rnorm(1000, mean = 1, sd = 0.5)
export const CONF_SHIFT = 1.0;    // if_else(gender == "Female", 1, 0)
export const BASE = 1.0;

/** Drawn as 8 rows of 12. See the header for why it is not smaller — or larger. */
export const POP_PER_ARM = 96;
export const POP_ROWS = 8;
export const POP_COLS = POP_PER_ARM / POP_ROWS;

/**
 * Welch's t-test — what `rstatix::t_test` runs by default, and therefore what
 * every printed p in the lesson is. Student's pooled test would report slightly
 * different numbers for the unequal-variance arms Convenience produces, which
 * is exactly where the reader would compare against the notebook.
 */
export function welch(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1);
  const se2 = va / a.length + vb / b.length;
  const t = (mb - ma) / Math.sqrt(se2);
  const df = se2 ** 2
    / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: mb - ma, se: Math.sqrt(se2), t, df, p: tTailP(Math.abs(t), df) };
}

/* --- stage 1: who goes in which arm ----------------------------------------- */

/** One arm's population: POP_PER_ARM subjects, each carrying the confounder or not. */
function makeArm(rng, arm, effect, shift) {
  const out = [];
  for (let i = 0; i < POP_PER_ARM; i += 1) {
    const carrier = rng.next() < 0.5;
    out.push({
      carrier,
      y: rng.normal(BASE, NOISE_SD) + (carrier ? shift : 0) + (arm ? effect : 0),
      row: Math.floor(i / POP_COLS),
      col: i % POP_COLS,
    });
  }
  return out;
}

/**
 * Which members of one arm's population the scheme selects.
 *
 *   convenience  the diseased arm gives up its carriers and the control arm its
 *                non-carriers — the notebook's cell 14, and complete confounding
 *   random       the first n of a shuffled population, whatever they are — cell 22
 *   blocked      n/2 carriers and n/2 non-carriers — cell 39
 *
 * Cell 32's deliberate 60/40 is not a fourth scheme: it is one draw from
 * `random`, which is why the reader finds it by repeating rather than by
 * setting it. `order` is a shuffle of the whole population, so every scheme
 * picks from the same random order and the three differ only in their rule.
 */
function selectFrom(pop, order, n, scheme, arm) {
  if (scheme === "convenience") {
    const want = arm === 1;
    return order.filter((i) => pop[i].carrier === want).slice(0, n);
  }
  if (scheme === "random") return order.slice(0, n);
  const half = Math.round(n / 2);
  return [
    ...order.filter((i) => pop[i].carrier).slice(0, half),
    ...order.filter((i) => !pop[i].carrier).slice(0, n - half),
  ];
}

/**
 * THE POPULATION IS BUILT ONCE, FROM THE SEED. Running a study picks a
 * different sample out of it and changes nothing else.
 *
 * The first build drew a fresh population for every study, so pressing Run
 * moved all 192 marks — Kenneth's review: "when we run a study, the population
 * changes again? my understanding was the seed set the population once".
 * He is right, and it is also the notebook's model: one population of 1000,
 * `sample_n` from it repeatedly.
 *
 * IT COSTS SOMETHING AND THE COST IS NAMED. Repeated samples from ONE
 * population of 96 per group estimate that population's own group difference,
 * not zero — its SD is about 0.10 against a study's SE of 0.23. So the
 * false-positive rate rides on the seed: measured over twelve seeds it runs
 * 2% to 12% for random sampling, averaging 5.0%. Non-random stays at 100% and
 * blocked at 0-2% on every seed, so the comparison the widget makes is safe;
 * only the exact "5%" moves. Pinning the group means removes the wobble and
 * breaks the number instead (2.5%), and sampling with replacement to dodge the
 * finite-population correction would draw the same subject twice.
 */
export function makePopulation(rng, { effect = 0, shift = CONF_SHIFT } = {}) {
  const arms = [makeArm(rng, 0, effect, shift), makeArm(rng, 1, effect, shift)];
  /* THE POPULATION'S OWN GROUP DIFFERENCE IS PINNED TO THE DIAL, by shifting
     each group to the mean it was asked for. Without this the 96 people drawn
     for each group differ by a coin flip's worth — measured across twelve
     seeds, anywhere from -0.14 to 0.23 when the dial says 0 — and a study that
     detects that is not making an error, so there is no unambiguous truth to
     compare against. Kenneth asked for a ground truth; this is what makes one.

     It costs the nominal rate: random sampling reads 2.8% rather than 4.8%,
     because sampling 20 of 96 without replacement is more precise than the
     t-test assumes and pinning removes the one variance component that was
     making up the difference. The distance-from-truth comparison, which is
     what the ground truth is for, is unmoved: 0.96 / 0.16 / 0.12 against
     1.00 / 0.19 / 0.13. */
  for (const g of [0, 1]) {
    const want = BASE + shift / 2 + (g ? effect : 0);
    const have = mean(arms[g].map((s) => s.y));
    for (const s of arms[g]) s.y += want - have;
  }
  return arms;
}

/** One study: which members of the standing population it samples. */
export function selectStudy(rng, population, { n, scheme }) {
  const picked = [];
  for (const g of [0, 1]) {
    const order = population[g].map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    /* picked in GRID order, so the dashed boxes read left to right as the grid
       does rather than in the order the shuffle happened to produce */
    picked.push(selectFrom(population[g], order, n, scheme, g).sort((a, b) => a - b));
  }
  const arms = picked.map((ix, g) => ix.map((i) => population[g][i]));
  const carried = arms.map((a) => a.filter((s) => s.carrier).length);
  return {
    population,
    picked,
    arms,
    carried,
    imbalance: Math.abs(carried[1] - carried[0]),
    popCarried: population.map((pop) => pop.filter((s) => s.carrier).length),
    ...welch(arms[0].map((s) => s.y), arms[1].map((s) => s.y)),
  };
}

/**
 * A fresh population AND one sample from it, in one call.
 *
 * The widget does not use this — it holds one population per seed. It is here
 * for `_lab/design-measure.mjs`, which asks a different and equally real
 * question: what does a SAMPLING METHOD do on average over populations, rather
 * than what does it do on the one population a reader is looking at. The two
 * answers differ, and §1 and §10 of that script print both.
 */
export function allocateStudy(rng, params) {
  return selectStudy(rng, makePopulation(rng, params), params);
}

/* --- stage 2: what the measurements are spent on ---------------------------- */

/**
 * `people` subjects per arm, each measured `reps` times.
 *
 * A subject is drawn once from the population; each measurement adds machine
 * noise on top. That is the whole structure of the problem — the subject is
 * the unit that varies biologically, and repeating the measurement does not
 * draw a new one. The notebook's cell 79 does exactly this, adding
 * `rnorm(sd = 0.5)` to a value already drawn.
 */
export function budgetStudy(rng, { people, reps, effect }) {
  const arms = [[], []];
  const subjects = [[], []];
  for (const g of [0, 1]) {
    for (let s = 0; s < people; s += 1) {
      const truth = rng.normal(BASE, NOISE_SD) + (g ? effect : 0);
      const rows = [];
      for (let r = 0; r < reps; r += 1) rows.push(truth + rng.normal(0, NOISE_SD));
      subjects[g].push({ truth, rows });
      for (const y of rows) arms[g].push({ carrier: false, y, subject: s });
    }
  }
  const rowTest = welch(arms[0].map((s) => s.y), arms[1].map((s) => s.y));
  /* The same data analysed at the unit that actually varies. It is not drawn,
     but the widget reports it, because the row test's power is otherwise
     indistinguishable from real power: at 3 people x 10 reps the rows claim
     69% and the subjects have 11%. */
  const meanTest = people > 1
    ? welch(subjects[0].map((s) => mean(s.rows)), subjects[1].map((s) => mean(s.rows)))
    : null;
  return { arms, subjects, meanTest, ...rowTest };
}

/* --- the sequence of studies the animation reveals -------------------------- */

/**
 * `compute()` builds every study up front and the animation reveals them, so
 * the picture a seed promises is the picture that arrives — invariant 2. The
 * studies now SHARE one population, so all 200 cost 200 shuffles rather than
 * 200 populations.
 */
export const MAX_STUDIES = 200;

export function runStudies(makeRng, seed, params, count = MAX_STUDIES) {
  if (params.concept !== "allocate") {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(budgetStudy(makeRng(seed * 7919 + 1 + i * 31), params));
    }
    return out;
  }
  /* one population, then `count` different samples out of it */
  const population = makePopulation(makeRng(seed * 7919 + 1), params);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(selectStudy(makeRng(seed * 104729 + 1 + i * 31), population, params));
  }
  return out;
}
