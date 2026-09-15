/* ============================================================================
   Widget 65 · U-Net and Dice — the encoder–decoder with skips, drawn to scale
   from its shapes, with each block's operation on a trained network; and
   the Dice loss, which scores a mask on its overlap with the truth.

   PHM5005 06-3: Architecture - Basic (cells 30–37, `UNet2D`) and Training /
   Evaluation (cells 38, 50–56: `DiceCELoss`, `DiceMetric`). `engine.js`
   trains the small network, `model.js` holds the arithmetic and the
   geometry, and this file the colours, the strings and the animation.

   DECISIONS, so they are not re-argued (`_lab/unet-mock.html`, then
   `_lab/unet-round2-mock.html`, Kenneth's picks 2026-09-15):

    1. TWO PAGES, U-Net · Dice, under the Topic control. Each page's controls
       show only on it (`when`).

    2. THE U IS A STAIRCASE, TO SCALE (round 2: "the diagram does not show a
       u-shape"). A slab's height follows H × W and its width C; each encoder
       level starts one step further right and each decoder level ends one
       step further left; the concatenation is the two halves under a
       `--c-dim-b` bracket with the transposed convolution's output as its
       right half; the skips are dotted across. Every slab is outlined from
       the start (2.5, the frame) and Step fills one stage in walk order.

    3. A CLICK ON A BLOCK DRAWS ITS OPERATION (round 2: "could I see a
       depiction of the operation, like the CNN widget?"), in a band under the
       U, on the maps of a TRAINED network: `engine.js`'s depth-2, base-4
       U-Net on a 16 × 16 image, trained once for 5 epochs (his pick over an
       untrained pass, whose mask was noise). The band's network is fixed; the
       U prints the shapes of the rail's Depth, Base channels and Input, and a
       deeper block's operation is drawn on the trained network's block of the
       same kind, which the band names. Block is a display parameter, so a
       click keeps the stages already added; the dropdown is the keyboard path
       to the same choice (3.6).

    4. A 1 × 1 BOTTLENECK IS THE CASE THAT FAILS (2.6): depth 4 on a 16 × 16
       input, named in `--c-extreme`.

    5. DICE IS ONE PANEL WITH THE PREDICTION DRAGGED ON IT (round 2: "drag and
       drop the prediction, don't use sliders"). The truth, the prediction and
       the pixels in both each have a colour; the list chooses the
       prediction's shape and the drag its position, written as two hidden
       display parameters so a drag keeps the count. No threshold control, no
       split band (round 2: "just illustrate this loss function").

    6. THE COUNT IS THREE PRESSES, one tile each, and the numbers print only
       when |A ∩ B| is counted (2.4).
   ========================================================================= */

import { defineWidget, shapeText, mathmlRenders, readTokens } from "../core/index.js";
import * as M from "./model.js";

/* --- primitives ------------------------------------------------------------ */

const fmt = (n) => n.toLocaleString("en-US");
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const f2 = (v) => (v < 0 ? `−${Math.abs(v).toFixed(2)}` : v.toFixed(2));
const easeOut = (t) => 1 - (1 - t) ** 3;
const wash = (hex, a) => {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
};
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

function txt(ctx, colors, s, x, y, o = {}) {
  const {
    color = colors.ink2, align = "left", size = colors.fsSm,
    baseline = "alphabetic", mono = false, weight = "",
  } = o;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size} ${mono ? colors.mono : colors.font}`.trim();
  ctx.fillText(s, x, y);
  ctx.restore();
}
const caption = (ctx, colors, s, x, y) => txt(ctx, colors, s, x, y, { color: colors.ink2, weight: "600" });
const note = (ctx, colors, s, x, y, tone, o = {}) =>
  txt(ctx, colors, s, x, y, { color: tone ?? colors.ink3, size: colors.fsXs, ...o });

function frame(ctx, x, y, w, h, stroke, width = 1) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, color, o = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = o.width ?? 1;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 6 * Math.cos(a - 0.4), y1 - 6 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 6 * Math.cos(a + 0.4), y1 - 6 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* `anim.n` presses complete, the one at index `anim.n` in flight at `anim.t` */
function revealOf(anim) {
  const n = anim?.n ?? 0;
  const t = anim?.t ?? 0;
  return { n, alphaOf: (k) => (k < n ? 1 : k === n && t > 0 ? easeOut(t) : 0), current: t > 0 ? n : n - 1 };
}

/* ============================== the U ===================================== */

const U_CAPTION = "U-Net: the encoder down, the decoder up, and the skips across";
const U_NOTE = "Shapes are channels × height × width, for a batch of 10. Click a block to see its operation.";
const BOTTLENECK_1 = "a 1 × 1 map: no height or width is left to pool";

/** ONE HIGHLIGHT AT A TIME: the stage arriving while a press is in flight,
    otherwise the chosen block once it has been added */
function litOf(reveal, stages, block) {
  if (reveal.current === reveal.n && reveal.n < stages.length) return reveal.current;
  return stages.findIndex((s, i) => s.name === block && i < reveal.n);
}

function drawU(ctx, colors, w, state, reveal, block) {
  const { stages } = state;
  const L = M.uLayout(w, state);
  const B = L.boxes;
  caption(ctx, colors, U_CAPTION, M.PAD, M.CAPTION_Y);
  note(ctx, colors, U_NOTE, M.PAD, M.NOTE_Y);
  const enc = colors.groupA;
  const dec = colors.groupB;
  const lit = litOf(reveal, stages, block);
  const byName = Object.fromEntries(stages.map((s, i) => [s.name, i]));
  const alpha = (name) => reveal.alphaOf(byName[name]);
  const isLit = (name) => byName[name] === lit;
  const mid = (b) => b.y + b.h / 2;
  const depth = state.depth;

  /* THE FRAME: every slab outlined and every level named from the start */
  for (const [name, b] of Object.entries(B)) {
    if (name.startsWith("up")) continue;
    frame(ctx, b.x, b.y, b.w, b.h, colors.grid);
  }
  ctx.save();
  ctx.fillStyle = wash(colors.ink3, 0.35);
  ctx.fillRect(B.input.x, B.input.y, B.input.w, B.input.h);
  ctx.restore();
  for (let l = 1; l <= depth; l += 1) {
    const first = l === 1 ? B.input : B[`pool${l - 1}`];
    note(ctx, colors, `enc${l}`, first.x - 6, mid(first) + 4, colors.ink2, { align: "right", mono: true });
    const last = l === 1 ? B.head : B[`dec${l}`];
    note(ctx, colors, l === 1 ? "dec1 · head" : `dec${l}`, last.x + last.w + 6, mid(last) + 4, colors.ink2, { mono: true });
  }
  note(ctx, colors, "bottleneck", B.bottleneck.x + B.bottleneck.w + 6, mid(B.bottleneck) + 4, colors.ink2, { mono: true });

  const fill = (b, tone, a, strong) => {
    ctx.fillStyle = wash(tone, strong ? 0.55 : 0.35);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    void a;
  };

  stages.forEach((s) => {
    const a = alpha(s.name);
    if (a <= 0) return;
    const b = B[s.name];
    const on = isLit(s.name);
    const tone = (base) => (on ? colors.highlight : base);
    ctx.save();
    ctx.globalAlpha = a;
    if (s.kind === "enc") {
      const from = s.level === 1 ? B.input : B[`pool${s.level - 1}`];
      arrow(ctx, from.x + from.w + 2, mid(b), b.x - 2, mid(b), colors.dims[1]);
      fill(b, enc, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(enc), on ? 2 : 1);
    } else if (s.kind === "pool") {
      const from = B[`enc${s.level}`];
      const x = b.x + b.w / 2;
      arrow(ctx, x, from.y + from.h + 2, x, b.y - 2, tone(colors.dims[0]), { width: on ? 2 : 1.2 });
      fill(b, enc, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(enc), on ? 2 : 1);
    } else if (s.kind === "bottleneck") {
      const from = B[`pool${depth}`];
      arrow(ctx, from.x + from.w + 2, mid(b), b.x - 2, mid(b), colors.dims[1]);
      fill(b, enc, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(enc), on ? 2 : 1);
    } else if (s.kind === "up") {
      const from = s.level === depth ? B.bottleneck : B[`dec${s.level + 1}`];
      const x = b.x + b.w / 2;
      arrow(ctx, x, from.y - 2, x, b.y + b.h + 2, tone(colors.dims[0]), { width: on ? 2 : 1.2 });
      fill(b, dec, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(dec), on ? 2 : 1);
    } else if (s.kind === "cat") {
      const e = B[`enc${s.level}`];
      arrow(ctx, e.x + e.w + 3, mid(b), b.x - 3, mid(b), colors.ink3, { dash: [2, 3], width: 1 });
      ctx.fillStyle = wash(enc, 0.35);
      ctx.fillRect(b.x, b.y, b.w / 2, b.h);
      frame(ctx, b.x, b.y, b.w, b.h, tone(dec), on ? 2 : 1);
      ctx.strokeStyle = tone(colors.dims[1]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x, b.y - 8); ctx.lineTo(b.x + b.w, b.y - 8); ctx.lineTo(b.x + b.w, b.y - 4);
      ctx.stroke();
    } else if (s.kind === "dec") {
      const c = B[`cat${s.level}`];
      arrow(ctx, c.x + c.w + 2, mid(b), b.x - 2, mid(b), colors.dims[1]);
      fill(b, dec, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(dec), on ? 2 : 1);
    } else if (s.kind === "head") {
      const d = B.dec1;
      arrow(ctx, d.x + d.w + 2, mid(b), b.x - 2, mid(b), colors.dims[1]);
      fill(b, colors.empirical, a, on);
      frame(ctx, b.x, b.y, b.w, b.h, tone(colors.empirical), on ? 2 : 1);
    }
    ctx.restore();
  });
  /* the up slab is the right half of its concatenation, framed after it */
  if (stages[lit]?.kind === "up") {
    const b = B[stages[lit].name];
    frame(ctx, b.x, b.y, b.w, b.h, colors.highlight, 2);
  }

  /* THE SHAPES ON THE SKIP LINES (round 3, A): the encoder's output where the
     skip starts and the concatenation where it ends, read along one row. Where
     the line is too short for both, the encoder's goes under its slab and the
     concatenation's over its bracket. */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.mono}`;
  const width = (str) => ctx.measureText(str).width;
  ctx.restore();
  for (let l = 1; l <= depth; l += 1) {
    const st = stages[byName[`enc${l}`]];
    const e = B[`enc${l}`];
    const c = B[`cat${l}`];
    const eStr = M.chw(st.C, st.H);
    const cStr = M.chw(2 * st.C, st.H);
    const roomy = c.x - (e.x + e.w) >= width(eStr) + width(cStr) + 24;
    if (alpha(`enc${l}`) > 0) {
      if (roomy) note(ctx, colors, eStr, e.x + e.w + 6, mid(e) - 5, enc, { mono: true });
      else note(ctx, colors, eStr, e.x + e.w / 2 + 8, e.y + e.h + 13, enc, { mono: true });
    }
    if (alpha(`cat${l}`) > 0) {
      if (roomy) note(ctx, colors, cStr, c.x - 6, mid(c) - 5, colors.ink1, { mono: true, align: "right" });
      else note(ctx, colors, cStr, c.x + c.w / 2, c.y - 12, colors.ink1, { mono: true, align: "center" });
    }
  }
  const bn = stages[byName.bottleneck];
  if (alpha("bottleneck") > 0) {
    const b = B.bottleneck;
    note(ctx, colors, M.chw(bn.C, bn.H), b.x + b.w / 2, b.y + b.h + 13, enc, { mono: true, align: "center" });
    if (bn.H === 1) note(ctx, colors, BOTTLENECK_1, w / 2, b.y + b.h + 28, colors.extreme, { align: "center" });
  }

  /* the highlighted stage's shape, with its batch */
  const shown = stages[lit];
  if (shown) note(ctx, colors, `${shown.name}: ${shapeText(M.shapeOf(shown))}`, w / 2, M.SHAPE_Y, colors.highlight, { align: "center", mono: true });
  return L;
}

/* ========================= the operation band ============================= */

function drawMap(ctx, colors, x, y, size, n, arr, frameTone) {
  const c = size / n;
  let hi = 0;
  for (let i = 0; i < n * n; i += 1) hi = Math.max(hi, Math.abs(arr[i]));
  hi = hi || 1;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(x, y, size, size);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      ctx.fillStyle = mix(colors.surface2, colors.ink1, arr[j * n + i] / hi);
      ctx.fillRect(x + i * c, y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
  frame(ctx, x, y, size, size, frameTone);
}
function cellGrid(ctx, colors, x, y, n, values, { tone, fill = null, hi = null } = {}) {
  const cw = M.CW;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const v = values[j * n + i];
      if (fill) {
        ctx.save();
        ctx.fillStyle = fill(v);
        ctx.fillRect(x + i * cw, y + j * cw, cw, cw);
        ctx.restore();
      }
      frame(ctx, x + i * cw, y + j * cw, cw, cw, colors.grid);
      txt(ctx, colors, f2(v), x + i * cw + cw / 2, y + j * cw + cw / 2 + 1,
        { align: "center", baseline: "middle", mono: true, size: "9px", color: tone ?? colors.ink1 });
    }
  }
  if (hi) frame(ctx, x + hi[1] * cw, y + hi[0] * cw, cw, cw, colors.highlight, 2);
}
const signedFill = (colors) => (v) => wash(v >= 0 ? colors.valueHigh : colors.valueLow, 0.45 * Math.min(1, Math.abs(v)));
const opLabel = (ctx, colors, s, x, y) =>
  txt(ctx, colors, s, x, y, { align: "center", baseline: "middle", color: colors.ink2, weight: "600", size: colors.fsSm });

/** up to four maps in a column, the channel count above; returns its height */
function mapsColumn(ctx, colors, x, top, arr, C, H, frameTone, { align = "left", mark = null, above = null } = {}) {
  const shown = Math.min(M.SHOWN, C);
  note(ctx, colors, M.countText(C, above), align === "right" ? x + M.MAP_S : x, top + M.CH_Y, colors.ink2, { mono: true, align });
  for (let c = 0; c < shown; c += 1) {
    const y = top + M.BODY_Y + c * (M.MAP_S + 4);
    drawMap(ctx, colors, x, y, M.MAP_S, H, arr.subarray(c * H * H, (c + 1) * H * H), frameTone);
    if (mark && c === 0) {
      const px = M.MAP_S / H;
      const sz = Math.max(3, Math.ceil(mark.s * px));
      frame(ctx, x + mark.c * px, y + mark.r * px, sz, sz, colors.highlight, 2);
    }
  }
  if (C > shown) note(ctx, colors, `+ ${C - shown}`, x, top + M.BODY_Y + shown * (M.MAP_S + 4) + 8, colors.ink3);
}
function bandTitle(ctx, colors, top, cap, sub, netLine) {
  caption(ctx, colors, cap, M.PAD, top + M.BAND_CAP);
  note(ctx, colors, sub, M.PAD, top + M.BAND_NOTE);
  note(ctx, colors, netLine, M.PAD, top + M.BAND_NET, colors.ink2);
}

function bandConv(ctx, colors, w, top, rec, name, netLine) {
  const T = M.trainedNet();
  const { x, H } = rec;
  const cin = x.length / (H * H);
  const cout = rec.out.length / (H * H);
  const r = Math.min(H - 2, Math.max(1, M.unitAt(T.unit.r, H)));
  const c = Math.min(H - 2, Math.max(1, M.unitAt(T.unit.c, H)));
  const block = rec.block;
  bandTitle(ctx, colors, top, `${name}: DoubleConv, (Conv 3 × 3 → BatchNorm → ReLU) twice`,
    `The first convolution at row ${r}, column ${c}, into output channel 0. The second repeats it on the result.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, x, cin, H, colors.groupA, { mark: { r: r - 1, c: c - 1, s: 3 }, above: ABOVE?.cin });
  const gx = M.PAD + M.MAP_S + 18;
  const kx = gx + 3 * M.CW + 22;
  note(ctx, colors, "window", gx, top + M.HEAD_Y, colors.ink3);
  note(ctx, colors, "kernel slice", kx, top + M.HEAD_Y, colors.ink3);
  const drawn = Math.min(M.GRID_ROWS, cin);
  const W = block.c1.W.v;
  for (let ch = 0; ch < drawn; ch += 1) {
    const win = [];
    const sl = [];
    for (let ky = 0; ky < 3; ky += 1) {
      for (let kxx = 0; kxx < 3; kxx += 1) {
        win.push(x[ch * H * H + (r + ky - 1) * H + (c + kxx - 1)]);
        sl.push(W[ch * 9 + ky * 3 + kxx]);
      }
    }
    const y = top + M.BODY_Y + ch * (3 * M.CW + 10);
    cellGrid(ctx, colors, gx, y, 3, win, { fill: (v) => wash(colors.groupA, 0.08 + 0.4 * Math.min(1, Math.abs(v))) });
    opLabel(ctx, colors, "⊙", gx + 3 * M.CW + 11, y + 1.5 * M.CW);
    cellGrid(ctx, colors, kx, y, 3, sl, { fill: signedFill(colors) });
  }
  if (cin > drawn) {
    note(ctx, colors, `+ ${cin - drawn} more channels, each with its own window and slice`, gx, top + M.BODY_Y + drawn * (3 * M.CW + 10) + 2, colors.ink3);
  }
  const sx = kx + 3 * M.CW + 18;
  const z = rec.z1[r * H + c];
  const mu = block.n1.rm[0];
  const sd = Math.sqrt(block.n1.rv[0] + 1e-5);
  const nrm = rec.n1[r * H + c];
  const lines = [["sum over channels", f2(z)], ["BatchNorm", f2(nrm)], ["ReLU", f2(rec.a1[r * H + c])]];
  lines.forEach(([l, v], i) => {
    const y = top + M.BODY_Y + 12 + i * 30;
    note(ctx, colors, l, sx, y, colors.ink2);
    txt(ctx, colors, v, sx, y + 14, { mono: true, color: i === 2 ? colors.highlight : colors.ink1, size: colors.fsXs, weight: "600" });
  });
  /* under the three lines, inside the column the output maps leave at 550 */
  note(ctx, colors, "BatchNorm = γ × (z − mean) / sd + β", sx, top + M.BODY_Y + 112, colors.ink3);
  note(ctx, colors, `${f2(block.n1.gamma.v[0])} × (z − ${f2(mu)}) / ${f2(sd)} + ${f2(block.n1.beta.v[0])}`,
    sx, top + M.BODY_Y + 126, colors.ink3, { mono: true });
  note(ctx, colors, "mean and sd kept from training", sx, top + M.BODY_Y + 140, colors.ink3);
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, rec.out, cout, H, colors.groupA, { align: "right", mark: { r, c, s: 1 }, above: ABOVE?.cout });
}
function bandPool(ctx, colors, w, top, rec, name, netLine) {
  const T = M.trainedNet();
  const { x, C, H, out } = rec;
  const h = H >> 1;
  const r = M.unitAt(T.unit.r, h);
  const c = M.unitAt(T.unit.c, h);
  bandTitle(ctx, colors, top, `${name}: MaxPool 2 × 2, the largest of each window kept`,
    `Channel 0, output row ${r}, column ${c}. Height and width halve, ${H} × ${H} to ${h} × ${h}; the channels stay ${C}.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, x, C, H, colors.groupA, { mark: { r: 2 * r, c: 2 * c, s: 2 }, above: ABOVE?.cin });
  const win = [];
  for (let j = 0; j < 2; j += 1) for (let i = 0; i < 2; i += 1) win.push(x[(2 * r + j) * H + 2 * c + i]);
  const mx = Math.max(...win);
  const best = win.indexOf(mx);
  const gx = M.PAD + M.MAP_S + 40;
  note(ctx, colors, "window", gx, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, gx, top + M.BODY_Y, 2, win, { fill: (v) => wash(colors.groupA, 0.08 + 0.4 * Math.min(1, v)), hi: [Math.floor(best / 2), best % 2] });
  opLabel(ctx, colors, "max", gx + 2 * M.CW + 24, top + M.BODY_Y + M.CW);
  cellGrid(ctx, colors, gx + 2 * M.CW + 48, top + M.BODY_Y + M.CW / 2, 1, [mx], { tone: colors.highlight });
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, out, C, h, colors.groupA, { align: "right", mark: { r, c, s: 1 }, above: ABOVE?.cout });
}
function bandUp(ctx, colors, w, top, rec, name, netLine) {
  const { x, h, out, layer } = rec;
  const H = 2 * h;
  const cin = layer.cin;
  const cout = layer.cout;
  /* the largest cell of input channel 0: at the object's edge the bottleneck's
     ReLU output is often 0, and a zero cell scatters nothing but the bias */
  let best = 0;
  for (let i = 1; i < h * h; i += 1) if (x[i] > x[best]) best = i;
  const r = Math.floor(best / h);
  const c = best % h;
  bandTitle(ctx, colors, top, `${name}: ConvTranspose 2 × 2, stride 2, one cell to a 2 × 2 patch`,
    `Input channel 0 at row ${r}, column ${c}, into output channel 0. Height and width double, ${h} × ${h} to ${H} × ${H}.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, x, cin, h, colors.groupB, { mark: { r, c, s: 1 }, above: ABOVE?.cin });
  const xv = x[r * h + c];
  const gx = M.PAD + M.MAP_S + 34;
  const y = top + M.BODY_Y;
  note(ctx, colors, "cell", gx, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, gx, y + M.CW / 2, 1, [xv], { fill: () => wash(colors.groupB, 0.3) });
  opLabel(ctx, colors, "×", gx + M.CW + 14, y + M.CW);
  const kx = gx + M.CW + 28;
  note(ctx, colors, "kernel", kx, top + M.HEAD_Y, colors.ink3);
  const ker = [0, 1, 2, 3].map((k) => layer.W.v[k]);
  cellGrid(ctx, colors, kx, y, 2, ker, { fill: signedFill(colors) });
  opLabel(ctx, colors, "+ b", kx + 2 * M.CW + 16, y + M.CW);
  const px = kx + 2 * M.CW + 34;
  note(ctx, colors, "patch", px, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, px, y, 2, ker.map((k) => xv * k + layer.b.v[0]), { tone: colors.highlight, fill: () => wash(colors.groupB, 0.15) });
  note(ctx, colors, `The other ${cin - 1} input channels add their own patches to the same four cells.`, gx, y + 2 * M.CW + 18, colors.ink3);
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, out, cout, H, colors.groupB, { align: "right", mark: { r: 2 * r, c: 2 * c, s: 2 }, above: ABOVE?.cout });
}
function bandCat(ctx, colors, w, top, rec, name, netLine) {
  const { up, enc, C, H, out } = rec;
  bandTitle(ctx, colors, top, `${name}: torch.cat(dim=1), the upsampled maps beside the encoder's`,
    `Channels add, ${C} + ${C} = ${2 * C}; height and width stay ${H} × ${H}. The encoder's maps arrive unchanged.`, netLine);
  const x1 = M.PAD;
  mapsColumn(ctx, colors, x1, top, up, C, H, colors.groupB, { above: ABOVE?.cin });
  note(ctx, colors, "up", x1, top + M.HEAD_Y, colors.ink3);
  opLabel(ctx, colors, "+", x1 + M.MAP_S + 38, top + M.BODY_Y + 2 * (M.MAP_S + 4) - 2);
  const x2 = x1 + M.MAP_S + 76;
  mapsColumn(ctx, colors, x2, top, enc, C, H, colors.groupA, { above: ABOVE?.cin });
  note(ctx, colors, "skip", x2, top + M.HEAD_Y, colors.ink3);
  opLabel(ctx, colors, "→", x2 + M.MAP_S + 42, top + M.BODY_Y + 2 * (M.MAP_S + 4) - 2);
  const x3 = x2 + M.MAP_S + 84;
  note(ctx, colors, M.countText(2 * C, ABOVE?.cout), x3, top + M.CH_Y, colors.ink2, { mono: true });
  note(ctx, colors, "the upsampled channels first", x3, top + M.HEAD_Y, colors.ink3);
  const shown = Math.min(8, 2 * C);
  for (let ch = 0; ch < shown; ch += 1) {
    drawMap(ctx, colors, x3 + (ch % 4) * (M.MAP_S + 4), top + M.BODY_Y + Math.floor(ch / 4) * (M.MAP_S + 4), M.MAP_S, H,
      out.subarray(ch * H * H, (ch + 1) * H * H), ch < C ? colors.groupB : colors.groupA);
  }
  if (2 * C > shown) note(ctx, colors, `+ ${2 * C - shown}`, x3, top + M.BODY_Y + 2 * (M.MAP_S + 4) + 8, colors.ink3);
}
function bandHead(ctx, colors, w, top, rec, name, netLine) {
  const T = M.trainedNet();
  const { x, z, p } = rec;
  const H = M.TRAIN.S;
  const cin = x.length / (H * H);
  const { r, c } = T.unit;
  const head = T.net.head;
  bandTitle(ctx, colors, top, `${name}: Conv 1 × 1, then sigmoid and the threshold at 0.5`,
    `Row ${r}, column ${c}: the ${cin} channel values at that pixel, each times its weight, plus the bias.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, x, cin, H, colors.groupB, { mark: { r, c, s: 1 }, above: ABOVE?.cin });
  const vx = M.PAD + M.MAP_S + 34;
  note(ctx, colors, "pixel", vx, top + M.HEAD_Y, colors.ink3);
  for (let ch = 0; ch < cin; ch += 1) cellGrid(ctx, colors, vx, top + M.BODY_Y + ch * M.CW, 1, [x[ch * H * H + r * H + c]], { fill: () => wash(colors.groupB, 0.3) });
  opLabel(ctx, colors, "⊙", vx + M.CW + 14, top + M.BODY_Y + (cin * M.CW) / 2);
  const wx = vx + M.CW + 28;
  note(ctx, colors, "weights", wx, top + M.HEAD_Y, colors.ink3);
  for (let ch = 0; ch < cin; ch += 1) cellGrid(ctx, colors, wx, top + M.BODY_Y + ch * M.CW, 1, [head.Wh.v[ch]], { fill: signedFill(colors) });
  const sx = wx + M.CW + 22;
  const lines = [[`sum + bias ${f2(head.bh.v[0])}`, f2(z[r * H + c])], ["sigmoid", p[r * H + c].toFixed(3)], ["over 0.5", p[r * H + c] > 0.5 ? "object" : "background"]];
  lines.forEach(([l, v], i) => {
    const y = top + M.BODY_Y + 12 + i * 30;
    note(ctx, colors, l, sx, y, colors.ink2);
    txt(ctx, colors, v, sx, y + 14, { mono: true, color: i === 2 ? colors.highlight : colors.ink1, size: colors.fsXs, weight: "600" });
  });
  const size = M.HEAD_MAP;
  const ox = w - M.PAD - 3 * size - 20;
  const mask = p.map((v) => (v > 0.5 ? 1 : 0));
  [["sigmoid", p], ["mask", mask], ["truth", T.truth]].forEach(([label, arr], k) => {
    const mx = ox + k * (size + 10);
    note(ctx, colors, label, mx, top + M.HEAD_Y, colors.ink3);
    drawMap(ctx, colors, mx, top + M.BODY_Y, size, H, arr, k === 2 ? colors.reference : colors.empirical);
  });
  frame(ctx, ox + size + 10 + c * (size / H), top + M.BODY_Y + r * (size / H), Math.ceil(size / H), Math.ceil(size / H), colors.highlight, 2);
}

const NET_LINE = (T) => `On a small trained network (depth ${M.TRAIN.depth}, base ${M.TRAIN.base}, a 16 × 16 image), held-out Dice ${T.dice.toFixed(2)}.`;
/* the chosen block's channel counts in the U above, read by every band's labels */
let ABOVE = null;

function drawBand(ctx, colors, w, top, state, params, reached) {
  const T = M.trainedNet();
  const drawnName = params.block;
  const name = M.trainedStage(drawnName);
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.beginPath(); ctx.moveTo(M.PAD, top - M.BAND_GAP / 2 + 0.5); ctx.lineTo(w - M.PAD, top - M.BAND_GAP / 2 + 0.5); ctx.stroke();
  ctx.restore();
  if (!reached) {
    caption(ctx, colors, "The operation of a block", M.PAD, top + M.BAND_CAP);
    note(ctx, colors, `${drawnName} has not been added yet. Press Next stage, then click a block on the network.`, M.PAD, top + M.BAND_NOTE);
    return;
  }
  const netLine = name === drawnName ? NET_LINE(T)
    : `Drawn on ${name} of a small trained network (depth ${M.TRAIN.depth}, base ${M.TRAIN.base}, 16 × 16), the same operation.`;
  ABOVE = M.drawnCounts(state.stages, drawnName);
  const kind = name.replace(/\d+$/, "");
  const rec = T.rec[name];
  const net = T.net;
  const lvl = Number(name.match(/\d+$/)?.[0] ?? 0);
  if (kind === "enc" || kind === "dec" || name === "bottleneck") {
    const block = kind === "enc" ? net.enc[lvl - 1] : kind === "dec" ? net.decs[net.depth - lvl] : net.bottleneck;
    bandConv(ctx, colors, w, top, { ...rec, block }, drawnName, netLine);
  } else if (kind === "pool") bandPool(ctx, colors, w, top, rec, drawnName, netLine);
  else if (kind === "up") bandUp(ctx, colors, w, top, { ...rec, layer: net.ups[net.depth - lvl] }, drawnName, netLine);
  else if (kind === "cat") bandCat(ctx, colors, w, top, rec, drawnName, netLine);
  else bandHead(ctx, colors, w, top, rec, drawnName, netLine);
}

/* ============================== Dice ====================================== */

const SHAPE_LABELS = { disc: "Disc", rect: "Rectangle", tri: "Triangle", none: "None" };
const SHAPE_NOUNS = { disc: "disc", rect: "rectangle", tri: "triangle" };
const SIZE_LABELS = { medium: "Medium", large: "Large" };
const PRED_SIZE_LABELS = { half: "Half", same: "Same", double: "Twice" };

/* the picture on a shape button (core's segmented `icon`, round 5, his pick A):
   the truth's shapes in the truth's colour, the prediction's in the prediction's */
function paintShapeIcon(ctx, shape, size, role) {
  const colors = readTokens();
  const tone = role === "truth" ? colors.reference : colors.empirical;
  ctx.save();
  ctx.strokeStyle = shape === "none" ? colors.ink3 : tone;
  ctx.fillStyle = wash(tone, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (shape === "disc") ctx.arc(size / 2, size / 2, size * 0.4, 0, 2 * Math.PI);
  else if (shape === "rect") ctx.rect(size * 0.08, size * 0.3, size * 0.84, size * 0.42);
  else if (shape === "tri") {
    ctx.moveTo(size / 2, size * 0.1);
    ctx.lineTo(size * 0.94, size * 0.86);
    ctx.lineTo(size * 0.06, size * 0.86);
    ctx.closePath();
  } else {
    ctx.setLineDash([2, 2]);
    ctx.rect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
const DICE_NOTE = "The ground truth and the prediction on the image. Drag the prediction and the counts follow it.";

function drawDice(ctx, colors, w, state, reveal) {
  const L = M.diceLayout(w);
  const { truth, prediction, m } = state;
  caption(ctx, colors, `Dice on a ${SHAPE_NOUNS[state.truthShape]}, ${M.SIZES[state.size].label} of the image`, M.PAD, M.CAPTION_Y);
  note(ctx, colors, DICE_NOTE, M.PAD, M.NOTE_Y);
  const p = L.panel;
  const c = p.w / M.G;
  ctx.save();
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  for (let j = 0; j < M.G; j += 1) {
    for (let i = 0; i < M.G; i += 1) {
      const k = j * M.G + i;
      const t = truth[k];
      const q = prediction[k];
      ctx.fillStyle = wash(colors.ink1, t ? 0.2 : 0.05);
      ctx.fillRect(p.x + i * c, p.y + j * c, Math.ceil(c), Math.ceil(c));
      if (!t && !q) continue;
      ctx.fillStyle = t && q ? wash(colors.highlight, 0.75) : t ? wash(colors.reference, 0.6) : wash(colors.empirical, 0.6);
      ctx.fillRect(p.x + i * c, p.y + j * c, Math.ceil(c), Math.ceil(c));
    }
  }
  ctx.restore();
  frame(ctx, p.x, p.y, p.w, p.h, colors.axis);
  note(ctx, colors, "the image, the ground truth and the prediction", p.x, p.y + p.h + 14, colors.ink2);
  note(ctx, colors, state.predShape === "none" ? "the prediction is empty"
    : state.dx || state.dy ? `the prediction moved ${state.dx} across, ${state.dy} down` : "the prediction in place", p.x, p.y + p.h + 28, colors.ink3);

  const tiles = [
    ["|A|  truth", m.A, colors.reference],
    ["|B|  prediction", m.B, colors.empirical],
    ["|A ∩ B|  both", m.AB, colors.highlight],
  ];
  tiles.forEach(([label, v, tone], k) => {
    const t = L.tiles[k];
    ctx.save();
    ctx.fillStyle = wash(tone, 0.12);
    ctx.fillRect(t.x, t.y, t.w, t.h);
    frame(ctx, t.x, t.y, t.w, t.h, tone);
    note(ctx, colors, label, t.x + 8, t.y + 16, colors.ink2);
    txt(ctx, colors, `${v} px`, t.x + 8, t.y + 38, { mono: true, color: colors.ink1, weight: "600" });
    ctx.restore();
  });
  const done = true;
  const lines = [
    ["Dice", done ? m.dice.toFixed(3) : "—"],
    ["IoU", done ? m.iou.toFixed(3) : "—"],
    ["precision · recall", done ? `${m.prec.toFixed(2)} · ${m.rec.toFixed(2)}` : "—"],
    ["Dice loss, 1 − Dice", done ? (1 - m.dice).toFixed(3) : "—"],
  ];
  lines.forEach(([label, v], k) => {
    note(ctx, colors, label, L.numbers.x, L.numbers.y + k * M.LINE, colors.ink2);
    txt(ctx, colors, v, L.numbers.valueX, L.numbers.y + k * M.LINE, { mono: true, color: colors.ink1, size: colors.fsXs, weight: "600" });
  });
  /* NO ACCURACY (round 6, Kenneth: "drop accuracy only"): segmentation reports
     Dice and IoU, and precision and recall stay for the Half and Twice sizes */
}

/* ============================= the formula card ============================ */

const MATHML = mathmlRenders();
let cardHost = null;
let cardKey = null;
const DICE_EQ = [
  {
    math: "<math><mrow><mi>Dice</mi><mo>=</mo><mfrac><mrow><mn>2</mn><mo>|</mo><mi>A</mi><mo>∩</mo><mi>B</mi><mo>|</mo></mrow>"
      + "<mrow><mo>|</mo><mi>A</mi><mo>|</mo><mo>+</mo><mo>|</mo><mi>B</mi><mo>|</mo></mrow></mfrac></mrow></math>",
    text: "Dice = 2 |A ∩ B| / (|A| + |B|)",
  },
  {
    math: "<math><mrow><mi>IoU</mi><mo>=</mo><mfrac><mrow><mo>|</mo><mi>A</mi><mo>∩</mo><mi>B</mi><mo>|</mo></mrow>"
      + "<mrow><mo>|</mo><mi>A</mi><mo>∪</mo><mi>B</mi><mo>|</mo></mrow></mfrac></mrow></math>",
    text: "IoU = |A ∩ B| / |A ∪ B|",
  },
  {
    math: "<math><mrow><msub><mi>L</mi><mi>Dice</mi></msub><mo>=</mo><mn>1</mn><mo>−</mo>"
      + "<mfrac><mrow><mn>2</mn><mo>∑</mo><msub><mi>p</mi><mi>i</mi></msub><msub><mi>t</mi><mi>i</mi></msub></mrow>"
      + "<mrow><mo>∑</mo><msub><mi>p</mi><mi>i</mi></msub><mo>+</mo><mo>∑</mo><msub><mi>t</mi><mi>i</mi></msub></mrow></mfrac></mrow></math>",
    text: "L_Dice = 1 − 2 Σ pᵢtᵢ / (Σ pᵢ + Σ tᵢ)",
  },
];
const DICE_CARD_NOTE = "A is the set of pixels in the ground truth and B the set in the prediction. Dice and IoU count "
  + "only the object's pixels, so an empty prediction scores 0 at any size. As a loss, the network's "
  + "probabilities pᵢ stand in for the prediction's 0s and 1s, and tᵢ is the ground truth.";
const U_CARD_NOTE = "One row a level of the U, as channels × height × width for a batch of 10. The encoder's output "
  + "crosses the skip and has the shape of the upsampled maps it joins, so the concatenation doubles the "
  + "channels and keeps the height and width. A convolution sets the channels; max-pool halves the height "
  + "and width; the transposed convolution doubles them.";

function renderCard(params, state, n, lit = -1) {
  const figure = document.querySelector("#widget .w-figure");
  if (!figure || !figure.parentNode) return;
  if (!cardHost) {
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const dice = M.isDice(params);
  const key = dice ? "dice" : `unet:${state.depth}:${state.base}:${state.input}:${n}:${lit}`;
  if (key === cardKey) return;
  cardKey = key;
  if (dice) {
    const eqStyle = "min-height:0;margin:0;display:inline-block;padding-right:2.4em";
    cardHost.innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:baseline;row-gap:4px">`
      + DICE_EQ.map((eq) => `<div class="w-math-eq" style="${eqStyle}">${MATHML ? eq.math : eq.text}</div>`).join("")
      + `</div><p class="w-math-note">${DICE_CARD_NOTE}</p>`;
    return;
  }
  /* THE LEVEL TABLE (round 3, C): a row a level of the U, so the encoder's
     output, the upsampled maps and their concatenation sit on one line — the
     skip's condition is that the first two are the same shape. A cell prints
     once its stage has been added; the highlighted stage's cell is lit. */
  const st = Object.fromEntries(state.stages.map((s, i) => [s.name, { ...s, i }]));
  const litName = state.stages[lit]?.name;
  const cell = (name, C, H, cls = "") => {
    const s = st[name];
    const reached = name === "input" || (s && s.i < n);
    const on = name === litName;
    const style = `padding:2px 8px;white-space:nowrap;${cls}`
      + (on ? "color:var(--c-highlight);font-weight:600;" : reached ? "color:var(--ink-1);" : "color:var(--ink-3);");
    return `<td style="${style}">${reached ? M.chw(C, H) : "—"}</td>`;
  };
  const op = (sym) => `<td style="padding:2px 2px;color:var(--ink-3)">${sym}</td>`;
  const encB = "border-left:3px solid var(--c-group-a);";
  const decB = "border-left:3px solid var(--c-group-b);";
  const th = (t) => `<th style="text-align:left;font-weight:600;color:var(--ink-2);padding:2px 8px;font-family:var(--font)">${t}</th>`;
  const { depth, base, input } = state;
  const C = (l) => base * 2 ** (l - 1);
  const H = (l) => Math.max(1, input >> (l - 1));
  let rows = "";
  for (let l = 1; l <= depth; l += 1) {
    const inCell = l === 1 ? cell("input", M.IN_CH, input, encB) : cell(`pool${l - 1}`, C(l - 1), H(l), encB);
    rows += `<tr><td style="padding:2px 8px;color:var(--ink-3)">${l}</td>${inCell}${op("→")}${cell(`enc${l}`, C(l), H(l), encB)}`
      + `${op("+")}${cell(`up${l}`, C(l), H(l), decB)}${op("=")}${cell(`cat${l}`, 2 * C(l), H(l))}${op("→")}${cell(`dec${l}`, C(l), H(l), decB)}</tr>`;
  }
  rows += `<tr><td style="padding:2px 8px;color:var(--ink-3)">${depth + 1}</td>${cell(`pool${depth}`, C(depth), H(depth + 1), encB)}${op("→")}`
    + `${cell("bottleneck", C(depth + 1), H(depth + 1), encB)}<td colspan="6" style="padding:2px 8px;color:var(--ink-3);font-family:var(--font)">the bottleneck</td></tr>`;
  rows += `<tr><td></td><td colspan="7" style="padding:2px 8px;color:var(--ink-3);font-family:var(--font)">the head, after dec1</td>${op("→")}${cell("head", M.NUM_CLASSES, input, "border-left:3px solid var(--c-empirical);")}</tr>`;
  cardHost.innerHTML = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-family:var(--font-mono);font-size:var(--fs-xs)">`
    + `<tr>${th("level")}${th("encoder in")}<th></th>${th("encoder out")}<th></th>${th("up")}<th></th>${th("concatenation")}<th></th>${th("decoder out")}</tr>`
    + `${rows}</table></div><p class="w-math-note">${U_CARD_NOTE}</p>`;
}

/* ============================== the widget ================================= */

const ON = (topic) => ({ param: "topic", equals: topic });

const STEP_LABELS = { stage: "Next stage" };
const STEP_TITLES = {
  stage: "Add the next stage of the network and print the shape it outputs",
};
const phaseOf = () => "stage";

defineWidget({
  slug: "unet",
  status: "draft",
  title: "Deep Learning - U-Net and Dice",
  subtitle:
    "A U-Net halves the image and doubles the channels at each level of its encoder, then reverses "
    + "both up its decoder, where each level concatenates the encoder's features of the same size "
    + "before a convolution. The Dice loss scores a predicted mask by its overlap with the ground "
    + "truth, counting only the object's pixels; precision and recall say whether a mask too large or "
    + "too small is what lowers it.",
  layout: "side",
  height: ({ w, ...values }) => M.pageHeight(w, values),

  params: {
    topic: {
      type: "segmented",
      label: "Topic",
      options: [{ value: "unet", label: "U-Net" }, { value: "dice", label: "Dice loss" }],
      default: "unet",
    },

    /* --- U-Net ----------------------------------------------------------- */
    netSec: { type: "section", label: "The network", when: ON("unet") },
    depth: {
      type: "choice",
      label: "Depth",
      detail: "how many times the encoder halves the image before the bottleneck",
      options: M.DEPTHS.map((v) => ({ value: v, label: v })),
      default: "4",
      when: ON("unet"),
    },
    base: {
      type: "choice",
      label: "Base channels",
      detail: "the channels of the first block; each level doubles them",
      options: M.BASES.map((v) => ({ value: v, label: v })),
      default: "16",
      when: ON("unet"),
    },
    input: {
      type: "choice",
      label: "Input",
      detail: "the side of the input image, in pixels",
      options: M.INPUTS.map((v) => ({ value: v, label: v })),
      default: "512",
      when: ON("unet"),
    },
    opSec: { type: "section", label: "The operation", when: ON("unet") },
    block: {
      type: "select",
      label: "Block",
      detail: "the block whose operation is drawn under the network; a click on a block chooses it too",
      options: (values) => M.stageNames(values.depth).map((n) => ({ value: n, label: n })),
      optionsFrom: "depth",
      default: "enc1",
      display: true,
      when: ON("unet"),
    },

    /* --- Dice ------------------------------------------------------------ */
    objSec: { type: "section", label: "The object", when: ON("dice") },
    size: {
      type: "segmented",
      label: "Object size",
      detail: "the share of the image the ground truth covers: about 5 % or 20 %",
      options: M.SIZE_KEYS.map((v) => ({ value: v, label: SIZE_LABELS[v] })),
      default: "medium",
      when: ON("dice"),
    },
    truth: {
      type: "segmented",
      label: "Ground truth",
      detail: "the object's shape",
      options: M.SHAPES.map((v) => ({ value: v, label: SHAPE_LABELS[v], icon: (ctx, sz) => paintShapeIcon(ctx, v, sz, "truth") })),
      default: "disc",
      when: ON("dice"),
    },
    predSec: { type: "section", label: "The prediction", when: ON("dice") },
    pred: {
      type: "segmented",
      label: "Prediction",
      detail: "the predicted mask's shape; drag it on the figure to move it",
      options: M.PRED_SHAPES.map((v) => ({ value: v, label: SHAPE_LABELS[v], icon: (ctx, sz) => paintShapeIcon(ctx, v, sz, "pred") })),
      default: "disc",
      when: ON("dice"),
    },
    psize: {
      type: "segmented",
      label: "Prediction size",
      detail: "the predicted mask's area: half, the same as, or twice the ground truth's",
      options: M.PRED_SIZE_KEYS.map((v) => ({ value: v, label: PRED_SIZE_LABELS[v] })),
      default: "same",
      when: { all: [ON("dice"), { param: "pred", oneOf: M.SHAPES }] },
    },
    /* where the drag has moved the prediction: display, so a drag keeps the count */
    dx: { type: "int", min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 2, hidden: true, display: true },
    dy: { type: "int", min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 1, hidden: true, display: true },

    /* Authoring escape hatch, first render only: stages added, or tiles counted. */
    shown: { type: "int", min: 0, max: 22, default: 0, hidden: true },
  },

  legend: ({ params }) => (M.isDice(params)
    ? [
      { token: "reference", label: "The ground truth only", mark: "bar" },
      { token: "empirical", label: "The prediction only", mark: "bar" },
      { token: "highlight", label: "The pixels in both, A ∩ B", mark: "bar" },
    ]
    : [
      { token: "group-a", label: "The encoder's features, and the bottleneck", mark: "bar" },
      { token: "group-b", label: "The decoder's features", mark: "bar" },
      { token: "dim-a", label: "Height and width change here: max-pool down, transposed convolution up", mark: "line" },
      { token: "dim-b", label: "Channels change here: a convolution, and the concatenation's bracket", mark: "line" },
      { token: "empirical", label: "The head: one logit a pixel, and the predicted mask", mark: "bar" },
      { token: "value-high", label: "A positive weight" },
      { token: "value-low", label: "A negative weight" },
      { token: "highlight", label: "The stage just added, the chosen block, and the position its operation is shown at" },
    ]),

  compute: ({ params }) => (M.isDice(params) ? M.computeDice(params) : M.computeU(params)),

  regions: ({ w, params, state }) => {
    if (M.isDice(params)) return [];
    /* core validates the region table at load, before the first compute, so
       the state is derived here when it is not handed in yet */
    const st = state?.page === "unet" ? state : M.computeU(params);
    const L = M.uLayout(w, st);
    return st.stages.map((s) => {
      const b = L.boxes[s.name];
      if (!b) throw new Error(`no box for ${s.name}`);
      /* a thin slab is widened to a 12px target; the up slab is the right half
         of its concatenation, and core's hit-test takes the LAST match, so it
         is listed last and wins that half */
      const pad = Math.max(0, (12 - b.w) / 2);
      return { x: b.x - pad, y: b.y, w: b.w + 2 * pad, h: b.h, set: { block: s.name }, label: s.name, order: s.kind === "up" ? 1 : 0 };
    }).sort((a, b) => a.order - b.order).map(({ order, ...r }) => r);
  },

  drag: {
    params: ["dx", "dy"],
    cursor: "grab",
    hit: ({ x, y, w, params }) => M.isDice(params) && params.pred !== "none" && M.panelHit(M.diceLayout(w), x, y),
    value: ({ dx, dy, start, w }) => {
      const cell = M.diceLayout(w).panel.w / M.G;
      const clamp = (v) => Math.max(-M.SHIFT_MAX, Math.min(M.SHIFT_MAX, Math.round(v)));
      return { dx: clamp(start.dx + dx / cell), dy: clamp(start.dy + dy / cell) };
    },
  },

  animation: {
    stepLabel: { anim: "phase", labels: STEP_LABELS, default: "Next stage" },
    stepTitle: { anim: "phase", labels: STEP_TITLES, default: STEP_TITLES.stage },
    runLabel: "Play",
    runTitle: "Run the remaining presses in order",

    init: ({ params, state, fromScratch }) => {
      const n = fromScratch ? 0 : Math.max(0, Math.min(state.total, Number(params.shown) || 0));
      /* THE DICE PAGE IS INERT (round 4: "omit the step/play buttons and calculate
         dynamically as we move the prediction"): core takes Step and Play out of
         the row, and the count follows the drag */
      if (state.page === "dice") return { n: 0, t: 0, phase: "stage", done: true, inert: true };
      return { n, t: 0, phase: phaseOf(n, state), done: n >= state.total };
    },

    advance: (anim, { dt, state }) => {
      if (anim.n >= state.total) {
        anim.t = 0;
        anim.done = true;
        return false;
      }
      anim.t += dt / M.STEP_MS;
      if (anim.t < 1) return true;
      anim.t = 0;
      anim.n += 1;
      anim.phase = phaseOf(anim.n, state);
      anim.done = anim.n >= state.total;
      return anim.mode !== "step" && !anim.done;
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    const reveal = revealOf(anim);
    renderCard(params, state, anim?.n ?? 0, state.page === "unet" ? litOf(reveal, state.stages, params.block) : -1);
    if (state.page === "dice") {
      drawDice(ctx, colors, w, state, reveal);
      return;
    }
    const L = drawU(ctx, colors, w, state, reveal, params.block);
    const idx = state.stages.findIndex((s) => s.name === params.block);
    drawBand(ctx, colors, w, L.height + M.BAND_GAP, state, params, idx >= 0 && idx < reveal.n);
  },

  readout({ params, state, anim }) {
    const n = anim?.n ?? 0;
    if (state.page === "dice") {
      const done = true;
      const { m } = state;
      return [
        { label: "Dice · IoU", value: done ? `${m.dice.toFixed(3)} · ${m.iou.toFixed(3)}` : "—", note: "overlap over the mean size · overlap over the union" },
        { label: "Precision · recall", value: done ? `${m.prec.toFixed(2)} · ${m.rec.toFixed(2)}` : "—", note: "of the predicted pixels, in the truth · of the truth's pixels, predicted" },
        { label: "Dice loss", value: done ? (1 - m.dice).toFixed(3) : "—", note: "1 − Dice: 0 when the masks agree, 1 when they share no pixel" },
      ];
    }
    const last = n > 0 ? state.stages[n - 1] : null;
    const bottle = state.stages.find((s) => s.kind === "bottleneck");
    return [
      { label: "Stages added", value: `${n} of ${state.total}`, note: last ? `${last.name}: ${last.op}` : "the input, not yet through a block" },
      { label: "Bottleneck", value: shapeText(M.shapeOf(bottle)), note: bottle.H === 1 ? "a 1 × 1 map; a deeper network could pool no further" : `${bottle.H} × ${bottle.H}, ${bottle.C} channels` },
      { label: "Parameters", value: fmt(state.params), note: "the DoubleConv blocks, the transposed convolutions and the head, at this depth and base" },
      {
        label: "Trained network",
        value: `Dice ${state.trained.dice.toFixed(2)}`,
        note: `the operations are drawn on a depth-${M.TRAIN.depth}, base-${M.TRAIN.base} U-Net trained here on ${M.TRAIN.n} 16 × 16 images for ${M.TRAIN.epochs} epochs; Dice on ${M.TRAIN.nTest} held-out images`,
      },
    ];
  },
});
