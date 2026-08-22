# Handover

## Where things are — read this first

**Twelve widgets, and all twelve are now SHIPPED.** `power-and-error` and
`odds-and-risk` were the last two drafts; both are baselined and on the gallery,
and `/lab/` is empty. `main` and `origin/main` are level, and every push to
`main` publishes immediately with no staging step — which is what makes
`npm run check` before committing load-bearing rather than tidy.

```
http://localhost:8000/widget/odds-and-risk/
```

**105 fingerprint states**, every widget carrying both settled and driven
coverage. The two shipped in this round were baselined after three identical
runs, per 5.6.

---

## Widget 12 · `odds-and-risk` — a draft, ten review rounds in

Two tabs. **Study design** comes first and is the default; **The calculation**
is the second. Four controls, and the only button on the calculation tab is
Reset — the figure updates live as you drag.

| tab | what it is |
|---|---|
| Study design | both designs side by side, animated. Recruit, then count. Play lives here |
| The calculation | the piles, the division written out, the two ratios |

**Read [docs/catalogue.md](docs/catalogue.md) § Widget 12 before changing
anything.** It is long because the widget changed shape in nine of ten rounds,
and every round records what was reversed and why. Reversing one of them back
without reading it will re-earn a defect that has already been paid for.

The six decisions most likely to be undone by accident:

| do not | because |
|---|---|
| write an explanation as a paragraph | four sentences across five wrapped lines was reported as a wall of text. `textBlock` takes an array — one claim per line, `""` for a gap — and the one-line limit is its own editor |
| end a caption with a flourish | four of them did ("that is the odds scale showing you its edge"). That is the widget admiring its own point; cutting them cost no information |
| write on-screen copy in metaphor | "a fact about your budget" for a death rate was cut on sight. The number IS the controls-per-case ratio. Principle 2.9 — and it applies to readout notes and control detail lines too |
| widen "Controls per case" below 1:1 | fewer controls than cases is not a design anyone runs. 1:1 is the textbook default; `r/(r+1)` gives 50 / 67 / 80% of maximum precision at 1:1 / 1:2 / 1:4, which is where the ceiling of four comes from |
| expect the enrolment control to move a ratio at the opening table | at 20/20 every enrolment gives RR = OR = 1.00 and only the death rate moves. That is arithmetic, not a bug. The swing needs an effect first |
| reinstate a "Work it out" button | there is nothing to build; the answer is a division of two numbers the reader typed. #4 is honoured by **where it opens** — both sliders at 20, no effect, both ratios 1.00 |
| relabel the boxes generic | "40 events per 60 non-events" is not a sentence. Concrete nouns in the figure, EXPOSURE and OUTCOME in the rules |
| rename the tabs to the lesson's sections | "Two denominators" / "Why the odds ratio" were headings wearing costumes and were the first thing a reader tripped over |
| model a case-control by thinning survivors | at 1-in-1 it IS the cohort. It enrols **every case and r controls per case** now |
| claim the odds ratio is *unchanged* | it is not, and cannot be — whole people do not divide. It **estimates**; the risk ratio estimates nothing |
| make the base rate a data parameter | the gesture is *pin the effect and walk the base rate*; under the data rule that wipes the figure at every notch |

### What is left

**Nothing blocking — widget 12 is shipped.** What remains is judgement, not
work: it has not been seen projected from the back of a room. If something is
wrong there, the fix and its baseline go in the same commit.

Older, still true:
~~2. Baseline it.~~ Done: 15 states, 5 of them driven, including two driven by a
   **control** rather than a button — the coverage that did not exist before.
~~3. Mark shipped.~~ Done, in `widgets/manifest.json` and `main.js` both, which
   `check` requires to agree.

Round twelve answered the fourth thing he had flagged: **the case-control panel
never said why anyone would run one.** It does now, in one line per panel, and
the copy across the widget was rewritten to name quantities rather than reach for
figures of speech — that is now principle **2.9**, and it is worth reading before
writing any on-screen string.

### THE SHIP BLOCKER IS GONE — the harness can drive a control

`check.mjs` demands a driven fingerprint state from any widget declaring an
`animation`, and `_lab/fingerprint.html` could only press a button carrying a
`data-key`. This widget declines Play and Step on the calculation tab (4.5) and
eases on a **segmented toggle** (4.4), so its transitions were undriveable and
therefore unfingerprintable — a blind spot with no floor under it.

Taken the better of the two routes: **the harness now drives controls.**

- `controls.js` stamps `data-param` on every settable control and `data-value` on
  every segmented button. Nothing in the shipped page reads them.
- A `choice` slider also carries `data-options`, because its DOM value is an
  **index** — without it a spec would have to name a position, which 5.7 forbids.
- A drive spec may say `{ set: { against: "risk" }, frames: 6 }` as well as
  `{ click: "run" }`. Both work in `before`; one step may do both.
- `check.mjs` needed no change — it only ever required `drive.frames > 0`.

**The event differs by control and getting it wrong is silent**: a range driven
with `change` moves the thumb and never reaches the widget, so the harness
photographs an untouched figure and hashes it happily. The setter throws instead,
and a throw becomes `px = "error"`, which can never match a baseline.

Proved end to end: setting `against` to `risk` at 60/30 gives six frames of ease
whose middle frame prints `= 73%` — a denominator genuinely mid-flight — settling
to `60% ÷ 30%` 22 frames later.

### Round eleven, in one table

| what | why it was wrong |
|---|---|
| design tab **full at rest** | it painted 112 dots at `globalAlpha = 0`; the sliders drove nothing visible |
| **one pass per recruited group** | all four flows shared one `travel` — "I have no idea where came from what" |
| **`--c-unknown`** (aliases `--ink-3`) | a cohort does not know who dies at recruitment; a case-control does. Two designs, same marks, and the colours alone say which |
| the ghost **returns to full** | a fixed 0.22 was right when the boxes started empty; once they start full it says the patients LEFT |
| `STEP_DX` 34 → **25** | a panel gets 233px, not 247 — the boxes overflowed their own panel |
| step 2 is **"then count"** in both | the counting is the same act; only the fixed margin differs. Also the only wording that fits |
| closing copy **shortened** | its last line was painted 12px below the canvas floor |
| `FLOOR`/`RULE_Y` **−40** | a band of nothing between the strip's rule and the tallest possible pile, fixed at both ends |
| arm heading 146, was **floating at 82–128px** above its pile | fixed baseline, not tracking the pile: two arms, two heights, reads as broken |
| **"the two exposure groups" deleted** | captioned nothing; its job moved to the strip's step 1 |
| strip step 1 says **EXPOSURE / OUTCOME** | it was a ternary with two identical branches, so the strip called an outcome-recruited group an exposure |
| manifest blurb | still described the thinning model and the "stays put" claim that **round ten retired** |

**Swept, not judged:** 882 cohort and 1,020 case-control states at the 550px
canvas — zero overflows, zero collisions, worst baseline 692 against 718.
**All 78 pre-existing fingerprint states MATCH** after four core changes.

### Two core changes this widget forced, both now principles

- **4.4 — a display change may deserve a transition.** The widget sets
  `anim.easing` in `rebuild`; core clears the flag and supplies frames. Clearing
  matters: a request that survives being granted is granted again, and a slider
  dragged faster than the frame clock then cancels every frame before it runs.
- **4.5 — a widget may decline a drive button.** `stepLabel: null` /
  `runLabel: null`. Omitting them still gets the default.

Also added: `--c-event` and `--c-nonevent` in `tokens.css`. `--c-nonevent` is
deliberately **not** grey — it is the odds' denominator and the whole lesson is
that it shrinks, so drawing it as furniture would hide the one quantity moving.
**All 78 pre-existing fingerprint states MATCH** after every core change; the
suite was run four times this session.

---

## Still outstanding, and independent of the widget

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`.** Kenneth is
doing these by hand.

- **Cell 40** states the odds-ratio interpretation wrongly. On the table
  `a=24, b=60, c=16, d=100` it says *"the odds of death in infected patients is
  2.5:1 = 5:2 … for every 5 patients who died with infection, there were 2 who
  died without"*. The odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is
  not an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** says *"In retrospective studies, we often do not know the
  population at risk, as the exposure is usually not known"*. It should say
  **case-control** — a retrospective *cohort* is fine for a risk ratio — and in a
  case-control the exposure is precisely what you go and ascertain. What is
  unknown is the population at risk.

The one thing still worth doing to widget 11: **judge it projected.** The
hypergeometric pool's dots are ~4px at the narrow layout and the R-code cards put
11px mono on a half-width card.

---

## What this session did

Planned widget 12, built it, and rebuilt it nine times against review. The
catalogue carries the full record. In brief:

| round | what changed |
|---|---|
| plan | `odds-and-risk` chosen over `ppv-prevalence` on four checkable counts |
| 1–2 | built with baseline-risk/risk-ratio inputs and two views |
| 3 | **"true risk ratio" was an error** — nothing here samples. Four counts, set directly |
| 4 | the drive row went; the figure updates live |
| 5 | the odds ratio goes first, matching `04-08` |
| 6–7 | study design became a strip, then a diagram, then **its own tab** |
| 8 | three layout defects in the design panel |
| 9 | concrete labels kept; the design animation staged one group at a time |
| 10 | **the case-control model was wrong**, and so was the claim about it |

### The harness traps, which will recur

Every one of these produced a false report about a correct widget.

- **An ease cannot be settled by a fixed wait.** This browser does not always run
  rAF through a long `await`. Nor by watching the *wording*, which flips at the
  halfway point while the numbers keep moving. Settle by **observing the exact
  target value**.
- **Dedupe before any collision check.** A repeated paint lands the same string
  at the same pixel, and a frame captured mid-ease then reads as thousands of
  overlaps.
- **A wrapper flag that says *installed* is worthless** once a diagnostic has
  restored the original. The probe then measures nothing and every state looks
  wrong. Install unconditionally.
- **An invalid `fillStyle` is a silent no-op.** `fills[undefined]` left every dot
  the canvas default black, and the text sweep saw nothing wrong because the text
  was fine. Wrap `arc` and `fill` and tally what colour was actually *asked for*
  — the fillText recipe, one level down. **A canvas will not tell you it ignored
  you.**
- **`globalAlpha = 0` paints perfectly.** A whole panel was invisible while every
  string reported correct text at correct coordinates. Only a screenshot found
  it. Screenshots for judgement, assertions for facts — and *invisible* is a
  judgement.
- **A `const` below `defineWidget` is in its temporal dead zone.** It calls
  `draw` during its own top-level run. Function declarations hoist; `const` does
  not.

### One lesson about placement, earned three times over

A count went **inside** its box (the dots reach it), then on the **label line**
(a 105px label against an 88px box), then **below** the box — where it sits
between two boxes and labels neither. It is on the label line now with short
labels. **A count has to be placed against everything that can grow, not against
the thing it labels.**

---

## THE BIG ONE: every baseline is recorded at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**, the
narrowest that layout ever produces.

**This is where widget 11's overflows were found, and there were six of them** —
a pool grid laid out for a desktop, an attempts readout that trailed the last
circle, a collapsed path longer than the canvas, and a fully-wound log-normal
writing `plnorm(1638.51, meanlog = 3.91, sdlog = 1.5)` 36px past a half-width
card. None was visible at 1400px and no hash would ever have caught one, because
`note()` and friends stroke surface-coloured before filling: **a collision erases
what it overruns rather than blending**, so it still looks like text and it
hashes consistently for ever.

The check that finds them, and the only one that does:

```js
// wrap fillText, measure each string, compare its right edge to the canvas width
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

Two things about running it in an iframe: **`y === 0` is the rotated y-axis
label**, whose coordinates are in the rotated frame and always look like an
overflow — skip it. And a widget paints once on load, before any wrapper is
installed, so **force a repaint** (re-press the already-selected segmented
button) rather than dispatching `resize`, which no longer repaints if the size
has not changed. A sweep that reports every state blank is measuring nothing.

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots in this project have produced several
phantom bugs, and the automation browser throttles `requestAnimationFrame` to
~1 frame per 300 ms, so animations appear frozen and any wait under ~300 ms
races the frame clock.

- `npm run check` asserts the invariants that are cheap to state in code.
- **Read the canvas's own text**, per the recipe above.
- **Measure rendered geometry, not attributes.** `getBoundingClientRect().width > 0`
  answers "is this on screen"; `el.hidden` answers "did I set a flag", and those
  are different questions. `getComputedStyle` on a child of a hidden parent
  reports the child's own display, which is not `none` — that check is a trap.
- `widgets/_lab/fingerprint.html` hashes each widget's canvas against a stored
  baseline. **Run the full suite when you touch `widgets/core/`** — that is the
  only kind of change that can reach a widget you are not looking at. **It
  auto-runs on load; never click Run**, which starts a second concurrent pass
  into the same table and can make "Copy new baseline" copy a half-interleaved
  set.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

Build → cheap checks → **if core changed, one suite run to confirm the existing
states still MATCH** → *show the human and iterate* → and only then add states,
prove determinism, baseline, commit.

> *Earned twice.* `bootstrap` was baselined three times over. Widget 11 changed
> shape in six of eight review rounds — a baseline taken at round two would have
> been thrown away six times.

`npm run check` fails a **non-draft** manifest widget with no fingerprint states,
which is the escape hatch: leave it `draft` while the design moves. A placeholder
`"px": "0"` also satisfies `check` if states need writing early.

It holds **three kinds of state**, and the distinction is load-bearing:

| kind | how | sees |
|---|---|---|
| **settled** | `?…&shown=N` — figure fully built, nothing moving | the finished figure |
| **driven** | `drive: { click, frames, dt }` — harness supplies the frame clock | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

A suite of settled states alone is **no test of the animation at all**. That gap
let a coordinate-system change put every falling ball six columns off-centre while
all eight settled states still matched. `check.mjs` now fails any widget that
declares an `animation` without at least one driven state.

`before` exists because **three separate shipped bugs were mid-animation states**.
Drive buttons are found by `data-key`, never by position — see principle 5.7.

If a fingerprint state legitimately changes, regenerate the baseline **in the same
commit** as the change, so the diff records that the rendering moved.
