/* ============================================================================
   Widget 72 · Deep Learning - Signal Windows

   PHM5005 07-2 cells 1–21, four pages in the notebook's own order: the
   cleaning of a raw recording (Resample → Filter → Detrend), its cutting into
   windows and the label each window inherits, the split's unit, and
   per-window normalisation. `model.js` is the stage and the arithmetic; this
   file draws and paces, and holds every string a reader sees.

   THE MISCONCEPTION, on the Split page: a window is a sample, so a random
   split of windows is a fair test. Measured (`_lab/signal-windows-measure.mjs`):
   with the recording label a nearest neighbour scores 59 → 87% by window as
   the overlap goes 0 → 75%, and chance by subject at every window length —
   the window-level number is the subject. The scorer is the simplest model
   there is, so the mechanism is drawn: the held-out window over its nearest
   training window, and whose it is.

   DECISIONS TAKEN AT THE MOCK (his picks, 2026-09-20 evening), so they are
   not re-argued:
    1. BOTH ANNOTATIONS ARE ON THE STAGE and an Annotation control (data)
       chooses which becomes the label. The Window page shows that arm of the
       lesson's figure; the Split page scores that label.
    2. THE SCORER IS THE NEAREST WINDOW, correlation at the best shift, drawn.
       Not a trained net.
    3. ONE DEAL IS DRAWN, chosen by a Split control; both accuracies print.
    4. THE CLEANING IS A FIRST PAGE, Step running the figure's three rows; its
       controls are DATA controls, so the other pages window the CLEANED
       recording. The filter is a notch and a low-pass, not the lesson's
       band-pass, which was measured to remove the drift by itself and leave
       Detrend nothing to do.
    5. Trend: moving average · polynomial · wavelet, with Level when wavelet.
       Noise: none · line · drift · both, one control, so a step can be
       watched doing nothing.
   ========================================================================= */

import { defineWidget, makeRng } from "../core/index.js";
import * as M from "./model.js";

/* ------------------------------------------------------------- the pages -- */

const PAGES = [
  { value: "clean", label: "Clean" },
  { value: "window", label: "Window" },
  { value: "split", label: "Split" },
  { value: "normalize", label: "Normalize" },
];
const ON = (page) => ({ param: "page", equals: page });
const ON_WINDOWS = { param: "page", oneOf: ["window", "split", "normalize"] };
const ON_SUBJECT = { param: "page", oneOf: ["clean", "window"] };
const HEIGHTS = { clean: 560, window: 344, split: 456, normalize: 300 };

const DUR = { clean: 900, window: 220, holdOut: 800, scoreOne: 140, normalize: 900 };
const PICK_MAX = 160;

/* ------------------------------------------------------------- the copy --- */

const S = {
  subtitle:
    "A signal is recorded as one long trace at its own sampling rate, with line noise and a drifting "
    + "baseline, so it is resampled, filtered and detrended, then cut into windows of fixed length that "
    + "each inherit a label from the recording's annotation or from the events they overlap. A window is "
    + "not an independent sample: split by window, a held-out window's nearest training window is usually "
    + "the same subject's and the score is inflated; split by subject it is not. Each window is then "
    + "standardised over its own samples.",
  pageLabel: "Page",
  recSection: "The recordings",
  noiseLabel: "Noise",
  noiseDetail: "what the raw recordings contain besides the ECG: line noise at 50 Hz, a slow drift, or both",
  seedLabel: "Seed",
  seedDetail: "the eight subjects, their recordings and the split, reproducibly",
  cleanSection: "The cleaning",
  rateLabel: "Rate",
  rateDetail: "the sampling rate after resampling: every M-th sample is kept",
  notchLabel: "Notch",
  notchDetail: "a narrow stop band at one frequency",
  lowLabel: "Low-pass",
  lowDetail: "the cut-off frequency; everything faster is removed",
  trendLabel: "Trend",
  trendDetail: "what is subtracted as the baseline: a moving average of 2 s, a polynomial of degree 5, or a wavelet approximation",
  levelLabel: "Level",
  levelDetail: "how coarse the wavelet approximation is; a higher level follows only slower changes",
  winSection: "The windows",
  windowLabel: "Window",
  windowDetail: "the length of one window, in seconds at the rate",
  overlapLabel: "Overlap",
  overlapDetail: "how much of each window the next one shares",
  annotationLabel: "Annotation",
  annotationDetail: "where a window's label comes from: the recording's one label, or the events that overlap the window",
  ruleLabel: "Event rule",
  ruleDetail: "when an event labels a window: at any overlap, or only with more than half the event inside",
  splitSection: "The split",
  splitLabel: "Split",
  splitDetail: "the unit assigned to train or held-out: a random fifth of the windows, or one subject of each class with every window of theirs",
  lookSection: "Look at",
  subjectLabel: "Subject",
  subjectDetail: "whose recording is drawn",
  pickLabel: "Held-out window",
  pickDetail: "which held-out window is drawn over its nearest training window; a click on a held-out window in the figure picks one",

  stepLabels: {
    clean0: "Resample", clean1: "Filter", clean2: "Detrend", clean3: "Detrend",
    window: "Cut a window",
    split0: "Hold out", split1: "Score a window",
    normalize0: "Normalize", normalize1: "Normalize",
  },
  stepTitles: {
    clean0: "Keep every M-th sample of the raw recording",
    clean1: "Run the resampled recording through the notch and the low-pass",
    clean2: "Subtract the chosen trend from the filtered recording",
    clean3: "Every step of the cleaning is drawn",
    window: "Cut the next window at the stride and write the label it inherits",
    split0: "Assign every window to train or held-out by the chosen unit",
    split1: "Find the next held-out window's nearest training window and take its label",
    normalize0: "Standardise every window over its own samples",
    normalize1: "Every window is standardised",
  },
  runTitle: "Run the remaining presses of this page in order",

  legend: {
    clean: [
      { token: "empirical", label: "The recording at each step", mark: "line" },
      { token: "theory", label: "The trend subtracted", mark: "line" },
      { token: "reference", label: "The power before the filter", mark: "line" },
      { token: "highlight", label: "The one second drawn sample by sample" },
    ],
    window: [
      { token: "empirical", label: "The cleaned recording", mark: "line" },
      { token: "event", label: "An event, and a window labelled with one" },
      { token: "nonevent", label: "A window with no event" },
      { token: "highlight", label: "The window being cut" },
    ],
    split: [
      { token: "event", label: "A window labelled 1: irregular rhythm, or an event inside" },
      { token: "nonevent", label: "A window labelled 0" },
      { token: "holdout", label: "Held out, scored once" },
      { token: "highlight", label: "The held-out window drawn" },
      { token: "reference", label: "Its nearest training window", mark: "line" },
    ],
    normalize: [
      { token: "empirical", label: "One window's amplitude, before and after" },
      { token: "reference", label: "Standard deviation 1", mark: "line" },
    ],
  },

  /* canvas captions */
  capRaw: (s, sec, fs) => `Raw · subject ${s} · ${sec} s at ${fs} Hz`,
  capResample: (fs, M, n) => `Resample · x'[n] = x[n·${M}] · ${fs} Hz · ${n} samples`,
  capZoom: "one second, sample by sample",
  capR: (k) => `an R wave spans ${k} samples`,
  capFilter: (parts) => `Filter · ${parts.join(" · ")}`,
  filterNone: "no filter",
  filterNotch: (hz) => `notch ${hz} Hz`,
  filterLow: (hz) => `low-pass ${hz} Hz`,
  capFolded: (hz, at, fs) => `the ${hz} Hz line is above half the rate and has folded to ${at} Hz; a notch at ${hz} Hz is not possible at ${fs} Hz`,
  capLowSkipped: (hz, fs) => `${hz} Hz is above half the rate; nothing to stop at ${fs} Hz`,
  capPower: (fs) => `power · 0–${Math.min(80, fs / 2).toFixed(0)} Hz`,
  capPowerBefore: "before",
  capPowerAfter: "after",
  capDetrend: (name) => `Detrend · x'(t) = x(t) − trend · ${name}`,
  trendNames: { average: "moving average of 2 s", polynomial: "polynomial of degree 5", wavelet: (j, hz) => `wavelet A_${j}, slower than ${hz.toFixed(2)} Hz` },
  capCleaned: "cleaned",

  capRecording: (s) => `Subject ${s} · cleaned recording`,
  capRecAnnot: (cls) => `recording annotation: ${cls ? "irregular rhythm" : "regular rhythm"}`,
  capEvent: "event",
  capLane: (L, sec, step) => `windows of ${L} samples = ${sec} s, stride ${step}`,
  capLaneRec: "every window inherits the recording's label",
  capLaneAny: "a window is labelled 1 at any overlap with an event",
  capLaneMaj: "a window is labelled 1 with more than half an event inside",
  winLetter: (y, annotation) => (annotation === "recording" ? (y ? "1" : "0") : y ? "A" : "N"),

  capDeck: (n, kind) => `${n} windows, one row a subject · held out by ${kind === "window" ? "window: a random fifth" : "subject: one of each class"}`,
  capDeckWait: (n) => `${n} windows, one row a subject · not yet split`,
  subjectRow: (s) => `subject ${s}`,
  capMatch: (ts, ms, c, same) => `held-out window of subject ${ts} over its nearest training window, subject ${ms} · correlation ${c.toFixed(2)}${same ? " · the same subject" : ""}`,
  capMatchWait: "the held-out window and its nearest training window are drawn once one is scored",

  capAmp: "each window's amplitude · one dot a window · by subject",
  capAmpAfter: "after (x − mean) / std over the window",
  capSd1: "sd 1",
  capShape: (N, L) => `[N, C, L] = [${N}, 1, ${L}]`,
  capShapeNote: (N, L, sec, fs) => `N = ${N} windows · C = 1 channel · L = ${L} samples = ${sec} s at ${fs} Hz`,
  capBatch: (L) => `one batch · xb.shape  torch.Size([64, 1, ${L}])`,

  /* readout */
  tileRate: "Rate",
  tileRateNote: (M) => (M === 1 ? "every sample kept" : `every ${M}${M === 2 ? "nd" : "th"} sample kept`),
  tileLine: "Line noise left",
  tileLineNote: "power at the line's frequency after the filter, as a fraction of before",
  tileDrift: "Drift left",
  tileDriftNote: "what is slower than 0.4 Hz after detrending, as a fraction of the drift added",
  tileWait: "—",
  tileNone: "none added",
  tileWindows: "Windows",
  tileWindowsNote: (per, sub) => `${per} a subject, ${sub} subjects`,
  tileReach: "Windows one event labels",
  tileReachNote: (rule) => (rule === "any" ? "on average, at any overlap" : "on average, with more than half inside"),
  tileOnes: "Labelled 1",
  tileOnesNote: (annotation) => (annotation === "recording" ? "windows of the subjects with an irregular rhythm" : "windows with an event inside, by the rule"),
  tileByWindow: "Held-out accuracy · by window",
  tileBySubject: "Held-out accuracy · by subject",
  tileAccNote: (n) => `${n} held-out windows, each given its nearest training window's label`,
  tileSame: "Nearest window is the same subject",
  tileSameNote: "of the held-out windows scored so far, under the split drawn",
  tileSoFar: (k, n) => `${k} of ${n} scored`,
  tileCv: "Spread of amplitude between subjects",
  tileCvNote: "coefficient of variation of the subjects' mean window amplitude",
  tileShape: "Shape",
  tileShapeNote: "windows, channels, samples",

  /* summary */
  sum: {
    clean: (n) => ["the raw recording", "the raw and the resampled recording", "resampled and filtered", "resampled, filtered and detrended"][n],
    window: (k, n) => (k === 0 ? "the recording, no window cut" : k < n ? `${k} of ${n} windows cut and labelled` : "every window cut and labelled"),
    split: (k, n) => (k === 0 ? "the windows, not yet split" : k === 1 ? "split, none scored" : k - 1 < n ? `${k - 1} of ${n} held-out windows scored` : "every held-out window scored"),
    normalize: (n) => (n ? "every window standardised" : "the windows' amplitudes as recorded"),
  },
};

/* --------------------------------------------------------- drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic" } = {}) {
  ctx.save();
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = fill ?? colors.ink2;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
  ctx.restore();
}
const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  ctx.restore();
}
function polyline(ctx, xs, ys, stroke, width = 1.2) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = "round";
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i]))); ctx.stroke(); ctx.restore();
}
/** a trace on a FIXED value window, so a step that changes the amplitude reads as a change and not a rescale */
function trace(ctx, x, x0, x1, top, bot, stroke, width = 1, lo = -1.5, hi = 3) {
  const n = x.length, xs = new Array(n), ys = new Array(n);
  for (let t = 0; t < n; t++) {
    xs[t] = x0 + (t / Math.max(1, n - 1)) * (x1 - x0);
    ys[t] = bot - ((Math.max(lo, Math.min(hi, x[t])) - lo) / (hi - lo)) * (bot - top);
  }
  polyline(ctx, xs, ys, stroke, width);
  return (t) => x0 + (t / Math.max(1, n - 1)) * (x1 - x0);
}
const PAD_L = 44, PAD_R = 14;
const Z_LO = -2.5, Z_HI = 4;

/* ----------------------------------------------------------- the geometry */

const CL = { rawHead: 14, rawTop: 20, rawBot: 96, resHead: 124, resTop: 130, resBot: 206, filtHead: 240, filtTop: 246, filtBot: 322, specW: 200, detHead: 356, detTop: 362, detBot: 438, cleanTop: 462, cleanBot: 538 };
const WN = { recHead: 14, recTop: 20, recBot: 110, laneHead: 140, laneTop: 150, rowH: 18, noteY: 214 };
const SP = { deckHead: 14, deckTop: 22, rowH: 16, gap: 5, labelW: 56, matchHead: 218, matchTop: 226, matchBot: 300, noteY: 318 };
const NM = { head: 14, top: 30, bot: 200, colW: 26, printX: 0 };

/* ================================================================ compute */

/* The scoring is the slow part (up to 2 s at 1 s windows and 75% overlap),
   and a page switch is a display change that re-runs compute(): cached by
   the parameters that shape it, as widget 73 caches its trained nets. */
const scoreCache = new Map();
function cachedScore(key, make) {
  if (scoreCache.has(key)) return scoreCache.get(key);
  const v = make();
  if (scoreCache.size > 12) scoreCache.delete(scoreCache.keys().next().value);
  scoreCache.set(key, v);
  return v;
}

function compute({ params }) {
  const seed = params.seed, rate = Number(params.rate), level = Number(params.level);
  const cleaning = { rate, notchHz: params.notchHz, lowHz: params.lowHz, trend: params.trend, level };
  const st = M.stage(seed, params.noise);
  const cleaned = st.map((r) => M.clean(r.raw, cleaning));
  const cls = st.map((r) => r.sub.cls);
  const events = st.map((r) => r.events);
  const sec = Number(params.window), L = sec * rate, overlap = Number(params.overlap) / 100;
  const { windows, step } = M.windowed(cleaned, events, { L, overlap });
  const perSub = windows.length / M.SUBJECTS;
  const counts = M.eventCounts(events, cleaned[0].M, L, step, cleaned[0].cleaned.length);
  const y = (w) => M.labelOf(w, cls, params.annotation, params.rule);
  const s = Math.max(0, Math.min(M.SUBJECTS - 1, Number(params.subject) - 1));
  const state = { st, cleaned, cls, windows, step, L, sec, perSub, counts, y, shown: s, rate, M: cleaned[0].M };

  if (params.page === "clean") {
    const c = cleaned[s], r = st[s];
    const specOf = (x) => { const n = Math.min(2048, x.length), bins = 240, top = Math.min(80, rate / 2), out = new Float64Array(bins); for (let b = 0; b < bins; b++) out[b] = Math.log10(1e-9 + M.powerAt(x, (b / bins) * top, rate, n)); return out; };
    state.clean = {
      ...c, raw: r.raw, drift: r.drift,
      specBefore: specOf(c.resampled), specAfter: specOf(c.filtered),
      lineLeft: params.noise === "line" || params.noise === "both" ? M.powerAt(c.filtered, c.lineAt, rate) / Math.max(1e-12, M.powerAt(c.resampled, c.lineAt, rate)) : null,
      driftLeft: M.driftLeft(c.cleaned, M.decimate(r.drift, c.M), rate),
      rSpan: Math.max(1, Math.ceil((2 * r.sub.width + 1) / c.M)),
    };
  }
  if (params.page === "split") {
    const key = [seed, params.noise, rate, params.notchHz, params.lowHz, params.trend, level, sec, params.overlap, params.annotation, params.rule].join("|");
    const both = cachedScore(key, () => ({
      window: M.score(windows, M.splitByWindow(makeRng(seed * 11 + 3), windows), y),
      subject: M.score(windows, M.splitBySubject(windows), y),
    }));
    const res = both[params.split];
    state.split = { both, res, kind: params.split, pick: Math.max(1, Math.min(res.matches.length, Number(params.pick))) };
  }
  if (params.page === "normalize") state.amp = M.amplitudes(windows);
  return state;
}

/* ================================================================== anim */

const stagesOf = (page, state) => (page === "clean" ? 3 : page === "window" ? state.perSub : page === "split" ? 1 + state.split.res.matches.length : 1);
const durOf = (page, count) => (page === "clean" ? DUR.clean : page === "window" ? DUR.window : page === "split" ? (count === 1 ? DUR.holdOut : DUR.scoreOne) : DUR.normalize);
function settle(anim) {
  const n = anim.n[anim.page];
  anim.labelAt = anim.page === "clean" ? `clean${n}` : anim.page === "window" ? "window" : anim.page === "split" ? (n === 0 ? "split0" : "split1") : `normalize${n}`;
}
const isDone = (anim, state) => anim.n[anim.page] >= stagesOf(anim.page, state) && anim.t >= 1;
function takePress(anim, dt, state) {
  const count = anim.n[anim.page], max = stagesOf(anim.page, state);
  if (anim.t < 1) { anim.t = Math.min(1, anim.t + dt / durOf(anim.page, count)); return true; }
  if (count >= max) return false;
  anim.n[anim.page] += 1;
  anim.t = 0;
  return true;
}
/** reveal fraction of stage `n` on a page whose press count is `count` */
const stageT = (anim, n, count) => (count > n ? 1 : count === n ? ease(anim.t) : 0);

/* ================================================================ drawing */

function drawClean(ctx, colors, w, params, state, anim) {
  const c = state.clean, X0 = PAD_L, X1 = w - PAD_R, count = anim.n.clean, fs = c.rate;
  const sub = state.st[state.shown].sub;
  txt(ctx, colors, S.capRaw(state.shown + 1, M.SECONDS, M.FS), X0, CL.rawHead, { font: capFont(colors), fill: colors.ink1 });
  trace(ctx, c.raw, X0, X1, CL.rawTop, CL.rawBot, colors.empirical, 0.8);

  const tRes = stageT(anim, 1, count);
  if (tRes > 0) {
    ctx.save(); ctx.globalAlpha = tRes;
    txt(ctx, colors, S.capResample(fs, c.M, c.resampled.length), X0, CL.resHead, { font: capFont(colors), fill: colors.ink1 });
    /* the whole resampled trace, then one second of it sample by sample on the right */
    const zx0 = X1 - 220, zx1 = X1;
    const px = trace(ctx, c.resampled, X0, zx0 - 30, CL.resTop, CL.resBot, colors.empirical, 0.8);
    const a = 2 * fs, seg = Array.from(c.resampled.slice(a, a + fs));
    rect(ctx, px(a), CL.resTop, px(a + fs) - px(a), CL.resBot - CL.resTop, wash(colors.highlight, 0.12), colors.highlight, 1);
    const zp = trace(ctx, seg, zx0, zx1, CL.resTop, CL.resBot, colors.empirical, 0.8);
    for (let t = 0; t < seg.length; t++) { const yy = CL.resBot - ((Math.max(-1.5, Math.min(3, seg[t])) + 1.5) / 4.5) * (CL.resBot - CL.resTop); rect(ctx, zp(t) - 1, yy - 1, 2, 2, colors.ink1); }
    /* the R-wave note goes under the long trace, not under the 220 px inset, where it met the zoom caption
       (his first look, 2026-09-20) and, moved to a second line, the filter row's caption */
    txt(ctx, colors, S.capZoom, zx0, CL.resBot + 12, { fill: colors.highlight });
    txt(ctx, colors, S.capR(c.rSpan), X0, CL.resBot + 12, { fill: colors.ink3 });
    ctx.restore();
  }

  const tFilt = stageT(anim, 2, count);
  if (tFilt > 0) {
    ctx.save(); ctx.globalAlpha = tFilt;
    const parts = [];
    if (params.notchHz !== "off" && !c.notchSkipped) parts.push(S.filterNotch(params.notchHz));
    if (params.lowHz !== "off" && !c.lowSkipped) parts.push(S.filterLow(params.lowHz));
    if (!parts.length) parts.push(S.filterNone);
    txt(ctx, colors, S.capFilter(parts), X0, CL.filtHead, { font: capFont(colors), fill: colors.ink1 });
    const sx0 = X1 - CL.specW, sx1 = X1;
    trace(ctx, c.filtered, X0, sx0 - 30, CL.filtTop, CL.filtBot, colors.empirical, 0.8);
    /* the power before and after, 0 to 80 Hz or to half the rate */
    txt(ctx, colors, S.capPower(fs), sx0, CL.filtHead, { fill: colors.ink1 });
    const sy = (v) => CL.filtBot - Math.max(0, Math.min(1, (v + 5) / 6)) * (CL.filtBot - CL.filtTop);
    const bins = c.specBefore.length, sx = (b) => sx0 + (b / (bins - 1)) * (sx1 - sx0);
    polyline(ctx, Array.from(c.specBefore, (_, b) => sx(b)), Array.from(c.specBefore, sy), colors.reference, 0.9);
    polyline(ctx, Array.from(c.specAfter, (_, b) => sx(b)), Array.from(c.specAfter, sy), colors.empirical, 1.1);
    line(ctx, sx0, CL.filtBot + 0.5, sx1, CL.filtBot + 0.5, colors.axis);
    const top = Math.min(80, fs / 2);
    for (const hz of [0, 40, 50, 60, 80]) if (hz <= top) { const xx = sx0 + (hz / top) * (sx1 - sx0); line(ctx, xx, CL.filtBot, xx, CL.filtBot + 4, colors.axis); txt(ctx, colors, String(hz), xx, CL.filtBot + 14, { font: monoFont(colors), align: "center", fill: colors.ink3 }); }
    txt(ctx, colors, S.capPowerBefore, sx1, CL.filtTop + 10, { align: "right", fill: colors.reference });
    txt(ctx, colors, S.capPowerAfter, sx1, CL.filtTop + 22, { align: "right", fill: colors.empirical });
    if (c.notchSkipped) txt(ctx, colors, S.capFolded(params.notchHz, c.lineAt, fs), X0, CL.filtBot + 14, { fill: colors.ink3 });
    else if (c.lowSkipped) txt(ctx, colors, S.capLowSkipped(params.lowHz, fs), X0, CL.filtBot + 14, { fill: colors.ink3 });
    ctx.restore();
  }

  const tDet = stageT(anim, 3, count);
  if (tDet > 0) {
    ctx.save(); ctx.globalAlpha = tDet;
    const name = params.trend === "wavelet" ? S.trendNames.wavelet(Number(params.level), M.levelHz(Number(params.level), fs)) : S.trendNames[params.trend];
    txt(ctx, colors, S.capDetrend(name), X0, CL.detHead, { font: capFont(colors), fill: colors.ink1 });
    trace(ctx, c.filtered, X0, X1, CL.detTop, CL.detBot, colors.empirical, 0.8);
    trace(ctx, c.trend, X0, X1, CL.detTop, CL.detBot, colors.theory, 1.5);
    trace(ctx, c.cleaned, X0, X1, CL.cleanTop, CL.cleanBot, colors.empirical, 0.8);
    txt(ctx, colors, S.capCleaned, X1, CL.cleanTop + 10, { align: "right", fill: colors.ink3 });
    ctx.restore();
  }
}

function drawWindow(ctx, colors, w, params, state, anim) {
  const X0 = PAD_L, X1 = w - PAD_R, s = state.shown, c = state.cleaned[s], evs = state.st[s].events, count = anim.n.window;
  const x = c.cleaned, T = x.length;
  txt(ctx, colors, S.capRecording(s + 1), X0, WN.recHead, { font: capFont(colors), fill: colors.ink1 });
  const px = trace(ctx, x, X0, X1, WN.recTop, WN.recBot, colors.empirical, 0.8);
  if (params.annotation === "event") {
    for (const [e0, e1] of evs) { const a = e0 / c.M, b = e1 / c.M; rect(ctx, px(a), WN.recTop, px(b) - px(a), WN.recBot - WN.recTop, wash(colors.event, 0.16)); }
    if (evs.length) txt(ctx, colors, S.capEvent, px(evs[0][0] / c.M) + 2, WN.recTop + 10, { fill: colors.event });
  } else {
    rect(ctx, X0, WN.recTop, X1 - X0, WN.recBot - WN.recTop, null, state.cls[s] ? colors.event : colors.nonevent, 1);
    txt(ctx, colors, S.capRecAnnot(state.cls[s]), X1 - 4, WN.recTop + 10, { align: "right", fill: state.cls[s] ? colors.event : colors.nonevent });
  }
  txt(ctx, colors, S.capLane(state.L, state.sec, state.step), X0, WN.laneHead, { font: capFont(colors), fill: colors.ink1 });
  const wins = state.windows.filter((v) => v.sub === s);
  const shown = Math.min(wins.length, count), tLast = ease(anim.t);
  for (let i = 0; i < shown; i++) {
    const v = wins[i], y = WN.laneTop + (i % 2) * WN.rowH, x0 = px(v.start), x1 = px(Math.min(T - 1, v.start + state.L - 1));
    const lab = state.y(v), col = lab ? colors.event : colors.nonevent, last = i === shown - 1 && anim.t < 1;
    const f = last ? tLast : 1;
    rect(ctx, x0, y, (x1 - x0) * f, WN.rowH - 3, wash(col, 0.22), last ? colors.highlight : col, last ? 1.5 : 1);
    if (f >= 1 || !last) txt(ctx, colors, S.winLetter(lab, params.annotation), (x0 + x1) / 2, y + 11, { align: "center", fill: colors.ink1 });
    if (last) rect(ctx, x0, WN.recTop, (x1 - x0) * f, WN.recBot - WN.recTop, null, colors.highlight, 1.2);
  }
  txt(ctx, colors, params.annotation === "recording" ? S.capLaneRec : params.rule === "any" ? S.capLaneAny : S.capLaneMaj, X0, WN.noteY, { fill: colors.ink2 });
}

function deckGeometry(w, state) {
  const X0 = PAD_L + SP.labelW, X1 = w - PAD_R, per = state.perSub;
  const cw = Math.max(2, (X1 - X0) / per);
  return { X0, X1, cw, cellOf: (v) => ({ x: X0 + (v.i % per) * cw, y: SP.deckTop + v.sub * (SP.rowH + SP.gap), w: cw, h: SP.rowH }) };
}

function drawSplit(ctx, colors, w, params, state, anim) {
  const { res, kind, pick } = state.split, count = anim.n.split, X0 = PAD_L, X1 = w - PAD_R;
  const g = deckGeometry(w, state), tDeal = stageT(anim, 1, count);
  const scored = Math.max(0, Math.min(res.matches.length, count - 1)), tScore = count >= 2 ? ease(anim.t) : 1;
  txt(ctx, colors, count >= 1 ? S.capDeck(state.windows.length, kind) : S.capDeckWait(state.windows.length), X0, SP.deckHead, { font: capFont(colors), fill: colors.ink1 });
  for (let s = 0; s < M.SUBJECTS; s++) {
    const heldRow = kind === "subject" && count >= 1 && [0, 1].includes(s);
    txt(ctx, colors, S.subjectRow(s + 1), g.X0 - 6, SP.deckTop + s * (SP.rowH + SP.gap) + 11, { align: "right", fill: heldRow ? colors.holdout : colors.ink2 });
  }
  const sweep = g.X0 + tDeal * (g.X1 - g.X0);
  const scoredSet = new Map(); for (let k = 0; k < scored; k++) scoredSet.set(res.matches[k].t.i, res.matches[k]);
  const current = scored >= 1 ? res.matches[scored - 1] : null;
  const drawn = scored >= 1 ? res.matches[Math.min(pick, scored) - 1] : null;
  const heldSet = new Set(res.test.map((v) => v.i));
  for (const v of state.windows) {
    const cell = g.cellOf(v), lab = state.y(v), col = lab ? colors.event : colors.nonevent;
    const held = count >= 1 && heldSet.has(v.i) && cell.x <= sweep;
    rect(ctx, cell.x, cell.y, cell.w - 1, cell.h, wash(col, held ? 0.12 : 0.5));
    if (held) rect(ctx, cell.x, cell.y, cell.w - 1, cell.h, null, colors.holdout, 1.2);
    const m = scoredSet.get(v.i);
    if (m) {
      const f = m === current ? tScore : 1, mc = state.y(m.at) ? colors.event : colors.nonevent;
      rect(ctx, cell.x + 2, cell.y + 3 + (cell.h - 6) * (1 - f) / 2, Math.max(1, cell.w - 5), (cell.h - 6) * f, mc);
    }
  }
  if (drawn) {
    const a = g.cellOf(drawn.t), b = g.cellOf(drawn.at);
    rect(ctx, a.x - 1, a.y - 1, a.w + 1, a.h + 2, null, colors.highlight, 2);
    rect(ctx, b.x - 1, b.y - 1, b.w + 1, b.h + 2, null, colors.reference, 2);
    line(ctx, a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, colors.highlight, 1, [3, 3]);
    txt(ctx, colors, S.capMatch(drawn.t.sub + 1, drawn.at.sub + 1, drawn.c, drawn.same), X0, SP.matchHead, { font: capFont(colors), fill: colors.ink1 });
    trace(ctx, drawn.at.zed, X0, X1, SP.matchTop, SP.matchBot, colors.reference, 1, Z_LO, Z_HI);
    trace(ctx, drawn.t.zed, X0, X1, SP.matchTop, SP.matchBot, colors.highlight, 1.3, Z_LO, Z_HI);
  } else {
    txt(ctx, colors, S.capMatchWait, X0, SP.matchHead, { fill: colors.ink3 });
  }
}

function drawNormalize(ctx, colors, w, params, state, anim) {
  const X0 = PAD_L, X1 = w - PAD_R, t = stageT(anim, 1, anim.n.normalize), amp = state.amp;
  txt(ctx, colors, t >= 1 ? S.capAmpAfter : S.capAmp, X0, NM.head, { font: capFont(colors), fill: colors.ink1 });
  /* the print block is right-aligned at the edge and the dots stop 360 px short of it: at 250 px from the edge the
     shape line ran 60 px off the canvas (the text sweep, 2026-09-20) */
  const colW = Math.min(40, (X1 - X0 - 360) / M.SUBJECTS), rmsMax = Math.max(1e-6, ...state.windows.map((v) => v.rms)) * 1.1;
  const yOf = (r) => NM.bot - (NM.bot - NM.top) * (r / rmsMax);
  const yAfter = yOf(rmsMax / 1.6);
  for (const v of state.windows) {
    const xx = X0 + 20 + v.sub * colW + ((v.i * 7) % 11) - 5, y0 = yOf(v.rms), y1 = yAfter;
    rect(ctx, xx, y0 + (y1 - y0) * t - 1, 3, 3, wash(colors.empirical, 0.6));
  }
  for (let s = 0; s < M.SUBJECTS; s++) txt(ctx, colors, String(s + 1), X0 + 20 + s * colW, NM.bot + 14, { align: "center", fill: colors.ink3 });
  line(ctx, X0 + 4, NM.bot + 0.5, X0 + 20 + M.SUBJECTS * colW, NM.bot + 0.5, colors.axis);
  if (t > 0) { ctx.save(); ctx.globalAlpha = t; line(ctx, X0 + 4, yAfter + 0.5, X0 + 20 + M.SUBJECTS * colW, yAfter + 0.5, colors.reference, 1, [3, 3]); txt(ctx, colors, S.capSd1, X0 + 24 + M.SUBJECTS * colW, yAfter + 4, { font: monoFont(colors), fill: colors.reference }); ctx.restore(); }
  txt(ctx, colors, S.capShape(state.windows.length, state.L), X1, NM.top + 14, { font: `600 ${colors.fsSm} ${colors.mono}`, fill: colors.ink1, align: "right" });
  txt(ctx, colors, S.capShapeNote(state.windows.length, state.L, state.sec, state.rate), X1, NM.top + 30, { fill: colors.ink2, align: "right" });
  txt(ctx, colors, S.capBatch(state.L), X1, NM.top + 54, { font: monoFont(colors), fill: colors.ink2, align: "right" });
}

/* ================================================================ widget */

defineWidget({
  slug: "signal-windows",
  status: "draft",
  title: "Deep Learning - Signal Windows",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.clean,

  params: {
    page: { type: "segmented", label: S.pageLabel, options: PAGES, default: "clean", display: true },

    recSec: { type: "section", label: S.recSection },
    noise: {
      type: "segmented", label: S.noiseLabel, detail: S.noiseDetail,
      options: [{ value: "none", label: "None" }, { value: "line", label: "Line" }, { value: "drift", label: "Drift" }, { value: "both", label: "Both" }], default: "both",
    },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },

    cleanSec: { type: "section", label: S.cleanSection, when: ON("clean") },
    rate: {
      type: "choice", label: S.rateLabel, detail: S.rateDetail,
      options: M.RATES.map((r) => ({ value: String(r), label: `${r} Hz`, detail: `M = ${M.FS / r}` })), default: "360", when: ON("clean"),
    },
    notchHz: {
      type: "segmented", label: S.notchLabel, detail: S.notchDetail,
      options: [{ value: "off", label: "Off" }, { value: "50", label: "50 Hz" }, { value: "60", label: "60 Hz" }], default: "50", when: ON("clean"),
    },
    lowHz: {
      type: "segmented", label: S.lowLabel, detail: S.lowDetail,
      options: [{ value: "40", label: "40 Hz" }, { value: "100", label: "100 Hz" }, { value: "off", label: "Off" }], default: "40", when: ON("clean"),
    },
    trend: {
      type: "segmented", label: S.trendLabel, detail: S.trendDetail,
      options: [{ value: "average", label: "Moving average" }, { value: "polynomial", label: "Polynomial" }, { value: "wavelet", label: "Wavelet" }], default: "wavelet", when: ON("clean"),
    },
    level: {
      type: "choice", label: S.levelLabel, detail: S.levelDetail,
      options: M.LEVELS.map((j) => ({ value: String(j), label: String(j) })), default: "8",
      when: { all: [ON("clean"), { param: "trend", equals: "wavelet" }] },
    },

    winSec: { type: "section", label: S.winSection, when: ON_WINDOWS },
    window: {
      type: "choice", label: S.windowLabel, detail: S.windowDetail,
      options: M.WINDOW_S.map((s) => ({ value: String(s), label: `${s} s` })), default: "1", when: ON_WINDOWS,
    },
    overlap: {
      type: "choice", label: S.overlapLabel, detail: S.overlapDetail,
      options: M.OVERLAPS.map((o) => ({ value: String(o * 100), label: `${o * 100}%` })), default: "50", when: ON_WINDOWS,
    },
    annotation: {
      type: "segmented", label: S.annotationLabel, detail: S.annotationDetail,
      options: [{ value: "recording", label: "Recording" }, { value: "event", label: "Event" }], default: "recording", when: ON_WINDOWS,
    },
    rule: {
      type: "segmented", label: S.ruleLabel, detail: S.ruleDetail,
      options: [{ value: "any", label: "Any overlap" }, { value: "half", label: "More than half" }], default: "half",
      when: { all: [ON_WINDOWS, { param: "annotation", equals: "event" }] },
    },

    splitSec: { type: "section", label: S.splitSection, when: ON("split") },
    split: {
      type: "segmented", label: S.splitLabel, detail: S.splitDetail,
      options: [{ value: "window", label: "By window" }, { value: "subject", label: "By subject" }], default: "window", when: ON("split"),
    },

    lookSec: { type: "section", label: S.lookSection, afterDrive: true, when: ON_SUBJECT },
    subject: {
      type: "choice", label: S.subjectLabel, detail: S.subjectDetail,
      options: Array.from({ length: M.SUBJECTS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      default: "2", display: true, afterDrive: true, when: ON_SUBJECT,
    },
    lookSplit: { type: "section", label: S.lookSection, afterDrive: true, when: ON("split") },
    pick: { type: "int", label: S.pickLabel, detail: S.pickDetail, min: 1, max: PICK_MAX, default: 1, display: true, afterDrive: true, when: ON("split") },

    /* authoring escape hatch, first render only: presses already taken on the page it opens with */
    shown: { type: "int", min: 0, max: 999, default: 0, hidden: true },
  },

  legend: ({ params }) => S.legend[params.page] ?? S.legend.clean,

  compute,

  regions: ({ w, params, state, anim }) => {
    if (!state || params.page !== "split" || (anim?.n?.split ?? 0) < 1) return [];
    const g = deckGeometry(w, state);
    return state.split.res.matches.map((m, k) => { const c = g.cellOf(m.t); return { x: c.x, y: c.y, w: c.w, h: c.h, set: { pick: k + 1 }, label: `held-out window ${k + 1}` }; });
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: S.stepLabels, default: S.stepLabels.clean0 },
    stepTitle: { anim: "labelAt", labels: S.stepTitles, default: S.stepTitles.clean0 },
    runLabel: "Play",
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const shown = fromScratch ? 0 : Math.max(0, Number(params.shown) || 0);
      const anim = { page: params.page, n: { clean: 0, window: 0, split: 0, normalize: 0 }, t: 1, moving: false, halt: false };
      anim.n[params.page] = Math.min(stagesOf(params.page, state), shown);
      anim.done = isDone(anim, state);
      settle(anim);
      return anim;
    },

    advance: (anim, { dt, state }) => {
      /* a press a page switch finished (`rebuild`) ends here, before it takes the new page's press */
      if (anim.halt) { anim.halt = false; anim.moving = false; settle(anim); return false; }
      const stepping = anim.mode === "step";
      const before = anim.n[anim.page];
      let more = takePress(anim, dt, state);
      const after = anim.n[anim.page];
      anim.done = isDone(anim, state);
      if (stepping && after > before) anim.pressEnd = after;
      if (stepping && anim.pressEnd != null && after >= anim.pressEnd && anim.t >= 1) { more = false; anim.pressEnd = null; }
      if (anim.done) more = false;
      anim.moving = more;
      settle(anim);
      return more;
    },

    rebuild: (anim, { params, state }) => {
      /* a press belongs to the page it started on (the 2026-09-20 sweep): the press finishes here and the loop
         ends at its next frame */
      if (anim.moving && params.page !== anim.page) { anim.t = 1; anim.halt = true; anim.pressEnd = null; }
      anim.page = params.page;
      anim.n[anim.page] = Math.min(anim.n[anim.page], stagesOf(anim.page, state));
      anim.done = isDone(anim, state);
      settle(anim);
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    if (params.page === "window") drawWindow(ctx, colors, w, params, state, anim);
    else if (params.page === "split") drawSplit(ctx, colors, w, params, state, anim);
    else if (params.page === "normalize") drawNormalize(ctx, colors, w, params, state, anim);
    else drawClean(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    const pctOf = (v) => `${Math.round(100 * v)}%`;
    if (params.page === "window") {
      const ones = state.windows.filter((v) => state.y(v)).length;
      return [
        { label: S.tileWindows, value: String(state.windows.length), note: S.tileWindowsNote(state.perSub, M.SUBJECTS) },
        { label: S.tileReach, value: (params.rule === "any" ? state.counts.any : state.counts.maj).toFixed(1), note: S.tileReachNote(params.rule) },
        { label: S.tileOnes, value: pctOf(ones / state.windows.length), note: S.tileOnesNote(params.annotation) },
      ];
    }
    if (params.page === "split") {
      const { both, res } = state.split, count = anim?.n?.split ?? 0, n = res.matches.length;
      const scored = Math.max(0, Math.min(n, count - 1)), done = scored >= n && (anim?.t ?? 1) >= 1;
      const sofar = scored ? res.matches.slice(0, scored) : [];
      const accSoFar = sofar.length ? sofar.filter((m) => m.ok).length / sofar.length : null;
      const sameSoFar = sofar.length ? sofar.filter((m) => m.same).length / sofar.length : null;
      const mine = params.split === "window" ? "window" : "subject", other = mine === "window" ? "subject" : "window";
      const tile = (k, v, note) => ({ label: k === "window" ? S.tileByWindow : S.tileBySubject, value: v, note });
      return [
        tile(mine, done ? pctOf(res.acc) : accSoFar == null ? S.tileWait : pctOf(accSoFar), done ? S.tileAccNote(n) : S.tileSoFar(scored, n)),
        tile(other, done ? pctOf(both[other].acc) : S.tileWait, S.tileAccNote(both[other].matches.length)),
        { label: S.tileSame, value: sameSoFar == null ? S.tileWait : pctOf(sameSoFar), note: S.tileSameNote },
      ];
    }
    if (params.page === "normalize") {
      const after = (anim?.n?.normalize ?? 0) >= 1 && (anim?.t ?? 1) >= 1;
      return [
        { label: S.tileCv, value: after ? "0%" : pctOf(state.amp.cv), note: S.tileCvNote },
        { label: S.tileShape, value: `[${state.windows.length}, 1, ${state.L}]`, note: S.tileShapeNote },
      ];
    }
    const c = state.clean, count = anim?.n?.clean ?? 0, t = anim?.t ?? 1;
    return [
      { label: S.tileRate, value: `${c.rate} Hz`, note: S.tileRateNote(c.M) },
      { label: S.tileLine, value: count >= 2 && t >= 1 ? (c.lineLeft == null ? S.tileNone : pctOf(c.lineLeft)) : S.tileWait, note: S.tileLineNote },
      { label: S.tileDrift, value: count >= 3 && t >= 1 ? (c.driftLeft == null ? S.tileNone : pctOf(c.driftLeft)) : S.tileWait, note: S.tileDriftNote },
    ];
  },

  summary({ params, state, anim }) {
    const n = anim?.n?.[params.page] ?? 0;
    if (params.page === "window") return S.sum.window(n, state.perSub);
    if (params.page === "split") return S.sum.split(n, state.split.res.matches.length);
    if (params.page === "normalize") return S.sum.normalize(n);
    return S.sum.clean(n);
  },
});
