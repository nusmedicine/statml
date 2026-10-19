/* ============================================================================
   Widget 107 · Diffusion Models (`diffusion`) — PHM5005 10-3b cells 95–129:
   the forward process, the training loop that teaches a network to predict
   the noise, generation by repeated denoising, and the class-conditional
   model, on the notebook's own two U-Nets (`UNet2DModel` (64, 64),
   `DDPMScheduler(1000, "linear")`).

   The idea (catalogue § The DL Frontiers arc, slot 107): the network
   predicts the noise, not the image; generation is many small denoising
   steps; the forward process is fixed and the reverse is learned. MEASURED
   2026-10-20 (§ 107 MEASURED, `_lab/diffusion-measure.py`): on the linear
   schedule the digit is gone from x_t by t ≈ 700; generation settles x̂₀ on
   its digit between t ≈ 500 and 300 (median 372) while x_t still looks like
   noise; the trained ε̂ is off by 0.002 at t = 999 and 0.32 at t = 0; the
   conditional model's samples read back as their label 91% of the time.

   HIS CALLS (2026-10-20, `_lab/diffusion-mock.html`, all thirteen the
   recommendation): Stage Forward · Training · Generation under Diffusion,
   Generation under Conditional diffusion; Forward a t slider with c107's
   six frames, one ε for every t, no press, no classifier curve; Training
   steps through nine checkpoints with ε̂, the loss and eight samples, the
   iteration a rail control; Generation shows xₜ · ε̂ · x̂₀ and a two-row
   trajectory, a press 50 of c113's 500 steps; Conditional c129's 4 per
   label, each row from one x_T and one stream of z; the card a diagram
   and a formula; colours as call 10; 4 bits a pixel (16 greys).

   REVIEW ROUND 1 (his three questions on the draft, `_lab/diffusion-mock2.html`,
   asked one by one, all three the recommendation): (1) Forward shows the
   values — a pointer on a pixel rings it in all three images and prints its
   sum, and a histogram of the 784 values moves from x₀'s two spikes to
   N(0, 1); (2) Conditional diffusion gets Training · Generation (no
   conditional Forward: the forward process never uses c) — the eleven
   checkpoints show the shapes coming before the label; (3) Generation's
   top row is the subtraction xₜ − √(1 − ᾱₜ)·ε̂ = √ᾱₜ·x̂₀, the Forward row
   read backwards in its colours, with the two weights over the run.

   The U-Net does not run here: Forward is computed from a seeded ε, and
   every other picture replays a stored run (`_lab/diffusion-export.py`).
   ========================================================================= */

import { defineWidget, mathmlRenders } from "../core/index.js";
import { FORWARD, TRAINING, GENERATION, CONDITIONAL, COND_TRAINING } from "./data.js";

/* ------------------------------------------------------------- the schedule (diffusers' "linear"), exact */

const T = 1000;
const ABAR = (() => {
  const out = new Float64Array(T); let p = 1;
  for (let i = 0; i < T; i++) { p *= 1 - (1e-4 + ((0.02 - 1e-4) * i) / (T - 1)); out[i] = p; }
  return out;
})();
const sa = (t) => Math.sqrt(ABAR[t]), sn = (t) => Math.sqrt(1 - ABAR[t]);
const C107 = [0, 50, 200, 400, 800, 999];                    // c107's frames
/* where the forward captions change, from the schedule itself: the noise's weight passes x₀'s (ᾱ < ½), and x₀'s falls under 0.1 */
const T_EVEN = ABAR.findIndex((a) => a < 0.5), T_TENTH = ABAR.findIndex((a) => Math.sqrt(a) < 0.1);

/* ------------------------------------------------------------- the stored images */

/* every stored image is the notebook's display value, clamp(x, −1, 1)·0.5 + 0.5, at 4 bits */
const cache = new Map();
function unpack(key, b64) {
  if (cache.has(key)) return cache.get(key);
  const s = atob(b64), u = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) { const v = s.charCodeAt(i); u[2 * i] = (v >> 4) * 17; u[2 * i + 1] = (v & 15) * 17; }
  cache.set(key, u); return u;
}
const X0F = Uint8Array.from(atob(FORWARD.x0), (c) => c.charCodeAt(0));       // 8 bits: mixed with ε in the page
const disp = (v) => Math.round((Math.max(-1, Math.min(1, v)) * 0.5 + 0.5) * 255);

const PAGES = [
  { value: "forward", label: "Forward", group: "Diffusion" },
  { value: "training", label: "Training", group: "Diffusion" },
  { value: "generation", label: "Generation", group: "Diffusion" },
  { value: "ctraining", label: "Training", group: "Conditional diffusion" },
  { value: "conditional", label: "Generation", group: "Conditional diffusion" },
];
const ON = (page) => ({ param: "page", equals: page });
const TRAIN_PAGES = ["training", "ctraining"];
const isTrain = (page) => TRAIN_PAGES.includes(page);
/* the two training runs: the unconditional one (3 epochs) and the conditional one (5), on the same 12 iterations */
const RUNS = { training: TRAINING, ctraining: COND_TRAINING };
const MAX = { training: TRAINING.batch.length - 1, ctraining: COND_TRAINING.batch.length - 1, generation: GENERATION.t.length - 1, conditional: CONDITIONAL.t.length - 1 };
const STEP = { training: 1, ctraining: 1, generation: 5, conditional: 5 };
const PRESS_MS = { training: 900, ctraining: 900, generation: 1100, conditional: 1100 };
const RUN_MS = { training: 650, ctraining: 650, generation: 90, conditional: 130 };   // per checkpoint · per stored frame
const GEN_EVERY = 10, COND_EVERY = 3;                         // stored frames: every 10th of 500 steps, every 3rd of 75
const CK_NAME = ["before training", "after 5 batches", "after 20 batches", "after 50 batches", "after 100 batches", "after 200 batches", "after epoch 1", "after epoch 2", "after epoch 3", "after epoch 4", "after epoch 5"];
const TRAJ = [0, 7, 14, 21, 28, 35, 42, 50];                  // the trajectory's eight frames (c115 shows 8)

/* ------------------------------------------------------------- strings */

const f2 = (v) => v.toFixed(2);
const f3 = (v) => v.toFixed(3);
const sgn2 = (v) => (v < 0 ? `(−${f2(-v)})` : f2(v));

const S = {
  subtitle:
    "A diffusion model is trained to predict the noise that was added to an image, at every level of noise. " +
    "To generate, it starts from pure noise and removes the predicted noise a little at a time. " +
    "The two models here are small U-Nets trained on handwritten digits.",
  pageLabel: "Stage",
  digitLabel: "Digit",
  digitDetail: "x₀, an image from the training set",
  tLabel: "Step t",
  tDetail: "of the forward process, 0 to 999; a click on a frame below sets it",
  iterLabel: "Iteration",
  iterDetail: "one pass of the training loop: an image x₀, a step t and a noise ε, each drawn at random",
  sampleLabel: "Sample",
  sampleDetail: "one of the 16 generated together; a click on a sample below picks it",
  labelLabel: "Label c",
  labelDetail: "the digit to generate; a click on a column below picks it",
  stepTitle: {
    training: "Go to the next saved checkpoint of the training run",
    ctraining: "Go to the next saved checkpoint of the training run",
    generation: "Run the next 50 of the 500 denoising steps",
    conditional: "Run the next 15 of the 75 denoising steps",
  },
  runTitle: {
    training: "Play the training run through every saved checkpoint",
    ctraining: "Play the training run through every saved checkpoint",
    generation: "Run every denoising step to the end",
    conditional: "Run every denoising step to the end",
  },
  fwd: {
    x0: "x₀",
    eps: "ε ~ N(0, I)",
    xt: (t) => `xₜ, t = ${t}`,
    hint: "A pointer on any pixel shows its three values.",
    sum: (r, c, a, v0, b, e, v) => `pixel (${r}, ${c}):  ${f2(a)} × ${sgn2(v0)} + ${f2(b)} × ${sgn2(e)} = ${v < 0 ? "−" + f2(-v) : f2(v)}`,
    curves: "The weights on x₀ and ε at each step t",
    wa: "√ᾱₜ, the weight on x₀",
    wb: "√(1 − ᾱₜ), the weight on ε",
    hist: "The 784 pixel values, as the share in each bin",
    histX0: "x₀, the image",
    histXt: "xₜ at this t",
    histN: "N(0, 1), dashed",
    clamp: "below −1 drawn black · above 1 drawn white",
    frames: "Six steps of the forward process",
    frameT: (t) => `t = ${t}`,
    card: { t: (t) => `t = ${t}`, a: (v) => `√ᾱₜ = ${v}`, b: (v) => `√(1 − ᾱₜ) = ${v}` },
  },
  tr: {
    x0: (d, cond) => (cond ? `x₀, label c = ${d}` : `x₀, a ${d}`),
    eps: "ε, the noise added",
    xt: (t) => `xₜ, t = ${t}`,
    epsHat: (cond) => (cond ? "ε̂ = εθ(xₜ, t, c)" : "ε̂ = εθ(xₜ, t)"),
    mse: (v) => `‖ε − ε̂‖² per pixel = ${v}`,
    loss: "Training loss per batch (log axes)",
    batch: "batch",
    samples: (name, cond) => (cond ? `One sample a label from the model ${name}, all from one starting noise` : `Eight samples from the model ${name}, 500 denoising steps each`),
    c: (d) => `c = ${d}`,
  },
  gen: {
    xt: (t) => `xₜ, t = ${t}`,
    result: "x₀, the result",
    epsHat: "ε̂, the predicted noise",
    x0Hat: "x̂₀, what remains",
    weights: "The two weights as generation runs, t from 999 down to 0",
    onEps: "on ε̂",
    onX0: "on x̂₀",
    all: "All 16 samples at this step",
    traj: "The selected sample so far: xₜ, and x̂₀ under it",
    frameT: (t) => (t < 0 ? "result" : `t = ${t}`),
  },
  cond: {
    top: (c) => `The first-row sample with label c = ${c}`,
    grid: "Four samples a label; each row starts from the same noise",
  },
  card: { xt: "xₜ", x0Hat: "x̂₀", sample: (k) => `sample ${k}`, label: (c, r) => `c = ${c}, row ${r}` },
  legend: {
    x0: "x₀ and its weight √ᾱₜ",
    eps: "ε and its weight √(1 − ᾱₜ)",
    now: "the step t shown",
    target: "ε, the noise the network is asked for",
    pred: "ε̂, the network's prediction, and the loss",
    genX0: "x̂₀ and its weight √ᾱₜ",
    genEps: "ε̂, the predicted noise, and its weight √(1 − ᾱₜ)",
    chosen: "the selected sample",
    chosenLabel: (c) => `label c = ${c}`,
  },
  tile: {
    t: "Step t", a: "√ᾱₜ", aNote: "the weight on x₀", b: "√(1 − ᾱₜ)", bNote: "the weight on ε",
    ck: "Checkpoint", ckNote: (ep) => `of a training run of ${ep} epochs, 235 batches each`,
    it: "This iteration's t", mse: "‖ε − ε̂‖² per pixel", mseNote: "0 when ε̂ = ε",
    step: "Denoising step", stepNote: (n) => `of ${n}`, tNow: "t", done: "done",
    label: "Label c",
  },
};

const CAP = {
  forward: (t) =>
    t < T_EVEN
      ? "The forward process adds Gaussian noise to x₀. Each pixel of ε is one value drawn from N(0, 1), and xₜ is the weighted sum of the two, pixel by pixel; at this t the weight on x₀ is the larger."
      : t < T_TENTH
        ? `From t = ${T_EVEN} the weight on the noise is the larger, and the pixel values spread from the image's two spikes toward N(0, 1). Nothing is learned here: the weights are fixed by the schedule.`
        : `From t = ${T_TENTH} the weight on x₀ is under 0.1: the pixel values are close to N(0, 1) and xₜ is close to pure noise for every digit. The frames at t = 800 and 999 look alike for this reason.`,
  training: (ck, playing) =>
    playing
      ? `Training, ${CK_NAME[ck]}: the loss falls, ε̂ moves toward ε, and the samples move toward digits.`
      : ck === 0
        ? "One iteration of the loop: noise ε is added to x₀ at step t, and the network is given xₜ and t and asked for ε. Before training ε̂ bears no relation to ε, and the model generates noise."
        : ck < MAX.training
          ? "The model at a saved checkpoint of the training run: ε̂ for the same iteration, the loss up to this batch, and samples generated with the model as it stands."
          : "After 3 epochs. Where t is large, xₜ is mostly ε, and ε̂ matches it closely; near t = 0 the noise is a faint layer over the digit, and ε̂ is further off. The iterations with t = 8 and t = 930 show the two ends.",
  /* measured on these samples (`_lab/diffusion-mock2data.py`): one shape for every label to 50 batches, mixed through epoch 3, most labels followed from epoch 4 */
  ctraining: (ck, playing) =>
    playing
      ? `Training, ${CK_NAME[ck]}: the loss falls, and the samples move from one shape for every label toward the digit each label names.`
      : ck === 0
        ? "The same loop with the label: c is given to the network beside xₜ and t, and the network is asked for ε. Before training the model generates noise, whatever the label."
        : ck <= 3
          ? "The samples are nearly the same shape whatever the label: c is in the network's input, but its weights do not use it yet."
          : ck <= 8
            ? "The samples take digit-like shapes before they follow the label: different labels give different shapes, often not the digit asked for."
            : "From epoch 4 most samples follow their label. The conditional model was trained for 5 epochs, the unconditional one for 3.",
  generation: (f) => {
    const t = GENERATION.t[f];
    if (f === 0) return "Generation starts from pure noise, at t = T. The network predicts the noise ε̂ in xₜ; subtracting its share, √(1 − ᾱₜ) × ε̂, leaves √ᾱₜ × x̂₀. Here √ᾱₜ is 0.006, so x̂₀ is noise too: dividing by it magnifies every error in ε̂.";
    if (t < 0) return "After 500 steps, each removing a step's share of the predicted noise and adding a little fresh noise, the result is a new sample.";
    if (t > 600) return "Each step removes a small share of the predicted noise and adds a little fresh noise. x̂₀, what would remain if all of the noise were subtracted at once, is a blur that changes from step to step.";
    if (t > 200) return "As t falls, the weight on ε̂ falls and the weight on x̂₀ rises: less of xₜ is noise. x̂₀ takes the shape of a digit before xₜ does.";
    return "Near the end little noise is left to subtract: xₜ is close to x̂₀, and the last steps sharpen it.";
  },
  conditional: (f) => {
    const t = CONDITIONAL.t[f];
    if (f === 0) return "The same loop, with the label c given to the network at every step. Along a row the starting noise and every added noise are the same; only c differs.";
    if (t < 0) return "Along a row the noise was identical and only c differed. Most samples end as the digit their label names; on 300 samples, 91% did.";
    return "The label enters at every step. Along a row the noise is identical, so where the samples differ, c made the difference.";
  },
};

/* ------------------------------------------------------------- the card: a diagram and a formula a page */

const svEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/* xₜ, x_{t−1}, εθ: subscripts as tspans, so the diagram reads as the notebook's math */
const svSub = (t) => svEsc(t).replace(/_\{([^}]*)\}|_([A-Za-zθ0-9])/g, (m, a, b) => `<tspan baseline-shift="sub" font-size="9">${a ?? b}</tspan>`);
const svBox = (x, y, w, h, t, color, weight = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:var(--surface-1);stroke:${color};stroke-width:1.6"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" style="fill:var(--ink-1);${weight}">${svSub(t)}</text>`;
const svText = (x, y, t, fill = "var(--ink-2)", anchor = "start", style = "") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${fill};${style}">${svSub(t)}</text>`;
function svPath(pts, color, dashed = false) {
  let s = `<polyline points="${pts.map((q) => q.join(",")).join(" ")}" style="fill:none;stroke:${color};stroke-width:1.5${dashed ? ";stroke-dasharray:3 3" : ""}"/>`;
  const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1], a = Math.atan2(y1 - y0, x1 - x0), h = 7;
  const p = [[x1, y1], [x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)], [x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)]];
  return s + `<polygon points="${p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" style="fill:${color}"/>`;
}
/* the diagrams' paths, shared by the drawing and the moving dot */
const P = {
  tr: {
    x0: [[58, 22], [96, 22], [118, 52]], t: [[58, 60], [118, 60]], eps: [[58, 98], [96, 98], [118, 68]],
    toNet: [[216, 60], [246, 60]], toLoss: [[318, 60], [350, 60]], epsLoss: [[58, 108], [407, 108], [407, 78]],
    /* with the label: ε's line to the loss drops below the label's box */
    epsLossC: [[33, 112], [33, 124], [407, 124], [407, 78]],
    back: [[462, 60], [510, 60], [510, 22], [283, 22], [283, 38]],
  },
  gen: { start: [[94, 60], [132, 60]], toStep: [[204, 60], [240, 60]], loop: [[337, 40], [337, 18], [112, 18], [112, 56]], out: [[432, 60], [470, 60]] },
};
const FWD_TR = [[30, 22], ...P.tr.x0, [168, 60], ...P.tr.toNet, [283, 60], ...P.tr.toLoss, [407, 60]];
const LOOP_GEN = [[168, 60], ...P.gen.toStep, [337, 60], ...P.gen.loop, [168, 60]];

function diagramSVG(page) {
  const ink = "var(--ink-3)";
  let s = "", h = 120, label = "";
  if (page === "forward") {
    const xs = [10, 120, 230, 380, 470], lab = ["x_0", "x_1", "x_{t−1}", "x_t", "x_T"];
    xs.forEach((x, i) => { s += svBox(x, 30, 60, 30, lab[i], i === 0 ? "var(--c-group-a)" : i === 3 ? "var(--c-highlight)" : ink); });
    s += svPath([[70, 45], [118, 45]], ink) + svText(94, 24, "q", "var(--ink-2)", "middle");
    s += svText(200, 50, "···", "var(--ink-1)", "middle");
    s += svPath([[290, 45], [378, 45]], ink) + svText(334, 24, "q(x_t | x_{t−1})", "var(--ink-2)", "middle");
    s += svText(455, 50, "···", "var(--ink-1)", "middle");
    s += svText(40, 80, "the data", "var(--ink-2)", "middle") + svText(500, 80, "close to N(0, I)", "var(--ink-2)", "middle");
    s += svText(270, 106, "Each step adds a little Gaussian noise, with variance β_t. Nothing is learned.", "var(--ink-2)", "middle");
    label = "The forward process: a chain from the data x0 through x1 and onward to xT, each step adding a little Gaussian noise; nothing is learned.";
  } else if (isTrain(page)) {
    const cond = page === "ctraining";
    s += svBox(8, 8, 50, 28, "x_0", ink) + svBox(8, 46, 50, 28, "t", ink) + svBox(8, 84, 50, 28, "ε", "var(--c-reference)");
    s += svPath(P.tr.x0, ink) + svPath(P.tr.t, ink) + svPath(P.tr.eps, ink);
    s += svBox(120, 44, 96, 32, "add noise", ink);
    s += svPath(P.tr.toNet, ink) + svText(231, 52, "x_t", "var(--ink-2)", "middle");
    s += svBox(248, 40, 70, 40, "ε_θ", "var(--c-empirical)", "font-weight:600");
    if (cond) { s += svBox(248, 92, 70, 22, "c, the label", "var(--c-highlight)") + svPath([[283, 92], [283, 82]], ink); h = 132; }
    s += svPath(P.tr.toLoss, ink) + svText(334, 52, "ε̂", "var(--ink-2)", "middle");
    s += svBox(352, 44, 110, 32, "‖ε − ε̂‖²", "var(--c-empirical)");
    s += svPath(cond ? P.tr.epsLossC : P.tr.epsLoss, "var(--c-reference)", true);
    s += svPath(P.tr.back, "var(--c-slope)") + svText(396, 15, "update ε_θ's weights", "var(--c-slope)", "middle");
    label = `The training loop: x0, a step t and noise epsilon make xt; the network epsilon-theta${cond ? ", given the label c," : ""} predicts the noise from xt and t; the loss compares the prediction with epsilon, and the gradient updates the network's weights.`;
  } else {
    const cond = page === "conditional", steps = cond ? 75 : 500;
    s += svBox(8, 44, 86, 32, "x_T ~ N(0, I)", ink) + svPath(P.gen.start, ink);
    s += svBox(134, 40, 70, 40, "ε_θ", "var(--c-empirical)", "font-weight:600");
    if (cond) { s += svBox(134, 92, 70, 24, "c, the label", "var(--c-highlight)") + svPath([[169, 92], [169, 82]], ink); h = 122; }
    s += svPath(P.gen.toStep, ink) + svText(222, 52, "ε̂", "var(--ink-2)", "middle");
    s += svBox(242, 40, 190, 40, "x_{t−1} from x_t and ε̂, plus σ_t z", ink);
    s += svPath(P.gen.out, ink) + svBox(472, 44, 60, 32, "x_0", "var(--c-empirical)");
    s += svPath(P.gen.loop, ink, true) + svText(225, 12, `repeated for t = T, …, 1 (${steps} steps)`, "var(--ink-2)", "middle");
    label = `The sampling loop: start from noise xT; at each of ${steps} steps the network${cond ? ", given the label c," : ""} predicts the noise, and the step computes x(t−1) from xt and the prediction plus a little fresh noise; the last step gives x0.`;
  }
  return `<svg viewBox="0 0 540 ${h}" role="img" aria-label="${svEsc(label)}" style="display:block;width:100%;height:auto;font:12px var(--font)">${s}<g data-sv="motion"></g></svg>`;
}

const MATHML = mathmlRenders();
const mi = (s) => `<mi>${s}</mi>`, mo = (s) => `<mo>${s}</mo>`, mn = (s) => `<mn>${s}</mn>`;
const sub = (b, s) => `<msub>${b}${s}</msub>`;
const hat = (b) => `<mover accent="true">${b}<mo>^</mo></mover>`;
const sq = (b) => `<msqrt>${b}</msqrt>`;
const frac = (a, b) => `<mfrac>${a}${b}</mfrac>`;
const xt = sub(mi("x"), mi("t")), x0 = sub(mi("x"), mn(0)), xtm1 = sub(mi("x"), `<mrow>${mi("t")}${mo("−")}${mn(1)}</mrow>`);
const abar = sub(mi("ᾱ"), mi("t")), alpha = sub(mi("α"), mi("t")), eps = mi("ε"), epsH = hat(mi("ε"));
const one = mn(1), oneMinus = (b) => `<mrow>${one}${mo("−")}${b}</mrow>`;
const epsTheta = (args) => `${sub(mi("ε"), mi("θ"))}${mo("(")}${args}${mo(")")}`;
const norm2 = (b) => `<msup><mrow>${mo("‖")}${b}${mo("‖")}</mrow>${mn(2)}</msup>`;
const EQ = {
  forward: {
    lead: "",
    math: `${xt}${mo("=")}${sq(abar)}${x0}${mo("+")}${sq(oneMinus(abar))}${eps}${mo(",")}<mspace width="1em"/>${eps}${mo("∼")}${mi("N")}${mo("(")}${mn(0)}${mo(",")}${mi("I")}${mo(")")}${mo(",")}<mspace width="1em"/>${abar}${mo("=")}<munderover>${mo("∏")}<mrow>${mi("s")}${mo("=")}${mn(1)}</mrow>${mi("t")}</munderover>${mo("(")}${oneMinus(sub(mi("β"), mi("s")))}${mo(")")}`,
    plain: "xₜ = √ᾱₜ x₀ + √(1 − ᾱₜ) ε,  ε ~ N(0, I),  ᾱₜ = ∏ₛ₌₁ᵗ (1 − βₛ)",
    note: "βₜ rises from 0.0001 to 0.02 over T = 1000 steps (the linear schedule). The formula reaches step t in one move; the chain above reaches it one step at a time. N(0, I) is one draw from N(0, 1) for each of the 784 pixels.",
  },
  training: {
    lead: "Update εθ to minimise",
    math: `<mi mathvariant="bold">L</mi>${mo("=")}${norm2(`${eps}${mo("−")}${epsTheta(`${xt}${mo(",")}${mi("t")}`)}`)}`,
    plain: "L = ‖ε − εθ(xₜ, t)‖²",
    note: "Each iteration draws x₀ from the data, t from 0 to 999 and ε from N(0, I); the network is trained to output ε. The model was trained for 3 epochs of 235 batches of 256; each press moves to the next saved checkpoint.",
  },
  ctraining: {
    lead: "Update εθ to minimise",
    math: `<mi mathvariant="bold">L</mi>${mo("=")}${norm2(`${eps}${mo("−")}${epsTheta(`${xt}${mo(",")}${mi("t")}${mo(",")}${mi("c")}`)}`)}`,
    plain: "L = ‖ε − εθ(xₜ, t, c)‖²",
    note: "The loop of the unconditional model, with the label c added: it enters as ten one-hot channels concatenated to xₜ. The model was trained for 5 epochs of 235 batches of 256; each press moves to the next saved checkpoint.",
  },
  generation: {
    lead: "",
    math: `${xtm1}${mo("=")}${frac(`<mrow>${xt}${mo("−")}${frac(oneMinus(alpha), sq(oneMinus(abar)))}${epsH}</mrow>`, sq(alpha))}${mo("+")}${sub(mi("σ"), mi("t"))}${mi("z")}${mo(",")}<mspace width="1.2em"/>${sub(hat(mi("x")), mn(0))}${mo("=")}${frac(`<mrow>${xt}${mo("−")}${sq(oneMinus(abar))}${epsH}</mrow>`, sq(abar))}`,
    plain: "xₜ₋₁ = (xₜ − (1 − αₜ)/√(1 − ᾱₜ) · ε̂)/√αₜ + σₜ z,   x̂₀ = (xₜ − √(1 − ᾱₜ) ε̂)/√ᾱₜ",
    note: "500 steps; each press runs 50 of them. One step subtracts a small share of ε̂, (1 − αₜ)/√(1 − ᾱₜ) of it, between 0.01 and 0.04 here, and adds fresh noise σₜ z. x̂₀ is what remains if all of ε̂'s share is subtracted; the scheduler computes the same step from x̂₀, clipped to [−1, 1].",
  },
  conditional: {
    lead: "",
    math: `${epsH}${mo("=")}${epsTheta(`${xt}${mo(",")}${mi("t")}${mo(",")}${mi("c")}`)}${mo(",")}<mspace width="1.2em"/>${sub(hat(mi("x")), mn(0))}${mo("=")}${frac(`<mrow>${xt}${mo("−")}${sq(oneMinus(abar))}${epsH}</mrow>`, sq(abar))}`,
    plain: "ε̂ = εθ(xₜ, t, c),   x̂₀ = (xₜ − √(1 − ᾱₜ) ε̂)/√ᾱₜ",
    note: "The steps of Generation, with c given to the network at every step as ten one-hot channels concatenated to xₜ. 75 steps; each press runs 15 of them.",
  },
};

let mathHost = null, mathKey = null;
function renderCard(page) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === page) return;
  mathKey = page;
  const e = EQ[page];
  const eq = `<div class="w-math-eq">${e.lead ? `<span style="color:var(--ink-2)">${e.lead}</span> ` : ""}${MATHML ? `<math display="block"><mrow>${e.math}</mrow></math>` : e.plain}</div>`;
  mathHost.innerHTML = `<div class="w-math-schema" style="margin-bottom:var(--sp-2)">${diagramSVG(page)}</div>${eq}<div class="w-math-note">${e.note}</div>`;
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
function along(Pts, t) {
  const seg = Pts.slice(1).map((q, i) => Math.hypot(q[0] - Pts[i][0], q[1] - Pts[i][1])), Ln = seg.reduce((a, b) => a + b, 0);
  let d = t * Ln;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = seg[i] ? d / seg[i] : 0; return [Pts[i][0] + (Pts[i + 1][0] - Pts[i][0]) * f, Pts[i][1] + (Pts[i + 1][1] - Pts[i][1]) * f]; } d -= seg[i]; }
  return Pts[Pts.length - 1];
}
const svDot = (p, col) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" style="fill:${col}"/>`;
/** a press: Training's dot forward over 55%, the gradient back over the next 40%; Generation's dot round the loop once a stored frame */
function updateMotion(anim, page) {
  const layer = mathHost?.querySelector('[data-sv="motion"]');
  if (!layer) return;
  let s = "";
  if (anim && anim.mode === "step" && anim.f < 1 && anim.stage === page) {
    const f = anim.f;
    if (isTrain(page)) {
      if (f < 0.55) s = svDot(along(FWD_TR, ease(f / 0.55)), "var(--ink-1)");
      else if (f < 0.95) s = svDot(along(P.tr.back, ease((f - 0.55) / 0.4)), "var(--c-slope)");
    } else if (page !== "forward") {
      const laps = STEP[page], u = (f * laps) % 1;
      s = svDot(along(LOOP_GEN, u), "var(--ink-1)");
    }
  }
  layer.innerHTML = s;
}

/* ------------------------------------------------------------- the animation's position */

const posOf = (anim, page) => anim?.n?.[page] ?? 0;
/** the stored frame shown: during a press, the press's start eased toward its target */
function frameOf(anim, page) {
  const n = posOf(anim, page);
  if (!anim || anim.stage !== page || anim.f >= 1) return n;
  const e = anim.mode === "run" ? anim.f : ease(anim.f);
  return Math.floor(anim.from + (n - anim.from) * e);
}
/** the checkpoint a training page draws its images from: the press's start until the press lands */
const landedOf = (anim, page) => (anim?.stage === page && anim.f < 1 ? anim.from : posOf(anim, page));

/* ------------------------------------------------------------- drawing helpers */

const PAD = 10;
let off = null, offData = null;
function img(ctx, u8, k, x, y, s, frame = null, lw = 2) {
  if (!off) { off = document.createElement("canvas"); off.width = off.height = 28; offData = off.getContext("2d").createImageData(28, 28); }
  const d = offData.data;
  for (let i = 0; i < 784; i++) { const v = u8[k * 784 + i]; d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v; d[4 * i + 3] = 255; }
  off.getContext("2d").putImageData(offData, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, x, y, s, s); ctx.restore();
  if (frame) { ctx.save(); ctx.strokeStyle = frame; ctx.lineWidth = lw; ctx.strokeRect(x - lw / 2, y - lw / 2, s + lw, s + lw); ctx.restore(); }
}
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
function title(ctx, colors, s, y) { txt(ctx, colors, s, PAD, y, { size: colors.fsSm, fill: colors.ink1, weight: "600" }); }
/** a hover card of images, each with its label, beside the pointer */
function imageCard(ctx, colors, w, pointer, head, items) {
  const s = 84, cw = 16 + items.length * (s + 10) - 10, ch = 30 + s + 18;
  let cx = pointer.x + 14; if (cx + cw > w - 4) cx = pointer.x - 14 - cw;
  let cy = pointer.y - ch - 10; if (cy < 4) cy = pointer.y + 16;
  ctx.save(); ctx.fillStyle = colors.surface; ctx.fillRect(cx, cy, cw, ch); ctx.strokeStyle = colors.ink3; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1); ctx.restore();
  txt(ctx, colors, head, cx + 8, cy + 17, { fill: colors.ink1, weight: "600" });
  items.forEach(([u8, k, label, col], j) => {
    const x = cx + 8 + j * (s + 10);
    img(ctx, u8, k, x, cy + 26, s, col, 1.5);
    txt(ctx, colors, label, x + s / 2, cy + 26 + s + 14, { align: "center", fill: col ?? colors.ink2 });
  });
}
const inside = (p, r) => p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
/** the image-equation row a op1 b op2 c, its two weights printed before b and c (Forward's and Generation's) */
function equationRow(ctx, colors, R, [A, B, Cc], [op1, op2], [wB, wC]) {
  const { s, y, xa, xb, xc } = R, mid = y + s / 2 + 5;
  img(ctx, A[0], A[1], xa, y, s, A[2]);
  txt(ctx, colors, op1, xa + s + 8, mid, { size: colors.fsSm, fill: colors.ink1 });
  txt(ctx, colors, wB[0], xa + s + 22, mid, { size: colors.fsSm, fill: wB[1], weight: "600" });
  txt(ctx, colors, "×", xa + s + 54, mid, { size: colors.fsSm, fill: colors.ink2 });
  img(ctx, B[0], B[1], xb, y, s, B[2]);
  txt(ctx, colors, op2, xb + s + 8, mid, { size: colors.fsSm, fill: colors.ink1 });
  if (wC) {
    txt(ctx, colors, wC[0], xb + s + 22, mid, { size: colors.fsSm, fill: wC[1], weight: "600" });
    txt(ctx, colors, "×", xb + s + 54, mid, { size: colors.fsSm, fill: colors.ink2 });
  }
  img(ctx, Cc[0], Cc[1], xc, y, s, Cc[2]);
}

/* ------------------------------------------------------------- layouts */

/** the equation row: three images of side s, room for an operator and a weight in each gap */
function eqRow(w, y) {
  const s = Math.min(112, Math.floor((w - 2 * PAD - 136) / 3)), gap = 68;
  const xa = PAD + Math.max(0, Math.floor((w - 2 * PAD - 3 * s - 2 * gap) / 2));
  return { s, y, xa, xb: xa + s + gap, xc: xa + 2 * (s + gap) };
}
function layoutOf(w, page) {
  if (page === "forward") {
    /* x₀'s weight sits left of x₀ (+46), so the row starts 46 in: x₀ + ε = xₜ */
    const s = Math.min(112, Math.floor((w - 2 * PAD - 140) / 3)), y = 30;
    const xa = PAD + 46, xb = xa + s + 68, xc = xb + s + 26;
    const sumY = y + s + 24;
    const curves = { L: PAD + 30, R: w - PAD - 8, y0: sumY + 44, y1: sumY + 124 };
    const hist = { L: PAD + 30, R: w - PAD - 8, y0: curves.y1 + 58, y1: curves.y1 + 150 };
    const fs = Math.min(66, Math.floor((w - 2 * PAD - 5 * 14) / 6)), gap = (w - 2 * PAD - 6 * fs) / 5;
    const fy = hist.y1 + 68;
    const frames = C107.map((t, j) => ({ t, x: PAD + j * (fs + gap), y: fy, w: fs, h: fs }));
    const capTop = fy + fs + 44;
    return { s, y, xa, xb, xc, sumY, curves, hist, frames, capTop, height: capTop + 4 * 17 };
  }
  if (isTrain(page)) {
    const s = Math.min(104, Math.floor((w - 2 * PAD - 3 * 26) / 4)), y = 30;
    const xs = [0, 1, 2, 3].map((j) => PAD + j * (s + 26));
    const loss = { L: PAD + 34, R: w - PAD - 8, y0: y + s + 74, y1: y + s + 184 };
    const n = page === "ctraining" ? 10 : 8, sg = page === "ctraining" ? 6 : 8;
    const ss = Math.floor((w - 2 * PAD - (n - 1) * sg) / n), sy = loss.y1 + (page === "ctraining" ? 70 : 54);
    const samples = Array.from({ length: n }, (_, j) => ({ x: PAD + j * (ss + sg), y: sy, w: ss, h: ss }));
    const capTop = sy + ss + 30;
    return { s, y, xs, loss, samples, capTop, height: capTop + 4 * 17 };
  }
  if (page === "generation") {
    const R = eqRow(w, 30);
    const weights = { L: PAD + 30, R: w - PAD - 8, y0: R.y + R.s + 50, y1: R.y + R.s + 120 };
    const gs = Math.floor((w - 2 * PAD - 7 * 8) / 8), gy = weights.y1 + 52;
    const grid = Array.from({ length: 16 }, (_, j) => ({ k: j, x: PAD + (j % 8) * (gs + 8), y: gy + Math.floor(j / 8) * (gs + 8), w: gs, h: gs }));
    const ts = gs, ty = gy + 2 * (gs + 8) + 34;
    const traj = TRAJ.map((fr, j) => ({ fr, x: PAD + j * (ts + 8), y: ty, w: ts, h: ts, y2: ty + ts + 22 }));
    const capTop = ty + 2 * ts + 22 + 34;
    return { ...R, weights, grid, gs, traj, ts, capTop, height: capTop + 4 * 17 };
  }
  const R = eqRow(w, 48);
  const cs = Math.min(46, Math.floor((w - 2 * PAD - 9 * 8) / 10)), gx = (w - 2 * PAD - 10 * cs) / 9, gy = R.y + R.s + 64;
  const grid = [];
  for (let r = 0; r < 4; r++) for (let d = 0; d < 10; d++) grid.push({ r, d, x: PAD + d * (cs + gx), y: gy + r * (cs + 6), w: cs, h: cs });
  const capTop = gy + 4 * (cs + 6) + 28;
  return { ...R, cs, gx, gy, grid, capTop, height: capTop + 4 * 17 };
}

/* ------------------------------------------------------------- the pages */

function drawForward(ctx, colors, w, Lo, params, state, pointer) {
  const t = Number(params.t), k = Number(params.digit), a = sa(t), b = sn(t);
  const x0v = (i) => X0F[k * 784 + i] / 255 * 2 - 1;
  const mix = (tt) => { const u = new Uint8Array(784), A = sa(tt), B = sn(tt); for (let i = 0; i < 784; i++) u[i] = disp(A * x0v(i) + B * state.eps[i]); return u; };
  const eu = new Uint8Array(784); for (let i = 0; i < 784; i++) eu[i] = disp(state.eps[i]);
  const { s, y, xa, xb, xc } = Lo, mid = y + s / 2 + 5;
  txt(ctx, colors, f2(a), PAD, mid, { size: colors.fsSm, fill: colors.groupA, weight: "600" });
  txt(ctx, colors, "×", PAD + 34, mid, { size: colors.fsSm, fill: colors.ink2 });
  img(ctx, X0F, k, xa, y, s, colors.groupA);
  txt(ctx, colors, "+", xa + s + 8, mid, { size: colors.fsSm, fill: colors.ink1 });
  txt(ctx, colors, f2(b), xa + s + 22, mid, { size: colors.fsSm, fill: colors.groupB, weight: "600" });
  txt(ctx, colors, "×", xa + s + 54, mid, { size: colors.fsSm, fill: colors.ink2 });
  img(ctx, eu, 0, xb, y, s, colors.groupB);
  txt(ctx, colors, "=", xb + s + 9, mid, { size: colors.fsSm, fill: colors.ink1 });
  img(ctx, mix(t), 0, xc, y, s, colors.highlight);
  txt(ctx, colors, S.fwd.x0, xa + s / 2, y - 9, { align: "center", fill: colors.groupA });
  txt(ctx, colors, S.fwd.eps, xb + s / 2, y - 9, { align: "center", fill: colors.groupB });
  txt(ctx, colors, S.fwd.xt(t), xc + s / 2, y - 9, { align: "center", fill: colors.ink1, weight: "600" });
  /* a pointer on a pixel of any of the three: ring it in all three and print its sum (review call 1) */
  let px_ = null;
  for (const X of [xa, xb, xc]) if (pointer && pointer.x >= X && pointer.x < X + s && pointer.y >= y && pointer.y < y + s) px_ = Math.floor(((pointer.y - y) / s) * 28) * 28 + Math.floor(((pointer.x - X) / s) * 28);
  if (px_ != null) {
    const r = Math.floor(px_ / 28), c = px_ % 28, p = s / 28;
    for (const X of [xa, xb, xc]) { ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 2; ctx.strokeRect(X + c * p - 1.5, y + r * p - 1.5, p + 3, p + 3); ctx.restore(); }
    txt(ctx, colors, S.fwd.sum(r, c, a, x0v(px_), b, state.eps[px_], a * x0v(px_) + b * state.eps[px_]), PAD, Lo.sumY, { size: colors.fsSm, fill: colors.ink1, weight: "600" });
  } else txt(ctx, colors, S.fwd.hint, PAD, Lo.sumY, { fill: colors.ink3 });
  /* the two weights */
  const C = Lo.curves, px = (tt) => C.L + (tt / (T - 1)) * (C.R - C.L), py = (v) => C.y1 - v * (C.y1 - C.y0);
  title(ctx, colors, S.fwd.curves, C.y0 - 14);
  line(ctx, C.L, C.y0, C.L, C.y1 + 0.5, colors.axis); line(ctx, C.L, C.y1 + 0.5, C.R, C.y1 + 0.5, colors.axis);
  for (const v of [0, 0.5, 1]) txt(ctx, colors, String(v), C.L - 5, py(v) + 4, { align: "right", fill: colors.ink3 });
  for (const tt of [0, 200, 400, 600, 800, 999]) txt(ctx, colors, String(tt), px(tt), C.y1 + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, "t", C.R, C.y1 + 28, { align: "right", fill: colors.ink2 });
  for (const [f, col] of [[sa, colors.groupA], [sn, colors.groupB]]) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let tt = 0; tt < T; tt += 3) { const Y = py(f(tt)); tt ? ctx.lineTo(px(tt), Y) : ctx.moveTo(px(tt), Y); }
    ctx.lineTo(px(T - 1), py(f(T - 1))); ctx.stroke(); ctx.restore();
  }
  txt(ctx, colors, S.fwd.wa, px(640), py(sa(640)) - 10, { fill: colors.groupA, halo: true });
  txt(ctx, colors, S.fwd.wb, px(640), py(sn(640)) + 18, { fill: colors.groupB, halo: true });
  line(ctx, px(t), C.y0 - 4, px(t), C.y1, colors.highlight, 1.5);
  for (const [v, col] of [[a, colors.groupA], [b, colors.groupB]]) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(t), py(v), 3.5, 0, 2 * Math.PI); ctx.fill(); ctx.restore(); }
  /* the 784 values: x₀'s two spikes, xₜ's, and N(0, 1) per bin (review call 1) */
  const H = Lo.hist, lo = -3.5, hi = 3.5, nb = 35, bw = (hi - lo) / nb, hx = (v) => H.L + ((v - lo) / (hi - lo)) * (H.R - H.L);
  const hist = (f) => { const h = new Array(nb).fill(0); for (let i = 0; i < 784; i++) h[Math.min(nb - 1, Math.max(0, Math.floor((f(i) - lo) / bw)))]++; return h.map((c) => c / 784); };
  const h0 = hist(x0v), ht = hist((i) => a * x0v(i) + b * state.eps[i]), ymax = 0.25, hy = (v) => H.y1 - (Math.min(v, ymax) / ymax) * (H.y1 - H.y0);
  title(ctx, colors, S.fwd.hist, H.y0 - 22);
  ctx.save(); ctx.fillStyle = colors.highlight; ctx.globalAlpha = 0.45;
  ht.forEach((v, j) => { if (v > 0) ctx.fillRect(hx(lo + j * bw) + 0.5, hy(v), hx(lo + (j + 1) * bw) - hx(lo + j * bw) - 1, H.y1 - hy(v)); });
  ctx.restore();
  ctx.save(); ctx.strokeStyle = colors.groupA; ctx.lineWidth = 1.6; ctx.beginPath();
  h0.forEach((v, j) => { const X = hx(lo + j * bw); j ? ctx.lineTo(X, hy(v)) : ctx.moveTo(X, hy(v)); ctx.lineTo(hx(lo + (j + 1) * bw), hy(v)); }); ctx.stroke(); ctx.restore();
  h0.forEach((v, j) => { if (v > ymax) txt(ctx, colors, `${Math.round(100 * v)}%`, hx(lo + (j + 0.5) * bw), H.y0 - 4, { align: "center", fill: colors.groupA, weight: "600", halo: true }); });
  ctx.save(); ctx.strokeStyle = colors.groupB; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.beginPath();
  for (let i = 0; i <= 140; i++) { const v = lo + ((hi - lo) * i) / 140, d = (Math.exp((-v * v) / 2) / Math.sqrt(2 * Math.PI)) * bw; i ? ctx.lineTo(hx(v), hy(d)) : ctx.moveTo(hx(v), hy(d)); }
  ctx.stroke(); ctx.restore();
  line(ctx, H.L, H.y1 + 0.5, H.R, H.y1 + 0.5, colors.axis);
  for (const v of [-3, -2, -1, 0, 1, 2, 3]) txt(ctx, colors, String(v).replace("-", "−"), hx(v), H.y1 + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, S.fwd.clamp, hx(0), H.y1 + 30, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, S.fwd.histX0, hx(1.9), H.y0 + 14, { fill: colors.groupA, halo: true });
  txt(ctx, colors, S.fwd.histXt, hx(1.9), H.y0 + 30, { fill: colors.highlight, halo: true });
  txt(ctx, colors, S.fwd.histN, hx(1.9), H.y0 + 46, { fill: colors.groupB, halo: true });
  /* the lesson's frames */
  title(ctx, colors, S.fwd.frames, Lo.frames[0].y - 12);
  for (const F of Lo.frames) {
    img(ctx, mix(F.t), 0, F.x, F.y, F.w, F.t === t ? colors.highlight : null);
    txt(ctx, colors, S.fwd.frameT(F.t), F.x + F.w / 2, F.y + F.h + 14, { align: "center", fill: F.t === t ? colors.ink1 : colors.ink2 });
  }
  /* hover: the curves read out at the pointer's t, with xₜ there */
  if (pointer && pointer.x >= C.L && pointer.x <= C.R && pointer.y >= C.y0 - 6 && pointer.y <= C.y1) {
    const tt = Math.max(0, Math.min(T - 1, Math.round(((pointer.x - C.L) / (C.R - C.L)) * (T - 1))));
    line(ctx, px(tt), C.y0, px(tt), C.y1, colors.ink3, 1, [2, 3]);
    imageCard(ctx, colors, w, pointer, `${S.fwd.card.t(tt)} · ${S.fwd.card.a(f3(sa(tt)))} · ${S.fwd.card.b(f3(sn(tt)))}`, [[mix(tt), 0, S.card.xt, colors.ink2]]);
  }
}

function drawTraining(ctx, colors, w, Lo, params, anim, pointer, page) {
  const tr = TRAINING, run = RUNS[page], cond = page === "ctraining", i = Number(params.iter) - 1;
  const landed = landedOf(anim, page);                      // images switch when a press lands
  const x0 = unpack("tx0", tr.x0), ep = unpack("teps", tr.eps), xt = unpack("txt", tr.xt), eh = unpack(`${page}eh${landed}`, run.epsHat[landed]);
  const { s, y, xs } = Lo;
  img(ctx, x0, i, xs[0], y, s, colors.ink3, 1);
  img(ctx, ep, i, xs[1], y, s, colors.reference);
  img(ctx, xt, i, xs[2], y, s, colors.ink3, 1);
  img(ctx, eh, i, xs[3], y, s, colors.empirical);
  txt(ctx, colors, S.tr.x0(tr.label[i], cond), xs[0] + s / 2, y - 9, { align: "center", fill: colors.ink1 });
  txt(ctx, colors, S.tr.eps, xs[1] + s / 2, y - 9, { align: "center", fill: colors.ink1 });
  txt(ctx, colors, S.tr.xt(tr.t[i]), xs[2] + s / 2, y - 9, { align: "center", fill: colors.ink1 });
  txt(ctx, colors, S.tr.epsHat(cond), xs[3] + s / 2, y - 9, { align: "center", fill: colors.empirical, weight: "600" });
  for (const j of [0, 1, 2]) txt(ctx, colors, "→", xs[j] + s + 13, y + s / 2 + 5, { align: "center", fill: colors.ink2, size: colors.fsSm });
  txt(ctx, colors, S.tr.mse(run.mse[landed][i].toFixed(4)), xs[3] + s, y + s + 18, { align: "right", fill: colors.empirical, weight: "600" });
  /* the loss, log–log, drawn up to the shown checkpoint's batch (moving with the press) */
  const Lc = Lo.loss, NB = run.loss.length, lx = (bt) => Lc.L + (Math.log10(bt + 1) / Math.log10(NB + 1)) * (Lc.R - Lc.L);
  const ly = (v) => Lc.y1 - ((Math.log10(v) + 2) / 2.2) * (Lc.y1 - Lc.y0);
  title(ctx, colors, S.tr.loss, Lc.y0 - 14);
  line(ctx, Lc.L, Lc.y0, Lc.L, Lc.y1 + 0.5, colors.axis); line(ctx, Lc.L, Lc.y1 + 0.5, Lc.R, Lc.y1 + 0.5, colors.axis);
  for (const v of [0.01, 0.1, 1]) txt(ctx, colors, String(v), Lc.L - 5, ly(v) + 4, { align: "right", fill: colors.ink3 });
  /* every checkpoint has a dot; the epochs sit too close together on log axes to each carry a number */
  for (const bt of [0, 5, 20, 50, 100, 200, NB]) txt(ctx, colors, String(bt), lx(bt), Lc.y1 + 14, { align: "center", fill: colors.ink3 });
  txt(ctx, colors, S.tr.batch, Lc.R, Lc.y1 + 28, { align: "right", fill: colors.ink2 });
  const moving = anim?.stage === page && anim.f < 1;
  const from = run.batch[moving ? anim.from : posOf(anim, page)], to = run.batch[posOf(anim, page)];
  const e = moving ? (anim.mode === "run" ? anim.f : ease(anim.f)) : 1;
  const upto = Math.round(from + (to - from) * e);
  if (upto > 0) {
    ctx.save(); ctx.strokeStyle = colors.empirical; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let bt = 0; bt < upto; bt++) { const X = lx(bt + 1), Y = ly(Math.max(0.0105, run.loss[bt])); bt ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
  }
  run.batch.forEach((bt, j) => {
    const on = j === landed;
    ctx.save(); ctx.fillStyle = on ? colors.highlight : colors.grid; ctx.beginPath(); ctx.arc(lx(bt), Lc.y1, on ? 4 : 2.5, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
  });
  /* the model's samples: eight (unconditional), or one a label from one starting noise (conditional) */
  const sm = unpack(`${page}s${landed}`, run.samples[landed]);
  title(ctx, colors, S.tr.samples(CK_NAME[landed], cond), Lo.samples[0].y - (cond ? 26 : 12));
  Lo.samples.forEach((R, j) => {
    img(ctx, sm, j, R.x, R.y, R.w, null);
    if (cond) txt(ctx, colors, S.tr.c(j), R.x + R.w / 2, R.y - 6, { align: "center", fill: colors.ink2 });
  });
  const hov = Lo.samples.findIndex((R) => inside(pointer, R));
  if (hov >= 0) imageCard(ctx, colors, w, pointer, CK_NAME[landed], [[sm, hov, cond ? S.tr.c(hov) : S.card.sample(hov + 1), colors.ink2]]);
}

/** the weights panel under Generation's row: √ᾱₜ and √(1 − ᾱₜ) with t falling left to right, the step shown marked */
function drawWeights(ctx, colors, Wp, t) {
  const px = (tt) => Wp.R - (tt / (T - 1)) * (Wp.R - Wp.L), py = (v) => Wp.y1 - v * (Wp.y1 - Wp.y0);
  title(ctx, colors, S.gen.weights, Wp.y0 - 14);
  line(ctx, Wp.L, Wp.y0, Wp.L, Wp.y1 + 0.5, colors.axis); line(ctx, Wp.L, Wp.y1 + 0.5, Wp.R, Wp.y1 + 0.5, colors.axis);
  for (const v of [0, 1]) txt(ctx, colors, String(v), Wp.L - 5, py(v) + 4, { align: "right", fill: colors.ink3 });
  for (const tt of [999, 800, 600, 400, 200, 0]) txt(ctx, colors, String(tt), px(tt), Wp.y1 + 14, { align: "center", fill: colors.ink3 });
  for (const [f, col] of [[sa, colors.groupA], [sn, colors.groupB]]) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let tt = T - 1; tt >= 0; tt -= 3) { const Y = py(f(tt)); tt === T - 1 ? ctx.moveTo(px(tt), Y) : ctx.lineTo(px(tt), Y); }
    ctx.lineTo(px(0), py(f(0))); ctx.stroke(); ctx.restore();
  }
  txt(ctx, colors, S.gen.onEps, px(150), py(sn(150)) - 8, { fill: colors.groupB, halo: true });
  txt(ctx, colors, S.gen.onX0, px(860), py(sa(860)) - 8, { fill: colors.groupA, halo: true });
  if (t >= 0) {
    line(ctx, px(t), Wp.y0 - 4, px(t), Wp.y1, colors.highlight, 1.5);
    for (const [v, col] of [[sa(t), colors.groupA], [sn(t), colors.groupB]]) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(t), py(v), 3.5, 0, 2 * Math.PI); ctx.fill(); ctx.restore(); }
  }
}
/** Generation's and Conditional's top row: xₜ − √(1 − ᾱₜ) × ε̂ = √ᾱₜ × x̂₀ (review call 3), or the result alone */
function drawSubtraction(ctx, colors, Lo, t, xt, eh, x0, k, ke) {
  if (t < 0) {
    img(ctx, xt, k, Lo.xb, Lo.y, Lo.s, colors.highlight);
    txt(ctx, colors, S.gen.result, Lo.xb + Lo.s / 2, Lo.y - 9, { align: "center", fill: colors.ink1, weight: "600" });
    return;
  }
  equationRow(ctx, colors, Lo, [[xt, k, colors.highlight], [eh, ke, colors.groupB], [x0, k, colors.groupA]], ["−", "="], [[f2(sn(t)), colors.groupB], [f2(sa(t)), colors.groupA]]);
  txt(ctx, colors, S.gen.xt(t), Lo.xa + Lo.s / 2, Lo.y - 9, { align: "center", fill: colors.ink1, weight: "600" });
  txt(ctx, colors, S.gen.epsHat, Lo.xb + Lo.s / 2, Lo.y - 9, { align: "center", fill: colors.groupB });
  txt(ctx, colors, S.gen.x0Hat, Lo.xc + Lo.s / 2, Lo.y - 9, { align: "center", fill: colors.groupA });
}

function drawGeneration(ctx, colors, w, Lo, params, anim, pointer) {
  const G = GENERATION, f = frameOf(anim, "generation"), sel = Number(params.sample) - 1, t = G.t[f];
  const xt = unpack(`gx${f}`, G.xt[f]), eh = unpack(`ge${f}`, G.epsHat[f]), x0 = unpack(`g0${f}`, G.x0Hat[f]);
  drawSubtraction(ctx, colors, Lo, t, xt, eh, x0, sel, sel);
  drawWeights(ctx, colors, Lo.weights, t);
  title(ctx, colors, S.gen.all, Lo.grid[0].y - 12);
  for (const R of Lo.grid) img(ctx, xt, R.k, R.x, R.y, R.w, R.k === sel ? colors.highlight : null);
  title(ctx, colors, S.gen.traj, Lo.traj[0].y - 12);
  for (const R of Lo.traj) {
    if (R.fr > f) break;
    img(ctx, unpack(`gx${R.fr}`, G.xt[R.fr]), sel, R.x, R.y, R.w, null);
    txt(ctx, colors, S.gen.frameT(G.t[R.fr]), R.x + R.w / 2, R.y + R.h + 13, { align: "center", fill: colors.ink2 });
    if (G.t[R.fr] >= 0) img(ctx, unpack(`g0${R.fr}`, G.x0Hat[R.fr]), sel, R.x, R.y2, R.w, colors.groupA, 1);
  }
  const hov = Lo.grid.find((R) => inside(pointer, R));
  if (hov) imageCard(ctx, colors, w, pointer, S.card.sample(hov.k + 1), t < 0 ? [[xt, hov.k, S.gen.result, colors.ink2]] : [[xt, hov.k, S.card.xt, colors.ink2], [x0, hov.k, S.card.x0Hat, colors.groupA]]);
}

function drawConditional(ctx, colors, w, Lo, params, anim, pointer) {
  const Cd = CONDITIONAL, f = frameOf(anim, "conditional"), c = Number(params.label), t = Cd.t[f];
  const xt = unpack(`cx${f}`, Cd.xt[f]), x0 = unpack(`c0${f}`, Cd.x0Hat[f]), eh = unpack(`ce${f}`, Cd.epsHat[f]);
  title(ctx, colors, S.cond.top(c), 16);
  /* the first row's sample with this label: xₜ and x̂₀ index the 40 in row order, ε̂ the first row's ten */
  drawSubtraction(ctx, colors, Lo, t, xt, eh, x0, c, c);
  title(ctx, colors, S.cond.grid, Lo.gy - 30);
  for (let d = 0; d < 10; d++) txt(ctx, colors, String(d), PAD + d * (Lo.cs + Lo.gx) + Lo.cs / 2, Lo.gy - 8, { align: "center", fill: d === c ? colors.highlight : colors.ink2, size: colors.fsSm, weight: d === c ? "600" : "" });
  for (const R of Lo.grid) img(ctx, xt, R.r * 10 + R.d, R.x, R.y, R.w, R.r === 0 && R.d === c ? colors.highlight : null, R.r === 0 && R.d === c ? 2 : 1);
  const X = PAD + c * (Lo.cs + Lo.gx);
  ctx.save(); ctx.strokeStyle = colors.highlight; ctx.lineWidth = 1; ctx.strokeRect(X - 4, Lo.gy - 4, Lo.cs + 8, 4 * (Lo.cs + 6) + 2); ctx.restore();
  const hov = Lo.grid.find((R) => inside(pointer, R));
  if (hov) imageCard(ctx, colors, w, pointer, S.card.label(hov.d, hov.r + 1), t < 0 ? [[xt, hov.r * 10 + hov.d, S.gen.result, colors.ink2]] : [[xt, hov.r * 10 + hov.d, S.card.xt, colors.ink2], [x0, hov.r * 10 + hov.d, S.card.x0Hat, colors.groupA]]);
}

function captionOf(params, anim) {
  const page = params.page;
  if (page === "forward") return CAP.forward(Number(params.t));
  if (isTrain(page)) return CAP[page](landedOf(anim, page), anim?.mode === "run" && anim.f < 1 && anim.stage === page);
  if (page === "generation") return CAP.generation(frameOf(anim, "generation"));
  return CAP.conditional(frameOf(anim, "conditional"));
}

/* ------------------------------------------------------------- widget */

const DIGITS = FORWARD.labels.map((d, i) => ({ value: String(i), label: String(d) }));
/* twelve and sixteen buttons truncate in one row of the rail, so each control takes two: core starts a
   row where an option's `group` changes and captions only a truthy one, so undefined then null is two
   uncaptioned rows of one control */
const ITERS = TRAINING.t.map((t, i) => ({ value: String(i + 1), label: String(i + 1), group: i < 6 ? undefined : null }));
const SAMPLES = Array.from({ length: 16 }, (_, i) => ({ value: String(i + 1), label: String(i + 1), group: i < 8 ? undefined : null }));
const LABELS = Array.from({ length: 10 }, (_, d) => ({ value: String(d), label: String(d) }));

defineWidget({
  slug: "diffusion",
  status: "draft",
  title: "Deep Learning - Frontiers: Diffusion Models",
  subtitle: S.subtitle,
  layout: "side",
  height: (p) => layoutOf(p.w ?? 550, p.page ?? "forward").height,
  pointer: true,
  credit: "Data: MNIST (LeCun, Cortes and Burges)",

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, groupHeads: true, default: "forward", display: true },
    digit: { type: "segmented", label: S.digitLabel, detail: S.digitDetail, options: DIGITS, default: "0", display: true, when: ON("forward") },
    t: { type: "int", label: S.tLabel, detail: S.tDetail, min: 0, max: T - 1, default: 0, display: true, when: ON("forward") },
    iter: { type: "segmented", label: S.iterLabel, detail: S.iterDetail, options: ITERS, default: "1", display: true, when: { param: "page", oneOf: TRAIN_PAGES } },
    sample: { type: "segmented", label: S.sampleLabel, detail: S.sampleDetail, options: SAMPLES, default: "1", display: true, when: ON("generation") },
    label: { type: "segmented", label: S.labelLabel, detail: S.labelDetail, options: LABELS, default: "3", display: true, when: ON("conditional") },
    /* authoring escape hatch, first render only: presses already made on the page the link opens */
    shown: { type: "int", min: 0, max: 10, default: 0, hidden: true },
  },

  legend: ({ params }) =>
    params.page === "forward"
      ? [{ token: "group-a", label: S.legend.x0, mark: "line" }, { token: "group-b", label: S.legend.eps, mark: "line" }, { token: "highlight", label: S.legend.now, mark: "line" }]
      : isTrain(params.page)
        ? [{ token: "reference", label: S.legend.target, mark: "line" }, { token: "empirical", label: S.legend.pred, mark: "line" }]
        : [
            { token: "group-b", label: S.legend.genEps, mark: "line" },
            { token: "group-a", label: S.legend.genX0, mark: "line" },
            { token: "highlight", label: params.page === "generation" ? S.legend.chosen : S.legend.chosenLabel(params.label), mark: "line" },
          ],

  /* the forward page's ε, one for every t (call 2): the only randomness the page draws itself */
  compute: ({ rng }) => ({ eps: Float64Array.from({ length: 784 }, () => rng.normal()) }),

  regions: ({ w, params }) => {
    const Lo = layoutOf(w, params.page);
    if (params.page === "forward") return Lo.frames.map((F) => ({ x: F.x, y: F.y, w: F.w, h: F.h, set: { t: F.t }, label: S.fwd.frameT(F.t) }));
    if (params.page === "generation") return Lo.grid.map((R) => ({ x: R.x, y: R.y, w: R.w, h: R.h, set: { sample: String(R.k + 1) }, label: S.card.sample(R.k + 1) }));
    if (params.page === "conditional") return Lo.grid.map((R) => ({ x: R.x, y: R.y, w: R.w, h: R.h, set: { label: String(R.d) }, label: `c = ${R.d}` }));
    return [];
  },

  animation: {
    stepLabel: "Step",
    stepTitle: { param: "page", labels: S.stepTitle, default: S.stepTitle.generation },
    runLabel: { param: "page", labels: { training: "Train", ctraining: "Train", generation: "Generate", conditional: "Generate" }, default: "Generate" },
    runTitle: { param: "page", labels: S.runTitle, default: S.runTitle.generation },

    init: ({ params, fromScratch }) => {
      const page = params.page, anim = { stage: page, n: { training: 0, ctraining: 0, generation: 0, conditional: 0 }, from: 0, f: 1, halt: false };
      if (!fromScratch && page in MAX) anim.n[page] = Math.min(MAX[page], (Number(params.shown) || 0) * STEP[page]);
      anim.inert = page === "forward";
      anim.done = page in MAX && anim.n[page] >= MAX[page];
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.halt) { anim.halt = false; return false; }
      const page = params.page;
      if (!(page in MAX)) return false;
      const n = anim.n[page];
      if (anim.mode === "run") {
        /* Train / Generate: one checkpoint or one stored frame per RUN_MS, from wherever the page is */
        if (anim.f >= 1) { if (n >= MAX[page]) { anim.done = true; return false; } anim.from = n; anim.n[page] = n + 1; anim.f = 0; }
        anim.f = Math.min(1, anim.f + dt / RUN_MS[page]);
        while (anim.f >= 1 && anim.n[page] < MAX[page]) { anim.from = anim.n[page]; anim.n[page]++; anim.f -= 1; }
        anim.f = Math.min(1, anim.f);
      } else {
        if (anim.f >= 1) {
          if (n >= MAX[page]) { anim.done = true; return false; }
          anim.from = n; anim.n[page] = Math.min(MAX[page], n + STEP[page]); anim.f = 0;
        }
        anim.f = Math.min(1, anim.f + dt / PRESS_MS[page]);
      }
      anim.stage = page;
      anim.done = anim.n[page] >= MAX[page] && anim.f >= 1;
      return anim.f < 1 || (anim.mode === "run" && anim.n[page] < MAX[page]);
    },
    rebuild: (anim, { params }) => {
      /* only a page change ends a press in flight (mid-press-page-switch); the digit, t, iteration, sample and label keep it going */
      const page = params.page;
      if (page !== anim.stage && anim.f < 1) { anim.f = 1; anim.halt = true; }
      anim.stage = page;
      anim.inert = page === "forward";
      anim.done = page in MAX && anim.n[page] >= MAX[page] && anim.f >= 1;
    },
  },

  draw({ ctx, colors, w, params, state, anim, pointer }) {
    const page = params.page, Lo = layoutOf(w, page);
    renderCard(page);
    updateMotion(anim, page);
    if (page === "forward") drawForward(ctx, colors, w, Lo, params, state, pointer);
    else if (isTrain(page)) drawTraining(ctx, colors, w, Lo, params, anim, pointer, page);
    else if (page === "generation") drawGeneration(ctx, colors, w, Lo, params, anim, pointer);
    else drawConditional(ctx, colors, w, Lo, params, anim, pointer);
    wrapText(ctx, colors, captionOf(params, anim), PAD, Lo.capTop, w - 2 * PAD, 17);
  },

  readout({ params, anim }) {
    const page = params.page, T_ = S.tile;
    if (page === "forward") {
      const t = Number(params.t);
      return [{ label: T_.t, value: String(t) }, { label: T_.a, value: f3(sa(t)), note: T_.aNote }, { label: T_.b, value: f3(sn(t)), note: T_.bNote }];
    }
    if (isTrain(page)) {
      const landed = landedOf(anim, page), i = Number(params.iter) - 1;
      return [{ label: T_.ck, value: CK_NAME[landed], note: T_.ckNote(page === "ctraining" ? 5 : 3) }, { label: T_.it, value: String(TRAINING.t[i]) }, { label: T_.mse, value: RUNS[page].mse[landed][i].toFixed(4), note: T_.mseNote }];
    }
    const G = page === "generation" ? GENERATION : CONDITIONAL, every = page === "generation" ? GEN_EVERY : COND_EVERY, total = page === "generation" ? 500 : 75;
    const f = frameOf(anim, page), t = G.t[f];
    return [
      { label: T_.step, value: t < 0 ? T_.done : String(f * every), note: T_.stepNote(total) },
      { label: T_.tNow, value: t < 0 ? "0" : String(t) },
      page === "generation" ? { label: S.sampleLabel, value: String(params.sample) } : { label: T_.label, value: String(params.label) },
    ];
  },

  summary({ params, anim }) {
    const page = params.page;
    if (page === "forward") { const t = Number(params.t); return `Forward process at t = ${t}: xₜ = ${f3(sa(t))} x₀ + ${f3(sn(t))} ε.`; }
    if (isTrain(page)) { const ck = posOf(anim, page); return `${page === "ctraining" ? "Conditional training" : "Training"}, ${CK_NAME[ck]}: the prediction's error on iteration ${params.iter} is ${RUNS[page].mse[ck][Number(params.iter) - 1].toFixed(4)}.`; }
    const G = page === "generation" ? GENERATION : CONDITIONAL, f = frameOf(anim, page);
    return `${page === "generation" ? "Generation" : `Conditional generation, label ${params.label}`}: ${G.t[f] < 0 ? "finished" : `t = ${G.t[f]}`}.`;
  },
});
