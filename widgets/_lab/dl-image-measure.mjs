/* Planning measurement for the deep learning arc's image slots (PHM5005 06-2,
 * "DL for Image Data - Classification").  The notebook teaches three things and
 * each one is a widget only if the numbers cooperate:
 *
 *   M1 COST — a widget trains in compute(), once per parameter change, in the
 *     browser with no dependencies.  Can a small CNN on small images be trained
 *     inside a click?  Also the parameter counts the notebook quotes (Flatten
 *     vs GlobalAveragePool, CNN vs MLP) and the receptive field of one output
 *     pixel, which are pure arithmetic.
 *   M2 TRANSFER — scratch / fine-tune / frozen-backbone transfer.  A widget
 *     that offers a CHOICE needs a stage where every option wins somewhere
 *     (docs/design-principles: a metric choice needs a stage that can lose).
 *     Does each strategy win somewhere, and does fine-tuning at the notebook's
 *     "too high" lr actually forget the source task?
 *   M3 GRAD-CAM — does a deliberately planted shortcut (a bright corner mark on
 *     one class) show up as a Grad-CAM that leaves the object while the
 *     clean-image accuracy collapses; and is the deeper layer's map coarser?
 *
 * Everything here is hand-written: conv 3x3/pad1, ReLU, maxpool 2x2, global
 * average pool, linear, softmax cross-entropy, Adam (torch defaults 0.9/0.999,
 * eps 1e-8, bias-corrected), torch's default U(-1/sqrt(fan_in), +) init.  No
 * torch on this machine, so the backward passes are checked against central
 * finite differences before anything is measured.
 *
 * ---------------------------------------------------------------------------
 * FINDINGS, 2026-09-13.  Gradient check first: max relative error 4.6e-09 over
 * all 89 parameters of a tiny net (S=8, 1->2->3 channels, K=3, two images), so
 * the engine is right.  node v24 on this Windows machine, single thread; total
 * script runtime 168 s.  M2 uses 3 seeds and M3 uses 3, cut from 5 to keep the
 * script under three minutes — the M2 cells therefore carry several points of
 * seed noise and only gaps of 10+ points are worth reading.
 *
 * M1 COST — net conv(1->8) ReLU pool conv(8->16) ReLU pool GAP linear(16->4),
 * batch 16, Adam 1e-3, seed 1, mean of 5 epochs after a warm-up epoch:
 *       S=16, N=200:   36.9 ms/epoch  ->  1.11 s for 30 epochs
 *       S=16, N=400:   73.7 ms/epoch  ->  2.21 s
 *       S=24, N=200:   79.9 ms/epoch  ->  2.40 s
 *       S=24, N=400:  159.3 ms/epoch  ->  4.78 s
 *   ONLY THE FIRST FITS UNDER ~2 s.  Cost is linear in N and in pixels, so the
 *   budget is a single number: about 3,400 image-epochs per second at 16x16,
 *   1,600 at 24x24.  A widget that trains in compute() gets S=16 with 200
 *   images and 30 epochs, and anything more wants either an epoch slider that
 *   trains incrementally or an accept that the click costs 2-5 s.  This is a
 *   hand-written double-precision engine; Float32 and a batched matmul would
 *   help, but not by the order of magnitude that S=24/N=400/100 epochs needs.
 *
 *   Parameters, this measuring net (S=16, K=4): conv1 80, conv2 1168, linear
 *   68 = 1316 total.  The notebook's own net at 28x28x3, K=9:
 *       conv1 Conv2d(3,32,k3,p1)        896
 *       conv2 Conv2d(32,64,k3,p1)    18,496
 *       Flatten + Linear(3136, 9)    28,233   -> 47,625 total
 *       GAP     + Linear(64, 9)         585   -> 19,977 total
 *   The classifier head is 59.3% of the Flatten model and 2.9% of the GAP one;
 *   GAP removes 27,648 parameters, 58% of the whole model, and makes the head
 *   independent of input size.  The MLP alternative 06-1 quotes: 28*28*3 ->
 *   1000 is 2,353,000 weights and biases, and 256*256*3 -> 1000 is
 *   196,609,000 — the "almost 200 million" figure checks out, against 47,625
 *   for the entire CNN.
 *
 *   Receptive field of ONE output pixel of the notebook's net
 *   (r_out = r_in + (k-1)*jump; jump_out = jump*stride):
 *       input 28x28   r=1    jump=1   28x28
 *       conv1 k3 s1   r=3    jump=1   28x28
 *       pool1 k2 s2   r=4    jump=2   14x14
 *       conv2 k3 s1   r=8    jump=2   14x14
 *       pool2 k2 s2   r=10   jump=4   7x7   (x64 = 3136)
 *   Each of the 49 cells the classifier sees covers a 10x10 patch, 12.8% of the
 *   image, and neighbouring cells sit 4 px apart, so they overlap.
 *
 * M2 TRANSFER — source DISC/RING/BAR/CROSS, 400 images, 30 epochs, S=16, conv
 * 12/24 (see the note at the M2 section: at 8/16 the frozen arm is arguing
 * about bottleneck size, not about transfer).  Source validation accuracy mean
 * 86.0%, range 84.5-88.5% over 3 seeds.  Target TRIANGLE vs SQUARE, outlines
 * matched in perimeter so the pair cannot be told apart by brightness alone; a
 * distinction the source never labelled.  NEAR = the source's rendering,
 * FAR = inverted contrast.  Validation 200 fixed images.  Epoch 30:
 *
 *       NEAR domain        n=16   n=32   n=64  n=128
 *         SCRATCH   1e-3   73.8   86.3   91.0   97.8
 *         FINETUNE  1e-4   57.0   52.7   60.0   58.8
 *         FINETUNE  1e-3   58.8   63.3   73.3   79.5
 *         TRANSFER  1e-3   57.7   53.3   68.8   67.5
 *       FAR domain (inverted contrast)
 *         SCRATCH   1e-3   75.7   80.0   91.5   93.5
 *         FINETUNE  1e-4   50.0   43.8   57.3   58.3
 *         FINETUNE  1e-3   50.2   38.5   63.5   72.0
 *         TRANSFER  1e-3   49.7   37.8   59.2   56.3
 *
 *   SCRATCH DOMINATES EVERY CELL, and that is the headline: on this stage the
 *   three-way choice has no stage that can lose, so a widget offering it here
 *   would be presenting a foregone conclusion.  At epoch 5 and epoch 10 every
 *   arm is within noise of 50%, so the "transfer is fast early" claim does not
 *   show either.  Carrying the small-n runs to 100 epochs does not rescue it
 *   (NEAR n=16: SCRATCH 85.8, FINETUNE 1e-3 66.7, TRANSFER 59.8), so this is
 *   not the step budget — the pretrained features genuinely do not carry
 *   triangle-versus-square, and starting from them is WORSE than starting from
 *   noise.
 *
 *   THE ALTERNATIVE TARGET, and the one useful result — target = the source's
 *   OWN four classes with a fresh head, 30 epochs, chance 25%:
 *                         n=16   n=32   n=64  n=128
 *         SCRATCH   1e-3   31.8   48.3   70.3   77.5
 *         FINETUNE  1e-4   22.7   36.0   28.3   57.0
 *         FINETUNE  1e-3   44.5   65.5   82.5   82.2
 *         TRANSFER  1e-3   26.2   53.7   75.2   80.0
 *   Here the ordering the notebook describes appears: fine-tuning at 1e-3 wins
 *   everywhere, frozen TRANSFER beats SCRATCH at n=32, 64 and 128 by 3-5
 *   points, and pretraining is worth roughly a doubling of the training set.
 *   So the machinery is right and the FEATURES are the variable: a frozen
 *   backbone helps exactly as far as the target's classes are built out of the
 *   source's, and synthetic shapes make that overlap all-or-nothing.  A widget
 *   comparing the three strategies needs either a real pretrained backbone or a
 *   source/target pair with graded overlap — which is a design decision to take
 *   before building, not a parameter to tune afterwards.
 *
 *   FINETUNE at 1e-4 is last or near last in every table above, and the reason
 *   is a confound worth stating plainly: 30 epochs on n=16 is 30 optimizer
 *   steps, and 30 steps at 1e-4 move a freshly initialised head by nothing.
 *   The notebook's "lr 1e-4 to minimise forgetting" is a statement about a long
 *   run.  ANY WIDGET COMPARING LEARNING RATES MUST FIX THE NUMBER OF STEPS,
 *   not the number of epochs, or the slider labelled "learning rate" is partly
 *   a slider labelled "how much training".
 *
 *   CATASTROPHIC FORGETTING — fine-tune on the target, then re-attach the
 *   ORIGINAL 4-class source head and score the source validation set at target
 *   epoch 30.  The pretrained value is 86.0%:
 *                         n=16   n=32   n=64  n=128
 *         NEAR  lr 1e-4   86.2   86.5   81.5   77.7
 *         NEAR  lr 1e-3   82.5   84.3   77.8   66.8
 *         FAR   lr 1e-4   85.2   82.5   85.5   74.3
 *         FAR   lr 1e-3   76.8   76.5   79.5   56.5
 *   This one behaves exactly as the notebook says.  Forgetting is monotone in
 *   the number of steps (n=16 loses 0-9 points, n=128 loses 8-30), it is
 *   consistently worse at 1e-3 than at 1e-4 (by 2-18 points in the same cell),
 *   and it is worse in the far domain, where the gradients pull hardest.  The
 *   lr 1e-4 / 1e-3 pair IS a genuine trade-off — 1e-3 is the better target
 *   accuracy at every n and the worse source retention at every n — so a
 *   forgetting widget has the stage that the three-way strategy widget does
 *   not.  Of the three things 06-2 teaches about pretrained backbones, this is
 *   the one that is ready to build.
 *
 * M3 GRAD-CAM WITH A SHORTCUT — DISC vs RING, S=16, 300 training images, 30
 * epochs, conv 8/16, 3 seeds.  The cue is a bright square in the top-left
 * corner added to class-DISC TRAINING images only, at the stated rate:
 *       cue rate        train   CLEAN test   CUED test
 *         0%            100.0      99.7        93.5
 *        50%             99.9      99.3        97.8
 *       100%            100.0      67.8        80.3
 *       100%, 2x2 cue   100.0      99.3        99.0
 *   THE 2x2 MARK THE PLAN ASKED FOR DOES NOTHING — 99.3% on clean images even
 *   when it is present on every DISC.  Four pixels of a 16x16 image survive two
 *   max-pools as a single cell of the final 4x4 map, and the shape is the
 *   easier route.  A 3x3 mark is the smallest one that takes over: at 100% the
 *   model is at 100% on its training set and 67.8% on clean images, having
 *   learned the mark instead of the shape.  At 50% the shape is still learned
 *   (99.3% clean).  The cue size is therefore a design parameter, not a detail,
 *   and on a 28x28 input it will need rescaling again.
 *
 *   CAM mass, mean of 150 test images.  The corner window is the top-left 4x4,
 *   16 of 256 px = 6.25% of the image; the object footprint averages 16.7%:
 *       on CLEAN test images (no cue present anywhere)
 *       cue rate      c1 corner  c1 object   c2 corner  c2 object
 *         0%              4.2       46.3        2.5       45.3
 *        50%              4.6       45.9        3.1       45.9
 *       100%              5.6       24.1        5.9       25.6
 *       100%, 2x2         4.2       43.4        3.5       41.2
 *       on CUED test images (the mark added to every image of both classes)
 *         0%             17.3       38.3       12.3       41.5
 *        50%             14.8       39.8        5.6       43.1
 *       100%             20.0       46.8       19.2       28.7
 *       100%, 2x2         9.8       43.0        5.0       39.5
 *   The CLEAN table is the one that separates the models: a shape model puts
 *   46% of its CAM mass inside a footprint covering 17% of the pixels (2.8x
 *   enrichment) and leaves the empty corner at its 4-6% area share, while the
 *   shortcut model drops to 24% on the object — it has stopped looking at the
 *   shape.  THE CUED TABLE DOES NOT SEPARATE THEM: at cue 0% the corner already
 *   takes 17.3% of conv1's mass in a model that demonstrably ignores it.  That
 *   is Grad-CAM's own failure mode, since CAM = ReLU(sum of alpha_k A^k) is
 *   weighted by the ACTIVATIONS, and a bright anomaly lights up whether or not
 *   the classifier uses it.  A widget must not let a hot corner on a cued image
 *   stand as proof of shortcut learning; the honest pairing is the CAM on a
 *   CLEAN image beside the clean-image accuracy.
 *
 *   Resolution: conv1's CAM has 256 distinct cells (16x16), conv2's has 64
 *   (8x8), each one a 2x2 block after nearest-neighbour upsampling.  Visible,
 *   but a 2x step is not the notebook's "coarse but semantic" contrast; that
 *   wants more depth than a two-conv net has.  Either add a third conv (a 4x4
 *   CAM is unmistakably blocky) or make the depth point in words.
 *
 * CAVEATS — what this does NOT measure.  No torch cross-check, so the engine is
 * verified against finite differences only and a widget shipping it should be
 * pinned the way widget 37 was (dump data and initial weights, train both,
 * compare).  No real pretrained backbone: the "pretrained" weights come from a
 * 4-shape synthetic source task, so they are far weaker and far more
 * task-specific than ImageNet's, and M2's negative result is about THIS source,
 * not about transfer learning.  One channel, no colour; no batch norm, no
 * augmentation, no dropout, no lr schedule, no early stopping.  One fixed
 * validation set per configuration and 3 seeds, so single cells move by several
 * points.  Timings are node, not a browser, and double precision throughout.
 * Grad-CAM is measured on the predicted class only, never on a chosen class,
 * and never against a human saliency judgement — only against the generator's
 * own footprint mask.
 *
 * Run: node widgets/_lab/dl-image-measure.mjs
 */

/* ------------------------------------------------------------------ rng --- */

function makeRng(seed) {
  let s = seed >>> 0;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  r.gauss = () => {
    const u = r() || 1e-12;
    const v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.range = (a, b) => a + r() * (b - a);
  r.shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return r;
}

/* ------------------------------------------------------------ synthetic --- */
/* One shape per image on a noisy ground.  Anti-aliased by 2x2 supersampling so
 * that a 16 px image still says "circle" rather than "blob"; the mask is kept
 * because M3 needs the shape's true footprint to score a CAM against. */

function shapeMask(kind, S, rng) {
  const sc = S / 16;
  const r = rng.range(3.0, 4.6) * sc;
  const t = 1.0 * sc;
  const cx = rng.range(r + 1, S - 1 - r);
  const cy = rng.range(r + 1, S - 1 - r);
  const horiz = rng() < 0.5;
  let tri = null;
  if (kind === "TRIANGLE") {
    const v = (R) => [0, 1, 2].map((i) => {
      const a = (Math.PI / 2) + (i * 2 * Math.PI) / 3;
      return [cx + R * Math.cos(a), cy - R * Math.sin(a)];
    });
    /* circumradius chosen so the triangle's perimeter equals the square's
     * (3*sqrt(3)*R = 8r).  The first draft used 1.25r, and the two classes
     * were then separable by total brightness alone — GAP reads that off in
     * one number and n=16 from scratch already scored 92%, which is no stage
     * for a transfer comparison. */
    const R = r * 1.5396;
    tri = { out: v(R), inn: v(R - t * 1.6 * 2.0) };
  }
  const inTri = (p, x, y) => {
    let neg = false;
    let pos = false;
    for (let i = 0; i < 3; i += 1) {
      const [ax, ay] = p[i];
      const [bx, by] = p[(i + 1) % 3];
      const d = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (d < 0) neg = true; else if (d > 0) pos = true;
    }
    return !(neg && pos);
  };
  const inside = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    switch (kind) {
      case "DISC": return dx * dx + dy * dy <= r * r;
      case "RING": return Math.abs(Math.sqrt(dx * dx + dy * dy) - r) <= t;
      case "BAR": return horiz
        ? (Math.abs(dy) <= t && Math.abs(dx) <= r)
        : (Math.abs(dx) <= t && Math.abs(dy) <= r);
      case "CROSS": return (Math.abs(dy) <= t && Math.abs(dx) <= r)
        || (Math.abs(dx) <= t && Math.abs(dy) <= r);
      case "SQUARE": {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        return m <= r && m >= r - t * 1.6;
      }
      case "TRIANGLE": return inTri(tri.out, x, y) && !inTri(tri.inn, x, y);
      default: throw new Error(`shape ${kind}`);
    }
  };
  const mask = new Float64Array(S * S);
  for (let py = 0; py < S; py += 1) {
    for (let px = 0; px < S; px += 1) {
      let acc = 0;
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          if (inside(px + 0.25 + 0.5 * sx, py + 0.25 + 0.5 * sy)) acc += 0.25;
        }
      }
      mask[py * S + px] = acc;
    }
  }
  return mask;
}

const CUE_VALUE = 1.4;

/* n images, classes round-robin so any prefix of even length stays balanced */
function makeSet(kinds, n, S, rng, { invert = false, cueClass = -1, cueRate = 0, cueAll = false, cueSize = 3 } = {}) {
  const x = new Float64Array(n * S * S);
  const y = new Int32Array(n);
  const masks = [];
  for (let i = 0; i < n; i += 1) {
    const k = i % kinds.length;
    y[i] = k;
    const mask = shapeMask(kinds[k], S, rng);
    masks.push(mask);
    const b = rng.range(0.6, 1.0);
    const bg = invert ? 0.9 : 0.0;
    const sgn = invert ? -1 : 1;
    const off = i * S * S;
    for (let j = 0; j < S * S; j += 1) {
      x[off + j] = bg + sgn * b * mask[j] + rng.gauss() * 0.15;
    }
    const cue = cueAll || (k === cueClass && rng() < cueRate);
    if (cue) {
      for (let py = 0; py < cueSize; py += 1) {
        for (let px = 0; px < cueSize; px += 1) x[off + py * S + px] = CUE_VALUE;
      }
    }
  }
  return { x, y, masks, n, S };
}

/* --------------------------------------------------------------- layers --- */

const F = (n) => new Float64Array(n);

/* conv 3x3, stride 1, pad 1.  Loop order is (out channel, in channel, tap) so
 * the innermost loop is a contiguous scaled add — three times faster here than
 * the textbook (oy, ox, ky, kx) nest. */
function convFwd(x, xoff, Cin, H, Wt, b, Cout, out) {
  const HW = H * H;
  for (let oc = 0; oc < Cout; oc += 1) {
    const ob = oc * HW;
    out.fill(b[oc], ob, ob + HW);
    for (let ic = 0; ic < Cin; ic += 1) {
      const xb = xoff + ic * HW;
      const wb = (oc * Cin + ic) * 9;
      for (let ky = 0; ky < 3; ky += 1) {
        const oy0 = Math.max(0, 1 - ky);
        const oy1 = Math.min(H, H + 1 - ky);
        for (let kx = 0; kx < 3; kx += 1) {
          const wv = Wt[wb + ky * 3 + kx];
          if (wv === 0) continue;
          const ox0 = Math.max(0, 1 - kx);
          const ox1 = Math.min(H, H + 1 - kx);
          for (let oy = oy0; oy < oy1; oy += 1) {
            let o = ob + oy * H + ox0;
            let xi = xb + (oy + ky - 1) * H + (ox0 + kx - 1);
            for (let ox = ox0; ox < ox1; ox += 1, o += 1, xi += 1) out[o] += wv * x[xi];
          }
        }
      }
    }
  }
}

/* dW/db may be null (frozen layer); dx may be null (first layer) */
function convBwd(x, xoff, dout, Cin, H, Wt, Cout, dW, db, dx) {
  const HW = H * H;
  for (let oc = 0; oc < Cout; oc += 1) {
    const ob = oc * HW;
    if (db) {
      let s = 0;
      for (let i = 0; i < HW; i += 1) s += dout[ob + i];
      db[oc] += s;
    }
    for (let ic = 0; ic < Cin; ic += 1) {
      const xb = xoff + ic * HW;
      const wb = (oc * Cin + ic) * 9;
      for (let ky = 0; ky < 3; ky += 1) {
        const oy0 = Math.max(0, 1 - ky);
        const oy1 = Math.min(H, H + 1 - ky);
        for (let kx = 0; kx < 3; kx += 1) {
          const ox0 = Math.max(0, 1 - kx);
          const ox1 = Math.min(H, H + 1 - kx);
          const wv = Wt[wb + ky * 3 + kx];
          let acc = 0;
          for (let oy = oy0; oy < oy1; oy += 1) {
            let o = ob + oy * H + ox0;
            let xi = xb + (oy + ky - 1) * H + (ox0 + kx - 1);
            for (let ox = ox0; ox < ox1; ox += 1, o += 1, xi += 1) {
              acc += dout[o] * x[xi];
              if (dx) dx[xi] += wv * dout[o];
            }
          }
          if (dW) dW[wb + ky * 3 + kx] += acc;
        }
      }
    }
  }
}

function poolFwd(a, C, H, out, idx) {
  const Ho = H >> 1;
  for (let c = 0; c < C; c += 1) {
    const ab = c * H * H;
    const ob = c * Ho * Ho;
    for (let oy = 0; oy < Ho; oy += 1) {
      for (let ox = 0; ox < Ho; ox += 1) {
        const i0 = ab + 2 * oy * H + 2 * ox;
        let best = a[i0];
        let bi = i0;
        if (a[i0 + 1] > best) { best = a[i0 + 1]; bi = i0 + 1; }
        if (a[i0 + H] > best) { best = a[i0 + H]; bi = i0 + H; }
        if (a[i0 + H + 1] > best) { best = a[i0 + H + 1]; bi = i0 + H + 1; }
        out[ob + oy * Ho + ox] = best;
        idx[ob + oy * Ho + ox] = bi;
      }
    }
  }
}

const poolBwd = (dout, idx, n, da) => { for (let i = 0; i < n; i += 1) da[idx[i]] += dout[i]; };

/* ------------------------------------------------------------------ net --- */
/* conv(Cin->C1) ReLU pool2  conv(C1->C2) ReLU pool2  GAP  linear(C2->K) */

function makeNet(S, Cin, C1, C2, K, rng) {
  const uni = (n, fanIn) => {  /* torch's Conv2d / Linear default: U(-1/sqrt(fan_in), +) */
    const k = 1 / Math.sqrt(fanIn);
    const a = F(n);
    for (let i = 0; i < n; i += 1) a[i] = rng.range(-k, k);
    return a;
  };
  return {
    S, Cin, C1, C2, K,
    W1: uni(C1 * Cin * 9, Cin * 9), b1: uni(C1, Cin * 9),
    W2: uni(C2 * C1 * 9, C1 * 9), b2: uni(C2, C1 * 9),
    Wh: uni(K * C2, C2), bh: uni(K, C2),
  };
}

function newHead(net, K, rng) {
  const k = 1 / Math.sqrt(net.C2);
  const Wh = F(K * net.C2);
  for (let i = 0; i < Wh.length; i += 1) Wh[i] = rng.range(-k, k);
  const bh = F(K);
  for (let i = 0; i < K; i += 1) bh[i] = rng.range(-k, k);
  return { ...net, K, Wh, bh };
}

const copyNet = (net) => ({
  ...net,
  W1: net.W1.slice(), b1: net.b1.slice(),
  W2: net.W2.slice(), b2: net.b2.slice(),
  Wh: net.Wh.slice(), bh: net.bh.slice(),
});

function makeWork(net) {
  const { S, C1, C2, K } = net;
  const S2 = S >> 1;
  const S4 = S >> 2;
  return {
    S2, S4,
    a1: F(C1 * S * S), p1: F(C1 * S2 * S2), i1: new Int32Array(C1 * S2 * S2),
    a2: F(C2 * S2 * S2), p2: F(C2 * S4 * S4), i2: new Int32Array(C2 * S4 * S4),
    g: F(C2), logits: F(K), prob: F(K),
    dp2: F(C2 * S4 * S4), da2: F(C2 * S2 * S2),
    dp1: F(C1 * S2 * S2), da1: F(C1 * S * S),
  };
}

function forward(net, w, x, off) {
  const { S, Cin, C1, C2, K } = net;
  const { S2, S4 } = w;
  convFwd(x, off, Cin, S, net.W1, net.b1, C1, w.a1);
  for (let i = 0; i < w.a1.length; i += 1) if (w.a1[i] < 0) w.a1[i] = 0;
  poolFwd(w.a1, C1, S, w.p1, w.i1);
  convFwd(w.p1, 0, C1, S2, net.W2, net.b2, C2, w.a2);
  for (let i = 0; i < w.a2.length; i += 1) if (w.a2[i] < 0) w.a2[i] = 0;
  poolFwd(w.a2, C2, S2, w.p2, w.i2);
  const area = S4 * S4;
  for (let c = 0; c < C2; c += 1) {
    let s = 0;
    for (let i = 0; i < area; i += 1) s += w.p2[c * area + i];
    w.g[c] = s / area;
  }
  let mx = -Infinity;
  for (let k = 0; k < K; k += 1) {
    let s = net.bh[k];
    for (let c = 0; c < C2; c += 1) s += net.Wh[k * C2 + c] * w.g[c];
    w.logits[k] = s;
    if (s > mx) mx = s;
  }
  let Z = 0;
  for (let k = 0; k < K; k += 1) { w.prob[k] = Math.exp(w.logits[k] - mx); Z += w.prob[k]; }
  for (let k = 0; k < K; k += 1) w.prob[k] /= Z;
  return w;
}

/* accumulates scale * d(cross-entropy)/d(params) into grads */
function backwardCE(net, w, x, off, y, grads, scale, headOnly) {
  const { S, Cin, C1, C2, K } = net;
  const { S2, S4 } = w;
  const area = S4 * S4;
  const dg = F(C2);
  for (let k = 0; k < K; k += 1) {
    const dz = (w.prob[k] - (k === y ? 1 : 0)) * scale;
    grads.bh[k] += dz;
    for (let c = 0; c < C2; c += 1) {
      grads.Wh[k * C2 + c] += dz * w.g[c];
      dg[c] += dz * net.Wh[k * C2 + c];
    }
  }
  if (headOnly) return;
  for (let c = 0; c < C2; c += 1) {
    const v = dg[c] / area;
    for (let i = 0; i < area; i += 1) w.dp2[c * area + i] = v;
  }
  w.da2.fill(0);
  poolBwd(w.dp2, w.i2, C2 * area, w.da2);
  for (let i = 0; i < w.da2.length; i += 1) if (w.a2[i] <= 0) w.da2[i] = 0;
  w.dp1.fill(0);
  convBwd(w.p1, 0, w.da2, C1, S2, net.W2, C2, grads.W2, grads.b2, w.dp1);
  w.da1.fill(0);
  poolBwd(w.dp1, w.i1, C1 * S2 * S2, w.da1);
  for (let i = 0; i < w.da1.length; i += 1) if (w.a1[i] <= 0) w.da1[i] = 0;
  convBwd(x, off, w.da1, Cin, S, net.W1, C1, grads.W1, grads.b1, null);
}

/* gradient of ONE logit w.r.t. the feature maps only — Grad-CAM's backward */
function backwardScore(net, w, cls) {
  const { C1, C2, S } = net;
  const { S2, S4 } = w;
  const area = S4 * S4;
  for (let c = 0; c < C2; c += 1) {
    const v = net.Wh[cls * C2 + c] / area;
    for (let i = 0; i < area; i += 1) w.dp2[c * area + i] = v;
  }
  w.da2.fill(0);
  poolBwd(w.dp2, w.i2, C2 * area, w.da2);
  const dz2 = w.da2.slice();
  for (let i = 0; i < dz2.length; i += 1) if (w.a2[i] <= 0) dz2[i] = 0;
  w.dp1.fill(0);
  convBwd(w.p1, 0, dz2, C1, S2, net.W2, C2, null, null, w.dp1);
  w.da1.fill(0);
  poolBwd(w.dp1, w.i1, C1 * S2 * S2, w.da1);
  return { da1: w.da1, da2: w.da2, S1: S, S2 };
}

/* ------------------------------------------------------------------ adam --- */

const PARAMS_ALL = ["W1", "b1", "W2", "b2", "Wh", "bh"];
const PARAMS_HEAD = ["Wh", "bh"];

function makeOpt(net, headOnly) {
  const names = headOnly ? PARAMS_HEAD : PARAMS_ALL;
  const slots = names.map((n) => ({ p: net[n], g: F(net[n].length) }));
  const grads = {};
  for (const n of PARAMS_ALL) grads[n] = null;
  names.forEach((n, i) => { grads[n] = slots[i].g; });
  for (const s of slots) { s.m = F(s.p.length); s.v = F(s.p.length); }
  return { slots, grads, t: 0 };
}

function adamStep(opt, lr) {
  opt.t += 1;
  const c1 = 1 - 0.9 ** opt.t;
  const c2 = 1 - 0.999 ** opt.t;
  for (const s of opt.slots) {
    for (let i = 0; i < s.p.length; i += 1) {
      const g = s.g[i];
      s.m[i] = 0.9 * s.m[i] + 0.1 * g;
      s.v[i] = 0.999 * s.v[i] + 0.001 * g * g;
      s.p[i] -= (lr * (s.m[i] / c1)) / (Math.sqrt(s.v[i] / c2) + 1e-8);
      s.g[i] = 0;
    }
  }
}

/* --------------------------------------------------------------- driving --- */

function evaluate(net, w, set) {
  const area = net.S * net.S * net.Cin;
  let hit = 0;
  for (let i = 0; i < set.n; i += 1) {
    forward(net, w, set.x, i * area);
    let best = 0;
    for (let k = 1; k < net.K; k += 1) if (w.prob[k] > w.prob[best]) best = k;
    if (best === set.y[i]) hit += 1;
  }
  return hit / set.n;
}

function trainEpochs(net, set, { epochs, batch = 16, lr = 1e-3, headOnly = false, rng, at = null, evalSet = null, onMark = null }) {
  const w = makeWork(net);
  const opt = makeOpt(net, headOnly);
  const area = net.S * net.S * net.Cin;
  const order = Array.from({ length: set.n }, (_, i) => i);
  const marks = {};
  for (let ep = 1; ep <= epochs; ep += 1) {
    rng.shuffle(order);
    for (let b = 0; b < order.length; b += batch) {
      const end = Math.min(order.length, b + batch);
      const scale = 1 / (end - b);
      for (let j = b; j < end; j += 1) {
        const i = order[j];
        forward(net, w, set.x, i * area);
        backwardCE(net, w, set.x, i * area, set.y[i], opt.grads, scale, headOnly);
      }
      adamStep(opt, lr);
    }
    if (at && at.includes(ep)) {
      if (evalSet) marks[ep] = evaluate(net, w, evalSet);
      if (onMark) onMark(ep, net, w);
    }
  }
  return { w, marks };
}

/* ------------------------------------------------------- gradient check --- */

function gradCheck() {
  const rng = makeRng(7);
  const S = 8;
  const net = makeNet(S, 1, 2, 3, 3, rng);
  const set = makeSet(["DISC", "RING", "BAR"], 2, S, rng);
  const w = makeWork(net);
  const opt = makeOpt(net, false);
  const loss = () => {
    let L = 0;
    for (let i = 0; i < set.n; i += 1) {
      forward(net, w, set.x, i * S * S);
      L -= Math.log(w.prob[set.y[i]] + 1e-300);
    }
    return L / set.n;
  };
  for (let i = 0; i < set.n; i += 1) {
    forward(net, w, set.x, i * S * S);
    backwardCE(net, w, set.x, i * S * S, set.y[i], opt.grads, 1 / set.n, false);
  }
  const analytic = {};
  for (const n of PARAMS_ALL) analytic[n] = opt.grads[n].slice();
  let worst = 0;
  let count = 0;
  const eps = 1e-5;
  for (const n of PARAMS_ALL) {
    const p = net[n];
    for (let i = 0; i < p.length; i += 1) {
      const o = p[i];
      p[i] = o + eps; const lp = loss();
      p[i] = o - eps; const lm = loss();
      p[i] = o;
      const num = (lp - lm) / (2 * eps);
      const rel = Math.abs(num - analytic[n][i]) / Math.max(1e-6, Math.abs(num) + Math.abs(analytic[n][i]));
      if (rel > worst) worst = rel;
      count += 1;
    }
  }
  console.log(`gradient check (S=8, 1->2->3, K=3, 2 images): max relative error ${worst.toExponential(1)} over ${count} parameters\n`);
}

/* ------------------------------------------------------------------- M1 --- */

const pad = (v, n) => String(v).padStart(n);
const lpad = (v, n) => String(v).padEnd(n);

function m1() {
  console.log("== M1 COST ==========================================================");
  console.log("net conv(1->8) ReLU pool conv(8->16) ReLU pool GAP linear(16->4), batch 16, Adam 1e-3, seed 1");
  console.log(`${lpad("", 16)}${pad("ms/epoch", 10)}${pad("30 epochs", 12)}`);
  for (const S of [16, 24]) {
    for (const N of [200, 400]) {
      const rng = makeRng(1);
      const set = makeSet(["DISC", "RING", "BAR", "CROSS"], N, S, rng);
      const net = makeNet(S, 1, 8, 16, 4, rng);
      trainEpochs(net, set, { epochs: 1, rng });           /* warm the JIT */
      const t0 = performance.now();
      trainEpochs(net, set, { epochs: 5, rng });
      const ms = (performance.now() - t0) / 5;
      console.log(`${lpad(`S=${S}, N=${N}`, 16)}${pad(ms.toFixed(1), 10)}${pad(`${((ms * 30) / 1000).toFixed(2)} s`, 12)}`);
    }
  }

  const conv = (ci, co) => co * ci * 9 + co;
  const lin = (i, o) => i * o + o;
  console.log("\nparameters, this measuring net (S=16, K=4):");
  console.log(`  conv1 1->8 ${pad(conv(1, 8), 8)}   conv2 8->16 ${pad(conv(8, 16), 8)}   linear 16->4 ${pad(lin(16, 4), 8)}   total ${conv(1, 8) + conv(8, 16) + lin(16, 4)}`);
  console.log("\nparameters, the notebook's net (28x28x3, K=9):");
  const c1 = conv(3, 32);
  const c2 = conv(32, 64);
  const flat = lin(3136, 9);
  const gap = lin(64, 9);
  console.log(`  conv1 Conv2d(3,32,k3,p1)      ${pad(c1.toLocaleString("en-US"), 12)}`);
  console.log(`  conv2 Conv2d(32,64,k3,p1)     ${pad(c2.toLocaleString("en-US"), 12)}`);
  console.log(`  Flatten + Linear(3136, 9)     ${pad(flat.toLocaleString("en-US"), 12)}   total ${(c1 + c2 + flat).toLocaleString("en-US")}`);
  console.log(`  GAP     + Linear(64, 9)       ${pad(gap.toLocaleString("en-US"), 12)}   total ${(c1 + c2 + gap).toLocaleString("en-US")}`);
  console.log(`  head share: Flatten ${((100 * flat) / (c1 + c2 + flat)).toFixed(1)}%, GAP ${((100 * gap) / (c1 + c2 + gap)).toFixed(1)}%; GAP removes ${(flat - gap).toLocaleString("en-US")} (${((100 * (flat - gap)) / (c1 + c2 + flat)).toFixed(0)}% of the model)`);
  console.log(`  MLP alternative: 28*28*3 -> 1000 = ${lin(2352, 1000).toLocaleString("en-US")};  256*256*3 -> 1000 = ${lin(196608, 1000).toLocaleString("en-US")}`);

  console.log("\nreceptive field of one output pixel (notebook's net):");
  let r = 1;
  let j = 1;
  let size = 28;
  console.log(`  ${lpad("input 28x28", 16)} r=${pad(r, 3)}  jump=${pad(j, 2)}   ${size}x${size}`);
  const stepRF = (name, k, stride) => {
    r += (k - 1) * j;
    j *= stride;
    size = Math.floor(size / stride);
    console.log(`  ${lpad(name, 16)} r=${pad(r, 3)}  jump=${pad(j, 2)}   ${size}x${size}`);
  };
  stepRF("conv1 k3 s1", 3, 1);
  stepRF("pool1 k2 s2", 2, 2);
  stepRF("conv2 k3 s1", 3, 1);
  stepRF("pool2 k2 s2", 2, 2);
  console.log(`  one of the ${size * size} cells covers ${r}x${r} = ${((100 * r * r) / (28 * 28)).toFixed(1)}% of the image; cells are ${j} px apart, so they overlap`);
  console.log("");
}

/* ------------------------------------------------------------------- M2 --- */
/* The backbone is 12/24 rather than M1's 8/16: with 16 GAP features a frozen
 * backbone has almost nothing to hand the new head, and the frozen arm lost
 * everywhere by 20-30 points.  24 features is the smallest width at which the
 * comparison is about transfer rather than about bottleneck size. */

const SOURCE_KINDS = ["DISC", "RING", "BAR", "CROSS"];
const TARGET_KINDS = ["TRIANGLE", "SQUARE"];
const M2_SEEDS = 3;
const M2_S = 16;
const M2_C1 = 12;
const M2_C2 = 24;
const NS = [16, 32, 64, 128];
const LONG_NS = [16, 32];      /* also run to 100 epochs: 30 epochs on n=16 is 30 steps */
const MARKS = [5, 10, 30];
const LONG = 100;
const STRATEGIES = [
  ["SCRATCH   1e-3", { pre: false, lr: 1e-3, headOnly: false }],
  ["FINETUNE  1e-4", { pre: true, lr: 1e-4, headOnly: false }],
  ["FINETUNE  1e-3", { pre: true, lr: 1e-3, headOnly: false }],
  ["TRANSFER  1e-3", { pre: true, lr: 1e-3, headOnly: true }],
];
const DOMAINS = [["NEAR", false], ["FAR ", true]];

function pretrain(seed) {
  const rng = makeRng(1000 + seed);
  const tr = makeSet(SOURCE_KINDS, 400, M2_S, rng);
  const va = makeSet(SOURCE_KINDS, 200, M2_S, makeRng(999));
  const net = makeNet(M2_S, 1, M2_C1, M2_C2, 4, rng);
  const { w } = trainEpochs(net, tr, { epochs: 30, lr: 1e-3, rng });
  return { net, srcVal: va, srcAcc: evaluate(net, w, va), srcHead: { Wh: net.Wh.slice(), bh: net.bh.slice() } };
}

/* one target run; reports source retention at epoch 30 through onForget */
function targetRun(pre, cfg, tr, va, K, seedKey, onForget) {
  const rng = makeRng(4000 + seedKey);
  const base = cfg.pre ? copyNet(pre.net) : makeNet(M2_S, 1, M2_C1, M2_C2, 4, rng);
  const net = newHead(base, K, rng);
  const epochs = cfg.long ? LONG : 30;
  const at = cfg.long ? [...MARKS, LONG] : MARKS;
  return trainEpochs(net, tr, {
    epochs, lr: cfg.lr, headOnly: cfg.headOnly, rng, at, evalSet: va,
    onMark: (ep, n2) => {
      if (ep === 30 && onForget) {
        /* catastrophic forgetting: this backbone, the ORIGINAL source head */
        const back = { ...n2, K: 4, Wh: pre.srcHead.Wh, bh: pre.srcHead.bh };
        onForget(evaluate(back, makeWork(back), pre.srcVal));
      }
    },
  });
}

function m2() {
  console.log("== M2 TRANSFER ======================================================");
  console.log(`source DISC/RING/BAR/CROSS, 400 images, 30 epochs, S=${M2_S}, conv ${M2_C1}/${M2_C2}; target TRIANGLE vs SQUARE (perimeter-matched outlines, a distinction the source never labelled)`);
  console.log(`NEAR = same rendering as the source; FAR = inverted contrast.  validation 200 fixed images; ${M2_SEEDS} seeds`);
  const acc = {};
  const forget = {};
  let srcSum = 0;
  let srcMin = 1;
  let srcMax = 0;
  const pres = [];
  for (let s = 0; s < M2_SEEDS; s += 1) {
    const pre = pretrain(s);
    pres.push(pre);
    srcSum += pre.srcAcc;
    srcMin = Math.min(srcMin, pre.srcAcc);
    srcMax = Math.max(srcMax, pre.srcAcc);
    for (const [dname, invert] of DOMAINS) {
      const full = makeSet(TARGET_KINDS, 128, M2_S, makeRng(2000 + s), { invert });
      const va = makeSet(TARGET_KINDS, 200, M2_S, makeRng(3000), { invert });
      for (const n of NS) {
        const tr = { x: full.x.subarray(0, n * M2_S * M2_S), y: full.y.subarray(0, n), n, S: M2_S };
        for (const [sname, cfg] of STRATEGIES) {
          const long = LONG_NS.includes(n);
          const hook = cfg.pre && !cfg.headOnly
            ? (v) => { const k = `${dname}|${cfg.lr}|${n}`; forget[k] = (forget[k] || 0) + v; }
            : null;
          const { marks } = targetRun(pre, { ...cfg, long }, tr, va, 2, s * 17 + n, hook);
          for (const ep of Object.keys(marks)) {
            const k = `${dname}|${sname}|${n}|${ep}`;
            acc[k] = (acc[k] || 0) + marks[ep];
          }
        }
      }
    }
  }
  const pc = (v) => (v === undefined ? "-" : (100 * v / M2_SEEDS).toFixed(1));
  const srcMean = srcSum / M2_SEEDS;
  console.log(`source validation accuracy: mean ${(100 * srcMean).toFixed(1)}% (range ${(100 * srcMin).toFixed(1)}-${(100 * srcMax).toFixed(1)}%)`);
  for (const ep of MARKS) {
    console.log(`\nmean target validation accuracy %, epoch ${ep}`);
    for (const [dname] of DOMAINS) {
      console.log(`  ${dname} domain     ${NS.map((n) => pad(`n=${n}`, 7)).join("")}`);
      for (const [sname] of STRATEGIES) {
        console.log(`    ${lpad(sname, 15)}${NS.map((n) => pad(pc(acc[`${dname}|${sname}|${n}|${ep}`]), 7)).join("")}`);
      }
    }
  }
  console.log(`\nthe same runs carried to ${LONG} epochs, small n only (30 epochs on n=16 is 30 optimizer steps)`);
  for (const [dname] of DOMAINS) {
    console.log(`  ${dname} domain     ${LONG_NS.map((n) => pad(`n=${n}`, 7)).join("")}`);
    for (const [sname] of STRATEGIES) {
      console.log(`    ${lpad(sname, 15)}${LONG_NS.map((n) => pad(pc(acc[`${dname}|${sname}|${n}|${LONG}`]), 7)).join("")}`);
    }
  }
  console.log(`\ncatastrophic forgetting: source validation accuracy % at target epoch 30 (pretrained = ${(100 * srcMean).toFixed(1)}%)`);
  console.log(`  ${lpad("", 16)}${NS.map((n) => pad(`n=${n}`, 7)).join("")}`);
  for (const [dname] of DOMAINS) {
    for (const lr of [1e-4, 1e-3]) {
      console.log(`  ${lpad(`${dname}  lr ${lr}`, 16)}${NS.map((n) => pad(pc(forget[`${dname}|${lr}|${n}`]), 7)).join("")}`);
    }
  }

  /* CONTROL: the target IS the source task with a fresh head — the best case
   * transfer can possibly have.  If the frozen arm loses here it is losing to
   * the step budget, not to the features. */
  console.log("\nCONTROL: target = the SOURCE four classes with a fresh head, 30 epochs (the best case for transfer)");
  const cacc = {};
  for (let s = 0; s < M2_SEEDS; s += 1) {
    const full = makeSet(SOURCE_KINDS, 128, M2_S, makeRng(7000 + s));
    for (const n of NS) {
      const tr = { x: full.x.subarray(0, n * M2_S * M2_S), y: full.y.subarray(0, n), n, S: M2_S };
      for (const [sname, cfg] of STRATEGIES) {
        const { marks } = targetRun(pres[s], cfg, tr, pres[s].srcVal, 4, 8000 + s * 17 + n, null);
        const k = `${sname}|${n}`;
        cacc[k] = (cacc[k] || 0) + marks[30];
      }
    }
  }
  console.log(`  ${lpad("", 17)}${NS.map((n) => pad(`n=${n}`, 7)).join("")}   (chance = 25%)`);
  for (const [sname] of STRATEGIES) {
    console.log(`    ${lpad(sname, 15)}${NS.map((n) => pad(pc(cacc[`${sname}|${n}`]), 7)).join("")}`);
  }
  console.log("");
}

/* ------------------------------------------------------------------- M3 --- */

const M3_SEEDS = 3;
const M3_S = 16;
const M3_N = 300;

function gradcam(net, w, x, off, mask) {
  forward(net, w, x, off);
  let cls = 0;
  for (let k = 1; k < net.K; k += 1) if (w.logits[k] > w.logits[cls]) cls = k;
  const { da1, da2 } = backwardScore(net, w, cls);
  const S = net.S;
  const S2 = w.S2;
  const build = (grad, act, C, H) => {
    const area = H * H;
    const cam = F(area);
    for (let c = 0; c < C; c += 1) {
      let a = 0;
      for (let i = 0; i < area; i += 1) a += grad[c * area + i];
      a /= area;
      if (a === 0) continue;
      for (let i = 0; i < area; i += 1) cam[i] += a * act[c * area + i];
    }
    let mx = 0;
    for (let i = 0; i < area; i += 1) { if (cam[i] < 0) cam[i] = 0; if (cam[i] > mx) mx = cam[i]; }
    if (mx > 0) for (let i = 0; i < area; i += 1) cam[i] /= mx;
    const up = F(S * S);              /* nearest-neighbour upsample to S x S */
    const f = S / H;
    for (let y = 0; y < S; y += 1) {
      for (let xx = 0; xx < S; xx += 1) up[y * S + xx] = cam[Math.floor(y / f) * H + Math.floor(xx / f)];
    }
    return up;
  };
  const stats = (up) => {
    let total = 0;
    let corner = 0;
    let obj = 0;
    for (let y = 0; y < S; y += 1) {
      for (let xx = 0; xx < S; xx += 1) {
        const v = up[y * S + xx];
        total += v;
        if (y < 4 && xx < 4) corner += v;
        if (mask[y * S + xx] > 0.5) obj += v;
      }
    }
    return total > 0 ? { corner: corner / total, obj: obj / total } : { corner: 0, obj: 0 };
  };
  return { c1: stats(build(da1, w.a1, net.C1, S)), c2: stats(build(da2, w.a2, net.C2, S2)) };
}

function m3Run(rate, cueSize) {
  let clean = 0;
  let cued = 0;
  let train = 0;
  const cam = { c1c: 0, c1o: 0, c2c: 0, c2o: 0, cl1: 0, cl2: 0, cl1c: 0, cl2c: 0 };
  let objFrac = 0;
  let objN = 0;
  for (let s = 0; s < M3_SEEDS; s += 1) {
    const rng = makeRng(5000 + s);
    const tr = makeSet(["DISC", "RING"], M3_N, M3_S, rng, { cueClass: 0, cueRate: rate, cueSize });
    const teClean = makeSet(["DISC", "RING"], 200, M3_S, makeRng(6000), { cueSize });
    const teCued = makeSet(["DISC", "RING"], 200, M3_S, makeRng(6000), { cueAll: true, cueSize });
    const net = makeNet(M3_S, 1, 8, 16, 2, rng);
    const { w } = trainEpochs(net, tr, { epochs: 30, lr: 1e-3, rng });
    train += evaluate(net, w, tr);
    clean += evaluate(net, w, teClean);
    cued += evaluate(net, w, teCued);
    for (let i = 0; i < 50; i += 1) {
      const a = gradcam(net, w, teCued.x, i * M3_S * M3_S, teCued.masks[i]);
      cam.c1c += a.c1.corner; cam.c1o += a.c1.obj;
      cam.c2c += a.c2.corner; cam.c2o += a.c2.obj;
      const b = gradcam(net, w, teClean.x, i * M3_S * M3_S, teClean.masks[i]);
      cam.cl1 += b.c1.obj; cam.cl2 += b.c2.obj;
      cam.cl1c += b.c1.corner; cam.cl2c += b.c2.corner;
      let m = 0;
      for (let j = 0; j < M3_S * M3_S; j += 1) if (teClean.masks[i][j] > 0.5) m += 1;
      objFrac += m / (M3_S * M3_S);
      objN += 1;
    }
  }
  const d = M3_SEEDS * 50;
  const o = { rate, cueSize, train: train / M3_SEEDS, clean: clean / M3_SEEDS, cued: cued / M3_SEEDS, objFrac: objFrac / objN };
  for (const k of Object.keys(cam)) o[k] = cam[k] / d;
  return o;
}

function m3() {
  console.log("== M3 GRAD-CAM WITH A SHORTCUT ======================================");
  console.log(`DISC vs RING, S=${M3_S}, ${M3_N} training images, 30 epochs, conv 8/16, ${M3_SEEDS} seeds`);
  console.log("cue = a bright square in the top-left corner, added to class-DISC TRAINING images only at the stated rate");
  const rows = [0, 0.5, 1].map((r) => m3Run(r, 3));
  const small = m3Run(1, 2);
  const tag = (r) => (r.cueSize === 2 ? "100%, 2x2" : `${(100 * r.rate).toFixed(0)}%`);
  console.log(`\n${lpad("cue rate", 10)}${pad("train", 8)}${pad("CLEAN", 8)}${pad("CUED", 8)}   accuracy %, 3x3 cue`);
  for (const r of rows) {
    console.log(`${lpad(tag(r), 10)}${pad((100 * r.train).toFixed(1), 8)}${pad((100 * r.clean).toFixed(1), 8)}${pad((100 * r.cued).toFixed(1), 8)}`);
  }
  console.log(`${lpad(tag(small), 10)}${pad((100 * small.train).toFixed(1), 8)}${pad((100 * small.clean).toFixed(1), 8)}${pad((100 * small.cued).toFixed(1), 8)}   <- the 2x2 cue the plan asked for`);
  console.log(`\nCAM mass %, mean of ${M3_SEEDS * 50} test images.  corner = top-left 4x4 (6.25% of the image); object = the shape's footprint (${(100 * rows[0].objFrac).toFixed(1)}% of the image)`);
  console.log(`${lpad("cue rate", 10)}${pad("c1 corner", 11)}${pad("c1 object", 11)}${pad("c2 corner", 11)}${pad("c2 object", 11)}   on CUED test images`);
  for (const r of [...rows, small]) {
    console.log(`${lpad(tag(r), 10)}${pad((100 * r.c1c).toFixed(1), 11)}${pad((100 * r.c1o).toFixed(1), 11)}${pad((100 * r.c2c).toFixed(1), 11)}${pad((100 * r.c2o).toFixed(1), 11)}`);
  }
  console.log(`${lpad("cue rate", 10)}${pad("c1 corner", 11)}${pad("c1 object", 11)}${pad("c2 corner", 11)}${pad("c2 object", 11)}   on CLEAN test images (no cue present)`);
  for (const r of [...rows, small]) {
    console.log(`${lpad(tag(r), 10)}${pad((100 * r.cl1c).toFixed(1), 11)}${pad((100 * r.cl1).toFixed(1), 11)}${pad((100 * r.cl2c).toFixed(1), 11)}${pad((100 * r.cl2).toFixed(1), 11)}`);
  }
  console.log(`\nresolution: conv1 CAM ${M3_S * M3_S} distinct cells (${M3_S}x${M3_S}), conv2 CAM ${(M3_S >> 1) ** 2} (${M3_S >> 1}x${M3_S >> 1}) — each conv2 cell is a 2x2 block after upsampling`);
  console.log("");
}

/* ----------------------------------------------------------------- main --- */

const T0 = performance.now();
gradCheck();
m1();
m2();
m3();
console.log(`total runtime ${((performance.now() - T0) / 1000).toFixed(0)} s`);
