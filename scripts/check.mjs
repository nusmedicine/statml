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

   A third check guarded widget heights, which used to live in three files
   (manifest.json, a Python HEIGHTS dict, a Lua shortcode). Deleting both
   embedders left one copy, so the check had nothing left to compare and went
   with them. The surviving copy has now gone too: nothing consumed it, and by
   the time anyone measured, eight of the nine were 190-310px wrong — a number
   with no reader does not stay right. Recorded because "we removed a check"
   should never be silent.
   ========================================================================= */

import { readFile, readdir, access } from "node:fs/promises";
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

/* --- manifest agrees with what is on disk -------------------------------- */

const manifest = JSON.parse(await readFile(join(root, "widgets/manifest.json"), "utf8"));

for (const w of manifest.widgets) {
  for (const field of ["slug", "title", "blurb", "status"]) {
    if (!(field in w)) fail(`manifest "${w.slug ?? "?"}": missing ${field}`);
  }
  if (!(await exists(join(root, "widgets", w.slug, "index.html")))) {
    fail(`manifest "${w.slug}": no widgets/${w.slug}/index.html`);
  }
  if (!(await exists(join(root, "widgets", w.slug, "main.js")))) {
    fail(`manifest "${w.slug}": no widgets/${w.slug}/main.js`);
  }
  /* A BLURB IS A CHOOSER, NOT AN ABSTRACT — one sentence saying which widget
     this is, so a reader can tell whether it is the one they want. The full
     argument is in the widget, and the full description in docs/catalogue.md.

     Capped because it drifted. The first four were written at 63-70 characters
     and the later ones reached 423 — four sentences — and the gallery is a
     three-column grid whose ROW HEIGHT IS SET BY ITS TALLEST CARD, so one long
     blurb inflates two neighbours that did nothing wrong. Half the landing page
     was one widget's paragraph. 120 leaves room for a second short clause where
     the idea is genuinely a pair, which is what `power-and-error` needs. */
  if (w.blurb.length > 120) {
    fail(`manifest "${w.slug}": blurb is ${w.blurb.length} chars — cap is 120, and the grid row grows to fit the longest`);
  }
}
ok(`${manifest.widgets.length} widgets: card fields present, blurbs within 120, files on disk`);

/* A widget's title now lives in three files — manifest.json (the gallery card),
   main.js (the <h1> and document.title) and index.html (the static <title> shown
   before JS runs). They were deliberately allowed to differ once, the card naming
   the topic and the page asking the question, and that split was cut: a student
   clicking "Hypothesis Testing" should land on a page that says so. Three copies
   of one string is the shape that produced the three-places widget heights, so it
   gets the same treatment they did. */
for (const w of manifest.widgets) {
  const main = await readFile(join(root, "widgets", w.slug, "main.js"), "utf8");
  const html = await readFile(join(root, "widgets", w.slug, "index.html"), "utf8");
  const page = main.match(/^\s*title:\s*"([^"]*)"/m)?.[1];
  const stat = html.match(/<title>([^<·]*)·/)?.[1]?.trim();

  if (page !== w.title) {
    fail(`"${w.slug}": manifest card "${w.title}" but main.js title "${page}" — the card is what a student clicked`);
  }
  if (stat !== w.title) {
    fail(`"${w.slug}": manifest card "${w.title}" but index.html <title> "${stat}"`);
  }

  /* Status decides two independent things — whether the gallery lists it, and
     whether the page wears a draft bar — and they are read from different files.
     A draft recorded as shipped is exactly the failure that puts unfinished
     teaching material on the front page. */
  if (!["shipped", "draft"].includes(w.status)) {
    fail(`"${w.slug}": status "${w.status}" is neither "shipped" nor "draft"`);
  }
  const declared = main.match(/^\s*status:\s*"([^"]*)"/m)?.[1] ?? "shipped";
  if (declared !== w.status) {
    fail(`"${w.slug}": manifest status "${w.status}" but main.js declares "${declared}" — the gallery and the draft bar would disagree`);
  }
}
ok(`${manifest.widgets.length} widgets: card, <h1> and <title> agree`);

/* --- fingerprint baseline is usable ------------------------------------ */

const baseline = JSON.parse(
  await readFile(join(root, "widgets/_lab/fingerprint-baseline.json"), "utf8")
);
const slugs = new Set(manifest.widgets.map((w) => w.slug));
const settled = new Set();
const driven = new Set();

/* Which widgets BUILD THEMSELVES — those declaring a `shown` parameter, the
   authored head start that says how far in to open. Only those can be caught
   part-built by a settled state, so only those are made to pin it. */
const buildsItself = new Set();
for (const w of manifest.widgets) {
  const main = await readFile(join(root, "widgets", w.slug, "main.js"), "utf8");
  if (/^\s*shown:\s*\{/m.test(main)) buildsItself.add(w.slug);
}

for (const s of baseline.states) {
  if (!slugs.has(s.slug)) fail(`fingerprint baseline: unknown widget "${s.slug}"`);
  if (!s.px) fail(`fingerprint baseline: "${s.slug}${s.state}" has no recorded hash`);
  /* The TEXT hash, beside the pixel one. The figure stopped being entirely
     canvas when widget 14 wrote its equation as MathML, and a state carrying
     only `px` would silently cover the picture and not the words. */
  if (!s.tx) fail(`fingerprint baseline: "${s.slug}${s.state}" has no recorded text hash`);

  if (s.drive) {
    // Driven states are reproducible because the harness supplies the clock, so
    // they must NOT also be pre-filled — the point is to render mid-motion.
    if (!(s.drive.frames > 0)) {
      fail(`fingerprint baseline: driven state "${s.state}" needs drive.frames > 0`);
    }
    if (/[?&]shown=/.test(s.state)) {
      fail(`fingerprint baseline: driven state "${s.state}" also sets shown=, so nothing is in flight`);
    }
    driven.add(s.slug);
  } else {
    /* A settled state left animating would hash differently every run, and
       `shown=` is what pins a self-building figure to a definite point.

       BUT NOT EVERY WIDGET BUILDS ITSELF. One that declares no `shown` has no
       build-up to be partway through: `render()` recomputes, resets the anim and
       paints, and starts no frame loop, so its figure is a pure function of the
       URL and the URL alone settles it. Requiring `shown=` of such a widget
       forces a meaningless parameter into the state string purely to satisfy a
       regex — which is not a check passing, it is a check being worked around.
       Widget 12 declines `shown` deliberately (every state is four counts and
       two toggles) and would have had to fake one. */
    if (!/[?&]shown=/.test(s.state) && buildsItself.has(s.slug)) {
      fail(`fingerprint baseline: "${s.state}" has neither shown= nor drive, and "${s.slug}" declares a shown parameter — so it is not pinned`);
    }
    settled.add(s.slug);
  }
}

/* Drafts are exempt. HANDOVER's order-of-work is explicit that a baseline
   recorded before the design is settled gets thrown away — bootstrap was
   baselined three times over — and a draft is by definition unsettled. The
   requirement returns on promotion, which is what makes promotion a real gate. */
const needsStates = new Set(
  manifest.widgets.filter((w) => w.status !== "draft").map((w) => w.slug)
);

for (const slug of needsStates) {
  if (!settled.has(slug)) fail(`fingerprint baseline: widget "${slug}" has no settled states`);
}

/* Every widget with an animation needs at least one DRIVEN state. Settled states
   are blind to anything drawn only while something is moving: a coordinate-system
   change once put every falling ball six columns off-centre and all eight settled
   states still matched. Enforcing this is the fix for that, not a nicety. */
for (const w of manifest.widgets) {
  if (!needsStates.has(w.slug)) continue;
  const main = await readFile(join(root, "widgets", w.slug, "main.js"), "utf8");
  if (/\banimation\s*:/.test(main) && !driven.has(w.slug)) {
    fail(
      `fingerprint baseline: widget "${w.slug}" declares an animation but has no driven state — ` +
        `its mid-animation rendering is untested`
    );
  }
}

ok(
  `fingerprint baseline: ${baseline.states.length} states — ` +
    `${settled.size} widget(s) with settled coverage, ${driven.size} with driven coverage`
);

/* --- the deployed site: one name for /widget/, and no absolute paths ----- */

const { PUBLIC_DIR } = await import(join(root, "scripts/site.mjs"));

{
  // build.mjs and serve.mjs import PUBLIC_DIR. index.html cannot — it is served
  // verbatim and templating it would mean a build step — so it is checked here
  // instead. Getting it wrong empties the gallery, in production only.
  const landing = await readFile(join(root, "index.html"), "utf8");
  if (!landing.includes(`./${PUBLIC_DIR}/manifest.json`)) {
    fail(`index.html: does not fetch ./${PUBLIC_DIR}/manifest.json — the gallery would render empty`);
  }
  if (!landing.includes(`./${PUBLIC_DIR}/`)) {
    fail(`index.html: no ./${PUBLIC_DIR}/ links, but scripts/site.mjs deploys widgets there`);
  }
  if (/["'`]\.\/widgets\//.test(landing)) {
    fail(`index.html: links ./widgets/, the SOURCE directory — deployed it is ./${PUBLIC_DIR}/`);
  }
  /* The whole point of the draft status. Lose this filter and unfinished
     teaching material appears on the front door of a public site, with nothing
     else in this file noticing. */
  if (!/\.filter\([\s\S]{0,60}?status\s*===\s*"shipped"/.test(landing)) {
    fail(`index.html: does not filter to status === "shipped" — a draft would show on the landing page`);
  }
  if (/href="\.?\.?\/?lab\/"/.test(landing)) {
    fail(`index.html: links /lab/ — the landing page deliberately does not, see lab/index.html`);
  }

  const lab = await readFile(join(root, "lab", "index.html"), "utf8");
  if (!lab.includes(`../${PUBLIC_DIR}/manifest.json`)) {
    fail(`lab/index.html: does not fetch ../${PUBLIC_DIR}/manifest.json — it sits a level deeper than the gallery`);
  }
  if (!/status\s*===\s*"draft"/.test(lab)) {
    fail(`lab/index.html: does not filter to status === "draft"`);
  }
  ok(`landing lists shipped only; lab/ lists drafts and is unlinked from it`);
}

{
  /* The site is served from a /statml/ subpath, so a leading slash resolves to
     the domain root: it works in dev and 404s in production, and nothing catches
     it before a deploy. This became possible the moment the site stopped living
     at a domain root, which is why the check arrives with the move. */
  const ABSOLUTE = [
    [/\b(?:href|src)\s*=\s*["']\/(?!\/)/, "href/src"],
    [/\bfrom\s*["']\/(?!\/)/, "import"],
    [/\bimport\s*\(\s*["']\/(?!\/)/, "dynamic import"],
    [/\bfetch\s*\(\s*["']\/(?!\/)/, "fetch"],
    [/\burl\(\s*["']?\/(?!\/)/, "css url()"],
  ];

  // Same filter as build.mjs: a path segment starting with _ is not deployed.
  const deployed = [
    ["index.html", join(root, "index.html")],
    ["lab/index.html", join(root, "lab", "index.html")],
  ];
  const walk = async (dir, rel) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith("_")) continue;
      const abs = join(dir, e.name);
      const path = `${rel}/${e.name}`;
      if (e.isDirectory()) await walk(abs, path);
      else if (/\.(html|js|css)$/.test(e.name)) deployed.push([path, abs]);
    }
  };
  await walk(join(root, "widgets"), "widgets");

  for (const [path, abs] of deployed) {
    const text = await readFile(abs, "utf8");
    for (const [re, what] of ABSOLUTE) {
      const m = text.match(re);
      if (m) {
        fail(
          `${path}: absolute ${what} path ${JSON.stringify(m[0])} — the site is served ` +
            `from /statml/, so every deployed path must be relative`
        );
      }
    }
  }
  ok(`${deployed.length} deployed files: every path relative`);
}

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
