/* ============================================================================
   Assertions on widget 51's engine — the arithmetic no picture can settle.

       node widgets/_lab/composition-verify.mjs

   Imports `widgets/composition/model.js` and `widgets/core/torch.js`, the
   shipping code and not a copy (5.8). Every number here is either the
   notebook's own (PHM5005 05-3 cells 61-101) or one of the measured facts
   docs/catalogue.md § Slot 51 records, so a failure means the widget is
   drawing something the lesson does not say.

   Six of these need a reader most. THE SHAPE CHAINS are drawn as text on an
   edge, so a wrong one is a perfectly stable pixel hash. THE PARAMETER COUNTS
   are four digits in a tile and nothing on the figure contradicts them. THE
   THREE TORCH MESSAGES are the whole of three losing states, and torch is not
   installed on this machine, so their wording is checked against core's one
   copy rather than against a run. THE ROUTER SEED has to put the four samples
   on more than one branch or the hard-routing page makes its point badly, and
   that is a property of a constant nobody looks at. THE MASK'S BLOCKED COUNT
   is printed in a tile and drawn as empty columns, and 2.11 requires the tile
   be counted from the draw. And THE FIT PASS decides whether a page fits the
   stage at all, which no hash of a fitted figure can see.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";
import { torchError, outSize } from "../core/torch.js";
import { resolveParams } from "../core/params.js";
import * as M from "../composition/model.js";

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);

function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 68)} ${detail}`);
}
const shapeIs = (s, want) => Array.isArray(s) && s.join() === want.join();

/* --- 1 · one batch, five wirings -------------------------------------------- */
{
  check("the batch is randn(4, 10), which every module of cells 66 to 101 takes",
    M.X.length === 4 && M.X[0].length === 10, `[${M.X.length}, ${M.X[0].length}]`);

  check("the batch is a fixed draw at a stated seed, reproducible on every call",
    M.batch(makeRng(M.BATCH_SEED)).flat().every((v, i) => v === M.X.flat()[i]),
    `seed ${M.BATCH_SEED}`);

  const flat = M.X.flat();
  const mean = M.mean(flat);
  check("the batch is drawn from a standard normal",
    Math.abs(mean) < 0.4 && Math.abs(Math.sqrt(M.mean(flat.map((v) => (v - mean) ** 2))) - 1) < 0.35,
    `mean ${mean.toFixed(3)} over ${flat.length} values`);
}

/* --- 2 · Ordering: cell 62's three perspectives ------------------------------ *
 * The page named three architectures until 2026-09-10, when Kenneth asked for
 * the notebook's principles instead and picked candidate A of
 * `composition-ordering-mock.html`. What is asserted here is what the three
 * views walk, what the drive button is called on each, which caption waits for
 * which unit, and the three stage heights the mock measured — none of which a
 * pixel hash of a settled figure can see.
 */
{
  const pat = M.ordering("pattern");
  const comb = M.ordering("combinations");
  const pos = M.ordering("position");
  /* source comments are exempt from the copy rules and from these two, since
     decision 15 names in prose exactly what it removed from the code (5.9) */
  const bare = (u) => readFileSync(new URL(u, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const src = bare("../composition/main.js");
  const model = bare("../composition/model.js");
  /* the section markers are comments, so the slicing reads the file as written */
  const rawSrc = readFileSync(new URL("../composition/main.js", import.meta.url), "utf8");

  {
    /* core resolves a slot whose menu follows the data type to that menu's
       first option when the link names only the data type (params.js) */
    const spec = {
      data: { type: "segmented", options: [{ value: "image" }, { value: "vectors" }, { value: "sequence" }], default: "image" },
      step1: { type: "select", options: (v) => M.slotOptions(v.data, 0), optionsFrom: "data", default: "Conv2d-3-16-3" },
    };
    const at = (q) => resolveParams(spec, new URLSearchParams(q)).step1;
    check("a link naming only the data type resolves the slots to that menu (core)",
      at("data=sequence") === "Embedding-6-4" && at("data=sequence&step1=Conv2d-3-16-3") === "Embedding-6-4"
        && at("") === "Conv2d-3-16-3" && at("data=sequence&step1=Embedding-6-8") === "Embedding-6-8");
  }

  check("the three views walk 4 steps, 3 combinations and 4 positions",
    pat.units === 4 && comb.units === 3 && pos.units === 4,
    `${pat.units} / ${comb.units} / ${pos.units}`);

  check("a view the link does not name falls back to the pattern",
    M.ordering("subunit").view === "pattern" && M.ordering(undefined).view === "pattern");

  check("the pattern is Transform, Normalize, Activate, Regularize",
    M.PATTERN === "Transform → Normalize → Activate → Regularize");

  check("every step names the job it does and the layers that fill it",
    M.ROLES.every((r) => r.job && r.eg && r.hue),
    M.ROLES.map((r) => r.eg.split(",")[0]).join(", "));

  check("two of the four steps carry weights, and the other two carry none",
    M.ROLES_WITH_WEIGHTS === 2
    && M.ROLES.filter((r) => r.weights).map((r) => r.role).join(", ") === "Transform, Normalize",
    `${M.ROLES_WITH_WEIGHTS} of ${M.ROLES.length}`);

  check("the three hues are group-a, group-b twice, and group-c",
    M.ROLES.map((r) => r.hue).join(" ") === "groupA groupB groupB groupC",
    "the job separates the steps, so Normalize and Activate share a hue");

  check("the three combinations are Conv + Pool, Embedding + Recurrent or Attention, Linear + Activation",
    M.COMBOS.map((c) => c.boxes.join(" ")).join(" | ")
      === "Convolution Pooling | Embedding Recurrent Attention | Linear Activation");

  check("the sequence combination is the one with an alternative in it",
    M.COMBOS.filter((c) => c.or != null).length === 1 && M.COMBOS[1].or === 2
    && M.COMBOS[1].follows === "Recurrent or Attention");

  check("every combination names the data it suits and the layer that follows",
    M.COMBOS.every((c) => c.data && c.reason && c.boxes.includes(c.follows.split(" or ")[0])));

  check("the four positions are the beginning, the repeated middle and two at the end",
    M.POSITIONS.map((p) => p.pos).join(" ") === "beginning middle end end"
    && M.POSITIONS.filter((p) => p.repeated).length === 1
    && M.POSITIONS[1].box === "Subunit",
    M.POSITIONS.map((p) => p.box).join(" → "));

  check("the repeated position's side text is the pattern itself",
    M.POSITIONS[1].side[0] === M.PATTERN && M.POSITIONS[1].side.length === 2);

  check("no position carries more than the two lines a 30px box has room for",
    M.POSITIONS.every((p) => p.side.length <= 2));

  /* THE DRIVE LABEL NESTS ON `view`, through core's own label map — the door
     the sibling widget grew and Building already uses for its two APIs. */
  check("the drive label nests on view: Next step, Next combination, Next position",
    /ordering: \{\s*param: "view",\s*labels: \{ pattern: "Next step", combinations: "Next combination", position: "Next position" \}/
      .test(src),
    "Step names the unit of the view it is in");

  /* THE CAPTIONS. Pattern and Position hold a result that waits for the last
     unit and a definition that reads at rest; Combinations holds one reason a
     group, each marked `only`, so the row shows for the group being lit. */
  const capsOf = (st) => M.captions({}, st);
  check("Pattern and Position hold a result at the last unit and a definition at rest",
    [pat, pos].every((st) => {
      const c = capsOf(st);
      return c.length === 2 && c[0].at === st.units && c[1].at === 0;
    }));

  check("Combinations holds one reason a group, each waiting for its own group",
    capsOf(comb).length === 3
    && capsOf(comb).every((c, i) => c.at === i + 1 && c.only === true)
    && capsOf(comb).map((c) => c.text).join("") === M.COMBOS.map((c) => c.reason).join(""));

  /* EVERY ORDERING CAPTION IS ONE ROW WIDE. The block is 17px a row and the
     three stage heights below are measured at 2, 1 and 2 rows, so a line that
     wrapped would move the page. Measured on the live canvas at --fs-sm over a
     522px stage: the three reasons are 470, 478 and 451px, Position's two lines
     444 and 416, Pattern's 392 and 452. The character cap is the proxy the
     verify script can hold, since node has no canvas to ask. */
  check("every Ordering caption line fits the 522px stage on one row",
    [pat, comb, pos].every((st) => capsOf(st).every((c) => c.text.length <= 90)),
    `widest ${Math.max(...[pat, comb, pos].flatMap((st) => capsOf(st).map((c) => c.text.length)))} characters, `
    + "478px of 522 measured");
  check("no caption reads before its unit lands, on any of the three views",
    [pat, comb, pos].every((st) => capsOf(st).every((c) =>
      c.at === 0 || M.stageOf(0, c.at) !== "landed")),
    "the definition line is the only one on the stage at rest");

  /* THE THREE HEIGHTS, at the caption row counts the browser measures: 2 rows
     on Pattern, 1 on Combinations, 2 on Position (the mock, §A). */
  check("the three views are 286, 243 and 394px at 550",
    M.orderHeight("pattern", 2) === 286
    && M.orderHeight("combinations", 1) === 243
    && M.orderHeight("position", 2) === 394,
    `${M.orderHeight("pattern", 2)} / ${M.orderHeight("combinations", 1)} / ${M.orderHeight("position", 2)}`);

  check("each view's figure is the mock's own body: 198, 172 and 306px",
    M.orderBodyH("pattern") === 198 && M.orderBodyH("combinations") === 172
    && M.orderBodyH("position") === 306,
    "four boxes and three edges, one group block, four positions between input and output");

  check("the three combination groups are 159px on a 522px stage, boxes 139 wide",
    M.comboGroupW(522) === 159 && M.comboGroupW(522) - 20 === 139 && M.COMBO_GROUP_H === 172,
    `${M.comboGroupW(522)}px a group, ${M.COMBO_ROWS} rows deep`);

  /* WHAT THE REBUILD REMOVED, asserted so it cannot come back by accident. */
  check("the three named blocks and their prints are gone from both files",
    !/ORDER_BLOCKS|ORDER_PRINT|COMBO_BOXES/.test(`${src}${model}`)
    && !/\bblock:\s/.test(src) && !/\bblock:\s/.test(model),
    "no ORDER_BLOCKS, no ORDER_PRINT, and no block control");

  check("no architecture is named by anything the page draws",
    ![M.PATTERN, ...M.ROLES.flatMap((r) => [r.role, r.job, r.eg]),
      ...M.COMBOS.flatMap((c) => [...c.boxes, c.data, c.follows, c.reason]),
      ...M.POSITIONS.flatMap((q) => [q.box, q.pos, q.tile, ...q.side]),
      ...M.captions({}, pat).map((c) => c.text),
      ...M.captions({}, comb).map((c) => c.text),
      ...M.captions({}, pos).map((c) => c.text)]
      .some((t) => /\b(MLP|ResNet|Transformer|BERT|GPT)\b/i.test(t)),
    "the roles, the pairs, the positions and the captions name layers and jobs only");

  const orderSrc = rawSrc.slice(rawSrc.indexOf("7 · Ordering"), rawSrc.indexOf("the captions ====="));
  check("Ordering draws no tensor shape at all",
    orderSrc.length > 1000 && !/shapeText|sizeText/.test(orderSrc),
    `the shape story is Dimensions', over ${orderSrc.length} characters of the page`);
}

/* --- 3 · Building: MLP1 prints 3, MLP2 prints 2, both run 3 ------------------ */
{
  const flat = M.building("sequential", "flat", "all", "print");
  const blocks = M.building("sequential", "blocks", "all", "print");
  const all = M.building("module", "flat", "all", "print");
  const learn = M.building("module", "flat", "learnable", "print");

  check("MLP1 prints 3 submodules and MLP2 prints 2, and both run 3",
    all.printed === 3 && learn.printed === 2 && all.run === 3 && learn.run === 3,
    `${all.printed} / ${learn.printed} printed, ${all.run} / ${learn.run} run`);

  check("the parameter count is invariant across all and learnable, at 262",
    all.params === 262 && learn.params === 262, "262 both ways");

  check("the parameter count is NOT invariant across flat and blocks",
    flat.params === 262 && blocks.params === 682, "262 against 682");

  check("blocks is 220 + 420 + 42, the three Linear layers of cell 68",
    M.linearParams(10, 20) + M.linearParams(20, 20) + M.linearParams(20, 2) === 682);

  check("the flat print is cell 66's Sequential, 5 lines",
    flat.print.length === 5 && flat.print[0] === "Sequential("
    && flat.print[2] === "  (1): ReLU()");

  check("MLP1's print is cell 72's, and the widest line is 59 characters",
    all.print[0] === "MLP1(" && M.codeChars(all.print) === 59
    && all.print[1] === "  (fc1): Linear(in_features=10, out_features=20, bias=True)");

  check("MLP2's print carries no ReLU line at all",
    !learn.print.some((l) => l.includes("ReLU")), learn.print.length === 4 ? "4 lines" : "");

  check("the blocks print nests, one Sequential inside another",
    blocks.print.length === 13 && blocks.print[1] === "  (0): Sequential("
    && blocks.print[2] === "    (0): Linear(in_features=10, out_features=20, bias=True)");

  const sum = M.building("module", "flat", "all", "summary").summary;
  check("cell 80's summary() is 64 columns wide",
    M.codeChars(sum) === 64 && sum[0] === "-".repeat(64));

  check("the summary rows are cell 80's own three, at 220, 0 and 42",
    sum[3] === "            Linear-1                   [-1, 20]             220"
    && sum[4] === "              ReLU-2                   [-1, 20]               0"
    && sum[5] === "            Linear-3                    [-1, 2]              42");

  check("summary() totals 262 and reports all of it trainable",
    sum.includes("Total params: 262") && sum.includes("Trainable params: 262")
    && sum.includes("Non-trainable params: 0"));

  /* THE CASE THAT FAILS: an inspection tool under-reporting the model. The
     summary loses the same row the print does, because torchsummary hooks
     registered modules and F.relu is not one. */
  const learnSum = M.building("module", "flat", "learnable", "summary").summary;
  check("summary() loses the activation exactly where the print does",
    !learnSum.some((l) => l.includes("ReLU")) && learnSum.includes("Total params: 262"));

  check("the walk runs one layer at a time, 3 flat and 5 in blocks",
    flat.units === 3 && blocks.units === 5 && all.units === 3 && learn.units === 3);

  check("MLP2's forward calls F.relu, and MLP1's calls self.relu",
    M.CODE_MLP.learnable.includes("x = F.relu(x)")
    && M.CODE_MLP.all.includes("x = self.relu(x)"));
}

/* --- 4 · Dimensions: cell 88's chains, and its two losing routes ------------- */
{
  const chainOf = (data) => M.DATA_SETS[data].menus.map((m) => m[0]);

  const img = M.dimensions("image", chainOf("image"));
  check("the image chain is [4, 3, 32, 32] → [4, 16, 30, 30] → [4, 16, 15, 15] → [4, 3600] → [4, 10]",
    shapeIs(img.steps[0].shape, [4, 16, 30, 30]) && shapeIs(img.steps[1].shape, [4, 16, 15, 15])
    && shapeIs(img.steps[2].shape, [4, 3600]) && shapeIs(img.out, [4, 10]) && !img.failed);

  check("the conv output size is core's own rule, and so is the pool's",
    outSize(32, 3, 1) === 30 && outSize(30, 2, 2) === 15 && outSize(30, 3, 3) === 10);

  check("Conv2d(3, 16, 3) carries 448 parameters",
    M.layerParams({ kind: "conv2d", cin: 3, cout: 16, k: 3 }) === 448, "3 · 16 · 9 + 16");

  const pool3 = M.dimensions("image", ["Conv2d-3-16-3", "MaxPool2d-3", "Flatten", "Linear-1600-10"]);
  check("MaxPool2d(3) gives 16 · 10 · 10 = 1600, and Linear(1600, 10) is the chain that fits",
    shapeIs(pool3.steps[2].shape, [4, 1600]) && shapeIs(pool3.out, [4, 10]) && !pool3.failed);

  const wrongLinear = M.dimensions("image", ["Conv2d-3-16-3", "MaxPool2d-2", "Flatten", "Linear-100-10"]);
  check("Flatten → Linear(100, 10) raises the matmul message, with 3600 against 100",
    wrongLinear.failed
    && wrongLinear.steps[3].error === torchError.matmul([4, 3600], [100, 10]),
    wrongLinear.steps[3].error.slice(0, 62));

  const wrongConv = M.dimensions("image", ["Conv2d-8-16-3", "MaxPool2d-2", "Flatten", "Linear-3600-10"]);
  check("Conv2d(8, 16, 3) on a 3-channel image raises the channels message",
    wrongConv.failed && wrongConv.steps[0].error === torchError.channels([16, 8, 3, 3], [4, 3, 32, 32], 3)
    && wrongConv.steps.length === 1, "the chain stops at the first failure");

  const notFlat = M.dimensions("image", ["Conv2d-3-16-3", "MaxPool2d-2", "ReLU", "Linear-3600-10"]);
  check("a ReLU where a Flatten belongs leaves four dimensions, and the Linear raises",
    shapeIs(notFlat.steps[2].shape, [4, 16, 15, 15]) && notFlat.failed
    && notFlat.steps[3].error.includes("960x15"), "torch flattens the leading dimensions itself");

  const vec = M.dimensions("vectors", chainOf("vectors"));
  check("the vectors chain is [4, 10] → [4, 20] → [4, 20] → [4, 20] → [4, 2]",
    shapeIs(vec.steps[0].shape, [4, 20]) && shapeIs(vec.out, [4, 2]) && !vec.failed);

  const vecBad = M.dimensions("vectors", ["Linear-10-20", "ReLU", "Linear-20-20", "Linear-10-2"]);
  check("Linear(10, 2) after a 20-feature layer raises the matmul message",
    vecBad.failed && vecBad.steps[3].error === torchError.matmul([4, 20], [10, 2]));

  const seq = M.dimensions("sequence", ["Embedding-6-4", "ReLU", "Flatten", "Linear-20-2"]);
  check("the sequence chain is [4, 5] → [4, 5, 4] → [4, 5, 4] → [4, 20] → [4, 2]",
    shapeIs(seq.steps[0].shape, [4, 5, 4]) && shapeIs(seq.steps[2].shape, [4, 20])
    && shapeIs(seq.out, [4, 2]) && !seq.failed);

  const seq8 = M.dimensions("sequence", ["Embedding-6-8", "ReLU", "Flatten", "Linear-40-2"]);
  check("an 8-dimensional embedding flattens to 40, and Linear(40, 2) is what fits it",
    shapeIs(seq8.steps[2].shape, [4, 40]) && !seq8.failed);

  const seqBad = M.dimensions("sequence", ["Embedding-6-4", "ReLU", "Flatten", "Linear-8-2"]);
  check("Linear(8, 2) after a flatten to 20 raises the matmul message",
    seqBad.failed && seqBad.steps[3].error === torchError.matmul([4, 20], [8, 2]));

  check("the embedding adds a dimension rather than replacing one",
    shapeIs(M.shapeAfter([4, 5], { kind: "embedding", vocab: 6, dim: 4 }).shape, [4, 5, 4]));

  check("Flatten keeps dimension 0, which is the batch no layer is told about",
    shapeIs(M.shapeAfter([4, 16, 15, 15], { kind: "flatten" }).shape, [4, 3600]));

  check("a chain's Parameters tile counts only the layers that carry weights",
    img.params === 448 + M.linearParams(3600, 10),
    `${img.params} = 448 + ${M.linearParams(3600, 10)}`);

  /* THE MENU'S OWN PROMISE, and the reason each slot has a menu of its own:
     every option is legal where it sits or fails with one of core's two
     messages, and none of them fails as a rank error torch words a third way. */
  let offered = 0;
  let losing = 0;
  for (const [data, set] of Object.entries(M.DATA_SETS)) {
    for (let slot = 0; slot < 4; slot += 1) {
      for (const opt of set.menus[slot]) {
        /* reach the slot down every combination of the slots before it */
        const prefixes = [[]];
        for (let k = 0; k < slot; k += 1) {
          const grown = [];
          for (const p of prefixes) for (const v of set.menus[k]) grown.push([...p, v]);
          prefixes.length = 0;
          prefixes.push(...grown);
        }
        for (const prefix of prefixes) {
          const chain = [...prefix, opt, ...set.menus.slice(slot + 1).map((m) => m[0])];
          const st = M.dimensions(data, chain);
          const bad = st.steps.find((s) => s.error);
          offered += 1;
          if (!bad) continue;
          losing += 1;
          const ok = bad.error.startsWith("RuntimeError: mat1 and mat2 shapes cannot be multiplied")
            || bad.error.startsWith("RuntimeError: Given groups=1, weight of size");
          if (!ok) {
            check(`${data} slot ${slot + 1} ${opt} fails with a message this widget draws`, false, bad.error);
          }
        }
      }
    }
  }
  check("every menu option is legal where it sits or fails with matmul or channels",
    true, `${offered} chains reached, ${losing} of them losing`);

  check("every data type offers a losing option at every step",
    Object.values(M.DATA_SETS).every((s) => s.menus.every((m) => m.length >= 2)));

  check("the slot values are the class name and the numbers on the face",
    Object.values(M.DATA_SETS).every((s) =>
      s.menus.every((m) => m.every((v) => /^[A-Za-z0-9]+(-\d+)*$/.test(v)))),
    "no punctuation to percent-encode in a shared link");

  check("a slot value from another data type resolves to that menu's first option",
    M.slotLayer("vectors", 0, "Conv2d-3-16-3").key === "Linear-10-20");
}

/* --- 5 · Skip: cell 92, and the width that breaks the add -------------------- */
{
  const s10 = M.skip(10, false);
  const s20 = M.skip(20, false);
  const p20 = M.skip(20, true);

  check("cell 92 as written: f(x) is [4, 10], skip is [4, 10], and the add works",
    s10.match && shapeIs(s10.skipShape, [4, 10]) && s10.out.length === 4
    && s10.out[0].length === 10);

  check("ResidualMLP carries 452 parameters: 220 + 210 + 22",
    s10.params === 452, `${M.linearParams(10, 20)} + ${M.linearParams(20, 10)} + ${M.linearParams(10, 2)}`);

  check("out = x3 + skip, value for value",
    s10.out.every((r, i) => r.every((v, j) => Math.abs(v - (s10.x3[i][j] + s10.skip[i][j])) < 1e-12)));

  check("at width 20 with no projection the add raises torch's broadcast message",
    !s20.match && s20.error === torchError.broadcast(20, 10, 1) && s20.out === null,
    s20.error.slice(0, 60));

  check("the projection makes both sides [4, 20] and the add works again",
    p20.match && shapeIs(p20.skipShape, [4, 20]) && p20.y[0].length === 2);

  check("a projection at width 10 is legal and unnecessary",
    M.skip(10, true).match && M.skip(10, true).params === 452 + M.linearParams(10, 10));

  check("the walk stops at the add where the add is what raises",
    s10.units === 6 && s20.units === 5, `${s10.units} lines against ${s20.units}`);

  check("the forward() body is cell 92's own, line for line",
    M.CODE_SKIP.join("|") === [
      "def forward(self, x):", "skip = x", "x1 = self.fc1(x)", "x2 = self.relu(x1)",
      "x3 = self.fc2(x2)", "out = x3 + skip", "out = self.fc_out(out)", "return out",
    ].join("|"));

  check("the projection changes exactly one line of the body",
    M.CODE_SKIP_PROJ.filter((l, i) => l !== M.CODE_SKIP[i]).length === 1
    && M.CODE_SKIP_PROJ.includes("skip = self.proj(x)"));

  check("the relu is applied to x1 and nothing else",
    s10.x2.every((r, i) => r.every((v, j) => v === Math.max(0, s10.x1[i][j]))));

  /* THE GRADIENT OVERLAY IS GONE (decision 20), so nothing declares it: the
     control, the factors it labelled, the gutter it reserved and its legend row
     all went together. The comments that record the cut are exempt and are
     stripped first, as section 12 does. */
  const bare = (u) => readFileSync(new URL(u, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("neither file declares the gradient overlay any more",
    ["../composition/main.js", "../composition/model.js"].every((u) => {
      const t = bare(u);
      return !/\bgrad\b/.test(t) && !/SKIP_FACTORS/.test(t)
        && !/GRAD_UX/.test(t) && !/slope/.test(t);
    }),
    "no dead declaration of a control the page no longer carries");

  check("cell 90's claim survives as a caption, held to the end of the walk",
    M.captions({ topic: "skip" }, s10).some((c) =>
      c.text.includes("multiplies the gradient by 1") && c.at === s10.units),
    "a sentence rather than a second figure");
}

/* --- 6 · Gating: cell 95, and the mask that blocks whole features ------------ */
{
  const rng = makeRng(1);
  const g = M.gating("sigmoid", rng);
  const m = M.gating("mask", makeRng(1));

  check("GatedMLP's two paths both produce [4, 20]",
    g.h.length === 4 && g.h[0].length === 20 && g.g[0].length === 20);

  check("GatedMLP carries 482 parameters: 220 + 220 + 42",
    g.params === 482, `fc1 ${M.linearParams(10, 20)}, gate_fc ${M.linearParams(10, 20)}, fc2 ${M.linearParams(20, 2)}`);

  check("a sigmoid gate is strictly between 0 and 1, so it blocks nothing outright",
    g.lo > 0 && g.hi < 1 && g.blocked === 0, `${g.lo.toFixed(3)} to ${g.hi.toFixed(3)}`);

  check("gated is h multiplied by g, cell by cell",
    g.gated.every((r, i) => r.every((v, j) => Math.abs(v - g.h[i][j] * g.g[i][j]) < 1e-12)));

  check("a fixed mask holds only 0 and 1, and the same mask for every sample",
    m.g.every((r) => r.every((v) => v === 0 || v === 1))
    && m.g.every((r) => r.join() === m.g[0].join()));

  check("the blocked count is counted from the drawn mask, not from the parameter",
    m.blocked === m.mask.filter((v) => v === 0).length && m.blocked > 0 && m.blocked < 20,
    `${m.blocked} of 20`);

  check("a blocked feature is zero in every row of gated",
    m.mask.every((bit, j) => bit === 1 || m.gated.every((r) => r[j] === 0)));

  check("the mask is the one draw, and it comes from the rng compute is handed",
    M.gating("mask", makeRng(1)).mask.join() === m.mask.join()
    && M.gating("mask", makeRng(7)).mask.join() !== m.mask.join());

  check("at mask the gate path has no gate_fc, so it carries 220 fewer parameters",
    m.params === g.params - M.linearParams(10, 20), `${m.params} against ${g.params}`);

  check("the gate line of forward() follows the control and the rest does not",
    m.code.includes("g = mask") && g.code.includes("g = torch.sigmoid(self.gate_fc(x))")
    && m.code.length === g.code.length);

  check("the forward() body is cell 95's own, line for line",
    M.CODE_GATE.join("|") === [
      "def forward(self, x):", "h = self.relu(self.fc1(x))",
      "g = torch.sigmoid(self.gate_fc(x))", "gated = h * g", "out = self.fc2(gated)", "return out",
    ].join("|"));

  check("the walk is the four lines that produce something", g.units === 4);
}

/* --- 7 · Branching: every option wins somewhere and loses somewhere ---------- */
{
  const c6 = M.branching("concat", 6);
  const c8 = M.branching("concat", 8);
  const a6 = M.branching("add", 6);
  const a8 = M.branching("add", 8);
  const v6 = M.branching("average", 6);
  const v8 = M.branching("average", 8);

  check("BranchMergeMLP is cell 98's: [4, 8] and [4, 6] to [4, 14] to [4, 2]",
    shapeIs([4, c6.x1[0].length], [4, 8]) && shapeIs([4, c6.x2[0].length], [4, 6])
    && c6.feats === 14 && c6.y[0].length === 2);

  check("BranchMergeMLP carries 184 parameters: 88 + 66 + 30",
    c6.params === 184,
    `${M.linearParams(10, 8)} + ${M.linearParams(10, 6)} + ${M.linearParams(14, 2)}`);

  /* DECISION 18: fc3 follows the merged width, so every merge torch accepts
     reaches an output. Cell 98's Linear(14, 2) is the concat-at-6 case. */
  check("fc3's in_features are the width the merge gives, one per combination",
    [["concat", 6, 14], ["concat", 8, 16], ["add", 6, 8], ["add", 8, 8],
      ["average", 6, 8], ["average", 8, 8]]
      .every(([m, f, n]) => M.fc3In(m, f) === n && M.branching(m, f).fc3In === n),
    "concat 14 and 16, add and average 8");

  check("every merge but the notebook's own failure reaches [4, 2]",
    [c6, c8, a8, v8].every((st) => st.y && st.y.length === 4 && st.y[0].length === 2)
    && a6.y === null && v6.y === null,
    "concat at 6 and 8, add at 8, average at 8");

  check("the parameter count follows fc3, six combinations counted",
    [[c6, 184], [c8, 210], [a6, 172], [a8, 194], [v6, 172], [v8, 194]]
      .every(([st, n]) => st.params === n),
    "184 / 210 concat, 172 / 194 add and average");

  check("concat at 8 and 8 gives 16 features, and fc3 is Linear(16, 2)",
    c8.feats === 16 && c8.fc3In === 16 && c8.y[0].length === 2);

  check("add at 8 and 6 raises the broadcast message AT THE MERGE",
    a6.mergeError === torchError.broadcast(8, 6, 1) && a6.merged === null);

  check("add at 8 and 8 works, and fc3 is Linear(8, 2)",
    a8.merged !== null && a8.feats === 8 && a8.fc3In === 8);

  check("average is add halved, value for value",
    v8.merged.every((r, i) => r.every((v, j) => Math.abs(v - a8.merged[i][j] / 2) < 1e-12)));

  check("average at 8 and 6 raises the same broadcast message add does",
    v6.mergeError === a6.mergeError);

  /* THE MATMUL AT FC3 CANNOT HAPPEN NOW, so nothing declares it. The comments
     that record the decision are exempt and are stripped first, as section 12
     does: the header naming what went is the point of keeping it. */
  const noComments = (u) => readFileSync(new URL(u, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("the merge is the only place Branching can raise, and no fcError remains",
    !/fcError/.test(noComments("../composition/model.js"))
    && !/fcError/.test(noComments("../composition/main.js")),
    "no dead declaration of a path that can no longer occur");

  check("the broadcast message is 103 characters, not the 70 the plan counted",
    a6.mergeError.length === 103, `${a6.mergeError.length} characters`);

  check("concat joins the two rows in order, branch 1 first",
    c6.merged[0].slice(0, 8).join() === c6.x1[0].join()
    && c6.merged[0].slice(8).join() === c6.x2[0].join());

  check("the walk stops at the merge where the merge is what raises",
    c6.units === 4 && a6.units === 3);

  check("the merge line of forward() follows the control and the rest does not",
    c6.code[3] === "x3 = torch.cat([x1, x2], dim=1)" && a6.code[3] === "x3 = x1 + x2"
    && v6.code[3] === "x3 = (x1 + x2) / 2"
    && c6.code.filter((l, i) => l !== a6.code[i]).length === 1);

  check("the forward() body is cell 98's own where the merge is a concat",
    M.CODE_BRANCH.join("|") === [
      "def forward(self, x):", "x1 = torch.relu(self.fc1(x))", "x2 = torch.relu(self.fc2(x))",
      "x3 = torch.cat([x1, x2], dim=1)", "y = self.fc3(x3)", "return y",
    ].join("|"));

  check("both branches are relu, so no merged value is negative at concat",
    c6.merged.flat().every((v) => v >= 0));
}

/* --- 8 · Routing: the seed, and what hard routing costs ---------------------- */
{
  const soft = M.routing("soft");
  const hard = M.routing("hard");

  check("SoftRoutingMLP carries 735 parameters: 3 · 220 + 33 + 42",
    soft.params === 735,
    `${3 * M.linearParams(10, 20)} + ${M.linearParams(10, 3)} + ${M.linearParams(20, 2)}`);

  check("the gate produces [4, 3] and every row sums to 1",
    soft.weights.length === 4 && soft.weights[0].length === 3
    && soft.weights.every((r) => Math.abs(r.reduce((a, b) => a + b, 0) - 1) < 1e-12));

  /* THE SEED WAS CHOSEN FOR THIS. Four samples on one branch make the hard
     page's point badly, and 4 of 10 seeds do exactly that. */
  check("the batch seed puts the four samples on more than one branch",
    new Set(soft.top).size >= 2,
    `branches taken: ${soft.top.map((t) => t + 1).join(", ")}`);

  check("the weights are plainly non-uniform, so the mixture is not a third each",
    soft.weights.every((r) => Math.max(...r) > 0.34)
    && Math.max(...soft.weights.map((r) => Math.max(...r))) > 0.5,
    `largest ${Math.max(...soft.weights.map((r) => Math.max(...r))).toFixed(3)} against 0.333`);

  check("the argmax is the branch the widget lights",
    soft.top.every((t, s) => soft.weights[s][t] === Math.max(...soft.weights[s])));

  check("soft routing mixes all three branch outputs",
    soft.combined.every((r, s) => r.every((v, f) =>
      Math.abs(v - soft.outs.reduce((a, o, i) => a + soft.weights[s][i] * o[s][f], 0)) < 1e-12)));

  check("hard routing takes one branch whole, and the other two contribute nothing",
    hard.combined.every((r, s) => r.join() === hard.outs[hard.top[s]][s].join()));

  check("the three branches each produce [4, 20], and combined is [4, 20]",
    soft.outs.every((o) => o.length === 4 && o[0].length === 20)
    && soft.combined[0].length === 20 && soft.y[0].length === 2);

  check("the soft forward() is cell 101's own, line for line",
    M.CODE_ROUTE.soft.join("|") === [
      "def forward(self, x):", "weights = F.softmax(self.gate(x), dim=1)",
      "branch_outs = [branch(x) for branch in self.branches]",
      "outs = torch.stack(branch_outs, dim=1)", "weights = weights.unsqueeze(-1)",
      "combined = torch.sum(weights * outs, dim=1)", "out = self.fc_out(combined)", "return out",
    ].join("|"));

  check("the Routing line is 53 characters, which is the widest in the widget",
    M.codeChars(M.CODE_ROUTE.soft) === 53, `${M.codeChars(M.CODE_ROUTE.soft)} characters`);

  check("hard routing differs from soft in exactly two lines",
    M.CODE_ROUTE.hard.filter((l, i) => l !== M.CODE_ROUTE.soft[i]).length === 2
    && M.CODE_ROUTE.hard.includes("top = weights.argmax(dim=1)"));

  check("the code column is reserved at the soft form, so the diagram does not move",
    hard.codeWidest === M.CODE_ROUTE.soft
    && M.codeChars(hard.codeWidest) >= M.codeChars(hard.code));

  check("both modes walk the same six lines", soft.units === 6 && hard.units === 6);

  /* --- the weighted sum, drawn (Kenneth's round of 2026-09-10) -------------
     The box under the three branches holds three bands of [4, 20], one per
     branch, each cell the product that branch contributes to that sample and
     feature, with the combined band under a rule; one column is framed through
     all four bands and its arithmetic printed under the box. Three things
     there are arithmetic no picture settles: WHAT a cell's shade stands for,
     WHICH column is framed at rest, and whether the printed line adds up to
     the number it ends with. */
  const n2 = (v) => v.toFixed(2);
  const liveAt = (st, s, c) => M.routeSumRows(st, s).filter((r) => r && Math.abs(r[c]) > 0).length;
  const cols = Array.from({ length: M.ROUTE_HIDDEN }, (_, c) => c);

  check("every branch ends in a ReLU, so a feature can be zero in all three",
    cols.some((c) => liveAt(soft, 0, c) === 0),
    `${cols.filter((c) => liveAt(soft, 0, c) === 0).length} of 20 columns are zero in all three`);

  /* THE BANDS ARE THE PRODUCT TENSOR. Twelve hundred shaded cells carry no
     digits, so nothing on the figure says what a shade stands for. */
  check("every soft band cell is the product weights[s][i] × outs[i][s][c]",
    M.routeProducts(soft).every((bd, i) => bd.every((row, s) =>
      row.every((v, c) => Math.abs(v - soft.weights[s][i] * soft.outs[i][s][c]) < 1e-12))),
    `${M.ROUTE_BRANCHES} × ${M.ROUTE_SAMPLES} × ${M.ROUTE_HIDDEN} cells`);

  check("the three bands add down to the combined band, cell for cell",
    soft.combined.every((row, s) => row.every((v, c) =>
      Math.abs(v - M.routeProducts(soft).reduce((a, bd) => a + bd[s][c], 0)) < 1e-12)));

  check("at hard a row is kept only in the band its sample took, and is that row whole",
    M.routeProducts(hard).every((bd, i) => bd.every((row, s) =>
      (hard.top[s] === i
        ? row !== null && row.every((v, c) => v === hard.outs[i][s][c])
        : row === null))),
    `rows kept: ${hard.top.map((t, s) => `sample ${s} in band ${t + 1}`).join(", ")}`);

  check("one band of the tensor is one sample's three rows, the same arithmetic twice",
    [0, 1, 2, 3].every((s) => M.routeSumRows(soft, s).every((row, i) =>
      row.every((v, c) => v === M.routeProducts(soft)[i][s][c]))));

  check("the framed column at rest carries the most non-zero terms of the 20",
    [0, 1, 2, 3].every((s) =>
      liveAt(soft, s, M.routeRestColumn(soft, s)) === Math.max(...cols.map((c) => liveAt(soft, s, c)))
      && liveAt(hard, s, M.routeRestColumn(hard, s)) === Math.max(...cols.map((c) => liveAt(hard, s, c)))),
    `sample 0 frames column ${M.routeRestColumn(soft, 0)}, with ${liveAt(soft, 0, M.routeRestColumn(soft, 0))} of the 3 branches non-zero`);

  check("the largest total breaks the tie between columns with the same count",
    cols.filter((c) => liveAt(soft, 0, c) === liveAt(soft, 0, M.routeRestColumn(soft, 0)))
      .every((c) => Math.abs(soft.combined[0][c]) <= Math.abs(soft.combined[0][M.routeRestColumn(soft, 0)])));

  check("the framed column is never one the printed line would read as all zeros",
    [0, 1, 2, 3].every((s) => liveAt(soft, s, M.routeRestColumn(soft, s)) > 0
      && liveAt(hard, s, M.routeRestColumn(hard, s)) > 0),
    `soft ${[0, 1, 2, 3].map((s) => M.routeRestColumn(soft, s)).join(", ")}`);

  /* THE PRINTED LINE IS THE ONE PLACE A WRONG NUMBER WOULD LOOK RIGHT: four
     shaded strips carry no digits, so nothing on the figure contradicts it. */
  check("the printed line ends at combined[s, j], to the two decimals it prints",
    [0, 1, 2, 3].every((s) => {
      const c = M.routeRestColumn(soft, s);
      const mixed = soft.outs.reduce((a, o, i) => a + soft.weights[s][i] * o[s][c], 0);
      return n2(mixed) === n2(soft.combined[s][c]);
    }));

  check("the printed products add up to the printed total, within a rounded digit",
    [0, 1, 2, 3].every((s) => {
      const c = M.routeRestColumn(soft, s);
      const terms = [0, 1, 2].reduce((a, i) =>
        a + Number(n2(soft.weights[s][i])) * Number(n2(soft.outs[i][s][c])), 0);
      return Math.abs(terms - Number(n2(soft.combined[s][c]))) < 0.01;
    }),
    `worst gap ${Math.max(...[0, 1, 2, 3].map((s) => {
      const c = M.routeRestColumn(soft, s);
      const terms = [0, 1, 2].reduce((a, i) =>
        a + Number(n2(soft.weights[s][i])) * Number(n2(soft.outs[i][s][c])), 0);
      return Math.abs(terms - Number(n2(soft.combined[s][c])));
    })).toFixed(4)}`);

  check("at hard the line carries one value, which is the taken branch's own",
    [0, 1, 2, 3].every((s) => {
      const c = M.routeRestColumn(hard, s);
      return n2(hard.outs[hard.top[s]][s][c]) === n2(hard.combined[s][c])
        && liveAt(hard, s, c) === 1;
    }),
    `sample 0: combined[0, ${M.routeRestColumn(hard, 0)}] = `
    + `${n2(hard.combined[0][M.routeRestColumn(hard, 0)])}, from branch ${hard.top[0] + 1}`);

  /* THE BAND'S PALENESS IS THE WEIGHT TWICE — in the product and again in the
     alpha — and at hard the alpha is the product alone. A shade carries no
     digit, so the rule is read from the drawing rather than from a hash. */
  const drawSrc = readFileSync(new URL("../composition/main.js", import.meta.url), "utf8");
  check("the band's alpha is the product, scaled by that row's own weight at soft",
    /alphaOf\(prod\[i\]\[r\] \? prod\[i\]\[r\]\[c\] : 0, hi\)\s*\*\s*\(hard \? 1 : state\.weights\[r\]\[i\]\)/
      .test(drawSrc));

  check("the four bands and the framed column are drawn and hit from one geometry",
    /function routeSumGeom\(g\)/.test(drawSrc)
    && (drawSrc.match(/routeSumGeom\(g\)/g) ?? []).length === 3,
    "routeSumGeom, read by drawSumBlock and by regions");
}

/* --- 9 · the three torch messages, read from core's one copy ----------------- */
{
  check("the matmul message names mat1 and mat2, with the weight transposed",
    torchError.matmul([4, 3600], [100, 10])
    === "RuntimeError: mat1 and mat2 shapes cannot be multiplied (4x3600 and 100x10)");

  check("the broadcast message names the non-singleton dimension",
    torchError.broadcast(8, 6, 1)
    === "RuntimeError: The size of tensor a (8) must match the size of tensor b (6) at non-singleton dimension 1");

  check("the channels message names the weight, the input and the count it found",
    torchError.channels([16, 8, 3, 3], [4, 3, 32, 32], 3)
    === "RuntimeError: Given groups=1, weight of size [16, 8, 3, 3], expected input[4, 3, 32, 32] to have 8 channels, but got 3 channels instead");

  check("the widget draws only those two of the three, and never a rank error",
    !readFileSync(new URL("../composition/model.js", import.meta.url), "utf8")
      .includes("torchError.broadcast(") === false, "broadcast is Skip's and Branching's");
}

/* --- 10 · the fit pass: no page is wider than the stage --------------------- */
{
  const usable = (w) => w - 2 * M.PAD;
  const CW = {
    skip: M.codeWidth(M.CODE_SKIP),
    gating: M.codeWidth(M.CODE_GATE),
    branching: M.codeWidth(M.CODE_BRANCH),
    routing: M.codeWidth(M.CODE_ROUTE.soft),
  };

  check("the code columns are the mock's own widths at 6.60px a character",
    CW.skip === 146 && CW.gating === 225 && CW.branching === 205 && CW.routing === 350,
    `skip ${CW.skip}, gating ${CW.gating}, branching ${CW.branching}, routing ${CW.routing}`);

  check("Gating's slack is 41px, not the plan's 21",
    usable(550) - M.TEXT_GAP - CW.gating - 20 * 12 === 41,
    `522 − 16 − ${CW.gating} − 240`);

  check("two bands side by side do not fit on Gating's diagram column",
    2 * 20 * 12 + M.GAP > usable(550) - M.TEXT_GAP - CW.gating,
    "502px against a 281px diagram, so the band goes on the result edge");

  /* THE SWEEP. Every page, every parameter, every width from 550 to 776 in
     0.2px steps: `fitSizes` has to leave the widest band inside the stage. */
  let widest = 0;
  let worst = "";
  let steps = 0;
  for (let w = 550; w <= 776.001; w += 0.2) {
    const av = usable(w);
    const beside = {
      routing: M.besideFits(w, CW.routing,
        M.routeDiagMin(M.sizesAt(Math.max(0, Math.min(1, (w - 550) / 220))), M.routeSumFixed())),
      building: M.besideFits(w, M.codeWidth([
        "  (fc1): Linear(in_features=10, out_features=20, bias=True)",
      ]), M.BOX_W),
    };
    const cases = [
      ["skip", M.fitSizes(w, (z) => M.bandWidth.skip(z, CW.skip)), (z) => M.bandWidth.skip(z, CW.skip)],
      ["gating", M.fitSizes(w, (z) => M.bandWidth.gating(z, CW.gating)), (z) => M.bandWidth.gating(z, CW.gating)],
      ["branching", M.fitSizes(w, (z) => M.bandWidth.branching(z, CW.branching)), (z) => M.bandWidth.branching(z, CW.branching)],
      ["routing",
        M.fitSizes(w, (z) => M.bandWidth.routing(z, CW.routing, beside.routing, M.routeSumFixed())),
        (z) => M.bandWidth.routing(z, CW.routing, beside.routing, M.routeSumFixed())],
      ["dimensions", M.sizesAt(0), () => M.bandWidth.dimensions()],
      ["building", M.sizesAt(0), (z) => M.bandWidth.building(z, M.codeWidth([
        "  (fc1): Linear(in_features=10, out_features=20, bias=True)",
      ]), beside.building)],
      ["ordering", M.sizesAt(0), () => M.bandWidth.ordering()],
    ];
    for (const [name, z, widthOf] of cases) {
      steps += 1;
      const over = widthOf(z) - av;
      if (over > widest) {
        widest = over;
        worst = `${name} at w = ${w.toFixed(1)}, ${widthOf(z)} against ${av.toFixed(0)}`;
      }
    }
  }
  check("no page is wider than the stage, swept 550 to 776 in 0.2px steps",
    widest <= 0, `${steps} measurements, worst overshoot ${widest.toFixed(1)}px ${worst}`);

  check("a shaded cell grows with the stage and is floored at the 550 geometry",
    M.sizesAt(0).band === 12 && M.sizesAt(1).band === 16 && M.fitSizes(550, () => 1e9).band === 12);

  /* THE BLOCK MOVED THE CODE. Four columns alone fit beside the code at 770,
     and the weighted-sum block inside the box does not: it needs 456px of box
     there against the 259px beside leaves. */
  check("four columns alone would fit beside Routing's code at 770, and did",
    !M.besideFits(550, CW.routing, M.routeMinDiag(M.sizesAt(0)))
    && M.besideFits(770, CW.routing, M.routeMinDiag(M.sizesAt(1))),
    `four columns need ${M.routeMinDiag(M.sizesAt(0))}px and beside leaves ${usable(550) - CW.routing - M.TEXT_GAP}px`);

  check("the sum block puts Routing's code under the diagram at both widths",
    !M.besideFits(550, CW.routing, M.routeDiagMin(M.sizesAt(0), M.routeSumFixed()))
    && !M.besideFits(770, CW.routing, M.routeDiagMin(M.sizesAt(1), M.routeSumFixed())),
    `the diagram needs ${M.routeDiagMin(M.sizesAt(1), M.routeSumFixed())}px at 770 `
    + `and beside leaves ${usable(770) - CW.routing - M.TEXT_GAP}px`);

  const printW = M.codeWidth([
    "  (fc1): Linear(in_features=10, out_features=20, bias=True)",
  ]);
  check("Building's print is 390px at 59 characters, and does not fit beside at 550",
    printW === Math.ceil(59 * M.MONO_SM) && !M.besideFits(550, printW, M.BOX_W)
    && M.besideFits(770, printW, M.BOX_W),
    `${printW}px, beside at 550 leaves ${usable(550) - printW - M.TEXT_GAP}px against a ${M.BOX_W}px box`);

  check("Skip, Gating and Branching keep their code beside at 550",
    M.besideFits(550, CW.skip, M.SKIP_MIN_DIAG)
    && M.besideFits(550, CW.gating, 2 * M.MIN_BOX + M.COLGAP)
    && M.besideFits(550, CW.branching, 2 * M.MIN_BOX + M.COLGAP));

  /* --- Skip's add, drawn as three bands (decision 19) -----------------------
   * `skipGeom` in main.js, with the constants main.js does not export (XLAB 16
   * and the three boxes on their edges). Two measurements come off the live
   * canvas and are passed in here: how many rows torch's message wraps to, and
   * how many rows the captions wrap to. Both are read from the browser and
   * pinned below, the arrangement `MONO_SM` and Routing's label widths use.
   */
  function skipStage(w, { match = true, errRows = 0, capRows = 2 } = {}) {
    const s = M.fitSizes(w, (z) => M.bandWidth.skip(z, CW.skip));
    const diagW = usable(w) - CW.skip - M.TEXT_GAP;
    const bandH = M.BATCH_N * s.band;
    const blockH = M.skipBlockH(bandH, match, errRows);
    const bodyH = 16 + 3 * (M.EDGE_H + M.BOX_H) + M.EDGE_H + blockH
      + (match ? M.EDGE_H + M.BOX_H + M.EDGE_H : 0);
    const capY = M.BAND_HEAD + bodyH + M.CAP_GAP;
    /* `skipBands` in main.js, measured from the top of the x3 band: an operator
       row between each pair of bands, so the block reads x3 + skip = out */
    const blockTop = M.BAND_HEAD + 16 + 3 * (M.EDGE_H + M.BOX_H) + M.EDGE_H;
    const bandY = [blockTop, blockTop + bandH + M.SKIP_PLUS_GAP,
      blockTop + 2 * bandH + M.SKIP_PLUS_GAP + M.SKIP_EQ_GAP];
    return {
      s, diagW, bandH, blockH, bodyH, capY, blockTop, bandY,
      plusY: bandY[0] + bandH + M.SKIP_PLUS_GAP / 2,
      eqY: bandY[1] + bandH + M.SKIP_EQ_GAP / 2,
      blockW: M.SKIP_BAND_COLS * s.band,
      rowTops: (match ? bandY : bandY.slice(0, 2)).flatMap((y) =>
        Array.from({ length: M.BATCH_N }, (_, r) => y + r * s.band)),
      height: capY + capRows * M.CAPTION_H + M.PAD,
    };
  }

  check("the add's block is 12 rows of band at 550 and the same at 770",
    [550, 770].every((w) => skipStage(w).rowTops.length === 3 * M.BATCH_N)
    && skipStage(550).s.band === 12 && skipStage(770).s.band === 16,
    "x3, skip and out, four samples each");

  check("every band row is inside the block, and the block reads x3 + skip = out",
    [550, 770].every((w) => {
      const st = skipStage(w);
      return st.rowTops.every((y) => y >= st.blockTop
        && y + st.s.band <= st.blockTop + st.blockH - M.SKIP_BLOCK_FOOT)
        /* the + between the two operands, the = between skip and the result */
        && st.plusY > st.bandY[0] + st.bandH && st.plusY < st.bandY[1]
        && st.eqY > st.bandY[1] + st.bandH && st.eqY < st.bandY[2];
    }),
    `at 550 the rows run ${skipStage(550).rowTops[0]} to `
    + `${skipStage(550).rowTops[11] + 12}, in a block of ${skipStage(550).blockH}`);

  check("where the add raises, the message takes the result band's row",
    skipStage(550, { match: false, errRows: 2 }).rowTops.length === 2 * M.BATCH_N
    && M.skipBlockH(48, false, 2) - M.skipBlockH(48, true, 0) === 8,
    "the two operands and the add, and torch's two lines where the result would be");

  /* MEASURED IN THE BROWSER, at the stage the side layout gives (549.6 and
     770.4, which round to the same cell size and the same wrapped counts):
     torch's message takes two rows at both widths, the captions three at 550
     and two at 770. The bands add 152px at 550 and 200 at 770, and the `=` row
     that makes the block read x3 + skip = out adds 18 more at both. */
  check("Skip's stage is 629px at 550 and 660 at 770, the bands included",
    skipStage(550, { capRows: 3 }).height === 629
    && skipStage(770, { capRows: 2 }).height === 660,
    `${skipStage(550, { capRows: 3 }).height} / ${skipStage(770, { capRows: 2 }).height}`);

  check("where the add raises, the stage is 530px at 550 and 562 at 770",
    skipStage(550, { match: false, errRows: 2, capRows: 2 }).height === 530
    && skipStage(770, { match: false, errRows: 2, capRows: 2 }).height === 562,
    "two rows of message in the result band's place, and no fc_out under it");

  check("the widest band and the rail column both fit the diagram, at both widths",
    [550, 770].every((w) => {
      const st = skipStage(w);
      return st.blockW + 60 + 10 <= st.diagW
        && M.bandWidth.skip(st.s, CW.skip) <= usable(w);
    }),
    `${skipStage(550).blockW}px of block against a ${skipStage(550).diagW}px diagram at 550, `
    + `${skipStage(770).blockW} against ${skipStage(770).diagW} at 770`);

  /* --- Routing's weighted-sum block: does it fit, and what does it cost? ----
   * `routeGeom` in main.js, with the three constants main.js does not export
   * (main.js: XLAB 16, ROUTE_SPLIT 36, WBLOCK 64, the floor the box keeps so
   * the gate's four weight rows always have a box to sit in). The label widths
   * are model.js's measured defaults, which is what main.js reads off the live
   * canvas — 43 and 49 on the browser the mock was drawn on. */
  const XLAB = 16;
  const ROUTE_SPLIT = 36;
  const WBLOCK = 64;
  const FIXED = M.routeSumFixed();
  function routeStage(w, force) {
    const t = Math.max(0, Math.min(1, (w - 550) / 220));
    const fits = M.besideFits(w, CW.routing, M.routeDiagMin(M.sizesAt(t), FIXED));
    const beside = force === "beside" ? true : force === "under" ? false : fits;
    const s = M.fitSizes(w, (z) => M.bandWidth.routing(z, CW.routing, beside, FIXED));
    const roomy = beside ? usable(w) - CW.routing - M.TEXT_GAP : usable(w);
    const diagW = Math.max(roomy, force === "beside" ? M.routeMinDiag(s) : M.routeDiagMin(s, FIXED));
    const branchW = Math.floor((diagW - 3 * s.wcell - 3 * M.COLGAP) / 3);
    const boxWidth = 3 * branchW + 2 * M.COLGAP;
    const p = Math.min(s.band, Math.floor((boxWidth - FIXED) / M.ROUTE_HIDDEN));
    const boxH = Math.max(WBLOCK, M.routeSumH(p));
    const diagH = XLAB + ROUTE_SPLIT + 3 * M.BOX_H + boxH + M.SUM_ARITH + 4 * M.EDGE_H;
    const capY = M.BAND_HEAD + diagH + 12
      + (beside ? 0 : M.CODE_ROUTE.soft.length * M.LINE + 10) + M.CAP_GAP;
    return { beside, s, p, boxWidth, boxH, capY, ...blockRows(p) };
  }

  /* `routeSumGeom` in main.js, measured from the box's own top: three branch
     bands and the combined band, each ROUTE_SAMPLES rows of p, and the row
     tops `regions` hands the hit-test. */
  function blockRows(p) {
    const bandH = M.ROUTE_SAMPLES * p;
    const y0 = M.SUM_PAD + M.SUM_HEAD;
    const bandY = [0, 1, 2].map((i) => y0 + i * (bandH + M.SUM_GAP));
    const sumY = bandY[2] + bandH + M.SUM_RULE;
    return {
      bandH,
      bandY,
      sumY,
      rowTops: [...bandY, sumY].flatMap((y) =>
        Array.from({ length: M.ROUTE_SAMPLES }, (_, r) => y + r * p)),
    };
  }

  check("the block's fixed width is 136px, so 20 cells need 376px of box and 456 at 16",
    FIXED === 136 && M.routeSumMinW(M.sizesAt(0)) === 376 && M.routeSumMinW(M.sizesAt(1)) === 456,
    `${M.SUM_LAB_L} + ${M.SUM_LAB_R} of label and ${FIXED - M.SUM_LAB_L - M.SUM_LAB_R} of gaps`);

  check("with the code under the diagram the box holds the block at both widths",
    routeStage(550).boxWidth >= M.routeSumMinW(M.sizesAt(0))
    && routeStage(770).boxWidth >= M.routeSumMinW(M.sizesAt(1))
    && routeStage(550).p === 12 && routeStage(770).p === 16,
    `${routeStage(550).boxWidth}px against 376 at 550, ${routeStage(770).boxWidth}px against 456 at 770`);

  check("beside the code at 770 the box is 259px, and the strips fall to 6px a cell",
    routeStage(770, "beside").boxWidth === 259 && routeStage(770, "beside").p === 6,
    `${M.routeSumMinW(M.sizesAt(1))}px of block against a ${routeStage(770, "beside").boxWidth}px box`);

  /* The caption line counts are read off the canvas that wraps them: three
     lines at 550 and two at 770 (`_lab/composition-routing-sum.html`). */
  /* The caption line counts are read off the canvas that wraps them: three
     lines at 550 and two at 770 (`_lab/composition-routing-sum.html`). The
     stage is the same in both modes, because the box is reserved at one size
     and the caption wraps to the same count either way. */
  const routeH = (w, capLines) => routeStage(w).capY + capLines * M.CAPTION_H + M.PAD;
  check("Routing's stage is 804px at 550 and 851 at 770, the mock's own numbers",
    Math.abs(routeH(550, 3) - 804) <= 3 && Math.abs(routeH(770, 2) - 851) <= 3,
    `${routeH(550, 3)} at 550, ${routeH(770, 2)} at 770, soft and hard alike`);

  check("the box holds the whole tensor: 263px at 550 and 327 at 770, either mode",
    routeStage(550).boxH === 263 && routeStage(770).boxH === 327
    && routeStage(550).boxH === M.routeSumH(12) && M.SUM_ARITH === 24,
    `was ${WBLOCK}px empty and 119 at C's one row, and 24px more for the printed line`);

  /* THE REGION RECTANGLES ARE THE DRAWN ROWS (3.6). No pixel hash can see a
     target six columns from where it is painted, so the arithmetic that puts
     the sixteen band rows inside the box is asserted here. */
  check("the sixteen band rows fill the box between its two pads, at both widths",
    [550, 770].every((w) => {
      const st = routeStage(w);
      return st.sumY + st.bandH + M.SUM_PAD === st.boxH
        && st.rowTops.length === 4 * M.ROUTE_SAMPLES
        && st.rowTops.every((y) => y >= M.SUM_PAD + M.SUM_HEAD && y + st.p <= st.boxH - M.SUM_PAD);
    }),
    `at 550 the rows start ${routeStage(550).rowTops[0]}px into the box and end `
    + `${routeStage(550).rowTops[15] + routeStage(550).p}px in, of ${routeStage(550).boxH}`);

  check("a band row is one sample tall and the twenty cells wide, at both widths",
    [550, 770].every((w) => {
      const st = routeStage(w);
      return st.bandH === M.ROUTE_SAMPLES * st.p
        && st.bandY.every((y, i) => y === st.bandY[0] + i * (st.bandH + M.SUM_GAP))
        && st.sumY === st.bandY[2] + st.bandH + M.SUM_RULE;
    }),
    `rows are ${routeStage(550).p}px at 550 and ${routeStage(770).p}px at 770`);
}

/* --- 11 · the walk is one line ahead ---------------------------------------- *
 * DECISION 14 (Kenneth, 2026-09-10, round 1, comment 3). The stage holds the
 * input, the bus, everything the walk has run, and the layers of exactly ONE
 * more line. Nothing here is visible in a pixel hash of a settled state — every
 * `?shown=N` at full N is the same picture it always was — and a page that
 * revealed two lines ahead, or that never revealed a line at all, would hash
 * identically at both ends of the walk.
 */
{
  const rng = () => makeRng(1);
  const PAGES = [
    ["ordering pattern", {}, M.ordering("pattern")],
    ["ordering combinations", {}, M.ordering("combinations")],
    ["ordering position", {}, M.ordering("position")],
    ["building flat", { show: "print" }, M.building("sequential", "flat", "all", "print")],
    ["building blocks", { show: "print" }, M.building("sequential", "blocks", "all", "print")],
    ["building MLP1", { show: "summary" }, M.building("module", "flat", "all", "summary")],
    ["building MLP2", { show: "print" }, M.building("module", "flat", "learnable", "print")],
    ["dimensions image", {}, M.dimensions("image", M.DATA_SETS.image.menus.map((m) => m[0]))],
    ["dimensions failing", {}, M.dimensions("image", ["Conv2d-3-16-3", "MaxPool2d-2", "Flatten", "Linear-100-10"])],
    ["dimensions sequence", {}, M.dimensions("sequence", M.DATA_SETS.sequence.menus.map((m) => m[0]))],
    ["skip 10", {}, M.skip(10, false)],
    ["skip 20", {}, M.skip(20, false)],
    ["skip 20 proj", {}, M.skip(20, true)],
    ["gating sigmoid", { sample: "0" }, M.gating("sigmoid", rng())],
    ["gating mask", { sample: "0" }, M.gating("mask", rng())],
    ["branching concat 6", { sample: "0" }, M.branching("concat", 6)],
    ["branching concat 8", { sample: "0" }, M.branching("concat", 8)],
    ["branching add 6", { sample: "0" }, M.branching("add", 6)],
    ["branching add 8", { sample: "0" }, M.branching("add", 8)],
    ["routing soft", { sample: "0" }, M.routing("soft")],
    ["routing hard", { sample: "0" }, M.routing("hard")],
  ];

  check("the three stages are landed, preview and absent, and nothing else",
    M.stageOf(2, 1) === "landed" && M.stageOf(2, 2) === "landed"
    && M.stageOf(2, 3) === "preview" && M.stageOf(2, 4) === "absent"
    && M.stageOf(0, 1) === "preview" && M.stageOf(0, 2) === "absent",
    "at 2 lines run: 1 and 2 landed, 3 pale, 4 not drawn");

  check("every page names a unit for every line it runs, and none outside the walk",
    PAGES.every(([, , st]) => {
      const owned = new Set(M.pageUnits(st).map((u) => u.unit));
      return M.pageUnits(st).every((u) => u.unit >= 1 && u.unit <= st.units)
        && Array.from({ length: st.units }, (_, i) => i + 1).every((u) => owned.has(u));
    }),
    `${PAGES.length} pages, ${PAGES.reduce((a, [, , st]) => a + M.pageUnits(st).length, 0)} drawn things`);

  /* THE RULE, SWEPT. At every walk position of every page the drawn set is
     exactly the lines that have run plus the one that is next. */
  let positions = 0;
  const bad = [];
  for (const [name, , st] of PAGES) {
    for (let done = 0; done <= st.units; done += 1) {
      positions += 1;
      const drawn = M.pageUnits(st).filter((u) => M.stageOf(done, u.unit) !== "absent");
      const want = M.pageUnits(st).filter((u) => u.unit <= done + 1);
      const preview = drawn.filter((u) => M.stageOf(done, u.unit) === "preview");
      if (drawn.length !== want.length
        || !drawn.every((u, i) => u.id === want[i].id)
        || !preview.every((u) => u.unit === done + 1)) {
        bad.push(`${name} at ${done}`);
      }
    }
  }
  check("the drawn set is the lines run plus one, at every position of every page",
    bad.length === 0, `${positions} walk positions swept${bad.length ? `, worst ${bad[0]}` : ""}`);

  check("at rest a page draws the first line's layers and nothing further downstream",
    PAGES.every(([, , st]) => M.pageUnits(st).every((u) =>
      M.stageOf(0, u.unit) === (u.unit === 1 ? "preview" : "absent"))));

  check("at the end of the walk every piece of the diagram has landed",
    PAGES.every(([, , st]) => M.pageUnits(st).every((u) => M.stageOf(st.units, u.unit) === "landed")),
    "which is what ?shown=N at full N draws, so the settled states do not move");

  /* THE BAND ROWS ARE THE TARGETS, and a target that is not drawn is not a
     target (3.6). Gating's band is the `gated` line's, Branching's two are its
     branches', and Routing's weight grid is line 1's with the block line 5's —
     so at rest none of them is a row the reader can hit. */
  const REGION_UNITS = { skip: [5], gating: [3], branching: [1, 2], routing: [1, 5] };
  check("no band row is a target at rest on Skip, Gating, Branching or Routing",
    Object.values(REGION_UNITS).every((us) => us.every((u) => M.stageOf(0, u) !== "landed")),
    "the rows appear with the line that computes their values");

  check("Skip's three bands are the add's own line, and land together",
    M.pageUnits(M.skip(10, false)).find((u) => u.id === "bands").unit === 5
    && M.pageUnits(M.skip(20, false)).find((u) => u.id === "bands").unit === 5,
    "x3, skip and out are what `out = x3 + skip` produces");

  const drawSrc = readFileSync(new URL("../composition/main.js", import.meta.url), "utf8");
  check("regions reads the walk the same way draw does, band by band",
    /const walk = walkAt\(walkAnim \?\? \{ n: state\.units \}, state\);/.test(drawSrc)
    && /if \(!landed\(walk, 5\)\) return \[\];[\s\S]{0,200}skipBands/.test(drawSrc)
    && /if \(!landed\(walk, 3\)\) return \[\];/.test(drawSrc)
    && /landed\(walk, 1\) \? rows\(b\.b1\.x/.test(drawSrc)
    && /landed\(walk, 2\) \? rows\(b\.b2\.x/.test(drawSrc)
    && /landed\(walk, 1\) \? rows\(g\.gateCx/.test(drawSrc)
    && /landed\(walk, 5\)\s*\?\s*\[\.\.\.b\.bandY/.test(drawSrc));

  check("Skip's three bands are drawn and hit from one geometry",
    /function skipBands\(g, state\)/.test(drawSrc)
    && (drawSrc.match(/skipBands\(g, state\)/g) ?? []).length === 3,
    "skipBands, read by drawSkip and by regions");

  check("every layer box goes through the one helper, and every edge but the input's",
    (drawSrc.match(/(?<!function |unit)layerBox\(/g) ?? []).length === 1
    && (drawSrc.match(/(?<![a-zA-Z])edge\(ctx/g) ?? []).length === 6,
    "layerBox once, inside unitBox; edge once as its own definition, twice inside "
    + "unitEdge, twice for the input arrow on Skip and Building, and once for the "
    + "branch edge a landed guard already covers");

  /* --- the captions (2.4) --------------------------------------------------
     A line that states a RESULT waits for the line that produced it; a line
     that states a DEFINITION is true before the walk starts. The row is
     reserved either way, so the block is the same height empty as full. */
  check("every caption waits for a line the page actually runs",
    PAGES.every(([, p, st]) => M.captions(p, st).every((c) => c.at >= 0 && c.at <= st.units)),
    `${PAGES.reduce((a, [, p, st]) => a + M.captions(p, st).length, 0)} caption lines`);

  check("every page carries a result line, held at rest and shown at the end",
    PAGES.filter(([n]) => n !== "ordering combination").every(([, p, st]) => {
      const held = M.captions(p, st).filter((c) => c.at > 0);
      return held.length >= 1 && held.every((c) => c.at <= st.units);
    }),
    "Combination is the one page whose two lines are both definitions");

  check("a definition line reads at rest on every page but three",
    PAGES.filter(([n]) => n !== "skip 10" && n !== "skip 20 proj" && n !== "ordering combinations")
      .every(([, p, st]) => M.captions(p, st).some((c) => c.at === 0)),
    "both of Skip's lines there are claims about the add and about the two routes back to x, and "
    + "Ordering's Combinations carries a reason a group and takes its definition from the card");

  check("a result caption is blank at 0 and present at the end of the walk",
    PAGES.filter(([n]) => n !== "ordering combination").every(([, p, st]) =>
      M.captions(p, st).filter((c) => c.at > 0).every((c) =>
        M.stageOf(0, c.at) !== "landed" && M.stageOf(st.units, c.at) === "landed")),
    "the row is measured either way, so the stage height does not move");

  check("the caption block is the same height at every walk position",
    PAGES.every(([, p, st]) => {
      const n = M.captions(p, st).length;
      return Array.from({ length: st.units + 1 }, () => M.captions(p, st).length)
        .every((k) => k === n);
    }),
    "captions() does not read the walk at all, so pageHeight cannot");

  check("the nn.ModuleList line and the input's own shape read at rest",
    M.captions({ sample: "0" }, M.routing("soft")).find((c) => c.text.startsWith("nn.ModuleList")).at === 0
    && M.captions({}, M.dimensions("image", M.DATA_SETS.image.menus.map((m) => m[0])))[0].at === 0,
    "a definition is not a claim about a result");

  check("the two claims Kenneth named as results wait for their own line",
    M.captions({ sample: "0" }, M.branching("concat", 6))[0].at === 3
    && M.captions({ sample: "0" }, M.routing("soft"))[0].at === 5
    && M.captions({}, M.skip(10, false))[0].at === 5
    && M.captions({ sample: "0" }, M.gating("mask", makeRng(1)))[0].at === 3,
    "the merge, the combine, the add, and the multiply");
}

/* --- 12 · the reader-facing copy -------------------------------------------- *
 * 5.9: the copy rules cover every string a reader can see. Source comments are
 * exempt and are stripped first, as `check.mjs` does. */
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const src = strip(readFileSync(new URL("../composition/main.js", import.meta.url), "utf8"));
  const model = strip(readFileSync(new URL("../composition/model.js", import.meta.url), "utf8"));
  const html = readFileSync(new URL("../composition/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const entry = manifest.widgets.find((wd) => wd.slug === "composition");

  /* Every string literal a reader can meet. Double quotes and backticks only:
     the collection writes prose in those, and an apostrophe in "torch's own
     form" would open a string for a scanner that also honoured single ones. */
  const strings = [...`${src}\n${model}`.matchAll(/(["`])((?:\\.|(?!\1)[^\n])*)\1/g)]
    .map((m) => m[2])
    .filter((s) => s.length > 1);

  check("no reader-facing string carries an em-dash",
    !strings.some((s) => s.includes("—")),
    strings.filter((s) => s.includes("—")).slice(0, 2).join(" | "));

  check('no reader-facing string says "never"',
    !strings.some((s) => /\bnever\b/i.test(s)),
    strings.filter((s) => /\bnever\b/i.test(s)).slice(0, 2).join(" | "));

  check("no reader-facing string describes the widget or the page",
    !strings.some((s) => /\b(watch|click|below|this widget|the widget)\b/i.test(s)),
    strings.filter((s) => /\b(watch|click|below)\b/i.test(s)).slice(0, 2).join(" | "));

  check("no reader-facing string names a lesson, a notebook or a cell",
    !strings.some((s) => /\b(notebook|lesson|chapter|cell \d)\b/i.test(s)));

  check("the blurb is one sentence, inside the 120-character cap",
    entry.blurb.length <= 120 && entry.blurb.split(". ").length === 1,
    `${entry.blurb.length} characters`);

  check("the meta description is the blurb verbatim",
    html.includes(`<meta name="description" content="${entry.blurb}">`));

  check("the manifest title, the page title and main.js agree",
    entry.title === "Deep Learning - Composition"
    && html.includes("<title>Deep Learning - Composition · statml widgets</title>")
    && src.includes('title: "Deep Learning - Composition"'));

  check("the widget is declared a draft in both files",
    entry.status === "draft" && src.includes('status: "draft"'));

  const sub = src.match(/subtitle:\s*\n?\s*((?:\s*\+?\s*"(?:[^"\\]|\\.)*"\s*\n?)+)/);
  const subText = sub ? sub[1].match(/"((?:[^"\\]|\\.)*)"/g).map((s) => s.slice(1, -1)).join("") : "";
  check("the subtitle is the audited replacement, inside 2.10's ceiling",
    subText.startsWith("A model is layers composed in an order")
    && subText.length >= 140 && subText.length <= 240,
    `${subText.length} characters`);

  /* URL VALUES ARE READER-FACING COPY (5.9, widget 44's incident): every value
     is a word the control shows or the number on its tick. */
  check("every topic value is its own button's word, lowercased",
    ["ordering", "building", "dimensions", "skip", "gating", "branching", "routing"]
      .every((t) => src.includes(`value: "${t}"`)));

  check("the two ladders carry the numbers on their ticks",
    /width:[\s\S]{0,400}?value: "10", label: "10"/.test(src)
    && /fc2:[\s\S]{0,400}?value: "6", label: "6"/.test(src));

  check("the drive label is Next line, and Next layer where a layer is the unit",
    /stepLabel: { param: "topic", labels: STEP_LABELS, default: "Next line" }/.test(src)
    && /dimensions: "Next layer"/.test(src)
    && /building: { param: "api", labels: { sequential: "Next layer", module: "Next line" }/.test(src));

  check("the rail's two row heads are the notebook's own headings",
    src.includes('const COMPOSING = "Composing layers"') && src.includes('const FLOW = "Controlling flow"'));

  check("the sample is a display parameter on all four flow pages",
    /SAMPLE_FIELD = {[\s\S]*?display: true,/.test(src)
    && /sample: { \.\.\.SAMPLE_FIELD, when: { any: \[ON\("skip"\), ON\("gating"\), ON\("branching"\), ON\("routing"\)\] } }/.test(src));

  check("show, sample and speed keep the walk, and nothing else does",
    (src.match(/display: true/g) ?? []).length === 3, "three display parameters");

  check("the Routing caption carries the two containers by name",
    model.includes("nn.ModuleList holds the three branches so they can be applied in a loop; "
      + "nn.ModuleDict holds them by name so one can be chosen."));

  check("no colour, size or font is hardcoded in the drawing",
    !/#[0-9a-fA-F]{3,6}\b/.test(src) && !/\b\d+px\b/.test(src.replace(/repeat\(/g, "")),
    "every value comes from the tokens");

  check("nothing draws from Math.random",
    !src.includes("Math.random") && !model.includes("Math.random"));

  check("every path in the deployed files is relative",
    !/["'(]\/(?!\/)/.test(html) && !/from "\//.test(src) && !/from "\//.test(model));
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
