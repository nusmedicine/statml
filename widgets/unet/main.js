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
       U, on the maps of a TRAINED network. ONE NETWORK ON THE PAGE (2026-09-15,
       "go with depth 3 base 4 input 16, train on 3 channels", then Depth
       2 · 3 · 4 and Base channels 4 · 8 so students see the architecture
       change): the U, the level table and the band are the chosen network
       on a 16 × 16 colour image, every count and size the same. The six
       networks are trained ahead by `engine.js` in `_lab/unet-table.mjs` and
       read from `table.js`, because base 8 froze the page for 4.5–10 s when it
       trained here. Block is a display parameter, so a click keeps the stages
       already added; the dropdown is the keyboard path to the same choice (3.6).

    4. A 1 × 1 BOTTLENECK: depth 4 on the 16 × 16 image pools to one cell. It
       carried a red warning until 2026-09-15, when Kenneth had it removed: the
       rail offers no network that fails to fit, and the shape already says 1 × 1.

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

const U_CAPTION = "U-Net: the encoder, the decoder, and the skip connections between them";
const U_NOTE = "Shapes are channels × height × width, for a batch of 10. Click a block to see its operation.";

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
  }

  /* the highlighted stage's shape, with its batch */
  const shown = stages[lit];
  if (shown) note(ctx, colors, `${shown.name}: ${shapeText(M.shapeOf(shown))}`, w / 2, M.SHAPE_Y, colors.highlight, { align: "center", mono: true });
  return L;
}

/* ========================= the operation band ============================= *
 * Drawn from the chosen network's own trained maps and numbers (`table.js`), so
 * every count and size here is the diagram's. A map in the table is a
 * thumbnail with its range; the numbers at the position are exact.            */

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

/** up to four maps (thumbnails) in a column, the channel count above. `mark`
    frames `s` cells from (r, c) on the first map, clipped to the map. */
function mapsColumn(ctx, colors, x, top, thumbs, C, frameTone, { align = "left", mark = null } = {}) {
  const shown = Math.min(M.SHOWN, thumbs.length);
  note(ctx, colors, `${C} ch`, align === "right" ? x + M.MAP_S : x, top + M.CH_Y, colors.ink2, { mono: true, align });
  for (let c = 0; c < shown; c += 1) {
    const q = thumbs[c];
    const y = top + M.BODY_Y + c * (M.MAP_S + 4);
    drawMap(ctx, colors, x, y, M.MAP_S, q.n, M.mapOf(q), frameTone);
    if (mark && c === 0) {
      const px = M.MAP_S / q.n;
      const r0 = Math.max(0, mark.r);
      const c0 = Math.max(0, mark.c);
      const r1 = Math.min(q.n, mark.r + mark.s);
      const c1 = Math.min(q.n, mark.c + mark.s);
      frame(ctx, x + c0 * px, y + r0 * px, Math.max(3, (c1 - c0) * px), Math.max(3, (r1 - r0) * px), colors.highlight, 2);
    }
  }
  if (C > shown) note(ctx, colors, `+ ${C - shown}`, x, top + M.BODY_Y + shown * (M.MAP_S + 4) + 8, colors.ink3);
}
function bandTitle(ctx, colors, top, cap, sub, netLine) {
  caption(ctx, colors, cap, M.PAD, top + M.BAND_CAP);
  note(ctx, colors, sub, M.PAD, top + M.BAND_NOTE);
  note(ctx, colors, netLine, M.PAD, top + M.BAND_NET, colors.ink2);
}

/* the input a stage reads, as the table's thumbnails: the previous stage's output */
function inputOf(T, st, name) {
  const s = st.find((x) => x.name === name);
  if (s.kind === "enc") return s.level === 1 ? { C: T.cin, maps: T.image } : { C: T.stages[`pool${s.level - 1}`].C, maps: T.stages[`pool${s.level - 1}`].maps };
  if (s.kind === "pool") return { C: T.stages[`enc${s.level}`].C, maps: T.stages[`enc${s.level}`].maps };
  if (s.kind === "bottleneck") return { C: T.stages[`pool${T.depth}`].C, maps: T.stages[`pool${T.depth}`].maps };
  if (s.kind === "up") {
    const below = s.level === T.depth ? T.stages.bottleneck : T.stages[`dec${s.level + 1}`];
    return { C: below.C, maps: below.maps };
  }
  if (s.kind === "dec") return { C: T.stages[`cat${s.level}`].C, maps: T.stages[`cat${s.level}`].maps };
  return { C: T.stages.dec1.C, maps: T.stages.dec1.maps };
}

function bandConv(ctx, colors, w, top, T, st, name, netLine) {
  const S = T.stages[name];
  const A = S.at;
  const input = inputOf(T, st, name);
  const { r, c } = A;
  bandTitle(ctx, colors, top, `${name}: DoubleConv, (Conv 3 × 3 → BatchNorm → ReLU) twice`,
    `The first convolution at row ${r}, column ${c}, into output channel 0. The second repeats it on the result.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, input.maps, input.C, colors.groupA, { mark: { r: r - 1, c: c - 1, s: 3 } });
  const gx = M.PAD + M.MAP_S + 18;
  const kx = gx + 3 * M.CW + 22;
  note(ctx, colors, "window", gx, top + M.HEAD_Y, colors.ink3);
  note(ctx, colors, "kernel slice", kx, top + M.HEAD_Y, colors.ink3);
  A.windows.forEach((win, ch) => {
    const y = top + M.BODY_Y + ch * (3 * M.CW + 10);
    cellGrid(ctx, colors, gx, y, 3, win, { fill: (v) => wash(colors.groupA, 0.08 + 0.4 * Math.min(1, Math.abs(v))) });
    opLabel(ctx, colors, "⊙", gx + 3 * M.CW + 11, y + 1.5 * M.CW);
    cellGrid(ctx, colors, kx, y, 3, A.slices[ch], { fill: signedFill(colors) });
  });
  const drawn = A.windows.length;
  if (input.C > drawn) {
    const more = input.C - drawn;
    note(ctx, colors, `+ ${more} more ${more === 1 ? "channel" : "channels"}, each with its own window and slice`, gx, top + M.BODY_Y + drawn * (3 * M.CW + 10) + 2, colors.ink3);
  }
  const sx = kx + 3 * M.CW + 18;
  const lines = [["sum over channels", f2(A.z)], ["BatchNorm", f2(A.bn)], ["ReLU", f2(A.relu)]];
  lines.forEach(([l, v], i) => {
    const y = top + M.BODY_Y + 12 + i * 30;
    note(ctx, colors, l, sx, y, colors.ink2);
    txt(ctx, colors, v, sx, y + 14, { mono: true, color: i === 2 ? colors.highlight : colors.ink1, size: colors.fsXs, weight: "600" });
  });
  note(ctx, colors, "BatchNorm = γ × (z − mean) / sd + β", sx, top + M.BODY_Y + 112, colors.ink3);
  note(ctx, colors, `${f2(A.gamma)} × (z − ${f2(A.mean)}) / ${f2(A.sd)} + ${f2(A.beta)}`, sx, top + M.BODY_Y + 126, colors.ink3, { mono: true });
  note(ctx, colors, "running mean and sd from training", sx, top + M.BODY_Y + 140, colors.ink3);
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, S.maps, S.C, colors.groupA, { align: "right", mark: { r, c, s: 1 } });
}
function bandPool(ctx, colors, w, top, T, st, name, netLine) {
  const S = T.stages[name];
  const A = S.at;
  const input = inputOf(T, st, name);
  const H = S.H * 2;
  bandTitle(ctx, colors, top, `${name}: MaxPool 2 × 2, the largest of each window kept`,
    `Channel 0, output row ${A.r}, column ${A.c}. Height and width halve, ${H} × ${H} to ${S.H} × ${S.H}; the channels stay ${S.C}.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, input.maps, input.C, colors.groupA, { mark: { r: 2 * A.r, c: 2 * A.c, s: 2 } });
  const best = A.window.indexOf(Math.max(...A.window));
  const gx = M.PAD + M.MAP_S + 40;
  note(ctx, colors, "window", gx, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, gx, top + M.BODY_Y, 2, A.window, { fill: (v) => wash(colors.groupA, 0.08 + 0.4 * Math.min(1, v)), hi: [Math.floor(best / 2), best % 2] });
  opLabel(ctx, colors, "max", gx + 2 * M.CW + 24, top + M.BODY_Y + M.CW);
  cellGrid(ctx, colors, gx + 2 * M.CW + 48, top + M.BODY_Y + M.CW / 2, 1, [A.max], { tone: colors.highlight });
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, S.maps, S.C, colors.groupA, { align: "right", mark: { r: A.r, c: A.c, s: 1 } });
}
function bandUp(ctx, colors, w, top, T, st, name, netLine) {
  const S = T.stages[name];
  const A = S.at;
  const input = inputOf(T, st, name);
  const h = S.H / 2;
  bandTitle(ctx, colors, top, `${name}: ConvTranspose 2 × 2, stride 2, each input pixel to a 2 × 2 patch`,
    `Input channel ${A.ch} at row ${A.r}, column ${A.c}, into output channel 0. Height and width double, ${h} × ${h} to ${S.H} × ${S.H}.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, input.maps, input.C, colors.groupB, { mark: { r: A.r, c: A.c, s: 1 } });
  const gx = M.PAD + M.MAP_S + 34;
  const y = top + M.BODY_Y;
  note(ctx, colors, "pixel", gx, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, gx, y + M.CW / 2, 1, [A.cell], { fill: () => wash(colors.groupB, 0.3) });
  opLabel(ctx, colors, "×", gx + M.CW + 14, y + M.CW);
  const kx = gx + M.CW + 28;
  note(ctx, colors, "kernel", kx, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, kx, y, 2, A.kernel, { fill: signedFill(colors) });
  opLabel(ctx, colors, "+ b", kx + 2 * M.CW + 16, y + M.CW);
  const px = kx + 2 * M.CW + 34;
  note(ctx, colors, "patch", px, top + M.HEAD_Y, colors.ink3);
  cellGrid(ctx, colors, px, y, 2, A.kernel.map((k) => A.cell * k + A.bias), { tone: colors.highlight, fill: () => wash(colors.groupB, 0.15) });
  note(ctx, colors, `The other ${A.cin - 1} input channels add their own patches to the same four output pixels.`, gx, y + 2 * M.CW + 18, colors.ink3);
  mapsColumn(ctx, colors, w - M.PAD - M.MAP_S, top, S.maps, S.C, colors.groupB, { align: "right", mark: { r: 2 * A.r, c: 2 * A.c, s: 2 } });
}
function bandCat(ctx, colors, w, top, T, st, name, netLine) {
  const S = T.stages[name];
  const lvl = Number(name.slice(3));
  const C = S.C / 2;
  const H = S.H;
  const up = T.stages[`up${lvl}`];
  const enc = T.stages[`enc${lvl}`];
  bandTitle(ctx, colors, top, `${name}: torch.cat(dim=1), the upsampled maps and the encoder's joined along the channels`,
    `Channels add, ${C} + ${C} = ${2 * C}; height and width stay ${H} × ${H}. The encoder's maps are copied unchanged.`, netLine);
  const x1 = M.PAD;
  mapsColumn(ctx, colors, x1, top, up.maps, C, colors.groupB);
  note(ctx, colors, "up", x1, top + M.HEAD_Y, colors.ink3);
  opLabel(ctx, colors, "+", x1 + M.MAP_S + 38, top + M.BODY_Y + 2 * (M.MAP_S + 4) - 2);
  const x2 = x1 + M.MAP_S + 76;
  mapsColumn(ctx, colors, x2, top, enc.maps, C, colors.groupA);
  note(ctx, colors, "skip", x2, top + M.HEAD_Y, colors.ink3);
  opLabel(ctx, colors, "→", x2 + M.MAP_S + 42, top + M.BODY_Y + 2 * (M.MAP_S + 4) - 2);
  const x3 = x2 + M.MAP_S + 84;
  note(ctx, colors, `${2 * C} ch`, x3, top + M.CH_Y, colors.ink2, { mono: true });
  note(ctx, colors, "the upsampled channels first", x3, top + M.HEAD_Y, colors.ink3);
  S.maps.forEach((q, ch) => {
    drawMap(ctx, colors, x3 + (ch % 4) * (M.MAP_S + 4), top + M.BODY_Y + Math.floor(ch / 4) * (M.MAP_S + 4), M.MAP_S, q.n,
      M.mapOf(q), ch < C ? colors.groupB : colors.groupA);
  });
  if (2 * C > S.maps.length) note(ctx, colors, `+ ${2 * C - S.maps.length}`, x3, top + M.BODY_Y + 2 * (M.MAP_S + 4) + 8, colors.ink3);
}
function bandHead(ctx, colors, w, top, T, st, name, netLine) {
  const S = T.stages.head;
  const A = S.at;
  const input = inputOf(T, st, name);
  const cin = A.pixel.length;
  bandTitle(ctx, colors, top, `${name}: Conv 1 × 1, then sigmoid and the threshold at 0.5`,
    `Row ${A.r}, column ${A.c}: the ${cin} channel values at that pixel, each times its weight, plus the bias.`, netLine);
  mapsColumn(ctx, colors, M.PAD, top, input.maps, input.C, colors.groupB, { mark: { r: A.r, c: A.c, s: 1 } });
  /* eight channels at base 8 go in two columns, so the band keeps its height */
  const cols = M.headCols(cin);
  const cell = (k) => [vxOf(k), top + M.BODY_Y + Math.floor(k / cols) * M.CW];
  const vx = M.PAD + M.MAP_S + 34;
  const vxOf = (k) => vx + (k % cols) * M.CW;
  note(ctx, colors, "pixel", vx, top + M.HEAD_Y, colors.ink3);
  A.pixel.forEach((v, ch) => { const [x, y] = cell(ch); cellGrid(ctx, colors, x, y, 1, [v], { fill: () => wash(colors.groupB, 0.3) }); });
  opLabel(ctx, colors, "⊙", vx + cols * M.CW + 14, top + M.BODY_Y + (Math.ceil(cin / cols) * M.CW) / 2);
  const wx = vx + cols * M.CW + 28;
  note(ctx, colors, "weights", wx, top + M.HEAD_Y, colors.ink3);
  A.weights.forEach((v, ch) => cellGrid(ctx, colors, wx + (ch % cols) * M.CW, top + M.BODY_Y + Math.floor(ch / cols) * M.CW, 1, [v], { fill: signedFill(colors) }));
  const sx = wx + cols * M.CW + 22;
  const lines = [[`sum + bias ${f2(A.bias)}`, f2(A.z)], ["sigmoid", A.p.toFixed(3)], ["over 0.5", A.p > 0.5 ? "object" : "background"]];
  lines.forEach(([l, v], i) => {
    const y = top + M.BODY_Y + 12 + i * 30;
    note(ctx, colors, l, sx, y, colors.ink2);
    txt(ctx, colors, v, sx, y + 14, { mono: true, color: i === 2 ? colors.highlight : colors.ink1, size: colors.fsXs, weight: "600" });
  });
  const size = M.HEAD_MAP;
  const ox = w - M.PAD - 3 * size - 20;
  [["sigmoid", S.maps[0], colors.empirical], ["mask", T.mask, colors.empirical], ["truth", T.truth, colors.reference]].forEach(([label, q, tone], k) => {
    const mx = ox + k * (size + 10);
    note(ctx, colors, label, mx, top + M.HEAD_Y, colors.ink3);
    drawMap(ctx, colors, mx, top + M.BODY_Y, size, q.n, M.mapOf(q), tone);
  });
  frame(ctx, ox + size + 10 + A.c * (size / S.H), top + M.BODY_Y + A.r * (size / S.H), Math.ceil(size / S.H), Math.ceil(size / S.H), colors.highlight, 2);
}

const NET_LINE = (T) => `Trained on ${M.TABLE_N} 16 × 16 colour images for ${M.TABLE_EPOCHS} epochs; the maps are this network's outputs at this depth and base.`;

function drawBand(ctx, colors, w, top, state, params, reached) {
  const T = state.trained;
  const name = params.block;
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.beginPath(); ctx.moveTo(M.PAD, top - M.BAND_GAP / 2 + 0.5); ctx.lineTo(w - M.PAD, top - M.BAND_GAP / 2 + 0.5); ctx.stroke();
  ctx.restore();
  if (!reached) {
    caption(ctx, colors, "The operation of a block", M.PAD, top + M.BAND_CAP);
    note(ctx, colors, `${name} has not been added yet. Press Next stage, then click a block on the network.`, M.PAD, top + M.BAND_NOTE);
    return;
  }
  const netLine = NET_LINE(T);
  const st = state.stages;
  const kind = st.find((s) => s.name === name)?.kind;
  if (kind === "enc" || kind === "dec" || kind === "bottleneck") bandConv(ctx, colors, w, top, T, st, name, netLine);
  else if (kind === "pool") bandPool(ctx, colors, w, top, T, st, name, netLine);
  else if (kind === "up") bandUp(ctx, colors, w, top, T, st, name, netLine);
  else if (kind === "cat") bandCat(ctx, colors, w, top, T, st, name, netLine);
  else bandHead(ctx, colors, w, top, T, st, name, netLine);
}

/* ============================== Dice ====================================== */

const SHAPE_LABELS = { disc: "Disc", rectangle: "Rectangle", triangle: "Triangle", none: "None" };
const SHAPE_NOUNS = { disc: "disc", rectangle: "rectangle", triangle: "triangle" };
const SIZE_LABELS = { medium: "Medium", large: "Large" };
const PRED_SIZE_LABELS = { half: "Half", same: "Same", twice: "Twice" };

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
  else if (shape === "rectangle") ctx.rect(size * 0.08, size * 0.3, size * 0.84, size * 0.42);
  else if (shape === "triangle") {
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
/** precision is 0 ÷ 0 when the prediction has no pixels, so it prints as a dash */
const precRec = (m) => `${m.B ? m.prec.toFixed(2) : "—"} · ${m.rec.toFixed(2)}`;
const DICE_NOTE = "The ground truth and the prediction on the image. Drag the prediction to move it; the counts update as it moves.";

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
    : state.dx || state.dy ? `the prediction moved ${state.dx} across, ${state.dy} down` : "the prediction centred on the ground truth", p.x, p.y + p.h + 28, colors.ink3);

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
  const lines = [
    ["Dice", m.dice.toFixed(3)],
    ["IoU", m.iou.toFixed(3)],
    ["precision · recall", precRec(m)],
    ["Dice loss, 1 − Dice", (1 - m.dice).toFixed(3)],
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
  + "probabilities pᵢ replace the prediction's 0s and 1s, and tᵢ is the ground truth.";
const U_CARD_NOTE = "One row per level of the U, as channels × height × width for a batch of 10. The encoder's output "
  + "is carried along the skip connection and has the shape of the upsampled maps it is concatenated with, so the concatenation doubles the "
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
    + "truth, counting only the object's pixels; precision is lower when the predicted mask is too large, "
    + "and recall when it is too small.",
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
    /* THE NETWORK IS CHOSEN HERE, and every figure below is that network: the U,
       the level table and the operation panel read the same trained U-Net on a
       16 × 16 colour image (Kenneth's picks, 2026-09-15). */
    depth: {
      type: "segmented",
      label: "Depth",
      detail: "how many times the encoder halves the 16 × 16 image before the bottleneck",
      options: M.DEPTHS.map((v) => ({ value: v, label: v })),
      default: "3",
      when: ON("unet"),
    },
    base: {
      type: "segmented",
      label: "Base channels",
      detail: "the channels of the first block; each level doubles them",
      options: M.BASES.map((v) => ({ value: v, label: v })),
      default: "4",
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
    prediction: {
      type: "segmented",
      label: "Prediction",
      detail: "the predicted mask's shape; drag it on the figure to move it",
      options: M.PRED_SHAPES.map((v) => ({ value: v, label: SHAPE_LABELS[v], icon: (ctx, sz) => paintShapeIcon(ctx, v, sz, "pred") })),
      default: "disc",
      when: ON("dice"),
    },
    predictionsize: {
      type: "segmented",
      label: "Prediction size",
      detail: "the predicted mask's area: half, the same as, or twice the ground truth's",
      options: M.PRED_SIZE_KEYS.map((v) => ({ value: v, label: PRED_SIZE_LABELS[v] })),
      default: "same",
      when: { all: [ON("dice"), { param: "prediction", oneOf: M.SHAPES }] },
    },
    /* where the drag has moved the prediction: display, so a drag keeps the count */
    across: { type: "int", min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 2, hidden: true, display: true },
    down: { type: "int", min: -M.SHIFT_MAX, max: M.SHIFT_MAX, default: 1, hidden: true, display: true },

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
      { token: "empirical", label: "The head: one logit per pixel, and the predicted mask", mark: "bar" },
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
    params: ["across", "down"],
    cursor: "grab",
    hit: ({ x, y, w, params }) => M.isDice(params) && params.prediction !== "none" && M.panelHit(M.diceLayout(w), x, y),
    value: ({ dx, dy, start, w }) => {
      const cell = M.diceLayout(w).panel.w / M.G;
      const clamp = (v) => Math.max(-M.SHIFT_MAX, Math.min(M.SHIFT_MAX, Math.round(v)));
      return { across: clamp(start.across + dx / cell), down: clamp(start.down + dy / cell) };
    },
  },

  animation: {
    stepLabel: { anim: "phase", labels: STEP_LABELS, default: "Next stage" },
    stepTitle: { anim: "phase", labels: STEP_TITLES, default: STEP_TITLES.stage },
    runLabel: "Play",
    runTitle: "Add the remaining stages in order",

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
      const { m } = state;
      return [
        { label: "Dice · IoU", value: `${m.dice.toFixed(3)} · ${m.iou.toFixed(3)}`, note: "overlap over the mean size · overlap over the union" },
        { label: "Precision · recall", value: precRec(m), note: "of the predicted pixels, in the truth · of the truth's pixels, predicted" },
        { label: "Dice loss", value: (1 - m.dice).toFixed(3), note: "1 − Dice: 0 when the masks are identical, 1 when they share no pixel" },
      ];
    }
    const last = n > 0 ? state.stages[n - 1] : null;
    const bottle = state.stages.find((s) => s.kind === "bottleneck");
    return [
      { label: "Stages added", value: `${n} of ${state.total}`, note: last ? `${last.name}: ${last.op}` : "the input, not yet through a block" },
      { label: "Bottleneck", value: shapeText(M.shapeOf(bottle)), note: `${bottle.H} × ${bottle.H}, ${bottle.C} channels` },
      { label: "Parameters", value: fmt(state.params), note: "the DoubleConv blocks, the transposed convolutions and the head, at this depth and base" },
      {
        label: "Training time",
        value: `${(state.trained.ms / 1000).toFixed(1)} s`,
        note: `${M.TABLE_EPOCHS} epochs on ${M.TABLE_N} 16 × 16 colour images, in JavaScript on one CPU thread`,
      },
    ];
  },
});
