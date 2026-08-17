# book-statml

Interactive widgets for teaching statistics and machine learning, built for two
NUS courses. Every widget is one HTML page and one ES module, with all of its
state in the URL.

Three widgets shipped, of a six-widget statistics arc. See
[docs/prd.md](docs/prd.md) for what this is and what it will not do,
[docs/catalogue.md](docs/catalogue.md) for what is planned and why,
[docs/design-principles.md](docs/design-principles.md) for the rules, and
[HANDOVER.md](HANDOVER.md) for the next task.

## Run it now

```bash
npm run dev
```

Then open:

- <http://localhost:8000/widgets/> — the widget gallery
- <http://localhost:8000/widgets/galton-board/> — arc 1: where the bell curve comes from
- <http://localhost:8000/widgets/clt/> — arc 2: the sampling distribution of the mean
- <http://localhost:8000/widgets/bootstrap/> — arc 3: uncertainty from one sample
- <http://localhost:8000/widgets/_lab/> — design comparisons and the fingerprint harness

There is no install step and no build step. Widgets are plain ES modules with
relative imports.

**Use `npm run dev`, not `python -m http.server`.** `scripts/serve.mjs` exists for
one reason: it sends `Cache-Control: no-store`. Widgets are ES modules loaded by
URL and browsers cache those hard, so with a plain static server you edit a core
module, reload, and the page quietly keeps running the old one — a failure that
looks exactly like a bug in your change.

## The one idea

**All widget state lives in the URL.** Everything else follows from that.

```
/w/clt/?dist=bimodal&n=30&seed=7
```

- **A URL is the entire interface.** No kernel communication, no widget protocol,
  no Jupyter extension, no helper library in any language. A lesson embeds a
  widget by pasting a link — which is why there is nothing here to install.
- **"Copy link"** in every widget makes the instructor an author: tune the figure
  until it makes the point you want, copy the link, paste it into a notebook.
  You never hand-write parameters.
- **One widget, many states.** The same widget appears in a lecture, a lesson and
  a recap at three different points in its own argument.
- A **seed** parameter makes every figure reproducible, so "everyone look at the
  third bar" works, and changing the seed becomes a teaching move rather than an
  accident.

## Layout

```
widgets/
  core/            the scaffold — everything a widget does not have to write
    tokens.css     DESIGN TOKENS. The single source of visual style.
    widget.js      defineWidget() — the contract and its five invariants
    accumulator.js createPile() — a distribution built one value at a time
    canvas.js      plot primitives + fixed mark specs
    controls.js    controls generated from the parameter spec
    params.js      URL <-> typed values; the param types and what each is for
    rng.js         seeded PRNG
    stats.js       stats helpers + the shared population registry
    env.js         theme, token bridge, iframe height reporting
  galton-board/    arc 1: index.html + main.js
  clt/             arc 2: the reference widget
  bootstrap/       arc 3: resampling one sample, with replacement
  _lab/            design comparisons + fingerprint harness; NOT deployed
  manifest.json    registry of BUILT widgets; the ONLY place a height lives
  index.html       gallery

docs/              prd, design principles, widget catalogue
scripts/serve.mjs  dev server; sends no-store (see above)
scripts/check.mjs  invariant assertions; runs inside npm run build
scripts/build.mjs  assembles _site/ (gallery redirect at /, widgets at /w/)
```

That is the whole repo. A Quarto book and a Python helper used to sit alongside
it and were deleted — the book because the ebook is assembled with MyST, the
helper because the lessons run the R kernel and a pasted URL needs no helper in
any language. [docs/prd.md](docs/prd.md) §6 records both, and git history has the
code if PHM5005 ever wants it back.

## Writing a widget

`defineWidget` supplies URL state, controls, seeded RNG, theming, legend, stat
tiles, table view, PNG export, the shareable link, and iframe height reporting.
A widget supplies data, drawing, and optionally an animation:

```js
import { defineWidget, makePlot } from "../core/index.js";

defineWidget({
  slug: "my-widget",
  title: "What this shows",
  params: { n: { type: "int", label: "Sample size n", min: 1, max: 200, default: 20 } },
  compute: ({ params, rng }) => ({ xs: draw(params.n, rng) }),
  draw: ({ ctx, colors, w, h, state, anim }) => { /* makePlot(...) */ },
  readout: ({ state, anim }) => [{ label: "Mean", value: fmt(mean(state.xs)) }],
});
```

Then add `index.html` (a 12-line copy of `widgets/clt/index.html`) and an entry
in `manifest.json`. `compute` and `draw` are kept apart so the statistics stay
testable and the presentation stays swappable.

### Animation

Add an `animation` block and core provides the drive buttons, the frame loop, and
reduced-motion handling. Name the verbs with `stepLabel` / `runLabel` — a Galton
board drops balls, it does not draw samples, and generic verbs make a widget feel
like a demo of a framework:

```js
animation: {
  init:    ({ params, state }) => ({ shown: 0, done: false }),
  advance: (anim, { dt, params, state }) => { /* mutate anim; true = more */ },
}
```

`advance` moves `anim` forward by `dt` milliseconds and returns `true` while
there is more to show. Returning `false` stops and *leaves `anim` in place*, so a
partly built picture stays on screen; set `anim.done = true` when there is
genuinely nothing left. `anim.mode` is `'run'` (play to the end) or `'step'`
(advance one logical unit and stop) — the widget decides what a unit is.

Core handles the button states: **Draw one** stays live while its own step
animates (a second click fast-forwards the unit in flight rather than swallowing
the click, so repeated clicking feels responsive) and is disabled only when
`done`. **Play** reads Play → Pause → Resume → Replay. Reduced-motion skips the
choreography and jumps to the result.

`init` receives `fromScratch`. It is `false` on load and on data changes (honour
whatever starting state the author asked for) and `true` on Replay (skip it —
someone pressing Replay wants to watch it build). Without this, Replay is a dead
button on every pre-filled figure.

#### A lead action

Some widgets have a step that happens **once**, before repeating anything is
meaningful. Declare `leadLabel` and core adds a button ahead of the others,
running `advance` with `anim.mode === 'lead'`:

```js
animation: {
  leadLabel: "Sample the population",   // pressed once
  stepLabel: "Resample your sample",    // pressed as often as you like
  ...
}
```

The widget sets `anim.leadDone` when it has happened; core disables the lead
button from then on and keeps step and run disabled until then, so the sequence
cannot be taken out of order. Only Reset brings it back.

This is pedagogy, not plumbing. In `bootstrap` the lead button greying out
permanently **is** the lesson — you cannot go back to the population for more
data — and the asymmetry between the two buttons is what stops a student
confusing "sample the population" with "resample your sample".

### Parameter types

| type | control | use when |
|---|---|---|
| `int` / `float` | slider | a number |
| `bool` | checkbox | on/off |
| `choice` | slider + tick labels | options that form a **magnitude**, so left-to-right carries meaning |
| `segmented` | connected button group | a handful of **alternative readings**, all worth seeing at rest |
| `select` | dropdown | the list is too long for either of the above |

`select`, `choice`, and `segmented` are the same data — a string key from a fixed
list — in three shapes. Pick by what the options *mean*, not by how many. A
dropdown hides that a choice exists, which is the wrong default for a widget
whose job is to be explored; `choice` slider ticks are mandatory for the same
reason (a bare slider shows a position and hides the positions).

### Data parameters vs display parameters

A parameter marked `display: true` changes only how state is *drawn*, never what
it is. Those keep the animation; everything else re-inits it from empty.

```js
params: {
  n:      { type: "int",  ... },                    // data:    resets
  theory: { type: "bool", ..., display: true },      // display: keeps the work
}
```

This distinction is load-bearing, not a nicety. Toggling an overlay that wipes
out thirty samples the student collected makes a checkbox feel like a demolition,
and it punishes exactly the comparison the checkbox exists to enable.

Some display changes still alter derived state — rescaling an axis changes the
binning — so a widget with per-bin animation state supplies `rebuild`:

```js
animation: { init, advance, rebuild(anim, { params, state }) }
```

`rebuild` re-derives everything downstream from the part of `anim` that is
genuinely invariant. For the CLT widget that is one number: how many samples the
student has drawn. Everything else (counts, running sums, axis ceiling) is
replayed from it.

Five invariants make this safe:

1. **Animation never writes to `params`.** The URL, the shareable link, and the
   controls track `params` only, so an animation interrupted by a resize or a
   slider drag cannot leave the widget lying about its own state.
2. **`compute` runs on parameter changes only, never per frame.** Animations are
   a progressive *reveal* of already-computed data, which is why Play lands
   exactly on the picture the seed promises instead of somewhere near it.
3. **A data parameter change re-inits `anim` from empty** — the data underneath
   it just changed, so a half-built picture of the old data would be a lie.
4. **A display parameter change never discards the animation.**
5. **Spoiler-free by construction.** A widget that declares an animation is
   re-inited on load, so there is no finished picture to give the answer away
   before the student has built it. To publish a *finished* figure, expose a
   parameter for it (the CLT widget's hidden `shown`) rather than special-casing
   core — that keeps the authored state in the URL and therefore shareable:
   `?shown=400`.

### Pacing is chosen, not automatic

Play runs at a speed the user picks and keeps going until it reaches the target
count. Past a threshold the per-sample choreography switches off and only the
arrivals are shown — but that is a declared property of the chosen speed, not
something the animation decides about itself mid-run. An animation that
accelerates on its own takes the pacing decision away from the person who can see
how fast the room is following.

### Layout order

`buildShell` fixes the DOM order for every widget, because reading order is the
instruction and costs nothing to get right:

```
title & question  ->  setup controls  ->  drive buttons  ->  figure
                  ->  legend  ->  readout  ->  utility (quiet)
```

Setup first means a student chooses what they are sampling from before sampling
from it. Drive buttons sit directly above the figure so the control is next to the
thing it controls, and they are styled `w-btn--primary` while utilities recede.
In `readout`, put each prediction next to its observation — adjacency is the
argument.

### House rules

1. Never hardcode a colour, size, or font — reference a token from `tokens.css`.
2. Use the **semantic** colour roles, not the numbered slots:
   `--c-empirical` (what we observed), `--c-theory` (the asymptotic result),
   `--c-highlight` (the one thing to look at), `--c-reference` (truth). The same
   blue means "simulated" in all forty widgets, and students learn it.
3. All randomness comes from the seeded `rng` passed to `compute`. Never
   `Math.random()`.
4. Every widget owes a text reading of its figure, because canvas has none.
   Usually that is `readout` (stat tiles), which during an animation should track
   the *partial* data so students watch the numbers converge. A deliberately
   qualitative widget provides `summary` instead — one sentence, used as the
   figure's accessible label — rather than inventing numbers it does not want to
   show.
5. Reuse `POPULATIONS` from `core/stats.js` so a named population behaves
   identically everywhere it appears. Populations declare a `halfWidth`, not a
   `domain`: every plotting window is centred on μ by construction, so stacked
   panels put μ in the same pixel column and one `spanningRule()` can carry it
   for the whole figure instead of a line per panel.
6. Show a countable thing when the count is small. `dotColumns()` for a handful
   of observations, `bars()` once they stop being countable — a single arrival
   should never be a two-pixel bar.
7. Don't open on the answer. If the widget has a result the student should reach,
   it starts empty and they build it.
8. Write shared geometry once. If the animation and the data agree on where
   something is, they call one named function — two copies of a formula is how the
   halves of a figure come to disagree.
9. Give any animating widget a **driven** fingerprint state. Settled states see
   only the finished figure, so they are no test of the animation at all.
10. Mark every presentation-only parameter `display: true`. An overlay toggle that
    resets the figure is a bug, not a preference.
11. Keep the control set to things that carry an idea. `Save PNG` and a bin-by-bin
   table are opt-in (`png: true`, defining `table`) and off by default — every
   extra control is one more thing to rule out before the concept gets attention.

### Design lab

`widgets/_lab/` holds throwaway comparison pages for design decisions —
`drop-paths.html` mocks up four candidate animation paths side by side with dots
at equal time intervals, so pacing is visible and not just shape. Underscore-
prefixed directories are excluded from the deployed site.

## In a teaching lesson

The notebook lessons are the host. Tune a widget until it makes your point, press
**Copy link**, and paste the URL into a markdown cell. Two mechanisms:

``` markdown
<!-- inline, if JupyterLab's sanitiser allows it — see below.
     Take the height from the widget's entry in widgets/manifest.json;
     they differ, and a short iframe clips the readout tiles. -->
<iframe src="https://<user>.github.io/book-statml/w/clt/?dist=exponential&n=30"
        width="100%" height="1040" style="border:0"></iframe>

<!-- always works -->
[Explore the sampling distribution](https://<user>.github.io/book-statml/w/clt/?dist=exponential&n=30)
```

**The link form always works** — kernel-independent, sanitiser-proof, zero code.
That is why there is no Python or R helper: nothing a helper could do that a URL
does not already do.

**The iframe form is unverified.** JupyterLab sanitises HTML in markdown cells and
may strip `<iframe>`. One test settles it: put one in one lesson and render it. A
framed widget already posts its height to the parent (`core/env.js`), so a host
that wants auto-resize needs only a short message listener.

Design a widget to work both ways: readable in a ~900 px iframe, and correct
full-screen in its own tab, since a link opens in a new one.

## Deploying

`.github/workflows/deploy.yml` runs `npm run build` — which runs the invariant
checks first — and publishes `_site/` to GitHub Pages on push to `main`. There is
no other toolchain: no Quarto, no Python, nothing to compile.

Before the first deploy:

1. Create the repo and remote. There isn't one yet.
2. Repo settings → Pages → Source: **GitHub Actions**.
3. Add the licences: **CC-BY-4.0** for prose and figures, **MIT** for code.

## Known seams

- No git remote, so nothing has ever deployed and no widget has a real URL yet.
- GitHub Pages sends `max-age=600`, so a student can get a stale widget for ten
  minutes after a deploy. The fix is content-hashed filenames, which needs a
  bundler and would end the no-build property. Not yet.
- No unit-test harness. `compute()` is pure and seeded, which is what would make
  one cheap; `npm run check` and the fingerprint harness cover the invariants and
  the rendering in the meantime.
- Widget count: 3, of a six-widget arc.
