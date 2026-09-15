/* Planning measurement for slot 64 `grad-cam`, 2026-09-15, on the engine in
 * `_lab/gradcam-engine.mjs` (a three-block form of `dl-image-measure.mjs`'s).
 *
 * WHAT IT ASKS, beyond the catalogue's M3 (which measured DISC vs RING on a
 * two-block net):
 *   1. Does the engine's L-block generalisation still pass the gradient check?
 *   2. THE TASK. HANDOVER says 64 should reuse widget 61's cell. Two classes
 *      of that cell — with a nucleus, without one — against the measured
 *      DISC / RING pair: does a 16 × 16 net learn it, does the planted
 *      corner mark take over at 100 %, and does the CAM on a CLEAN image land
 *      on the cell when the model has no shortcut?
 *   3. THE SIZE. 16 × 16 is the measured budget; 24 × 24 costs 2.25 × the
 *      pixels.
 *   4. THE THIRD BLOCK. Its CAM is H/4 on a side — 4 × 4 at 16.
 *   5. THE OTHER CLASS. The widget has a `class` control; what does the CAM
 *      of the class NOT predicted look like on the same image?
 *
 * FIRST RUN (three-block 8/16/32, 200 images, 30 epochs, cue value 1.0):
 *   · 16 × 16 trains in 1.95 s a net, 24 × 24 in 4.1 s — 24 is out of budget.
 *   · CELL (nucleus vs none, cue on the nucleus class): clean 97.3 at cue 0,
 *     50.3 at cue 100 — THE SHORTCUT WINS — and at cue 50 the cued test set
 *     scores 52.7 while clean scores 95.7, so the mark overrides the shape
 *     whenever it is present. But the CAM at cue 0 is OFF the cell: 3.7 % of
 *     block 1's mass on a footprint that is 32 % of the image, block 3 at its
 *     area share. The class with the nucleus is defined by the ABSENCE of a
 *     uniform bright body, and with a GAP head and a two-class softmax the
 *     two rows of the linear layer are near-opposites (their sum keeps its
 *     initial value, since each sample's gradient on one is the negative of
 *     the other's), so the nucleus class's CAM is ReLU of the negative of the
 *     other's — empty where the evidence is.
 *   · SHAPES (DISC vs RING): the CAM at cue 0 is on the shape at every block
 *     (71 / 69 / 36 % of the mass on a 15 % footprint) but THE SHORTCUT DOES
 *     NOT WIN: clean 92.3 at cue 100 (M3 had 67.8 on the two-block net with
 *     the cue at 1.4), 100 at 24 × 24.
 *   So the second run below varies what those two results point at: which
 *   class carries the cue, whether both classes have a feature of their own
 *   (nucleus vs granules), the cue's brightness, and a cheaper net.
 *
 * SECOND RUN (configs A–G; then H, I with `node … H`), 2026-09-15:
 *   · A cell, nucleus vs none, cue on the PLAIN cell: the plain class's CAM is
 *     on the cell (69 / 87 / 74 % of a 30 % footprint) and the shortcut wins
 *     (clean 50.0 at cue 100) — but the nucleus class's CAM is scattered
 *     (3 / 10 / 11 %), and half the test images are that class.
 *   · B, C nucleus vs granules, either class cued: the nucleus class is still
 *     the absence class (11 / 26 / 35 % at its own image; the granule class
 *     70 / 83 / 59 %). H, a BRIGHT nucleus vs granules so both are positive:
 *     the CAM lands on the nucleus (28 / 30 % of a 6 % footprint) but the task
 *     is not learned at 16 × 16 — clean 85.0 on the large net, 77.0 on the
 *     small one.
 *   · D shapes with the cue at 1.4: THE SHORTCUT WINS (clean 65.0 at cue 100),
 *     the CAM on the shape at every block (71 / 69 / 36 % of a 15 % footprint)
 *     for the disc, and the ring's own CAM on the ring (read in the mock).
 *     E, the shapes dimmed under a 1.0 cue, is the same result (68.0): what
 *     matters is that the mark is brighter than anything in the image.
 *   · G, D on the cheaper net (conv 8/12/16, 20 epochs): 0.78 s a net, clean
 *     100 / 60.3, CAM 85 / 68 / 36 — the shortcut wins HARDER on the smaller
 *     net, and it is the recommendation. F, the cell on it, learns less (94.3).
 *   · The corner window is too narrow for block 3: its cell (0, 0) has an
 *     18 px receptive field, so the mark's heat spreads over the top-left
 *     quarter; `heatShare` now reports `quarter` as well as `corner`.
 *   · conv1's CAM for a disc is EMPTY one time in five (α all ≤ 0 at the fine
 *     layer): honest, but not an opening — the widget's default layer is
 *     conv2, which is cell 137's own `layer2`.
 *   DECISION FOR THE MOCK: DISC vs RING, the mark at 1.4 on the disc, conv
 *   8/12/16 for 20 epochs on 200 images. The cell's continuity with 61 is the
 *   cost, and `_lab/gradcam-mock.html` §1 draws all three candidates trained
 *   in the browser so the cost can be seen rather than read.
 *
 * THIRD RUN (`node … V`), on Kenneth's "measure another cell variant first"
 * (2026-09-15) — two-class cells where BOTH classes were meant to carry a
 * feature of their own, on the cheaper net, three seeds, both classes' CAMs
 * read on their own clean images (cell footprint 30 %):
 *   variant                       clean 0 / 100    class-0 CAM b1 b2 b3   class-1 CAM b1 b2 b3
 *   round vs elongated (2.2 : 1)      81.0 / 50.3      36  29  48             24  27  30
 *   central vs eccentric nucleus      62.7 / 50.0      28  23  43             32  27  33
 *   small vs large nucleus            91.3 / 50.0      74  85  68             12  18  35
 *   one vs two nuclei                 72.3 / 50.0      48  52  38             24  28  35
 *   cell vs ghost (membrane only)     99.7 / 98.0      84  85  56             16  25  35
 *   cell+nucleus vs ghost            100.0 / 97.0      78  81  56             17  27  39
 *   Three ways to fail, and every variant takes one: the task is not learned
 *   at 16 × 16 in 0.8 s (elongation, position, count); one class is defined
 *   by an absence and its CAM is off the cell (large nucleus, ghost — the
 *   ghost's membrane is present in BOTH classes, so its evidence is the body
 *   that is not there); or the mark does not win against a 0.93 membrane
 *   (ghost, 98 % clean at cue 100). DISC vs RING passes all three because the
 *   ring's own pixels are its evidence on a dark field, and the disc's are
 *   the disc's. The recommendation stands.
 *
 * FOURTH RUN, on Kenneth's pick of the ghost (2026-09-15) — the cell WITH a
 * nucleus against its membrane alone, the two gaps worked on: the mark's
 * value and size (it must beat a 0.93 membrane) and the ghost's interior
 * (an interior darker than the field is evidence of its own, so the ghost
 * class stops being an absence). Small net, three seeds, class-1 = the ghost:
 *   interior   mark          clean 0 / 100   cued 100   ghost CAM b1 b2 b3   cell CAM b1 b2 b3 (nucleus)
 *   0.24       3 × 3 at 1.4   100 / 78.7       56.7       17  27  39           78  81  56  (6 16 14)
 *   0.24       4 × 4 at 1.4   100 / 55.3       50.0       17  27  39
 *   0.16       4 × 4 at 1.4   100 / 73.7       50.0       31  39  46           73  75  53  (7 16 13)
 *   0.12       4 × 4 at 1.4   100 / 83.7       52.0       39  46  48
 *   0.08       4 × 4 at 1.4   100 / 89.0       65.3       47  51  50           71  73  52  (7 15 13)
 *   0.16       5 × 5 at 1.4   100 / 68.0       50.0       31  39  46
 *   0.12       5 × 5 at 1.4   100 / 74.0       50.0       39  46  48
 *   0.08       5 × 5 at 1.4   100 / 76.7       51.3       47  51  50
 *   The darker the interior the easier the ghost and the less the mark wins;
 *   the bigger the mark the more it wins. THE PICK: interior 0.08, the mark
 *   5 × 5 at 1.4 (10 % of the image, brighter than anything in it): clean
 *   accuracy 100 → 77 with the mark on every cell, 51 on watermarked images
 *   (the mark decides), the ghost's CAM 1.5 × chance at every layer, the
 *   cell's 2.2 × and 5 × on its nucleus. `CELL_TASKS.holen` is that cell.
 *
 * Run: node widgets/_lab/gradcam-measure.mjs        (configs A–G)
 *      node widgets/_lab/gradcam-measure.mjs H      (configs H, I)
 *      node widgets/_lab/gradcam-measure.mjs V [tasks] [cueValue] [small|big] [cueSize]
 *                                                   (the cell variants)
 */

import { makeRng } from "../core/rng.js";
import * as E from "../grad-cam/engine.js";

const pad = (v, n) => String(v).padStart(n);
const pct = (v) => (100 * v).toFixed(1);

const SEEDS = 3;
const S = 16;

/* 1 ---------------------------------------------------------------------- */
{
  const g = E.gradCheck(makeRng(7));
  console.log(`gradient check (S=8, 1→2→3→2, K=2, 2 images): CE max relative error ${g.worst.toExponential(1)} over ${g.count} parameters; ∂logit/∂A on the last block ${g.worstCam.toExponential(1)}\n`);
}

/* 2–5 ------------------------------------------------------------------- */
function run(cfg, rate) {
  const { task, chans, epochs, n, cueClass = 0, cueValue = 1.0, bright = [0.6, 1.0] } = cfg;
  const L = chans.length;
  const acc = { train: 0, clean: 0, cued: 0, ms: 0 };
  const zero = () => Array.from({ length: L }, () => ({ object: 0, corner: 0, nuc: 0, empty: 0 }));
  const cam = { clean: zero(), cued: zero(), other: zero() };
  let objArea = 0;
  let nucArea = 0;
  let count = 0;
  for (let s = 0; s < SEEDS; s += 1) {
    const rng = makeRng(100 + s);
    const opts = { cueClass, cueValue, bright };
    const tr = E.makeSet(task, n, S, rng, { ...opts, cueRate: rate });
    const teClean = E.makeSet(task, 100, S, makeRng(6000), opts);
    const teCued = E.makeSet(task, 100, S, makeRng(6000), { ...opts, cueAll: true });
    const net = E.makeNet(S, chans, 2, rng);
    const t0 = performance.now();
    const { w } = E.train(net, tr, { epochs, rng });
    acc.ms += performance.now() - t0;
    acc.train += E.evaluate(net, w, tr);
    acc.clean += E.evaluate(net, w, teClean);
    acc.cued += E.evaluate(net, w, teCued);
    /* the CAM on images of the CUED class, at the predicted class; and on the
       clean ones, the CAM of the other class too */
    for (let i = cueClass; i < 40; i += 2) {
      for (const [set, key] of [[teClean, "clean"], [teCued, "cued"]]) {
        E.forward(net, w, set.x, i * S * S);
        const cls = E.argmax(w);
        for (let b = 0; b < L; b += 1) {
          const g = E.gradcam(net, w, set.x, i * S * S, cls, b);
          const h = E.heatShare(g.up, S, set.masks[i]);
          const hn = E.heatShare(g.up, S, set.nucs[i]);
          cam[key][b].object += h.object;
          cam[key][b].corner += h.corner;
          cam[key][b].nuc += hn.object;
          if (g.peak === 0) cam[key][b].empty += 1;
          if (key === "clean" && b === 0) { objArea += h.objectArea; nucArea += hn.objectArea; }
          if (key === "clean") {
            const o = E.gradcam(net, w, set.x, i * S * S, 1 - cls, b);
            const ho = E.heatShare(o.up, S, set.masks[i]);
            cam.other[b].object += ho.object;
            cam.other[b].corner += ho.corner;
            cam.other[b].nuc += E.heatShare(o.up, S, set.nucs[i]).object;
            if (o.peak === 0) cam.other[b].empty += 1;
          }
        }
      }
      count += 1;
    }
  }
  const d = (o) => ({ object: o.object / count, corner: o.corner / count, nuc: o.nuc / count, empty: o.empty / count });
  return {
    rate, train: acc.train / SEEDS, clean: acc.clean / SEEDS, cued: acc.cued / SEEDS, ms: acc.ms / SEEDS,
    objArea: objArea / count, nucArea: nucArea / count,
    clean_cam: cam.clean.map(d), cued_cam: cam.cued.map(d), other_cam: cam.other.map(d),
  };
}

/* the variant run: both classes have a feature of their own; both classes'
   CAMs are read on their own clean images */
if (process.argv[2] === "V") {
  const big = process.argv[5] === "big";
  const chans = big ? [8, 16, 32] : [8, 12, 16];
  const epochs = big ? 30 : 20;
  const n = 200;
  const cueValue = Number(process.argv[4] ?? 1.0);
  const cueSize = Number(process.argv[6] ?? 3);
  console.log(`== CELL VARIANTS — ${S} × ${S}, ${n} images, ${epochs} epochs, conv ${chans.join("/")}, ${SEEDS} seeds; the cue on class 0 at ${cueValue}, ${cueSize} × ${cueSize} ==`);
  console.log(`${pad("variant", 10)}${pad("clean0", 8)}${pad("clean100", 9)}${pad("cued100", 8)}${pad("ms", 6)}   class-0 images: cell/nuc/empty at b1  b2  b3     class-1 images: cell/nuc/empty at b1  b2  b3`);
  for (const task of (process.argv[3] ? process.argv[3].split(",") : ["elong", "position", "size", "count", "cell"])) {
    let clean0 = 0;
    let clean100 = 0;
    let cued100 = 0;
    let ms = 0;
    const cam = [0, 1].map(() => [0, 1, 2].map(() => ({ object: 0, nuc: 0, empty: 0, n: 0 })));
    const areas = { cell: 0, nuc: 0, n: 0 };
    for (let sd = 0; sd < SEEDS; sd += 1) {
      for (const rate of [0, 1]) {
        const rng = makeRng(100 + sd);
        const tr = E.makeSet(task, n, S, rng, { cueRate: rate, cueValue, cueSize });
        const teClean = E.makeSet(task, 100, S, makeRng(6000), { cueValue, cueSize });
        const teCued = E.makeSet(task, 100, S, makeRng(6000), { cueAll: true, cueValue, cueSize });
        const net = E.makeNet(S, chans, 2, rng);
        const t0 = performance.now();
        const { w } = E.train(net, tr, { epochs, rng });
        ms += performance.now() - t0;
        if (rate === 0) {
          clean0 += E.evaluate(net, w, teClean);
          for (let i = 0; i < 40; i += 1) {
            const k = i % 2;
            E.forward(net, w, teClean.x, i * S * S);
            const cls = E.argmax(w);
            for (let b = 0; b < 3; b += 1) {
              const g = E.gradcam(net, w, teClean.x, i * S * S, cls, b);
              const h = E.heatShare(g.up, S, teClean.masks[i]);
              const hn = E.heatShare(g.up, S, teClean.nucs[i]);
              cam[k][b].object += h.object;
              cam[k][b].nuc += hn.object;
              if (g.peak === 0) cam[k][b].empty += 1;
              cam[k][b].n += 1;
              if (b === 0) { areas.cell += h.objectArea; areas.nuc += hn.objectArea; areas.n += 1; }
            }
          }
        } else {
          clean100 += E.evaluate(net, w, teClean);
          cued100 += E.evaluate(net, w, teCued);
        }
      }
    }
    const f = (o) => `${pad(pct(o.object / o.n), 3)}/${pad(pct(o.nuc / o.n), 3)}/${pad(pct(o.empty / o.n), 3)}`;
    console.log(`${pad(task, 10)}${pad(pct(clean0 / SEEDS), 8)}${pad(pct(clean100 / SEEDS), 9)}${pad(pct(cued100 / SEEDS), 8)}${pad((ms / SEEDS / 2).toFixed(0), 6)}   `
      + cam[0].map(f).join("  ") + "     " + cam[1].map(f).join("  ")
      + `   areas cell ${pct(areas.cell / areas.n)} nuc ${pct(areas.nuc / areas.n)}`);
  }
  process.exit(0);
}

const CONFIGS = process.argv[2] === "H" ? [
  { name: "H  cell, BRIGHT nucleus vs granules, cue on the nucleus class", task: "bright", cueClass: 0, chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "I  as H, cheaper: conv 8/12/16, 20 epochs", task: "bright", cueClass: 0, chans: [8, 12, 16], epochs: 20, n: 200 },
] : [
  { name: "A  cell, nucleus vs none, cue on the PLAIN cell (class 1)", task: "cell", cueClass: 1, chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "B  cell, nucleus vs GRANULES, cue on the nucleus class", task: "granule", cueClass: 0, chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "C  cell, nucleus vs GRANULES, cue on the granule class", task: "granule", cueClass: 1, chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "D  shapes, cue at 1.4 (M3's value)", task: "shapes", cueValue: 1.4, chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "E  shapes dimmed to 0.45–0.75, cue at 1.0", task: "shapes", bright: [0.45, 0.75], chans: [8, 16, 32], epochs: 30, n: 200 },
  { name: "F  as A, cheaper: conv 8/12/16, 20 epochs", task: "cell", cueClass: 1, chans: [8, 12, 16], epochs: 20, n: 200 },
  { name: "G  as D, cheaper: conv 8/12/16, 20 epochs", task: "shapes", cueValue: 1.4, chans: [8, 12, 16], epochs: 20, n: 200 },
];

for (const cfg of CONFIGS) {
  const isCell = cfg.task !== "shapes";
  console.log(`== ${cfg.name} — ${S} × ${S}, ${cfg.n} images, ${cfg.epochs} epochs, conv ${cfg.chans.join("/")}, ${SEEDS} seeds ==`);
  const rows = [0, 0.5, 1].map((r) => run(cfg, r));
  console.log(`${pad("cue", 6)}${pad("train", 8)}${pad("CLEAN", 8)}${pad("CUED", 8)}${pad("ms", 8)}   accuracy %, and training time per net`);
  for (const r of rows) console.log(`${pad(pct(r.rate), 6)}${pad(pct(r.train), 8)}${pad(pct(r.clean), 8)}${pad(pct(r.cued), 8)}${pad(r.ms.toFixed(0), 8)}`);
  console.log(`CAM mass %, cued-class test images (${SEEDS * 20}). corner = top-left 4 × 4 (6.3 %); object = the footprint (${pct(rows[0].objArea)} %)${isCell ? `; nuc = the nucleus or granules (${pct(rows[0].nucArea)} %)` : ""}; empty = CAMs with no positive part`);
  const head = `${pad("cue", 6)}` + [0, 1, 2].map((b) => `${pad(`b${b + 1} crn`, 8)}${pad("obj", 6)}${isCell ? pad("nuc", 6) : ""}${pad("empty", 7)}`).join("");
  for (const [key, title] of [["clean", "CLEAN images, predicted class"], ["cued", "CUED images, predicted class"], ["other", "CLEAN images, the OTHER class"]]) {
    console.log(`  ${title}`);
    console.log(head);
    for (const r of rows) {
      const c = r[`${key}_cam`];
      console.log(`${pad(pct(r.rate), 6)}` + c.map((v) => `${pad(pct(v.corner), 8)}${pad(pct(v.object), 6)}${isCell ? pad(pct(v.nuc), 6) : ""}${pad(pct(v.empty), 7)}`).join(""));
    }
  }
  console.log("");
}
