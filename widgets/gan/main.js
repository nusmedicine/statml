/* ============================================================================
   Widget 108 · Generative Adversarial Networks (`gan`) — PHM5005 10-3b
   cells 41–42: the base GAN, which the notebook gives as a table of the two
   players, the minimax objective and a pseudocode loop, with no code.

   The idea (catalogue § The DL Frontiers arc, slot 108): the generator is
   trained only through the discriminator — it moves its samples along D's
   slope — and at the end D(x) is ½ where the data are. MEASURED 2026-10-19
   (§ 108 MEASURED AND MOCKED, `_lab/gan-measure.mjs`): on two modes the loop
   ends near the data on every one of 40 seeds with no collapse; one bell
   stalls with D flat at ½ while G is off the data. D does not reach ½
   between the modes: G maps noise to x continuously, so a thin bridge of
   samples stays in the gap and D(0) is 0.07–0.24 there.

   HIS CALLS (2026-10-19, `_lab/gan-mock.html`, all nine the recommendation
   but where noted): presses B — each round is 20 D steps then 20 G steps,
   one press per half, its label alternating Update D / Update G, Train
   playing the 150 rounds; the axis plain x (one number a sample; "digits?"
   was his question); the card the loop as a diagram plus the loss being
   minimised (his ask, "could the pseudocode be drawn as a diagram"); two
   modes; Goodfellow et al.'s z → x lines; the arrows; the loss panel;
   colours real `--c-reference`, generated `--c-empirical`, D `--c-theory`,
   G's step `--c-slope`; no collapse control; Seed the only rail control.

   compute() trains once per seed (~215 ms, `engine.js`) and keeps a snapshot
   of both networks after every half; the presses reveal them. The picture
   draws G at 2,000 evenly spaced quantiles of z, so it needs no draws.
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import { train, net, slope, sig, normalQuantile, SCHEDULE } from "./engine.js";

const ROUNDS = SCHEDULE.rounds, LAST = 2 * ROUNDS;           // snapshots: 0 = start, odd = after Update D, even = after Update G
const PRESS_MS = 900, RUN_MS = 34;
const X0 = -4.5, X1 = 4.5, BW = 0.25, NB = Math.round((X1 - X0) / BW);
const QZ = Array.from({ length: 2000 }, (_, i) => normalQuantile((i + 0.5) / 2000));
const LINES = Array.from({ length: 21 }, (_, j) => normalQuantile((j + 0.5) / 21));

/* ------------------------------------------------------------- stages */

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** the half being shown: the snapshot k, a tween from k − 1 at progress e (1 = arrived) */
function viewOf(anim) {
  const k = anim?.k ?? 0, f = anim?.f ?? 1;
  return { k, e: f >= 1 ? 1 : anim.mode === "run" ? f : ease(f) };
}
const roundOf = (k) => Math.ceil(k / 2);
/** the half the card marks: none before training, while Train plays and after the last round; else the half just run */
const litOf = (anim) => (!anim || anim.k === 0 || anim.k >= LAST || anim.mode === "run" ? "" : anim.k % 2 ? "d" : "g");
/** G and D at the shown point: the half in motion is the one between its two snapshots */
function netsOf(state, anim) {
  const { k, e } = viewOf(anim), b = state.snaps[k];
  if (e >= 1 || k === 0) return { G: (z) => net(b.G, z), D: (x) => net(b.D, x), Dp: b.D };
  const a = state.snaps[k - 1];
  if (k % 2) return { G: (z) => net(b.G, z), D: (x) => net(a.D, x) + (net(b.D, x) - net(a.D, x)) * e, Dp: b.D, Dlo: a.D, De: e };
  return { G: (z) => net(a.G, z) + (net(b.G, z) - net(a.G, z)) * e, D: (x) => net(b.D, x), Dp: b.D };
}

/* ------------------------------------------------------------- strings */

const sgn = (s) => String(s).replace(/-/g, "−");
const f2 = (v) => sgn(v.toFixed(2));
const pct = (v) => `${Math.round(100 * v)}%`;

const S = {
  subtitle:
    "A generative adversarial network (GAN) trains two networks in turn: a generator G, which maps random noise z to a sample, and a discriminator D, which outputs the probability D(x) that a sample x is real data. " +
    "Here each sample is one number x; the same training generates images when x is an image.",
  seedLabel: "Seed",
  seedDetail: "the random draws: the data, the starting weights, the noise and the batches",
  topTitle: "Real and generated samples, and D(x)",
  beyond: (p) => `${p} of generated samples beyond ±4.5`,
  zLabel: "z ~ N(0, 1)",
  linesNote: "each line joins a value of z to G(z)",
  lossTitle: "Loss per iteration",
  lossLD: "L_D",
  lossLG: "L_G",
  lossAtHalf: "dashed: each loss when D(x) = ½ (2 ln 2 for L_D, ln 2 for L_G)",
  lossWait: "after Update D",
  round: "iteration",
  card: { x: (x) => `x = ${f2(x)}`, d: (v) => `D(x) = ${f2(v)}`, real: (v) => `real data: ${pct(v)} in this bin`, gen: (v) => `generated: ${pct(v)} in this bin` },
  legend: { real: "real data, 1,000 samples (modes at −2 and 2)", gen: "generated samples, G(z)", d: "D(x), the probability that x is real", step: "the direction in which Update G moves a sample" },
  tile: {
    round: "Iteration",
    roundNote: "each iteration: Update D, then Update G",
    modes: "D(−2) · D(2), at the two modes",
    modesNote: "½: real and generated samples given the same probability",
    gap: "D(0), between the modes",
    gapNote: "where the real data have almost no samples",
    split: "Generated samples, x < 0 · x > 0",
    splitNote: (v) => `the real data: ${v}`,
  },
};

const CAP = {
  start: "Before training. G maps each value of noise z to an x: the lines join 21 values of z to their x, and the outline shows where 2,000 values of z map. D(x) is D's probability that x is real data. Update D trains D for 20 steps.",
  d: "Update D: 20 steps that raise D(x) on real data and lower it on generated samples, with G held fixed. The arrows show the direction in which Update G will move each generated sample: the direction in which D(x) increases.",
  g: "Update G: 20 steps that move each generated sample in the direction in which D(x) increases, with D held fixed. L_G contains no real data: G is updated through D(x) and its slope only.",
  run: (r) => `Training, iteration ${r} of ${ROUNDS}: each iteration, Update D, then Update G.`,
  end: "After 150 iterations. Where the real data are, D(x) is near ½, and both losses are near their values for D(x) = ½. The generated samples cover both modes; some remain between them, because G maps z to x continuously, and there D(x) is low.",
};
function captionOf(anim) {
  const { k } = viewOf(anim);
  if (anim?.mode === "run" && !(anim.k >= LAST && anim.f >= 1)) return CAP.run(Math.max(1, roundOf(k)));
  if (k === 0) return CAP.start;
  if (k >= LAST) return CAP.end;
  return k % 2 ? CAP.d : CAP.g;
}

/* --------------------------------------------------------- the card: the loop as a diagram */

/* drawn in a 540-unit viewBox that scales with the card (104–106's); colours through `style`, since SVG attributes do not resolve var() */
const svEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svBox = (x, y, w, h, t, color, dashed = false, weight = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:var(--surface-1);stroke:${color};stroke-width:1.6${dashed ? ";stroke-dasharray:4 3" : ""}"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" style="fill:var(--ink-1);${weight}">${svEsc(t)}</text>`;
const svText = (x, y, t, fill = "var(--ink-2)", anchor = "start", style = "") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${fill};${style}">${svEsc(t)}</text>`;
function svPath(pts, color, arrow = true) {
  let s = `<polyline points="${pts.map((q) => q.join(",")).join(" ")}" style="fill:none;stroke:${color};stroke-width:1.5"/>`;
  if (arrow) {
    const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1], a = Math.atan2(y1 - y0, x1 - x0), h = 7;
    const p = [[x1, y1], [x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)], [x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)]];
    s += `<polygon points="${p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" style="fill:${color}"/>`;
  }
  return s;
}
/* the diagram's paths, shared by the drawing and the moving dot */
const P = {
  real: [[126, 29], [200, 29], [240, 58], [262, 62]],
  fake: [[92, 107], [126, 107]],
  gOut: [[184, 107], [222, 107], [240, 86], [262, 84]],
  dOut: [[320, 74], [350, 74]],
  toLoss: [[394, 74], [420, 74]],
  backD: [[476, 90], [476, 152], [306, 152], [306, 98]],
  backDG: [[278, 98], [278, 152], [156, 152], [156, 126]],
};
const FWD = { d: [[...P.real, [292, 74], [476, 74]], [[50, 107], ...P.fake, ...P.gOut, [292, 74], [476, 74]]], g: [[[50, 107], ...P.fake, ...P.gOut, [292, 74], [476, 74]]] };
const BACK = { d: P.backD, g: [...P.backD, ...P.backDG] };
const DIAGRAM_LABEL = "The training loop: the real data and G's samples go into D, D(x) into the loss; Update D computes the gradient of L_D for D's weights; Update G computes the gradient of L_G through D, held fixed, for G's weights.";

function diagramSVG(lit) {
  const ink = "var(--ink-3)", sl = "var(--c-slope)", fade = (on) => (on ? "" : ` style="opacity:0.28"`);
  const heldG = lit === "d", heldD = lit === "g";
  let s = `<g${fade(lit !== "g")}>${svBox(8, 14, 118, 30, "x_real, the data", "var(--c-reference)")}${svPath(P.real, ink)}</g>`;
  s += svBox(8, 92, 84, 30, "z ~ N(0, 1)", ink) + svPath(P.fake, ink);
  s += svBox(128, 90, 56, 34, "G", "var(--c-empirical)", heldG, "font-weight:600");
  if (heldG) s += svText(156, 139, "held fixed", "var(--ink-3)", "middle", "font-style:italic");
  s += svPath(P.gOut, ink) + svText(196, 124, "x_fake = G(z)");
  s += svBox(264, 52, 56, 44, "D", "var(--c-theory)", heldD, "font-weight:600");
  if (heldD) s += svText(292, 45, "held fixed", "var(--ink-3)", "middle", "font-style:italic");
  s += svPath(P.dOut, ink) + svText(355, 78, "D(x)", "var(--ink-1)") + svPath(P.toLoss, ink);
  s += svBox(422, 58, 108, 32, lit === "g" ? "L_G" : lit === "d" ? "L_D" : "L_D, L_G", ink);
  if (lit === "d") s += svPath(P.backD, sl) + svText(330, 146, "update D's weights", sl);
  if (lit === "g") s += svPath(P.backD, sl) + svPath(P.backDG, sl) + svText(316, 146, "back through D", sl) + svText(168, 146, "update G's weights", sl);
  return `<svg viewBox="0 0 540 166" role="img" aria-label="${svEsc(DIAGRAM_LABEL)}" style="display:block;width:100%;height:auto;font:12px var(--font)">${s}<g data-sv="motion"></g></svg>`;
}

const MATHML = mathmlRenders();
const mi = (s) => `<mi>${s}</mi>`, mo = (s) => `<mo>${s}</mo>`, mn = (s) => `<mn>${s}</mn>`;
const sub = (b, s) => `<msub>${b}${s}</msub>`;
const Lx = (s) => sub(`<mi mathvariant="bold">L</mi>`, mi(s));
const log = `<mi>log</mi><mo>&#x2061;</mo><mspace width="0.17em"/>`;
const Dof = (x) => `${mi("D")}${mo("(")}${x}${mo(")")}`;
const xr = sub(mi("x"), `<mtext>real</mtext>`), xf = sub(mi("x"), `<mtext>fake</mtext>`);
const EQ = {
  d: { math: `<math display="block"><mrow>${Lx("D")}${mo("=")}${mo("−")}${mo("[")}${log}${Dof(xr)}${mo("+")}${log}${mo("(")}${mn(1)}${mo("−")}${Dof(xf)}${mo(")")}${mo("]")}</mrow></math>`, plain: "L_D = −[ log D(x_real) + log(1 − D(x_fake)) ]" },
  g: { math: `<math display="block"><mrow>${Lx("G")}${mo("=")}${mo("−")}${log}${Dof(`${mi("G")}${mo("(")}${mi("z")}${mo(")")}`)}</mrow></math>`, plain: "L_G = −log D(G(z))" },
};
const LEAD = { "": "Each iteration: Update D to minimise L_D, then Update G to minimise L_G.", d: "Update D to minimise", g: "Update G to minimise" };
const NOTE = "In the standard algorithm each iteration has one update of each; here each press repeats its update 20 times, on fresh batches of 64. L_D is low when D(x) is near 1 on real data and near 0 on generated samples; L_G is low when D(x) is near 1 on generated samples.";

let mathHost = null, mathKey = null;
function renderCard(lit) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === lit) return;
  mathKey = lit;
  const eq = lit ? `<div class="w-math-eq"><span style="color:var(--ink-2)">${LEAD[lit]}</span> ${MATHML ? EQ[lit].math : EQ[lit].plain}</div>` : `<div class="w-math-eq"><span style="color:var(--ink-2)">${LEAD[""]}</span></div>`;
  mathHost.innerHTML = `<div class="w-math-schema" style="margin-bottom:var(--sp-2)">${diagramSVG(lit)}</div>${eq}<div class="w-math-note">${NOTE}</div>`;
}
function along(Pts, t) {
  const seg = Pts.slice(1).map((q, i) => Math.hypot(q[0] - Pts[i][0], q[1] - Pts[i][1])), Ln = seg.reduce((a, b) => a + b, 0);
  let d = t * Ln;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = seg[i] ? d / seg[i] : 0; return [Pts[i][0] + (Pts[i + 1][0] - Pts[i][0]) * f, Pts[i][1] + (Pts[i + 1][1] - Pts[i][1]) * f]; } d -= seg[i]; }
  return Pts[Pts.length - 1];
}
const svDot = (p, col) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" style="fill:${col}"/>`;
/** a press: dots forward over its first 55%, the gradient back over the next 40% */
function updateMotion(anim, lit) {
  const layer = mathHost?.querySelector('[data-sv="motion"]');
  if (!layer) return;
  let s = "";
  if (lit && anim.mode === "step" && anim.f < 1) {
    const f = anim.f;
    if (f < 0.55) for (const path of FWD[lit]) s += svDot(along(path, ease(f / 0.55)), "var(--ink-1)");
    else if (f < 0.95) s += svDot(along(BACK[lit], ease((f - 0.55) / 0.4)), "var(--c-slope)");
  }
  layer.innerHTML = s;
}

/* ------------------------------------------------------------- layout */

const PAD = 10;
function layoutOf(w) {
  const L = PAD + 8, R = w - PAD - 22;
  const top = { y0: 34, y1: 214 }, zax = 276, loss = { y0: 356, y1: 456 };
  return { L, R, top, zax, loss, capTop: loss.y1 + 40, height: loss.y1 + 40 + 4 * 17 };
}
const histOf = (xs) => {
  const h = new Array(NB).fill(0);
  for (const x of xs) { const b = Math.floor((x - X0) / BW); if (b >= 0 && b < NB) h[b]++; }
  return h.map((c) => c / xs.length);                         // the share in each bin
};

/* ------------------------------------------------------------- drawing helpers */

function txt(ctx, colors, s, x, y, { size = colors.fsXs, fill = colors.ink2, align = "left", weight = "", halo = false } = {}) {
  ctx.save(); ctx.font = `${weight ? weight + " " : ""}${size} ${colors.font}`; ctx.textAlign = align;
  if (halo) { ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y); ctx.restore();
}
function line(ctx, x1, y1, x2, y2, col, w = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function wrapText(ctx, colors, str, x, y, maxW, lh) {
  ctx.save(); ctx.font = `${colors.fsSm} ${colors.font}`;
  const lines = []; let cur = "";
  for (const word of str.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  lines.forEach((l, i) => txt(ctx, colors, l, x, y + i * lh, { size: colors.fsSm, fill: colors.ink1 }));
}

/* ------------------------------------------------------------- the panels */

function drawTop(ctx, colors, Lo, state, nets, pointer) {
  const { L, R, top } = Lo, px = (x) => L + ((x - X0) / (X1 - X0)) * (R - L);
  const fake = QZ.map(nets.G), hf = histOf(fake), hr = state.realHist;
  const hmax = Math.max(0.14, ...hr) * 1.08;                  // the panel's height: the real data's tallest bin, fixed for the run
  const yP = (v) => top.y1 - (Math.min(v, hmax) / hmax) * (top.y1 - top.y0), yD = (p) => top.y1 - p * (top.y1 - top.y0);
  txt(ctx, colors, S.topTitle, PAD, 14, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  const off = fake.filter((x) => x < X0 || x > X1).length;
  if (off) txt(ctx, colors, S.beyond(pct(off / fake.length)), R, 14, { align: "right", fill: colors.ink3 });
  /* the real data: bars */
  ctx.save(); ctx.fillStyle = colors.reference; ctx.globalAlpha = 0.35;
  hr.forEach((v, b) => { const x = X0 + b * BW; if (v > 0) ctx.fillRect(px(x) + 0.5, yP(v), px(x + BW) - px(x) - 1, top.y1 - yP(v)); });
  ctx.restore();
  /* D = ½ and the right axis */
  line(ctx, L, yD(0.5), R, yD(0.5), colors.grid, 1, [4, 4]);
  for (const [p, t] of [[1, "1"], [0.5, "½"], [0, "0"]]) txt(ctx, colors, t, R + 6, yD(p) + 4, { fill: colors.theory });
  /* the generated samples: a step outline, clipped to the panel */
  ctx.save(); ctx.beginPath(); ctx.rect(L, top.y0 - 4, R - L, top.y1 - top.y0 + 4); ctx.clip();
  ctx.strokeStyle = colors.empirical; ctx.lineWidth = 2; ctx.beginPath();
  hf.forEach((v, b) => { const x = X0 + b * BW; if (b === 0) ctx.moveTo(px(x), yP(v)); else ctx.lineTo(px(x), yP(v)); ctx.lineTo(px(x + BW), yP(v)); });
  ctx.stroke(); ctx.restore();
  /* a bin taller than the panel: its share printed at the top, once for each run of neighbouring clipped bins (audit W8) */
  for (let b = 0; b < NB; b++) {
    if (hf[b] <= hmax) continue;
    let e = b, best = b;
    while (e + 1 < NB && hf[e + 1] > hmax) { e++; if (hf[e] > hf[best]) best = e; }
    txt(ctx, colors, pct(hf[best]), px(X0 + (best + 0.5) * BW), top.y0 - 3, { align: "center", fill: colors.empirical, weight: "600", halo: true });
    b = e;
  }
  /* D(x) */
  ctx.save(); ctx.strokeStyle = colors.theory; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 180; i++) { const x = X0 + ((X1 - X0) * i) / 180, y = yD(sig(nets.D(x))); i ? ctx.lineTo(px(x), y) : ctx.moveTo(px(x), y); }
  ctx.stroke(); ctx.restore();
  /* the step Update G gives each of the 21 line samples: d log D / dx, from the D now shown */
  const ay = top.y1 - 9;
  ctx.save(); ctx.strokeStyle = colors.slope; ctx.fillStyle = colors.slope; ctx.lineWidth = 1.8;
  for (const z of LINES) {
    const x = nets.G(z);
    if (x < X0 || x > X1) continue;
    const s = sig(nets.D(x)), g = (1 - s) * dSlope(nets, x), len = Math.max(-34, Math.min(34, g * 22)), x0 = px(x);
    if (Math.abs(len) < 2.5) { ctx.beginPath(); ctx.arc(x0, ay, 1.8, 0, 2 * Math.PI); ctx.fill(); continue; }
    const x1 = x0 + len, dir = Math.sign(len);
    ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1 - dir * 3, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + dir * 1.5, ay); ctx.lineTo(x1 - dir * 4.5, ay - 3.8); ctx.lineTo(x1 - dir * 4.5, ay + 3.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  /* the x axis */
  line(ctx, L, top.y1 + 0.5, R, top.y1 + 0.5, colors.axis);
  for (let x = -4; x <= 4; x += 2) txt(ctx, colors, sgn(String(x)), px(x), top.y1 + 14, { align: "center", fill: colors.ink3, halo: true });
  txt(ctx, colors, "x", R + 6, top.y1 + 14, { fill: colors.ink2 });
  /* the hover card */
  if (pointer && pointer.x >= L && pointer.x <= R && pointer.y >= top.y0 && pointer.y <= top.y1) {
    const x = X0 + ((pointer.x - L) / (R - L)) * (X1 - X0), b = Math.min(NB - 1, Math.floor((x - X0) / BW));
    line(ctx, pointer.x, top.y0, pointer.x, top.y1, colors.ink3, 1, [2, 3]);
    const rows = [[S.card.x(x), colors.ink1], [S.card.d(sig(nets.D(x))), colors.theory], [S.card.real(hr[b]), colors.ink2], [S.card.gen(hf[b]), colors.empirical]];
    const cw = 168, ch = 12 + rows.length * 15;
    let cx = pointer.x + 12; if (cx + cw > R) cx = pointer.x - 12 - cw;
    const cy = top.y0 + 4;
    ctx.save(); ctx.fillStyle = colors.surface; ctx.fillRect(cx, cy, cw, ch); ctx.strokeStyle = colors.ink3; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1); ctx.restore();
    rows.forEach(([t, c], j) => txt(ctx, colors, t, cx + 8, cy + 17 + j * 15, { fill: c, weight: j ? "" : "600" }));
  }
  return px;
}
/** d logit D / dx at x, following the tween of the D half in motion */
function dSlope(nets, x) {
  if (nets.Dlo) return slope(nets.Dlo, x) + (slope(nets.Dp, x) - slope(nets.Dlo, x)) * nets.De;
  return slope(nets.Dp, x);
}

function drawLines(ctx, colors, Lo, nets, px) {
  const { L, R, top, zax } = Lo, zx = (z) => L + ((z + 3) / 6) * (R - L);
  ctx.save(); ctx.strokeStyle = colors.ink3; ctx.lineWidth = 1; ctx.globalAlpha = 0.75;
  for (const z of LINES) {
    const x = Math.max(X0, Math.min(X1, nets.G(z)));
    ctx.beginPath(); ctx.moveTo(zx(z), zax); ctx.lineTo(px(x), top.y1 + 20); ctx.stroke();
  }
  ctx.restore();
  line(ctx, L, zax + 0.5, R, zax + 0.5, colors.axis);
  for (let z = -3; z <= 3; z++) txt(ctx, colors, sgn(String(z)), zx(z), zax + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, S.zLabel, R, zax - 6, { align: "right", fill: colors.ink2, halo: true });
  txt(ctx, colors, S.linesNote, L, zax + 30, { fill: colors.ink3 });
}

function drawLoss(ctx, colors, Lo, state, anim) {
  const { L, R, loss } = Lo, { k } = viewOf(anim);
  txt(ctx, colors, S.lossTitle, PAD, loss.y0 - 16, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  const lx = (r) => L + (r / ROUNDS) * (R - L), Y = (v) => loss.y1 - (Math.min(v, state.lossMax) / state.lossMax) * (loss.y1 - loss.y0);
  line(ctx, L, loss.y0, L, loss.y1 + 0.5, colors.axis); line(ctx, L, loss.y1 + 0.5, R, loss.y1 + 0.5, colors.axis);
  for (let v = 0; v <= state.lossMax + 1e-9; v += 1) txt(ctx, colors, String(v), L - 4, Y(v) + 4, { align: "right", fill: colors.ink3 });
  txt(ctx, colors, "0", L, loss.y1 + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, S.round, (L + R) / 2, loss.y1 + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, String(ROUNDS), R, loss.y1 + 14, { align: "center", fill: colors.ink3 });
  for (const v of [2 * Math.LN2, Math.LN2]) line(ctx, L, Y(v), R, Y(v), colors.grid, 1, [4, 4]);
  txt(ctx, colors, S.lossAtHalf, R, loss.y0 - 16, { align: "right", fill: colors.ink3 });
  if (k === 0) { txt(ctx, colors, S.lossWait, (L + R) / 2, (loss.y0 + loss.y1) / 2, { align: "center", fill: colors.ink3 }); return; }
  /* L_D is known after round r's Update D (snapshot 2r − 1), L_G after its Update G (2r) */
  for (const [key, col, name, at] of [["LD", colors.theory, S.lossLD, (r) => 2 * r - 1], ["LG", colors.empirical, S.lossLG, (r) => 2 * r]]) {
    const pts = [];
    for (let r = 1; r <= ROUNDS && at(r) <= k; r++) pts.push([lx(r), Y(state.snaps[at(r)][key])]);
    if (!pts.length) continue;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath();
    if (pts.length === 1) { ctx.arc(pts[0][0], pts[0][1], 2.5, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill(); }
    else { pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    ctx.restore();
    const [ex, ey] = pts[pts.length - 1];
    txt(ctx, colors, name, Math.min(ex + 6, R - 20), ey + (key === "LD" ? -6 : 14), { fill: col, weight: "600", halo: true });
  }
}

/* ------------------------------------------------------------- widget */

defineWidget({
  slug: "gan",
  status: "draft",
  title: "Deep Learning - Frontiers: Generative Adversarial Networks",
  subtitle: S.subtitle,
  layout: "side",
  height: (p) => layoutOf(p.w ?? 550).height,
  pointer: true,

  params: {
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 40, default: 4 },
    /* authoring escape hatch, first render only: halves already run (0–300; even = whole rounds) */
    shown: { type: "int", min: 0, max: LAST, default: 0, hidden: true },
  },

  legend: [
    { token: "reference", label: S.legend.real, mark: "bar" },
    { token: "empirical", label: S.legend.gen, mark: "line" },
    { token: "theory", label: S.legend.d, mark: "line" },
    { token: "slope", label: S.legend.step, mark: "line" },
  ],

  compute: ({ params }) => {
    const run = train(params.seed, SCHEDULE);
    const lossMax = Math.max(2, Math.ceil(Math.max(...run.snaps.slice(1).flatMap((s) => [s.LD, s.LG]).filter(Number.isFinite)) * 2) / 2);
    const left = run.real.filter((x) => x < 0).length / run.real.length;
    return { snaps: run.snaps, realHist: histOf(run.real), realSplit: [left, 1 - left], lossMax };
  },

  animation: {
    stepLabel: { anim: "beat", labels: { 0: "Update D", 1: "Update G" }, default: "Update D" },
    stepTitle: { anim: "beat", labels: { 0: "Train D for 20 steps on real and generated samples", 1: "Train G for 20 steps through D, held fixed" }, default: "Train D for 20 steps on real and generated samples" },
    runLabel: "Train",
    runTitle: "Play every iteration to the end: Update D, then Update G, 150 times",

    init: ({ params, fromScratch }) => {
      const k = fromScratch ? 0 : Math.max(0, Math.min(LAST, Number(params.shown) || 0));
      return { k, f: 1, beat: k % 2, done: k >= LAST };
    },
    advance: (anim, { dt }) => {
      if (anim.mode === "run") {
        let t = anim.f + dt / RUN_MS;
        if (anim.f >= 1 && anim.k < LAST) { anim.k++; t = dt / RUN_MS; }
        while (t >= 1 && anim.k < LAST) { t -= 1; anim.k++; }
        anim.f = Math.min(1, t);
      } else {
        if (anim.f >= 1) {
          if (anim.k >= LAST) { anim.done = true; return false; }
          anim.k++; anim.f = 0;
        }
        anim.f = Math.min(1, anim.f + dt / PRESS_MS);
      }
      anim.beat = anim.k % 2;
      anim.done = anim.k >= LAST && anim.f >= 1;
      return anim.f < 1 || (anim.mode === "run" && anim.k < LAST);
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const Lo = layoutOf(w), lit = litOf(anim), nets = netsOf(state, anim);
    renderCard(lit);
    updateMotion(anim ?? {}, lit);
    const px = drawTop(ctx, colors, Lo, state, nets, pointer);
    drawLines(ctx, colors, Lo, nets, px);
    drawLoss(ctx, colors, Lo, state, anim);
    wrapText(ctx, colors, captionOf(anim), PAD, Lo.capTop, w - 2 * PAD, 17);
  },

  readout({ state, anim }) {
    const { k } = viewOf(anim), nets = netsOf(state, anim), T = S.tile, D = (x) => sig(nets.D(x));
    const left = QZ.filter((z) => nets.G(z) < 0).length / QZ.length;
    return [
      { label: T.round, value: `${roundOf(k)} of ${ROUNDS}`, note: T.roundNote },
      { label: T.modes, value: `${f2(D(-2))} · ${f2(D(2))}`, note: T.modesNote },
      { label: T.gap, value: f2(D(0)), note: T.gapNote },
      { label: T.split, value: `${pct(left)} · ${pct(1 - left)}`, note: T.splitNote(`${pct(state.realSplit[0])} · ${pct(state.realSplit[1])}`) },
    ];
  },

  summary({ state, anim }) {
    const { k } = viewOf(anim), nets = netsOf(state, anim);
    return `Iteration ${roundOf(k)} of ${ROUNDS}: D(−2) ${f2(sig(nets.D(-2)))}, D(0) ${f2(sig(nets.D(0)))}, D(2) ${f2(sig(nets.D(2)))}.`;
  },
});
