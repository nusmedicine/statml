/* Widget 70 round 5 (2026-09-26): 01-4 cell 19's `estimateSignatures`. The
 * engine moved into widgets/mutational-signatures/model.js (§ the Rank page)
 * when the page was built; this file keeps the shape the round-5 measure and
 * mock scripts read, on the widget's own code (5.8: one copy of the engine). */
import * as M from "../mutational-signatures/model.js";

export const NRUN = M.NRUN;
export const runOnce = M.rankRun;
export const hclustAverage = M.hclustAverage;
export const consensusOf = M.consensusOf;
export const cophcor = M.cophcor;

/** estimateSignatures at one rank: ten runs' labels, the best KL, the cophenetic correlation. */
export function estimateRank(Mat, r, seed) {
  const e = M.estimateRank(Mat, r, seed);
  const { coph, order } = M.cophcor(M.consensusOf(e.labels));
  return { labels: e.labels, kls: e.kls, kl: Math.min(...e.kls), coph, order, iters: e.iters.reduce((s, x) => s + x, 0) / e.iters.length };
}
