/* ============================================================================
   Widget 45 · Hidden Markov model — the engine, kept out of main.js so the
   `_lab/hmm-*` pages and scripts measure the same numbers the figure draws.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   INTENTIONAL missing data of a SNP array, filled from a reference panel of
   sequenced haplotypes with a hidden Markov model. The notebook's toy has two
   reference haplotypes, a 17-letter genotype with 13 blanks, and a Viterbi
   call from the `HMM` package. This is the same model with the pieces the toy
   leaves implicit made explicit:

     hidden state at site i   WHICH panel haplotype the sample is copying
     transition               stay on it, or switch to another (recombination)
     emission at a typed site the copied haplotype's allele, or not (mismatch)
     emission at a blank      nothing observed, every state equally likely

   which is the Li & Stephens (2003) copying model every imputation program
   descends from, with one panel and one chromosome. Two things differ from the
   notebook on purpose:

   1. The emission is POSITION-SPECIFIC. The notebook's emission matrix is each
      haplotype's base composition, the same at every site, so its H1/H2 call
      rests on how many A's each carries rather than on which allele sits at
      the typed position. That works on its 17 letters and is not the mechanism.
      Here a state emits the allele it carries AT THAT SITE, or a mismatch with
      probability EPS.
   2. Forward–backward is computed as well as Viterbi. Viterbi gives one path;
      the posterior gives, per site, how sure that call is — and the untyped
      sites between two typed ones, or past the last one, are where it is not.
      An imputed genotype carries that number in practice (a dosage), and a
      figure that hides it would draw an imputation as if it were a read.

   THE ANIMATION IS "TYPE ONE MORE SITE". Stage t has the first t typed sites
   revealed, left to right, and the whole posterior recomputed from them. Stage
   0 is nothing typed: the posterior is uniform and the imputation is the
   panel's allele frequency, which is the naive fill the model improves on.
   Every stage is precomputed here so `advance` reveals and never computes.
   ========================================================================= */

export const L_DEFAULT = 36;

/* Panel-building rates. FOUNDERS independent haplotypes, then each further one
   is a mosaic of earlier ones — a copying process, so haplotypes share long
   segments the way a real panel's do. That sharing is what makes an untyped
   site imputable: the typed neighbours name the segment, the segment names
   the allele. */
const PANEL = { founders: 2, switch: 0.08, mut: 0.05 };

/* The sample is a mosaic of the panel with `switches` recombination points
   and a small rate of variants the panel does not carry. Those novel sites are
   the honest failure: an untyped novel allele cannot be imputed by copying. */
const NOVEL_MUT = 0.025;

/* Mismatch allowance in the emission — the notebook's model has none, which
   makes a single novel typed allele zero out every state. Fixed and small. */
export const EPS = 0.02;

/* Two letters per site so the figure can print nucleotides as the lesson does;
   allele 0 and allele 1 are otherwise just the two states of a biallelic SNP. */
const BASES = ["A", "C", "G", "T"];

function shuffledIdx(rng, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makePanel(rng, K, L, P = PANEL) {
  const hap = [];
  for (let k = 0; k < K; k += 1) {
    const row = new Array(L);
    if (k < P.founders) {
      for (let i = 0; i < L; i += 1) row[i] = rng.next() < 0.5 ? 1 : 0;
    } else {
      let src = Math.floor(rng.next() * k);
      for (let i = 0; i < L; i += 1) {
        if (i > 0 && rng.next() < P.switch) src = Math.floor(rng.next() * k);
        row[i] = rng.next() < P.mut ? 1 - hap[src][i] : hap[src][i];
      }
    }
    hap.push(row);
  }
  /* Letters: two distinct bases per site, drawn once so every row agrees. */
  const letters = [];
  for (let i = 0; i < L; i += 1) {
    const a = Math.floor(rng.next() * 4);
    let b = Math.floor(rng.next() * 3);
    if (b >= a) b += 1;
    letters.push([BASES[a], BASES[b]]);
  }
  return { hap, letters };
}

/* The truth: which haplotype the sample copies at each site, the allele it
   actually carries, and the sites where that allele is a novel variant. */
/* Recombination points sit at least MIN_SEG sites apart and from either end,
   so every segment of the mosaic is long enough to be seen and to be typed
   at least once at the sparsest density the widget offers. Drawn without that
   rule, seed 1 put its two switches at sites 21 and 22. */
const MIN_SEG = 5;

export function makeSample(rng, panel, switches) {
  const K = panel.hap.length, L = panel.hap[0].length;
  const cutSites = [];
  for (const c of shuffledIdx(rng, L - 2 * MIN_SEG + 1).map((i) => i + MIN_SEG)) {
    if (cutSites.length === switches) break;
    if (cutSites.every((d) => Math.abs(d - c) >= MIN_SEG)) cutSites.push(c);
  }
  cutSites.sort((a, b) => a - b);
  const src = new Array(L), allele = new Array(L), novel = new Array(L).fill(false);
  let h = Math.floor(rng.next() * K);
  for (let i = 0; i < L; i += 1) {
    if (cutSites.includes(i) && K > 1) {
      let g = Math.floor(rng.next() * (K - 1));
      if (g >= h) g += 1;
      h = g;
    }
    src[i] = h;
    allele[i] = panel.hap[h][i];
    if (rng.next() < NOVEL_MUT) { allele[i] = 1 - allele[i]; novel[i] = true; }
  }
  return { src, allele, novel, cutSites };
}

/* The array types every `every`-th site, from the first. */
export function typedSites(L, every) {
  const out = [];
  for (let i = 0; i < L; i += every) out.push(i);
  return out;
}

/* Forward–backward and Viterbi over one copying HMM.
     emit[i][h]   P(observation at i | copying h): 1 where nothing is typed
     rho          P(switch) per interval; a switch lands uniformly on K states,
                  so staying has probability 1 - rho + rho/K
   Returns gamma[i][h] (posterior), path[i] (Viterbi state) and logLik. */
export function decode(emit, K, rho) {
  const L = emit.length;
  const stay = 1 - rho + rho / K, move = rho / K;
  const fwd = [], scale = new Array(L);
  let prev = null;
  for (let i = 0; i < L; i += 1) {
    const a = new Array(K);
    let tot = 0;
    for (let h = 0; h < K; h += 1) {
      const from = prev === null ? 1 / K : stay * prev[h] + move;   // prev sums to 1
      a[h] = emit[i][h] * from;
      tot += a[h];
    }
    for (let h = 0; h < K; h += 1) a[h] /= tot;
    scale[i] = tot;
    fwd.push(a);
    prev = a;
  }
  const bwd = new Array(L);
  let next = new Array(K).fill(1);
  bwd[L - 1] = next;
  for (let i = L - 2; i >= 0; i -= 1) {
    const eb = new Array(K);
    let all = 0;
    for (let h = 0; h < K; h += 1) { eb[h] = emit[i + 1][h] * next[h]; all += eb[h]; }
    const b = new Array(K);
    let tot = 0;
    for (let h = 0; h < K; h += 1) { b[h] = stay * eb[h] + move * all; tot += b[h]; }
    for (let h = 0; h < K; h += 1) b[h] /= tot;
    bwd[i] = b;
    next = b;
  }
  const gamma = [];
  for (let i = 0; i < L; i += 1) {
    const g = new Array(K);
    let tot = 0;
    for (let h = 0; h < K; h += 1) { g[h] = fwd[i][h] * bwd[i][h]; tot += g[h]; }
    for (let h = 0; h < K; h += 1) g[h] /= tot;
    gamma.push(g);
  }
  /* Viterbi in logs. Ties go to staying, so an untyped stretch never wanders. */
  const lStay = Math.log(stay), lMove = Math.log(move);
  const V = [], back = [];
  for (let i = 0; i < L; i += 1) {
    const v = new Array(K), bp = new Array(K);
    let bestPrev = -1, bestVal = -Infinity;
    if (i > 0) for (let h = 0; h < K; h += 1) if (V[i - 1][h] > bestVal) { bestVal = V[i - 1][h]; bestPrev = h; }
    for (let h = 0; h < K; h += 1) {
      const le = Math.log(emit[i][h]);
      if (i === 0) { v[h] = Math.log(1 / K) + le; bp[h] = -1; continue; }
      const viaStay = V[i - 1][h] + lStay, viaMove = bestVal + lMove;
      if (viaStay >= viaMove) { v[h] = viaStay + le; bp[h] = h; }
      else { v[h] = viaMove + le; bp[h] = bestPrev; }
    }
    V.push(v); back.push(bp);
  }
  const path = new Array(L);
  let h = 0;
  for (let k = 1; k < K; k += 1) if (V[L - 1][k] > V[L - 1][h]) h = k;
  for (let i = L - 1; i >= 0; i -= 1) { path[i] = h; h = back[i][h]; }
  const logLik = scale.reduce((s, c) => s + Math.log(c), 0);
  return { gamma, path, logLik };
}

/* One stage of the reveal: the first `t` typed sites are known. */
function stage(panel, sample, typed, t, rho) {
  const K = panel.hap.length, L = panel.hap[0].length;
  const known = new Set(typed.slice(0, t));
  const emit = [];
  for (let i = 0; i < L; i += 1) {
    const row = new Array(K).fill(1);
    if (known.has(i)) for (let h = 0; h < K; h += 1) row[h] = panel.hap[h][i] === sample.allele[i] ? 1 - EPS : EPS;
    emit.push(row);
  }
  const { gamma, path, logLik } = decode(emit, K, rho);
  /* Per site: the posterior of allele 1, the call, its confidence, and the
     Viterbi copy — read from the copied haplotype, so a typed site is its own
     observation and an untyped one is the copy. */
  const sites = [];
  let sure = 0, correct = 0, freqCorrect = 0, untyped = 0;
  for (let i = 0; i < L; i += 1) {
    let p1 = 0, f1 = 0;
    for (let h = 0; h < K; h += 1) {
      const a = panel.hap[h][i];
      p1 += gamma[i][h] * (a === 1 ? 1 - EPS : EPS);
      f1 += a;
    }
    f1 /= K;
    const isTyped = known.has(i);
    const call = isTyped ? sample.allele[i] : (p1 > 0.5 ? 1 : 0);
    const conf = isTyped ? 1 : Math.max(p1, 1 - p1);
    const viterbi = isTyped ? sample.allele[i] : panel.hap[path[i]][i];
    const freqCall = f1 > 0.5 ? 1 : 0;
    if (!isTyped) {
      untyped += 1;
      if (conf >= 0.9) sure += 1;
      if (call === sample.allele[i]) correct += 1;
      if (freqCall === sample.allele[i]) freqCorrect += 1;
    }
    sites.push({ typed: isTyped, p1, call, conf, viterbi, freqCall });
  }
  return { t, known, gamma, path, logLik, sites, untyped, sure, correct, freqCorrect };
}

/* Everything the figure needs, for every stage of the reveal. */
export function build({ rng, K, L = L_DEFAULT, every, switches, rho, panelOpts }) {
  const panel = makePanel(rng, K, L, panelOpts);
  const sample = makeSample(rng, panel, switches);
  const typed = typedSites(L, every);
  const stages = [];
  for (let t = 0; t <= typed.length; t += 1) stages.push(stage(panel, sample, typed, t, rho));
  return { panel, sample, typed, stages, K, L };
}
