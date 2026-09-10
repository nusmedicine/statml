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

/* --- 2 · Ordering: cell 62's three blocks ----------------------------------- */
{
  const mlp = M.ordering("mlp", "subunit");
  const res = M.ordering("resnet", "subunit");
  const tr = M.ordering("transformer", "subunit");
  check("Ordering counts the parameters at the printed sizes",
    M.ORDER_BLOCKS.mlp.params === 260 && M.ORDER_BLOCKS.resnet.params === 2352 && M.ORDER_BLOCKS.transformer.params === 3340,
    "260, 2352, 3340");
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

  check("the box count follows the block: 4, 3 and 5 steps",
    mlp.units === 4 && res.units === 3 && tr.units === 5,
    `${mlp.units} / ${res.units} / ${tr.units}`);

  check("the MLP block is Linear, BatchNorm1d, ReLU, Dropout",
    mlp.block.steps.map(([, c]) => c).join(" → ") === "Linear → BatchNorm1d → ReLU → Dropout");

  check("the ResNet block has no Regularize step at all",
    !res.block.steps.some(([g]) => g === "Regularize"));

  check("the transformer feed-forward path has two Transform steps",
    tr.block.steps.filter(([g]) => g === "Transform").length === 2);

  check("only a Transform changes the shape, and the ResNet Conv2d changes none",
    mlp.changed === 1 && tr.changed === 2 && res.changed === 0,
    `${mlp.changed} / ${tr.changed} / ${res.changed}`);

  check("the transformer widens to [4, 80] and comes back to [4, 20]",
    shapeIs(tr.block.steps[0][2], [4, 80]) && shapeIs(tr.block.steps[4][2], [4, 20]));

  check("nn.Sequential prints one line per layer, plus the two braces",
    M.ORDER_PRINT.mlp.length === 6 && M.ORDER_PRINT.resnet.length === 5
    && M.ORDER_PRINT.transformer.length === 7);

  /* the mock's correction: the plan took the widest print line to be the
     36-character Dropout one, and a Sequential Linear is 57 */
  check("the widest print line is a Linear at 57 characters, not a Dropout at 36",
    M.codeChars(M.ORDER_PRINT.mlp) === 57 && M.codeChars(M.ORDER_PRINT.resnet) === 72,
    `mlp ${M.codeChars(M.ORDER_PRINT.mlp)}, resnet ${M.codeChars(M.ORDER_PRINT.resnet)}`);

  const comb = M.ordering("mlp", "combination");
  check("the Combination view walks the seven layers of the three combinations",
    comb.units === 7 && M.COMBO_BOXES === 7);
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

  check("the overlay names five local factors, one for each edge back to x",
    M.SKIP_FACTORS.length === 5 && M.SKIP_FACTORS.some(([, l]) => l === "1"),
    "the skip route multiplies by 1, which is the claim");
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

  check("concat at 8 and 8 gives 16 features, which Linear(14, 2) rejects",
    c8.feats === 16 && c8.y === null && c8.fcError === torchError.matmul([4, 16], [14, 2]),
    c8.fcError.slice(0, 58));

  check("add at 8 and 6 raises the broadcast message AT THE MERGE",
    a6.mergeError === torchError.broadcast(8, 6, 1) && a6.merged === null && a6.fcError === null);

  check("add at 8 and 8 works, and fc3 still expects 14",
    a8.merged !== null && a8.feats === 8 && a8.fcError === torchError.matmul([4, 8], [14, 2]));

  check("average is add halved, value for value",
    v8.merged.every((r, i) => r.every((v, j) => Math.abs(v - a8.merged[i][j] / 2) < 1e-12)));

  check("average at 8 and 6 raises the same broadcast message add does",
    v6.mergeError === a6.mergeError);

  /* THE TWO FAILURES ARE AT DIFFERENT PLACES, and that is the page. */
  check("the two failures are at different places: the merge, and one layer later",
    Boolean(a6.mergeError) && !a6.fcError && !c8.mergeError && Boolean(c8.fcError));

  check("the broadcast message is 103 characters, not the 70 the plan counted",
    a6.mergeError.length === 103, `${a6.mergeError.length} characters`);

  check("the matmul message is 71 characters",
    c8.fcError.length === 71, `${c8.fcError.length} characters`);

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
      routing: M.besideFits(w, CW.routing, M.routeMinDiag(M.sizesAt(Math.max(0, Math.min(1, (w - 550) / 220))))),
      building: M.besideFits(w, M.codeWidth([
        "  (fc1): Linear(in_features=10, out_features=20, bias=True)",
      ]), M.BOX_W),
      ordering: M.besideFits(w, M.codeWidth(M.ORDER_PRINT.resnet), M.ORDER_MIN_DIAG),
    };
    const cases = [
      ["skip", M.fitSizes(w, (z) => M.bandWidth.skip(z, CW.skip)), (z) => M.bandWidth.skip(z, CW.skip)],
      ["gating", M.fitSizes(w, (z) => M.bandWidth.gating(z, CW.gating)), (z) => M.bandWidth.gating(z, CW.gating)],
      ["branching", M.fitSizes(w, (z) => M.bandWidth.branching(z, CW.branching)), (z) => M.bandWidth.branching(z, CW.branching)],
      ["routing", M.fitSizes(w, (z) => M.bandWidth.routing(z, CW.routing, beside.routing)), (z) => M.bandWidth.routing(z, CW.routing, beside.routing)],
      ["dimensions", M.sizesAt(0), () => M.bandWidth.dimensions()],
      ["building", M.sizesAt(0), (z) => M.bandWidth.building(z, M.codeWidth([
        "  (fc1): Linear(in_features=10, out_features=20, bias=True)",
      ]), beside.building)],
      ["ordering", M.sizesAt(0), (z) => M.bandWidth.ordering(z, M.codeWidth(M.ORDER_PRINT.resnet), beside.ordering)],
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

  check("Routing's code does not fit beside at 550 and does at 770",
    !M.besideFits(550, CW.routing, M.routeMinDiag(M.sizesAt(0)))
    && M.besideFits(770, CW.routing, M.routeMinDiag(M.sizesAt(1))),
    `four columns need ${M.routeMinDiag(M.sizesAt(0))}px and beside leaves ${usable(550) - CW.routing - M.TEXT_GAP}px`);

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
}

/* --- 11 · the reader-facing copy -------------------------------------------- *
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

  check("the reveal carries 0 and 1, which is the arc's convention",
    /grad:[\s\S]{0,300}?value: "0", label: "Off"/.test(src)
    && /value: "1", label: "On"/.test(src));

  check("the drive label is Next line, and Next layer where a layer is the unit",
    /stepLabel: { param: "topic", labels: STEP_LABELS, default: "Next line" }/.test(src)
    && /ordering: "Next layer"/.test(src) && /dimensions: "Next layer"/.test(src)
    && /building: { param: "api", labels: { sequential: "Next layer", module: "Next line" }/.test(src));

  check("the rail's two row heads are the notebook's own headings",
    src.includes('const COMPOSING = "Composing layers"') && src.includes('const FLOW = "Controlling flow"'));

  check("the sample is a display parameter on all four flow pages",
    /SAMPLE_FIELD = {[\s\S]*?display: true,/.test(src)
    && /sample: { \.\.\.SAMPLE_FIELD, when: { any: \[ON\("skip"\), ON\("gating"\), ON\("branching"\), ON\("routing"\)\] } }/.test(src));

  check("show, sample, grad and speed keep the walk, and nothing else does",
    (src.match(/display: true/g) ?? []).length === 4, "four display parameters");

  check("the Routing caption carries the two containers by name",
    src.includes("nn.ModuleList holds the three branches so they can be applied in a loop; "
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
