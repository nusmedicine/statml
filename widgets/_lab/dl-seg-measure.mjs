/* Planning measurement for the segmentation slot (PHM5005 06-3, "DL for Image
 * Data - Segmentation").  Asks four questions the notebook's recipe raises and
 * a widget would have to answer before it is designed:
 *
 *   M1  does Dice actually disagree with pixel accuracy, and by how much, at
 *       the 1% / 5% / 20% object sizes the lesson's bins imply?  And is 0.5 the
 *       best threshold on a soft prediction, or just a flat plateau?
 *   M2  does a plain random 80/10/10 (splitfolders.ratio) really drop a size
 *       bin out of a 60-case test set often enough to be worth showing?
 *   M3  what does a bilinear-resampled mask cost, and what does forgetting to
 *       pair the transform cost?
 *   M4  can a 2-level U-Net train inside compute() in plain JS, does the concat
 *       skip earn its place, and does Dice+BCE beat Dice alone on small objects?
 *
 * No torch on this machine, so M4 is a hand-written engine: conv3x3 pad 1 with
 * bias, ReLU, maxpool2, a LEARNED transposed conv k=2 s=2, concat skip, a 1x1
 * head, sigmoid, soft Dice (and Dice+BCE), Adam lr 1e-3.  NO BATCHNORM — the
 * lesson's DoubleConv has it and this does not, so every M4 number is for a
 * net that is one component short of the lesson's.  Gradients are checked
 * against central finite differences before anything is measured.
 *
 * FINDINGS, 2026-09-13 (node 24.18, one machine).  Every number below except
 * the timings is bit-identical across three runs; ms/epoch moved 40% between
 * runs on an otherwise idle machine, so the cost figures are ranges.
 *
 *   M1 - the empty prediction is the whole argument, and it is stronger than
 *   the lesson states.  Pixel accuracy / Dice for predicting nothing: 1% disc
 *   0.9893 / 0.000, 5% disc 0.9492 / 0.000, 20% disc 0.7998 / 0.000.  Even at
 *   20% the two do not really agree - 80% accuracy against Dice 0.  Worse: a
 *   prediction that misses the 1% disc ENTIRELY (shifted 8 px, zero overlap)
 *   still scores 97.85% accuracy, which is above the accuracy a PERFECT-shaped
 *   but empty prediction gets on the 20% disc.  Accuracy on this task is a
 *   measure of object size, not of the prediction.
 *   Dice is correspondingly sharp on small objects: a 1-pixel shift costs
 *   0.182 Dice at 1% (1.000 -> 0.818) but only 0.039 at 20%; accuracy moves
 *   0.4 and 1.6 points for the same two.
 *   A same-area RANDOM mask scores Dice 0.000 at 1%, 0.029 at 5%, 0.195 at
 *   20% - chance buys real-looking Dice once the object is big, which is the
 *   other half of the argument for reporting Dice per size bin.
 *   Dilate / erode is the over- vs under-segmentation axis and Dice hides it:
 *   on the 5% disc, dilate 1 is precision 0.754 recall 1.000 Dice 0.860, and
 *   erode 1 is precision 1.000 recall 0.712 Dice 0.831.  Near-equal Dice,
 *   opposite failure.  A widget that shows Dice alone cannot tell them apart.
 *   THRESHOLD: on a distance-sigmoid probability map (width 1.5 px) Dice peaks
 *   at 0.5 at all three sizes, but the curve is NOT uniformly flat - on the
 *   20% disc it runs 0.822 at t=0.1 to 0.780 at t=0.9 (never below 0.78), and
 *   on the 1% disc it runs 0.458 to 0.000.  0.5 is the right default, and the
 *   small object is the only place the choice costs anything.
 *
 *   M2 - 600 cases (15% normal, then log-normal centred on 3%, clipped to
 *   0.1-30%) bin as normal 83, small 20, medium 403, large 94; "small" is 3.3%
 *   of the data.  Over 200 shuffles the RANDOM 80/10/10 left some bin EMPTY in
 *   val 15.0% of the time, in test 13.0%, in one or the other 27.5%.  The
 *   stratified split: 0.0%, every time.  Per-bin counts in the 60-case test
 *   set - random: normal 3-15, small 0-6, medium 28-49, large 3-16.
 *   Stratified: exactly 8 / 2 / 40 / 9 every shuffle.  The claim holds (the
 *   smallest bin does get dropped) and the large bin swinging 3-16 is the
 *   quieter version of the same problem: a test Dice averaged over that set is
 *   partly a report on which cases the shuffle happened to pick.
 *
 *   M3 - a 32x32 disc mask (r=6, off-centre), rotate 10 deg + scale 1.1.
 *   NEAREST: 2 distinct values, area 134 px.  BILINEAR: 59 pixels strictly
 *   between 0 and 1 - 5.8% of the image, and 44% OF THE OBJECT'S OWN AREA.
 *   Nearly half the object becomes a fraction, which is the failure to draw.
 *   Thresholding those at 0.5 recovers area 135 and Dice 0.996 against the
 *   nearest version, so discretising is a cheap repair; the expensive thing
 *   would be training on the fractions.
 *   NOT PAIRING costs far more.  Image transformed, mask left alone, Dice
 *   between the object's true position and the stale mask: 0.912 at 10 deg,
 *   0.809 at 20 deg, 0.564 at 45 deg, 0.071 for a horizontal flip.  The flip
 *   is the one to show - a near-total miss from the most innocuous transform
 *   in the list, and one that produces no error and no visible artefact.
 *
 *   M4 - gradient check (S=4, C=2, float64, central differences, coordinates
 *   whose perturbation flips a ReLU sign or a maxpool argmax skipped as kinks):
 *   max relative error 2.7e-07 over 50 coordinates with the skip, 6.0e-09 over
 *   46 with it removed.  The engine is right.
 *   COST, 200 images at batch 8 (median epoch): S=16 C=4 = 166-238 ms, S=16
 *   C=8 = 962-1044 ms, S=32 C=4 = 1050-1076 ms.  Cost grows FASTER than the
 *   flop count (S=32 is 4x the flops of S=16 and 5-6x the time; the buffers
 *   leave L1).  A 30-epoch run is 5-7 s at the cheapest setting - OVER THE ~2 s
 *   BUDGET.  What fits in 2 s is S=16 C=4 for 8-12 epochs, and nothing else.
 *   So: fewer epochs than the lesson, or train across frames, or ship weights.
 *   SKIP (S=16 C=4, Dice+BCE, 3 seeds, val Dice at epochs 5 / 15 / 30):
 *   concat skip 0.775 / 0.841 / 0.843, no skip 0.603 / 0.823 / 0.837.  On the
 *   1-pixel ring around the true edge: 0.741 / 0.818 / 0.818 against 0.602 /
 *   0.799 / 0.814.  The skip is worth 0.17 Dice at epoch 5 and 0.006 at epoch
 *   30 - at this scale it buys SPEED OF CONVERGENCE, not a better final
 *   answer.  And the boundary ring moves by the same amount as the whole
 *   object (0.139 vs 0.172 at epoch 5), so on this data the no-skip net is not
 *   specifically a boundary failure; it is just behind.  The "skip recovers
 *   fine detail" story did NOT separate from "skip trains faster" here, and a
 *   widget that claims the first would be claiming more than this measures.
 *   LOSS ON SMALL OBJECTS (1 blob, 1-3% of pixels, val Dice at 5 / 15 / 30):
 *   Dice alone 0.623 / 0.692 / 0.711, Dice+BCE 0.230 / 0.684 / 0.691.  Share
 *   of the 60 val images predicted ENTIRELY BACKGROUND: Dice alone 3% / 2% /
 *   1%, Dice+BCE 34% / 2% / 1%.  DICE+BCE IS WORSE HERE, AND THE INSTABILITY
 *   IS ON THE BCE SIDE: with 2% positives the cheapest thing mean-BCE can do
 *   early is predict background everywhere, and it does, for a third of the
 *   validation set at epoch 5.  It recovers by epoch 15 and never catches up.
 *   The lesson's "DiceCELoss is more stable for small objects" does not
 *   reproduce in this engine - but this engine has no batchnorm and trains 30
 *   epochs on 16x16 images, so treat it as a reason to MEASURE before building
 *   a widget around that claim, not as a refutation of it.
 *
 * NOT MEASURED: batchnorm (absent from the engine, and the lesson's DoubleConv
 * has it - every M4 number is for a net one component short of the lesson's);
 * 3-level and 4-level U-Nets; S=32 trained to convergence (timed only); any
 * torch cross-check; class-weighted or focal losses; augmentation's effect on
 * training (M3 measures the transform, not what it buys); real images; and the
 * lesson's own dataset, which was never loaded.
 * Run: node widgets/_lab/dl-seg-measure.mjs
 */

/* ---------- seeded rng (LCG, as in dl-loop-measure.mjs) ---------- */
function makeRng(seed) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  rnd.gauss = () => {
    const u = rnd() || 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  return rnd;
}
const fx = (v, n = 3) => (Number.isFinite(v) ? v.toFixed(n) : "  -  ");
const pad = (s, n) => String(s).padStart(n);

/* ================= M1  Dice versus pixel accuracy ================= */

const G = 64;
const disc = (cx, cy, r) => {
  const m = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) m[y * G + x] = 1;
    }
  }
  return m;
};
/* radius for a target area fraction */
const radiusFor = (frac) => Math.sqrt((frac * G * G) / Math.PI);

function metrics(a, b) {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  let correct = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] && b[i]) inter += 1;
    if (a[i]) sa += 1;
    if (b[i]) sb += 1;
    if (!!a[i] === !!b[i]) correct += 1;
  }
  const dice = sa + sb === 0 ? 1 : (2 * inter) / (sa + sb);
  const iou = sa + sb - inter === 0 ? 1 : inter / (sa + sb - inter);
  return {
    acc: correct / a.length,
    dice,
    iou,
    prec: sb === 0 ? (sa === 0 ? 1 : 0) : inter / sb,
    rec: sa === 0 ? 1 : inter / sa,
  };
}

const shiftMask = (m, dx, dy) => {
  const o = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 1) {
    for (let x = 0; x < G; x += 1) {
      const sy = y - dy;
      const sx = x - dx;
      if (sy >= 0 && sy < G && sx >= 0 && sx < G) o[y * G + x] = m[sy * G + sx];
    }
  }
  return o;
};
/* 3x3 square structuring element, applied k times */
const morph = (m, k, grow) => {
  let cur = m;
  for (let s = 0; s < k; s += 1) {
    const o = new Uint8Array(G * G);
    for (let y = 0; y < G; y += 1) {
      for (let x = 0; x < G; x += 1) {
        let any = 0;
        let all = 1;
        for (let j = -1; j <= 1; j += 1) {
          for (let i = -1; i <= 1; i += 1) {
            const yy = y + j;
            const xx = x + i;
            const v = yy < 0 || yy >= G || xx < 0 || xx >= G ? 0 : cur[yy * G + xx];
            if (v) any = 1; else all = 0;
          }
        }
        o[y * G + x] = grow ? any : all;
      }
    }
    cur = o;
  }
  return cur;
};
const randomMaskOfArea = (n, rnd) => {
  const idx = Array.from({ length: G * G }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const o = new Uint8Array(G * G);
  for (let i = 0; i < n; i += 1) o[idx[i]] = 1;
  return o;
};

function m1() {
  console.log("\n=== M1  Dice vs pixel accuracy, 64x64, filled disc ===");
  const rnd = makeRng(7);
  const sizes = [0.01, 0.05, 0.20];
  console.log(`${pad("object", 8)} ${pad("prediction", 18)} ${pad("acc", 7)} ${pad("dice", 6)} ${pad("iou", 6)} ${pad("prec", 6)} ${pad("rec", 6)}`);
  for (const frac of sizes) {
    const r = radiusFor(frac);
    const truth = disc(G / 2, G / 2, r);
    let area = 0;
    for (const v of truth) area += v;
    const preds = [
      ["empty", new Uint8Array(G * G)],
      ["exact", truth],
      ...[1, 2, 4, 8].map((k) => [`shift ${k}px`, shiftMask(truth, k, 0)]),
      ...[1, 2].map((k) => [`dilate ${k}`, morph(truth, k, true)]),
      ...[1, 2].map((k) => [`erode ${k}`, morph(truth, k, false)]),
      ["random, same area", randomMaskOfArea(area, rnd)],
    ];
    for (const [name, p] of preds) {
      const m = metrics(truth, p);
      const tag = name === "empty" ? `${(100 * frac).toFixed(0)}% (${area}px)` : "";
      console.log(`${pad(tag, 8)} ${pad(name, 18)} ${pad(fx(m.acc, 4), 7)} ${pad(fx(m.dice), 6)} ${pad(fx(m.iou), 6)} ${pad(fx(m.prec), 6)} ${pad(fx(m.rec), 6)}`);
    }
  }

  console.log("\n-- soft prediction: sigmoid((r - dist)/1.5), Dice by threshold --");
  const ths = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  console.log(`${pad("object", 8)} ${ths.map((t) => pad(t.toFixed(1), 6)).join(" ")}   best`);
  for (const frac of sizes) {
    const r = radiusFor(frac);
    const truth = disc(G / 2, G / 2, r);
    const prob = new Float64Array(G * G);
    for (let y = 0; y < G; y += 1) {
      for (let x = 0; x < G; x += 1) {
        const d = Math.hypot(x + 0.5 - G / 2, y + 0.5 - G / 2);
        prob[y * G + x] = 1 / (1 + Math.exp(-(r - d) / 1.5));
      }
    }
    const row = ths.map((t) => {
      const p = new Uint8Array(G * G);
      for (let i = 0; i < p.length; i += 1) p[i] = prob[i] >= t ? 1 : 0;
      return metrics(truth, p).dice;
    });
    let bi = 0;
    row.forEach((v, i) => { if (v > row[bi]) bi = i; });
    console.log(`${pad(`${(100 * frac).toFixed(0)}%`, 8)} ${row.map((v) => pad(fx(v), 6)).join(" ")}   ${ths[bi].toFixed(1)}`);
  }
}

/* ================= M2  size bins and the split ================= */

const binOf = (f) => (f === 0 ? 0 : f < 0.01 ? 1 : f < 0.05 ? 2 : 3);
const BINS = ["normal", "small", "medium", "large"];

function m2() {
  console.log("\n=== M2  size bins, random vs stratified 80/10/10 ===");
  const rnd = makeRng(11);
  const cases = [];
  for (let i = 0; i < 600; i += 1) {
    let f = 0;
    if (rnd() >= 0.15) {
      f = Math.exp(Math.log(0.03) + 0.6 * rnd.gauss());
      f = Math.min(0.30, Math.max(0.001, f));
    }
    cases.push(f);
  }
  const counts = [0, 0, 0, 0];
  for (const f of cases) counts[binOf(f)] += 1;
  console.log(`600 cases -> ${BINS.map((b, i) => `${b} ${counts[i]}`).join(", ")}`);

  const shuffle = (a, r) => {
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const tally = (idx) => {
    const c = [0, 0, 0, 0];
    for (const i of idx) c[binOf(cases[i])] += 1;
    return c;
  };
  const SH = 200;
  const stats = {};
  for (const mode of ["random", "stratified"]) {
    let emptyVal = 0;
    let emptyTest = 0;
    let emptyEither = 0;
    const lo = [99, 99, 99, 99];
    const hi = [0, 0, 0, 0];
    const sum = [0, 0, 0, 0];
    const r = makeRng(mode === "random" ? 101 : 202);
    for (let s = 0; s < SH; s += 1) {
      let te = [];
      let va = [];
      if (mode === "random") {
        const all = shuffle(Array.from({ length: 600 }, (_, i) => i), r);
        te = all.slice(0, 60);
        va = all.slice(60, 120);
      } else {
        for (let b = 0; b < 4; b += 1) {
          const g = shuffle(Array.from({ length: 600 }, (_, i) => i).filter((i) => binOf(cases[i]) === b), r);
          const n = Math.round(g.length * 0.1);
          te.push(...g.slice(0, n));
          va.push(...g.slice(n, 2 * n));
        }
      }
      const ct = tally(te);
      const cv = tally(va);
      const ev = cv.some((v) => v === 0);
      const et = ct.some((v) => v === 0);
      if (ev) emptyVal += 1;
      if (et) emptyTest += 1;
      if (ev || et) emptyEither += 1;
      for (let b = 0; b < 4; b += 1) {
        lo[b] = Math.min(lo[b], ct[b]);
        hi[b] = Math.max(hi[b], ct[b]);
        sum[b] += ct[b];
      }
    }
    stats[mode] = { emptyVal, emptyTest, emptyEither, lo, hi, sum };
  }
  console.log(`${pad("split", 12)} ${pad("empty bin in val", 17)} ${pad("in test", 9)} ${pad("in either", 11)}`);
  for (const mode of ["random", "stratified"]) {
    const s = stats[mode];
    console.log(`${pad(mode, 12)} ${pad(`${((100 * s.emptyVal) / SH).toFixed(1)}%`, 17)} ${pad(`${((100 * s.emptyTest) / SH).toFixed(1)}%`, 9)} ${pad(`${((100 * s.emptyEither) / SH).toFixed(1)}%`, 11)}   (of ${SH} shuffles)`);
  }
  console.log(`\n${pad("split", 12)} ${BINS.map((b) => pad(b, 16)).join(" ")}   (test-set count: min-max, mean)`);
  for (const mode of ["random", "stratified"]) {
    const s = stats[mode];
    console.log(`${pad(mode, 12)} ${BINS.map((_, b) => pad(`${s.lo[b]}-${s.hi[b]} (${(s.sum[b] / SH).toFixed(1)})`, 16)).join(" ")}`);
  }
}

/* ================= M3  paired augmentation and interpolation ================= */

const R = 32;
function resample(src, mapper, bilinear) {
  const o = new Float64Array(R * R);
  for (let y = 0; y < R; y += 1) {
    for (let x = 0; x < R; x += 1) {
      const [sx, sy] = mapper(x + 0.5, y + 0.5);
      if (!bilinear) {
        const ix = Math.round(sx - 0.5);
        const iy = Math.round(sy - 0.5);
        o[y * R + x] = ix < 0 || ix >= R || iy < 0 || iy >= R ? 0 : src[iy * R + ix];
      } else {
        const fx0 = sx - 0.5;
        const fy0 = sy - 0.5;
        const x0 = Math.floor(fx0);
        const y0 = Math.floor(fy0);
        const ax = fx0 - x0;
        const ay = fy0 - y0;
        const at = (xx, yy) => (xx < 0 || xx >= R || yy < 0 || yy >= R ? 0 : src[yy * R + xx]);
        o[y * R + x] = at(x0, y0) * (1 - ax) * (1 - ay) + at(x0 + 1, y0) * ax * (1 - ay)
          + at(x0, y0 + 1) * (1 - ax) * ay + at(x0 + 1, y0 + 1) * ax * ay;
      }
    }
  }
  return o;
}
const affineInv = (deg, scale) => {
  const t = (-deg * Math.PI) / 180;
  const c = Math.cos(t) / scale;
  const s = Math.sin(t) / scale;
  const k = R / 2;
  return (x, y) => [c * (x - k) - s * (y - k) + k, s * (x - k) + c * (y - k) + k];
};
const hardOf = (f, t = 0.5) => {
  const o = new Uint8Array(R * R);
  for (let i = 0; i < f.length; i += 1) o[i] = f[i] >= t ? 1 : 0;
  return o;
};
const dice2 = (a, b) => {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] && b[i]) inter += 1;
    if (a[i]) sa += 1;
    if (b[i]) sb += 1;
  }
  return sa + sb === 0 ? 1 : (2 * inter) / (sa + sb);
};
const discR = (cx, cy, r) => {
  const m = new Float64Array(R * R);
  for (let y = 0; y < R; y += 1) for (let x = 0; x < R; x += 1) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) m[y * R + x] = 1;
  return m;
};

function m3() {
  console.log("\n=== M3  paired augmentation, 32x32 ===");
  /* OFF-CENTRE on purpose: a disc centred on the rotation centre is invariant
   * under rotation, and every unpaired row below reads 1.000 on one. */
  const mask = discR(11, 14, 6);
  const map = affineInv(10, 1.1);
  const near = resample(mask, map, false);
  const bil = resample(mask, map, true);
  const distinct = new Set(Array.from(near)).size;
  let mid = 0;
  for (const v of bil) if (v > 1e-9 && v < 1 - 1e-9) mid += 1;
  const nearH = hardOf(near);
  const bilH = hardOf(bil);
  const areaN = nearH.reduce((a, v) => a + v, 0);
  const areaB = bilH.reduce((a, v) => a + v, 0);
  console.log("rotate 10 deg, scale 1.1 applied to the MASK");
  console.log(`  nearest : ${distinct} distinct values, area ${areaN} px`);
  console.log(`  bilinear: ${mid} px strictly between 0 and 1 (${((100 * mid) / (R * R)).toFixed(1)}% of image, ${((100 * mid) / areaN).toFixed(0)}% of the object's area)`);
  console.log(`  bilinear then threshold 0.5: area ${areaB} px, Dice vs nearest ${fx(dice2(nearH, bilH))}`);

  console.log("\nNOT pairing: image transformed, mask left alone");
  console.log(`${pad("transform", 16)} ${pad("dice(true position, stale mask)", 32)}`);
  for (const deg of [10, 20, 45]) {
    const moved = hardOf(resample(mask, affineInv(deg, 1), false));
    console.log(`${pad(`rotate ${deg} deg`, 16)} ${pad(fx(dice2(moved, hardOf(mask))), 32)}`);
  }
  const flipped = new Float64Array(R * R);
  for (let y = 0; y < R; y += 1) for (let x = 0; x < R; x += 1) flipped[y * R + x] = mask[y * R + (R - 1 - x)];
  console.log(`${pad("hflip", 16)} ${pad(fx(dice2(hardOf(flipped), hardOf(mask))), 32)}`);
}

/* ================= M4  a tiny U-Net in JS ================= */

let AR = Float32Array; /* switched to Float64Array for the gradient check only */

function conv3fwd(x, ic, oc, H, W, w, b, out) {
  for (let o = 0; o < oc; o += 1) {
    const ob = o * H * W;
    const bv = b[o];
    for (let i = 0; i < H * W; i += 1) out[ob + i] = bv;
    for (let c = 0; c < ic; c += 1) {
      const wb = (o * ic + c) * 9;
      const xb = c * H * W;
      for (let ky = 0; ky < 3; ky += 1) {
        for (let kx = 0; kx < 3; kx += 1) {
          const wv = w[wb + ky * 3 + kx];
          const dy = ky - 1;
          const dx = kx - 1;
          const y0 = Math.max(0, -dy);
          const y1 = Math.min(H, H - dy);
          const x0 = Math.max(0, -dx);
          const x1 = Math.min(W, W - dx);
          for (let y = y0; y < y1; y += 1) {
            const orow = ob + y * W;
            const xrow = xb + (y + dy) * W + dx;
            for (let xx = x0; xx < x1; xx += 1) out[orow + xx] += wv * x[xrow + xx];
          }
        }
      }
    }
  }
}
function conv3bwd(x, gy, ic, oc, H, W, w, gw, gb, gx) {
  if (gx) gx.fill(0);
  for (let o = 0; o < oc; o += 1) {
    const ob = o * H * W;
    let s = 0;
    for (let i = 0; i < H * W; i += 1) s += gy[ob + i];
    gb[o] += s;
    for (let c = 0; c < ic; c += 1) {
      const wb = (o * ic + c) * 9;
      const xb = c * H * W;
      for (let ky = 0; ky < 3; ky += 1) {
        for (let kx = 0; kx < 3; kx += 1) {
          const wv = w[wb + ky * 3 + kx];
          const dy = ky - 1;
          const dx = kx - 1;
          const y0 = Math.max(0, -dy);
          const y1 = Math.min(H, H - dy);
          const x0 = Math.max(0, -dx);
          const x1 = Math.min(W, W - dx);
          let acc = 0;
          for (let y = y0; y < y1; y += 1) {
            const orow = ob + y * W;
            const xrow = xb + (y + dy) * W + dx;
            for (let xx = x0; xx < x1; xx += 1) {
              const g = gy[orow + xx];
              acc += g * x[xrow + xx];
              if (gx) gx[xrow + xx] += wv * g;
            }
          }
          gw[wb + ky * 3 + kx] += acc;
        }
      }
    }
  }
}
/* 1x1 head */
function conv1fwd(x, ic, oc, N, w, b, out) {
  for (let o = 0; o < oc; o += 1) {
    const ob = o * N;
    for (let i = 0; i < N; i += 1) out[ob + i] = b[o];
    for (let c = 0; c < ic; c += 1) {
      const wv = w[o * ic + c];
      const xb = c * N;
      for (let i = 0; i < N; i += 1) out[ob + i] += wv * x[xb + i];
    }
  }
}
function conv1bwd(x, gy, ic, oc, N, w, gw, gb, gx) {
  gx.fill(0);
  for (let o = 0; o < oc; o += 1) {
    const ob = o * N;
    let s = 0;
    for (let i = 0; i < N; i += 1) s += gy[ob + i];
    gb[o] += s;
    for (let c = 0; c < ic; c += 1) {
      const wv = w[o * ic + c];
      const xb = c * N;
      let acc = 0;
      for (let i = 0; i < N; i += 1) {
        acc += gy[ob + i] * x[xb + i];
        gx[xb + i] += wv * gy[ob + i];
      }
      gw[o * ic + c] += acc;
    }
  }
}
function poolFwd(x, C, H, W, out, idx) {
  const h2 = H / 2;
  const w2 = W / 2;
  for (let c = 0; c < C; c += 1) {
    for (let y = 0; y < h2; y += 1) {
      for (let x2 = 0; x2 < w2; x2 += 1) {
        let best = -Infinity;
        let bi = 0;
        for (let j = 0; j < 2; j += 1) {
          for (let i = 0; i < 2; i += 1) {
            const p = c * H * W + (2 * y + j) * W + 2 * x2 + i;
            if (x[p] > best) { best = x[p]; bi = p; }
          }
        }
        out[c * h2 * w2 + y * w2 + x2] = best;
        idx[c * h2 * w2 + y * w2 + x2] = bi;
      }
    }
  }
}
function poolBwd(gy, idx, n, gx) {
  gx.fill(0);
  for (let i = 0; i < n; i += 1) gx[idx[i]] += gy[i];
}
/* transposed conv, k=2 s=2: w is [ic][oc][2][2] */
function upFwd(x, ic, oc, h2, w2, w, b, out) {
  const H = h2 * 2;
  const W = w2 * 2;
  for (let o = 0; o < oc; o += 1) {
    const ob = o * H * W;
    for (let i = 0; i < H * W; i += 1) out[ob + i] = b[o];
  }
  for (let c = 0; c < ic; c += 1) {
    for (let y = 0; y < h2; y += 1) {
      for (let x2 = 0; x2 < w2; x2 += 1) {
        const xv = x[c * h2 * w2 + y * w2 + x2];
        for (let o = 0; o < oc; o += 1) {
          const wb = (c * oc + o) * 4;
          const ob = o * H * W;
          out[ob + 2 * y * W + 2 * x2] += w[wb] * xv;
          out[ob + 2 * y * W + 2 * x2 + 1] += w[wb + 1] * xv;
          out[ob + (2 * y + 1) * W + 2 * x2] += w[wb + 2] * xv;
          out[ob + (2 * y + 1) * W + 2 * x2 + 1] += w[wb + 3] * xv;
        }
      }
    }
  }
}
function upBwd(x, gy, ic, oc, h2, w2, w, gw, gb, gx) {
  const H = h2 * 2;
  const W = w2 * 2;
  gx.fill(0);
  for (let o = 0; o < oc; o += 1) {
    const ob = o * H * W;
    let s = 0;
    for (let i = 0; i < H * W; i += 1) s += gy[ob + i];
    gb[o] += s;
  }
  for (let c = 0; c < ic; c += 1) {
    for (let y = 0; y < h2; y += 1) {
      for (let x2 = 0; x2 < w2; x2 += 1) {
        const xi = c * h2 * w2 + y * w2 + x2;
        const xv = x[xi];
        let gacc = 0;
        for (let o = 0; o < oc; o += 1) {
          const wb = (c * oc + o) * 4;
          const ob = o * H * W;
          const g0 = gy[ob + 2 * y * W + 2 * x2];
          const g1 = gy[ob + 2 * y * W + 2 * x2 + 1];
          const g2 = gy[ob + (2 * y + 1) * W + 2 * x2];
          const g3 = gy[ob + (2 * y + 1) * W + 2 * x2 + 1];
          gw[wb] += g0 * xv;
          gw[wb + 1] += g1 * xv;
          gw[wb + 2] += g2 * xv;
          gw[wb + 3] += g3 * xv;
          gacc += w[wb] * g0 + w[wb + 1] * g1 + w[wb + 2] * g2 + w[wb + 3] * g3;
        }
        gx[xi] += gacc;
      }
    }
  }
}

function buildNet(S, C, skip, rnd) {
  const H = S;
  const W = S;
  const h2 = S / 2;
  const w2 = S / 2;
  const P = (n) => ({ v: new AR(n), g: new AR(n), m: new AR(n), u: new AR(n) });
  const mk = (ic, oc, k, fanIn) => {
    const w = P(oc * ic * k);
    const b = P(oc);
    const sd = Math.sqrt(2 / fanIn);
    for (let i = 0; i < w.v.length; i += 1) w.v[i] = rnd.gauss() * sd;
    return { w, b, ic, oc };
  };
  const dic = skip ? 2 * C : C;
  const n = {
    S, C, skip, H, W, h2, w2,
    c1: mk(1, C, 9, 9),
    c2: mk(C, C, 9, 9 * C),
    b1: mk(C, 2 * C, 9, 9 * C),
    b2: mk(2 * C, 2 * C, 9, 18 * C),
    up: mk(2 * C, C, 4, 4 * 2 * C),
    d1: mk(dic, C, 9, 9 * dic),
    d2: mk(C, C, 9, 9 * C),
    hd: mk(C, 1, 1, C),
  };
  n.params = ["c1", "c2", "b1", "b2", "up", "d1", "d2", "hd"].flatMap((k) => [n[k].w, n[k].b]);
  const A = (sz) => new AR(sz);
  n.buf = {
    a1: A(C * H * W), a2: A(C * H * W), po: A(C * h2 * w2), pi: new Int32Array(C * h2 * w2),
    q1: A(2 * C * h2 * w2), q2: A(2 * C * h2 * w2), up: A(C * H * W), cat: A(dic * H * W),
    a3: A(C * H * W), a4: A(C * H * W), z: A(H * W), p: A(H * W),
    ga1: A(C * H * W), ga2: A(C * H * W), gpo: A(C * h2 * w2),
    gq1: A(2 * C * h2 * w2), gq2: A(2 * C * h2 * w2), gup: A(C * H * W), gcat: A(dic * H * W),
    ga3: A(C * H * W), ga4: A(C * H * W), gz: A(H * W),
  };
  return n;
}
const relu = (a) => { for (let i = 0; i < a.length; i += 1) if (a[i] < 0) a[i] = 0; };
const dRelu = (g, a) => { for (let i = 0; i < g.length; i += 1) if (a[i] <= 0) g[i] = 0; };

function forward(n, x) {
  const { C, H, W, h2, w2, skip } = n;
  const B = n.buf;
  conv3fwd(x, 1, C, H, W, n.c1.w.v, n.c1.b.v, B.a1); relu(B.a1);
  conv3fwd(B.a1, C, C, H, W, n.c2.w.v, n.c2.b.v, B.a2); relu(B.a2);
  poolFwd(B.a2, C, H, W, B.po, B.pi);
  conv3fwd(B.po, C, 2 * C, h2, w2, n.b1.w.v, n.b1.b.v, B.q1); relu(B.q1);
  conv3fwd(B.q1, 2 * C, 2 * C, h2, w2, n.b2.w.v, n.b2.b.v, B.q2); relu(B.q2);
  upFwd(B.q2, 2 * C, C, h2, w2, n.up.w.v, n.up.b.v, B.up);
  B.cat.set(B.up.subarray(0, C * H * W), 0);
  if (skip) B.cat.set(B.a2.subarray(0, C * H * W), C * H * W);
  conv3fwd(B.cat, skip ? 2 * C : C, C, H, W, n.d1.w.v, n.d1.b.v, B.a3); relu(B.a3);
  conv3fwd(B.a3, C, C, H, W, n.d2.w.v, n.d2.b.v, B.a4); relu(B.a4);
  conv1fwd(B.a4, C, 1, H * W, n.hd.w.v, n.hd.b.v, B.z);
  for (let i = 0; i < H * W; i += 1) B.p[i] = 1 / (1 + Math.exp(-B.z[i]));
  return B.p;
}
/* soft Dice (+ optional BCE); writes dL/dz into B.gz, returns the loss */
function lossGrad(n, t, withBce) {
  const B = n.buf;
  const N = n.H * n.W;
  const e = 1e-5; /* MONAI DiceLoss smooth_nr / smooth_dr defaults */
  let I = 0;
  let sp = 0;
  let st = 0;
  for (let i = 0; i < N; i += 1) { I += B.p[i] * t[i]; sp += B.p[i]; st += t[i]; }
  const den = sp + st + e;
  const D = (2 * I + e) / den;
  let L = 1 - D;
  for (let i = 0; i < N; i += 1) {
    const dLdp = -(2 * t[i] * den - (2 * I + e)) / (den * den);
    B.gz[i] = dLdp * B.p[i] * (1 - B.p[i]);
  }
  if (withBce) {
    for (let i = 0; i < N; i += 1) {
      const p = Math.min(1 - 1e-7, Math.max(1e-7, B.p[i]));
      L -= (t[i] * Math.log(p) + (1 - t[i]) * Math.log(1 - p)) / N;
      B.gz[i] += (B.p[i] - t[i]) / N;
    }
  }
  return L;
}
function backward(n, x) {
  const { C, H, W, h2, w2, skip } = n;
  const B = n.buf;
  const dic = skip ? 2 * C : C;
  conv1bwd(B.a4, B.gz, C, 1, H * W, n.hd.w.v, n.hd.w.g, n.hd.b.g, B.ga4);
  dRelu(B.ga4, B.a4);
  conv3bwd(B.a3, B.ga4, C, C, H, W, n.d2.w.v, n.d2.w.g, n.d2.b.g, B.ga3);
  dRelu(B.ga3, B.a3);
  conv3bwd(B.cat, B.ga3, dic, C, H, W, n.d1.w.v, n.d1.w.g, n.d1.b.g, B.gcat);
  B.gup.set(B.gcat.subarray(0, C * H * W));
  B.ga2.fill(0);
  if (skip) for (let i = 0; i < C * H * W; i += 1) B.ga2[i] = B.gcat[C * H * W + i];
  upBwd(B.q2, B.gup, 2 * C, C, h2, w2, n.up.w.v, n.up.w.g, n.up.b.g, B.gq2);
  dRelu(B.gq2, B.q2);
  conv3bwd(B.q1, B.gq2, 2 * C, 2 * C, h2, w2, n.b2.w.v, n.b2.w.g, n.b2.b.g, B.gq1);
  dRelu(B.gq1, B.q1);
  conv3bwd(B.po, B.gq1, C, 2 * C, h2, w2, n.b1.w.v, n.b1.w.g, n.b1.b.g, B.gpo);
  const tmp = new AR(C * H * W);
  poolBwd(B.gpo, B.pi, C * h2 * w2, tmp);
  for (let i = 0; i < C * H * W; i += 1) B.ga2[i] += tmp[i];
  dRelu(B.ga2, B.a2);
  conv3bwd(B.a1, B.ga2, C, C, H, W, n.c2.w.v, n.c2.w.g, n.c2.b.g, B.ga1);
  dRelu(B.ga1, B.a1);
  conv3bwd(x, B.ga1, 1, C, H, W, n.c1.w.v, n.c1.w.g, n.c1.b.g, null);
}
const zeroGrad = (n) => { for (const p of n.params) p.g.fill(0); };
function adam(n, lr, t, scale) {
  for (const p of n.params) {
    for (let i = 0; i < p.v.length; i += 1) {
      const g = p.g[i] * scale;
      p.m[i] = 0.9 * p.m[i] + 0.1 * g;
      p.u[i] = 0.999 * p.u[i] + 0.001 * g * g;
      const mh = p.m[i] / (1 - 0.9 ** t);
      const vh = p.u[i] / (1 - 0.999 ** t);
      p.v[i] -= (lr * mh) / (Math.sqrt(vh) + 1e-8);
    }
  }
}

/* ---- data: S x S grayscale, 1-3 blobs, soft image edge, hard mask ---- */
function makeCase(S, rnd, small) {
  const img = new AR(S * S);
  const msk = new AR(S * S);
  const nb = small ? 1 : 1 + Math.floor(rnd() * 3);
  const blobs = [];
  for (let k = 0; k < nb; k += 1) {
    const r = small ? 1.0 + rnd() * 0.7 : 1.4 + rnd() * (S / 6 - 1.4);
    blobs.push([r + 1 + rnd() * (S - 2 * r - 2), r + 1 + rnd() * (S - 2 * r - 2), r]);
  }
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      let best = Infinity;
      for (const [cx, cy, r] of blobs) best = Math.min(best, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r);
      msk[y * S + x] = best <= 0 ? 1 : 0;
      img[y * S + x] = 0.6 / (1 + Math.exp(best / 0.7)) + 0.2 * rnd.gauss();
    }
  }
  return { img, msk };
}
/* pixels whose 3x3 neighbourhood straddles the true edge */
function edgeRing(t, S) {
  const r = new Uint8Array(S * S);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      let any = 0;
      let all = 1;
      for (let j = -1; j <= 1; j += 1) {
        for (let i = -1; i <= 1; i += 1) {
          const yy = y + j;
          const xx = x + i;
          const v = yy < 0 || yy >= S || xx < 0 || xx >= S ? 0 : t[yy * S + xx];
          if (v) any = 1; else all = 0;
        }
      }
      r[y * S + x] = any && !all ? 1 : 0;
    }
  }
  return r;
}
function evalSet(n, set) {
  const S = n.S;
  let d = 0;
  let db = 0;
  let nb = 0;
  let empty = 0;
  for (const { img, msk, ring } of set) {
    const p = forward(n, img);
    let I = 0;
    let sa = 0;
    let sb = 0;
    let rI = 0;
    let ra = 0;
    let rb = 0;
    for (let i = 0; i < S * S; i += 1) {
      const ph = p[i] >= 0.5 ? 1 : 0;
      if (ph && msk[i]) I += 1;
      if (ph) sa += 1;
      if (msk[i]) sb += 1;
      if (ring[i]) {
        if (ph && msk[i]) rI += 1;
        if (ph) ra += 1;
        if (msk[i]) rb += 1;
      }
    }
    d += sa + sb === 0 ? 1 : (2 * I) / (sa + sb);
    if (sa === 0 && sb > 0) empty += 1;
    if (ra + rb > 0) { db += (2 * rI) / (ra + rb); nb += 1; }
  }
  return [d / set.length, nb ? db / nb : NaN, empty / set.length];
}

function trainRun(S, C, skip, withBce, seed, epochs, nTrain, small, checkpoints) {
  const rnd = makeRng(seed);
  const mk = (k) => Array.from({ length: k }, () => {
    const c = makeCase(S, rnd, small);
    c.ring = edgeRing(c.msk, S);
    return c;
  });
  const tr = mk(nTrain);
  const va = mk(60);
  const net = buildNet(S, C, skip, rnd);
  const batch = 8;
  let t = 0;
  const out = {};
  const eps = [];
  for (let ep = 1; ep <= epochs; ep += 1) {
    const t0 = performance.now();
    const order = tr.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let b = 0; b < order.length; b += batch) {
      zeroGrad(net);
      const ids = order.slice(b, b + batch);
      for (const id of ids) {
        forward(net, tr[id].img);
        lossGrad(net, tr[id].msk, withBce);
        backward(net, tr[id].img);
      }
      t += 1;
      adam(net, 1e-3, t, 1 / ids.length);
    }
    eps.push(performance.now() - t0);
    if (checkpoints.includes(ep)) out[ep] = evalSet(net, va);
  }
  eps.sort((a, b) => a - b);
  out.ms = eps[Math.floor(eps.length / 2)]; /* median epoch: excludes the JIT warm-up */
  return out;
}

/* ---- gradient check ---- */
/* the activation pattern: ReLU signs plus maxpool argmaxes.  A central
 * difference taken across a change in this straddles a kink and is not a
 * derivative at all; without the guard the no-skip net read 4.2e-2 and looked
 * broken when it was not. */
function sigOf(n) {
  const B = n.buf;
  let h = 2166136261;
  const bits = (a) => { for (let i = 0; i < a.length; i += 1) h = (h * 31 + (a[i] > 0 ? 1 : 0)) >>> 0; };
  bits(B.a1); bits(B.a2); bits(B.q1); bits(B.q2); bits(B.a3); bits(B.a4);
  for (let i = 0; i < B.pi.length; i += 1) h = (h * 31 + B.pi[i]) >>> 0;
  return h;
}
function gradCheck(skip) {
  AR = Float64Array;
  const rnd = makeRng(3);
  const S = 4;
  const C = 2;
  const net = buildNet(S, C, skip, rnd);
  const { img, msk } = makeCase(S, rnd, false);
  zeroGrad(net);
  forward(net, img);
  lossGrad(net, msk, true);
  backward(net, img);
  const analytic = net.params.map((p) => Array.from(p.g));
  forward(net, img);
  const base = sigOf(net);
  let worst = 0;
  let checked = 0;
  let kinks = 0;
  const eps = 1e-5;
  for (let pi = 0; pi < net.params.length; pi += 1) {
    const p = net.params[pi];
    const step = Math.max(1, Math.floor(p.v.length / 4));
    for (let i = 0; i < p.v.length; i += step) {
      const old = p.v[i];
      p.v[i] = old + eps; forward(net, img); const sp = sigOf(net); const lp = lossGrad(net, msk, true);
      p.v[i] = old - eps; forward(net, img); const sm = sigOf(net); const lm = lossGrad(net, msk, true);
      p.v[i] = old;
      if (sp !== base || sm !== base) { kinks += 1; continue; }
      checked += 1;
      const fd = (lp - lm) / (2 * eps);
      const rel = Math.abs(fd - analytic[pi][i]) / Math.max(1e-8, Math.abs(fd) + Math.abs(analytic[pi][i]));
      if (rel > worst) worst = rel;
    }
  }
  AR = Float32Array;
  return { worst, checked, kinks };
}

function m4() {
  console.log("\n=== M4  tiny 2-level U-Net in plain JS (no batchnorm) ===");
  for (const sk of [true, false]) {
    const g = gradCheck(sk);
    console.log(`gradient check (S=4, C=2, float64, ${sk ? "with skip" : "no skip  "}): max rel err ${g.worst.toExponential(1)} over ${g.checked} coords, ${g.kinks} skipped at a kink`);
  }

  const CK = [5, 15, 30];
  const SEEDS = [1, 2, 3];

  console.log("\n-- skip vs no skip: S=16, C=4, 200 train / 60 val, batch 8, Dice+BCE --");
  console.log(`${pad("net", 10)} ${CK.map((e) => pad(`e${e} dice`, 9)).join(" ")} ${CK.map((e) => pad(`e${e} edge`, 9)).join(" ")}   ms/epoch`);
  const msRef = {};
  for (const skip of [true, false]) {
    const acc = { dice: {}, edge: {} };
    let ms = 0;
    for (const s of SEEDS) {
      const r = trainRun(16, 4, skip, true, s, 30, 200, false, CK);
      ms += r.ms;
      for (const e of CK) {
        acc.dice[e] = (acc.dice[e] || 0) + r[e][0] / SEEDS.length;
        acc.edge[e] = (acc.edge[e] || 0) + r[e][1] / SEEDS.length;
      }
    }
    msRef[skip ? "skip" : "noskip"] = ms / SEEDS.length;
    console.log(`${pad(skip ? "concat skip" : "no skip", 10)} ${CK.map((e) => pad(fx(acc.dice[e]), 9)).join(" ")} ${CK.map((e) => pad(fx(acc.edge[e]), 9)).join(" ")}   ${(ms / SEEDS.length).toFixed(0)}`);
  }

  console.log("\n-- loss on SMALL objects (1 blob, ~1-3% of pixels): S=16, C=4, with skip --");
  console.log(`${pad("loss", 10)} ${CK.map((e) => pad(`e${e} dice`, 9)).join(" ")} ${CK.map((e) => pad(`e${e} edge`, 9)).join(" ")} ${CK.map((e) => pad(`e${e} empty`, 10)).join(" ")}`);
  for (const bce of [false, true]) {
    const acc = { dice: {}, edge: {}, empty: {} };
    for (const s of SEEDS) {
      const r = trainRun(16, 4, true, bce, s, 30, 200, true, CK);
      for (const e of CK) {
        acc.dice[e] = (acc.dice[e] || 0) + r[e][0] / SEEDS.length;
        acc.edge[e] = (acc.edge[e] || 0) + r[e][1] / SEEDS.length;
        acc.empty[e] = (acc.empty[e] || 0) + r[e][2] / SEEDS.length;
      }
    }
    console.log(`${pad(bce ? "Dice+BCE" : "Dice", 10)} ${CK.map((e) => pad(fx(acc.dice[e]), 9)).join(" ")} ${CK.map((e) => pad(fx(acc.edge[e]), 9)).join(" ")} ${CK.map((e) => pad(`${(100 * acc.empty[e]).toFixed(0)}%`, 10)).join(" ")}`);
  }
  console.log("  (empty = share of the 60 val images predicted ENTIRELY background)");

  console.log("\n-- cost: ms per epoch, 200 images, batch 8 (median epoch of a 4-epoch probe; the skip row is the median of its own 30) --");
  console.log(`${pad("config", 14)} ${pad("ms/epoch", 9)} ${pad("30 epochs", 10)}`);
  const probes = [[16, 4, msRef.skip], [16, 8, null], [32, 4, null]];
  for (const [S, C, known] of probes) {
    const ms = known ?? trainRun(S, C, true, true, 1, 4, 200, false, []).ms;
    console.log(`${pad(`S=${S} C=${C}`, 14)} ${pad(ms.toFixed(0), 9)} ${pad(`${((30 * ms) / 1000).toFixed(1)} s`, 10)}`);
  }
}

m1();
m2();
m3();
m4();
