/* ============================================================================
   Widget 72 · Deep Learning - Signal Windows — the arithmetic, and nothing
   that draws.

   PHM5005 07-2 cells 1–21: the cleaning of a raw recording (resample, filter,
   detrend), its segmentation into windows and the label each window inherits,
   the split's unit, and per-window normalisation. `_lab/signal-windows-
   measure.mjs` measured every number a comment here quotes, and
   `_lab/signal-windows-mock.html` computed the cleaning on its page
   (2026-09-20); the stage is lifted from the two.

   THE STAGE. Eight subjects, each a 20 s recording at 360 Hz in a morphology
   of their own — rate, amplitude, QRS width, T wave, a slow wander — carrying
   BOTH annotations of the lesson's figure: a RECORDING annotation (the rhythm,
   regular or irregular, one label for the whole recording; what a fragment's
   class is when it comes from a record) and EVENT annotations (each ectopic
   beat, an interval of 80 samples). Which one becomes the window's label is
   the reader's choice, and the split is scored on that label.

   THE CLAIM THE SPLIT PAGE SHOWS, measured: with the recording label a
   nearest neighbour scores 59 → 87% under a window-level split as the overlap
   goes 0 → 75%, and chance under a subject-level one at every window length
   — the class is not learnable from a window, and the window-level number is
   the subject. With the event label both splits agree (87–98%): the beat
   looks alike across subjects. The scorer is the simplest model there is —
   each held-out window takes the label of the most similar training window,
   correlation at the best shift — so the mechanism can be drawn.

   THE CLEANING. Resample is the lesson's x'[n] = x[nM]. Filter is a notch and
   a low-pass as second-order sections run forward and backward (so nothing
   shifts); the lesson's band-pass 0.5–40 Hz was measured to remove the drift
   by itself, which would leave Detrend nothing to do, so the drift is
   Detrend's. Detrend subtracts one of the lesson's three trends: a moving
   average, a polynomial, or the approximation A_j of a db4 wavelet
   decomposition (A_8 leaves 2% of a 0.25 Hz drift at 360 Hz, A_9 18%,
   A_10 79% — measured on the mock).
   ========================================================================= */

import { makeRng } from "../core/rng.js";

export const FS = 360;                 // Hz, the recordings' own rate
export const SUBJECTS = 8;
export const SECONDS = 20;
export const T_REC = FS * SECONDS;     // 7,200 samples
export const EVENT_HALF = 40;          // samples at 360 Hz either side of an ectopic beat
export const LINE_HZ = 50, DRIFT_HZ = 0.25;
export const RATES = [360, 180, 90];   // the lesson's x'[n] = x[nM], M = 1, 2, 4
export const WINDOW_S = [1, 2, 4];
export const OVERLAPS = [0, 0.5, 0.75];
export const LEVELS = [7, 8, 9, 10];
export const MA_SECONDS = 2, POLY_DEGREE = 5;

/** what each Noise setting adds to a recording */
export const NOISE = {
  none: { line: 0, white: 0, drift: 0 },
  line: { line: 0.12, white: 0.06, drift: 0 },
  drift: { line: 0, white: 0, drift: 0.45 },
  both: { line: 0.12, white: 0.06, drift: 0.45 },
};

const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
const rms = (a) => Math.sqrt(mean(a.map((v) => v * v)));
export const zscore = (a) => { const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; const sd = Math.sqrt(s / a.length) || 1; return a.map((v) => (v - m) / sd); };

/* ------------------------------------------------------------ the stage --- */

/** One subject: a morphology of their own, and the rhythm that is the recording annotation. */
export function subject(rng, s, cls) {
  return {
    s, cls,
    period: 130 + Math.floor(rng.next() * 70),      // 108–166 bpm at 360 Hz
    amp: 0.6 + rng.next() * 1.0,
    width: 3 + Math.floor(rng.next() * 3),           // the R wave's half width in samples
    tAmp: 0.1 + rng.next() * 0.25,
    tLag: 40 + Math.floor(rng.next() * 30),
    wanderF: 400 + rng.next() * 400, wanderA: 0.05 + rng.next() * 0.1, wanderP: rng.next() * 6.28,
    jitter: cls === 1 ? 0.30 : 0.03,                 // class 1: an irregular RR interval
    q: 0.12,                                          // the fraction of beats that are ectopic — the event annotations
  };
}

/** The clean recording of one subject at 360 Hz, and its event annotations as [start, end] intervals. */
export function record(rng, sub) {
  const T = T_REC, x = new Float64Array(T), events = [];
  for (let t = Math.floor(rng.next() * sub.period); t < T;) {
    if (rng.next() < sub.q) {
      for (let d = -EVENT_HALF; d <= EVENT_HALF; d++) if (t + d >= 0 && t + d < T) x[t + d] += sub.amp * (1.3 * Math.exp(-(d * d) / (2 * 11 * 11)) - 0.35 * Math.exp(-((d - 26) ** 2) / (2 * 9 * 9)));
      events.push([Math.max(0, t - EVENT_HALF), Math.min(T, t + EVENT_HALF)]);
    } else {
      const w = sub.width;
      for (let d = -w; d <= w; d++) if (t + d >= 0 && t + d < T) x[t + d] += sub.amp * (1 - Math.abs(d) / (w + 1));
      for (let d = -w - 5; d < -w; d++) if (t + d >= 0) x[t + d] -= 0.12 * sub.amp;
      for (let d = w + 1; d < w + 9; d++) if (t + d < T) x[t + d] -= 0.18 * sub.amp;
      for (let d = sub.tLag; d < sub.tLag + 50; d++) if (t + d < T) x[t + d] += sub.tAmp * sub.amp * Math.sin(Math.PI * (d - sub.tLag) / 50);
    }
    t += Math.max(60, Math.round(sub.period * (1 + sub.jitter * rng.normal())));
  }
  for (let t = 0; t < T; t++) x[t] += rng.normal(0, 0.03) + sub.wanderA * Math.sin(2 * Math.PI * t / sub.wanderF + sub.wanderP);
  return { x, events };
}

/** The contamination the lesson names, added: line noise, white noise, a respiratory drift. Returns the raw trace and the drift alone. */
export function contaminate(rng, x, kind) {
  const n = NOISE[kind] ?? NOISE.none, T = x.length, raw = new Float64Array(T), drift = new Float64Array(T);
  const phase = rng.next() * 2 * Math.PI;
  for (let t = 0; t < T; t++) {
    drift[t] = n.drift * Math.sin(2 * Math.PI * DRIFT_HZ * t / FS + phase);
    raw[t] = x[t] + n.line * Math.sin(2 * Math.PI * LINE_HZ * t / FS) + (n.white ? rng.normal(0, n.white) : 0) + drift[t];
  }
  return { raw, drift };
}

/** The eight subjects, their clean recordings and their raw ones, from the seed. */
export function stage(seed, noise) {
  const rng = makeRng(seed * 11 + 1);
  const subjects = Array.from({ length: SUBJECTS }, (_, s) => subject(rng, s, s % 2));
  const recs = subjects.map((sub) => record(rng, sub));
  const rngN = makeRng(seed * 11 + 2);
  return subjects.map((sub, s) => ({ sub, events: recs[s].events, clean: recs[s].x, ...contaminate(rngN, recs[s].x, noise) }));
}

/* --------------------------------------------------------- the cleaning --- */

/** The lesson's resampling: x'[n] = x[nM]. */
export function decimate(x, M) { const out = new Float64Array(Math.ceil(x.length / M)); for (let i = 0; i < out.length; i++) out[i] = x[i * M]; return out; }

/** Second-order sections in the cookbook forms; null when f0 is not below the rate's Nyquist. */
export function biquad(type, f0, Q, fs) {
  if (!(f0 < fs / 2)) return null;
  const w = 2 * Math.PI * f0 / fs, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = 1; b1 = -2 * cs; b2 = 1; }
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, -2 * cs / a0, (1 - al) / a0];
}
export function runSection(x, c) {
  const [b0, b1, b2, a1, a2] = c, y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** forward, then backward over the reversed output: twice the order, no phase shift */
export function filtfilt(x, c) { if (!c) return Float64Array.from(x); const f = runSection(x, c); f.reverse(); const b = runSection(f, c); b.reverse(); return b; }
export const notch = (x, f0, fs) => filtfilt(x, biquad("notch", f0, 30, fs));
export const lowpass = (x, f0, fs) => filtfilt(x, biquad("lp", f0, Math.SQRT1_2, fs));
export const highpass = (x, f0, fs) => filtfilt(x, biquad("hp", f0, Math.SQRT1_2, fs));

/** where a tone at `hz` lands after sampling at `fs` — a line above Nyquist folds down */
export function folded(hz, fs) { const r = hz % fs; return Math.min(r, fs - r); }

/** a centred moving average of `w` samples, by prefix sums */
export function movingAverage(x, w) {
  const n = x.length, ps = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + x[i];
  const out = new Float64Array(n), h = w >> 1;
  for (let t = 0; t < n; t++) { const a = Math.max(0, t - h), b = Math.min(n, t + h); out[t] = (ps[b] - ps[a]) / (b - a); }
  return out;
}

/** a least-squares polynomial of degree `deg` in time, over the whole recording */
export function polyTrend(x, deg) {
  const n = x.length, m = deg + 1, A = Array.from({ length: m }, () => new Float64Array(m + 1));
  const u = (t) => (2 * t / (n - 1)) - 1;
  for (let t = 0; t < n; t++) {
    const p = [1]; for (let k = 1; k < m; k++) p.push(p[k - 1] * u(t));
    for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) A[i][j] += p[i] * p[j]; A[i][m] += p[i] * x[t]; }
  }
  for (let i = 0; i < m; i++) {
    let piv = i; for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    for (let r = 0; r < m; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c]; }
  }
  const coef = A.map((row, i) => row[m] / row[i]);
  const out = new Float64Array(n);
  for (let t = 0; t < n; t++) { let v = 0, p = 1; for (let k = 0; k < m; k++) { v += coef[k] * p; p *= u(t); } out[t] = v; }
  return out;
}

/* db4, periodised. Analysis a[i] = Σ h[k] x[2i + k], d[i] = Σ g[k] x[2i + k];
   the operator is orthogonal, so synthesis is its transpose. */
const H8 = [0.2303778133088965, 0.7148465705529157, 0.6308807679298589, -0.027983769416859854, -0.18703481171909309, 0.030841381835560764, 0.03288301166688519, -0.010597401785069032];
const G8 = H8.map((_, k) => (k % 2 ? -1 : 1) * H8[H8.length - 1 - k]);
export function dwt(x) {
  const n = x.length, h = n >> 1, a = new Float64Array(h), d = new Float64Array(h);
  for (let i = 0; i < h; i++) for (let k = 0; k < 8; k++) { const v = x[(2 * i + k) % n]; a[i] += H8[k] * v; d[i] += G8[k] * v; }
  return { a, d };
}
export function idwt(a, d) {
  const h = a.length, n = 2 * h, x = new Float64Array(n);
  for (let i = 0; i < h; i++) for (let k = 0; k < 8; k++) x[(2 * i + k) % n] += a[i] * H8[k] + (d ? d[i] * G8[k] : 0);
  return x;
}
/**
 * The approximation A_J of `x`: the trace is reflected out to a power of two,
 * a ramp between its ends is taken out so the periodic wrap meets no step,
 * decomposed J levels, and rebuilt from the coarsest approximation alone.
 * Returns A_J on the original length, and the detail reconstructions D_1 … D_J
 * when asked (a page draws them).
 */
export function wavelet(x, J, { details = false } = {}) {
  const n0 = x.length; let n = 1; while (n < n0) n *= 2;
  const y = new Float64Array(n);
  for (let t = 0; t < n; t++) y[t] = t < n0 ? x[t] : x[Math.max(0, 2 * n0 - 2 - t)];
  /* the ends are read ONCE: the loop below rewrites y[0] first, and a ramp read live from the array ran to zero
     (the first draft; the residual grew along the record) */
  const y0 = y[0], y1 = y[n - 1];
  const ramp = (t) => y0 + (y1 - y0) * t / (n - 1);
  for (let t = 0; t < n; t++) y[t] -= ramp(t);
  const ds = []; let a = y;
  for (let j = 0; j < J; j++) { const r = dwt(a); ds.push(r.d); a = r.a; }
  let A = a; for (let j = J - 1; j >= 0; j--) A = idwt(A, null);
  const out = { A: Float64Array.from({ length: n0 }, (_, t) => A[t] + ramp(t)) };
  if (details) {
    out.D = ds.map((d, jj) => { let v = idwt(new Float64Array(d.length), d); for (let j = jj - 1; j >= 0; j--) v = idwt(v, null); return v.slice(0, n0); });
    let full = a; for (let j = J - 1; j >= 0; j--) full = idwt(full, ds[j]);
    let err = 0; for (let t = 0; t < n; t++) err = Math.max(err, Math.abs(full[t] - y[t]));
    out.err = err;
  }
  return out;
}

/** what is slower than A_j at a rate: the approximation's edge, in Hz */
export const levelHz = (J, fs) => fs / 2 ** (J + 1);

/**
 * The cleaning of one raw recording, every stage kept so a page can draw
 * each: resampled at `rate`, filtered by `notchHz` (or "off") and `lowHz`
 * (or "off"), and detrended by `trend` (`ma` · `poly` · `wavelet` at `level`).
 * A filter whose frequency is not below the rate's Nyquist is skipped and
 * said: at 90 Hz the 50 Hz line has already folded to 40 Hz.
 */
export function clean(raw, { rate, notchHz, lowHz, trend, level }) {
  const M = FS / rate;
  const resampled = decimate(raw, M);
  const notchOn = notchHz !== "off" && Number(notchHz) < rate / 2, lowOn = lowHz !== "off" && Number(lowHz) < rate / 2;
  let filtered = notchOn ? notch(resampled, Number(notchHz), rate) : Float64Array.from(resampled);
  if (lowOn) filtered = lowpass(filtered, Number(lowHz), rate);
  const tr = trend === "ma" ? movingAverage(filtered, MA_SECONDS * rate) : trend === "poly" ? polyTrend(filtered, POLY_DEGREE) : wavelet(filtered, level).A;
  const cleaned = new Float64Array(filtered.length);
  for (let t = 0; t < cleaned.length; t++) cleaned[t] = filtered[t] - tr[t];
  return {
    rate, M, resampled, filtered, trend: tr, cleaned,
    notchSkipped: notchHz !== "off" && !notchOn, lowSkipped: lowHz !== "off" && !lowOn,
    lineAt: folded(LINE_HZ, rate),
  };
}

/** power at one frequency, by Goertzel, on the first `n` samples — for the readout's "line left" */
export function powerAt(x, hz, fs, n = 2048) {
  const k = Math.round(hz * n / fs), w = 2 * Math.PI * k / n, c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let t = 0; t < Math.min(n, x.length); t++) { s0 = x[t] + c * s1 - s2; s2 = s1; s1 = s0; }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / n;
}

/** how much of the drift survives: the RMS of what is slower than 0.4 Hz, against the drift added */
export function driftLeft(x, drift, fs) {
  const d = rms(Array.from(drift));
  if (d < 1e-9) return null;
  const slow = lowpass(x, 0.4, fs);
  return rms(Array.from(slow)) / d;
}

/* --------------------------------------------------------- the windows --- */

/**
 * Cut every subject's cleaned recording into windows of `L` samples at
 * `overlap`; each window carries the subject, both labels, and its z-scored
 * samples (the lesson's `normalize`). Event intervals are in 360 Hz samples
 * and are read at the recording's rate.
 */
export function windowed(cleaned, events, { L, overlap }) {
  const step = Math.max(1, Math.round(L * (1 - overlap))), out = [];
  cleaned.forEach((rec, s) => {
    const M = rec.M, x = rec.cleaned;
    for (let a = 0; a + L <= x.length; a += step) {
      const raw = Array.from(x.slice(a, a + L));
      let any = 0, maj = 0;
      for (const [e0, e1] of events[s]) {
        const f0 = e0 / M, f1 = e1 / M, ov = Math.max(0, Math.min(a + L, f1) - Math.max(a, f0));
        if (ov > 0) any = 1; if (ov > (f1 - f0) / 2) maj = 1;
      }
      const zed = zscore(raw);
      out.push({ sub: s, i: out.length, start: a, raw, zed, half: zed.filter((_, i) => i % 2 === 0), rms: rms(raw), yAny: any, yMaj: maj });
    }
  });
  return { windows: out, step };
}

/** the label a window carries under the reader's annotation choice */
export const labelOf = (w, cls, annotation, rule) => (annotation === "recording" ? cls[w.sub] : rule === "any" ? w.yAny : w.yMaj);

/** how many windows one event is labelled onto, on average, under each rule; and how many events there are */
export function eventCounts(events, M, L, step, T) {
  let any = 0, maj = 0, n = 0;
  for (const evs of events) for (const [e0, e1] of evs) {
    n++;
    const f0 = e0 / M, f1 = e1 / M;
    for (let a = 0; a + L <= T; a += step) { const ov = Math.max(0, Math.min(a + L, f1) - Math.max(a, f0)); if (ov > 0) any++; if (ov > (f1 - f0) / 2) maj++; }
  }
  return { n, any: n ? any / n : 0, maj: n ? maj / n : 0 };
}

/* ----------------------------------------------------------- the split --- */

/** by window: a random fifth held out (the lesson's `train_test_split`) */
export function splitByWindow(rng, windows) {
  const idx = windows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const held = new Set(idx.slice(0, Math.round(idx.length / 5)));
  return { kind: "window", held: (w) => held.has(w.i), heldSubjects: [] };
}
/** by subject: one subject of each class held out, every window of theirs */
export function splitBySubject(windows, subjects = [0, 1]) {
  const held = new Set(subjects);
  return { kind: "subject", held: (w) => held.has(w.sub), heldSubjects: subjects };
}

/** correlation at the best shift, on the half-rate windows, shifts up to a quarter of the window */
export function lagCorr(a, b) {
  const n = a.length, maxLag = n >> 2; let best = -2, at = 0;
  for (let lag = -maxLag; lag <= maxLag; lag += 3) {
    let s = 0, c = 0;
    for (let i = Math.max(0, -lag); i < Math.min(n, n - lag); i++) { s += a[i] * b[i + lag]; c++; }
    const v = (s / c) * Math.sqrt(c / n);
    if (v > best) { best = v; at = lag; }
  }
  return { c: best, lag: at };
}
export function nearest(train, t) {
  let best = -Infinity, at = null, lag = 0;
  for (const tr of train) { const r = lagCorr(tr.half, t.half); if (r.c > best) { best = r.c; at = tr; lag = r.lag; } }
  return { at, c: best, lag: 2 * lag };
}
/**
 * Score a split: every held-out window's nearest training window, in the
 * order the windows lie (subject by subject). Returns the matches, the
 * accuracy under `y`, and how often the match is the same subject.
 */
export function score(windows, split, y) {
  const train = windows.filter((w) => !split.held(w)), test = windows.filter((w) => split.held(w));
  const matches = test.map((t) => { const m = nearest(train, t); return { t, at: m.at, c: m.c, lag: m.lag, ok: y(m.at) === y(t), same: m.at.sub === t.sub }; });
  const acc = matches.length ? matches.filter((m) => m.ok).length / matches.length : 0;
  const same = matches.length ? matches.filter((m) => m.same).length / matches.length : 0;
  return { train, test, matches, acc, same };
}

/** per-subject mean RMS amplitude of the windows, before and after z-scoring, and the spread between subjects */
export function amplitudes(windows) {
  const per = Array.from({ length: SUBJECTS }, (_, s) => { const ws = windows.filter((w) => w.sub === s); return ws.length ? mean(ws.map((w) => w.rms)) : 0; });
  const m = mean(per), cv = m ? Math.sqrt(mean(per.map((v) => (v - m) ** 2))) / m : 0;
  return { per, cv };
}
