/* ============================================================================
   Widget 45 · Hidden Markov model — the engine, kept out of main.js so the
   `_lab/hmm-*` pages and scripts measure the same numbers the figure draws.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   INTENTIONAL missing data of a SNP array, filled from a reference panel of
   sequenced haplotypes with a hidden Markov model. The notebook builds up to
   it with a two-state toy — mood patterns P1 and P2 emitting Happy or Sad,
   with some days unrecorded — and the widget keeps that order: the Toy tab
   first, the Biological tab second, and ONE decoder serves both, because
   that is the point.

     hidden state at position i   the pattern the day is in / WHICH panel
                                  haplotype the sample is copying
     transition                   stay, or switch (a mood change / a
                                  recombination)
     emission at a known position P(mood | pattern) / the copied haplotype's
                                  allele at that site, or a mismatch
     emission at a blank          nothing observed: every state equally likely

   The biological tab is the Li & Stephens (2003) copying model every imputation
   program descends from, with one panel and one chromosome. Two things differ
   from the notebook on purpose:

   1. The emission is POSITION-SPECIFIC. The notebook's emission matrix is each
      haplotype's base composition, the same at every site, so its H1/H2 call
      rests on how many A's each carries rather than on which allele sits at
      the typed position. That works on its 17 letters and is not the mechanism.
      Here a state emits the allele it carries AT THAT SITE, or a mismatch with
      probability EPS.
   2. Forward–backward is computed as well as Viterbi. Viterbi gives one path;
      the posterior gives, per position, how sure that call is — and the blanks
      between two known positions, or past the last one, are where it is not.
      An imputed genotype carries that number in practice (a dosage), and a
      figure that hides it would draw an imputation as if it were a read.

   TWO ANIMATIONS, BOTH PRECOMPUTED HERE so `advance` reveals and never
   computes. The Toy tab animates the Viterbi algorithm itself: the trellis
   forward one column at a time, then the trace-back (Kenneth, 2026-09-06,
   from the three candidates in `_lab/hmm-viterbi.html`). The Biological tab
   reveals one typed site at a time: stage t has the first t typed sites
   known and the whole posterior recomputed from them. Stage 0 is nothing
   known — the posterior uniform and the imputation the panel's allele
   frequency, the naive fill the model improves on.
   ========================================================================= */

/* 28 sites, not 36. The tiles print the base at each site, as the notebook's
   strings do, and 36 sites gave 13px cells at the narrowest canvas — 9px
   letters. 28 gives 17px there and 22px at the usual width. */
export const L_DEFAULT = 28;

/* Panel-building rates. `founders` independent haplotypes, then each further
   one is a mosaic of earlier ones — a copying process, so haplotypes share
   long segments the way a real panel's do. That sharing is what makes an
   untyped site imputable: the typed neighbours name the segment, the segment
   names the allele. Two founders rather than three: measured over 300 seeds,
   three left 25% of blanks wrong at 1-in-4 typing against 20% with two, and
   the two-clade panel is the one whose mosaic can be seen. */
const PANEL = { founders: 2, switch: 0.08, mut: 0.05 };

/* The sample is a mosaic of the panel with `switches` recombination points
   and a small rate of variants the panel does not carry. Those novel sites are
   the honest failure: an untyped novel allele cannot be imputed by copying. */
const NOVEL_MUT = 0.025;

/* Recombination points sit at least MIN_SEG sites apart and from either end,
   so every segment of the mosaic is long enough to be seen and to be typed
   at least once at the sparsest density the widget offers. Drawn without that
   rule, seed 1 put its two switches at sites 21 and 22. */
const MIN_SEG = 5;

/* Mismatch allowance in the emission — the notebook's model has none, which
   makes a single novel typed allele zero out every state. Fixed and small. */
export const EPS = 0.02;

/* Two letters per site so a figure can print nucleotides as the lesson does;
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

/* ----------------------------------------------------------------------------
   The decoder, shared by both tabs.

     emit[i][h]   P(observation at i | state h): 1 where nothing is known
     rho          P(switch) per interval, landing uniformly on the OTHER K-1
                  states — so on the Toy tab rho is exactly the notebook's
                  off-diagonal, and on the Biological tab it is the chance the
                  copied haplotype changes between neighbouring sites

   Returns gamma[i][h] (the posterior), path[i] (the Viterbi state) and the
   log-likelihood. Forward and backward are scaled per position, so 36 sites
   by 8 states never underflows. */
export function decode(emit, K, rho) {
  const L = emit.length;
  const stay = 1 - rho, move = K > 1 ? rho / (K - 1) : 0;
  const fwd = [], scale = new Array(L);
  let prev = null;
  for (let i = 0; i < L; i += 1) {
    const a = new Array(K);
    let tot = 0;
    for (let h = 0; h < K; h += 1) {
      /* prev sums to 1, so the mass arriving from elsewhere is move·(1 - prev[h]) */
      const from = prev === null ? 1 / K : stay * prev[h] + move * (1 - prev[h]);
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
    for (let h = 0; h < K; h += 1) { b[h] = stay * eb[h] + move * (all - eb[h]); tot += b[h]; }
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
  const { path } = viterbiTrellis(emit, K, rho);
  const logLik = scale.reduce((s, c) => s + Math.log(c), 0);
  return { gamma, path, logLik };
}

/* The Viterbi trellis, kept whole so a figure can animate it.
     V[i][h]      log of the best path's probability ending in state h at i
     score[i][h]  the same, exponentiated and normalised within the column —
                  the raw products fall below 0.01 within a dozen positions,
                  so a printed trellis shows each column's RELATIVE scores
     back[i][h]   the state at i-1 that best path came from (-1 at i = 0)
     path         the backtrace from the best final state
   Ties go to staying, so an unknown stretch never wanders. */
export function viterbiTrellis(emit, K, rho) {
  const L = emit.length;
  const stay = 1 - rho, move = K > 1 ? rho / (K - 1) : 0;
  const lStay = Math.log(stay), lMove = move > 0 ? Math.log(move) : -Infinity;
  const V = [], back = [], score = [];
  for (let i = 0; i < L; i += 1) {
    const v = new Array(K), bp = new Array(K);
    for (let h = 0; h < K; h += 1) {
      const le = Math.log(emit[i][h]);
      if (i === 0) { v[h] = Math.log(1 / K) + le; bp[h] = -1; continue; }
      let best = V[i - 1][h] + lStay, from = h;
      for (let g = 0; g < K; g += 1) {
        if (g === h) continue;
        const cand = V[i - 1][g] + lMove;
        if (cand > best) { best = cand; from = g; }
      }
      v[h] = best + le; bp[h] = from;
    }
    const top = Math.max(...v);
    const ex = v.map((x) => Math.exp(x - top));
    const tot = ex.reduce((a, b) => a + b, 0);
    V.push(v); back.push(bp); score.push(ex.map((x) => x / tot));
  }
  const path = new Array(L);
  let h = 0;
  for (let k = 1; k < K; k += 1) if (V[L - 1][k] > V[L - 1][h]) h = k;
  for (let i = L - 1; i >= 0; i -= 1) { path[i] = h; h = back[i][h]; }
  return { V, score, back, path };
}

/* How many units the animation has, so main.js and the node driver agree:
   the toy steps the Viterbi trellis forward one column at a time and then
   traces back one column at a time; the biological tab reveals one typed
   site per step. */
export function animationUnits(state) {
  return state.kind === "mood" ? 2 * state.L : state.order.length;
}

/* Stage t of the reveal: the first t positions of `order` are known.
   `emitKnown(i, h)` is the emission at a known position; blanks emit 1. */
function revealStages(K, L, order, emitKnown, rho) {
  const out = [];
  for (let t = 0; t <= order.length; t += 1) {
    const known = new Set(order.slice(0, t));
    const emit = [];
    for (let i = 0; i < L; i += 1) {
      const row = new Array(K).fill(1);
      if (known.has(i)) for (let h = 0; h < K; h += 1) row[h] = emitKnown(i, h);
      emit.push(row);
    }
    out.push({ t, known, ...decode(emit, K, rho) });
  }
  return out;
}

/* ----------------------------------------------------------------------------
   THE TOY TAB — the notebook's mood example, generated from the model it is decoded
   with. Two patterns; pattern 2 is Happy with probability `happy`, pattern 1
   with 1 - happy; the pattern persists with probability 1 - rho. `missing`
   days are unrecorded completely at random. Mood 1 is Happy, 0 is Sad. */
export function buildMood({ rng, days, missing, happy, rho }) {
  const K = 2, L = days;
  const E = [
    [happy, 1 - happy],   // pattern 1: P(Sad), P(Happy)
    [1 - happy, happy],   // pattern 2
  ];
  const src = new Array(L), mood = new Array(L);
  let s = rng.next() < 0.5 ? 1 : 0;
  for (let i = 0; i < L; i += 1) {
    if (i > 0 && rng.next() < rho) s = 1 - s;
    src[i] = s;
    mood[i] = rng.next() < E[s][1] ? 1 : 0;
  }
  const m = Math.min(missing, Math.max(0, L - 2));
  const gone = new Set(shuffledIdx(rng, L).slice(0, m));
  const order = [];
  for (let i = 0; i < L; i += 1) if (!gone.has(i)) order.push(i);
  /* The toy animates Viterbi over the whole recorded sequence, so the trellis
     is computed once here: blanks emit 1, recorded days emit E[state][mood]. */
  const emit = [];
  for (let i = 0; i < L; i += 1) emit.push(gone.has(i) ? [1, 1] : [E[0][mood[i]], E[1][mood[i]]]);
  const trellis = viterbiTrellis(emit, K, rho);
  const stages = revealStages(K, L, order, (i, h) => E[h][mood[i]], rho).map((st) => {
    const sites = [];
    let sure = 0, correct = 0, stateRight = 0;
    for (let i = 0; i < L; i += 1) {
      const isKnown = st.known.has(i);
      const p1 = st.gamma[i][0] * E[0][1] + st.gamma[i][1] * E[1][1];
      const call = isKnown ? mood[i] : (p1 > 0.5 ? 1 : 0);
      const conf = isKnown ? 1 : Math.max(p1, 1 - p1);
      if (st.path[i] === src[i]) stateRight += 1;
      if (gone.has(i)) {
        if (conf >= 0.9) sure += 1;
        if (call === mood[i]) correct += 1;
      }
      sites.push({ known: isKnown, blank: gone.has(i), p1, call, conf });
    }
    return { ...st, sites, blanks: m, sure, correct, stateRight };
  });
  return { kind: "mood", K, L, E, rho, src, truthAllele: mood, gone, order, stages, trellis };
}

/* ----------------------------------------------------------------------------
   THE BIOLOGICAL TAB — genotype imputation. */
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

export function buildGenotype({ rng, K, L = L_DEFAULT, every, switches, rho, panelOpts }) {
  const panel = makePanel(rng, K, L, panelOpts);
  const sample = makeSample(rng, panel, switches);
  const order = typedSites(L, every);
  const typed = new Set(order);
  const emitKnown = (i, h) => (panel.hap[h][i] === sample.allele[i] ? 1 - EPS : EPS);
  const stages = revealStages(K, L, order, emitKnown, rho).map((st) => {
    /* Per site: the posterior of allele 1, the call, its confidence, the
       Viterbi copy, and the frequency fill — read from the copied haplotype,
       so a typed site is its own observation and an untyped one is the copy. */
    const sites = [];
    let sure = 0, correct = 0, freqCorrect = 0, viterbiCorrect = 0;
    for (let i = 0; i < L; i += 1) {
      let p1 = 0, f1 = 0;
      for (let h = 0; h < K; h += 1) {
        const a = panel.hap[h][i];
        p1 += st.gamma[i][h] * (a === 1 ? 1 - EPS : EPS);
        f1 += a;
      }
      f1 /= K;
      const isKnown = st.known.has(i);
      const call = isKnown ? sample.allele[i] : (p1 > 0.5 ? 1 : 0);
      const conf = isKnown ? 1 : Math.max(p1, 1 - p1);
      const viterbi = isKnown ? sample.allele[i] : panel.hap[st.path[i]][i];
      const freqCall = f1 > 0.5 ? 1 : 0;
      if (!typed.has(i)) {
        if (conf >= 0.9) sure += 1;
        if (call === sample.allele[i]) correct += 1;
        if (freqCall === sample.allele[i]) freqCorrect += 1;
        if (viterbi === sample.allele[i]) viterbiCorrect += 1;
      }
      sites.push({ known: isKnown, blank: !typed.has(i), p1, call, conf, viterbi, freqCall });
    }
    return { ...st, sites, blanks: L - order.length, sure, correct, freqCorrect, viterbiCorrect };
  });
  return { kind: "genotype", K, L, rho, panel, sample, src: sample.src, truthAllele: sample.allele,
    novel: sample.novel, cutSites: sample.cutSites, order, stages };
}
