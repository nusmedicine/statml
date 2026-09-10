/* ============================================================================
   Parameters live in the URL. That is the whole contract.

   A widget declares a spec; core parses the query string into typed, clamped
   values and can serialise values back to a query string, omitting anything
   still at its default so the shareable link stays short and readable:

       /w/clt/?dist=bimodal&n=30

   Because state is entirely in the URL, three things fall out for free:
     - the Python helper is a query-string builder and nothing more
     - "copy link to this state" makes the instructor an author, not a coder
     - the book and the notebook embed the same widget at different states

   Supported types:

     int, float   numeric slider
     bool         checkbox
     gate         full-width button that reveals a stage; a bool on the wire
     section      a labelled divider between groups of controls; NOT a parameter,
                  carries no value and never reaches the URL
     readback     a small case table naming which of a few labelled outcomes the
                  controls above it produce; NOT a parameter, sets nothing
     expr         several parameters rendered as the slots of ONE line of code,
                  `T[ _, _, _ ]`; NOT a parameter itself — each slot is an
                  ordinary option-list parameter declared `hidden`, so it keeps
                  its own URL key
     text         a short string the reader TYPES, validated by the widget —
                  a shape, an expression. `parse(text)` canonicalises what was
                  typed before it is stored (and what a URL carries), `show(v)`
                  formats the stored value for display, `check(text, values)`
                  returns a message to show under the field while it is typed
                  in, or null; all optional. Widget 53's reshape argument,
                  2026-09-09: a dropdown of 22 sizes per slot was the long
                  list Kenneth would not have.
     select       dropdown — for many options, or unordered ones
     choice       slider over an ordered option list, with tick labels
     segmented    connected button group, all options visible at rest
     matrix       a labelled grid of cells, one option per cell, each shaded by a
                  magnitude the widget supplies

   select / choice / segmented / matrix are the same data (a string key from a
   list) in four shapes, chosen by what the options MEAN rather than how many
   there are. The list is fixed at declaration, or `options` is a function of
   the resolved values with `optionsFrom` naming the parameter(s) it reads —
   a position inside a tensor whose rank is itself a parameter (widget 53). Reach for `choice` when they form a magnitude, so
   left-to-right carries information; `segmented` for a handful of alternative
   readings, where hiding the alternatives inside a dropdown hides that a choice
   exists at all; `select` only when the list is long enough that neither fits.

   `matrix` is for the case none of those fit: an option that is a PAIR of things,
   each half ranging over a list. 156 ordered pairs of thirteen body measurements
   is a flat dropdown nobody can navigate, and the grid's own texture — which
   pairs are shaded dark — is teaching content, so the control and the figure are
   the same object. It carries `rows` and `cols`, the axis names, and each option
   carries `row`, `col` and `shade`.
   ========================================================================= */

/* Spec entries that declare POSITION in the control block and nothing else.
   They carry no value, never reach `values`, and never reach the URL. */
const NON_PARAM_TYPES = new Set(["section", "readback", "expr"]);
/* the types whose value must be one of a list — a list that may follow another
   parameter (`optionsFrom`) and so may not hold the field's own default */
const OPTION_TYPES = new Set(["select", "choice", "segmented", "matrix"]);

/** Clamp and snap a number to the field's min/max/step. */
function coerceNumber(field, raw, isInt) {
  let v = Number(raw);
  if (!Number.isFinite(v)) return field.default;
  if (field.step) {
    const base = field.min ?? 0;
    v = base + Math.round((v - base) / field.step) * field.step;
  }
  if (isInt) v = Math.round(v);
  if (field.min !== undefined) v = Math.max(field.min, v);
  if (field.max !== undefined) v = Math.min(field.max, v);
  // Kill float drift from the snap step (0.30000000000000004 -> 0.3).
  return isInt ? v : Number(v.toFixed(6));
}

/** Resolve a spec against a URLSearchParams into typed values. */
export function resolveParams(spec, search) {
  const out = {};
  for (const [name, field] of Object.entries(spec)) {
    /* A section is a heading, not a parameter. It lives in the spec because the
       spec is the declaration of the control block's ORDER, and a divider that
       had to be declared somewhere else could not say which two groups it comes
       between. It never reaches `values`, so nothing downstream sees it.

       `readback` is the second of these: a case table naming which of a few
       labelled outcomes the controls above it produce. Same reasoning — it has
       to say where in the rail it goes — and the same consequence: it carries no
       value, so it never reaches the URL. */
    if (NON_PARAM_TYPES.has(field.type)) continue;
    const raw = search.get(name);
    if (raw === null || raw === "") {
      out[name] = field.default;
      /* A list that follows another parameter may not hold the default: a
         chain slot whose menu follows the data type, on a link that names
         only the data type (widget 51, 2026-09-10 — the rail's four selects
         sat blank while the figure drew the first option). The first option
         stands in, which is exactly what widget.js does when the list changes
         under a click; without this the two doors disagreed. */
      if (OPTION_TYPES.has(field.type)) {
        const keys = optionKeys(field, out);
        if (keys.length && !keys.includes(field.default)) out[name] = keys[0];
      }
      continue;
    }
    switch (field.type) {
      case "int":
        out[name] = coerceNumber(field, raw, true);
        break;
      case "float":
        out[name] = coerceNumber(field, raw, false);
        break;
      /* `gate` is a bool that renders as a button rather than a checkbox — the
         reveal for a whole second stage. Same wire format, so a link written
         before it existed still reads. */
      case "bool":
      case "gate":
        out[name] = raw === "1" || raw === "true" || raw === "yes";
        break;
      case "select":
      case "choice":
      case "segmented":
      case "matrix": {
        /* `out` so far: a list that depends on another parameter reads it
           resolved, which asks that the other be declared first */
        const keys = optionKeys(field, out);
        out[name] = keys.includes(raw) ? raw
          : keys.includes(field.default) || !keys.length ? field.default
            : keys[0];   // the default itself may have left the list (see above)
        break;
      }
      /* a typed value is stored in its canonical form whether it came from the
         field or the address bar, so `?shape=2,5,2` and `?shape=2x5x2` are one
         state; the cap keeps a pasted novel out of the URL */
      case "text": {
        const t = raw.slice(0, field.maxLength ?? 80);
        out[name] = field.parse ? field.parse(t) : t;
        break;
      }
      default:
        out[name] = raw;
    }
  }
  return out;
}

/**
 * Options may be ["a","b"] or [{value,label,detail}] or {a:"A", b:"B"}.
 *
 * `label` is the SHORT name — it has to fit a slider tick or a segment button.
 * An option's `detail` is optional and renders as a muted line under the
 * control, so a short tick label can still explain what the current setting
 * actually does. It sits below the FIELD's own `detail`, which describes the
 * parameter and renders on every field type (3.4f).
 */
/* OPTIONS MAY BE A FUNCTION OF THE OTHER VALUES (widget 53, round 16). A
   position inside a tensor runs 0 to its rank, and the rank is a parameter,
   so the list a dropdown offers cannot be fixed at declaration without
   offering positions the tensor does not have (decision 14 there). A field
   declares `options: (values) => [...]` and names what it reads in
   `optionsFrom`, so the block rebuilds when exactly that parameter moves
   and a value the new list no longer holds returns to the field's default. */
export function optionEntries(field, values = {}) {
  const o = typeof field.options === "function" ? field.options(values) : field.options;
  if (Array.isArray(o)) {
    return o.map((item) =>
      typeof item === "string"
        ? { value: item, label: item }
        : {
          value: item.value, label: item.label ?? item.value,
          detail: item.detail, group: item.group,
          /* an option may wear a semantic colour token (widget 35's
             positive-class pick matches its histogram hues); segmented
             renders it as a swatch dot before the label */
          token: item.token,
          /* `segmented` with `style: "grid"` only: this option takes a full
             row rather than one cell */
          span: item.span,
          /* `matrix` only. Where the option sits in the grid, and how dark the
             cell is drawn — 0 to 1. Carried on the option rather than in a
             parallel array, so a cell cannot come adrift from the value it
             sets. */
          row: item.row, col: item.col, shade: item.shade,
        }
    );
  }
  /* The object-map form carries no `group` and cannot: an object is a map from
     value to label with nowhere to hang a third field. A widget that wants
     grouping declares the array form. */
  return Object.entries(o).map(([value, label]) => ({ value, label }));
}

export function optionKeys(field, values = {}) {
  return optionEntries(field, values).map((e) => e.value);
}

/**
 * Serialise values to a query string, omitting defaults.
 * `extra` lets callers pin things like embed=1 or theme=dark.
 */
export function toQuery(spec, values, extra = {}) {
  const q = new URLSearchParams();
  for (const [name, field] of Object.entries(spec)) {
    const v = values[name];
    if (v === undefined || v === field.default) continue;
    const isFlag = field.type === "bool" || field.type === "gate";
    q.set(name, isFlag ? (v ? "1" : "0") : String(v));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  return q.toString();
}

/** Replace the address bar without adding a history entry. */
export function syncUrl(spec, values, preserve = ["embed", "theme"]) {
  const current = new URLSearchParams(location.search);
  const extra = {};
  for (const key of preserve) {
    if (current.has(key)) extra[key] = current.get(key);
  }
  const qs = toQuery(spec, values, extra);
  const next = location.pathname + (qs ? `?${qs}` : "") + location.hash;
  history.replaceState(null, "", next);
}
