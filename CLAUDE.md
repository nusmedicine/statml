# CLAUDE.md

Interactive widgets for teaching statistics and machine learning, plus a Quarto
book and a JupyterLab helper that embed them. Built for two NUS courses:
**PHM5003** Applied Statistics for Precision Medicine and **PHM5005** AI/ML for
Precision Medicine.

## Read these before changing anything

| file | why |
|---|---|
| [docs/design-principles.md](docs/design-principles.md) | The rules, each with the incident that earned it. **Not optional** — most of them exist because the obvious approach failed. |
| [docs/catalogue.md](docs/catalogue.md) | What gets built next and why. The statistics arc is an agreed sequence, not a backlog to reorder. |
| [README.md](README.md) | Layout, how to write a widget, deployment. |
| [HANDOVER.md](HANDOVER.md) | Current state and the exact next task. |

## Commands

```bash
npm run dev      # dev server on :8000 — USE THIS, not python -m http.server
npm run build    # assemble _site/ (book at /, widgets at /w/)
npm run book     # quarto render (Quarto is NOT installed on this machine)
npm run check    # invariant assertions; run before every commit
```

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
   `widgets/core/tokens.css`, and widgets reference the *semantic* roles
   (`--c-empirical`, `--c-theory`, `--c-smoothed`, `--c-highlight`,
   `--c-reference`) rather than the numbered series slots.
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
- `widgets/_lab/fingerprint.html` hashes each widget's canvas against a stored
  baseline. **Run it before and after any refactor.** Pixel identity is the only
  honest proof that a refactor changed nothing; the accumulator extraction was
  verified this way.

It holds **two kinds of state**, and the distinction is load-bearing:

| kind | how | sees |
|---|---|---|
| **settled** | `?…&shown=N` — figure fully built, nothing moving | the finished figure |
| **driven** | `drive: { click, frames, dt }` — harness supplies the frame clock | anything drawn mid-motion |

A suite of settled states alone is **no test of the animation at all**. That gap
let a coordinate-system change put every falling ball six columns off-centre while
all eight settled states still matched. `check.mjs` now fails any widget that
declares an `animation` without at least one driven state.

If a fingerprint state legitimately changes, regenerate the baseline **in the same
commit** as the change, so the diff records that the rendering moved. Before
baselining a new driven state, confirm it is identical across three runs — a flaky
check is worse than none.

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
widgets/<slug>/     one widget: index.html (12 lines) + main.js
widgets/_lab/       design comparisons and the fingerprint harness; NOT deployed
book/               Quarto book, {{< widget slug k=v >}} shortcode
python/             statml_widgets — show(), show_url(), url()
docs/               design principles and the catalogue
```

## Things that will bite you

- **Quarto is not installed.** `book/` is written but has never been rendered.
  The Lua shortcode parses (`luac -p`) but its registration is unverified.
- **`HEIGHTS` in `python/statml_widgets/__init__.py` mirrors `manifest.json` by
  hand.** Update both, plus the height in `book/assets/widget.lua`.
- **GitHub Pages sends `max-age=600`**, so students can get a stale widget for ten
  minutes after a deploy.
- **`DEFAULT_BASE` in the Python helper is a placeholder.** There is no git remote
  yet.
- **The repo is inside Dropbox.** Avoid long-running writes; Dropbox can race with
  `.git`.

## Style

Match the surrounding code. Comments explain *why*, especially where a simpler
approach was tried and failed — several modules carry that history and it is the
most valuable thing in them. Prose in widgets and chapters is teaching material:
plain, specific, no filler.
