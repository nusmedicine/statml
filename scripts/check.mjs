#!/usr/bin/env node
/* ============================================================================
   Invariant assertions. Run before every commit: `npm run check`.

   These are the facts that are cheap to state in code. Screenshots are for
   judgement — is this legible, is this pleasing — and assertions are for facts;
   this project has already produced several phantom bugs by using screenshots for
   the second job. Rendering equivalence is checked separately and visually, by
   widgets/_lab/fingerprint.html.

   Every check here exists because getting it wrong has been possible:
     - an off-centre plotting window silently broke the shared mu rule
     - a binned array parked the coin flip's second spike off the panel
     - three files hold the same widget height and drifted
   ========================================================================= */

import { readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const notes = [];

const fail = (msg) => problems.push(msg);
const ok = (msg) => notes.push(msg);
const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

/* --- populations: mu-centred windows, valid discrete masses -------------- */

const { POPULATIONS } = await import(join(root, "widgets/core/stats.js"));

for (const [key, p] of Object.entries(POPULATIONS)) {
  const [lo, hi] = p.domain;

  // Both panels of a stacked figure put mu in the same pixel column only because
  // every window is mu-centred by construction. One off-centre window silently
  // breaks the single spanning rule.
  if (Math.abs((lo + hi) / 2 - p.mean) > 1e-12) {
    fail(`population "${key}": window [${lo}, ${hi}] is not centred on mu=${p.mean}`);
  }

  if (!p.pdf && !p.masses) fail(`population "${key}": has neither a pdf nor masses`);
  if (!(p.sd > 0)) fail(`population "${key}": sd must be positive, got ${p.sd}`);

  if (p.masses) {
    const total = p.masses.reduce((s, m) => s + m[1], 0);
    const mu = p.masses.reduce((s, m) => s + m[0] * m[1], 0);
    if (Math.abs(total - 1) > 1e-12) {
      fail(`population "${key}": masses sum to ${total}, not 1`);
    }
    if (Math.abs(mu - p.mean) > 1e-12) {
      fail(`population "${key}": masses imply mean ${mu}, declared ${p.mean}`);
    }
    // The bug this catches: expressing "0 and 1" as a binned array put the second
    // spike at x = 2, off the panel, and it survived several iterations.
    for (const [x] of p.masses) {
      if (x < lo || x > hi) fail(`population "${key}": mass at ${x} falls outside the plotted window`);
    }
  }
}
ok(`${Object.keys(POPULATIONS).length} populations: mu-centred, masses valid`);

/* --- the pile: seeded, reproducible, monotone axis ---------------------- */

const { createPile } = await import(join(root, "widgets/core/accumulator.js"));
const { makeRng } = await import(join(root, "widgets/core/rng.js"));

{
  const build = () => {
    const pile = createPile({ bins: 20, lo: -0.5, width: 1 });
    const rng = makeRng(42);
    for (let i = 0; i < 200; i += 1) pile.push(Math.round(rng.normal(9, 3)));
    return pile;
  };
  const a = build();
  const b = build();
  if (a.counts.join(",") !== b.counts.join(",")) {
    fail("pile: same seed produced different counts — reproducibility is broken");
  }
  if (Math.abs(a.mean - b.mean) > 0 || Math.abs(a.sd - b.sd) > 0) {
    fail("pile: same seed produced different statistics");
  }

  // The axis ratchets upward only; a shrinking axis hides convergence.
  const pile = createPile({ bins: 20, lo: -0.5, width: 1 });
  const rng = makeRng(7);
  let prev = pile.yMax;
  for (let i = 0; i < 500; i += 1) {
    pile.push(Math.round(rng.normal(9, 3)));
    if (pile.yMax < prev) fail(`pile: yMax shrank from ${prev} to ${pile.yMax}`);
    prev = pile.yMax;
  }

  // rebuild() must land exactly where a fresh sequence of pushes lands, or a
  // display-parameter change would quietly alter the student's picture.
  const values = [];
  const r2 = makeRng(11);
  for (let i = 0; i < 60; i += 1) values.push(Math.round(r2.normal(9, 3)));
  const direct = createPile({ bins: 20, lo: -0.5, width: 1 });
  for (const v of values) direct.push(v);
  const rebuilt = createPile({ bins: 20, lo: -0.5, width: 1 });
  rebuilt.rebuild(values);
  if (direct.counts.join(",") !== rebuilt.counts.join(",") || direct.yMax !== rebuilt.yMax) {
    fail("pile: rebuild() disagrees with an equivalent sequence of pushes");
  }
  ok("pile: seeded reproducibly, axis monotone, rebuild matches push sequence");
}

/* --- rng: seeded, deterministic ---------------------------------------- */

{
  const seq = (seed) => Array.from({ length: 8 }, () => makeRng(seed).next());
  if (makeRng(3).next() === makeRng(4).next()) fail("rng: different seeds gave the same first draw");
  if (seq(3).join() !== seq(3).join()) fail("rng: same seed is not reproducible");
  const rng = makeRng(1);
  const draws = Array.from({ length: 5000 }, () => rng.next());
  if (Math.min(...draws) < 0 || Math.max(...draws) >= 1) fail("rng: next() left [0, 1)");
  ok("rng: seeded, reproducible, in range");
}

/* --- manifest agrees with what is on disk and with the other copies ---- */

const manifest = JSON.parse(await readFile(join(root, "widgets/manifest.json"), "utf8"));
const pySrc = await readFile(join(root, "python/statml_widgets/__init__.py"), "utf8");
const luaSrc = await readFile(join(root, "book/assets/widget.lua"), "utf8");

for (const w of manifest.widgets) {
  for (const field of ["slug", "title", "blurb", "height", "status"]) {
    if (!(field in w)) fail(`manifest "${w.slug ?? "?"}": missing ${field}`);
  }
  if (!(await exists(join(root, "widgets", w.slug, "index.html")))) {
    fail(`manifest "${w.slug}": no widgets/${w.slug}/index.html`);
  }
  if (!(await exists(join(root, "widgets", w.slug, "main.js")))) {
    fail(`manifest "${w.slug}": no widgets/${w.slug}/main.js`);
  }
  // Until the manifest is generated, three files carry each height and drift.
  if (!new RegExp(`"${w.slug}":\\s*${w.height}\\b`).test(pySrc)) {
    fail(`height drift: "${w.slug}" is ${w.height} in the manifest but not in python HEIGHTS`);
  }
}
ok(`${manifest.widgets.length} widgets: files present, heights agree with python HEIGHTS`);

if (!/height:\d+px/.test(luaSrc)) {
  fail("book/assets/widget.lua: no iframe height found");
} else {
  const luaHeight = Number(luaSrc.match(/height:(\d+)px/)[1]);
  const tallest = Math.max(...manifest.widgets.map((w) => w.height));
  if (luaHeight < tallest) {
    fail(`book/assets/widget.lua height ${luaHeight}px is shorter than the tallest widget (${tallest}px)`);
  }
  ok(`book shortcode height ${luaHeight}px clears the tallest widget (${tallest}px)`);
}

/* --- fingerprint baseline is usable ------------------------------------ */

const baseline = JSON.parse(
  await readFile(join(root, "widgets/_lab/fingerprint-baseline.json"), "utf8")
);
const slugs = new Set(manifest.widgets.map((w) => w.slug));
const covered = new Set();
for (const s of baseline.states) {
  if (!slugs.has(s.slug)) fail(`fingerprint baseline: unknown widget "${s.slug}"`);
  // A state that animates hashes differently every run, so the check would be
  // noise rather than a signal.
  if (!/[?&]shown=/.test(s.state)) {
    fail(`fingerprint baseline: state "${s.state}" has no shown=, so it is not static`);
  }
  if (!s.px) fail(`fingerprint baseline: "${s.slug}${s.state}" has no recorded hash`);
  covered.add(s.slug);
}
for (const slug of slugs) {
  if (!covered.has(slug)) fail(`fingerprint baseline: widget "${slug}" has no states`);
}
ok(`fingerprint baseline: ${baseline.states.length} static states covering ${covered.size} widget(s)`);

/* --- no runtime dependencies ------------------------------------------- */

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
  fail(`package.json has runtime dependencies: ${Object.keys(pkg.dependencies).join(", ")}`);
}
ok("no runtime dependencies");

/* --- report ------------------------------------------------------------ */

for (const n of notes) console.log(`  ok   ${n}`);
if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`  FAIL ${p}`);
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`\nall checks passed`);
