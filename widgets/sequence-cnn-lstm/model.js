/* ============================================================================
   Widget 75 · Sequences: CNN and LSTM — the arithmetic, and nothing that draws.

   PHM5005 07-3 cells 26–178: the lesson's `CNN1D`, `BiLSTM` and `CNN_LSTM`
   on tokenized DNA (200 bp padded to 250, vocabulary `* A C G T` plus UNK),
   then Captum's `Occlusion` with PAD as the baseline. `../signal-cnn-lstm/
   engine.js` is the layers, the recurrence and the optimiser — the arc's
   engine, born in 73; this file is the STAGE (what a sequence is), the
   lesson's nets at the width the browser affords, the effective position
   weight matrix a kernel is, the packed recurrence, and the occlusion walk
   on tokens. `_lab/sequence-models-measure.mjs` measures every number a
   comment here quotes.

   THE STAGE IS NOT THE LESSON'S DATA. The lesson classifies coding against
   intergenic 200-mers (Genomic Benchmarks) and human against animal influenza
   HA proteins. A widget whose CNN page reads a kernel as a motif needs a
   motif that IS the evidence, so class 1 is a random 200-mer with `copies`
   of TGACTCA (the AP-1 site, 7 bp) planted, and class 0 a random 200-mer. A
   7-mer occurs by chance once per 16 kb, so about one class-0 sequence in a
   hundred carries it. The lesson's `MAX_LEN = 250` pads every one of its
   sequences by exactly 50 (all are 200 bp), and so does the stage.

   THE STAGE HAS TWO TASKS. A recurrence at H = 8 never finds a 7-mer in 200
   random bases in any budget measured (to 18 s, it memorises), but it reads
   COMPOSITION — G or C drawn with probability 0.7 against 0.3, the lesson's
   coding-against-intergenic in proxy — so `task` is a data parameter and
   each model has a task it can win; the CNN wins both.

   THE NETS ARE THE LESSON'S AT HALF WIDTH. 07-3 cell 28 (as instantiated,
   not the prototype of cell 26, which has a MaxPool the run does not):
   `Embedding(V, E, padding_idx=0)` → `Conv1d(E, 16, 7, s2, p3)` → ReLU →
   `Conv1d(16, 32, 5, s2, p2)` → ReLU → `AdaptiveMaxPool1d(1)` → `Linear(32, 2)`,
   here 8 / 16 channels, one-hot input, and stride 1 in the first layer by
   default: at the lesson's stride 2 a trained net reads the motif at ONE
   offset parity — even only, or odd only, the seed decides — so stride is a
   control whose readout is the score by the motif's offset parity (the
   means over seeds that first read as "no effect" were two parities
   cancelling; `_lab/sequence-models-measure.mjs` S4).
   Cell 47's BiLSTM packs the sequence and reads the final forward and
   backward states; cell 67's CNN + LSTM is one convolution with no stride
   under the same recurrence — the page stands on page 1's trained first
   layer instead, frozen, as 73's did. Dropout is left out: it changes
   nothing a page draws and 50 owns it. The budgets and the restart rule are
   under `trainRestarts`; the sweeps that found them are in `_lab/`.
   ========================================================================= */

import * as E from "../signal-cnn-lstm/engine.js";

export const VOCAB = ["*", "A", "C", "G", "T", "N"];   // the lesson's ids 0–4, UNK 5
export const PAD = 0, UNK = 5, BASES = [1, 2, 3, 4];
export const LEN = 200;                // every lesson sequence is 200 bp
export const MAX_LEN = 250;            // the lesson's MAX_LEN: 50 PAD on every one
export const MOTIF = "TGACTCA";        // AP-1, 7 bp
export const C1 = 8, C2 = 16;          // half the lesson's 16 / 32
export const H_LSTM = 8;               // the lesson's hidden is 128
export const KERNELS = [3, 5, 7, 11];  // read in bases

const F = (n) => new Float64Array(n);
export const tokOf = (ch) => Math.max(0, VOCAB.indexOf(ch));

/* ------------------------------------------------------------ the stage --- */

/**
 * One sequence: 200 random bases, class 1 with `copies` of the motif planted
 * at positions that do not overlap, padded to 250 with PAD. Returns the
 * token array the nets read (`x = { tok, L: 250, len: 200 }`), the class and
 * the planted positions so a page can mark them.
 */
export function sequence(rng, cls, { copies = 1, task = "motif", gc = 0.6 } = {}) {
  const tok = new Int32Array(MAX_LEN);
  const motifAt = [];
  if (task === "composition") {
    /* GC-rich against GC-poor: class 1 draws G or C with probability `gc`,
       class 0 with 1 − gc; no motif anywhere. The lesson's coding regions are
       GC-richer than its intergenic ones, so this is that task in proxy. */
    const p = cls === 1 ? gc : 1 - gc;
    for (let t = 0; t < LEN; t++) tok[t] = rng.next() < p ? (rng.next() < 0.5 ? 2 : 3) : (rng.next() < 0.5 ? 1 : 4);
    return { x: { tok, L: MAX_LEN, len: LEN }, y: cls, motifAt };
  }
  for (let t = 0; t < LEN; t++) tok[t] = BASES[Math.floor(rng.next() * 4)];
  if (cls === 1) {
    const m = MOTIF.length;
    let guard = 0;
    while (motifAt.length < copies && guard++ < 1000) {
      const s = Math.floor(rng.next() * (LEN - m + 1));
      if (motifAt.some((p) => Math.abs(p - s) < m + 2)) continue;
      motifAt.push(s);
    }
    for (const s of motifAt) for (let j = 0; j < m; j++) tok[s + j] = tokOf(MOTIF[j]);
    motifAt.sort((a, b) => a - b);
  }
  return { x: { tok, L: MAX_LEN, len: LEN }, y: cls, motifAt };
}

/** `n` sequences, classes alternating so every batch is balanced. */
export function dataset(rng, n, copies, opts = {}) {
  return Array.from({ length: n }, (_, i) => sequence(rng, i % 2, { copies, ...opts }));
}

/** the GC fraction of the real tokens, for a composition readout */
export function gcOf(tok, len = LEN) { let n = 0; for (let t = 0; t < len; t++) if (tok[t] === 2 || tok[t] === 3) n++; return n / len; }

/** where the motif occurs in a token array, planted or by chance */
export function motifHits(tok, len = LEN) {
  const m = MOTIF.length, out = [];
  for (let s = 0; s + m <= len; s++) { let ok = true; for (let j = 0; j < m && ok; j++) if (VOCAB[tok[s + j]] !== MOTIF[j]) ok = false; if (ok) out.push(s); }
  return out;
}

/* ---------------------------------------------------------- embeddings --- */

/** one-hot rows for the six ids: PAD zero, A C G T the unit vectors, UNK a
    quarter each (an N, any base) */
export const ONE_HOT = [[0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [0.25, 0.25, 0.25, 0.25]];

/** the lesson's `Embedding(num_tokens, E, padding_idx=0)`, or the fixed
    one-hot table when `code` is "onehot" */
export function embedding(rng, { code = "learned", E: dim = 8 } = {}) {
  return code === "onehot" ? E.Embedding(rng, VOCAB.length, 4, PAD, ONE_HOT) : E.Embedding(rng, VOCAB.length, dim, PAD);
}

/* -------------------------------------------------------------- the CNN --- */

export const samePad = (k) => Math.floor(k / 2);

/**
 * 07-3 cell 28's CNN1D at half width: the embedding, `Conv1d(E, 8, k, s2,
 * p⌊k/2⌋)`, ReLU, `Conv1d(8, 16, 5, s2, p2)`, ReLU, global max (the lesson's
 * choice, robust to PAD) or average, `Linear(16, 2)`. `bias` is the lesson's
 * optional `bias=False` on the convolutions.
 */
export function buildCnn(rng, { code = "learned", E: dim = 8, k = 7, stride = 2, bias = true, pool = "max", channels = [C1, C2] } = {}) {
  const emb = embedding(rng, { code, E: dim });
  const [c1, c2] = channels;
  const net = E.Sequential([
    emb, E.Conv1d(rng, emb.E, c1, k, stride, samePad(k), bias), E.ReLU(),
    E.Conv1d(rng, c1, c2, 5, 2, 2, bias), E.ReLU(), E.GlobalPool(c2, pool),
    E.Linear(rng, c2, 2),
  ]);
  net.emb = emb; net.conv1 = net.layers[1]; net.conv2 = net.layers[3]; net.pool = net.layers[5]; net.c1 = c1; net.c2 = c2;
  return net;
}

/** Train in place; returns the per-epoch mean loss. `data` may be a function
    of the epoch (a fresh draw each time — the stage is synthetic). */
export function trainNet(rng, net, data, { epochs = 20, lr = 1e-3 } = {}) {
  const curve = [];
  E.train(rng, net, data, { epochs, lr, onEpoch: (_, l) => curve.push(l) });
  return curve;
}

/**
 * The CNN page's training rule, from the seven budget sweeps of 2026-09-20
 * (`_lab/sequence-models-sweep*.mjs`): whether a seed finds the planted 7-mer
 * is decided by its INITIALISATION — with one init, about one seed in four at
 * 16/16 channels and one in two at 8/16 never does, whatever the rate, batch,
 * width or epochs, because no kernel starts near enough to the motif for the
 * global max to hand it the gradient. Random restarts are the standard
 * remedy: `restarts` initialisations each trained `probe` epochs on fresh
 * sequences, the one whose loss fell kept and finished. At 8/16, three
 * restarts probed six epochs and finished to twenty: ten seeds of ten at 98%
 * or better, 2.3 s (the probe loss of the winner 0.01–0.11 against 0.4–0.7).
 * Returns the finished net, its loss curve (the winner's probe then its
 * finish), and every candidate's probe loss so a page can print them.
 */
export function trainRestarts(rng, build, draw, { restarts = 3, probe = 6, epochs = 20, lr = 1e-2 } = {}) {
  const cands = [];
  for (let r = 0; r < restarts; r++) {
    const net = build(rng);
    const curve = [];
    E.train(rng, net, draw, { epochs: probe, lr, onEpoch: (_, l) => curve.push(l) });
    cands.push({ net, curve });
  }
  const probes = cands.map((c) => c.curve[c.curve.length - 1]);
  let best = 0; for (let i = 1; i < cands.length; i++) if (probes[i] < probes[best]) best = i;
  const win = cands[best];
  E.train(rng, win.net, draw, { epochs: epochs - probe, lr, onEpoch: (_, l) => win.curve.push(l) });
  return { net: win.net, curve: win.curve, probes, best };
}

/**
 * The dimension chain (cell 26's table) for the page's `k`: each layer's
 * output length and the receptive field of one output in bases, with its
 * jump — `r + (k − 1)·jump`, 61's recurrence. Also which final positions
 * read PAD only, so a page can shade the outputs the global max may land on.
 */
export function chain({ k = 7, stride = 2 } = {}) {
  const rows = [];
  let l = MAX_LEN, r = 1, j = 1, centre0 = 0;
  const step = (name, kk, s, pp) => {
    l = E.convOut(l, kk, s, pp);
    centre0 += ((kk - 1) / 2 - pp) * j;   // input position under output 0's centre
    r += (kk - 1) * j; j *= s;
    rows.push({ name, L: l, rf: r, jump: j, centre0 });
  };
  step(`Conv1 k${k} s${stride} p${samePad(k)}`, k, stride, samePad(k));
  step("Conv2 k5 s2 p2", 5, 2, 2);
  const last = rows[rows.length - 1];
  const half = (last.rf - 1) / 2;
  const padOnly = [], padTouch = [];
  for (let t = 0; t < last.L; t++) { const c = last.centre0 + t * last.jump; if (c - half >= LEN) padOnly.push(t); else if (c + half >= LEN) padTouch.push(t); }
  return { rows, padOnly, padTouch };
}

/**
 * What kernel `c` of the first convolution IS, read against the four bases:
 * the effective [4, k] matrix Σ_e W[c, e, j] · Emb[b, e] — the score the
 * kernel gives base b at offset j. On one-hot input this is the kernel
 * itself; through a learned embedding it is the kernel composed with the
 * table. `spell` is its column argmax as a string, the DeepBind reading.
 */
export function pwm(net, c) {
  const conv = net.conv1, emb = net.emb, k = conv.k, Ein = conv.cin;
  const M = BASES.map((b) => F(k));
  for (let bi = 0; bi < 4; bi++) for (let j = 0; j < k; j++) {
    let s = 0; for (let e = 0; e < Ein; e++) s += conv.W.v[(c * Ein + e) * k + j] * emb.W.v[BASES[bi] * emb.E + e];
    M[bi][j] = s;
  }
  let spell = "";
  for (let j = 0; j < k; j++) { let bi = 0; for (let q = 1; q < 4; q++) if (M[q][j] > M[bi][j]) bi = q; spell += "ACGT"[bi]; }
  return { M, spell, k };
}

/**
 * How many of the motif's columns a spelling matches, at the best ALIGNMENT:
 * a kernel slid at stride 1 meets the motif at every shift, so a trained
 * kernel may spell the motif's second half from its first column (CTCA…),
 * and a reading at zero offset alone calls that no match. Overlaps of fewer
 * than four columns are not counted. Returns the count and the shift of the
 * kernel's first column relative to the motif's (negative: the kernel
 * starts before the motif).
 */
export function spellAlign(spell, motif = MOTIF) {
  let best = { match: 0, offset: 0 };
  for (let off = -(spell.length - 4); off <= motif.length - 4; off++) {
    let n = 0, overlap = 0;
    for (let j = 0; j < spell.length; j++) { const m = j + off; if (m < 0 || m >= motif.length) continue; overlap++; if (spell[j] === motif[m]) n++; }
    if (overlap >= 4 && n > best.match) best = { match: n, offset: off };
  }
  return best;
}

/** the kernels ranked by how much class 1 wants them: the head's weight on
    each channel of the second convolution is not per first-layer kernel, so
    rank first-layer kernels by their PWM's match to the motif instead, and
    return every one with its spelling and its alignment */
export function kernelsSpelled(net) {
  return Array.from({ length: net.c1 ?? C1 }, (_, c) => { const p = pwm(net, c); return { c, ...p, ...spellAlign(p.spell) }; }).sort((a, b) => b.match - a.match);
}

/** the first convolution's output for channel `c` before ReLU: the kernel's
    score at every position (stride 2, so 125 of them) */
export function scoreTrack(net, x, c) {
  const a = net.emb.forward(x);
  const y = net.conv1.forward(a);
  const L = y.L;
  return Float64Array.from({ length: L }, (_, t) => y.d[c * L + t]);
}

/** the score of a fixed [4, k] matrix at every position of a token array
    (stride 1), for a kernel the page hands the reader before training */
export function pwmScan(M, tok, len = LEN) {
  const k = M[0].length, out = F(len - k + 1);
  for (let s = 0; s + k <= len; s++) { let v = 0; for (let j = 0; j < k; j++) { const bi = BASES.indexOf(tok[s + j]); if (bi >= 0) v += M[bi][j]; } out[s] = v; }
  return out;
}

/** the hand-made motif kernel of the measurement: +1 on the motif's base, −1/3 elsewhere */
export function motifKernel(motif = MOTIF) {
  return BASES.map((_, bi) => Float64Array.from(motif, (ch) => ("ACGT"[bi] === ch ? 1 : -1 / 3)));
}

/* ------------------------------------------------------------- the LSTM --- */

const toSeq = (a, C, T) => Array.from({ length: T }, (_, t) => { const v = F(C); for (let c = 0; c < C; c++) v[c] = a.d[c * a.L + t]; return v; });

/**
 * A token sequence model as 07-3 cells 47 and 67 build it: the embedding,
 * optionally one convolution with no stride (cell 67's `Conv1d(E, C, 7, p3)`
 * → ReLU), then the BiLSTM over the steps and ONE reduction of its outputs.
 * `pack` is the lesson's `pack_padded_sequence`: the recurrence reads the
 * first `x.len` steps and no PAD, so "last" is the state after the last real
 * token; unpacked, it reads all 250 and "last" is the state after 50 PADs.
 * The reduction is trained into the head, so it is a data parameter (73).
 */
export function buildSeqModel(rng, { code = "learned", E: dim = 8, conv = false, k = 7, H = H_LSTM, pack = true, reduce = "last", direction = "bi" } = {}) {
  const emb = embedding(rng, { code, E: dim });
  const front = conv ? [emb, E.Conv1d(rng, emb.E, C1, k, 1, samePad(k)), E.ReLU()] : [emb];
  const D = conv ? C1 : emb.E;
  const clf = E.SeqClassifier(rng, { cellKind: "lstm", D, H, bidirectional: direction === "bi", pool: reduce });
  const model = {
    emb, front, clf, D, H, pack, reduce, direction,
    params: [...front.flatMap((l) => l.params), ...clf.params],
    forward(x) {
      let a = x; for (const l of front) a = l.forward(a);
      const T = pack ? x.len : a.L;
      model.T = T; model.Lfull = a.L;
      return clf.forward(toSeq(a, D, T));
    },
    backward(g) {
      const dX = clf.backward(g);
      const d = F(D * model.Lfull);
      for (let t = 0; t < model.T; t++) for (let c = 0; c < D; c++) d[c * model.Lfull + t] = dX[t][c];
      let dy = { d, L: model.Lfull };
      for (let i = front.length - 1; i >= 0; i--) dy = front[i].backward(dy);
    },
  };
  return model;
}

/**
 * 73's CNN + LSTM reading, for a page that stands on page 1's trained
 * convolution: the first convolution's maps after ReLU as a sequence of
 * `C1`-vectors, one per output position, and how many of them read real
 * bases (the packed length in feature steps).
 */
export function convFeatures(cnn, x) {
  const a = cnn.layers[2].forward(cnn.conv1.forward(cnn.emb.forward(x)));
  const lenFeat = E.convOut(x.len, cnn.conv1.k, cnn.conv1.stride, cnn.conv1.pad);
  return { feats: toSeq(a, cnn.c1 ?? C1, a.L), lenFeat, T: a.L, D: cnn.c1 ?? C1 };
}

/** a recurrence over precomputed features (the frozen-convolution CNN + LSTM):
    `pack` slices each feature sequence to its real length */
export function buildFeatureLstm(rng, { D = C1, H = H_LSTM, pack = true, reduce = "last" } = {}) {
  const clf = E.SeqClassifier(rng, { cellKind: "lstm", D, H, bidirectional: true, pool: reduce });
  const model = {
    clf, H, pack, reduce, params: clf.params,
    forward(f) { const T = pack ? f.lenFeat : f.T; model.T = T; return clf.forward(f.feats.slice(0, T)); },
    backward(g) { clf.backward(g); },
  };
  return model;
}

/** Everything a page draws of one sequence through a trained recurrence: the
    block of outputs `[T, 2H]`, the reduced vector, the probability. */
export function seqReading(model, x) {
  const z = model.forward(x);
  const p = E.softmaxCE(z, 0).p;
  return { feats: model.clf.feats.map((r) => r.slice()), reduced: model.clf.z.slice(), p, T: model.T };
}

/** the prefix ending at base t, padded to 250 as every sequence is: a packed
    model stops at t, an unpacked one reads the PAD after it, as each would */
export function prefixAt(x, t) {
  const tok = new Int32Array(MAX_LEN); tok.set(x.tok.slice(0, t + 1));
  return { tok, L: MAX_LEN, len: t + 1 };
}

/**
 * The running prediction: the trained model's probability if the sequence
 * ENDED at position t — the whole model on the padded prefix, every `every`
 * bases; a bidirectional model has no partial state, so the prefix is re-read.
 */
export function prefixCurve(model, x, every = 10) {
  const out = [];
  const at = (t) => { const z = model.forward(prefixAt(x, t)); return E.softmaxCE(z, 0).p[1]; };
  for (let t = every - 1; t < x.len; t += every) out.push({ t, p: at(t) });
  if (out.length === 0 || out[out.length - 1].t !== x.len - 1) out.push({ t: x.len - 1, p: at(x.len - 1) });
  return out;
}

/** how far the forward state moves over the PAD, relative to its norm at the
    last real token — the padding page's number, on a trained or fresh model */
export function padDrift(model, x) {
  model.forward({ ...x, len: x.len });
  const T = model.T, H = model.H, feats = model.clf.feats;
  const atLen = feats[x.len - 1], atEnd = feats[T - 1];
  let move = 0, norm = 0;
  for (let j = 0; j < H; j++) { move += (atEnd[j] - atLen[j]) ** 2; norm += atLen[j] ** 2; }
  return { move: Math.sqrt(move / Math.max(1e-12, norm)), T };
}

/* ------------------------------------------------------------- occlusion --- */

/**
 * Captum's recipe on tokens, kept window by window so a page can walk it:
 * the window's tokens set to the baseline id (PAD, the lesson's; or UNK),
 * the model asked again, |Δp|; the per-position map with overlaps averaged
 * as Captum returns it; PAD positions stripped as cell 174 does. `predict(x)`
 * is any trained model's p(class 1) — the CNN, the LSTM and the CNN + LSTM go
 * through the same walk.
 */
export function occlusionWalk(predict, x, { k = 8, stride = 4, baseline = "pad" } = {}) {
  const id = baseline === "unk" ? UNK : PAD;
  const base = predict(x);
  const windows = [];
  const attr = F(x.len), count = F(x.len);
  for (let s = 0; s + k <= x.L; s += stride) {
    if (s >= x.len) break;                         // a window wholly in PAD changes nothing
    const tok = x.tok.slice();
    for (let t = s; t < s + k; t++) tok[t] = id;
    const p = predict({ tok, L: x.L, len: x.len });
    const a = Math.abs(base - p);
    windows.push({ start: s, p, a });
    for (let t = s; t < Math.min(s + k, x.len); t++) { attr[t] += a; count[t]++; }
  }
  for (let t = 0; t < x.len; t++) attr[t] /= Math.max(1, count[t]);
  return { base, windows, attr, k, stride };
}

/** the half-max width of an attribution map, in bases */
export function halfMaxWidth(attr) {
  let m = -Infinity; for (const v of attr) if (v > m) m = v;
  let n = 0; for (const v of attr) if (v > m / 2) n++;
  return n;
}

/* ------------------------------------------------------------- the table --- */

/* The widget trains nothing (his pick, 2026-09-20: everything ahead, as
   65). `_lab/sequence-cnn-lstm-table.mjs` trains every setting with this
   file's nets and ships the weights as `table.js`; the page rebuilds a net
   from its spec and pours the weights back in, in `net.params` order, which
   is the build's order and nothing else's. Float32 in base64: exact for the
   verify's retrain-and-compare, and a third the size of decimal text. */

/** every parameter of a net, in order, as one Float32Array */
export function flatWeights(net) {
  const n = net.params.reduce((a, p) => a + p.v.length, 0), out = new Float32Array(n);
  let o = 0; for (const p of net.params) { out.set(p.v, o); o += p.v.length; }
  return out;
}

/** pour a flat vector back into a net's parameters; throws on a length that is not the net's */
export function loadWeights(net, flat) {
  const n = net.params.reduce((a, p) => a + p.v.length, 0);
  if (flat.length !== n) throw new Error(`weights: ${flat.length} values for a net of ${n} parameters`);
  let o = 0; for (const p of net.params) { for (let i = 0; i < p.v.length; i++) p.v[i] = flat[o + i]; o += p.v.length; }
  return net;
}

/** base64 of a Float32Array's bytes, and back — node and the browser */
export function encodeWeights(flat) {
  const bytes = new Uint8Array(flat.buffer, flat.byteOffset, flat.byteLength);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function decodeWeights(b64) {
  let bytes;
  if (typeof Buffer !== "undefined") bytes = new Uint8Array(Buffer.from(b64, "base64"));
  else { const s = atob(b64); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** the table's keys, one per setting the rail can reach */
export const keyCnn = ({ task, code, k, stride, pool }) => `cnn|${task}|${code}|k${k}|s${stride}|${pool}`;
export const keyLstm = ({ task, code, direction, pack }) => `lstm|${task}|${code}|${direction}|${pack ? "packed" : "unpacked"}`;
export const keyCombo = ({ task, code, k, stride, pool, reduce }) => `combo|${task}|${code}|k${k}|s${stride}|${pool}|${reduce}`;

/** the CNN + LSTM strip's shapes, the lesson's cell 67 */
export function comboShapes({ B = "B", Ed = 64, Cc = 64, H = 128 } = {}) {
  return [
    { name: "tokens", shape: [B, MAX_LEN] },
    { name: "Embedding", shape: [B, MAX_LEN, Ed] },
    { name: "transpose(1, 2)", shape: [B, Ed, MAX_LEN] },
    { name: "Conv1d k7 p3 · ReLU", shape: [B, Cc, MAX_LEN] },
    { name: "transpose · pack", shape: [B, LEN, Cc] },
    { name: "BiLSTM · final states", shape: [B, 2 * H] },
    { name: "Linear", shape: [B, 2] },
  ];
}
