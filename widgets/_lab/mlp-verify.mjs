/* Pin widget 37's shipping engine to the reference in _lab/mlp-design.py.
 *
 * The two cannot share a random stream — one seeds with makeRng, the other
 * with numpy — so a shared seed proves nothing. This dumps the DATA and the
 * INITIAL WEIGHTS the widget actually produced, and the reference then trains
 * from those exact arrays. Anything that differs afterwards is the update
 * rule, which is the thing being checked.
 *
 *   node widgets/_lab/mlp-verify.mjs > widgets/_lab/mlp-verify.json
 *   "…/_scratch/venv/Scripts/python.exe" widgets/_lab/mlp-verify.py
 */

import { makeRng } from "../core/rng.js";
import { SETS, trainAll, EPOCHS, LR, MOMENTUM } from "../mlp/model.js";

const CASES = [
  { set: "rings", k: 4, act: "relu", seed: 1, init: 1 },
  { set: "rings", k: 8, act: "tanh", seed: 1, init: 3 },
  { set: "moons", k: 3, act: "relu", seed: 2, init: 5 },
  { set: "blobs", k: 1, act: "identity", seed: 1, init: 1 },
];

const out = { epochs: EPOCHS, lr: LR, momentum: MOMENTUM, cases: [] };

for (const c of CASES) {
  const data = SETS[c.set].make(makeRng(c.seed));
  const run = trainAll(data, c.k, c.act, makeRng(c.init));
  out.cases.push({
    ...c,
    X: data.map((s) => s.x),
    y: data.map((s) => (s.y > 0 ? 1 : 0)),
    init: run.frames[0],
    final: run.frames[EPOCHS],
    loss0: run.losses[0],
    lossEnd: run.losses[EPOCHS - 1],
    errors: run.errors[EPOCHS],
    live: run.live[EPOCHS],
  });
}

process.stdout.write(JSON.stringify(out));
