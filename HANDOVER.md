# Handover

## Where things are — read this first

**Eleven widgets.** `main` and `origin/main` are level and every push to `main`
publishes immediately, with no staging step — which is what makes
`npm run check` before committing load-bearing rather than tidy.

`power-and-error` and `probability-mechanisms` are the `draft`s in the manifest.
**The gallery lists shipped widgets only**, so bare `localhost:8000` will not show
either of them; `/lab/` indexes the drafts and both live at their final URLs:

```
http://localhost:8000/widget/probability-mechanisms/
```

## What widget 11 is, in one paragraph

`probability-mechanisms`, "Probability Distributions". **Three views, switched by
one segmented control.** *Map* is an eight-ending decision tree drawn on the
canvas and clicked directly — the whole map visible, dimmed, the path lighting up
as it is walked, three questions, the first asking outright whether the data is
**discrete or continuous**. Answering the last question lands but does **not**
navigate; the distribution's name, one column right, carries a `→` and is what
you press to go and look at it. *Distribution* plays that process one draw at a
time above a pile, with the theoretical curve over it. *R code* turns `d`, `p`,
`q` and `r` into the four questions they answer, each with its own picture,
driven by a **quantile** slider — moving it *is* `qbinom`/`qpois`/`qnorm`. Both
figure views carry the same **row of eight chips**, so the tree is never the toll
for looking a distribution up.

**Eight distributions, four discrete and four continuous**, each a builder over
its own parameters. The figures are generic — "Successes in 10 trials", "Targets
found in 50 draws", "Events in one window" — with the concrete example one line
of description rather than the subject of the panel.

## The next job — baseline it, then ship it

The design is settled and reviewed. What is left is mechanical:

1. **Fingerprint states.** Two or three **settled** (`?dist=…&view=…&shown=…`)
   plus at least one **driven** (`drive: { click, frames, dt }`) — `check.mjs`
   fails a non-draft widget that declares an `animation` without one. Confirm each
   driven state is identical across three runs before recording it.
2. **Promote to shipped** — `status: "shipped"` in **both** `widgets/manifest.json`
   and `main.js`; `check` fails if they disagree.
3. Mark it shipped in [docs/catalogue.md](docs/catalogue.md).
4. **Judge it projected.** The hypergeometric pool's dots are ~4px at the narrow
   layout and the R-code cards put 11px mono on a half-width card.

Then the arc's next entry is the catalogue's own argument to have, not a decision
already made — [docs/catalogue.md](docs/catalogue.md) still lists
`ppv-prevalence` as the highest-evidence deferred item, and widget 11 has not
changed that.

## Two things about this widget that are not like the others

**It is clicked on the canvas**, which nothing else here does. No core change was
needed: `defineWidget` returns `setParam`, so the module attaches its own
listener and hit-tests against the box list the draw pass just built. If a second
widget ever wants this, that is the moment to move it into core rather than
copy it.

**It manages its own rail**, from `draw`, in `syncChrome`. Core decides which
controls *exist* from the spec's `when`, which takes one condition; three of these
rules need two — a field belongs to a distribution AND to a view. The table is in
the code and in the catalogue.

## What this session did

Widget 11 went through **eight** rounds of review and changed shape in six of
them. Almost none of the first build survives, and the record of why is in
[docs/catalogue.md](docs/catalogue.md).

| round | what changed |
|---|---|
| the framing | the notebook's five examples became **eight generic mechanisms**; free throws and endangered species moved from being the subject to being one line of description |
| the continuous side | **exponential, uniform and log-normal** added, so four of each type. The exponential is the gap between the same arrivals the Poisson counts |
| the questions | "symmetric or skewed" became **"could the biggest be ten times the smallest"** — answerable about the quantity, with no data |
| the shape | two tabs became **three views**, and a breadcrumb became **the whole tree** |
| the flow | landing stopped navigating; the **name** is the button that does |
| the controls | frozen numbers became **sliders**, and the dropdown became **chips** |

### The measurements that decided things

Every one of these is a number that ended an argument, and each is written up in
the catalogue with its consequence.

| question | measured | what it settled |
|---|---|---|
| does the binomial/hypergeometric pair make a picture? | **5%** separation at the taught numbers | no — that panel carries "the chance moves as the pool empties" instead |
| does the Poisson/negative-binomial pair? | **3.5×** | yes, and it is the widget's clearest contrast |
| can a density exceed 1 without contrivance? | `dexp(0.2, rate = 5)` = **1.84**, `dunif` at range 0.2 = **5.0** | yes — it is one slider, not a special case |
| does "lab value" decide normal vs log-normal? | sodium **1.1×**, CRP **105×** (99th ÷ 1st) | no. The span does, and sodium is the case that makes the rule |
| does `size` really approach Poisson? | var/mean **3.57 → 1.23** as size goes 2 → 30 | yes, visibly |

### Four defects worth not repeating

All four were the same mistake: **checking that a flag was set rather than that
something moved.**

- **`hidden` does not hide an element with an explicit `display`.** It is only a
  user-agent default, and `.w-legend` is `display: flex` — so the legend stayed on
  screen while every DOM check agreed it was hidden. `.w-drive` escaped this only
  because the side layout carries `.w-split .w-drive[hidden]`. Set both.
- **`setParam` repaints synchronously.** Updating module state *after* calling it
  paints the old state; the tree lit one leaf while the rail named another.
- **`setParam` does not sync a control showing the same value** unless that
  parameter gates another field.
- **A hand-written list of parameter names drifted** the moment one was renamed —
  derive it from the table (principle 5.8).

And one in core's contract worth knowing: **`params.js` matches a URL value
against option keys with `includes`, which is strict equality.** Numeric `choice`
values therefore fall back to the default silently. Use strings.

## THE BIG ONE: every baseline is recorded at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**, the
narrowest that layout ever produces.

**This is where widget 11's overflows were found, and there were six of them** —
a pool grid laid out for a desktop, an attempts readout that trailed the last
circle, a collapsed path longer than the canvas, and a fully-wound log-normal
writing `plnorm(1638.51, meanlog = 3.91, sdlog = 1.5)` 36px past a half-width
card. None was visible at 1400px and no hash would ever have caught one, because
`note()` and friends stroke surface-coloured before filling: **a collision erases
what it overruns rather than blending**, so it still looks like text and it
hashes consistently for ever.

The check that finds them, and the only one that does:

```js
// wrap fillText, measure each string, compare its right edge to the canvas width
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

Two things about running it in an iframe: **`y === 0` is the rotated y-axis
label**, whose coordinates are in the rotated frame and always look like an
overflow — skip it. And a widget paints once on load, before any wrapper is
installed, so **force a repaint** (re-press the already-selected segmented
button) rather than dispatching `resize`, which no longer repaints if the size
has not changed. A sweep that reports every state blank is measuring nothing.

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots in this project have produced several
phantom bugs, and the automation browser throttles `requestAnimationFrame` to
~1 frame per 300 ms, so animations appear frozen and any wait under ~300 ms
races the frame clock.

- `npm run check` asserts the invariants that are cheap to state in code.
- **Read the canvas's own text**, per the recipe above.
- **Measure rendered geometry, not attributes.** `getBoundingClientRect().width > 0`
  answers "is this on screen"; `el.hidden` answers "did I set a flag", and those
  are different questions. `getComputedStyle` on a child of a hidden parent
  reports the child's own display, which is not `none` — that check is a trap.
- `widgets/_lab/fingerprint.html` hashes each widget's canvas against a stored
  baseline. **Run the full suite when you touch `widgets/core/`** — that is the
  only kind of change that can reach a widget you are not looking at. **It
  auto-runs on load; never click Run**, which starts a second concurrent pass
  into the same table and can make "Copy new baseline" copy a half-interleaved
  set.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

Build → cheap checks → **if core changed, one suite run to confirm the existing
states still MATCH** → *show the human and iterate* → and only then add states,
prove determinism, baseline, commit.

> *Earned twice.* `bootstrap` was baselined three times over. Widget 11 changed
> shape in six of eight review rounds — a baseline taken at round two would have
> been thrown away six times.

`npm run check` fails a **non-draft** manifest widget with no fingerprint states,
which is the escape hatch: leave it `draft` while the design moves. A placeholder
`"px": "0"` also satisfies `check` if states need writing early.

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

`before` exists because **three separate shipped bugs were mid-animation states**.
Drive buttons are found by `data-key`, never by position — see principle 5.7.

If a fingerprint state legitimately changes, regenerate the baseline **in the same
commit** as the change, so the diff records that the rendering moved.
