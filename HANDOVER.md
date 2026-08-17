# Handover

State of the project and the next task, written so a fresh session can start
without re-deriving anything. Read [CLAUDE.md](CLAUDE.md) first, then this.

**Last updated:** widget 1 of the statistics arc shipped; `core/accumulator.js`
extracted and verified pixel-identical.

---

## Where the project is

Phase 0 is complete and two widgets are shipped. The scaffold is proven by a
second consumer, which is the point at which an abstraction stops being a guess.

```
npm run dev
open http://localhost:8000/widgets/          # gallery
open http://localhost:8000/widgets/_lab/     # design lab + fingerprint harness
```

### Shipped

| arc | slug | state |
|---|---|---|
| 1 | `galton-board` | Where the bell curve comes from. Random walk through pegs; exact binomial overlay |
| 2 | `clt` | Sampling distribution of the mean. The reference widget |

Both start empty, both animate step-by-step, both use `core/accumulator.js` for
the pile.

### Not verified

- **The Quarto book has never been rendered** — Quarto is not installed. Two
  chapters and a Lua shortcode exist. `luac -p` passes; shortcode registration,
  the `postMessage` iframe auto-resize in `book/assets/embed.html`, and the whole
  render path are untested. Installing Quarto and running `npm run book` is the
  cheapest way to retire a real unknown.
- **No git remote**, so GitHub Pages has never deployed. `DEFAULT_BASE` in the
  Python helper is a `REPLACE-ME` placeholder.
- **`notebooks/demo.ipynb` has never been executed** in a real JupyterLab.

---

## The next task

**Widget 3 of the arc: `bootstrap`.**

The arc is one continuous argument and the order is load-bearing:

> increments → means → **one sample** → an interval → a null by shuffling → many nulls

Widget 3 is the pivot. As built, `clt` is a fiction: it draws hundreds of samples
from a population whose μ and σ are printed on screen, and nobody has ever been in
that position. Widget 3 is where that debt is paid — you have **one** sample,
resample it with replacement, and the spread of the resampled statistic stands in
for the sampling distribution.

### Misconception it targets

That knowing an estimate's uncertainty requires repeated samples from the
population — which is exactly what widget 2 quietly assumed. Secondarily, that
resampling "manufactures data".

### Design decisions already made (in docs/catalogue.md)

1. **Draw the observed sample from a seeded population**, so the widget can draw
   the true sampling distribution *and* the bootstrap distribution on the same
   axis. The bootstrap distribution — which you can actually compute — sits almost
   on top of the one you can never see. **That single overlay is the entire
   justification for the method**, and it is only available because populations are
   seeded and reproducible.
2. **Bootstrap a mean, then a difference.** The statistic under study changes at
   widget 4 from "a mean" to "a difference between two groups", because effect size
   is what has clinical meaning. Make that transition happen *inside* widget 3,
   visibly, rather than silently between widgets.
3. Reuse `POPULATIONS` from `core/stats.js` so a named population behaves
   identically to how it behaves in `clt`.

### Likely shape

- **Three panels**: the population (faint, since you are not supposed to have it),
  the one observed sample (a rug or dot strip — the thing you actually have), and
  the bootstrap pile.
- **Choreography per resample**: highlight the n draws being picked *from the
  observed sample* — with replacement, so some observations get picked twice and
  that must be visible, it is the whole mechanism — collapse to the statistic, drop
  into the pile. Structurally parallel to `clt`'s draw → collapse → drop, which is
  deliberate: the student should recognise the motion.
- `core/accumulator.js` gives you the pile for free. What you write is the
  resampling and the choreography.

### Core work it needs first

Add to `core/rng.js`:

```js
resample(arr, rng)        // n draws with replacement; returns indices, not values,
                          // so the choreography can highlight WHICH observations
                          // were picked and show duplicates
```

Return indices rather than values. Widget 5 (`permutation-test`) will want
`permute(labels, rng)` alongside it; add that when you get there, not now.

---

## How to work on this safely

### Before a refactor

```bash
npm run dev
open http://localhost:8000/widgets/_lab/fingerprint.html
```

It runs on load. All states should say MATCH. Refactor, reload, all states should
still say MATCH. That is how the accumulator extraction was proven invisible — five
CLT states pixel-identical before and after.

### Driving an animation deterministically

The automation browser throttles `requestAnimationFrame` to roughly one frame per
300 ms, so animations look frozen and screenshots catch mid-flight states that
appear to be bugs. Take control of the clock:

```js
window.__q = [];
window.requestAnimationFrame = (cb) => { window.__q.push(cb); return 1; };
window.__t = performance.now();
const adv = (frames, dt = 32) => {
  for (let i = 0; i < frames; i++) {
    const cb = window.__q.shift();
    if (!cb) return i;
    window.__t += dt;
    cb(window.__t);
  }
  return frames;
};
document.querySelectorAll('.w-drive .w-btn')[0].click();  // step
adv(50);                                                  // 1.6s of animation
```

Then assert on `.w-stat-note` / `.w-stat-value` text, or hash the canvas.

### Also be aware

The automation browser generates **stray pointer input** that moves sliders
mid-capture. Several apparent bugs were this. If a screenshot disagrees with a
programmatic read, trust the read and re-check.

---

## Open decisions, with recommendations

| decision | recommendation |
|---|---|
| **Control budget** — `clt` has 8 controls, rich for a lecture and busy for a book figure | Not yet resolved. Watch whether `bootstrap` also lands on 8; if it does, impose a cap |
| **Prose inside the widget vs in the chapter** — currently overlapping | Thin the chapter, keep the widget subtitle. The widget travels to notebooks and slides where no chapter exists |
| **Licensing** — public Pages means public content | CC-BY for prose and figures, MIT for code. Fix before it spreads |
| **`ppv-prevalence` is deferred** yet has the strongest evidence in the catalogue (physicians report sensitivity *as* PPV) | Build it as the matched pair with `imbalance-metrics` when PHM5005 starts. Recorded at the top of the deferred list so it is not forgotten |
| **Generating the manifest** from a machine-readable catalogue | Trigger: when more than a handful of widgets have shipped. Would also close the hand-mirrored `HEIGHTS` |

---

## Checklist for shipping a widget

1. `widgets/<slug>/index.html` — copy `widgets/clt/index.html`, change the title
2. `widgets/<slug>/main.js` — `defineWidget({...})`; see the `new-widget` skill
3. Entry in `widgets/manifest.json` with `slug`, `title`, `blurb`, `course`, `arc`,
   `height`, `status: "shipped"`
4. Height in **three** places until generation lands: `manifest.json`,
   `HEIGHTS` in `python/statml_widgets/__init__.py`, and `book/assets/widget.lua`
5. Two or three states added to `widgets/_lab/fingerprint-baseline.json`, all with
   `shown=` so nothing animates
6. Mark the entry shipped in `docs/catalogue.md`
7. `npm run check && npm run build`
8. A chapter in `book/chapters/` if the book covers it
