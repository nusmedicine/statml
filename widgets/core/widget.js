/* ============================================================================
   defineWidget() — the contract every widget in the collection obeys.

   A widget supplies data, drawing, and (optionally) an animation. Core supplies
   everything else: URL state, controls, seeded RNG, theming, legend, stat tiles,
   table view, PNG export, the shareable link, and iframe height reporting. The
   point of the contract is that widget #20 costs a fraction of widget #1, and
   that all forty look and behave like one thing.

       defineWidget({
         slug, title, subtitle, height,
         params:   { n: { type: 'int', min: 1, max: 100, default: 5 } },
         legend:   [{ token: 'empirical', label: 'Simulated', mark: 'bar' }],
         compute:  ({ params, rng }) => state,     // data, no drawing
         draw:     ({ ctx, colors, w, h, params, state, anim }) => {},
         readout:  ({ params, state, anim }) => [{ label, value, note }],
         table:    ({ params, state, anim }) => ({ columns, rows }),
         animation: { init, advance },              // see below
       })

   THREE INVARIANTS worth knowing before you write a widget:

   1. `params` is the only state of record. The URL, the shareable link, and the
      controls all track it. Animation state lives in a separate `anim` object
      and never writes to params, so an animation interrupted by a resize, a
      navigation, or a slider drag cannot leave the widget lying about itself.

   2. `compute` is pure and seeded. Same params, same state, every time. That is
      what makes a URL reproducible and what will make this testable.

   3. `compute` runs on parameter changes only, never per animation frame.
      Animations are a progressive *reveal* of already-computed data, which is
      why the end of an animation lands exactly on the static picture instead of
      drifting somewhere near it.

   THE ANIMATION CONTRACT

       animation: {
         init:    ({ params, state }) => animState,
         advance: (anim, { dt, params, state }) => boolean,
       }

   `advance` mutates `anim` by `dt` milliseconds and returns true while there is
   more to show. Returning false stops the loop and leaves `anim` in place, so a
   partially built picture stays on screen. Set `anim.done = true` when there is
   genuinely nothing left, and the next Play starts fresh.

   `anim.mode` is 'run' (play to the end) or 'step' (advance one logical unit and
   stop) — the widget decides what a logical unit is. Core reads only `done` and
   sets `mode`; everything else in `anim` belongs to the widget.

   A STEP LABEL MAY DEPEND ON A PARAMETER, and declares which one:

       animation: {
         stepLabel: { param: 'view', labels: { mcmc: 'Propose a move' },
                      default: 'Add a count' },
       }

   A plain string is still a plain string. The map form exists because a widget
   whose tabs drive genuinely different nouns cannot obey 3.4c with one label —
   widget 9's three grid tabs advance an OBSERVATION and its fourth advances a
   DRAW, which are not the same kind of thing. Widget 8 hit a weaker version of
   this and settled for the bland "Step".

   DECLARATIVE, and for the same reason `when: { param }` is: core has to know
   WHICH parameter the label depends on, and it has to know every label the
   button can hold. A function could supply the current label and not the set,
   and the set is what 3.4d reserves the button's width against — a label that
   changes at runtime is exactly the defect that record describes.

   A LEAD ACTION: something that happens ONCE, before stepping is meaningful.

       animation: { leadLabel: 'Sample the population', ... }

   Declaring `leadLabel` adds one more drive button, ahead of the others, which
   runs `advance` with `anim.mode === 'lead'`. The widget sets `anim.leadDone`
   when it has happened. Core does the rest: the lead button disables itself
   afterwards, and step and run stay disabled until then, so the sequence cannot
   be taken out of order.

   The point is pedagogical, not mechanical. `bootstrap` draws the single sample
   you are stuck with, then resamples it as often as you like — and the lead
   button greying out permanently is the lesson, because in real life you cannot
   go back to the population for more. `permutation-test` will have the same
   shape: observe the data once, shuffle its labels many times. Only Reset brings
   the lead action back.

   REPLAY THEREFORE KEEPS IT. `init` receives `leadDone`, true when the reader
   pressed Replay on a finished animation and the lead had already run. A widget
   with a lead honours it:

       init: ({ leadDone }) => ({ leadDone: Boolean(leadDone), ... })

   Without that, Replay re-ran `init` from nothing and un-dealt the data, so a
   button labelled Replay produced a blank figure with step and run disabled.
   Reset is the way back to before the lead, and it should be the only one.

   SPOILER-FREE BY CONSTRUCTION: a widget that declares an animation is re-inited
   on load and on every DATA parameter change, so `anim` is always the thing
   drawn and there is no "finished" picture to give the answer away before the
   student has built it. A widget that wants to publish a finished state does it
   through a parameter (see `shown` in the CLT widget), which keeps it in the URL
   and therefore shareable, rather than as a special case in here.

   DATA PARAMETERS vs DISPLAY PARAMETERS

   A parameter marked `display: true` changes only how the state is drawn, never
   what it is. Toggling an overlay, or rescaling an axis, must NOT throw away
   work the student has done — that is the difference between an overlay and a
   reset, and getting it wrong makes a checkbox feel like a demolition. So:

     data param   (dist, n, seed)   -> recompute, re-init the animation
     display param (overlays, view) -> recompute, REBUILD the animation, repaint

   Rebuild exists because some display changes do alter derived state: changing
   an axis range changes the binning, so per-bin counts must be re-derived. A
   widget with such a parameter supplies:

       animation: { init, advance, rebuild(anim, { params, state }) }

   `rebuild` re-derives everything downstream from the part of `anim` that is
   genuinely invariant — for the CLT widget, how many samples the student has
   drawn. If a widget has no binning-dependent animation state it can omit it.
   ========================================================================= */

import { resolveParams, syncUrl, toQuery } from "./params.js";
import { buildControls, buildActions, gatingParams } from "./controls.js";
import { createCanvas } from "./canvas.js";
import { makeRng } from "./rng.js";
import {
  readTokens, resolveTheme, isEmbedded, reportHeight, onThemeChange,
  themeMode, setThemeMode, nextThemeMode,
} from "./env.js";

const MAX_FRAME_MS = 64; // clamp dt so a stalled tab does not jump the animation

/* --- theme icons -------------------------------------------------------- *
 * Built as elements rather than markup strings so nothing in core needs
 * innerHTML. `stroke: currentColor` is what lets one icon work in both themes:
 * it tracks the button's ink, so there is no icon colour to add to tokens.css
 * and no second copy to keep in step. */
const SVG_NS = "http://www.w3.org/2000/svg";

function icon(parts) {
  const s = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 16 16", width: 15, height: 15, "aria-hidden": "true",
    fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round",
  })) s.setAttribute(k, String(v));
  for (const [tag, attrs] of parts) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    s.appendChild(e);
  }
  return s;
}

const RAYS = [[8,1.3,8,2.7],[8,13.3,8,14.7],[1.3,8,2.7,8],[13.3,8,14.7,8],
              [3.4,3.4,4.4,4.4],[11.6,11.6,12.6,12.6],[12.6,3.4,11.6,4.4],[4.4,11.6,3.4,12.6]];

const THEME_ICON = {
  // A sun, a moon, and a circle half-filled — the split disc is the convention
  // for "follow the system", and it reads at a glance as neither one nor other.
  light: () => icon([["circle", { cx: 8, cy: 8, r: 3.1 }],
                     ...RAYS.map(([x1, y1, x2, y2]) => ["line", { x1, y1, x2, y2 }])]),
  dark:  () => icon([["path", { d: "M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7Z" }]]),
  auto:  () => icon([["circle", { cx: 8, cy: 8, r: 5.4 }],
                     ["path", { d: "M8 2.6a5.4 5.4 0 0 1 0 10.8Z", fill: "currentColor", stroke: "none" }]]),
};

const THEME_LABEL = { auto: "Theme: follow the system", light: "Theme: light", dark: "Theme: dark" };

export function defineWidget(config) {
  const {
    slug,
    title,
    subtitle = "",
    /* A NUMBER, or a FUNCTION of the parameters.
       Widget 7 hides its simulation panel behind a toggle, and a panel that can
       be hidden has to be able to give its pixels back — otherwise the figure
       keeps a few hundred rows of empty canvas and the toggle saves nothing that
       a reader can see. Numbers stay numbers, so nothing existing changes. */
    height = 380,
    params: spec = {},
    legend = [],
    compute = () => ({}),
    draw,
    readout = null,
    /**
     * A one-sentence description of what the figure currently shows, recomputed
     * on every paint and used as the figure's accessible label.
     *
     * Canvas is not screen-readable, so a widget owes a reading of its figure in
     * text. Stat tiles are usually that reading — but a deliberately qualitative
     * widget should not be forced to invent numbers it does not want to show, and
     * `summary` is the alternative. A widget should provide at least one of the two.
     */
    summary = null,
    table = null,
    animation = null,
    png = false, // opt-in: most teaching widgets do not need an export button
    /**
     * "shipped" | "draft". A draft is a widget being built: it deploys to its
     * FINAL url from the first commit so no link ever has to move, but it is
     * left off the gallery and wears a bar saying so. `npm run check` asserts
     * this agrees with the widget's entry in manifest.json.
     */
    status = "shipped",

    /* "stack" (default) or "side". Side puts the controls in a left rail beside
       the figure instead of above it, which is what lets a tall widget fit one
       screen — the controls and the thing they change are visible together.

       OPT-IN, and that is the whole point: making it global would widen every
       widget's canvas and invalidate all 39 fingerprint baselines at once. This
       way only a widget that asks for it moves. Falls back to the stack below
       880px, so the narrow case is unaffected either way. */
    layout = "stack",
    mount = "#widget",
  } = config;

  const theme = resolveTheme();
  if (isEmbedded()) document.body.dataset.embed = "1";
  document.title = `${title} · statml widgets`;

  const values = resolveParams(spec, new URLSearchParams(location.search));
  const host = document.querySelector(mount);
  const dom = buildShell(host, {
    title,
    subtitle,
    legend,
    status,
    layout,
    hasReadout: Boolean(readout),
    hasTable: Boolean(table),
  });

  const surface = createCanvas(dom.figure, height);
  let colors = readTokens();
  let state = null;
  let anim = null;
  let tableOpen = false;
  let rafId = null;
  let lastTs = 0;
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- recompute / paint / render --------------------------------------- *
   * Kept apart because animation frames must paint without recomputing: a
   * 2000-sample compute() on every frame would be unusable.                */

  function recompute() {
    colors = readTokens();
    const rng = makeRng(values.seed ?? 1);
    state = compute({ params: { ...values }, rng, colors });
  }

  function paint({ syncAddressBar = false } = {}) {
    // Resolve a parameter-dependent height BEFORE resize, or the canvas paints
    // at the previous size for one frame and the panels jump.
    if (typeof height === "function") surface.setHeight(height({ ...values }));
    const { w, h } = surface.resize();
    surface.clear();
    draw({ ctx: surface.ctx, colors, w, h, params: { ...values }, state, anim });

    if (readout) {
      renderReadout(dom.readout, readout({ params: { ...values }, state, anim, colors }));
    }
    if (summary) {
      dom.figure.setAttribute("aria-label", summary({ params: { ...values }, state, anim }));
    }
    if (table && tableOpen) {
      renderTable(dom.tableWrap, table({ params: { ...values }, state, anim }));
    }
    if (syncAddressBar) syncUrl(spec, values);
  }

  /**
   * An authored head start (the CLT widget's `shown`) applies to the FIRST
   * render only. It describes how the figure arrives, not a property it keeps:
   * once the reader has touched a control they are exploring, and exploring must
   * be spoiler-free, so every later re-init starts empty. Sticking to the
   * authored value would hand them a fresh spoiled figure on every change.
   *
   * `fromScratch` forces the same for Replay, which would otherwise be a dead
   * button on a pre-filled figure.
   */
  let seededOnce = false;

  function resetAnim({ fromScratch = false, keepLead = false } = {}) {
    if (!animation) return;
    anim = animation.init({
      params: { ...values },
      state,
      colors,
      fromScratch: fromScratch || seededOnce,
      /* REPLAY REPLAYS THE LOOP; IT DOES NOT UN-DEAL THE DATA. A lead action is
         the thing you get once — bootstrap's single sample, widget 8's twelve
         counts — and a Replay that threw it away left the reader looking at a
         blank figure with step and run disabled, having pressed a button
         labelled "Replay". Reset is the way back to before the lead, and it is
         the only one; that is what makes the lead's permanence mean something.
         The widget honours this in its own `init`, because `anim` is the
         widget's object and core does not write into it. */
      leadDone: keepLead,
    });
    seededOnce = true;
  }

  function render(opts = {}) {
    recompute();
    resetAnim();
    paint({ syncAddressBar: true, ...opts });
  }

  /* --- parameter changes ------------------------------------------------ */

  const GATES = gatingParams(spec);

  /* The name of the `gate` field, if the widget has one. Read off the spec
     rather than declared a second time under `animation`: two declarations of
     one fact is how they come to disagree (principle 5.8). */
  const GATE_PARAM = Object.entries(spec).find(([, f]) => f.type === "gate")?.[0] ?? null;

  /* A SHUT GATE TAKES THE WHOLE DRIVE ROW WITH IT, and the early return below
     skips every label and disabled flag on the way out — so the row is not
     merely hidden, it is stale. That is right for `power-and-error`, whose gate
     opens the ONLY thing there is to drive.

     It is wrong for a widget whose drive row PREDATES its gate, and that has
     bitten once: `maximum-likelihood` briefly used a gate to open a second
     sweep on top of a first one that was already fully drivable, and shipped
     with four dead buttons in its default state. An opt-out was added, removed
     as unused, and added again before that widget settled on a segmented tab
     instead and stopped needing one. It is not carried here now — nothing uses
     it — but a third widget in that shape should reach for a `segmented`
     control rather than a gate, or bring the opt-out back. */

  function setParam(name, value) {
    values[name] = value;

    /* A readback reports a function of SEVERAL parameters, so no single
       control's own setter can keep it current. Refreshed here, before the
       branches below return, because every one of them is a change it might be
       reporting on — and because a `display` change returns early and a data
       change returns later, so anywhere else would miss one of them. */
    controls.refresh(values);

    /* A parameter other fields are gated on has just moved, so which controls
       exist has changed. Rebuilt here and nowhere else: rebuilding on every
       change would drop a slider mid-drag. */
    if (GATES.has(name)) {
      // Shutting the gate takes the figure the animation was painting into away.
      if (name === GATE_PARAM && !value) stopAnim();
      controls.rebuild(values);
      updateAnimButtons();
    }

    if (spec[name]?.display) {
      // Display-only: keep the student's work. The state is recomputed because
      // some display parameters change derived shapes (an axis range changes the
      // binning), and the animation re-derives itself from what it holds that is
      // genuinely invariant. A playing animation keeps playing.
      recompute();
      animation?.rebuild?.(anim, { params: { ...values }, state, colors });
      paint({ syncAddressBar: true });
      updateAnimButtons();

      /* A DISPLAY CHANGE MAY DESERVE A TRANSITION. Some toggles switch between
         two readings of the SAME data, and easing between them is what shows it
         is the same data — a jump only asserts it. Widget 12's two denominators
         are the case: the deaths must be seen not to move while what they are
         measured against does.

         Core supplies the frames and nothing else. The widget decides there is
         something to ease, in `rebuild`, by setting `anim.easing`; `advance`
         clears it when the ease lands. Narrow on purpose, exactly like the
         gate's entry animation below — an ordinary display toggle stays
         instant, which is what every widget before this one wants. */
      /* CONSUMED, not merely read. `easing` is a REQUEST for frames, and a
         request that survives being granted is a request that gets granted
         again: any display change while an ease is in flight — dragging a
         slider, say — would stop and restart the loop, resetting its frame
         budget every time. Clearing it here means the widget asks once and core
         answers once. */
      if (anim?.easing) {
        anim.easing = false;
        /* Do not restart a loop that is already easing. `startAnim` stops the
           pending frame before scheduling a new one, so a display parameter
           changing faster than the frame clock — a slider being dragged, or a
           test harness setting seventy parameters a second — cancels every
           frame before it runs and the ease never advances at all. Found by a
           sweep that measured a permanently stuck transition and blamed the
           widget. */
        if (rafId === null || anim.mode !== "ease") startAnim("ease");
      }
      return;
    }

    // Data change: the samples underneath just became different samples, so a
    // half-built picture of the old ones would be a lie. Start empty.
    stopAnim();
    render();

    /* OPENING A GATE MAY PLAY THE STAGE IN. A gate is the one parameter change
       that is a reader stepping THROUGH a door rather than turning a dial, and
       what is behind it can be worth watching arrive: widget 10's sample falls
       out of the two curves it was drawn from, which is the sampling idea
       itself and is lost if 200 dots simply appear.

       Narrow on purpose. Only the gate does this, and only when it OPENS — an
       ordinary data change must not, or dragging a slider would restart the
       animation on every `input` event it fires. The widget opts in by setting
       `anim.entry` in `init`; without it nothing happens, which is every widget
       but one. */
    if (name === GATE_PARAM && values[name] && anim?.entry) startAnim("enter");
    updateAnimButtons();
  }

  /* THE SPEC SPLITS IN TWO, and the split is purely about position: fields
     marked `afterDrive` build into the block below the drive row, everything
     else into the block above it. Both halves keep the declaration ORDER of the
     original spec, so `section`, `when` and `row` behave in each exactly as they
     do in one block. Two `buildControls` calls, one merged api, so nothing
     downstream has to know there are two. */
  const specMain = {};
  const specAfter = {};
  for (const [name, field] of Object.entries(spec)) {
    (field.afterDrive ? specAfter : specMain)[name] = field;
  }
  const hasAfter = Object.keys(specAfter).length > 0;
  const controlsMain = buildControls(dom.controls, specMain, values, setParam);
  const controlsAfter = hasAfter
    ? buildControls(dom.controlsAfter, specAfter, values, setParam)
    : null;
  const controls = {
    sync: (name, value) => { controlsMain.sync(name, value); controlsAfter?.sync(name, value); },
    syncAll: (next) => { controlsMain.syncAll(next); controlsAfter?.syncAll(next); },
    rebuild: (next) => { controlsMain.rebuild(next); controlsAfter?.rebuild(next); },
    refresh: (next) => { controlsMain.refresh(next); controlsAfter?.refresh(next); },
  };

  /* --- animation -------------------------------------------------------- */

  function stopAnim() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = 0;
  }

  function tick(ts) {
    const dt = lastTs ? Math.min(MAX_FRAME_MS, ts - lastTs) : 16;
    lastTs = ts;

    const more = animation.advance(anim, { dt, params: { ...values }, state, colors });
    paint();

    if (more) {
      rafId = requestAnimationFrame(tick);
    } else {
      stopAnim();
      updateAnimButtons();
    }
  }

  /** Run `advance` to its next stopping point without animating. */
  function fastForward() {
    let guard = 0;
    while (animation.advance(anim, { dt: 400, params: { ...values }, state, colors })) {
      if (guard++ > 10000) break;
    }
  }

  function startAnim(mode) {
    if (!animation || !anim) return;

    // Play acts as a play/pause toggle, but only against an actual play — a
    // step in flight is superseded by Play rather than toggling it off.
    if (mode === "run" && rafId !== null && anim.mode === "run") {
      stopAnim();
      updateAnimButtons();
      return;
    }

    if (rafId !== null) {
      const wasStepping = anim.mode === "step";
      stopAnim();
      // Clicking step again means "get on with it": finish the unit in flight
      // rather than swallowing the click, so repeated clicking stays responsive.
      if (mode === "step" && wasStepping) fastForward();
    }

    /* `=== true`, not truthy. `anim.done` is a FLAG meaning "nothing left to
       show", but `done` is also the obvious name for a counter of how many are
       done — and a widget that used it that way made every step after the first
       replay instead of advancing, with Play masking it because one click runs
       to the end. Comparing exactly makes a numeric `done` harmless instead of
       silently destructive. */
    /* `mode !== "ease"`: an ease is a transition between two readings of a
       FINISHED figure, so a finished figure is exactly when one happens.
       Without the guard, toggling the denominator on a completed widget would
       Replay it instead of easing. */
    if (mode !== "ease" && anim.done === true) {
      resetAnim({ fromScratch: true, keepLead: Boolean(anim.leadDone) }); // Replay
    }
    anim.mode = mode;

    // Reduced motion: no choreography, just arrive at the result.
    if (reducedMotion()) {
      fastForward();
      paint();
      updateAnimButtons();
      return;
    }

    rafId = requestAnimationFrame(tick);
    updateAnimButtons();
  }

  /* A label declared as { param, labels, default } resolves against the live
     value; a plain string resolves to itself. `labelSet` is every label the
     button can ever hold, which is what the width reservation needs. */
  function resolveLabel(spec, fallback) {
    if (spec == null) return fallback;
    if (typeof spec === "string") return spec;
    return spec.labels?.[values[spec.param]] ?? spec.default ?? fallback;
  }
  function labelSet(spec, fallback) {
    if (spec == null) return [fallback];
    if (typeof spec === "string") return [spec];
    return [...Object.values(spec.labels ?? {}), spec.default ?? fallback];
  }

  function updateAnimButtons() {
    if (!animation) return;

    /* Behind a shut gate there is nothing to drive, so step, run and reset are
       removed from the row rather than merely disabled — a disabled button still
       advertises a control the reader cannot use, and principle 3.5 says every
       control has to carry an idea AT REST. `hidden` takes them out of layout,
       so the whole row collapses and the divider above it goes with it. */
    if (GATE_PARAM) {
      const open = Boolean(values[GATE_PARAM]);
      for (const key of ["step", "run", "reset", "lead"]) {
        if (actions[key]) actions[key].hidden = !open;
      }
      dom.drive.hidden = !open;
      if (!open) return;
    }
    const playing = rafId !== null && anim?.mode === "run";
    const done = Boolean(anim?.done);
    // Nothing but the lead action is available until the lead action has run.
    const leadPending = Boolean(animation.leadLabel) && !anim?.leadDone;

    if (actions.run) {
      /* PLAY / PAUSE, AND NOTHING ELSE UNTIL THE FIGURE IS FINISHED.
         "Resume" is gone, and it was wrong for a reason worth keeping written
         down: it was chosen off `hasAdvanced`, which `tick` sets after EVERY
         advance — so a single Step relabelled the run button "Resume" and
         offered to continue something the reader had never started. Reported as
         exactly that confusion.

         The exemption list underneath it (lead, enter, ease) was the same bug
         being patched one mode at a time, and each new mode had to remember to
         join the list. The bug is not the modes, it is the premise: RESUME IS
         THE COUNTERPART OF A PAUSE, not of progress. A reader who never pressed
         Pause has nothing to resume, and one who did press it is looking at a
         button they just changed — so "Play" is unambiguous there too.

         "Replay" stays, because it is the one label that names a genuinely
         different action: it restarts rather than continues. */
      actions.run.textContent = playing
        ? "Pause"
        : done
          ? "Replay"
          : animation.runLabel ?? "Play";
      actions.run.setAttribute("aria-pressed", String(playing));
      actions.run.disabled = leadPending;
    }
    // The lead button greys out for good once used, and only Reset brings it
    // back. That disabled state is the teaching, not a technicality — which is
    // exactly why the OTHER two need to say they are waiting rather than broken.
    if (actions.lead) actions.lead.disabled = !leadPending;
    if (dom.driveHint) {
      const hint = leadPending ? animation.leadHint : null;
      dom.driveHint.textContent = hint ?? "";
      dom.driveHint.hidden = !hint;
    }
    // Only disabled when there is genuinely nothing left. Clicking it mid-step
    // fast-forwards the unit in flight, so it must stay live while running.
    if (actions.step) {
      actions.step.disabled = done || leadPending;
      actions.step.textContent = resolveLabel(animation.stepLabel, "Draw one");
      actions.step.title = resolveLabel(
        animation.stepTitle, "Advance one step, slowly, showing every stage");
    }
  }

  /* --- actions ---------------------------------------------------------- */

  // Drive row: directly above the figure, because these are the buttons that
  // make something happen and they should be next to the thing that happens.
  // Reset belongs here too — start over is part of the same loop as draw and
  // play, not housekeeping like copying a link.
  const drive = buildActions(dom.drive, [
    // A one-off action that has to happen before stepping means anything. See
    // the header: the widget owns `anim.leadDone`, core owns the button states.
    animation?.leadLabel && {
      key: "lead",
      text: animation.leadLabel,
      title: animation.leadTitle ?? "Do this once, before stepping",
      primary: true,
      onClick: () => startAnim("lead"),
    },
    /* Labels are the widget's to name: a Galton board drops balls, it does not
       draw samples. Generic verbs make a widget feel like a demo of a framework.

       `stepLabel: null` DECLINES the button. Not the same as omitting it, which
       still gets the default — an explicit null is a widget saying it has
       nothing to step, and widget 12 is the first: its study is already over
       and the only motion left is between two readings of it. A dead Step
       beside a live toggle teaches that the toggle is the afterthought. */
    animation && animation.stepLabel !== null && {
      key: "step",
      group: "pace",
      text: resolveLabel(animation.stepLabel, "Draw one"),
      /* THE NOUN LIVES HERE ONCE THE FACE IS ONE WORD. "Drop" and "Test batch"
         cannot say what they drop or test in the space they have, so the widget
         supplies the sentence and the generic string below is only a fallback.
         Shortening a label without moving its noun somewhere is how a control
         stops explaining itself — see principle 3.4c. */
      title: resolveLabel(animation.stepTitle, "Advance one step, slowly, showing every stage"),
      primary: true,
      onClick: () => startAnim("step"),
    },
    animation && animation.runLabel !== null && {
      key: "run",
      group: "pace",
      text: animation.runLabel ?? "Play",
      title: animation.runTitle ?? "Keep going at the chosen speed",
      primary: true,
      onClick: () => startAnim("run"),
    },
    {
      key: "reset",
      text: "Reset",
      title: "Return every control to its default and start over",
      onClick: () => {
        stopAnim();
        for (const [name, field] of Object.entries(spec)) values[name] = field.default;
        controls.syncAll(values);
        render();
        updateAnimButtons();
        // No toast: the panel visibly emptying and the controls visibly moving
        // are the confirmation. A message would restate what just happened.
      },
    },
  ].filter(Boolean));

  /* --- the run button's width is reserved, not discovered ------------------ *
   *
   * It relabels itself as the animation moves: Play -> Pause, and Replay once
   * finished. Those are not the same width — measured at --fs-md, 59 / 70 / 83
   * px — so the row's geometry depended on the animation's STATE. Two
   * consequences, one ugly and one worse:
   *
   *   - the row twitched on every press, at every width
   *   - in the 262px control rail, the widest label alone overflowed and
   *     dropped Reset onto a second line
   *
   * (A fourth label, "Resume", was retired with the labelling rule above. It
   * was the 75px one, so this reservation only ever got narrower.)
   *
   * Reserving the widest label makes the row a fixed shape. Sizing is measured
   * off a detached probe rather than by writing each label into the live button:
   * the button is a flex item and can be SHRUNK by an overflowing row, so
   * measuring it in place would sometimes report the squeezed width and confirm
   * a fit that is not there.
   *
   * A blind spot worth naming, because it is the same shape as principle 5.6:
   * every check of this row had measured it in its INITIAL state, and three of
   * the four labels only exist once something has been pressed.                */
  function reserveWidth(b, labels, prop) {
    if (!b) return;
    const cs = getComputedStyle(b);
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap";
    probe.style.font = `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    probe.style.letterSpacing = cs.letterSpacing;
    document.body.appendChild(probe);
    let text = 0;
    for (const l of labels) {
      probe.textContent = l;
      text = Math.max(text, probe.getBoundingClientRect().width);
    }
    probe.remove();
    const chrome =
      parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    /* A custom property, not an inline min-width, so CSS can still override it.
       In the rail the cluster is full width and its segments are flex:1, so the
       button cannot reflow no matter what it is labelled — the reservation is
       both unnecessary there and would break the equal split. An inline style
       beats every rule; a variable does not. */
    b.style.setProperty(prop, `${Math.ceil(text + chrome)}px`);
  }
  /* The step button reserves too, now that its label can depend on a parameter.
     Same rule, same reason: the row's shape must not be a function of what the
     widget happens to be showing. */
  function reserveDriveWidths() {
    /* Guarded: a widget that declined a button has no element to reserve for. */
    if (drive.run) {
      reserveWidth(drive.run, [animation?.runLabel ?? "Play", "Pause", "Replay"], "--run-reserve");
    }
    if (drive.step) {
      reserveWidth(drive.step, labelSet(animation?.stepLabel, "Draw one"), "--step-reserve");
    }
  }
  reserveDriveWidths();
  // Re-measure once webfonts settle, in case the first pass sized on a fallback.
  document.fonts?.ready?.then(reserveDriveWidths);

  /* Theme lives in the header, not the utility row. It is housekeeping, which
     argues for utility — but it is also the one control a reader may need
     BEFORE they can comfortably read anything, and a control you reach for
     first does not belong at the bottom of a 1000px page. */
  buildActions(dom.headerTools, [
      {
        key: "theme",
        icon: () => THEME_ICON[themeMode()](),
        text: THEME_LABEL[themeMode()],
        title: `${THEME_LABEL[themeMode()]} — click for ${nextThemeMode(themeMode())}`,
        onClick: (btn) => {
          setThemeMode(nextThemeMode(themeMode()));
          // The tokens the canvas drew with have just changed underneath it, so
          // re-read them and repaint. No recompute: the data did not move.
          colors = readTokens();
          paint();
          const mode = themeMode();
          btn.replaceChildren(THEME_ICON[mode]());
          btn.setAttribute("aria-label", THEME_LABEL[mode]);
          btn.title = `${THEME_LABEL[mode]} — click for ${nextThemeMode(mode)}`;
        },
      }
  ]);

  // Utility row: bottom of the widget, visually quiet.
  const util = buildActions(
    dom.utility,
    [
      {
        key: "copy",
        text: "Copy link",
        title: "Copy a link that reproduces exactly this state",
        onClick: async () => {
          // Always the standalone link, never the embedded variant.
          const qs = toQuery(spec, values);
          const url = `${location.origin}${location.pathname}${qs ? `?${qs}` : ""}`;
          try {
            await navigator.clipboard.writeText(url);
            util.flash("Link copied");
          } catch {
            util.flash(url);
          }
        },
      },
      png && {
        key: "png",
        text: "Save PNG",
        title: "Download the figure as an image",
        onClick: () => {
          exportPng(surface, colors, slug);
          util.flash("Saved");
        },
      },
      table && {
        key: "table",
        text: "Table",
        title: "Show the underlying numbers",
        onClick: (btn) => {
          tableOpen = !tableOpen;
          btn.setAttribute("aria-pressed", String(tableOpen));
          dom.tableWrap.hidden = !tableOpen;
          if (tableOpen) renderTable(dom.tableWrap, table({ params: { ...values }, state, anim }));
        },
      },
    ].filter(Boolean),
    { withFlash: true }
  );

  const actions = { ...drive, ...util };

  /* --- lifecycle -------------------------------------------------------- *
   * Resize repaints but does not recompute: the width changed, not the data. */

  let resizeTimer = null;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => paint(), 60);
  }).observe(dom.figure);

  onThemeChange(() => {
    colors = readTokens();
    paint();
  });

  reportHeight(slug);
  render();
  updateAnimButtons();

  return {
    render,
    setParam,
    play: () => startAnim("run"),
    step: () => startAnim("step"),
    get params() { return { ...values }; },
    get state() { return state; },
    get anim() { return anim; },
    theme,
  };
}

/* --- DOM shell ---------------------------------------------------------- */

/**
 * Reading order IS the instruction, so the DOM order is the pedagogical order:
 *
 *   title & question   what are we looking at
 *   setup controls     choose what you are sampling from
 *   drive buttons      make it happen
 *   figure             what happened
 *   legend             what the marks mean
 *   readout            the numbers, prediction beside observation
 *   utility            housekeeping, visually quiet
 *
 * Putting the setup first and the numbers last means a student reads the widget
 * top to bottom in the order they need to think about it, with no instruction
 * telling them to.
 */
function buildShell(host, { title, subtitle, legend, status, layout = "stack", hasReadout, hasTable }) {
  host.className = "w-root";
  host.dataset.layout = layout;
  host.innerHTML = "";

  /* Above the heading, not below it: someone who reached a draft from a link has
     to read this BEFORE they believe the figure, not after. */
  if (status === "draft") {
    const bar = el("div", "w-draft");
    bar.appendChild(el("strong", null, "Draft"));
    bar.appendChild(
      el("span", null,
        "This widget is still being built. It is not finished teaching material, " +
        "and what it shows may be wrong.")
    );
    host.appendChild(bar);
  }

  /* The header is a row: heading on the left, a tools slot on the right that
     stays aligned with the title's first line however long the subtitle runs. */
  const header = el("header");
  const heading = el("div", "w-heading");
  heading.appendChild(el("h1", "w-title", title));
  if (subtitle) heading.appendChild(el("p", "w-subtitle", subtitle));
  header.appendChild(heading);
  const headerTools = el("div", "w-header-tools");
  header.appendChild(headerTools);
  host.appendChild(header);

  /* Under "side" the controls and the drive buttons share a rail and the figure
     gets its own column. The DOM order is unchanged — rail before stage — so
     tab order and screen-reader order still read setup-then-figure, which is
     principle 3.1 and must not become a property of the CSS. */
  const split = layout === "side" ? el("div", "w-split") : null;
  if (split) host.appendChild(split);
  const rail = split ? el("div", "w-rail") : null;
  if (rail) split.appendChild(rail);
  const stage = split ? el("div", "w-stage") : null;
  if (stage) split.appendChild(stage);

  const controls = el("div", "w-controls");
  (rail ?? host).appendChild(controls);

  /* THE DRIVE BUTTONS LIVE WITH THE CONTROLS, in the rail under `side`.

     They were briefly in the stage above the figure, on a literal reading of
     principle 3.1 ("directly above the figure"). That reading is wrong for a
     two-column layout and it was reported as confusing straight away: the setup
     was on the left and Play was at the top, so operating the widget meant
     tracking two separate control locations. 3.1's actual claim is that a
     control sits BESIDE the thing it controls, and in a side layout the whole
     rail already does. One column, one place to look. */
  const drive = el("div", "w-drive");
  (rail ?? host).appendChild(drive);

  /* WHY IS THIS GREYED OUT? A lead action disables step and run until it has
     run, and until now nothing on screen said so — the reader gets two dead
     buttons, a blank figure, and no way to tell a gate from a bug. It was
     reported as exactly that. The widget authors the sentence, because only the
     widget knows what the lead produces; with no `leadHint` the line is absent
     and nothing about the existing widgets changes.

     A sibling of `.w-drive` rather than a child: in the stacked layout that row
     is `flex-wrap: wrap`, so a paragraph inside it would sit BESIDE the
     buttons. */
  const driveHint = el("p", "w-detail");
  driveHint.hidden = true;
  (rail ?? host).appendChild(driveHint);

  /* A SECOND CONTROL BLOCK, BELOW THE DRIVE ROW, for a field marked
     `afterDrive: true`. Empty and collapsed for every widget that declares
     none, which is all of them but widget 10.

     3.4e fixes the drive row as the last thing in the rail, and that is still
     right for anything you SET before pressing a button. It is wrong for the
     one kind of control that only means something after: widget 10's "show the
     true groups" is the withheld answer, and a reader who meets it in the setup
     block meets the answer before the question. Reported as exactly that.

     A separate container rather than CSS order, because `.w-controls` is a grid
     and a field cannot leave it by reordering. */
  const controlsAfter = el("div", "w-controls w-controls--after");
  (rail ?? host).appendChild(controlsAfter);

  const figure = el("div", "w-figure");
  figure.setAttribute("role", "img");
  figure.setAttribute(
    "aria-label",
    `${title}. The numbers below the figure carry the same information.`
  );
  (stage ?? host).appendChild(figure);

  // A legend is always present for two or more series; one series needs none.
  if (legend.length >= 2) {
    const ul = el("ul", "w-legend");
    for (const item of legend) {
      const li = el("li");
      const sw = el("span", "swatch");
      sw.style.setProperty("--swatch", `var(--c-${item.token}, var(--${item.token}))`);
      if (item.mark) sw.dataset.mark = item.mark;
      li.appendChild(sw);
      li.appendChild(el("span", null, item.label));
      ul.appendChild(li);
    }
    (stage ?? host).appendChild(ul);
  }

  /* THE LEGEND AND THE READOUT GO WITH THE FIGURE, not below the whole split.
     The rail is what you SET; the stage is what you SEE — and both of these
     describe the figure rather than the controls. The legend names its marks and
     the readout is its numbers, which principles §6 calls the accessible reading
     of every figure. Left full width they made the page two columns and then a
     band, which is a shape nothing in the content asks for.

     Checked before moving, because the readout loses ~300px here: no widget's
     tiles wrap at the narrower width. If one ever does, that is a reason to
     revisit this, not to let the tiles fold. */
  const readout = el("div", "w-readout");
  readout.setAttribute("aria-live", "polite");
  if (hasReadout) (stage ?? host).appendChild(readout);

  const tableWrap = el("div", "w-table-wrap");
  tableWrap.hidden = true;
  if (hasTable) (stage ?? host).appendChild(tableWrap);

  const utility = el("div", "w-utility");
  host.appendChild(utility);

  return { figure, readout, controls, controlsAfter, drive, driveHint, utility, headerTools, tableWrap };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* --- readout & table --------------------------------------------------- */

function renderReadout(host, tiles) {
  host.innerHTML = "";
  for (const tile of tiles) {
    const wrap = el("div");
    wrap.appendChild(el("span", "w-stat-label", tile.label));
    wrap.appendChild(el("span", "w-stat-value", tile.value));
    if (tile.note) wrap.appendChild(el("span", "w-stat-note", tile.note));
    host.appendChild(wrap);
  }
}

function renderTable(host, { columns, rows }) {
  host.innerHTML = "";
  const t = el("table", "w-table");
  const thead = el("thead");
  const trh = el("tr");
  for (const c of columns) trh.appendChild(el("th", null, c));
  thead.appendChild(trh);
  t.appendChild(thead);
  const tbody = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const cell of row) tr.appendChild(el("td", null, String(cell)));
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  host.appendChild(t);
}

/* --- PNG export -------------------------------------------------------- */

function exportPng(surface, colors, slug) {
  const src = surface.canvas;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const c = out.getContext("2d");
  c.fillStyle = colors.surface; // canvas is transparent; give the PNG a ground
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(src, 0, 0);

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `${slug}.png`;
  a.click();
}
