/* ============================================================================
   Environment: theme resolution, token bridge, and iframe height reporting.

   Theme
     Three states: auto (follow the OS, live), light, dark. The widget's utility
     row cycles them.

     The choice is stored in localStorage, NOT in the parameters and NOT in the
     URL, and that is deliberate. Non-negotiable 1 says parameters are the only
     state of record — but a theme is not part of what the figure MEANS, it is a
     property of the person looking at it. Put it in `values` and every "Copy
     link" an instructor pastes would force their own theme on a room full of
     students. It stays out of the shareable link for the same reason the OS
     preference does.

     ?theme=light|dark still works, as the embedder's suggestion — but only until
     the reader expresses a preference of their own, which then wins for good. An
     explicit click always beats a URL someone else wrote.

   Token bridge
     Canvas cannot read CSS custom properties, so readTokens() resolves them
     once per render into a plain object. This is why widgets never hardcode a
     colour: tokens.css stays the single source of truth even inside canvas.

   Height reporting
     A framed widget posts its height to the parent on every change. Nothing in
     this repo listens any more — the Quarto book that did was deleted with the
     rest of the embedders (docs/prd.md §6). It is kept because the notebook
     lessons embed widgets by iframe, and a host that wants auto-resize needs
     only a five-line message listener. It costs nothing when unframed: the
     first line returns immediately.
   ========================================================================= */

const THEME_KEY = "statml:theme";
const THEME_MODES = ["auto", "light", "dark"];

const osTheme = () => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/* Storage can throw outright in private browsing and in some sandboxed frames,
   and a theme button is never worth breaking a widget over. Every access is
   guarded and falls back to auto. */
function stored() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_MODES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** "auto" | "light" | "dark" — what the theme button should be showing. */
export function themeMode() {
  const own = stored();
  if (own) return own;
  // No choice of their own yet, so an embedder's ?theme= seeds the initial view.
  const q = new URLSearchParams(location.search).get("theme");
  return q === "light" || q === "dark" ? q : "auto";
}

/** Stamp <html> so the [data-theme] scope in tokens.css wins. Returns the
    resolved theme, which is never "auto" — that is a mode, not a palette. */
export function applyTheme() {
  const mode = themeMode();
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
    return osTheme();
  }
  document.documentElement.setAttribute("data-theme", mode);
  return mode;
}

/** Persist a choice and apply it. Returns the resolved theme. */
export function setThemeMode(mode) {
  try {
    if (mode === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* Unstorable: the choice still applies for this page, it just will not
       survive a reload. Better than refusing to switch at all. */
  }
  return applyTheme();
}

/** The mode after this one, for a button that cycles auto -> light -> dark. */
export const nextThemeMode = (mode) =>
  THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];

export function resolveTheme() {
  return applyTheme();
}

export function isEmbedded() {
  const q = new URLSearchParams(location.search).get("embed");
  return q === "1" || q === "true";
}

/** Resolve the design tokens canvas needs into plain strings. */
export function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    surface: v("--surface-1"),
    surface2: v("--surface-2"),
    surface3: v("--surface-3"),
    ink1: v("--ink-1"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    grid: v("--grid"),
    axis: v("--axis"),
    empirical: v("--c-empirical"),
    theory: v("--c-theory"),
    smoothed: v("--c-smoothed"),
    highlight: v("--c-highlight"),
    reference: v("--c-reference"),
    groupA: v("--c-group-a"),
    groupB: v("--c-group-b"),
    extreme: v("--c-extreme"),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
    font: v("--font"),
    fsXs: v("--fs-xs"),
    fsSm: v("--fs-sm"),
    fsMd: v("--fs-md"),
  };
}

/** Report document height to the parent frame, on change. */
export function reportHeight(slug) {
  if (window.parent === window) return;

  let last = -1;
  const post = () => {
    const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === last) return;
    last = h;
    window.parent.postMessage({ type: "statml:height", slug, height: h }, "*");
  };

  new ResizeObserver(post).observe(document.documentElement);
  window.addEventListener("load", post);
  post();
}

/** Re-run `fn` when the OS theme changes, if we are following the OS.
    The mode is read at fire time, not at bind time, because the reader can
    switch back to auto long after this listener was attached. */
export function onThemeChange(fn) {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themeMode() !== "auto") return;
    applyTheme();
    fn();
  });
}
