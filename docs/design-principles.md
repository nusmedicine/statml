# Design principles

Input to the PRD. Every principle below was **earned from a specific incident**
while building the reference widget, and each carries the incident with it — a
principle you can't trace to a thing that went wrong is a preference, and it will
be argued about forever. Where something is still open, it says so.

The test for each of these is not "is it true" but "does it hold across forty
widgets". The reference widget is one. Several principles are marked as
provisional for exactly that reason.

---

## 1 · State

### 1.1 Parameters are the only state of record

The URL, the controls, and the shareable link all track one object. Interaction
state — an animation in flight, a hover, a selection — lives separately and
**never writes back into parameters**.

> *Earned:* the first animation ramped a parameter by mutating it. An animation
> interrupted by a resize left the URL claiming one thing and the figure showing
> another, and a mid-flight frame read as a legitimate answer — "of 1 means",
> observed SD "—". A screenshot of it looked like a bug in the statistics.

### 1.2 All state lives in the URL

Not in a store, not in a component. Three things follow, and they are the reason
the architecture is worth anything:

- the Python helper is a query-string builder, ~200 lines, no kernel protocol
- **"Copy link" makes the instructor an author** — tune the figure by hand until
  it makes the point, copy, paste into a notebook. Nobody hand-writes parameters
- the book and the notebook embed the same widget at different states

### 1.3 Everything is seeded

Same URL, same picture, in March and in September. "Everyone look at the third
bar" works. Changing the seed becomes a deliberate teaching move — *is this
pattern real, or is it noise?* — instead of an accident.

### 1.4 `compute()` is pure and runs on parameter change only, never per frame

Animation is a progressive **reveal of already-computed data**, not a simulation
running live.

> *Earned:* recomputing 2000 samples per frame was unusable. But the deeper
> payoff was accidental: because the data is computed up front, Play lands
> *exactly* on the picture the seed promises rather than somewhere near it.

Corollary: `compute()` being pure and seeded is what will make this testable.
No test harness exists yet; that is the cheapest thing on the backlog.

---

## 2 · The figure as an argument

### 2.1 Don't open on the answer

A widget with a result the student should reach **starts empty**. They build it.

To publish a *finished* figure — a recap slide, two end states side by side —
expose a parameter for it (`?shown=400`), never a special case in core. That keeps
the authored state in the URL and therefore shareable.

> *Earned twice.* First: the widget opened on a completed 400-sample histogram,
> which gave away the punchline before the student had done anything. Second: the
> authored `shown` was being re-applied on *every* parameter change, so switching
> population handed you a fresh spoiled figure. **Authored state describes how a
> figure arrives, not a property it keeps** — once the reader touches a control
> they are exploring, and exploring must be spoiler-free.

### 2.2 Show the mechanism, not the result

A finished histogram of sample means looks exactly like a histogram of data, and
it is not one. The step students miss is that **every bar is a pile of averages**,
each summarising n observations that no longer appear anywhere on screen.

So the animation draws n observations at their sampled values, collapses them
visibly into their mean, and drops that single number into the pile. The collapse
is the whole point; the histogram is the by-product.

### 2.3 Show a countable thing while the count is small

One dot per observation while they can be counted; bars once they can't, with a
crossfade. **A single arrival must never be a two-pixel bar.**

> *Earned:* fixing the density axis to the finished picture — which is right for
> the endgame — made the first six arrivals invisible, defeating the entire
> purpose of animating the mechanism.

This also applies to *static* figures: small counts get a dot plot, large counts
get a histogram. Same rule, no special case for animation.

### 2.4 A claim waits until there is something to claim about

The normal curve appears only once there are enough means to justify drawing it.
A smooth curve over six dots is a lie told with a spline.

But the **smoothed density of what you have so far** appears early — at four
samples — because watching it lurch with every new sample *is* the lesson. Its
instability is honest information about how little six observations tell you.

The distinction: an *empirical* summary can be shown as soon as it exists, with
its noise visible. A *theoretical claim* has a threshold.

### 2.5 Fix the frame, not the data

An axis rescaled every frame hides the convergence that is the point. Ratchet it
upward, never downward, in nice steps.

> *Earned:* a per-frame axis made the bars appear to stay the same height while
> the numbers changed underneath — the exact opposite of the intended reading.
> Separately, a coarse 1/2/5 ladder wasted half the panel at a peak of 50.

### 2.6 Include the case that fails

"Heavy-tailed" exists because convergence there is visibly slow. A demo where
every population snaps to normal at n = 5 teaches that the CLT is magic, and the
student has learned a false rule ("n = 30 is enough") that we then have to undo.

### 2.7 Adjacency is the argument

Put each prediction next to its observation:

```
population μ, σ  →  observed mean of the means      (should land on μ)
predicted σ/√n   →  observed SD of the means        (should land on it)
```

Two adjacent pairs. Nothing needs to say "compare these".

**It decides where a reading goes, not just what sits beside what.** Widget 14's
two penalty dials produce four named models — linear, ridge, lasso, elastic net —
and the table naming them was first drawn on the figure, because that is where
figures go. Wrong: the table is a reading of the DIALS, not of the picture, so it
belongs in the rail directly under them, where moving α₁ off zero visibly moves
the lit cell one column right. On the canvas it was also painted over two of the
coefficient bars, and only looked clear because those two coefficients happen to
be small.

The test is not "is this a number?" but **"what produced it?"** — and the answer
puts it next to that.

### 2.8 Numbers track the partial state

While the picture builds, the readout reports what has actually been collected —
`of 37 means`. Students watch the observed SD converge on the predicted SE
instead of being shown the agreement as a finished fact.

### 2.9 On-screen copy names the quantity — no metaphors, no verdicts

Text a student reads on a figure must name the statistical quantity it is about.
A figure of speech makes the reader translate before they can think, and imports
connotations nobody agreed to.

> *Earned.* Widget 12's case-control note read **"you chose that — a fact about
> your budget"**, describing a death rate. Cut on sight: *don't use words like
> budget etc… please don't mix metaphors. use statistical language where
> possible and don't editorialize.* The number is not *like* a budget; it **is**
> the controls-per-case ratio, and the line that says so is both shorter and
> plainer. The pair became *"you counted this — it is the incidence"* against
> *"you set this — it is controls per case"*.

Three failure modes, all the same mistake:

- **A metaphor standing in for a quantity.** "your budget" for an enrolment
  ratio. Ask what the number is; if the sentence does not say, rewrite it.
- **Personifying the method.** "the cohort does not know who dies" — a study
  design does not know things. "the outcome has not been observed yet" is no
  longer and says the same thing without the fiction.
- **A verdict where a mechanism belongs.** "your ratio, nothing else", "by
  construction", "you chose this". State what produced the number and let the
  reader draw the conclusion; the whole point of a figure is that the conclusion
  is available to them.

Simple is not the same as figurative — usually the plainest sentence is the one
that names the actual quantity. **Source comments are exempt** and should stay as
vivid as they like: they are addressed to whoever changes the code next, and the
history of what failed is the most valuable thing in them.

---

## 3 · Controls and layout

### 3.1 Reading order is the instruction

```
title & question → setup → drive buttons → figure → legend → numbers → utilities
```

Setup first, so you choose what you are sampling from before sampling from it.
Drive buttons directly above the figure, so the control is beside the thing it
controls. Numbers last. Utilities quiet, at the bottom.

This is [PhET's implicit scaffolding][phet]: guide through layout, affordances,
and sequencing rather than instructions, and keep the learner's agency. Costs
nothing to get right and nothing to maintain.

### 3.2 Data changes and display changes are different events

A parameter marked `display: true` changes only how state is *drawn*. Those
**keep the student's work**; data changes start over.

> *Earned:* toggling "show normal" wiped out thirty samples the student had
> collected. A checkbox that demolishes the figure punishes exactly the
> comparison the checkbox exists to enable.

Some display changes still alter derived state — rescaling an axis changes the
binning — so the animation supplies a `rebuild` that re-derives everything
downstream from the part that is genuinely invariant. For the CLT widget that is
**one number**: how many samples have been drawn.

### 3.3 Choose a control by what the options mean, not how many there are

| shape | when |
|---|---|
| slider with tick labels | the options form a **magnitude** — left-to-right carries meaning |
| segmented buttons | a few **alternative readings**, all worth seeing at rest |
| dropdown | the list is too long for either |

Same data — a string key from a fixed list — in three shapes.

**A dropdown hides that a choice exists**, which is the wrong default for
something whose job is to be explored. Tick labels under a slider are mandatory
for the same reason: a bare slider shows a position and hides the positions.

### 3.4a A tall widget puts its controls beside the figure, not above it

Reading order (3.1) says setup first. It does **not** say setup *above*, and on a
widget tall enough to scroll those stop being the same thing: `power-and-error`
measured 1376 px in an 833 px viewport, which put the control block **848 px
above the table it changed**. Reaching a slider meant scrolling back past the
whole figure, which is the exact opposite of "the control is beside the thing it
controls".

`defineWidget({ layout: "side" })` puts the controls in a left rail and the
figure in its own column, stacking again below 880 px. With the simulation panel
behind an off-by-default toggle the same widget is **one screen**.

**Now used by all seven**, and the rollout was measured on the real widgets in
`_lab/side-layout.html` — injecting the same DOM `buildShell` builds, so every
canvas genuinely repainted at its new width rather than being estimated:

| | stacked | side | |
|---|---|---|---|
| `galton-board` | 987 | **740** | over a screen → fits |
| `clt` | 1020 | **766** | over a screen → fits |
| `permutation-test` | 1083 | **832** | over a screen → fits |
| `confidence-interval` | 1182 | **892** | over a screen → fits |
| `bootstrap` | 1184 | **930** | 30 px over, 254 better |
| `multiple-testing` | 1344 | **1014** | 114 px over, 330 better |

Every one saves 247–330 px and **the canvas gets WIDER doing it** — 694 → 770 —
so a figure gains room while its page shrinks. The cost is the honest one: that
is a rendering change to six shipped widgets, so all 39 fingerprint states were
rebaselined in the same commit, after confirming three consecutive runs were
byte-identical.

**The legend and the readout go in the stage, not below the split.** The rail is
what you SET; the stage is what you SEE, and both of those describe the figure —
the legend names its marks, the readout is its numbers. Left full width they made
the page two columns and then a band, a shape nothing in the content asks for.
Checked before moving, because the readout loses ~300 px there: no widget's tiles
wrap. If one ever does, that is a reason to revisit, not to let them fold.

Two things this cost, both worth stating:

- **Opt-in, not global.** Widening the shell for every widget would move every
  canvas and invalidate all 39 fingerprint baselines in one commit. Scoped to the
  widgets that ask, the suite still reported 39 MATCH after the change.
- **The bottleneck moves to the rail**, so the figure should *spend* the height
  the rail is already paying for rather than leave it blank — the curves panel
  grew from 128 to 228 px for free, which the projector wants.
- **~~The drive buttons belong in the figure's column.~~ Wrong, and corrected
  within the hour.** Moving them there was a literal reading of 3.1's "directly
  above the figure", and the first person to drive it said they kept losing track:
  the setup was on the left and Play was at the top, so operating the widget meant
  watching two separate control locations. 3.1's actual claim is that a control
  sits BESIDE the thing it controls, and under `side` the whole rail already does.
  **One column, one place to look** — and 3.1's wording is about a stacked layout,
  not a law about pixels.

> *Earned:* the widget was built stacked, and the first person to drive it said
> they had to scroll to the top to change the sample size. Six layouts were
> mocked to scale in `widgets/_lab/power-layout.html` with the viewport fold
> drawn on; the arithmetic picked the answer in one look, which taste would have
> argued about (principle 5.2).

### 3.4 Same interaction loop → same size

Draw one, Play, and Reset are pressed interchangeably, so they are the same size.
Emphasis comes from weight and ink; separation from a gap. **Never from geometry** —
a smaller Reset reads as a different *class* of control rather than a quieter
member of the same one.

**Amended: buttons may be GROUPED, which is not the same as ranked.** Step and
Play are two *paces* of one action, so they sit in one connected cluster and read
as a single control; Reset stays outside it and is never fenced with the things it
destroys. Every button is still the same size, so the rule above is intact — what
changed is that "separation from a gap" turned out to have a cost nobody had
measured.

> *Earned, and the deciding fact was arithmetic.* Three separate drive buttons
> need 273 px. The control rail added by 3.4a is 262, so the row wrapped and Reset
> fell to a second line looking accidental. Fencing the pair reclaims exactly the
> inter-button gap that overflowed, and all seven widgets then fit one line at both
> widths. Five alternatives were mocked in `_lab/drive-row.html`; putting Reset
> inside the cluster also fits and was rejected on meaning, not on space.

**A lead action needs no special arrangement** — it simply precedes the cluster.
An earlier draft invented a stacked layout for the four-button case and it looked
wrong because it was solving a problem that does not arise: the only widget on the
narrow rail has no lead button. A bonus fell out of the fence: before the lead has
run, Step and Play dim *together* inside it, which reads as one unavailable
control rather than two unexplained dead buttons.

### 3.4b A stage the reader has not entered shows none of its controls

3.5 says every control must carry an idea. The sharper version, learned on
`power-and-error`: it must carry one **at rest**. A seed with nothing random on
screen and a play speed with nothing playing are not quiet controls, they are
questions the reader has to rule out before the figure gets attention — and the
drive buttons beside them promise a loop that does not exist yet.

So a widget with a second stage puts the whole stage behind **one button**, and
that button sits **in the control flow at the point the stage begins** — as a
`gate` field, behind a divider, with the controls it reveals directly beneath it
and the drive buttons behind a second divider after those. The drive row was the
obvious home and was wrong for the same reason 3.4a records: it split the setup
across two places on screen.

`power-and-error` reads, top to bottom in one column:

```
True effect · Samples per group · Threshold α · Read the axis as
──────────────────────────────
[ Simulate to check ]                  <- shut: 5 controls, 809 px
──────────────────────────────
Seed · Play speed · Expected shape     <- open: 8 controls, 1052 px
──────────────────────────────
Run a study · Play · Reset
```

Three properties it must have, and the first two are what make it a button rather
than an action:

- **It writes to a real parameter.** `?studies=1` reproduces the stage, so a
  copied link lands the reader where the author was. Invariant 1 does not bend for
  chrome.
- **It names the way back.** *Simulate to check* → *Hide the studies*. A one-way
  reveal is a trapdoor, and `aria-pressed` has to be able to say which state it is
  in.
- **It is a display parameter, so leaving does not destroy.** Close the stage
  after 37 studies, reopen, and the 37 are still there — verified. A gate that
  discarded the work would punish the comparison it exists to enable, which is 3.2
  in a new costume.

Core carries two small additions for this: `when: { param }` on a field,
declarative rather than a predicate function **so core knows which parameter gates
what** and can rebuild the control block only when that one moves — rebuilding on
every change drops a slider mid-drag; and a `gate` field type, which renders the
button and is the **single** declaration of which parameter opens the stage. Core
finds it by scanning the spec and hides step/run/reset with `hidden` rather than
disabling them, because a disabled button still advertises a control the reader
cannot use. It was briefly declared twice — once as a control and once under
`animation` — which is exactly the shape principle 5.8 exists to prevent.

### 3.4d A control that relabels itself reserves its widest label

The run button is four buttons wearing one slot: **Play → Pause → Resume**, and
**Replay** once finished. Measured at `--fs-md` those are 59 / 70 / 75 / 83 px, so
the drive row's geometry depended on the animation's *state*. Two costs, and the
second only appears in a narrow track:

- the row twitched on every press, at every width
- in the control rail, "Resume" alone overflowed and dropped Reset onto a second
  line — so pausing an animation visibly broke the layout

Core now measures every label the slot can hold and pins `min-width` to the widest.
**The row's shape stops being a function of what the animation is doing.**

Two things this cost, both worth keeping:

- **Measure off a detached probe, never by writing labels into the live button.**
  It is a flex item and an overflowing row can *shrink* it, so measuring in place
  sometimes reports the squeezed width and confirms a fit that is not there.
- **Reserving the widest makes a marginal row fail honestly.** Once pinned, the
  worst case is always on screen: 283 px of buttons in a 270 px rail, wrapping in
  every state rather than three states in four. That is the correct outcome — the
  rail was simply too narrow — and the rail is now sized to the row (300 px)
  rather than the row squeezed into the rail.

> *Earned, and it is principle 5.6 in a new costume.* Every check of this row —
> including the five-variant mockup that chose the cluster — had measured it in
> its **initial** state. Three of the four labels only exist after something has
> been pressed, so no amount of care about the starting picture could have found
> this. It was reported from a lecture-sized window by someone pressing Pause.

### 3.4e In a rail, the drive row is a BLOCK, not a line that happens to fit

A wrapping flex row is a layout that depends on how long its labels are, and
labels change — at runtime, when the run button relabels itself, and at authoring
time, when a widget is added. In the 300 px rail the drive row is therefore
**stacked full-width rows**: the lead if there is one, then the fenced step/play
pair, then Reset. Nothing about it can come adrift.

Two earlier attempts, both measured at the real track in `_lab/drive-rail.html`:

| | rows | worst edge gap | hostile futures failing |
|---|---|---|---|
| wrap, and grow Reset to fill its line | 1–2 | **42 px** | **5 of 5** |
| lead on its own row, cluster + Reset share the next | 1–2 | **89 px** | 0 of 5 |
| **stacked full-width rows** | 2–3 | **0 px** | **0 of 5** |

The fragility column is the one that decided it. The first rule looks fine on the
seven widgets that exist and fails **every** hypothetical widget with a longer
label — which is the definition of a layout that is about to break on someone
else. It costs 20 px of height to be immune.

**A column that must not wrap has to say so.** `.w-drive` carries
`flex-wrap: wrap` for the stacked layout, and switching the direction to `column`
in the rail without turning it off asks the container to wrap items into extra
*columns*. With an indefinite main size that resolves the cluster **19.5 px —
exactly one line-height — taller than its own content**, and the segments stretch
to match, so the pair sat visibly taller than the Reset beneath it. Nothing in any
button's own styles explained it; two independent toggles (`flex-wrap: nowrap` on
the row, or `flex: 0 0 auto` on a segment) each collapsed it, which is what
identified the container as the culprit rather than the buttons.

Three details that fall out:

- **The lead stays outside the fence**, so a widget with one gets three rows
  rather than two. A lead is once-only and a step repeats; fencing them together
  would say they are the same class of action, which is the distinction widgets 3
  and 5 exist to teach.
- **The run button's reserved width (3.4d) is dropped in the rail.** The cluster
  is full width and its segments are `flex: 1`, so a relabel cannot reflow
  anything, and honouring the reserve would break the equal split instead. That
  is only possible because core sets the reservation as a **custom property**
  rather than an inline style — an inline style beats every rule, and a variable
  does not. The override also has to *win*: at equal specificity the later rule
  takes it, so the rail's is written one class deeper on purpose. It bites
  invisibly at two segments, where the share is wider than the reserve anyway,
  and visibly at three.

> *Earned:* three rounds on the same row. Reset wrapped and looked accidental;
> then it was made to grow, which fixed the wrap and left the rows' right edges
> disagreeing; then it was pointed out that the right edge still did not line up.
> Each fix was a local repair to a layout whose shape was never guaranteed. The
> question that ended it was **"is it fragile to future widgets?"** — which is
> answerable by measurement, and was.

### 3.4c A drive label names the widget's noun, and a lead must not read like a step

Core already said the first half: *"labels are the widget's to name — a Galton
board drops balls, it does not draw samples. Generic verbs make a widget feel like
a demo of a framework."* Right, and insufficient: it permits two labels in
different widgets to describe opposite classes of action in nearly the same words.

Audited across all seven (`_lab/drive-labels.html`), the worst find was
`permutation-test`'s **lead** "Run the study" against `confidence-interval`'s and
`power-and-error`'s **step** "Run a study". A once-only action and a
repeat-forever one, four characters apart, met six weeks apart in different
lessons. Nothing about the phrasing tells a student which is which, and when the
lead greys out its permanence reads as a fault rather than the lesson it is.

So, in priority order: **name the widget's own noun**; **a lead must not be a
near-synonym of any step**; **the same class of action should read the same across
the arc**; and **fit the narrowest track it will appear in** — a step label has
about 130 px once Play and Reset are paid for, which ruled out a whole candidate
scheme by measurement rather than by taste ("Run another study" wraps the rail).

**Settled: one word where it is honest, two where one word misleads.** Four
schemes were measured in `_lab/drive-labels.html` — all of them fit, so the choice
was meaning, not space:

| widget | lead | step |
|---|---|---|
| `galton-board` | — | **Drop** |
| `clt` | — | **Draw sample** |
| `bootstrap` | **Sample** | **Resample** |
| `confidence-interval` | — | **New study** |
| `permutation-test` | **Observe** | **Shuffle** |
| `multiple-testing` | — | **Test batch** |
| `power-and-error` | — | **New study** |

Three things that fell out of doing it:

- **`Sample` / `Resample` is the best label in the project.** One prefix carries
  bootstrap's entire lesson — the draw you get once against the draw you can
  repeat — and the step went from 143 px to 62. The widget's own comment already
  said that asymmetry *is* the teaching; now the buttons say it too.
- **Stripping filler made the collision WORSE.** "Run the study" and "Run a study"
  both reduce to "Run study", byte-identical for opposite classes of action. The
  fix had to be a different word, not fewer: `Observe` is what you do once, to the
  real world, against the `Shuffle` that invents fictions.
- **A one-word face must put its noun in the `title`.** "Drop" and "Test batch"
  have nowhere to say what they drop or test, so `leadTitle` / `stepTitle` /
  `runTitle` were added and every widget authors its own. **Shortening a label
  without rehoming its noun is how a control stops explaining itself** — and
  `clt` was the warning: it had been riding core's default "Draw one" for its
  whole life, naming no noun at all, in the one widget where "one *what*" is
  precisely what the student is trying to work out.

Longer explanations belong in the button's `title`, not on its face.

**Amended: a step label may depend on a parameter, and has to declare which
one.** 3.4c assumes one widget drives one noun, and that assumption broke on
widget 9: three of its tabs advance the DATA by one observation and the fourth
advances a SAMPLER by one draw. Those are not the same kind of thing, and one
label honest for both does not exist — widget 8 hit a weaker version of this
with its sweeps and its climb, and settled for the bland "Step", which names no
noun at all and is exactly what 3.4c's `clt` warning was about.

Core now accepts a map, and the map form is declarative for the same reason
`when: { param }` is:

```js
stepLabel: { param: 'view', labels: { mcmc: 'Propose a move' },
             default: 'Add a count' },
```

**A function would have been shorter and wrong.** Core needs two things: the
current label, and *every label the button can ever hold* — because 3.4d
reserves the button's width against the widest, and a label that changes at
runtime is precisely the defect 3.4d records. A function supplies the first and
cannot supply the second. The reservation was generalised from the run button to
any relabelling button in the same change; in the rail both are dropped by the
`flex: 1` override, which is still correct there.

### 3.4f `detail` must render wherever it is declared

`params.js` documents `detail` as something any field may carry. Three of the
five field types dropped it on the floor:

| type | what it did with `detail` |
|---|---|
| `choice`, `gate` | rendered it, as a visible line |
| `segmented` | put it in a `title` tooltip — invisible on a projector, unreachable on a touch screen |
| `int`, `float` | **nothing at all** — fixed when this was written |
| `bool` | **nothing at all** — and missed by both earlier passes |

**Fixed three times, and the third time is the interesting one.** `bool` is not
in the table above because the table was written from the widgets that existed:
no checkbox had ever declared a `detail`, so nothing looked broken. When widget
14 wrote one it went nowhere, silently, exactly as `int` and `float` had. A
survey of what is currently declared is not a survey of what the contract
promises — the rule is about the CONTRACT, so the audit has to be too.

The fix also had a layout constraint the others did not: `.w-bools` is a flex
ROW, so a paragraph appended to it lands between two checkboxes rather than under
its own. Each switch now sits in its own column.

So four widgets had written explanations that nobody has ever seen. Widget 8's
`trueSize` slider carries the warning that a LARGER size means LESS spread — the
one thing about that parameterisation that catches people, and its own header
says "the direction warning is therefore the widget's job". It was never on
screen. Widget 9's tab strip carried the distinction between an exact grid and a
sampler, which is the entire reason its fourth tab exists; also never on screen.

**A field's declared copy is a promise the framework has to keep.** Same field,
same job, same rendering, everywhere.

> *Earned:* the question "how can we indicate that mu/size/Both are grid
> approximations and MCMC is not?" — asked about a widget where that sentence
> was already written, already reviewed, and rendering into a tooltip. The
> defect was invisible precisely because the fix looked done.

Two things fell out, both worth stating:

- **It surfaces copy in five shipped widgets at once.** Read it before shipping
  the fix; it was written to be read, but it was written without being seen.
- **`manifest.json`'s `height` is now stale for every widget, and nothing reads
  it.** The embedders that consumed it were deleted ([prd.md](prd.md) §6), so
  the field has had no consumer since — and measured at the harness's own 900px
  frame, every recorded height is 190–310px too tall, left over from before the
  `side` layout rollout. A number nothing reads is a number that drifts. Either
  fix all nine against a stated width or delete the field; do not leave it.

### 3.4h Replay replays the loop; only Reset undoes the lead

A lead action is the thing you get once — bootstrap's single sample, widget 8's
twelve counts, widget 9's dealt sample. Core re-ran `init` from nothing on
Replay, which threw the lead away, so a button labelled **Replay** produced a
blank figure with step and run disabled and a hint telling you to press the lead
again.

`init` now receives `leadDone`, and a widget with a lead honours it:

    init: ({ leadDone }) => ({ leadDone: Boolean(leadDone), ... })

Two buttons, two jobs, and the distinction is the teaching: **Replay** re-runs
the repeatable part, **Reset** goes back to before the one-off. That is what
makes the lead greying out mean anything — it is not a technicality if exactly
one control undoes it.

> *Earned:* asked whether widget 9's tabs should be gated so a reader has to
> "play through" each one. They should not — its first three tabs are three
> views of ONE accumulation, and a sample observed once has been observed —
> but the underlying want, *watch this tab build*, was already available through
> Replay and unusable because Replay un-dealt the data.

### 3.4g A control block with two kinds of thing in it says so in its shape

Seven sliders in one list read as one list. Widget 9's first four describe a
population it is pretending not to know; its next three describe a belief about
that population. Those are not the same kind of thing at all — one is the truth,
the other is an assumption you brought — and a reader who cannot tell them apart
asks, reasonably, why maximum likelihood did not need the extra parameters.

Core gained a `section` field: a labelled divider, declared in the spec between
the two groups because the spec is where the block's ORDER lives and a divider
declared anywhere else could not say which two groups it comes between. It
carries no value and never reaches the URL.

The same argument settled a segmented control. Widget 9's four tabs are three
grid computations and one sampler, and that difference matters *before* you
choose, not after. It was a `detail` line that changed as you clicked; it is now
two rows with a caption each:

```
[ mu ][ size ][ Both ]     exact — one grid, added up
[ MCMC ]                   approximate — sampled, never enumerated
```

Options declare a `group`, consecutive options sharing one form a row. **Saying
it in the shape beats saying it in a caption**, because the shape is true before
the reader has done anything.

> *Earned:* three separate questions about the same widget — "is `give or take`
> needed?", "can you separate the true distribution from the prior?", "can we
> show that mu/size/Both are exact and MCMC is not?" — all of which had prose
> answers on screen and none of which had a structural one. Prose is what you
> reach for when the layout is not carrying the distinction.

**A corollary for the labels.** Naming the distribution does the work three
lines of explanation were doing badly: `mu — a Normal centred at`, `…give or
take`, `size — an Exponential with mean`. That is where a prior's cost against
maximum likelihood is taught — one distribution per parameter, each with its own
numbers — and it is shorter than the paragraph it replaced.

**And a heading has to outrank a label.** The first attempt made both `--fs-sm`
on `--ink-2` and gave the heading a bolder weight, which is one signal; the
blocks were reported as not apparent. A heading differs in KIND: primary ink
against the labels' secondary, and a full line of air above rather than the gap
between two fields. Four signals where there was one. Keep the heading itself to
two or three words — `The population`, `Your prior`, `The inference` — because a
heading that needs a subordinate clause is doing the block's explaining for it.

### 3.4i Two numbers that are one idea go on one line

A field may declare `row: { key, label, token, detail }`. Consecutive fields
sharing `key` render inside one flex row under a caption, and `token` puts a
swatch of `--c-<token>` beside that caption.

> *Earned:* widget 10 sets two populations, each with a centre and a spread.
> Declared as four full-width sliders they read as four unrelated numbers, and
> the labels — "Average child height", "Spread of child heights" — were doing
> the grouping the layout should have done. The rail is 300px, so a paired field
> gets 142px: enough for `average` and its value, not for a sentence. **That is
> the point rather than the cost** — the caption carries the noun and the field
> carries the quantity, which is shorter copy in both places.

The swatch is the part worth keeping. A control block that sets a population the
figure draws in amber should say *amber* where you set it, not leave the reader
to infer it from the result — and widget 10 shows both groups in those two
colours during setup, so the rail and the figure agree before anything is fitted.

`detail` on the row belongs to the PAIR: widget 10's "set wider than the
children's and the overlap is lopsided" is a fact about two spreads together and
would be a lie under either slider alone.

Declarative for the same reason `when` is: core groups before it renders.

---

### 3.4j The answer goes BELOW the drive row

3.4e fixes the drive row as the last thing in the rail, and that stays right for
anything you set before pressing a button. It is wrong for the one kind of
control that only means something afterwards. A field marked `afterDrive: true`
builds into a second control block under the buttons.

> *Earned:* widget 10 withholds which people were really children. That reveal
> was the third option of a `segmented` "colour each person by", and two things
> were wrong with it. A reader met the **answer** in the setup block before
> having asked a question, and reported it as confusing. And because a segmented
> control has exactly one selection, choosing the reveal visibly **deselected**
> the other two — so asking to see the truth looked like it had switched the fit
> off.

As its own checkbox below the buttons it composes rather than competes: the fit
stays whatever you were reading it as, and the truth lies over the top.

**A sticky reveal must still respect a reset.** `display: true` keeps a
parameter across a data change, which is right — but widget 10's true curves
then stayed on screen over a figure that had just been reset to nothing, which
was reported as a bug. The widget cannot clear the parameter (1.1), so the
*reveal* is conditioned on there being a result to lie behind: no result, no
truth, and it returns by itself on the first step. **A revealed answer is a
reference behind something, not a layer on its own.**

---

### 3.4k A block that reserves lines must reserve LINE BOXES

3.4d is the horizontal case: a control whose label can change reserves its widest
label, so the row's shape stops being a function of what is in it. The vertical
case is a block of flowing text whose *length* changes — widget 14's equation is
as long as the model is big — and the same fix applies: reserve the tallest case
so the figure below it does not move as the reader drags a dial.

**But lines and line-heights are not the same thing.** A line box is as tall as
the tallest inline box on it, and `line-height` only sets the *strut*. Anything
that descends past the strut — a subscript, a superscript, an inline image, a
`<math>` element — makes that line taller than the line-height and every other
line stays short. So a block reserving `3 x line-height` reserves three lines only
while every line happens to be plain text.

> *Earned:* the equation's terms became `z` with the measurement subscripted.
> `.w-math-eq` reserved `4.65em`, written as "3 x the 1.55 line-height above", and
> that had been flat at every width for as long as the terms were `z(Name)`. Each
> `<msub>` pushes its line box from 17.05px to 18.54px, so the block came out
> 51.15px, 54.13px or 55.62px depending on **which terms landed on which line** —
> the figure jogged 4.5px as a dial moved, under a comment that said it did not.
> Nothing failed: not `check`, not all 105 fingerprint states, not the screenshot.

Two ways out, and they are not equivalent:

- **Raise the reserve** to the measured tallest case. Keeps the leading the
  design was chosen with, and is a measured constant — so it is only as good as
  the platform it was measured on.
- **Raise the `line-height`** until the strut contains the tallest inline box.
  Uniform by mechanism rather than by measurement, and it costs the whole block:
  1.78 was the threshold here against the 1.55 the typesetting was picked at.

Widget 14 takes the first, because the mock-up Kenneth chose from was drawn at
1.55 and leading is part of what he was choosing. **Measure the worst case over
every state AND every width the layout reaches** — 49 dial settings x the 534px
to 770px the side layout spans — not the one on screen.

**And then a box put it straight back.** The equation was later given a card, and
padding narrows the column the text wraps in: thirteen terms need a FOURTH line
below 512px, and 12px of padding each side of the narrowest 534px column leaves
508. The block jogged 15.5px — three times the fault this rule was written
about — and nothing in the change looked like it touched the equation at all.
The horizontal padding is `--sp-2` rather than `--sp-3` for that reason alone.
**A reserve is a promise about a column width; anything that narrows the column
is a change to the reserve.**

A hanging indent is the same thing said a third way, and there it was paid on
purpose. Aligning the equation's continuation lines under the right-hand side of
the `=` indents every line after the first by 91px, which costs exactly one line
at the narrowest column — four rather than three. The reserve went to four, and
because a reserve is one number for every width, a wide frame now carries a line
of slack inside the card. **That is what a reserve costs: the worst case, paid
everywhere.** It is still the right trade against a block that changes height as
a dial moves, but it is a trade and not a free win.

---

### 4.4 Opening a gate may play the stage in

A gate is the one parameter change that is a reader stepping *through a door*
rather than turning a dial, and what is behind it can be worth watching arrive.
A widget opts in by setting `anim.entry` in `init`; core starts `advance` in
mode `'enter'` when — and only when — the gate **opens**.

> *Earned:* widget 10's sample used to appear as 200 dots at once. It falls out
> of the two curves it was drawn from now, which is the sampling idea itself and
> was lost in the pop.

Three things this has to get right, all of them found by getting them wrong:

- **Only the gate, only on open.** An ordinary data change must not trigger it,
  or dragging a slider restarts the animation on every `input` event it fires.
- **`'enter'` is exempt from "advanced", like `'lead'`.** `tick` sets
  `hasAdvanced` after every advance, so without the exemption the run button
  offers to **Resume** a stage that has only just been entered.
- **The flag is the trigger, not the clock.** Keying the animation's progress
  off `fromScratch` looks right and is wrong: Replay re-inits with `fromScratch`
  true and nothing plays an entry, so the pile froze halfway out of the curves.
  Progress starts at *finished*; `advance` consumes `entry` on its first frame
  and resets the clock. Every other path — a shared link, a fingerprint state, a
  Replay — leaves it finished, which is what keeps an authored state authored.

---

### 3.5 Every control must carry an idea

Save PNG and a bin-by-bin table are opt-in and off by default. Every extra
control is one more thing to rule out before the concept gets attention, and the
applet literature is blunt about it: [less guidance produced more engagement][phet].

**Open:** the reference widget has eight controls. That is rich for a lecture demo
and busy for a book figure. A cap ("one idea, at most N controls, seed always
last") would keep forty widgets coherent but means cutting things. Unresolved.

### 3.6 A click on the figure is a control, and obeys every rule a control does

A widget may make its canvas clickable — a cell of a drawn correlation matrix, a
node of a drawn tree. The temptation is to treat that as a different kind of
thing from a slider, because it is drawn rather than declared. It is not.

**It sets a parameter, or it is a second state of record.** The URL, the rail and
the figure all track `values` (1.1). A click that kept its selection anywhere
else would make the widget lie about itself the moment the reader copied the
link. `probability-mechanisms` got this right from the start; the machinery to
make it right *generally* took longer, because the exported `setParam` did not
tell the rail anything, and that widget only survived by luck — both parameters
it sets happen to gate another field, so the rebuild resynced the rail as a side
effect. A parameter that gates nothing got no such rescue.

**The control stays.** A dropdown reaching the same parameter is the keyboard and
screen-reader path; the drawn target is a shortcut, never the only route. A
figure you can only operate with a mouse is a figure some readers cannot operate.

**One parameter per target.** Two would paint an intermediate state nobody asked
for, write the URL twice, and — the reason that actually bites — make the click a
different transaction from the one a test performs, so the harness would verify a
sequence the reader never takes.

**A target table can be wrong in exactly two ways, and both throw at load.** A
parameter that does not exist, and a value that is not one of its options. Both
are code defects, so both fail where every other driver in this repo fails,
rather than being coerced into the default — which would turn a click that does
the wrong thing into a click that quietly does something else.

---

## 4 · Pacing

### 4.1 Pacing is chosen, not automatic

Play runs at a speed the user sets and continues to the target count. Past a
threshold the per-sample choreography switches off and only the arrivals show —
but that is a **declared property of the chosen speed**, not something the
animation decides about itself mid-run.

> *Earned:* Play originally accelerated on its own. This is precisely what
> [Mayer's segmenting principle][segmenting] warns against — people learn better
> from user-paced segments than a continuous unit, and the effect is strongest
> when "the material is complex, the presentation is fast-paced, and the learner
> is inexperienced". An auto-accelerating animation takes the pacing decision
> away from the only person who can see how fast the room is following.

### 4.2 Stepping must stay responsive

A second click on "Draw one" mid-step **fast-forwards the sample in flight** and
starts the next, rather than being swallowed.

> *Earned:* the button disabled itself for the 1.5 s its own animation ran. Rapid
> clicking produced 2 samples from 14 clicks — and repeated clicking is the
> primary affordance.

### 4.4 A display change may deserve a transition — and almost none do

A `display` parameter repaints and does not animate, because for an overlay a
jump is correct: the thing being toggled is decoration over a figure that has
not moved. Some toggles are not that. When two settings are two **readings of
the same data**, easing between them is what shows it is the same data — a jump
can only assert it.

Core supplies the frames and nothing else: the widget sets `anim.easing` in
`rebuild`, and core clears the flag when it starts the loop. Clearing matters.
`easing` is a *request*, and a request that survives being granted is granted
again — any display change while an ease is in flight would stop and restart the
loop, resetting its frame budget every time.

> *Earned:* widget 12's two denominators. The deaths must be **seen** not to move
> while what they are measured against does, and that is the widget's entire
> claim. It was first built with the reading as an ordinary display toggle,
> which made the claim a caption. Keep the exemption narrow: every widget before
> this one wants the jump.

### 4.4b A control's label names what THIS press will do

> *Earned.* The run button read **Resume** after a single Step. Reported as
> exactly that: *when I just do 1 step, it says resume, which confuses me.*

The label was chosen off `hasAdvanced`, a flag core set after **every** advance —
so any progress at all, from any source, relabelled a button the reader had never
touched. Three exemptions had already been bolted on for `lead`, `enter` and
`ease`, each added when that mode's turn came to produce the bug, and every new
mode would have had to remember to join the list.

**The list was the tell.** Patching a rule mode by mode means the rule is wrong:
*Resume is the counterpart of a Pause, not of progress.* A reader who never
pressed Pause has nothing to resume, and one who did press it is looking at a
button whose state they just set — so Play is unambiguous there too. The label is
now Play / Pause, plus **Replay** once finished, which survives because it is the
one label naming a genuinely different action: it restarts rather than continues.

The generalisation: **a control's label answers "what happens if I press this?" —
not "what has happened so far".** The second question is the figure's job.

Two things fell out, both worth having. `hasAdvanced` went entirely, from core
and from the two widgets that were maintaining it by hand; and the run button's
reserved width dropped a label, since "Resume" was the 75px one it was sized for.

### 4.5 A widget may decline a drive button it has no use for

`stepLabel: null` and `runLabel: null` remove the button. Omitting them still
gets the default, so this is an explicit statement rather than an oversight.

> *Earned:* widget 12 was built with the cohort being followed up ten patients at
> a time, which put a stopwatch on the part of epidemiology nobody watches — you
> get the 2×2 at the end, already complete. With the follow-up gone there is
> nothing to step: a lead works the ratios out once, and after that the only
> thing that happens is a toggle. **A dead Step beside a live toggle teaches that
> the toggle is the afterthought.**

---

### 4.3 Motion should read as the thing it depicts

A mean *falling into place* accelerates downward. Sideways motion, where two
panels have different scales, eases out early so the path arcs over and drops in.

> *Earned:* four candidate paths mocked up side by side with dots at equal time
> intervals so pacing was visible, not just shape. A linear diagonal read as a
> slide; an elbow made the corner an event that stole attention from the landing;
> a Bézier with lift implied upward motion the data does not have.

Transient cues are cleared when motion stops — a frozen half-faded highlight
reads as a *marked* bar rather than a recent arrival.

---

## 5 · Process

### 5.1 Mock up before implementing

Two comparison pages (`widgets/_lab/`) each changed a decision that would
otherwise have been argued about or built wrong. Both took under an hour. Keep
them: they are the record of *why*, which is the thing that gets lost.

### 5.2 Quantify the trade-off instead of arguing it

A continuous zoom slider was appealing until the numbers landed:

| n | 2 | 5 | 10 | 30 | 100 |
|---|---|---|---|---|---|
| available zoom travel | **1.1×** | **1.8×** | 2.5× | 4.4× | 8.0× |

A dead control at exactly the sample sizes where the lesson starts. That table
ended the discussion in one line; taste would not have.

### 5.3 Encode invariants in the data shape

Not in review, not in a comment.

- populations declare a **`halfWidth`, not a `domain`**, so every plotting window
  is μ-centred by construction and an off-centre one is unrepresentable. That is
  what lets a single rule carry μ across stacked panels
- discrete populations declare **`[value, probability]` masses**, not a binned
  array. The binned form silently parked the coin flip's second spike at x = 2,
  off the panel, for several iterations

### 5.4 Verify by assertion, not by screenshot

Screenshots caught real problems and also produced three phantom ones (stray
automation input moved sliders mid-capture). What actually settled things:
asserting all populations are μ-centred, that masses sum to 1 and agree with the
declared mean, that buttons measure 36 px, that display toggles preserve the
sample count while data changes reset it.

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts.** Never the reverse.

### 5.5 Make the dev loop deterministic

`scripts/serve.mjs` exists to send `Cache-Control: no-store`.

> *Earned:* a fix appeared not to work. The browser was serving a cached
> `widget.js` while the corrected file sat on disk — `python -m http.server` sends
> no cache headers and browsers cache ES modules hard. **That failure mode looks
> exactly like a bug in your own change.**

The deployed path has a milder version of it — GitHub Pages sends `max-age=600` —
which is accepted rather than fixed, because fixing it needs content-hashed
filenames and therefore a bundler.

### 5.6 A blind spot in the test suite must be named, never cited as safety

> *Earned, expensively.* Every fingerprint state passed `shown=` — a fully built
> figure — and `check.mjs` **required** it. Pre-filled states have nothing in
> flight, so no verification in the repo had ever rendered a moving part. A
> coordinate-system change then left every falling ball six columns off-centre and
> all eight states still matched. The commit before it had written *"nothing is in
> flight at a `shown=` state, so this is animation-only by construction"* as
> reassurance. That sentence was an accurate description of a blind spot, read as
> a safety property.

The generalisation: **verify the thing that only exists while it moves.** A
harness that can only photograph the finished state is not a weaker test of the
animation, it is no test of it. The fix was a second kind of state — the harness
supplies the frame clock, clicks a drive button, and steps a fixed number of
fixed-length frames before hashing. Seeded data plus a controlled clock makes a
mid-animation frame exactly as reproducible as a settled one.

Two habits fall out:

- **Prove a new check catches the bug it was built for.** Reintroduce the fault
  and watch it fail. Ours did: the driven states differed, every settled state
  still passed — which is simultaneously a passing regression test and a
  demonstration that the old suite could not have caught it.
- **Confirm determinism before baselining.** A flaky check is worse than none. Three
  consecutive identical runs, then record. (The first determinism check was itself
  wrong — it read the results table on a timer while it was still being built and
  reported non-determinism from shifted rows. Measurement error looks exactly like
  the failure it is measuring.)

**A second shape of blind spot, and it opens without anything breaking: a check
is scoped to a MEDIUM, so moving content out of that medium drops it out of
coverage silently.** Both cheap checks in this repo read the canvas — the
fingerprint hashes `toDataURL`, the text sweep wraps `fillText`. Widget 14 moved
its fitted equation into the DOM as MathML, and both stopped seeing thirteen
coefficients at once. No error, no gap in any output, just fewer strings in a
list nobody counts — and the canvas hash would have gone on reporting MATCH over
a flipped sign.

Nothing was broken by that move; the coverage simply did not follow the content.
So the rule has a second half: **when content changes medium, the check has to
change medium with it, or the loss gets named where the next reader will look.**
The fix was a second hash over the figure's text — which promptly showed the hole
was older and larger than the equation. **No widget's readout had ever been
hashed**, across all 105 states. Widget 14 did not create that blind spot, it
made it visible.

### 5.7 A harness addresses what it drives by identity, never by position

> *Earned, and caught in the act rather than after the fact.* The fingerprint
> harness took the drive buttons positionally — `buttons[click === "run" ? 1 : 0]`
> — which was correct for exactly as long as every widget had the same two
> buttons in the same order. Adding a third to `bootstrap` (a one-off "Sample the
> population" ahead of "Resample your sample") silently repointed **every driven
> state in the suite**: `step` began clicking the new lead button and `run` began
> clicking step. Verified directly rather than assumed.

The dangerous part is not that it breaks. It is that **a wrong button still
produces a stable, plausible hash** — the harness would have gone on reporting
MATCH against a baseline of the wrong animation, which is the same failure shape
as the settled-states blind spot in 5.6 and just as quiet.

Two fixes, and the second matters more than the first:

- buttons carry `data-key` and the harness selects on it, so a button is found by
  **what it does**, not where it sits
- **a driver that cannot do the thing must fail loudly, not do nothing.** Clicking
  a disabled button is a silent no-op that hashes an untouched figure, so the
  harness now throws — and a throw becomes `px = "error"`, which can never match
  a baseline. A driven state that forgets its widget has a setup stage fails
  instead of quietly photographing an empty panel.

The generalisation: **anything that reaches across a boundary to operate a UI
should name its target.** Positional addressing encodes an assumption about a
layout that nobody has agreed to keep.

**And a harness must be able to drive whatever the widget is driven by.** For
eleven widgets that meant a drive button, so `press` was the whole vocabulary.
Then widget 12 declined Play and Step (4.5) and eased on a segmented toggle
(4.4) — and its transitions became *undriveable*, which under 5.6 is a blind
spot with no floor under it: `check.mjs` demands a driven state from anything
declaring an `animation`, so the only way to satisfy the rule would have been to
add a button the widget does not want.

The fix generalises the same way `data-key` did. `controls.js` stamps
`data-param` on every settable control and `data-value` on every segmented
button — attributes nothing in the shipped page reads — and a drive spec may now
say `{ set: { against: "risk" }, frames: 6 }` instead of `{ click: "run" }`. A
`choice` slider additionally carries `data-options`, because its DOM value is an
*index*: without it a spec would have to name the position, which is exactly the
positional addressing this principle exists to forbid.

The trap it hides is the usual one. **The event differs by control and getting it
wrong is silent** — a range driven with `change` moves the thumb and never
reaches the widget, so the harness photographs an untouched figure and records a
stable, plausible hash for it. Same failure shape as clicking the wrong button,
same remedy: the setter throws when it cannot find the control or the option,
and a throw becomes `px = "error"`, which can never match a baseline.

**The one thing this principle does NOT forbid, and the reason is the whole
point.** A widget may make its canvas clickable (3.6), and the harness drives
those with `{ hit: [x, y] }` — a raw coordinate, which is exactly what the rest
of this principle spends a page outlawing.

It is not an exception, it is the rule read correctly. Positional addressing is
forbidden because a *control* has an identity — a name, a role, a `data-key` —
and using its position instead encodes an assumption about layout that nobody
agreed to keep. **A drawn region has no identity but its place on the figure.**
Its position is not a proxy for what it is; its position *is* what it is, and it
is the thing under test: no pixel hash can tell whether a target sits where it
is drawn or six columns away, because the picture is identical either way.

So the same discipline applies in the form the medium allows. The frame is a
fixed 900px wide, so a coordinate means the same thing every run. The verb
throws when the point is over no region — the widget's own cursor is the
detector — for the same reason `press` throws on a missing button: a click that
lands on empty canvas still leaves a stable, plausible hash.

### 5.8 One formula, one place

Shared geometry gets a single named function that every call site uses. Not a
comment saying "keep these in sync".

> *Earned:* the landing value moved to deviation units and the falling ball kept
> its own copy of the old formula. Two call sites, one formula each, is precisely
> how the halves of a figure come to disagree about where something is.

The cheap version of this is worth paying for even when it costs something:
`compute()` now builds every ball's path even for the balls whose path it will
throw away, purely so the landing value comes from the same function the animation
uses. A transient array of at most thirty entries in exchange for deleting a
duplicate formula.

---

## 6 · Known costs

Stated so the PRD can decide rather than discover.

**Canvas is not screen-readable.** Chosen for one code path across forty
animating figures. The readout tiles are the accessible reading of every figure —
that is why they are mandatory, not decorative. Dropping the table view removed
bin-level access for screen readers; the summary statistics remain.

**GitHub Pages sends `max-age=600`.** Students can get a stale widget for up to
ten minutes after a deploy. A proper fix is content-hashed filenames, which needs
a bundler and would end the no-build property. Probably worth it eventually; not
yet.

**~~`HEIGHTS` in the Python helper mirrors `manifest.json` by hand.~~ Closed.**
Three files carried each widget height and drifted. Both duplicates were in the
Quarto book and the Python helper, and deleting those ([prd.md](prd.md) §6) left
one copy. Worth keeping as a record of the shape of the fix: the cost was retired
by **removing the second consumer**, not by building the generator that had been
planned for it. Check first whether a duplicate still needs to exist.

**Dead space for skewed populations.** μ-centring puts the exponential on
`[-2.2, 4.2]` with nothing below zero — about a third of the panel. Accepted
because it also puts μ visibly right of the mode, which is the thing about skewed
distributions students most need to see. Revisit if it grates.

**Widget count: 1.** The pipeline was half a day. A good widget is 3–8 hours
including the pedagogical thinking, and a course-sized collection is 20–40 of
them. **The content is the project**; everything above exists to make widget #20
cost a fraction of widget #1.

---

## 7 · Open questions for the PRD

**All five are now answered in [prd.md](prd.md) §9.** Kept here because the
question is worth seeing next to the principle that raised it — but do not
re-litigate them from this list. In short: no control cap and no book mode; widget
prose stays thin but self-explanatory; CC-BY-4.0 prose and MIT code; print
fallback out of scope; the catalogue closed for PHM5003 and open for PHM5005.

1. **Control budget.** Is there a cap? Eight is too many for a book figure and
   about right for a lecture demo. Do book embeds get a reduced control set — and
   if so, is that a parameter or a separate build?
2. **How much prose lives inside the widget?** The subtitle and the chapter
   currently say overlapping things. One should be thin. A bare-figure widget
   narrated entirely by its host is a real alternative and changes widget height
   substantially.
3. **Licensing.** Public Pages means public content. CC-BY for prose and figures,
   MIT for code, is the obvious default — worth fixing before it spreads rather
   than after.
4. **Print fallback.** HTML-only was chosen, so no widget currently needs a
   static figure. Every widget can export a PNG (opt-in, off) which keeps the door
   open. Confirm this stays out of scope.
5. **The catalogue.** Which 20–40 concepts earn a widget, and in what order? This
   is the question the rest of the PRD is really about; nothing above answers it.

[segmenting]: https://www.cambridge.org/core/books/abs/multimedia-learning/segmenting-principle/37240877DDA0362355ADB39936027982
[phet]: https://phet.colorado.edu/en/research
