---
name: new-widget
description: Build or modify a teaching widget in this collection (widgets/<slug>/main.js). Use when adding a widget from docs/catalogue.md, changing an existing widget's parameters, animation, overlays or layout, or extending widgets/core. Covers the defineWidget contract, the data-vs-display parameter split, the pile accumulator, and how to verify a change without trusting screenshots.
---

# Building a widget

Read [docs/design-principles.md](../../../docs/design-principles.md) first if you
have not. Most rules below exist because the obvious approach was tried and failed;
the principles doc carries the incident for each.

## Before writing code

1. **Find the entry in `docs/catalogue.md`.** It names the misconception the widget
   targets. If it does not, the widget is decoration and should not be built —
   except for a *prerequisite* widget, which must name the widget it is a
   prerequisite for (`galton-board` names `clt`).
2. **Read the neighbouring widget in the arc.** The statistics widgets are one
   continuous argument; a new one should reuse the previous one's motion so the
   student recognises it.
3. **Mock up anything you would otherwise argue about.** Put a comparison page in
   `widgets/_lab/` — see `drop-paths.html` and `controls.html`. Both changed a
   decision and took under an hour. `_lab/` is excluded from the deployed site.

## The contract

```js
import { defineWidget, makePlot, createPile, fmt } from "../core/index.js";

defineWidget({
  slug: "my-widget",
  title: "What this shows",          // a claim, not a topic label
  subtitle: "…",                     // 2–3 lines; the layout does the rest
  layout: "side",                    // controls in a left rail — see below
  height: 430,                       // canvas height, not page height
                                     // …or ({ params }) => number

  params: { /* see below */ },
  legend: [{ token: "empirical", label: "…", mark: "bar" }],
                                     // …or ({ params }) => entries, for a
                                     // tabbed widget whose marks change with
                                     // the tab — the legend must match the
                                     // graph (lm-interaction, 2026-08-29)

  compute: ({ params, rng }) => state,                       // pure, seeded
  animation: { stepLabel, stepTitle, runLabel, init, advance, rebuild },
  regions: ({ w, h, params, state }) => [{ x, y, w, h, set: { param: value } }],
  draw: ({ ctx, colors, w, h, params, state, anim }) => {},
  readout: ({ params, state, anim }) => [{ label, value, note }],
});
```

### `layout: "side"` — use it

All fourteen widgets do. The controls sit in a left rail beside the figure instead
of above it, stacking again below 880px. Measured on the real widgets in
`_lab/side-layout.html`: it saves 247–330px each and takes four of six from
over-a-screen to fitting, and **the canvas gets WIDER doing it** (694 → 770), so
the figure gains room while the page shrinks. Principle 3.4a.

Two consequences worth knowing before you fight them:

- The **drive row is a block** in the rail — stacked full-width rows, never a
  wrapping line. Chosen because the wrapping alternative failed 5 of 5
  hypothetical future widgets (`_lab/drive-rail.html`). You get this for free;
  do not re-flow it. Principle 3.4e.
- The **legend and readout go with the figure**, in the right column. The rail is
  what you SET, the stage is what you SEE.

### A second stage goes behind a `gate`

When a widget has a whole stage the reader has not entered — a simulation that
only confirms what the figure already computes — put the stage behind one button
and hide everything that serves it. Principle 3.4b.

```js
params: {
  effect: { … }, n: { … },            // the setup, always visible

  studies: {                          // renders as a full-width button
    type: "gate",
    label: "Simulate to check",       // shut
    labelOff: "Hide simulation",      // open — it must name the way back
    detail: "…",
    default: false,
    display: true,                    // so leaving does not destroy the work
  },

  // shown only while `studies` is truthy
  seed:  { type: "int", …, when: { param: "studies" } },
  speed: { type: "choice", …, when: { param: "studies" }, display: true },
},
```

`when` is **declarative on purpose** — core has to know WHICH parameter gates a
field so it can rebuild the control block only when that one moves. A predicate
function would force a rebuild on every change, and rebuilding mid-drag drops the
slider you are holding.

Core finds the `gate` field by scanning the spec, and hides step/run/reset while
it is shut. Do not declare the gate a second time under `animation`.

### Name the button, then name its noun in the title

Labels are one word wherever that is honest — `Drop`, `Resample`, `Shuffle`,
`Observe` — which means the face has nowhere left to say what it drops or
shuffles. So every widget authors `leadTitle` / `stepTitle` / `runTitle`.
**Shortening a label without rehoming its noun is how a control stops explaining
itself.** Principle 3.4c.

A lead must not be a near-synonym of any step, in this widget or any other: a
once-only action and a repeat-forever one four characters apart is a real defect
that shipped once. Principle 3.4c has the audit.

Plus `widgets/<slug>/index.html` — copy `widgets/clt/index.html` and change the
`<title>` and `<meta name="description">`.

### Three invariants

1. **Parameters are the only state of record.** `anim` never writes into params.
   Break this and the URL will disagree with the figure.
2. **`compute()` is pure, seeded, and runs on parameter change only, never per
   frame.** An animation is a progressive *reveal* of already-computed data, which
   is why it lands exactly on the picture the seed promises.
3. **A `display: true` parameter change must not discard the animation.**

## Parameters

Pick a control by what the options *mean*, not how many there are:

| type | control | when |
|---|---|---|
| `int` `float` | slider | a number |
| `bool` | checkbox | on/off |
| `choice` | slider + tick labels | options form a **magnitude** |
| `segmented` | button group | a few **alternative readings** |
| `select` | dropdown | the list is too long for either |

`select` options may carry a `group`; consecutive options sharing one render as an
`<optgroup>`. The object-map option form silently drops `group` — declare the
array form if you want it.

**`readback` is not a parameter.** Like `section`, it is a spec entry that says
where in the rail it goes and carries no value, so it never reaches the URL. It
renders a small case table naming which of a few labelled outcomes the controls
above it produce — widget 14's two penalty dials produce linear / ridge / lasso /
elastic net, and which one you have is a fact about the dials, so 2.7 puts it
beside them rather than on the figure.

```js
kind: {
  type: "readback",
  cols: ["α₁ = 0", "α₁ > 0"],
  rows: ["α₂ = 0", "α₂ > 0"],
  cells: [["Linear", "Lasso"], ["Ridge", "ElasticNet"]],
  live: (values) => [row, col],
}
```

`live` is a FUNCTION where `when` must stay declarative, and the difference is
load-bearing: `when` has to be declarative so core can avoid rebuilding the
control block on every change, because rebuilding mid-drag drops the slider you
are holding. A readback rebuilds nothing — it swaps two class names — so a
predicate is safe there and only there.

```js
params: {
  // data: changes what the numbers ARE. Resets the animation.
  dist: { type: "select", label: "Population", options: distOptions, default: "exponential" },
  n:    { type: "int", label: "Sample size n", min: 1, max: 100, default: 5 },
  seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

  // display: changes only how it is DRAWN. Keeps the student's work.
  theory: { type: "bool", label: "Normal σ/√n", default: true, display: true },

  // authoring escape hatch: a finished figure for a chapter, first render only
  shown: { type: "int", min: 0, max: 2000, default: 0, hidden: true },
}
```

Order them as the reading order of the setup block: what am I looking at, then how
do I want to look at it. `seed` near the end.

Mark **every** presentation-only parameter `display: true`. An overlay toggle that
wipes out thirty collected samples punishes exactly the comparison it exists to
enable. If a display change alters derived shape (an axis range changes the
binning), supply `animation.rebuild` to re-derive from whatever in `anim` is
genuinely invariant.

## The pile

`core/accumulator.js` owns everything that happens once a value arrives: binned
counts, running mean and SD, the dot-plot-to-histogram crossfade, the ratcheted
count axis, the smoothed density, the landing flash. Four widgets in the arc use it.

```js
const pile = createPile({
  bins, lo, width,
  headroomFor: (total) => /* extra height in COUNT units an overlay needs */ 0,
});

pile.push(value);          // fold one in; ratchets the axis
pile.rebuild(values);      // re-derive after a binning change
pile.tick(dt);             // fade the landing flash
pile.clearFlash();         // when the animation halts
pile.mean; pile.sd; pile.shown; pile.counts;
const f = pile.frame();    // { yMax, barMix, smoothMix, total }
pile.draw(plot, f, { colors, smooth: params.smooth });
```

You still draw the grid, the axes, and any theoretical overlay — those carry
widget-specific meaning. Plot in **counts**, not density: a density axis fixed to
the finished picture makes the first arrivals invisible, and one rescaled per frame
hides the convergence that is the point.

## Animation

```js
animation: {
  stepLabel: "Drop one",       // name the verb — a Galton board drops balls
  runLabel: "Play",
  leadLabel: "Sample the population",  // optional: a ONE-OFF action, see below
  init: ({ params, state, fromScratch }) => anim,
  advance: (anim, { dt, params, state }) => boolean,   // true = more to show
  rebuild: (anim, { params, state }) => void,          // optional
}
```

- **A lead action** is something that happens once, before repeating anything is
  meaningful. Declaring `leadLabel` adds a button ahead of the others and runs
  `advance` with `anim.mode === 'lead'`; the widget sets `anim.leadDone`, and core
  disables the lead button from then on while keeping step and run disabled until
  then. `bootstrap` draws its single sample this way, and the button greying out
  for good is the teaching: you cannot go back to the population. A driven
  fingerprint state for a widget with a lead action needs `"lead": true` in its
  `drive` block, or it will try to click a disabled button and fail.

- `advance` returns `false` to stop, leaving `anim` in place so a partly built
  picture stays on screen. Set `anim.done = true` when nothing is left.
- `anim.mode` is `'run'` or `'step'`; the widget decides what one step is.
- `fromScratch` is `false` on first render (honour `?shown=`) and `true` on Replay.
- **Pacing is chosen, not automatic.** Offer a `speed` `choice` param. Above a
  threshold, switch the per-item choreography off and show arrivals only — as a
  declared property of the chosen speed, never something the animation decides
  mid-run.
- **Clear transient cues when motion stops.** A frozen half-faded highlight reads
  as a marked bar rather than a recent arrival.

## Drawing

Everything comes from tokens; reference the **semantic** roles so a colour means
the same thing in all forty widgets:

| token | meaning |
|---|---|
| `--c-empirical` | what we observed or simulated |
| `--c-smoothed` | a smoothed reading of the empirical |
| `--c-theory` | the theoretical or asymptotic result |
| `--c-highlight` | the one thing to look at right now |
| `--c-reference` | truth: a parameter, a null value |

`makePlot()` gives you `grid` `axisX` `axisY` `bars` `dotColumns` `spikes` `curve`
`area` `band` `vline` `rug` `dot` `caption`, with the mark specs already fixed.
`spanningRule()` draws one reference line across stacked panels — populations
declare a `halfWidth` rather than a `domain` so every window is μ-centred and a
single rule can carry μ.

Use `spikes()` for discrete distributions and declare `masses: [[value, prob], …]`.
Never express point masses as a binned array — that put the coin flip's second
spike off the panel and it survived several iterations.

## Clickable regions

A widget may make its canvas clickable. `regions` returns targets in drawing
coordinates; core resolves a pointer to one and applies its `set` through the
same door any external write uses, which syncs the control first. So the URL and
the rail move exactly as if the reader had used the dropdown — a region is a
faster way to reach a parameter, never a second state of record.

```js
regions: ({ w, h }) => cells.map((c) => ({ ...c, set: { pair: c.key }, label: c.key })),
```

Three rules, and core throws at load if you break the first two:

- **Exactly one parameter per region.** Two would paint an intermediate state
  nobody asked for, write the URL twice, and make the click a different
  transaction from the one a fingerprint state performs — so the harness would be
  verifying a sequence the reader never takes. A pair of variables is one
  parameter, not two.
- **The value must be a real option key.** A region table can be wrong in exactly
  two ways, and both are code defects, so both throw where every other driver in
  this repo throws rather than being coerced into the default.
- **Keep the control.** The dropdown or slider is the keyboard and screen-reader
  path to the same parameter. The matrix is the shortcut, not the only route.

It is built lazily at click and hover time, never inside `draw()` — `draw()` runs
every frame and a region list rebuilt there is per-frame work that paints
nothing. It is not handed `colors` or `anim` either: a target that moved with the
theme, or with how far an animation had run, would drift away from the picture.

## Verifying

**Screenshots for judgement. Assertions for facts. Never the reverse.**

```bash
npm run dev      # NOT python -m http.server; this one sends no-store
npm run check    # invariants
```

Then `/widgets/_lab/fingerprint.html`, which hashes each state **twice** — `px`
over the canvas and `tx` over the figure's text (`.w-math`, `.w-legend`,
`.w-readout`) — and MATCHes only if both agree. **Run the full suite when you touch `widgets/core/`** — that is the only
change that can reach a widget you are not looking at. A change confined to one
widget's `main.js` only needs that widget's own states rebaselined, and testing
the widget you are building stays manual: no hash tells you whether a caption is
honest or a figure reads from the back row.

**Baseline LAST, after the human has seen it.** The determinism runs are the
slowest thing in the loop, and a baseline recorded before the design is agreed
gets thrown away — `bootstrap` was baselined three times over for exactly this.
Build, check the numbers programmatically, run the suite once if core changed,
then *show it and iterate*; record the baseline only when the design stops
moving. A placeholder needs **both** hashes in the meantime — `"px": "0",
"tx": "0"` — because `check` fails a state carrying only one.

It holds **three kinds of state**:

- **settled** — `?…&shown=N`, the figure fully built and nothing moving
- **driven** — `drive: { click, frames, dt }`, `{ set: {…} }` or
  `{ hit: [x, y] }`, where the harness replaces the frame clock with a queue it
  steps by hand. `hit` dispatches a real pointer event on the canvas at a point
  in DRAWING coordinates and throws if it is over no region
- **interrupted** — `drive: { before: [{ click, frames }], … }`, a state one
  action leaves another in

A new widget with an animation needs **at least one driven state**, and
`check.mjs` fails without one. Settled states cannot see anything drawn only while
something moves: that gap once let a coordinate change put every falling ball six
columns off-centre while all eight settled states matched. Before baselining a
driven state, confirm it is identical across three runs.

The automation browser throttles `requestAnimationFrame` to ~1 frame/300 ms and
generates stray pointer input that moves sliders mid-capture. Both have produced
phantom bugs. Drive animations manually — the recipe is in
[HANDOVER.md](../../../HANDOVER.md) — and if a screenshot disagrees with a
programmatic read, trust the read.

## Shipping checklist

1. Entry in `widgets/manifest.json`: `slug` `title` `blurb` `course` `topics`
   `arc` `status: "shipped"`. **No `height`** — the manifest carried one until it
   drifted silently with nothing reading it, and the field was deleted. A
   widget's height lives in `defineWidget` and nowhere else; adding a copy back
   needs a reader for it first
2. States in `widgets/_lab/fingerprint-baseline.json`, each carrying **both**
   hashes: two or three **settled** (`shown=`, nothing in flight), **plus at
   least one driven** (`drive: { click, frames, dt }`) if the widget animates,
   **plus at least one hit-driven** (`drive: { hit: [x, y] }`) if it declares
   `regions`. `npm run check` fails a widget missing either — settled states are
   blind to anything drawn only while something moves, and a coordinate change
   once put every falling ball six columns off-centre while all eight settled
   states matched; a `set` state routes around the region map entirely, so it
   leaves the hit-test geometry untested, and no pixel hash can see that.
   Confirm a new driven state is identical across three runs before baselining
3. Judge it **projected**, or at least from across the room. The lecture is the
   governing surface (`docs/prd.md` §3); thin strokes and small tick labels are
   what fail at distance
4. Mark shipped in `docs/catalogue.md`
5. `npm run check && npm run build`

## Do not

- Add a runtime dependency, or a bundler. `package.json` has no `dependencies`
  block; keeping it that way is why there is no build step.
- Use `Math.random()`. All randomness comes from the seeded `rng`.
- Hardcode a colour, size or font.
- Open on the answer. If the widget has a result the student should reach, it
  starts empty and they build it.
- Extract an abstraction from one example. The CLT's draw/collapse/drop was
  deliberately *not* extracted, because a Galton ball's descent turned out to have
  a wholly different shape.
- Write the same geometry twice. If the animation and the data agree on where
  something is, they share one named function — see `deviationAfter()` in
  `galton-board`. Two copies of a formula is how the halves of a figure come to
  disagree, and a comment saying "keep in sync" does not prevent it.
- Force a qualitative widget to invent numbers. Provide `summary` instead of
  `readout` — it becomes the figure's accessible label, so canvas still gets a
  text reading without stat tiles on screen.
