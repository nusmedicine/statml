/* Mid-flight drive sweep for widget 18. Nothing here ships.
 *
 * THE TEXT SWEEP CANNOT SEE THIS, and one bug proved it. Every state in
 * `balancing-sweep.js` is settled — reached through `shown`, with the animation
 * at rest — so nothing there ever runs `drawInFlight`. A random copy carries a
 * `parent` and no `neighbour`, and the slow-motion branch read
 * `state.pts[undefined].x1` and threw on every frame. Only under Oversample,
 * only in slow motion, and only on two of the three pages: 348 settled states
 * passed clean while the widget was throwing.
 *
 * So this harness drives instead. It replaces `requestAnimationFrame` with a
 * queue and pumps it by hand, which is also the only way to drive anything in a
 * Browser pane that is not being displayed — there, rAF does not fire at all,
 * and an animation simply never advances with no error to say so.
 */
window.__drive = async function (frameW, onProgress) {
  const out = [];
  const f = document.createElement("iframe");
  f.width = frameW;
  f.height = 1600;
  f.style.cssText = "position:fixed;left:-9999px;top:0;border:0";
  document.body.appendChild(f);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const states = [];
  /* Only the balancing step has anything to drive, which is the point of the
     `inert` contract — but the earlier steps are driven too, to prove the
     buttons really are gone rather than merely quiet. */
  for (const stage of ["fit", "balance"]) {
    for (const method of ["none", "weights", "over", "under", "smote"]) {
      for (const keep of [1, 4]) {
        /* `pace` is swept because it decides what `drawInFlight` DRAWS, not just
           how long a unit takes: the quick rung skips the neighbour fan
           entirely, so it is a different code path mid-frame. */
        for (const pace of [0, 2]) {
        for (const key of ["step", "run"]) {
          /* Frame counts chosen to land INSIDE a unit and then past several of
             them: one beat, mid-slide, and well into the plan. dt is 64 because
             that is core's own MAX_FRAME_MS clamp. */
          for (const frames of [1, 8, 40]) {
            states.push({ stage, method, keep, pace, key, frames });
          }
        }
        }
      }
    }
  }

  let done = 0;
  for (const st of states) {
    const q = `?theme=light&keep=${st.keep}&fit=1`
      + `&balance=${st.stage === "balance" ? 1 : 0}&method=${st.method}`
      + (st.method === "smote" ? "&k=2" : "")
      + `&pace=${st.pace}`;
    done += 1;
    onProgress?.(done, states.length, `${q.slice(14)} ${st.key}x${st.frames}`);

    f.src = `/widgets/balancing-data/${q}`;
    await new Promise((r) => f.addEventListener("load", r, { once: true }));
    await wait(90);
    const win = f.contentWindow, doc = f.contentDocument;

    /* Errors thrown inside a rAF callback do not reject anything and do not
       reach this frame, so they are collected off the iframe's own window.
       Without this the harness reports a clean pass over a widget that is
       throwing on every frame — which is exactly what happened. */
    const errs = [];
    win.addEventListener("error", (e) => errs.push(String(e.message)));
    const oldErr = win.console.error;
    win.console.error = (...a) => { errs.push(a.map(String).join(" ")); oldErr.apply(win.console, a); };

    const cv = doc.querySelector(".w-figure canvas");

    /* PROGRESS IS MEASURED IN THE PAINTED STRINGS, not in pixels.
       Two pixel-based attempts both PASSED FOR THE WRONG REASON before this one
       worked, which is worth more than the check itself:

         - a sparse hash (stride 397) read about one pixel in a hundred and
           missed a single highlight ring, calling a drawing state frozen
         - a dense hash never matched at all, because the LOAD PAINT is not the
           same picture as any repaint. Measured at an identical state:
           clt 41,734 of 1,471,968 bytes differ, bootstrap 39,244 of 1,846,800,
           galton-board 17,498 of 1,778,400, balancing-data 201,825 of 2,172,384
           — and every repaint after the first is byte-identical, 0 and 0. So it
           is a property of the collection, not of one widget. Even warmed, the
           comparison stayed unreliable enough to report zero freezes in a run
           where freezes were known to exist.

       The strings do not have that problem: they are byte-identical across
       repaints, and the count strip prints the majority and minority counts, so
       "did the plan advance" is answered exactly. Captured through fillText, the
       same instrument the text sweep uses. */
    /* ONE STRING-SET PER FRAME, collected while the frames are pumped. An
       earlier version re-rendered through the `share` control to sample the
       strings — which RESETS the animation, because share is a data parameter,
       so it compared a freshly reset figure with itself and would have called
       every state frozen. Nothing here forces a repaint: each pumped callback
       already paints exactly once. */
    const PR = win.CanvasRenderingContext2D.prototype;
    const origText = PR.fillText;
    let frameStrings = [];
    let current = null;

    const queue = [];
    win.requestAnimationFrame = (cb) => queue.push(cb);
    const b = doc.querySelector(`.w-drive .w-btn[data-key="${st.key}"]`);
    if (!b) { out.push({ at: q, err: `no "${st.key}" button` }); continue; }
    /* HIDDEN COUNTS AS UNAVAILABLE, NOT AS BROKEN. Core removes Step and Play
       wherever the widget sets `anim.inert`, and `hidden` is how it does it —
       reading only `disabled` reported every Play button as live, including the
       ones that are not on screen at all. `b.click()` still fires the handler on
       a hidden button, so the harness cannot tell the difference by clicking. */
    const wasDisabled = b.disabled || b.hidden;
    /* Nothing to drive: below the balancing step there is no balancing, and None
       and Class weights have an empty plan by contract. Nothing moving under
       either is correct rather than broken. */
    const noPlan = st.stage !== "balance" || st.method === "none" || st.method === "weights";

    PR.fillText = function (str, x, y) {
      if (current) current.push(`${str}@${Math.round(x)},${Math.round(y)}`);
      return origText.apply(this, arguments);
    };
    b.click();
    let t = 0, frames = 0;
    for (let i2 = 0; i2 < st.frames; i2 += 1) {
      const cb = queue.shift();
      if (!cb) break;
      t += 64;
      frames += 1;
      current = [];
      try { cb(t); } catch (e) { errs.push("threw: " + e.message); break; }
      frameStrings.push(current.join("|"));
      current = null;
    }
    PR.fillText = origText;

    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    const W = cv ? cv.width / dpr : 0;
    const rd = doc.querySelector(".w-readout")?.textContent.replace(/\s+/g, " ").trim() ?? "";
    /* Only asserted where progress is GUARANTEED: Play, forty frames, a method
       that has a plan. One frame of a slow step legitimately changes no count. */
    const mustMove = st.key === "run" && st.frames === 40 && !noPlan && !wasDisabled;
    out.push({
      at: `${q} ${st.key}x${st.frames}`, errs, W, rd: rd.slice(0, 80),
      disabled: wasDisabled, frames,
      stuck: mustMove && frameStrings.length > 1
        && frameStrings[0] === frameStrings[frameStrings.length - 1],
      nan: /NaN|undefined|Infinity/.test(rd),
    });
  }
  f.remove();
  return out;
};
