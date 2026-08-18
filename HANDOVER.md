# Handover

State of the project and the next task, written so a fresh session can start
without re-deriving anything.

**Read [CLAUDE.md](CLAUDE.md) first**, then this. Before proposing scope, read
[docs/prd.md](docs/prd.md) — §11 lists non-goals so they can be pointed at rather
than re-argued. Before changing anything in `widgets/core/`, read
[docs/design-principles.md](docs/design-principles.md): most of its rules exist
because the obvious approach was tried and failed, and each carries the incident
that earned it.

**Last updated:** widgets 3 and 5 shipped, the PRD written, both embedders
deleted. **Widget 4 `confidence-interval` is the only gap left in the statistics
arc.**

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
| widget 5 | `/widget/permutation-test/` | could chance alone have done this? |
| lab | `/widgets/_lab/` | design mockups **and the fingerprint harness** |

### Shipped

| arc | slug | what it does |
|---|---|---|
| 1 | `galton-board` | A ball takes a ±1 nudge at each row; the axis is **total deviation from zero**, so the pile reads as an error distribution from the outset. Exact binomial overlay. Lean shifts the pile off the zero rule, which is bias made visible. |
| 2 | `clt` | Draw one sample, watch its observations collapse to their mean, watch that mean drop into the pile. Normal σ/√n overlay. |
| 3 | `bootstrap` | **Two stages.** *Sample the population* draws your one sample, then greys out for good — you cannot go back for more. *Resample your sample* runs unlimited: copies stack above the observations they came from, so duplicates and never-picked values are both visible. The true sampling distribution sits behind the pile: **same width, different place.** |
| 5 | `permutation-test` | **Two stages again.** *Run the study* once, then *Shuffle the labels* unlimited. Every observation lifts into one pool and is dealt back — vertically only, so nothing leaves its value. The difference falls into the null below, and **a dot landing past the observed line turns red**, so p is *count the red ones*. Set the true effect to **None** and re-seed to watch a false positive happen. |

All start empty, all animate step by step, all build their pile with
`core/accumulator.js`.

### What `core/` has gained, and what it is for

| addition | why |
|---|---|
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

1. **No git remote.** Pages has never deployed and **no widget has a real URL
   yet**, so nothing can be pasted into a lesson. Everything on this side is now
   done — the URL scheme is settled at
   `https://nusmedicine.github.io/statml/widget/<slug>/`, the build emits that
   layout, `deploy.yml` is correct, and both licences are in place. What remains
   needs a GitHub credential this machine does not have: create the public repo
   `nusmedicine/statml`, push `main`, set Pages source to **GitHub Actions**.
   See README § Deploying.
2. **Does an `<iframe>` survive a JupyterLab markdown cell?** JupyterLab
   sanitises HTML there and may strip it. One test in one lesson decides whether
   widgets appear inline or only behind a link. Both work; inline is nicer.
3. **Nothing has been judged on a projector.** That is a stated requirement
   (prd §3, P10) and it is the one no hash can discharge. The suspects are the
   2px reference curves and the `--fs-xs` tick labels.

---

## 2 · The next task: widget 4, `confidence-interval`

> increments → means → one sample → **an interval** → a null by shuffling → many nulls

Widgets 1–3 build the sampling distribution; this one is about **reading** it.
`bootstrap` already computes the distribution an interval is cut from, so the new
idea is only what you do with it.

**Misconception targeted — documented, not inferred.** That there is a 95% chance
the true value lies in *this* interval. A realised interval either contains the
truth or it does not; the 95% describes **the procedure across many studies**.
Greenland et al. 2016 enumerates it, and it persists among researchers.

### Design decisions already taken

1. **Two views, and the second is the whole point.**
   - *One study → one interval*, cut from the bootstrap distribution as
     percentiles. This is the view that feels like an answer.
   - *Many studies → coverage.* Repeat the study many times, one horizontal line
     per interval, colour the ones that miss. About 5 in 100 do, and **which**
     ones is unknowable from inside any single study. This is the documented
     target; the first view is its setup.
   - Both, with the second reachable from the first.
2. **The statistic is a difference, and this widget introduces it alone.** Widget
   3 tried carrying the mean → difference switch and it was cut for muddying the
   mechanism it exists to teach. Watch the cost that pushes here: a student meets
   a new statistic *and* a new concept together. If it bites, the fix is a
   one-group opening state, not putting the switch back into widget 3.
3. Reuse `POPULATIONS`. Keep the true value in `--c-reference` and any
   checked-against curve in `--c-theory`, as widgets 3 and 5 do.

### What is already built for it

`rng.resample`, `createPile`, `--c-group-a/b`, `--c-extreme` (a missed interval
is exactly "past a threshold"), the two-box layout from widget 5, the
`leadLabel` two-stage pattern, and a worked example of a lower panel whose x-axis
is a *difference* while the panel above is in data units.

The readout's honest pair here is **nominal 95% vs realised coverage so far**,
tracking the partial count so a student watches it converge rather than being
shown 95 as a fact.

### Core work it may need

**Percentiles of a growing pile.** `createPile` keeps binned counts and running
sums — **not** the values — so a percentile cannot be read off it exactly. Two
options, worth choosing deliberately:

- the widget keeps its own sorted array of resampled statistics, leaving the pile
  as the *drawing*; or
- `quantile(p)` on `createPile`, interpolating within a bin.

The first is honest and local; the second is shared but approximate, and an
interval read off an approximation is a bad thing to teach with. **Lean to the
first** unless widget 6 also needs it.

---

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

- **Stray pointer input.** The automation browser moves sliders mid-capture.
  Several apparent bugs were this. If a screenshot disagrees with a programmatic
  read, **trust the read**.
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
