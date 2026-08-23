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
     select       dropdown — for many options, or unordered ones
     choice       slider over an ordered option list, with tick labels
     segmented    connected button group, all options visible at rest

   select / choice / segmented are the same data (a string key from a fixed list)
   in three shapes, chosen by what the options MEAN rather than how many there
   are. Reach for `choice` when they form a magnitude, so left-to-right carries
   information; `segmented` for a handful of alternative readings, where hiding
   the alternatives inside a dropdown hides that a choice exists at all; `select`
   only when the list is long enough that neither fits.
   ========================================================================= */

/* Spec entries that declare POSITION in the control block and nothing else.
   They carry no value, never reach `values`, and never reach the URL. */
const NON_PARAM_TYPES = new Set(["section", "readback"]);

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
      case "segmented": {
        const keys = optionKeys(field);
        out[name] = keys.includes(raw) ? raw : field.default;
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
 * `detail` is optional and renders as a muted line under a `choice` slider, so a
 * short tick label can still explain what the current setting actually does.
 */
export function optionEntries(field) {
  const o = field.options;
  if (Array.isArray(o)) {
    return o.map((item) =>
      typeof item === "string"
        ? { value: item, label: item }
        : {
          value: item.value, label: item.label ?? item.value,
          detail: item.detail, group: item.group,
        }
    );
  }
  return Object.entries(o).map(([value, label]) => ({ value, label }));
}

export function optionKeys(field) {
  return optionEntries(field).map((e) => e.value);
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
