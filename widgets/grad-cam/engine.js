/* ============================================================================
   The plain-JS CNN engine for slot 64 `grad-cam`, written in the lab first.

   The catalogue's § The image arc says the engine is "born" in 64, the
   smallest of the two trained slots, and imported by 63. This file is that
   engine as a lab module: `_lab/gradcam-measure.mjs` runs it in node and
   `_lab/gradcam-mock.html` runs it in the browser, so the mock's every map is
   a trained one. When the widget is built the module moves to
   `widgets/grad-cam/engine.js` unchanged; nothing here reads a token, draws
   a rectangle or holds a string a reader sees.

   It generalises `_lab/dl-image-measure.mjs`'s two-block net to L blocks —
   conv 3 × 3 (stride 1, pad 1) → ReLU → max-pool 2 — then global average
   pooling and one linear layer, because the catalogue's M3 correction 3 asks
   for a third conv so the coarse layer's CAM is unmistakably blocky. The
   conv loops, the pooling, Adam and the Grad-CAM backward are the measure
   script's, whose gradients were checked against finite differences
   (2026-09-13); `gradCheck` below repeats the check on the L-block form.

   All randomness comes from a seeded rng with the core contract (`next`,
   `uniform`, `normal`, `shuffle`) — `widgets/core/rng.js` in the widget and
   in this lab.
   ========================================================================= */

const F = (n) => new Float64Array(n);

/* ------------------------------------------------------------ the images --- */

/** A bright square in the top-left corner: the lesson's watermark. */
export const CUE_VALUE = 1.0;
export const CUE_SIZE = 3;
/** the orientation marker's cells, as (up from the bottom row, across from
    the left), and its brightness */
export const MARKER_L = [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2]];
export const MARKER_VALUE = 0.93;
/** the bottom-left square the marker and its margin occupy, in pixels */
export const MARKER_BOX = 4;

/**
 * Widget 61's cell, re-drawn for a classification task: the same values —
 * field 0.24, body 0.60, membrane 0.93, nucleus 0.30 — with the geometry
 * jittered in position and size, and a brightness scale so that total
 * brightness is not the answer. `spec` says what THIS class's cell is:
 *   aspect    the cell's long axis over its short one, at the same area
 *   nuclei    how many nuclei (0, 1, 2)
 *   nR        the nucleus radius range, in units of S / 28
 *   offset    where the nucleus is, as a fraction of the reach from the
 *             centre to the membrane: [0, 0.25] central, [0.75, 1] eccentric
 *   granules  three bright granules instead of (or as well as) a nucleus
 *   nucleusValue  0.30 dark, 0.97 bright
 * The membrane is sub-pixel at 16 × 16 and survives as partial brightness
 * through 2 × 2 supersampling, the way the measure script's shapes do.
 */
function cellImage(S, rng, spec, { bright = [0.6, 1.0] } = {}) {
  const {
    aspect = 1, nuclei = 1, nR: nRange = [3.4, 4.8], offset = [0, 1], granules = false, nucleusValue = 0.30,
    /** a ghost: the membrane alone, `inside` showing through it (the field's
        0.24, or darker) */
    ghost = false, inside = 0.24,
    /** the field's brightness — a batch effect when it differs by class */
    field = 0.24,
    /** the membrane's thickness over 61's 1.1 units */
    ringScale = 1,
  } = spec;
  const u = S / 28;
  let r = rng.uniform(7.6, 10.4) * u;
  const ring = 1.1 * u * ringScale;
  const a = Math.sqrt(aspect);          // semi-axes r·a and r/a: the same area
  const ang = aspect === 1 ? 0 : rng.uniform(0, Math.PI);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  /* THE CELL KEEPS CLEAR OF THE MARKER'S CORNER (Kenneth, 2026-09-15: "ensure
     the label is not overlapping any cell or ghost"). The marker is the
     bottom-left MARKER_BOX cells; a placement whose outer edge reaches that
     box is redrawn, and the cell shrinks a little each time so a large one
     cannot loop forever. */
  let cx = 0;
  let cy = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const reachX = r * a;
    cx = rng.uniform(reachX + 0.5, S - 0.5 - reachX);
    cy = rng.uniform(reachX + 0.5, S - 0.5 - reachX);
    const nx = Math.max(0, Math.min(MARKER_BOX, cx));
    const ny = Math.max(S - MARKER_BOX, Math.min(S, cy));
    if (Math.hypot(cx - nx, cy - ny) > reachX + 0.75) break;
    if (attempt % 4 === 3) r = Math.max(6.5 * u, r - 0.4 * u);
  }
  /* the ellipse's "radius" at a point: 1 on the membrane's outer edge */
  const rho = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const px = (dx * cs + dy * sn) / (r * a);
    const py = (-dx * sn + dy * cs) / (r / a);
    return Math.sqrt(px * px + py * py);
  };
  const nucs = [];
  for (let i = 0; i < nuclei; i += 1) {
    const nR = rng.uniform(nRange[0], nRange[1]) * u;
    const reach = Math.max(0, r / a - ring - nR - 0.3 * u);
    const f = rng.uniform(offset[0], offset[1]);
    /* two nuclei sit on opposite sides so they do not merge */
    const th = i === 0 ? rng.uniform(0, 2 * Math.PI) : nucs[0].th + Math.PI + rng.uniform(-0.4, 0.4);
    const d0 = nuclei === 2 ? Math.max(f * reach, nR * 0.9) : f * reach;
    nucs.push({ x: cx + d0 * Math.cos(th), y: cy + d0 * Math.sin(th), R: nR, th });
  }
  const gran = [];
  if (granules) {
    for (let i = 0; i < 3; i += 1) {
      const t = rng.uniform(0, 2 * Math.PI);
      const dd = rng.uniform(0, Math.max(0, r / a - ring - 1.5 * u));
      gran.push([cx + dd * Math.cos(t), cy + dd * Math.sin(t), 1.35 * u]);
    }
  }
  const scale = rng.uniform(bright[0], bright[1]);
  const at = (x, y) => {
    const q = rho(x, y);
    if (q >= 1) return { v: field, part: 0 };
    if (q > 1 - ring / r) return { v: 0.93, part: 2 };
    for (const n of nucs) if (Math.hypot(x - n.x, y - n.y) < n.R) return { v: nucleusValue, part: 3 };
    for (const g of gran) if (Math.hypot(x - g[0], y - g[1]) < g[2]) return { v: 0.97, part: 3 };
    return ghost ? { v: inside, part: 1 } : { v: 0.60, part: 1 };
  };
  const img = F(S * S);
  const mask = F(S * S);   // the cell's footprint
  const nuc = F(S * S);    // the nucleus (or the granules) alone
  for (let py = 0; py < S; py += 1) {
    for (let px = 0; px < S; px += 1) {
      let v = 0;
      let m = 0;
      let n = 0;
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          const s = at(px + 0.25 + 0.5 * sx, py + 0.25 + 0.5 * sy);
          v += 0.25 * s.v;
          if (s.part > 0) m += 0.25;
          if (s.part === 3) n += 0.25;
        }
      }
      const i = py * S + px;
      img[i] = field + (v - field) * scale;
      mask[i] = m;
      nuc[i] = n;
    }
  }
  return { img, mask, nuc };
}

/** What each class's cell is, by task; index 0 is the class the cue goes on by default. */
export const CELL_TASKS = {
  cell:     [{ nuclei: 1 }, { nuclei: 0 }],
  granule:  [{ nuclei: 1 }, { nuclei: 0, granules: true }],
  bright:   [{ nuclei: 1, nucleusValue: 0.97 }, { nuclei: 0, granules: true }],
  elong:    [{ nuclei: 1, aspect: 1 }, { nuclei: 1, aspect: 2.2 }],
  position: [{ nuclei: 1, offset: [0, 0.25] }, { nuclei: 1, offset: [0.75, 1] }],
  size:     [{ nuclei: 1, nR: [2.4, 3.2] }, { nuclei: 1, nR: [4.8, 5.8] }],
  count:    [{ nuclei: 1, nR: [3.0, 3.8] }, { nuclei: 2, nR: [3.0, 3.8], offset: [0.6, 1] }],
  /* the DISC / RING contrast in the cell's own palette: a filled cell against
     its membrane alone */
  ghost:    [{ nuclei: 0 }, { nuclei: 0, ghost: true }],
  ghostn:   [{ nuclei: 1 }, { nuclei: 0, ghost: true }],
  /* a ghost with evidence of its own: an interior darker than the field, a
     thicker membrane, or both */
  hole:     [{ nuclei: 0 }, { nuclei: 0, ghost: true, inside: 0.08 }],
  thick:    [{ nuclei: 0 }, { nuclei: 0, ghost: true, ringScale: 1.8 }],
  holethick: [{ nuclei: 0 }, { nuclei: 0, ghost: true, inside: 0.08, ringScale: 1.8 }],
  holen:    [{ nuclei: 1 }, { nuclei: 0, ghost: true, inside: 0.08 }],
  holen16:  [{ nuclei: 1 }, { nuclei: 0, ghost: true, inside: 0.16 }],
  holen12:  [{ nuclei: 1 }, { nuclei: 0, ghost: true, inside: 0.12 }],
};

/** The measure script's DISC and RING, on a dark field. */
function shapeImage(S, rng, kind, { bright = [0.6, 1.0] } = {}) {
  const sc = S / 16;
  const r = rng.uniform(3.0, 4.6) * sc;
  const t = 1.0 * sc;
  const cx = rng.uniform(r + 1, S - 1 - r);
  const cy = rng.uniform(r + 1, S - 1 - r);
  const inside = (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return kind === 0 ? d <= r : Math.abs(d - r) <= t;
  };
  const b = rng.uniform(bright[0], bright[1]);
  const img = F(S * S);
  const mask = F(S * S);
  for (let py = 0; py < S; py += 1) {
    for (let px = 0; px < S; px += 1) {
      let acc = 0;
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          if (inside(px + 0.25 + 0.5 * sx, py + 0.25 + 0.5 * sy)) acc += 0.25;
        }
      }
      const i = py * S + px;
      mask[i] = acc;
      img[i] = b * acc;
    }
  }
  return { img, mask, nuc: mask };
}

/**
 * n images of side S, classes alternating so every prefix of even length is
 * balanced. `task` is "cell" or "shapes". The cue is planted on class 0 of
 * the TRAINING images at `cueRate`; `cueAll` plants it on every image, which
 * is how a cued test set is made.
 */
export function makeSet(task, n, S, rng, {
  cueRate = 0, cueAll = false, noise = 0.08, cueClass = 0, cueValue = CUE_VALUE, cueSize = CUE_SIZE, bright = [0.6, 1.0],
  /** a rate per class, which overrides `cueClass` / `cueRate`: [cells, ghosts] */
  cueRates = null,
  /** an orientation marker — a 3 × 3 "L" in the bottom-left corner — on EVERY
      image, at the brightness of the membrane; it says nothing about the class */
  marker = false,
} = {}) {
  const x = F(n * S * S);
  const y = new Int32Array(n);
  const masks = [];
  const nucs = [];
  const cued = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const k = i % 2;
    y[i] = k;
    const specs = Array.isArray(task) ? task : CELL_TASKS[task];
    const { img, mask, nuc } = task === "shapes" ? shapeImage(S, rng, k, { bright })
      : cellImage(S, rng, specs[k], { bright });
    masks.push(mask);
    nucs.push(nuc);
    const off = i * S * S;
    for (let j = 0; j < S * S; j += 1) x[off + j] = Math.max(0, Math.min(1, img[j] + noise * rng.normal()));
    if (marker) {
      for (const [dy, dx] of MARKER_L) x[off + (S - 2 - dy) * S + 1 + dx] = MARKER_VALUE;
    }
    const rate = cueRates ? cueRates[k] : (k === cueClass ? cueRate : 0);
    const cue = cueAll || rng.next() < rate;
    if (cue) {
      cued[i] = 1;
      for (let py = 0; py < cueSize; py += 1) {
        for (let px = 0; px < cueSize; px += 1) x[off + py * S + px] = cueValue;
      }
    }
  }
  return { x, y, masks, nucs, cued, n, S, task };
}

/* --------------------------------------------------------------- layers --- */

/* conv 3 × 3, stride 1, pad 1. Loop order (out channel, in channel, tap) so
 * the innermost loop is a contiguous scaled add. */
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

/* dW/db may be null (no parameter gradient wanted); dx may be null (first layer) */
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

/* max-pool 2 × 2 stride 2; an odd H floors, as torch's MaxPool2d(2) does */
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

/**
 * `chans[i]` is block i's output channels; the input has one channel. Weights
 * follow torch's default for Conv2d and Linear: U(−1/√fan_in, +1/√fan_in).
 */
export function makeNet(S, chans, K, rng) {
  const uni = (n, fanIn) => {
    const k = 1 / Math.sqrt(fanIn);
    const a = F(n);
    for (let i = 0; i < n; i += 1) a[i] = rng.uniform(-k, k);
    return a;
  };
  const blocks = [];
  let H = S;
  let Cin = 1;
  for (let i = 0; i < chans.length; i += 1) {
    const C = chans[i];
    blocks.push({ Cin, C, H, Ho: H >> 1, W: uni(C * Cin * 9, Cin * 9), b: uni(C, Cin * 9) });
    H >>= 1;
    Cin = C;
  }
  const Cl = chans[chans.length - 1];
  return { S, K, chans, blocks, Cl, Wh: uni(K * Cl, Cl), bh: uni(K, Cl) };
}

export function makeWork(net) {
  const bl = net.blocks.map((b) => ({
    a: F(b.C * b.H * b.H),
    p: F(b.C * b.Ho * b.Ho),
    idx: new Int32Array(b.C * b.Ho * b.Ho),
    da: F(b.C * b.H * b.H),
    dp: F(b.C * b.Ho * b.Ho),
  }));
  return { bl, g: F(net.Cl), logits: F(net.K), prob: F(net.K) };
}

export function forward(net, w, x, off) {
  let src = x;
  let soff = off;
  for (let i = 0; i < net.blocks.length; i += 1) {
    const b = net.blocks[i];
    const wb = w.bl[i];
    convFwd(src, soff, b.Cin, b.H, b.W, b.b, b.C, wb.a);
    for (let j = 0; j < wb.a.length; j += 1) if (wb.a[j] < 0) wb.a[j] = 0;
    poolFwd(wb.a, b.C, b.H, wb.p, wb.idx);
    src = wb.p;
    soff = 0;
  }
  const last = net.blocks[net.blocks.length - 1];
  const area = last.Ho * last.Ho;
  const p = w.bl[w.bl.length - 1].p;
  for (let c = 0; c < net.Cl; c += 1) {
    let s = 0;
    for (let i = 0; i < area; i += 1) s += p[c * area + i];
    w.g[c] = s / area;
  }
  let mx = -Infinity;
  for (let k = 0; k < net.K; k += 1) {
    let s = net.bh[k];
    for (let c = 0; c < net.Cl; c += 1) s += net.Wh[k * net.Cl + c] * w.g[c];
    w.logits[k] = s;
    if (s > mx) mx = s;
  }
  let Z = 0;
  for (let k = 0; k < net.K; k += 1) { w.prob[k] = Math.exp(w.logits[k] - mx); Z += w.prob[k]; }
  for (let k = 0; k < net.K; k += 1) w.prob[k] /= Z;
  return w;
}

/* the backward pass from a gradient on the pooled channels `dg`, down to
 * every block's post-ReLU activation (`da`, unmasked) and, if `grads` is
 * given, into the parameter gradients */
function backwardFromHead(net, w, x, off, dg, grads) {
  const L = net.blocks.length;
  const last = net.blocks[L - 1];
  const area = last.Ho * last.Ho;
  const wl = w.bl[L - 1];
  for (let c = 0; c < net.Cl; c += 1) {
    const v = dg[c] / area;
    for (let i = 0; i < area; i += 1) wl.dp[c * area + i] = v;
  }
  for (let i = L - 1; i >= 0; i -= 1) {
    const b = net.blocks[i];
    const wb = w.bl[i];
    wb.da.fill(0);
    poolBwd(wb.dp, wb.idx, b.C * b.Ho * b.Ho, wb.da);
    const dz = grads ? wb.da : wb.da.slice();   // Grad-CAM keeps da unmasked
    for (let j = 0; j < dz.length; j += 1) if (wb.a[j] <= 0) dz[j] = 0;
    const src = i === 0 ? x : w.bl[i - 1].p;
    const soff = i === 0 ? off : 0;
    const dx = i === 0 ? null : w.bl[i - 1].dp;
    if (dx) dx.fill(0);
    convBwd(src, soff, dz, b.Cin, b.H, b.W, b.C,
      grads ? grads.blocks[i].W : null, grads ? grads.blocks[i].b : null, dx);
  }
}

/* accumulates scale · d(cross-entropy)/d(params) into grads */
export function backwardCE(net, w, x, off, y, grads, scale) {
  const dg = F(net.Cl);
  for (let k = 0; k < net.K; k += 1) {
    const dz = (w.prob[k] - (k === y ? 1 : 0)) * scale;
    grads.bh[k] += dz;
    for (let c = 0; c < net.Cl; c += 1) {
      grads.Wh[k * net.Cl + c] += dz * w.g[c];
      dg[c] += dz * net.Wh[k * net.Cl + c];
    }
  }
  backwardFromHead(net, w, x, off, dg, grads);
}

/** ∂y^c/∂A for every block, A the post-ReLU feature maps — Grad-CAM's backward. */
export function backwardScore(net, w, x, off, cls) {
  const dg = F(net.Cl);
  for (let c = 0; c < net.Cl; c += 1) dg[c] = net.Wh[cls * net.Cl + c];
  backwardFromHead(net, w, x, off, dg, null);
  return w.bl.map((wb) => wb.da);
}

/* ------------------------------------------------------------------ adam --- */

export function makeOpt(net) {
  const grads = {
    blocks: net.blocks.map((b) => ({ W: F(b.W.length), b: F(b.b.length) })),
    Wh: F(net.Wh.length),
    bh: F(net.bh.length),
  };
  const slots = [];
  net.blocks.forEach((b, i) => {
    slots.push({ p: b.W, g: grads.blocks[i].W });
    slots.push({ p: b.b, g: grads.blocks[i].b });
  });
  slots.push({ p: net.Wh, g: grads.Wh });
  slots.push({ p: net.bh, g: grads.bh });
  for (const s of slots) { s.m = F(s.p.length); s.v = F(s.p.length); }
  return { slots, grads, t: 0 };
}

export function adamStep(opt, lr) {
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

export function evaluate(net, w, set) {
  const area = net.S * net.S;
  let hit = 0;
  for (let i = 0; i < set.n; i += 1) {
    forward(net, w, set.x, i * area);
    let best = 0;
    for (let k = 1; k < net.K; k += 1) if (w.prob[k] > w.prob[best]) best = k;
    if (best === set.y[i]) hit += 1;
  }
  return hit / set.n;
}

export function train(net, set, { epochs, batch = 16, lr = 1e-3, rng, onEpoch = null }) {
  const w = makeWork(net);
  const opt = makeOpt(net);
  const area = net.S * net.S;
  const order = Array.from({ length: set.n }, (_, i) => i);
  const losses = [];
  for (let ep = 1; ep <= epochs; ep += 1) {
    rng.shuffle(order);
    let L = 0;
    for (let b = 0; b < order.length; b += batch) {
      const end = Math.min(order.length, b + batch);
      const scale = 1 / (end - b);
      for (let j = b; j < end; j += 1) {
        const i = order[j];
        forward(net, w, set.x, i * area);
        L -= Math.log(w.prob[set.y[i]] + 1e-300);
        backwardCE(net, w, set.x, i * area, set.y[i], opt.grads, scale);
      }
      adamStep(opt, lr);
    }
    losses.push(L / set.n);
    if (onEpoch) onEpoch(ep, net, w);
  }
  return { w, losses };
}

/* -------------------------------------------------------------- Grad-CAM --- */

/**
 * The four steps of the method for one image, one class and one block, with
 * every intermediate kept for the drawing: the feature maps `acts` (A^k),
 * the gradient maps `grads` (∂y^c/∂A^k), the weights `alpha` (their means),
 * the weighted sum `sum` before ReLU, the `cam` after it scaled to 1 at its
 * peak, and `up` the nearest-neighbour upsample to S × S.
 *
 * Runs the forward pass, so `w` holds this image's activations afterwards.
 */
export function gradcam(net, w, x, off, cls, block) {
  forward(net, w, x, off);
  const das = backwardScore(net, w, x, off, cls);
  const b = net.blocks[block];
  const H = b.H;
  const area = H * H;
  const acts = w.bl[block].a.slice();
  const grads = das[block].slice();
  const alpha = F(b.C);
  const sum = F(area);
  for (let c = 0; c < b.C; c += 1) {
    let a = 0;
    for (let i = 0; i < area; i += 1) a += grads[c * area + i];
    a /= area;
    alpha[c] = a;
    for (let i = 0; i < area; i += 1) sum[i] += a * acts[c * area + i];
  }
  const cam = F(area);
  let mx = 0;
  for (let i = 0; i < area; i += 1) { cam[i] = Math.max(0, sum[i]); if (cam[i] > mx) mx = cam[i]; }
  if (mx > 0) for (let i = 0; i < area; i += 1) cam[i] /= mx;
  const S = net.S;
  const up = F(S * S);
  const f = S / H;
  for (let y = 0; y < S; y += 1) {
    for (let xx = 0; xx < S; xx += 1) {
      up[y * S + xx] = cam[Math.min(H - 1, Math.floor(y / f)) * H + Math.min(H - 1, Math.floor(xx / f))];
    }
  }
  return { block, cls, H, C: b.C, acts, grads, alpha, sum, cam, up, peak: mx };
}

/** Where the heat is: its share inside `mask`, and inside the cue's corner. */
export function heatShare(up, S, mask, corner = 4) {
  let total = 0;
  let inMask = 0;
  let inCorner = 0;
  let inQuarter = 0;
  let maskArea = 0;
  const q = S >> 1;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const v = up[y * S + x];
      total += v;
      if (mask[y * S + x] > 0.5) { inMask += v; maskArea += 1; }
      if (y < corner && x < corner) inCorner += v;
      if (y < q && x < q) inQuarter += v;
    }
  }
  return {
    object: total > 0 ? inMask / total : 0,
    corner: total > 0 ? inCorner / total : 0,
    /** the top-left quarter: what a coarse map's corner cell covers once its
        receptive field is counted */
    quarter: total > 0 ? inQuarter / total : 0,
    objectArea: maskArea / (S * S),
    cornerArea: (corner * corner) / (S * S),
  };
}

/** The predicted class of the image the last forward pass ran on. */
export const argmax = (w) => {
  let best = 0;
  for (let k = 1; k < w.prob.length; k += 1) if (w.prob[k] > w.prob[best]) best = k;
  return best;
};

/* ------------------------------------------------------- gradient check --- */

/** Max relative error of the analytic gradient against central differences. */
export function gradCheck(rng, { S = 8, chans = [2, 3, 2], K = 2 } = {}) {
  const net = makeNet(S, chans, K, rng);
  const set = makeSet("cell", 2, S, rng);
  const w = makeWork(net);
  const opt = makeOpt(net);
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
    backwardCE(net, w, set.x, i * S * S, set.y[i], opt.grads, 1 / set.n);
  }
  const analytic = opt.slots.map((s) => s.g.slice());
  let worst = 0;
  let count = 0;
  const eps = 1e-5;
  opt.slots.forEach((s, si) => {
    const p = s.p;
    for (let i = 0; i < p.length; i += 1) {
      const o = p[i];
      p[i] = o + eps; const lp = loss();
      p[i] = o - eps; const lm = loss();
      p[i] = o;
      const num = (lp - lm) / (2 * eps);
      const an = analytic[si][i];
      const rel = Math.abs(num - an) / Math.max(1e-6, Math.abs(num) + Math.abs(an));
      if (rel > worst) worst = rel;
      count += 1;
    }
  });
  /* and the score gradient: ∂logit_c/∂A^k for the LAST block against differences */
  let worstCam = 0;
  {
    const cls = 0;
    forward(net, w, set.x, 0);
    const das = backwardScore(net, w, set.x, 0, cls);
    const L = net.blocks.length - 1;
    const b = net.blocks[L];
    const wb = w.bl[L];
    /* perturb the post-ReLU map by hand: re-run pool + head from `a` */
    const headFrom = (a) => {
      const p = F(b.C * b.Ho * b.Ho);
      const idx = new Int32Array(p.length);
      poolFwd(a, b.C, b.H, p, idx);
      const area = b.Ho * b.Ho;
      let s = net.bh[cls];
      for (let c = 0; c < net.Cl; c += 1) {
        let g = 0;
        for (let i = 0; i < area; i += 1) g += p[c * area + i];
        s += net.Wh[cls * net.Cl + c] * (g / area);
      }
      return s;
    };
    const a = wb.a.slice();
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] <= 0) continue;   // a zero activation is not on the pooled path
      const o = a[i];
      a[i] = o + eps; const lp = headFrom(a);
      a[i] = o - eps; const lm = headFrom(a);
      a[i] = o;
      const num = (lp - lm) / (2 * eps);
      const an = das[L][i];
      const rel = Math.abs(num - an) / Math.max(1e-6, Math.abs(num) + Math.abs(an));
      if (rel > worstCam) worstCam = rel;
    }
  }
  return { worst, count, worstCam };
}
