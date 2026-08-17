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
import { buildControls, buildActions } from "./controls.js";
import { createCanvas } from "./canvas.js";
import { makeRng } from "./rng.js";
import { readTokens, resolveTheme, isEmbedded, reportHeight, onThemeChange } from "./env.js";

const MAX_FRAME_MS = 64; // clamp dt so a stalled tab does not jump the animation

export function defineWidget(config) {
  const {
    slug,
    title,
    subtitle = "",
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
  let hasAdvanced = false; // drives Play / Resume / Replay labelling

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

  function resetAnim({ fromScratch = false } = {}) {
    if (!animation) return;
    anim = animation.init({
      params: { ...values },
      state,
      colors,
      fromScratch: fromScratch || seededOnce,
    });
    seededOnce = true;
    hasAdvanced = false;
  }

  function render(opts = {}) {
    recompute();
    resetAnim();
    paint({ syncAddressBar: true, ...opts });
  }

  /* --- parameter changes ------------------------------------------------ */

  function setParam(name, value) {
    values[name] = value;

    if (spec[name]?.display) {
      // Display-only: keep the student's work. The state is recomputed because
      // some display parameters change derived shapes (an axis range changes the
      // binning), and the animation re-derives itself from what it holds that is
      // genuinely invariant. A playing animation keeps playing.
      recompute();
      animation?.rebuild?.(anim, { params: { ...values }, state, colors });
      paint({ syncAddressBar: true });
      updateAnimButtons();
      return;
    }

    // Data change: the samples underneath just became different samples, so a
    // half-built picture of the old ones would be a lie. Start empty.
    stopAnim();
    render();
    updateAnimButtons();
  }

  const controls = buildControls(dom.controls, spec, values, setParam);

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
    hasAdvanced = true;
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
    hasAdvanced = true;
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

    if (anim.done) resetAnim({ fromScratch: true }); // Replay
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

  function updateAnimButtons() {
    if (!animation) return;
    const playing = rafId !== null && anim?.mode === "run";
    const done = Boolean(anim?.done);
    // Nothing but the lead action is available until the lead action has run.
    const leadPending = Boolean(animation.leadLabel) && !anim?.leadDone;

    if (actions.run) {
      // Running the lead action is not "advancing" in the sense Resume means —
      // drawing your sample leaves nothing part-played to resume from.
      const advanced = hasAdvanced && anim?.mode !== "lead";
      actions.run.textContent = playing
        ? "Pause"
        : done
          ? "Replay"
          : advanced
            ? "Resume"
            : animation.runLabel ?? "Play";
      actions.run.setAttribute("aria-pressed", String(playing));
      actions.run.disabled = leadPending;
    }
    // The lead button greys out for good once used, and only Reset brings it
    // back. That disabled state is the teaching, not a technicality.
    if (actions.lead) actions.lead.disabled = !leadPending;
    // Only disabled when there is genuinely nothing left. Clicking it mid-step
    // fast-forwards the unit in flight, so it must stay live while running.
    if (actions.step) actions.step.disabled = done || leadPending;
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
      title: "Do this once, before stepping",
      primary: true,
      onClick: () => startAnim("lead"),
    },
    // Labels are the widget's to name: a Galton board drops balls, it does not
    // draw samples. Generic verbs make a widget feel like a demo of a framework.
    animation && {
      key: "step",
      text: animation.stepLabel ?? "Draw one",
      title: "Advance one step, slowly, showing every stage",
      primary: true,
      onClick: () => startAnim("step"),
    },
    animation && {
      key: "run",
      text: animation.runLabel ?? "Play",
      title: "Keep going at the chosen speed",
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
function buildShell(host, { title, subtitle, legend, hasReadout, hasTable }) {
  host.className = "w-root";
  host.innerHTML = "";

  const header = el("header");
  header.appendChild(el("h1", "w-title", title));
  if (subtitle) header.appendChild(el("p", "w-subtitle", subtitle));
  host.appendChild(header);

  const controls = el("div", "w-controls");
  host.appendChild(controls);

  const drive = el("div", "w-drive");
  host.appendChild(drive);

  const figure = el("div", "w-figure");
  figure.setAttribute("role", "img");
  figure.setAttribute(
    "aria-label",
    `${title}. The numbers below the figure carry the same information.`
  );
  host.appendChild(figure);

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
    host.appendChild(ul);
  }

  // Only created when the widget has numbers to show: an empty readout is a
  // bordered gap that reads as something failing to load.
  const readout = el("div", "w-readout");
  readout.setAttribute("aria-live", "polite");
  if (hasReadout) host.appendChild(readout);

  const tableWrap = el("div", "w-table-wrap");
  tableWrap.hidden = true;
  if (hasTable) host.appendChild(tableWrap);

  const utility = el("div", "w-utility");
  host.appendChild(utility);

  return { figure, readout, controls, drive, utility, tableWrap };
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
