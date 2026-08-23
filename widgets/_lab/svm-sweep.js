/* Canvas text sweep over widget 16's whole parameter space. Nothing here ships.
 *
 * TWO WAYS OF FORCING THE REPAINT FAILED FIRST, and both failed SILENTLY —
 * every state recorded zero strings, and the sweep then reported no overruns
 * and no NaNs from an empty list. It looked exactly like a clean pass.
 *
 *   1. Dispatching `resize` on the iframe's window. Core does not listen to
 *      that; it listens to a ResizeObserver on `.w-figure`.
 *   2. Changing the iframe's width for real. The document DOES reflow —
 *      `.w-figure` measured 550 -> 666 -> 550 — but the canvas stayed 1100
 *      backing pixels throughout, because a ResizeObserver callback is
 *      delivered as part of the rendering lifecycle, and this browser suspends
 *      that for an offscreen iframe. Nothing after the initial synchronous
 *      paint ever runs.
 *
 * Driving a CONTROL works, because `setParam -> recompute -> paint` is all
 * synchronous inside the event handler and never waits for a frame. So every
 * state is loaded with C one rung away from where it is wanted, and the last
 * thing done is to move C onto it — exactly one paint, at the exact state.
 */
window.__sweep = async function (frameW) {
  const out = [];
  const LAD = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const f = document.createElement("iframe");
  f.width = frameW;
  f.height = 1400;
  f.style.cssText = "position:fixed;left:-9999px;top:0;border:0";
  document.body.appendChild(f);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const data of ["crc", "hf"]) {
    for (const C of LAD) {
      for (const only of [0, 1]) {
        for (const compare of [0, 1]) {
          const from = C === 0 ? 1 : C - 1;
          const q = `?theme=light&data=${data}&C=${from}${only ? "&only=true" : ""}${compare ? "&compare=true" : ""}`;
          f.src = `/widgets/support-vector-machine/${q}`;
          await new Promise((r) => f.addEventListener("load", r, { once: true }));
          await wait(160);
          const win = f.contentWindow, doc = f.contentDocument;
          const cv = doc.querySelector(".w-figure canvas");
          const slider = doc.querySelector('[data-param="C"]');
          if (!cv || !slider) { out.push({ q, err: cv ? "no C control" : "no canvas" }); continue; }

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
          slider.value = String(C);
          slider.dispatchEvent(new win.Event("input", { bubbles: true }));
          PR.fillText = orig;

          const dpr = Math.min(win.devicePixelRatio || 1, 2);
          const W = cv.width / dpr, H = cv.height / dpr;
          const at = `?theme=light&data=${data}&C=${C}${only ? "&only=true" : ""}${compare ? "&compare=true" : ""}`;
          const bad = seen.filter((t) =>
            !t.rot && (t.left < -1 || t.right > W + 1 || t.y < -2 || t.y > H + 16));
          const nan = seen.filter((t) => /NaN|Infinity|undefined|null/.test(t.s));

          /* Two strings on one baseline whose x-ranges overlap. caption() and
             note() stroke surface-coloured before they fill, so a collision
             ERASES what it overruns rather than blending — it still looks like
             a caption, a short one, and it hashes consistently for ever. */
          const uniq = [...new Map(seen.map((t) =>
            [`${t.s}|${Math.round(t.left)}|${Math.round(t.y)}`, t])).values()];
          const hits = [];
          for (let i = 0; i < uniq.length; i += 1) {
            for (let j = i + 1; j < uniq.length; j += 1) {
              const a = uniq[i], b = uniq[j];
              if (a.rot || b.rot || Math.abs(a.y - b.y) > 5) continue;
              const ov = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              if (ov > 1) hits.push(`"${a.s}" x "${b.s}" by ${Math.round(ov)}px at y=${Math.round(a.y)}`);
            }
          }
          const rd = [...doc.querySelectorAll(".w-readout")]
            .map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
          out.push({
            at, n: seen.length, W, H, hits, rd,
            bad: bad.map((t) => `${t.s} [${Math.round(t.left)}..${Math.round(t.right)}] y=${Math.round(t.y)}`),
            nan: nan.map((t) => t.s),
            strings: uniq.map((t) => t.s),
          });
        }
      }
    }
  }
  f.remove();
  return out;
};
