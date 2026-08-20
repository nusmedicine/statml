/* ============================================================================
   Controls are generated from the parameter spec — a widget never writes a
   slider by hand. That is what makes widget #20 cheap: declare the parameter,
   get a labelled control, URL sync, keyboard support, and the shareable link
   for free.

   Filters/controls sit in one block below the figure, in declaration order.
   ========================================================================= */

import { optionEntries } from "./params.js";

/**
 * Group consecutive checkboxes into one cell.
 *
 * Checkboxes are short and the grid column is sized for a slider, so left to
 * themselves they scatter across rows and a pair of related overlays ends up split
 * between two lines. Adjacent bools are almost always one decision with several
 * switches, so they share a cell and sit on one row.
 */
/**
 * Whether a field is showing right now.
 *
 * DECLARATIVE, NOT A PREDICATE FUNCTION, and that is principle 5.3 — encode the
 * invariant in the data shape. Core has to know WHICH parameter gates a field so
 * it can rebuild the control block when exactly that parameter moves; an opaque
 * `(values) => boolean` would force a rebuild on every change, and rebuilding
 * mid-drag drops the slider you are holding.
 *
 *   when: { param: "studies" }              shown while `studies` is truthy
 *   when: { param: "mode", equals: "raw" }  shown while `mode` === "raw"
 */
export function fieldShowing(field, values) {
  const w = field.when;
  if (!w) return true;
  return "equals" in w ? values[w.param] === w.equals : Boolean(values[w.param]);
}

/** Parameters that some other parameter's visibility depends on. */
export function gatingParams(spec) {
  const names = new Set();
  for (const field of Object.values(spec)) if (field.when) names.add(field.when.param);
  return names;
}

function toCells(spec, values) {
  const cells = [];
  let bools = null;
  for (const entry of Object.entries(spec)) {
    if (entry[1].hidden) continue;
    if (!fieldShowing(entry[1], values)) continue;
    if (entry[1].type === "gate") {
      bools = null;
      cells.push({ kind: "gate", entry });
      continue;
    }
    if (entry[1].type === "section") {
      bools = null;
      cells.push({ kind: "section", entry });
      continue;
    }
    if (entry[1].type === "bool") {
      if (!bools) {
        bools = { kind: "bools", fields: [] };
        cells.push(bools);
      }
      bools.fields.push(entry);
    } else {
      bools = null;
      cells.push({ kind: "field", entry });
    }
  }
  return cells;
}

export function buildControls(host, spec, values, onChange) {
  const api = { sync: () => {}, syncAll: () => {}, rebuild: () => {} };
  build(host, spec, values, onChange, api);
  return api;
}

/* Split out so `rebuild` can re-run it in place. A gated field appearing or
   disappearing changes which controls EXIST, which no amount of syncing values
   can express — so the block is rebuilt, and only when a gating parameter moves.
   `api` is mutated rather than replaced so every existing reference stays live. */
function build(host, spec, values, onChange, api) {
  host.innerHTML = "";
  const setters = {};

  for (const cell of toCells(spec, values)) {
    /* A LABELLED DIVIDER, and it carries no value. Widget 9 sets four numbers
       describing a population it is pretending not to know, and three more
       describing a belief about it — seven sliders that look like one list and
       are two completely different kinds of thing. The heading is what makes
       "these are the truth, those are your prior" structural instead of a
       sentence somebody has to read. */
    if (cell.kind === "section") {
      const [, field] = cell.entry;
      const h = document.createElement("p");
      h.className = "w-section";
      h.textContent = field.label ?? "";
      host.appendChild(h);
      continue;
    }

    if (cell.kind === "bools") {
      const group = document.createElement("div");
      group.className = "w-field w-bools";
      for (const [name, field] of cell.fields) {
        const id = `f-${name}`;
        const label = document.createElement("label");
        label.setAttribute("for", id);
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.checked = Boolean(values[name]);
        input.addEventListener("change", () => onChange(name, input.checked));
        label.append(input, document.createTextNode(field.label ?? name));
        group.appendChild(label);
        setters[name] = (v) => { input.checked = Boolean(v); };
      }
      host.appendChild(group);
      continue;
    }

    if (cell.kind === "gate") {
      /* A BUTTON INSIDE THE CONTROL FLOW, not in the drive row, and the position
         is the point: it sits exactly where the stage it opens begins, with the
         controls it reveals directly beneath it. Putting it in the drive row
         instead split the setup across two places on screen and readers reported
         losing track of where to look.

         It is a real parameter, so the stage survives a copied link. */
      const [name, field] = cell.entry;
      const wrap = document.createElement("div");
      wrap.className = "w-field w-gate";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "w-btn w-btn--primary w-gate-btn";
      b.dataset.key = `gate-${name}`;
      const paint = (v) => {
        b.textContent = v ? field.labelOff ?? "Hide" : field.label ?? "Show";
        b.setAttribute("aria-pressed", String(Boolean(v)));
      };
      paint(values[name]);
      b.addEventListener("click", () => {
        const next = !values[name];
        paint(next);
        onChange(name, next);
      });
      wrap.appendChild(b);
      if (field.detail) {
        const d = document.createElement("p");
        d.className = "w-detail";
        d.textContent = field.detail;
        wrap.appendChild(d);
      }
      host.appendChild(wrap);
      setters[name] = paint;
      continue;
    }

    const [name, field] = cell.entry;
    const wrap = document.createElement("div");
    wrap.className = "w-field";

    const id = `f-${name}`;
    const label = document.createElement("label");
    label.setAttribute("for", id);

    const text = document.createElement("span");
    text.textContent = field.label ?? name;
    label.appendChild(text);

    if (field.type === "int" || field.type === "float") {
      const val = document.createElement("span");
      val.className = "val";
      label.appendChild(val);
      wrap.appendChild(label);

      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.min = String(field.min ?? 0);
      input.max = String(field.max ?? 100);
      input.step = String(field.step ?? (field.type === "int" ? 1 : 0.01));
      input.value = String(values[name]);
      const show = (v) => {
        val.textContent = field.format ? field.format(v) : String(v);
      };
      show(values[name]);
      input.addEventListener("input", () => {
        const v = field.type === "int" ? Math.round(+input.value) : +input.value;
        show(v);
        onChange(name, v);
      });
      wrap.appendChild(input);
      /* A NUMERIC FIELD'S `detail` USED TO GO NOWHERE AT ALL. `params.js`
         documents `detail` as something any field may carry, `choice` and
         `gate` rendered it, and `int`/`float` silently dropped it — so widget
         8's warning that a LARGER size means LESS spread, which is the one
         thing about that parameterisation that catches people, has never been
         on screen. Same field, same job, same rendering, everywhere. */
      if (field.detail) {
        const d = document.createElement("p");
        d.className = "w-detail";
        d.textContent = field.detail;
        wrap.appendChild(d);
      }
      setters[name] = (v) => {
        input.value = String(v);
        show(v);
      };
    } else if (field.type === "select") {
      wrap.appendChild(label);
      const select = document.createElement("select");
      select.id = id;
      for (const { value, label: text2 } of optionEntries(field)) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text2;
        select.appendChild(opt);
      }
      select.value = values[name];
      select.addEventListener("change", () => onChange(name, select.value));
      wrap.appendChild(select);
      setters[name] = (v) => { select.value = v; };
    } else if (field.type === "choice") {
      // A slider over an ordered option list. Tick labels are not decoration:
      // without them the slider shows a position and hides what the positions
      // are, which is worse than the dropdown it replaced.
      const options = optionEntries(field);
      const val = document.createElement("span");
      val.className = "val";
      label.appendChild(val);
      wrap.appendChild(label);

      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.min = "0";
      input.max = String(options.length - 1);
      input.step = "1";
      input.value = String(Math.max(0, options.findIndex((o) => o.value === values[name])));
      wrap.appendChild(input);

      const ticks = document.createElement("div");
      ticks.className = "w-ticks";
      for (const o of options) {
        const t = document.createElement("span");
        t.textContent = o.label;
        ticks.appendChild(t);
      }
      wrap.appendChild(ticks);

      const detail = document.createElement("p");
      detail.className = "w-detail";
      wrap.appendChild(detail);

      const show = () => {
        const o = options[+input.value] ?? options[0];
        val.textContent = o.label;
        detail.textContent = o.detail ?? "";
      };
      show();
      input.addEventListener("input", () => {
        show();
        onChange(name, options[+input.value].value);
      });
      setters[name] = (v) => {
        const i = options.findIndex((o) => o.value === v);
        if (i >= 0) input.value = String(i);
        show();
      };
    } else if (field.type === "segmented") {
      // Every option visible at rest. For a small set of alternative readings,
      // a collapsed dropdown hides that there is a choice to make.
      const options = optionEntries(field);
      wrap.appendChild(label);
      /* THE DETAIL IS A LINE, NOT A TOOLTIP, and it was a tooltip for two
         widgets' worth of shipping. `choice` has always rendered its selected
         option's `detail` as visible copy; `segmented` put the identical field
         into `title`, where a projector never shows it and a touch screen
         cannot reach it. Two widgets had written real explanations into it —
         widget 8's three sweeps, and widget 9's grid-versus-sampler
         distinction, which is the whole reason its fourth tab exists — and
         neither was ever seen. Same field, same job, same rendering. */
      const detail = document.createElement("p");
      detail.className = "w-detail";

      const buttons = new Map();
      const mark = (v) => {
        for (const [key, btn] of buttons) btn.setAttribute("aria-pressed", String(key === v));
        detail.textContent = options.find((o) => o.value === v)?.detail ?? "";
      };

      /* OPTIONS MAY DECLARE A `group`, AND A GROUP IS A ROW WITH A CAPTION.
         One option list, still one parameter — but when three of the choices
         are the same KIND of thing and the fourth is not, saying so in the
         shape beats saying it in a caption that changes as you click. Widget 9
         needs exactly that: mu, size and Both are one grid added up; MCMC is a
         sampler, and a reader has to know that before choosing, not after.
         Consecutive options sharing a `group` string form one row. */
      let run = null;
      for (const o of options) {
        if (!run || run.key !== o.group) {
          run = { key: o.group, seg: document.createElement("div") };
          run.seg.className = "w-seg";
          run.seg.setAttribute("role", "group");
          run.seg.setAttribute("aria-label", o.group ?? field.label ?? name);
          wrap.appendChild(run.seg);
          if (o.group) {
            const cap = document.createElement("p");
            cap.className = "w-seg-cap";
            cap.textContent = o.group;
            wrap.appendChild(cap);
          }
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "w-seg-btn";
        b.textContent = o.label;
        if (o.detail) b.title = o.detail;
        b.addEventListener("click", () => {
          mark(o.value);
          onChange(name, o.value);
        });
        buttons.set(o.value, b);
        run.seg.appendChild(b);
      }
      wrap.appendChild(detail);
      mark(values[name]);
      setters[name] = mark;
    }
    // `bool` never reaches here — checkboxes are grouped by toCells() above.

    host.appendChild(wrap);
  }

  api.sync = (name, value) => { setters[name]?.(value); };
  api.syncAll = (next) => {
    for (const [name, v] of Object.entries(next)) setters[name]?.(v);
  };
  api.rebuild = (next) => { build(host, spec, next, onChange, api); };
}

/**
 * A row of buttons from a declarative list. Core builds two of these: a drive
 * row above the figure (the buttons that make something happen) and a utility
 * row at the bottom (housekeeping).
 *
 * `buttons` is a list of { key, text, title, primary?, onClick }.
 * Pass `withFlash` to append a status line for transient messages.
 */
export function buildActions(host, buttons, { withFlash = false } = {}) {
  host.innerHTML = "";
  const made = {};

  /* Consecutive buttons sharing a `group` are fenced into one connected cluster.
     Used for the step/play pair, which are two PACES of one action rather than
     two different actions — so they read as one control, and the gap that used
     to sit between them is reclaimed. That gap is why a three-button row wrapped
     in a 262px rail.

     Same visual grammar as `.w-seg`, deliberately, but NOT the same thing: these
     are actions, so no `aria-pressed` and no selected segment. Reset is never in
     a group — a connected fence says "these belong together", and Reset is the
     control that destroys what the others built. */
  let openGroup = null;
  let openKey = null;
  const slot = (spec) => {
    if (!spec.group) { openGroup = null; openKey = null; return host; }
    if (openKey !== spec.group) {
      openGroup = document.createElement("div");
      openGroup.className = "w-drive-group";
      openKey = spec.group;
      host.appendChild(openGroup);
    }
    return openGroup;
  };

  for (const spec of buttons) {
    if (!spec) continue;
    const b = document.createElement("button");
    b.className = spec.primary ? "w-btn w-btn--primary" : "w-btn";
    b.type = "button";
    /* `icon` is a factory returning a fresh element, never a markup string —
       so nothing here ever needs innerHTML. An icon button carries its name in
       aria-label instead of visible text, because there is no text. */
    if (spec.icon) {
      b.classList.add("w-btn--icon");
      b.appendChild(spec.icon());
      if (spec.text) b.setAttribute("aria-label", spec.text);
    } else {
      b.textContent = spec.text;
    }
    b.title = spec.title ?? "";
    // Stamped so anything outside this module can find a button by what it DOES
    // rather than by where it sits. The fingerprint harness used to take the
    // drive buttons positionally, so adding one silently redirected every driven
    // state to the wrong button — and a wrong button still produces a perfectly
    // plausible hash.
    b.dataset.key = spec.key;
    b.addEventListener("click", () => spec.onClick(b));
    slot(spec).appendChild(b);
    made[spec.key] = b;
  }

  if (withFlash) {
    const flash = document.createElement("span");
    flash.className = "w-flash";
    flash.setAttribute("role", "status");
    host.appendChild(flash);

    let timer = null;
    made.flash = (msg) => {
      flash.textContent = msg;
      clearTimeout(timer);
      timer = setTimeout(() => { flash.textContent = ""; }, 2000);
    };
  }

  return made;
}
