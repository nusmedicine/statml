/* Widget-level measurement for slot 72 `signal-windows` (PHM5005 07-2 cells
 * 1–21: Segmentation & Label Alignment, Dataset Preparation, `normalize`),
 * on `widgets/signal-cnn-lstm/engine.js`.  The arc measurement's M5 (in
 * `dl-seq-measure.mjs`) settled the claim — 1-NN on eight subjects' windows
 * scores 79.5% under a window-level split and 33.3% under a subject-level one
 * — on a stage whose class was an irregular rhythm.  This script builds the
 * widget's own stage and asks the questions a page needs answered:
 *
 *   W1 THE STAGE — S subjects, each a long recording in its own morphology
 *      (rate, amplitude, QRS width, T wave, wander); windowed at a length and
 *      an overlap.  Does M5's gap reproduce here, and how does it depend on
 *      the number of subjects?  Held-out accuracy of a nearest neighbour on
 *      the window's log power spectrum, window-level against subject-level.
 *   W2 TWO LABEL SOURCES (his figure, cell 4) — a RECORDING annotation (the
 *      subject's class, inherited by every window) against EVENT annotations
 *      (ectopic beats, each an interval; a window is labelled by overlap).
 *      Under each, both splits, a nearest neighbour and 73's CNN at half
 *      width trained on the windows.  The claim to test: with a recording
 *      label a model can learn the SUBJECT and the subject-level split says
 *      so; with an event label it can learn the EVENT and the subject-level
 *      split holds up.
 *   W3 OVERLAP — 0 / 50 / 75 % under the window-level split: does the leak
 *      grow with the overlap, or is it the subject's morphology regardless?
 *   W4 NORMALISATION — the CNN on raw against per-window z-scored windows:
 *      is the between-subject amplitude a fingerprint the split can exploit?
 *   W5 BUDGET — ms for one CNN training on the windows, at L = 360 and 720,
 *      so compute() knows whether the Split page can train on the click.
 *   W6 LABEL BY OVERLAP — how many windows one event is labelled onto under
 *      "any overlap" and "more than half", per window length and overlap.
 *
 * Run:  node widgets/_lab/signal-windows-measure.mjs   (129 s, node v24, this
 * machine; nothing in the repo imports this file — the mock carries its own
 * copy of the stage)
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-20.  The nearest-neighbour numbers are one deal each and
 * the subject-level ones a mean over folds of two subjects, so read gaps of
 * ten points and more; the CNN's move with its seed by up to thirty.
 *
 * W1/W3/W7 — THE RHYTHM CLASS IS THE LEAK, WHOLE.  With the class a recording
 *   annotation (regular against irregular rhythm) a nearest neighbour on the
 *   window's spectrum scores 59 → 69–78 → 87–95% under a window-level split
 *   as the overlap goes 0 → 50 → 75% (S = 8–12, L = 360), and 46–52% under a
 *   subject-level one at every overlap: the class is not learnable from a
 *   window, and the window-level number is the subject.  At L = 720 the same
 *   sweep reads 75 → 87 → 98% against 51–56%.
 * W9 — NO WINDOW LENGTH CHANGES THAT: 1, 2, 4 and 8 s windows give 48–65%
 *   subject-level at jitter 0.3 and 0.5, while the window-level number reaches
 *   100% at 8 s with the nearest window the same subject 100% of the time.
 *   73's CNN cannot learn the rhythm either (30–46% subject-level).
 * W2/W7 — ECTOPIC BEATS AS THE CLASS ARE LEARNABLE AND DO NOT LEAK: with an
 *   event label (any overlap or more than half) both splits read 87–98% for
 *   the nearest neighbour and 93–98% for the CNN — the beat looks alike across
 *   subjects, so the nearest window's label is right whoever it belongs to.
 *   With the RECORDING label on that stage (a subject with ectopy is 1 on
 *   every window, though only 60–66% hold a beat) 90–100% against 82–91%.
 * W8 — THE SIMILARITY RULE: correlation at the best shift finds a window of
 *   the same subject for 86% of held-out windows under the window-level split
 *   (the spectrum 55%, zero-lag correlation 26%) and gives the widest gap,
 *   93.5% against 65.7% on the recording label; only 16% of those matches are
 *   an OVERLAPPING window — the leak is the subject's morphology, not the
 *   shared samples (M5 said the same).  At half rate with a lag step of 3 it
 *   costs 0.5 s on 312 windows.
 * W4 — AMPLITUDE IS NOT A LEAK the CNN can use: on raw windows it scores
 *   51 / 39% (window / subject) against 67 / 56% z-scored — unnormalised
 *   inputs train worse, which is the lesson's reason for `normalize`.  Per-
 *   subject RMS varies with CV 15%; every z-scored window has sd 1.
 * W5 — 73's CNN trains on these windows in 0.65 s (312 windows of 360, or
 *   152 of 720; 20 epochs, half width): affordable on a click, but W2/W8 show
 *   its numbers moving 69–98% with the seed on one setting.
 * W6 — an 80-sample event is labelled onto 1.2 / 2.4 / 4.7 windows under
 *   "any overlap" and 1.0 / 2.0 / 3.9 under "more than half" at overlap
 *   0 / 50 / 75% and L = 360; at 0% overlap it lies wholly inside some window
 *   79% of the time (57% at L = 180, 89% at L = 720), at 50% always.
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => (100 * x).toFixed(1) + "%";
const f = (v, d = 2) => Number(v).toFixed(d);
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const F = (n) => new Float64Array(n);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;

/* ------------------------------------------------------------ the stage --- */
export const FS = 360;

/**
 * One subject: a morphology of their own (rate, amplitude, QRS width, T-wave
 * height, a wander) and a class.  `classBy` says what the class IS:
 *   "rhythm" — class 1 has an irregular RR interval (M5's stage);
 *   "ectopy" — class 1 has wide ectopic beats replacing a fraction `q` of
 *              beats, each an annotated EVENT of 80 samples around the beat.
 */
export function subject(rng, s, cls, classBy) {
  return {
    s, cls,
    period: 130 + Math.floor(rng.next() * 70),      // 130–200 samples, 108–166 bpm at 360 Hz
    amp: 0.6 + rng.next() * 1.0,                     // 0.6–1.6
    width: 3 + Math.floor(rng.next() * 3),           // 3–5, the R wave's half width
    tAmp: 0.1 + rng.next() * 0.25,
    tLag: 40 + Math.floor(rng.next() * 30),
    wanderF: 400 + rng.next() * 400, wanderA: 0.05 + rng.next() * 0.1, wanderP: rng.next() * 6.28,
    jitter: classBy === "rhythm" ? (cls === 1 ? 0.30 : 0.03) : 0.04,
    q: classBy === "ectopy" ? (cls === 1 ? 0.25 + rng.next() * 0.15 : 0) : 0,
  };
}

/** A recording of `T` samples for one subject; returns the trace and the event intervals. */
export function record(rng, sub, T) {
  const x = F(T), events = [];
  for (let t = Math.floor(rng.next() * sub.period); t < T;) {
    if (sub.q > 0 && rng.next() < sub.q) {
      for (let d = -40; d <= 40; d++) if (t + d >= 0 && t + d < T) x[t + d] += sub.amp * (1.3 * Math.exp(-(d * d) / (2 * 11 * 11)) - 0.35 * Math.exp(-((d - 26) ** 2) / (2 * 9 * 9)));
      events.push([Math.max(0, t - 40), Math.min(T, t + 40)]);
    } else {
      const w = sub.width;
      for (let d = -w; d <= w; d++) if (t + d >= 0 && t + d < T) x[t + d] += sub.amp * (1 - Math.abs(d) / (w + 1));
      for (let d = -w - 5; d < -w; d++) if (t + d >= 0 && t + d < T) x[t + d] -= 0.12 * sub.amp;
      for (let d = w + 1; d < w + 9; d++) if (t + d < T) x[t + d] -= 0.18 * sub.amp;
      for (let d = sub.tLag; d < sub.tLag + 50; d++) if (t + d < T) x[t + d] += sub.tAmp * sub.amp * Math.sin(Math.PI * (d - sub.tLag) / 50);
    }
    t += Math.max(60, Math.round(sub.period * (1 + sub.jitter * rng.normal())));
  }
  for (let t = 0; t < T; t++) x[t] += rng.normal(0, 0.03) + sub.wanderA * Math.sin(2 * Math.PI * t / sub.wanderF + sub.wanderP);
  return { x, events };
}

const z = (a) => { const m = mean(a), sd = Math.sqrt(mean(a.map((v) => (v - m) ** 2))) || 1; return a.map((v) => (v - m) / sd); };

/** Window every subject's recording; each window carries the subject, the recording label and the event labels. */
export function windowed(rng, subjects, { L, overlap, T }) {
  const step = Math.max(1, Math.round(L * (1 - overlap)));
  const out = [];
  for (const sub of subjects) {
    const { x, events } = record(rng, sub, T);
    for (let a = 0; a + L <= T; a += step) {
      const raw = Array.from(x.slice(a, a + L));
      let any = 0, maj = 0;
      for (const [e0, e1] of events) { const ov = Math.max(0, Math.min(a + L, e1) - Math.max(a, e0)); if (ov > 0) any = 1; if (ov > (e1 - e0) / 2) maj = 1; }
      out.push({ sub: sub.s, cls: sub.cls, start: a, raw, zed: z(raw), yRec: sub.cls, yAny: any, yMaj: maj });
    }
  }
  return { windows: out, step };
}

/* --------------------------------------------------------- classifiers --- */
const spectrum = (a) => { const n = a.length, out = new Array(n >> 1); for (let k = 1; k <= n >> 1; k++) { let re = 0, im = 0; for (let t = 0; t < n; t++) { const th = 2 * Math.PI * k * t / n; re += a[t] * Math.cos(th); im -= a[t] * Math.sin(th); } out[k - 1] = Math.log(1e-6 + re * re + im * im); } return z(out); };
const corr = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length; };
function knn(train, test, y) { let ok = 0; for (const t of test) { let best = -2, by = -1; for (const tr of train) { const c = corr(tr.spec, t.spec); if (c > best) { best = c; by = tr[y]; } } if (by === t[y]) ok++; } return ok / test.length; }

/** 73's CNN1D at half width; length-agnostic (the head is a global pool). */
function cnn(rng) {
  return E.Sequential([E.Conv1d(rng, 1, 8, 7, 2, 3), E.ReLU(), E.MaxPool1d(8, 2), E.Conv1d(rng, 8, 16, 5, 2, 2), E.ReLU(), E.GlobalPool(16, "avg"), E.Linear(rng, 16, 2)]);
}
function cnnAcc(rng, train, test, y, field = "zed", epochs = 20) {
  const net = cnn(rng);
  const toX = (w) => ({ x: { d: Float64Array.from(w[field]), L: w[field].length }, y: w[y] });
  const tr = train.map(toX), te = test.map(toX);
  const t1 = performance.now();
  E.train(rng, net, tr, { epochs, lr: 1e-3 });
  const ms = performance.now() - t1;
  return { acc: E.accuracy(net, te), trainAcc: E.accuracy(net, tr), ms };
}

/* ---------------------------------------------------------------- splits --- */
/** window-level: a random fifth held out, stratified by nothing (as the lesson's cell 13 does by label only) */
function splitByWindow(rng, windows) {
  const idx = windows.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const held = new Set(idx.slice(0, Math.round(idx.length / 5)));
  return { train: windows.filter((_, i) => !held.has(i)), test: windows.filter((_, i) => held.has(i)) };
}
/** subject-level: one subject of each class held out; every pairing in turn */
function* splitBySubject(subjects, windows) {
  const c0 = subjects.filter((s) => s.cls === 0), c1 = subjects.filter((s) => s.cls === 1);
  for (let i = 0; i < Math.min(c0.length, c1.length); i++) {
    const out = new Set([c0[i].s, c1[i].s]);
    yield { train: windows.filter((w) => !out.has(w.sub)), test: windows.filter((w) => out.has(w.sub)), held: [...out] };
  }
}
const balance = (ws, y) => pct(mean(ws.map((w) => w[y])));

/* ===================================================================== W1 */
head("W1 · the stage, class = rhythm (M5's), nearest neighbour on the log spectrum; S subjects");
for (const S of [8, 12, 16]) {
  const rng = makeRng(100 + S);
  const subjects = Array.from({ length: S }, (_, s) => subject(rng, s, s % 2, "rhythm"));
  const { windows } = windowed(rng, subjects, { L: 360, overlap: 0.5, T: 7200 });
  for (const w of windows) w.spec = spectrum(w.zed);
  const wl = splitByWindow(rng, windows);
  const accW = knn(wl.train, wl.test, "yRec");
  const accS = [...splitBySubject(subjects, windows)].map((sp) => knn(sp.train, sp.test, "yRec"));
  console.log(`S = ${S} × ${windows.length / S} windows of 360 (20 s at 50% overlap): window-level ${pct(accW)} (${wl.test.length} held out) · subject-level ${pct(mean(accS))} over ${accS.length} folds [${accS.map(pct).join(" ")}]`);
}

/* ===================================================================== W2 */
head("W2 · two label sources, class = ectopy: recording label against event labels; nearest neighbour AND 73's CNN");
{
  const S = 12;
  for (const seed of [1, 2]) {
    const rng = makeRng(200 + seed);
    const subjects = Array.from({ length: S }, (_, s) => subject(rng, s, s % 2, "ectopy"));
    const { windows } = windowed(rng, subjects, { L: 360, overlap: 0.5, T: 7200 });
    for (const w of windows) w.spec = spectrum(w.zed);
    console.log(`seed ${seed}: ${windows.length} windows; label balance — recording ${balance(windows, "yRec")}, any overlap ${balance(windows, "yAny")}, more than half ${balance(windows, "yMaj")}; among class-1 subjects' windows, ${pct(mean(windows.filter((w) => w.cls === 1).map((w) => w.yAny)))} hold an event`);
    for (const y of ["yRec", "yAny", "yMaj"]) {
      const wl = splitByWindow(makeRng(7), windows);
      const kW = knn(wl.train, wl.test, y);
      const folds = [...splitBySubject(subjects, windows)];
      const kS = mean(folds.map((sp) => knn(sp.train, sp.test, y)));
      const cW = cnnAcc(makeRng(9), wl.train, wl.test, y);
      const cS = folds.slice(0, 3).map((sp) => cnnAcc(makeRng(9), sp.train, sp.test, y));
      console.log(`  ${y.padEnd(5)}  1-NN: window ${pct(kW)} · subject ${pct(kS)}   CNN: window ${pct(cW.acc)} (train ${pct(cW.trainAcc)}, ${f(cW.ms / 1000, 1)} s) · subject ${pct(mean(cS.map((c) => c.acc)))} over 3 folds [${cS.map((c) => pct(c.acc)).join(" ")}] (train ${pct(mean(cS.map((c) => c.trainAcc)))})`);
    }
  }
}

/* ===================================================================== W3 */
head("W3 · overlap 0 / 50 / 75 % under the window-level split, class = rhythm (recording label), S = 12");
{
  for (const overlap of [0, 0.5, 0.75]) {
    const rng = makeRng(300);
    const subjects = Array.from({ length: 12 }, (_, s) => subject(rng, s, s % 2, "rhythm"));
    const { windows } = windowed(rng, subjects, { L: 360, overlap, T: 7200 });
    for (const w of windows) w.spec = spectrum(w.zed);
    const wl = splitByWindow(makeRng(7), windows);
    const kW = knn(wl.train, wl.test, "yRec");
    const kS = mean([...splitBySubject(subjects, windows)].map((sp) => knn(sp.train, sp.test, "yRec")));
    const cW = cnnAcc(makeRng(9), wl.train, wl.test, "yRec");
    console.log(`overlap ${pct(overlap).padStart(5)}: ${String(windows.length).padStart(4)} windows · 1-NN window ${pct(kW)} · subject ${pct(kS)} · CNN window ${pct(cW.acc)} (${f(cW.ms / 1000, 1)} s)`);
  }
}

/* ===================================================================== W4 */
head("W4 · normalisation: the CNN on raw against z-scored windows, class = rhythm, S = 12, 50% overlap");
{
  const rng = makeRng(400);
  const subjects = Array.from({ length: 12 }, (_, s) => subject(rng, s, s % 2, "rhythm"));
  const { windows } = windowed(rng, subjects, { L: 360, overlap: 0.5, T: 7200 });
  const rms = subjects.map((s) => Math.sqrt(mean(windows.filter((w) => w.sub === s.s).map((w) => mean(w.raw.map((v) => v * v))))));
  const cv = Math.sqrt(mean(rms.map((v) => (v - mean(rms)) ** 2))) / mean(rms);
  console.log(`per-subject RMS amplitude, raw: ${rms.map((v) => f(v)).join(" ")} (CV ${pct(cv)}); after per-window z-scoring every window has sd 1`);
  for (const field of ["raw", "zed"]) {
    const wl = splitByWindow(makeRng(7), windows);
    const cW = cnnAcc(makeRng(9), wl.train, wl.test, "yRec", field);
    const cS = [...splitBySubject(subjects, windows)].slice(0, 3).map((sp) => cnnAcc(makeRng(9), sp.train, sp.test, "yRec", field));
    console.log(`  ${field}: CNN window-level ${pct(cW.acc)} (train ${pct(cW.trainAcc)}) · subject-level ${pct(mean(cS.map((c) => c.acc)))} [${cS.map((c) => pct(c.acc)).join(" ")}]`);
  }
}

/* ===================================================================== W5 */
head("W5 · budget: one CNN training on the windows (20 epochs, half width)");
{
  for (const L of [360, 720]) {
    const rng = makeRng(500);
    const subjects = Array.from({ length: 8 }, (_, s) => subject(rng, s, s % 2, "rhythm"));
    const { windows } = windowed(rng, subjects, { L, overlap: 0.5, T: 7200 });
    const wl = splitByWindow(makeRng(7), windows);
    const r = cnnAcc(makeRng(9), wl.train, wl.test, "yRec");
    console.log(`L = ${L}: ${windows.length} windows (${wl.train.length} train) → ${f(r.ms / 1000, 2)} s for 20 epochs, ${f(r.ms / 20, 0)} ms an epoch`);
  }
}

/* ===================================================================== W6 */
head("W6 · label by overlap: windows one 80-sample event is labelled onto");
{
  const rng = makeRng(600), trials = 20000, Ev = 80;
  for (const L of [180, 360, 720]) for (const overlap of [0, 0.5, 0.75]) {
    const step = Math.round(L * (1 - overlap)), T = 7200; let anyN = 0, majN = 0, whole = 0;
    for (let i = 0; i < trials; i++) {
      const s0 = Math.floor(rng.next() * (T - Ev)), e0 = s0 + Ev; let any = 0, maj = 0, inWhole = false;
      for (let a = 0; a + L <= T; a += step) { const ov = Math.max(0, Math.min(a + L, e0) - Math.max(a, s0)); if (ov === Ev) inWhole = true; if (ov > 0) any++; if (ov > Ev / 2) maj++; }
      anyN += any; majN += maj; whole += inWhole ? 1 : 0;
    }
    console.log(`L = ${String(L).padStart(3)} · overlap ${pct(overlap).padStart(5)} (stride ${step}): any overlap ${f(anyN / trials)} windows · more than half ${f(majN / trials)} · wholly inside some window ${pct(whole / trials)}`);
  }
}

/* ===================================================================== W7 */
head("W7 · the grid: class × L × overlap at S = 8, nearest neighbour (spectrum); subject-level over all four folds");
{
  for (const classBy of ["rhythm", "ectopy"]) for (const L of [360, 720]) for (const overlap of [0, 0.5, 0.75]) {
    const rng = makeRng(700);
    const subjects = Array.from({ length: 8 }, (_, s) => subject(rng, s, s % 2, classBy));
    const { windows } = windowed(rng, subjects, { L, overlap, T: 7200 });
    for (const w of windows) w.spec = spectrum(w.zed);
    const ys = classBy === "rhythm" ? ["yRec"] : ["yRec", "yMaj"];
    for (const y of ys) {
      const wl = splitByWindow(makeRng(7), windows);
      const kW = knn(wl.train, wl.test, y);
      const folds = [...splitBySubject(subjects, windows)];
      const kS = folds.map((sp) => knn(sp.train, sp.test, y));
      console.log(`${classBy.padEnd(6)} ${y.padEnd(4)} L = ${String(L).padStart(3)} · overlap ${pct(overlap).padStart(5)} · ${String(windows.length).padStart(4)} windows: window-level ${pct(kW).padStart(6)} · subject-level ${pct(mean(kS)).padStart(6)} [${kS.map((v) => pct(v)).join(" ")}]`);
    }
  }
}

/* ===================================================================== W8 */
head("W8 · the similarity rule, and where the nearest neighbour comes from (ectopy, recording label, L = 360, 50%, S = 8)");
{
  const rng = makeRng(800);
  const subjects = Array.from({ length: 8 }, (_, s) => subject(rng, s, s % 2, "ectopy"));
  const { windows } = windowed(rng, subjects, { L: 360, overlap: 0.5, T: 7200 });
  for (const w of windows) w.spec = spectrum(w.zed);
  const lagCorr = (a, b) => { let best = -2; const n = a.length; for (let lag = -180; lag <= 180; lag += 4) { let s = 0, c = 0; for (let i = Math.max(0, -lag); i < Math.min(n, n - lag); i++) { s += a[i] * b[i + lag]; c++; } const v = (s / c) * Math.sqrt(c / n); if (v > best) best = v; } return best; };
  const rules = { spectrum: (p, q) => corr(p.spec, q.spec), "raw, zero lag": (p, q) => corr(p.zed, q.zed), "raw, best lag": (p, q) => lagCorr(p.zed, q.zed) };
  const wl = splitByWindow(makeRng(7), windows);
  const folds = [...splitBySubject(subjects, windows)];
  for (const [name, sim] of Object.entries(rules)) {
    const t1 = performance.now();
    const nn = (train, t) => { let best = -Infinity, at = null; for (const tr of train) { const c = sim(tr, t); if (c > best) { best = c; at = tr; } } return at; };
    const score = (train, test, y) => { let ok = 0, same = 0, over = 0; for (const t of test) { const m = nn(train, t); if (m[y] === t[y]) ok++; if (m.sub === t.sub) { same++; if (Math.abs(m.start - t.start) < 360) over++; } } return { acc: ok / test.length, same: same / test.length, over: over / test.length }; };
    const rW = score(wl.train, wl.test, "yRec"), rM = score(wl.train, wl.test, "yMaj");
    const sW = mean(folds.map((sp) => score(sp.train, sp.test, "yRec").acc)), sM = mean(folds.map((sp) => score(sp.train, sp.test, "yMaj").acc));
    console.log(`${name.padEnd(14)}: recording label — window-level ${pct(rW.acc)} · subject-level ${pct(sW)}; event label — ${pct(rM.acc)} · ${pct(sM)}; under the window-level split the nearest neighbour is the SAME SUBJECT for ${pct(rW.same)} of held-out windows and an OVERLAPPING window for ${pct(rW.over)}  (${f((performance.now() - t1) / 1000, 1)} s)`);
  }
  for (const y of ["yRec", "yMaj"]) for (const seed of [9, 10]) {
    const cW = cnnAcc(makeRng(seed), wl.train, wl.test, y);
    const cS = folds.map((sp) => cnnAcc(makeRng(seed), sp.train, sp.test, y));
    console.log(`CNN seed ${seed} ${y}: window-level ${pct(cW.acc)} (train ${pct(cW.trainAcc)}) · subject-level ${pct(mean(cS.map((c) => c.acc)))} [${cS.map((c) => pct(c.acc)).join(" ")}]`);
  }
}

/* ===================================================================== W9 */
head("W9 · does a longer window make the rhythm class learnable across subjects?  S = 8, 50% overlap, 40 s recordings");
{
  const lagCorr = (a, b, stepLag = 4, maxLag = 180) => { let best = -2; const n = a.length; for (let lag = -maxLag; lag <= maxLag; lag += stepLag) { let s = 0, c = 0; for (let i = Math.max(0, -lag); i < Math.min(n, n - lag); i++) { s += a[i] * b[i + lag]; c++; } const v = (s / c) * Math.sqrt(c / n); if (v > best) best = v; } return best; };
  const nnAcc = (train, test, y, sim) => { let ok = 0, same = 0; for (const t of test) { let best = -Infinity, at = null; for (const tr of train) { const c = sim(tr, t); if (c > best) { best = c; at = tr; } } if (at[y] === t[y]) ok++; if (at.sub === t.sub) same++; } return { acc: ok / test.length, same: same / test.length }; };
  for (const jitter of [0.3, 0.5]) for (const L of [360, 720, 1440, 2880]) {
    const rng = makeRng(900);
    const subjects = Array.from({ length: 8 }, (_, s) => subject(rng, s, s % 2, "rhythm"));
    for (const s of subjects) if (s.cls === 1) s.jitter = jitter;
    const { windows } = windowed(rng, subjects, { L, overlap: 0.5, T: 14400 });
    for (const w of windows) { w.spec = spectrum(w.zed); w.half = w.zed.filter((_, i) => i % 2 === 0); }
    const wl = splitByWindow(makeRng(7), windows);
    const folds = [...splitBySubject(subjects, windows)];
    const sp = { w: nnAcc(wl.train, wl.test, "yRec", (p, q) => corr(p.spec, q.spec)), s: mean(folds.map((f_) => nnAcc(f_.train, f_.test, "yRec", (p, q) => corr(p.spec, q.spec)).acc)) };
    const t1 = performance.now();
    const lg = { w: nnAcc(wl.train, wl.test, "yRec", (p, q) => lagCorr(p.half, q.half, 3, 90)), s: mean(folds.map((f_) => nnAcc(f_.train, f_.test, "yRec", (p, q) => lagCorr(p.half, q.half, 3, 90)).acc)) };
    const lagMs = performance.now() - t1;
    let cnnLine = "";
    if (L <= 1440) { const c = cnnAcc(makeRng(9), wl.train, wl.test, "yRec"); const cs = folds.map((f_) => cnnAcc(makeRng(9), f_.train, f_.test, "yRec").acc); cnnLine = ` · CNN window ${pct(c.acc)} / subject ${pct(mean(cs))} (${f(c.ms / 1000, 1)} s)`; }
    console.log(`jitter ${jitter} · L = ${String(L).padStart(4)} · ${String(windows.length).padStart(3)} windows: spectrum window ${pct(sp.w.acc)} / subject ${pct(sp.s)} · best-lag (half rate, lag step 3) window ${pct(lg.w.acc)} / subject ${pct(lg.s)}, same subject ${pct(lg.w.same)} (${f(lagMs / 1000, 1)} s for all five scorings)${cnnLine}`);
  }
}

console.log(`\ntotal ${secs()} s`);
