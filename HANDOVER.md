# Handover

## Where things are

**Fourteen widgets: twelve shipped, two drafts** — `generalization` (arc 13) and
`linear-regularization` (arc 14). Both are listed at `/lab/` and neither is on
the gallery.

**Everything is committed and pushed**, so the twenty commits that were sitting
on `main` are live at <https://nusmedicine.github.io/statml/>. There is no staging
step, which is what makes `npm run check` before committing load-bearing rather
than tidy, and GitHub Pages sends `max-age=600`, so a student can get a stale
widget for ten minutes after a deploy.

The last five are one change each, and their messages carry the reasoning rather
than this file:

    f095d5e  Let widget 14's panels fill the row, and align the equation
    1dd52d0  Mock up how wide widget 14's two panels go
    af8c597  Give core a matrix control, and put widget 14's grid in the rail
    43344b9  Mock up the correlation matrix in the rail
    69cf912  Write widget 14's equation terms as T4

**105 fingerprint states, and each now carries TWO hashes.** See *Verifying
changes* below — this is the biggest single change to how the repo checks itself.

```bash
npm run dev      # :8000 — USE THIS, not python -m http.server
npm run check    # before every commit
```

---

## NEXT: widget 15 — logistic regression, as a linear model with a link

Agreed with Kenneth as the next build. **Nothing is designed yet**, so this
section is the ground rather than the plan: what the host lesson does, what the
numbers are, what the misconception is, and what has already been decided
elsewhere and must not be re-argued.

### The host lesson, read

`../jupyterbook/phm5003/notebook/04 - Introduction to Statistical Computing Part 2/05-05 - Modeling - Categorical Outcome.ipynb`
— nineteen cells, and it opens on the framing the widget has to carry:

> The linear model can be generalized to include a link function, which allows
> the modeling of different outcomes besides continuous variables

It is the fifth of seven modelling lessons (`05-01` single covariate through
`05-07` hierarchical), so the reader arrives having fitted straight lines four
times. **`05-05` is where the line stops being a line**, and the lesson's own
answer is that it does not: what changed is the scale it is straight on.

- **Data:** the Framingham study,
  `https://raw.githubusercontent.com/kennethban/dataset/main/framingham.csv`.
  **4240 rows, 16 columns**, printed by the notebook.
- **Model:** `glm(TenYearCHD ~ BMI + age, data = data, family = "binomial")`.
- **The printed coefficients**, from the notebook's own output — a widget that
  does not reproduce these to the digit is wrong:

  | term | estimate | std. error | p |
  |---|---|---|---|
  | (Intercept) | **−6.54292372** | 0.407430778 | 4.9e−58 |
  | BMI | **0.03532089** | 0.011176590 | 1.6e−03 |
  | age | **0.07581313** | 0.005744181 | 9.0e−40 |

- **The odds ratios it derives:** `exp(0.035) = 1.036` for BMI,
  `exp(0.076) = 1.079` for age.
- The lesson then prints a `modelsummary` table with `exponentiate = TRUE` and a
  `ggcoefstats` forest plot on the odds-ratio scale with a dashed line at 1.

### The misconception, and it is two

1. **That logistic regression is a different algorithm.** It is the same linear
   predictor; what is new is a function applied to the mean before the line is
   fitted. The lesson writes it as `f(μ) = β₀ + β₁X` and then names `f` as
   `log(odds)`.
2. **That `exp(b)` is an odds ratio because odds ratios are interpretable.** It
   is an odds ratio *because of the link* — a constant shift on a log scale is a
   constant multiple on the original one, and nobody chose that. `docs/catalogue.md`
   already says this out loud at line 1519 and calls it the thing `05-05` needs
   said. It is also why the odds ratio is the quantity you are handed whether you
   wanted it or not.

### The shape that suggests itself, NOT yet decided

**One fitted model, two scales, and a control that moves between them.** On the
link scale — `log(odds)` — the model is a straight line and the data are at ±∞,
so the points cannot be drawn. On the probability scale it is an S and the points
are at 0 and 1 where they belong. **It is the same fit both times**, and that is
the whole claim: the link is a change of axis, not a change of model.

What that buys, and why it is worth a widget rather than a figure: **step one
covariate by +1 and watch what happens on each scale.** On the log-odds scale the
shift is a constant `b` everywhere. On the probability scale it is not constant —
big in the middle, vanishing at both ends. That is the same fact widget 12
measures from a 2×2 table, arrived at from the other direction, and it is why an
odds ratio is one number and a risk ratio is not.

Open, and the sort of thing Kenneth settles from a mock-up rather than prose:

- **One covariate or two.** `age` alone draws a clean S; the lesson fits `BMI +
  age`. Two means the curve is a slice at a held BMI, which is the same
  conditional-slice problem widget 14 solved — and the solution there is written
  down, so it is cheap to reuse.
- **Two scales or three.** The lesson's algebra goes `p → odds → log(odds)` in
  three steps and the middle one is where the odds ratio actually lives.
- **Whether the fitting is shown.** IRLS converging is a real animation and
  widget 8 already owns "likelihood, one candidate at a time". Reusing that idea
  here may be right or may be a second widget wearing the first one's clothes.
- **The forest plot.** `ggcoefstats` on the OR scale with a line at 1 is the
  lesson's own last figure; whether the widget should end there is a design
  question, not a given.

### Already decided elsewhere — do not re-argue

- **Odds versus risk, and why an odds ratio overstates a risk ratio**, is widget
  12 (`odds-and-risk`), shipped. Widget 15 should *lean on* it, not restate it.
  `docs/catalogue.md` §"Widget 12" carries the whole argument including the
  measured base-rate dependence.
- **Predicted goes on x** — see the CLOSED section below. It applies to any
  observed-against-predicted panel this widget grows.
- **No runtime dependencies and no build step.** The data has to be inlined the
  way widget 14 inlines 252 rows of body fat. Three columns of 4240 rows is
  roughly 50KB of source; that is the first measurement to take, and subsampling
  is a decision with a cost (the printed coefficients would stop matching).
- **`glm` drops rows with `NA`.** Framingham's `BMI` has them. Match the
  notebook's row set or the coefficients will not match its output, and that
  agreement is the widget's cheapest self-check.

### Before writing any code

Read `docs/design-principles.md` and `docs/prd.md` §11 first — most of the rules
exist because the obvious approach failed, and §11 lists the non-goals so they
can be pointed at rather than re-argued. Then `docs/catalogue.md` for where this
sits in the statistics arc. The `new-widget` skill covers the `defineWidget`
contract, the data-vs-display parameter split and how to verify a change without
trusting screenshots.

---

## Then: widget 14 is still a draft, and finishing it is small

Everything Kenneth asked for is built and pushed. What is left is the shipping
list, and the first item has a wrinkle worth reading.

**The matrix is a DOM control, so no fingerprint state can see its geometry.**
`px` hashes the canvas; `tx` reads `.w-math`, `.w-legend` and `.w-readout`, and
the rail is excluded on purpose. On the canvas the grid was at least inside `px`,
and `check.mjs` forced a `hit` state to cover the cell-to-value mapping. Both are
gone. Two ways to close it, and the choice is open:

- **`?pair=Weight~Hip` as a settled state.** Free — the widget has no animation,
  so a URL settles it — and it proves the parameter reaches the figure. It does
  not prove the CELL sets it.
- **Teach the harness's `set` verb to drive a `matrix`.** `set` finds a control by
  `data-param` and writes `.value`, which a grid has none of; clicking
  `[data-value="…"]` inside it instead would be a few lines and would cover the
  cell-to-value mapping the way `hit` covered the canvas. This is the honest
  replacement for what was lost.

Then:

1. Two or three settled states. It declares no `animation` and no `shown`, so a
   URL alone settles it.
2. Flip `status` to `shipped` in `manifest.json` **and** `main.js`.
3. Mark it shipped in `docs/catalogue.md`.
4. **Judge it projected.** Never done for widgets 11, 12, 13 or 14.

---

### CLOSED: predicted on which axis — the widget is already right

Kenneth's instinct was that predicted belongs on y. **It does not — leave the
widget alone.** This was researched rather than argued from convention, and the
answer is one-sided.

**scikit-learn, which is what the course teaches and what `04-3` uses.**
`PredictionErrorDisplay` with `kind="actual_vs_predicted"`, in
`sklearn/metrics/_plot/regression.py`:

    x_data, y_data = self.y_pred, self.y_true
    xlabel, ylabel = "Predicted values", "Actual values"

The name reads *Y vs X*, not left-to-right. Its sibling `residual_vs_predicted`
shares that x-axis, so the two panels sklearn draws side by side line up —
flipping ours breaks the correspondence with the notebook's own figure.

**Everywhere else the course touches.** caret's `plotObsVsPred` is `obs ~ pred`
with `xlab = "Predicted"` — Kuhn's own package. Harrell's `val.prob` is
`xlab = "Predicted Probability"`. Clinical calibration plots are universally
predicted-risk on x against observed proportion on y, which is the figure these
students will meet again and again. R's `plot(lm)` has no observed-vs-fitted
panel at all, but every panel it does have puts fitted on x.

**And there is a real argument, not just a head-count.** Residual = observed −
predicted. With predicted on x, the signed vertical gap from a point down to the
`y = x` line **is** the residual: above the line means the model under-predicted.
Flip the axes and the vertical gap becomes *predicted − observed*, so every
statement about over- and under-prediction inverts relative to what "residual"
means everywhere else in the course. The residual plot is this plot with the
`y = x` line straightened to horizontal, and that only reads if both share
predicted on x.

Second: for a calibrated model `E[observed | predicted] = predicted`, so a
smoother through the cloud should sit on `y = x`. The reverse conditional is not
— shrinkage makes the cloud flatter than 45°, which is regression to the mean
rather than a model defect. Piñeiro et al., *Ecological Modelling* 216(3), 2008,
1000+ citations, concludes observed-on-y against predicted-on-x for exactly this
reason: r² is the same either way, but slope and intercept are not.

**The dissent is real but thin**: tidymodels puts predicted on y — the same
author as caret, disagreeing with himself — and no source found offers a
*statistical* argument for it. It is habit: predicted is what the procedure
produced, so it feels like output.

If it still looks wrong on screen, the fix is the axis labels or a caption, not
the orientation.

---

## What the core contract gained, all of it widget 14's doing

Eight additions, each its own commit, each verified with a full 105-state run.

| what | where | why |
|---|---|---|
| `type: "readback"` | `params.js`, `controls.js`, `tokens.css` | a case table in the rail naming which of a few labelled outcomes the controls above it produce. A non-parameter spec entry, exactly like `section`: carries no value, never reaches the URL |
| **`type: "matrix"`** | `params.js`, `controls.js`, `tokens.css` | a labelled grid of shaded cells, one option per cell, for a parameter that is a **pair**. Declares `rows`, `cols` and a `token`; each option carries `row`, `col` and `shade`. Arrow keys move the selection from one focus stop, which is what lets it replace a 156-option dropdown rather than sit beside one |
| **a height may be a function of the WIDTH** | `canvas.js`, `widget.js` | `resize(heightOf)` resolves it, because the width is knowable before anything is painted and the height is not. For a panel that has to stay **square** — widget 14's plane is only allowed to be square, so wider costs taller |
| `regions` | `widget.js`, `canvas.js` | clickable targets on the canvas, resolved to a parameter. **Declared by no widget now** — kept for SVM's support vectors and the tree widget's nodes, which are figure-native |
| `pointAt` / `hitTest` | `canvas.js` | pointer event → drawing coordinates; the region under a point |
| the exported `setParam` syncs | `widget.js` | it is the door that is NOT a control, so it must tell the rail |
| a checkbox's `detail` renders | `controls.js` | 3.4f, third time |
| `<optgroup>` runs in a `select` | `controls.js` | the 156-option keyboard path, before the matrix replaced it |

Four of these have a subtlety worth not rediscovering:

**A `matrix` cell's shade is an opacity on a CHILD element.** Fading the cell
fades the selected cell's ring with it — brightest exactly where it is least
needed.

**A `matrix` arrow step that lands on a non-option keeps going; one that runs off
the edge does not wrap.** So the ends of the grid are findable by feel, and the
diagonal — a measurement against itself is not a pair — is skipped rather than
stopping you.


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
are in, a labelled 13×13 correlation matrix in the rail as the pair selector, the
fitted equation as MathML in a card above the figure, thirteen coefficient bars
across the full width, a conditional-slice coefficient plane, and a
predicted-against-measured panel. **Canvas height is a function of the width**
(`ROW_TOP + panelSide(w) + ROW_BOTTOM` — 423px at the narrow frame, 541 at the
wide) because the two panels have to stay square. No animation, no seed, no
`shown`.

What remains is the fingerprint question at the top of this file, then the
shipping steps under *Then*.

### The design decisions, so they are not re-argued

- **Layout D2**, chosen from a four-way mock-up: equation on top, bars full
  width, then the plane and the predictions as two squares of equal standing.
  **The squares fill the row** (P3 of four in `_lab/linreg-panel-width.html`) and
  the canvas is however tall that makes it — they are square because the
  diamond has to look like a diamond, so wider costs taller. The 228px cap they
  used to carry left 206px of the row empty at the wide frame.
- **The matrix is in the RAIL, as core's `matrix` control**, chosen as C4a from
  two rounds of `_lab/linreg-matrix-rail.html`. It replaces a 156-option
  dropdown rather than sitting beside one: the dropdown's 66px of rail is the
  difference between a grid smaller than the canvas's and one half again bigger.
  **Both axes named in full**, the columns turned ninety degrees — at 45° the
  names cleared each other by 2.3px against an 11px type size, at 90° by 7.8px.

  It was on the CANVAS first, placement M1 of four, unlabelled because thirteen
  row names plus thirteen rotated column names cost more room than a 150px grid.
  What moved it was a measurement nobody had taken: the rail is 444px against a
  654px stage, so it had 210px of slack, and it is 300px wide against the 150px
  the canvas could spare. Cells went 11.5px → 17.8px *with* the names, and the
  bars got 174px of width back.
- **All 156 ordered pairs, not 78.** `(i, j)` and `(j, i)` are the same two
  measurements with the axes swapped, and which is horizontal is a real
  difference on screen. The four-pair slider it replaced reached elongations
  1.09–4.77:1; the matrix reaches 1.01:1 (Age against Weight, r = 0.013 —
  contours so nearly circular that the diamond and the circle become the same
  shape, which is the case where the L1/L2 distinction stops mattering) and
  5.73:1 (Weight against Hip). Neither end was reachable before.
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

- **A `requestAnimationFrame` measurement reported the PREVIOUS frame.** The panel
  mock-up measured its heights in a rAF after rendering, and after a width change
  it printed the old stage height beside the new rail height — the two columns
  disagreeing about which frame they were in, which is worse than no number.
  Reading a bounding rect forces layout, so **measure synchronously at the end of
  the render**; the rAF buys nothing and costs correctness.
- **A batch of scripted edits is all-or-nothing, and a failed assert is silent.**
  Two edits in this session did not land — a stale `76.3px` and a blurb — because
  a *later* replacement in the same script threw, so the file was never written
  and the earlier ones went with it. It looks exactly like success: no error in
  the file, no diff. Either write after each replacement or grep for the new text
  afterwards.
- **A screenshot of a long page comes back black once it is scrolled.** The
  browser pane paints the top of the document; `scrollIntoView` then screenshot
  gives a black frame with no error. Hide the cards above the one you want and
  screenshot at the top instead.
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

**`widgets/_lab/index.html` has stopped being an index.** Thirteen of the
twenty-six lab pages are missing from it — exactly half, including every mock-up
made for widgets 13 and 14 and all three drive-row pages. Adding one alone makes
the list *more* misleading, not less, so this is one change: catch the index up in
a single pass, or delete it. To list them:

```bash
for f in widgets/_lab/*.html; do b=$(basename "$f"); case $b in index.html|fingerprint.html) continue;; esac; grep -q "$b" widgets/_lab/index.html || echo "$b"; done
```

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
