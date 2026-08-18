# Handover

State of the project and the next task, written so a fresh session can start
without re-deriving anything.

**Read [CLAUDE.md](CLAUDE.md) first**, then this. Before proposing scope, read
[docs/prd.md](docs/prd.md) — §11 lists non-goals so they can be pointed at rather
than re-argued. Before changing anything in `widgets/core/`, read
[docs/design-principles.md](docs/design-principles.md): most of its rules exist
because the obvious approach was tried and failed, and each carries the incident
that earned it.

**Last updated:** everything below is **pushed and live** — six shipped widgets
on the gallery, plus widget 7 `power-and-error` as a DRAFT at its final URL. All
seven now use the side layout. 39 fingerprint states, all MATCH.

**The next task is a new arc of three: MLE, MCMC and EM — see §2.** It is the
first arc since the original six and it needs its catalogue treatment before any
of it is built.

Three things are outstanding from the last session, all small, none blocking:

1. **Widget 7 has no fingerprint baseline.** Deliberate — drafts are exempt, and
   a baseline recorded before the design settles is thrown away. It is the last
   step before `draft` → `shipped`.
2. **Does red stay "called significant"?** In widget 7 red means *the decision
   you made*, identically in both rows of the 2×2 and in the pile, so the red
   column reads "α, then power". Colouring by CORRECTNESS instead would flip
   red's meaning between the two rows. Parked deliberately, by the author.
3. **`03/04-02`'s prose is wrong, and that is in the other repo.** The lesson
   says larger variance raises the type I error rate and lowers the true negative
   rate. Neither happens — α is fixed by construction. Replacing the Shiny app
   does not un-teach the sentence; catalogue.md's widget 7 section has the
   verified numbers. With the author.

Also noted, unrelated to any of the above: the deploy workflow warns that
`actions/checkout@v4`, `setup-node@v4` and `upload-artifact@v4` target Node 20,
which GitHub has deprecated and is force-running on Node 24. Building fine today;
a `@v5` bump is a small separate change.

---

## 1 · Where the project is

```bash
npm run dev      # :8000 unless taken; PORT=8123 npm run dev to move it
```

Paths below are the **deployed** ones. The dev server aliases `/widget/` onto the
`widgets/` source directory, so swapping `http://localhost:8000` for
`https://nusmedicine.github.io/statml` is the only difference between a dev URL
and a real one. The lab is not deployed and keeps its source path.

| | | |
|---|---|---|
| gallery | `/` | also the landing page |
| widget 1 | `/widget/galton-board/` | where the bell curve comes from |
| widget 2 | `/widget/clt/` | the sampling distribution of the mean |
| widget 3 | `/widget/bootstrap/` | uncertainty from one sample |
| widget 4 | `/widget/confidence-interval/` | a range of compatible effects, and how often it misses |
| widget 5 | `/widget/permutation-test/` | could chance alone have done this? |
| widget 6 | `/widget/multiple-testing/` | what if I do that twenty thousand times? |
| widget 7 | `/widget/power-and-error/` | **DRAFT** — you choose α; you do not choose β |
| lab | `/lab/` | the drafts — **not linked from the gallery** |
| dev lab | `/widgets/_lab/` | design mockups **and the fingerprint harness**; not deployed |

**The mockup pages are the record of *why*, and they are worth opening before
re-arguing any layout decision.** Each measures the real thing rather than
asserting; several reversed a decision that taste had already made:

| page | what it settled |
|---|---|
| `side-layout.html` | Whether every widget benefits from the rail. Injects the layout into the **live** widgets, so the canvases genuinely repaint. Saved 247–330px each |
| `power-layout.html` | Six layouts to scale with the viewport fold drawn on. Picked the rail in one look |
| `drive-row.html` | Five drive-row arrangements. **Was wrong in both directions before it measured itself** — see the traps list |
| `drive-labels.html` | Four label schemes, measured in px not characters. Killed one scheme outright ("Run another study" wraps the rail) |
| `drive-rail.html` | Three rail arrangements **against five hostile widgets that do not exist yet**. The fragility column is what decided it |

**Drafts.** A widget with `"status": "draft"` deploys to its **final** URL like
any other, wears a bar saying it is unfinished, is left off the gallery, is
indexed at `/lab/`, and is **exempt from needing fingerprint states** — because
baselining before the design settles throws the baseline away. Promotion is
`"draft"` → `"shipped"` in `manifest.json` **and** in its `main.js`; `npm run
check` fails if the two disagree, and the moment it ships the fingerprint
requirement returns. Nothing moves, so a link shared while building never breaks.

### Shipped

| arc | slug | what it does |
|---|---|---|
| 1 | `galton-board` | A ball takes a ±1 nudge at each row; the axis is **total deviation from zero**, so the pile reads as an error distribution from the outset. Exact binomial overlay. Lean shifts the pile off the zero rule, which is bias made visible. |
| 2 | `clt` | Draw one sample, watch its observations collapse to their mean, watch that mean drop into the pile. Normal σ/√n overlay. |
| 3 | `bootstrap` | **Two stages.** *Sample the population* draws your one sample, then greys out for good — you cannot go back for more. *Resample your sample* runs unlimited: copies stack above the observations they came from, so duplicates and never-picked values are both visible. The true sampling distribution sits behind the pile: **same width, different place.** |
| 4 | `confidence-interval` | One study's interval, then a hundred studies as a ladder against the true value, cut three ways — bootstrap, z, t. At n = 5 the z intervals miss far more than 1 in 20. |
| 5 | `permutation-test` | **Two stages again.** *Observe* the study once, then *Shuffle* unlimited. Every observation lifts into one pool and is dealt back — vertically only, so nothing leaves its value. The difference falls into the null below, and **a dot landing past the observed line turns red**, so p is *count the red ones*. Set the true effect to **None** and re-seed to watch a false positive happen. |
| 6 | `multiple-testing` | Three carpets of ADJUSTED p-values — raw, Bonferroni, BH — on one shared scale. Set real effects to 0 and about 1,000 of 20,000 still come back at p < 0.05. |
| 7 | `power-and-error` **DRAFT** | Two curves, a threshold, and a 2×2 of TP/FP/TN/FN. Axis toggles between the raw difference and the test statistic — the same test drawn twice. α is fixed by construction; only β moves. |

All start empty, all animate step by step, and all but widget 7's curves build
their pile with `core/accumulator.js`.

### What `core/` has gained, and what it is for

| addition | why |
|---|---|
| `layout: "side"` | Controls in a left rail beside the figure, legend and readout with the figure in the stage. **All seven widgets now use it** — measured on the real widgets in `_lab/side-layout.html`, saving 247–330px each and taking four of six from over-a-screen to fitting. The canvas got WIDER (694 → 770), so all 39 baselines moved and were re-recorded. Principle 3.4a |
| `height` may be a function of params | A panel that can be hidden has to give its pixels back, or a toggle trades a chart for the same amount of blank canvas |
| `when: { param }` on a field | Declarative, not a predicate — core has to know WHICH param gates what so it can rebuild the control block only when that one moves. Rebuilding on every change drops a slider mid-drag |
| `type: "gate"` field | A full-width button that opens a whole stage, sitting in the control flow where the stage begins. The single declaration of which param opens it; core scans for it. Principle 3.4b |
| `group` on a drive button | Fences step and play into one cluster — two *paces* of one action. Reset is never inside one. Principle 3.4 as amended |
| `leadTitle` / `stepTitle` / `runTitle` | One-word labels have nowhere to name their noun, so it moved into the tooltip. Principle 3.4c |
| reserved run-button width | Play/Pause/Resume/Replay are 59/70/75/83 px, so the row's shape used to depend on the animation's state. Set as a **custom property**, not an inline style, so the rail can drop it. Principle 3.4d |
| the drive row is a BLOCK in the rail | Stacked full-width rows, `flex-wrap: nowrap`. Chosen because the wrapping alternative fails **5 of 5** hypothetical future widgets in `_lab/drive-rail.html`. Principle 3.4e |
| `animation.leadLabel` + `anim.leadDone` | A one-off action before stepping means anything. The lead button greying out permanently **is** the teaching in both widgets 3 and 5. Core owns the button states; the widget owns `leadDone`. |
| `rng.resample(len)` → indices | Draws WITH replacement. Indices, not values, so the choreography can show *which* observation was picked twice. |
| `rng.shuffle(arr)` → new array | A permutation. The exact opposite move: every element survives once, only the arrangement changes. |
| `binsFor(total)` in `accumulator.js` | `clt` and `bootstrap` had chosen it identically — the second consumer is what says where a seam belongs. |
| `--c-group-a` / `--c-group-b` | Two arms of a comparison. Blue and amber: not orange (that is `--c-theory`), not violet (that is `--c-highlight`). |
| `--c-extreme` | Past a threshold — the tail a p-value counts, and later the tests a correction flags. Distinct from `--c-highlight`, which means "moving right now". |
| `data-key` on every drive button | So anything outside `controls.js` finds a button by **what it does**, never by position. See the trap list. |

### Lessons the built widgets encode

Worth knowing before designing widget 4, because it faces the same choices.

- **The plotting window is centred on the TRUE value, never on the estimate.**
  Centring on the estimate is the obvious choice and puts the pile in the middle
  every time, hiding the one thing the method cannot do.
- **A readout can spoil a figure as easily as the figure can.** `bootstrap`
  printed `x̄, s` before the sample had been drawn.
- **A caption that describes state must be honest about every state**, including
  the ones you did not think about. Two separate bugs were captions claiming a
  shuffled/last-resample view while showing the real one.
- **Named levels beat a number for a "true" quantity.** Widget 5's effect control
  is None / Small / Moderate / Large. A numeric true effect sits next to the
  observed one, differs from it for the most ordinary reason there is, and
  derails the lesson while you explain sampling variability. The detail line
  carries the measured detection rate, so the control teaches power for free.
- **Defaults are authored, and the reasoning belongs in a comment.**
  `bootstrap` defaults to seed 3 because seed 1 lands the bootstrap SE 56% too
  wide; widget 5's Moderate is 0.9 SD because 0.8 puts the default on p = 0.055,
  exactly on the threshold.

### What is NOT verified

1. ~~**No git remote.**~~ **Closed.** The site is live at
   <https://nusmedicine.github.io/statml/>, deployed from `main` by GitHub
   Actions, and every widget has a real URL —
   `https://nusmedicine.github.io/statml/widget/<slug>/`. Verified against the
   deployed site rather than the build: `clt` boots, animates and reports the
   right share link under the `/statml/` subpath.

   **Two consequences.** Every push to `main` publishes, so `npm run check`
   before committing stopped being tidiness. And the repo is public with **no
   licence**, which is all-rights-reserved by default and is deliberate — prd §8
   carries the CC-BY-4.0/MIT decision and the trigger for adding it.

   **What is left is not in this repo:** paste the real URLs into the PHM5003
   lesson markdown cells — which is also what finally settles point 2 below.
2. ~~**Does an `<iframe>` survive a JupyterLab markdown cell?**~~ **Closed: it
   does not.** Tested on the live instance against the deployed widget — the
   markdown sanitiser strips it silently, heading and all else rendering fine.
   `IRdisplay::display_html()` from an R code cell *does* work, but only as a cell
   the student runs (saved outputs are stripped until the notebook is trusted).
   **The chosen mechanism is a plain link opening a new tab.** prd §4 has the
   detail. The MyST ebook is a different renderer and is still untested.
3. **Nothing has been judged on a projector.** That is a stated requirement
   (prd §3, P10) and it is the one no hash can discharge. The suspects are the
   2px reference curves and the `--fs-xs` tick labels.

---

## 2 · The next task: the inference arc — MLE, MCMC, EM

Requested by the author, in this order. **All three come out of one lesson**,
`03 / 02-02 — Inferential Statistics: Inferring Parameters`, which is the single
most useful fact about them: they already have a host, and that lesson's own
structure supplies the order and the argument.

### They are one argument, not three widgets

> what makes the data most likely → what the data makes likely → and if the data
> is a mixture, where the labels are missing

| # | slug (proposed) | the question | the lesson's own framing |
|---|---|---|---|
| 8 | `maximum-likelihood` | Which parameter makes what I saw most probable? | `P(Data \| Parameters)` |
| 9 | `mcmc-posterior` | What do the data make probable, and how sure am I? | `P(Parameters \| Data)` |
| 10 | `em-mixture` | What if each point came from one of two populations and nobody wrote down which? | E-step, M-step, iterate |

**The pairing of #8 and #9 is the whole point of the arc.** MLE answers
`P(Data|θ)` and Bayes answers `P(θ|Data)`, and the lesson states both in exactly
that form, two headings apart. Reversing them is one of the most common errors in
applied statistics and this pair is built to make the reversal visible.

**#10 contains #8.** The M-step *is* maximum likelihood, run on soft-weighted
data. So widget 10 reuses widget 8's machinery by construction, the way widget 6
reused widget 5's — which is what made the original six cheap by the end.

### What the lesson actually does, so nothing is re-derived

- **Its worked example is a negative binomial**, `size = 2.5`, `mu = 10`, chosen
  *because it has no analytical solution* — the point being that MLE is a search.
  It optimises with `optim` and then draws a **contour plot** over (size, mu).
  That contour is the figure widget 8 should be.
- **The Bayesian section uses `brms`**, and its key sentence is worth quoting in
  the widget: *"in the Bayes approach, we do not get a single estimate of the
  parameters but rather a distribution of values"*. That is the misconception
  target — a posterior is not a point with error bars.
- **The EM section uses heights of adults and children**, a two-component normal
  mixture. Unlabelled, it is simply bimodal. `flexmix`, `k = 2`.

### The scoping question, and it is real

**MCMC is a different KIND of widget from everything built so far.** Every one of
the seven accumulates values into a pile, and `core/accumulator.js` exists for
exactly that. **A chain is a path**, not a pile: it has an order, a starting
point, burn-in, autocorrelation, and rejected proposals that never become
samples. The accumulator will not serve it, and pretending otherwise is how a
widget ends up lying about its own mechanism.

Two new primitives are likely, and both are genuinely absent from `canvas.js`:

- **a 2-D likelihood surface** (contour or heatmap) for #8 — the lesson already
  draws one, and #10's E-step wants a related picture
- **a trace / path** for #9 — the walk over iterations, with the accepted and
  rejected steps distinguishable

Do not extract either from one example. The rule this project works to is that
**the second consumer tells you where the seam belongs** — and here #8 and #10
plausibly *are* the two consumers of the surface, which is the argument for
building #8 first and letting #10 pull the abstraction out.

### There is prior art, and it is good — unlike last time

The lesson links **chi-feng.github.io/mcmc-demo**, which is an excellent,
well-maintained MCMC animation. **This is NOT the Shiny-app situation.** Widget 7
replaced `kennethban.shinyapps.io/decision` because that app was slow *and
arithmetically wrong*; chi-feng's is neither. So the case for building our own
has to be made on different grounds — that it is seeded, URL-addressable,
parameter-shareable and in the collection's visual language — and if that case
cannot be made honestly, **linking it is a legitimate outcome**. Decide this
before building, not after.

### Before any of it is built

`docs/catalogue.md` is the gate, and the rule is not a formality: **a widget is
earned from a named misconception**, or from being a prerequisite for one. Draft
entries for all three, with evidence graded honestly, then build. Starting points:

- **MLE** — that the likelihood is a probability distribution over θ. It is not:
  it is a function of θ for fixed data and does not integrate to 1. The stronger
  version is "the MLE is the most probable parameter value", which is the
  *Bayesian* statement — and that confusion is precisely what the #8/#9 pair
  exists to dissolve.
- **MCMC** — that a posterior is an answer with error bars; that chain samples
  are independent; that a trace which *looks* settled has converged.
- **EM** — that it finds *the* answer. It finds a local optimum, depends on its
  initialisation, and can label-switch. Also that a hard assignment and a soft
  responsibility are the same thing.

### Still open from before, and not superseded

1. **Baseline and promote widget 7.** Smallest remaining item.
2. **Paste the real URLs into the PHM5003 lessons.** prd §8's order-of-work is
   down to this one step, in `../jupyterbook/phm5003`. A plain markdown link is
   the settled mechanism — an iframe in a markdown cell was TESTED and is
   stripped (prd §4).
3. **Judge the collection on a projector.** prd §3 makes it a requirement and it
   is the only thing no hash discharges. Suspects: widget 4's ladder of hairline
   intervals and widget 6's three stacked carpets.
4. **PHM5005** still needs its own one-continuous-argument treatment before its
   first widget (prd §12.1), and has no notebook project yet.

## 3 · How to work on this safely

### Order of work — baseline LAST

```
build → cheap checks (console, programmatic reads of the numbers)
      → if widgets/core/ changed: ONE fingerprint run, confirm existing states MATCH
      → SHOW THE HUMAN, iterate
      → only then: add states, prove determinism over 3 runs, baseline, commit
```

> *Earned:* `bootstrap` was baselined three times over — seven states recorded,
> then the difference mode was cut, then it became two-stage. A baseline recorded
> before the design is settled is thrown away, and the determinism runs are the
> slowest thing in the loop. Reviewing a figure is what changes it; hashing is
> what freezes it.

`npm run check` fails a manifest widget with no fingerprint states, which pushes
the other way. Escape hatch: a placeholder `"px": "0"` satisfies it.

### Every commit

```bash
npm run check     # 6 invariant assertions; also runs inside npm run build
```

### When you touch `widgets/core/`

Open `/widgets/_lab/fingerprint.html`. It runs on load; **28 states** should all
say MATCH before you start and after you finish. That is how the accumulator
extraction, the `binsFor` move, the lead button and `--c-extreme` were each shown
not to disturb the other widgets.

A change confined to one widget's `main.js` cannot reach another widget —
rebaseline that widget's own states and move on.

It holds **three kinds of state**:

| kind | how | sees |
|---|---|---|
| **settled** | `?…&shown=N` | the finished figure |
| **driven** | `drive: { click, frames, dt }` | anything drawn mid-motion |
| **interrupted** | `drive: { lead, before: [{click, frames}], click, frames }` | a state one action leaves another in |

Settled states alone are **no test of the animation whatsoever** — that gap let a
coordinate change put every falling ball six columns off-centre while all eight
settled states matched. `check.mjs` now fails any widget declaring an `animation`
without a driven state.

`before` exists because **three separate bugs this project has shipped were
mid-animation states**, and the last one needed *two* actions to reach: a step
left in flight when Fast took over froze a whole panel. When a rendering change
is intentional, rebaseline **in the same commit**, and confirm any new driven
state is identical across three runs first.

### Driving an animation by hand

The automation browser throttles `requestAnimationFrame` to ~1 frame per 300 ms,
so animations look frozen and a screenshot catches a mid-flight state that reads
as a bug. Take the clock:

```js
window.__q = [];
window.requestAnimationFrame = (cb) => { window.__q.push(cb); return 1; };
let t = 1000;
const adv = (n, dt = 32) => {
  for (let i = 0; i < n; i++) {
    const cb = window.__q.shift();
    if (!cb) return i;
    t += dt;
    cb(t);
  }
  return n;
};
// Buttons by data-key, NEVER by index — widgets 3 and 5 have a lead button and
// the indices are not what you would guess.
document.querySelector('.w-drive .w-btn[data-key="lead"]').click();
adv(80);
document.querySelector('.w-drive .w-btn[data-key="step"]').click();
adv(60);
```

Then assert on `.w-stat-value` / `.w-stat-note` text, the figure's `aria-label`,
or a canvas hash. `dt` is clamped to 64 ms in core.

**Counting pixels of a known colour** is a good way to test something a hash
cannot describe — it is how the Fast freeze was confirmed before it was fixed
(recessive-ink pixels: 2142 settled, 5370 mid-pool, 5298 stuck, 1770 fixed).

### Traps that have already cost time

- **A control that relabels itself changes the row's width.** Every check of the
  drive row had measured it in its INITIAL state; three of the run button's four
  labels only exist after a press, and "Resume" overflowed the rail. Same shape as
  principle 5.6. Core now reserves the widest label — but note that reserving made
  a marginal row wrap in EVERY state rather than three in four, which was correct:
  the rail was too narrow and is now sized to the row.
- **Measure a flex item off a detached probe, not by writing into it.** An
  overflowing row can SHRINK a button, so measuring in place reports the squeezed
  width and confirms a fit that is not there.
- **A measuring harness can be wrong in both directions at once.**
  `_lab/drive-row.html` first reported the shipped row as fine (its private row
  class had dropped `.w-drive`'s `margin-left` on Reset) and every clustered
  variant as wrapping (a button inside a group sits ~1px off a bare sibling, which
  counting distinct rounded tops read as a second line). Make the page print its
  own measurements, and ride the REAL classes.
- **`?studies=true` instead of `?studies=1`.** A new param type has to be added to
  the serialiser as well as the parser, or its URL silently stops matching every
  other flag's format.
- **A wrapping COLUMN resolves its items one line too tall.** `.w-drive` sets
  `flex-wrap: wrap` for the stacked layout; leaving it on while switching to
  `flex-direction: column` made the button cluster 19.5px — exactly one
  line-height — taller than its own content, with nothing in any button's styles
  to explain it. Found by bisection: two unrelated toggles each fixed it, which is
  what proves the fault is in the CONTAINER, not the things it contains.
- **Check that a CSS override actually wins.** `.w-drive .w-btn[data-key="run"]`
  and `.w-split .w-drive-group .w-btn` are both specificity 0,3,0, so the later
  one took it — and the rail's override of the reserved run width silently lost.
  Harmless at two segments, would have broken the split at three. Measure the
  computed value, do not assume the rule applied.
- **Stray pointer input.** The automation browser moves sliders mid-capture.
  Several apparent bugs were this. If a screenshot disagrees with a programmatic
  read, **trust the read**.
- **`anim.done` is a FLAG, not a counter.** Core reads a truthy `anim.done` as
  "finished" and answers the next click with Replay, so a widget that used it to
  count how many items were done replayed on every step instead of advancing —
  and **Play masked it completely**, because one click runs to the end. It
  shipped in widget 4. Core now compares `=== true`, and both widgets use `ran` /
  `tested`. A single driven fingerprint state cannot see this: it takes two
  clicks, which is what `before` is for.
- **A blank canvas is a thrown exception, and a pixel probe cannot tell you
  that.** Counting ink reported zero in all three panels and said nothing about
  why; the console named the undefined variable immediately. Read the console
  first, every time.
- **Never address a drive button by position.** The harness used to, and adding a
  third button to one widget silently repointed every driven state in the suite —
  and a wrong button still produces a stable, plausible hash. Principle 5.7.
- **A blank canvas is a thrown exception** and the harness cannot see it (no
  canvas to hash). Read the console; a missing import once produced exactly this.
- **Long tool calls time out.** A three-run determinism check exceeded the 30 s
  browser-tool limit. Kick the work off in the page, store results on `window`,
  wait outside, read them back. And **wait for the harness's completion line** —
  reading its table on a timer once reported non-determinism from half-built rows.
- **The browser pane letterboxes a pinned viewport.** `resize_window` to a width
  narrower than the pane renders the page inset inside stale paint, which looks
  like a frame inside a frame. Reset to the `desktop` preset after.
- **Heights used to live in three files** and drift; the check that guarded it is
  gone with the duplicates. `manifest.json` is now the only copy — do not add a
  second without restoring the check.
- **The repo is inside Dropbox.** Avoid long-running writes; Dropbox can race
  with `.git`.

---

## 4 · Open decisions

**All settled — see [docs/prd.md](docs/prd.md) §9**, which lists every question
`design-principles.md` §7 and this file used to carry, with its resolution. In
short: no control cap, thin widget prose, CC-BY + MIT, print out of scope, the
catalogue closed for PHM5003 and **open for PHM5005**.

The one still genuinely open is the **PHM5005 arc** — five widgets in
`catalogue.md` with an explicitly provisional spine, needing the same
one-continuous-argument treatment PHM5003 got, *before* its first widget is built.

---

## 5 · Shipping a widget

1. `widgets/<slug>/index.html` — copy `widgets/clt/index.html`, change the title
   and description
2. `widgets/<slug>/main.js` — `defineWidget({...})`; **use the `new-widget`
   skill**, which carries the full contract
3. Entry in `widgets/manifest.json`: `slug` `title` `blurb` `course` `arc`
   `height` `status`. That is the **only** place the height lives
4. Cheap checks, then **show it to the human and iterate** — §3
5. Fingerprint states: two or three **settled** plus at least one **driven** if it
   animates. Determinism across three runs, then baseline **in the same commit**
6. Judge it **projected**, or at least at a distance (prd §3). Thin strokes and
   small tick labels are what fail
7. Mark shipped in `docs/catalogue.md`
8. `npm run check && npm run build`

---

## 6 · Why things are the way they are

The git log carries the reasoning, not just the change. Worth `git log` before
arguing with a decision:

| commit | what it settles |
|---|---|
| `8fc05f0` | Phase 0: the whole scaffold and its three invariants |
| `b6c7d5b` | Why the statistics arc is a sequence, not a tier list |
| `e58023b` | The accumulator extraction, and what was deliberately *not* extracted |
| `bc21e1e` | Why the Galton axis is a deviation, not a count |
| `d3b7ed4` | The off-centre ball, and the blind spot that hid it |
| `2c23da4` | The PRD, and why both embedders were deleted for having no host |
| `2b0fd25` | Widget 3, and why its window is centred on the truth |
| `e6f111b` | Why the bootstrap shows `s` beside `σ` — the honest limit of the method |
| `d7d3b8f` | The two-stage lead action, and the positional-button trap it exposed |
| `cbbd523` | Why the fingerprint suite is scoped to core changes |
| `1dbfc59` | Baseline last, and the three rebaselines that earned it |
| `42a1da8` | Widget 5, pool-and-re-deal, and what the prior-art survey found |
| `b56ede0` | Red for what p counts, named effect levels, the Fast freeze |

Three things a fresh session is most likely to get wrong, all recorded as
principles:

- **Parameters are the only state of record.** Animation state never writes back.
- **A display parameter change must not discard the student's work.** An overlay
  toggle that clears thirty collected samples is a bug, and it was one.
- **A widget starts empty.** Including its readout — `?shown=N` is the only way
  to publish a finished figure, and it applies on first render only.
