/* _lab/integration-harmony-measure.mjs — would slot 80 work with Harmony in
 * place of Seurat's anchors? Asked 2026-09-25 ("thinking of changing the
 * seurat integration to harmony, is there a similar way of explaining it
 * visually"). Measured on the widget's own 2-D stage (integration/engine.js)
 * before any mock, because the 3-D measurement (integration-measure.mjs)
 * found Harmony merged nothing under the tissue key where the anchors did.
 *
 * Harmony as published (Korsunsky 2019), in two dimensions:
 *   - soft k-means: R[i][k] ∝ exp(-|z_i - c_k|² / σ) · ((E_kb + 1)/(O_kb + 1))^θ,
 *     O the batch's soft count in the cluster, E what it would be if the
 *     cluster held each batch in the data's overall proportion; updated a
 *     block of cells at a time, as the package does
 *   - correction (mixture of experts): per cluster, a ridge fit (λ) of the
 *     ORIGINAL embedding on batch; each cell loses its batch's term, weighted
 *     by R; clustering then reruns on the corrected embedding
 * The cosine normalisation is left out: in two dimensions it would put every
 * cell on the unit circle. σ is in the stage's squared distance.
 *
 *   node widgets/_lab/integration-harmony-measure.mjs
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import { simulate, integrate, measures } from "../integration/engine.js";
import { harmony2d } from "./integration-harmony.js";

/* ---------------------------------------------------------------- the run */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = [];
  const say = (s) => { out.push(s); console.log(s); };
  const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
  const measure = (cells, res) => { const m = measures(cells, { ...res, pairs: [], score: [] }); return m; };
  say("Harmony on slot 80's 2-D stage (600 cells, 4 samples). mixing = batch share among 15 neighbours / expected (0 apart, 1 mixed); tumour→hep = share of a tumour cell's 15 neighbours that are hepatocytes");
  say("");
  for (const seed of [1, 2, 3]) {
    const cells = simulate(makeRng(seed));
    for (const key of ["patient", "tissue"]) {
      const A = integrate(cells, key), mA = measures(cells, A);
      say(`seed ${seed}  key ${key.padEnd(7)}  ANCHORS   mixPatient ${f(mA.mixPatient[0])} → ${f(mA.mixPatient[1])}  mixTissue ${f(mA.mixTissue[0])} → ${f(mA.mixTissue[1])}  tumour→hep ${f(mA.tumourHep[0])} → ${f(mA.tumourHep[1])}`);
      for (const [K, sigma] of [[12, 0.1], [20, 0.1], [12, 0.05]]) for (const theta of [0, 1, 2, 4]) {
        const H = harmony2d(cells, key, makeRng(100 + seed), { K, theta, sigma, trace: true });
        const m = measure(cells, H);
        const mv = H.history.map((h) => h.moved.toFixed(3)).join(" ");
        say(`            HARMONY K ${String(K).padStart(2)} σ ${sigma} θ ${theta}  mixPatient ${f(m.mixPatient[1])}  mixTissue ${f(m.mixTissue[1])}  tumour→hep ${f(m.tumourHep[1])}   moved per round ${mv}`);
      }
    }
    say("");
  }
  fs.writeFileSync(fileURLToPath(new URL("./integration-harmony-measure.txt", import.meta.url)), out.join("\n") + "\n");
}
