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
         regions:  ({ w, h, params, state }) => [{ set: { k: v }, ... }],
         drag:     { param, value },                // a movement, not a click
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

import { resolveParams, syncUrl, toQuery, optionKeys } from "./params.js";
import { buildControls, buildActions, gatingParams, fieldShowing } from "./controls.js";
import { createCanvas, hitTest } from "./canvas.js";
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
    /* What the Reset button says and promises. A widget whose Reset does
       something specific should name it: see the note at the button itself. */
    resetLabel,
    resetTitle,
    compute = () => ({}),
    draw,
    /**
     * Clickable targets on the canvas: `({ w, h, params, state }) => [{ x, y, w,
     * h, set: { param: value }, label }]`, in drawing coordinates.
     *
     * NOT built inside `draw()`. `draw()` runs on every animation frame and a
     * region list rebuilt there is per-frame work that paints nothing; this is
     * called lazily, at click and hover time, from `surface.width/height` —
     * which ARE the `w`/`h` the last `draw()` was handed, so the map and the
     * picture agree without either caching the other.
     *
     * It is deliberately not handed `colors` or `anim`. A target that could move
     * with the theme, or with how far an animation has run, would drift away
     * from the picture; unrepresentable beats documented (5.3).
     */
    regions = null,
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

    /* DRAGGING THE FIGURE, for the case a click cannot express: a quantity the
       reader wants to sweep rather than pick. `regions` resolves a pixel to an
       identity; this resolves a MOVEMENT to a value.
     *
     *     drag: {
     *       params: ["turn", "tilt"],                // declared, not returned
     *       value: ({ dx, dy, start, params, state, w, h }) => ({ turn, tilt }),
     *       cursor: "grab",                          // optional, default "grab"
     *       hit: ({ x, y, w, h, params, state }) => bool,  // optional: where the
     *                                                // figure can be grabbed
     *     }
     *
       DECLARED rather than inferred from the return value, because core has to
       validate the names at load exactly as it validates a region: a parameter
       that is not in the spec is a code defect and should throw here rather
       than do nothing on the first drag.

       MORE THAN ONE PARAMETER IS ALLOWED HERE AND NOT IN A REGION, and the
       difference is real rather than a relaxation. A region's objection to two
       is that it would paint an intermediate state, write the URL twice, and
       make a click a different transaction from the one the harness performs.
       None of that follows here: the values are applied TOGETHER, and only the
       last goes through `setParam`, so there is one recompute, one repaint and
       one address-bar write however many are named. Two numbers that are one
       gesture — a camera's turn and tilt — stay one transaction.

       `start` holds those parameters' values when the gesture began, so `value`
       is a pure function of the gesture and cannot accumulate drift across
       frames. It ends at the same door a region click uses — sync the control,
       then set — so the rail, the URL and the figure cannot disagree. */
    drag = null,
    mount = "#widget",
  } = config;

  const theme = resolveTheme();
  if (isEmbedded()) document.body.dataset.embed = "1";
  document.title = `${title} · statml widgets`;

  const values = resolveParams(spec, new URLSearchParams(location.search));
  const host = document.querySelector(mount);
  /* `legend` may be a FUNCTION of the parameters (lm-interaction's ask,
     2026-08-29: "the legend should match the graph" — a tabbed widget's
     marks change with the tab, and a legend describing another tab's
     marks is worse than none). A static array renders exactly as it
     always has; a function is resolved here for the first paint and
     re-resolved on every parameter change in recompute(). */
  const legendFor = (vals) =>
    (typeof legend === "function" ? legend({ params: { ...vals } }) : legend);
  let legendKey = JSON.stringify(legendFor(values));
  const dom = buildShell(host, {
    title,
    subtitle,
    legend: legendFor(values),
    legendLive: typeof legend === "function",
    status,
    layout,
    hasReadout: Boolean(readout),
    hasTable: Boolean(table),
  });
  function refreshLegend() {
    if (typeof legend !== "function" || !dom.legend) return;
    const entries = legendFor(values);
    const key = JSON.stringify(entries);
    if (key === legendKey) return;
    legendKey = key;
    fillLegend(dom.legend, entries);
    dom.legend.hidden = entries.length < 2;
  }

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
    /* a live legend follows the parameters; runs on every path that can
       change them, and is a no-op for the static arrays every widget
       before 2026-08-29 declares */
    refreshLegend();
  }

  /* The pointer's position in DRAWING coordinates, or null — see the
     pointer-channel block below. Declared here, above paint(), because
     paint runs during the defineWidget call itself and a later `let` would
     still be in its temporal dead zone at first paint. */
  let pointerPos = null;

  function paint({ syncAddressBar = false } = {}) {
    /* A HEIGHT FUNCTION GETS THE PARAMETERS **AND THE WIDTH**, and resolving it
       is `resize`'s job. It used to resolve here, one line earlier, which was
       right for a height that depends only on the parameters and impossible for
       one that depends on the width: the width is not known until `resize` has
       measured it, so a height asked for first could only be computed from the
       LAST frame's width. `w` rides along in the same object as the values —
       no widget has a parameter of that name, checked. */
    const { w, h } = surface.resize(
      typeof height === "function" ? (cw) => height({ ...values, w: cw }) : null
    );
    surface.clear();
    draw({ ctx: surface.ctx, colors, w, h, params: { ...values }, state, anim, pointer: pointerPos });

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

  /* --- clickable regions on the canvas ----------------------------------- *
   * A region resolves a pixel to an IDENTITY and hands it to the same door a
   * widget uses for any external write, which syncs the control and then goes
   * through `setParam`. No selection variable, no second state of record: the
   * URL and the rail move exactly as if the reader had used the dropdown.
   *
   * EXACTLY ONE PARAMETER PER REGION, checked at load. Two would paint an
   * intermediate state nobody asked for, write the URL twice, and — the reason
   * that matters — make the click a DIFFERENT transaction from the one a
   * fingerprint state performs, so the harness would be verifying a sequence
   * the reader never takes. A pair of variables is one parameter here, not two.
   */
  function setFromRegion(name, value) {
    controls.sync(name, value);
    setParam(name, value);
  }

  /* THE REGION UNDER A POINTER, and it lives out here rather than inside the
     `if (regions)` block because the DRAG handler needs it too — that is where
     "a region click wins where the two overlap" is enforced.

     It was declared with `const` inside that block, which is block-scoped, so
     the drag handler's reference to it threw `ReferenceError: at is not
     defined` on every pointerdown. That could only ever fire for a widget
     declaring BOTH `regions` and `drag`, and until widget 21 no widget declared
     `regions` at all — for every other widget `regions && at(ev)` short-circuits
     before `at` is ever evaluated, which is why this sat here unnoticed and why
     hoisting it changes nothing for them. */
  const at = (ev) => {
    if (!regions) return null;
    const p = surface.pointAt(ev);
    if (!p) return null;
    return hitTest(
      regions({ w: surface.width, h: surface.height, params: { ...values }, state }) ?? [],
      p.x, p.y
    );
  };

  if (regions) {
    /* VALIDATED AT LOAD, LOUDLY, not at click time and leniently. A region table
       can be wrong in exactly two ways — a parameter that does not exist and a
       value that is not one of its options — and both are code defects, so they
       throw where every other driver in this repo throws. Coercing them into
       the default instead would turn a click that does the wrong thing into a
       click that quietly does something else. */
    const probe = regions({ w: surface.width, h: surface.height, params: { ...values }, state });
    for (const r of probe ?? []) {
      const keys = Object.keys(r.set ?? {});
      if (keys.length !== 1) {
        throw new Error(`region "${r.label ?? "?"}" sets ${keys.length} parameters; exactly one is allowed`);
      }
      const [name] = keys;
      const field = spec[name];
      if (!field) throw new Error(`region "${r.label ?? "?"}" sets unknown parameter "${name}"`);
      if (["select", "choice", "segmented"].includes(field.type)
        && !optionKeys(field).includes(r.set[name])) {
        throw new Error(`region "${r.label ?? "?"}" sets "${name}" to "${r.set[name]}", which is not one of its options`);
      }
    }

    surface.canvas.addEventListener("pointerdown", (ev) => {
      const r = at(ev);
      if (!r) return;
      ev.preventDefault();
      const [name] = Object.keys(r.set);
      setFromRegion(name, r.set[name]);
    });
    /* The only thing that says a figure can be clicked at all.
       FALLS BACK TO THE DRAG CURSOR, not to "default": a widget with both a
       region map and a draggable figure would otherwise lose its grab hand
       everywhere outside a region, and the figure would stop advertising that
       it turns. Widget 21 is the first with both, and its subtitle tells the
       reader to drag the cloud. */
    surface.canvas.addEventListener("pointermove", (ev) => {
      if (dragging) return;   // a gesture in flight owns the cursor
      const idle = drag ? (drag.cursor ?? "grab") : "default";
      surface.canvas.style.cursor = at(ev) ? "pointer" : idle;
    });
  }

  /* --- dragging the figure ------------------------------------------------ *
   * Same door as a region click, one parameter, validated at load. See the
   * `drag` entry in the options above for why it is one and why it is declared
   * rather than returned.                                                     */
  let dragging = null;
  if (drag) {
    const dragParams = drag.params ?? [drag.param];
    for (const name of dragParams) {
      if (!spec[name]) throw new Error(`drag sets unknown parameter "${name}"`);
    }
    if (typeof drag.value !== "function") {
      throw new Error(`drag on "${dragParams.join(", ")}" has no value() function`);
    }
    const grab = drag.cursor ?? "grab";

    /* WHERE THE FIGURE CAN BE GRABBED — optional, the scrubHit shape. Without
       it every widget drags everywhere, which is right for a figure that IS
       the draggable thing (t-sne's cloud) and wrong for a figure where the
       draggable thing is one panel of three: widget 34's whole-canvas drag
       meant a casual click on the ROC square nudged the threshold ~0.02 per
       8 px, and the reader met the evidence later as an arrow reading "from
       0.48" they never asked for. Gates the gesture AND the advertised
       cursor; absent, both behave exactly as before. */
    const dragHitAt = (p) =>
      (drag.hit
        ? drag.hit({ x: p.x, y: p.y, w: surface.width, h: surface.height, params: { ...values }, state })
        : true);
    if (drag.hit) {
      /* Registered only when a hit-test exists: a widget with regions AND an
         ungated drag (t-sne) relies on the regions handler's pointer cursor,
         which a second unconditional handler here would overwrite. */
      surface.canvas.addEventListener("pointermove", (ev) => {
        if (dragging) return;
        /* A REGION'S POINTER WINS, and this early return is the whole of it.
           Both handlers fire on every move and this one is registered second,
           so an unconditional assignment erases the "pointer" the region
           handler just set — leaving a row that is clickable and advertises
           nothing. The `else` branch below already names this collision for an
           UNGATED drag; a gated one has it too, and the guard belongs here.

           Found on widget 43, the first to declare `regions` and a gated
           `drag` together — which is why it went unseen. It also BLOCKED that
           widget: the fingerprint's `hitAt` proves a region was struck by
           reading this cursor, so with the pointer erased no hit-driven state
           could be recorded, and `check` requires one of every shipped widget
           declaring regions. */
        if (at(ev)) return;
        const p = surface.pointAt(ev);
        surface.canvas.style.cursor = p && dragHitAt(p) ? grab : "default";
      });
    } else {
      surface.canvas.style.cursor = grab;
    }

    surface.canvas.addEventListener("pointerdown", (ev) => {
      /* A region click wins where the two overlap: it is a smaller target and
         a more specific intent, and a reader aiming at one does not expect the
         whole figure to swing. */
      if (regions && at(ev)) return;
      const p = surface.pointAt(ev);
      if (!p || !dragHitAt(p)) return;
      ev.preventDefault();
      dragging = {
        x: ev.clientX, y: ev.clientY,
        start: Object.fromEntries(dragParams.map((n) => [n, values[n]])),
      };
      surface.canvas.setPointerCapture?.(ev.pointerId);
      surface.canvas.style.cursor = "grabbing";
    });

    surface.canvas.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const next = drag.value({
        dx: ev.clientX - dragging.x,
        dy: ev.clientY - dragging.y,
        start: dragging.start,
        params: { ...values },
        state,
        w: surface.width,
        h: surface.height,
      });
      /* ONLY WHEN SOMETHING ACTUALLY CHANGES. `value` is expected to snap to a
         step, so a slow drag reports the same numbers many times over — and
         every one of those would recompute, repaint and rewrite the address
         bar. */
      if (dragParams.every((n) => next[n] === values[n])) return;
      /* APPLIED TOGETHER, ONE TRANSACTION. Everything but the last is written
         straight into `values` with its control synced; the last goes through
         the ordinary door, and `recompute` then sees all of them at once. One
         recompute, one repaint, one address-bar write. */
      const tail = dragParams[dragParams.length - 1];
      for (const n of dragParams) {
        if (n === tail) continue;
        values[n] = next[n];
        controls.sync(n, next[n]);
      }
      setFromRegion(tail, next[tail]);
    });

    const release = (ev) => {
      if (!dragging) return;
      dragging = null;
      surface.canvas.releasePointerCapture?.(ev.pointerId);
      surface.canvas.style.cursor = grab;
    };
    surface.canvas.addEventListener("pointerup", release);
    surface.canvas.addEventListener("pointercancel", release);
  }

  /* --- the pointer channel -------------------------------------------------- *
     Two opt-ins, both inert for a widget that does not declare them:

       pointer: true      draw() receives `pointer` — the pointer's position
                          in DRAWING coordinates, or null — and idle pointer
                          movement repaints (coalesced to one rAF), so a
                          widget can render a hover inspector. The inspector
                          must stay an inspector: the lecture screen has no
                          hover, so nothing may live ONLY there.
       animation.scrub(anim, { x, y, w, h, params, state })
                          dragging on the canvas hands the reader the clock:
                          core stops any running animation, calls scrub per
                          move, and repaints. The widget mutates `anim` — no
                          parameter is written, because a playhead was never
                          in the URL and must not start being (invariant 1).
       animation.scrubHit({ x, y, w, h, params, state }) => bool
                          where scrubbing is offered; gates the gesture and
                          the resize cursor. Optional — default everywhere.

     A region click wins over a scrub where they overlap, the same rule the
     drag block enforces. The tracking block registers FIRST so `pointer`
     is already current when a scrub's synchronous repaint reads it. */
  const wantsPointer = Boolean(config.pointer);
  const pointerCtx = (p) => ({
    x: p.x,
    y: p.y,
    w: surface.width,
    h: surface.height,
    params: { ...values },
    state,
  });
  const scrubHitAt = (p) => (animation?.scrubHit ? animation.scrubHit(pointerCtx(p)) : true);
  if (wantsPointer || animation?.scrub) {
    let pointerRaf = null;
    surface.canvas.addEventListener("pointermove", (ev) => {
      if (dragging) return;
      const p = surface.pointAt(ev);
      if (animation?.scrub && !(regions && at(ev))) {
        surface.canvas.style.cursor = p && scrubHitAt(p) ? "ew-resize" : "default";
      }
      if (!wantsPointer) return;
      pointerPos = p;
      if (rafId === null && pointerRaf === null) {
        pointerRaf = requestAnimationFrame(() => {
          pointerRaf = null;
          paint();
        });
      }
    });
    surface.canvas.addEventListener("pointerleave", () => {
      if (!wantsPointer) return;
      pointerPos = null;
      if (rafId === null) paint();
    });
  }
  if (animation?.scrub) {
    let scrubbing = false;
    const applyScrub = (p) => {
      animation.scrub(anim, pointerCtx(p));
      paint();
      updateAnimButtons();
    };
    surface.canvas.addEventListener("pointerdown", (ev) => {
      if (dragging || (regions && at(ev))) return;
      const p = surface.pointAt(ev);
      if (!p || !scrubHitAt(p)) return;
      ev.preventDefault();
      stopAnim(); // the reader takes the clock
      scrubbing = true;
      surface.canvas.setPointerCapture?.(ev.pointerId);
      applyScrub(p);
    });
    surface.canvas.addEventListener("pointermove", (ev) => {
      if (!scrubbing) return;
      const p = surface.pointAt(ev);
      if (p) applyScrub(p);
    });
    const endScrub = (ev) => {
      if (!scrubbing) return;
      scrubbing = false;
      surface.canvas.releasePointerCapture?.(ev.pointerId);
    };
    surface.canvas.addEventListener("pointerup", endScrub);
    surface.canvas.addEventListener("pointercancel", endScrub);
  }

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
     button can ever hold, which is what the width reservation needs.

     A LABEL MAY NOT BE CHOSEN BY A CONTROL THE READER CANNOT SEE. A `when`
     gated field keeps its value while it is hidden — deliberately, so that
     leaving a stage and coming back does not destroy the work — and a drive
     label keyed on such a field would go on reporting a choice that is no
     longer on screen. Widget 38 is the case: its second tab picks between one
     patient and all sixty, exists only under the model page, and without this
     line a reader who visited "all sixty" and returned to the abstract game
     found a Step button offering to "Add one patient" while three players
     walked into a ring. That is 3.4c's defect exactly, and the widget cannot
     fix it from its side, because the value it would need to ignore is the one
     core hands it.

     `balancing-data` is the only shipped widget keying a label on a gated
     field, and core hides the whole drive row while its gate is shut, so this
     changes nothing anyone can see there. `labelSet` is deliberately untouched:
     the width reservation must still cover every label the button can hold. */
  function resolveLabel(decl, fallback) {
    if (decl == null) return fallback;
    if (typeof decl === "string") return decl;
    const field = spec[decl.param];
    if (field && !fieldShowing(field, values)) return decl.default ?? fallback;
    return decl.labels?.[values[decl.param]] ?? decl.default ?? fallback;
  }
  function labelSet(decl, fallback) {
    if (decl == null) return [fallback];
    if (typeof decl === "string") return [decl];
    return [...Object.values(decl.labels ?? {}), decl.default ?? fallback];
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
    /* THE WIDGET SAYS WHEN THERE IS NOTHING TO DRIVE, by setting `anim.inert`,
       and core takes step and run out of the row rather than leaving them dead.

       `stepLabel: null` cannot do this: it is read once when the shell is built,
       so it declines a button for the whole life of the widget. Whether there is
       anything to drive can change with a parameter — widget 18's Class weights
       adds and removes no sample, so its plan is empty while Oversample's is
       180 long — and a button that is live but does nothing teaches that the
       control beside it is the afterthought (4.5). It was reported as exactly
       that: Play relabelled itself "Replay" on a method that changes no data,
       and replaying nothing repainted the same picture.

       The GROUP is hidden too, not just its buttons: `.w-drive-group` is
       `display: inline-flex`, so hiding the two buttons inside it would have
       left an empty bordered box sitting in the row. */
    const inert = Boolean(anim?.inert);
    for (const key of ["step", "run"]) {
      const b = actions[key];
      if (!b) continue;
      b.hidden = inert;
      const group = b.parentElement;
      if (group?.classList.contains("w-drive-group")) group.hidden = inert;
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
          : resolveLabel(animation.runLabel, "Play");
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
      /* THE RUN LABEL TAKES THE MAP FORM TOO. It was the only drive label that
         did not, and the reason the map exists applies to it exactly as it does
         to `stepLabel`: a widget whose tabs run genuinely different nouns cannot
         obey 3.4c with one word. Widget 38 walks six orders of arrival on one
         page and adds sixty patients on the other, and "Walk every order" is
         simply false on the second. `runLabel: null` still declines the button —
         that check is on the raw value, above. */
      text: resolveLabel(animation.runLabel, "Play"),
      title: resolveLabel(animation.runTitle, "Keep going at the chosen speed"),
      primary: true,
      onClick: () => startAnim("run"),
    },
    {
      key: "reset",
      /* THE LABEL NAMES WHAT IT CLEARS, because "Reset" alone does not. The
         usability literature on reset controls is blunt about it — a bare
         "Reset" is vague and gets clicked by mistake — and a widget that already
         has Play, and gates that say "Back to…", needs its third action to be
         unmistakable. Widget 18 calls it "Start over", because there it closes
         every gate and returns to the cohort. Default unchanged, so no existing
         widget moves. */
      text: resetLabel ?? "Reset",
      title: resetTitle ?? "Return every control to its default and start over",
      onClick: () => {
        stopAnim();
        /* EVERY control, including the gates — so on a staged widget this is
           the way back to the beginning, and the label below says so. A
           `keepOnReset` exemption was built for the opposite reading and taken
           out again: it existed so a narrative could survive Reset, and once the
           narrative was expressed as gates the honest thing was for Reset to
           close them.

           Still a trap for a harness, and it stays written down: a fingerprint
           sweep that clicks Reset between states tests only the default state
           and reports "0 problems" from it. */
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
      reserveWidth(drive.run, [...labelSet(animation?.runLabel, "Play"), "Pause", "Replay"], "--run-reserve");
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

    /* THE EXPORTED `setParam` IS, BY DEFINITION, THE DOOR THAT IS NOT A CONTROL.
       Every internal caller is a control reporting its own value, so the DOM
       already agrees and syncing it back would write into a range the reader is
       mid-drag. A widget calling this from a canvas click is the opposite case:
       nothing has told the rail anything, and `setParam` does not tell it
       either — it calls `controls.refresh`, which re-runs readbacks only, and
       `controls.sync` has no caller anywhere in this file.

       That has never bitten, and only by luck. `probability-mechanisms` clicks
       its tree through this door and its own comment records the near miss —
       "a dropdown reading Hypergeometric above a tree lit through to Binomial.
       Nothing repainted again to reconcile them" — and the reason it holds
       today is that `dist` and `view` both gate another field, so the rebuild
       at the top of `setParam` reconstructs the rail from `values` as a side
       effect. A parameter that gates nothing gets no such rescue, and the
       dropdown keeps showing a value the widget is no longer on.

       Sync first, then set. That is the order `drive.set` uses in the
       fingerprint harness — write the DOM, then let the event carry it — so a
       canvas click and a driven state become the same transaction rather than
       two paths that happen to agree. */
    setParam: (name, value) => {
      controls.sync(name, value);
      setParam(name, value);
    },

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
function buildShell(host, { title, subtitle, legend, legendLive, status, layout = "stack", hasReadout, hasTable }) {
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
  // A LIVE legend (a function of the parameters) gets its ul even when the
  // first tab shows fewer than two — another tab may show more; the <2 rule
  // is applied per render, as hidden.
  let legendUl = null;
  if (legend.length >= 2 || legendLive) {
    legendUl = el("ul", "w-legend");
    fillLegend(legendUl, legend);
    if (legend.length < 2) legendUl.hidden = true;
    (stage ?? host).appendChild(legendUl);
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

  return { figure, readout, controls, controlsAfter, drive, driveHint, utility, headerTools, tableWrap, legend: legendUl };
}

/* one item-builder for both the shell's first render and a live legend's
   re-renders, so the two can never drift */
function fillLegend(ul, entries) {
  ul.innerHTML = "";
  for (const item of entries) {
    const li = el("li");
    const sw = el("span", "swatch");
    sw.style.setProperty("--swatch", `var(--c-${item.token}, var(--${item.token}))`);
    if (item.mark) sw.dataset.mark = item.mark;
    li.appendChild(sw);
    li.appendChild(el("span", null, item.label));
    ul.appendChild(li);
  }
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
    /* `{ break: true }` starts a new row: a full-width zero-height cell in the
       readout grid. Earned by widget 35, whose classification-report averages
       are a different KIND of number from the per-class tiles beside them —
       letting them share a row said they were four of the same thing. Adds no
       text, so the tx hash sees nothing. */
    if (tile.break) {
      host.appendChild(el("div", "w-stat-break"));
      continue;
    }
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
