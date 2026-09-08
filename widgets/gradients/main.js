/* ============================================================================
   Widget 48 · Gradients — a derivative, the partials, and the descent.

   Three tabs in the lesson's own order: Derivative · Partial derivatives ·
   Descent. Decision blocks 1-6 below are about Descent, which was the whole
   widget until 2026-09-08 and is unchanged apart from the two picks in block 7;
   block 7 is the rename and the two new tabs.

   PHM5005 05-2 cells 73-78 (the worked example), 05-1 cell 4 (the update rule
   over the hill picture), 05-4 cell 41 (too high is unstable, too low is slow)
   and 05-4 cell 5 (batches give less noisy gradients). The misconception, as
   reported: the learning rate is a speed, so larger is faster. Inferred
   alongside it: the gradient points at the minimum.

   KENNETH'S PICKS from `_lab/gd-mock.html`, 2026-09-07 — the build brief:
     §1 C  the data beside the surface, with a loss strip beneath
     §2 C  the two partials as component ticks along the axes, each with its
           number, composing into the direction
     §3    the lr ladder must hold the lesson's 0.01, a value raw x diverges
           at, and a value standardized x diverges at
     §4    `scale` is a data control, raw or standardized x
     §5    the one-parameter parabola is its own page, and it comes first
     §6    a `batch` control, full / 10 / 1
   Routine calls he left to the build: the walk starts at the lesson's (0, 0)
   with no start sliders; Slow choreographs one epoch; the readout is b₀, b₁,
   the loss as a multiple of the least, the two partials and the step length,
   with "diverged at epoch N" replacing the loss once it has.

   MEASURED, and re-asserted by `_lab/gd-verify.mjs` so nothing printed here
   can drift away from the engine (the curvatures the `scale` control states on
   screen are checked there):

     raw x           curvatures 68.5 and 0.50, condition 138; stable lr < 0.029
     standardized x  curvatures 2 and 2;                      stable lr < 1
     raw, lr 0.03    diverges at epoch 274;  lr 0.05 at epoch 17
     raw, lr 0.01    b₀ 5.17, b₁ 1.97 after 1000 epochs (least squares 5.20, 1.97)
     batches, raw, lr 0.01, 20 epochs: full batch ends at 6.0x the least loss,
       batches of 10 at 1.8x, single rows at 1.6x — two thousand small noisy
       updates beat twenty exact ones, and none of the three diverged. So the
       `batch` control has a stage that WINS as well as a path that wobbles.

   THE DECISIONS THE BRIEF DID NOT SETTLE, recorded because each could
   reasonably have gone the other way.

   1. THE COMPOSED ARROW IS BUILT IN SCREEN SPACE, not in parameter space. The
      mock scaled (-g₀, -g₁) directly into pixels, which is right only when the
      two axes have the same units per pixel — and they do not: the b₀ window
      spans 10.2 against b₁'s 4.0 on a square panel. Composed that way the
      arrow points somewhere the dot does not then go, in the one figure whose
      whole claim is where the step goes. So the direction is the SCREEN delta
      of one unit-time step, normalised to a fixed length; the two component
      ticks are that arrow's x and y parts, so they still compose exactly, and
      each still carries its own partial's number. Nothing on screen claims the
      arrow is perpendicular to the contour, because at this aspect it is not.

   2. THE LEAST-SQUARES LINE AND ITS TWO NUMBERS SHOW FROM THE START; the
      minimum ON THE SURFACE is crossed only once the walk is within 1% of the
      least loss. The brief settles both, and they look inconsistent until you
      ask what this widget's answer is: not "what are the fitted values" —
      widget 27 owns that — but "how does the learning rate govern the walk".
      The fitted pair is the reference the walk is judged against (2.7), and
      the cross is the widget saying the walk ARRIVED, which is the thing the
      reader has to build (2.1).

   3. THE LOSS STRIP PLOTS log10(loss ÷ the least loss), not log10(loss). The
      floor is then 0 on both pages and on both scales, so only the top
      ratchets (2.5), and the axis reads in the same units as the surface's
      colour bar and the loss tile. Its top is capped at 6 decades: a divergent
      run reaches 16, and letting it set the window would squash every
      convergent walk into the bottom pixel.

   4. THE RELIEF IS A SECOND READING OF THE SAME PANEL, added 2026-09-07 from
      Kenneth's picks off `_lab/gd-3d.html`: log height, a fixed viewpoint, the
      hidden part of the path dashed, the partials as tangents on the surface.
      Four things it settles.

      THE VIEWPOINT IS A CONSTANT, azimuth 300 and elevation 35, and it was
      swept rather than chosen: with log height the walk lies along the trench,
      and from 215/38 the near wall hides 94% of the lesson's own walk. A
      viewpoint control would hand the reader directions that hide the thing
      the widget is about, so `model.js` holds the pair and `gd-verify.mjs`
      re-measures the claim. The catalogue records the sweep. *Superseded on
      2026-09-08 by decision 5; what survives it is 300/35 as the viewpoint the
      figure OPENS at, and every sweep measurement above is about that.*

      THE HIDDEN PART OF THE PATH IS DASHED AND FAINT, rather than the mesh
      being made transparent. A translucent mesh shows the far wall through the
      near one and the relief stops reading as a surface; the dashed hidden
      line is the drawing convention for exactly this and costs one
      classification per walk.

      BOTH EXPENSIVE PARTS ARE CACHED, on the same terms the map's bitmap
      already is: the mesh (1936 quads, sorted and filled, ~2 ms) into a bitmap
      keyed on size, theme and dataset, and the path's visible/hidden split
      (~1 ms) keyed on the walk. Only the path, the point, the tangents and the
      corner names are painted per frame. Both keys gained the viewpoint with
      decision 5, since both are functions of it.

      THE PATH IS SAMPLED, dense over the opening 300 updates and strided after
      it to about 1500 pieces. At batch 1 the walk holds 100 000 positions; the
      map's own path already strides to 1500, and the opening stays dense
      because the first epochs cross most of the frame while the rest crawl.

   5. THE VIEWPOINT BECAME A DRAGGED PARAMETER on 2026-09-08, at Kenneth's ask:
      the relief turns under the mouse. Decision 4 had it fixed, and the reason
      it gave — a reader has no way to know which directions hide the walk — is
      answered by where the figure OPENS rather than by refusing to move: 300/35
      is still the measured default, `gd-verify.mjs` still re-measures every rung
      on both scales from it, and a reader who turns the surface into its own
      near wall can see that they have.

      IT IS A PARAMETER AND NOT ANIMATION STATE, which is the whole of why it
      goes through core's `drag` channel rather than a pointer handler here. A
      camera held in `anim` would be invisible to the URL, so the reader could
      find the angle that shows their walk and have no way to send it to anyone
      — the figure would be showing one thing and the link claiming another
      (1.1). A drag is a control and obeys a control's rules (3.6), so `turn`
      and `tilt` are ordinary `display: true` parameters: the walk survives the
      turn, and the two are written as one transaction because a camera's turn
      and tilt are one gesture.

      THEY CARRY NO RAIL CONTROL, and that is the one rule bent here. 3.6's
      "keep the control" exists so a figure is not mouse-only; two more sliders
      for a camera would cost the rail more than they buy, and nothing in the
      widget's argument is reachable only by turning — the map is the same
      window, drawn straight down, and every number the widget states is on it.
      The relief is a second reading, and the turn is a second reading of that.

   6. THREE THINGS KENNETH ASKED FOR ON 2026-09-08, after the drag landed.

      A "DEFAULT VIEW" BUTTON, because a dragged viewpoint needs a way home
      that is not another drag. Decision 5 bent 3.6 by giving the camera no rail
      control, and the cost of that only shows once a reader has turned the
      surface into its own near wall: the way back is to drag until it looks
      right again, which is a search rather than a control. The button is the
      one piece of the camera that belongs in the rail — not a number to set,
      an action to take — so it is a momentary `bool` on widgets 34, 35 and
      mlp's pattern: pressed, `rebuild` sees it true, the widget writes `turn`
      and `tilt` back to the measured 300/35 and releases the button, and the
      URL carries the viewpoint and never the press. Display-only throughout,
      so coming home keeps the walk (3.2).

      THE ONE-PARAMETER PAGE DRAWS ITS GRADIENT AS A VECTOR, which is the
      one-dimensional case of the map's composed direction rather than a second
      idea. There θ is (b₀, b₁), the two partials are component ticks and they
      compose into the arrow the step takes (§2 C). Here θ is b₁ alone, so
      −∂L/∂θ has one component and the arrow is horizontal — same fixed pixel
      length, same lettering, same number beside it. Without it the page showed
      the SLOPE and left the reader to infer the DIRECTION, which is the
      misconception this widget was built for.

      EVERY SPEED CHOREOGRAPHS ON THE ONE-PARAMETER PAGE. Kenneth: *"default to
      slow animation, it's currently too fast."* An epoch is a hop on this page
      and a crawl on the other — the parabola is walked in about ten epochs at
      lr 0.01, the surface in a thousand — so one clock cannot serve both, and
      Medium's 60 a second showed a walk that was over before it started. The
      pages now differ in the CLOCK and not in the choreography: the table is
      `EPOCH_MS` in `model.js`, where `gd-verify.mjs` can assert it, and Slow
      still choreographs over the surface exactly as it did. A per-page default
      for `speed` was the obvious smaller change and is not expressible — the
      URL omits a parameter at its default, so the two pages share one.

   7. THE RENAME, AND THE TWO TABS IN FRONT OF THE WALK (2026-09-08). Kenneth,
      round 5: *"consider basics first — a tab for concepts, differentiation and
      partial differentiation. Maybe call it Gradients, with tabs like diff and
      optimization."* Mocked in `_lab/gd-round5.html` §3 and picked from it, with
      the rename to land now rather than at promotion.

      THE ORDER IS THE LESSON'S. A derivative is how much y changes for a small
      change in a; a partial derivative is that with the other variables held,
      and the gradient is the vector of them; descent steps against that vector.
      The slug follows the widget: `gradients`, because descent is now the last
      third of it and a name for the whole is a name for the argument.

      BOTH NEW TABS ARE THE SAME FUNCTION, y = a^2 + 3ab, which 05-1 differentiates
      at (2, 1) and prints 7 and 6 for. One function across two tabs is what
      makes the second tab a reading of the first rather than a fresh example,
      and the numbers are the ones the reader has already seen printed.

      WHAT EACH CLAIMS.
        Derivative — the tangent's slope is dy/da, and a nudge of Δa moves y by
          about that slope times Δa. What the tangent misses is EXACTLY Δa^2 on
          this function (model.js says why), so the ladder from 1 down to 0.01
          takes the gap from 1 to 0.0001 and the approximation is seen to
          improve rather than asserted to. *Superseded by decision 9: that is a
          true statement about a derivative already in hand, and the definition
          runs the other way. The tab now draws the secant and its slope's
          limit; the ladder and its clock are unchanged.*
        Partial derivatives — each partial is the slope along one variable with
          the other held, drawn as a slice beside the map; the gradient is the
          pair, and it points uphill.

      THE PARTIAL DERIVATIVES TAB DECLINES BOTH DRIVE BUTTONS (4.5). Everything
      on it is at rest: two sliders move a point over a fixed function, and
      there is no arrival to wait for. It declines them through `anim.inert`
      rather than `stepLabel: null`, which core reads once when the shell is
      built and could not then give the other two tabs their buttons back —
      `hierarchical-clustering` is the same shape.

      THE DRIVE BUTTON SAYS "SHRINK THE NUDGE" AND NOT "HALVE" IT. The brief
      asked for Halve; the ladder is 1 · 0.5 · 0.25 · 0.1 · 0.05 · 0.01 and two
      of its five rungs are a fifth and a two-and-a-half, so the button would
      have been false on the press that made it (4.4b). What the ladder is for
      is four orders of the gap in six readable numbers, not a halving sequence.

      THE DERIVATIVE PANEL CARRIES EXACTLY ONE LABEL, the slope on the tangent.
      Δa and the gap were labelled on the figure too and both came off: a
      fillText BOX sweep at four widths over the whole window found 44 label
      collisions and 528 escapes past the panel edge between them. Their numbers
      are on the line under the panel and in the readout, which have room; what
      has to sit on a mark is the number that mark IS. *Decision 9 puts Δa and
      Δy back on the triangle's two legs and gains a third sweep for it: they
      are drawn only while a leg is 26px long and wholly on the panel, which is
      the same rule said as arithmetic instead of as a count.*

      THE ARROW ON THE (a, b) MAP IS BUILT IN PARAMETER UNITS, which decision 1
      forbids on the loss surface. The difference is that nothing follows it:
      decision 1's trap is an arrow that points somewhere the dot does not then
      go, and on this tab no dot goes anywhere. What the arrow claims is uphill,
      and a monotone pair of scales cannot turn uphill into downhill. The panel
      is square over a 5-by-4 window, so the arrow is 1.25x off perpendicular to
      the rings; nothing on screen says it is perpendicular.

      THE MAP SITS WHERE THE LOSS SURFACE SITS — the right-hand square, same
      rect — rather than on the left as the mock had it, so the two parameter
      maps land in the same place as the reader moves between tabs. The two
      slices take the left column the data panel holds on Descent. *The rect is
      no longer shared: decision 8 sizes this tab's square to the stage instead.
      What survives is the side it sits on and the column the slices take.*

      AND THE TWO PICKS OFF ROUND 5 §1 AND §2, both on Descent.

      THE ANGLE, AND THE STRAIGHT LINE IT IS MEASURED FROM (§1). Kenneth: *"why
      doesn't the gradient go downhill directly? it's descending by one
      parameter then the next — is this what actually happens?"* It is not, and
      the widget drew the answer without saying it. The map now draws the
      straight line from the walk to the least-squares point faint and dashed,
      and a line under the figure states the angle between that line and the
      step: 80 degrees at lr 0.003 and epoch 10 on raw x, 0 on standardized x,
      both re-measured in `gd-verify.mjs`. It is `model.js`'s `stepAngle` and not
      arithmetic in the panel, because the number is a fact about the surface
      and not about the drawing — the equal-aspect mock prints the same 80.

      THE LINE GOT ITS OWN ROW AND THE STAGE GREW 18px FOR IT. There was no gap
      to put it in: the beat line sits at +78 under the panels and the loss
      strip's caption at +96, and a sentence 407px long does not fit beside
      either at the widths this widget is drawn at. Squeezing it under the
      colour bar fits at 900px and collides at 550. So the strip moved down one
      line box and `stageHeight` went from side + 240 to side + 258; the row is
      reserved on every page and filled only on the two-parameter map (3.4k).

      CHOREOGRAPHY A ON THE ONE-PARAMETER PAGE (§2). Kenneth: the tangent *"moves
      then redraws (like expanding out) at each step"*. It did: the segment grew
      from its centre at the start of every epoch. Now it is always at full
      length and rolls with the point; each epoch holds at the point for 40% of
      the beat with the arrow and its number, then moves for the other 60% with
      an ease-in-out. Picked live from five candidates against the current
      behaviour, which was E.

   8. TWO LAYOUT FAULTS FOUND BY A BOX SWEEP, 2026-09-08. Both were measured
      with a `fillText` box sweep in node — a stub context that records every
      painted string's box, driven at 550, 690 and 770px, the three widths the
      side layout reaches. Neither is visible to a pixel hash: one is empty
      space, and the other is two labels printing through each other.

      THE PARTIAL DERIVATIVES TAB HAS ITS OWN SQUARE, and no longer borrows the
      loss surface's. Decision 7 gave it that rect so the two parameter maps
      would land in the same place; the cost, unmeasured at the time, is that
      `surfSide` is a WIDTH calculation — what the width leaves once a data
      panel has been fed — and this tab has neither a data panel nor a loss
      strip. The lowest thing it painted stopped 159px above the bottom of the
      stage at 550, 690 and 770px alike. The map is now bound by the stage's own
      height less the colour bar's two lines, and by the width left beside the
      slices; the square runs 197 → 228, 261 → 368 and 298 → 445 at those three
      widths, and the tail under it 159 → 128, 52 and 12. The width binds at
      550 and 690 and the height at 770, which is why both bounds are written
      rather than whichever one happens to bite. The slices are together as
      tall as the map, so the tab still reads as one figure and its two
      readings, and their column floors at the 200px that keeps a slice's
      caption and its note on one line.

      The Derivative tab was measured in the same sweep and left alone: its
      panel is already `stageHeight − TOP − 60` with its one line 46px under
      that, so it ends 14px off the bottom of the stage with nothing to fill.

      THE TWO COMPONENT LABELS TOOK OPPOSITE SIDES OF THE POINT. Anchored at
      the ends of their own ticks they overlapped by up to 9.5px, because at
      epoch 5 of the lesson's walk both partials have gone small and a 2px tick
      anchors its label on the dot the other label is already on. Over the
      lesson's walk — lr 0.003 and 0.01, epochs 0 to 40, both scales, both
      clocks and eight points of the beat at 550, 690 and 770px — that was 108
      overlapping states of 4428, and one label came within 0.4px of the ringed
      dot. It is now 0 and 0, with 23px between the labels and 12px to the dot
      at the tightest. `drawSurface` says what replaced it; the clearances are
      arithmetic now rather than a property of how long the ticks happen to be,
      which is what let the fault through in the first place.

   9. KENNETH'S REVIEW OF 2026-09-08, ROUND 6 — two questions, one per concept
      tab, and each turned out to be about a figure drawing something other
      than what the lesson defines.

      "ISN'T THE NUDGE DRAWN INCORRECTLY? I THOUGHT IT'S SUPPOSED TO BE THE
      LIMIT AS Δa → 0." He is right, and block 7 was wrong. What the tab drew
      was the TANGENT and its linear prediction over Δa against what y actually
      does — the linearization and its Δa² error, which is a true statement
      about a derivative already in hand. The definition runs the other way: a
      derivative IS the limit of Δy/Δa, so the figure has to draw the SECANT
      through (a, y(a)) and (a + Δa, y(a + Δa)) and let its slope close on
      dy/da. On this function that slope is 2a + 3b + Δa exactly, so the ladder
      at a = 2, b = 1 reads 8 · 7.5 · 7.25 · 7.1 · 7.05 · 7.01 toward 7 — six
      numbers the reader watches arrive, where the old figure had one number
      and a gap shrinking beside it. `gd-verify.mjs` pins the ladder and the
      identity behind it at all 306 (a, Δa) the tab can reach.

      The ladder, the clock, the ease and `standNudge` are untouched: shrinking
      Δa now slides the second point along the curve and rotates the secant,
      which is the same eased number doing a more honest thing. What changed
      with it is the readout (Δa, Δy, Δy/Δa, dy/da, in the order the definition
      is built), the formula card (dy/da = lim Δy/Δa = 2a + 3b, with the limit
      written out), the legend, the line under the panel, and the `da`
      control's `detail`, which now states the secant's slope as dy/da + Δa —
      a static sentence, true at every a, where a number would have moved under
      the slider beside it.

      THE TANGENT SHOWS FROM THE FIRST FRAME, and the brief left this open.
      *Its COLOUR is superseded by decision 12: it is --c-slope now, held back
      by alpha rather than by being grey. Everything below about when it is
      drawn and what it is for stands.*
      2.1 says do not open on the answer; 2.7 says the reference the moving
      thing is judged against belongs beside it. 2.7 wins here because dy/da is
      ALREADY on screen before the reader touches anything — on the formula
      card and as the fourth readout tile — so hiding the LINE would withhold
      one drawing of a number stated twice, while leaving the thing the reader
      actually builds, the six-rung approach, exactly as it was. Faint, dashed
      and in `--c-reference`, painted under the secant so the secant is seen
      turning onto a line that was already there.

      "COULD WE HAVE THE 3D VIEW ALSO, SO WE CAN SEE THAT WE ARE HOLDING ONE
      CONSTANT WHILE THE OTHER VARIES?" The Surface control and Default view
      now serve the Partial derivatives tab as well, over the same `turn` and
      `tilt` and the same drag. What answers the question is not the mesh but
      the two SLICE CURVES lifted onto it: on the map they are two dashed
      straight lines standing for a slice, and on the relief they are what the
      function does along one variable with the other held.

      THE HEIGHT IS LINEAR IN y AND THE LOSS SURFACE'S IS A LOG, which is why
      `model.js` now carries two FIELDS rather than one ramp. A field says
      where a point sits on its panel's own ramp and nothing else, so the mesh,
      the ray march and the lifting are written once for both (5.8); the loss
      field is the log of the ratio to the least loss, the value field is y
      itself over −8 to 52. The payoff of linear is not only honesty about a
      range that is not a ratio: a straight line in (a, y) stays straight on
      the relief, so the two partials are drawn as TANGENTS on the surface
      rather than as chords across it, which is what the tab is about.

      THE VIEWPOINT WAS MEASURED AGAIN AND CAME BACK THE SAME. `_lab/
      gd-part-view.mjs` sweeps 648 viewpoints over 30 points of the (a, b)
      window and then re-checks the winner at all 2091 stops the two sliders
      have: from 300/35 nothing of either slice curve is hidden anywhere, and
      the point is never behind the surface. Only the 210-260 azimuths below
      about 30 degrees lose anything, and there they lose up to 98% of both.
      So the two tabs keep ONE default pair — which they would have had to
      anyway, since a parameter at its default is omitted from the URL and a
      per-tab default is not expressible (decision 6 met the same wall on
      `speed`) — and `turn=300&tilt=35` means the same thing in a link opening
      either tab.

      THE SURFACE CONTROL'S GATE NEEDED A DISJUNCTION, and core's `when`
      grammar gained `any` beside the `all` and `oneOf` that arrived the same
      way: the control is on one whole tab and on one PAGE of another, and
      gating it on the tab alone would offer to turn the one-parameter page's
      curve (3.5). Its two descriptions name neither function now — "colour
      alone" against "height as well as colour" — because one control over two
      surfaces cannot say "the loss" and stay true on both (2.11).

      A THIRD BOX SWEEP, and it found three faults, all in the new drawing.
      16 767 states — the Derivative tab at every a, every rung and six beats,
      and the Partial relief at seven viewpoints over the whole window, at 550,
      690 and 770px. The secant's slope label started at the secant's
      lower-left end and printed through Δa in 253 states, where the clamp puts
      both on the panel's bottom edge; the two legs kept their labels while the
      second point was off the frame, which puts the top of one leg and the far
      end of the secant on the same corner pixel, in 189; and on the relief the
      two partials' labels ran into the axis names on the rim in 101 and into
      each other in 138, by up to 41px. All three are 0 now. The 134 remaining
      hits are on the UNCHANGED Descent pages, where `∂L/∂b₁` is drawn inside
      the panel's own clip and is therefore cut rather than escaping — the
      sweep cannot see a clip. Worth a round of its own; not this one.

  10. KENNETH'S REVIEW OF 2026-09-08, ROUND 7 — one question per remaining tab
      again, and both answers are about a figure showing less than it holds.

      "FOR ONE PARAMETER CURVE COULD YOU INCREASE THE X-AXIS? IT CANNOT HANDLE
      LARGE LEARNING RATES? OR MAKE LEARNING RATES SMALLER?" It could not: the
      page drew the b₁ slice in `domainFor`'s fixed window, about −0.5 to 3.5,
      which holds the lesson's 0.01 walk and nothing above the stability
      boundary. At 0.03 the oscillation grows by 1.01 a step and the point
      leaves around epoch 300; at 0.1 the FIRST step is +13.5 in b₁ and it is
      gone before it has been seen once, and 0.3, 1 and 3 the same. Half the
      ladder had nothing to show on this page.

      THE LADDER STAYS AND THE WINDOW MOVES. Shrinking the learning rates was
      the other option Kenneth offered and it is the wrong one: the top rungs
      are the standardized bowl's oscillate-and-diverge cases, which is the
      whole argument for standardizing (2.6). So `sliceWindow` in `model.js`
      centres the b₁ axis on the least-squares b₁ and takes its half-width off
      2 · 4 · 8 · 16 · 32 · 64 · 128 · 256 · 512 · 1024 — the smallest rung
      holding every position revealed so far, plus the start — with the loss
      axis following it: the loss at the window's own edge, rounded up on a
      1-1.25-1.5-2-2.5-3-4-5-6-8 ladder. It is a function of the epochs SHOWN,
      exactly as the loss strip's own two ratchets are, so it never shrinks
      within a walk, Reset returns it and no display change can touch it
      (2.5, 3.2).

      MEASURED, epochs held inside the frame, seed 1, old window → new:

        raw x, lr 0.03      0 → 619    the oscillation grows by 1.01 a step
        raw x, lr 0.1       0 →   3    rungs 4 · 16 · 128 · 512, then past 1024
        raw x, lr 0.3       0 →   2
        raw x, lr 1 and 3   0 →   1
        standardized, lr 1  0 → 1000   alternates for ever, and now visibly
        standardized, lr 3  0 →   3

      The last row of that table is the one that matters most: at lr 1 on
      standardized x the factor 1 − α × curvature is exactly −1, so the walk
      alternates about the fit for ever at the distance it started with — the
      one rung on the ladder that neither converges nor diverges — and the fixed
      window lost it on the FIRST step, because the far side of an alternation
      is twice the least-squares b₁ and the frame stopped 1.5 past it. Nothing
      below the boundary changed: at 0.001, 0.003 and 0.01 the window is set by
      the start at b₁ = 0 and never ratchets at all. Past the top rung the point
      leaves and the panel says "off the frame" until the divergence test trips,
      which is what it did before.

      THE RUNG AT REST IS THE SEED'S, and that is honest rather than tidy: raw
      B₁ runs 1.944 to 2.048 over the 30 seeds the control offers, which
      straddles the ladder's first rung, so seed 1 opens at a half-width of 4
      and seed 7 at 2. What every reader gets is an axis that does not move
      under them while the lesson's walk runs.

      NOTHING PRINTS THE HALF-WIDTH: the axis ticks say it, and a second copy on
      the caption is a number that can disagree with the axis beside it. What
      the ticks needed instead is `bigTick` — past a million they read as powers
      of ten, because the loss at the edge quadruples every time the half-width
      doubles and an eight-digit tick does not fit the 44px it has. Measured
      over every state the two scales and eight rungs reach: plain digits put
      1 926 tick labels past that gutter, the worst 48.4px against 44; with
      `bigTick` it is 0, and the widest label left is 36.3px.

      "COULD THE RELIEF SHOW THE TWO SLICING PLANES?" — against a matplotlib
      figure of y = a² + 3ab with two translucent vertical planes through the
      point, a = 2 and b = 1, each cutting the surface along one slice, and the
      two 2-D slice plots beside it framed in their plane's colour. The Partial
      derivatives relief now draws both: a quad from the ramp's floor to its
      ceiling, filled at 0.15 with a 1.5px edge at 0.6, painted after the mesh
      rather than sorted into it — a section plane over a solid is translucent
      by convention, and painting it last is what lets the mesh stay one cached
      bitmap.

      THE COLOURS ARE --c-group-a AND --c-group-b, AND IT IS A MILD STRETCH,
      recorded here rather than answered with a new token, which would be a core
      change. The token's own reading is "two arms of a comparison you decided",
      and these are two DIRECTIONS the reader decided to hold rather than two
      arms of data. What makes it the closest role rather than a reach: the pair
      is chosen and not found, so the cluster ramp is wrong; neither is a
      benchmark, a threshold or an outcome; and blue/amber was picked for being
      the most colour-blind-safe and highest-contrast pair in the ramp, which is
      what two planes on one surface need. --c-group-a shares --series-1 with
      --c-empirical, and the token file's rule for that sharing holds here: this
      tab has no empirical mark on it, and Descent's loss strip is on another
      tab.

      IT ALSO SHARES --series-1 WITH --c-value-low, AND THAT ONE DOES BITE. The
      tokens file says a panel colouring by value must not also colour by
      identity, and this panel now does both: the surface's low end is the blue
      --c-group-a is, and the low end of y = a² + 3ab is a real corner of this
      window — at a = −1, b = 3 the value is −8, the floor of the ramp. So the
      a-slice's line would vanish exactly where the reader slides b up. The
      remedy is the one this widget already uses for a mark landing on the loss
      surface's own cost-low blue: `ringedDot` cases its fill in the page's
      ground, and both the map's cut lines and the relief's slice curves are
      cased the same way. The pairing is carried by colour and the mark is found
      by contrast, which is the two jobs separated rather than one colour doing
      both. A screenshot is what settles whether that is enough; the arithmetic
      cannot.

      THE COLOUR IS CARRIED TO THE PANEL THAT READS THE PLANE, on the map as
      well as the relief — the slice curve and the ∂y/∂ label above it — so the
      pairing survives turning the surface over, and the map's two dashed cut
      lines take the same two. The tangents stay highlight, which is what a
      tangent is everywhere else in this widget. *Superseded by decision 12: a
      tangent is --c-slope everywhere in this widget now, here included, and
      what survives is the sentence's argument — one mark, one colour, on every
      panel that draws it.*

      THE HIDDEN PIECES STAY INK, and that is the one place this parts from
      colouring everything. A piece the surface is in front of is a ghost of the
      mark rather than the mark, the convention is one fact about both slices,
      and two coloured versions of it would need two more legend rows to say it.
      From the viewpoint the figure opens at there are none of them anyway.

      A FOURTH BOX SWEEP, over the tab this round touched, and RUN TWICE — once
      on this tree and once on the previous commit's, because a sweep that
      reports a number and not a difference cannot tell a fault this round
      introduced from one it inherited. 2 673 states each: an 11 x 9 grid over
      the (a, b) window, the map and the relief at eight viewpoints (the default
      300/35, four more round the compass, and the three the earlier sweeps
      found things at), at 550, 690 and 770px.

      Both runs: 0 escapes past the canvas, and 19 collisions with the same
      worst overlap of 6.1px — the same 19 states, string for string. So this
      round adds none, which is what the planes being wordless predicts: they
      carry no text, and the colour changes moved no anchor. Every one of the 19
      is a one-character axis name on the rim against a ∂y/∂ label at a TURNED
      viewpoint — 215/38, 240/20 and 300/12, none of them where the figure opens
      — and it is the third of the three faults decision 9 fought, surviving at
      the resolution `clearsRim`'s 26px band leaves. Inherited, measured, and
      worth a round of its own; not this one.

  11. KENNETH'S REVIEW OF 2026-09-08, ROUND 8 — both questions about the
      one-parameter page, and both about the same thing: a page that showed a
      parameter moving and neither what it moved nor why this parameter.

      "WOULD A FIT GRAPH BE USEFUL? I SEE THE EQUATION BUT CANNOT CONNECT THE
      CONCEPT." The two-parameter page has always drawn the data with the line
      at this epoch on the left and the loss on the right; the one-parameter
      page drew the parabola across the whole width and nothing else, so the
      only picture of the fit was the equation on the card. It now takes the
      SAME composition (3.4): `L.data` on the left with the 100 rows, the
      current line in highlight and the least-squares line dashed, and `L.surf`
      on the right — the identical square the loss surface uses — holding the
      loss along the coordinate that descends. Through a Slow epoch the line
      visibly swings, or shifts for b₀, as the point slides down the parabola.
      Stage height is untouched: the panel was already `side` tall, so the
      strip, the regime line and the beat line land exactly where they did.

      WHAT THE SQUARE COST, AND WHERE IT WENT. The panel runs 197 · 261 · 298px
      at the three widths the side layout reaches, against 484 · 624 · 704
      before, and the caption is what did not fit: "the loss over b₁, b₀ held at
      5.09, curvature 67.0" is about 250px. The held value came off it, because
      the readout tile beneath states it in full and a number stated twice is a
      number that can disagree with itself; the curvature stayed and lost its
      decimal. The ratcheting window's tick labels still clear the gutter — the
      widest `bigTick` label is 5 characters, and the axis has 48px between the
      panel and the data panel's right edge against the 44 it had when round 7
      measured them.

      "SHOULD WE BE ABLE TO CHOOSE WHICH PARAMETER TO OPTIMIZE, e.g. b₀, b₁?"
      Yes, and it turns out to be the sharpest control on the page. `descendOne`
      in `model.js` walks either coordinate with the other held, storing the
      moving one in its own slot so `posAt` and the data panel need no special
      case (5.8), and `which` picks it.

      THE TWO CURVATURES ARE THE POINT. The loss along b₀ is a parabola of
      curvature exactly 2 — the Hessian's (0, 0) entry is 2n/n, with no data in
      it on any design — while along b₁ it is 2 × mean(x²), which is 67.0 on the
      lesson's raw x and 2 on standardized x. So on raw x the same ladder gives,
      along b₀: 0.01 keeps 0.98 of the distance a step and takes hundreds of
      epochs, 0.5 lands exactly on the fit in ONE step (1 − 0.5 × 2 = 0), 1
      alternates for ever, 3 diverges — where along b₁ everything from 0.03 up
      is already gone. That is the trench's two curvatures, which the
      two-parameter surface shows as a shape, said one dimension at a time as
      arithmetic the regime line prints. `gd-verify.mjs` pins all four.

      THE WALK STARTS AT 0 for whichever coordinate descends, which is the same
      start the other two walks have. For b₀ that is about 5 from its fit, so
      the ratcheting window opens at rung 8 where b₁ opens at 2 or 4 — the
      window is symmetric about the chosen coordinate's own fit and needs no
      other change.

      EVERY STRING THAT NAMED b₁ IS NOW A FUNCTION OF THE CHOICE, and they are
      nine: the caption, the x axis, the arrow's label, the beat line, the
      regime line's curvature, two readout tiles, three legend rows and the
      formula card's one partial. `ONE` in this file holds what each coordinate
      is CALLED and `COORD` in `model.js` holds which slot it IS, keyed alike —
      one table each rather than nine agreements maintained by hand (5.8).

      A FIFTH BOX SWEEP, and it found the one thing the square broke. 16 125
      states — both coordinates, both scales, all eight rungs, epochs 0 to 40,
      five points of the beat, at 550, 690 and 770px — through a stub context
      that MODELS THE CLIP, which the earlier sweeps did not: half the labels on
      this page are painted inside one, so a sweep blind to it reports a 2.8e11px
      escape for a mark nobody sees and misses the real fault, which is a label
      the clip CUTS. Run twice, once on this tree and once on the previous
      commit's, because a sweep that reports a number and not a difference
      cannot tell what this round broke from what it inherited.

      Escapes past the canvas 0, collisions 0, caption past its panel 0, and the
      ratcheting window's ticks clear the data panel by 11.3px at the tightest —
      the widest `bigTick` label is 36.7px in a 48px gutter, against the 44px
      round 7 measured it in. Its clearance to the rotated "loss" name is 1.4px,
      the same 1.4px in the same state on the previous commit, so the square did
      not move it.

      What the square DID break was cut labels: 13 before, 1858 after, 171 of
      them on the lesson's own walk at 550px. As b₁ closes on its fit it stands
      at the panel's centre, the arrow takes 39px to its right and its number
      wants 61 more, of which a 197px panel has 98. `drawSlice` says what fixed
      it — `panelLabel`'s clamp, plus the row below the shaft where the row above
      is the panel's own top line — and it is 0 and 0 now. Three states of that
      remedy were measured in turn, because the first traded 1858 cuts for 201
      collisions with "least squares" and "off the frame".

      NOTHING ELSE MOVED, and that is asserted rather than assumed: 288 states
      over the two-parameter page — map and relief, both scales, batch 10, a
      turned viewpoint — and over both concept tabs hash identically to the
      previous commit's, over the canvas text boxes, the readout, the legend and
      the summary together.

  12. KENNETH'S REVIEW OF 2026-09-08, ROUND 9 — one question, and it turned out
      to be about a colour role the collection did not have.

      "THE COLOUR MAY BE HARD TO SEE FOR THE TANGENT LINES FOR DERIVATIVES;
      COULD YOU TRY SOMETHING EASIER TO SEE LIKE RED?" He is right, and the
      reason is arithmetic rather than taste. A tangent LIES ON the curve it
      touches, so what decides whether it can be seen is its contrast against
      --ink-2 and not against the page: --c-highlight is 1.08 against the curve
      in the light theme — the same luminance — and 1.74 in the dark. The one
      thing to look at was the one thing that could not be seen.

      RED IS THE WRONG ANSWER AND WAS MEASURED ANYWAY. --series-8 reads 2.0 and
      1.8 against the curve, better but not good, and it is --c-extreme and
      --c-cost-high: it already means past a threshold, and this widget's
      gradient arrow crosses a loss ramp whose hot end IS that red — 1.00, which
      is not a low contrast but no contrast. `_lab/gd-colour.html` tables every
      series slot against the curve, the surface and the ramp's two ends in both
      themes, with the Derivative figure and the arrow-over-the-ramp drawn in
      each. Kenneth picked magenta, casing on, 2.5px.

      SO THE COLLECTION GAINED A ROLE: --c-slope on --series-5, the one slot
      that carried none — the local slope, a tangent, a secant, a gradient
      arrow. 2.95 against the curve in the light theme and 2.20 in the dark,
      1.22 on the ramp's hot end. CLAUDE.md's rule for a role that does not
      exist is to add one rather than reach for a numbered slot, and this is a
      role and not a widget's preference: every later widget that draws a rate
      of change has the same mark with the same problem. `tokens.css` says the
      rest, and `gd-verify.mjs` asserts that the token reaches the canvas.

      AND A CASING, WHICH IS THE HALF THE COLOUR CANNOT DO. No hue in the ramp
      separates from every surface a slope can be drawn over — the loss ramp
      runs blue to red under one of these arrows, and the value ramp runs the
      same range under two of these tangents. So `slopeLine` draws each slope
      that lies on a curve twice: the page's own ground at 3px wider, then the
      colour at 2.5. Colour says what the mark IS and contrast is what makes it
      findable, which is the division of labour decision 10 already reached for
      the slice curves over --c-value-low.

      WHAT STAYS --c-highlight, and it is two things: the RINGED CURRENT POINT
      on every panel, and the LINE AT THIS EPOCH on the data panel. Neither is a
      slope. The point is where you are, and the line is the model those two
      numbers currently make — both are "the one thing to look at right now",
      which is what the role means, and neither has a rate of change in it. The
      map's two component ticks stay ink for the reason they were ink: they are
      the arrow's parts, not slopes in their own right, and the arrow they
      compose into is what carries the colour.

      THE LEGEND SPLIT TWO ROWS AND RETOKENED THREE. A row that named a
      highlight mark and a slope mark in one breath — "the line at this epoch,
      and the direction of the next step" — is now two rows, because a legend
      row is a promise about a colour. Rows whose marks are ALL slope were
      retokened and left whole: the Partial derivatives tab's tangents and its
      gradient arrow are one colour doing one job, and splitting them would name
      magenta twice to say one thing. The Descent relief's row gained the
      tangents it draws, which were ink and unnamed before.

      NO LABEL PLACEMENT DEPENDS ON A STROKE WIDTH, so the five box sweeps above
      stand as they are. Every anchor in this file is computed from a point, a
      panel rect or a measured text width; the two lines that grew — the
      Derivative secant and the one-parameter tangent, 2 to 2.5px — carry no
      label between them that is not already clamped by `panelLabel`.

   The `optimizer` picker (SGD / momentum / Adam, 05-4's table) is a later
   round and unmeasured. The catalogue says not to add it before it is.
   ========================================================================= */

import { defineWidget, makePlot, fmt, mathmlRenders } from "../core/index.js";
import {
  N, EPOCHS, LR_LADDER, BATCHES, LOG_CAP, LEVELS,
  makeData, standardize, quad, domainFor, sliceWindow, contourSegments, isoSegments,
  COORD, lossAlong,
  descendFull, descendMini, descendOne, posAt, stepAngle,
  projector, reliefMesh, reliefPoint, reliefLift, reliefHidden,
  lossField, valueField, valueRamp,
  RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL,
  gradFn, A_RANGE, B_RANGE, Y_RANGE, Y_LEVELS, NUDGES,
  beatMs, choreographs, epochMs,
} from "./model.js";

/* ---- geometry ------------------------------------------------------------ */

const PAD_L = 52;         // a rotated y-axis label plus its tick numbers
const PAD_R = 14;
const TOP = 30;           // the caption line above the top row of panels
const SURF_GUTTER = 56;   // between the data panel and the surface's own y axis
const LOSS_H = 70;

/* The surface has to be SQUARE — it is a window on the parameter plane and a
   path across it should not be sheared by the panel's aspect — so the data
   panel takes whatever the width leaves. */
const surfSide = (w) =>
  Math.round(Math.max(180, Math.min(300, (w - PAD_L - PAD_R - SURF_GUTTER) * 0.46)));

/* ONE HEIGHT FOR ALL THREE TABS, and for both Descent pages. Both Descent pages
   now draw the same two panels (decision 11), so the loss strip lands on the
   same y by construction rather than by arithmetic, and the two concept panels
   are sized to end where the strip's axis label does — so moving between tabs
   or pages moves the rail and nothing else (3.4).

   side + 258, not + 240: the angle line took a line box of its own under the
   two-parameter map (decision 7) and every page reserves it. */
const stageHeight = (w) => surfSide(w) + 258;

/* THE PARTIAL DERIVATIVES TAB HAS ITS OWN SQUARE, and it is deliberately not
   the loss surface's (decision 8). `surfSide` is what the width leaves once a
   data panel has been fed; this tab has no data panel and no loss strip, so
   the height is the tab's to take, and the map takes it. Two things bound it:

     the STAGE, less the colour bar's own two lines — 46px of air under the
       panel, 8 of bar and 13 to the labels' baseline — and the 14px tail that
       puts those labels on the Derivative tab's own bottom line;
     the WIDTH left beside the two slices, which is what binds at 550 and
       690; the height binds at 770.

   The slice column floors at 200px, and that number is measured rather than
   round: over the whole (a, b) window a slice's widest caption is 119px and
   its widest note 52, and core drops a note inside the panel when the two come
   within 14px of each other. At 200 the tightest they ever come is 30px, so
   the caption and its note keep the one line they have today. */
const SLICE_MIN = 200;
const partSide = (w) => {
  const usable = w - PAD_L - PAD_R - SURF_GUTTER;
  const tall = stageHeight(w) - TOP - 67 - 14;
  return Math.round(Math.max(surfSide(w), Math.min(tall, usable - SLICE_MIN)));
};

function layout(w) {
  const side = surfSide(w);
  const full = w - PAD_L - PAD_R;
  const left = w - PAD_L - PAD_R - SURF_GUTTER - side;
  /* The two slices of the Partial derivatives tab stack beside its own map and
     are together as tall as it is: 30px for each one's ticks and axis label,
     24 for the lower one's caption. */
  const pside = partSide(w);
  const pcol = full - SURF_GUTTER - pside;
  const sliceH = Math.max(60, Math.round((pside - 54) / 2));
  return {
    side,
    /* BOTH DESCENT PAGES USE THESE TWO (decision 11): the data with the line at
       this epoch on the left, and a square on the right holding either the loss
       surface over (b₀, b₁) or the loss along the one coordinate that descends.
       The one-parameter page used to take the whole width for its parabola,
       which left it with no picture of what the parameter it was moving DOES. */
    data: { x: PAD_L, y: TOP, w: left, h: side },
    surf: { x: w - PAD_R - side, y: TOP, w: side, h: side },
    strip: { x: PAD_L, y: TOP + side + 122, w: full, h: LOSS_H },
    regimeY: TOP + side + 60,   // the one-parameter page's line naming the regime
    phaseY: TOP + side + 78,    // what this beat of a Slow step is doing
    angleY: TOP + side + 96,    // where the step points, against the straight line
    /* The Derivative tab: one panel over the whole width, with one line under
       it, ending where the strip's own axis label ends on Descent. */
    curve: { x: PAD_L, y: TOP, w: full, h: stageHeight(w) - TOP - 60 },
    curveY: TOP + (stageHeight(w) - TOP - 60) + 46,
    /* The Partial derivatives tab: the map on the right, as the loss surface
       is, but sized to the stage rather than to what a data panel leaves; the
       two slices stacked in the column beside it. */
    partMap: { x: w - PAD_R - pside, y: TOP, w: pside, h: pside },
    partA: { x: PAD_L, y: TOP, w: pcol, h: sliceH },
    partB: { x: PAD_L, y: TOP + pside - sliceH, w: pcol, h: sliceH },
  };
}

/* One choreographed beat, in shares of the clock `model.js` holds — 2 s at Slow
   over the surface, 2.5 / 1.2 / 0.4 s on the one-parameter and Derivative
   pages, which choreograph at every speed (decision 6). Two-parameter page: the
   partials appear, the direction composes, the point moves. One-parameter page:
   the tangent and the gradient vector hold at the point, then the step. The
   move phase interpolates along the stored update indices, so at batch 10 or 1
   the epoch's ten or hundred updates are drawn as they happen rather than as
   one jump.

   `hold` REPLACED A GROWTH RAMP (decision 7). The tangent used to grow from its
   centre over the first 45% of every epoch; it is now always at full length,
   and the first 40% is a pause at the point with the arrow and its number. */
const BEATS_TWO = { partials: 0.34, direction: 0.55 };
const BEATS_ONE = { hold: 0.4 };
const BEATS_NUDGE = { hold: 0.35 };

/* Choreography A's ease: the point leaves slowly, crosses quickly and settles.
   Picked live against four alternatives in `_lab/gd-round5.html` §2. The
   Derivative tab's shrinking nudge uses it for the same reason — the ends of
   the move are where the reader is reading the numbers. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2);

const ARROW = 30;         // the composed direction's fixed length, in pixels
/* How far off the point a component tick's LABEL is held when the tick itself
   is shorter than that. Decision 8: at 14px the two labels' boxes cannot meet
   each other or the ringed dot at any step the walk takes. */
const TICK_LABEL_OFF = 14;
const Y_DOM = [0, 30];    // y = 5 + 2x + N(0, 1) over x in [0, 10], both scales

/* The strip's two ratchets: nice steps, upward only (2.5). */
const X_LADDER = [10, 25, 50, 100, 250, 500, 1000];
const Y_LADDER = [1, 2, 3, 4, 6];

/* ---- formatting ---------------------------------------------------------- */

/* Gradients run from ~200 at the start to ~1e-5 in the trench, so a fixed
   number of decimals prints either 0.00 or nine digits nobody reads. */
const fSig = (v) => (v === 0 ? "0" : Number(v.toPrecision(3)).toString());
const f1 = (v) => fmt(v, 1);
const f2 = (v) => fmt(v, 2);
const f3 = (v) => fmt(v, 3);
const xTimes = (r) => (r >= 100 ? `${Math.round(r)}×` : `${fmt(r, r >= 10 ? 1 : 3)}×`);

/* THE ONE-PARAMETER PAGE'S LOSS TICKS, PAST A MILLION. Its window ratchets
   (decision 10), and the loss at the edge quadruples every time the half-width
   doubles: at the top rung a raw-x tick is eight digits, and the 44px between
   the axis and the panel holds six. So past a million the ticks read as powers
   of ten, which is what a number that size is anyway. Below it they are the
   plain digits `makePlot` writes by default. */
const bigTick = (v) => {
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  return `${Number((v / 10 ** e).toFixed(1))}e${e}`;
};

/* A batch of one is one row, and one update is not "1 updates". */
const nRows = (b) => (b === 1 ? "one row" : `${b} rows`);
const nUpdates = (b) => (N / b === 1 ? "one update" : `${N / b} updates`);
/* What one epoch is made of, in one phrase, so the standing line and the Slow
   step's third beat cannot describe the same thing two ways. */
const epochPhrase = (b) => (b >= N
  ? "one update, over all 100 rows"
  : b === 1
    ? `${N} updates, one row at a time`
    : `${N / b} updates, each over its own ${b} rows`);

/* ---- the colour ramp and the surface bitmap ------------------------------ */

/* Split from `hexLerp` for the relief, which needs the three channels back so
   it can multiply them by a face's shade. */
const mixRGB = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
};

const hexLerp = (a, b, t) => {
  const c = mixRGB(a, b, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/* Where a loss ratio sits on the ramp, 0 at the least loss and 1 at the cap.
   The relief takes its HEIGHT from the same number, so colour and height say
   the same thing and the contour rings land at equal heights. */
const rampT = (ratio) => Math.max(0, Math.min(1, Math.log10(Math.max(1, ratio)) / LOG_CAP));

const ramp = (ratio, colors) => hexLerp(colors.costLow, colors.costHigh, rampT(ratio));

/* Painted once per size, theme and dataset, then blitted every frame — widget
   27's cache, with the contour lines baked in because they move only when the
   surface does. ~20k O(1) loss evaluations and 45k marching-squares cells is
   affordable once and not sixty times a second. */
let surfCache = null;
function surfaceBitmap(wpx, hpx, dpr, colors, state) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${state.sig}`;
  if (surfCache && surfCache.key === key) return surfCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const { q, dom } = state;
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const b0 = dom.b0[0] + (px / wpx) * (dom.b0[1] - dom.b0[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const b1 = dom.b1[1] - (py / hpx) * (dom.b1[1] - dom.b1[0]);
      c.fillStyle = ramp(q.loss(b0, b1) / q.Lmin, colors);
      c.fillRect(px, py, CELL, CELL);
    }
  }
  const bx = (v) => ((v - dom.b0[0]) / (dom.b0[1] - dom.b0[0])) * wpx;
  const by = (v) => hpx - ((v - dom.b1[0]) / (dom.b1[1] - dom.b1[0])) * hpx;
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.55;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of state.contours) {
    c.moveTo(bx(ax), by(ay));
    c.lineTo(bx(zx), by(zy));
  }
  c.stroke();
  surfCache = { key, canvas: cv };
  return cv;
}

/* ---- small drawing helpers ----------------------------------------------- */

function label(ctx, colors, s, x, y, { color, align = "left", size } = {}) {
  ctx.save();
  ctx.fillStyle = color ?? colors.ink3;
  ctx.font = `${size ?? colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* A label that cannot leave the panel it belongs to. Measured with the font
   `label` is about to set, so the two cannot disagree, and then the ANCHOR is
   moved by that width: clamping the anchor alone is not enough, since a
   left-aligned label one pixel inside the right edge still hangs its whole box
   out — which is what a box sweep at 550px caught on the gradient's number.
   One function because three panels now want it (5.8). */
function panelLabel(ctx, colors, rect, s, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.size ?? colors.fsXs} ${colors.font}`;
  const tw = ctx.measureText(s).width;
  ctx.restore();
  const left = opts.align === "right" ? x - tw : opts.align === "center" ? x - tw / 2 : x;
  label(ctx, colors, s,
    Math.max(rect.x + 4, Math.min(rect.x + rect.w - 4 - tw, left)),
    Math.max(rect.y + 12, Math.min(rect.y + rect.h - 4, y)),
    { color: opts.color, size: opts.size });
}

function arrow(ctx, x0, y0, x1, y1, color, width = 2, dash = null) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* A SLOPE THAT LIES ON A CURVE, CASED (decision 12). Every tangent and secant
   in this widget is drawn on top of the thing it is a slope OF — the parabola,
   the function, the surface — so its contrast against that mark is what decides
   whether it can be read, and no hue in the ramp clears every surface this
   widget paints. The halo is the page's own ground, 3px wider than the line,
   which separates it from a curve of any colour without spending a second hue.

   ONE FUNCTION, because seven call sites want it (5.8): the Derivative tab's
   secant and its dashed tangent, the one-parameter page's tangent, the two
   slice panels' tangents, and the two tangents on each of the two reliefs. The
   mock (`_lab/gd-colour.html`) is where the pair of widths was picked.

   THE ALPHA IS ON THE LINE AND NOT ON THE CASING. The Derivative tab's tangent
   is held back so the secant reads over it; fading the halo with it would let
   the curve back through, which is the one thing the halo is for.

   `SLICE_CASING` below is the same idea at a different scale and stays its own
   thing: that one cases a whole sampled curve on the relief, in segments, and
   is drawn by `strokeSegments`. */
const SLOPE_W = 2.5;
const SLOPE_CASE = 3;

/* No `color` argument: every slope in this widget is --c-slope, and a hue
   parameter with one caller passing nothing is an invitation to make a second
   one. `strokeSegments` takes one because its two slice curves genuinely
   differ. */
function slopeLine(ctx, colors, x0, y0, x1, y1, opts = {}) {
  const { width = SLOPE_W, dash = null, alpha = 1 } = opts;
  ctx.save();
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = width + SLOPE_CASE;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colors.slope;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/* The travelling dot, widget 27's: a filled mark with a heavy surface ring,
   because it lands on the trench's own cost-low blue and the ring is what
   separates them. */
function ringedDot(ctx, colors, px, py) {
  ctx.save();
  ctx.fillStyle = colors.highlight;
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/* The path so far. Strided: at batch 1 a finished walk is 100k positions, and
   a polyline of 100k segments per frame buys nothing a 1500-segment one does
   not already show. The final point is always included. */
function drawPath(ctx, colors, sx, sy, track, upto, cur) {
  if (upto < 1) return;
  const stride = Math.max(1, Math.ceil(upto / 1500));
  ctx.save();
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx(track.b0[0]), sy(track.b1[0]));
  for (let k = stride; k <= upto; k += stride) ctx.lineTo(sx(track.b0[k]), sy(track.b1[k]));
  ctx.lineTo(sx(cur[0]), sy(cur[1]));
  ctx.stroke();
  /* The opening epochs as separate marks while they can still be counted
     (2.3): on the raw surface the first three cross most of the frame and the
     rest crawl, and one polyline hides that they were three moves. */
  ctx.fillStyle = colors.ink1;
  for (let k = 0; k <= Math.min(upto, 5); k += 1) {
    ctx.beginPath();
    ctx.arc(sx(track.b0[k]), sy(track.b1[k]), 2.2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/* ---- the panels ---------------------------------------------------------- */

function drawData(ctx, colors, rect, state, cur, scale) {
  const { q } = state;
  const lo = Math.min(...q.xs);
  const hi = Math.max(...q.xs);
  const pad = (hi - lo) * 0.04;
  const plot = makePlot({
    ctx, colors, rect, xDomain: [lo - pad, hi + pad], yDomain: Y_DOM,
  });
  plot.caption("the line at this epoch");
  plot.note(`${N} rows`);
  plot.axisX({ label: scale === "raw" ? "x" : "x, standardized" });
  plot.axisY({ label: "y" });

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = colors.unknown;
  for (let i = 0; i < q.n; i += 1) {
    ctx.beginPath();
    ctx.arc(plot.sx(q.xs[i]), plot.sy(q.y[i]), 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const line = (b0, b1, stroke, width, dash) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(plot.sx(lo), plot.sy(b0 + b1 * lo));
    ctx.lineTo(plot.sx(hi), plot.sy(b0 + b1 * hi));
    ctx.stroke();
    ctx.restore();
  };
  line(q.B0, q.B1, colors.reference, 1.5, [6, 4]);
  line(cur[0], cur[1], colors.highlight, 2.5);
  ctx.restore();
}

/* The colour bar, in place of any sentence about the ramp: the ends shown
   rather than said. Both maps in this widget use it — the loss surface's log
   ratios and the Partial derivatives tab's y — so the ends and the middle line
   are the caller's. */
function drawColourBar(ctx, colors, rect, { low, high, left, right, middle }) {
  const bar = { x: rect.x, y: rect.y + rect.h + 46, w: rect.w, h: 8 };
  const STEPS = 48;
  for (let i = 0; i < STEPS; i += 1) {
    ctx.fillStyle = hexLerp(low, high, i / (STEPS - 1));
    ctx.fillRect(bar.x + (i / STEPS) * bar.w, bar.y, bar.w / STEPS + 1, bar.h);
  }
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
  label(ctx, colors, left, bar.x, bar.y + bar.h + 13);
  label(ctx, colors, right, bar.x + bar.w, bar.y + bar.h + 13, { align: "right" });
  if (bar.w >= 230) {
    label(ctx, colors, middle, bar.x + bar.w / 2, bar.y + bar.h + 13, { align: "center" });
  }
}

function drawSurface(ctx, colors, rect, state, cur, opts) {
  const { q, dom, track } = state;
  const plot = makePlot({ ctx, colors, rect, xDomain: dom.b0, yDomain: dom.b1 });
  plot.caption("the loss over every (b₀, b₁)");
  /* The frame is fixed (2.5), so a walk can leave it — and at raw x with a
     learning rate just past the boundary it leaves LONG before it trips the
     divergence test, which is a real state the figure has to name rather than
     leave as an empty panel. */
  const held = cur[0] > dom.b0[0] && cur[0] < dom.b0[1]
    && cur[1] > dom.b1[0] && cur[1] < dom.b1[1];
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (!held) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: "intercept b₀" });
  plot.axisY({ label: "slope b₁" });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    surfaceBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, state),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  /* THE STRAIGHT LINE TO THE MINIMUM (decision 7), under the path so the walk
     reads over it. Faint and dashed: it is not a route anything takes — it is
     the route the reader expects the step to take, and the angle line under the
     panel says how far from it the step actually goes. Drawn only while there
     is a disagreement to see, so it disappears as the walk arrives rather than
     collapsing to a dot on the cross. */
  if (held && opts.showStep && !opts.arrived) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = colors.extreme;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.sx(cur[0]), plot.sy(cur[1]));
    ctx.lineTo(plot.sx(q.B0), plot.sy(q.B1));
    ctx.stroke();
    ctx.restore();
  }
  drawPath(ctx, colors, plot.sx, plot.sy, track, opts.upto, cur);
  /* The minimum is crossed only once the walk is within 1% of the least loss:
     the widget does not open on its own answer (2.1). */
  if (opts.arrived) {
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    const mx = plot.sx(q.B0);
    const my = plot.sy(q.B1);
    ctx.beginPath();
    ctx.moveTo(mx - 7, my);
    ctx.lineTo(mx + 7, my);
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx, my + 7);
    ctx.stroke();
  }
  ctx.restore();

  if (!held) return;
  const px = plot.sx(cur[0]);
  const py = plot.sy(cur[1]);
  ringedDot(ctx, colors, px, py);

  /* THE STEP, DRAWN AS TWO COMPONENTS AND THEIR COMPOSITION (§2 C). The
     direction is the screen delta of a unit-time step normalised to a fixed
     length, so it points where the dot actually goes at this panel's aspect;
     the ticks are that vector's x and y parts, so tick + tick = arrow exactly,
     and each carries its own partial's value.

     THE ARROW IS --c-slope AND THE TWO TICKS STAY INK (decision 12). The arrow
     is the rate of change this figure is about; the ticks are the arithmetic it
     is built from, and a component of a vector is not a slope of anything. */
  if (!opts.showStep) return;
  const [g0, g1] = opts.grad;
  const dx = plot.sx(cur[0] - g0) - px;
  const dy = plot.sy(cur[1] - g1) - py;
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || !Number.isFinite(len)) return;
  const ex = (ARROW * dx) / len;
  const ey = (ARROW * dy) / len;
  const t = opts.tickMix;
  if (t > 0) {
    /* A component the step barely has is a bare arrowhead sitting on the dot,
       so it is drawn only once it is long enough to read as a tick. */
    if (Math.abs(ex * t) > 3) arrow(ctx, px, py, px + ex * t, py, colors.ink1, 1.5, [3, 3]);
    if (Math.abs(ey * t) > 3) arrow(ctx, px, py, px, py + ey * t, colors.ink1, 1.5, [3, 3]);
    /* EACH LABEL IS HELD OFF THE POINT, AND THE TWO TAKE OPPOSITE SIDES OF IT
       (decision 8). Anchored at the tick ENDS, as they were, the two run into
       each other wherever both components are small — 3.4px of overlap at
       every width from epoch 5 of the lesson's own walk, and up to 9.5px
       elsewhere on it, because a tick 2px long puts its label on the dot and
       the other label is already there.

       So each is anchored at its tick's end OR at `TICK_LABEL_OFF` from the
       point, whichever is further out, and then the b₀ label takes the row
       OPPOSITE the side the b₁ label went to. That makes the clearances
       arithmetic rather than luck: the two baselines are at least 34px apart in
       either case, and neither box can reach the ringed dot — b₀'s is at least
       19px clear of it horizontally whatever the y, b₁'s at least 18px clear
       vertically whatever the x. */
    const sx0 = ex < 0 ? -1 : 1;
    const sy1 = ey < 0 ? -1 : 1;
    const endX = px + (Math.abs(ex * t) > TICK_LABEL_OFF ? ex * t : sx0 * TICK_LABEL_OFF);
    const endY = py + (Math.abs(ey * t) > TICK_LABEL_OFF ? ey * t : sy1 * TICK_LABEL_OFF);
    label(ctx, colors, `∂L/∂b₀ ${fSig(g0)}`, endX + sx0 * 5, py + (sy1 < 0 ? 13 : -9),
      { align: sx0 < 0 ? "right" : "left", color: colors.ink1 });
    label(ctx, colors, `∂L/∂b₁ ${fSig(g1)}`, px + 8, endY + (sy1 < 0 ? -7 : 13),
      { color: colors.ink1 });
  }
  if (opts.arrowMix > 0) {
    arrow(ctx, px, py, px + ex * opts.arrowMix, py + ey * opts.arrowMix, colors.slope, SLOPE_W);
  }
}

/* ---- the surface in relief -----------------------------------------------
   The same window, the same colours, the same walk, with the loss as HEIGHT as
   well as colour. The geometry is in `model.js` so it can be asserted without
   a DOM; what is here is the painting and the two caches decision 4 records. */

const DOWNHILL = 0.1;      // the composed arrow's length, in normalised domain units
const TANGENT_HALF = 0.2;  // each partial's chord, ± this share of the domain (the mock's)

/* THE HIDDEN-LINE CONVENTION, WRITTEN ONCE (5.8). Both reliefs draw a line that
   runs over a surface and behind it — the walk on Descent, the two slices on
   the Partial derivatives tab — and two copies of "dashed, faint, thinner" is
   two chances for one of them to drift into a different reading of the same
   fact. */
/* How far along its own tangent a partial's label is anchored, measured from
   the point. Not 1: at the end itself the label lands on the panel's rim, where
   the two axis names sit, and a box sweep over seven viewpoints found it
   printing through them in 116 states of 2079. At 0.7 that is 0. */
const LABEL_ALONG = 0.7;

const HIDDEN_LINE = { dash: [3, 4], alpha: 0.55, width: 1.2 };
const VISIBLE_LINE = { dash: [], alpha: 1, width: 1.5 };
/* What goes under a coloured slice curve on the Partial derivatives relief, in
   the page's own ground: --c-group-a and --c-value-low are the same --series-1
   blue, so without it the a-slice disappears wherever y is most negative. */
const SLICE_CASING = { dash: [], alpha: 0.85, width: 3.5 };

function strokeSegments(ctx, colors, list, { dash, alpha, width }, color) {
  if (!list.length) return;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color ?? colors.ink1;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [a, b] of list) {
    ctx.moveTo(a.X, a.Y);
    ctx.lineTo(b.X, b.Y);
  }
  ctx.stroke();
  ctx.restore();
}

/* The mesh, painted once per size, theme, dataset and VIEWPOINT — the map's own
   cache, on the other side of the same panel. The contour rings are baked in
   with it: lifted onto the surface, they move only when the surface does. They
   are painted over the whole mesh rather than hidden-line tested, so a ring on
   the far wall can show through the near one; at the default 300/35 the trench
   runs away from the reader and the far wall is a sliver.

   ONE SLOT, and a drag therefore misses it on every frame and repaints all 1936
   quads. Measured at ~2 ms, which a gesture can afford; a ring buffer of
   viewpoints would spend memory to save nothing, since a turn never comes back
   to the exact degree it left. What the key still does is keep the mesh OUT of
   the frame budget for everything the surface does not depend on — the learning
   rate, the batch and the epoch move the walk over a mesh already painted. */
let meshCache = null;
function reliefBitmap(wpx, hpx, dpr, colors, state, az, el) {
  const key = `${wpx}x${hpx}:${colors.costLow}:${colors.costHigh}:${colors.surface}:${state.sig}:${az}:${el}`;
  if (meshCache && meshCache.key === key) return meshCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const { q, dom } = state;
  const project = projector({ x: 0, y: 0, w: wpx, h: hpx }, az, el);
  c.lineWidth = 0.5 * dpr;
  const field = lossField(q);
  for (const face of reliefMesh(field, dom.b0, dom.b1, project)) {
    c.beginPath();
    face.pts.forEach((p, k) => (k ? c.lineTo(p.X, p.Y) : c.moveTo(p.X, p.Y)));
    c.closePath();
    const rgb = mixRGB(colors.costLow, colors.costHigh, face.t);
    c.fillStyle = `rgb(${rgb.map((v) => Math.round(v * face.shade)).join(", ")})`;
    c.fill();
    /* A hairline of the page's own ground between faces: filled edge to edge
       the quads seam, and the mesh reads as noise rather than as a surface. */
    c.strokeStyle = colors.surface;
    c.globalAlpha = 0.18;
    c.stroke();
    c.globalAlpha = 1;
  }
  const lift = (b0, b1) => project(...reliefPoint(field, dom.b0, dom.b1, b0, b1));
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.6;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [ax, ay, zx, zy] of state.contours) {
    const a = lift(ax, ay);
    const b = lift(zx, zy);
    c.moveTo(a.X, a.Y);
    c.lineTo(b.X, b.Y);
  }
  c.stroke();
  meshCache = { key, canvas: cv };
  return cv;
}

/* The path, sampled once and classified once (decision 4). The hidden test is
   a ray march per piece — far too much per frame — so the split is cached on
   the walk AND the viewpoint, which are between them everything it depends on:
   ~1 ms for 1500 pieces on the lesson's own walk, 2.6 ms for the 100 000
   positions batch 1 leaves. Held here rather than in `compute()` so a walk
   nobody looks at in relief never pays for it, and so a turn of the camera pays
   only the march and not the descent.

   A piece outside the frame is dropped rather than clipped: off the domain
   there is no surface to lie on, and the projection would lay it on the ground
   plane's continuation. The panel says "off the frame" instead. */
let piecesCache = null;
function reliefPieces(state, az, el) {
  const key = `${state.walkSig}:${az}:${el}`;
  if (piecesCache && piecesCache.key === key) return piecesCache.pieces;
  const { q, dom, track } = state;
  const field = lossField(q);
  const last = track.len - 1;
  const w0 = dom.b0[1] - dom.b0[0];
  const w1 = dom.b1[1] - dom.b1[0];
  const dense = Math.min(last, 300);
  const idx = [];
  for (let k = 0; k <= dense; k += 1) idx.push(k);
  const stride = Math.max(1, Math.ceil((last - dense) / 1200));
  for (let k = dense + stride; k <= last; k += stride) idx.push(k);
  if (idx[idx.length - 1] !== last) idx.push(last);

  const inside = (b0, b1) => b0 > dom.b0[0] && b0 < dom.b0[1] && b1 > dom.b1[0] && b1 < dom.b1[1];
  const pieces = [];
  for (let i = 1; i < idx.length; i += 1) {
    const ka = idx[i - 1];
    const kb = idx[i];
    const d0 = track.b0[kb] - track.b0[ka];
    const d1 = track.b1[kb] - track.b1[ka];
    /* A long move is split so it can be part hidden: the opening epochs of a
       raw walk cross most of the frame in one step. */
    const sub = Math.max(1, Math.min(8, Math.ceil(Math.hypot(d0 / w0, d1 / w1) / 0.03)));
    for (let s = 0; s < sub; s += 1) {
      const a = [track.b0[ka] + (d0 * s) / sub, track.b1[ka] + (d1 * s) / sub];
      const b = [track.b0[ka] + (d0 * (s + 1)) / sub, track.b1[ka] + (d1 * (s + 1)) / sub];
      const m0 = (a[0] + b[0]) / 2;
      const m1 = (a[1] + b[1]) / 2;
      const held = inside(a[0], a[1]) && inside(b[0], b[1]);
      pieces.push({ end: kb, a, b, held, hidden: held && reliefHidden(field, dom.b0, dom.b1, m0, m1, az, el) });
    }
  }
  piecesCache = { key, pieces };
  return pieces;
}

function drawRelief(ctx, colors, rect, state, cur, opts) {
  const { q, dom, track } = state;
  const plot = makePlot({ ctx, colors, rect, xDomain: dom.b0, yDomain: dom.b1 });
  plot.caption("the loss as height over every (b₀, b₁)");
  const held = cur[0] > dom.b0[0] && cur[0] < dom.b0[1]
    && cur[1] > dom.b1[0] && cur[1] < dom.b1[1];
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (!held) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  /* No axisX/axisY: a projected surface has no rectilinear axes to hang ticks
     on, so b₀ and b₁ are named along the two edges nearest the reader. */

  const { az, el } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    reliefBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, state, az, el),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const project = projector(rect, az, el);
  const field = lossField(q);
  const pt = (b0, b1) => project(...reliefPoint(field, dom.b0, dom.b1, b0, b1));

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* The path: solid where the surface leaves it in view, dashed and faint
     where the surface is in front of it — the drawing convention for a hidden
     line, and the one treatment of the three mocked that leaves the mesh
     reading as a surface. */
  const shown = [];
  const buried = [];
  let tail = null;
  for (const pc of reliefPieces(state, az, el)) {
    if (pc.end > opts.upto) break;
    if (!pc.held) {
      tail = null;
      continue;
    }
    (pc.hidden ? buried : shown).push([pt(pc.a[0], pc.a[1]), pt(pc.b[0], pc.b[1])]);
    tail = pc.b;
  }
  /* The leading edge, from the last sampled position to where the walk stands.
     One ray march a frame, which is what the sampled pieces cost together. */
  if (tail && held) {
    const seg = [pt(tail[0], tail[1]), pt(cur[0], cur[1])];
    const mid = reliefHidden(field, dom.b0, dom.b1, (tail[0] + cur[0]) / 2, (tail[1] + cur[1]) / 2, az, el);
    (mid ? buried : shown).push(seg);
  }
  strokeSegments(ctx, colors, buried, HIDDEN_LINE);
  strokeSegments(ctx, colors, shown, VISIBLE_LINE);

  /* The opening epochs as separate marks while they can still be counted
     (2.3), exactly as the map draws them. */
  ctx.fillStyle = colors.ink1;
  for (let k = 0; k <= Math.min(opts.upto, 5); k += 1) {
    const p = pt(track.b0[k], track.b1[k]);
    ctx.beginPath();
    ctx.arc(p.X, p.Y, 2.2, 0, 2 * Math.PI);
    ctx.fill();
  }

  /* The minimum, crossed on the floor once the walk has arrived — the same
     rule as the map, so the widget does not open on its own answer (2.1). */
  if (opts.arrived) {
    const m = pt(q.B0, q.B1);
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.X - 7, m.Y);
    ctx.lineTo(m.X + 7, m.Y);
    ctx.moveTo(m.X, m.Y - 7);
    ctx.lineTo(m.X, m.Y + 7);
    ctx.stroke();
  }

  if (held) {
    const c = pt(cur[0], cur[1]);
    if (opts.showStep) drawTangents(ctx, colors, pt, dom, c, cur, opts);
    ringedDot(ctx, colors, c.X, c.Y);
  }
  ctx.restore();

  nameEdges(ctx, colors, pt, dom.b0, dom.b1, ["b₀", "b₁"]);
}

/* The two axes named along the edges the viewpoint puts nearest the reader,
   chosen by depth rather than fixed, so the naming survives a change of
   viewpoint — which the drag exercises on every frame, and which is why the
   two names swap edges as the surface comes round. Drawn outside the panel's
   clip: at some viewpoints an edge's midpoint sits on the border. Shared by
   both reliefs, which differ only in what the two axes are called.

   IT HANDS BACK THE TWO BOXES IT PAINTED, because the Partial derivatives tab
   has to place two more labels on the same panel and these are the ones they
   can collide with. */
function nameEdges(ctx, colors, pt, xDom, yDom, names) {
  const nearer = (u, v) => (pt(u[0], u[1]).depth <= pt(v[0], v[1]).depth ? u : v);
  const midX = (xDom[0] + xDom[1]) / 2;
  const midY = (yDom[0] + yDom[1]) / 2;
  const centre = pt(midX, midY);
  const boxes = [];
  for (const [name, at] of [
    [names[0], nearer([midX, yDom[0]], [midX, yDom[1]])],
    [names[1], nearer([xDom[0], midY], [xDom[1], midY])],
  ]) {
    const p = pt(at[0], at[1]);
    const dx = p.X - centre.X;
    const dy = p.Y - centre.Y;
    const len = Math.hypot(dx, dy) || 1;
    const x = p.X + (18 * dx) / len;
    const y = p.Y + (18 * dy) / len + 4;
    const align = dx < -2 ? "right" : dx > 2 ? "left" : "center";
    label(ctx, colors, name, x, y, { align });
    ctx.save();
    ctx.font = `${colors.fsXs} ${colors.font}`;
    const w = ctx.measureText(name).width;
    ctx.restore();
    boxes.push({ left: align === "right" ? x - w : align === "center" ? x - w / 2 : x, w, y });
  }
  return boxes.map((b) => ({ ...b, right: b.left + b.w }));
}

/* THE PARTIALS AS TANGENT SEGMENTS on the surface, which is what a partial
   derivative is: the slope along one axis with the other held. Each is the
   surface's own chord between ±0.2 of the domain, so it lies on the surface
   rather than floating over it, and carries its number. These replace the
   map's component ticks while the relief is on.

   THE COMPOSED DIRECTION IS BUILT IN NORMALISED PARAMETER SPACE, where the two
   axes are the same size — the relief's own coordinates. Scaling (−g₀, −g₁) by
   each axis's span instead, as the mock did, points the arrow the wrong way
   when the spans differ (raw x: 10.2 against 4.0), which is decision 1's trap
   in the relief's coordinates.

   BOTH TANGENTS AND THE ARROW ARE --c-slope (decision 12), where the two were
   ink and dashed. They are tangents, and a tangent is one colour everywhere in
   this widget; they lie on a mesh that runs blue to red, so the two lines are
   cased and only the arrowhead is not. Their labels follow the mark. */
function drawTangents(ctx, colors, pt, dom, c, cur, opts) {
  const [g0, g1] = opts.grad;
  const w0 = dom.b0[1] - dom.b0[0];
  const w1 = dom.b1[1] - dom.b1[0];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const chord = (a0, a1, b0, b1) => {
    const a = pt(clamp(a0, dom.b0[0], dom.b0[1]), clamp(a1, dom.b1[0], dom.b1[1]));
    const b = pt(clamp(b0, dom.b0[0], dom.b0[1]), clamp(b1, dom.b1[0], dom.b1[1]));
    slopeLine(ctx, colors, a.X, a.Y, b.X, b.Y, { dash: [3, 3] });
    return b;
  };
  const t = opts.tickMix;
  if (t > 0) {
    const d0 = w0 * TANGENT_HALF * t;
    const d1 = w1 * TANGENT_HALF * t;
    const e0 = chord(cur[0] + d0, cur[1], cur[0] - d0, cur[1]);
    const e1 = chord(cur[0], cur[1] - d1, cur[0], cur[1] + d1);
    label(ctx, colors, `∂L/∂b₀ ${fSig(g0)}`, e0.X - 4, e0.Y - 5,
      { align: "right", color: colors.slope });
    label(ctx, colors, `∂L/∂b₁ ${fSig(g1)}`, e1.X + 4, e1.Y + 13, { color: colors.slope });
  }
  if (opts.arrowMix > 0) {
    const du = -g0 / w0;
    const dv = -g1 / w1;
    const len = Math.hypot(du, dv);
    if (!(len > 0) || !Number.isFinite(len)) return;
    const f = (DOWNHILL * opts.arrowMix) / len;
    const e = pt(
      clamp(cur[0] + du * f * w0, dom.b0[0], dom.b0[1]),
      clamp(cur[1] + dv * f * w1, dom.b1[0], dom.b1[1]),
    );
    if (Math.hypot(e.X - c.X, e.Y - c.Y) > 3) arrow(ctx, c.X, c.Y, e.X, e.Y, colors.slope, SLOPE_W);
  }
}

/* WHAT EACH COORDINATE IS CALLED, wherever the one-parameter page names it —
   the caption, the x axis, the arrow's label, the beat line, the regime line,
   the readout tiles, the legend and the formula card's one row.
   One table, because nine strings agreeing by hand is nine chances for one of
   them to keep saying b₁ after the reader has chosen b₀ (5.8). `model.js`'s
   `COORD` is the same pair said structurally: which slot moves, which is held.
   The two are keyed alike and read together. */
const ONE = {
  b1: { symbol: "b₁", other: "b₀", axis: "slope b₁", partial: "∂L/∂b₁" },
  b0: { symbol: "b₀", other: "b₁", axis: "intercept b₀", partial: "∂L/∂b₀" },
};

/* The one-parameter page: the loss along the coordinate that descends, with the
   other held at its fitted value, the tangent at the current point, and the
   steps taken so far. Since decision 11 it shares the two-parameter page's
   composition — the data on the left, this square on the right.

   THE WINDOW RATCHETS (decision 10). It is symmetric about the chosen
   coordinate's least-squares value, with a half-width off `model.js`'s doubling
   ladder — the smallest rung that holds every position revealed so far — and
   the loss axis is the loss at that window's own edge, rounded up. So the
   parabola keeps its shape at every rung while the numbers explode, which is
   what lets an oscillation that grows by five a step be watched for several
   epochs instead of leaving on the first. */
function drawSlice(ctx, colors, rect, state, cur, opts) {
  const { q, track } = state;
  const C = COORD[opts.which];
  const nm = ONE[opts.which];
  const here = cur[C.i];
  const win = sliceWindow(q, track, opts.upto, here, opts.which);
  const range = win.dom;
  const f = lossAlong(q, opts.which);
  const pts = [];
  for (let k = 0; k <= 160; k += 1) {
    const v = range[0] + (k / 160) * (range[1] - range[0]);
    pts.push([v, f(v)]);
  }
  const plot = makePlot({ ctx, colors, rect, xDomain: range, yDomain: [0, win.top] });
  /* The curvature rides in the CAPTION, not the note: the note slot is where
     the panel says what state the walk is in, and on this page the interesting
     states are "diverged" and "past the edge of the frame".

     THE HELD VALUE CAME OFF IT with decision 11. The panel is a square of
     197px at the narrowest now, where it used to have the whole width, and
     "the loss over b₁, b₀ held at 5.09, curvature 67.0" is 250px of caption.
     What the reader loses nothing by moving is the held number, which the
     readout tile beneath states in full; what has to stay is the curvature,
     because the contrast between 67 along b₁ and 2 along b₀ is the choice's
     whole point. The curvature is rounded for the same reason — `fSig` gives
     67 and 2, and a decimal on either buys no reader anything. */
  plot.caption(`the loss over ${nm.symbol}, curvature ${fSig(q[C.curv])}`);
  if (opts.divergedShown) {
    plot.note(`diverged at epoch ${track.diverged}`, { tone: colors.extreme });
  } else if (here < range[0] || here > range[1]) {
    plot.note("off the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: nm.axis });
  plot.axisY({ label: "loss", format: win.top >= 1e6 ? bigTick : undefined });
  plot.vline(q[C.fit], { stroke: colors.reference, label: "least squares", width: 1.5 });
  plot.curve(pts, { stroke: colors.ink2, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (opts.upto >= 1) {
    const stride = Math.max(1, Math.ceil(opts.upto / 1500));
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const walked = track[C.at];
    ctx.moveTo(plot.sx(walked[0]), plot.sy(f(walked[0])));
    for (let k = stride; k <= opts.upto; k += stride) {
      ctx.lineTo(plot.sx(walked[k]), plot.sy(f(walked[k])));
    }
    ctx.lineTo(plot.sx(here), plot.sy(f(here)));
    ctx.stroke();
    ctx.fillStyle = colors.ink1;
    const dots = Math.min(opts.upto, 40);
    for (let k = 0; k <= dots; k += 1) {
      ctx.beginPath();
      ctx.arc(plot.sx(walked[k]), plot.sy(f(walked[k])), 2.2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /* THE TANGENT IS RE-EVALUATED AT THE POINT IT TOUCHES, which is the page's
     whole point: its slope IS the chosen partial there. It used to be drawn
     with the gradient `stand()` floors to the START of the step, so through
     the move beat a line of fixed slope slid along the parabola —
     Kenneth, 2026-09-08: "the tangent animation is not there. it just
     translates without following the curve." Evaluated here it rolls with the
     curve and arrives as the tangent at the new point.

     AND IT IS ALWAYS AT FULL LENGTH — choreography A, decision 7. It used to
     grow from its centre over the first 45% of every epoch, which Kenneth read
     as the tangent "moving then redrawing, like expanding out"; the growth is
     gone and the beat's first 40% is a pause at the point instead.

     THE READOUT AND THE BEAT CAPTION KEEP THE FLOORED ONE, and the two do not
     disagree: `descendOne` stores at every index exactly the gradient this
     line recomputes, so at rest and at both unchoreographed speeds the number
     printed is the slope drawn. They part only mid-move, where they are
     answering different questions — what decided this step, against what the
     surface does under the point now. */
  if (opts.showStep) {
    const g = q.grad(cur[0], cur[1])[C.i];
    const span = (range[1] - range[0]) * 0.16;
    const L = f(here);
    slopeLine(ctx, colors,
      plot.sx(here - span), plot.sy(L - g * span),
      plot.sx(here + span), plot.sy(L + g * span));
  }

  /* THE GRADIENT AS A VECTOR — the one-dimensional case of the map's composed
     direction (decision 6). θ is one coordinate here, so −∂L/∂θ has one part:
     a horizontal arrow at the point's height, pointing downhill, at the map's
     own fixed pixel length and carrying the partial's value in the lettering
     the map's component ticks carry theirs in.

     IT RIDES THE MOVING POINT AND KEEPS THE GRADIENT THAT LEFT THE START of the
     step while the tangent above rolls with the curve, and the two are
     answering different questions:
     the arrow is the number that decided this step, the tangent is what the
     surface does under the point now. At rest and at an epoch boundary they
     agree, because `descendOne` stores at every index exactly the slope the
     tangent recomputes.

     THE CLEARANCES ARE MEASURED. It starts 9px from the dot's centre, 3.5px of
     air outside the ringed dot's 5.5px edge — a 4.5px disc under a 2px ring,
     half of which lies outside it. Its label sits 7px above the shaft, and on
     the arrow's side the tangent always DESCENDS, since downhill is lower loss
     and lower loss is lower on the screen: at epoch 0 the tangent passes 30 to
     40px below the arrow's tip on raw x and 27 to 35px on standardized x,
     across the 494 to 934px the panel is drawn at, and standardized x is still
     22 to 28px clear at epoch 10. By epoch 3 of the raw walk the tangent has
     flattened onto the arrow's own line, which is the figure saying the slope
     is gone rather than two marks colliding. Those clearances were measured on
     the 494-934px panel this page had before decision 11 and are unchanged in
     kind by the square: the arrow is a fixed pixel length and the tangent's
     descent is a fact about the parabola, not about the width. */
  if (opts.showStep && Number.isFinite(opts.grad) && opts.grad !== 0) {
    const ax = plot.sx(here);
    const ay = plot.sy(f(here));
    const dir = opts.grad > 0 ? -1 : 1;
    const x0 = ax + dir * 9;
    const x1 = x0 + dir * ARROW;
    if (Math.abs(x1 - x0) > 3) {
      arrow(ctx, x0, ay, x1, ay, colors.slope, SLOPE_W);
      /* THE NUMBER IS CLAMPED ONTO THE PANEL, which the square made necessary
         (decision 11). At 484-934px there was always room past the arrowhead;
         at 197 there is not, and the walk that runs out of it first is the
         lesson's own — as b₁ closes on its fit it stands at the panel's centre,
         the arrow takes the 39px to its right and the label wants 61 more, of
         which the panel has 98. A box sweep counted 171 states of that walk
         alone printing a cut number at 550px, the worst losing 13 of 61px.
         `panelLabel` is what this file already does about a label with nowhere
         to go (5.8): it moves the ANCHOR by the measured width, so the label
         slides back along its own row rather than being sliced by the clip.
         The row is the arrow's own, 7px above the shaft, so sliding it cannot
         reach the shaft, the arrowhead or the ringed dot.

         AND IT TAKES THE ROW BELOW THE SHAFT when the row above would be the
         panel's own top line. `panelLabel` clamps y as well as x, so a point
         high on the parabola — which is where a diverging walk stands — used to
         push the number onto the row "least squares" and "off the frame" are
         written on: 201 states of 16 125 overlapped there, by up to 10.6px.
         Below the shaft nothing is written at all, which is decision 8's remedy
         for the same fault on the map's two component ticks: when one row is
         taken, use the other. */
      const above = ay - 7;
      panelLabel(ctx, colors, rect, `${nm.partial} ${fSig(opts.grad)}`, x1 + dir * 5,
        above < rect.y + 23 ? Math.max(rect.y + 23, ay + 15) : above,
        { align: dir < 0 ? "right" : "left", color: colors.slope });
    }
  }
  ctx.restore();

  const px = plot.sx(here);
  const py = plot.sy(f(here));
  if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
    ringedDot(ctx, colors, px, py);
  }
}

function drawStrip(ctx, colors, rect, state, ep) {
  const { track, q } = state;
  const ratio = (e) => Math.max(1, track.epochLoss[e] / q.Lmin);
  let peak = 0;
  for (let e = 0; e <= ep; e += 1) peak = Math.max(peak, Math.log10(ratio(e)));
  const yMax = Y_LADDER.find((v) => v >= peak) ?? Y_LADDER[Y_LADDER.length - 1];
  const xMax = X_LADDER.find((v) => v >= Math.max(ep, 1)) ?? EPOCHS;
  const ticks = [];
  for (let t = 0; t <= yMax; t += 1) ticks.push(t);

  const plot = makePlot({ ctx, colors, rect, xDomain: [0, xMax], yDomain: [0, yMax] });
  plot.caption("loss after each epoch");
  plot.note(`epoch ${ep} of ${EPOCHS}`);
  plot.grid(ticks);
  plot.axisX({ label: "epoch" });
  plot.axisY({ label: "loss ÷ minimum, log₁₀", ticks });

  if (ep < 1) return;
  const stride = Math.max(1, Math.ceil(ep / 900));
  const pts = [];
  for (let e = 0; e <= ep; e += stride) pts.push([e, Math.log10(ratio(e))]);
  if (pts[pts.length - 1][0] !== ep) pts.push([ep, Math.log10(ratio(ep))]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y - 2, rect.w, rect.h + 2);
  ctx.clip();
  plot.curve(pts, { stroke: colors.empirical, width: 2 });
  ctx.restore();
  const py = plot.sy(Math.min(yMax, Math.log10(ratio(ep))));
  ctx.save();
  ctx.fillStyle = colors.empirical;
  ctx.beginPath();
  ctx.arc(plot.sx(ep), py, 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/* ---- the Derivative tab ---------------------------------------------------
   y = a² + 3ab with b held, and the derivative drawn as what it is DEFINED to
   be: the slope of the SECANT through (a, y(a)) and (a + Δa, y(a + Δa)), in the
   limit as Δa goes to 0. On this function that slope is 2a + 3b + Δa exactly,
   so every rung of the ladder takes the secant's slope one Δa closer to
   dy/da — at a = 2 and b = 1, 8 · 7.5 · 7.25 · 7.1 · 7.05 · 7.01 toward 7 —
   and the reader watches the secant turn onto the tangent rather than being
   told that it would.                                                        */

/* b is a constant on this page and not a control: the tab is about ONE
   variable, and a second slider would make it about two a tab early. The
   caption says so where the reader is looking. */
const B_HELD = 1;

/* The window, fixed (2.5): y over a in [-1, 4] with b at 1 runs -2 to 28. The
   second point can walk off the right-hand edge, and the panel says so rather
   than the frame chasing it. */
const DERIV_Y = [-4, 30];

/* How far past each of its two points the secant is drawn, as a share of the
   window in a. Enough that it reads as a LINE THROUGH them rather than as a
   chord between them — which is the whole difference between a secant and a
   join — and short enough that a steep one stays on the panel. */
const SECANT_OVER = 0.16;

/* A leg of the right triangle carries its label only once it is long enough to
   BE a mark. Below this the two labels sit on each other and on the ringed
   dot, which is exactly the fault decision 8 measured on the loss surface's
   component ticks; and a 1.4px leg — which is what Δa 0.01 is at every width
   this widget is drawn at — has nothing to label. Both numbers are on the line
   under the panel and in the readout at every rung. */
const LEG_LABEL_MIN = 26;

function drawDerivative(ctx, colors, rect, a, da) {
  const plot = makePlot({ ctx, colors, rect, xDomain: A_RANGE, yDomain: DERIV_Y });
  plot.caption(`y = a² + 3ab over a, with b held at ${B_HELD}`);

  const y0 = gradFn.y(a, B_HELD);
  const slope = gradFn.da(a, B_HELD);
  const aT = a + da;
  const yT = gradFn.y(aT, B_HELD);
  const secant = (yT - y0) / da;
  if (aT > A_RANGE[1] || yT > DERIV_Y[1]) {
    plot.note("the second point is off the frame", { tone: colors.extreme });
  }
  plot.axisX({ label: "a" });
  plot.axisY({ label: "y" });

  const pts = [];
  for (let k = 0; k <= 160; k += 1) {
    const v = A_RANGE[0] + (k / 160) * (A_RANGE[1] - A_RANGE[0]);
    pts.push([v, gradFn.y(v, B_HELD)]);
  }
  plot.curve(pts, { stroke: colors.ink2, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* THE TANGENT IS THE REFERENCE, AND IT SHOWS FROM THE FIRST FRAME (2.7).
     Drawn faint and dashed and under everything else, so the secant is seen
     approaching a line that was already there. The header's block 9 says why
     this is not 2.1's "don't open on the answer": dy/da is printed on the
     formula card and in the readout before the reader touches anything, so
     withholding the LINE would hide one drawing of a number already stated
     twice — while what the reader still has to build, the ladder that closes
     the secant onto it, is untouched.

     IT IS --c-slope AND NOT --c-reference (decision 12), and what makes it
     recessive is the alpha rather than the hue: the secant turns onto this line
     and the two are the same quantity a Δa apart, so drawing them in two
     colours would say they are two different kinds of thing. Dashed, thinner
     and at 0.55, which leaves the secant reading over it. */
  const tspan = (A_RANGE[1] - A_RANGE[0]) * 0.24;
  slopeLine(ctx, colors,
    plot.sx(a - tspan), plot.sy(y0 - slope * tspan),
    plot.sx(a + tspan), plot.sy(y0 + slope * tspan),
    { width: 2, dash: [5, 4], alpha: 0.55 });

  /* THE RIGHT TRIANGLE UNDER THE SECANT: Δa along the bottom, Δy up the side.
     Dashed and in ink, because neither leg is a thing the function does — they
     are the two numbers the ratio above them is made of. */
  const px0 = plot.sx(a);
  const py0 = plot.sy(y0);
  const pxT = plot.sx(aT);
  const pyT = plot.sy(yT);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px0, py0);
  ctx.lineTo(pxT, py0);
  ctx.lineTo(pxT, pyT);
  ctx.stroke();
  ctx.restore();

  const over = (A_RANGE[1] - A_RANGE[0]) * SECANT_OVER;
  slopeLine(ctx, colors,
    plot.sx(a - over), plot.sy(y0 - secant * over),
    plot.sx(aT + over), plot.sy(yT + secant * over));

  /* Both points are ON the curve, which is what separates this figure from the
     one it replaced: the second mark used to be the tangent's prediction and
     the error under it. The second point wears the secant's own colour: it is
     one end of that line, and the ringed dot below is the point the derivative
     is taken AT, which is why the two are not the same mark. */
  ctx.fillStyle = colors.slope;
  ctx.beginPath();
  ctx.arc(pxT, pyT, 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ringedDot(ctx, colors, px0, py0);
  ctx.restore();

  /* THREE LABELS AT MOST, AND EACH SITS ON THE MARK IT NAMES. The secant's
     slope goes ABOVE ITS UPPER-RIGHT END, which is the one place on this
     figure nothing else can reach: the triangle is always right-and-up from
     the point — dy/da = 2a + 3 is positive over the whole of the a slider, and
     so is Δy — and the secant leaves the second point still climbing, so its
     right end is always at least `over × Δy/Δa` above the top of the vertical
     leg. Measured: 27px of clear row at the tightest, since the secant's slope
     is never below 1 and Δy takes a label only above 26px.

     THE LOWER-LEFT END WAS TRIED FIRST AND FAILED A BOX SWEEP: at a = −1 with
     a shallow secant, both that end and the Δa label are pushed onto the
     panel's own bottom edge by the clamp, and 253 of 14 688 states printed the
     two through each other. */
  panelLabel(ctx, colors, rect, `Δy/Δa ${fSig(secant)}`,
    plot.sx(aT + over) + 5, plot.sy(yT + secant * over) - 6,
    { color: colors.slope });
  /* The two legs take a label only when the triangle is BOTH long enough to
     carry one and wholly on the panel. Off the frame the clamp puts the top of
     the vertical leg and the secant's own far end on the same corner pixel, and
     a box sweep found 189 states where those two printed through each other;
     the panel already says the second point has left, and both numbers are on
     the line beneath it and in the readout. */
  const inFrame = aT <= A_RANGE[1] && yT <= DERIV_Y[1];
  if (inFrame && pxT - px0 >= LEG_LABEL_MIN) {
    panelLabel(ctx, colors, rect, `Δa ${fSig(da)}`, (px0 + pxT) / 2, py0 + 17,
      { align: "center", color: colors.ink1 });
  }
  if (inFrame && py0 - pyT >= LEG_LABEL_MIN) {
    panelLabel(ctx, colors, rect, `Δy ${fSig(yT - y0)}`, pxT + 5, (py0 + pyT) / 2 + 4,
      { color: colors.ink1 });
  }
}

/* ---- the Partial derivatives tab ------------------------------------------
   The same function over both variables: the map on the right where the loss
   surface sits, the two slices stacked in the column the data panel holds, and
   the gradient as one arrow carrying both numbers.                            */

/* THE RINGS ARE A CONSTANT: one fixed function over one fixed window, so they
   are marched once for the life of the page. The loss surface's own rings sit
   in `compute` because they move with the data; these move with nothing, and
   both bitmaps below would otherwise re-march 45 000 cells — the relief's on
   every frame of a drag. */
const VALUE_RINGS = isoSegments(gradFn.y, A_RANGE, B_RANGE, Y_LEVELS);

/* Painted once per size and theme — the function is fixed, so unlike the loss
   surface there is nothing else for the key to carry. The rings are baked in
   with it for the same reason the loss surface's are. */
let valueCache = null;
function valueBitmap(wpx, hpx, dpr, colors) {
  const key = `${wpx}x${hpx}:${colors.valueLow}:${colors.valueHigh}:${colors.surface}`;
  if (valueCache && valueCache.key === key) return valueCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const CELL = 2;
  for (let px = 0; px < wpx; px += CELL) {
    const a = A_RANGE[0] + (px / wpx) * (A_RANGE[1] - A_RANGE[0]);
    for (let py = 0; py < hpx; py += CELL) {
      const b = B_RANGE[1] - (py / hpx) * (B_RANGE[1] - B_RANGE[0]);
      c.fillStyle = hexLerp(colors.valueLow, colors.valueHigh, valueField(a, b));
      c.fillRect(px, py, CELL, CELL);
    }
  }
  const ax = (v) => ((v - A_RANGE[0]) / (A_RANGE[1] - A_RANGE[0])) * wpx;
  const by = (v) => hpx - ((v - B_RANGE[0]) / (B_RANGE[1] - B_RANGE[0])) * hpx;
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.55;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [x0, y0, x1, y1] of VALUE_RINGS) {
    c.moveTo(ax(x0), by(y0));
    c.lineTo(ax(x1), by(y1));
  }
  c.stroke();
  valueCache = { key, canvas: cv };
  return cv;
}

function drawValueMap(ctx, colors, rect, a, b) {
  const plot = makePlot({ ctx, colors, rect, xDomain: A_RANGE, yDomain: B_RANGE });
  plot.caption("y over every (a, b)");
  plot.axisX({ label: "a" });
  plot.axisY({ label: "b" });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    valueBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const px = plot.sx(a);
  const py = plot.sy(b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* The two slices, as the lines they are cut along: each partial derivative
     varies one of these and holds the other, and the panels beside the map are
     what the function does along them.

     EACH LINE TAKES ITS OWN SLICE'S COLOUR (decision 10), the same two the
     relief's planes and the two panels beside the map take, so the pairing
     holds whichever surface is up. The line across a is where b is held.

     AND EACH IS CASED IN THE PAGE'S OWN GROUND, because --c-group-a and
     --c-value-low are the same --series-1 blue: this ramp's low end is where
     y is most negative, which is a real corner of this window, and a blue dash
     over it would be a mark the reader cannot find. `ringedDot` solves the same
     collision the same way on the loss surface's cost-low trench. */
  const cut = (color, x0, y0, x1, y1) => {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = colors.surface;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };
  cut(colors.groupA, plot.sx(A_RANGE[0]), py, plot.sx(A_RANGE[1]), py);
  cut(colors.groupB, px, plot.sy(B_RANGE[0]), px, plot.sy(B_RANGE[1]));

  /* THE GRADIENT, POINTING UPHILL. Its direction is the parameter-space pair
     mapped through the panel's own scales and then normalised to the map's
     fixed pixel length, so the arrow is the same size wherever it stands and
     still points where (∂y/∂a, ∂y/∂b) points. Decision 7 says why this is
     allowed here where decision 1 forbids it on the loss surface. */
  const ga = gradFn.da(a, b);
  const gb = gradFn.db(a);
  const gl = Math.hypot(ga, gb);
  let tip = null;
  if (gl > 0) {
    const dx = plot.sx(a + ga / gl) - px;
    const dy = plot.sy(b + gb / gl) - py;
    const len = Math.hypot(dx, dy);
    tip = [px + (ARROW * dx) / len, py + (ARROW * dy) / len];
    arrow(ctx, px, py, tip[0], tip[1], colors.slope, SLOPE_W);
  }
  ringedDot(ctx, colors, px, py);
  ctx.restore();

  /* Outside the clip and clamped into the panel BY ITS OWN WIDTH: at the
     top-right corner the arrow itself runs off the frame, and the two numbers
     the tab exists for would go with it. Clamping the anchor is not enough — a
     left-aligned label anchored one pixel inside the edge still hangs 80px out,
     which is what a box sweep at 550px caught. Measured with the font `label`
     is about to set, so the two cannot disagree. */
  const text = tip ? `∇y = (${f1(ga)}, ${f1(gb)})` : "∇y = (0, 0)";
  if (tip) {
    panelLabel(ctx, colors, rect, text,
      tip[0] + (tip[0] < px ? -5 : 5), tip[1] + (tip[1] < py ? -7 : 14),
      { align: tip[0] < px ? "right" : "left", color: colors.slope });
  } else {
    label(ctx, colors, text, rect.x + 6, rect.y + 14, { color: colors.slope });
  }
}

/* ---- the Partial derivatives tab in relief --------------------------------
   The same window, the same colours, the same point, with y as HEIGHT as well
   as colour: Descent's relief machinery — `projector`, `reliefMesh`, the one
   fixed light, the hidden-line ray march, and the `turn`/`tilt` drag — read
   over this tab's own function. Kenneth, 2026-09-08: *"could we have the 3d
   view also, so we can see that we are holding one constant while the other
   varies?"* What answers that is not the mesh but the TWO SLICE CURVES lying on
   it: on the map they are two dashed straight lines standing for a slice, and
   here they are what the function does along one variable while the other is
   held still.

   THE HEIGHT IS LINEAR IN y, where the loss surface's is a log, and `model.js`
   says why: a walk starts at ~270x the least loss and enters the trench at ~8x,
   while y over this window runs -8 to 52 — a range, not a ratio, with nothing
   to tame. One thing follows that is worth having: a straight line in (a, y) is
   a straight line on the relief, so the two segments below are TANGENTS and not
   chords across a curved surface, which is what the tab is about.

   THE VIEWPOINT IS THE LOSS SURFACE'S 300 / 35, and that is measured rather
   than inherited. `_lab/gd-part-view.mjs` sweeps 648 viewpoints over 30 points
   of the (a, b) window and then re-checks the winner at all 2091 stops the two
   sliders have: from 300/35 nothing of either slice curve is hidden anywhere,
   and the point is never behind the surface. Only the 210-260 azimuths below
   about 30 degrees of elevation lose anything — up to 98% of both slices — and
   the reader who turns the surface into its own near wall can see that they
   have. One default for both tabs also keeps `turn` and `tilt` meaning the
   same thing in a link whichever tab it opens. */

/* Painted once per size, theme and viewpoint — the function is fixed, so
   unlike the loss surface's mesh there is no dataset for the key to carry. Its
   own slot rather than the loss mesh's, so moving between tabs does not evict
   the other tab's surface. */
let valueMeshCache = null;
function valueReliefBitmap(wpx, hpx, dpr, colors, az, el) {
  const key = `${wpx}x${hpx}:${colors.valueLow}:${colors.valueHigh}:${colors.surface}:${az}:${el}`;
  if (valueMeshCache && valueMeshCache.key === key) return valueMeshCache.canvas;
  const cv = document.createElement("canvas");
  cv.width = wpx;
  cv.height = hpx;
  const c = cv.getContext("2d");
  const project = projector({ x: 0, y: 0, w: wpx, h: hpx }, az, el);
  c.lineWidth = 0.5 * dpr;
  for (const face of reliefMesh(valueField, A_RANGE, B_RANGE, project)) {
    c.beginPath();
    face.pts.forEach((p, k) => (k ? c.lineTo(p.X, p.Y) : c.moveTo(p.X, p.Y)));
    c.closePath();
    const rgb = mixRGB(colors.valueLow, colors.valueHigh, face.t);
    c.fillStyle = `rgb(${rgb.map((v) => Math.round(v * face.shade)).join(", ")})`;
    c.fill();
    c.strokeStyle = colors.surface;
    c.globalAlpha = 0.18;
    c.stroke();
    c.globalAlpha = 1;
  }
  const lift = (a, b) => project(...reliefPoint(valueField, A_RANGE, B_RANGE, a, b));
  c.strokeStyle = colors.surface;
  c.globalAlpha = 0.6;
  c.lineWidth = dpr;
  c.beginPath();
  for (const [x0, y0, x1, y1] of VALUE_RINGS) {
    const p = lift(x0, y0);
    const q = lift(x1, y1);
    c.moveTo(p.X, p.Y);
    c.lineTo(q.X, q.Y);
  }
  c.stroke();
  valueMeshCache = { key, canvas: cv };
  return cv;
}

/* The two slice curves, sampled once and classified once — the same shape as
   the walk's `reliefPieces` and cached on the same terms: a ray march per piece
   is far too much per frame, and the point and the viewpoint are between them
   everything the split depends on. 96 marches, under a millisecond. */
let sliceCache = null;
function slicePieces(a, b, az, el) {
  const key = `${a}:${b}:${az}:${el}`;
  if (sliceCache && sliceCache.key === key) return sliceCache.pieces;
  const SEG = 48;
  const pieces = [];
  for (const [dom, alongA] of [[A_RANGE, true], [B_RANGE, false]]) {
    for (let k = 0; k < SEG; k += 1) {
      const u0 = dom[0] + (k / SEG) * (dom[1] - dom[0]);
      const u1 = dom[0] + ((k + 1) / SEG) * (dom[1] - dom[0]);
      const m = (u0 + u1) / 2;
      pieces.push({
        alongA,
        a: alongA ? [u0, b] : [a, u0],
        b: alongA ? [u1, b] : [a, u1],
        hidden: reliefHidden(valueField, A_RANGE, B_RANGE,
          alongA ? m : a, alongA ? b : m, az, el),
      });
    }
  }
  sliceCache = { key, pieces };
  return pieces;
}

function drawValueRelief(ctx, colors, rect, a, b, az, el) {
  const plot = makePlot({ ctx, colors, rect, xDomain: A_RANGE, yDomain: B_RANGE });
  plot.caption("y as height over every (a, b)");
  /* No axisX/axisY: a projected surface has no rectilinear axes to hang ticks
     on, so a and b are named along the two edges nearest the reader. */

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.drawImage(
    valueReliefBitmap(Math.round(rect.w * dpr), Math.round(rect.h * dpr), dpr, colors, az, el),
    rect.x, rect.y, rect.w, rect.h,
  );
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  const project = projector(rect, az, el);
  const pt = (x, y) => project(...reliefPoint(valueField, A_RANGE, B_RANGE, x, y));
  /* A height handed in rather than read off the surface — what a tangent's far
     ends need, since only the point itself is on the surface. */
  const lift = (x, y, v) => project(...reliefLift(valueRamp(v), A_RANGE, B_RANGE, x, y));

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  /* THE TWO SLICING PLANES, THROUGH THE POINT AND STANDING ON THE FLOOR
     (decision 10). Each is the plane one partial derivative is taken in: a
     varies over the plane where b is held, b over the plane where a is held,
     and the curve each cuts out of the surface is the slice the panel beside
     the map draws. Painted AFTER the mesh and translucent, which is the honest
     convention for a section plane over a solid — the surface still reads as a
     surface, and nothing has to be sorted into the mesh's own painter order.

     The corners are lifted by `reliefLift` rather than read off the field: a
     plane stands from the ramp's floor to its ceiling wherever it is, which is
     what makes it a plane and not a drape over the surface. */
  const quad4 = (pts, color) => {
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y)));
    ctx.closePath();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };
  const corner = (x, y, t) => project(...reliefLift(t, A_RANGE, B_RANGE, x, y));
  quad4([corner(A_RANGE[0], b, 0), corner(A_RANGE[1], b, 0),
    corner(A_RANGE[1], b, 1), corner(A_RANGE[0], b, 1)], colors.groupA);
  quad4([corner(a, B_RANGE[0], 0), corner(a, B_RANGE[1], 0),
    corner(a, B_RANGE[1], 1), corner(a, B_RANGE[0], 1)], colors.groupB);

  /* The curve each plane cuts, in that plane's own colour, over the plane. The
     hidden pieces stay ink: a piece the surface is in front of is a ghost of
     the mark and not the mark, and giving the convention two colours would need
     two more legend rows to say one thing. From the viewpoint the figure opens
     at there are none of them — `gd-part-view.mjs` measured that — so they
     appear only once the reader has turned the surface into its own near wall. */
  const shown = [[], []];
  const buried = [];
  for (const pc of slicePieces(a, b, az, el)) {
    const seg = [pt(pc.a[0], pc.a[1]), pt(pc.b[0], pc.b[1])];
    if (pc.hidden) buried.push(seg);
    else shown[pc.alongA ? 0 : 1].push(seg);
  }
  strokeSegments(ctx, colors, buried, HIDDEN_LINE);
  for (const [list, color] of [[shown[0], colors.groupA], [shown[1], colors.groupB]]) {
    /* cased in the page's ground first, for the reason the map's two cut lines
       are: --c-group-a and this ramp's low end are one --series-1 blue */
    strokeSegments(ctx, colors, list, SLICE_CASING, colors.surface);
    strokeSegments(ctx, colors, list, VISIBLE_LINE, color);
  }

  /* THE TWO TANGENTS, IN --c-slope, and cased in the page's own ground: they
     lie on a surface that runs the whole value ramp, and this one crosses both
     slice curves at the point. A partial derivative should not change colour
     when the reader turns the figure over, so this is the same mark the two
     panels beside the map draw, in the same colour, at the same width.

     EACH IS CUT BACK TO WHERE ITS OWN y LEAVES THE RAMP, per end, because past
     the ramp's ends the height clamps and a straight line would kink at the
     panel's own ceiling. */
  const ga = gradFn.da(a, b);
  const gb = gradFn.db(a);
  const y0 = gradFn.y(a, b);
  const c = pt(a, b);
  const anchors = [];
  for (const [slope, dom, here, alongA] of [[ga, A_RANGE, a, true], [gb, B_RANGE, b, false]]) {
    const half = (dom[1] - dom[0]) * TANGENT_HALF;
    const s = Math.max(Math.abs(slope), 1e-9);
    const up = Math.min(half, (Y_RANGE[1] - y0) / s);
    const down = Math.min(half, (y0 - Y_RANGE[0]) / s);
    const hi = Math.min(dom[1], here + (slope >= 0 ? up : down));
    const lo = Math.max(dom[0], here - (slope >= 0 ? down : up));
    const end = (u) => (alongA
      ? lift(u, b, y0 + slope * (u - here))
      : lift(a, u, y0 + slope * (u - here)));
    const p = end(lo);
    const q = end(hi);
    slopeLine(ctx, colors, p.X, p.Y, q.X, q.Y);
    /* Both anchors are kept: `LABEL_ALONG` of the way toward the end the
       viewpoint has put further from the point, and the same toward the nearer
       one. The far end is the first choice — it is off the mesh's busy middle
       at any azimuth — and the near end is where the label goes when the far
       one would print through an axis name on the rim. */
    const along = (e) => ({
      X: c.X + LABEL_ALONG * (e.X - c.X),
      Y: c.Y + LABEL_ALONG * (e.Y - c.Y),
    });
    const outer = Math.hypot(p.X - c.X, p.Y - c.Y) > Math.hypot(q.X - c.X, q.Y - c.Y) ? p : q;
    anchors.push([along(outer), along(outer === p ? q : p)]);
  }

  /* THE GRADIENT, POINTING UPHILL, as the map draws it — built in the relief's
     own normalised coordinates, where the two axes are the same size, and laid
     back onto the surface at its tip. */
  const wa = A_RANGE[1] - A_RANGE[0];
  const wb = B_RANGE[1] - B_RANGE[0];
  const du = ga / wa;
  const dv = gb / wb;
  const gl = Math.hypot(du, dv);
  if (gl > 0) {
    const f = DOWNHILL / gl;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const e = pt(clamp(a + du * f * wa, A_RANGE[0], A_RANGE[1]),
      clamp(b + dv * f * wb, B_RANGE[0], B_RANGE[1]));
    if (Math.hypot(e.X - c.X, e.Y - c.Y) > 3) arrow(ctx, c.X, c.Y, e.X, e.Y, colors.slope, SLOPE_W);
  }
  ringedDot(ctx, colors, c.X, c.Y);
  ctx.restore();

  /* THE TWO NUMBERS THE TAB EXISTS FOR, AND THE THREE WAYS THEY CAN COLLIDE,
     each answered by arithmetic rather than by where the marks happen to fall
     — which is decision 8's lesson applied a second time, and a box sweep over
     seven viewpoints and the whole (a, b) window found all three:

       against the AXIS NAMES on the panel's rim (101 states of 2079): each
         label takes the near end of its own tangent instead when the far end
         would print through one, which is why `nameEdges` hands its boxes back;
       against EACH OTHER (138 states, by up to 41px): "one above its end, one
         below" is a rule about each label alone and says nothing about the
         pair, so where the two baselines come within a row they are pushed to
         either side of their own midpoint;
       against the PANEL'S EDGES: `panelLabel` clamps by the measured width. */
  const rim = nameEdges(ctx, colors, pt, A_RANGE, B_RANGE, ["a", "b"]);
  const texts = [`∂y/∂a ${f1(ga)}`, `∂y/∂b ${f1(gb)}`];
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const widths = texts.map((t) => ctx.measureText(t).width);
  ctx.restore();
  /* A generous band in y, because the pair rule below can still move a chosen
     baseline by 10px after this decision is made. */
  const clearsRim = (at, i, dy) => {
    const left = at.X < c.X ? at.X - 4 - widths[i] : at.X + 4;
    return rim.every((r) => Math.abs(at.Y + dy - r.y) > 26
      || left > r.right + 2 || left + widths[i] < r.left - 2);
  };
  /* Two ends and, on each, three rows: its own, and one 30px to either side.
     Four states of 2079 had a point whose two tangent ends BOTH ran into a
     name, and a label with nowhere along its mark to go still has somewhere
     above or below it. */
  const place = (i, dy0) => {
    for (const at of anchors[i]) {
      for (const dy of [dy0, dy0 + 30, dy0 - 30]) if (clearsRim(at, i, dy)) return { at, dy };
    }
    return { at: anchors[i][0], dy: dy0 };
  };
  const { at: at0, dy: dy0 } = place(0, -6);
  const { at: at1, dy: dy1 } = place(1, 14);
  let ya = at0.Y + dy0;
  let yb = at1.Y + dy1;
  if (Math.abs(yb - ya) < 20) {
    const mid = (ya + yb) / 2;
    ya = mid - 10;
    yb = mid + 10;
  }
  panelLabel(ctx, colors, rect, texts[0], at0.X + (at0.X < c.X ? -4 : 4), ya,
    { align: at0.X < c.X ? "right" : "left", color: colors.slope });
  panelLabel(ctx, colors, rect, texts[1], at1.X + (at1.X < c.X ? -4 : 4), yb,
    { align: at1.X < c.X ? "right" : "left", color: colors.slope });
}

/* One slice: y along one variable with the other held, its tangent, and the
   slope that tangent has. Both panels share a y window — the function's own
   range over the map — so the two slices are read against each other and
   against the colour bar under the map. */
const SLICE_PAD = (Y_RANGE[1] - Y_RANGE[0]) * 0.06;
const SLICE_Y = [Y_RANGE[0] - SLICE_PAD, Y_RANGE[1] + SLICE_PAD];

function drawValueSlice(ctx, colors, rect, opts) {
  const plot = makePlot({ ctx, colors, rect, xDomain: opts.xDomain, yDomain: SLICE_Y });
  plot.caption(opts.caption);
  /* THE CURVE AND ITS PARTIAL TAKE THE SLICING PLANE'S COLOUR (decision 10),
     on the map as well as the relief, so a reader turning the surface over
     keeps the pairing between a plane and the panel that reads it. The tangent
     takes --c-slope (decision 12): it is the same mark it is everywhere else in
     the widget, and it is the one thing on this panel that is a rate of change
     rather than a value. */
  plot.note(opts.note, { tone: opts.color });
  plot.axisX({ label: opts.xLabel });
  plot.axisY({});
  const pts = [];
  for (let k = 0; k <= 80; k += 1) {
    const v = opts.xDomain[0] + (k / 80) * (opts.xDomain[1] - opts.xDomain[0]);
    pts.push([v, opts.f(v)]);
  }
  plot.curve(pts, { stroke: opts.color, width: 1.5 });

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const span = (opts.xDomain[1] - opts.xDomain[0]) * 0.18;
  const y0 = opts.f(opts.at);
  slopeLine(ctx, colors,
    plot.sx(opts.at - span), plot.sy(y0 - opts.slope * span),
    plot.sx(opts.at + span), plot.sy(y0 + opts.slope * span));
  ringedDot(ctx, colors, plot.sx(opts.at), plot.sy(y0));
  ctx.restore();
}

/* ---- the formula card ----------------------------------------------------
   MathML where the engine renders it, with a plain fallback where it does not
   (widget 14's rule: an older engine drops the <math> wrapper and runs the
   symbols together). Each line is [label, body]; the label sits in a gutter
   and any wrapped body line starts under the body rather than under the label,
   which is what the shared `.w-math-eq` hanging indent — written for widget
   14's thirteen-term sum — does not give a short equation. Widgets 40 and 45
   override it the same way. */
const MATHML = mathmlRenders();
const mml = (inner) => `<math><mrow>${inner}</mrow></math>`;
const mi = (t) => `<mi>${t}</mi>`;
const mo = (t) => `<mo>${t}</mo>`;
const mn = (t) => `<mn>${t}</mn>`;
const msub = (b, s) => `<msub>${b}${s}</msub>`;
const msup = (b, s) => `<msup>${b}${s}</msup>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const MB0 = msub(mi("b"), mn("0"));
const MB1 = msub(mi("b"), mn("1"));
const RESID = `${mo("(")}${MB0}${mo("+")}${MB1}${msub(mi("x"), mi("i"))}${mo("−")}${msub(mi("y"), mi("i"))}${mo(")")}`;
const SUM = `<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>${mi("n")}</munderover>`;

const CARD = {
  update: MATHML
    ? mml(`${mi("θ")}${mo("←")}${mi("θ")}${mo("−")}${mi("α")}${frac(`<mrow>${mo("∂")}${mi("L")}</mrow>`, `<mrow>${mo("∂")}${mi("θ")}</mrow>`)}`)
    : "θ ← θ − α ∂L/∂θ",
  loss: MATHML
    ? mml(`${mi("L")}${mo("(")}${MB0}${mo(",")}${MB1}${mo(")")}${mo("=")}${frac(mn("1"), mi("n"))}${SUM}<msup><mrow>${RESID}</mrow>${mn("2")}</msup>`)
    : "L(b₀, b₁) = (1/n) Σ (b₀ + b₁xᵢ − yᵢ)²",
  d0: MATHML
    ? mml(`${frac(mn("2"), mi("n"))}${SUM}${RESID}`)
    : "(2/n) Σ (b₀ + b₁xᵢ − yᵢ)",
  d1: MATHML
    ? mml(`${frac(mn("2"), mi("n"))}${SUM}${RESID}${msub(mi("x"), mi("i"))}`)
    : "(2/n) Σ (b₀ + b₁xᵢ − yᵢ) xᵢ",
  /* The two concept tabs' function and its derivatives. Same shape as the rows
     above: the label in the gutter names the quantity, the body is only the
     expression. */
  fn: MATHML
    ? mml(`${mi("y")}${mo("=")}${msup(mi("a"), mn("2"))}${mo("+")}${mn("3")}${mi("a")}${mi("b")}`)
    : "y = a² + 3ab",
  fa: MATHML
    ? mml(`${mn("2")}${mi("a")}${mo("+")}${mn("3")}${mi("b")}`)
    : "2a + 3b",
  fb: MATHML ? mml(`${mn("3")}${mi("a")}`) : "3a",
  /* The Derivative tab's own row, and the limit is written out rather than
     implied: the tab draws the secant, and what says the secant is not the
     answer is the lim that turns it into one. */
  flim: MATHML
    ? mml(`<munder><mo movablelimits="false">lim</mo><mrow>${mi("Δa")}${mo("→")}${mn("0")}</mrow></munder>`
      + `${frac(mi("Δy"), mi("Δa"))}${mo("=")}${mn("2")}${mi("a")}${mo("+")}${mn("3")}${mi("b")}`)
    : "lim (Δa → 0) Δy/Δa = 2a + 3b",
};

const GUTTER = "4.9em";   // the widest label, "∂L/∂b₀", at the card's font size
const CARD_MIN = "10em";  // the four rows of the two-parameter page; every
                          // shorter card keeps the reserve so the figure does
                          // not jog between tabs or pages (3.4k)
let cardHost = null;
let cardKey = null;

/* The card follows the page: two parameters show both partials, one parameter
   shows the one it is descending (decision 11). A card still naming ∂L/∂b₁
   while the reader walks b₀ would be the formula and the figure disagreeing. */
function cardRows(tab, view, which) {
  if (tab === "derivative") return [["y", CARD.fn], ["dy/da", CARD.flim]];
  if (tab === "partial") return [["y", CARD.fn], ["∂y/∂a", CARD.fa], ["∂y/∂b", CARD.fb]];
  const rows = [["Update", CARD.update], ["Loss", CARD.loss]];
  if (view === "two") return [...rows, ["∂L/∂b₀", CARD.d0], ["∂L/∂b₁", CARD.d1]];
  return [...rows, which === "b0" ? ["∂L/∂b₀", CARD.d0] : ["∂L/∂b₁", CARD.d1]];
}

function renderCard(tab, view, which) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  cardHost.style.minHeight = CARD_MIN;
  const key = `${tab}:${view}:${which}`;
  if (key === cardKey) return;
  cardKey = key;
  cardHost.innerHTML = cardRows(tab, view, which)
    .map(([name, body]) =>
      `<div class="w-math-eq" style="min-height:0;padding-left:${GUTTER};text-indent:-${GUTTER};margin:0 0 4px">`
      + `<span style="display:inline-block;width:${GUTTER};text-indent:0;color:var(--ink-3)">${name}</span>${body}</div>`)
    .join("");
}

/* ---- where the walk stands ----------------------------------------------- *
 * One function, because the drawing, the readout and the summary must agree
 * about it (5.8). At Slow the epoch in flight is a fractional index between
 * the two epoch marks; everywhere else the position is an epoch boundary.    */
function stand(state, params, anim) {
  const { track } = state;
  const ep = Math.min(anim?.ep ?? 0, track.epochsDone);
  const beat = choreographs(params.view, params.speed) ? (anim?.beat ?? 0) : 0;
  const two = params.view === "two";
  const moveFrom = two ? BEATS_TWO.direction : BEATS_ONE.hold;
  const a = track.epochAt[ep];
  const b = track.epochAt[Math.min(ep + 1, track.epochsDone)];
  const raw = beat <= moveFrom ? 0 : Math.min(1, (beat - moveFrom) / (1 - moveFrom));
  /* Choreography A eases the one-parameter move (decision 7). The surface's
     move stays linear: there the reader is watching the shape of a path, and
     an ease would put an acceleration into it that the walk does not have. */
  const mix = two ? raw : easeInOut(raw);
  const fi = a + (b - a) * mix;
  /* floor, not round: during the move the arrow and the beat line must keep
     the gradient that LEFT the start of this step — rounding flipped the
     printed distance halfway through the move (seen 0.0237 -> 0.0229). */
  const k = Math.min(track.len - 1, Math.max(0, Math.floor(fi)));
  return {
    ep,
    beat,
    fi,
    cur: posAt(track, fi),
    /* the partials that leave THIS point — the pair the arrow draws and the
       readout prints. At full batch they are the gradient over all n rows; at
       batch 10 or 1 they are the gradient of the batch about to be used, which
       is what actually moves the walk. */
    grad: [track.g0[k], track.g1[k]],
    upto: Math.floor(fi),
  };
}

/* Where the Derivative tab's nudge stands — the same shape as `stand`, and here
   for the same reason: the panel, the readout and the summary must agree about
   one number (5.8).
 *
 * THE READER'S CHOICE IS THE START AND THE ANIMATION ONLY GOES DOWN. `anim.rung`
 * counts rungs taken from whichever tick the `nudge` control is on, so the walk
 * is an authored reveal in the shape `shown` already has: a display change
 * cannot reset it, and moving the control is a data change that starts a new
 * one from the new tick. During a beat Δa eases from the rung it is leaving to
 * the one it is arriving at, so the second point SLIDES ALONG THE CURVE and the
 * secant rotates onto the tangent, rather than either of them jumping. The ease
 * is choreography A's, for its reason: the ends of the move are where the
 * reader is reading the slope. */
function standNudge(state, params, anim) {
  const rung = Math.min(anim?.rung ?? 0, state.rungs);
  const beat = anim?.beat ?? 0;
  const here = NUDGES[state.start + rung];
  const next = NUDGES[Math.min(NUDGES.length - 1, state.start + rung + 1)];
  const mix = beat <= BEATS_NUDGE.hold
    ? 0
    : easeInOut(Math.min(1, (beat - BEATS_NUDGE.hold) / (1 - BEATS_NUDGE.hold)));
  return { rung, beat, next, da: here + (next - here) * mix };
}

/* ---- the two concept tabs, composed --------------------------------------
   One function each, so `draw` reads as three tabs and not as one branch with
   three tails.                                                               */

function drawDerivativeTab(ctx, colors, L, params, state, anim) {
  const at = standNudge(state, params, anim);
  drawDerivative(ctx, colors, L.curve, params.a, at.da);
  const slope = gradFn.da(params.a, B_HELD);
  const secant = (gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD)) / at.da;
  /* The same slot the Descent tab's beat line takes: what this beat is doing
     while one is running, and the two slopes side by side the rest of the time
     (2.7). The pair is the tab's whole claim, and it is a pair rather than a
     difference because what the reader is watching is one number close on
     another. */
  const said = at.beat > 0
    ? `Δa shrinks to ${fSig(at.next)}; the secant approaches the tangent`
    : `Δa ${fSig(at.da)}: the secant's slope is ${fSig(secant)}; the tangent's is ${f1(slope)}`;
  label(ctx, colors, said, L.curve.x, L.curveY,
    { color: at.beat > 0 ? colors.highlight : colors.ink3 });
}

function drawPartialTab(ctx, colors, L, params) {
  const { a, b } = params;
  const ga = gradFn.da(a, b);
  const gb = gradFn.db(a);
  drawValueSlice(ctx, colors, L.partA, {
    caption: `y over a, b held at ${f1(b)}`,
    note: `∂y/∂a ${f1(ga)}`,
    xDomain: A_RANGE,
    xLabel: "a",
    f: (v) => gradFn.y(v, b),
    at: a,
    slope: ga,
    color: colors.groupA,
  });
  drawValueSlice(ctx, colors, L.partB, {
    caption: `y over b, a held at ${f1(a)}`,
    note: `∂y/∂b ${f1(gb)}`,
    xDomain: B_RANGE,
    xLabel: "b",
    f: (v) => gradFn.y(a, v),
    at: b,
    slope: gb,
    color: colors.groupB,
  });
  /* The same panel, the same rect, the same window: the relief is a second
     reading of the map, so it replaces the square and leaves the two slices
     beside it exactly where they were — which is what Descent's Surface
     control does to the loss surface. */
  if (params.relief === "relief") {
    drawValueRelief(ctx, colors, L.partMap, a, b, params.turn, params.tilt);
  } else {
    drawValueMap(ctx, colors, L.partMap, a, b);
  }
  drawColourBar(ctx, colors, L.partMap, {
    low: colors.valueLow,
    high: colors.valueHigh,
    left: String(Y_RANGE[0]),
    right: String(Y_RANGE[1]),
    middle: "y over the (a, b) plane",
  });
}

/* ---- the widget ---------------------------------------------------------- */

const LR_DETAIL = "α in the update rule: the step is α times the gradient";

/* THE WAY HOME FROM A DRAG (decision 6), on mlp's momentary-pill pattern: the
   press is a parameter for exactly as long as it takes `rebuild` to see it, and
   the two it writes are the ones the link should carry. Display-only, all
   three, so the walk survives the trip home (3.2). */
let widgetApi = null;

/* THE BUTTON IS RELEASED BEFORE THE VIEWPOINT IS WRITTEN, and the order is
   load-bearing here in a way it is not in mlp — whose reroll writes a DATA
   parameter and so never re-enters. `turn` and `tilt` are `display: true`, so
   each write runs `rebuild` again; with the release last, `homeView` would
   still be true on the way back in and the second write would call this
   function once more, for ever. Released first, every re-entry meets the guard
   above and stops. */
function homeTheView() {
  if (!widgetApi || !widgetApi.params.homeView) return;
  widgetApi.setParam("homeView", false);
  widgetApi.setParam("turn", RELIEF_DEFAULT_AZ);
  widgetApi.setParam("tilt", RELIEF_DEFAULT_EL);
}

/* Which clock a page runs on. The Derivative tab has its own row in
   `EPOCH_MS`, and on the other two tabs the page is the `view`. */
const clockView = (params) => (params.tab === "derivative" ? "derivative" : params.view);

widgetApi = defineWidget({
  slug: "gradients",
  title: "Gradients",
  status: "draft",
  subtitle:
    "A derivative is how much y changes for a small change in a. A partial "
    + "derivative is that along one variable with the others held constant, "
    + "and the gradient is the vector of them. Gradient descent steps against "
    + "that vector.",
  layout: "side",
  height: ({ w }) => stageHeight(w),

  params: {
    /* THE THREE IDEAS IN ORDER, and the widget's only structural control, so it
       comes before everything a page of it sets (3.1). Data, not display: each
       tab computes a different thing, and there is no work to preserve across
       them. */
    tab: {
      type: "segmented",
      label: "Topic",
      options: [
        {
          value: "derivative",
          label: "Derivative",
          detail: "how much y changes for a small change in a",
        },
        {
          value: "partial",
          label: "Partial derivatives",
          detail: "the slope along each variable with the other held constant, and the vector of the two",
        },
        {
          value: "descent",
          label: "Descent",
          detail: "steps against the gradient of a loss, at a size the learning rate sets",
        },
      ],
      default: "derivative",
    },
    a: {
      type: "float",
      label: "a",
      min: -1,
      max: 4,
      step: 0.1,
      default: 2,
      detail: "the point the derivatives are taken at",
      when: { param: "tab", oneOf: ["derivative", "partial"] },
    },
    b: {
      type: "float",
      label: "b",
      min: -1,
      max: 3,
      step: 0.1,
      default: 1,
      detail: "held constant for ∂y/∂a, varied for ∂y/∂b",
      when: { param: "tab", equals: "partial" },
    },
    da: {
      type: "choice",
      label: "Δa",
      /* A `detail` is a STATIC string, so it says what Δa is and what the
         secant's slope is in terms of the derivative, rather than a number
         that would move with the `a` slider under it. On this function the
         secant through a and a + Δa has slope dy/da + Δa exactly, at every a
         and every b, so each rung's description is true wherever a stands. */
      options: NUDGES.map((v) => ({
        value: String(v),
        label: String(v),
        detail: `a change of ${v} in a; the secant over it has slope dy/da + ${v}`,
      })),
      default: "0.5",
      when: { param: "tab", equals: "derivative" },
    },

    lossSec: { type: "section", label: "The loss", when: { param: "tab", equals: "descent" } },
    view: {
      type: "segmented",
      label: "Parameters",
      options: [
        {
          value: "one",
          label: "One parameter",
          detail: "b₁ descends alone, with b₀ held at its least-squares value",
        },
        {
          value: "two",
          label: "Two parameters",
          detail: "b₀ and b₁ descend together over the loss surface",
        },
      ],
      default: "one",
      when: { param: "tab", equals: "descent" },
    },
    /* WHICH OF THE TWO DESCENDS, and it is a DATA control: it decides the walk,
       so a change starts a new one. Directly under the page it belongs to, in
       the reading order the rail already has — what am I looking at, then which
       part of it moves (3.1).

       The pair is the trench's two curvatures said one dimension at a time. The
       loss along b₀ has curvature 2 on any design at all, and along b₁ it is
       2 × mean(x²), which is 67 on raw x — so at α 0.3 the intercept keeps 0.4
       of its distance to the fit every step and the slope is thrown away from
       it. Nothing else in the widget lets a reader hold one number and change
       only the curvature under it. */
    which: {
      type: "segmented",
      label: "Descend",
      options: [
        {
          value: "b1",
          label: "b₁, the slope",
          detail: "b₀ held at its least-squares value",
        },
        {
          value: "b0",
          label: "b₀, the intercept",
          detail: "b₁ held at its least-squares value",
        },
      ],
      default: "b1",
      when: { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "one" }] },
    },
    scale: {
      type: "segmented",
      label: "Covariate",
      options: [
        {
          value: "raw",
          label: "Raw x",
          detail: "x from 0 to 10. Curvature 67 along b₁, 2 along b₀",
        },
        {
          value: "standardized",
          label: "Standardized x",
          detail: "x centred and divided by its standard deviation. Curvature 2 along both",
        },
      ],
      default: "raw",
      when: { param: "tab", equals: "descent" },
    },
    /* How to look at the surface, after what it is made of. Display-only: the
       relief is a second reading of the map's own window, so switching mid-walk
       keeps the walk (3.2).

       ON BOTH SURFACES, WHICH IS WHY THE GATE IS A DISJUNCTION. The Partial
       derivatives tab has one all the way through; Descent has one on its
       two-parameter page and a curve on the other, and a control offering to
       turn a curve would be a control with no idea in it (3.5). `any` went into
       core's `when` grammar for this, beside the `all` and `oneOf` that arrived
       the same way.

       THE TWO DESCRIPTIONS NAME NEITHER FUNCTION, and that is 2.11: one control
       now sits over two surfaces, and a sentence about the loss would be false
       on the tab where the surface is y = a² + 3ab. What the control changes is
       how the surface is drawn, and both descriptions say only that. */
    relief: {
      type: "segmented",
      label: "Surface",
      options: [
        {
          value: "map",
          label: "Map",
          detail: "colour alone, seen from straight above",
        },
        {
          value: "relief",
          label: "Relief",
          detail: "height as well as colour, seen from an angle; drag the surface to turn it",
        },
      ],
      default: "map",
      display: true,
      when: {
        any: [
          { param: "tab", equals: "partial" },
          { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "two" }] },
        ],
      },
    },
    /* THE WAY HOME FROM A DRAG, and the one piece of the camera that belongs
       in the rail: not a number to set but an action to take (decision 6).
       Momentary — pressed, `rebuild` writes the two viewpoint parameters and
       releases it — so the URL carries the angle and never the press. Beside
       the surface it turns, and only while there is a surface to turn. */
    homeView: {
      type: "bool",
      style: "action",
      label: "Default view",
      detail: "turns the surface back to the viewpoint the figure opens at",
      default: false,
      display: true,
      when: {
        all: [
          { param: "relief", equals: "relief" },
          {
            any: [
              { param: "tab", equals: "partial" },
              { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "two" }] },
            ],
          },
        ],
      },
    },
    /* THE VIEWPOINT, AS TWO PARAMETERS. Decision 5 in the header says why they
       are parameters and not animation state. No rail control: the drag is the
       control, so both are hidden and travel in the URL the way `shown` does.
       Display-only, because turning the camera is a second reading of a walk
       already taken and must not discard it (3.2). */
    turn: {
      type: "int", min: 0, max: 359, default: RELIEF_DEFAULT_AZ, hidden: true, display: true,
    },
    tilt: {
      type: "int", min: 10, max: 85, default: RELIEF_DEFAULT_EL, hidden: true, display: true,
    },

    stepSec: { type: "section", label: "The step", when: { param: "tab", equals: "descent" } },
    lr: {
      type: "choice",
      label: "Learning rate α",
      options: LR_LADDER.map((v) => ({ value: String(v), label: String(v), detail: LR_DETAIL })),
      default: "0.01",
      when: { param: "tab", equals: "descent" },
    },
    /* Only on the two-parameter page: the one-parameter walk takes the
       gradient over all 100 rows, and a control that changed nothing there
       would be a control with no idea in it (3.5). */
    batch: {
      type: "choice",
      label: "Batch",
      options: BATCHES.map((b) => ({
        value: String(b),
        label: String(b),
        detail: `${b === N ? "all " : ""}${nRows(b)} in each update, so one epoch is ${nUpdates(b)}`,
      })),
      default: "100",
      when: { all: [{ param: "tab", equals: "descent" }, { param: "view", equals: "two" }] },
    },

    dataSec: { type: "section", label: "The data", when: { param: "tab", equals: "descent" } },
    seed: {
      type: "int",
      label: "Seed",
      min: 1,
      max: 30,
      default: 1,
      detail: "redraws the noise added to y = 5 + 2x",
      when: { param: "tab", equals: "descent" },
    },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        /* Both paces on every option: the pages run on different clocks
           (decision 6), and a description that named one of them would be
           right on one page and wrong on the other. The Derivative tab and the
           one-parameter page share the step clock, so one clause covers both. */
        { value: "slow", label: "Slow", detail: "2.5 seconds a step, or 2 seconds an epoch over the loss surface with the partial derivatives drawn first" },
        { value: "medium", label: "Medium", detail: "1.2 seconds a step, or 60 epochs a second over the loss surface" },
        { value: "fast", label: "Fast", detail: "0.4 seconds a step, or 250 epochs a second over the loss surface" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
      /* Only where something moves. The Partial derivatives tab is at rest and
         declines both drive buttons, so a pace for them would be a control with
         no idea in it (3.5). */
      when: { param: "tab", oneOf: ["derivative", "descent"] },
    },

    /* Authoring escape hatch, first render only: epochs already walked on
       Descent, rungs already taken down the ladder on Derivative. */
    shown: { type: "int", min: 0, max: EPOCHS, default: 0, hidden: true },
  },

  /* The legend has to match the graph, and the two pages draw different marks
     (lm-interaction, 2026-08-29). The loss curve and the path take ink rather
     than a series colour: they are the frame the walk moves on and the trail
     it leaves, not measurements of anything.

     EVERY SLOPE IS ONE COLOUR NOW (decision 12), so a row that named a
     highlight mark and a slope mark together is two rows, and a row whose marks
     are all slopes stays whole — naming one colour twice to say one thing is
     the fault the split exists to fix, not a second application of it. The
     Derivative tab's two rows share a colour and differ in the MARK, solid
     against dashed, which is what `mark: "dash"` is for. */
  legend: ({ params }) => (params.tab === "derivative"
    ? [
      { token: "ink-2", label: "y = a² + 3ab, with b held at 1", mark: "line" },
      { token: "slope", label: "The secant through a and a + Δa, whose slope is Δy/Δa", mark: "line" },
      { token: "slope", label: "The tangent at a, the limit of the secant as Δa → 0", mark: "dash" },
      { token: "ink-1", label: "Δa and Δy, whose ratio is the secant's slope", mark: "dash" },
    ]
    : params.tab === "partial"
      /* THE TWO SLICES CARRY THE TWO COLOURS (decision 10), so each entry names
         one variable held and everything drawn in that colour: the plane or the
         cut line, the curve on the surface, and the panel beside the map. */
      ? params.relief === "relief"
        ? [
          { token: "group-a", label: "The plane where b is held, and y along a on it", mark: "line" },
          { token: "group-b", label: "The plane where a is held, and y along b on it", mark: "line" },
          { token: "slope", label: "The tangent on each slice, and the gradient on the surface", mark: "line" },
          /* Only in relief: on the map nothing is in front of a slice. */
          { token: "ink-1", label: "A slice behind the surface", mark: "dash" },
        ]
        : [
          { token: "group-a", label: "y along a, with b held: the line on the map and the slice beside it", mark: "line" },
          { token: "group-b", label: "y along b, with a held: the line on the map and the slice beside it", mark: "line" },
          { token: "slope", label: "The tangent on each slice, and the gradient on the map", mark: "line" },
        ]
      : params.view === "two"
        ? [
          { token: "unknown", label: "The 100 rows", mark: "dot" },
          { token: "highlight", label: "The line at this epoch", mark: "line" },
          /* In relief the two partials are tangents on the surface and carry
             this colour with the arrow; on the map they are the arrow's own
             components and stay ink, so the row names only the arrow. */
          { token: "slope",
            label: params.relief === "relief"
              ? "The tangent along each parameter, and the direction of the next step"
              : "The direction of the next step",
            mark: "line" },
          { token: "reference", label: "The least-squares line, and its (b₀, b₁)", mark: "dash" },
          { token: "ink-1", label: "The path taken so far", mark: "line" },
          /* Only on the map: the straight line the step does NOT take, which
             the angle line under the panel measures the step against. */
          ...(params.relief === "map"
            ? [{ token: "extreme", label: "The straight line from here to the least-squares point", mark: "dash" }]
            : []),
          /* Only in relief: on the map nothing is in front of the path. */
          ...(params.relief === "relief"
            ? [{ token: "ink-1", label: "The path behind the surface", mark: "dash" }]
            : []),
          { token: "empirical", label: "Loss after each epoch", mark: "line" },
        ]
        /* The one-parameter page draws the data panel too since decision 11,
           so its legend carries the rows that panel needs — the rows and the
           two lines — as well as the parabola's own. Every mention of the
           coordinate comes off `ONE`, so choosing b₀ renames the legend with
           the figure. */
        : [
          { token: "unknown", label: "The 100 rows", mark: "dot" },
          { token: "ink-2", label: `The loss over ${ONE[params.which].symbol}, with ${ONE[params.which].other} held`, mark: "line" },
          { token: "highlight", label: "The line at this epoch", mark: "line" },
          /* One entry for the tangent and the arrow, which are one colour doing
             one job: the tangent IS the slope and the arrow is the direction
             that slope sends the step. */
          { token: "slope", label: `The tangent whose slope is ${ONE[params.which].partial}, and the direction of the next step`, mark: "line" },
          { token: "reference", label: `The least-squares line, and ${ONE[params.which].symbol} at that fit`, mark: "dash" },
          { token: "ink-1", label: "The steps taken so far", mark: "line" },
          { token: "empirical", label: "Loss after each epoch", mark: "line" },
        ]),

  compute({ params, rng }) {
    /* THE TWO CONCEPT TABS HAVE NO DATA AND NO RNG. y = a² + 3ab is the whole
       of what they draw, so what `compute` produces is where the Derivative
       tab's ladder starts and how many rungs are left below it — the only thing
       its animation reveals. */
    if (params.tab !== "descent") {
      const start = Math.max(0, NUDGES.map(String).indexOf(params.da));
      return { kind: params.tab, start, rungs: NUDGES.length - 1 - start };
    }
    const { x, y } = makeData(rng);
    const xs = params.scale === "standardized" ? standardize(x) : x;
    const q = quad(xs, y);
    const dom = domainFor(q);
    const lr = Number(params.lr);
    const batch = Number(params.batch);
    const track = params.view === "one"
      ? descendOne(q, lr, EPOCHS, params.which)
      : batch >= q.n
        ? descendFull(q, lr, EPOCHS)
        : descendMini(q, lr, EPOCHS, batch, rng);
    return {
      kind: "descent",
      q,
      dom,
      track,
      lr,
      batch: params.view === "one" ? q.n : batch,
      contours: contourSegments(q, dom, LEVELS),
      /* what the surface bitmap is keyed on: the data and the scale are the
         only things that move it */
      sig: `${params.scale}:${params.seed}`,
      /* and what the relief's visible/hidden split is keyed on — the surface,
         plus everything that decides where the walk goes on it */
      walkSig: `${params.scale}:${params.seed}:${params.view}:${params.which}:${params.lr}:${params.batch}`,
    };
  },

  animation: {
    /* THE TWO TABS THAT DRIVE NAME DIFFERENT NOUNS (3.4c), so the labels take
       the map form. "Next epoch" is two words and not one: with batches of 10
       or 1 an epoch holds many steps, so "Step" would name the wrong unit; it
       is also the label the other gradient descent widget in the arc uses.

       "SHRINK", NOT "HALVE". The ladder is 1 · 0.5 · 0.25 · 0.1 · 0.05 · 0.01
       and two of its five rungs are not halvings, so a button promising one
       would be false on the very press that made it (4.4b). */
    stepLabel: {
      param: "tab",
      labels: { derivative: "Shrink Δa", descent: "Next epoch" },
      default: "Next epoch",
    },
    stepTitle: {
      param: "tab",
      labels: {
        derivative: "Take Δa to the next smaller value, toward 0.01",
        descent: "Take one epoch of gradient descent and redraw the descent",
      },
      default: "Take one epoch of gradient descent and redraw the descent",
    },
    runLabel: "Play",
    runTitle: {
      param: "tab",
      labels: {
        derivative: "Take Δa down to 0.01, one value at a time",
        descent: "Descend to epoch 1000, or to the epoch the descent diverges at",
      },
      default: "Descend to epoch 1000, or to the epoch the descent diverges at",
    },

    /* THE PARTIAL DERIVATIVES TAB SAYS THERE IS NOTHING TO DRIVE, and core
       takes step and run out of the row (4.5). `stepLabel: null` cannot do it:
       core reads that once when the shell is built, so it would decline the
       button on all three tabs. `anim.inert` is the parameter-dependent form,
       and `hierarchical-clustering` uses it for exactly this. */
    init: ({ params, state, fromScratch }) => {
      const clock = beatMs(clockView(params), params.speed);
      if (params.tab === "partial") {
        return { inert: true, done: true, beat: 0, clock, ep: 0, rung: 0 };
      }
      if (params.tab === "derivative") {
        /* Already on the bottom rung and there is nothing to shrink, so the
           buttons go rather than greying out on the first press (4.5). */
        return {
          inert: state.rungs === 0,
          rung: fromScratch ? 0 : Math.min(Math.max(0, params.shown ?? 0), state.rungs),
          beat: 0,
          clock,
          done: false,
        };
      }
      return {
        inert: false,
        ep: fromScratch
          ? 0
          : Math.min(Math.max(0, params.shown ?? 0), state.track.epochsDone),
        beat: 0,
        /* The clock the beat in `anim.beat` is a share of. Held so `rebuild` can
           see it move; see the guard below. */
        clock,
        done: false,
      };
    },

    advance: (anim, { dt, params, state }) => {
      if (params.tab === "partial") return false;
      /* THE DERIVATIVE TAB'S UNIT IS ONE RUNG DOWN THE LADDER. Same shape as a
         choreographed epoch below — a beat that fills, then the index moves —
         so the two tabs share one clock table and one pause-then-move reading.
         It always choreographs: five rungs is the whole animation, and a pace
         that showed arrivals only would show nothing. */
      if (params.tab === "derivative") {
        if (anim.rung >= state.rungs) {
          anim.beat = 0;
          anim.done = true;
          return false;
        }
        anim.beat += dt / beatMs("derivative", params.speed);
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.rung += 1;
        if (anim.rung >= state.rungs) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }
      const end = state.track.epochsDone;
      if (anim.ep >= end) {
        anim.beat = 0;
        anim.done = true;
        return false;
      }
      /* WHICH PACE CHOREOGRAPHS IS DECLARED, never decided mid-run (4.1), and
         `model.js` declares it: Slow over the surface, every speed on the
         one-parameter page, where an epoch is a single visible hop and 60 a
         second would show none of them (decision 6). */
      const ms = beatMs(clockView(params), params.speed);
      if (ms > 0) {
        anim.beat += dt / ms;
        if (anim.beat < 1) return true;
        anim.beat = 0;
        anim.ep += 1;
        if (anim.ep >= end) anim.done = true;
        return anim.mode !== "step" && !anim.done;
      }
      anim.beat = 0;
      const target = anim.mode === "step" ? Math.min(end, anim.ep + 1) : end;
      const rate = anim.mode === "step"
        ? 1
        : Math.max(1, Math.round(dt / epochMs(clockView(params), params.speed)));
      anim.ep = Math.min(target, anim.ep + rate);
      if (anim.ep >= end) {
        anim.ep = end;
        anim.done = true;
        return false;
      }
      return anim.mode !== "step";
    },

    /* A BEAT IN FLIGHT IS CLEARED WHENEVER THE BEAT LENGTH CHANGES. Leaving a
       choreographed speed would otherwise freeze a half-drawn arrow over a
       point the walk has already left — the shipped bug `before` states exist
       for — and changing between two choreographed speeds would leave the
       fraction of one clock being read against another. Cleared here rather
       than at the next advance, because a paused animation gets no next
       advance. The guard used to name Slow, which stopped being the only
       choreographed pace with decision 6.

       The press of "Default view" arrives here too, and leaves the beat alone:
       the clock does not move, so a step in flight keeps running while the
       camera returns. */
    rebuild: (anim, { params, state }) => {
      anim.inert = params.tab === "partial"
        || (params.tab === "derivative" && state.rungs === 0);
      if (params.homeView) homeTheView();
      const ms = beatMs(clockView(params), params.speed);
      if (ms !== anim.clock) {
        anim.beat = 0;
        anim.clock = ms;
      }
    },
  },

  /* TURNING THE RELIEF. A gesture rather than two sliders, because a camera is
     one movement and the reader is looking for a direction, not setting a
     number — and through core's `drag` channel rather than a pointer of its
     own, so the viewpoint lands in `values` and a link carries the angle the
     reader stopped at (1.1, 3.6). */
  drag: {
    params: ["turn", "tilt"],
    cursor: "grab",
    /* The surface panel only, and only where there is a surface to turn: on
       the map and on the one-parameter page the same pixels hold a figure with
       no camera, and a drag across them would rotate something nobody can see
       and write two parameters into the link for it. The square is the loss
       surface's on Descent and the value map's on the Partial derivatives tab,
       which are different rects — decision 8 sized the second to the stage —
       so the region is read off `layout` rather than assumed to be one. */
    hit: ({ x, y, w, params }) => {
      if (params.relief !== "relief") return false;
      const L = layout(w);
      const r = params.tab === "partial"
        ? L.partMap
        : params.tab === "descent" && params.view === "two" ? L.surf : null;
      return r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },
    /* Half a degree a pixel: the panel is 180-300px wide, so one drag across it
       turns the surface through 90-150 degrees and a second finishes the
       circle. Rounded to whole degrees so the link stays short, and the azimuth
       wraps rather than clamping — turning past due north is a turn, not a wall.

       ELEVATION STOPS AT 85 AND 10. At 90 the projection IS the map with the
       height flattened out of it, and the depth every quad sorts on collapses
       to its own height, so the painter's order stops meaning anything; below
       10 the mesh is edge-on. The panel holds the whole surface up to 70 —
       measured over both scales and every 5 degrees of azimuth — and clips at
       most 20px of 300 off the near corner at 85, from the diagonal azimuths. */
    value: ({ dx, dy, start }) => ({
      turn: ((Math.round(start.turn - dx * 0.5) % 360) + 360) % 360,
      tilt: Math.max(10, Math.min(85, Math.round(start.tilt + dy * 0.5))),
    }),
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(params.tab, params.view, params.which);
    const L = layout(w);
    if (params.tab === "derivative") return drawDerivativeTab(ctx, colors, L, params, state, anim);
    if (params.tab === "partial") return drawPartialTab(ctx, colors, L, params);
    const { track, q } = state;
    const at = stand(state, params, anim);
    const two = params.view === "two";
    /* The one coordinate the one-parameter page is moving, and its partial —
       the same pair `readout` and `summary` take, off `model.js`'s table. */
    const C = COORD[params.which];
    const gOne = at.grad[C.i];
    const ratio = Math.max(1, track.epochLoss[at.ep] / q.Lmin);
    const divergedShown = track.diverged !== null && at.ep >= track.diverged;
    const arrived = !divergedShown && ratio < 1.01;
    const stepping = at.beat > 0;

    if (two) {
      drawData(ctx, colors, L.data, state, at.cur, params.scale);
      /* The same panel, the same rect, the same options: the relief is a
         reading of the surface the map already holds, not a second figure. */
      const drawPanel = params.relief === "relief" ? drawRelief : drawSurface;
      drawPanel(ctx, colors, L.surf, state, at.cur, {
        upto: at.upto,
        arrived,
        divergedShown,
        grad: at.grad,
        /* Where the relief is looked at from. The map ignores them, and that is
           the point: they name a camera, and looking straight down needs none. */
        az: params.turn,
        el: params.tilt,
        /* At rest, and at Medium and Fast, both parts of the step show at
           once. Slow builds them: the two components first, then the
           composition, then the move. */
        showStep: !divergedShown,
        tickMix: stepping ? Math.min(1, at.beat / BEATS_TWO.partials) : 1,
        arrowMix: stepping
          ? Math.max(0, Math.min(1, (at.beat - BEATS_TWO.partials) / (BEATS_TWO.direction - BEATS_TWO.partials)))
          : 1,
      });
      drawColourBar(ctx, colors, L.surf, {
        low: colors.costLow,
        high: colors.costHigh,
        left: "1×",
        right: `≥${Math.round(10 ** LOG_CAP)}×`,
        middle: "loss ÷ minimum, log scale",
      });
    } else {
      /* CHOREOGRAPHY A (decision 7): the tangent and the arrow are simply
         there, at full length, from the first frame to the last. What the beat
         does is hold the point still for its first 40% and then move it, and
         `stand` above is where that lives — nothing here ramps.

         The tangent takes its slope from the point it touches so that it rolls
         with the curve; `grad` is the floored one the readout, the beat line
         and the gradient VECTOR keep. `drawSlice` says why they can differ. */
      /* THE DATA BESIDE THE PARABOLA (decision 11). The same panel, the same
         rect and the same marks the two-parameter page draws: the line at this
         epoch follows whichever coordinate is descending, with the other at its
         least-squares value, so a Slow epoch is a line swinging on the left
         while the point slides down the parabola on the right. Without it the
         page showed a parameter moving and nothing it moved. */
      drawData(ctx, colors, L.data, state, at.cur, params.scale);
      drawSlice(ctx, colors, L.surf, state, at.cur, {
        upto: at.upto,
        divergedShown,
        showStep: !divergedShown,
        which: params.which,
        grad: gOne,
      });
      /* Which of the three regimes this learning rate is in, stated as the
         arithmetic that decides it rather than as a label, and on the CHOSEN
         coordinate's curvature — 2 along b₀ and 67 along b₁ on raw x, which is
         what makes the same α land in one regime or another. */
      const r = 1 - state.lr * q[C.curv];
      const a = Math.abs(r);
      const regime = a > 1
        ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and the distance to it grows.`
        : a === 1
          ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and keeps the whole distance.`
          : r < 0
            ? `1 − α × curvature = ${f3(r)}: each step crosses the fit and keeps ${f3(a)} of the distance.`
            : `1 − α × curvature = ${f3(r)}: each step keeps ${f3(r)} of the distance to the fit.`;
      label(ctx, colors, regime, L.data.x, L.regimeY, { color: colors.ink2 });
    }

    /* The beat line: what this part of a Slow epoch is doing, or — at rest and
       at the other two speeds — what one epoch is made of. */
    let said;
    if (stepping && two) {
      said = at.beat < BEATS_TWO.partials
        ? `The two partial derivatives at this point: ∂L/∂b₀ ${fSig(at.grad[0])} and ∂L/∂b₁ ${fSig(at.grad[1])}`
        : at.beat < BEATS_TWO.direction
          ? "They compose into −∇L, the direction the step takes"
          : state.batch >= q.n
            ? `The step moves (b₀, b₁) by α × ∇L, a distance of ${fSig(state.lr * Math.hypot(at.grad[0], at.grad[1]))}`
            : epochPhrase(state.batch);
    } else if (stepping) {
      /* The slope's number is on the vector's own label now, so the line names
         the two marks rather than printing one of them twice. */
      said = at.beat < BEATS_ONE.hold
        ? `The tangent at ${ONE[params.which].symbol} ${f3(at.cur[C.i])}, and −${ONE[params.which].partial}, the direction the step takes`
        : `The step is −α × ${ONE[params.which].partial} ${fSig(-state.lr * gOne)}`;
    } else {
      /* `state.batch` is the full 100 on the one-parameter page, which takes
         its gradient over every row, so one branch serves both. */
      said = `One epoch is ${epochPhrase(state.batch)}`;
    }
    label(ctx, colors, said, L.data.x, L.phaseY,
      { color: stepping ? colors.highlight : colors.ink3 });

    /* THE ANGLE BETWEEN THE STEP AND THE STRAIGHT LINE TO THE MINIMUM
       (decision 7). Its own row, filled only where the two directions are both
       drawn: the relief has no room for the straight line under the mesh, and
       once the walk has diverged the panel is already saying so. The batch's
       name goes in where the gradient is a batch's, because at batch 10 or 1
       the step follows the steepest slope of ten rows or one and not of all
       hundred, and a sentence on a shared surface has to be true in every state
       that shows it (2.11). */
    if (two && params.relief === "map" && !divergedShown) {
      const deg = stepAngle(q, at.cur[0], at.cur[1], at.grad[0], at.grad[1]);
      label(ctx, colors, arrived || deg === null
        ? "The descent is at the minimum"
        : `The step follows the ${state.batch >= q.n ? "" : "batch's "}steepest slope, `
          + `${Math.round(deg)}° from the straight line to the minimum`,
      L.data.x, L.angleY, { color: colors.ink2 });
    }

    drawStrip(ctx, colors, L.strip, state, at.ep);
  },

  readout({ params, state, anim }) {
    /* THE DERIVATIVE TAB'S FOUR NUMBERS ARE ONE ARGUMENT, and they read in the
       order the definition is built: the change in a, the change in y it
       produces, the ratio of the two, and the limit that ratio is heading for.
       The last tile's note is the whole of what the ladder demonstrates — on
       this function the secant's slope is dy/da + Δa exactly, at every a and
       every b, so the distance between the third tile and the fourth is the
       first tile. */
    if (params.tab === "derivative") {
      const at = standNudge(state, params, anim);
      const slope = gradFn.da(params.a, B_HELD);
      const moved = gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD);
      return [
        { label: "Δa", value: fSig(at.da), note: "the change in a, from a to a + Δa" },
        { label: "Δy", value: fSig(moved), note: "the change in y over it" },
        { label: "Δy/Δa", value: fSig(moved / at.da), note: "the secant's slope through the two points" },
        { label: "dy/da", value: f2(slope), note: "the limit as Δa → 0; the secant is above it by Δa" },
      ];
    }
    if (params.tab === "partial") {
      const { a, b } = params;
      return [
        { label: "a, b", value: `${f1(a)}, ${f1(b)}`, note: "the point on the map" },
        { label: "y", value: f2(gradFn.y(a, b)), note: "a² + 3ab at that point" },
        {
          label: "∂y/∂a, ∂y/∂b",
          value: `${f1(gradFn.da(a, b))}, ${f1(gradFn.db(a))}`,
          note: "the gradient: 2a + 3b along a, 3a along b",
        },
        {
          label: "|∇y|",
          value: fSig(Math.hypot(gradFn.da(a, b), gradFn.db(a))),
          note: "the length of the gradient, in y per unit of (a, b)",
        },
      ];
    }
    const { track, q } = state;
    const at = stand(state, params, anim);
    const two = params.view === "two";
    const C = COORD[params.which];
    const nm = ONE[params.which];
    const gOne = at.grad[C.i];
    const divergedShown = track.diverged !== null && at.ep >= track.diverged;
    const ratio = Math.max(1, track.epochLoss[at.ep] / q.Lmin);
    const step = two
      ? state.lr * Math.hypot(at.grad[0], at.grad[1])
      : state.lr * Math.abs(gOne);
    return [
      {
        label: "Epoch",
        value: String(at.ep),
        note: `of ${EPOCHS}`,
      },
      two
        ? {
          label: "b₀, b₁",
          value: `${f2(at.cur[0])}, ${f2(at.cur[1])}`,
          note: `least squares ${f2(q.B0)}, ${f2(q.B1)}`,
        }
        : {
          label: nm.symbol,
          value: f3(at.cur[C.i]),
          note: `least squares ${f3(q[C.fit])}, with ${nm.other} held at ${f2(q[C.held])}`,
        },
      {
        label: "Loss ÷ minimum",
        value: divergedShown ? "diverged" : xTimes(ratio),
        note: divergedShown
          ? `at epoch ${track.diverged}`
          : "1× at the least-squares line",
      },
      two
        ? {
          label: "∂L/∂b₀, ∂L/∂b₁",
          value: `${fSig(at.grad[0])}, ${fSig(at.grad[1])}`,
          note: state.batch >= q.n
            ? "over all 100 rows"
            : `over the next ${state.batch === 1 ? "row" : `${state.batch} rows`}`,
        }
        : {
          label: nm.partial,
          value: fSig(gOne),
          note: `the tangent's slope at this ${nm.symbol}`,
        },
      {
        label: "Step length",
        value: fSig(step),
        note: "α × the gradient, in parameter units",
      },
    ];
  },

  summary({ params, state, anim }) {
    if (params.tab === "derivative") {
      const at = standNudge(state, params, anim);
      const slope = gradFn.da(params.a, B_HELD);
      const moved = gradFn.y(params.a + at.da, B_HELD) - gradFn.y(params.a, B_HELD);
      return `The curve y = a² + 3ab over a, with b held at ${B_HELD}, and two points on it at `
        + `a = ${f1(params.a)} and a + Δa = ${f1(params.a + at.da)}. The secant through them rises `
        + `${fSig(moved)} over a run of ${fSig(at.da)}, a slope of ${fSig(moved / at.da)}, against the `
        + `tangent's ${f2(slope)} drawn faint through the first point.`;
    }
    if (params.tab === "partial") {
      const { a, b } = params;
      return `y = a² + 3ab over a and b with contour rings, ${params.relief === "relief"
        ? "raised as a surface with the two slicing planes through it and the curve each one cuts"
        : "painted as a map"}, the point (${f1(a)}, ${f1(b)}) on it, `
        + `and the gradient (${f1(gradFn.da(a, b))}, ${f1(gradFn.db(a))}) drawn from it as an arrow uphill. `
        + `Beside it, the two slices through that point, each with its tangent.`;
    }
    const { track, q } = state;
    const at = stand(state, params, anim);
    const parts = params.view === "two"
      ? [
        `A scatter of y against x for ${N} rows with the line b₀ ${f2(at.cur[0])}, b₁ ${f2(at.cur[1])} drawn through it, beside the loss ${params.relief === "relief" ? "raised as a surface" : "painted"} over every (b₀, b₁) pair.`,
        `The descent has taken ${at.ep} of ${EPOCHS} epochs from (0, 0) at learning rate ${state.lr}.`,
      ]
      : [
        `A scatter of y against x for ${N} rows with the line b₀ ${f2(at.cur[0])}, b₁ ${f2(at.cur[1])} drawn through it, beside the loss as a curve over ${ONE[params.which].symbol} with ${ONE[params.which].other} held at ${f2(q[COORD[params.which].held])}.`,
        `The descent has taken ${at.ep} of ${EPOCHS} epochs from ${ONE[params.which].symbol} = 0 at learning rate ${state.lr}, and stands at ${f3(at.cur[COORD[params.which].i])}.`,
      ];
    parts.push(track.diverged !== null && at.ep >= track.diverged
      ? `It diverged at epoch ${track.diverged}.`
      : `The loss is ${xTimes(Math.max(1, track.epochLoss[at.ep] / q.Lmin))} its minimum.`);
    parts.push("Beneath, the loss after each epoch on a log scale.");
    return parts.join(" ");
  },
});
