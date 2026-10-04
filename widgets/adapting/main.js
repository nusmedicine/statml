/* ============================================================================
   Widget 85 · Language: Training and Adapting (`adapting`; "Adapting Pre-trained Models" until 2026-10-04, his retitle) — PHM5005
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
   matrix, a cell a weight), with HIS FIGURE in a column beside the rows (round 1,
   D1: each box level with its tiles, trained boxes outlined, frozen ones hatched);
   the page's held-out accuracy curve with from scratch's dashed beside it.

   THE WEIGHTS, AND A BLINK ON THOSE THAT MOVE. Round 1 (his "i thought the
   weights would be there then change with training ... would blue-red be more
   contrastive?"): the map draws the weights W_t themselves, there from step 0,
   each matrix on its own scale, on the signed blue-red ramp. Measured
   (`_lab/adapting-colour-measure.py`): on that picture only 2.0% of weights
   visibly move under full fine-tuning (LoRA 10%, scratch 9.6%), because it moves
   each matrix by about a tenth of its size. Round 2 (his "flash pixels of weights
   that changed instead"; picked F2, `_lab/adapting-flash-mock.html`): every 50
   steps the weights that moved more than 5% of the page's largest change in
   those 50 steps blink in ink for 250 ms, no fade. Any change at all would light
   every trained tile (Adam moves them all on every step), hence the threshold
   (5% of the page's largest change; see THRESH).
   The Change reading of round 1 was dropped in favour of the blink (his pick).
   WHY REAL SNAPSHOTS: on Wrong drug the pattern of change turns during training
   (cosine with the final change 0.45 at step 100), so the map plays the run's own
   state every 50 steps, interpolated between them. Frozen is a fact the
   generator asserts: a frozen matrix did not move by a single bit, so it never
   blinks.

   LORA'S NOTATION is the lesson's, W′ = W + A Bᵀ with A and B 48 × r, plus peft's
   scaling α/r (32/8 = 4) that the lesson's formula leaves out. peft starts the
   factor that writes the output at zero, which in the lesson's names is A: so at
   step 0 the update is zero and W′ = W exactly.

   THE PROTEINS (2026-10-03, his picks from `_lab/adapting-ha-mock.html`; 86 was cut
   into this widget): one control, Task, Outcome · Drug error · Influenza host. The
   third is 08-3's data, influenza A HA proteins labelled by host, on ITS OWN model
   (85's shape with 25 tokens and 600 positions, pretrained by hiding amino acids),
   at the notes' protocol of 1,024 labelled examples: there from scratch matches
   the adapted models (98.5% against 98.6%) and frozen transfer falls short (97.2%),
   the many-labels case, measured stable over three seeds. A protein's row shows its
   first residues and its length; the 600 positions are squeezed into the map's one
   row (0.63 px a position, averaged into the pixels), with a dashed line where the
   longest protein ends; BV-BRC is credited in the option's detail. Shapes, counts,
   W_Q and the starting weights are read per MODEL (`MOD(task)`).

   NOTHING TRAINS IN THE BROWSER: every number is read from `table.js`, GENERATED
   by `_lab/adapting-table.py` (torch; one run per way and task, seed 0, 1,024
   notes or proteins) and checked by `_lab/adapting-verify.mjs`.

   Ways: transfer --c-group-a, full --c-group-b, LoRA --c-group-c (three parallel
   branches), from scratch --c-reference, on the curve only: the map and LoRA's
   detail are on --c-value-low/high and colour nothing else. EACH PAGE KEEPS ITS OWN
   PLACE (`anim.p[page]`); a switch mid-press finishes the press and `halt` ends
   the loop (widget 70's rule). Tweens only move (his rule, 2026-09-26): the
   curve and the maps advance with the training clock; text switches at once.
   ========================================================================= */

import { defineWidget } from "../core/index.js";
import { TABLE } from "./table.js";

const WAYS = {
  scratch: { label: "From scratch", group: "Random weights", name: "From scratch", color: "reference", detail: "The same network, every weight trained." },
  transfer: { label: "Transfer", group: "Pretrained weights", name: "Transfer learning", color: "groupA", detail: "The pretrained backbone frozen; only a new head trained." },
  full: { label: "Full", group: "Pretrained weights", name: "Full fine-tuning", color: "groupB", detail: "Every weight trained, starting from the pretrained ones." },
  lora: { label: "LoRA", group: "Pretrained weights", name: "LoRA", color: "groupC", detail: "The backbone frozen; a low-rank update A Bᵀ added to the Q and V weights, and the head, trained." },
};
/* THE WAYS BY THEIR START (2026-10-04, his "segment the training buttons? so training is from scratch, but
   transfer/full/lora refer to pretrained"; picked G1, `_lab/adapting-training-groups-mock.html`): core's `group`
   with `groupHeads`, the same form as Task, and the lone button named as the chart and the tiles name the way. */
const PAGES = Object.entries(WAYS).map(([value, w]) => ({ value, label: w.label, group: w.group, detail: w.detail }));
/* THE LABEL (round 4, his "finding asserted and wrong drug looks weird"; picked the clinical names): one kind
   of prediction, a note's class from its [CLS] vector, with the label set by one fact or the other. The pretrained
   [CLS] already separates clinical outcome (a probe on the frozen vectors 98%) and not prescribing error (61%),
   which is why the head alone is enough on one only. THE TASK (2026-10-03): with the proteins the control picks the
   data and the model too, so it is Task; three names to a 300 px rail, so the buttons are short and the detail says
   what each label is. The link values are the buttons' words. */
/* WHICH TASKS SHARE A MODEL (2026-10-04, his question "is there a way to visually indicate that outcome and drug
   error use the same dataset"; picked M2 + M3, `_lab/adapting-model-mock.html`): the Task buttons grouped under
   their model's name (core's `group` with `groupHeads`), and the same name as a chip before the rows' header on the
   canvas. The two clinical tasks share the pretrained model, not the labelled notes: each draws its own. */
const MODEL_NAME = { notes: "Clinical notes model", proteins: "Protein model" };
const TASKS = [
  { value: "outcome", label: "Outcome", group: MODEL_NAME.notes, detail: "1 positive when the note asserts an abnormal finding, 0 negative otherwise. A small BERT-style model, pretrained on synthetic notes by masked-word prediction." },
  { value: "drug-error", label: "Drug error", group: MODEL_NAME.notes, detail: "1 error when the drug does not treat the symptom, 0 no error when it does; every drug and every symptom appear under both labels. The same model, pretrained only on notes with correct pairs." },
  { value: "influenza-host", label: "Influenza host", group: MODEL_NAME.proteins, detail: "1 human when the virus was isolated from a person, 0 animal. A small BERT-style model, pretrained by masked amino-acid prediction as ESM-2 is. HA sequences from BV-BRC." },
];
const LABELS = { outcome: ["negative", "positive"], "drug-error": ["no error", "error"], "influenza-host": ["animal", "human"] };
/** the task's model: its shapes, counts, W_Q, starting weights and the positions a sequence reaches */
const MOD = (task) => TABLE.models[TABLE.model[task]];
const PROTEIN = (task) => TABLE.model[task] === "proteins";
const NOUN = (task) => (PROTEIN(task) ? "proteins" : "notes");
const STEPS = TABLE.steps, POINTS = STEPS / TABLE.every, SNAP = TABLE.snap, LSNAP = TABLE.lsnap;
const SCALE = TABLE.alpha / TABLE.r;
const TOTAL = (task, way) => { const t = MOD(task).trains; return t.backbone + 98 + (way === "lora" ? t.lora - 98 : 0); };

/* ================================================================== copy */

const S = {
  title: "Deep Learning - Language: Training and Adapting",
  subtitle: "A network can be trained from random weights, or a pretrained one adapted with a new head, on the same labelled examples. "
    + "Transfer learning trains the head alone, full fine-tuning every weight, and LoRA a low-rank update added to frozen weights. The head "
    + "alone works only when the pretrained vectors already separate the classes. With enough labels and steps, training from scratch comes "
    + "close; pretraining matters most when either is short.",
  pageLabel: "Training",
  taskLabel: "Task",
  step: "Train", stepTitle: (n) => `Train on the 1,024 labelled ${n}, 400 steps`,
  wait: "—",
  notesHead: (n) => `Four of the 1,000 held-out ${n}; training uses 1,024 others`,
  predHead: "prediction",
  mapHead: (s) => `The weights after ${s} steps`,
  blinkNote: "blink: changed by more than 5% of the largest change in 50 steps",
  blinkNow: (n, a, b) => `${n.toLocaleString("en-US")} changed by more than 5% of the largest change in steps ${a}–${b}`,
  trains: (n, of) => `trains ${n.toLocaleString("en-US")} of ${of.toLocaleString("en-US")}`,
  headBox: "Linear (head)", block: (b) => `Block ${b}`, embedding: "Embedding", token: "token", position: "position", longest: "end of the longest protein",
  attn: "Self-attention", ffn: "Feed forward", loraSub: "Q, V + A Bᵀ", frozen: "frozen",
  scaleW: "below 0 · 0 · above 0, each matrix on its own scale",
  loraHead: (s) => `Block 1's Q, after ${s} steps: W′ = W + ${SCALE} · A Bᵀ`,
  loraW: "W", loraWnote: "48 × 48 = 2,304", loraA: "A", loraBt: "Bᵀ", loraUpd: "A Bᵀ, the update", loraWp: "W′", loraWpNote: "used in the forward pass",
  loraTrained: (r) => `trained: A and B, each 48 × ${r} = ${(2 * 48 * r).toLocaleString("en-US")}`,
  loraLine: (s, u) => (s === 0 ? "A starts at zero, so the update is zero and W′ = W." : `The update is ${u} of W's size; W itself has not changed.`),
  curveHead: "Held-out accuracy while training",
  curveAxis: "training step",
  floor: (task, p) => `majority class: ${p}`,
  before: (way, n) => `Train runs 400 steps on the labelled ${n}, from ${way === "scratch" ? "random weights" : "the pretrained weights"}.`,
  /* the accuracies are in the tiles: the line says what moved */
  after: {
    scratch: () => "Every weight changed from its random start.",
    transfer: () => "Only the head changed: 98 parameters. The backbone is as pretrained.",
    full: (rel) => `Every weight changed, a matrix by ${rel} of its size at the median.`,
    lora: () => "Only the head and the updates to Q and V changed; the pretrained W stayed fixed.",
  },
  tileAcc: "Held out", tileAccNote: (n) => `accuracy on 1,000 ${n}`,
  tileScratch: "From scratch", tileScratchNote: (n) => `the same ${n}, random start`,
  tileTrains: "Trained", tileTrainsNote: (of) => `parameters, of ${of.toLocaleString("en-US")}`,
  sum: (page, step) => `${page}: ${step} of 400 training steps.`,
};

/* ============================================================ the data */

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
/** signed bytes (two's complement, × 127) back to [−1, 1] */
const signed = (u8) => Float32Array.from(u8, (b) => (b > 127 ? b - 256 : b) / 127);
const DECODED = {};
/** a run's changes, decoded once: maps[k][mat] is W − W₀ at step 50·(k + 1), in units of the run's scale */
function mapsOf(task, way) {
  const key = `${task}/${way}`;
  if (DECODED[key]) return DECODED[key];
  const run = TABLE.runs[task][way], raw = signed(bytes(run.maps)), out = [];
  let o = 0;
  for (let k = 0; k < STEPS / SNAP; k++) {
    const snap = {};
    for (const m of run.mats) { const [r, c] = MOD(task).shapes[m]; snap[m] = raw.subarray(o, o + r * c); o += r * c; }
    out.push(snap);
  }
  return (DECODED[key] = out);
}
/** a starting point's weights, decoded once: the task's pretrained base, or from scratch's random start; each matrix in units of its own scale */
const STARTS = {};
function startOf(task, way) {
  const start = way === "scratch" ? "scratch" : "base", M = MOD(task), key = `${TABLE.model[task]}/${start}`;
  if (STARTS[key]) return STARTS[key];
  const raw = signed(bytes(M.w0[start])), w = {};
  let o = 0;
  for (const m of TABLE.mats) { const [r, c] = M.shapes[m]; w[m] = raw.subarray(o, o + r * c); o += r * c; }
  return (STARTS[key] = { w, scale: M.w0scale[start] });
}

/* ============================================================ drawing kit */

const PAD = 12;
const pct = (v) => `${Math.round(100 * v)}%`;
const cap = (c) => `600 ${c.fsSm} ${c.font}`;
const small = (c) => `${c.fsXs} ${c.font}`;
const smallBold = (c) => `600 ${c.fsXs} ${c.font}`;
const body = (c) => `${c.fsSm} ${c.font}`;
const mono = (c) => `${c.fsSm} ${c.mono}`;
function txt(ctx, s, x, y, { font, fill, align = "left", baseline = "middle" }) {
  ctx.save(); ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(s, x, y); ctx.restore();
}
function line(ctx, pts, stroke, lw = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
}
const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
/* THE SIGNED-VALUE RAMP (round 1, his "would blue-red be more contrastive?"): --c-value-low below zero,
   --c-value-high above, --surface-3 at zero, the collection's pair for signed values (83 draws its signed
   weights on it). A panel using it colours nothing else by identity, so the map's text is ink and the ways'
   colours stay on the curve. 255 entries, −1 to 1. */
let LUT = null, lutKey = "";
function lut(c) {
  const key = c.surface3 + c.valueLow + c.valueHigh;
  if (key === lutKey) return LUT;
  const z = rgb(c.surface3), lo = rgb(c.valueLow), hi = rgb(c.valueHigh);
  LUT = Array.from({ length: 255 }, (_, i) => { const v = (i - 127) / 127, b = v < 0 ? lo : hi; return z.map((x, j) => Math.round(x + (b[j] - x) * Math.abs(v))); });
  lutKey = key; return LUT;
}
const shade = (L, v) => L[127 + Math.round(127 * Math.max(-1, Math.min(1, v)))];
/** a matrix of values in [−1, 1] as an image, one pixel an entry, drawn scaled with no smoothing */
const offscreen = typeof document !== "undefined" ? document.createElement("canvas") : null;
/* FROZEN TILES DIMMED (round 3, his "should we indicate which matrices are frozen"; picked Z1,
   `_lab/adapting-frozen-mock.html`): a frozen matrix's weights drawn 70% of the way toward the background with
   "frozen" on them, so the trained tiles keep the full contrast and the eye goes to them. */
const DIM = 0.7;
function image(ctx, c, rows, cols, at, x, y, w, h, transpose = false, lit = null, dim = false, smooth = false) {
  const R = transpose ? cols : rows, C = transpose ? rows : cols, L = lut(c), ink = rgb(c.ink1), bg = rgb(c.surface);
  offscreen.width = C; offscreen.height = R;
  const g = offscreen.getContext("2d"), img = g.createImageData(C, R);
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const on = lit && (transpose ? lit(j, i) : lit(i, j)), q0 = on ? ink : shade(L, transpose ? at(j, i) : at(i, j)), o = 4 * (i * C + j);
    const q = dim ? q0.map((v, k) => Math.round(v + (bg[k] - v) * DIM)) : q0;
    img.data[o] = q[0]; img.data[o + 1] = q[1]; img.data[o + 2] = q[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  /* a tile drawn below a pixel an entry (the proteins' 600 positions) is averaged into the pixels, so no weight is dropped */
  ctx.save(); ctx.imageSmoothingEnabled = smooth; if (smooth) ctx.imageSmoothingQuality = "high"; ctx.drawImage(offscreen, x, y, w, h); ctx.restore();
}
function hatch(ctx, c, x, y, w, h) {
  ctx.save(); ctx.fillStyle = c.surface2; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  for (let k = -h; k < w; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = c.grid; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
}

/* ============================================================ geometry */

/* every vertical position in one place, so the drawing and the height cannot disagree. The map is
   0.95 px a weight so his figure fits in a column at its left (round 1, D1). */
const PX = 0.95, T48 = 48 * PX, FIG = { x: PAD + 4, w: 92 }, MAP_X = PAD + 112;
/* four held-out rows above the map (round 4): MAP_HEAD and MAP_TOP moved down two rows; the LoRA detail (1.5 px a
   cell) and the chart (96 tall) gave back the height, so the LoRA page stays inside the 1,200 frame */
const MAP_HEAD = 128, MAP_TOP = 150, MAP_H = 304, LORA_H = 180, CURVE_H = 172;
const lay = (way) => {
  const lora = MAP_TOP + MAP_H, curve = lora + (way === "lora" ? LORA_H : 0);
  return { lora, curve, height: curve + CURVE_H };
};
const BLOCK = (b) => [["att.q", "Q"], ["att.k", "K"], ["att.v", "V"], ["att.o", "O"], ["ff.0", "FF 1"], ["ff.2", "FF 2"]].map(([m, l]) => [`blocks.${b}.${m}.weight`, l]);

/* ============================================================ the page */

/* THE PRESS'S CLOCK: 6 s of training, then 250 ms more so the last snapshot's blink shows. Each 50 steps the
   weights that moved past the threshold blink in ink for 250 ms and switch off at once (round 2, his "flash
   pixels of weights that changed"; picked F2, `_lab/adapting-flash-mock.html`: no fade, his rule). Timed on
   the press's own clock, so a driven state is deterministic; a finished page shows no blink. */
/* THE THRESHOLD, 5% of the page's largest change: the mock he picked from flashed at 10% of the 99th
   percentile, which the generator's scale was until round 2; the largest change is 2–3 times that, so 5% of it
   keeps the density he saw (full fine-tuning on Wrong drug: 1,758–8,627 weights a blink) and says exactly
   what it is. */
const RUN_MS = 6000, BLINK_MS = 250, MS = RUN_MS + BLINK_MS, THRESH = 0.05;
/** where the run is: the training step, fractional */
const stepOf = (pg) => (pg.n === 0 ? 0 : STEPS * Math.min(1, (pg.t * MS) / RUN_MS));
/** the snapshot blinking now (1 … 8, the one at step 50·k), or 0 */
function blinkOf(pg) {
  if (pg.n === 0 || pg.t >= 1) return 0;
  const e = pg.t * MS, per = RUN_MS / (STEPS / SNAP), k = Math.floor(e / per);
  return k >= 1 && k <= STEPS / SNAP && e - k * per < BLINK_MS ? k : 0;
}
/** which weights blink at snapshot k: those that moved more than THRESH of the page's scale in the 50 steps before it */
const MASKS = {};
function blinkMask(task, way, k) {
  const key = `${task}/${way}/${k}`;
  if (MASKS[key]) return MASKS[key];
  const maps = mapsOf(task, way), out = { n: 0 };
  for (const m of TABLE.runs[task][way].mats) {
    const now = maps[k - 1][m], before = k >= 2 ? maps[k - 2][m] : null, mask = new Uint8Array(now.length);
    for (let i = 0; i < now.length; i++) if (Math.abs(now[i] - (before ? before[i] : 0)) > THRESH) { mask[i] = 1; out.n++; }
    out[m] = mask;
  }
  return (MASKS[key] = out);
}

/* THE HELD-OUT NOTES (round 4, picked E2 with X1, `_lab/adapting-examples-mock.html`): four notes a label, not
   chosen by outcome (the generator takes the first two of each label in the held-out set that fit a line), each
   with its true label and this page's prediction, the predicted label, its probability and right or wrong. The
   prediction is the run's own at the latest 50-step snapshot, so it switches at once, as the map's snapshots do. */
/* A PROTEIN ON A LINE (2026-10-03, picked P1): its first residues in the monospace font, as many as fit before the
   prediction, then "…" and its length. */
function drawNotes(ctx, c, w, way, task, step, trained) {
  const name = MODEL_NAME[TABLE.model[task]];
  ctx.save(); ctx.font = smallBold(c); const cw = ctx.measureText(name).width;
  ctx.fillStyle = c.surface2; ctx.strokeStyle = c.grid; ctx.beginPath(); ctx.roundRect(PAD + 0.5, 5.5, cw + 14, 17, 8.5); ctx.fill(); ctx.stroke(); ctx.restore();
  txt(ctx, name, PAD + 7, 14, { font: smallBold(c), fill: c.ink1 });
  txt(ctx, S.notesHead(NOUN(task)), PAD + cw + 24, 14, { font: cap(c), fill: c.ink1 });
  txt(ctx, S.predHead, w - PAD, 14, { font: small(c), fill: c.ink3, align: "right" });
  const pred = TABLE.runs[task][way].pred, k = Math.min(pred.length - 1, Math.floor(step / SNAP));
  TABLE.examples[task].forEach(([t, y], i) => {
    const yy = 38 + i * 22;
    ctx.save(); ctx.strokeStyle = c.ink3; ctx.strokeRect(PAD + 0.5, yy - 9.5, 96, 19); ctx.restore();
    txt(ctx, `${y} ${LABELS[task][y]}`, PAD + 48, yy, { font: small(c), fill: c.ink1, align: "center" });
    if (PROTEIN(task)) {
      ctx.save(); ctx.font = mono(c); const cw = ctx.measureText("M").width; ctx.restore();
      const shown = `${t.slice(0, Math.floor((w - 2 * PAD - 106 - 104 - 34) / cw) - 1)}…`;
      txt(ctx, shown, PAD + 106, yy, { font: mono(c), fill: c.ink1 });
      ctx.save(); ctx.font = mono(c); const tw = ctx.measureText(shown).width; ctx.restore();
      txt(ctx, String(t.length), PAD + 106 + tw + 8, yy, { font: small(c), fill: c.ink3 });
    } else txt(ctx, t, PAD + 106, yy, { font: body(c), fill: c.ink1 });
    if (!trained) { txt(ctx, S.wait, w - PAD, yy, { font: small(c), fill: c.ink3, align: "right" }); return; }
    const p = pred[k][i], call = p > 0.5 ? 1 : 0, right = call === y;
    txt(ctx, right ? "✓" : "✗", w - PAD, yy, { font: cap(c), fill: c.ink1, align: "right" });
    txt(ctx, `${LABELS[task][call]} ${(call ? p : 1 - p).toFixed(2)}`, w - PAD - 16, yy, { font: small(c), fill: right ? c.ink1 : c.ink2, align: "right" });
  });
}

/* HIS FIGURE BESIDE THE ROWS (round 1, D1): each box level with its row of tiles, input at the bottom;
   the boxes this way trains outlined in ink, the frozen ones hatched like their tiles, so the figure carries
   the Trainable mark his adapt figures put in a bracket. Feed forward sits above self-attention in a block,
   as in his figure; the headers over the tiles tie each group to its box. */
function drawFigure(ctx, c, way, rows) {
  const { x, w } = FIG;
  const box = (y0, h, label, on, sub) => {
    if (on) { ctx.save(); ctx.fillStyle = c.surface; ctx.fillRect(x, y0, w, h); ctx.strokeStyle = c.ink1; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y0 + 1, w - 2, h - 2); ctx.restore(); }
    else hatch(ctx, c, x, y0, w, h);
    txt(ctx, label, x + w / 2, y0 + h / 2 - (sub ? 6 : 0), { font: on ? smallBold(c) : small(c), fill: on ? c.ink1 : c.ink3, align: "center" });
    if (sub) txt(ctx, sub, x + w / 2, y0 + h / 2 + 7, { font: small(c), fill: c.ink2, align: "center" });
  };
  const up = (y1, y2) => {
    line(ctx, [[x + w / 2, y1], [x + w / 2, y2 + 5]], c.ink3, 1.2);
    ctx.save(); ctx.fillStyle = c.ink3; ctx.beginPath(); ctx.moveTo(x + w / 2, y2); ctx.lineTo(x + w / 2 - 4, y2 + 6); ctx.lineTo(x + w / 2 + 4, y2 + 6); ctx.fill(); ctx.restore();
  };
  const all = way === "scratch" || way === "full";
  box(rows.emb[0] + 8, T48 - 16, S.embedding, all);
  for (const b of [0, 1]) {
    const [a, z] = rows[`b${b}`];
    line(ctx, [[x - 5, a - 32], [x + w + 5, a - 32], [x + w + 5, z + 2], [x - 5, z + 2], [x - 5, a - 32]], c.ink3, 1, [4, 3]);
    txt(ctx, S.block(b + 1), x - 1, a - 25, { font: smallBold(c), fill: c.ink2 });
    box(a - 16, 24, S.ffn, all);
    box(a + 12, z - a - 12, S.attn, all || way === "lora", way === "lora" ? S.loraSub : null);
  }
  box(rows.head[0], 16, S.headBox, true);
  up(rows.emb[0] + 8, rows.b0[1] + 2); up(rows.b0[0] - 32, rows.b1[1] + 2); up(rows.b1[0] - 32, rows.head[1] + 1);
}

function drawMap(ctx, c, w, way, task, step, blink) {
  const run = TABLE.runs[task][way], s = Math.round(step);
  txt(ctx, S.mapHead(s), PAD, MAP_HEAD, { font: cap(c), fill: c.ink1 });
  const mask = blink ? blinkMask(task, way, blink) : null;
  txt(ctx, mask ? S.blinkNow(mask.n, (blink - 1) * SNAP, blink * SNAP) : S.blinkNote, w - PAD, MAP_HEAD, { font: small(c), fill: mask ? c.ink1 : c.ink3, align: "right" });
  const maps = mapsOf(task, way), k = step / SNAP, k0 = Math.floor(k), f = k - k0, start = startOf(task, way), trained = new Set(run.mats), MD = MOD(task);
  /* the change, in the run's scale: maps[k0 − 1] holds step 50·k0, step 0 is zero; between snapshots, linear */
  const change = (m, idx) => {
    if (!trained.has(m)) return 0;
    const a = k0 >= 1 ? maps[Math.min(k0, maps.length) - 1][m][idx] : 0;
    const b = k0 < maps.length ? maps[k0][m][idx] : a;
    return a + (b - a) * f;
  };
  /* the weights: W_t = W₀ + the change, on the matrix's own scale */
  const value = (m, idx) => start.w[m][idx] + (change(m, idx) * run.scale) / start.scale[m];
  const litOf = (m, cc) => (mask && mask[m] ? (i, j) => mask[m][i * cc + j] === 1 : null);
  const rows = {};
  /* `room`: the width left in the row; the proteins' 600 positions are squeezed into it (picked E1) */
  const tile = (m, label, x, y, room = Infinity) => {
    const [r, cc] = MD.shapes[m], side = r !== 48, W = Math.min(room, (side ? r : cc) * PX), squeezed = W < (side ? r : cc) * PX;
    txt(ctx, label, x + W / 2, y - 7, { font: small(c), fill: c.ink2, align: "center" });
    const frozen = !trained.has(m);
    image(ctx, c, r, cc, (i, j) => value(m, i * cc + j), x, y, W, T48, side, litOf(m, cc), frozen, squeezed);
    if (squeezed) {
      /* where the longest protein ends: past it no sequence reaches, so those positions never change */
      const ux = x + W * MD.used / r;
      line(ctx, [[ux, y - 3], [ux, y + T48 + 3]], c.ink2, 1, [2, 2]);
      txt(ctx, S.longest, ux, y - 7, { font: small(c), fill: c.ink2, align: "right" });
    }
    if (frozen) txt(ctx, S.frozen, x + W / 2, y + T48 / 2, { font: small(c), fill: c.ink2, align: "center" });
    return W;
  };
  let y = MAP_TOP;
  image(ctx, c, 2, 48, (i, j) => value("head.weight", i * 48 + j), MAP_X, y - 8, 192, 16, false, litOf("head.weight", 48));
  rows.head = [y - 8, y + 8];
  txt(ctx, S.trains(MD.trains[way], TOTAL(task, way)), w - PAD, y, { font: smallBold(c), fill: c.ink1, align: "right" });
  y += 22;
  for (const b of [1, 0]) {
    let x = MAP_X; const ty = y + 34, xs = [];
    for (const [m, label] of BLOCK(b)) { xs.push(x); x += tile(m, label, x, ty) + (label === "O" ? 12 : 6); }
    for (const [a, z, label] of [[xs[0], xs[3] + T48, S.attn], [xs[4], x - 6, S.ffn]]) {
      line(ctx, [[a, ty - 14], [a, ty - 18], [z, ty - 18], [z, ty - 14]], c.ink3);
      txt(ctx, label, (a + z) / 2, ty - 25, { font: smallBold(c), fill: c.ink1, align: "center" });
    }
    rows[`b${b}`] = [ty, ty + T48]; y = ty + T48 + 16;
  }
  { const ty = y + 18; let x = MAP_X; x += tile("tok.weight", S.token, x, ty) + 12; tile("pos.weight", S.position, x, ty, w - PAD - x); rows.emb = [ty, ty + T48]; y = ty + T48; }
  drawFigure(ctx, c, way, rows);
  /* the scale */
  const sy = y + 18, L = lut(c);
  for (let i = 0; i < 160; i++) { const q = shade(L, (i - 79.5) / 79.5); ctx.fillStyle = `rgb(${q.join(",")})`; ctx.fillRect(MAP_X + i, sy - 4, 1.2, 8); }
  txt(ctx, S.scaleW, MAP_X + 168, sy, { font: small(c), fill: c.ink3 });
}

/** LoRA's factors at a fractional step, interpolated between the run's snapshots every 25 steps */
function factorsAt(task, step) {
  const L = TABLE.runs[task].lora.lora, k = Math.min(L.length - 1, step / LSNAP), k0 = Math.floor(k), f = k - k0, k1 = Math.min(L.length - 1, k0 + 1);
  const mix = (a, b) => a.map((row, i) => row.map((v, j) => v + (b[i][j] - v) * f));
  return { A: mix(L[k0].A, L[k1].A), B: mix(L[k0].B, L[k1].B), last: L[L.length - 1] };
}
/* THE DETAIL BLINKS WITH THE MAP (round 3, his "the lora matrix does not pulse?"): at the same moments, W′
   and the update blink on exactly the cells of the map's block-1 Q tile (W′ = W + the update, and W does not
   move), and A and Bᵀ on the entries that moved more than 5% of their own largest change in the same 50
   steps. W never blinks: it is frozen. */
const FMASKS = {};
function factorMasks(task, k) {
  const key = `${task}/${k}`;
  if (FMASKS[key]) return FMASKS[key];
  const L = TABLE.runs[task].lora.lora, per = SNAP / LSNAP, now = L[k * per], before = L[(k - 1) * per], first = L[0], last = L[L.length - 1];
  const mask = (f) => {
    const big = Math.max(1e-12, ...last[f].flatMap((row, i) => row.map((v, j) => Math.abs(v - first[f][i][j]))));
    return now[f].map((row, i) => row.map((v, j) => Math.abs(v - before[f][i][j]) > THRESH * big));
  };
  return (FMASKS[key] = { A: mask("A"), B: mask("B") });
}
function drawLora(ctx, c, w, task, step, y0, blink) {
  const s = Math.round(step);
  const q = blink ? blinkMask(task, "lora", blink)["blocks.0.att.q.weight"] : null, fm = blink ? factorMasks(task, blink) : null;
  txt(ctx, S.loraHead(s), PAD, y0 + 6, { font: cap(c), fill: c.ink1 });
  const { A: pA, B: pB, last } = factorsAt(task, step);
  /* the lesson's names: its A is peft's B (48 × r, zero at the start), its Bᵀ is peft's A (r × 48) */
  const lA = pB, lBt = pA, W = MOD(task).wq, r = TABLE.r;
  const prod = (P, Q) => W.map((_, i) => W[i].map((_, j) => { let v = 0; for (let t = 0; t < r; t++) v += P[i][t] * Q[t][j]; return SCALE * v; }));
  const upd = prod(lA, lBt), updLast = prod(last.B, last.A);
  const mx = (M) => Math.max(1e-12, ...M.flat().map(Math.abs));
  const mW = mx(W), mA = mx(last.B), mB = mx(TABLE.runs[task].lora.lora.flatMap((x) => x.A)), mU = mx(updLast);
  const cell = 1.5, Sz = 48 * cell, R8 = r * cell, yT = y0 + 42, yM = yT + R8 + 6;
  const xW = PAD + 2, xA = xW + Sz + 40, xP = xA + R8 + 6, xWp = xP + Sz + 32;
  const draw = (M, scale, x, y, lit = null, dim = false) => image(ctx, c, M.length, M[0].length, (i, j) => M[i][j] / scale, x, y, M[0].length * cell, M.length * cell, false, lit, dim);
  const qLit = q ? (i, j) => q[i * 48 + j] === 1 : null;
  draw(W, mW, xW, yM, null, true); txt(ctx, S.frozen, xW + Sz / 2, yM + Sz / 2, { font: small(c), fill: c.ink2, align: "center" });
  txt(ctx, S.loraW, xW + Sz / 2, yM - 10, { font: smallBold(c), fill: c.ink1, align: "center" });
  txt(ctx, S.loraWnote, xW + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink3, align: "center" });
  txt(ctx, `+ ${SCALE} ·`, xW + Sz + 20, yM + Sz / 2, { font: body(c), fill: c.ink1, align: "center" });
  draw(lA, mA, xA, yM, fm ? (i, j) => fm.B[i][j] : null); txt(ctx, S.loraA, xA + R8 / 2, yM + Sz + 12, { font: smallBold(c), fill: c.ink1, align: "center" });
  draw(lBt, mB, xP, yT, fm ? (i, j) => fm.A[i][j] : null); txt(ctx, S.loraBt, xP + Sz + 6, yT + R8 / 2, { font: smallBold(c), fill: c.ink1 });
  draw(upd, mU, xP, yM, qLit); txt(ctx, S.loraUpd, xP + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink2, align: "center" });
  txt(ctx, "=", xP + Sz + 16, yM + Sz / 2, { font: body(c), fill: c.ink1, align: "center" });
  const Wp = W.map((row, i) => row.map((v, j) => v + upd[i][j]));
  draw(Wp, mW, xWp, yM, qLit); txt(ctx, S.loraWp, xWp + Sz / 2, yM - 10, { font: smallBold(c), fill: c.ink1, align: "center" });
  txt(ctx, S.loraWpNote, xWp + Sz / 2, yM + Sz + 12, { font: small(c), fill: c.ink3, align: "center" });
  txt(ctx, S.loraTrained(r), xA, yT - 18, { font: smallBold(c), fill: c.ink1 });
  const norm = (M) => Math.sqrt(M.flat().reduce((a, v) => a + v * v, 0));
  txt(ctx, S.loraLine(s, pct(norm(upd) / norm(W))), PAD, yM + Sz + 30, { font: small(c), fill: c.ink2 });
}

function drawCurve(ctx, c, w, way, task, step, y0) {
  txt(ctx, S.curveHead, PAD, y0 + 6, { font: cap(c), fill: c.ink1 });
  const ch = { x: PAD + 40, y: y0 + 26, w: w - 2 * PAD - 160, h: 96 };
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
  /* nudged apart, and kept above the tick row: mid-run three labels can crowd near the floor (the sweep of
     settled states could not see it), so a stack pushed past the chart's foot is re-stacked upward from it */
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  const foot = ch.y + ch.h - 2;
  if (ends.length && ends[ends.length - 1].y > foot) {
    ends[ends.length - 1].y = foot;
    for (let i = ends.length - 2; i >= 0; i--) ends[i].y = Math.min(ends[i].y, ends[i + 1].y - 14);
  }
  for (const e of ends) txt(ctx, e.text, e.x + 6, e.y, { font: e.font, fill: e.fill });
}

function caption(way, task, done) {
  if (!done) return S.before(way, NOUN(task));
  const rel = Object.values(TABLE.runs[task][way].rel).sort((x, y) => x - y);
  return S.after[way](pct(rel[Math.floor(rel.length / 2)]));
}

/* ============================================================ animation */

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
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, groupHeads: true, default: "scratch", display: true },
    task: { type: "segmented", label: S.taskLabel, options: TASKS, groupHeads: true, default: "drug-error" },
    /* authoring escape hatch, first render only: 1 opens the page trained */
    shown: { type: "int", min: 0, max: 1, default: 0, hidden: true },
  },

  legend: [],

  compute: ({ params }) => ({ task: params.task }),

  animation: {
    stepLabel: S.step,
    stepTitle: { param: "task", labels: Object.fromEntries(TASKS.map((t) => [t.value, S.stepTitle(NOUN(t.value))])), default: S.stepTitle("notes") },
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
    drawNotes(ctx, colors, w, way, task, step, pg.n >= 1);
    drawMap(ctx, colors, w, way, task, step, blinkOf(pg));
    if (way === "lora") drawLora(ctx, colors, w, task, step, L.lora, blinkOf(pg));
    drawCurve(ctx, colors, w, way, task, step, L.curve);
    txt(ctx, caption(way, task, pg.n >= 1 && pg.t >= 1), PAD, L.height - 14, { font: body(colors), fill: colors.ink2 });
  },

  readout({ params, anim }) {
    const pg = pageOf(anim, params), way = params.page, step = stepOf(pg), i = Math.round(step / TABLE.every);
    const run = TABLE.runs[params.task];
    const n = NOUN(params.task);
    const tiles = [{ label: S.tileAcc, value: step > 0 ? pct(run[way].curve[i]) : S.wait, note: S.tileAccNote(n) }];
    if (way !== "scratch") tiles.push({ label: S.tileScratch, value: step > 0 ? pct(run.scratch.curve[i]) : S.wait, note: S.tileScratchNote(n) });
    tiles.push({ label: S.tileTrains, value: MOD(params.task).trains[way].toLocaleString("en-US"), note: S.tileTrainsNote(TOTAL(params.task, way)) });
    return tiles;
  },

  summary({ params, anim }) {
    return S.sum(WAYS[params.page].name, Math.round(stepOf(pageOf(anim, params))));
  },
});
