/* ============================================================================
   Widget 72 · signal-windows — what the page claims, held to the model.

       node widgets/_lab/signal-windows-verify.mjs

   §1 the cleaning's arithmetic: decimation keeps every M-th sample, a
      second-order section run forward and backward leaves a tone in its
      pass-band untouched and takes the notched one down, the wavelet
      reconstructs to rounding, the moving average by prefix sums equals the
      plain sum, a filter above Nyquist is skipped and the folded line named
   §2 the page's claims on the default stage: the notch takes the 50 Hz line
      three decades down; A_8 leaves under 5% of the drift and A_10 most of
      it; the moving average sits between
   §3 the windows: the count, the stride, the label rules against a brute
      count, and the event reach against the measurement's 2.4 / 2.0
   §4 the split: on the recording label the window-level deal scores above
      the subject-level one and its nearest window is the same subject more
      often; on the event label the two agree within twenty points
   §5 the copy: no struck word in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import * as M from "../signal-windows/model.js";

const here = dirname(fileURLToPath(import.meta.url));
let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const rms = (a) => Math.sqrt(a.reduce((p, q) => p + q * q, 0) / a.length);

section("§1 the cleaning's arithmetic");
{
  const x = Float64Array.from({ length: 1000 }, (_, t) => Math.sin(t / 7));
  const d = M.decimate(x, 4);
  assert(d.length === 250 && d.every((v, i) => v === x[4 * i]), "decimate by 4 keeps every fourth sample");
  const fs = 360, T = 4096;
  const tone = (hz) => Float64Array.from({ length: T }, (_, t) => Math.sin(2 * Math.PI * hz * t / fs));
  const mid = (a) => Array.from(a.slice(1024, 3072));
  const passed = M.notch(tone(10), 50, fs), stopped = M.notch(tone(50), 50, fs);
  assert(Math.abs(rms(mid(passed)) / rms(mid(tone(10))) - 1) < 0.02, `a 10 Hz tone passes the 50 Hz notch (${(rms(mid(passed)) / rms(mid(tone(10)))).toFixed(3)})`);
  assert(rms(mid(stopped)) / rms(mid(tone(50))) < 0.01, `the 50 Hz tone is stopped (${(rms(mid(stopped)) / rms(mid(tone(50)))).toExponential(1)})`);
  const lowed = M.lowpass(tone(100), 40, fs);
  assert(rms(mid(lowed)) / rms(mid(tone(100))) < 0.05, `a 100 Hz tone is below 5% after the 40 Hz low-pass (${(rms(mid(lowed)) / rms(mid(tone(100)))).toFixed(3)})`);
  assert(M.biquad("notch", 50, 30, 90) === null && M.biquad("lp", 40, 0.7, 90) !== null, "a section at or above Nyquist is null, one below is not");
  assert(M.folded(50, 90) === 40 && M.folded(50, 180) === 50, `the 50 Hz line folds to 40 Hz at 90 Hz and stays at 180 (${M.folded(50, 90)}, ${M.folded(50, 180)})`);
  const rng = makeRng(3), noise = Float64Array.from({ length: 3000 }, () => rng.normal(0, 1));
  const w = M.wavelet(noise, 6, { details: true });
  assert(w.err < 1e-12, `db4 reconstructs to rounding (${w.err.toExponential(1)})`);
  const sumD = noise.map((v, t) => w.A[t] + w.D.reduce((p, d) => p + d[t], 0));
  assert(Math.max(...noise.map((v, t) => Math.abs(v - sumD[t]))) < 1e-9, "A_J plus the details is the signal");
  const ma = M.movingAverage(noise, 21), plain = noise.map((_, t) => { let s = 0, c = 0; for (let k = Math.max(0, t - 10); k < Math.min(noise.length, t + 10); k++) { s += noise[k]; c++; } return s / c; });
  assert(Math.max(...ma.map((v, t) => Math.abs(v - plain[t]))) < 1e-9, "the moving average by prefix sums equals the plain sum");
  const c90 = M.clean(tone(50), { rate: 90, notchHz: "50", lowHz: "100", trend: "average", level: 8 });
  assert(c90.notchSkipped && c90.lowSkipped && c90.lineAt === 40 && c90.cleaned.length === 1024, "at 90 Hz both filters are skipped and the line is named at 40 Hz");
  console.log(`  ${checks} checks`);
}

section("§2 the page's claims on the default stage");
{
  const st = M.stage(1, "both"), r = st[1];
  const c = M.clean(r.raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "wavelet", level: 8 });
  const lineLeft = M.powerAt(c.filtered, 50, 360) / M.powerAt(c.resampled, 50, 360);
  assert(lineLeft < 1e-3, `the notch takes the 50 Hz line three decades down (${lineLeft.toExponential(1)})`);
  const left = (J) => { const cc = M.clean(r.raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "wavelet", level: J }); return M.driftLeft(cc.cleaned, r.drift, 360); };
  const l8 = left(8), l9 = left(9), l10 = left(10);
  assert(l8 < 0.05 && l10 > 0.5 && l9 > l8 && l9 < l10, `A_8 leaves under 5% of the drift and A_10 most of it (${pct(l8)}, ${pct(l9)}, ${pct(l10)})`);
  const ma = M.clean(r.raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "average", level: 8 });
  const lm = M.driftLeft(ma.cleaned, r.drift, 360);
  assert(lm > l8 && lm < l10, `the 2 s moving average sits between (${pct(lm)})`);
  const clean = M.clean(M.stage(1, "none")[1].raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "wavelet", level: 8 });
  assert(M.driftLeft(clean.cleaned, M.stage(1, "none")[1].drift, 360) === null, "with no drift added the drift-left reading is none");
  console.log(`  ${checks} checks`);
}

section("§3 the windows");
{
  const st = M.stage(1, "both"), cleaned = st.map((r) => M.clean(r.raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "wavelet", level: 8 }));
  const events = st.map((r) => r.events);
  const { windows, step } = M.windowed(cleaned, events, { L: 360, overlap: 0.5 });
  assert(step === 180 && windows.length === 8 * 39, `360 at 50%: stride 180, 39 windows a subject (${step}, ${windows.length})`);
  const w0 = M.windowed(cleaned, events, { L: 1440, overlap: 0 });
  assert(w0.step === 1440 && w0.windows.length === 40, `1440 at 0%: 5 a subject (${w0.windows.length})`);
  /* the label rules against a brute count on one window */
  let ok = 0;
  for (const w of windows) {
    let any = 0, maj = 0;
    for (const [e0, e1] of events[w.sub]) { const ov = Math.max(0, Math.min(w.start + 360, e1) - Math.max(w.start, e0)); if (ov > 0) any = 1; if (ov > (e1 - e0) / 2) maj = 1; }
    if (any === w.yAny && maj === w.yMaj) ok++;
  }
  assert(ok === windows.length, `every window's event labels match a brute count (${ok} of ${windows.length})`);
  assert(windows.every((w) => w.yMaj <= w.yAny), "more-than-half never labels a window any-overlap does not");
  const counts = M.eventCounts(events, 1, 360, 180, 7200);
  assert(Math.abs(counts.any - 2.4) < 0.3 && Math.abs(counts.maj - 2.0) < 0.2, `an event reaches about 2.4 windows at any overlap and 2.0 with more than half (${counts.any.toFixed(2)}, ${counts.maj.toFixed(2)})`);
  const cls = st.map((r) => r.sub.cls);
  assert(windows.filter((w) => M.labelOf(w, cls, "recording", "maj")).length === windows.length / 2, "the recording label is 1 on exactly half the windows");
  const z = windows[5].zed, m = z.reduce((p, q) => p + q, 0) / z.length, sd = Math.sqrt(z.reduce((p, q) => p + (q - m) ** 2, 0) / z.length);
  assert(Math.abs(m) < 1e-9 && Math.abs(sd - 1) < 1e-9, "a z-scored window has mean 0 and sd 1");
  console.log(`  ${checks} checks`);
}

section("§4 the split");
{
  const st = M.stage(1, "both"), cleaned = st.map((r) => M.clean(r.raw, { rate: 360, notchHz: "50", lowHz: "40", trend: "wavelet", level: 8 }));
  const cls = st.map((r) => r.sub.cls), events = st.map((r) => r.events);
  const { windows } = M.windowed(cleaned, events, { L: 360, overlap: 0.5 });
  const bw = M.splitByWindow(makeRng(14), windows), bs = M.splitBySubject(windows);
  assert(windows.filter(bw.held).length === Math.round(windows.length / 5), "by window holds out a fifth");
  assert(windows.filter(bs.held).every((w) => w.sub < 2) && windows.filter(bs.held).length === 2 * 39, "by subject holds out every window of subjects 1 and 2");
  const yRec = (w) => M.labelOf(w, cls, "recording", "maj"), yEv = (w) => M.labelOf(w, cls, "event", "maj");
  const rw = M.score(windows, bw, yRec), rs = M.score(windows, bs, yRec);
  assert(rw.acc > rs.acc + 0.1, `recording label: by window ${pct(rw.acc)} scores above by subject ${pct(rs.acc)}`);
  assert(rw.same > 0.3 && rs.same === 0, `by window the nearest window is the same subject for ${pct(rw.same)}; by subject never (${pct(rs.same)})`);
  const ew = M.score(windows, bw, yEv), es = M.score(windows, bs, yEv);
  assert(Math.abs(ew.acc - es.acc) < 0.2 && ew.acc > 0.7, `event label: the two deals agree within twenty points (${pct(ew.acc)}, ${pct(es.acc)})`);
  assert(rw.matches.every((m) => !bw.held(m.at)), "no match is itself held out");
  console.log(`  ${checks} checks`);
}

section("§5 the copy");
{
  const src = readFileSync(join(here, "..", "signal-windows", "main.js"), "utf8");
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const strings = [...body.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2]);
  /* the collection's struck words, and this widget's own: deal and deck (a card metaphor, struck at the audit of
     2026-09-20), the sit/fall/lie verbs, and the abbreviations the Window page's letters used to be */
  const struck = [/\byou\b/i, /\byour\b/i, /\bnever\b/i, /\blesson\b/i, /\bnotebook\b/i, /\bcell\b/i, /\bwe\b/i, /\bour\b/i, /\bsticky\b/i, /\bchose\b/i,
    /\bdeal[st]?\b/i, /\bdeck\b/i, /\bsits?\b/i, /\blies?\b/i, /\bfalls?\b/i, /\birr\b/, /\breg\b/];
  const hits = strings.filter((s) => struck.some((re) => re.test(s)));
  assert(hits.length === 0, `no struck word in a reader-facing string (${hits.slice(0, 3).join(" | ")})`);
  console.log(`  ${checks} checks`);
}

console.log(`\n${checks} checks, ${fails} failed`);
if (fails) process.exit(1);
