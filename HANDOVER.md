# Handover

## Where things are

**Widget 8, `maximum-likelihood`, is shipped.** It is on the gallery, baselined
with **8 fingerprint states** (five settled, three driven), and the suite reports
**47/47 MATCH**.

Widget 9, `posterior`, is **planned in detail and not started** —
[docs/catalogue.md](docs/catalogue.md), "Widget 9 · `posterior`". Read that before
writing any of it: the design decisions are already taken and the reasons are
recorded, including one thing to verify first (brms puts its prior on the log
scale, so `normal(0, 10)` is a prior on `log(mu)`, not on `mu`).

`power-and-error` is still the only `draft` in the manifest, and still has no
fingerprint states.

## What widget 8 is, in one paragraph

Twelve gene counts drawn once from `rnbinom(size = 2.5, mu = 10)`. Try a
candidate: every count gets a height under it, the heights multiply to one
number, and that number is one dot on a curve. Three tabs — **mu**, **size**,
**Both** — sweep the mean, sweep the size, and climb the contour the notebook
plots. Parameters, orientation and starting values follow
`03 / 02-02 — Inferential Statistics — Inferring Parameters` so a student can
move between the two without translating.

## The next job

**Widget 9.** The plan is written. Its likelihood machinery comes straight from
widget 8, and it is the second consumer that finally justifies pulling the
negative binomial's log-pmf out of `maximum-likelihood/main.js` and into core.

## Things this session learned the hard way

- **The audience is a biology MSc, and it shows up as scientific notation.** The
  readout carried four tiles, three of them in the form `1.5 × 10⁻¹¹⁰`. It is now
  **two tiles per tab** — a number to point at and a range to point at — audited
  string by string in `widgets/_lab/plain-language.html`. Anything you add here
  has to survive that page's test.
- **The point estimate is not what improves with n.** Shown only a wandering
  point estimate, the widget was read as showing maximum likelihood getting
  *worse* with more data. It was not: over 400 seeds the mean absolute error
  falls exactly as theory predicts. The readout now leads with the **plausible
  range**, which narrows reliably; the old default seed was in the unluckiest 4%
  and is now seed 46.
- **A gate takes the whole drive row with it**, stale labels and all. That shipped
  broken twice. `widgets/core/widget.js` carries the warning at `GATE_PARAM`; a
  widget whose drive row predates its gate wants a `segmented` control instead,
  which is what widget 8 ended up with.
- **A lead action disables step and run and used to say nothing about it**, so
  the first thing a reader met was two dead buttons and a blank figure. Core now
  supports `animation.leadHint`. **Widgets 3 and 5 have the same structure and
  declare no hint** — the same complaint is presumably available there.
- **Do not animate a two-parameter sweep.** A surface filled one mean-column at a
  time makes one marginal grow a dot per press while the other is complete after
  the first — an artefact of sweep order, not statistics. Recorded with three
  layout candidates in `widgets/_lab/two-then-both.html`.
- **Motion has to earn its place.** The Both tab's moves were animated as the
  41-candidate sweeps they are; it worked, it was measured working, and it was
  reverted for being jarring. The note says "swept all 41" instead. Naming the 41
  cost nothing; the motion cost legibility.
- **`size` runs backwards.** `var = mu + mu²/size`, so larger `size` means LESS
  spread and `size → ∞` is Poisson. edgeR's dispersion is `1/size` and runs the
  other way. An earlier build had an axis labelled "spread" upside down.

## Verifying, and what actually caught things

`npm run check` before every commit. The fingerprint suite (`_lab/fingerprint.html`)
**whenever `widgets/core/` changes** — it ran three times this session and
reported 39/39 MATCH each time.

**Screenshots did not catch the real bugs.** The scan animation that ran at the
wrong speed, the surface filling column by column, the interval clipped to the
panel width — all of those were found by reading numbers out of the page or by
tracking a marker's bounding box frame by frame. A screenshot showed a
plausible-looking figure in every one of those cases.

**Baselining is slow and the wait is the job.** One suite pass over 47 states
takes about eight minutes in the browser pane, and a new driven state needs three
identical passes before it is recorded — so budget roughly half an hour, and do
not start until the design has stopped moving. Reloading the page restarts the
run; confirm the table is nearly empty straight afterwards, or you will read a
stale one and think a run finished in seconds.

**Write the baseline back with the original formatting.** A plain
`json.dumps(indent=1)` rewrote all 47 states and turned an 8-state addition into
a 408-line diff. Preserve each existing state's own key order and pass
`ensure_ascii=False`; the honest diff for this widget was **64 insertions and no
deletions**.

The browser pane's tab reports `document.visibilityState === "hidden"`, so
`requestAnimationFrame` never fires and nothing animates on its own. Drive
animations by hijacking the clock:

```js
window.requestAnimationFrame = (cb) => { (window.__q ??= []).push(cb); return 1; };
let t = 1000;
const adv = (n, dt = 32) => { for (let i = 0; i < n; i++) { const cb = window.__q.shift(); if (!cb) return i; t += dt; cb(t); } };
```

Stray pointer input moves sliders between tool calls and rewrites the URL. Do
everything for one measurement **inside a single `javascript_exec`**, and assert
`location.search` if the state matters.

## Lab pages, and what each one settled

| page | settled |
|---|---|
| `likelihood.html` | counts vs a normal for the mechanism — counts won, because their heights add to an exact `1.000` |
| `two-then-both.html` | layouts for a surface with two marginals. **Records a design that was cut**; kept for widget 9 |
| `plain-language.html` | how much technical detail a biology MSc needs. The readout is variant C |
