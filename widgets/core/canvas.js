/* ============================================================================
   Canvas drawing primitives.

   Canvas rather than SVG because these widgets animate and redraw on every
   slider tick, and one code path is cheaper to keep consistent across forty
   figures. The accessibility cost of canvas text is paid back elsewhere: every
   widget also renders an HTML readout and an optional table view, which serve
   screen readers better than SVG <text> ever did.

   The mark specs encoded here are fixed across the whole collection:
     bars      <= 24px thick, 4px rounded data-end, square at the baseline
     lines     2px, round join and cap
     markers   >= 8px diameter, 2px surface ring where marks overlap
     gridlines 1px solid, one step off the surface, never dashed
     spacing   a 2px surface gap separates touching marks
   ========================================================================= */

const BAR_MAX = 24;
const BAR_RADIUS = 4;
const SURFACE_GAP = 2;
const LINE_W = 2;

/* --- hi-dpi canvas ------------------------------------------------------- */

export function createCanvas(host, height) {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = height;

  /**
   * `heightOf` is optional and is a function of the WIDTH. It resolves here
   * rather than in the caller because the ordering is the whole point: the width
   * is set by CSS and is knowable before anything is painted, the height is not,
   * and a height computed from last frame's width paints one frame at the wrong
   * size — which is exactly the jump the caller's old comment was about.
   *
   * A widget needs this when a panel must stay SQUARE. Widget 14's coefficient
   * plane is only allowed to be square: its claim is that only the diamond has
   * corners, and at unequal scales the L1 ball is not drawn as a diamond. So a
   * panel that fills the row's width has to be given the height to match, and
   * only the width knows what that is.
   */
  function resize(heightOf) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(240, host.clientWidth || 600);
    if (heightOf) h = heightOf(w);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  return {
    canvas,
    ctx,
    resize,
    setHeight(next) { h = next; },
    get width() { return w; },
    get height() { return h; },
    clear() { ctx.clearRect(0, 0, w, h); },

    /**
     * A pointer event in DRAWING coordinates — the space `draw()` paints in.
     *
     * SCALED AGAINST THE ELEMENT'S OWN BOX, NEVER AGAINST devicePixelRatio.
     * `ctx.setTransform(dpr, …)` above already makes one drawing unit one CSS
     * pixel, so `canvas.width / rect.width` IS the dpr — multiplying by it puts
     * the click in device pixels, a factor of two out on a retina screen. That
     * trap is silent: the click still lands on a real target, just the wrong one.
     *
     * THE TWO FACTORS ARE COMPUTED SEPARATELY, and that is not tidiness. The
     * element is `width: 100%` with its height pinned in px by `resize`, so a
     * host that has been widened but not yet repainted — the ResizeObserver in
     * widget.js debounces by 60ms — is showing the last frame stretched in x and
     * not at all in y. One shared factor would be right only when nothing has
     * moved; two are right always.
     */
    pointAt(ev) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: (ev.clientX - r.left) * (w / r.width),
        y: (ev.clientY - r.top) * (h / r.height),
      };
    },
  };
}

/**
 * The region under a point, or null. LAST MATCH WINS, which is the z-order the
 * figure already has: regions are declared in drawing order, so something drawn
 * over a cell claims the click the same way it claims the pixels.
 *
 * Pure and DOM-free on purpose. The arithmetic is the one part of a canvas click
 * that no pixel hash can see, so it is the part that gets an assertion in
 * `npm run check` instead.
 */
export function hitTest(regions, x, y) {
  let found = null;
  for (const r of regions) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) found = r;
  }
  return found;
}

/* --- scales & ticks ------------------------------------------------------ */

/** Ticks at 1/2/5 x 10^k inside [min, max]. */
export function niceTicks(min, max, target = 5) {
  const span = (max - min) || 1;
  const rough = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const eps = step * 1e-9;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + eps; v += step) {
    out.push(Math.abs(v) < eps ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

/** Tick labels sharing one decimal count, so the axis reads as a column. */
export function tickFormat(ticks) {
  const decimals = ticks.reduce((acc, t) => {
    const s = String(t);
    const dot = s.indexOf(".");
    return Math.max(acc, dot < 0 ? 0 : s.length - dot - 1);
  }, 0);
  return (t) => t.toFixed(Math.min(decimals, 3));
}

/* --- the plot region ---------------------------------------------------- */

/**
 * A rectangular plot area with scales and draw methods.
 * `rect` is the PLOT AREA in CSS pixels — margins are the caller's business,
 * which keeps multi-panel figures honest about their own layout.
 */
export function makePlot({ ctx, colors, rect, xDomain, yDomain }) {
  const { x, y, w, h } = rect;
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;

  const sx = (v) => x + ((v - x0) / (x1 - x0 || 1)) * w;
  const sy = (v) => y + h - ((v - y0) / (y1 - y0 || 1)) * h;

  /* Where this panel's caption ended, so a note can tell whether it fits beside
     it. -Infinity until one is drawn: a note with no caption above it has the
     whole line, and a panel that draws its note FIRST gets today's behaviour
     rather than a wrong guess. */
  let captionRight = -Infinity;

  const api = {
    ctx, colors, sx, sy, x, y, w, h, xDomain, yDomain,
    bottom: y + h,

    /** Horizontal hairline gridlines. Recessive, solid, never dashed. */
    grid(ticks) {
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (const t of ticks) {
        const py = Math.round(sy(t)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
      }
      ctx.restore();
      return api;
    },

    /** Baseline plus tick labels below it. */
    axisX({ ticks, format, label } = {}) {
      const ts = ticks ?? niceTicks(x0, x1, Math.max(3, Math.round(w / 90)));
      const fmt = format ?? tickFormat(ts);
      ctx.save();
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      const by = Math.round(y + h) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + w, by);
      ctx.stroke();

      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const t of ts) {
        if (t < x0 - 1e-9 || t > x1 + 1e-9) continue;
        ctx.fillText(fmt(t), sx(t), y + h + 6);
      }
      if (label) {
        ctx.fillStyle = colors.ink2;
        ctx.font = `${colors.fsSm} ${colors.font}`;
        ctx.fillText(label, x + w / 2, y + h + 22);
      }
      ctx.restore();
      return api;
    },

    /** Tick labels to the left of the plot area. */
    axisY({ ticks, format, label } = {}) {
      const ts = ticks ?? niceTicks(y0, y1, 4);
      const fmt = format ?? tickFormat(ts);
      ctx.save();
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const t of ts) {
        if (t < y0 - 1e-9 || t > y1 + 1e-9) continue;
        ctx.fillText(fmt(t), x - 8, sy(t));
      }
      if (label) {
        ctx.save();
        ctx.translate(x - 40, y + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = colors.ink2;
        ctx.font = `${colors.fsSm} ${colors.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
      ctx.restore();
      return api;
    },

    /**
     * Histogram / column bars from a counts array over equal-width bins.
     * Bars are capped at 24px, carry a 4px rounded cap, sit square on the
     * baseline, and are separated by a 2px gap in the surface colour.
     */
    bars(counts, { lo, width, fill, opacity = 1 }) {
      const band = Math.abs(sx(lo + width) - sx(lo));
      const bw = Math.max(1, Math.min(BAR_MAX, band - SURFACE_GAP));
      const inset = (band - bw) / 2;
      const base = sy(Math.max(0, y0));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill;
      for (let i = 0; i < counts.length; i += 1) {
        const c = counts[i];
        if (!c) continue;
        const bx = sx(lo + i * width) + inset;
        const top = sy(c);
        barPath(ctx, bx, top, bw, base, Math.min(BAR_RADIUS, bw / 2));
        ctx.fill();
      }
      ctx.restore();
      return api;
    },

    /**
     * Spikes at named x positions — the shape a discrete distribution actually
     * has. Takes [[x, height], ...] rather than a counts array over equal-width
     * bins, because a point mass belongs at its own value and nowhere else;
     * expressing "0 and 1" as a binned array invites exactly the off-by-one that
     * silently parks the second spike at x = 2.
     */
    spikes(points, { fill, opacity = 1, width = 14 }) {
      const base = sy(Math.max(0, y0));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill;
      for (const [vx, vy] of points) {
        if (vx < x0 || vx > x1) continue;
        const px = sx(vx);
        barPath(ctx, px - width / 2, sy(vy), width, base, Math.min(BAR_RADIUS, width / 2));
        ctx.fill();
      }
      ctx.restore();
      return api;
    },

    /**
     * Stacked dot columns — one dot per observation, sitting at integer counts
     * on the y-scale. The honest way to show a small number of observations:
     * a single arrival is a visible dot, where a single bar would be two pixels
     * tall. Switch to bars() once the dots stop being countable.
     */
    dotColumns(counts, { lo, width, fill, opacity = 1, maxR = 4.5, cap = 400 }) {
      const band = Math.abs(sx(lo + width) - sx(lo));
      const pitch = Math.abs(sy(0) - sy(1));
      const r = Math.max(1.5, Math.min(maxR, band * 0.42, pitch * 0.42));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < counts.length; i += 1) {
        const cx = sx(lo + (i + 0.5) * width);
        const top = Math.min(counts[i], cap);
        for (let k = 1; k <= top; k += 1) {
          ctx.beginPath();
          ctx.arc(cx, sy(k - 0.5), r, 0, Math.PI * 2);
          ctx.fill();
          // The surface ring only helps once the dots are big enough to touch.
          if (r > 3) ctx.stroke();
        }
      }
      ctx.restore();
      return api;
    },

    /** 2px polyline through [x, y] pairs. */
    curve(points, { stroke, width = LINE_W, dash = null, opacity = 1 } = {}) {
      if (points.length < 2) return api;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(sx(points[0][0]), sy(points[0][1]));
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(sx(points[i][0]), sy(points[i][1]));
      }
      ctx.stroke();
      ctx.restore();
      return api;
    },

    /** Area wash under a curve: the series hue at ~10%, never a solid block. */
    area(points, { fill, opacity = 0.1 } = {}) {
      if (points.length < 2) return api;
      const base = sy(Math.max(0, y0));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(sx(points[0][0]), base);
      for (const [px, py] of points) ctx.lineTo(sx(px), sy(py));
      ctx.lineTo(sx(points[points.length - 1][0]), base);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return api;
    },

    /** Vertical reference line with an optional label at the top. */
    /* `labelDy` drops a label a row down the line. Two reference lines close
       together otherwise print their labels on top of each other, both being
       drawn at the top of the plot — which is what happened to "x̄" and "true
       mean" in widget 4, where the estimate lands near the truth most of the
       time. Callers offset UNCONDITIONALLY rather than on a proximity test: with
       an animation running, a threshold makes labels jump between rows as the
       estimate drifts, which is worse than a constant offset. */
    vline(v, { stroke, label, width = 1, align = "left", labelDy = 0 } = {}) {
      const px = Math.round(sx(v)) + 0.5;
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = colors.ink2;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.textAlign = align === "left" ? "right" : "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, px + (align === "left" ? -4 : 4), y + 1 + labelDy);
      }
      ctx.restore();
      return api;
    },

    /** A shaded x-range, for marking a region of interest (never for data). */
    band(from, to, { fill, opacity = 0.1, label } = {}) {
      const x0 = sx(Math.max(from, xDomain[0]));
      const x1 = sx(Math.min(to, xDomain[1]));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill;
      ctx.fillRect(x0, y, x1 - x0, h);
      ctx.restore();
      if (label) {
        ctx.save();
        ctx.fillStyle = colors.ink3;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, (x0 + x1) / 2, y + h - 2);
        ctx.restore();
      }
      return api;
    },

    /** Rug of individual observations along the baseline. */
    rug(values, { stroke, height: tickH = 8, opacity = 0.75 } = {}) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      const base = y + h;
      for (const v of values) {
        if (v < x0 || v > x1) continue;
        const px = sx(v);
        ctx.beginPath();
        ctx.moveTo(px, base);
        ctx.lineTo(px, base - tickH);
        ctx.stroke();
      }
      ctx.restore();
      return api;
    },

    /** Marker with a 2px surface ring so it stays legible where marks cross. */
    dot(vx, vy, { fill, r = 4.5 } = {}) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx(vx), sy(vy), r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.surface;
      ctx.stroke();
      ctx.restore();
      return api;
    },

    /** Small panel caption in secondary ink, above the plot area. */
    caption(text) {
      ctx.save();
      ctx.font = `600 ${colors.fsSm} ${colors.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      // A surface halo keeps the caption readable where a figure-spanning rule
      // passes behind it.
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(text, x, y - 8);
      ctx.fillStyle = colors.ink2;
      ctx.fillText(text, x, y - 8);
      // Where this line ends, so note() can find out whether it has room.
      captionRight = x + ctx.measureText(text).width;
      ctx.restore();
      return api;
    },

    /**
     * A short right-aligned note on the caption's own baseline — the place a
     * panel says what its own heights add up to.
     *
     * Widget 8 wrote this locally and left a comment saying one consumer does
     * not decide a seam; widget 9 is the second, and it wants the identical
     * mark for the identical job (a panel stating its own total). `inside`
     * drops it just below the top edge instead, for a panel whose caption line
     * is already spoken for. The surface halo is what keeps it legible where a
     * spanning rule or a curve passes behind it.
     *
     * AND IT DROPS INSIDE BY ITSELF WHEN THE LINE IS FULL, because sharing a
     * baseline with the caption is an assumption about width that nothing was
     * checking. The fingerprint harness renders every widget in a 900px frame,
     * which is 20px above the 880px breakpoint where the side layout stacks —
     * so every baseline is recorded at the NARROWEST canvas that layout ever
     * produces, 550px. Measured there, 10 of the 32 settled states had a
     * caption and its note printing through each other, by up to 123px. The
     * halo is what hid it: a note strokes surface-coloured before it fills, so
     * a collision ERASES the caption underneath rather than blending, and the
     * result still looks like a caption — a short one — and still hashes
     * consistently for ever.
     *
     * `inside` is the fallback rather than a new position because it is the
     * one this already had, for exactly this reason: a panel whose caption line
     * is spoken for. A full line is a caption line that is spoken for.
     */
    note(text, { tone, inside = false } = {}) {
      ctx.save();
      ctx.font = `${colors.fsXs} ${colors.font}`;
      /* 14px of clear air, or the two read as one wrapped sentence. Measured
         against the caption's own right edge rather than a guess at how long a
         caption is allowed to be — the caller knows neither the font nor the
         width it ended up with. */
      const drop = inside || x + w - ctx.measureText(text).width < captionRight + 14;
      ctx.textAlign = "right";
      ctx.textBaseline = drop ? "top" : "alphabetic";
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      const px = x + w - (drop ? 3 : 0);
      const py = drop ? y + 3 : y - 8;
      ctx.strokeText(text, px, py);
      ctx.fillStyle = tone ?? colors.ink2;
      ctx.fillText(text, px, py);
      ctx.restore();
      return api;
    },
  };

  return api;
}

/**
 * A reference rule spanning several stacked panels, drawn in figure coordinates
 * rather than inside one plot area.
 *
 * Two panels showing the same quantity on different scales should share ONE
 * reference line, not carry a line each. A single rule from the top of the first
 * panel to the bottom of the last says "this value, all the way down" in a way
 * two aligned-but-separate lines never quite do — and it only costs one label
 * instead of one per panel.
 *
 * Draw this before the panel contents so marks and captions sit over it.
 */
/**
 * One vertical rule carried across stacked panels.
 *
 * `width` and `dash` default to the hairline solid form widget 3 uses for the
 * true mean — a quiet reference behind the data. Widget 7 needs the opposite
 * weight from the same primitive: its rule is a DECISION BOUNDARY, the most
 * important mark in the figure, and a 1px grey line is exactly the thing
 * prd §3 says fails from the back of a lecture theatre. Optional, so nothing
 * that already calls this changes.
 */
export function spanningRule(ctx, colors, { x, y0, y1, label, stroke, width = 1, dash = null }) {
  // Half-pixel only for odd widths, which is where it actually sharpens.
  const px = width % 2 ? Math.round(x) + 0.5 : Math.round(x);
  ctx.save();
  ctx.strokeStyle = stroke ?? colors.reference;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(px, y0);
  ctx.lineTo(px, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(label, px - 4, y0 + 1);
  }
  ctx.restore();
}

/** Bar with a rounded data-end and square corners on the baseline. */
function barPath(ctx, bx, top, bw, base, r) {
  const height = base - top;
  const rr = Math.max(0, Math.min(r, bw / 2, Math.abs(height)));
  ctx.beginPath();
  ctx.moveTo(bx, base);
  ctx.lineTo(bx, top + rr);
  ctx.arcTo(bx, top, bx + rr, top, rr);
  ctx.lineTo(bx + bw - rr, top);
  ctx.arcTo(bx + bw, top, bx + bw, top + rr, rr);
  ctx.lineTo(bx + bw, base);
  ctx.closePath();
}

/** Sample a density function across the plot's x-domain. */
export function samplePdf(pdf, [lo, hi], steps = 240) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const v = lo + ((hi - lo) * i) / steps;
    pts.push([v, pdf(v)]);
  }
  return pts;
}
