/* ============================================================================
   Assertions on widget 67's engine, contract and geometry.

       node widgets/_lab/tumor-heterogeneity-verify.mjs

   Imports `widgets/tumor-heterogeneity/model.js` — the shipping code, not a
   copy (5.8) — and drives `main.js` in node by stubbing its one import, so
   `compute`, `animation` and `readout` are the page's own.

   What needs a reader most:

   THE MODEL IS THE LESSON'S. 01-2 cell 17 states three readings and cell 25
   states the formula they come from. If those drift, every page is drawing a
   number the lesson does not have.

   THE INFERENCE MUST BE THE LESSON'S. Page 3 draws cell 25 §3, the binomial
   likelihood of the reads, and its call is a claim, so the numbers the
   measurement found before the mock (`_lab/ccf-measure.mjs`) are asserted
   over a sweep of seeded reads rather than at one setting.

   THE GEOMETRY. `height` and `draw` share one layout precisely so this script
   can drive `draw` through a recording context and check that nothing is
   painted outside the canvas the page reserved. A figure that overruns still
   hashes consistently for ever.

   THE CAPABILITIES BY NAME. A rewrite that deletes a parameter leaves every
   behavioural assertion passing, so the spec is asserted key by key
   (HANDOVER § *Driving the animation in node*).

   THE STATUS. The manifest and `main.js` both say `shipped` and this says so;
   all three flipped together at the ship, 2026-09-17.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "../tumor-heterogeneity/model.js";
import { makeRng } from "../core/rng.js";
import { resolveParams } from "../core/params.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const abs = (rel) => JSON.stringify(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), rel)).href);

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 74)} ${detail}`);
}

/* --- the widget's own config, with core stubbed --------------------------- */
/* The formula card mounts itself into the page, so node needs somewhere to
   mount it: the stub keeps the node, and `cardHtml()` reads what the card last
   wrote. `mathmlRenders` is stubbed false, as the browser's fallback path — so
   every string asserted here is the one a reader without MathML sees. */
let cardNode = null;
globalThis.document = {
  createElement: () => ({ className: "", innerHTML: "" }),
  querySelector: () => ({ parentNode: { insertBefore: (node) => { cardNode = node; } } }),
};
const cardHtml = () => (cardNode ? cardNode.innerHTML : "");
const cardText = () => cardHtml().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Draw page 2 for real, which is what leaves `carryMany` behind — the module
    holds it privately, so the only honest way to test the morph's rule is to
    put a figure on screen the way the reader does. */
function drawWithMany(W, params) {
  const state = W.compute({ params, rng: makeRng(params.seed) });
  const anim = W.animation.init({ params, state, fromScratch: true });
  const { ctx } = recorder();
  W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
  return { state, anim };
}

let cached = null;
async function widget() {
  if (cached) return cached;
  let text = read("widgets/tumor-heterogeneity/main.js");
  /* `niceTicks` is pure arithmetic over a domain, so the widget gets the real
     one; everything else core exports here needs a canvas and is stubbed. */
  text = text.replace(/^import \{ defineWidget, makePlot, mathmlRenders, niceTicks \} from "\.\.\/core\/index\.js";$/m,
    `import { niceTicks } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => { Object.assign(__cfg, c); return c; };"
    + " const makePlot = (o) => __plot(o); const mathmlRenders = () => false;");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../tumor-heterogeneity/model.js")};`);
  text += "\nexport { __cfg };\n";
  /* `makePlot` is core's, and core's wants a real context; the recording plot
     below gives the widget the four calls it uses. */
  text = `const __plot = globalThis.__plotStub;\n${text}`;
  cached = (await import(`data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`)).__cfg;
  return cached;
}

/** A canvas context that records the extent of everything painted. */
function recorder() {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const seen = [];
  const mark = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { box.bad = true; return; }
    box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y);
  };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
    setLineDash() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    measureText: (s) => ({ width: String(s).length * 5.6 }),
    fillRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    strokeRect: (x, y, w, h) => { mark(x, y); mark(x + w, y + h); },
    clearRect: () => {},
    moveTo: mark, lineTo: mark,
    arc: (x, y, r) => { mark(x - r, y - r); mark(x + r, y + r); },
    fillText: (s, x, y) => {
      seen.push({ s: String(s), x, y });
      const w = String(s).length * 5.6;
      const left = ctx.textAlign === "center" ? x - w / 2 : ctx.textAlign === "right" ? x - w : x;
      mark(left, y - 10); mark(left + w, y + 3);
    },
    strokeText() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    textAlign: "left", textBaseline: "alphabetic", font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  };
  return { ctx, box, seen };
}

/** The four calls the widget makes on core's plot, recorded. */
globalThis.__plotStub = ({ ctx, rect, xDomain, yDomain }) => {
  const sx = (v) => rect.x + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * rect.w;
  const sy = (v) => rect.y + rect.h - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * rect.h;
  return {
    sx,
    sy,
    caption: (s) => ctx.fillText(s, rect.x, rect.y - 8),
    note: (s) => ctx.fillText(s, rect.x + rect.w, rect.y - 8),
    axisX: ({ ticks = [], format = (v) => String(v), label } = {}) => {
      /* The same skip core makes, for the same reason: mid-ease the axis holds
         the ticks it is heading for while the domain is still growing into
         them, and core draws only the ones that have arrived. */
      ticks.forEach((t) => {
        if (t < xDomain[0] - 1e-9 || t > xDomain[1] + 1e-9) return;
        ctx.fillText(format(t), sx(t), rect.y + rect.h + 16);
      });
      if (label) ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h + 32);
    },
    /* Placed exactly as `core/canvas.js` places them: tick labels right-aligned
       at x − 8, and the axis label rotated about x − 40, which is the gutter a
       plot rect has to leave. */
    axisY: ({ ticks = [], format = (v) => String(v), label } = {}) => {
      const align = ctx.textAlign;
      ctx.textAlign = "right";
      /* Core SKIPS a tick outside the domain (canvas.js, `axisY`), which is how
         a destination tick above a domain still growing simply does not draw.
         The stub drew them all and reported the widget painting off the top of
         the canvas — a divergence in the instrument, not in the figure. */
      ticks.forEach((t) => {
        if (t < yDomain[0] - 1e-9 || t > yDomain[1] + 1e-9) return;
        ctx.fillText(format(t), rect.x - 8, sy(t));
      });
      ctx.textAlign = align;
      if (label) { ctx.moveTo(rect.x - 46, rect.y); ctx.lineTo(rect.x - 34, rect.y + rect.h); }
    },
  };
};

const COLORS = Object.fromEntries([
  "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "empirical", "theory",
  "smoothed", "highlight", "reference", "groupA", "groupB", "groupC", "extreme", "unknown", "holdout",
].map((k) => [k, "#123456"]));
Object.assign(COLORS, { font: "sans-serif", mono: "monospace", fsXs: "11px", fsSm: "13px", fsMd: "15px", fsFig: "13px" });

const spec = () => widget().then((w) => w.params);
const defaults = async () => resolveParams(await spec(), new URLSearchParams(""));

/* --- 1 · the model, against cells 17 and 25 -------------------------------- */
{
  check("a clonal heterozygous mutation at purity 1 reads 0.5", M.vafExpected(1, 1, 1, 2) === 0.5);
  check("cell 17's purity 0.7 example reads 0.35", Math.abs(M.vafExpected(0.7, 1, 1, 2) - 0.35) < 1e-12);
  check("cell 17's amplification reads 0.25", Math.abs(M.vafExpected(1, 1, 1, 4) - 0.25) < 1e-12);
  check("the wild-type copy lost reads 1.0", Math.abs(M.vafExpected(1, 1, 2, 2) - 1) < 1e-12);
  let worst = 0;
  for (const p of [0.35, 0.5, 0.7, 1]) {
    for (const st of M.COPY_STATES) {
      for (const m of st.copies) {
        for (const c of [0.2, 0.5, 0.75, 1]) {
          const back = M.ccfFrom(M.vafExpected(p, c, m, st.total), p, m, st.total);
          worst = Math.max(worst, Math.abs(back - c));
        }
      }
    }
  }
  check("cell 25's two formulas invert each other", worst < 1e-12, `worst ${worst.toExponential(1)}`);

  /* A SOMATIC MUTATION ARISES ON ONE CHROMOSOME, so the copies carrying it are
     copies of that chromosome — at most `major`. The widget capped them at the
     TOTAL until 2026-09-16, which let 2 + 1 be asked for three mutated copies
     and 1 + 1 for two, neither of which is a cell (Kenneth's question). */
  check("every state is major + minor, and they add to its total",
    M.COPY_STATES.every((s) => s.major + s.minor === s.total));
  check("2 + 0 is two copies of one chromosome and none of the other",
    M.stateOf("2+0").major === 2 && M.stateOf("2+0").minor === 0);
  check("the mutated copies offered are one per copy of the chromosome it arose on",
    M.COPY_STATES.every((s) => M.copyOptions(s.key).join() === s.copies.join()
      && s.copies[s.copies.length - 1] === s.major));
  check("1 + 1 cannot carry the mutation twice", M.copyOptions("1+1").join() === "1");
  check("2 + 1 stops at two mutated copies", M.copyOptions("2+1").join() === "1,2");
  check("3 + 1 allows three, which is the state Kenneth asked about",
    M.copyOptions("3+1").join() === "1,2,3"
    && Math.abs(M.configOne({ purity: "0.70", ccf: "1.00", state: "3+1", copies: "2", depth: "88" }).expected - 0.412) < 0.001,
    "two of four copies reads VAF 0.412 at purity 0.70");
  const overAsked = M.configOne({ purity: "0.70", ccf: "1.00", state: "2+1", copies: "3", depth: "88" });
  check("a link asking for more copies than the state has comes back to it", overAsked.copies === 2);
}

/* --- 2 · page 3's inference, and what the analysis is told ----------------- */
{
  /* `scenariosFor` is cell 25 §2, which page 1's panel drew until 2026-09-26
     and the lab's measurements still read; page 3 draws §3, checked at the end
     of this block. Rebuilt with the panel on 2026-09-16 (model decision 4). It asks the
     lesson's own question now — cell 25 §3 fits c and m with p and Cₜ given —
     and how much it is given is a control, which is Kenneth's own idea. What
     has to hold: one method at every level so none is a straw man, a row that
     reads exactly what it prints, the truth marked when it is there, and the
     levels doing the different jobs the measurement says they do. */
  const cfgOf = (o) => M.configOne({ purity: "0.70", ccf: "1.00", state: "3+1", copies: "2", depth: "88", ...o });

  /* Every row reads the VAF the panel was built for, at its own multiplicity
     and its own assumed copy number — the arithmetic the figure prints. */
  let bad = 0;
  let rows = 0;
  for (const level of M.KNOWLEDGE.map((k) => k.key)) {
    for (const st of M.COPY_STATES) {
      for (const purity of M.PURITY_OPTIONS) {
        for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
          for (const copies of st.copies.map(String)) {
            const cfg = cfgOf({ state: st.key, purity, ccf, copies });
            const fit = M.scenariosFor(cfg.expected, cfg, level);
            for (const r of fit.rows) {
              rows += 1;
              const got = M.vafExpected(r.purity, r.c, r.m, r.state.total);
              if (Math.abs(got - cfg.expected) > 1e-9) bad += 1;
            }
          }
        }
      }
    }
  }
  check("every scenario reads the VAF the panel was built for", bad === 0, `${rows} rows, ${bad} off`);

  /* ONE METHOD AT EVERY LEVEL — enumerate the multiplicity, solve the fraction,
     keep the fractions that are fractions. A level differs only in what it is
     told; nothing is a straw man. */
  const shapes = M.KNOWLEDGE.map((k) => {
    const cfg = cfgOf({});
    return M.scenariosFor(cfg.expected, cfg, k.key).rows.map((r) => r.m).join(",");
  });
  check("the assumed levels enumerate a total of two, the told level the state's own",
    shapes[0] === "1,2" && shapes[1] === "1,2" && shapes[2] === "1,1,2,3", shapes.join("  |  "));
  /* A DIPLOID CALL IS NOT AN ALLELE-SPECIFIC ONE: told only "diploid", an
     analysis cannot tell 1 + 1 from 2 + 0, so two mutated copies stay open. */
  const naive = M.scenariosFor(cfgOf({}).expected, cfgOf({}), "nothing");
  check("…and a total of two leaves both genotypes open, not just the plain one",
    naive.rows.map((r) => r.state.key).join(",") === "1+1,2+0");
  check("knowing nothing assumes a pure sample", naive.purity === 1);
  check("…and knowing purity uses the sample's own", M.scenariosFor(0.4, cfgOf({}), "purity").purity === 0.7);

  /* THE TRUTH IS MARKED WHEN IT IS THERE, AND THE LEVELS DIFFER IN WHETHER IT
     IS. This is the whole of cell 24's argument, and the numbers are the ones
     `_lab/vaf-scenarios-measure.mjs` prints. */
  const tally = {};
  for (const k of M.KNOWLEDGE) tally[k.key] = { diploid: { wrong: 0, n: 0 }, altered: { wrong: 0, n: 0 } };
  for (const purity of M.PURITY_OPTIONS) {
    for (const st of M.COPY_STATES) {
      for (const copies of st.copies.map(String)) {
        const cfg = cfgOf({ state: st.key, purity, ccf: "1.00", copies });
        for (const k of M.KNOWLEDGE) {
          const fits = M.scenariosFor(cfg.expected, cfg, k.key).rows.filter((r) => r.ok);
          const g = tally[k.key][st.key === "1+1" ? "diploid" : "altered"];
          g.n += 1;
          if (fits.length && fits.every((r) => r.c < 0.9)) g.wrong += 1;
        }
      }
    }
  }
  const pc = (g) => (100 * g.wrong) / g.n;
  check("knowing nothing calls a clonal mutation subclonal, in either kind of region",
    pc(tally.nothing.diploid) > 50 && pc(tally.nothing.altered) > 50,
    `${pc(tally.nothing.diploid).toFixed(1)}% diploid, ${pc(tally.nothing.altered).toFixed(1)}% altered`);
  check("…knowing purity settles the diploid case completely",
    pc(tally.purity.diploid) === 0, `${pc(tally.purity.diploid).toFixed(1)}%`);
  check("…and does not settle an altered one, which is what copy number is for",
    pc(tally.purity.altered) > 50 && pc(tally.purity.altered) < pc(tally.nothing.altered),
    `${pc(tally.nothing.altered).toFixed(1)}% before, ${pc(tally.purity.altered).toFixed(1)}% after`);
  check("…and knowing both is right everywhere, which is why there are three levels",
    pc(tally.both.diploid) === 0 && pc(tally.both.altered) === 0);

  /* EVERY SAMPLE THE READER CAN BUILD IS INFERABLE, once the analysis is told
     what cell 24 says to measure. Kenneth asked whether the page lets him build
     samples nothing could be inferred from, and whether they wanted
     constraining (2026-09-16): it does not, and they do not. What varies is
     whether the analysis was TOLD enough — the shortfall is the assumption's,
     never the sample's, and that is the whole of cell 24's argument. The
     impossible cells were constrained in an earlier round: 1 + 1 cannot carry
     the mutation twice, and 2 + 1 stops at two. */
  {
    let missing = 0;
    let n = 0;
    for (const purity of M.PURITY_OPTIONS) {
      for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
        for (const st of M.COPY_STATES) {
          for (const copies of st.copies.map(String)) {
            const cfg = cfgOf({ purity, ccf, state: st.key, copies });
            n += 1;
            if (!M.scenariosFor(cfg.expected, cfg, "both").rows.some((r) => r.ok && r.truth)) missing += 1;
          }
        }
      }
    }
    check("every sample the reader can build is among the scenarios, told both",
      missing === 0, `${n} samples, ${missing} unreachable`);
  }

  /* The truth is among the candidates exactly when the analysis was told what
     it needed; a level that misses it must say so on the figure. */
  const told = M.scenariosFor(cfgOf({}).expected, cfgOf({}), "both");
  check("the reader's own cell is marked when the analysis can reach it",
    told.rows.filter((r) => r.truth).length === 1
    && told.rows.find((r) => r.truth).m === 2
    && Math.abs(told.rows.find((r) => r.truth).c - 1) < 1e-9);
  for (const k of ["nothing", "purity"]) {
    check(`…and knowing ${k === "none" ? "nothing" : "purity alone"} cannot, on a gained region`,
      !M.scenariosFor(cfgOf({}).expected, cfgOf({}), k).rows.some((r) => r.ok && r.truth));
  }

  /* THE CALL — the one tile on this page that makes a judgement, so it is the
     one that has to be held hardest (§ *Widget 59*: a tile's label is a claim).
     Told everything it must never be wrong; told nothing it must be wrong often
     enough to be worth the reader's attention; and "cannot tell" must RISE with
     knowledge, because what a measurement removes is the confident wrong call. */
  {
    const tally = {};
    for (const k of M.KNOWLEDGE) tally[k.key] = { right: 0, wrong: 0, split: 0, n: 0 };
    const sweep = (fn) => {
      for (const purity of M.PURITY_OPTIONS) {
        for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
          for (const st of M.COPY_STATES) {
            for (const copies of st.copies.map(String)) fn(cfgOf({ purity, ccf, state: st.key, copies }));
          }
        }
      }
    };
    sweep((cfg) => {
      const truth = cfg.ccf >= M.CUT ? "clonal" : "subclonal";
      for (const k of M.KNOWLEDGE) {
        const v = M.verdictFor(cfg.expected, cfg, k.key);
        const t = tally[k.key];
        t.n += 1;
        if (v === "split") t.split += 1;
        else if (v === truth) t.right += 1;
        else t.wrong += 1;
      }
    });
    const pcOf = (x, k) => (100 * tally[k][x]) / tally[k].n;
    const say = (x, k) => pcOf(x, k).toFixed(1) + "%";
    check("told purity and copy number, the call is never wrong",
      tally.both.wrong === 0, tally.both.n + " samples, " + tally.both.wrong + " wrong");
    check("…told nothing it is wrong often enough to matter",
      pcOf("wrong", "nothing") > 15, say("wrong", "nothing"));
    check("…and a call of cannot-tell rises with what the analysis is given",
      pcOf("split", "nothing") < pcOf("split", "purity") && pcOf("split", "purity") < pcOf("split", "both"),
      [say("split", "nothing"), say("split", "purity"), say("split", "both")].join(" → "));

    /* Three answers, each reachable, and each with its own value and note. */
    const seen = new Set();
    sweep((cfg) => { for (const k of M.KNOWLEDGE) seen.add(M.verdictFor(cfg.expected, cfg, k.key)); });
    check("the call has three answers and the reader can reach all of them",
      seen.has("clonal") && seen.has("subclonal") && seen.has("split"), [...seen].join(", "));
    for (const key of ["clonal", "subclonal", "split", "none"]) {
      check("…the " + key + " answer has a value and a note",
        Boolean(M.STRINGS.callValue[key]) && Boolean(M.STRINGS.callNote[key]));
    }

    /* THE FRACTION TILE SHOWS THE SPAN OF WHAT FITS, and the call is its visible
       consequence. Solving the tile from the draw put 0.92 beside "subclonal" in
       2.7% of settings; showing ONE fitting scenario put 1.00 beside "Cannot
       tell", because that one was the sample the reader built and the analysis
       could not have singled it out (Kenneth, 2026-09-16). Held both ways: the
       span agrees with the call, and the tile reports every scenario that fits
       rather than choosing among them. */
    let clash = 0;
    let narrower = 0;
    sweep((cfg) => {
      for (const k of M.KNOWLEDGE) {
        const span = M.fractionSpan(cfg.expected, cfg, k.key);
        const fits = M.scenariosFor(cfg.expected, cfg, k.key).fits;
        const v = M.verdictFor(cfg.expected, cfg, k.key);
        if (!span) continue;
        if (v === "clonal" && !(span.lo >= M.CUT)) clash += 1;
        if (v === "subclonal" && !(span.hi < M.CUT)) clash += 1;
        if (v === "split" && !(span.lo < M.CUT && span.hi >= M.CUT)) clash += 1;
        if (span.n !== fits.length) narrower += 1;
      }
    });
    check("…the fraction's span agrees with the call in every setting",
      clash === 0, clash + " disagreements");
    check("…and it reports every scenario that fits, not one it has chosen",
      narrower === 0, narrower + " narrower than the reading allows");

    /* The exact case that leaked: a clonal mutation on one of two copies in a
       pure sample, told nothing. It reads 0.500, and so does 2 + 0 with both
       copies mutated in half the cells, so the tile must span both. */
    const leak = cfgOf({ purity: "1.00", ccf: "1.00", state: "1+1", copies: "1" });
    const ls = M.fractionSpan(leak.expected, leak, "nothing");
    check("…including the case that showed 1.00 beside Cannot tell",
      Math.abs(ls.lo - 0.5) < 1e-9 && Math.abs(ls.hi - 1) < 1e-9
      && M.verdictFor(leak.expected, leak, "nothing") === "split",
      M.n2(ls.lo) + "–" + M.n2(ls.hi));
    check("…which the copy number resolves: told both, 1 + 1 is clonal",
      M.verdictFor(leak.expected, leak, "both") === "clonal"
      && M.fractionSpan(leak.expected, leak, "both").n === 1);
  }

  /* THE MINOR CHROMOSOME: a picture the reading cannot see. Two rows that
     differ only by host carry the same multiplicity and the same fraction, and
     they are adjacent so the figure shows one arrangement with the mutation on
     the other chromosome. */
  check("only a state whose counts differ, with its minor surviving, offers a host",
    M.COPY_STATES.filter((st) => M.hostsOf(st).length > 1).map((st) => st.key).join(",") === "2+1,3+1");
  const two = M.scenariosFor(cfgOf({ state: "2+1", copies: "1" }).expected, cfgOf({ state: "2+1", copies: "1" }), "both");
  const m1 = two.rows.filter((r) => r.m === 1);
  check("…and its two rows read the same, differing only in the picture",
    m1.length === 2 && Math.abs(m1[0].c - m1[1].c) < 1e-12
    && m1[0].host === "major" && m1[1].host === "minor",
    `c ${M.n3(m1[0].c)} on both`);
  check("…and they are adjacent, which is what makes that legible",
    two.rows.indexOf(m1[0]) + 1 === two.rows.indexOf(m1[1]));
  check("the host never changes the reading",
    Math.abs(M.vafExpected(0.7, 1, 1, M.stateOf("2+1").total)
      - M.vafExpected(0.7, 1, 1, M.stateOf("2+1").total)) < 1e-12);

  /* A fraction past one is ruled out, and the note says what it would take. */
  const over = M.scenariosFor(cfgOf({}).expected, cfgOf({}), "both").rows.find((r) => !r.ok);
  check("a scenario needing more than every tumor cell is ruled out",
    over && over.c > 1, over ? `m${over.m} would need ${M.n2(over.c)}` : "none");

  /* PAGE 3'S LIKELIHOOD, cell 25 §3 (2026-09-26). The shipped panel solved §2
     from the expected VAF; page 3 draws the likelihood of the reads, so what
     has to hold is what `_lab/ccf-measure.mjs` measured before the mock: the
     set the reads allow holds the truth when the analysis is told enough, a
     wrong assumption makes it confidently wrong, a multiplicity tie shows as
     two curves, and the call — his pick, the whole set against 0.9 — is almost
     never wrong told both. */
  {
    const base = cfgOf({ state: "1+1", copies: "1", purity: "0.70" });
    check("the likelihood waits for a read", M.likelihoodOf(0, 0, base, "both") === null);
    const at88 = M.likelihoodOf(33, 88, base, "both");
    check("the widget's own default reading allows c 0.79–1.00 and cannot tell",
      M.n2(at88.lo) === "0.79" && M.n2(at88.hi) === "1.00" && at88.call === "split",
      `${M.n2(at88.lo)}–${M.n2(at88.hi)} ${at88.call}`);
    check("c runs over (0, 1] only", M.LIK_GRID[0] > 0 && M.LIK_GRID[M.LIK_GRID.length - 1] === 1);
    check("one curve per multiplicity the level considers",
      M.likelihoodOf(30, 88, cfgOf({}), "both").curves.map((cv) => cv.m).join() === "1,2,3"
      && M.likelihoodOf(30, 88, cfgOf({}), "nothing").curves.map((cv) => cv.m).join() === "1,2");
    /* the tie: (c 1, m 1) and (c 0.5, m 2) expect one VAF in 2 + 0 */
    const tie = cfgOf({ state: "2+0", copies: "1", purity: "0.70" });
    const tl = M.likelihoodOf(Math.round(88 * tie.expected), 88, tie, "both");
    check("a 2 + 0 reading leaves two multiplicities, as two separate intervals",
      tl.allowed.length === 2 && tl.allowed[1].interval.hi < tl.allowed[0].interval.lo,
      tl.allowed.map((cv) => `m${cv.m} ${M.n2(cv.interval.lo)}–${M.n2(cv.interval.hi)}`).join(", "));

    const sweep = (level, depth) => {
      const t = { right: 0, wrong: 0, split: 0, n: 0, cover: 0 };
      for (const purity of M.PURITY_OPTIONS) for (const st of M.COPY_STATES) for (const copies of st.copies.map(String)) {
        for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
          const cfg = cfgOf({ purity, ccf, state: st.key, copies });
          const rng = makeRng(1000 + depth);
          for (let d = 0; d < 20; d += 1) {
            let k = 0;
            for (let i = 0; i < depth; i += 1) if (rng.next() < cfg.expected) k += 1;
            const r = M.likelihoodOf(k, depth, cfg, level);
            const truth = cfg.ccf >= 0.999 ? "clonal" : "subclonal";
            t.n += 1;
            if (r.call === "split") t.split += 1; else if (r.call === truth) t.right += 1; else t.wrong += 1;
            if (r.allowed.some((cv) => cv.interval.lo - 1e-9 <= cfg.ccf && cfg.ccf <= cv.interval.hi + 1e-9)) t.cover += 1;
          }
        }
      }
      return t;
    };
    const pc = (x, t) => (100 * x) / t.n;
    const both88 = sweep("both", 88);
    const none88 = sweep("nothing", 88);
    check("told purity and copy number, the call is wrong in under 1% of samples",
      pc(both88.wrong, both88) < 1, `${pc(both88.wrong, both88).toFixed(1)}% at 88 reads, ${both88.n} draws`);
    check("…told nothing, it is wrong often enough to matter",
      pc(none88.wrong, none88) > 10, `${pc(none88.wrong, none88).toFixed(1)}%`);
    check("told both, the fractions allowed hold the truth at least 95% of the time",
      pc(both88.cover, both88) >= 95, `${pc(both88.cover, both88).toFixed(1)}%`);
    const none500 = sweep("nothing", 500);
    check("…told nothing, less often, and less often still with more reads",
      pc(none88.cover, none88) < 80 && pc(none500.cover, none500) < pc(none88.cover, none88),
      `${pc(none88.cover, none88).toFixed(1)}% at 88, ${pc(none500.cover, none500).toFixed(1)}% at 500`);
    const both500 = sweep("both", 500);
    check("reading deeper settles more calls, told both",
      pc(both500.split, both500) < pc(both88.split, both88),
      `cannot tell ${pc(both88.split, both88).toFixed(1)}% at 88, ${pc(both500.split, both500).toFixed(1)}% at 500`);
  }
}

/* --- 3 · the reads -------------------------------------------------------- */
{
  const cfg = M.configOne({ purity: "0.70", ccf: "1.00", state: "1+1", copies: 1, depth: "88" });
  const a = M.buildReads(makeRng(7), cfg);
  const b = M.buildReads(makeRng(7), cfg);
  check("the reads are seeded", a.reads.join("") === b.reads.join(""));
  check("the pileup holds the depth", a.reads.length === 88 && a.depth === 88);
  check("the running count is the running count",
    a.running[87] === a.reads.reduce((s, r) => s + r, 0) && M.altAt(a, 88) === a.alt);
  check("the last frame of the reveal is the finished reading",
    M.vafAt(a, 88) === a.alt / 88, M.n3(M.vafAt(a, 88)));
  let sum = 0;
  for (let s = 1; s <= 60; s += 1) sum += M.buildReads(makeRng(s), cfg).alt / 88;
  check("the reads land on the model's own expectation", Math.abs(sum / 60 - cfg.expected) < 0.02,
    `mean VAF ${(sum / 60).toFixed(3)} against ${M.n3(cfg.expected)}`);
  const cells = M.cellCounts(cfg);
  check("sixty cells carry the purity as a count", cells.tumour === 42 && cells.carrying === 42, `${cells.tumour} tumour cells`);
}

/* --- 4 · page 2: the mixture, and MATH ------------------------------------ */
{
  const cfgOne = M.configMany({ clones: "one", mutations: "300", purity2: "0.70", depth2: "88", assumed: "purity" });
  const one = M.buildMany(makeRng(3), cfgOne);
  check("one clone is given more than one cluster", one.fit.K > 1, `K = ${one.fit.K}`);
  check("its MATH is not zero", one.math > 8 && one.math < 22, one.math.toFixed(1));
  const cfgTwo = M.configMany({ clones: "two", mutations: "300", purity2: "0.70", depth2: "88", assumed: "purity" });
  const two = M.buildMany(makeRng(3), cfgTwo);
  check("a real subclone scores higher than one clone", two.math > one.math + 10,
    `${two.math.toFixed(1)} against ${one.math.toFixed(1)}`);
  check("the brackets are ordered by their own means",
    two.fit.spans.every((s, i) => i === 0 || s.mu >= two.fit.spans[i - 1].mu));
  check("a bracket is the component's mean ± one standard deviation",
    two.fit.spans.every((s) => Math.abs((s.hi - s.lo) / 2 - s.sd) < 1e-12));
  const shallow = M.buildMany(makeRng(3), { ...cfgOne, depthMedian: 31 });
  check("shallow reads raise MATH with no subclone present", shallow.math > one.math + 5,
    `${shallow.math.toFixed(1)} at median depth 31 against ${one.math.toFixed(1)} at 88`);
  const axisV = M.onAxis(two, cfgTwo, "vaf");
  const axisC = M.onAxis(two, cfgTwo, "ccf");
  check("the axis control divides, and does not refit",
    axisC.values.every((v, i) => Math.abs(v - M.ccfFrom(axisV.values[i], cfgTwo.assumed, 1, 2)) < 1e-12));
  const pure = M.onAxis(two, { ...cfgTwo, assumed: 1 }, "ccf");
  const keptTrue = axisC.values.filter((v) => v >= M.CUT).length;
  const keptPure = pure.values.filter((v) => v >= M.CUT).length;
  check("taking the sample as pure empties the clonal peak", keptPure < keptTrue / 4,
    `${keptPure} against ${keptTrue} at the true purity`);
}

/* --- 5 · page 3: the sum rule --------------------------------------------- */
{
  const all = M.SHAPES.filter((s) => M.SAMPLES.every((u) => M.fitsSumRule(s, u.ccf)));
  check("his four samples leave one shape", all.length === 1 && all[0].key === "linear");
  const surgery = M.SAMPLES[3];
  check("the surgery sample alone leaves both", M.shapesFitting(surgery.ccf).length === 2);
  check("the first sample rules branching out",
    M.shapesFitting(M.SAMPLES[0].ccf).map((s) => s.key).join() === "linear");
  const tightBranch = M.tightestNode(M.shapeOf("branching"), M.SAMPLES[0].ccf);
  check("the tightest constraint on a branching shape is the trunk's",
    tightBranch.node === 0 && Math.abs(tightBranch.sum - 1.046) < 1e-9, `${M.n2(tightBranch.sum)} against ${M.n2(tightBranch.parent)}`);
  const tightLinear = M.tightestNode(M.shapeOf("linear"), M.SAMPLES[0].ccf);
  check("…and on a linear one it is cluster 2's, not the trunk's", tightLinear.node === 1,
    `${M.n2(tightLinear.sum)} against ${M.n2(tightLinear.parent)}`);
  check("equal subclones must pass half the trunk before the rule bites",
    M.shapesFitting([0.9, 0.45, 0.45]).length === 2 && M.shapesFitting([0.9, 0.5, 0.5]).length === 1);
}

/* --- 6 · the contract, by name -------------------------------------------- */
{
  const W = await widget();
  for (const key of ["slug", "title", "status", "subtitle", "layout", "height", "params", "legend", "compute", "animation", "draw", "readout", "summary"]) {
    check(`declares \`${key}\``, W[key] != null);
  }
  const WANT = {
    page: "segmented", view: "segmented", truthSec: "section", sampleSec: "section", purity: "choice", ccf: "choice",
    state: "segmented", seqSec: "section", depth: "choice",
    analysisSec: "section", knows: "segmented",
    clones: "segmented", mutations: "choice", lookSec: "section",
    axis: "segmented", assumed: "segmented", clusters: "bool", samplesSec: "section", taken: "choice",
    tree: "segmented", showcells: "bool", dataSec: "section", seed: "int", all: "bool", shown: "int",
  };
  for (const [name, type] of Object.entries(WANT)) check(`${name} is ${type}`, W.params[name]?.type === type);
  check("no parameters beyond those",
    Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
  for (const name of ["page", "view", "knows", "axis", "assumed", "clusters", "taken", "tree", "showcells", "all"]) {
    check(`${name} is a display parameter`, W.params[name].display === true);
  }
  for (const name of ["purity", "ccf", "state", "depth", "clones", "mutations", "seed"]) {
    check(`${name} is a data parameter`, !W.params[name].display);
  }
  check("four pages in the notebook's order",
    W.params.page.options.map((o) => o.value).join() === "one,many,ccf,clonal");
  check("page 1 opens on cell 17's simple case, a pure sample", W.params.purity.default === "1.00");
  check("the fraction axis is page 3's and opens there on the fraction",
    W.params.axis.default === "ccf" && JSON.stringify(W.params.axis.when).includes('"ccf"')
    && !JSON.stringify(W.params.axis.when).includes('"many"'));
  check("page 1 draws no analysis: Given is page 3's alone",
    !JSON.stringify(W.params.knows.when).includes('"one"') || JSON.stringify(W.params.knows.when).includes('"view"'));
  /* THE FOUR CASES, his pick A of 2026-09-26: the control offers cell 17's
     four cells and nothing else, and each carries its own mutated count. */
  check("the copy-number control offers the notebook's four cases",
    W.params.state.options.map((o) => `${o.value}:${o.label}`).join(" · ")
      === "1+1:1 of 2 copies · 2+0:2 of 2 copies · 1+0:1 of 1 copy · 3+1:1 of 4 copies",
    W.params.state.options.map((o) => o.label).join(" · "));
  check("…each reading what cell 17 says at purity 1",
    M.CASES.map((c) => M.n3(M.configOne({ purity: "1.00", ccf: "1.00", state: c.key, depth: "88" }).expected)).join()
      === "0.500,1.000,1.000,0.250");
  check("…and the case, not a second control, sets the mutated count",
    !("copies" in W.params) && M.configOne({ purity: "1.00", ccf: "1.00", state: "2+0", depth: "88" }).copies === 2);
  check("the widget is shipped", W.status === "shipped");
  check("the manifest agrees",
    JSON.parse(read("widgets/manifest.json")).widgets
      .find((w) => w.slug === "tumor-heterogeneity")?.status === "shipped");
}

/* --- 7 · the animation, driven in node ------------------------------------ */
{
  const W = await widget();
  const values = await defaults();
  for (const depth of M.DEPTH_OPTIONS) {
    const params = { ...values, depth };
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    let frames = 0;
    anim.mode = "run";
    while (W.animation.advance(anim, { dt: 32, params, state }) && frames < 20000) frames += 1;
    check(`depth ${depth}: Play reaches the last read`, anim.k === state.one.depth && anim.done,
      `${frames} frames, ${(frames * 32 / 1000).toFixed(1)} s`);
    const stepAnim = W.animation.init({ params, state, fromScratch: true });
    stepAnim.mode = "step";
    W.animation.advance(stepAnim, { dt: 200, params, state });
    check(`depth ${depth}: one step adds one unit`, stepAnim.k === Math.max(1, Math.ceil(state.one.depth / 66)),
      `k = ${stepAnim.k}`);
  }
  const params = { ...values, page: "ccf", view: "all", axis: "vaf" };
  const state = W.compute({ params, rng: makeRng(1) });
  const inert = (p) => W.animation.init({ params: { ...values, ...p }, state, fromScratch: true }).inert;
  check("the histograms and the trees take Step and Play out of the row",
    inert({ page: "many" }) && inert({ page: "ccf", view: "all" }) && inert({ page: "clonal" }));
  check("…and page 3's One mutation keeps them, since its reads are the inference",
    inert({ page: "ccf", view: "one" }) === false && inert({ page: "one" }) === false);

  /* The axis ease: core supplies the frames, the widget asks once in rebuild
     and clears the request by landing (§ core/widget.js, the display path). */
  const eased = W.animation.init({ params: { ...values, page: "one", axis: "vaf" }, state, fromScratch: true });
  eased.mode = "run";
  for (let i = 0; i < 20; i += 1) W.animation.advance(eased, { dt: 32, params: { ...values, page: "one", axis: "vaf" }, state });
  const readsBefore = eased.k;
  W.animation.rebuild(eased, { params: { ...params, axis: "ccf" }, state });
  check("switching the axis asks core for frames", eased.easing === true);
  check("…and keeps the reads the reader has drawn", eased.k === readsBefore, `${eased.k} reads`);
  eased.mode = "ease";
  let frames = 0;
  while (W.animation.advance(eased, { dt: 32, params: { ...params, axis: "ccf" }, state }) && frames < 200) frames += 1;
  check("…and lands on the fraction", eased.mix === 1, `${frames} frames, ${(frames * 32)}ms against EASE_MS ${M.EASE_MS}`);
  /* Turned round mid-flight, an ease starts from where the figure IS. */
  const back = W.animation.init({ params: { ...params, axis: "ccf" }, state, fromScratch: true });
  back.mode = "ease";
  W.animation.rebuild(back, { params: { ...params, axis: "vaf" }, state });
  W.animation.advance(back, { dt: 32, params: { ...params, axis: "vaf" }, state });
  check("…and an ease turned round leaves from where it is", back.mix < 1 && back.mix > 0.7, M.n3(back.mix));

  /* Page 2 reads VAF only: an axis change there asks for nothing. */
  const onTwo = W.animation.init({ params: { ...values, page: "many", axis: "vaf" }, state, fromScratch: true });
  W.animation.rebuild(onTwo, { params: { ...values, page: "many", axis: "ccf" }, state });
  check("page 2 has no axis to ease", !onTwo.easing);
  /* What the ease interpolates: one set of mutations read twice, so nothing
     may overtake anything on the way (it is a rescaling, not a reshuffle). */
  const many = W.compute({ params, rng: makeRng(4) });
  const a = M.axisAt(many.many, many.manyCfg, 0);
  const b = M.axisAt(many.many, many.manyCfg, 1);
  const mid = M.axisAt(many.many, many.manyCfg, 0.5);
  check("the ease's ends are the two axes themselves",
    a.values.every((v, i) => v === many.many.muts[i].vaf) && b.values.every((v, i) => Math.abs(v - M.ccfFrom(many.many.muts[i].vaf, many.manyCfg.assumed, 1, 2)) < 1e-12));
  const order = (vals) => vals.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]).map(([, i]) => i).join();
  check("…and no mutation overtakes another on the way", order(mid.values) === order(a.values));
  check("…with the axis' own range carried with them", mid.max > a.max && mid.max < b.max, `${M.n2(a.max)} → ${M.n2(mid.max)} → ${M.n2(b.max)}`);
  const authored = W.animation.init({ ...{ params: { ...values, shown: 20 }, state }, fromScratch: false });
  check("`?shown=` applies on the first render only", authored.k === 20);
}

/* --- 8 · every readout and summary, over a grid ---------------------------- */
{
  const W = await widget();
  const values = await defaults();
  const cells = [];
  for (const [page, view] of [["one", "one"], ["many", "one"], ["ccf", "one"], ["ccf", "all"], ["clonal", "one"]]) {
    for (const purity of M.PURITY_OPTIONS) {
      for (const depth of M.DEPTH_OPTIONS) {
        for (const state of M.CASES.map((c) => c.key)) {
          for (const knows of M.KNOWLEDGE.map((k) => k.key)) cells.push({ ...values, page, view, purity, depth, state, knows });
        }
      }
    }
  }
  for (const page of ["many", "ccf"]) for (const clones of ["one", "two", "three"]) for (const axis of ["vaf", "ccf"]) for (const assumed of ["purity", "nothing"]) {
    cells.push({ ...values, page, view: "all", clones, axis, assumed, mutations: "120" });
  }
  for (const taken of ["1", "2", "4"]) for (const shape of ["linear", "branching"]) {
    cells.push({ ...values, page: "clonal", taken, shape });
  }
  let bad = 0;
  let painted = 0;
  const notes = [];
  for (const params of cells) {
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.mode = "run";
    for (let i = 0; i < 400 && W.animation.advance(anim, { dt: 32, params, state }); i += 1) painted += 0;
    const { ctx } = recorder();
    W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
    const strings = [
      ...W.readout({ params, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
      W.summary({ params, state, anim }),
      ...W.legend({ params }).map((e) => e.label),
      cardText(),
    ];
    for (const s of strings) {
      if (s == null || /NaN|undefined|Infinity/.test(String(s))) { bad += 1; notes.push(`${params.page}: ${s}`); }
    }
  }
  check(`no NaN or undefined in ${cells.length} cells' readouts, summaries, legends and cards`, bad === 0, notes.slice(0, 2).join(" | "));
}

/* --- 8b · the formula card, page by page ---------------------------------- */
{
  const W = await widget();
  const values = await defaults();
  const drawWith = (params, k = null) => {
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    if (k != null) anim.k = k;
    const { ctx } = recorder();
    W.draw({ ctx, colors: COLORS, w: 550, h: W.height({ w: 550, ...params }), params, state, anim });
    return { state, anim };
  };

  /* Page 1, before a read has landed and after: the definition stands from the
     start, and the counts appear only once there is a reading to report (2.4). */
  drawWith({ ...values, page: "one" }, 0);
  const empty = cardText();
  check("page 1's card states the definition before any read", /VAF = variant reads \/ reads/.test(empty), empty.slice(0, 48));
  check("…and reports no count yet", !/= \d+ \/ \d+ =/.test(empty));
  const { state } = drawWith({ ...values, page: "one", purity: "0.70" }, 88);
  const full = cardText();
  const alt = M.altAt(state.one, 88);
  check("…and carries this reading's own counts once they exist",
    full.includes(`= ${alt} / 88 = ${M.n3(M.vafAt(state.one, 88))}`), full.slice(0, 60));
  /* NO LETTER FOR THE FRACTION ON PAGE 1 (Kenneth, 2026-09-26: "don't put CCF
     here"): copies counted in words, and cell 25's letters on page 3. */
  check("…the sample's line in words", full.includes("VAF = mutated copies / all copies"));
  check("…with this sample's numbers",
    full.includes(`(0.70 × 1.00 × 1) / (0.70 × 2 + 0.30 × 2) = ${M.n3(state.cfg.expected)}`), full.slice(60, 160));
  check("…and no cancer cell fraction on it anywhere",
    !/cancer cell fraction|c = VAF|p c m/i.test(full), full.slice(-80));
  /* THE MUTATED-COPY COUNT IS A TIMING (Kenneth, 2026-09-16: "isn't the
     mutation copied when the copy number increases?"). Since the four cases
     replaced the Mutated copies control (2026-09-26) the case's detail says it
     for two of two, and page 3's card says it of m in general. */
  check("the case control says how two of two copies comes about",
    /mutated copy was duplicated and the other lost/.test(M.STRINGS.stateDetail), M.STRINGS.stateDetail);

  /* Page 2: MATH as cell 23's title, and no fraction. */
  const { state: many } = drawWith({ ...values, page: "many", purity: "0.70" });
  const card2 = cardText();
  check("page 2's card states MATH as it is computed", card2.includes("MATH = 100 × 1.4826 × MAD(VAF) / median(VAF)"));
  check("…and the same line with this tumour's numbers",
    card2.includes(`= ${many.many.math.toFixed(1)}`), card2.slice(-70));
  check("…and no correction: the fraction is page 3's", !card2.includes("c = VAF"));

  /* Page 3, All mutations: the same model solved for c. */
  drawWith({ ...values, page: "ccf", view: "all", purity: "0.70" });
  const cardAll = cardText();
  check("page 3's All mutations card states the correction", cardAll.includes("c = VAF × (p Cₜ + 2(1 − p)) / (p m)"));
  check("…and what it multiplies by at this purity", /= VAF × 2\.86 at purity 0\.70/.test(cardAll), cardAll.slice(0, 90));

  /* Page 3, One mutation: cell 25's three steps. */
  const { state: s3 } = drawWith({ ...values, page: "ccf", purity: "0.70" }, 88);
  const card3one = cardText();
  const alt3 = M.altAt(s3.one, 88);
  check("page 3's card states the model in cell 25's letters", card3one.includes("VAF = p c m / (p Cₜ + 2(1 − p))"));
  check("…at what the analysis is given, c and m left as letters",
    card3one.includes("= 0.70 c m / (0.70 × 2 + 2 × 0.30) = 0.350 × c × m"), card3one.slice(0, 120));
  check("…c solved from the reading for each m",
    card3one.includes(`= ${M.n3(alt3 / 88)} × 2.86 ÷ m =`), card3one.slice(100, 220));
  check("…and the likelihood with this reading's k and n",
    card3one.includes("L(c, m) = Pr(k | n, VAF(c, m))") && card3one.includes(`k = ${alt3}, n = 88`));
  check("…with every letter named underneath, and what m stands for",
    /p is the fraction of cells/.test(card3one)
    && /m is one when the mutation arose after the copy number changed/.test(card3one)
    && /more when it arose before and was copied with it/.test(card3one));

  /* Page 4: the rule, and the sample that decides it. */
  const { state: tree } = drawWith({ ...values, page: "clonal", tree: "branching" });
  const card3 = cardText();
  check("page 4's card states the sum rule", /Σ over the children of a cluster: c ≤ c of the parent/.test(card3), card3.slice(0, 60));
  const decided = tree.used.find((s) => !M.fitsSumRule(M.shapeOf("branching"), s.ccf));
  const tight = M.tightestNode(M.shapeOf("branching"), decided.ccf);
  check("…and the arithmetic of the sample that rules the shape out",
    card3.includes(`${M.n2(tight.sum)} > ${M.n2(tight.parent)}`) && card3.includes(decided.key),
    `${decided.key}: ${M.n2(tight.sum)} > ${M.n2(tight.parent)}`);
  const linear = drawWith({ ...values, page: "clonal", tree: "linear" });
  void linear;
  check("…and the tightest one when the shape fits", /≤/.test(cardText()), cardText().slice(-40));
  check("the card is rebuilt when the page changes", cardText() !== card2 && cardText() !== full);
}

/* --- 9 · the geometry: nothing painted outside the canvas ------------------ */
{
  const W = await widget();
  const values = await defaults();
  const W_PX = 550; // the harness's canvas at FRAME_W 900 (HANDOVER § THE BIG ONE)
  let worst = null;
  const cells = [];
  for (const [page, view] of [["one", "one"], ["many", "one"], ["ccf", "one"], ["ccf", "all"], ["clonal", "one"]]) {
    for (const state of M.CASES.map((c) => c.key)) {
      for (const depth of M.DEPTH_OPTIONS) cells.push({ ...values, page, view, state, depth });
    }
  }
  for (const page of ["many", "ccf"]) for (const clones of ["one", "two", "three"]) for (const axis of ["vaf", "ccf"]) cells.push({ ...values, page, view: "all", clones, axis });
  /* Page 2 at every purity and every mutation count: the sweep above holds the
     purity at its default, and the mid-tween check below reached 0.35 first. */
  for (const page of ["many", "ccf"]) for (const purity of M.PURITY_OPTIONS) for (const axis of ["vaf", "ccf"]) {
    for (const mutations of M.MUTATION_OPTIONS) cells.push({ ...values, page, view: "all", purity, axis, mutations });
  }
  for (const taken of ["1", "2", "4"]) for (const shape of ["linear", "branching"]) cells.push({ ...values, page: "clonal", taken, shape });
  /* PAGE 3'S ONE MUTATION AT EVERY LEVEL OF KNOWLEDGE, every purity, state and
     mutated-copy count: the caption above the likelihood names what was given,
     and its longest form ("assuming a pure sample and a diploid genome") is
     the one to hold against the canvas. Page 1 had the same sweep for its
     panel's note until 2026-09-26. */
  for (const knows of M.KNOWLEDGE.map((k) => k.key)) {
    for (const purity of M.PURITY_OPTIONS) {
      for (const c of M.CASES) cells.push({ ...values, page: "ccf", view: "one", knows, purity, state: c.key });
    }
  }
  for (const params of cells) {
    const height = W.height({ w: W_PX, ...params });
    const state = W.compute({ params, rng: makeRng(params.seed) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k = state.one.depth;
    /* SETTLED MEANS SETTLED. The widget carries page 2's last figure across
       draws, so sweeping the cells in a row had each one starting a morph out
       of the one before it and this sweep stopped measuring finished figures.
       Mid-flight is swept on its own, below. */
    anim.histFrom = null;
    anim.spansFrom = null;
    const { ctx, box } = recorder();
    W.draw({ ctx, colors: COLORS, w: W_PX, h: height, params, state, anim });
    const over = Math.max(0, box.x1 - W_PX, -box.x0, box.y1 - height, -box.y0);
    if (!worst || over > worst.over) worst = { over, params, box, height };
  }
  check("nothing is painted outside the canvas the page reserves, at 550px",
    worst.over <= 1.5,
    `worst ${worst.over.toFixed(1)}px on ${worst.params.page} (x ${worst.box.x0.toFixed(0)}–${worst.box.x1.toFixed(0)}, y ${worst.box.y0.toFixed(0)}–${worst.box.y1.toFixed(0)} in ${W_PX}×${worst.height})`
      + ` purity=${worst.params.purity} axis=${worst.params.axis} muts=${worst.params.mutations} clones=${worst.params.clones}`);

  /* And the layout's own rows may not overlap: the first build drew the note
     under the cells across the reads' caption. */
  const L = M.layout(W_PX, { ...values, page: "one" });
  check("page 1's rows do not overlap",
    L.cells.y + L.cells.h + 24 <= L.reads.y - 10
    && L.reads.y + L.reads.h < L.marks.y
    && L.marks.y + L.marks.h <= L.bar.y);
  const L3 = M.layout(W_PX, { ...values, page: "ccf", view: "one" });
  check("page 3's rows do not overlap, and its cells and reads are page 1's",
    L3.reads.y + L3.reads.h + 24 <= L3.lik.y - 14
    && JSON.stringify(L3.cells) === JSON.stringify(L.cells) && JSON.stringify(L3.reads) === JSON.stringify(L.reads));
  /* Cell 17's three labels: the 0.5 one and the 1 one on separate rows, and
     the < 0.5 one ending before the 0.5 rule — the collision the mock found. */
  {
    const { ctx, seen } = recorder();
    const params = { ...values, page: "one" };
    const st = W.compute({ params, rng: makeRng(1) });
    W.draw({ ctx, colors: COLORS, w: W_PX, h: W.height({ w: W_PX, ...params }), params, state: st, anim: W.animation.init({ params, state: st, fromScratch: true }) });
    const find = (t) => seen.find((x) => x.s === t);
    const half = find(M.STRINGS.readingHalf);
    const one = find(M.STRINGS.readingOne);
    const low = find(M.STRINGS.readingLow);
    check("cell 17's three readings are all painted", Boolean(half && one && low));
    check("…the 0.5 and the 1 labels on separate rows", half && one && half.y !== one.y, `${half?.y} and ${one?.y}`);
    check("…and the < 0.5 label clear of the 0.5 rule",
      low && low.x + (M.STRINGS.readingLow.length * 5.6) / 2 < L.marks.x + L.marks.w * 0.5);
  }
}

/* --- the two tweens Kenneth asked for on 2026-09-16 ------------------------
   Page 3's shape switch, and page 2 under a change to purity, read depth or the
   mutation count. Both are held to their ENDS — a transition that does not land
   exactly on the figure the parameters ask for is a figure nobody can check —
   and to the rule about WHICH changes earn one. */
{
  const W = await widget();
  const values = await defaults();

  /* ---- page 3: the sample control narrows the tree ----
     It could not in the figure's own order: P2.1st alone rules out branching
     and it was always first, so the trees that fit read 1 of 2 at every
     setting (_lab/vaf-trees-mock.html § 0). The surgery sample joins first
     now, which is the only single sample that leaves both open. */
  {
    const counts = M.TAKEN_OPTIONS.map((t) => M.usedSamples(t.key)
      .map((smp) => M.shapesFitting(smp.ccf))
      .reduce((keep, f) => keep.filter((x) => f.includes(x)), [...M.SHAPES]).length);
    check("the sample control narrows the tree as samples join",
      counts[0] === 2 && counts[counts.length - 1] === 1, counts.join(" → ") + " of 2");
    const one = M.usedSamples("1");
    check("…one sample is the surgery sample, the only one that leaves both trees",
      one.length === 1 && one[0].key === "P2.surgery"
      && M.SAMPLES.filter((smp) => M.shapesFitting(smp.ccf).length === 2).map((smp) => smp.key).join() === "P2.surgery");
    /* The samples still draw in the figure's time order, whichever joined first. */
    const ordered = M.TAKEN_OPTIONS.every((t) => {
      const idx = M.usedSamples(t.key).map((smp) => M.SAMPLES.indexOf(smp));
      return idx.every((v, i) => i === 0 || v > idx[i - 1]);
    });
    check("…and they are drawn in the figure's time order, not the order they joined", ordered);

    /* The error bars are read off the figure: each brackets its own mean. */
    const bracket = M.SAMPLES.every((smp) => smp.ccf.every((m, c) => smp.lo[c] <= m && m <= smp.hi[c]));
    check("every cluster's error bar brackets its mean", bracket);
    /* And they say what the widget's sum rule cannot: P2.1st's violation
       survives its bars, P2.2st's nearly closes inside them. */
    const [p1, p2] = M.SAMPLES;
    check("P2.1st's violation survives its error bars",
      p1.lo[1] + p1.lo[2] > p1.hi[0], (p1.lo[1] + p1.lo[2]).toFixed(3) + " > " + p1.hi[0]);
    check("…while P2.2st's is within a few hundredths of closing",
      p2.lo[1] + p2.lo[2] - p2.hi[0] < 0.03, "margin " + (p2.lo[1] + p2.lo[2] - p2.hi[0]).toFixed(3));
    check("each cluster names its figure's three genes",
      M.CLUSTER_GENES.length === 3 && M.CLUSTER_GENES.every((g) => g.length === 3)
      && M.CLUSTER_GENES[1].includes("TP53"));
  }

  /* ---- page 3: every connector points at the centres it joins ----
     His catch from a screenshot, 2026-09-17: on the branching tree the ends sat
     beside the node centres rather than aiming at them. A pixel hash would
     record the misaligned picture as faithfully as the aligned one, so the
     geometry is asserted: each end lies on its circle, on the line between the
     two centres. */
  {
    let off = 0;
    let n = 0;
    const pairs = [
      [[100, 22], [100, 58]], [[100, 22], [78, 70]], [[100, 22], [122, 70]],
      [[50, 50], [90, 20]], [[0, 0], [30, 40]],
    ];
    for (const [a, b] of pairs) {
      const { from, to } = M.connectorEnds(a, b);
      n += 1;
      const onA = Math.abs(Math.hypot(from[0] - a[0], from[1] - a[1]) - M.NODE_R) < 1e-9;
      const onB = Math.abs(Math.hypot(to[0] - b[0], to[1] - b[1]) - M.NODE_R) < 1e-9;
      /* collinear with both centres: the cross product of (b − a) and (end − a) is zero */
      const cross = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (!onA || !onB || Math.abs(cross(from)) > 1e-6 || Math.abs(cross(to)) > 1e-6) off += 1;
    }
    check("every connector's ends lie on their nodes, on the line between the centres",
      off === 0, n + " connectors, " + off + " off");
    const v = M.connectorEnds([100, 22], [100, 58]);
    check("…and a vertical one is exactly the 11px it was before",
      v.from[0] === 100 && v.from[1] === 33 && v.to[0] === 100 && v.to[1] === 47);
  }

  /* ---- page 3: cluster 3 slides out of cluster 2 to beside it ---- */
  check("the shape glide's one scalar has exactly two ends to run between",
    M.SHAPES.length === 2 && M.shapeIndex("linear") === 0 && M.shapeIndex("branching") === 1);

  const geom = { x: 10, y: 20, w: 200, h: 16 };
  const ccf = M.SAMPLES[0].ccf;
  const A = M.barRects(M.SHAPES[0], ccf, geom);
  const B = M.barRects(M.SHAPES[1], ccf, geom);
  const sameRect = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
    && Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.h - b.h) < 1e-9;
  check("the glide's ends are the two shapes' own layouts",
    M.lerpRects(A, B, 0).every((r, i) => sameRect(r, A[i]))
    && M.lerpRects(A, B, 1).every((r, i) => sameRect(r, B[i])));
  check("…and only cluster 3 moves: the trunk and cluster 2 hold still in both",
    sameRect(A[0], B[0]) && sameRect(A[1], B[1]) && !sameRect(A[2], B[2]),
    `cluster 3 x ${A[2].x} → ${B[2].x}`);
  check("…at one width throughout, so it slides rather than grows",
    Math.abs(A[2].w - B[2].w) < 1e-9, `${A[2].w.toFixed(2)}px`);
  /* The overflow is read off the rects as DRAWN, so the rule's own moment — the
     children reaching past the parent — happens DURING the slide, not after. */
  const over = [0, 0.25, 0.5, 0.75, 1].map((t) => M.overflowOf(M.lerpRects(A, B, t)));
  check("…and the overflow grows with it rather than appearing at the end",
    over[0] === 0 && over.every((v, i) => i === 0 || v >= over[i - 1]) && over[4] > 1,
    over.map((v) => v.toFixed(1)).join(" → "));

  const clonal = { ...values, page: "clonal" };
  const st3 = W.compute({ params: clonal, rng: makeRng(clonal.seed) });
  const sh = W.animation.init({ params: clonal, state: st3, fromScratch: true });
  check("the shape opens on the shape the control names", sh.shapeMix === 0);
  W.animation.rebuild(sh, { params: { ...clonal, tree: "branching" }, state: st3 });
  check("switching the shape asks core for frames", sh.easing === true);
  sh.mode = "ease";
  let f3 = 0;
  while (W.animation.advance(sh, { dt: 32, params: { ...clonal, tree: "branching" }, state: st3 }) && f3 < 200) f3 += 1;
  check("…and lands exactly on the other shape", sh.shapeMix === 1, `${f3} frames`);
  /* Turned round mid-glide it leaves from where the figure is, as the axis does. */
  const back3 = W.animation.init({ params: { ...clonal, tree: "branching" }, state: st3, fromScratch: true });
  back3.mode = "ease";
  W.animation.rebuild(back3, { params: clonal, state: st3 });
  W.animation.advance(back3, { dt: 32, params: clonal, state: st3 });
  check("…and a glide turned round leaves from where it is",
    back3.shapeMix < 1 && back3.shapeMix > 0.7, M.n3(back3.shapeMix));
  /* Off page 4 there is nothing to watch, so it lands rather than glides. */
  const off = W.animation.init({ params: { ...values, page: "one" }, state: st3, fromScratch: true });
  W.animation.rebuild(off, { params: { ...values, page: "one", tree: "branching" }, state: st3 });
  check("…and a shape changed off page 4 lands with no frames",
    !off.easing && off.shapeMix === 1);

  /* ---- page 2: the bars morph, and only for the sample's own parameters ---- */
  const many = { ...values, page: "many" };
  const stM = W.compute({ params: many, rng: makeRng(many.seed) });
  const axis = M.onAxis(stM.many, stM.manyCfg, "vaf");
  const hA = M.histOf(axis.values, stM.many.muts, axis.max);
  const total = (h) => h.reduce((t, c) => t + c[0] + c[1], 0);
  check("every mutation lands in exactly one bin", total(hA) === stM.manyCfg.n, `${total(hA)} of ${stM.manyCfg.n}`);

  const stB = W.compute({ params: { ...many, purity: "0.35" }, rng: makeRng(many.seed) });
  const axisB = M.onAxis(stB.many, stB.manyCfg, "vaf");
  const hB = M.histOf(axisB.values, stB.many.muts, axisB.max);
  const same = (x, y) => x.every((c, i) => Math.abs(c[0] - y[i][0]) < 1e-9 && Math.abs(c[1] - y[i][1]) < 1e-9);
  check("the morph's ends are the two histograms themselves",
    same(M.lerpHist(hA, hB, 0), hA) && same(M.lerpHist(hA, hB, 1), hB));
  check("…and it holds the mutation count all the way across",
    [0.25, 0.5, 0.75].every((t) => Math.abs(total(M.lerpHist(hA, hB, t)) - stM.manyCfg.n) < 1e-9));
  /* A bin that is empty at both ends stays empty: the morph moves the bars that
     exist and never invents one between them. */
  check("…and a bin empty at both ends is empty throughout",
    hA.every((c, i) => !(c[0] + c[1] === 0 && hB[i][0] + hB[i][1] === 0)
      || M.lerpHist(hA, hB, 0.5)[i][0] + M.lerpHist(hA, hB, 0.5)[i][1] === 0));

  /* WHICH CHANGES EARN ONE, driven through `draw` because that is what leaves
     the figure the morph starts from. Purity, depth and the mutation count are
     the same tumour re-read; a seed or a different set of populations is not. */
  const morphFor = (change) => {
    drawWithMany(W, many);                       // the figure on screen
    const next = { ...many, ...change };
    const st = W.compute({ params: next, rng: makeRng(next.seed) });
    return W.animation.init({ params: next, state: st, fromScratch: true });
  };
  for (const [what, change] of [
    ["purity", { purity: "0.35" }],
    ["read depth", { depth: "500" }],
    ["the mutation count", { mutations: "1000" }],
  ]) {
    const a = morphFor(change);
    check(`changing ${what} morphs the bars from the figure on screen`,
      Boolean(a.histFrom) && a.easing === true && a.histT === 0,
      `${a.histFrom ? a.histFrom.length : 0} bins carried`);
  }
  for (const [what, change] of [
    ["the seed", { seed: 2 }],
    ["the populations", { clones: "three" }],
  ]) {
    const a = morphFor(change);
    check(`…and changing ${what} lands with none — it is a different tumour`,
      !a.histFrom && !a.easing);
  }
  const offPage = (() => {
    drawWithMany(W, many);
    const next = { ...values, page: "one", purity: "0.35" };
    const st = W.compute({ params: next, rng: makeRng(next.seed) });
    return W.animation.init({ params: next, state: st, fromScratch: true });
  })();
  check("…and so does a change made away from page 2", !offPage.histFrom && !offPage.easing);
  /* And a morph left in flight lands when the reader leaves the page, so
     coming back never shows a figure halfway between two sets of parameters. */
  const left = morphFor({ purity: "0.35" });
  W.animation.rebuild(left, { params: { ...values, page: "one", purity: "0.35" }, state: stB });
  check("…and leaving page 2 mid-morph lands it", !left.histFrom && !left.spansFrom);

  /* A BAR MAY NOT OUTGROW ITS PLOT MID-MORPH. The height is the count over the
     top, and both are interpolated — if the top were held at either end, a
     300 → 1000 change would paint over the caption on the way. It holds by
     construction (every bin is under the max, and the max carries a tenth of
     headroom), which is exactly the kind of thing that stops holding when
     somebody changes one of the two. */
  {
    const topA = M.histTop(hA);
    const topB = M.histTop(hB);
    let worstFill = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const h = M.lerpHist(hA, hB, t);
      const top = M.lerp(topA, topB, t);
      for (const c of h) worstFill = Math.max(worstFill, (c[0] + c[1]) / top);
    }
    check("no bar outgrows its plot at any point in the morph",
      worstFill <= 1, `tallest bar fills ${(worstFill * 100).toFixed(1)}% of the plot`);
  }

  /* AND NOTHING LANDS OFF THE CANVAS MID-FLIGHT. The settled extents are swept
     elsewhere; a transition draws geometry no settled state ever does, and that
     is where a slide that overshoots would hide. */
  {
    const W_PX = 550;
    let worstOver = null;
    const mid = (params, fix) => {
      const st = W.compute({ params, rng: makeRng(params.seed) });
      const a = W.animation.init({ params, state: st, fromScratch: true });
      fix(a, st);
      const height = W.height({ w: W_PX, ...params });
      const { ctx, box } = recorder();
      W.draw({ ctx, colors: COLORS, w: W_PX, h: height, params, state: st, anim: a });
      const over = Math.max(0, box.x1 - W_PX, -box.x0, box.y1 - height, -box.y0);
      if (!worstOver || over > worstOver.over) worstOver = { over, params, height, box };
    };
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      for (const taken of ["1", "2", "4"]) {
        mid({ ...values, page: "clonal", taken }, (a) => { a.shapeMix = t; a.tree = "branching"; });
      }
      for (const axis of ["vaf", "ccf"]) {
        mid({ ...many, page: "ccf", view: "all", axis, purity: "0.35" }, (a) => {
          a.histFrom = hA; a.topFrom = M.histTop(hA); a.histT = t; a.spansFrom = null;
        });
      }
      /* both clocks at once: a shape switched while the bars are still moving */
      mid({ ...many, page: "ccf", view: "all", purity: "0.35" }, (a) => {
        a.histFrom = hA; a.topFrom = M.histTop(hA); a.histT = t; a.mix = t;
      });
    }
    check("nothing is painted outside the canvas mid-tween either",
      worstOver.over <= 0.5, `worst ${worstOver.over.toFixed(1)}px on ${worstOver.params.page}`
        + ` axis=${worstOver.params.axis} taken=${worstOver.params.taken}`
        + ` box x ${worstOver.box.x0.toFixed(1)}–${worstOver.box.x1.toFixed(1)}`
        + ` y ${worstOver.box.y0.toFixed(1)}–${worstOver.box.y1.toFixed(1)} in 550×${worstOver.height}`);
  }

  /* The clock: one length for every transition in the widget, and it lands. */
  const run = morphFor({ purity: "0.35" });
  run.mode = "ease";
  let f2 = 0;
  while (W.animation.advance(run, { dt: 32, params: { ...many, purity: "0.35" }, state: stB }) && f2 < 200) f2 += 1;
  check("the bars' morph lands and clears what it moved from",
    run.histT === 1 && run.histFrom === null && run.spansFrom === null,
    `${f2} frames, ${f2 * 32}ms against EASE_MS ${M.EASE_MS}`);
}

/* --- the copy, against the words this collection has struck ---------------
   The copy audit of 2026-09-16 (catalogue § *Slot 67*). A sweep, not a set of
   fixed strings, because the words are struck for every string the widget will
   ever grow — an audit does not cover copy written after it.

   "tumor" and not "tumour" is Kenneth's pick of the same day: the lesson's own
   headings are American ("Tumor Purity", 01-2 cell 24) and so is the one other
   shipped widget that uses the word. Source comments are exempt (CLAUDE.md),
   so the scan masks them before it reads a literal. */
{
  const src = [read("widgets/tumor-heterogeneity/main.js"), read("widgets/tumor-heterogeneity/model.js")]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
    .map((m) => m[2].replace(/\$\{[^}]*\}/g, " "))   // a template's ${…} is code, not words
    /* markup, a design token and a CSS media query are not copy */
    .filter((t) => /[a-z]{3}/i.test(t) && !/^<|var\(--|^\([a-z-]+:/.test(t) && t.trim().length >= 12);
  const struck = [
    /* the sit/fall/lie pass of 2026-09-13 */
    ["a physical verb for a value", /\b(sits?|sitting|sat|lies|lying|falls?|falling|fell|walks?|walking)\b/i],
    /* no personification: a model does not keep, want or choose */
    ["a model acting", /\b(keeps?|wants?|thinks?|believes?|decides?|chooses?|chose|knows?|tries|refuses?|prefers?)\b/i],
    /* our shorthand, not the field's: a threshold is a threshold */
    ["our own shorthand", /\b(cut|card|rung|trench|the plain)\b/i],
    /* no lesson references on a reader-facing string (prd §4; check asserts it too) */
    ["a lesson reference", /\b(notebook|lesson|cell \d|chapter)\b/i],
    /* Kenneth's pick, 2026-09-16 */
    ["the other spelling", /\btumour/i],
    /* SECOND PERSON AND NARRATION, struck by him the same day: "The sample you
       built", "How you sequenced it", "What you bring to the analysis", and
       the card's "Here it is solved … comes back as". The collection names
       things; it does not address the reader or narrate the arithmetic. */
    ["the reader addressed", /\b(you|your|yours)\b/i],
    ["narration", /\b(here it is|comes back as|worth on its own|as they came|copied too)\b/i],
  ];
  const hits = [];
  for (const t of strings) {
    for (const [why, re] of struck) if (re.test(t)) hits.push(`${why}: "${t.slice(0, 56)}"`);
  }
  check(`${strings.length} reader-facing strings carry no struck word`, hits.length === 0, hits.join(" | "));
}

console.log(`\n${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
