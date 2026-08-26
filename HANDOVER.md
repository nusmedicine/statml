# Handover

## Where things are

**Twenty widgets: sixteen SHIPPED, four DRAFT.** Widget 17,
`trees-and-ensembles`, widget 18, `balancing-data`, widget 19, `pca`, and
widget 20, `mds`, are all drafts — they deploy to their final URLs
but stay off the gallery and wear the draft bar. Everything is live at
<https://nusmedicine.github.io/statml/>.

**Widget 20 `mds` has had FOUR rounds of Kenneth’s feedback, and the result is
unseen.** Round one: a visible third dimension, a seed that varies the samples,
a graph of the stress. Round two: groups, like PCA’s — and the group count
turned out to reproduce the widget’s own argument, because two centres make a
line and three make a plane while four make a tetrahedron. Round three: the row
of three became a 2x2, which gave every panel half the canvas instead of a third
and put the table’s numbers back at twelve samples. Round four: **NON-METRIC
MDS**, in this widget rather than its own, because `05-04` puts classical and
non-metric under one heading on one distance matrix. Still no fingerprint
states. See *NEXT* below for the six URLs to open and the two decisions to put
to him.

**THE STRESS NUMBER CHANGED MEANING IN ROUND FOUR.** It was raw stress —
`sklearn`’s `stress_` — and it is Kruskal **stress-1** now, because the lesson’s
non-metric formula is the normalised one and a single chart cannot carry both
definitions. Any stress figure in this file older than the round-four section is
a different quantity: four samples ungrouped reads 0.152 rather than 1.445.

**Widget 19 `pca` has six rounds of Kenneth's own feedback in it.** It began as
a four-tab widget over PCA, MDS, t-SNE and UMAP; his call on 2026-08-26 was
**one algorithm, one widget** — *"we'll do each algorithm as a separate widget
due to the complexity"* — so it is PCA alone, MDS is widget 20, and t-SNE is
next.

**`widgets/core/` CHANGED IN THREE FILES**, which is the one kind of change that
reaches widgets you are not looking at:

- **`tokens.css` gained `--c-cluster-a` … `-f`**, a ramp of six for an
  unsupervised grouping, ordered blue, yellow, red, aqua, green, violet.
  `env.js` exposes them as `colors.clusters`. `--c-group-a/b` mean *arms of a
  comparison you assigned*, which a cluster is the opposite of.
- **`widget.js` gained `drag`**, so a figure can resolve a MOVEMENT to a value
  the way `regions` resolves a pixel to an identity. It names its parameters up
  front and may name more than one, because they are applied together as a
  single transaction — see its own comment block for why a region may not.

**The suite has been run four times and reports 123/123 with every text hash
identical.** The pixel half CANNOT be judged from an agent session: the browser
pane runs at `devicePixelRatio` 1 and the baseline was recorded at the machine's
scaled DPR, so most pixel hashes differ uniformly, on every widget, including
ones nothing touched. **One run from the normal browser is owed before any of
this is pushed.**

**Widget 18 went through TWELVE rounds of review with Kenneth and is now what he
asked for.** Widget 17 is still missing a look at its boosting page. Both are
unbaselined by design — a baseline recorded before the design is settled is
thrown away, and widget 18's design moved in every one of those twelve rounds.

**EVERYTHING AFTER `3058818` IS UNPUSHED**, and that is the durable way to say
it: `git ls-remote` puts `origin/main` there, and nothing since has been
published. As of this commit that is widget 19's four — the core change, the
widget, its handover and a correction to that handover — plus widget 20's.
**Every push to `main` publishes**, so a push now puts two unreviewed drafts on
the live site at once.

**DO NOT WRITE THE COUNT DOWN, WRITE THE SHA.** The number has now been wrong in
four consecutive handovers — nine, then eleven, then three, then four — and the
mechanism is the same every time: **a handover commit counts the tree before
itself exists**, so it is short by one the instant it lands, and the next
session copies the stale figure forward. `3058818` does not move when a commit
is added to the local branch.

**Verify even that rather than believing it.** The local `origin/main` ref was
last fetched on 24 August and a stale ref reads as a clean tree either way:

```bash
git ls-remote origin refs/heads/main    # the truth, without touching any ref
git log origin/main..HEAD --oneline     # what a push would publish, if the ref is fresh
```

Every push to `main` publishes, with no staging step.

**123 fingerprint states, each carrying two hashes, and the suite is GREEN** — a
full run on this machine reports *all 123 states identical*. Six are widget 16's,
four settled and two driven. Four are widget 15's, all settled: it declares no
`animation` and no `regions`, so settled coverage is all `check` requires of it.

**The work now happens on Windows, and the toolchain is verified there.** Read
*Working on Windows* and *`px` tracks the device pixel ratio* below before
trusting or re-recording any hash. The short version:

- **`npm run build` was failing two runs in three** — Dropbox holds `_site/` open
  and Windows will not remove a directory anything has a handle on. It retries now.
- **The dev server is on `:8010`, not `:8000`** — a Docker container in WSL owns
  8000, and the failure looks like a working server from the shell.
- **All 123 `px` hashes were re-recorded**; `tx` did not move on a single state.
  It was display scaling, not a regression.
- **HANDOVER's own baselining recipe computed `tx` wrongly** and would have
  poisoned widget 17's baseline silently. Fixed.

**A later pass found three more, all of them the move's fault:**

- **`.claude/launch.json` declared `"port": 8010` and never passed it**, so the
  preview tool started the server on its default **8000** — the one port the pin
  exists to avoid — and then pointed the pane at 8010. It also carried
  `autoPort: true`, which contradicts the determinism it was added for.
- **The documented dev command was bash-only.** `PORT=8010 npm run dev` was in
  CLAUDE.md, README and this file; PowerShell is the shell here and has no
  inline env-var prefix, so it dies with `CommandNotFoundException`. It is
  `node scripts/serve.mjs 8010` everywhere now — an argv port works in any shell.
- **The PHM5005 notebooks were missing** and are re-downloaded, but the only
  copies available online are **output-stripped**. That is not cosmetic: it is
  what forced `04-3`'s numbers to be re-measured, and re-measuring changed them.

**The suite was re-run twice this session: 122/123 then 123/123.** The lone
DIFFER was a `px`-only flake — see the note below — not a regression.

**Two things were shipped without being done**, both worth knowing:
widget 15 still lacks the marginal-vs-conditional note Kenneth asked for (below),
and **no widget from 11 onward has been judged projected**.

**Widget 17 is built and unreviewed in one place**: Kenneth has not seen the
finished boosting page, and flagged that its 20 rounds may be too many since
nothing visible changes after round 6. It is not baselined and has no catalogue
entry — see its own section below for the five things still owed.

**Widget 18 `balancing-data` is BUILT and REVIEWED**, hosting at `03-4 Data
Preprocessing`, section `## Balancing Data`. Three steps revealed downwards by
gates: the cohort and a dial that throws cases away, the fit against the whole
cohort's line, and the four corrections. Its twelve review rounds are recorded
below and in [docs/catalogue.md](docs/catalogue.md) — read the round headings
before changing anything, because most of them reversed an earlier decision for
a reason that is written down.

**Next is a widget for UNSUPERVISED LEARNING** — PCA, MDS, t-SNE, UMAP. The
reconnaissance is done; see *NEXT* below.

```bash
node scripts/serve.mjs 8010   # NOT `npm run dev` — :8000 is Docker's here
npm run check                 # before every commit
```

> **A lone `DIFFER` is worth re-running before believing.** On the Mac,
> `logistic-regression`'s `?theme=light` hashed one value on the first suite run,
> a different one on the second and the original again on the third — with its
> **`tx` identical every time**, so only the pixels ever moved. Isolated, it gave
> the recorded value on six consecutive renders and again after 10, 20 and 30
> churned iframes: eleven observations against one. The specific hashes are gone,
> superseded by the Windows re-baseline, but the habit is the point.
>
> **It has now happened on Windows too, on a different state.** A full suite run
> reported 122 MATCH and one DIFFER —
> `clt ?theme=light&dist=exponential&n=5&shown=12` — with **`px` moved and `tx`
> identical**, the same signature. The very next run returned all 123 MATCH. So
> this is not a `logistic-regression` quirk and not a macOS one: it is a property
> of `px`, it is rare, and `tx` has never once moved with it. **A lone DIFFER
> whose `tx` is unchanged is a re-run, not a regression.**

---

## NEXT: WIDGET 20, ROUND FIVE — then t-SNE

**Four rounds of Kenneth's feedback are in and the result is unseen.** Round
one: a visible third dimension, a seed that varies the samples, a stress chart.
Round two: groups, like PCA's. Round three: the row of three became a 2x2.
Round four: **non-metric MDS**, as a segmented control, with the table switching
to ranks. Still no fingerprint states — the design has moved in all four rounds.

```bash
node scripts/serve.mjs 8010     # then /widget/mds/
```

**Six states worth opening, in this order.** Every stress figure below is
**Kruskal stress-1**, which replaced raw stress in round four — a number quoted
anywhere older than that section is a different quantity.

| URL | what it shows |
|---|---|
| `/widget/mds/` | two clusters of three on a drawn sphere, nothing measured; drag it |
| `?measured=1` | the table at full ink, shaded by distance — the block pattern IS the clustering |
| `?measured=1&shown=99` | the faithful case: stress **0.002**, every fitted number equal to its measured one |
| `?measured=1&method=rank&shown=99` | the same picture, read as ranks: stress **0.000**, **Ranks held 15/15** |
| `?groups=4&samples=3&measured=1&shown=99` | the broken case: stress **0.190**, four clusters still distinct, the gaps wrong |
| `?groups=4&samples=3&measured=1&method=rank&shown=200` | the rank fit DEGENERATING: stress 0.169, **Ranks held 2/66** |

**TWO DECISIONS ARE OPEN, and both are teaching calls rather than engineering
ones, which is why neither has been made here.**

**1. The default FITS.** Two groups of three is `05-04`'s own shape, but its
stress is 0.002, so a reader who never touches `groups` leaves having seen MDS
be exact. The default before groups existed failed to fit, which is the widget's
headline claim. Round three removed the obstacle to changing it: four groups of
two now reads 11px at a 550px canvas and 13px at 770, where under the row of
three it sat exactly on the 8px threshold and would have lost its numbers. So
(a) leave it, since `groups` is the second control and its own detail line
points at the answer, (b) default to four groups of two — four clusters, stress
0.195, numbers everywhere — or (c) default to `samples = 1`, the ungrouped
stage, which shows no clusters at all.

**2. The rank fit degenerates at four groups** and currently ships that way,
with the **Ranks held** tile reporting it (`2/66`). It is the documented
non-metric degeneracy and not the solver — see the widget section below for the
three things tried. If it should not be reachable, the options are capping
`groups` at 3 while the rank fit is selected, or a line of copy naming it.

### OPEN: should the 2-D panel label its axes? The lesson does, the widget does not

Kenneth asked what the axes correspond to on the table. **Nothing**, and that is
why the widget draws neither — an MDS arrangement is fixed only up to a turn and
a mirror, so turn the picture thirty degrees and every coordinate changes while
every distance, and therefore the whole table, stays identical. The line where
the labels would have been says *only the distances mean anything*.

**But `05-04` labels them**, in both plots, `xlab("First Dimension")` and
`ylab("Second Dimension")` — because ggplot needs axis labels, not because a
first dimension is a property of the data. So a student who runs the lesson sees
labelled axes and comes to this widget and sees none.

Three ways out, none of them obviously right:

1. **Leave it.** The widget is about the table, and labelling axes that appear
   nowhere in the table invites exactly the question Kenneth just asked.
2. **Label them as the lesson does**, and carry the caveat in the line
   underneath — matches what students will produce themselves.
3. **Label them and let the reader break them**: a control that turns the
   arrangement while the table visibly does not move. That is the strongest
   version and the most work.

**Worth knowing before choosing 3:** the widget can no longer show that for
free. Before round one the seed moved only the optimiser, so two seeds gave the
same arrangement rotated or mirrored — turn it, and nothing in the table
changed. The seed now moves the samples too, so that demonstration is gone.

**Then t-SNE**, per [docs/catalogue.md](docs/catalogue.md) § *NEXT · t-SNE, then
UMAP*. Its open question is the one MDS did not have: t-SNE is not thirty lines
and has no closed-form answer, so decide early whether it computes at runtime or
replays a precomputed seeded table.

---

## Widget 20 · `mds` — BUILT, DRAFT, FOUR ROUNDS IN, TWO METHODS

Full record in [docs/catalogue.md](docs/catalogue.md) § *Widget 20*, including
three sections marked SUPERSEDED that keep measurements worth not taking again.
The short version, and the parts that will bite something else:

**Three panels and a chart. One gate, then Step and Play.** Where the samples
are, the table of every pair's distance, the arrangement built from that table
alone, and under the arrangement the stress falling step by step. The gate plays
four beats over 2s and the third of them is the widget: **the sphere and the
gene axes go out and the samples hollow to faint rings** while the table stays
at full ink.

**IT IS NOT A PROJECTION AND MUST NEVER LOOK LIKE ONE.** Widget 19 flattens a
cloud onto a plane; this one throws the coordinates away and builds an
arrangement from nothing. That is why the 2-D panel has **no axes and no axis
labels** — an MDS arrangement is fixed only up to a turn and a mirror.

### Round four added NON-METRIC MDS, in this widget rather than its own

`05-04 Dimensionality Reduction` has ONE section — *Multidimensional Scaling:
Classical and Non-metric* — with the two under it on the same `distMatrix`:
`cmdscale(dist(t(countData)), k = 2)` then `isoMDS(distMatrix, k = 2)`. One
topic, one widget. Its data is `airway`, 4 controls and 4 treated, which is why
**`samples per group` gained a fourth option**.

Kenneth's four calls on the mock-up, all built: a **segmented control**, the
table showing **ranks**, **no transform panel**, **no squash control** — *"we
just want to give an intuition of how non-metric is different because it uses
ranks."*

**THE RANK FIT CONTINUES THE METRIC ONE, and do not change that.** `isoMDS`
takes its default start from `cmdscale`, so it is what the lesson's own code
does — and from a random start non-metric SMACOF **collapsed 18 of 40 seeds**
into degenerate clumps at eight samples. So the rank trajectory IS the metric
one with more steps on the end, the prefix is bit-identical (asserted), and the
reader keeps their place when they switch. That is why `method` is
`display: true` despite changing what `compute` returns, and why `rebuild`
clamps the step index for the switch back.

**A THRESHOLD NUDGE WAS PROPOSED FOR THE RANK TABLE AND THEN MEASURED AWAY.**
The worry was that ranks would disagree everywhere. They disagree by GROUP
count, not sample count — exact-rank agreement over 40 seeds is 87–100% at two
groups, 44–100% at three, 6–33% at four — which is the widget's own lesson
arriving per cell. It is content. And a rank is a shorter string than a
distance, so it fits wherever a distance did.

### THE RANK FIT DEGENERATES AT FOUR GROUPS, and it ships that way on purpose

Non-metric scaling can satisfy an order by clumping: with four tetrahedral
centres it pulls each cluster toward a point. Over 20 seeds, **spearman 0.785 →
0.809 while stress-1 goes 0.159 → 0.106** — the number falls because the
configuration collapsed, not because the order improved. Two and three groups
are clean at 0/20.

**It is not the solver.** Rescaling the disparities and rescaling the
configuration give bit-identical results; stopping on stress gain the way
`isoMDS` does moves it from 14/20 to 12/20 and no further. It is the documented
non-metric degeneracy.

So the readout names it: under the rank fit the second tile becomes **Ranks
held**, reading `15/15` at the default and `2/66` at four groups of three. **If
Kenneth would rather it never appeared**, the options are capping `groups` at 3
while the rank fit is selected, or a line of copy.

### A NON-METRIC ARRANGEMENT HAS NO SIZE OF ITS OWN, so the widget fixes it

Kenneth: *“in NMDS the clusters are quite close together and not as clear as
MDS.”* Half of that was the DRAWING. Only the order of the distances is fitted,
so nothing in the objective pins the size, and the fit drifts smaller because
the monotone fit pools neighbouring distances and pooling averages. The final
arrangement as a fraction of its panel, before the fix: **84% metric against 48%
rank at four groups of three** — two pictures side by side at different scales.

The rank fit now holds the metric fit’s size at every step, which the first frame
already has, so the switch stays seamless. Scaling changes no distance ORDER, so
it changes nothing the fit is judged on — separation, stress and all 149
assertions are unmoved.

**The other half was real**: the four-group degeneracy above. Fixing the scale
makes it MORE visible, which is the right direction.

### KRUSKAL STRESS-1 REPLACES RAW STRESS, and every earlier figure changed

The widget printed raw stress — `sklearn`'s `stress_`, the lesson's classical
formula. The lesson's non-metric formula is normalised and the two are not
comparable, so one chart carrying both methods forces one definition. **Four
samples ungrouped now reads 0.152, not 1.445; four groups of three 0.190, not
20.7.** Anything in this file quoting an old figure is quoting a different
quantity.

**And stress-1 is not monotone, which raw stress was.** It divides by the size
of the arrangement, so the first Guttman step out of a random layout can shrink
it faster than it improves the fit: 8 of 5699 metric steps rise, every one at
step 1, worst by 0.108. The chart's ceiling is the trajectory's MAXIMUM rather
than its first value — anchored on `stress[0]` those runs draw their second
point above the frame. The driver exempts steps 1–2 for the same reason and
says so.

### Round three put it in a 2x2, and the quadrants are determined rather than chosen

```
    the samples        the table
    the stress         the arrangement
```

Three panels in a row gave each of them a third of the canvas — 210px at the
width a reader has, 146 at the narrowest — and left the chart alone in a band
two thirds empty. Each panel now gets **half**, which is 37% more, and the
widget goes 377px tall to **666** (550px canvas: 287 to 492). That is ordinary
here: `multiple-testing` is 700 and `odds-and-risk` 718.

**The table is what the extra width buys**, and it is the panel that could use
it: twelve samples — four groups of three, the setting where the fit breaks —
now prints all 132 of its numbers at 10px on a 770px canvas, where the row of
three could only shade them. Nine samples went from *no numbers at all* on a
narrow window to 9px.

**Do not reshuffle the quadrants.** Exactly one assignment satisfies all three
constraints, so any change to one forces the rest:

- the table sits **directly above the arrangement** it is the input to, which is
  the one adjacency the widget cannot do without (2.7)
- the cloud is **diagonal from the arrangement**, never beside or above it.
  Widget 19 puts a cloud next to a 2-D plot because there the second IS a
  projection of the first; here it is not, and two spaces sharing an edge invite
  exactly the reading this widget exists to break. In the row of three the table
  sat physically between them, and that was doing real work
- reading order runs **across then down** (3.1), the order the story does

Cloud top-left forces arrangement bottom-right; table top-right is the only
remaining quadrant that keeps it above the arrangement. Everything follows.

**The chart earned its quadrant rather than being stretched into it**: a plot
area inset from the cell, four gridlines, an axis, the starting stress against 0
on the y and the step count on the x. The reader is being asked to read a SHAPE
— steep, then flat — and a shape needs something to be read against.

### The group count reproduces the widget's own argument, one level up

Two centres make a line and three make a plane — both already flat, so 2-D holds
them exactly. Four make a tetrahedron and it cannot. Median stress over 40
seeds at three per group: **0.01, 0.12, 14.3**. At four groups the clusters are
still distinct (separation ratio 2.5) while the gaps between them are wrong,
which is `03-5`'s "the cluster separation is less clear" with a mechanism under
it. **If that stops holding, `groups` has stopped meaning anything** — the
driver asserts all three.

### The table degrades on purpose, and the shading is the part worth keeping

Twelve samples is a 12 × 12 table whose cells reach 7px. So **every cell is
shaded by its distance** (darker is further, alpha 0.04–0.34 of
`--c-empirical`), at every count, and **the numbers go when the cell drops below
8px** — numbers to 8 samples at 550px and 9 at 770, none at 12. Nine is the one
count that flips with the window.

That is a gain rather than a concession: what a reader wants from a table that
size is the BLOCK PATTERN, near within a cluster and far between, and that is a
picture rather than a set of figures. It is how the reader sees that the input
already contains the clustering.

**Letters and pair lines retire together above six samples** — a letter has
nothing to label once dots overlap inside a cluster, and sixty-six pair lines
are a hairball where fifteen are a figure. The table's headers keep the letters
at every count, coloured by GROUP.

### A MULTIPLIER, NOT AN ALPHA SET BEFORE THE CALL

`sampleDot` assigns `globalAlpha` outright in both of its branches, so an alpha
set by the caller is thrown away and a depth cue built that way silently does
nothing. It takes a `fade` **multiplier** now. Any helper that sets
`globalAlpha` rather than multiplying it has this property.

### Verify it without a browser — the driver is the fastest thing in the loop

Same two recipes as widget 19, under *Verifying changes* below. **119 assertions
run in under a second, with no server**, over all nine settings of the two count
controls.

**Its anchors have now changed twice, and each time for the better.** The
regular tetrahedron's exact numbers asserted one configuration; what replaced
them holds at every seed — n = 3 exact at all 60 tested, n = 4 never below 0.2,
twelve seeds giving twelve different distance tables, **the stress never rising
across 108 runs**, and now **every cluster a separate blob at every grouped
setting over 30 seeds**. An assertion that a curve never goes up is worth more
than an assertion that it ends at 1.830.

### THE HARNESS DROVE THE WRONG PATH TWICE, the same way both times

Both cost a round of confusion and both look exactly like a broken widget.

1. **Opening the gate by setting the parameter and calling `rebuild` leaves the
   reveal to ANIMATE**, so `pump` ran the 2s reveal, returned false, and every
   stress assertion read the random starting layout — stress 8.58 at n = 4 and
   3.14 at n = 3. The tell was that n = 3 failed, and n = 3 cannot fail.
2. **In the browser, toggling the gate to force a repaint restarts the reveal
   whenever `k` is 0** — `rebuild` only short-circuits to `reveal = 1` if a fit
   is already on screen. With the frame clock throttled the captured paint sat
   at reveal ≈ 0, and a sweep reported **zero numbers in the table at every
   count**, including ones that plainly show them.

**Force a repaint with a SEED NUDGE, not a gate toggle**: a data change re-inits,
and `init` sets `reveal = 1` whenever the gate is open. Set the seed one step
away, clear the buffer, set it back — exactly one paint, at exactly the state
you want, with nothing left animating.

### Three defects the checks caught, and one is a core fact worth knowing

- **A `choice` renders the SELECTED OPTION's `detail` and IGNORES the field's
  own** (`controls.js`, the choice branch). A line written once for the whole
  slider is copy nobody can read, and it looks correct in the source. Found by
  scraping the rail in the browser, not by reading `main.js`.
- **A square table cell takes its size from the height it does not need.** At a
  550px canvas a square cell put six samples on a **7px font**. Width sets the
  type size now, height only has to hold two lines.
- **The largest-gap tile read "B–A is 3.94"** of a pair the rest of the widget
  calls A–B, because `pairs` runs down the table's rows and holds the later
  letter first.

### TWO TOOLING FAULTS, and the first cost the most time

- **`Bash` SILENTLY TRUNCATES A LONG COMMAND, so a big heredoc dies with
  `unexpected EOF while looking for matching '`.** A 25KB `cat > file <<'EOF'`
  fails; a six-line one works. It is not a quoting problem. **Write files with
  the `Write` tool and patch them with a short `node -e` script.** A second trap
  sits next to it: **backticks inside a double-quoted `node -e` are command
  substitution**, so a patch script carrying markdown code spans dies with
  `pca\: No such file or directory`. Single-quote the script, or put it in a
  file. And **a bulk regex replace across a driver leaves it half-converted** —
  the loops kept their old variable while their bodies referenced a new one, and
  it only surfaced as `combo is not defined`. Read the file after a sweep.
- **THE STRAY POINTER INPUT IS REAL AND IT MOVED TWO SLIDERS.** Between one
  `javascript_tool` call and the next, `?points=4&seed=1` became
  `?points=5&seed=44` with eleven fit steps run, purely from automation-browser
  input nobody dispatched. **Do the whole measurement in ONE call** — wrap
  `fillText`, force the repaint, read the result, return.

### The browser pane could not be shown, so nothing was judged by eye

`computer{action:"screenshot"}` fails with *the Browser pane is not displayed,
so the page is not compositing frames*, and `tabs_select` does not fix it.
Everything visual here was established the other way: a `fillText` sweep for
every string and its measured extent, and `arc`/`fillRect`/`stroke` sweeps for
every dot, every shaded cell, every globe segment and every panel box. That
gives font sizes, overruns, collisions, dot radii, shading alphas, and whether
anything falls outside its panel — but **it says nothing about whether the
figure is pleasing**, which is exactly the half screenshots are for.

---

## Widget 19 · `pca` — BUILT, DRAFT, reviewed six times

```bash
node scripts/serve.mjs 8010     # then /widget/pca/
```

**The rail is three sliders — groups, samples per group, seed — and nothing
else.** Drag the figure to turn the cloud freely. **Run PCA** draws PC1, PC2 and
their plane. **Project onto the plane** lands the samples on it and turns the
plane to face you over 1.8s, and that turn is the 2-D plot arriving. No Step, no
Play, no lead.

**NOTHING SPINS.** An earlier build turned PC1 into place by power iteration and
swept PC2 through the perpendicular circle, defended on the ground that both are
real algorithms. They are, and it was still wrong — sklearn computes an SVD,
nothing rotates, and a reader watching a line hunt for a maximum learns a
mechanism the method has not got. *"Don't do crazy spinning rotation that is
nonsensical."* **Do not put it back.**

**THE GROUP CENTRES LIE IN A PLANE, NOT ON A LINE.** One component separates the
groups worse and worse as `groups` rises — 100% at two, 51% at six — while two
stay at 100%. On a line PC1 alone already separates everything and PC2 adds
nothing, so the third beat would have no reason behind it. **MDS needs the same
care about where its stage puts its structure.**

### Two things it does not have, both deliberate, both one decision away

- **No failing case, and principle 2.6 wants one.** An earlier build had two,
  measured, both `03-5`'s own blind spots: an outlier supplying 77% of PC1 and
  squeezing the other eleven samples into 30% of the plot, and a groupless cloud
  whose plane still keeps 81%. Dropped for simplicity, not because they stopped
  being true. Numbers to rebuild either are in the catalogue.
- **No one-versus-two comparison.** Two readout tiles read *"Right group, on PC1
  alone 73% / On PC1 and PC2 100%"* and were the payoff for the groups slider.
  Cut on *"just report PC1 % and PC2% at the end"*. With them gone the groups
  slider changes the picture but no longer makes an argument. ~15 lines.

### Three traps this widget hit, all still live

1. **Only the FIRST gate animates.** `GATE_PARAM` is
   `spec.find(f => f.type === "gate")` — one gate, the first one. With two data
   gates the second silently JUMPS, because a data change runs
   `stopAnim(); render()` and `init` paints the finished figure. **Make both
   gates `display: true`** and ask for frames with `anim.easing`.
2. **A rotation must land on the target figure's own framing**, not merely
   face-on. Facing the plane's normal leaves the in-plane roll wherever it was,
   so the panel beside it showed the same samples the other way up. Write the
   end state down — the screen basis becomes PC1 across, PC2 up, at the other
   panel's scale — and slerp the basis vectors toward it, re-orthonormalising so
   the cloud rotates rather than shears.
3. **A wholesale rewrite loses blocks silently.** It happened twice in one
   session: `slerp` was deleted and then called, and the entire `drag` block
   vanished during a comment cleanup while every existing assertion still
   passed. **Edit these files; do not regenerate them** — and see the contract
   check below.

### Verify it without a browser

Both are recorded under *Verifying changes*: the node driver (stub the one
import, capture the config, pump `advance` with a fixed `dt`) and the **contract
check**, which is the lesson from trap 3 — a driver that only exercises what
exists cannot notice what stopped existing, so list the capabilities BY NAME:
every top-level key, every parameter and its type, that the parameter list is
exactly those and no more, and that `drag` is wired to both angles rather than
merely present.

---

### The reconnaissance, as it was written

Kenneth asked for this at the end of the session that finished widget 18. Some
of what follows is now answered; it is left intact so the answers can be checked
against what was assumed.

### The host exists and is unusually complete

`03-5 - ML - Unsupervised Learning.ipynb`, 68 cells, and it is TWO subjects:

| cells | subject | methods |
|---|---|---|
| 6–50 | **Dimensionality reduction** | PCA (7–19), MDS (20–30), t-SNE (31–40), UMAP (41–50) |
| 51–67 | **Clustering** | K-Means (52–59), DBSCAN (60–67) |

Every one of the four DR methods is worked on the **same data**, plotted twice —
once without labels, once coloured by the true `normal`/`tumor` type — and the
notebook draws its own conclusion each time:

- PCA: *"the samples separate visually into 2 clusters"*
- MDS: *"the cluster separation is less clear"*
- t-SNE: *"clear separation into 2 clusters"*
- UMAP: *"a clear separation into 2 clusters"*

**That structure is a widget already**: one data set, four projections, a
labels-on/labels-off toggle, and the question *does the structure you see mean
anything*. Kenneth's own framing — "PCA, MDS, t-SNE, UMAP" — matches it exactly.

### The data, and what is already known about it

Colorectal gene expression, loaded straight from a URL in cell 3:

```
https://sbcb.inf.ufrgs.br/data/cumida/Genes/Colorectal/GSE44076/Colorectal_GSE44076.csv
```

Dropping `samples` and `type`, then `KNNImputer(n_neighbors=5)` + `StandardScaler`
over the numeric columns. **This is the same data widget 16's planning already
measured**, and that measurement is directly relevant: *2,258 probes have
|AUC − 0.5| > 0.45 and one separates the classes alone; of 435 mid-strength
pairs, ZERO need a curve.* So the classes are close to trivially separable, which
is why every method finds two clusters — and which is a warning: **a projection
widget on this data may not be able to show a method FAILING**, and the four
methods differing is the whole point.

Measure that before designing. If nothing separates the four on this data, the
options are the same two widget 16 faced: a generated stage, or a different
question.

### The parameters each method exposes, from the notebook's own syntax cells

| method | knobs the notebook names |
|---|---|
| PCA | `n_components`. Outputs `components_` and `explained_variance_ratio_` |
| MDS | `n_components`, `metric` (True = distances, False = rank order only), `random_state`. Outputs `stress_` |
| t-SNE | `n_components`, **`perplexity`** (5–50, "balance between local and global"), `learning_rate` ("too small = crowding; too large = points fly apart"), `max_iter`, `random_state` |
| UMAP | `n_components`, **`n_neighbors`** ("local vs global"), **`min_dist`** ("how tightly points are packed"), `metric`, `random_state` |

**`perplexity`, `n_neighbors` and `min_dist` are the three that carry an idea**,
and all three are the same idea in different clothes: how much of the
neighbourhood a point is allowed to care about. That is the candidate spine.

### Two things to settle before anything is drawn

1. **`random_state` is on THREE of the four.** MDS, t-SNE and UMAP all return a
   different picture on a different seed, and PCA does not. A widget that lets a
   reader move the seed and watch t-SNE rearrange itself while PCA sits still
   would teach something no static figure in the lesson can — and it is the
   honest warning about reading clusters off a t-SNE plot. **This may be the
   whole widget.**
2. **Zero runtime dependencies (non-negotiable 7).** PCA is a few dozen lines of
   power iteration or Jacobi. MDS is SMACOF. t-SNE and UMAP are NOT small, and a
   faithful UMAP is out of the question. Decide early whether the widget
   *computes* the projections at runtime or *replays* precomputed ones from a
   seeded table — the second is legitimate here (the animation would be a reveal
   of already-computed data, invariant 2) and is probably the only way UMAP
   appears at all.

### What widget 18 settled that applies here

- **A reference that moves with the control is not a reference** (2.5). If a
  projection widget shows a quality number, fix what it is measured against.
- **`_lab` mock-ups settle layout decisions in one round; prose does not.**
- **The Browser pane runs no frames when it is not displayed** — drive animations
  by pumping `requestAnimationFrame` by hand, and never trust a screenshot here.
- **Assert every string anchor, and count the thing you think you edited.**
  `check.mjs` now fails a `main.js` that calls `defineWidget` more than once,
  which is one class of that damage caught.

---

## Widget 18 · `balancing-data` — DRAFT, three steps, twelve rounds of review

Live at `/widget/balancing-data/`, `status: "draft"`, so it is off the gallery
and owes no fingerprint states yet.

```
node scripts/serve.mjs 8011        # then /widget/balancing-data/
```

**Read the round headings below before changing anything.** Twelve of them, and
most reversed an earlier decision for a reason that is written down — including
two core capabilities that were added, used for one session, and taken back out
again when the design moved past them.

**The host is `03-4 ML - Data Preprocessing`, section `## Balancing Data`.** The
previous session reported that no PHM5005 notebook mentions SMOTE and that this
widget therefore had no lesson to live in. **That was wrong** — `03-4` cell 67
imports `from imblearn.over_sampling import SMOTE` verbatim, and cells 62–72 are
a complete treatment. Kenneth named the section; it checks out. Full cell table
in [docs/catalogue.md](docs/catalogue.md) under Widget 18.

**`03-4` never fits a model.** Its own figure is two bar charts of class counts.
Every score the widget prints is its own measurement, and the readout says so.

### What it is

**Three steps, revealed downwards by two `gate` buttons**, over a 150 + 150
cohort on `[0, 10]²`, one square panel and a count strip under it.

```
Cases kept   [100%  50%  25%  10%  5%]      <- always there
Seed         [ 1 .. 200 ]
──────────────────────────────────────
[ Fit a model ]            <-> Back to the cohort
──────────────────────────────────────
[ Try a balancing method ] <-> Back to the plain fit
Balancing    [None | Class weights | Oversample | Undersample | SMOTE]
k            [1  3  5]                       <- only under SMOTE
Play speed   [Slow | Steady | Quick]
── Make one sample · Play · Start over
```

- **The dial keeps a PREFIX of the minority list**, so 5% ⊂ 10% ⊂ 25% ⊂ 50%, the
  majority never moves, and dragging it makes patients vanish. The widget opens
  on the whole cohort, so the reader creates the imbalance themselves.
- **The world does not move with the dial.** The held-out set is the cohort's own
  50/50 at every rung, so the ceiling is ONE number and balancing visibly climbs
  back to it. This is a SAMPLING imbalance, not a prevalence one, and the copy
  says "collect" throughout for that reason.
- **Three tiles, all against that one reference**: minority cases caught, false
  alarms, F1. No accuracy tile — on a balanced world it tracks F1 to within a few
  thousandths, and its old job needs an imbalanced test set, which is arc B's
  `imbalance-metrics`.
- **Step is one sample with every beat**; Play runs at the reader's chosen pace.

**ONE UNIT IS ONE SAMPLE — copied, dropped, or made.** That is what makes the
four methods one animation rather than four. Class weights has an EMPTY plan, so
core disables Step and Play, and the disabled buttons are cell 63's "leaves
dataset unchanged" said by the buttons rather than in prose (4.5).

### The numerics are a SECOND MODULE, which no other widget has

`widgets/balancing-data/model.js` holds the stage, the four methods, the weighted
logistic fit and the scoring, and `main.js` imports it. The reason is 5.8: widget
16 kept a solver in `_lab/svm-stage-core.js` AND a second copy in its own
`main.js`, and had to verify both. Here node imports the shipping module directly
(`_scratch/verify18.mjs` → `verify18.json` → `imb6.py`), so what was checked IS
what runs.

**Checked against scikit-learn 1.9.0 and imbalanced-learn 0.14.2, 12 stages ×
8 fits each:**

| | |
|---|---|
| worst coefficient disagreement | **7.1e-07** |
| worst metric disagreement | **0** |
| worst synthetic point off its segment | **0** |
| worst class-weight vs `n/(2·n_c)` | **0** |
| neighbours not among the true k nearest | **0** |
| plans not balancing to exactly 1:1 | **0** |

### What the widget prints, at the default seed

At **5% minority** (190 : 10), recall on 4000 held-out samples:

| method | recall | precision |
|---|---|---|
| none | **8.5%** | 58.6% |
| class weights | 82.5% | 19.2% |
| oversample | 82.5% | 19.5% |
| undersample | 76.0% | 24.4% |
| SMOTE | 81.5% | 21.0% |

At **40% minority** the same five run 72.7% / 80.7 / 82.4 / 81.1 / 80.2 — the gap
to doing nothing collapses from 74 points to 8. **That is cell 72's "when the
minority class is highly underrepresented", and it is why the stage needed a
dial that heart failure at 1:2.11 cannot provide.**

Page three, at 10% and `before` the split: **43 of 160 random copies and 55 of
160 SMOTE samples carry a held-out patient**, and the test half becomes 36 : 36
rather than the population's 36 : 4. Undersampling carries nothing — it only
removes — but its test half becomes 4 : 4, so the distortion moves entirely into
the denominator. **That asymmetry is the third tile and it is worth keeping.**

### Verified

- **135-state canvas text sweep** at `widgets/_lab/balancing-sweep.html`: step ×
  cases kept × method × k × how far the plan has run. Clean, and **that is not
  enough** — see below.
- **240-state MID-FLIGHT drive sweep** at `widgets/_lab/balancing-drive.html`:
  presses a drive button and pumps `requestAnimationFrame` by hand, collecting
  whatever the iframe throws, and sweeping the pace rungs because the quick one
  skips the neighbour fan entirely. Clean, with **168 of 240** buttons
  unavailable — exactly the count the gating predicts.
- **Model checked against scikit-learn 1.9.0 / imbalanced-learn 0.14.2**: worst
  coefficient disagreement **9.7e-07**, every metric including F1 at **0.000**,
  every synthetic point exactly on its segment, zero problems over 15 states.
- **All 123 fingerprint states identical** after each of the two core changes.
- `npm run check` passes, and now also fails a `main.js` that calls
  `defineWidget` more than once.

### Still owed

1. **Nobody has looked at it in a browser.** Screenshots do not work from this
   session — see *THE BROWSER PANE RUNS NO FRAMES* below — so legibility, the
   weight of the band, and whether three lines is one too many are all unjudged.
2. **No fingerprint states.** Baseline only once the design is frozen. It
   declares an `animation`, so `check` will demand at least one **driven** state
   the moment `status` becomes `"shipped"`.
3. **No markdown-cell link in `03-5`** — after cell 65 or cell 71.
4. **Not judged projected** — the standing debt since widget 11.
5. **Not pushed.** Every push to `main` publishes.

#### A SETTLED SWEEP IS NO TEST OF A FRAME, and this widget proved it

Every state in the text sweep is reached through `shown`, with the animation at
rest, so **not one of them runs `drawInFlight`**. A random copy carries a
`parent` and no `neighbour`, and the slow-motion branch read
`state.pts[undefined].x1` and threw on **every frame** — under Oversample only,
on two of the three pages — while **348 settled states passed clean**. It was
found by reading the browser console, not by the harness.

This is 5.6 exactly: the blind spot has to be named. `balancing-drive.html` is
the answer, and it does three things a settled sweep cannot:

- it collects errors **off the iframe's own window**, because an exception thrown
  inside a rAF callback rejects nothing and never reaches the harness frame — a
  sweep that does not listen reports a clean pass over a widget that is throwing
- it lands **inside** a unit (1 frame), mid-slide (8) and well into the plan (40)
- it fails a state that is FROZEN under Play, not just one that throws

Its 36-of-180 disabled-button count is the None and Class-weights states, and
that number is load-bearing: it is the same count as *pages × those two methods ×
shares × Step*, so a Step button that quietly stopped disabling itself would show
up as 0.

### Round two: the ideal line is in, and the middle page is gone

Kenneth asked for a "no imbalance / ideal world" line so the methods can be seen
pushing towards it, picked **T2** of three mock-ups, and said to cut a page.

**The figure now carries three lines** — where the model cut *before* balancing
(grey, dashed), where it cuts *now* (violet), and where it would cut **if the two
classes were equally common** (orange). All four methods make the effective prior
50/50, so that third line is what every one of them is estimating, and the page
stops being *the line moved* and becomes *the gap closed*.

**T2 is the gap drawn as the washed region the two lines label differently**, and
it closes to nothing as the plan runs. Its polygons come from `model.js` beside
the number the readout prints, so the picture and the tile cannot disagree about
what "the gap" is.

**The middle page is gone.** *One sample at a time* was never a different subject
— it was the same plan at a slower pace, and core's own tooltip for Step already
says "advance one step, slowly, showing every stage". So **Step is the slow
motion and Play is the fast one**, `paceOf(anim)` reads `anim.mode`, and the two
buttons carry the difference. Two pages, three controls, and one fewer thing to
learn — which was the ask.

The class-counts readout tile went with it: the strip under the figure already
draws them. The lead tile is now **"Differs from the ideal line"**, at 20.4%
unbalanced against 1.5–5.5% for the four methods.

### Round twelve: why undersampling is not punished here — and where the cost hides

Kenneth: *"undersampling improves it, but in practice throwing away samples makes
everything underfit. How come it isn't detrimental here? Is it because the
dataset is simple?"*

The intuition is right and the widget was hiding the evidence. Three
measurements, 60 seeds each.

#### 1 · The cost IS there. It is in the SPREAD, not the average

| 5% collected | mean F1 | spread |
|---|---|---|
| class weights | 0.814 | **± 0.028** |
| undersample | 0.806 | **± 0.049** |

Nearly **twice the variance for a third of a point of mean**. At 10% collected it
is ±0.016 against ±0.030. Undersampling reaches the same answer far less
reliably, and a table of means cannot say so.

**So the widget now has a `seed` control** — every other widget in the collection
had one and this did not, which is an oversight worth naming rather than quietly
fixing. Across seeds 1–6 at 5% collected: class weights 0.825 / 0.837 / 0.804 /
0.749 / 0.809 / 0.801, undersample 0.808 / 0.798 / 0.838 / 0.766 / 0.822 /
0.752. The instability is now something a reader can press a button and see.

#### 2 · Why the MEAN survives: the minority is the binding constraint

With 8 minority cases you have eight points of information about where that cloud
is — whether you keep 150 majority points or 8. The majority's centre is already
pinned to about σ/√8 by eight points. **Undersampling discards the class you have
plenty of**, and on this stage the boundary's uncertainty was never coming from
that side.

#### 3 · Dimensionality does NOT punish it — it helps, and the reason matters

Adding pure-noise features at 5% collected, so 16 undersampled rows must fit ever
more parameters:

| features | params | none | class weights | **undersample** |
|---|---|---|---|---|
| 2 | 3 | 0.280 | 0.814 | 0.806 |
| 12 | 13 | 0.328 | 0.678 | **0.749** |
| 50 | 51 | 0.231 | 0.415 | **0.720** |

The opposite of the prediction. **It is the L2 penalty.** sklearn's objective is
`0.5·‖b‖² + C·Σ wᵢ·lossᵢ` with C = 1, so the likelihood term grows with the
number of rows: 16 rows means the penalty weighs proportionally more, the noise
coefficients are shrunk hard, and the fit stays near the signal. 158 rows have
enough leverage to chase noise directions that separate eight upweighted minority
points. **That is a fact about the regulariser, not a recommendation for
undersampling.**

#### 4 · A structured majority did not punish it either, and that is instructive

Majority redrawn as three separated clusters of 50. At 8 kept, **11.4% of draws
miss a cluster entirely** — and F1 barely moves (0.921 ± 0.020 against class
weights' 0.922 ± 0.017). Because all three clusters sit on the same side of the
minority and a LINEAR boundary only needs the majority's rough centroid. Losing a
mode does not move a line.

#### So: is it because the dataset is simple?

**Partly, and specifically.** What would make undersampling bite is a model with
capacity to lose — a tree or a forest, where every split needs points in its own
region — or majority structure sitting ON the decision surface, where dropping
95% removes the evidence for where the surface goes. Two Gaussians and a
three-parameter linear model have neither.

**What the widget can honestly claim is what it now shows: undersampling costs
you reliability, not accuracy.** The rest belongs to a widget about model
capacity, and `overfitting-capacity` is already in arc B.

### Round eleven: THE TEST SET WAS MOVING WITH THE DIAL — and that was the bug

Kenneth: *"say the ground truth is 0.852 in a perfect world, but we only collect
25% of disease cases — then if we correct imbalance should we approach the
theoretical 0.852? What would make sense pedagogically?"*

**Under his framing, yes it should — and the widget was making it impossible.**
The dial was doing TWO things at once, and they are different stories:

| | training set | test set | what balancing can do |
|---|---|---|---|
| **A** the disease itself gets rarer | rarer | **also rarer** | recovers the boundary, never the score |
| **B** we only collected some cases | rarer | **unchanged** | recovers both |

The widget did A. Kenneth's sentence is B. Measured, 40 seeds, F1:

```
        ---------- A ----------      ---------- B ----------
kept    ceiling   none  balanced     ceiling   none  balanced
100%     0.836   0.836   0.836        0.836   0.836   0.836
 50%     0.769   0.748   0.769        0.836   0.791   0.835-0.836
 25%     0.665   0.624   0.664        0.836   0.688   0.831-0.834
 10%     0.468   0.392   0.464        0.836   0.442   0.818-0.826
  5%     0.328   0.230   0.328        0.836   0.268   0.802-0.810
```

Under A every method lands **exactly** on a ceiling that slides out from under
it, so a correct figure still reads as "balancing does not work". Under B the
ceiling is **one number at every rung** and balancing visibly climbs back to it.

**It is now B**, and three things fell out:

- **Kenneth's original intuition becomes true.** Accuracy improves with balancing
  (0.749 → 0.832 at 25% collected) instead of getting worse. Nothing on the
  readout moves counterintuitively any more.
- **The residual gap becomes the second lesson.** At 5% collected, balancing
  reaches 0.810 of a possible 0.836 — it recovers almost everything, and what is
  left is the estimation error from eight real cases. **Balancing cannot invent
  cases nobody collected.**
- **The accuracy tile went.** On a world that stays 50/50 it tracks F1 to within
  a few thousandths. Its old job — "99% accuracy by predicting the rare outcome
  away" — needs an IMBALANCED test set to fire, and that is arc B's
  `imbalance-metrics`, not this widget's subject.

Three tiles now, all against one fixed reference:

```
 5% collected  none      caught  256 of 2000   alarms  11   F1 0.226  (0.832 with every case)
 5% collected  weights   caught 1619 of 2000   alarms 308   F1 0.825  (0.832 with every case)
```

#### The distinction that has to stay written down

**This is a SAMPLING imbalance, not a PREVALENCE one.** The copy says "collect"
throughout for that reason. When a class is genuinely rare in the world,
rebalancing to 50/50 throws away a correct prior and the honest fix is a
threshold, not a resample. That is a different widget and it is already planned.

#### And the rule the whole round earned

**A REFERENCE THAT MOVES WITH THE CONTROL IS NOT A REFERENCE.** Principle 2.5
says fix the frame, not the data — and the test population IS the frame for every
number in the readout. Letting it follow the dial was 2.5 broken in the one place
nobody thought to look, because it was in `compute` rather than in a scale. The
figure was right, the numbers were right, every check passed, and the widget
still could not be read.

### Round ten: THE CEILING MOVES WITH PREVALENCE — Kenneth was right, the widget was wrong

Kenneth: *"whole cohort F1 ≈ 0.832; at 50% kept it drops to 0.727, balancing takes
it to ~0.755 but doesn't approach the ground truth. Is this expected, or are we
not calculating the correct cohort?"*

**Neither. The widget was comparing him against a ceiling from a different
population.** Two explanations were possible and they are very different:

- **less information** — half the minority cases are gone and no balancing
  invents them, so the boundary is estimated worse. An honest gap.
- **F1 moved its own goalposts** — F1 depends on prevalence, because precision
  falls as the positive class gets rarer, so the SAME boundary scores lower on a
  rarer test set.

Measured, 40 seeds, scoring the whole-cohort boundary on every test set:

| kept | share | whole cohort on a 50% test | on **this** test | balanced methods |
|---|---|---|---|---|
| 100% | 50.0% | 0.836 | 0.836 | 0.836 |
| 50% | 33.3% | 0.836 | **0.769** | 0.767 – 0.769 |
| 25% | 20.2% | 0.836 | **0.665** | 0.657 – 0.666 |
| 10% | 9.1% | 0.836 | **0.468** | 0.448 – 0.472 |
| 5% | 5.1% | 0.836 | **0.328** | 0.308 – 0.343 |

**It is the second explanation, and completely.** The balanced methods land ON
the reachable ceiling at every rung — 0.769 against 0.769 at 50% kept. There is
essentially no estimation gap. The entire residual was the metric changing its
own scale, and 0.832 is a number from a 50%-prevalence population that does not
exist once the dial has moved.

At the sparse end the balanced fits even come out slightly ABOVE the whole-cohort
line (0.465 against 0.454 at 10% kept), because neither boundary is optimised for
F1 at that prevalence — the whole cohort's is optimal for a 50/50 prior.

**So the F1 tile's note now carries the ceiling for the CURRENT test set**, and a
reader watches it come down as they turn the dial:

```
100% kept  none      F1 0.832   (for the minority class; 0.832 with the whole cohort)
 50% kept  none      F1 0.727   (for the minority class; 0.759 with the whole cohort)
 50% kept  weights   F1 0.755   (for the minority class; 0.759 with the whole cohort)
 10% kept  weights   F1 0.465   (for the minority class; 0.454 with the whole cohort)
```

0.755 against a reachable 0.759 reads as "it got there". 0.755 against a
remembered 0.832 read as "it fell short", and that was the widget's fault.

Both straw-man numbers moved into the accuracy tile, where the contrast is
sharper for being in one place: *"flagging nobody scores 94.9%, and 0.000 on
F1"*.

**This is also Chicco & Jurman's complaint about F1, made visible rather than
asserted.** Their objection is that F1 *"fails to consider the ratio between
positive and negative elements"* — which is exactly why its ceiling slides from
0.836 to 0.328 while the boundary that achieves it barely moves. A reader who
turns the dial sees that happen.

**A COMPARISON IS ONLY HONEST IF BOTH SIDES ARE MEASURED ON THE SAME
POPULATION.** Every other tile already obeyed it — `caught` and `false alarms`
both compare against the whole cohort scored on the current test set. F1 was the
one that did not, and it was the one that misled.

### Round nine: the minority ALREADY was the positive class — now the widget says so

Kenneth: *"can you predict on minority class as this is the usual use case?"*

**It already did, at the code level, and had done since the first build.** Three
places make it so, and none of them were on screen:

- `MINORITY = 1`, and `fitLogistic` regresses on `p.y` — so `y = 1` is the side
  the model's decision value points at
- `score()` counts a minority patient the model flagged as a **true positive**
- recall, precision and F1 therefore all describe **finding the rare outcome**

So the numbers were right and the framing was invisible. A reader who does not
know which class is being detected cannot read a single tile below the figure,
and Kenneth had to ask — which is the report.

**Three places now say it:**

| where | what it says |
|---|---|
| subtitle | *"The job is to find the rare outcome, and a model can score well by predicting it away…"* — the task in the first clause |
| legend | *"Minority class — the one to find"* |
| F1 tile | *"for the minority class"* |

The subtitle is shorter than the one it replaced.

**And `model.js` now carries the reason it is fixed rather than offered**, next to
the constants: F1, precision and recall are not invariant to swapping the classes
— that asymmetry is the whole argument for MCC — so a control letting a reader
relabel which class is "positive" would let them flatter a model without changing
it. A screening test is asked to find disease, not to confirm health.

**Worth keeping as a general lesson: a widget can be correct and unreadable.**
Every number here was right for four rounds of review while the one sentence that
makes them legible was missing. Nothing in the harness could have caught that —
the text sweep reads what is painted, not what is absent.

### Round eight: F1 beside accuracy, and NO class toggle — both decided from evidence

Kenneth: *"maybe we should report F1? or accuracy/precision/recall? also depends
what we are trying to predict… maybe give a toggle to predict on majority or
minority?"*

#### The toggle is a trap, and the literature says why

**F1, precision and recall are NOT invariant to swapping the classes.** Chicco &
Jurman's argument for MCC turns on exactly this: F1 *"fails to consider the ratio
between positive and negative elements"*, where MCC is *"invariant for class
swapping"*. So the reason Kenneth had to ask "what are we trying to predict?" is
that those three metrics have no answer until you say.

A toggle would therefore let a reader **flatter a model by relabelling it**,
which is the opposite of the lesson. The rare outcome is what a clinical model is
asked to find, so it is **fixed**, and the F1 tile states it in four words —
*"for the minority class"*. Stating the positive class costs one phrase; offering
to change it costs the point of the widget.

#### F1 and accuracy, because they disagree

Measured, 40 seeds, at each rung of the dial. F1 improves with balancing at every
setting; accuracy worsens at every setting:

| 5% kept, 4000 held-out, 203 rare | accuracy | F1 | caught |
|---|---|---|---|
| **flagging nobody at all** | **94.9%** | **0.000** | 0 |
| no balancing | **95.0%** | 0.230 | 32 |
| class weights | 82.6% | 0.328 | 163 |
| SMOTE | 84.2% | 0.343 | 158 |
| undersample | 80.1% | 0.308 | 166 |

**That is the pair.** The straw man that flags nobody scores 94.9% on one and
0.000 on the other — which is why `04-4` scores on `f1` and why cell 62 is about
accuracy. Two numbers moving opposite ways, each with the same straw man printed
beside it.

**The four tiles are now:**

| tile | reference in its note |
|---|---|
| Minority cases caught — `22 of 203` | `170 of 203 with the whole cohort` |
| False alarms — `19` | `692 with the whole cohort` |
| F1 — `0.180` | `for the minority class; flagging nobody scores 0.000` |
| Accuracy — `95.0%` | `flagging nobody scores 94.9%` |

Two counts against the best case, two metrics against the worst one. The
"Judged differently" tile went; the band on the figure already shows that gap and
shows it shrinking, which is what it was for.

**F1 and not MCC**, though the 2024 comparisons prefer MCC for imbalanced health
data. MCC is what the course does not type, and a correlation coefficient is a
second lesson. Recorded as a decision.

**And metric selection is not this widget's subject.** Arc B's `imbalance-metrics`
is already planned for exactly that — *"99% accuracy on a 1% prevalence outcome"*.
Widget 18 shows what balancing does to the DATA; it carries only the two numbers
it needs to stop misleading.

`score()` now returns `f1`, and `imb6.py` checks it against
`sklearn.metrics.f1_score`: worst metric disagreement **0.000e+00**.

### A FIFTH TOOLING FAULT: an anchor that matched the WRONG occurrence

A scripted edit spliced on `if (at === 2 && params.method !== "none") {` — a
string that appears **twice**, once in `drawFigure` and once in the readout.
`str.index` took the first, and `s[:i] + new + s[j:]` duplicated ~350 lines,
leaving `defineWidget` called **twice** in one file.

**The file parsed. `npm run check` was green.** Two valid halves make a valid
whole, and nothing counted anything.

`check.mjs` now asserts **exactly one `defineWidget({` per main.js**. Matched on
`defineWidget({` rather than on a line-anchored `defineWidget(`, because
`probability-mechanisms` assigns the result — the first version of the check
failed on a correct file, which is at least the honest direction to fail in.

Five faults now, and four of them silent. The rule earned by all of them:
**assert the anchor, and count the thing you think you edited.**

### Round seven: THE METRICS WERE THE PROBLEM, and accuracy is the answer

Kenneth: *"do the metrics mean… i'm confused, the accuracy should be better with
balancing?"* It should not, and the readout never showed the number that says so.

Measured at 5% kept — 8 cases — over 40 seeds, on 4,000 held-out patients of whom
203 are the rare class:

| | accuracy | caught | missed | false alarms |
|---|---|---|---|---|
| **calling everyone majority** | **94.9%** | 0 | 203 | 0 |
| no balancing | **95.0%** | 32 | 171 | 31 |
| class weights | **82.6%** | 163 | 40 | 656 |
| SMOTE | 84.2% | 158 | 45 | 586 |
| undersample | 80.1% | 166 | 37 | 757 |

**Balancing makes accuracy WORSE — 95.0% down to 82.6% — and that is cell 62's
entire point.** The unbalanced model is a rounding error away from a model that
flags nobody at all, and it catches 32 of 203. The old readout printed recall and
precision as bare percentages that moved in opposite directions and explained
neither.

**The tiles are now counts, and accuracy is named as the trap:**

| tile | at 5% kept, no balancing | with class weights |
|---|---|---|
| Minority cases caught | **22 of 203** | 165 of 203 |
| False alarms | 19 | 616 |
| Accuracy | **95.0%** — *calling everyone majority scores 94.9%* | 83.7% |
| Judged differently | 20.5% | 2.0% |

That third note is the whole lesson in eight words, and it is computed live
(`1 − rare / test.length`), not written down.

**Counts, not percentages, for the first two.** "22 of 203" is a sentence about
patients; "10.8% recall" is a sentence about a formula. 2.3, applied to a number
that is not small but is still countable.

### Round seven, part two: Play's speed is the reader's

The automatic speed-up went. It choreographed the first six samples and then
raced, which showed the mechanism to someone who pressed Play without stepping —
but the figure changed its own speed halfway through for reasons nothing on
screen explained. **A `pace` rung says the same thing and says who decided it**
(4.1), and it appears only at the balancing step.

| rung | ms per sample | shows |
|---|---|---|
| Slow | 700 | every beat of every sample |
| Steady | 260 | still shows where each sample comes from |
| Quick | 60 | arrivals only — for filling the plane |

**Step ignores the dial and is always slow with every beat.** That is what Step
IS, and core's own tooltip already promises "slowly, showing every stage".

Verified by counting the neighbour fan's own dash pattern, `[3, 3]`, per frame at
64 ms a frame:

```
Slow Play      ###########.##########.##########.######   11 frames = 704 ms
Steady Play    ####.####.####.####.####.####.####.####.    4 frames = 256 ms
Quick Play     ........................................    no fan at all
Quick + Step   ########################.                  24 frames = 1536 ms
```

`pace` is a DISPLAY parameter, so changing speed never discards the samples the
reader has already made, and it takes effect at the next sample because
`advance` fixes a unit's duration when the unit starts.

### Round seven, part three: the rule is on screen where it applies

Cell 64's *"apply balancing only to the training set"* was cut with the split
step and is back as copy rather than as a page. The balance gate reads **"four
corrections, every one of them on the training data only"**, and the panel's own
caption at that step is **"the training data — held-out patients are never
balanced"**. Literally true of the figure: every method acts on `pts`, and every
number underneath comes from `test`, which nothing touches.

**IT WAS A `note` FIRST AND THE SWEEP FAILED 105 STATES.** `note()` and the line
key BOTH right-align on the caption's baseline and neither knows the other
exists, so they overlapped by up to **64 px** — and a note strokes
surface-coloured before it fills, so the collision ERASES what it overruns and
still looks like a short caption. Folding the rule into the caption leaves
exactly one right-aligned thing on that line, so the class of collision is gone
rather than tuned. **Two right-aligned things on one baseline is a bug waiting
for a long string**, and this widget is the second to find it.

### Round six: THREE steps, revealed downwards — and core shrank to 13 lines

Kenneth again: *"still confusing, perhaps can also simplify"* — reveal the steps
**vertically with dividers so it looks cumulative**, cut the number of steps, and
find words that tell Reset, Play and Restart apart.

#### The gates were already the answer

Core's `gate` type is, verbatim from its own comment, *"a full-width button
inside the control flow, not in the drive row… it sits exactly where the stage it
opens begins, with the controls it reveals directly beneath it"*, with a divider
above and a `labelOff` for closing again. That is precisely the vertical
cumulative reveal, and it has been in core since widget 12.

**So the rail is now two gates and the controls beneath them:**

```
Cases kept   [100%  50%  25%  10%  5%]      <- always there
──────────────────────────────────────
[ Fit a model ]            <-> Back to the cohort
──────────────────────────────────────
[ Try a balancing method ] <-> Back to the plain fit
Balancing    [None | Class weights | Oversample | Undersample | SMOTE]
k            [1  3  5]                       <- only under SMOTE
── Make one sample · Play · Start over
```

#### And it made two of the three core additions unnecessary

`when: { param, atLeast: n }` existed so a numbered step could reveal controls
cumulatively. **A gate is a bool, so `when: { param }` — the truthy form core has
always had — already says it.** `keepOnReset` existed so Reset would not collapse
the narrative; once the narrative is gates, the honest thing is for Reset to
close them, which is what it does by default.

**Both were reverted.** Core carried a comparison nothing compared for exactly
one session. What is left is **13 lines of actual code**:

| | |
|---|---|
| `anim.inert` | the widget says there is nothing to drive; core removes Step and Play. Seven lines |
| `.w-drive-group[hidden]` | `display: inline-flex` outranks the UA sheet's `[hidden]` — one line |
| `resetLabel` / `resetTitle` | four lines, default unchanged, so no existing widget moves |

#### Three actions, three words

The usability literature on reset controls is blunt: **a bare "Reset" is vague
and gets pressed by mistake**; the label should name what it clears. This widget
now has three ways to go back or forward, and each says which:

| word | what it does |
|---|---|
| **Play** / **Make one sample** | run the balancing |
| **Back to the cohort** / **Back to the plain fit** | the gate, closing |
| **Start over** | Reset — closes every gate, returns to the whole cohort |

`resetLabel` is what let the third one be named. Nothing else in the collection
changes: the default is still "Reset".

#### The dial runs 100% → 5%, and starts at 100%

`KEEPS = [1, 0.5, 0.25, 0.1, 0.05]` of a 150-case minority pool — **150, 75, 38,
15, 8 cases** against a fixed 150 majority, so the outcome goes from half the
cohort to one patient in twenty. Expressed as *how many you keep* and not as a
minority share, because that is what the reader is doing: throwing cases away.

**So the widget opens on a balanced cohort and the reader creates the imbalance.**
The whole-cohort line and the current line start on top of each other and
separate as the dial comes down, which is the entire argument in one gesture.

#### What was cut

**The train/test split step is gone**, and with it cell 64's *"apply balancing
only to the training set"*. It was a page, then a step, and it did not survive
the reduction to three. The leakage it warns about is arc B's `data-leakage`
anyway. Recorded in the widget header so it reads as a decision rather than an
omission — and it is one gate away if Kenneth wants it back.

#### Verified

- **All 123 fingerprint states identical** after the core revert-and-add.
- **Model matches scikit-learn** on the new dial: worst coefficient disagreement
  **9.7e-07**, zero problems, 15 states.
- **135-state text sweep** PASS; **120-state drive sweep** PASS with **84 of 120**
  buttons unavailable — exactly 5 methods × 2 keeps × 2 keys × 3 frames at the
  fit step, plus None and Class weights at the balance step.

At 10% kept (15 cases): gap to the whole cohort **19.7%** unbalanced against
**4.5%** under SMOTE.

### Round five: BUILT as a five-step narrative — and core cost 38 lines, not a rewrite

Kenneth pushed back on the round-four framing: *"do we need such a radical
change? you mean we cannot make conditional buttons?"* He was right to. One of
the three changes disappeared entirely, and the other two came to **38 lines of
code across three core files**, verified by **one** fingerprint run: *all 123
states identical*.

#### What core gained, and why each one

| | |
|---|---|
| `when: { param, atLeast: n }` in `controls.js` | a control appears at its step and **stays**. `equals` alone makes a control belong to exactly one step and vanish after it, so every comparison would cost a trip backwards |
| `keepOnReset: true` on a field | Reset skips it. Exactly one kind of parameter should carry it: the one saying **which part of the widget you are looking at** |
| `anim.inert` in `widget.js` | the widget says there is nothing to drive and core **removes** Step and Play. `stepLabel: null` cannot do this — it is read once when the shell is built, and whether there is anything to drive changes with a parameter |
| `.w-drive-group[hidden]` in `tokens.css` | `display: inline-flex` outranks the UA sheet's `[hidden]`, the same collision the drive row itself hit. Without it, hiding the two buttons leaves an empty bordered box |

**`atLeast` was the one I nearly built and did not need — until it turned out to
be one line.** Kenneth's own suggestion (navigate with the tabs) would have made
`equals` sufficient. It is in because keeping every unlocked control is both
PhET's model and far less clicking, and because one line inside an existing
`fingerprint` run is not a cost worth arguing about.

#### The five steps

```
1 Cohort    both classes, fully sampled            no controls
2 Rare      the imbalance dial                     -> share
3 Sample    the cases that survived                no new control
4 Split     fit on everything, or on four fifths   -> train
5 Balance   the four methods                       -> method, k
```

Steps 1 and 3 unlock nothing **on purpose** — they are the two beats where the
reader is meant to look rather than fiddle.

**Rarity is a REMOVAL.** The dial keeps a prefix of the cohort's minority list,
so 5% ⊂ 10% ⊂ 20% ⊂ 40% and the majority never moves. Dragging it makes patients
vanish, and step 2 draws the ones it took as dashed outlines. A fixed total could
never show that.

**The reference line is the whole cohort's own fit** — Kenneth: *"ground truth
can make it simpler."* It replaced a line fitted to 20,000 invisible points,
which was defensible (it is what every method estimates) but invited exactly the
question it got. Now it comes from the picture in step 1 and the honest answer is
short: it is the line you get when you have every case.

#### Verified

- **All 123 fingerprint states identical** after the core change.
- **Model still matches scikit-learn on the new cohort stage**: worst coefficient
  disagreement **9.7e-07**, zero problems — the verifier now builds the cohort
  the same way the widget does.
- The narrative gates, driven end to end: controls appear one per step, `k` only
  under SMOTE, Step and Play **hidden** under None and Class weights and at every
  step below balancing, and Reset leaves the step alone
  (`?step=4&share=3&method=smote&k=0` → `?step=4`).

At 10% minority, step 5: gap to the whole cohort **19.8%** unbalanced against
4.5% class weights, 5.0% SMOTE, 6.2% oversample, **8.0% undersample** — the
ordering held through the rebuild, and undersampling is still furthest out.

#### Play shows its working

The first six samples under Play are choreographed at 580 ms, then it fills in at
70 ms. Verified by counting the neighbour fan's own dash pattern, `[3, 3]`, which
nothing else in the widget uses:

```
PLAY  #########.#########.#########.#########.#########.#########.  then plain
STEP  ########################.
```

#### The one blemish left

**A stale `k` slider can strand itself.** `k` is gated on `method === "smote"`,
not on the step, because only SMOTE has neighbours. So a reader who picks SMOTE
at step 5 and then clicks back to step 2 sees a lone `k` slider with no method
control above it. It cannot be gated on both — `when` takes one parameter — and
the alternatives are worse: gating on the step alone shows `k` under four methods
that have no neighbours. Left as is, deliberately, and only reachable by
navigating backwards after choosing SMOTE.

#### A FOURTH HARNESS FAULT: a `.replace()` with no assertion

The drive sweep was edited to count a hidden button as unavailable. The edit
**silently did nothing** — the anchor text had already been rewritten by an
earlier pass, and `str.replace()` returns the string unchanged when it finds no
match. The harness then reported **84 of 240 buttons unavailable** where the
design predicts 168, and every Play button that core had removed from the row
counted as live.

It was caught by checking the number against the design rather than reading PASS:
84 is exactly half of 168, which is what "one of the two keys is never counted"
looks like. With the assertion in place it reports **168 of 240** — 120 states
below the balancing step plus 48 under None and Class weights.

**Every string edit to a harness or a widget now asserts its anchor.** Four
faults in this widget's tooling and three of them were silent: a settled sweep
that never ran a frame, a regex that stopped matching when a readout changed, a
pixel hash that could not tell two identical repaints apart, and now a
find-and-replace that found nothing. **A harness reports what it measures, and
what it does not measure it reports as a pass.**

### Round four: the narrative, mocked up first (superseded by round five)

Kenneth asked for three things: show the whole dataset and the ground truth
before simulating the imbalance; gate the controls so the sequence tells a story;
and keep the k-neighbour animation during Play. **The third is built. The first
two are mocked up at `widgets/_lab/balance-narrative.html` and await a decision.**

#### The stage has to change shape, and the measurement says it can

Today `makeStage(rng, share)` draws nMaj majority and nMin minority with the
total fixed at 200, so **moving the dial redraws the scene** and a reader cannot
see what rarity cost them. The narrative needs the opposite: a whole cohort with
both classes fully sampled, and a dial that **removes** minority cases from it.

| | |
|---|---|
| cohort | **150 majority + 150 minority = 300 patients** |
| 40% minority | keep 100 of 150 — 250 patients, 1:1.5 |
| 20% | keep 38 — 188 patients, 1:3.9 |
| 10% | keep 17 — 167 patients, 1:8.8 |
| 5% | keep **8** — 158 patients, 1:18.8 |

Shares nest, so 5% ⊂ 10% ⊂ 20% ⊂ 40% and the majority never moves: the dots only
ever disappear. **k has to drop to {1, 3, 5}** — 8 minority cases at 5% leaves
k ≤ 7, and a control whose options quietly stop working at one end of another is
3.4d's defect.

The claim survives, and sharpens — 40 seeds, held out at the same prevalence:

| minority | recall, none | recall, the four | gap, none | gap, the four |
|---|---|---|---|---|
| 40% (100 cases) | 78.0% | 84.3–84.5% | 5.3% | 2.2–2.5% |
| 20% (38) | 55.6% | 83.5–84.6% | 15.3% | 3.1–4.4% |
| 10% (17) | 33.0% | 81.7–83.6% | 18.9% | 4.4–6.4% |
| 5% (8) | **15.8%** | 78.0–81.6% | 19.3% | 7.0–9.3% |

Undersampling is still furthest from the target at every share (2.5 / 4.4 / 6.4 /
9.3) **while having the HIGHEST recall at 5%** (81.6%) — it overshoots. Worth
keeping: it is the one place the two readings disagree about which method wins.

#### The evidence behind the sequence

- **Guide by what exists, not by instructions.** PhET's *implicit scaffolding* —
  guidance living in affordances and constraints so students are "guided without
  feeling guided". An argument for revealing controls rather than printing a
  numbered list, and the reason the mock-up's rail has no "now do this" text.
- **Each stage relaxes a constraint.** PhET's own account of successive tabs:
  they "add complexity… and sometimes relax constraints present in earlier tabs,
  e.g. by allowing control over more variables simultaneously".
- **The contrast has to come first.** Schwartz & Bransford's *A Time For Telling*
  and Schwartz & Martin's statistics work: explicit instruction lands far better
  when learners have first compared contrasting cases. Watching 142 of 150 cases
  disappear is that contrast; being told the class is rare is not.

#### What it costs to build, and it is not free

Two changes to `widgets/core/`, and **each one means a full 123-state fingerprint
run** before it can be trusted:

1. **`when: { param, atLeast: n }`.** Core's `visibleFor` has `{ param }` and
   `{ param, equals }` only, so a control can be shown on exactly one stage but
   not "from stage 3 onwards". Every control in a narrative has to persist once
   revealed, or the reader cannot go back and change the imbalance while looking
   at SMOTE.
2. **A way for the widget to say there is nothing to drive.** Core hides the
   drive row only behind a `gate`, and takes the FIRST gate-typed parameter — so
   a five-stage narrative cannot use gates to hide it. `anim.inert` would let the
   widget say it, and it also kills the standing "Replay does nothing under None
   and Class weights" wart in the same stroke.

**And one thing that needs a decision, not code: Reset.** Core's Reset returns
EVERY control to its default, which in a gated narrative means collapsing back to
stage 1 and discarding the reader's whole progression. That is either the right
behaviour ("start the story over") or the demolition 3.2 warns about, and it is
Kenneth's call which.

#### Built and verified: Play now shows its working

`03-4` cell 65's mechanism was invisible to anyone who pressed Play instead of
Step — 70 ms a sample. **The first six samples under Play are now choreographed
too** at 580 ms, then it fills in at 70 ms: about 3.5 s of construction rather
than the 45 s that showing all of them would cost.

Keyed off `anim.k`, so a reader who already stepped through six by hand gets no
repeat — they have seen it.

**A UNIT'S PACE IS FIXED WHEN THE UNIT STARTS**, stored on `anim` as `ms` and
`full`, and `draw` reads what `advance` wrote rather than recomputing it from the
mode. Widget 17 lost a whole panel to the other arrangement: a step left in
flight when a non-choreographing speed took over froze it, because the two ends
disagreed about how long the unit was.

Verified by counting the neighbour fan's own dash pattern — `[3, 3]`, which
nothing else in the widget uses — frame by frame:

```
PLAY  #########.#########.#########.#########.#########.#########.  then plain
STEP  ########################.
```

Nine frames of fan then one to land, six times over, at 64 ms a frame — 580 ms a
sample, exactly as declared. Step is 24 frames, 1536 ms, one sample.

### Round three: the third line is NOT ground truth, and the copy says so

Kenneth asked *"is the ideal line the ground truth from the data?"* — and the
honest answer is **no**, which the name "ideal" was quietly implying. Measured
against the true optimal rule for these two clouds, over 200,000 patients at
equal prevalence:

| | |
|---|---|
| the line and the true rule disagree about | **3.19%** of patients |
| error rate, the line | **16.42%** |
| error rate, the true rule | **16.09%** |
| so the straight line costs | **0.33 points** over the best possible |
| patients BOTH get wrong — the clouds genuinely overlap | **14.66%** |

The true rule is a gentle curve, not a line, because the two clouds have
different spreads — majority sd (1.7, 1.9) against minority (1.3, 1.6). It bows
outward with height: at x₂ = 5 it sits **14 px** from the line on the 560 px
panel, and at x₂ = 1 and 9 it is **22 and 28 px** the other way.

**So the third line is the best STRAIGHT cut when the classes are equally
common** — which is exactly what all four methods are estimating, and which is
what makes it the right target for this figure. It is not the data's truth.

**It is now labelled `equal classes` rather than `ideal`**, and the readout tile
reads *Gap to equal classes*. "Ideal" is a verdict, and it was read as one — 2.9
in one word.

**The true curve is NOT drawn.** It would be a fourth line sitting within 3% of
the third, on a figure whose complaint was already complexity, and it would
answer a question this page is not asking. The numbers above are here so that
decision can be revisited rather than re-measured.

### Round three, part two: no source references in on-screen copy

Kenneth: *"remove any editorial comments like this is from notebook etc, but you
can explain the buttons."* Every string that reaches the screen now names a
mechanism and nothing else.

| was | is |
|---|---|
| `RandomOverSampler — minority samples copied at random` | `minority samples copied at random until the counts are even` |
| `RandomUnderSampler — majority samples dropped at random` | `majority samples dropped at random until the counts are even` |
| `class_weight='balanced' — no sample added or removed` | `nothing added or dropped — minority samples just count more` |
| `5 — the default in imbalanced-learn, and the notebook's` | `5 — the usual choice, between close in and far out` |
| `the training half only — what 03-4 says to do` | `hold out 20% first, then balance only the 80% left behind` |
| `everything, and then split what came out` | `balance all 200 first, then hold out 20% of whatever came out` |

**The library names moved into the source comments**, one line above each method,
where a developer needs them and a student does not. Leading with
`RandomOverSampler` put a word the reader cannot act on in front of the words
that say what happens.

**The file header keeps its cell-by-cell provenance** — that is a source comment,
which CLAUDE.md exempts, and it is the only record of which cell each page answers.

All seven `detail` lines are now **56–61 characters**, so the rail cannot jog by a
line when the reader drags across the ladder (3.4d).

### THREE HARNESS FAULTS, and every one of them made a test quietly stop testing

Worth reading before trusting any before/after comparison in this repo.

**1. A settled sweep is no test of a frame.** Every state in
`balancing-sweep.js` is reached through `shown`, animation at rest, so **not one
of them runs `drawInFlight`**. A random copy carries a `parent` and no
`neighbour`; the slow-motion branch read `state.pts[undefined].x1` and threw on
**every frame**, under Oversample only — while **348 settled states passed
clean**. Found by reading the browser console, not by the harness.
`widgets/_lab/balancing-drive.html` now presses a drive button and pumps
`requestAnimationFrame` by hand. It collects errors **off the iframe's own
window**, because an exception inside a rAF callback rejects nothing and never
reaches the harness frame.

**2. A progress check written against a readout string dies when the readout
changes.** The freeze test looked for an "N of M" and called a state frozen when
N stayed 0. Then the counts tile was replaced — and no tile on the Balancing page
printed that shape any more, so the regex matched nothing, every state counted as
progress, and the check stopped checking with no error and no failure.

**3. A PIXEL HASH IS NOT AN EQUALITY TEST HERE, and two attempts at one both
passed for the wrong reason before the check was rewritten.** Measured:

- **The load paint is not the same picture as any repaint.** At an identical
  state, load-paint against the first repaint differs by **clt 41,734 of
  1,471,968 bytes · bootstrap 39,244 of 1,846,800 · galton-board 17,498 of
  1,778,400 · balancing-data 201,825 of 2,172,384** — and every repaint after
  that is **byte-identical**, 0 and 0 on all four. This is a property of the
  collection, not of one widget.
- **The first `getImageData` after a paint can differ from every read after it.**
  711051006 once, then 1780657374 twice, on a canvas nothing touched in between.
- **A sparse hash misses a small mark.** At stride 397 it read about one pixel in
  a hundred and missed a single highlight ring, calling a drawing state frozen.

Even warmed and read twice, the comparison stayed unreliable enough to report
**zero** freezes in a run where freezes were known to exist. **The strings do not
have this problem** — they are byte-identical across repaints — so the check now
collects one string-set per pumped frame through `fillText` and compares the
first frame with the last. Nothing forces an extra repaint: each pumped callback
already paints once. An earlier version sampled the strings by nudging the
`share` control, which RESETS the animation, so it compared a freshly reset
figure with itself.

**AND THE CHECK WAS PROVED TO FAIL.** `anim.t += dt` was changed to `anim.t += 0`
and the suite re-run: **12 states flagged**, which is exactly the 2 pages x 3
methods-with-a-plan x 2 shares where progress is guaranteed. Reverted after. A
green harness that has never been shown to go red is not evidence.

This is also why the fingerprint suite is stable: it renders each state in a
FRESH iframe and hashes once, so it only ever compares load-paints with
load-paints. Any harness that repaints in place has to warm first.

### CLOSED: `Play` used to read "Replay" and stay enabled under None and Class
weights

Solved in round six by `anim.inert`, which is the one core capability from this
widget that survived. The record of the problem, kept because it is why the
capability exists:

**It read "Replay" and stayed enabled under None and Class weights.** Both
have an empty plan, so `init` sets `done: true` — which correctly disables Step
and gives it the label *"Nothing to change"*, and that disabled button is the
lesson. But core turns a finished `run` button into an enabled "Replay", and
replaying nothing repaints the same picture. The three widget-side alternatives
are all worse (leaving `done: false` enables a Step that does nothing; a `gate`
means something else; `runLabel` takes a plain string only and cannot vary by
method), so the real fix is in core — and a core change means a full 123-state
fingerprint run. **Kenneth's call whether it is worth one.**

### Decided while building, so it is not re-argued

- **The stage is generated, and the measurement that forced it is in the
  catalogue.** On heart failure SMOTE runs in 11 columns and a two-column picture
  puts its neighbours at median rank 16 of 95, with 39 of 96 patients sharing
  none at all. The picture would draw a line to a point that visibly is not near.
- **One minority cloud, not two.** The obvious "two minority clusters with
  majority in the gap, so interpolation lands in majority territory" story was
  measured and **does not fire** — 4.2% against the single cloud's 8.6%. A shape
  control would have been built for a story the data does not support.
- **`k` tops out at 9 and `share` bottoms out at 5%**, because SMOTE needs k + 1
  minority points and 3% leaves six. A control whose options quietly stop working
  at one end of another control is the defect 3.4d records.
- **The fade on page three means "held out" on BOTH settings**, and the
  difference is whether a construction line touches a faded dot. Fading only
  under `after` would have said the test half does not exist yet under `before`,
  which is backwards: it exists, and balancing is reading it.

### THE BROWSER PANE RUNS NO FRAMES WHEN IT IS NOT DISPLAYED

Not throttled — **zero**. `requestAnimationFrame` never fires, so an animation
driven by clicking Step or Play advances by nothing at all, the canvas keeps its
first paint, and the readout keeps its first numbers. Screenshots fail loudly
(*"the Browser pane is not displayed, so the page is not compositing frames"*)
and this fails **silently**, which is worse: it reads exactly like an `advance`
that never increments, and half an hour went into looking for that bug.

The way through is the one the fingerprint harness already uses — **replace
`requestAnimationFrame` with a queue and pump it by hand**:

```js
const q = []; win.requestAnimationFrame = (cb) => q.push(cb);
doc.querySelector('.w-drive .w-btn[data-key="step"]').click();
let t = 0; for (let i = 0; i < frames; i++) { const cb = q.shift(); if (!cb) break; cb(t += 64); }
```

64 ms because that is core's `MAX_FRAME_MS` clamp. Driven this way, widget 18's
Step landed one sample in 3 frames on the fast page and 30 on the slow one, and
Play ran to 30 in 60 — which is the contract, checked rather than assumed.

**And a second one, from the same session: `navigate` drops the query string.**
`mcp__Claude_Browser__navigate` to `…/widget/x/?a=1&b=2` lands on the right page
with `location.search === ""`, so every parameter silently falls back to its
default. A widget tested that way is being tested at its defaults no matter what
URL was asked for — and for widget 18 that meant `method=none`, whose plan is
empty and whose Step button is *correctly* disabled. Set `location.href` from
`javascript_tool`, or load through an iframe `src`, both of which keep it.

### Three bugs this build hit, all of which read as something else

- **`fits[0]` is not the unbalanced fit under class weights** — it is the
  weighted one, so the dashed reference line quietly became a second copy of the
  live line and the readout's "72.7% unbalanced" printed the weighted number
  against itself. There is now an explicit `baseFit`, always unweighted.
- **A random copy never reaches `S.made`.** `shownState` files it under `copies`,
  because it lands exactly on its parent — so the leak counter, which walked
  `made`, reported oversampling as leaking NOTHING on the page whose whole
  subject is the leak. It walks the plan prefix now.
- **The fit set and the plan indices were in different frames.** On page three
  `after`, the plan is built over the training half and then lifted to full-stage
  indices for drawing; the fit needs them back in source indices. Two maps, one
  each way — an `indexOf` per step would have been O(n²) over a 180-entry plan.

---

## Widget 17 · `trees-and-ensembles` — DRAFT, three pages, not yet baselined

Live at `/widget/trees-and-ensembles/`, `status: "draft"`, so it is off the
gallery and owes no fingerprint states yet.

**What it is.** Three pages behind a `page` segmented parameter — *One tree*,
*A bag of trees*, *Boosting* — over a 12/24/40-point two-feature stage on
`[0, 11]²`. Verified against scikit-learn 1.9.0 at every step.

- **One tree** animates the SEARCH: a candidate line glides across the node
  while the score curve traces behind it and a running minimum descends, then
  the winner commits. The tree matches the lecture slide's shape and sklearn's
  fit exactly: `x1≤5.5, x2≤5.5, x1≤9.0`, 4 leaves, depth 3, 0 training errors.
- **A bag of trees** resamples with replacement, pools the votes, and shows
  every tree in the bag as silhouettes on a shelf.
- **Boosting** is GRADIENT boosting, because that is what `04-3` cell 36 fits
  (`HistGradientBoostingClassifier`, `learning_rate=0.1`). It was built as
  AdaBoost first and Kenneth caught it against his own slide.

**What is left before it can ship:**

1. **Kenneth has not reviewed the finished boosting page.** He flagged that 20
   rounds may be too many, since nothing visible changes after round 6.
2. **No fingerprint states.** Baseline only once the design is frozen. It
   declares an `animation`, so `check` will demand at least one **driven** state
   the moment `status` becomes `"shipped"`.
3. **No catalogue entry.** Arc A row 4 says "one widget for tree → forest →
   boosting" and still needs its spec row.
4. **No markdown-cell link in `04-3`.**
5. **Not judged projected** — the standing debt since widget 11.

### The measurements it is built on, so none is taken twice

| claim | number |
|---|---|
| bagging: resamples choosing a different first split | **79.2%** of 2000; 166 distinct structures, most common 6.5% |
| bagging: pooled vote vs the single tree | **3.7%** of the plane at n=12, **0.00%** at n=24 |
| bagging: accuracy, 300 seeds × 20000 test points | 0.8852 → **0.9082** (+2.30pp); the gain SHRINKS with n (+1.13 at 24, +0.71 at 40) |
| boosting: depth 3 on 12 points | 8 leaves, fits in one shot, **0.00% repaint from round 2** — which is why depth is 2 |
| boosting: does it win? | **No.** gb(20) is −0.66pp vs one tree and **−3.31pp vs the bag** at n=12, ahead in 4% of seeds |
| boosting: the learning rate reshapes the descent | by round 20 the loss reaches 0.1246 / 0.0118 / 0.0000 at rates 0.1 / 0.3 / 1.0 |

**The two ensemble pages contrast cleanly, and that is the payload:** more trees
never hurt a bag; more rounds *do* hurt a boost.

### Design decisions already settled from `_lab` comparison pages

- **`_lab/tree-forest.html`** — F1/F2/F3, how to draw a forest. Unresolved, and
  it was for the *rings* stage; widget 17 went a different way.
- **`_lab/bag-trees.html`** — M1/M2/M3, showing the collection. **M3 won**: a
  shelf under all three panels, 46px per tree against 38 and 26.
- **`_lab/boost-loss.html`** — L1/L2/L3 and three leaf labellings. **L2 won**
  (loss curve full width above the shelf, +114px of height) and **step labels
  won** over `n = k`, which is identical at every round because the counts are a
  property of the split.

### Traps this widget hit, all still live for the next one

- **`_lab` is for comparison pages, not for building the app.** Building it there
  meant hand-rolling the rail, drive row, theme control and controls, and every
  one drifted from core. The worst: DOM tabs meant the current page never
  reached the URL, which defeats Copy link — the mechanism the repo exists for.
- **`runLabel` takes a plain string only**; only `stepLabel` takes the
  `{ param, labels, default }` map. The map form renders `[object Object]`.
- **A "rest" phase is core's job, not the widget's.** `advance` returning `false`
  stops and leaves `anim` in place. The contract is `anim.mode`: return false on
  unit completion under Step, true under Play.
- **`const`/`let` read by `draw()` must be declared ABOVE the `defineWidget`
  call.** It paints during its own call, so anything below is in a temporal dead
  zone and the first frame throws.
- **Core's Reset returns EVERY control to its default**, not just the animation.
  A sweep that clicks Reset between states silently tests only the default one.
  This produced a "0 problems" result that was worthless.
- **Measuring inside a `hidden` container returns 0**, and arithmetic on it fails
  quietly rather than throwing — it sized a canvas at 954px in a 1206px slot, and
  400px in another.
- **`display: flex` on a class outranks `[hidden] { display: none }`.** A hidden
  drive row stayed on screen while reporting `hidden === true`. Core guards this
  at `tokens.css .w-split .w-drive[hidden]`.
- **A threshold is a midpoint of values rounded to 0.1, and 118 such pairs print
  in full** — `(0.1+0.2)/2` is `0.15000000000000002`. Round labels for display;
  never round the model.
- **Per-cell `fillRect` rasters freeze the renderer.** 110×110 rects per frame
  did it. Cache an `ImageData` and blit once.
- **The Chrome extension runs JS in an isolated world**, so patching
  `CanvasRenderingContext2D.prototype.fillText` there never sees the page's
  drawing and returns `total: 0` — which reads exactly like a clean pass. Use
  **Brave for screenshots, the in-app Browser pane for instrumentation.**

---
## Widget 16 · `support-vector-machine` — SHIPPED

**Baselined and promoted.** Six states: four settled, and two driven with
`drive: { set: { lift: "kernel" }, frames: 4, dt: 32 }` — the ease is reached
through the `Looking at` control, since the widget declines Step and Play. Each
was hashed three times and was identical every time.

**It has never been judged projected.** Neither has any widget from 11 onward.

`widgets/_lab/fingerprint-new.html` is what recorded them, and it is reusable:
edit its `STATES` list for the next widget. It exists because the suite and the
baseline are two different jobs — the suite proves the widgets you are NOT
looking at still render identically, and welding the two together means
re-verifying 117 known-good states twice in order to learn six numbers.

### What it is, and what was decided

Three generated data sets, all three of `04-3`'s kernels, C on a ladder with γ or
d beside it, and two display toggles — `Looking at` (Input space / Kernel space)
and the support-vector rings. **150 of 150 states match `sklearn.svm.SVC`
exactly** on support-vector count and error count.

    http://localhost:8010/widgets/support-vector-machine/

| what it shows | url |
|---|---|
| the default — blobs, a line is enough | `?theme=light` |
| **a line cannot carve out a ring** — 171 of 180 are support vectors, 74 wrong | `?theme=light&data=rings&kernel=linear` |
| **the same data, RBF** — a closed circle, 31 support vectors, none wrong | `?theme=light&data=rings&kernel=rbf` |
| **THE LIFT** — press *Kernel space* and watch it flatten | `?theme=light&data=rings&kernel=rbf` |
| the polynomial, one cubic between the crescents | `?theme=light&data=moons&kernel=poly` |
| γ too high — the boundary wraps single samples | `?theme=light&data=moons&kernel=rbf&gamma=5` |

Open, and worth a look:

- **The lifted view's vertical axis is compressed beyond one margin**, because
  median max|f| is 1.90 and the worst state is 42. Only 0 and ±1 are labelled,
  so it never claims a reading it is not giving — but it is a broken axis.
- **No seed control.** The data is fixed at seed 1. Exposing one would let a
  reader redraw the samples and watch which points become support vectors — one
  line of spec, but a fourth control on a widget asked to be simpler.
- **`--c-boundary` still wants a name.** The boundary is on `--c-highlight`
  violet because `--c-theory` orange is eleven degrees of hue from
  `--c-event`'s red. Five of the six PHM5005 algorithm widgets draw a decision
  boundary, so the role would be earning its slot rather than serving one widget.
- **An earlier two-panel lift is superseded** and left at
  `widgets/_lab/svm-kernel.html`: φ(z) = (z₁², z₂²) beside the measurements. It
  reads well but can only draw that one map — not RBF, not the crescents.

---

## `px` TRACKS THE DEVICE PIXEL RATIO — the baseline is now Windows

**The move to Windows turned all 123 states red on `px` and not one on `tx`.**
The cause is not the rasteriser, which is what this section used to guess. It is
`devicePixelRatio`, and the arithmetic is exact:

| | macOS | this machine |
|---|---|---|
| `.w-figure` | 550.4 CSS px | 550.4 CSS px |
| `devicePixelRatio` | 2 | **1.25** (Windows at 125% scaling) |
| canvas backing store | 1100 | **688** |

The geometry is identical — same breakpoint, same rail beside the same figure.
But `px` hashes `toDataURL()`, which encodes the **backing store**, so a display
scaling change rewrites every hash while leaving the picture the same size on
screen.

**Measured over the full suite, not sampled:** 123 of 123 `px` moved, **0 of 123
`tx` moved** — including all 41 driven mid-animation states. `tx` is therefore
the cross-machine invariant, demonstrated at full scale rather than hoped for.
The re-baseline diff is exactly 123 `px` lines and nothing else, which is itself
the evidence that only pixels moved.

**Windows hashes are stable.** Eight states hashed three times each came back
identical, including `odds-and-risk` — the widget whose ten `view=calculate`
states were the flaky ones on the Mac. That flakiness has not reappeared here.

### What this means for the next move

**The baseline is now specific to DPR 1.25.** Changing Windows display scaling
is enough to turn the whole suite red again, and it will look exactly like a
catastrophic regression. **Check `devicePixelRatio` before believing anything**:

```js
// in the harness page, or any widget's console
devicePixelRatio                                   // expect 1.25
document.querySelector(".w-figure canvas").width   // expect 688 at FRAME_W 900
```

The standing rule still holds for the **undiagnosed** case: do not re-baseline
to make the suite green, because that buries the reason. What made re-baselining
right this time is that the cause was identified first and `tx` proved the
figures had not changed — the baseline was re-recorded *knowing* what moved, not
to silence it.

The options for making `px` durable are unchanged, and now better informed: pin
the browser *and* the scale factor, hash something less brittle than the PNG
bytes, or accept that `px` is a same-machine check and lean on `tx`. Note that
normalising the canvas back to a fixed size before hashing would survive a
scaling change but **not** a platform change — Windows DirectWrite and macOS
CoreText rasterise text differently, so it solves the smaller half.

---

## Working on Windows

**The toolchain runs there now; it did not before.** `npm run check` — and with
it `npm run build` — failed on the first line of the first assertion on any
Windows machine, because five dynamic imports were written
`import(join(root, "…"))` and `join()` gives `C:\…` there, which Node's ESM
loader refuses outright: `ERR_UNSUPPORTED_ESM_URL_SCHEME, Received protocol
'c:'`. They go through `pathToFileURL` now. `serve.mjs` and `build.mjs` were
already fine — both use `resolve`/`sep`, and build's lab-directory filter already
matched on `[/\\]`.

`.gitattributes` now pins the working tree to LF. Git for Windows defaults to
`core.autocrlf=true`, so without it the first commit from a Windows machine
rewrites every line ending in the repository into one unreadable diff.

**`npm run build` retries the `_site` delete**, because this repo lives inside
Dropbox and Windows will not remove a directory anything holds a handle on.
Dropbox indexes `_site/` the moment a build populates it, so a second build died
on `EBUSY` before writing anything — roughly two runs in three. It is a race, not
a stuck lock: the failing path moved *deeper* each run, the scanner walking
behind the delete. Measured worst case 6 attempts, ~300ms.

**The dev server runs on :8010 here, not :8000.** A Docker container in WSL
(`mcq-app-web-1`, from the `app-mcq` project) publishes `127.0.0.1:8000`, and
WSL2's localhost forwarding mirrors it onto the Windows side through
`wslrelay.exe`. The failure is confusing rather than obvious: the port is split
by address family — `wslrelay` holds **IPv4** `127.0.0.1:8000` while a dev
server started on 8000 gets **IPv6** `::`. `curl` prefers IPv6 and reports a
happy `200`; the browser prefers IPv4 and gets the container's `400`. So the
server looks fine from the shell and broken in the tab.

`.claude/launch.json` pins **8010** so the preview tool is deterministic rather
than picking a random free port — and it now *passes* that port. It previously
declared `"port": 8010` while its `runtimeArgs` were just `["scripts/serve.mjs"]`,
so the server fell through to its own default of **8000** — the one port the pin
exists to avoid — while the preview pane was pointed at 8010. It also carried
`autoPort: true`, which contradicts the determinism it was added for; both are
fixed.

**Use `node scripts/serve.mjs 8010`, not `PORT=8010 npm run dev`.** The shell on
this machine is PowerShell, which has no inline env-var prefix: `PORT=8010 npm
run dev` dies with `CommandNotFoundException: The term 'PORT=8010' is not
recognized`. It worked on macOS and it works in the Git Bash tool, which is why
it survived the move into CLAUDE.md, README and this file. An argv port works in
every shell, and `serve.mjs` has always honoured one.

CLAUDE.md and README each carry a note pointing here rather than a hardcoded
`:8010`. That is deliberate: the clash is **machine-local**, so swapping one
hardcoded port for another would be stale again on the next machine, and the
README's seven example URLs are the documented deployed paths.

**Both of the macOS-shaped gaps are now closed.**

- **The PHM5005 notebooks are back**, all 34, in `~/Downloads/PHM5005 AY2025-26 -
  Notebooks/Master/` — on this machine, `C:\Users\Admin\Downloads\…`. Plus
  `Supporting Materials/Heart Failure.ipynb`. **They are output-stripped**; see
  *Reading the PHM5005 notebooks* below, which is the caveat that matters.
  PHM5003 is fine: `../jupyterbook/phm5003` is present.
- **There is a working Python again.** `python` from the Bash tool hits the
  Microsoft Store stub and dies with an install advert; **`py` is the launcher
  that works**, and it is Python 3.14. sklearn 1.9.0 / pandas 3.0.5 / numpy
  2.5.2 install cleanly:

  ```powershell
  py -m venv .venv
  .venv\Scripts\python.exe -m pip install scikit-learn pandas
  ```

  **Build the venv outside the repo.** `.venv/` is gitignored, but this repo is
  inside Dropbox and a venv is thousands of small files for the indexer to fight
  with — the same class of problem as the `_site` delete.

  **The venv had vanished by the next session and had to be rebuilt.** It is
  at `…/PHM5005 AY2025-26 - Notebooks/_scratch/venv`, and the measurement
  scripts sit beside it: `tree43.py` / `tree43b.py` behind widget 17's tree
  numbers, and `imb1.py`–`imb6.py` plus `verify18.mjs` behind widget 18's.
  `verify18.mjs` is the interesting one — node imports the SHIPPING module
  `widgets/balancing-data/model.js` and dumps its numbers for `imb6.py` to
  check against scikit-learn, so what was verified is what runs. Its imports are
  absolute `file:///D:/…` URLs because a relative path cannot cross from C: to
  D: on Windows. They are **deliberately not in this repo** — prd §6 records why
  a Python helper was deleted from it.

  ```powershell
  cd "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch"
  py -m venv venv
  ./venv/Scripts/python.exe -m pip install scikit-learn pandas imbalanced-learn
  ```

  Note `imbalanced-learn` is now in that list: `03-4` needs it, and the earlier
  claim that it was unavailable is no longer a constraint.

**Git had no identity here** and refused the first commit. Set repo-local to
`Kenneth Ban <kennethban@gmail.com>`, matching every existing commit; a
`--global` one would save doing it again in the next repo.

Everything else is Node ≥ 20 and a browser. Nothing in `package.json` shells out.

---

## THEN: widget 15 needs the marginal-vs-conditional note, then a projected review


**The widget is built and the design has held for two rounds.** What is open is
one thing Kenneth found and one thing nobody has done.

### 1. The green dots and the curve answer different questions, and nothing says so

Reported as: *"when I move BMI/Age, sometimes they move outside the range of the
green dots — what does it mean?"*

It means the figure is correct and silent. The **dots are marginal**: the
observed proportion among everyone in that bin, at whatever BMI they actually
had — average 25.4. The **curve is conditional**: the model at the one held value
the slider is set to. Drag BMI to 45 and you are asking about a subgroup almost
nobody in the bins belongs to, so of course the curve leaves them. They coincide
only near the middle of the data, BMI ≈ 25.4 or age ≈ 49.

That is the most useful thing the two sliders demonstrate and it currently reads
as a defect. It is a caption or a readout line, not a rebuild — **and it will
move the `px` of all four states**, so rebaseline in the same commit.

### 2. Judge it projected

Widgets 11, 12, 13, 14 and now 15 have never been seen from the back of a room.
Widget 15's binomial intervals are 1px hairlines and its strip bars are ~3px
wide at the narrow frame, so it has more to lose from distance than most.

### Do NOT re-argue these

Every one was measured or chosen from a mock-up, and all of it is in
`docs/catalogue.md` under *Widget 15* with the numbers:

- **The model is 05-05's own**, `TenYearCHD ~ BMI + age`, coefficients to the
  digit. A second data set (`prevalentHyp ~ sysBP`) was built, made step 1
  unmissable, and was cut for matching the lesson. Its numbers are kept.
- **Three panels, and they are the two bounds coming off one at a time** — not
  three arbitrary views. That is the answer to *why log it*.
- **No training, no convergence.** Widget 8 owns iterative fitting.
- **No stages, no sweep, no animation.** Both were built at Kenneth's request
  and both were removed at his request; the figure's subject is a mapping, and
  varying two sliders is the exploration.
- **The straight line is `--c-reference` grey**, not `--c-extreme`: extreme and
  event are the same `--series-8`, so a red line and a red dot would be one
  colour with two meanings.


## Then: two things the promotion did not do

**1. Neither shipped widget has been judged projected.** Widgets 11, 12, 13 and
14 have never been seen from the back of a room, and two of them now carry no
draft bar. It is the cheapest review left and the only one a shipped widget is
missing.

**2. The matrix's geometry is still uncovered, and no fingerprint state can see
it.**
`px` hashes the canvas; `tx` reads `.w-math`, `.w-legend` and `.w-readout`, and
the rail is excluded on purpose. On the canvas the grid was at least inside `px`,
and `check.mjs` forced a `hit` state to cover the cell-to-value mapping. Both are
gone. Two ways to close it, and the choice is open:

- **`?pair=Weight~Hip` as a settled state.** Free — the widget has no animation,
  so a URL settles it — and it proves the parameter reaches the figure. It does
  not prove the CELL sets it.
- **Teach the harness's `set` verb to drive a `matrix`.** `set` finds a control by
  `data-param` and writes `.value`, which a grid has none of; clicking
  `[data-value="…"]` inside it instead would be a few lines and would cover the
  cell-to-value mapping the way `hit` covered the canvas. This is the honest
  replacement for what was lost.

The four settled states widget 14 now carries prove the parameter reaches the
figure — including `?pair=Age~Weight`, the near-circular end at r = 0.013. None of
them proves that the CELL sets it.

---

### CLOSED: predicted on which axis — the widget is already right

Kenneth's instinct was that predicted belongs on y. **It does not — leave the
widget alone.** This was researched rather than argued from convention, and the
answer is one-sided.

**scikit-learn, which is what the course teaches and what `04-3` uses.**
`PredictionErrorDisplay` with `kind="actual_vs_predicted"`, in
`sklearn/metrics/_plot/regression.py`:

    x_data, y_data = self.y_pred, self.y_true
    xlabel, ylabel = "Predicted values", "Actual values"

The name reads *Y vs X*, not left-to-right. Its sibling `residual_vs_predicted`
shares that x-axis, so the two panels sklearn draws side by side line up —
flipping ours breaks the correspondence with the notebook's own figure.

**Everywhere else the course touches.** caret's `plotObsVsPred` is `obs ~ pred`
with `xlab = "Predicted"` — Kuhn's own package. Harrell's `val.prob` is
`xlab = "Predicted Probability"`. Clinical calibration plots are universally
predicted-risk on x against observed proportion on y, which is the figure these
students will meet again and again. R's `plot(lm)` has no observed-vs-fitted
panel at all, but every panel it does have puts fitted on x.

**And there is a real argument, not just a head-count.** Residual = observed −
predicted. With predicted on x, the signed vertical gap from a point down to the
`y = x` line **is** the residual: above the line means the model under-predicted.
Flip the axes and the vertical gap becomes *predicted − observed*, so every
statement about over- and under-prediction inverts relative to what "residual"
means everywhere else in the course. The residual plot is this plot with the
`y = x` line straightened to horizontal, and that only reads if both share
predicted on x.

Second: for a calibrated model `E[observed | predicted] = predicted`, so a
smoother through the cloud should sit on `y = x`. The reverse conditional is not
— shrinkage makes the cloud flatter than 45°, which is regression to the mean
rather than a model defect. Piñeiro et al., *Ecological Modelling* 216(3), 2008,
1000+ citations, concludes observed-on-y against predicted-on-x for exactly this
reason: r² is the same either way, but slope and intercept are not.

**The dissent is real but thin**: tidymodels puts predicted on y — the same
author as caret, disagreeing with himself — and no source found offers a
*statistical* argument for it. It is habit: predicted is what the procedure
produced, so it feels like output.

If it still looks wrong on screen, the fix is the axis labels or a caption, not
the orientation.

---

## What the core contract gained

**Widget 15 added three CSS roles and nothing else** — `.w-link-eq`,
`.w-link-row` and `.w-links`, for the card above its figure. No new parameter
type, no new `widget.js` hook. The full suite was run once afterwards and all 113
pre-existing states matched, which is the only thing that run was for.

The eight below are widget 14's, each its own commit, each verified with a full
105-state run.

| what | where | why |
|---|---|---|
| `type: "readback"` | `params.js`, `controls.js`, `tokens.css` | a case table in the rail naming which of a few labelled outcomes the controls above it produce. A non-parameter spec entry, exactly like `section`: carries no value, never reaches the URL |
| **`type: "matrix"`** | `params.js`, `controls.js`, `tokens.css` | a labelled grid of shaded cells, one option per cell, for a parameter that is a **pair**. Declares `rows`, `cols` and a `token`; each option carries `row`, `col` and `shade`. Arrow keys move the selection from one focus stop, which is what lets it replace a 156-option dropdown rather than sit beside one |
| **a height may be a function of the WIDTH** | `canvas.js`, `widget.js` | `resize(heightOf)` resolves it, because the width is knowable before anything is painted and the height is not. For a panel that has to stay **square** — widget 14's plane is only allowed to be square, so wider costs taller |
| `regions` | `widget.js`, `canvas.js` | clickable targets on the canvas, resolved to a parameter. **Declared by no widget now** — kept for SVM's support vectors and the tree widget's nodes, which are figure-native |
| `pointAt` / `hitTest` | `canvas.js` | pointer event → drawing coordinates; the region under a point |
| the exported `setParam` syncs | `widget.js` | it is the door that is NOT a control, so it must tell the rail |
| a checkbox's `detail` renders | `controls.js` | 3.4f, third time |
| `<optgroup>` runs in a `select` | `controls.js` | the 156-option keyboard path, before the matrix replaced it |

Four of these have a subtlety worth not rediscovering:

**A `matrix` cell's shade is an opacity on a CHILD element.** Fading the cell
fades the selected cell's ring with it — brightest exactly where it is least
needed.

**A `matrix` arrow step that lands on a non-option keeps going; one that runs off
the edge does not wrap.** So the ends of the grid are findable by feel, and the
diagonal — a measurement against itself is not a pair — is skipped rather than
stopping you.


**`readback` takes a `live` FUNCTION where `when` must stay declarative.** `when`
is declarative so core can avoid rebuilding the control block on every change —
rebuilding mid-drag drops the slider you are holding. A readback rebuilds
nothing; it swaps two class names. So a predicate is safe there and only there.

**`regions` allows exactly ONE parameter per region, checked at load.** Two would
paint an intermediate state nobody asked for, write the URL twice, and — the
reason that matters — make the click a *different transaction* from the one a
fingerprint state performs, so the harness would be verifying a sequence the
reader never takes. A pair of variables is one parameter, not two.

---

## Widget 14 · `linear-regularization` — SHIPPED AS A DRAFT

Hosts at PHM5005 `04-3 Tour of Algorithms`, section 1. Its four-row table —
linear / ridge / lasso / elastic net against α₁ and α₂ — is read as four
algorithms. They are four settings of one objective, which the notebook prints
two lines above that table.

Two dials on a shared ladder, a readback in the rail naming which of the four you
are in, a labelled 13×13 correlation matrix in the rail as the pair selector, the
fitted equation as MathML in a card above the figure, thirteen coefficient bars
across the full width, a conditional-slice coefficient plane, and a
predicted-against-measured panel. **Canvas height is a function of the width**
(`ROW_TOP + panelSide(w) + ROW_BOTTOM` — 423px at the narrow frame, 541 at the
wide) because the two panels have to stay square. No animation, no seed, no
`shown`.

What remains is the fingerprint question at the top of this file, then the
shipping steps under *Then*.

### The design decisions, so they are not re-argued

- **Layout D2**, chosen from a four-way mock-up: equation on top, bars full
  width, then the plane and the predictions as two squares of equal standing.
  **The squares fill the row** (P3 of four in `_lab/linreg-panel-width.html`) and
  the canvas is however tall that makes it — they are square because the
  diamond has to look like a diamond, so wider costs taller. The 228px cap they
  used to carry left 206px of the row empty at the wide frame.
- **The matrix is in the RAIL, as core's `matrix` control**, chosen as C4a from
  two rounds of `_lab/linreg-matrix-rail.html`. It replaces a 156-option
  dropdown rather than sitting beside one: the dropdown's 66px of rail is the
  difference between a grid smaller than the canvas's and one half again bigger.
  **Both axes named in full**, the columns turned ninety degrees — at 45° the
  names cleared each other by 2.3px against an 11px type size, at 90° by 7.8px.

  It was on the CANVAS first, placement M1 of four, unlabelled because thirteen
  row names plus thirteen rotated column names cost more room than a 150px grid.
  What moved it was a measurement nobody had taken: the rail is 444px against a
  654px stage, so it had 210px of slack, and it is 300px wide against the 150px
  the canvas could spare. Cells went 11.5px → 17.8px *with* the names, and the
  bars got 174px of width back.
- **All 156 ordered pairs, not 78.** `(i, j)` and `(j, i)` are the same two
  measurements with the axes swapped, and which is horizontal is a real
  difference on screen. The four-pair slider it replaced reached elongations
  1.09–4.77:1; the matrix reaches 1.01:1 (Age against Weight, r = 0.013 —
  contours so nearly circular that the diamond and the circle become the same
  shape, which is the case where the L1/L2 distinction stops mattering) and
  5.73:1 (Weight against Hip). Neither end was reachable before.
- **The readback sits in the rail, not on the figure.** It reports the two dials
  directly above it, and 2.7 puts a reading next to what produced it. On the
  canvas it also painted over the Forearm and Wrist bars and only looked clear
  because those two coefficients happen to be small.
- **The plane is a CONDITIONAL SLICE** of the full thirteen-feature fit: the
  other eleven held where they were fitted, the pair free. An earlier build
  fitted a separate two-feature model and the panels then disagreed about
  Abdomen — 8.80 against 10.27 — because those are different models, not
  different views. The slice is exact, not approximate: a coordinate-descent
  fixed point IS the statement that the solution is already optimal in any subset
  of coordinates given the rest. Profiling the other eleven out instead is
  wrong — at a lasso solution their gradients are not zero, they equal the
  subgradient, so a profiled contour is tangent to nothing.

---

## Measurements worth not repeating

All were made to settle a design question, and several killed an idea.

**The body fat data leaks its target.** `04-3` fits on
`drop(columns=["BodyFat"])`, which keeps `Density`, and BodyFat is derived from
Density by Siri's equation: `495/D − 450` reproduces the target to within 0.1
percentage points for **243 of 252 men**. The printed R² table (0.992 down to
0.767) is therefore not comparing algorithms, it is measuring how hard each one
shrinks a leaked feature. **Kenneth agreed to drop the column; not yet done.**

**The penalty is a function of how much data you have.** Median test R² over 25
splits, lasso, without Density:

| n_train | α=0 | α=0.1 | α=0.3 | α=1 | best |
|---|---|---|---|---|---|
| 18 | **−0.761** | 0.435 | 0.568 | 0.585 | α=1 |
| 40 | 0.548 | 0.635 | 0.654 | 0.636 | α=0.3 |
| 202 | 0.698 | 0.690 | 0.675 | 0.633 | **α=0** |

**The grouping effect is real, not a solver artefact.** Raising α₂ at fixed α₁
puts coefficients *back* — 9 of 13 up to all 13. 300 sweeps agrees with 20,000 to
machine zero. The smallest marginal covariance is Height at −0.75 against an L1
threshold of 0.1, so once L2 separates the correlated measurements each clears it
alone.

**Four of the 637 reachable coefficient slots print as `0.00` under `toFixed(2)`
while being non-zero** — at α₁ = α₂ = 0.01 the equation read `− 0.00 z(Knee)`.
A term that is in the model now carries enough digits to show it.

**kNN's scaling story is dead.** Standardised against as-measured is within one
or two patients at every *k*, even though ejection fraction outweighs
log-creatinine **52:1** in range — because ejection fraction is recorded in
coarse steps, so creatinine survives as a tie-breaker. Do not build a kNN widget
around "forgetting to scale". What *does* fire: at k = 9, adding features
strongest-first takes deaths caught from 8 of 19 to **1 of 19**.

**MathML, checked rather than assumed.** Baseline since January 2023, floor
Chrome/Edge 109. A single `<math>` does **not** line-break — MathML Core treats
`white-space` as `nowrap` on every MathML element and no engine implements
automatic linebreaking — so thirteen terms in one `<math>` measure past 1000px
and overflow. One inline `<math>` per term wraps normally, because each is an
atomic inline box in an ordinary inline formatting context.

---

## Traps that cost time

Each of these produced a wrong answer that looked right.

**From widget 15's session:**

- **A display parameter marked as data silently discards the reader's work.**
  All three of widget 15's controls were data parameters, so every slider move
  reset the animation: press two buttons, move a slider, and both curves vanish
  and the drive row goes back to the start. It survived a 308-state text sweep,
  because every string on the canvas was legal — they were just the strings for
  the state it had been reset to. **The check that finds it is a canvas hash
  across a parameter change with the drive-button states read beside it**, and
  nothing else will.
- **A hand-typed data table looks exactly like a correct one.** Widget 15's age
  aggregate was typed into a heredoc rather than pasted from the generator and
  drifted from age 53 up — seventeen wrong rows, a total of 3653/558 against the
  true 3658/557. Generate the string, splice it in programmatically, and assert
  the totals in the same script.
- **The console panel caps at 50 and does not clear on navigate.** Fifty
  identical errors persisted across reloads after the bug producing them was
  fixed, which reads exactly like a fix that did not work. Install your own
  `window.onerror` counter and drive the failing case; that is the honest read.
- **`advance` returning "there is more to show" is what a RUN means, not a
  step.** Core re-queues on a true return, so widget 15's first step button
  walked the entire axis on one press and then greyed itself out. A step
  advances one unit and returns `false`.
- **Two similar tokens are one colour at a 1.5px stroke.** `--c-extreme`
  (`#e34948`) and `--c-theory` (`#eb6834`) are eleven degrees of hue apart, and
  the legend was still declaring the old token after the canvas had moved to a
  new one — so it was not merely hard to read, it was naming a colour the figure
  no longer used. Read the swatches' computed colours, not the source.

**From earlier sessions:**

- **The fingerprint table renders a state string as HTML, so `&params=` shows as
  `¶ms=`.** `&para` is a legacy named entity that browsers resolve without a
  semicolon, and the harness sets that cell with `innerHTML`. It is display only —
  the widget receives `params=12`, verified by opening the URL and reading the
  control — but it reads exactly like a state that lost a parameter, and it will
  do the same to `&amp…`, `&lt…`, `&not…`. Check the widget, not the table.
- **A `requestAnimationFrame` measurement reported the PREVIOUS frame.** The panel
  mock-up measured its heights in a rAF after rendering, and after a width change
  it printed the old stage height beside the new rail height — the two columns
  disagreeing about which frame they were in, which is worse than no number.
  Reading a bounding rect forces layout, so **measure synchronously at the end of
  the render**; the rAF buys nothing and costs correctness.
- **A batch of scripted edits is all-or-nothing, and a failed assert is silent.**
  Two edits in this session did not land — a stale `76.3px` and a blurb — because
  a *later* replacement in the same script threw, so the file was never written
  and the earlier ones went with it. It looks exactly like success: no error in
  the file, no diff. Either write after each replacement or grep for the new text
  afterwards.
- **A screenshot of a long page comes back black once it is scrolled.** The
  browser pane paints the top of the document; `scrollIntoView` then screenshot
  gives a black frame with no error. Hide the cards above the one you want and
  screenshot at the top instead.
- **A measurement comparing unlike things.** The MathML capability probe compared
  an `<mfrac>` against a `<span>` *wrapping* a `<math>`, whose height carries the
  surrounding line-height — 19px against the fraction's 16.5px. It reported a
  browser that lays maths out perfectly as one that does not, which would have
  forced the fallback on every reader for ever. Both sides must be `<math>`.
- **A ceiling that hid a term.** `-webkit-line-clamp: 3` on the equation looked
  right until below the 880px breakpoint, where thirteen terms need four lines
  and the clamp dropped one — silently, no scrollbar, no ellipsis.
- **Mounting at module scope.** `buildShell` creates `.w-figure` inside
  `defineWidget`, so a widget's module scope runs before it exists. Querying it
  there returns null and the reader gets a **blank page**, not a missing element.
  Mount from inside `draw()`, scoped to the widget's own host.
- **A frame conditioned on live state.** The coefficient plane's frame was built
  from the slice conditioned on the *current* eleven coefficients, which shrink —
  so the whole panel drifted under the reader as they dragged.
- **A sweep that measured two paints as one.** Setting two parameters fires two
  repaints, and a text sweep that clears its buffer before both records two
  different figures at the same coordinates — reported as 318 collisions that did
  not exist. Clear after the last set, then force one clean repaint.
- **`document.fonts.check` returns true for everything.** It is not an
  availability test. Measure glyph widths against a generic fallback instead.

---

## Deferred, ready to pick up individually

**Button labels.** A five-widget sweep was reverted (`a23be6b`) as too much to
review at once. The observations still hold; each is a one-file change:

- `maximum-likelihood`'s step button reads "Step" — core's generic fallback, and
  the only step button in fourteen widgets that names no act.
- `bootstrap` and `permutation-test` grey out Step and Play until their lead has
  run, and neither says why. The other lead-gated widgets have a `leadHint`.
- `bayesian`'s `leadHint` says "Step and Play" while the button reads "Add a
  count" or "Propose a move".
- `em-mixture`'s lead reads "Start", the only lead label naming no act.

**Judge projected.** Widgets 11, 12, 13, 14 and 15 have never been seen from the
back of a room. Widget 11's hypergeometric dots are ~4px at the narrow layout;
widget 15's binomial intervals are 1px hairlines and its strip bars ~3px wide.

**Give `fingerprint.html` an `?only=<slug>` filter.** It always runs every state,
which is what forces the loop in *NEVER BASELINE BY PLACEHOLDER-AND-DIFF* above.
A filter would make "record the new widget's states" a first-class thing the
harness does rather than something worked around.

**`widgets/_lab/index.html` has stopped being an index.** Sixteen of the
twenty-nine lab pages are missing from it, including every mock-up made for
widgets 13, 14 and 15 and all three drive-row pages. Adding one alone makes
the list *more* misleading, not less, so this is one change: catch the index up in
a single pass, or delete it. To list them:

```bash
for f in widgets/_lab/*.html; do b=$(basename "$f"); case $b in index.html|fingerprint.html) continue;; esac; grep -q "$b" widgets/_lab/index.html || echo "$b"; done
```

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`**, by hand:

- **Cell 40** states the odds-ratio interpretation wrongly. On `a=24, b=60,
  c=16, d=100` the odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is
  not an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** should say **case-control**, not "retrospective" — a
  retrospective *cohort* is fine for a risk ratio, and in a case-control the
  exposure is precisely what you go and ascertain. What is unknown is the
  population at risk.

**`04-3` needs `Density` dropped**, per the measurement above.

---

## Reading the PHM5005 notebooks

Two routes, both verified:

- **Local copies on this machine**, all 34, in `~/Downloads/PHM5005 AY2025-26 -
  Notebooks/Master/`.
- **Shared Drive folder**, readable without auth:
  <https://drive.google.com/drive/folders/1QcSRjgcasZRpFyw1lOHSowjjDgcXp0_c>
  Its top level is the 34 lesson notebooks; `Supporting Materials/` holds the
  data-prep notebooks, `Heart Failure.ipynb` among them.

**THE DRIVE COPIES CARRY NO CELL OUTPUTS.** Measured across all 34: every one
parses, and **not one holds a single output**. The Drive folder is the clean
student copy. The `For Review/` set that had the printed numbers was local to the
Mac and has no equivalent online.

**The printed numbers were the valuable half, and that half must now be re-run
rather than read.** That is exactly how `04-3`'s table in *NEXT* turned out to be
part artifact. **Treat any number in this file quoted from a printed output, and
not since re-measured, as one draw from a possibly unseeded model.**

**Match by filename, never by link.** The same notebook has appeared under three
Drive IDs across two sessions.

There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are named by
notebook filename.

---

## How Kenneth works — read before writing anything he will see

- **One change at a time.** A commit touching five widgets is not reviewable and
  gets reverted whole, including the parts that were right. If a fix reveals the
  same fault elsewhere, **say where and stop**; offer the rest as a list.
- **He picks from mock-ups rather than reviewing prose.** Four rounds this
  session were settled that way — the ridge/lasso geometry, the layout, the
  equation typesetting, the matrix placement. A `_lab/` page with the candidates
  drawn at the real width and their trade-offs measured underneath gets a
  one-line answer; an argument in prose gets a longer conversation.
- **Replacement wording must be shorter than what it replaced**, or it is not an
  improvement. Said twice.
- **On-screen copy names the quantity** — principle 2.9. No metaphors, no
  personifying the method, no verdicts where a mechanism belongs. Source comments
  are exempt and should stay vivid.
- **Explanations are one claim per line, not paragraphs.**
- **Hand over the exact localhost URL after every edit.**
- **He may be away from the desktop.** `_lab/` is local-only by design and is not
  published; to show him something remotely, publish it as an Artifact with
  `tokens.css` inlined rather than changing what deploys.

---

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots here have produced several phantom bugs:
the automation browser generates stray pointer input that moves sliders
mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per 300 ms.

### Driving the animation in node, with no browser at all

**This is the way past "the browser pane runs no frames".** A widget's `main.js`
imports exactly one thing, so stubbing that import captures the whole config
object — and `compute`, `animation.init/advance`, `readout`, `summary` and
`drag.value` are then all callable from node, with no DOM and no clock.

```js
src = src.replace(/^import \{ defineWidget \} from "\.\.\/core\/index\.js";$/m,
  'const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);');
src += "\nexport { __cfg };\n";
```

Then supply an rng with `.next()`, call `compute`, and pump `advance` with a
fixed `dt` until `anim.done`. **What it catches that nothing else here does:**
that the animation reaches its last frame at all, that every stage is passed in
order, that `shown=N` lands where it claims, and — cheapest of the lot — that no
`readout` tile or `summary` string anywhere along the rail contains a `NaN` or
an `undefined`. Twenty-three such assertions over widget 19 ran in under a
second and needed no server.

It does NOT see the drawing: `draw` wants a real `CanvasRenderingContext2D`. Use
it for the contract and the numbers, the text sweep below for the strings, and
the fingerprint for the pixels.

**AND LIST THE CAPABILITIES BY NAME, or the driver will not notice a deletion.**
This is the sharper half and it was learned twice in one session. A wholesale
rewrite deleted the entire `drag` block during a comment cleanup; the `turn` and
`tilt` parameters survived, the camera still read them, nothing wrote to them,
and the cloud was frozen — while **every existing assertion still passed**,
because all of them tested behaviour that was still there. The same rewrite
habit had already deleted `slerp` and then called it.

So a second driver asserts what the widget must HAVE rather than what it does:

```js
for (const key of ["slug","title","status","layout","height","params",
                   "compute","draw","readout","summary","animation","drag"])
  ck(`declares \`${key}\``, W[key] != null);
const WANT = { groups:"choice", samples:"choice", seed:"int",
               pca:"gate", projected:"gate", turn:"int", tilt:"int" };
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
   Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
```

A driver that only exercises what exists cannot notice what stopped existing.
**Edit these files; do not regenerate them.**

### The canvas text sweep

Wrap `fillText`, measure each string, compare its right edge to the canvas width.
It catches a `NaN` at one end of a slider, a caption overrunning its line, a
printed claim that is false.

```js
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

- **`y === 0` is a rotated label** — its coordinates are in the rotated frame.
- **Clear the buffer after the LAST parameter set, then force one repaint.** Two
  sets are two paints, and recording both reports collisions that do not exist.
- **Dedupe before any collision check.**
- **It cannot see DOM.** Widget 14's equation is MathML and does not go through
  `fillText` at all — the sweep stopped seeing it with no error and no gap in its
  output. That is what the text hash below exists to cover.
- **A HARNESS TIMING NUMBER CAN BE 300x WRONG.** The sweep reported a worst
  repaint of **22 seconds**, captioned "each state is a COLD page, so the worst
  is a first paint". That state warm is 54-138 ms and its compute path in node
  is 70 — it was the browser pane being throttled, and the same 201-state sweep
  took **84 s, 165 s and 465 s on three identical runs**. Time a WARM repaint or
  do not report one, and never caption a number you have not checked against a
  second measurement.
- **A HARNESS PAGE MUST REPORT ITS OWN PROGRESS.** `svm-sweep.html` printed
  "running…" and never changed, because the sweep was driven from the console
  and its result read out of a variable — so a finished run and a hung one
  looked identical to anyone opening the page, and one was taken for the other.
  It now shows a bar, the state it is on, and a PASS/FAIL summary. Any lab page
  that takes minutes needs the same.
- **A STATE THAT PAINTED NOTHING IS A FAILURE, NOT A PASS.** A widget that
  throws inside `render()` leaves its canvas at the default **150x75** and its
  readout empty — and a sweep that only counts overruns then reports a clean run
  over an EMPTY LIST. That is exactly how a temporal-dead-zone bug in widget
  16's solver, throwing on every single state, read as "the harness settled too
  early" for a whole round. Assert the canvas has a real width and the readout
  has text before believing a zero.
- **FORCE THE REPAINT BY DRIVING A CONTROL, never by resizing.** Widget 16's
  sweep reported a clean pass twice from an EMPTY list. Dispatching `resize` on
  the iframe's window does nothing, because core listens to a ResizeObserver on
  `.w-figure`. Changing the iframe's width for real does not work either: the
  document reflows — `.w-figure` measured 550 → 666 → 550 — and the canvas stays
  at 1100 backing pixels, because **a ResizeObserver callback is delivered as
  part of the rendering lifecycle and this browser suspends that for an
  offscreen iframe**. Nothing after the initial synchronous paint ever runs.
  `setParam → recompute → paint` IS synchronous, inside the event handler, so
  load each state with one parameter a step away and move it onto the target:
  exactly one paint, at exactly the state you want. Recipe in
  `widgets/_lab/svm-sweep.js`.

### The fingerprint harness — now TWO hashes

`widgets/_lab/fingerprint.html`. **It auto-runs on load; never click Run** — that
starts a second concurrent pass into the same table and can make "Copy new
baseline" copy a half-interleaved set.

Every state records **`px`**, a hash of the canvas, and **`tx`**, a hash of the
figure's text — the concatenated `textContent` of `.w-math`, `.w-legend` and
`.w-readout`. A state MATCHes only if **both** match, and `check.mjs` fails a
state carrying only `px`.

The rail is deliberately absent from `tx`: the rail is what you SET and the stage
is what you SEE, and a control's own label is not a reading of the figure.

> *Earned:* widget 14 moved its equation into the DOM, which left both cheap
> checks at once. But the readout had never been hashed for **any** widget — the
> equation did not create that hole, it made it visible.

**Run the full suite when you touch `widgets/core/`.** That is the only kind of
change that can reach a widget you are not looking at. A run takes about five
minutes.

Three kinds of state:

| kind | how | sees |
|---|---|---|
| **settled** | a URL that fully determines the figure | the finished figure |
| **driven** | `drive: { click, frames, dt }` or `drive: { set: {…}, … }` | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

Plus a fourth verb, **`drive: { hit: [x, y] }`**, which dispatches a real pointer
event on the canvas at a point in *drawing* coordinates. `set` reaches a
parameter through its DOM control and routes around the region map entirely, so
a `set` state gives a widget's hit-test **no coverage at all** — and that
geometry is exactly what no pixel hash can see, because the picture is identical
whether a target sits where it is drawn or six columns away. It throws when the
point is over no region; the widget's own cursor is the detector.

`check.mjs` fails a non-draft widget that declares `animation` without a driven
state, or `regions` without a `hit` state.

- **`set` drives a control** rather than a drive button — found by `data-param`,
  never by position (5.7).
- Before recording a new driven state, confirm it is identical **across three
  runs**. A flaky check is worse than none.

### THE BIG ONE: every baseline is at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**.

This is where widget 11's six overflows were found, and none was visible at
1400px. No hash would ever have caught one: `note()` and friends stroke
surface-coloured before filling, so **a collision erases what it overruns rather
than blending**.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | hash its own states directly, seconds |

Build → cheap checks → **if core changed, one suite run** → *show Kenneth and
iterate* → and only then add states, baseline, commit.

### NEVER BASELINE BY PLACEHOLDER-AND-DIFF

**Do not add states with `"px": "0", "tx": "0"`, run the suite to see them go
red, copy the numbers back, and run the suite again to confirm.** The two jobs in
the table above are separate, and this welds them together: it re-verifies 113
already-known-good states in order to learn four numbers, twice.

Measured, on widget 15: **three full runs at roughly forty minutes each** — the
placeholder run, the confirming run, and a third to settle one flaky hash — to
record four states. The same four hashes take **seconds** computed directly.

**The previous widgets are baselined once. After that you only ever ADD.** To
record a new widget's states, hash them yourself in an iframe — this is exactly
what `shoot()` does, and copying it is cheaper than driving it:

```js
const hash = (s) => { let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0"); };
const f = document.createElement("iframe");
f.width = 900; f.height = 1200;                     // FRAME_W / FRAME_H, do not change
f.src = `../<slug>/${state}`;                        // state must carry ?theme=light
document.body.appendChild(f);
await new Promise((r) => f.addEventListener("load", r));
await new Promise((r) => setTimeout(r, 400));        // SETTLE_MS
const d = f.contentDocument;
const px = hash(d.querySelector(".w-figure canvas").toDataURL("image/png"));
const tx = hash([".w-math", ".w-legend", ".w-readout"]      // per SELECTOR, joined " | "
  .map((s) => [...d.querySelectorAll(s)].map((n) => n.textContent).join(" "))
  .join(" | ").replace(/\s+/g, " ").trim());
```

**The three selectors are joined by `" | "`, not flattened into one list.** This
recipe read `.flatMap(…).join(" ")` until it was checked against
`figureText()` in `fingerprint.html`, which is the function that actually
recorded every `tx` in the baseline. The two build different strings, so they
hash differently — and the failure is silent in the worst way: the recipe still
returns a plausible eight-hex-digit `tx`, and a widget baselined with it reads
MATCH against itself for ever while never agreeing with the suite. It surfaced
only because a sixteen-widget spot-check came back 16/16 red on `tx` at the same
moment `px` went red for an unrelated reason. **Copy `figureText` rather than
this block if the two ever disagree again.**

Run it from any page under `widgets/_lab/`, loop the states you want, paste the
pairs into the baseline. Then run the full suite **once** at the end — that run
is the confirmation, and it is the only one you need.

The placeholder pair is an **escape hatch and nothing else**: it exists so
`check` will pass on a non-draft widget whose design is still moving. It is not a
step in baselining.

*The harness has no way to run a subset, which is what makes the loop above
necessary. A `?only=<slug>` filter on `fingerprint.html` would remove the need
for it and is a small, obvious change nobody has made.*

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves.

If a state legitimately changes, regenerate the baseline **in the same commit**
as the change, so the diff records that the rendering moved.
