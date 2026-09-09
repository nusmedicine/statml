/* ============================================================================
   Assertions on widget 53's engine — the arithmetic no picture can settle.

       node widgets/_lab/tensor-verify.mjs

   Imports `widgets/tensors/model.js`, the shipping code and not a copy (5.8).
   Every number here is the notebook's own printed output for PHM5005 05-2
   cells 3-69, so a failure means the widget is drawing something the lesson
   does not say.

   The two checks that most need a reader are sections 2 and 3. A destination
   map that is not a BIJECTION onto the result loses values silently: the
   figure would simply leave a cell empty at the end of the walk and nothing
   else in the repo would notice, because a pixel hash of a missing number is a
   perfectly stable pixel hash. And `reshape(2, 5, 2)` against
   `permute(0, 2, 1)` is the widget's whole argument — same shape, different
   contents — so the cells where they differ are asserted one by one rather
   than compared as a whole.

   Exits non-zero on failure.
   ========================================================================= */

import {
  T3, T3B, T3_SHAPE, DIM_ROLES, CELLS, srcIndex,
  R1, R2, R4, RANK_SHAPES, RANK_ROLES, dimLabels, rankSpec, selectionOf, COLON,
  indexSlot, indexSet, indexTargets, indexTargetCount,
  shapeOp, joinOp, opFrom, RESHAPE_SHAPES, RESHAPE_FAIL, PERMUTATIONS, shapeKey,
  reshapeFrom, parseShapeText, shapeWire, shapeShow,
  roleNames, roleLabels, NAME_SETS, shapeWalk, shapeSize, shapeText, indexText,
  BC_X, BC_X_SHAPE, BC_CASES, bCaseByValue, bName, alignment, broadcastPlan,
  MM_X, MM_X_SHAPE, MM_Y_SHAPE, MM_W, MM_WT, MM_Y, matmul, productTerms,
  MM_CASES, mmCaseByValue,
  RED_X, RED_X_SHAPE, RED_MU, RED_SD, RED_Z, REDUCERS,
  reduceGroups, reduceShape, reduceValues,
  UNIT_MS, unitMs, choreographs, num,
  torchPrint, sizeText,
} from "../tensors/model.js";

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);

function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 58)} ${detail}`);
}

const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* -- 1 · THE TENSORS ARE THE ONES THE LESSON PRINTS ------------------------ */
console.log("\n=== 1 · the given tensors ===");
{
  check("T is [2, 2, 5] holding 1-20 in reading order",
    same(T3_SHAPE, [2, 2, 5]) && same(T3.flat(2), Array.from({ length: 20 }, (_, i) => i + 1)),
    shapeText(T3_SHAPE));
  /* Round 12: the lesson's own T2 repeats 21-30 in both samples; the widget's
     is T + 20 so that no two cells of a join share a value. */
  check("T2 is T + 20: 21-40 in reading order, no value shared with T",
    same(T3B.flat(2), Array.from({ length: 20 }, (_, i) => i + 21))
    && new Set([...T3.flat(2), ...T3B.flat(2)]).size === 40,
    "every cell of a join carries its own value");
  check("CELLS is the size of one tensor", CELLS === shapeSize(T3_SHAPE), `${CELLS}`);
  check("srcIndex walks reading order",
    same(srcIndex(0), [0, 0, 0]) && same(srcIndex(7), [0, 1, 2]) && same(srcIndex(19), [1, 1, 4]),
    "0 -> [0,0,0], 7 -> [0,1,2], 19 -> [1,1,4]");
  check("the three dimensions are named by index and role",
    same(DIM_ROLES, ["0 sample", "1 sequence", "2 feature"]), DIM_ROLES.join(" · "));
  check("indexText prints one index", indexText("T", [1, 0, 2]) === "T[1, 0, 2]",
    indexText("T", [1, 0, 2]));
}

/* -- 1b · THE FOUR RANKS THE BASICS TOPIC WALKS --------------------------- *
 * The ladder [5] -> [2, 5] -> [2, 2, 5] -> [2, 2, 2, 5], and the role names at
 * each rung. The names are asserted per rank rather than derived because they
 * are NOT a shift of one another: `sequence` is inserted in the middle going
 * from rank 2 to rank 3, and `batch` goes in front going from 3 to 4. */
console.log("\n=== 1b · the four ranks ===");
{
  check("the four shapes are the ladder the rank control climbs",
    same(RANK_SHAPES[1], [5]) && same(RANK_SHAPES[2], [2, 5])
    && same(RANK_SHAPES[3], [2, 2, 5]) && same(RANK_SHAPES[4], [2, 2, 2, 5]),
    [1, 2, 3, 4].map((r) => shapeText(RANK_SHAPES[r])).join(" -> "));
  check("rank 1 holds 1-5 and rank 2 holds 1-10",
    same(R1, [1, 2, 3, 4, 5]) && same(R2.flat(), Array.from({ length: 10 }, (_, i) => i + 1)));
  check("rank 4 is T under batch 0 and T + 20 under batch 1",
    same(R4[0], T3) && same(R4[1].flat(2), Array.from({ length: 20 }, (_, i) => i + 21)),
    "21-40 in the second batch, so the two are told apart by value");
  check("every rank names one role per dimension",
    [1, 2, 3, 4].every((r) => RANK_ROLES[r].length === RANK_SHAPES[r].length),
    [1, 2, 3, 4].map((r) => RANK_ROLES[r].join("/")).join("  ·  "));
  check("the roles are the notebook's own, and the last is always feature",
    same(RANK_ROLES[1], ["feature"]) && same(RANK_ROLES[2], ["sample", "feature"])
    && same(RANK_ROLES[3], ["sample", "sequence", "feature"])
    && same(RANK_ROLES[4], ["batch", "sample", "sequence", "feature"]),
    RANK_ROLES[4].join(", "));
  check("the last dimension is five wide at every rank",
    [1, 2, 3, 4].every((r) => RANK_SHAPES[r][RANK_SHAPES[r].length - 1] === 5),
    "which is what lets one index control serve it at every rank");
  check("every leading dimension is two wide at every rank",
    [1, 2, 3, 4].every((r) => RANK_SHAPES[r].slice(0, -1).every((d) => d === 2)),
    "which is what lets one option list serve dim 0, dim 1 and dim 2");
  check("rank 3's labels are the ones the arrows already draw",
    same(dimLabels(3), DIM_ROLES), dimLabels(3).join(" · "));

  for (const r of [1, 2, 3, 4]) {
    const spec = rankSpec(r);
    const last = spec.shape.map((d) => d - 1);
    check(`rank ${r} reads 1 at its first cell and ${shapeSize(spec.shape)} at its last`,
      spec.at(spec.shape.map(() => 0)) === 1 && spec.at(last) === shapeSize(spec.shape),
      `${spec.at(spec.shape.map(() => 0))} … ${spec.at(last)}`);
  }
  check("an unknown rank falls back to the worked tensor rather than throwing",
    same(rankSpec("nonsense").shape, T3_SHAPE), shapeText(rankSpec("nonsense").shape));
}

/* -- 1c · INDEXING AND SLICING -------------------------------------------- *
 * Cells 19-23, and the rule the Basics topic exists to teach: an index removes
 * the dimension it names, a colon keeps it. The four cases below are the
 * notebook's own, and each is checked three ways — the shape left behind, the
 * cells lit, and the sub-tensor as torch prints it. */
console.log("\n=== 1c · what an index expression selects ===");
{
  const all = selectionOf(3, [COLON, COLON, COLON]);
  check("every entry a colon selects the whole tensor and removes nothing",
    all.fixed === 0 && same(all.shape, T3_SHAPE) && all.size === CELLS && all.text === "T[:, :, :]",
    `${all.text} ${shapeText(all.shape)}`);

  const cases = [
    { parts: [1, 0, 2], text: "T[1, 0, 2]", shape: [], size: 1, print: "tensor(13)" },
    {
      parts: [0, COLON, COLON], text: "T[0, :, :]", shape: [2, 5], size: 10,
      print: "tensor([[ 1,  2,  3,  4,  5],\n        [ 6,  7,  8,  9, 10]])",
    },
    {
      parts: [COLON, 0, COLON], text: "T[:, 0, :]", shape: [2, 5], size: 10,
      print: "tensor([[ 1,  2,  3,  4,  5],\n        [11, 12, 13, 14, 15]])",
    },
    {
      parts: [COLON, COLON, 0], text: "T[:, :, 0]", shape: [2, 2], size: 4,
      print: "tensor([[ 1,  6],\n        [11, 16]])",
    },
  ];
  for (const k of cases) {
    const sel = selectionOf(3, k.parts);
    const plural = k.size === 1 ? "value" : "values";
    check(`${k.text} leaves ${shapeText(k.shape)} and takes ${k.size} ${plural}`,
      sel.text === k.text && same(sel.shape, k.shape) && sel.size === k.size,
      `${sel.text} ${shapeText(sel.shape)}, ${sel.size} ${plural}`);
    check(`${k.text} prints what torch prints for it`,
      torchPrint(sel.shape, sel.at).text === k.print,
      JSON.stringify(torchPrint(sel.shape, sel.at).text.split("\n")[0]));
    /* The cells LIT and the values PRINTED are two readers of one mapping, so
       the count of lit cells has to equal the size of the sub-tensor. A drawing
       that lights ten cells beside a print of four is the failure this catches,
       and no pixel hash can see it. */
    let hits = 0;
    for (let i = 0; i < 2; i += 1) {
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 5; c += 1) if (sel.selects([i, r, c])) hits += 1;
      }
    }
    check(`${k.text} lights exactly the cells it prints`, hits === k.size, `${hits} cells lit`);
  }

  check("an index removes its dimension and a colon keeps it, at every rank",
    [1, 2, 3, 4].every((r) => {
      const parts = RANK_SHAPES[r].map((_, k) => (k === 0 ? 0 : COLON));
      return selectionOf(r, parts).shape.length === r - 1;
    }),
    "one index taken off each rank leaves rank − 1");
  check("T[:, :, 0] and T[0, :, :] take different values from one tensor",
    torchPrint(selectionOf(3, [COLON, COLON, 0]).shape, selectionOf(3, [COLON, COLON, 0]).at).text
    !== torchPrint(selectionOf(3, [0, COLON, COLON]).shape, selectionOf(3, [0, COLON, COLON]).at).text,
    "[2, 2] against [2, 5]");
  const scalar = selectionOf(4, [1, 0, 1, 3]);
  check("a rank-4 index with no colon left reaches one value of the second batch",
    scalar.size === 1 && same(scalar.shape, []) && scalar.at([]) === 29,
    `${scalar.text} = ${scalar.at([])}`);
}


/* -- 1d · WHAT THE SELECTION IS DRAWN AS ---------------------------------- *
 * Round 7 draws the selection as the sub-tensor it makes, under the tensor it
 * came from, with its own roles line and its own shape. Three facts have to
 * agree for that picture to be honest: the shape it leaves, the roles that
 * survive — RENUMBERED, because the sub-tensor's dimension 1 is not the
 * tensor's — and which dimensions the indices removed, which is the line
 * printed under it. All three come off one `selectionOf`, so what is checked
 * here is that they agree with each other and with the notebook. */
console.log("\n=== 1d · the selection, drawn as a sub-tensor ===");
{
  const drawn = [
    { rank: 3, parts: [COLON, COLON, COLON], shape: [2, 2, 5], roles: ["0 sample", "1 sequence", "2 feature"], gone: [] },
    { rank: 3, parts: [COLON, 0, COLON], shape: [2, 5], roles: ["0 sample", "1 feature"], gone: [1] },
    { rank: 3, parts: [0, COLON, COLON], shape: [2, 5], roles: ["0 sequence", "1 feature"], gone: [0] },
    { rank: 3, parts: [COLON, COLON, 0], shape: [2, 2], roles: ["0 sample", "1 sequence"], gone: [2] },
    { rank: 3, parts: [1, 0, 2], shape: [], roles: [], gone: [0, 1, 2] },
    { rank: 1, parts: [COLON], shape: [5], roles: ["0 feature"], gone: [] },
    { rank: 1, parts: [2], shape: [], roles: [], gone: [0] },
    { rank: 2, parts: [COLON, 3], shape: [2], roles: ["0 sample"], gone: [1] },
    { rank: 2, parts: [1, COLON], shape: [5], roles: ["0 feature"], gone: [0] },
    { rank: 4, parts: [COLON, COLON, COLON, COLON], shape: [2, 2, 2, 5], roles: ["0 batch", "1 sample", "2 sequence", "3 feature"], gone: [] },
    { rank: 4, parts: [1, COLON, COLON, COLON], shape: [2, 2, 5], roles: ["0 sample", "1 sequence", "2 feature"], gone: [0] },
    { rank: 4, parts: [COLON, COLON, 0, COLON], shape: [2, 2, 5], roles: ["0 batch", "1 sample", "2 feature"], gone: [2] },
  ];
  for (const k of drawn) {
    const sel = selectionOf(k.rank, k.parts);
    check(`rank ${k.rank} ${sel.text} is drawn as ${shapeText(k.shape)}`,
      same(sel.shape, k.shape), shapeText(sel.shape));
    check(`rank ${k.rank} ${sel.text} keeps the roles ${k.roles.join(", ") || "none"}`,
      same(sel.roles, k.roles), sel.roles.join(" · ") || "a scalar has no dimensions");
    check(`rank ${k.rank} ${sel.text} loses ${k.gone.length ? `dim ${k.gone.join(", ")}` : "nothing"}`,
      same(sel.gone, k.gone) && sel.fixed === k.gone.length
      && sel.keep.length + sel.gone.length === k.rank,
      `${sel.fixed} index/indices, ${sel.keep.length} colon(s)`);
    /* The sub-tensor's own print reads through `sel.at`, which walks
       `sel.full` — so a roles line that had drifted from the shape would print
       a value from the wrong cell here. */
    const p = torchPrint(sel.shape, sel.at);
    check(`rank ${k.rank} ${sel.text} prints ${sel.size} values`,
      p.text.replace(/[^0-9]+/g, " ").trim().split(" ").length === sel.size,
      `${p.lines.length} line(s), ${sel.size} values`);
  }
  check("the roles of a selection are RENUMBERED, not carried over",
    selectionOf(3, [COLON, 0, COLON]).roles[1] === "1 feature",
    "dimension 2 of T is dimension 1 of T[:, 0, :]");
  check("every dimension is either kept or gone, at every rank and every index",
    [1, 2, 3, 4].every((r) => RANK_SHAPES[r].every((_, d) => {
      const parts = RANK_SHAPES[r].map((__, k) => (k === d ? 0 : COLON));
      const s = selectionOf(r, parts);
      return same(s.gone, [d]) && s.keep.length === r - 1;
    })), "one index at a time, over all four ranks");
}

/* -- 1e · THE FIGURE AS A CONTROL: the region map's arithmetic ------------- *
 * The widget makes every index label the Basics drawing writes a click target.
 * A region table can be wrong in two ways that no pixel hash sees — it can set
 * the wrong parameter, and it can set a value that parameter does not offer —
 * so both are checked here, and `_lab/tensor-sweep.html` checks the third,
 * that each target's rectangle is where its label was drawn. */
console.log("\n=== 1e · the index labels as click targets ===");
{
  check("the leading dimensions take i0, i1, i2 and the last takes feature",
    indexSlot(1, 0) === "feature"
    && indexSlot(2, 0) === "i0" && indexSlot(2, 1) === "feature"
    && indexSlot(3, 0) === "i0" && indexSlot(3, 1) === "i1" && indexSlot(3, 2) === "feature"
    && indexSlot(4, 0) === "i0" && indexSlot(4, 1) === "i1"
    && indexSlot(4, 2) === "i2" && indexSlot(4, 3) === "feature",
    "one parameter per dimension, at every rank");

  check("pressing a label writes that position",
    same(indexSet(3, 1, 0, [COLON, COLON, COLON]), { i1: "0" })
    && same(indexSet(3, 2, 4, [COLON, COLON, COLON]), { feature: "4" }),
    "T[:, :, :] then dim 1 = 0 gives i1 = 0");
  check("pressing the position already chosen writes a colon back",
    same(indexSet(3, 1, 0, [COLON, 0, COLON]), { i1: ":" })
    && same(indexSet(4, 0, 1, [1, COLON, COLON, COLON]), { i0: ":" }),
    "one target both sets a dimension and clears it");
  check("pressing a different position of a chosen dimension moves it",
    same(indexSet(3, 0, 1, [0, COLON, COLON]), { i0: "1" }), "i0 = 0 then dim 0 = 1");

  /* EXACTLY ONE PARAMETER PER TARGET, which core throws over at load, and every
     value one of that parameter's own options. The leading dimensions offer
     `:` 0 1 and the feature dimension `:` 0-4, which section 1b has already
     shown covers every position of every rank. */
  const optionsFor = (slot) => (slot === "feature"
    ? [COLON, "0", "1", "2", "3", "4"] : [COLON, "0", "1"]);
  let writes = 0;
  const bad = [];
  for (const rank of [1, 2, 3, 4]) {
    for (const view of ["stack", "frames"]) {
      for (const t of indexTargets(rank, view)) {
        for (let v = 0; v < RANK_SHAPES[rank][t.dim]; v += 1) {
          for (const parts of [RANK_SHAPES[rank].map(() => COLON),
            RANK_SHAPES[rank].map((_, k) => (k === t.dim ? String(v) : COLON))]) {
            const set = indexSet(rank, t.dim, v, parts);
            const keys = Object.keys(set);
            writes += 1;
            if (keys.length !== 1) bad.push(`${rank}/${view}/${t.dim}: ${keys.length} parameters`);
            else if (keys[0] !== indexSlot(rank, t.dim)) bad.push(`${rank}/${t.dim}: wrong slot`);
            else if (!optionsFor(keys[0]).includes(set[keys[0]])) {
              bad.push(`${rank}/${t.dim}: "${set[keys[0]]}" is not an option`);
            }
          }
        }
      }
    }
  }
  check("every target writes one parameter, and a value that parameter offers",
    bad.length === 0, `${writes} writes checked${bad.length ? `: ${bad[0]}` : ""}`);

  /* One target per label the drawing writes. The frames view names the leading
     dimension on each frame, the row and column indices on the first grid; the
     stack view draws the leading dimension as depth and offers that alone. */
  const counts = [
    [1, "stack", 5], [1, "frames", 5],
    [2, "stack", 7], [2, "frames", 7],
    [3, "stack", 2], [3, "frames", 9],
    [4, "stack", 2], [4, "frames", 13],
  ];
  for (const [rank, view, n] of counts) {
    check(`rank ${rank} ${view} offers ${n} targets`,
      indexTargetCount(rank, view) === n, `${indexTargetCount(rank, view)}`);
  }
  check("the row and column indices belong to the frames view alone",
    same(indexTargets(3, "stack").map((t) => t.dim), [0])
    && same(indexTargets(4, "stack").map((t) => t.dim), [0])
    && same(indexTargets(3, "frames").map((t) => t.dim), [0, 1, 2])
    && same(indexTargets(4, "frames").map((t) => t.dim), [0, 1, 2, 3]),
    "the stack view offers dim 0; the frames view offers every dimension");
  check("rank 1 and rank 2 draw one picture and offer it in both views",
    same(indexTargets(1, "stack"), indexTargets(1, "frames"))
    && same(indexTargets(2, "stack"), indexTargets(2, "frames")),
    "no leading dimension left to draw as depth");
  check("rank 4 frames names dim 1 inside every frame of dim 0",
    indexTargets(4, "frames").find((t) => t.dim === 1).labels === 4,
    "four `dim 1 = j` labels, two per outer frame");
}

/* -- 2 · EVERY OPERATION'S DESTINATION MAP IS A BIJECTION ------------------- *
 * A walk that sent two values to one cell, or left a cell unfilled, would draw
 * a plausible figure with a hole in it. Round 11 made the argument a control,
 * so this is checked over EVERY argument a reader can choose: 65 reshapes, 6
 * orderings, 4 unsqueeze positions, 3 flatten starts, 3 cat dims, 4 stack dims. */
console.log("\n=== 2 · every operation's destination map is a bijection ===");
const EVERY_OP = [
  ...RESHAPE_SHAPES.map((sh) => shapeOp("reshape", shapeKey(sh))),
  ...PERMUTATIONS.map((pm) => shapeOp("permute", shapeKey(pm))),
  ...[0, 1, 2, 3].map((d) => shapeOp("unsqueeze", d)),
  ...[0, 1, 2].map((d) => shapeOp("flatten", d)),
  ...[0, 1, 2].map((d) => joinOp("cat", d)),
  ...[0, 1, 2, 3].map((d) => joinOp("stack", d)),
];
{
  let bad = [];
  for (const op of EVERY_OP) {
    const moves = shapeWalk(op);
    const cells = shapeSize(op.shape);
    const seen = new Set();
    let inRange = true;
    for (const m of moves) {
      if (m.dst.length !== op.shape.length) inRange = false;
      m.dst.forEach((v, k) => { if (v < 0 || v >= op.shape[k]) inRange = false; });
      seen.add(m.dst.join(","));
    }
    if (!(op.ok && moves.length === cells && seen.size === cells && inRange)) bad.push(op.label);
  }
  check(`${EVERY_OP.length} operations each cover their result exactly once`, bad.length === 0,
    bad.length ? `failing: ${bad.join(", ")}` : `${RESHAPE_SHAPES.length} reshapes, ${PERMUTATIONS.length} orderings, 4 + 3 + 3 + 4 dims`);
  check("65 shapes hold 20 values in up to four dimensions",
    RESHAPE_SHAPES.length === 65 && RESHAPE_SHAPES.every((sh) => shapeSize(sh) === 20 && sh.length <= 4),
    `${RESHAPE_SHAPES.filter((s) => s.length === 1).length} + ${RESHAPE_SHAPES.filter((s) => s.length === 2).length} + ${RESHAPE_SHAPES.filter((s) => s.length === 3).length} + ${RESHAPE_SHAPES.filter((s) => s.length === 4).length}`);
  check("allShapes lists each shape once", new Set(RESHAPE_SHAPES.map((s) => s.join(","))).size === RESHAPE_SHAPES.length);
  const fail = shapeOp("reshape", shapeKey(RESHAPE_FAIL));
  check("reshape(3, 7) fails with torch's message and walks nothing",
    !fail.ok && fail.error === "shape '[3, 7]' is invalid for input of size 20" && shapeWalk(fail).length === 0,
    fail.error);
}

/* -- 3 · reshape(2, 5, 2) AGAINST permute(0, 2, 1) ------------------------- *
 * The stage that loses (2.6). Both reach [2, 5, 2] from the same tensor and
 * the contents differ, which is the misconception this widget exists for. */
console.log("\n=== 3 · the same shape, different contents ===");
{
  const re = shapeWalk(shapeOp("reshape", "2-5-2"));
  const pe = shapeWalk(shapeOp("permute", "0-2-1"));
  check("both reach [2, 5, 2]",
    same(shapeOp("reshape", "2-5-2").shape, [2, 5, 2]) && same(shapeOp("permute", "0-2-1").shape, [2, 5, 2]),
    "reshape(2, 5, 2) and permute(0, 2, 1)");

  /* 11 is the value the catalogue names: it lands at [1, 0, 0] under both, so
     a reader checking one value could conclude the two agree. */
  const eleven = re.findIndex((m) => m.v === 11);
  check("11 lands at [1, 0, 0] under BOTH",
    same(re[eleven].dst, [1, 0, 0]) && same(pe[eleven].dst, [1, 0, 0]),
    `reshape ${shapeText(re[eleven].dst)}, permute ${shapeText(pe[eleven].dst)}`);

  const differ = re.filter((m, i) => !same(m.dst, pe[i].dst)).map((m) => m.v);
  check("16 of the 20 values go somewhere else", differ.length === 16,
    `values ${differ.join(", ")}`);
  const agree = re.filter((m, i) => same(m.dst, pe[i].dst)).map((m) => m.v);
  check("only the four corner values agree: 1, 10, 11, 20",
    same(agree, [1, 10, 11, 20]), `values ${agree.join(", ")}`);

  const cases = [
    [2, [0, 0, 1], [0, 1, 0]],
    [3, [0, 1, 0], [0, 2, 0]],
    [6, [0, 2, 1], [0, 0, 1]],
    [16, [1, 2, 1], [1, 0, 1]],
  ];
  for (const [v, r, p] of cases) {
    const i = re.findIndex((m) => m.v === v);
    check(`${v}: reshape ${shapeText(r)}, permute ${shapeText(p)}`,
      same(re[i].dst, r) && same(pe[i].dst, p),
      `got ${shapeText(re[i].dst)} and ${shapeText(pe[i].dst)}`);
  }
}

/* -- 4 · THE LESSON'S OWN LINES, AND THE NAMES THE OPERATIONS LEAVE --------- */
console.log("\n=== 4 · reshape, flatten, unsqueeze, cat, stack — and their roles ===");
{
  const re = shapeWalk(shapeOp("reshape", "2-10"));
  check("reshape(2, 10) sends value n to [n/10, n%10]",
    re.every((m, n) => same(m.dst, [Math.floor(n / 10), n % 10])), "row-major, so 11 lands at [1, 0]");
  check("reshape(2, 10) merges the last two names",
    same(shapeOp("reshape", "2-10").names, ["sample", "sequence × feature"]),
    shapeOp("reshape", "2-10").names.join(" | "));
  check("reshape(4, 5) merges the first two and keeps feature",
    same(shapeOp("reshape", "4-5").names, ["sample × sequence", "feature"]),
    shapeOp("reshape", "4-5").names.join(" | "));
  check("reshape(5, 4) cuts across every dimension, so its dimensions are positions",
    same(shapeOp("reshape", "5-4").names, ["", ""]));
  check("reshape(1, 20) names the size-1 dimension for its size",
    same(shapeOp("reshape", "1-20").names, ["size 1", "sample × sequence × feature"]));

  const fl = shapeWalk(shapeOp("flatten", 0));
  check("flatten() sends value n to [n], keeping reading order",
    fl.every((m, n) => same(m.dst, [n]) && m.v === n + 1), shapeText([20]));
  check("flatten(start_dim=1) is reshape(2, 10)",
    same(shapeOp("flatten", 1).shape, [2, 10])
    && shapeWalk(shapeOp("flatten", 1)).every((m, i) => same(m.dst, re[i].dst)));
  check("flatten(start_dim=2) changes nothing", same(shapeOp("flatten", 2).shape, T3_SHAPE));

  const un = shapeWalk(shapeOp("unsqueeze", 0));
  check("unsqueeze(0) prefixes 0 and moves nothing else",
    un.every((m) => m.dst[0] === 0 && same(m.dst.slice(1), m.src)), shapeText([1, 2, 2, 5]));
  check("unsqueeze(0) names the new dimension batch; unsqueeze(2) names it for its size",
    shapeOp("unsqueeze", 0).names[0] === "batch" && shapeOp("unsqueeze", 2).names[2] === "size 1");
  check("unsqueeze(3) puts the 1 last", same(shapeOp("unsqueeze", 3).shape, [2, 2, 5, 1]));

  check("permute carries each name with its data",
    same(shapeOp("permute", "0-2-1").names, ["sample", "feature", "sequence"])
    && same(shapeOp("permute", "2-1-0").names, ["feature", "sequence", "sample"]));

  const ct = shapeWalk(joinOp("cat", 0));
  check("cat(dim=0) gives [4, 2, 5]", same(joinOp("cat", 0).shape, [4, 2, 5]));
  check("cat(dim=1) gives [2, 4, 5] and cat(dim=2) gives [2, 2, 10]",
    same(joinOp("cat", 1).shape, [2, 4, 5]) && same(joinOp("cat", 2).shape, [2, 2, 10]));
  check("cat walks 40 values, T first then T2",
    ct.length === 40 && ct.slice(0, 20).every((m) => m.t === 0) && ct.slice(20).every((m) => m.t === 1));
  check("cat puts T2's values after T's along dim 0",
    ct.slice(0, 20).every((m) => m.dst[0] < 2) && ct.slice(20).every((m) => m.dst[0] >= 2));
  check("cat keeps every name", same(joinOp("cat", 1).names, ["sample", "sequence", "feature"]));

  const st = shapeWalk(joinOp("stack", 0));
  check("stack(dim=0) gives [2, 2, 2, 5]", same(joinOp("stack", 0).shape, [2, 2, 2, 5]));
  check("stack puts each tensor whole under its own new index",
    st.every((m) => m.dst[0] === m.t && same(m.dst.slice(1), m.src)));
  check("stack(dim=3) puts the new dimension last", same(joinOp("stack", 3).shape, [2, 2, 5, 2]));

  /* the naming conventions */
  check("three conventions: sequence, image, positions",
    same(Object.keys(NAME_SETS), ["sequence", "image", "positions"]));
  check("image data names rank 4 sample, channel, height, width",
    same(roleNames("image", 4), ["sample", "channel", "height", "width"]));
  check("positions name nothing and label by index alone",
    same(roleNames("positions", 3), ["", "", ""]) && same(roleLabels("positions", 3), ["0", "1", "2"]));
  check("under image names unsqueeze(0) adds sample", shapeOp("unsqueeze", 0, "image").names[0] === "sample");

  /* opFrom reads the parameters the rail writes — round 13: reshape's four
     slots, blanks dropped, as the student typed them */
  const viaParams = opFrom({ tab: "shape", op: "reshape", shape: "2x5x2", names: "sequence" });
  check("opFrom reads op + the typed shape and attaches roles",
    viaParams.label === "reshape(2, 5, 2)" && same(viaParams.shape, [2, 5, 2]) && same(viaParams.roles, ["0", "1", "2"]),
    viaParams.roles.join(" | "));
  const lesson = opFrom({ tab: "shape", op: "reshape", shape: "2x-1", names: "sequence" });
  check("the lesson's own reshape(2, -1) is the default and -1 becomes 10",
    lesson.ok && lesson.label === "reshape(2, -1)" && same(lesson.shape, [2, 10]) && lesson.inferred === 10
    && same(lesson.names, ["sample", "sequence × feature"]),
    `${lesson.label} -> ${shapeText(lesson.shape)}, roles ${lesson.roles.join(" · ")}`);
  check("-1 in the middle is inferred in place", same(reshapeFrom([2, -1, 2]).shape, [2, 5, 2]));
  check("-1 that nothing fits fails with torch's message",
    reshapeFrom([-1, 3]).error === "shape '[-1, 3]' is invalid for input of size 20");
  check("two -1s fail with torch's message",
    reshapeFrom([-1, -1]).error === "only one dimension can be inferred");
  check("the empty call fails with torch's message",
    reshapeFrom([]).error === "shape '[]' is invalid for input of size 20");
  check("a fifth dimension cannot be typed, and a product of 20 over four slots is every listed shape",
    RESHAPE_SHAPES.every((sh) => reshapeFrom(sh).ok) && !reshapeFrom([1, 1, 1, 1, 20]).ok);
  check("typed text splits on commas, spaces, x and brackets alike",
    same(parseShapeText("2, 5, 2"), [2, 5, 2]) && same(parseShapeText("[2 5 2]"), [2, 5, 2])
    && same(parseShapeText("2x5x2"), [2, 5, 2]) && same(parseShapeText("(2, −1)"), [2, -1]) && same(parseShapeText(""), []));
  check("a token that is not a whole number is torch's TypeError, naming its position",
    reshapeFrom(parseShapeText("2, a")).error === "reshape(): argument 'shape' must be tuple of ints, but found element of type str at pos 1"
    && reshapeFrom(parseShapeText("2.5, 8")).error === "reshape(): argument 'shape' must be tuple of ints, but found element of type float at pos 0");
  check("the URL form is x-joined for whole numbers and the text itself otherwise",
    shapeWire("2, 5, 2") === "2x5x2" && shapeWire("[2, -1]") === "2x-1" && shapeWire(" 2, a ") === "2, a");
  check("the field shows the URL form with commas, and other text as it is",
    shapeShow("2x-1") === "2, -1" && shapeShow("2, a") === "2, a" && shapeShow("") === "");
  const viaJoin = opFrom({ tab: "join", join: "stack", sdim: "1", names: "image" });
  check("opFrom reads join + sdim", viaJoin.label === "stack(dim=1)" && same(viaJoin.shape, [2, 2, 2, 5]));
}

/* -- 5 · BROADCASTING, ALL FIVE SHAPES OF b ------------------------------- *
 * The rule as the lesson states it: line the shapes up from the right, a
 * missing dimension counts as 1, equal or 1 passes. The fifth case is the one
 * a reader who lines them up from the LEFT expects to work. */
console.log("\n=== 5 · broadcasting X [2, 5] + b ===");
{
  check("X is [2, 5] holding 1-10", same(BC_X_SHAPE, [2, 5]) && same(BC_X.flat(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  check("five shapes of b are offered", BC_CASES.length === 5,
    BC_CASES.map((c) => c.label).join(", "));

  const expect = {
    5: [[11, 22, 33, 44, 55], [16, 27, 38, 49, 60]],
    "1-5": [[11, 22, 33, 44, 55], [16, 27, 38, 49, 60]],
    "2-1": [[11, 12, 13, 14, 15], [26, 27, 28, 29, 30]],
    scalar: [[3, 4, 5, 6, 7], [8, 9, 10, 11, 12]],
  };
  for (const [value, result] of Object.entries(expect)) {
    const p = broadcastPlan(bCaseByValue(value));
    check(`b ${bCaseByValue(value).label} broadcasts to [2, 5]`,
      p.ok && same(p.shape, [2, 5]) && same(p.result, result),
      p.ok ? p.result.map((r) => r.join(" ")).join(" | ") : "REFUSED");
  }

  const bad = broadcastPlan(bCaseByValue("2"));
  check("b [2] does not broadcast", !bad.ok && bad.result === null, bad.clash ?? "");
  check("and the clash it prints is 5 against 2", bad.clash === "5 against 2", bad.clash);

  const rows = alignment(BC_X_SHAPE, [5]);
  check("[5] against [2, 5]: dim 0 stretch, dim 1 equal",
    rows[0].verdict === "stretch" && rows[0].b === "(1)" && rows[1].verdict === "equal",
    rows.map((r) => `${r.x} vs ${r.b}: ${r.verdict}`).join(" · "));
  const r21 = alignment(BC_X_SHAPE, [2, 1]);
  check("[2, 1] against [2, 5]: dim 0 equal, dim 1 stretch",
    r21[0].verdict === "equal" && r21[1].verdict === "stretch",
    r21.map((r) => `${r.x} vs ${r.b}: ${r.verdict}`).join(" · "));
  const rsc = alignment(BC_X_SHAPE, []);
  check("a scalar stretches on both dimensions",
    rsc.every((r) => r.verdict === "stretch" && r.b === "(1)"),
    rsc.map((r) => `${r.x} vs ${r.b}: ${r.verdict}`).join(" · "));
  const r2 = alignment(BC_X_SHAPE, [2]);
  check("[2] fails on dim 1, having stretched on dim 0",
    r2[0].verdict === "stretch" && r2[1].verdict === "error",
    r2.map((r) => `${r.x} vs ${r.b}: ${r.verdict}`).join(" · "));

  check("a hovered scalar names no index", bName(bCaseByValue("scalar"), 1, 3) === "b = 2",
    bName(bCaseByValue("scalar"), 1, 3));
  check("a hovered [2, 1] names its row", bName(bCaseByValue("2-1"), 1, 0) === "b[1, 0] = 20",
    bName(bCaseByValue("2-1"), 1, 0));
  check("a hovered [5] names its column", bName(bCaseByValue("5"), 0, 3) === "b[3] = 40",
    bName(bCaseByValue("5"), 0, 3));
}

/* -- 6 · THE MATRIX PRODUCT ----------------------------------------------- *
 * Three data points, two neurons, and the transpose that makes the inner
 * dimensions match. The printed sum of products is the widget's one formula,
 * so it is asserted as a STRING rather than as a number (5.8). */
console.log("\n=== 6 · X [3, 4] @ W-transpose [4, 2] ===");
{
  check("X is [3, 4] holding 1-12", same(MM_X_SHAPE, [3, 4]) && same(MM_X.flat(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  check("W is [2, 4], one row per neuron", same(MM_W, [[0.1, 0.1, 0.1, 0.1], [0.5, 0.5, 0.5, 0.5]]));
  check("Wᵀ is [4, 2], one column per neuron",
    MM_WT.length === 4 && MM_WT.every((row) => same(row, [0.1, 0.5])));

  const ok = MM_Y.length === 3 && MM_Y.every((row) => row.length === 2);
  const want = [[1, 5], [2.6, 13], [4.2, 21]];
  const exact = MM_Y.every((row, r) => row.every((v, c) => near(v, want[r][c], 1e-9)));
  check("Y = X @ Wᵀ is [[1, 5], [2.6, 13], [4.2, 21]]", ok && exact && same(MM_Y_SHAPE, [3, 2]),
    MM_Y.map((r) => r.map(num).join(", ")).join(" | "));

  const p = productTerms(1, 1);
  check("Y[1, 1] prints its four products and their total",
    p.text === "5×0.5 + 6×0.5 + 7×0.5 + 8×0.5 = 13", p.text);
  const p00 = productTerms(0, 0);
  check("Y[0, 0] prints the first neuron's row",
    p00.text === "1×0.1 + 2×0.1 + 3×0.1 + 4×0.1 = 1", p00.text);
  check("every cell's printed sum equals the drawn value",
    MM_Y.every((row, r) => row.every((v, c) => near(productTerms(r, c).sum, v, 1e-9))));

  check("matmul agrees with a hand-rolled dot product",
    same(matmul([[1, 2]], [[3], [4]]), [[11]]), "[[1, 2]] @ [[3], [4]] = [[11]]");

  const wt = mmCaseByValue("transposed");
  const w = mmCaseByValue("untransposed");
  check("two operands are offered, and only the transposed one works",
    MM_CASES.length === 2 && wt.ok && !w.ok, `${wt.label} / ${w.label}`);
  check("W untransposed puts 4 against 2 on the inside",
    same(w.shape, [2, 4]) && MM_X_SHAPE[1] !== w.shape[0],
    `${shapeText(MM_X_SHAPE)} @ ${shapeText(w.shape)}`);
}

/* -- 7 · REDUCTIONS ------------------------------------------------------- *
 * `dim` names the dimension that DISAPPEARS, which is the axis confusion this
 * tab exists to correct: [3, 4] over dim 0 is [4], one number per feature. */
console.log("\n=== 7 · reductions over X [3, 4] ===");
{
  check("X is [3, 4] with rows 1-4, 2-5, 3-6",
    same(RED_X_SHAPE, [3, 4]) && same(RED_X, [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]));

  check("dim 0 leaves [4], dim 1 leaves [3], none leaves a scalar",
    same(reduceShape("0"), [4]) && same(reduceShape("1"), [3]) && same(reduceShape("none"), []),
    `${shapeText(reduceShape("0"))} · ${shapeText(reduceShape("1"))} · ${shapeText(reduceShape("none"))}`);

  check("dim 0 has 4 groups and each is a column",
    reduceGroups("0").length === 4 && same(reduceGroups("0")[0].values, [1, 2, 3]),
    "column 0 is 1, 2, 3");
  check("dim 1 has 3 groups and each is a row",
    reduceGroups("1").length === 3 && same(reduceGroups("1")[1].values, [2, 3, 4, 5]));
  check("none has one group of every value",
    reduceGroups("none").length === 1 && reduceGroups("none")[0].values.length === 12);

  const table = [
    ["mean", "0", [2, 3, 4, 5]],
    ["mean", "1", [2.5, 3.5, 4.5]],
    ["mean", "none", [3.5]],
    ["sum", "0", [6, 9, 12, 15]],
    ["sum", "1", [10, 14, 18]],
    ["sum", "none", [42]],
    ["max", "0", [3, 4, 5, 6]],
    ["max", "1", [4, 5, 6]],
    ["max", "none", [6]],
  ];
  for (const [fn, dim, want] of table) {
    const got = reduceValues(fn, dim);
    check(`${fn} over ${dim === "none" ? "every dimension" : `dim ${dim}`} is ${shapeText(want)}`,
      got.length === want.length && got.every((v, i) => near(v, want[i], 1e-12)),
      got.map(num).join(", "));
  }
  check("three reducers are offered", same(Object.keys(REDUCERS), ["mean", "sum", "max"]));
  check("a reduction leaves as many values as it has groups",
    ["0", "1", "none"].every((d) => reduceValues("mean", d).length === reduceGroups(d).length));
}

/* -- 8 · STANDARDIZATION -------------------------------------------------- *
 * A reduction and then a broadcast. The standard deviation is torch's UNBIASED
 * default, n - 1, which is what makes every column's sigma exactly 1 here and
 * the normalized rows exactly -1, 0, +1 — a biased n would give 1.2247 and
 * rows of -0.816, 0, +0.816, which looks just as plausible on a figure. */
console.log("\n=== 8 · (X − μ) / σ over dim 0 ===");
{
  check("μ over dim 0 is [2, 3, 4, 5]", same(RED_MU, [2, 3, 4, 5]), RED_MU.join(", "));
  check("σ over dim 0 is 1 in every column, unbiased (n − 1)",
    RED_SD.length === 4 && RED_SD.every((v) => near(v, 1, 1e-12)), RED_SD.map(num).join(", "));
  const biased = Math.sqrt(((1 - 2) ** 2 + 0 + (3 - 2) ** 2) / 3);
  check("the biased form would have been 0.82, and is not what is drawn",
    !near(RED_SD[0], biased, 1e-9), `n − 1 gives 1, n gives ${num(biased)}`);
  check("the normalized rows are −1, 0 and +1",
    RED_Z.every((row, r) => row.every((v) => near(v, r - 1, 1e-12))),
    RED_Z.map((r) => r.map(num).join(" ")).join(" | "));
  check("μ is the mean reduction over dim 0, not a second formula",
    same(RED_MU, reduceValues("mean", "0")));
}

/* -- 9 · PACING IS DECLARED PER SPEED, NEVER DECIDED MID-RUN (4.1) --------- */
console.log("\n=== 9 · pacing ===");
{
  check("three speeds, each with its own unit length",
    same(Object.keys(UNIT_MS), ["slow", "medium", "fast"]),
    Object.entries(UNIT_MS).map(([k, v]) => `${k} ${v}ms`).join(", "));
  check("the details a reader sees are those numbers in seconds",
    unitMs("slow") === 900 && unitMs("medium") === 340 && unitMs("fast") === 120,
    "0.9 · 0.34 · 0.12 seconds a step");
  check("only Fast declines the choreography",
    choreographs("slow") && choreographs("medium") && !choreographs("fast"));
  check("an unknown speed falls back rather than yielding NaN",
    Number.isFinite(unitMs("nonsense")), `${unitMs("nonsense")}ms`);
}

/* -- 10 · THE PRINTED FORMS ----------------------------------------------- *
 * Every one of these reaches a reader, on the canvas or in a readout tile. */
console.log("\n=== 10 · printed forms ===");
{
  check("a shape prints with spaces after its commas", shapeText([2, 2, 5]) === "[2, 2, 5]");
  check("a scalar's shape prints as []", shapeText([]) === "[]");
  check("integers print bare and decimals to two places",
    num(13) === "13" && num(2.6) === "2.6" && num(3.5) === "3.5" && num(0.1) === "0.1",
    "13 · 2.6 · 3.5 · 0.1");
  check("a value that is not finite prints an em dash, not NaN", num(NaN) === "—");
  check("no printed value anywhere carries a floating-point tail",
    [...MM_Y.flat(), ...RED_Z.flat(), ...RED_SD, ...RED_MU].every((v) => !/\d{6}/.test(num(v))),
    [...MM_Y.flat()].map(num).join(", "));
}

/* -- 11 · THE PRINTED TENSOR IS TORCH'S OWN LAYOUT ------------------------ *
 * The Shape tab draws a tensor and prints it, and the claim it makes is that
 * the two are the same tensor. A print that is nearly right — a bracket at the
 * wrong depth, a missing blank line, an element aligned left — makes the
 * widget teach a format PyTorch does not produce, and no pixel hash can see
 * the difference between that and the real thing.
 *
 * So the strings below are the exact output of `print(t)` in torch for each
 * tensor the tab draws, written out from torch's own rules: elements right
 * aligned to the widest one, a node of rank r joining its children with ","
 * then r − 1 newlines, and rows longer than 80 columns wrapping. */
console.log("\n=== 11 · the printed tensor ===");
{
  const source = torchPrint(T3_SHAPE, ([i, r, c]) => T3[i][r][c]);
  const expected3 = [
    "tensor([[[ 1,  2,  3,  4,  5],",
    "         [ 6,  7,  8,  9, 10]],",
    "",
    "        [[11, 12, 13, 14, 15],",
    "         [16, 17, 18, 19, 20]]])",
  ].join("\n");
  check("the [2, 2, 5] source prints exactly as torch prints it",
    source.text === expected3, JSON.stringify(source.text.split("\n")[0]));
  check("its first line opens three brackets and pads 1 to two columns",
    source.lines[0].map((g) => g.s).join("") === "tensor([[[ 1,  2,  3,  4,  5],");
  check("a rank-3 print puts one blank line between its 2-D blocks",
    source.text.split("\n")[2] === "", `line 3 is ${JSON.stringify(source.text.split("\n")[2])}`);
  check("every value carries its own index, punctuation carries none",
    source.lines.flat().filter((g) => g.idx).length === CELLS
    && source.lines.flat().every((g) => !g.idx || g.idx.length === 3),
    `${source.lines.flat().filter((g) => g.idx).length} value segments`);
  check("the widest line is what the layout measures the block by",
    source.cols === Math.max(...source.text.split("\n").map((l) => l.length)),
    `${source.cols} columns`);

  /* Each operation's result, filled from its own destination map — the same
     list the animation walks, so a print and a drawing cannot disagree. */
  const resultPrint = (op) => {
    const at = new Map(shapeWalk(op).map((m) => [m.dst.join(","), m.v]));
    return torchPrint(op.shape, (idx) => at.get(idx.join(",")));
  };

  const flat = resultPrint(shapeOp("flatten", 0));
  check("flatten()'s [20] wraps at eighteen values, as torch's 80-column rule does",
    flat.text === [
      "tensor([ 1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18,",
      "        19, 20])",
    ].join("\n"), `${flat.lines.length} lines, ${flat.cols} columns`);
  check("its continuation line is indented to the column after the bracket",
    flat.text.split("\n")[1].startsWith("        19,"));

  const wide = resultPrint(shapeOp("reshape", "2-10"));
  check("reshape(2, −1)'s [2, 10] prints two rows and no blank line",
    wide.text === [
      "tensor([[ 1,  2,  3,  4,  5,  6,  7,  8,  9, 10],",
      "        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]])",
    ].join("\n"), `${wide.lines.length} lines`);

  const stacked = resultPrint(joinOp("stack", 0));
  const lines4 = stacked.text.split("\n");
  check("stack(dim=0)'s [2, 2, 2, 5] prints twelve lines",
    lines4.length === 12, `${lines4.length} lines`);
  check("a rank-4 print puts TWO blank lines between its outermost blocks",
    lines4[5] === "" && lines4[6] === "" && lines4[2] === "" && lines4[9] === "",
    `blanks at ${lines4.map((l, i) => (l === "" ? i : null)).filter((i) => i !== null).join(", ")}`);
  check("its first line opens four brackets",
    lines4[0] === "tensor([[[[ 1,  2,  3,  4,  5],", JSON.stringify(lines4[0]));
  check("its last line closes four and the call",
    lines4[11] === "          [36, 37, 38, 39, 40]]]])", JSON.stringify(lines4[11]));
  check("the second tensor's 21-40 appear in the second block, not the first",
    lines4[7].includes("21") && !lines4[0].includes("21"));

  const catted = resultPrint(joinOp("cat", 0));
  check("cat(dim=0)'s [4, 2, 5] prints eleven lines, one blank between four blocks",
    catted.text.split("\n").length === 11
    && catted.text.split("\n").filter((l) => l === "").length === 3,
    `${catted.text.split("\n").length} lines`);

  const permuted = resultPrint(shapeOp("permute", "0-2-1"));
  check("permute(0, 2, 1) and reshape(2, 5, 2) print the SAME shape and different text",
    permuted.text !== resultPrint(shapeOp("reshape", "2-5-2")).text
    && permuted.cols === resultPrint(shapeOp("reshape", "2-5-2")).cols,
    "same [2, 5, 2], different contents");
  check("permute's first row is 1 and 6, which reshape's is not",
    permuted.text.split("\n")[0] === "tensor([[[ 1,  6],",
    JSON.stringify(permuted.text.split("\n")[0]));

  /* A HALF-BUILT RESULT MUST NOT SHIFT. The width is measured over every value
     the walk will place, so a print with three values in it lines up with the
     same print full. */
  const op = joinOp("stack", 0);
  const moves = shapeWalk(op);
  const partial = torchPrint(op.shape, (idx) => {
    const m = moves.find((mv) => mv.dst.join(",") === idx.join(","));
    return m ? m.v : 0;
  });
  check("a result print keeps the finished layout while it fills",
    partial.cols === stacked.cols && partial.lines.length === stacked.lines.length,
    `${partial.cols} columns either way`);

  check("the shape line under a print is torch.Size, not a bare shape",
    sizeText(T3_SHAPE) === "torch.Size([2, 2, 5])" && sizeText([20]) === "torch.Size([20])",
    sizeText(T3_SHAPE));
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
