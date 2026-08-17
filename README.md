# book-statml

Interactive widgets for teaching statistics and machine learning, plus the book
that embeds them and a Python helper that drops them into a live JupyterLab
notebook.

**Phase 0** — the pipeline, end to end, with one reference widget.

## Run it now

```bash
npm run dev
```

Then open:

- <http://localhost:8000/widgets/> — the widget gallery
- <http://localhost:8000/widgets/clt/> — the reference widget
- <http://localhost:8000/widgets/_lab/> — design comparisons

There is no install step and no build step. Widgets are plain ES modules with
relative imports.

**Use `npm run dev`, not `python -m http.server`.** `scripts/serve.mjs` exists for
one reason: it sends `Cache-Control: no-store`. Widgets are ES modules loaded by
URL and browsers cache those hard, so with a plain static server you edit a core
module, reload, and the page quietly keeps running the old one — a failure that
looks exactly like a bug in your change. The same trap catches students on the
`sw.use_local()` path.

## The one idea

**All widget state lives in the URL.** Everything else follows from that.

```
/w/clt/?dist=bimodal&n=30&seed=7
```

- The **Python helper** is a query-string builder, nothing more. No kernel
  communication, no widget protocol, no Jupyter extension.
- **"Copy link"** in every widget makes the instructor an author: tune the figure
  until it makes the point you want, copy the link, paste it into a notebook.
  You never hand-write parameters.
- The **book and the notebook** embed the same widget at different states.
- A **seed** parameter makes every figure reproducible, so "everyone look at the
  third bar" works, and changing the seed becomes a teaching move rather than an
  accident.

## Layout

```
widgets/
  core/            the scaffold — everything a widget does not have to write
    tokens.css     DESIGN TOKENS. The single source of visual style.
    widget.js      defineWidget() — the contract
    canvas.js      plot primitives + fixed mark specs
    controls.js    controls generated from the parameter spec
    params.js      URL <-> typed values
    rng.js         seeded PRNG
    stats.js       stats helpers + the shared population registry
    env.js         theme, token bridge, iframe height reporting
  clt/             the reference widget: index.html + main.js
  manifest.json    the widget catalogue
  index.html       gallery

book/              Quarto book; {{< widget slug k=v >}} shortcode
python/            statml_widgets — show(), show_url(), url()
notebooks/         example teaching notebook
scripts/build.mjs  assembles _site/ (book at /, widgets at /w/)
```

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

Add an `animation` block and core provides `Draw one` / `Run` (a play/pause
toggle), the frame loop, and reduced-motion handling:

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
4. Every widget ships a `readout` — it is the accessible reading of the figure,
   not decoration. During an animation it should track the *partial* data, so
   students watch the numbers converge as the picture fills in.
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
8. Mark every presentation-only parameter `display: true`. An overlay toggle that
   resets the figure is a bug, not a preference.
9. Keep the control set to things that carry an idea. `Save PNG` and a bin-by-bin
   table are opt-in (`png: true`, defining `table`) and off by default — every
   extra control is one more thing to rule out before the concept gets attention.

### Design lab

`widgets/_lab/` holds throwaway comparison pages for design decisions —
`drop-paths.html` mocks up four candidate animation paths side by side with dots
at equal time intervals, so pacing is visible and not just shape. Underscore-
prefixed directories are excluded from the deployed site.

## In a teaching notebook

```python
import sys; sys.path.insert(0, "python")
import statml_widgets as sw

sw.use_local()                        # or sw.use_pages("your-github-user")
sw.show("clt", dist="exponential", n=30)
```

Or paste a link straight from a widget's *Copy link* button:

```python
sw.show_url("http://localhost:8000/widgets/clt/?dist=bimodal&n=30")
```

Notebooks get an explicit iframe height; the book uses a `postMessage`
auto-resize instead. That split is deliberate — we control the book's page and
can install a listener, and we cannot rely on doing so in a notebook.

## In the book

```bash
brew install quarto     # not installed yet
npm run book            # render to book/_book
npm run build           # assemble _site/ (book at /, widgets at /w/)
```

In a chapter:

``` markdown
{{{< widget clt dist=exponential n=5 >}}}
```

Same shape as `show("clt", dist="exponential", n=5)`, on purpose.

## Deploying

`.github/workflows/deploy.yml` renders the book, assembles `_site/`, and
publishes to GitHub Pages on push to `main`. Two things to do first:

1. Repo settings → Pages → Source: **GitHub Actions**.
2. Set the real Pages origin in `python/statml_widgets/__init__.py`
   (`DEFAULT_BASE`), or have notebooks call `sw.use_pages("your-github-user")`.

## Known seams

- `HEIGHTS` in the Python helper mirrors `manifest.json` by hand. Phase 1 should
  generate it at build time.
- No test harness yet. `compute()` is pure and seeded, which is what makes one
  worth adding.
- Widget count: 1.
