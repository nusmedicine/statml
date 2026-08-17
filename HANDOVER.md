# Handover

State of the project and the next task, written so a fresh session can start
without re-deriving anything.

**Read [CLAUDE.md](CLAUDE.md) first**, then this. Then
[docs/design-principles.md](docs/design-principles.md) before changing anything in
`widgets/core/` — most of its rules exist because the obvious approach was tried
and failed, and each one carries the incident that earned it.

**Last updated:** widget 5 `permutation-test` shipped, out of order — widget 4
`confidence-interval` is now the only gap in the statistics arc. Earlier the same
session: widget 3 `bootstrap`, the PRD ([docs/prd.md](docs/prd.md)), and both
embedders deleted.

---

## 1 · Where the project is

```bash
npm run dev
```

- <http://localhost:8000/widgets/> — gallery
- <http://localhost:8000/widgets/galton-board/> — widget 1
- <http://localhost:8000/widgets/clt/> — widget 2
- <http://localhost:8000/widgets/bootstrap/> — widget 3
- <http://localhost:8000/widgets/permutation-test/> — widget 5
- <http://localhost:8000/widgets/_lab/> — design lab and the fingerprint harness

### Shipped

| arc | slug | what it does |
|---|---|---|
| 1 | `galton-board` | Where the bell curve comes from. A ball takes a ±1 nudge at each row; the axis is **total deviation from zero**, so the pile reads as an error distribution from the outset. Exact binomial overlay. Lean shifts the pile off the zero rule, which is bias made visible. |
| 2 | `clt` | Sampling distribution of the mean. Draw one sample, watch its observations collapse to their mean, watch that mean drop into the pile. Normal σ/√n overlay. |
| 3 | `bootstrap` | **Two stages, two buttons.** *Sample the population* draws your one sample out of the panel above — then greys out for good, because you cannot go back for more. *Resample your sample* then runs as often as you like: copies stack above the observations they came from, so duplicates and never-picked values are both visible, collapse to their mean, drop into the pile. The true sampling distribution sits behind it: **same width, different place.** |

| 5 | `permutation-test` | **Two stages again.** *Run the study* once, then *Shuffle the labels* as often as you like. Every observation lifts out of its box into one pool and is dealt back — vertically only, so nothing leaves its value, and the boxes carry their `n` because a permutation fixes the group sizes. The difference falls into the null below, and **a dot landing beyond the observed line stays lit**, so p is *count the lit ones*. Set the true effect to zero and re-seed to watch a false positive happen. |

All start empty, all animate step by step, all build their pile with
`core/accumulator.js`.

**Four things widget 3 settled that widget 4 inherits.**

0. **A `leadLabel` in `core/widget.js`** — a one-off action before stepping is
   meaningful. Widget 5 wants exactly this too (observe the data once, shuffle
   its labels many times). Note the harness consequence: a driven fingerprint
   state for such a widget needs `"lead": true` in its `drive` block, or it
   clicks a disabled button and throws.
1. **The window is centred on the true value, not the estimate.** Centring on the
   estimate is the obvious choice and would put the pile in the middle every
   time, hiding that the bootstrap is centred on your estimate and not on μ.
2. **The readout shows `s` beside `σ`.** The bootstrap samples from your sample,
   not the population, so its SE is essentially `s/√n` and
   `bootstrap SE / true SE` is exactly `s/σ`. That pair is the difference between
   asserting the method works and showing why it sometimes doesn't. Four tiles,
   two numbers each — six tiles orphan the last one onto its own row, because the
   readout grid fits five columns.
3. **Default seed 3, not 1.** At n = 12 from an exponential the observed `s` runs
   from 0.6σ to 2.0σ; seed 1 lands 56% too wide. Seed 3 gets the SE within 2%
   **and** puts the estimate 1.3 SE off μ, so both lessons arrive together. The
   comment on the `seed` param carries the reasoning — don't tidy it back.

**A `stat` control switching mean → difference was built and then cut** (see
catalogue.md). Two groups meant two rows, two collapses and a gap to read as the
statistic, and the mechanism this widget exists to teach got harder to narrate.
Widget 4 carries that transition alone.

### What is NOT verified

Two unknowns. The other three were retired by deletion rather than by testing —
the Quarto book, the Python helper and the demo notebook are gone (prd §6), and
with them the questions of whether they worked.

1. **No git remote**, so Pages has never deployed and **no widget has a real URL
   yet**. Nothing can be pasted into a lesson until this is done. Also blocks the
   licences, which the PRD settles as CC-BY-4.0 for prose and MIT for code.
2. **Does an `<iframe>` survive a JupyterLab markdown cell?** JupyterLab sanitises
   HTML there and may strip it. One test in one lesson decides whether widgets
   appear inline or only behind a link. Both work; inline is nicer.

---

## 2 · The next task: widget 4, `confidence-interval`

The arc is one continuous argument and the order is load-bearing:

> increments → means → one sample → **an interval** → a null by shuffling → many nulls

**Widget 4 is now the only gap in the statistics arc** — 1, 2, 3 and 5 are built.
Widgets 1–3 were about building the sampling distribution; this one is about
reading it. `bootstrap` already computes the distribution an interval is cut
from, so the new idea is only what you do with it.

**What widget 5 already built that widget 4 wants.** `--c-group-a` /
`--c-group-b` in `tokens.css` (blue and amber), `rng.shuffle`, the two-box
layout with group sizes on the boxes, and a worked example of a second panel
whose x-axis is a *difference* while the panel above is in data units. Widget 4
also needs the mean → difference transition that widget 3 gave up, so read the
note at the end of §1 before designing it.

**Misconception targeted.** That there is a 95% chance the true value lies in
*this* interval. A realised interval either contains the truth or it does not;
the 95% describes **the procedure across many studies**, not the one interval in
front of you. This is documented, not inferred — Greenland et al. 2016 enumerates
it, and it persists among researchers, not only students.

### Design decisions already taken

1. **Two views, not one**, and the second is the whole point:
   - **one study → one interval**, cut from widget 3's bootstrap distribution as
     percentiles. This is the view that feels like an answer.
   - **many studies → coverage.** Repeat the whole study many times, draw one
     interval per study as a horizontal line, colour the ones that miss. About 5
     in 100 miss, and *which* ones miss is not knowable from inside any single
     study. **This is the documented misconception target**; the first view is
     the setup for it.
   - Both, with the second reachable from the first.
2. **The statistic is a difference, and widget 4 now introduces it alone.** Widget
   3 tried carrying the mean → difference switch and it was cut for muddying the
   mechanism. So watch for the cost this creates here: a student meets a new
   statistic *and* a new concept in the same widget. If it bites, the fix is a
   one-group opening state rather than putting the switch back into widget 3.
3. Reuse `POPULATIONS`, and keep the true value marked with `--c-reference` and
   the checked-against curve in `--c-theory`, as widget 3 does.

### What widget 3 hands it

- `rng.resample(len)` — already there, returns indices.
- `createPile` for the bootstrap distribution.
- The window-centred-on-truth decision, which matters *more* here: the coverage
  view is a set of intervals scattered around a fixed true value, and that rule
  is what keeps the true value in one pixel column.
- The two-pairs readout shape. For this widget the honest pair is **nominal 95%
  vs realised coverage so far** — and it should track the partial count, so a
  student watches it converge on 95 rather than being shown 95 as a fact.

### Core work it may need

Percentiles of a growing pile. `createPile` keeps binned counts, a running sum
and sum of squares — **not** the values — so a percentile cannot be read off it
exactly. Two options, and the choice is worth making deliberately rather than by
default:

- have the widget keep its own sorted array of resampled statistics, and leave
  the pile as the *drawing* of the distribution; or
- add `quantile(p)` to `createPile`, interpolating within a bin.

The first is honest and local; the second is shared but approximate, and a
confidence interval read off an approximation is a bad thing to teach with. Lean
to the first unless widget 6 also needs it.

`permute(labels, rng)` follows at widget 5, not before — do not add it
speculatively.

---

## 3 · How to work on this safely

### Every commit

```bash
npm run check     # 7 invariant assertions; also runs inside npm run build
```

### When you touch `widgets/core/`

Open `/widgets/_lab/fingerprint.html` on the dev server. It runs on load. All
states should say MATCH before you start and MATCH after you finish. That is how
the `accumulator` extraction was proven invisible, and how the `binsFor` move and
the lead-button addition were each shown not to disturb `clt`.

**Only core changes need the full suite.** A change confined to one widget's
`main.js` cannot reach another widget; rebaseline that widget's own states and
move on. And testing the widget you are actually building stays manual — no hash
tells you whether a caption is honest or a figure is legible from the back row.

It holds **two kinds of state**, and the difference is the most important thing in
this file:

| kind | how | sees |
|---|---|---|
| **settled** | `?…&shown=N` | the finished figure |
| **driven** | `drive: { click, frames, dt }` | anything drawn mid-motion |

A suite of settled states alone is **no test of the animation whatsoever.** That
gap let a coordinate change put every falling ball six columns off-centre while all
eight settled states matched — and the commit before it had cited "nothing is in
flight at a `shown=` state" as *reassurance*. `check.mjs` now fails any widget that
declares an `animation` without a driven state.

When a rendering change is intentional, press **Copy new baseline** and paste over
`fingerprint-baseline.json` **in the same commit**, so the diff records that the
picture moved. Before baselining a *new* driven state, confirm it is identical
across three runs.

### Driving an animation by hand

The automation browser throttles `requestAnimationFrame` to roughly one frame per
300 ms, so animations look frozen and a screenshot catches a mid-flight state that
looks like a bug. Take the clock:

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
document.querySelectorAll('.w-drive .w-btn')[0].click();   // 0 = step, 1 = play
adv(50);
```

Then assert on `.w-stat-value` / `.w-stat-note` text, the figure's `aria-label`, or
a canvas hash. Note `dt` is clamped to 64 ms in core.

### Traps that have already cost time

- **Stray pointer input.** The automation browser moves sliders mid-capture. Several
  apparent bugs were this. If a screenshot disagrees with a programmatic read, trust
  the read.
- **The fingerprint harness finds drive buttons by `data-key`, never by position.**
  It used to count them, and adding a third button to one widget silently
  repointed every driven state in the suite at the wrong button — which still
  yields a stable, plausible hash. Principle 5.7. If you add a drive button to
  core, that is the thing to re-check.
- **A blank canvas is a thrown exception**, and the fingerprint harness cannot see
  it (no canvas to hash). Read the console — a missing import once produced exactly
  this.
- **Long tool calls time out.** A three-run determinism check exceeded the 30 s
  browser-tool limit. Kick the work off in the page, store results on `window`, wait
  outside, then read them back.
- **Heights used to live in three files** and drift between them; `npm run check`
  guarded it. They now live only in `manifest.json`, and that check is gone with
  the duplicates. Do not add a second copy without restoring the check.

---

## 4 · Open decisions, with recommendations

**All six are now settled in [docs/prd.md](docs/prd.md) §8**, mostly by taking the
recommendation in the right-hand column. The two that did not simply go the way
the table suggests: the **control budget** has no cap at all (the lecture is the
governing surface, so rich is correct), and **generating the manifest** kept its
deferral but swapped a count-based trigger for an incident-based one.

| decision | recommendation |
|---|---|
| **Control budget** — `clt` has 8 controls, `galton-board` 7 | Watch widget 3. If it also lands on 7–8, impose a cap. Rich for a lecture, busy for a book figure |
| **Prose in the widget vs the chapter** — currently overlapping | Thin the chapter. The widget travels to notebooks and slides where no chapter exists |
| **Licensing** — public Pages means public content | CC-BY for prose and figures, MIT for code. Fix before it spreads |
| **`ppv-prevalence` is deferred** despite the strongest evidence in the catalogue (physicians report sensitivity *as* PPV) | Build it as a matched pair with `imbalance-metrics` when PHM5005 starts. Deliberately parked, not forgotten |
| **Generating the manifest** from a machine-readable catalogue | Trigger: more than a handful of widgets shipped. Also closes the three-places heights |
| **Ball physics on the Galton board** | Considered and dropped this session. A visible bounce implies the deflection is *caused* by the peg geometry, when the lesson is that each step is an independent coin flip. A landing squash would be free and safe; a bounce is not |

---

## 5 · Shipping a widget

1. `widgets/<slug>/index.html` — copy `widgets/clt/index.html`, change title and description
2. `widgets/<slug>/main.js` — `defineWidget({...})`; **use the `new-widget` skill**,
   which carries the full contract
3. Entry in `widgets/manifest.json`: `slug` `title` `blurb` `course` `arc` `height`
   `status: "shipped"`. That is the **only** place the height lives now
4. Fingerprint states: two or three **settled** (`shown=`) plus at least one
   **driven** if it animates. Verify determinism, then baseline
5. Judge it **projected**, or at least at a distance — the lecture is the
   governing surface and back-row legibility is a requirement (prd §3). Thin
   strokes and small tick labels are what fail
6. Mark shipped in `docs/catalogue.md`
7. `npm run check && npm run build`

---

## 6 · Why things are the way they are

The git log is unusually informative — commit messages carry the reasoning, not
just the change. Worth `git log` before arguing with a decision:

| commit | what it settles |
|---|---|
| `8fc05f0` | Phase 0: the whole scaffold and its three invariants |
| `b6c7d5b` | Why the statistics arc is a sequence and not a tier list |
| `e58023b` | The accumulator extraction, and what was deliberately *not* extracted |
| `b43a7e5` | Why Fast is a cascade — a tier must show what the tier below does not |
| `bc21e1e` | Why the axis is a deviation and not a count |
| `d3b7ed4` | The off-centre ball, and the blind spot that hid it |

Two things a fresh session is most likely to get wrong, both recorded as principles:

- **Parameters are the only state of record.** Animation state never writes back.
- **A display parameter change must not discard the student's work.** An overlay
  toggle that clears thirty collected samples is a bug, and it was one.
