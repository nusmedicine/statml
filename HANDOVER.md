# Handover

State of the project and the next task, written so a fresh session can start
without re-deriving anything.

**Read [CLAUDE.md](CLAUDE.md) first**, then this. Then
[docs/design-principles.md](docs/design-principles.md) before changing anything in
`widgets/core/` — most of its rules exist because the obvious approach was tried
and failed, and each one carries the incident that earned it.

**Last updated:** the PRD written ([docs/prd.md](docs/prd.md)) and both embedders
deleted — the Quarto book and the Python helper. Widgets 1 and 2 of the statistics
arc shipped; `core/accumulator.js` extracted; the fingerprint harness extended to
mid-animation states.

---

## 1 · Where the project is

```bash
npm run dev
```

- <http://localhost:8000/widgets/> — gallery
- <http://localhost:8000/widgets/galton-board/> — widget 1
- <http://localhost:8000/widgets/clt/> — widget 2
- <http://localhost:8000/widgets/_lab/> — design lab and the fingerprint harness

### Shipped

| arc | slug | what it does |
|---|---|---|
| 1 | `galton-board` | Where the bell curve comes from. A ball takes a ±1 nudge at each row; the axis is **total deviation from zero**, so the pile reads as an error distribution from the outset. Exact binomial overlay. Lean shifts the pile off the zero rule, which is bias made visible. |
| 2 | `clt` | Sampling distribution of the mean. Draw one sample, watch its observations collapse to their mean, watch that mean drop into the pile. Normal σ/√n overlay. |

Both start empty, both animate step by step, both build their pile with
`core/accumulator.js`.

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

## 2 · The next task: widget 3, `bootstrap`

The arc is one continuous argument and the order is load-bearing:

> increments → means → **one sample** → an interval → a null by shuffling → many nulls

**Widget 3 is the pivot.** As built, `clt` is a fiction: it draws hundreds of
samples from a population whose μ and σ are printed on screen, and nobody has ever
been in that position. Widget 3 pays that debt — you have **one** sample, you
resample it with replacement, and the spread of the resampled statistic stands in
for the sampling distribution.

**Misconception targeted.** That knowing an estimate's uncertainty requires
repeated samples from the population — which is exactly what widget 2 quietly
assumed. Secondarily, that resampling "manufactures data".

### Design decisions already taken

1. **Draw the observed sample from a seeded population**, so the widget can put the
   true sampling distribution *and* the bootstrap distribution on one axis. The
   bootstrap distribution — which you can actually compute — sits almost on top of
   the one you can never see. **That overlay is the entire justification for the
   method**, and it is only available because populations are seeded.
2. **Bootstrap a mean, then a difference.** The statistic changes at widget 4 from
   "a mean" to "a difference between two groups", because effect size is what has
   clinical meaning. Make that switch happen *inside* widget 3, visibly, rather than
   silently between widgets.
3. Reuse `POPULATIONS` from `core/stats.js` so a named population behaves exactly as
   it does in `clt`.

### Likely shape

- **Three panels**: the population (faint — you are not supposed to have it), the
  one observed sample (a rug or dot strip, the thing you actually have), and the
  bootstrap pile.
- **Choreography per resample**: highlight the n draws being picked *from the
  observed sample*, with replacement, so **duplicates are visible** — that is the
  mechanism, not a detail. Then collapse to the statistic and drop it into the pile.
  Structurally parallel to `clt`'s draw → collapse → drop, deliberately: the student
  should recognise the motion.
- `core/accumulator.js` gives you the pile. What you write is the resampling and
  the choreography.

### Core work it needs first

Add to `core/rng.js`:

```js
resample(arr, rng)   // n draws with replacement; returns INDICES, not values
```

Indices, so the choreography can highlight *which* observations were picked and
show the duplicates. `permute(labels, rng)` follows at widget 5, not before —
do not add it speculatively.

---

## 3 · How to work on this safely

### Every commit

```bash
npm run check     # 7 invariant assertions; also runs inside npm run build
```

### Before and after any refactor

Open <http://localhost:8000/widgets/_lab/fingerprint.html>. It runs on load. All
states should say MATCH before you start and MATCH after you finish. That is how the
`accumulator` extraction was proven invisible — five CLT states pixel-identical.

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
