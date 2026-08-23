/* ============================================================================
   Controls are generated from the parameter spec — a widget never writes a
   slider by hand. That is what makes widget #20 cheap: declare the parameter,
   get a labelled control, URL sync, keyboard support, and the shareable link
   for free.

   Filters/controls sit in one block below the figure, in declaration order.

   EVERY SETTABLE CONTROL CARRIES `data-param`, and every segmented button also
   carries `data-value`. Nothing in the shipped page reads them — they exist so
   `_lab/fingerprint.html` can drive a control the way a reader would, which is
   the only way to fingerprint an animation that has no drive button to press.
   Widget 12 eases on a segmented toggle and declines Step and Play entirely
   (principle 4.5), so before these attributes existed its transitions had NO
   coverage at all and could not have any: `check.mjs` demands a driven state
   from anything declaring an `animation`, and the harness could only press
   `.w-drive .w-btn[data-key=...]`.

   They are also the same rule as principle 5.7 one level out — a driver finds
   what it drives BY NAME, never by position. Taking segmented buttons
   positionally is exactly the bug that once pointed every driven state at the
   wrong button while still producing a stable, plausible-looking hash.
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

/**
 * TWO NUMBERS THAT ARE ONE IDEA GO ON ONE LINE.
 *
 *     childMean: { type: 'int', label: 'average',
 *                  row: { key: 'child', label: 'Children', token: 'group-b',
 *                         detail: '...' } },
 *     childSd:   { type: 'int', label: 'spread', row: { key: 'child' } },
 *
 * Consecutive fields sharing `row.key` render inside one flex row, under an
 * optional caption; `token` puts a swatch of `--c-<token>` beside that caption,
 * which is how a control block says which colour on the figure it is setting.
 * `label`, `token` and `detail` are read from the FIRST field of the run — the
 * others need only the key.
 *
 * Earned by widget 10: a population's centre and its spread are one idea, and
 * declaring two of them made a rail of four identical full-width sliders whose
 * labels ("Average child height", "Spread of child heights") were doing the
 * grouping that the layout should have done. The rail is 300px, so a paired
 * field gets 142px — enough for "average" and its value, not for a sentence,
 * which is the point: the caption carries the noun and the field carries the
 * quantity. Widget 8's trueMu/trueSize and widget 9's prior pair are the same
 * shape and can take it whenever they are next opened.
 *
 * DECLARATIVE, like `when`: core has to know the grouping before it renders,
 * and a predicate would have to be re-run on every value change.
 */

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
    if (entry[1].type === "readback") {
      bools = null;
      cells.push({ kind: "readback", entry });
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
  /* `setters` is keyed by parameter NAME, which is enough for every control —
     each one only ever shows its own value. A readback shows a function of
     SEVERAL parameters, so it cannot be keyed by one of them; it goes in a list
     that every change re-runs. Cheap because it swaps two class names and
     rebuilds nothing. */
  const refreshers = [];

  /* The run of fields currently sharing a row, and the box they go in. Reset by
     anything that is not a plain field, so a row cannot straddle a divider. */
  let rowKey = null;
  let rowBox = null;
  const endRow = () => { rowKey = null; rowBox = null; };

  for (const cell of toCells(spec, values)) {
    /* A LABELLED DIVIDER, and it carries no value. Widget 9 sets four numbers
       describing a population it is pretending not to know, and three more
       describing a belief about it — seven sliders that look like one list and
       are two completely different kinds of thing. The heading is what makes
       "these are the truth, those are your prior" structural instead of a
       sentence somebody has to read. */
    if (cell.kind === "section") {
      endRow();
      const [, field] = cell.entry;
      const h = document.createElement("p");
      h.className = "w-section";
      h.textContent = field.label ?? "";
      host.appendChild(h);
      continue;
    }

    /* A CASE TABLE, and it sets nothing. The two penalty dials in widget 14
       produce four named models — linear, ridge, lasso, elastic net — and which
       one you have is a fact about the two dials, so it belongs beside them
       rather than on the figure, where it was first drawn. `live` returns the
       [row, col] of the cell that is true now.

       `live` is a FUNCTION, unlike `when`, and the difference is load-bearing:
       `when` has to be declarative because core must know which parameter gates
       a field in order NOT to rebuild on every change (rebuilding mid-drag drops
       the slider you are holding). A readback rebuilds nothing, so re-running it
       on every change costs nothing and a predicate is safe here. */
    if (cell.kind === "readback") {
      endRow();
      const [, field] = cell.entry;
      const wrap = document.createElement("div");
      wrap.className = "w-field";
      if (field.label) {
        const cap = document.createElement("span");
        cap.className = "w-label";
        cap.textContent = field.label;
        wrap.appendChild(cap);
      }
      const grid = document.createElement("div");
      grid.className = "w-readback";
      const cols = field.cols ?? [];
      const rows = field.rows ?? [];
      grid.style.gridTemplateColumns = `auto repeat(${cols.length}, 1fr)`;
      const cellEls = [];
      const head = document.createElement("div");
      head.className = "w-readback-hd";
      grid.appendChild(head);
      for (const c of cols) {
        const el = document.createElement("div");
        el.className = "w-readback-hd";
        el.textContent = c;
        grid.appendChild(el);
      }
      rows.forEach((rowLabel, i) => {
        const rl = document.createElement("div");
        rl.className = "w-readback-hd";
        rl.textContent = rowLabel;
        grid.appendChild(rl);
        cellEls[i] = [];
        (field.cells?.[i] ?? []).forEach((text, j) => {
          const el = document.createElement("div");
          el.textContent = text;
          grid.appendChild(el);
          cellEls[i][j] = el;
        });
      });
      const mark = (next) => {
        const at = field.live?.(next) ?? [-1, -1];
        cellEls.forEach((row, i) => row.forEach((el, j) => {
          el.classList.toggle("w-readback-on", i === at[0] && j === at[1]);
        }));
      };
      mark(values);
      refreshers.push(mark);
      wrap.appendChild(grid);
      host.appendChild(wrap);
      continue;
    }

    if (cell.kind === "bools") {
      endRow();
      const group = document.createElement("div");
      group.className = "w-field w-bools";
      for (const [name, field] of cell.fields) {
        const id = `f-${name}`;
        /* EACH SWITCH IS A COLUMN, not a bare label. `.w-bools` is a flex ROW,
           so a detail appended straight to it would land between two
           checkboxes rather than under the one it belongs to. The wrapper is
           what gives a detail somewhere to be. */
        const item = document.createElement("div");
        item.className = "w-bool";
        const label = document.createElement("label");
        label.setAttribute("for", id);
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.dataset.param = name;
        input.checked = Boolean(values[name]);
        input.addEventListener("change", () => onChange(name, input.checked));
        label.append(input, document.createTextNode(field.label ?? name));
        item.appendChild(label);

        /* 3.4f, THE THIRD TIME. `params.js` documents `detail` as something any
           field may carry. `choice` and `gate` rendered it from the start;
           `int`/`float` were fixed when widget 8's warning about its size
           parameter turned out never to have been on screen; `bool` was missed
           in both passes, so a checkbox's detail was copy nobody could read.
           Same field, same job, same rendering, everywhere. */
        if (field.detail) {
          const d = document.createElement("p");
          d.className = "w-detail";
          d.textContent = field.detail;
          item.appendChild(d);
        }

        group.appendChild(item);
        setters[name] = (v) => { input.checked = Boolean(v); };
      }
      host.appendChild(group);
      continue;
    }

    if (cell.kind === "gate") {
      endRow();
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

    /* Open a row box when this field starts a new run, close it when the key
       changes. A field with no `row` closes any run and goes straight to host,
       which is every existing widget and is why nothing of theirs moves. */
    const row = typeof field.row === "string" ? { key: field.row } : field.row;
    if (!row) {
      endRow();
    } else if (row.key !== rowKey) {
      rowKey = row.key;
      if (row.label) {
        const cap = document.createElement("p");
        cap.className = "w-row-cap";
        if (row.token) {
          const dot = document.createElement("i");
          dot.style.setProperty("--swatch", `var(--c-${row.token}, var(--${row.token}))`);
          cap.appendChild(dot);
        }
        cap.appendChild(document.createTextNode(row.label));
        host.appendChild(cap);
      }
      rowBox = document.createElement("div");
      rowBox.className = "w-field-row";
      host.appendChild(rowBox);
      if (row.detail) {
        const d = document.createElement("p");
        d.className = "w-detail w-row-detail";
        d.textContent = row.detail;
        host.appendChild(d);
      }
    }
    const target = rowBox ?? host;

    const wrap = document.createElement("div");
    wrap.className = "w-field";

    const id = `f-${name}`;
    const label = document.createElement("label");
    label.setAttribute("for", id);

    const text = document.createElement("span");
    text.textContent = field.label ?? name;
    label.appendChild(text);
    /* An empty label is a deliberate "the section heading above already said
       this" — it must not render as a blank line. The control still names
       itself to assistive tech through its own aria-label. */
    const labelled = (field.label ?? name) !== "";

    if (field.type === "int" || field.type === "float") {
      const val = document.createElement("span");
      val.className = "val";
      label.appendChild(val);
      wrap.appendChild(label);

      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.dataset.param = name;
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
      select.dataset.param = name;
      /* CONSECUTIVE OPTIONS SHARING A `group` BECOME AN <optgroup>, the same
         declaration the segmented branch already reads and the same rule — a
         run, not a lookup, so the spec's order is the rendered order.

         Earned by the correlation matrix: thirteen measurements make 156 ordered
         pairs, and the dropdown is the keyboard and screen-reader path to the
         same parameter the matrix sets. A flat list of 156 is technically
         operable and practically not; thirteen groups of twelve is. Ungrouped
         options are appended straight to the select, so every existing widget
         renders byte-identically. */
      let run = null;
      for (const { value, label: text2, group } of optionEntries(field)) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text2;
        if (group === undefined) {
          run = null;
          select.appendChild(opt);
          continue;
        }
        if (!run || run.key !== group) {
          run = { key: group, el: document.createElement("optgroup") };
          run.el.label = group;
          select.appendChild(run.el);
        }
        run.el.appendChild(opt);
      }
      select.value = values[name];
      select.addEventListener("change", () => onChange(name, select.value));
      wrap.appendChild(select);
      setters[name] = (v) => { select.value = v; };
    } else if (field.type === "matrix") {
      /* A GRID OF CELLS, ONE OPTION PER CELL. For a parameter that is a PAIR —
         each half ranging over a list — where a flat dropdown of every
         combination is technically operable and practically not, and where the
         grid's own shading carries something the option list cannot.
         Widget 14: thirteen body measurements, 156 ordered pairs, and how dark
         a cell is drawn IS how correlated that pair is.

         FOUR AREAS SHARING ONE SET OF TRACKS — an empty corner, the column
         names, the row names, and the cells. Sharing the tracks is the point:
         names positioned independently of the cells they name is how a labelled
         figure comes to be off by one, and there is no arithmetic here to get
         wrong. The column names are turned ninety degrees with `writing-mode`,
         which makes a name's LENGTH its height, so the band above the grid
         sizes itself off the longest name — see tokens.css. */
      const options = optionEntries(field);
      const rows = field.rows ?? [];
      const cols = field.cols ?? rows;
      if (labelled) { label.id = `${id}-l`; wrap.appendChild(label); }

      const box = document.createElement("div");
      box.className = "w-matrix";
      box.style.setProperty("--w-matrix-cols", String(cols.length));
      box.style.setProperty("--w-matrix-rows", String(rows.length));
      /* Which semantic role the cells are shaded in. Named the same way a legend
         entry and a row caption name theirs, so a widget never writes a colour. */
      if (field.token) {
        box.style.setProperty("--w-matrix-token", `var(--c-${field.token})`);
      }
      box.appendChild(document.createElement("div"));   /* the corner */

      const colBand = document.createElement("div");
      colBand.className = "w-matrix-cols";
      for (const c of cols) {
        const el = document.createElement("span");
        el.textContent = c;
        colBand.appendChild(el);
      }
      box.appendChild(colBand);

      const rowBand = document.createElement("div");
      rowBand.className = "w-matrix-rows";
      for (const r of rows) {
        const el = document.createElement("span");
        el.textContent = r;
        rowBand.appendChild(el);
      }
      box.appendChild(rowBand);

      const grid = document.createElement("div");
      grid.className = "w-matrix-grid";
      grid.id = id;
      grid.dataset.param = name;
      grid.tabIndex = 0;
      grid.setAttribute("role", "grid");
      if (labelled) grid.setAttribute("aria-labelledby", label.id);
      else grid.setAttribute("aria-label", name);

      /* Two lookups, built once: cell by position, and position by value. The
         second is what lets `setters` and the arrow keys work from the URL's
         value without searching 156 options on every keypress. */
      const at = rows.map(() => new Array(cols.length).fill(null));
      const where = new Map();
      for (const o of options) {
        if (o.row === undefined || o.col === undefined) continue;
        at[o.row][o.col] = o;
        where.set(o.value, [o.row, o.col]);
      }
      const cellEls = rows.map(() => new Array(cols.length).fill(null));
      for (let i = 0; i < rows.length; i += 1) {
        const rowEl = document.createElement("div");
        rowEl.setAttribute("role", "row");
        for (let j = 0; j < cols.length; j += 1) {
          const o = at[i][j];
          const el = document.createElement("div");
          el.className = "w-matrix-cell";
          el.setAttribute("role", "gridcell");
          if (!o) {
            /* NOT EVERY CELL IS AN OPTION. A measurement against itself is not a
               pair, so the diagonal is drawn and not selectable. */
            el.classList.add("w-matrix-cell--off");
            el.setAttribute("aria-disabled", "true");
          } else {
            el.dataset.value = o.value;
            el.title = o.label;
            el.setAttribute("aria-label", o.label);
            el.setAttribute("aria-selected", "false");
            /* THE SHADE IS AN OPACITY ON A CHILD, NOT ON THE CELL. The selected
               cell's ring is on the cell itself, and fading the cell would fade
               the ring with it — brightest exactly where it is least needed. */
            const fill = document.createElement("i");
            fill.style.opacity = String(0.10 + 0.90 * Math.min(1, Math.max(0, o.shade ?? 1)));
            el.appendChild(fill);
            el.addEventListener("click", () => { mark(o.value); onChange(name, o.value); });
          }
          rowEl.appendChild(el);
          cellEls[i][j] = el;
        }
        grid.appendChild(rowEl);
      }
      box.appendChild(grid);
      wrap.appendChild(box);

      const detail = document.createElement("p");
      detail.className = "w-detail";
      wrap.appendChild(detail);

      let atNow = where.get(values[name]) ?? [0, 0];
      function mark(v) {
        const pos = where.get(v);
        if (!pos) return;
        const prev = cellEls[atNow[0]]?.[atNow[1]];
        if (prev) prev.setAttribute("aria-selected", "false");
        atNow = pos;
        cellEls[pos[0]][pos[1]].setAttribute("aria-selected", "true");
        /* The names of the row and the column you are on take the highlight, so
           a grid with no labels ON it still says which pair is selected. */
        for (let k = 0; k < cols.length; k += 1) {
          colBand.children[k].classList.toggle("on", k === pos[1]);
        }
        for (let k = 0; k < rows.length; k += 1) {
          rowBand.children[k].classList.toggle("on", k === pos[0]);
        }
        detail.textContent = at[pos[0]][pos[1]]?.detail ?? "";
      }
      mark(values[name]);

      /* ARROW KEYS MOVE THE SELECTION, the way they do in the dropdown this
         replaces — one control, one focus stop, no roving tabindex over 169
         cells. A step that lands on a cell that is not an option keeps going in
         the same direction; a step that runs off the edge does not wrap, so the
         ends of the grid are findable by feel. */
      grid.addEventListener("keydown", (e) => {
        const step = {
          ArrowLeft: [0, -1], ArrowRight: [0, 1],
          ArrowUp: [-1, 0], ArrowDown: [1, 0],
        }[e.key];
        if (!step) return;
        let [i, j] = atNow;
        for (;;) {
          i += step[0]; j += step[1];
          if (i < 0 || j < 0 || i >= rows.length || j >= cols.length) return;
          if (at[i][j]) break;
        }
        e.preventDefault();
        mark(at[i][j].value);
        onChange(name, at[i][j].value);
      });

      setters[name] = mark;
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
      input.dataset.param = name;
      /* A `choice` RANGE HOLDS AN INDEX, NOT THE PARAMETER'S VALUE, so a driver
         that sets `ratio` to "1to2" would otherwise have to know the option
         order. The option values ride along on the element that hides them. */
      input.dataset.options = JSON.stringify(options.map((o) => o.value));
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
      if (labelled) wrap.appendChild(label);
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
        b.dataset.param = name;
        b.dataset.value = o.value;
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

    target.appendChild(wrap);
  }

  api.sync = (name, value) => { setters[name]?.(value); };
  api.syncAll = (next) => {
    for (const [name, v] of Object.entries(next)) setters[name]?.(v);
    api.refresh(next);
  };
  api.refresh = (next) => { for (const f of refreshers) f(next); };
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
