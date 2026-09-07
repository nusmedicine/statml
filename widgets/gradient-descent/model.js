/* ============================================================================
   Widget 48 · Gradient Descent — the engine.

   PHM5005 05-2 cells 73-78 are the worked example this reproduces: x =
   linspace(0, 10, 100), y = 5 + 2x + N(0, 1), the mean squared error, plain
   gradient descent from (0, 0) at lr 0.01 for 1000 epochs. 05-1 cell 4 writes
   the update rule; 05-4 cell 41 says too high is unstable and too low is slow;
   05-4 cell 5 says batches give less noisy gradients.

   THE LESSON'S NOISE IS UNSEEDED (`torch.normal` with no generator), so no
   printed digit of it is reproducible and this file draws its own from the
   widget's seeded rng. Nothing is pinned to the notebook's output; what is
   pinned is the ALGEBRA, and `_lab/gd-verify.mjs` asserts it.

   WHY THE QUADRATIC IS CLOSED FORM. Mean squared error over (b0, b1) is a
   quadratic, so five sums over the data give the loss, the gradient, the
   least-squares minimum, the least loss and the two Hessian eigenvalues with
   no iteration and O(1) per evaluation. That is what makes a 64x64 contour
   grid and a per-pixel surface ramp affordable. Widget 27's `ssQuad` is the
   same idea on the sum of squares; this one divides by n, because the lesson's
   loss is the MEAN and the learning rates below are only meaningful against
   that scaling.

   MEASURED (`_lab/dl-gd-measure.mjs`, and re-asserted in `_lab/gd-verify.mjs`
   so the numbers the widget prints on screen cannot drift away from the
   engine):

     raw x            curvatures 68.5 and 0.50, condition 138; stable lr < 0.029
     standardized x   curvatures 2 and 2;                      stable lr < 1
     raw, lr 0.03     diverges at epoch 274
     raw, lr 0.05     diverges at epoch 17
     raw, lr 0.01     b0 5.17, b1 1.97 after 1000 epochs (least squares 5.20, 1.97)
     standardized     lr 0.5 lands on the minimum in ONE step (the step is
                      exactly 1/curvature), lr 1 alternates for ever, lr 3 blows up

   The curvatures depend on x ALONE — the Hessian of the mean squared error is
   2 * [[1, mean x], [mean x, mean x^2]], with no y in it — so 68.5 / 0.50 and
   2 / 2 are exact facts about the design, not a property of one seeded draw,
   and the `scale` control's on-screen copy may state them.

   WHY THE WHOLE TRAJECTORY IS STORED. compute() is pure and runs on parameter
   change only (1.4); the animation reveals epochs already walked. At batch 1
   that is 1000 epochs x 100 updates = 100k positions, held as four
   Float64Arrays (b0, b1 and the two partials used for each step) — 3.2 MB and
   ~15 ms to build. The loss is NOT stored per update: it is O(1) from (b0, b1)
   and recomputing it costs less than the array.
   ========================================================================= */

export const N = 100;
export const EPOCHS = 1000;

/* The ladder Kenneth picked: it holds the lesson's 0.01, a value raw x
   diverges at (0.03, just over 2/68.5 = 0.029) and a value standardized x
   diverges at (3, over 2/2 = 1). At 1 the standardized walk alternates about
   the minimum for ever without shrinking — 1 - lr * curvature is exactly -1. */
export const LR_LADDER = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
export const BATCHES = [100, 10, 1];

/* The surface ramp is log10 of the loss as a multiple of the least loss,
   capped at 10^2.5 = 316x. NOT widget 27's 3x cap: the walk starts at ~270x
   the least loss and enters the trench at ~8x, so a 3x ramp would paint the
   entire opening of every walk in one flat band. Contour lines at fixed
   RATIOS carry the rest, and their spacing is what makes the trench legible. */
export const LOG_CAP = 2.5;
export const LEVELS = [1.05, 1.2, 1.5, 2, 3, 5, 10, 20, 50, 100, 200];

/* |b| past this, or non-finite, is divergence. Far enough out that no
   legitimate walk on either scale reaches it, near enough that the loss at it
   is still a finite double. */
const BLOWUP = 1e6;

/** The lesson's own data: x evenly spaced on [0, 10], y = 5 + 2x + N(0, 1). */
export function makeData(rng) {
  const x = new Array(N);
  const y = new Array(N);
  for (let i = 0; i < N; i += 1) {
    x[i] = (10 * i) / (N - 1);
    y[i] = 5 + 2 * x[i] + rng.normal(0, 1);
  }
  return { x, y };
}

/** x centred and divided by its standard deviation — 05-2's own reduction. */
export function standardize(x) {
  const n = x.length;
  let mx = 0;
  for (const v of x) mx += v;
  mx /= n;
  let ss = 0;
  for (const v of x) ss += (v - mx) ** 2;
  const sd = Math.sqrt(ss / n);
  return x.map((v) => (v - mx) / sd);
}

/**
 * The mean squared error over (b0, b1) as a closed quadratic, plus everything
 * that follows from it in one place (5.8): the gradient, the least-squares
 * point, the least loss, the two curvatures of the surface, and the curvature
 * of the b1 slice the one-parameter page walks down.
 *
 * Expanding (b0 + b1 x - y)^2 and summing:
 *   n L = Syy - 2 b0 Sy - 2 b1 Sxy + n b0^2 + 2 b0 b1 Sx + b1^2 Sxx
 * `Lmin` is deliberately taken from an explicit residual loop rather than from
 * that expansion: at the minimum the expansion is a difference of large nearly
 * equal terms, and every ratio the widget prints is divided by this number.
 */
export function quad(xs, y) {
  const n = xs.length;
  let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0, Syy = 0;
  for (let i = 0; i < n; i += 1) {
    Sx += xs[i];
    Sy += y[i];
    Sxx += xs[i] * xs[i];
    Sxy += xs[i] * y[i];
    Syy += y[i] * y[i];
  }
  const loss = (b0, b1) =>
    (Syy - 2 * b0 * Sy - 2 * b1 * Sxy + n * b0 * b0 + 2 * b0 * b1 * Sx + b1 * b1 * Sxx) / n;
  const grad = (b0, b1) => [
    (2 * (n * b0 + b1 * Sx - Sy)) / n,
    (2 * (b0 * Sx + b1 * Sxx - Sxy)) / n,
  ];

  const B1 = (Sxy - (Sx * Sy) / n) / (Sxx - (Sx * Sx) / n);
  const B0 = (Sy - B1 * Sx) / n;
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += (B0 + B1 * xs[i] - y[i]) ** 2;
  const Lmin = ss / n;

  /* Hessian 2 * [[1, mean x], [mean x, mean x^2]] — no y in it, so the two
     curvatures are a fact about the design alone. */
  const tr = 2 + (2 * Sxx) / n;
  const det = (4 * Sxx) / n - ((2 * Sx) / n) ** 2;
  const gap = Math.sqrt(Math.max(0, tr * tr - 4 * det));

  return {
    xs, y, n, loss, grad, B0, B1, Lmin,
    lmax: (tr + gap) / 2,
    lmin: (tr - gap) / 2,
    curvB1: (2 * Sxx) / n,
  };
}

/**
 * The window every surface is drawn in: wide enough to hold the start at
 * (0, 0) and the least-squares point, with air past both. Fixed for the whole
 * walk (2.5) — a divergent path leaves it and is clipped, and the caption says
 * at which epoch rather than the frame chasing it.
 */
export function domainFor(q) {
  return {
    b0: [Math.min(0, q.B0) - 1, Math.max(0, q.B0) + 4],
    b1: [Math.min(0, q.B1) - 0.5, Math.max(0, q.B1) + 1.5],
  };
}

/**
 * Contour lines of log10(loss / least loss) at the fixed ratios in LEVELS, by
 * marching squares over a G x G grid. Returned as segments in PARAMETER
 * coordinates, so the caller maps them wherever it is drawing — the surface
 * bitmap is in device pixels and the plot is in CSS pixels, and geometry that
 * knew which would have to be computed twice.
 */
export function contourSegments(q, dom, levels = LEVELS, G = 64) {
  const cols = [];
  for (let i = 0; i <= G; i += 1) {
    const b0 = dom.b0[0] + (i / G) * (dom.b0[1] - dom.b0[0]);
    const col = new Float64Array(G + 1);
    for (let j = 0; j <= G; j += 1) {
      const b1 = dom.b1[0] + (j / G) * (dom.b1[1] - dom.b1[0]);
      col[j] = Math.log10(Math.max(1, q.loss(b0, b1) / q.Lmin));
    }
    cols.push(col);
  }
  const bx = (i) => dom.b0[0] + (i / G) * (dom.b0[1] - dom.b0[0]);
  const by = (j) => dom.b1[0] + (j / G) * (dom.b1[1] - dom.b1[0]);
  const segs = [];
  for (const level of levels) {
    const lv = Math.log10(level);
    for (let i = 0; i < G; i += 1) {
      for (let j = 0; j < G; j += 1) {
        const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const pts = [];
        for (let k = 0; k < 4; k += 1) {
          const a = corners[k];
          const b = corners[(k + 1) % 4];
          const va = cols[a[0]][a[1]];
          const vb = cols[b[0]][b[1]];
          if ((va < lv) !== (vb < lv)) {
            const t = (lv - va) / (vb - va);
            pts.push([bx(a[0] + (b[0] - a[0]) * t), by(a[1] + (b[1] - a[1]) * t)]);
          }
        }
        for (let k = 0; k + 1 < pts.length; k += 2) {
          segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
        }
      }
    }
  }
  return segs;
}

/* --- the walk ------------------------------------------------------------ */

/* One record shape for all three walks, so the drawing code branches on the
   page and never on which function produced the track.

   `b0`/`b1` hold the position after every UPDATE (one per epoch at full batch,
   ten at batch 10, a hundred at batch 1). `g0`/`g1` at index k are the partial
   derivatives used to leave index k — recorded rather than recovered from the
   two positions, because at lr 0.001 the difference of two positions is a
   cancellation that loses most of the digits the readout prints. The last
   entry holds the partials AT the final point, which is what the readout wants
   once the walk has stopped.

   `epochAt[e]` indexes the position after e epochs, `epochLoss[e]` its loss.
   Those two are per epoch and stay small (1001 entries) even when the update
   arrays hold 100k. */
function newTrack(cap, epochs) {
  return {
    b0: new Float64Array(cap),
    b1: new Float64Array(cap),
    g0: new Float64Array(cap),
    g1: new Float64Array(cap),
    len: 0,
    epochAt: new Int32Array(epochs + 1),
    epochLoss: new Float64Array(epochs + 1),
    perEpoch: 1,
    epochsDone: 0,
    diverged: null,
  };
}

const blown = (b0, b1) =>
  !Number.isFinite(b0) || !Number.isFinite(b1) || Math.abs(b0) > BLOWUP || Math.abs(b1) > BLOWUP;

/* The diverged point IS recorded, then the walk stops. Widget 27's surface
   never leaves its frame; this one must, because "the path leaves the picture"
   is the claim. Clipping happens where it is drawn. */
function finish(t, q) {
  const k = t.len - 1;
  const [g0, g1] = q.grad(t.b0[k], t.b1[k]);
  t.g0[k] = Number.isFinite(g0) ? g0 : 0;
  t.g1[k] = Number.isFinite(g1) ? g1 : 0;
  return t;
}

/** Full-batch descent from (0, 0): the gradient over all n rows, once per epoch. */
export function descendFull(q, lr, epochs) {
  const t = newTrack(epochs + 1, epochs);
  let b0 = 0;
  let b1 = 0;
  t.b0[0] = b0;
  t.b1[0] = b1;
  t.len = 1;
  t.epochLoss[0] = q.loss(b0, b1);
  for (let e = 0; e < epochs; e += 1) {
    const [g0, g1] = q.grad(b0, b1);
    t.g0[t.len - 1] = g0;
    t.g1[t.len - 1] = g1;
    b0 -= lr * g0;
    b1 -= lr * g1;
    t.b0[t.len] = b0;
    t.b1[t.len] = b1;
    t.len += 1;
    t.epochAt[e + 1] = t.len - 1;
    t.epochLoss[e + 1] = q.loss(b0, b1);
    if (blown(b0, b1)) {
      t.diverged = e + 1;
      break;
    }
  }
  t.epochsDone = t.diverged ?? epochs;
  return finish(t, q);
}

/**
 * Mini-batch descent: each update's gradient is taken over `batch` rows only,
 * drawn without replacement from a seeded shuffle of the epoch. One epoch is
 * n / batch updates, and every one of them is recorded — the path's wobble is
 * the S in SGD and it lives between the epoch marks, not at them.
 */
export function descendMini(q, lr, epochs, batch, rng) {
  const n = q.n;
  const perEpoch = Math.ceil(n / batch);
  const t = newTrack(epochs * perEpoch + 1, epochs);
  t.perEpoch = perEpoch;
  let b0 = 0;
  let b1 = 0;
  t.b0[0] = b0;
  t.b1[0] = b1;
  t.len = 1;
  t.epochLoss[0] = q.loss(b0, b1);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let e = 0; e < epochs; e += 1) {
    const order = rng.shuffle(idx);
    for (let s = 0; s < n; s += batch) {
      const m = Math.min(batch, n - s);
      let g0 = 0;
      let g1 = 0;
      for (let k = 0; k < m; k += 1) {
        const i = order[s + k];
        const r = b0 + b1 * q.xs[i] - q.y[i];
        g0 += (2 * r) / m;
        g1 += (2 * r * q.xs[i]) / m;
      }
      t.g0[t.len - 1] = g0;
      t.g1[t.len - 1] = g1;
      b0 -= lr * g0;
      b1 -= lr * g1;
      t.b0[t.len] = b0;
      t.b1[t.len] = b1;
      t.len += 1;
      if (blown(b0, b1)) {
        t.diverged = e + 1;
        break;
      }
    }
    t.epochAt[e + 1] = t.len - 1;
    t.epochLoss[e + 1] = q.loss(b0, b1);
    if (t.diverged) break;
  }
  t.epochsDone = t.diverged ?? epochs;
  return finish(t, q);
}

/**
 * The one-parameter walk: b0 held at its least-squares value, b1 alone
 * descending the slice. One update per epoch, and `g0` stays zero because b0
 * does not move — the readout on that page prints only the b1 partial.
 *
 * The slice is a parabola of curvature 2 * mean(x^2), so each step multiplies
 * the distance to the minimum by exactly 1 - lr * curvature. That factor is
 * the number the page's caption states.
 */
export function descendSlope(q, lr, epochs) {
  const t = newTrack(epochs + 1, epochs);
  const b0 = q.B0;
  let b1 = 0;
  t.b0[0] = b0;
  t.b1[0] = b1;
  t.len = 1;
  t.epochLoss[0] = q.loss(b0, b1);
  for (let e = 0; e < epochs; e += 1) {
    const g1 = q.grad(b0, b1)[1];
    t.g1[t.len - 1] = g1;
    b1 -= lr * g1;
    t.b0[t.len] = b0;
    t.b1[t.len] = b1;
    t.len += 1;
    t.epochAt[e + 1] = t.len - 1;
    t.epochLoss[e + 1] = q.loss(b0, b1);
    if (blown(b0, b1)) {
      t.diverged = e + 1;
      break;
    }
  }
  t.epochsDone = t.diverged ?? epochs;
  const k = t.len - 1;
  const g = q.grad(b0, t.b1[k])[1];
  t.g0[k] = 0;
  t.g1[k] = Number.isFinite(g) ? g : 0;
  return t;
}

/* --- the relief ----------------------------------------------------------- *
 * The same surface as a height field seen from one direction, mocked in
 * `_lab/gd-3d.html` and picked from it on 2026-09-07: log height, a fixed
 * viewpoint, the hidden part of the path dashed, the partials as tangents.
 *
 * The geometry lives HERE and not in main.js so `_lab/gd-verify.mjs` can assert
 * it with no DOM — the projector reducing to the map when you look straight
 * down, and the share of a walk the near wall hides, are exactly the claims a
 * picture cannot settle.                                                      */

/* THE DEFAULT VIEWPOINT IS MEASURED, NOT CHOSEN BY EYE. With log height the
   lesson's walk lies along the trench, and the ray march below says it is fully
   visible only from azimuths 100-130 or 280-310 at 30-45 degrees of elevation.
   From 215/38, the mock's first guess, the near wall hides 94% of the lr 0.01
   walk. 300/35 looks along the trench from the start toward the minimum, so the
   walk recedes and the minimum sits at the far end of the basin; 120/35 is the
   same trench from the other end, with the point and its two labels crowding
   the front.

   THE STANDARDIZED SURFACE DOES NOT SHARE THAT TRENCH, which the mock's note
   had wrong and `gd-verify.mjs` now measures: both its curvatures are 2, so in
   the panel's own coordinates it is a round pit stretched by the window's
   20.2-against-7.9 aspect, and its flat direction runs along b1 rather than
   along b0. What this viewpoint hides there is only the floor of the pit —
   every hidden piece within 0.08 of the panel of the least-squares point, under
   the ringed point itself — while the descent into it stays solid. That is what
   lets one viewpoint serve both scales. The sweep is in docs/catalogue.md.

   THE PAIR WAS A CONSTANT UNTIL 2026-09-08, when Kenneth asked for the relief
   to turn under the mouse; it is now where the widget's `turn` and `tilt`
   parameters START, and every claim above is a claim about that start. The two
   functions below still default to it, which is what keeps `gd-verify.mjs`
   measuring the shipped viewpoint rather than one written out a second time. */
export const RELIEF_DEFAULT_AZ = 300;
export const RELIEF_DEFAULT_EL = 35;

/* The ridge's height, as a fraction of the domain's own width. Above ~0.7 the
   mesh outgrows the panel at the widths the surface is drawn at; below ~0.4 the
   trench stops reading as a trench. */
export const RELIEF_Z = 0.55;

/* The mesh is G x G quads. 44 is the mock's: at the 180-300px the panel gives
   it, a finer mesh costs sorting time and shows no more of the surface. */
export const MESH_G = 44;

/**
 * Height from a loss ratio: the map's own log ramp, so the contour rings sit at
 * equal heights, the colour and the height say the same thing, and the least
 * loss is the floor at 0. Monotone, and capped where the ramp is capped.
 */
export const reliefHeight = (ratio) =>
  RELIEF_Z * Math.min(1, Math.max(0, Math.log10(Math.max(1, ratio)) / LOG_CAP));

/**
 * Orthographic projection of the cube x, y in [-0.5, 0.5], z in [0, RELIEF_Z]
 * onto `rect`: rotate about the vertical by `az`, then tilt by `el`. Returns
 * screen X, Y and a `depth` that GROWS with distance from the camera, so
 * painting in descending depth paints far to near.
 *
 * Linear in the rect, which is what lets the mesh be painted once into a
 * device-pixel bitmap and the path drawn over it in CSS pixels: the two
 * projectors differ by the same scale the bitmap is blitted at.
 *
 * Looking straight down from azimuth 0 the screen position is the map — X from
 * b0 alone, Y from b1 alone with b1 up, and the height changing neither.
 * `gd-verify.mjs` asserts it, because that is the claim that the relief and the
 * map are two readings of one window.
 */
export function projector(rect, az = RELIEF_DEFAULT_AZ, el = RELIEF_DEFAULT_EL) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ce = Math.cos(e);
  const se = Math.sin(e);
  const s = Math.min(rect.w, rect.h) * 0.66;   // a rotated square needs its diagonal to fit
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h * 0.62;
  return (x, y, z) => {
    const xr = x * ca - y * sa;
    const yr = x * sa + y * ca;
    return { X: cx + s * xr, Y: cy - s * (z * ce + yr * se), depth: yr * ce - z * se };
  };
}

/** A parameter pair in the relief's cube: [x, y] in [-0.5, 0.5] and the height
    of the surface over it. */
export function reliefPoint(q, dom, b0, b1) {
  return [
    (b0 - dom.b0[0]) / (dom.b0[1] - dom.b0[0]) - 0.5,
    (b1 - dom.b1[0]) / (dom.b1[1] - dom.b1[0]) - 0.5,
    reliefHeight(q.loss(b0, b1) / q.Lmin),
  ];
}

/**
 * The mesh as quads ready to paint far to near. Each carries its four projected
 * corners, the geometric mean of its four loss ratios — which picks its colour
 * off the map's own ramp — and a Lambert shade from one fixed light, which is
 * what separates two faces of the trench that carry the same loss.
 *
 * The normal comes from the quad's own heights in normalised units rather than
 * from the projected corners: a screen-space normal changes with the panel's
 * size and the shading would then move when the layout does.
 */
export function reliefMesh(q, dom, project, G = MESH_G) {
  const grid = [];
  for (let i = 0; i <= G; i += 1) {
    const b0 = dom.b0[0] + (i / G) * (dom.b0[1] - dom.b0[0]);
    const row = [];
    for (let j = 0; j <= G; j += 1) {
      const b1 = dom.b1[0] + (j / G) * (dom.b1[1] - dom.b1[0]);
      const r = q.loss(b0, b1) / q.Lmin;
      const z = reliefHeight(r);
      row.push({ p: project(i / G - 0.5, j / G - 0.5, z), r, z });
    }
    grid.push(row);
  }
  const light = [-0.5, 0.4, 0.75];
  const ll = Math.hypot(light[0], light[1], light[2]);
  const u = 1 / G;
  const quads = [];
  for (let i = 0; i < G; i += 1) {
    for (let j = 0; j < G; j += 1) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      const dzx = (b.z - a.z + c.z - d.z) / 2;
      const dzy = (d.z - a.z + c.z - b.z) / 2;
      const n = [-dzx * u, -dzy * u, u * u];
      const nl = Math.hypot(n[0], n[1], n[2]);
      const lambert = (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / (nl * ll);
      quads.push({
        pts: [a.p, b.p, c.p, d.p],
        depth: (a.p.depth + b.p.depth + c.p.depth + d.p.depth) / 4,
        r: (a.r * b.r * c.r * d.r) ** 0.25,
        shade: 0.55 + 0.45 * Math.max(0, lambert),
      });
    }
  }
  quads.sort((v, w) => w.depth - v.depth);
  return quads;
}

/**
 * Is the surface at (b0, b1) hidden from the camera by the surface itself?
 *
 * A DEPTH BUFFER WAS TRIED FIRST AND WAS WRONG. The mock painted each quad's
 * depth as a grey and read the canvas back; checked against the mesh's own
 * vertices it disagreed by tens of levels at every viewpoint, and the first
 * viewpoint sweep taken with it had to be thrown away. The surface is a height
 * field under an ORTHOGRAPHIC camera, which has an exact test instead: march
 * from the point toward the camera and ask whether the surface rises above the
 * ray before the ray leaves the domain. 400 steps of 0.01 cross the cube twice
 * over, and the ray is started a hair above its own surface so a point does not
 * occlude itself.
 */
export function reliefHidden(q, dom, b0, b1, az = RELIEF_DEFAULT_AZ, el = RELIEF_DEFAULT_EL) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const vx = Math.cos(e) * Math.sin(a);
  const vy = Math.cos(e) * Math.cos(a);
  const vz = -Math.sin(e);
  let [x, y, z] = reliefPoint(q, dom, b0, b1);
  z += 0.004;
  const dt = 0.01;
  for (let k = 0; k < 400; k += 1) {
    x -= vx * dt;
    y -= vy * dt;
    z -= vz * dt;
    if (x < -0.5 || x > 0.5 || y < -0.5 || y > 0.5 || z > RELIEF_Z) return false;
    const bb0 = dom.b0[0] + (x + 0.5) * (dom.b0[1] - dom.b0[0]);
    const bb1 = dom.b1[0] + (y + 0.5) * (dom.b1[1] - dom.b1[0]);
    if (reliefHeight(q.loss(bb0, bb1) / q.Lmin) > z) return true;
  }
  return false;
}

/** Position at a fractional update index, for the choreographed step. */
export function posAt(track, fi) {
  const last = track.len - 1;
  const clamped = Math.max(0, Math.min(last, fi));
  const a = Math.floor(clamped);
  const b = Math.min(last, a + 1);
  const f = clamped - a;
  return [
    track.b0[a] + (track.b0[b] - track.b0[a]) * f,
    track.b1[a] + (track.b1[b] - track.b1[a]) * f,
  ];
}
