/* ============================================================================
   Environment: theme resolution, token bridge, and iframe height reporting.

   Theme
     ?theme=light|dark stamps data-theme on <html> so the CSS toggle scope wins.
     With no parameter, the OS preference applies and we listen for changes.

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

export function resolveTheme() {
  const q = new URLSearchParams(location.search).get("theme");
  if (q === "light" || q === "dark") {
    document.documentElement.setAttribute("data-theme", q);
    return q;
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

/** Re-run `fn` when the OS theme changes and no explicit theme is pinned. */
export function onThemeChange(fn) {
  if (new URLSearchParams(location.search).has("theme")) return;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fn);
}
