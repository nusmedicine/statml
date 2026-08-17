"""Embed statml teaching widgets in a JupyterLab notebook.

The widgets are static web pages whose entire state lives in the query string,
so this module is a query-string builder and an iframe emitter. There is no
kernel communication, no widget protocol, and no Jupyter extension to install.

Typical teaching use::

    from statml_widgets import show
    show("clt", dist="exponential", n=30)

Or paste a link copied straight out of a widget's "Copy link" button::

    from statml_widgets import show_url
    show_url("https://example.github.io/book-statml/w/clt/?dist=bimodal&n=30")

Why an iframe rather than ``IPython.display.HTML`` with a script tag: inline
scripts in notebook output depend on the notebook's trust state and behave
differently across JupyterLab, VS Code, and Colab. An iframe is deterministic
everywhere.

If a student sees an empty area instead of a widget, the cell's output is
untrusted -- have them run the cell themselves rather than reading saved output.
"""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlencode, urlsplit

__all__ = [
    "show",
    "show_url",
    "url",
    "link",
    "base_url",
    "use_local",
    "use_pages",
    "use_base",
    "catalogue",
]

# TODO(kb): point this at the real GitHub Pages origin once the repo has a remote.
# Overridable at runtime by use_pages()/use_local()/use_base(), or by setting
# the STATML_WIDGETS_BASE environment variable before importing.
DEFAULT_BASE = "https://REPLACE-ME.github.io/book-statml/w"

# Natural iframe heights, mirroring widgets/manifest.json. Keep in sync; Phase 1
# should generate this from the manifest at build time.
HEIGHTS: dict[str, int] = {
    "galton-board": 1040,
    "clt": 1090,
}
FALLBACK_HEIGHT = 680

_base: str | None = None


# --------------------------------------------------------------------------- #
# base URL resolution
# --------------------------------------------------------------------------- #

def base_url() -> str:
    """The origin widgets are loaded from, without a trailing slash."""
    if _base is not None:
        return _base
    return os.environ.get("STATML_WIDGETS_BASE", DEFAULT_BASE).rstrip("/")


def use_base(base: str) -> str:
    """Point at an arbitrary base URL for the rest of the session."""
    global _base
    _base = base.rstrip("/")
    return _base


def use_local(port: int = 8000, path: str = "/widgets") -> str:
    """Serve widgets from a local checkout -- the offline classroom fallback.

    Run ``npm run dev`` (or ``python -m http.server 8000``) at the repo root,
    then call this once at the top of the teaching notebook.
    """
    return use_base(f"http://localhost:{port}{path}")


def use_pages(user: str, repo: str = "book-statml", subdir: str = "w") -> str:
    """Point at a GitHub Pages deployment."""
    return use_base(f"https://{user}.github.io/{repo}/{subdir}")


# --------------------------------------------------------------------------- #
# URL building
# --------------------------------------------------------------------------- #

def _encode(params: dict[str, Any]) -> str:
    clean: dict[str, Any] = {}
    for key, value in params.items():
        if value is None:
            continue
        if isinstance(value, bool):
            clean[key] = "1" if value else "0"
        else:
            clean[key] = value
    return urlencode(clean)


def url(slug: str, **params: Any) -> str:
    """Build the standalone URL for a widget at a given state."""
    query = _encode(params)
    return f"{base_url()}/{slug}/" + (f"?{query}" if query else "")


class _Embed:
    """A minimal rich-display object.

    Deliberately not ``IPython.display.HTML``: passing an iframe to HTML() emits
    a "Consider using IFrame instead" UserWarning, which surfaces as a warning
    box in the student's notebook. IFrame itself gives no control over styling.
    A ``_repr_html_`` does the job and keeps IPython out of the import path.
    """

    def __init__(self, html: str, text: str = "") -> None:
        self._html = html
        self._text = text

    def _repr_html_(self) -> str:
        return self._html

    def __repr__(self) -> str:
        return self._text or self._html


def _iframe(src: str, height: int, width: str, title: str) -> _Embed:
    style = (
        f"width:{width};height:{height}px;border:1px solid rgba(128,128,128,0.28);"
        "border-radius:6px;display:block;color-scheme:light dark;"
    )
    return _Embed(
        f'<iframe src="{src}" style="{style}" loading="lazy" '
        f'title="{title}" allow="clipboard-write"></iframe>',
        text=f"<{title}: {src}>",
    )


def show(
    slug: str,
    *,
    height: int | None = None,
    width: str = "100%",
    theme: str | None = None,
    **params: Any,
) -> _Embed:
    """Render a widget inline in the notebook.

    Args:
        slug: widget directory name, e.g. ``"clt"``.
        height: iframe height in pixels; defaults to the widget's natural height.
        width: CSS width for the iframe.
        theme: ``"light"`` or ``"dark"`` to pin the theme; ``None`` follows the OS.
        **params: widget parameters, passed through to the query string.

    Notebooks get an explicit height rather than the postMessage auto-resize the
    book uses, because we cannot rely on installing a listener in the notebook
    page. Pass ``height=`` if a widget needs more room.
    """
    src = url(slug, embed=1, theme=theme, **params)
    px = height or HEIGHTS.get(slug, FALLBACK_HEIGHT)
    return _iframe(src, px, width, f"{slug} widget")


def show_url(src: str, *, height: int | None = None, width: str = "100%") -> _Embed:
    """Embed a link copied from a widget's "Copy link" button, verbatim.

    This is the intended authoring loop: tune the widget by hand until it makes
    the point you want, copy the link, paste it here.
    """
    if "embed=" not in src:
        src += ("&" if "?" in src else "?") + "embed=1"
    slug = [p for p in urlsplit(src).path.split("/") if p]
    key = slug[-1] if slug else ""
    px = height or HEIGHTS.get(key, FALLBACK_HEIGHT)
    return _iframe(src, px, width, f"{key or 'statml'} widget")


def link(slug: str, text: str | None = None, **params: Any) -> _Embed:
    """A plain hyperlink to the standalone widget -- useful in slides and PDFs."""
    href = url(slug, **params)
    label = text or slug
    return _Embed(
        f'<a href="{href}" target="_blank" rel="noopener">{label}</a>',
        text=href,
    )


def catalogue() -> _Embed:
    """List the widgets this helper knows a natural height for."""
    rows = "".join(
        f"<li><code>{slug}</code> — {px}px</li>" for slug, px in sorted(HEIGHTS.items())
    )
    return _Embed(
        f"<p>Widgets served from <code>{base_url()}</code>:</p><ul>{rows}</ul>",
        text=f"{base_url()}: {sorted(HEIGHTS)}",
    )
