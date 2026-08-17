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
function toCells(spec) {
  const cells = [];
  let bools = null;
  for (const entry of Object.entries(spec)) {
    if (entry[1].hidden) continue;
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
  host.innerHTML = "";
  const setters = {};

  for (const cell of toCells(spec)) {
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

      const seg = document.createElement("div");
      seg.className = "w-seg";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", field.label ?? name);

      const buttons = new Map();
      const mark = (v) => {
        for (const [key, btn] of buttons) btn.setAttribute("aria-pressed", String(key === v));
      };
      for (const o of options) {
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
        seg.appendChild(b);
      }
      mark(values[name]);
      wrap.appendChild(seg);
      setters[name] = mark;
    }
    // `bool` never reaches here — checkboxes are grouped by toCells() above.

    host.appendChild(wrap);
  }

  return {
    /** Push a programmatic parameter change back into the controls. */
    sync(name, value) {
      setters[name]?.(value);
    },
    syncAll(next) {
      for (const [name, v] of Object.entries(next)) setters[name]?.(v);
    },
  };
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

  for (const spec of buttons) {
    if (!spec) continue;
    const b = document.createElement("button");
    b.className = spec.primary ? "w-btn w-btn--primary" : "w-btn";
    b.type = "button";
    b.textContent = spec.text;
    b.title = spec.title ?? "";
    // Stamped so anything outside this module can find a button by what it DOES
    // rather than by where it sits. The fingerprint harness used to take the
    // drive buttons positionally, so adding one silently redirected every driven
    // state to the wrong button — and a wrong button still produces a perfectly
    // plausible hash.
    b.dataset.key = spec.key;
    b.addEventListener("click", () => spec.onClick(b));
    host.appendChild(b);
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
