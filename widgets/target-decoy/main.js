/* target-decoy — slot 88, "Proteomics: Identification". DRAFT 2026-10-05.
 *
 * Planned in the catalogue's § The proteomics and metabolomics arc and
 * § Slot 88: measured in `_lab/proteomics-arc-measure.mjs`, mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/target-decoy-mock.html`, sixteen
 * picks, every one the recommendation. The ones that shape this file:
 *   1. two pages, Score · Proteins (01-1 cell 2's two figures, in order);
 *   2. the score is COMPUTED by a search (engine.js), because the lesson's
 *      figure is a chain — target and reversed decoy database, spectra
 *      matched, a histogram of target and decoy PSMs;
 *   3. the histogram overlaid as the figure draws it: targets filled, the
 *      decoys an outline over them, so under True identity the outline sits
 *      on the wrong targets — which is the method;
 *   4. a Threshold slider in whole ions, the ≤ 1% and ≤ 5% points marked;
 *   5. three bands always: the database, the current spectrum against its
 *      best target and best decoy, the histogram; the last spectrum stays,
 *      and hovering a bin shows one of its spectra;
 *   6. True identity Off · On, off by default — a real search sees targets
 *      and decoys only;
 *   7. the Proteins page is the protein figure's own case, a press a stage.
 * The readout says what a match AT the threshold is worth beside what the
 * list's rate is (the arc's measurement: at q 5% the last tenth accepted is
 * 27% wrong), because "1% FDR" read as each match's confidence is the
 * misconception the widget is for.
 */
import { defineWidget, fmt } from "../core/index.js";
import { search, fragments, onPeak, binCounts, aboveFrom, levelThreshold, inferProteins, FIGURE, SEARCH } from "./engine.js";

const MAXS = 30;                  // the histogram's last bin holds 30 ions and above
const H_SCORE = 600, H_PROT = 380;
const STEP_MS = 650;              // one stage of the Proteins page
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;
const n0 = (v) => v.toLocaleString("en-US");

/* ------------------------------------------------------------ the search's clock
   The first three spectra are read: each one's ions tick onto its peaks in
   m/z order, then its PSM falls into its bin. The next seventeen arrive
   whole and fall. The rest pile in over about three seconds (2026-10-05 pick:
   "the first spectra slow, each drawn in the middle band, then faster"). */
const SLOW = 3, SLOW_MS = 1500, MID = 20, MID_MS = 220, FAST_MS = 2800;
const TICK_END = 0.55, FALL_FROM = 0.7;  // phases of a slow spectrum
function schedule(N) {
  const end = new Array(N);
  let t = 0;
  const fastEach = FAST_MS / Math.max(1, N - MID);
  for (let i = 0; i < N; i += 1) {
    t += i < SLOW ? SLOW_MS : i < MID ? MID_MS : fastEach;
    end[i] = t;
  }
  return end;
}
const durOf = (i, end) => end[i] - (i ? end[i - 1] : 0);
function arrivedBy(end, t) {               // how many spectra are in the histogram at time t
  let lo = 0, hi = end.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (end[mid] <= t) lo = mid + 1; else hi = mid; }
  return lo;
}
function niceMax(v) {
  for (const s of [5, 10, 20, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000]) if (s >= v * 1.08) return s;
  return Math.ceil(v * 1.08);
}
const maxBin = (c) => Math.max(1, ...c.map((b) => Math.max(b.correct + b.wrong, b.decoy)));

/* ------------------------------------------------------------ geometry (5.8) */
const LABEL_W = 116, RIGHT = 16;
function scoreLayout(w) {
  return {
    db: { y: 8, h: 78 },
    sp: { y: 94, h: 170, x0: LABEL_W, x1: w - RIGHT },
    hist: { y: 276, top: 326, base: 540, x0: 56, x1: w - RIGHT },
  };
}
const binW = (L) => (L.hist.x1 - L.hist.x0) / (MAXS + 1);
const binX = (L, s) => L.hist.x0 + s * binW(L);
function binAt(L, pointer) {
  if (!pointer) return null;
  const { x, y } = pointer;
  if (y < L.hist.top - 10 || y > L.hist.base + 4 || x < L.hist.x0 || x >= L.hist.x1) return null;
  return Math.min(MAXS, Math.floor((x - L.hist.x0) / binW(L)));
}

/* the press state: what the button says next, and whether the page is done */
function settle(anim, page, state) {
  const N = state.psms.length;
  if (page === "score") {
    anim.done = anim.k >= N;
    anim.labelAt = anim.k === 0 && anim.t === 0 ? "search" : anim.done ? "searched" : "searching";
  } else {
    anim.done = anim.n >= 4 && anim.p >= 1;
    anim.labelAt = anim.done ? "pdone" : `p${anim.n}`;
  }
}
function finishSearch(anim, state) {
  anim.t = state.end[state.end.length - 1] ?? 0;
  anim.k = state.psms.length;
  anim.y = niceMax(maxBin(binCounts(state.psms, anim.k, MAXS)));
}

function advanceBody(anim, dt, params, state) {
  if (params.page === "score") {
    const total = state.end[state.end.length - 1] ?? 0;
    if (anim.t >= total) { settle(anim, "score", state); return false; }
    anim.t = Math.min(total, anim.t + dt);
    anim.k = arrivedBy(state.end, anim.t);
    /* the count axis ratchets up, eased, so the first arrivals are visible and
       the bars move rather than jump when it grows */
    const target = niceMax(maxBin(binCounts(state.psms, anim.k, MAXS)));
    if (target > anim.y) anim.y = anim.y + (target - anim.y) * Math.min(1, dt / 180);
    if (anim.t >= total) anim.y = target;
    settle(anim, "score", state);
    return anim.t < total;
  }
  if (anim.p >= 1) {
    if (anim.n >= 4) { settle(anim, "proteins", state); return false; }
    anim.n += 1; anim.p = 0;
  }
  anim.p = Math.min(1, anim.p + dt / STEP_MS);
  settle(anim, "proteins", state);
  return anim.p < 1;
}

/* ------------------------------------------------------------ drawing */
function txt(ctx, colors, s, x, y, { size = "fsSm", colour = colors.ink2, align = "left", weight = "", mono = false } = {}) {
  ctx.font = `${weight ? weight + " " : ""}${colors[size] ?? size} ${mono ? colors.mono : colors.font}`;
  ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}
function rule(ctx, colors, x1, y1, x2, y2, colour, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

function drawDatabase(ctx, colors, w, L, state, psm) {
  const { y } = L.db;
  txt(ctx, colors, "The database", 12, y + 12, { colour: colors.ink1, weight: "600" });
  txt(ctx, colors, `${n0(state.targets)} target peptides and ${n0(state.decoys)} decoy peptides, searched together`, w - RIGHT, y + 12, { size: "fsXs", colour: colors.ink3, align: "right" });
  const pep = psm?.bestT?.p;
  const x0 = LABEL_W, cw = 7;
  const win = Math.max(20, Math.floor((w - RIGHT - x0) / cw));
  txt(ctx, colors, "target", x0 - 10, y + 36, { size: "fsXs", colour: colors.empirical, align: "right", weight: "600" });
  txt(ctx, colors, "decoy, reversed", x0 - 10, y + 56, { size: "fsXs", colour: colors.ink3, align: "right", weight: "600" });
  if (!pep) {
    txt(ctx, colors, psm ? "no target peptide within the precursor window" : "every protein, digested by trypsin", x0, y + 36, { size: "fsXs", colour: colors.ink3 });
    txt(ctx, colors, psm ? "" : "every protein reversed, digested the same way", x0, y + 56, { size: "fsXs", colour: colors.ink3 });
    return;
  }
  // where the best TARGET candidate sits: the search knows its candidates, not the spectrum's source
  const prot = state.prot.find((x) => x.includes(pep));
  const at = prot.indexOf(pep);
  const s0 = Math.max(0, Math.min(prot.length - win, at - Math.floor((win - pep.length) / 2)));
  const stretch = prot.slice(s0, s0 + win);
  const rev = [...stretch].reverse().join("");
  const seq = (str, yy, from, len, col) => {
    ctx.font = `11px ${colors.mono}`; ctx.textAlign = "left";
    [...str].forEach((ch, i) => {
      const on = i >= from && i < from + len;
      ctx.font = `${on ? "700 " : ""}11px ${colors.mono}`;
      ctx.fillStyle = on ? col : colors.ink3;
      ctx.fillText(ch, x0 + i * cw, yy);
    });
  };
  seq(stretch, y + 36, at - s0, pep.length, colors.empirical);
  seq(rev, y + 56, stretch.length - (at - s0) - pep.length, pep.length, colors.ink1);
  txt(ctx, colors, "the best target candidate, and the same residues reversed", x0, y + 74, { size: "fsXs", colour: colors.ink3 });
}

function peakHeight(i, m) { const r = Math.sin(i * 12.9898 + m * 0.37) * 43758.5453; return 0.3 + 0.7 * (r - Math.floor(r)); }

function drawSpectrum(ctx, colors, w, L, psm, phase, caption, truth) {
  const { y, x0, x1 } = L.sp;
  txt(ctx, colors, "The spectrum, against its best target and best decoy", 12, y + 12, { colour: colors.ink1, weight: "600" });
  if (caption) txt(ctx, colors, caption, w - RIGHT, y + 12, { size: "fsXs", colour: colors.ink3, align: "right" });
  const lo = 100, hi = 2000, sx = (m) => x0 + ((m - lo) / (hi - lo)) * (x1 - x0);
  const base = y + 72;
  rule(ctx, colors, x0, base, x1, base, colors.axis);
  txt(ctx, colors, "peaks", x0 - 10, base - 6, { size: "fsXs", colour: colors.ink3, align: "right", weight: "600" });
  txt(ctx, colors, "m/z", x1, y + h0(L) - 2, { size: "fsXs", colour: colors.ink3, align: "right" });
  if (!psm) {
    txt(ctx, colors, "each spectrum is scored against every target and decoy peptide", x0, base - 26, { size: "fsXs", colour: colors.ink3 });
    txt(ctx, colors, `within ${SEARCH.window} Da of its precursor mass`, x0, base - 10, { size: "fsXs", colour: colors.ink3 });
    return;
  }
  psm.peaks.forEach((m, i) => rule(ctx, colors, sx(m), base, sx(m), base - 8 - 44 * peakHeight(i, m), colors.ink3, 1));
  /* a ladder: the candidate's b and y ions in m/z order; an ion on a peak is a
     full tick in the row's colour, one off every peak a short faint one. Ions
     tick in left to right while the spectrum is being read (phase < 1). */
  const ladder = (e, yy, colour, name) => {
    txt(ctx, colors, name, x0 - 10, yy + 11, { size: "fsXs", colour, align: "right", weight: "600" });
    if (!e) { txt(ctx, colors, "none within the precursor window", x0, yy + 11, { size: "fsXs", colour: colors.ink3 }); return; }
    const { b, y: yIons } = fragments(e.p);
    const ions = [...b, ...yIons].sort((u, v) => u - v);
    const shown = phase >= 1 ? ions.length : Math.floor(ions.length * Math.min(1, phase));
    let hits = 0;
    ions.slice(0, shown).forEach((m) => {
      const hit = onPeak(psm.peaks, m, SEARCH.tol);
      if (hit) hits += 1;
      ctx.save(); if (!hit) ctx.globalAlpha = 0.45;
      rule(ctx, colors, sx(m), yy, sx(m), yy + (hit ? 16 : 6), colour, hit ? 2 : 1);
      ctx.restore();
    });
    txt(ctx, colors, `${e.p} · ${hits} matched ion${hits === 1 ? "" : "s"}`, x1, yy + 30, { size: "fsXs", colour, align: "right", mono: true });
  };
  ladder(psm.bestT, base + 8, colors.empirical, "best target");
  ladder(psm.bestD, base + 48, colors.ink3, "best decoy");
  if (phase >= 1) {
    const kind = truth ? (psm.kind === "decoy" ? "a decoy" : psm.kind === "correct" ? "a correct target" : "an incorrect target") : psm.kind === "decoy" ? "a decoy" : "a target";
    txt(ctx, colors, `PSM: the higher of the two, ${kind}, score ${psm.ions}`, x0, base + 96, { size: "fsXs", colour: truth && psm.kind === "wrong" ? colors.extreme : colors.ink1, weight: "600" });
  }
}
const h0 = (L) => L.sp.h;

function drawHistogram(ctx, colors, w, L, state, params, k, yMax, falling) {
  const H = L.hist, bw = binW(L);
  const truth = params.identity === "on";
  txt(ctx, colors, "Every PSM, by its score", 12, H.y + 12, { colour: colors.ink1, weight: "600" });
  const c = binCounts(state.psms, k, MAXS);
  const sh = (n) => (n > 0 ? Math.max(1.5, (n / yMax) * (H.base - H.top)) : 0);
  // the count axis
  for (const v of yMax % 2 ? [0, yMax] : [0, yMax / 2, yMax]) {
    const yy = H.base - (v / yMax) * (H.base - H.top);
    rule(ctx, colors, H.x0 - 4, yy, H.x0, yy, colors.axis);
    txt(ctx, colors, n0(Math.round(v)), H.x0 - 6, yy + 4, { size: "fsXs", colour: colors.ink3, align: "right" });
  }
  ctx.save(); ctx.translate(16, (H.top + H.base) / 2); ctx.rotate(-Math.PI / 2);
  txt(ctx, colors, "PSMs", 0, 0, { size: "fsXs", colour: colors.ink3, align: "center" }); ctx.restore();
  // the falling PSM's own count is not in its bar until it lands
  const land = falling ? falling.ions : -1;
  c.forEach((b, s) => {
    const x = binX(L, s) + 1, ww = bw - 2;
    const lessOne = s === land ? 1 : 0;
    const cor = b.correct - (s === land && falling.kind === "correct" ? lessOne : 0);
    const wro = b.wrong - (s === land && falling.kind === "wrong" ? lessOne : 0);
    if (truth) {
      ctx.fillStyle = colors.extreme; ctx.fillRect(x, H.base - sh(wro), ww, sh(wro));
      ctx.fillStyle = colors.empirical; ctx.fillRect(x, H.base - sh(wro) - sh(cor), ww, sh(cor));
    } else {
      ctx.fillStyle = colors.empirical; ctx.fillRect(x, H.base - sh(cor + wro), ww, sh(cor + wro));
    }
  });
  // the decoys: an outline over the targets, as the lesson's figure draws its decoy curve
  ctx.save(); ctx.beginPath(); ctx.moveTo(binX(L, 0), H.base);
  c.forEach((b, s) => {
    const d = b.decoy - (s === land && falling.kind === "decoy" ? 1 : 0);
    ctx.lineTo(binX(L, s), H.base - sh(d)); ctx.lineTo(binX(L, s + 1), H.base - sh(d));
  });
  ctx.lineTo(binX(L, MAXS + 1), H.base); ctx.closePath();
  ctx.globalAlpha = truth ? 0.15 : 0.35; ctx.fillStyle = colors.reference; ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  // the falling PSM: one count's height, dropping into its bin from the top of the plot
  if (falling) {
    const s = falling.ions, b = c[s];
    const under = falling.kind === "decoy" ? sh(b.decoy - 1) : sh(b.correct + b.wrong - 1);
    const unit = Math.max(3, (1 / yMax) * (H.base - H.top));
    const yLand = H.base - under - unit;
    const yy = H.top + (yLand - H.top) * easeInOut(falling.e);
    ctx.fillStyle = falling.kind === "decoy" ? colors.ink2 : truth && falling.kind === "wrong" ? colors.extreme : colors.empirical;
    ctx.fillRect(binX(L, s) + 1, yy, bw - 2, unit);
  }
  rule(ctx, colors, H.x0, H.base, H.x1, H.base, colors.axis);
  for (let s = 0; s <= MAXS; s += 5) txt(ctx, colors, s === MAXS ? `${MAXS}+` : String(s), binX(L, s) + bw / 2, H.base + 15, { size: "fsXs", colour: colors.ink3, align: "center" });
  txt(ctx, colors, "score: matched fragment ions", (H.x0 + H.x1) / 2, H.base + 32, { size: "fsXs", colour: colors.ink3, align: "center" });
  // the 1% and 5% points of the search so far, then the reader's threshold
  if (k > 0 && !falling) {
    const t1 = levelThreshold(c, 0.01), t5 = levelThreshold(c, 0.05);
    for (const [t, name, right] of [[t5, "≤ 5%", true], [t1, "≤ 1%", false]]) {
      if (t > MAXS) continue;
      const x = binX(L, t);
      rule(ctx, colors, x, H.top - 6, x, H.base, colors.ink3, 1, [3, 3]);
      txt(ctx, colors, name, right ? x - 3 : x + 3, H.top - 10, { size: "fsXs", colour: colors.ink2, align: right ? "right" : "left" });
    }
  }
  const tx = binX(L, params.threshold);
  rule(ctx, colors, tx, H.top - 20, tx, H.base, colors.highlight, 2);
  txt(ctx, colors, `threshold ${params.threshold}`, tx + 4, H.top - 24, { size: "fsXs", colour: colors.highlight, weight: "600" });
  return c;
}

function drawScore(ctx, colors, w, params, state, anim, pointer) {
  const L = scoreLayout(w);
  const N = state.psms.length;
  const k = anim ? anim.k : Math.min(N, Number(params.shown) || 0);
  const searching = anim && anim.t > 0 && anim.k < N;
  const yMax = anim ? anim.y : niceMax(maxBin(binCounts(state.psms, k, MAXS)));
  /* the spectrum in the bands: the one being read; in the fast run, the latest
     arrival every quarter second; at rest the last searched, or the first of
     the bin under the pointer */
  let psm = null, phase = 1, caption = "", falling = null;
  if (searching) {
    const i = Math.min(N - 1, k);
    if (i < MID) {
      const start = i ? state.end[i - 1] : 0;
      const e = (anim.t - start) / durOf(i, state.end);
      psm = state.psms[i];
      if (i < SLOW) {
        phase = e / TICK_END;
        if (e >= FALL_FROM) falling = { ...psm, e: (e - FALL_FROM) / (1 - FALL_FROM) };
      } else falling = { ...psm, e: Math.min(1, e / 0.6) };
      caption = `spectrum ${n0(i + 1)} of ${n0(N)}`;
    } else {
      const shown = arrivedBy(state.end, Math.floor(anim.t / 250) * 250);
      psm = state.psms[Math.max(0, Math.min(N - 1, shown - 1))];
      caption = `spectrum ${n0(Math.max(1, shown))} of ${n0(N)}`;
    }
  } else if (k > 0) {
    const bin = binAt(L, pointer);
    const first = bin == null ? -1 : state.psms.findIndex((p, i) => i < k && Math.min(MAXS, p.ions) === bin);
    if (first >= 0) { psm = state.psms[first]; caption = `a spectrum scoring ${bin === MAXS ? `${MAXS} or more` : bin}, under the pointer`; }
    else { psm = state.psms[k - 1]; caption = `spectrum ${n0(k)} of ${n0(N)}, the last searched`; }
  }
  drawDatabase(ctx, colors, w, L, state, psm);
  rule(ctx, colors, 12, L.sp.y - 6, w - 12, L.sp.y - 6, colors.grid);
  drawSpectrum(ctx, colors, w, L, psm, phase, caption, params.identity === "on");
  rule(ctx, colors, 12, L.hist.y - 6, w - 12, L.hist.y - 6, colors.grid);
  drawHistogram(ctx, colors, w, L, state, params, k, yMax, falling);
}

/* ------------------------------------------------------------ the Proteins page */
const STAGE_TEXT = [
  "Peptides identified by LC-MS/MS",
  "6 proteins in the reference proteome match the identified peptides",
  "Eliminate subset proteins: 4 protein groups",
  "Eliminate subsets and subsumables: 3 protein groups",
  "The minimal set: 3 proteins account for every peptide",
];
function drawProteins(ctx, colors, w, params, anim) {
  const n = anim ? anim.n : Math.min(4, Number(params.shown) || 0);
  const { proteins, peptides } = FIGURE;
  const g = inferProteins(proteins, peptides);
  const groupOf = (id) => g.find((x) => x.ids.includes(id));
  const keep = (id) => (n <= 1 ? true : n === 2 ? !groupOf(id).subset : n === 3 ? !groupOf(id).subset && !groupOf(id).subsumable : ["I", "III", "V"].includes(id));
  const span = Math.min(w - 40, 560), left = (w - span) / 2;
  const px = (i) => left + 30 + (i * (span - 60)) / (proteins.length - 1);
  const qx = (i) => left + 16 + (i * (span - 32)) / (peptides.length - 1);
  const yP = 74, yQ = 176, R = 18, Q = 28;
  txt(ctx, colors, STAGE_TEXT[n], 12, 20, { colour: colors.ink1, weight: "600" });
  txt(ctx, colors, "proteins in the reference proteome", 12, yP - R - 12, { size: "fsXs", colour: colors.ink3 });
  txt(ctx, colors, "peptides identified", 12, yQ + Q + 18, { size: "fsXs", colour: colors.ink3 });
  if (n >= 1) {
    proteins.forEach((p, i) => p.peptides.forEach((q) => {
      const on = keep(p.id);
      rule(ctx, colors, px(i), yP + R, qx(peptides.indexOf(q)), yQ, on ? colors.ink3 : colors.grid, on ? 1.4 : 1, on ? null : [3, 3]);
    }));
    proteins.forEach((p, i) => {
      const on = keep(p.id);
      ctx.save(); ctx.beginPath(); ctx.arc(px(i), yP, R, 0, Math.PI * 2);
      ctx.fillStyle = colors.surface2; ctx.fill();
      ctx.strokeStyle = on ? colors.empirical : colors.axis; ctx.lineWidth = on ? 2.5 : 1; if (!on) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.restore();
      txt(ctx, colors, p.id, px(i), yP + 4, { colour: on ? colors.ink1 : colors.ink3, align: "center", weight: "600" });
    });
  }
  peptides.forEach((q, i) => {
    ctx.fillStyle = colors.surface2; ctx.fillRect(qx(i) - Q / 2, yQ, Q, Q);
    ctx.strokeStyle = colors.ink2; ctx.lineWidth = 1.2; ctx.strokeRect(qx(i) - Q / 2 + 0.5, yQ + 0.5, Q - 1, Q - 1);
    txt(ctx, colors, q, qx(i), yQ + 19, { colour: colors.ink1, align: "center", weight: "600" });
  });
  // the groups, as the right half of the lesson's figure
  const gy = 262;
  if (n === 2 || n === 3) {
    const groups = g.filter((x) => !x.subset && (n === 2 || !x.subsumable));
    let x = left + 8;
    groups.forEach((G, j) => {
      const gw = 30 + G.ids.length * 40;
      ctx.save(); ctx.strokeStyle = colors.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, gy, gw, 52, 8); ctx.stroke(); ctx.restore();
      txt(ctx, colors, `PG ${j + 1}`, x + gw / 2, gy - 6, { size: "fsXs", colour: colors.ink3, align: "center" });
      G.ids.forEach((id, m) => {
        const cx = x + 35 + m * 40;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, gy + 26, 15, 0, Math.PI * 2); ctx.fillStyle = colors.surface2; ctx.fill();
        ctx.strokeStyle = colors.empirical; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        txt(ctx, colors, id, cx, gy + 30, { size: "fsXs", colour: colors.ink1, align: "center", weight: "600" });
      });
      x += gw + 14;
    });
  }
  const note = [
    "Each square is a peptide sequence matched to a spectrum above the threshold.",
    "A line joins a protein to each identified peptide its sequence contains.",
    "II is eliminated: its one peptide, B, is also in I. V and VI share every peptide: one group.",
    "IV is eliminated: it has no peptide of its own; E is in III, F in V and VI.",
    "I, III and V account for every peptide. VI is indistinguishable from V on these peptides.",
  ][n];
  txt(ctx, colors, note, 12, H_PROT - 18, { colour: colors.ink2 });
}

/* ------------------------------------------------------------ the widget */
defineWidget({
  slug: "target-decoy",
  title: "Proteomics: Identification",
  subtitle:
    "Each spectrum is matched to the best-scoring peptide among the target proteins and the same proteins reversed, "
    + "the decoys. The number of decoy matches above a score threshold estimates the number of incorrect target matches "
    + "above it, which gives the false discovery rate of the accepted list as a whole. Protein inference then reports "
    + "the smallest set of proteins that accounts for the accepted peptides.",
  layout: "side",
  status: "draft",
  height: (p) => (p.page === "proteins" ? H_PROT : H_SCORE),

  params: {
    page: {
      role: "page", type: "segmented", label: "Page", display: true, default: "score",
      options: [{ value: "score", label: "Score" }, { value: "proteins", label: "Proteins" }],
    },
    dataSec: { type: "section", label: "The data", when: { param: "page", equals: "score" } },
    database: {
      type: "segmented", label: "Spectra from a peptide in the database", when: { param: "page", equals: "score" },
      detail: "the share of spectra whose peptide is in the target database; the rest are from proteins not in it, so have no correct match",
      options: [{ value: "30", label: "30%" }, { value: "60", label: "60%" }, { value: "90", label: "90%" }],
      default: "60",
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 12, when: { param: "page", equals: "score" } },
    thrSec: { type: "section", label: "The threshold", when: { param: "page", equals: "score" } },
    threshold: {
      type: "int", label: "Threshold, matched fragment ions", min: 1, max: 20, default: 8, display: true,
      when: { param: "page", equals: "score" },
      detail: "a PSM scoring at or above it is accepted",
    },
    identity: {
      type: "segmented", label: "True identity", display: true, default: "off", when: { param: "page", equals: "score" },
      detail: "whether each target PSM is the spectrum's own peptide: known in a simulation, unknown for measured spectra",
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }],
    },
    /* authoring escape hatch, first render only: spectra searched (Score) or stages taken (Proteins) */
    shown: { type: "int", min: 0, max: 5000, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "proteins"
    ? [
      { token: "empirical", label: "A protein kept", mark: "dot" },
      { token: "ink-3", label: "A protein eliminated", mark: "dot" },
      { token: "ink-2", label: "A peptide identified", mark: "bar" },
    ]
    : [
      ...(params.identity === "on"
        ? [{ token: "empirical", label: "Target PSMs, correct", mark: "bar" },
          { token: "extreme", label: "Target PSMs, incorrect", mark: "bar" }]
        : [{ token: "empirical", label: "Target PSMs", mark: "bar" }]),
      { token: "ink-2", label: "Decoy PSMs", mark: "line" },
      { token: "highlight", label: "The threshold", mark: "line" },
      { token: "ink-3", label: "The lowest thresholds with an estimated FDR of at most 1% and 5%", mark: "dash" },
    ]),

  /* Pure and seeded: the whole search, whichever page is showing. A page is a
     display parameter, so switching keeps the search and its histogram. */
  compute: ({ params, rng }) => {
    const res = search(rng, { inDb: Number(params.database) / 100 });
    return { ...res, end: schedule(res.psms.length) };
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: {
      search: "Search", searching: "Search", searched: "Search again",
      p0: "Match proteins", p1: "Eliminate subsets", p2: "Eliminate subsumables", p3: "Minimal set", pdone: "Step",
    }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      search: "Match every spectrum against the target and decoy peptides of its precursor mass, and add each PSM to the histogram at its score",
      searching: "Finish the search at once",
      searched: "Run the same search again from the first spectrum",
      p0: "Join each identified peptide to every protein in the reference proteome that contains it",
      p1: "Eliminate each protein whose peptides are all in another protein, and group proteins with identical peptides",
      p2: "Eliminate each protein with no peptide of its own",
      p3: "Keep the fewest proteins that account for every peptide",
      pdone: "Every stage of this page has been taken",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, state, fromScratch }) => {
      const anim = { t: 0, k: 0, y: 5, n: 0, p: 1, page: params.page, moving: false, halt: false };
      if (!fromScratch) {
        const s = Math.max(0, Number(params.shown) || 0);
        if (params.page === "score" && s > 0) {
          anim.k = Math.min(state.psms.length, s);
          anim.t = state.end[anim.k - 1];
          anim.y = niceMax(maxBin(binCounts(state.psms, anim.k, MAXS)));
        } else if (params.page === "proteins") anim.n = Math.min(4, s);
      }
      settle(anim, params.page, state);
      return anim;
    },
    /* A page switch mid-press finishes the press and stops the loop, so the
       other page's press is never taken unasked (the 2026-09-20 sweep, memory
       mid-press-page-switch): advance records whether it is moving, rebuild
       finishes and halts only then. */
    advance: (anim, { dt, params, state }) => {
      if (anim.halt) { anim.halt = false; anim.moving = false; settle(anim, params.page, state); return false; }
      anim.moving = advanceBody(anim, dt, params, state);
      return anim.moving;
    },
    rebuild: (anim, { params, state }) => {
      if (params.page !== anim.page) {
        if (anim.moving) {
          if (anim.page === "score") finishSearch(anim, state);
          else anim.p = 1;
          anim.halt = true;
        }
        anim.page = params.page;
      }
      settle(anim, params.page, state);
    },
  },

  pointer: true,

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    if (params.page === "proteins") drawProteins(ctx, colors, w, params, anim);
    else drawScore(ctx, colors, w, params, state, anim, pointer);
  },

  readout: ({ params, state, anim }) => {
    if (params.page === "proteins") {
      const n = anim ? anim.n : Math.min(4, Number(params.shown) || 0);
      return [
        { label: "Proteins that contain an identified peptide", value: n >= 1 ? "6" : "–", note: n >= 1 ? "I to VI" : "joined by Match proteins" },
        { label: "Protein groups", value: n >= 3 ? "4 → 3" : n >= 2 ? "4" : "–", note: n >= 2 ? "proteins with identical peptides are one group; a subset is eliminated, then a subsumable" : "formed by Eliminate subsets" },
        { label: "The minimal set", value: n >= 4 ? "I · III · V" : "–", note: n >= 4 ? "3 proteins account for all 7 peptides" : "kept by Minimal set" },
      ];
    }
    const N = state.psms.length;
    const k = anim ? anim.k : Math.min(N, Number(params.shown) || 0);
    const truth = params.identity === "on";
    if (k === 0) {
      return [
        { label: "Spectra searched", value: `0 of ${n0(N)}`, note: `${params.database}% are from a peptide in the database` },
        { label: "PSMs at or above the threshold", value: "–", note: "the estimated FDR is decoys ÷ targets at or above the threshold" },
        { label: "Local FDR at the threshold", value: "–", note: "decoys ÷ targets among the PSMs scoring exactly the threshold" },
      ];
    }
    const c = binCounts(state.psms, k, MAXS);
    const t = params.threshold, a = aboveFrom(c, t), b = c[Math.min(MAXS, t)];
    const bt = b.correct + b.wrong;
    return [
      { label: "Spectra searched", value: `${n0(k)} of ${n0(N)}`, note: `${params.database}% are from a peptide in the database; the rest have no correct match in it` },
      { label: `PSMs scoring ${t} or more`, value: `${n0(a.T)} target${a.T === 1 ? "" : "s"} · ${n0(a.D)} decoy${a.D === 1 ? "" : "s"}`, note: `estimated FDR ${pct(a.est)}, decoys ÷ targets${truth ? `; true ${pct(a.tru)}, ${n0(a.W)} incorrect target${a.W === 1 ? "" : "s"}` : ""}` },
      { label: `Local FDR at ${t}`, value: bt ? pct(b.decoy / bt, 0) : "–", note: bt ? `decoys ÷ targets among the PSMs scoring exactly ${t}: ${n0(b.decoy)} for ${n0(bt)}; at ${t} or more, ${pct(a.est)}${truth ? `; true ${pct(b.wrong / bt, 0)}` : ""}` : `no target PSM scores exactly ${t}` },
    ];
  },
});
