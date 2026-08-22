# Handover

## Where things are

**Twelve widgets, all shipped, all live.** `/lab/` is empty. `main` and
`origin/main` are level and every push to `main` publishes immediately, which is
what makes `npm run check` before committing load-bearing rather than tidy.

**105 fingerprint states**, every widget carrying both settled and driven
coverage. The suite passes clean as of the last commit.

```
npm run dev      # :8000 — USE THIS, not python -m http.server
npm run check    # before every commit
```

---

## NEXT: widget 13 — ML model evaluation, for PHM5005

Kenneth's source is a Colab notebook:
<https://colab.research.google.com/drive/1y4UzVeSZOIpY5Vxg3dM047p-2fwrs4Zc>

### Blocker, and the first thing to resolve

**That link needs auth and cannot be read by an agent** — it serves a sign-in
page, not the notebook. Nothing about the widget can be planned until its content
is in hand. Ask Kenneth for one of:

- **`File → Download → .ipynb`, dropped anywhere readable** — best, because the
  cell outputs come with it and the widget should meet the lesson in the lesson's
  own order (that rule is why widget 12 puts the odds ratio first)
- share the Colab link-viewable, then it can be fetched
- paste the section headings and the metrics it computes

Also worth asking: **is there a `../jupyterbook/phm5005`?** Only `phm5003` exists
locally, so the PHM5005 lessons are not on this machine at all. Every widget so
far has been aimed at a named lesson slot, and there is currently no way to
name one.

### What the repo already knows about this topic

`docs/catalogue.md` § *PHM5005* has a guessed arc waiting to be overwritten. Two
of its five entries are model evaluation and both are **documented**
misconceptions:

| # | slug | misconception |
|---|---|---|
| 4 | `imbalance-metrics` | that 99% accuracy on a 1% prevalence outcome is a good model |
| 5 | `calibration` | that a good AUC means the predicted probabilities are usable at the bedside |

Read the catalogue's note on **the pair worth building together**:
`ppv-prevalence` and `imbalance-metrics` are the same misconception twice — base
rate neglect as a clinical reasoning error and as a model evaluation error. Same
grid, one labelled *patients*, one labelled *predictions*.

**Widget 12 built the machinery for it.** `odds-and-risk` is a 2×2 whose lesson
is a denominator nobody looked at; `imbalance-metrics` is the same grid a third
time with predictions on the columns. The catalogue's rule on shared machinery
says the seam is not cut until the second consumer tells you where it belongs —
**this is that second consumer**, so expect to extract something from
`widgets/odds-and-risk/main.js` rather than to copy it.

Do not assume the notebook is about `imbalance-metrics`. It may be ROC/AUC,
train-test, cross-validation, or a survey of all of them. Read it first.

---

## Deferred, ready to pick up individually

**Button labels.** A five-widget sweep was reverted (`a23be6b`) as too much to
review at once, and the replacement labels were wordier than what they replaced.
The observations still hold; each is a one-file change, to be taken **one at a
time**:

- `maximum-likelihood`'s step button reads "Step" — core's generic fallback, and
  the only step button in twelve widgets that names no act. Its own title says
  "Try the next candidate, **or** take the next move of the climb", so the action
  differs by tab; `stepLabel` accepts a `{param, labels, default}` form for
  exactly that, and `bayesian` and `probability-mechanisms` already use it.
- `bootstrap` and `permutation-test` grey out Step and Play until their lead has
  run, and neither says why. The other three lead-gated widgets have a
  `leadHint`.
- `bayesian`'s `leadHint` says "Step and Play" while the button reads "Add a
  count" or "Propose a move".
- `em-mixture`'s lead reads "Start", the only lead label naming no act.

**Judge projected.** Widgets 11 and 12 have not been seen from the back of a
room. Widget 11's hypergeometric dots are ~4px at the narrow layout and its
R-code cards put 11px mono on a half-width card.

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`.** Kenneth is
doing these by hand.

- **Cell 40** states the odds-ratio interpretation wrongly. On `a=24, b=60,
  c=16, d=100` it says *"the odds of death in infected patients is 2.5:1 = 5:2
  … for every 5 patients who died with infection, there were 2 who died
  without"*. The odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is not
  an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** says *"In retrospective studies, we often do not know the
  population at risk, as the exposure is usually not known"*. It should say
  **case-control** — a retrospective *cohort* is fine for a risk ratio — and in a
  case-control the exposure is precisely what you go and ascertain. What is
  unknown is the population at risk.

---

## How Kenneth works — read before writing anything he will see

- **One change at a time.** A commit touching five widgets is not reviewable and
  gets reverted whole, including the parts that were right. If a fix reveals the
  same fault elsewhere, **say where and stop**; offer the rest as a list.
- **Replacement wording must be shorter than what it replaced**, or it is not an
  improvement. Said twice.
- **On-screen copy names the quantity** — principle 2.9. No metaphors ("a fact
  about your budget" for a death rate), no personifying the method ("the cohort
  does not know"), no verdicts where a mechanism belongs ("nothing else", "by
  construction"). Source comments are exempt and should stay vivid.
- **Explanations are one claim per line, not paragraphs.** Four sentences
  wrapping across five lines reads as a wall of text. `textBlock` in
  `odds-and-risk/main.js` is the pattern; an empty string is a half-height gap.
- **Hand over the exact localhost URL after every edit.**

---

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots here have produced several phantom bugs:
the automation browser generates stray pointer input that moves sliders
mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per 300 ms, so
animations appear frozen and any wait under ~300 ms races the frame clock.

### The canvas text sweep — the cheapest check in the repo

Wrap `fillText`, measure each string, compare its right edge to the canvas width.
It catches what screenshots cannot: a `NaN` at one end of a slider, a caption
overrunning its line, a printed claim that is false.

```js
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

- **`y === 0` is the rotated y-axis label** — its coordinates are in the rotated
  frame and always look like an overflow. Skip it.
- **Force a repaint** (re-press the already-selected segmented button) rather
  than dispatching `resize`, which no longer repaints if the size has not
  changed. A sweep reporting every state blank is measuring nothing.
- **Install unconditionally.** A flag that says *installed* is worthless once a
  diagnostic has restored the original.
- **Dedupe before any collision check.** A repeated paint lands the same string
  at the same pixel, so a frame captured mid-ease reads as thousands of overlaps.

**One level down, for marks rather than text:** wrap `arc` and `fill` and tally
what colour was actually *asked for*. An invalid `fillStyle` is a silent no-op
that leaves the canvas default, and **`globalAlpha = 0` paints perfectly** — a
whole panel was invisible while every string reported correct text at correct
coordinates. That is also how widget 12's design tab was found painting 112 dots
at alpha 0.

### Driving an animation

The browser's own clock is unusable. Take it by hand, exactly as
`_lab/fingerprint.html` does:

```js
const q = []; window.requestAnimationFrame = (cb) => q.push(cb); let t = 1000;
const pump = (n) => { for (let i = 0; i < n; i++) { const cb = q.shift(); if (!cb) break; t += 64; cb(t); } };
```

`MAX_FRAME_MS` is 64, so pump at 64. An ease cannot be settled by a fixed wait,
nor by watching the *wording*, which flips at the halfway point while the numbers
keep moving — settle by **observing the exact target value**.

### THE BIG ONE: every baseline is at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**.

This is where widget 11's six overflows were found, and none was visible at
1400px. No hash would ever have caught one: `note()` and friends stroke
surface-coloured before filling, so **a collision erases what it overruns rather
than blending**. It still looks like text and it hashes consistently for ever.

### The fingerprint harness

`widgets/_lab/fingerprint.html`. **It auto-runs on load; never click Run** — that
starts a second concurrent pass into the same table and can make "Copy new
baseline" copy a half-interleaved set.

**Run the full suite when you touch `widgets/core/`.** That is the only kind of
change that can reach a widget you are not looking at.

Three kinds of state, and the distinction is load-bearing:

| kind | how | sees |
|---|---|---|
| **settled** | a URL that fully determines the figure | the finished figure |
| **driven** | `drive: { click, frames, dt }` or `drive: { set: {…}, frames, dt }` | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

- A suite of settled states alone is **no test of the animation at all**. That
  gap let a coordinate change put every falling ball six columns off-centre while
  all eight settled states matched. `check.mjs` fails any widget declaring an
  `animation` without a driven state.
- **`set` drives a control** rather than a drive button — `data-param` on every
  control, `data-value` on segmented buttons, `data-options` on a `choice` slider
  because its DOM value is an index. This exists because a widget may decline
  drive buttons (4.5) and ease on a toggle (4.4), which made its transitions
  undriveable. Found **by name, never by position** (5.7).
- `check.mjs` requires `shown=` on a settled state only from widgets that declare
  a `shown` parameter. One that declares none has no build-up to be partway
  through, so the URL alone settles it.
- `before` exists because **three separate shipped bugs were mid-animation
  states**, and the last needed two actions to reach.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

Build → cheap checks → **if core changed, one suite run to confirm the existing
states still MATCH** → *show Kenneth and iterate* → and only then add states,
prove determinism, baseline, commit.

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds,
> and two of them changed the design after it looked finished.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves. A placeholder
`"px": "0"` also satisfies `check` if states need writing early.

If a state legitimately changes, regenerate the baseline **in the same commit** as
the change, so the diff records that the rendering moved. Before recording a new
driven state, confirm it is identical across three runs — a flaky check is worse
than none.
