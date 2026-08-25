/* Canvas text sweep over widget 18's parameter space. Nothing here ships.
 *
 * Same trick as `svm-sweep.js`, and for the same reason: the repaint is forced
 * by DRIVING A CONTROL. Resizing the iframe does not work — a ResizeObserver
 * callback is delivered as part of the rendering lifecycle and this browser
 * suspends that for an offscreen iframe, so the sweep records an empty list and
 * then reports no overruns from it, which looks exactly like a clean pass.
 *
 * This widget adds one thing widget 16 did not have: an ANIMATION. A settled
 * state shows the plan finished; the sweep also samples it part-built, because
 * the counts, the boundary and the readout all move with `shown` and a caption
 * that fits at step 0 need not fit at step 180.
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
  for (let keep = 0; keep < 5; keep += 1) {
    for (const stage of ["cohort", "fit", "balance"]) {
      const methods = stage === "balance"
        ? ["none", "weights", "over", "under", "smote"] : ["none"];
      for (const method of methods) {
        for (const shown of [0, 7, 400]) {
          if (method === "smote") {
            for (let k = 0; k < 3; k += 1) states.push({ keep, stage, method, k, shown });
          } else {
            states.push({ keep, stage, method, shown });
          }
        }
      }
    }
  }

  let done = 0;
  for (const st of states) {
    const q = (shown) => `?theme=light&keep=${st.keep}`
      + `&fit=${st.stage === "cohort" ? 0 : 1}&balance=${st.stage === "balance" ? 1 : 0}`
      + `&method=${st.method}`
      + (st.k === undefined ? "" : `&k=${st.k}`)
      + `&shown=${shown}`;
    done += 1;
    onProgress?.(done, states.length, q(st.shown).replace("?theme=light&", ""));

    /* Loaded one rung away on `keep`, then moved onto the target: exactly one
       paint, at exactly the state wanted, inside the event handler.

       DRIVEN THROUGH `keep`, because it is the only control present at every
       state — the gates reveal the others. An earlier version drove `share`,
       which the first step does not have, and twelve states reported "no share
       control" and FAILED rather than passing quietly. That is the rule
       working; a repaint driver has to be a control that always exists. */
    const away = st.keep === 0 ? 1 : st.keep - 1;
    f.src = `/widgets/balancing-data/${q(st.shown).replace(`keep=${st.keep}`, `keep=${away}`)}`;
    await new Promise((r) => f.addEventListener("load", r, { once: true }));
    await wait(120);
    const win = f.contentWindow, doc = f.contentDocument;
    const cv = doc.querySelector(".w-figure canvas");
    const slider = doc.querySelector('[data-param="keep"]');
    if (!cv || !slider) {
      out.push({ at: q(st.shown), err: cv ? "no keep control" : "no canvas" });
      continue;
    }

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
    /* Driven twice, and the second is the one timed and recorded: a first paint
       on a fresh page in a deprioritised iframe has been 300x the warm number.
       The buffer is cleared between them, because two paints recorded together
       report collisions between strings never on screen at the same time. */
    slider.value = String(away);
    slider.dispatchEvent(new win.Event("input", { bubbles: true }));
    seen.length = 0;
    const t0 = win.performance.now();
    slider.value = String(st.keep);
    slider.dispatchEvent(new win.Event("input", { bubbles: true }));
    const ms = win.performance.now() - t0;
    PR.fillText = orig;

    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    const W = cv.width / dpr, H = cv.height / dpr;
    if (seen.length === 0 || W < 300 || !doc.querySelector(".w-readout")?.textContent.trim()) {
      out.push({ at: q(st.shown), err: `painted nothing (canvas ${W}x${H}, ${seen.length} strings)` });
      continue;
    }
    const bad = seen.filter((t) =>
      !t.rot && (t.left < -1 || t.right > W + 1 || t.y < -2 || t.y > H + 16));
    const nan = seen.filter((t) => /NaN|Infinity|undefined|null/.test(t.s));

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
      at: q(st.shown), n: seen.length, W, H, hits, rd, ms: Math.round(ms),
      bad: bad.map((t) => `${t.s} [${Math.round(t.left)}..${Math.round(t.right)}] y=${Math.round(t.y)}`),
      nan: nan.map((t) => t.s),
      strings: uniq.map((t) => t.s),
    });
  }
  f.remove();
  return out;
};
