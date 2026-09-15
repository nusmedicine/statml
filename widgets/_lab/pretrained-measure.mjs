/* Planning measurement for slot 63 `pretrained`, 2026-09-15, on the engine
 * widget 64 shipped (`widgets/grad-cam/engine.js`), which 63 imports.
 *
 * WHAT IT ASKS. The catalogue rescoped 63 to ONE trained stage: fine-tuning's
 * learning rate against forgetting, with the number of optimizer STEPS fixed
 * (dl-image-measure.mjs M2: 30 epochs on 16 images is 30 steps, so an epoch
 * budget makes `lr` partly a "how much training" dial). M2 measured that on
 * DISC/RING/BAR/CROSS → TRIANGLE/SQUARE with a two-block net. The image arc
 * now speaks in widget 61's cell, and 64's engine is three blocks, so:
 *   1. SOURCE. Four classes of the cell — nucleus · granules · plain · ghost
 *      — as the pretraining task. Does the engine learn it in budget, and how
 *      well (the retention baseline the stage starts from)?
 *   2. TARGET. A two-class cell distinction the source never labelled —
 *      small against large nucleus (`size`), one against two (`count`), round
 *      against elongated (`elong`) — fine-tuned from the source backbone with
 *      a fresh head. Which is learned in a fixed step budget, and does 1e-3
 *      beat 1e-4 on the target while losing more of the source?
 *   3. DOMAIN. Near = the source's rendering; far = inverted contrast (a
 *      dark-field rendering of the same cell). Does far forget more?
 *   4. STEPS and n. Steps fixed at 32 / 64 / 128 and n at 16 / 32 / 64 / 128:
 *      is forgetting monotone in steps at every n, and is n's effect only
 *      through diversity?
 *   5. BUDGET. What does pretraining cost, and one fine-tuning run with its
 *      two curves read every 8 steps — the widget's compute().
 *   6. FOR THE RECORD, not the stage: from scratch and a frozen backbone on
 *      the same target at the same steps, so the three columns of Kenneth's
 *      figure have a measured number each, even though the widget claims
 *      nothing about which scores higher.
 *
 * Run: node widgets/_lab/pretrained-measure.mjs [size|count|elong ...] [--quick|--sweep|--seeds]
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-15 (node v24, single thread; the full run of three
 * targets is 360 fine-tuning runs and about four minutes).
 *
 *   1. THE SOURCE. The first draft — nucleus · granules · plain · ghost —
 *      reaches 59.0% at 200 images and 20 epochs (train 69.5%) and 84% only
 *      at 800 images and 4.7 s (`--sweep`). Four classes with a feature each
 *      — a LARGE nucleus · granules · a ghost · a thick-membraned ghost —
 *      reach 92–95% in 0.8 s on the same 8/12/16 net, and that is the source.
 *      The first draft's confusable pair was the plain cell against the
 *      nucleus at 16 × 16.
 *   2. THE TARGET. Round against elongated (`elong`) is learned: fine-tuning
 *      at 1e-3 reaches 75–86% at 64 steps, every n, near and far. Small
 *      against large nucleus reaches 73–78%; one against two nuclei is not
 *      learned (49–61%). At 64 steps 1e-4 has NOT learned the target at
 *      n ≤ 32 (50%) and reaches 61–62% at n ≥ 64.
 *   3. THE TRADE-OFF, at 64 steps, three-seed means, elong: 1e-3 is higher on
 *      the target AND lower on the source than 1e-4 in every cell — near
 *      86/49 · 80/52 · 75/41 · 86/50 against 51/72 · 50/67 · 62/52 · 61/63
 *      (target/source, n = 16 · 32 · 64 · 128); far 56/54 · 76/42 · 78/25 ·
 *      70/44 against 49/53 · 50/78 · 50/66 · 50/67. The far domain forgets
 *      more at 1e-3 (25% at n = 64 is chance for four classes).
 *   4. THE BUDGET MATTERS. At 128 steps 1e-4's retention has fallen to where
 *      1e-3's has been since step 16 (near n = 32: 67/48 against 86/56), so
 *      the ordering on the source is a matter of when it is read; 96 steps
 *      is in between. 64 is the budget. The curves say why: 1e-3 loses the
 *      source in the first sixteen steps and then holds; 1e-4 loses a little
 *      every step.
 *   5. PER SEED (`--seeds`), at 64 steps: 1e-3 retains LESS in 22 of 24
 *      seed-cells and scores higher on the target in 20 of 24; the target
 *      failures are ties where 1e-4 also learned (88 against 87), not
 *      reversals. The widget shows one seed and carries a Seed control.
 *   6. COST. Pretraining 0.8 s; one fine-tuning run of 128 steps with 17
 *      readings of 200 images 0.63 s in node, about half of it the readings.
 *      In the browser (`_lab/pretrained-mock.html`, 64 steps, 60 validation
 *      images): 0.87 s pretraining and 0.30 s a fine-tuning run, so a Domain
 *      or n change costs two runs, 0.6 s, and a Seed change 1.5 s.
 *   7. FOR THE RECORD: from scratch at 1e-3 matches fine-tuning at 1e-3 on
 *      elong (85 / 81 / 84 / 82 against 86 / 80 / 75 / 86) and the frozen
 *      backbone reaches 51–70%. Pretraining on four synthetic cell classes
 *      is worth nothing against scratch here, the planning script's finding
 *      again; the figure claims nothing about which strategy scores higher.
 */
import { makeRng } from "../core/rng.js";
import * as E from "../grad-cam/engine.js";

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");
const TARGET_KEYS = args.filter((a) => !a.startsWith("--"));

const S = 16;
const CHANS = [8, 12, 16];
const SEEDS = QUICK ? 1 : 3;
const N_SRC = 200;
const SRC_EPOCHS = 20;
const N_VAL = 100;
const STEPS = 128;
const MARK = 8;
const NS = QUICK ? [16, 128] : [16, 32, 64, 128];
const LRS = QUICK ? [1e-4, 1e-3] : [1e-4, 3e-4, 1e-3];
const REPORT_STEPS = [32, 64, 128];

/* the source: four kinds of cell, widget 61's vocabulary */
const SOURCE = {
  /* THE SWEEP'S PICK (below): each class a feature of its own; the plain
     cell and the small nucleus were the confusable pair of the first draft */
  names: ["Nucleus", "Granules", "Ghost", "Thick membrane"],
  specs: [
    { nuclei: 1, nR: [4.2, 5.4] },
    { nuclei: 0, granules: true },
    { nuclei: 0, ghost: true, inside: 0.08 },
    { nuclei: 0, ghost: true, inside: 0.08, ringScale: 1.8 },
  ],
};
/* the first draft's source, kept for the sweep: 59% at 200 × 20 */
const CELLS4 = [
  { nuclei: 1 },
  { nuclei: 0, granules: true },
  { nuclei: 0 },
  { nuclei: 0, ghost: true, inside: 0.08 },
];
/* the targets: a distinction the source never labelled */
const TARGETS = {
  size: { names: ["Small nucleus", "Large nucleus"], specs: E.CELL_TASKS.size },
  count: { names: ["One nucleus", "Two nuclei"], specs: E.CELL_TASKS.count },
  elong: { names: ["Round", "Elongated"], specs: E.CELL_TASKS.elong },
  position: { names: ["Central", "Eccentric"], specs: E.CELL_TASKS.position },
};
const targets = TARGET_KEYS.length ? TARGET_KEYS : ["size", "count", "elong"];

const pad = (v, n) => String(v).padStart(n);
const lpad = (v, n) => String(v).padEnd(n);
const pc = (v) => (100 * v).toFixed(1);

/* --- sets ------------------------------------------------------------------ */

/** n images over K specs, classes cycling, the marker on every image. The
    engine's makeSet is two-class; one image a call keeps its rendering. */
function makeMulti(specs, n, rng, { invert = false } = {}) {
  const K = specs.length;
  const area = S * S;
  const x = new Float64Array(n * area);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i += 1) {
    const k = i % K;
    const one = E.makeSet([specs[k], specs[k]], 1, S, rng, { marker: true });
    for (let j = 0; j < area; j += 1) x[i * area + j] = invert ? 1 - one.x[j] : one.x[j];
    y[i] = k;
  }
  return { x, y, n, S };
}

/* --- nets ------------------------------------------------------------------ */

const copyBlocks = (net) => ({
  ...net,
  blocks: net.blocks.map((b) => ({ ...b, W: b.W.slice(), b: b.b.slice() })),
});
/** a fresh head of K classes on this backbone: torch's Linear default */
function withHead(net, K, rng) {
  const k = 1 / Math.sqrt(net.Cl);
  const Wh = new Float64Array(K * net.Cl);
  const bh = new Float64Array(K);
  for (let i = 0; i < Wh.length; i += 1) Wh[i] = rng.uniform(-k, k);
  for (let i = 0; i < K; i += 1) bh[i] = rng.uniform(-k, k);
  return { ...net, K, Wh, bh };
}
const paramCount = (net) => net.blocks.reduce((s, b) => s + b.W.length + b.b.length, 0) + net.Wh.length + net.bh.length;
const headCount = (net) => net.Wh.length + net.bh.length;

/**
 * Train for a fixed number of optimizer STEPS at batch 16, the epoch order
 * reshuffled when the set is exhausted; every `MARK` steps read the target
 * validation accuracy and, through the ORIGINAL source head, the source's.
 */
function trainSteps(net, set, { steps, lr, headOnly, rng, valSet, srcHead, srcVal }) {
  const w = E.makeWork(net);
  const opt = E.makeOpt(net);
  if (headOnly) opt.slots = opt.slots.slice(-2);
  const area = S * S;
  const order = Array.from({ length: set.n }, (_, i) => i);
  const batch = 16;
  let pos = set.n;
  const marks = [];
  const read = (step) => {
    const target = E.evaluate(net, w, valSet);
    let source = null;
    if (srcHead) {
      const back = { ...net, K: srcHead.K, Wh: srcHead.Wh, bh: srcHead.bh };
      source = E.evaluate(back, E.makeWork(back), srcVal);
    }
    marks.push({ step, target, source });
  };
  read(0);
  for (let step = 1; step <= steps; step += 1) {
    const idx = [];
    for (let j = 0; j < batch; j += 1) {
      if (pos >= set.n) { rng.shuffle(order); pos = 0; }
      idx.push(order[pos]);
      pos += 1;
    }
    const scale = 1 / idx.length;
    for (const i of idx) {
      E.forward(net, w, set.x, i * area);
      E.backwardCE(net, w, set.x, i * area, set.y[i], opt.grads, scale);
    }
    E.adamStep(opt, lr);
    if (step % MARK === 0) read(step);
  }
  return marks;
}

/* --- pretraining -------------------------------------------------------------- */

function pretrain(seed) {
  const rng = makeRng(1000 + seed);
  const tr = makeMulti(SOURCE.specs, N_SRC, rng);
  const va = makeMulti(SOURCE.specs, N_VAL, makeRng(999));
  const net = E.makeNet(S, CHANS, SOURCE.specs.length, rng);
  const t0 = performance.now();
  const { w } = E.train(net, tr, { epochs: SRC_EPOCHS, rng });
  const ms = performance.now() - t0;
  return {
    net, srcVal: va, ms,
    trainAcc: E.evaluate(net, w, tr),
    srcAcc: E.evaluate(net, w, va),
    srcHead: { K: net.K, Wh: net.Wh.slice(), bh: net.bh.slice() },
  };
}

/* --- the pretraining sweep (`--sweep`) ------------------------------------------ *
 * FIRST QUICK RUN, 2026-09-15: the four cell classes above at 200 images and
 * 20 epochs reach 59.0% source validation (train 69.5%), and fine-tuning at
 * 1e-3 drops retention to chance (25%) inside 32 steps. A stage whose source
 * is barely learned has no retention to lose gradually, so before the target
 * is measured the source has to be: which classes, how many images, how
 * many epochs, how wide a net. */
const SOURCE_VARIANTS = {
  cells4: CELLS4,
  /* the two classes the arc has already shown learned at 16 × 16 (94–100%),
     plus granules and a hole: each class a feature of its own */
  distinct4: SOURCE.specs,
  /* three classes: nucleus · granules · ghost */
  cells3: [CELLS4[0], CELLS4[1], CELLS4[3]],
  /* the cell against the ghost against the plain cell, no granules */
  cells3b: [CELLS4[0], CELLS4[2], CELLS4[3]],
};
if (args.includes("--sweep")) {
  const budgets = [[200, 20], [400, 20], [400, 30], [800, 30]];
  const widths = [[8, 12, 16], [8, 16, 32]];
  console.log("pretraining sweep: source variant × images/epochs × width; one seed; validation 100 images");
  for (const [vkey, specs] of Object.entries(SOURCE_VARIANTS)) {
    for (const chans of widths) {
      for (const [n, epochs] of budgets) {
        const rng = makeRng(1000);
        const tr = makeMulti(specs, n, rng);
        const va = makeMulti(specs, N_VAL, makeRng(999));
        const net = E.makeNet(S, chans, specs.length, rng);
        const t0 = performance.now();
        const { w } = E.train(net, tr, { epochs, rng });
        const ms = performance.now() - t0;
        console.log(`  ${lpad(vkey, 10)} ${chans.join("/")}  ${pad(n, 4)} × ${pad(epochs, 2)}  ${pad(ms.toFixed(0), 5)} ms  train ${pc(E.evaluate(net, w, tr))}  val ${pc(E.evaluate(net, w, va))}  (chance ${pc(1 / specs.length)})`);
      }
    }
  }
  process.exit(0);
}

/* --- the runs ------------------------------------------------------------------ */

console.log(`slot 63 measurement: S=${S}, conv ${CHANS.join("/")}, source ${SOURCE.names.join(" · ")} (${N_SRC} images, ${SRC_EPOCHS} epochs), ${SEEDS} seed(s)`);
console.log(`fine-tuning: ${STEPS} steps of batch 16, read every ${MARK}; n ∈ {${NS.join(", ")}}; lr ∈ {${LRS.join(", ")}}; validation ${N_VAL} images fixed`);

const pres = [];
for (let s = 0; s < SEEDS; s += 1) {
  const pre = pretrain(s);
  pres.push(pre);
  console.log(`  pretrain seed ${s}: ${pre.ms.toFixed(0)} ms, train ${pc(pre.trainAcc)}%, source validation ${pc(pre.srcAcc)}% (chance 25%); ${paramCount(pre.net)} parameters, head ${headCount(pre.net)}`);
}
const srcMean = pres.reduce((a, p) => a + p.srcAcc, 0) / SEEDS;

const ARMS = [
  ...LRS.map((lr) => ({ key: `fine ${lr}`, pre: true, lr, headOnly: false })),
  { key: "scratch 1e-3", pre: false, lr: 1e-3, headOnly: false },
  { key: "frozen 1e-3", pre: true, lr: 1e-3, headOnly: true },
];

for (const tkey of targets) {
  const T = TARGETS[tkey];
  console.log(`\n== TARGET ${tkey}: ${T.names.join(" against ")} ==`);
  let runMs = 0;
  let runs = 0;
  /* acc[domain|arm|n][markIndex] summed over seeds */
  const acc = {};
  const ret = {};
  /* per seed, at the widget's candidate budget: is the trade-off true of ONE seed? */
  const per = {};
  for (let s = 0; s < SEEDS; s += 1) {
    const pre = pres[s];
    for (const [dname, invert] of [["near", false], ["far", true]]) {
      const full = makeMulti(T.specs, 128, makeRng(2000 + s), { invert });
      const va = makeMulti(T.specs, N_VAL, makeRng(3000), { invert });
      for (const n of NS) {
        const tr = { x: full.x.subarray(0, n * S * S), y: full.y.subarray(0, n), n, S };
        for (const arm of ARMS) {
          const rng = makeRng(4000 + s * 131 + n);
          const base = arm.pre ? copyBlocks(pre.net) : E.makeNet(S, CHANS, 2, rng);
          const net = withHead(base, 2, rng);
          const t0 = performance.now();
          const marks = trainSteps(net, tr, {
            steps: STEPS, lr: arm.lr, headOnly: arm.headOnly, rng, valSet: va,
            srcHead: arm.pre ? pre.srcHead : null, srcVal: pre.srcVal,
          });
          runMs += performance.now() - t0;
          runs += 1;
          const k = `${dname}|${arm.key}|${n}`;
          acc[k] = acc[k] || marks.map(() => 0);
          ret[k] = ret[k] || marks.map(() => 0);
          marks.forEach((m, i) => { acc[k][i] += m.target; if (m.source != null) ret[k][i] += m.source; });
          per[k] = per[k] || [];
          per[k].push(marks);
        }
      }
    }
  }
  const at = (tbl, k, step) => tbl[k] ? pc(tbl[k][step / MARK] / SEEDS) : "-";
  console.log(`  ${runs} runs, ${(runMs / runs).toFixed(0)} ms each (${STEPS} steps + ${STEPS / MARK + 1} readings of ${2 * N_VAL} images)`);
  for (const step of REPORT_STEPS) {
    console.log(`\n  target validation accuracy % at ${step} steps (chance 50)`);
    for (const dname of ["near", "far"]) {
      console.log(`    ${dname}            ${NS.map((n) => pad(`n=${n}`, 7)).join("")}`);
      for (const arm of ARMS) console.log(`      ${lpad(arm.key, 14)}${NS.map((n) => pad(at(acc, `${dname}|${arm.key}|${n}`, step), 7)).join("")}`);
    }
    console.log(`  source retention % at ${step} steps, through the original head (pretrained ${pc(srcMean)})`);
    for (const dname of ["near", "far"]) {
      console.log(`    ${dname}            ${NS.map((n) => pad(`n=${n}`, 7)).join("")}`);
      for (const arm of ARMS.filter((a) => a.pre)) console.log(`      ${lpad(arm.key, 14)}${NS.map((n) => pad(at(ret, `${dname}|${arm.key}|${n}`, step), 7)).join("")}`);
    }
  }
  if (args.includes("--seeds")) {
    for (const budget of [64, 96]) {
      console.log(`\n  PER SEED at ${budget} steps: target / source, lr 1e-4 against 1e-3 (a seed PASSES if 1e-3 is higher on the target AND lower on the source)`);
      const mi = budget / MARK;
      let pass = 0;
      let total = 0;
      for (const dname of ["near", "far"]) {
        for (const n of NS) {
          const a = per[`${dname}|fine 0.0001|${n}`];
          const b = per[`${dname}|fine 0.001|${n}`];
          const cells = a.map((ma, si) => {
            const mb = b[si];
            const ok = mb[mi].target > ma[mi].target && mb[mi].source < ma[mi].source;
            total += 1;
            if (ok) pass += 1;
            return `${pc(ma[mi].target)}/${pc(ma[mi].source)} vs ${pc(mb[mi].target)}/${pc(mb[mi].source)} ${ok ? "PASS" : "fail"}`;
          });
          console.log(`    ${lpad(dname, 5)} n=${pad(n, 3)}  ${cells.join("   ")}`);
        }
      }
      console.log(`    ${pass} of ${total} seed-cells pass at ${budget} steps`);
    }
  }
  /* the curves the stage would draw: near, n = 32, both learning rates */
  const n0 = NS.includes(32) ? 32 : NS[0];
  console.log(`\n  the two curves, near domain, n = ${n0}, read every ${MARK} steps (target / source)`);
  for (const lr of LRS) {
    const k = `near|fine ${lr}|${n0}`;
    const line = acc[k].map((_, i) => `${pc(acc[k][i] / SEEDS)}/${pc(ret[k][i] / SEEDS)}`).join(" ");
    console.log(`    lr ${lr}: ${line}`);
  }
}
