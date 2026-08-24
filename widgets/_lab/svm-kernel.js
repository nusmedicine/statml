/* Lab: showing the kernel transformation as two panels on one fit. Nothing here
   ships. The solver is the frozen copy next door; the feature maps are new. */
import { solveSVM } from "./svm-stage-core.js";
import { makeRng } from "../core/rng.js";

const LADDER = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30];

/* --- the cohort ---------------------------------------------------------- *
 * Sodium and potassium, each as a deviation from the middle of its reference
 * range in half-widths, so z = 0 is dead centre and |z| = 1 is the edge of
 * normal. Normal on both is a disc; deranged on either is the ring around it.
 * A gap is left between them so the corridor has somewhere to be — the point of
 * the figure is the shape of the boundary, not how much the groups overlap. */
const REF = { na: { mid: 140, half: 5, name: "Serum sodium", unit: "mmol/L" },
              k: { mid: 4.25, half: 0.75, name: "Serum potassium", unit: "mmol/L" } };

function cohort(seed = 7, n = 150) {
  const rng = makeRng(seed);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const inside = i % 2 === 0;
    const r = inside ? Math.sqrt(rng.uniform(0, 0.5)) : Math.sqrt(rng.uniform(1.5, 3.6));
    const th = rng.uniform(0, Math.PI * 2);
    pts.push({ z: [r * Math.cos(th), r * Math.sin(th)], y: inside ? -1 : 1 });
  }
  return pts;
}
const DATA = cohort();

const MAPS = {
  lin: {
    label: "straight line",
    phi: (z) => [z[0], z[1]],
    axes: ["Sodium, deviations from centre", "Potassium, deviations from centre"],
    /* The identity map, so the lifted panel IS the measurement panel. Saying so
       is the point: a linear SVM performs no transformation. */
    same: true,
  },
  sq: {
    label: "squared features",
    phi: (z) => [z[0] * z[0], z[1] * z[1]],
    axes: ["(sodium deviation)²", "(potassium deviation)²"],
    same: false,
  },
};

function fit(map, C) {
  const P = DATA.map((p) => map.phi(p.z));
  const y = DATA.map((p) => p.y);
  const K = P.map((a) => P.map((b) => a[0] * b[0] + a[1] * b[1]));
  const { alpha, b } = solveSVM(K, y, C);
  const w = [0, 1].map((j) => alpha.reduce((s, a, i) => s + a * y[i] * P[i][j], 0));
  const sv = new Set(DATA.map((_, i) => i).filter((i) => alpha[i] > 1e-8));
  const f = P.map((p) => w[0] * p[0] + w[1] * p[1] + b);
  return {
    P, w, b, f, sv,
    marginW: 2 / (Math.hypot(w[0], w[1]) || 1),
    wrong: y.filter((yi, i) => yi * f[i] <= 0).length,
  };
}

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function canvasIn(host, w, h) {
  host.textContent = "";
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function frame(ctx, box, xd, yd, xLabel, yLabel, ticksX, ticksY, fmtX, fmtY) {
  const { x, y, w, h } = box;
  const sx = (v) => x + ((v - xd[0]) / (xd[1] - xd[0])) * w;
  const sy = (v) => y + h - ((v - yd[0]) / (yd[1] - yd[0])) * h;
  ctx.save();
  ctx.fillStyle = css("--surface-1"); ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = css("--grid"); ctx.lineWidth = 1;
  for (const t of ticksX) {
    if (t < xd[0] || t > xd[1]) continue;
    ctx.beginPath(); ctx.moveTo(Math.round(sx(t)) + 0.5, y); ctx.lineTo(Math.round(sx(t)) + 0.5, y + h); ctx.stroke();
  }
  for (const t of ticksY) {
    if (t < yd[0] || t > yd[1]) continue;
    ctx.beginPath(); ctx.moveTo(x, Math.round(sy(t)) + 0.5); ctx.lineTo(x + w, Math.round(sy(t)) + 0.5); ctx.stroke();
  }
  ctx.fillStyle = css("--ink-3"); ctx.font = `11px ${css("--font")}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const t of ticksX) { if (t >= xd[0] && t <= xd[1]) ctx.fillText(fmtX(t), sx(t), y + h + 5); }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (const t of ticksY) { if (t >= yd[0] && t <= yd[1]) ctx.fillText(fmtY(t), x - 6, sy(t)); }
  ctx.fillStyle = css("--ink-2"); ctx.font = `12px ${css("--font")}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(xLabel, x + w / 2, y + h + 20);
  ctx.save();
  ctx.translate(x - 34, y + h / 2); ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "bottom"; ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  ctx.restore();
  return { sx, sy };
}

/* The corridor and its centre line, in whatever coordinates the caller is in:
   a quad built from the boundary's own direction, so it never folds. */
function corridor(ctx, sx, sy, w, b, box) {
  const nrm = Math.hypot(w[0], w[1]) || 1;
  const ux = -w[1] / nrm, uy = w[0] / nrm, nx = w[0] / nrm, ny = w[1] / nrm;
  const off = 1 / nrm, L = 500;
  const px = (-b * w[0]) / (nrm * nrm), py = (-b * w[1]) / (nrm * nrm);
  const C = (su, sn) => [px + su * L * ux + sn * off * nx, py + su * L * uy + sn * off * ny];
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  ctx.beginPath();
  [C(1, 1), C(-1, 1), C(-1, -1), C(1, -1)].forEach(([X, Y], k) =>
    (k ? ctx.lineTo(sx(X), sy(Y)) : ctx.moveTo(sx(X), sy(Y))));
  ctx.closePath();
  ctx.fillStyle = css("--c-highlight"); ctx.globalAlpha = 0.09; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = css("--c-highlight");
  for (const [sn, dash, lw] of [[1, [4, 4], 1], [-1, [4, 4], 1], [0, null, 2]]) {
    ctx.setLineDash(dash ?? []); ctx.lineWidth = lw;
    const a = [px + L * ux + sn * off * nx, py + L * uy + sn * off * ny];
    const c = [px - L * ux + sn * off * nx, py - L * uy + sn * off * ny];
    ctx.beginPath(); ctx.moveTo(sx(a[0]), sy(a[1])); ctx.lineTo(sx(c[0]), sy(c[1])); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.restore();
}

/* On the LEFT the same three lines are curves, so they are traced as level sets
   of w.phi(z) + b rather than drawn as lines. One formula, two pictures. */
function levelCurves(ctx, sx, sy, map, r, box, xd, yd) {
  const g = (zx, zy) => { const p = map.phi([zx, zy]); return r.w[0] * p[0] + r.w[1] * p[1] + r.b; };
  const N = 220;
  const at = (i, j) => [xd[0] + ((xd[1] - xd[0]) * i) / N, yd[0] + ((yd[1] - yd[0]) * j) / N];
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  /* the corridor as a shaded region: every cell whose value is within one
     margin of zero. Cheap, exact, and it needs no contour tracing. */
  const cw = box.w / N, ch = box.h / N;
  ctx.fillStyle = css("--c-highlight"); ctx.globalAlpha = 0.09;
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const [zx, zy] = at(i, j);
      if (Math.abs(g(zx, zy)) <= 1) ctx.fillRect(sx(zx) - cw / 2, sy(zy) - ch / 2, cw + 1, ch + 1);
    }
  }
  ctx.globalAlpha = 1;
  /* the three level sets, by marching each row and each column for a crossing */
  ctx.strokeStyle = css("--c-highlight");
  for (const [level, dash, lw] of [[1, [4, 4], 1], [-1, [4, 4], 1], [0, null, 2]]) {
    ctx.setLineDash(dash ?? []); ctx.lineWidth = lw;
    ctx.beginPath();
    for (let j = 0; j <= N; j += 1) {
      for (let i = 0; i < N; i += 1) {
        const [ax, ay] = at(i, j), [bx, by] = at(i + 1, j);
        const va = g(ax, ay) - level, vb = g(bx, by) - level;
        if (va === 0 || (va < 0) !== (vb < 0)) {
          const t = va / (va - vb);
          const X = ax + (bx - ax) * t;
          ctx.moveTo(sx(X) - 0.9, sy(ay)); ctx.lineTo(sx(X) + 0.9, sy(ay));
        }
      }
    }
    for (let i = 0; i <= N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        const [ax, ay] = at(i, j), [bx, by] = at(i, j + 1);
        const va = g(ax, ay) - level, vb = g(bx, by) - level;
        if (va === 0 || (va < 0) !== (vb < 0)) {
          const t = va / (va - vb);
          const Y = ay + (by - ay) * t;
          ctx.moveTo(sx(ax), sy(Y) - 0.9); ctx.lineTo(sx(ax), sy(Y) + 0.9);
        }
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.restore();
}

function dots(ctx, sx, sy, coords, r, box) {
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  DATA.forEach((p, i) => {
    const isSV = r.sv.has(i);
    const cx = sx(coords[i][0]), cy = sy(coords[i][1]);
    ctx.beginPath(); ctx.arc(cx, cy, isSV ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fillStyle = p.y > 0 ? css("--c-event") : css("--c-nonevent");
    ctx.globalAlpha = isSV ? 1 : 0.34; ctx.fill();
    if (isSV) {
      ctx.globalAlpha = 0.85; ctx.lineWidth = 1.25; ctx.strokeStyle = css("--ink-1");
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function caption(ctx, box, text, note) {
  ctx.save();
  ctx.font = `600 12px ${css("--font")}`;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = css("--ink-2");
  ctx.fillText(text, box.x, box.y - 8);
  if (note) {
    ctx.font = `11px ${css("--font")}`;
    ctx.textAlign = "right"; ctx.fillStyle = css("--ink-3");
    ctx.fillText(note, box.x + box.w, box.y - 8);
  }
  ctx.restore();
}

const PAD_L = 52, PAD_R = 8, PAD_T = 22, PAD_B = 44, GAP = 42;

function render(host, meas, kern, C, realUnits, W) {
  const map = MAPS[kern];
  const r = fit(map, C);
  const side = Math.floor((W - PAD_L - PAD_R - GAP - PAD_L) / 2);
  const H = PAD_T + side + PAD_B;
  const ctx = canvasIn(host, W, H);

  /* LEFT — the measurements. Real units are a relabelling of the z axis, which
     is linear, so the picture is identical either way. */
  const lbox = { x: PAD_L, y: PAD_T, w: side, h: side };
  const zd = [-2.6, 2.6];
  const u = (k, z) => REF[k].mid + REF[k].half * z;
  const L = frame(
    ctx, lbox, zd, zd,
    realUnits ? `${REF.na.name} (${REF.na.unit})` : "Sodium, deviations from centre",
    realUnits ? `${REF.k.name} (${REF.k.unit})` : "Potassium, deviations from centre",
    realUnits ? [130, 135, 140, 145, 150].map((v) => (v - REF.na.mid) / REF.na.half) : [-2, -1, 0, 1, 2],
    realUnits ? [3, 3.5, 4, 4.5, 5, 5.5].map((v) => (v - REF.k.mid) / REF.k.half) : [-2, -1, 0, 1, 2],
    (t) => (realUnits ? String(Math.round(u("na", t))) : String(t)),
    (t) => (realUnits ? String(Math.round(u("k", t) * 10) / 10) : String(t))
  );
  levelCurves(ctx, L.sx, L.sy, map, r, lbox, zd, zd);
  dots(ctx, L.sx, L.sy, DATA.map((p) => p.z), r, lbox);
  caption(ctx, lbox, "As measured");

  /* RIGHT — the same fit, in the space the kernel maps into. */
  const rbox = { x: PAD_L + side + GAP + PAD_L, y: PAD_T, w: side, h: side };
  const pd = map.same ? zd : [-0.15, 3.8];
  const R = frame(
    ctx, rbox, pd, pd, map.axes[0], map.axes[1],
    map.same ? [-2, -1, 0, 1, 2] : [0, 1, 2, 3],
    map.same ? [-2, -1, 0, 1, 2] : [0, 1, 2, 3],
    String, String
  );
  corridor(ctx, R.sx, R.sy, r.w, r.b, rbox);
  dots(ctx, R.sx, R.sy, r.P, r, rbox);
  caption(ctx, rbox, map.same ? "After φ — unchanged" : "After φ — squared");

  meas.innerHTML = `C = ${C} &middot; kernel <b>${map.label}</b> &middot; support vectors `
    + `<b>${r.sv.size} of ${DATA.length}</b> &middot; margin <b>${r.marginW.toFixed(2)}</b> `
    + `&middot; misclassified <b>${r.wrong} of ${DATA.length}</b> `
    + `(accuracy ${(1 - r.wrong / DATA.length).toFixed(3)})`;
}

const $ = (id) => document.getElementById(id);
function draw() {
  const C = LADDER[+$("ci").value];
  $("clabel").textContent = String(C);
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  const W = +$("frame").value;
  render($("k1"), $("m1"), $("kern").value, C, $("units").checked, W);
  render($("k2"), $("m2"), "lin", C, $("units").checked, W);
}
for (const id of ["kern", "ci", "units", "frame", "dark"]) {
  $(id).addEventListener(id === "ci" ? "input" : "change", draw);
}
draw();
