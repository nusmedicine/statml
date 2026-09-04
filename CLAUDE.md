# CLAUDE.md

Interactive widgets for teaching statistics and machine learning. Built for two
NUS courses: **PHM5003** Applied Statistics for Precision Medicine and
**PHM5005** AI/ML for Precision Medicine.

**This repo produces widgets and nothing else** — a static site, a gallery and a
page per widget. The teaching material lives in the MyST notebook lessons at
`../jupyterbook/phm5003` and reaches a widget **by a link in a markdown cell**,
which opens it in a new tab. An `<iframe>` in a markdown cell was tested and is
stripped by JupyterLab's sanitiser — prd §4 records what works instead. A Quarto book and a Python helper used to live
here; both were deleted for having no host. See [docs/prd.md](docs/prd.md) §6
before proposing either back.

## Read these before changing anything

| file | why |
|---|---|
| [docs/prd.md](docs/prd.md) | What the project is, who it serves, what is out of scope. Read it before proposing scope — §11 lists non-goals so they can be pointed at rather than re-argued. |
| [docs/design-principles.md](docs/design-principles.md) | The rules, each with the incident that earned it. **Not optional** — most of them exist because the obvious approach failed. |
| [docs/catalogue.md](docs/catalogue.md) | What gets built next and why. The statistics arc is an agreed sequence, not a backlog to reorder. |
| [README.md](README.md) | Layout, how to write a widget, deployment. |
| [HANDOVER.md](HANDOVER.md) | Current state and the exact next task. |

## Commands

```bash
npm run dev      # dev server on :8000 — USE THIS, not python -m http.server
npm run build    # assemble _site/ (gallery at /, widgets at /widget/)
npm run check    # invariant assertions; run before every commit
```

**On the current Windows machine the dev server is `node scripts/serve.mjs 8010`**
— a Docker container in WSL owns `:8000` and the clash presents as a *working*
server from the shell and a broken one in the browser. Pass the port as an
argument, never as `PORT=…`: the shell here is PowerShell, which has no inline
env-var prefix and reads `PORT=8010` as a command name. Every widget URL is
relative, so no port is load bearing. HANDOVER's *Working on Windows* has the
diagnosis.

**Always `npm run dev`.** It exists solely to send `Cache-Control: no-store`.
Widgets are ES modules loaded by URL and browsers cache them hard enough that an
edit silently does nothing — a failure that looks exactly like a bug in your
change. This has already cost one debugging session.

## Non-negotiables

1. **Parameters are the only state of record.** The URL, the controls and the
   shareable link all track `values`. Animation state lives in `anim` and never
   writes back. Violating this makes a widget lie about itself.
2. **`compute()` is pure and seeded, and runs on parameter change only, never per
   frame.** Animations reveal already-computed data.
3. **A data parameter change resets the animation; a `display: true` parameter
   change must not.** An overlay toggle that discards the student's work is a bug.
4. **Widgets start empty.** No widget opens on its own answer. To publish a
   finished figure use `?shown=N`, which applies on first render only.
5. **Never hardcode a colour, size or font.** Everything comes from
   `widgets/core/tokens.css`, and widgets reference the *semantic* roles rather
   than the numbered series slots: `--c-empirical` (what the reader built from
   the data — a pile of draws, a fit, an embedding; audited 2026-08-27 as
   consistent across all 24 widgets under that reading), `--c-theory` (the
   claim it is checked against), `--c-smoothed`, `--c-highlight` (the one thing
   to look at right now), `--c-reference` (the fixed benchmark the moving thing is judged against — the
   truth where one exists, else the baseline; audited 2026-08-27),
   `--c-group-a` / `--c-group-b` (two arms of a comparison you decided),
   `--c-cluster-a`…`f` (groups nobody assigned), `--c-extreme` (past a
   threshold — what a p-value counts), `--c-event` / `--c-nonevent` (the
   outcome happened to this person, or did not), `--c-unknown` (not measured
   yet — never a third outcome), `--c-holdout` (data set aside, scored once),
   and `--c-prior` / `--c-posterior` (what you believed before the data, and
   after). Needing a role that does not exist is a signal to add one, not to
   reach for `--series-n`.
6. **All randomness comes from the seeded `rng` passed to `compute`.** Never
   `Math.random()`.
7. **Zero runtime dependencies, no build step for widgets.** `package.json` has no
   `dependencies` block and should stay that way. Adding a bundler is a decision
   to discuss, not a convenience to reach for.

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots in this project have produced several
phantom bugs (the automation browser generates stray pointer input that moves
sliders mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per
300 ms so animations appear frozen).

- `npm run check` asserts the invariants that are cheap to state in code.
- **Read the canvas's own text.** Wrap `CanvasRenderingContext2D.prototype.fillText`
  to collect every string the widget paints, drive it, then grep the list. It is
  the cheapest check in the repo and it catches what screenshots cannot: a `NaN`
  at one end of a slider, a caption and its note overrunning one line, and — once
  — a printed claim that was false on the very first press. Recipe in
  [HANDOVER.md](HANDOVER.md). **It sees canvas and nothing else**: widget 14
  writes its equation as MathML in the DOM, which never goes through `fillText`,
  so the sweep stopped covering it with no error and no gap in its output — just
  fewer strings in a list nobody counts. That is what the text hash below is for.
- `widgets/_lab/fingerprint.html` hashes each state **twice**: `px` over the
  canvas, and `tx` over the figure's text — the `textContent` of `.w-math`,
  `.w-legend` and `.w-readout`. A state MATCHes only if both agree, and `check`
  fails a state carrying only `px`. The rail is deliberately absent: the rail is
  what you SET and the stage is what you SEE. **Run the full suite when you touch `widgets/core/`** — that is the
  only kind of change that can reach a widget you are not looking at, and it is
  where "this cannot have affected anything" keeps turning out to be wrong.
  **It auto-runs on load; never click Run.** Doing so starts a second concurrent
  pass into the same table and the same `latest` array, which inflates the row
  count and can make "Copy new baseline" copy a half-interleaved set.

**Testing the widget you are building is manual, and should be.** Legibility,
whether a caption is honest, whether a control carries an idea — no hash catches
those. The fingerprint does the other job: proving the widgets you are *not*
looking at still render identically after a shared change. A change confined to
one `widgets/<slug>/main.js` cannot reach another widget, so it only needs its
own states rebaselined.

### Order of work, and why baselining comes last

The harness does **two** jobs and they belong at different moments:

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

So: build → cheap checks (console, programmatic reads of the numbers) → **if core
changed, one suite run to confirm the existing states still MATCH** → *show the
human and iterate* → and only then add states, prove determinism, baseline,
commit.

> *Earned:* `bootstrap` was baselined three times over. Seven states recorded,
> then the difference mode was cut and all seven were rebaselined, then it became
> two-stage and they were rebaselined again. **A baseline recorded before the
> design is settled is thrown away**, and the determinism runs are the slowest
> thing in the loop. Reviewing a figure is what changes it; hashing it is what
> freezes it, and freezing before review is backwards.

`npm run check` fails a manifest widget with no fingerprint states, which pushes
the other way. The escape hatch is a placeholder — but it needs **both** hashes,
`"px": "0", "tx": "0"`, because `check` fails a state carrying only one. That
rule exists so a state cannot silently cover the picture and not the words.

`check` also fails a non-draft widget that declares `animation` without a driven
state, or `regions` without a **hit-driven** one. A `set` state reaches its
parameter through the DOM control and routes around the region map entirely, so
it gives a widget's hit-test no coverage at all — and that geometry is exactly
what no pixel hash can see, since the picture is identical whether a target sits
where it is drawn or six columns away.

It holds **three kinds of state**, and the distinction is load-bearing:

| kind | how | sees |
|---|---|---|
| **settled** | `?…&shown=N` — figure fully built, nothing moving | the finished figure |
| **driven** | `drive: { click, frames, dt }` — harness supplies the frame clock | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

A suite of settled states alone is **no test of the animation at all**. That gap
let a coordinate-system change put every falling ball six columns off-centre while
all eight settled states still matched. `check.mjs` now fails any widget that
declares an `animation` without at least one driven state.

`before` exists because **three separate shipped bugs were mid-animation states**,
and the last needed *two* actions to reach: a step left in flight when a
non-choreographing speed took over froze a whole panel. Drive buttons are found
by `data-key`, never by position — see principle 5.7.

If a fingerprint state legitimately changes, regenerate the baseline **in the same
commit** as the change, so the diff records that the rendering moved. Before
baselining a new driven state, confirm it is identical across three runs — a flaky
check is worse than none.

**Then run the suite once more and confirm every state reads MATCH — principle
5.10.** "Copy new baseline" writes whatever `latest` holds, and nothing checks
that it matches what the widget draws; `check` validates the file's shape, not
its contents. Widget 42 shipped 9 hashes it had never produced, and they read as
somebody else's regression for two days. If a state does fail and no diff
explains it, serve the baseline's own commit in a detached worktree and render
there: a value that will not reproduce from the tree that recorded it was wrong
when written, not drifted.

## Where things live

```
widgets/core/       the scaffold — everything a widget does not have to write
  tokens.css        DESIGN TOKENS. Single source of visual style.
  widget.js         defineWidget() — the contract, and its three invariants
  accumulator.js    createPile() — a distribution built one value at a time
  canvas.js         plot primitives; mark specs are fixed here
  controls.js       controls generated from the parameter spec
  params.js         URL <-> typed values; param types and what each is for
  rng.js  stats.js  env.js
widgets/<slug>/     one widget: index.html (a stub) + main.js
widgets/_lab/       design comparisons and the fingerprint harness; NOT deployed
widgets/index.html  redirect stub, so a trimmed /widget/ URL reaches the gallery
widgets/manifest.json  registry of BUILT widgets; gallery cards, and nothing else
index.html          THE GALLERY — the landing page, deployed at /; SHIPPED only
lab/index.html      the drafts, deployed at /lab/; NOT linked from the gallery
scripts/site.mjs    the one place the published `widget` namespace is named
docs/               prd, design principles, catalogue
```

## Things that will bite you

- **The site is live at <https://nusmedicine.github.io/statml/>**, deployed from
  `main` by `.github/workflows/deploy.yml`; a widget is
  `…/statml/widget/<slug>/`. **Every push to `main` publishes**, with no staging
  step — which is what makes `npm run check` before committing load-bearing
  rather than tidy.
- **The repo is public and carries no licence**, which is all-rights-reserved by
  default. Deliberate while the arc is unfinished — prd §8 has the eventual
  CC-BY-4.0/MIT decision and the trigger for adding the files.
- **The deployed site is served from a `/statml/` subpath**, so every path in a
  deployed file must be relative. An absolute one works in dev and 404s in
  production; `npm run check` fails on it.
- **`widget` (singular) is the published namespace, `widgets/` is the source
  directory.** `scripts/site.mjs` is the only place that name is written —
  build.mjs and serve.mjs import it, and `check` asserts the root `index.html`
  agrees, because it cannot import anything.
- **GitHub Pages sends `max-age=600`**, so students can get a stale widget for ten
  minutes after a deploy.
- **The repo is inside Dropbox.** Avoid long-running writes; Dropbox can race with
  `.git`.
- **A widget's height is recorded nowhere.** It lives only in `defineWidget`, and
  it need not be a number: `bayesian` makes it a function of the parameters, and
  `linear-regularization` a function of the **width**, because its two panels
  have to stay square and wider costs taller. It
  used to sit in three files with `npm run check` guarding the drift, then in
  one that nothing read — where it drifted silently until eight of nine were
  190–310px wrong. Adding a copy back needs a **reader** for it first, not a
  use for it later. README's iframe recipe says how to measure one.

## Style

Match the surrounding code. Comments explain *why*, especially where a simpler
approach was tried and failed — several modules carry that history and it is the
most valuable thing in them. Prose in widgets and chapters is teaching material:
plain, specific, no filler.

**That register applies to comments too — principle 5.9.** No colloquialisms or
folksy phrasing, no editorializing, no lesson/cell/notebook references, and no
project narrative (attributions, dates, round numbers; `git log` holds those).
Where a measurement exists, give the number rather than an image for it. The
history of what failed stays, at whatever length it takes.
