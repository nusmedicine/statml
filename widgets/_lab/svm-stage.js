/* Lab: which data the SVM widget stands on. Draws both candidate stages at the
   real stage widths, with the ladder measured underneath. Nothing here ships. */
import { CRC, HF, solveSVM } from "./svm-stage-core.js";

const LADDER = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];

function prep(raw, meta) {
  const rows = raw.split(";").map((s) => s.split(",").map(Number));
  const n = rows.length;
  const mu = [0, 1].map((j) => rows.reduce((s, r) => s + r[j], 0) / n);
  const sd = [0, 1].map((j) => Math.sqrt(rows.reduce((s, r) => s + (r[j] - mu[j]) ** 2, 0) / n));
  const X = rows.map((r) => [(r[0] - mu[0]) / sd[0], (r[1] - mu[1]) / sd[1]]);
  const y = rows.map((r) => r[2]);
  const K = X.map((a) => X.map((b) => a[0] * b[0] + a[1] * b[1]));
  return { ...meta, raw: rows, X, y, K, mu, sd, n };
}

const DATA = {
  crc: prep(CRC, {
    label: "Colorectal biopsies", xName: "FXYD5", yName: "C7",
    unit: "log₂ expression", pos: "Adenocarcinoma", neg: "Normal",
  }),
  hf: prep(HF, {
    label: "Heart failure", xName: "Ejection fraction", yName: "Serum creatinine",
    unit: "", pos: "Died", neg: "Survived",
  }),
};

/* w, b and everything the figure reads off them. `keep` restricts the FIT to a
   subset; the plane is still drawn from all of them. */
function fit(d, C, keep) {
  const idx = keep || d.X.map((_, i) => i);
  const K = idx.map((i) => idx.map((j) => d.K[i][j]));
  const y = idx.map((i) => d.y[i]);
  const { alpha, b } = solveSVM(K, y, C);
  const w = [0, 1].map((j) => alpha.reduce((s, a, k) => s + a * y[k] * d.X[idx[k]][j], 0));
  const sv = idx.filter((_, k) => alpha[k] > 1e-8);
  const f = d.X.map((x) => w[0] * x[0] + w[1] * x[1] + b);
  const marginW = 2 / Math.hypot(w[0], w[1]);
  const inside = d.y.filter((yi, i) => yi * f[i] < 1 - 1e-9).length;
  const wrong = d.y.filter((yi, i) => yi * f[i] <= 0).length;
  return { w, b, alpha, sv, svSet: new Set(sv), f, marginW, inside, wrong, idx };
}

function span(vals) {
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

function canvasIn(host, w, h) {
  host.textContent = "";
  const c = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function drawPlane(ctx, d, r, box, opts) {
  const { x0, y0, w, h } = box;
  const C = opts.C;
  const xs = span(d.X.map((p) => p[0])), ys = span(d.X.map((p) => p[1]));
  const sx = (v) => x0 + ((v - xs[0]) / (xs[1] - xs[0])) * w;
  const sy = (v) => y0 + h - ((v - ys[0]) / (ys[1] - ys[0])) * h;
  const ink = css("--ink-1"), ink3 = css("--ink-3"), grid = css("--grid");
  const ev = css("--c-event"), nev = css("--c-nonevent");
  const th = css("--c-highlight"), hi = css("--ink-1"), surf = css("--surface-1");

  ctx.save();
  ctx.fillStyle = surf; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = grid; ctx.lineWidth = 1;
  for (let g = Math.ceil(xs[0]); g <= xs[1]; g += 1) {
    ctx.beginPath(); ctx.moveTo(Math.round(sx(g)) + 0.5, y0); ctx.lineTo(Math.round(sx(g)) + 0.5, y0 + h); ctx.stroke();
  }
  for (let g = Math.ceil(ys[0]); g <= ys[1]; g += 1) {
    ctx.beginPath(); ctx.moveTo(x0, Math.round(sy(g)) + 0.5); ctx.lineTo(x0 + w, Math.round(sy(g)) + 0.5); ctx.stroke();
  }

  /* the boundary and its two margin lines: w.x + b = 0, +/-1. Drawn as a band
     clipped to the panel rather than as three lines, so the corridor reads as
     one object. */
  const line = (c) => {
    const [a1, a2] = r.w;
    const pts = [];
    for (const xv of xs) { const yv = (c - r.b - a1 * xv) / a2; pts.push([xv, yv]); }
    for (const yv of ys) { const xv = (c - r.b - a2 * yv) / a1; pts.push([xv, yv]); }
    return pts.filter(([X, Y]) => X >= xs[0] - 1e-9 && X <= xs[1] + 1e-9 && Y >= ys[0] - 1e-9 && Y <= ys[1] + 1e-9);
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  /* The corridor as ONE quad built from the line's own direction, not from the
     two clipped segments: when the +1 and -1 lines leave the panel through
     different edges their endpoints come back in different orders and the quad
     folds into a bow tie. Visible on the heart-failure panel, invisible on the
     colorectal one. */
  {
    const nrm = Math.hypot(r.w[0], r.w[1]);
    const ux = -r.w[1] / nrm, uy = r.w[0] / nrm;          // along the boundary
    const nx = r.w[0] / nrm, ny = r.w[1] / nrm;           // across it
    const off = 1 / nrm;                                   // +/-1 in x-units
    const px = (-r.b * r.w[0]) / (nrm * nrm), py = (-r.b * r.w[1]) / (nrm * nrm);
    const L = 40;
    const q = [[px + L * ux + off * nx, py + L * uy + off * ny],
               [px - L * ux + off * nx, py - L * uy + off * ny],
               [px - L * ux - off * nx, py - L * uy - off * ny],
               [px + L * ux - off * nx, py + L * uy - off * ny]];
    ctx.beginPath();
    q.forEach(([X, Y], k) => (k ? ctx.lineTo(sx(X), sy(Y)) : ctx.moveTo(sx(X), sy(Y))));
    ctx.closePath();
    ctx.fillStyle = th; ctx.globalAlpha = 0.10; ctx.fill(); ctx.globalAlpha = 1;
  }
  if (opts.fan) {
    ctx.lineWidth = 1; ctx.globalAlpha = 0.30; ctx.strokeStyle = th;
    for (const Ck of LADDER) {
      if (Ck === C) continue;
      const rk = fit(d, Ck, null);
      const p = (() => {
        const [a1, a2] = rk.w; const q = [];
        for (const xv of xs) q.push([xv, (-rk.b - a1 * xv) / a2]);
        for (const yv of ys) q.push([(-rk.b - a2 * yv) / a1, yv]);
        return q.filter(([X, Y]) => X >= xs[0] - 1e-9 && X <= xs[1] + 1e-9 && Y >= ys[0] - 1e-9 && Y <= ys[1] + 1e-9);
      })();
      if (p.length >= 2) { ctx.beginPath(); ctx.moveTo(sx(p[0][0]), sy(p[0][1])); ctx.lineTo(sx(p[1][0]), sy(p[1][1])); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  for (const [c, dash] of [[1, [4, 4]], [-1, [4, 4]], [0, []]]) {
    const p = line(c);
    if (p.length < 2) continue;
    ctx.setLineDash(dash);
    ctx.lineWidth = c === 0 ? 2 : 1;
    ctx.strokeStyle = th;
    ctx.beginPath(); ctx.moveTo(sx(p[0][0]), sy(p[0][1])); ctx.lineTo(sx(p[1][0]), sy(p[1][1])); ctx.stroke();
  }
  ctx.setLineDash([]);

  /* samples. When the fit is restricted, the ones left out are not drawn at
     all — the point is to watch them go and watch the line stay. */
  for (let i = 0; i < d.n; i += 1) {
    if (opts.drop && !r.svSet.has(i)) continue;
    const isSV = r.svSet.has(i);
    ctx.beginPath();
    ctx.arc(sx(d.X[i][0]), sy(d.X[i][1]), isSV ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fillStyle = d.y[i] > 0 ? ev : nev;
    ctx.globalAlpha = isSV ? 1 : 0.32;
    ctx.fill();
    if (isSV) {
      ctx.globalAlpha = 0.85; ctx.lineWidth = 1.25; ctx.strokeStyle = hi;
      ctx.beginPath(); ctx.arc(sx(d.X[i][0]), sy(d.X[i][1]), 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.strokeStyle = css("--border"); ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  ctx.fillStyle = ink3; ctx.font = `11px ${css("--font-sans") || "system-ui"}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`${d.yName}${d.unit ? ` (${d.unit})` : ""}`, x0 + 6, y0 + 6);
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillText(`${d.xName}${d.unit ? ` (${d.unit})` : ""}`, x0 + w - 6, y0 + h - 6);
  ctx.fillStyle = ink;
  ctx.restore();
}

function drawLoss(ctx, d, r, box) {
  const { x0, y0, w, h } = box;
  const ink1 = css("--ink-1"), ink3 = css("--ink-3"), grid = css("--grid");
  const th = css("--c-highlight"), ev = css("--c-event"), nev = css("--c-nonevent");
  /* the axis has to cover where the samples ACTUALLY sit, or the pile at zero
     loss lands on the frame edge and reads as a clipping artefact */
  const marg = d.y.map((yi, i) => yi * r.f[i]);
  const up = Math.max(3, Math.ceil(Math.max(...marg)));
  const lo = Math.min(-1, Math.floor(Math.min(...marg)));
  const yTop = Math.max(2, Math.ceil(1 - lo));
  const histH = 46, gap = 22, plotH = h - histH - gap - 30;
  const sx = (v) => x0 + 30 + ((v - lo) / (up - lo)) * (w - 38);
  const sy = (v) => y0 + 12 + plotH - (v / yTop) * plotH;
  ctx.save();
  ctx.fillStyle = css("--surface-1"); ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = grid; ctx.lineWidth = 1;
  for (let g = Math.ceil(lo); g <= up; g += 1) {
    ctx.beginPath(); ctx.moveTo(Math.round(sx(g)) + 0.5, y0 + 12); ctx.lineTo(Math.round(sx(g)) + 0.5, y0 + 12 + plotH); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(sx(lo), Math.round(sy(0)) + 0.5); ctx.lineTo(x0 + w - 8, Math.round(sy(0)) + 0.5); ctx.stroke();

  /* the flat half of the hinge is the whole point, so the elbow is marked */
  ctx.strokeStyle = th; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx(lo), sy(1 - lo)); ctx.lineTo(sx(1), sy(0)); ctx.lineTo(sx(up), sy(0)); ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.lineWidth = 1.25; ctx.strokeStyle = css("--c-reference");
  ctx.beginPath();
  for (let p = 0; p <= 160; p += 1) {
    const m = lo + ((up - lo) * p) / 160, L = Math.log(1 + Math.exp(-m)) / Math.LN2;
    if (p === 0) ctx.moveTo(sx(m), sy(L)); else ctx.lineTo(sx(m), sy(L));
  }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = ink3; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx(1), y0 + 12); ctx.lineTo(sx(1), y0 + 12 + plotH + histH + 6); ctx.stroke();
  ctx.setLineDash([]);

  /* every sample's own y f(x), as a histogram: a rug of 194 hairlines reads as
     one grey block and hides exactly the pile this panel exists to show */
  const bins = 44, cnt = [], counts = new Array(bins * 2).fill(0);
  for (let i = 0; i < d.n; i += 1) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor(((marg[i] - lo) / (up - lo)) * bins)));
    counts[k * 2 + (d.y[i] > 0 ? 1 : 0)] += 1;
  }
  for (let k = 0; k < bins; k += 1) cnt.push(counts[k * 2] + counts[k * 2 + 1]);
  const cMax = Math.max(...cnt, 1);
  const bw = (w - 38) / bins;
  const by = y0 + 12 + plotH + gap + histH;
  for (let k = 0; k < bins; k += 1) {
    let base = 0;
    for (const [s, col] of [[0, nev], [1, ev]]) {
      const n = counts[k * 2 + s];
      if (!n) continue;
      const hgt = (n / cMax) * histH;
      ctx.fillStyle = col;
      ctx.fillRect(x0 + 30 + k * bw + 0.5, by - base - hgt, Math.max(1, bw - 1), hgt);
      base += hgt;
    }
  }
  ctx.strokeStyle = css("--border"); ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  ctx.font = "11px system-ui";
  ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("hinge loss", x0 + 6, y0 + 2);
  ctx.textAlign = "right"; ctx.fillText(String(yTop), sx(lo) - 4, sy(yTop) - 4);
  ctx.fillText("0", sx(lo) - 4, sy(0) - 5);
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("y f(x)", (sx(lo) + sx(up)) / 2, by + 4);
  ctx.fillStyle = ink1;
  ctx.fillText("1", sx(1), by + 4);
  ctx.textAlign = "left"; ctx.fillStyle = ink3;
  ctx.fillText(`${d.n - r.inside} samples at exactly zero`, sx(1) + 6, y0 + 14);
  ctx.restore();
}

function measure(d, r, C) {
  const pct = ((r.sv.length / d.n) * 100).toFixed(0);
  return `C = ${C} &middot; support vectors <b>${r.sv.length} of ${d.n}</b> (${pct}%) &middot; `
    + `margin width <b>${r.marginW.toFixed(2)}</b> SD &middot; inside the margin <b>${r.inside}</b> &middot; `
    + `misclassified <b>${r.wrong}</b> (accuracy ${(1 - r.wrong / d.n).toFixed(3)})`;
}

function table(host, d) {
  const rows = LADDER.map((C) => {
    const r = fit(d, C, null);
    const r2 = fit(d, C, r.sv);
    let gap = 0;
    for (let a = 0; a <= 20; a += 1) for (let b = 0; b <= 20; b += 1) {
      const p = [-3 + (a * 6) / 20, -3 + (b * 6) / 20];
      gap = Math.max(gap, Math.abs((r.w[0] * p[0] + r.w[1] * p[1] + r.b) - (r2.w[0] * p[0] + r2.w[1] * p[1] + r2.b)));
    }
    return { C, r, gap };
  });
  host.innerHTML = `<table><tr><th>C</th><th>SV</th><th>margin</th><th>inside</th><th>wrong</th><th>drop</th></tr>`
    + rows.map(({ C, r, gap }) => `<tr data-c="${C}"><td>${C}</td><td>${r.sv.length}</td>`
      + `<td>${r.marginW.toFixed(3)}</td><td>${r.inside}</td><td>${r.wrong}</td>`
      + `<td>${gap < 1e-6 ? "0" : gap.toExponential(1)}</td></tr>`).join("")
    + `</table>`;
}

const $ = (id) => document.getElementById(id);
const state = { ci: 5, drop: false, fan: false, frame: 770 };

function render() {
  const C = LADDER[state.ci];
  $("clabel").textContent = String(C);
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  const W = state.frame;
  for (const [id, mid, key] of [["s1a", "m1a", "crc"], ["s1b", "m1b", "hf"]]) {
    const d = DATA[key];
    const r = fit(d, C, state.drop ? fit(d, C, null).sv : null);
    const H = Math.round(W * 0.52);
    const ctx = canvasIn($(id), W, H);
    drawPlane(ctx, d, r, { x0: 0, y0: 0, w: W, h: H }, { C, drop: state.drop, fan: state.fan });
    $(mid).innerHTML = measure(d, r, C);
  }
  for (const [id, key] of [["s2a", "crc"], ["s2b", "hf"]]) {
    const d = DATA[key];
    const r = fit(d, C, state.drop ? fit(d, C, null).sv : null);
    const H = Math.round(W * 0.46);
    const gap = 14, planeW = Math.round((W - gap) * 0.6), lossW = W - gap - planeW;
    const ctx = canvasIn($(id), W, H);
    drawPlane(ctx, d, r, { x0: 0, y0: 0, w: planeW, h: H }, { C, drop: state.drop, fan: state.fan });
    drawLoss(ctx, d, r, { x0: planeW + gap, y0: 0, w: lossW, h: H });
  }
  for (const t of document.querySelectorAll("#tabA tr, #tabB tr")) {
    t.classList.toggle("on", t.dataset.c === String(C));
  }
}

$("ci").addEventListener("input", (e) => { state.ci = +e.target.value; render(); });
$("drop").addEventListener("change", (e) => { state.drop = e.target.checked; render(); });
$("fan").addEventListener("change", (e) => { state.fan = e.target.checked; render(); });
$("dark").addEventListener("change", render);
$("frame").addEventListener("change", (e) => { state.frame = +e.target.value; render(); });
table($("tabA"), DATA.crc);
table($("tabB"), DATA.hf);
render();
