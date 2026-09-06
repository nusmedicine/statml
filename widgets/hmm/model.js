/* ============================================================================
   Widget 45 · Hidden Markov model — the engine, kept out of main.js so the
   `_lab/hmm-*` pages and scripts measure the same numbers the figure draws.

   PHM5003 HTD `05 / 02 — Missing Data and Imputation`, cells 24–38: the
   INTENTIONAL missing data of a SNP array, filled from a reference panel of
   sequenced haplotypes with a hidden Markov model. The notebook builds up to
   it with a toy — two KNOWN mood patterns, P1 = Sad Happy Sad Sad Happy and
   P2 = Happy Happy Happy Happy Sad, and a record Happy ? ? Happy ? to place
   against them — and the widget keeps that order: the Toy tab first, the
   Biological tab second, and ONE copying model serves both:

     hidden state at position i   WHICH template the record is following —
                                  a mood pattern, or a panel haplotype
     transition                   stay on it, or switch (a change of pattern,
                                  a recombination)
     emission at a known position the template's own value at that position,
                                  or a deviation from it
     emission at a blank          nothing observed: every state equally likely

   That is the Li & Stephens (2003) copying model every imputation program
   descends from, at two templates on the toy and K on the biology. The toy
   was first built with a stochastic emission — a pattern was Happy with
   probability 0.8 — and Kenneth hit its ceiling at once: a mood drawn from
   its pattern cannot be reconstructed, only given a probability, and turning
   the dials remade the truth rather than the model. Rebuilt 2026-09-06 on
   the notebook's own narrative: the two patterns are known, the emission is
   read off them day by day, and a missing day is read off the decoded
   pattern. Two things still differ from the notebook on purpose:

   1. The emission is POSITION-SPECIFIC. The notebook's emission matrix is
      each pattern's (or haplotype's) composition, the same at every
      position, normalised down the columns; its genotype example then fills
      the blanks position by position from the haplotype anyway. Here a state
      emits what its template carries AT THAT POSITION, or a deviation with a
      small probability — 0.1 for a mood, 0.02 for an allele.
   2. Forward–backward is computed as well as Viterbi. Viterbi gives one path;
      the posterior gives, per position, how sure the call is — and the blanks
      between two known positions, or past the last one, are where it is not.
      An imputed genotype carries that number in practice (a dosage), and a
      figure that hides it would draw an imputation as if it were a read.

   THE ANIMATION IS THE VITERBI ALGORITHM ON BOTH TABS, precomputed here so
   `advance` reveals and never computes: the trellis forward one column at a
   time, then the trace-back. The reveal stages — the first t known positions
   revealed, the whole posterior recomputed — are still computed: the figure
   draws the last one, and `_lab/hmm-mock.html` previews all of them.
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

/* Deviation allowances in the emission — the notebook's model has none, which
   makes a single novel typed allele zero out every state. A mood strays from
   its pattern more often than a base from its haplotype. */
export const EPS = 0.02;        // an allele that is not the copied haplotype's
export const DEVIATE = 0.1;     // a day whose mood is not its pattern's

/* THE NOTEBOOK'S TOY, verbatim: cells 26–29. Mood 1 is Happy, 0 is Sad; the
   record follows P2 and days 2, 3 and 5 are unrecorded. */
export const NOTEBOOK = {
  P1: [0, 1, 0, 0, 1],
  P2: [1, 1, 1, 1, 0],
  follows: 1,
  gone: [1, 2, 4],
};

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

/* Change points at least `minSeg` apart and from either end. */
function cutPoints(rng, L, count, minSeg) {
  const cuts = [];
  const span = L - 2 * minSeg + 1;
  if (span > 0) {
    for (const c of shuffledIdx(rng, span).map((i) => i + minSeg)) {
      if (cuts.length === count) break;
      if (cuts.every((d) => Math.abs(d - c) >= minSeg)) cuts.push(c);
    }
  }
  return cuts.sort((a, b) => a - b);
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
   both tabs step the Viterbi trellis forward one column at a time and then
   trace back one column at a time. */
export function animationUnits(state) {
  return 2 * state.L;
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
   ONE COPYING MODEL FOR BOTH TABS. `templates[h][i]` is what state h carries
   at position i; `truth[i]` is what the record actually holds there; `order`
   lists the known positions; `eps` is the deviation allowance. */
function buildCopying({ kind, K, L, templates, letters, src, truth, novel, cutSites, order, eps, rho }) {
  const knownSet = new Set(order);
  const emitKnown = (i, h) => (templates[h][i] === truth[i] ? 1 - eps : eps);
  const emit = [];
  for (let i = 0; i < L; i += 1) emit.push(Array.from({ length: K }, (_, h) => (knownSet.has(i) ? emitKnown(i, h) : 1)));
  const trellis = viterbiTrellis(emit, K, rho);
  const stages = revealStages(K, L, order, emitKnown, rho).map((st) => {
    /* Per position: the posterior of value 1, the call, its confidence, the
       Viterbi copy, and the majority fill — a known position is its own
       observation, a blank one is the copy. */
    const sites = [];
    let sure = 0, correct = 0, freqCorrect = 0, viterbiCorrect = 0;
    for (let i = 0; i < L; i += 1) {
      let p1 = 0, f1 = 0;
      for (let h = 0; h < K; h += 1) {
        const a = templates[h][i];
        p1 += st.gamma[i][h] * (a === 1 ? 1 - eps : eps);
        f1 += a;
      }
      f1 /= K;
      const isKnown = st.known.has(i);
      const call = isKnown ? truth[i] : (p1 > 0.5 ? 1 : 0);
      const conf = isKnown ? 1 : Math.max(p1, 1 - p1);
      const viterbi = isKnown ? truth[i] : templates[st.path[i]][i];
      const freqCall = f1 > 0.5 ? 1 : 0;
      if (!knownSet.has(i)) {
        if (conf >= 0.9) sure += 1;
        if (call === truth[i]) correct += 1;
        if (freqCall === truth[i]) freqCorrect += 1;
        if (viterbi === truth[i]) viterbiCorrect += 1;
      }
      sites.push({ known: isKnown, blank: !knownSet.has(i), p1, call, conf, viterbi, freqCall });
    }
    return { ...st, sites, blanks: L - order.length, sure, correct, freqCorrect, viterbiCorrect };
  });
  return {
    kind, K, L, rho, eps,
    panel: { hap: templates, letters },
    sample: { src, allele: truth, novel, cutSites },
    src, truthAllele: truth, novel, cutSites, order, stages, trellis,
  };
}

/* ----------------------------------------------------------------------------
   THE TOY TAB — the notebook's narrative. Two KNOWN patterns; a record that
   follows one of them (changing `changes` times if asked), deviating from it
   on a day with probability DEVIATE, with `missing` days unrecorded completely
   at random. `notebook: true` reproduces cells 26–29 exactly: the two
   five-day patterns, the record Happy ? ? Happy ?, no deviation. */
export function buildToy({ rng, days, missing, changes, rho, notebook = false }) {
  const K = 2;
  let L, templates, src, truth, novel, cutSites, order;
  if (notebook) {
    L = NOTEBOOK.P1.length;
    templates = [NOTEBOOK.P1.slice(), NOTEBOOK.P2.slice()];
    src = new Array(L).fill(NOTEBOOK.follows);
    truth = templates[NOTEBOOK.follows].slice();
    novel = new Array(L).fill(false);
    cutSites = [];
    const gone = new Set(NOTEBOOK.gone);
    order = [];
    for (let i = 0; i < L; i += 1) if (!gone.has(i)) order.push(i);
  } else {
    L = days;
    /* Two patterns that differ on at least a third of the days, so a record
       can tell them apart with a few of its days. */
    const need = Math.max(2, Math.ceil(L / 3));
    do {
      templates = [0, 1].map(() => Array.from({ length: L }, () => (rng.next() < 0.5 ? 1 : 0)));
    } while (templates[0].filter((v, i) => v !== templates[1][i]).length < need);
    cutSites = cutPoints(rng, L, changes, Math.max(2, Math.floor(L / 4)));
    src = new Array(L); truth = new Array(L); novel = new Array(L).fill(false);
    let h = rng.next() < 0.5 ? 1 : 0;
    for (let i = 0; i < L; i += 1) {
      if (cutSites.includes(i)) h = 1 - h;
      src[i] = h;
      truth[i] = templates[h][i];
      if (rng.next() < DEVIATE) { truth[i] = 1 - truth[i]; novel[i] = true; }
    }
    const m = Math.min(missing, Math.max(0, L - 2));
    const gone = new Set(shuffledIdx(rng, L).slice(0, m));
    order = [];
    for (let i = 0; i < L; i += 1) if (!gone.has(i)) order.push(i);
  }
  const letters = Array.from({ length: L }, () => ["S", "H"]);
  return buildCopying({ kind: "mood", K, L, templates, letters, src, truth, novel, cutSites, order, eps: DEVIATE, rho });
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
  const cutSites = cutPoints(rng, L, switches, MIN_SEG);
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
  return buildCopying({
    kind: "genotype", K, L, templates: panel.hap, letters: panel.letters,
    src: sample.src, truth: sample.allele, novel: sample.novel, cutSites: sample.cutSites,
    order: typedSites(L, every), eps: EPS, rho,
  });
}
