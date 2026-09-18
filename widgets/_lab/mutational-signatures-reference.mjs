/* The input for widget 70's engine reference: a synthetic 96 × 24 count
 * matrix — the first 24 tumors of the widget's own cohort at seed 1, nothing
 * TCGA's — and a starting W (96 × 4) and H (4 × 24) drawn from a fixed seed.
 *
 *   node widgets/_lab/mutational-signatures-reference.mjs <scratch>/ms-ref-in.tsv
 *   Rscript widgets/_lab/mutational-signatures-reference.R <scratch>/ms-ref-in.tsv widgets/_lab/mutational-signatures-reference.tsv
 *
 * R's NMF 0.28 then runs `brunet` from that start for exactly 200 iterations
 * on the counts plus pConstant 0.1, and writes the input and the result into
 * one file, which `_lab/mutational-signatures-verify.mjs` § 1 reads.
 * Long format: block, i, j, value, with 17 significant digits.
 */
import { writeFileSync } from "node:fs";
import { cohortFor } from "../mutational-signatures/model.js";
import { makeRng } from "../core/rng.js";

const out = process.argv[2];
if (!out) { console.error("usage: node mutational-signatures-reference.mjs <out.tsv>"); process.exit(1); }
export const REF_TUMORS = 24, REF_RANK = 4, REF_SEED = 20260919;

const co = cohortFor(1);
const V = co.M.map((row) => Array.from(row).slice(0, REF_TUMORS));
const rng = makeRng(REF_SEED);
const W0 = Array.from({ length: 96 }, () => Array.from({ length: REF_RANK }, () => rng.next() + 0.01));
const H0 = Array.from({ length: REF_RANK }, () => Array.from({ length: REF_TUMORS }, () => rng.next() + 0.01));
const lines = ["block\ti\tj\tvalue"];
const put = (name, A) => A.forEach((row, i) => row.forEach((v, j) => lines.push(`${name}\t${i + 1}\t${j + 1}\t${Number(v).toPrecision(17)}`)));
put("V", V);
put("W0", W0);
put("H0", H0);
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`wrote ${lines.length - 1} values to ${out}`);
