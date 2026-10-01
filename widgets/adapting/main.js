/* ============================================================================
   Widget 85 · Language: Adapting Pre-trained Models (`adapting`) — PHM5005
   08-1 cells 13–19, 08-2 cells 19–65. DRAFT, rebuilt 2026-10-01 to his replan
   (catalogue § Slot 85, REPLANNED; mock `_lab/adapting-replan-mock.html`).

   His step back after the first draft: "we covered pretraining in the previous
   widget ... focus on training from scratch and adapting to show the changes ...
   separately, perhaps animated ... the weights. LoRA will be shown in detail."
   So a page a way, each with one Train press:

     FROM SCRATCH       the same network from random weights: every weight moves
     TRANSFER           the pretrained backbone frozen, a new head trained
     FULL FINE-TUNING   every weight trained from the pretrained start
     LORA               the backbone frozen; Q and V get a trained update A Bᵀ;
                        block 1's W_Q drawn in detail as W + (α/r)·A Bᵀ = W′

   Each page: two of the labelled notes; THE WEIGHT MAP (his encoder figure taken
   apart, input at the bottom — embeddings, block 1, block 2, head — a tile a
   matrix, a cell a weight) drawing how far each weight has moved since training
   began, |W_t − W_0|, on the magnitude ramp with one scale a page; the page's
   held-out accuracy curve with from scratch's dashed beside it.

   WHY THE CHANGE AND NOT THE WEIGHTS (measured, `_lab/adapting-weights-measure.py`):
   full fine-tuning moves a matrix by about a tenth of its size, which a picture of
   W cannot show. WHY REAL SNAPSHOTS: on Wrong drug the pattern of change turns
   during training (cosine with the final change 0.45 at step 100), so the map
   plays the run's own state every 50 steps, interpolated between them, and never
   fades the final picture in. Frozen tiles are a fact the generator asserts: a
   frozen matrix did not move by a single bit.

   LORA'S NOTATION is the lesson's, W′ = W + A Bᵀ with A and B 48 × r, plus peft's
   scaling α/r (32/8 = 4) that the lesson's formula leaves out. peft starts the
   factor that writes the output at zero, which in the lesson's names is A: so at
   step 0 the update is zero and W′ = W exactly.

   NOTHING TRAINS IN THE BROWSER: every number is read from `table.js`, GENERATED
   by `_lab/adapting-table.py` (torch; one run per way and task, seed 0, 1,024
   notes) and checked by `_lab/adapting-verify.mjs`.

   Ways: transfer --c-group-a, full --c-group-b, LoRA --c-group-c (three parallel
   branches), from scratch --c-reference; how far a weight moved on the
   --c-magnitude ramp, so nothing here is --c-highlight. EACH PAGE KEEPS ITS OWN
   PLACE (`anim.p[page]`); a switch mid-press finishes the press and `halt` ends
   the loop (widget 70's rule). Tweens only move (his rule, 2026-09-26): the
   curve and the maps advance with the training clock; text switches at once.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { TABLE } from "./table.js";

const WAYS = {
  scratch: { label: "Scratch", name: "From scratch", color: "reference", detail: "The same network from random weights: every weight trained." },
  transfer: { label: "Transfer", name: "Transfer learning", color: "groupA", detail: "The pretrained backbone frozen; only a new head trained." },
  full: { label: "Full", name: "Full fine-tuning", color: "groupB", detail: "Every weight trained, starting from the pretrained ones." },
  lora: { label: "LoRA", name: "LoRA", color: "groupC", detail: "The backbone frozen; a small update A Bᵀ trained beside Q and V, and the head." },
};
const PAGES = Object.entries(WAYS).map(([value, w]) => ({ value, label: w.label, detail: w.detail }));
const TASKS = [
  { value: "outcome", label: "Finding asserted", detail: "1 when the note asserts an abnormal finding, 0 otherwise." },
  { value: "match", label: "Wrong drug", detail: "1 when a drug is given for a symptom it does not treat, 0 when it treats it. Every pretraining note paired a drug with its own symptom." },
];
const LABELS = { outcome: ["negative", "positive"], match: ["right drug", "wrong drug"] };
const STEPS = TABLE.steps, POINTS = STEPS / TABLE.every, SNAP = TABLE.snap, LSNAP = TABLE.lsnap;
const SCALE = TABLE.alpha / TABLE.r;
const TOTAL = (way) => TABLE.trains.backbone + 98 + (way === "lora" ? TABLE.trains.lora - 98 : 0);

/* ================================================================== copy */

const S = {
  title: "Deep Learning - Language: Adapting Pre-trained Models",
  subtitle: "A pretrained model is adapted to a task by adding a head and training on labelled examples. Transfer learning trains the "
    + "head alone, full fine-tuning every weight, and LoRA a small low-rank update beside frozen weights; training from scratch starts "
    + "the same network from random weights. The head alone is enough when the pretrained vectors already separate the classes.",
  pageLabel: "Training",
  taskLabel: "Task",
  step: "Train", stepTitle: "Train on the 1,024 labelled notes, 400 steps",
  wait: "—",
  notesHead: "Labelled notes: 1,024 for training, 1,000 held out",
  mapHead: (s) => `How far each weight has moved since training began, after ${s} steps`,
  trains: (n, of) => `trains ${n.toLocaleString("en-US")} of ${of.toLocaleString("en-US")}`,
  head: "Head", block: (b) => `Block ${b}`, emb: "Embeddings", token: "token", position: "position",
  frozen: "frozen", trainable: "Trainable",
  trainableLora: "Trainable: Q, V and the head",
  scaleLo: "0", scaleHi: (v) => `${v} and over`,
  loraHead: (s) => `Block 1's Q, after ${s} steps: W′ = W + ${SCALE} · A Bᵀ`,
  loraW: "W", loraWnote: "frozen · 2,304", loraA: "A", loraBt: "Bᵀ", loraUpd: "A Bᵀ, the update", loraWp: "W′", loraWpNote: "what the model uses",
  loraTrained: (r) => `trained: A and B, each 48 × ${r} = ${(2 * 48 * r).toLocaleString("en-US")}`,
  loraLine: (s, u) => (s === 0 ? "A starts at zero, so the update is zero and W′ = W." : `The update is ${u} of W's size; W itself has not moved.`),
  curveHead: "Held-out accuracy while training",
  curveAxis: "training step",
  floor: (task, p) => (task === "outcome" ? `all called positive: ${p}` : `chance: ${p}`),
  before: (way) => `Train runs 400 steps on the labelled notes, from ${way === "scratch" ? "random weights" : "the pretrained weights"}.`,
  /* the accuracies are in the tiles: the line says what moved */
  after: {
    scratch: () => "Every weight moved from its random start.",
    transfer: () => "Only the head moved: 98 numbers. The backbone is as pretrained.",
    full: (rel) => `Every weight moved, a matrix by ${rel} of its size at the median.`,
    lora: () => "Only Q, V and the head moved; the frozen W did not, the update beside it did.",
  },
  tileAcc: "Held out", tileAccNote: "accuracy on 1,000 notes",
  tileScratch: "From scratch", tileScratchNote: "the same notes, random start",
  tileTrains: "Trained", tileTrainsNote: (of) => `numbers, of ${of.toLocaleString("en-US")}`,
  sum: (page, step) => `${page}: ${step} of 400 training steps.`,
};

/* ============================================================ the data */

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const DECODED = {};
/** a run's maps, decoded once: maps[k][mat] is snapshot k's bytes for that matrix (k = 0 is step 50) */
function mapsOf(task, way) {
  const key = `${task}/${way}`;
  if (DECODED[key]) return DECODED[key];
  const run = TABLE.runs[task][way], raw = bytes(run.maps), out = [];
  let o = 0;
  for (let k = 0; k < STEPS / SNAP; k++) {
    const snap = {};
    for (const m of run.mats) { const [r, c] = TABLE.shapes[m]; snap[m] = raw.subarray(o, o + r * c); o += r * c; }
    out.push(snap);
  }
  return (DECODED[key] = out);
}

/* ============================================================ drawing kit */

const PAD = 12;
const pct = (v) => `${Math.round(100 * v)}%`;
const cap = (c) => `600 ${c.fsSm} ${c.font}`;
const small = (c) => `${c.fsXs} ${c.font}`;
const smallBold = (c) => `600 ${c.fsXs} ${c.font}`;
const body = (c) => `${c.fsSm} ${c.font}`;
function txt(ctx, s, x, y, { font, fill, align = "left", baseline = "middle" }) {
  ctx.save(); ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(s, x, y); ctx.restore();
}
function line(ctx, pts, stroke, lw = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
}
const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
/** the magnitude ramp as a 256-entry table: √ so small changes still show */
let LUT = null, lutKey = "";
function lut(c) {
  const key = c.surface3 + c.magnitude;
  if (key === lutKey) return LUT;
  const a = rgb(c.surface3), b = rgb(c.magnitude);
  LUT = Array.from({ length: 256 }, (_, i) => { const u = Math.sqrt(i / 255); return a.map((x, j) => Math.round(x + (b[j] - x) * u)); });
  lutKey = key; return LUT;
}
/** a matrix of values in [0, 1] as an image, one pixel an entry, drawn scaled with no smoothing */
const offscreen = typeof document !== "undefined" ? document.createElement("canvas") : null;
function image(ctx, c, rows, cols, at, x, y, w, h, transpose = false) {
  const R = transpose ? cols : rows, C = transpose ? rows : cols, L = lut(c);
  offscreen.width = C; offscreen.height = R;
  const g = offscreen.getContext("2d"), img = g.createImageData(C, R);
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const v = transpose ? at(j, i) : at(i, j), q = L[Math.max(0, Math.min(255, Math.round(255 * v)))], o = 4 * (i * C + j);
    img.data[o] = q[0]; img.data[o + 1] = q[1]; img.data[o + 2] = q[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(offscreen, x, y, w, h); ctx.restore();
}
function hatch(ctx, c, x, y, w, h) {
  ctx.save(); ctx.fillStyle = c.surface2; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  for (let k = -h; k < w; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = c.grid; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
}

/* ============================================================ geometry */

/* every vertical position in one place, so the drawing and the height cannot disagree */
const PX = 1.1, T48 = 48 * PX;
const MAP_TOP = 106, MAP_H = 296, LORA_H = 196, CURVE_H = 186;
const lay = (way) => {
  const lora = MAP_TOP + MAP_H, curve = lora + (way === "lora" ? LORA_H : 0);
  return { lora, curve, height: curve + CURVE_H };
};
const BLOCK = (b) => [["att.q", "Q"], ["att.k", "K"], ["att.v", "V"], ["att.o", "O"], ["ff.0", "FF 1"], ["ff.2", "FF 2"]].map(([m, l]) => [`blocks.${b}.${m}.weight`, l]);

/* ============================================================ the page */

/** where the run is: the training step, fractional */
const stepOf = (pg) => (pg.n === 0 ? 0 : STEPS * pg.t);

function drawNotes(ctx, c, task) {
  txt(ctx, S.notesHead, PAD, 14, { font: cap(c), fill: c.ink1 });
  TABLE.notes[task].forEach(([t, y], i) => {
    const yy = 38 + i * 22;
    ctx.save(); ctx.strokeStyle = c.ink3; ctx.strokeRect(PAD + 0.5, yy - 9.5, 96, 19); ctx.restore();
    txt(ctx, `${y} ${LABELS[task][y]}`, PAD + 48, yy, { font: small(c), fill: c.ink1, align: "center" });
    txt(ctx, t, PAD + 106, yy, { font: body(c), fill: c.ink1 });
  });
}

function drawMap(ctx, c, w, way, task, step) {
  const run = TABLE.runs[task][way], col = c[WAYS[way].color], s = Math.round(step);
  txt(ctx, S.mapHead(s), PAD, 84, { font: cap(c), fill: c.ink1 });
  const maps = mapsOf(task, way), k = step / SNAP, k0 = Math.floor(k), f = k - k0;
  /* maps[k0 − 1] holds step 50·k0; step 0 is all zero */
  const value = (m, idx) => {
    const a = k0 >= 1 ? maps[Math.min(k0, maps.length) - 1][m][idx] : 0;
    const b = k0 < maps.length ? maps[k0][m][idx] : a;
    return (a + (b - a) * f) / 255;
  };
  const hx = PAD + 42, trained = new Set(run.mats), spans = {};
  const tile = (m, label, x, y) => {
    const [r, cc] = TABLE.shapes[m], side = r !== 48, W = (side ? r : cc) * PX;
    txt(ctx, label, x + W / 2, y - 7, { font: small(c), fill: c.ink2, align: "center" });
    if (!trained.has(m)) { hatch(ctx, c, x, y, W, T48); txt(ctx, S.frozen, x + W / 2, y + T48 / 2, { font: small(c), fill: c.ink3, align: "center" }); return W; }
    image(ctx, c, r, cc, (i, j) => value(m, i * cc + j), x, y, W, T48, side);
    return W;
  };
  let y = MAP_TOP;
  /* the head on top, as his figure: 2 × 48, drawn tall enough to see */
  txt(ctx, S.head, hx, y, { font: smallBold(c), fill: c.ink1 });
  image(ctx, c, 2, 48, (i, j) => value("head.weight", i * 48 + j), hx + 40, y - 8, 192, 16);
  spans.head = [y - 8, y + 8];
  y += 26;
  for (const b of [1, 0]) {
    txt(ctx, S.block(b + 1), hx, y, { font: smallBold(c), fill: c.ink1 });
    let x = hx; const ty = y + 20;
    for (const [m, label] of BLOCK(b)) x += tile(m, label, x, ty) + (label === "O" ? 12 : 6);
    spans[`b${b}`] = [ty, ty + T48]; y = ty + T48 + 12;
  }
  txt(ctx, S.emb, hx, y, { font: smallBold(c), fill: c.ink1 });
  { const ty = y + 20; let x = hx; x += tile("tok.weight", S.token, x, ty) + 12; tile("pos.weight", S.position, x, ty); spans.emb = [ty, ty + T48]; y = ty + T48; }
  /* his Trainable bracket, over what this way trains */
  const parts = way === "transfer" ? ["head"] : way === "lora" ? ["head", "b1", "b0"] : ["head", "b1", "b0", "emb"];
  const t0 = Math.min(...parts.map((p) => spans[p][0])), t1 = Math.max(...parts.map((p) => spans[p][1]));
  line(ctx, [[hx - 8, t0], [hx - 13, t0], [hx - 13, t1], [hx - 8, t1]], c.ink1, 1.5);
  ctx.save(); ctx.translate(hx - 22, (t0 + t1) / 2); ctx.rotate(-Math.PI / 2);
  txt(ctx, way === "lora" ? S.trainableLora : S.trainable, 0, 0, { font: smallBold(c), fill: c.ink1, align: "center" }); ctx.restore();
  txt(ctx, S.trains(TABLE.trains[way], TOTAL(way)), w - PAD, MAP_TOP, { font: smallBold(c), fill: col, align: "right" });
  /* the scale: one a page */
  const sy = y + 16, L = lut(c);
  for (let i = 0; i < 120; i++) { const q = L[Math.round(255 * i / 119)]; ctx.fillStyle = `rgb(${q.join(",")})`; ctx.fillRect(hx + i, sy - 4, 1.2, 8); }
  txt(ctx, S.scaleLo, hx - 4, sy, { font: small(c), fill: c.ink3, align: "right" });
  txt(ctx, S.scaleHi(run.scale.toFixed(3)), hx + 126, sy, { font: small(c), fill: c.ink3 });
}

/** LoRA's factors at a fractional step, interpolated between the run's snapshots every 25 steps */
function factorsAt(task, step) {
  const L = TABLE.runs[task].lora.lora, k = Math.min(L.length - 1, step / LSNAP), k0 = Math.floor(k), f = k - k0, k1 = Math.min(L.length - 1, k0 + 1);
  const mix = (a, b) => a.map((row, i) => row.map((v, j) => v + (b[i][j] - v) * f));
  return { A: mix(L[k0].A, L[k1].A), B: mix(L[k0].B, L[k1].B), last: L[L.length - 1] };
}
function drawLora(ctx, c, w, task, step, y0) {
  const s = Math.round(step);
  txt(ctx, S.loraHead(s), PAD, y0 + 6, { font: cap(c), fill: c.ink1 });
  const { A: pA, B: pB, last } = factorsAt(task, step);
  /* the lesson's names: its A is peft's B (48 × r, zero at the start), its Bᵀ is peft's A (r × 48) */
  const lA = pB, lBt = pA, W = TABLE.wq, r = TABLE.r;
  const prod = (P, Q) => W.map((_, i) => W[i].map((_, j) => { let v = 0; for (let t = 0; t < r; t++) v += P[i][t] * Q[t][j]; return SCALE * v; }));
  const upd = prod(lA, lBt), updLast = prod(last.B, last.A);
  const mx = (M) => Math.max(1e-12, ...M.flat().map(Math.abs));
  const mW = mx(W), mA = mx(last.B), mB = mx(TABLE.runs[task].lora.lora.flatMap((x) => x.A)), mU = mx(updLast);
  const cell = 1.8, Sz = 48 * cell, R8 = r * cell, yT = y0 + 42, yM = yT + R8 + 6;
  const xW = PAD + 2, xA = xW + Sz + 40, xP = xA + R8 + 6, xWp = xP + Sz + 32;
  const draw = (M, scale, x, y) => image(ctx, c, M.length, M[0].length, (i, j) => Math.abs(M[i][j]) / scale, x, y, M[0].length * cell, M.length * cell);
  draw(W, mW, xW, yM); txt(ctx, S.loraW, xW + Sz / 2, yM - 10, { font: smallBold(c), fill: c.ink1, align: "center" });
  txt(ctx, S.loraWnote, xW + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink3, align: "center" });
  txt(ctx, `+ ${SCALE} ·`, xW + Sz + 20, yM + Sz / 2, { font: body(c), fill: c.ink1, align: "center" });
  draw(lA, mA, xA, yM); txt(ctx, S.loraA, xA + R8 / 2, yM + Sz + 12, { font: smallBold(c), fill: c.ink1, align: "center" });
  draw(lBt, mB, xP, yT); txt(ctx, S.loraBt, xP + Sz + 6, yT + R8 / 2, { font: smallBold(c), fill: c.ink1 });
  draw(upd, mU, xP, yM); txt(ctx, S.loraUpd, xP + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink2, align: "center" });
  txt(ctx, "=", xP + Sz + 16, yM + Sz / 2, { font: body(c), fill: c.ink1, align: "center" });
  const Wp = W.map((row, i) => row.map((v, j) => v + upd[i][j]));
  draw(Wp, mW, xWp, yM); txt(ctx, S.loraWp, xWp + Sz / 2, yM - 10, { font: smallBold(c), fill: c.ink1, align: "center" });
  txt(ctx, S.loraWpNote, xWp + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink3, align: "center" });
  txt(ctx, S.loraTrained(r), xA, yT - 18, { font: smallBold(c), fill: c.groupC });
  const norm = (M) => Math.sqrt(M.flat().reduce((a, v) => a + v * v, 0));
  txt(ctx, S.loraLine(s, pct(norm(upd) / norm(W))), PAD, yM + Sz + 30, { font: small(c), fill: c.ink2 });
}

function drawCurve(ctx, c, w, way, task, step, y0) {
  txt(ctx, S.curveHead, PAD, y0 + 6, { font: cap(c), fill: c.ink1 });
  const ch = { x: PAD + 40, y: y0 + 26, w: w - 2 * PAD - 160, h: 110 };
  const Y = (v) => ch.y + ch.h - ((v - 0.4) / 0.6) * ch.h, X = (i) => ch.x + ch.w * i / POINTS;
  for (const v of [0.4, 0.6, 0.8, 1]) { line(ctx, [[ch.x, Y(v)], [ch.x + ch.w, Y(v)]], c.grid); txt(ctx, pct(v), ch.x - 6, Y(v), { font: small(c), fill: c.ink3, align: "right" }); }
  for (let s = 0; s <= STEPS; s += 100) txt(ctx, String(s), X(s / TABLE.every), ch.y + ch.h + 12, { font: small(c), fill: c.ink3, align: "center" });
  /* the axis title in the label column, on the ticks' row: below the ticks it met the caption */
  txt(ctx, S.curveAxis, ch.x + ch.w + 16, ch.y + ch.h + 12, { font: small(c), fill: c.ink3 });
  const base = TABLE.base[task], fy = Y(base);
  line(ctx, [[ch.x, fy], [ch.x + ch.w, fy]], c.ink3, 1, [3, 3]);
  /* the floor's label sits in the label column with the curves', nudged with them */
  const ends = [{ y: fy, x: ch.x + ch.w, text: S.floor(task, pct(base)), fill: c.ink3, font: small(c) }];
  const upto = step / TABLE.every;
  const series = step <= 0 ? [] : way === "scratch" ? [["scratch", false]] : [["scratch", true], [way, false]];
  for (const [k, dashed] of series) {
    const cv = TABLE.runs[task][k].curve, last = Math.floor(upto), f = upto - last;
    const pts = cv.slice(0, last + 1).map((v, i) => [X(i), Y(v)]);
    if (f > 0 && last < POINTS) pts.push([X(last + f), Y(cv[last] + (cv[last + 1] - cv[last]) * f)]);
    line(ctx, pts, c[WAYS[k].color], 2, dashed ? [5, 3] : null);
    const e = pts[pts.length - 1];
    ends.push({ y: e[1], x: e[0], text: `${pct(cv[Math.min(POINTS, Math.round(upto))])} ${WAYS[k].name}`, fill: c[WAYS[k].color], font: smallBold(c) });
  }
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  for (const e of ends) txt(ctx, e.text, e.x + 6, e.y, { font: e.font, fill: e.fill });
}

function caption(way, task, done) {
  if (!done) return S.before(way);
  const rel = Object.values(TABLE.runs[task][way].rel).sort((x, y) => x - y);
  return S.after[way](pct(rel[Math.floor(rel.length / 2)]));
}

/* ============================================================ animation */

const MS = 6000;
const pageOf = (anim, params) => anim.p[params.page];
function settle(anim, params) {
  const pg = pageOf(anim, params);
  anim.key = params.page;
  anim.done = pg.n >= 1 && pg.t >= 1;
}

defineWidget({
  slug: "adapting",
  status: "draft",
  title: S.title,
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page }) => lay(page).height,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "scratch", display: true },
    task: { type: "segmented", label: S.taskLabel, options: TASKS, default: "match" },
    /* authoring escape hatch, first render only: 1 opens the page trained */
    shown: { type: "int", min: 0, max: 1, default: 0, hidden: true },
  },

  legend: [],

  compute: ({ params }) => ({ task: params.task }),

  animation: {
    stepLabel: S.step,
    stepTitle: S.stepTitle,
    /* one press is the whole run (his pick): no Play */
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { p: Object.fromEntries(PAGES.map((p) => [p.value, { n: 0, t: 1 }])), moving: false, halt: false };
      if (!fromScratch && Number(params.shown) >= 1) anim.p[params.page].n = 1;
      settle(anim, params);
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.halt) { anim.halt = false; anim.moving = false; settle(anim, params); return false; }
      const pg = pageOf(anim, params);
      let more;
      if (pg.t < 1) { pg.t = Math.min(1, pg.t + dt / MS); more = pg.t < 1; }
      else if (pg.n < 1) { pg.n = 1; pg.t = 0; more = true; }
      else more = false;
      anim.moving = more;
      settle(anim, params);
      return more;
    },
    rebuild: (anim, { params }) => {
      /* a press belongs to the page it started on: a switch mid-press finishes it (widget 70's rule) */
      if (anim.moving && params.page !== anim.key) {
        for (const pg of Object.values(anim.p)) pg.t = 1;
        anim.halt = true;
      }
      settle(anim, params);
    },
  },

  draw({ ctx, colors, w, params, anim }) {
    const pg = pageOf(anim, params), way = params.page, task = params.task, step = stepOf(pg), L = lay(way);
    drawNotes(ctx, colors, task);
    drawMap(ctx, colors, w, way, task, step);
    if (way === "lora") drawLora(ctx, colors, w, task, step, L.lora);
    drawCurve(ctx, colors, w, way, task, step, L.curve);
    txt(ctx, caption(way, task, pg.n >= 1 && pg.t >= 1), PAD, L.height - 14, { font: body(colors), fill: colors.ink2 });
  },

  readout({ params, anim }) {
    const pg = pageOf(anim, params), way = params.page, step = stepOf(pg), i = Math.round(step / TABLE.every);
    const run = TABLE.runs[params.task];
    const tiles = [{ label: S.tileAcc, value: step > 0 ? pct(run[way].curve[i]) : S.wait, note: S.tileAccNote }];
    if (way !== "scratch") tiles.push({ label: S.tileScratch, value: step > 0 ? pct(run.scratch.curve[i]) : S.wait, note: S.tileScratchNote });
    tiles.push({ label: S.tileTrains, value: TABLE.trains[way].toLocaleString("en-US"), note: S.tileTrainsNote(TOTAL(way)) });
    return tiles;
  },

  summary({ params, anim }) {
    return S.sum(WAYS[params.page].name, Math.round(stepOf(pageOf(anim, params))));
  },
});
