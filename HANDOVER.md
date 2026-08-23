# Handover

## Where things are

**Fourteen widgets: twelve shipped, two drafts** — `generalization` (arc 13) and
`linear-regularization` (arc 14). Both are listed at `/lab/` and neither is on
the gallery.

**Twelve commits are unpushed.** `main` is ahead of `origin/main`, and every push
publishes immediately with no staging step — which is what makes `npm run check`
before committing load-bearing rather than tidy. Nothing in them is risky: every
`widgets/core/` change was verified with a full suite run. But it is twelve at
once, so read them before pushing.

**105 fingerprint states, and each now carries TWO hashes.** See *Verifying
changes* below — this is the biggest single change to how the repo checks itself.

```bash
npm run dev      # :8000 — USE THIS, not python -m http.server
npm run check    # before every commit
```

---

## NEXT: pick a matrix placement, then finish widget 14

The core work for a clickable correlation matrix is **done, committed and
verified**. What is left is one layout decision and then a single widget change.

**The decision.** `widgets/_lab/linreg-matrix.html` mocks four placements, all
live — the matrices are clickable, which is the half no screenshot can judge.

| | matrix | plane & predictions | cost |
|---|---|---|---|
| **M1** beside the bars | 150px | **221px, unchanged** | bars lose a third of their width |
| **M2** third panel in the row | 147px | 147px | plane drops 228 → 147 |
| **M3** replaces the predictions | 221px | plane 221px | the scatter goes behind a toggle |
| **M4** its own strip | 132px | **221px, unchanged** | widget grows 438 → **603px** |

**M1 is the recommendation**: the only option that costs nothing anyone is
looking at. What gives way is bar-chart width, and the bars are thirteen short
columns whose information is vertical.

**Then the widget change**, which is one commit:

1. A `regions` function returning the 13×13 grid, one cell per ordered pair.
2. The `pair` parameter becomes a `select` over 156 ordered pairs, grouped by the
   x variable — thirteen `<optgroup>`s of twelve. That dropdown is the keyboard
   and screen-reader path to the same parameter a cell sets; the matrix is a
   faster way to reach it, never the only way.
3. At least one `drive: { hit: [x, y] }` fingerprint state, which `check.mjs`
   now requires of any non-draft widget declaring `regions`.

The matrix is drawn **unlabelled** in the mock-up, on purpose: thirteen row names
plus thirteen rotated column names cost more room than the grid itself, and the
readout already names the pair. What the grid has to carry is the *texture* —
dark is correlated is long contours. Whether that reads without labels is the
main thing to judge.

Worth knowing: the four-way slider it replaces reaches elongations 1.09–4.77:1.
The matrix reaches **Weight/Hip at 5.73:1** and **Age/Weight at 1.01:1**, where
the contours are so nearly circular that the diamond and the circle become the
same shape — the case where the whole L1-versus-L2 distinction stops mattering.

---

## What the core contract gained this session

Six additions, each its own commit, each verified with a full 105-state run.

| what | where | why |
|---|---|---|
| `type: "readback"` | `params.js`, `controls.js`, `tokens.css` | a case table in the rail naming which of a few labelled outcomes the controls above it produce. A non-parameter spec entry, exactly like `section`: carries no value, never reaches the URL |
| `regions` | `widget.js`, `canvas.js` | clickable targets on the canvas, resolved to a parameter |
| `pointAt` / `hitTest` | `canvas.js` | pointer event → drawing coordinates; the region under a point |
| the exported `setParam` syncs | `widget.js` | it is the door that is NOT a control, so it must tell the rail |
| a checkbox's `detail` renders | `controls.js` | 3.4f, third time |
| `<optgroup>` runs in a `select` | `controls.js` | the 156-option keyboard path |

Two of these have a subtlety worth not rediscovering:

**`readback` takes a `live` FUNCTION where `when` must stay declarative.** `when`
is declarative so core can avoid rebuilding the control block on every change —
rebuilding mid-drag drops the slider you are holding. A readback rebuilds
nothing; it swaps two class names. So a predicate is safe there and only there.

**`regions` allows exactly ONE parameter per region, checked at load.** Two would
paint an intermediate state nobody asked for, write the URL twice, and — the
reason that matters — make the click a *different transaction* from the one a
fingerprint state performs, so the harness would be verifying a sequence the
reader never takes. A pair of variables is one parameter, not two.

---

## Widget 14 · `linear-regularization` — SHIPPED AS A DRAFT

Hosts at PHM5005 `04-3 Tour of Algorithms`, section 1. Its four-row table —
linear / ridge / lasso / elastic net against α₁ and α₂ — is read as four
algorithms. They are four settings of one objective, which the notebook prints
two lines above that table.

Two dials on a shared ladder, a readback in the rail naming which of the four you
are in, the fitted equation as MathML above the figure, thirteen coefficient
bars, a conditional-slice coefficient plane, and a predicted-against-measured
panel.

### What remains before it ships

1. The matrix placement above, then the widget change.
2. **Fingerprint states.** Two or three settled, plus a `hit` state once the
   matrix lands. It declares no `animation`, so it needs no driven state.
3. Flip `status` to `shipped` in `manifest.json` **and** in `main.js` — `check`
   asserts they agree.
4. Mark it shipped in `docs/catalogue.md`.
5. **Judge it projected.** Never done for widgets 11, 12, 13 or 14.

### The design decisions, so they are not re-argued

- **Layout D2**, chosen from a four-way mock-up: equation on top, bars full
  width, then the plane and the predictions as two squares of equal standing.
- **The readback sits in the rail, not on the figure.** It reports the two dials
  directly above it, and 2.7 puts a reading next to what produced it. On the
  canvas it also painted over the Forearm and Wrist bars and only looked clear
  because those two coefficients happen to be small.
- **The plane is a CONDITIONAL SLICE** of the full thirteen-feature fit: the
  other eleven held where they were fitted, the pair free. An earlier build
  fitted a separate two-feature model and the panels then disagreed about
  Abdomen — 8.80 against 10.27 — because those are different models, not
  different views. The slice is exact, not approximate: a coordinate-descent
  fixed point IS the statement that the solution is already optimal in any subset
  of coordinates given the rest. Profiling the other eleven out instead is
  wrong — at a lasso solution their gradients are not zero, they equal the
  subgradient, so a profiled contour is tangent to nothing.

---

## Measurements worth not repeating

All were made to settle a design question, and several killed an idea.

**The body fat data leaks its target.** `04-3` fits on
`drop(columns=["BodyFat"])`, which keeps `Density`, and BodyFat is derived from
Density by Siri's equation: `495/D − 450` reproduces the target to within 0.1
percentage points for **243 of 252 men**. The printed R² table (0.992 down to
0.767) is therefore not comparing algorithms, it is measuring how hard each one
shrinks a leaked feature. **Kenneth agreed to drop the column; not yet done.**

**The penalty is a function of how much data you have.** Median test R² over 25
splits, lasso, without Density:

| n_train | α=0 | α=0.1 | α=0.3 | α=1 | best |
|---|---|---|---|---|---|
| 18 | **−0.761** | 0.435 | 0.568 | 0.585 | α=1 |
| 40 | 0.548 | 0.635 | 0.654 | 0.636 | α=0.3 |
| 202 | 0.698 | 0.690 | 0.675 | 0.633 | **α=0** |

**The grouping effect is real, not a solver artefact.** Raising α₂ at fixed α₁
puts coefficients *back* — 9 of 13 up to all 13. 300 sweeps agrees with 20,000 to
machine zero. The smallest marginal covariance is Height at −0.75 against an L1
threshold of 0.1, so once L2 separates the correlated measurements each clears it
alone.

**Four of the 637 reachable coefficient slots print as `0.00` under `toFixed(2)`
while being non-zero** — at α₁ = α₂ = 0.01 the equation read `− 0.00 z(Knee)`.
A term that is in the model now carries enough digits to show it.

**kNN's scaling story is dead.** Standardised against as-measured is within one
or two patients at every *k*, even though ejection fraction outweighs
log-creatinine **52:1** in range — because ejection fraction is recorded in
coarse steps, so creatinine survives as a tie-breaker. Do not build a kNN widget
around "forgetting to scale". What *does* fire: at k = 9, adding features
strongest-first takes deaths caught from 8 of 19 to **1 of 19**.

**MathML, checked rather than assumed.** Baseline since January 2023, floor
Chrome/Edge 109. A single `<math>` does **not** line-break — MathML Core treats
`white-space` as `nowrap` on every MathML element and no engine implements
automatic linebreaking — so thirteen terms in one `<math>` measure past 1000px
and overflow. One inline `<math>` per term wraps normally, because each is an
atomic inline box in an ordinary inline formatting context.

---

## Traps that cost time this session

Each of these produced a wrong answer that looked right.

- **A measurement comparing unlike things.** The MathML capability probe compared
  an `<mfrac>` against a `<span>` *wrapping* a `<math>`, whose height carries the
  surrounding line-height — 19px against the fraction's 16.5px. It reported a
  browser that lays maths out perfectly as one that does not, which would have
  forced the fallback on every reader for ever. Both sides must be `<math>`.
- **A ceiling that hid a term.** `-webkit-line-clamp: 3` on the equation looked
  right until below the 880px breakpoint, where thirteen terms need four lines
  and the clamp dropped one — silently, no scrollbar, no ellipsis.
- **Mounting at module scope.** `buildShell` creates `.w-figure` inside
  `defineWidget`, so a widget's module scope runs before it exists. Querying it
  there returns null and the reader gets a **blank page**, not a missing element.
  Mount from inside `draw()`, scoped to the widget's own host.
- **A frame conditioned on live state.** The coefficient plane's frame was built
  from the slice conditioned on the *current* eleven coefficients, which shrink —
  so the whole panel drifted under the reader as they dragged.
- **A sweep that measured two paints as one.** Setting two parameters fires two
  repaints, and a text sweep that clears its buffer before both records two
  different figures at the same coordinates — reported as 318 collisions that did
  not exist. Clear after the last set, then force one clean repaint.
- **`document.fonts.check` returns true for everything.** It is not an
  availability test. Measure glyph widths against a generic fallback instead.

---

## Deferred, ready to pick up individually

**Button labels.** A five-widget sweep was reverted (`a23be6b`) as too much to
review at once. The observations still hold; each is a one-file change:

- `maximum-likelihood`'s step button reads "Step" — core's generic fallback, and
  the only step button in fourteen widgets that names no act.
- `bootstrap` and `permutation-test` grey out Step and Play until their lead has
  run, and neither says why. The other lead-gated widgets have a `leadHint`.
- `bayesian`'s `leadHint` says "Step and Play" while the button reads "Add a
  count" or "Propose a move".
- `em-mixture`'s lead reads "Start", the only lead label naming no act.

**Judge projected.** Widgets 11, 12, 13 and 14 have never been seen from the back
of a room. Widget 11's hypergeometric dots are ~4px at the narrow layout.

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`**, by hand:

- **Cell 40** states the odds-ratio interpretation wrongly. On `a=24, b=60,
  c=16, d=100` the odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is
  not an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** should say **case-control**, not "retrospective" — a
  retrospective *cohort* is fine for a risk ratio, and in a case-control the
  exposure is precisely what you go and ascertain. What is unknown is the
  population at risk.

**`04-3` needs `Density` dropped**, per the measurement above.

---

## Reading the PHM5005 notebooks

Two routes, both verified:

- **Local copies, WITH cell outputs**, in
  `~/Downloads/PHM5005 AY2025-26 - Notebooks/For Review/`. **Prefer these** — the
  printed numbers are the valuable half.
- **Shared Drive folder**, readable without auth:
  <https://drive.google.com/drive/folders/1QcSRjgcasZRpFyw1lOHSowjjDgcXp0_c>

**Match by filename, never by link.** The same notebook has appeared under three
Drive IDs across two sessions.

There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are named by
notebook filename.

---

## How Kenneth works — read before writing anything he will see

- **One change at a time.** A commit touching five widgets is not reviewable and
  gets reverted whole, including the parts that were right. If a fix reveals the
  same fault elsewhere, **say where and stop**; offer the rest as a list.
- **He picks from mock-ups rather than reviewing prose.** Four rounds this
  session were settled that way — the ridge/lasso geometry, the layout, the
  equation typesetting, the matrix placement. A `_lab/` page with the candidates
  drawn at the real width and their trade-offs measured underneath gets a
  one-line answer; an argument in prose gets a longer conversation.
- **Replacement wording must be shorter than what it replaced**, or it is not an
  improvement. Said twice.
- **On-screen copy names the quantity** — principle 2.9. No metaphors, no
  personifying the method, no verdicts where a mechanism belongs. Source comments
  are exempt and should stay vivid.
- **Explanations are one claim per line, not paragraphs.**
- **Hand over the exact localhost URL after every edit.**
- **He may be away from the desktop.** `_lab/` is local-only by design and is not
  published; to show him something remotely, publish it as an Artifact with
  `tokens.css` inlined rather than changing what deploys.

---

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots here have produced several phantom bugs:
the automation browser generates stray pointer input that moves sliders
mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per 300 ms.

### The canvas text sweep

Wrap `fillText`, measure each string, compare its right edge to the canvas width.
It catches a `NaN` at one end of a slider, a caption overrunning its line, a
printed claim that is false.

```js
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

- **`y === 0` is a rotated label** — its coordinates are in the rotated frame.
- **Clear the buffer after the LAST parameter set, then force one repaint.** Two
  sets are two paints, and recording both reports collisions that do not exist.
- **Dedupe before any collision check.**
- **It cannot see DOM.** Widget 14's equation is MathML and does not go through
  `fillText` at all — the sweep stopped seeing it with no error and no gap in its
  output. That is what the text hash below exists to cover.

### The fingerprint harness — now TWO hashes

`widgets/_lab/fingerprint.html`. **It auto-runs on load; never click Run** — that
starts a second concurrent pass into the same table and can make "Copy new
baseline" copy a half-interleaved set.

Every state records **`px`**, a hash of the canvas, and **`tx`**, a hash of the
figure's text — the concatenated `textContent` of `.w-math`, `.w-legend` and
`.w-readout`. A state MATCHes only if **both** match, and `check.mjs` fails a
state carrying only `px`.

The rail is deliberately absent from `tx`: the rail is what you SET and the stage
is what you SEE, and a control's own label is not a reading of the figure.

> *Earned:* widget 14 moved its equation into the DOM, which left both cheap
> checks at once. But the readout had never been hashed for **any** widget — the
> equation did not create that hole, it made it visible.

**Run the full suite when you touch `widgets/core/`.** That is the only kind of
change that can reach a widget you are not looking at. A run takes about five
minutes.

Three kinds of state:

| kind | how | sees |
|---|---|---|
| **settled** | a URL that fully determines the figure | the finished figure |
| **driven** | `drive: { click, frames, dt }` or `drive: { set: {…}, … }` | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

Plus a fourth verb, **`drive: { hit: [x, y] }`**, which dispatches a real pointer
event on the canvas at a point in *drawing* coordinates. `set` reaches a
parameter through its DOM control and routes around the region map entirely, so
a `set` state gives a widget's hit-test **no coverage at all** — and that
geometry is exactly what no pixel hash can see, because the picture is identical
whether a target sits where it is drawn or six columns away. It throws when the
point is over no region; the widget's own cursor is the detector.

`check.mjs` fails a non-draft widget that declares `animation` without a driven
state, or `regions` without a `hit` state.

- **`set` drives a control** rather than a drive button — found by `data-param`,
  never by position (5.7).
- Before recording a new driven state, confirm it is identical **across three
  runs**. A flaky check is worse than none.

### THE BIG ONE: every baseline is at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**.

This is where widget 11's six overflows were found, and none was visible at
1400px. No hash would ever have caught one: `note()` and friends stroke
surface-coloured before filling, so **a collision erases what it overruns rather
than blending**.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

Build → cheap checks → **if core changed, one suite run** → *show Kenneth and
iterate* → and only then add states, prove determinism, baseline, commit.

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves.

If a state legitimately changes, regenerate the baseline **in the same commit**
as the change, so the diff records that the rendering moved.
