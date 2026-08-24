/* Canvas text sweep over widget 16's parameter space. Nothing here ships.
 *
 * THE REPAINT IS FORCED BY DRIVING A CONTROL, and that is the whole trick.
 * Two other ways failed, both SILENTLY — every state recorded zero strings and
 * the sweep then reported no overruns and no NaNs from an empty list, which
 * looks exactly like a clean pass:
 *
 *   1. Dispatching `resize` on the iframe's window. Core does not listen to
 *      that; it listens to a ResizeObserver on `.w-figure`.
 *   2. Changing the iframe's width for real. The document DOES reflow —
 *      `.w-figure` measured 550 -> 666 -> 550 — but the canvas stayed at 1100
 *      backing pixels throughout, because a ResizeObserver callback is
 *      delivered as part of the rendering lifecycle and this browser suspends
 *      that for an offscreen iframe. Nothing after the initial synchronous
 *      paint ever runs.
 *
 * `setParam -> recompute -> paint` is synchronous inside the event handler, so
 * every state is loaded with C one rung away and then moved onto it: exactly
 * one paint, at exactly the state wanted.
 */
window.__sweep = async function (frameW, onProgress) {
  const out = [];
  const f = document.createElement("iframe");
  f.width = frameW;
  f.height = 1600;
  f.style.cssText = "position:fixed;left:-9999px;top:0;border:0";
  document.body.appendChild(f);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const states = [];
  for (const data of ["blobs", "rings", "moons"]) {
    for (let C = 0; C < 5; C += 1) {
      states.push({ data, kernel: "linear", C, marks: true });
      for (let gamma = 0; gamma < 6; gamma += 1) states.push({ data, kernel: "rbf", C, gamma, marks: true });
      for (let degree = 0; degree < 3; degree += 1) states.push({ data, kernel: "poly", C, degree, marks: true });
      /* The lifted view carries less text than the input one and all of it is
         fixed, so it is sampled rather than swept: one per kernel per rung. */
      states.push({ data, kernel: "linear", C, marks: true, lift: "kernel" });
      states.push({ data, kernel: "rbf", C, gamma: 2, marks: true, lift: "kernel" });
      states.push({ data, kernel: "poly", C, degree: 1, marks: true, lift: "kernel" });
    }
    states.push({ data, kernel: "linear", C: 2, marks: false });
    states.push({ data, kernel: "rbf", C: 2, gamma: 2, marks: false });
  }

  let done = 0;
  for (const st of states) {
    const q = (c) => `?theme=light&data=${st.data}&kernel=${st.kernel}&C=${c}`
      + (st.gamma === undefined ? "" : `&gamma=${st.gamma}`)
      + (st.degree === undefined ? "" : `&degree=${st.degree}`)
      + (st.lift ? `&lift=${st.lift}` : "")
      + (st.marks ? "" : "&marks=false");
    done += 1;
    onProgress?.(done, states.length, q(st.C).replace("?theme=light&", ""));
    f.src = `/widgets/support-vector-machine/${q(st.C === 0 ? 1 : st.C - 1)}`;
    await new Promise((r) => f.addEventListener("load", r, { once: true }));
    await wait(140);
    const win = f.contentWindow, doc = f.contentDocument;
    const cv = doc.querySelector(".w-figure canvas");
    const slider = doc.querySelector('[data-param="C"]');
    if (!cv || !slider) { out.push({ at: q(st.C), err: cv ? "no C control" : "no canvas" }); continue; }

    const seen = [];
    const PR = win.CanvasRenderingContext2D.prototype;
    const orig = PR.fillText;
    PR.fillText = function (s, x, y) {
      const wdt = this.measureText(String(s)).width;
      const left = this.textAlign === "center" ? x - wdt / 2
        : this.textAlign === "right" ? x - wdt : x;
      const t = this.getTransform ? this.getTransform() : null;
      seen.push({ s: String(s), left, right: left + wdt, y, rot: t ? Math.abs(t.b) > 0.5 : false });
      return orig.apply(this, arguments);
    };
    /* DRIVEN TWICE, AND THE SECOND ONE IS THE ONE TIMED AND RECORDED. The first
       repaint on a freshly loaded page is cold-JIT and, in an offscreen iframe
       the browser has deprioritised, wildly so — one state reported 22 SECONDS
       where the same state warm is 54-138 ms and the whole compute path in node
       is 70. A number that wrong invites exactly the wrong conclusion, so the
       harness measures a warm repaint or it does not measure one.

       The buffer is cleared between the two, because two sets are two paints
       and recording both reports collisions between strings that were never on
       screen together. */
    slider.value = String(st.C === 0 ? 2 : 0);
    slider.dispatchEvent(new win.Event("input", { bubbles: true }));
    seen.length = 0;
    const t0 = win.performance.now();
    slider.value = String(st.C);
    slider.dispatchEvent(new win.Event("input", { bubbles: true }));
    const ms = win.performance.now() - t0;
    PR.fillText = orig;

    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    const W = cv.width / dpr, H = cv.height / dpr;
    /* A STATE THAT PAINTED NOTHING IS A FAILURE, NOT A PASS. A widget that
       throws inside render() leaves its canvas at the default 150x75 and its
       readout empty, and a sweep that only counts overruns then reports a clean
       run over an empty list. That is exactly how a temporal-dead-zone bug in
       the solver — every solve throwing, on every state — read as "the harness
       settled too early" for a whole round. */
    if (seen.length === 0 || W < 300 || !doc.querySelector(".w-readout")?.textContent.trim()) {
      out.push({ at: q(st.C), err: `painted nothing (canvas ${W}x${H}, ${seen.length} strings)` });
      continue;
    }
    const bad = seen.filter((t) =>
      !t.rot && (t.left < -1 || t.right > W + 1 || t.y < -2 || t.y > H + 16));
    const nan = seen.filter((t) => /NaN|Infinity|undefined|null/.test(t.s));

    /* Two strings on one baseline whose x-ranges overlap. caption() and note()
       stroke surface-coloured before they fill, so a collision ERASES what it
       overruns rather than blending — it still looks like a short caption and
       hashes consistently for ever. */
    const uniq = [...new Map(seen.map((t) =>
      [`${t.s}|${Math.round(t.left)}|${Math.round(t.y)}`, t])).values()];
    const hits = [];
    for (let i = 0; i < uniq.length; i += 1) {
      for (let j = i + 1; j < uniq.length; j += 1) {
        const a = uniq[i], b = uniq[j];
        if (a.rot || b.rot || Math.abs(a.y - b.y) > 5) continue;
        const ov = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        if (ov > 1) hits.push(`"${a.s}" x "${b.s}" by ${Math.round(ov)}px`);
      }
    }
    const rd = [...doc.querySelectorAll(".w-readout")]
      .map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
    out.push({
      at: q(st.C), n: seen.length, W, H, hits, rd, ms: Math.round(ms),
      bad: bad.map((t) => `${t.s} [${Math.round(t.left)}..${Math.round(t.right)}] y=${Math.round(t.y)}`),
      nan: nan.map((t) => t.s),
      strings: uniq.map((t) => t.s),
    });
  }
  f.remove();
  return out;
};
