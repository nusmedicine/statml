# PRD

What this project is, who it is for, and what it will not do.

Two documents feed this one and neither is repeated here:

| document | answers |
|---|---|
| [design-principles.md](design-principles.md) | **how** a widget behaves, each rule traced to the incident that earned it |
| [catalogue.md](catalogue.md) | **which** concepts earn a widget, in what order, on what evidence |

This one answers **what the thing is, who it serves, and what is out of scope** —
the frame those two sit inside. Where it closes a question either of them left
open, §9 says so explicitly.

---

## 1 · What this is

A collection of small, seeded, URL-addressable interactive figures for teaching
statistics and machine learning, built for two NUS courses: **PHM5003** Applied
Statistics for Precision Medicine and **PHM5005** AI/ML for Precision Medicine.

**This repo produces widgets and nothing else.** It is a static site: a gallery
and one page per widget. The teaching material lives elsewhere — in the MyST
notebook lessons at `Development/jupyterbook/phm5003` — and reaches a widget by
its URL.

A widget is one HTML page and one `main.js`, loaded as an ES module, with zero
runtime dependencies and no build step. Its entire state is in its URL.

---

## 2 · Who it is for

| | who | doing what |
|---|---|---|
| **primary** | the instructor, live | driving a widget on a projector, narrating it |
| **secondary** | a student, later | opening it from a link in a notebook lesson cell |
| **third** | the instructor, as author | tuning a figure by hand until it makes the point, then copying the link into a lesson |

There is no fourth user. **No TA, no co-instructor, no outside contributor.**
Three things follow:

- no contributor scaffolding — no `CONTRIBUTING.md`, no issue templates, no
  review process
- **no API stability guarantee.** `widgets/core/` may be changed freely and all
  call sites updated in the same commit. Nothing is versioned
- documentation is written for a future session with no memory, not for a
  stranger. That is what `HANDOVER.md` and the `new-widget` skill already are

If a TA is ever added, this section is the first thing to revisit — most of the
cheapness below depends on there being one author.

---

## 3 · A widget never arrives without a host

This is the load-bearing fact about how the collection is used, and it settles
what would otherwise be a contradiction between "prose stays thin" and "the
widgets are public".

**Every widget has a narrator.** In a lecture it is you, live, on a projector. In
self-study it is the notebook lesson whose markdown cell links to it. There is no
supported path where a student meets a widget cold with no surrounding context.
So:

- **Prose in the widget stays thin.** The host carries the argument. A widget that
  re-teaches its concept duplicates the lesson and grows past a screen.
- **But the widget must still carry its own identity**, because the link opens in
  a **new tab** — the lesson prose is then on another screen, or scrolled away.
  Title, question and subtitle must tell you what you are looking at and what
  question it answers. The bar is **self-explanatory, not self-teaching**.

### The governing surface is a projector

When surfaces conflict, the lecture wins:

- **No control budget.** Eight controls is fine. Rich is correct for a demo you
  narrate. The test stays the one in principles §3.5 — *every control must carry
  an idea* — which is a test of each control, not a count of them.
- **Projection legibility is a requirement**, not a nicety — new, and earned by
  this choice rather than by an incident. A figure that is crisp on a 27-inch
  monitor at arm's length can be unreadable from the back row: thin strokes
  disappear, 11 px tick labels vanish, low-contrast greys wash out in a lit room.
  Judge every widget projected, or at minimum at a distance, before calling it
  done. This is a **screenshot-for-judgement** question in the sense of principles
  §5.4 — legibility is exactly what assertions cannot settle.

Slides are **not** a surface. The lecture surface is the standalone widget page,
opened in a browser. No reveal.js path, no deck embedding, nothing to build.

---

## 4 · How a widget reaches a lesson

The notebooks are the host. **Tested on the live JupyterLab instance**
(`notebook.phm.nusmed.space`, R kernel) against the deployed widget, not reasoned
about:

| # | mechanism | status |
|---|---|---|
| 1 | **A plain link in a markdown cell** — opens the widget in a new browser tab | **CHOSEN.** Always works: kernel-independent, sanitiser-proof, zero code |
| 2 | **`IRdisplay::display_html('<iframe …>')` in an R code cell** — inline in the lesson | **Works, with a caveat.** Proven live. But see *trust* below |
| 3 | **`<iframe>` in a markdown cell** — inline in the lesson | **DEAD. Tested and stripped.** JupyterLab's markdown sanitiser removes `<iframe>` outright; the heading renders and the widget silently does not |

Mechanism 3 was ranked first in every earlier draft of this document on the
assumption that it *might* be sanitised. It is. A control proved the point
precisely: `<b>`, an `<a>` and an `<iframe>` in one `display_html` call all
survived in an output cell, so HTML output is not the problem — the markdown-cell
sanitiser is specifically what removes iframes.

**The trust caveat on mechanism 2.** Outputs are stripped when they are loaded
from an unsigned notebook and kept when they are generated in the running session.
A lesson notebook authored elsewhere and handed to a student arrives *untrusted*,
so a pre-saved widget output shows blank until the student runs the cell. Running
it always works. So mechanism 2 is only safe as *a cell the student runs*, never
as a figure they are expected to see on open.

**The decision is mechanism 1.** A link that opens a new tab. It is the floor, it
needs no cell to be run, no trust, and no kernel — which is also what removes both
embedders, see §6.

The kernel never entered into any of this: markdown cells are rendered entirely by
the JupyterLab frontend, so R versus Python was never the variable.

For the ebook assembled from these notebooks after the class, MyST is a
**different renderer with its own rules** — the JupyterLab result above says
nothing about it, and it is untested. MyST renders raw HTML from markdown and also
offers an iframe directive; confirm against your MyST version before relying on
it. The ebook is built in the existing MyST project, not here.

**Consequence for widget design:** full-screen in its own tab is now the path
that carries the teaching, so it is the one to design for. The ~900 px iframe
requirement (P13) is kept rather than dropped — mechanism 2 is proven and remains
available, the widgets already satisfy it, and it costs nothing to keep. Nothing
else about embedding is this repo's problem.

---

## 5 · Requirements

### Every widget

| # | requirement | source |
|---|---|---|
| P1 | Parameters are the only state of record; animation state never writes back | principles §1.1 |
| P2 | All state lives in the URL — no store, no component state | §1.2 |
| P3 | Everything is seeded. Same URL, same picture, in March and in September | §1.3 |
| P4 | `compute()` is pure and runs on parameter change only, never per frame | §1.4 |
| P5 | Starts empty. A finished figure is published via `?shown=N`, applied on first render only | §2.1 |
| P6 | Shows the mechanism, not just the result | §2.2 |
| P7 | A data change resets the animation; a `display: true` change must not | §3.2 |
| P8 | Never hardcodes a colour, size or font; references semantic token roles | tokens.css |
| P9 | All randomness comes from the seeded `rng` passed to `compute` | §1.3 |
| P10 | Legible projected | §3 |
| P11 | Readout tiles are mandatory — they are the accessible reading of the figure | §11 |
| P12 | Carries its own identity: title, question, subtitle. Self-explanatory, not self-teaching | §3 |
| P13 | Works both in a ~900 px iframe and full-screen in its own tab | §4 |

### The scaffold

| # | requirement |
|---|---|
| S1 | **Zero runtime dependencies.** `package.json` has no `dependencies` block |
| S2 | **No build step for widgets.** Adding a bundler is a decision to discuss, not a convenience to reach for |
| S3 | **Zero data collection.** No analytics, no telemetry, no backend, no student data — see §8 |
| S4 | The dev server sends `Cache-Control: no-store`, always (principles §5.5) |
| S5 | `npm run check` asserts every invariant cheap to state in code, and runs inside `npm run build` |
| S6 | The fingerprint harness holds both settled and driven states; a widget declaring an `animation` without a driven state fails `check` |

---

## 6 · Subsystems being removed

Both embedders are deleted. Neither has a host, and mechanism 2 in §4 makes both
unnecessary.

| subsystem | why it goes |
|---|---|
| **`book/`** — a Quarto book: `_quarto.yml`, `index.qmd`, `chapters/clt.qmd`, `assets/widget.lua`, `assets/embed.html`, `assets/head.html` | **Wrong toolchain.** The ebook is assembled with MyST (Jupyter Book 2), as `jupyterbook/phm5003/myst.yml` and `book-chem` both are. Quarto is not installed here and the Lua shortcode and `postMessage` auto-resize have never been rendered once. Deleting retires the repo's largest unverified subsystem without ever installing Quarto. Salvage the prose in `chapters/clt.qmd` into a lesson markdown cell first |
| **`python/statml_widgets`** and **`notebooks/demo.ipynb`** | **No host.** The PHM5003 lessons run the R kernel (`ir`); there is no `phm5005` project yet. A Python helper cannot run in an R notebook, and a pasted URL needs no helper in any language. Removes `show()`, `show_url()`, `url()`, the `DEFAULT_BASE` placeholder, and the hand-mirrored `HEIGHTS` dict |

**What this buys, beyond deleting code:** the three-places heights problem
(`manifest.json`, Python `HEIGHTS`, `widget.lua`) collapses to **one** place. Both
duplicate sites are in the files being deleted. The `npm run check` assertions
covering them go too.

**What is lost:** the convenience of `show(slug, n=30)` in a future Python course,
and the auto-resizing iframe. Both are recoverable from git if PHM5005 turns out
to want them.

---

## 7 · Where each widget lands

The lessons already exist, so the arc has host slots. This answers catalogue.md's
open question 1 — sequencing against actual teaching weeks.

| # | widget | lesson |
|---|---|---|
| 1 | `galton-board` ✅ | `03 / 02-03 — Inferential Statistics: Normal Distribution` |
| 2 | `clt` ✅ | `03 / 03-01 — Estimation: Estimating Mean & Variance` |
| 3 | `bootstrap` | `03 / 03-02 — Estimation: Quantifying Uncertainty` |
| 4 | `confidence-interval` | `03 / 03-02`, then `03 / 04-03 — Hypothesis Testing: Effect Size` |
| 5 | `permutation-test` | `03 / 04-01 — Hypothesis Testing: Significance` |
| 6 | `multiple-testing` | `05 — High Throughput Data` / `08 — RNAseq Expression Analysis` |
| 8 | `maximum-likelihood` ✅ | `03 / 02-02 — Inferential Statistics: Inferring Parameters` |
| 9 | `bayesian` ✅ | the same lesson, two headings later — it states `P(Data \| Parameters)` and `P(Parameters \| Data)` in that order, and the two widgets take one each |
| 12 | `odds-and-risk` ⚪ | `04 / 04-08 — Hypothesis Testing: Comparing Counts Between 2x2 Categories`, effect-size section; then `04 / 05-05 — Modeling: Categorical Outcome`, which derives `exp(bₙ)` as an odds ratio |

**#10 and #11 are missing by drift, not on purpose.** `em-mixture` is the third of the three
widgets the catalogue hosts at `03 / 02-02`; `probability-mechanisms` has no slot recorded
anywhere and needs one written down.

**THE DRAFTS ARE MISSING FROM THIS TABLE ON PURPOSE, and which widgets they are
has moved twice.** `generalization` (13) and `linear-regularization` (14) were
the drafts when this was written and are both shipped now; the manifest's four
`draft` entries are **`trees-and-ensembles` (17), `balancing-data` (18), `pca`
(19) and `mds` (20)**. All four are PHM5005 — a course with no MyST project, so
§7 cannot give them lesson slots. They are named by host notebook instead:
`03-3`, `03-4` and `03-5` (twice, cells 7–19 and 20–30).

**`mds` IS THE FIRST WIDGET WITH A HOST IN EACH COURSE, and the manifest can
only name one.** It was built against PHM5005's `03-5` (cells 20–30, Python and
`sklearn`), and its non-metric half comes from **PHM5003's** `05 / 04 —
Dimensionality Reduction` (R, `cmdscale` then `isoMDS`), which puts classical
and non-metric under one heading on one distance matrix. Both courses teach MDS;
only PHM5003 teaches the non-metric half.

The manifest still records `course: "PHM5005"` because the field takes one
string — and **nothing reads it**, in the gallery, the build or the lab index,
so it is a note rather than a switch. The dual host is recorded here instead. It
is also the argument that the DR widgets serve both courses, the way
`multiple-testing` and `bootstrap` already do (§ *Overlap* in the catalogue).

Two deferred entries also have confirmed homes, which strengthens their case:
`interaction-effect` → `04 / 05-04 — Modeling: Interactions Between Covariates`,
and the ML bridge → `04 / 06-01 Modeling for Prediction` and `06-02 Modeling for
Explanation`.

**A widget without a lesson slot is a warning sign**, not a blocker — but it
should prompt the question of who will ever show it.

---

## 8 · Distribution

- **Public.** GitHub Pages, open to anyone.
- **CC-BY-4.0** for prose and figures, **MIT** for code — the decision stands,
  but **adding the files is deliberately deferred**. Publishing a licence invites
  copying, and the arc is not finished; a public repo carrying no licence is *all
  rights reserved* by default, which is the stricter position while the material
  is still being built. The trigger to add them is the content being ready to
  spread, not the first deploy.
- **The address**, settled:

  ```
  https://nusmedicine.github.io/statml/                the gallery, and the landing page
  https://nusmedicine.github.io/statml/widget/<slug>/  a widget
  ```

  A project site in the existing `nusmedicine` organisation, which already serves
  `chemistry`, `nutrition` and `statcomputing` on exactly this pattern. `widget`
  is singular because it reads as a namespace in a pasted link; `scripts/site.mjs`
  is the only place that name is written.

  **Consequence:** the site is served from a `/statml/` subpath, not a domain
  root, so every deployed path must be relative — an absolute one works in dev and
  404s in production. `npm run check` fails on one, and `scripts/serve.mjs` serves
  the deployed layout so a copied URL needs no editing between dev and production.

- **Order of newly unblocked work:** ~~create the public repo and remote~~ →
  ~~first Pages deploy~~ → **paste real URLs into lesson markdown cells.** The
  first two are done — `nusmedicine/statml` is public and the site is live. Only
  the third is left, and it happens in the notebook project, not here.

**The widgets collect nothing.** No analytics, no telemetry, no backend, no
accounts. This is not only a privacy position — it is what lets a widget be
linked or embedded anywhere with no review, and what keeps the architecture a
static file server. Treat any proposal that adds collection as a change to this
PRD.

Known cost, unchanged: **GitHub Pages sends `max-age=600`**, so a student can get
a stale widget for up to ten minutes after a deploy. The proper fix is
content-hashed filenames, which needs a bundler and would end S2. Not yet.

---

## 9 · Decisions this closes

Every open question in `design-principles.md` §7 and `HANDOVER.md` §4, plus the
four this document opened and settled:

| question | resolution |
|---|---|
| **Control budget** — is there a cap? Do book embeds get a reduced set? | **No cap, no book mode.** The lecture governs; §3.5's per-control test replaces a count |
| **How much prose in the widget?** | **Thin**, because a widget never arrives without a host — §3. Self-explanatory, not self-teaching |
| **Licensing** | **CC-BY-4.0 prose, MIT code**, public Pages |
| **Print fallback** | **Out of scope.** PNG export stays opt-in and off |
| **The catalogue** — which concepts, in what order? | **Closed for PHM5003**: the twelve-widget arc, with lesson slots in §7. **Partly open for PHM5005**: the per-family arc from `04-3` is agreed and started; the evaluation arc is still a tier list |
| **`ppv-prevalence` deferred** despite the strongest evidence in the catalogue | **Stays deferred**, built as a matched pair with `imbalance-metrics` |
| **Generating the manifest** from a machine-readable catalogue | **Deferred, and largely obsolete.** Its main prize was ending the three-places heights; §6 does that by deletion instead. Its old count-based trigger never fires under a no-fixed-number plan — if it returns, the trigger is an **incident**, not a count |
| **Ball physics on the Galton board** | **Closed.** Dropped — a bounce implies the deflection is caused by peg geometry when the lesson is an independent coin flip. A landing squash remains free and safe |
| **Who else builds this?** | Nobody — §2 |
| **How do you know it worked?** | Judgement in the room — §10 |
| **The Quarto book** | **Deleted** — wrong toolchain, §6 |
| **The Python helper** | **Deleted** — no host, §6 |

---

## 10 · Success

**Your judgement in the room.** Did the lecture go better, did the questions
change, did you stop re-explaining the same thing for the third year running.

That is the whole bar, and stating it plainly has consequences worth naming:

- **No instrumentation** — which is what makes S3 costless
- **No pre/post testing, no item analysis, no cohort comparison.** So the
  `inferred` evidence grades in `catalogue.md` will stay inferred. Those entries
  are hypotheses about your students that this project has no mechanism to test.
  Accepted knowingly
- **The rule for earning a slot does the work instead.** A widget must name the
  misconception it dislodges, or name the widget it is a prerequisite for. That
  rule is the quality gate measurement would otherwise have been

---

## 11 · Non-goals

Stated so they can be pointed at rather than re-argued:

- A fixed widget count or a roadmap with dates. The catalogue is a living queue
- Measurement of learning outcomes, in any form
- Contributor onboarding, API stability, or versioning of `core/`
- **A kernel-side helper in any language** — Python, R or otherwise. A pasted URL
  is the interface
- **Book tooling of any kind in this repo.** The ebook is MyST and is assembled
  in the notebook project
- LMS integration, authentication, or anything student-identifiable
- Slides, PowerPoint, Keynote, reveal.js
- Print or static-figure fallback
- Screen-reader access to bin-level data. Canvas was chosen for one code path
  across many animating figures; **readout tiles are the accessible reading of
  every figure, which is why P11 makes them mandatory rather than decorative.**
  No institutional standard applies. If one ever does, this is the decision that
  reopens
- Mobile-first layout. The projector, the laptop and a notebook iframe are the
  targets
- A bundler, until the `max-age` staleness actually bites

---

## 12 · Still open

1. ~~**The PHM5005 arc.**~~ **Partly closed.** The notebooks turned out to be
   readable — on disk with their outputs, and mirrored in a Drive folder needing
   no auth — and reading `04-3 Tour of Algorithms` produced a second arc beside
   the evaluation one: six widgets, one per algorithm family, in the order the
   notebook teaches them. `catalogue.md` now carries both, and two widgets are
   built as drafts. What is still open is the evaluation arc's own spine, which
   remains the provisional *a model that fits → a model that generalises → an
   honest estimate of how well → a probability you can act on*. The course still
   has no notebook project, so §7 gives PHM5005 no lesson slots — host notebooks
   are named instead.
2. ~~**Does an `<iframe>` survive a JupyterLab markdown cell?**~~ **Closed: no.**
   Tested on the live instance — the markdown sanitiser strips it. §4 records what
   was tested, what replaced it, and the trust caveat on the surviving inline
   option. **The MyST ebook is a separate renderer and remains untested**, which is
   the part of this question that is still genuinely open.
3. **Whether any concept resists a widget.** Some are hard because they are
   *abstract*, which widgets help with; others because they are *technical*, which
   widgets do not. `interaction-effect` is the main suspect — and §7 shows it has a
   lesson waiting. Mock up before committing, per principles §5.1.
